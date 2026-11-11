import { useEffect, useRef, useState, type ReactNode } from "react";

export function useTheme() {
  const [theme, setTheme] = useState<string>(() => document.documentElement.dataset.theme || "light");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("tw-theme", theme); } catch { /* ignore */ }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === "dark" ? "light" : "dark"))] as const;
}

export function ThemeToggle() {
  const [theme, toggle] = useTheme();
  return (
    <button className="btn" onClick={toggle} title="Switch light / dark">
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal glass" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Confirm({
  title, message, confirmLabel = "Delete", onConfirm, onClose,
}: { title: string; message: string; confirmLabel?: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted">{message}</p>
      <div className="row end">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}

export function Menu({ label, items }: { label: string; items: { label: string; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div className="menu" ref={ref}>
      <button className="btn" onClick={() => setOpen((o) => !o)}>{label} ▾</button>
      {open && (
        <div className="menu-pop glass">
          {items.map((it) => (
            <button key={it.label} className="menu-item" onClick={() => { setOpen(false); it.onClick(); }}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const CATEGORIES = [
  "Fiction", "Romance", "Thriller", "Mystery", "Fantasy", "Drama", "Horror",
  "Historical", "Children", "Poetry", "Biography", "Other",
];

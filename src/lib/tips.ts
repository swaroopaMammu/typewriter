// "Show this hint once" bookkeeping + a queue so tips appear one at a time, 3 seconds each.
const KEY = (id: string) => `tw-tip-${id}`;
export const TIP_MS = 3000;

export const tipSeen = (id: string) => {
  try { return localStorage.getItem(KEY(id)) === "1"; } catch { return false; }
};
export const markTip = (id: string) => {
  try { localStorage.setItem(KEY(id), "1"); } catch { /* ignore */ }
};

export interface TipItem {
  id: string;
  order: number;
  /** false while the target is hidden (e.g. a desktop-only button on a phone): skipped without using up the tip */
  visible: () => boolean;
  show: () => void;
  hide: () => void;
}

const items = new Map<string, TipItem>();
let current: TipItem | null = null;
let startTimer: number | undefined;
let endTimer: number | undefined;

function next() {
  if (document.getElementById("splash")) { startTimer = window.setTimeout(next, 300); return; } // wait for the splash screen
  const it = [...items.values()].sort((a, b) => a.order - b.order).find((i) => i.visible());
  if (!it) { current = null; return; }
  current = it;
  items.delete(it.id);
  markTip(it.id); // once only: counted as seen the moment it is shown
  it.show();
  endTimer = window.setTimeout(() => {
    it.hide();
    current = null;
    startTimer = window.setTimeout(next, 500);
  }, TIP_MS);
}

/** Queue a tip for a feature; returns an unregister function. Already-seen tips are ignored. */
export function registerTip(it: TipItem): () => void {
  if (tipSeen(it.id)) return () => {};
  items.set(it.id, it);
  if (!current) {
    window.clearTimeout(startTimer);
    startTimer = window.setTimeout(next, 1000); // let the other tips on the page register first
  }
  return () => {
    items.delete(it.id);
    if (current?.id === it.id) {
      it.hide();
      current = null;
      window.clearTimeout(endTimer);
      startTimer = window.setTimeout(next, 500);
    }
  };
}

import { useEffect, useRef, useState } from "react";
import { transliterate } from "../lib/translit/engine";
import { buildCandidates, fetchOnline } from "../lib/translit/suggest";
import { loadLearned, saveLearned } from "../lib/translit/learned";
import { getTarget, onTarget } from "./target";

interface Props {
  mode: "ml" | "en";
  online: boolean;
  onToggleMode: () => void;
}

/**
 * Phone typing bar. Soft keyboards compose text in ways keydown can't intercept, so you type Manglish
 * into this plain bar; Space/Enter or a suggestion inserts the Malayalam word at the cursor of whichever
 * field you last tapped (a chapter, a scene setup, a dialogue line...).
 */
export default function ComposerBar({ mode, online, onToggleMode }: Props) {
  const barRef = useRef<HTMLInputElement>(null);
  const wordRef = useRef("");
  const timer = useRef<number | undefined>(undefined);
  const [word, setWord] = useState("");
  const [cands, setCands] = useState<string[]>([]);
  const [sel, setSel] = useState(0);
  const [hasTarget, setHasTarget] = useState(false);

  useEffect(() => { loadLearned(); }, []);
  useEffect(() => onTarget(() => setHasTarget(!!getTarget())), []);

  useEffect(() => {
    wordRef.current = word;
    window.clearTimeout(timer.current);
    if (mode !== "ml" || !word) { setCands([]); setSel(0); return; }
    setCands(buildCandidates(word, online));
    setSel(0);
    if (online) {
      timer.current = window.setTimeout(async () => {
        const r = await fetchOnline(word);
        if (r && wordRef.current === word) setCands(buildCandidates(word, online));
      }, 150);
    }
  }, [word, mode, online]);

  /** Keep the ref in step immediately: state/effects lag a keystroke behind fast typing. */
  function updateWord(w: string) {
    wordRef.current = w;
    setWord(w);
  }
  function clearBar() {
    if (barRef.current) barRef.current.value = "";
    updateWord("");
  }

  /** Insert at the cursor, replacing any selected text. */
  function insert(text: string) {
    const t = getTarget();
    if (!t) return;
    const el = t.el;
    const len = el.value.length;
    const start = Math.min(el.selectionStart ?? len, len);
    const end = Math.min(el.selectionEnd ?? start, len);
    el.value = el.value.slice(0, start) + text + el.value.slice(end);
    const np = start + text.length;
    el.setSelectionRange(np, np);
    t.onChange(el.value);
  }

  /** Delete the selection, or the character before the cursor (wherever the cursor was tapped). */
  function backspace() {
    const t = getTarget();
    if (!t) return;
    const el = t.el;
    const len = el.value.length;
    const start = Math.min(el.selectionStart ?? len, len);
    const end = Math.min(el.selectionEnd ?? start, len);
    const from = start === end ? start - 1 : start;
    if (from < 0 || (start === end && start === 0)) return;
    el.value = el.value.slice(0, from) + el.value.slice(end);
    el.setSelectionRange(from, from);
    t.onChange(el.value);
  }

  /** Insert the current word (chosen candidate, or raw in English mode) followed by `trailing`. */
  function commitWord(index: number, trailing: string, w = wordRef.current) {
    let out = w;
    if (mode === "ml" && w) {
      out = buildCandidates(w, online)[index] ?? transliterate(w);
      if (index > 0) saveLearned(w, out);
    }
    insert(out + trailing);
    clearBar();
  }

  function onInput(e: React.FormEvent<HTMLInputElement>) {
    const v = e.currentTarget.value;
    const m = v.match(/^([A-Za-z~_]*)([^A-Za-z~_])([\s\S]*)$/);
    if (m && mode === "ml") {
      commitWord(sel, m[2], m[1]);
      if (m[3]) { if (barRef.current) barRef.current.value = m[3]; updateWord(m[3].replace(/[^A-Za-z~_]/g, "")); }
      return;
    }
    if (mode === "en") {
      if (/\s$/.test(v)) { insert(v); clearBar(); } else updateWord(v);
      return;
    }
    updateWord(v);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); commitWord(sel, "\n"); }
    else if (e.key === "Backspace" && !e.currentTarget.value) { e.preventDefault(); backspace(); }
  }

  return (
    <div className="composer glass">
      {cands.length > 0 && (
        <div className="chips">
          {cands.map((c, i) => (
            <button
              key={c}
              className={i === sel ? "chip-btn active ml" : "chip-btn ml"}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => { setSel(i); commitWord(i, " "); barRef.current?.focus(); }}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      {!hasTarget && <div className="muted small bar-hint">Tap a text field above, then type here.</div>}
      <div className="bar">
        <button className="btn mode" onPointerDown={(e) => e.preventDefault()} onClick={onToggleMode}>
          {mode === "ml" ? "മല" : "En"}
        </button>
        <input
          ref={barRef}
          className="bar-input"
          type="text"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="enter"
          placeholder={mode === "ml" ? "Type Manglish, e.g. namaskaram" : "Type English"}
          onInput={onInput}
          onKeyDown={onKeyDown}
        />
        <button className="btn" onPointerDown={(e) => e.preventDefault()} onClick={() => commitWord(sel, "\n")} aria-label="New line">⏎</button>
        <button className="btn" onPointerDown={(e) => e.preventDefault()} onClick={() => { if (wordRef.current) clearBar(); else backspace(); }} aria-label="Backspace">⌫</button>
      </div>
    </div>
  );
}

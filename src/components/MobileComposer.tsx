import { useEffect, useRef, useState } from "react";
import { transliterate } from "../lib/translit/engine";
import { buildCandidates, fetchOnline } from "../lib/translit/suggest";
import { loadLearned, saveLearned } from "../lib/translit/learned";

interface Props {
  initial: string;
  mode: "ml" | "en";
  online: boolean;
  onChange: (value: string) => void;
  onToggleMode: () => void;
}

/**
 * Phone typing. Soft keyboards compose text in ways keydown can't intercept, so instead of
 * rewriting the document live, the user types Manglish into a plain bar; tapping Space/Enter or a
 * suggestion inserts the Malayalam word into the (read-only) document at the caret.
 */
export default function MobileComposer({ initial, mode, online, onChange, onToggleMode }: Props) {
  const docRef = useRef<HTMLTextAreaElement>(null);
  const barRef = useRef<HTMLInputElement>(null);
  const caret = useRef(initial.length);
  const wordRef = useRef("");
  const timer = useRef<number | undefined>(undefined);
  const [word, setWord] = useState("");
  const [cands, setCands] = useState<string[]>([]);
  const [sel, setSel] = useState(0);

  useEffect(() => { loadLearned(); }, []);

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

  function insert(text: string) {
    const el = docRef.current;
    if (!el) return;
    const pos = Math.min(caret.current, el.value.length);
    el.value = el.value.slice(0, pos) + text + el.value.slice(pos);
    caret.current = pos + text.length;
    el.setSelectionRange(caret.current, caret.current);
    if (caret.current >= el.value.length) el.scrollTop = el.scrollHeight;
    onChange(el.value);
  }

  /** Keep the ref in step immediately: state/effects lag a keystroke behind fast typing. */
  function updateWord(w: string) {
    wordRef.current = w;
    setWord(w);
  }

  function clearBar() {
    if (barRef.current) barRef.current.value = "";
    updateWord("");
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
      // English: insert on every space so the document keeps up
      if (/\s$/.test(v)) { insert(v); clearBar(); } else updateWord(v);
      return;
    }
    updateWord(v);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitWord(sel, "\n");
    } else if (e.key === "Backspace" && !e.currentTarget.value) {
      e.preventDefault();
      backspace();
    }
  }

  function backspace() {
    const el = docRef.current;
    if (!el || caret.current <= 0) return;
    const pos = Math.min(caret.current, el.value.length);
    el.value = el.value.slice(0, pos - 1) + el.value.slice(pos);
    caret.current = pos - 1;
    el.setSelectionRange(caret.current, caret.current);
    onChange(el.value);
  }

  return (
    <>
      <textarea
        ref={docRef}
        className="editor"
        lang="ml"
        readOnly
        inputMode="none"
        defaultValue={initial}
        placeholder="Tap here to place the cursor, then type below…"
        onClick={() => { caret.current = docRef.current?.selectionStart ?? caret.current; barRef.current?.focus(); }}
        onSelect={() => { if (document.activeElement === docRef.current) caret.current = docRef.current?.selectionStart ?? caret.current; }}
      />
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
          <button className="btn" onPointerDown={(e) => e.preventDefault()} onClick={() => { if (wordRef.current) { clearBar(); } else backspace(); }} aria-label="Backspace">⌫</button>
        </div>
      </div>
    </>
  );
}

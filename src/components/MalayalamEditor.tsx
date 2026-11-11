import { useEffect, useRef, useState } from "react";
import { isWordChar } from "../lib/translit/engine";
import { buildCandidates, fetchOnline } from "../lib/translit/suggest";
import { loadLearned, saveLearned } from "../lib/translit/learned";
import { caretCoords } from "./caret";

type El = HTMLTextAreaElement | HTMLInputElement;

interface Props {
  initial: string;
  mode: "ml" | "en";
  online: boolean;
  onChange: (value: string) => void;
  /** single-line <input> instead of a <textarea> (scene location etc.) */
  single?: boolean;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** Ctrl/Cmd+Enter (used for "next speaker" in screenplays) */
  onCtrlEnter?: () => void;
}

interface St { start: number; buf: string; len: number; cands: string[]; sel: number }
const empty = (): St => ({ start: 0, buf: "", len: 0, cands: [], sel: 0 });

/** Replace [from,to) with text, keeping the browser undo stack when possible. */
function replaceRange(el: El, from: number, to: number, text: string) {
  const before = el.value;
  const expected = before.slice(0, from) + text + before.slice(to);
  el.focus();
  el.setSelectionRange(from, to);
  try {
    if (text === "") { if (from !== to) document.execCommand("delete"); }
    else document.execCommand("insertText", false, text);
  } catch {
    /* fall through to the check below */
  }
  // Browsers can mishandle combining marks (e.g. a lone ം) and snap the selection to grapheme
  // boundaries. Whatever happened, force the exact text we intended.
  if (el.value !== expected) {
    el.value = expected;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  const pos = from + text.length;
  el.setSelectionRange(pos, pos);
}

interface Popup { cands: string[]; sel: number; left: number; top: number; bottom: number }

export default function MalayalamEditor({ initial, mode, online, onChange, single, className, placeholder, autoFocus, onCtrlEnter }: Props) {
  const ref = useRef<El>(null);
  const st = useRef<St>(empty());
  const timer = useRef<number | undefined>(undefined);
  const [popup, setPopup] = useState<Popup | null>(null);

  const reset = () => {
    window.clearTimeout(timer.current);
    st.current = empty();
    setPopup(null);
  };

  useEffect(() => { loadLearned(); if (autoFocus) ref.current?.focus(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { reset(); /* eslint-disable-next-line */ }, [mode]);

  function showPopup(el: El) {
    const s = st.current;
    if (!s.buf) { setPopup(null); return; }
    const c = caretCoords(el, s.start);
    const r = el.getBoundingClientRect();
    setPopup({ cands: s.cands, sel: s.sel, left: r.left + c.left, top: r.top + c.top, bottom: r.top + c.top + c.height });
  }

  function scheduleOnline(el: El, buf: string) {
    window.clearTimeout(timer.current);
    if (!online) return;
    timer.current = window.setTimeout(async () => {
      const res = await fetchOnline(buf);
      if (!res) return;
      const s = st.current;
      if (s.buf !== buf || s.sel !== 0) return;
      if (el.selectionStart !== el.selectionEnd || el.selectionStart !== s.start + s.len) return;
      const cands = buildCandidates(buf, online);
      if (cands[0] !== el.value.slice(s.start, s.start + s.len)) replaceRange(el, s.start, s.start + s.len, cands[0]);
      st.current = { ...s, cands, len: cands[0].length };
      showPopup(el);
    }, 120);
  }

  function typeLetter(el: El, ch: string) {
    const s = st.current;
    let from = el.selectionStart ?? 0;
    const to = el.selectionEnd ?? from;
    let buf = "";
    if (s.buf && from === to && from === s.start + s.len) { from = s.start; buf = s.buf; }
    buf += ch;
    const cands = buildCandidates(buf, online);
    replaceRange(el, from, to, cands[0]);
    st.current = { start: from, buf, len: cands[0].length, cands, sel: 0 };
    showPopup(el);
    scheduleOnline(el, buf);
  }

  function choose(el: El, idx: number) {
    const s = st.current;
    const text = s.cands[idx];
    if (text === undefined) return;
    replaceRange(el, s.start, s.start + s.len, text);
    st.current = { ...s, sel: idx, len: text.length };
    showPopup(el);
  }

  /** Accept the highlighted candidate; remember it if the user picked it explicitly. */
  function commit(el: El) {
    const s = st.current;
    if (!s.buf) return;
    const text = s.cands[s.sel];
    if (text !== undefined) {
      if (el.value.slice(s.start, s.start + s.len) !== text) replaceRange(el, s.start, s.start + s.len, text);
      if (s.sel > 0) saveLearned(s.buf, text);
    }
    reset();
  }

  function onKeyDown(e: React.KeyboardEvent<El>) {
    const el = e.currentTarget;
    if (e.nativeEvent.isComposing) return;
    const s = st.current;
    const mods = e.ctrlKey || e.metaKey || e.altKey;

    if (onCtrlEnter && (e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      commit(el);
      onCtrlEnter();
      return;
    }

    if (mode === "ml" && !mods && e.key.length === 1 && isWordChar(e.key)) {
      e.preventDefault();
      typeLetter(el, e.key);
      return;
    }

    const active = mode === "ml" && !!s.buf && el.selectionStart === el.selectionEnd && el.selectionStart === s.start + s.len;
    if (!active) { if (s.buf) reset(); return; }
    if (["Shift", "Control", "Alt", "Meta", "CapsLock"].includes(e.key)) return;
    if (mods) { commit(el); return; }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = s.cands.length;
      choose(el, (s.sel + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
    } else if (e.key === "Tab") {
      e.preventDefault();
      commit(el);
    } else if (e.key === "Escape") {
      e.preventDefault();
      reset();
    } else if (/^[1-9]$/.test(e.key) && Number(e.key) <= s.cands.length) {
      e.preventDefault();
      st.current = { ...s, sel: Number(e.key) - 1 };
      commit(el);
    } else if (e.key === "Backspace") {
      e.preventDefault();
      const buf = s.buf.slice(0, -1);
      if (!buf) {
        replaceRange(el, s.start, s.start + s.len, "");
        reset();
      } else {
        const cands = buildCandidates(buf, online);
        replaceRange(el, s.start, s.start + s.len, cands[0]);
        st.current = { start: s.start, buf, len: cands[0].length, cands, sel: 0 };
        showPopup(el);
        scheduleOnline(el, buf);
      }
    } else {
      // space, enter, punctuation, arrows...: accept the word, then let the key do its normal job
      commit(el);
    }
  }

  const flip = popup && popup.bottom + 8 + popup.cands.length * 34 > window.innerHeight;

  const common = {
    lang: "ml",
    spellCheck: false,
    autoComplete: "off",
    defaultValue: initial,
    onKeyDown,
    onMouseDown: () => { const el = ref.current; if (el) commit(el); },
    onBlur: () => { const el = ref.current; if (el) commit(el); },
    onInput: (e: React.FormEvent<El>) => onChange(e.currentTarget.value),
    placeholder: placeholder ?? (mode === "ml" ? "Type in Manglish… e.g. namaskaram" : "Type in English…"),
  };

  return (
    <>
      {single ? (
        <input ref={ref as React.RefObject<HTMLInputElement>} className={className ?? "editor-line"} {...common} />
      ) : (
        <textarea ref={ref as React.RefObject<HTMLTextAreaElement>} className={className ?? "editor"} {...common} />
      )}
      {popup && (
        <div
          className="suggest glass"
          style={flip ? { left: popup.left, bottom: window.innerHeight - popup.top + 4 } : { left: popup.left, top: popup.bottom + 4 }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {popup.cands.map((c, i) => (
            <div
              key={c}
              className={i === popup.sel ? "sug active" : "sug"}
              onMouseDown={(e) => { e.preventDefault(); const el = ref.current; if (el) { st.current = { ...st.current, sel: i }; commit(el); } }}
            >
              <span className="k">{i + 1}</span>
              <span className="ml">{c}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isWordChar } from "../lib/translit/engine";
import { buildCandidates, fetchOnline } from "../lib/translit/suggest";
import { loadLearned, saveLearned } from "../lib/translit/learned";
import { caretCoords } from "./caret";
import { IS_TOUCH } from "../env";
import { TIP_MS } from "../lib/tips";

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
  /** plain Enter in a single-line field (e.g. "add this character"); receives the field's final text */
  onEnter?: (value: string) => void;
  /** with onEnter: empty this same field right away, so the next name can be typed at once (focus never leaves it) */
  clearOnEnter?: boolean;
}

interface St { start: number; buf: string; len: number; cands: string[]; sel: number }
const empty = (): St => ({ start: 0, buf: "", len: 0, cands: [], sel: 0 });

// The "pick a suggestion by its number" hint shows on every page load (reload included), but only once per load.
let suggestHintShown = false;

let programmatic = false; // true while we insert text ourselves, so the beforeinput handler leaves it alone

/** Replace [from,to) with text, keeping the browser undo stack when possible. */
function replaceRange(el: El, from: number, to: number, text: string) {
  const before = el.value;
  const expected = before.slice(0, from) + text + before.slice(to);
  el.focus();
  el.setSelectionRange(from, to);
  programmatic = true;
  try {
    if (text === "") { if (from !== to) document.execCommand("delete"); }
    else document.execCommand("insertText", false, text);
  } catch {
    /* fall through to the check below */
  } finally {
    programmatic = false;
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

export default function MalayalamEditor({ initial, mode, online, onChange, single, className, placeholder, autoFocus, onCtrlEnter, onEnter, clearOnEnter }: Props) {
  const ref = useRef<El>(null);
  const st = useRef<St>(empty());
  const timer = useRef<number | undefined>(undefined);
  const [popup, setPopup] = useState<Popup | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [sugTip, setSugTip] = useState(false);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipAnchor = useRef({ left: 0, top: 0, bottom: 0 });
  const sugTipTimer = useRef<number | undefined>(undefined);

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
    const c = caretCoords(el, s.start + s.len);
    const r = el.getBoundingClientRect();
    setPopup({ cands: IS_TOUCH ? s.cands.slice(0, 6) : s.cands, sel: s.sel, left: r.left + c.left, top: r.top + c.top, bottom: r.top + c.top + c.height });
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

  /** Backspace inside the word being typed: drop its last Manglish letter. Returns false when not applicable. */
  function backspaceWord(el: El): boolean {
    const s = st.current;
    const active = mode === "ml" && !!s.buf && el.selectionStart === el.selectionEnd && el.selectionStart === s.start + s.len;
    if (!active) return false;
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
    return true;
  }

  // ---- phone keyboards: no usable keydown, so read the browser's beforeinput / composition events instead
  const beforeInput = useRef<(e: InputEvent) => void>(() => {});
  beforeInput.current = (e) => {
    const el = ref.current;
    if (!el || mode !== "ml" || programmatic || e.isComposing) return;
    if (e.inputType === "insertText" && e.data && e.data.length === 1 && isWordChar(e.data)) {
      e.preventDefault(); // one typed key: run it through the Manglish engine instead
      typeLetter(el, e.data);
    } else if (e.inputType === "deleteContentBackward") {
      if (backspaceWord(el)) e.preventDefault(); else if (st.current.buf) reset();
    }
  };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const f = (e: Event) => beforeInput.current(e as InputEvent);
    el.addEventListener("beforeinput", f);
    return () => el.removeEventListener("beforeinput", f);
  }, []);

  /** Some keyboards compose a whole word (predictive text). When it ends, re-type those letters through the engine. */
  function onCompositionEnd(e: React.CompositionEvent<El>) {
    const el = e.currentTarget;
    const data = e.data || "";
    if (mode !== "ml" || !/[A-Za-z~_]/.test(data)) return;
    const caret = el.selectionStart ?? 0;
    const from = caret - data.length;
    if (from < 0 || el.value.slice(from, caret) !== data) return;
    reset();
    replaceRange(el, from, caret, "");
    for (const ch of data) {
      if (isWordChar(ch)) typeLetter(el, ch);
      else { commit(el); const at = el.selectionStart ?? 0; replaceRange(el, at, at, ch); }
    }
  }

  function onKeyDown(e: React.KeyboardEvent<El>) {
    const el = e.currentTarget;
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Unidentified" || e.nativeEvent.keyCode === 229) return; // soft keyboard: handled in beforeinput
    const s = st.current;
    const mods = e.ctrlKey || e.metaKey || e.altKey;

    if (onCtrlEnter && (e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      commit(el);
      onCtrlEnter();
      return;
    }

    if (onEnter && single && e.key === "Enter" && !mods && !e.shiftKey) {
      e.preventDefault();
      commit(el); // finish the word being typed, then hand over the whole text
      const text = el.value;
      if (text.trim() && clearOnEnter) replaceRange(el, 0, el.value.length, "");
      onEnter(text);
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
      backspaceWord(el);
    } else {
      // space, enter, punctuation, arrows...: accept the word, then let the key do its normal job
      commit(el);
    }
  }

  // first time suggestions appear after the page loads: say, for 3 seconds, that a word or its number can be clicked
  useEffect(() => {
    if (!popup || suggestHintShown) return;
    suggestHintShown = true;
    tipAnchor.current = { left: popup.left, top: popup.top, bottom: popup.bottom };
    setSugTip(true);
    sugTipTimer.current = window.setTimeout(() => setSugTip(false), TIP_MS);
  }, [popup !== null]); // eslint-disable-line
  useEffect(() => () => window.clearTimeout(sugTipTimer.current), []);

  // vertical dropdown right at the cursor: just below the line, or just above it when there is no room below
  // (e.g. the phone keyboard covers the lower part of the screen). Always kept inside the screen.
  useLayoutEffect(() => {
    const el = popRef.current;
    if (!el || !popup) return;
    const vv = window.visualViewport;
    const vw = vv?.width ?? window.innerWidth;
    const top0 = vv?.offsetTop ?? 0;
    const bottom0 = top0 + (vv?.height ?? window.innerHeight);
    const r = el.getBoundingClientRect();
    const roomBelow = bottom0 - popup.bottom - 6;
    const roomAbove = popup.top - top0 - 6;
    const above = r.height > roomBelow && roomAbove > roomBelow;
    el.style.left = `${Math.max(8, Math.min(popup.left, vw - 8 - r.width))}px`;
    el.style.top = `${above ? Math.max(top0 + 4, popup.top - r.height - 2) : popup.bottom + 2}px`;
  }, [popup, sugTip]);

  // The hint bubble: above the line being typed, or below the dropdown when there is no clear room above. It follows the
  // dropdown as it grows, and stays the full 3 seconds even if the dropdown closes first (fast typing closes it at Space).
  // Declared after the dropdown's own placement effect so it reads the dropdown's final position.
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el || !sugTip) return;
    const a = tipAnchor.current;
    const left = popup?.left ?? a.left;
    const vw = window.visualViewport?.width ?? window.innerWidth;
    const r = el.getBoundingClientRect();
    const minTop = (document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0) + 8; // keep clear of the toolbar
    const above = (popup?.top ?? a.top) - r.height - 12;
    const below = popRef.current ? popRef.current.getBoundingClientRect().bottom + 10 : a.bottom + 8;
    el.style.left = `${Math.max(8, Math.min(left, vw - 8 - r.width))}px`;
    el.style.top = `${above >= minTop ? above : below}px`;
    el.classList.toggle("flip", above < minTop);
  }, [sugTip, popup]);


  const common = {
    lang: "ml",
    spellCheck: false,
    autoComplete: "off",
    defaultValue: initial,
    onKeyDown,
    onMouseDown: () => { const el = ref.current; if (el) commit(el); },
    onBlur: () => { const el = ref.current; if (el) commit(el); },
    onInput: (e: React.FormEvent<El>) => onChange(e.currentTarget.value),
    placeholder: placeholder ?? (mode === "ml" ? "Type in English letters… e.g. namaskaram" : "Start writing…"),
    onCompositionEnd,
    ...(onEnter ? { enterKeyHint: "done" as const } : {}),
    autoCapitalize: "none",
    autoCorrect: "off",
    // Malayalam mode: the "email" keyboard has no predictive text or autocorrect, so letters reach us one at a time
    ...(IS_TOUCH && mode === "ml" ? { inputMode: "email" as const } : {}),
  };

  return (
    <>
      {single ? (
        <input ref={ref as React.RefObject<HTMLInputElement>} className={className ?? "editor-line"} {...common} />
      ) : (
        <textarea ref={ref as React.RefObject<HTMLTextAreaElement>} className={className ?? "editor"} {...common} />
      )}
      {popup && createPortal(
        <div
          ref={popRef}
          className="suggest glass"
          style={{ left: popup.left, top: popup.bottom + 2 }}
          onPointerDown={(e) => e.preventDefault()}
        >
          {popup.cands.map((c, i) => (
            <div
              key={c}
              className={i === popup.sel ? "sug active" : "sug"}
              onPointerDown={(e) => { e.preventDefault(); const el = ref.current; if (el) { st.current = { ...st.current, sel: i }; commit(el); } }}
            >
              <span className="k">{i + 1}</span>
              <span className="ml">{c}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}
      {sugTip && createPortal(
        <div ref={tipRef} className="tip tip-float" role="status">
          {IS_TOUCH
            ? "Tap a word, or its number, to pick it. Space takes the first one."
            : "Pick a word by clicking it or pressing its number (1–9). Press Space to take the first one."}
        </div>,
        document.body,
      )}
    </>
  );
}

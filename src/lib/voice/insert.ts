
type Field = HTMLInputElement | HTMLTextAreaElement;

/** Text to insert at [start,end) of `value`, with a space before/after only where one is needed. Pure. */
export function spliceDictation(value: string, start: number, end: number, spoken: string) {
  const t = spoken.trim();
  if (!t) return null;
  const pre = start > 0 && !/\s/.test(value[start - 1]) ? " " : "";
  const post = end < value.length && /\s/.test(value[end]) ? "" : " ";
  const insert = pre + t + post;
  return { insert, value: value.slice(0, start) + insert + value.slice(end), caret: start + insert.length };
}

// ---- remember the last editor field the writer used (clicking the mic button blurs it)
let last: Field | null = null;
let tracking = false;
const EDITABLE = ".paper textarea, .paper input:not([type=checkbox]):not([type=radio]):not([type=button])";

export function trackFields() {
  if (tracking) return;
  tracking = true;
  document.addEventListener("focusin", (e) => {
    const el = e.target as HTMLElement;
    if (el instanceof HTMLElement && el.matches(EDITABLE)) last = el as Field;
  });
}

function currentField(): { el: Field } | null {
  if (last?.isConnected) return { el: last };
  const first = document.querySelector<Field>(EDITABLE);
  return first ? { el: first } : null;
}

/** Insert dictated text at the caret of the last-used field. Returns false when there is no field to write into. */
export function insertDictation(spoken: string): boolean {
  const f = currentField();
  if (!f) return false;
  const { el } = f;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const r = spliceDictation(el.value, start, end, spoken);
  if (!r) return true;
  el.focus();
  {
    el.setSelectionRange(start, end);
    try { document.execCommand("insertText", false, r.insert); } catch { /* fall through */ }
    if (el.value !== r.value) {
      el.value = r.value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  el.setSelectionRange(r.caret, r.caret);
  return true;
}

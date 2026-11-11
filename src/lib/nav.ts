/** Index to move to when stepping `dir` through `len` items from `cur` (-1 = nothing focused yet). Wraps around. */
export function nextIndex(len: number, cur: number, dir: 1 | -1): number {
  if (len <= 0) return -1;
  if (cur < 0) return dir === 1 ? 0 : len - 1;
  return (cur + dir + len) % len;
}

const FIELDS = "input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([disabled]), textarea:not([disabled]), select:not([disabled])";
const visible = (el: HTMLElement) => el.getClientRects().length > 0;

function toEnd(el: HTMLElement) {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    try { const n = el.value.length; el.setSelectionRange(n, n); } catch { /* not a text field */ }
  }
}

/** The things Ctrl+Alt+←/→ step through: an open dialog's fields and buttons, otherwise the writing area's fields. */
function stops(): HTMLElement[] {
  const modal = document.querySelector<HTMLElement>(".modal");
  if (modal) {
    return Array.from(modal.querySelectorAll<HTMLElement>(`${FIELDS}, button:not([disabled]):not([aria-label="Close"])`)).filter(visible);
  }
  const paper = document.querySelector<HTMLElement>(".paper");
  return paper ? Array.from(paper.querySelectorAll<HTMLElement>(FIELDS)).filter(visible) : [];
}

/** Move keyboard focus to the next / previous field (no mouse needed). Returns false when there is nothing to move to. */
export function stepFocus(dir: 1 | -1): boolean {
  const list = stops();
  const i = nextIndex(list.length, list.indexOf(document.activeElement as HTMLElement), dir);
  if (i < 0) return false;
  const el = list[i];
  el.focus();
  toEnd(el);
  el.scrollIntoView({ block: "nearest" });
  return true;
}

/** Put the cursor in the first field of the writing area (used after jumping to another chapter). */
export function focusFirstField(): void {
  const first = document.querySelector<HTMLElement>(`.paper textarea, .paper input:not([type=hidden])`);
  if (first) { first.focus(); toEnd(first); }
}

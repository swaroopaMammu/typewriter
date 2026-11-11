/** The field the phone typing bar currently writes into (set when the user taps a field). */
export type FieldEl = HTMLInputElement | HTMLTextAreaElement;
export interface Target { el: FieldEl; onChange: (v: string) => void }

let cur: Target | null = null;
const subs = new Set<() => void>();

export function setTarget(t: Target | null) {
  if (cur && cur.el !== t?.el) cur.el.classList.remove("ml-active");
  cur = t;
  t?.el.classList.add("ml-active");
  subs.forEach((f) => f());
}
export const getTarget = () => (cur && cur.el.isConnected ? cur : null);
export function onTarget(f: () => void) {
  subs.add(f);
  return () => { subs.delete(f); };
}

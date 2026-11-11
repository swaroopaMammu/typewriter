import { db } from "../db/db";

/** Words the user explicitly picked from the suggestion list: latin -> malayalam. */
const map = new Map<string, string>();
let loading: Promise<void> | null = null;

export function loadLearned(): Promise<void> {
  if (!loading) {
    loading = db.words
      .toArray()
      .then((all) => { all.forEach((w) => map.set(w.latin, w.ml)); })
      .catch(() => undefined);
  }
  return loading;
}
export const getLearned = (latin: string) => map.get(latin);
export function saveLearned(latin: string, ml: string) {
  map.set(latin, ml);
  db.words.put({ latin, ml, updatedAt: Date.now() }).catch(() => undefined);
}

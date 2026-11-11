import { transliterate } from "./engine";
import { getLearned } from "./learned";

const DIGRAPHS = ["sh", "th", "dh", "ch", "zh", "nj", "ng", "kh", "gh", "bh", "ph", "aa", "ee", "oo", "ii", "uu", "ai", "au", "ou"];
// letters people type loosely: the likely alternatives, tried one at a time
const CONS_ALT: Record<string, string[]> = {
  l: ["L"], L: ["l"], n: ["N"], N: ["n"], t: ["T", "th"], T: ["t"], th: ["t"],
  d: ["D", "dh"], D: ["d"], dh: ["d"], r: ["R"], R: ["r"], s: ["sh", "S"], sh: ["s", "S"], S: ["s"],
};
const VOW_ALT: Record<string, string[]> = {
  a: ["aa"], aa: ["a"], i: ["ee"], ee: ["i"], u: ["oo"], oo: ["u"], e: ["E"], E: ["e"], o: ["O"], O: ["o"],
};

function split(buf: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < buf.length; ) {
    const two = buf.slice(i, i + 2);
    if (DIGRAPHS.includes(two)) { out.push(two); i += 2; } else { out.push(buf[i]); i++; }
  }
  return out;
}

/** Offline candidates: the plain rule output first, then single/double edits of ambiguous letters. */
export function localCandidates(buf: string): string[] {
  const primary = transliterate(buf);
  const seen = new Set([primary]);
  const res = [primary];
  const add = (toks: string[]) => {
    const v = transliterate(toks.join(""));
    if (!seen.has(v)) { seen.add(v); res.push(v); }
  };
  const toks = split(buf);
  const consEdits: [number, string][] = [];
  const vowEdits: [number, string][] = [];
  toks.forEach((t, i) => {
    (CONS_ALT[t] ?? []).forEach((a) => consEdits.push([i, a]));
    (VOW_ALT[t] ?? []).forEach((a) => vowEdits.push([i, a]));
  });
  const apply = (edits: [number, string][]) => {
    const c = [...toks];
    edits.forEach(([i, a]) => { c[i] = a; });
    return c;
  };
  for (const e of consEdits) add(apply([e]));
  for (const e of vowEdits) add(apply([e]));
  for (const c of consEdits) for (const v of vowEdits) if (c[0] !== v[0]) add(apply([c, v]));
  return res;
}

// ---- Google Input Tools (unofficial, online only). Used only when the user turns it on.
const cache = new Map<string, string[]>();
const inflight = new Map<string, Promise<string[] | null>>();
let downUntil = 0;

export function fetchOnline(word: string): Promise<string[] | null> {
  const key = word.toLowerCase();
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  if (Date.now() < downUntil || /[~_]/.test(key)) return Promise.resolve(null);
  let p = inflight.get(key);
  if (!p) {
    p = (async () => {
      const ctl = new AbortController();
      const timeout = setTimeout(() => ctl.abort(), 2500);
      try {
        const url =
          "https://inputtools.google.com/request?itc=ml-t-i0-und&num=6&cp=0&cs=1&ie=utf-8&oe=utf-8&app=demopage&text=" +
          encodeURIComponent(key);
        const r = await fetch(url, { signal: ctl.signal });
        const j = await r.json();
        const list: unknown = j?.[0] === "SUCCESS" ? j?.[1]?.[0]?.[1] : null;
        if (Array.isArray(list)) {
          const ml = list.filter((c): c is string => typeof c === "string" && /[ഀ-ൿ]/.test(c));
          if (ml.length) { cache.set(key, ml); return ml; }
        }
        return null;
      } catch {
        downUntil = Date.now() + 20000; // back off when offline / blocked
        return null;
      } finally {
        clearTimeout(timeout);
        inflight.delete(key);
      }
    })();
    inflight.set(key, p);
  }
  return p;
}

/** Final ordered list for the popup: learned pick, Google, rule output, edits. */
export function buildCandidates(buf: string, online: boolean): string[] {
  const out: string[] = [];
  const push = (c?: string) => { if (c && !out.includes(c)) out.push(c); };
  push(getLearned(buf));
  if (online) (cache.get(buf.toLowerCase()) ?? []).slice(0, 5).forEach(push);
  localCandidates(buf).forEach(push);
  return out.slice(0, 9);
}

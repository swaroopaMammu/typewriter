/**
 * Manglish -> Malayalam transliteration engine (rule based, offline).
 *
 * Pure function: transliterate(latin) -> malayalam. The editor re-runs it on
 * the whole in-progress word at every keystroke, so there is no hidden state.
 */

const VIRAMA = "്";

// key -> [independent vowel, matra ("" for inherent 'a')]
const VOWELS: Record<string, [string, string]> = {
  a: ["അ", ""],
  aa: ["ആ", "ാ"],
  A: ["ആ", "ാ"],
  i: ["ഇ", "ി"],
  ii: ["ഈ", "ീ"],
  ee: ["ഈ", "ീ"],
  I: ["ഈ", "ീ"],
  u: ["ഉ", "ു"],
  uu: ["ഊ", "ൂ"],
  oo: ["ഊ", "ൂ"],
  U: ["ഊ", "ൂ"],
  e: ["എ", "െ"],
  E: ["ഏ", "േ"],
  ai: ["ഐ", "ൈ"],
  o: ["ഒ", "ൊ"],
  O: ["ഓ", "ോ"],
  au: ["ഔ", "ൗ"],
  ou: ["ഔ", "ൗ"],
};

// key -> sequence of base consonants (conjunct sequences are expanded here)
const CONSONANTS: Record<string, string[]> = {
  k: ["ക"], kh: ["ഖ"], g: ["ഗ"], gh: ["ഘ"], ng: ["ങ"],
  c: ["ക"], ch: ["ച"], chh: ["ഛ"], j: ["ജ"], jh: ["ഝ"], nj: ["ഞ"],
  T: ["ട"], Th: ["ഠ"], D: ["ഡ"], Dh: ["ഢ"], N: ["ണ"],
  t: ["ട"], d: ["ഡ"],
  th: ["ത"], thh: ["ഥ"], dh: ["ദ"], dhh: ["ധ"], n: ["ന"],
  p: ["പ"], ph: ["ഫ"], f: ["ഫ"], b: ["ബ"], bh: ["ഭ"], m: ["മ"],
  y: ["യ"], r: ["ര"], R: ["റ"], l: ["ല"], L: ["ള"], zh: ["ഴ"],
  v: ["വ"], w: ["വ"], sh: ["ശ"], S: ["ഷ"], shh: ["ഷ"], s: ["സ"], h: ["ഹ"],
  z: ["സ"], q: ["ക"], x: ["ക", "സ"],
  // explicit conjuncts / geminates that differ from naive parsing
  tt: ["ട", "ട"],
  tth: ["ത", "ത"],
  rr: ["റ", "റ"],
  nk: ["ങ", "ക"],
  nt: ["ന", "റ"],
  nth: ["ന", "ത"],
  ndh: ["ന", "ദ"],
  nd: ["ണ", "ട"],
  nT: ["ണ", "ട"],
  nch: ["ഞ", "ച"],
  ksh: ["ക", "ഷ"],
  cch: ["ച", "ച"],
  ddh: ["ദ", "ദ"],
};

// literal characters (chillus, anusvara, visarga)
const LITERALS: Record<string, string> = {
  "n~": "ൻ",
  "N~": "ൺ",
  "r~": "ർ",
  "l~": "ൽ",
  "L~": "ൾ",
  "k~": "ൿ",
  M: "ം",
  H: "ഃ",
};

const MAX_KEY = 4;

type Tok =
  | { t: "C"; chars: string[] }
  | { t: "V"; ind: string; matra: string }
  | { t: "L"; ch: string }
  | { t: "BREAK" };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    let matched = false;
    for (let len = Math.min(MAX_KEY, src.length - i); len >= 1; len--) {
      const key = src.slice(i, i + len);
      if (LITERALS[key] !== undefined) {
        out.push({ t: "L", ch: LITERALS[key] });
      } else if (CONSONANTS[key]) {
        // "ng" + vowel is virtually always ങ്ങ (angane = അങ്ങനെ); lone ങ is only used before ക-വർഗ്ഗം
        const next = src[i + len];
        if (key === "ng" && next !== undefined && "aeiouAEIOU".includes(next)) {
          out.push({ t: "C", chars: ["ങ", "ങ"] });
        } else {
          out.push({ t: "C", chars: CONSONANTS[key] });
        }
      } else if (VOWELS[key]) {
        out.push({ t: "V", ind: VOWELS[key][0], matra: VOWELS[key][1] });
      } else if (key === "_") {
        out.push({ t: "BREAK" });
      } else {
        continue;
      }
      i += len;
      matched = true;
      break;
    }
    if (!matched) {
      // unknown character: pass through untouched
      out.push({ t: "L", ch: src[i] });
      i++;
    }
  }
  return out;
}

const FINAL_CHILLU: Record<string, string> = {
  "ന": "ൻ",
  "ണ": "ൺ",
  "ര": "ർ",
  "ല": "ൽ",
  "ള": "ൾ",
  "മ": "ം",
};

/** Transliterate one word (no spaces). */
export function transliterate(src: string): string {
  const toks = tokenize(src);
  let out = "";
  let open = false; // last emitted is a consonant with no vowel yet
  let lastConsonant = ""; // last consonant char in `open` state
  let clusterStart = true; // last consonant was NOT joined to a previous one by virama

  for (const tok of toks) {
    if (tok.t === "C") {
      for (const ch of tok.chars) {
        if (open) {
          out += VIRAMA;
          clusterStart = false;
        } else {
          clusterStart = true;
        }
        out += ch;
        open = true;
        lastConsonant = ch;
      }
    } else if (tok.t === "V") {
      out += open ? tok.matra : tok.ind;
      open = false;
    } else if (tok.t === "L") {
      if (open) out += VIRAMA;
      out += tok.ch;
      open = false;
    } else {
      // explicit break: close the open consonant with a virama
      if (open) out += VIRAMA;
      open = false;
    }
  }

  // word-final handling: lone n/N/r/l/L -> chillu, lone m -> anusvara
  if (open) {
    if (clusterStart && FINAL_CHILLU[lastConsonant]) {
      out = out.slice(0, -1) + FINAL_CHILLU[lastConsonant];
    } else {
      out += VIRAMA;
    }
  }
  return out;
}

/** True if a character belongs to the in-progress Manglish word. */
export function isWordChar(ch: string): boolean {
  return /^[A-Za-z~_]$/.test(ch);
}

import { countWords, db, unitName, type NovelType, type Section } from "../db/db";
import { transliterate } from "../translit/engine";

export type ImportMode = "convert" | "keep";

export interface ImportOptions {
  title: string;
  category: string;
  type: NovelType;
  /** "convert": Manglish (English letters) → Malayalam; "keep": store the text exactly as it is. */
  mode: ImportMode;
}

/** Normalise line endings / stray spaces without touching the words. */
export function cleanText(raw: string): string {
  return raw
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Convert English-letter (Manglish) words to Malayalam. Existing Malayalam, digits and punctuation are untouched.
 * A word typed in sentence case ("Avan") is read as lower case, since capitals are separate sounds in Manglish.
 * Runs entirely on the device (rule-based; nothing is sent anywhere).
 */
export function convertToMalayalam(text: string): string {
  return text.replace(/[A-Za-z~_]+/g, (w) => transliterate(/^[A-Z][a-z]+$/.test(w) ? w.toLowerCase() : w));
}

const HEADING = /^\s*(chapter|part|canto|poem|അധ്യായം|അദ്ധ്യായം|ഭാഗം|കവിത)(?![A-Za-z\u0d00-\u0d7f])/i;

/** "Chapter 1", "Chapter 2: Two", "അധ്യായം 3": a short line starting with a heading word that is not a sentence. */
export function isHeading(line: string): boolean {
  const t = line.trim();
  return t.length <= 60 && HEADING.test(t) && !/[A-Za-z\u0d00-\u0d7f]{2,}[.!?]$/.test(t);
}

/** Join hard-wrapped lines of a paragraph (novels). Headings stay on their own line; text that already has one paragraph per line is left alone. */
export function reflow(text: string): string {
  if (!/\n\s*\n/.test(text)) return text;
  return text
    .split(/\n\s*\n/)
    .map((para) => {
      const parts: string[] = [];
      let buf: string[] = [];
      const flush = () => { if (buf.length) parts.push(buf.join(" ")); buf = []; };
      for (const line of para.split("\n")) {
        if (isHeading(line)) { flush(); parts.push(line.trim()); } else if (line.trim()) buf.push(line.trim());
      }
      flush();
      return parts.join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}
const CHUNK_WORDS = 1500;

export interface Piece { title: string; body: string }

/** Split into chapters (novels) / poems at "Chapter 1", "അധ്യായം 2" … lines; falls back to size-based chapters. */
export function splitSections(text: string, type: NovelType): Piece[] {
  const lines = text.split("\n");
  const marks: number[] = [];
  lines.forEach((l, i) => { if (isHeading(l)) marks.push(i); });

  if (marks.length) {
    const out: Piece[] = [];
    const pre = lines.slice(0, marks[0]).join("\n").trim();
    if (pre) out.push({ title: "", body: pre });
    marks.forEach((m, k) => {
      const body = lines.slice(m + 1, marks[k + 1] ?? lines.length).join("\n").trim();
      out.push({ title: lines[m].trim(), body });
    });
    return out;
  }
  if (type === "poem" || countWords(text) <= CHUNK_WORDS * 1.3) return [{ title: "", body: text }];

  const out: Piece[] = [];
  let cur: string[] = [];
  let n = 0;
  for (const para of text.split(/\n\s*\n/)) {
    cur.push(para);
    n += countWords(para);
    if (n >= CHUNK_WORDS) { out.push({ title: "", body: cur.join("\n\n") }); cur = []; n = 0; }
  }
  if (cur.length) out.push({ title: "", body: cur.join("\n\n") });
  return out;
}

const HEADING_WORDS: [RegExp, string][] = [
  [/^\s*chapter(?![A-Za-z])/i, "അധ്യായം"],
  [/^\s*part(?![A-Za-z])/i, "ഭാഗം"],
  [/^\s*poem(?![A-Za-z])/i, "കവിത"],
];
/** In convert mode "Chapter 1" becomes "അധ്യായം 1" (the word itself is English, not Manglish). */
function translateHeadingWord(title: string, mode: ImportMode): string {
  if (mode !== "convert") return title;
  for (const [re, ml] of HEADING_WORDS) if (re.test(title)) return title.replace(re, ml);
  return title;
}

/** Turn a plain-text document into ready-to-store sections. Pure: used by the importer and by tests. */
export function buildSections(raw: string, o: Pick<ImportOptions, "type" | "mode">): Piece[] {
  let text = cleanText(raw);
  if (o.type !== "poem") text = reflow(text);
  const pieces = splitSections(text, o.type);
  const conv = (s: string) => (o.mode === "convert" ? convertToMalayalam(s) : s);
  return pieces.map((p) => ({ title: conv(translateHeadingWord(p.title, o.mode)), body: conv(p.body) }));
}

// ---- PDF text (pdf.js, loaded only when a PDF is imported)

interface TextItem { str: string; transform: number[]; hasEOL?: boolean }

export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;

  const lines: { y: number; text: string }[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const items = (await page.getTextContent()).items as TextItem[];
    let cur: { y: number; text: string } | null = null;
    for (const it of items) {
      if (typeof it.str !== "string") continue;
      const y = it.transform[5];
      if (cur && Math.abs(cur.y - y) < 2) cur.text += it.str;
      else { if (cur) lines.push(cur); cur = { y, text: it.str }; }
      if (it.hasEOL && cur) { lines.push(cur); cur = null; }
    }
    if (cur) lines.push(cur);
    lines.push({ y: Number.NaN, text: "" }); // page break: neutral, does not force a paragraph break
  }
  if (!lines.some((l) => l.text.trim())) {
    throw new Error("We couldn't find any text in this PDF. It may be a scanned picture of pages.");
  }

  // paragraph breaks = unusually large vertical gap between consecutive lines
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const g = lines[i - 1].y - lines[i].y;
    if (g > 0) gaps.push(g);
  }
  gaps.sort((a, b) => a - b);
  const normal = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;

  let out = "";
  let prev: { y: number; text: string } | null = null;
  for (const l of lines) {
    if (!l.text.trim()) continue;
    if (prev) out += normal && !Number.isNaN(prev.y) && prev.y - l.y > normal * 1.5 ? "\n\n" : "\n";
    out += l.text.trim();
    prev = l;
  }
  return out;
}

export async function readDocument(file: File): Promise<string> {
  return /\.pdf$/i.test(file.name) || file.type === "application/pdf" ? extractPdfText(file) : file.text();
}

export const titleFromFile = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();

/** Reads a .txt / .md / .pdf and creates a NEW project from it (never overwrites). Returns its id. */
export async function importDocument(file: File, o: ImportOptions): Promise<string> {
  const raw = await readDocument(file);
  if (!raw.trim()) throw new Error("That file looks empty.");
  const pieces = buildSections(raw, o);
  const now = Date.now();
  const id = crypto.randomUUID();
  const unit = unitName(o.type);
  const rows: Section[] = pieces.map((p, i) => ({
    id: crypto.randomUUID(), novelId: id, title: p.title || `${unit} ${i + 1}`, order: i,
    content: p.body, wordCount: countWords(p.body), updatedAt: now,
  }));
  await db.transaction("rw", db.novels, db.sections, async () => {
    await db.novels.add({ id, name: o.title.trim() || "Untitled", category: o.category.trim() || "Other", type: o.type, createdAt: now, updatedAt: now });
    await db.sections.bulkAdd(rows);
  });
  return id;
}

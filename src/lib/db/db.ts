import Dexie, { type Table } from "dexie";
import { sceneBody, type Block, type CastEntry, type Character } from "../screenplay";

export type { Block, CastEntry, Character };

export type NovelType = "novel" | "screenplay" | "poem";

export interface Novel {
  id: string;
  name: string;
  category: string;
  type?: NovelType; // absent on older records = "novel"
  characters?: Character[]; // screenplay cast
  createdAt: number;
  updatedAt: number;
}
export interface LearnedWord {
  latin: string;
  ml: string;
  updatedAt: number;
}
export interface Section {
  id: string;
  novelId: string;
  title: string;
  order: number;
  content: string;
  wordCount: number;
  updatedAt: number;
  // screenplay scenes only
  setting?: string; // INT. / EXT. / INT./EXT.
  location?: string;
  time?: string; // DAY / NIGHT ...
  setup?: string; // scene setup / description
  cast?: CastEntry[]; // who is in the scene + what they look like / wear
  blocks?: Block[]; // ordered action and dialogue
}

class TWDB extends Dexie {
  novels!: Table<Novel, string>;
  sections!: Table<Section, string>;
  words!: Table<LearnedWord, string>;
  constructor() {
    super("typewriter");
    this.version(1).stores({
      novels: "id, name, category, updatedAt",
      sections: "id, novelId, [novelId+order], updatedAt",
    });
    this.version(2).stores({
      novels: "id, name, category, updatedAt",
      sections: "id, novelId, [novelId+order], updatedAt",
      words: "latin",
    });
  }
}
export const db = new TWDB();

export const SETTINGS = ["INT.", "EXT.", "INT./EXT."];
export const TIMES = ["DAY", "NIGHT", "MORNING", "EVENING", "DAWN", "DUSK", "CONTINUOUS"];

export const novelType = (n: { type?: NovelType }): NovelType => n.type ?? "novel";
export const unitName = (t: NovelType) => (t === "screenplay" ? "Scene" : t === "poem" ? "Poem" : "Chapter");
export const typeLabel = (t: NovelType) => (t === "screenplay" ? "Screenplay" : t === "poem" ? "Poetry" : "Novel");
export const NOVEL_TYPES: NovelType[] = ["novel", "poem", "screenplay"];
export const typeHint = (t: NovelType) =>
  t === "screenplay" ? "Scenes with places, times, action and dialogue" : t === "poem" ? "A collection of poems, with your line breaks kept" : "A story told in chapters";

/** Display label of a section: screenplay scenes are always numbered by position. */
export const sectionLabel = (t: NovelType, s: Section, index: number) =>
  t === "screenplay" ? `Scene ${index + 1}` : s.title;

/** "INT. LOCATION – DAY" */
export function sceneHeading(s: Pick<Section, "setting" | "location" | "time">): string {
  const where = [s.setting || "INT.", (s.location || "").trim()].filter(Boolean).join(" ");
  return s.time ? `${where} – ${s.time}` : where;
}

const uid = () => crypto.randomUUID();
export const countWords = (s: string) => {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
};

function newSection(novelId: string, type: NovelType, order: number, now: number): Section {
  return {
    id: uid(), novelId, title: `${unitName(type)} ${order + 1}`, order, content: "", wordCount: 0, updatedAt: now,
    ...(type === "screenplay" ? { setting: "INT.", location: "", time: "DAY" } : {}),
  };
}

export async function createNovel(name: string, category: string, type: NovelType = "novel"): Promise<string> {
  const now = Date.now();
  const id = uid();
  await db.transaction("rw", db.novels, db.sections, async () => {
    await db.novels.add({ id, name, category, type, createdAt: now, updatedAt: now });
    await db.sections.add(newSection(id, type, 0, now));
  });
  return id;
}

export async function updateNovel(id: string, patch: Partial<Pick<Novel, "name" | "category">>) {
  await db.novels.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteNovel(id: string) {
  await db.transaction("rw", db.novels, db.sections, async () => {
    await db.sections.where("novelId").equals(id).delete();
    await db.novels.delete(id);
  });
}

export function getNovelSections(novelId: string) {
  return db.sections.where("novelId").equals(novelId).sortBy("order");
}

export async function addSection(novelId: string): Promise<string> {
  const novel = await db.novels.get(novelId);
  const type = novel ? novelType(novel) : "novel";
  const list = await getNovelSections(novelId);
  const now = Date.now();
  const sec = newSection(novelId, type, list.length, now);
  await db.sections.add(sec);
  await db.novels.update(novelId, { updatedAt: now });
  return sec.id;
}

export async function renameSection(id: string, title: string) {
  await db.sections.update(id, { title, updatedAt: Date.now() });
}

export async function updateScene(id: string, patch: Partial<Pick<Section, "setting" | "location" | "time">>) {
  await db.sections.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteSection(novelId: string, id: string) {
  await db.transaction("rw", db.sections, db.novels, async () => {
    await db.sections.delete(id);
    const list = await getNovelSections(novelId);
    await db.sections.bulkPut(list.map((s, i) => ({ ...s, order: i })));
    await db.novels.update(novelId, { updatedAt: Date.now() });
  });
}

export async function moveSection(novelId: string, id: string, dir: -1 | 1) {
  const list = await getNovelSections(novelId);
  const i = list.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await db.sections.bulkPut(list.map((s, k) => ({ ...s, order: k })));
}

export async function saveContent(id: string, content: string) {
  const now = Date.now();
  const sec = await db.sections.get(id);
  if (!sec) return;
  await db.sections.update(id, { content, wordCount: countWords(content), updatedAt: now });
  await db.novels.update(sec.novelId, { updatedAt: now });
}

// ---- screenplay cast + structured scenes

export async function addCharacter(novelId: string, name: string): Promise<string> {
  const novel = await db.novels.get(novelId);
  const id = uid();
  await db.novels.update(novelId, { characters: [...(novel?.characters ?? []), { id, name }], updatedAt: Date.now() });
  return id;
}

export async function saveCharacters(novelId: string, characters: Character[]) {
  await db.novels.update(novelId, { characters, updatedAt: Date.now() });
}

/** Remove a character everywhere: from the cast list, from every scene's cast, and from dialogue speakers. */
export async function deleteCharacter(novelId: string, charId: string) {
  await db.transaction("rw", db.novels, db.sections, async () => {
    const novel = await db.novels.get(novelId);
    const characters = (novel?.characters ?? []).filter((c) => c.id !== charId);
    await db.novels.update(novelId, { characters, updatedAt: Date.now() });
    const secs = await getNovelSections(novelId);
    for (const s of secs) {
      if (!s.cast?.some((c) => c.id === charId) && !s.blocks?.some((b) => b.who === charId)) continue;
      const cast = (s.cast ?? []).filter((c) => c.id !== charId);
      const blocks = (s.blocks ?? []).map((b) => (b.who === charId ? { ...b, who: undefined } : b));
      const content = sceneBody({ setup: s.setup, cast, blocks }, characters);
      await db.sections.update(s.id, { cast, blocks, content, wordCount: countWords(content) });
    }
  });
}

/** Save a structured scene; the flat text (Section.content) and word count are derived from it. */
export async function saveScene(id: string, patch: { setup?: string; cast?: CastEntry[]; blocks?: Block[] }) {
  const sec = await db.sections.get(id);
  if (!sec) return;
  const novel = await db.novels.get(sec.novelId);
  const merged = { ...sec, ...patch };
  const content = sceneBody(merged, novel?.characters ?? []);
  const now = Date.now();
  await db.sections.update(id, { ...patch, content, wordCount: countWords(content), updatedAt: now });
  await db.novels.update(sec.novelId, { updatedAt: now });
}

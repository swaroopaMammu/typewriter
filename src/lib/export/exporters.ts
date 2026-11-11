import {
  db, getNovelSections, novelType, sceneHeading, sectionLabel, type Novel, type NovelType, type Section,
} from "../db/db";
import { IS_NATIVE } from "../../env";
import { hasStructure, sceneExportBody, type Block, type CastEntry, type Character } from "../screenplay";

export const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "").trim().slice(0, 80) || "novel";
export const stamp = () => new Date().toISOString().slice(0, 10);

type HostDownloads = { save: (r: { filename: string; data: string }) => Promise<unknown> };

async function nativeSave(filename: string, text: string) {
  const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");
  const r = await Filesystem.writeFile({ path: filename, data: "﻿" + text, directory: Directory.Cache, encoding: Encoding.UTF8 });
  await Share.share({ title: filename, url: r.uri, dialogTitle: "Save or share" });
}

export function download(filename: string, text: string, mime = "text/plain;charset=utf-8") {
  if (IS_NATIVE) {
    // Android WebView can't download blobs: write a file and open the share sheet (Save to Files / Drive / WhatsApp...)
    nativeSave(filename, text).catch(() => undefined);
    return;
  }
  const host = (window as unknown as { claude?: { use: (n: string) => Promise<HostDownloads | null> } }).claude;
  if (host?.use) {
    // hosted build: the frame can't download directly, so ask the host to save
    host.use("downloads").then((d) => {
      if (d) return d.save({ filename, data: "﻿" + text }).catch(() => undefined);
      return undefined;
    });
    return;
  }
  const blob = new Blob(["﻿" + text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sectionText(type: NovelType, s: Section, i: number, chars: Character[] = []): string {
  if (type === "screenplay") {
    const body = hasStructure(s) ? sceneExportBody(s, chars) : s.content.trim();
    return `${sectionLabel(type, s, i)}\n${sceneHeading(s)}\n\n${body}`;
  }
  return `${s.title}\n\n${s.content.trim()}`;
}

export function novelToText(novel: Novel, sections: Section[]): string {
  const type = novelType(novel);
  const parts = [novel.name, `${type === "screenplay" ? "Screenplay" : "Novel"} · ${novel.category}`, "", ""];
  sections.forEach((s, i) => parts.push(sectionText(type, s, i, novel.characters ?? []), "", ""));
  return parts.join("\n");
}

export async function downloadNovelText(novelId: string) {
  const novel = await db.novels.get(novelId);
  if (!novel) return;
  const sections = await getNovelSections(novelId);
  download(`${safeName(novel.name)}_${stamp()}.txt`, novelToText(novel, sections));
}

export async function downloadSectionText(novelId: string, sectionId: string) {
  const novel = await db.novels.get(novelId);
  if (!novel) return;
  const sections = await getNovelSections(novelId);
  const i = sections.findIndex((s) => s.id === sectionId);
  if (i < 0) return;
  const type = novelType(novel);
  download(
    `${safeName(novel.name)}_${safeName(sectionLabel(type, sections[i], i))}_${stamp()}.txt`,
    sectionText(type, sections[i], i, novel.characters ?? []) + "\n",
  );
}

interface BackupSection {
  title: string; order: number; content: string; setting?: string; location?: string; time?: string;
  setup?: string; cast?: CastEntry[]; blocks?: Block[];
}
interface BackupNovel {
  name: string; category: string; type?: NovelType; characters?: Character[]; createdAt: number; sections: BackupSection[];
}
interface Backup {
  app: "typewriter"; version: 1; exportedAt: string; novels: BackupNovel[];
}

async function toBackupNovel(n: Novel): Promise<BackupNovel> {
  const secs = await getNovelSections(n.id);
  return {
    name: n.name, category: n.category, type: novelType(n), characters: n.characters, createdAt: n.createdAt,
    sections: secs.map((s) => ({
      title: s.title, order: s.order, content: s.content, setting: s.setting, location: s.location, time: s.time,
      setup: s.setup, cast: s.cast, blocks: s.blocks,
    })),
  };
}

export async function downloadNovelBackup(novelId: string) {
  const n = await db.novels.get(novelId);
  if (!n) return;
  const b: Backup = { app: "typewriter", version: 1, exportedAt: new Date().toISOString(), novels: [await toBackupNovel(n)] };
  download(`${safeName(n.name)}_${stamp()}.typewriter.json`, JSON.stringify(b, null, 2), "application/json");
}

export async function downloadAllBackup() {
  const all = await db.novels.toArray();
  const b: Backup = {
    app: "typewriter", version: 1, exportedAt: new Date().toISOString(),
    novels: await Promise.all(all.map(toBackupNovel)),
  };
  download(`typewriter-all_${stamp()}.typewriter.json`, JSON.stringify(b, null, 2), "application/json");
}

/** Imports as NEW novels; never overwrites. Returns the number imported. */
export async function importBackup(file: File): Promise<number> {
  let data: Backup;
  try {
    data = JSON.parse((await file.text()).replace(/^﻿/, ""));
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  if (data?.app !== "typewriter" || !Array.isArray(data.novels)) {
    throw new Error("That is not a TypeWriter backup file.");
  }
  const existing = new Set((await db.novels.toArray()).map((n) => n.name));
  let count = 0;
  for (const bn of data.novels) {
    let name = String(bn.name || "Untitled");
    let k = 2;
    const base = name;
    while (existing.has(name)) name = `${base} (${k++})`;
    existing.add(name);
    const type: NovelType = bn.type === "screenplay" ? "screenplay" : "novel";
    const now = Date.now();
    const id = crypto.randomUUID();
    const secs = Array.isArray(bn.sections) ? [...bn.sections].sort((a, b) => a.order - b.order) : [];
    await db.transaction("rw", db.novels, db.sections, async () => {
      await db.novels.add({
        id, name, category: String(bn.category || "Other"), type, createdAt: bn.createdAt || now, updatedAt: now,
        ...(type === "screenplay" && Array.isArray(bn.characters) ? { characters: bn.characters } : {}),
      });
      const rows: Section[] = (secs.length ? secs : [{ title: "", order: 0, content: "" }]).map((s, i) => {
        const content = String(s.content ?? "");
        const t = content.trim();
        const unit = type === "screenplay" ? "Scene" : "Chapter";
        return {
          id: crypto.randomUUID(), novelId: id, title: String(s.title || `${unit} ${i + 1}`), order: i,
          content, wordCount: t ? t.split(/\s+/).length : 0, updatedAt: now,
          ...(type === "screenplay"
            ? {
                setting: s.setting || "INT.", location: s.location || "", time: s.time || "DAY",
                ...(s.setup !== undefined ? { setup: s.setup } : {}),
                ...(Array.isArray(s.cast) ? { cast: s.cast } : {}),
                ...(Array.isArray(s.blocks) ? { blocks: s.blocks } : {}),
              }
            : {}),
        };
      });
      await db.sections.bulkAdd(rows);
    });
    count++;
  }
  return count;
}

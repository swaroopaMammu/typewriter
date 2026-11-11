/** Screenplay structure shared by the editor, reader and exports. Pure: no DB access. */

export interface Character {
  id: string;
  name: string;
  about?: string; // age, appearance... applies to the whole screenplay
}
/** A character present in one scene, with what they wear / look like in that scene. */
export interface CastEntry {
  id: string; // Character.id
  look?: string;
}
export interface Block {
  id: string;
  kind: "action" | "dialogue";
  who?: string; // Character.id, dialogue only
  paren?: string; // "(angrily)", dialogue only
  text: string;
}
export interface SceneData {
  setup?: string;
  cast?: CastEntry[];
  blocks?: Block[];
}

export const charName = (chars: Character[], id?: string) => chars.find((c) => c.id === id)?.name ?? "";

/** True when a scene uses the structured fields (otherwise it is a legacy plain-text scene). */
export const hasStructure = (s: SceneData) => !!(s.setup?.trim() || s.cast?.length || s.blocks?.length);

const indent = (t: string) => t.split("\n").map((l) => "    " + l).join("\n");

/** Flat text of a scene. Stored as Section.content so word counts and legacy readers keep working. */
export function sceneBody(s: SceneData, chars: Character[]): string {
  const parts: string[] = [];
  if (s.setup?.trim()) parts.push(s.setup.trim());
  if (s.cast?.length) {
    parts.push(
      s.cast
        .map((c) => `${charName(chars, c.id)}${c.look?.trim() ? " — " + c.look.trim() : ""}`)
        .join("\n"),
    );
  }
  for (const b of s.blocks ?? []) {
    const text = b.text.trim();
    if (!text) continue;
    if (b.kind === "dialogue") {
      const who = charName(chars, b.who);
      parts.push(`${who}${b.paren?.trim() ? ` (${b.paren.trim()})` : ""}: ${text}`);
    } else parts.push(text);
  }
  return parts.join("\n\n");
}

/** Screenplay-style text for the .txt export. */
export function sceneExportBody(s: SceneData, chars: Character[]): string {
  const out: string[] = [];
  if (s.setup?.trim()) out.push("SETUP", s.setup.trim(), "");
  if (s.cast?.length) {
    out.push("CHARACTERS");
    for (const c of s.cast) out.push(`  ${charName(chars, c.id).toUpperCase()}${c.look?.trim() ? " — " + c.look.trim() : ""}`);
    out.push("");
  }
  for (const b of s.blocks ?? []) {
    const text = b.text.trim();
    if (!text) continue;
    if (b.kind === "dialogue") {
      out.push(`${charName(chars, b.who).toUpperCase()}${b.paren?.trim() ? ` (${b.paren.trim()})` : ""}`, indent(text), "");
    } else out.push(text, "");
  }
  return out.join("\n").trim();
}

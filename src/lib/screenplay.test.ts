import { describe, expect, it } from "vitest";
import { hasStructure, sceneBody, sceneExportBody, type Character, type SceneData } from "./screenplay";

const chars: Character[] = [
  { id: "r", name: "രവി" },
  { id: "a", name: "അമ്മ" },
];
const scene: SceneData = {
  setup: "പഴയ വീടിന്റെ ഉമ്മറം.",
  cast: [{ id: "r", look: "വെള്ള ഷർട്ട്" }, { id: "a" }],
  blocks: [
    { id: "1", kind: "action", text: "രവി വരുന്നു." },
    { id: "2", kind: "dialogue", who: "a", text: "നീ എവിടെ ആയിരുന്നു?" },
    { id: "3", kind: "dialogue", who: "r", paren: "പതുക്കെ", text: "ഇവിടെ തന്നെ." },
    { id: "4", kind: "dialogue", who: "a", text: "   " },
  ],
};

describe("screenplay text", () => {
  it("detects structure", () => {
    expect(hasStructure({})).toBe(false);
    expect(hasStructure({ blocks: [] })).toBe(false);
    expect(hasStructure(scene)).toBe(true);
  });
  it("flattens a scene, skipping empty blocks", () => {
    const t = sceneBody(scene, chars);
    expect(t).toContain("രവി — വെള്ള ഷർട്ട്");
    expect(t).toContain("അമ്മ: നീ എവിടെ ആയിരുന്നു?");
    expect(t).toContain("രവി (പതുക്കെ): ഇവിടെ തന്നെ.");
    expect(t.endsWith("ഇവിടെ തന്നെ.")).toBe(true);
  });
  it("formats export text with sections and indented dialogue", () => {
    const t = sceneExportBody(scene, chars);
    expect(t.split("\n")[0]).toBe("SETUP");
    expect(t).toContain("CHARACTERS\n  രവി — വെള്ള ഷർട്ട്\n  അമ്മ");
    expect(t).toContain("അമ്മ\n    നീ എവിടെ ആയിരുന്നു?");
    expect(t).toContain("രവി (പതുക്കെ)\n    ഇവിടെ തന്നെ.");
  });
});

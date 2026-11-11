import { describe, expect, it } from "vitest";
import { localCandidates } from "./suggest";

describe("localCandidates", () => {
  it("starts with the plain rule output and offers ambiguity edits", () => {
    const c = localCandidates("kali");
    expect(c[0]).toBe("കലി");
    expect(c).toContain("കളി"); // l -> L
    expect(new Set(c).size).toBe(c.length);
  });
  it("reaches malayalam from loose typing via a two-edit candidate", () => {
    expect(localCandidates("malayalam")).toContain("മലയാളം");
  });
});

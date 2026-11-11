import { describe, expect, it } from "vitest";
import { spliceDictation } from "./insert";

describe("spliceDictation", () => {
  it("adds a trailing space and no leading space at the start", () => {
    expect(spliceDictation("", 0, 0, "നമസ്കാരം")).toMatchObject({ insert: "നമസ്കാരം ", value: "നമസ്കാരം ", caret: 9 });
  });
  it("adds a leading space after a word", () => {
    expect(spliceDictation("hello", 5, 5, " world ")?.value).toBe("hello world ");
  });
  it("does not double spaces", () => {
    expect(spliceDictation("hello ", 6, 6, "world")?.value).toBe("hello world ");
  });
  it("inserts in the middle without gluing words", () => {
    expect(spliceDictation("ab cd", 3, 3, "x")?.value).toBe("ab x cd");
  });
  it("replaces a selection", () => {
    expect(spliceDictation("one two three", 4, 7, "2")?.value).toBe("one 2 three");
  });
  it("ignores empty speech", () => {
    expect(spliceDictation("a", 1, 1, "   ")).toBeNull();
  });
});

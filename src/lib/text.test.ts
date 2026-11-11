import { describe, expect, it } from "vitest";
import { wordsLabel } from "./text";

describe("wordsLabel", () => {
  it("uses the singular for exactly one", () => {
    expect(wordsLabel(1)).toBe("1 word");
  });
  it("uses the plural otherwise", () => {
    expect(wordsLabel(0)).toBe("0 words");
    expect(wordsLabel(2)).toBe("2 words");
  });
});

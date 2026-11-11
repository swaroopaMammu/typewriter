import { describe, expect, it } from "vitest";
import { nextIndex } from "./nav";

describe("nextIndex", () => {
  it("steps forward and back, wrapping around", () => {
    expect(nextIndex(3, 0, 1)).toBe(1);
    expect(nextIndex(3, 2, 1)).toBe(0);
    expect(nextIndex(3, 0, -1)).toBe(2);
  });
  it("starts at the first / last item when nothing is focused", () => {
    expect(nextIndex(4, -1, 1)).toBe(0);
    expect(nextIndex(4, -1, -1)).toBe(3);
  });
  it("returns -1 when there is nothing to step through", () => {
    expect(nextIndex(0, -1, 1)).toBe(-1);
  });
});

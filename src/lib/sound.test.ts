import { afterEach, describe, expect, it } from "vitest";
import { MIN_GAP_MS, setSoundOn, soundOn, throttled } from "./sound";

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
} as Storage;

afterEach(() => store.clear());

describe("typing sound setting", () => {
  it("is on by default", () => {
    expect(soundOn()).toBe(true);
  });
  it("remembers being turned off, and on again", () => {
    setSoundOn(false);
    expect(soundOn()).toBe(false);
    setSoundOn(true);
    expect(soundOn()).toBe(true);
  });
});

describe("throttled", () => {
  it("blocks clicks that are too close together", () => {
    expect(throttled(100, 100 - (MIN_GAP_MS - 1))).toBe(true);
  });
  it("allows clicks that are far enough apart", () => {
    expect(throttled(100, 100 - MIN_GAP_MS)).toBe(false);
    expect(throttled(100, -Infinity)).toBe(false);
  });
});

// Typing sound: a manual typewriter, synthesised in public/typewriter-sound.js (shared with the splash screen).
const KEY = "tw-sound";

/** Typing sound is on unless the writer turned it off (remembered on this device). */
export function soundOn(): boolean {
  try { return localStorage.getItem(KEY) !== "0"; } catch { return true; }
}
export const SOUND_EVENT = "tw-sound-change";
export function setSoundOn(on: boolean): void {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* ignore */ }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SOUND_EVENT)); // lets every on/off switch update
}

/** Minimum gap between two sounds, so a key + its input event, or a held key, never stack up. */
export const MIN_GAP_MS = 15;
export const throttled = (now: number, last: number) => now - last < MIN_GAP_MS;

export type KeyKind = "key" | "space" | "enter" | "back";

interface TwSound { audio(): AudioContext | null; play(kind: KeyKind | "bell"): boolean }
const synth = () => (typeof window !== "undefined" ? (window as unknown as { twSound?: TwSound }).twSound : undefined);

let last = -Infinity;

/** One key sound. Call straight from a key event (that is also what lets the browser start the audio). */
export function keyClick(kind: KeyKind = "key"): void {
  if (!soundOn()) return;
  const now = performance.now();
  if (throttled(now, last)) return;
  last = now;
  synth()?.play(kind);
}

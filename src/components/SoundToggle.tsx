import { useSyncExternalStore } from "react";
import { keyClick, setSoundOn, soundOn, SOUND_EVENT } from "../lib/sound";
import Tipped from "./Tip";

/** The typing-sound setting as React state: every switch on the page stays in step with it. */
export function useSoundOn(): boolean {
  return useSyncExternalStore(
    (cb) => { window.addEventListener(SOUND_EVENT, cb); return () => window.removeEventListener(SOUND_EVENT, cb); },
    soundOn,
    () => true,
  );
}

export function toggleSound(on: boolean) {
  setSoundOn(on);
  if (on) keyClick("key"); // a sample click so you can hear what you just turned on
}

/** Speaker button with a label: turns the soft typing click on or off (remembered on this device). */
export default function SoundToggle() {
  const on = useSoundOn();
  return (
    <Tipped id="sound" order={1.5} text="Hear a soft typewriter click as you type. Click here to turn the sound off or on">
      <button className="btn sound-btn" onClick={() => toggleSound(!on)} aria-pressed={on}
        title={on ? "Typing sound is on. Click to turn it off" : "Typing sound is off. Click to turn it on"}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" fill="currentColor" stroke="none" />
          {on ? (
            <>
              <path d="M15.5 9a4 4 0 0 1 0 6" />
              <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
            </>
          ) : (
            <path d="M16 9.5l5 5M21 9.5l-5 5" />
          )}
        </svg>
        <span className="hide-sm">Sound: {on ? "On" : "Off"}</span>
      </button>
    </Tipped>
  );
}

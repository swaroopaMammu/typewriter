import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { startDictation, speechSupported, VOICE_LANG } from "../lib/voice/dictation";
import { insertDictation, trackFields } from "../lib/voice/insert";
import { Confirm } from "./ui";
import Tipped from "./Tip";

const OK_KEY = "tw-voice-ok";
const consented = () => { try { return localStorage.getItem(OK_KEY) === "1"; } catch { return false; } };

/** The "voice" icon: sound-wave bars (they move while listening). */
function VoiceIcon({ active }: { active: boolean }) {
  return (
    <svg className={active ? "voice-icon on" : "voice-icon"} width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      {[3, 7.5, 12, 16.5, 21].map((x, i) => {
        const h = [6, 12, 18, 12, 6][i];
        return <rect key={x} x={x - 1.4} y={12 - h / 2} width="2.8" height={h} rx="1.4" fill="currentColor" />;
      })}
    </svg>
  );
}

/** Speak → text. Types the recognised words at the caret of the field you were last writing in. */
export default function VoiceButton({ mode }: { mode: "ml" | "en" }) {
  const [on, setOn] = useState(false);
  const [interim, setInterim] = useState("");
  const [msg, setMsg] = useState("");
  const [ask, setAsk] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const supported = speechSupported();

  useEffect(() => { trackFields(); }, []);

  function start() {
    setMsg("");
    stopRef.current = startDictation(VOICE_LANG[mode], {
      onInterim: setInterim,
      onFinal: (t) => { if (!insertDictation(t)) setMsg("Click where you want to write, then start speaking."); },
      onStop: (m) => { stopRef.current = null; setOn(false); setInterim(""); if (m) setMsg(m); },
    });
    setOn(true);
  }
  function stop() { stopRef.current?.(); }
  function toggle() {
    if (on) return stop();
    if (!consented()) return setAsk(true);
    start();
  }

  // switching Malayalam <-> English while listening: restart in the new language
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (stopRef.current) { stopRef.current(); setTimeout(start, 250); }
    // eslint-disable-next-line
  }, [mode]);
  useEffect(() => () => { stopRef.current?.(); }, []);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(""), 6000); return () => clearTimeout(t); }, [msg]);

  if (!supported) return null;

  return (
    <>
      <Tipped id="voice" order={2} text="Tap Voice and speak. Your words are typed where your cursor is">
        <button className={on ? "btn mic on" : "btn mic"} onClick={toggle} aria-pressed={on}
          title={on ? "Stop voice typing" : `Type with your voice (${mode === "ml" ? "Malayalam" : "English"})`}>
          <VoiceIcon active={on} />
          <span>{on ? "Stop" : "Voice"}</span>
        </button>
      </Tipped>
      {(on || msg) && createPortal(
        <div className="voice-cap glass" role="status" aria-live="polite">
          {on ? (
            <>
              <span className="rec-dot" />
              <span className="ml">{interim || `Listening… speak in ${mode === "ml" ? "Malayalam" : "English"}`}</span>
              <button className="btn small-btn" onClick={stop}>Stop</button>
            </>
          ) : <span>{msg}</span>}
        </div>, document.body)}
      {ask && createPortal(
        <Confirm title="Type with your voice?" confirmLabel="Yes, start listening"
          message="Your browser turns your speech into text using its own speech service. Chrome and Edge send your voice to Google or Microsoft to do this. TypeWriter never saves the audio, and the text you write stays on this device. You can stop any time."
          onConfirm={() => { try { localStorage.setItem(OK_KEY, "1"); } catch { /* ignore */ } start(); }}
          onClose={() => setAsk(false)} />, document.body)}
    </>
  );
}

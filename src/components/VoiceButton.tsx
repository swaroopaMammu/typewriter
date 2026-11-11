import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { startDictation, speechSupported, VOICE_LANG } from "../lib/voice/dictation";
import { insertDictation, trackFields } from "../lib/voice/insert";
import { Confirm } from "./ui";

const OK_KEY = "tw-voice-ok";
const consented = () => { try { return localStorage.getItem(OK_KEY) === "1"; } catch { return false; } };

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
      onFinal: (t) => { if (!insertDictation(t)) setMsg("Click in the text first, then speak."); },
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
      <button className={on ? "btn mic on" : "btn mic"} onClick={toggle} aria-pressed={on}
        title={on ? "Stop voice typing" : `Voice typing (${mode === "ml" ? "Malayalam" : "English"})`}>
        {on ? "● Stop" : "🎤 Voice"}
      </button>
      {(on || msg) && createPortal(
        <div className="voice-cap glass" role="status" aria-live="polite">
          {on ? (
            <>
              <span className="rec-dot" />
              <span className="ml">{interim || `Listening in ${mode === "ml" ? "മലയാളം" : "English"}… speak now`}</span>
              <button className="btn small-btn" onClick={stop}>Stop</button>
            </>
          ) : <span>{msg}</span>}
        </div>, document.body)}
      {ask && createPortal(
        <Confirm title="Use voice typing?" confirmLabel="Allow & start"
          message="Your browser turns speech into text using its own speech service. In Chrome and Edge your voice is sent to Google or Microsoft for that, and TypeWriter does not store the audio. The text itself stays on this device. You can stop any time."
          onConfirm={() => { try { localStorage.setItem(OK_KEY, "1"); } catch { /* ignore */ } start(); }}
          onClose={() => setAsk(false)} />, document.body)}
    </>
  );
}

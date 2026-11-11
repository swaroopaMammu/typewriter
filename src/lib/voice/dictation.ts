// Minimal typing for the (still prefixed) Web Speech API.
interface SRAlt { transcript: string }
interface SRResult { isFinal: boolean; 0: SRAlt; length: number }
interface SREvent { resultIndex: number; results: { length: number; [i: number]: SRResult } }
interface SRErrorEvent { error: string }
export interface Recognizer {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type Ctor = new () => Recognizer;

const ctor = (): Ctor | undefined => {
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

/** True when this browser can do speech-to-text (Chrome, Edge, Safari; not Firefox or the Android app WebView). */
export const speechSupported = () => typeof window !== "undefined" && !!ctor();

export const VOICE_LANG = { ml: "ml-IN", en: "en-IN" } as const;

export interface DictationHandlers {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  /** recognition ended for good (stopped, or a permanent error); `message` says why when it was an error */
  onStop: (message?: string) => void;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone permission was denied. Allow it in the browser's address bar and try again.",
  "service-not-allowed": "Speech recognition is blocked in this browser.",
  "audio-capture": "No microphone was found.",
  network: "Voice typing needs an internet connection.",
  "language-not-supported": "This browser can't recognise that language.",
};

/** Start listening; returns a function that stops it. Restarts by itself when the browser ends a session on silence. */
export function startDictation(lang: string, h: DictationHandlers): () => void {
  const SR = ctor();
  if (!SR) { h.onStop("Voice typing isn't supported in this browser."); return () => {}; }
  let wanted = true;
  let rec: Recognizer | null = null;
  let restarts = 0;
  let lastStart = 0;

  const begin = () => {
    rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) h.onFinal(r[0].transcript); else interim += r[0].transcript;
      }
      h.onInterim(interim);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return; // normal; onend will restart
      wanted = false;
      h.onStop(ERRORS[e.error] ?? `Voice typing stopped (${e.error}).`);
    };
    rec.onend = () => {
      h.onInterim("");
      if (!wanted) return;
      // browsers end a session after a pause; keep going, but give up if it keeps dying instantly
      restarts = Date.now() - lastStart > 3000 ? 0 : restarts + 1;
      if (restarts > 4) { wanted = false; h.onStop("Voice typing keeps stopping. Please try again."); return; }
      setTimeout(() => { if (wanted) { try { begin(); } catch { wanted = false; h.onStop(); } } }, 150);
    };
    lastStart = Date.now();
    rec.start();
  };

  try { begin(); } catch { wanted = false; h.onStop("Could not start the microphone."); }
  return () => {
    if (!wanted && !rec) return;
    const was = wanted;
    wanted = false;
    try { rec?.stop(); } catch { /* ignore */ }
    if (was) h.onStop();
  };
}

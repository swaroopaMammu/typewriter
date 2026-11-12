/*
 * A manual portable typewriter, synthesised with the Web Audio API (no audio files), kept mild.
 * Shared by the splash screen (index.html) and the editor (src/lib/sound.ts) as `window.twSound`.
 *
 * A real machine is rough and mechanical, not tonal, so almost everything here is shaped NOISE, not pure tones:
 *   - the key bottoms out ............ a soft low "tock"
 *   - the typebar swings up .......... a faint "tf" of air and metal
 *   - the typebar hits the rubber platen: a sharp "tack" plus a dull thud, and the bar, frame and platen ring a
 *                                       little (narrow resonances that die away quickly, like struck metal)
 *   - the carriage escapement ........ two tiny ticks (dog, then rack)
 *   - the typebar settles back ....... a last small tick, a moment later
 *   - space bar ...................... no typebar: a broad, duller thump
 *   - backspace ...................... the carriage steps back; nothing strikes the paper
 *   - return ......................... the carriage rattles along, thumps against its stop, then the bell dings
 * Every sound varies a little each time (pitch, level, timing) so a run of keys sounds played by hand.
 */
(function () {
  "use strict";
  var ctx = null;

  /** The shared AudioContext (created on first use; browsers resume it after a tap or key press). */
  function audio() {
    if (!ctx) {
      try { var C = window.AudioContext || window.webkitAudioContext; if (C) ctx = new C(); } catch (e) { /* no audio */ }
    }
    if (ctx && ctx.state === "suspended") { try { ctx.resume(); } catch (e) { /* ignore */ } }
    return ctx;
  }

  /** One output per context: gentle compressor -> soft top-end roll-off -> a low overall level. */
  function master(c) {
    if (!c._tw) {
      var comp = c.createDynamicsCompressor();
      comp.threshold.value = -24; comp.knee.value = 24; comp.ratio.value = 4; comp.attack.value = 0.002; comp.release.value = 0.12;
      var lp = c.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 7000; lp.Q.value = 0.5; // takes the hiss off the top
      var g = c.createGain();
      g.gain.value = 0.4;
      comp.connect(lp); lp.connect(g); g.connect(c.destination);
      c._tw = comp;
    }
    return c._tw;
  }

  function noiseOf(c) { // one second of white noise per context, reused by every sound
    if (!c._twn) {
      var b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      c._twn = b;
    }
    return c._twn;
  }

  /** A short burst of filtered noise. o: type, f (Hz), q, g (peak level), a (attack s), d (decay s). */
  function hit(c, dest, t, o) {
    var a = o.a || 0.001;
    var n = c.createBufferSource();
    n.buffer = noiseOf(c);
    var f = c.createBiquadFilter();
    f.type = o.type || "bandpass"; f.frequency.value = o.f; f.Q.value = o.q || 1;
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.g, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + o.d);
    n.connect(f); f.connect(g); g.connect(dest);
    n.start(t, Math.random() * 0.5, a + o.d + 0.03);
  }

  /** A resonance: noise through a very narrow filter, so it "rings" at f and fades, like struck metal (not a pure beep). */
  function ring(c, dest, t, o) {
    var n = c.createBufferSource();
    n.buffer = noiseOf(c);
    var f = c.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = o.f; f.Q.value = o.q || 30;
    var g = c.createGain();
    g.gain.setValueAtTime(o.g, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
    n.connect(f); f.connect(g); g.connect(dest);
    n.start(t, Math.random() * 0.5, o.d + 0.03);
  }

  /** A decaying pure tone: used only for the bell, which really is tonal. */
  function tone(c, dest, t, o) {
    var os = c.createOscillator();
    os.type = "sine";
    os.frequency.setValueAtTime(o.f0, t);
    var g = c.createGain();
    g.gain.setValueAtTime(o.g, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
    os.connect(g); g.connect(dest);
    os.start(t); os.stop(t + o.d + 0.02);
  }

  var voices = {
    /** A letter: tock, typebar swing, tack + thud + ring, escapement ticks, typebar settling back. */
    key: function (c, d, t, v, a) {
      var s = t + 0.012;                                                              // the strike lands just after the swing starts
      hit(c, d, t, { type: "lowpass", f: 520, g: 0.12 * a, a: 0.002, d: 0.05 });        // key bottoming out: soft tock
      hit(c, d, t, { f: 1900 * v, q: 0.7, g: 0.05 * a, a: 0.010, d: 0.004 });          // typebar swinging up
      hit(c, d, s, { f: 2600 * v, q: 0.9, g: 0.30 * a, a: 0.0006, d: 0.014 });         // typebar hits the platen: "tack"
      hit(c, d, s, { type: "lowpass", f: 900, g: 0.22 * a, a: 0.0008, d: 0.028 });      // the rubber platen's dull thud
      ring(c, d, s, { f: 1250 * v, q: 30, g: 0.30 * a, d: 0.07 });                     // bar / frame / platen ring
      ring(c, d, s, { f: 2280 * v, q: 30, g: 0.24 * a, d: 0.055 });
      ring(c, d, s, { f: 3720 * v, q: 30, g: 0.18 * a, d: 0.04 });
      hit(c, d, s + 0.016, { type: "highpass", f: 4500, g: 0.05 * a, d: 0.005 });       // escapement: dog...
      hit(c, d, s + 0.034, { type: "highpass", f: 4000, g: 0.035 * a, d: 0.005 });      // ...then rack
      hit(c, d, s + 0.07 + Math.random() * 0.012, { f: 2200, q: 1.2, g: 0.07 * a, d: 0.012 }); // typebar settles back
    },
    /** Space bar: no typebar, so a broader, duller thump. */
    space: function (c, d, t, v, a) {
      hit(c, d, t, { type: "lowpass", f: 700 * v, g: 0.55 * a, a: 0.002, d: 0.06 });
      hit(c, d, t, { f: 1100 * v, q: 0.7, g: 0.38 * a, a: 0.001, d: 0.04 });
      ring(c, d, t, { f: 700 * v, q: 25, g: 0.34 * a, d: 0.05 });
      hit(c, d, t + 0.016, { type: "highpass", f: 4500, g: 0.07 * a, d: 0.005 });
      hit(c, d, t + 0.06, { f: 1500, q: 1, g: 0.08 * a, d: 0.016 });
    },
    /** Backspace: the carriage steps back; nothing strikes the paper. */
    back: function (c, d, t, v, a) {
      hit(c, d, t, { type: "lowpass", f: 600, g: 0.22 * a, a: 0.002, d: 0.04 });
      hit(c, d, t, { f: 2200 * v, q: 1.2, g: 0.2 * a, a: 0.001, d: 0.01 });
      hit(c, d, t + 0.02, { type: "highpass", f: 4800, g: 0.07 * a, d: 0.006 });
    },
    /** The bell: a bright, short "ding" with a faint upper partial. */
    bell: function (c, d, t) {
      hit(c, d, t, { f: 4200, q: 2, g: 0.04, d: 0.01 });
      tone(c, d, t, { f0: 2637, g: 0.07, d: 0.9 });
      tone(c, d, t, { f0: 5538, g: 0.02, d: 0.5 });
    },
    /** Return: the key, the carriage rattling along, the thump at its stop, then the bell. */
    enter: function (c, d, t, v, a) {
      hit(c, d, t, { type: "lowpass", f: 500, g: 0.20 * a, a: 0.002, d: 0.07 });
      var at = t + 0.03;
      for (var i = 0; i < 14; i++) {                                                  // carriage ratchet, speeding up slightly
        hit(c, d, at, { f: 2400, q: 2, g: 0.06 + Math.random() * 0.025, d: 0.006 });
        at += 0.024 - i * 0.0006;
      }
      hit(c, d, at, { type: "lowpass", f: 400, g: 0.25, a: 0.002, d: 0.1 });          // carriage hits its stop
      hit(c, d, at, { f: 1000, q: 0.8, g: 0.20, a: 0.001, d: 0.05 });
      ring(c, d, at, { f: 900, q: 25, g: 0.18, d: 0.09 });
      voices.bell(c, d, at + 0.02);
    },
  };

  window.twSound = {
    audio: audio,
    /** Play a sound now: "key" | "space" | "back" | "enter" | "bell". Needs a running context (after a tap or key press). */
    play: function (kind) {
      var c = audio();
      if (!c || c.state !== "running") return false;
      var fn = voices[kind] || voices.key;
      // a different pitch and level every time, so a run of keys sounds like hands, not a sample
      fn(c, master(c), c.currentTime, 0.9 + Math.random() * 0.2, 0.8 + Math.random() * 0.35);
      return true;
    },
    /** Draw a sound into any (e.g. offline) context at time t. Used for measuring and testing. */
    render: function (c, kind, t) {
      (voices[kind] || voices.key)(c, master(c), t || 0, 1, 1);
    },
  };
})();

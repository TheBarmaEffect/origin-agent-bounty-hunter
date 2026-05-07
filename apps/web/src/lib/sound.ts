/**
 * Lightweight Web Audio cues. No external files — synthesized on the fly.
 * Volume kept low (~20%) per spec. Auto-skips if AudioContext is unavailable
 * (SSR or muted-tab autoplay block) — never blocks the UX.
 */
let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (muted) return null;
  if (ctx) return ctx;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctor = (window.AudioContext || (window as any).webkitAudioContext);
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

export function setMuted(m: boolean) { muted = m; }
export function isMuted() { return muted; }

function tone(freq: number, durMs: number, type: OscillatorType = 'sine', gain = 0.06) {
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === 'suspended') c.resume();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = 0;
    osc.connect(g); g.connect(c.destination);
    const t0 = c.currentTime;
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
    osc.start(t0);
    osc.stop(t0 + durMs / 1000 + 0.05);
  } catch { /* ignore audio errors */ }
}

/** Soft tick — for trace events. */
export function tick() { tone(820, 60, 'square', 0.025); }

/** Whoosh-ish — for rank changes. Two quick descending tones. */
export function whoosh() {
  tone(700, 90, 'sine', 0.05);
  setTimeout(() => tone(440, 120, 'sine', 0.04), 70);
}

/** Chime — for VERIFIED payments. Two ascending tones. */
export function chime() {
  tone(880, 110, 'sine', 0.05);
  setTimeout(() => tone(1318, 160, 'sine', 0.05), 80);
}

/** Alarm — short red blip for constraint violation. */
export function alarm() {
  tone(220, 110, 'sawtooth', 0.05);
  setTimeout(() => tone(180, 130, 'sawtooth', 0.05), 100);
}

/** Victory — three-note ascending fanfare for winner. */
export function victory() {
  const notes = [523, 659, 784, 1047]; // C E G C
  notes.forEach((f, i) => setTimeout(() => tone(f, 280, 'triangle', 0.08), i * 130));
}

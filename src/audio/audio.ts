// Sound: the old game's synthesised wuxia engine (blades, impacts, gongs, guzheng score), started on the first click
// or key press (browsers won't play before that). ?silent=1 keeps everything quiet (the owner's rule for tests).
import { WuxiaSound } from './wuxiaSound';

const silent = typeof location !== 'undefined' && new URLSearchParams(location.search).get('silent') === '1';
export const wuxia = new WuxiaSound();
let started = false;

export function startAudio() {
  if (started || silent || typeof AudioContext === 'undefined') return;
  started = true;
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  wuxia.attach(ctx, master, master);
  try {
    wuxia.setAmbience('forest');
    wuxia.setMusicTheme('forest');
    wuxia.startMusic();
  } catch {
    /* music is a nicety */
  }
}
if (typeof window !== 'undefined') {
  const go = () => startAudio();
  window.addEventListener('pointerdown', go, { once: true });
  window.addEventListener('keydown', go, { once: true });
}

type Sfx = Exclude<{ [K in keyof WuxiaSound]: WuxiaSound[K] extends () => void ? K : never }[keyof WuxiaSound], undefined>;
/** play a sound by name (quietly does nothing before audio has started) */
export function sfx(name: Sfx) {
  if (!started) return;
  try {
    (wuxia[name] as () => void)();
  } catch {
    /* never let a sound break the game */
  }
}

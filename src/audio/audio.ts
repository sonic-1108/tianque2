// Sound: the old game's synthesised wuxia engine (blades, impacts, gongs, guzheng score), started on the first click
// or key press (browsers won't play before that). ?silent=1 keeps everything quiet (the owner's rule for tests).
import { WuxiaSound, type AmbienceId } from './wuxiaSound';

const silent = typeof location !== 'undefined' && new URLSearchParams(location.search).get('silent') === '1';
export const wuxia = new WuxiaSound();
let started = false;
let amb: AmbienceId = 'forest';

export function startAudio() {
  if (started || silent || typeof AudioContext === 'undefined') return;
  started = true;
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  wuxia.attach(ctx, master, master);
  try {
    wuxia.setAmbience(amb);
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

/** the sound of the place you're in (雪岭's blizzard, the summit's thin wind; the woods everywhere else) */
export function ambience(id: AmbienceId) {
  if (id === amb) return;
  amb = id;
  if (!started) return;
  try {
    wuxia.setAmbience(id);
  } catch {
    /* a nicety */
  }
}

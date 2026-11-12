// Keyboard and mouse. Held keys are read every frame; presses (attack, skills, F ...) are kept until the sim takes them,
// so a quick tap between two frames is never lost.
import type { InputState } from './game/types';

const held = new Set<string>();
const pressed = new Set<string>();
let mouseDX = 0;
let mouseDY = 0;
let wheel = 0;
/** true while a panel (skill book, master) has the mouse */
export const ui = { open: false };

const SKILL_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'KeyR'];

export function attachInput(canvas: HTMLElement) {
  const down = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (!held.has(e.code)) pressed.add(e.code);
    held.add(e.code);
    if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
  };
  const up = (e: KeyboardEvent) => held.delete(e.code);
  const blur = () => held.clear();
  const md = (e: MouseEvent) => {
    if (ui.open) return;
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.();
      return;
    }
    if (e.button === 0) pressed.add('Mouse0');
    if (e.button === 2) pressed.add('Mouse2');
  };
  const mm = (e: MouseEvent) => {
    if (document.pointerLockElement === canvas) {
      mouseDX += e.movementX;
      mouseDY += e.movementY;
    }
  };
  const wh = (e: WheelEvent) => {
    wheel += e.deltaY;
  };
  const ctx = (e: Event) => e.preventDefault();
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  canvas.addEventListener('mousedown', md);
  document.addEventListener('mousemove', mm);
  canvas.addEventListener('wheel', wh, { passive: true });
  canvas.addEventListener('contextmenu', ctx);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', blur);
    canvas.removeEventListener('mousedown', md);
    document.removeEventListener('mousemove', mm);
    canvas.removeEventListener('wheel', wh);
    canvas.removeEventListener('contextmenu', ctx);
  };
}

/** a key pressed since the last call (and forget it) */
export function took(code: string) {
  const had = pressed.has(code);
  pressed.delete(code);
  return had;
}

export function takeMouse() {
  const r = { dx: mouseDX, dy: mouseDY, wheel };
  mouseDX = mouseDY = wheel = 0;
  return r;
}

export function readInput(camYaw: number): InputState {
  if (ui.open) {
    pressed.clear();
    return { move: [0, 0], camYaw, attack: false, dodge: false, jump: false, interact: false, skills: SKILL_KEYS.map(() => false), ultHeld: false };
  }
  const x = (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0);
  const y = (held.has('KeyW') ? 1 : 0) - (held.has('KeyS') ? 1 : 0);
  const st: InputState = {
    move: [x, y],
    camYaw,
    attack: took('Mouse0') || took('KeyJ'),
    dodge: took('ShiftLeft') || took('ShiftRight') || took('Mouse2'),
    jump: took('Space'),
    interact: took('KeyF'),
    skills: SKILL_KEYS.map((k) => took(k)),
    ultHeld: held.has('KeyR'),
  };
  return st;
}

/** test hook: press keys from scripts */
(globalThis as any).__T2_PRESS = (code: string) => pressed.add(code);
(globalThis as any).__T2_HOLD = (code: string, on: boolean) => (on ? held.add(code) : held.delete(code));

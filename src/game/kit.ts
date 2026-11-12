// The move kit: the owner asked for more moves per house and more houses, every move its own. Most of the new moves
// are data run by this small engine (a timeline of actions: strikes, shots, zones, buffs, blinks, summons ...), the
// old 35 stay hand written in skills.ts. Each action keeps to what the sim already knows (hit, shoot, zone, statuses),
// plus a few things of the kit's own on each fighter (`f.kit`): poison and bleeding over time, parry and absorb
// windows, evasion, thorns, a second life, summoned beasts and engines, orbiting blades, sticky charges.
import type { Fighter, Zone } from './types';
import type { HitOpts, Sim } from './sim';
import { SKILLS, type SkillDef } from './skills';
import { groundHeight, inBuilding, WATER_Y } from './world';
import { WORLD_R } from './layout';

const gh = groundHeight;
const P = (x: number, y: number, z: number): [number, number, number] => [x, y, z];

// ---------------------------------------------------------------- what a move is made of
export type Where = 'self' | 'ahead' | 'target';
export type FxKind = 'slash' | 'thrust' | 'slam' | 'burst' | 'ring' | 'fire' | 'poison' | 'sound' | 'qi' | 'holy' | 'shadow' | 'gold' | 'earth' | 'wind' | 'lightning' | 'blood' | 'ice' | 'wood';
export interface HitAct {
  k: 'hit';
  shape: 'cone' | 'circle' | 'line';
  r: number;
  cos?: number;
  w?: number;
  at?: Where;
  d?: number;
  dmg: number;
  o?: HitOpts;
  fx?: FxKind;
  /** poison / bleed: damage a second, seconds */
  dot?: [number, number, 'poison' | 'bleed' | 'burn'];
  weak?: number;
  /** x3 on anyone under 30% life */
  exec?: boolean;
  /** mana back for each one hit */
  mpGain?: number;
  /** strips a shield and armour */
  strip?: boolean;
  /** stacks a talisman mark */
  mark?: boolean;
  /** bonus on the marked (x) */
  vsMark?: number;
  /** bonus if the target bleeds (x) */
  vsBleed?: number;
  /** enemies only within this height of the caster */
  dy?: number;
}
export interface ShotAct {
  k: 'shot';
  n?: number;
  spread?: number; // total fan, radians
  ring?: boolean; // all round
  speed: number;
  life: number;
  dmg: number;
  shape?: 'dart' | 'pin' | 'knife' | 'glyph' | 'watch' | 'boomerang';
  pierce?: boolean;
  homing?: number;
  radius?: number;
  knock?: number;
  root?: number;
  onHit?: string;
  hitDur?: number;
  /** one after another, this far apart in time */
  seq?: number;
  dot?: [number, number, 'poison' | 'bleed' | 'burn'];
  /** bursts where it lands: radius, damage */
  splash?: [number, number];
  /** splits into this many on its first hit */
  split?: number;
  stun?: number;
  daze?: number;
  silence?: number;
  down?: number;
  slow?: number;
  mark?: boolean;
  mpDrain?: number;
  color?: string;
}
export interface ZoneAct {
  k: 'zone';
  at?: Where;
  d?: number;
  r: number;
  t: number;
  every?: number;
  dmg?: number;
  o?: HitOpts;
  slow?: number;
  dot?: [number, number, 'poison' | 'bleed' | 'burn'];
  rootOnce?: number;
  dazeOnce?: number;
  silenceOnce?: number;
  /** 剑阵: cuts whoever crosses its rim */
  edge?: number;
  /** allies inside: % of life a second */
  heal?: number;
  /** allies inside: shield on (65% less) */
  guard?: boolean;
  weak?: boolean;
  /** pulls enemies to the middle (m/s) */
  pull?: number;
  /** eats enemy projectiles */
  killProj?: boolean;
  /** goes with the caster */
  follow?: boolean;
  /** the caster can't be seen inside */
  hide?: boolean;
  /** enemies inside lose mana a second */
  mpBurn?: number;
  /** a ring of points along a line instead of a circle: length */
  line?: number;
  /** first touch only: root, then it's spent (lotus prints, caltrops) */
  once?: boolean;
  fx?: FxKind;
  color?: string;
}
export interface SelfAct {
  k: 'self';
  armor?: number;
  shield?: number;
  invuln?: number;
  buffAtk?: number;
  crit?: boolean;
  protect?: number;
  speed?: [number, number];
  heal?: number;
  mp?: number;
  hpCost?: number;
  mpToHp?: number;
  cleanse?: boolean;
  ward?: number;
  evade?: [number, number];
  thorns?: [number, number];
  cheat?: number;
  regen?: [number, number];
  parry?: [number, number];
  absorb?: number;
  bleedHits?: number;
  qiBlade?: number;
  focus?: number;
  immune?: number;
  fx?: FxKind;
}
export type Act =
  | HitAct
  | ShotAct
  | ZoneAct
  | SelfAct
  | { k: 'allies'; r: number; heal?: number; buffAtk?: number; regen?: [number, number]; cleanse?: boolean; fx?: FxKind }
  | { k: 'blink'; to: 'ahead' | 'behind' | 'swap' | 'back' | 'target'; d: number }
  | { k: 'pull'; r: number; power: number; mpDrain?: number }
  | { k: 'drain'; r: number; mp: number }
  | { k: 'delay'; at: Where; d: number; r: number; after: number; dmg: number; o?: HitOpts; fx: FxKind; n?: number; spread?: number; burn?: [number, number] }
  | { k: 'chain'; n: number; r: number; dmg: number; o?: HitOpts }
  | { k: 'grab'; r: number; dmg: number; o?: HitOpts }
  | { k: 'pet'; kind: PetKind; n: number; life: number; dmg: number; every: number; range: number }
  | { k: 'trap'; d: number; r: number; dmg: number; o?: HitOpts; life: number }
  | { k: 'orbit'; n: number; r: number; t: number; dmg: number; every: number }
  | { k: 'seed'; r: number; after: number; dmg: number }
  | { k: 'detonate'; r: number; mult: number }
  | { k: 'pets'; cmd: 'rend' | 'wild' | 'explode' | 'mend'; t?: number; dmg?: number }
  | { k: 'strikes'; n: number; r: number; dmg: number; o?: HitOpts; fx: FxKind }
  | { k: 'turn' }
  | { k: 'rush'; r: number }
  | { k: 'text'; text: string };
export interface Step {
  at: number;
  a: Act;
}
export interface Motion {
  /** forward at this speed until this time */
  lunge?: [number, number];
  /** a dash that carries its own hit (radius) and passes through */
  dash?: [number, number, number?, number?, HitOpts?];
  /** up and forward */
  leap?: [number, number];
  /** backwards */
  back?: [number, number];
  /** moving allowed at this share of a run */
  walk?: number;
  /** no gravity while it runs */
  float?: boolean;
}
export interface MoveSpec {
  id: string;
  name: string;
  house: string;
  icon: string;
  desc: string;
  mp: number;
  cd: number;
  ai: number;
  ult?: boolean;
  ground?: boolean;
  anim: string;
  dur: number;
  armor?: boolean;
  steps: Step[];
  /** the same action again and again: every, from, to */
  loop?: [number, number, number, Act];
  move?: Motion;
  sound?: string;
  /** charged: held this long rooted before the steps start (满弓, 拔剑式) */
  charge?: number;
  color?: string;
}

// ---------------------------------------------------------------- the kit's own state on a fighter
export type PetKind = 'wolf' | 'hawk' | 'puppet' | 'turret' | 'deer';
export interface Pet {
  id: number;
  kind: PetKind;
  owner: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  life: number;
  max: number;
  dmg: number;
  every: number;
  cd: number;
  range: number;
  moving: boolean;
  /** 撕咬: double and bleeding until */
  rend: number;
  wild: number;
  phase: number;
}
export interface Dot {
  src: number;
  tgt: number;
  dps: number;
  t: number;
  kind: 'poison' | 'bleed' | 'burn';
  acc: number;
  heal?: number;
}
interface KitState {
  parry: number;
  parryDmg: number;
  absorb: number;
  stored: number;
  evade: number;
  evadeP: number;
  thorns: number;
  thornsDps: number;
  cheat: number;
  regen: number;
  regenP: number;
  speed: number;
  speedX: number;
  bleedHits: number;
  qiBlade: number;
  focus: number;
  hidden: number;
  immune: number;
  marks: number;
  markT: number;
  seed: { by: number; t: number; dmg: number; r: number } | null;
  orbit: { n: number; r: number; t: number; dmg: number; every: number; cd: number; a: number } | null;
}
export const kitOf = (f: Fighter): KitState =>
  ((f as any).kit ??= { parry: 0, parryDmg: 0, absorb: 0, stored: 0, evade: 0, evadeP: 0, thorns: 0, thornsDps: 0, cheat: 0, regen: 0, regenP: 0, speed: 0, speedX: 1, bleedHits: 0, qiBlade: 0, focus: 0, hidden: 0, immune: 0, marks: 0, markT: 0, seed: null, orbit: null });
export interface KitWorld {
  dots: Dot[];
  pets: Pet[];
  petSeq: number;
}
export const kitWorld = (s: Sim): KitWorld => ((s as any).kitw ??= { dots: [], pets: [], petSeq: 1 });

// ---------------------------------------------------------------- small helpers
const fwd = (s: Sim, f: Fighter) => s.fwd(f);
const sideCol: Record<string, [string, string]> = {};
export function houseColor(house: string, player: string, foe: string) {
  sideCol[house] = [player, foe];
}
const col = (f: Fighter, house: string, c?: string) => c ?? (sideCol[house] ?? ['#fff', '#ddd'])[f.team === 'player' || f.team === 'ally' ? 0 : 1];
function spot(s: Sim, f: Fighter, at: Where | undefined, d = 0): [number, number] {
  if (at === 'target') {
    const t = target(s, f, Math.max(d, 8) + 6);
    if (t) return [t.pos[0], t.pos[2]];
  }
  if (at === 'ahead' || at === 'target') {
    const [fx, fz] = fwd(s, f);
    return [f.pos[0] + fx * d, f.pos[2] + fz * d];
  }
  return [f.pos[0], f.pos[2]];
}
/** the foe you'd mean: in front if any, else the nearest */
export function target(s: Sim, f: Fighter, range: number): Fighter | null {
  const [fx, fz] = fwd(s, f);
  let best: Fighter | null = null, bs = Infinity;
  for (const o of s.enemiesOf(f)) {
    if (o.hp <= 0 || (o as any).benched || (o as any).away) continue;
    const dx = o.pos[0] - f.pos[0], dz = o.pos[2] - f.pos[2], d = Math.hypot(dx, dz);
    if (d > range) continue;
    const ahead = (dx * fx + dz * fz) / (d || 1);
    const sc = d * (ahead > 0.5 ? 1 : 2.2);
    if (sc < bs) {
      bs = sc;
      best = o;
    }
  }
  return best;
}
function inShape(s: Sim, f: Fighter, a: { shape: 'cone' | 'circle' | 'line'; r: number; cos?: number; w?: number; dy?: number }, cx: number, cz: number) {
  const [fx, fz] = fwd(s, f);
  return s.enemiesOf(f).filter((o) => {
    if (o.hp <= 0 || (o as any).benched || (o as any).away) return false;
    if (Math.abs(o.pos[1] - f.pos[1]) > (a.dy ?? 3)) return false;
    const dx = o.pos[0] - cx, dz = o.pos[2] - cz, d = Math.hypot(dx, dz);
    if (a.shape === 'circle') return d < a.r;
    if (a.shape === 'cone') return d < a.r && (d < 0.8 || (dx * fx + dz * fz) / d > (a.cos ?? 0.3));
    const along = dx * fx + dz * fz, across = Math.abs(dx * fz - dz * fx);
    return along > -0.5 && along < a.r && across < (a.w ?? 1.2);
  });
}
export function fxAt(s: Sim, kind: FxKind | undefined, x: number, y: number, z: number, r: number, color: string, f?: Fighter) {
  if (!kind) return;
  const p = P(x, y, z), g = P(x, gh(x, z) + 0.06, z);
  switch (kind) {
    case 'slash':
      s.vfx('slashMark', P(x, y + 1.1, z), color, Math.max(1, r * 0.6), 0.18);
      s.vfx('sparkBurst', P(x, y + 1.1, z), 8, color, 5, 0.06);
      break;
    case 'thrust':
      if (f) {
        const [fx, fz] = s.fwd(f);
        s.vfx('tracer', P(f.pos[0], f.pos[1] + 1.2, f.pos[2]), P(f.pos[0] + fx * r, f.pos[1] + 1.2, f.pos[2] + fz * r), color);
      }
      s.vfx('sparkBurst', P(x, y + 1.1, z), 10, color, 6, 0.06);
      break;
    case 'slam':
      s.vfx('groundSlam', g, Math.max(0.6, r / 3), color);
      s.vfx('rocks', g, 8, 6, 0.12);
      s.shake(Math.min(0.7, 0.2 + r * 0.06), x, z);
      break;
    case 'burst':
      s.vfx('sparkBurst', p, 20, color, 7, 0.09);
      s.vfx('flash', p, color, 3, 0.2, 8);
      s.vfx('ring', g, r, color, 0.35, 0.12, 0.2);
      break;
    case 'ring':
      s.vfx('ring', g, r, color, 0.5, 0.14, 0.25);
      break;
    case 'fire':
      s.vfx('fireColumn', g, 1.2 + r * 0.2, color);
      s.vfx('embers', P(x, y + 0.5, z), 24, color, r * 0.6, 3.5, 0.09);
      s.vfx('flash', p, '#ff8a3a', 4, 0.25, 9);
      break;
    case 'poison':
      s.vfx('dustPuff', g, 16, r * 0.7, 1.6, 1.1, '#3f6f2a');
      s.vfx('embers', P(x, y + 0.4, z), 14, color, r * 0.6, 1.2, 0.08);
      break;
    case 'sound':
      for (let k = 0; k < 3; k++) s.later(k * 0.08, () => s.vfx('ring', P(x, y + 1.1, z), r * (0.5 + k * 0.25), color, 0.4, 0.06, 0));
      break;
    case 'qi':
      s.vfx('ring', g, r, color, 0.45, 0.1, 0.35);
      s.vfx('sparkBurst', P(x, y + 1, z), 16, color, 4, 0.07);
      s.vfx('flash', p, color, 2.5, 0.2, 7);
      break;
    case 'holy':
      s.vfx('ring', g, r, color, 0.6, 0.16, 0.45);
      s.vfx('embers', P(x, y + 0.2, z), 30, color, r * 0.5, 2.5, 0.08);
      break;
    case 'shadow':
      s.vfx('dustPuff', P(x, y + 0.6, z), 18, r * 0.5, 2.2, 0.8, '#1e1b2e');
      s.vfx('sparkBurst', P(x, y + 1, z), 12, color, 3, 0.05, 'up', 1);
      break;
    case 'gold':
      s.vfx('sparkBurst', P(x, y + 1.2, z), 18, '#ffd36a', 5, 0.08);
      s.vfx('ring', g, r, '#ffd36a', 0.45, 0.12, 0.25);
      break;
    case 'earth':
      s.vfx('rocks', g, 12, 7, 0.16);
      s.vfx('dustPuff', g, 14, r * 0.6, 2.4, 0.9);
      break;
    case 'wind':
      s.vfx('spiral', P(x, y, z), r * 0.6, s.time * 12, color);
      s.vfx('dustPuff', g, 10, r * 0.5, 3, 0.6);
      break;
    case 'lightning':
      s.vfx('tracer', P(x + (Math.random() - 0.5), y + 14, z + (Math.random() - 0.5)), P(x, y + 0.2, z), '#e9f1ff');
      s.vfx('tracer', P(x, y + 9, z), P(x, y + 0.2, z), color);
      s.vfx('flash', P(x, y + 2, z), '#cfe0ff', 8, 0.25, 14);
      s.vfx('sparkBurst', g, 22, '#e6f0ff', 8, 0.07);
      s.vfx('ring', g, r, color, 0.3, 0.1, 0.3);
      s.vfx('sound', 'slam');
      break;
    case 'blood':
      s.vfx('sparkBurst', P(x, y + 1, z), 14, '#b3121f', 5, 0.08);
      break;
    case 'ice':
      s.vfx('sparkBurst', P(x, y + 0.8, z), 18, '#cfefff', 4, 0.08);
      s.vfx('ring', g, r, '#bfe9ff', 0.6, 0.12, 0.35);
      break;
    case 'wood':
      s.vfx('rocks', g, 10, 5, 0.1);
      s.vfx('embers', P(x, y + 0.2, z), 14, '#5b8a3a', r * 0.5, 1.5, 0.09);
      break;
  }
}
const mult = (f: Fighter) => f.castMult ?? 1;
function addDot(s: Sim, src: Fighter, tgt: Fighter, dps: number, t: number, kind: Dot['kind'], heal?: number) {
  const W = kitWorld(s);
  const dpsN = dps * s.power(src) * mult(src);
  const old = W.dots.find((d) => d.src === src.id && d.tgt === tgt.id && d.kind === kind);
  // stacking: up to three times as strong, the time refreshed
  if (old) {
    old.dps = Math.min(old.dps + dpsN, dpsN * 3);
    old.t = Math.max(old.t, t);
  } else W.dots.push({ src: src.id, tgt: tgt.id, dps: dpsN, t, kind, acc: 0, heal });
}
export const bleeding = (s: Sim, f: Fighter) => kitWorld(s).dots.some((d) => d.tgt === f.id && d.kind === 'bleed' && d.t > 0);
const poisoned = (s: Sim, f: Fighter) => kitWorld(s).dots.filter((d) => d.tgt === f.id && d.kind === 'poison' && d.t > 0);

/** one blow on one foe, with the kit's extras */
function strike(s: Sim, f: Fighter, o: Fighter, a: { dmg: number; o?: HitOpts; dot?: HitAct['dot']; weak?: number; exec?: boolean; mpGain?: number; strip?: boolean; mark?: boolean; vsMark?: number; vsBleed?: number }) {
  let dmg = a.dmg;
  const K = kitOf(o);
  if (a.exec && o.hp < o.maxHp * 0.3) dmg *= 3;
  if (a.vsMark && K.marks > 0) dmg *= 1 + (a.vsMark - 1) * Math.min(3, K.marks);
  if (a.vsBleed && bleeding(s, o)) dmg *= a.vsBleed;
  if (a.strip) {
    o.st.shield = 0;
    o.st.armor = 0;
    kitOf(o).absorb = 0;
  }
  const got = s.hit(f, o, dmg, { ...(a.o ?? {}), breakArmor: a.o?.breakArmor || a.strip });
  if (got > 0) {
    if (a.dot) addDot(s, f, o, a.dot[0], a.dot[1], a.dot[2]);
    if (kitOf(f).bleedHits > 0) addDot(s, f, o, 18, 4, 'bleed');
    if (a.weak) o.st.weak = Math.max(o.st.weak, a.weak);
    if (a.mpGain) f.mp = Math.min(f.maxMp, f.mp + a.mpGain);
    if (a.mark) {
      K.marks = Math.min(3, K.marks + 1);
      K.markT = 8;
    }
  }
  return got;
}

// ---------------------------------------------------------------- running an action
function run(s: Sim, f: Fighter, m: MoveSpec, a: Act) {
  const color = col(f, m.house, m.color);
  switch (a.k) {
    case 'hit': {
      const [cx, cz] = spot(s, f, a.at, a.d);
      const list = inShape(s, f, a, cx, cz);
      if (a.shape === 'line') {
        const [fx, fz] = fwd(s, f);
        fxAt(s, a.fx, f.pos[0] + fx * a.r * 0.5, f.pos[1], f.pos[2] + fz * a.r * 0.5, a.r, color, f);
      } else if (a.shape === 'cone') {
        const [fx, fz] = fwd(s, f);
        fxAt(s, a.fx, f.pos[0] + fx * a.r * 0.5, f.pos[1], f.pos[2] + fz * a.r * 0.5, a.r, color, f);
      } else fxAt(s, a.fx, cx, f.pos[1], cz, a.r, color, f);
      for (const o of list) strike(s, f, o, a);
      return list.length;
    }
    case 'shot': {
      const n = a.n ?? 1;
      const t = target(s, f, a.speed * a.life);
      const base = t ? Math.atan2(-(t.pos[0] - f.pos[0]), -(t.pos[2] - f.pos[2])) : f.yaw;
      for (let k = 0; k < n; k++) {
        const go = () => {
          if (f.hp <= 0) return;
          const yaw = a.ring ? base + (k / n) * Math.PI * 2 : n > 1 && a.spread ? base - a.spread / 2 + (a.spread * k) / (n - 1) : base;
          const pr = s.shoot(f, { skill: m.id, speed: a.speed, life: a.life, dmg: a.dmg, yaw, shape: a.shape ?? 'dart', pierce: a.pierce, homing: a.homing, target: t?.id, radius: a.radius ?? 0.5, color: a.color ?? color, knock: a.knock, root: a.root, onHit: a.onHit, hitDur: a.hitDur });
          (pr as any).kit = a;
        };
        if (a.seq) s.later(k * a.seq, go);
        else go();
      }
      s.vfx('sound', 'throw');
      return 1;
    }
    case 'zone': {
      const [x, z] = spot(s, f, a.at, a.d);
      const zn = s.zone(f, m.id, x, z, a.r, a.t, a.color ?? color);
      zn.data.kit = a;
      zn.data.cd = 0;
      if (a.line) {
        const [fx, fz] = fwd(s, f);
        zn.data.fx = fx;
        zn.data.fz = fz;
        zn.x = f.pos[0];
        zn.z = f.pos[2];
      }
      fxAt(s, a.fx, x, gh(x, z), z, a.r, a.color ?? color);
      return 1;
    }
    case 'self': {
      const K = kitOf(f);
      if (a.hpCost) f.hp = Math.max(1, f.hp - Math.round(f.hp * a.hpCost));
      if (a.armor) f.st.armor = Math.max(f.st.armor, a.armor);
      if (a.shield) f.st.shield = Math.max(f.st.shield, a.shield);
      if (a.invuln) f.st.invuln = Math.max(f.st.invuln, a.invuln);
      if (a.buffAtk) f.st.buffAtk = Math.max(f.st.buffAtk, a.buffAtk);
      if (a.crit) f.st.crit = 1;
      if (a.protect) f.st.protect = Math.max(f.st.protect, a.protect);
      if (a.speed) {
        K.speedX = a.speed[0];
        K.speed = a.speed[1];
      }
      if (a.heal) s.heal(f, f.maxHp * a.heal);
      if (a.mp) f.mp = Math.min(f.maxMp, f.mp + f.maxMp * a.mp);
      if (a.mpToHp) {
        const take = f.mp * a.mpToHp;
        f.mp -= take;
        s.heal(f, take * 3);
      }
      if (a.cleanse) cleanse(f);
      if (a.ward) {
        f.ward = Math.max(f.ward ?? 0, f.maxHp * a.ward);
        f.st.wardT = Math.max(f.st.wardT, 6);
      }
      if (a.evade) {
        K.evadeP = a.evade[0];
        K.evade = a.evade[1];
      }
      if (a.thorns) {
        K.thornsDps = a.thorns[0];
        K.thorns = a.thorns[1];
      }
      if (a.cheat) K.cheat = a.cheat;
      if (a.regen) {
        K.regenP = a.regen[0];
        K.regen = a.regen[1];
      }
      if (a.parry) {
        K.parry = a.parry[0];
        K.parryDmg = a.parry[1];
      }
      if (a.absorb) {
        K.absorb = a.absorb;
        K.stored = 0;
      }
      if (a.bleedHits) K.bleedHits = a.bleedHits;
      if (a.qiBlade) K.qiBlade = a.qiBlade;
      if (a.focus) K.focus = a.focus;
      if (a.immune) K.immune = a.immune;
      fxAt(s, a.fx, f.pos[0], f.pos[1], f.pos[2], 2, color);
      return 1;
    }
    case 'allies': {
      for (const o of [f, ...s.fighters.filter((o) => o !== f && !s.isEnemy(f, o) && o.team !== 'npc' && o.hp > 0 && s.dist(o, f) < a.r)]) {
        if (a.heal) s.heal(o, o.maxHp * a.heal);
        if (a.buffAtk) o.st.buffAtk = Math.max(o.st.buffAtk, a.buffAtk);
        if (a.regen) {
          const K = kitOf(o);
          K.regenP = a.regen[0];
          K.regen = a.regen[1];
        }
        if (a.cleanse) cleanse(o);
        fxAt(s, a.fx ?? 'holy', o.pos[0], o.pos[1], o.pos[2], 1.2, color);
      }
      return 1;
    }
    case 'blink': {
      const [fx, fz] = fwd(s, f);
      const from: [number, number, number] = [...f.pos];
      if (a.to === 'ahead' || a.to === 'back') {
        const k = a.to === 'back' ? -1 : 1;
        for (let d = a.d; d > 1; d -= 1) if (stepTo(s, f, f.pos[0] + fx * d * k, f.pos[2] + fz * d * k)) break;
      } else {
        const t = target(s, f, a.d);
        if (!t) {
          for (let d = Math.min(6, a.d); d > 1; d -= 1) if (stepTo(s, f, f.pos[0] + fx * d, f.pos[2] + fz * d)) break;
        } else if (a.to === 'swap') {
          const tp: [number, number, number] = [...t.pos];
          t.pos = [...f.pos];
          f.pos = tp;
          fxAt(s, 'earth', t.pos[0], t.pos[1], t.pos[2], 1.5, color);
        } else {
          const ox = t.pos[0] - f.pos[0], oz = t.pos[2] - f.pos[2], L = Math.hypot(ox, oz) || 1;
          const k = a.to === 'behind' ? 1.4 : -1.4;
          stepTo(s, f, t.pos[0] + (ox / L) * k, t.pos[2] + (oz / L) * k) || stepTo(s, f, t.pos[0] - (ox / L) * 1.4, t.pos[2] - (oz / L) * 1.4);
          s.faceTo(f, t.pos[0], t.pos[2]);
        }
      }
      fxAt(s, 'shadow', from[0], from[1], from[2], 1.2, color);
      fxAt(s, 'shadow', f.pos[0], f.pos[1], f.pos[2], 1.2, color);
      return 1;
    }
    case 'pull': {
      for (const o of s.enemiesOf(f)) {
        const d = s.dist(f, o);
        if (o.hp <= 0 || d > a.r || d < 1.2 || (o as any).benched) continue;
        o.vel[0] += ((f.pos[0] - o.pos[0]) / d) * a.power;
        o.vel[2] += ((f.pos[2] - o.pos[2]) / d) * a.power;
        s.hit(f, o, 10, { flinch: true });
        if (a.mpDrain) {
          const t = Math.min(o.mp, a.mpDrain);
          o.mp -= t;
          f.mp = Math.min(f.maxMp, f.mp + t);
        }
      }
      fxAt(s, 'wind', f.pos[0], f.pos[1], f.pos[2], a.r, color);
      return 1;
    }
    case 'drain': {
      let got = 0;
      for (const o of s.enemiesOf(f)) {
        if (o.hp <= 0 || s.dist(f, o) > a.r) continue;
        const t = Math.min(o.mp, a.mp);
        o.mp -= t;
        got += t;
        s.vfx('chain', P(o.pos[0], o.pos[1] + 1.2, o.pos[2]), P(f.pos[0], f.pos[1] + 1.2, f.pos[2]), 0.5);
      }
      f.mp = Math.min(f.maxMp, f.mp + got);
      if (f.team === 'player') s.text(f, `吸星 +${Math.round(got)}`, '#60a5fa');
      return 1;
    }
    case 'delay': {
      const n = a.n ?? 1;
      const t = a.at === 'target' ? target(s, f, a.d + 8) : null;
      for (let k = 0; k < n; k++) {
        let [x, z] = t && k === 0 ? [t.pos[0], t.pos[2]] : spot(s, f, a.at === 'target' ? 'ahead' : a.at, a.d);
        if (a.spread && k > 0) {
          x += (Math.random() - 0.5) * a.spread * 2;
          z += (Math.random() - 0.5) * a.spread * 2;
        }
        s.vfx('ring', P(x, gh(x, z) + 0.06, z), a.r, color, a.after + 0.1, 0.1, 0.15);
        s.later(a.after + k * 0.12, () => {
          if (f.hp <= 0) return;
          fxAt(s, a.fx, x, gh(x, z), z, a.r, color);
          for (const o of inShape(s, f, { shape: 'circle', r: a.r, dy: 4 }, x, z)) strike(s, f, o, { dmg: a.dmg, o: a.o, dot: a.burn ? [a.burn[0], a.burn[1], 'burn'] : undefined });
        });
      }
      return 1;
    }
    case 'chain': {
      let from: Fighter = f;
      const hit = new Set<number>();
      for (let k = 0; k < a.n; k++) {
        let best: Fighter | null = null, bd = a.r;
        for (const o of s.enemiesOf(f)) {
          if (o.hp <= 0 || hit.has(o.id)) continue;
          const d = s.dist(from, o) - (kitOf(o).marks > 0 ? 3 : 0);
          if (d < bd) {
            bd = d;
            best = o;
          }
        }
        if (!best) break;
        hit.add(best.id);
        const src = from, dst = best;
        s.later(k * 0.09, () => {
          s.vfx('tracer', P(src.pos[0], src.pos[1] + 1.3, src.pos[2]), P(dst.pos[0], dst.pos[1] + 1.2, dst.pos[2]), '#dbeafe');
          s.vfx('sparkBurst', P(dst.pos[0], dst.pos[1] + 1.2, dst.pos[2]), 10, '#e0ecff', 5, 0.06);
          strike(s, f, dst, { dmg: a.dmg * (kitOf(dst).marks > 0 ? 1.5 : 1), o: a.o });
        });
        from = best;
      }
      return hit.size;
    }
    case 'grab': {
      const t = inShape(s, f, { shape: 'cone', r: a.r, cos: 0.2 }, f.pos[0], f.pos[2])[0];
      if (!t) {
        if (f.team === 'player') s.text(f, '没抓到', '#9ca3af');
        return 0;
      }
      const [fx, fz] = fwd(s, f);
      // over the shoulder: lands behind you
      t.pos = [f.pos[0] - fx * 1.6, t.pos[1], f.pos[2] - fz * 1.6];
      strike(s, f, t, { dmg: a.dmg, o: { heavy: true, down: 1.2, launch: 5, fromX: f.pos[0] + fx * 3, fromZ: f.pos[2] + fz * 3, ...(a.o ?? {}) } });
      fxAt(s, 'slam', t.pos[0], t.pos[1], t.pos[2], 2, color);
      return 1;
    }
    case 'pet': {
      const W = kitWorld(s);
      for (let k = 0; k < a.n; k++) {
        const ang = f.yaw + Math.PI + (k - (a.n - 1) / 2) * 0.9;
        const x = f.pos[0] - Math.sin(ang) * 1.8, z = f.pos[2] - Math.cos(ang) * 1.8;
        W.pets.push({ id: W.petSeq++, kind: a.kind, owner: f.id, x, y: gh(x, z), z, yaw: f.yaw, life: a.life, max: a.life, dmg: a.dmg * s.power(f) * mult(f), every: a.every, cd: 0.5 + k * 0.2, range: a.range, moving: false, rend: 0, wild: 0, phase: Math.random() * 6 });
        fxAt(s, a.kind === 'turret' || a.kind === 'puppet' ? 'wood' : 'wind', x, gh(x, z), z, 1.2, color);
      }
      // too many of a kind: the oldest goes
      const mine = W.pets.filter((p) => p.owner === f.id && p.kind === a.kind);
      const cap = a.kind === 'wolf' ? 4 : 3;
      if (mine.length > cap) for (const p of mine.slice(0, mine.length - cap)) p.life = 0;
      return 1;
    }
    case 'trap': {
      const [x, z] = spot(s, f, 'ahead', a.d);
      const zn = s.zone(f, m.id, x, z, a.r, a.life, color);
      zn.data.trap = a;
      s.vfx('ring', P(x, gh(x, z) + 0.05, z), 0.6, color, 0.6, 0.1, 0.5);
      return 1;
    }
    case 'orbit': {
      kitOf(f).orbit = { n: a.n, r: a.r, t: a.t, dmg: a.dmg, every: a.every, cd: 0, a: 0 };
      return 1;
    }
    case 'seed': {
      const t = target(s, f, a.r);
      if (!t) return 0;
      kitOf(t).seed = { by: f.id, t: a.after, dmg: a.dmg * s.power(f) * mult(f), r: 3 };
      s.vfx('sparkBurst', P(t.pos[0], t.pos[1] + 1.2, t.pos[2]), 14, color, 3, 0.06);
      if (f.team === 'player') s.addFx({ kind: 'text', x: t.pos[0], y: t.pos[1] + 2.6, z: t.pos[2], max: 1, r: 1, color, text: '影种' });
      return 1;
    }
    case 'detonate': {
      let n = 0;
      for (const o of s.enemiesOf(f)) {
        if (o.hp <= 0 || s.dist(f, o) > a.r) continue;
        const ds = poisoned(s, o).filter((d) => d.src === f.id);
        if (!ds.length) continue;
        const left = ds.reduce((x, d) => x + d.dps * d.t, 0);
        for (const d of ds) d.t = 0;
        s.hit(f, o, left * a.mult, { noScale: true, heavy: true, crit: true });
        fxAt(s, 'poison', o.pos[0], o.pos[1], o.pos[2], 2.5, '#7bd23a');
        n++;
      }
      if (!n && f.team === 'player') s.text(f, '没有中毒的人', '#9ca3af');
      return n;
    }
    case 'pets': {
      const W = kitWorld(s);
      for (const p of W.pets.filter((p) => p.owner === f.id)) {
        if (a.cmd === 'rend') p.rend = a.t ?? 4;
        if (a.cmd === 'wild') p.wild = a.t ?? 6;
        if (a.cmd === 'mend') p.life = Math.min(p.max, p.life + p.max * 0.5);
        if (a.cmd === 'explode') {
          p.life = 0;
          fxAt(s, 'fire', p.x, p.y, p.z, 4, '#ff8a3a');
          for (const o of inShape(s, f, { shape: 'circle', r: 4, dy: 4 }, p.x, p.z)) strike(s, f, o, { dmg: a.dmg ?? 200, o: { heavy: true, launch: 6, fromX: p.x, fromZ: p.z } });
        }
      }
      return 1;
    }
    case 'strikes': {
      // on the nearest foes all round, one bolt each (五雷正法)
      const list = s.enemiesOf(f).filter((o) => o.hp > 0 && s.dist(f, o) < a.r).sort((x, y) => s.dist(f, x) - s.dist(f, y)).slice(0, a.n);
      list.forEach((o, k) =>
        s.later(k * 0.18, () => {
          fxAt(s, a.fx, o.pos[0], o.pos[1], o.pos[2], 2, color);
          strike(s, f, o, { dmg: a.dmg, o: a.o });
        }),
      );
      if (!list.length) fxAt(s, a.fx, ...spot(s, f, 'ahead', 5).flatMap((v, i) => (i === 0 ? [v, f.pos[1]] : [v])) as [number, number, number], 2, color);
      return list.length;
    }
    case 'turn':
      f.yaw += Math.PI;
      return 1;
    case 'rush': {
      const t = target(s, f, a.r);
      if (t) {
        const ox = t.pos[0] - f.pos[0], oz = t.pos[2] - f.pos[2], L = Math.hypot(ox, oz) || 1;
        stepTo(s, f, t.pos[0] - (ox / L) * 1.3, t.pos[2] - (oz / L) * 1.3);
        s.faceTo(f, t.pos[0], t.pos[2]);
      }
      return 1;
    }
    case 'text':
      if (f.team === 'player') s.text(f, a.text, col(f, m.house, m.color));
      return 1;
  }
}
function cleanse(f: Fighter) {
  f.st.slow = f.st.root = f.st.stun = f.st.daze = f.st.silence = f.st.weak = f.st.kneel = 0;
}
function stepTo(s: Sim, f: Fighter, x: number, z: number) {
  if (Math.abs(x) > WORLD_R - 25 || Math.abs(z) > WORLD_R - 25) return false;
  const g = gh(x, z);
  if (g > f.pos[1] + 1.2 || g < WATER_Y - 0.9) return false;
  if (inBuilding(x, g + 1, z, 0.4)) return false;
  f.pos = [x, Math.max(g, f.pos[1] - 3), z];
  f.vel = [0, 0, 0];
  return true;
}

// ---------------------------------------------------------------- turning a spec into a move
export function defineMove(m: MoveSpec) {
  const d: SkillDef = {
    id: m.id,
    name: m.name,
    sect: m.house as any,
    icon: m.icon,
    desc: m.desc,
    mp: m.mp,
    cd: m.cd,
    aiRange: m.ai,
    ult: m.ult,
    ground: m.ground,
    float: m.move?.float ? (_s, f) => f.run?.id === m.id : undefined,
    cast: (s, f) => {
      s.setAct(f, 'cast', m.dur + (m.charge ?? 0), m.anim);
      f.run = { id: m.id, t: 0, data: { k: 0, lp: -1 } };
      if (m.armor) f.st.armor = Math.max(f.st.armor, m.dur + (m.charge ?? 0));
      if (m.move?.leap) {
        const [fx, fz] = s.fwd(f);
        f.vel = [fx * m.move.leap[1], m.move.leap[0], fz * m.move.leap[1]];
        f.grounded = false;
      }
      if (m.move?.back) {
        const [fx, fz] = s.fwd(f);
        f.vel = [-fx * m.move.back[0], 5, -fz * m.move.back[0]];
        f.grounded = false;
      }
      if (m.charge && f.team === 'player') s.text(f, '蓄力……', col(f, m.house, m.color));
      s.vfx('sound', m.sound ?? (m.ult ? 'ultRise' : 'swing'));
      if (m.ult) s.vfx('ring', P(f.pos[0], gh(f.pos[0], f.pos[2]) + 0.05, f.pos[2]), 2.4, col(f, m.house, m.color), 0.5, 0.14, 0.4);
      return true;
    },
    move: (s, f, wish, dt) => {
      const r = f.run!, mv = m.move, t = r.t - (m.charge ?? 0);
      const [fx, fz] = s.fwd(f);
      const steer = (vx: number, vz: number, k = 12) => {
        f.vel[0] += (vx - f.vel[0]) * Math.min(1, k * dt);
        f.vel[2] += (vz - f.vel[2]) * Math.min(1, k * dt);
      };
      if (t < 0) return steer(0, 0);
      if (mv?.lunge && t < mv.lunge[1]) return steer(fx * mv.lunge[0], fz * mv.lunge[0]);
      if (mv?.dash && t < mv.dash[1]) {
        f.vel[0] = fx * mv.dash[0];
        f.vel[2] = fz * mv.dash[0];
        return;
      }
      if (mv?.leap || mv?.back) return;
      if (mv?.walk) return steer(wish[0] * 6.8 * mv.walk, wish[1] * 6.8 * mv.walk, 8);
      steer(0, 0, 9);
    },
    tick: (s, f) => {
      const r = f.run!, t = r.t - (m.charge ?? 0);
      if (t < 0) return;
      const color = col(f, m.house, m.color);
      // a dash cuts whoever it passes
      if (m.move?.dash && t < m.move.dash[1] && m.move.dash[2]) {
        const hit: number[] = ((r.data as any).hit ??= []);
        for (const o of inShape(s, f, { shape: 'circle', r: m.move.dash[2] }, f.pos[0], f.pos[2]))
          if (!hit.includes(o.id)) {
            hit.push(o.id);
            strike(s, f, o, { dmg: m.move.dash[3] ?? 80, o: m.move.dash[4] ?? { knock: 6, launch: 3 } });
            fxAt(s, 'slash', o.pos[0], o.pos[1], o.pos[2], 1.5, color);
          }
        if (Math.random() < 0.5) s.vfx('dustPuff', P(f.pos[0], gh(f.pos[0], f.pos[2]), f.pos[2]), 2, 0.3, 1.5, 0.5);
      }
      while (r.data.k < m.steps.length && m.steps[r.data.k].at <= t) {
        run(s, f, m, m.steps[r.data.k].a);
        r.data.k++;
      }
      if (m.loop) {
        const [every, from, to, a] = m.loop;
        const k = Math.floor((t - from) / every);
        if (t >= from && t <= to && k > r.data.lp) {
          r.data.lp = k;
          run(s, f, m, a);
        }
      }
      // a leap ends when it lands (the land hook), or if it never does
      const airborne = (m.move?.leap || m.move?.back) && !f.grounded && t < m.dur + 2.5;
      if (t >= m.dur && !airborne) {
        while (r.data.k < m.steps.length) {
          run(s, f, m, m.steps[r.data.k].a);
          r.data.k++;
        }
        f.run = null;
        s.setAct(f, f.grounded ? 'idle' : 'jump', 0, f.grounded ? 'idle' : 'jump');
      }
    },
    zoneTick: (s, f, z, dt) => zoneTick(s, f, m, z, dt),
    projHit: (s, f, o, pr) => projHit(s, f, o, pr),
    land: (s, f) => {
      // a leap's landing: run the steps that wait for it at once
      const r = f.run!;
      if (!(m.move?.leap || m.move?.back)) return;
      if (r.t < 0.12) return; // still leaving the ground
      while (r.data.k < m.steps.length) {
        run(s, f, m, m.steps[r.data.k].a);
        r.data.k++;
      }
      f.vel[0] = f.vel[2] = 0;
      f.run = null;
      s.setAct(f, 'cast', 0.18, f.anim);
    },
  };
  SKILLS[m.id] = d;
}

function zoneTick(s: Sim, f: Fighter, m: MoveSpec, z: Zone, dt: number) {
  const trap = z.data.trap as Extract<Act, { k: 'trap' }> | undefined;
  if (trap) {
    const hits = inShape(s, f, { shape: 'circle', r: trap.r * 0.6, dy: 2.5 }, z.x, z.z);
    if (hits.length) {
      z.t = 0;
      fxAt(s, 'fire', z.x, z.y, z.z, trap.r, '#ff9a3a');
      s.shake(0.4, z.x, z.z);
      for (const o of inShape(s, f, { shape: 'circle', r: trap.r, dy: 3 }, z.x, z.z)) strike(s, f, o, { dmg: trap.dmg, o: { heavy: true, fromX: z.x, fromZ: z.z, ...(trap.o ?? {}) } });
    } else if (Math.random() < dt * 2) s.vfx('sparkBurst', P(z.x, z.y + 0.1, z.z), 2, z.color, 1, 0.04);
    return;
  }
  const a = z.data.kit as ZoneAct | undefined;
  if (!a) return;
  if (a.follow) {
    z.x = f.pos[0];
    z.z = f.pos[2];
    z.y = gh(z.x, z.z);
  }
  // what's inside: a circle, or a strip along a line
  const inside = (o: Fighter) => {
    if (a.line) {
      const dx = o.pos[0] - z.x, dz = o.pos[2] - z.z, along = dx * z.data.fx + dz * z.data.fz, across = Math.abs(dx * z.data.fz - dz * z.data.fx);
      return along > 0 && along < a.line && across < a.r;
    }
    return Math.hypot(o.pos[0] - z.x, o.pos[2] - z.z) < a.r && Math.abs(o.pos[1] - z.y) < 3.5;
  };
  const foes = s.enemiesOf(f).filter((o) => o.hp > 0 && !(o as any).benched && !(o as any).away && inside(o));
  const touched = z.touched;
  for (const o of foes) {
    if (a.slow) o.st.slow = Math.max(o.st.slow, a.slow);
    if (a.weak) o.st.weak = Math.max(o.st.weak, 0.5);
    if (a.mpBurn) o.mp = Math.max(0, o.mp - a.mpBurn * dt);
    if (a.pull) {
      const d = Math.hypot(o.pos[0] - z.x, o.pos[2] - z.z);
      if (d > 0.8) {
        o.vel[0] += ((z.x - o.pos[0]) / d) * a.pull * dt * 4;
        o.vel[2] += ((z.z - o.pos[2]) / d) * a.pull * dt * 4;
      }
    }
    if (!touched.includes(o.id)) {
      touched.push(o.id);
      if (a.rootOnce) o.st.root = Math.max(o.st.root, a.rootOnce);
      if (a.dazeOnce) o.st.daze = Math.max(o.st.daze, a.dazeOnce);
      if (a.silenceOnce) o.st.silence = Math.max(o.st.silence, a.silenceOnce);
      if (a.dot) addDot(s, f, o, a.dot[0], a.dot[1], a.dot[2]);
      if (a.once) {
        if (a.dmg) strike(s, f, o, { dmg: a.dmg, o: a.o });
        z.t = Math.min(z.t, 0.3);
      }
    }
  }
  // 剑阵: crossing the rim cuts
  if (a.edge) {
    const was: Record<number, boolean> = (z.data.in ??= {});
    for (const o of s.enemiesOf(f)) {
      if (o.hp <= 0) continue;
      const now = inside(o);
      if (was[o.id] !== undefined && was[o.id] !== now) {
        strike(s, f, o, { dmg: a.edge, o: { slow: 1.5, flinch: true } });
        fxAt(s, 'slash', o.pos[0], o.pos[1], o.pos[2], 1.2, z.color);
      }
      was[o.id] = now;
    }
  }
  if (a.killProj)
    for (const pr of s.proj) {
      const own = s.fighters[pr.owner];
      if (!own || !s.isEnemy(f, own)) continue;
      if (Math.hypot(pr.pos[0] - z.x, pr.pos[2] - z.z) < a.r + 0.5) {
        pr.life = 0;
        s.vfx('sparkBurst', P(pr.pos[0], pr.pos[1], pr.pos[2]), 6, z.color, 3, 0.05);
      }
    }
  if (a.hide && Math.hypot(f.pos[0] - z.x, f.pos[2] - z.z) < a.r) kitOf(f).hidden = 0.3;
  if (a.heal || a.guard) {
    for (const o of s.fighters) {
      if (o.hp <= 0 || s.isEnemy(f, o) || o.team === 'npc' || Math.hypot(o.pos[0] - z.x, o.pos[2] - z.z) > a.r) continue;
      if (a.heal) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * a.heal * dt);
      if (a.guard) o.st.shield = Math.max(o.st.shield, 0.2);
    }
  }
  z.data.cd -= dt;
  if (a.every && z.data.cd <= 0) {
    z.data.cd = a.every;
    if (a.dmg && !a.once) for (const o of foes) strike(s, f, o, { dmg: a.dmg, o: a.o ?? { flinch: true } });
    if (a.fx && Math.random() < 0.7) {
      const ang = Math.random() * Math.PI * 2, rr = Math.random() * (a.line ? 0 : a.r);
      const x = a.line ? z.x + z.data.fx * Math.random() * a.line : z.x + Math.cos(ang) * rr;
      const zz = a.line ? z.z + z.data.fz * Math.random() * a.line : z.z + Math.sin(ang) * rr;
      fxAt(s, a.fx === 'slam' ? 'earth' : a.fx, x, gh(x, zz), zz, Math.min(2, a.r * 0.4), z.color);
    }
    if (!a.line) s.vfx('ring', P(z.x, z.y + 0.05, z.z), a.r, z.color, (a.every ?? 0.5) + 0.1, 0.06, 0.08);
  }
}
function projHit(s: Sim, f: Fighter, o: Fighter, pr: any) {
  const a = pr.kit as ShotAct | undefined;
  if (!a) return;
  if (a.dot) addDot(s, f, o, a.dot[0], a.dot[1], a.dot[2]);
  if (a.stun) o.st.stun = Math.max(o.st.stun, a.stun);
  if (a.daze) o.st.daze = Math.max(o.st.daze, a.daze);
  if (a.silence) o.st.silence = Math.max(o.st.silence, a.silence);
  if (a.slow) o.st.slow = Math.max(o.st.slow, a.slow);
  if (a.down) s.hit(f, o, 1, { noScale: true, down: a.down });
  if (a.mark) {
    const K = kitOf(o);
    K.marks = Math.min(3, K.marks + 1);
    K.markT = 8;
  }
  if (a.mpDrain) {
    const t = Math.min(o.mp, a.mpDrain);
    o.mp -= t;
    f.mp = Math.min(f.maxMp, f.mp + t);
  }
  if (a.splash) {
    fxAt(s, 'fire', o.pos[0], o.pos[1], o.pos[2], a.splash[0], '#ff9a3a');
    for (const x of inShape(s, f, { shape: 'circle', r: a.splash[0], dy: 3 }, o.pos[0], o.pos[2])) if (x !== o) strike(s, f, x, { dmg: a.splash[1], o: { knock: 5, fromX: o.pos[0], fromZ: o.pos[2] } });
  }
  if (a.split && !pr.kitSplit) {
    for (let k = 0; k < a.split; k++) {
      const yaw = (k / a.split) * Math.PI * 2;
      const q = s.shoot(f, { skill: pr.skill, speed: 16, life: 0.5, dmg: a.dmg * 0.45, yaw, shape: 'pin', pos: [o.pos[0] - Math.sin(yaw) * 0.8, o.pos[1] + 1.1, o.pos[2] - Math.cos(yaw) * 0.8], color: pr.color, radius: 0.45 });
      (q as any).kitSplit = true;
      (q as any).kit = { ...a, split: 0 };
      q.hit.push(o.id);
    }
  }
}

// ---------------------------------------------------------------- the sim's hooks
/** before a blow lands: parry, absorb, evade, thorns; returns the damage to take (0 = none) */
export function kitGuard(s: Sim, att: Fighter, def: Fighter, dmg: number): number {
  const K = (def as any).kit as KitState | undefined;
  if (!K || dmg <= 0) return dmg;
  if (K.parry > 0 && att !== def) {
    K.parry = 0;
    const cx = (att.pos[0] + def.pos[0]) / 2, cz = (att.pos[2] + def.pos[2]) / 2;
    s.vfx('sparkBurst', P(cx, def.pos[1] + 1.3, cz), 24, '#e0f2fe', 8, 0.07);
    s.vfx('flash', P(cx, def.pos[1] + 1.3, cz), '#e0f2fe', 5, 0.18, 8);
    s.vfx('sound', 'parry');
    s.faceTo(def, att.pos[0], att.pos[2]);
    s.later(0.05, () => s.hit(def, att, K.parryDmg, { heavy: true, crit: true, stun: 1, knock: 6 }));
    if (def.team === 'player') s.text(def, '格挡！', '#e0f2fe');
    def.st.invuln = Math.max(def.st.invuln, 0.35);
    return 0;
  }
  if (K.absorb > 0) {
    K.stored += dmg * 0.8;
    return dmg * 0.2;
  }
  if (K.evade > 0 && Math.random() < K.evadeP) {
    if (def.team === 'player') s.text(def, '闪', '#e5e7eb');
    return 0;
  }
  if (K.thorns > 0 && att !== def && s.dist(att, def) < 4) addDot(s, def, att, K.thornsDps, 4, 'poison');
  if (K.immune > 0 && dmg < def.maxHp * 0.02) return 0;
  return dmg;
}
/** after a blow: a second life (免死金牌) */
export function kitAfter(s: Sim, def: Fighter) {
  const K = (def as any).kit as KitState | undefined;
  if (!K || def.hp > 0 || K.cheat <= 0) return false;
  K.cheat = 0;
  def.hp = Math.round(def.maxHp * 0.3);
  def.st.invuln = 1.5;
  s.vfx('ring', P(def.pos[0], gh(def.pos[0], def.pos[2]) + 0.05, def.pos[2]), 3, '#ffd36a', 0.8, 0.2, 0.5);
  s.vfx('sparkBurst', P(def.pos[0], def.pos[1] + 1.2, def.pos[2]), 30, '#ffd36a', 6, 0.08);
  if (def.team === 'player') s.text(def, '免死金牌！', '#ffd36a');
  return true;
}
/** a basic swing: 心剑 sends a sword breath along it */
export function kitSwing(s: Sim, f: Fighter) {
  const K = (f as any).kit as KitState | undefined;
  if (!K || K.qiBlade <= 0) return;
  const pr = s.shoot(f, { skill: 'heart_sword', speed: 22, life: 0.45, dmg: 45, shape: 'knife', pierce: true, color: '#bfe8ff', radius: 0.7 });
  (pr as any).kit = { k: 'shot', speed: 22, life: 0.45, dmg: 45 };
}
export const kitSpeed = (f: Fighter) => {
  const K = (f as any).kit as KitState | undefined;
  return K && K.speed > 0 ? K.speedX : 1;
};
export const kitHidden = (f: Fighter) => ((f as any).kit as KitState | undefined)?.hidden ?? 0;

/** every frame: time on everyone's kit, poison and bleeding, the beasts and engines, orbits, charges */
export function kitStep(s: Sim, dt: number) {
  const W = kitWorld(s);
  for (const f of s.fighters) {
    const K = (f as any).kit as KitState | undefined;
    if (!K) continue;
    for (const k of ['parry', 'evade', 'thorns', 'cheat', 'regen', 'speed', 'bleedHits', 'qiBlade', 'focus', 'hidden', 'immune', 'markT'] as const) if (K[k] > 0) K[k] = Math.max(0, K[k] - dt);
    if (K.markT <= 0) K.marks = 0;
    if (f.hp <= 0) continue;
    if (K.regen > 0) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * K.regenP * dt);
    if (K.focus > 0 && f.st.crit <= 0) f.st.crit = 1;
    // 太极卸力: when the window shuts, what it took goes back out as a push
    if (K.absorb > 0 && (K.absorb -= dt) <= 0) {
      const n = K.stored;
      fxAt(s, 'qi', f.pos[0], f.pos[1], f.pos[2], 4, '#fbbf24');
      for (const o of inShape(s, f, { shape: 'circle', r: 4 }, f.pos[0], f.pos[2])) s.hit(f, o, 60 + n * 1.5, { noScale: true, heavy: true, knock: 12, launch: 5 });
      K.stored = 0;
    }
    if (K.seed && (K.seed.t -= dt) <= 0) {
      const by = s.fighters[K.seed.by];
      fxAt(s, 'shadow', f.pos[0], f.pos[1], f.pos[2], 3, '#a78bfa');
      s.vfx('flash', P(f.pos[0], f.pos[1] + 1, f.pos[2]), '#a78bfa', 5, 0.25, 9);
      if (by) for (const o of s.enemiesOf(by)) if (o.hp > 0 && s.dist(o, f) < K.seed.r) s.hit(by, o, K.seed.dmg, { noScale: true, heavy: true, crit: true, launch: 4 });
      K.seed = null;
    }
    if (K.orbit) {
      const O = K.orbit;
      O.t -= dt;
      O.a += dt * 6;
      O.cd -= dt;
      if (Math.random() < dt * 20) {
        const k = Math.floor(Math.random() * O.n), ang = O.a + (k / O.n) * Math.PI * 2;
        s.vfx('sparkBurst', P(f.pos[0] + Math.cos(ang) * O.r, f.pos[1] + 1.1, f.pos[2] + Math.sin(ang) * O.r), 2, '#d1fae5', 1, 0.05);
      }
      if (O.cd <= 0) {
        O.cd = O.every;
        for (const o of inShape(s, f, { shape: 'circle', r: O.r + 0.6 }, f.pos[0], f.pos[2])) s.hit(f, o, O.dmg, { flinch: true });
      }
      if (O.t <= 0) K.orbit = null;
    }
  }
  // poison, bleeding and burning
  for (const d of W.dots) {
    if (d.t <= 0) continue;
    d.t -= dt;
    d.acc += d.dps * dt;
    const tgt = s.fighters[d.tgt], src = s.fighters[d.src];
    if (!tgt || tgt.hp <= 0 || !src) {
      d.t = 0;
      continue;
    }
    if (d.acc >= 8 || d.t <= 0) {
      const n = Math.round(d.acc);
      d.acc = 0;
      if (n > 0) {
        s.hit(src, tgt, n, { noScale: true, stagger: false, color: d.kind === 'poison' ? '#7bd23a' : d.kind === 'burn' ? '#ff9a3a' : '#e11d48' });
        if (d.heal && src.hp > 0) src.hp = Math.min(src.maxHp, src.hp + n * d.heal);
      }
      if (Math.random() < 0.5) s.vfx('embers', P(tgt.pos[0], tgt.pos[1] + 1, tgt.pos[2]), 3, d.kind === 'poison' ? '#7bd23a' : d.kind === 'burn' ? '#ff9a3a' : '#b3121f', 0.4, 1.2, 0.07);
    }
  }
  W.dots = W.dots.filter((d) => d.t > 0);
  // the beasts and engines
  for (const p of W.pets) {
    const o = s.fighters[p.owner];
    if (!o || o.hp <= 0) p.life = 0;
    p.life -= dt;
    if (p.life <= 0) continue;
    p.rend = Math.max(0, p.rend - dt);
    p.wild = Math.max(0, p.wild - dt);
    p.cd -= dt * (p.wild > 0 ? 1.6 : 1);
    p.phase += dt;
    const still = p.kind === 'turret';
    // the foe it goes for: near its master
    let t: Fighter | null = null, bd = p.range;
    for (const e of s.enemiesOf(o)) {
      if (e.hp <= 0 || (e as any).benched || (e as any).away) continue;
      const d = Math.hypot(e.pos[0] - p.x, e.pos[2] - p.z);
      if (d < bd && (still || s.dist(e, o) < 22)) {
        bd = d;
        t = e;
      }
    }
    let gx = o.pos[0] - Math.sin(o.yaw + 2.4) * 2, gz = o.pos[2] - Math.cos(o.yaw + 2.4) * 2;
    if (t) {
      gx = t.pos[0];
      gz = t.pos[2];
    }
    if (p.kind === 'deer') {
      gx = o.pos[0] + Math.cos(p.phase * 1.3) * 3.5;
      gz = o.pos[2] + Math.sin(p.phase * 1.3) * 3.5;
    }
    if (!still) {
      const dx = gx - p.x, dz = gz - p.z, d = Math.hypot(dx, dz);
      const reach = p.kind === 'hawk' ? 0.5 : p.kind === 'deer' ? 0.3 : 1.4;
      const sp = (p.kind === 'hawk' ? 14 : p.kind === 'puppet' ? 3.5 : p.kind === 'deer' ? 7 : 9) * (p.wild > 0 ? 1.3 : 1);
      p.moving = d > reach;
      if (d > 40) {
        p.x = o.pos[0];
        p.z = o.pos[2];
      } else if (p.moving) {
        const k = Math.min(d - reach, sp * dt);
        p.x += (dx / d) * k;
        p.z += (dz / d) * k;
        p.yaw = Math.atan2(-dx, -dz);
      }
      p.y = gh(p.x, p.z) + (p.kind === 'hawk' ? 3.2 + Math.sin(p.phase * 2) * 0.6 : 0);
    } else if (t) p.yaw = Math.atan2(-(t.pos[0] - p.x), -(t.pos[2] - p.z));
    if (p.kind === 'deer') {
      if (p.cd <= 0) {
        p.cd = p.every;
        for (const a of s.fighters) if (a.hp > 0 && !s.isEnemy(o, a) && a.team !== 'npc' && Math.hypot(a.pos[0] - p.x, a.pos[2] - p.z) < 5) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.03);
        s.vfx('embers', P(p.x, p.y + 0.6, p.z), 6, '#bbf7d0', 0.6, 1.5, 0.07);
      }
      continue;
    }
    if (!t || p.cd > 0) continue;
    const range = still ? p.range : p.kind === 'hawk' ? 2.5 : 2;
    if (bd > range) continue;
    p.cd = p.every;
    const dmg = p.dmg * (p.rend > 0 ? 2 : 1);
    if (still) {
      const pr = s.shoot(o, { skill: 'turret_bolt', speed: 30, life: 0.8, dmg: 0, shape: 'pin', pos: [p.x, p.y + 1.2, p.z], dir: dirTo(p, t), color: '#d6a35c', radius: 0.4 });
      pr.dmg = 0;
      s.later(Math.min(0.5, bd / 30), () => t!.hp > 0 && s.hit(o, t!, dmg, { noScale: true, flinch: true, ranged: true }));
    } else {
      s.hit(o, t, dmg, { noScale: true, flinch: true, knock: p.kind === 'puppet' ? 4 : 1.5 });
      s.vfx('sparkBurst', P(t.pos[0], t.pos[1] + 1, t.pos[2]), 6, p.kind === 'hawk' ? '#f1f5f9' : '#d4d4d8', 3, 0.05);
      if (p.rend > 0) addDot(s, o, t, 15, 3, 'bleed');
    }
  }
  W.pets = W.pets.filter((p) => p.life > 0);
}
function dirTo(p: Pet, t: Fighter): [number, number, number] {
  const dx = t.pos[0] - p.x, dy = t.pos[1] + 1 - (p.y + 1.2), dz = t.pos[2] - p.z, L = Math.hypot(dx, dy, dz) || 1;
  return [dx / L, dy / L, dz / L];
}

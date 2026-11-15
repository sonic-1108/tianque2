// How a humanoid giant (雷彪, 铜人, 法相) moves through each of its blows (owner: the bosses were stiff, every blow the same
// borrowed swing, stretched over the whole warning so nothing ever landed). Each blow takes a clip from the whole house
// library (slam, ground pound, roar, throw, palm push, leap) and plays it on the sim's clock in three beats:
//   wind-up: from the clip's start to its apex while the red mark fills (fast at first, then straining at the top),
//   strike: apex to impact in the last `strike` seconds, landing exactly when the mark ends and the blow is dealt,
//   follow-through: impact to the clip's end.
// Throws and volleys land their impact pose part way (`at`), the rocks or bolts flying the rest of the way. Charges crouch
// then run, leaps crouch then rise in an arc onto the mark, sweeps wind back and turn the whole body round. While it
// stands open (破绽) it drops to a crouch with its hands on the ground, heaving.
import type { Fighter } from '../game/types';

export interface GMotion {
  /** the clip key (GIANT_CLIPS) */
  clip: string;
  /** normalised clip times: start, apex (top of the wind-up), impact, end */
  seg: [number, number, number, number];
  /** seconds from apex to impact */
  strike?: number;
  /** when in the wind-up the impact pose comes (1 = as the mark ends) */
  at?: number;
  /** whole turns of the body through the strike (sweeps) */
  spin?: number;
  /** a leap onto the mark: arc height in body heights */
  leap?: number;
  /** a charge along its line: crouch, then run */
  charge?: boolean;
  /** the wind-up from another clip (a leap gathers in a crouch, then the jump clip's fall and landing) */
  windClip?: string;
  windSeg?: [number, number];
}

/** the clips a giant may borrow: key → names to look for, in order */
export const GIANT_CLIPS: Record<string, { match: string[]; loop?: boolean }> = {
  g_slash: { match: ['slash', 'chop'] },
  g_pound: { match: ['angry_03', 'angry_01'] },
  g_roar: { match: ['angry_01', 'cheer'] },
  g_throw: { match: ['pitch_baseball', 'box_01'] },
  g_push: { match: ['cast_a_spell', 'box_02'] },
  g_leap: { match: ['jump_down', 'jump'] },
  g_crouch: { match: ['box_02', 'box_01'] },
  g_kneel: { match: ['lift_heavy', 'defeat_02'] },
  g_walk: { match: ['walk'], loop: true },
  g_run: { match: ['run'], loop: true },
};
/** where the clips come from (every house clip is on the same Mixamo bones) */
export const GIANT_SOURCES = ['berserker.glb', 'monk.glb'];

const SLAM: GMotion = { clip: 'g_slash', seg: [0.18, 0.3, 0.355, 0.55], strike: 0.24 };
const POUND: GMotion = { clip: 'g_pound', seg: [0.35, 0.45, 0.53, 0.8], strike: 0.26 };
const ROAR: GMotion = { clip: 'g_roar', seg: [0.08, 0.22, 0.4, 0.62], strike: 0.3 };
const THROW: GMotion = { clip: 'g_throw', seg: [0.15, 0.42, 0.49, 0.62], strike: 0.2, at: 0.5 };
const PUSH: GMotion = { clip: 'g_push', seg: [0.25, 0.42, 0.55, 0.8], strike: 0.3 };
const SWEEP: GMotion = { clip: 'g_roar', seg: [0.22, 0.36, 0.42, 0.6], strike: 0.5, spin: 1 };
const CHARGE: GMotion = { clip: 'g_crouch', seg: [0.0, 0.12, 0.18, 0.3], charge: true };
// jump_down starts up on a ledge, so only its fall and landing are used; the gathering crouch is box_02's guard
const LEAP = (h: number): GMotion => ({ clip: 'g_leap', seg: [0.5, 0.55, 0.64, 0.85], strike: 0.7, leap: h, windClip: 'g_crouch', windSeg: [0.0, 0.12] });

export const GIANT_MOTION: Record<string, GMotion> = {
  // 血傀 · 雷彪
  slam: SLAM,
  sweep: SWEEP,
  charge: CHARGE,
  boulders: THROW,
  roar: ROAR,
  pools: POUND,
  quake: LEAP(0.22),
  // 镇阙铜人
  fist: POUND,
  spin: { ...SWEEP, spin: 1.5, strike: 0.6 },
  volley: { ...PUSH, at: 0.5 },
  beam: PUSH,
  bell: ROAR,
  beam2: PUSH,
  drop: LEAP(0.8),
  storm: { ...SWEEP, spin: 2, strike: 0.9 },
  // 天魔法相 · 萧承乾
  sword: SLAM,
  dragon: ROAR,
  thunder: { clip: 'g_roar', seg: [0.05, 0.2, 0.24, 0.45], strike: 0.25 },
  rush: CHARGE,
  coil: { ...PUSH, at: 0.6 },
  awe: POUND,
  swords: PUSH,
  fall: LEAP(1),
  // 覆舟河蛟 (on its hind legs): a raking claw, a tail spun round, the water spat, a whirlpool roared up, a dive, rain
  // called down, three waves pounded out of the river
  jbite: SLAM,
  jtail: { ...SWEEP, spin: 1 },
  spout: PUSH,
  whirl: ROAR,
  dive: LEAP(0.7),
  rain: { clip: 'g_roar', seg: [0.05, 0.2, 0.24, 0.45], strike: 0.25 },
  tide: POUND,
  // 天魔本相
  claw: { ...SWEEP, spin: 1 },
  stomp: POUND,
  meteor: { clip: 'g_roar', seg: [0.05, 0.2, 0.24, 0.45], strike: 0.25 },
  chains: PUSH,
  shades: ROAR,
  cross: PUSH,
  leap: LEAP(1),
  nova: ROAR,
};

/** how long a rush travels before its blow lands (sim and render agree on this) */
export const rushTime = (leap: boolean) => (leap ? 0.7 : 0.55);

const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

export interface GPose {
  key: string;
  /** normalised clip time to show */
  u: number;
  /** extra turn of the whole body (radians) */
  spin: number;
  /** lift off the ground, in body heights */
  lift: number;
  /** lean forward (radians) */
  lean: number;
  /** 0..1: straining at the top of the wind-up (a tremble) */
  strain: number;
  /** a new blow began this frame: blend in from whatever played */
  id: object | null;
}

/** what a giant's body is doing now (null: walk, idle and the rest as usual) */
export function giantPose(f: Fighter, openFor: number): GPose | null {
  const st = (f as any).giant as { move: { m: { id: string; wind: number; rush?: boolean; at: string }; t: number } | null; open: number } | undefined;
  if (!st) return null;
  const mv = st.move;
  if (mv && f.hp > 0) {
    const mo = GIANT_MOTION[mv.m.id];
    if (!mo) return null;
    const W = mv.m.wind, t = mv.t;
    const [s0, s1, s2, s3] = mo.seg;
    const pose: GPose = { key: mo.clip, u: s0, spin: 0, lift: 0, lean: 0, strain: 0, id: mv };
    if (mo.charge) {
      // crouched and gathering, then running flat out along the line as the blow lands
      const R = rushTime(false);
      if (t < W - R) {
        pose.u = s0 + (s1 - s0) * easeOut(Math.min(1, t / Math.max(0.1, W - R)));
        pose.strain = Math.max(0, 1 - (W - R - t) / 0.35);
        pose.lean = 0.12;
      } else if (t < W + 0.15) {
        pose.key = 'g_run';
        pose.u = ((t - (W - R)) / 0.75) % 1;
        pose.lean = 0.38;
      } else {
        pose.u = s2 + (s3 - s2) * Math.min(1, (t - W - 0.15) / 0.5);
        pose.lean = 0.2 * Math.max(0, 1 - (t - W) / 0.5);
      }
      return pose;
    }
    const Ti = (mo.at ?? 1) * W, S = Math.min(mo.strike ?? 0.25, Ti * 0.6), Ts = Ti - S;
    if (t < Ts) {
      const x = t / Ts;
      if (mo.windClip && mo.windSeg) {
        pose.key = mo.windClip;
        pose.u = mo.windSeg[0] + (mo.windSeg[1] - mo.windSeg[0]) * (1 - Math.pow(1 - x, 2.4));
      } else pose.u = s0 + (s1 - s0) * (1 - Math.pow(1 - x, 2.4));
      pose.strain = Math.max(0, 1 - (Ts - t) / 0.35);
    } else if (t < Ti) {
      const x = (t - Ts) / S;
      pose.u = s1 + (s2 - s1) * x * x;
    } else {
      const R = Math.max(0.35, W + 0.6 - Ti);
      pose.u = s2 + (s3 - s2) * easeOut(Math.min(1, (t - Ti) / R));
    }
    if (mo.spin) {
      // wound back through the wind-up, then round in full turns as the strike falls
      const back = -0.7;
      if (t < Ts) pose.spin = back * easeOut(t / Ts);
      else if (t < Ti) {
        const x = (t - Ts) / S;
        pose.spin = back + (mo.spin * Math.PI * 2 - back) * x * x * (3 - 2 * x);
      } else pose.spin = mo.spin * Math.PI * 2;
    }
    if (mo.leap) {
      // up off the ground over the strike (the sim carries it to the mark), down as it lands
      const x = (t - Ts) / S;
      pose.lift = x > 0 && x < 1 ? mo.leap * Math.sin(x * Math.PI) : 0;
    }
    return pose;
  }
  if (st.open > 0 && f.hp > 0) {
    // open: down on its haunches, hands on the ground, heaving
    return { key: 'g_kneel', u: 0.06 + Math.sin(openFor * 1.4) * 0.025, spin: 0, lift: 0, lean: 0.05, strain: 0, id: st };
  }
  return null;
}

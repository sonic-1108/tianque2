// 雪岭 (owner: put the snow mountain's play in): the snowfield in the north-west above 天阙, reached from its camp's
// gate. Up past the snowline the cold gets into you (寒气: a fire, the camp's ginger soup or coming down drives it
// out; full, it slows you and bites at your life, never to death); 天山雪莲 glow on the high snow, picked with F and
// back after a day (孙伯 and the camp buy them); downhill on snow you slide fast; packs of 雪狼 hunt the slopes (your
// blows hurt them, they bite); in the old temple's ice cave waits a mad monk, 冰窟狂僧 · 苦寒, once a day; and the
// summit gives a name to whoever stands on it. Drawn by render/Snow.tsx; the HUD shows the cold.
import type { Sim } from './sim';
import type { Fighter } from './types';
import { DAY_S } from './clock';
import { SNOW_Y, groundHeight } from './world';
import { FOE_KINDS } from './foes';

import { SNOW_CAMP } from './layout';
export { SNOW_CAMP };
/** fires that warm you: the camp's, and two rock shelters up on the snow */
export const SNOW_FIRES: [number, number][] = [
  [SNOW_CAMP.x + 3, SNOW_CAMP.z + 2],
  [-650, -800],
  [-812, -770],
];
export const FIRE_R = 7;
/** where 天山雪莲 grow (picked over the reachable high snow) */
export const LOTUS: [number, number][] = [
  [-818, -890], [-734, -836], [-818, -830], [-620, -830], [-572, -806], [-710, -800], [-608, -776], [-812, -730], [-782, -734], [-662, -734], [-854, -640], [-482, -692],
];
/** the highest ground you can walk to */
export const SUMMIT: [number, number] = [-692, -794];
/** the old temple's ice cave, and where its monk stands */
export const ICE_CAVE = { x: -830, z: -850, rot: 0.6 };
export const MONK_AT: [number, number] = [-822, -843];
/** the snowfield's bounds, for the wolves and the map */
export const inSnowfield = (x: number, z: number) => x < -380 && x > -920 && z < -560 && z > -920;
/** past the snowline (the cold starts a little under the white) */
export const onSnow = (y: number) => y > SNOW_Y - 8;

export interface SnowState {
  cold: number;
  /** ginger soup keeps the cold off until then (worldT) */
  warmUntil: number;
  lotusBack: number[];
  /** the monk's fighter id */
  monk: number;
  /** told the player about the cold once this visit */
  told: boolean;
  /** the warmth you stand in (for the HUD) */
  warm: boolean;
}
export function makeSnow(s: Sim) {
  const S = s as any;
  const kind = FOE_KINDS[2]; // 野和尚's clips and moves
  const f = S.make('sect', kind.house, '冰窟狂僧 · 苦寒', kind.model, 28, MONK_AT[0], MONK_AT[1]) as Fighter;
  const a = f as any;
  a.foeKind = kind;
  a.elite = true;
  a.snowMonk = true;
  f.maxHp = f.hp = Math.round(f.maxHp * 3.2);
  f.home = [MONK_AT[0], MONK_AT[1]];
  f.respawn = undefined;
  const st: SnowState = { cold: 0, warmUntil: 0, lotusBack: LOTUS.map(() => 0), monk: f.id, told: false, warm: false };
  if ((s.progress.done as any)?.monkDay === s.clock.day) {
    f.hp = 0;
    a.benched = true;
  }
  return st;
}

const near = (x: number, z: number, p: number[], r: number) => Math.hypot(x - p[0], z - p[1]) < r;

/** every frame: the cold, the summit, the wolves taking your blows, the monk's day */
export function stepSnow(s: Sim, dt: number) {
  const W = s.snow, p = s.player, D = (s.progress.done ??= {}) as any;
  const x = p.pos[0], z = p.pos[2];
  const outdoors = s.indoor < 0 && p.hp > 0;
  const warm = outdoors && SNOW_FIRES.some((f) => near(x, z, f, FIRE_R));
  W.warm = warm;
  // 寒气
  if (outdoors && onSnow(p.pos[1]) && !warm) {
    let rise = 1.7;
    if (s.clock.night) rise *= 1.5;
    if (s.weather.kind === 'snow' || s.weather.kind === 'storm') rise *= 1.4;
    if (s.worldT < W.warmUntil) rise *= 0.35;
    W.cold = Math.min(100, W.cold + rise * dt);
    if (!W.told) {
      W.told = true;
      s.toast('寒风刺骨。雪线上越待越冷：烤火、喝姜汤，或者下山去暖和暖和。');
    }
  } else W.cold = Math.max(0, W.cold - (warm ? 14 : 5) * dt);
  if (W.cold >= 100 && outdoors) {
    // frostbite: a little life at a time, never the last of it
    p.hp = Math.max(1, p.hp - p.maxHp * 0.012 * dt);
    if (Math.random() < dt * 0.5) s.text(p, '冻僵了', '#bfe8ff');
  }
  if (!onSnow(p.pos[1]) && W.cold < 1) W.told = false;
  // the summit
  if (!D.summit && outdoors && near(x, z, SUMMIT, 7) && p.pos[1] > groundHeight(SUMMIT[0], SUMMIT[1]) - 3) {
    D.summit = 1;
    s.progress.coins = (s.progress.coins ?? 0) + 100;
    (s.progress.titles ??= []).includes('一览众山小') || s.progress.titles!.push('一览众山小');
    s.pushNote({ title: '雪岭之巅', text: '风停了一瞬。\n\n脚下是云，云下是青石村的炊烟、永安城的城墙，和更远处一座悬在崖上的宫殿。\n\n你得了名号「一览众山小」，还在石堆里摸到一个小布包：一百文。' });
    s.chron('你登上了雪岭之巅，一览众山小。');
  }
  // the monk: back the next day
  const m = s.fighters[W.monk] as any;
  if (m) {
    if (m.hp <= 0 && !m.benched && D.monkDay !== s.clock.day) {
      D.monkDay = s.clock.day;
      m.benched = true;
      s.progress.coins = (s.progress.coins ?? 0) + 160;
      const B = (s.progress.bag ??= {}) as any;
      B.xuan = (B.xuan ?? 0) + 2;
      if (!D.monkBeat) {
        D.monkBeat = 1;
        s.pushNote({ title: '寒寺遗窟', text: '苦寒倒在冰上，笑了：「天阙的钟……还在响吗？」\n\n他怀里揣着一卷冻硬的经，经页里夹着一张天阙的旧图。\n\n你得了一百六十文、两块玄铁。他明天还会坐回那块冰上，好像什么都没发生过。' });
        s.chron('你在雪岭的冰窟里打败了狂僧苦寒。');
      } else s.toast('苦寒又倒下了：一百六十文、两块玄铁。');
    }
    if (m.benched && D.monkDay !== s.clock.day) {
      m.benched = false;
      m.hp = m.maxHp;
      m.pos = [MONK_AT[0], groundHeight(MONK_AT[0], MONK_AT[1]), MONK_AT[1]];
    }
  }
  // the wolves feel your blows: a basic swing in its striking moment, or a move just let go, in front within reach
  const swinging = (p.act === 'attack' && p.actT > 0.08 && p.actT < 0.4) || (!!p.run && (p.run.t ?? 0) < 0.7);
  if (swinging) {
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    for (const a of s.animals as any[]) {
      if (a.kind !== 'wolf' || a.dead) continue;
      const dx = a.x - x, dz = a.z - z, d = Math.hypot(dx, dz);
      const reach = p.run ? 4.5 : 3.1;
      if (d > reach || (dx * fx + dz * fz) / (d || 1) < 0.15 || s.time - (a.hitAt ?? -9) < 0.38) continue;
      a.hitAt = s.time;
      a.hp = (a.hp ?? 100) - (p.run ? 55 : 34);
      a.x += (dx / (d || 1)) * 1.3;
      a.z += (dz / (d || 1)) * 1.3;
      a.state = 'flee';
      a.t = 0.6;
      s.vfx('sparkBurst', [a.x, a.y + 0.6, a.z], 10, '#c1121f', 5, 0.07);
      s.text({ pos: [a.x, a.y + 0.8, a.z] } as any, a.hp > 0 ? '嗷！' : '呜……', '#fca5a5');
      if (a.hp <= 0) {
        a.dead = true;
        a.backAt = s.worldT + DAY_S;
        const B = (s.progress.bag ??= {}) as any;
        B.hide = (B.hide ?? 0) + 1;
        s.progress.coins = (s.progress.coins ?? 0) + 8;
        s.toast('打死一头雪狼：兽皮一张，八文。');
      }
    }
  }
  for (const a of s.animals as any[])
    if (a.kind === 'wolf' && a.dead && s.worldT > (a.backAt ?? 0)) {
      a.dead = false;
      a.hp = 100;
      a.x = a.home[0];
      a.z = a.home[1];
    }
}

/** how fast you go on the snow: sliding downhill, stiff with cold */
export function snowSpeed(s: Sim, f: Fighter) {
  const W = s.snow;
  let k = W.cold >= 70 ? 0.8 : 1;
  if (!onSnow(f.pos[1]) || !f.grounded) return k;
  // the slope along where you're going: down it, you slide
  const v = Math.hypot(f.vel[0], f.vel[2]);
  if (v < 1) return k;
  const ux = f.vel[0] / v, uz = f.vel[2] / v;
  const drop = groundHeight(f.pos[0], f.pos[2]) - groundHeight(f.pos[0] + ux * 2, f.pos[2] + uz * 2);
  if (drop > 0.25) {
    const slide = Math.min(0.75, drop * 0.45);
    k *= 1 + slide;
    if (f === s.player && Math.random() < 0.5) s.vfx('dustPuff', [f.pos[0], f.pos[1] + 0.1, f.pos[2]], 2, 0.4, 2.2, 0.7, '#f4f8ff');
  }
  return k;
}

/** a lotus within reach of F */
export function lotusNear(s: Sim): number {
  const p = s.player.pos;
  let best = -1, bd = 2.2;
  LOTUS.forEach(([x, z], i) => {
    if (s.snow.lotusBack[i] > s.worldT) return;
    const d = Math.hypot(x - p[0], z - p[2]);
    if (d < bd) (bd = d), (best = i);
  });
  return best;
}
export function pickLotus(s: Sim, i: number) {
  s.snow.lotusBack[i] = s.worldT + DAY_S;
  const B = (s.progress.bag ??= {}) as any;
  B.lotus = (B.lotus ?? 0) + 1;
  s.toast('采到一朵天山雪莲，花瓣上还挂着冰。（孙伯和雪岭营地的老参客都收）');
}

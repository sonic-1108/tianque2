// The 35 moves, done the way 天阙 1 did them: the same timings, reach, damage, control and effects (its Game.tsx
// executeIntent / resolveAttacks / resolveRanger / resolveMonk / resolveShadow / updateDixian / updateTrader /
// startEmpMove, its CombatData phase tables). Each move is data plus a few small functions the sim calls:
//   cast   when it's pressed (return false if it can't go)
//   tick   every frame while it runs (f.run.id === its id); it ends itself with end(sim, f)
//   move   replaces walking while it runs
//   again  a second press while it runs (burrow out, fold the vest, lower the scope)
//   fire   left click while it runs (the scope fires, the burrow bursts)
//   zoneTick / projHit / land  hooks for its zones, projectiles and landing
// Effects are the old game's VFXSystem calls, sent to the renderer with s.vfx(name, ...args).
// Bandits use the very same moves, so a house fights the way it teaches.
import type { Fighter, Projectile, SectId, Zone } from './types';
import type { Sim } from './sim';
import { WATER_Y, groundHeight, inBuilding } from './world';
import { WORLD_R } from './layout';

export interface SkillDef {
  id: string;
  name: string;
  sect: SectId;
  icon: string;
  desc: string;
  mp: number;
  cd: number;
  aiRange: number; // the AI uses it when the player is this close
  ground?: boolean; // only from the ground
  float?: (s: Sim, f: Fighter) => boolean; // no gravity right now
  fallCap?: number; // falls no faster than this (the vest)
  parallel?: boolean; // runs alongside walking and other acts
  ult?: boolean; // an ultimate: R, held to charge, from level 30
  noCancel?: boolean; // a roll can't cut out of it
  payOnFire?: boolean; // mana and cooldown are spent when it fires, not when it's raised (穿云狙)
  aim?: boolean; // faces where the camera looks while it runs
  cast: (s: Sim, f: Fighter) => boolean;
  tick?: (s: Sim, f: Fighter, dt: number) => void;
  move?: (s: Sim, f: Fighter, wish: [number, number], dt: number) => void;
  again?: (s: Sim, f: Fighter) => boolean;
  fire?: (s: Sim, f: Fighter) => void;
  zoneTick?: (s: Sim, f: Fighter, z: Zone, dt: number) => void;
  projHit?: (s: Sim, f: Fighter, target: Fighter, p: Projectile) => void;
  land?: (s: Sim, f: Fighter) => void;
}

const RUN = 6.8;
const gh = groundHeight;
const P = (x: number, y: number, z: number): [number, number, number] => [x, y, z];
let KEY = 0; // ties a zone to its effect in the renderer (dragon, guards, cage)

/** the old game's side colours, per house: warm for the player, cold for the bandits */
const SIDE: Record<string, [string, string]> = {
  kuangren: ['#ff4a1c', '#3fa9ff'],
  anqi: ['#2dd4bf', '#a78bfa'],
  fanyin: ['#f6c453', '#93c5fd'],
  yingren: ['#22d3ee', '#c084fc'],
  tianzi: ['#ffd36a', '#ffd36a'],
  jiaoyi: ['#9be37a', '#9be37a'],
  dixian: ['#86efac', '#86efac'],
};
const col = (f: Fighter, house: string) => (SIDE[house] ?? ['#fff', '#fff'])[f.team === 'player' ? 0 : 1];

const start = (s: Sim, f: Fighter, id: string, act: Fighter['act'], dur: number, anim: string, data: Record<string, number> = {}) => {
  s.setAct(f, act, dur, anim);
  f.run = { id, t: 0, data };
};
const end = (s: Sim, f: Fighter, recover = 0) => {
  f.run = null;
  if (recover > 0) s.setAct(f, 'cast', recover, f.anim);
  else s.setAct(f, f.grounded ? 'idle' : 'jump', 0, f.grounded ? 'idle' : 'jump');
};
const fwd3 = (s: Sim, f: Fighter) => {
  const [x, z] = s.fwd(f);
  return { x, z };
};
const ahead = (s: Sim, f: Fighter, d: number): [number, number] => {
  const [fx, fz] = s.fwd(f);
  return [f.pos[0] + fx * d, f.pos[2] + fz * d];
};
/** the effects' facing (+Z frame) for a fighter's yaw */
const effYaw = (s: Sim, f: Fighter) => {
  const [fx, fz] = s.fwd(f);
  return Math.atan2(fx, fz);
};
const feet = (f: Fighter) => P(f.pos[0], f.pos[1] + 0.05, f.pos[2]);
const chest = (s: Sim, f: Fighter, d = 0.5) => {
  const [fx, fz] = s.fwd(f);
  return P(f.pos[0] + fx * d, f.pos[1] + 1.2, f.pos[2] + fz * d);
};
/** in front within range and within the half-angle (cos) */
const front = (s: Sim, f: Fighter, range: number, cos = 0.2) => s.inCone(f, range, cos);
const near = (s: Sim, f: Fighter, x: number, z: number, r: number, dy = 2.5, y = f.pos[1]) =>
  s.enemiesOf(f).filter((o) => Math.hypot(o.pos[0] - x, o.pos[2] - z) < r && Math.abs(o.pos[1] - y) < dy);
/** 悬壶: heals on someone under 30% are a fifth stronger */
const mercy = (f: Fighter, n: number) => (f.hp < f.maxHp * 0.3 ? n * 1.2 : n);
/** a heal shown as a green number; returns what it really restored */
const heal = (s: Sim, f: Fighter, n: number) => {
  if (f.hp <= 0) return 0;
  const was = f.hp;
  s.heal(f, Math.round(n));
  return f.hp - was;
};
const title = (s: Sim, f: Fighter, text: string, color: string) => s.addFx({ kind: 'text', x: f.pos[0], y: f.pos[1] + 2.75, z: f.pos[2], max: 1, r: 2, color, text });
const say = (s: Sim, f: Fighter, text: string) => f.team === 'player' && s.text(f, text, '#a3a3a3');

/** 影刃 steps to (x, z) if it's a fair spot: on the map, out of houses and deep water, about level with `refY` */
function shadowTo(s: Sim, f: Fighter, x: number, z: number, refY = f.pos[1]) {
  if (Math.abs(x) > WORLD_R - 25 || Math.abs(z) > WORLD_R - 25) return false;
  const g = gh(x, z);
  if (g > refY + 0.9 || g < refY - 3) return false;
  if (g < WATER_Y - 0.9) return false;
  if (inBuilding(x, g + 1, z, 0.4)) return false;
  f.pos = [x, g, z];
  f.vel = [0, 0, 0];
  f.grounded = true;
  return true;
}
/** a puff of shadow where 影刃 vanishes or appears */
function shadowPuff(s: Sim, x: number, y: number, z: number, color: string) {
  s.vfx('dustPuff', P(x, y + 0.6, z), 14, 0.5, 2.2, 0.8, '#1e1b2e');
  s.vfx('sparkBurst', P(x, y + 1, z), 10, color, 3, 0.05, 'up', 1);
  s.vfx('ring', P(x, y + 0.06, z), 1.3, color, 0.4, 0.08, 0.2);
}

export const SKILLS: Record<string, SkillDef> = {};
const def = (d: SkillDef) => (SKILLS[d.id] = d);

// ================================================================== 狂刃
def({
  id: 'earth_cleave', name: '裂地斩', sect: 'kuangren', icon: '💥', mp: 20, cd: 4.5, aiRange: 4,
  desc: '向前短跃，双刃砸地，裂缝一路喷出火柱：前方 3 米内的敌人受 210 伤害并被击飞。血怒时裂缝持续燃烧 1.6 秒。空中按出是钉地斩：直落砸地，把人钉进土里（160）。霸体。',
  cast: (s, f) => {
    if (!f.grounded) {
      // 钉地斩: straight down, the blow on landing
      start(s, f, 'earth_cleave', 'cast', 0, 'kr_cleave', { air: 1 });
      f.vel = [f.vel[0] * 0.3, -24, f.vel[2] * 0.3];
      f.st.armor = 3;
      return true;
    }
    start(s, f, 'earth_cleave', 'cast', 0.62, 'kr_cleave');
    f.vel[1] = 5.5;
    f.grounded = false;
    f.st.armor = 0.62;
    s.vfx('sound', 'swingHeavy');
    return true;
  },
  move: (s, f, _w, dt) => {
    const r = f.run!;
    if (r.data.air) return;
    const [fx, fz] = s.fwd(f);
    const go = r.t < 0.38 ? 7 : 0;
    f.vel[0] += (fx * go - f.vel[0]) * Math.min(1, 12 * dt);
    f.vel[2] += (fz * go - f.vel[2]) * Math.min(1, 12 * dt);
  },
  tick: (s, f) => {
    const r = f.run!;
    if (r.data.air) {
      if (!f.grounded) s.vfx('embers', P(f.pos[0], f.pos[1] + 0.8, f.pos[2]), 4, col(f, 'kuangren'), 0.3, 4, 0.1);
      if (r.t > 3) end(s, f);
      return;
    }
    if (!r.data.done && r.t >= 0.22) {
      r.data.done = 1;
      const color = col(f, 'kuangren');
      const [fx, fz] = s.fwd(f);
      const ix = f.pos[0] + fx * 1.5, iz = f.pos[2] + fz * 1.5;
      s.vfx('groundSlam', P(ix, gh(ix, iz), iz), 1, color);
      for (let k = 0; k < 4; k++) {
        const px = f.pos[0] + fx * (0.6 + k * 0.75), pz = f.pos[2] + fz * (0.6 + k * 0.75);
        s.later(k * 0.05, () => s.vfx('fireColumn', P(px, gh(px, pz), pz), 1.4 + k * 0.2, color));
      }
      if (f.st.rage > 0) {
        // 血怒: the crack keeps burning
        for (let k = 1; k <= 4; k++)
          s.later(k * 0.4, () => {
            s.vfx('fireColumn', P(ix, gh(ix, iz), iz), 1.2, color);
            if (f.hp > 0) for (const o of near(s, f, ix, iz, 2.3)) s.hit(f, o, 25, { flinch: true, dur: 0.15 });
          });
      }
      s.shake(0.6, f.pos[0], f.pos[2]);
      s.vfx('sound', 'slam');
      for (const o of near(s, f, ix, iz, 3.4)) s.hit(f, o, 210, { heavy: true, crit: true, launch: 9.5, knock: 3, down: 0.9 });
    }
    if (r.t >= 0.62) end(s, f);
  },
  land: (s, f) => {
    const r = f.run!;
    if (!r.data.air) return;
    const color = col(f, 'kuangren');
    const [fx, fz] = s.fwd(f);
    const ix = f.pos[0] + fx * 0.8, iz = f.pos[2] + fz * 0.8;
    s.vfx('groundSlam', P(ix, gh(ix, iz), iz), 0.85, color);
    s.shake(0.55, f.pos[0], f.pos[2]);
    s.vfx('sound', 'slam');
    for (const o of near(s, f, ix, iz, 2.8)) {
      if (s.hit(f, o, 160, { heavy: true, crit: true, bury: 0.5 }) && o.hp > 0) {
        s.vfx('decal', P(o.pos[0], gh(o.pos[0], o.pos[2]), o.pos[2]), 2.2, 1.5);
        s.addFx({ kind: 'text', x: o.pos[0], y: o.pos[1] + 2.4, z: o.pos[2], max: 0.9, r: 2, color: '#fde68a', text: '钉地!' });
      }
    }
    f.st.armor = 0;
    f.vel[0] = f.vel[2] = 0;
    end(s, f, 0.24);
  },
});
def({
  id: 'whirlwind_blade', name: '旋风刃', sect: 'kuangren', icon: '🌀', mp: 25, cd: 7, aiRange: 3,
  desc: '原地高速旋转 1.8 秒，每 0.2 秒伤害身边 2.9 米内的敌人（40）。期间霸体，可以慢速移动追人。血怒时把 4.5 米内的敌人吸过来。',
  cast: (s, f) => {
    start(s, f, 'whirlwind_blade', 'cast', 1.8, 'kr_spin', { last: -1 });
    f.st.armor = 1.8;
    s.vfx('setVortex', true, 1.8, s.slotOf(f));
    s.vfx('dustPuff', P(f.pos[0], gh(f.pos[0], f.pos[2]), f.pos[2]), 18, 1, 3, 0.7);
    s.vfx('sound', 'whirl');
    return true;
  },
  move: (_s, f, wish, dt) => {
    const sp = RUN * 0.4;
    f.vel[0] += (wish[0] * sp - f.vel[0]) * Math.min(1, 8 * dt);
    f.vel[2] += (wish[1] * sp - f.vel[2]) * Math.min(1, 8 * dt);
  },
  tick: (s, f, dt) => {
    const r = f.run!;
    const color = col(f, 'kuangren');
    if (Math.random() < 0.2) s.vfx('dustPuff', P(f.pos[0], gh(f.pos[0], f.pos[2]), f.pos[2]), 1, 1, 2.5, 0.45);
    s.vfx('spiral', P(f.pos[0], f.pos[1], f.pos[2]), 1.3, s.time * 15, color);
    if (f.st.rage > 0)
      for (const o of s.enemiesOf(f)) {
        const d = s.dist(f, o);
        if (d < 4.5 && d > 1.2) {
          o.vel[0] += ((f.pos[0] - o.pos[0]) / d) * 18 * dt;
          o.vel[2] += ((f.pos[2] - o.pos[2]) / d) * 18 * dt;
        }
      }
    // every 0.2 s of the spin itself (not wall-clock time)
    const k = Math.floor((r.t - 0.1) / 0.2);
    if (r.t >= 0.1 && r.t <= 1.55 && k > r.data.last) {
      r.data.last = k;
      s.vfx('ring', P(f.pos[0], gh(f.pos[0], f.pos[2]) + 0.05, f.pos[2]), 1.9, color, 0.25, 0.1);
      for (const o of near(s, f, f.pos[0], f.pos[2], 2.9)) s.hit(f, o, 40, { knock: 1.5, dur: 0.25 });
    }
    if (r.t >= 1.8) {
      s.vfx('setVortex', false, 0, s.slotOf(f));
      end(s, f);
    }
  },
});
def({
  id: 'bull_charge', name: '蛮牛冲', sect: 'kuangren', icon: '🐂', mp: 18, cd: 5.5, aiRange: 9, ground: true,
  desc: '用肩膀向前高速冲撞，撞到的敌人受 170 伤害并被撞飞。撞中后立刻收招，可以马上接别的技能。霸体。',
  cast: (s, f) => {
    start(s, f, 'bull_charge', 'cast', 0.65, 'kr_charge');
    f.st.armor = 0.65;
    s.vfx('dustPuff', P(f.pos[0], gh(f.pos[0], f.pos[2]), f.pos[2]), 14, 0.5, 2.5, 0.6);
    s.vfx('sound', 'charge');
    return true;
  },
  move: (s, f, _w, dt) => {
    const [fx, fz] = s.fwd(f);
    if (f.run!.t < 0.45 && !f.run!.data.hit) {
      f.vel[0] = fx * 20;
      f.vel[2] = fz * 20;
    } else {
      f.vel[0] *= Math.exp(-9 * dt);
      f.vel[2] *= Math.exp(-9 * dt);
    }
  },
  tick: (s, f) => {
    const r = f.run!;
    const color = col(f, 'kuangren');
    const go = r.t < 0.45 && !r.data.hit;
    if (go) {
      const [fx, fz] = s.fwd(f);
      s.vfx('dustPuff', P(f.pos[0], gh(f.pos[0], f.pos[2]), f.pos[2]), 2, 0.3, 1.5, 0.55);
      s.vfx('chargeWave', P(f.pos[0], gh(f.pos[0], f.pos[2]), f.pos[2]), P(fx, 0, fz), color);
      const hits = near(s, f, f.pos[0], f.pos[2], 1.8, 2.2);
      if (hits.length) {
        r.data.hit = 1;
        for (const o of hits) {
          s.hit(f, o, 170, { heavy: true, crit: true, knock: 15, launch: 7, down: 1 });
          s.vfx('ring', P(o.pos[0], gh(o.pos[0], o.pos[2]), o.pos[2]), 2.2, color, 0.4, 0.14, 0.4);
        }
        s.shake(0.55, f.pos[0], f.pos[2]);
        f.vel[0] *= 0.2;
        f.vel[2] *= 0.2;
        // straight into the recovery: a skill can follow at once
        f.st.armor = 0;
        f.run = null;
        s.setAct(f, 'idle', 0, 'idle');
        return;
      }
    }
    if (r.t >= 0.65) end(s, f);
  },
});
def({
  id: 'blood_rage', name: '血怒', sect: 'kuangren', icon: '🩸', mp: 0, cd: 12, aiRange: 4,
  desc: '消耗 10% 当前生命，暴怒 5 秒：普攻出刀快四成，伤害提升两成，每次命中按伤害的 12% 回血，移动加快。',
  cast: (s, f) => {
    f.hp = Math.max(1, f.hp - Math.round(f.hp * 0.1));
    f.st.rage = 5;
    s.setAct(f, 'cast', 0.7, 'kr_roar');
    const red = f.team === 'player' ? '#ff1f1f' : '#1f6bff';
    s.vfx('pillarAt', 1.1, red, s.slotOf(f));
    s.vfx('ring', P(f.pos[0], gh(f.pos[0], f.pos[2]), f.pos[2]), 2.6, f.team === 'player' ? '#ff2a1a' : '#2a8bff', 0.6, 0.14, 0.5);
    s.vfx('embers', P(f.pos[0], f.pos[1] + 0.2, f.pos[2]), 45, f.team === 'player' ? '#ff3b2a' : '#3b8bff', 0.7, 3.5, 0.08);
    s.shake(0.25, f.pos[0], f.pos[2]);
    s.vfx('sound', 'rage');
    if (f.team === 'player') s.vfx('screenFlash', 'rgba(200,20,10,0.35)');
    s.text(f, '血怒!', '#ff3b1f');
    return true;
  },
});
def({
  id: 'heaven_collapse', name: '天崩', sect: 'kuangren', icon: '☄️', mp: 50, cd: 20, aiRange: 6, ult: true,
  desc: '腾空前空翻，化作彗星俯冲砸地：7 米内的敌人受 420 伤害并被击飞，随后环形火柱喷发。无视霸体。霸体。',
  cast: (s, f) => {
    start(s, f, 'heaven_collapse', 'cast', 0, 'kr_ult_air');
    f.vel[1] = 13;
    f.grounded = false;
    f.st.armor = 3;
    s.vfx('ring', P(f.pos[0], gh(f.pos[0], f.pos[2]), f.pos[2]), 2.2, col(f, 'kuangren'), 0.5, 0.12, 0.4);
    s.vfx('dustPuff', P(f.pos[0], gh(f.pos[0], f.pos[2]), f.pos[2]), 20, 0.8, 3.5, 0.8);
    s.vfx('sound', 'ultRise');
    return true;
  },
  move: (s, f) => {
    const r = f.run!;
    const [fx, fz] = s.fwd(f);
    if (!r.data.dive && r.t > 0.55) {
      r.data.dive = 1;
      f.vel = [fx * 6, -34, fz * 6];
      f.anim = 'kr_ult_slam';
    } else if (!r.data.dive) {
      f.vel[0] = fx * 8;
      f.vel[2] = fz * 8;
    }
  },
  tick: (s, f) => {
    const r = f.run!;
    if (!f.grounded) {
      const warm = f.team === 'player' ? '#ff7a2a' : '#5ab0ff';
      s.vfx('embers', P(f.pos[0], f.pos[1] + 0.6, f.pos[2]), r.data.dive ? 14 : 3, warm, 0.4, r.data.dive ? 6 : -1, r.data.dive ? 0.14 : 0.1);
      if (r.data.dive) s.vfx('flash', P(f.pos[0], f.pos[1] + 1, f.pos[2]), f.team === 'player' ? '#ff8a3a' : '#5ab0ff', 18, 0.06, 6);
    }
    if (r.t > 3) end(s, f);
  },
  land: (s, f) => {
    const r = f.run!;
    if (r.t < 0.2) return;
    const [fx, fz] = s.fwd(f);
    const ix = f.pos[0] + fx * 0.8, iz = f.pos[2] + fz * 0.8;
    s.hitstop = Math.max(s.hitstop, 0.3);
    s.shake(1, f.pos[0], f.pos[2]);
    s.vfx('ultimateImpact', P(ix, gh(ix, iz) + 0.3, iz));
    s.vfx('sound', 'ultImpact');
    if (s.dist(f, s.player) < 25) s.vfx('screenFlash', 'rgba(255,240,220,0.75)');
    for (const o of near(s, f, f.pos[0], f.pos[2], 7, 3)) s.hit(f, o, 420, { heavy: true, crit: true, launch: 15, knock: 10, down: 1.2, breakArmor: true });
    f.vel[0] = f.vel[2] = 0;
    f.st.armor = 0.65;
    end(s, f, 0.65);
  },
});

// ================================================================== 暗器
def({
  id: 'boomerang', name: '回旋镖', sect: 'anqi', icon: '🪃', mp: 15, cd: 5, aiRange: 12,
  desc: '掷出大回旋镖，从右边绕一个大圈飞到对手身边再从左边折返，去程和回程都会伤人（85）并把人推开。',
  cast: (s, f) => {
    start(s, f, 'boomerang', 'cast', 0.42, 'aq_boomerang');
    return true;
  },
  tick: (s, f) => {
    const r = f.run!;
    if (!r.data.done && r.t >= 0.12) {
      r.data.done = 1;
      const from = s.hand(f);
      const t = s.nearestEnemy(f, 14, 0.5);
      const [fx, fz] = s.fwd(f);
      const tgt = t ? P(t.pos[0], t.pos[1] + 1.1, t.pos[2]) : P(from[0] + fx * 10, from[1], from[2] + fz * 10);
      let dx = tgt[0] - from[0], dz = tgt[2] - from[2];
      const L = Math.max(3, Math.min(12, Math.hypot(dx, dz)));
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      const T = 0.75 + L * 0.07;
      const g = gh(tgt[0], tgt[2]);
      s.shoot(f, {
        skill: 'boomerang', speed: 18, life: T + 0.5, dmg: 85, knock: 5, hitDur: 0.4, shape: 'boomerang', color: col(f, 'anqi'), pos: from,
        path: { ox: from[0], oz: from[2], fx: dx, fz: dz, sx: dz, sz: -dx, L, W: Math.min(4.2, L * 0.55), y0: from[1], ty: Math.max(g + 0.6, Math.min(g + 7, tgt[1])), u: 0, T, back: false, hitOut: false, hitBack: false },
      });
      s.vfx('ring', P(f.pos[0], f.pos[1] + 0.05, f.pos[2]), 1.2, col(f, 'anqi'), 0.3, 0.08);
      s.vfx('sound', 'throwHeavy');
    }
    if (r.t >= 0.42) end(s, f);
  },
});
def({
  id: 'pin_dart', name: '定身镖', sect: 'anqi', icon: '📌', mp: 20, cd: 9, aiRange: 16,
  desc: '掷出一枚重镖（70 伤害），命中后把对手钉在原地 1.5 秒，期间无法移动（仍可出招）。',
  cast: (s, f) => {
    start(s, f, 'pin_dart', 'cast', 0.36, 'aq_pin');
    return true;
  },
  tick: (s, f) => {
    const r = f.run!;
    if (!r.data.done && r.t >= 0.1) {
      r.data.done = 1;
      const from = s.hand(f);
      s.shoot(f, { skill: 'pin_dart', speed: 42, life: 0.8, dmg: 70, root: 1.5, hitDur: 0.3, knock: 1.2, shape: 'pin', color: col(f, 'anqi'), pos: from, dir: s.aimDir(f, from, s.nearestEnemy(f, 24, 0.8)) });
      s.vfx('flash', from, col(f, 'anqi'), 10, 0.1, 4);
      s.vfx('sound', 'throwHeavy');
    }
    if (r.t >= 0.36) end(s, f);
  },
});
def({
  id: 'swallow_flip', name: '燕返', sect: 'anqi', icon: '🕊️', mp: 15, cd: 6, aiRange: 4,
  desc: '向后空翻跃出一大段距离，翻身时向前方扇形甩出 7 枚飞镖（各 38）。翻身过程中短暂无敌。',
  cast: (s, f) => {
    start(s, f, 'swallow_flip', 'cast', 0.62, 'aq_flip');
    const [fx, fz] = s.fwd(f);
    if (f.st.root <= 0) {
      f.vel[0] = -fx * 17;
      f.vel[2] = -fz * 17;
    }
    f.vel[1] = 7.5;
    f.grounded = false;
    f.st.invuln = Math.max(f.st.invuln, 0.4);
    s.vfx('dustPuff', P(f.pos[0], gh(f.pos[0], f.pos[2]), f.pos[2]), 10, 0.4, 2, 0.5);
    s.vfx('sound', 'dodge');
    return true;
  },
  move: (_s, f, _w, dt) => {
    if (f.grounded) {
      f.vel[0] *= Math.exp(-8 * dt);
      f.vel[2] *= Math.exp(-8 * dt);
    }
  },
  tick: (s, f) => {
    const r = f.run!;
    if (!r.data.done && r.t >= 0.12) {
      r.data.done = 1;
      const from = s.hand(f);
      from[1] = f.pos[1] + 1.2;
      const t = s.nearestEnemy(f, 24, 0.8);
      for (let k = 0; k < 7; k++) s.shoot(f, { skill: 'swallow_flip', speed: 30, life: 0.8, dmg: 38, knock: 2, shape: 'dart', color: col(f, 'anqi'), pos: [...from] as [number, number, number], dir: s.aimDir(f, from, t, (k - 3) * 0.17) });
      s.vfx('sound', 'throwFan');
    }
    if (r.t >= 0.62) end(s, f);
  },
});
/** 穿云狙 fires: a bolt straight down the aim, first body it meets */
function fireSnipe(s: Sim, f: Fighter) {
  const r = f.run!;
  const aimed = r.t;
  const [fx, fz] = s.fwd(f);
  const eye = P(f.pos[0] + fx * 0.3, f.pos[1] + 1.62, f.pos[2] + fz * 0.3);
  // the ground it would hit
  let far = 75;
  for (let d = 0.4; d < far; d += 0.5) if (gh(eye[0] + fx * d, eye[2] + fz * d) > eye[1] + 0.5) {
    far = d;
    break;
  }
  // the first enemy body near the line (no pitch here: anyone a little above or below the sight counts)
  let hit: Fighter | null = null;
  let hd = far;
  for (const o of s.enemiesOf(f)) {
    if (o.act === 'burrow') continue;
    const px = o.pos[0] - eye[0], pz = o.pos[2] - eye[2];
    const along = px * fx + pz * fz;
    if (along < 0 || along > hd) continue;
    const off = Math.abs(px * fz - pz * fx);
    if (off < 0.55 && Math.abs(o.pos[1] + 1 - eye[1]) < 1.5 + along * 0.06) {
      hit = o;
      hd = along;
    }
  }
  const endP = hit ? P(hit.pos[0], hit.pos[1] + 1.2, hit.pos[2]) : P(eye[0] + fx * hd, eye[1], eye[2] + fz * hd);
  s.vfx('tracer', eye, endP);
  s.vfx('flash', eye, '#fff3c4', 30, 0.12, 6);
  s.vfx('sound', 'throwHeavy');
  const sk = SKILLS.snipe;
  f.mp = Math.max(0, f.mp - sk.mp);
  f.cds.snipe = sk.cd;
  f.run = null;
  s.setAct(f, 'cast', 0.45, 'aq_shot');
  if (hit) {
    const full = aimed >= 1.5;
    if (hit.st.invuln > 0) s.text(hit, '闪', '#e5e7eb');
    else {
      s.hit(f, hit, full ? 380 * 1.3 : 380, { heavy: true, crit: full, knock: 5, dur: 0.6, ranged: true });
      s.vfx('sparkBurst', endP, 24, '#fff3c4', 8, 0.07, P(-fx, 0, -fz), 0.8);
      if (full) s.addFx({ kind: 'text', x: hit.pos[0], y: hit.pos[1] + 2.7, z: hit.pos[2], max: 1, r: 2, color: '#fde047', text: '穿云！' });
    }
  } else {
    s.vfx('sparkBurst', endP, 10, '#e5e7eb', 4, 0.05, P(-fx, 0, -fz), 0.8);
    s.vfx('dustPuff', endP, 4, 0.2, 1.2, 0.5);
  }
}
def({
  id: 'snipe', name: '穿云狙', sect: 'anqi', icon: '🎯', mp: 30, cd: 16, aiRange: 26, ground: true, payOnFire: true, aim: true,
  desc: '按一下架起袖中穿云弩，拉近瞄准（站定不动，最多 6 秒）；左键开火，一箭 380 伤害，瞄满 1.5 秒以上必定暴击（×1.3）。再按一次收起不耗法力；开火才耗法力并进入冷却。挨打会被打断。',
  cast: (s, f) => {
    start(s, f, 'snipe', 'channel', 6, 'aq_aim');
    f.vel[0] = f.vel[2] = 0;
    s.vfx('sound', 'click');
    return true;
  },
  tick: (s, f) => {
    const r = f.run!;
    if (Math.random() < 0.4) s.vfx('embers', P(f.pos[0], f.pos[1] + 1.1, f.pos[2]), 1, '#4ade80', 0.3, 1.5, 0.06);
    if (f.team !== 'player') {
      const t = s.player;
      if (t.hp > 0) s.faceTo(f, t.pos[0], t.pos[2]);
      if (r.t > 1.6) return fireSnipe(s, f);
    }
    if (r.t >= 6) end(s, f, 0.2);
  },
  fire: (s, f) => fireSnipe(s, f),
  again: (s, f) => {
    end(s, f, 0.2);
    return true;
  },
});
def({
  id: 'rain_of_darts', name: '暴雨梨花', sect: 'anqi', icon: '🌸', mp: 50, cd: 22, aiRange: 12, ult: true, noCancel: true,
  desc: '纵身跃上半空悬停 2 秒，向下方一大片洒下漫天飞镖（每 0.05 秒一枚，各 18），落点慢慢追着对手走，一半对准对手本人。悬空期间霸体。',
  cast: (s, f) => {
    start(s, f, 'rain_of_darts', 'cast', 2.9, 'aq_rain');
    f.vel = [0, 12, 0];
    f.grounded = false;
    f.st.armor = 2.9;
    const t = s.nearestEnemy(f, 14);
    const [x, z] = t ? [t.pos[0], t.pos[2]] : ahead(s, f, 7);
    f.run!.data.rx = x;
    f.run!.data.rz = z;
    f.run!.data.n = 0;
    s.vfx('ring', P(f.pos[0], gh(f.pos[0], f.pos[2]) + 0.05, f.pos[2]), 2.2, col(f, 'anqi'), 0.5, 0.12, 0.4);
    s.vfx('embers', P(f.pos[0], f.pos[1] + 0.3, f.pos[2]), 30, col(f, 'anqi'), 0.6, 4, 0.08);
    s.vfx('sound', 'fanfare');
    return true;
  },
  float: (_s, f) => f.run!.t > 0.45 && f.run!.t < 2.45,
  move: (_s, f) => {
    f.vel[0] = f.vel[2] = 0;
    const t = f.run!.t;
    if (t > 0.45 && t < 2.45) f.vel[1] = 0;
  },
  tick: (s, f, dt) => {
    const r = f.run!;
    const t = r.t;
    if (t > 0.45 && t < 2.45) {
      const foe = s.nearestEnemy(f, 30);
      if (foe) {
        const k = 1 - Math.exp(-1.6 * dt);
        r.data.rx += (foe.pos[0] - r.data.rx) * k;
        r.data.rz += (foe.pos[2] - r.data.rz) * k;
      }
      const want = Math.floor((t - 0.45) / 0.05) + 1;
      while (r.data.n < want) {
        r.data.n++;
        const focus = !!foe && Math.random() < 0.5;
        const a = Math.random() * Math.PI * 2;
        const rr = focus ? Math.random() * 0.7 : Math.sqrt(Math.random()) * 4;
        const tx = (focus ? foe!.pos[0] : r.data.rx) + Math.cos(a) * rr;
        const tz = (focus ? foe!.pos[2] : r.data.rz) + Math.sin(a) * rr;
        const ty = focus ? foe!.pos[1] + 0.9 : gh(tx, tz);
        const from = P(f.pos[0] + (Math.random() - 0.5) * 0.8, f.pos[1] + 1.3, f.pos[2] + (Math.random() - 0.5) * 0.8);
        const d = Math.hypot(tx - from[0], ty - from[1], tz - from[2]) || 1;
        s.shoot(f, { skill: 'rain_of_darts', speed: 30, life: 0.7, dmg: 18, knock: 0.6, hitDur: 0.16, noStop: true, shape: 'dart', color: col(f, 'anqi'), pos: from, dir: [(tx - from[0]) / d, (ty - from[1]) / d, (tz - from[2]) / d] });
      }
      if (Math.random() < 0.12) s.vfx('ring', P(r.data.rx, gh(r.data.rx, r.data.rz) + 0.05, r.data.rz), 4, col(f, 'anqi'), 0.3, 0.08);
      if (Math.random() < 0.3) s.vfx('embers', P(f.pos[0], f.pos[1] + 1, f.pos[2]), 2, '#f9a8d4', 0.5, -1, 0.07);
    }
    if (t >= 2.9 || (t > 2.5 && f.grounded)) end(s, f);
  },
});

// ================================================================== 梵音
def({
  id: 'vajra_palm', name: '金刚掌', sect: 'fanyin', icon: '✋', mp: 20, cd: 5, aiRange: 4,
  desc: '向前疾冲一步推出金色掌印（160 伤害），把对手震飞一大段。5% 几率暴击：伤害翻倍（320），震得更远。',
  cast: (s, f) => {
    start(s, f, 'vajra_palm', 'cast', 0.7, 'fy_palm');
    s.vfx('sound', 'charge');
    return true;
  },
  move: (s, f, _w, dt) => {
    const r = f.run!;
    const [fx, fz] = s.fwd(f);
    if (r.t > 0.04 && r.t < 0.35 && !r.data.done) {
      f.vel[0] = fx * 17;
      f.vel[2] = fz * 17;
      if (Math.random() < 0.5) s.vfx('dustPuff', P(f.pos[0], gh(f.pos[0], f.pos[2]), f.pos[2]), 2, 0.3, 1.5, 0.5);
    } else {
      f.vel[0] *= Math.exp(-10 * dt);
      f.vel[2] *= Math.exp(-10 * dt);
    }
  },
  tick: (s, f) => {
    const r = f.run!;
    if (!r.data.done && ((r.t >= 0.15 && front(s, f, 2.4).length) || r.t >= 0.35)) {
      r.data.done = 1;
      const [fx, fz] = s.fwd(f);
      const c = chest(s, f);
      s.vfx('palmPush', c, P(fx, 0, fz), 1.5, 4.5);
      s.vfx('chargeWave', P(f.pos[0], gh(f.pos[0], f.pos[2]), f.pos[2]), P(fx, 0, fz), col(f, 'fanyin'));
      s.vfx('flash', c, '#ffd36a', 40, 0.2, 9);
      s.vfx('sound', 'hitHeavy');
      s.shake(0.35, f.pos[0], f.pos[2]);
      for (const o of front(s, f, 3.2)) {
        const crit = Math.random() < 0.05;
        s.hit(f, o, crit ? 320 : 160, { heavy: true, crit, knock: crit ? 22 : 17, dur: crit ? 1 : 0.75 });
        if (crit) {
          s.addFx({ kind: 'text', x: o.pos[0], y: o.pos[1] + 2.7, z: o.pos[2], max: 1, r: 2, color: '#fde047', text: '暴击！' });
          s.vfx('flash', c, '#fff3b0', 70, 0.3, 12);
          s.vfx('ring', P(o.pos[0], o.pos[1] + 1, o.pos[2]), 2.2, '#fde047', 0.4, 0.16, 0.3);
        }
      }
      f.vel[0] *= 0.2;
      f.vel[2] *= 0.2;
    }
    if (r.t >= 0.7) end(s, f);
  },
});
const ZEN_R = 4.5;
def({
  id: 'zen_domain', name: '禅定结界', sect: 'fanyin', icon: '☸️', mp: 25, cd: 11, aiRange: 4,
  desc: '脚下展开半径 4.5 米的金色法阵 5 秒。敌人在阵里移动减速一半；自己站在阵里攻击和防御各提升一成。',
  cast: (s, f) => {
    start(s, f, 'zen_domain', 'cast', 0.5, 'fy_zen');
    return true;
  },
  tick: (s, f) => {
    const r = f.run!;
    if (!r.data.done && r.t >= 0.2) {
      r.data.done = 1;
      const g = gh(f.pos[0], f.pos[2]);
      s.zone(f, 'zen_domain', f.pos[0], f.pos[2], ZEN_R, 5, '#f5b942');
      s.vfx('zenField', P(f.pos[0], g, f.pos[2]), ZEN_R, 5, s.slotOf(f));
      s.vfx('ring', P(f.pos[0], g + 0.05, f.pos[2]), ZEN_R, col(f, 'fanyin'), 0.6, 0.12, 0.25);
      s.vfx('dustPuff', P(f.pos[0], g + 0.05, f.pos[2]), 14, 1.5, 3, 0.7);
      s.vfx('sound', 'slam');
      s.shake(0.2, f.pos[0], f.pos[2]);
    }
    if (r.t >= 0.5) end(s, f);
  },
  zoneTick: (s, f, z, dt) => {
    for (const o of near(s, f, z.x, z.z, z.r, 2.5, z.y)) (o as any).spdMul = Math.min((o as any).spdMul ?? 1, 0.5);
    if (Math.hypot(f.pos[0] - z.x, f.pos[2] - z.z) < z.r && f.pos[1] - z.y < 2.5) f.st.buffAtk = Math.max(f.st.buffAtk, 0.15);
    if (Math.random() < dt * 6) {
      const a = Math.random() * Math.PI * 2, rr = Math.random() * z.r;
      const x = z.x + Math.cos(a) * rr, zz = z.z + Math.sin(a) * rr;
      s.vfx('embers', P(x, gh(x, zz) + 0.1, zz), 1, '#ffd36a', 0.1, 1.6, 0.06);
    }
  },
});
def({
  id: 'six_syllable_mantra', name: '六字真言', sect: 'fanyin', icon: '🕉️', mp: 25, cd: 9, aiRange: 10,
  desc: '合掌一念，身边先震出一圈音波（40 伤害，打断施法），随后唵嘛呢叭咪吽六个金字依次飞出，追向 10 米内血最少的敌人。前五字各 32 伤害；最后的「吽」无视霸体，90 伤害并封印对手 2.2 秒，期间放不了任何技能。翻滚可以躲字。',
  cast: (s, f) => {
    start(s, f, 'six_syllable_mantra', 'channel', 0.85, 'fy_chant', { n: 0, tgt: -1 });
    s.vfx('sound', 'chime');
    return true;
  },
  tick: (s, f, dt) => {
    const r = f.run!;
    f.vel[0] *= Math.exp(-10 * dt);
    f.vel[2] *= Math.exp(-10 * dt);
    if (r.t < 0.25 && Math.random() < 0.6) s.vfx('embers', P(f.pos[0], f.pos[1] + 1.4, f.pos[2]), 2, '#ffe9a8', 0.5, 1.2, 0.07);
    if (r.t >= 0.25 && !r.data.burst) {
      r.data.burst = 1;
      s.vfx('ring', P(f.pos[0], f.pos[1] + 0.05, f.pos[2]), 2.8, '#ffe9a8', 0.4, 0.18, 0.15);
      s.vfx('flash', P(f.pos[0], f.pos[1] + 1.4, f.pos[2]), '#ffe2a0', 40, 0.2, 8);
      s.vfx('sound', 'gong');
      s.shake(0.2, f.pos[0], f.pos[2]);
      for (const o of near(s, f, f.pos[0], f.pos[2], 2.8)) {
        const casting = o.act === 'cast' || o.act === 'channel';
        s.hit(f, o, 40, { knock: 5, dur: 0.45, breakArmor: true });
        if (casting && o.act === 'hit') s.addFx({ kind: 'text', x: o.pos[0], y: o.pos[1] + 2.5, z: o.pos[2], max: 0.9, r: 2, color: '#fde68a', text: '打断!' });
      }
    }
    const n = r.data.n;
    if (n < 6 && r.t >= 0.29 + n * 0.085) {
      r.data.n = n + 1;
      if (n === 0) {
        // locks on to the weakest enemy within 10 m
        let best: Fighter | null = null;
        for (const o of s.enemiesOf(f)) {
          if (Math.hypot(o.pos[0] - f.pos[0], o.pos[1] - f.pos[1], o.pos[2] - f.pos[2]) > 10) continue;
          if (!best || o.hp < best.hp) best = o;
        }
        r.data.tgt = best ? best.id : -1;
        if (best) s.vfx('ring', P(best.pos[0], best.pos[1] + 0.05, best.pos[2]), 1.2, '#fde68a', 0.5, 0.1, 0.2);
      }
      // the syllables fan out behind and round him like a halo, then hunt
      const [fx, fz] = s.fwd(f);
      const sx = -fz, sz = fx;
      const ang = (n - 2.5) * 0.55;
      const from = P(f.pos[0] + sx * Math.sin(ang) * 1.1 - fx * 0.3, f.pos[1] + 2 + Math.cos(ang) * 0.35, f.pos[2] + sz * Math.sin(ang) * 1.1 - fz * 0.3);
      const vel = [sx * Math.sin(ang) * 6 + fx * 2.5, 2.2 + Math.cos(ang) * 1.5, sz * Math.sin(ang) * 6 + fz * 2.5];
      const sp = Math.hypot(vel[0], vel[1], vel[2]);
      s.shoot(f, { skill: 'six_syllable_mantra', speed: sp, dir: [vel[0] / sp, vel[1] / sp, vel[2] / sp], life: 2.5, dmg: 0, shape: 'glyph', glyph: n, target: r.data.tgt >= 0 ? r.data.tgt : undefined, color: '#ffd36a', pos: from });
      if (n === 0 || n === 5) s.vfx('sound', 'chime');
      if (n === 5) s.addFx({ kind: 'text', x: f.pos[0], y: f.pos[1] + 2.8, z: f.pos[2], max: 1, r: 2, color: '#fde68a', text: '唵嘛呢叭咪吽' });
    }
    if (r.t >= 0.85) end(s, f);
  },
});
def({
  id: 'golden_bell_shield', name: '金钟罩', sect: 'fanyin', icon: '🔔', mp: 30, cd: 14, aiRange: 3,
  desc: '金钟罩身 4 秒：受到的伤害降低 65%，不会被打断，近身打你的人会被反震三成伤害；万佛朝宗的掌印拍不进金钟罩。罩子散去时有半秒气竭。',
  cast: (s, f) => {
    s.setAct(f, 'cast', 0.45, 'fy_bell');
    f.st.shield = 4;
    s.vfx('bell', 4, s.slotOf(f));
    s.vfx('ring', P(f.pos[0], f.pos[1] + 0.05, f.pos[2]), 2.2, col(f, 'fanyin'), 0.5, 0.14, 0.4);
    s.vfx('embers', P(f.pos[0], f.pos[1] + 0.3, f.pos[2]), 30, '#ffd36a', 0.9, 3, 0.08);
    s.vfx('sound', 'gong');
    s.shake(0.15, f.pos[0], f.pos[2]);
    return true;
  },
});
def({
  id: 'ten_thousand_buddhas', name: '万佛朝宗', sect: 'fanyin', icon: '🧘', mp: 60, cd: 24, aiRange: 14, ult: true, noCancel: true,
  desc: '盘坐结印，身后浮现金佛法相，九道巨大掌印从天而降追着对手拍下（各 52），最后一掌 190 伤害把人拍倒。施法期间霸体。',
  cast: (s, f) => {
    start(s, f, 'ten_thousand_buddhas', 'channel', 2.6, 'fy_ult', { n: 0 });
    f.st.armor = 2.6;
    f.vel[0] = f.vel[2] = 0;
    const [fx, fz] = s.fwd(f);
    s.vfx('buddha', P(f.pos[0] - fx * 3.2, f.pos[1] + 4.6, f.pos[2] - fz * 3.2), 3);
    s.vfx('ring', P(f.pos[0], f.pos[1] + 0.05, f.pos[2]), 3.2, col(f, 'fanyin'), 0.7, 0.16, 0.5);
    s.vfx('pillarAt', 2.6, '#ffc94a', s.slotOf(f));
    s.vfx('sound', 'ultRise');
    s.vfx('sound', 'gong');
    return true;
  },
  tick: (s, f) => {
    const r = f.run!;
    f.vel[0] = f.vel[2] = 0;
    const n = r.data.n;
    if (n < 9 && r.t >= 0.45 + n * 0.19) {
      r.data.n = n + 1;
      const last = n === 8;
      const foe = s.nearestEnemy(f, 20);
      const lead = last ? 0 : 0.25;
      const bx = foe ? foe.pos[0] + foe.vel[0] * lead : ahead(s, f, 6)[0];
      const bz = foe ? foe.pos[2] + foe.vel[2] * lead : ahead(s, f, 6)[1];
      const tx = bx + (last ? 0 : (Math.random() - 0.5) * 1.6);
      const tz = bz + (last ? 0 : (Math.random() - 0.5) * 1.6);
      const ty = gh(tx, tz);
      const covered = inBuilding(tx, ty + 1.2, tz);
      const color = col(f, 'fanyin');
      s.vfx('palmStrike', P(tx, ty, tz), last ? 1.6 : 1.0, 0.32);
      s.later(0.32, () => {
        s.vfx('ring', P(tx, ty + 0.05, tz), last ? 4 : 2.6, color, 0.4, 0.16, 0.3);
        s.vfx('dustPuff', P(tx, ty, tz), last ? 24 : 10, last ? 1.6 : 1, 3, 0.8);
        if (last) s.vfx('rocks', P(tx, ty, tz), 12, 7, 0.12);
        s.vfx('sound', 'slam');
        s.shake(last ? 0.7 : 0.18, tx, tz);
        if (f.hp <= 0 || covered) return;
        const hitR = last ? 3.4 : 2.6;
        for (const o of near(s, f, tx, tz, hitR, 3, ty)) {
          if (o.st.shield > 0) {
            // 金钟罩 holds against the falling palms
            s.addFx({ kind: 'text', x: o.pos[0], y: o.pos[1] + 2.6, z: o.pos[2], max: 0.9, r: 2, color: '#fde68a', text: last ? '金钟罩挡下' : '挡' });
            s.vfx('ring', P(o.pos[0], o.pos[1] + 1.2, o.pos[2]), 1.4, '#fde68a', 0.3, 0.12, 0.2);
            continue;
          }
          if (last) s.hit(f, o, 190, { heavy: true, crit: true, knock: 4, launch: 6, down: 1.1, breakArmor: true });
          else s.hit(f, o, 52, { knock: 1.2, dur: 0.3 });
        }
        if (last && Math.hypot(tx - s.player.pos[0], tz - s.player.pos[2]) < 25) s.vfx('screenFlash', 'rgba(255,225,150,0.5)');
      });
    }
    if (r.t >= 2.6) end(s, f);
  },
});

// ================================================================== 影刃
def({
  id: 'shadow_step', name: '瞬影', sect: 'yingren', icon: '👤', mp: 15, cd: 7, aiRange: 10,
  desc: '化作一道影子瞬移到 10 米内对手的身后（否则向前闪出 7 米），2.5 秒内的下一击必定暴击。',
  cast: (s, f) => {
    const x0 = f.pos[0], y0 = f.pos[1], z0 = f.pos[2];
    let moved = false;
    const t = s.nearestEnemy(f, 10);
    if (t && Math.abs(t.pos[1] - f.pos[1]) < 4) {
      const [tx, tz] = s.fwd(t);
      moved =
        shadowTo(s, f, t.pos[0] - tx * 1.3, t.pos[2] - tz * 1.3, t.pos[1]) ||
        shadowTo(s, f, t.pos[0] + tz * 1.3, t.pos[2] - tx * 1.3, t.pos[1]) ||
        shadowTo(s, f, t.pos[0] - tz * 1.3, t.pos[2] + tx * 1.3, t.pos[1]) ||
        shadowTo(s, f, t.pos[0] + tx * 1.3, t.pos[2] + tz * 1.3, t.pos[1]);
      if (moved) s.faceTo(f, t.pos[0], t.pos[2]);
    }
    if (!moved) {
      const [fx, fz] = s.fwd(f);
      for (let d = 7; d >= 2 && !moved; d -= 1) moved = shadowTo(s, f, f.pos[0] + fx * d, f.pos[2] + fz * d);
    }
    f.st.crit = 2.5;
    start(s, f, 'shadow_step', 'cast', 0.42, 'yr_step');
    f.run = null;
    const color = col(f, 'yingren');
    shadowPuff(s, x0, y0, z0, color);
    shadowPuff(s, f.pos[0], f.pos[1], f.pos[2], color);
    s.vfx('sound', 'dodge');
    return true;
  },
});
def({
  id: 'fan_knives', name: '飞刀', sect: 'yingren', icon: '🔪', mp: 15, cd: 5, aiRange: 9,
  desc: '连甩五把飞刀，扇形飞出后拐弯追向对手，每把 58 伤害并打断。只要有一把命中，瞬影的冷却立刻刷新。出刀时可以慢慢走。',
  cast: (s, f) => {
    start(s, f, 'fan_knives', 'cast', 0.45, 'yr_knives', { n: 0, tgt: s.nearestEnemy(f, 24, 0.3)?.id ?? -1 });
    return true;
  },
  move: (_s, f, wish, dt) => {
    const sp = RUN * 0.3;
    f.vel[0] += (wish[0] * sp - f.vel[0]) * Math.min(1, 8 * dt);
    f.vel[2] += (wish[1] * sp - f.vel[2]) * Math.min(1, 8 * dt);
  },
  tick: (s, f) => {
    const r = f.run!;
    if (r.t >= 0.14) {
      const due = Math.min(5, 1 + Math.floor((r.t - 0.14) / 0.05));
      const t = r.data.tgt >= 0 ? s.fighters[r.data.tgt] : null;
      while (r.data.n < due) {
        const k = r.data.n++;
        const [fx, fz] = s.fwd(f);
        const from = P(f.pos[0] + fx * 0.5, f.pos[1] + 1.3, f.pos[2] + fz * 0.5);
        s.shoot(f, { skill: 'fan_knives', speed: 30, life: 1.1, dmg: 58, knock: 1.5, hitDur: 0.28, onHit: 'stagger', homing: 7, target: t?.id, shape: 'knife', color: col(f, 'yingren'), pos: from, dir: s.aimDir(f, from, t, (k - 2) * 0.22) });
        s.vfx('sound', 'swingLight');
      }
    }
    if (r.t >= 0.45) end(s, f);
  },
  projHit: (s, f) => {
    if ((f.cds.shadow_step ?? 0) > 0) {
      f.cds.shadow_step = 0;
      if (f.team === 'player') s.text(f, '瞬影刷新', '#67e8f9');
    }
  },
});
/** 遁地 ends: burst out of the ground, flinging anyone close into the air */
function burstOut(s: Sim, f: Fighter) {
  const g = gh(f.pos[0], f.pos[2]);
  f.pos[1] = Math.max(f.pos[1], g);
  f.run = null;
  f.st.invuln = 0;
  f.grounded = false;
  f.vel = [0, 9, 0];
  s.setAct(f, 'jump', 0, 'jump');
  f.st.crit = 2;
  const color = col(f, 'yingren');
  s.vfx('rocks', P(f.pos[0], g, f.pos[2]), 14, 9, 0.14);
  s.vfx('groundSlam', P(f.pos[0], g, f.pos[2]), 0.7, color);
  s.vfx('dustPuff', P(f.pos[0], g + 0.2, f.pos[2]), 22, 1, 3.5, 0.9, '#6b5a40');
  s.vfx('sound', 'slam');
  s.shake(0.35, f.pos[0], f.pos[2]);
  for (const o of near(s, f, f.pos[0], f.pos[2], 2.6, 1.5, g)) s.hit(f, o, 130, { heavy: true, launch: 7, knock: 2, down: 0.9 });
}
def({
  id: 'burrow', name: '遁地', sect: 'yingren', icon: '⛰️', mp: 20, cd: 10, aiRange: 7, ground: true,
  desc: '蹲身钻进地里，最多潜行 2.2 秒：打不中、移速提高 35%，地面只留下一道翻起的土痕。再按一次或左键（或时间到）破土而出，把身边 2.6 米内的对手挑飞（130），下一击必定暴击。',
  cast: (s, f) => {
    const g = gh(f.pos[0], f.pos[2]);
    if (g < WATER_Y - 0.5) {
      say(s, f, '水里遁不了地');
      return false;
    }
    start(s, f, 'burrow', 'burrow', 0, 'burrow');
    f.st.invuln = Math.max(f.st.invuln, 0.3);
    s.vfx('dustPuff', P(f.pos[0], g + 0.1, f.pos[2]), 18, 0.7, 2.5, 0.8, '#6b5a40');
    s.vfx('rocks', P(f.pos[0], g, f.pos[2]), 6, 4, 0.1);
    s.vfx('ring', P(f.pos[0], g + 0.05, f.pos[2]), 1.4, col(f, 'yingren'), 0.4, 0.1, 0.2);
    s.vfx('sound', 'slam');
    return true;
  },
  move: (_s, f, wish, dt) => {
    const sp = RUN * 1.35;
    f.vel[0] += (wish[0] * sp - f.vel[0]) * Math.min(1, 10 * dt);
    f.vel[2] += (wish[1] * sp - f.vel[2]) * Math.min(1, 10 * dt);
    if (Math.hypot(wish[0], wish[1]) > 0.1) f.yaw = Math.atan2(-wish[0], -wish[1]);
  },
  tick: (s, f) => {
    if (Math.random() < 0.6) s.vfx('dustPuff', P(f.pos[0], gh(f.pos[0], f.pos[2]) + 0.05, f.pos[2]), 2, 0.3, 1.2, 0.5, '#6b5a40');
    // the AI comes up under the player
    if (f.team !== 'player' && s.dist(f, s.player) < 1.8) return burstOut(s, f);
    if (f.run!.t >= 2.2) burstOut(s, f);
  },
  again: (s, f) => {
    burstOut(s, f);
    return true;
  },
  fire: (s, f) => burstOut(s, f),
});
def({
  id: 'chain_hook', name: '锁链钩', sect: 'yingren', icon: '⛓️', mp: 20, cd: 9, aiRange: 12,
  desc: '甩出腰间的铁链，钩住正前方 13 米内的对手，把他拽到身前并定住 0.8 秒（40 伤害）。接普攻或千影杀。',
  cast: (s, f) => {
    s.setAct(f, 'cast', 0.4, 'yr_chain');
    const [fx, fz] = s.fwd(f);
    let caught: Fighter | null = null;
    let best = 99;
    for (const o of s.enemiesOf(f)) {
      if (Math.abs(o.pos[1] - f.pos[1]) > 4 || o.act === 'burrow') continue;
      const along = fx * (o.pos[0] - f.pos[0]) + fz * (o.pos[2] - f.pos[2]);
      const across = Math.abs(fx * (o.pos[2] - f.pos[2]) - fz * (o.pos[0] - f.pos[0]));
      if (along > 0.5 && along < 13 && across < Math.max(1.6, along * 0.7) && along < best) {
        best = along;
        caught = o;
      }
    }
    const hand = P(f.pos[0] + fx * 0.4, f.pos[1] + 1.25, f.pos[2] + fz * 0.4);
    const endP = caught ? P(caught.pos[0], caught.pos[1] + 1.1, caught.pos[2]) : P(hand[0] + fx * 13, hand[1], hand[2] + fz * 13);
    if (caught) s.faceTo(f, caught.pos[0], caught.pos[2]);
    s.vfx('chain', hand, endP, caught ? 0.6 : 0.5);
    if (caught) {
      const [gx, gz] = s.fwd(f);
      if (!(caught as any).boss) caught.pull = { x: f.pos[0] + gx * 1.4, z: f.pos[2] + gz * 1.4, t: 0.5 };
      s.hit(f, caught, 40, { dur: 0.8, root: 0.8 });
      s.vfx('ring', P(caught.pos[0], caught.pos[1] + 1, caught.pos[2]), 0.9, '#d1d5db', 0.3, 0.08, 0.2);
      s.addFx({ kind: 'text', x: caught.pos[0], y: caught.pos[1] + 2.3, z: caught.pos[2], max: 0.9, r: 2, color: '#e5e7eb', text: '钩!' });
      s.vfx('sound', 'hitHeavy');
    } else s.vfx('sound', 'swingLight');
    return true;
  },
});
def({
  id: 'thousand_shadows', name: '千影杀', sect: 'yingren', icon: '🌑', mp: 55, cd: 22, aiRange: 10, ult: true, noCancel: true,
  desc: '锁定 12 米内的对手，化作六道残影从四面八方连续穿刺（各 44），最后一击重斩把人打倒（170）。施放期间无敌。',
  cast: (s, f) => {
    const t = s.nearestEnemy(f, 12);
    start(s, f, 'thousand_shadows', 'cast', 2.2, 'yr_ult', { tgt: t && Math.abs(t.pos[1] - f.pos[1]) < 4 ? t.id : -1, hits: 0 });
    f.st.invuln = Math.max(f.st.invuln, 2.2);
    const color = col(f, 'yingren');
    shadowPuff(s, f.pos[0], f.pos[1], f.pos[2], color);
    s.vfx('ring', P(f.pos[0], f.pos[1] + 0.06, f.pos[2]), 3, color, 0.6, 0.14, 0.4);
    s.vfx('sound', 'ultRise');
    s.shake(0.2, f.pos[0], f.pos[2]);
    return true;
  },
  move: (_s, f) => {
    f.vel[0] = f.vel[2] = 0;
  },
  tick: (s, f) => {
    const r = f.run!;
    const color = col(f, 'yingren');
    const t = r.data.tgt >= 0 ? s.fighters[r.data.tgt] : null;
    if (!t) {
      // nobody in reach: one dashing cut forward
      if (r.t > 0.3 && !r.data.done) {
        r.data.done = 1;
        const [fx, fz] = s.fwd(f);
        shadowTo(s, f, f.pos[0] + fx * 6, f.pos[2] + fz * 6);
        s.vfx('slashMark', chest(s, f, 0.6), color, 1.6);
        r.t = Math.max(r.t, 1.9);
      }
    } else {
      const k = Math.floor((r.t - 0.3) / 0.24);
      const hits = r.data.hits;
      if (r.t >= 0.3 && k >= hits && hits < 6 && t.hp > 0) {
        const a = hits * 2.4 + 0.7;
        const x0 = f.pos[0], y0 = f.pos[1], z0 = f.pos[2];
        let ok = false;
        for (let j = 0; j < 8 && !ok; j++) ok = shadowTo(s, f, t.pos[0] + Math.cos(a + j * 0.8) * 1.6, t.pos[2] + Math.sin(a + j * 0.8) * 1.6, t.pos[1]);
        s.faceTo(f, t.pos[0], t.pos[2]);
        s.vfx('dustPuff', P(x0, y0 + 0.9, z0), 6, 0.4, 1.2, 0.7, '#1e1b2e');
        s.vfx('slashMark', chest(s, f, 0.8), color, 1.4);
        s.hit(f, t, 44, { dur: 0.45 });
        s.vfx('sound', 'swingLight');
        r.data.hits = hits + 1;
      }
      if (r.data.hits >= 6 && r.t >= 1.8 && !r.data.done) {
        r.data.done = 1;
        if (t.hp > 0) s.faceTo(f, t.pos[0], t.pos[2]);
        s.vfx('flash', chest(s, f, 0.6), color, 40, 0.2, 8);
        s.vfx('slashMark', chest(s, f, 0.6), color, 2.2);
        if (t.hp > 0 && s.dist(f, t) < 3.5) s.hit(f, t, 170, { heavy: true, crit: true, knock: 9, launch: 3, down: 0.9 });
        s.vfx('sound', 'hitHeavy');
      }
    }
    if (r.t >= 2.2) end(s, f);
  },
});

// ================================================================== 天子
const EMP = {
  edict: { wind: 0.25, r: 7.5, half: 0.62, dmg: 70, kneel: 1.3 },
  charge: { dur: 0.9, dmg: 100, reach: 1.4 },
  cage: { wind: 0.25, half: 2.7, dur: 3, dmg: 50, range: 14 },
  seal: { fall: 0.6, r: 2.4, dmg: 150, stun: 1.1, range: 18 },
  dragon: { dmg: 400, r: 3.4, rise: 0.9, dive: 0.6 },
};
/** 御林冲阵: each guardsman's place in the line (sideways, back) */
const GUARD_SLOTS: [number, number][] = [
  [0, 0],
  [-1.3, -0.9],
  [1.3, -0.9],
  [-2.6, -1.8],
  [2.6, -1.8],
];
def({
  id: 'edict', name: '金口玉言', sect: 'tianzi', icon: '📜', mp: 25, cd: 9, aiRange: 6,
  desc: '一卷圣旨在头顶展开，金色的「跪」字朝前方飞出（7.5 米扇形）。被打中的人受 70 伤害，跪下 1.3 秒：不能移动，也放不了技能。',
  cast: (s, f) => {
    const t = s.nearestEnemy(f, 9);
    if (t) s.faceTo(f, t.pos[0], t.pos[2]);
    start(s, f, 'edict', 'cast', 0.75, 'tz_edict');
    s.vfx('emp.edict', P(f.pos[0], f.pos[1], f.pos[2]), effYaw(s, f));
    s.vfx('flash', P(f.pos[0], f.pos[1] + 2.6, f.pos[2]), '#ffd36a', 50, 0.5, 8);
    s.vfx('sound', 'gong');
    return true;
  },
  tick: (s, f) => {
    const r = f.run!;
    if (!r.data.done && r.t >= EMP.edict.wind) {
      r.data.done = 1;
      s.shake(0.2, f.pos[0], f.pos[2]);
      for (const o of front(s, f, EMP.edict.r, Math.cos(EMP.edict.half))) {
        if (Math.abs(o.pos[1] - f.pos[1]) > 2.4) continue;
        s.hit(f, o, EMP.edict.dmg, { dur: 0.35, knock: 0.5, kneel: EMP.edict.kneel });
        o.vel[0] = o.vel[2] = 0;
        s.addFx({ kind: 'text', x: o.pos[0], y: o.pos[1] + 2.4, z: o.pos[2], max: 1, r: 2, color: '#ffd36a', text: '跪' });
        s.vfx('ring', feet(o), 1.1, '#ffd36a', EMP.edict.kneel, 0.12, 0.25);
      }
    }
    if (r.t >= 0.75) end(s, f);
  },
});
def({
  id: 'phantom_guard', name: '御林冲阵', sect: 'tianzi', icon: '🛡️', mp: 30, cd: 12, aiRange: 12,
  desc: '举手一招，五名金色的御林军虚影持枪从身后冲出，向前冲锋 17 米，路上的人被撞飞（每人 100 伤害，每个人只被撞一次）。冲锋时你已经可以行动。',
  cast: (s, f) => {
    const t = s.nearestEnemy(f, 18);
    if (t) s.faceTo(f, t.pos[0], t.pos[2]);
    s.setAct(f, 'cast', 0.6, 'tz_guard');
    const key = KEY++;
    const z = s.zone(f, 'phantom_guard', f.pos[0], f.pos[2], 1, EMP.charge.dur + 0.05, '#ffd36a');
    z.y = f.pos[1];
    z.data = { key, yaw: effYaw(s, f), stop: [1e9, 1e9, 1e9, 1e9, 1e9], ys: [f.pos[1], f.pos[1], f.pos[1], f.pos[1], f.pos[1]], hit: [] };
    s.vfx('emp.charge', key, P(f.pos[0], f.pos[1], f.pos[2]), z.data.yaw, EMP.charge.dur);
    s.addFx({ kind: 'text', x: f.pos[0], y: f.pos[1] + 2.8, z: f.pos[2], max: 1, r: 2, color: '#ffd36a', text: '御林军！' });
    s.vfx('sound', 'gong');
    s.shake(0.15, f.pos[0], f.pos[2]);
    return true;
  },
  zoneTick: (s, f, z) => {
    const D = z.data;
    const fx = Math.sin(D.yaw), fz = Math.cos(D.yaw);
    for (let g = 0; g < 5; g++) {
      const [lat, back] = GUARD_SLOTS[g];
      const want = -2.2 + back + Math.min(1, z.age / EMP.charge.dur) * 17;
      const along = Math.min(D.stop[g], want);
      const x = z.x + fx * along + fz * lat;
      const zz = z.z + fz * along - fx * lat;
      if (D.stop[g] > 1e8) {
        // he runs over the ground; a house or a cliff face stops him
        const gy = gh(x, zz);
        if (gy > D.ys[g] + 1.0 || inBuilding(x, gy + 1, zz)) {
          D.stop[g] = along;
          s.vfx('emp.stopGuard', D.key, g, along);
          continue;
        }
        D.ys[g] = Math.max(gy, D.ys[g] - 0.5);
      } else continue;
      for (const o of s.enemiesOf(f)) {
        if (D.hit.includes(o.id) || Math.hypot(o.pos[0] - x, o.pos[2] - zz) > EMP.charge.reach || Math.abs(o.pos[1] - D.ys[g]) > 2.2) continue;
        D.hit.push(o.id);
        s.hit(f, o, EMP.charge.dmg, { heavy: true, knock: 11, launch: 4, down: 0.75, fromX: x - fx, fromZ: zz - fz });
        s.vfx('sparkBurst', P(o.pos[0], o.pos[1] + 1.1, o.pos[2]), 24, '#ffd36a', 8, 0.1, 'up', 1.2);
      }
    }
  },
});
def({
  id: 'jade_seal', name: '玉玺镇压', sect: 'tianzi', icon: '🟩', mp: 25, cd: 10, aiRange: 16,
  desc: '一跺脚，一方巨大的传国玉玺从天而降，砸在 18 米内对手的脚下：地上先亮金圈，0.6 秒后落地，150 伤害并击倒 1.1 秒，地上留下「受命于天」的印文。',
  cast: (s, f) => {
    const t = s.nearestEnemy(f, EMP.seal.range);
    const [x, z] = t ? [t.pos[0], t.pos[2]] : ahead(s, f, 7);
    if (t) s.faceTo(f, x, z);
    s.setAct(f, 'cast', 0.8, 'tz_seal');
    const zn = s.zone(f, 'jade_seal', x, z, EMP.seal.r, EMP.seal.fall + 0.05, '#ffd36a');
    s.vfx('emp.fan', P(x, zn.y, z), 0, EMP.seal.r, Math.PI * 2 - 0.001, EMP.seal.fall);
    s.vfx('emp.seal', P(x, zn.y, z), EMP.seal.fall);
    s.vfx('sound', 'slam');
    return true;
  },
  zoneTick: (s, f, z) => {
    if (z.data.done || z.age < EMP.seal.fall) return;
    z.data.done = 1;
    s.shake(0.55, z.x, z.z);
    for (const o of near(s, f, z.x, z.z, EMP.seal.r, 2.5, z.y)) s.hit(f, o, EMP.seal.dmg, { heavy: true, knock: 2, down: EMP.seal.stun, fromX: z.x, fromZ: z.z });
  },
});
/** each wall of a cage fitted to the ground under it: lowest and highest ground along it (south, east, north, west) */
function cageSides(x: number, z: number, h: number) {
  const sides = [
    [x - h, z - h, x + h, z - h],
    [x + h, z - h, x + h, z + h],
    [x + h, z + h, x - h, z + h],
    [x - h, z + h, x - h, z - h],
  ];
  return sides.map(([ax, az, bx, bz]) => {
    let y0 = 1e9, y1 = -1e9, solid = 0;
    for (let k = 0; k <= 8; k++) {
      const px = ax + ((bx - ax) * k) / 8, pz = az + ((bz - az) * k) / 8;
      const g = gh(px, pz);
      y0 = Math.min(y0, g);
      y1 = Math.max(y1, g);
      if (inBuilding(px, g + 1, pz)) solid++;
    }
    return { show: solid < 5, y0, y1 };
  });
}
def({
  id: 'palace_cage', name: '画地为牢', sect: 'tianzi', icon: '🏯', mp: 30, cd: 16, aiRange: 10,
  desc: '天子剑往地上一划，对手周围升起四面红墙金瓦的宫墙（14 米内，没人就落在前方）。墙里的人出不去，墙外的人进不来，只有你能自由进出，持续 3 秒。圈住时附带 50 伤害。',
  cast: (s, f) => {
    const t = s.nearestEnemy(f, EMP.cage.range);
    const [x, z] = t ? [t.pos[0], t.pos[2]] : ahead(s, f, 6);
    if (t) s.faceTo(f, x, z);
    s.setAct(f, 'cast', 0.55, 'tz_cage');
    const zn = s.zone(f, 'palace_cage', x, z, EMP.cage.half, EMP.cage.wind + EMP.cage.dur, '#b91c1c');
    zn.data = { key: KEY++, fired: 0, trapped: [] as number[], prev: {} as Record<number, [number, number]> };
    s.vfx('ring', P(x, zn.y + 0.08, z), EMP.cage.half * 1.2, '#ffd36a', 0.4, 0.08, 0.3);
    s.vfx('sound', 'swingHeavy');
    return true;
  },
  zoneTick: (s, f, z) => {
    const D = z.data;
    const h = EMP.cage.half;
    if (!D.fired) {
      if (z.age < EMP.cage.wind) return;
      D.fired = 1;
      s.vfx('emp.cage', D.key, P(z.x, z.y, z.z), EMP.cage.dur, cageSides(z.x, z.z, h));
      for (const o of s.fighters) {
        if (o === f || o.hp <= 0 || o.master || Math.abs(o.pos[0] - z.x) > h || Math.abs(o.pos[2] - z.z) > h || Math.abs(o.pos[1] - z.y) > 3) continue;
        D.trapped.push(o.id);
        if (s.isEnemy(f, o)) {
          s.hit(f, o, EMP.cage.dmg, { dur: 0.3, knock: 0.5 });
          s.addFx({ kind: 'text', x: o.pos[0], y: o.pos[1] + 2.4, z: o.pos[2], max: 0.9, r: 2, color: '#ff6a4a', text: '禁' });
        }
      }
      s.vfx('dustPuff', P(z.x, z.y + 0.1, z.z), 40, h * 1.2, 4, 1, '#cdb88f');
      s.vfx('rocks', P(z.x, z.y + 0.1, z.z), 20, 6, 0.1);
      s.addFx({ kind: 'text', x: z.x, y: z.y + 3.2, z: z.z, max: 1.2, r: 2, color: '#ffd36a', text: '画地为牢' });
      s.vfx('sound', 'slam');
      s.shake(0.35, z.x, z.z);
    }
    s.vfx('emp.cageOwner', D.key, f.hp > 0 ? P(f.pos[0], f.pos[1], f.pos[2]) : null);
    // walls: the caught stay in, the rest stay out; only he walks through
    for (const o of s.fighters) {
      if (o === f || o.hp <= 0 || o.master || Math.abs(o.pos[1] - z.y) > 3) continue;
      const trapped = D.trapped.includes(o.id);
      const m = trapped ? h - 0.45 : h + 0.45;
      const inside = Math.abs(o.pos[0] - z.x) < m && Math.abs(o.pos[2] - z.z) < m;
      if (trapped && !inside) {
        o.pos[0] = z.x + Math.max(-m, Math.min(m, o.pos[0] - z.x));
        o.pos[2] = z.z + Math.max(-m, Math.min(m, o.pos[2] - z.z));
        o.vel[0] = o.vel[2] = 0;
      } else if (!trapped && inside) {
        const p = D.prev[o.id];
        if (p && !(Math.abs(p[0] - z.x) < m && Math.abs(p[1] - z.z) < m)) {
          o.pos[0] = p[0];
          o.pos[2] = p[1];
        } else {
          // dropped in from above: out through the nearest wall
          const dx = o.pos[0] - z.x, dz = o.pos[2] - z.z;
          if (Math.abs(dx) > Math.abs(dz)) o.pos[0] = z.x + Math.sign(dx || 1) * (h + 0.5);
          else o.pos[2] = z.z + Math.sign(dz || 1) * (h + 0.5);
        }
        o.vel[0] = o.vel[2] = 0;
      }
      const g = gh(o.pos[0], o.pos[2]);
      if (o.pos[1] < g) o.pos[1] = g;
      D.prev[o.id] = [o.pos[0], o.pos[2]];
    }
  },
});
def({
  id: 'true_dragon', name: '真龙降世', sect: 'tianzi', icon: '🐲', mp: 60, cd: 40, aiRange: 20, ult: true,
  desc: '双臂一振，召出一条金龙，在身前盘旋升空后扑向对手（26 米内，没人就扑向前方）。俯冲前对手脚下亮起金圈，约半秒后落下：400 伤害并击飞。0.8 秒后你就能继续行动。',
  cast: (s, f) => {
    const t = s.nearestEnemy(f, 26);
    const [x, z] = t ? [t.pos[0], t.pos[2]] : ahead(s, f, 9);
    if (t) s.faceTo(f, x, z);
    s.setAct(f, 'cast', 0.9, 'tz_dragon');
    const zn = s.zone(f, 'true_dragon', x, z, EMP.dragon.r, EMP.dragon.rise + EMP.dragon.dive + 0.05, '#ffd36a');
    zn.y = t ? t.pos[1] : gh(x, z);
    zn.data = { key: KEY++, tgt: t ? t.id : -1, lock: 0, done: 0 };
    s.vfx('flash', P(f.pos[0], f.pos[1] + 2, f.pos[2]), '#ffcf5a', 70, 1.2, 14);
    s.addFx({ kind: 'text', x: f.pos[0], y: f.pos[1] + 3, z: f.pos[2], max: 1.2, r: 2, color: '#ffd36a', text: '真龙降世' });
    s.vfx('sound', 'gong');
    s.shake(0.25, f.pos[0], f.pos[2]);
    s.vfx('emp.dragon', zn.data.key, P(f.pos[0], f.pos[1], f.pos[2]), P(x, zn.y, z), EMP.dragon.rise, EMP.dragon.dive, effYaw(s, f));
    return true;
  },
  zoneTick: (s, f, z) => {
    const D = z.data;
    const t = D.tgt >= 0 ? s.fighters[D.tgt] : null;
    if (!D.lock && t && t.hp > 0) {
      z.x = t.pos[0];
      z.y = t.pos[1];
      z.z = t.pos[2];
      s.vfx('emp.retarget', D.key, P(z.x, z.y, z.z));
    }
    if (!D.lock && z.age > 0.95) {
      D.lock = 1;
      s.vfx('emp.retarget', D.key, P(z.x, z.y, z.z));
      s.vfx('ring', P(z.x, z.y + 0.08, z.z), EMP.dragon.r, '#ffcf5a', 0.6, 0.12, 0.6);
      s.vfx('emp.fan', P(z.x, z.y, z.z), 0, EMP.dragon.r, Math.PI * 2 - 0.001, 0.55);
    }
    if (!D.done && z.age >= EMP.dragon.rise + EMP.dragon.dive) {
      D.done = 1;
      s.shake(0.6, z.x, z.z);
      for (const o of near(s, f, z.x, z.z, EMP.dragon.r, 2.5, z.y)) s.hit(f, o, EMP.dragon.dmg, { heavy: true, knock: 6, launch: 7, down: 0.9, fromX: z.x, fromZ: z.z });
    }
  },
});

// ================================================================== 交易员
def({
  id: 'rolex_throw', name: '甩劳力士', sect: 'jiaoyi', icon: '⌚', mp: 15, cd: 5, aiRange: 18,
  desc: '摘下手上的劳力士甩出去，飞 20 米，会稍微追人：110 伤害，打中让人僵直 0.5 秒。',
  cast: (s, f) => {
    s.setAct(f, 'cast', 0.45, 'jy_throw');
    const t = s.nearestEnemy(f, 22);
    let dir: [number, number, number] = [s.fwd(f)[0], 0, s.fwd(f)[1]];
    if (t) {
      s.faceTo(f, t.pos[0], t.pos[2]);
      const dx = t.pos[0] - f.pos[0], dy = t.pos[1] - f.pos[1], dz = t.pos[2] - f.pos[2];
      const l = Math.hypot(dx, dy, dz) || 1;
      dir = [dx / l, dy / l, dz / l];
    }
    s.shoot(f, { skill: 'rolex_throw', speed: 26, life: 0.85, dmg: 110, knock: 4, hitDur: 0.5, homing: 2.2, delay: 0.14, shape: 'watch', color: '#ffd36a', dir, pos: P(f.pos[0] + dir[0] * 0.6, f.pos[1] + 1.35, f.pos[2] + dir[2] * 0.6) });
    s.vfx('sound', 'throwFan');
    return true;
  },
});
def({
  id: 'make_it_rain', name: '撒钱', sect: 'jiaoyi', icon: '💸', mp: 20, cd: 9, aiRange: 7,
  desc: '打开钱箱，漫天钞票砸在前方一大片（半径 4.5 米，留 10 秒）。对手踩进去就做 3.5 秒白日梦：头上冒出美元泡泡，晕头转向乱走，出不了招。每片钱每人只中一次，最多同时撒 3 片。',
  cast: (s, f) => {
    s.setAct(f, 'cast', 0.7, 'jy_cash');
    const [x, z] = ahead(s, f, 3.5);
    const mine = s.zones.filter((q) => q.skill === 'make_it_rain' && q.owner === f.id);
    if (mine.length >= 3) mine[0].t = 0;
    const zn = s.zone(f, 'make_it_rain', x, z, 4.5, 10.35, '#4ade80');
    zn.data = { seed: (Math.random() * 1e9) >>> 0, delay: 0.35 };
    s.vfx('embers', P(x, f.pos[1] + 1.5, z), 26, '#9be37a', 1.2, -2, 0.09);
    s.vfx('sound', 'click');
    if (f.team === 'player') s.text(f, 'MAKE IT RAIN', '#9be37a');
    return true;
  },
  zoneTick: (s, f, z) => {
    if (z.age < z.data.delay) return;
    for (const o of near(s, f, z.x, z.z, z.r, 1.2, z.y)) {
      if (!o.grounded || z.touched.includes(o.id)) continue;
      z.touched.push(o.id);
      s.hit(f, o, 30, { flinch: true, daze: 3.5, stagger: false });
      s.vfx('embers', P(o.pos[0], o.pos[1] + 0.3, o.pos[2]), 20, '#9be37a', 0.8, 2.5, 0.08);
      s.addFx({ kind: 'text', x: o.pos[0], y: o.pos[1] + 2.4, z: o.pos[2], max: 1, r: 2, color: '#9be37a', text: '白日梦!' });
      if (o.team === 'player') s.toast('你踩进了钱堆，开始做发财梦……（3 秒多晕头转向）');
    }
  },
});
def({
  id: 'patagonia', name: 'Patagonia 起飞', sect: 'jiaoyi', icon: '🦺', mp: 20, cd: 18, aiRange: 0, ground: true, fallCap: 0.6,
  desc: '脱下 Patagonia 马甲当滑翔伞，跃起约 13 米高，缓缓滑翔 6 秒，空旷处直飞约 110 米。方向键控制方向，挨打也不会掉下来；飞行期间每秒回复 1% 最大生命。飞着再按一次收起马甲，直接落下。',
  cast: (s, f) => {
    start(s, f, 'patagonia', 'glide', 0, 'glide');
    const [fx, fz] = s.fwd(f);
    f.vel = [fx * 6, 26, fz * 6];
    f.grounded = false;
    s.vfx('dustPuff', P(f.pos[0], gh(f.pos[0], f.pos[2]), f.pos[2]), 14, 0.5, 2.5, 0.6);
    s.vfx('sound', 'jump');
    return true;
  },
  move: (_s, f, wish, dt) => {
    const m = Math.hypot(wish[0], wish[1]);
    if (m <= 0.1) {
      // no keys: he hangs there and slows down
      f.vel[0] *= Math.exp(-2.5 * dt);
      f.vel[2] *= Math.exp(-2.5 * dt);
      return;
    }
    const k = 1 - Math.exp(-3.5 * dt);
    f.vel[0] += ((wish[0] / m) * 20 - f.vel[0]) * k;
    f.vel[2] += ((wish[1] / m) * 20 - f.vel[2]) * k;
    f.yaw = Math.atan2(-wish[0], -wish[1]);
  },
  tick: (s, f, dt) => {
    const r = f.run!;
    if (!f.grounded) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.01 * dt);
    if (Math.random() < dt * 6) s.vfx('embers', P(f.pos[0], f.pos[1] + 2.2, f.pos[2]), 1, '#4ade80', 0.3, -1, 0.05);
    if (r.t >= 6) end(s, f);
  },
  again: (s, f) => {
    end(s, f);
    return true;
  },
  land: (s, f) => {
    if (f.run!.t < 0.4) return;
    f.vel[0] = f.vel[2] = 0;
    s.vfx('dustPuff', P(f.pos[0], f.pos[1], f.pos[2]), 10, 0.4, 2, 0.5);
    end(s, f);
  },
});
def({
  id: 'short_sell', name: '做空', sect: 'jiaoyi', icon: '📉', mp: 20, cd: 11, aiRange: 12,
  desc: '对 16 米内的对手开空单 6 秒：头上挂红色 SHORT 箭头，他受到的伤害 +25%，跑得慢两成，打人伤害少两成，血还像股价一样每秒掉 2.5%，掉的血有六成变成你的回血。',
  cast: (s, f) => {
    const t = s.nearestEnemy(f, 16);
    if (!t) {
      say(s, f, '附近没人可做空');
      return false;
    }
    s.setAct(f, 'cast', 0.7, 'jy_point');
    s.faceTo(f, t.pos[0], t.pos[2]);
    t.st.weak = 6;
    (t as any).shortBy = f.id;
    s.addFx({ kind: 'text', x: t.pos[0], y: t.pos[1] + 2.4, z: t.pos[2], max: 1, r: 2, color: '#ff3b3b', text: '做空!' });
    s.vfx('ring', P(t.pos[0], t.pos[1] + 0.08, t.pos[2]), 1.4, '#ff2a2a', 0.5, 0.1, 0.4);
    s.vfx('sound', 'click');
    return true;
  },
});
def({
  id: 'black_monday', name: '黑色星期一', sect: 'jiaoyi', icon: '📊', mp: 55, cd: 30, aiRange: 16, ult: true,
  desc: '股市崩盘：对手周围（25 米内，没人就在前方）2 秒内接连砸下 10 根红色大阴线（每根 90 伤害并击倒，每三根有一根正对他本人），最后一根巨型阴线砸在正中间：240 伤害并击倒 1.2 秒。',
  cast: (s, f) => {
    const t = s.nearestEnemy(f, 25);
    const [x, z] = t ? [t.pos[0], t.pos[2]] : ahead(s, f, 10);
    s.setAct(f, 'cast', 0.7, 'jy_point');
    const zn = s.zone(f, 'black_monday', x, z, 7, 2.05, '#ef4444');
    zn.data = { tgt: t ? t.id : -1, fired: 0, done: 0 };
    s.shake(0.3, f.pos[0], f.pos[2]);
    if (f.team === 'player' || s.dist(f, s.player) < 30) s.toast('黑色星期一：道指单日暴跌 22.6%');
    s.vfx('sound', 'gong');
    return true;
  },
  zoneTick: (s, f, z, dt) => {
    const D = z.data;
    const t = D.tgt >= 0 ? s.fighters[D.tgt] : null;
    if (t && t.hp > 0) {
      z.x += (t.pos[0] - z.x) * Math.min(1, dt * 2);
      z.z += (t.pos[2] - z.z) * Math.min(1, dt * 2);
    }
    const candle = (x: number, zz: number, big: boolean) => {
      const c = s.zone(f, 'bm_candle', x, zz, big ? 3.4 : 1.6, (big ? 0.8 : 0.55) + 1.6, '#ef4444');
      c.data = { warn: big ? 0.8 : 0.55, big, landed: 0, dmg: big ? 240 : 90 };
    };
    const want = Math.min(10, Math.floor((z.age / 2) * 10));
    while (D.fired < want) {
      D.fired++;
      const onHim = D.fired % 3 === 0 && t && t.hp > 0;
      const a = Math.random() * Math.PI * 2;
      const d = onHim ? 0 : 1.5 + Math.random() * 5.5;
      candle((onHim ? t!.pos[0] : z.x) + Math.cos(a) * d, (onHim ? t!.pos[2] : z.z) + Math.sin(a) * d, false);
    }
    if (!D.done && z.age >= 2) {
      D.done = 1;
      candle(z.x, z.z, true);
    }
  },
});
def({
  id: 'bm_candle', name: '阴线', sect: 'jiaoyi', icon: '🟥', mp: 0, cd: 0, aiRange: 0,
  desc: '',
  cast: () => false,
  zoneTick: (s, f, z) => {
    const D = z.data;
    if (D.landed || z.age < D.warn) return;
    D.landed = 1;
    s.vfx('groundSlam', P(z.x, z.y, z.z), D.big ? 1.6 : 0.7, '#ff2a2a');
    s.vfx('dustPuff', P(z.x, z.y, z.z), D.big ? 24 : 8, D.big ? 1.2 : 0.5, 3, 0.7);
    s.shake(D.big ? 0.6 : 0.15, z.x, z.z);
    s.vfx('sound', 'slam');
    for (const o of near(s, f, z.x, z.z, z.r, 3, z.y)) s.hit(f, o, D.dmg, { heavy: true, down: D.big ? 1.2 : 0.6, knock: D.big ? 6 : 3, launch: D.big ? 5 : 2, fromX: z.x, fromZ: z.z });
  },
});

// ================================================================== 地仙
def({
  id: 'qingfeng', name: '清风诀', sect: 'dixian', icon: '🍃', mp: 25, cd: 11, aiRange: 30, ground: true,
  desc: '站定引导 0.9 秒，一阵青风落在身上，回复 18% 最大生命（血少于三成时多回两成）。读条中挨打或被控会打断。',
  cast: (s, f) => {
    if (f.team !== 'player' && f.hp > f.maxHp * 0.6) return false; // the AI only heals when hurt
    start(s, f, 'qingfeng', 'channel', 1.15, 'dx_breeze');
    f.vel[0] = f.vel[2] = 0;
    title(s, f, '清风诀 · 引导', '#4ade80');
    s.vfx('ring', P(f.pos[0], gh(f.pos[0], f.pos[2]) + 0.05, f.pos[2]), 1.6, '#86efac', 0.5, 0.08, 0.6);
    s.vfx('sound', 'whirl');
    return true;
  },
  tick: (s, f, dt) => {
    const r = f.run!;
    f.vel[0] = f.vel[2] = 0;
    if (Math.random() < dt * 14) s.vfx('embers', P(f.pos[0] + (Math.random() - 0.5), f.pos[1] + 1.3 + Math.random() * 0.8, f.pos[2] + (Math.random() - 0.5)), 1, '#86efac', 0.5, 0.4, 0.07);
    if (!r.data.done && r.t >= 0.9) {
      r.data.done = 1;
      heal(s, f, mercy(f, f.maxHp * 0.18));
      s.vfx('ring', P(f.pos[0], f.pos[1] + 0.06, f.pos[2]), 1.8, '#4ade80', 0.6, 0.12, 0.5);
      s.vfx('embers', P(f.pos[0], f.pos[1] + 0.4, f.pos[2]), 24, '#86efac', 0.9, 2.5, 0.08);
      s.vfx('sound', 'chime');
    }
    if (r.t >= 1.15) end(s, f);
  },
});
def({
  id: 'drain_surplus', name: '损有余', sect: 'dixian', icon: '🩸', mp: 25, cd: 11, aiRange: 15,
  desc: '天之道，损有余而补不足：从 18 米内最近的敌人身上牵出一道粉色气血光束，3 秒内每秒抽走他 3.5% 最大生命，全部补给自己。拉开太远光束就断。',
  cast: (s, f) => {
    const t = s.nearestEnemy(f, 18);
    if (!t) {
      say(s, f, '18米内没有敌人');
      return false;
    }
    s.setAct(f, 'cast', 0.6, 'dx_drain');
    s.faceTo(f, t.pos[0], t.pos[2]);
    for (const q of s.zones) if (q.skill === 'drain_surplus' && q.owner === f.id) q.t = 0;
    const zn = s.zone(f, 'drain_surplus', t.pos[0], t.pos[2], 0.1, 3, '#f472b6');
    zn.data = { from: t.id, acc: 0, shown: 0 };
    title(s, f, '损有余', '#f472b6');
    s.addFx({ kind: 'text', x: t.pos[0], y: t.pos[1] + 2.5, z: t.pos[2], max: 1, r: 2, color: '#f472b6', text: '气血被牵走' });
    s.vfx('sparkBurst', P(t.pos[0], t.pos[1] + 1.2, t.pos[2]), 30, '#f472b6', 5, 0.08, 'up', 1);
    s.vfx('ring', feet(t), 2.2, '#f43f5e', 0.6, 0.14, 0.5);
    s.vfx('ring', feet(f), 2.2, '#4ade80', 0.6, 0.14, 0.5);
    s.vfx('sound', 'click');
    return true;
  },
  zoneTick: (s, f, z, dt) => {
    const D = z.data;
    const from = s.fighters[D.from];
    if (!from || from.hp <= 1 || f.hp <= 0 || s.dist(from, f) > 28) {
      if (D.acc > 0) heal(s, f, D.acc);
      z.t = 0;
      return;
    }
    z.x = from.pos[0];
    z.z = from.pos[2];
    const d = Math.min(from.hp - 1, from.maxHp * 0.035 * dt);
    from.hp -= d;
    if (from.team === 'sect') from.aggro = true;
    D.acc += mercy(f, d);
    D.shown += d;
    if (D.shown >= from.maxHp * 0.03) {
      s.addFx({ kind: 'text', x: from.pos[0], y: from.pos[1] + 2.2, z: from.pos[2], max: 0.8, r: 1, color: '#f472b6', text: `-${Math.round(D.shown)}` });
      D.shown = 0;
      heal(s, f, D.acc);
      D.acc = 0;
    }
    if (Math.random() < 0.8) {
      const q = Math.random();
      s.vfx('embers', P(from.pos[0] + (f.pos[0] - from.pos[0]) * q, from.pos[1] + 1.2 + (f.pos[1] - from.pos[1]) * q + Math.sin(q * Math.PI) * 0.6, from.pos[2] + (f.pos[2] - from.pos[2]) * q), 1, '#f9a8d4', 0.45, 0.2, 0.05);
    }
  },
});
def({
  id: 'earth_spring', name: '地脉回春', sect: 'dixian', icon: '🌿', mp: 30, cd: 16, aiRange: 6,
  desc: '鹤头杖往地上一点，前方展开半径 4.5 米的金色地脉法阵，持续 8 秒。自己在阵里每秒回复 2% 最大生命；敌人一踏进来就被地里钻出的树根缠住 1.2 秒（每个阵每人一次），之后在阵里走路慢三成。',
  cast: (s, f) => {
    s.setAct(f, 'cast', 0.55, 'dx_spring');
    title(s, f, '地脉回春', '#e9b949');
    const [x, z] = ahead(s, f, 3);
    for (const q of s.zones) if (q.skill === 'earth_spring' && q.owner === f.id) q.t = 0;
    s.later(0.22, () => {
      if (f.hp <= 0) return;
      const zn = s.zone(f, 'earth_spring', x, z, 4.5, 8, '#e9b949');
      zn.data = { tick: 0 };
      s.vfx('ring', P(x, zn.y + 0.05, z), 4.5, '#e9b949', 0.7, 0.14, 0.6);
      s.vfx('dustPuff', P(x, zn.y + 0.05, z), 16, 0.6, 2.4, 0.6, '#d6b46a');
      s.vfx('sound', 'slam');
    });
    return true;
  },
  zoneTick: (s, f, z, dt) => {
    if (Math.random() < dt * 10) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * z.r;
      const x = z.x + Math.cos(a) * d, zz = z.z + Math.sin(a) * d;
      s.vfx('embers', P(x, gh(x, zz) + 0.1, zz), 1, '#f2cc6b', 0.45, 1.6, 0.06);
    }
    for (const o of near(s, f, z.x, z.z, z.r, 2, z.y)) {
      (o as any).spdMul = Math.min((o as any).spdMul ?? 1, 0.7);
      if (z.age < 0.2 || z.touched.includes(o.id)) continue;
      z.touched.push(o.id);
      o.st.root = Math.max(o.st.root, 1.2);
      s.vfx('ring', feet(o), 0.9, '#b08a3e', 0.5, 0.1, 0.4);
      s.vfx('dustPuff', feet(o), 10, 0.4, 1.6, 0.5, '#8a6a3a');
      s.addFx({ kind: 'text', x: o.pos[0], y: o.pos[1] + 2.4, z: o.pos[2], max: 1, r: 2, color: '#e9b949', text: '树根缠身' });
      if (o.team === 'sect') o.aggro = true;
    }
    z.data.tick += dt;
    if (z.data.tick < 1) return;
    z.data.tick -= 1;
    if (f.hp < f.maxHp && Math.hypot(f.pos[0] - z.x, f.pos[2] - z.z) < z.r && Math.abs(f.pos[1] - z.y) < 2) heal(s, f, mercy(f, f.maxHp * 0.02));
  },
});
def({
  id: 'fold_earth', name: '缩地成寸', sect: 'dixian', icon: '👣', mp: 20, cd: 10, aiRange: 3,
  desc: '缩地成寸：向前（或按着的方向）瞬行 9 米，途中短暂无敌。落地时鹤羽护体：一层白色护盾吸收 16% 最大生命的伤害，持续 6 秒，同时羽毛炸开把身边 3.6 米内的敌人推开（20）。',
  cast: (s, f) => {
    if (f.st.root > 0) {
      say(s, f, '被定身');
      return false;
    }
    const wish: [number, number] = (f as any).wish ?? [0, 0];
    let [dx, dz] = s.fwd(f);
    const m = Math.hypot(wish[0], wish[1]);
    if (m > 0.1) {
      dx = wish[0] / m;
      dz = wish[1] / m;
    }
    const t = 9 / 30;
    start(s, f, 'fold_earth', 'cast', t + 0.12, 'dx_fold', { dx, dz, t });
    f.yaw = Math.atan2(-dx, -dz);
    f.st.invuln = Math.max(f.st.invuln, t + 0.35);
    s.vfx('dustPuff', P(f.pos[0], gh(f.pos[0], f.pos[2]) + 0.05, f.pos[2]), 16, 0.6, 2.2, 0.6, '#d1fae5');
    s.vfx('embers', P(f.pos[0], f.pos[1] + 1, f.pos[2]), 14, '#86efac', 0.6, 0.6, 0.08);
    s.vfx('sound', 'dodge');
    title(s, f, '缩地成寸', '#a5f3fc');
    return true;
  },
  move: (_s, f) => {
    const r = f.run!;
    if (r.t < r.data.t) {
      f.vel[0] = r.data.dx * 30;
      f.vel[2] = r.data.dz * 30;
    }
  },
  tick: (s, f) => {
    const r = f.run!;
    if (r.t < r.data.t) {
      if (Math.random() < 0.6) s.vfx('embers', P(f.pos[0], f.pos[1] + 0.9, f.pos[2]), 2, '#a7f3d0', 0.5, 0.3, 0.07);
      return;
    }
    if (!r.data.done) {
      r.data.done = 1;
      f.vel[0] *= 0.15;
      f.vel[2] *= 0.15;
      s.vfx('dustPuff', P(f.pos[0], gh(f.pos[0], f.pos[2]) + 0.05, f.pos[2]), 12, 0.5, 2, 0.5, '#d1fae5');
      // 鹤羽护 on arrival
      const amt = Math.round(mercy(f, f.maxHp * 0.16));
      f.ward = Math.max(f.ward ?? 0, amt);
      f.st.wardT = 6;
      s.vfx('ring', P(f.pos[0], f.pos[1] + 0.06, f.pos[2]), 1.5, '#f1f5f9', 0.5, 0.1, 0.5);
      s.addFx({ kind: 'text', x: f.pos[0], y: f.pos[1] + 2.5, z: f.pos[2], max: 1, r: 2, color: '#f8fafc', text: `鹤羽护 ${amt}` });
      s.vfx('ring', P(f.pos[0], f.pos[1] + 0.3, f.pos[2]), 3.6, '#ffffff', 0.4, 0.12, 0.35);
      s.vfx('embers', P(f.pos[0], f.pos[1] + 1.1, f.pos[2]), 30, '#ffffff', 1, 0.5, 0.09);
      for (const o of near(s, f, f.pos[0], f.pos[2], 3.6, 2)) s.hit(f, o, 20, { knock: 8, dur: 0.45, breakArmor: true });
      s.vfx('sound', 'chime');
    }
    if (r.t >= r.data.t + 0.12) end(s, f);
  },
});
def({
  id: 'mortal_realm', name: '人间不渡', sect: 'dixian', icon: '🕊️', mp: 70, cd: 40, aiRange: 0, ult: true,
  desc: '不入天阙，留守人间：仙鹤从天而降盘旋，立刻回复 25% 最大生命，解除定身、封印、跪、做空、白日梦等负面状态，并在 4 秒内不会被击倒、击飞或眩晕。',
  cast: (s, f) => {
    start(s, f, 'mortal_realm', 'cast', 1.3, 'dx_ult');
    f.vel[0] = f.vel[2] = 0;
    const g = gh(f.pos[0], f.pos[2]);
    const zn = s.zone(f, 'mortal_realm', f.pos[0], f.pos[2], 1, 4.5, '#bbf7d0');
    zn.y = Math.max(g, f.pos[1]);
    s.vfx('ring', P(f.pos[0], g + 0.05, f.pos[2]), 20, '#bbf7d0', 1.2, 0.2, 0.9);
    s.later(0.45, () => {
      if (f.hp <= 0) return;
      heal(s, f, mercy(f, f.maxHp * 0.25));
      f.st.protect = Math.max(f.st.protect, 4);
      f.st.root = f.st.silence = f.st.weak = f.st.daze = f.st.kneel = f.st.slow = f.st.stun = 0;
      f.pull = undefined;
      s.vfx('ring', P(f.pos[0], f.pos[1] + 0.06, f.pos[2]), 1.8, '#f0fdf4', 0.6, 0.12, 0.6);
      s.vfx('pillarAt', 0.6, '#bbf7d0', s.slotOf(f));
    });
    s.shake(0.2, f.pos[0], f.pos[2]);
    if (f.team === 'player') s.toast('人间不渡：不入天阙，留守人间');
    title(s, f, '人间不渡', '#bbf7d0');
    s.vfx('sound', 'gong');
    return true;
  },
  tick: (s, f) => {
    if (f.run!.t >= 1.3) end(s, f);
  },
});

/** the moves a player can learn (the falling candle is part of 黑色星期一, not a move) */
export const ALL_SKILL_IDS = Object.keys(SKILLS).filter((id) => id !== 'bm_candle');

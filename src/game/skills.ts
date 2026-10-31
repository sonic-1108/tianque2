// The 21 moves of the seven houses. Each is data plus a few small functions the sim calls:
//   cast   when it's pressed (return false if it can't go)
//   tick   every frame while it runs (f.run.id === its id); it ends itself with end(sim, f)
//   move   replaces walking while it runs
//   again  a second press while it runs (burrow out, fold the vest)
//   zoneTick / projHit / land  hooks for its zones, projectiles and landing
// Disciples use the very same moves, so a house fights the way it teaches.
import type { Fighter, Projectile, SectId, Zone } from './types';
import type { Sim } from './sim';
import { groundHeight } from './world';

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
  float?: boolean; // no gravity while it runs
  parallel?: boolean; // runs alongside walking and other acts (a beam)
  ult?: boolean; // an ultimate: R, held to charge, from level 30
  cast: (s: Sim, f: Fighter) => boolean;
  tick?: (s: Sim, f: Fighter, dt: number) => void;
  move?: (s: Sim, f: Fighter, wish: [number, number], dt: number) => void;
  again?: (s: Sim, f: Fighter) => boolean;
  zoneTick?: (s: Sim, f: Fighter, z: Zone, dt: number) => void;
  projHit?: (s: Sim, f: Fighter, target: Fighter, p: Projectile) => void;
  land?: (s: Sim, f: Fighter) => void;
}

const start = (s: Sim, f: Fighter, id: string, act: Fighter['act'], dur: number, anim: string, data: Record<string, number> = {}) => {
  s.setAct(f, act, dur, anim);
  f.run = { id, t: 0, data };
};
const end = (s: Sim, f: Fighter) => {
  f.run = null;
  s.setAct(f, f.grounded ? 'idle' : 'jump', 0, f.grounded ? 'idle' : 'jump');
};
const fwdPoint = (s: Sim, f: Fighter, d: number): [number, number] => {
  const [fx, fz] = s.fwd(f);
  return [f.pos[0] + fx * d, f.pos[2] + fz * d];
};
const ring = (s: Sim, x: number, z: number, r: number, color: string, max = 0.45) =>
  s.addFx({ kind: 'ring', x, y: groundHeight(x, z) + 0.1, z, max, r, color });

export const SKILLS: Record<string, SkillDef> = {};
const def = (d: SkillDef) => (SKILLS[d.id] = d);

// ================================================================== 狂刃门
def({
  id: 'earth_cleave', name: '裂地斩', sect: 'kuangren', icon: '💥', mp: 20, cd: 6, aiRange: 5, ground: true,
  desc: '双刃砸地，裂缝向前喷出火柱 6 米，沿途敌人受 120 伤害并被击飞。',
  cast: (s, f) => {
    start(s, f, 'earth_cleave', 'cast', 0.7, 'skill_slash', { n: 0 });
    return true;
  },
  tick: (s, f) => {
    const r = f.run!;
    // the crack runs out after the blow lands: a burst every 0.06 s, 1.2 m apart
    while (r.t > 0.25 + r.data.n * 0.06 && r.data.n < 5) {
      r.data.n++;
      const [x, z] = fwdPoint(s, f, r.data.n * 1.2);
      s.addFx({ kind: 'burst', x, y: groundHeight(x, z) + 0.3, z, max: 0.4, r: 1.3, color: '#ff6a1a' });
      for (const o of s.inRadius(f, x, z, 1.3)) if (!(r.data as any)['h' + o.id]) ((r.data as any)['h' + o.id] = 1), s.hit(f, o, 120, { launch: 8, knock: 2 });
    }
    if (r.t >= 0.7) end(s, f);
  },
});
def({
  id: 'whirlwind_blade', name: '旋风刃', sect: 'kuangren', icon: '🌀', mp: 25, cd: 9, aiRange: 3,
  desc: '原地高速旋转 1.6 秒，每 0.2 秒伤害身边 3 米内的敌人（30）。期间霸体，可以慢慢移动追人。',
  cast: (s, f) => {
    start(s, f, 'whirlwind_blade', 'cast', 1.6, 'skill_spin', { next: 0 });
    f.st.armor = 1.6;
    return true;
  },
  move: (_s, f, wish, dt) => {
    f.vel[0] += (wish[0] * 3 - f.vel[0]) * Math.min(1, 8 * dt);
    f.vel[2] += (wish[1] * 3 - f.vel[2]) * Math.min(1, 8 * dt);
  },
  tick: (s, f) => {
    const r = f.run!;
    f.yaw += 0.6;
    if (r.t >= r.data.next) {
      r.data.next += 0.2;
      for (const o of s.inRadius(f, f.pos[0], f.pos[2], 3)) s.hit(f, o, 30, { stagger: true, knock: 1.5 });
      ring(s, f.pos[0], f.pos[2], 3, '#ff8a5a', 0.2);
    }
    if (r.t >= 1.6) end(s, f);
  },
});
def({
  id: 'bull_charge', name: '蛮牛冲', sect: 'kuangren', icon: '🐂', mp: 20, cd: 7, aiRange: 9, ground: true,
  desc: '肩膀向前冲撞 9 米，撞到的第一个敌人受 100 伤害并被撞飞。霸体。',
  cast: (s, f) => {
    start(s, f, 'bull_charge', 'cast', 0.55, 'skill_dash');
    f.st.armor = 0.55;
    return true;
  },
  move: (s, f) => {
    const [fx, fz] = s.fwd(f);
    f.vel[0] = fx * 17;
    f.vel[2] = fz * 17;
  },
  tick: (s, f) => {
    const o = s.inRadius(f, f.pos[0], f.pos[2], 1.3)[0];
    if (o) {
      s.hit(f, o, 100, { launch: 7, knock: 9 });
      ring(s, o.pos[0], o.pos[2], 1.6, '#ffb15a');
      f.vel[0] = f.vel[2] = 0;
      end(s, f);
      return;
    }
    if (f.run!.t >= 0.55) end(s, f);
  },
});

// ================================================================== 唐门暗器
def({
  id: 'boomerang', name: '回旋镖', sect: 'anqi', icon: '🪃', mp: 15, cd: 5, aiRange: 10,
  desc: '掷出大回旋镖，飞出约 9 米后折返，去程和回程各造成 70 伤害并推开敌人。',
  cast: (s, f) => {
    s.setAct(f, 'cast', 0.4, 'skill_throw');
    s.shoot(f, { skill: 'boomerang', speed: 16, life: 1.3, returnAt: 0.75, dmg: 70, radius: 0.8, color: '#2dd4bf', shape: 'boomerang', pierce: true, onHit: 'knock' });
    return true;
  },
});
def({
  id: 'pin_dart', name: '定身镖', sect: 'anqi', icon: '📌', mp: 20, cd: 9, aiRange: 16,
  desc: '掷出一枚重镖，命中后造成 60 伤害，把对手钉在原地 1.5 秒。',
  cast: (s, f) => {
    s.setAct(f, 'cast', 0.4, 'skill_throw');
    s.shoot(f, { skill: 'pin_dart', speed: 30, life: 0.7, dmg: 60, radius: 0.5, color: '#f472b6', shape: 'dart', onHit: 'root' });
    return true;
  },
});
def({
  id: 'swallow_flip', name: '燕返', sect: 'anqi', icon: '🕊️', mp: 15, cd: 6, aiRange: 4,
  desc: '向后空翻跃出一大段距离，同时向前方扇形甩出 7 枚飞镖（各 30）。翻身时短暂无敌。',
  cast: (s, f) => {
    const [fx, fz] = s.fwd(f);
    start(s, f, 'swallow_flip', 'cast', 0.6, 'skill_flip');
    f.vel = [-fx * 11, 8, -fz * 11];
    f.grounded = false;
    f.st.invuln = 0.45;
    for (let k = -3; k <= 3; k++) s.shoot(f, { skill: 'swallow_flip', yaw: f.yaw + k * 0.14, speed: 24, life: 0.55, dmg: 30, radius: 0.4, color: '#2dd4bf' });
    return true;
  },
  move: () => {},
  tick: (s, f) => {
    if (f.run!.t >= 0.6 || (f.grounded && f.run!.t > 0.15)) end(s, f);
  },
});

// ================================================================== 影刃阁
def({
  id: 'shadow_step', name: '瞬影', sect: 'yingren', icon: '👤', mp: 15, cd: 7, aiRange: 10,
  desc: '化作影子瞬移到 10 米内对手的身后（没人就向前闪出 7 米），2.5 秒内下一击必定暴击。',
  cast: (s, f) => {
    const t = s.nearestEnemy(f, 10);
    ring(s, f.pos[0], f.pos[2], 1.2, '#a78bfa');
    if (t) {
      const [tx, tz] = s.fwd(t);
      f.pos[0] = t.pos[0] - tx * 1.4;
      f.pos[2] = t.pos[2] - tz * 1.4;
      s.faceTo(f, t.pos[0], t.pos[2]);
    } else {
      const [x, z] = fwdPoint(s, f, 7);
      f.pos[0] = x;
      f.pos[2] = z;
    }
    f.pos[1] = Math.max(f.pos[1], groundHeight(f.pos[0], f.pos[2]));
    f.st.crit = 2.5;
    ring(s, f.pos[0], f.pos[2], 1.2, '#a78bfa');
    s.setAct(f, 'cast', 0.2, 'skill_dash');
    return true;
  },
});
def({
  id: 'fan_knives', name: '飞刀', sect: 'yingren', icon: '🔪', mp: 15, cd: 5, aiRange: 9,
  desc: '扇形甩出五把飞刀，每把 62 伤害。只要有一把命中，瞬影的冷却立刻刷新。',
  cast: (s, f) => {
    s.setAct(f, 'cast', 0.4, 'skill_throw');
    for (let k = -2; k <= 2; k++) s.shoot(f, { skill: 'fan_knives', yaw: f.yaw + k * 0.16, speed: 26, life: 0.5, dmg: 62, radius: 0.4, color: '#c4b5fd', shape: 'blade' });
    return true;
  },
  projHit: (_s, f) => {
    f.cds.shadow_step = 0;
  },
});
def({
  id: 'burrow', name: '遁地', sect: 'yingren', icon: '⛰️', mp: 20, cd: 10, aiRange: 7,
  desc: '钻进地里潜行最多 2.2 秒：打不中、移速 +35%。再按一次或时间到就破土而出，把 2.6 米内的敌人挑飞（130）。',
  cast: (s, f) => {
    start(s, f, 'burrow', 'burrow', 0, 'burrow');
    f.st.invuln = 2.3;
    return true;
  },
  move: (_s, f, wish, dt) => {
    f.vel[0] += (wish[0] * 9 - f.vel[0]) * Math.min(1, 10 * dt);
    f.vel[2] += (wish[1] * 9 - f.vel[2]) * Math.min(1, 10 * dt);
    if (Math.hypot(wish[0], wish[1]) > 0.1) f.yaw = Math.atan2(-wish[0], -wish[1]);
  },
  tick: (s, f) => {
    if (Math.random() < 0.5) s.addFx({ kind: 'burst', x: f.pos[0], y: f.pos[1] + 0.1, z: f.pos[2], max: 0.5, r: 0.5, color: '#8b6b45' });
    // the AI comes up under the player
    if (f.team !== 'player' && s.dist(f, s.player) < 1.8) SKILLS.burrow.again!(s, f);
    else if (f.run!.t >= 2.2) SKILLS.burrow.again!(s, f);
  },
  again: (s, f) => {
    f.st.invuln = 0;
    for (const o of s.inRadius(f, f.pos[0], f.pos[2], 2.6)) s.hit(f, o, 130, { launch: 9, knock: 3 });
    ring(s, f.pos[0], f.pos[2], 2.6, '#a78bfa');
    s.addFx({ kind: 'burst', x: f.pos[0], y: f.pos[1] + 0.4, z: f.pos[2], max: 0.5, r: 2, color: '#8b6b45' });
    f.run = null;
    s.setAct(f, 'cast', 0.45, 'skill_slash');
    return true;
  },
});

// ================================================================== 华尔街交易所
def({
  id: 'rolex_throw', name: '甩劳力士', sect: 'jiaoyi', icon: '⌚', mp: 15, cd: 5, aiRange: 18,
  desc: '摘下劳力士甩出去，飞 20 米并稍微追人：110 伤害，打中让人僵直。',
  cast: (s, f) => {
    s.setAct(f, 'cast', 0.4, 'skill_throw');
    const t = s.nearestEnemy(f, 20, 0.5);
    s.shoot(f, { skill: 'rolex_throw', speed: 24, life: 0.9, dmg: 110, radius: 0.6, color: '#ffd36a', shape: 'watch', homing: 2.2, target: t?.id, onHit: 'stagger' });
    return true;
  },
});
def({
  id: 'make_it_rain', name: '撒钱', sect: 'jiaoyi', icon: '💸', mp: 25, cd: 12, aiRange: 7,
  desc: '漫天钞票砸在前方（半径 4.5 米，留 8 秒）。敌人踩进去就做 3 秒白日梦：晕头转向乱走，出不了招。',
  cast: (s, f) => {
    s.setAct(f, 'cast', 0.5, 'skill_stomp');
    const [x, z] = fwdPoint(s, f, 4);
    s.zone(f, 'make_it_rain', x, z, 4.5, 8, '#4ade80');
    return true;
  },
  zoneTick: (s, f, z) => {
    if (Math.random() < 0.4) s.addFx({ kind: 'text', x: z.x + (Math.random() - 0.5) * z.r * 1.6, y: z.y + 3, z: z.z + (Math.random() - 0.5) * z.r * 1.6, max: 0.8, r: 1, color: '#4ade80', text: '$' });
    for (const o of s.inRadius(f, z.x, z.z, z.r)) {
      if (z.touched.includes(o.id)) continue;
      z.touched.push(o.id);
      s.hit(f, o, 30, { daze: 3, stagger: false });
      s.text(o, '白日梦', '#4ade80');
    }
  },
});
def({
  id: 'patagonia', name: 'Patagonia 起飞', sect: 'jiaoyi', icon: '🦺', mp: 25, cd: 18, aiRange: 0, ground: true, float: true,
  desc: '脱下马甲当滑翔伞跃上天，缓缓滑翔 6 秒（方向键控制），每秒回复 1% 生命。再按一次收伞落地。',
  cast: (s, f) => {
    start(s, f, 'patagonia', 'glide', 0, 'glide');
    f.vel[1] = 13;
    f.grounded = false;
    return true;
  },
  move: (_s, f, wish, dt) => {
    // rises first, then sinks slowly; no keys = hangs and slows down
    f.vel[1] = f.run!.t < 0.6 ? 13 * (1 - f.run!.t / 0.6) : -1.2;
    const m = Math.hypot(wish[0], wish[1]);
    const tx = m > 0.1 ? wish[0] * 14 : 0;
    const tz = m > 0.1 ? wish[1] * 14 : 0;
    f.vel[0] += (tx - f.vel[0]) * Math.min(1, 2.5 * dt);
    f.vel[2] += (tz - f.vel[2]) * Math.min(1, 2.5 * dt);
    if (m > 0.1) f.yaw = Math.atan2(-wish[0], -wish[1]);
  },
  tick: (s, f, dt) => {
    f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.01 * dt);
    if (f.run!.t >= 6) SKILLS.patagonia.again!(s, f);
  },
  again: (s, f) => {
    f.run = null;
    s.setAct(f, f.grounded ? 'idle' : 'jump', 0, f.grounded ? 'idle' : 'jump');
    return true;
  },
  land: (s, f) => {
    if (f.run!.t > 0.5) SKILLS.patagonia.again!(s, f);
    f.vel[0] = f.vel[2] = 0;
  },
});

// ================================================================== 梵音寺
def({
  id: 'vajra_palm', name: '金刚掌', sect: 'fanyin', icon: '✋', mp: 20, cd: 5, aiRange: 3.5,
  desc: '向前一步推出金色掌印，3 米内的敌人受 160 伤害并被震飞一大段。',
  cast: (s, f) => {
    start(s, f, 'vajra_palm', 'cast', 0.55, 'skill_palm');
    const [fx, fz] = s.fwd(f);
    f.vel[0] = fx * 9;
    f.vel[2] = fz * 9;
    return true;
  },
  tick: (s, f) => {
    const r = f.run!;
    if (!r.data.done && r.t > 0.22) {
      r.data.done = 1;
      const [x, z] = fwdPoint(s, f, 1.6);
      s.addFx({ kind: 'burst', x, y: f.pos[1] + 1.2, z, max: 0.35, r: 1.6, color: '#f5b942' });
      for (const o of s.inCone(f, 3.8, 0.3)) s.hit(f, o, 160, { knock: 14 });
    }
    if (r.t >= 0.55) end(s, f);
  },
});
def({
  id: 'zen_domain', name: '禅定结界', sect: 'fanyin', icon: '☸️', mp: 25, cd: 11, aiRange: 4,
  desc: '脚下展开半径 4.5 米的金色法阵 5 秒：敌人在阵里减速一半，自己站在阵里攻防各 +10%。',
  cast: (s, f) => {
    s.setAct(f, 'cast', 0.5, 'skill_stomp');
    s.zone(f, 'zen_domain', f.pos[0], f.pos[2], 4.5, 5, '#f5b942');
    return true;
  },
  zoneTick: (s, f, z) => {
    for (const o of s.inRadius(f, z.x, z.z, z.r)) o.st.slow = Math.max(o.st.slow, 0.2);
    if (Math.hypot(f.pos[0] - z.x, f.pos[2] - z.z) < z.r) f.st.buffAtk = Math.max(f.st.buffAtk, 0.2);
  },
});
def({
  id: 'six_syllable_mantra', name: '六字真言', sect: 'fanyin', icon: '🕉️', mp: 30, cd: 10, aiRange: 10,
  desc: '身边震出一圈音波（20 伤害，打断），随后六个金字依次飞出，追向 10 米内血最少的敌人（各 32）。',
  cast: (s, f) => {
    start(s, f, 'six_syllable_mantra', 'channel', 1.2, 'skill_spell', { n: 0 });
    for (const o of s.inRadius(f, f.pos[0], f.pos[2], 3)) s.hit(f, o, 20, { stagger: true });
    ring(s, f.pos[0], f.pos[2], 3, '#f5b942');
    return true;
  },
  tick: (s, f) => {
    const r = f.run!;
    while (r.t > 0.15 + r.data.n * 0.17 && r.data.n < 6) {
      r.data.n++;
      const foes = s.enemiesOf(f).filter((o) => s.dist(f, o) < 10).sort((a, b) => a.hp - b.hp);
      const t = foes[0];
      const yaw = f.yaw + (r.data.n - 3.5) * 0.35;
      s.shoot(f, { skill: 'six_syllable_mantra', yaw, speed: 14, life: 1.2, dmg: 32, radius: 0.5, color: '#ffd36a', shape: 'glyph', homing: 5, target: t?.id, pos: [f.pos[0], f.pos[1] + 1.8, f.pos[2]] });
    }
    if (r.t >= 1.2) end(s, f);
  },
});

// ================================================================== 青囊谷
def({
  id: 'qingfeng', name: '清风诀', sect: 'dixian', icon: '🍃', mp: 25, cd: 11, aiRange: 30,
  desc: '站定引导 0.9 秒，一阵青风回复自己 18% 最大生命。引导中挨打会被打断。',
  cast: (s, f) => {
    if (f.team !== 'player' && f.hp > f.maxHp * 0.6) return false; // the AI only heals when hurt
    start(s, f, 'qingfeng', 'channel', 0.9, 'skill_spell');
    return true;
  },
  tick: (s, f) => {
    if (Math.random() < 0.4) s.addFx({ kind: 'burst', x: f.pos[0] + (Math.random() - 0.5), y: f.pos[1] + 2, z: f.pos[2] + (Math.random() - 0.5), max: 0.5, r: 0.4, color: '#86efac' });
    if (f.run!.t >= 0.9) {
      s.heal(f, f.maxHp * 0.18);
      ring(s, f.pos[0], f.pos[2], 2, '#86efac');
      end(s, f);
    }
  },
});
def({
  id: 'drain_surplus', name: '损有余', sect: 'dixian', icon: '🩸', mp: 25, cd: 12, aiRange: 15, parallel: true,
  desc: '从 18 米内最近的敌人身上牵出一道气血光束，3 秒内每秒抽走其 3.5% 最大生命补给自己。拉开太远就断。',
  cast: (s, f) => {
    const t = s.nearestEnemy(f, 18);
    if (!t) return false;
    f.run = { id: 'drain_surplus', t: 0, data: { target: t.id } };
    s.setAct(f, 'cast', 0.4, 'skill_spell');
    return true;
  },
  tick: (s, f, dt) => {
    // runs alongside walking: it isn't an act, the beam simply stays on
    const r = f.run!;
    const t = s.fighters[r.data.target];
    if (!t || t.hp <= 0 || s.dist(f, t) > 22 || r.t >= 3) {
      f.run = null;
      return;
    }
    r.data.acc = (r.data.acc ?? 0) + t.maxHp * 0.035 * dt;
    if (r.data.acc >= 10) {
      const n = Math.round(r.data.acc);
      r.data.acc = 0;
      const done = s.hit(f, t, n, { stagger: false, noScale: true, color: '#f472b6' });
      if (done) s.heal(f, done);
    }
    if (!s.fx.some((x) => x.kind === 'beam' && x.from === f.id)) s.addFx({ kind: 'beam', x: 0, y: 0, z: 0, max: 0.12, r: 0.1, color: '#f472b6', from: f.id, to: t.id });
    else s.fx.find((x) => x.kind === 'beam' && x.from === f.id)!.t = 0.12;
  },
});
def({
  id: 'earth_spring', name: '地脉回春', sect: 'dixian', icon: '🌿', mp: 30, cd: 14, aiRange: 6,
  desc: '鹤头杖点地，前方展开半径 4.5 米的地脉法阵 8 秒：自己在阵里每秒回复 2% 生命，敌人踏进来被树根缠住 1.2 秒（每人一次）。',
  cast: (s, f) => {
    s.setAct(f, 'cast', 0.5, 'skill_stomp');
    const [x, z] = fwdPoint(s, f, 2.5);
    s.zone(f, 'earth_spring', x, z, 4.5, 8, '#86efac');
    return true;
  },
  zoneTick: (s, f, z, dt) => {
    if (Math.hypot(f.pos[0] - z.x, f.pos[2] - z.z) < z.r) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.02 * dt);
    for (const o of s.inRadius(f, z.x, z.z, z.r)) {
      if (z.touched.includes(o.id)) continue;
      z.touched.push(o.id);
      s.hit(f, o, 25, { root: 1.2, stagger: false });
      s.text(o, '缠住', '#86efac');
    }
  },
});

// ================================================================== 紫禁城
def({
  id: 'edict', name: '金口玉言', sect: 'tianzi', icon: '📜', mp: 25, cd: 9, aiRange: 6,
  desc: '一个金色的「跪」字朝前方飞出（7.5 米扇形）：70 伤害，跪下 1.3 秒，不能移动也放不了技能。',
  cast: (s, f) => {
    s.setAct(f, 'cast', 0.55, 'skill_point');
    const [x, z] = fwdPoint(s, f, 3);
    s.addFx({ kind: 'text', x, y: f.pos[1] + 2, z, max: 0.8, r: 2, color: '#ffd36a', text: '跪' });
    for (const o of s.inCone(f, 7.5, 0.6)) {
      s.hit(f, o, 70, { kneel: 1.3, stagger: false });
      s.text(o, '跪!', '#ffd36a');
    }
    return true;
  },
});
def({
  id: 'phantom_guard', name: '御林冲阵', sect: 'tianzi', icon: '🛡️', mp: 30, cd: 12, aiRange: 12,
  desc: '五名金色御林军虚影持枪向前冲锋 17 米，路上的人被撞飞（每人 100 伤害，只撞一次）。',
  cast: (s, f) => {
    s.setAct(f, 'cast', 0.45, 'skill_raise');
    const [fx, fz] = s.fwd(f);
    const rx = -fz;
    const rz = fx;
    const hitBy = new Set<number>();
    for (let k = -2; k <= 2; k++) {
      const p = s.shoot(f, { skill: 'phantom_guard', speed: 20, life: 0.85, dmg: 100, radius: 0.9, color: '#ffd36a', shape: 'guard', pierce: true, onHit: 'launch', pos: [f.pos[0] + rx * k * 1.1, f.pos[1] + 1, f.pos[2] + rz * k * 1.1] });
      (p as any).shared = hitBy;
    }
    return true;
  },
  projHit: (_s, _f, t, p) => {
    // each person is run down once by the whole line
    const shared: Set<number> = (p as any).shared;
    shared.add(t.id);
  },
});
def({
  id: 'jade_seal', name: '玉玺镇压', sect: 'tianzi', icon: '🟩', mp: 25, cd: 10, aiRange: 16,
  desc: '一方传国玉玺从天而降，砸在 18 米内对手的脚下：地上先亮金圈，0.6 秒后落地，150 伤害并击倒。',
  cast: (s, f) => {
    const t = s.nearestEnemy(f, 18);
    const [x, z] = t ? [t.pos[0], t.pos[2]] : fwdPoint(s, f, 8);
    s.setAct(f, 'cast', 0.5, 'skill_stomp');
    s.zone(f, 'jade_seal', x, z, 2.6, 0.6, '#ffd36a');
    s.addFx({ kind: 'seal', x, y: groundHeight(x, z), z, max: 0.6, r: 2.6, color: '#3fbf6a' });
    return true;
  },
  zoneTick: (s, f, z) => {
    if (z.t > 0) return;
    for (const o of s.inRadius(f, z.x, z.z, z.r)) s.hit(f, o, 150, { launch: 6, fromX: z.x, fromZ: z.z });
    ring(s, z.x, z.z, 3.2, '#ffd36a', 0.5);
    s.addFx({ kind: 'burst', x: z.x, y: z.y + 0.5, z: z.z, max: 0.5, r: 2.5, color: '#c9a24a' });
  },
});


// ================================================================== advanced moves (a hero's 4th, from level 10)
def({
  id: 'blood_rage', name: '血怒', sect: 'kuangren', icon: '🩸', mp: 30, cd: 18, aiRange: 4,
  desc: '怒吼一声进入血怒 8 秒：伤害 +30%，移速 +20%，每次命中吸取 12% 伤害回血。',
  cast: (s, f) => {
    s.setAct(f, 'cast', 0.5, 'skill_stomp');
    f.st.rage = 8;
    ring(s, f.pos[0], f.pos[2], 3, '#ff3b1f');
    s.text(f, '血怒!', '#ff3b1f');
    return true;
  },
});
def({
  id: 'snipe', name: '穿云狙', sect: 'anqi', icon: '🎯', mp: 30, cd: 14, aiRange: 30,
  desc: '站定瞄准 0.6 秒，射出一支穿云弩箭，直线 40 米，穿透所有敌人，各 220 伤害。',
  cast: (s, f) => {
    start(s, f, 'snipe', 'channel', 0.6, 'skill_throw');
    return true;
  },
  tick: (s, f) => {
    if (f.run!.t >= 0.6) {
      s.shoot(f, { skill: 'snipe', speed: 60, life: 0.7, dmg: 220, radius: 0.5, color: '#e0f2fe', shape: 'dart', pierce: true, onHit: 'knock' });
      end(s, f);
    }
  },
});
def({
  id: 'golden_bell_shield', name: '金钟罩', sect: 'fanyin', icon: '🔔', mp: 30, cd: 14, aiRange: 3,
  desc: '金钟罩身 4 秒：受到的伤害降低 65%，不会被打断或击飞。',
  cast: (s, f) => {
    s.setAct(f, 'cast', 0.35, 'skill_stomp');
    f.st.shield = 4;
    ring(s, f.pos[0], f.pos[2], 1.6, '#f5b942', 0.6);
    return true;
  },
});
def({
  id: 'chain_hook', name: '锁链钩', sect: 'yingren', icon: '⛓️', mp: 20, cd: 9, aiRange: 12,
  desc: '甩出铁链钩住前方 13 米内的第一个敌人，把他拽到面前：80 伤害并眩晕 0.8 秒。',
  cast: (s, f) => {
    s.setAct(f, 'cast', 0.4, 'skill_throw');
    s.shoot(f, { skill: 'chain_hook', speed: 32, life: 0.42, dmg: 80, radius: 0.5, color: '#9ca3af', shape: 'dart' });
    return true;
  },
  projHit: (s, f, t) => {
    const [fx, fz] = s.fwd(f);
    t.pos[0] = f.pos[0] + fx * 1.4;
    t.pos[2] = f.pos[2] + fz * 1.4;
    t.pos[1] = Math.max(t.pos[1], groundHeight(t.pos[0], t.pos[2]));
    t.vel = [0, 0, 0];
    t.st.stun = Math.max(t.st.stun, 0.8);
  },
});
def({
  id: 'palace_cage', name: '画地为牢', sect: 'tianzi', icon: '🏯', mp: 30, cd: 16, aiRange: 10,
  desc: '在 15 米内的对手脚下画一座牢（半径 4 米，4 秒）：里面的敌人被定在原地，每秒受 25 伤害。',
  cast: (s, f) => {
    const t = s.nearestEnemy(f, 15);
    const [x, z] = t ? [t.pos[0], t.pos[2]] : fwdPoint(s, f, 6);
    s.setAct(f, 'cast', 0.5, 'skill_slash');
    s.zone(f, 'palace_cage', x, z, 4, 4, '#b91c1c');
    return true;
  },
  zoneTick: (s, f, z, dt) => {
    (z as any).acc = ((z as any).acc ?? 0) + dt;
    for (const o of s.inRadius(f, z.x, z.z, z.r)) o.st.root = Math.max(o.st.root, 0.15);
    if ((z as any).acc >= 1) {
      (z as any).acc = 0;
      for (const o of s.inRadius(f, z.x, z.z, z.r)) s.hit(f, o, 25, { stagger: false });
    }
  },
});
def({
  id: 'short_sell', name: '做空', sect: 'jiaoyi', icon: '📉', mp: 20, cd: 11, aiRange: 14,
  desc: '对 16 米内的对手开空单 6 秒：他的攻击、防御、速度都降低 20%，每秒掉 2.5% 生命，大半赚进你的口袋。',
  cast: (s, f) => {
    const t = s.nearestEnemy(f, 16);
    if (!t) return false;
    s.setAct(f, 'cast', 0.4, 'skill_point');
    t.st.weak = 6;
    s.text(t, 'SHORT ▼', '#ff3b3b');
    f.run = { id: 'short_sell', t: 0, data: { target: t.id } };
    return true;
  },
  parallel: true,
  tick: (s, f, dt) => {
    const r = f.run!;
    const t = s.fighters[r.data.target];
    if (!t || t.hp <= 0 || r.t >= 6) {
      f.run = null;
      return;
    }
    r.data.acc = (r.data.acc ?? 0) + t.maxHp * 0.025 * dt;
    if (r.data.acc >= 12) {
      const done = s.hit(f, t, Math.round(r.data.acc), { stagger: false, noScale: true, color: '#ff3b3b' });
      r.data.acc = 0;
      if (done) s.heal(f, done * 0.6);
    }
  },
});
def({
  id: 'fold_earth', name: '缩地成寸', sect: 'dixian', icon: '👣', mp: 20, cd: 10, aiRange: 0,
  desc: '一步跨出 12 米，途中无敌。逃命赶路都好用。',
  cast: (s, f) => {
    start(s, f, 'fold_earth', 'cast', 0.3, 'skill_dash');
    f.st.invuln = 0.35;
    ring(s, f.pos[0], f.pos[2], 1.4, '#86efac');
    return true;
  },
  move: (s, f) => {
    const [fx, fz] = s.fwd(f);
    f.vel[0] = fx * 40;
    f.vel[2] = fz * 40;
  },
  tick: (s, f) => {
    if (f.run!.t >= 0.3) {
      f.vel[0] = f.vel[2] = 0;
      ring(s, f.pos[0], f.pos[2], 1.4, '#86efac');
      end(s, f);
    }
  },
});

// ================================================================== ultimates (R, from level 30, hold to charge)
def({
  id: 'heaven_collapse', name: '天崩', sect: 'kuangren', icon: '☄️', mp: 50, cd: 25, aiRange: 0, ult: true,
  desc: '纵身跃起，双刃从天砸落：落点 6 米内的敌人受 320 伤害并被击飞。',
  cast: (s, f) => {
    start(s, f, 'heaven_collapse', 'cast', 0, 'skill_flip');
    const [fx, fz] = s.fwd(f);
    f.vel = [fx * 6, 13, fz * 6];
    f.grounded = false;
    f.st.armor = 3;
    return true;
  },
  move: () => {},
  tick: (s, f) => {
    if (f.run!.t > 3) end(s, f);
  },
  land: (s, f) => {
    if (f.run!.t < 0.2) return;
    for (const o of s.inRadius(f, f.pos[0], f.pos[2], 6)) s.hit(f, o, 320, { launch: 10, knock: 6 });
    ring(s, f.pos[0], f.pos[2], 6, '#ff6a1a', 0.6);
    s.addFx({ kind: 'burst', x: f.pos[0], y: f.pos[1] + 0.5, z: f.pos[2], max: 0.5, r: 4, color: '#ff6a1a' });
    f.vel[0] = f.vel[2] = 0;
    f.st.armor = 0;
    f.run = null;
    s.setAct(f, 'cast', 0.45, 'skill_slash');
  },
});
def({
  id: 'rain_of_darts', name: '暴雨梨花', sect: 'anqi', icon: '🌸', mp: 50, cd: 22, aiRange: 0, ult: true, float: true,
  desc: '跃上半空悬停 2 秒，向前方大片区域洒下暴雨般的飞镖，每 0.08 秒一枚（各 26）。',
  cast: (s, f) => {
    start(s, f, 'rain_of_darts', 'cast', 0, 'skill_throw', { next: 0.3 });
    f.vel = [0, 9, 0];
    f.grounded = false;
    return true;
  },
  move: (_s, f) => {
    f.vel[0] = f.vel[2] = 0;
    f.vel[1] = f.run!.t < 0.35 ? 9 * (1 - f.run!.t / 0.35) : 0;
  },
  tick: (s, f) => {
    const r = f.run!;
    while (r.t > r.data.next && r.data.next < 2.3) {
      r.data.next += 0.08;
      const yaw = f.yaw + (Math.random() - 0.5) * 1.1;
      const p = s.shoot(f, { skill: 'rain_of_darts', yaw, speed: 22, life: 0.9, dmg: 26, radius: 0.5, color: '#f9a8d4' });
      p.vel[1] = -6 - Math.random() * 4;
    }
    if (r.t >= 2.4) end(s, f);
  },
});
def({
  id: 'ten_thousand_buddhas', name: '万佛朝宗', sect: 'fanyin', icon: '🧘', mp: 60, cd: 24, aiRange: 0, ult: true,
  desc: '盘坐结印 1 秒，九道巨大掌印接连砸在周围 9 米内：每道 70 伤害，最后一掌击飞。期间霸体。',
  cast: (s, f) => {
    start(s, f, 'ten_thousand_buddhas', 'channel', 0, 'skill_spell', { n: 0 });
    f.st.armor = 2.6;
    return true;
  },
  tick: (s, f) => {
    const r = f.run!;
    while (r.t > 0.8 + r.data.n * 0.18 && r.data.n < 9) {
      r.data.n++;
      const last = r.data.n === 9;
      const a = r.data.n * 2.3;
      const x = last ? f.pos[0] : f.pos[0] + Math.cos(a) * 4.5;
      const z = last ? f.pos[2] : f.pos[2] + Math.sin(a) * 4.5;
      const rr = last ? 9 : 4;
      s.addFx({ kind: 'burst', x, y: groundHeight(x, z) + 0.6, z, max: 0.4, r: rr * 0.6, color: '#f5b942' });
      ring(s, x, z, rr, '#f5b942');
      for (const o of s.inRadius(f, x, z, rr)) s.hit(f, o, 70, last ? { launch: 9, knock: 6, fromX: x, fromZ: z } : { stagger: true });
    }
    if (r.t >= 2.6) end(s, f);
  },
});
def({
  id: 'thousand_shadows', name: '千影杀', sect: 'yingren', icon: '🌑', mp: 55, cd: 22, aiRange: 0, ult: true,
  desc: '化作残影，在 12 米内的敌人之间来回穿梭斩击六次，每斩 95 伤害（必暴击的瞬影也算数）。期间无敌。',
  cast: (s, f) => {
    if (!s.nearestEnemy(f, 12)) return false;
    start(s, f, 'thousand_shadows', 'cast', 0, 'attack_3', { n: 0 });
    f.st.invuln = 1.6;
    return true;
  },
  move: () => {},
  tick: (s, f) => {
    const r = f.run!;
    while (r.t > r.data.n * 0.22 && r.data.n < 6) {
      r.data.n++;
      const foes = s.enemiesOf(f).filter((o) => s.dist(f, o) < 14);
      const t = foes[r.data.n % Math.max(1, foes.length)];
      if (!t) break;
      const a = r.data.n * 2.1;
      f.pos[0] = t.pos[0] + Math.cos(a) * 1.3;
      f.pos[2] = t.pos[2] + Math.sin(a) * 1.3;
      f.pos[1] = Math.max(t.pos[1], groundHeight(f.pos[0], f.pos[2]));
      s.faceTo(f, t.pos[0], t.pos[2]);
      s.hit(f, t, 95, { stagger: true });
      s.addFx({ kind: 'slash', x: t.pos[0], y: t.pos[1] + 1.1, z: t.pos[2], max: 0.2, r: 1.6, color: '#a78bfa', yaw: f.yaw });
    }
    if (r.t >= 1.45) end(s, f);
  },
});
def({
  id: 'true_dragon', name: '真龙降世', sect: 'tianzi', icon: '🐲', mp: 60, cd: 30, aiRange: 0, ult: true,
  desc: '召出一条金龙向前冲出 25 米，龙身所过之处敌人受 350 伤害并被掀飞。',
  cast: (s, f) => {
    s.setAct(f, 'cast', 0.8, 'skill_raise');
    for (let k = 0; k < 7; k++) {
      const p = s.shoot(f, { skill: 'true_dragon', speed: 24, life: 1.05, dmg: 350, radius: 1.6, color: '#ffd36a', shape: 'orb', pierce: true, onHit: 'launch' });
      p.pos[0] -= p.vel[0] * k * 0.04;
      p.pos[2] -= p.vel[2] * k * 0.04;
      p.pos[1] += Math.sin(k) * 0.6;
      (p as any).shared = (s.proj[s.proj.length - 1 - k] as any)?.shared ?? new Set<number>();
    }
    return true;
  },
  projHit: (_s, _f, t, p) => {
    (p as any).shared?.add(t.id);
  },
});
def({
  id: 'black_monday', name: '黑色星期一', sect: 'jiaoyi', icon: '📊', mp: 55, cd: 28, aiRange: 0, ult: true,
  desc: '股市崩盘：25 米内对手的周围接连砸下 10 根 K 线（各 90 伤害），最后一根大阴线砸在他头上（240）。',
  cast: (s, f) => {
    const t = s.nearestEnemy(f, 25);
    s.setAct(f, 'cast', 0.6, 'skill_point');
    f.run = { id: 'black_monday', t: 0, data: { n: 0, target: t ? t.id : -1, x: t ? t.pos[0] : fwdPoint(s, f, 10)[0], z: t ? t.pos[2] : fwdPoint(s, f, 10)[1] } };
    s.toast('黑色星期一：道指单日暴跌 22.6%');
    return true;
  },
  parallel: true,
  tick: (s, f) => {
    const r = f.run!;
    const t = s.fighters[r.data.target];
    while (r.t > 0.3 + r.data.n * 0.2 && r.data.n < 11) {
      r.data.n++;
      const big = r.data.n === 11;
      const cx = t && t.hp > 0 ? t.pos[0] : r.data.x;
      const cz = t && t.hp > 0 ? t.pos[2] : r.data.z;
      const x = big ? cx : cx + (Math.random() - 0.5) * 9;
      const z = big ? cz : cz + (Math.random() - 0.5) * 9;
      const zn = s.zone(f, 'black_monday', x, z, big ? 3 : 1.8, 0.45, '#ef4444');
      (zn as any).dmg = big ? 240 : 90;
    }
    if (r.data.n >= 11 && r.t > 2.8) f.run = null;
  },
  zoneTick: (s, f, z) => {
    if (z.t > 0) return;
    for (const o of s.inRadius(f, z.x, z.z, z.r)) s.hit(f, o, (z as any).dmg ?? 90, { launch: (z as any).dmg > 100 ? 8 : 0, stagger: true, fromX: z.x, fromZ: z.z });
    s.addFx({ kind: 'burst', x: z.x, y: z.y + 1, z: z.z, max: 0.35, r: z.r, color: '#ef4444' });
  },
});
def({
  id: 'mortal_realm', name: '人间不渡', sect: 'dixian', icon: '🕊️', mp: 70, cd: 35, aiRange: 0, ult: true,
  desc: '仙鹤落地，展开半径 8 米的法域 6 秒：自己在里面每秒回复 4% 生命，敌人每秒掉 3% 生命并减速。',
  cast: (s, f) => {
    s.setAct(f, 'cast', 0.7, 'skill_raise');
    s.zone(f, 'mortal_realm', f.pos[0], f.pos[2], 8, 6, '#a7f3d0');
    return true;
  },
  zoneTick: (s, f, z, dt) => {
    if (Math.hypot(f.pos[0] - z.x, f.pos[2] - z.z) < z.r) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.04 * dt);
    (z as any).acc = ((z as any).acc ?? 0) + dt;
    for (const o of s.inRadius(f, z.x, z.z, z.r)) o.st.slow = Math.max(o.st.slow, 0.2);
    if ((z as any).acc >= 0.5) {
      (z as any).acc = 0;
      for (const o of s.inRadius(f, z.x, z.z, z.r)) s.hit(f, o, o.maxHp * 0.015, { stagger: false, noScale: true, color: '#a7f3d0' });
    }
  },
});

export const ALL_SKILL_IDS = Object.keys(SKILLS);

// 巨型首领 (owner: the bosses were small and weak; wanted ones several storeys tall, burly, with big moves you have to
// learn, beaten with helpers): a giant is a den's boss fighter made huge. It never flinches; it works through a list
// of big moves, each shown first as a red mark on the ground (a circle, a ring, a cone, a strip, a scatter of circles)
// that fills as the blow comes, so a roll or a step out of it saves you. After its biggest blows it stands open
// (破绽): everything does double for a few seconds. At two thirds and one third of its life it roars into a new phase
// with new moves (and calls its men). Walking into its ground calls three 援手 to fight beside you; fall and you get up
// at the edge of the ground, the giant keeps its wounds; leave the ground and it heals and goes home.
// Telegraphs live in sim.teles (drawn by render/Telegraphs.tsx); the HUD shows its bar (ui/Hud GiantBar).
import type { Sim } from './sim';
import type { Fighter } from './types';
import { groundHeight } from './world';

export type TeleShape = 'circle' | 'ring' | 'cone' | 'line';
export interface Tele {
  shape: TeleShape;
  x: number;
  z: number;
  yaw: number; // cone / line: pointing along (-sin yaw, -cos yaw)
  r: number; // circle / ring outer / cone and line length
  r2: number; // ring inner / cone half angle (radians) / line half width
  t: number; // seconds since laid
  wind: number; // when it lands
  color: string;
  owner: number;
}

export interface GiantMove {
  id: string;
  name: string; // shouted over its head
  shape: TeleShape;
  /** where the mark goes: on the target, round itself, in front of it toward the target */
  at: 'target' | 'self' | 'front';
  r: number;
  r2?: number;
  /** several marks (a scatter): how many and how far round the target */
  n?: number;
  spread?: number;
  wind: number; // seconds of warning
  dmg: number; // a share of the struck one's full life
  knock?: number;
  launch?: number;
  /** rushes along its line as the blow lands */
  rush?: boolean;
  /** stands open this long after (破绽) */
  open?: number;
  phase: number; // from this phase on
  weight: number;
  anim: string;
  /** what it looks like landing */
  fx: 'slam' | 'rocks' | 'roar' | 'sweep' | 'beam' | 'ice' | 'blood' | 'gold';
  /** calls this many of its men (from its pool) */
  adds?: number;
}
export interface GiantDef {
  key: string;
  name: string;
  scale: number; // the body drawn this many times life size
  bodyR: number; // its girth for blows and for pushing
  bodyH: number;
  hpMul: number; // life against an ordinary boss's
  color: string; // its marks and its rage
  look: 'blood' | 'beast' | 'bronze' | 'gold';
  ground: number; // the radius of its ground
  /** its blows scaled (the first giant is a lesson) */
  soft?: number;
  moves: GiantMove[];
  intro: string; // the toast when you step onto its ground
  phaseLines: string[]; // shouted at phase two and three
}

/** which giant each ring's boss becomes (0: 雷彪's den, 1: 玄阴's, 2: 无面's) */
export const GIANT_OF_RING: Record<number, string> = { 0: 'leibiao' };

export const GIANTS: Record<string, GiantDef> = {
  leibiao: {
    key: 'leibiao',
    name: '血傀 · 雷彪',
    scale: 4.6,
    bodyR: 3.0,
    bodyH: 8.4,
    hpMul: 8,
    color: '#ff3b2f',
    look: 'blood',
    ground: 34,
    soft: 0.7,
    intro: '雷彪的身子被血傀术撑得有三层楼高，血管在皮下一跳一跳。看地上的红圈，等他砸完露出破绽再打！',
    phaseLines: ['血……给我更多的血！', '伪帝许我的，我都要拿到！'],
    moves: [
      { id: 'slam', name: '开山砸', shape: 'circle', at: 'front', r: 5.5, wind: 1.3, dmg: 0.32, launch: 7, knock: 6, open: 2.6, phase: 1, weight: 3, anim: 'attack_3', fx: 'slam' },
      { id: 'sweep', name: '横扫千军', shape: 'cone', at: 'self', r: 9, r2: 1.1, wind: 1.1, dmg: 0.24, knock: 11, phase: 1, weight: 3, anim: 'attack_2', fx: 'sweep' },
      { id: 'charge', name: '蛮牛冲', shape: 'line', at: 'self', r: 18, r2: 2.4, wind: 1.2, dmg: 0.3, knock: 14, rush: true, open: 2.2, phase: 1, weight: 2, anim: 'attack_1', fx: 'slam' },
      { id: 'boulders', name: '飞石雨', shape: 'circle', at: 'target', r: 2.6, n: 5, spread: 7, wind: 1.6, dmg: 0.22, knock: 5, phase: 1, weight: 2, anim: 'skill_slash', fx: 'rocks' },
      { id: 'roar', name: '血吼', shape: 'ring', at: 'self', r: 14, r2: 4, wind: 1.4, dmg: 0.2, knock: 16, phase: 2, weight: 2, anim: 'skill_slash', fx: 'roar', adds: 3 },
      { id: 'pools', name: '血池', shape: 'circle', at: 'target', r: 3.4, n: 4, spread: 9, wind: 1.9, dmg: 0.26, launch: 5, phase: 2, weight: 2, anim: 'attack_3', fx: 'blood' },
      { id: 'quake', name: '地裂三连', shape: 'line', at: 'self', r: 22, r2: 1.8, n: 3, spread: 0.55, wind: 1.3, dmg: 0.3, launch: 8, open: 3.2, phase: 3, weight: 3, anim: 'attack_3', fx: 'slam' },
    ],
  },
};

// ---- what other code asks of a body
export const giantOf = (f: Fighter | undefined | null): GiantDef | undefined => ((f as any)?.giant ? GIANTS[(f as any).giant.key] : undefined);
/** how far a body reaches out from its centre (0 for anyone but a giant) */
export const bodyR = (f: Fighter) => giantOf(f)?.bodyR ?? 0;
export const bodyH = (f: Fighter) => giantOf(f)?.bodyH ?? 2.1;

interface GState {
  key: string;
  phase: number;
  move: { m: GiantMove; t: number; marks: Tele[]; done: boolean; rushTo?: [number, number] } | null;
  cd: number;
  open: number; // 破绽 left
  awake: boolean;
  helpers: number[];
  adds: number[];
  roarT: number;
}
const G = (f: Fighter) => (f as any).giant as GState;

/** makes a den's boss into a giant (called once when the den is made) */
export function makeGiant(s: Sim, f: Fighter, key: string) {
  const def = GIANTS[key];
  (f as any).giant = { key, phase: 1, move: null, cd: 2, open: 0, awake: false, helpers: [], adds: [], roarT: 0 } as GState;
  f.name = def.name;
  f.maxHp = f.hp = Math.round(f.maxHp * def.hpMul);
  // its men for the later phases, benched till called
  const st = G(f);
  for (let k = 0; k < 4; k++) {
    const a = (s as any).make('sect', null, '血傀喽啰', 'foe-bandit.glb', Math.max(1, f.level - 2), f.pos[0], f.pos[2]);
    a.hp = 0;
    (a as any).benched = true;
    (a as any).pooled = true;
    (a as any).den = (f as any).den;
    st.adds.push(a.id);
  }
  // three 援手 who come when you step onto its ground
  const names = ['援手 · 赵铁枪', '援手 · 孙二娘', '援手 · 石大胆'];
  for (let k = 0; k < 3; k++) {
    const h = (s as any).make('ally', null, names[k], 'ally-militia.glb', f.level, f.pos[0], f.pos[2]);
    h.hp = 0;
    (h as any).benched = true;
    (h as any).helper = f.id;
    st.helpers.push(h.id);
  }
}

const near = (s: Sim, f: Fighter, def: GiantDef) => {
  const p = s.player, [hx, hz] = f.home ?? [f.pos[0], f.pos[2]];
  // fallen on its ground: it waits for you to get up (and keeps its wounds)
  if (p.hp <= 0) return !!(p as any).giantRes && s.giantFight === f.id;
  // it wakes when you step onto its ground; once awake it lets you go only well beyond it (a blow can throw you out)
  const r = (f as any).giant?.awake ? def.ground + 18 : def.ground;
  return s.indoor < 0 && Math.hypot(p.pos[0] - hx, p.pos[2] - hz) < r;
};
function foesOf(s: Sim, f: Fighter) {
  return s.fighters.filter((o) => (o.team === 'player' || o.team === 'ally') && o.hp > 0 && !(o as any).benched && !(o as any).away);
}
const inTele = (m: Tele, x: number, z: number, pad = 0.4) => {
  const dx = x - m.x, dz = z - m.z, d = Math.hypot(dx, dz);
  if (m.shape === 'circle') return d < m.r + pad;
  if (m.shape === 'ring') return d < m.r + pad && d > m.r2 - pad;
  const fx = -Math.sin(m.yaw), fz = -Math.cos(m.yaw);
  const along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
  if (m.shape === 'line') return along > -1 && along < m.r + pad && side < m.r2 + pad;
  // cone
  return d < m.r + pad && (d < 1 || Math.acos(Math.max(-1, Math.min(1, along / d))) < m.r2);
};
export { inTele };

/** is this spot inside any mark about to land (helpers step out of them) */
export function underTele(s: Sim, x: number, z: number) {
  return s.teles.find((m) => m.t < m.wind && inTele(m, x, z, 0.8));
}

/** the giant's mind, every frame (instead of the bandit's) */
export function giantThink(s: Sim, f: Fighter, dt: number) {
  const def = giantOf(f)!, st = G(f), a = f as any;
  a.wish = [0, 0];
  if (f.hp <= 0) return;
  const [hx, hz] = f.home ?? [f.pos[0], f.pos[2]];
  // asleep until you come onto its ground; leave it and it goes home and heals
  if (!near(s, f, def)) {
    // a few seconds' grace before it gives up on you
    if (st.awake && ((f as any).leaveT = ((f as any).leaveT ?? 0) + dt) < 6) return;
    (f as any).leaveT = 0;
    if (st.awake) {
      st.awake = false;
      st.move = null;
      s.teles = s.teles.filter((m) => m.owner !== f.id);
      for (const id of st.helpers) bench(s.fighters[id]);
      s.giantFight = -1;
    }
    f.aggro = false;
    const d = Math.hypot(hx - f.pos[0], hz - f.pos[2]);
    if (d > 1) a.wish = [((hx - f.pos[0]) / d) * 0.6, ((hz - f.pos[2]) / d) * 0.6];
    f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.08 * dt);
    if (f.hp >= f.maxHp) st.phase = 1;
    return;
  }
  (f as any).leaveT = 0;
  if (!st.awake) {
    st.awake = true;
    st.cd = 1.6;
    f.aggro = true;
    s.giantFight = f.id;
    s.toast(def.intro);
    s.shake(0.6, f.pos[0], f.pos[2]);
    callHelpers(s, f);
  }
  f.aggro = true;
  st.open = Math.max(0, st.open - dt);
  // a new phase at two thirds and one third: a roar, a breath, harder moves
  const want = f.hp < f.maxHp * 0.34 ? 3 : f.hp < f.maxHp * 0.67 ? 2 : 1;
  if (want > st.phase) {
    st.phase = want;
    st.move = null;
    s.teles = s.teles.filter((m) => m.owner !== f.id);
    st.open = 0;
    st.roarT = 1.6;
    st.cd = 1.8;
    f.st.invuln = 1.6;
    s.text(f, def.phaseLines[want - 2] ?? '吼！', def.color);
    s.toast(`${def.name}：${def.phaseLines[want - 2] ?? '吼！'}`);
    s.shake(0.9, f.pos[0], f.pos[2]);
    s.vfx('ring', [f.pos[0], f.pos[1] + 0.2, f.pos[2]], 12, def.color, 0.9, 0.2, 1.4);
    s.setAct(f, 'cast', 1.6, 'skill_slash');
    // the shout throws everyone near back
    for (const o of foesOf(s, f)) {
      const d = s.dist(o, f);
      if (d < def.bodyR + 5) s.hit(f, o, 1, { knock: 12, noScale: true, stagger: true, fromX: f.pos[0], fromZ: f.pos[2] });
    }
    callAdds(s, f, 2 + want);
    return;
  }
  if (st.roarT > 0) {
    st.roarT -= dt;
    return;
  }
  const foes = foesOf(s, f);
  let t: Fighter | null = null, bd = Infinity;
  for (const o of foes) {
    const d = s.dist(o, f) - (o.id === s.player.id ? 1.5 : 0); // you, a little before the others
    if (d < bd) {
      bd = d;
      t = o;
    }
  }
  if (!t) return;
  if (st.move) return runMove(s, f, def, st, t, dt);
  // between moves: turn on its target, close in a little
  s.faceTo(f, t.pos[0], t.pos[2]);
  const d = s.dist(t, f);
  if (d > def.bodyR + 5) {
    const dx = (t.pos[0] - f.pos[0]) / d, dz = (t.pos[2] - f.pos[2]) / d;
    a.wish = [dx * 0.55, dz * 0.55];
  }
  if ((st.cd -= dt) > 0 || st.open > 0) return;
  // the next move: from those its phase knows, the near ones liked when you're close, the far ones when you're not
  const pool = def.moves.filter((m) => m.phase <= st.phase && !(m.id === (a.lastMove ?? '')));
  let total = 0;
  const w = pool.map((m) => {
    const reach = m.at === 'target' ? 30 : m.shape === 'line' ? m.r : m.r + def.bodyR;
    const k = (d < reach ? 1 : 0.15) * m.weight * (m.phase === st.phase && st.phase > 1 ? 1.6 : 1);
    total += k;
    return k;
  });
  let roll = Math.random() * total, m = pool[0];
  for (let i = 0; i < pool.length; i++) if ((roll -= w[i]) <= 0) {
    m = pool[i];
    break;
  }
  a.lastMove = m.id;
  startMove(s, f, def, st, m, t);
}

function startMove(s: Sim, f: Fighter, def: GiantDef, st: GState, m: GiantMove, t: Fighter) {
  s.faceTo(f, t.pos[0], t.pos[2]);
  const fx = -Math.sin(f.yaw), fz = -Math.cos(f.yaw);
  const marks: Tele[] = [];
  const lay = (shape: TeleShape, x: number, z: number, yaw: number, r: number, r2: number) => {
    const T: Tele = { shape, x, z, yaw, r, r2, t: 0, wind: m.wind, color: def.color, owner: f.id };
    marks.push(T);
    s.teles.push(T);
  };
  const n = m.n ?? 1;
  if (m.at === 'target') {
    for (let k = 0; k < n; k++) {
      // the first on you, the rest scattered round (one leads where you're running)
      const a = k === 0 ? 0 : Math.random() * Math.PI * 2, rr = k === 0 ? 0 : 2 + Math.random() * (m.spread ?? 6);
      const lead = k === 1 ? 1.2 : 0;
      lay(m.shape, t.pos[0] + Math.cos(a) * rr + t.vel[0] * lead, t.pos[2] + Math.sin(a) * rr + t.vel[2] * lead, f.yaw, m.r, m.r2 ?? 0);
    }
  } else if (m.at === 'front') {
    const off = def.bodyR + m.r * 0.6;
    lay(m.shape, f.pos[0] + fx * off, f.pos[2] + fz * off, f.yaw, m.r, m.r2 ?? 0);
  } else {
    for (let k = 0; k < n; k++) {
      const yaw = f.yaw + (n > 1 ? (k - (n - 1) / 2) * (m.spread ?? 0.5) : 0);
      lay(m.shape, f.pos[0], f.pos[2], yaw, m.r + (m.shape === 'cone' ? def.bodyR : 0), m.r2 ?? 0);
    }
  }
  st.move = { m, t: 0, marks, done: false };
  if (m.rush) st.move.rushTo = [f.pos[0] + fx * (m.r - 2), f.pos[2] + fz * (m.r - 2)];
  s.setAct(f, 'cast', m.wind + 0.6, m.anim);
  s.text(f, m.name, def.color);
}

function runMove(s: Sim, f: Fighter, def: GiantDef, st: GState, _t: Fighter, dt: number) {
  const mv = st.move!, m = mv.m;
  mv.t += dt;
  if (!mv.done && mv.t >= m.wind) {
    mv.done = true;
    // the blow lands on whoever is still in a mark (a roll's moment of grace saves you)
    const struck = new Set<number>();
    for (const mk of mv.marks) {
      for (const o of foesOf(s, f)) {
        if (struck.has(o.id) || !inTele(mk, o.pos[0], o.pos[2], 0.3)) continue;
        struck.add(o.id);
        if (o.st.invuln > 0) {
          s.text(o, '闪', '#e5e7eb');
          continue;
        }
        const share = (o.team === 'player' ? m.dmg : m.dmg * 0.6) * (def.soft ?? 1);
        s.hit(f, o, o.maxHp * share, { noScale: true, knock: m.knock, launch: m.launch, down: m.launch ? 0.9 : undefined, heavy: true, fromX: mk.shape === 'circle' ? mk.x : f.pos[0], fromZ: mk.shape === 'circle' ? mk.z : f.pos[2], color: def.color });
      }
      landFx(s, f, def, m, mk);
    }
    if (m.rush && mv.rushTo) {
      const [x, z] = mv.rushTo;
      f.pos = [x, groundHeight(x, z), z];
    }
    if (m.adds) callAdds(s, f, m.adds);
    if (m.open) {
      st.open = m.open;
      s.text(f, '破绽！', '#fde047');
      s.vfx('ring', [f.pos[0], f.pos[1] + def.bodyH * 0.6, f.pos[2]], def.bodyR + 1, '#fde047', 0.6, 0.15, m.open);
    }
  }
  if (mv.t >= m.wind + 0.5) {
    s.teles = s.teles.filter((x) => !mv.marks.includes(x));
    st.move = null;
    st.cd = (st.phase === 3 ? 0.7 : st.phase === 2 ? 1.0 : 1.4) + Math.random() * 0.6;
  }
}

function landFx(s: Sim, f: Fighter, def: GiantDef, m: GiantMove, mk: Tele) {
  const y = groundHeight(mk.x, mk.z) + 0.15;
  s.shake(m.fx === 'roar' || m.fx === 'slam' ? 0.8 : 0.5, mk.x, mk.z);
  if (mk.shape === 'circle') {
    s.vfx('ring', [mk.x, y, mk.z], mk.r * 1.2, def.color, 0.9, 0.15, 0.6);
    s.vfx('sparkBurst', [mk.x, y + 0.4, mk.z], 26, m.fx === 'rocks' ? '#9a8b7a' : def.color, 7, 0.12, 'up', 0.9);
  } else if (mk.shape === 'ring') {
    s.vfx('ring', [mk.x, y, mk.z], mk.r, def.color, 1, 0.25, 0.8);
    s.vfx('ring', [mk.x, y + 0.5, mk.z], mk.r * 0.7, '#ffffff', 0.6, 0.15, 0.5);
  } else {
    // a strip or a fan: bursts along it
    const fx = -Math.sin(mk.yaw), fz = -Math.cos(mk.yaw);
    for (let k = 1; k <= 6; k++) {
      const u = (k / 6) * mk.r;
      s.vfx('sparkBurst', [mk.x + fx * u, groundHeight(mk.x + fx * u, mk.z + fz * u) + 0.3, mk.z + fz * u], 10, def.color, 5, 0.1, 'up', 0.7);
    }
  }
}

function callAdds(s: Sim, f: Fighter, n: number) {
  const st = G(f);
  let c = 0;
  for (const id of st.adds) {
    if (c >= n) break;
    const a = s.fighters[id];
    if (a.hp > 0) continue;
    const ang = Math.random() * Math.PI * 2, r = giantOf(f)!.bodyR + 4;
    const x = f.pos[0] + Math.cos(ang) * r, z = f.pos[2] + Math.sin(ang) * r;
    a.pos = [x, groundHeight(x, z), z];
    a.hp = a.maxHp;
    a.home = [x, z];
    (a as any).benched = false;
    a.aggro = true;
    a.respawn = undefined;
    s.setAct(a, 'idle', 0, 'idle');
    c++;
  }
  if (c) s.text(f, '给我上！', '#fca5a5');
}

function callHelpers(s: Sim, f: Fighter) {
  const st = G(f), p = s.player;
  st.helpers.forEach((id, k) => {
    const h = s.fighters[id];
    const a = p.yaw + Math.PI + (k - 1) * 0.7;
    const x = p.pos[0] + Math.sin(a) * 3, z = p.pos[2] + Math.cos(a) * 3;
    h.pos = [x, groundHeight(x, z), z];
    h.level = Math.max(h.level, s.progress.level);
    h.maxHp = 120 + s.progress.level * 60;
    h.hp = h.maxHp;
    (h as any).benched = false;
    h.respawn = undefined;
    s.setAct(h, 'idle', 0, 'idle');
  });
  s.toast('三位援手赶到：「我们来帮你！」');
}
function bench(h: Fighter | undefined) {
  if (!h) return;
  h.hp = 0;
  (h as any).benched = true;
  h.respawn = undefined;
}

/** a 援手's mind: keep to the giant's side, out of the red, strike when it's open or when there's no mark under them */
export function helperThink(s: Sim, h: Fighter, dt: number) {
  const a = h as any;
  a.wish = [0, 0];
  if (h.hp <= 0 || a.benched) return;
  const g = s.fighters[a.helper];
  if (!g || g.hp <= 0) {
    // the giant is down: they bow out
    if ((a.byeT = (a.byeT ?? 3) - dt) <= 0) {
      bench(h);
      a.byeT = undefined;
    }
    return;
  }
  const def = giantOf(g)!;
  // in a mark: get out of it, away from where it's centred
  const mk = underTele(s, h.pos[0], h.pos[2]);
  if (mk) {
    let dx = h.pos[0] - mk.x, dz = h.pos[2] - mk.z;
    if (mk.shape === 'line' || mk.shape === 'cone') {
      const fx = -Math.sin(mk.yaw), fz = -Math.cos(mk.yaw);
      const side = dx * fz - dz * fx >= 0 ? 1 : -1;
      dx = fz * side;
      dz = -fx * side;
    } else if (mk.shape === 'ring') {
      dx = -dx;
      dz = -dz; // into the eye of the ring
    }
    const d = Math.hypot(dx, dz) || 1;
    a.wish = [dx / d, dz / d];
    return;
  }
  // otherwise its other adds first, then the giant itself
  let t: Fighter = g, bd = s.dist(h, g) - def.bodyR;
  for (const o of s.fighters) {
    if (o.team !== 'sect' || o.hp <= 0 || (o as any).benched || o === g) continue;
    const d = s.dist(o, h);
    if (d < 8 && d < bd) {
      bd = d;
      t = o;
    }
  }
  const reach = (t === g ? def.bodyR : 0) + 1.8;
  const d = s.dist(h, t);
  if (d > reach) {
    a.wish = [(t.pos[0] - h.pos[0]) / d, (t.pos[2] - h.pos[2]) / d];
    return;
  }
  h.aiT = (h.aiT ?? 0) - dt;
  if (!s.free(h) || h.aiT > 0) return;
  s.faceTo(h, t.pos[0], t.pos[2]);
  s.attack(h, false);
  h.aiT = 0.8 + Math.random() * 0.6;
}

/** the giant takes its blows: double while open, never knocked about */
export function giantTakes(f: Fighter, dmg: number) {
  const st = G(f);
  return st.open > 0 ? dmg * 2 : dmg;
}
export const giantOpen = (f: Fighter) => G(f)?.open ?? 0;
export const giantPhase = (f: Fighter) => G(f)?.phase ?? 1;
/** keep bodies out of a giant's girth */
export function pushFromGiants(s: Sim) {
  for (const g of s.fighters) {
    const def = giantOf(g);
    if (!def || g.hp <= 0) continue;
    for (const o of s.fighters) {
      if (o === g || o.hp <= 0 || (o as any).benched || (o as any).away) continue;
      const dx = o.pos[0] - g.pos[0], dz = o.pos[2] - g.pos[2], d = Math.hypot(dx, dz), R = def.bodyR + 0.45;
      if (d >= R || Math.abs(o.pos[1] - g.pos[1]) > def.bodyH) continue;
      const k = d < 1e-3 ? 1 : (R - d) / d;
      o.pos[0] += (d < 1e-3 ? R : dx * k);
      o.pos[2] += d < 1e-3 ? 0 : dz * k;
    }
  }
}
/** marks age; where you get up when you fall on a giant's ground */
export function stepTeles(s: Sim, dt: number) {
  for (const m of s.teles) m.t += dt;
}
export function giantRespawn(s: Sim): [number, number] | null {
  const g = s.fighters[s.giantFight];
  if (!g || g.hp <= 0) return null;
  const def = giantOf(g)!, [hx, hz] = g.home ?? [g.pos[0], g.pos[2]];
  const p = s.player, dx = p.pos[0] - hx, dz = p.pos[2] - hz, d = Math.hypot(dx, dz) || 1;
  const r = def.ground - 6;
  return [hx + (dx / d) * r, hz + (dz / d) * r];
}

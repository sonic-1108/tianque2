// 铸兵 on the sim: what each foe leaves (dropsOf, giveMats), forging and reforging up the stages (fwBlock / fwForge),
// and what the weapon in your hand does: wpnPre before a blow (金's crits, 土's weight), wpnHit after it, wpnSwing on the
// third cut of a combo, wpnKill, wpnDodge, wpnStep each frame. Data in mats.ts.
import type { HitOpts, Sim } from './sim';
import type { Fighter } from './types';
import { AFFINITY, CRIT, EL, GRADE_NAME, GUARD, LEECH, MATS, QI, RESONANCE, SPEED, STAGES, fwId, fwName, matId, matName, parseFw, recipe, type El } from './mats';
import { save, type Progress } from './progress';
import { heroOf } from './heroes';
import { bag, done, purse } from './play';
import { addDotRaw, kitWorld } from './kit';
import { groundHeight } from './world';
import { gearById } from './jianghu';

const ME = 0;
export const houseOf = (P: Progress) => heroOf(P.hero)?.house ?? null;

// ================================================================ the weapon in hand
export interface Wield {
  el: El;
  n: number;
  /** the effect's strength: the stage's, more with 共鸣 */
  k: number;
  res: boolean;
}
export function wielded(P: Progress): Wield | null {
  const w = parseFw(P.equip?.weapon);
  if (!w) return null;
  const res = AFFINITY[houseOf(P) ?? ''] === w.el;
  return { el: w.el, n: w.n, k: STAGES[w.n - 1].k * (res ? RESONANCE : 1), res };
}
/** what a forged weapon adds to the worn total (jianghu.ts gearOf) */
export function fwStats(el: El, n: number) {
  const i = n - 1;
  return { dmg: STAGES[i].dmg, spd: el === 'wind' ? SPEED[i] : 0, def: el === 'earth' ? GUARD[i] : 0, leech: el === 'wood' ? LEECH[i] : 0, mp: el === 'water' ? QI[i] : 0 };
}
/** the swing's time, a 风 weapon in hand: quicker */
export function wpnSwingK(s: Sim) {
  const w = wielded(s.progress);
  return w?.el === 'wind' ? 1 / (1 + SPEED[w.n - 1] * (w.res ? RESONANCE : 1)) : 1;
}
/** the highest stage of an element's line you own (0: none) */
export function ownedStage(P: Progress, el: El) {
  let best = 0;
  for (const id of P.gear ?? []) {
    const w = parseFw(id);
    if (w && w.el === el && w.n > best) best = w.n;
  }
  return best;
}

// ================================================================ forging
/** why 张大锤 won't make this stage now (null: he will). `atSmith` false: only the forge itself is missing */
export function fwBlock(s: Sim, el: El, n: number, atSmith: boolean): string | null {
  const P = s.progress, st = STAGES[n - 1], B = bag(P), cur = ownedStage(P, el);
  if (cur >= n) return '已经有了';
  if (n > 1 && cur !== n - 1) return `先铸出${STAGES[n - 2].name}`;
  if (st.pro && !P.hero) return '转职之后才能铸';
  if (P.level < st.lvl) return `${st.lvl} 级才压得住`;
  if (purse(P) < st.coins) return '铜钱不够';
  for (const [m, k] of Object.entries(recipe(el, n))) if ((B[m] ?? 0) < k) return `${matName(m)}不够`;
  if (!atSmith) return '去张记铁铺找张大锤';
  return null;
}
/** forge the stage (a stage above the first is the one below, reforged: it takes its place, in the hand too) */
export function fwForge(s: Sim, el: El, n: number): boolean {
  if (fwBlock(s, el, n, true)) return false;
  const P = s.progress, B = bag(P), st = STAGES[n - 1];
  P.coins = purse(P) - st.coins;
  for (const [m, k] of Object.entries(recipe(el, n))) B[m] -= k;
  const G = (P.gear ??= []), E = (P.equip ??= {});
  const old = n > 1 ? fwId(el, n - 1) : null, id = fwId(el, n);
  const wasOn = !!old && E.weapon === old;
  if (old) {
    const i = G.indexOf(old);
    if (i >= 0) G.splice(i, 1);
  }
  G.push(id);
  // into the hand when it was there before, or the hand holds something weaker
  const cur = E.weapon ? gearDmg(E.weapon) : -1;
  if (wasOn || cur < st.dmg) E.weapon = id;
  const name = fwName(el, n, houseOf(P));
  s.toast(n === 1 ? `张大锤：“${name}，成了！”` : `张大锤：“回炉重铸，${name}出炉！”（${st.name}）`);
  s.chron(`张大锤为你${n === 1 ? '铸了一柄' : '把兵器重铸成了'}${name}（${EL[el].name} · ${st.name}）。`);
  s.vfx('sound', 'gong');
  const p = s.player;
  s.vfx('sparkBurst', [p.pos[0], p.pos[1] + 1.2, p.pos[2]], 40, EL[el].color, 7, 0.1, 'up', 1.2);
  s.vfx('ring', [p.pos[0], p.pos[1] + 0.06, p.pos[2]], 2.2, EL[el].color, 0.7, 0.18, 0.4);
  if (n === 3 && !P.hero) s.pushNote({ title: '三阶已是散人的极限', text: `${name}已经铸到了三阶。\n\n散人百家都学，却不精一家，兵器也只压得住三阶。转职之后，这柄兵器还能重铸到四阶、五阶，一阶比一阶凶。` });
  if (n === 5) s.pushNote({ title: `${name} · 五阶`, text: `炉火烧了三天三夜。张大锤把锤子一扔，坐在地上半天没说话。\n\n“这辈子打的最后一件好东西。”他说。\n\n五阶异象「${EL[el].ult[0]}」：${EL[el].ult[1]}。` });
  save(P);
  return true;
}
/** a worn weapon's damage bonus (forged or not), to tell which is better */
function gearDmg(id: string) {
  const w = parseFw(id);
  if (w) return STAGES[w.n - 1].dmg;
  return gearById(id)?.dmg ?? 0;
}

// ================================================================ what foes leave
const KIND_EL: Record<string, El> = { 山贼: 'fire', 女飞贼: 'wind', 野和尚: 'earth', 刺客: 'venom', 伪朝禁军: 'thunder', 奸商: 'metal', 妖道: 'wood', 水寇: 'water' };
/** names that say more than the kind (a giant's men wear borrowed bodies) */
const NAME_EL: [RegExp, El][] = [
  [/铜甲机关兵/, 'metal'],
  [/金甲|巡逻|关卡|禁军/, 'thunder'],
  [/魔影/, 'venom'],
  [/血傀喽啰/, 'fire'],
  [/水寇/, 'water'],
  [/玄阴/, 'wood'],
  [/毒娘子/, 'venom'],
];
/** each great foe's 极 */
export const GIANT_X: Record<string, El> = { leibiao: 'fire', tianlang: 'ice', tongren: 'metal', fadi: 'thunder', tianmo: 'venom', kuhan: 'earth', jiao: 'water' };
export function foeEl(s: Sim, def: Fighter): El | null {
  for (const [re, el] of NAME_EL) if (re.test(def.name)) return el;
  const k = s.kindOf(def);
  return k ? KIND_EL[k.name] ?? null : null;
}
/** the elements' share of what a fallen foe leaves (jianghu.ts adds iron, hide and 玄铁) */
export function dropsOf(s: Sim, def: Fighter): [string, number][] {
  const a = def as any, D = done(s.progress), out: [string, number][] = [];
  const add = (id: string, n: number) => n > 0 && out.push([id, n]);
  const daily = (key: string) => {
    if (D['x:' + key] === s.clock.day) return false;
    D['x:' + key] = s.clock.day;
    return true;
  };
  // the great foes: their 极 once a day, their 精 and 粗 every time
  const gk = a.giant?.key as string | undefined;
  if (gk && GIANT_X[gk]) {
    const el = GIANT_X[gk];
    if (daily(gk)) add(matId(el, 2), 1);
    add(matId(el, 1), 2);
    add(matId(el, 0), 4);
    if (gk === 'kuhan') add(matId('ice', 1), 1);
    return out;
  }
  if (a.jianhun) {
    if (daily('jianhun')) add(matId('wind', 2), 1);
    add(matId('wind', 1), 2);
    add(matId('metal', 0), 3);
    return out;
  }
  const el = foeEl(s, def);
  if (!el) return out;
  if (/玄阴真人/.test(def.name)) {
    add(matId('wood', 1), 1);
    if (Math.random() < 0.3 && daily('xuanyin')) add(matId('wood', 2), 1);
    return out;
  }
  if (a.rival !== undefined || a.boss || a.elite) {
    add(matId(el, 1), 2);
    add(matId(el, 0), 3);
    return out;
  }
  if (/队长|校尉|教头|统领|头领/.test(def.name)) {
    add(matId(el, 1), 1);
    add(matId(el, 0), 2);
    return out;
  }
  // the men: their kind's 粗 most times (now and then two further out), 精 rarely, more often the further out
  const lvl = def.level;
  if (Math.random() < Math.min(0.9, 0.62 + lvl * 0.01)) add(matId(el, 0), 1 + (lvl >= 14 && Math.random() < 0.35 ? 1 : 0));
  if (Math.random() < (lvl >= 20 ? 0.06 : lvl >= 10 ? 0.03 : 0.012)) add(matId(el, 1), 1);
  return out;
}
/** into the bag, said over your head; 精 and 极 get a word of their own, and a first find goes into the atlas */
export function giveMats(s: Sim, got: [string, number][], plain = '#d6c7a1') {
  if (!got.length) return;
  const P = s.progress, B = bag(P), D = done(P);
  let col = plain, best = -1;
  for (const [m, n] of got) {
    B[m] = (B[m] ?? 0) + n;
    const M = MATS[m];
    if (!M) continue;
    if (M.grade > best) {
      best = M.grade;
      col = EL[M.el].color;
    }
    if (!D['seen:' + m]) {
      D['seen:' + m] = 1;
      s.toast(`图谱新录：${M.name}（${EL[M.el].name} · ${GRADE_NAME[M.grade]}）  按 G 看兵器图谱`);
    } else if (M.grade === 2) s.toast(`得到极料：${M.name}！`);
    else if (M.grade === 1) s.toast(`得到精料：${M.name}`);
    if (M.grade === 2) s.chron(`你得到了一块${M.name}。`);
  }
  s.text(s.player, got.map(([m, n]) => `${matName(m)} +${n}`).join('  '), col);
  save(P);
}
/** a catch on the line sometimes brings up a mussel, and the big fish carry 蛟鳞 */
export function fishMats(s: Sim, fish: string) {
  const got: [string, number][] = [];
  if (Math.random() < 0.3) got.push([matId('water', 0), 1]);
  if ((fish === 'sturgeon' || fish === 'goldcarp') ? Math.random() < 0.6 : Math.random() < 0.03) got.push([matId('water', 1), 1]);
  giveMats(s, got);
}
/** a snow wolf down */
export function wolfMats(s: Sim) {
  const got: [string, number][] = [];
  if (Math.random() < 0.75) got.push([matId('ice', 0), 1]);
  if (Math.random() < 0.05) got.push([matId('ice', 1), 1]);
  giveMats(s, got);
}

// ================================================================ the weapon's effects in a fight
interface Ring {
  x: number;
  z: number;
  t: number;
  tick: number;
  dmg: number;
}
interface WState {
  hits: number;
  tideT: number;
  lifeCd: number;
  regen: { t: number; rate: number; fx: number } | null;
  fires: Ring[];
  winds: Ring[];
}
const wst = (s: Sim): WState => ((s as any).wpnSt ??= { hits: 0, tideT: 0, lifeCd: 0, regen: null, fires: [], winds: [] });
interface TState {
  chill: number;
  chillT: number;
  ven: number;
  venT: number;
  zapT: number;
  splT: number;
}
const tst = (f: Fighter): TState => ((f as any).wpn ??= { chill: 0, chillT: -9, ven: 0, venT: -9, zapT: -9, splT: -9 });
/** the ones who shrug off what the men don't (no freezing, binding or dazing them) */
const tough = (f: Fighter) => {
  const a = f as any;
  return !!(a.boss || a.giant || a.elite || a.rival !== undefined);
};
const live = (o: Fighter) => o.hp > 0 && !(o as any).benched && !(o as any).away;
function around(s: Sim, att: Fighter, x: number, z: number, r: number, but?: Fighter) {
  return s.enemiesOf(att).filter((o) => o !== but && live(o) && Math.hypot(o.pos[0] - x, o.pos[2] - z) < r + ((o as any).giant ? 2.5 : 0));
}
/** in front of the attacker: a cone (cos) out to r */
function ahead(s: Sim, att: Fighter, r: number, cos: number) {
  const [fx, fz] = s.fwd(att);
  return s.enemiesOf(att).filter((o) => {
    if (!live(o)) return false;
    const dx = o.pos[0] - att.pos[0], dz = o.pos[2] - att.pos[2], d = Math.hypot(dx, dz);
    return d < r + ((o as any).giant ? 2.5 : 0) && (d < 1 || (dx * fx + dz * fz) / d > cos);
  });
}
/** an effect's own blow: a fixed amount, no stagger unless asked, never setting off more effects */
function zap(s: Sim, att: Fighter, o: Fighter, n: number, color: string, opts: HitOpts = {}) {
  return s.hit(att, o, Math.max(1, Math.round(n)), { noScale: true, stagger: false, color, ...opts });
}
const P3 = (x: number, y: number, z: number): [number, number, number] => [x, y, z];
const chest = (f: Fighter, dy = 1.1) => P3(f.pos[0], f.pos[1] + dy, f.pos[2]);
const feet = (f: Fighter) => P3(f.pos[0], groundHeight(f.pos[0], f.pos[2]) + 0.06, f.pos[2]);
const dotOn = (s: Sim, f: Fighter, kind: 'burn' | 'poison') => kitWorld(s).dots.some((d) => d.tgt === f.id && d.kind === kind && d.t > 0);
/** what a third cut would do: the strength the swing effects are measured by */
const baseHit = (s: Sim) => 52 * s.power(s.player);

/** before a blow of yours lands: 金 cuts through 霸体 and crits, 土 pushes harder. Returns the blow's multiplier and the
 * options it lands with (a copy: callers reuse theirs) */
export function wpnPre(s: Sim, att: Fighter, _def: Fighter, o: HitOpts): { mult: number; o: HitOpts } {
  const w = wielded(s.progress);
  if (!w) return { mult: 1, o };
  if (w.el === 'metal') {
    const crit = Math.random() < CRIT[w.n - 1] * (w.res ? RESONANCE : 1);
    return { mult: crit ? 2 : 1, o: { ...o, breakArmor: true, crit: o.crit || crit, heavy: o.heavy || crit, wcrit: crit } };
  }
  if (w.el === 'earth' && o.knock) return { mult: 1, o: { ...o, knock: o.knock * 1.3 } };
  return { mult: 1, o };
}

/** after a blow of yours lands (dmg done): the element's effect */
export function wpnHit(s: Sim, att: Fighter, def: Fighter, dmg: number, o: HitOpts) {
  const w = wielded(s.progress);
  if (!w || att.id !== ME) return;
  const W = wst(s), T = tst(def), k = w.k, n = w.n, col = EL[w.el].color;
  W.hits++;
  switch (w.el) {
    case 'fire':
      if (def.hp > 0 && Math.random() < 0.3 + 0.05 * n) {
        addDotRaw(s, att, def, dmg * 0.1 * k, 3, 'burn', 3);
        s.vfx('embers', chest(def, 0.6), 12, col, 0.45, 2.8, 0.08);
        s.vfx('flash', chest(def), '#ff8a3a', 2.5, 0.12, 5);
      }
      return;
    case 'ice': {
      if ((def as any).frozen && n >= 3 && def.hp > 0) {
        // 碎冰: the ice breaks with them in it
        s.thaw(def, true);
        zap(s, att, def, dmg * 1.0 * k, '#e6f8ff', { heavy: true, crit: true });
        for (const o2 of around(s, att, def.pos[0], def.pos[2], 3, def)) zap(s, att, o2, dmg * 0.35 * k, col, { slow: 1.5 });
        s.vfx('iceSpikes', feet(def), 1.5, 9, 0.9, 0.7);
        s.vfx('sparkBurst', chest(def), 30, '#e8f8ff', 8, 0.1);
        s.text(def, '碎冰', col);
        T.chill = 0;
        return;
      }
      if (def.hp <= 0) return;
      def.st.slow = Math.max(def.st.slow, 1.2);
      if (s.time - T.chillT > 3.5) T.chill = 0;
      if (s.time - T.chillT > 0.15) {
        T.chill++;
        T.chillT = s.time;
        s.vfx('sparkBurst', chest(def), 8, col, 3, 0.06);
      }
      if (T.chill >= (n >= 4 ? 3 : 4)) {
        T.chill = 0;
        if (!tough(def) && !(def as any).frozen) {
          s.freeze(def, 0.8 + 0.15 * n);
          s.text(def, '冻住', col);
        } else {
          def.st.slow = Math.max(def.st.slow, 2.5);
          s.vfx('ring', feet(def), 1.4, col, 0.5, 0.14, 0.3);
        }
      }
      return;
    }
    case 'thunder': {
      if (s.time - T.zapT > 0.5 && Math.random() < [0.2, 0.22, 0.25, 0.28, 0.3][n - 1]) {
        T.zapT = s.time;
        const [x, y, z] = def.pos;
        s.vfx('kitBeam', P3(x + (Math.random() - 0.5) * 1.5, y + 11, z + (Math.random() - 0.5) * 1.5), P3(x, y + 0.6, z), 0.55, col, 0.3, 'fushi');
        s.vfx('flash', P3(x, y + 1.5, z), '#cfe0ff', 6, 0.18, 10);
        s.vfx('sparkBurst', chest(def), 18, '#e6f0ff', 7, 0.07);
        if (def.hp > 0) zap(s, att, def, dmg * 0.5 * k, col, { stun: (def as any).giant ? 0 : 0.25 });
        // 连闪: the bolt jumps on to the nearest
        let from = def;
        const hit = new Set([def.id]);
        for (let j = 0; j < (n >= 5 ? 4 : n >= 3 ? 3 : 1); j++) {
          const next = around(s, att, from.pos[0], from.pos[2], 6).filter((o2) => !hit.has(o2.id)).sort((a, b) => s.dist(a, from) - s.dist(b, from))[0];
          if (!next) break;
          hit.add(next.id);
          s.vfx('kitBeam', chest(from), chest(next), 0.35, col, 0.28, 'fushi');
          zap(s, att, next, dmg * 0.35 * k, col, { stun: (next as any).giant ? 0 : 0.2 });
          from = next;
        }
        s.vfx('sound', 'thunder');
      }
      // 九霄: every sixth blow, three bolts out of the sky round the one struck
      if (n >= 5 && W.hits % 6 === 0) {
        const cx = def.pos[0], cz = def.pos[2];
        for (let j = 0; j < 3; j++) {
          const a = Math.random() * Math.PI * 2, r = j ? 1.5 + Math.random() * 1.5 : 0;
          const bx = cx + Math.cos(a) * r, bz = cz + Math.sin(a) * r, by = groundHeight(bx, bz);
          s.later(j * 0.12, () => {
            s.vfx('kitBeam', P3(bx, by + 14, bz), P3(bx, by + 0.1, bz), 0.9, col, 0.4, 'fushi');
            s.vfx('flash', P3(bx, by + 2, bz), '#dfe6ff', 12, 0.25, 14);
            s.vfx('ring', P3(bx, by + 0.06, bz), 2.2, col, 0.45, 0.16, 0.3);
            s.vfx('sparkBurst', P3(bx, by + 0.3, bz), 26, '#eef2ff', 9, 0.08, 'up', 1.3);
            s.vfx('sound', 'slam');
            s.shake(0.35, bx, bz);
            for (const o2 of around(s, att, bx, bz, 2.2)) zap(s, att, o2, dmg * 0.6 * k, col, { stun: (o2 as any).giant ? 0 : 0.3 });
          });
        }
        s.text(s.player, '九霄', col);
      }
      return;
    }
    case 'venom': {
      if (def.hp <= 0 || Math.random() > 0.45) return;
      addDotRaw(s, att, def, dmg * 0.08 * k, 5, 'poison', 3);
      if (s.time - T.venT > 6) T.ven = 0;
      T.ven++;
      T.venT = s.time;
      s.vfx('embers', chest(def, 0.8), 6, col, 0.3, 1.2, 0.07);
      if (n >= 3 && T.ven >= 4) def.st.weak = Math.max(def.st.weak, 1.5); // 腐甲
      if (T.ven >= 5) {
        // 毒爆
        T.ven = 0;
        zap(s, att, def, dmg * 0.7 * k, col, { heavy: true });
        for (const o2 of around(s, att, def.pos[0], def.pos[2], 3, def)) zap(s, att, o2, dmg * 0.35 * k, col);
        s.vfx('dustPuff', chest(def, 0.6), 22, 1.4, 2.4, 1.1, '#3f6f2a');
        s.vfx('sparkBurst', chest(def), 28, col, 7, 0.09);
        s.vfx('kitSigil', feet(def), 3, col, 0.8, 1.5, 'duzong');
        s.text(def, '毒爆', col);
        s.vfx('sound', 'poison');
      }
      return;
    }
    case 'metal':
      if (!o.wcrit) return;
      s.vfx('slashMark', chest(def), '#fff3c4', 1.2, 0.16);
      s.vfx('sparkBurst', chest(def), 22, col, 8, 0.08);
      // 剑气: the crit throws a crescent of golden light through the line
      if (n >= 3) {
        const pr = s.shoot(att, { look: 'crescent', speed: 28, life: 0.32, dmg: 52 * 0.5 * k, shape: 'knife', pierce: true, color: col, radius: 0.85, knock: 3 });
        pr.mult = 1;
        (pr as any).wpn = true;
      }
      // 万剑: three swords of light fall on those nearby
      if (n >= 5) {
        const ts = around(s, att, def.pos[0], def.pos[2], 8).slice(0, 3);
        ts.forEach((t, j) =>
          s.later(0.12 + j * 0.1, () => {
            if (t.hp <= 0) return;
            const [x, y, z] = t.pos;
            s.vfx('kitBeam', P3(x, y + 9, z), P3(x, y + 0.4, z), 0.7, col, 0.32, 'jianke');
            s.vfx('sparkBurst', P3(x, y + 0.5, z), 20, '#fff3c4', 7, 0.08, 'up', 1);
            s.vfx('ring', feet(t), 1.2, col, 0.4, 0.12, 0.3);
            zap(s, att, t, dmg * 0.6 * k, col, { heavy: true });
          }),
        );
      }
      return;
    case 'wood':
      if (n >= 3 && def.hp > 0 && !tough(def) && Math.random() < 0.15) {
        def.st.root = Math.max(def.st.root, 1.2);
        s.vfx('kitSigil', feet(def), 1.4, col, 1.2, 0.6, 'dixian');
        s.vfx('spiral', P3(def.pos[0], def.pos[1], def.pos[2]), 0.7, s.time * 9, col);
        s.text(def, '藤缚', col);
      }
      if (Math.random() < 0.3) s.vfx('gather', chest(s.player), 4, col, 1.2, 0.35, 0.07);
      return;
    case 'water': {
      att.mp = Math.min(att.maxMp, att.mp + [2, 2, 3, 3, 4][n - 1]);
      if (s.time - T.splT < 0.15) return;
      T.splT = s.time;
      const near = around(s, att, def.pos[0], def.pos[2], 2.5, def).slice(0, 4);
      for (const o2 of near) zap(s, att, o2, dmg * 0.2 * k, col);
      s.vfx('ring', feet(def), 1.6 + near.length * 0.2, col, 0.4, 0.1, 0.15);
      s.vfx('sparkBurst', chest(def, 0.7), 12, '#bfe6ff', 4, 0.07, 'up', 0.9);
      return;
    }
    case 'wind':
      s.vfx('sparkBurst', chest(def), 6, col, 5, 0.05);
      return;
    case 'earth':
      if (Math.random() < 0.4) s.vfx('dustPuff', feet(def), 5, 0.4, 1.6, 0.6, '#b8956a');
      return;
  }
}

/** the strike of a basic cut of yours (combo 0, 1, 2): on the third, the element's own move */
export function wpnSwing(s: Sim, f: Fighter, combo: number) {
  if (combo !== 2 || f.id !== ME) return;
  const w = wielded(s.progress);
  if (!w) return;
  const W = wst(s), k = w.k, n = w.n, col = EL[w.el].color, B = baseHit(s);
  const [fx, fz] = s.fwd(f), yaw = Math.atan2(-fx, -fz);
  const cx = f.pos[0] + fx * 1.4, cz = f.pos[2] + fz * 1.4, gy = groundHeight(cx, cz);
  switch (w.el) {
    case 'wind': {
      // 风刃 (三阶: through everyone; 五阶: three in a fan)
      const yaws = n >= 5 ? [-0.32, 0, 0.32] : [0];
      for (const dy of yaws) {
        const pr = s.shoot(f, { look: 'crescent', speed: 26, life: 0.42, dmg: 52 * 0.22 * k, yaw: yaw + dy, shape: 'knife', pierce: n >= 3, color: col, radius: 0.85, knock: 2.5 });
        pr.mult = 1;
        (pr as any).wpn = true;
      }
      s.vfx('kitArc', P3(f.pos[0], f.pos[1] + 1, f.pos[2]), yaw, 2.4, 1.1, col, 0.3, 0, 'gongshou');
      return;
    }
    case 'earth': {
      // 镇岳: the ground jumps under the cut
      const r = 3.2;
      s.vfx('groundSlam', P3(cx, gy + 0.05, cz), 0.8, col);
      s.vfx('rocks', P3(cx, gy + 0.05, cz), 10, 6, 0.12);
      s.vfx('dustPuff', P3(cx, gy + 0.1, cz), 14, 1.2, 3, 0.9, '#b8956a');
      s.vfx('kitArc', P3(cx, gy + 0.08, cz), yaw, r, Math.PI, col, 0.45, 0, 'quanshi');
      s.shake(0.3, cx, cz);
      for (const o of around(s, f, cx, cz, r)) zap(s, f, o, B * 0.25 * k, col, { knock: 7, fromX: cx, fromZ: cz, stagger: true, dur: 0.45, daze: n >= 3 && !tough(o) ? 0.6 : undefined });
      // 不周: a ring of stone spikes throws them up
      if (n >= 5) {
        s.later(0.12, () => {
          s.vfx('stoneSpikes', P3(cx, gy, cz), 4.2, 16, 1.6, 1.1);
          s.vfx('sound', 'slam');
          s.shake(0.45, cx, cz);
          for (const o of around(s, f, cx, cz, 4.2)) zap(s, f, o, B * 0.35 * k, col, { launch: (o as any).giant ? 0 : 6, knock: 3, fromX: cx, fromZ: cz, stagger: true });
        });
      }
      return;
    }
    case 'water': {
      // 沧溟 (五阶, every eight seconds): the wave becomes a flood; 回澜 (三阶): a wave
      const big = n >= 5 && W.tideT <= 0;
      if (!big && n < 3) return;
      if (big) W.tideT = 8;
      const r = big ? 7.5 : 4.5;
      s.vfx('kitArc', P3(f.pos[0], f.pos[1] + 0.3, f.pos[2]), yaw, r, big ? 0.9 : 0.75, col, big ? 0.7 : 0.5, 0, big ? 'fanyin' : 'qinshi');
      s.vfx('chargeWave', P3(f.pos[0], gy + 0.1, f.pos[2]), P3(fx, 0, fz), col);
      s.vfx('sparkBurst', P3(cx, gy + 0.5, cz), big ? 50 : 24, '#cfefff', big ? 9 : 6, 0.09, 'up', 1.2);
      if (big) {
        s.vfx('ring', P3(f.pos[0], gy + 0.06, f.pos[2]), 3, col, 0.6, 0.2, 0.3);
        s.vfx('sound', 'waveCrash');
        s.text(f, '沧溟', col);
      }
      for (const o of ahead(s, f, r, big ? 0.35 : 0.5)) zap(s, f, o, B * (big ? 0.9 : 0.3) * k, col, big ? { launch: (o as any).giant ? 0 : 6, knock: 9, stagger: true } : { knock: 6, slow: 1, stagger: true, dur: 0.4 });
      return;
    }
    case 'fire':
      // 焚天: a ring of fire where the cut lands
      if (n < 5) return;
      W.fires.push({ x: cx, z: cz, t: 3, tick: 0, dmg: B * 0.12 * k });
      s.vfx('kitSigil', P3(cx, gy, cz), 2.8, col, 3, 0.8, 'kuangren');
      s.vfx('fireColumn', P3(cx, gy, cz), 2.2, col);
      return;
    case 'ice': {
      // 霜天: a row of ice spikes out ahead
      if (n < 5) return;
      const L = 7.5, tx = f.pos[0] + fx * L, tz = f.pos[2] + fz * L;
      s.vfx('iceLine', P3(f.pos[0] + fx, gy, f.pos[2] + fz), P3(tx, groundHeight(tx, tz), tz), 1.2, 16, 1.4, 1.0);
      for (const o of s.enemiesOf(f)) {
        if (!live(o)) continue;
        const dx = o.pos[0] - f.pos[0], dz = o.pos[2] - f.pos[2], along = dx * fx + dz * fz, across = Math.abs(dx * fz - dz * fx);
        if (along < 0 || along > L + 0.5 || across > 1.4 + ((o as any).giant ? 2 : 0)) continue;
        zap(s, f, o, B * 0.8 * k, col, { slow: 2 });
        const T = tst(o);
        T.chill += 2;
        T.chillT = s.time;
        if (T.chill >= 3 && !tough(o) && !(o as any).frozen) {
          T.chill = 0;
          s.freeze(o, 1.5);
        }
      }
      return;
    }
  }
}

/** a foe you felled: 木 gives back life, a burning foe bursts (火 三阶), a poisoned one's 蛊 fly on (毒 五阶) */
export function wpnKill(s: Sim, att: Fighter, def: Fighter) {
  if (att.id !== ME) return;
  const w = wielded(s.progress);
  if (!w) return;
  const k = w.k, n = w.n, col = EL[w.el].color, p = s.player;
  if (w.el === 'wood' && p.hp > 0) {
    s.heal(p, p.maxHp * [0.03, 0.035, 0.04, 0.05, 0.06][n - 1] * (w.res ? RESONANCE : 1));
    s.vfx('gather', chest(p), 14, col, 1.6, 0.4, 0.08);
  }
  if (w.el === 'fire' && n >= 3 && dotOn(s, def, 'burn')) {
    const [x, , z] = def.pos, gy = groundHeight(x, z);
    s.vfx('fireColumn', P3(x, gy, z), 2.4, col);
    s.vfx('flash', P3(x, gy + 1.2, z), '#ff8a3a', 14, 0.25, 10);
    s.vfx('embers', P3(x, gy + 0.4, z), 30, col, 1.6, 3.5, 0.09);
    s.vfx('ring', P3(x, gy + 0.06, z), 3.5, col, 0.5, 0.18, 0.3);
    s.vfx('sound', 'boom');
    s.text(def, '爆燃', col);
    for (const o of around(s, att, x, z, 3.5, def)) {
      zap(s, att, o, baseHit(s) * 0.6 * k, col, { knock: 4, fromX: x, fromZ: z, stagger: true });
      addDotRaw(s, att, o, baseHit(s) * 0.1 * k, 3, 'burn', 3);
    }
  }
  if (w.el === 'venom' && n >= 5 && dotOn(s, def, 'poison')) {
    const ts = around(s, att, def.pos[0], def.pos[2], 7, def).sort((a, b) => s.dist(a, def) - s.dist(b, def)).slice(0, 3);
    for (const t of ts) {
      s.vfx('kitBeam', chest(def), chest(t), 0.3, col, 0.4, 'duzong');
      addDotRaw(s, att, t, baseHit(s) * 0.1 * k, 5, 'poison', 3);
      const T = tst(t);
      T.ven = Math.min(4, T.ven + 3);
      T.venT = s.time;
    }
    if (ts.length) s.text(def, '万蛊', col);
  }
}

/** a roll: 风 五阶 leaves a whirlwind behind that drags foes in */
export function wpnDodge(s: Sim, f: Fighter) {
  if (f.id !== ME) return;
  const w = wielded(s.progress);
  if (!w || w.el !== 'wind' || w.n < 5) return;
  wst(s).winds.push({ x: f.pos[0], z: f.pos[2], t: 1.6, tick: 0, dmg: baseHit(s) * 0.15 * w.k });
}

/** each frame: the rings of fire, the whirlwinds, 长生 */
export function wpnStep(s: Sim, dt: number) {
  const W = (s as any).wpnSt as WState | undefined;
  const w = wielded(s.progress);
  if (!W && !w) return;
  const S = wst(s), p = s.player;
  S.tideT -= dt;
  S.lifeCd -= dt;
  for (const r of S.fires) {
    r.t -= dt;
    r.tick -= dt;
    if (r.tick > 0) continue;
    r.tick = 0.5;
    const gy = groundHeight(r.x, r.z), col = EL.fire.color;
    for (let j = 0; j < 5; j++) {
      const a = (j / 5) * Math.PI * 2 + s.time;
      s.vfx('fireColumn', P3(r.x + Math.cos(a) * 2.3, gy, r.z + Math.sin(a) * 2.3), 1.1, col);
    }
    s.vfx('embers', P3(r.x, gy + 0.2, r.z), 16, col, 2, 2.6, 0.08);
    for (const o of around(s, p, r.x, r.z, 2.7)) {
      zap(s, p, o, r.dmg, col);
      addDotRaw(s, p, o, r.dmg * 0.4, 2, 'burn', 3);
    }
  }
  S.fires = S.fires.filter((r) => r.t > 0);
  for (const r of S.winds) {
    r.t -= dt;
    r.tick -= dt;
    const col = EL.wind.color;
    for (const o of around(s, p, r.x, r.z, 4)) {
      if (tough(o)) continue;
      const dx = r.x - o.pos[0], dz = r.z - o.pos[2], d = Math.hypot(dx, dz) || 1;
      o.vel[0] = (dx / d) * 5;
      o.vel[2] = (dz / d) * 5;
    }
    if (r.tick > 0) continue;
    r.tick = 0.3;
    const gy = groundHeight(r.x, r.z);
    s.vfx('spiral', P3(r.x, gy, r.z), 1.4, s.time * 14, col);
    s.vfx('dustPuff', P3(r.x, gy + 0.2, r.z), 8, 1.2, 3, 0.6, '#cfe9dc');
    for (const o of around(s, p, r.x, r.z, 2.2)) zap(s, p, o, r.dmg, col);
  }
  S.winds = S.winds.filter((r) => r.t > 0);
  // 长生: low on life, the spring wood answers
  if (w?.el === 'wood' && w.n >= 5 && p.hp > 0 && p.hp < p.maxHp * 0.35 && S.lifeCd <= 0) {
    S.lifeCd = 45;
    S.regen = { t: 4, rate: (p.maxHp * 0.25) / 4, fx: 0 };
    s.text(p, '长生', EL.wood.color);
    s.vfx('kitSigil', feet(p), 3, EL.wood.color, 4, 0.6, 'dixian');
    s.vfx('sound', 'chime');
  }
  if (S.regen) {
    const R = S.regen;
    R.t -= dt;
    if (p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + R.rate * dt);
    R.fx -= dt;
    if (R.fx <= 0) {
      R.fx = 0.4;
      s.vfx('embers', P3(p.pos[0], p.pos[1] + 0.2, p.pos[2]), 10, EL.wood.color, 0.8, 2.2, 0.08);
    }
    if (R.t <= 0) S.regen = null;
  }
}

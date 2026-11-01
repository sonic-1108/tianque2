// The player's growth, saved in this browser (the 百业 rules): level and experience, skill points, the moves learned
// and their levels, the six on the bar, and whether you are a 散人 or a hero.
//   skill points: 3, plus 2 a level
//   a hero: its own five moves, levels 1-10 (6-10 cost 2 points each); the 4th from level 10, the ultimate from 30
//   a 散人: every house's three basic moves, levels 1-5, never an ultimate; may 转职 at level 30
import { HEROES, HIGH_LEVEL, HeroId, LOW_SKILLS, TRANSFER_LEVEL, ULT_LEVEL, heroOf } from './heroes';

export interface Progress {
  chosen: boolean; // picked at the start screen
  hero: HeroId | null; // null = 散人
  level: number;
  xp: number;
  skills: Record<string, number>;
  bar: string[]; // 1 2 3 4 5 R ('' = empty)
  /** the main story: which quest, how far into it, and whether it's been taken / finished */
  quest: { idx: number; count: number; state: 'offered' | 'active' | 'ready' };
}

const KEY = 'tq2_progress_v2';
export const MAX_LEVEL = 30;
export const xpFor = (level: number) => 60 + level * 45;
export const stepCost = (l: number) => (l <= 5 ? 1 : 2);
export const costTo = (l: number) => {
  let c = 0;
  for (let k = 1; k <= l; k++) c += stepCost(k);
  return c;
};
export const spTotal = (p: Progress) => 3 + 2 * (p.level - 1);
export const spUsed = (p: Progress) => Object.values(p.skills).reduce((a, l) => a + costTo(l), 0);
export const spFree = (p: Progress) => spTotal(p) - spUsed(p);
export const skillPower = (lvl: number) => (lvl <= 0 ? 0 : 0.85 + 0.04 * lvl);

export function fresh(): Progress {
  return { chosen: false, hero: null, level: 1, xp: 0, skills: {}, bar: ['', '', '', '', '', ''], quest: { idx: 0, count: 0, state: 'offered' } };
}
export function load(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (p && typeof p.level === 'number') return { ...fresh(), ...p, quest: p.quest ?? fresh().quest, bar: [...(p.bar || []), '', '', '', '', '', ''].slice(0, 6) };
  } catch {
    /* private window */
  }
  return fresh();
}
export function save(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private window: this session only */
  }
}

/** a move's level cap for this player right now (0 = can't learn it), and why not */
export function capOf(p: Progress, id: string): { cap: number; why: string } {
  const h = heroOf(p.hero);
  if (h) {
    const k = h.tree.indexOf(id);
    if (k < 0) return { cap: 0, why: '不是本职业的招' };
    if (k === 4 && p.level < ULT_LEVEL) return { cap: 0, why: `${ULT_LEVEL} 级解锁大招` };
    if (k === 3 && p.level < HIGH_LEVEL) return { cap: 0, why: `${HIGH_LEVEL} 级解锁` };
    return { cap: 10, why: '' };
  }
  if (!LOW_SKILLS.includes(id)) return { cap: 0, why: '散人学不了' };
  return { cap: 5, why: '' };
}

export function learn(p: Progress, id: string): string | null {
  const lv = p.skills[id] ?? 0;
  const { cap, why } = capOf(p, id);
  if (!cap) return why;
  if (lv >= cap) return '已满级';
  if (spFree(p) < stepCost(lv + 1)) return '技能点不够';
  p.skills[id] = lv + 1;
  if (lv === 0) {
    const ult = heroOf(p.hero)?.tree[4] === id;
    const slot = ult ? 5 : p.bar.slice(0, 5).indexOf('');
    if (slot >= 0 && !p.bar[slot]) p.bar[slot] = id;
  }
  save(p);
  return null;
}

export function resetSkills(p: Progress) {
  p.skills = {};
  p.bar = ['', '', '', '', '', ''];
  save(p);
}

/** pick at the start, or 转职 from 散人 at 30: that hero's moves keep their points, the rest come back */
export function chooseHero(p: Progress, hero: HeroId | null): string | null {
  if (p.chosen) {
    if (p.hero) return '已经转职，不能再换';
    if (!hero) return null;
    if (p.level < TRANSFER_LEVEL) return `${TRANSFER_LEVEL} 级才能转职`;
  }
  p.chosen = true;
  p.hero = hero;
  const h = heroOf(hero);
  if (h) {
    p.skills = Object.fromEntries(Object.entries(p.skills).filter(([id]) => h.tree.includes(id)));
    p.bar = p.bar.map((id) => (h.tree.includes(id) ? id : ''));
  }
  save(p);
  return null;
}

/** add experience; returns how many levels were gained */
export function gainXp(p: Progress, n: number) {
  let ups = 0;
  p.xp += n;
  while (p.level < MAX_LEVEL && p.xp >= xpFor(p.level)) {
    p.xp -= xpFor(p.level);
    p.level++;
    ups++;
  }
  if (p.level >= MAX_LEVEL) p.xp = 0;
  return ups;
}

export const playerMaxHp = (level: number) => 500 + level * 45;
export const playerPower = (level: number) => 1 + (level - 1) * 0.06;
export { HEROES };

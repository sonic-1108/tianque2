// What lives out there: bandit dens scattered over the map, tougher the further from the village. Each den is one
// kind of outlaw, fighting with one house's moves (the models are the old heroes' bodies).
import type { SectId } from './types';

export interface FoeKind {
  name: string;
  model: string;
  house: SectId;
  ranged: boolean;
  color: string;
  skills: string[];
}
export const FOE_KINDS: FoeKind[] = [
  { name: '山贼', model: 'berserker.glb', house: 'kuangren', ranged: false, color: '#e0452b', skills: ['earth_cleave', 'bull_charge', 'whirlwind_blade'] },
  { name: '飞镖客', model: 'ranger.glb', house: 'anqi', ranged: true, color: '#2dd4bf', skills: ['pin_dart', 'boomerang', 'swallow_flip'] },
  { name: '野和尚', model: 'monk.glb', house: 'fanyin', ranged: false, color: '#f5b942', skills: ['vajra_palm', 'zen_domain', 'six_syllable_mantra'] },
  { name: '刺客', model: 'shadowblade.glb', house: 'yingren', ranged: false, color: '#a78bfa', skills: ['shadow_step', 'fan_knives', 'burrow'] },
  { name: '逃兵', model: 'emperor.glb', house: 'tianzi', ranged: false, color: '#ffd36a', skills: ['edict', 'jade_seal', 'phantom_guard'] },
  { name: '骗子', model: 'trader.glb', house: 'jiaoyi', ranged: true, color: '#4ade80', skills: ['rolex_throw', 'make_it_rain'] },
  { name: '妖道', model: 'dixian.glb', house: 'dixian', ranged: false, color: '#86efac', skills: ['drain_surplus', 'earth_spring', 'qingfeng'] },
];

export interface Den {
  x: number;
  z: number;
  kind: number;
  level: number;
  count: number;
  boss: boolean;
}
export const DEN_R = 14;

/** fixed layout: three rings of dens round the village; one boss den per ring */
export const DENS: Den[] = (() => {
  const out: Den[] = [];
  const rings = [
    { r: 55, n: 5, lvl: 1 },
    { r: 105, n: 7, lvl: 8 },
    { r: 160, n: 9, lvl: 18 },
  ];
  let k = 0;
  rings.forEach((ring, ri) => {
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * Math.PI * 2 + ri * 0.7;
      out.push({ x: Math.cos(a) * ring.r, z: Math.sin(a) * ring.r, kind: k++ % FOE_KINDS.length, level: ring.lvl + Math.floor((i / ring.n) * (ri === 2 ? 12 : 6)), count: 3 + (i % 2), boss: i === ring.n - 1 });
    }
  });
  return out;
})();

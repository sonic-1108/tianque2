// What lives out there: bandit dens scattered over the map, tougher the further from the village. Each den is one
// kind of outlaw, fighting with one house's moves (the models are the old heroes' bodies).
import type { SectId } from './types';
import { ROAD_N, roadAngle, roadPoint } from './layout';
import { mapWater } from './mapsample';

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

/** three rings of dens out along the roads (just off them), tougher further out; one boss den per ring */
export const DENS: Den[] = (() => {
  const out: Den[] = [];
  const rings = [
    { r: 150, n: 7, lvl: 1, span: 6 },
    { r: 420, n: 7, lvl: 9, span: 8 },
    { r: 720, n: 7, lvl: 18, span: 11 },
  ];
  let kind = 0;
  rings.forEach((ring, ri) => {
    for (let i = 0; i < ring.n; i++) {
      const road = (i + ri * 3) % ROAD_N;
      const r = ring.r + ((i * 37) % 60) - 30;
      const [x, z] = roadPoint(road, r);
      const a = roadAngle(road, r);
      let side = i % 2 ? 1 : -1;
      const off = 34; // beside the road, not on it
      // never in (or right beside) the river: try the other side of the road, then further along
      let dx = x - Math.sin(a) * off * side, dz = z + Math.cos(a) * off * side;
      const wet = (px: number, pz: number) => [0, 1, 2, 3, 4, 5, 6, 7].some((k) => mapWater(px + Math.cos(k * 0.785) * 30, pz + Math.sin(k * 0.785) * 30) > 0.1) || mapWater(px, pz) > 0.05;
      if (wet(dx, dz)) {
        side = -side;
        dx = x - Math.sin(a) * off * side;
        dz = z + Math.cos(a) * off * side;
      }
      for (let k = 1; k < 8 && wet(dx, dz); k++) {
        const [x2, z2] = roadPoint(road, r + k * 25);
        dx = x2 - Math.sin(a) * off * side;
        dz = z2 + Math.cos(a) * off * side;
      }
      out.push({ x: dx, z: dz, kind: kind++ % FOE_KINDS.length, level: ring.lvl + Math.floor((i / ring.n) * ring.span), count: 3 + (i % 2), boss: i === ring.n - 1 });
    }
  });
  return out;
})();

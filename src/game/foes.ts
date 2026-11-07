// What lives out there: bandit dens scattered over the map, tougher the further from the village. Each den is one
// kind of outlaw, fighting with one house's moves (the models are the old heroes' bodies).
import type { SectId } from './types';
import { ROAD_N, roadAngle, roadPoint, tqWorld } from './layout';
import { mapWater } from './mapsample';

export interface FoeKind {
  name: string;
  model: string;
  house: SectId;
  ranged: boolean;
  color: string;
  skills: string[];
  boss?: string; // the boss's own name
  bossModel?: string; // the boss's body when it isn't the men's
}
export const FOE_KINDS: FoeKind[] = [
  { name: '山贼', model: 'berserker.glb', house: 'kuangren', ranged: false, color: '#e0452b', skills: ['earth_cleave', 'bull_charge', 'whirlwind_blade'] },
  { name: '女飞贼', model: 'ranger.glb', house: 'anqi', ranged: true, color: '#2dd4bf', skills: ['pin_dart', 'boomerang', 'swallow_flip'] },
  { name: '野和尚', model: 'monk.glb', house: 'fanyin', ranged: false, color: '#f5b942', skills: ['vajra_palm', 'zen_domain', 'six_syllable_mantra'] },
  { name: '刺客', model: 'shadowblade.glb', house: 'yingren', ranged: false, color: '#a78bfa', skills: ['shadow_step', 'fan_knives', 'burrow'] },
  { name: '伪朝禁军', model: 'guard.glb', bossModel: 'emperor.glb', house: 'tianzi', ranged: false, color: '#ffd36a', skills: ['edict', 'jade_seal', 'phantom_guard'] },
  { name: '奸商', model: 'trader.glb', house: 'jiaoyi', ranged: true, color: '#4ade80', skills: ['rolex_throw', 'make_it_rain'] },
  { name: '妖道', model: 'dixian.glb', house: 'dixian', ranged: false, color: '#86efac', skills: ['drain_surplus', 'earth_spring', 'qingfeng'] },
];

export interface Den {
  x: number;
  z: number;
  kind: number;
  level: number;
  count: number;
  boss: boolean;
  road: number; // the road it sits beside
  r: number; // how far along that road
  ring: number; // 0, 1, 2 out from the village; 3 = 天阙
  name?: string; // the men's name when it isn't the kind's
  bossName?: string;
  peak?: boolean; // 天阙: on the mesa (the ground isn't flattened to the valley floor)
}
/** the story's bosses: one per ring (the ring's last den), then the false emperor on 天阙 */
const RING_BOSS: { kind: number; bossName: string }[] = [
  { kind: 0, bossName: '黑风寨主 · 雷彪' },
  { kind: 6, bossName: '玄阴真人' },
  { kind: 3, bossName: '影阁主 · 无面' },
];
export const TQ_DEN = 21;
/** the name a den's boss goes by */
export const bossNameOf = (d: Den) => d.bossName ?? FOE_KINDS[d.kind].boss ?? FOE_KINDS[d.kind].name + '头目';
export const menNameOf = (d: Den) => d.name ?? FOE_KINDS[d.kind].name;
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
      const boss = i === ring.n - 1;
      const k = kind++ % FOE_KINDS.length;
      out.push({ x: dx, z: dz, kind: boss ? RING_BOSS[ri].kind : k, level: ring.lvl + Math.floor((i / ring.n) * ring.span), count: 3 + (i % 2), boss, road, r, ring: ri, bossName: boss ? RING_BOSS[ri].bossName : undefined });
    }
  });
  // 天阙: the false emperor and his gold-armoured guard
  const [tx, tz] = tqWorld(0, 16); // in the courtyard before the hall
  out.push({ x: tx, z: tz, kind: 4, level: 30, count: 4, boss: true, road: 4, r: 872, ring: 3, name: '金甲卫', bossName: '伪帝 · 萧承乾', peak: true });
  return out;
})();

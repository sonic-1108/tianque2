// 传送阵 (owner: a gate in every part of the map, so nobody has to run so far): a ring of carved stone with the
// eight trigrams on it, in 青石村's square, beside every waystation, at a roadside pavilion on each outer road, outside
// 永安城, at the foot of 天阙古道, by 断剑冢 and at 雪岭's camp. Walk near one and it lights for good (the village's
// is lit from the start); press F on a lit one to step out at any other lit one. Drawn by render/Gates.tsx, listed
// by ui/Games.tsx (panel 'gates'), marked 传 on the maps.
import type { Sim } from './sim';
import { ROAD_N, roadFrame, TQ_ROAD, GD_ARCH_R } from './layout';
import { PLACES } from './places';
import { CT_R, CT_ROAD } from './court';
import { WATER_Y, groundHeight, inBuilding } from './world';
import { SNOW_CAMP } from './snow';
import { save } from './progress';

export interface Gate {
  id: string;
  name: string;
  x: number;
  z: number;
  /** the way you face stepping off it (toward the road) */
  out: number;
  /** what part of the map it serves (shown in the list) */
  area: string;
}
export const GATE_R = 2.6;
export const LIGHT_R = 10;

/** a level, dry, open spot near (x, z) with room for the ring */
function clearNear(x: number, z: number, max = 14): [number, number] {
  const ok = (cx: number, cz: number) => {
    const h = groundHeight(cx, cz);
    if (h < WATER_Y + 0.5) return false;
    for (let a = 0; a < 8; a++) {
      const px = cx + Math.cos(a * 0.785) * (GATE_R + 0.6), pz = cz + Math.sin(a * 0.785) * (GATE_R + 0.6);
      if (Math.abs(groundHeight(px, pz) - h) > 0.9 || inBuilding(px, groundHeight(px, pz) + 0.8, pz, 0.3)) return false;
    }
    return !inBuilding(cx, h + 0.8, cz, GATE_R);
  };
  if (ok(x, z)) return [x, z];
  for (let r = 2; r <= max; r += 2)
    for (let a = 0; a < 12; a++) {
      const cx = x + Math.cos(a * 0.524) * r, cz = z + Math.sin(a * 0.524) * r;
      if (ok(cx, cz)) return [cx, cz];
    }
  return [x, z];
}
const COMPASS = (x: number, z: number) => {
  const a = Math.atan2(-z, x); // east 0, north up the map (-z)
  const names = ['东', '东北', '北', '西北', '西', '西南', '南', '东南'];
  return names[(Math.round(a / (Math.PI / 4)) + 8) % 8];
};
/** beside road k at r, `side` metres off (+ is the road's right) */
const beside = (k: number, r: number, side: number) => {
  const f = roadFrame(k, r);
  return { x: f.x + f.uz * side, z: f.z - f.ux * side };
};

/** each road named by the way it leaves the village (its waystation's direction) */
const ROAD_DIR = Array.from({ length: ROAD_N }, (_, k) => {
  const f = roadFrame(k, 470);
  return COMPASS(f.x, f.z);
});
export const GATES: Gate[] = (() => {
  const out: Gate[] = [];
  const add = (id: string, name: string, area: string, x: number, z: number, faceX: number, faceZ: number) => {
    const [cx, cz] = clearNear(x, z);
    out.push({ id, name, area, x: cx, z: cz, out: Math.atan2(faceX - cx, faceZ - cz) });
  };
  add('village', '青石村', '村中', 9, -8, 0, 0);
  for (const p of PLACES)
    if (p.kind === 'inn') {
      // in front of the inn, toward the road
      const fx = Math.sin(p.rot), fz = Math.cos(p.rot);
      add('inn' + p.road, p.name, ROAD_DIR[p.road!] + '路 · 中程', p.x + fx * 13 + fz * 6, p.z + fz * 13 - fx * 6, p.x + fx * 30, p.z + fz * 30);
    } else if (p.kind === 'jianzhong') add('jianzhong', '断剑冢', '古战场', p.x + Math.sin(p.rot) * 14, p.z + Math.cos(p.rot) * 14, p.x + Math.sin(p.rot) * 40, p.z + Math.cos(p.rot) * 40);
  // a roadside pavilion out on each far road (the court's road and 天阙's have their own)
  for (let k = 0; k < ROAD_N; k++) {
    if (k === CT_ROAD || k === TQ_ROAD) continue;
    const b = beside(k, 760, -8), f = roadFrame(k, 760);
    add('far' + k, ROAD_DIR[k] + '路长亭', ROAD_DIR[k] + '路 · 远程', b.x, b.z, f.x, f.z);
  }
  {
    const b = beside(CT_ROAD, CT_R - 70, -9), f = roadFrame(CT_ROAD, CT_R - 70);
    add('court', '永安城外', '朝廷', b.x, b.z, f.x, f.z);
  }
  {
    const b = beside(TQ_ROAD, GD_ARCH_R - 28, -8), f = roadFrame(TQ_ROAD, GD_ARCH_R - 28);
    add('gudao', '天阙古道口', '天阙山下', b.x, b.z, f.x, f.z);
  }
  add('snow', '雪岭营地', '雪岭', SNOW_CAMP.x - 7, SNOW_CAMP.z + 6, SNOW_CAMP.x, SNOW_CAMP.z);
  return out;
})();

const D = (s: Sim) => (s.progress.done ??= {}) as Record<string, any>;
export const lit = (s: Sim, g: Gate) => g.id === 'village' || !!D(s)['gate:' + g.id];

/** every frame or so: light a gate you walk near */
export function stepGates(s: Sim) {
  if (s.indoor >= 0) return;
  const p = s.player.pos;
  for (const g of GATES) {
    if (lit(s, g) || Math.hypot(g.x - p[0], g.z - p[2]) > LIGHT_R) continue;
    D(s)['gate:' + g.id] = 1;
    save(s.progress);
    s.toast(`传送阵亮了：${g.name}。站上任何一座亮着的传送阵按 F，就能到这里。`);
    s.vfx('ring', [g.x, groundHeight(g.x, g.z) + 0.4, g.z], 4, '#9fdcff', 0.8, 0.2, 0.4);
    s.vfx('flash', [g.x, groundHeight(g.x, g.z) + 1.5, g.z], '#9fdcff', 60, 0.5, 12);
    s.chron(`你点亮了${g.name}的传送阵。`);
  }
}
/** the gate you're standing on */
export function gateAt(s: Sim): Gate | null {
  if (s.indoor >= 0) return null;
  const p = s.player.pos;
  return GATES.find((g) => Math.hypot(g.x - p[0], g.z - p[2]) < GATE_R + 0.6) ?? null;
}
/** step out at gate `id`, if nothing holds you here */
export function travel(s: Sim, id: string): string | null {
  const g = GATES.find((x) => x.id === id);
  if (!g || !lit(s, g)) return '那座传送阵还没亮';
  const p = s.player;
  if (s.jh.escort) return '护送途中，不能丢下人走';
  if (s.war.raid?.stage === 'on') return '山贼正在劫村，阵法起不来';
  const foe = s.fighters.find((f) => f.team === 'sect' && f.hp > 0 && f.aggro && !(f as any).benched && Math.hypot(f.pos[0] - p.pos[0], f.pos[2] - p.pos[2]) < 18);
  if (foe) return `${foe.name}还缠着你，静不下心起阵`;
  if (s.riding >= 0) {
    const a = s.animals[s.riding] as any;
    s.riding = -1;
    a.ridden = false;
    a.speed = 0;
  }
  const fx = Math.sin(g.out), fz = Math.cos(g.out);
  const x = g.x + fx * (GATE_R + 0.8), z = g.z + fz * (GATE_R + 0.8);
  const from = [p.pos[0], p.pos[2]];
  p.pos = [x, groundHeight(x, z) + 0.1, z];
  p.vel = [0, 0, 0];
  p.yaw = Math.atan2(-fx, -fz); // facing out of the ring toward the road
  s.camSnap = p.yaw;
  s.fadeT = 1.1;
  // companions who were following come along
  for (const f of s.fighters)
    if (f.team === 'ally' && f.hp > 0 && (f as any).comp && Math.hypot(f.pos[0] - from[0], f.pos[2] - from[1]) < 40) {
      const ax = x - fz * 1.6, az = z + fx * 1.6;
      f.pos = [ax, groundHeight(ax, az), az];
    }
  s.vfx('ring', [g.x, groundHeight(g.x, g.z) + 0.4, g.z], 3.5, '#9fdcff', 0.7, 0.2, 0.5);
  s.vfx('flash', [g.x, groundHeight(g.x, g.z) + 1.5, g.z], '#bfe8ff', 80, 0.6, 14);
  s.toast(`一阵白光，你已站在${g.name}。`);
  return null;
}

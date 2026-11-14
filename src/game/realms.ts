// 秘境: places made by World Labs Atlas as 3D Gaussian splats (tools/atlas/scene.py; the takes are kept on the
// worldlabs branch), walked like rooms: each is a room of interiors.ts with theme 'realm', far off the map. The
// splat is drawn by render/Realm.tsx; what you stand on and what stops you come from a grid worked out from the
// splats offline (tools/atlas/floor.py → realmData.ts): the floor's height per cell and each cell's distance to the
// nearest thing a body can't pass (negative inside it).
import { ICE_CAVE } from './layout';
import { REALM_DATA, type RealmGridData } from './realmData';

export interface Realm {
  id: string;
  name: string;
  /** the splat file (under public/) */
  url: string;
  /** where you stand outside to go in, and the way out of that door */
  door: [number, number];
  doorYaw: number;
  /** where the capture point sits, off the map; the floor there is y = 0 */
  ox: number;
  oz: number;
  /** the splat's size against the game's metres: Atlas's depth is only roughly metric (the ice cave came out at half
   * size), so each place is scaled to put its capture eye at eyeH, a standing man's eye (1.6 m) unless given */
  scale: number;
  eyeH?: number;
  /** room-local: where you arrive and the way you face, where the way out is */
  spawn: [number, number];
  spawnYaw: number;
  exit: [number, number];
  /** the card when you come in */
  intro: string;
  /** the lights a body gets in there: sky, ground, a key light from above and its direction */
  light: { sky: string; ground: string; key: string; keyAt: [number, number, number]; keyI: number };
  grid: RealmGridData;
}

const DEFS: Omit<Realm, 'grid' | 'exit' | 'scale'>[] = [
  {
    id: 'icecave',
    name: '寒寺遗窟',
    url: 'splats/icecave.spz',
    door: [ICE_CAVE.x + Math.sin(ICE_CAVE.rot) * 2.2, ICE_CAVE.z + Math.cos(ICE_CAVE.rot) * 2.2],
    doorYaw: ICE_CAVE.rot,
    ox: 4400,
    oz: 4400,
    spawn: [0, 0],
    spawnYaw: 0,
    intro: '冰窟深处，一座古寺被整个吞进了冰里。冰封的大佛垂目看着你，天光从穹顶的裂缝里漏下来。',
    light: { sky: '#bfe3ff', ground: '#3a4a5a', key: '#e6f3ff', keyAt: [0, 14, -6], keyI: 2.2 },
  },
];

/** the realms whose grid has been made (a take without one isn't walkable yet, so it isn't offered) */
export const REALMS: Realm[] = DEFS.filter((d) => REALM_DATA[d.id]).map((d) => {
  const grid = REALM_DATA[d.id];
  const r: Realm = { ...d, grid, scale: (d.eyeH ?? 1.6) / grid.eye, exit: [0, 0] };
  r.exit = openNear(r, d.spawn[0], d.spawn[1] + 2.6);
  return r;
});
export const realmById = (id: string | undefined) => (id ? REALMS.find((r) => r.id === id) : undefined);

// ---- the grid
function sample(r: Realm, arr: number[], lx: number, lz: number, out: number) {
  const g = r.grid, s = r.scale;
  const fx = (lx / s - g.x0) / g.cell - 0.5, fz = (lz / s - g.z0) / g.cell - 0.5;
  if (fx < 0 || fz < 0 || fx > g.nx - 1 || fz > g.nz - 1) return out;
  const i = Math.min(g.nx - 2, Math.floor(fx)), j = Math.min(g.nz - 2, Math.floor(fz));
  const u = fx - i, v = fz - j, n = g.nx;
  const a = arr[j * n + i], b = arr[j * n + i + 1], c = arr[(j + 1) * n + i], d = arr[(j + 1) * n + i + 1];
  return ((a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v) * 0.01 * s;
}
/** the floor under a room-local point */
export function realmFloorLocal(r: Realm, lx: number, lz: number) {
  return sample(r, r.grid.h, lx, lz, 0);
}
/** how far a room-local point is from anything in the way (negative inside it, or off the grid) */
export function realmGapLocal(r: Realm, lx: number, lz: number) {
  return sample(r, r.grid.d, lx, lz, -2);
}

export function realmFloor(r: Realm, x: number, z: number) {
  return realmFloorLocal(r, x - r.ox, z - r.oz);
}
export function realmGap(r: Realm, x: number, z: number) {
  return realmGapLocal(r, x - r.ox, z - r.oz);
}

/** keep a body (radius rad) out of the walls: step it down the distance field's slope until it's clear */
export function pushOutOfRealm(r: Realm, p: [number, number, number], rad = 0.35) {
  for (let k = 0; k < 3; k++) {
    const g = realmGap(r, p[0], p[2]);
    if (g >= rad) return;
    const e = 0.2;
    let gx = realmGap(r, p[0] + e, p[2]) - realmGap(r, p[0] - e, p[2]);
    let gz = realmGap(r, p[0], p[2] + e) - realmGap(r, p[0], p[2] - e);
    const L = Math.hypot(gx, gz);
    if (L < 1e-5) {
      // flat inside a wall (deep in, or off the grid): back toward where you came in
      gx = r.ox + r.spawn[0] - p[0];
      gz = r.oz + r.spawn[1] - p[2];
      const M = Math.hypot(gx, gz) || 1;
      p[0] += (gx / M) * Math.min(0.5, rad - g);
      p[2] += (gz / M) * Math.min(0.5, rad - g);
      continue;
    }
    p[0] += (gx / L) * (rad - g);
    p[2] += (gz / L) * (rad - g);
  }
}

/** the nearest open room-local spot to (lx, lz), with room round it */
function openNear(r: Realm, lx: number, lz: number): [number, number] {
  let best: [number, number] = [r.spawn[0], r.spawn[1]], bd = Infinity;
  for (let dz = -6; dz <= 6; dz += 0.3)
    for (let dx = -6; dx <= 6; dx += 0.3) {
      const x = lx + dx, z = lz + dz;
      if (realmGapLocal(r, x, z) < 0.9) continue;
      const d = Math.hypot(dx, dz);
      if (d < bd) {
        bd = d;
        best = [x, z];
      }
    }
  return best;
}

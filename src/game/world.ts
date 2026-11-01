// The open map: rolling hills, a village in the middle, bandit dens on three rings, paths out from the village.
// Height is a pure function so the sim, the renderer and the camera all agree on where the ground is.
import { DENS, DEN_R } from './foes';

export const WORLD_R = 220; // playable radius
export const VILLAGE_R = 26;

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

function hills(x: number, z: number) {
  return (
    Math.sin(x * 0.021) * Math.cos(z * 0.017) * 6 +
    Math.sin(x * 0.047 + 1.3) * Math.sin(z * 0.039 + 0.4) * 2.6 +
    Math.cos((x + z) * 0.011) * 4 +
    Math.sin(x * 0.11 + z * 0.07) * 0.7
  );
}

const CAMPS = DENS.map((d) => [d.x, d.z] as [number, number]);
const CAMP_R = DEN_R;

/** distance from (x, z) to the nearest path (the village to each inner-ring den, then out along spokes) */
const SPOKES = DENS.slice(0, 5).map((d) => [d.x * 3.2, d.z * 3.2] as [number, number]);
export function pathDist(x: number, z: number) {
  let best = 1e9;
  for (const [cx, cz] of SPOKES) {
    const l2 = cx * cx + cz * cz;
    const t = Math.max(0, Math.min(1, (x * cx + z * cz) / l2));
    best = Math.min(best, Math.hypot(x - cx * t, z - cz * t));
  }
  return best;
}

/** flat pads under the village and each camp, the hills everywhere else, a rim of mountains at the edge */
export function groundHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  // gentle near the village, full hills further out; paths are half as hilly
  const amp = (0.3 + 0.7 * smooth(40, 130, r)) * (1 - 0.45 * (1 - smooth(2, 8, pathDist(x, z))));
  let h = hills(x, z) * amp;
  // flat pads under the village and each den, blended one after another (no seams where two pads meet)
  h += (hills(0, 0) * 0.3 - h) * (1 - smooth(VILLAGE_R, VILLAGE_R + 30, r));
  for (const [cx, cz] of CAMPS) {
    const f = 1 - smooth(CAMP_R, CAMP_R + 22, Math.hypot(x - cx, z - cz));
    if (f <= 0) continue;
    const padH = hills(cx, cz) * (0.3 + 0.7 * smooth(40, 130, Math.hypot(cx, cz)));
    h += (padH - h) * f;
  }
  h += smooth(WORLD_R - 25, WORLD_R + 30, r) * 40;
  return h;
}

/** buildings (Tripo models in public/props): a footprint box each, which nothing walks through */
export interface Building {
  x: number;
  z: number;
  rot: number; // the door (model +Z) turned to face this way
  hx: number; // half width / half depth of the footprint, metres
  hz: number;
  h: number; // roof height (the camera keeps out below it)
  model: string;
  scale: number;
}
export const BUILDINGS: Building[] = (() => {
  // village houses round the square, in the gaps between the roads out (doors facing the well)
  const out: Building[] = [];
  const S = 10; // house.glb is about 1 x 0.66 x 0.82 units
  for (let k = 0; k < 5; k++) {
    const a = ((k + 0.5) / 5) * Math.PI * 2;
    const x = Math.cos(a) * 18;
    const z = Math.sin(a) * 18;
    out.push({ x, z, rot: Math.atan2(-x, -z), hx: 0.49 * S + 0.3, hz: 0.41 * S + 0.3, h: 0.66 * S, model: 'house.glb', scale: S });
  }
  // a pavilion beside each road out, halfway to the second ring of dens: a landmark to steer by
  const P = 9; // pavilion.glb is about 1 x 0.96 x 0.92 units
  for (const [sx, sz] of SPOKES) {
    const l = Math.hypot(sx, sz);
    const ux = sx / l, uz = sz / l;
    const x = ux * 80 - uz * 11;
    const z = uz * 80 + ux * 11;
    out.push({ x, z, rot: Math.atan2(uz, -ux), hx: 0.46 * P, hz: 0.44 * P, h: 0.96 * P, model: 'pavilion.glb', scale: P });
  }
  return out;
})();
/** trees: deterministic scatter, kept off camps, the village and the paths */
export interface Tree {
  x: number;
  z: number;
  s: number;
  kind: 0 | 1;
}
export const TREES: Tree[] = (() => {
  const out: Tree[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 3000 && out.length < 520; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * (WORLD_R + 10);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (r < VILLAGE_R + 10) continue;
    if (CAMPS.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < CAMP_R + 6)) continue;
    if (pathDist(x, z) < 6) continue;
    if (BUILDINGS.some((b) => Math.hypot(b.x - x, b.z - z) < Math.max(b.hx, b.hz) + 7)) continue;
    // trunks never so close that a pocket between them could trap someone
    if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 3.4)) continue;
    out.push({ x, z, s: 0.8 + rnd() * 0.9, kind: rnd() < 0.6 ? 0 : 1 });
  }
  return out;
})();

/** trunks block movement (circle of radius 0.5 * scale) */
export function pushOutOfTrees(p: [number, number, number]) {
  for (const t of TREES) {
    const dx = p[0] - t.x;
    if (dx > 2 || dx < -2) continue;
    const dz = p[2] - t.z;
    if (dz > 2 || dz < -2) continue;
    const r = 0.45 * t.s + 0.35;
    const d = Math.hypot(dx, dz);
    if (d < r && d > 1e-4) {
      p[0] = t.x + (dx / d) * r;
      p[2] = t.z + (dz / d) * r;
    }
  }
}

/** a point inside a building footprint (and below its roof)? */
export function inBuilding(x: number, y: number, z: number, pad = 0) {
  for (const b of BUILDINGS) {
    const dx = x - b.x;
    const dz = z - b.z;
    if (dx * dx + dz * dz > 100) continue;
    const c = Math.cos(b.rot);
    const s = Math.sin(b.rot);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    if (Math.abs(lx) < b.hx + pad && Math.abs(lz) < b.hz + pad && y < groundHeight(b.x, b.z) + b.h) return true;
  }
  return false;
}
/** push a body out of any building it walked into (out through the nearest wall) */
export function pushOutOfBuildings(p: [number, number, number]) {
  const R = 0.35;
  for (const b of BUILDINGS) {
    const dx = p[0] - b.x;
    const dz = p[2] - b.z;
    if (dx * dx + dz * dz > 64) continue;
    const c = Math.cos(b.rot);
    const s = Math.sin(b.rot);
    let lx = dx * c - dz * s;
    let lz = dx * s + dz * c;
    const ox = b.hx + R - Math.abs(lx);
    const oz = b.hz + R - Math.abs(lz);
    if (ox <= 0 || oz <= 0) continue;
    if (ox < oz) lx = Math.sign(lx || 1) * (b.hx + R);
    else lz = Math.sign(lz || 1) * (b.hz + R);
    // back to world space (inverse rotation)
    p[0] = b.x + lx * c + lz * s;
    p[2] = b.z - lx * s + lz * c;
  }
}

/** keep inside the world */
export function clampWorld(p: [number, number, number]) {
  const r = Math.hypot(p[0], p[2]);
  const max = WORLD_R + 8;
  if (r > max) {
    p[0] *= max / r;
    p[2] *= max / r;
  }
}

export const VILLAGE_SPAWN: [number, number] = [0, 6];

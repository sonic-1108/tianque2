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

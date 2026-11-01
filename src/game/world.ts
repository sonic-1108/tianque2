// The big map: 2 km square, laid out by the owner's Gemini maps (src/game/mapdata.ts): mountains and snow in the west,
// rivers and plains in the east, the village in the middle; noise adds the ridges and cliffs. Height is a pure function, so the sim, the renderer and the camera
// all agree on where the ground is. Slopes steeper than MAX_SLOPE can't be walked up (the mountains are walls).
import { DENS, DEN_R } from './foes';
import { ROADS, VILLAGE_R, WORLD_R } from './layout';
import { mapBig, mapRough, mapSnow, mapWater } from './mapsample';
export { WORLD_R, VILLAGE_R } from './layout';

export const WATER_Y = -2; // lakes fill the ground below this
export const SNOW_Y = 95;
export const MAX_SLOPE = 1.25; // rise per metre a body can walk up (about 51 degrees)

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- 2D gradient noise (deterministic)
const PERM = (() => {
  const p = new Uint8Array(512);
  let s = 1337;
  const a = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  for (let i = 0; i < 512; i++) p[i] = a[i & 255];
  return p;
})();
const GX = [1, -1, 1, -1, 1, -1, 0, 0];
const GZ = [1, 1, -1, -1, 0, 0, 1, -1];
function grad(h: number, x: number, z: number) {
  const g = h & 7;
  return GX[g] * x + GZ[g] * z;
}
/** Perlin noise, about -1..1 */
export function noise(x: number, z: number) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const X = xi & 255;
  const Z = zi & 255;
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
  const v = zf * zf * zf * (zf * (zf * 6 - 15) + 10);
  const aa = PERM[PERM[X] + Z], ab = PERM[PERM[X] + Z + 1], ba = PERM[PERM[X + 1] + Z], bb = PERM[PERM[X + 1] + Z + 1];
  const x1 = grad(aa, xf, zf) + u * (grad(ba, xf - 1, zf) - grad(aa, xf, zf));
  const x2 = grad(ab, xf, zf - 1) + u * (grad(bb, xf - 1, zf - 1) - grad(ab, xf, zf - 1));
  return (x1 + v * (x2 - x1)) * 1.4;
}

/** the raw mountains: rolling ground plus ridged peaks that grow taller away from the village */
function mountains(x: number, z: number) {
  const r = Math.hypot(x, z);
  // a slow warp so ridges bend instead of running in rows
  const wx = x + noise(x * 0.002, z * 0.002) * 120;
  const wz = z + noise(x * 0.002 + 40, z * 0.002 + 40) * 120;
  const rolling = noise(wx * 0.004, wz * 0.004) * 14 + noise(wx * 0.012, wz * 0.012) * 4 + noise(wx * 0.05, wz * 0.05) * 0.8;
  // ridged peaks: 1 - |noise| folded into sharp crests
  let ridge = 0;
  let amp = 1;
  let f = 0.0028;
  let wsum = 0;
  for (let o = 0; o < 5; o++) {
    const n = 1 - Math.abs(noise(wx * f + o * 17, wz * f - o * 31));
    ridge += n * n * amp;
    wsum += amp;
    amp *= 0.5;
    f *= 2.1;
  }
  ridge /= wsum; // 0..1, crests near 1
  void r;
  const tall = 115; // the owner's map decides where they rise (see rawHeight)
  const ridgeH = Math.max(0, ridge - 0.42) * tall * 2.2;
  return rolling + ridgeH;
}

/** distance to the nearest road, precomputed on a 4 m grid out to 90 m (further than that is "far") */
const G = 4;
const GN = Math.ceil((WORLD_R * 2) / G) + 1;
const g2w = (i: number) => i * G - WORLD_R;
const ROAD_D = (() => {
  const d = new Float32Array(GN * GN).fill(999);
  const reach = 90;
  for (const road of ROADS)
    for (let k = 1; k < road.length; k++) {
      const [ax, az] = road[k - 1];
      const [bx, bz] = road[k];
      const dx = bx - ax, dz = bz - az;
      const L = dx * dx + dz * dz;
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - reach + WORLD_R) / G));
      const i1 = Math.min(GN - 1, Math.ceil((Math.max(ax, bx) + reach + WORLD_R) / G));
      const j0 = Math.max(0, Math.floor((Math.min(az, bz) - reach + WORLD_R) / G));
      const j1 = Math.min(GN - 1, Math.ceil((Math.max(az, bz) + reach + WORLD_R) / G));
      for (let i = i0; i <= i1; i++)
        for (let j = j0; j <= j1; j++) {
          const x = g2w(i), z = g2w(j);
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L));
          const e = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
          const idx = i * GN + j;
          if (e < d[idx]) d[idx] = e;
        }
    }
  return d;
})();
function bilinear(grid: Float32Array, x: number, z: number) {
  const fx = Math.min(GN - 1.001, Math.max(0, (x + WORLD_R) / G));
  const fz = Math.min(GN - 1.001, Math.max(0, (z + WORLD_R) / G));
  const i = Math.floor(fx), j = Math.floor(fz);
  const u = fx - i, v = fz - j;
  const a = grid[i * GN + j], b = grid[(i + 1) * GN + j], c = grid[i * GN + j + 1], d = grid[(i + 1) * GN + j + 1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const pathDist = (x: number, z: number) => bilinear(ROAD_D, x, z);

const CAMPS = DENS.map((d) => [d.x, d.z] as [number, number]);

function rawHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  // the owner's map: its broad shape, its rugged parts (mountains in the west, the rim) and its painted snow
  const rough = smooth(0.16, 0.55, mapRough(x, z));
  const floor = (mapBig(x, z) - 0.45) * 30 + noise(x * 0.004, z * 0.004) * 4 + noise(x * 0.02, z * 0.02) * 1;
  let h = Math.max(WATER_Y + 0.8, floor + rough * mountains(x, z) + mapSnow(x, z) * 45); // only the painted rivers hold water
  // trails: a road through the mountains is cut down near the floor
  const trail = 1 - smooth(6, 34, pathDist(x, z));
  h += (Math.max(floor + 1, WATER_Y + 0.8) - h) * trail * 0.96;
  // the painted rivers
  const w = smooth(0.08, 0.55, mapWater(x, z));
  // a road crossing a river becomes a shallow ford (you wade across instead of meeting a cliff)
  h += (Math.min(h, WATER_Y - 2.6 + 1.9 * trail) - h) * w;
  // flat pads: the village, then each den (blended one after another, no seams)
  h += (1.5 - h) * (1 - smooth(VILLAGE_R, VILLAGE_R + 50, r));
  for (const [cx, cz] of CAMPS) {
    const dd = Math.hypot(x - cx, z - cz);
    if (dd > DEN_R + 40) continue;
    const f = 1 - smooth(DEN_R, DEN_R + 40, dd);
    h += (padHeight(cx, cz) - h) * f;
  }
  // the edge of the map: a wall of peaks
  const e = Math.max(Math.abs(x), Math.abs(z));
  h += smooth(WORLD_R - 70, WORLD_R + 10, e) * 150;
  return h;
}
const padCache = new Map<string, number>();
function padHeight(cx: number, cz: number) {
  const k = cx + ',' + cz;
  let v = padCache.get(k);
  if (v === undefined) {
    // the den sits on the valley floor height
    v = Math.max(WATER_Y + 1.5, (mapBig(cx, cz) - 0.45) * 30 + noise(cx * 0.004, cz * 0.004) * 4 + 1);
    padCache.set(k, v);
  }
  return v;
}

/** the ground, precomputed on the 4 m grid and read back smoothly (the full formula is far too slow per query) */
const HEIGHT = (() => {
  const h = new Float32Array(GN * GN);
  for (let i = 0; i < GN; i++) for (let j = 0; j < GN; j++) h[i * GN + j] = rawHeight(g2w(i), g2w(j));
  return h;
})();
export const groundHeight = (x: number, z: number) => bilinear(HEIGHT, x, z);

/** how steep the ground is here (rise per metre) */
export function slopeAt(x: number, z: number) {
  const e = 0.75;
  const hx = groundHeight(x + e, z) - groundHeight(x - e, z);
  const hz = groundHeight(x, z + e) - groundHeight(x, z - e);
  return Math.hypot(hx, hz) / (2 * e);
}
export const inWater = (x: number, y: number, z: number) => y < WATER_Y - 0.3 && groundHeight(x, z) < WATER_Y - 0.3;

// ---------------------------------------------------------------- buildings (Tripo models in public/props)
export interface Building {
  x: number;
  z: number;
  rot: number; // the door (model +Z) turned to face this way
  hx: number; // half width / half depth of the footprint, metres
  hz: number;
  h: number; // roof height (the camera keeps out below it)
  model: string;
  scale: number;
  /** open structures (a gate): only these posts block, as circles [local x, local z, radius] */
  posts?: [number, number, number][];
}
export const BUILDINGS: Building[] = (() => {
  const out: Building[] = [];
  // village houses round the square, between the roads (doors facing the well)
  const S = 10; // house.glb is about 1 x 0.66 x 0.82 units
  for (let k = 0; k < ROADS.length; k++) {
    const a0 = Math.atan2(ROADS[k][2][1], ROADS[k][2][0]);
    let a1 = Math.atan2(ROADS[(k + 1) % ROADS.length][2][1], ROADS[(k + 1) % ROADS.length][2][0]);
    if (a1 < a0) a1 += Math.PI * 2;
    const a = (a0 + a1) / 2;
    const x = Math.cos(a) * 20;
    const z = Math.sin(a) * 20;
    out.push({ x, z, rot: Math.atan2(-x, -z), hx: 0.49 * S + 0.3, hz: 0.41 * S + 0.3, h: 0.66 * S, model: 'house.glb', scale: S });
  }
  // the stone gate (牌坊) over the road east out of the village
  {
    const PF = 14; // paifang.glb is about 1 x 0.82 x 0.22 units
    const [x0, z0] = ROADS[0][2];
    const [x1, z1] = ROADS[0][3];
    const rot = Math.atan2(x1 - x0, z1 - z0);
    out.push({ x: x0, z: z0, rot, hx: 0.49 * PF, hz: 0.11 * PF, h: 0.82 * PF, model: 'paifang.glb', scale: PF, posts: [-0.37, -0.15, 0.15, 0.37].map((u) => [u * PF, 0, 0.07 * PF] as [number, number, number]) });
  }
  // a pavilion beside each road, 230 m out: a landmark to steer by
  const P = 9; // pavilion.glb is about 1 x 0.96 x 0.92 units
  for (const road of ROADS) {
    const [x0, z0] = road[11];
    const [x1, z1] = road[12];
    const l = Math.hypot(x1 - x0, z1 - z0);
    const ux = (x1 - x0) / l, uz = (z1 - z0) / l;
    const x = x0 - uz * 12;
    const z = z0 + ux * 12;
    out.push({ x, z, rot: Math.atan2(uz, -ux), hx: 0.46 * P, hz: 0.44 * P, h: 0.96 * P, model: 'pavilion.glb', scale: P });
  }
  return out;
})();
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
    if (b.posts) continue; // an open gate never hides the player
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
    if (dx * dx + dz * dz > (b.posts ? 100 : 64)) continue;
    const c = Math.cos(b.rot);
    const s = Math.sin(b.rot);
    let lx = dx * c - dz * s;
    let lz = dx * s + dz * c;
    if (b.posts) {
      for (const [px, pz, pr] of b.posts) {
        const ex = lx - px, ez = lz - pz;
        const d = Math.hypot(ex, ez);
        if (d < pr + R && d > 1e-4) {
          lx = px + (ex / d) * (pr + R);
          lz = pz + (ez / d) * (pr + R);
          p[0] = b.x + lx * c + lz * s;
          p[2] = b.z - lx * s + lz * c;
        }
      }
      continue;
    }
    const ox = b.hx + R - Math.abs(lx);
    const oz = b.hz + R - Math.abs(lz);
    if (ox <= 0 || oz <= 0) continue;
    if (ox < oz) lx = Math.sign(lx || 1) * (b.hx + R);
    else lz = Math.sign(lz || 1) * (b.hz + R);
    p[0] = b.x + lx * c + lz * s;
    p[2] = b.z - lx * s + lz * c;
  }
}

// ---------------------------------------------------------------- trees (kept in a grid so a lookup is cheap)
export interface Tree {
  x: number;
  z: number;
  s: number;
  kind: 0 | 1 | 2; // pine, broadleaf, dead
}
const CELL = 10;
const grid = new Map<number, Tree[]>();
const cellKey = (cx: number, cz: number) => (cx + 500) * 1000 + (cz + 500);
export const TREES: Tree[] = (() => {
  const out: Tree[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 60000 && out.length < 7000; i++) {
    const x = (rnd() * 2 - 1) * WORLD_R;
    const z = (rnd() * 2 - 1) * WORLD_R;
    const k1 = rnd(), k2 = rnd(), s1 = rnd();
    const r = Math.hypot(x, z);
    if (Math.max(Math.abs(x), Math.abs(z)) > WORLD_R - 30 || r < VILLAGE_R + 15) continue;
    if (mapWater(x, z) > 0.02) continue;
    // forests come in patches
    if (noise(x * 0.008 + 9, z * 0.008 - 4) < -0.05) continue;
    if (CAMPS.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < DEN_R + 8)) continue;
    if (BUILDINGS.some((b) => Math.hypot(b.x - x, b.z - z) < Math.max(b.hx, b.hz) + 7)) continue;
    if (pathDist(x, z) < 7) continue;
    const h = groundHeight(x, z);
    if (h < WATER_Y + 0.5 || h > SNOW_Y + 10) continue;
    if (slopeAt(x, z) > 0.9) continue;
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    // trunks never so close that a pocket between them could trap someone
    let close = false;
    for (let gx = cx - 1; gx <= cx + 1 && !close; gx++)
      for (let gz = cz - 1; gz <= cz + 1 && !close; gz++)
        for (const t of grid.get(cellKey(gx, gz)) ?? []) if (Math.hypot(t.x - x, t.z - z) < 3.6) close = true;
    if (close) continue;
    const t: Tree = { x, z, s: 0.8 + s1 * 0.9, kind: h > SNOW_Y - 20 || k1 < 0.55 ? 0 : k2 < 0.85 ? 1 : 2 };
    out.push(t);
    const k = cellKey(cx, cz);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k)!.push(t);
  }
  return out;
})();

/** trunks block movement */
export function pushOutOfTrees(p: [number, number, number]) {
  const cx = Math.floor(p[0] / CELL), cz = Math.floor(p[2] / CELL);
  for (let gx = cx - 1; gx <= cx + 1; gx++)
    for (let gz = cz - 1; gz <= cz + 1; gz++) {
      const list = grid.get(cellKey(gx, gz));
      if (!list) continue;
      for (const t of list) {
        const dx = p[0] - t.x;
        const dz = p[2] - t.z;
        const r = 0.45 * t.s + 0.35;
        const d = Math.hypot(dx, dz);
        if (d < r && d > 1e-4) {
          p[0] = t.x + (dx / d) * r;
          p[2] = t.z + (dz / d) * r;
        }
      }
    }
}

/** keep inside the world */
export function clampWorld(p: [number, number, number]) {
  const max = WORLD_R - 20;
  p[0] = Math.max(-max, Math.min(max, p[0]));
  p[2] = Math.max(-max, Math.min(max, p[2]));
}

export const VILLAGE_SPAWN: [number, number] = [0, 6];

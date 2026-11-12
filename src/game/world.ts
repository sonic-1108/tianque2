// The big map: 2 km square, laid out by the owner's Gemini maps (src/game/mapdata.ts): mountains and snow in the west,
// rivers and plains in the east, the village in the middle; noise adds the ridges and cliffs. Height is a pure function, so the sim, the renderer and the camera
// all agree on where the ground is. Slopes steeper than MAX_SLOPE can't be walked up (the mountains are walls).
import { DENS, DEN_R } from './foes';
import { ROADS, nearTq, TQ_POS, TQ_ROT, TQ_TOP, tqWorld, TQ_Y, VILLAGE_R, WORLD_R, TQ_ROAD, GD_ARCH_R, GD_PAV, GD_PAV_R, onGudao, roadFrame, roadPoint } from './layout';
import { mapBig, mapRough, mapSnow, mapWater } from './mapsample';
import { FISH_SPOT, IN_TOWN, PLACES, PLACE_PARTS, innHouses, nearPlace, placeAt } from './places';
import { ROOM_Y, roomSolids } from './interiors';
import { MILL_FILE, PROP_DIMS, STALLS, TEAHOUSE, fit, modelPoint } from './props';
import { GATE_TOWERS, HOME, HOME_D, HOME_W, VILLAGE_PROPS, WALL_RUNS } from './village';
import { BOARDS, COURT_PIECES, CT_PAD, CT_POS, CT_ROT, CT_Y, ctWorld, nearCourt } from './court';
export { WORLD_R, VILLAGE_R } from './layout';

export const WATER_Y = -2; // lakes fill the ground below this
/** the river frozen over in deep winter (jianghu.ts steps it): on, you walk on the water's surface; amt eases the look */
export const ICE = { on: false, amt: 0 };
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

const CAMPS = DENS.filter((d) => !d.peak).map((d) => [d.x, d.z] as [number, number]);

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
  // a road crossing a river becomes a shallow ford (you wade across instead of meeting a cliff): on the road the
  // bank is let down over a much wider stretch of the river's edge, so the way in is a walkable slope
  const wm = mapWater(x, z);
  const w = smooth(0.08, 0.55, wm) * (1 - trail) + smooth(0.02, 0.98, wm) * trail;
  h += (Math.min(h, WATER_Y - 2.6 + 2.15 * trail) - h) * w;
  // flat pads: the village, then each den (blended one after another, no seams)
  h += (1.5 - h) * (1 - smooth(VILLAGE_R, VILLAGE_R + 50, r));
  for (const [cx, cz] of CAMPS) {
    const dd = Math.hypot(x - cx, z - cz);
    if (dd > DEN_R + 40) continue;
    const f = 1 - smooth(DEN_R, DEN_R + 40, dd);
    h += (padHeight(cx, cz) - h) * f;
  }
  // the workshops and waystations stand on levelled yards
  for (const p of PLACES) {
    const dd = Math.hypot(x - p.x, z - p.z);
    if (dd > p.pad + 26) continue;
    const ph = IN_TOWN(p.kind) ? 1.5 : padHeight(p.x, p.z);
    h += (ph - h) * (1 - smooth(p.pad, p.pad + 26, dd));
  }
  // 天阙: a mesa walled by cliffs; the road climbs to it along a ridge (the only way up)
  {
    const dd = Math.hypot(x - TQ_POS[0], z - TQ_POS[1]);
    if (dd < 260) {
      const mesa = TQ_Y * (1 - smooth(TQ_TOP, TQ_TOP + 22, dd)) + noise(x * 0.05, z * 0.05) * 1.5 * smooth(TQ_TOP, TQ_TOP + 10, dd);
      const ramp = TQ_Y * (1 - smooth(TQ_TOP - 4, 210, dd)); // the climb: steepest about 0.6
      const tr = 1 - smooth(5, 16, pathDist(x, z));
      h = Math.max(h, mesa, ramp * tr);
    }
    // 望阙台: a flat lookout beside the climb, level with the road there
    const dp = Math.hypot(x - GD_PAV[0], z - GD_PAV[1]);
    if (dp < 24) {
      const [rx, rz] = roadPoint(TQ_ROAD, GD_PAV_R);
      const top = TQ_Y * (1 - smooth(TQ_TOP - 4, 210, Math.hypot(rx - TQ_POS[0], rz - TQ_POS[1])));
      h = Math.max(h, top * (1 - smooth(9, 22, dp)) + (h * smooth(9, 22, dp)));
    }
  }
  // 永安城: the court's plain, levelled
  {
    const dd = Math.hypot(x - CT_POS[0], z - CT_POS[1]);
    if (dd < CT_PAD + 40) h += (CT_Y - h) * (1 - smooth(CT_PAD, CT_PAD + 40, dd));
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
  /** the ground its footprint stands on (filled in on first use) */
  y0?: number;
  /** how the model sits in its frame (props.ts fit): an extra quarter turn for Tripo's +x facing models, and its lift */
  turn?: number;
  lift?: number;
}
/** a box whose top is at most this far above your feet is a step you walk up onto, not a wall */
export const STEP_UP = 0.6;
const baseOf = (b: Building) => (b.y0 ??= groundHeight(b.x, b.z));
// buildings by grid cell (each listed in every cell its reach touches), with their turn's cos / sin worked out once:
// a body only ever looks at the few buildings round it, never the whole list
const BC = 24;
let bgrid: Map<number, Building[]> | null = null;
const trig = new WeakMap<Building, [number, number]>();
function nearBuildings(x: number, z: number): Building[] {
  if (!bgrid) {
    bgrid = new Map();
    for (const b of BUILDINGS) {
      trig.set(b, [Math.cos(b.rot), Math.sin(b.rot)]);
      const reach = Math.max(b.hx, b.hz) + 3;
      for (let i = Math.floor((b.x - reach) / BC); i <= Math.floor((b.x + reach) / BC); i++)
        for (let j = Math.floor((b.z - reach) / BC); j <= Math.floor((b.z + reach) / BC); j++) {
          const k = i * 4096 + j;
          let l = bgrid.get(k);
          if (!l) bgrid.set(k, (l = []));
          l.push(b);
        }
    }
  }
  return bgrid.get(Math.floor(x / BC) * 4096 + Math.floor(z / BC)) ?? NONE;
}
const NONE: Building[] = [];
/** 天阙's solid parts in its own frame (+z toward the gate): the hall on its terrace, the side halls, the bell tower, the gate */
export const TQ_PARTS: { name: string; x: number; z: number; hx: number; hz: number; h: number; posts?: [number, number, number][] }[] = [
  // the terrace you climb by its front stairs, and the hall standing on it
  { name: 'terrace', x: 0, z: -10, hx: 20, hz: 14, h: 2.4 },
  ...Array.from({ length: 8 }, (_, k) => ({ name: 'stair', x: 0, z: 8 - k * 0.45, hx: 4.8, hz: 0.235, h: 0.3 * (k + 1) })),
  { name: 'hall', x: 0, z: -12, hx: 15.2, hz: 8.7, h: 24 },
  { name: 'west', x: -24, z: 4, hx: 6, hz: 8, h: 10 },
  { name: 'east', x: 24, z: 4, hx: 6, hz: 8, h: 10 },
  { name: 'tower', x: 0, z: -32, hx: 5.5, hz: 5.5, h: 44 },
  (() => {
    // the stone gate (paifang-b.glb at 22 m): only its four pillars block
    const g = fit('paifang-b.glb', 22);
    const posts = ([[0, -0.42, 0.05], [0, -0.15, 0.075], [0, 0.15, 0.075], [0, 0.42, 0.05]] as const).map(([mx, mz, r]) => [...modelPoint('paifang-b.glb', mx, mz, g.scale), r * g.scale] as [number, number, number]);
    return { name: 'gate', x: 0, z: 38, hx: g.hx, hz: g.hz, h: g.h, posts };
  })(),
];
export const TQ_WALL_R = 43;
/** the mesa wall's segments in 天阙's frame: centre, length, turn */
export function tqWall() {
  const out: { x: number; z: number; L: number; ry: number }[] = [];
  const N = 40;
  for (let k = 0; k < N; k++) {
    const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    if (Math.abs(Math.atan2(Math.sin(am), Math.cos(am)) - Math.PI / 2) < 0.28) continue; // the gate's gap (+z)
    const x0 = Math.cos(a0) * TQ_WALL_R, z0 = Math.sin(a0) * TQ_WALL_R, x1 = Math.cos(a1) * TQ_WALL_R, z1 = Math.sin(a1) * TQ_WALL_R;
    out.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, L: Math.hypot(x1 - x0, z1 - z0) + 0.1, ry: Math.atan2(x1 - x0, z1 - z0) });
  }
  return out;
}
/** pavilion.glb's columns, in model units (measured off the model: a ring of six round the open floor) */
const PAVILION_POSTS: [number, number, number][] = [
  [-0.1, -0.29, 0.05], [0.145, -0.25, 0.05], [-0.286, -0.1, 0.05], [0.206, -0.058, 0.05], [-0.18, 0.19, 0.05], [0.083, 0.21, 0.05],
];
/** a Tripo prop as a solid building: its footprint from the model's own size */
function propBuilding(file: string, x: number, z: number, rot: number, size: number): Building {
  const g = fit(file, size);
  return { x, z, rot, hx: g.hx * 0.92, hz: g.hz * 0.92, h: g.h, model: file, scale: g.scale, turn: g.turn, lift: g.lift };
}
/** the watermill: on the bank where a river runs closest to the village (x, z, facing the water) */
const MILL: [number, number, number] | null = (() => {
  let best: [number, number, number] | null = null, bd = Infinity;
  for (let r = 70; r < 260; r += 6)
    for (let k = 0; k < 72; k++) {
      const a = (k / 72) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (mapWater(x, z) < 0.5) continue;
      // step back out of the water onto the bank, toward the village
      for (let s = 2; s < 30; s += 2) {
        const bx = x - Math.cos(a) * s, bz = z - Math.sin(a) * s;
        if (mapWater(bx, bz) < 0.02 && pathDist(bx, bz) > 14) {
          if (r < bd) {
            bd = r;
            best = [bx, bz, Math.atan2(x - bx, z - bz)];
          }
          break;
        }
      }
    }
  return best;
})();
export const MILL_AT = MILL;
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
    out.push(propBuilding(k % 2 ? 'house-b.glb' : 'house-a.glb', x, z, Math.atan2(-x, -z), k % 2 ? 9.6 : 11));
  }
  // the stone gate (牌坊) over the road east out of the village
  {
    const PF = 14; // paifang.glb is about 1 x 0.82 x 0.22 units
    const [x0, z0] = ROADS[0][2];
    const [x1, z1] = ROADS[0][3];
    const rot = Math.atan2(x1 - x0, z1 - z0);
    void PF;
    const g = fit('paifang-b.glb', 15);
    // its four pillars (with the lions at the middle two), measured off the model
    const posts = ([[0, -0.42, 0.05], [0, -0.15, 0.075], [0, 0.15, 0.075], [0, 0.42, 0.05]] as const).map(([mx, mz, r]) => [...modelPoint('paifang-b.glb', mx, mz, g.scale), r * g.scale] as [number, number, number]);
    out.push({ x: x0, z: z0, rot, hx: g.hx, hz: g.hz, h: g.h, model: 'paifang-b.glb', scale: g.scale, turn: g.turn, lift: g.lift, posts });
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
    void P;
    const g = fit('pavilion-b.glb', 10);
    // six columns on a ring (measured off the model), the floor open between them
    const posts = Array.from({ length: 6 }, (_, k) => {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 2;
      return [...modelPoint('pavilion-b.glb', Math.cos(a) * 0.24, Math.sin(a) * 0.27, g.scale), 0.04 * g.scale] as [number, number, number];
    });
    out.push({ x, z, rot: Math.atan2(uz, -ux), hx: g.hx, hz: g.hz, h: g.h, model: 'pavilion-b.glb', scale: g.scale, turn: g.turn, lift: g.lift, posts });
  }
  // the village well (a Tripo model), where the square's flagstones meet
  out.push(propBuilding('well.glb', 0, -3, 0, 3.4));
  // the fisherman's boat, pulled up on the bank beside him
  if (FISH_SPOT) {
    const [x, z, a] = FISH_SPOT;
    const ux = Math.cos(a), uz = Math.sin(a);
    out.push(propBuilding('inn-boat.glb', x - uz * 3.5, z + ux * 3.5, Math.atan2(ux, uz), 6));
  }
  // 青石村's stockade (village.ts): every run of wall blocks; at each gate the two towers block, the road runs between
  for (const [x0, z0, x1, z1] of WALL_RUNS) {
    const L = Math.hypot(x1 - x0, z1 - z0);
    out.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, rot: Math.atan2(x1 - x0, z1 - z0), hx: 0.35, hz: L / 2 + 0.25, h: 3.6, model: '', scale: 1 });
  }
  for (const pair of GATE_TOWERS) for (const [x, z] of pair) out.push({ x, z, rot: Math.atan2(-x, -z), hx: 1.3, hz: 1.3, h: 7.4, model: '', scale: 1 });
  // and what stands in its grounds (each once its model is in)
  for (const [file, deg, r, size] of VILLAGE_PROPS) {
    if (!(file in PROP_DIMS)) continue;
    const a = (deg * Math.PI) / 180, x = Math.cos(a) * r, z = Math.sin(a) * r;
    out.push(propBuilding(file, x, z, Math.atan2(-x, -z), size));
  }
  // the house for sale (jianghu.ts, drawn by render/Home.tsx)
  out.push({ x: HOME.x, z: HOME.z, rot: HOME.rot, hx: HOME_W / 2, hz: HOME_D / 2, h: 4.8, model: '', scale: 1 });
  // the notice boards: their two legs block
  for (const [x, z] of BOARDS) out.push({ x, z, rot: Math.atan2(-x, -z), hx: 1.3, hz: 0.2, h: 2.7, model: '', scale: 1, posts: [[-1.1, 0, 0.18], [1.1, 0, 0.18]] });
  // 永安城 · 朝廷 (court.ts): the wall, the gate (open between its piers), the hall, the towers, the street outside
  for (const c of COURT_PIECES) {
    const [x, z] = ctWorld(c.lx, c.lz);
    const b = propBuilding(c.file, x, z, CT_ROT + c.rot, c.size);
    if (c.posts) b.posts = c.posts;
    out.push(b);
  }
  // 青石集: the market stalls along the east road and the teahouse at its end
  for (const s of STALLS) out.push(propBuilding(s.file, s.x, s.z, s.rot, s.size));
  out.push(propBuilding(TEAHOUSE.file, TEAHOUSE.x, TEAHOUSE.z, TEAHOUSE.rot, TEAHOUSE.size));
  // the watermill on the river nearest the village
  if (MILL) out.push(propBuilding(MILL_FILE, MILL[0], MILL[1], MILL[2], 11));
  // the rooms off the map: their walls and furniture (render/Interiors.tsx draws them)
  for (const r of roomSolids()) out.push({ ...r, model: '', scale: 1, y0: ROOM_Y });
  // the workshops and inns (drawn by render/Places.tsx): each one's solid parts, and the two houses at each waystation
  for (const p of PLACES) {
    for (const b of PLACE_PARTS[p.kind]) {
      const [x, z] = placeAt(p, b.x, b.z);
      out.push({ x, z, rot: p.rot + (b.ry ?? 0), hx: b.hx, hz: b.hz, h: b.h, model: '', scale: 1, posts: b.posts, y0: groundHeight(p.x, p.z) - 0.05 });
    }
    if (p.kind === 'inn') innHouses(p).forEach((hs, k) => out.push(propBuilding(k ? 'house-b.glb' : 'house-a.glb', hs.x, hs.z, hs.rot, k ? 8.6 : 9.4)));
  }
  // 天阙 (drawn by render/Tianque.tsx; these are only the solid footprints, in its frame, see TQ_PARTS)
  for (const t of TQ_PARTS) {
    const [x, z] = tqWorld(t.x, t.z);
    out.push({ x, z, rot: TQ_ROT, hx: t.hx, hz: t.hz, h: t.h, model: '', scale: 1, posts: t.posts });
  }
  // 天阙古道: the stone arch at the foot of the climb (two pillars each side of the road) and the lookout pavilion
  {
    const f = roadFrame(TQ_ROAD, GD_ARCH_R);
    out.push({ x: f.x, z: f.z, rot: f.rot, hx: 7, hz: 1, h: 9, model: '', scale: 1, posts: [[-6.2, 0, 0.75], [-3.4, 0, 0.6], [3.4, 0, 0.6], [6.2, 0, 0.75]] });
    const g = roadFrame(TQ_ROAD, GD_PAV_R);
    out.push({ x: GD_PAV[0], z: GD_PAV[1], rot: g.rot, hx: 4, hz: 4, h: 6, model: '', scale: 1, posts: [[-3.4, -3.4, 0.4], [3.4, -3.4, 0.4], [-3.4, 3.4, 0.4], [3.4, 3.4, 0.4]] });
  }
  // the low wall round the mesa's top (keeps bodies from walking off the cliff), open at the gate
  for (const w of tqWall()) {
    const [x, z] = tqWorld(w.x, w.z);
    out.push({ x, z, rot: TQ_ROT + w.ry, hx: 0.6, hz: w.L / 2, h: 6, model: '', scale: 1 });
  }
  return out;
})();
/** a point inside a building footprint (and below its roof)? */
export function inBuilding(x: number, y: number, z: number, pad = 0) {
  for (const b of nearBuildings(x, z)) {
    const dx = x - b.x;
    const dz = z - b.z;
    const reach = Math.max(b.hx, b.hz) + 3;
    if (dx * dx + dz * dz > reach * reach) continue;
    const [c, s] = trig.get(b)!;
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    if (b.posts) continue; // an open gate never hides the player
    if (Math.abs(lx) < b.hx + pad && Math.abs(lz) < b.hz + pad && y < baseOf(b) + b.h) return true;
  }
  return false;
}
/** the highest building top under (x, z) that a body with its feet at y stands on (it's above it, or it's a step) */
export function buildingFloor(x: number, z: number, y: number) {
  let top = -Infinity;
  for (const b of nearBuildings(x, z)) {
    if (b.posts) continue;
    const dx = x - b.x;
    const dz = z - b.z;
    const reach = Math.max(b.hx, b.hz) + 1;
    if (dx * dx + dz * dz > reach * reach) continue;
    const [c, s] = trig.get(b)!;
    if (Math.abs(dx * c - dz * s) > b.hx || Math.abs(dx * s + dz * c) > b.hz) continue;
    const t = baseOf(b) + b.h;
    if (t <= y + STEP_UP && t > top) top = t;
  }
  return top;
}
/** push a body out of any building it walked into (out through the nearest wall). Height matters: over a
 *  building's top (flying, gliding, jumping off a roof) nothing pushes, and a low block is a step to climb */
export function pushOutOfBuildings(p: [number, number, number]) {
  const R = 0.35;
  for (const b of nearBuildings(p[0], p[2])) {
    const dx = p[0] - b.x;
    const dz = p[2] - b.z;
    const reach = Math.max(b.hx, b.hz) + 3;
    if (dx * dx + dz * dz > reach * reach) continue;
    const [c, s] = trig.get(b)!;
    let lx = dx * c - dz * s;
    let lz = dx * s + dz * c;
    if (p[1] >= baseOf(b) + (b.posts ? b.h * 0.85 : b.h) - (b.posts ? 0 : STEP_UP)) continue;
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
    if (nearTq(x, z, 52) || nearCourt(x, z, CT_PAD + 6) || BUILDINGS.some((b) => Math.hypot(b.x - x, b.z - z) < Math.max(b.hx, b.hz) + 7)) continue;
    if (pathDist(x, z) < 7 || onGudao(x, z, pathDist(x, z)) || nearPlace(x, z, 4)) continue;
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

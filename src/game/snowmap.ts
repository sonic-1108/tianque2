// 雪岭 as laid out by hand (owner: the snow mountain was full of bugs and looked bad: it was raw noise, a maze of knife
// ridges you couldn't cross, the camp stood on a cliff and people sank out of sight into the slopes). Now: a valley up
// from the 天阙 road through pine woods, a stone gate at the snowline, a canyon climb, the camp on its terrace, a broad
// basin of snow with a frozen lake, the ice cave under its cliff, and a ridge path up to the summit. world.ts shapes
// the ground from these pieces (snowLand), snow.ts and render/Snow.tsx place things by them, the big map draws the road.
// A leaf module: only layout.ts (itself a leaf) is imported.
import { ICE_CAVE, SNOW_CAMP } from './layout';

/** a road point: x, z, the road's height there, and how wide the open ground round it is (half width) */
export type RoadPt = [number, number, number, number];

/** 雪岭山道: from the fork on the 天阙 road up the valley (pines, a rest pavilion), through the gate at the snowline,
 *  up the canyon to the camp, then across the basin to the ice cave. Graded (never steeper than about 1 in 5) and
 *  level across. */
export const SNOW_ROAD: RoadPt[] = [
  [-722, -300, 47.8, 9], // the fork, on the climb to 天阙 (past 望阙台's terrace)
  [-709, -333, 52.5, 16],
  [-695, -376, 58, 24],
  [-698, -426, 64, 26],
  [-713, -476, 70.5, 26],
  [-734, -528, 77.5, 24],
  [-748, -566, 84, 18],
  [-750, -588, 89.5, 10], // 雪岭山门, the stone gate at the valley's head
  [-744, -622, 96, 7.5], // the canyon
  [-752, -656, 102, 7.5],
  [-741, -690, 109, 7.5],
  [-724, -712, 115.5, 8],
  [-716, -729, 118, 9], // the camp
  [-728, -752, 119.5, 8],
  [-752, -778, 121.5, 8],
  [-782, -805, 124.5, 8],
  [-805, -828, 128, 7],
  [-821, -841, 130, 6], // before the cave's mouth
];
/** the road's level band (half width) and where it has eased back into the land */
export const ROAD_HALF = 5.5;
export const ROAD_EASE = 11;
/** the gate's place on the road */
export const GATE_AT = 7;
/** where the road reaches the camp */
export const CAMP_AT = 12;

/** the basin above the camp: open snow you can roam (circles: centre, radius, floor height there) */
export const BASIN: { x: number; z: number; r: number; h: number }[] = [
  { x: -722, z: -760, r: 22, h: 120 },
  { x: -762, z: -795, r: 32, h: 122 },
  { x: -800, z: -818, r: 22, h: 126 },
  { x: -744, z: -846, r: 26, h: 127.5 },
  { x: -690, z: -793, r: 25, h: 123 },
  { x: -646, z: -800, r: 28, h: 125.5 },
  { x: -603, z: -772, r: 24, h: 124.5 },
  { x: -808, z: -772, r: 19, h: 124 },
  { x: -712, z: -826, r: 13, h: 127.5 },
];

/** level ground: the camp's terrace, the gate's yard, the lake's ice, the cave's apron, the two rock shelters */
export interface Pad {
  id: string;
  x: number;
  z: number;
  r: number;
  edge: number;
  h: number;
}
const CAVE_FWD: [number, number] = [Math.sin(ICE_CAVE.rot), Math.cos(ICE_CAVE.rot)];
export const PADS: Pad[] = [
  { id: 'camp', x: SNOW_CAMP.x, z: SNOW_CAMP.z, r: 15, edge: 9, h: 118 },
  { id: 'gate', x: SNOW_ROAD[GATE_AT][0], z: SNOW_ROAD[GATE_AT][1], r: 8, edge: 6, h: SNOW_ROAD[GATE_AT][2] },
  { id: 'lake', x: -748, z: -818, r: 15, edge: 5, h: 121.2 },
  { id: 'cave', x: ICE_CAVE.x + CAVE_FWD[0] * 10, z: ICE_CAVE.z + CAVE_FWD[1] * 10, r: 9, edge: 6, h: 130 },
  { id: 'shelterE', x: -650, z: -800, r: 6, edge: 5, h: 125.5 },
  { id: 'shelterW', x: -812, z: -770, r: 6, edge: 5, h: 124 },
  { id: 'pavilion', x: -683, z: -404, r: 7, edge: 5, h: 61 },
];
export const padById = (id: string) => PADS.find((p) => p.id === id)!;
/** the frozen lake (its ice is the pad's floor) */
export const LAKE = padById('lake');

/** 雪岭之巅: a peak standing out of the basin's north-east rim, too steep to climb but by the ledge path that winds
 *  round it one and a half times from the basin to the top */
export const SUMMIT_TOP: [number, number] = [-662, -884];
export const SUMMIT_H = 214;
/** the peak's flanks: this much fall per metre out from the top */
export const PEAK_SLOPE = 1.5;
export const SUMMIT_PATH: [number, number, number][] = (() => {
  const out: [number, number, number][] = [];
  const [cx, cz] = SUMMIT_TOP;
  // from the basin (south-west of the peak) round by the east and north, climbing as it closes in
  const a0 = Math.atan2(-826 - cz, -706 - cx), turns = 1.45, h0 = 127.5;
  const r0 = Math.hypot(-706 - cx, -826 - cz), r1 = 6;
  const N = 40;
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    const a = a0 + t * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * Math.pow(t, 0.85);
    out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r, h0 + (SUMMIT_H - h0) * t]);
  }
  return out;
})();

/** the road as a polyline (x, z) for the map and the ground's trodden look */
export const SNOW_TRAIL: [number, number][] = SNOW_ROAD.map(([x, z]) => [x, z]);

/** the nearest point of a polyline: distance, height there, open half width there, which segment and how far along */
export function nearOnLine(line: readonly (readonly number[])[], x: number, z: number) {
  let bd = Infinity, bh = 0, bw = 0, bi = 0, bu = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    const vx = b[0] - a[0], vz = b[1] - a[1], L2 = vx * vx + vz * vz;
    const u = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / L2));
    const d = Math.hypot(x - (a[0] + vx * u), z - (a[1] + vz * u));
    if (d < bd) {
      bd = d;
      bh = a[2] + (b[2] - a[2]) * u;
      bw = (a[3] ?? 0) + ((b[3] ?? 0) - (a[3] ?? 0)) * u;
      bi = i - 1;
      bu = u;
    }
  }
  return { d: bd, h: bh, w: bw, i: bi, u: bu };
}
/** a point along the road (segment i, fraction u) and its heading */
export function roadAt(i: number, u: number) {
  const a = SNOW_ROAD[Math.min(i, SNOW_ROAD.length - 2)], b = SNOW_ROAD[Math.min(i, SNOW_ROAD.length - 2) + 1];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return { x: a[0] + (b[0] - a[0]) * u, z: a[1] + (b[1] - a[1]) * u, h: a[2] + (b[2] - a[2]) * u, ux: (b[0] - a[0]) / L, uz: (b[1] - a[1]) / L };
}
/** the whole 雪岭 lies in here (anything outside is the ordinary land) */
export const SNOW_BOX = { x0: -1000, x1: -420, z0: -1000, z1: -230 };
export const inSnowBox = (x: number, z: number) => x > SNOW_BOX.x0 && x < SNOW_BOX.x1 && z > SNOW_BOX.z0 && z < SNOW_BOX.z1;

// ---------------------------------------------------------------- what stands on the mountain (drawn by render/Snow.tsx;
// SNOW_PARTS are their solid parts, in world.ts BUILDINGS: the two must agree)
/** a frame: where, which way its local +z faces (the buildings' convention: +z → (sin rot, cos rot)) */
export interface Frame {
  x: number;
  z: number;
  rot: number;
}
const heading = (i: number) => {
  const a = SNOW_ROAD[Math.max(0, i - 1)], b = SNOW_ROAD[Math.min(SNOW_ROAD.length - 1, i + 1)];
  return Math.atan2(b[0] - a[0], b[1] - a[1]);
};
/** a point in a frame's own coordinates, in the world */
export const inFrame = (f: Frame, lx: number, lz: number): [number, number] => [f.x + lx * Math.cos(f.rot) + lz * Math.sin(f.rot), f.z - lx * Math.sin(f.rot) + lz * Math.cos(f.rot)];

/** 雪岭山门: two stone pillars across the road at the valley's head, a beam and a little tiled roof, the board */
export const GATE: Frame = { x: SNOW_ROAD[GATE_AT][0], z: SNOW_ROAD[GATE_AT][1], rot: heading(GATE_AT) };
export const GATE_HALF = 3.7;
/** the rest pavilion beside the valley road, open to it */
export const PAVILION: Frame = (() => {
  const p = padById('pavilion');
  const r = nearOnLine(SNOW_ROAD, p.x, p.z), q = roadAt(r.i, r.u);
  return { x: p.x, z: p.z, rot: Math.atan2(q.x - p.x, q.z - p.z) };
})();
/** the camp: its frame faces down the road the way you come up (local +z toward the canyon) */
export const CAMP: Frame = { x: SNOW_CAMP.x, z: SNOW_CAMP.z, rot: Math.atan2(SNOW_ROAD[CAMP_AT - 1][0] - SNOW_CAMP.x, SNOW_ROAD[CAMP_AT - 1][1] - SNOW_CAMP.z) };
/** the camp's tents (local x, z, turn: the door faces local +z turned by it) */
export const TENTS: [number, number, number][] = [
  [-11, 4, Math.PI / 2],
  [6, -11, Math.PI * 0.85],
  [10.5, -5, -Math.PI / 2.2],
];
/** the camp's fire, beside the road where it crosses the terrace */
export const CAMP_FIRE: [number, number] = inFrame(CAMP, 6.5, 2);
/** the 传送阵 by the camp's way in, and where its two folk keep (the ginseng digger by the fire, the warden by the banner) */
export const CAMP_GATE: [number, number] = inFrame(CAMP, -6.8, 7.2);
export const CAMP_DIGGER: [number, number] = inFrame(CAMP, 7.6, 4.2);
export const CAMP_WARDEN: [number, number] = inFrame(CAMP, 1.5, -7);
/** the stockade of stakes round the camp's back, as runs between local points */
export const CAMP_FENCE: [number, number, number, number][] = (() => {
  const out: [number, number, number, number][] = [];
  const R = 14.2;
  // from the south-east round the back to the west, leaving the road's ways in (from the canyon, local +z) and on
  // (to the basin, at about 2.5 rad)
  const arcs: [number, number][] = [
    [-0.6, 2.1],
    [2.9, 3.5],
  ];
  for (const [a0, a1] of arcs) {
    const n = Math.max(2, Math.round(((a1 - a0) * R) / 3.2));
    for (let k = 0; k < n; k++) {
      const s0 = a0 + ((a1 - a0) * k) / n, s1 = a0 + ((a1 - a0) * (k + 1)) / n;
      // local frame: angle 0 = +x, π/2 = -z (the back)
      out.push([Math.cos(s0) * R, -Math.sin(s0) * R, Math.cos(s1) * R, -Math.sin(s1) * R]);
    }
  }
  return out;
})();
/** the ice cave's frame: +z out of its mouth */
export const CAVE: Frame = { x: ICE_CAVE.x, z: ICE_CAVE.z, rot: ICE_CAVE.rot };
/** the old temple's stupas on the cave's apron (local x, z, height) */
export const STUPAS: [number, number, number][] = [
  [-6.2, 5, 3.4],
  [-7.4, 9, 4.6],
  [-6.6, 13, 2.8],
  [6.4, 5.5, 3.9],
  [7.2, 10, 3.1],
];
/** the temple's broken gate before the apron (local z), its pillars at ±x */
export const RUIN_Z = 16.5;
export const RUIN_HALF = 3.4;
/** the stele by the summit's cairn, across the top from where the path arrives */
export const STELE_AT: [number, number] = (() => {
  const [x, z] = SUMMIT_PATH[SUMMIT_PATH.length - 1];
  const dx = SUMMIT_TOP[0] - x, dz = SUMMIT_TOP[1] - z, l = Math.hypot(dx, dz) || 1;
  return [SUMMIT_TOP[0] + (dx / l) * 3, SUMMIT_TOP[1] + (dz / l) * 3];
})();

export interface SnowPart {
  x: number;
  z: number;
  rot: number;
  hx: number;
  hz: number;
  h: number;
  posts?: [number, number, number][];
  /** set when it stands on a pad (its floor is the pad's) */
  y0?: number;
}
export const SNOW_PARTS: SnowPart[] = (() => {
  const out: SnowPart[] = [];
  out.push({ ...GATE, hx: GATE_HALF + 0.8, hz: 0.7, h: 7.6, posts: [[-GATE_HALF, 0, 0.55], [GATE_HALF, 0, 0.55]] });
  out.push({ ...PAVILION, hx: 3, hz: 3, h: 5.4, posts: [[-2.4, -2.4, 0.28], [2.4, -2.4, 0.28], [-2.4, 2.4, 0.28], [2.4, 2.4, 0.28]] });
  const campH = padById('camp').h;
  for (const [lx, lz, r] of TENTS) {
    const [x, z] = inFrame(CAMP, lx, lz);
    out.push({ x, z, rot: CAMP.rot + r, hx: 1.55, hz: 1.75, h: 2.2, y0: campH });
  }
  for (const [ax, az, bx, bz] of CAMP_FENCE) {
    const [x0, z0] = inFrame(CAMP, ax, az), [x1, z1] = inFrame(CAMP, bx, bz);
    out.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, rot: Math.atan2(x1 - x0, z1 - z0), hx: 0.3, hz: Math.hypot(x1 - x0, z1 - z0) / 2 + 0.15, h: 2.4, y0: campH });
  }
  const caveH = padById('cave').h;
  for (const [lx, lz] of STUPAS) {
    const [x, z] = inFrame(CAVE, lx, lz);
    out.push({ x, z, rot: CAVE.rot, hx: 1.6, hz: 1.6, h: 6, posts: [[0, 0, 1.05]], y0: caveH });
  }
  {
    const [x, z] = inFrame(CAVE, 0, RUIN_Z);
    out.push({ x, z, rot: CAVE.rot, hx: RUIN_HALF + 1, hz: 0.8, h: 5, posts: [[-RUIN_HALF, 0, 0.5], [RUIN_HALF, 0, 0.5]] });
  }
  out.push({ x: STELE_AT[0], z: STELE_AT[1], rot: 0.4, hx: 0.5, hz: 0.25, h: 2.6 });
  // the rock shelters' two boulders each
  for (const id of ['shelterE', 'shelterW']) {
    const p = padById(id);
    out.push({ x: p.x, z: p.z, rot: shelterRot(p), hx: 3.4, hz: 1.4, h: 2.4, posts: [[-2.3, -1.2, 1.15], [2.3, -1.3, 1.05]] });
  }
  return out;
})();
/** a rock shelter turns its open side to the basin's middle */
export function shelterRot(p: { x: number; z: number }) {
  return Math.atan2(-742 - p.x, -800 - p.z);
}

/** 半山石龛: a niche cut into the peak's side halfway up its path, a fire in it (somewhere to thaw on the climb) */
export const NICHE: [number, number] = (() => {
  const [x, z] = SUMMIT_PATH[20];
  const dx = SUMMIT_TOP[0] - x, dz = SUMMIT_TOP[1] - z, l = Math.hypot(dx, dz);
  return [x + (dx / l) * 1.7, z + (dz / l) * 1.7];
})();

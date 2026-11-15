// 青石村 dressed (owner: the village looked empty, everything set out in one ring round the square, not like a village).
// Behind every house a walled yard: plaster walls under grey tile, a vegetable plot, a wood pile, a water vat, a drying
// rack hung with corn and chillies, washing on a line, a fruit tree. Through the grounds trees and bamboo; on the square
// stone tables and stools, a pair of lions at the main lane, flagpoles, big pots of green; tufts and flowers everywhere
// the feet don't wear them away. Pure data, laid out once: a piece is kept only if it leaves the roads, the doors, the
// people, the buildings and the gates clear (free()). world.ts takes the solid ones (DRESS_SOLIDS), render/VillageDress.tsx
// draws them all.
import { ROADS } from './layout';
import { FOLK, PLACES } from './places';
import { HOME, HOME_D, HOME_W, VILLAGE_PROPS, WALL_R } from './village';
import { fit } from './props';
import { BOARDS } from './court';

export type DressKind =
  | 'wall' | 'plot' | 'woodpile' | 'vat' | 'rack' | 'washing' | 'tree' | 'bamboo' | 'table' | 'lion' | 'flagpole'
  | 'pot' | 'bench' | 'tuft' | 'flowers' | 'basket' | 'millstone' | 'hang';
export interface Dress {
  k: DressKind;
  x: number;
  z: number;
  /** facing (radians, the Builder's turn about y) */
  rot: number;
  /** a size: a wall's length, a plot's width, a tree's height */
  s: number;
  /** a plot's depth, a wall's gate gap */
  t?: number;
  seed: number;
}
export interface DressSolid { x: number; z: number; rot: number; hx: number; hz: number; h: number; posts?: [number, number, number][] }

const rnd = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
/** a point given in a frame (x, z, turned rot) to the world: local +z is the frame's front */
const at = (x: number, z: number, rot: number, lx: number, lz: number): [number, number] => {
  const c = Math.cos(rot), s = Math.sin(rot);
  return [x + lx * c + lz * s, z - lx * s + lz * c];
};

// ---- what must stay clear
type Box = { x: number; z: number; rot: number; hx: number; hz: number };
const BOXES: Box[] = [];
const CIRCLES: [number, number, number][] = [];
const inBox = (b: Box, x: number, z: number, pad: number) => {
  const c = Math.cos(b.rot), s = Math.sin(b.rot), dx = x - b.x, dz = z - b.z;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  return Math.abs(lx) < b.hx + pad && Math.abs(lz) < b.hz + pad;
};
/** the houses round the square (as world.ts and interiors.ts place them) */
export const VILLAGE_HOUSES = ROADS.map((_, k) => {
  const a0 = Math.atan2(ROADS[k][2][1], ROADS[k][2][0]);
  let a1 = Math.atan2(ROADS[(k + 1) % ROADS.length][2][1], ROADS[(k + 1) % ROADS.length][2][0]);
  if (a1 < a0) a1 += Math.PI * 2;
  const a = (a0 + a1) / 2;
  const x = Math.cos(a) * 20, z = Math.sin(a) * 20;
  const big = k % 2 === 0; // house-a and house-b by turns
  return { x, z, rot: Math.atan2(-x, -z), hx: big ? 5.1 : 4.1, hz: big ? 3.9 : 4.4 };
});
const ROAD_A = ROADS.map((r) => Math.atan2(r[2][1], r[2][0]));
const HOUSE_BOX = new Map<number, Box>();
{
  for (const [i, h] of VILLAGE_HOUSES.entries()) {
    const hb = { x: h.x, z: h.z, rot: h.rot, hx: h.hx + 0.5, hz: h.hz + 0.5 };
    BOXES.push(hb);
    HOUSE_BOX.set(i, hb);
    // the way to the door, from the square
    const [dx, dz] = at(h.x, h.z, h.rot, 0, h.hz + 3);
    BOXES.push({ x: dx, z: dz, rot: h.rot, hx: 1.8, hz: 3.2 });
  }
  for (const [file, deg, r, size] of VILLAGE_PROPS) {
    const a = (deg * Math.PI) / 180, x = Math.cos(a) * r, z = Math.sin(a) * r, g = fit(file, size);
    BOXES.push({ x, z, rot: Math.atan2(-x, -z), hx: g.hx + 0.8, hz: g.hz + 0.8 });
  }
  BOXES.push({ x: HOME.x, z: HOME.z, rot: HOME.rot, hx: HOME_W / 2 + 0.8, hz: HOME_D / 2 + 0.8 });
  {
    const [dx, dz] = HOME.door;
    CIRCLES.push([dx, dz, 2.6]);
  }
  for (const [x, z] of BOARDS) CIRCLES.push([x, z, 2.2]);
  // the well and the old locust tree's ring (World.tsx)
  CIRCLES.push([0, -3, 2.8], [8, -9, 3.4]);
  // the workshops inside the wall keep their yards
  for (const p of PLACES) if (Math.hypot(p.x, p.z) < WALL_R + 10) CIRCLES.push([p.x, p.z, (p.pad ?? 12) + 1]);
  // people where they stand (strollers pick their way round things, so only their own spot is kept)
  for (const f of FOLK) if (Math.hypot(f.x, f.z) < WALL_R + 4) CIRCLES.push([f.x, f.z, 1.7 + Math.min(f.walk ?? 0, 1)]);
}
/** is a spot clear for a piece of radius rad; square: may it stand on the square's flagstones; skip: a box it may
 *  touch (a house's own front, for what stands against it) */
export function free(x: number, z: number, rad: number, square = false, skip?: Box) {
  const r = Math.hypot(x, z + 3);
  if (!square && r < 15.2 + rad) return false; // the square stays open but for its own furniture
  if (Math.hypot(x, z) > WALL_R - 3 - rad) return false; // off the stockade and its walk
  // the roads through the village (the lanes out of the square, and the gates)
  const a = Math.atan2(z, x), R = Math.hypot(x, z);
  for (const ra of ROAD_A) {
    const d = Math.abs(Math.atan2(Math.sin(a - ra), Math.cos(a - ra)));
    if (d < Math.PI / 2 && R * Math.sin(d) < 3.6 + rad && R > 12) return false;
  }
  for (const b of BOXES) if (b !== skip && inBox(b, x, z, rad)) return false;
  for (const [cx, cz, cr] of CIRCLES) if (Math.hypot(x - cx, z - cz) < cr + rad) return false;
  return true;
}

// ---- the dressing
export const DRESS: Dress[] = [];
export const DRESS_SOLIDS: DressSolid[] = [];
const taken: [number, number, number][] = [];
const clear = (x: number, z: number, rad: number, square = false) => free(x, z, rad, square) && taken.every(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) >= tr + rad);
function put(d: Dress, rad: number, solid?: Omit<DressSolid, 'x' | 'z' | 'rot'>) {
  DRESS.push(d);
  taken.push([d.x, d.z, rad]);
  if (solid) DRESS_SOLIDS.push({ x: d.x, z: d.z, rot: d.rot, ...solid });
}

// yards behind the houses
VILLAGE_HOUSES.forEach((h, i) => {
  const W = h.hx + 1.4; // the yard's half width
  // as deep as the ground behind allows (3 to 6.5 m: most of the back line clear; a wall run that isn't is left out)
  let D = 6.5;
  for (; D >= 3; D -= 0.5) {
    let ok = 0, n = 0;
    for (let lx = -W; lx <= W; lx += 1) {
      const [x, z] = at(h.x, h.z, h.rot, lx, -h.hz - D);
      n++;
      if (free(x, z, 0.2)) ok++;
    }
    if (ok >= n * 0.6) break;
  }
  if (D < 3) return;
  const back = -h.hz - D;
  // the walls in two metre runs (a run that would block something is left out: a gap); a gate in the back wall
  const runs: [number, number, number, number][] = [];
  const seg = (x0: number, z0: number, x1: number, z1: number) => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 2));
    for (let j = 0; j < n; j++) runs.push([x0 + ((x1 - x0) * j) / n, z0 + ((z1 - z0) * j) / n, x0 + ((x1 - x0) * (j + 1)) / n, z0 + ((z1 - z0) * (j + 1)) / n]);
  };
  seg(-W, -h.hz + 0.6, -W, back);
  seg(-W, back, -0.9, back);
  seg(0.9, back, W, back);
  seg(W, back, W, -h.hz + 0.6);
  runs.forEach(([x0, z0, x1, z1], j) => {
    const [ax, az] = at(h.x, h.z, h.rot, (x0 + x1) / 2, (z0 + z1) / 2);
    if (!free(ax, az, 0.25)) return;
    const L = Math.hypot(x1 - x0, z1 - z0);
    const rot = h.rot + Math.atan2(x1 - x0, z1 - z0);
    DRESS.push({ k: 'wall', x: ax, z: az, rot, s: L, seed: i * 31 + j });
    DRESS_SOLIDS.push({ x: ax, z: az, rot, hx: 0.18, hz: L / 2 + 0.05, h: 1.9 });
  });
  // inside: the plot on one side, the household things on the other, the tree in a back corner, washing across
  const side = i % 2 ? 1 : -1;
  const yard = (lx: number, lz: number): [number, number] => at(h.x, h.z, h.rot, lx, lz);
  {
    const [x, z] = yard(side * W * 0.45, (back - h.hz) / 2 - 0.3);
    DRESS.push({ k: 'plot', x, z, rot: h.rot, s: W * 0.8, t: D - 2, seed: i * 7 + 1 });
  }
  const things: [DressKind, number, number, number, Omit<DressSolid, 'x' | 'z' | 'rot'> | undefined][] = [
    ['woodpile', -side * (W - 1.0), -h.hz - 1.4, 0.8, { hx: 1.1, hz: 0.45, h: 1.3 }],
    ['vat', -side * (W - 0.9), -h.hz - 3.0, 0.5, { hx: 0.45, hz: 0.45, h: 1.0 }],
    ['rack', -side * (W * 0.35), back + 1.1, 0.6, { hx: 1.3, hz: 0.2, h: 2.4, posts: [[-1.2, 0, 0.1], [1.2, 0, 0.1]] }],
    ['tree', side * (W - 1.1), back + 1.2, 0.5, { hx: 0.35, hz: 0.35, h: 3, posts: [[0, 0, 0.32]] }],
    ['basket', -side * (W - 2.2), -h.hz - 1.2, 0.4, undefined],
  ];
  things.forEach(([k, lx, lz, rad, solid], j) => {
    const [x, z] = yard(lx, lz);
    if (!free(x, z, rad)) return;
    put({ k, x, z, rot: h.rot + (k === 'rack' ? 0 : rnd(i, j) * 0.6), s: k === 'tree' ? 4.6 + rnd(j, i) * 1.4 : 1, seed: i * 13 + j }, rad, solid);
  });
  {
    const [x, z] = yard(-side * W * 0.3, -h.hz - 2.4);
    if (free(x, z, 0.4)) put({ k: 'washing', x, z, rot: h.rot + Math.PI / 2, s: Math.min(4.2, D - 1.2), seed: i * 5 + 3 }, 0.3, { hx: 0.12, hz: Math.min(4.2, D - 1.2) / 2, h: 2, posts: [[0, -Math.min(4.2, D - 1.2) / 2, 0.08], [0, Math.min(4.2, D - 1.2) / 2, 0.08]] });
  }
});

// before every house: pots of green either side of the door, a bench against the front wall, corn and chillies hung
// under the eaves at the corners, a basket by the step (all off the way to the door)
VILLAGE_HOUSES.forEach((h, i) => {
  const front = (lx: number, lz: number): [number, number] => at(h.x, h.z, h.rot, lx, lz);
  const own = HOUSE_BOX.get(i);
  const ok = (x: number, z: number, rad: number) => free(x, z, rad, true, own) && taken.every(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) >= tr + rad);
  for (const sx of [-1, 1]) {
    const [px, pz] = front(sx * 2.4, h.hz + 0.75);
    if (ok(px, pz, 0.45)) put({ k: 'pot', x: px, z: pz, rot: h.rot, s: 0.85, seed: i * 3 + sx }, 0.45, { hx: 0.4, hz: 0.4, h: 0.85 });
    // hung from the eaves (nothing to walk into)
    const [hx2, hz2] = front(sx * (h.hx - 0.5), h.hz + 0.35);
    DRESS.push({ k: 'hang', x: hx2, z: hz2, rot: h.rot, s: 1, seed: i * 5 + sx });
  }
  const sb = i % 2 ? 1 : -1;
  const [bx, bz] = front(sb * (h.hx - 1.6), h.hz + 0.65);
  if (ok(bx, bz, 0.5)) put({ k: 'bench', x: bx, z: bz, rot: h.rot, s: 1, seed: i }, 0.5, { hx: 0.95, hz: 0.22, h: 0.46 });
  const [kx, kz] = front(-sb * (h.hx - 1.0), h.hz + 0.7);
  if (ok(kx, kz, 0.35)) DRESS.push({ k: 'basket', x: kx, z: kz, rot: h.rot + i, s: 1, seed: i * 9 });
});

// the square's furniture: stone tables with stools, a pair of lions at the main lane, flagpoles, pots, benches
{
  const sq: [DressKind, number, number, number, number, Omit<DressSolid, 'x' | 'z' | 'rot'> | undefined][] = [];
  // tables in the shade round the edge (tried round the ring; the first clear ones kept)
  let tables = 0;
  for (let k = 0; k < 36 && tables < 3; k++) {
    const a = (k / 36) * Math.PI * 2 + 0.3, r = 10.5;
    const x = Math.cos(a) * r, z = Math.sin(a) * r - 3;
    if (!clear(x, z, 1.5, true)) continue;
    put({ k: 'table', x, z, rot: a, s: 1, seed: k }, 1.5, { hx: 0.5, hz: 0.5, h: 0.8, posts: [[0, 0, 0.45], [0.95, 0, 0.2], [-0.95, 0, 0.2], [0, 0.95, 0.2], [0, -0.95, 0.2]] });
    tables++;
  }
  // the lions where the east road (to the paifang and 青石集) leaves the square, facing out along it
  const ea = ROAD_A.reduce((b, a) => (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < Math.abs(Math.atan2(Math.sin(b), Math.cos(b))) ? a : b), ROAD_A[0]);
  for (const s of [-1, 1]) {
    const r = 14.6, off = 4.6;
    const x = Math.cos(ea) * r - Math.sin(ea) * off * s, z = Math.sin(ea) * r + Math.cos(ea) * off * s;
    if (clear(x, z, 0.9, true)) put({ k: 'lion', x, z, rot: Math.atan2(Math.cos(ea), Math.sin(ea)), s: s, seed: s + 5 }, 0.9, { hx: 0.55, hz: 0.85, h: 1.7 });
  }
  // flagpoles and pots round the ring
  let poles = 0, pots = 0, benches = 0;
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * Math.PI * 2, r = 13.6 - (k % 3) * 0.4;
    const x = Math.cos(a) * r, z = Math.sin(a) * r - 3;
    if (poles < 2 && k % 9 === 4 && clear(x, z, 0.6, true)) {
      put({ k: 'flagpole', x, z, rot: a, s: 8.5, seed: k }, 0.6, { hx: 0.2, hz: 0.2, h: 8, posts: [[0, 0, 0.16]] });
      poles++;
    } else if (pots < 8 && k % 4 === 1 && clear(x, z, 0.7, true)) {
      put({ k: 'pot', x, z, rot: a, s: 1, seed: k }, 0.7, { hx: 0.42, hz: 0.42, h: 0.9 });
      pots++;
    } else if (benches < 5 && k % 6 === 3 && clear(x, z, 1.2, true)) {
      put({ k: 'bench', x, z, rot: a + Math.PI / 2, s: 1, seed: k }, 1.2, { hx: 0.95, hz: 0.22, h: 0.46 });
      benches++;
    }
  }
}

// trees and bamboo through the grounds, apart from each other
{
  let n = 0;
  for (let i = 0; i < 1400 && n < 46; i++) {
    const a = rnd(i, 1) * Math.PI * 2, r = 24 + rnd(i, 2) * 36;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const bamboo = rnd(i, 3) < 0.4;
    const rad = bamboo ? 1.4 : 1.2;
    if (!clear(x, z, rad + 2.2)) continue;
    if (bamboo) put({ k: 'bamboo', x, z, rot: rnd(i, 4) * 6.28, s: 6 + rnd(i, 5) * 3, seed: i }, rad + 1.5, { hx: 0.9, hz: 0.9, h: 6 });
    else put({ k: 'tree', x, z, rot: rnd(i, 4) * 6.28, s: 6 + rnd(i, 5) * 4, seed: i }, rad + 2, { hx: 0.4, hz: 0.4, h: 4, posts: [[0, 0, 0.4]] });
    n++;
  }
  // a millstone or two in the open
  let m = 0;
  for (let i = 0; i < 400 && m < 2; i++) {
    const a = rnd(i, 7) * Math.PI * 2, r = 25 + rnd(i, 8) * 20;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!clear(x, z, 1.6)) continue;
    put({ k: 'millstone', x, z, rot: rnd(i, 9) * 6.28, s: 1, seed: i }, 1.6, { hx: 0.8, hz: 0.8, h: 0.9 });
    m++;
  }
}

// tufts of grass and flowers (nothing solid), off the lanes and doorways
{
  let t = 0, f = 0;
  for (let i = 0; i < 9000 && (t < 700 || f < 160); i++) {
    const a = rnd(i, 11) * Math.PI * 2, r = 15.5 + Math.sqrt(rnd(i, 12)) * 46;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!free(x, z, 0.2)) continue;
    if (taken.some(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) < tr * 0.7)) continue;
    const flower = rnd(i, 13) < 0.2;
    if (flower ? f >= 160 : t >= 700) continue;
    DRESS.push({ k: flower ? 'flowers' : 'tuft', x, z, rot: rnd(i, 14) * 6.28, s: 0.6 + rnd(i, 15) * 0.8, seed: i });
    if (flower) f++;
    else t++;
  }
}

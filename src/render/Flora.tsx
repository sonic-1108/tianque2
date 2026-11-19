// The flora (owner: the trees and grass were poor). Trees grown in code, nine kinds placed by the world's tree list
// (world.ts TREES: 7000 trunks, which still block as before): 黄山松-like pines with layered flat needle pads,
// firs in drooping tiers (the snow country), round 槐 crowns, maples that go red in autumn, ginkgo that goes gold,
// peach trees that flower pink in spring, willows hanging over the water, bamboo clumps in their groves, dead snags.
// Each is a real branching skeleton (bark tubes with a painted bark) carrying foliage cards from the painted atlas
// (floraTex.ts), lit round the crown (normals from the crown's middle, darker inside), swaying in the wind with
// fluttering leaves, turning with the seasons and bare in winter (snow on the boughs). Near the camera a tree is the
// full one; further off a light stand-in of a few big cards; the two cross-fade by a dither, so there is no pop.
// Grass is blades, not cards: tufts of curved tapering blades round you (thinner further out), bending in gusts that
// run across the field and parting round your feet; wildflowers by season in the meadows; shrubs under the trees.
import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Sim } from '../game/sim';
import { CT_PAD, nearCourt } from '../game/court';
import { SNOW_Y, TREES, VILLAGE_R, WATER_Y, WORLD_R, groundHeight, noise, onSnowPad, pathDist, slopeAt, snowTrailDist, type Tree } from '../game/world';
import { DENS, DEN_R } from '../game/foes';
import { nearTq, onGudao } from '../game/layout';
import { nearPlace } from '../game/places';
import { inSnowBox } from '../game/snowmap';
import { DRESS } from '../game/dress';
import { SEASON_U, WATER_U, withSnow } from './season';
import { barkTex, cellUV, culmTex, leafAtlas, type CellName } from './floraTex';

const hash = (x: number, z: number) => {
  const v = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
function rng(seed: number) {
  let s = Math.floor(seed * 2147483646) + 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

// ---------------------------------------------------------------- geometry accumulators
class Acc {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  rnd: number[] = [];
  wind: number[] = [];
  idx: number[] = [];
  get n() {
    return this.pos.length / 3;
  }
  vert(p: THREE.Vector3, n: THREE.Vector3, u: number, v: number, ao: number, r: number, w: number) {
    this.pos.push(p.x, p.y, p.z);
    this.nor.push(n.x, n.y, n.z);
    this.uv.push(u, v);
    this.col.push(ao, ao, ao);
    this.rnd.push(r);
    this.wind.push(w);
  }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aRnd', new THREE.Float32BufferAttribute(this.rnd, 1));
    g.setAttribute('aWind', new THREE.Float32BufferAttribute(this.wind, 1));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}
/** a bark tube along points (radii per point), parallel-transported rings; ao / colour per ring from `shade` */
function tube(A: Acc, pts: THREE.Vector3[], rad: number[], sides: number, H: number, shade?: (i: number) => number, flex = 0) {
  const n = pts.length;
  if (n < 2) return;
  const T = V(), N = V(), B = V(), d = V(), p = V();
  let len = 0;
  const base = A.n;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    T.copy(b).sub(a).normalize();
    if (i === 0) {
      N.copy(Math.abs(T.y) < 0.9 ? UP : V(1, 0, 0)).cross(T).normalize();
    } else {
      N.addScaledVector(T, -T.dot(N)).normalize();
      len += pts[i].distanceTo(pts[i - 1]);
    }
    B.crossVectors(T, N).normalize();
    const ao = shade ? shade(i) : 1;
    const w = Math.min(1, Math.max(0, pts[i].y / H)) + flex * (i / (n - 1));
    for (let j = 0; j <= sides; j++) {
      const ang = (j / sides) * Math.PI * 2;
      d.copy(N).multiplyScalar(Math.cos(ang)).addScaledVector(B, Math.sin(ang));
      p.copy(pts[i]).addScaledVector(d, rad[i]);
      A.vert(p, d, (j / sides) * Math.max(1, Math.round(rad[i] * 12)), len / 1.6, ao, 0, w);
    }
  }
  for (let i = 0; i < n - 1; i++)
    for (let j = 0; j < sides; j++) {
      const a = base + i * (sides + 1) + j, b = a + sides + 1;
      A.idx.push(a, a + 1, b, b, a + 1, b + 1); // wound to face out
    }
}
/** a path that starts at `p0` heading `dir`, bending up by `up` and down by `droop` (per unit length), wobbling */
function path(p0: THREE.Vector3, dir: THREE.Vector3, L: number, steps: number, up: number, droop: number, wob: number, r: () => number) {
  const pts = [p0.clone()];
  const d = dir.clone().normalize(), p = p0.clone();
  const s = L / steps;
  for (let i = 0; i < steps; i++) {
    d.y += (up - droop * (i / steps)) * s;
    d.x += (r() - 0.5) * wob;
    d.z += (r() - 0.5) * wob;
    d.normalize();
    p.addScaledVector(d, s);
    pts.push(p.clone());
  }
  return pts;
}
const taper = (n: number, r0: number, r1: number, flare = 0) => Array.from({ length: n }, (_, i) => r0 + (r1 - r0) * (i / (n - 1)) + (i === 0 ? flare : 0));
const along = (pts: THREE.Vector3[], t: number) => {
  const f = t * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f));
  return pts[i].clone().lerp(pts[i + 1], f - i);
};
const dirAt = (pts: THREE.Vector3[], t: number) => {
  const f = t * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f));
  return pts[i + 1].clone().sub(pts[i]).normalize();
};

/** a foliage card to be laid once the crown is known */
interface Card {
  c: THREE.Vector3;
  n: THREE.Vector3; // facing
  up: THREE.Vector3; // the texture's top (away from its twig)
  w: number;
  h: number;
  cell: CellName;
  /** how much the light normal follows the crown's round (1) or the card (0) */
  round?: number;
}
function layCards(A: Acc, cards: Card[], H: number, r: () => number, crown?: { c: THREE.Vector3; R: number }) {
  if (!cards.length) return;
  // the crown: the cards' middle and reach
  let cc = V(), R = 0;
  if (crown) {
    cc = crown.c;
    R = crown.R;
  } else {
    for (const k of cards) cc.add(k.c);
    cc.multiplyScalar(1 / cards.length);
    for (const k of cards) R = Math.max(R, k.c.distanceTo(cc));
    R = Math.max(0.5, R * 0.95);
  }
  const right = V(), upv = V(), nn = V(), p = V(), sn = V(), ln = V();
  for (const k of cards) {
    nn.copy(k.n).normalize();
    right.crossVectors(k.up, nn);
    if (right.lengthSq() < 1e-6) right.crossVectors(V(1, 0, 0), nn);
    right.normalize();
    upv.crossVectors(nn, right).normalize();
    const [u0, v0, u1, v1] = cellUV(k.cell);
    const rr = r();
    const base = A.n;
    const corners: [number, number, number, number][] = [
      [-0.5, -0.5, u0, v0],
      [0.5, -0.5, u1, v0],
      [0.5, 0.5, u1, v1],
      [-0.5, 0.5, u0, v1],
    ];
    for (const [sx, sy, u, v] of corners) {
      p.copy(k.c).addScaledVector(right, sx * k.w).addScaledVector(upv, sy * k.h);
      sn.copy(p).sub(cc).normalize();
      const round = k.round ?? 0.75;
      ln.copy(nn).multiplyScalar(1 - round).addScaledVector(sn, round).normalize();
      // darker inside the crown and underneath
      const dd = Math.min(1, p.distanceTo(cc) / R);
      const low = Math.min(1, Math.max(0, (p.y - (cc.y - R)) / (2 * R)));
      const ao = (0.42 + 0.58 * Math.pow(dd, 0.8)) * (0.78 + 0.22 * low);
      A.vert(p, ln, u * 0.996 + 0.002, v * 0.996 + 0.002, ao, rr, Math.min(1, Math.max(0, p.y / H)));
    }
    A.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}
/** a spread-out pick of n of the cards (for the far stand-in), each grown to cover its neighbours */
function farCards(cards: Card[], n: number, grow: number): Card[] {
  if (cards.length <= n) return cards.map((k) => ({ ...k, w: k.w * grow * 0.8, h: k.h * grow * 0.8 }));
  const pick: Card[] = [cards[0]];
  const dmin = cards.map((k) => k.c.distanceTo(cards[0].c));
  while (pick.length < n) {
    let bi = 0;
    for (let i = 1; i < cards.length; i++) if (dmin[i] > dmin[bi]) bi = i;
    pick.push(cards[bi]);
    for (let i = 0; i < cards.length; i++) dmin[i] = Math.min(dmin[i], cards[i].c.distanceTo(cards[bi].c));
  }
  return pick.map((k) => ({ ...k, w: k.w * grow, h: k.h * grow }));
}

export interface Grown {
  bark: THREE.BufferGeometry;
  leaves: THREE.BufferGeometry | null;
  farBark: THREE.BufferGeometry;
  farLeaves: THREE.BufferGeometry | null;
  H: number;
}
const rand = (r: () => number, a: number, b: number) => a + (b - a) * r();
const spin = (v: THREE.Vector3, axis: THREE.Vector3, a: number) => v.clone().applyAxisAngle(axis, a);
const randPerp = (d: THREE.Vector3, r: () => number) => {
  const a = Math.abs(d.y) < 0.9 ? UP : V(1, 0, 0);
  const p = V().crossVectors(d, a).normalize();
  return p.applyAxisAngle(d, r() * Math.PI * 2);
};

// ---------------------------------------------------------------- the kinds
export type Kind = 'oak' | 'maple' | 'ginkgo' | 'blossom' | 'pine' | 'fir' | 'willow' | 'bamboo' | 'dead';
/** a broadleaf: a trunk to its fork, limbs, twigs, and cards along the twigs */
function growBroad(seed: number, o: { H: number; fork: number; trunkR: number; limbs: [number, number]; limbEl: [number, number]; limbL: [number, number]; sub: number; subL: number; card: number; cell: CellName; leader?: boolean; up?: number; droop?: number; wob?: number; per?: number; spread?: number }): Grown {
  const r = rng(seed);
  const bark = new Acc(), fbark = new Acc();
  const cards: Card[] = [];
  const H = o.H;
  // the trunk, leaning and wobbling a little, with a flare at its foot
  const lean = V(rand(r, -0.12, 0.12), 1, rand(r, -0.12, 0.12)).normalize();
  const trunk = path(V(0, -0.4, 0), lean, o.fork + 0.4, 5, 0.02, 0, 0.08, r);
  tube(bark, trunk, taper(trunk.length, o.trunkR * 1.05, o.trunkR * 0.72, o.trunkR * 0.35), 8, H, (i) => 0.62 + 0.38 * (i / (trunk.length - 1)));
  tube(fbark, [trunk[0], trunk[trunk.length - 1]], [o.trunkR * 1.2, o.trunkR * 0.7], 5, H);
  const top = trunk[trunk.length - 1];
  const nL = Math.round(rand(r, o.limbs[0], o.limbs[1]));
  const a0 = r() * Math.PI * 2;
  const limbs: THREE.Vector3[][] = [];
  if (o.leader) {
    const lead = path(top, V(0, 1, 0), H - o.fork - 1, 6, 0, 0, 0.015, r);
    limbs.push(lead);
    tube(bark, lead, taper(lead.length, o.trunkR * 0.7, o.trunkR * 0.12), 6, H);
    tube(fbark, [lead[0], lead[lead.length - 1]], [o.trunkR * 0.6, o.trunkR * 0.15], 4, H);
  }
  for (let i = 0; i < nL; i++) {
    // round the trunk (a leader's limbs by the golden angle, so a cone is not a one-sided helix)
    const az = a0 + (o.leader ? i * 2.4 : (i / nL) * Math.PI * 2) + rand(r, -0.4, 0.4);
    const el = rand(r, o.limbEl[0], o.limbEl[1]);
    const dir = V(Math.sin(el) * Math.cos(az), Math.cos(el), Math.sin(el) * Math.sin(az));
    // on a leader, limbs come off it all the way up (shorter higher: a cone)
    const at = o.leader ? along(limbs[0], 0.05 + (i / nL) * 0.85) : top.clone().add(V(0, rand(r, -0.6, 0.2), 0));
    const cone = o.leader ? 1 - (at.y - o.fork) / (H - o.fork) * 0.75 : 1;
    const L = H * rand(r, o.limbL[0], o.limbL[1]) * cone;
    const limb = path(at, dir, L, 5, o.up ?? 0.12, o.droop ?? 0.05, o.wob ?? 0.25, r);
    limbs.push(limb);
    tube(bark, limb, taper(limb.length, o.trunkR * (o.leader ? 0.32 : 0.55), o.trunkR * 0.1), 6, H, undefined, 0.2);
    if (!o.leader || i % 2 === 0) tube(fbark, [limb[0], limb[limb.length - 1]], [o.trunkR * 0.4, o.trunkR * 0.12], 3, H);
    // twigs
    for (let k = 0; k < o.sub; k++) {
      const t = rand(r, 0.3, 0.95);
      const p0 = along(limb, t), d0 = dirAt(limb, t);
      const sd = d0.clone().addScaledVector(randPerp(d0, r), rand(r, 0.6, 1.1)).add(V(0, rand(r, 0, 0.35), 0)).normalize();
      const twig = path(p0, sd, L * o.subL * rand(r, 0.7, 1.2), 3, 0.1, 0.12, 0.3, r);
      tube(bark, twig, taper(twig.length, o.trunkR * 0.14, o.trunkR * 0.03), 4, H, undefined, 0.4);
      // cards on the twig and at its tip, facing out of the crown (set once the crown is known)
      const per = o.per ?? 3;
      for (let c = 0; c < per; c++) {
        const tc = 0.35 + (c / Math.max(1, per - 1)) * 0.65;
        const pc = along(twig, tc).add(V(rand(r, -0.3, 0.3), rand(r, -0.2, 0.3), rand(r, -0.3, 0.3)).multiplyScalar(o.card));
        const sz = o.card * rand(r, 0.75, 1.25);
        cards.push({ c: pc, n: V(), up: V(), w: sz, h: sz, cell: o.cell });
      }
    }
    // a cluster at the limb's own end
    const tip = limb[limb.length - 1];
    cards.push({ c: tip.clone().add(V(0, o.card * 0.2, 0)), n: V(), up: V(), w: o.card * 1.1, h: o.card * 1.1, cell: o.cell });
  }
  // crown known: each card faces out of it (with some randomness), its twigs toward the middle
  const cc = V();
  for (const k of cards) cc.add(k.c);
  cc.multiplyScalar(1 / Math.max(1, cards.length));
  for (const k of cards) {
    const out = k.c.clone().sub(cc).normalize();
    k.n.copy(out).add(V(rand(r, -0.8, 0.8), rand(r, -0.4, 0.8), rand(r, -0.8, 0.8))).normalize();
    k.up.copy(out).add(V(0, 0.4, 0)).normalize();
    if (o.spread) k.c.addScaledVector(out, o.spread);
  }
  const leaves = new Acc(), fleaves = new Acc();
  layCards(leaves, cards, H, r);
  layCards(fleaves, farCards(cards, 14, 2.3), H, r);
  return { bark: bark.geo(), leaves: leaves.geo(), farBark: fbark.geo(), farLeaves: fleaves.geo(), H };
}
/** the pine: a crooked leaning trunk, near-level boughs ending in flat layered pads of needles, a flat-topped crown */
function growPine(seed: number): Grown {
  const r = rng(seed);
  const bark = new Acc(), fbark = new Acc();
  const H = 9.5;
  const lean = V(rand(r, -0.3, 0.3), 1, rand(r, -0.3, 0.3)).normalize();
  const trunk = path(V(0, -0.4, 0), lean, H - 0.6, 7, -0.01, 0, 0.22, r);
  tube(bark, trunk, taper(trunk.length, 0.34, 0.1, 0.14), 8, H, (i) => 0.6 + 0.4 * (i / (trunk.length - 1)));
  tube(fbark, [trunk[0], trunk[3], trunk[trunk.length - 1]], [0.4, 0.26, 0.1], 5, H);
  const cards: Card[] = [];
  const pad = (c: THREE.Vector3, s: number) => {
    // a pad: a broad level card and two smaller ones a little under it, all tilted a touch
    for (let k = 0; k < 3; k++) {
      const cs = s * (k === 0 ? 1 : rand(r, 0.55, 0.75));
      const off = k === 0 ? V() : V(rand(r, -0.4, 0.4) * s, -rand(r, 0.12, 0.3) * s, rand(r, -0.4, 0.4) * s);
      const n = V(rand(r, -0.18, 0.18), 1, rand(r, -0.18, 0.18)).normalize();
      cards.push({ c: c.clone().add(off), n, up: spin(V(1, 0, 0), UP, r() * 6.28), w: cs, h: cs * rand(r, 0.8, 1), cell: 'pine', round: 0.35 });
    }
    // and a couple upright at its rim, so it has thickness from the side
    for (let k = 0; k < 2; k++) {
      const a = r() * 6.28;
      const n = V(Math.cos(a), 0.25, Math.sin(a)).normalize();
      cards.push({ c: c.clone().add(V(0, -0.12 * s, 0)), n, up: UP.clone(), w: s * 0.9, h: s * 0.35, cell: 'pine', round: 0.5 });
    }
  };
  const nB = 7 + Math.floor(r() * 3);
  const a0 = r() * 6.28;
  for (let i = 0; i < nB; i++) {
    const t = 0.42 + (i / nB) * 0.5;
    const p0 = along(trunk, t);
    const az = a0 + i * 2.4 + rand(r, -0.3, 0.3);
    const L = (1 - t) * 6 + rand(r, 0.6, 1.4);
    const d = V(Math.cos(az), rand(r, -0.05, 0.12), Math.sin(az));
    const b = path(p0, d, L, 4, 0.05, 0.02, 0.2, r);
    tube(bark, b, taper(b.length, 0.11 * (1 - t * 0.5), 0.03), 5, H, undefined, 0.3);
    const end = b[b.length - 1];
    pad(end.clone().add(V(0, 0.15, 0)), rand(r, 1.9, 2.7));
    if (L > 2.2) pad(along(b, 0.55).add(V(0, 0.25, 0)), rand(r, 1.4, 2));
  }
  pad(trunk[trunk.length - 1].clone().add(V(0, 0.2, 0)), 2.6);
  const leaves = new Acc(), fleaves = new Acc();
  layCards(leaves, cards, H, r);
  // far: the level pads only, each a little larger
  layCards(fleaves, farCards(cards.filter((k) => k.n.y > 0.8), 10, 1.5), H, r);
  return { bark: bark.geo(), leaves: leaves.geo(), farBark: fbark.geo(), farLeaves: fleaves.geo(), H };
}
/** the fir: a straight trunk, whorls of drooping boughs shorter toward the top, each hung with needle sprays */
function growFir(seed: number): Grown {
  const r = rng(seed);
  const bark = new Acc(), fbark = new Acc();
  const H = 11;
  const trunk = path(V(0, -0.4, 0), V(rand(r, -0.04, 0.04), 1, rand(r, -0.04, 0.04)), H + 0.4, 6, 0, 0, 0.03, r);
  tube(bark, trunk, taper(trunk.length, 0.27, 0.03, 0.1), 7, H, (i) => 0.55 + 0.45 * (i / (trunk.length - 1)));
  tube(fbark, [trunk[0], trunk[trunk.length - 1]], [0.3, 0.04], 5, H);
  const cards: Card[] = [];
  let a = r() * 6.28;
  for (let y = 1.3; y < H - 0.6; y += rand(r, 0.5, 0.65)) {
    const f = (H - y) / H;
    const L = f * 3.3 + 0.35;
    const n = y < H - 2 ? 5 : 4;
    for (let k = 0; k < n; k++) {
      a += 2.4;
      const d = V(Math.cos(a), -rand(r, 0.05, 0.35), Math.sin(a)).normalize();
      const p0 = along(trunk, y / H);
      const b = path(p0, d, L, 2, -0.05, 0.15, 0.1, r);
      if (y < H * 0.6) tube(bark, b, [0.05 * f + 0.01, 0.01, 0.005], 3, H, undefined, 0.4);
      // the spray hangs from the bough: its top toward the trunk
      const mid = along(b, 0.55).add(V(0, -0.15 * L, 0));
      const side = V().crossVectors(d, UP).normalize();
      const up = d.clone().negate().add(V(0, 0.9, 0)).normalize();
      cards.push({ c: mid, n: side.clone().add(V(0, 0.35, 0)).normalize(), up, w: L * 1.05, h: L * 1.15, cell: 'fir', round: 0.6 });
      cards.push({ c: mid.clone().add(V(0, 0.08, 0)), n: V(0, 1, 0).add(side.clone().multiplyScalar(0.3)).normalize(), up: d.clone(), w: L * 0.75, h: L * 1.05, cell: 'fir', round: 0.6 });
    }
  }
  // the spire
  const tip = trunk[trunk.length - 1];
  for (let k = 0; k < 2; k++) cards.push({ c: tip.clone().add(V(0, -0.3, 0)), n: spin(V(1, 0, 0), UP, k * 1.57), up: UP.clone(), w: 0.7, h: 1.2, cell: 'fir', round: 0.4 });
  const leaves = new Acc(), fleaves = new Acc();
  const crown = { c: V(0, H * 0.45, 0), R: H * 0.55 };
  layCards(leaves, cards, H, r, crown);
  // far: four tiers of crossed cards
  const far: Card[] = [];
  for (let k = 0; k < 4; k++) {
    const y = 1.6 + k * (H - 2.5) / 4, L = ((H - y) / H) * 3.3 + 0.6;
    for (let j = 0; j < 3; j++) {
      const az = j * 2.09 + k;
      far.push({ c: V(0, y + L * 0.2, 0), n: V(Math.cos(az), 0.3, Math.sin(az)).normalize(), up: UP.clone(), w: L * 2.1, h: L * 1.4, cell: 'fir', round: 0.6 });
    }
    far.push({ c: V(0, y + 0.2, 0), n: UP.clone(), up: V(1, 0, 0), w: L * 2, h: L * 2, cell: 'fir', round: 0.5 });
  }
  layCards(fleaves, far, H, r, crown);
  return { bark: bark.geo(), leaves: leaves.geo(), farBark: fbark.geo(), farLeaves: fleaves.geo(), H };
}
/** the willow: a short stout trunk, arching limbs, curtains of strands hanging from them */
function growWillow(seed: number): Grown {
  const r = rng(seed);
  const bark = new Acc(), fbark = new Acc();
  const H = 8;
  const trunk = path(V(0, -0.4, 0), V(rand(r, -0.2, 0.2), 1, rand(r, -0.2, 0.2)), 3.0, 4, 0, 0, 0.15, r);
  tube(bark, trunk, taper(trunk.length, 0.42, 0.3, 0.15), 8, H, (i) => 0.6 + 0.4 * (i / (trunk.length - 1)));
  tube(fbark, [trunk[0], trunk[trunk.length - 1]], [0.45, 0.3], 5, H);
  const cards: Card[] = [];
  const top = trunk[trunk.length - 1];
  const nL = 6;
  for (let i = 0; i < nL; i++) {
    const az = (i / nL) * 6.28 + rand(r, -0.3, 0.3);
    const el = rand(r, 0.35, 0.6);
    const limb = path(top, V(Math.sin(el) * Math.cos(az), Math.cos(el), Math.sin(el) * Math.sin(az)), rand(r, 4.2, 5.4), 6, -0.05, 0.55, 0.15, r);
    tube(bark, limb, taper(limb.length, 0.18, 0.04), 6, H, undefined, 0.3);
    tube(fbark, [limb[0], limb[limb.length - 1]], [0.15, 0.05], 3, H);
    for (let k = 0; k < 13; k++) {
      const t = rand(r, 0.15, 1);
      const p = along(limb, t).add(V(rand(r, -0.5, 0.5), rand(r, 0, 0.3), rand(r, -0.5, 0.5)));
      const hh = rand(r, 2.0, 3.0) * (0.55 + t * 0.6);
      const out = V(p.x, 0, p.z).normalize();
      const n = out.clone().applyAxisAngle(UP, rand(r, -0.9, 0.9));
      // the strands' tops at the bough: the card hangs below it
      cards.push({ c: p.clone().add(V(0, -hh * 0.45, 0)), n, up: UP.clone(), w: rand(r, 0.9, 1.3), h: hh, cell: 'willow', round: 0.45 });
    }
  }
  const leaves = new Acc(), fleaves = new Acc();
  const crown = { c: V(0, 4.8, 0), R: 4 };
  layCards(leaves, cards, H, r, crown);
  layCards(fleaves, farCards(cards, 12, 1.6), H, r, crown);
  return { bark: bark.geo(), leaves: leaves.geo(), farBark: fbark.geo(), farLeaves: fleaves.geo(), H };
}
/** bamboo: a clump of jointed culms leaning out, leaf sprays from the nodes of their upper halves */
function growBamboo(seed: number): Grown {
  const r = rng(seed);
  const bark = new Acc(), fbark = new Acc();
  const H = 9.5;
  const cards: Card[] = [];
  const n = 8 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const a = r() * 6.28, rr = Math.sqrt(r()) * 0.9;
    const base = V(Math.cos(a) * rr, -0.3, Math.sin(a) * rr);
    const h = rand(r, 6.5, 10);
    const lean = rand(r, 0.04, 0.2);
    const out = V(Math.cos(a), 0, Math.sin(a));
    // rings tight round each node, so the joint shows
    const pts: THREE.Vector3[] = [], rad: number[] = [], shade: number[] = [];
    const R0 = rand(r, 0.045, 0.07);
    for (let y = 0; y <= h; y += 0.36) {
      for (const dy of [0, 0.04]) {
        const yy = Math.max(0, y + dy), t = yy / h;
        pts.push(base.clone().add(out.clone().multiplyScalar((lean * t + lean * 1.6 * t * t) * h)).add(V(0, yy, 0)));
        rad.push(R0 * (1 - t * 0.55) * (dy === 0 ? 1.12 : 1));
        shade.push(dy === 0 ? 0.62 : 1);
      }
    }
    tube(bark, pts, rad, 4, H, (k) => shade[k], 0.25);
    if (i % 3 === 0) tube(fbark, [pts[0], pts[pts.length - 1]], [R0, R0 * 0.5], 3, H);
    // leaf sprays from the upper nodes
    for (let y = h * 0.32; y < h; y += rand(r, 0.32, 0.5)) {
      const t = y / h;
      const p = along(pts, t);
      const az = r() * 6.28;
      const d = V(Math.cos(az), -0.15, Math.sin(az)).add(out.clone().multiplyScalar(0.6)).normalize();
      const sz = rand(r, 1.3, 1.9) * (1.1 - t * 0.3);
      cards.push({ c: p.clone().addScaledVector(d, sz * 0.45), n: randPerp(d, r).add(V(0, 0.5, 0)).normalize(), up: d, w: sz, h: sz, cell: 'bamboo', round: 0.55 });
    }
  }
  const leaves = new Acc(), fleaves = new Acc();
  const crown = { c: V(0, 6.5, 0), R: 3.6 };
  layCards(leaves, cards, H, r, crown);
  layCards(fleaves, farCards(cards, 12, 1.9), H, r, crown);
  return { bark: bark.geo(), leaves: leaves.geo(), farBark: fbark.geo(), farLeaves: fleaves.geo(), H };
}
/** a dead snag: a gnarled trunk, bare crooked limbs, some broken short */
function growDead(seed: number): Grown {
  const r = rng(seed);
  const bark = new Acc(), fbark = new Acc();
  const H = 7;
  const trunk = path(V(0, -0.4, 0), V(rand(r, -0.2, 0.2), 1, rand(r, -0.2, 0.2)), rand(r, 4.5, 6.5), 6, 0, 0, 0.3, r);
  tube(bark, trunk, taper(trunk.length, 0.3, 0.08, 0.12), 7, H, (i) => 0.6 + 0.4 * (i / (trunk.length - 1)));
  tube(fbark, [trunk[0], trunk[trunk.length - 1]], [0.32, 0.08], 4, H);
  for (let i = 0; i < 5; i++) {
    const t = rand(r, 0.4, 0.9);
    const p0 = along(trunk, t);
    const az = r() * 6.28, el = rand(r, 0.6, 1.2);
    const L = rand(r, 1.2, 3) * (i === 4 ? 0.4 : 1);
    const limb = path(p0, V(Math.sin(el) * Math.cos(az), Math.cos(el), Math.sin(el) * Math.sin(az)), L, 4, 0.1, 0.05, 0.5, r);
    tube(bark, limb, taper(limb.length, 0.08 * (1.2 - t), 0.015), 5, H);
    if (i < 3) tube(fbark, [limb[0], limb[limb.length - 1]], [0.07, 0.02], 3, H);
    for (let k = 0; k < 2; k++) {
      const q = along(limb, rand(r, 0.4, 0.9)), dq = dirAt(limb, 0.6);
      const tw = path(q, dq.clone().add(randPerp(dq, r)).normalize(), L * 0.45, 3, 0.1, 0, 0.5, r);
      tube(bark, tw, taper(tw.length, 0.025, 0.006), 3, H);
    }
  }
  return { bark: bark.geo(), leaves: null, farBark: fbark.geo(), farLeaves: null, H };
}
interface KindDef {
  grow: (seed: number) => Grown;
  variants: number;
  bark: string;
  /** autumn colour (0 = evergreen), how many leaves fall in winter, flowers in spring, how dark a card's back is */
  autumn: string | null;
  decid: number;
  blossom?: boolean;
  backDark: number;
  culm?: boolean;
}
export const KINDS: Record<Kind, KindDef> = {
  oak: { grow: (s) => growBroad(s, { H: 8.5, fork: 3, trunkR: 0.3, limbs: [4, 5], limbEl: [0.5, 0.95], limbL: [0.38, 0.5], sub: 6, subL: 0.5, card: 1.45, cell: 'broad', per: 4 }), variants: 2, bark: '#77695c', autumn: '#b56f26', decid: 0.92, backDark: 0.8 },
  maple: { grow: (s) => growBroad(s, { H: 7.5, fork: 2.4, trunkR: 0.24, limbs: [4, 6], limbEl: [0.55, 1.05], limbL: [0.38, 0.52], sub: 6, subL: 0.5, card: 1.3, cell: 'maple', per: 4, droop: 0.1 }), variants: 1, bark: '#6e645c', autumn: '#c62d17', decid: 1, backDark: 0.8 },
  ginkgo: { grow: (s) => growBroad(s, { H: 11.5, fork: 2.2, trunkR: 0.28, limbs: [13, 16], limbEl: [0.75, 1.05], limbL: [0.22, 0.3], sub: 3, subL: 0.55, card: 1.3, cell: 'ginkgo', leader: true, per: 3, up: 0.18 }), variants: 1, bark: '#7d7062', autumn: '#e3b021', decid: 1, backDark: 0.82 },
  blossom: { grow: (s) => growBroad(s, { H: 5.5, fork: 1.4, trunkR: 0.17, limbs: [5, 6], limbEl: [0.75, 1.2], limbL: [0.45, 0.62], sub: 5, subL: 0.55, card: 1.3, cell: 'broad', per: 4, wob: 0.55, up: 0.08 }), variants: 1, bark: '#4f4038', autumn: '#c98a2c', decid: 1, blossom: true, backDark: 0.85 },
  pine: { grow: growPine, variants: 2, bark: '#8f6248', autumn: null, decid: 0, backDark: 0.55 },
  fir: { grow: growFir, variants: 2, bark: '#5f5045', autumn: null, decid: 0, backDark: 0.65 },
  willow: { grow: growWillow, variants: 1, bark: '#6d6156', autumn: '#c7b13f', decid: 0.95, backDark: 0.85 },
  bamboo: { grow: growBamboo, variants: 1, bark: '#83a04e', autumn: null, decid: 0, backDark: 0.8, culm: true },
  dead: { grow: growDead, variants: 1, bark: '#7d7268', autumn: null, decid: 0, backDark: 1 },
};
/** which kind a tree of the world's list is (by where it stands: willows by water, bamboo in its groves, firs up
 *  high and in the snow country, the rest by chance) */
export function kindOf(t: Tree): Kind {
  const h = groundHeight(t.x, t.z), k = hash(t.x * 1.3, t.z * 0.7);
  if (t.kind === 2) return 'dead';
  if (t.kind === 0) return inSnowBox(t.x, t.z) || h > SNOW_Y - 35 || k < 0.35 ? 'fir' : 'pine';
  if (h < WATER_Y + 2.2 && k < 0.75) return 'willow';
  if (noise(t.x * 0.012 + 31, t.z * 0.012 - 17) > 0.3) return 'bamboo';
  return k < 0.4 ? 'oak' : k < 0.64 ? 'maple' : k < 0.8 ? 'ginkgo' : 'blossom';
}

// ---------------------------------------------------------------- materials (shared uniforms)
export const FLORA_U = {
  uTime: { value: 0 },
  uWindK: { value: 1 },
  uNearR: { value: 80 },
  uTrans: { value: 0.12 },
  uFarR: { value: 2000 },
};
const DITHER = `float tqDn = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));`;
/** lod: 'near' keeps within uNearR (fading out past it), 'far' beyond it (fading in), 'all' to uFarR (shrubs) */
function patchTree(m: THREE.Material, opt: { lod: 'near' | 'far' | 'all'; leaf: boolean; def?: KindDef; depth?: boolean }) {
  const def = opt.def;
  const auto = new THREE.Color(def?.autumn ?? '#000000');
  const autumnOn = def?.autumn ? 1 : 0;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, FLORA_U, { uSeason: SEASON_U.uSeason });
    sh.uniforms.uAutumn = { value: auto };
    sh.uniforms.uAutumnOn = { value: autumnOn };
    sh.uniforms.uDecid = { value: def?.decid ?? 0 };
    sh.uniforms.uBlossom = { value: def?.blossom ? 1 : 0 };
    sh.uniforms.uBackDark = { value: def?.backDark ?? 1 };
    const lodV =
      opt.depth || opt.lod === 'all'
        ? opt.lod === 'all' && !opt.depth
          ? `if (tqD > uFarR + 10.0) transformed = vec3(0.0);`
          : ''
        : opt.lod === 'near'
          ? `if (tqD > uNearR + 8.0) transformed = vec3(0.0);`
          : `if (tqD < uNearR - 8.0) transformed = vec3(0.0);`;
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float aRnd;
attribute float aWind;
uniform float uTime, uWindK, uNearR, uFarR;
varying float vRnd;
varying float vFade;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vec3 tqIp = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
float tqD = distance(tqIp.xz, cameraPosition.xz);
vFade = ${opt.lod === 'all' ? 'smoothstep(uFarR - 20.0, uFarR + 10.0, tqD)' : 'smoothstep(uNearR - 8.0, uNearR + 8.0, tqD)'};
vRnd = aRnd;
float tqPh = tqIp.x * 0.045 + tqIp.z * 0.06;
float tqSw = (sin(uTime * 0.85 + tqPh) * 0.6 + sin(uTime * 1.9 + tqPh * 1.7) * 0.25) * uWindK;
transformed.x += tqSw * 0.32 * aWind * aWind;
transformed.z += tqSw * 0.12 * aWind * aWind * cos(tqPh);
${opt.leaf ? 'transformed += normal * sin(uTime * 5.3 + aRnd * 40.0 + tqPh) * 0.045 * aWind * uWindK;' : ''}
${lodV}`,
      );
    const lodF =
      opt.depth ? '' : opt.lod === 'near' ? `${DITHER}\nif (tqDn < vFade) discard;` : `${DITHER}\nif (tqDn ${opt.lod === 'all' ? '<' : '>='} ${opt.lod === 'all' ? 'vFade' : 'vFade'}) discard;`;
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <common>',
      `#include <common>
uniform vec4 uSeason;
uniform vec3 uAutumn;
uniform float uAutumnOn, uDecid, uBlossom, uBackDark, uTrans;
varying float vRnd;
varying float vFade;`,
    );
    if (opt.leaf)
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <map_fragment>',
        `${lodF}
vec4 tqTx = texture2D(map, vMapUv);
float tqBl = uBlossom * step(vRnd, uSeason.x * 1.08 - 0.06);
if (uBlossom > 0.5) tqTx = mix(tqTx, texture2D(map, vMapUv + vec2(0.75, 0.0)), tqBl);
// mip levels thin the alpha out: give it back, so far crowns stay full
vec2 tqDx = dFdx(vMapUv * vec2(2048.0, 1024.0)), tqDy = dFdy(vMapUv * vec2(2048.0, 1024.0));
float tqLod = max(0.0, 0.5 * log2(max(dot(tqDx, tqDx), dot(tqDy, tqDy))));
tqTx.a = min(1.0, tqTx.a * (1.0 + tqLod * 0.3));
// bare boughs: the deciduous lose their leaves through late autumn into winter
if (vRnd < (uSeason.w * 0.97 + uSeason.z * 0.2) * uDecid) discard;
vec3 tqC = tqTx.rgb;
float tqL = dot(tqC, vec3(0.3, 0.59, 0.11));
vec3 tqGreen = tqC * vec3(1.04, 1.16, 0.78) * uSeason.x + tqC * vec3(0.92, 1.0, 0.9) * (uSeason.y + uSeason.z + uSeason.w);
float tqTurn = clamp(uSeason.z * 1.35 + uSeason.w - vRnd * 0.45, 0.0, 1.0) * uAutumnOn;
vec3 tqCol = mix(tqGreen, uAutumn * (0.25 + tqL * 2.4) * (0.85 + vRnd * 0.3), tqTurn);
tqCol *= 1.0 - uSeason.w * 0.15 * (1.0 - uAutumnOn);
tqCol = mix(tqCol, tqTx.rgb, tqBl);
if (!gl_FrontFacing) tqCol *= uBackDark;
diffuseColor *= vec4(tqCol, tqTx.a);`,
      );
    else if (!opt.depth) sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `${lodF}\n#include <map_fragment>`);
    if (opt.leaf && !opt.depth) {
      // the crown's normal whichever side you see a card from (no black backs), a little light through the leaves
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <normal_fragment_begin>', 'float faceDirection = 1.0;\nvec3 normal = normalize(vNormal);\nvec3 nonPerturbedNormal = normal;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uTrans;');
    }
  };
  const key = `tqFlora|${opt.lod}|${opt.leaf}|${!!opt.depth}`;
  m.customProgramCacheKey = () => key;
  return m;
}
export function leafMat(def: KindDef, lod: 'near' | 'far' | 'all') {
  const m = new THREE.MeshStandardMaterial({ map: leafAtlas(), alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.85 });
  patchTree(m, { lod, leaf: true, def });
  withSnow(m);
  return m;
}
export function leafDepth(def: KindDef) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: leafAtlas(), alphaTest: 0.5, side: THREE.DoubleSide });
  patchTree(m, { lod: 'near', leaf: true, def, depth: true });
  return m;
}
let BARK: THREE.Texture | null = null, CULM: THREE.Texture | null = null;
export function barkMat(def: KindDef, lod: 'near' | 'far') {
  BARK ??= barkTex();
  CULM ??= culmTex();
  const m = new THREE.MeshStandardMaterial({ map: def.culm ? CULM : BARK, color: def.bark, vertexColors: true, roughness: def.culm ? 0.55 : 0.95 });
  patchTree(m, { lod, leaf: false, def });
  withSnow(m);
  return m;
}

// ---------------------------------------------------------------- the trees
interface Group {
  def: KindDef;
  list: Tree[];
  near: THREE.InstancedMesh[];
  nearAttr: THREE.InstancedBufferAttribute;
  nearCol: THREE.InstancedBufferAttribute;
  cap: number;
}
const NEAR_CAP = 420;
function matrixOf(t: Tree, H: number, kind: Kind, m: THREE.Matrix4) {
  const base = { oak: 8.5, maple: 7.5, ginkgo: 11.5, blossom: 5.5, pine: 9.5, fir: 11, willow: 8, bamboo: 9.5, dead: 7 }[kind];
  // the world's trees are 0.8 .. 1.7 (the old ones ~9.5 m at 1): keep about the same height
  const s = (t.s * 9.5 * (kind === 'blossom' ? 0.65 : kind === 'bamboo' ? 0.95 : 1)) / base / (H / base);
  const q = new THREE.Quaternion().setFromAxisAngle(UP, (t.x * 13.1 + t.z * 7.7) % 6.28);
  const k = 0.9 + hash(t.x, t.z) * 0.25;
  return m.compose(V(t.x, groundHeight(t.x, t.z) - 0.15, t.z), q, V(s, s * k, s));
}
const tintOf = (t: Tree, c: THREE.Color) => c.setHSL(0.08 + hash(t.z, t.x) * 0.1, 0.12 + hash(t.x + 3, t.z) * 0.12, 0.88 + hash(t.x + 1, t.z) * 0.12);
/** trees planted in the village (game/dress.ts): yard fruit trees as peach, the grounds' trees as 槐 and ginkgo,
 *  the bamboo clumps, and the old locust in the square; drawn with the rest (they block by their dress solids) */
type Planted = Tree & { pk: Kind };
const PLANTED: Planted[] = (() => {
  const out: Planted[] = [];
  const at = (x: number, z: number, height: number, k: Kind) => out.push({ x, z, s: height / (9.5 * (k === 'blossom' ? 0.65 : k === 'bamboo' ? 0.95 : 1)), kind: 1, pk: k });
  for (const d of DRESS) {
    if (d.k === 'bamboo') at(d.x, d.z, d.s * 1.15, 'bamboo');
    else if (d.k === 'tree') at(d.x, d.z, d.s * 1.1, d.s < 6.5 ? 'blossom' : hash(d.x, d.z) < 0.55 ? 'oak' : 'ginkgo');
  }
  at(8, -9, 12.5, 'oak');
  return out;
})();
export function Trees() {
  const S = useMemo(() => {
    const root = new THREE.Group();
    const groups: Group[] = [];
    const byKind = new Map<Kind, Tree[][]>();
    for (const t of [...TREES, ...PLANTED]) {
      const k = (t as Planted).pk ?? kindOf(t), def = KINDS[k];
      const v = Math.floor(hash(t.x * 2.1, t.z * 1.7) * def.variants);
      if (!byKind.has(k)) byKind.set(k, Array.from({ length: def.variants }, () => []));
      byKind.get(k)![v].push(t);
    }
    const m = new THREE.Matrix4(), c = new THREE.Color();
    for (const [kind, lists] of byKind)
      lists.forEach((list, vi) => {
        if (!list.length) return;
        const def = KINDS[kind];
        const g = def.grow(0.137 + vi * 0.311 + kind.length * 0.0731);
        // far: every tree of the kind, always (the shader drops the near ones)
        const farAttr = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 16), 16);
        const farCol = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3);
        list.forEach((t, i) => {
          matrixOf(t, g.H, kind, m).toArray(farAttr.array as Float32Array, i * 16);
          tintOf(t, c).toArray(farCol.array as Float32Array, i * 3);
        });
        const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, attr: THREE.InstancedBufferAttribute, col: THREE.InstancedBufferAttribute, n: number, shadow: boolean) => {
          const im = new THREE.InstancedMesh(geo, mat, n);
          im.instanceMatrix = attr;
          im.instanceColor = col;
          im.count = n;
          im.frustumCulled = false;
          im.castShadow = shadow;
          im.receiveShadow = true;
          root.add(im);
          return im;
        };
        mk(g.farBark, barkMat(def, 'far'), farAttr, farCol, list.length, false);
        if (g.farLeaves) mk(g.farLeaves, leafMat(def, 'far'), farAttr, farCol, list.length, false);
        // near: the ones round the camera, re-picked as it moves
        const cap = Math.min(NEAR_CAP, list.length);
        const nearAttr = new THREE.InstancedBufferAttribute(new Float32Array(cap * 16), 16);
        const nearCol = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
        nearAttr.setUsage(THREE.DynamicDrawUsage);
        const near = [mk(g.bark, barkMat(def, 'near'), nearAttr, nearCol, 0, true)];
        if (g.leaves) {
          const lm = mk(g.leaves, leafMat(def, 'near'), nearAttr, nearCol, 0, true);
          lm.customDepthMaterial = leafDepth(def);
          near.push(lm);
        }
        groups.push({ def, list, near, nearAttr, nearCol, cap, kind, H: g.H } as Group & { kind: Kind; H: number });
      });
    return { root, groups, cx: 1e9, cz: 1e9 };
  }, []);
  useFrame((state) => {
    const cam = state.camera.position;
    FLORA_U.uTime.value = state.clock.elapsedTime;
    if (Math.hypot(cam.x - S.cx, cam.z - S.cz) < 10) return;
    S.cx = cam.x;
    S.cz = cam.z;
    const R = FLORA_U.uNearR.value + 8 + 14;
    const m = new THREE.Matrix4(), c = new THREE.Color();
    for (const g of S.groups as (Group & { kind: Kind; H: number })[]) {
      let n = 0;
      for (const t of g.list) {
        if (Math.abs(t.x - cam.x) > R || Math.abs(t.z - cam.z) > R || Math.hypot(t.x - cam.x, t.z - cam.z) > R) continue;
        if (n >= g.cap) break;
        matrixOf(t, g.H, g.kind, m).toArray(g.nearAttr.array as Float32Array, n * 16);
        tintOf(t, c).toArray(g.nearCol.array as Float32Array, n * 3);
        n++;
      }
      g.nearAttr.needsUpdate = true;
      g.nearCol.needsUpdate = true;
      for (const im of g.near) im.count = n;
    }
  });
  return <primitive object={S.root} />;
}

// ---------------------------------------------------------------- grass: tufts of blades round you
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** a tuft: blades curving over from a little patch, tapering to a point; uv.y runs up each blade */
export function tuftGeo(blades: number, segs: number, seed: number) {
  const r = rng(seed);
  const pos: number[] = [], uv: number[] = [], nor: number[] = [], idx: number[] = [];
  for (let b = 0; b < blades; b++) {
    const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 0.13;
    const bx = Math.cos(a) * rr, bz = Math.sin(a) * rr;
    const lean = r() * Math.PI * 2, bend = 0.08 + r() * 0.22, h = 0.32 + r() * 0.42, w = 0.028 + r() * 0.018;
    const dx = Math.cos(lean), dz = Math.sin(lean);
    const sx = -dz, sz = dx; // across the blade
    const base = pos.length / 3;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const cx = bx + dx * bend * t * t, cz = bz + dz * bend * t * t, cy = h * (t - bend * 0.35 * t * t);
      const ww = w * Math.pow(1 - t, 0.75) * 0.5 + 0.0015;
      pos.push(cx - sx * ww, cy, cz - sz * ww, cx + sx * ww, cy, cz + sz * ww);
      uv.push(0, t, 1, t);
      // lit mostly like the ground under it, a little by the blade's own facing
      const nx = dx * 0.3, nz = dz * 0.3;
      nor.push(nx, 1, nz, nx, 1, nz);
    }
    for (let i = 0; i < segs; i++) {
      const k = base + i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}
export const GRASS_U = { uPlayer: { value: new THREE.Vector3() }, uWindDir: { value: new THREE.Vector2(1, 0) }, uR0: { value: 0 }, uR1: { value: 18 } };
/** the grass blades' material: the climate tints it with the season (Climate also darkens it in the wet) */
export const GRASS: { mat: THREE.MeshStandardMaterial | null } = { mat: null };
export function grassMat(r0: number, r1: number, fadeIn: number) {
  const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 1, vertexColors: false });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, FLORA_U, GRASS_U, { uSeason: SEASON_U.uSeason, uSnowCover: SEASON_U.uSnowCover });
    sh.uniforms.uR0 = { value: r0 };
    sh.uniforms.uR1 = { value: r1 };
    sh.uniforms.uFadeIn = { value: fadeIn };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime, uWindK, uSnowCover, uR0, uR1, uFadeIn;\nuniform vec3 uPlayer;\nuniform vec2 uWindDir;\nvarying float vH;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vH = uv.y;
vec3 tqIp = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
float tqD = distance(tqIp.xz, uPlayer.xz);
// shorter toward the patch's edges (and grown in from the near patch's edge), half buried in snow
float tqK = smoothstep(uR1, uR1 - 4.0, tqD) * (uFadeIn > 0.0 ? smoothstep(uR0, uR0 + uFadeIn, tqD) : 1.0);
transformed.y *= tqK * (1.0 - uSnowCover * 0.55);
transformed.xz *= mix(0.4, 1.0, tqK);`,
      )
      .replace(
        '#include <project_vertex>',
        `vec4 tqW = instanceMatrix * vec4(transformed, 1.0);
float tqH2 = vH * vH;
// gusts running across the field, and a quicker flutter
float tqG = sin(uTime * 1.6 + dot(tqW.xz, uWindDir) * 0.28) * 0.5 + 0.5;
float tqF = sin(uTime * 3.4 + tqW.x * 0.9 + tqW.z * 0.7) * 0.5;
vec2 tqOff = uWindDir * (0.05 + 0.16 * uWindK * tqG) * tqH2 + vec2(tqF, -tqF) * 0.03 * tqH2;
// parting round your feet
vec2 tqP = tqW.xz - uPlayer.xz;
float tqPd = length(tqP);
if (tqPd < 1.0 && abs(tqW.y - uPlayer.y) < 1.5) {
  float tqPk = (1.0 - tqPd) * tqH2;
  tqOff += normalize(tqP + 1e-4) * tqPk * 0.38;
  tqW.y -= tqPk * 0.18;
}
tqW.xz += tqOff;
vec4 mvPosition = viewMatrix * modelMatrix * tqW;
gl_Position = projectionMatrix * mvPosition;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec4 uSeason;\nuniform float uSnowCover;\nvarying float vH;')
      .replace('#include <normal_fragment_begin>', 'float faceDirection = 1.0;\nvec3 normal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);\nvec3 nonPerturbedNormal = normal;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
// dark at the root, light toward the tip; the tuft's own shade (instance colour) through the seasons
vec3 tqBase = diffuseColor.rgb * mix(0.35, 1.0, pow(vH, 0.8));
float tqL = dot(tqBase, vec3(0.3, 0.5, 0.2));
vec3 tqC = tqBase * (uSeason.x * vec3(1.0, 1.1, 0.82) + uSeason.y * vec3(0.92, 1.0, 0.85));
tqC += uSeason.z * mix(tqBase, vec3(0.8, 0.62, 0.25) * tqL * 2.5, 0.7 * smoothstep(0.2, 0.8, vH + 0.3));
tqC += uSeason.w * mix(tqBase, vec3(0.52, 0.46, 0.33) * tqL * 2.3, 0.8);
diffuseColor.rgb = mix(tqC, vec3(0.9, 0.93, 0.97), uSnowCover * 0.75 * smoothstep(0.3, 0.9, vH));`,
      );
  };
  mat.customProgramCacheKey = () => 'tqGrassBlades';
  return mat;
}
/** may grass grow here, and how dry is it (null: no) */
function grassAt(x: number, z: number): number | null {
  if (Math.hypot(x, z) < VILLAGE_R + 6) return null;
  const h = groundHeight(x, z);
  if (h < WATER_Y + 0.4 || h > SNOW_Y - 20) return null;
  const pd = pathDist(x, z);
  if (pd < 3.2) return null;
  if (slopeAt(x, z) > 0.55) return null;
  for (const d of DENS) if (Math.abs(d.x - x) < DEN_R + 3 && Math.abs(d.z - z) < DEN_R + 3 && Math.hypot(d.x - x, d.z - z) < DEN_R + 3) return null;
  if (nearTq(x, z, 46) || onGudao(x, z, pd) || nearCourt(x, z, 92) || nearPlace(x, z, -3)) return null;
  if (inSnowBox(x, z) && (snowTrailDist(x, z) < 4 || onSnowPad(x, z, 1))) return null;
  return Math.max(0, Math.min(1, noise(x * 0.03, z * 0.03) * 0.9 + 0.35));
}
const TILE = 12;
type TileData = { near: Float32Array; far: Float32Array; flowers: Float32Array };
/** each 12 m tile's tufts, worked out once: x, y, z, turn, size, r, g, b (near: dense; far: sparse) and its flowers */
function makeTile(ix: number, iz: number): TileData {
  const near: number[] = [], far: number[] = [], fl: number[] = [];
  const c = new THREE.Color();
  // a coarse check first: a tile with no grass anywhere is skipped quickly
  const x0 = ix * TILE, z0 = iz * TILE;
  let any = false;
  for (let a = 0; a <= 2 && !any; a++) for (let b = 0; b <= 2 && !any; b++) if (grassAt(x0 + a * 6, z0 + b * 6) !== null) any = true;
  if (!any) return { near: new Float32Array(0), far: new Float32Array(0), flowers: new Float32Array(0) };
  const lay = (S: number, out: number[], thin: number) => {
    const n = Math.round(TILE / S);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const x = x0 + (i + hash(i + ix * 97, j + iz * 61)) * S, z = z0 + (j + hash(j + iz * 89, i + ix * 53)) * S;
        if (hash(x * 1.7, z * 2.3) > thin) continue;
        const dry = grassAt(x, z);
        if (dry === null) continue;
        const y = groundHeight(x, z) - 0.04;
        const s = 0.55 + hash(z, x) * 0.55;
        c.setHSL(0.26 - dry * 0.08 + hash(x, z * 2) * 0.03, 0.42 - dry * 0.14, 0.17 + dry * 0.08 + hash(x * 2, z) * 0.06);
        out.push(x, y, z, hash(x, z) * 6.28, s, c.r, c.g, c.b);
      }
  };
  lay(0.42, near, 0.92);
  lay(0.8, far, 0.95);
  // wildflowers: in meadow patches, a few kinds
  const fn = Math.round(TILE / 1.1);
  for (let i = 0; i < fn; i++)
    for (let j = 0; j < fn; j++) {
      const x = x0 + (i + hash(i * 3 + ix, j * 5 + iz)) * 1.1, z = z0 + (j + hash(j * 7 + iz, i * 2 + ix)) * 1.1;
      const meadow = noise(x * 0.05 + 50, z * 0.05 - 20);
      if (meadow < 0.05 || hash(x * 3.3, z * 1.9) > (meadow - 0.05) * 1.6) continue;
      if (grassAt(x, z) === null) continue;
      fl.push(x, groundHeight(x, z) - 0.02, z, hash(x, z) * 6.28, 0.8 + hash(z * 2, x) * 0.5, Math.floor(hash(Math.floor(x / 5), Math.floor(z / 5)) * 4 + hash(x, z) * 1.4) % 4, 0, 0);
    }
  return { near: new Float32Array(near), far: new Float32Array(far), flowers: new Float32Array(fl) };
}
const NEAR_R = 17, FAR_R = 46;
export const __floraTest = { makeTile: (ix: number, iz: number) => makeTile(ix, iz) };
export function Grass({ sim }: { sim: Sim }) {
  const S = useMemo(() => {
    const root = new THREE.Group();
    const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, cap: number, tint = true) => {
      const im = new THREE.InstancedMesh(geo, mat, cap);
      im.count = 0;
      im.frustumCulled = false;
      im.receiveShadow = true;
      if (tint) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      root.add(im);
      return im;
    };
    const nearMat = grassMat(0, NEAR_R, 0);
    GRASS.mat = nearMat;
    const near = mk(tuftGeo(6, 4, 0.31), nearMat, 9000);
    const far = mk(tuftGeo(3, 2, 0.57), grassMat(NEAR_R - 5, FAR_R, 4), 16000);
    const fmat = flowerMat();
    const flowers = mk(flowerGeo(), fmat, 3000, false);
    flowers.castShadow = false;
    // each flower's kind, by instance
    const kindAttr = new THREE.InstancedBufferAttribute(new Float32Array(3000), 1);
    kindAttr.setUsage(THREE.DynamicDrawUsage);
    flowers.geometry.setAttribute('aKind', kindAttr);
    return { root, near, far, flowers, kindAttr, tiles: new Map<number, TileData>(), cx: 1e9, cz: 1e9 };
  }, []);
  useFrame(() => {
    const p = sim.player.pos;
    GRASS_U.uPlayer.value.set(p[0], p[1], p[2]);
    const w = sim.weather;
    GRASS_U.uWindDir.value.set(Math.cos(w.windA), Math.sin(w.windA));
    FLORA_U.uWindK.value = 0.45 + Math.min(1, w.wind) * 1.6 + (w.kind === 'storm' ? 1 : 0);
    FLORA_U.uTrans.value = 0.14 * Math.min(1, Math.max(0, WATER_U.uDay.value));
    // indoors (rooms are off the map) there is no grass
    if (sim.indoor >= 0) {
      S.near.count = S.far.count = S.flowers.count = 0;
      S.cx = 1e9;
      return;
    }
    if (Math.hypot(p[0] - S.cx, p[2] - S.cz) < 2.5) return;
    S.cx = p[0];
    S.cz = p[2];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
    const out = (im: THREE.InstancedMesh, list: Float32Array[], r0: number, r1: number, cap: number, kind?: Float32Array) => {
      let n = 0;
      for (const a of list)
        for (let i = 0; i < a.length && n < cap; i += 8) {
          const dx = a[i] - p[0], dz = a[i + 2] - p[2], d = Math.hypot(dx, dz);
          if (d < r0 || d > r1) continue;
          q.setFromAxisAngle(UP, a[i + 3]);
          sc.setScalar(a[i + 4]);
          m.compose(v.set(a[i], a[i + 1], a[i + 2]), q, sc);
          im.setMatrixAt(n, m);
          if (kind) kind[n] = a[i + 5];
          else im.setColorAt(n, c.setRGB(a[i + 5], a[i + 6], a[i + 7]));
          n++;
        }
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    };
    const tilesIn = (R: number) => {
      const res: TileData[] = [];
      for (let ix = Math.floor((p[0] - R) / TILE); ix <= Math.floor((p[0] + R) / TILE); ix++)
        for (let iz = Math.floor((p[2] - R) / TILE); iz <= Math.floor((p[2] + R) / TILE); iz++) {
          if (Math.abs(ix * TILE) > WORLD_R + 50 || Math.abs(iz * TILE) > WORLD_R + 50) continue;
          const key = (ix + 1000) * 4000 + (iz + 1000);
          let t = S.tiles.get(key);
          if (!t) {
            t = makeTile(ix, iz);
            S.tiles.set(key, t);
          }
          res.push(t);
        }
      if (S.tiles.size > 6000) S.tiles.clear();
      return res;
    };
    const tl = tilesIn(FAR_R);
    out(S.near, tl.map((t) => t.near), 0, NEAR_R, 9000);
    out(S.far, tl.map((t) => t.far), NEAR_R - 5, FAR_R, 16000);
    out(S.flowers, tl.map((t) => t.flowers), 0, 30, 3000, S.kindAttr.array as Float32Array);
    S.kindAttr.needsUpdate = true;
  });
  return <primitive object={S.root} />;
}

// ---------------------------------------------------------------- wildflowers
/** a flower texture: five white petals round a gold heart (the shader colours the petals by kind and season) */
function petalTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const gr = g.createRadialGradient(32, 32, 4, 32 + Math.cos(a) * 14, 32 + Math.sin(a) * 14, 18);
    gr.addColorStop(0, '#f4f0ea');
    gr.addColorStop(1, '#ffffff');
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(32 + Math.cos(a) * 15, 32 + Math.sin(a) * 15, 14, 9, a, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#e8b020';
  g.beginPath();
  g.arc(32, 32, 6, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** a stem with two leaves and a head turned up to the sky */
export function flowerGeo() {
  const pos: number[] = [], uv: number[] = [], nor: number[] = [], idx: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], uvs: number[][], n: number[]) => {
    const k = pos.length / 3;
    for (const p of [a, b, c, d]) pos.push(...p);
    for (const u of uvs) uv.push(...u);
    for (let i = 0; i < 4; i++) nor.push(...n);
    idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
  };
  const H = 0.36;
  // stem (a thin cross), uv.x < 0 marks green parts for the shader
  quad([-0.006, 0, 0], [0.006, 0, 0], [0.006, H, 0], [-0.006, H, 0], [[-1, 0], [-1, 0], [-1, 1], [-1, 1]], [0, 1, 0]);
  quad([0, 0, -0.006], [0, 0, 0.006], [0, H, 0.006], [0, H, -0.006], [[-1, 0], [-1, 0], [-1, 1], [-1, 1]], [0, 1, 0]);
  // two leaves
  quad([0, 0.06, 0], [0.09, 0.12, 0.02], [0.12, 0.16, 0.0], [0.02, 0.1, -0.01], [[-1, 0], [-1, 0.5], [-1, 1], [-1, 0.5]], [0, 1, 0]);
  quad([0, 0.1, 0], [-0.08, 0.17, -0.02], [-0.11, 0.21, 0.0], [-0.02, 0.14, 0.01], [[-1, 0], [-1, 0.5], [-1, 1], [-1, 0.5]], [0, 1, 0]);
  // the head: a disc tipped toward the light, and a smaller one under it (buds)
  const s = 0.065;
  quad([-s, H, -s * 0.8], [s, H + 0.02, -s * 0.8], [s, H + 0.03, s * 0.8], [-s, H + 0.01, s * 0.8], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 1, 0]);
  const s2 = 0.04;
  quad([0.03 - s2, H - 0.07, 0.03 - s2], [0.03 + s2, H - 0.06, 0.03 - s2], [0.03 + s2, H - 0.05, 0.03 + s2], [0.03 - s2, H - 0.06, 0.03 + s2], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 1, 0]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}
export function flowerMat() {
  const m = new THREE.MeshStandardMaterial({ map: petalTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, FLORA_U, GRASS_U, { uSeason: SEASON_U.uSeason, uSnowCover: SEASON_U.uSnowCover });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aKind;\nuniform float uTime, uWindK, uSnowCover;\nuniform vec3 uPlayer;\nuniform vec4 uSeason;\nvarying float vKind;\nvarying vec2 vUv0;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vKind = aKind;
vUv0 = uv;
vec3 tqIp = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
float tqD = distance(tqIp.xz, uPlayer.xz);
// gone in winter and under snow; fewer as summer wanes; smaller toward the patch's edge
float tqOn = (1.0 - uSeason.w) * (1.0 - uSnowCover) * smoothstep(30.0, 24.0, tqD);
transformed *= tqOn;
transformed.x += sin(uTime * 2.1 + tqIp.x * 0.7 + tqIp.z) * 0.03 * position.y * 3.0 * uWindK;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <normal_fragment_begin>', 'float faceDirection = 1.0;\nvec3 normal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);\nvec3 nonPerturbedNormal = normal;')
      .replace('#include <common>', '#include <common>\nuniform vec4 uSeason;\nvarying float vKind;\nvarying vec2 vUv0;')
      .replace(
        '#include <map_fragment>',
        `vec4 tqTx = vUv0.x < 0.0 ? vec4(1.0) : texture2D(map, vMapUv);
vec3 tqCol;
if (vUv0.x < 0.0) tqCol = vec3(0.2, 0.36, 0.12) * (0.7 + vUv0.y * 0.5);
else {
  // the petals' colour by kind and season: spring pink, white, gold, lilac; summer violet, white, orange, blue;
  // autumn the wild chrysanthemum's yellow, white, gold, aster purple
  int k = int(vKind + 0.5);
  vec3 sp = k == 0 ? vec3(0.95, 0.55, 0.68) : k == 1 ? vec3(0.97, 0.96, 0.92) : k == 2 ? vec3(0.98, 0.82, 0.2) : vec3(0.78, 0.66, 0.92);
  vec3 su = k == 0 ? vec3(0.55, 0.36, 0.86) : k == 1 ? vec3(0.97, 0.96, 0.92) : k == 2 ? vec3(0.98, 0.5, 0.15) : vec3(0.38, 0.5, 0.95);
  vec3 au = k == 0 ? vec3(0.98, 0.8, 0.18) : k == 1 ? vec3(0.95, 0.94, 0.9) : k == 2 ? vec3(0.95, 0.68, 0.12) : vec3(0.62, 0.45, 0.85);
  vec3 pc = sp * uSeason.x + su * uSeason.y + au * (uSeason.z + uSeason.w);
  float heart = step(tqTx.b, 0.45);
  tqCol = mix(pc * tqTx.r, tqTx.rgb, heart);
}
diffuseColor *= vec4(tqCol, tqTx.a);`,
      );
  };
  m.customProgramCacheKey = () => 'tqFlowers';
  return m;
}

// ---------------------------------------------------------------- shrubs under the trees and along the field edges
export function shrubGeo(seed: number, cell: CellName) {
  const r = rng(seed);
  const cards: Card[] = [];
  for (let k = 0; k < 11; k++) {
    const a = r() * 6.28, el = rand(r, 0.1, 1.2);
    const out = V(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
    const c = V(0, 0.55, 0).addScaledVector(out, rand(r, 0.25, 0.6)).multiply(V(1.2, 0.8, 1.2));
    const sz = rand(r, 0.8, 1.2);
    cards.push({ c, n: out.clone().add(V(rand(r, -0.5, 0.5), 0.3, rand(r, -0.5, 0.5))).normalize(), up: out.clone().add(V(0, 0.6, 0)).normalize(), w: sz, h: sz, cell, round: 0.8 });
  }
  const A = new Acc();
  layCards(A, cards, 1.4, r, { c: V(0, 0.45, 0), R: 0.95 });
  return A.geo();
}
export function Shrubs() {
  const S = useMemo(() => {
    const root = new THREE.Group();
    const spots: [number, number, number][] = [];
    // under about half the trees, and scattered in the open fields
    for (const t of TREES) {
      if (t.kind === 2 || hash(t.x * 3.1, t.z * 1.3) > 0.55) continue;
      const a = hash(t.z, t.x) * 6.28, d = 2.4 + hash(t.x, t.z * 3) * 2.5;
      const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
      if (grassAt(x, z) === null) continue;
      spots.push([x, z, hash(x, z)]);
    }
    for (let k = 0; k < 9000 && spots.length < 9000; k++) {
      const x = (hash(k, 0.37) * 2 - 1) * (WORLD_R - 40), z = (hash(k * 1.7, 5.1) * 2 - 1) * (WORLD_R - 40);
      if (noise(x * 0.01 - 7, z * 0.01 + 3) < 0.1 || grassAt(x, z) === null) continue;
      spots.push([x, z, hash(x, z)]);
    }
    const kinds: { cell: CellName; def: KindDef }[] = [
      { cell: 'broad', def: { ...KINDS.oak, decid: 0.5, autumn: '#a5672a', backDark: 0.75 } },
      { cell: 'maple', def: { ...KINDS.maple, decid: 0.6, backDark: 0.75 } },
      { cell: 'bamboo', def: { ...KINDS.bamboo, backDark: 0.75 } },
    ];
    const sets = kinds.map((k, ki) => {
      const list = spots.filter((s) => Math.floor(s[2] * 3) === ki).map(([x, z, h]) => [x, z, h, groundHeight(x, z)]);
      const cap = Math.min(list.length, 2500);
      const im = new THREE.InstancedMesh(shrubGeo(0.21 + ki * 0.17, k.cell), leafMat(k.def, 'all'), Math.max(1, cap));
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, cap) * 3), 3);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.count = 0;
      im.frustumCulled = false;
      im.receiveShadow = true;
      root.add(im);
      return { im, list, cap };
    });
    return { root, sets, cx: 1e9, cz: 1e9 };
  }, []);
  useMemo(() => (FLORA_U.uFarR.value = 150), []);
  useFrame((state) => {
    const cam = state.camera.position;
    if (Math.hypot(cam.x - S.cx, cam.z - S.cz) < 12) return;
    S.cx = cam.x;
    S.cz = cam.z;
    const R = FLORA_U.uFarR.value + 30;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), v = V(), sc = V();
    for (const st of S.sets) {
      let n = 0;
      for (const [x, z, h, y] of st.list) {
        if (Math.abs(x - cam.x) > R || Math.abs(z - cam.z) > R || n >= st.cap) continue;
        q.setFromAxisAngle(UP, h * 40);
        const s = 0.7 + hash(z, x) * 0.8;
        st.im.setMatrixAt(n, m.compose(v.set(x, y - 0.15, z), q, sc.set(s, s * (0.8 + hash(x * 2, z) * 0.4), s)));
        st.im.setColorAt(n, c.setHSL(0.1 + hash(x, z * 3) * 0.08, 0.15, 0.72 + hash(x * 5, z) * 0.15));
        n++;
      }
      st.im.count = n;
      st.im.instanceMatrix.needsUpdate = true;
      if (st.im.instanceColor) st.im.instanceColor.needsUpdate = true;
    }
  });
  return <primitive object={S.root} />;
}

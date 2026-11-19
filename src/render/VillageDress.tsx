// 青石村's dressing (game/dress.ts): yard walls of plaster under grey tile on a stone foot, vegetable plots, wood piles,
// glazed vats, drying racks hung with corn and chillies, washing on lines, fruit trees, bamboo, the square's stone tables
// and lions, flagpoles, pots of green, benches, baskets, millstones, corn and chillies under the eaves, grass and flowers.
// All of it merged into a few meshes once.
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Sim } from '../game/sim';
import { DRESS, type Dress } from '../game/dress';
import { groundHeight } from '../game/world';
import { Builder, Built, type Mat } from './build';

const rnd = (a: number, b: number) => {
  const s = Math.sin(a * 91.7 + b * 47.3) * 24634.6345;
  return s - Math.floor(s);
};

function wall(b: Builder, d: Dress) {
  const L = d.s + 0.06;
  b.box('stone', 0, -0.1, 0, 0.42, 0.45, L);
  b.box('plaster', 0, 0.35, 0, 0.32, 1.3, L);
  // the coping: grey tile, a ridge along the top, eaves a hand's breadth over each face
  b.box('tile', 0, 1.65, 0, 0.62, 0.08, L);
  b.box('tile', 0, 1.73, 0, 0.36, 0.12, L);
  b.box('dark', 0, 1.85, 0, 0.12, 0.06, L);
}
function plot(b: Builder, d: Dress) {
  const W = d.s, D = d.t ?? 3;
  b.box('soil', 0, -0.08, 0, W, 0.2, D);
  const rows = Math.max(2, Math.floor(W / 0.7));
  for (let r = 0; r < rows; r++) {
    const x = -W / 2 + 0.35 + (r * (W - 0.7)) / Math.max(1, rows - 1);
    const kind = (r + d.seed) % 3;
    for (let z = -D / 2 + 0.35; z < D / 2 - 0.2; z += 0.55) {
      if (rnd(d.seed + r, z) < 0.12) continue;
      if (kind === 0) {
        // cabbages
        const g = new THREE.IcosahedronGeometry(0.2 + rnd(r, z) * 0.06, 0);
        g.scale(1, 0.7, 1);
        b.add('crop', g, x, 0.2, z);
      } else if (kind === 1) {
        // scallions: a few blades
        for (let k = 0; k < 3; k++) b.add('leaf', new THREE.ConeGeometry(0.04, 0.45, 4), x + (k - 1) * 0.07, 0.3, z);
      } else {
        // beans up a cane
        b.add('wood', new THREE.CylinderGeometry(0.015, 0.015, 1.3, 4), x, 0.65, z);
        const g = new THREE.IcosahedronGeometry(0.14, 0);
        g.scale(1, 2.6, 1);
        b.add('crop', g, x, 0.6, z);
      }
    }
  }
  // a low wattle edge on the two long sides
  for (const s of [-1, 1]) b.box('plank', s * (W / 2 + 0.05), -0.05, 0, 0.06, 0.25, D + 0.1);
}
function woodpile(b: Builder, d: Dress) {
  for (let row = 0; row < 4; row++)
    for (let k = 0; k < 6 - row; k++) {
      const g = new THREE.CylinderGeometry(0.11, 0.11, 0.8, 7);
      g.rotateX(Math.PI / 2);
      b.add(rnd(d.seed + k, row) < 0.5 ? 'log' : 'wood', g, -0.55 + k * 0.22 + row * 0.11, 0.11 + row * 0.2, 0);
    }
  b.box('thatch', 0, 0.95, 0, 1.6, 0.06, 1.1);
}
function vat(b: Builder) {
  const pts = [0, 0.32, 0.42, 0.46, 0.44, 0.36, 0.34].map((r, i) => new THREE.Vector2(r, i * 0.15));
  b.add('dark', new THREE.LatheGeometry(pts, 14), 0, 0, 0);
  b.add('plank', new THREE.CylinderGeometry(0.38, 0.38, 0.05, 14), 0, 0.93, 0);
  b.add('wood', new THREE.CylinderGeometry(0.05, 0.05, 0.6, 5).rotateZ(Math.PI / 2), 0, 0.98, 0);
}
function rack(b: Builder, d: Dress) {
  for (const s of [-1, 1]) b.add('log', new THREE.CylinderGeometry(0.06, 0.07, 2.4, 6), s * 1.2, 1.2, 0);
  b.add('log', new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6).rotateZ(Math.PI / 2), 0, 2.25, 0);
  for (let k = 0; k < 7; k++) {
    const x = -1.0 + k * 0.33, kind = (k + d.seed) % 3;
    const L = 0.6 + rnd(k, d.seed) * 0.5;
    if (kind === 0) for (let j = 0; j < 4; j++) b.add('hay', new THREE.CylinderGeometry(0.06, 0.045, 0.24, 6), x + (j % 2) * 0.07, 2.1 - j * 0.16, (j % 2) * 0.05);
    else if (kind === 1) for (let j = 0; j < 7; j++) b.add('red', new THREE.ConeGeometry(0.03, 0.12, 4).rotateX(Math.PI), x + Math.sin(j) * 0.04, 2.15 - (j * L) / 7, Math.cos(j) * 0.04);
    else for (let j = 0; j < 4; j++) b.add('white', new THREE.IcosahedronGeometry(0.05, 0), x, 2.12 - j * 0.12, 0);
  }
}
function washing(b: Builder, d: Dress) {
  const L = d.s;
  for (const s of [-1, 1]) b.add('wood', new THREE.CylinderGeometry(0.04, 0.05, 2.1, 5), 0, 1.05, (s * L) / 2);
  b.add('dark', new THREE.CylinderGeometry(0.008, 0.008, L, 3).rotateX(Math.PI / 2), 0, 1.95, 0);
  const cloths: Mat[] = ['silk2', 'white', 'canvas', 'silk', 'white', 'cloth'];
  const n = Math.max(2, Math.floor(L / 0.9));
  for (let k = 0; k < n; k++) {
    const z = -L / 2 + 0.5 + (k * (L - 1)) / Math.max(1, n - 1);
    const h = 0.6 + rnd(k, d.seed) * 0.5, w = 0.5 + rnd(d.seed, k) * 0.3;
    const g = new THREE.PlaneGeometry(w, h, 2, 2);
    // a little sag and sway
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + Math.sin(p.getY(i) * 3 + k) * 0.03);
    g.rotateY(Math.PI / 2);
    b.add(cloths[(k + d.seed) % cloths.length], g, 0, 1.95 - h / 2, z);
  }
}
function tree(b: Builder, d: Dress) {
  const H = d.s, trunk = H * 0.45;
  b.add('log', new THREE.CylinderGeometry(0.16 + H * 0.01, 0.3 + H * 0.02, trunk, 8), 0, trunk / 2, 0);
  // two boughs
  for (let k = 0; k < 2; k++) {
    const g = new THREE.CylinderGeometry(0.07, 0.12, H * 0.3, 6);
    g.translate(0, H * 0.15, 0);
    g.rotateZ((k ? -1 : 1) * 0.7);
    b.add('log', g, 0, trunk * 0.8, 0, d.rot + k);
  }
  const n = 4 + (d.seed % 3);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * 6.28 + d.rot, r = k === 0 ? 0 : H * 0.18;
    const g = new THREE.IcosahedronGeometry(H * (0.2 + rnd(k, d.seed) * 0.08), 1);
    g.scale(1, 0.72, 1);
    b.add('leaf', g, Math.cos(a) * r, trunk + H * (0.18 + rnd(d.seed, k) * 0.2), Math.sin(a) * r);
  }
  // a few fruit on the yard trees
  if (H < 6.5)
    for (let k = 0; k < 9; k++) {
      const a = rnd(k, d.seed + 1) * 6.28, r = H * (0.15 + rnd(d.seed, k + 2) * 0.12);
      b.add('red', new THREE.IcosahedronGeometry(0.07, 0), Math.cos(a) * r, trunk + H * 0.12 + rnd(k, 3) * H * 0.2, Math.sin(a) * r);
    }
}
function bamboo(b: Builder, d: Dress) {
  const n = 9 + (d.seed % 6);
  for (let k = 0; k < n; k++) {
    const a = rnd(k, d.seed) * 6.28, r = Math.sqrt(rnd(d.seed, k)) * 0.8;
    const H = d.s * (0.75 + rnd(k, d.seed + 3) * 0.35);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const lean = (rnd(k, 9) - 0.5) * 0.12;
    const g = new THREE.CylinderGeometry(0.035, 0.05, H, 5);
    g.translate(0, H / 2, 0);
    g.rotateZ(lean);
    b.add('crop', g, x, 0, z);
    // nodes and leaf sprays near the top
    for (let j = 0; j < 4; j++) {
      const y = H * (0.55 + j * 0.13);
      const lg = new THREE.ConeGeometry(0.32, 0.9, 4);
      lg.rotateZ(Math.PI / 2 + (j % 2 ? 0.5 : -0.5));
      b.add('leaf', lg, x - Math.sin(lean) * y + (j % 2 ? 0.3 : -0.3), y, z, a + j);
    }
  }
}
function table(b: Builder) {
  b.add('stone', new THREE.CylinderGeometry(0.62, 0.62, 0.1, 14), 0, 0.78, 0);
  b.add('stone', new THREE.CylinderGeometry(0.18, 0.3, 0.75, 10), 0, 0.37, 0);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * 6.28 + 0.4;
    const pts = [0.16, 0.2, 0.21, 0.2, 0.16].map((r, i) => new THREE.Vector2(r, i * 0.11));
    b.add('stone', new THREE.LatheGeometry(pts, 10), Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95);
  }
}
function lion(b: Builder) {
  b.box('stone', 0, 0, 0, 1.0, 0.55, 1.5);
  b.box('rock', 0, 0.55, 0.1, 0.8, 0.12, 1.25);
  // haunches, chest and head (a rough carving)
  const body = new THREE.SphereGeometry(0.42, 10, 8);
  body.scale(0.9, 1.0, 1.15);
  b.add('rock', body, 0, 1.0, -0.2);
  const chest = new THREE.SphereGeometry(0.36, 10, 8);
  chest.scale(1, 1.25, 0.9);
  b.add('rock', chest, 0, 1.15, 0.25);
  const head = new THREE.SphereGeometry(0.33, 10, 8);
  head.scale(1.1, 1, 1);
  b.add('rock', head, 0, 1.62, 0.36);
  // the mane in curls, eyes, the ball under its paw
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    b.add('rock', new THREE.IcosahedronGeometry(0.1, 0), Math.cos(a) * 0.32, 1.62 + Math.sin(a) * 0.3, 0.22);
  }
  for (const s of [-1, 1]) b.add('dark', new THREE.SphereGeometry(0.04, 6, 4), s * 0.12, 1.7, 0.66);
  b.add('rock', new THREE.SphereGeometry(0.17, 10, 8), 0.24, 0.84, 0.5);
}
function flagpole(b: Builder, d: Dress) {
  b.box('stone', 0, 0, 0, 0.7, 0.3, 0.7);
  b.add('wood', new THREE.CylinderGeometry(0.07, 0.11, d.s, 7), 0, d.s / 2, 0);
  const g = new THREE.PlaneGeometry(1.4, 2.6, 4, 4);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 2.2) * 0.12);
  b.add('silk', g, 0.72, d.s - 1.6, 0);
  b.add('gold', new THREE.SphereGeometry(0.12, 8, 6), 0, d.s + 0.1, 0);
}
function pot(b: Builder, d: Dress) {
  const pts = [0, 0.24, 0.36, 0.42, 0.44].map((r, i) => new THREE.Vector2(r, i * 0.15));
  b.add(d.seed % 2 ? 'dark' : 'soil', new THREE.LatheGeometry(pts, 12), 0, 0, 0);
  b.add('soil', new THREE.CylinderGeometry(0.4, 0.4, 0.04, 12), 0, 0.58, 0);
  if (d.seed % 3 === 0) {
    // a little pine
    b.add('log', new THREE.CylinderGeometry(0.03, 0.05, 0.6, 5), 0, 0.88, 0);
    for (let k = 0; k < 3; k++) {
      const g = new THREE.IcosahedronGeometry(0.22 - k * 0.04, 0);
      g.scale(1.3, 0.5, 1.3);
      b.add('leaf', g, (k - 1) * 0.12, 1.0 + k * 0.17, (k % 2) * 0.1);
    }
  } else {
    const g = new THREE.IcosahedronGeometry(0.36, 1);
    g.scale(1, 0.8, 1);
    b.add('leaf', g, 0, 0.88, 0);
    for (let k = 0; k < 6; k++) b.add(k % 2 ? 'red' : 'white', new THREE.IcosahedronGeometry(0.05, 0), Math.cos(k) * 0.26, 0.98 + (k % 3) * 0.06, Math.sin(k) * 0.26);
  }
}
function bench(b: Builder) {
  b.box('plank', 0, 0.38, 0, 1.9, 0.07, 0.38);
  for (const s of [-1, 1]) b.box('wood', s * 0.75, 0, 0, 0.08, 0.38, 0.32);
}
function tuft(b: Builder, d: Dress) {
  const n = 3 + (d.seed % 3);
  for (let k = 0; k < n; k++) {
    const g = new THREE.ConeGeometry(0.05, 0.35 * d.s + rnd(k, d.seed) * 0.2, 3);
    g.rotateZ((rnd(d.seed, k) - 0.5) * 0.6);
    b.add(k % 2 ? 'crop' : 'leaf', g, Math.cos(k * 2.1) * 0.08, 0.15 * d.s, Math.sin(k * 2.1) * 0.08);
  }
}
function flowers(b: Builder, d: Dress) {
  tuft(b, d);
  const petal: Mat = (['red', 'white', 'silk', 'silk2', 'hay'] as Mat[])[d.seed % 5];
  for (let k = 0; k < 5; k++) b.add(petal, new THREE.IcosahedronGeometry(0.045, 0), Math.cos(k * 1.3) * 0.12, 0.3 + rnd(k, d.seed) * 0.15, Math.sin(k * 1.3) * 0.12);
}
function basket(b: Builder, d: Dress) {
  const pts = [0, 0.18, 0.24, 0.27].map((r, i) => new THREE.Vector2(r, i * 0.1));
  b.add('hay', new THREE.LatheGeometry(pts, 10), 0, 0, 0);
  const fill: Mat = (['red', 'crop', 'white', 'soil'] as Mat[])[d.seed % 4];
  for (let k = 0; k < 5; k++) b.add(fill, new THREE.IcosahedronGeometry(0.07, 0), Math.cos(k * 1.26) * 0.12, 0.3, Math.sin(k * 1.26) * 0.12);
}
function millstone(b: Builder) {
  b.add('stone', new THREE.CylinderGeometry(0.75, 0.8, 0.45, 16), 0, 0.22, 0);
  b.add('rock', new THREE.CylinderGeometry(0.55, 0.55, 0.32, 16), 0, 0.6, 0);
  b.add('wood', new THREE.CylinderGeometry(0.04, 0.04, 0.5, 5), 0.42, 0.95, 0);
  b.add('wood', new THREE.CylinderGeometry(0.035, 0.035, 1.6, 5).rotateZ(Math.PI / 2), 0, 0.62, 0.62);
}
function hang(b: Builder, d: Dress) {
  // a string of corn or chillies from the eaves, at 2.1 to 3 m
  const corn = d.seed % 2 === 0;
  b.add('dark', new THREE.CylinderGeometry(0.008, 0.008, 0.4, 3), 0, 3.1, 0);
  for (let j = 0; j < 8; j++) {
    const y = 2.9 - j * 0.11;
    if (corn) b.add('hay', new THREE.CylinderGeometry(0.06, 0.045, 0.22, 6).rotateZ((j % 2 ? 1 : -1) * 0.3), (j % 2 ? 0.05 : -0.05), y, 0);
    else for (let k = 0; k < 3; k++) b.add('red', new THREE.ConeGeometry(0.028, 0.13, 4).rotateX(Math.PI), Math.cos(j + k * 2) * 0.05, y, Math.sin(j + k * 2) * 0.05);
  }
}

// (yard trees and bamboo are grown by render/Flora.tsx now, with the land's trees)
const none = () => {};
void tree;
void bamboo;
const MAKE: Record<Dress['k'], (b: Builder, d: Dress) => void> = {
  wall, plot, woodpile, vat, rack, washing, tree: none, bamboo: none, table, lion, flagpole, pot, bench, tuft, flowers, basket, millstone, hang,
};

export function VillageDress({ sim }: { sim: Sim }) {
  void sim;
  const parts = useMemo(() => {
    const b = new Builder();
    for (const d of DRESS) {
      const local = new Builder();
      MAKE[d.k](local, d);
      // walls and plots sit on the ground at their middle; their length runs along the slope well enough
      b.merge(local, d.x, groundHeight(d.x, d.z), d.z, d.rot);
    }
    return b.build();
  }, []);
  return <Built parts={parts} />;
}

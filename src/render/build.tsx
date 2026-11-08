// Simple shapes merged into one mesh per material: a whole village or palace in a few draw calls.
import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeBufferGeometries } from 'three-stdlib';
import { dress } from './surfaces';

export type Mat = 'stone' | 'step' | 'red' | 'wall' | 'roof' | 'ridge' | 'wood' | 'bronze' | 'cloth' | 'paper' | 'dark' | 'plank' | 'log' | 'thatch' | 'tile' | 'leaf' | 'crop' | 'soil' | 'hay' | 'lamp' | 'flame' | 'canvas' | 'rock' | 'pave' | 'pave2';
const COLORS: Record<Mat, [string, number, number]> = {
  stone: ['#d4cdbd', 0.95, 0],
  step: ['#b9b2a2', 1, 0],
  red: ['#8d2a1c', 0.82, 0],
  wall: ['#a5402c', 0.85, 0],
  roof: ['#c48d2c', 0.62, 0.15],
  ridge: ['#6a4a1c', 0.6, 0.2],
  wood: ['#4b2d1a', 0.9, 0],
  bronze: ['#7a6330', 0.6, 0.55],
  cloth: ['#17130f', 0.9, 0],
  paper: ['#ffd58a', 1, 0],
  dark: ['#1d1612', 1, 0],
  plank: ['#7a5a3a', 0.95, 0],
  log: ['#5e4430', 1, 0],
  thatch: ['#a08a5a', 1, 0],
  tile: ['#4a4f55', 0.9, 0],
  leaf: ['#3f6a2a', 1, 0],
  crop: ['#5d8a2e', 1, 0],
  soil: ['#5a4430', 1, 0],
  hay: ['#c9a85a', 1, 0],
  lamp: ['#e2462e', 1, 0],
  flame: ['#ffb24a', 1, 0],
  canvas: ['#8e7d5f', 1, 0],
  rock: ['#77736b', 1, 0],
  pave: ['#8e887c', 1, 0],
  pave2: ['#a39b8b', 1, 0],
};

export class Builder {
  parts: Record<string, THREE.BufferGeometry[]> = {};
  add(m: Mat, g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0) {
    g.rotateY(ry);
    g.translate(x, y, z);
    (this.parts[m] ||= []).push(g.index ? g.toNonIndexed() : g);
  }
  box(m: Mat, x: number, y: number, z: number, w: number, h: number, d: number, ry = 0) {
    this.add(m, new THREE.BoxGeometry(w, h, d), x, y + h / 2, z, ry);
  }
  col(m: Mat, x: number, y: number, z: number, r: number, h: number, seg = 10) {
    this.add(m, new THREE.CylinderGeometry(r, r * 1.05, h, seg), x, y + h / 2, z);
  }
  /** a hip roof with flared eaves: a wide shallow skirt under a steeper top, both four sided */
  roof(x: number, y: number, z: number, w: number, d: number, h: number, o = 2.2, m: Mat = 'roof') {
    const skirt = new THREE.CylinderGeometry(0.62, 1, 1, 4, 1, true);
    skirt.rotateY(Math.PI / 4);
    skirt.scale((w + 2 * o) / Math.SQRT2, h * 0.32, (d + 2 * o) / Math.SQRT2);
    this.add(m, skirt, x, y + h * 0.16, z);
    const top = new THREE.CylinderGeometry(0.08, 1, 1, 4, 1);
    top.rotateY(Math.PI / 4);
    top.scale(((w + 2 * o) * 0.62) / Math.SQRT2, h * 0.72, ((d + 2 * o) * 0.62) / Math.SQRT2);
    this.add(m, top, x, y + h * 0.32 + h * 0.36, z);
    // the ridge and its two end ornaments
    this.box('ridge', x, y + h * 0.98, z, Math.max(1, (w - d) * 0.6), 0.5, 0.5);
    for (const s of [-1, 1]) this.box('ridge', x + s * Math.max(0.5, (w - d) * 0.3), y + h * 0.98, z, 0.5, 1.4, 0.5);
    // the eave's underside, dark, so the roof reads as overhanging
    this.box('dark', x, y - 0.05, z, w + 2 * o * 0.9, 0.12, d + 2 * o * 0.9);
  }
  /** a hall: columns round a walled core, brackets, a roof (two eaves when big) */
  hall(x: number, y: number, z: number, w: number, d: number, colH: number, eaves: number) {
    const nx = Math.max(2, Math.round(w / 4.2));
    const nz = Math.max(2, Math.round(d / 4.2));
    for (let i = 0; i <= nx; i++)
      for (const s of [-1, 1]) this.col('red', x - w / 2 + (i * w) / nx, y, z + (s * d) / 2, 0.42, colH);
    for (let j = 1; j < nz; j++) for (const s of [-1, 1]) this.col('red', x + (s * w) / 2, y, z - d / 2 + (j * d) / nz, 0.42, colH);
    this.box('wall', x, y, z, w - 2.4, colH, d - 2.4);
    // door and windows on the front wall
    for (let i = 0; i < nx; i++) {
      const cx = x - w / 2 + ((i + 0.5) * w) / nx;
      const mid = Math.abs(i - (nx - 1) / 2) < 1;
      this.box(mid ? 'wood' : 'paper', cx, y + (mid ? 0 : colH * 0.35), z + d / 2 - 1.15, (w / nx) * 0.6, mid ? colH * 0.75 : colH * 0.4, 0.15);
    }
    this.box('wood', x, y + colH, z, w + 1.4, 0.9, d + 1.4); // the bracket band
    let ty = y + colH + 0.9;
    let rw = w, rd = d;
    for (let e = 0; e < eaves; e++) {
      const last = e === eaves - 1;
      const h = last ? Math.min(rw, rd) * 0.62 : 2.2;
      if (last) this.roof(x, ty, z, rw, rd, h);
      else {
        this.roof(x, ty, z, rw, rd, 2.2, 2.6);
        ty += 2.4;
        rw *= 0.86;
        rd *= 0.8;
        this.box('wall', x, ty - 0.4, z, rw - 1, 2.4, rd - 1);
        this.box('wood', x, ty + 1.8, z, rw + 0.8, 0.6, rd + 0.8);
        ty += 2.4;
      }
    }
  }
  /** a stone balustrade along a line */
  rail(x0: number, z0: number, x1: number, z1: number, y: number) {
    const L = Math.hypot(x1 - x0, z1 - z0);
    const ry = Math.atan2(x1 - x0, z1 - z0);
    this.box('stone', (x0 + x1) / 2, y + 0.75, (z0 + z1) / 2, 0.25, 0.2, L, ry);
    const n = Math.max(1, Math.round(L / 1.8));
    for (let k = 0; k <= n; k++) this.box('stone', x0 + ((x1 - x0) * k) / n, y, z0 + ((z1 - z0) * k) / n, 0.32, 1, 0.32);
  }
  /** a flight of steps rising toward -z, from (x, y, z) up by h */
  steps(x: number, y: number, z: number, w: number, h: number, n: number) {
    const rise = h / n;
    for (let k = 0; k < n; k++) this.box('step', x, y, z - k * 0.45, w, rise * (k + 1), 0.45);
  }
  /** a stone lantern */
  lantern(x: number, y: number, z: number) {
    this.box('stone', x, y, z, 0.9, 0.3, 0.9);
    this.col('stone', x, y + 0.3, z, 0.16, 1.1, 8);
    this.box('stone', x, y + 1.4, z, 0.7, 0.2, 0.7);
    this.box('paper', x, y + 1.6, z, 0.45, 0.5, 0.45);
    this.box('stone', x, y + 2.1, z, 0.85, 0.22, 0.85);
  }
  /** another builder's shapes (made round its own origin), turned and moved into this one */
  merge(o: Builder, x: number, y: number, z: number, ry = 0) {
    for (const [m, gs] of Object.entries(o.parts))
      for (const g of gs) {
        const c = g.clone();
        c.rotateY(ry);
        c.translate(x, y, z);
        (this.parts[m] ||= []).push(c);
      }
  }
  build() {
    const out: { m: Mat; g: THREE.BufferGeometry }[] = [];
    for (const [m, gs] of Object.entries(this.parts)) {
      const g = mergeBufferGeometries(gs, false);
      if (!g) continue;
      g.computeBoundingSphere();
      out.push({ m: m as Mat, g });
    }
    return out;
  }
}


const matCache = new Map<Mat, THREE.Material>();
const LIFT: Partial<Record<Mat, number>> = { stone: 0.22, step: 0.18, pave: 0.14, pave2: 0.14, red: 0.18, roof: 0.15, wall: 0.12, wood: 0.1 };
export function matOf(m: Mat) {
  let out = matCache.get(m);
  if (!out) {
    const [c, r, mt] = COLORS[m];
    out =
      m === 'paper' || m === 'lamp'
        ? new THREE.MeshStandardMaterial({ color: c, emissive: m === 'lamp' ? '#ff5a2a' : '#ffb347', emissiveIntensity: 0.9, roughness: 1 })
        : m === 'flame'
          ? new THREE.MeshBasicMaterial({ color: c, toneMapped: false })
          : new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: mt, side: m === 'canvas' ? THREE.DoubleSide : THREE.FrontSide });
    // worked stone glows a little of its own colour: an arch or a stair in its own shadow still reads, never a black block
    if (LIFT[m] && out instanceof THREE.MeshStandardMaterial) {
      out.emissive = new THREE.Color(c);
      out.emissiveIntensity = LIFT[m]!;
    }
    if (out instanceof THREE.MeshStandardMaterial && m !== 'paper' && m !== 'lamp') dress(out, m);
    matCache.set(m, out);
  }
  return out;
}
export function Built({ parts, shadows = true }: { parts: { m: Mat; g: THREE.BufferGeometry }[]; shadows?: boolean }) {
  const list = useMemo(() => parts, [parts]);
  return (
    <>
      {list.map(({ m, g }) => (
        <mesh key={m} geometry={g} material={matOf(m)} castShadow={shadows && m !== 'flame'} receiveShadow />
      ))}
    </>
  );
}

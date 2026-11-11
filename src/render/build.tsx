// Simple shapes merged into one mesh per material: a whole village or palace in a few draw calls.
import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeBufferGeometries } from 'three-stdlib';
import { withSnow } from './season';
import { dress } from './surfaces';

export type Mat = 'stone' | 'step' | 'red' | 'wall' | 'roof' | 'ridge' | 'wood' | 'bronze' | 'cloth' | 'paper' | 'dark' | 'plank' | 'log' | 'thatch' | 'tile' | 'leaf' | 'crop' | 'soil' | 'hay' | 'lamp' | 'flame' | 'canvas' | 'rock' | 'pave' | 'pave2' | 'plaster' | 'silk' | 'silk2' | 'fur' | 'gold' | 'white';
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
  plaster: ['#d8ccb2', 1, 0],
  silk: ['#b8324a', 0.6, 0],
  silk2: ['#3a6fa8', 0.6, 0],
  fur: ['#7a5b3e', 1, 0],
  gold: ['#d4a23a', 0.45, 0.6],
  white: ['#eee8dc', 0.9, 0],
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
  /** a hip roof the Chinese way: four curved slopes (steep under the ridge, easing out flat to the eaves), the eaves
   *  hanging past the walls by o and their corners swept up; a thin slab, its underside darker */
  roof(x: number, y: number, z: number, w: number, d: number, h: number, o = 2.2, m: Mat = 'roof') {
    const W = w / 2 + o, D = d / 2 + o;
    const short = Math.min(W, D);
    const N = 22;
    const pos: number[] = [];
    const idx: number[] = [];
    const lift = (px: number, pz: number) => {
      // distance in from the nearest edge, as a share of the way to the ridge
      const s = Math.min(1, Math.min((W - Math.abs(px)) / short, (D - Math.abs(pz)) / short));
      const prof = Math.pow(s, 1.6); // concave: shallow at the eaves, steep up top
      const cx = Math.max(0, (Math.abs(px) / W - 0.55) / 0.45), cz = Math.max(0, (Math.abs(pz) / D - 0.55) / 0.45);
      const corner = Math.pow(cx * cz, 1.5) * Math.pow(1 - s, 2) * 0.32; // the swept-up corners
      return h * (0.06 + 0.9 * prof + corner);
    };
    for (let j = 0; j <= N; j++)
      for (let i = 0; i <= N; i++) {
        const px = -W + (2 * W * i) / N, pz = -D + (2 * D * j) / N;
        pos.push(px, lift(px, pz), pz);
      }
    const row = N + 1;
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const a = j * row + i, b = a + 1, c = a + row, e = c + 1;
        idx.push(a, c, b, b, c, e);
      }
    const top = new THREE.BufferGeometry();
    top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    top.setIndex(idx);
    top.computeVertexNormals();
    this.add(m, top, x, y, z);
    // the underside: the same sheet a hand lower, facing down, in the dark of the eaves
    const under = top.clone();
    under.translate(0, -0.22, 0);
    const ui = under.index!.array as Uint16Array | Uint32Array;
    for (let k = 0; k < ui.length; k += 3) {
      const t = ui[k + 1];
      ui[k + 1] = ui[k + 2];
      ui[k + 2] = t;
    }
    under.computeVertexNormals();
    this.add('wood', under, x, y, z);
    // the ridge and its two end ornaments
    // (along the longer side; the end ornaments curl up at its two ends)
    const along = Math.max(1, Math.abs(w - d) * 0.6), endAt = Math.max(0.5, Math.abs(w - d) * 0.3);
    const ry = w >= d ? 0 : Math.PI / 2;
    this.box('ridge', x, y + h * 0.94, z, along, 0.5, 0.5, ry);
    for (const s of [-1, 1]) this.box('ridge', x + (w >= d ? s * endAt : 0), y + h * 0.94, z + (w >= d ? 0 : s * endAt), 0.5, 1.4, 0.5);
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
      // shapes from different makers disagree (indexed or not, a uv or not): bring them all to the same form first
      const same = gs.map((g0) => {
        let g = g0.index ? g0.toNonIndexed() : g0;
        for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
        if (!g.attributes.normal) g.computeVertexNormals();
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        g.morphAttributes = {};
        return g;
      });
      const g = mergeBufferGeometries(same, false);
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
    if (out instanceof THREE.MeshStandardMaterial && m !== 'paper' && m !== 'lamp') withSnow(out);
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

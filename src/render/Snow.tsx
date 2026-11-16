// 雪岭 (game/snow.ts, laid out in game/snowmap.ts): 雪岭山道 as a road you can see (flagstones in the valley, packed
// snow over them higher up, edge stones, stone lanterns, red rags on posts to mark it in the snow), the stone gate at
// the snowline, the rest pavilion, ice crystals in the canyon, the camp on its terrace (hide tents, a stockade of
// stakes, the fire with its pot, the rack, the banner, lanterns at its way in), the frozen lake, the two rock shelters,
// the ice cave's mouth in its cliff with the old temple's broken gate, stupas and fallen bell before it and a frozen
// fall beside it, the summit's ledge path with its steps and rope, the cairn, flags and stele on top; snow lotus
// glowing in the drifts, snow falling and blowing round you up there whatever the weather below.
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Sim } from '../game/sim';
import { GLOW_LOTUS, LOTUS, SNOW_FIRES, SUMMIT, glowLotusNow, onSnow } from '../game/snow';
import { SNOW_Y, groundHeight, onSnowPad, slopeAt, snowLand, snowTrailDist } from '../game/world';
import {
  CAMP, CAMP_FENCE, CAMP_FIRE, CAVE, GATE, GATE_AT, GATE_HALF, LAKE, NICHE, PAVILION, RUIN_HALF, RUIN_Z, SNOW_BOX, SNOW_ROAD, STELE_AT, STUPAS, SUMMIT_PATH, SUMMIT_TOP, TENTS,
  SNOW_PARTS, SUMMIT_H, inFrame, padById, shelterRot, type Frame,
} from '../game/snowmap';
import { Builder, Built } from './build';
import { textTex } from './Gudao';
import { ambience } from '../audio/audio';
import { ROOMS } from '../game/interiors';
import { withSnow } from './season';

const hash = (a: number, b: number) => {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
/** a rough stone: an icosahedron pushed about (no two alike) */
function rockGeo(r: number, seed: number, flat = 0.7) {
  const g = new THREE.IcosahedronGeometry(r, 1);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const seen = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    let s = seen.get(k);
    if (s === undefined) seen.set(k, (s = 0.78 + hash(v.x * 9 + seed, v.z * 7 + v.y * 3) * 0.44));
    p.setXYZ(i, v.x * s, v.y * s * flat, v.z * s);
  }
  g.computeVertexNormals();
  return g;
}

/** the road and the summit's path as ribbons laid on the ground: (x, z) points, width; colour attribute says how snowy */
function ribbon(line: [number, number][], width: number, across = 6, step = 1.4) {
  const pts: { x: number; z: number; v: number }[] = [];
  let v = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1], [bx, bz] = line[i];
    const L = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(L / step));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) {
      const u = k / n;
      pts.push({ x: ax + (bx - ax) * u, z: az + (bz - az) * u, v: v + L * u });
    }
    v += L;
  }
  const N = pts.length, M = across + 1;
  const pos = new Float32Array(N * M * 3), nor = new Float32Array(N * M * 3), uv = new Float32Array(N * M * 2), col = new Float32Array(N * M * 3);
  for (let k = 0; k < N; k++) {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(N - 1, k + 1)];
    const L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const sx = (b.z - a.z) / L, sz = -(b.x - a.x) / L; // across
    for (let j = 0; j < M; j++) {
      const t = j / across - 0.5;
      const x = pts[k].x + sx * t * width, z = pts[k].z + sz * t * width;
      const y = groundHeight(x, z) + 0.06;
      const o = (k * M + j) * 3;
      pos[o] = x;
      pos[o + 1] = y;
      pos[o + 2] = z;
      const e = 0.6;
      const hx = groundHeight(x + e, z) - groundHeight(x - e, z), hz = groundHeight(x, z + e) - groundHeight(x, z - e);
      const l = Math.hypot(hx, 2 * e, hz);
      nor[o] = -hx / l;
      nor[o + 1] = (2 * e) / l;
      nor[o + 2] = -hz / l;
      uv[(k * M + j) * 2] = j / across;
      uv[(k * M + j) * 2 + 1] = pts[k].v;
      const snow = Math.min(1, Math.max(0, (y - (SNOW_Y - 12)) / 18));
      col[o] = snow;
      col[o + 1] = snow;
      col[o + 2] = snow;
    }
  }
  const idx: number[] = [];
  for (let k = 0; k < N - 1; k++)
    for (let j = 0; j < across; j++) {
      const a = k * M + j, b = a + 1, c = a + M, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return { g, pts };
}
/** the road's look: flagstones in rows, dark joints; up in the snow, packed snow over them, trodden down the middle */
function roadMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 color;\nvarying vec2 vRUv;\nvarying float vRSnow;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvRUv = uv;\nvRSnow = color.r;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec2 vRUv;
varying float vRSnow;
float rh(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float rn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(rh(i),rh(i+vec2(1,0)),u.x), mix(rh(i+vec2(0,1)),rh(i+vec2(1,1)),u.x), u.y); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float rowF = vRUv.y * 1.05;
float row = floor(rowF);
float off = mod(row, 2.0) * 0.5 + rh(vec2(row, 3.0)) * 0.3;
vec2 cf = vec2(vRUv.x * 3.2 + off, rowF);
vec2 cell = floor(cf);
vec2 f = fract(cf);
float joint = smoothstep(0.0, 0.07, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
float n = rn(vRUv * vec2(9.0, 3.0));
vec3 stone = mix(vec3(0.40, 0.38, 0.35), vec3(0.60, 0.57, 0.51), rh(cell)) * (0.86 + 0.2 * n);
vec3 rc = mix(vec3(0.16, 0.14, 0.12), stone, joint);
// the edges fray into the ground
float edge = min(vRUv.x, 1.0 - vRUv.x);
rc = mix(rc * 0.8, rc, smoothstep(0.0, 0.12, edge + (n - 0.5) * 0.08));
// packed snow over the stones up high, trodden thin down the middle in two tracks
float mid = abs(vRUv.x - 0.5) * 2.0;
float tracks = smoothstep(0.08, 0.0, abs(mid - 0.42)) * 0.5;
float cover = vRSnow * clamp(0.45 + 0.6 * mid + (rn(vRUv * vec2(4.0, 0.7)) - 0.5) * 0.7 - tracks, 0.0, 1.0);
vec3 snow = mix(vec3(0.78, 0.82, 0.88), vec3(0.93, 0.95, 0.98), n);
diffuseColor.rgb = mix(rc, snow, cover);`,
      );
  };
  return m;
}

/** the ice: clear blue, glossy, a little see-through */
const iceMat = () => new THREE.MeshStandardMaterial({ color: '#cfeaff', emissive: '#4fa8e8', emissiveIntensity: 0.22, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.84 });

/** the camp's tent: two hide panels leaning to a ridge pole, crossed poles at the ends, door to local +z */
function tent() {
  const b = new Builder();
  for (const s of [-1, 1]) b.add('fur', new THREE.BoxGeometry(0.09, 2.7, 3.6).rotateZ(s * 0.6), s * 0.82, 1.1, 0);
  b.add('fur', new THREE.BoxGeometry(2.6, 2.0, 0.08).translate(0, 0, 0), 0, 0.85, -1.75); // the closed back
  b.box('wood', 0, 2.18, 0, 0.11, 0.11, 4.0);
  for (const zz of [-1.85, 1.85]) for (const s of [-1, 1]) b.add('wood', new THREE.CylinderGeometry(0.04, 0.04, 2.7, 5).rotateZ(-s * 0.56), s * 0.62, 1.15, zz);
  // a hide rolled up over the door, stones holding the skirts
  b.add('fur', new THREE.CylinderGeometry(0.14, 0.14, 1.6, 7).rotateZ(Math.PI / 2), 0, 1.6, 1.9);
  for (let k = 0; k < 6; k++) b.add('rock', rockGeo(0.16, k), (k % 2 ? 1 : -1) * 1.55, 0.05, -1.4 + Math.floor(k / 2) * 1.4);
  return b;
}

function buildAll() {
  const b = new Builder();
  const gy = (x: number, z: number) => groundHeight(x, z);
  const at = (f: Frame, lx: number, lz: number) => inFrame(f, lx, lz);

  // ---- the valley: stone lanterns by the road (both sides of the fork, then every 55 m or so), the rest pavilion
  {
    let v = 0;
    let next = 0;
    for (let i = 1; i <= GATE_AT; i++) {
      const a = SNOW_ROAD[i - 1], c = SNOW_ROAD[i];
      const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L;
      while (next <= v + L) {
        const u = (next - v) / L, x = a[0] + (c[0] - a[0]) * u, z = a[1] + (c[1] - a[1]) * u;
        const sides = next === 0 ? [-1, 1] : [Math.round(next / 55) % 2 ? 1 : -1];
        for (const s of sides) {
          const lx = x + uz * s * 4.4, lz = z - ux * s * 4.4;
          b.lantern(lx, gy(lx, lz) - 0.05, lz);
        }
        next += next === 0 ? 14 : 55;
      }
      v += L;
    }
    // 歇脚亭: a stone floor, four red posts, benches, a hip roof
    const p = new Builder();
    p.box('step', 0, -0.4, 0, 6.2, 0.75, 6.2);
    for (const [x, z] of [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]]) p.col('red', x, 0.3, z, 0.2, 3.2, 10);
    p.box('wood', 0, 3.4, 0, 5.4, 0.35, 5.4);
    p.roof(0, 3.75, 0, 4.8, 4.8, 2.3, 1.1);
    for (const s of [-1, 1]) p.box('wood', s * 2.4, 0.3, -0.4, 0.45, 0.45, 3.6);
    p.box('wood', 0, 0.3, -2.4, 3.6, 0.45, 0.45);
    b.merge(p, PAVILION.x, padById('pavilion').h + 0.05, PAVILION.z, PAVILION.rot);
  }

  // ---- 雪岭山门: two square stone pillars on drums, a double beam, a little roof, the board between the beams
  {
    const g = new Builder();
    for (const s of [-1, 1]) {
      g.box('stone', s * GATE_HALF, -0.3, 0, 1.4, 0.9, 1.4);
      g.box('stone', s * GATE_HALF, 0.6, 0, 0.82, 5.6, 0.82);
      g.add('stone', new THREE.CylinderGeometry(0.55, 0.62, 0.5, 12), s * GATE_HALF, 0.85, 0.85);
      g.add('stone', new THREE.CylinderGeometry(0.55, 0.62, 0.5, 12), s * GATE_HALF, 0.85, -0.85);
    }
    g.box('stone', 0, 4.55, 0, GATE_HALF * 2 + 1.0, 0.5, 0.7);
    g.box('red', 0, 5.75, 0, GATE_HALF * 2 + 1.6, 0.55, 0.75);
    g.box('stone', 0, 5.05, 0, 0.35, 0.7, 0.5);
    g.roof(0, 6.3, 0, GATE_HALF * 2 + 1.2, 1.1, 1.3, 0.9, 'tile');
    b.merge(g, GATE.x, padById('gate').h, GATE.z, GATE.rot);
  }

  // ---- the canyon: ice crystals growing at the feet of its walls (drawn with the ice below)

  // ---- the camp
  {
    const ch = padById('camp').h;
    for (const [lx, lz, r] of TENTS) {
      const [x, z] = at(CAMP, lx, lz);
      b.merge(tent(), x, ch - 0.04, z, CAMP.rot + r);
    }
    // the stockade: stakes along its runs, leaning out a little, lashed to a rail
    for (const [ax, az, bx, bz] of CAMP_FENCE) {
      const [x0, z0] = at(CAMP, ax, az), [x1, z1] = at(CAMP, bx, bz);
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(L / 0.42));
      for (let k = 0; k < n; k++) {
        const u = (k + 0.5) / n, x = x0 + (x1 - x0) * u, z = z0 + (z1 - z0) * u, h = 2.1 + hash(x, z) * 0.6;
        const st = new THREE.CylinderGeometry(0.11, 0.13, h, 6).translate(0, h / 2, 0);
        const tip = new THREE.ConeGeometry(0.11, 0.34, 6).translate(0, h + 0.17, 0);
        // lean outward from the camp's middle
        const ox = x - CAMP.x, oz = z - CAMP.z, ol = Math.hypot(ox, oz) || 1;
        const lean = 0.12;
        for (const g of [st, tip]) {
          g.rotateX(lean * (oz / ol));
          g.rotateZ(-lean * (ox / ol));
          b.add('log', g, x, ch - 0.25, z);
        }
      }
      b.box('wood', (x0 + x1) / 2, ch + 1.3, (z0 + z1) / 2, 0.1, 0.12, L, Math.atan2(x1 - x0, z1 - z0));
    }
    // the fire: a ring of stones, logs to sit on, a tripod and its pot
    const [fx, fz] = CAMP_FIRE;
    for (let k = 0; k < 11; k++) {
      const a = (k / 11) * Math.PI * 2;
      b.add('rock', rockGeo(0.24, k + 3), fx + Math.cos(a) * 0.9, ch + 0.06, fz + Math.sin(a) * 0.9);
    }
    for (let k = 0; k < 4; k++) b.box('log', fx, ch + 0.04, fz, 0.13, 0.13, 1.1, (k * Math.PI) / 4);
    for (const a of [0.7, 2.6, 4.4]) b.add('log', new THREE.CylinderGeometry(0.2, 0.22, 1.8, 8).rotateZ(Math.PI / 2), fx + Math.cos(a) * 2.3, ch + 0.2, fz + Math.sin(a) * 2.3, -a);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const leg = new THREE.CylinderGeometry(0.03, 0.03, 2.0, 5).translate(0, 1.0, 0).rotateX(-0.32).rotateY(-a + Math.PI / 2);
      b.add('wood', leg, fx + Math.cos(a) * 0.62, ch, fz + Math.sin(a) * 0.62);
    }
    b.add('bronze', new THREE.CylinderGeometry(0.28, 0.22, 0.36, 12), fx, ch + 0.95, fz);
    // a drying rack of herbs and hides, crates and sacks, a sled, a woodpile
    const rack = new Builder();
    for (const s of [-1, 1]) rack.col('wood', s * 1.3, 0, 0, 0.05, 2.0, 6);
    rack.box('wood', 0, 1.85, 0, 2.8, 0.07, 0.07);
    for (let k = 0; k < 6; k++) rack.box(k % 2 ? 'hay' : 'fur', -1.0 + k * 0.4, 1.15, 0, k % 2 ? 0.14 : 0.36, k % 2 ? 0.6 : 0.8, k % 2 ? 0.14 : 0.04);
    {
      const [x, z] = at(CAMP, -1.5, -9.5);
      b.merge(rack, x, ch, z, CAMP.rot + 0.3);
    }
    {
      const [x, z] = at(CAMP, 10, 7.5);
      b.box('plank', x, ch, z, 0.8, 0.7, 0.8, 0.3);
      b.box('plank', x + 0.7, ch, z + 0.6, 0.7, 0.6, 0.7, -0.2);
      b.box('plank', x + 0.2, ch + 0.7, z + 0.2, 0.6, 0.5, 0.6, 0.6);
      b.add('canvas', new THREE.SphereGeometry(0.42, 8, 6).scale(1, 0.75, 1), x - 0.9, ch + 0.28, z + 0.5);
      b.add('canvas', new THREE.SphereGeometry(0.4, 8, 6).scale(1, 0.75, 1), x - 1.5, ch + 0.26, z - 0.2);
    }
    {
      // the sled: two runners curling up in front, a slatted bed
      const sled = new Builder();
      for (const s of [-1, 1]) {
        sled.box('wood', s * 0.45, 0, 0, 0.07, 0.08, 2.2);
        sled.add('wood', new THREE.TorusGeometry(0.22, 0.035, 5, 10, Math.PI / 2).rotateY(Math.PI / 2), s * 0.45, 0.22, 1.1);
      }
      for (let k = 0; k < 6; k++) sled.box('plank', 0, 0.3, -0.9 + k * 0.34, 1.0, 0.05, 0.26);
      for (const s of [-1, 1]) for (const zz of [-0.7, 0.4]) sled.box('wood', s * 0.45, 0.06, zz, 0.06, 0.26, 0.06);
      const [x, z] = at(CAMP, -11.5, -0.5);
      b.merge(sled, x, ch + 0.02, z, CAMP.rot + 1.4);
    }
    {
      const [x, z] = at(CAMP, 1.5, -12);
      for (let r = 0; r < 4; r++) for (let k = 0; k < 5 - r; k++) b.add('log', new THREE.CylinderGeometry(0.17, 0.17, 1.6, 7).rotateZ(Math.PI / 2), x - 0.68 + k * 0.36 + r * 0.18, ch + 0.17 + r * 0.3, z, CAMP.rot);
    }
    // the banner pole and the sign of the ginseng digger
    {
      const [x, z] = at(CAMP, -2.5, -11);
      b.col('wood', x, ch, z, 0.08, 7.5, 8);
      b.box('wood', x, ch + 7.0, z, 0.06, 0.06, 1.6, CAMP.rot + Math.PI / 2);
    }
    {
      const [x, z] = at(CAMP, 5.5, 8.5);
      b.col('wood', x, ch, z, 0.06, 2.0, 6);
      b.box('plank', x, ch + 1.55, z, 0.9, 0.55, 0.07, CAMP.rot);
    }
    // two lantern posts where the road comes up onto the terrace
    for (const s of [-1, 1]) {
      const [x, z] = at(CAMP, s * 4.6, 12.5);
      const y = groundHeight(x, z);
      b.col('wood', x, y, z, 0.08, 3.0, 8);
      b.box('wood', x, y + 2.9, z, 0.07, 0.07, 0.9, CAMP.rot + Math.PI / 2);
      const [lx, lz] = at(CAMP, s * 4.6 - s * 0.4, 12.5);
      b.box('lamp', lx, y + 2.15, lz, 0.38, 0.55, 0.38);
    }
  }

  // ---- the rock shelters: a slab leaning on two boulders, the fire under it
  for (const id of ['shelterE', 'shelterW']) {
    const p = padById(id);
    const f: Frame = { x: p.x, z: p.z, rot: shelterRot(p) };
    const y = p.h;
    const s = new Builder();
    s.add('rock', rockGeo(1.35, 11 + p.x, 1.25), -2.3, 0.55, -1.2);
    s.add('rock', rockGeo(1.2, 17 + p.z, 1.2), 2.3, 0.45, -1.3);
    s.add('rock', rockGeo(1.7, 23, 0.32).scale(1.9, 1, 1.1), 0, 2.15, -1.15);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      s.add('rock', rockGeo(0.18, k), Math.cos(a) * 0.7, 0.05, Math.sin(a) * 0.7 + 0.4);
    }
    for (let k = 0; k < 3; k++) s.box('log', 0, 0.04, 0.4, 0.1, 0.1, 0.9, (k * Math.PI) / 3);
    b.merge(s, f.x, y, f.z, f.rot);
  }

  // ---- 半山石龛: rocks round a fire on the summit path's inner side, a slab over it
  {
    const [nx, nz] = NICHE, ny = gy(nx, nz);
    const f: Frame = { x: nx, z: nz, rot: Math.atan2(nx - SUMMIT_TOP[0], nz - SUMMIT_TOP[1]) };
    const s = new Builder();
    s.add('rock', rockGeo(1.1, 61, 1.3), -1.9, 0.5, -1.0);
    s.add('rock', rockGeo(1.0, 67, 1.2), 1.9, 0.45, -1.0);
    s.add('rock', rockGeo(1.5, 71, 0.3).scale(1.7, 1, 1), 0, 1.95, -1.1);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      s.add('rock', rockGeo(0.16, k + 80), Math.cos(a) * 0.6, 0.05, Math.sin(a) * 0.6);
    }
    for (let k = 0; k < 3; k++) s.box('log', 0, 0.04, 0, 0.09, 0.09, 0.8, (k * Math.PI) / 3);
    b.merge(s, nx, ny, nz, f.rot);
  }

  // ---- the ice cave: its mouth framed in rock, the cliff over it; before it the temple's broken gate, the stupas, the bell
  {
    const ch = padById('cave').h;
    const c = new Builder();
    // the rock frame round a 4.4 m opening, running back into the hill
    for (let k = 0; k < 13; k++) {
      const a = -1.35 + (k / 12) * 2.7, r = 3.3 + (k % 3) * 0.25;
      c.add('rock', rockGeo(1.15 + (k % 3) * 0.35, k * 3.1, 1.15), Math.sin(a) * r, Math.cos(a) * r * 0.95 + 0.4, -0.7 - (k % 2) * 0.5);
    }
    c.box('dark', 0, -0.2, -0.95, 4.3, 4.1, 0.4);
    // frost on the ground before it
    c.add('white', new THREE.CircleGeometry(4.2, 18).rotateX(-Math.PI / 2), 0, 0.08, 2.2);
    b.merge(c, CAVE.x, ch, CAVE.z, CAVE.rot);
    // the temple's gate, one pillar standing, one broken, the beam fallen across the snow
    const r = new Builder();
    r.box('stone', -RUIN_HALF, -0.2, 0, 0.8, 4.6, 0.8);
    r.box('stone', RUIN_HALF, -0.2, 0, 0.8, 2.1, 0.8);
    r.add('stone', rockGeo(0.55, 3, 0.8), RUIN_HALF + 0.9, 0.2, 0.7);
    r.add('stone', new THREE.BoxGeometry(6.8, 0.55, 0.65).rotateZ(0.12).rotateY(0.35), 1.2, 0.35, 1.6);
    r.box('red', -RUIN_HALF, 3.6, 0, 1.4, 0.4, 0.9);
    b.merge(r, ...at(CAVE, 0, RUIN_Z), ch, CAVE.rot);
    // the stupas: base, drum, dome, spire of rings, a finial
    for (const [lx, lz, h] of STUPAS) {
      const [x, z] = at(CAVE, lx, lz);
      const k = h / 4;
      const s = new Builder();
      s.box('stone', 0, -0.2, 0, 1.9 * k, 0.75 * k, 1.9 * k);
      s.box('stone', 0, 0.55 * k, 0, 1.45 * k, 0.45 * k, 1.45 * k);
      s.add('stone', new THREE.CylinderGeometry(0.62 * k, 0.7 * k, 0.6 * k, 12), 0, 1.3 * k, 0);
      s.add('stone', new THREE.SphereGeometry(0.72 * k, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.6 * k, 0);
      for (let i = 0; i < 5; i++) s.add('stone', new THREE.CylinderGeometry((0.32 - i * 0.045) * k, (0.34 - i * 0.045) * k, 0.18 * k, 10), 0, (2.35 + i * 0.22) * k, 0);
      s.add('bronze', new THREE.SphereGeometry(0.13 * k, 8, 6), 0, 3.55 * k, 0);
      b.merge(s, x, ch, z, CAVE.rot + hash(lx, lz));
    }
    // the bell, fallen from its frame into the snow
    {
      const [x, z] = at(CAVE, 3.2, 12.5);
      const bell = new THREE.CylinderGeometry(0.42, 0.62, 1.25, 16, 1, true).rotateZ(1.25);
      b.add('bronze', bell, x, ch + 0.5, z, CAVE.rot + 0.5);
      b.add('bronze', new THREE.SphereGeometry(0.42, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(1.25), x - 0.55, ch + 0.72, z, CAVE.rot + 0.5);
      b.add('wood', new THREE.BoxGeometry(0.22, 0.22, 3.2).rotateX(0.3), x + 1.0, ch + 0.4, z - 0.3, CAVE.rot + 1.2);
      b.add('wood', new THREE.BoxGeometry(0.2, 2.4, 0.2), x + 1.9, ch + 1.1, z + 0.6, CAVE.rot);
    }
  }

  // ---- the summit: the cairn and its flag pole, the stele; steps and a rope up the ledge path
  {
    const [x, z] = SUMMIT, y = gy(x, z);
    for (let k = 0; k < 7; k++) b.add('rock', rockGeo(0.55 - k * 0.06, k + 40, 0.65), x + Math.sin(k * 2.1) * 0.1, y + 0.25 + k * 0.42, z + Math.cos(k * 1.7) * 0.1);
    b.col('wood', x, y, z, 0.05, 4.2, 6);
    const [sx, sz] = STELE_AT, syy = gy(sx, sz);
    b.box('stone', sx, syy - 0.3, sz, 1.4, 0.5, 0.8, 0.4);
    b.box('stone', sx, syy, sz, 0.95, 2.6, 0.32, 0.4);
    b.add('stone', new THREE.CylinderGeometry(0.52, 0.52, 0.32, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), sx, syy + 2.6, sz, 0.4);
    // the ledge path: a stone step every metre and a half, posts and a rope along its open side
    const P = SUMMIT_PATH;
    let carry = 0;
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], c = P[i];
      const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L;
      // the open side: away from the peak
      const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
      const ox = mx - SUMMIT_TOP[0], oz = mz - SUMMIT_TOP[1], ol = Math.hypot(ox, oz) || 1;
      const sxn = uz, szn = -ux;
      const side = sxn * ox + szn * oz > 0 ? 1 : -1;
      for (let s = carry; s < L; s += 1.5) {
        const px = a[0] + ux * s, pz = a[1] + uz * s;
        b.box('step', px, gy(px, pz) - 0.12, pz, 2.3, 0.26, 0.85, Math.atan2(ux, uz));
        carry = s + 1.5 - L;
      }
      if (ol > 10) {
        const n = Math.max(1, Math.round(L / 3.5));
        for (let k = 0; k <= n; k++) {
          const u = k / n, px = a[0] + (c[0] - a[0]) * u + sxn * side * 2.2, pz = a[1] + (c[1] - a[1]) * u + szn * side * 2.2;
          b.col('wood', px, gy(px, pz) - 0.1, pz, 0.06, 1.25, 6);
        }
      }
    }
  }
  return b;
}

/** a red rag tied to a post, or a banner: a strip of cloth that flaps (its vertices moved each frame) */
function cloth(w: number, h: number, segs: number, color: string) {
  const g = new THREE.PlaneGeometry(w, h, segs, 1).translate(w / 2, -h / 2, 0);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.85 }));
  m.userData.base = (g.getAttribute('position') as THREE.BufferAttribute).array.slice();
  return m;
}
function flap(m: THREE.Mesh, t: number, k: number, amp = 0.18) {
  const p = m.geometry.getAttribute('position') as THREE.BufferAttribute, base = m.userData.base as Float32Array;
  for (let i = 0; i < p.count; i++) {
    const x = base[i * 3];
    p.setZ(i, Math.sin(t * 7 + k + x * 3.2) * amp * x + Math.sin(t * 13 + x * 6 + k) * 0.03 * x);
    p.setY(i, base[i * 3 + 1] - x * x * 0.04);
  }
  p.needsUpdate = true;
}

export function Snow({ sim }: { sim: Sim }) {
  const S = useMemo(() => {
    const parts = buildAll().build();
    const root = new THREE.Group();
    // the road and the summit path
    const rm = roadMaterial();
    const road = ribbon(SNOW_ROAD.map(([x, z]) => [x, z] as [number, number]), 5.2, 6, 1.4);
    const roadMesh = new THREE.Mesh(road.g, rm);
    roadMesh.receiveShadow = true;
    root.add(roadMesh);
    const path = ribbon(SUMMIT_PATH.map(([x, z]) => [x, z] as [number, number]), 2.9, 4, 1.2);
    const pathMesh = new THREE.Mesh(path.g, rm);
    pathMesh.receiveShadow = true;
    root.add(pathMesh);
    // edge stones along the road, and the red rags on posts marking it in the snow
    const stones: THREE.Matrix4[] = [];
    const rags: THREE.Mesh[] = [];
    const postsB = new Builder();
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
    let lastPost = -999;
    road.pts.forEach((p, k) => {
      if (p.v < 12) return;
      const a = road.pts[Math.max(0, k - 1)], c = road.pts[Math.min(road.pts.length - 1, k + 1)];
      const L = Math.hypot(c.x - a.x, c.z - a.z) || 1;
      const sx = (c.z - a.z) / L, sz = -(c.x - a.x) / L;
      const onPad = ['camp', 'gate', 'cave'].some((id) => {
        const d = padById(id);
        return Math.hypot(p.x - d.x, p.z - d.z) < d.r + 1;
      });
      if (!onPad && k % 2 === 0)
        for (const s of [-1, 1]) {
          if (hash(p.v, s) < 0.25) continue;
          const x = p.x + sx * s * (2.75 + hash(p.v * 2, s) * 0.35), z = p.z + sz * s * (2.75 + hash(p.v * 2, s) * 0.35);
          const r = 0.2 + hash(p.v, s * 3) * 0.24;
          e.set(hash(x, 1) * 0.6, hash(z, 2) * 6.28, hash(x, 3) * 0.6);
          q.setFromEuler(e);
          stones.push(m4.clone().compose(pv.set(x, groundHeight(x, z) + r * 0.15, z), q, sc.set(r * 1.3, r * 0.75, r)));
        }
      // a post with a red rag every 26 m up in the snow (alternate sides)
      if (!onPad && p.v - lastPost > 26 && groundHeight(p.x, p.z) > SNOW_Y - 10) {
        lastPost = p.v;
        const s = Math.round(p.v / 26) % 2 ? 1 : -1;
        const x = p.x + sx * s * 3.3, z = p.z + sz * s * 3.3, y = groundHeight(x, z);
        postsB.col('wood', x, y - 0.1, z, 0.06, 1.85, 6);
        const rag = cloth(0.55, 0.12, 6, '#b3261e');
        rag.position.set(x, y + 1.62, z);
        rag.rotation.y = Math.atan2(sx, sz) + Math.PI / 2;
        root.add(rag);
        rags.push(rag);
      }
    });
    const stoneMesh = new THREE.InstancedMesh(rockGeo(1, 7, 0.8), new THREE.MeshStandardMaterial({ color: '#7d786f', roughness: 0.95 }), stones.length);
    stones.forEach((m, i) => stoneMesh.setMatrixAt(i, m));
    stoneMesh.castShadow = stoneMesh.receiveShadow = true;
    root.add(stoneMesh);
    // the camp's banner
    {
      const [x, z] = inFrame(CAMP, -2.5, -11);
      const banner = cloth(1.5, 0.9, 10, '#9e2a20');
      banner.position.set(x, padById('camp').h + 6.95, z);
      banner.rotation.y = CAMP.rot;
      root.add(banner);
      rags.push(banner);
    }
    // boards: 雪岭 on the gate, 雪岭之巅 on the stele
    {
      const [bx, bz] = inFrame(GATE, 0, 0.4);
      const t = textTex('雪岭', false, '#e2b75a', '#1d1612');
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.0), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.6, roughness: 0.8 }));
      m.position.set(bx, padById('gate').h + 5.2, bz);
      m.rotation.y = GATE.rot;
      root.add(m);
      const back = m.clone();
      const [cx, cz] = inFrame(GATE, 0, -0.4);
      back.position.set(cx, padById('gate').h + 5.2, cz);
      back.rotation.y = GATE.rot + Math.PI;
      root.add(back);
      const st = textTex('雪岭之巅', true, '#3a332b', null);
      const [sx, sz] = STELE_AT;
      const sm = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 2.1), new THREE.MeshStandardMaterial({ map: st, transparent: true, roughness: 0.9 }));
      const fx = Math.sin(0.4), fz = Math.cos(0.4);
      sm.position.set(sx + fx * 0.17, groundHeight(sx, sz) + 1.4, sz + fz * 0.17);
      sm.rotation.y = 0.4;
      root.add(sm);
      const camp = textTex('雪岭营', true, '#e8d9b0', null);
      const cm = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.3), new THREE.MeshStandardMaterial({ map: camp, transparent: true, side: THREE.DoubleSide, roughness: 0.9 }));
      cm.position.set(0.72, -0.5, 0.01);
      (rags[rags.length - 1] as THREE.Mesh).add(cm);
    }
    // the ice: the crown of shards over the cave mouth, icicles, the frozen fall beside it, crystals in the canyon
    const ice = iceMat();
    const cg = new THREE.Group();
    for (let k = 0; k < 13; k++) {
      const h = 1.8 + ((k * 37) % 7) * 0.5;
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.36 + (k % 3) * 0.13, h, 5), ice);
      const a = -1.3 + (k / 12) * 2.6;
      m.position.set(Math.sin(a) * 3.4, 4.3 + Math.cos(a) * 0.9 + h * 0.3, -0.4 + (k % 2) * 0.4);
      m.rotation.set(k % 2 ? 0.2 : -0.15, 0, -a * 0.5);
      cg.add(m);
    }
    for (let k = 0; k < 9; k++) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.1 + (k % 2) * 0.05, 0.8 + (k % 3) * 0.45, 5), ice);
      m.position.set(-1.9 + k * 0.48, 3.25 - (k % 3) * 0.2, -0.65);
      m.rotation.x = Math.PI;
      cg.add(m);
    }
    // the frozen fall: a sheet of columns down the cliff to the cave's right
    {
      const fallX = 7.2;
      let topZ = -1, topY = 0;
      for (let lz = -1; lz > -16; lz -= 0.5) {
        const [wx, wz] = inFrame(CAVE, fallX, lz);
        const y = groundHeight(wx, wz) - padById('cave').h;
        if (y > topY + 0.4) {
          topY = y;
          topZ = lz;
        }
      }
      const H = Math.max(4, Math.min(16, topY));
      for (let k = 0; k < 9; k++) {
        const w = 0.3 + hash(k, 5) * 0.35, hh = H * (0.65 + hash(k, 6) * 0.4);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.55, w, hh, 6), ice);
        m.position.set(fallX - 1.6 + k * 0.4, hh / 2 - 0.3, Math.min(-0.5, topZ * 0.35) - hash(k, 7) * 0.5);
        m.rotation.x = 0.12;
        cg.add(m);
      }
      for (let k = 0; k < 7; k++) {
        const m = new THREE.Mesh(new THREE.ConeGeometry(0.5 + hash(k, 8) * 0.4, 1 + hash(k, 9), 6), ice);
        m.position.set(fallX - 1.4 + k * 0.48, 0.3, 0.2 + hash(k, 10) * 0.6);
        cg.add(m);
      }
    }
    cg.position.set(CAVE.x, padById('cave').h, CAVE.z);
    cg.rotation.y = CAVE.rot;
    root.add(cg);
    // crystals at the canyon walls' feet (both sides), leaning out of the snow
    {
      const geo = new THREE.ConeGeometry(0.22, 1, 5).translate(0, 0.5, 0);
      const list: THREE.Matrix4[] = [];
      for (let i = GATE_AT; i < GATE_AT + 5; i++) {
        const a = SNOW_ROAD[i], c = SNOW_ROAD[i + 1];
        const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
        const sx = (c[1] - a[1]) / L, sz = -(c[0] - a[0]) / L;
        for (let s = 3; s < L - 3; s += 3.2)
          for (const side of [-1, 1]) {
            if (hash(s + i * 7, side) < 0.45) continue;
            const u = s / L, off = 7.6 + hash(s, side * 3) * 1.2;
            const x = a[0] + (c[0] - a[0]) * u + sx * side * off, z = a[1] + (c[1] - a[1]) * u + sz * side * off;
            const y = groundHeight(x, z);
            for (let n = 0; n < 4; n++) {
              const hh = 0.6 + hash(x + n, z) * 1.6;
              e.set((hash(n, x) - 0.5) * 0.9 - side * 0.25, hash(z, n) * 6.28, (hash(x, n) - 0.5) * 0.9);
              q.setFromEuler(e);
              list.push(m4.clone().compose(pv.set(x + (hash(n, 1) - 0.5) * 0.8, y - 0.1, z + (hash(n, 2) - 0.5) * 0.8), q, sc.set(1 + hash(n, 3), hh, 1 + hash(n, 4))));
            }
          }
      }
      const im = new THREE.InstancedMesh(geo, ice, list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      root.add(im);
    }
    // boulders: talus fallen to the feet of the cliffs round the basin and up the canyon, a few out on the snow
    {
      const list: THREE.Matrix4[] = [];
      const cols: THREE.Color[] = [];
      for (let k = 0; k < 6000 && list.length < 420; k++) {
        const x = -905 + hash(k, 1.3) * 430, z = -905 + hash(k * 1.7, 4.1) * 365;
        const L = snowLand(x, z, 0);
        const foot = L.open > -3 && L.open < 9;
        if (!foot && !(L.open < -3 && hash(x, z) < 0.05)) continue;
        if (snowTrailDist(x, z) < 6.5 || onSnowPad(x, z, 3) || slopeAt(x, z) > 1.1) continue;
        if (SNOW_PARTS.some((q) => Math.hypot(q.x - x, q.z - z) < Math.max(q.hx, q.hz) + 2)) continue;
        const r = foot ? 0.45 + hash(z, x) * 1.3 : 0.3 + hash(z, x) * 0.5;
        e.set((hash(x, 3) - 0.5) * 0.6, hash(z, 4) * 6.28, (hash(x, 5) - 0.5) * 0.6);
        q.setFromEuler(e);
        list.push(m4.clone().compose(pv.set(x, groundHeight(x, z) - r * 0.28, z), q, sc.set(r * (0.9 + hash(x, 6) * 0.5), r * 0.8, r * (0.9 + hash(z, 7) * 0.5))));
        const g = 0.34 + hash(x, z) * 0.14;
        cols.push(new THREE.Color(g, g * 0.98, g * 0.95));
      }
      const im = new THREE.InstancedMesh(rockGeo(1, 13, 0.85), withSnow(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 })), list.length);
      list.forEach((m, i) => {
        im.setMatrixAt(i, m);
        im.setColorAt(i, cols[i]);
      });
      im.castShadow = im.receiveShadow = true;
      root.add(im);
    }
    // the frozen lake: clear grey-blue ice with milky cracks, snow blown across it in streaks
    {
      const lakeMat = new THREE.MeshStandardMaterial({ color: '#9fc4d8', roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.94, polygonOffset: true, polygonOffsetFactor: -1 });
      lakeMat.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vLk;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvLk = position.xy;');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec2 vLk;\nfloat lh(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }\nfloat ln(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(lh(i),lh(i+vec2(1,0)),u.x), mix(lh(i+vec2(0,1)),lh(i+vec2(1,1)),u.x), u.y); }')
          .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
float r = length(vLk);
float crack = smoothstep(0.93, 1.0, abs(sin(vLk.x * 0.9 + sin(vLk.y * 0.6) * 2.0) * cos(vLk.y * 0.75 - vLk.x * 0.3)));
crack = max(crack, smoothstep(0.95, 1.0, abs(sin(atan(vLk.y, vLk.x) * 7.0 + r * 0.4))) * smoothstep(2.0, 6.0, r) * 0.7);
float streak = smoothstep(0.55, 0.85, ln(vec2(vLk.x * 0.18 + vLk.y * 0.05, vLk.y * 0.9)));
vec3 c = mix(vec3(0.42, 0.58, 0.68), vec3(0.62, 0.76, 0.84), ln(vLk * 0.15));
c = mix(c, vec3(0.86, 0.92, 0.96), crack * 0.7);
c = mix(c, vec3(0.92, 0.94, 0.97), clamp(streak * 0.65 + smoothstep(${(LAKE.r - 3.5).toFixed(1)}, ${(LAKE.r - 0.5).toFixed(1)}, r + (ln(vLk * 0.4) - 0.5) * 2.0), 0.0, 1.0));
diffuseColor.rgb = c;`,
          );
      };
      const disc = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r - 0.4, 64), lakeMat);
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(LAKE.x, LAKE.h + 0.035, LAKE.z);
      disc.receiveShadow = true;
      root.add(disc);
    }
    // flames: a few additive cones per fire, flickered each frame
    const flameMat = new THREE.MeshBasicMaterial({ color: '#ff9a3c', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const coreMat = new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const flames = SNOW_FIRES.map(([fx, fz], i) => {
      const g = new THREE.Group();
      for (let k = 0; k < 5; k++) {
        const m = new THREE.Mesh(new THREE.ConeGeometry(0.22 - k * 0.02, 0.9 - k * 0.08, 7, 1, true), k < 2 ? coreMat : flameMat);
        m.position.set(Math.cos(k * 1.3) * 0.15, 0.4, Math.sin(k * 1.3) * 0.15);
        g.add(m);
      }
      // a shelter's fire sits under its slab, a little out from the rock
      const sp = i === 1 || i === 2 ? padById(i === 1 ? 'shelterE' : 'shelterW') : null;
      const [x, z] = sp ? inFrame({ x: sp.x, z: sp.z, rot: shelterRot(sp) }, 0, 0.4) : [fx, fz];
      g.position.set(x, groundHeight(x, z) + 0.05, z);
      root.add(g);
      return g;
    });
    // the lotus: white petals round a gold heart, a soft glow
    const petal = new THREE.MeshStandardMaterial({ color: '#f8fbff', emissive: '#cfe6ff', emissiveIntensity: 0.6, roughness: 0.5, side: THREE.DoubleSide });
    const heart = new THREE.MeshStandardMaterial({ color: '#ffe08a', emissive: '#ffb347', emissiveIntensity: 0.8 });
    const glowTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const x = c.getContext('2d')!;
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    const lotus = LOTUS.map(([lx, lz]) => {
      const g = new THREE.Group();
      for (let ring = 0; ring < 2; ring++)
        for (let k = 0; k < 8; k++) {
          const p = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6).scale(0.55, 0.18, 1.3).translate(0, 0, 0.13), petal);
          p.rotation.set(-0.5 - ring * 0.45, (k / 8) * Math.PI * 2 + ring * 0.4, 0, 'YXZ');
          p.position.y = 0.12 + ring * 0.03;
          g.add(p);
        }
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), heart);
      h.position.y = 0.16;
      g.add(h);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#cfe6ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
      s.scale.setScalar(1.4);
      s.position.y = 0.25;
      g.add(s);
      g.position.set(lx, groundHeight(lx, lz), lz);
      root.add(g);
      return g;
    });
    // 夜光雪莲: a bigger flower lit from inside, a halo and a faint column of light you can see from far off at night
    const glow = (() => {
      const g = new THREE.Group();
      const pet = new THREE.MeshStandardMaterial({ color: '#eaf6ff', emissive: '#9fd4ff', emissiveIntensity: 1.6, roughness: 0.4, side: THREE.DoubleSide, toneMapped: false });
      for (let ring = 0; ring < 3; ring++)
        for (let k = 0; k < 9; k++) {
          const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6).scale(0.55, 0.18, 1.4).translate(0, 0, 0.18), pet);
          m.rotation.set(-0.35 - ring * 0.42, (k / 9) * Math.PI * 2 + ring * 0.35, 0, 'YXZ');
          m.position.y = 0.14 + ring * 0.05;
          g.add(m);
        }
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff7d6', toneMapped: false }));
      core.position.y = 0.22;
      g.add(core);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#a8dcff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
      halo.scale.setScalar(3.2);
      halo.position.y = 0.4;
      g.add(halo);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.6, 26, 12, 1, true).translate(0, 13, 0), new THREE.MeshBasicMaterial({ color: '#9fd4ff', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
      g.add(beam);
      const light = new THREE.PointLight('#bfe3ff', 6, 14, 2);
      light.position.y = 0.8;
      g.add(light);
      g.visible = false;
      root.add(g);
      return g;
    })();
    // prayer flags on a line from the summit pole down to a stake
    const [sx, sz] = SUMMIT, sy = groundHeight(sx, sz);
    const flags: THREE.Mesh[] = [];
    const cols = ['#2563eb', '#f8fafc', '#dc2626', '#16a34a', '#facc15'];
    const end = new THREE.Vector3(sx + 5, groundHeight(sx + 5, sz + 2) + 0.6, sz + 2);
    const top = new THREE.Vector3(sx, sy + 4.1, sz);
    for (let k = 0; k < 10; k++) {
      const u = (k + 0.5) / 10, p = top.clone().lerp(end, u);
      p.y -= Math.sin(Math.PI * u) * 0.5;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.42).translate(0, -0.21, 0), new THREE.MeshStandardMaterial({ color: cols[k % 5], side: THREE.DoubleSide, roughness: 0.9 }));
      m.position.copy(p);
      m.rotation.y = Math.atan2(end.x - top.x, end.z - top.z) + Math.PI / 2;
      root.add(m);
      flags.push(m);
    }
    // the rope along the summit path's open side, sagging between its posts
    {
      const pts: THREE.Vector3[] = [];
      const P = SUMMIT_PATH;
      for (let i = 1; i < P.length; i++) {
        const a = P[i - 1], c = P[i];
        const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
        const ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L;
        const mx = (a[0] + c[0]) / 2 - SUMMIT_TOP[0], mz = (a[1] + c[1]) / 2 - SUMMIT_TOP[1];
        if (Math.hypot(mx, mz) <= 10) continue;
        const side = uz * mx - ux * mz > 0 ? 1 : -1;
        const n = Math.max(1, Math.round(L / 3.5));
        for (let k = 0; k < n; k++) {
          for (let j = 0; j < 4; j++) {
            const u = (k + j / 4) / n;
            const x = a[0] + (c[0] - a[0]) * u + uz * side * 2.2, z = a[1] + (c[1] - a[1]) * u - ux * side * 2.2;
            pts.push(new THREE.Vector3(x, groundHeight(x, z) + 1.05 - Math.sin(Math.PI * (j / 4)) * 0.18, z));
          }
        }
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      root.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#6b4a2e' })));
    }
    // snow drifting round you on the heights, and spindrift blowing low across the snow
    const N = 900;
    const pos = new Float32Array(N * 3);
    for (let k = 0; k < N; k++) pos.set([(Math.random() - 0.5) * 40, Math.random() * 18, (Math.random() - 0.5) * 40], k * 3);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const flakes = new THREE.Points(sg, new THREE.PointsMaterial({ map: glowTex, color: '#ffffff', size: 0.16, transparent: true, depthWrite: false, opacity: 0 }));
    flakes.frustumCulled = false;
    root.add(flakes);
    const DN = 700;
    const dpos = new Float32Array(DN * 3);
    for (let k = 0; k < DN; k++) dpos.set([(Math.random() - 0.5) * 50, Math.random() * 1.6, (Math.random() - 0.5) * 50], k * 3);
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    const drift = new THREE.Points(dg, new THREE.PointsMaterial({ map: glowTex, color: '#f4f8ff', size: 0.34, transparent: true, depthWrite: false, opacity: 0 }));
    drift.frustumCulled = false;
    root.add(drift);
    const postParts = postsB.build();
    return { parts, postParts, root, flames, lotus, glow, flags, flakes, pos, drift, dpos, rags };
  }, []);
  const light = useRef<THREE.PointLight>(null);
  const built = useRef<THREE.Group>(null);
  const tick = useRef(0);
  const windT = useRef(0);
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime, p = sim.player.pos;
    const out = sim.indoor < 0;
    // near the mountain at all (its box and a margin round it)
    const near = out && p[0] > SNOW_BOX.x0 - 250 && p[0] < SNOW_BOX.x1 + 250 && p[2] > SNOW_BOX.z0 - 250 && p[2] < SNOW_BOX.z1 + 250;
    S.root.visible = near;
    if (built.current) built.current.visible = near;
    // the wind: a blizzard's howl up on the snow (and in the ice cave), thin high wind round the summit, the woods elsewhere
    if ((windT.current -= dt) <= 0) {
      windT.current = 0.5;
      const room = sim.indoor >= 0 ? ROOMS[sim.indoor] : null;
      ambience(room ? (room.realm === 'icecave' ? 'glacier' : 'forest') : near && Math.hypot(p[0] - SUMMIT_TOP[0], p[2] - SUMMIT_TOP[1]) < 45 && p[1] > SUMMIT_H - 30 ? 'summit' : near && onSnow(p[1]) ? 'glacier' : 'forest');
    }
    if (!near) return;
    // flicker
    S.flames.forEach((g, i) => {
      g.children.forEach((m, k) => {
        m.scale.set(1 + Math.sin(t * 13 + k * 2 + i) * 0.12, 1 + Math.sin(t * 9 + k * 3.1 + i) * 0.25, 1);
        m.rotation.y = t * (1 + k * 0.3);
      });
    });
    // the real light sits on the fire nearest you
    let best = 0, bd = 1e9;
    S.flames.forEach((g, i) => {
      const d = Math.hypot(g.position.x - p[0], g.position.z - p[2]);
      if (d < bd) (bd = d), (best = i);
    });
    if (light.current) {
      const g = S.flames[best];
      light.current.position.set(g.position.x, g.position.y + 1.2, g.position.z);
      light.current.intensity = bd < 60 ? 9 + Math.sin(t * 11) * 1.5 + Math.sin(t * 23) * 0.8 : 0;
    }
    // the lotus that have been picked are gone till they grow back
    if ((tick.current -= dt) <= 0) {
      tick.current = 0.5;
      S.lotus.forEach((g, i) => (g.visible = sim.snow.lotusBack[i] <= sim.worldT));
      const gl = glowLotusNow(sim);
      S.glow.visible = gl >= 0;
      if (gl >= 0) {
        const [gx, gz] = GLOW_LOTUS[gl];
        S.glow.position.set(gx, groundHeight(gx, gz), gz);
      }
    }
    S.lotus.forEach((g, i) => (g.rotation.y = Math.sin(t * 0.7 + i) * 0.2));
    if (S.glow.visible) {
      S.glow.rotation.y = t * 0.3;
      (S.glow.children[S.glow.children.length - 3] as THREE.Sprite).material.opacity = 0.7 + Math.sin(t * 2.2) * 0.2;
    }
    S.flags.forEach((m, k) => (m.rotation.x = Math.sin(t * 6 + k * 0.8) * 0.45));
    // the rags and the banner, only the ones near you
    S.rags.forEach((m, k) => {
      if (Math.abs(m.position.x - p[0]) + Math.abs(m.position.z - p[2]) < 90) flap(m, t, k, 0.16);
    });
    // flakes: drift down round the player while they're up on the snow; spindrift streams low past them
    const up = onSnow(p[1] + 6) ? Math.min(1, (p[1] - (SNOW_Y - 20)) / 15) : 0;
    const fm = S.flakes.material as THREE.PointsMaterial;
    fm.opacity += (up * 0.85 - fm.opacity) * Math.min(1, dt * 2);
    S.flakes.visible = fm.opacity > 0.02;
    if (S.flakes.visible) {
      S.flakes.position.set(p[0], p[1] - 4, p[2]);
      const a = S.pos;
      for (let k = 0; k < a.length; k += 3) {
        a[k + 1] -= dt * (1.1 + (k % 7) * 0.08);
        a[k] += Math.sin(t * 0.8 + k) * dt * 0.4 + dt * 0.6;
        if (a[k + 1] < 0) (a[k + 1] += 18), (a[k] = (Math.random() - 0.5) * 40), (a[k + 2] = (Math.random() - 0.5) * 40);
        if (a[k] > 20) a[k] -= 40;
      }
      S.flakes.geometry.attributes.position.needsUpdate = true;
    }
    const high = p[1] > SNOW_Y + 15 ? Math.min(1, (p[1] - SNOW_Y - 15) / 10) : 0;
    const dm = S.drift.material as THREE.PointsMaterial;
    dm.opacity += (high * 0.5 * (0.6 + 0.4 * Math.sin(t * 0.37)) - dm.opacity) * Math.min(1, dt * 1.5);
    S.drift.visible = dm.opacity > 0.02;
    if (S.drift.visible) {
      S.drift.position.set(p[0], 0, p[2]);
      const a = S.dpos;
      for (let k = 0; k < a.length; k += 3) {
        a[k] += dt * (7 + (k % 5) * 1.3);
        a[k + 2] += dt * (2.2 + Math.sin(t + k) * 0.8);
        if (a[k] > 25) {
          a[k] -= 50;
          a[k + 2] = (Math.random() - 0.5) * 50;
        }
        if (a[k + 2] > 25) a[k + 2] -= 50;
        a[k + 1] = groundHeight(p[0] + a[k], p[2] + a[k + 2]) + 0.15 + ((k * 0.37) % 1) * 1.1;
      }
      S.drift.geometry.attributes.position.needsUpdate = true;
    }
  });
  return (
    <>
      <group ref={built}>
        <Built parts={S.parts} />
        <Built parts={S.postParts} />
      </group>
      <primitive object={S.root} />
      <pointLight ref={light} color="#ff9a4a" intensity={0} distance={16} decay={1.4} />
    </>
  );
}

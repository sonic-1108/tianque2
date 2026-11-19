// 画眉 (the thrush you buy at the bird stall): a small songbird made in code, not blocks. A plump body and head with a
// feather-scale texture, the hwamei's white eye ring running back as a brow, a horn bill that opens when it sings,
// legs that tuck up in flight; each wing is a skeleton (shoulder, elbow, wrist, tip) carrying ~37 textured feathers
// (primaries, secondaries, tertials, coverts) rebuilt on the CPU every frame, so the wing folds along the body when
// it perches and spreads, sweeps and twists through each stroke in flight; the tail is a fan of ten graduated
// feathers that spreads to brake and flicks when it lands.
// It lives on your right shoulder while you stand or stroll, looking about in quick head snaps, flicking its tail,
// preening, singing; at night it sleeps there, fluffed up with its head tucked. When you run, fight, jump, swim or
// ride it takes off and flies round you in bounding bursts (flaps, then a glide or a brief fold), banking into its
// turns, and comes back to land with a flare of wings and tail.
import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Sim } from '../game/sim';
import { bag } from '../game/play';
import { groundHeight } from '../game/world';
import { WATER_U } from './season';

// ---------------------------------------------------------------- textures
function featherAtlas() {
  const W = 512, H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, W, H);
  // one feather in a 128 x 256 cell, base at the bottom: an asymmetric vane round a pale shaft, barbs, bars
  const feather = (ox: number, o: { outer: number; inner: number; len: number; base: string; mid: string; edge: string; bars: number; barCol: string; tip: string; round?: boolean }) => {
    const cx = ox + 4 + o.outer, y0 = 250, y1 = 250 - o.len;
    g.save();
    g.beginPath();
    g.moveTo(cx, y0);
    // outer vane (left), narrow; inner vane (right), broad; the tip rounded or pointed
    g.bezierCurveTo(cx - o.outer * 0.8, y0 - o.len * 0.15, cx - o.outer, y0 - o.len * 0.6, cx - o.outer * (o.round ? 0.9 : 0.55), y1 + o.len * 0.08);
    g.quadraticCurveTo(cx, y1 - (o.round ? 6 : 2), cx + o.inner * (o.round ? 0.9 : 0.6), y1 + o.len * 0.1);
    g.bezierCurveTo(cx + o.inner, y0 - o.len * 0.55, cx + o.inner * 0.85, y0 - o.len * 0.15, cx, y0);
    g.closePath();
    g.clip();
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, o.base);
    gr.addColorStop(0.45, o.mid);
    gr.addColorStop(0.92, o.mid);
    gr.addColorStop(1, o.tip);
    g.fillStyle = gr;
    g.fillRect(ox, 0, 128, H);
    // the outer vane's lighter edge
    const ge = g.createLinearGradient(cx - o.outer, 0, cx, 0);
    ge.addColorStop(0, o.edge);
    ge.addColorStop(0.7, 'rgba(0,0,0,0)');
    g.fillStyle = ge;
    g.fillRect(ox, 0, 64, H);
    // bars across the vane
    for (let k = 1; k <= o.bars; k++) {
      const y = y0 - (o.len * k) / (o.bars + 1);
      g.fillStyle = o.barCol;
      g.beginPath();
      g.ellipse(cx, y, o.inner + 4, o.len * 0.018, -0.12, 0, Math.PI * 2);
      g.fill();
    }
    // barbs: fine slanted lines, a little lighter and darker
    g.lineWidth = 0.9;
    for (let y = y0; y > y1; y -= 3) {
      g.strokeStyle = `rgba(255,240,210,${0.05 + Math.random() * 0.06})`;
      g.beginPath();
      g.moveTo(cx, y);
      g.lineTo(cx - o.outer - 6, y - o.outer * 0.6);
      g.stroke();
      g.strokeStyle = `rgba(20,10,0,${0.06 + Math.random() * 0.08})`;
      g.beginPath();
      g.moveTo(cx, y);
      g.lineTo(cx + o.inner + 6, y - o.inner * 0.6);
      g.stroke();
    }
    g.restore();
    // the shaft
    g.strokeStyle = 'rgba(214,196,160,0.85)';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(cx, y0);
    g.quadraticCurveTo(cx - 1.5, (y0 + y1) / 2, cx - 0.5, y1 + 6);
    g.stroke();
  };
  // flight feather: olive brown, the outer web edged warm rufous, faint bars, a dusky tip
  feather(0, { outer: 40, inner: 82, len: 240, base: '#4a3423', mid: '#5c3e24', edge: '#a8703a', bars: 7, barCol: 'rgba(30,18,8,0.16)', tip: '#3a2818' });
  // tail feather: warmer, clearly barred dark across, a dark tip
  feather(128, { outer: 58, inner: 62, len: 244, base: '#5a3c22', mid: '#7a5130', edge: '#966236', bars: 10, barCol: 'rgba(28,16,6,0.34)', tip: '#2e1e10' });
  // covert: short, round, the body's rufous brown with a paler fringe
  feather(256, { outer: 58, inner: 62, len: 200, base: '#5e4128', mid: '#80582f', edge: '#a77a45', bars: 0, barCol: 'rgba(0,0,0,0)', tip: '#9a7040', round: true });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
/** small overlapping feather tips, tiled over body and head (multiplies the vertex colours) */
function scaleTex() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#cfcfcf';
  g.fillRect(0, 0, S, S);
  const rows = 10, cols = 8, w = S / cols, h = S / rows;
  for (let r = 0; r <= rows; r++)
    for (let k = -1; k <= cols; k++) {
      const x = (k + (r % 2) * 0.5) * w, y = r * h;
      const gr = g.createRadialGradient(x, y - h * 0.2, 1, x, y, w * 0.75);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.7, '#e2e2e2');
      gr.addColorStop(1, '#9a9a9a');
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(x, y, w * 0.62, h * 0.95, 0, 0, Math.PI);
      g.fill();
      // the shaft line down each
      g.strokeStyle = 'rgba(90,90,90,0.25)';
      g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y + h * 0.8);
      g.stroke();
    }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// ---------------------------------------------------------------- the body (with the head on its own pivot)
const C = {
  back: new THREE.Color('#7d6038'),
  side: new THREE.Color('#9a6b38'),
  belly: new THREE.Color('#d39a55'),
  vent: new THREE.Color('#a88a66'),
  crown: new THREE.Color('#6e5230'),
  face: new THREE.Color('#87633a'),
  throat: new THREE.Color('#c38e4e'),
};
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** a body of rings along x: rump to neck, deep chest, a belly that sags a little */
function bodyGeo() {
  const N = 24, M = 22, x0 = -0.078, x1 = 0.08;
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
  const prof = (t: number) => {
    // radius: a narrow rump, the widest at the chest, easing into the neck
    const r = 0.008 + 0.031 * Math.sin(Math.PI * Math.pow(t, 0.8)) ** 0.75;
    return t > 0.9 ? r * (1 - (t - 0.9) * 2.2) + 0.022 * (t - 0.9) * 2.2 : r;
  };
  const cy = (t: number) => -0.006 * Math.sin(Math.PI * t) + 0.012 * smooth(0.75, 1, t) - 0.004 * (1 - t);
  const v = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i <= N; i++) {
    const t = i / N, x = x0 + (x1 - x0) * t, r = prof(t);
    for (let j = 0; j <= M; j++) {
      const a = (j / M) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      // flatter back, fuller belly
      const ry = r * (sa > 0 ? 0.9 : 1.12), rz = r * 0.95;
      v.set(x, cy(t) + sa * ry, ca * rz);
      // normal from the ellipse (and the profile's slope)
      const dr = (prof(Math.min(1, t + 0.01)) - prof(Math.max(0, t - 0.01))) / (((x1 - x0) * 0.02) || 1);
      n.set(-dr, sa / (ry || 1e-4), ca / (rz || 1e-4)).normalize();
      pos.push(v.x, v.y, v.z);
      nor.push(n.x, n.y, n.z);
      uv.push(t * 3, (j / M) * 4);
      // back brown on top, rufous buff below, the vent greyer
      c.copy(C.side).lerp(C.back, smooth(-0.1, 0.7, sa)).lerp(C.belly, smooth(-0.15, -0.8, sa) * smooth(0.12, 0.45, t));
      c.lerp(C.vent, smooth(-0.3, -0.9, sa) * (1 - smooth(0.05, 0.3, t)));
      c.lerp(C.throat, smooth(-0.2, -0.8, sa) * smooth(0.8, 1, t));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < N; i++)
    for (let j = 0; j < M; j++) {
      const a = i * (M + 1) + j, b = a + M + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}
/** the head round its own centre: crown streaked darker, face brown, throat buff */
function headGeo() {
  const g = new THREE.SphereGeometry(0.0245, 26, 20);
  g.scale(1.14, 0.98, 1);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const col: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // the forehead runs down to the bill, the crown is a little flat
    if (y > 0.011) p.setY(i, 0.011 + (y - 0.011) * 0.85);
    const up = y / 0.0245;
    c.copy(C.face).lerp(C.crown, smooth(0.2, 0.8, up)).lerp(C.throat, smooth(-0.2, -0.8, up) * smooth(-0.01, 0.02, x));
    // fine dark streaks on the crown
    const streak = up > 0.3 ? 0.82 + 0.18 * Math.abs(Math.sin(z * 900 + x * 300)) : 1;
    c.multiplyScalar(streak);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- the wing: a skeleton and its feathers
type Feather = { seg: 0 | 1 | 2; u: number; L: number; w: number; a: number; af: number; layer: number; tex: 0 | 1 | 2; curl: number; drop?: number };
const FEATHERS: Feather[] = (() => {
  const out: Feather[] = [];
  // primaries (hand, wrist to tip): fanning out, the outermost longest pointing out along the span
  for (let k = 0; k < 9; k++) {
    const u = k / 8;
    out.push({ seg: 2, u: 0.05 + u * 0.95, L: 0.07 + u * 0.024 - (k === 8 ? 0.012 : 0), w: 0.017, a: 0.15 + u * 1.05, af: 0.02 + u * 0.06, layer: 0 + (8 - k) * 0.12, tex: 0, curl: 0.25, drop: 0.012 - u * 0.004 });
  }
  // secondaries (forearm, elbow to wrist): straight back
  for (let k = 0; k < 8; k++) {
    const u = k / 7;
    out.push({ seg: 1, u: 0.04 + u * 0.92, L: 0.062 - u * 0.004, w: 0.018, a: 0.06 + u * 0.1, af: -0.05 + u * 0.05, layer: 1 + k * 0.1, tex: 0, curl: 0.1, drop: 0.009 });
  }
  // tertials, by the body
  for (let k = 0; k < 2; k++) out.push({ seg: 0, u: 0.75 + k * 0.2, L: 0.055, w: 0.02, a: -0.12 + k * 0.08, af: -0.1, layer: 2.2 + k * 0.2, tex: 0, curl: 0.05 });
  // greater coverts over the secondaries' roots, primary coverts on the hand, lesser coverts along the leading edge
  for (let k = 0; k < 8; k++) out.push({ seg: 1, u: 0.02 + (k / 7) * 0.94, L: 0.032, w: 0.017, a: 0.08 + (k / 7) * 0.1, af: -0.04, layer: 3 + k * 0.05, tex: 2, curl: 0.05, drop: 0.003 });
  for (let k = 0; k < 4; k++) out.push({ seg: 2, u: 0.02 + (k / 3) * 0.32, L: 0.03, w: 0.015, a: 0.2 + k * 0.12, af: 0.04, layer: 3.4 + k * 0.05, tex: 2, curl: 0.05 });
  for (let k = 0; k < 7; k++) {
    const u = k / 6;
    out.push({ seg: u < 0.5 ? 0 : 1, u: u < 0.5 ? 0.3 + u * 1.3 : (u - 0.5) * 1.8, L: 0.022, w: 0.02, a: 0.1, af: -0.05, layer: 4 + k * 0.05, tex: 2, curl: 0.02 });
  }
  return out;
})();
const ROWS = 3; // each feather: base, middle, tip (so it can curve)
const UVX = [
  [0.0, 0.25],
  [0.25, 0.5],
  [0.5, 0.75],
];
function featherGeo(n: number, mirror = false) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * ROWS * 2 * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * ROWS * 2 * 3), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * ROWS * 2 * 2), 2));
  const idx: number[] = [];
  for (let f = 0; f < n; f++)
    for (let r = 0; r < ROWS - 1; r++) {
      const a = f * ROWS * 2 + r * 2;
      if (mirror) idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      else idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  g.setIndex(idx);
  return g;
}
const V = () => new THREE.Vector3();
const tmp = { S: V(), E: V(), W: V(), T: V(), n: V(), d: V(), side: V(), b: V(), p: V(), q: V(), back: V(), fold: V(), ax: V() };
// the right wing's joints spread and folded (bird space: +x forward, +y up, +z right); the left mirrors in z
const SH = new THREE.Vector3(0.026, 0.024, 0.026);
const SPREAD = [new THREE.Vector3(-0.004, 0.002, 0.04), new THREE.Vector3(0.01, 0, 0.042), new THREE.Vector3(-0.012, 0, 0.042)];
const FOLDED = [new THREE.Vector3(-0.028, -0.006, 0.012), new THREE.Vector3(0.02, 0.003, 0.002), new THREE.Vector3(-0.05, -0.006, -0.002)];
export interface WingPose {
  /** up (+) and down (-) about the body's long axis, radians */
  flap: number;
  /** 0 spread .. 1 folded on the body */
  fold: number;
  /** swept back (+) or reached forward (-), radians about the vertical */
  sweep: number;
  /** the hand pitched (leading edge down +) */
  twist: number;
  /** how much the flight feathers bend up under the stroke */
  bend: number;
}
/** lay out one wing's feathers for a pose; s = 1 right, -1 left */
function layWing(geo: THREE.BufferGeometry, s: 1 | -1, P: WingPose) {
  const { S, E, W, T, n, d, side, b, p, back, fold } = tmp;
  const f = P.fold;
  S.copy(SH);
  // joints: spread and folded blended (the hand's fold lags the arm's, so it folds in a Z)
  const fh = smooth(0.15, 1, f);
  E.copy(SPREAD[0]).lerp(FOLDED[0], f).add(S);
  W.copy(SPREAD[1]).lerp(FOLDED[1], f).add(E);
  T.copy(SPREAD[2]).lerp(FOLDED[2], fh).add(W);
  // sweep about the vertical, then flap about the long axis, both through the shoulder
  const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(-P.flap * (1 - f * 0.9), -P.sweep * (1 - f), 0, 'XYZ'));
  for (const J of [E, W, T]) J.sub(S).applyQuaternion(rot).add(S);
  // the wing's surface: up when spread, facing out against the body when folded
  n.set(0, 1, 0).lerp(new THREE.Vector3(0, 0.42, 1).normalize(), f).normalize().applyQuaternion(rot);
  back.set(-1, 0, 0).applyQuaternion(rot);
  fold.set(-1, -0.18, 0).normalize();
  const pos = geo.getAttribute('position') as THREE.BufferAttribute, nor = geo.getAttribute('normal') as THREE.BufferAttribute, uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  const twist = new THREE.Quaternion();
  FEATHERS.forEach((F, i) => {
    const A = F.seg === 0 ? S : F.seg === 1 ? E : W, B = F.seg === 0 ? E : F.seg === 1 ? W : T;
    b.copy(A).lerp(B, F.u);
    b.y -= (F.drop ?? 0) * f;
    // its direction: back along the chord and fanned out toward the tip when spread, back along the body when folded
    const span = p.copy(B).sub(A).normalize();
    d.copy(back).multiplyScalar(Math.cos(F.a)).addScaledVector(span, Math.sin(F.a));
    const df = tmp.q.copy(fold).applyAxisAngle(new THREE.Vector3(0, 1, 0), F.af);
    d.lerp(df, f).normalize();
    // the hand's feathers pitch with the twist
    if (F.seg === 2 && Math.abs(P.twist) > 1e-3) d.applyQuaternion(twist.setFromAxisAngle(span, P.twist * (1 - f)));
    // keep it in the surface
    const nn = tmp.ax.copy(n);
    d.addScaledVector(nn, -d.dot(nn)).normalize();
    side.crossVectors(nn, d).normalize();
    const lay = 0.0011 * F.layer;
    const L = F.L * (1 - f * 0.08);
    const u0 = UVX[F.tex][0], u1 = UVX[F.tex][1], vTop = F.tex === 2 ? 200 / 256 : 1;
    for (let r = 0; r < ROWS; r++) {
      const t = r / (ROWS - 1);
      // bends up (out of the surface) toward the tip under the stroke, and a natural curl
      const up = (P.bend * (1 - f) * (F.seg === 2 ? 1 : 0.45) + F.curl * 0.15) * t * t * L;
      const w = F.w * (0.9 - t * 0.15);
      const k = (i * ROWS + r) * 2;
      for (let e = 0; e < 2; e++) {
        const sgn = e === 0 ? -1 : 1;
        pos.setXYZ(k + e, b.x + d.x * L * t + side.x * w * 0.5 * sgn + nn.x * (lay + up), b.y + d.y * L * t + side.y * w * 0.5 * sgn + nn.y * (lay + up), (b.z + d.z * L * t + side.z * w * 0.5 * sgn + nn.z * (lay + up)) * s);
        nor.setXYZ(k + e, nn.x, nn.y, nn.z * s);
        uv.setXY(k + e, s > 0 ? (e === 0 ? u0 : u1) : e === 0 ? u1 : u0, 0.02 + t * (vTop - 0.04));
      }
    }
  });
  pos.needsUpdate = true;
  nor.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeBoundingSphere();
}
const TAIL_N = 10;
/** the tail: ten feathers from the rump, the middle pair longest (a rounded, graduated tail) */
function layTail(geo: THREE.BufferGeometry, spread: number, pitch: number, yaw: number) {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute, nor = geo.getAttribute('normal') as THREE.BufferAttribute, uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  const base = new THREE.Vector3(-0.058, 0.004, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < TAIL_N; i++) {
    const m = (i - (TAIL_N - 1) / 2) / ((TAIL_N - 1) / 2); // -1 .. 1 across
    const L = 0.1 - Math.abs(m) * 0.022;
    const a = m * (0.06 + spread * 0.62) + yaw;
    const d = new THREE.Vector3(-Math.cos(a), 0, Math.sin(a)).applyAxisAngle(Z, -pitch);
    // closed, the tail is a dome: each outer feather rolled down about its own shaft (opens flat as it spreads)
    const n = new THREE.Vector3(0, 1, 0).applyAxisAngle(Z, -pitch).applyAxisAngle(d, m * 0.9 * (1 - spread * 0.8));
    const side = new THREE.Vector3().crossVectors(n, d).normalize();
    const lay = (1 - Math.abs(m)) * 0.004; // the middle ones on top
    const b = base.clone().addScaledVector(side, m * 0.006);
    b.y -= Math.abs(m) * 0.004 * (1 - spread * 0.7);
    for (let r = 0; r < ROWS; r++) {
      const t = r / (ROWS - 1);
      const droop = -0.004 * t * t;
      const k = (i * ROWS + r) * 2;
      for (let e = 0; e < 2; e++) {
        const sgn = e === 0 ? -1 : 1, w = 0.019 * (1 - t * 0.12);
        pos.setXYZ(k + e, b.x + d.x * L * t + side.x * w * 0.5 * sgn + n.x * (lay + droop), b.y + d.y * L * t + side.y * w * 0.5 * sgn + n.y * (lay + droop), b.z + d.z * L * t + side.z * w * 0.5 * sgn + n.z * (lay + droop));
        nor.setXYZ(k + e, n.x, n.y, n.z);
        uv.setXY(k + e, e === 0 ? 0.25 : 0.5, 0.02 + t * 0.94);
      }
    }
  }
  pos.needsUpdate = true;
  nor.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeBoundingSphere();
}

export const FEATHER_MAT: { m: THREE.MeshStandardMaterial | null } = { m: null };
export interface ThrushRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Object3D;
  legs: THREE.Group;
  wingR: THREE.BufferGeometry;
  wingL: THREE.BufferGeometry;
  tail: THREE.BufferGeometry;
  fluff: THREE.Object3D;
}
export interface ThrushPose {
  wing: WingPose;
  /** each wing may differ a little (a turn) */
  roll: number;
  tailSpread: number;
  tailPitch: number;
  tailYaw: number;
  headYaw: number;
  headPitch: number;
  headRoll: number;
  /** 0 shut .. 1 open (singing) */
  beak: number;
  /** 1 standing, 0 tucked up in flight */
  legs: number;
  /** 1 normal .. 1.2 fluffed up (asleep, cold) */
  fluff: number;
}
export const restPose = (): ThrushPose => ({ wing: { flap: 0, fold: 1, sweep: 0, twist: 0, bend: 0 }, roll: 0, tailSpread: 0.1, tailPitch: -0.35, tailYaw: 0, headYaw: 0, headPitch: 0, headRoll: 0, beak: 0, legs: 1, fluff: 1 });

export function buildThrush(): ThrushRig {
  const atlas = featherAtlas(), scales = scaleTex();
  const featherMat = new THREE.MeshStandardMaterial({ map: atlas, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, emissive: '#ffffff', emissiveMap: atlas, emissiveIntensity: 0.2 });
  FEATHER_MAT.m = featherMat;
  const bodyMat = new THREE.MeshStandardMaterial({ map: scales, vertexColors: true, roughness: 0.9 });
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const fluff = new THREE.Group();
  body.add(fluff);
  const torso = new THREE.Mesh(bodyGeo(), bodyMat);
  fluff.add(torso);
  // head on the neck's pivot
  const head = new THREE.Group();
  head.position.set(0.07, 0.022, 0);
  body.add(head);
  const skull = new THREE.Mesh(headGeo(), bodyMat);
  skull.position.set(0.018, 0.006, 0);
  head.add(skull);
  const black = new THREE.MeshStandardMaterial({ color: '#0b0806', roughness: 0.12, metalness: 0.1 });
  const white = new THREE.MeshStandardMaterial({ color: '#f1ece2', roughness: 0.7 });
  const horn = new THREE.MeshStandardMaterial({ color: '#d1aa4c', roughness: 0.45 });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0052, 12, 10), black);
    eye.position.set(0.029, 0.011, s * 0.0186);
    head.add(eye);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0062, 0.0017, 6, 18), white);
    ring.position.copy(eye.position).multiplyScalar(0.99);
    ring.lookAt(ring.position.clone().add(new THREE.Vector3(0.25, 0.1, s)));
    head.add(ring);
    // the brow: the ring runs back above the ear as a white stripe (what gives the 画眉 its name)
    const brow = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.03, 0.0175, s * 0.0185),
      new THREE.Vector3(0.019, 0.02, s * 0.0222),
      new THREE.Vector3(0.006, 0.0195, s * 0.0238),
      new THREE.Vector3(-0.006, 0.017, s * 0.0222),
    ]);
    const bm = new THREE.Mesh(new THREE.TubeGeometry(brow, 10, 0.0019, 5), white);
    bm.scale.set(1, 0.75, 1);
    head.add(bm);
  }
  // the bill: upper with a slight hook, the lower opens
  const upper = new THREE.ConeGeometry(0.0058, 0.023, 10).rotateZ(-Math.PI / 2);
  {
    const p = upper.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      p.setY(i, p.getY(i) * (p.getY(i) < 0 ? 0.55 : 1) - Math.max(0, x) * Math.max(0, x) * 6);
    }
    upper.computeVertexNormals();
  }
  const bill = new THREE.Mesh(upper, horn);
  bill.position.set(0.054, 0.0045, 0);
  head.add(bill);
  const jaw = new THREE.Group();
  jaw.position.set(0.044, 0.0015, 0);
  head.add(jaw);
  const lower = new THREE.Mesh(new THREE.ConeGeometry(0.0044, 0.019, 8).rotateZ(-Math.PI / 2).scale(1, 0.55, 1), horn);
  lower.position.set(0.0095, -0.0012, 0);
  jaw.add(lower);
  // legs: pinkish horn, three toes forward and one back, gripping
  const legs = new THREE.Group();
  legs.position.set(0.004, -0.03, 0);
  body.add(legs);
  const legMat = new THREE.MeshStandardMaterial({ color: '#b08a6a', roughness: 0.6 });
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(0, 0, s * 0.011);
    legs.add(leg);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0019, 0.03, 6).translate(0, -0.015, 0), legMat);
    leg.add(shin);
    for (const [ax, az, L] of [
      [1, 0, 0.014],
      [0.85, 0.5, 0.012],
      [0.85, -0.5, 0.012],
      [-1, 0, 0.01],
    ]) {
      const toe = new THREE.Mesh(new THREE.CylinderGeometry(0.0008, 0.0012, L, 5).rotateZ(-Math.PI / 2).translate(L / 2, 0, 0), legMat);
      toe.position.set(0, -0.03, 0);
      toe.rotation.y = Math.atan2(-az * s, ax);
      leg.add(toe);
    }
  }
  // wings and tail, laid out each frame
  const wingR = featherGeo(FEATHERS.length), wingL = featherGeo(FEATHERS.length, true), tail = featherGeo(TAIL_N);
  for (const g of [wingR, wingL, tail]) {
    const m = new THREE.Mesh(g, featherMat);
    m.frustumCulled = false;
    body.add(m);
  }
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.frustumCulled = false;
    }
  });
  const rig: ThrushRig = { root, body, head, jaw, legs, wingR, wingL, tail, fluff };
  poseThrush(rig, restPose());
  return rig;
}

export function poseThrush(R: ThrushRig, P: ThrushPose) {
  layWing(R.wingR, 1, { ...P.wing, flap: P.wing.flap + P.roll * 0.3 });
  layWing(R.wingL, -1, { ...P.wing, flap: P.wing.flap - P.roll * 0.3 });
  layTail(R.tail, P.tailSpread, P.tailPitch, P.tailYaw);
  R.head.rotation.set(P.headRoll, P.headYaw, P.headPitch, 'YZX');
  R.jaw.rotation.z = -P.beak * 0.5;
  R.legs.scale.y = 0.25 + 0.75 * P.legs;
  R.legs.rotation.z = (1 - P.legs) * 1.3; // swept back under the belly in flight
  R.fluff.scale.set(1, P.fluff, 0.92 + 0.08 * P.fluff + (P.fluff - 1) * 0.6);
}

// ---------------------------------------------------------------- its life by your side
const lerp = (a: number, b: number, k: number) => a + (b - a) * Math.min(1, k);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
type Mode = 'fly' | 'land' | 'perch';
/** where it sits: on top of the right shoulder (the side the camera looks over), a little toward the neck */
function perchPoint(sim: Sim, out: THREE.Vector3, cache: { obj?: THREE.Object3D; a?: THREE.Object3D; b?: THREE.Object3D; neck?: THREE.Object3D }) {
  const obj = (globalThis as any).__T2_OBJ?.[sim.player.id] as THREE.Object3D | undefined;
  if (!obj) return false;
  if (cache.obj !== obj) {
    cache.obj = obj;
    cache.a = cache.b = cache.neck = undefined;
    obj.traverse((o) => {
      if (!(o as any).isBone) return;
      const n = o.name.toLowerCase().replace(/^mixamorig[:_]?/, '').replace(/[^a-z0-9]/g, '');
      if (n === 'rightshoulder') cache.a = o;
      else if (n === 'rightarm') cache.b = o;
      else if (n === 'neck') cache.neck = o;
    });
  }
  if (!cache.a || !cache.b) return false;
  const a = cache.a.getWorldPosition(tmp.p), b = cache.b.getWorldPosition(tmp.q);
  out.copy(a).lerp(b, 0.62);
  out.y = Math.max(a.y, b.y) + 0.075;
  return true;
}

export function Thrush({ sim }: { sim: Sim }) {
  const S = useMemo(() => {
    const rig = buildThrush();
    rig.root.visible = false;
    return {
      rig,
      pose: restPose(),
      mode: 'fly' as Mode,
      pos: new THREE.Vector3(0, -100, 0),
      vel: new THREE.Vector3(),
      yaw: 0,
      pitch: 0,
      bank: 0,
      phase: 0,
      burst: 0,
      rest: 0,
      orbit: Math.random() * 6.28,
      orbitDir: 1,
      look: 0,
      lookAt: [0, 0] as [number, number],
      flick: 0,
      sing: 6,
      singT: 0,
      preen: 0,
      calm: 0,
      landT: 0,
      perch: new THREE.Vector3(),
      cache: {} as any,
      shown: false,
      last: 0,
    };
  }, []);
  (globalThis as any).__T2_BIRD = S; // headless tests read where it is and what it's doing
  useFrame(() => {
    // on the sim's clock (so it keeps pace with you however the frames come)
    const dt = Math.min(0.1, Math.max(0, sim.time - S.last));
    S.last = sim.time;
    const p = sim.player, R = S.rig, P = S.pose;
    const has = (bag(sim.progress).thrush ?? 0) > 0 && p.hp > 0;
    R.root.visible = has;
    if (!has) {
      S.shown = false;
      return;
    }
    const t = sim.time;
    const night = sim.clock.night;
    // is it quiet enough to sit on you
    const sp = Math.hypot(p.vel[0], p.vel[2]);
    const busy = (p.act !== 'idle' && p.act !== 'run') || !!p.run || sim.riding >= 0 || !!(p as any).swim || !p.grounded || sp > 3.2 || sim.fighters.some((f) => f.team === 'sect' && f.aggro && f.hp > 0 && sim.dist(f, p) < 16);
    S.calm = busy ? 0 : S.calm + dt;
    const hasPerch = perchPoint(sim, S.perch, S.cache);
    if (!S.shown) {
      // bought or back: it flies in from a little way off
      S.shown = true;
      S.pos.set(p.pos[0] + 3, p.pos[1] + 3, p.pos[2] + 2);
      S.vel.set(0, 0, 0);
      S.mode = 'fly';
    }
    if (S.mode === 'perch' && (busy || !hasPerch)) {
      // off it goes: a hop up and away
      S.mode = 'fly';
      S.vel.set(-Math.sin(p.yaw) * 1.5 + (Math.random() - 0.5), 3.2, -Math.cos(p.yaw) * 1.5 + (Math.random() - 0.5));
      S.burst = 0.5;
    }
    if (S.mode === 'fly' && !busy && hasPerch && S.calm > 1.2) S.mode = 'land';
    if (S.mode === 'land' && (busy || !hasPerch)) S.mode = 'fly';

    if (S.mode === 'perch') {
      // riding on your shoulder: facing along with you, looking about in quick snaps
      S.pos.copy(S.perch);
      S.vel.set(p.vel[0], 0, p.vel[2]);
      const want = Math.atan2(Math.sin(p.yaw + Math.PI / 2), Math.cos(p.yaw + Math.PI / 2)); // the player's forward in bird yaw (+x forward)
      S.yaw = lerp(S.yaw, S.yaw + wrap(want - 0.25 - S.yaw), dt * 8);
      S.pitch = lerp(S.pitch, 0.32, dt * 6);
      S.bank = lerp(S.bank, 0, dt * 6);
      P.legs = lerp(P.legs, 1, dt * 10);
      P.wing.fold = lerp(P.wing.fold, 1, dt * 9);
      P.wing.flap = lerp(P.wing.flap, 0, dt * 10);
      P.wing.sweep = 0;
      P.wing.bend = 0;
      P.wing.twist = 0;
      if (night) {
        // asleep: fluffed up, head turned back into its shoulder
        P.fluff = lerp(P.fluff, 1.18, dt * 2);
        P.headYaw = lerp(P.headYaw, 2.5, dt * 2);
        P.headPitch = lerp(P.headPitch, -0.35, dt * 2);
        P.headRoll = lerp(P.headRoll, 0.3, dt * 2);
        P.tailPitch = lerp(P.tailPitch, -0.5, dt * 2);
        P.tailSpread = lerp(P.tailSpread, 0.05, dt * 2);
        P.beak = 0;
      } else {
        P.fluff = lerp(P.fluff, 1.03, dt * 2);
        if ((S.look -= dt) <= 0) {
          S.look = 0.35 + Math.random() * 1.2;
          S.lookAt = [(Math.random() - 0.5) * 1.8, (Math.random() - 0.4) * 0.7];
          // now and then a look under its wing (preening)
          if (Math.random() < 0.08) S.preen = 1.2;
        }
        if (S.preen > 0) {
          S.preen -= dt;
          P.headYaw = lerp(P.headYaw, 2.3 + Math.sin(t * 9) * 0.15, dt * 12);
          P.headPitch = lerp(P.headPitch, -0.5, dt * 12);
          P.wing.fold = 0.85 + Math.sin(t * 9) * 0.05;
        } else {
          // birds move their heads in snaps, not sweeps
          P.headYaw = lerp(P.headYaw, S.lookAt[0], dt * 22);
          P.headPitch = lerp(P.headPitch, S.lookAt[1], dt * 22);
        }
        P.headRoll = lerp(P.headRoll, S.lookAt[0] * 0.15, dt * 10);
        // the tail: a flick up now and then, settling slowly
        if ((S.flick -= dt) <= 0) {
          S.flick = 1.5 + Math.random() * 4;
          P.tailPitch = 0.25;
          P.tailSpread = 0.35;
        }
        P.tailPitch = lerp(P.tailPitch, -0.4, dt * 3);
        P.tailSpread = lerp(P.tailSpread, 0.08, dt * 3);
        // song: the bill opens and shuts quickly, the throat swells
        if ((S.sing -= dt) <= 0) {
          S.sing = 7 + Math.random() * 9;
          S.singT = 1.6;
          sim.say(S.pos.x, S.pos.y + 0.35, S.pos.z, ['啾啾～', '叽叽喳喳！', '啾——啾啾', '咕噜噜～'][Math.floor(Math.random() * 4)]);
        }
      }
      if (S.singT > 0) {
        S.singT -= dt;
        P.beak = 0.5 + 0.5 * Math.sin(t * 38);
        P.headPitch = lerp(P.headPitch, 0.35, dt * 8);
        P.fluff = 1.04 + Math.sin(t * 38) * 0.02;
      } else P.beak = lerp(P.beak, 0, dt * 12);
    } else {
      // in the air: a point that circles you, a little ahead when you run, wandering in height and radius
      S.orbit += dt * (0.7 + 0.35 * Math.sin(t * 0.37)) * S.orbitDir;
      if (Math.random() < dt * 0.05) S.orbitDir *= -1;
      const rad = 1.7 + 0.6 * Math.sin(t * 0.53), hgt = 2.2 + 0.5 * Math.sin(t * 0.71) + (sim.riding >= 0 ? 1 : 0);
      const ahead = Math.min(1.2, sp * 0.18);
      const target = S.mode === 'land' ? S.perch : tmp.b.set(p.pos[0] + Math.cos(S.orbit) * rad + p.vel[0] * ahead, p.pos[1] + hgt, p.pos[2] + Math.sin(S.orbit) * rad + p.vel[2] * ahead);
      const to = tmp.d.copy(target).sub(S.pos);
      const dist = to.length();
      let maxV = Math.min(18, 9 + Math.max(0, dist - 4) * 1.5); // left behind: it hurries
      if (S.mode === 'land') {
        maxV = Math.max(0.6, Math.min(9, dist * 3.2));
        if (dist < 0.06) {
          S.mode = 'perch';
          S.pos.copy(target);
          P.tailPitch = 0.3;
          P.tailSpread = 0.6;
          S.flick = 1;
        }
      }
      // steer: the velocity it wants, reached with a limited pull
      const want = to.multiplyScalar(S.mode === 'land' ? 4 : 2.2).add(tmp.n.set(p.vel[0], 0, p.vel[2]));
      if (want.length() > maxV) want.setLength(maxV);
      const acc = tmp.side.copy(want).sub(S.vel);
      const amax = S.mode === 'land' && dist < 1 ? 18 : 12;
      if (acc.length() > amax * dt) acc.setLength(amax * dt);
      S.vel.add(acc);
      S.pos.addScaledVector(S.vel, dt);
      // never into the ground
      const gy = groundHeight(S.pos.x, S.pos.z) + 0.25;
      if (S.pos.y < gy && sim.indoor < 0) {
        S.pos.y = gy;
        S.vel.y = Math.max(0, S.vel.y);
      }
      // heading, pitch and bank from how it moves
      const hv = Math.hypot(S.vel.x, S.vel.z);
      if (hv > 0.3) {
        const yaw = Math.atan2(-S.vel.z, S.vel.x);
        const dy = wrap(yaw - S.yaw);
        S.yaw += dy * Math.min(1, dt * 9);
        S.bank = lerp(S.bank, Math.max(-0.9, Math.min(0.9, (dy / Math.max(dt, 1e-3)) * 0.06)), dt * 6);
      }
      S.pitch = lerp(S.pitch, Math.max(-0.6, Math.min(0.6, Math.atan2(S.vel.y, Math.max(0.5, hv)) * 0.8)), dt * 6);
      // the wings: bursts of quick strokes; between, a glide or (a small bird's bound) a moment folded
      const climbing = S.vel.y > 0.6 || acc.length() / dt > 6;
      const flare = S.mode === 'land' && dist < 0.7;
      if (S.burst > 0) S.burst -= dt;
      else if (S.rest > 0) {
        S.rest -= dt;
        if (climbing || flare) S.rest = 0;
      } else {
        S.burst = 0.35 + Math.random() * 0.5;
        S.rest = climbing ? 0 : 0.18 + Math.random() * 0.35;
      }
      const stroking = S.burst > 0 || climbing || flare;
      if (stroking) S.phase += dt * (flare ? 15 : 13) * Math.PI * 2;
      const ph = Math.sin(S.phase);
      const bound = !stroking && S.rest > 0 && Math.floor(t * 0.7 + S.orbit) % 2 === 0;
      if (stroking) {
        // downstroke wide and flat, upstroke with the wing half folded and swept back
        P.wing.flap = ph * 0.95 + 0.15;
        P.wing.fold = ph > 0 ? 0.05 : 0.05 + 0.35 * -ph;
        P.wing.sweep = 0.2 + (ph > 0 ? 0.05 : 0.35 * -ph);
        P.wing.twist = 0.35 * Math.cos(S.phase);
        P.wing.bend = -0.6 * Math.cos(S.phase);
      } else if (bound) {
        P.wing.flap = lerp(P.wing.flap, 0.2, dt * 20);
        P.wing.fold = lerp(P.wing.fold, 0.85, dt * 20);
        P.wing.sweep = 0.3;
        P.wing.twist = 0;
        P.wing.bend = 0;
      } else {
        P.wing.flap = lerp(P.wing.flap, 0.12, dt * 12);
        P.wing.fold = lerp(P.wing.fold, 0.08, dt * 12);
        P.wing.sweep = lerp(P.wing.sweep, 0.18, dt * 12);
        P.wing.twist = lerp(P.wing.twist, 0.05, dt * 12);
        P.wing.bend = lerp(P.wing.bend, 0.15, dt * 12);
      }
      if (flare) {
        // wings up and forward, body up, tail fanned down: braking onto the shoulder
        S.pitch = lerp(S.pitch, 0.7, dt * 10);
        P.wing.sweep = -0.2;
        P.tailSpread = lerp(P.tailSpread, 0.9, dt * 10);
        P.tailPitch = lerp(P.tailPitch, -0.5, dt * 10);
        P.legs = lerp(P.legs, 1, dt * 10);
      } else {
        P.tailSpread = lerp(P.tailSpread, Math.abs(S.bank) * 0.5 + (stroking ? 0.15 : 0.08), dt * 6);
        P.tailPitch = lerp(P.tailPitch, -0.05 + S.pitch * 0.3, dt * 6);
        P.legs = lerp(P.legs, 0, dt * 8);
      }
      P.tailYaw = -S.bank * 0.15;
      P.headYaw = lerp(P.headYaw, 0, dt * 8);
      P.headPitch = lerp(P.headPitch, -S.pitch * 0.8, dt * 8);
      P.headRoll = lerp(P.headRoll, -S.bank * 0.6, dt * 8);
      P.roll = S.bank;
      P.beak = lerp(P.beak, 0, dt * 10);
      P.fluff = lerp(P.fluff, 0.96, dt * 4);
    }
    if (FEATHER_MAT.m) FEATHER_MAT.m.emissiveIntensity = 0.2 * Math.min(1, Math.max(0, WATER_U.uDay.value));
    poseThrush(R, P);
    R.root.position.copy(S.pos);
    R.root.rotation.set(0, S.yaw, 0);
    R.body.rotation.set(S.bank, 0, S.pitch, 'YZX');
    // a little bob as it flies (the strokes lift it)
    if (S.mode !== 'perch') R.root.position.y += Math.sin(S.phase) * 0.012;
  });
  return <primitive object={S.rig.root} />;
}

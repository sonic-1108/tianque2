// 覆舟河蛟 (owner: it must not stand on its hind legs; a river dragon swims): the owner's Tripo dragon (crouched, four
// clawed legs, a long tail with a fin) given bones made here: a spine from its middle forward to the shoulders, neck
// and head and back through the hips to the fin, and a bone for each leg. Skin weights by the place along the body;
// each leg in three bones (shoulder or hip, elbow or knee, the foot and its claws), the lower jaw hinged; every joint
// on a spring, so the tail lags, swings through the turns and settles. In deep water it lies low, the back, the head
// and the tail's ridge out, a wave running down the body to the fin, the legs paddling under it, the head up watching
// you, jaws working as it breathes; on the bank it walks crouched. Between blows it glances about, shakes its head,
// snarls, dips its head to the water, flicks its tail up and slaps it down, flexes a claw. Its moves are poses on the sim's clock: rearing with its claws up and lunging for the bite,
// the tail coiled and whipped round, the head thrown up for the spout, curled into a ring for the whirlpool, sinking
// and bursting up for the dive, rearing to roar for the rain and the tide. Open (破绽) it lays its head on the water;
// killed, it rolls over and sinks. Drawn here, not by Rig. The fighter stands for its neck (ZC): blows reach it there.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { GLTFLoader, MeshoptDecoder } from 'three-stdlib';
import type { Sim } from '../game/sim';
import type { Fighter } from '../game/types';
import { giantOf, giantOpen, giantPhase } from '../game/giants';
import { WATER_Y, groundHeight } from '../game/world';
import { BODY_N, WATER_BODY } from './Water';
import { WATER_FX } from './WaterFx';

/** the spine in the file's units (z toward the head, y up), from the fin to the head */
const SP: [number, number][] = [
  [-0.48, 0.47],
  [-0.4, 0.43],
  [-0.32, 0.42],
  [-0.24, 0.39],
  [-0.16, 0.33],
  [-0.08, 0.26],
  [0.04, 0.21],
  [0.17, 0.21],
  [0.25, 0.27],
  [0.31, 0.34],
];
const ROOT = 6, HIP = 5, SHOULDER = 7, NECK = 8, HEAD = 9;
/** the body's half girth at each spine bone (file units): thin at the fin, thickest at the chest, the head */
const GIRTH = [0.03, 0.04, 0.05, 0.055, 0.062, 0.07, 0.075, 0.075, 0.068, 0.08];
/** the back chain from the hips to the fin (bone indices) */
const BACK = [5, 4, 3, 2, 1, 0];
type V3 = [number, number, number];
/** each leg in three bones (measured on the mesh): shoulder or hip, elbow or knee, wrist or ankle, and the claws' tips;
 * the spine bone it hangs from. Bones 10 + k (upper), 14 + k (lower), 18 + k (the foot); 0, 1 fore (left, right), 2, 3 hind */
const LEGS: { root: V3; knee: V3; ankle: V3; tip: V3; on: number; front: boolean; side: number }[] = [
  { root: [0.1, 0.17, 0.24], knee: [0.117, 0.079, 0.23], ankle: [0.128, 0.029, 0.298], tip: [0.144, 0.017, 0.378], on: SHOULDER, front: true, side: 1 },
  { root: [-0.1, 0.17, 0.24], knee: [-0.114, 0.078, 0.23], ankle: [-0.133, 0.027, 0.302], tip: [-0.149, 0.016, 0.381], on: SHOULDER, front: true, side: -1 },
  { root: [0.13, 0.2, -0.13], knee: [0.155, 0.11, -0.16], ankle: [0.156, 0.06, -0.189], tip: [0.186, 0.03, -0.211], on: ROOT, front: false, side: 1 },
  { root: [-0.13, 0.2, -0.13], knee: [-0.158, 0.11, -0.16], ankle: [-0.156, 0.059, -0.188], tip: [-0.188, 0.03, -0.212], on: ROOT, front: false, side: -1 },
];
const UP = 10, MID = 14, LOW = 18;
/** the lower jaw, hinged under the eyes (the mouth's corners at z 0.345) */
const JAW = 22, JAW_AT: V3 = [0, 0.315, 0.345];
const NB = 23;
/** metres from the fin to the snout (the file runs z -0.49 to 0.49) */
const LENGTH = 16;
const S = LENGTH / 0.98;
/** the point along the body the fighter stands for (the neck): its girth (bodyR) is measured from here */
const ZC = 0.25;

export interface SerpentBody {
  root: THREE.Group;
  inner: THREE.Group;
  bones: THREE.Bone[];
  mats: THREE.MeshStandardMaterial[];
}

function floatAttr(a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, n: number) {
  const out = new Float32Array(a.count * n);
  for (let i = 0; i < a.count; i++) {
    out[i * n] = a.getX(i);
    if (n > 1) out[i * n + 1] = a.getY(i);
    if (n > 2) out[i * n + 2] = a.getZ(i);
  }
  return new THREE.BufferAttribute(out, n);
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** where a point lies along a leg: 0 at the shoulder, 1 the elbow, 2 the wrist, toward 3 the claws (nearest segment) */
function alongLeg(x: number, y: number, z: number, L: (typeof LEGS)[number]) {
  const pts = [L.root, L.knee, L.ankle, L.tip];
  let best = 1e9, c = 0;
  for (let s = 0; s < 3; s++) {
    const a = pts[s], b = pts[s + 1];
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [x - a[0], y - a[1], z - a[2]];
    const t = Math.min(1, Math.max(0, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2)));
    const d = Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t);
    if (d < best) {
      best = d;
      c = s + t;
    }
  }
  return c;
}

/** the file's mesh made a skinned body with its spine, jointed legs and jaw (scene: the loaded glTF's, cloned) */
export function buildSerpent(scene: THREE.Object3D): SerpentBody {
  scene.updateMatrixWorld(true);
  let src: THREE.Mesh | null = null;
  scene.traverse((o: any) => {
    if (o.isMesh && !src) src = o;
  });
  const mesh = src! as THREE.Mesh;
  const g0 = mesh.geometry as THREE.BufferGeometry;
  // plain floats in the file's own units (the quantized mesh carries its scale on the node)
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', floatAttr(g0.getAttribute('position') as any, 3));
  if (g0.getAttribute('normal')) geo.setAttribute('normal', floatAttr(g0.getAttribute('normal') as any, 3));
  if (g0.getAttribute('uv')) geo.setAttribute('uv', floatAttr(g0.getAttribute('uv') as any, 2));
  if (g0.index) geo.setIndex(g0.index);
  geo.applyMatrix4(mesh.matrixWorld);
  if (!g0.getAttribute('normal')) geo.computeVertexNormals();
  // the spine: the middle is the root, the chain runs forward to the head and back to the fin; legs and jaw hang off it
  // (yaw after pitch: a bone bends down about its own crosswise axis, then turns; the other order stood a curled tail's
  // fin on end)
  const bones = Array.from({ length: NB }, () => {
    const b = new THREE.Bone();
    b.rotation.order = 'YXZ';
    return b;
  });
  const parent = (i: number) => (i < ROOT ? i + 1 : i - 1);
  SP.forEach(([z, y], i) => {
    if (i === ROOT) bones[i].position.set(0, y, z);
    else {
      const [pz, py] = SP[parent(i)];
      bones[i].position.set(0, y - py, z - pz);
      bones[parent(i)].add(bones[i]);
    }
  });
  const at = (b: THREE.Bone, p: V3, from: V3) => b.position.set(p[0] - from[0], p[1] - from[1], p[2] - from[2]);
  LEGS.forEach((l, k) => {
    const [pz, py] = SP[l.on];
    at(bones[UP + k], l.root, [0, py, pz]);
    bones[l.on].add(bones[UP + k]);
    at(bones[MID + k], l.knee, l.root);
    bones[UP + k].add(bones[MID + k]);
    at(bones[LOW + k], l.ankle, l.knee);
    bones[MID + k].add(bones[LOW + k]);
  });
  at(bones[JAW], JAW_AT, [0, SP[HEAD][1], SP[HEAD][0]]);
  bones[HEAD].add(bones[JAW]);
  // weights: along the body between the two nearest spine bones; a leg along its three bones; the head rigid but for
  // the lower jaw
  const P = geo.getAttribute('position');
  const si = new Uint16Array(P.count * 4), sw = new Float32Array(P.count * 4);
  for (let v = 0; v < P.count; v++) {
    const x = P.getX(v), y = P.getY(v), z = P.getZ(v);
    const w = [0, 0, 0, 0], ix = [0, 0, 0, 0];
    let n = 0;
    const put = (b: number, k: number) => {
      if (k <= 1e-4) return;
      for (let q = 0; q < n; q++)
        if (ix[q] === b) {
          w[q] += k;
          return;
        }
      if (n < 4) {
        ix[n] = b;
        w[n++] = k;
      } else {
        // full: give it to the smallest share's bone if this one is bigger
        let m = 0;
        for (let q = 1; q < 4; q++) if (w[q] < w[m]) m = q;
        if (k > w[m]) {
          ix[m] = b;
          w[m] = k;
        }
      }
    };
    const head = smooth(0.265, 0.305, z) * smooth(0.18, 0.24, y);
    const jaw = head * smooth(0.335, 0.365, z) * smooth(0.318, 0.298, y);
    const leg = Math.max(smooth(0.3, 0.2, y) * smooth(0.075, 0.11, Math.abs(x)), smooth(0.11, 0.06, y)) * (1 - head);
    if (leg > 1e-4) {
      const k = (z > 0.08 ? 0 : 2) + (x >= 0 ? 0 : 1);
      const c = alongLeg(x, y, z, LEGS[k]);
      const w2 = smooth(1.85, 2.12, c), w0 = 1 - smooth(0.85, 1.12, c), w1 = Math.max(0, 1 - w0 - w2);
      put(UP + k, leg * w0);
      put(MID + k, leg * w1);
      put(LOW + k, leg * w2);
    }
    put(HEAD, head - jaw);
    put(JAW, jaw);
    const left = Math.max(0, 1 - leg - head);
    if (left > 0) {
      if (z <= SP[0][0]) put(0, left);
      else if (z >= SP[HEAD][0]) put(HEAD, left);
      else
        for (let k = 0; k < SP.length - 1; k++)
          if (z >= SP[k][0] && z < SP[k + 1][0]) {
            const t = smooth(0, 1, (z - SP[k][0]) / (SP[k + 1][0] - SP[k][0]));
            put(k, left * (1 - t));
            put(k + 1, left * t);
            break;
          }
    }
    const tot = w[0] + w[1] + w[2] + w[3] || 1;
    for (let q = 0; q < 4; q++) {
      si[v * 4 + q] = ix[q];
      sw[v * 4 + q] = w[q] / tot;
    }
  }
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  geo.computeBoundingSphere();
  const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
  const skinned = new THREE.SkinnedMesh(geo, mat);
  skinned.castShadow = true;
  skinned.frustumCulled = false;
  skinned.add(bones[ROOT]);
  skinned.bind(new THREE.Skeleton(bones));
  const inner = new THREE.Group();
  inner.add(skinned);
  const root = new THREE.Group();
  root.add(inner);
  root.scale.setScalar(S);
  return { root, inner, bones, mats: [mat] };
}

/** what the body is doing: each joint's angle and how fast it is turning (springs: the tail lags, swings through and
 * settles), the idle gestures */
export const serpentLive = () => ({
  ph: 0,
  spin: 0,
  ang: new Float32Array(NB * 3),
  vel: new Float32Array(NB * 3),
  y: 0,
  z: 0,
  roll: 0,
  rootPitch: 0,
  wade: 0,
  /** an idle gesture: which, how far through (0..1), and the wait for the next */
  gest: '' as '' | 'glance' | 'shake' | 'snarl' | 'dip' | 'flick' | 'claw',
  gu: 0,
  gLen: 1,
  gSide: 1,
  gWait: 3,
  t: 0,
});
export type SerpentLive = ReturnType<typeof serpentLive>;
export interface SerpentIn {
  dt: number;
  /** metres a second */
  speed: number;
  /** how fast it is turning (radians a second, + to its left) */
  turn: number;
  /** where you are, left (+) or right of its nose, radians */
  look: number;
  /** 0 on the bank to 1 in deep water */
  swim: number;
  move: { id: string; wind: number; t: number } | null;
  open: boolean;
  /** seconds since it died (0: alive) */
  dead: number;
  /** metres to lower it by (deep water: the back at the water line) */
  wade: number;
  /** each spine bone's yaw from the body's path (bodyPath): the body lying along where the head has been */
  chain?: Float32Array;
}

const ease = (x: number) => 1 - (1 - x) * (1 - x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const WAVE = [0.05, 0.08, 0.11, 0.14, 0.16, 0.18];
/** in the water the tail lies along the surface (in the file it is held up behind) */
const TAIL_DOWN: Record<number, number> = { 5: -0.45, 4: -0.3, 3: 0.15, 2: 0.15, 1: -0.05 };
/** each joint's spring: how stiff (rad/s) and how damped (1 = no overshoot); the tail loose and swinging */
const STIFF = new Float32Array(NB), DAMP = new Float32Array(NB);
for (let i = 0; i < NB; i++) {
  STIFF[i] = 12;
  DAMP[i] = 0.8;
}
[0, 1, 2, 3, 4].forEach((b) => {
  STIFF[b] = 4.6 + b * 0.9;
  DAMP[b] = 0.42;
});
STIFF[HIP] = 9;
STIFF[ROOT] = 9;
STIFF[NECK] = 10;
STIFF[HEAD] = 11;
DAMP[NECK] = DAMP[HEAD] = 0.62;
for (let k = 0; k < 4; k++) {
  STIFF[UP + k] = STIFF[MID + k] = STIFF[LOW + k] = 15;
  DAMP[LOW + k] = 0.6;
}
STIFF[JAW] = 22;
DAMP[JAW] = 0.55;

/** sets the bones and the body's lift, turn and roll for this moment */
export function poseSerpent(body: SerpentBody, L: SerpentLive, I: SerpentIn) {
  const dt = Math.min(I.dt, 0.1);
  L.t += dt;
  L.ph += dt * (1.6 + Math.min(I.speed, 12) * 0.3);
  // targets: X (pitch: + head down / tail up on the back chain is - ), Y (yaw: + to its left), R (roll)
  const X = new Float32Array(NB), Y = new Float32Array(NB), R = new Float32Array(NB);
  let lift = 0, push = 0, roll = Math.sin(L.ph) * 0.03 * I.swim, rootPitch = 0, spin = 0;
  const turn = Math.max(-2, Math.min(2, I.turn));
  // swimming: a wave down the body to the fin (bigger as it goes faster; a slower second wave so it never repeats),
  // small humps, the tail along the water; turning, the tail swings out behind and the head leads
  const amp = 0.8 + Math.min(1, I.speed / 6) * 0.7;
  BACK.forEach((b, j) => {
    Y[b] = amp * WAVE[j] * (Math.sin(L.ph - j * 0.85) + 0.35 * Math.sin(L.ph * 0.43 - j * 0.5 + 1.3)) - turn * 0.07 * (1 + j * 0.3);
    X[b] = (TAIL_DOWN[b] ?? 0) * I.swim + 0.05 * I.swim * Math.sin(L.ph * 0.7 - j * 1.1);
    R[b] = j >= 3 ? 0.12 * Math.sin(L.ph * 0.9 - j * 0.7) : 0; // the fin sculls
  });
  // the shoulders steady against the wave, the head watches you (spread down the neck), breathing through its jaws
  let look = I.look;
  Y[SHOULDER] = -Y[HIP] * 0.6 + turn * 0.1;
  X[SHOULDER] = -0.06 * I.swim; // in the water the head is held up
  X[NECK] = -0.04 * I.swim + Math.sin(L.ph * 0.5) * 0.04;
  X[HEAD] = 0.08 * I.swim + Math.sin(L.ph * 0.5 + 1) * 0.04;
  X[JAW] = 0.05 + 0.05 * Math.sin(L.t * 1.3);
  // legs: paddling (diagonal pairs) tucked under in deep water, striding on the bank, each with its elbow or knee and
  // its foot following a beat behind
  const walk = Math.min(1, I.speed / 3);
  for (let k = 0; k < 4; k++) {
    const lg = LEGS[k], off = k === 0 || k === 3 ? 0 : Math.PI, f = lg.front ? 1 : -1;
    const ph = L.ph * 0.9 + off;
    const swimU = (lg.front ? 0.12 : 0.08) + 0.3 * Math.sin(ph), swimM = f * (0.2 + 0.35 * Math.sin(ph - 1.3)), swimL = 0.3 * Math.sin(ph - 2.2);
    const walkU = 0.42 * walk * Math.sin(ph), walkM = f * 0.4 * walk * Math.max(0, Math.sin(ph + 1.2)), walkL = -0.35 * walk * Math.max(0, Math.sin(ph + 2.1));
    X[UP + k] = swimU * I.swim + walkU * (1 - I.swim);
    X[MID + k] = swimM * I.swim + walkM * (1 - I.swim);
    X[LOW + k] = swimL * I.swim + walkL * (1 - I.swim);
  }
  const claws = (raise: number, grab: number) => {
    // the forelegs: raised (forward and up, the forearm lifted, the claws spread open) or struck (reaching, curled)
    for (const k of [0, 1]) {
      X[UP + k] += -0.95 * raise - 1.0 * grab;
      X[MID + k] += -0.55 * raise + 0.2 * grab;
      X[LOW + k] += -0.45 * raise + 0.8 * grab;
      R[UP + k] += LEGS[k].side * 0.25 * raise;
    }
  };
  // its moves, on the sim's clock (the strike falls at t = wind)
  const mv = I.dead ? null : I.move;
  if (mv) {
    L.gest = '';
    const W = mv.wind, t = mv.t, pre = ease(clamp01(t / W)), post = t > W ? (t - W) / 0.6 : 0;
    const hit = t > W ? (post < 0.25 ? post / 0.25 : Math.max(0, 1 - (post - 0.25) / 0.75)) : 0;
    const rear = (k: number) => {
      X[SHOULDER] += -0.4 * k;
      X[NECK] += -0.35 * k;
      X[HEAD] += 0.3 * k;
      rootPitch += -0.14 * k;
      lift += 0.06 * k;
    };
    switch (mv.id) {
      case 'jbite': // rears, claws up, jaws wide, and lunges: claws raking, jaws snapping shut
        rear(pre * (1 - hit));
        claws(pre * (1 - hit) * 0.8, hit);
        X[SHOULDER] += 0.3 * hit;
        X[NECK] += 0.4 * hit;
        X[HEAD] += -0.2 * hit;
        X[JAW] = 0.6 * pre * (1 - hit) - 0.08 * hit;
        push += 0.2 * hit;
        break;
      case 'jtail': {
        // the tail drawn round to one side, then whipped across; the forelegs braced, the head turned to follow
        const sw = clamp01(post / 0.3);
        BACK.forEach((b, j) => {
          Y[b] += (0.3 * pre * (1 - sw) - 0.45 * sw * Math.max(0, 1 - post)) * (0.6 + j * 0.15);
          X[b] += -0.15 * pre * (1 - sw); // up out of the water before the blow
        });
        Y[SHOULDER] += -0.3 * pre * (1 - sw) + 0.3 * sw * Math.max(0, 1 - post);
        look += -0.5 * pre * (1 - sw);
        for (const k of [0, 1]) X[UP + k] += 0.25 * pre;
        X[JAW] = 0.35 * pre;
        spin = (t > W ? 3.2 : 0) * Math.max(0, 1 - post);
        break;
      }
      case 'spout': {
        rear(pre);
        const on = t > W ? Math.max(0, 1 - post) : 0;
        X[NECK] += 0.3 * on;
        X[HEAD] += -0.3 * on + (on > 0 ? Math.sin(t * 40) * 0.03 : 0);
        X[JAW] = 0.25 * pre + 0.45 * on;
        claws(0.4 * pre, 0);
        break;
      }
      case 'whirl': {
        // curls into a ring and turns, the legs drawn in
        const c = Math.max(pre, t > W ? Math.max(0, 1 - post * 0.6) : 0);
        BACK.forEach((b) => (Y[b] += 0.45 * c));
        Y[SHOULDER] += 0.35 * c;
        Y[NECK] += 0.3 * c;
        for (let k = 0; k < 4; k++) {
          X[UP + k] += (LEGS[k].front ? 0.4 : 0.3) * c;
          X[MID + k] += (LEGS[k].front ? 0.5 : -0.5) * c;
        }
        X[JAW] = 0.3 * c;
        spin = 2.8 * c;
        break;
      }
      case 'dive': {
        // under, then up out of the water onto you, claws first
        const Rr = 0.55, up = t > W - Rr ? clamp01((t - (W - Rr)) / Rr) : 0;
        lift += -0.3 * pre * (1 - up) + 0.05 * up * (1 - hit);
        X[SHOULDER] += 0.3 * pre * (1 - up) - 0.45 * up * (1 - hit) + 0.25 * hit;
        X[NECK] += 0.2 * pre * (1 - up) - 0.35 * up * (1 - hit) + 0.35 * hit;
        claws(up * (1 - hit), hit * 0.8);
        X[JAW] = 0.55 * up * (1 - hit);
        rootPitch += 0.15 * pre * (1 - up) - 0.18 * up * (1 - hit);
        break;
      }
      default: {
        // 暴雨 / 怒潮: rears high, claws raised and spread, roaring at the sky (the head shaking), then slams down
        const k = pre * (1 - hit);
        rear(k * 1.2);
        claws(k, 0);
        X[HEAD] += -0.35 * k;
        Y[HEAD] += Math.sin(L.t * 9) * 0.08 * k;
        X[JAW] = 0.75 * k;
        X[SHOULDER] += 0.32 * hit;
        X[NECK] += 0.3 * hit;
        for (const j of [0, 1]) X[UP + j] += 0.5 * hit; // the claws come down on the water
        break;
      }
    }
  } else if (I.open && !I.dead) {
    // open: the head laid down on the water, panting, the claws limp
    L.gest = '';
    X[SHOULDER] += 0.3;
    X[NECK] += 0.42 + Math.sin(L.ph * 1.5) * 0.05;
    X[HEAD] += -0.12;
    X[JAW] = 0.22 + 0.14 * Math.sin(L.t * 5);
    for (let k = 0; k < 4; k++) {
      X[UP + k] += 0.35;
      X[MID + k] += LEGS[k].front ? 0.4 : -0.4;
      X[LOW + k] += 0.5;
    }
    lift -= 0.06;
  } else if (!I.dead) {
    // between blows it isn't still: now and then it glances about, shakes its head, snarls, dips its head to the
    // water, flicks its tail up and slaps it down, or flexes a claw
    if (!L.gest) {
      L.gWait -= dt;
      if (L.gWait <= 0) {
        const all = ['glance', 'shake', 'snarl', 'dip', 'flick', 'claw'] as const;
        L.gest = all[Math.floor(Math.random() * all.length)];
        L.gu = 0;
        L.gLen = { glance: 1.8, shake: 0.9, snarl: 1.3, dip: 1.8, flick: 1.4, claw: 1.1 }[L.gest];
        L.gSide = Math.random() < 0.5 ? -1 : 1;
        L.gWait = 2.5 + Math.random() * 4;
      }
    }
    if (L.gest) {
      L.gu += dt / L.gLen;
      const e = Math.sin(Math.min(1, L.gu) * Math.PI);
      switch (L.gest) {
        case 'glance':
          look = L.gSide * 0.9 * e + look * (1 - e);
          X[NECK] += -0.1 * e;
          break;
        case 'shake':
          Y[HEAD] += Math.sin(L.gu * 30) * 0.22 * e;
          Y[NECK] += Math.sin(L.gu * 30 - 0.8) * 0.1 * e;
          X[JAW] += 0.25 * e;
          break;
        case 'snarl':
          X[NECK] += -0.25 * e;
          X[HEAD] += 0.12 * e;
          X[JAW] += 0.45 * e;
          break;
        case 'dip':
          X[SHOULDER] += 0.18 * e;
          X[NECK] += 0.35 * e;
          X[HEAD] += 0.15 * e;
          break;
        case 'flick': {
          const up = L.gu < 0.5 ? e : 0, slap = L.gu >= 0.5 ? Math.sin((L.gu - 0.5) * 2 * Math.PI) : 0;
          BACK.forEach((b, j) => {
            X[b] += (-0.22 * up + 0.16 * slap) * (j >= 2 ? 1 : 0.4);
            Y[b] += L.gSide * 0.12 * e;
          });
          break;
        }
        case 'claw': {
          const k = L.gSide > 0 ? 0 : 1;
          X[UP + k] += -0.7 * e;
          X[MID + k] += -0.4 * e;
          X[LOW + k] += (-0.5 + Math.sin(L.gu * 18) * 0.4) * e;
          break;
        }
      }
      if (L.gu >= 1) L.gest = '';
    }
  }
  // the head follows you (or what it glances at), spread down the neck
  Y[SHOULDER] += look * 0.22;
  Y[NECK] += look * 0.33;
  Y[HEAD] += look * 0.28;
  if (I.dead) {
    // over on its side and down, the legs curled
    roll = Math.min(2.4, I.dead * 1.3);
    lift = -Math.min(0.45, I.dead * 0.1);
    BACK.forEach((b) => (Y[b] = 0.12));
    for (let k = 0; k < 4; k++) {
      X[MID + k] = LEGS[k].front ? 1 : -1;
      X[LOW + k] = 0.8;
    }
    X[JAW] = 0.5;
  }
  // every joint on its spring (two half steps: stiff joints stay steady at low frame rates)
  const h = dt / 2;
  for (let s = 0; s < 2; s++)
    for (let i = 0; i < NB; i++) {
      const w = STIFF[i], z = DAMP[i];
      for (let c = 0; c < 3; c++) {
        const k = i * 3 + c, tg = c === 0 ? X[i] : c === 1 ? Y[i] : R[i];
        L.vel[k] += ((tg - L.ang[k]) * w * w - 2 * z * w * L.vel[k]) * h;
        L.ang[k] += L.vel[k] * h;
      }
    }
  for (let i = 0; i < NB; i++) body.bones[i].rotation.set(L.ang[i * 3], L.ang[i * 3 + 1] + (i < 10 && I.chain ? I.chain[i] : 0), L.ang[i * 3 + 2]);
  const k = 1 - Math.exp(-dt * 10);
  L.y += (lift - L.y) * k;
  L.z += (push - L.z) * k;
  L.roll += (roll - L.roll) * k;
  L.rootPitch += (rootPitch - L.rootPitch) * k;
  L.wade += (I.wade - L.wade) * (1 - Math.exp(-dt * 3));
  if (spin) L.spin += spin * dt;
  else L.spin -= Math.sin(L.spin) * Math.min(1, dt * 2); // back to facing its way
  body.inner.position.set(0, L.y + L.wade / S, -SP[ROOT][0] + L.z);
  body.inner.rotation.set(L.rootPitch, L.spin, L.roll);
}

// ---------------------------------------------------------------- the body along its path
/** the spine from the snout back: Q0 the head, Q1 the neck (where the fighter is), Q2 the shoulders, Q3 the middle
 * (the root bone), Q4 the hips ... Q9 the fin; each segment's length on the ground (metres) */
const SEG = [0.06, 0.08, 0.13, 0.12, 0.08, 0.08, 0.08, 0.08, 0.08].map((x) => x * S);
/** how hard each joint is held from folding (radians), and how fast the body straightens out behind the head (/s) */
const MAX_BEND = [0.85, 0.85, 0.7, 0, 0.6, 0.6, 0.6, 0.6, 0.6];
const RELAX = [0, 1.4, 1.1, 0, 0.9, 0.8, 0.8, 0.7, 0.7];
const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const headingOf = (x: number, z: number) => Math.atan2(x, z);
export const pathLive = () => ({ q: new Float32Array(20), d: new Float32Array(18), hv: 0, ok: false });
/** follow the leader: the neck is where the fighter is, the head ahead of it on the way it looks (hv, eased toward the
 * sim's facing so a snap turn swings round), each point after pulled along behind the one before, straightening a little
 * each moment and never folding past MAX_BEND. Writes each spine bone's yaw (out) and returns the middle's place and
 * heading (the group's) */
export function bodyPath(P: ReturnType<typeof pathLive>, nx: number, nz: number, heading: number, dt: number, out: Float32Array) {
  const q = P.q, d = P.d;
  if (!P.ok || Math.hypot(q[2] - nx, q[3] - nz) > 8) {
    P.hv = heading;
    const bx = -Math.sin(heading), bz = -Math.cos(heading);
    for (let k = 0; k < 9; k++) {
      d[k * 2] = bx;
      d[k * 2 + 1] = bz;
    }
    P.ok = true;
  }
  P.hv += Math.max(-3.5 * dt, Math.min(3.5 * dt, wrapA(heading - P.hv)));
  // the head ahead of the neck
  q[2] = nx;
  q[3] = nz;
  d[0] = -Math.sin(P.hv);
  d[1] = -Math.cos(P.hv);
  q[0] = nx - d[0] * SEG[0];
  q[1] = nz - d[1] * SEG[0];
  for (let k = 1; k < 9; k++) {
    const px = d[(k - 1) * 2], pz = d[(k - 1) * 2 + 1];
    let fx: number, fz: number;
    if (k === 3) {
      fx = px; // the middle is one piece: straight through
      fz = pz;
    } else {
      // where the next point was, seen from this one (it is dragged along), eased toward straight on
      const ox = q[(k + 1) * 2], oz = q[(k + 1) * 2 + 1];
      fx = ox - q[k * 2];
      fz = oz - q[k * 2 + 1];
      const l = Math.hypot(fx, fz);
      if (l < 1e-4 || !Number.isFinite(l)) {
        fx = px;
        fz = pz;
      } else {
        fx /= l;
        fz /= l;
      }
      const r = Math.min(1, RELAX[k] * dt);
      fx += (px - fx) * r;
      fz += (pz - fz) * r;
      // no sharper than its joint allows
      let a = wrapA(headingOf(fx, fz) - headingOf(px, pz));
      a = Math.max(-MAX_BEND[k], Math.min(MAX_BEND[k], a));
      const h = headingOf(px, pz) + a;
      fx = Math.sin(h);
      fz = Math.cos(h);
    }
    d[k * 2] = fx;
    d[k * 2 + 1] = fz;
    q[(k + 1) * 2] = q[k * 2] + fx * SEG[k];
    q[(k + 1) * 2 + 1] = q[k * 2 + 1] + fz * SEG[k];
  }
  // segment k runs from Q(k) toward the tail; the front bones look up the body (-d), the back ones down it (d)
  const hd = (k: number, sgn: number) => headingOf(d[k * 2] * sgn, d[k * 2 + 1] * sgn);
  const root = hd(2, -1);
  out.fill(0);
  out[SHOULDER] = wrapA(hd(1, -1) - hd(2, -1));
  out[NECK] = wrapA(hd(0, -1) - hd(1, -1));
  out[HIP] = wrapA(hd(4, 1) - hd(3, 1));
  out[4] = wrapA(hd(5, 1) - hd(4, 1));
  out[3] = wrapA(hd(6, 1) - hd(5, 1));
  out[2] = wrapA(hd(7, 1) - hd(6, 1));
  out[1] = wrapA(hd(8, 1) - hd(7, 1));
  return { x: q[6], z: q[7], heading: root };
}

let FILE: Promise<THREE.Object3D> | null = null;
function load(url: string) {
  if (!FILE) {
    const l = new GLTFLoader();
    l.setMeshoptDecoder(typeof MeshoptDecoder === 'function' ? (MeshoptDecoder as any)() : MeshoptDecoder);
    FILE = new Promise((res, rej) => l.load(url, (g) => res(g.scene), undefined, rej));
  }
  return FILE;
}

function Serpent({ sim, f }: { sim: Sim; f: Fighter }) {
  const def = giantOf(f)!;
  const group = useRef<THREE.Group>(null);
  const [body, setBody] = useState<SerpentBody | null>(null);
  useEffect(() => {
    let alive = true;
    load(`${import.meta.env.BASE_URL}models/${def.model}`)
      .then((scene) => {
        if (!alive) return;
        const b = buildSerpent(scene.clone(true));
        ((globalThis as any).__T2_OBJ ??= {})[f.id] = b.root;
        setBody(b);
      })
      .catch((e) => console.warn('[tq2] serpent', e));
    return () => {
      alive = false;
    };
  }, [def]);
  const live = useMemo(() => ({ ...serpentLive(), last: [f.pos[0], f.pos[2]] as [number, number], lastYaw: f.yaw, turnR: 0, speed: 0, deadT: 0, lastHit: -1, flash: 0, h: new Float32Array(10).fill(NaN), sprayT: new Float32Array(10), bowT: 0 }), [f]);
  const V = useMemo(() => new THREE.Vector3(), []);
  const path = useMemo(() => ({ P: pathLive(), yaw: new Float32Array(10) }), [f]);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const p = sim.player.pos;
    live.deadT = f.hp > 0 ? 0 : live.deadT + dt;
    g.visible = !(f as any).benched && sim.indoor < 0 && Math.hypot(f.pos[0] - p[0], f.pos[2] - p[2]) < 200 && live.deadT < 6;
    if (!g.visible || !body) {
      WATER_BODY.uBodyOn.value = 0;
      return;
    }
    // the body along its path: the group sits at its middle, turned the middle's way; the bones bend it along the path
    const lay = bodyPath(path.P, f.pos[0], f.pos[2], f.yaw + Math.PI, Math.min(dt, 0.1), path.yaw);
    g.position.set(lay.x, f.pos[1], lay.z);
    g.rotation.y = lay.heading;
    const sp = Math.hypot(f.pos[0] - live.last[0], f.pos[2] - live.last[1]) / Math.max(dt, 1e-3);
    live.last = [f.pos[0], f.pos[2]];
    live.speed += (Math.min(sp, 30) - live.speed) * Math.min(1, dt * 5);
    const dyaw = ((f.yaw - live.lastYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    live.lastYaw = f.yaw;
    live.turnR += (dyaw / Math.max(dt, 1e-3) - live.turnR) * Math.min(1, dt * 6);
    // where you are against its nose (the head's way, not the sim's facing: it swims rings round you, eyes on you)
    const look = Math.max(-0.95, Math.min(0.95, wrapA(headingOf(p[0] - f.pos[0], p[2] - f.pos[2]) - path.P.hv)));
    // low in deep water (the back at the water line), on its feet in the shallows and on the bank
    const ground = groundHeight(f.pos[0], f.pos[2]);
    const swim = clamp01((WATER_Y - 0.3 - ground) / 1.3);
    const wade = swim * Math.min(0, WATER_Y + 0.15 - (f.pos[1] + SP[ROOT][1] * S));
    const st = (f as any).giant as { move: { m: { id: string; wind: number }; t: number } | null; open: number } | undefined;
    poseSerpent(body, live, { dt, chain: path.yaw, speed: live.speed, turn: 0, look, swim, move: st?.move ? { id: st.move.m.id, wind: st.move.m.wind, t: st.move.t } : null, open: (st?.open ?? 0) > 0, dead: live.deadT, wade });
    // where it cuts the water: white water round it (the river shader), spray where it breaks the surface fast
    g.updateMatrixWorld(true);
    let on = 0;
    live.bowT -= dt;
    for (let i = 0; i < BODY_N; i++) {
      body.bones[i].getWorldPosition(V);
      const R = GIRTH[i] * S, h = V.y - WATER_Y, u = WATER_BODY.uBody.value[i];
      const wet = Math.abs(h) < R && swim > 0.2;
      u.set(V.x, V.z, wet ? Math.sqrt(R * R - h * h) : 0, wet ? (0.55 + 0.45 * Math.min(1, live.speed / 4)) * swim : 0);
      if (wet) on = 1;
      const was = live.h[i];
      live.h[i] = h;
      live.sprayT[i] -= dt;
      if (swim > 0.2 && Number.isFinite(was) && Math.sign(was) !== Math.sign(h) && live.sprayT[i] <= 0 && WATER_FX.length < 40) {
        const v = Math.abs(h - was) / Math.max(dt, 1e-3);
        if (v > 1.5) {
          live.sprayT[i] = 0.35;
          WATER_FX.push({ x: V.x, z: V.z, n: Math.min(18, 4 + v * 2), p: Math.min(2.4, 0.7 + v * 0.18), r: R + 2 + v * 0.4 });
        }
      }
      if (i === HEAD && wet && live.speed > 2.5 && live.bowT <= 0 && WATER_FX.length < 40) {
        live.bowT = 0.3;
        WATER_FX.push({ x: V.x, z: V.z, n: 3, p: 0.8 });
      }
    }
    WATER_BODY.uBodyOn.value = on;
    // its skin: the giant's colour faint under the scales, gold while it stands open, white when struck
    const ha = (f as any).hitAt;
    if (ha !== undefined && ha !== live.lastHit) {
      if (live.lastHit !== -1) live.flash = (f as any).hitHeavy ? 1 : 0.6;
      live.lastHit = ha;
    }
    live.flash *= Math.exp(-dt * 14);
    const t = performance.now() / 1000, ph = giantPhase(f);
    const c = new THREE.Color(def.color).multiplyScalar((0.05 + ph * 0.02 + Math.sin(t * (ph * 2 + 2)) * 0.03) * 0.5);
    if (giantOpen(f) > 0) c.add(new THREE.Color('#ffc23a').multiplyScalar(0.02 + Math.sin(t * 9) * 0.012)); // open: a faint gold pulse (it used to gild the whole body flat)
    const fl = live.flash * live.flash * 0.7;
    for (const m of body.mats) m.emissive.setRGB(c.r + fl, c.g + fl, c.b + fl);
  });
  return <group ref={group}>{body && <primitive object={body.root} />}</group>;
}

/** every serpent giant (giants.ts look 'serpent') */
export function GiantSerpent({ sim }: { sim: Sim }) {
  const list = useMemo(() => sim.fighters.filter((f) => giantOf(f)?.look === 'serpent'), [sim]);
  return (
    <>
      {list.map((f) => (
        <Serpent key={f.id} sim={sim} f={f} />
      ))}
    </>
  );
}

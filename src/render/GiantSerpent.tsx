// 覆舟河蛟 (owner: it must not stand on its hind legs; a river dragon swims): the owner's Tripo dragon (crouched, four
// clawed legs, a long tail with a fin) given bones made here: a spine from its middle forward to the shoulders, neck
// and head and back through the hips to the fin, and a bone for each leg. Skin weights by the place along the body;
// the legs to their own bones, the head rigid. In deep water it lies low, the back, the head and the tail's ridge out,
// a wave running down the body to the fin, the legs tucked back and paddling, the head up and watching you; on the
// bank it walks crouched. Its moves are poses on the sim's clock: rearing with its claws up and lunging for the bite,
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
/** each leg's bone: where it meets the body (x, y, z), the spine bone it hangs from; 10, 11 the forelegs, 12, 13 the hind */
const LEGS: { at: [number, number, number]; on: number }[] = [
  { at: [0.1, 0.17, 0.24], on: SHOULDER },
  { at: [-0.1, 0.17, 0.24], on: SHOULDER },
  { at: [0.13, 0.2, -0.13], on: ROOT },
  { at: [-0.13, 0.2, -0.13], on: ROOT },
];
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

/** the file's mesh made a skinned body with its spine and legs (scene: the loaded glTF's, cloned) */
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
  // the spine: the middle is the root, the chain runs forward to the head and back to the fin; the legs hang off it
  const bones = [...SP, ...LEGS].map(() => new THREE.Bone());
  const parent = (i: number) => (i < ROOT ? i + 1 : i - 1);
  SP.forEach(([z, y], i) => {
    if (i === ROOT) bones[i].position.set(0, y, z);
    else {
      const [pz, py] = SP[parent(i)];
      bones[i].position.set(0, y - py, z - pz);
      bones[parent(i)].add(bones[i]);
    }
  });
  LEGS.forEach((l, k) => {
    const b = bones[10 + k], [pz, py] = SP[l.on];
    b.position.set(l.at[0], l.at[1] - py, l.at[2] - pz);
    bones[l.on].add(b);
  });
  // weights: along the body between the two nearest spine bones; a leg to its own bone; the head rigid
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
      }
    };
    const head = smooth(0.265, 0.305, z) * smooth(0.18, 0.24, y);
    const leg = Math.max(smooth(0.3, 0.2, y) * smooth(0.075, 0.11, Math.abs(x)), smooth(0.11, 0.06, y)) * (1 - head);
    put(10 + (z > 0.08 ? 0 : 2) + (x >= 0 ? 0 : 1), leg);
    put(HEAD, head);
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

/** what the body is doing, eased toward each frame */
export const serpentLive = () => ({ ph: 0, spin: 0, pitch: new Float32Array(14), yaw: new Float32Array(14), y: 0, z: 0, roll: 0, rootPitch: 0, wade: 0 });
export type SerpentLive = ReturnType<typeof serpentLive>;
export interface SerpentIn {
  dt: number;
  /** metres a second */
  speed: number;
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
}

const ease = (x: number) => 1 - (1 - x) * (1 - x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const WAVE = [0.05, 0.08, 0.11, 0.14, 0.16, 0.18];
/** in the water the tail lies along the surface (in the file it is held up behind) */
const TAIL_DOWN: Record<number, number> = { 5: -0.45, 4: -0.3, 3: 0.15, 2: 0.15, 1: -0.05 };

/** sets the bones and the body's lift, turn and roll for this moment */
export function poseSerpent(body: SerpentBody, L: SerpentLive, I: SerpentIn) {
  const dt = Math.min(I.dt, 0.1);
  L.ph += dt * (1.6 + Math.min(I.speed, 12) * 0.3);
  const Y = new Float32Array(14), X = new Float32Array(14);
  let lift = 0, push = 0, roll = Math.sin(L.ph) * 0.03 * I.swim, rootPitch = 0, spin = 0;
  // swimming: a wave down the body to the fin (bigger as it goes faster), small humps, the tail along the water
  const amp = 0.8 + Math.min(1, I.speed / 6) * 0.7;
  BACK.forEach((b, j) => {
    Y[b] = amp * WAVE[j] * Math.sin(L.ph - j * 0.85);
    X[b] = (TAIL_DOWN[b] ?? 0) * I.swim + 0.05 * I.swim * Math.sin(L.ph * 0.7 - j * 1.1);
  });
  // the shoulders steady against the wave, the head watches you
  Y[SHOULDER] = -Y[HIP] * 0.6 + I.look * 0.25;
  Y[NECK] = I.look * 0.3;
  Y[HEAD] = I.look * 0.25;
  X[SHOULDER] = -0.06 * I.swim; // in the water the head is held up
  X[NECK] = -0.04 * I.swim + Math.sin(L.ph * 0.5) * 0.04;
  X[HEAD] = 0.08 * I.swim + Math.sin(L.ph * 0.5 + 1) * 0.04;
  // legs: tucked back and paddling in deep water, striding on the bank (diagonal pairs together)
  const stroke = I.swim > 0.5 ? 0.3 : 0.4 * Math.min(1, I.speed / 3);
  for (let k = 0; k < 4; k++) {
    const off = k === 0 || k === 3 ? 0 : Math.PI, rear = k >= 2;
    X[10 + k] = 0.55 * I.swim * (rear ? 1.2 : 0.8) + stroke * Math.sin(L.ph * 0.9 + off);
  }
  const claws = (k: number) => {
    X[10] += -0.8 * k;
    X[11] += -0.8 * k;
  };
  // its moves, on the sim's clock (the strike falls at t = wind)
  const mv = I.dead ? null : I.move;
  if (mv) {
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
      case 'jbite': // rears, claws up, and lunges
        rear(pre * (1 - hit));
        claws(pre * (1 - hit) * 0.7 + hit * 0.4);
        X[SHOULDER] += 0.3 * hit;
        X[NECK] += 0.4 * hit;
        X[HEAD] += -0.2 * hit;
        push += 0.2 * hit;
        break;
      case 'jtail': {
        // the tail drawn round to one side, then whipped across
        const sw = clamp01(post / 0.3);
        BACK.forEach((b, j) => {
          Y[b] += (0.3 * pre * (1 - sw) - 0.45 * sw * Math.max(0, 1 - post)) * (0.6 + j * 0.15);
        });
        Y[SHOULDER] += -0.3 * pre * (1 - sw) + 0.3 * sw * Math.max(0, 1 - post);
        spin = (t > W ? 3.2 : 0) * Math.max(0, 1 - post);
        break;
      }
      case 'spout': {
        rear(pre);
        const on = t > W ? Math.max(0, 1 - post) : 0;
        X[NECK] += 0.3 * on;
        X[HEAD] += -0.3 * on + (on > 0 ? Math.sin(t * 40) * 0.03 : 0);
        break;
      }
      case 'whirl': {
        // curls into a ring and turns
        const c = Math.max(pre, t > W ? Math.max(0, 1 - post * 0.6) : 0);
        BACK.forEach((b) => (Y[b] += 0.45 * c));
        Y[SHOULDER] += 0.35 * c;
        Y[NECK] += 0.3 * c;
        spin = 2.8 * c;
        break;
      }
      case 'dive': {
        // under, then up out of the water onto you
        const R = 0.55, up = t > W - R ? clamp01((t - (W - R)) / R) : 0;
        lift += -0.3 * pre * (1 - up) + 0.05 * up * (1 - hit);
        X[SHOULDER] += 0.3 * pre * (1 - up) - 0.45 * up * (1 - hit) + 0.25 * hit;
        X[NECK] += 0.2 * pre * (1 - up) - 0.35 * up * (1 - hit) + 0.35 * hit;
        claws(up * (1 - hit) + hit * 0.5);
        rootPitch += 0.15 * pre * (1 - up) - 0.18 * up * (1 - hit);
        break;
      }
      default: {
        // 暴雨 / 怒潮: rears high, roaring at the sky, then slams down
        rear(pre * (1 - hit) * 1.2);
        claws(pre * (1 - hit));
        X[HEAD] += -0.35 * pre * (1 - hit);
        X[SHOULDER] += 0.32 * hit;
        X[NECK] += 0.3 * hit;
        break;
      }
    }
  } else if (I.open && !I.dead) {
    // open: the head laid down on the water, panting, the claws limp
    X[SHOULDER] += 0.3;
    X[NECK] += 0.42 + Math.sin(L.ph * 1.5) * 0.05;
    X[HEAD] += -0.12;
    X[10] += 0.4;
    X[11] += 0.4;
    lift -= 0.06;
  }
  if (I.dead) {
    // over on its side and down
    roll = Math.min(2.4, I.dead * 1.3);
    lift = -Math.min(0.45, I.dead * 0.1);
    BACK.forEach((b) => (Y[b] = 0.12));
  }
  // ease every joint toward its target
  const k = 1 - Math.exp(-dt * 10);
  for (let i = 0; i < 14; i++) {
    L.yaw[i] += (Y[i] - L.yaw[i]) * k;
    L.pitch[i] += (X[i] - L.pitch[i]) * k;
    body.bones[i].rotation.set(L.pitch[i], L.yaw[i], 0);
  }
  L.y += (lift - L.y) * k;
  L.z += (push - L.z) * k;
  L.roll += (roll - L.roll) * k;
  L.rootPitch += (rootPitch - L.rootPitch) * k;
  L.wade += (I.wade - L.wade) * (1 - Math.exp(-dt * 3));
  if (spin) L.spin += spin * dt;
  else L.spin -= Math.sin(L.spin) * Math.min(1, dt * 2); // back to facing its way
  body.inner.position.set(0, L.y + L.wade / S, -ZC + L.z);
  body.inner.rotation.set(L.rootPitch, L.spin, L.roll);
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
  const live = useMemo(() => ({ ...serpentLive(), last: [f.pos[0], f.pos[2]] as [number, number], speed: 0, deadT: 0, lastHit: -1, flash: 0, h: new Float32Array(10).fill(NaN), sprayT: new Float32Array(10), bowT: 0 }), [f]);
  const V = useMemo(() => new THREE.Vector3(), []);
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
    g.position.set(f.pos[0], f.pos[1], f.pos[2]);
    g.rotation.y = f.yaw + Math.PI;
    const sp = Math.hypot(f.pos[0] - live.last[0], f.pos[2] - live.last[1]) / Math.max(dt, 1e-3);
    live.last = [f.pos[0], f.pos[2]];
    live.speed += (Math.min(sp, 30) - live.speed) * Math.min(1, dt * 5);
    // where you are against its nose
    const dx = p[0] - f.pos[0], dz = p[2] - f.pos[2], dl = Math.hypot(dx, dz) || 1;
    const fx = -Math.sin(f.yaw), fz = -Math.cos(f.yaw), lx = -Math.cos(f.yaw), lz = Math.sin(f.yaw);
    const look = Math.max(-0.7, Math.min(0.7, Math.atan2((dx * lx + dz * lz) / dl, (dx * fx + dz * fz) / dl)));
    // low in deep water (the back at the water line), on its feet in the shallows and on the bank
    const ground = groundHeight(f.pos[0], f.pos[2]);
    const swim = clamp01((WATER_Y - 0.3 - ground) / 1.3);
    const wade = swim * Math.min(0, WATER_Y + 0.15 - (f.pos[1] + SP[ROOT][1] * S));
    const st = (f as any).giant as { move: { m: { id: string; wind: number }; t: number } | null; open: number } | undefined;
    poseSerpent(body, live, { dt, speed: live.speed, look, swim, move: st?.move ? { id: st.move.m.id, wind: st.move.m.wind, t: st.move.t } : null, open: (st?.open ?? 0) > 0, dead: live.deadT, wade });
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
    if (giantOpen(f) > 0) c.lerp(new THREE.Color('#ffd84a'), 0.3 + Math.sin(t * 12) * 0.12);
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

// The land: terrain coloured by height and paths, scattered trees, the village in the middle and the seven camps.
import { useEffect, useMemo, useRef, useState } from 'react';
import { GLTFLoader, MeshoptDecoder } from 'three-stdlib';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { BUILDINGS, groundHeight } from '../game/world';
import { Landscape } from './Terrain';
import { Tianque } from './Tianque';
import { Gudao } from './Gudao';
import { Places } from './Places';
import { Builder, Built } from './build';
import { ROADS } from '../game/layout';
import { DENS, DEN_R, FOE_KINDS } from '../game/foes';
import type { Sim } from '../game/sim';

/** a Tripo prop (public/props): loaded once, cloned per placement (geometry and textures shared) */
import { liftProp } from './propLook';
import { DECOR, fit } from '../game/props';
import { Animals } from './Animals';
import { CT_POS, CT_ROT, CT_Y, WALL_X } from '../game/court';
import { Climate } from './Climate';
import { PlayThings } from './Play';
import { Festive } from './Festive';
import { War } from './War';
import { Stockade } from './Stockade';
import { Calls } from './Calls';
import { Interiors } from './Interiors';
const propCache = new Map<string, Promise<THREE.Group>>();
const propLoader = new GLTFLoader();
propLoader.setMeshoptDecoder(typeof MeshoptDecoder === 'function' ? (MeshoptDecoder as any)() : MeshoptDecoder);
function loadProp(file: string) {
  let p = propCache.get(file);
  if (!p) {
    p = propLoader.loadAsync(import.meta.env.BASE_URL + 'props/' + file).then((g) => {
      g.scene.traverse((o: any) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      liftProp(g.scene, file);
      return g.scene;
    });
    propCache.set(file, p);
  }
  return p;
}
/** a model on the map: loaded once the camera comes within reach, drawn only while it's near enough to matter
 *  (big buildings from far off, a lion or a stall only close by) */
export function Prop({ file, x, z, rot, scale, turn = 0, lift = -0.25 }: { file: string; x: number; z: number; rot: number; scale: number; turn?: number; lift?: number }) {
  const [obj, setObj] = useState<THREE.Object3D | null>(null);
  const [near, setNear] = useState(false);
  const ref = useRef<THREE.Object3D>(null);
  const view = scale >= 9 ? 720 : 320;
  useFrame(({ camera }) => {
    const d = Math.hypot(camera.position.x - x, camera.position.z - z);
    if (!near && d < view + 120) setNear(true);
    if (ref.current) ref.current.visible = d < view;
  });
  useEffect(() => {
    if (!near) return;
    let alive = true;
    loadProp(file)
      .then((s) => alive && setObj(s.clone()))
      .catch((e) => console.warn('[tq2] prop', file, e));
    return () => {
      alive = false;
    };
  }, [file, near]);
  if (!obj) return null;
  return <primitive ref={ref} object={obj} position={[x, groundHeight(x, z) + lift, z]} rotation={[0, rot + turn, 0]} scale={scale} />;
}

/** a seeded random in 0..1 */
const rnd = (a: number, b = 0) => {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
/** the bearings of the roads leaving the village (radians), to keep fences and fields off them */
const ROAD_A = ROADS.map((r) => Math.atan2(r[2][1], r[2][0]));
const offRoad = (a: number, gap: number) => ROAD_A.every((ra) => Math.abs(Math.atan2(Math.sin(a - ra), Math.cos(a - ra))) > gap);

function buildVillage() {
  const b = new Builder();
  const gy = (x: number, z: number) => groundHeight(x, z);
  // the square: flagstones in rings round the well
  for (let r = 1.6; r < 14.5; r += 0.92) {
    const n = Math.round((Math.PI * 2 * r) / 0.95);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r;
      const x = Math.cos(a) * r, z = Math.sin(a) * r - 3;
      const w = 0.8 + rnd(k, r) * 0.22;
      const v = rnd(r, k);
      b.box(v > 0.85 ? 'rock' : v > 0.4 ? 'pave' : 'pave2', x, gy(x, z) - 0.07 + rnd(k * 2, r) * 0.03, z, w, 0.12, 0.84, -a);
    }
  }
  // flagstone lanes out along each road to the village edge
  for (const ra of ROAD_A)
    for (let r = 15; r < 33; r += 1.2)
      for (const off of [-1.6, -0.5, 0.6, 1.7]) {
        const x = Math.cos(ra) * r - Math.sin(ra) * off, z = Math.sin(ra) * r + Math.cos(ra) * off;
        if (rnd(r * 3, off) < 0.18) continue;
        b.box(rnd(off, r) > 0.5 ? 'pave' : 'pave2', x, gy(x, z) - 0.06, z, 1.0, 0.12, 1.05, Math.PI / 2 - ra + rnd(r, off) * 0.2);
      }
  // the old locust tree in the square, in a stone ring
  {
    const tx = 8, tz = -9;
    const y = gy(tx, tz);
    for (let k = 0; k < 14; k++) b.box('rock', tx + Math.cos((k / 14) * 6.28) * 2.2, y, tz + Math.sin((k / 14) * 6.28) * 2.2, 0.9, 0.5, 0.6, -(k / 14) * 6.28);
    b.add('log', new THREE.CylinderGeometry(0.55, 0.9, 6, 9), tx, y + 3, tz);
    for (const [bx, by, bz, br] of [
      [0, 6.5, 0, 3.2],
      [2.2, 5.6, 1, 2.4],
      [-2, 5.8, -1, 2.5],
      [0.6, 7.6, -1.6, 2.2],
      [-1, 6.2, 2, 2.1],
    ]) {
      const g = new THREE.IcosahedronGeometry(br, 1);
      g.scale(1, 0.75, 1);
      b.add('leaf', g, tx + bx, y + by, tz + bz);
    }
  }
  // (the old rail fence is gone: render/Stockade.tsx draws 青石村's stockade)
  // red lanterns on posts where each road leaves the square and at the fence gaps
  for (const ra of ROAD_A)
    for (const r of [15, 34])
      for (const s of [-1, 1]) {
        const x = Math.cos(ra) * r - Math.sin(ra) * s * 3.4, z = Math.sin(ra) * r + Math.cos(ra) * s * 3.4;
        const y = gy(x, z);
        b.add('log', new THREE.CylinderGeometry(0.1, 0.13, 3.2, 6), x, y + 1.6, z);
        b.box('log', x, y + 3.1, z, 0.08, 0.08, 0.9, Math.PI / 2 - ra);
        const lx = x + Math.cos(ra) * 0.0 - Math.sin(ra) * s * -0.4, lz = z + Math.sin(ra) * 0.0 + Math.cos(ra) * s * -0.4;
        const g = new THREE.SphereGeometry(0.32, 10, 8);
        g.scale(1, 1.25, 1);
        b.add('lamp', g, lx, y + 2.65, lz);
      }
  // fields beyond the fence in some of the gaps between roads: furrows of soil with rows of green, haystacks
  for (let k = 0; k < ROAD_A.length; k++) {
    if (k % 2 === 1) continue;
    let a0 = ROAD_A[k], a1 = ROAD_A[(k + 1) % ROAD_A.length];
    if (a1 < a0) a1 += Math.PI * 2;
    const am = (a0 + a1) / 2;
    const cx = Math.cos(am) * 52, cz = Math.sin(am) * 52;
    const ry = -am;
    const ux = Math.cos(am), uz = Math.sin(am);
    const vx = -uz, vz = ux;
    for (let row = -5; row <= 5; row++) {
      for (let t = -8; t <= 8; t += 1) {
        const x = cx + vx * row * 1.6 + ux * t * 1.0, z = cz + vz * row * 1.6 + uz * t * 1.0;
        const y = gy(x, z);
        b.box('soil', x, y - 0.1, z, 1.05, 0.22, 0.9, ry);
        if (rnd(row, t + k) < 0.85) {
          const g = new THREE.ConeGeometry(0.32, 0.6 + rnd(t, row) * 0.3, 5);
          b.add('crop', g, x, y + 0.38, z);
        }
      }
    }
    for (let h = 0; h < 3; h++) {
      const x = cx + vx * (11 + h * 2.6) + ux * (h - 1) * 3, z = cz + vz * (11 + h * 2.6) + uz * (h - 1) * 3;
      const y = gy(x, z);
      b.add('hay', new THREE.CylinderGeometry(1.1, 1.25, 1.2, 10), x, y + 0.6, z);
      b.add('hay', new THREE.ConeGeometry(1.25, 1.3, 10), x, y + 1.85, z);
    }
  }
  // barrels and crates against the houses, a cart by the well
  BUILDINGS.forEach((h, i) => {
    if (h.model !== 'house.glb') return;
    const c = Math.cos(h.rot), s = Math.sin(h.rot);
    const at = (lx: number, lz: number): [number, number] => [h.x + lx * c + lz * s, h.z - lx * s + lz * c];
    const side = i % 2 ? 1 : -1;
    const [x1, z1] = at(side * (h.hx + 0.8), h.hz - 1);
    b.add('plank', new THREE.CylinderGeometry(0.42, 0.42, 1, 10), x1, gy(x1, z1) + 0.5, z1);
    const [x2, z2] = at(side * (h.hx + 0.9), h.hz - 2.1);
    b.add('plank', new THREE.CylinderGeometry(0.42, 0.42, 1, 10), x2, gy(x2, z2) + 0.5, z2);
    const [x3, z3] = at(-side * (h.hx + 0.9), h.hz - 1.5);
    b.box('log', x3, gy(x3, z3), z3, 1.0, 0.9, 1.0, h.rot + 0.3);
    b.box('plank', x3, gy(x3, z3) + 0.9, z3, 0.7, 0.6, 0.7, h.rot - 0.2);
  });
  {
    const x = -7, z = -6, y = gy(x, z);
    b.box('plank', x, y + 0.75, z, 1.6, 0.15, 2.6, 0.4);
    for (const s of [-1, 1]) b.box('plank', x + Math.cos(0.4) * s * 0.75, y + 0.95, z - Math.sin(0.4) * s * 0.75, 0.08, 0.4, 2.6, 0.4);
    for (const s of [-1, 1]) {
      const g = new THREE.CylinderGeometry(0.62, 0.62, 0.1, 12);
      g.rotateZ(Math.PI / 2);
      b.add('log', g, x + Math.cos(0.4) * s * 0.9, y + 0.62, z - Math.sin(0.4) * s * 0.9, 0.4);
    }
    b.box('hay', x, y + 0.85, z, 1.2, 0.5, 1.6, 0.4);
  }
  // (the well is a Tripo model now: a building in world.ts)
  return b.build();
}

/** 永安城's paving (court.ts has its buildings): the great courtyard of flagstones, the imperial way down its middle,
 *  stone lanterns along it, and the street outside the gate */
function buildCourt() {
  const L = new Builder();
  const y = CT_Y;
  L.box('pave', 0, y - 0.08, -14, WALL_X * 2 - 4, 0.14, 80);
  L.box('pave2', 0, y - 0.04, 1, 11, 0.12, 102);
  // kerbs along the way
  for (const s of [-1, 1]) L.box('stone', s * 5.8, y - 0.04, 1, 0.5, 0.2, 102);
  for (const lz of [33, 19, 5, -9]) for (const s of [-1, 1]) L.lantern(s * 14, y, lz);
  // outside: the street of 关厢
  L.box('pave', 0, y - 0.08, 88, 18, 0.14, 70);
  for (const lz of [64, 80, 96, 112]) for (const s of [-1, 1]) L.lantern(s * 8.5, y, lz);
  const W = new Builder();
  W.merge(L, CT_POS[0], 0, CT_POS[1], CT_ROT);
  return W.build();
}
function Court() {
  const parts = useMemo(buildCourt, []);
  return <Built parts={parts} />;
}

function Village() {
  const parts = useMemo(buildVillage, []);
  return (
    <group>
      {BUILDINGS.map((b, i) => b.model && <Prop key={i} file={b.model} x={b.x} z={b.z} rot={b.rot} scale={b.scale} turn={b.turn} lift={b.lift} />)}
      {DECOR.map((d, i) => {
        const g = fit(d.file, d.size);
        return <Prop key={'d' + i} file={d.file} x={d.x} z={d.z} rot={d.rot} scale={g.scale} turn={g.turn} lift={g.lift} />;
      })}
      <Built parts={parts} />
    </group>
  );
}

/** every den's wooden things in one build: a palisade of sharpened logs, round tents, a watchtower, crates, the fire */
function buildDens() {
  const b = new Builder();
  DENS.forEach((d, i) => {
    if (d.peak) return;
    const gy = (x: number, z: number) => groundHeight(x, z);
    // the palisade, with two gates
    const R = DEN_R + 0.5;
    const n = Math.round((Math.PI * 2 * R) / 0.42);
    const g0 = rnd(i, 3) * 6.28;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const ga = Math.min(Math.abs(Math.atan2(Math.sin(a - g0), Math.cos(a - g0))), Math.abs(Math.atan2(Math.sin(a - g0 - Math.PI), Math.cos(a - g0 - Math.PI))));
      if (ga < 0.2) continue;
      const x = d.x + Math.cos(a) * R, z = d.z + Math.sin(a) * R;
      const h = 2.3 + rnd(k, i) * 0.7;
      const y = gy(x, z);
      b.add('log', new THREE.CylinderGeometry(0.19, 0.21, h, 6), x, y + h / 2 - 0.2, z);
      b.add('log', new THREE.ConeGeometry(0.19, 0.45, 6), x, y + h - 0.2 + 0.22, z);
    }
    // gate posts
    for (const ga of [g0, g0 + Math.PI])
      for (const s of [-1, 1]) {
        const a = ga + s * 0.22;
        const x = d.x + Math.cos(a) * R, z = d.z + Math.sin(a) * R;
        b.add('log', new THREE.CylinderGeometry(0.26, 0.28, 4, 7), x, gy(x, z) + 1.8, z);
      }
    // (the tents and the watchtower are Tripo models: props.ts DECOR)
    // crates, barrels, a weapon rack
    for (let k = 0; k < 4; k++) {
      const a = i * 1.3 + k * 0.5 + 2.6;
      const x = d.x + Math.cos(a) * 6, z = d.z + Math.sin(a) * 6;
      const y = gy(x, z);
      if (k % 2) b.add('plank', new THREE.CylinderGeometry(0.4, 0.4, 0.95, 9), x, y + 0.47, z);
      else b.box('log', x, y, z, 0.9, 0.85, 0.9, a);
    }
    {
      const a = i * 1.3 + 4.4;
      const x = d.x + Math.cos(a) * 6.5, z = d.z + Math.sin(a) * 6.5;
      const y = gy(x, z);
      for (const s of [-1, 1]) b.box('log', x + Math.sin(a) * s * 0.9, y, z - Math.cos(a) * s * 0.9, 0.12, 1.6, 0.12);
      b.box('log', x, y + 1.4, z, 0.1, 0.1, 2.0, -a);
      for (let w = -2; w <= 2; w++) b.box('rock', x + Math.sin(a) * w * 0.35, y + 0.2, z - Math.cos(a) * w * 0.35, 0.05, 1.5, 0.05, 0.1 * w);
    }
    // the campfire
    {
      const x = d.x + 2.5, z = d.z;
      const y = gy(x, z);
      for (let k = 0; k < 8; k++) b.add('rock', new THREE.DodecahedronGeometry(0.2, 0), x + Math.cos((k / 8) * 6.28) * 0.75, y + 0.1, z + Math.sin((k / 8) * 6.28) * 0.75);
      for (let k = 0; k < 3; k++) {
        const g = new THREE.CylinderGeometry(0.07, 0.08, 1.1, 6);
        g.rotateZ(Math.PI / 2);
        b.add('log', g, x, y + 0.15, z, (k / 3) * Math.PI);
      }
      b.add('flame', new THREE.ConeGeometry(0.34, 0.85, 8), x, y + 0.5, z);
    }
  });
  return b.build();
}

/** the den flags, in each kind's colour (black where the boss is) */
function DenFlags() {
  return (
    <>
      {DENS.map((d, i) => {
        if (d.peak) return null;
        const kind = FOE_KINDS[d.kind];
        const y = groundHeight(d.x - 3, d.z - 3);
        return (
          <group key={i} position={[d.x - 3, y, d.z - 3]}>
            <mesh position={[0, d.boss ? 4 : 2.8, 0]} castShadow>
              <cylinderGeometry args={[0.08, 0.1, d.boss ? 8 : 5.6, 6]} />
              <meshStandardMaterial color="#3a2a1a" />
            </mesh>
            <mesh position={[0.8, d.boss ? 7.1 : 4.9, 0]}>
              <planeGeometry args={[1.6, d.boss ? 1.8 : 1.1]} />
              <meshStandardMaterial color={d.boss ? '#111' : kind.color} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function Dens() {
  const parts = useMemo(buildDens, []);
  return (
    <>
      <Built parts={parts} />
      <DenFlags />
    </>
  );
}

/** sun that follows the player so shadows stay sharp near them */
/** the outdoor world, hidden while the player is in a room (nothing of it shows in there, and it costs nothing) */
function Outdoors({ sim, children }: { sim: Sim; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.visible = sim.indoor < 0;
  });
  return <group ref={ref}>{children}</group>;
}

export function World({ sim }: { sim: Sim }) {
  return (
    <>
      {/* a long clear view: the rim's mountains and 天阙 stand in the haze from the village */}
      <fog attach="fog" args={['#c3d3e0', 240, 1500]} />
      <Climate sim={sim} />
      <Outdoors sim={sim}>
        <Landscape sim={sim} />
        <Village />
        <Court />
        <Stockade />
        <Festive sim={sim} />
        <War sim={sim} />
        <Tianque />
        <Gudao />
        <Places />
        <Dens />
        <Animals sim={sim} />
      </Outdoors>
      <Interiors sim={sim} />
      <Calls sim={sim} />
      <PlayThings sim={sim} />
    </>
  );
}

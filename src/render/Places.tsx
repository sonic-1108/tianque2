// The workshops beyond the village fence and the waystations on the roads (game/places.ts), built from simple
// shapes and merged per material; their banners carry a painted character. The houses at each waystation are the
// house.glb props listed in BUILDINGS (drawn by World's Village).
import { useMemo } from 'react';
import * as THREE from 'three';
import { Builder, Built } from './build';
import { groundHeight } from '../game/world';
import { PLACES, placeAt, type Place } from '../game/places';
import { textTex } from './Gudao';

const rnd = (a: number, b = 0) => {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

function table(b: Builder, x: number, z: number) {
  b.box('plank', x, 0.72, z, 1.6, 0.1, 1.0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('log', x + sx * 0.65, 0, z + sz * 0.38, 0.1, 0.72, 0.1);
  for (const s of [-1, 1]) b.box('plank', x, 0.42, z + s * 0.85, 1.6, 0.08, 0.32);
  b.add('soil', new THREE.CylinderGeometry(0.12, 0.09, 0.22, 8), x + 0.3, 0.88, z);
}
function jar(b: Builder, x: number, z: number, s = 1) {
  const g = new THREE.SphereGeometry(0.45 * s, 10, 8);
  g.scale(1, 1.2, 1);
  b.add('soil', g, x, 0.5 * s, z);
  b.add('cloth', new THREE.CylinderGeometry(0.22 * s, 0.25 * s, 0.12, 8), x, 1.06 * s, z);
}

function smithy() {
  const b = new Builder();
  b.box('step', 0, -0.3, 0, 9.2, 0.42, 7.6);
  for (const x of [-4, 0, 4]) for (const z of [-3.2, 3.2]) b.col('log', x, 0, z, 0.2, 4);
  b.box('pave2', 0, 0, -3.3, 8.4, 3.2, 0.7); // the back wall
  b.box('pave2', -4, 0, -1.3, 0.6, 1.4, 4); // a half wall at one side
  b.roof(0, 4, 0, 8.4, 6.8, 2.2, 1.0, 'tile');
  // the forge: a stone hearth with coals, a chimney through the roof, the bellows
  b.box('rock', -2, 0, -2.1, 2.4, 1.0, 1.6);
  b.box('flame', -2, 1.0, -2.1, 1.4, 0.12, 0.8);
  b.add('rock', new THREE.CylinderGeometry(0.45, 0.6, 6.4, 8), -2, 3.2, -2.6);
  b.box('plank', -3.5, 0.3, -1.6, 0.6, 0.6, 1.1);
  // the anvil on its stump, a trough, the hammers on the wall
  b.col('log', 1.2, 0, 0.4, 0.42, 0.7, 9);
  b.box('dark', 1.2, 0.7, 0.4, 0.9, 0.32, 0.36);
  b.box('dark', 1.75, 0.82, 0.4, 0.35, 0.18, 0.24);
  b.box('plank', 3.0, 0, -1.4, 0.8, 0.7, 2.2);
  b.box('tile', 3.0, 0.66, -1.4, 0.6, 0.06, 2.0);
  for (let k = 0; k < 5; k++) b.box('dark', 0.6 + k * 0.6, 1.4, -2.9, 0.08, 0.9 - (k % 2) * 0.2, 0.08);
  // ingots and charcoal outside
  for (let k = 0; k < 6; k++) b.box('dark', 4.8 + (k % 3) * 0.45, 0.12 * Math.floor(k / 3), 2.5, 0.4, 0.12, 0.8);
  b.box('dark', 5.2, 0, 0.4, 1.1, 0.6, 1.1);
  return b;
}

function tavern() {
  const b = new Builder();
  b.box('step', 0, -0.3, 0, 12.6, 0.42, 9.4);
  // ground floor: plank walls, a wide front of paper screens with the door in the middle, red front columns
  b.box('plank', 0, 0, -0.4, 11, 3.6, 7.4);
  for (let k = -2; k <= 2; k++) b.box(k === 0 ? 'dark' : 'paper', k * 2.1, k === 0 ? 0 : 1.0, 3.35, 1.6, k === 0 ? 2.8 : 1.6, 0.12);
  for (const x of [-5.3, -1.8, 1.8, 5.3]) b.col('red', x, 0, 4.2, 0.22, 3.7);
  b.box('wood', 0, 3.6, 0.2, 12, 0.35, 8.8); // the balcony floor
  for (let k = -6; k <= 6; k++) b.box('wood', k * 0.95, 3.95, 4.5, 0.08, 0.8, 0.08);
  b.box('wood', 0, 4.7, 4.5, 12, 0.1, 0.12);
  // upper floor and its roof
  b.box('plank', 0, 3.95, -0.6, 10, 3, 6.4);
  for (let k = -2; k <= 2; k++) b.box('paper', k * 2, 4.8, 2.62, 1.3, 1.3, 0.1);
  b.roof(0, 6.95, -0.6, 10, 6.4, 2.6, 1.3, 'tile');
  // a red lantern each side of the door
  for (const s of [-1, 1]) {
    const g = new THREE.SphereGeometry(0.34, 10, 8);
    g.scale(1, 1.25, 1);
    b.add('lamp', g, s * 1.3, 2.9, 4.0);
  }
  // tables and jars in the yard
  table(b, -3.5, 7.5);
  table(b, 3.2, 8.2);
  for (let k = 0; k < 5; k++) jar(b, -6.6 + (k % 3) * 0.95, 5.4 + Math.floor(k / 3) * 0.95, 0.9 + rnd(k) * 0.2);
  return b;
}

function shrine() {
  const b = new Builder();
  b.box('stone', 0, -0.2, 0, 6, 0.75, 5.6);
  b.steps(0, 0, 3.7, 2.4, 0.55, 2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.col('red', sx * 2.2, 0.55, sz * 2, 0.2, 3);
  b.box('wall', 0, 0.55, -1.2, 4.4, 3, 1.8);
  b.box('wall', -2.1, 0.55, 0.2, 0.2, 3, 3.8);
  b.box('wall', 2.1, 0.55, 0.2, 0.2, 3, 3.8);
  b.box('wood', 0, 3.55, 0, 5, 0.3, 4.6);
  b.roof(0, 3.85, 0, 4.6, 4.2, 2.2, 1.0, 'tile');
  // the god's niche and the altar, a bronze burner with smoke-dark sticks, a stone lantern each side
  b.box('dark', 0, 1.6, -0.25, 1.6, 1.6, 0.1);
  b.box('stone', 0, 1.6, -0.5, 0.7, 1.1, 0.5);
  b.box('plank', 0, 0.55, 0.6, 2, 0.9, 0.8);
  b.col('bronze', 0, 0, 4.6, 0.55, 0.7, 10);
  for (let k = 0; k < 3; k++) b.box('dark', -0.15 + k * 0.15, 0.7, 4.6, 0.03, 0.5, 0.03);
  for (const s of [-1, 1]) b.lantern(s * 3.4, 0, 4.4);
  // the old stele beside it (its names chiselled away)
  b.box('rock', 4.4, 0, -1, 1.4, 0.5, 1);
  b.box('stone', 4.4, 0.5, -1, 1.1, 2.6, 0.35);
  return b;
}

function inn() {
  const b = new Builder();
  b.box('step', 0, -0.3, 0, 13.6, 0.42, 9.6);
  b.box('plank', 0, 0, -0.8, 12, 4, 7.4);
  for (let k = -2; k <= 2; k++) b.box(k === 0 ? 'dark' : 'paper', k * 2.3, k === 0 ? 0 : 1.2, 2.95, 1.7, k === 0 ? 3 : 1.5, 0.12);
  b.roof(0, 4, -0.8, 12, 7.4, 3, 1.4, 'thatch');
  // the porch: posts and a lean-to awning over the front
  for (const x of [-5.6, -1.9, 1.9, 5.6]) b.col('log', x, 0, 4.6, 0.17, 3);
  b.box('thatch', 0, 3.05, 3.9, 12.6, 0.18, 2.4, 0);
  table(b, -3.2, 3.8);
  table(b, 2.6, 3.8);
  // a lean-to stable on one side with a trough and hay, the woodpile on the other
  for (const z of [-3.6, 0, 3.6]) b.col('log', -9.2, 0, z, 0.15, 2.6);
  b.box('thatch', -8.3, 2.6, 0, 2.8, 0.15, 8);
  b.box('plank', -8.6, 0, 1.8, 0.7, 0.6, 2.6);
  b.add('hay', new THREE.CylinderGeometry(0.9, 1.0, 1, 9), -8.4, 0.5, -2.2);
  for (let k = 0; k < 12; k++) {
    const g = new THREE.CylinderGeometry(0.13, 0.13, 1.4, 6);
    g.rotateX(Math.PI / 2);
    b.add('log', g, 7.6 + (k % 4) * 0.28, 0.13 + Math.floor(k / 4) * 0.25, -2);
  }
  // a well in the yard
  b.add('rock', new THREE.CylinderGeometry(0.8, 0.9, 0.9, 12), 5.5, 0.45, 8.5);
  for (const s of [-1, 1]) b.box('log', 5.5 + s * 0.8, 0, 8.5, 0.12, 2, 0.12);
  b.box('tile', 5.5, 2.05, 8.5, 2.1, 0.1, 1.2);
  return b;
}

/** the low fence round a waystation's yard, open toward the road */
function fence(b: Builder, p: Place, R: number) {
  const n = 64;
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    if (Math.abs(Math.atan2(Math.sin(am - Math.PI / 2), Math.cos(am - Math.PI / 2))) < 0.55) continue; // the gap at local +z
    const [x0, z0] = placeAt(p, Math.cos(a0) * R, Math.sin(a0) * R);
    const [x1, z1] = placeAt(p, Math.cos(a1) * R, Math.sin(a1) * R);
    const y0 = groundHeight(x0, z0), y1 = groundHeight(x1, z1);
    b.add('log', new THREE.CylinderGeometry(0.08, 0.1, 1.3, 6), x0, y0 + 0.55, z0);
    b.box('plank', (x0 + x1) / 2, (y0 + y1) / 2 + 0.8, (z0 + z1) / 2, 0.06, 0.1, Math.hypot(x1 - x0, z1 - z0) + 0.1, Math.atan2(x1 - x0, z1 - z0));
  }
}

/** 断剑冢: a field of broken swords stuck in the ground round a split stele, cairns, a dead tree, rags on poles */
function jianzhong() {
  const b = new Builder();
  for (let k = 0; k < 170; k++) {
    const a = rnd(k, 1) * Math.PI * 2;
    const r = 3 + Math.sqrt(rnd(k, 2)) * 13;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const L = 0.7 + rnd(k, 3) * 1.0; // what's left of the blade above ground
    const broken = rnd(k, 4) < 0.45;
    const sw = new Builder();
    sw.box(rnd(k, 5) < 0.3 ? 'bronze' : 'dark', 0, -0.4, 0, 0.13, L + 0.4, 0.035);
    if (!broken) {
      sw.box('bronze', 0, L, 0, 0.46, 0.08, 0.1);
      sw.box('wood', 0, L + 0.08, 0, 0.07, 0.38, 0.07);
    }
    for (const parts of Object.values(sw.parts))
      for (const g of parts) {
        g.rotateX((rnd(k, 6) - 0.5) * 0.7);
        g.rotateZ((rnd(k, 7) - 0.5) * 0.7);
      }
    b.merge(sw, x, 0, z, rnd(k, 8) * Math.PI);
  }
  // the split stele: its foot standing, its top fallen beside it
  b.box('rock', 0, 0, 0, 2.4, 0.6, 1.6);
  b.box('stone', 0, 0.6, 0, 1.6, 2.2, 0.45);
  const top = new THREE.BoxGeometry(1.6, 1.8, 0.45);
  top.rotateZ(1.35);
  top.rotateY(0.4);
  b.add('stone', top, 1.9, 0.3, 1.1);
  // cairns of stones
  for (let c = 0; c < 6; c++) {
    const a = c * 1.05 + 0.3, r = 8 + (c % 2) * 5;
    for (let k = 0; k < 4; k++) {
      const g = new THREE.SphereGeometry(0.5 - k * 0.1, 7, 5);
      g.scale(1.2, 0.6, 1);
      b.add('rock', g, Math.cos(a) * r, 0.2 + k * 0.42, Math.sin(a) * r);
    }
  }
  // a dead tree
  b.col('log', -6, 0, -7, 0.35, 5, 7);
  for (const [h, a, l] of [[3.2, 0.6, 2.4], [4.1, 2.4, 1.8], [2.4, 4.3, 2], [4.6, 5.4, 1.4]] as const) {
    const g = new THREE.CylinderGeometry(0.06, 0.14, l, 5);
    g.translate(0, l / 2, 0);
    g.rotateZ(1.0);
    g.rotateY(a);
    b.add('log', g, -6, h, -7);
  }
  // rags of seven colours on broken poles
  const RAG = ['red', 'cloth', 'canvas', 'bronze', 'dark', 'wall', 'paper'] as const;
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + 0.2, r = 11 + rnd(k, 9) * 3;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, h = 2.4 + rnd(k, 10) * 1.6;
    const pole = new THREE.CylinderGeometry(0.05, 0.07, h, 5);
    pole.rotateZ((rnd(k, 11) - 0.5) * 0.4);
    b.add('log', pole, x, h / 2, z);
    b.box(RAG[k], x + 0.4, h - 1.1, z, 0.8, 0.9, 0.03, a);
  }
  // the marker at the edge, facing out (its words are a sign, below)
  b.box('rock', 0, 0, 15, 1.4, 0.4, 0.9);
  b.box('stone', 0, 0.4, 15, 0.9, 2.4, 0.3);
  return b;
}

/** 守阙人之墓: a mound ringed with stones, a blank stone, an offering table, a wooden toy sword, two pines, a low wall */
function tomb() {
  const b = new Builder();
  const m = new THREE.SphereGeometry(1, 16, 10);
  m.scale(2.7, 2.3, 3.1);
  b.add('soil', m, 0, -0.3, 0);
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * Math.PI * 2;
    b.box('rock', Math.cos(a) * 2.75, 0, Math.sin(a) * 3.15, 0.7, 0.45, 0.5, -a);
  }
  b.box('rock', 0, 0, 4.0, 1.9, 0.4, 0.8);
  b.box('stone', 0, 0.4, 4.0, 1.4, 2.2, 0.32);
  b.box('stone', 0, 2.6, 4.0, 1.6, 0.25, 0.42);
  b.box('stone', 0, 0, 5.4, 1.6, 0.75, 0.9);
  for (const x of [-0.45, 0, 0.45]) b.box('soil', x, 0.75, 5.4, 0.22, 0.2, 0.22);
  b.box('bronze', 0, 0.75, 5.75, 0.3, 0.3, 0.3);
  // the toy sword stuck in the mound's back
  const ts = new Builder();
  ts.box('plank', 0, 0, 0, 0.1, 1.1, 0.04);
  ts.box('plank', 0, 0.75, 0, 0.36, 0.06, 0.06);
  for (const g of ts.parts.plank) g.rotateX(-0.25);
  b.merge(ts, 0.4, 1.2, -2.7);
  // a low curved wall behind, two pines in front of it
  for (let k = 0; k < 9; k++) {
    const a = Math.PI + 0.25 + (k / 8) * (Math.PI - 0.5);
    b.box('wall', Math.cos(a) * 6, 0, Math.sin(a) * 6, 2.2, 1.3, 0.45, Math.PI / 2 - a);
    b.box('tile', Math.cos(a) * 6, 1.3, Math.sin(a) * 6, 2.4, 0.18, 0.75, Math.PI / 2 - a);
  }
  for (const s of [-1, 1]) {
    b.col('log', s * 4.6, 0, -2.5, 0.22, 2.2, 6);
    for (let k = 0; k < 3; k++) b.add('leaf', new THREE.ConeGeometry(1.7 - k * 0.45, 2.1, 8), s * 4.6, 2.6 + k * 1.2, -2.5);
  }
  // flagstones to the road
  for (let k = 0; k < 8; k++) b.box(k % 2 ? 'pave' : 'pave2', Math.sin(k * 1.7) * 0.2, -0.12, 7 + k * 1.5, 1.5, 0.2, 1.1);
  return b;
}

const SHAPES = { smithy, tavern, shrine, inn, jianzhong, tomb };
const SIGN: Partial<Record<Place['kind'], string>> = { smithy: '铁', tavern: '酒', shrine: '福', inn: '驿' };

function buildPlaces() {
  const b = new Builder();
  const cache: Partial<Record<Place['kind'], Builder>> = {};
  for (const p of PLACES) {
    const shape = (cache[p.kind] ||= SHAPES[p.kind]());
    b.merge(shape, p.x, groundHeight(p.x, p.z) - 0.05, p.z, p.rot);
    if (p.kind === 'inn') fence(b, p, 17.5);
    if (!SIGN[p.kind]) continue;
    // the banner pole at the front corner
    const [fx, fz] = placeAt(p, p.kind === 'inn' ? 7.6 : 5.6, p.kind === 'inn' ? 6 : 4.6);
    b.add('log', new THREE.CylinderGeometry(0.08, 0.11, 6.4, 6), fx, groundHeight(fx, fz) + 3.2, fz);
  }
  return b.build();
}

/** the shop banners: a cloth hung from the pole's arm with the shop's one character on it */
function Banners() {
  const items = useMemo(() => {
    const tex: Partial<Record<Place['kind'], THREE.Texture>> = {};
    return PLACES.filter((p) => SIGN[p.kind]).map((p) => {
      const t = (tex[p.kind] ||= textTex(SIGN[p.kind]!, true, p.kind === 'shrine' ? '#f3d27a' : '#1d1612', p.kind === 'shrine' ? '#8d2a1c' : '#e8dcc0'));
      const [fx, fz] = placeAt(p, p.kind === 'inn' ? 7.6 : 5.6, p.kind === 'inn' ? 6 : 4.6);
      return { t, x: fx, z: fz, y: groundHeight(fx, fz), rot: p.rot + Math.PI / 2 };
    });
  }, []);
  return (
    <>
      {items.map((it, i) => (
        <group key={i} position={[it.x, it.y, it.z]} rotation={[0, it.rot, 0]}>
          <mesh position={[0, 6, 0.6]}>
            <boxGeometry args={[0.07, 0.07, 1.3]} />
            <meshStandardMaterial color="#5e4430" />
          </mesh>
          <mesh position={[0, 4.6, 0.8]} rotation={[0, Math.PI / 2, 0]} castShadow>
            <planeGeometry args={[0.9, 2.6]} />
            <meshStandardMaterial map={it.t} side={THREE.DoubleSide} roughness={1} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** carved words on the landmarks' stones */
function Carved() {
  const items = useMemo(() => {
    const jz = PLACES.find((p) => p.kind === 'jianzhong');
    if (!jz) return [];
    const [x, z] = placeAt(jz, 0, 15.16);
    return [{ t: textTex('断剑冢', true, '#2f2a24', null), x, z, y: groundHeight(jz.x, jz.z) + 1.55, rot: jz.rot, w: 0.7, h: 2.1 }];
  }, []);
  return (
    <>
      {items.map((it, i) => (
        <mesh key={i} position={[it.x, it.y, it.z]} rotation={[0, it.rot, 0]}>
          <planeGeometry args={[it.w, it.h]} />
          <meshStandardMaterial map={it.t} transparent roughness={0.9} />
        </mesh>
      ))}
    </>
  );
}

export function Places() {
  const parts = useMemo(buildPlaces, []);
  return (
    <>
      <Built parts={parts} />
      <Banners />
      <Carved />
    </>
  );
}

// 天阙古道: the last climb of the north west road up to 天阙. Paved with tilted flagstones that follow the slope, a
// stone arch at its foot with a stele beside it, stone lanterns all the way up, and 望阙台, a lookout terrace with a
// pavilion half way. All merged into one mesh per material. Solid posts are in game/world.ts (BUILDINGS).
import { useMemo } from 'react';
import * as THREE from 'three';
import { Builder, Built } from './build';
import { groundHeight } from '../game/world';
import { GD_ARCH_R, GD_END_R, GD_PAV, GD_PAV_R, TQ_ROAD, roadFrame } from '../game/layout';

type Frame = ReturnType<typeof roadFrame>;
/** a point in a road frame (local x across, local z along the road outward) to world x, z */
const at = (f: { x: number; z: number; ux: number; uz: number }, lx: number, lz: number): [number, number] => [f.x + lx * f.uz + lz * f.ux, f.z - lx * f.ux + lz * f.uz];

function lanternShape() {
  const b = new Builder();
  b.box('stone', 0, 0, 0, 1.1, 0.35, 1.1);
  b.col('stone', 0, 0.35, 0, 0.2, 1.3, 8);
  b.box('stone', 0, 1.65, 0, 0.9, 0.22, 0.9);
  b.box('paper', 0, 1.87, 0, 0.55, 0.55, 0.55);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('stone', sx * 0.3, 1.87, sz * 0.3, 0.1, 0.55, 0.1);
  b.box('stone', 0, 2.42, 0, 1.05, 0.24, 1.05);
  b.box('stone', 0, 2.66, 0, 0.55, 0.22, 0.55);
  return b;
}

function archShape() {
  const b = new Builder();
  for (const s of [-1, 1]) {
    b.box('stone', s * 6.2, 0, 0, 1.9, 0.9, 1.9);
    b.col('stone', s * 6.2, 0.9, 0, 0.62, 5.6, 10);
    b.box('stone', s * 3.4, 0, 0, 1.6, 0.9, 1.6);
    b.col('stone', s * 3.4, 0.9, 0, 0.5, 6.9, 10);
    // the side spans' lintel and little roof
    b.box('stone', s * 4.8, 5.6, 0, 4.2, 0.7, 0.9);
    b.box('red', s * 4.8, 6.3, 0, 3.6, 0.6, 0.5);
    b.roof(s * 4.8, 6.9, 0, 3.2, 0.9, 1.1, 0.55);
  }
  // the middle span: a higher lintel, the name board and the biggest roof
  b.box('stone', 0, 6.9, 0, 8.2, 0.8, 1.0);
  b.box('red', 0, 7.7, 0, 6.6, 0.7, 0.55);
  b.roof(0, 8.4, 0, 6.4, 1.0, 1.5, 0.7);
  b.box('dark', 0, 5.4, 0, 2.8, 1.25, 0.7);
  return b;
}

function steleShape() {
  const b = new Builder();
  b.box('rock', 0, 0, 0, 2.2, 0.9, 3.0); // the base (a crouched beast, worn shapeless)
  b.box('rock', 0, 0.2, 1.6, 0.9, 0.6, 0.8);
  b.box('stone', 0, 0.9, -0.2, 1.7, 4.2, 0.5);
  b.box('stone', 0, 5.1, -0.2, 1.95, 0.5, 0.65);
  return b;
}

function pavilionShape() {
  const b = new Builder();
  b.box('step', 0, -0.4, 0, 10, 0.75, 10);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.col('red', sx * 3.4, 0.35, sz * 3.4, 0.28, 4);
  b.box('wood', 0, 4.35, 0, 8, 0.5, 8);
  b.roof(0, 4.85, 0, 6.8, 6.8, 3.2, 1.3);
  // benches between the columns on the three outer sides, a stone table in the middle
  for (const [x, z, w, d] of [[3.4, 0, 0.5, 6], [0, 3.4, 6, 0.5], [0, -3.4, 6, 0.5]] as const) b.box('plank', x, 0.35, z, w, 0.5, d);
  b.col('stone', 0, 0.35, 0, 0.7, 0.8, 10);
  return b;
}

function buildGudao() {
  const b = new Builder();
  // flagstones up the climb: each a slab tilted to the slope, two across with a crack between, light and dark
  let k = 0;
  for (let r = GD_ARCH_R - 10; r < GD_END_R; r += 1.3, k++) {
    const f = roadFrame(TQ_ROAD, r);
    const fa = roadFrame(TQ_ROAD, r - 0.6), fb = roadFrame(TQ_ROAD, r + 0.6);
    for (const side of [-1, 1]) {
      const w = 2.1 + Math.sin(k * 3.7 + side) * 0.2;
      const lx = side * 1.12 + Math.sin(k * 1.3) * 0.15;
      const [x, z] = at(f, lx, 0);
      const ha = groundHeight(...at(fa, lx, 0)), hb = groundHeight(...at(fb, lx, 0));
      const pitch = Math.atan2(hb - ha, 1.2);
      const g = new THREE.BoxGeometry(w, 0.3, 1.22);
      g.rotateX(-pitch);
      b.add((k + (side > 0 ? 1 : 0)) % 3 === 0 ? 'pave2' : 'pave', g, x, (ha + hb) / 2 - 0.1, z, f.rot);
    }
  }
  // the arch at the foot, the stele by it, facing down the road
  const fa = roadFrame(TQ_ROAD, GD_ARCH_R);
  b.merge(archShape(), fa.x, groundHeight(fa.x, fa.z) - 0.2, fa.z, fa.rot);
  {
    const [x, z] = at(fa, -10.5, -4);
    b.merge(steleShape(), x, groundHeight(x, z) - 0.3, z, fa.rot);
  }
  // lanterns every 14 m, both sides
  const lan = lanternShape();
  for (let r = GD_ARCH_R + 8; r < GD_END_R - 4; r += 14) {
    const f = roadFrame(TQ_ROAD, r);
    for (const s of [-1, 1]) {
      const [x, z] = at(f, s * 4.9, 0);
      b.merge(lan, x, groundHeight(x, z) - 0.15, z, f.rot);
    }
  }
  // 望阙台
  const fp = roadFrame(TQ_ROAD, GD_PAV_R);
  b.merge(pavilionShape(), GD_PAV[0], groundHeight(GD_PAV[0], GD_PAV[1]), GD_PAV[1], fp.rot);
  return b.build();
}

/** carved characters: gold on a dark board, or dark cut into stone */
export function textTex(text: string, vertical: boolean, fg: string, bg: string | null) {
  const c = document.createElement('canvas');
  c.width = vertical ? 64 : 192;
  c.height = vertical ? 256 : 96;
  const x = c.getContext('2d')!;
  if (bg) {
    x.fillStyle = bg;
    x.fillRect(0, 0, c.width, c.height);
  }
  x.fillStyle = fg;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = `bold ${vertical ? 52 : 64}px serif`;
  if (vertical) [...text].forEach((ch, i, a) => x.fillText(ch, 32, ((i + 0.5) * 256) / a.length));
  else x.fillText(text, 96, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Sign({ f, lx, y, lz, w, h, tex }: { f: Frame; lx: number; y: number; lz: number; w: number; h: number; tex: THREE.Texture }) {
  const [x, z] = at(f, lx, lz);
  return (
    <mesh position={[x, y, z]} rotation={[0, f.rot, 0]}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.7} transparent roughness={0.8} />
    </mesh>
  );
}

export function Gudao() {
  const parts = useMemo(buildGudao, []);
  const signs = useMemo(() => {
    const fa = roadFrame(TQ_ROAD, GD_ARCH_R);
    const g = groundHeight(fa.x, fa.z) - 0.2;
    // the arch's board faces the climber coming up from the village (local -z); the stele too
    const back = { ...fa, ux: -fa.ux, uz: -fa.uz, rot: fa.rot + Math.PI };
    const [sx, sz] = at(fa, -10.5, -4);
    const sg = groundHeight(sx, sz) - 0.3;
    const st = { x: sx, z: sz, ux: -fa.ux, uz: -fa.uz, rot: fa.rot + Math.PI };
    return [
      { f: back, lx: 0, y: g + 6.03, lz: 0.37, w: 2.6, h: 1.1, tex: textTex('天阙', false, '#e2b75a', '#1d1612') },
      { f: st, lx: 0, y: sg + 3.0, lz: 0.46, w: 0.9, h: 3.6, tex: textTex('天阙古道', true, '#3a332b', null) },
    ];
  }, []);
  return (
    <>
      <Built parts={parts} />
      {signs.map((s, i) => (
        <Sign key={i} {...s} />
      ))}
    </>
  );
}

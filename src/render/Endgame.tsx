// What opens after 伪帝 falls, standing in the world (game/endLayout.ts says where, endgame.ts what they do): the
// seven-storey 天阙试炼塔 beside 天阙's road, 巨灵碑 by the road with its name cut in, and 天魔窟's cleft in the mesa
// behind 天阙's hall glowing from below. Merged into one mesh per material; the solid parts are in game/world.ts.
import { useMemo } from 'react';
import * as THREE from 'three';
import { Builder, Built } from './build';
import { textTex } from './Gudao';
import { groundHeight } from '../game/world';
import { ABYSS, STELE, TOWER } from '../game/endLayout';

function pagoda() {
  const b = new Builder();
  b.box('step', 0, -0.6, 0, 14, 1.2, 14);
  b.steps(0, 0, 7.6, 4.4, 0.6, 3);
  let y = 0.6;
  for (let k = 0; k < 7; k++) {
    const w = 10 - k * 0.75, h = k === 0 ? 3.6 : 2.5;
    b.box(k % 2 ? 'wall' : 'red', 0, y, 0, w, h, w);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.col('red', sx * (w / 2 - 0.2), y, sz * (w / 2 - 0.2), 0.26, h, 8);
    // a balcony rail and the storey's own curved roof
    b.box('wood', 0, y + h, 0, w + 0.6, 0.3, w + 0.6);
    b.roof(0, y + h + 0.3, 0, w + 2.4, w + 2.4, 1.3, 1.1);
    y += h + 1.6;
  }
  // the spire: gold rings on a mast
  b.col('gold', 0, y - 0.3, 0, 0.18, 4.2, 8);
  for (let k = 0; k < 5; k++) b.col('gold', 0, y + 0.4 + k * 0.6, 0, 0.55 - k * 0.07, 0.14, 12);
  // the door: dark, framed in red, lanterns either side
  b.box('dark', 0, 0.6, 5.02, 2.4, 2.9, 0.1);
  b.box('red', 0, 3.5, 5.02, 3.2, 0.35, 0.2);
  for (const s of [-1, 1]) {
    b.box('red', s * 1.35, 0.6, 5.02, 0.3, 2.9, 0.25);
    b.lantern(s * 2.6, 2.8, 5.4);
  }
  return b;
}

function stele() {
  const b = new Builder();
  b.box('rock', 0, 0, 0, 3.4, 1.1, 2.2);
  b.box('stone', 0, 1.1, 0, 2.6, 5.6, 0.7);
  b.box('stone', 0, 6.7, 0, 3.0, 0.6, 0.95);
  b.roof(0, 7.3, 0, 2.6, 1.0, 0.8, 0.5, 'tile');
  return b;
}

function cleft() {
  const b = new Builder();
  // jagged rocks round a black split in the mesa, a stair going down into it
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2, r = 3.6 + Math.sin(k * 2.7) * 0.6;
    b.box('rock', Math.cos(a) * r * 1.4, -0.2, Math.sin(a) * r * 0.8, 1.6 + Math.sin(k) * 0.5, 1.2 + Math.abs(Math.sin(k * 1.9)) * 1.6, 1.4, a);
  }
  b.box('dark', 0, -0.05, 0, 7, 0.1, 3.4);
  for (let k = 0; k < 4; k++) b.box('stone', 0, -0.3 - k * 0.3, 1.2 - k * 0.6, 2.2, 0.25, 0.6);
  return b;
}

export function Endgame() {
  const parts = useMemo(() => {
    const b = new Builder();
    b.merge(pagoda(), TOWER.x, groundHeight(TOWER.x, TOWER.z), TOWER.z, TOWER.rot);
    b.merge(stele(), STELE.x, groundHeight(STELE.x, STELE.z) - 0.2, STELE.z, STELE.rot);
    b.merge(cleft(), ABYSS.x, groundHeight(ABYSS.x, ABYSS.z), ABYSS.z, ABYSS.rot);
    return b.build();
  }, []);
  const signs = useMemo(() => {
    const board = textTex('天阙试炼塔', true, '#f6d58a', '#2a1a12');
    const name = textTex('巨灵碑', true, '#1d1612', null);
    const ty = groundHeight(TOWER.x, TOWER.z);
    const sy = groundHeight(STELE.x, STELE.z);
    const fx = Math.sin(TOWER.rot), fz = Math.cos(TOWER.rot);
    const gx = Math.sin(STELE.rot), gz = Math.cos(STELE.rot);
    return [
      { tex: board, pos: [TOWER.x + fx * 4.75, ty + 7.05, TOWER.z + fz * 4.75] as [number, number, number], rot: TOWER.rot, w: 0.7, h: 2.2 },
      { tex: name, pos: [STELE.x + gx * 0.37, sy + 4.4, STELE.z + gz * 0.37] as [number, number, number], rot: STELE.rot, w: 1.0, h: 3.6 },
    ];
  }, []);
  // 天魔窟 glows from below
  const glow = useMemo(() => [ABYSS.x, groundHeight(ABYSS.x, ABYSS.z) + 0.6, ABYSS.z] as [number, number, number], []);
  return (
    <group>
      <Built parts={parts} />
      {signs.map((s, i) => (
        <mesh key={i} position={s.pos} rotation={[0, s.rot, 0]}>
          <planeGeometry args={[s.w, s.h]} />
          <meshStandardMaterial map={s.tex} emissiveMap={s.tex} emissive="#ffffff" emissiveIntensity={0.55} transparent roughness={0.8} />
        </mesh>
      ))}
      <mesh position={glow} rotation={[-Math.PI / 2, 0, ABYSS.rot]}>
        <planeGeometry args={[6.4, 2.8]} />
        <meshBasicMaterial color={new THREE.Color('#7c1fff')} transparent opacity={0.55} toneMapped={false} />
      </mesh>
    </group>
  );
}

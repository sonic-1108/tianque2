// The house you can buy in 青石村 (game/jianghu.ts, spot in game/village.ts HOME): a plastered cottage on a stone base
// under a tiled hip roof, a lantern by the door, and while it's for sale a board out front: 空宅出售 · 三百文.
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { Sim } from '../game/sim';
import { Builder, Built } from './build';
import { HOME, HOME_D, HOME_W } from '../game/village';
import { groundHeight } from '../game/world';

function buildHome() {
  const b = new Builder();
  const W = HOME_W, D = HOME_D, H = 3.0, door = 1.5;
  // local frame: the front (door) is +z
  b.box('stone', 0, -0.6, 0, W + 0.5, 0.85, D + 0.5);
  b.box('step', 0, -0.6, D / 2 + 0.55, door + 0.6, 0.6, 0.7);
  b.box('plaster', 0, 0.25, -D / 2 + 0.12, W, H, 0.24); // back
  for (const s of [-1, 1]) b.box('plaster', (s * (W - 0.24)) / 2, 0.25, 0, 0.24, H, D); // sides
  const seg = (W - door) / 2;
  for (const s of [-1, 1]) b.box('plaster', s * (door / 2 + seg / 2), 0.25, D / 2 - 0.12, seg, H, 0.24); // the front either side of the door
  b.box('plaster', 0, 0.25 + 2.3, D / 2 - 0.12, door, H - 2.3, 0.24); // over the door
  b.box('wood', 0, 0.25, D / 2 - 0.05, door, 2.3, 0.1); // the door itself, shut
  b.box('bronze', 0.42, 1.3, D / 2 + 0.03, 0.08, 0.08, 0.05);
  // timber at the corners and along the eaves, paper windows either side
  for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) b.col('wood', x, 0.25, z, 0.16, H + 0.1, 8);
  b.box('wood', 0, 0.25 + H - 0.1, D / 2 + 0.01, W + 0.2, 0.22, 0.12);
  for (const s of [-1, 1]) {
    b.box('paper', s * 2.3, 1.2, D / 2 + 0.01, 1.0, 0.8, 0.06);
    b.box('wood', s * 2.3, 1.15, D / 2 + 0.04, 1.1, 0.08, 0.08);
    b.box('wood', s * 2.3, 2.0, D / 2 + 0.04, 1.1, 0.08, 0.08);
  }
  b.roof(0, 0.25 + H, 0, W, D, 1.7, 0.75, 'tile');
  // a lantern by the door
  const lg = new THREE.SphereGeometry(0.22, 10, 8);
  lg.scale(1, 1.3, 1);
  b.add('lamp', lg, door / 2 + 0.45, 2.45, D / 2 + 0.25);
  return b;
}
function buildBoard() {
  const b = new Builder();
  b.col('wood', -0.55, -0.2, 0, 0.06, 1.7, 6);
  b.col('wood', 0.55, -0.2, 0, 0.06, 1.7, 6);
  b.box('plank', 0, 0.85, 0, 1.4, 0.7, 0.06);
  return b.build();
}
function saleText() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = '#e9dcc0';
  x.fillRect(0, 0, 256, 128);
  x.fillStyle = '#5a1a10';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = '700 50px "Noto Serif SC", "Songti SC", serif';
  x.fillText('空宅出售', 128, 48);
  x.font = '700 30px "Noto Serif SC", "Songti SC", serif';
  x.fillText('三百文 · 找石伯', 128, 100);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
}

export function Home({ sim }: { sim: Sim }) {
  // the cottage, turned and set in its place (baked: the shared materials sample the world, so no group transform)
  const house = useMemo(() => {
    const local = buildHome();
    const b = new Builder();
    b.merge(local, HOME.x, groundHeight(HOME.x, HOME.z), HOME.z, HOME.rot);
    return b.build();
  }, []);
  const board = useMemo(buildBoard, []);
  const text = useMemo(saleText, []);
  const [sold, setSold] = useState(!!sim.progress.home);
  useEffect(() => {
    const id = setInterval(() => setSold(!!sim.progress.home), 1000);
    return () => clearInterval(id);
  }, [sim]);
  const y = groundHeight(HOME.x, HOME.z);
  const bx = HOME.door[0] + Math.cos(HOME.rot) * 1.6, bz = HOME.door[1] - Math.sin(HOME.rot) * 1.6;
  return (
    <>
      <Built parts={house} />
      {!sold && (
        <group position={[bx, groundHeight(bx, bz), bz]} rotation={[0, HOME.rot, 0]}>
          <Built parts={board} />
          <mesh position={[0, 1.2, 0.04]} material={text}>
            <planeGeometry args={[1.3, 0.62]} />
          </mesh>
        </group>
      )}
    </>
  );
}

// 青石村's stockade (game/village.ts): a ring of sharpened logs bound by two rails, a fighting step of planks inside,
// and on every road a gate: two log towers with tiled roofs and red lanterns, a beam over the road with the village's
// name board, the heavy doors standing open against the wall.
import { useEffect, useMemo, useState } from 'react';
import type { Sim } from '../game/sim';
import * as THREE from 'three';
import { Builder, Built } from './build';
import { GATE_A, GATE_HALF, GATE_TOWERS, WALL_R, WALL_RUNS } from '../game/village';
import { groundHeight } from '../game/world';

const rnd = (a: number, b = 0) => {
  const v = Math.sin(a * 91.7 + b * 37.3) * 43758.5453;
  return v - Math.floor(v);
};

function buildStockade(stone: boolean) {
  const b = new Builder();
  // the logs, shoulder to shoulder along every run, each its own height, sharpened (or, once the village is a town
  // of stone, a cut-stone wall with merlons along its top)
  for (const [x0, z0, x1, z1] of WALL_RUNS) {
    const L = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(L / 0.36));
    const ry = Math.atan2(x1 - x0, z1 - z0);
    if (stone) {
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, my = groundHeight(mx, mz);
      b.box('stone', mx, my - 0.4, mz, 0.9, 4.2, L + 0.12, ry);
      const m = Math.max(1, Math.round(L / 1.3));
      for (let k = 0; k < m; k++) {
        const t = (k + 0.5) / m;
        b.box('stone', x0 + (x1 - x0) * t, my + 3.8, z0 + (z1 - z0) * t, 0.9, 0.55, 0.6, ry);
      }
      const ix = -mx / WALL_R, iz = -mz / WALL_R;
      b.box('step', mx + ix * 0.85, my + 1.3, mz + iz * 0.85, 0.9, 0.12, L + 0.05, ry);
      continue;
    }
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      const y = groundHeight(x, z) - 0.3;
      const h = 3.3 + rnd(x, z) * 0.6, r = 0.16 + rnd(z, x) * 0.04;
      b.add('log', new THREE.CylinderGeometry(r, r * 1.08, h, 6), x, y + h / 2, z);
      b.add('log', new THREE.ConeGeometry(r, 0.45, 6), x, y + h + 0.22, z);
    }
    // two rails bind them on the inside, a plank step to stand on and look over
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, my = groundHeight(mx, mz);
    const ix = -mx / WALL_R, iz = -mz / WALL_R;
    for (const h of [0.9, 2.5]) b.box('plank', mx + ix * 0.25, my + h, mz + iz * 0.25, 0.1, 0.18, L + 0.05, ry);
    b.box('plank', mx + ix * 0.85, my + 1.3, mz + iz * 0.85, 0.9, 0.12, L + 0.05, ry);
    b.box('log', mx + ix * 1.25, my, mz + iz * 1.25, 0.14, 1.32, 0.14);
  }
  // the gates
  GATE_A.forEach((a, k) => {
    const [[ax, az], [bx, bz]] = GATE_TOWERS[k];
    const ry = Math.atan2(Math.cos(a), Math.sin(a)) ; // the beam runs across the road
    for (const [x, z] of [[ax, az], [bx, bz]]) {
      const y = groundHeight(x, z) - 0.2;
      // a tower: four corner logs, plank walls below, an open lookout, a tiled roof
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add('log', new THREE.CylinderGeometry(0.2, 0.22, 7.2, 7), x + sx * 1.1, y + 3.6, z + sz * 1.1);
      b.box(stone ? 'stone' : 'plank', x, y, z, 2.3, 4.6, 2.3, -a);
      b.box('plank', x, y + 4.6, z, 2.9, 0.2, 2.9, -a);
      for (const [ox, oz, w, d] of [[0, 1.4, 2.9, 0.12], [0, -1.4, 2.9, 0.12], [1.4, 0, 0.12, 2.9], [-1.4, 0, 0.12, 2.9]] as const) {
        const c = Math.cos(-a), s = Math.sin(-a);
        b.box('plank', x + ox * c + oz * s, y + 4.8, z - ox * s + oz * c, w, 0.9, d, -a);
      }
      b.roof(x, y + 7.2, z, 2.6, 2.6, 1.6, 0.7, 'tile');
      const lg = new THREE.SphereGeometry(0.32, 10, 8);
      lg.scale(1, 1.25, 1);
      b.add('lamp', lg, x + Math.cos(a) * 1.6, y + 5.4, z + Math.sin(a) * 1.6);
    }
    // the beam over the road and the name board on it
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, my = groundHeight(mx, mz);
    const span = Math.hypot(bx - ax, bz - az) + 1;
    b.box('log', mx, my + 5.9, mz, span, 0.45, 0.45, ry);
    b.box('log', mx, my + 6.6, mz, span + 1.2, 0.3, 0.3, ry);
    b.box('dark', mx + Math.cos(a) * 0.3, my + 5.0, mz + Math.sin(a) * 0.3, 3.4, 1.1, 0.12, ry);
    b.box('gold', mx + Math.cos(a) * 0.32, my + 5.05, mz + Math.sin(a) * 0.32, 3.6, 0.08, 0.14, ry);
    b.box('gold', mx + Math.cos(a) * 0.32, my + 6.05, mz + Math.sin(a) * 0.32, 3.6, 0.08, 0.14, ry);
    // the doors, swung open outward against the wall's outer face
    for (const s of [-1, 1]) {
      // hinged at the opening's edge, swung out a quarter turn: they stand along the road, outside the wall
      const da = a + (s * (GATE_HALF - 0.25)) / WALL_R;
      const dx = Math.cos(da) * (WALL_R + 2.4), dz = Math.sin(da) * (WALL_R + 2.4);
      b.box('plank', dx, groundHeight(dx, dz) - 0.1, dz, GATE_HALF * 0.95, 3.4, 0.22, -a);
      for (const h of [0.7, 2.5]) b.box('bronze', dx, groundHeight(dx, dz) + h, dz, GATE_HALF * 0.9, 0.16, 0.28, -a);
    }
  });
  return b.build();
}

/** "青石村" on each gate's board (both faces) */
function nameBoard(name: string) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const x = c.getContext('2d')!;
  x.fillStyle = '#1c140e';
  x.fillRect(0, 0, 512, 160);
  x.fillStyle = '#e8c76a';
  x.font = '700 104px "Noto Serif SC", "Songti SC", "STSong", serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(name, 256, 86);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, emissive: '#3a2a10', emissiveIntensity: 0.4 });
}

export function Stockade({ sim }: { sim: Sim }) {
  const [lvl, setLvl] = useState(sim.jh.vlvl);
  useEffect(() => {
    const id = setInterval(() => setLvl(sim.jh.vlvl), 1500);
    return () => clearInterval(id);
  }, [sim]);
  const parts = useMemo(() => buildStockade(lvl >= 3), [lvl >= 3]);
  const boards = useMemo(() => {
    const mat = nameBoard(['青石村', '青石村', '青石镇', '青石城'][lvl]);
    const g = new THREE.PlaneGeometry(3.2, 1.0);
    return GATE_A.map((a, k) => {
      const [[ax, az], [bx, bz]] = GATE_TOWERS[k];
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, my = groundHeight(mx, mz);
      const group = new THREE.Group();
      for (const s of [1, -1]) {
        const m = new THREE.Mesh(g, mat);
        // outward face and inward face
        m.position.set(mx + Math.cos(a) * (0.3 + s * 0.08), my + 5.55, mz + Math.sin(a) * (0.3 + s * 0.08));
        m.lookAt(mx + Math.cos(a) * s * 50, my + 5.55, mz + Math.sin(a) * s * 50);
        group.add(m);
      }
      return group;
    });
  }, [lvl]);
  return (
    <>
      <Built parts={parts} />
      {boards.map((g, i) => (
        <primitive key={i} object={g} />
      ))}
    </>
  );
}

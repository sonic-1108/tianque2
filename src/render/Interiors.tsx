// The rooms you can walk into (game/interiors.ts): floor, walls, beams, glowing paper windows, hanging lanterns and
// each room's furniture, built from shapes and merged per material. Only the room the player is in is drawn, with its
// own warm lamps. Every piece of furniture here has the footprint FURN gives it (that's what blocks).
import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import { Builder, Built, type Mat } from './build';
import { ROOMS, ROOM_Y, type Furn, type Room, type RoomTheme } from '../game/interiors';
import type { Sim } from '../game/sim';

const rnd = (a: number, b = 0) => {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/** one piece of furniture, built round its own origin (floor at y 0, facing +z) */
function piece(f: Furn, theme: RoomTheme, seed: number): Builder {
  const b = new Builder();
  const legs = (w: number, d: number, h: number, m: Mat = 'wood') => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(m, (sx * w) / 2, 0, (sz * d) / 2, 0.08, h, 0.08);
  };
  const jar = (x: number, y: number, z: number, s: number, cap: Mat = 'lamp') => {
    const g = new THREE.SphereGeometry(0.28 * s, 10, 8);
    g.scale(1, 1.25, 1);
    b.add('soil', g, x, y + 0.34 * s, z);
    b.add(cap, new THREE.CylinderGeometry(0.14 * s, 0.17 * s, 0.1, 8), x, y + 0.72 * s, z);
  };
  switch (f.k) {
    case 'table': {
      b.box('plank', 0, 0.72, 0, 1.2, 0.08, 1.2);
      legs(1.05, 1.05, 0.72);
      // what's on it: cups and a jug, a bowl of fruit, or dice and coins in the tavern
      if (theme === 'tavern' || theme === 'inn' || theme === 'teahouse') {
        b.add('soil', new THREE.CylinderGeometry(0.12, 0.09, 0.28, 8), 0.2, 0.94, 0.1);
        for (let k = 0; k < 3; k++) b.add('white', new THREE.CylinderGeometry(0.05, 0.04, 0.07, 8), -0.3 + k * 0.18, 0.84, -0.25);
      } else for (let k = 0; k < 4; k++) b.add(k % 2 ? 'lamp' : 'crop', new THREE.SphereGeometry(0.07, 8, 6), -0.1 + (k % 2) * 0.12, 0.86, -0.1 + Math.floor(k / 2) * 0.12);
      break;
    }
    case 'longtable':
      b.box('plank', 0, 0.72, 0, 2.2, 0.08, 0.9);
      legs(2.0, 0.75, 0.72);
      for (let k = 0; k < 4; k++) b.add('white', new THREE.CylinderGeometry(0.09, 0.06, 0.06, 8), -0.8 + k * 0.5, 0.83, rnd(seed, k) * 0.3 - 0.15);
      break;
    case 'bench':
      b.box('plank', 0, 0.4, 0, 1.6, 0.06, 0.34);
      for (const s of [-1, 1]) b.box('wood', s * 0.65, 0, 0, 0.08, 0.4, 0.28);
      break;
    case 'stool':
      b.add('wood', new THREE.CylinderGeometry(0.2, 0.17, 0.45, 10), 0, 0.225, 0);
      break;
    case 'counter': {
      b.box('wood', 0, 0, 0, 4.4, 1.0, 0.8);
      b.box('plank', 0, 1.0, 0, 4.6, 0.07, 0.95);
      b.box('red', 0, 0.25, 0.41, 4.2, 0.5, 0.02);
      b.box('dark', 1.4, 1.07, 0, 0.5, 0.06, 0.3); // the abacus
      for (let k = 0; k < 9; k++) b.box('gold', 1.2 + (k % 3) * 0.1, 1.13, -0.08 + Math.floor(k / 3) * 0.08, 0.04, 0.04, 0.04);
      jar(-1.6, 1.07, 0, 0.7);
      break;
    }
    case 'jars': {
      for (const y of [0, 0.7]) b.box('wood', 0, y, 0, 2.2, 0.06, 0.8);
      for (const s of [-1, 1]) b.box('wood', s * 1.08, 0, 0, 0.08, 1.3, 0.8);
      for (let k = 0; k < 8; k++) jar(-0.8 + (k % 4) * 0.53, k < 4 ? 0.06 : 0.76, 0, 0.85 + rnd(seed, k) * 0.2, k % 3 ? 'lamp' : 'cloth');
      break;
    }
    case 'shelf': {
      for (const s of [-1, 1]) b.box('wood', s * 0.98, 0, 0, 0.06, 2.2, 0.5);
      for (let i = 0; i < 5; i++) b.box('wood', 0, i * 0.52, 0, 2, 0.05, 0.5);
      // books stood in rows and scrolls lying on the lower shelves
      for (let i = 0; i < 4; i++)
        for (let k = 0; k < 14; k++) {
          if (rnd(seed + i, k) < 0.2) continue;
          const tall = 0.26 + rnd(seed, i * 20 + k) * 0.16;
          if (theme === 'weaver' && i < 3) b.box(k % 2 ? 'silk' : 'silk2', -0.85 + k * 0.13, 0.05 + i * 0.52, 0, 0.12, 0.2, 0.42);
          else if (i < 2) b.box((['canvas', 'dark', 'silk', 'plank', 'silk2'] as Mat[])[Math.floor(rnd(seed, k) * 5)], -0.85 + k * 0.13, 0.05 + i * 0.52, 0, 0.1, tall, 0.34);
          else {
            const g = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8);
            g.rotateX(Math.PI / 2);
            b.add('white', g, -0.85 + k * 0.13, 0.1 + i * 0.52, 0);
          }
        }
      break;
    }
    case 'drawers': {
      b.box('wood', 0, 0, 0, 2.6, 2.2, 0.6);
      for (let i = 0; i < 7; i++)
        for (let k = 0; k < 8; k++) {
          b.box('plank', -1.1 + k * 0.315, 0.15 + i * 0.29, 0.3, 0.27, 0.24, 0.02);
          b.box('gold', -1.1 + k * 0.315, 0.27 + i * 0.29, 0.32, 0.04, 0.04, 0.03);
        }
      break;
    }
    case 'bed': {
      b.box('wood', 0, 0, 0, 2.0, 0.42, 2.2);
      b.box(theme === 'hunter' ? 'fur' : 'canvas', 0, 0.42, 0.1, 1.8, 0.12, 1.9);
      b.box(theme === 'elder' || theme === 'scholar' ? 'silk2' : 'silk', 0, 0.5, 0.4, 1.75, 0.08, 1.1); // the quilt
      b.box('white', 0, 0.54, -0.75, 0.8, 0.12, 0.3);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('wood', sx * 0.95, 0, sz * 1.05, 0.08, 2.1, 0.08);
      b.box('wood', 0, 2.1, 0, 2.0, 0.08, 2.2);
      b.box('cloth', 0, 1.2, -1.07, 1.9, 1.8, 0.02);
      break;
    }
    case 'screen':
      for (let k = -1; k <= 1; k++) {
        b.box('wood', k * 0.66, 0, 0, 0.64, 0.12, 0.08, k * 0.35);
        b.box('paper', k * 0.66, 0.12, 0, 0.58, 1.6, 0.03, k * 0.35);
        b.box('wood', k * 0.66, 1.72, 0, 0.64, 0.08, 0.08, k * 0.35);
      }
      break;
    case 'altar': {
      b.box('red', 0, 0, 0, 2.8, 1.0, 1.1);
      b.box('silk', 0, 0.1, 0.56, 2.6, 0.85, 0.02);
      b.add('bronze', new THREE.CylinderGeometry(0.26, 0.2, 0.3, 12), 0, 1.15, 0.1);
      for (let k = 0; k < 3; k++) b.box('dark', -0.06 + k * 0.06, 1.3, 0.1, 0.02, 0.4, 0.02);
      for (const s of [-1, 1]) {
        b.box('red', s * 0.9, 1.0, 0.1, 0.08, 0.32, 0.08);
        b.box('flame', s * 0.9, 1.32, 0.1, 0.05, 0.08, 0.05);
        for (let k = 0; k < 5; k++) b.add(k % 2 ? 'lamp' : 'gold', new THREE.SphereGeometry(0.08, 8, 6), s * 0.5 + (k % 3) * 0.1 - 0.1, 1.08 + Math.floor(k / 3) * 0.12, -0.15);
      }
      break;
    }
    case 'statue': {
      // 土地公: a round old man seated on his plinth, gold robed, white bearded, a staff
      b.box('stone', 0, 0, 0, 1.2, 0.9, 0.9);
      b.add('gold', new THREE.CylinderGeometry(0.38, 0.5, 0.9, 14), 0, 1.35, 0);
      b.box('gold', 0, 0.9, 0.2, 0.9, 0.35, 0.6);
      b.add('white', new THREE.SphereGeometry(0.22, 12, 10), 0, 1.98, 0.03);
      b.add('white', new THREE.ConeGeometry(0.16, 0.42, 10), 0, 1.66, 0.18);
      b.add('red', new THREE.CylinderGeometry(0.2, 0.24, 0.16, 12), 0, 2.2, 0);
      b.box('wood', 0.5, 0.9, 0.15, 0.05, 1.5, 0.05);
      break;
    }
    case 'stove': {
      b.box('pave', 0, 0, 0, 1.8, 0.9, 1.2);
      for (const s of [-1, 1]) {
        const g = new THREE.SphereGeometry(0.34, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
        b.add('dark', g, s * 0.45, 0.95, 0);
      }
      b.box('flame', 0, 0.15, 0.6, 0.5, 0.25, 0.02);
      b.box('pave', -0.7, 0.9, -0.45, 0.35, 2.4, 0.35);
      break;
    }
    case 'chest':
      b.box('wood', 0, 0, 0, 1.0, 0.6, 0.7);
      for (const s of [-1, 1]) b.box('bronze', s * 0.35, 0, 0, 0.06, 0.62, 0.72);
      b.box('gold', 0, 0.4, 0.36, 0.12, 0.12, 0.02);
      break;
    case 'desk': {
      b.box('wood', 0, 0.72, 0, 1.8, 0.07, 0.9);
      legs(1.65, 0.75, 0.72);
      b.box('white', -0.2, 0.795, 0.05, 0.7, 0.01, 0.5); // paper, with a brush and an inkstone
      b.box('dark', 0.5, 0.79, -0.15, 0.22, 0.04, 0.3);
      b.add('plank', new THREE.CylinderGeometry(0.07, 0.07, 0.2, 8), 0.65, 0.89, 0.2);
      for (let k = 0; k < 3; k++) b.box('dark', 0.62 + k * 0.03, 0.99, 0.2, 0.012, 0.22, 0.012);
      break;
    }
    case 'cradle': {
      for (const s of [-1, 1]) {
        const g = new THREE.TorusGeometry(0.5, 0.03, 6, 16, Math.PI);
        g.rotateZ(Math.PI);
        g.rotateY(Math.PI / 2);
        b.add('wood', g, s * 0.36, 0.52, 0);
      }
      b.box('plank', 0, 0.12, 0, 0.8, 0.45, 1.2);
      b.box('silk', 0, 0.5, 0.1, 0.7, 0.06, 0.8);
      break;
    }
    case 'rack': {
      b.box('wood', 0, 0, 0, 2.0, 0.1, 0.4);
      b.box('wood', 0, 1.6, 0, 2.0, 0.08, 0.1);
      for (const s of [-1, 1]) b.box('wood', s * 0.95, 0, 0, 0.08, 1.8, 0.1);
      for (let k = 0; k < 6; k++) {
        const x = -0.75 + k * 0.3;
        if (theme === 'hunter') {
          if (k % 2) {
            const g = new THREE.TorusGeometry(0.6, 0.02, 4, 12, Math.PI * 0.8);
            g.rotateZ(Math.PI / 2 + 0.25);
            b.add('wood', g, x, 1.0, 0.08);
          } else b.box('wood', x, 0.1, 0.08, 0.04, 1.75, 0.04);
        } else if (theme === 'carpenter') {
          b.box('dark', x, 0.9, 0.08, 0.18, 0.5, 0.02);
          b.box('wood', x, 1.15, 0.08, 0.05, 0.4, 0.05);
        } else {
          b.box('dark', x, 0.2, 0.08, 0.05, 1.4, 0.02);
          b.box('gold', x, 0.55, 0.08, 0.18, 0.04, 0.04);
        }
      }
      break;
    }
    case 'barrel':
      b.add('plank', new THREE.CylinderGeometry(0.38, 0.38, 1.0, 14), 0, 0.5, 0);
      for (const y of [0.15, 0.85]) b.add('dark', new THREE.CylinderGeometry(0.4, 0.4, 0.06, 14), 0, y, 0);
      break;
    case 'loom': {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('wood', sx * 0.75, 0, sz * 0.8, 0.08, 1.6, 0.08);
      b.box('wood', 0, 1.55, 0, 1.6, 0.08, 1.7);
      b.box('silk', 0, 0.75, -0.1, 1.3, 0.02, 1.4, 0);
      b.box(seed % 2 ? 'silk2' : 'silk', 0, 0.76, 0.35, 1.3, 0.025, 0.6);
      for (let k = 0; k < 18; k++) b.box('white', -0.6 + k * 0.07, 0.78, -0.55, 0.006, 0.006, 0.9);
      b.add('wood', new THREE.CylinderGeometry(0.08, 0.08, 1.5, 8).rotateZ(Math.PI / 2), 0, 0.9, 0.75);
      break;
    }
    case 'workbench': {
      b.box('plank', 0, 0.8, 0, 2.4, 0.12, 1.0);
      legs(2.2, 0.85, 0.8, 'log');
      b.box('dark', 0.8, 0.92, 0.3, 0.3, 0.12, 0.2); // a plane
      for (let k = 0; k < 6; k++) b.box('hay', -0.6 + rnd(seed, k) * 1.2, 0.93, -0.2 + rnd(k, seed) * 0.4, 0.1, 0.02, 0.05, rnd(k, 3) * 3);
      // the half made chair beside it
      b.box('plank', -1.9, 0.45, 0.3, 0.5, 0.05, 0.5);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('wood', -1.9 + sx * 0.22, 0, 0.3 + sz * 0.22, 0.05, sz < 0 ? 1.0 : 0.45, 0.05);
      break;
    }
    case 'herbs': {
      b.box('wood', 0, 1.7, 0, 2.0, 0.06, 0.06);
      for (const s of [-1, 1]) b.box('wood', s * 0.95, 0, 0, 0.06, 1.8, 0.5);
      for (let k = 0; k < 9; k++) {
        const g = new THREE.ConeGeometry(0.1, 0.5, 6);
        g.rotateX(Math.PI);
        b.add(k % 3 ? 'leaf' : 'hay', g, -0.8 + k * 0.2, 1.42, 0);
      }
      for (let k = 0; k < 3; k++) b.add('hay', new THREE.CylinderGeometry(0.45, 0.45, 0.06, 12), 0, 0.3 + k * 0.45, 0); // trays of drying roots
      break;
    }
    case 'stairs':
      for (let k = 0; k < 9; k++) b.box('plank', 0, 0, 1.6 - k * 0.4, 1.2, 0.29 * (k + 1), 0.4);
      break;
    case 'hay':
      b.add('hay', new THREE.CylinderGeometry(0.7, 0.72, 0.6, 12), 0, 0.3, 0);
      break;
    case 'coop': {
      b.box('wood', 0, 0, -0.1, 1.2, 0.6, 0.6);
      b.box('thatch', 0, 0.6, -0.1, 1.3, 0.12, 0.7);
      for (let k = 0; k < 3; k++) {
        const x = -0.4 + k * 0.4, z = 0.35 + (k % 2) * 0.15;
        const g = new THREE.SphereGeometry(0.16, 10, 8);
        g.scale(1.2, 1, 1);
        b.add('white', g, x, 0.18, z);
        b.add('white', new THREE.SphereGeometry(0.08, 8, 6), x + 0.16, 0.32, z);
        b.add('lamp', new THREE.SphereGeometry(0.035, 6, 4), x + 0.18, 0.41, z);
      }
      break;
    }
    case 'pelts': {
      for (const s of [-1, 1]) b.box('log', s * 0.85, 0, 0, 0.06, 1.7, 0.06);
      b.box('log', 0, 1.6, 0, 1.8, 0.06, 0.06);
      b.box('log', 0, 0.3, 0, 1.8, 0.06, 0.06);
      b.box(seed % 2 ? 'fur' : 'hay', 0, 0.35, 0.02, 1.4, 1.2, 0.03);
      break;
    }
    case 'map':
      break; // drawn as a painted canvas (MapOnWall)
  }
  return b;
}

/** the old map of 天阙 that hangs over 石伯's desk */
function MapOnWall({ x, z }: { x: number; z: number }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 192;
    const g = c.getContext('2d')!;
    g.fillStyle = '#d9c79c';
    g.fillRect(0, 0, 256, 192);
    g.strokeStyle = '#6b5434';
    g.lineWidth = 2;
    for (let k = 0; k < 9; k++) {
      // mountains
      const mx = 20 + k * 26, my = 70 + Math.sin(k) * 14;
      g.beginPath();
      g.moveTo(mx - 18, my + 20);
      g.lineTo(mx, my - 12);
      g.lineTo(mx + 18, my + 20);
      g.stroke();
    }
    g.strokeStyle = '#8a3a22';
    g.setLineDash([4, 3]);
    g.beginPath();
    g.moveTo(128, 180);
    g.bezierCurveTo(90, 140, 170, 110, 120, 40);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#8a3a22';
    g.font = 'bold 26px serif';
    g.fillText('天阙', 100, 34);
    g.font = '14px serif';
    g.fillText('青石村', 104, 186);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <mesh position={[x, ROOM_Y + 2.1, z + 0.05]}>
      <planeGeometry args={[2.2, 1.6]} />
      <meshStandardMaterial map={tex} roughness={1} />
    </mesh>
  );
}

function buildRoom(r: Room) {
  const b = new Builder();
  const { w, d, h } = r;
  // the floor, the four walls (a door gap in the near one), posts, beams and the ceiling
  b.box(r.floor === 'stone' ? 'pave' : 'plank', 0, -0.2, 0, w, 0.2, d);
  const wm: Mat = r.wall === 'plank' ? 'plank' : 'plaster';
  b.box(wm, 0, 0, -d / 2 - 0.15, w + 0.6, h, 0.3);
  for (const s of [-1, 1]) b.box(wm, s * (w / 2 + 0.15), 0, 0, 0.3, h, d);
  b.box(wm, -(w / 4 + 0.6), 0, d / 2 + 0.15, w / 2 - 0.9, h, 0.3);
  b.box(wm, w / 4 + 0.6, 0, d / 2 + 0.15, w / 2 - 0.9, h, 0.3);
  b.box(wm, 0, 2.6, d / 2 + 0.15, 2.4, h - 2.6, 0.3);
  b.box('paper', 0, 0, d / 2 + 0.32, 2.4, 2.6, 0.02); // daylight in the doorway
  b.box('wood', 0, 2.55, d / 2, 2.6, 0.12, 0.4);
  // skirting and a dado rail, darker below: walls read as walls
  b.box('wood', 0, 0, -d / 2 + 0.02, w, 0.18, 0.06);
  for (const s of [-1, 1]) b.box('wood', s * (w / 2 - 0.02), 0, 0, 0.06, 0.18, d);
  // posts every 4 m and beams over them
  const nx = Math.max(1, Math.round(w / 4));
  for (let i = 0; i <= nx; i++) {
    const x = -w / 2 + (i * w) / nx;
    for (const s of [-1, 1]) b.col('red', x * 0.98, 0, s * (d / 2 - 0.15), 0.16, h);
    b.box('wood', x * 0.98, h - 0.45, 0, 0.3, 0.35, d);
  }
  b.box('plank', 0, h, 0, w + 0.6, 0.15, d + 0.6);
  for (let k = 0; k < Math.round(w / 0.8); k++) b.box('wood', -w / 2 + 0.4 + k * 0.8, h - 0.12, 0, 0.12, 0.12, d);
  // paper windows on the side walls, lit from outside
  for (const s of [-1, 1])
    for (let k = 0; k < Math.max(1, Math.floor(d / 4)); k++) {
      const z = -d / 2 + (k + 0.7) * (d / Math.max(1, Math.floor(d / 4)));
      b.box('paper', s * (w / 2 - 0.01), 1.3, z, 0.02, 1.2, 1.4);
      for (let i = 0; i < 4; i++) b.box('wood', s * (w / 2 - 0.03), 1.3, z - 0.7 + i * 0.466, 0.03, 1.2, 0.04);
      for (let i = 0; i < 3; i++) b.box('wood', s * (w / 2 - 0.03), 1.3 + i * 0.6, z, 0.03, 0.04, 1.4);
    }
  // hanging lanterns
  const lanterns = Math.max(2, Math.round((w * d) / 40));
  for (let k = 0; k < lanterns; k++) {
    const x = -w / 2 + ((k + 0.5) * w) / lanterns, z = (k % 2 ? -1 : 1) * d * 0.15;
    b.box('dark', x, h - 0.9, z, 0.02, 0.9, 0.02);
    const g = new THREE.SphereGeometry(0.26, 12, 10);
    g.scale(1, 1.25, 1);
    b.add('lamp', g, x, h - 1.15, z);
  }
  // theme touches: the tavern's 酒 banner, rugs, the shrine's red hangings
  if (r.theme === 'tavern') b.box('silk', -3, 2.0, -d / 2 + 0.05, 1.0, 2.4, 0.03);
  if (r.theme === 'shrine') for (const s of [-1, 1]) b.box('silk', s * 1.6, 1.2, -d / 2 + 0.05, 0.6, 2.6, 0.03);
  if (r.theme === 'elder' || r.theme === 'scholar' || r.theme === 'weaver') b.box('silk2', 0.8, 0.01, 0.5, 3, 0.02, 2.2);
  // the furniture
  r.furn.forEach((f, i) => b.merge(piece(f, r.theme, r.id * 31 + i), f.x, 0, f.z, f.ry ?? 0));
  return b.build();
}

/** the lit room the player is in (null outside): its shapes, its lamps, the map on 石伯's wall */
export function Interiors({ sim }: { sim: Sim }) {
  const [room, setRoom] = useState(-1);
  const last = useRef(-1);
  useFrame(() => {
    if (sim.indoor !== last.current) {
      last.current = sim.indoor;
      setRoom(sim.indoor);
    }
  });
  const r = room >= 0 ? ROOMS[room] : null;
  const parts = useMemo(() => (r ? buildRoom(r) : null), [r]);
  if (!r || !parts) return null;
  const lamps: [number, number][] = [
    [-r.w / 4, 0],
    [r.w / 4, 0],
  ];
  return (
    <group position={[r.ox, ROOM_Y, r.oz]}>
      <Built parts={parts} />
      {lamps.map(([x, z], i) => (
        <pointLight key={i} position={[x, r.h - 1.2, z]} color="#ffb46a" intensity={18} distance={r.w * 1.2} decay={1.4} />
      ))}
      <pointLight position={[0, 2.2, r.d / 2 - 0.8]} color="#fff2d8" intensity={6} distance={7} decay={1.6} />
      {r.furn
        .filter((f) => f.k === 'map')
        .map((f, i) => (
          <MapOnWall key={i} x={f.x} z={f.z} />
        ))}
    </group>
  );
}

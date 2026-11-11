// The war drawn (game/conflict.ts): a checkpoint's barricade of crossed stakes and the false court's yellow banner
// across the road while it stands, and fire and smoke on the houses raiders are burning.
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Sim } from '../game/sim';
import { postAt, postRoad, POST_R } from '../game/conflict';
import { roadPoint } from '../game/layout';
import { groundHeight } from '../game/world';
import { Builder, Built } from './build';

function buildPost(k: number) {
  const [x, z] = postAt(k);
  const [ax, az] = roadPoint(postRoad(k), POST_R + 1);
  const ry = Math.atan2(ax - x, az - z);
  const L = new Builder();
  // 拒马: crossed sharpened stakes on a beam, across the road, a gap in the middle
  for (const s of [-1, 1])
    for (let j = 0; j < 3; j++) {
      const lx = s * (2.6 + j * 1.6);
      L.box('log', lx, 0.55, 0, 0.14, 0.14, 1.6, 0);
      for (const t of [-1, 1]) {
        const g = new THREE.CylinderGeometry(0.06, 0.09, 1.9, 6);
        g.rotateX(t * 0.75);
        L.add('log', g, lx, 0.75, 0);
      }
    }
  // the banner: a tall pole with the false court's yellow flag
  L.box('log', 0, 0, -2.5, 0.16, 6.5, 0.16);
  L.box('gold', 0.75, 4.2, -2.5, 1.4, 2.2, 0.04);
  L.box('red', 0.75, 4.9, -2.48, 0.6, 0.6, 0.02);
  // a brazier
  L.add('bronze', new THREE.CylinderGeometry(0.35, 0.22, 0.5, 10), -2.2, 0.9, -1.6);
  L.box('log', -2.2, 0, -1.6, 0.1, 0.65, 0.1);
  L.add('flame', new THREE.ConeGeometry(0.22, 0.6, 7), -2.2, 1.35, -1.6);
  const B = new Builder();
  B.merge(L, x, groundHeight(x, z), z, ry);
  return B.build();
}

function Post({ sim, k }: { sim: Sim; k: number }) {
  const parts = useMemo(() => buildPost(k), [k]);
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    if (g.current) g.current.visible = sim.war.posts[k].active;
  });
  return (
    <group ref={g}>
      <Built parts={parts} />
    </group>
  );
}

const FIRES = 8, PER = 40;
function Fires({ sim }: { sim: Sim }) {
  const st = useMemo(() => {
    const n = FIRES * PER;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.9, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.frustumCulled = false;
    const life = Float32Array.from({ length: n }, () => Math.random());
    return { pts, pos, col, life, g };
  }, []);
  const light = useRef<THREE.PointLight>(null);
  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05);
    const R = sim.war.raid;
    // the houses being burned: where each unopposed raider stands at a door
    const spots: [number, number, number][] = [];
    if (R?.stage === 'on' && sim.indoor < 0)
      for (const id of R.ids) {
        const f = sim.fighters[id];
        if (f.hp > 0 && !f.aggro && Math.hypot(f.pos[0], f.pos[2]) < 32 && f.home) spots.push([f.home[0], groundHeight(f.home[0], f.home[1]), f.home[1]]);
      }
    st.pts.visible = spots.length > 0;
    if (light.current) {
      light.current.intensity = spots.length ? 30 + Math.sin(sim.time * 13) * 6 : 0;
      if (spots[0]) light.current.position.set(spots[0][0], spots[0][1] + 3, spots[0][2]);
    }
    if (!spots.length) return;
    for (let k = 0; k < FIRES * PER; k++) {
      const s = spots[Math.floor(k / PER) % spots.length];
      st.life[k] += dt * (0.8 + (k % 7) * 0.08);
      if (st.life[k] > 1) st.life[k] = 0;
      const t = st.life[k], i = k * 3;
      const sway = Math.sin(sim.time * 3 + k) * 0.4;
      st.pos[i] = s[0] + Math.sin(k * 12.9) * 2.2 + sway * t;
      st.pos[i + 1] = s[1] + 1 + t * 5;
      st.pos[i + 2] = s[2] + Math.cos(k * 7.3) * 2.2;
      // flame at the foot, dark smoke above
      const fl = Math.max(0, 1 - t * 1.6);
      st.col[i] = fl + 0.12 * (1 - fl);
      st.col[i + 1] = fl * 0.45 + 0.1 * (1 - fl);
      st.col[i + 2] = fl * 0.08 + 0.1 * (1 - fl);
    }
    st.g.attributes.position.needsUpdate = true;
    st.g.attributes.color.needsUpdate = true;
  });
  return (
    <>
      <primitive object={st.pts} />
      <pointLight ref={light} color="#ff7a2a" distance={30} decay={1.5} intensity={0} />
    </>
  );
}

export function War({ sim }: { sim: Sim }) {
  return (
    <>
      {sim.war.posts.map((_, k) => (
        <Post key={k} sim={sim} k={k} />
      ))}
      <Fires sim={sim} />
    </>
  );
}

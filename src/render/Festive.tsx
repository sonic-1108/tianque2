// Festival dressing: strings of red lanterns over the market street and round the village square for 春节, 元宵 and
// 中秋 (glowing at night), and fireworks over the village on the nights of 春节 and 元宵.
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Sim } from '../game/sim';
import { roadFrame } from '../game/layout';
import { MARKET_FROM, MARKET_ROAD, MARKET_TO } from '../game/props';
import { groundHeight } from '../game/world';

const LANTERN_FESTS = new Set(['春节', '元宵灯会', '中秋']);
const FIRE_FESTS = new Set(['春节', '元宵灯会']);
const BURSTS = 7, PER = 90;

export function Festive({ sim }: { sim: Sim }) {
  const lan = useMemo(() => {
    const spots: [number, number, number][] = [];
    // over the market street, both sides, every 4 m
    for (let r = MARKET_FROM - 4; r <= MARKET_TO + 4; r += 4)
      for (const s of [-1, 1]) {
        const f = roadFrame(MARKET_ROAD, r);
        const x = f.x + s * f.uz * 4.2, z = f.z - s * f.ux * 4.2;
        spots.push([x, groundHeight(x, z) + 3.6 + Math.sin(r * 0.8) * 0.15, z]);
      }
    // round the village square
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * Math.PI * 2, x = Math.cos(a) * 12, z = Math.sin(a) * 12;
      spots.push([x, groundHeight(x, z) + 3.4, z]);
    }
    const geo = new THREE.SphereGeometry(0.28, 10, 8).scale(1, 1.25, 1);
    const mat = new THREE.MeshStandardMaterial({ color: '#d4261c', emissive: '#ff4a1a', emissiveIntensity: 0.4, roughness: 0.6 });
    const im = new THREE.InstancedMesh(geo, mat, spots.length);
    const m = new THREE.Matrix4();
    spots.forEach((p, i) => im.setMatrixAt(i, m.makeTranslation(p[0], p[1], p[2])));
    im.frustumCulled = false;
    im.visible = false;
    return { im, mat };
  }, []);
  const fw = useMemo(() => {
    const n = BURSTS * PER;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: 1.6, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    pts.visible = false;
    const bursts = Array.from({ length: BURSTS }, (_, b) => ({ t: -b * 0.7, c: [0, 0, 0] as number[], vel: new Float32Array(PER * 3), o: [0, 0, 0] }));
    return { pts, pos, col, bursts, g };
  }, []);
  const tmp = useRef(new THREE.Color());
  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05);
    const c = sim.clock, out = sim.indoor < 0;
    const fest = c.festival?.name ?? '';
    lan.im.visible = out && LANTERN_FESTS.has(fest);
    lan.mat.emissiveIntensity = c.night ? 2.2 : 0.4;
    const p = sim.player.pos;
    const on = out && FIRE_FESTS.has(fest) && c.night && Math.hypot(p[0], p[2]) < 400;
    fw.pts.visible = on;
    if (!on) return;
    for (let b = 0; b < BURSTS; b++) {
      const B = fw.bursts[b];
      B.t += dt;
      if (B.t > 2.6) {
        // a new shell bursts somewhere over the village
        B.t = 0;
        B.o = [(Math.random() - 0.5) * 90, 45 + Math.random() * 30, (Math.random() - 0.5) * 90];
        tmp.current.setHSL(Math.random(), 0.9, 0.6);
        B.c = [tmp.current.r, tmp.current.g, tmp.current.b];
        for (let i = 0; i < PER; i++) {
          const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u), v = 13 + Math.random() * 4;
          B.vel.set([Math.cos(th) * s * v, u * v, Math.sin(th) * s * v], i * 3);
        }
      }
      const t = Math.max(0, B.t), fade = B.t < 0 ? 0 : Math.max(0, 1 - t / 2.4);
      for (let i = 0; i < PER; i++) {
        const k = (b * PER + i) * 3, drag = (1 - Math.exp(-t * 1.6)) / 1.6;
        fw.pos[k] = B.o[0] + B.vel[i * 3] * drag;
        fw.pos[k + 1] = B.o[1] + B.vel[i * 3 + 1] * drag - 2.5 * t * t;
        fw.pos[k + 2] = B.o[2] + B.vel[i * 3 + 2] * drag;
        fw.col[k] = B.c[0] * fade;
        fw.col[k + 1] = B.c[1] * fade;
        fw.col[k + 2] = B.c[2] * fade;
      }
    }
    fw.g.attributes.position.needsUpdate = true;
    fw.g.attributes.color.needsUpdate = true;
  });
  return (
    <>
      <primitive object={lan.im} />
      <primitive object={fw.pts} />
    </>
  );
}

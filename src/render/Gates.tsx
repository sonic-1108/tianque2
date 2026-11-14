// 传送阵 (game/gates.ts): a low ring of carved stone with four lamp pillars; on its face the eight trigrams glow pale
// blue once it's lit, a column of light stands over it and motes drift up. Unlit, the carving is dull and the lamps out.
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Sim } from '../game/sim';
import { GATES, GATE_R, lit } from '../game/gates';
import { groundHeight } from '../game/world';
import { Builder, Built } from './build';
import { sigilOf } from './vfx/sigils';

const COLOR = new THREE.Color('#9fdcff');
function column() {
  // an open cylinder, bright at the bottom, gone at the top
  const g = new THREE.CylinderGeometry(1.5, 1.7, 7, 28, 1, true).translate(0, 3.5, 0);
  const m = new THREE.ShaderMaterial({
    uniforms: { uA: { value: 0 }, uT: { value: 0 }, uC: { value: COLOR } },
    vertexShader: `varying float vY; varying vec2 vUv; void main(){ vY = position.y / 7.0; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uA; uniform float uT; uniform vec3 uC; varying float vY; varying vec2 vUv;
      void main(){ float stripes = 0.65 + 0.35 * sin(vUv.x * 40.0 + uT * 2.0) * sin(vY * 9.0 - uT * 3.0);
        float a = pow(1.0 - vY, 2.2) * uA * stripes; gl_FragColor = vec4(uC * 1.4, a * 0.5); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(g, m);
}

export function Gates({ sim }: { sim: Sim }) {
  const S = useMemo(() => {
    const b = new Builder();
    const faces: THREE.Mesh[] = [], cols: THREE.Mesh[] = [], lamps: THREE.Mesh[] = [];
    const root = new THREE.Group();
    const lampMat = () => new THREE.MeshStandardMaterial({ color: '#dbeafe', emissive: '#9fdcff', emissiveIntensity: 0, roughness: 0.4 });
    for (const g of GATES) {
      const y = groundHeight(g.x, g.z);
      // the base: a stepped drum of cut stone sunk into the ground, its top just above it
      b.col('stone', g.x, y - 0.7, g.z, GATE_R + 0.55, 0.78, 24);
      b.col('stone', g.x, y - 0.3, g.z, GATE_R + 0.15, 0.44, 24);
      // four pillars on the diagonals, a lamp on each
      for (let k = 0; k < 4; k++) {
        const a = g.out + Math.PI / 4 + (k * Math.PI) / 2, px = g.x + Math.sin(a) * (GATE_R + 0.3), pz = g.z + Math.cos(a) * (GATE_R + 0.3);
        b.col('stone', px, y - 0.1, pz, 0.17, 1.55, 8);
        b.box('stone', px, y + 1.42, pz, 0.46, 0.12, 0.46, a);
        const lm = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), lampMat());
        lm.position.set(px, y + 1.72, pz);
        root.add(lm);
        lamps.push(lm);
      }
      // the carved face: the trigrams, glowing when lit
      const face = new THREE.Mesh(
        new THREE.CircleGeometry(GATE_R, 48).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ map: sigilOf('bagua'), color: COLOR.clone(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0.15 }),
      );
      face.position.set(g.x, y + 0.16, g.z);
      face.rotation.y = g.out;
      face.renderOrder = 3;
      root.add(face);
      faces.push(face);
      const c = column();
      c.position.set(g.x, y + 0.15, g.z);
      c.visible = false;
      root.add(c);
      cols.push(c);
    }
    return { parts: b.build(), root, faces, cols, lamps };
  }, []);
  const litNow = useRef<boolean[]>([]);
  const t0 = useRef(0);
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime, p = sim.player.pos;
    if ((t0.current -= dt) <= 0) {
      t0.current = 0.5;
      litNow.current = GATES.map((g) => lit(sim, g));
    }
    const out = sim.indoor < 0;
    S.root.visible = out;
    GATES.forEach((g, i) => {
      const on = !!litNow.current[i];
      const near = Math.hypot(g.x - p[0], g.z - p[2]) < 260;
      const face = S.faces[i], col = S.cols[i];
      face.visible = near;
      (face.material as THREE.MeshBasicMaterial).opacity = on ? 0.75 + Math.sin(t * 1.6 + i) * 0.15 : 0.12;
      face.rotation.y = g.out + (on ? t * 0.15 : 0);
      col.visible = on && near;
      if (col.visible) {
        const u = (col.material as THREE.ShaderMaterial).uniforms;
        u.uA.value = 0.8 + Math.sin(t * 2 + i) * 0.2;
        u.uT.value = t;
      }
      for (let k = 0; k < 4; k++) (S.lamps[i * 4 + k].material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 1.6 + Math.sin(t * 3 + k) * 0.3 : 0;
    });
  });
  return (
    <>
      <Built parts={S.parts} />
      <primitive object={S.root} />
    </>
  );
}

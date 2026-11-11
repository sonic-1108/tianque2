// What 玩法 (game/play.ts) puts on the map: the notice boards (委托), the 血参 herbs glowing red in the wild (gone
// for a day once picked), the thrush that follows you once you've bought one, and the red lantern you carry at night.
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Sim } from '../game/sim';
import { BOARDS, bag } from '../game/play';
import { groundHeight } from '../game/world';
import { Builder, Built } from './build';

function buildBoards() {
  const b = new Builder();
  for (const [x, z] of BOARDS) {
    const y = groundHeight(x, z);
    const ry = Math.atan2(-x, -z); // faces the middle of its square
    const L = new Builder();
    for (const s of [-1, 1]) L.box('log', s * 1.1, 0, 0, 0.16, 2.6, 0.16);
    L.box('wood', 0, 1.0, 0, 2.4, 1.4, 0.1);
    L.box('tile', 0, 2.5, 0, 2.8, 0.14, 0.6);
    // notices pinned on it
    for (const [px, py] of [[-0.6, 1.5], [0.15, 1.6], [0.75, 1.35], [-0.2, 1.15], [0.55, 1.05]]) L.box('paper', px, py, 0.07, 0.42, 0.5, 0.01);
    b.merge(L, x, y, z, ry);
  }
  return b.build();
}

export function PlayThings({ sim }: { sim: Sim }) {
  const boards = useMemo(buildBoards, []);
  return (
    <>
      <Built parts={boards} />
      <Herbs sim={sim} />
      <Pet sim={sim} />
    </>
  );
}

function Herbs({ sim }: { sim: Sim }) {
  const im = useMemo(() => {
    const g = new THREE.SphereGeometry(0.14, 8, 6);
    const m = new THREE.MeshStandardMaterial({ color: '#c8202a', emissive: '#ff3030', emissiveIntensity: 1.4, roughness: 0.5 });
    const mesh = new THREE.InstancedMesh(g, m, sim.herbs.length * 4);
    mesh.frustumCulled = false;
    return mesh;
  }, [sim]);
  const leaves = useMemo(() => {
    const g = new THREE.ConeGeometry(0.09, 0.5, 4);
    const mesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: '#2e5a22', roughness: 0.9 }), sim.herbs.length * 4);
    mesh.frustumCulled = false;
    return mesh;
  }, [sim]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const hidden = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), []);
  useFrame(() => {
    const pulse = 1 + Math.sin(sim.time * 3) * 0.15;
    (im.material as THREE.MeshStandardMaterial).emissiveIntensity = (sim.clock.night ? 2.4 : 0.9) * pulse;
    sim.herbs.forEach((h, i) => {
      const up = h.back <= sim.worldT && sim.indoor < 0;
      const y = groundHeight(h.x, h.z);
      for (let k = 0; k < 4; k++) {
        const a = k * 1.57 + i, r = k ? 0.18 : 0;
        const x = h.x + Math.cos(a) * r, z = h.z + Math.sin(a) * r;
        im.setMatrixAt(i * 4 + k, up ? m.compose(new THREE.Vector3(x, y + 0.45 + (k ? -0.1 : 0.05), z), q.identity(), new THREE.Vector3(1, 1, 1).multiplyScalar(k ? 0.7 : 1)) : hidden);
        leaves.setMatrixAt(i * 4 + k, up ? m.compose(new THREE.Vector3(h.x + Math.cos(a) * 0.12, y + 0.22, h.z + Math.sin(a) * 0.12), q.setFromEuler(new THREE.Euler(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5)), new THREE.Vector3(1, 1, 1)) : hidden);
      }
    });
    im.instanceMatrix.needsUpdate = true;
    leaves.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <primitive object={im} />
      <primitive object={leaves} />
    </>
  );
}

/** the thrush (a little bird flying round you) and the lantern (a light at your side at night) */
function Pet({ sim }: { sim: Sim }) {
  const bird = useRef<THREE.Group>(null);
  const wings = useRef<THREE.Mesh[]>([]);
  const lamp = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const st = useMemo(() => ({ x: 0, y: 0, z: 0, sing: 0 }), []);
  useFrame((_, dt) => {
    const p = sim.player.pos, B = bag(sim.progress), t = sim.time;
    // the bird: circles over your shoulder, flapping; sings now and then
    const hasBird = (B.thrush ?? 0) > 0;
    if (bird.current) {
      bird.current.visible = hasBird;
      if (hasBird) {
        const a = t * 0.9;
        const tx = p[0] + Math.cos(a) * 1.6, tz = p[2] + Math.sin(a) * 1.6, ty = p[1] + 2.3 + Math.sin(t * 1.7) * 0.3;
        st.x += (tx - st.x) * Math.min(1, dt * 3);
        st.y += (ty - st.y) * Math.min(1, dt * 3);
        st.z += (tz - st.z) * Math.min(1, dt * 3);
        bird.current.position.set(st.x, st.y, st.z);
        bird.current.rotation.y = -a;
        const flap = Math.sin(t * 22) * 0.8;
        if (wings.current[0]) wings.current[0].rotation.z = flap;
        if (wings.current[1]) wings.current[1].rotation.z = -flap;
        if ((st.sing -= dt) <= 0) {
          st.sing = 9 + Math.random() * 10;
          sim.say(st.x, st.y + 0.4, st.z, Math.random() < 0.5 ? '啾啾～' : '叽叽喳喳！');
        }
      }
    }
    // the lantern: carried at night
    const hasLamp = (B.lantern ?? 0) > 0 && sim.clock.night && sim.player.hp > 0;
    if (lamp.current) {
      lamp.current.visible = hasLamp;
      const f = sim.player;
      const sx = Math.cos(f.yaw) * 0.45, sz = -Math.sin(f.yaw) * 0.45;
      lamp.current.position.set(p[0] + sx, p[1] + 1.1 + (sim.riding >= 0 ? 1.05 : 0), p[2] + sz);
    }
    if (light.current) light.current.intensity = hasLamp ? 9 + Math.sin(t * 7) * 0.6 : 0;
  });
  return (
    <>
      <group ref={bird} visible={false}>
        <mesh>
          <sphereGeometry args={[0.09, 10, 8]} />
          <meshStandardMaterial color="#a07040" roughness={0.8} />
        </mesh>
        <mesh position={[0.08, 0.04, 0]}>
          <sphereGeometry args={[0.055, 8, 6]} />
          <meshStandardMaterial color="#c9a070" roughness={0.8} />
        </mesh>
        <mesh position={[0.14, 0.04, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.015, 0.05, 4]} />
          <meshStandardMaterial color="#e0b030" />
        </mesh>
        {[-1, 1].map((s, i) => (
          <mesh key={s} ref={(m) => m && (wings.current[i] = m)} position={[0, 0.02, s * 0.06]}>
            <boxGeometry args={[0.12, 0.01, 0.16]} />
            <meshStandardMaterial color="#6a4a2a" />
          </mesh>
        ))}
      </group>
      <group ref={lamp} visible={false}>
        <mesh>
          <sphereGeometry args={[0.16, 10, 8]} />
          <meshStandardMaterial color="#d4261c" emissive="#ff5a1a" emissiveIntensity={2.2} />
        </mesh>
        <pointLight ref={light} color="#ffb46a" distance={14} decay={1.6} intensity={0} position={[0, 0.1, 0]} />
      </group>
    </>
  );
}

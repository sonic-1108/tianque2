// The land: terrain coloured by height and paths, scattered trees, the village in the middle and the seven camps.
import { useEffect, useMemo, useRef, useState } from 'react';
import { GLTFLoader, MeshoptDecoder } from 'three-stdlib';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { BUILDINGS, groundHeight } from '../game/world';
import { Landscape } from './Terrain';
import { DENS, DEN_R, FOE_KINDS } from '../game/foes';
import type { Sim } from '../game/sim';

/** a Tripo prop (public/props): loaded once, cloned per placement (geometry and textures shared) */
const propCache = new Map<string, Promise<THREE.Group>>();
const propLoader = new GLTFLoader();
propLoader.setMeshoptDecoder(typeof MeshoptDecoder === 'function' ? (MeshoptDecoder as any)() : MeshoptDecoder);
function loadProp(file: string) {
  let p = propCache.get(file);
  if (!p) {
    p = propLoader.loadAsync(import.meta.env.BASE_URL + 'props/' + file).then((g) => {
      g.scene.traverse((o: any) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      return g.scene;
    });
    propCache.set(file, p);
  }
  return p;
}
function Prop({ file, x, z, rot, scale }: { file: string; x: number; z: number; rot: number; scale: number }) {
  const [obj, setObj] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    let alive = true;
    loadProp(file)
      .then((s) => alive && setObj(s.clone()))
      .catch((e) => console.warn('[tq2] prop', file, e));
    return () => {
      alive = false;
    };
  }, [file]);
  if (!obj) return null;
  return <primitive object={obj} position={[x, groundHeight(x, z) - 0.25, z]} rotation={[0, rot, 0]} scale={scale} />;
}

function Village() {
  const y = groundHeight(0, 0);
  return (
    <group>
      {BUILDINGS.map((b, i) => (
        <Prop key={i} file={b.model} x={b.x} z={b.z} rot={b.rot} scale={b.scale} />
      ))}
      {/* the well in the square */}
      <mesh position={[0, y + 0.5, -3]} castShadow>
        <cylinderGeometry args={[1, 1.1, 1, 12]} />
        <meshStandardMaterial color="#8d8a82" roughness={1} />
      </mesh>
    </group>
  );
}

/** a bandit den: a ring of stakes, a few tents round a campfire, a flag (a big one where the boss is) */
function Den({ i }: { i: number }) {
  const d = DENS[i];
  const kind = FOE_KINDS[d.kind];
  const stakes = useMemo(() => {
    const out: [number, number][] = [];
    const n = 28;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      if (k % 7 === 0) continue; // gaps to walk in
      out.push([d.x + Math.cos(a) * DEN_R, d.z + Math.sin(a) * DEN_R]);
    }
    return out;
  }, [d]);
  const y = groundHeight(d.x, d.z);
  return (
    <group>
      {stakes.map(([x, z], k) => (
        <mesh key={k} position={[x, groundHeight(x, z) + 0.7, z]} rotation={[0.15, k, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.11, 1.6, 6]} />
          <meshStandardMaterial color="#5b3b22" roughness={1} />
        </mesh>
      ))}
      {[0, 1, 2].map((k) => {
        // a round canvas tent: low wall, a peaked roof, a dark door
        const a = k * 2.1 + i;
        const x = d.x + Math.cos(a) * 10.5;
        const z = d.z + Math.sin(a) * 10.5;
        const ty = groundHeight(x, z);
        const cloth = k === 0 ? '#8c7b5e' : k === 1 ? '#9b8a68' : '#7d6c52';
        return (
          <group key={k} position={[x, ty, z]} rotation={[0, -a + Math.PI / 2, 0]}>
            <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[1.9, 2.0, 1.1, 18, 1, true]} />
              <meshStandardMaterial color={cloth} roughness={1} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 1.75, 0]} castShadow receiveShadow>
              <coneGeometry args={[2.25, 1.4, 18, 1, true]} />
              <meshStandardMaterial color={cloth} roughness={1} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 2.55, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.5, 6]} />
              <meshStandardMaterial color="#3a2a1a" />
            </mesh>
            <mesh position={[0, 0.5, -1.96]}>
              <planeGeometry args={[0.8, 1]} />
              <meshStandardMaterial color="#2a2118" side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
      {/* campfire: a ring of stones, crossed logs, the flame */}
      <group position={[d.x + 2.5, y, d.z]}>
        {Array.from({ length: 8 }, (_, k) => (
          <mesh key={k} position={[Math.cos((k / 8) * Math.PI * 2) * 0.7, 0.1, Math.sin((k / 8) * Math.PI * 2) * 0.7]}>
            <dodecahedronGeometry args={[0.18, 0]} />
            <meshStandardMaterial color="#6f6a62" roughness={1} />
          </mesh>
        ))}
        {[0, 1, 2].map((k) => (
          <mesh key={k} position={[0, 0.15, 0]} rotation={[0, (k / 3) * Math.PI, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.08, 1, 6]} />
            <meshStandardMaterial color="#3b2a1c" roughness={1} />
          </mesh>
        ))}
        <mesh position={[0, 0.45, 0]}>
          <coneGeometry args={[0.32, 0.8, 8]} />
          <meshBasicMaterial color="#ff9a3a" />
        </mesh>
        <mesh position={[0, 0.35, 0]}>
          <coneGeometry args={[0.2, 0.5, 8]} />
          <meshBasicMaterial color="#ffe08a" />
        </mesh>
      </group>
      <group position={[d.x - 3, y, d.z - 3]}>
        <mesh position={[0, d.boss ? 4 : 2.5, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, d.boss ? 8 : 5, 6]} />
          <meshStandardMaterial color="#3a2a1a" />
        </mesh>
        <mesh position={[0.7, d.boss ? 7 : 4.3, 0]}>
          <planeGeometry args={[1.4, d.boss ? 1.6 : 1]} />
          <meshStandardMaterial color={d.boss ? '#111' : kind.color} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

/** sun that follows the player so shadows stay sharp near them */
function Sun({ sim }: { sim: Sim }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const p = sim.player.pos;
    if (!light.current) return;
    light.current.position.set(p[0] + 40, p[1] + 70, p[2] + 25);
    target.position.set(p[0], p[1], p[2]);
    target.updateMatrixWorld();
  });
  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        intensity={2.2}
        color="#fff1d6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-camera-far={200}
        shadow-bias={-0.0005}
      />
    </>
  );
}

export function World({ sim }: { sim: Sim }) {
  return (
    <>
      <fog attach="fog" args={['#bcccd8', 140, 1250]} />
      <hemisphereLight args={['#dfeeff', '#4b5a33', 0.85]} />
      <Sun sim={sim} />
      <Landscape sim={sim} />
      <Village />
      {DENS.map((_, i) => (
        <Den key={i} i={i} />
      ))}
    </>
  );
}

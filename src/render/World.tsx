// The land: terrain coloured by height and paths, scattered trees, the village in the middle and the seven camps.
import { useEffect, useMemo, useRef, useState } from 'react';
import { GLTFLoader, MeshoptDecoder } from 'three-stdlib';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { BUILDINGS, TREES, VILLAGE_R, WORLD_R, groundHeight, pathDist } from '../game/world';
import { DENS, DEN_R, FOE_KINDS } from '../game/foes';
import type { Sim } from '../game/sim';

function Terrain() {
  const geo = useMemo(() => {
    const size = (WORLD_R + 60) * 2;
    const seg = 260;
    const g = new THREE.PlaneGeometry(size, size, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const grass = new THREE.Color('#5d7d3a');
    const grass2 = new THREE.Color('#7a9446');
    const dirt = new THREE.Color('#a48a5c');
    const rock = new THREE.Color('#7b7468');
    const camp = new THREE.Color('#9c8a68');
    const c = new THREE.Color();
    const camps = DENS.map((d) => [d.x, d.z] as [number, number]);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = groundHeight(x, z);
      pos.setY(i, h);
      const n = Math.sin(x * 0.3) * Math.cos(z * 0.27) * 0.5 + 0.5;
      c.copy(grass).lerp(grass2, n * 0.6);
      const p = pathDist(x, z);
      if (p < 4) c.lerp(dirt, Math.min(1, (4 - p) / 2));
      const r = Math.hypot(x, z);
      if (r < VILLAGE_R) c.lerp(dirt, 0.55);
      for (const [cx, cz] of camps) if (Math.hypot(x - cx, z - cz) < DEN_R) c.lerp(camp, 0.5);
      if (h > 10) c.lerp(rock, Math.min(1, (h - 10) / 12));
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} />
    </mesh>
  );
}

function Trees() {
  const { trunks, crowns, crowns2 } = useMemo(() => {
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 3, 6);
    trunkGeo.translate(0, 1.5, 0);
    const pine = new THREE.ConeGeometry(1.8, 5, 7);
    pine.translate(0, 5, 0);
    const round = new THREE.IcosahedronGeometry(2.2, 0);
    round.translate(0, 4.3, 0);
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#5a3d26', roughness: 1 }), TREES.length);
    const pines = TREES.filter((t) => t.kind === 0);
    const rounds = TREES.filter((t) => t.kind === 1);
    const crowns = new THREE.InstancedMesh(pine, new THREE.MeshStandardMaterial({ color: '#2f5a2c', roughness: 0.9, flatShading: true }), pines.length);
    const crowns2 = new THREE.InstancedMesh(round, new THREE.MeshStandardMaterial({ color: '#4f7a2f', roughness: 0.9, flatShading: true }), rounds.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    TREES.forEach((t, i) => {
      p.set(t.x, groundHeight(t.x, t.z) - 0.2, t.z);
      s.setScalar(t.s);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.x * 13.1);
      m.compose(p, q, s);
      trunks.setMatrixAt(i, m);
    });
    pines.forEach((t, i) => {
      p.set(t.x, groundHeight(t.x, t.z) - 0.2, t.z);
      s.setScalar(t.s);
      m.compose(p, q.identity(), s);
      crowns.setMatrixAt(i, m);
    });
    rounds.forEach((t, i) => {
      p.set(t.x, groundHeight(t.x, t.z) - 0.2, t.z);
      s.set(t.s, t.s * 0.9, t.s);
      m.compose(p, q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.z), s);
      crowns2.setMatrixAt(i, m);
    });
    for (const im of [trunks, crowns, crowns2]) {
      im.castShadow = true;
      im.receiveShadow = true;
    }
    return { trunks, crowns, crowns2 };
  }, []);
  return (
    <>
      <primitive object={trunks} />
      <primitive object={crowns} />
      <primitive object={crowns2} />
    </>
  );
}

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
          <coneGeometry args={[0.18, 1.6, 5]} />
          <meshStandardMaterial color="#5b3b22" />
        </mesh>
      ))}
      {[0, 1, 2].map((k) => {
        const a = k * 2.1 + i;
        const x = d.x + Math.cos(a) * 9.5;
        const z = d.z + Math.sin(a) * 9.5;
        return (
          <mesh key={k} position={[x, groundHeight(x, z) + 1.1, z]} rotation={[0, a, 0]} castShadow receiveShadow>
            <coneGeometry args={[2, 2.2, 4]} />
            <meshStandardMaterial color={k === 0 ? kind.color : '#8a7a5c'} roughness={1} />
          </mesh>
        );
      })}
      {/* campfire */}
      <mesh position={[d.x + 2.5, y + 0.25, d.z]}>
        <coneGeometry args={[0.5, 0.8, 6]} />
        <meshBasicMaterial color="#ff8a2a" />
      </mesh>
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
      <color attach="background" args={['#a9c7de']} />
      <fog attach="fog" args={['#b9d0e0', 70, 260]} />
      <hemisphereLight args={['#dfeeff', '#4b5a33', 0.9]} />
      <Sun sim={sim} />
      <Terrain />
      <Trees />
      <Village />
      {DENS.map((_, i) => (
        <Den key={i} i={i} />
      ))}
    </>
  );
}

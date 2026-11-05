// 天阙: the old palace of the seven houses on its mesa at the far end of the north west road. Built from simple
// shapes, merged into one mesh per material (a few draw calls for the whole palace). Its frame: +z faces the gate
// (back down the road toward the village); the footprints that block bodies are TQ_PARTS in game/world.ts.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { GLTFLoader, MeshoptDecoder } from 'three-stdlib';
import { Builder, Built } from './build';
import { TQ_POS, TQ_ROT, TQ_Y } from '../game/layout';
import { tqWall } from '../game/world';

function buildPalace() {
  const b = new Builder();
  // the courtyard's paving (a slab a hand above the ground, so it never z-fights the terrain)
  b.box('step', 0, -0.4, 4, 74, 0.55, 80);
  // the terrace the great hall stands on, its balustrade and the stairs up the front
  const T = 2.4;
  b.box('stone', 0, 0, -10, 40, T, 28);
  b.box('step', 0, T - 0.1, -10, 41, 0.25, 29);
  b.rail(-20, 4, -5, 4, T);
  b.rail(5, 4, 20, 4, T);
  b.rail(-20, 4, -20, -24, T);
  b.rail(20, 4, 20, -24, T);
  b.steps(0, 0, 8, 9.6, T, 8);
  for (const s of [-1, 1]) b.box('stone', s * 5.1, 0, 6.4, 0.6, T + 0.4, 3.8);
  // the great hall: two eaves, gold tiles
  b.hall(0, T, -12, 30, 17, 8.5, 2);
  // a bronze cauldron and lanterns down the middle of the court
  b.col('stone', 0, 0, 16, 1.6, 0.6, 12);
  b.col('bronze', 0, 0.6, 16, 1.25, 1.6, 14);
  for (const z of [26, 18, 10]) for (const s of [-1, 1]) b.lantern(s * 7, 0, z);
  // side halls facing the court
  for (const s of [-1, 1]) b.hall(s * 24, 0.25, 4, 10, 14, 5.2, 1);
  // the bell tower behind the hall: five storeys narrowing upward, the bell in the top
  {
    let y = 0;
    let w = 9;
    b.box('stone', 0, 0, -32, 11, 1.5, 11);
    y = 1.5;
    for (let k = 0; k < 5; k++) {
      const h = k === 0 ? 7 : 5;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.col('red', (sx * w) / 2, y, -32 + (sz * w) / 2, 0.32, h);
      if (k < 4) b.box('wall', 0, y, -32, w - 0.8, h, w - 0.8);
      else {
        b.box('bronze', 0, y + 0.6, -32, 0.18, h - 1.2, 0.18);
        b.col('bronze', 0, y + 0.8, -32, 1.4, 2.4, 16);
      }
      b.box('wood', 0, y + h, -32, w + 0.8, 0.5, w + 0.8);
      b.roof(0, y + h + 0.5, -32, w, w, k === 4 ? 5.5 : 1.6, 1.8);
      y += h + (k === 4 ? 0 : 2.1);
      w *= 0.88;
    }
  }
  // a low wall round the mesa's top, open at the gate
  for (const w of tqWall()) {
    b.box('wall', w.x, -1, w.z, 1, 3.4, w.L, w.ry);
    b.box('roof', w.x, 2.4, w.z, 1.8, 0.35, w.L + 0.2, w.ry);
  }
  return b.build();
}

/** the banners: long black cloths with a gold band, flapping */
function Banners() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const spots = useMemo(() => {
    const out: [number, number][] = [];
    for (const z of [30, 22, 14, 6]) for (const s of [-1, 1]) out.push([s * 12, z]);
    return out;
  }, []);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1.3, 6, 1, 8);
    g.translate(0.65, -3, 0);
    return g;
  }, []);
  const mat = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 128;
    const x = c.getContext('2d')!;
    x.fillStyle = '#16110c';
    x.fillRect(0, 0, 32, 128);
    x.fillStyle = '#c99a3a';
    x.fillRect(0, 6, 32, 5);
    x.fillRect(0, 117, 32, 5);
    x.font = 'bold 22px serif';
    x.textAlign = 'center';
    x.fillText('阙', 16, 70);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 1 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float k = clamp(position.x / 1.3, 0.0, 1.0);
        transformed.z += sin(uTime * 2.6 + position.y * 0.9 + float(gl_InstanceID) * 1.7) * 0.35 * k;`,
      );
    };
    return m;
  }, []);
  const uTime = useMemo(() => ({ value: 0 }), []);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    spots.forEach(([x, z], i) => {
      o.position.set(x, 9.2, z);
      o.rotation.set(0, x < 0 ? 0 : Math.PI, 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [spots]);
  useFrame((_, dt) => (uTime.value += dt));
  return (
    <>
      {spots.map(([x, z], i) => (
        <mesh key={i} position={[x, 4.8, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.12, 9.6, 6]} />
          <meshStandardMaterial color="#3a2616" roughness={1} />
        </mesh>
      ))}
      <instancedMesh ref={ref} args={[geo, mat, spots.length]} castShadow />
    </>
  );
}

const gateLoader = new GLTFLoader();
gateLoader.setMeshoptDecoder(typeof MeshoptDecoder === 'function' ? (MeshoptDecoder as any)() : MeshoptDecoder);
function Gate() {
  const [obj, setObj] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    let alive = true;
    gateLoader
      .loadAsync(import.meta.env.BASE_URL + 'props/paifang.glb')
      .then((g) => {
        if (!alive) return;
        g.scene.traverse((o: any) => {
          if (o.isMesh) o.castShadow = o.receiveShadow = true;
        });
        setObj(g.scene);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return obj ? <primitive object={obj} position={[0, -0.3, 38]} scale={22} /> : null;
}

export function Tianque() {
  const parts = useMemo(buildPalace, []);
  return (
    <group position={[TQ_POS[0], TQ_Y, TQ_POS[1]]} rotation={[0, TQ_ROT, 0]}>
      <Built parts={parts} />
      <Gate />
      <Banners />
      {/* the gold pearl on the bell tower's top: unfogged, so it shows through the haze from far down the road */}
      <mesh position={[0, 44.6, -32]}>
        <sphereGeometry args={[1.6, 12, 10]} />
        <meshBasicMaterial color="#ffcf6a" fog={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

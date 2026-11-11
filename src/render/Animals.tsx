// The beasts (game/animals.ts) drawn: Tripo's rigged animals with their walk, played faster as they speed up and
// faded out to the standing pose when they stop. A beast's model is only made once you come near it.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { GLTFLoader, SkeletonUtils, MeshoptDecoder } from 'three-stdlib';
import type { Sim } from '../game/sim';
import { ANIMALS, type Animal, type AnimalSpec } from '../game/animals';

const BASE = import.meta.env.BASE_URL + 'models/';
const loader = new GLTFLoader();
loader.setMeshoptDecoder(typeof MeshoptDecoder === 'function' ? (MeshoptDecoder as any)() : MeshoptDecoder);
interface Kit {
  scene: THREE.Object3D;
  clip: THREE.AnimationClip | null;
  scale: number;
  floor: number;
  /** turns the model so its head points along +z */
  turn: number;
}
const kits = new Map<string, Promise<Kit>>();
function kitOf(s: AnimalSpec): Promise<Kit> {
  let p = kits.get(s.file);
  if (!p) {
    p = loader.loadAsync(BASE + s.file).then((g) => {
      g.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(g.scene);
      const scale = s.h / Math.max(0.05, box.max.y - box.min.y);
      // which way it faces: from its tail (or its middle) to its head
      const bones: THREE.Object3D[] = [];
      g.scene.traverse((o: any) => {
        if (o.isBone) bones.push(o);
        if (o.isMesh) {
          o.castShadow = true;
          o.frustumCulled = false;
          const m = o.material as THREE.MeshStandardMaterial;
          if (m?.isMeshStandardMaterial) {
            m.roughness = Math.max(m.roughness, 0.75);
            m.metalness = 0;
          }
        }
      });
      const at = (re: RegExp) => bones.find((b) => re.test(b.name))?.getWorldPosition(new THREE.Vector3());
      const head = at(/head/i);
      const tail = at(/tail/i) ?? at(/root|hips|spine/i) ?? new THREE.Vector3();
      const turn = head ? -Math.atan2(head.x - tail.x, head.z - tail.z) : 0;
      // the walk, kept in place (the sim moves the body)
      const clip = g.animations[0]?.clone() ?? null;
      if (clip) clip.tracks = clip.tracks.filter((t) => !(t.name.endsWith('.position') && /root/i.test(t.name)));
      return { scene: g.scene, clip, scale, floor: -box.min.y * scale, turn };
    });
    kits.set(s.file, p);
  }
  return p;
}

const SHOW_R = 110;

function Beast({ sim, a }: { sim: Sim; a: Animal }) {
  const s = ANIMALS[a.kind];
  const group = useRef<THREE.Group>(null);
  const [near, setNear] = useState(false);
  const [body, setBody] = useState<{ obj: THREE.Object3D; mixer: THREE.AnimationMixer; walk: THREE.AnimationAction | null; kit: Kit } | null>(null);
  useEffect(() => {
    if (!near || body) return;
    let alive = true;
    kitOf(s)
      .then((kit) => {
        if (!alive) return;
        const obj = SkeletonUtils.clone(kit.scene);
        const mixer = new THREE.AnimationMixer(obj);
        const walk = kit.clip ? mixer.clipAction(kit.clip) : null;
        if (walk) {
          walk.play();
          walk.time = Math.random() * kit.clip!.duration;
          walk.setEffectiveWeight(0);
        }
        (globalThis as any).__T2_BEASTS = ((globalThis as any).__T2_BEASTS ?? 0) + 1; // headless tests count the beasts drawn
        setBody({ obj, mixer, walk, kit });
      })
      .catch((e) => console.warn('[tq2] beast', s.file, e));
    return () => {
      alive = false;
    };
  }, [near, body, s]);
  const live = useMemo(() => ({ w: 0, hop: 0 }), []);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const p = sim.player.pos;
    const d = Math.hypot(a.x - p[0], a.z - p[2]);
    if (!near && d < SHOW_R) setNear(true);
    const vis = d < SHOW_R && sim.indoor < 0 && !(a as any).caught;
    g.visible = vis;
    if (!vis || !body) return;
    // a hare bounds, the rest keep to the ground
    let y = a.y;
    if (a.kind === 'rabbit' && a.speed > 1.5) {
      live.hop += dt * 13;
      y += Math.abs(Math.sin(live.hop)) * 0.28;
    }
    g.position.set(a.x, y, a.z);
    g.rotation.y = a.yaw;
    const moving = a.speed > 0.05 || a.state === 'warn';
    live.w += ((moving ? 1 : 0) - live.w) * Math.min(1, dt * 5);
    if (body.walk) {
      body.walk.setEffectiveWeight(live.w);
      // the boar paws the ground before it charges
      const pace = a.state === 'warn' ? 2.2 : a.speed / s.stride;
      body.walk.setEffectiveTimeScale(Math.max(0.3, Math.min(4.5, pace)));
    }
    body.mixer.update(dt);
    // breathing while it stands
    const br = 1 + Math.sin(sim.time * 2.1 + a.id) * 0.012 * (1 - live.w);
    body.obj.scale.set(body.kit.scale, body.kit.scale * br, body.kit.scale);
  });
  return (
    <group ref={group}>
      {body && (
        <group rotation={[0, body.kit.turn, 0]}>
          <primitive object={body.obj} position={[0, body.kit.floor, 0]} />
        </group>
      )}
    </group>
  );
}

export function Animals({ sim }: { sim: Sim }) {
  return (
    <>
      {sim.animals.map((a) => (
        <Beast key={a.id} sim={sim} a={a} />
      ))}
    </>
  );
}

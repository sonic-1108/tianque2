// What the kit's summons look like (game/kit.ts pets): 御兽师's wolves (Tripo, rigged, with their walk), the hawk and
// 机关师's puppet and crossbow tower (Tripo props), the spirit deer (the wild deer's body, glowing pale).
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { GLTFLoader, SkeletonUtils, MeshoptDecoder } from 'three-stdlib';
import type { Sim } from '../game/sim';
import { kitWorld, type Pet, type PetKind } from '../game/kit';

const BASE = import.meta.env.BASE_URL + 'models/';
const loader = new GLTFLoader();
loader.setMeshoptDecoder(typeof MeshoptDecoder === 'function' ? (MeshoptDecoder as any)() : MeshoptDecoder);
const LOOK: Record<PetKind, { file: string; h: number; spirit?: boolean }> = {
  wolf: { file: 's-wolf.glb', h: 0.95 },
  hawk: { file: 's-hawk.glb', h: 0.5 },
  puppet: { file: 's-puppet.glb', h: 1.9 },
  turret: { file: 's-turret.glb', h: 1.5 },
  deer: { file: 'deer.glb', h: 1.4, spirit: true },
};
interface Body {
  scene: THREE.Object3D;
  clip: THREE.AnimationClip | null;
  scale: number;
  floor: number;
  turn: number;
}
const bodies = new Map<string, Promise<Body>>();
function bodyOf(kind: PetKind): Promise<Body> {
  const L = LOOK[kind];
  let p = bodies.get(L.file);
  if (!p) {
    p = loader.loadAsync(BASE + L.file).then((g) => {
      g.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(g.scene);
      const size = box.getSize(new THREE.Vector3());
      // the hawk flies: size it by its wingspan; the rest by height
      const scale = kind === 'hawk' ? 1.3 / Math.max(size.x, size.z) : L.h / Math.max(0.05, size.y);
      const bones: THREE.Object3D[] = [];
      g.scene.traverse((o: any) => {
        if (o.isBone) bones.push(o);
        if (o.isMesh) {
          o.castShadow = true;
          o.frustumCulled = false;
        }
      });
      // a rigged beast faces from its tail to its head; Tripo props face +x
      const at = (re: RegExp) => bones.find((b) => re.test(b.name))?.getWorldPosition(new THREE.Vector3());
      const head = at(/head/i), tail = at(/tail/i) ?? at(/root|hips|spine/i);
      const turn = head && tail ? -Math.atan2(head.x - tail.x, head.z - tail.z) : -Math.PI / 2;
      const clip = g.animations[0]?.clone() ?? null;
      if (clip) clip.tracks = clip.tracks.filter((t) => !(t.name.endsWith('.position') && /root/i.test(t.name)));
      return { scene: g.scene, clip, scale, floor: -box.min.y * scale, turn };
    });
    bodies.set(L.file, p);
  }
  return p;
}

function PetView({ sim, id }: { sim: Sim; id: number }) {
  const group = useRef<THREE.Group>(null);
  const pet = (): Pet | undefined => kitWorld(sim).pets.find((p) => p.id === id);
  const kind = useMemo(() => pet()?.kind ?? 'wolf', []); // eslint-disable-line react-hooks/exhaustive-deps
  const [body, setBody] = useState<{ obj: THREE.Object3D; mixer: THREE.AnimationMixer; walk: THREE.AnimationAction | null; b: Body } | null>(null);
  useEffect(() => {
    let alive = true;
    bodyOf(kind).then((b) => {
      if (!alive) return;
      const obj = SkeletonUtils.clone(b.scene);
      if (LOOK[kind].spirit)
        obj.traverse((o: any) => {
          if (o.isMesh) {
            o.material = (o.material as THREE.MeshStandardMaterial).clone();
            o.material.transparent = true;
            o.material.opacity = 0.7;
            o.material.emissive = new THREE.Color('#bbf7d0');
            o.material.emissiveIntensity = 0.7;
          }
        });
      const mixer = new THREE.AnimationMixer(obj);
      const walk = b.clip ? mixer.clipAction(b.clip) : null;
      walk?.play();
      setBody({ obj, mixer, walk, b });
    });
    return () => {
      alive = false;
    };
  }, [kind]);
  useFrame((_, dt) => {
    const p = pet(), g = group.current;
    if (!g) return;
    g.visible = !!p && sim.indoor < 0;
    if (!p || !body) return;
    g.position.set(p.x, p.y + body.b.floor, p.z);
    g.rotation.y = p.yaw + Math.PI + body.b.turn;
    // the engines rise out of the ground; the hawk banks as it circles
    const rise = Math.min(1, (p.max - p.life) / 0.4);
    g.scale.setScalar(body.b.scale * (kind === 'turret' || kind === 'puppet' ? rise : 1));
    if (kind === 'hawk') g.rotation.z = Math.sin(p.phase * 2) * 0.35;
    if (body.walk) body.walk.setEffectiveWeight(p.moving ? 1 : 0.15);
    body.mixer.update(dt * (p.moving ? 1.6 : 0.5));
  });
  return <group ref={group}>{body && <primitive object={body.obj} />}</group>;
}

export function Summons({ sim }: { sim: Sim }) {
  const [ids, setIds] = useState<number[]>([]);
  useEffect(() => {
    const t = setInterval(() => {
      const now = kitWorld(sim).pets.map((p) => p.id);
      setIds((was) => (was.length === now.length && was.every((x, i) => x === now[i]) ? was : now));
    }, 200);
    return () => clearInterval(t);
  }, [sim]);
  return (
    <>
      {ids.map((id) => (
        <PetView key={id} sim={sim} id={id} />
      ))}
    </>
  );
}

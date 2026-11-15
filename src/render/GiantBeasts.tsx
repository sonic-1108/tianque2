// The giants that are beasts (giants.ts look 'beast': 啸月天狼): the Tripo animal's body, many times its size, its walk
// played fast as it lopes and faster still as it springs, its fur lit from inside with the giant's colour (and gold
// while it stands open). Drawn here, not by Rig, which knows only bodies on two legs.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { SkeletonUtils } from 'three-stdlib';
import type { Sim } from '../game/sim';
import type { Fighter } from '../game/types';
import { ANIMALS } from '../game/animals';
import { giantOf, giantOpen, giantPhase } from '../game/giants';
import { kitOf } from './Animals';

function Beast({ sim, f }: { sim: Sim; f: Fighter }) {
  const def = giantOf(f)!;
  const spec = ANIMALS.wolf;
  const group = useRef<THREE.Group>(null);
  const [body, setBody] = useState<{ obj: THREE.Object3D; mixer: THREE.AnimationMixer; walk: THREE.AnimationAction | null; scale: number; floor: number; turn: number; mats: THREE.MeshStandardMaterial[] } | null>(null);
  useEffect(() => {
    let alive = true;
    kitOf(spec).then((kit) => {
      if (!alive) return;
      const obj = SkeletonUtils.clone(kit.scene);
      const mats: THREE.MeshStandardMaterial[] = [];
      obj.traverse((o: any) => {
        if (!o.isMesh) return;
        o.material = (o.material as THREE.MeshStandardMaterial).clone();
        mats.push(o.material);
      });
      const mixer = new THREE.AnimationMixer(obj);
      const walk = kit.clip ? mixer.clipAction(kit.clip) : null;
      walk?.play();
      const k = def.bodyH / spec.h;
      setBody({ obj, mixer, walk, scale: kit.scale * k, floor: kit.floor * k, turn: kit.turn, mats });
    });
    return () => {
      alive = false;
    };
  }, [spec, def]);
  const live = useMemo(() => ({ last: [0, 0] as [number, number], speed: 0 }), []);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const p = sim.player.pos;
    g.visible = f.hp > 0 && !(f as any).benched && sim.indoor < 0 && Math.hypot(f.pos[0] - p[0], f.pos[2] - p[2]) < 140;
    if (!g.visible || !body) return;
    g.position.set(f.pos[0], f.pos[1], f.pos[2]);
    g.rotation.y = f.yaw + Math.PI;
    const sp = Math.hypot(f.pos[0] - live.last[0], f.pos[2] - live.last[1]) / Math.max(dt, 1e-3);
    live.last = [f.pos[0], f.pos[2]];
    live.speed += (Math.min(sp, 30) - live.speed) * Math.min(1, dt * 6);
    if (body.walk) body.walk.setEffectiveTimeScale(f.act === 'cast' ? 2.6 : Math.max(0.35, live.speed / 4));
    body.mixer.update(dt);
    const t = performance.now() / 1000, ph = giantPhase(f);
    const c = new THREE.Color(def.color).multiplyScalar(0.06 + ph * 0.025 + Math.sin(t * (ph * 2 + 2)) * 0.04);
    if (giantOpen(f) > 0) c.lerp(new THREE.Color('#ffd84a'), 0.35 + Math.sin(t * 12) * 0.12);
    for (const m of body.mats) m.emissive?.copy(c);
  });
  return (
    <group ref={group}>
      {body && (
        <group rotation={[0, body.turn, 0]}>
          <primitive object={body.obj} scale={body.scale} position={[0, body.floor, 0]} />
        </group>
      )}
    </group>
  );
}

export function GiantBeasts({ sim }: { sim: Sim }) {
  const list = useMemo(() => sim.fighters.filter((f) => giantOf(f)?.look === 'beast'), [sim]);
  return (
    <>
      {list.map((f) => (
        <Beast key={f.id} sim={sim} f={f} />
      ))}
    </>
  );
}

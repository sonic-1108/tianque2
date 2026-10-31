// The 3D view: steps the sim every frame, puts the camera over the player's shoulder, draws the world and everyone in it.
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { Sim } from '../game/sim';
import { groundHeight } from '../game/world';
import { readInput, takeMouse } from '../input';
import { World } from './World';
import { Rig } from './Rig';
import { Fx } from './Fx';

export const cam = { yaw: 0, pitch: 0.25, dist: 6 };

function Loop({ sim }: { sim: Sim }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const smooth = useRef(new THREE.Vector3());
  const init = useRef(false);
  useFrame((_, dt) => {
    const m = takeMouse();
    cam.yaw -= m.dx * 0.0025;
    cam.pitch = Math.max(-0.35, Math.min(1.2, cam.pitch + m.dy * 0.0025));
    cam.dist = Math.max(2.5, Math.min(14, cam.dist + m.wheel * 0.004));
    const turbo = (globalThis as any).__T2_TURBO ?? 1;
    for (let k = 0; k < turbo; k++) sim.step(dt, readInput(cam.yaw));
    // camera: over the right shoulder, the player in the left third
    const p = sim.player.pos;
    const sh = 0.8;
    const tx = p[0] + Math.cos(cam.yaw) * sh;
    const tz = p[2] - Math.sin(cam.yaw) * sh;
    const ty = p[1] + 1.7;
    const want = new THREE.Vector3(
      tx + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist,
      ty + Math.sin(cam.pitch) * cam.dist,
      tz + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist,
    );
    if (!init.current) {
      smooth.current.copy(want);
      init.current = true;
    }
    smooth.current.lerp(want, 1 - Math.exp(-20 * dt));
    const c = smooth.current.clone();
    c.y = Math.max(c.y, groundHeight(c.x, c.z) + 0.5);
    camera.position.copy(c);
    camera.lookAt(tx, ty, tz);
  }, -1);
  return null;
}

export function Scene({ sim, version }: { sim: Sim; version: number }) {
  void version; // bumps when the player's body changes (a hero picked)
  return (
    <>
      <Loop sim={sim} />
      <World sim={sim} />
      {sim.fighters.map((f) => (
        <Rig key={`${f.id}:${f.model}`} sim={sim} id={f.id} />
      ))}
      <Fx sim={sim} />
    </>
  );
}

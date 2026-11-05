// The 3D view: steps the sim every frame, puts the camera over the player's shoulder, draws the world and everyone in it.
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { Sim } from '../game/sim';
import { groundHeight, inBuilding } from '../game/world';
import { readInput, takeMouse } from '../input';
import { World } from './World';
import { Rig } from './Rig';
import { HouseFx } from './HouseFx';
import { Juice, juice } from './Juice';
import { Post } from './Post';

export const cam = { yaw: 0, pitch: 0.25, dist: 6 };
(globalThis as any).__T2_CAM = cam;

function Loop({ sim }: { sim: Sim }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const smooth = useRef(new THREE.Vector3());
  const init = useRef(false);
  const scope = useRef(0);
  useFrame((_, dt) => {
    const m = takeMouse();
    cam.yaw -= m.dx * 0.0025;
    cam.pitch = Math.max(-0.35, Math.min(1.2, cam.pitch + m.dy * 0.0025));
    cam.dist = Math.max(2.5, Math.min(14, cam.dist + m.wheel * 0.004));
    const turbo = (globalThis as any).__T2_TURBO ?? 1;
    // hit-stop: the world all but freezes for a few hundredths when the player's blow lands
    let sdt = dt;
    if (sim.hitstop > 0) {
      sim.hitstop -= dt;
      sdt = dt * 0.08;
    }
    for (let k = 0; k < turbo; k++) sim.step(sdt, readInput(cam.yaw));
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
    // a wall between the camera and the player: come in along the boom until it's clear
    for (let k = 1; k <= 12; k++) {
      const t = k / 12;
      const x = tx + (c.x - tx) * t, y = ty + (c.y - ty) * t, z = tz + (c.z - tz) * t;
      if (inBuilding(x, y, z, 0.3)) {
        const back = Math.max(0.15, (k - 1) / 12);
        c.set(tx + (c.x - tx) * back, ty + (c.y - ty) * back, tz + (c.z - tz) * back);
        break;
      }
    }
    c.y = Math.max(c.y, groundHeight(c.x, c.z) + 0.5);
    camera.position.copy(c);
    camera.lookAt(tx, ty, tz);
    if (juice.trauma > 0.001) {
      const t = performance.now() * 0.045;
      const k = juice.trauma * juice.trauma * 0.35;
      camera.position.x += Math.sin(t * 1.3) * k;
      camera.position.y += Math.cos(t * 1.7) * k;
      camera.rotation.z += Math.sin(t * 1.1) * k * 0.08;
    }
    // 穿云狙: down the scope, the view closes in
    const scoped = sim.player.run?.id === 'snipe';
    scope.current += ((scoped ? 1 : 0) - scope.current) * Math.min(1, dt * 10);
    if (scope.current > 0.01) {
      const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
      const eye = new THREE.Vector3(p[0] + fx * 0.25, p[1] + 1.62, p[2] + fz * 0.25);
      camera.position.lerp(eye, scope.current);
      camera.lookAt(eye.x + fx * 20, eye.y - Math.sin(cam.pitch - 0.25) * 6, eye.z + fz * 20);
    }
    const fov = 62 + juice.kick - scope.current * 40;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
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
      <HouseFx sim={sim} />
      <Juice sim={sim} />
      <Post />
    </>
  );
}

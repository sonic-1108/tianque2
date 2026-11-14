// The 3D view: steps the sim every frame, puts the camera over the player's shoulder, draws the world and everyone in it.
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { Sim } from '../game/sim';
import { groundHeight, inBuilding } from '../game/world';
import { ROOMS, ROOM_Y } from '../game/interiors';
import { readInput, takeMouse, took, heldKey } from '../input';
import { World } from './World';
import { Rig } from './Rig';
import { HouseFx } from './HouseFx';
import { Juice, juice } from './Juice';
import { Post } from './Post';

export const cam = { yaw: 0, pitch: 0.22, dist: 4.2 };
(globalThis as any).__T2_CAM = cam;
/** 端详 (V): the camera comes round to the face of whoever is nearest in front (or your own) */
export const look = { on: false, id: -1, yaw: 0, pitch: 0.05, dist: 0.85, blend: 0, head: new THREE.Vector3(), name: '' };
(globalThis as any).__T2_LOOK = look;
const heads = new Map<number, THREE.Object3D | null>();
const tops = new Map<number, THREE.Object3D | null>();
const tmpTop = new THREE.Vector3();
/** where a body's head is: its head bone if the rig has one, else a guess from its height */
function headOf(sim: Sim, id: number, out: THREE.Vector3) {
  const f = sim.fighters[id];
  const obj = (globalThis as any).__T2_OBJ?.[id] as THREE.Object3D | undefined;
  let b = heads.get(id);
  if (obj && (b === undefined || (b && !b.parent))) {
    b = null;
    obj.traverse((o) => {
      if (!b && (o as any).isBone && /head/i.test(o.name) && !/top|end|neck/i.test(o.name)) b = o;
    });
    heads.set(id, b);
    // the crown (a rig's HeadTop_End): the eyes are about a third of the way up from the head bone to it
    let t: THREE.Object3D | null = null;
    (b as THREE.Object3D | null)?.traverse((o) => {
      if (!t && o !== b && /top|end/i.test(o.name)) t = o;
    });
    tops.set(id, t);
  }
  if (b) {
    b.getWorldPosition(out);
    const t = tops.get(id);
    if (t) {
      t.getWorldPosition(tmpTop);
      out.lerp(tmpTop, 0.35);
    } else out.y += 0.06;
    return out;
  }
  return out.set(f.pos[0], f.pos[1] + 1.62, f.pos[2]);
}
/** the nearest body in front of you worth looking at: folk, companions, foes; else yourself */
function pickLook(sim: Sim) {
  const p = sim.player, fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  let best = -1, bestD = 7.5;
  for (const f of sim.fighters) {
    if (f === p || f.hp <= 0 || (f as any).away || (f as any).benched) continue;
    const dx = f.pos[0] - p.pos[0], dz = f.pos[2] - p.pos[2], d = Math.hypot(dx, dz);
    if (d > 7.5 || (dx * fx + dz * fz) / (d || 1) < -0.1) continue;
    const score = d - (dx * fx + dz * fz) / (d || 1) * 1.5;
    if (score < bestD) (bestD = score), (best = f.id);
  }
  return best < 0 ? p.id : best;
}

function Loop({ sim }: { sim: Sim }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const smooth = useRef(new THREE.Vector3());
  const init = useRef(false);
  const scope = useRef(0);
  useFrame((_, dt) => {
    if (sim.camSnap !== null) {
      cam.yaw = sim.camSnap; // through a door: look the way you're walking
      sim.camSnap = null;
      init.current = false;
    }
    const m = takeMouse();
    // V: look at a face, and V again (or a step) to come back
    if (took('KeyV')) {
      if (look.on) look.on = false;
      else {
        look.id = pickLook(sim);
        const t = sim.fighters[look.id];
        look.on = true;
        // start in front of the face, a little to one side
        look.yaw = t.yaw + (look.id === sim.player.id ? 0 : 0) + 0.35;
        look.pitch = 0.04;
        look.dist = look.id === sim.player.id ? 0.95 : 0.85;
        look.name = (t as any).name ?? '';
      }
    }
    if (look.on && (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].some(heldKey) || !sim.fighters[look.id] || sim.fighters[look.id].hp <= 0)) look.on = false;
    if (look.on) {
      look.yaw -= m.dx * 0.004;
      look.pitch = Math.max(-0.5, Math.min(0.8, look.pitch + m.dy * 0.003));
      look.dist = Math.max(0.45, Math.min(2.4, look.dist + m.wheel * 0.0012));
    } else {
      cam.yaw -= m.dx * 0.0025;
      cam.pitch = Math.max(-0.35, Math.min(1.2, cam.pitch + m.dy * 0.0025));
      cam.dist = Math.max(1.4, Math.min(14, cam.dist + m.wheel * 0.004));
    }
    look.blend += ((look.on ? 1 : 0) - look.blend) * Math.min(1, dt * 5);
    const turbo = (globalThis as any).__T2_TURBO ?? 1;
    // hit-stop: the world all but freezes for a few hundredths when the player's blow lands
    let sdt = dt;
    if (sim.hitstop > 0) {
      sim.hitstop -= dt;
      sdt = dt * 0.05;
    } else if (sim.slowmo > 0) {
      // a kill: the world runs slow for a moment, easing back to full speed
      sim.slowmo -= dt;
      sdt = dt * (0.3 + 0.7 * (1 - Math.min(1, sim.slowmo / 0.35)) ** 2);
    }
    for (let k = 0; k < turbo; k++) sim.step(sdt, readInput(cam.yaw));
    // camera: over the right shoulder, the player in the left third; wheeled in close it comes up to the head
    const p = sim.player.pos;
    const near = Math.max(0, Math.min(1, (2.6 - cam.dist) / 1.2));
    const sh = 0.65 - near * 0.2;
    const tx = p[0] + Math.cos(cam.yaw) * sh;
    const tz = p[2] - Math.sin(cam.yaw) * sh;
    const ty = p[1] + 1.58 + near * 0.06;
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
    const room = sim.indoor >= 0 ? ROOMS[sim.indoor] : null;
    if (room) {
      // in a room: the camera stays under the beams and inside the walls
      c.y = Math.min(Math.max(c.y, ROOM_Y + 0.4), ROOM_Y + room.h - 0.5);
      c.x = Math.min(Math.max(c.x, room.ox - room.w / 2 + 0.35), room.ox + room.w / 2 - 0.35);
      c.z = Math.min(Math.max(c.z, room.oz - room.d / 2 + 0.35), room.oz + room.d / 2 - 0.35);
    } else c.y = Math.max(c.y, groundHeight(c.x, c.z) + 0.5);
    camera.position.copy(c);
    camera.lookAt(tx, ty, tz);
    if (juice.push > 0.001) {
      camera.position.x += juice.px * juice.push;
      camera.position.z += juice.pz * juice.push;
    }
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
    // 端详: round to the face, close, a narrow lens; blended so it glides in and out
    if (look.blend > 0.002 && sim.fighters[look.id]) {
      const h = headOf(sim, look.id, look.head);
      const eye = new THREE.Vector3(
        h.x + Math.sin(look.yaw) * Math.cos(look.pitch) * look.dist * -1,
        h.y + Math.sin(look.pitch) * look.dist,
        h.z + Math.cos(look.yaw) * Math.cos(look.pitch) * look.dist * -1,
      );
      const k = look.blend * look.blend * (3 - 2 * look.blend);
      camera.position.lerp(eye, k);
      const at = new THREE.Vector3(tx, ty, tz).lerp(h, k);
      camera.lookAt(at);
    }
    const fov = 62 + juice.kick - scope.current * 40 - look.blend * 30;
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

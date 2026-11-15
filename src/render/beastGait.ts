import * as THREE from 'three';
import type { Fighter } from '../game/types';

// A Tripo quadruped rig with no clips of its own (the ice wolf, giant-tianlang.glb) is walked by hand: tripo::0_* are the
// fore legs, 1_* the hind legs, Limb_0 hip or shoulder, Limb_1 the next joint down; Spine, Head, Tail chains. Each bone
// turns about the body's own side axis (or up axis), worked out once from the rest pose, so the gait reads the same
// whatever the bones' own frames are.
export type Gait = { bones: Record<string, { b: THREE.Object3D; rest: THREE.Quaternion; side: THREE.Vector3; up: THREE.Vector3 }>; p: number; t?: number };
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
export function makeGait(obj: THREE.Object3D, turn: number): Gait | null {
  obj.updateMatrixWorld(true);
  void turn; // the rest pose is read before the kit's turn is applied: the side axis is the model's own z
  const bones: Gait['bones'] = {};
  // three drops the colons: tripo::0_Left_Limb_0 loads as tripo0_Left_Limb_0
  const want = /(\d_(?:Left|Right)_Limb_[012]|Spine_[12]|Head_[012]|Tail_[01])$/;
  obj.traverse((o: any) => {
    const m = o.isBone && /tripo/i.test(o.name) ? want.exec(o.name) : null;
    if (!m) return;
    const wq = o.getWorldQuaternion(new THREE.Quaternion()).invert();
    bones[m[1]] = { b: o, rest: o.quaternion.clone(), side: new THREE.Vector3(0, 0, 1).applyQuaternion(wq), up: new THREE.Vector3(0, 1, 0).applyQuaternion(wq) };
  });
  return Object.keys(bones).length > 6 ? { bones, p: 0 } : null;
}
/** turn a bone from its rest by a about the body's side axis and y about its up axis */
function pose(g: Gait, name: string, a: number, y = 0) {
  const k = g.bones[name];
  if (!k) return;
  k.b.quaternion.copy(k.rest).multiply(qa.setFromAxisAngle(k.side, a)).multiply(qb.setFromAxisAngle(k.up, y));
}
const ease = (x: number) => x * x * (3 - 2 * x);

/** the hand-made gait: a trot that lengthens into a bound with speed, and a pose for each blow as it winds up */
export function walkByHand(g: Gait, f: Fighter, speed: number, dt: number, obj: THREE.Object3D, floor: number, h: number) {
  // a giant ambles at a few metres a second: full stride from 7 m/s, still legs when it stands
  const run = Math.min(1, speed / 7), moving = speed > 0.6;
  const mv = (f as any).giant?.move as { m: { id: string; wind: number }; t: number } | null;
  g.p += dt * (moving ? 2 + speed * 0.45 : 0);
  g.t = (g.t ?? 0) + dt;
  const p = g.p, t = g.t, amp = moving ? 0.22 + run * 0.5 : 0;
  // what each blow does to the whole body
  let crouch = 0, head = 0, headYaw = Math.sin(t * 0.45) * 0.3 * (moving ? 0.2 : 1), tail = 0, twist = 0, pitch = 0, lunge = 0, fore = 0, hind = 0;
  if (mv) {
    const w = mv.m.wind, k = ease(Math.min(1, mv.t / w)), hit = mv.t >= w, after = hit ? Math.max(0, 1 - (mv.t - w) * 1.6) : 1;
    switch (mv.m.id) {
      case 'howl': // rears up and howls at the sky
      case 'icicles':
        pitch = -0.42 * k * after;
        head = -0.9 * k * after;
        fore = -0.5 * k * after;
        headYaw = 0;
        break;
      case 'breath': // head low, the frost swept side to side
      case 'frost':
        head = 0.45 * k * after;
        crouch = 0.35 * k * after;
        pitch = 0.12 * k * after;
        headYaw = hit ? Math.sin(mv.t * 4) * 0.35 * after : 0;
        break;
      case 'bite': // draws its head back, then snaps forward
        head = (hit ? 0.55 : -0.45 * k) * after;
        pitch = (hit ? 0.18 : -0.12 * k) * after;
        lunge = (hit ? 0.09 : -0.03 * k) * after;
        fore = (hit ? -0.6 : 0.2 * k) * after;
        headYaw = 0;
        break;
      case 'tail': // spins round and lashes the tail
        tail = Math.sin(mv.t * 8) * 1.2 * after;
        twist = Math.sin(mv.t * 8) * 0.35 * after;
        crouch = 0.2 * k * after;
        break;
      case 'pounce': // gathers on its haunches, then flies with every leg stretched
      case 'chain':
        if (!hit) {
          crouch = 0.8 * k;
          pitch = 0.1 * k;
          head = 0.25 * k;
        } else {
          pitch = -0.2 * after;
          fore = -0.9 * after;
          hind = 0.9 * after;
          lunge = 0.05 * after;
        }
        headYaw = 0;
        break;
    }
  }
  // the legs: diagonal pairs swing together, the lower joint folding as the leg comes forward
  const leg = (front: boolean, side: 'Left' | 'Right', ph: number) => {
    const n = (front ? '0_' : '1_') + side + '_Limb_';
    const sw = Math.sin(ph), lift = Math.max(0, Math.cos(ph));
    let a0 = -sw * amp + (front ? fore : hind), a1 = (front ? 1 : -1) * lift * amp * 1.2;
    if (!front && crouch) {
      a0 -= crouch * 0.7;
      a1 += crouch * 1.0;
    }
    if (front && crouch) a1 += crouch * 0.35;
    pose(g, n + '0', a0);
    pose(g, n + '1', a1);
  };
  leg(true, 'Left', p);
  leg(false, 'Right', p + run * 0.5);
  leg(true, 'Right', p + Math.PI);
  leg(false, 'Left', p + Math.PI + run * 0.5);
  // breath in the chest, the head looking about, the tail never quite still
  const breathe = Math.sin(t * 1.7) * 0.035;
  pose(g, 'Spine_1', breathe + Math.sin(p * 2) * 0.05 * run - crouch * 0.12, twist);
  pose(g, 'Spine_2', -breathe * 0.6 + crouch * 0.1, twist * 0.7);
  pose(g, 'Head_0', head * 0.45, headYaw * 0.5);
  pose(g, 'Head_1', Math.sin(p * 2 + 0.6) * 0.06 * run + head * 0.4 + breathe, headYaw * 0.5);
  pose(g, 'Head_2', head * 0.25);
  pose(g, 'Tail_0', 0.2 - run * 0.4 - Math.abs(pitch) * 0.5, Math.sin(t * 1.3 + p * 0.5) * (0.25 + run * 0.15) + tail);
  pose(g, 'Tail_1', -0.1, Math.sin(t * 1.3 + p * 0.5 - 0.8) * 0.25 + tail * 0.6);
  // the whole body: up on its hind legs or down on its forelegs (turned about its hind or fore feet), lunging,
  // rising and falling with the stride, sinking as it crouches. The head lies along the model's -x.
  const pivot = pitch < 0 ? 0.15 : -0.2; // hind feet when rearing, fore feet when pitching down (model units)
  const sc = obj.scale.x;
  obj.rotation.z = pitch;
  const px = pivot * sc;
  const dx = px - px * Math.cos(pitch), dy = -px * Math.sin(pitch);
  obj.position.x = dx - lunge * sc;
  obj.position.y = floor + dy + h * (Math.abs(Math.sin(p)) * 0.03 * run - crouch * 0.07);
}

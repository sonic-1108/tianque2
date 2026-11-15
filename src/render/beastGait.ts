import * as THREE from 'three';
import type { Fighter } from '../game/types';

// A Tripo quadruped rig with no clips of its own (the ice wolf, giant-tianlang.glb) is walked by hand: tripo::0_* are the
// fore legs, 1_* the hind legs, Limb_0 hip or shoulder, Limb_1 the next joint down; Spine, Head, Tail chains. Each bone
// turns about the body's own side axis (or up axis), worked out once from the rest pose, so the gait reads the same
// whatever the bones' own frames are.
export type Gait = { bones: Record<string, { b: THREE.Object3D; rest: THREE.Quaternion; side: THREE.Vector3; up: THREE.Vector3 }>; p: number };
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
  const run = Math.min(1, speed / 12), mv = (f as any).giant?.move as { m: { id: string; wind: number }; t: number } | null;
  g.p += dt * (1.2 + speed * 0.32);
  const p = g.p, amp = 0.08 + run * 0.5;
  // diagonal pairs swing together; the far joint folds as the leg comes forward
  const leg = (fore: boolean, side: 'Left' | 'Right', ph: number) => {
    const n = (fore ? '0_' : '1_') + side + '_Limb_';
    const s = Math.sin(ph), lift = Math.max(0, Math.cos(ph));
    pose(g, n + '0', -s * amp);
    pose(g, n + '1', (fore ? 1 : -1) * lift * amp * 1.1);
  };
  // a blow on its way: crouch, raise the head, lash the tail
  let crouch = 0, head = 0, tail = 0, twist = 0;
  if (mv) {
    const k = ease(Math.min(1, mv.t / mv.m.wind)), after = mv.t > mv.m.wind ? Math.max(0, 1 - (mv.t - mv.m.wind) * 2) : 1;
    const id = mv.m.id;
    if (id === 'howl') head = -0.75 * k * after; // the muzzle up to the moon
    else if (id === 'breath' || id === 'frost') { head = 0.35 * k * after; crouch = 0.25 * k * after; }
    else if (id === 'bite') head = (mv.t < mv.m.wind ? -0.3 * k : 0.45) * after;
    else if (id === 'tail') { tail = Math.sin(mv.t * 9) * 1.1 * after; twist = Math.sin(mv.t * 9) * 0.25 * after; }
    else if (id === 'pounce' || id === 'chain') crouch = (mv.t < mv.m.wind ? 0.75 * k : -0.3) * after; // gathers, then stretches out
    else if (id === 'icicles') head = -0.4 * k * after;
  }
  leg(true, 'Left', p);
  leg(false, 'Right', p + run * 0.5);
  leg(true, 'Right', p + Math.PI);
  leg(false, 'Left', p + Math.PI + run * 0.5);
  if (crouch) {
    // the hind legs fold under it
    for (const sd of ['Left', 'Right']) {
      pose(g, '1_' + sd + '_Limb_0', -crouch * 0.6);
      pose(g, '1_' + sd + '_Limb_1', crouch * 0.9);
    }
  }
  pose(g, 'Spine_1', Math.sin(p * 2) * 0.04 * (0.3 + run) - crouch * 0.12, twist);
  pose(g, 'Spine_2', crouch * 0.1, twist * 0.6);
  pose(g, 'Head_1', Math.sin(p * 2 + 0.6) * 0.05 * (0.4 + run) + head * 0.6);
  pose(g, 'Head_0', head * 0.5);
  pose(g, 'Head_2', head * 0.3);
  pose(g, 'Tail_0', 0.15 - run * 0.35, Math.sin(p) * 0.25 + tail);
  pose(g, 'Tail_1', 0, Math.sin(p - 0.7) * 0.2 + tail * 0.5);
  // the body rises and falls with the stride, and sinks as it crouches
  obj.position.y = floor + h * (Math.abs(Math.sin(p)) * 0.025 * run - crouch * 0.06);
}


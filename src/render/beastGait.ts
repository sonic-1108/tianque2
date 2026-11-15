import * as THREE from 'three';
import type { Fighter } from '../game/types';

// A Tripo quadruped rig with no clips of its own (the ice wolf, giant-tianlang.glb) is walked by hand: tripo::0_* are the
// fore legs, 1_* the hind legs, Limb_0 hip or shoulder, Limb_1 the next joint down; Spine, Head, Tail chains. Each bone
// turns about the body's own side axis (or up axis), worked out once from the rest pose, so the gait reads the same
// whatever the bones' own frames are.
export type Gait = { bones: Record<string, { b: THREE.Object3D; rest: THREE.Quaternion; side: THREE.Vector3; up: THREE.Vector3; fwd: THREE.Vector3 }>; p: number; t?: number; yaw?: number; turn?: number; s?: Record<string, number> };
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
export function makeGait(obj: THREE.Object3D, turn: number): Gait | null {
  obj.updateMatrixWorld(true);
  void turn; // the rest pose is read before the kit's turn is applied: the side axis is the model's own z
  const bones: Gait['bones'] = {};
  // three drops the colons: tripo::0_Left_Limb_0 loads as tripo0_Left_Limb_0
  const want = /(\d_(?:Left|Right)_Limb_[0123]|Spine_[0123]|Head_[01234]|Tail_[012])$/;
  obj.traverse((o: any) => {
    const m = o.isBone && /tripo/i.test(o.name) ? want.exec(o.name) : null;
    if (!m) return;
    const wq = o.getWorldQuaternion(new THREE.Quaternion()).invert();
    bones[m[1]] = { b: o, rest: o.quaternion.clone(), side: new THREE.Vector3(0, 0, 1).applyQuaternion(wq), up: new THREE.Vector3(0, 1, 0).applyQuaternion(wq), fwd: new THREE.Vector3(-1, 0, 0).applyQuaternion(wq) };
  });
  return Object.keys(bones).length > 6 ? { bones, p: 0 } : null;
}
/** turn a bone from its rest by a about the body's side axis and y about its up axis */
const qc = new THREE.Quaternion();
function pose(g: Gait, name: string, a: number, y = 0, roll = 0) {
  const k = g.bones[name];
  if (!k) return;
  k.b.quaternion.copy(k.rest).multiply(qa.setFromAxisAngle(k.side, a)).multiply(qb.setFromAxisAngle(k.up, y));
  if (roll) k.b.quaternion.multiply(qc.setFromAxisAngle(k.fwd, roll));
}
const ease = (x: number) => x * x * (3 - 2 * x);

/** the hand-made gait: a trot that lengthens into a bound with speed, and a pose for each blow as it winds up */
/** eases a named value toward its target (rate: how quickly, per second): every pose change flows, nothing snaps */
function ease2(g: Gait, name: string, target: number, rate: number, dt: number) {
  const S = (g.s ??= {});
  const v = S[name] ?? target;
  return (S[name] = v + (target - v) * (1 - Math.exp(-rate * dt)));
}

export function walkByHand(g: Gait, f: Fighter, speed: number, dt: number, obj: THREE.Object3D, floor: number, h: number, look?: number) {
  // a giant ambles at a few metres a second: the legs step whenever it moves or turns on the spot
  const yawRate = Math.abs(((f.yaw - (g.yaw ?? f.yaw) + Math.PI * 3) % (Math.PI * 2)) - Math.PI) / Math.max(dt, 1e-3);
  g.yaw = f.yaw;
  g.turn = (g.turn ?? 0) + (Math.min(1, yawRate / 1.5) - (g.turn ?? 0)) * Math.min(1, dt * 5);
  const run = ease2(g, 'run', Math.min(1, speed / 7), 3, dt);
  const stepK = ease2(g, 'step', Math.min(1, Math.max(speed / 1.5, g.turn)), 4, dt);
  const mv = (f as any).giant?.move as { m: { id: string; wind: number }; t: number } | null;
  g.p += dt * (2.2 + speed * 0.45) * stepK;
  g.t = (g.t ?? 0) + dt;
  const p = g.p, t = g.t, amp = stepK * (0.32 + run * 0.42);
  // what each blow asks of the whole body (targets; everything below eases toward them)
  let paw = 0, crouch = 0, head = 0, headYaw = look ?? Math.sin(t * 0.45) * 0.3, tail = 0, twist = 0, pitch = 0, lunge = 0, fore = 0, hind = 0, jaw = 0;
  if (mv) {
    const w = mv.m.wind, k = ease(Math.min(1, mv.t / w)), hit = mv.t >= w, after = hit ? Math.max(0, 1 - (mv.t - w) * 1.4) : 1;
    const ALIAS: Record<string, string> = { jbite: 'bite', jtail: 'tail', spout: 'breath', whirl: 'howl', dive: 'pounce', rain: 'icicles', tide: 'frost' };
    switch (ALIAS[mv.m.id] ?? mv.m.id) {
      case 'howl': // rears up and howls at the sky
      case 'icicles':
        pitch = -0.45 * k * after;
        head = -0.95 * k * after;
        fore = -0.55 * k * after;
        headYaw = Math.sin(mv.t * 2) * 0.1;
        jaw = k * after;
        break;
      case 'breath': // head low and forward, the frost swept side to side
        head = 0.4 * k * after;
        crouch = 0.35 * k * after;
        pitch = 0.1 * k * after;
        headYaw = hit ? Math.sin((mv.t - w) * 4) * 0.4 * after : 0;
        jaw = (hit ? 1 : 0.4 * k) * after;
        break;
      case 'frost': // rears right up, both forepaws come down: the ground freezes
        pitch = (hit ? 0.12 : -0.58 * k) * after;
        fore = (hit ? 0.35 : -0.85 * k) * after;
        head = (hit ? 0.45 : -0.55 * k) * after;
        crouch = hit ? 0.3 * after : 0;
        headYaw = 0;
        break;
      case 'bite': // rises on its haunches, a forepaw high, rakes it down and snaps
        head = (hit ? 0.55 : -0.35 * k) * after;
        pitch = (hit ? 0.2 : -0.22 * k) * after;
        lunge = (hit ? 0.1 : -0.03 * k) * after;
        paw = (hit ? -0.2 : 1) * k * after;
        headYaw = hit ? 0 : -0.25 * k;
        jaw = hit ? after : 0;
        break;
      case 'tail': // spins round and lashes the tail
        tail = Math.sin(mv.t * 7) * 1.25 * after;
        twist = Math.sin(mv.t * 7) * 0.4 * after;
        crouch = 0.2 * k * after;
        break;
      case 'pounce': // gathers on its haunches, then flies with every leg stretched
      case 'chain':
        if (mv.t < w - (mv.m.id === 'pounce' || mv.m.id === 'dive' ? 0.7 : 0.55)) {
          crouch = 0.85 * k;
          pitch = 0.12 * k;
          head = 0.3 * k;
          tail = Math.sin(t * 9) * 0.3 * k; // the tail twitches as it gathers
        } else {
          pitch = -0.22 * after;
          fore = -0.95 * after;
          hind = 0.95 * after;
          lunge = 0.05 * after;
          jaw = after;
        }
        headYaw = 0;
        break;
    }
  } else if (stepK < 0.05) {
    // standing: weight shifts, a paw scrapes the snow now and then
    const c = t % 6.5;
    if (c < 1.3) paw = Math.sin((c / 1.3) * Math.PI) * 0.55;
    crouch += Math.sin(t * 0.7) * 0.06;
  }
  // everything eases toward its target: the body flows from pose to pose
  const R = 7;
  crouch = ease2(g, 'crouch', crouch, R, dt);
  head = ease2(g, 'head', head, R, dt);
  headYaw = ease2(g, 'headYaw', headYaw, 4, dt);
  tail = ease2(g, 'tail', tail, 10, dt);
  twist = ease2(g, 'twist', twist, 8, dt);
  pitch = ease2(g, 'pitch', pitch, 6, dt);
  lunge = ease2(g, 'lunge', lunge, 9, dt);
  fore = ease2(g, 'fore', fore, R, dt);
  hind = ease2(g, 'hind', hind, R, dt);
  paw = ease2(g, 'paw', paw, 9, dt);
  jaw = ease2(g, 'jaw', jaw, 10, dt);
  // the legs: diagonal pairs swing together, each joint lagging the one above it (follow-through), the paw curling
  const leg = (front: boolean, side: 'Left' | 'Right', ph: number) => {
    const n = (front ? '0_' : '1_') + side + '_Limb_';
    const sw = Math.sin(ph), lift = Math.max(0, Math.cos(ph)), lag = Math.max(0, Math.cos(ph - 0.6));
    let a0 = -sw * amp + (front ? fore : hind), a1 = (front ? 1 : -1) * lift * amp * 1.25;
    let a2 = (front ? -1 : 1) * lag * amp * 0.7;
    if (!front && crouch) {
      a0 -= crouch * 0.7;
      a1 += crouch * 1.0;
      a2 -= crouch * 0.5;
    }
    if (front && crouch) a1 += crouch * 0.35;
    if (front && side === 'Right' && paw) {
      a0 -= paw * 1.3;
      a1 += paw * 0.9;
      a2 += paw * 0.6;
    }
    pose(g, n + '0', a0);
    pose(g, n + '1', a1);
    pose(g, n + '2', a2);
    pose(g, n + '3', (front ? 0.3 : -0.3) * lift * amp);
  };
  const hl = 0.45 + run * 0.3; // hind legs a beat behind the fore in a lope
  leg(true, 'Left', p);
  leg(false, 'Right', p + hl);
  leg(true, 'Right', p + Math.PI);
  leg(false, 'Left', p + Math.PI + hl);
  // the spine: a wave running nose to tail as it moves, breath in the chest, the crouch and twist spread along it
  const breathe = Math.sin(t * 1.6) * 0.03;
  for (let i = 0; i < 4; i++) {
    const wave = Math.sin(p - i * 0.55) * 0.07 * run * stepK + Math.sin(t * 0.8 - i * 0.5) * 0.025;
    pose(g, 'Spine_' + i, (i === 1 ? breathe : -breathe * 0.4) - crouch * (0.08 - i * 0.02) + Math.sin(p * 2 - i * 0.7) * 0.035 * run, twist * (0.2 + i * 0.12) + wave, Math.sin(p - i * 0.4) * 0.03 * run);
  }
  // the neck and head: the look spread down the neck, steadied against the stride, the jaw dropping to bite or howl
  const hw = [0.32, 0.26, 0.22, 0.12, 0.08];
  for (let i = 0; i < 5; i++) {
    const steady = -Math.sin(p * 2 + 0.6 - i * 0.3) * 0.04 * run;
    pose(g, 'Head_' + i, head * hw[i] * 1.6 + steady + (i === 4 ? jaw * 0.5 : 0), headYaw * hw[i] * 1.8);
  }
  // the tail: a long lazy wave that follows the body round, livelier as it runs
  for (let i = 0; i < 3; i++) {
    const wv = Math.sin(t * 1.5 + p * 0.5 - i * 0.8) * (0.2 + i * 0.1) * (1 + run * 0.6);
    pose(g, 'Tail_' + i, 0.18 - run * 0.4 - Math.abs(pitch) * 0.4 + Math.sin(p * 2 - i) * 0.06 * run, wv + tail * (1 - i * 0.2));
  }
  // the whole body: up on its hind legs or down on its forelegs (turned about those feet), lunging, a roll with the
  // stride, rising and falling, sinking as it crouches. The head lies along the model's -x.
  const pivot = pitch < 0 ? 0.15 : -0.2;
  const sc = obj.scale.x;
  obj.rotation.z = pitch;
  obj.rotation.x = Math.sin(p) * 0.04 * run * stepK;
  const px = pivot * sc;
  const dx = px - px * Math.cos(pitch), dy = -px * Math.sin(pitch);
  obj.position.x = dx - lunge * sc;
  // the pounce's arc onto its mark
  let arc = 0;
  if (mv && (mv.m.id === 'pounce' || mv.m.id === 'dive') && mv.t < mv.m.wind && mv.t > mv.m.wind - 0.7) arc = Math.sin(((mv.t - (mv.m.wind - 0.7)) / 0.7) * Math.PI) * 0.45;
  obj.position.y = floor + dy + h * (Math.abs(Math.sin(p)) * 0.03 * run * stepK - crouch * 0.07 + arc);
}

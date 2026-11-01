// The old game's 天子 effects (dragon, guards) are not carried over; this keeps the effect system's hooks.
import type * as THREE from 'three';
export class EmperorFX {
  embers: (p: THREE.Vector3, n: number, c: THREE.ColorRepresentation) => void = () => {};
  clouds: (p: THREE.Vector3) => void = () => {};
  constructor(_root: THREE.Object3D) {}
  update(_dt: number, _time: number) {}
  dispose() {}
}

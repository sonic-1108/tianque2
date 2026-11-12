// 青石村's stockade and grounds: a ring of sharpened logs (寨墙) at WALL_R with a gate (寨门) on every road, and the
// village's buildings and yard things placed in the ring between the houses and the wall. Pure data: world.ts turns
// it into collision, render/Stockade.tsx draws the wall and gates, the Tripo models draw themselves as buildings.
import { ROAD_N, roadPoint } from './layout';

export const WALL_R = 64;
/** half the gap a gate leaves in the wall */
export const GATE_HALF = 4.6;
/** each road's bearing where it crosses the wall */
export const GATE_A: number[] = Array.from({ length: ROAD_N }, (_, k) => {
  const [x, z] = roadPoint(k, WALL_R);
  return Math.atan2(z, x);
});
const angDiff = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
/** is this bearing in a gate's opening (at the wall's radius) */
export const inGate = (a: number, pad = 0) => GATE_A.some((g) => angDiff(a, g) * WALL_R < GATE_HALF + pad);

/** the wall as straight runs between gates, for collision: [x0, z0, x1, z1] */
export const WALL_RUNS: [number, number, number, number][] = (() => {
  const out: [number, number, number, number][] = [];
  const N = 180;
  let start: number | null = null;
  for (let k = 0; k <= N; k++) {
    const a = (k / N) * Math.PI * 2;
    const open = inGate(a);
    if (!open && start === null) start = a;
    if ((open || k === N) && start !== null) {
      // chop the arc into chords a few metres long
      const end = open ? a - (Math.PI * 2) / N : a;
      const n = Math.max(1, Math.round(((end - start) * WALL_R) / 4));
      for (let j = 0; j < n; j++) {
        const a0 = start + ((end - start) * j) / n, a1 = start + ((end - start) * (j + 1)) / n;
        out.push([Math.cos(a0) * WALL_R, Math.sin(a0) * WALL_R, Math.cos(a1) * WALL_R, Math.sin(a1) * WALL_R]);
      }
      start = null;
    }
  }
  return out;
})();
/** each gate's two towers: [x, z] at either side of the road */
export const GATE_TOWERS: [number, number][][] = GATE_A.map((a) => {
  const t = (GATE_HALF + 1.3) / WALL_R;
  return [a - t, a + t].map((b) => [Math.cos(b) * WALL_R, Math.sin(b) * WALL_R] as [number, number]);
});

/** what stands in the village grounds (Tripo models, placed only once their file is in): file, bearing (deg), radius,
 *  size (longest side, m); every one faces the square */
export const VILLAGE_PROPS: [string, number, number, number][] = [
  ['v-granary.glb', 30, 34, 6.5],
  ['v-hay.glb', 18, 42, 3.2],
  ['v-hay.glb', 46, 43, 2.8],
  ['v-tower.glb', 32, 58, 6.5],
  ['v-shed.glb', 70, 33, 7],
  ['v-cart.glb', 94, 35, 4],
  ['v-hall.glb', 126, 36, 12],
  ['v-tower.glb', 126, 58, 6.5],
  ['v-stage.glb', 200, 35, 11],
  ['v-vats.glb', 165, 30, 2.6],
  ['v-house2.glb', 238, 33, 9.5],
  ['v-rack.glb', 222, 37, 3.6],
  ['v-rack.glb', 256, 38, 3.6],
  ['v-tower.glb', 240, 58, 6.5],
  ['v-coop.glb', 274, 32, 3.4],
  ['v-mill.glb', 300, 31, 3],
  ['v-wood.glb', 349, 30, 3.2],
  ['v-tower.glb', 330, 58, 6.5],
];

/** the empty house you can buy (jianghu.ts): a cottage between the houses and the wall, its door toward the square,
 *  drawn by render/Home.tsx; the room behind its door is interiors.ts's 'home' */
export const HOME_DEG = 330;
export const HOME_R = 38;
export const HOME_W = 7;
export const HOME_D = 5.6;
export const HOME: { x: number; z: number; rot: number; door: [number, number] } = (() => {
  const a = (HOME_DEG * Math.PI) / 180, x = Math.cos(a) * HOME_R, z = Math.sin(a) * HOME_R;
  const rot = Math.atan2(-x, -z); // its front (+z) to the square
  const k = HOME_D / 2 + 0.9;
  return { x, z, rot, door: [x + Math.sin(rot) * k, z + Math.cos(rot) * k] };
})();
/** where companions left at home stand: the yard before the door */
export const HOME_YARD: [number, number] = [HOME.x + Math.sin(HOME.rot) * (HOME_D / 2 + 4), HOME.z + Math.cos(HOME.rot) * (HOME_D / 2 + 4)];

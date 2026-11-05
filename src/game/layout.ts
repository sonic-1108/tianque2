// The big map's skeleton (no imports, so both the terrain and the dens can use it): seven roads run out of the
// village along valleys to the mountains at the rim; the dens sit just off the roads.
export const WORLD_R = 1000; // a 2 km map
export const VILLAGE_R = 30;
export const ROAD_N = 7;
export const ROAD_LEN = 920;
/** each road wanders a little (a gentle S-curve) so it doesn't look ruled */
export function roadAngle(k: number, r: number) {
  return (k / ROAD_N) * Math.PI * 2 + 0.05 + Math.sin(r * 0.006 + k * 1.7) * 0.12; // 0.05: no road runs down a river
}
export function roadPoint(k: number, r: number): [number, number] {
  const a = roadAngle(k, r);
  return [Math.cos(a) * r, Math.sin(a) * r];
}
/** a sampled polyline per road (for distance queries) */
export const ROADS: [number, number][][] = Array.from({ length: ROAD_N }, (_, k) => {
  const pts: [number, number][] = [];
  for (let r = 0; r <= ROAD_LEN; r += 20) pts.push(roadPoint(k, r));
  return pts;
});

/** 天阙: the old palace on a cliff-walled mesa at the far end of road 4 (north west, under the snow peaks). The story ends here. */
export const TQ_ROAD = 4;
export const TQ_R = 872;
export const TQ_Y = 64; // the mesa's top
export const TQ_TOP = 46; // flat top radius
export const TQ_POS: [number, number] = roadPoint(TQ_ROAD, TQ_R);
/** 天阙's own frame: local +z faces back down the road (the gate side) */
export const TQ_ROT = (() => {
  // the gate faces the way the road comes up
  const [x, z] = roadPoint(TQ_ROAD, TQ_R - 60);
  return Math.atan2(x - TQ_POS[0], z - TQ_POS[1]);
})();
export function tqWorld(lx: number, lz: number): [number, number] {
  const c = Math.cos(TQ_ROT), s = Math.sin(TQ_ROT);
  return [TQ_POS[0] + lx * c + lz * s, TQ_POS[1] - lx * s + lz * c];
}
export const nearTq = (x: number, z: number, r = 50) => Math.hypot(x - TQ_POS[0], z - TQ_POS[1]) < r;

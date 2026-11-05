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

/** a point on a road and its heading: (x, z), u = the way outward, rot = a frame whose local +z runs along u and
 *  local +x is (uz, -ux) (the same turn convention as the buildings) */
export function roadFrame(k: number, r: number) {
  const [x0, z0] = roadPoint(k, r - 1);
  const [x1, z1] = roadPoint(k, r + 1);
  const l = Math.hypot(x1 - x0, z1 - z0);
  const ux = (x1 - x0) / l, uz = (z1 - z0) / l;
  const [x, z] = roadPoint(k, r);
  return { x, z, ux, uz, rot: Math.atan2(ux, uz) };
}
/** 天阙古道: the ridge road's last climb, paved, lit by stone lanterns, a stone arch at its foot and a lookout terrace
 *  (望阙台) with a pavilion half way up */
export const GD_ARCH_R = 668; // the arch at the foot of the climb
export const GD_END_R = 828; // the paving runs to the mesa's rim
export const GD_PAV_R = 756;
export const GD_PAV_OFF = 12; // the terrace's centre, beside the road (local +x)
export const GD_PAV: [number, number] = (() => {
  const f = roadFrame(TQ_ROAD, GD_PAV_R);
  return [f.x + f.uz * GD_PAV_OFF, f.z - f.ux * GD_PAV_OFF];
})();
/** on the paved climb or its terrace (keeps rocks, grass and trees off it) */
export const onGudao = (x: number, z: number, pd: number) =>
  Math.hypot(x - GD_PAV[0], z - GD_PAV[1]) < 13 || (pd < 7.5 && Math.hypot(x - TQ_POS[0], z - TQ_POS[1]) < TQ_R - GD_ARCH_R + 12);

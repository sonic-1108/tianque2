// The big map's skeleton (no imports, so both the terrain and the dens can use it): seven roads run out of the
// village along valleys to the mountains at the rim; the dens sit just off the roads.
export const WORLD_R = 1000; // a 2 km map
export const VILLAGE_R = 30;
export const ROAD_N = 7;
export const ROAD_LEN = 920;
/** each road wanders a little (a gentle S-curve) so it doesn't look ruled */
export function roadAngle(k: number, r: number) {
  return (k / ROAD_N) * Math.PI * 2 + 0.25 + Math.sin(r * 0.006 + k * 1.7) * 0.12;
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

// Reads the owner's map (src/game/mapdata.ts, from tools/mapgen.py) at any world point. Image north is world -z,
// image west is world -x. No other game imports, so the dens and the terrain can both use it.
import { BIG, MAP_N, ROUGH, SNOW, WATER, WATER_N } from './mapdata';
import { WORLD_R } from './layout';

const decode = (s: string) => {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const big = decode(BIG);
const rough = decode(ROUGH);
const snow = decode(SNOW);
const waterBits = decode(WATER);
const water = new Uint8Array(WATER_N * WATER_N);
for (let i = 0; i < water.length; i++) water[i] = (waterBits[i >> 3] >> (7 - (i & 7))) & 1 ? 255 : 0;

function sample(a: Uint8Array, n: number, x: number, z: number) {
  const fx = Math.min(n - 1.001, Math.max(0, ((x + WORLD_R) / (WORLD_R * 2)) * n - 0.5));
  const fz = Math.min(n - 1.001, Math.max(0, ((z + WORLD_R) / (WORLD_R * 2)) * n - 0.5));
  const i = Math.floor(fx), j = Math.floor(fz);
  const u = fx - i, v = fz - j;
  const p = (ii: number, jj: number) => a[jj * n + ii];
  const A = p(i, j), B = p(i + 1, j), C = p(i, j + 1), D = p(i + 1, j + 1);
  return (A + (B - A) * u + (C - A) * v + (A - B - C + D) * u * v) / 255;
}
/** broad brightness of the owner's height picture, 0..1 */
export const mapBig = (x: number, z: number) => sample(big, MAP_N, x, z);
/** how rugged the ground is meant to be here, 0 (plain) .. 1 (mountains) */
export const mapRough = (x: number, z: number) => sample(rough, MAP_N, x, z);
/** painted snow, 0..1 */
export const mapSnow = (x: number, z: number) => sample(snow, MAP_N, x, z);
/** the painted rivers, 0..1 (1 = in the water) */
export const mapWater = (x: number, z: number) => sample(water, WATER_N, x, z);

// Tripo props placed on the map. Their sizes come from propdims.json (measured off the files by tools/propdims.mts),
// so collision always matches the model. Tripo's newer models face +x and sit centred on their origin; the older
// ones (house.glb, paifang.glb, pavilion.glb) face +z with their feet at 0. `fit` hides the difference: give it the
// size you want (the longest side, in metres) and it says how to scale, turn and lift the model, and the footprint
// (in the placement's own frame, +z = its front). Pure data, no three.js.
import DIMS from './propdims.json';
import { DENS, DEN_R } from './foes';
import { roadFrame } from './layout';

type Dim = { min: number[]; max: number[] };
const D = DIMS as Record<string, Dim>;
/** Tripo v3 models: centred, facing +x */
export const isNewTripo = (file: string) => (D[file]?.min[1] ?? 0) < -0.05;

export function fit(file: string, size: number) {
  const d = D[file];
  if (!d) return { scale: size, hx: size / 2, hz: size / 2, h: size, turn: 0, lift: 0 };
  const ex = d.max[0] - d.min[0], ey = d.max[1] - d.min[1], ez = d.max[2] - d.min[2];
  const scale = size / Math.max(ex, ez);
  const t = isNewTripo(file);
  return {
    scale,
    // turned a quarter round so the model's front (+x) becomes the placement's front (+z)
    hx: ((t ? ez : ex) * scale) / 2,
    hz: ((t ? ex : ez) * scale) / 2,
    h: ey * scale,
    turn: t ? -Math.PI / 2 : 0,
    lift: t ? -d.min[1] * scale - 0.12 : -0.25,
  };
}
/** a point measured on the model (its own x, z, in model units) in the placement's frame */
export function modelPoint(file: string, mx: number, mz: number, scale: number): [number, number] {
  return isNewTripo(file) ? [-mz * scale, mx * scale] : [mx * scale, mz * scale];
}

/** things that stand on the map only to be seen (no collision): bandit tents and watchtowers in every den */
export interface Decor {
  file: string;
  x: number;
  z: number;
  rot: number;
  size: number;
}
const rnd = (a: number, b = 0) => {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
export const DECOR: Decor[] = (() => {
  const out: Decor[] = [];
  DENS.forEach((d, i) => {
    if (d.peak) return;
    const g0 = rnd(i, 3) * 6.28; // the gate bearing World's palisade uses
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + i;
      out.push({ file: 'bandit-tent.glb', x: d.x + Math.cos(a) * 9.5, z: d.z + Math.sin(a) * 9.5, rot: Math.atan2(-Math.cos(a), -Math.sin(a)), size: 5 });
    }
    const a = g0 + Math.PI / 2, R = DEN_R + 0.5;
    out.push({ file: 'watchtower.glb', x: d.x + Math.cos(a) * (R - 2.6), z: d.z + Math.sin(a) * (R - 2.6), rot: Math.atan2(-Math.cos(a), -Math.sin(a)), size: d.boss ? 9 : 7.5 });
  });
  return out;
})();

/** 青石集: the market street on the east road out of the village, stalls on both sides, the teahouse at its end */
export interface Stall {
  file: string;
  name: string;
  x: number;
  z: number;
  rot: number;
  size: number;
}
export const MARKET_ROAD = 0;
export const MARKET_FROM = 46, MARKET_TO = 134;
const STALL_FILES = ['stall-fruit.glb', 'stall-pottery.glb', 'stall-silk.glb', 'stall-lantern.glb', 'stall-medicine.glb', 'stall-noodle.glb', 'stall-tanghulu.glb', 'stall-birds.glb', 'stall-weapons.glb', 'stall-books.glb'];
const STALL_NAMES: Record<string, string> = {
  'stall-fruit.glb': '菜果摊', 'stall-pottery.glb': '陶器摊', 'stall-silk.glb': '绸缎摊', 'stall-lantern.glb': '灯笼铺', 'stall-medicine.glb': '草药摊',
  'stall-noodle.glb': '面摊', 'stall-tanghulu.glb': '糖葫芦', 'stall-birds.glb': '鸟市', 'stall-weapons.glb': '兵器摊', 'stall-books.glb': '书摊',
};
/** stalls whose model is in (the list grows as Tripo's models come back) */
export const STALLS: Stall[] = (() => {
  const have = STALL_FILES.filter((f) => D[f]);
  const out: Stall[] = [];
  let k = 0;
  for (let r = MARKET_FROM; r <= MARKET_TO - 8 && have.length; r += 8.5, k++) {
    const side = k % 2 ? 1 : -1;
    const f = roadFrame(MARKET_ROAD, r);
    const off = 7.2;
    // +x of the frame is (uz, -ux): the stall stands beside the road and faces it
    const x = f.x + side * f.uz * off, z = f.z - side * f.ux * off;
    const file = have[k % have.length];
    out.push({ file, name: STALL_NAMES[file], x, z, rot: Math.atan2(f.x - x, f.z - z), size: 4.6 });
  }
  return out;
})();
export const TEAHOUSE = (() => {
  const f = roadFrame(MARKET_ROAD, MARKET_TO + 4);
  const x = f.x + f.uz * 15, z = f.z - f.ux * 15;
  return { file: 'teahouse.glb', x, z, rot: Math.atan2(f.x - x, f.z - z), size: 13 };
})();
/** a watermill on the river nearest the village (worked out by world.ts, which knows where the water is) */
export const MILL_FILE = 'waterwheel.glb';

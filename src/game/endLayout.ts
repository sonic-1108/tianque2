// Where the things that open after 伪帝 falls stand (a leaf module: world.ts takes their solid parts, interiors.ts
// their doors, render/Endgame.tsx draws them). Beside 天阙's road just outside the village, on the flat land below
// its pad: 巨灵碑 (the stele of giants: 巨人挑战, 二周目) and the seven-storey 天阙试炼塔 (its floors are a room off the
// map). 天魔窟, the sequel's cave, opens in the mesa of 天阙 behind its hall.
import { roadFrame, TQ_ROAD, TQ_POS } from './layout';

const beside = (r: number, side: number) => {
  const f = roadFrame(TQ_ROAD, r);
  // (uz, -ux) is the road's right hand
  return { x: f.x + f.uz * side, z: f.z - f.ux * side, ux: f.ux, uz: f.uz };
};
/** the pagoda: footprint half size, height, the door on the side facing the road */
export const TOWER = (() => {
  const p = beside(104, 21);
  const fx = -p.uz, fz = p.ux; // toward the road
  const half = 5.2;
  return {
    x: p.x,
    z: p.z,
    half,
    h: 24,
    rot: Math.atan2(fx, fz), // model +z toward the road
    door: [p.x + fx * (half + 1.6), p.z + fz * (half + 1.6)] as [number, number],
    /** the way out of the door, as rooms keep it: (sin, cos) of it points out, toward the road */
    doorYaw: Math.atan2(fx, fz),
  };
})();

/** 巨灵碑: a tall stone tablet by the road, carved with the giants you have beaten */
export const STELE = (() => {
  const p = beside(86, 12);
  return { x: p.x, z: p.z, rot: Math.atan2(-p.uz, p.ux) };
})();

/** 天魔窟: a cleft opening in the mesa behind 天阙's hall (the sequel), and where you stand to go down */
export const ABYSS = (() => {
  // a clear flat corner of the mesa behind and left of the hall (checked against 天阙's walls and buildings)
  const a = (300 * Math.PI) / 180, ux = Math.cos(a), uz = Math.sin(a);
  const x = TQ_POS[0] + ux * 32, z = TQ_POS[1] + uz * 32;
  // the way out (sin, cos of doorYaw) leads back toward the hall
  return { x, z, rot: Math.atan2(-ux, -uz), door: [x - ux * 3.2, z - uz * 3.2] as [number, number], doorYaw: Math.atan2(-ux, -uz) };
})();

/** the rooms these open into (interiors.ts places them on their own grid, far from the houses') */
export const END_ROOMS_AT = { trial: [6200, 6200] as [number, number], abyss: [6300, 6200] as [number, number] };

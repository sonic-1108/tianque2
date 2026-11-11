// 永安城 · 朝廷: the court of the 承乾 reign, far out at the end of the first road (north east). A walled palace
// on a levelled plain: the great gate, an avenue of banners to the throne hall 金銮殿 (whose throne stands empty:
// the false emperor sits on 天阙), the drum tower and the six ministries either side, and outside the gate a little
// street of houses and stalls. Pure data in the court's own frame (local +z faces back down the road, the gate side);
// world.ts turns the pieces into buildings, render/Court.tsx draws the paving, places.ts adds the people.
import { roadPoint } from './layout';
import { fit, modelPoint } from './props';

export const CT_ROAD = 1;
export const CT_R = 835;
export const CT_POS: [number, number] = roadPoint(CT_ROAD, CT_R);
export const CT_ROT = (() => {
  const [x, z] = roadPoint(CT_ROAD, CT_R - 60);
  return Math.atan2(x - CT_POS[0], z - CT_POS[1]);
})();
/** the plain the palace stands on: flat to CT_PAD, easing back into the land by CT_PAD + 40 */
export const CT_PAD = 125;
export const CT_Y = 3;
export function ctWorld(lx: number, lz: number): [number, number] {
  const c = Math.cos(CT_ROT), s = Math.sin(CT_ROT);
  return [CT_POS[0] + lx * c + lz * s, CT_POS[1] - lx * s + lz * c];
}
export const nearCourt = (x: number, z: number, r = CT_PAD) => Math.hypot(x - CT_POS[0], z - CT_POS[1]) < r;

/** a model in the court: local place, local turn (0 faces +z), size (its longest side) */
export interface CourtPiece {
  file: string;
  lx: number;
  lz: number;
  rot: number;
  size: number;
  /** only these block (an open thing: the gate's arches, a banner pole), local to the piece, in metres */
  posts?: [number, number, number][];
}
export const WALL_X = 58, WALL_FRONT = 52, WALL_BACK = -84, GATE_W = 30;
export const HALL = { lz: -52, size: 50 };

export const COURT_PIECES: CourtPiece[] = (() => {
  const out: CourtPiece[] = [];
  // the wall, in segments a little longer than their share so the joins overlap
  const run = (x0: number, z0: number, x1: number, z1: number) => {
    const L = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.ceil(L / 15));
    const rot = Math.atan2(x1 - x0, z1 - z0); // segments lie along their own local z
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      out.push({ file: 'court-wall.glb', lx: x0 + (x1 - x0) * t, lz: z0 + (z1 - z0) * t, rot, size: L / n + 0.8 });
    }
  };
  run(-WALL_X, WALL_FRONT, -GATE_W / 2, WALL_FRONT);
  run(GATE_W / 2, WALL_FRONT, WALL_X, WALL_FRONT);
  run(-WALL_X, WALL_FRONT, -WALL_X, WALL_BACK);
  run(WALL_X, WALL_FRONT, WALL_X, WALL_BACK);
  run(-WALL_X, WALL_BACK, WALL_X, WALL_BACK);
  // the great gate: its three arches open; only the piers between them block
  {
    const g = fit('court-gate.glb', GATE_W);
    // each pier runs the gate's whole depth (the model's x): a row of posts along it
    const posts: [number, number, number][] = [];
    for (const [mz, r] of [[-0.45, 0.055], [-0.17, 0.05], [0.17, 0.05], [0.45, 0.055]] as const)
      for (let mx = -0.42; mx <= 0.421; mx += 0.07) posts.push([...modelPoint('court-gate.glb', mx, mz, g.scale), r * g.scale] as [number, number, number]);
    out.push({ file: 'court-gate.glb', lx: 0, lz: WALL_FRONT, rot: 0, size: GATE_W, posts });
  }
  out.push({ file: 'court-hall.glb', lx: 0, lz: HALL.lz, rot: 0, size: HALL.size });
  out.push({ file: 'court-tower.glb', lx: -36, lz: 18, rot: Math.PI / 2, size: 19 });
  out.push({ file: 'court-yamen.glb', lx: 37, lz: 18, rot: -Math.PI / 2, size: 22 });
  // lions at the gate, outside and in, and before the hall
  for (const s of [-1, 1]) {
    out.push({ file: 'court-lion.glb', lx: s * 6.4, lz: WALL_FRONT + 20, rot: 0, size: 3.2 });
    out.push({ file: 'court-lion.glb', lx: s * 9, lz: HALL.lz + 31, rot: 0, size: 3 });
  }
  out.push({ file: 'court-incense.glb', lx: 0, lz: -12, rot: 0, size: 3.6 });
  // banners down the avenue
  for (const lz of [40, 26, 12, -2]) for (const s of [-1, 1]) out.push({ file: 'court-banner.glb', lx: s * 9, lz, rot: 0, size: 2.4, posts: [[0, 0, 0.3]] });
  out.push({ file: 'court-sedan.glb', lx: 18, lz: 34, rot: -0.4, size: 3.2 });
  // 关厢: the street outside the gate
  out.push({ file: 'house-a.glb', lx: -24, lz: 84, rot: Math.PI / 2, size: 10 });
  out.push({ file: 'house-b.glb', lx: 24, lz: 96, rot: -Math.PI / 2, size: 9 });
  out.push({ file: 'house-b.glb', lx: -24, lz: 104, rot: Math.PI / 2, size: 9 });
  out.push({ file: 'stall-tanghulu.glb', lx: 12, lz: 122, rot: -Math.PI / 2, size: 4.2 });
  out.push({ file: 'stall-lantern.glb', lx: -12, lz: 118, rot: Math.PI / 2, size: 4.4 });
  out.push({ file: 'stall-books.glb', lx: 13, lz: 110, rot: -Math.PI / 2, size: 4.4 });
  return out;
})();
/** the throne hall's door (its front, at the top of the terrace stairs' foot), and which way it faces */
export const HALL_DOOR = (() => {
  const g = fit('court-hall.glb', HALL.size);
  return { lx: 0, lz: HALL.lz + g.hz + 0.8 };
})();

/** notice boards (委托): the village square and outside the palace gate */
export const BOARDS: [number, number][] = [[-7, 4], ctWorld(-21, 70)];
/** the drum tower's drum (outside its front) */
export const DRUM = ctWorld(-25.5, 18);

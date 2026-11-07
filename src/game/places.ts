// Places that aren't dens: the village's workshops beyond the fence (smithy, tavern, shrine) and a waystation (驿站)
// on every road, an inn with two houses round a yard. Their ground is levelled (world.ts rawHeight), their walls
// block (BUILDINGS), and the folk who live there (FOLK) stand about or stroll, talk, and the innkeepers patch you up.
// Pure data: no imports from world.ts (it imports this).
import { DENS, DEN_R } from './foes';
import { ROADS, ROAD_N, roadFrame, TQ_POS, TQ_ROAD } from './layout';
import { mapWater } from './mapsample';

export type PlaceKind = 'smithy' | 'tavern' | 'shrine' | 'inn' | 'jianzhong' | 'tomb';
/** the village's own workshops (their yards sit at the village's level) */
export const IN_TOWN = (k: PlaceKind) => k === 'smithy' || k === 'tavern' || k === 'shrine';
export interface Place {
  kind: PlaceKind;
  name: string;
  x: number;
  z: number;
  rot: number; // the front (local +z) faces this way
  pad: number; // levelled radius
  road?: number;
}
/** what blocks at each place, in its own frame (local +z = its front): boxes (centre, half sizes, height; a top
 *  within a step of your feet you walk onto) and open posts. Matches the shapes render/Places.tsx draws. */
export interface PlacePart {
  x: number;
  z: number;
  hx: number;
  hz: number;
  h: number;
  ry?: number;
  posts?: [number, number, number][];
}
const posts = (x: number, z: number, h: number, pts: [number, number, number][]): PlacePart => ({ x, z, hx: 12, hz: 12, h, posts: pts });
export const PLACE_PARTS: Record<PlaceKind, PlacePart[]> = {
  // an open shed: the back wall, a half wall, the hearth, the anvil, the trough, six posts
  smithy: [
    { x: 0, z: -3.3, hx: 4.2, hz: 0.35, h: 3.2 },
    { x: -4, z: -1.3, hx: 0.3, hz: 2, h: 1.4 },
    { x: -2, z: -2.1, hx: 1.2, hz: 0.8, h: 1.0 },
    { x: 1.2, z: 0.4, hx: 0.45, hz: 0.45, h: 1.0 },
    { x: 3, z: -1.4, hx: 0.4, hz: 1.1, h: 0.7 },
    posts(0, 0, 4, [[-4, -3.2, 0.25], [0, -3.2, 0.25], [4, -3.2, 0.25], [-4, 3.2, 0.25], [0, 3.2, 0.25], [4, 3.2, 0.25]]),
  ],
  // two storeys, red columns along the front, tables and wine jars in the yard
  tavern: [
    { x: 0, z: -0.4, hx: 5.5, hz: 3.7, h: 9.5 },
    posts(0, 4.2, 3.6, [[-5.3, 0, 0.3], [-1.8, 0, 0.3], [1.8, 0, 0.3], [5.3, 0, 0.3]]),
    { x: -3.5, z: 7.5, hx: 0.8, hz: 0.5, h: 0.82 },
    { x: 3.2, z: 8.2, hx: 0.8, hz: 0.5, h: 0.82 },
    { x: -5.6, z: 5.85, hx: 1.1, hz: 0.7, h: 1.1 },
  ],
  // on a low stone base you step up onto: three walls round the god, columns at the front, the burner, lanterns, stele
  shrine: [
    { x: 0, z: 0, hx: 3, hz: 2.8, h: 0.55 },
    { x: 0, z: -1.2, hx: 2.2, hz: 0.9, h: 3.55 },
    { x: -2.1, z: 0.2, hx: 0.1, hz: 1.9, h: 3.55 },
    { x: 2.1, z: 0.2, hx: 0.1, hz: 1.9, h: 3.55 },
    { x: 0, z: 0.6, hx: 1, hz: 0.4, h: 1.45 },
    posts(0, 2, 3.5, [[-2.2, 0, 0.25], [2.2, 0, 0.25]]),
    { x: 0, z: 4.6, hx: 0.55, hz: 0.55, h: 0.7 },
    { x: -3.4, z: 4.4, hx: 0.45, hz: 0.45, h: 2.3 },
    { x: 3.4, z: 4.4, hx: 0.45, hz: 0.45, h: 2.3 },
    { x: 4.4, z: -1, hx: 0.7, hz: 0.5, h: 3.1 },
  ],
  // the inn and its porch, the stable's posts and hay, the woodpile, the well
  inn: [
    { x: 0, z: -0.8, hx: 6, hz: 3.7, h: 7 },
    posts(0, 4.6, 3, [[-5.6, 0, 0.22], [-1.9, 0, 0.22], [1.9, 0, 0.22], [5.6, 0, 0.22]]),
    { x: -3.2, z: 3.8, hx: 0.8, hz: 0.5, h: 0.82 },
    { x: 2.6, z: 3.8, hx: 0.8, hz: 0.5, h: 0.82 },
    posts(-9.2, 0, 2.6, [[0, -3.6, 0.2], [0, 0, 0.2], [0, 3.6, 0.2]]),
    { x: -8.4, z: -2.2, hx: 0.95, hz: 0.95, h: 1 },
    { x: 8, z: -2, hx: 0.6, hz: 0.7, h: 0.65 },
    { x: 5.5, z: 8.5, hx: 0.85, hz: 0.85, h: 0.9 },
  ],
  // the split stele, the marker, the dead tree and the cairns (the swords you walk among)
  jianzhong: [
    { x: 0, z: 0, hx: 1.2, hz: 0.8, h: 2.8 },
    { x: 0, z: 15, hx: 0.7, hz: 0.45, h: 2.8 },
    posts(0, 0, 3, [
      [-6, -7, 0.4],
      ...Array.from({ length: 6 }, (_, c) => {
        const a = c * 1.05 + 0.3, r = 8 + (c % 2) * 5;
        return [Math.cos(a) * r, Math.sin(a) * r, 0.6] as [number, number, number];
      }),
    ]),
  ],
  // the mound, the stone, the offering table, two pines, the low curved wall behind
  tomb: [
    { x: 0, z: 0, hx: 2.6, hz: 3, h: 1.9 },
    { x: 0, z: 4, hx: 0.95, hz: 0.4, h: 2.85 },
    { x: 0, z: 5.4, hx: 0.8, hz: 0.45, h: 0.75 },
    posts(0, 0, 4, [[-4.6, -2.5, 0.3], [4.6, -2.5, 0.3]]),
    ...Array.from({ length: 9 }, (_, k) => {
      const a = Math.PI + 0.25 + (k / 8) * (Math.PI - 0.5);
      return { x: Math.cos(a) * 6, z: Math.sin(a) * 6, hx: 1.1, hz: 0.23, h: 1.5, ry: Math.PI / 2 - a };
    }),
  ],
};

const sectorMid = (k: number) => {
  const a0 = Math.atan2(ROADS[k][2][1], ROADS[k][2][0]);
  let a1 = Math.atan2(ROADS[(k + 1) % ROADS.length][2][1], ROADS[(k + 1) % ROADS.length][2][0]);
  if (a1 < a0) a1 += Math.PI * 2;
  return (a0 + a1) / 2;
};
const INN_NAMES = ['歇马驿', '望山茶棚', '柳溪驿', '石桥驿', '风口茶棚', '松涛驿', '芦花驿'];

export const PLACES: Place[] = (() => {
  const out: Place[] = [];
  // the village's workshops, in the gaps between roads that have no fields (the fields are in the even gaps)
  ([[1, 'smithy', '张记铁铺'], [3, 'tavern', '杏花酒肆'], [5, 'shrine', '土地庙']] as const).forEach(([k, kind, name]) => {
    const a = sectorMid(k);
    const r = kind === 'shrine' ? 46 : 50;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    out.push({ kind, name, x, z, rot: Math.atan2(-x, -z), pad: 12 });
  });
  // a waystation on every road, on the side away from the pavilion, where the ground is dry and no den is near
  for (let k = 0; k < ROAD_N; k++)
    for (const r of [470, 440, 500, 410, 530]) {
      const f = roadFrame(k, r);
      const x = f.x + f.uz * 22, z = f.z - f.ux * 22;
      const dry = [0, 1, 2, 3, 4].every((i) => mapWater(x + Math.cos(i * 1.3) * 14 * (i ? 1 : 0), z + Math.sin(i * 1.3) * 14 * (i ? 1 : 0)) < 0.02);
      if (!dry || DENS.some((d) => Math.hypot(d.x - x, d.z - z) < DEN_R + 30) || Math.hypot(x - TQ_POS[0], z - TQ_POS[1]) < 300) continue;
      // the inn's front faces the road
      out.push({ kind: 'inn', name: INN_NAMES[k], x, z, rot: Math.atan2(f.x - x, f.z - z), pad: 18, road: k });
      break;
    }
  // 断剑冢: the old battlefield of the night 天阙 fell, beside the third road at the foot of the valley's wall
  {
    // beside the third road, out in the middle ring (the roads run through the valleys, the open ground is mountain)
    for (const [k, r] of [[2, 360], [2, 340], [2, 380], [3, 360], [3, 340], [2, 320], [3, 380]] as const) {
      const f = roadFrame(k, r);
      const x = f.x - f.uz * 24, z = f.z + f.ux * 24;
      const dry = [0, 1, 2, 3, 4, 5].every((i) => mapWater(x + Math.cos(i * 1.05) * 18 * (i ? 1 : 0), z + Math.sin(i * 1.05) * 18 * (i ? 1 : 0)) < 0.01);
      if (!dry || DENS.some((d) => Math.hypot(d.x - x, d.z - z) < DEN_R + 35)) continue;
      out.push({ kind: 'jianzhong', name: '断剑冢', x, z, rot: Math.atan2(f.x - x, f.z - z), pad: 16, road: k });
      break;
    }
  }
  // 守阙人之墓: below 天阙, beside the road at the foot of the last climb (the side away from 望阙台)
  {
    const f = roadFrame(TQ_ROAD, 636);
    const x = f.x - f.uz * 24, z = f.z + f.ux * 24;
    out.push({ kind: 'tomb', name: '守阙人之墓', x, z, rot: Math.atan2(f.x - x, f.z - z), pad: 11 });
  }
  return out;
})();
export const placeOf = (kind: PlaceKind) => PLACES.find((p) => p.kind === kind)!;

/** a point in a place's frame to the world (local +z = its front) */
export function placeAt(p: Place, lx: number, lz: number): [number, number] {
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  return [p.x + lx * c + lz * s, p.z - lx * s + lz * c];
}
/** the two houses of a waystation, beside the inn, turned to the yard */
export function innHouses(p: Place) {
  return [-1, 1].map((s) => {
    const [x, z] = placeAt(p, s * 11.5, -5);
    return { x, z, rot: p.rot - s * 0.9 };
  });
}
export const nearPlace = (x: number, z: number, extra = 0) => PLACES.some((p) => Math.abs(p.x - x) < p.pad + extra && Math.abs(p.z - z) < p.pad + extra && Math.hypot(p.x - x, p.z - z) < p.pad + extra);

/** the folk: not fighters, can't be hurt. `walk` (m) lets one stroll round his spot; `heal` offers a rest */
export interface Folk {
  name: string;
  model: string;
  x: number;
  z: number;
  walk?: number;
  heal?: string;
  lines: string[];
}
const RING_TALK = [
  '往外走二里地就是黑风寨的人了，夜里别赶路。',
  '再往外是七家的旧地，那些人的招式邪门得很。',
  '最外头靠着雪线，听说连官兵都不敢去。',
];
export const FOLK: Folk[] = (() => {
  const out: Folk[] = [];
  const by = (kind: PlaceKind) => PLACES.find((p) => p.kind === kind)!;
  {
    const p = by('smithy');
    const [x, z] = placeAt(p, 0, 5);
    out.push({ name: '铁匠 · 张大锤', model: 'berserker.glb', x, z, lines: ['刀钝了？拿来我给你磨。不要钱，帮我把山上那帮抢铁料的打跑就行。', '天阙的人用的剑，都是我师父的师父打的。现在没人会了。', '打铁跟练武一样，火候到了，一锤就成。'] });
  }
  {
    const p = by('tavern');
    const [x, z] = placeAt(p, 2, 5.5);
    out.push({ name: '酒肆掌柜 · 杏娘', model: 'ranger.glb', x, z, heal: '喝碗热酒歇歇（回满生命和内力）', lines: ['客官来碗酒？今年的杏花酿，劲大。', '前些日子来了个戴面具的，一句话不说，喝完就往北走了。', '石伯年轻时酒量可好了，现在一碗就倒。'] });
    const [x2, z2] = placeAt(p, -4, 7);
    out.push({ name: '酒客', model: 'wanderer_m.glb', x: x2, z: z2, walk: 4, lines: ['嗝……别看我，我就是个过路的。', '听说天阙上的钟，二十年没响过了。', '我年轻时也想当大侠，后来发现酒比剑好使。'] });
  }
  {
    const p = by('shrine');
    const [x, z] = placeAt(p, 2.5, 4);
    out.push({ name: '庙祝 · 慧觉', model: 'monk.glb', x, z, lines: ['土地爷保佑青石村，也保佑你。', '香火钱随缘。你身上的杀气，倒是比香火重。', '这庙比村子还老。墙上那块碑，写的是天阙七家的名字，后来被人凿掉了。'] });
  }
  // round the square
  out.push({ name: '货郎', model: 'wanderer_m.glb', x: 5, z: 10, walk: 9, lines: ['针头线脑、胭脂水粉，要啥有啥！', '山贼把路堵了，我的货都运不出去。', '外地人？我走南闯北，没见过你这样的眼神。'] });
  out.push({ name: '樵夫 · 老周', model: 'wanderer_m.glb', x: -12, z: -10, walk: 7, lines: ['林子里的狼少了，人倒是多了。', '往西北走，山越来越陡，路只剩一条。', '砍了四十年柴，没见过天阙的门开过。'] });
  out.push({ name: '村妇 · 秀兰', model: 'ranger.glb', x: 13, z: -12, walk: 6, lines: ['孩子他爹被抓去寨子里干活，到现在没回来。', '谢谢你帮村里出头。', '石伯捡到你那天，雪下了三尺厚。'] });
  out.push({ name: '更夫', model: 'dixian.glb', x: -4, z: 13, walk: 10, lines: ['天干物燥，小心火烛。', '半夜我常听见北边有钟声，可天阙早没人了啊。', '咚，咚……习惯了，白天也想敲。'] });
  // a keeper at every waystation, and a traveller resting there
  for (const p of PLACES) {
    if (p.kind !== 'inn') continue;
    const [x, z] = placeAt(p, -2, 6.5);
    const k = p.road!;
    out.push({ name: `${p.name}伙计`, model: k % 2 ? 'trader.glb' : 'wanderer_m.glb', x, z, heal: '歇歇脚（回满生命和内力）', lines: [`这里是${p.name}，往村里走还有好一段路，歇歇再走吧。`, RING_TALK[k % 3], '茶水管够，就是没有好菜。'] });
    const [x2, z2] = placeAt(p, 5, 8);
    out.push({ name: '赶路人', model: ['monk.glb', 'ranger.glb', 'wanderer_m.glb'][k % 3], x: x2, z: z2, walk: 5, lines: ['我从外头来，路上的贼一伙比一伙凶。', '你也是要去天阙？那条古道上的灯，听说是自己亮的。', '歇够了，我得在天黑前赶到下一处驿站。'] });
  }
  return out;
})();

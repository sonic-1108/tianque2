// Places that aren't dens: the village's workshops beyond the fence (smithy, tavern, shrine) and a waystation (驿站)
// on every road, an inn with two houses round a yard. Their ground is levelled (world.ts rawHeight), their walls
// block (BUILDINGS), and the folk who live there (FOLK) stand about or stroll, talk, and the innkeepers patch you up.
// Pure data: no imports from world.ts (it imports this).
import { DENS, DEN_R } from './foes';
import { ROADS, ROAD_N, roadFrame, roadPoint, TQ_POS, TQ_ROAD } from './layout';
import { mapWater } from './mapsample';
import { STALLS, MARKET_ROAD, MARKET_FROM, MARKET_TO, fit } from './props';
import { ctWorld, WALL_FRONT } from './court';
import type { LifeKind } from './life';

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
    const [x, z] = placeAt(p, s * 14.5, -6.5);
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
  /** called out to whoever passes (a slip over the head): a crier's wares, a song */
  cry?: string[];
  /** keeps their own hours (life.ts): where they are depends on the time, the weather and the festival */
  life?: LifeKind;
  /** a traveller's two ends of road (life 'road') */
  route?: [number, number][];
  /** only there once the village has grown this far (jianghu.ts VLEVELS) */
  vlvl?: number;
}
const RING_TALK = [
  '往外走二里地就是黑风寨的人了，夜里别赶路。',
  '再往外是七家的旧地，那些人的招式邪门得很。',
  '最外头靠着雪线，听说连官兵都不敢去。',
];
/** the old fisherman's spot: the second nearest bank to the village (the nearest has the watermill), dry ground just
 *  short of the water, with the bearing toward it; world.ts beaches his boat beside him */
export const FISH_SPOT: [number, number, number] | null = (() => {
  const hits: [number, number][] = [];
  for (let k = 0; k < 120; k++) {
    const a = (k / 120) * Math.PI * 2;
    for (let r = 60; r < 260; r += 3) {
      if (mapWater(Math.cos(a) * r, Math.sin(a) * r) > 0.5) {
        hits.push([a, r]);
        break;
      }
    }
  }
  hits.sort((p, q) => p[1] - q[1]);
  const first = hits[0];
  const pick = hits.find((h) => first && Math.abs(Math.atan2(Math.sin(h[0] - first[0]), Math.cos(h[0] - first[0]))) > 0.35);
  if (!pick) return null;
  const [a, r] = pick;
  for (let k = 3; k < 30; k++) {
    const x = Math.cos(a) * (r - k), z = Math.sin(a) * (r - k);
    if (mapWater(x, z) < 0.02) return [x, z, a];
  }
  return null;
})();
export const FOLK: Folk[] = (() => {
  const out: Folk[] = [];
  const by = (kind: PlaceKind) => PLACES.find((p) => p.kind === kind)!;
  {
    const p = by('smithy');
    const [x, z] = placeAt(p, 0, 5);
    out.push({ name: '铁匠 · 张大锤', model: 'npc-smith.glb', x, z, lines: ['刀钝了？拿来我给你磨。不要钱，帮我把山上那帮抢铁料的打跑就行。', '天阙的人用的剑，都是我师父的师父打的。现在没人会了。', '打铁跟练武一样，火候到了，一锤就成。'] });
  }
  {
    const p = by('tavern');
    const [x, z] = placeAt(p, 2, 5.5);
    out.push({ name: '酒肆掌柜 · 杏娘', model: 'npc-tavern.glb', x, z, heal: '喝碗热酒歇歇（回满生命和内力）', lines: ['客官来碗酒？今年的杏花酿，劲大。', '前些日子来了个戴面具的，一句话不说，喝完就往北走了。', '石伯年轻时酒量可好了，现在一碗就倒。'] });
    const [x2, z2] = placeAt(p, -4, 7);
    out.push({ name: '酒客', model: 'npc-beggar.glb', x: x2, z: z2, walk: 4, lines: ['嗝……别看我，我就是个过路的。', '听说天阙上的钟，二十年没响过了。', '我年轻时也想当大侠，后来发现酒比剑好使。'] });
  }
  {
    const p = by('shrine');
    const [x, z] = placeAt(p, 2.5, 4);
    out.push({ name: '庙祝 · 慧觉', model: 'npc-monk.glb', x, z, lines: ['土地爷保佑青石村，也保佑你。', '香火钱随缘。你身上的杀气，倒是比香火重。', '这庙比村子还老。墙上那块碑，写的是天阙七家的名字，后来被人凿掉了。'] });
  }
  // round the square
  out.push({ name: '货郎', model: 'npc-peddler.glb', x: 5, z: 10, walk: 9, life: 'stroll', cry: ['针头线脑，胭脂水粉！', '拨浪鼓响，货郎来啦！'], lines: ['针头线脑、胭脂水粉，要啥有啥！', '山贼把路堵了，我的货都运不出去。', '外地人？我走南闯北，没见过你这样的眼神。'] });
  out.push({ name: '樵夫 · 老周', model: 'npc-farmer.glb', x: -12, z: -10, walk: 7, life: 'woodcutter', lines: ['林子里的狼少了，人倒是多了。', '往西北走，山越来越陡，路只剩一条。', '砍了四十年柴，没见过天阙的门开过。'] });
  out.push({ name: '村妇 · 秀兰', model: 'npc-maid.glb', x: 13, z: -12, walk: 6, lines: ['孩子他爹被抓去寨子里干活，到现在没回来。', '谢谢你帮村里出头。', '石伯捡到你那天，雪下了三尺厚。'] });
  out.push({ name: '更夫', model: 'npc-farmer.glb', x: -4, z: 13, walk: 10, life: 'watchman', cry: ['天干物燥，小心火烛！', '咚！咚！一更天咯～'], lines: ['天干物燥，小心火烛。', '半夜我常听见北边有钟声，可天阙早没人了啊。', '咚，咚……习惯了，白天也想敲。'] });
  // a keeper at every waystation, and a traveller resting there
  for (const p of PLACES) {
    if (p.kind !== 'inn') continue;
    const [x, z] = placeAt(p, -2, 6.5);
    const k = p.road!;
    out.push({ name: `${p.name}伙计`, model: k % 2 ? 'npc-noodle.glb' : 'npc-peddler.glb', x, z, heal: '歇歇脚（回满生命和内力）', lines: [`这里是${p.name}，往村里走还有好一段路，歇歇再走吧。`, RING_TALK[k % 3], '茶水管够，就是没有好菜。'] });
    const [x2, z2] = placeAt(p, 2.5, 10);
    out.push({ name: '赶路人', model: ['npc-novice.glb', 'npc-scholar.glb', 'npc-peddler.glb', 'npc-farmer.glb'][k % 4], x: x2, z: z2, walk: 5, life: 'stroll', lines: ['我从外头来，路上的贼一伙比一伙凶。', '你也是要去天阙？那条古道上的灯，听说是自己亮的。', '歇够了，我得在天黑前赶到下一处驿站。'] });
  }
  // 青石集: a keeper beside every stall, calling out, and townsfolk strolling the street
  const KEEPERS: Record<string, Omit<Folk, 'x' | 'z'>> = {
    'stall-fruit.glb': { name: '菜农 · 老刘', model: 'npc-farmer.glb', cry: ['新摘的桃，甜过蜜！', '水灵灵的白菜，三文一颗！'], lines: ['自家地里的，没上过粪……呃，上过一点。', '山贼不抢菜，这年头就菜最安全。', '你脸色不好，吃个桃补补。'] },
    'stall-pottery.glb': { name: '窑工 · 陶三', model: 'npc-farmer.glb', cry: ['坛子罐子，摔不烂的瓦罐！', '腌菜坛子，买二送一！'], lines: ['这釉色是我烧了三窑才烧出来的。', '杏娘的酒坛都是我做的。', '别敲，敲碎了要赔。'] },
    'stall-silk.glb': { name: '绸缎庄 · 苏娘子', model: 'npc-lady.glb', cry: ['苏杭的绸，江南的缎！', '扯块花布，做身新衣裳！'], lines: ['这料子是柳三娘织的，城里卖三倍价。', '大侠穿这身破衣裳，可惜了这张脸。', '红的配你，信我。'] },
    'stall-lantern.glb': { name: '灯笼匠 · 胡老爹', model: 'npc-oldman.glb', cry: ['走夜路，带盏灯！', '红灯笼，照得鬼都不敢来！'], lines: ['天阙古道上的灯，就是我师父挂上去的。', '灯笼纸要刷三遍桐油，雨打不透。', '夜里别去北边，灯也照不亮那里。'] },
    'stall-medicine.glb': { name: '云游道人 · 卖药', model: 'npc-fortune.glb', cry: ['跌打损伤，一贴就好！', '祖传膏药，专治刀伤！'], lines: ['贫道这膏药，治得了刀伤，治不了心病。', '你印堂发亮，此去必有奇遇。', '孙伯的草药好，可惜他不会吆喝。'] },
    'stall-noodle.glb': { name: '面摊 · 胖大海', model: 'npc-noodle.glb', cry: ['热汤面，加个蛋！', '大碗面，管饱！'], lines: ['我这碗面，石伯吃了三十年。', '吃饱了才有力气打山贼。', '辣子自己加，别客气。'] },
    'stall-tanghulu.glb': { name: '糖葫芦 · 小石头', model: 'npc-boy.glb', cry: ['糖葫芦，又酸又甜！', '冰糖葫芦，一文一串！'], lines: ['我爹说我卖完这一捆就能去学武了。', '你是大侠吗？给我签个名吧。', '这串给你，不要钱，你帮村里打过山贼。'] },
    'stall-birds.glb': { name: '鸟贩 · 八哥张', model: 'npc-peddler.glb', cry: ['画眉百灵，会说话的八哥！', '鸟儿叫一声，好运跟一年！'], lines: ['这只八哥会说"天阙"两个字，不知道跟谁学的。', '鸟比人老实，你喂它，它就跟你。', '买只鸟吧，路上有个伴。'] },
    'stall-weapons.glb': { name: '卖刀的 · 屠铁塔', model: 'npc-butcher.glb', cry: ['好刀好剑，削铁如泥！', '杀猪刀改的宝剑，便宜卖！'], lines: ['我以前是杀猪的，后来发现卖刀比杀猪赚钱。', '张大锤打的才是真家伙，我这些嘛，看着唬人。', '野猪？我一刀一个。你别学我，你去找铁匠。'] },
    'stall-books.glb': { name: '书摊 · 老夫子', model: 'npc-scholar.glb', cry: ['话本兵书，一文三本！', '《天阙志》残本，只此一册！'], lines: ['这本《天阙志》缺了最后三页，被人撕的。', '读书和练武一样，都是熬出来的。', '你识字吗？不识也没关系，有画。'] },
  };
  for (const s of STALLS) {
    const k = KEEPERS[s.file];
    if (!k) continue;
    // beside the stall, half a step toward the street, facing it
    const g = fit(s.file, s.size), side = g.hx + 0.9;
    const x = s.x + Math.cos(s.rot) * side + Math.sin(s.rot) * 0.4, z = s.z - Math.sin(s.rot) * side + Math.cos(s.rot) * 0.4;
    out.push({ ...k, x, z, life: 'stall' });
  }
  const street = (r: number): [number, number] => {
    const f = roadFrame(MARKET_ROAD, r);
    return [f.x, f.z];
  };
  const mid = (MARKET_FROM + MARKET_TO) / 2;
  const STROLL: [string, string, number, string[], string[]?][] = [
    ['小丫头 · 糖糖', 'npc-girl.glb', MARKET_FROM + 14, ['我娘让我买酱油，我想买糖葫芦。', '你的刀好亮！能给我摸一下吗？', '大黄刚才跟着你，它喜欢你。'], ['糖葫芦！我要糖葫芦！']],
    ['巡街的捕快 · 赵四', 'npc-guard.glb', mid, ['县太爷说了，集上不许打架。', '山贼？那是官兵的事，我只管集上的小偷。', '你身上带着兵器？算了，看你像好人。'], ['都排好队，别挤！']],
    ['化缘的小和尚', 'npc-novice.glb', mid + 18, ['阿弥陀佛，施主行行好。', '师父说下山化缘，是修心。我觉得是修腿。', '慧明大师是我师叔，他的药可灵了。'], ['阿弥陀佛，施主行善积德～']],
    ['买菜的婆婆', 'npc-granny.glb', mid - 10, ['这菜又涨价了，作孽哟。', '年轻人，帮我拎一下篮子。', '我孙子在县里念书，比你还高。']],
    ['老叫花', 'npc-beggar.glb', MARKET_TO - 6, ['行行好，赏口饭吃。', '我年轻时也是天阙门下……不信？不信就算了。', '那座茶楼的说书先生，讲的都是我当年的事。'], ['大爷行行好～']],
  ];
  for (const [name, model, r, lines, cry] of STROLL) {
    const [x, z] = street(r);
    out.push({ name, model, x, z, walk: 11, lines, cry, life: 'stroll' });
  }
  // more of 青石村: inside the stockade, round the square, the hall, the stage, the mill and the coop
  const at = (deg: number, r: number): [number, number] => [Math.cos((deg * Math.PI) / 180) * r, Math.sin((deg * Math.PI) / 180) * r];
  const MORE: [string, string, [number, number], number, string[], string[]?][] = [
    ['放牛娃 · 二牛', 'npc-boy.glb', at(64, 44), 10, ['我家老黄牛比我岁数还大。', '牛不吃草的时候，就是要下雨了。', '你会骑马？教教我呗，我只会骑牛。'], ['哞～回家咯！']],
    ['农妇 · 刘嫂', 'npc-merchantwoman.glb', [3, -1], 6, ['井水甜，煮饭香。', '我男人去县里卖菜了，天黑才回来。', '山贼来那晚，是你守的寨门吧？'], undefined],
    ['教书先生 · 孟夫子', 'npc-scholar.glb', at(126, 29), 3, ['祠堂借给我教书，孩子们念的第一句就是“人之初”。', '读书不是为了做官，是为了明理。', '你识字吗？不识也不打紧，心里有数就行。'], ['人之初，性本善～', '性相近，习相远～']],
    ['学童 · 小满', 'npc-girl.glb', at(121, 27), 3, ['先生说我背书最快！', '我长大要考状元，去永安城！', '你身上有刀，先生说带刀的都不是好人……你不一样。'], ['苟不教，性乃迁～']],
    ['学童 · 虎子', 'npc-kid2.glb', at(132, 27), 4, ['我不想背书，我想学武！', '先生打手心可疼了。', '你能教我一招吗？就一招！'], undefined],
    ['武师 · 赵铁臂', 'npc-swordsman.glb', [-9, 9], 4, ['寨墙修好了，可墙再高，也得有人守。', '夜里山贼来了别慌，守住寨门就是守住全村。', '年轻人，出手要快，收手要更快。'], ['嘿！哈！', '马步扎稳了！']],
    ['晒太阳的老秦头', 'npc-oldman.glb', [10, -6], 2, ['我在这棵老槐树下坐了六十年。', '天阙的钟？我小时候听过一回，响得整座山都在抖。', '你像一个人……像谁呢，想不起来了。'], undefined],
    ['挑水的阿四', 'npc-peddler.glb', [-4, -4], 14, ['一天挑二十担水，腿都不是自己的。', '井里的水是从天阙山上渗下来的，老人都这么说。', '让一让，水洒了你赔？'], ['水来咯，让一让～']],
    ['磨工 · 大石', 'npc-butcher.glb', at(300, 34), 3, ['这盘石磨是我爷爷凿的。', '磨一斗麦子，转三百圈。', '力气是磨出来的，不是练出来的。'], undefined],
    ['喂鸡的周婆', 'npc-granny.glb', at(272, 35), 4, ['咕咕咕～吃食咯！', '王婆婆家的芦花鸡又跑我这儿来了。', '鸡下蛋，人吃饭，日子就这么过。'], ['咕咕咕～']],
    ['戏班班主 · 余老板', 'npc-noodle.glb', at(196, 26), 3, ['逢年过节，咱们戏班就在这戏台上唱三天三夜。', '今年唱什么？《守阙记》！你听过没？', '戏里的大侠，台下的看客，谁比谁真呢？'], ['好戏开锣咯！']],
    ['花旦 · 小桃红', 'npc-courtesan.glb', at(204, 26.5), 2, ['我唱的是守阙人的夫人，雪夜里抱着孩子跑下山……', '每回唱到那儿，台下就有人哭。', '你别这么看着我，怪不好意思的。'], ['♪ 雪满天阙路 ♪']],
    ['武生 · 燕七', 'npc-swordsman.glb', at(200, 25), 2, ['台上的刀枪都是木头的，可翻跟头是真的。', '我小时候想当真的大侠，后来只敢在台上当。', '你那几招，比我台上的好看。'], undefined],
    // the market outside the east gate
    ['买布的小媳妇', 'npc-lady.glb', [0, 0], 0, ['苏娘子的绸子真好，就是太贵。', '我男人说过年给我扯一身新衣裳。', '集上人多，小心荷包。'], undefined],
    ['讨价还价的胖婶', 'npc-merchantwoman.glb', [0, 0], 0, ['三文？两文！两文我就要了！', '这年头什么都涨价，就是工钱不涨。', '你帮我拎着，我再去那边看看。'], ['便宜点！再便宜点！']],
    ['赶集的老汉', 'npc-farmer.glb', [0, 0], 0, ['挑了两筐鸡蛋来卖，路上碎了一半。', '东门外这集，比县里的还热闹。', '天黑前得赶回去，夜里路上不太平。'], undefined],
    ['扒手 · 三只手', 'npc-peddler.glb', [0, 0], 0, ['看什么看？我是……我是卖货的。', '大侠，你的荷包……还在，还在。', '我也是没法子，家里还有个瘸腿的娘。'], undefined],
    ['算命的 · 刘半仙', 'npc-fortune.glb', [0, 0], 0, ['你命里有一座山，山上有一口钟。', '看相一文，算命三文，不准不要钱。', '最近别往北边去……算了，你肯定要去。'], ['算命看相，不准不要钱！']],
  ];
  MORE.forEach(([name, model, spot, walk, lines, cry], k) => {
    // the market ones stroll the street outside the east gate
    const [x, z] = spot[0] === 0 && spot[1] === 0 ? street(MARKET_FROM + 8 + k * 9) : spot;
    out.push({ name, model, x, z, walk: walk || 10, lines, cry, life: 'stroll' });
  });
  // newcomers as the village grows (jianghu.ts): stalls by the square's roads, the town's shops, its gate guards
  const GROW: [string, string, [number, number], number, number | undefined, LifeKind | undefined, string[], string[]?, string?][] = [
    ['豆腐坊 · 孙二娘', 'npc-merchantwoman.glb', at(60, 12), 1, 0.6, 'stall', ['山贼不敢来了，我才敢把豆腐坊开起来。', '豆花要趁热吃，凉了就老了。', '听说是你守的寨门？这碗不要钱……下回再给。'], ['豆花～热乎的豆花～']],
    ['逃难来的吴老汉', 'npc-farmer.glb', at(101, 12), 1, 6, 'stroll', ['伪朝的税一年比一年重，我们一家是从北边逃过来的。', '青石村的人心善，给了我们半间屋子。', '等开了春，我在村口种两亩豆子。']],
    ['货郎 · 钱小二', 'npc-peddler.glb', at(152, 12), 1, 0.6, 'stall', ['以前我只敢在集上摆摊，现在村里也有生意了。', '金疮药、灯笼、坛子，样样都有。', '你要是去别的驿站，替我捎个口信给我哥。'], ['针头线脑，伤药灯笼～']],
    ['药铺 · 白掌柜', 'npc-doctor.glb', at(213, 12), 2, 0.6, 'stall', ['镇上有了药铺，就不用再跑永安城抓药了。', '刀伤要先止血，再上药，别反过来。', '慧明大师的医术，我只学了三成。'], ['抓药看病，童叟无欺～'], '请白掌柜看看伤'],
    ['说书人 · 张铁嘴', 'npc-oldman.glb', at(263, 11), 2, 0.6, 'stall', ['上回说到守阙人一剑西来……今天说说咱们青石镇的少侠！', '你的事迹，我都编成书了，就差一个结尾。', '听书不要钱，给个赏钱就行。'], ['列位看官，今日说一段“青石夜守”！']],
    ['酒楼 · 何掌柜', 'npc-noodle.glb', at(5, 13), 2, 0.6, 'stall', ['镇上的第一座酒楼！办席请客，都来我这儿。', '鹿肉、野兔、河鲜，有多少收多少。', '庆功宴我包了，你守住寨子就行。'], ['酒席开桌咯～']],
    ['老翰林 · 顾老', 'npc-scholar.glb', at(305, 12), 3, 3, 'stroll', ['老夫在永安城做了三十年官，告老了，就想找个太平地方。', '天下太平，不在庙堂，在这样的小城里。', '你这城，有一天会写进史书的。']],
    ['绣娘 · 阿秀', 'npc-lady.glb', at(280, 13), 3, 0.6, 'stall', ['柳三娘是我师父，她织布，我绣花。', '城里的姑娘都来找我绣嫁衣。', '你衣襟上要不要绣个“青”字？'], ['绸缎胭脂，绣花嫁衣～']],
    ['城门守卫', 'npc-guard.glb', at(1.8, 59), 3, undefined, undefined, ['青石城的门，日夜有人守。', '你是城主……哦不，你是大侠，进去吧。', '外头的伪朝兵，现在见了咱们的石墙都绕着走。']],
    ['城门守卫', 'npc-guard.glb', at(8.2, 59), 3, undefined, undefined, ['站岗站久了，腿都站直了。', '大柱和铁牛是我表兄，他们守西门。', '夜里有动静，我就敲锣。']],
  ];
  for (const [name, model, [x, z], vlvl, walk, life, lines, cry, heal] of GROW) out.push({ name, model, x, z, walk, life, lines, cry, vlvl, heal });
  // travellers on the post roads, back and forth between two points, in a waystation by night
  const TRAVEL: [string, string, number, number, number, string[], string[]?][] = [
    ['镖师 · 雷五', 'npc-swordsman.glb', 2, 110, 380, ['走镖二十年，没丢过一趟货。', '最近路上多了伪朝的兵，比山贼还难缠。', '你一个人走路？胆子不小。'], ['镖局走镖，闲人让路！']],
    ['挑担的货郎', 'npc-peddler.glb', 5, 100, 360, ['从这个驿站挑到那个驿站，一年走坏八双鞋。', '前头有关卡，绕着走吧。', '针线、火石、伤药，要不要？'], ['货郎来咯～']],
    ['进京赶考的举子', 'npc-scholar.glb', 1, 140, 640, ['我要去永安城应试，十年寒窗，就看这一回。', '听说考题里有江湖事，我可一点不懂。', '路上要是有贼，你……能送我一程吗？'], undefined],
    ['云游的老僧', 'npc-novice.glb', 3, 120, 420, ['阿弥陀佛。施主眉间有杀气，也有慈悲。', '贫僧从西边来，雪山上的寺，早就空了。', '走路也是修行。'], undefined],
    ['送信的驿卒', 'npc-guard.glb', 6, 100, 400, ['八百里加急！……其实是县太爷的家书。', '驿站的马跑死了两匹，我只好用腿。', '最近送往天阙的信越来越多，都封着黄漆。'], ['驿卒送信，让一让！']],
    ['回娘家的新媳妇', 'npc-lady.glb', 4, 90, 260, ['我娘家在古道那边，走一天才到。', '我男人不放心，非让我天黑前到驿站。', '你也往天阙那边去？那边……别去太远。'], undefined],
  ];
  for (const [name, model, road, r0, r1, lines, cry] of TRAVEL) {
    const a = roadPoint(road, r0), b = roadPoint(road, r1);
    out.push({ name, model, x: a[0], z: a[1], walk: 3, lines, cry, life: 'road', route: [a, b] });
  }
  // the old fisherman on the bank by his boat
  if (FISH_SPOT) {
    const [x, z] = FISH_SPOT;
    out.push({ name: '渔翁 · 老钓', model: 'npc-fisherman.glb', x, z, lines: ['钓鱼要有耐心，报仇也是。', '这河一直流到永安城，朝廷的人喝的也是这水。', '前些年河里漂下来一面七家的旗子，我捞起来藏好了。'], cry: ['鲜鱼！刚钓上来的鲜鱼！', '鱼咬钩咯～'], life: 'fisher' });
  }
  // 永安城 · 朝廷 and the street outside its gate (court.ts)
  const COURT: [string, string, number, number, number | undefined, string[], string[]?][] = [
    ['宫门禁军', 'npc-palaceguard.glb', -3.2, WALL_FRONT + 17, undefined, ['站住！……哦，进去吧，别乱跑。', '宫门卯时开，酉时闭。', '天阙那位下了旨：凡是从青石村来的，都要盘问。我没看见你。'], ['宫门重地，闲人回避！']],
    ['宫门禁军', 'npc-palaceguard.glb', 3.2, WALL_FRONT + 17, undefined, ['你身上有血腥味。别在宫里惹事。', '我从小在这宫门口站岗，站了十年了。', '将军今天心情不好，别去惹他。']],
    ['镇国大将军 · 霍铮', 'npc-general.glb', -22, 6, 6, ['我带兵打过七家的人。打完才知道，他们护着的是天下。', '要是有一天你上了天阙，替我向那个人问一句：值得吗？', '朝廷的兵不敢上天阙。不是怕死，是不知道该向谁拔刀。'], ['列阵！……唉，练兵也没用。']],
    ['长公主 · 萧清徽', 'npc-princess.glb', 24, -14, 7, ['皇兄从前不是这样的。他是为了救一个人，才去了天阙。', '你是守阙人的孩子？……我认得这块玉。', '宫里的花一年四季都开，可我更想看看青石村的杏花。']],
    ['宫女 · 小荷', 'npc-maid.glb', 28, -10, 5, ['公主又在发呆了，她一发呆就是一下午。', '我是从南边卖进宫的，好多年没回家了。', '冯公公来了！快走快走。']],
    ['宫女 · 碧桃', 'npc-maid.glb', -26, -18, 8, ['御花园的仙鹤又跑出来了。', '听说外头集上有糖葫芦，你能给我捎一串吗？', '嘘，这里说话要小声。'], ['公主，该用膳了～']],
    ['御医 · 钱济生', 'npc-doctor.glb', 40, 30, 4, ['丞相大人的病，是心病，药治不好。', '你脉象虽乱，底子却好，像练过天阙的心法。', '宫里人人有病，就是没人肯说。']],
    ['女冠 · 玄素', 'npc-nun.glb', -38, 32, 4, ['鼓楼的鼓一响，就是天阙出事了。三年前响过一次。', '七家散了，道还在。', '你命里有一座山，你会上去，也会下来。']],
    ['击鼓鸣冤的老汉', 'npc-oldman.glb', 31, 32, undefined, ['我儿子被伪……被朝廷的兵抓去修天阙的台阶，一年了，没回来。', '这鼓我敲了三个月，没人出来过。', '你要是上天阙，帮我找找他，他叫王小石。'], ['冤枉啊！青天大老爷！']],
    ['礼部主事 · 孔方', 'npc-official.glb', 26, 24, 2, ['今科礼部试，考经史，也考江湖事。一年一考，二十文报名。', '中了状元的，名字要贴在宫门上。', '去年的状元答错了“一更是什么时辰”，被人笑了一年。'], ['今科开考！有志之士速来报名！']],
    ['巡逻禁军', 'npc-palaceguard.glb', -4, 22, 20, ['巡逻呢，别挡道。', '夜里宫里不太平，有人说看见过白影。', '将军的演武场就在那边，想挨揍就去。'], undefined],
    ['巡逻禁军', 'npc-palaceguard.glb', 4, -6, 20, ['宫里规矩多，别乱碰东西。', '鼓楼的鼓不许乱敲。……你敲了？', '我当兵是为了吃饱饭。'], undefined],
    ['卖艺的 · 红绫', 'npc-dancer.glb', 6, 86, 6, ['看一看瞧一瞧，红绫姑娘的绸子舞！', '我在京城跳，在县里跳，哪里有钱哪里跳。', '那个戴斗笠的剑客，天天来看我跳舞，又不给钱。'], ['好！再来一个！', '红绫起舞，看官赏钱～']],
    ['擂台官 · 包金刚', 'npc-butcher.glb', -22, 34, undefined, ['永安城的擂台，每季第二天开擂，五阵连胜才算魁首。', '上一季的魁首？被我轰下台了。', '打擂不论出身，只论拳头。'], ['开擂咯！有本事的上台！']],
    ['游侠 · 沈孤', 'npc-swordsman.glb', -9, 92, 5, ['剑是用来护人的，不是用来杀人的。我这么说，你信吗？', '天阙？我去过一次，没敢进门。', '我在等一个人，等了很多年。'], undefined],
    ['胭脂铺 · 柳嫂', 'npc-merchantwoman.glb', -16, 100, 3, ['宫里的娘娘们都用我家的胭脂。', '大侠买一盒送心上人？', '公主最喜欢桃花色的。'], ['上好的胭脂水粉，宫里同款！']],
    ['顽童 · 狗蛋', 'npc-kid2.glb', 2, 104, 12, ['略略略，你抓不到我！', '我长大要当大将军！', '那个跳舞的姐姐是我姐。'], ['冲啊！']],
  ];
  for (const [name, model, lx, lz, walk, lines, cry] of COURT) {
    const [x, z] = ctWorld(lx, lz);
    // the guards keep the gate day and night; the court keeps palace hours; the street, a working day
    const life: LifeKind | undefined = model === 'npc-palaceguard.glb' ? undefined : lz > WALL_FRONT + 20 ? 'street' : 'court';
    out.push({ name, model, x, z, walk, lines, cry, life });
  }
  return out;
})();

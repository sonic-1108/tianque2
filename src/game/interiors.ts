// Rooms you can walk into. Each door on the map (the village's seven houses, the tavern, every waystation inn, the
// shrine) leads to a room of its own, built far off the map (out past the world's edge, where nothing else is) and
// drawn only while you are in it. A room is a floor, four walls and its furniture: all of them block like buildings
// (world.ts adds them to BUILDINGS), so the camera stops at the walls and a bench is a step. Pure data: no imports
// from world.ts (it imports this).
import { ROADS } from './layout';
import { HOME } from './village';
import { TEAHOUSE, fit } from './props';
import { CT_ROT, HALL_DOOR, ctWorld } from './court';
import { PLACES, placeAt, type Place } from './places';
import { FOLK, type Folk } from './places';

/** furniture, by what it is: its footprint (half sizes) and height. render/Interiors.tsx draws each kind */
export const FURN = {
  table: [0.6, 0.6, 0.8],
  longtable: [1.1, 0.45, 0.8],
  bench: [0.8, 0.18, 0.45],
  stool: [0.22, 0.22, 0.45],
  counter: [2.2, 0.4, 1.1],
  jars: [1.1, 0.4, 1.3], // a rack of wine jars
  shelf: [1.0, 0.25, 2.2], // books and scrolls
  drawers: [1.3, 0.3, 2.2], // a wall of medicine drawers
  bed: [1.0, 1.1, 0.55],
  screen: [1.0, 0.08, 1.8],
  altar: [1.4, 0.55, 1.0],
  statue: [0.6, 0.45, 2.6], // the earth god on his plinth
  stove: [0.9, 0.6, 1.0],
  chest: [0.5, 0.35, 0.6],
  desk: [0.9, 0.45, 0.8],
  cradle: [0.45, 0.7, 0.7],
  rack: [1.0, 0.2, 1.8], // weapons, bows, tools on a rack
  barrel: [0.4, 0.4, 1.0],
  loom: [0.8, 0.9, 1.6],
  workbench: [1.2, 0.5, 0.9],
  herbs: [1.0, 0.3, 1.8], // drying racks hung with herbs
  stairs: [0.6, 1.8, 2.6],
  hay: [0.7, 0.7, 0.6],
  coop: [0.6, 0.4, 0.8],
  pelts: [0.9, 0.1, 1.6], // furs stretched on a frame
  map: [1.2, 0.05, 1.6], // a painted map on the wall
  // 金銮殿
  dais: [3.2, 2.4, 0.5], // the raised floor the throne stands on (a step up)
  throne: [0.9, 0.7, 1.7], // the dragon throne
  pillar: [0.45, 0.45, 7], // red and gold columns
  cauldron: [0.6, 0.6, 1.3], // bronze tripods with incense
  carpet: [1.4, 6, 0.02], // the red way to the throne (lies flat, blocks nothing)
  lamp: [0.3, 0.3, 2.3], // bronze crane lamps
} as const;
export type FurnKind = keyof typeof FURN;
export interface Furn {
  k: FurnKind;
  x: number;
  z: number;
  ry?: number;
}
export type RoomTheme = 'elder' | 'hunter' | 'weaver' | 'herbalist' | 'carpenter' | 'scholar' | 'elders' | 'tavern' | 'inn' | 'shrine' | 'teahouse' | 'throne' | 'home';
export interface Room {
  id: number;
  name: string;
  theme: RoomTheme;
  /** the room's centre, far off the map; its floor is at y = 0 */
  ox: number;
  oz: number;
  w: number; // inside width (x), depth (z), height
  d: number;
  h: number;
  /** where you stand outside to go in, and the way out of the door (you come out facing it) */
  door: [number, number];
  doorYaw: number;
  furn: Furn[];
  /** the floor's look and the walls' */
  floor: 'plank' | 'stone';
  wall: 'wall' | 'plank';
}

export const ROOM_Y = 0;
const BASE_X = 3300, BASE_Z = 3300;

// what is in each kind of room (room-local, +z is the door's wall)
const LAYOUT: Record<RoomTheme, { w: number; d: number; furn: Furn[]; floor?: 'plank' | 'stone'; wall?: 'wall' | 'plank' }> = {
  // 石伯: a desk under the old map of 天阙, a cradle kept all these years, a chest, a bed behind a screen
  elder: {
    w: 9, d: 8,
    furn: [
      { k: 'desk', x: -2.4, z: -2.8 }, { k: 'stool', x: -2.4, z: -2 }, { k: 'map', x: -2.4, z: -3.9 },
      { k: 'shelf', x: 2.6, z: -3.6 }, { k: 'cradle', x: 3.4, z: 0.2, ry: 0.3 }, { k: 'chest', x: 3.6, z: 2.4 },
      { k: 'screen', x: -1.2, z: 0.6 }, { k: 'bed', x: -3.2, z: 1.4 }, { k: 'table', x: 1, z: 1.6 }, { k: 'stool', x: 1, z: 2.5 },
    ],
  },
  // a hunter: pelts on frames, bows and spears on the rack, antlers, a barrel of salt meat, a cot
  hunter: {
    w: 8, d: 7, wall: 'plank',
    furn: [
      { k: 'pelts', x: -2, z: -3.3 }, { k: 'pelts', x: 1.2, z: -3.3 }, { k: 'rack', x: 3.7, z: -0.5, ry: Math.PI / 2 },
      { k: 'barrel', x: 3.3, z: 2.4 }, { k: 'barrel', x: 2.5, z: 2.7 }, { k: 'bed', x: -2.9, z: 1.2 }, { k: 'table', x: 0.6, z: 0.6 },
      { k: 'stool', x: 0.6, z: 1.5 }, { k: 'chest', x: -3.4, z: -1.6 },
    ],
  },
  // 织娘: two looms, bolts of silk on shelves, a basket of cocoons
  weaver: {
    w: 9, d: 7,
    furn: [
      { k: 'loom', x: -2.4, z: -1.6 }, { k: 'loom', x: 0.6, z: -1.6 }, { k: 'shelf', x: 3.6, z: -2.6, ry: Math.PI / 2 },
      { k: 'table', x: 2.8, z: 1.6 }, { k: 'stool', x: -2.4, z: -0.2 }, { k: 'stool', x: 0.6, z: -0.2 }, { k: 'chest', x: -3.6, z: 2.4 },
      { k: 'bed', x: -3.3, z: 1 },
    ],
  },
  // a herb farmer: a wall of medicine drawers, drying racks, a stove with a pot of something bitter
  herbalist: {
    w: 9, d: 8,
    furn: [
      { k: 'drawers', x: 0, z: -3.6 }, { k: 'herbs', x: -3.6, z: -0.8, ry: Math.PI / 2 }, { k: 'herbs', x: 3.6, z: -0.8, ry: Math.PI / 2 },
      { k: 'stove', x: 3, z: 2.4 }, { k: 'longtable', x: -0.6, z: 0.6 }, { k: 'stool', x: -1.4, z: 1.5 }, { k: 'stool', x: 0.2, z: 1.5 },
      { k: 'barrel', x: -3.4, z: 2.6 },
    ],
  },
  // a carpenter: the workbench, a half made chair, planks stacked, tools on the rack
  carpenter: {
    w: 9, d: 7, wall: 'plank',
    furn: [
      { k: 'workbench', x: -1.6, z: -2.6 }, { k: 'rack', x: 2.4, z: -3.2 }, { k: 'stool', x: 1.6, z: 0.4 }, { k: 'table', x: 2.8, z: 1.4 },
      { k: 'hay', x: -3.4, z: 2.4 }, { k: 'chest', x: -3.5, z: -0.6 }, { k: 'barrel', x: 3.6, z: -1.2 },
    ],
  },
  // a scholar: shelves of books and scrolls, a desk with brushes and an inkstone, a screen painted with mountains
  scholar: {
    w: 9, d: 8,
    furn: [
      { k: 'shelf', x: -2.4, z: -3.6 }, { k: 'shelf', x: 0.2, z: -3.6 }, { k: 'shelf', x: 3.6, z: -1.2, ry: Math.PI / 2 },
      { k: 'desk', x: -0.8, z: -1 }, { k: 'stool', x: -0.8, z: -0.1 }, { k: 'screen', x: 2.2, z: 1.4, ry: 0.5 }, { k: 'bed', x: -3.2, z: 1.8 },
    ],
  },
  // an old couple: the stove, pickle jars, a table set for two, the hens' coop by the door
  elders: {
    w: 9, d: 7, floor: 'stone',
    furn: [
      { k: 'stove', x: -2.8, z: -2.6 }, { k: 'jars', x: 0.6, z: -3.1 }, { k: 'table', x: 1.4, z: 0.6 }, { k: 'stool', x: 0.6, z: 0.6 },
      { k: 'stool', x: 2.2, z: 0.6 }, { k: 'coop', x: 3.4, z: 2.6 }, { k: 'bed', x: -3, z: 1.6 }, { k: 'hay', x: 3.4, z: -2.4 },
    ],
  },
  // 杏花酒肆: the counter and its wine jars, six tables, a stair to the upper rooms
  tavern: {
    w: 16, d: 12,
    furn: [
      { k: 'counter', x: -3, z: -4.6 }, { k: 'jars', x: -3, z: -5.5 }, { k: 'jars', x: 1.4, z: -5.5 }, { k: 'stairs', x: 6.8, z: -3.6 },
      ...[-5.2, -1, 3.2].flatMap((x) => [-0.8, 3].flatMap((z) => [
        { k: 'table' as const, x, z }, { k: 'bench' as const, x, z: z - 1 }, { k: 'bench' as const, x, z: z + 1 },
      ])),
      { k: 'barrel', x: 7, z: 4.6 }, { k: 'barrel', x: 6.2, z: 5 },
    ],
  },
  // a waystation's hall: long tables, the keeper's counter, beds behind screens, travellers' packs
  inn: {
    w: 14, d: 10, wall: 'plank',
    furn: [
      { k: 'counter', x: -3.6, z: -3.8 }, { k: 'jars', x: -3.6, z: -4.6 },
      { k: 'longtable', x: -2.4, z: 0.4 }, { k: 'bench', x: -2.4, z: -0.6 }, { k: 'bench', x: -2.4, z: 1.4 },
      { k: 'longtable', x: -2.4, z: 3.4 }, { k: 'bench', x: -2.4, z: 2.4 }, { k: 'bench', x: -2.4, z: 4.2 },
      { k: 'screen', x: 2.4, z: -1, ry: Math.PI / 2 }, { k: 'bed', x: 4.8, z: -3.4 }, { k: 'bed', x: 4.8, z: 0.4 }, { k: 'chest', x: 3.6, z: 3.8 },
    ],
  },
  // 清风茶楼: the storyteller's desk before a painted screen, tea tables all round, the tea counter and its caddies
  teahouse: {
    w: 14, d: 12,
    furn: [
      { k: 'screen', x: 0, z: -5.4 }, { k: 'desk', x: 0, z: -4.2 }, { k: 'counter', x: -4.2, z: -4.8 }, { k: 'jars', x: -4.2, z: -5.6 },
      { k: 'shelf', x: 5.6, z: -2.4, ry: Math.PI / 2 },
      ...[-3.8, 0, 3.8].flatMap((x) => [-0.6, 3].flatMap((z) => [
        { k: 'table' as const, x, z }, { k: 'stool' as const, x: x - 0.9, z }, { k: 'stool' as const, x: x + 0.9, z },
      ])),
      { k: 'barrel', x: 6, z: 4.8 },
    ],
  },
  // your own house (jianghu.ts): a bed behind a screen, the weapon rack you change your gear at, a table, a chest
  home: {
    w: 8, d: 6.4,
    furn: [
      { k: 'bed', x: -2.8, z: -1.6 }, { k: 'screen', x: -1.2, z: -0.4 }, { k: 'rack', x: 3.5, z: -1.2, ry: Math.PI / 2 },
      { k: 'table', x: 0.9, z: 0.9 }, { k: 'stool', x: 0.9, z: 1.8 }, { k: 'stool', x: 0.1, z: 0.9 }, { k: 'chest', x: 3.2, z: 2.1 },
      { k: 'shelf', x: 1.2, z: -2.8 },
    ],
  },
  // 金銮殿: the dragon throne on its dais under a golden screen, two rows of red pillars, bronze tripods, the red way
  throne: {
    w: 22, d: 20, floor: 'stone',
    furn: [
      { k: 'screen', x: 0, z: -9.4 }, { k: 'dais', x: 0, z: -7.4 }, { k: 'throne', x: 0, z: -7.6 },
      { k: 'carpet', x: 0, z: 1.5 },
      ...[-6.5, -1.5, 3.5, 7.5].flatMap((z) => [-5, 5].map((x) => ({ k: 'pillar' as const, x, z }))),
      { k: 'lamp', x: -3.4, z: -6.2 }, { k: 'lamp', x: 3.4, z: -6.2 }, { k: 'lamp', x: -8.6, z: 6 }, { k: 'lamp', x: 8.6, z: 6 },
      { k: 'cauldron', x: -4.2, z: -4 }, { k: 'cauldron', x: 4.2, z: -4 },
      { k: 'desk', x: -8, z: -6, ry: Math.PI / 2 }, { k: 'shelf', x: 10.4, z: -4, ry: Math.PI / 2 },
    ],
  },
  // 土地庙: the god on his plinth, the altar, lanterns, a fortune-stick table
  shrine: {
    w: 8, d: 8, floor: 'stone',
    furn: [{ k: 'statue', x: 0, z: -3.3 }, { k: 'altar', x: 0, z: -1.9 }, { k: 'table', x: 2.4, z: 1.2 }, { k: 'stool', x: 2.4, z: 2.1 }],
  },
};

/** the village houses (where world.ts puts them): which theme lives in each, the elder's nearest his spot */
const HOUSE_THEMES: RoomTheme[] = ['hunter', 'weaver', 'herbalist', 'carpenter', 'scholar', 'elders'];
const HOUSE_NAMES: Record<RoomTheme, string> = {
  elder: '石伯家', hunter: '猎户韩家', weaver: '织娘柳家', herbalist: '药农孙家', carpenter: '木匠鲁家', scholar: '书生顾家', elders: '王家老两口',
  tavern: '杏花酒肆', inn: '驿站', shrine: '土地庙', teahouse: '清风茶楼', throne: '金銮殿', home: '你的家',
};
function villageHouses() {
  const out: { x: number; z: number; rot: number }[] = [];
  for (let k = 0; k < ROADS.length; k++) {
    const a0 = Math.atan2(ROADS[k][2][1], ROADS[k][2][0]);
    let a1 = Math.atan2(ROADS[(k + 1) % ROADS.length][2][1], ROADS[(k + 1) % ROADS.length][2][0]);
    if (a1 < a0) a1 += Math.PI * 2;
    const a = (a0 + a1) / 2;
    const x = Math.cos(a) * 20, z = Math.sin(a) * 20;
    out.push({ x, z, rot: Math.atan2(-x, -z) });
  }
  return out;
}

export const ROOMS: Room[] = (() => {
  const out: Room[] = [];
  const add = (theme: RoomTheme, name: string, door: [number, number], doorYaw: number) => {
    const L = LAYOUT[theme];
    const id = out.length;
    out.push({
      id, name, theme, ox: BASE_X + (id % 6) * 40, oz: BASE_Z + Math.floor(id / 6) * 40, w: L.w, d: L.d, h: theme === 'throne' ? 9 : theme === 'tavern' || theme === 'teahouse' ? 5.5 : 4.2,
      door, doorYaw, furn: L.furn, floor: L.floor ?? 'plank', wall: L.wall ?? 'wall',
    });
  };
  // the village's houses: their doors face the well (local +z), 5.4 m out from the house's middle
  const houses = villageHouses();
  const elderAt = houses.reduce((b, h, i) => (Math.hypot(h.x - 0, h.z + 9) < Math.hypot(houses[b].x, houses[b].z + 9) ? i : b), 0);
  let t = 0;
  houses.forEach((h, i) => {
    const theme = i === elderAt ? 'elder' : HOUSE_THEMES[t++ % HOUSE_THEMES.length];
    const dx = Math.sin(h.rot) * 5.4, dz = Math.cos(h.rot) * 5.4;
    add(theme, HOUSE_NAMES[theme], [h.x + dx, h.z + dz], h.rot);
  });
  const front = (p: Place, lz: number): [number, number] => placeAt(p, 0, lz);
  for (const p of PLACES) {
    if (p.kind === 'tavern') add('tavern', '杏花酒肆', front(p, 4.3), p.rot);
    if (p.kind === 'inn') add('inn', p.name, front(p, 3.9), p.rot);
    if (p.kind === 'shrine') add('shrine', '土地庙', front(p, 3.2), p.rot);
  }
  // the teahouse at the market's end: its door on the model's front, facing the street
  {
    const T = TEAHOUSE, g = fit(T.file, T.size), r = g.hz + 0.9;
    add('teahouse', '清风茶楼', [T.x + Math.sin(T.rot) * r, T.z + Math.cos(T.rot) * r], T.rot);
  }
  // the throne hall of 永安城: its door at the foot of the terrace's front
  add('throne', '金銮殿', ctWorld(HALL_DOOR.lx, HALL_DOOR.lz), CT_ROT);
  // the house you can buy, last so no other room's place moves
  add('home', '你的家', HOME.door, HOME.rot);
  return out;
})();

/** the room a point is in (with a margin past the walls), or null */
export function roomAt(x: number, z: number): Room | null {
  if (x < BASE_X - 30 || z < BASE_Z - 30) return null;
  for (const r of ROOMS) if (Math.abs(x - r.ox) < r.w / 2 + 2 && Math.abs(z - r.oz) < r.d / 2 + 2) return r;
  return null;
}
/** a room-local point in the world */
export const inRoom = (r: Room, lx: number, lz: number): [number, number] => [r.ox + lx, r.oz + lz];
/** where you stand when you come in (just inside the door) and where the way out is */
export const roomSpawn = (r: Room): [number, number] => inRoom(r, 0, r.d / 2 - 1.4);
export const roomExit = (r: Room): [number, number] => inRoom(r, 0, r.d / 2 - 0.6);

/** the solid parts of every room, for world.ts: four walls (2 m thick, outside the room) and the furniture */
export function roomSolids() {
  const out: { x: number; z: number; rot: number; hx: number; hz: number; h: number }[] = [];
  for (const r of ROOMS) {
    const H = r.h + 0.4;
    out.push({ x: r.ox, z: r.oz - r.d / 2 - 1, rot: 0, hx: r.w / 2 + 2, hz: 1, h: H });
    out.push({ x: r.ox, z: r.oz + r.d / 2 + 1, rot: 0, hx: r.w / 2 + 2, hz: 1, h: H });
    out.push({ x: r.ox - r.w / 2 - 1, z: r.oz, rot: 0, hx: 1, hz: r.d / 2 + 2, h: H });
    out.push({ x: r.ox + r.w / 2 + 1, z: r.oz, rot: 0, hx: 1, hz: r.d / 2 + 2, h: H });
    for (const f of r.furn) {
      if (f.k === 'map' || f.k === 'carpet') continue; // on the wall, on the floor
      const [hx, hz, h] = FURN[f.k];
      out.push({ x: r.ox + f.x, z: r.oz + f.z, rot: f.ry ?? 0, hx, hz, h });
    }
  }
  return out;
}

/** the people who live in the rooms (they join FOLK when the sim starts) */
export const ROOM_FOLK: (Folk & { room: number })[] = (() => {
  const out: (Folk & { room: number })[] = [];
  const at = (r: Room, lx: number, lz: number) => inRoom(r, lx, lz);
  for (const r of ROOMS) {
    const put = (name: string, model: string, lx: number, lz: number, lines: string[], extra: Partial<Folk> = {}) => {
      const [x, z] = at(r, lx, lz);
      // indoors nobody strolls far (a long stroll climbs bench, then table)
      out.push({ name, model, x, z, lines, room: r.id, ...extra, walk: extra.walk ? Math.min(extra.walk, 0.8) : undefined });
    };
    switch (r.theme) {
      case 'elder':
        break; // 石伯 stands in the square; his house keeps its secrets on its own (the cradle, the map)
      case 'hunter':
        put('猎户 · 韩老三', 'npc-hunter.glb', 0.6, -1, ['今年的鹿比往年少，林子里不太平。', '野猪发起疯来比山贼还凶，见了别硬碰。', '墙上那张狼皮？那头狼咬死了我家两条狗。'], { walk: 1.5 });
        break;
      case 'weaver':
        put('织娘 · 柳三娘', 'npc-lady.glb', -2.4, -0.6, ['这匹是给县里绣庄的，三个月才织得出来。', '天阙还在的时候，七家的旗子都是我们柳家织的。', '你这身衣裳破成这样，脱下来我给你补补。']);
        break;
      case 'herbalist':
        put('药农 · 孙伯', 'npc-farmer.glb', 1.4, 1.6, ['这是当归，那是川芎，别乱碰，有毒的也不少。', '慧明大师的药，一半是我从山上挖来的。', '雪线上有一种白花，听说能续断骨。我没敢去采。'], { walk: 1.5 });
        break;
      case 'carpenter':
        put('木匠 · 鲁小斧', 'npc-farmer.glb', -1.6, -1.6, ['这把椅子是给石伯做的，他那把坐了三十年了。', '村口那座牌坊的木头是我爷爷换的。', '刨花别踩，滑。'], { walk: 1.2 });
        break;
      case 'scholar':
        put('书生 · 顾青衫', 'npc-scholar.glb', -0.8, 0.6, ['"天阙在上，七家在下"，这句在县志里被人涂掉了，你说怪不怪？', '我考了三次都没中，不如在村里教孩子识字。', '这字帖是前朝的，你别碰墨。']);
        break;
      case 'elders':
        put('王婆婆', 'npc-granny.glb', -1.8, -1.6, ['孩子，吃了没？锅里还有粥。', '我家老头子年轻时给天阙挑过水呢。', '鸡又跑出去了，看见帮我赶回来。'], { walk: 1.2 });
        put('王老汉', 'npc-oldman.glb', 2.2, 1.4, ['咳咳，人老了，坐着都累。', '那年天阙的火，烧了三天三夜，山下都看得见。', '你像一个人……算了，老眼昏花。']);
        break;
      case 'tavern':
        put('跑堂 · 小六子', 'npc-noodle.glb', 0.5, -3.4, ['客官里边请！要酒要菜您吩咐！', '掌柜的在外头招呼，里头有我。', '那桌划拳的已经喝了三坛了。'], { walk: 4 });
        put('赌客 · 钱八', 'npc-beggar.glb', -5.2, 0.2, ['押大押小？输了别哭。', '我上个月赢了一头牛，这个月输了两头。', '去去去，别挡我财路。']);
        put('醉汉', 'npc-beggar.glb', 3.2, 2, ['我……我当年一刀劈开过一块大石头！', '再来一坛！记账！', '天阙？天阙早没了……嗝。']);
        put('卖唱的 · 阿萝', 'npc-courtesan.glb', 5.6, -1.2, ['客官想听哪一曲？《雪夜归》还是《七家谣》？', '"七家散，天阙寒，钟不鸣，人不还……"', '赏几个铜板吧，唱得口都干了。'], { cry: ['♪ 七家散，天阙寒 ♪', '♪ 钟不鸣，人不还 ♪', '♪ 雪夜归人路漫漫 ♪'] });
        break;
      case 'inn':
        put('行商', 'npc-peddler.glb', -2.4, 1.2, ['这一路三个寨子，我交了三回过路钱。', '茶叶、盐巴、针线，换不换？', '前面驿站的伙计说，雪线那边的路塌了。']);
        put('赶考的书生', 'npc-scholar.glb', -2.4, 3.6, ['离京城还有八百里，盘缠只够一半了。', '你会武功？那陪我走一段吧。', '听说天阙上有一部藏书，比翰林院的还多。']);
        break;
      case 'teahouse':
        put('说书先生 · 铁嘴张', 'npc-fortune.glb', 0, -3.4, ['今儿个说的是天阙七家，明儿个说的还是天阙七家，谁让大伙爱听呢。', '我这张嘴，说过的大侠没有一千也有八百，就是没见过真的。', '你要是真去了天阙，回来讲给我听，我给你编一段书。'], { cry: ['啪！话说当年天阙七家……', '那一剑下去，山都裂了！', '列位看官，且听下回分解！', '伪帝萧承乾，坐的是谁家的江山？'] });
        put('茶博士', 'npc-noodle.glb', -2.4, 1.2, ['龙井、碧螺春、山里的野茶，您要哪样？', '先生的书一天两场，下一场午后开。', '小心烫，这壶刚沏的。'], { walk: 3, cry: ['来嘞，热茶一壶！', '续水续水！'] });
        put('听书的老客', 'npc-scholar.glb', 3.8, 2.2, ['我听这段书听了二十年，每回结局都不一样。', '年轻人，坐下听听，比打打杀杀强。', '先生说天阙要出人了，我看就是你。']);
        put('小少爷', 'npc-scholar.glb', -3.8, -1.4, ['爹不让我练武，我偷偷来听书。', '你会飞吗？说书的说大侠都会飞。', '等我长大了，也去天阙看看。']);
        break;
    case 'throne':
        put('丞相 · 魏如晦', 'npc-official.glb', -3.2, -3.4, ['龙椅空了三年了。圣上……圣上在天阙上，不肯下来。', '朝中的事，老夫一个人撑着。你从山那边来？那边的百姓，还好吗？', '天阙七家？嘘，这四个字在朝中说不得。'], { cry: ['肃静！', '有本早奏，无本退朝……唉，哪还有人上朝。'] });
        put('掌印太监 · 冯保', 'npc-eunuch.glb', 3.2, -4.4, ['咱家奉的是天阙的旨意，这殿里一举一动，都瞒不过上头。', '小子，龙椅前头站得那么近，不怕掉脑袋？', '丞相？哼，老糊涂一个。'], { walk: 2 });
        put('户部尚书 · 钱有余', 'npc-official.glb', -6.6, -2.2, ['国库？国库里的老鼠都饿跑了。', '开仓放粮？粮从哪里来？天阙那位每年要走一半。', '你要是有好主意，早朝的时候说。'], { cry: ['臣有本奏！'] });
        put('兵部尚书 · 石敢当', 'npc-official.glb', 6.6, -2.2, ['兵部的兵，三成在城里，七成在天阙脚下修台阶。', '山贼？山贼比官兵多，你说怎么剿？', '霍将军是好将军，可惜生错了年头。']);
        put('翰林学士 · 苏文', 'npc-scholar.glb', -6.6, 2.4, ['我在修《承乾实录》，写到天阙那一卷，笔就停了。', '史官的笔，是不能骗人的。', '你做的事，我都会写下来。']);
        put('礼部侍郎 · 方圆', 'npc-official.glb', 6.6, 2.4, ['礼部管的是规矩，可这朝里，早就没规矩了。', '元宵灯会办不办，全看早朝怎么议。', '科举还是要考的，读书人总得有条路。']);
        put('殿前禁军', 'npc-palaceguard.glb', -2.4, 7.6, ['殿内不得带刀……算了，看你也不像刺客。', '我们轮值三班，一班四个时辰。', '这殿里夜里有动静，像有人在龙椅上叹气。']);
        put('殿前禁军', 'npc-palaceguard.glb', 2.4, 7.6, ['站好，别乱走。', '丞相大人是好人，就是太累了。', '听说天阙的那位，不吃不睡，就坐着等一个人。']);
        break;
    case 'shrine':
        put('求签的妇人', 'npc-merchantwoman.glb', 1.2, -0.6, ['菩萨保佑，让我家那口子平安回来。', '这签说"守得云开"，你说准不准？', '你也来求一支吧，很灵的。']);
        put('签筒', 'npc-monk.glb', 2.4, 0.4, [
          '上上签：「云开月出照山河，归人自有归处。」',
          '上签：「剑断犹可续，人散亦能聚。」',
          '中签：「雪线之下，路在脚下，莫问前程。」',
          '中签：「七星不齐，钟声未鸣，且待。」',
          '下签：「锋芒太露，必有折损，宜守不宜攻。」',
          '上上签：「钟鸣天阙，万里同闻。」',
        ], { name: '庙中老僧 · 解签' } as any);
        break;
    }
  }
  return out;
})();

/** everyone who lives on the map: the folk outside, then the room folk (the index is what a fighter's `folk` holds) */
export const ALL_FOLK: Folk[] = [...FOLK, ...ROOM_FOLK];

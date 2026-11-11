// How the folk live: each with a `life` keeps their own hours. Stall keepers walk in at dawn, cry their wares all day,
// sit in the teahouse of an evening and go home to sleep; strollers wander by day; the woodcutter goes up to the
// woods; the watchman sleeps by day and walks the village calling the watches at night; the court keeps palace hours.
// Rain and snow send the walkers under a roof. Festivals change the hours (the lantern night keeps the market open).
// Also: what the folk say about the world (the weather, the season, the festival, what you've done), and the
// chronicle 江湖志 that writes the year down. Pure logic.
import type { ClockInfo, Weather } from './clock';
import { ERA, SEASONS, weatherMix } from './clock';
import type { Folk } from './places';
import { ROOMS } from './interiors';
import { ctWorld, HALL_DOOR } from './court';
import { BUILDINGS, groundHeight, inBuilding, WATER_Y } from './world';

export type LifeKind = 'stall' | 'stroll' | 'street' | 'court' | 'woodcutter' | 'watchman' | 'fisher' | 'road';
export interface Plan {
  /** where to be */
  at: [number, number];
  /** how far to wander round it once there */
  roam: number;
  /** gone indoors (asleep, at home): hidden */
  away: boolean;
  /** what they're doing (the talk hint shows it) */
  act: string;
  /** calling out now */
  cry: boolean;
}
export interface Haunts {
  /** the folk's own spot (their stall, their corner) */
  spot: [number, number];
  /** a door they go in at night */
  home: [number, number];
  /** an evening spot (the teahouse, the tavern) */
  evening: [number, number];
  /** roofs to run under */
  shelters: [number, number][];
  /** the woods (for the woodcutter) */
  woods?: [number, number];
}

const near = (from: [number, number], list: [number, number][]) => {
  let best = list[0], bd = Infinity;
  for (const p of list) {
    const d = Math.hypot(p[0] - from[0], p[1] - from[1]);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
};
const inHours = (h: number, a: number, b: number) => (a <= b ? h >= a && h < b : h >= a || h < b);

/** where a folk should be now, and doing what */
export function planFor(folk: Folk, h: Haunts, c: ClockInfo, w: Weather, war: { alarm: boolean; shut: boolean } = { alarm: false, shut: false }): Plan {
  const hr = c.hour;
  // raiders in the village: everyone runs indoors and bars the door
  if (war.alarm && folk.life !== 'court' && folk.life !== 'street') return { at: h.home, roam: 0, away: true, act: '躲在家里', cry: false };
  // the day after the village burned the stalls stay shut
  if (war.shut && folk.life === 'stall' && hr > 5 && hr < 21) return { at: h.evening, roam: 3, away: false, act: '摊子烧了，坐着发愁', cry: false };
  const wet = weatherMix(w, 'rain') + weatherMix(w, 'storm') + weatherMix(w, 'snow') > 0.55;
  const fest = c.festival?.name;
  const lantern = fest === '元宵灯会';
  const shelter = (act: string): Plan => ({ at: near(h.spot, h.shelters), roam: 0.8, away: false, act, cry: false });
  const home: Plan = { at: h.home, roam: 0, away: true, act: '回家歇着了', cry: false };
  const rainAct = weatherMix(w, 'snow') > 0.5 ? '在屋檐下避雪' : '在屋檐下躲雨';
  switch (folk.life) {
    case 'stall': {
      const close = lantern ? 24 : 18.5;
      if (inHours(hr, 5.5, 7)) return { at: h.spot, roam: 0.6, away: false, act: '出摊', cry: false };
      if (inHours(hr, 7, close)) return { at: h.spot, roam: 0.6, away: false, act: lantern && hr > 18 ? '灯会夜市' : wet ? '守着摊子' : '看摊', cry: !wet || hr % 2 < 1 };
      if (!lantern && inHours(hr, close, 21.5)) return wet ? shelter(rainAct) : { at: h.evening, roam: 3, away: false, act: '收了摊，喝茶听书', cry: false };
      return home;
    }
    case 'stroll': {
      if (inHours(hr, 7.5, 18)) return wet ? shelter(rainAct) : { at: h.spot, roam: folk.walk ?? 8, away: false, act: fest ? `过${fest}` : '闲逛', cry: true };
      if (inHours(hr, 18, 21)) return wet ? shelter(rainAct) : { at: h.evening, roam: 4, away: false, act: '饭后溜达', cry: false };
      return home;
    }
    case 'street':
    case 'court': {
      const [a, b] = folk.life === 'court' ? [7, 19] : [8, 20];
      if (inHours(hr, a, b)) return wet && folk.life === 'street' ? shelter(rainAct) : { at: h.spot, roam: folk.walk ?? 3, away: false, act: folk.life === 'court' ? '当值' : '做营生', cry: !wet };
      return { ...home, act: folk.life === 'court' ? '回宫歇息了' : '收工回家了' };
    }
    case 'woodcutter': {
      if (inHours(hr, 6, 15.5)) return wet ? shelter(rainAct) : { at: h.woods ?? h.spot, roam: 6, away: false, act: '上山砍柴', cry: false };
      if (inHours(hr, 15.5, 20)) return { at: h.spot, roam: folk.walk ?? 5, away: false, act: '砍柴回来', cry: false };
      return home;
    }
    case 'watchman': {
      // he sleeps by day; from dusk he walks the village and calls each watch
      if (inHours(hr, 8, 17)) return { ...home, act: '白天补觉' };
      return { at: h.spot, roam: folk.walk ?? 10, away: false, act: c.night ? '打更' : '准备打更', cry: c.night };
    }
    case 'road': {
      // up and down their stretch of post road by day (a leg every three hours), a waystation bed by night
      const R = folk.route ?? [h.spot, h.spot];
      if (inHours(hr, 6, 19.5)) return wet ? shelter(rainAct) : { at: R[Math.floor(hr / 3) % 2], roam: 3, away: false, act: '赶路', cry: true };
      return { at: h.evening, roam: 0, away: true, act: '在驿站投宿', cry: false };
    }
    case 'fisher': {
      if (inHours(hr, 5, 18.5)) return wet ? { at: h.spot, roam: 0, away: false, act: '披着蓑衣钓雨', cry: false } : { at: h.spot, roam: 0.5, away: false, act: '钓鱼', cry: true };
      if (inHours(hr, 18.5, 21)) return { at: h.evening, roam: 3, away: false, act: '提着鱼去喝两口', cry: false };
      return home;
    }
  }
  return { at: h.spot, roam: folk.walk ?? 0, away: false, act: '', cry: true };
}

// ---------------------------------------------------------------- what they say about the world
const SEASON_TALK: string[][] = [
  ['开春了，地里的活一下子全来了。', '杏花开了，杏娘又要酿新酒了。', '春雨贵如油，就是下得人心烦。'],
  ['这天热得，狗都不想动。', '夏至一过，夜里河边全是萤火虫。', '雷雨说来就来，出门记得带蓑衣。'],
  ['秋天了，山上的叶子红得像火。', '今年收成还行，就是寨子里的人又来抢粮。', '秋高气爽，正是赶路的好时候。'],
  ['冬天了，雪一下，山路就封了。', '冷得手都伸不出来，你穿这么少不冷？', '腊月里家家腌肉，过年就盼着这一口。'],
];
const WEATHER_TALK: Record<string, string[]> = {
  rain: ['这雨下得，摊子都出不了。', '下雨天，最适合在茶楼里听书。'],
  storm: ['打雷了！快找地方躲躲！', '这么大的雷，老天爷是生谁的气呢。'],
  snow: ['下雪了，瑞雪兆丰年。', '雪地里走路小心，别摔着。'],
  fog: ['这雾大得，三步外就看不见人了。', '起雾的天，山贼最爱出来。'],
};
const FEST_TALK: Record<string, string> = {
  春节: '过年好！给你拜年啦，来年顺顺当当！',
  元宵灯会: '晚上青石集有灯会，猜中灯谜有赏！',
  端午: '端午安康！河边有人赛龙舟，去看看？',
  中秋: '中秋了，今晚的月亮又大又圆。你家里人……唉，不说了，来块月饼。',
  重阳: '重阳登高，你本事大，替我们这些老骨头多看几眼山。',
  冬至: '冬至吃饺子，不冻耳朵。',
};
/** a remark about the world now, or null (the dialog mixes it with the folk's own lines) */
export function worldRemark(c: ClockInfo, w: Weather, deeds: string[], seed: number): string | null {
  const pool: string[] = [];
  if (c.festival && FEST_TALK[c.festival.name]) pool.push(FEST_TALK[c.festival.name], FEST_TALK[c.festival.name]);
  const k = w.amt > 0.5 ? w.kind : w.prev;
  if (WEATHER_TALK[k]) pool.push(...WEATHER_TALK[k]);
  pool.push(...SEASON_TALK[c.season]);
  if (c.night) pool.push('这么晚了还在外头晃？夜里不太平。', '天黑了，早点歇着吧。');
  for (const d of deeds.slice(-3)) pool.push(d, d);
  if (!pool.length) return null;
  return pool[Math.floor(seed * pool.length) % pool.length];
}

// ---------------------------------------------------------------- 江湖志: the chronicle
export interface Entry {
  /** the date it happened, as the calendar writes it */
  d: string;
  text: string;
  /** folk talk about this one (what the player did) */
  talk?: string;
}
const NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
export const cnNum = (n: number) => (n <= 10 ? NUM[n] : n < 20 ? '十' + NUM[n - 10] : NUM[Math.floor(n / 10)] + '十' + (n % 10 ? NUM[n % 10] : ''));
export const dateOf = (c: ClockInfo) => `${ERA}${cnNum(c.year)}年${SEASONS[c.season]} · ${c.term}`;

// ---------------------------------------------------------------- where each folk's day takes them
const HOMES: [number, number][] = [
  ...ROOMS.filter((r) => r.theme !== 'tavern' && r.theme !== 'teahouse' && r.theme !== 'shrine' && r.theme !== 'throne').map((r) => r.door),
  ctWorld(-18, 84), ctWorld(18, 96), ctWorld(-18, 104), ctWorld(HALL_DOOR.lx, HALL_DOOR.lz),
];
const EVENINGS: [number, number][] = [...ROOMS.filter((r) => r.theme === 'tavern' || r.theme === 'teahouse' || r.theme === 'inn').map((r) => r.door), ctWorld(0, 92)];
const SHELTERS: [number, number][] = [
  ...ROOMS.filter((r) => r.theme !== 'throne').map((r) => r.door),
  ...BUILDINGS.filter((b) => b.model === 'pavilion-b.glb').map((b) => [b.x, b.z] as [number, number]),
  ctWorld(0, 46), ctWorld(HALL_DOOR.lx, HALL_DOOR.lz),
];
export function hauntsFor(f: Folk): Haunts {
  const spot: [number, number] = [f.x, f.z];
  const out: Haunts = { spot, home: near(spot, HOMES), evening: near(spot, EVENINGS), shelters: SHELTERS };
  if (f.life === 'woodcutter') {
    // up the nearest wooded slope: outward from his corner till the ground is dry, open and clear of walls
    const a = Math.atan2(f.z, f.x);
    for (let r = 70; r < 140; r += 6) {
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = groundHeight(x, z);
      if (y > WATER_Y + 0.5 && !inBuilding(x, y + 0.5, z, 1)) {
        out.woods = [x, z];
        break;
      }
    }
  }
  return out;
}

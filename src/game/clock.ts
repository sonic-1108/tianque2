// The world's time: days and nights, the four seasons, the solar terms and festivals, and the weather.
// Pure logic. One game day is DAY_S real seconds; a season is SEASON_DAYS days; the year turns with them.
// The clock and the weather keep going between visits (saved in localStorage `tq2_world_v1`).

export const DAY_S = 900; // a quarter hour a day (owner: ten minutes too quick, thirty too slow)
export const SEASON_DAYS = 2; // a season lasts half an hour (owner)
export const YEAR_DAYS = SEASON_DAYS * 4;
export const SEASONS = ['春', '夏', '秋', '冬'] as const;
export type Season = 0 | 1 | 2 | 3;
/** the era name of the false emperor's reign (the story's 萧承乾) */
export const ERA = '承乾';
/** the twelve two-hour watches, from 子 (23 to 1) */
const SHICHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
/** the 24 solar terms, from 立春: three per game day */
const TERMS = ['立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至', '小寒', '大寒'];
/** festivals by day of the year (a day each) */
export const FESTIVALS: Record<number, { name: string; note: string }> = {
  0: { name: '春节', note: '家家贴春联，放爆竹，村里吃团圆饭。' },
  1: { name: '元宵灯会', note: '入夜满街花灯，青石集猜灯谜。' },
  2: { name: '端午', note: '河边赛龙舟，门上挂艾草，人人吃粽子。' },
  4: { name: '中秋', note: '月圆之夜，吃月饼，赏月，想家。' },
  5: { name: '重阳', note: '登高望远，插茱萸，敬老人。' },
  7: { name: '冬至', note: '冬至大如年，家家包饺子。' },
};

export interface ClockInfo {
  /** whole days since the world began */
  day: number;
  year: number;
  /** day of the year, 0 .. YEAR_DAYS - 1 */
  yday: number;
  season: Season;
  /** 0 .. 1 through the season */
  seasonT: number;
  /** 0 .. 24 */
  hour: number;
  shichen: string;
  term: string;
  festival: { name: string; note: string } | null;
  /** 0 at deep night .. 1 at noon (how much the sun is up) */
  light: number;
  night: boolean;
}

/** the world starts at the 辰 watch (8 o'clock) of the first day of spring, in the third year of 承乾 */
const START_HOUR = 8;
export function clockOf(t: number): ClockInfo {
  const hours = START_HOUR + (t / DAY_S) * 24;
  const day = Math.floor(hours / 24);
  const hour = hours - day * 24;
  const yday = ((day % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS;
  const season = Math.floor(yday / SEASON_DAYS) as Season;
  const seasonT = (yday - season * SEASON_DAYS + hour / 24) / SEASON_DAYS;
  const term = TERMS[Math.min(23, Math.floor(((yday + hour / 24) * 24) / YEAR_DAYS))];
  // the sun is up from 6 to 18 (a little longer in summer, shorter in winter)
  const len = [12, 13.5, 12, 10.5][season];
  const rise = 12 - len / 2;
  const s = (hour - rise) / len;
  const light = s <= 0 || s >= 1 ? 0 : Math.sin(s * Math.PI);
  return {
    day,
    year: 3 + Math.floor(day / YEAR_DAYS),
    yday,
    season,
    seasonT,
    hour,
    shichen: SHICHEN[Math.floor(((hour + 1) % 24) / 2)],
    term,
    festival: FESTIVALS[yday] ?? null,
    light,
    night: light < 0.06,
  };
}
/** the sun's place: elevation (radians, below 0 at night) and bearing, for the renderer */
export function sunAngles(c: ClockInfo) {
  const len = [12, 13.5, 12, 10.5][c.season];
  const rise = 12 - len / 2;
  const s = (c.hour - rise) / len; // 0 sunrise .. 1 sunset, beyond at night
  const peak = [62, 74, 58, 38][c.season] * (Math.PI / 180);
  return { elev: Math.sin(s * Math.PI) * peak, bearing: Math.PI * 0.5 + s * Math.PI };
}

export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog' | 'snow';
export const WEATHER_NAMES: Record<WeatherKind, string> = { clear: '晴', cloudy: '多云', rain: '小雨', storm: '雷雨', fog: '大雾', snow: '下雪' };
/** what comes next, by season: weights for each kind */
const NEXT: Record<Season, Partial<Record<WeatherKind, number>>> = {
  0: { clear: 4, cloudy: 3, rain: 3, fog: 1.5, storm: 0.5 },
  1: { clear: 5, cloudy: 2, rain: 2, storm: 1.5, fog: 0.4 },
  2: { clear: 5, cloudy: 3, rain: 1.5, fog: 1.5, storm: 0.3 },
  3: { clear: 3, cloudy: 3, snow: 4, fog: 1 },
};

export interface Weather {
  kind: WeatherKind;
  /** game seconds until it changes */
  left: number;
  /** 0 .. 1 how much of it there is (eases in and out) */
  amt: number;
  /** the one before, still fading */
  prev: WeatherKind;
  prevAmt: number;
  /** the ground: wet from rain (0 .. 1), white with snow (0 .. 1) */
  wet: number;
  snow: number;
  /** a lightning flash (counts down) */
  flash: number;
  /** wind: direction and strength (0 .. 1) */
  windA: number;
  wind: number;
}
export const newWeather = (): Weather => ({ kind: 'clear', left: DAY_S * 0.35, amt: 1, prev: 'clear', prevAmt: 0, wet: 0, snow: 0, flash: 0, windA: 0.6, wind: 0.25 });

function pick(season: Season, not: WeatherKind): WeatherKind {
  const w = NEXT[season];
  const list = (Object.keys(w) as WeatherKind[]).filter((k) => k !== not);
  let sum = 0;
  for (const k of list) sum += w[k]!;
  let r = Math.random() * sum;
  for (const k of list) if ((r -= w[k]!) <= 0) return k;
  return 'clear';
}
/** how much of each kind is in the air now (the new one easing in over the old) */
export function weatherMix(w: Weather, k: WeatherKind) {
  return (w.kind === k ? w.amt : 0) + (w.prev === k ? w.prevAmt : 0);
}
/** steps the weather on: a spell lasts a few game hours, then the season picks the next */
export function stepWeather(w: Weather, dt: number, c: ClockInfo) {
  w.left -= dt;
  // winter's rain falls as snow; a storm in winter becomes a blizzard of snow
  if (c.season === 3 && (w.kind === 'rain' || w.kind === 'storm')) w.kind = 'snow';
  if (c.season !== 3 && w.kind === 'snow') w.kind = 'rain';
  if (w.left <= 0) {
    w.prev = w.kind;
    w.prevAmt = w.amt;
    w.kind = pick(c.season, w.kind);
    w.amt = 0;
    w.left = DAY_S * (0.12 + Math.random() * 0.25);
    w.windA += (Math.random() - 0.5) * 1.5;
  }
  const ease = dt / 25;
  w.amt = Math.min(1, w.amt + ease);
  w.prevAmt = Math.max(0, w.prevAmt - ease);
  const rain = weatherMix(w, 'rain') + weatherMix(w, 'storm');
  const snowing = weatherMix(w, 'snow');
  // wet ground dries slowly, faster in summer sun; snow lies in winter and melts in the other seasons
  w.wet = Math.max(0, Math.min(1, w.wet + (rain > 0.3 ? dt / 40 : -dt / (c.season === 1 ? 90 : 160) * (0.3 + c.light))));
  w.snow = Math.max(0, Math.min(1, w.snow + (snowing > 0.3 ? dt / 70 : -dt / (c.season === 3 ? 900 : 60))));
  const windy = 0.2 + weatherMix(w, 'storm') * 0.75 + snowing * 0.3 + weatherMix(w, 'rain') * 0.25;
  w.wind += (windy - w.wind) * Math.min(1, dt / 10);
  if (w.flash > 0) w.flash -= dt;
  else if (weatherMix(w, 'storm') > 0.6 && Math.random() < dt / 9) w.flash = 0.35;
}
/** a word or two for the HUD */
export function weatherName(w: Weather) {
  return WEATHER_NAMES[w.amt > 0.5 ? w.kind : w.prev];
}

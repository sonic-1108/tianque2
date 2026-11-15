// 通关之后 (owner: once 伪帝 fell there was nothing left to do). Three things open when 天阙's bell has rung:
//   巨人挑战 at 巨灵碑: any giant you have met, again, at 困难 or 噩梦, against the clock, for gear and names;
//   天阙试炼塔: floor after floor of foes, a named boss every fifth, a giant every tenth, as high as you can climb;
//   二周目: the story from the start with what you've learned and carry, the outlaws stronger, the pay better.
// (The sequel's chapters are quests in quests.ts; its giant, 天魔本相, waits in 天魔窟, made here.)
import type { Sim } from './sim';
import type { Fighter } from './types';
import { QUESTS } from './quests';
import { GIANTS, giantOf, makeGiant, rearmGiant } from './giants';
import { FOE_KINDS } from './foes';
import { ROOMS, type Room } from './interiors';
import { STELE, TOWER, ABYSS } from './endLayout';
import { bag, earn } from './play';
import { owned } from './jianghu';
import { save, type Progress } from './progress';

// ================================================================ where the story stands
const idxOf = (title: string) => QUESTS.findIndex((q) => q.title === title);
/** 伪帝 beaten (天阙's bell rung), in this round or a round before */
export function storyDone(P: Progress) {
  const i = idxOf('天阙钟鸣');
  return ((P as any).ng ?? 0) > 0 || (i >= 0 && P.quest.idx > i);
}
/** how far into the sequel (0: not begun; the quest after 回村 onward) */
export function sequelAt(P: Progress) {
  const i = idxOf('后传 · 余震');
  return i >= 0 && P.quest.idx >= i ? P.quest.idx - i + 1 : 0;
}
/** the sequel's last fight beaten */
export const tianmoBeaten = (P: Progress) => !!P.done?.['tianmo'];
/** may this room's door be used yet */
export function roomOpen(s: Sim, r: Room) {
  if (r.theme === 'trial') return storyDone(s.progress);
  if (r.theme === 'abyss') return sequelAt(s.progress) >= 4 || tianmoBeaten(s.progress);
  return true;
}
const ngOf = (P: Progress) => ((P as any).ng ?? 0) as number;

// ================================================================ the state kept on the sim
export interface Challenge {
  key: string;
  tier: number;
  id: number;
  t0: number;
  deaths: number;
  /** it had woken (once it sleeps again you've walked away) */
  woke: boolean;
}
export interface Tower {
  floor: number;
  state: 'fight' | 'clear';
  ids: number[];
  t: number;
  /** a giant pulled up for a tenth floor (sent home after) */
  giant: number;
}
export interface EndState {
  ch: Challenge | null;
  tower: Tower | null;
  /** the tower's men, benched till a floor calls them */
  pool: number[];
  /** its named bosses (one body each) */
  bosses: number[];
  tianmo: number;
}
export const newEnd = (): EndState => ({ ch: null, tower: null, pool: [], bosses: [], tianmo: -1 });

// ================================================================ the sequel's giant and the tower's men
const TOWER_BOSSES: [string, string, number][] = [
  ['塔守 · 铁面判官', 'boss-xuanyin.glb', 6],
  ['塔守 · 无相刀', 'boss-wumian.glb', 3],
  ['塔守 · 血屠', 'boss-leibiao.glb', 0],
  ['塔守 · 金甲统领', 'emperor.glb', 4],
  ['塔守 · 断魂僧', 'boss-kuhan.glb', 2],
];
/** made once with the rest of the world (after the giants, so no one else's number moves) */
export function makeEndgame(s: Sim) {
  const E = s.end;
  const bench = (team: 'sect', kind: number, name: string, model: string) => {
    const k = FOE_KINDS[kind];
    const f = (s as any).make(team, k.house, name, model, 10, ROOMS[0].ox, ROOMS[0].oz) as Fighter;
    f.hp = 0;
    const a = f as any;
    a.benched = true;
    a.pooled = true;
    a.foeKind = k;
    return f.id;
  };
  for (let k = 0; k < 9; k++) {
    const kind = [0, 1, 2, 3, 4, 6, 0, 3, 1][k];
    E.pool.push(bench('sect', kind, FOE_KINDS[kind].name, FOE_KINDS[kind].model));
  }
  for (const [name, model, kind] of TOWER_BOSSES) E.bosses.push(bench('sect', kind, name, model));
  // 天魔本相 in its cave (asleep till you come down; a giant like the others)
  const R = ROOMS.find((r) => r.theme === 'abyss')!;
  const g = (s as any).make('sect', null, '天魔本相', 'giant-leibiao.glb', 40, R.ox, R.oz - 6) as Fighter;
  g.maxHp = Math.round((180 + 40 * 55) * 12); // half again 法相's: the last thing under 天阙
  g.home = [R.ox, R.oz - 6];
  (g as any).boss = true;
  (g as any).room = R.id;
  (g as any).tianmo = true;
  makeGiant(s, g, 'tianmo');
  g.yaw = 0;
  E.tianmo = g.id;
  // 二周目: every outlaw stronger, every round more
  const ng = ngOf(s.progress);
  if (ng > 0)
    for (const f of s.fighters) {
      if (f.team !== 'sect') continue;
      const a = f as any;
      a.dmgMul = (a.dmgMul ?? 1) * (1 + 0.45 * ng);
      f.maxHp = f.hp = Math.round(f.maxHp * (1 + 0.6 * ng));
      if (a.giant) a.giant.baseHp = f.maxHp;
    }
}

// ================================================================ 巨人挑战
export const TIERS = [
  { name: '困难', hp: 1.7, dmg: 1.3, cd: 0.8, coins: 300, par: 150 },
  { name: '噩梦', hp: 2.8, dmg: 1.7, cd: 0.6, coins: 800, par: 200 },
];
/** the giants a stele can call: each once you have met it in the story */
export const CH_GIANTS = ['leibiao', 'tianlang', 'tongren', 'fadi', 'tianmo'];
/** what each giant's 噩梦 first clear gives (jianghu.ts GEAR prize pieces) */
const CH_PRIZE: Record<string, string> = { leibiao: 'w5', tianlang: 'c4', tongren: 'a5', fadi: 'w6', tianmo: 'c5' };
const giantBody = (s: Sim, key: string) => s.fighters.find((f) => (f as any).giant?.key === key) ?? null;
const D = (P: Progress) => (P.done ??= {}) as Record<string, number>;
/** the best time on a giant at a tier (seconds), 0 if never */
export const bestTime = (P: Progress, key: string, tier: number) => D(P)[`ch:${key}:${tier}`] ?? 0;
/** a giant you may challenge: met in the story (its ring's den reached) or the story done */
export function canChallenge(s: Sim, key: string) {
  const P = s.progress;
  if (key === 'tianmo') return tianmoBeaten(P);
  return storyDone(P);
}

export function startChallenge(s: Sim, key: string, tier: number) {
  const g = giantBody(s, key);
  if (!g || !canChallenge(s, key)) return s.toast('巨灵碑上这一格还是空的。');
  if (s.end.ch) return s.toast('你已经在挑战了。');
  if (s.end.tower) return s.toast('先从试炼塔出来。');
  const T = TIERS[tier];
  const def = giantOf(g)!;
  const st = (g as any).giant;
  const home = (st.denHome ??= g.home ? [...g.home] : [g.pos[0], g.pos[2]]) as [number, number];
  rearmGiant(s, g, { hpMul: T.hp * (1 + 0.3 * ngOf(s.progress)), dmgMul: T.dmg, cdMul: T.cd, home, room: (g as any).tianmo ? (g as any).room : undefined });
  // the man who turns into 法相 stays out of it: the giant comes at once
  s.end.ch = { key, tier, id: g.id, t0: s.time, deaths: 0, woke: false };
  // to the edge of its ground (or into its cave), facing it
  const p = s.player;
  if ((g as any).tianmo) {
    s.enterRoom(ROOMS.findIndex((r) => r.theme === 'abyss'));
  } else {
    const dx = p.pos[0] - home[0], dz = p.pos[2] - home[1], d = Math.hypot(dx, dz) || 1;
    const r = Math.max(10, def.ground - 8);
    const x = home[0] + (dx / d) * r, z = home[1] + (dz / d) * r;
    s.teleport(x, z);
  }
  s.faceTo(p, home[0], home[1]);
  s.camSnap = p.yaw;
  s.game = null;
  s.pushNote({ title: `巨人挑战 · ${def.name} · ${T.name}`, text: `${def.intro}\n\n它的血是平常的 ${T.hp.toFixed(1)} 倍，下手更重、歇得更短。计时从现在开始，倒下了还能在场边站起来，但时间照走。走出它的地盘就算放弃。` });
}

function stepChallenge(s: Sim) {
  const C = s.end.ch!;
  const g = s.fighters[C.id];
  const st = (g as any).giant;
  if (st?.awake) C.woke = true;
  if (g.hp <= 0) return; // the kill hook settles it
  // walked off: it went back to sleep
  if (C.woke && st && !st.awake && s.player.hp > 0) {
    s.toast('你离开了它的地盘：挑战作罢。');
    endChallenge(s);
  }
}
function endChallenge(s: Sim) {
  const C = s.end.ch;
  if (!C) return;
  const g = s.fighters[C.id];
  const st = (g as any).giant;
  // back to how the story left it
  rearmGiant(s, g, { home: st?.denHome, room: (g as any).tianmo ? (g as any).room : undefined });
  if ((g as any).avatarOf !== undefined || giantOf(g)?.key === 'fadi') {
    g.hp = 0;
    (g as any).benched = true;
  }
  s.end.ch = null;
}
function challengeWon(s: Sim) {
  const C = s.end.ch!, P = s.progress, T = TIERS[C.tier];
  const g = s.fighters[C.id], def = giantOf(g)!;
  const secs = Math.round(s.time - C.t0);
  const grade = Math.min(3, (secs < T.par ? 0 : secs < T.par * 1.6 ? 1 : 2) + C.deaths);
  const mark = ['甲', '乙', '丙', '丁'][grade];
  const k = `ch:${C.key}:${C.tier}`;
  const first = !D(P)[k];
  if (first || secs < D(P)[k]) D(P)[k] = secs;
  const coins = Math.round(T.coins * (1 + 0.5 * ngOf(P)) * (grade === 0 ? 1.5 : 1));
  earn(s, coins, '巨人挑战');
  const got: string[] = [`铜钱 ${coins}`];
  if (first && C.tier === 1) {
    const id = CH_PRIZE[C.key];
    if (id && !owned(P).includes(id)) {
      owned(P).push(id);
      got.push('宝物（去家里的兵器架或铁铺换上）');
    }
  }
  const allAt = (tier: number) => CH_GIANTS.slice(0, 4).every((key) => bestTime(P, key, tier) > 0);
  const titles = (P.titles ??= []);
  for (const [cond, t] of [[allAt(0), '巨灵猎手'], [allAt(1), '巨灵克星']] as [boolean, string][])
    if (cond && !titles.includes(t)) {
      titles.push(t);
      got.push(`名号「${t}」`);
    }
  s.pushNote({ title: `${def.name} · ${T.name} · ${mark}等`, text: `用时 ${Math.floor(secs / 60)} 分 ${secs % 60} 秒，倒下 ${C.deaths} 次。${first ? '\n第一次过这一关！' : secs <= D(P)[k] ? '\n新的最好成绩！' : ''}\n\n得到：${got.join('、')}` });
  save(P);
  s.end.ch = null;
  // it stays down until its usual return
  g.respawn = 30;
  const st = (g as any).giant;
  if (st?.denHome) g.home = [...st.denHome] as [number, number];
  (g as any).tierDmg = 1;
  (g as any).tierCd = 1;
}

// ================================================================ 天阙试炼塔
const towerRoom = () => ROOMS.find((r) => r.theme === 'trial')!;
const towerBest = (P: Progress) => D(P)['tower:best'] ?? 0;
export { towerBest };

/** you came through the pagoda's door */
export function startTower(s: Sim) {
  if (s.end.ch) endChallenge(s);
  const best = towerBest(s.progress);
  const from = best >= 10 ? Math.floor(best / 10) * 10 + 1 - (best % 10 === 0 ? 10 : 0) : 1;
  s.end.tower = { floor: from, state: 'clear', ids: [], t: 1.5, giant: -1 };
  s.pushNote({ title: '天阙试炼塔', text: `塔有多高，没人知道。每一层都有人守着，打倒他们就能上去；五层一位塔守，十层一尊巨灵。\n\n塔里没人给你疗伤：带够金疮药和吃的。倒下或走出塔门，这一趟就结束了，最高到过的层数会刻在塔门上。${from > 1 ? `\n\n你上次到过第 ${best} 层，这次从第 ${from} 层开始。` : ''}` });
}
/** out of the tower (walked out, fell): the men go back to the bench, a giant goes home */
export function endTower(s: Sim, why: 'left' | 'down') {
  const T = s.end.tower;
  if (!T) return;
  for (const id of T.ids) {
    const f = s.fighters[id];
    if ((f as any).giant) continue;
    f.hp = 0;
    (f as any).benched = true;
  }
  if (T.giant >= 0) {
    const g = s.fighters[T.giant], st = (g as any).giant;
    rearmGiant(s, g, { home: st?.denHome, room: (g as any).tianmo ? (g as any).room : undefined });
    if (giantOf(g)?.key === 'fadi') {
      g.hp = 0;
      (g as any).benched = true;
    }
  }
  const reached = T.state === 'clear' ? T.floor : T.floor - 1;
  s.toast(why === 'down' ? `你在第 ${T.floor} 层倒下了 · 最高 ${towerBest(s.progress)} 层` : `离开了试炼塔 · 这一趟到了第 ${Math.max(0, reached)} 层`);
  s.end.tower = null;
}

function spawnFloor(s: Sim, n: number) {
  const T = s.end.tower!, R = towerRoom(), E = s.end;
  T.ids = [];
  T.giant = -1;
  const lvl = Math.min(45, 8 + n);
  const hpK = (1 + n * 0.07) * (1 + 0.5 * ngOf(s.progress));
  const dmgK = (1 + n * 0.025) * (1 + 0.3 * ngOf(s.progress));
  const at = (k: number, of: number, r: number): [number, number] => {
    const a = -Math.PI / 2 + (of > 1 ? (k / (of - 1) - 0.5) * 2.2 : 0);
    return [R.ox + Math.cos(a) * r, R.oz + Math.sin(a) * r * 0.8 - 2];
  };
  const callUp = (id: number, name: string, x: number, z: number, hpMul: number, extra: Record<string, any> = {}) => {
    const f = s.fighters[id];
    const a = f as any;
    f.name = name;
    f.level = lvl;
    f.maxHp = Math.round((180 + lvl * 55) * 0.85 * hpMul);
    f.home = [x, z];
    a.benched = false;
    a.mode = 'tower';
    a.roomId = R.id;
    a.dmgMul = dmgK;
    Object.assign(a, extra);
    (s as any).revive(f);
    f.pos = [x, s.floorAt(x, z), z];
    f.aggro = true;
    s.faceTo(f, s.player.pos[0], s.player.pos[2]);
    T.ids.push(id);
  };
  if (n % 10 === 0) {
    // a giant (in turn), sized to the hall
    const keys = ['leibiao', 'tianlang', 'tongren', 'fadi', ...(tianmoBeaten(s.progress) ? ['tianmo'] : [])];
    const g = giantBody(s, keys[(n / 10 - 1) % keys.length]);
    if (g) {
      const st = (g as any).giant;
      st.denHome ??= g.home ? [...g.home] : [g.pos[0], g.pos[2]];
      rearmGiant(s, g, { hpMul: 0.5 + n * 0.025, dmgMul: 0.75 + n * 0.012, cdMul: 0.95, home: [R.ox, R.oz - 6], room: R.id });
      T.giant = g.id;
      T.ids.push(g.id);
      s.text(g, `第 ${n} 层 · ${g.name}`, giantOf(g)!.color);
      return;
    }
  }
  const men = n % 5 === 0 ? 2 : Math.min(7, 2 + Math.floor(n / 2));
  for (let k = 0; k < men; k++) {
    const id = E.pool[(n * 3 + k) % E.pool.length];
    const [x, z] = at(k, men, 11);
    const kind = FOE_KINDS[(s.fighters[id] as any).foeKind ? FOE_KINDS.indexOf((s.fighters[id] as any).foeKind) : 0];
    callUp(id, `塔中${kind?.name ?? '武人'}`, x, z, hpK);
  }
  if (n % 3 === 0 && n % 5 !== 0) {
    const id = E.pool[(n * 3 + men) % E.pool.length];
    if (!T.ids.includes(id)) callUp(id, '塔中精锐', R.ox, R.oz - 10, hpK * 2.4, { elite: true });
  }
  if (n % 5 === 0) {
    const b = E.bosses[(n / 5 - 1) % E.bosses.length];
    callUp(b, s.fighters[b].name.split(' · ')[0] === '塔守' ? s.fighters[b].name : TOWER_BOSSES[(n / 5 - 1) % TOWER_BOSSES.length][0], R.ox, R.oz - 9, hpK * 5.5, { boss: true });
    s.text(s.fighters[b], `第 ${n} 层 · ${s.fighters[b].name}`, '#fca5a5');
  }
}

function floorRewards(s: Sim, n: number) {
  const P = s.progress;
  const coins = Math.round((12 + n * 5) * (1 + 0.5 * ngOf(P)));
  earn(s, coins);
  const got: string[] = [];
  if (n % 5 === 0) {
    const B = bag(P);
    B.plaster = (B.plaster ?? 0) + 1;
    B.iron = (B.iron ?? 0) + 2;
    if (n % 10 === 0) B.xuan = (B.xuan ?? 0) + 2;
    got.push('金疮药 1', n % 10 === 0 ? '铁料 2、玄铁 2' : '铁料 2');
  }
  const titles = (P.titles ??= []);
  const MILES: [number, string, string?][] = [[10, '登塔者'], [20, '塔中客', 'c6'], [30, '天阙守塔人', 'w7'], [50, '塔顶摘星']];
  for (const [at, title, prize] of MILES) {
    if (n !== at) continue;
    if (!titles.includes(title)) {
      titles.push(title);
      got.push(`名号「${title}」`);
    }
    if (prize && !owned(P).includes(prize)) {
      owned(P).push(prize);
      got.push('宝物（去兵器架换上）');
    }
  }
  if (n > towerBest(P)) D(P)['tower:best'] = n;
  if (got.length) s.toast(`第 ${n} 层 · 得到 ${got.join('、')}`);
  save(P);
}

function stepTower(s: Sim, dt: number) {
  const T = s.end.tower!;
  if (s.indoor < 0 || ROOMS[s.indoor].theme !== 'trial') return endTower(s, 'left');
  T.t -= dt;
  if (T.state === 'clear') {
    if (T.t <= 0) {
      if (T.floor > 0 && T.ids.length) T.floor++;
      T.state = 'fight';
      spawnFloor(s, T.floor);
      s.toast(`天阙试炼塔 · 第 ${T.floor} 层`);
    }
    return;
  }
  if (T.ids.length && T.ids.every((id) => s.fighters[id].hp <= 0)) {
    floorRewards(s, T.floor);
    if (T.giant >= 0) {
      const g = s.fighters[T.giant], st = (g as any).giant;
      rearmGiant(s, g, { home: st?.denHome, room: (g as any).tianmo ? (g as any).room : undefined });
      g.hp = 0;
      g.respawn = 40;
      if (giantOf(g)?.key === 'fadi') (g as any).benched = true;
      T.giant = -1;
    }
    T.state = 'clear';
    T.t = 4;
    s.text(s.player, `第 ${T.floor} 层 已破`, '#fde68a');
  }
}

// ================================================================ the hooks the sim calls
export function stepEndgame(s: Sim, dt: number) {
  if (s.end.ch) stepChallenge(s);
  if (s.end.tower) stepTower(s, dt);
}
/** someone fell to the player's side */
export function onEndKill(s: Sim, def: Fighter) {
  if (s.end.ch && def.id === s.end.ch.id) challengeWon(s);
  if ((def as any).tianmo && !s.progress.done?.['tianmo']) {
    D(s.progress)['tianmo'] = 1;
    save(s.progress);
  }
}
/** the player fell */
export function onPlayerDown(s: Sim) {
  if (s.end.ch) s.end.ch.deaths++;
  if (s.end.tower) endTower(s, 'down');
}

// ================================================================ 巨灵碑 (F by the stele)
export interface EndTouch {
  kind: 'stele';
  id: number;
  label: string;
}
export const END_TOUCH = ['stele'];
export function endTouch(s: Sim): EndTouch | null {
  if (s.indoor >= 0) return null;
  const p = s.player.pos;
  if (Math.hypot(p[0] - STELE.x, p[2] - STELE.z) < 3.2) return { kind: 'stele', id: 0, label: storyDone(s.progress) ? '巨灵碑' : '巨灵碑（天阙钟响之后）' };
  return null;
}
export function doEndTouch(s: Sim, t: { kind: string }) {
  if (t.kind !== 'stele') return;
  if (!storyDone(s.progress)) return s.toast('碑上刻着几个巨大的空格，旁边一行小字：「待天阙钟鸣」。');
  s.game = { kind: 'stele' };
}

// ================================================================ 二周目
/** the story from the start: level, moves, gear, coins, bag, names, the house and companions kept */
export function newGamePlus(s: Sim) {
  const P = s.progress as any;
  P.ng = (P.ng ?? 0) + 1;
  P.quest = { idx: 0, count: 0, state: 'offered' };
  P.chapterSeen = undefined;
  const titles = (P.titles ??= []) as string[];
  const t = P.ng === 1 ? '再入江湖' : `${['', '', '三', '四', '五', '六', '七', '八', '九'][Math.min(8, P.ng)] || P.ng}入江湖`;
  if (!titles.includes(t)) titles.push(t);
  save(P);
}
export const ngLevel = ngOf;

/** a few words for the tower's door and the stele, for the HUD and panels */
export const TOWER_DOOR = TOWER.door;
export const ABYSS_DOOR = ABYSS.door;
export { GIANTS };

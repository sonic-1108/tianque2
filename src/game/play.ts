// What you can do in the village and at court, carried out on the sim: money, buying and selling, using things,
// gifts for folk who wish for them (委托), catching a hen, picking herbs, riding the waystation horses, the notice
// boards, the drum tower, sparring with the general's guards (演武), the morning court's counsel (朝议), and the
// results of the little games (fishing, riddles, the exam, the cases, dice, pot throwing) the UI runs.
import type { Sim } from './sim';
import { BUYERS, CASES, DEBATES, EXAM_RANKS, FISH, HERB_N, ITEMS, POLICY, SHOPS, WANTS, type ItemKind, type Want } from './economy';
import { DAY_S, weatherMix } from './clock';
import { okSpot } from './animals';
import { groundHeight } from './world';
import { gainXp, playerMaxHp, save, type Progress } from './progress';
import { BOARDS, DRUM, ctWorld, CT_POS } from './court';
import { FOE_KINDS } from './foes';

export { ITEMS, SHOPS, BUYERS, WANTS };

// ---------------------------------------------------------------- the purse and the bag
export const purse = (P: Progress) => (P.coins ??= 0);
export const bag = (P: Progress) => (P.bag ??= {});
export const done = (P: Progress) => (P.done ??= {});
export const titles = (P: Progress) => (P.titles ??= []);
export function earn(s: Sim, n: number, why?: string) {
  const P = s.progress;
  P.coins = purse(P) + n;
  if (n > 0) s.text(s.player, `铜钱 +${n}`, '#ffd36a');
  if (why) s.toast(why);
  save(P);
}
function addTitle(s: Sim, t: string) {
  const T = titles(s.progress);
  if (T.includes(t)) return;
  T.push(t);
  s.toast(`得了个名号：「${t}」`);
  s.chron(`江湖上有人叫你「${t}」了。`);
}
export function giveXp(s: Sim, n: number) {
  const P = s.progress, p = s.player;
  s.text(p, `经验 +${n}`, '#a5f3fc');
  if (gainXp(P, n) > 0) {
    p.level = P.level;
    p.maxHp = playerMaxHp(P.level);
    p.hp = p.maxHp;
    s.toast(`升级！${P.level} 级 · 按 K 加点`);
  }
}

/** the court's counsel now standing (three days), and what it does to prices, bandits and horses */
export const policyNow = (s: Sim) => (s.policy && s.policy.until > s.worldT ? POLICY[s.policy.id] : null);
export const priceOf = (s: Sim, id: string) => {
  const base = ITEMS[id].price;
  const k = policyNow(s)?.price ?? 1;
  return Math.max(1, Math.round(base * k));
};

/** buys one: food is eaten on the spot, a service done, the rest goes in the bag (a tool only once) */
export function buy(s: Sim, id: string): boolean {
  const P = s.progress, it = ITEMS[id], cost = priceOf(s, id);
  if (it.kind === 'tool' && (bag(P)[id] ?? 0) > 0) {
    s.toast(`你已经有${it.name}了`);
    return false;
  }
  if (id === 'mooncake' && s.clock.festival?.name !== '中秋') return false;
  if (purse(P) < cost) {
    s.toast(`铜钱不够：${it.name}要 ${cost} 文，你只有 ${purse(P)} 文`);
    return false;
  }
  P.coins = purse(P) - cost;
  const p = s.player;
  if (it.kind === 'food') {
    const k = id === 'noodle' ? 0.6 : id === 'mooncake' ? 1 : 0.2;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * k);
    s.toast(id === 'tea' ? `喝了一壶${it.name}。说书先生正讲到：${TEA_TALES[Math.floor(Math.random() * TEA_TALES.length)]}` : `吃了${it.name}，浑身暖和。`);
  } else if (it.kind === 'service') {
    s.buffs.dmg = 180;
    s.toast('屠铁塔把你的兵器磨得雪亮：三分钟内伤害提高一成半');
  } else {
    bag(P)[id] = (bag(P)[id] ?? 0) + 1;
    s.toast(it.kind === 'tool' ? `买了${it.name}。${it.desc}` : `买了${it.name}，放进包袱（B 打开）`);
  }
  save(P);
  return true;
}
const TEA_TALES = [
  '“那守阙人一剑西来，七家的旗子齐齐倒了一半……”',
  '“话说天阙的钟，九九八十一斤铜，敲一下，七家的人隔着三座山都听得见……”',
  '“那伪帝萧承乾，本是七家的外甥，从小在天阙长大……”',
  '“雪夜里有人把一个襁褓放在青石村口，襁褓里裹着一柄断剑……”',
];
/** uses one from the bag (what can be used) */
export function use(s: Sim, id: string): boolean {
  const P = s.progress, B = bag(P), p = s.player;
  if (!(B[id] > 0)) return false;
  switch (id) {
    case 'peach':
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.15);
      s.toast('咬了一口鲜桃，甜。');
      break;
    case 'tanghulu':
      s.buffs.speed = 90;
      s.toast('又酸又甜！脚下生风，跑得快了一阵。');
      break;
    case 'wine':
      s.buffs.regen = 60;
      s.toast('一口杏花酿下肚，气血慢慢回上来了。');
      break;
    case 'plaster':
      p.hp = p.maxHp;
      s.toast('敷上金疮药，伤口不疼了。');
      break;
    case 'book':
      giveXp(s, 60 + P.level * 12);
      s.toast('读完《江湖杂记》，长了见识。');
      break;
    default:
      return false;
  }
  B[id]--;
  save(P);
  return true;
}
export const usable = (id: string) => ['peach', 'tanghulu', 'wine', 'plaster', 'book'].includes(id);
/** sells everything of these kinds in the bag to a buyer (at half price) */
export function sell(s: Sim, kinds: ItemKind[]): number {
  const P = s.progress, B = bag(P);
  let got = 0, n = 0;
  for (const [id, k] of Object.entries(B) as [string, number][]) {
    const it = ITEMS[id];
    if (!it || !kinds.includes(it.kind) || !(k > 0) || id === 'hen') continue;
    got += Math.max(1, Math.round(it.price * 0.5)) * k;
    n += k;
    B[id] = 0;
  }
  if (n) earn(s, got, `卖了 ${n} 样，得 ${got} 文`);
  return got;
}
export const wantOf = (s: Sim, folk: string): Want | null => WANTS.find((w) => w.folk === folk && !done(s.progress)['want:' + folk]) ?? null;
/** gives a folk what they wished for */
export function give(s: Sim, w: Want): boolean {
  const P = s.progress, B = bag(P);
  if (!(B[w.item] > 0)) return false;
  B[w.item]--;
  done(P)['want:' + w.folk] = 1;
  earn(s, w.coins);
  giveXp(s, w.xp);
  s.chron(`你帮${w.folk}办成了一件事。`, `听说你帮了${w.folk.split(' · ').pop()}的忙，好人呐。`);
  if (w.title) addTitle(s, w.title);
  // the hen goes back to the flock
  if (w.item === 'hen') {
    const h = s.animals.find((a) => a.kind === 'hen' && (a as any).caught);
    if (h) {
      (h as any).caught = false;
      h.x = -14;
      h.z = 14;
      h.home = [h.x, h.z];
    }
  }
  save(P);
  return true;
}

// ---------------------------------------------------------------- things to touch on the map
export interface Herb {
  x: number;
  z: number;
  /** world time it grows back */
  back: number;
}
export function makeHerbs(): Herb[] {
  const out: Herb[] = [];
  for (let k = 0; out.length < HERB_N && k < 400; k++) {
    const a = ((k * 137.5) % 360) * (Math.PI / 180), r = 90 + ((k * 53) % 260);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (okSpot(x, z) && !out.some((h) => Math.hypot(h.x - x, h.z - z) < 40)) out.push({ x, z, back: 0 });
  }
  return out;
}
export { BOARDS, DRUM };

export type Touch = { kind: 'hen' | 'herb' | 'horse' | 'board' | 'drum' | 'dismount'; id: number; label: string };
/** what's within reach to do something with (when nobody is there to talk to and no door) */
export function touchable(s: Sim): Touch | null {
  const p = s.player.pos;
  if (s.riding >= 0) return { kind: 'dismount', id: s.riding, label: '下马' };
  if (s.indoor >= 0) return null;
  let best: Touch | null = null, bd = 9;
  const offer = (t: Touch, d: number, r: number) => {
    if (d < r && d < bd) {
      bd = d;
      best = t;
    }
  };
  for (const a of s.animals) {
    if ((a as any).caught) continue;
    const d = Math.hypot(a.x - p[0], a.z - p[2]);
    if (a.kind === 'hen') offer({ kind: 'hen', id: a.id, label: '抓鸡' }, d, 1.7);
    if (a.kind === 'horse') offer({ kind: 'horse', id: a.id, label: '骑马' }, d, 2.4);
  }
  s.herbs.forEach((h, i) => h.back <= s.worldT && offer({ kind: 'herb', id: i, label: '采血参' }, Math.hypot(h.x - p[0], h.z - p[2]), 1.8));
  BOARDS.forEach(([x, z], i) => offer({ kind: 'board', id: i, label: '看告示' }, Math.hypot(x - p[0], z - p[2]), 2.6));
  offer({ kind: 'drum', id: 0, label: '擂鼓' }, Math.hypot(DRUM[0] - p[0], DRUM[1] - p[2]), 3.2);
  return best;
}
export function doTouch(s: Sim, t: Touch) {
  const P = s.progress, B = bag(P), p = s.player;
  switch (t.kind) {
    case 'hen': {
      if (B.hen > 0) return s.toast('你怀里已经抱着一只鸡了');
      const a = s.animals[t.id];
      (a as any).caught = true;
      B.hen = 1;
      s.toast('逮住了！咯咯咯……（交给王婆婆）');
      save(P);
      return;
    }
    case 'herb': {
      s.herbs[t.id].back = s.worldT + DAY_S;
      B.herb = (B.herb ?? 0) + 1;
      s.toast('采到一株血参，红得发亮。');
      save(P);
      return;
    }
    case 'horse': {
      const a = s.animals[t.id];
      s.riding = a.id;
      (a as any).ridden = true;
      a.state = 'graze';
      p.pos = [a.x, groundHeight(a.x, a.z), a.z];
      s.toast('骑上了驿马。跑起来快多了，F 下马（骑马时不能出招）');
      return;
    }
    case 'dismount': {
      const a = s.animals[s.riding];
      s.riding = -1;
      (a as any).ridden = false;
      a.speed = 0;
      a.home = [a.x, a.z];
      p.pos = [a.x + Math.cos(a.yaw) * 1.4, groundHeight(a.x, a.z), a.z - Math.sin(a.yaw) * 1.4];
      s.toast('下了马。驿马会在原地等你。');
      return;
    }
    case 'board':
      s.game = { kind: 'board', court: t.id === 1 };
      return;
    case 'drum':
      s.shake(0.35, DRUM[0], DRUM[1]);
      s.say(DRUM[0], groundHeight(DRUM[0], DRUM[1]) + 4.5, DRUM[1], '咚！咚！咚！');
      if (done(P).drum !== s.clock.day) {
        done(P).drum = s.clock.day;
        s.chron('你在永安城擂响了鼓楼的大鼓，满城的人都抬头看。');
      }
      return;
  }
}

// ---------------------------------------------------------------- the little games' results
export function catchFish(c: { season: number; night: boolean; rain: boolean }): string {
  const list = FISH.filter(([, , when]) => when(c));
  let sum = 0;
  for (const [, w] of list) sum += w;
  let r = Math.random() * sum;
  for (const [id, w] of list) if ((r -= w) <= 0) return id;
  return 'crucian';
}
export function fishNow(s: Sim) {
  return { season: s.clock.season, night: s.clock.night, rain: weatherMix(s.weather, 'rain') + weatherMix(s.weather, 'storm') > 0.4 };
}
export function landFish(s: Sim, id: string) {
  const B = bag(s.progress);
  B[id] = (B[id] ?? 0) + 1;
  if (id === 'goldcarp') s.chron('你在雨夜里钓起了一尾金鲤。', '听说有人钓到了金鲤！河神要显灵了。');
  save(s.progress);
}
export function riddleDone(s: Sim, right: number) {
  done(s.progress).riddle = s.clock.day;
  if (right) earn(s, right * 6, `猜中 ${right} 个灯谜，得 ${right * 6} 文`);
  if (right >= 5) addTitle(s, '灯谜状元');
}
export function examDone(s: Sim, right: number) {
  const D = done(s.progress);
  D.exam = s.clock.year;
  const rank = EXAM_RANKS[Math.min(right, EXAM_RANKS.length - 1)];
  const coins = [0, 0, 20, 40, 80, 120, 200][Math.min(right, 6)];
  if (coins) earn(s, coins);
  s.chron(right >= 2 ? `你在永安城应试，中了${rank}。` : '你在永安城应试，落第了。', right >= 4 ? `听说今年的${rank}是青石村出去的，了不得！` : undefined);
  if (right >= 4) addTitle(s, rank);
  return rank;
}
export function caseDone(s: Sim, idx: number, right: boolean) {
  if (!right) {
    s.toast('判错了，真凶逍遥法外。（明天还可以再审）');
    done(s.progress)['casefail'] = s.clock.day;
    return;
  }
  done(s.progress)['case:' + idx] = 1;
  earn(s, 60);
  giveXp(s, 100);
  s.chron(`你断明了「${CASES[idx].title}」。`, `听说你在永安城断了「${CASES[idx].title}」，比青天大老爷还青天！`);
  if (CASES.every((_, i) => done(s.progress)['case:' + i])) addTitle(s, '铁面神断');
  save(s.progress);
}
export const nextCase = (s: Sim) => CASES.findIndex((_, i) => !done(s.progress)['case:' + i]);
/** the morning court: what's asked today */
export const debateToday = (s: Sim) => DEBATES[s.clock.day % DEBATES.length];
export function debateDone(s: Sim, k: number) {
  const d = debateToday(s), o = d.options[k];
  done(s.progress).debate = s.clock.day;
  s.policy = { id: o.policy, until: s.worldT + DAY_S * 3 };
  s.chron(`朝议：${o.say}。${o.note}`, o.note);
  s.toast(o.note);
  if (o.coins) earn(s, o.coins, `户部赏你 ${o.coins} 文`);
  giveXp(s, 50);
  save(s.progress);
}
export function diceRoll(s: Sim, bet: number, big: boolean) {
  const d = [1, 2, 3].map(() => 1 + Math.floor(Math.random() * 6));
  const sum = d[0] + d[1] + d[2];
  const triple = d[0] === d[1] && d[1] === d[2];
  const win = !triple && (big ? sum >= 11 : sum <= 10);
  s.progress.coins = purse(s.progress) + (win ? bet : -bet);
  save(s.progress);
  return { d, sum, triple, win };
}
export function touhuDone(s: Sim, hits: number) {
  const coins = [0, 0, 0, 15, 30, 80][hits];
  if (coins) earn(s, coins, `投壶中了 ${hits} 支，赏 ${coins} 文`);
  if (hits === 5) addTitle(s, '投壶圣手');
}

// ---------------------------------------------------------------- 演武: the general's guards spar with you
export function startSpar(s: Sim) {
  if (s.spar) return;
  s.spar = { wave: 0, t: 1.5, ids: [] };
  s.toast('霍铮：“演武三阵！点到为止，撑不住就认输（气血见底自动认输）。”');
}
const SPAR_AT = (k: number) => ctWorld(-14 + (k % 3) * 6, 32 + Math.floor(k / 3) * 4);
export function stepSpar(s: Sim, dt: number) {
  const sp = s.spar;
  if (!sp) return;
  const p = s.player;
  const kind = FOE_KINDS.find((k) => k.model === 'guard.glb') ?? FOE_KINDS[0];
  const alive = sp.ids.filter((id) => s.fighters[id].hp > 0);
  // lose: you're nearly down, or you walked off
  if (p.hp < p.maxHp * 0.15 || Math.hypot(p.pos[0] - CT_POS[0], p.pos[2] - CT_POS[1]) > 110) {
    for (const id of alive) s.fighters[id].hp = 0;
    p.hp = Math.max(p.hp, p.maxHp * 0.3);
    s.toast('霍铮：“好了，到此为止。回去再练练。”');
    s.spar = null;
    return;
  }
  if (alive.length) return;
  sp.t -= dt;
  if (sp.t > 0) return;
  if (sp.wave === 3) {
    s.spar = null;
    earn(s, 60, '演武三阵全胜！霍铮赏你 60 文');
    giveXp(s, 150);
    s.chron('你在永安城演武场连胜三阵。', '听说你在演武场把禁军打得落花流水，霍将军都夸你。');
    addTitle(s, '演武魁首');
    return;
  }
  const n = [1, 2, 2][sp.wave];
  const lvl = Math.max(1, s.progress.level - 1 + sp.wave);
  sp.ids = [];
  for (let k = 0; k < n; k++) {
    const [x, z] = SPAR_AT(k);
    const f = s.sparrer(k, kind, sp.wave === 2 ? '禁军教头' : '陪练禁军', lvl + (sp.wave === 2 ? 2 : 0), x, z);
    sp.ids.push(f.id);
  }
  sp.wave++;
  sp.t = 2;
  s.toast(`第${['一', '二', '三'][sp.wave - 1]}阵！`);
}

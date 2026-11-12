// 江湖 (the owner's second wave of play): what you forge and wear, the named wanderers on the bounty board (some of
// them, beaten, ride with you as companions), the village that grows as you defend it, the court's seasonal ring
// (擂台), what each season lets you do (ice on the river, fireflies, the autumn hunt) and a house of your own.
// Pure logic on the sim; ui/ and render/ show it.
import type { Sim } from './sim';
import type { Fighter } from './types';
import { FOE_KINDS } from './foes';
import { roadPoint } from './layout';
import { groundHeight, ICE, WATER_Y } from './world';
import { DAY_S } from './clock';
import { playerMaxHp, playerPower, save, type Progress } from './progress';
import { addTitle, bag, done, earn, giveXp, purse } from './play';
import { HOME, HOME_YARD, WALL_R } from './village';
import { ROOMS, inRoom } from './interiors';
import { CT_POS, ctWorld } from './court';
import { mapWater } from './mapsample';
import { okSpot, type Animal } from './animals';
import type { Touch } from './play';
import { SKILLS } from './skills';

/** the sim's share of all this, saved with the world */
export interface JH {
  /** what the village has been through with you, and how grown it is */
  vpts: number;
  vlvl: number;
  arena: { round: number; t: number; id: number } | null;
  arenaPool: number[];
  /** when each firefly glade has more to catch (world time) */
  glades: number[];
}
export const newJH = (): JH => ({ vpts: 0, vlvl: 0, arena: null, arenaPool: [], glades: [] });

// ================================================================ gear: forged at 张记铁铺, worn on three slots
export type Slot = 'weapon' | 'armor' | 'charm';
export const SLOT_NAME: Record<Slot, string> = { weapon: '兵器', armor: '护甲', charm: '佩饰' };
export const MAT_NAME: Record<string, string> = { iron: '铁料', hide: '兽皮', xuan: '玄铁' };
export interface Gear {
  id: string;
  slot: Slot;
  name: string;
  desc: string;
  coins: number;
  mats: Record<string, number>;
  /** your level before 张大锤 will make it */
  lvl: number;
  dmg?: number;
  def?: number;
  hp?: number;
  spd?: number;
  mp?: number;
  leech?: number;
  /** only won (the ring's prize), never forged */
  prize?: string;
}
export const GEAR: Gear[] = [
  { id: 'w1', slot: 'weapon', name: '精铁刀', desc: '伤害 +8%', coins: 40, mats: { iron: 3 }, lvl: 1, dmg: 0.08 },
  { id: 'w2', slot: 'weapon', name: '百炼钢刃', desc: '伤害 +16%', coins: 120, mats: { iron: 6, hide: 2 }, lvl: 8, dmg: 0.16 },
  { id: 'w3', slot: 'weapon', name: '玄铁重兵', desc: '伤害 +26%', coins: 300, mats: { iron: 8, xuan: 3 }, lvl: 16, dmg: 0.26 },
  { id: 'w4', slot: 'weapon', name: '天阙遗锋', desc: '伤害 +36%，照着守阙人的旧图打的', coins: 600, mats: { iron: 10, xuan: 8 }, lvl: 24, dmg: 0.36 },
  { id: 'a1', slot: 'armor', name: '鹿皮甲', desc: '受伤 -6%，气血 +6%', coins: 30, mats: { hide: 3 }, lvl: 1, def: 0.06, hp: 0.06 },
  { id: 'a2', slot: 'armor', name: '铁片甲', desc: '受伤 -12%，气血 +10%', coins: 110, mats: { iron: 5, hide: 3 }, lvl: 8, def: 0.12, hp: 0.1 },
  { id: 'a3', slot: 'armor', name: '玄铁锁子甲', desc: '受伤 -18%，气血 +15%', coins: 280, mats: { iron: 6, hide: 2, xuan: 3 }, lvl: 16, def: 0.18, hp: 0.15 },
  { id: 'a4', slot: 'armor', name: '金丝软甲', desc: '受伤 -24%，气血 +20%（擂台魁首的彩头）', coins: 0, mats: {}, lvl: 1, def: 0.24, hp: 0.2, prize: 'arena' },
  { id: 'c1', slot: 'charm', name: '疾风靴', desc: '跑得快一成', coins: 80, mats: { hide: 4 }, lvl: 4, spd: 0.1 },
  { id: 'c2', slot: 'charm', name: '回气玉佩', desc: '内力回得快一半', coins: 150, mats: { iron: 2, xuan: 1 }, lvl: 10, mp: 0.5 },
  { id: 'c3', slot: 'charm', name: '饮血护腕', desc: '伤敌时回一成的血', coins: 220, mats: { hide: 4, xuan: 2 }, lvl: 18, leech: 0.1 },
];
export const gearById = (id: string) => GEAR.find((g) => g.id === id);
export const owned = (P: Progress) => (P.gear ??= []);
export const equipped = (P: Progress) => (P.equip ??= {});
/** everything you wear, added up */
export function gearOf(P: Progress) {
  const out = { dmg: 0, def: 0, hp: 0, spd: 0, mp: 0, leech: 0 };
  for (const id of Object.values(P.equip ?? {})) {
    const g = id ? gearById(id) : undefined;
    if (!g) continue;
    out.dmg += g.dmg ?? 0;
    out.def += g.def ?? 0;
    out.hp += g.hp ?? 0;
    out.spd += g.spd ?? 0;
    out.mp += g.mp ?? 0;
    out.leech += g.leech ?? 0;
  }
  return out;
}
export const fullHp = (P: Progress) => Math.round(playerMaxHp(P.level) * (1 + gearOf(P).hp));
/** why 张大锤 won't make it now (null: he will) */
export function forgeBlock(s: Sim, g: Gear): string | null {
  const P = s.progress, B = bag(P);
  if (g.prize) return done(P)['prize:' + g.id] ? null : '只能在擂台上赢';
  if (owned(P).includes(g.id)) return '已经有了';
  if (P.level < g.lvl) return `${g.lvl} 级才压得住`;
  if (purse(P) < g.coins) return '铜钱不够';
  for (const [m, n] of Object.entries(g.mats)) if ((B[m] ?? 0) < n) return `${MAT_NAME[m]}不够`;
  return null;
}
export function forge(s: Sim, g: Gear): boolean {
  const P = s.progress, B = bag(P);
  if (forgeBlock(s, g)) return false;
  P.coins = purse(P) - g.coins;
  for (const [m, n] of Object.entries(g.mats)) B[m] -= n;
  owned(P).push(g.id);
  s.toast(`张大锤：“${g.name}，成了！”`);
  s.chron(`张大锤为你打了一件${g.name}。`);
  const cur = gearById(equipped(P)[g.slot] ?? '');
  if (!cur || score(g) > score(cur)) wear(s, g.id);
  save(P);
  return true;
}
const score = (g: Gear) => (g.dmg ?? 0) + (g.def ?? 0) + (g.hp ?? 0) * 0.5 + (g.spd ?? 0) + (g.mp ?? 0) * 0.3 + (g.leech ?? 0) * 1.5;
export function wear(s: Sim, id: string) {
  const P = s.progress, g = gearById(id);
  if (!g || !owned(P).includes(id)) return;
  const E = equipped(P);
  E[g.slot] = E[g.slot] === id ? undefined : id;
  const p = s.player, ratio = p.hp / p.maxHp;
  p.maxHp = fullHp(P);
  p.hp = Math.max(1, Math.round(p.maxHp * ratio));
  save(P);
}
/** what a fallen foe leaves: iron from most men, hide now and then, 玄铁 from bosses, the wanted and the 校尉 */
export function dropFrom(s: Sim, def: Fighter) {
  const P = s.progress, B = bag(P), a = def as any;
  const got: [string, number][] = [];
  if (a.rival !== undefined) got.push(['xuan', 1 + (def.level > 18 ? 1 : 0)], ['iron', 2]);
  else if (a.boss) got.push(['xuan', 2], ['iron', 3]);
  else if (/校尉|教头/.test(def.name)) got.push(['xuan', 1]);
  else {
    if (Math.random() < 0.32) got.push(['iron', 1]);
    if (Math.random() < 0.12) got.push(['hide', 1]);
  }
  if (!got.length) return;
  for (const [m, n] of got) B[m] = (B[m] ?? 0) + n;
  s.text(s.player, got.map(([m, n]) => `${MAT_NAME[m]} +${n}`).join('  '), '#d6c7a1');
}

// ================================================================ 悬赏榜: named wanderers on the roads
export interface Rival {
  id: string;
  name: string;
  /** FOE_KINDS index: their body and their moves */
  kind: number;
  lvl: number;
  bounty: number;
  /** beaten, they come along */
  join: boolean;
  road: number;
  r0: number;
  r1: number;
  /** what the board says */
  crime: string;
  meet: string;
  beat: string;
  joinLine?: string;
  /** what they tell you as you grow close (30, 60, 100) */
  story?: [string, string, string];
}
export const RIVALS: Rival[] = [
  {
    id: 'shimeng', name: '断刀客 · 石猛', kind: 0, lvl: 7, bounty: 80, join: true, road: 3, r0: 180, r1: 290,
    crime: '黑风寨叛徒，伪朝悬赏', meet: '又是来领赏的？我石猛的脑袋，没那么好拿！', beat: '好……好功夫。我在黑风寨砍了十年人，今天算是服了。',
    joinLine: '我欠这世道一条命。你要是信得过，我这把断刀跟你走。',
    story: ['我以前是黑风寨的二当家。雷彪抢粮那年，我把一车粮偷偷放回了村里，从此成了叛徒。', '这把刀是我爹的，断在雷彪手里。我留着它，提醒自己别再替恶人卖命。', '兄弟，往后你走到哪儿，我石猛就砍到哪儿。'],
  },
  { id: 'mabiao', name: '独眼狼 · 马彪', kind: 0, lvl: 9, bounty: 90, join: false, road: 6, r0: 210, r1: 320, crime: '拦路抢劫，杀过三个货郎', meet: '小子，把钱袋留下！', beat: '饶命！饶命啊大侠！' },
  {
    id: 'liufeiyan', name: '燕子镖 · 柳飞燕', kind: 1, lvl: 11, bounty: 120, join: true, road: 5, r0: 250, r1: 380,
    crime: '劫天阙税银，伪朝悬赏', meet: '站住！……哦，不是官兵。那你挡我道做什么？', beat: '行，算你厉害。官府悬赏我，是因为我劫了天阙的税银，分给了沿路的穷人。',
    joinLine: '跟着你，劫伪朝的车更方便。说好了，银子我分一半给穷人。',
    story: ['我爹是燕家的镖师，那年护送天阙的贡品，再也没回来。', '飞镖是跟我娘学的。她说女人家没刀，就得眼快手快。', '你知道吗，这是我头一回觉得，有人能护着我后背。'],
  },
  { id: 'housan', name: '鬼手 · 侯三', kind: 3, lvl: 13, bounty: 110, join: false, road: 0, r0: 200, r1: 310, crime: '偷遍青石集，还偷了县太爷的官印', meet: '嘿嘿，你的钱袋真沉。', beat: '我、我再也不偷了！' },
  {
    id: 'liaochen', name: '游方僧 · 了尘', kind: 2, lvl: 14, bounty: 100, join: true, road: 2, r0: 360, r1: 480,
    crime: '私医逃兵，伪朝悬赏', meet: '阿弥陀佛。施主若要动手，贫僧只好得罪了。', beat: '施主手下留情，贫僧谢过。悬赏贫僧的是伪朝，只因贫僧给逃兵治过伤。',
    joinLine: '贫僧会些医术。跟着施主，能少死几个人。（了尘会在你伤重时给你疗伤）',
    story: ['贫僧出家之前，是天阙山下的郎中。', '那年雪夜，贫僧给一个抱着婴儿的妇人包扎过伤口，后来再没见过她。', '施主，你那块玉，贫僧见过。那妇人怀里的孩子，就戴着它。'],
  },
  { id: 'huarui', name: '毒娘子 · 花蕊', kind: 1, lvl: 17, bounty: 160, join: false, road: 4, r0: 300, r1: 420, crime: '在井里下毒，害了一村人', meet: '好俊的小哥，过来让姐姐瞧瞧……', beat: '你……你竟然不怕我的毒。' },
  {
    id: 'mohan', name: '夜行客 · 莫寒', kind: 3, lvl: 19, bounty: 180, join: true, road: 6, r0: 480, r1: 600,
    crime: '影阁叛逃的刺客', meet: '（黑暗里一声冷笑）你走路的声音太响了。', beat: '……你是第一个看清我出手的人。',
    joinLine: '影阁的人在追杀我。跟着你，至少死得热闹些。',
    story: ['我从小在影阁长大，无面是我师父。', '他让我去杀一个守阙人的后人。我下不了手，就逃了。', '现在我知道了，那个人就是你。还好当年我没动手。'],
  },
  { id: 'jiaren', name: '铁算盘 · 贾仁', kind: 5, lvl: 21, bounty: 220, join: false, road: 1, r0: 420, r1: 560, crime: '替天阙收重税，逼死佃户', meet: '天阙的税，一文都不能少！', beat: '我的账本……我的银子……' },
  {
    id: 'hanlie', name: '逃营校尉 · 韩烈', kind: 4, lvl: 23, bounty: 240, join: true, road: 1, r0: 600, r1: 720,
    crime: '伪朝禁军逃将', meet: '伪朝的兵在追我，你也是来拿我的？那就来吧！', beat: '好身手。我当了二十年兵，没见过你这样的。',
    joinLine: '我不愿再给萧承乾卖命。你要打天阙，我认得上山的路。',
    story: ['我原是伪朝禁军的校尉，奉命去烧青石村。我把兵带回去了。', '萧承乾杀了不肯烧村的人。我逃出来，背上还留着他的剑伤。', '天阙的台阶有三千级，我数过。这一回，我陪你一级一级走上去。'],
  },
  { id: 'tujiu', name: '血手 · 屠九', kind: 0, lvl: 27, bounty: 320, join: false, road: 3, r0: 600, r1: 700, crime: '雪线下的人屠，杀人不眨眼', meet: '又来一个送死的。', beat: '不……可能……' },
];
export interface Comp {
  /** 好感 0 .. 100 */
  aff: number;
  mode: 'follow' | 'wait' | 'home';
  /** the day they last took a gift */
  gift?: number;
  /** how many of their story lines you've heard */
  told?: number;
  /** where they were told to wait */
  at?: [number, number];
}
export const comps = (P: Progress) => (P.comps ??= {});
export const PARTY_MAX = 2;
const rivalOf = (f: Fighter) => ((f as any).rival !== undefined ? RIVALS[(f as any).rival] : null);
export const allies = (s: Sim) => s.fighters.filter((f) => f.team === 'ally');
export const following = (s: Sim) => allies(s).filter((f) => rivalOf(f) && comps(s.progress)[rivalOf(f)!.id]?.mode === 'follow');

/** made with the sim: every wanted man on his road, or with you if he's joined; the village's militia */
export function makeJianghu(s: Sim) {
  const S = s as any, P = s.progress, D = done(P);
  RIVALS.forEach((r, i) => {
    const kind = FOE_KINDS[r.kind];
    const [x, z] = roadPoint(r.road, r.r0);
    const f = S.make('sect', kind.house, r.name, kind.model, r.lvl, x, z) as Fighter;
    const a = f as any;
    a.rival = i;
    a.foeKind = kind;
    a.elite = true;
    a.mode = 'rival';
    a.rt = Math.random();
    f.maxHp = f.hp = Math.round(f.maxHp * 2.6);
    f.home = [x, z];
    if (D['rival:' + r.id]) {
      if (r.join && comps(P)[r.id]) becomeAlly(s, f);
      else bench(f);
    }
  });
  // 乡勇: two village lads who hold the gates once the village has grown (a 散人's plain body)
  [
    ['乡勇 · 大柱', 92],
    ['乡勇 · 铁牛', 272],
  ].forEach(([name, deg]) => {
    const a = ((deg as number) * Math.PI) / 180, x = Math.cos(a) * (WALL_R - 6), z = Math.sin(a) * (WALL_R - 6);
    const f = S.make('ally', null, name, 'wanderer_m.glb', P.level, x, z) as Fighter;
    const m = f as any;
    m.militia = true;
    m.foeKind = FOE_KINDS[3];
    m.anchor = [x, z];
    f.home = [x, z];
  });
}
function bench(f: Fighter) {
  f.hp = 0;
  f.respawn = undefined;
  (f as any).benched = true;
}
function becomeAlly(s: Sim, f: Fighter) {
  const a = f as any;
  f.team = 'ally';
  a.mode = undefined;
  a.benched = false;
  a.comp = true;
  f.aggro = false;
  syncAlly(s, f);
  f.hp = f.maxHp;
  const c = comps(s.progress)[rivalOf(f)!.id];
  const at = anchorOf(s, f, c);
  f.pos = [at[0], groundHeight(at[0], at[1]), at[1]];
  f.home = [at[0], at[1]];
}
/** a companion's level and life follow yours */
function syncAlly(s: Sim, f: Fighter) {
  const P = s.progress;
  if (f.level === P.level && f.maxHp > 0 && (f as any).synced) return;
  const ratio = f.maxHp ? f.hp / f.maxHp : 1;
  f.level = P.level;
  f.maxHp = Math.round(playerMaxHp(P.level) * ((f as any).militia ? 0.6 : 0.85));
  f.hp = f.hp > 0 ? Math.max(1, Math.round(f.maxHp * ratio)) : 0;
  (f as any).synced = true;
}
export function allyPower(s: Sim, f: Fighter) {
  const r = rivalOf(f);
  const close = r && (comps(s.progress)[r.id]?.aff ?? 0) >= 100 ? 1.15 : 1;
  return playerPower(s.progress.level) * ((f as any).militia ? 0.35 : 0.55) * close;
}
/** where a companion stands when not following: your house's yard, or the square */
function anchorOf(s: Sim, f: Fighter, c?: Comp): [number, number] {
  const a = f as any;
  if (a.militia) return a.anchor;
  if (!c || c.mode === 'follow') {
    const p = s.player;
    return [p.pos[0] + 2, p.pos[2] + 2];
  }
  if (c.mode === 'wait' && c.at) return c.at;
  const k = RIVALS.indexOf(rivalOf(f)!);
  const base = s.progress.home ? HOME_YARD : ([5, 7] as [number, number]);
  return [base[0] + Math.cos(k * 1.9) * 2.2, base[1] + Math.sin(k * 1.9) * 2.2];
}

/** a wanted man walks his stretch of road; you come near and he greets you his way */
export function stepRivals(s: Sim, dt: number) {
  const p = s.player;
  for (const f of s.fighters) {
    const a = f as any;
    if (a.rival === undefined || f.team !== 'sect' || f.hp <= 0 || a.benched) continue;
    const r = RIVALS[a.rival];
    const d = s.dist(f, p);
    if (!a.met && d < 24 && p.hp > 0 && s.indoor < 0) {
      a.met = true;
      s.say(f.pos[0], f.pos[1] + 2.6, f.pos[2], r.meet);
      s.toast(`${r.name}：${r.meet}`);
    } else if (a.met && d > 70) a.met = false;
    if (f.aggro) continue;
    // up and down the road at a walk
    const L = Math.abs(r.r1 - r.r0);
    a.rt += (dt * 1.3) / L;
    const t = a.rt % 2, u = t < 1 ? t : 2 - t;
    const [x, z] = roadPoint(r.road, r.r0 + (r.r1 - r.r0) * u);
    f.home = [x, z];
    if (f.hp < f.maxHp) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.04 * dt);
  }
}
/** beaten: the bounty, the record, and the ones with a good heart get up and join you */
export function rivalBeaten(s: Sim, f: Fighter) {
  const r = rivalOf(f);
  if (!r) return;
  const P = s.progress, D = done(P);
  D['rival:' + r.id] = 1;
  s.say(f.pos[0], f.pos[1] + 2.4, f.pos[2], r.beat);
  earn(s, r.bounty, `了结悬赏：${r.name}，赏 ${r.bounty} 文`);
  s.chron(`你了结了悬赏榜上的${r.name}。`, `听说悬赏榜上的${r.name.split(' · ')[1]}栽在你手里了。`);
  addVillagePts(s, 1);
  if (!r.join) {
    f.respawn = undefined;
    return;
  }
  f.respawn = undefined;
  s.later(1.8, () => {
    const C = comps(P);
    const n = following(s).length;
    C[r.id] = { aff: 10, mode: n < PARTY_MAX ? 'follow' : 'home', told: 0 };
    (s as any).revive(f);
    becomeAlly(s, f);
    f.hp = Math.round(f.maxHp * 0.5);
    s.note = { title: `${r.name.split(' · ')[1]}愿随你同行`, text: `${r.beat}\n\n${r.joinLine}\n\n${C[r.id].mode === 'follow' ? '（他跟在你身边了。走近按 F 可以让他等着、回村，或者送礼。）' : `（身边已经有 ${PARTY_MAX} 位同伴，${r.name.split(' · ')[1]}先回村里等你。）`}` };
    save(P);
  });
}
/** 好感 grows in fights together and with gifts; at 30, 60 and 100 they tell you a little more */
export function warm(s: Sim, f: Fighter, by: number) {
  const r = rivalOf(f);
  if (!r) return;
  const c = comps(s.progress)[r.id];
  if (!c) return;
  c.aff = Math.min(100, c.aff + by);
  const told = c.told ?? 0;
  const at = [30, 60, 100];
  if (told < 3 && c.aff >= at[told] && r.story) {
    c.told = told + 1;
    s.note = { title: `${r.name.split(' · ')[1]}的心事（${told + 1} / 3）`, text: r.story[told] + (told === 2 ? `\n\n（生死之交：${r.name.split(' · ')[1]}的出手重了一成半）` : '') };
    if (told === 2) addTitle(s, `${r.name.split(' · ')[1]}的生死之交`);
  }
}
export const GIFTS = ['wine', 'peach', 'tanghulu', 'mooncake', 'venison', 'hare', 'tofu'];
export function giftTo(s: Sim, f: Fighter, item: string) {
  const r = rivalOf(f), P = s.progress, B = bag(P);
  if (!r || !(B[item] > 0)) return;
  const c = comps(P)[r.id];
  if (c.gift === s.clock.day) return s.toast('今天已经送过了');
  B[item]--;
  c.gift = s.clock.day;
  s.toast(`${r.name.split(' · ')[1]}收下了，看着挺高兴。`);
  warm(s, f, 12);
  save(P);
}
export function setMode(s: Sim, f: Fighter, mode: Comp['mode']) {
  const r = rivalOf(f), P = s.progress;
  if (!r) return;
  const c = comps(P)[r.id];
  if (mode === 'follow' && c.mode !== 'follow' && following(s).length >= PARTY_MAX) return s.toast(`身边最多带 ${PARTY_MAX} 位同伴`);
  c.mode = mode;
  if (mode === 'wait') c.at = [f.pos[0], f.pos[2]];
  save(P);
}

/** how a companion (or a militia lad) fights: stays by you, or holds his spot, and goes for whoever comes */
export function allyThink(s: Sim, f: Fighter, dt: number) {
  const a = f as any, p = s.player, P = s.progress;
  a.wish = [0, 0];
  if (f.hp <= 0) return;
  // the militia only stand once the village has grown
  if (a.militia) {
    a.away = s.jh.vlvl < 2;
    if (a.away) return;
  }
  if ((a.syncT = (a.syncT ?? 0) - dt) <= 0) {
    a.syncT = 1;
    a.synced = false;
    syncAlly(s, f);
  }
  const r = rivalOf(f);
  const c = r ? comps(P)[r.id] : undefined;
  const follow = !!c && c.mode === 'follow';
  // with you: into no room (they wait outside, out of sight) and never left far behind
  if (follow) {
    const inside = s.indoor >= 0;
    if (inside !== !!a.away) {
      a.away = inside;
      if (!inside) snapBehind(s, f);
    }
    if (a.away) return;
    if (s.dist(f, p) > 48 && p.hp > 0) snapBehind(s, f);
  } else a.away = false;
  const anchor: [number, number] = follow ? [p.pos[0], p.pos[2]] : anchorOf(s, f, c);
  // whom to fight
  let t: Fighter | null = null, bd = Infinity;
  for (const o of s.fighters) {
    if (o.team !== 'sect' || o.hp <= 0 || (o as any).benched || (o as any).away || (o as any).spar || (o as any).arena) continue;
    const fromA = Math.hypot(o.pos[0] - anchor[0], o.pos[2] - anchor[1]);
    if (follow ? fromA > 17 : fromA > 24) continue;
    const mine = s.dist(o, f);
    if (follow ? !o.aggro && mine > 7 : !o.aggro && (o as any).mode !== 'raid') continue;
    if (mine < bd) {
      bd = mine;
      t = o;
    }
  }
  const kind = s.kindOf(f);
  // the monk sees to your wounds
  if (kind?.house === 'fanyin' && follow && p.hp > 0 && p.hp < p.maxHp * 0.5 && (f.cds.mend ?? 0) <= 0 && s.dist(f, p) < 14) {
    f.cds.mend = 14;
    const n = Math.round(p.maxHp * 0.2);
    p.hp = Math.min(p.maxHp, p.hp + n);
    s.text(p, `了尘疗伤 +${n}`, '#86efac');
    s.vfx('ring', [p.pos[0], p.pos[1] + 0.1, p.pos[2]], 2.2, '#fde68a', 0.6, 0.1, 0.5);
  }
  if (!t) {
    // back to his place: a step to your side and behind, or his own spot
    let gx = anchor[0], gz = anchor[1];
    if (follow) {
      const k = following(s).indexOf(f);
      const side = k % 2 ? 1 : -1, yaw = p.yaw;
      const bx = Math.sin(yaw), bz = Math.cos(yaw); // behind you
      gx += bx * 2.4 + Math.cos(yaw) * side * 1.8;
      gz += bz * 2.4 - Math.sin(yaw) * side * 1.8;
    }
    const dx = gx - f.pos[0], dz = gz - f.pos[2], d = Math.hypot(dx, dz);
    if (d > (follow ? 1.2 : 0.8)) a.wish = [(dx / d) * Math.min(1, d / 3 + 0.25), (dz / d) * Math.min(1, d / 3 + 0.25)];
    else if (!follow) f.yaw = Math.atan2(f.pos[0], f.pos[2]); // facing out of the village
    if (f.hp < f.maxHp) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.03 * dt);
    return;
  }
  const ranged = !!kind?.ranged;
  const d = bd, dx = (t.pos[0] - f.pos[0]) / (d || 1), dz = (t.pos[2] - f.pos[2]) / (d || 1);
  const keep = ranged ? 7 : 1.5;
  if (d > keep + (ranged ? 3 : 0.3)) a.wish = [dx, dz];
  else if (!ranged) a.wish = [-dz * 0.3 * Math.sin(f.id), dx * 0.3 * Math.sin(f.id)];
  f.aiT = (f.aiT ?? 0) - dt;
  if (!s.free(f) || f.aiT > 0) return;
  s.faceTo(f, t.pos[0], t.pos[2]);
  if (kind) {
    const usable = kind.skills.filter((id, k) => f.level >= 1 + k * 4 && (f.cds[id] ?? 0) <= 0 && f.mp >= SKILLS[id].mp && d <= SKILLS[id].aiRange);
    if (usable.length && Math.random() < 0.3) {
      const id = usable[Math.floor(Math.random() * usable.length)];
      if (s.cast(f, id)) {
        f.aiT = 1.8 + Math.random() * 1.2;
        return;
      }
    }
  }
  if (ranged ? d < 15 : d < 2.9) {
    s.attack(f, ranged && d > 3);
    f.aiT = ranged ? 1.2 + Math.random() : 0.7 + Math.random() * 0.6;
  }
}
function snapBehind(s: Sim, f: Fighter) {
  const p = s.player;
  const x = p.pos[0] + Math.sin(p.yaw) * 2.5, z = p.pos[2] + Math.cos(p.yaw) * 2.5;
  f.pos = [x, groundHeight(x, z), z];
  f.vel = [0, 0, 0];
}
/** a companion goes down: up again by your side after a while */
export function allyDown(s: Sim, f: Fighter) {
  f.respawn = (f as any).militia ? 40 : 20;
  if (!(f as any).militia) s.toast(`${f.name.split(' · ')[1] ?? f.name}受了重伤，${f.respawn} 秒后缓过来`);
}
export function allyUp(s: Sim, f: Fighter) {
  const r = rivalOf(f);
  const c = r ? comps(s.progress)[r.id] : undefined;
  if (c?.mode === 'follow') {
    snapBehind(s, f);
  } else {
    const [x, z] = anchorOf(s, f, c);
    f.pos = [x, groundHeight(x, z), z];
  }
  f.hp = Math.round(f.maxHp * 0.6);
}

// ================================================================ 村子: it grows as you stand up for it
export const VLEVELS = [
  { at: 0, name: '青石村', note: '' },
  { at: 6, name: '青石村 · 兴旺', note: '山贼来一回败一回，附近的人都说青石村有人护着。逃难的人搬了进来，豆腐坊和货郎摊开张了。' },
  { at: 14, name: '青石镇', note: '村子成了镇子：药铺、酒楼开了门，说书先生在广场上开讲，两个后生自愿当了乡勇，夜里守着寨门。' },
  { at: 26, name: '青石城', note: '木寨墙换成了石墙，寨门上挂起了“青石城”的匾。四面八方的人都来投奔，连永安城的老翰林也搬来养老。' },
];
export const levelFor = (pts: number) => VLEVELS.reduce((l, v, i) => (pts >= v.at ? i : l), 0);
export function addVillagePts(s: Sim, n: number) {
  const J = s.jh;
  J.vpts = Math.max(0, J.vpts + n);
  const lvl = levelFor(J.vpts);
  if (lvl > J.vlvl) {
    J.vlvl = lvl;
    const v = VLEVELS[lvl];
    s.note = { title: `村子变了 · ${v.name}`, text: v.note };
    s.chron(`青石村兴旺起来，成了${v.name}。`, `如今的${v.name.split(' · ')[0]}，可不是从前那个破村子了。`);
  }
}

// ================================================================ 擂台: the court's ring, the second day of each season
const ARENA_FOES: [number, string][] = [
  [0, '开山手 · 牛二'],
  [1, '穿云燕 · 白露'],
  [3, '无影脚 · 罗七'],
  [2, '铁头陀 · 慧刚'],
  [4, '禁军教头 · 武威'],
];
export const ARENA_AT = (): [number, number] => ctWorld(-8, 36);
export function makeArenaPool(s: Sim) {
  for (const [k, name] of ARENA_FOES) {
    const kind = FOE_KINDS[k];
    const f = (s as any).make('sect', kind.house, name, kind.model, 1, CT_POS[0], CT_POS[1] - 60) as Fighter;
    const a = f as any;
    f.hp = 0;
    a.benched = true;
    a.arena = true;
    a.foeKind = kind;
    s.jh.arenaPool.push(f.id);
  }
}
const seasonKey = (s: Sim) => `arena:${s.clock.year}:${s.clock.season}`;
export function arenaState(s: Sim): 'open' | 'done' | 'closed' {
  const c = s.clock;
  if (done(s.progress)[seasonKey(s)]) return 'done';
  return c.yday % 2 === 1 && c.hour >= 8 && c.hour < 20 ? 'open' : 'closed';
}
export function startArena(s: Sim) {
  if (s.jh.arena || arenaState(s) !== 'open' || s.spar) return;
  s.jh.arena = { round: 0, t: 1.5, id: -1 };
  s.toast('包金刚：“擂台五阵，一阵一个！打赢一阵赏三十文，撑不住了自动认输。”');
}
export function stepArena(s: Sim, dt: number) {
  const A = s.jh.arena;
  if (!A) return;
  const p = s.player;
  const cur = A.id >= 0 ? s.fighters[A.id] : null;
  if (p.hp < p.maxHp * 0.15 || Math.hypot(p.pos[0] - CT_POS[0], p.pos[2] - CT_POS[1]) > 110) {
    if (cur) {
      cur.hp = 0;
      (cur as any).benched = true;
    }
    p.hp = Math.max(p.hp, p.maxHp * 0.3);
    s.toast(`包金刚：“胜负已分！你守了 ${A.round - 1 < 0 ? 0 : A.round - (cur && cur.hp > 0 ? 1 : 0)} 阵，下季再来！”`);
    done(s.progress)[seasonKey(s)] = 1;
    save(s.progress);
    s.jh.arena = null;
    return;
  }
  if (cur && cur.hp > 0) return;
  if (cur && A.round > 0 && cur.hp <= 0 && !(cur as any).paid) {
    (cur as any).paid = true;
    (cur as any).benched = true;
    earn(s, 30);
  }
  A.t -= dt;
  if (A.t > 0) return;
  if (A.round === ARENA_FOES.length) {
    const P = s.progress;
    done(P)[seasonKey(s)] = 1;
    s.jh.arena = null;
    earn(s, 150, '擂台五阵全胜！包金刚亲手给你挂上红绸，赏 150 文');
    bag(P).xuan = (bag(P).xuan ?? 0) + 2;
    giveXp(s, 300);
    addTitle(s, '擂台魁首');
    if (!done(P)['prize:a4']) {
      done(P)['prize:a4'] = 1;
      owned(P).push('a4');
      s.toast('彩头：金丝软甲（在包袱的装备里穿上）');
    }
    s.chron('你在永安城的擂台上连胜五阵，夺了魁首。', '永安城擂台的魁首，听说就是你！');
    save(P);
    return;
  }
  const id = s.jh.arenaPool[A.round];
  const f = s.fighters[id];
  const [x, z] = ARENA_AT();
  const lvl = Math.max(1, s.progress.level - 1 + A.round);
  f.level = lvl;
  f.maxHp = Math.round((180 + lvl * 55) * (1 + A.round * 0.25));
  f.home = [x, z];
  (f as any).benched = false;
  (f as any).paid = false;
  (s as any).revive(f);
  f.aggro = true;
  A.id = id;
  A.round++;
  A.t = 2.5;
  s.toast(`第${['一', '二', '三', '四', '五'][A.round - 1]}阵：${f.name}（${lvl} 级）`);
}

// ================================================================ the seasons' own things
/** where fireflies gather on summer nights: dry banks near water */
export const GLADES: [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let k = 0; out.length < 6 && k < 600; k++) {
    const a = ((k * 97.3) % 360) * (Math.PI / 180), r = 80 + ((k * 41) % 300);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!okSpot(x, z)) continue;
    let wet = false;
    for (let j = 0; j < 8 && !wet; j++) wet = mapWater(x + Math.cos(j * 0.785) * 9, z + Math.sin(j * 0.785) * 9) > 0.3;
    if (wet && !out.some(([ox, oz]) => Math.hypot(ox - x, oz - z) < 60)) out.push([x, z]);
  }
  return out;
})();
export const firefliesOut = (s: Sim) => s.clock.season === 1 && s.clock.night;
/** the river freezes over in deep winter and you walk on it */
export function stepSeasons(s: Sim, dt: number) {
  const c = s.clock;
  const want = c.season === 3 && c.seasonT > 0.15 && c.seasonT < 0.95 ? 1 : 0;
  ICE.amt += Math.sign(want - ICE.amt) * Math.min(Math.abs(want - ICE.amt), dt / 60);
  const was = ICE.on;
  ICE.on = ICE.amt > 0.8;
  if (ICE.on && !was) s.chron('河面结了冰，能走人了。', '河冻上了！渔翁在冰上凿了个窟窿钓鱼。');
  // the hunt's kills come back after half a day
  for (const an of s.animals) {
    const A = an as any;
    if (A.dead && s.worldT > A.dead) {
      A.dead = 0;
      an.x = an.home[0];
      an.z = an.home[1];
      an.state = 'graze';
    }
  }
}
export const HUNT_KINDS = ['deer', 'rabbit', 'boar'];
/** the game in bow shot: in front of you, within 26 m */
export function huntTarget(s: Sim): { a: Animal; d: number } | null {
  if (!(bag(s.progress).bow > 0) || s.indoor >= 0) return null;
  const p = s.player, fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  let best: { a: Animal; d: number } | null = null;
  for (const a of s.animals) {
    if (!HUNT_KINDS.includes(a.kind) || (a as any).dead || (a as any).caught) continue;
    const dx = a.x - p.pos[0], dz = a.z - p.pos[2], d = Math.hypot(dx, dz);
    if (d > 26 || d < 1 || (dx * fx + dz * fz) / d < 0.55) continue;
    if (!best || d < best.d) best = { a, d };
  }
  return best;
}
export function shootGame(s: Sim, a: Animal) {
  const p = s.player, P = s.progress, B = bag(P);
  const d = Math.hypot(a.x - p.pos[0], a.z - p.pos[2]);
  const autumn = s.clock.season === 2;
  const chance = Math.max(0.15, Math.min(0.92, 1.1 - d / 28 + (autumn ? 0.12 : 0) - (a.kind === 'rabbit' ? 0.15 : 0)));
  s.faceTo(p, a.x, a.z);
  s.vfx('sound', 'click');
  if (Math.random() > chance) {
    s.toast('一箭射偏了！');
    if (a.kind === 'boar') {
      a.state = 'charge';
      a.t = 3;
    } else {
      a.state = 'flee';
      a.t = 3;
      a.yaw = Math.atan2(a.x - p.pos[0], a.z - p.pos[2]);
    }
    return;
  }
  (a as any).dead = s.worldT + DAY_S * 0.5;
  a.speed = 0;
  const k = autumn ? 2 : 1;
  const got: [string, number][] = a.kind === 'deer' ? [['hide', k], ['venison', 1]] : a.kind === 'boar' ? [['hide', 2 * k]] : [['hare', k]];
  for (const [m, n] of got) B[m] = (B[m] ?? 0) + n;
  const NAME: Record<string, string> = { hide: '兽皮', venison: '鹿肉', hare: '野兔' };
  s.toast(`射中了！${got.map(([m, n]) => `${NAME[m]} ×${n}`).join('，')}${autumn ? '（秋猎，收获加倍）' : ''}`);
  if (!done(P).hunt) {
    done(P).hunt = 1;
    s.chron('你头一回进山打猎，带回了猎物。');
  }
  save(P);
}

// ================================================================ your own house in the village
export const HOME_PRICE = 300;
export const homeRoom = () => ROOMS.find((r) => r.theme === 'home')!;
export function buyHome(s: Sim) {
  const P = s.progress;
  if (P.home) return;
  if (purse(P) < HOME_PRICE) return s.toast(`空宅要 ${HOME_PRICE} 文，你还差 ${HOME_PRICE - purse(P)} 文`);
  P.coins = purse(P) - HOME_PRICE;
  P.home = true;
  s.note = { title: '你有家了', text: '石伯把钥匙交到你手里：“这屋子空了二十年，原是守阙人留给自家人的。如今，物归原主。”\n\n（屋里的床可以睡到天亮，兵器架上换装备；留在村里的同伴会在你家院子里等。）' };
  s.chron('你在青石村买下了一间屋子，有了自己的家。', '听说你在村里安了家？好，好，往后就是一家人了。');
  save(P);
}
export function bedSpot(): [number, number] {
  const r = homeRoom();
  const b = r.furn.find((f) => f.k === 'bed')!;
  return inRoom(r, b.x, b.z);
}
export function rackSpot(): [number, number] {
  const r = homeRoom();
  const b = r.furn.find((f) => f.k === 'rack')!;
  return inRoom(r, b.x, b.z);
}
/** sleep: through the night to dawn, or a few hours by day; never with raiders on the way */
export function sleep(s: Sim) {
  const c = s.clock, W = s.war;
  const raidSoon = (W.raid && W.raid.stage !== 'over') || ((c.day % 2 === 1 || W.raidDay < 0) && c.hour >= 16.5 && W.raidDay !== c.day);
  if (raidSoon) return s.toast('外头不太平，今晚怕是有人要来，睡不着。');
  const h = c.hour;
  const hours = h >= 18 ? 24 - h + 6 : h < 6 ? 6 - h : 3;
  s.worldT += (hours / 24) * DAY_S;
  s.healFull();
  s.fadeT = 1.2;
  s.toast(hours > 3 ? '一觉睡到天亮，浑身是劲。' : '小睡了一会儿，精神多了。');
}
export const HOME_DOOR = HOME;
export { WATER_Y };

// ================================================================ what F does here (beside play.ts's touches)
/** the house's sale board, the bed and the rack inside, a firefly glade on a summer night, game in bow shot */
export function jhTouch(s: Sim): Touch | null {
  const p = s.player.pos, P = s.progress;
  if (s.riding >= 0) return null;
  if (s.indoor >= 0) {
    if (ROOMS[s.indoor]?.theme !== 'home') return null;
    const [bx, bz] = bedSpot(), [rx, rz] = rackSpot();
    if (Math.hypot(bx - p[0], bz - p[2]) < 1.9) return { kind: 'bed', id: 0, label: s.clock.hour >= 18 || s.clock.hour < 6 ? '睡到天亮' : '睡一会儿' };
    if (Math.hypot(rx - p[0], rz - p[2]) < 1.9) return { kind: 'rack', id: 0, label: '兵器架 · 换装备' };
    return null;
  }
  if (!P.home && Math.hypot(HOME.door[0] - p[0], HOME.door[1] - p[2]) < 2.6) return { kind: 'deed', id: 0, label: `买下这间空宅 · ${HOME_PRICE}文` };
  if (firefliesOut(s))
    for (let i = 0; i < GLADES.length; i++) {
      const [x, z] = GLADES[i];
      if ((s.jh.glades[i] ?? 0) <= s.worldT && Math.hypot(x - p[0], z - p[2]) < 4) return { kind: 'firefly', id: i, label: '抓萤火虫' };
    }
  const h = huntTarget(s);
  if (h) return { kind: 'hunt', id: h.a.id, label: `拉弓射${{ deer: '鹿', rabbit: '兔', boar: '野猪' }[h.a.kind as 'deer']}（${Math.round(h.d)} 米）` };
  return null;
}
export const JH_TOUCH = ['deed', 'bed', 'rack', 'firefly', 'hunt'];
export function doJhTouch(s: Sim, t: Touch) {
  const P = s.progress, B = bag(P);
  switch (t.kind) {
    case 'deed':
      return buyHome(s);
    case 'bed':
      return sleep(s);
    case 'rack':
      s.game = { kind: 'gear' };
      return;
    case 'firefly':
      s.jh.glades[t.id] = s.worldT + DAY_S * 0.4;
      B.firefly = (B.firefly ?? 0) + 1;
      s.toast('捧了一把萤火虫，装进纱囊里，一闪一闪的。');
      save(P);
      return;
    case 'hunt': {
      const a = s.animals.find((x) => x.id === t.id);
      if (a) shootGame(s, a);
      return;
    }
  }
}

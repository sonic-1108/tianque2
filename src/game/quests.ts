// The main story: the village elder sends you out den by den, nearest first, back to him every few dens, out to the
// last boss at the far edge. Built from the den layout, so it always matches the map.
import { DENS, FOE_KINDS, bossNameOf, menNameOf } from './foes';

export type Goal =
  | { type: 'learn' } // learn a first move (K)
  | { type: 'talk'; npc: NpcRole } // go and talk to someone
  | { type: 'kill'; den: number; count: number } // beat this many at a den
  | { type: 'boss'; den: number } // beat the den's boss
  | { type: 'level'; level: number };

export type NpcRole = 'elder' | 'doctor' | 'teller';

export interface Quest {
  title: string;
  giver: NpcRole; // who gives it (and takes it back)
  intro: string; // what they say when they give it
  done: string; // what they say when you bring it back
  goal: Goal;
  xp: number;
  /** the first quest of a chapter: its title and the narration shown on the chapter card */
  chapter?: { name: string; text: string };
}

export const NPCS: { role: NpcRole; name: string; model: string; x: number; z: number; greet: string }[] = [
  { role: 'elder', name: '村长 · 石伯', model: 'dixian.glb', x: 0, z: -9, greet: '天冷了，山上的火光一夜比一夜多。' },
  { role: 'doctor', name: '郎中 · 白芷', model: 'monk.glb', x: 9, z: 4, greet: '受伤了就来找我，药钱先欠着。' },
  { role: 'teller', name: '说书人', model: 'emperor.glb', x: -9, z: 4, greet: '客官，听段江湖事？' },
];

/** what the elder says about each kind of outlaw, ring by ring (the story moves on as you go further out) */
const KIND_LINES: string[][] = [
  ['那伙山贼抢了李家的粮，还烧了草垛', '那伙山贼使的刀法大开大合，像是狂刃门的路数', '那帮山贼是狂刃门叛出来的老手，一刀能劈开石头'],
  ['有人在路上放冷镖，商队都不敢走了', '那伙飞镖客的针上淬了麻药，是暗器门的手法', '暗器门的叛徒聚在那儿，百步之外取人眼睛'],
  ['来了几个野和尚，化缘化到抢的地步', '那伙野和尚掌力很重，梵音寺的功夫没学全就下了山', '那几个和尚念的是梵音寺的六字真言，一开口人就站不稳'],
  ['夜里有刺客摸进村子，偷了刘家的牛', '那伙刺客会遁地，是影刃的身法', '影刃的刺客在那儿扎了根，专替人杀人'],
  ['有伙人穿着破官服，自称"奉旨收粮"', '那伙伪朝兵喊着"奉天承运"，像是真有人给他们封了官', '那儿驻着伪朝的兵，列阵如军，盔甲在山口晃眼'],
  ['有个骗子拿假银票换了全村的鸡', '那伙骗子撒钱买命，钱上沾着毒粉', '那帮人做的是买空卖空的大买卖，交易所的人都怕他们'],
  ['林子里来了个妖道，说能点石成金', '那伙妖道吸人精气，地仙门的禁术', '妖道们在那儿布了阵，草木都枯了'],
];

const byLevel = DENS.map((d, i) => ({ d, i })).sort((a, b) => a.d.level - b.d.level);

export const QUESTS: Quest[] = (() => {
  const q: Quest[] = [];
  // ---------------- 序章 · 青石村
  q.push({
    title: '晨钟',
    giver: 'elder',
    chapter: {
      name: '序章 · 青石村',
      text: '百年前，七家在西北雪山之巅筑起天阙，歃血为盟，守护江湖。\n二十年前的一个雪夜，天阙的钟声断了，七家从此各奔东西。\n那年冬天，青石村的石伯在村口捡到一个襁褓，里面裹着一柄断剑和一块刻着"阙"字的玉佩。\n那个孩子，就是你。',
    },
    intro: '醒了？昨夜北边山上又有火光。你从小跟着我练剑，可还没正经学过一招。按 K 打开技能树，用技能点学一招防身，学会了回来找我。',
    done: '好，有几分样子了。剑是断的，人不能软。',
    goal: { type: 'learn' },
    xp: 60,
  });
  q.push({
    title: '郎中的药',
    giver: 'elder',
    intro: '出去之前，先去找郎中白芷要些伤药。把你那块玉佩也给她看看，她读的书多。',
    done: '白芷说那玉佩她在书里见过？……先别想了，眼前的事要紧。',
    goal: { type: 'talk', npc: 'doctor' },
    xp: 40,
  });
  // ---------------- the dens, ring by ring
  const CH = [
    { name: '第一章 · 山雨欲来', text: '这一年，七条官道上的贼人忽然多了起来。\n他们抢粮、放火、劫商队，像是有人在背后催着。\n石伯把断剑交还给你：「去吧，先把村子周围清干净。」' },
    { name: '第二章 · 七家散落', text: '雷彪身上那封信，印着一个金色的"阙"字：\n「奉天阙敕令，收七家散众，听候调遣。」\n天阙沉寂了二十年，如今却在招兵买马。越往外走，你越发现，那些贼人使的都是七家的功夫。' },
    { name: '第三章 · 雪线之下', text: '玄阴真人死前笑着说：「天阙上坐着的，是皇帝。」\n白芷翻出一本旧医书，书里画着你那块玉佩：天阙守阙人的信物。\n守阙人一家，二十年前那一夜，全死了。\n只有一个婴儿，不知所踪。' },
  ];
  const BOSS_DONE = [
    '雷彪倒了？他怀里搜出一封信……你自己看吧。「奉天阙敕令」，天阙二十年没有声音了，怎么会？',
    '玄阴真人……他说天阙上坐着皇帝？天阙从来不是谁的宫殿，那是七家共守的地方。',
    '无面说他当年抱过一个婴儿下山？……孩子，你过来，有些事我该告诉你了。',
  ];
  const BOSS_INTRO = [
    (dir: string, d: (typeof DENS)[number]) => `${dir}那伙山贼的头子叫雷彪，人称黑风寨主（${d.level + 3} 级）。这一圈的贼都听他的，打倒他，村子周围就太平了。`,
    (dir: string, d: (typeof DENS)[number]) => `${dir}的林子里住着个玄阴真人（${d.level + 3} 级），中环的贼人都给他上供。他知道天阙的事，去问问他，问不出就打。`,
    (dir: string, d: (typeof DENS)[number]) => `${dir}有个杀手头子叫无面（${d.level + 3} 级），影阁之主。听说二十年前那一夜，他就在天阙上。`,
  ];
  let ring = -1;
  let inRing = 0;
  for (const { d, i } of byLevel) {
    if (d.peak) continue;
    if (d.ring !== ring) {
      ring = d.ring;
      inRing = 0;
      if (ring === 2) q.push({ title: '登峰造极', giver: 'elder', intro: '最外一圈的贼人都是七家的叛徒，个个是狠角色。先把自己练到 18 级再去，别急着送命。', done: '你出剑的样子，越来越像一个人了。', goal: { type: 'level', level: 18 }, xp: 300 });
    }
    const kind = FOE_KINDS[d.kind];
    const dir = dirName(d.x, d.z);
    const chapter = inRing === 0 ? CH[ring] : undefined;
    inRing++;
    if (d.boss) {
      q.push({
        title: `擒贼擒王 · ${bossNameOf(d)}`,
        giver: 'elder',
        intro: BOSS_INTRO[ring](dir, d),
        done: BOSS_DONE[ring],
        goal: { type: 'boss', den: i },
        xp: 200 + d.level * 30,
      });
      if (ring === 0) q.push({ title: '天阙旧事', giver: 'elder', intro: '天阙的事，说书人比我清楚。去听他讲讲。', done: '他讲的那些，有一半是真的。剩下一半，等你自己去看。', goal: { type: 'talk', npc: 'teller' }, xp: 80 });
      if (ring === 1) q.push({ title: '玉佩', giver: 'elder', intro: '白芷说她查到了那块玉佩的来历，让你过去一趟。', done: '……守阙人的信物。我早该想到的。', goal: { type: 'talk', npc: 'doctor' }, xp: 120 });
    } else {
      q.push({
        title: `清剿${menNameOf(d)}`,
        giver: 'elder',
        chapter,
        intro: `${dir}${KIND_LINES[d.kind][ring]}（${d.level} 级）。去打倒他们 ${d.count} 个人。`,
        done: ring === 0 ? '干得漂亮。' : ring === 1 ? '又是七家的功夫……这些人原本都是名门弟子。' : '好。离天阙越来越近了。',
        goal: { type: 'kill', den: i, count: d.count },
        xp: 60 + d.level * 18,
      });
    }
  }
  // ---------------- 终章 · 天阙
  const tq = DENS.findIndex((d) => d.peak);
  q.push({
    title: '身世',
    giver: 'elder',
    chapter: {
      name: '终章 · 天阙',
      text: '二十年前，天子一脉的萧承乾想独占天阙，在一个雪夜杀了守阙人满门。\n影阁的无面奉命斩草除根，却在最后一刻抱着婴儿下了山，把他留在一个小村的村口。\n萧承乾自立为帝，封了天阙的钟。\n如今他要用七家的叛徒，把整个江湖收进他的天阙。',
    },
    intro: '你是守阙人的孩子。这些年我没说，是怕你去送死。可你已经不是当年那个孩子了。去练到 28 级，然后上天阙，把钟敲响。',
    done: '去吧。路在西北，沿着官道一直走，走到雪线下的那座山。山道只有一条。',
    goal: { type: 'level', level: 28 },
    xp: 400,
  });
  q.push({
    title: '天阙钟鸣',
    giver: 'elder',
    intro: '西北官道的尽头，悬崖上那座宫殿就是天阙。萧承乾在那儿等着，金甲卫守着山门。孩子，活着回来。',
    done: '……听见了。二十年了，天阙的钟又响了。整个江湖都听见了。',
    goal: { type: 'boss', den: tq },
    xp: 2000,
  });
  q.push({ title: '散人之道', giver: 'elder', intro: '你学过七家的招，一家都不属于。到了三十级，按 K 可以转职，学一家的大招。也可以一直做个散人。路怎么走，你自己定。', done: '青石村记住你了。天阙的钟，往后由你来敲。', goal: { type: 'level', level: 30 }, xp: 500 });
  return q;
})();

function dirName(x: number, z: number) {
  const a = Math.atan2(-z, x); // east 0, north +90
  const names = ['东边', '东北边', '北边', '西北边', '西边', '西南边', '南边', '东南边'];
  return names[(Math.round(a / (Math.PI / 4)) + 8) % 8];
}

/** where the current goal is on the map (null = in the village / anywhere) */
export function goalPos(g: Goal): [number, number] | null {
  if (g.type === 'kill' || g.type === 'boss') return [DENS[g.den].x, DENS[g.den].z];
  if (g.type === 'talk') {
    const n = NPCS.find((x) => x.role === g.npc)!;
    return [n.x, n.z];
  }
  return null;
}

export const TELLER_LINES = [
  '天阙？那是七家一起修的。山门朝东，钟楼在最高处，钟一响，七条官道上都听得见。',
  '七家：狂刃、暗器、梵音、影刃、天子、交易、地仙。当年谁也不服谁，可钟一响，全都上山。',
  '二十年前那一夜，雪下得很大。第二天，天阙的钟就再也没响过。',
  '西边是雪山，越往深处贼人越凶，没到二十级别去送命。',
  '东边是河，过河要蹚水，水里走得慢，被追着打可别往河里跑。',
  '每圈山贼窝都有个头目，头目窝的旗子是黑的。',
  '路边有凉亭，迷路了就找凉亭，顺着路回村。',
  '听说有个散人学全了七家的招，三十级转了职，大招一出天地变色。',
  '打不过就闪避，Shift 一滚，刀剑近不了身。',
];

/** where the player should go right now: the goal, or back to whoever gives / takes the quest */
export function questTarget(sim: { progress: { quest: { idx: number; state: string } } }): [number, number] | null {
  const Q = sim.progress.quest;
  const q = QUESTS[Q.idx];
  if (!q) return null;
  if (Q.state !== 'active') {
    const n = NPCS.find((x) => x.role === q.giver)!;
    return [n.x, n.z];
  }
  return goalPos(q.goal);
}

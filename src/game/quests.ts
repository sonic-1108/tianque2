// The main story: the village elder sends you out den by den, nearest first, back to him every few dens, out to the
// last boss at the far edge. Built from the den layout, so it always matches the map.
import { DENS, FOE_KINDS } from './foes';

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
}

export const NPCS: { role: NpcRole; name: string; model: string; x: number; z: number; greet: string }[] = [
  { role: 'elder', name: '村长 · 石伯', model: 'dixian.glb', x: 0, z: -9, greet: '年轻人，青石村这些年被山贼闹得不得安生。' },
  { role: 'doctor', name: '郎中 · 白芷', model: 'monk.glb', x: 9, z: 4, greet: '受伤了就来找我，药钱先欠着。' },
  { role: 'teller', name: '说书人', model: 'emperor.glb', x: -9, z: 4, greet: '客官，听段江湖事？' },
];

const byLevel = DENS.map((d, i) => ({ d, i })).sort((a, b) => a.d.level - b.d.level);

export const QUESTS: Quest[] = (() => {
  const q: Quest[] = [];
  q.push({
    title: '初入江湖',
    giver: 'elder',
    intro: '你是个散人，身上只有一把剑。先按 K 打开技能树，用技能点学一招防身，学会了回来找我。',
    done: '好，有点样子了。',
    goal: { type: 'learn' },
    xp: 60,
  });
  q.push({
    title: '郎中的药',
    giver: 'elder',
    intro: '出去之前，先去找郎中白芷认识一下，受了伤她能救你。',
    done: '白芷人好，就是嘴碎。',
    goal: { type: 'talk', npc: 'doctor' },
    xp: 40,
  });
  let n = 0;
  for (const { d, i } of byLevel) {
    const kind = FOE_KINDS[d.kind];
    const dir = dirName(d.x, d.z);
    if (d.boss) {
      q.push({
        title: `擒贼先擒王 · ${kind.boss ?? kind.name + '头目'}`,
        giver: 'elder',
        intro: `${dir}那伙${kind.name}有个头目（${kind.boss ?? kind.name + '头目'}），比手下难缠得多（${d.level + 3} 级）。打倒他，这一片就太平了。`,
        done: '头目一倒，那一片的百姓能睡个安稳觉了。',
        goal: { type: 'boss', den: i },
        xp: 200 + d.level * 30,
      });
    } else {
      q.push({
        title: `清剿${kind.name}`,
        giver: 'elder',
        intro: `${dir}的${kind.name}窝（${d.level} 级）抢了好几回粮。去打倒他们 ${d.count} 个人。`,
        done: '干得漂亮。',
        goal: { type: 'kill', den: i, count: d.count },
        xp: 60 + d.level * 18,
      });
    }
    n++;
    if (n === 7) q.push({ title: '江湖传闻', giver: 'elder', intro: '说书人那儿消息多，去听听他怎么说外面的局势。', done: '他说的倒有几分真。', goal: { type: 'talk', npc: 'teller' }, xp: 80 });
    if (n === 14) q.push({ title: '登峰造极', giver: 'elder', intro: '最远那一圈的贼人都是狠角色。先把自己练到 25 级再去。', done: '你已经比我年轻时强了。', goal: { type: 'level', level: 25 }, xp: 300 });
  }
  q.push({ title: '散人之道', giver: 'elder', intro: '三十级了吧？散人可以按 K 转职，职业可以学大招。路怎么走，你自己定。', done: '青石村记住你了。', goal: { type: 'level', level: 30 }, xp: 500 });
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

// The war in the world: 伪朝声势, the false court's reach, grows day by day and with what the morning court
// counsels, and falls with what you do. As it grows its men walk the post roads in patrols, then set up checkpoints
// (关卡) on the roads, then tax the market; every few nights raiders fall on 青石村 and you hold the village through
// three waves (or it burns, and the market shuts for a day). The fighters come from benched pools made with the sim
// (like the sparring guards), so nothing is created or destroyed while the game runs.
import type { Sim } from './sim';
import type { Fighter } from './types';
import { DAY_S } from './clock';
import { roadPoint } from './layout';
import { FOE_KINDS, type FoeKind } from './foes';
import { groundHeight, VILLAGE_R } from './world';
import { earn, giveXp } from './play';
import { ROOMS } from './interiors';
import { nearCourt } from './court';
const nearCourtPlain = (x: number, z: number) => nearCourt(x, z, 140);

export const DREAD_START = 30;
/** what it brings at each step */
export const TIERS: { at: number; up: string; down: string }[] = [
  { at: 20, up: '伪朝禁军开始沿驿道巡逻，见了带刀的就拦。', down: '驿道上的伪朝巡逻少了。' },
  { at: 40, up: '伪朝在驿道上设了关卡，盘查过往行人，十个有九个要被搜身。', down: '驿道上的关卡撤了几处。' },
  { at: 60, up: '伪朝加征“天阙税”，青石集上的东西都贵了两成。', down: '“天阙税”收不上去，集上的价钱落回来了。' },
  { at: 80, up: '天阙的阴影笼罩四野，连夜里来劫村的山贼都打起了伪朝的旗号。', down: '天阙的阴影退了一些，夜里没那么吓人了。' },
];
/** what the morning court's counsel does to it */
export const POLICY_DREAD: Record<string, number> = { defy: -8, troops: -5, amnesty: -3, grain: -2, festival: -2, walls: -3, roads: -1, obey: 10, tax: 4, none: 2 };

const GUARD = () => FOE_KINDS.find((k) => k.model === 'guard.glb') ?? FOE_KINDS[0];
const PATROL_ROADS = [2, 3, 5, 6, 0, 4, 1];
const POST_ROADS = [2, 5, 3, 6];
export const POST_R = 330;
export const patrolsFor = (dread: number) => (dread >= 50 ? 3 : dread >= 35 ? 2 : dread >= 20 ? 1 : 0);
export const postsFor = (dread: number) => (dread >= 75 ? 4 : dread >= 62 ? 3 : dread >= 50 ? 2 : dread >= 40 ? 1 : 0);
/** where checkpoint k stands: across its road */
export const postAt = (k: number) => roadPoint(POST_ROADS[k], POST_R);
export const postRoad = (k: number) => POST_ROADS[k];

export interface Patrol {
  road: number;
  r: number;
  dir: number;
  ids: number[];
  /** world time it may march again after being routed */
  down: number;
}
export interface Post {
  ids: number[];
  active: boolean;
  down: number;
}
export interface Raid {
  stage: 'warned' | 'on' | 'over';
  wave: number;
  waveT: number;
  ids: number[];
  hp: number;
  road: number;
  t: number;
  won?: boolean;
}
export interface War {
  dread: number;
  patrols: Patrol[];
  posts: Post[];
  raid: Raid | null;
  /** pools of benched fighters */
  pool: { patrol: number[]; post: number[]; raid: number[]; hunt: number[] };
  /** 追杀: the band hunting you now, the countdown to the next, how many came */
  hunt: { ids: number[]; t: number; kind: string } | null;
  huntT: number;
  hunts: number;
  /** what the market does on a given day after a raid: 'shut' (burned) or 'feast' (saved) */
  after: { day: number; kind: 'shut' | 'feast' } | null;
  lastTier: number;
  raidDay: number;
}
export function newWar(): War {
  return { dread: DREAD_START, patrols: [], posts: POST_ROADS.map(() => ({ ids: [], active: false, down: 0 })), raid: null, pool: { patrol: [], post: [], raid: [], hunt: [] }, after: null, lastTier: 0, raidDay: -1, hunt: null, huntT: 50, hunts: 0 };
}
/** the benched men, made once with the sim */
export function makePools(s: Sim) {
  const W = s.war;
  const bench = (kind: FoeKind, name: string, model = kind.model) => {
    const f = (s as any).make('sect', kind.house, name, model, 1, 0, -5000) as Fighter;
    f.hp = 0;
    const a = f as any;
    a.benched = true;
    a.pooled = true;
    a.foeKind = kind;
    return f.id;
  };
  for (let k = 0; k < 9; k++) W.pool.patrol.push(bench(GUARD(), '伪朝巡逻'));
  for (let k = 0; k < 12; k++) W.pool.post.push(bench(GUARD(), '关卡禁军'));
  const raiders = [FOE_KINDS[0], FOE_KINDS[0], FOE_KINDS[1], FOE_KINDS[0], FOE_KINDS[3], FOE_KINDS[0], FOE_KINDS[1], FOE_KINDS[3], FOE_KINDS[0], FOE_KINDS[0]];
  for (const k of raiders) W.pool.raid.push(bench(k, '劫村的' + k.name));
  // the hunters: bandits who stop you on the road, assassins in the dark, the false court's 金甲卫
  for (const k of [FOE_KINDS[0], FOE_KINDS[0], FOE_KINDS[1], FOE_KINDS[3], FOE_KINDS[3], FOE_KINDS[3]]) W.pool.hunt.push(bench(k, k.name));
  for (let k = 0; k < 3; k++) W.pool.hunt.push(bench(GUARD(), '金甲卫'));
}
/** calls a benched man up: his name, his level, where he stands, what he's doing */
function call(s: Sim, id: number, name: string, level: number, x: number, z: number, mode: 'patrol' | 'post' | 'raid' | 'hunt', hpMul = 0.85) {
  const f = s.fighters[id];
  const a = f as any;
  f.name = name;
  f.level = level;
  f.maxHp = Math.round((180 + level * 55) * hpMul);
  f.home = [x, z];
  f.pos = [x, groundHeight(x, z), z];
  a.benched = false;
  a.mode = mode;
  (s as any).revive(f);
  f.pos = [x, groundHeight(x, z), z];
  f.aggro = mode === 'raid';
  return f;
}
const bench = (s: Sim, id: number) => {
  const f = s.fighters[id];
  f.hp = 0;
  (f as any).benched = true;
  (f as any).mode = undefined;
};
const alive = (s: Sim, ids: number[]) => ids.filter((id) => s.fighters[id].hp > 0);
const near = (s: Sim, x: number, z: number, r: number) => Math.hypot(s.player.pos[0] - x, s.player.pos[2] - z) < r;

/** moves the reach, with the reason written down when it's a big step */
export function shiftDread(s: Sim, by: number) {
  const W = s.war;
  W.dread = Math.max(0, Math.min(100, W.dread + by));
}

export function stepWar(s: Sim, dt: number) {
  const W = s.war, c = s.clock, p = s.player;
  // it creeps up by itself: about a tier every four days
  shiftDread(s, (5 * dt) / DAY_S);
  const tier = TIERS.filter((t) => W.dread >= t.at).length;
  if (tier !== W.lastTier) {
    const t = tier > W.lastTier ? TIERS[tier - 1].up : TIERS[tier].down;
    s.toast(t);
    s.chron(t, tier > W.lastTier ? t : undefined);
    W.lastTier = tier;
  }
  const lvl = Math.max(2, s.progress.level);
  // ---- patrols: three men walking a stretch of post road and back
  const want = patrolsFor(W.dread);
  while (W.patrols.length < want) {
    const k = W.patrols.length;
    W.patrols.push({ road: PATROL_ROADS[k], r: 140 + k * 70, dir: 1, ids: [], down: 0 });
  }
  W.patrols.forEach((pt, k) => {
    const active = k < want;
    const live = alive(s, pt.ids);
    if (pt.ids.length && !live.length) {
      // routed
      pt.ids = [];
      pt.down = s.worldT + DAY_S;
      shiftDread(s, -4);
      earn(s, 30, '伪朝巡逻队被你打散了！');
      s.chron('你在驿道上打散了一队伪朝巡逻。', '听说你在驿道上把伪朝的巡逻打得屁滚尿流，痛快！');
    }
    if (!active || s.worldT < pt.down) {
      for (const id of live) bench(s, id);
      pt.ids = live.length && active ? pt.ids : [];
      return;
    }
    if (!pt.ids.length) {
      // they march out (far from where you are, so nobody pops up before your eyes)
      const [x, z] = roadPoint(pt.road, pt.r);
      if (near(s, x, z, 70)) return;
      pt.ids = W.pool.patrol.slice(k * 3, k * 3 + 3);
      pt.ids.forEach((id, j) => call(s, id, j === 0 ? '伪朝巡逻队长' : '伪朝巡逻', lvl + (j === 0 ? 2 : 0) + Math.floor(W.dread / 30), x, z, 'patrol', j === 0 ? 1.2 : 0.85));
    }
    // the march goes on while none of them is fighting
    const fighting = pt.ids.some((id) => s.fighters[id].aggro && s.fighters[id].hp > 0);
    if (!fighting) {
      pt.r += pt.dir * 1.5 * dt;
      if (pt.r > 470 || pt.r < 120) pt.dir *= -1;
    }
    const [x, z] = roadPoint(pt.road, pt.r);
    const [x2, z2] = roadPoint(pt.road, pt.r + pt.dir);
    const ux = x2 - x, uz = z2 - z, ul = Math.hypot(ux, uz) || 1;
    pt.ids.forEach((id, j) => {
      const f = s.fighters[id];
      if (f.hp <= 0) return;
      // in file: the captain in front, two behind
      const back = j === 0 ? 0 : 2.6, side = j === 1 ? -1.2 : j === 2 ? 1.2 : 0;
      f.home = [x - (ux / ul) * back + (uz / ul) * side, z - (uz / ul) * back - (ux / ul) * side];
    });
  });
  // ---- checkpoints: four men across the road at POST_R, a captain among them
  const nposts = postsFor(W.dread);
  W.posts.forEach((po, k) => {
    const live = alive(s, po.ids);
    if (po.active && po.ids.length && !live.length) {
      po.active = false;
      po.ids = [];
      po.down = s.worldT + DAY_S * 2;
      shiftDread(s, -7);
      earn(s, 60, '关卡被你拔掉了！缴获关税 60 文');
      giveXp(s, 120);
      s.chron(`你拔掉了驿道上的一处伪朝关卡。`, '听说驿道上的关卡被人拔了，过往的商客都在念你的好。');
    }
    const should = k < nposts && s.worldT >= po.down;
    if (should && !po.active) {
      const [x, z] = postAt(k);
      if (near(s, x, z, 120)) return;
      po.active = true;
      po.ids = W.pool.post.slice(k * 3, k * 3 + 3);
      const [ax, az] = roadPoint(POST_ROADS[k], POST_R + 1);
      const ux = ax - x, uz = az - z, ul = Math.hypot(ux, uz) || 1;
      po.ids.forEach((id, j) => {
        const side = (j - 1) * 3.2;
        call(s, id, j === 1 ? '关卡校尉' : '关卡禁军', lvl + 1 + (j === 1 ? 3 : 0) + Math.floor(W.dread / 30), x + (uz / ul) * side, z - (ux / ul) * side, 'post', j === 1 ? 1.6 : 0.85);
      });
    } else if (!should && po.active && !near(s, ...postAt(k), 120)) {
      for (const id of po.ids) bench(s, id);
      po.active = false;
      po.ids = [];
    }
  });
  // ---- the night raid on 青石村: every other night, warned at dusk
  stepRaid(s, dt, c, p);
  stepHunt(s, dt);
}

/** the houses' doors: where the raiders go to set fires */
const DOORS = ROOMS.filter((r) => r.theme !== 'tavern' && r.theme !== 'inn' && r.theme !== 'shrine' && r.theme !== 'teahouse' && r.theme !== 'throne' && Math.hypot(r.door[0], r.door[1]) < 40).map((r) => r.door);
export const raidNight = (day: number) => day % 2 === 1;
function stepRaid(s: Sim, dt: number, c: Sim['clock'], p: Fighter) {
  const W = s.war;
  const R = W.raid;
  if (!R) {
    // every other night; and the first evening you're about, whatever night it is
    if ((!raidNight(c.day) && W.raidDay >= 0) || W.raidDay === c.day) return;
    if (c.hour >= 17.5 && c.hour < 21) {
      W.raid = { stage: 'warned', wave: 0, waveT: 0, ids: [], hp: 100, road: [2, 3, 5, 6][c.day % 4], t: 0 };
      W.raidDay = c.day;
      s.toast('樵夫老周慌慌张张跑回来：“村外林子里有人马，今夜怕是要出事！”');
    }
    return;
  }
  if (R.stage === 'warned') {
    if (c.hour < 21 && c.hour >= 17) return;
    // far away: the village holds the night on its own, at a cost
    if (Math.hypot(p.pos[0], p.pos[2]) > 260 || s.indoor >= 0 && Math.hypot(...ROOMS[s.indoor].door) > 260) {
      s.chron('夜里山贼劫了青石村。你不在，村民们拿着锄头扁担守了一夜，伤了好几个人。', '那天夜里山贼来劫村，你去哪了？');
      s.toast('青石村昨夜遭了劫，村民们勉强守住了。');
      shiftDread(s, 4);
      W.raid = null;
      return;
    }
    R.stage = 'on';
    R.t = 0;
    s.toast('山贼劫村了！守住青石村！');
    s.shake(0.4, 0, 0);
  }
  if (R.stage === 'on') {
    R.t += dt;
    const lvl = Math.max(2, s.progress.level - 1);
    const live = alive(s, R.ids);
    // fires: every raider who reached the houses unopposed burns them down a little
    for (const id of live) {
      const f = s.fighters[id];
      if (!f.aggro && Math.hypot(f.pos[0], f.pos[2]) < VILLAGE_R - 18) {
        R.hp -= 1.1 * dt;
        if (Math.random() < dt * 0.25) s.say(f.pos[0], f.pos[1] + 2.6, f.pos[2], ['烧！', '给我烧！', '抢光！'][Math.floor(Math.random() * 3)]);
      }
    }
    const waves = [4, 5, 4];
    R.waveT -= dt;
    if (R.wave < waves.length && (!live.length || R.waveT <= 0) && (R.wave === 0 || R.waveT <= 30)) {
      // the next wave comes up the road (the third brings their chief)
      const n = waves[R.wave];
      const used = new Set(live);
      const free = W.pool.raid.filter((id) => !used.has(id) && s.fighters[id].hp <= 0).slice(0, n);
      free.forEach((id, j) => {
        const [x, z] = roadPoint(R.road, 92 + j * 2.5);
        const chief = R.wave === 2 && j === 0;
        const f = call(s, id, chief ? '劫村头目 · 黑风' : s.fighters[id].name, lvl + (chief ? 4 : j % 3), x + (j % 2 ? 1.5 : -1.5), z, 'raid', chief ? 2.2 : 0.85);
        f.home = DOORS[(j + R.wave) % DOORS.length] ?? [0, 0];
        f.aggro = false;
        R.ids.push(id);
      });
      R.ids = R.ids.filter((id) => s.fighters[id].hp > 0 || free.includes(id));
      R.wave++;
      R.waveT = 50;
      s.toast(R.wave === 3 ? '劫村头目黑风亲自杀来了！' : `第 ${R.wave} 波山贼杀进来了！`);
    }
    const won = R.wave >= waves.length && !alive(s, R.ids).length;
    const lost = R.hp <= 0 || R.t > 300;
    if (won || lost) {
      for (const id of R.ids) if (s.fighters[id].hp > 0) bench(s, id);
      R.stage = 'over';
      R.won = won;
      W.raid = null;
      if (won) {
        W.after = { day: c.day + 1, kind: 'feast' };
        shiftDread(s, -6);
        earn(s, 100, '守住青石村了！村长代全村谢你，赏 100 文。明天集上请客，样样半价！');
        giveXp(s, 220);
        s.chron('夜里山贼劫村，你守住了青石村。', '那天夜里要不是你，咱们村就没了！');
        const T = (s.progress.titles ??= []);
        if (!T.includes('青石村的守护者')) {
          T.push('青石村的守护者');
          s.toast('得了个名号：「青石村的守护者」');
        }
      } else {
        W.after = { day: c.day + 1, kind: 'shut' };
        shiftDread(s, 8);
        s.toast('青石村被烧了好几处，集市明天开不了张了……');
        s.chron('夜里山贼劫村，青石村被烧了好几处房子，集市停了一天。', '那天夜里村子被烧了，到现在还有焦味儿。');
      }
    }
  }
}
/** prices now: the counsel standing, the 天阙税, the day after a raid */
export function warPrice(s: Sim) {
  const W = s.war;
  let k = W.dread >= 60 ? 1.2 : 1;
  if (W.after?.day === s.clock.day) k *= W.after.kind === 'feast' ? 0.5 : 1.3;
  return k;
}
/** the market is shut the day after the village burned; everyone hides while raiders are in it */
export const marketShut = (s: Sim) => s.war.after?.day === s.clock.day && s.war.after.kind === 'shut';
export const raidOn = (s: Sim) => s.war.raid?.stage === 'on';

// ---------------------------------------------------------------- 追杀: they come for you
const HUNTS = {
  road: { say: '有人从林子里窜出来：“此山是我开！留下买路钱！”', ids: [0, 1, 2], names: ['截道的山贼', '截道的山贼', '截道的女飞贼'] },
  dark: { say: '黑暗里刀光一闪……有人要你的命！', ids: [3, 4, 5], names: ['夜行刺客', '夜行刺客', '夜行刺客'] },
  court: { say: '金甲卫：“奉旨缉拿守阙人余孽！拿下！”', ids: [6, 7, 8], names: ['金甲卫', '金甲卫', '金甲卫统领'] },
} as const;
/** out on the land (not in the village, the court, a room, a raid or a bout) nobody's safe for long */
function exposed(s: Sim) {
  const p = s.player.pos;
  return s.player.hp > 0 && s.indoor < 0 && !s.spar && !s.war.raid && Math.hypot(p[0], p[2]) > VILLAGE_R + 25 && !nearCourtPlain(p[0], p[2]) && s.dialog < 0 && !s.game;
}
function stepHunt(s: Sim, dt: number) {
  const W = s.war, p = s.player;
  const H = W.hunt;
  if (H) {
    H.t += dt;
    const live = alive(s, H.ids);
    const far = live.every((id) => s.fighters[id].pos && Math.hypot(s.fighters[id].pos[0] - p.pos[0], s.fighters[id].pos[2] - p.pos[2]) > 140);
    if (!live.length) {
      W.hunt = null;
      W.huntT = 120 + Math.random() * 90;
      shiftDread(s, -2);
      earn(s, 25, '杀退了追兵！');
      s.chron(H.kind === 'court' ? '你杀退了来缉拿你的金甲卫。' : H.kind === 'dark' ? '夜里有刺客来取你性命，被你反杀了。' : '你在路上打退了一伙截道的山贼。', H.kind === 'court' ? '听说朝廷……不，天阙那边派人抓你，全让你打跑了！' : undefined);
    } else if (far || !exposed(s) && H.t > 8 || H.t > 150) {
      // you got away (or into safety): they melt back into the land
      for (const id of live) bench(s, id);
      W.hunt = null;
      W.huntT = 90 + Math.random() * 60;
      if (far) s.toast('你甩掉了追兵。');
    }
    return;
  }
  if (!exposed(s)) return;
  // the countdown runs faster at night and as the false court grows bolder
  const rate = (s.clock.night ? 1.6 : 1) * (1 + W.dread / 100);
  W.huntT -= dt * rate;
  if (W.huntT > 0) return;
  const kind: keyof typeof HUNTS = W.dread >= 40 && Math.random() < 0.4 ? 'court' : s.clock.night ? 'dark' : 'road';
  const h = HUNTS[kind];
  const lvl = Math.max(2, s.progress.level);
  // they come from behind you, out of sight, already running
  const yaw = s.player.yaw;
  const bx = -Math.sin(yaw), bz = -Math.cos(yaw);
  const ids: number[] = [];
  h.ids.forEach((pi, j) => {
    const id = W.pool.hunt[pi];
    const side = (j - 1) * 4;
    const x = p.pos[0] + bx * 34 + bz * side, z = p.pos[2] + bz * 34 - bx * side;
    const lead = j === 2 && kind === 'court';
    const f = call(s, id, h.names[j], lvl + (lead ? 3 : j === 0 ? 1 : 0) + Math.floor(W.dread / 35), x, z, 'hunt' as any, lead ? 1.5 : 0.85);
    f.aggro = true;
    ids.push(id);
  });
  W.hunt = { ids, t: 0, kind };
  W.hunts++;
  s.toast(h.say);
  s.say(s.fighters[ids[0]].pos[0], s.fighters[ids[0]].pos[1] + 2.6, s.fighters[ids[0]].pos[2], kind === 'court' ? '拿下！' : kind === 'dark' ? '……' : '站住！');
}

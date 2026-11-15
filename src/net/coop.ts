// 联机 (owner: after 伪帝, play together). One player hosts: their world runs as always and is the truth. Up to three
// others join with a room code through the relay (Cloudflare, relay/): each gets one of the world's three benched
// 同伴 bodies (makeCoopSlots), walks it with their own keys (moved at once on their screen, checked by the host),
// fights with their own hero's moves (cast on the host, so every blow is the host's to count), and sees the host's
// world: every fighter, giant's warning, shot, zone and effect, a dozen times a second. Kills pay everyone near.
// Guests' own saves keep their level and gear; what they earn here is added to them.
import type { Sim } from '../game/sim';
import type { Fighter } from '../game/types';
import { GIANTS, rearmGiant } from '../game/giants';
import { heroOf } from '../game/heroes';
import { BAR_R, gainXp, save, skillPower } from '../game/progress';
import { fullHp, gearOf } from '../game/jianghu';
import { storyDone } from '../game/endgame';
import { clockOf } from '../game/clock';
import { openRelay, type Relay } from './relay';

export const COOP_SLOTS = 3;
/** made once with the world (last, so no one else's number moves): the bodies guests will walk */
export function makeCoopSlots(s: Sim) {
  (s as any).coopSlots = [];
  for (let k = 0; k < COOP_SLOTS; k++) {
    const f = (s as any).make('ally', null, '侠客', 'wanderer_m.glb', 1, 0, -5000) as Fighter;
    f.hp = 0;
    const a = f as any;
    a.benched = true;
    a.remote = true;
    (s as any).coopSlots.push(f.id);
  }
}

// ================================================================ what guests send and the host does with it
interface RemoteIn {
  mx: number;
  mz: number;
  yaw: number;
  jump?: boolean;
  dodge?: boolean;
  attack?: boolean;
  /** move ids pressed since the last message */
  cast?: string[];
}
/** the host steps a guest's body by what they last sent (in place of an ally's mind) */
export function controlRemote(s: Sim, f: Fighter) {
  const a = f as any;
  if (f.hp <= 0) return;
  const inp: RemoteIn | undefined = a.rin;
  if (!inp) return;
  a.wish = [inp.mx, inp.mz];
  if (inp.dodge) (s as any).dodge(f, inp.mx, inp.mz);
  if (inp.jump) (s as any).jump(f);
  if (inp.attack && (s as any).free(f)) {
    f.yaw = inp.yaw;
    const t = s.nearestEnemy(f, 12, Math.cos(0.6)) ?? s.nearestEnemy(f, 3.2, -1);
    if (t) s.faceTo(f, t.pos[0], t.pos[2]);
    (s as any).attack(f, !!a.ranged);
  }
  for (const id of inp.cast ?? []) {
    if (!(s as any).free(f) && !(f.run && f.run.id === id)) continue;
    f.yaw = inp.yaw;
    const t = s.nearestEnemy(f, 14, Math.cos(0.6));
    if (t) s.faceTo(f, t.pos[0], t.pos[2]);
    s.cast(f, id);
    f.castMult = skillPower(a.levels?.[id] ?? 1);
  }
  // pressed once, done once
  inp.jump = inp.dodge = inp.attack = false;
  inp.cast = [];
}

// ================================================================ the connection, kept here (one per page)
type Role = 'off' | 'host' | 'guest';
interface Peer {
  gid: string;
  name: string;
  slot: number;
  seen: number;
}
export const coop = {
  role: 'off' as Role,
  room: '',
  status: '',
  relay: null as Relay | null,
  peers: [] as Peer[],
  /** guest: my body's number in the host's world, and the host's player's stand-in in mine */
  mySlot: -1,
  gid: Math.random().toString(36).slice(2, 10),
  /** host: effects made this tick (sent with the next snapshot) */
  outV: [] as any[],
  outFx: [] as any[],
  outEv: [] as any[],
  sendT: 0,
  inT: 0,
  key: 0,
  /** guest: where the host says each body is, to ease toward */
  target: new Map<number, { x: number; y: number; z: number; yaw: number }>(),
  pending: { jump: false, dodge: false, attack: false, cast: [] as string[] },
  lastSnap: 0,
};
const mapId = (id: number) => (id === 0 ? coop.mySlot : id === coop.mySlot ? 0 : id); // host's numbers ↔ mine

export const canCoop = (s: Sim) => storyDone(s.progress);
const code = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

/** host a room: returns its code */
export function hostRoom(s: Sim) {
  leave(s);
  coop.role = 'host';
  coop.room = 'T2' + code();
  coop.status = '等人加入……';
  coop.peers = [];
  coop.relay = openRelay(coop.room, 'h', (m) => onHostMsg(s, m), (st) => (coop.status = st === 'open' ? `房间 ${coop.room.slice(2)} · 等人加入` : st));
  wrapHost(s);
  return coop.room.slice(2);
}
/** join a room by its four letters */
export function joinRoom(s: Sim, letters: string) {
  leave(s);
  coop.role = 'guest';
  coop.room = 'T2' + letters.trim().toUpperCase();
  coop.status = '连接中……';
  coop.relay = openRelay(coop.room, 'g', (m) => onGuestMsg(s, m), (st) => {
    coop.status = st === 'open' ? '已连上，等房主回应……' : st;
    if (st === 'open') sendHello(s);
  });
}
export function leave(s: Sim) {
  if (coop.role === 'host') {
    for (const p of coop.peers) bench(s, p.slot);
    coop.relay?.send({ t: 'bye' });
  }
  if (coop.role === 'guest') {
    coop.relay?.send({ t: 'bye', gid: coop.gid });
    s.netGuest = false;
    // the world here was the host's: start afresh from your own save
    if (coop.mySlot >= 0) setTimeout(() => location.reload(), 300);
  }
  coop.relay?.close();
  coop.relay = null;
  coop.role = 'off';
  coop.peers = [];
  coop.mySlot = -1;
  coop.status = '';
}
const bench = (s: Sim, id: number) => {
  const f = s.fighters[id];
  f.hp = 0;
  (f as any).benched = true;
  (f as any).rin = undefined;
};

// ---------------------------------------------------------------- the guest's hello: who they are and how they fight
function sendHello(s: Sim) {
  const P = s.progress, h = heroOf(P.hero);
  coop.relay?.send({
    t: 'hello',
    gid: coop.gid,
    n: s.fighters.length,
    name: (P as any).name || (h ? h.name : '散人'),
    model: s.player.model,
    house: s.player.sect,
    level: P.level,
    hp: fullHp(P),
    power: s.power(s.player),
    def: gearOf(P).def,
    ranged: !!h?.ranged,
    levels: P.skills,
  });
}

// ================================================================ host
function onHostMsg(s: Sim, m: any) {
  if (m.t === 'hello') {
    if (m.n !== s.fighters.length) return coop.relay?.send({ t: 'no', gid: m.gid, why: '两边的游戏版本不一样：都按 Ctrl+Shift+R 刷新一下再试' });
    let p = coop.peers.find((x) => x.gid === m.gid);
    if (!p) {
      const free = ((s as any).coopSlots as number[]).find((id) => !coop.peers.some((x) => x.slot === id));
      if (free === undefined) return coop.relay?.send({ t: 'no', gid: m.gid, why: '房间满了（最多四人）' });
      p = { gid: m.gid, name: String(m.name).slice(0, 12), slot: free, seen: s.time };
      coop.peers.push(p);
    }
    const f = s.fighters[p.slot], a = f as any;
    f.name = `${p.name}（同伴）`;
    f.model = m.model;
    f.sect = m.house;
    f.level = m.level;
    f.maxHp = m.hp;
    a.remotePower = m.power;
    a.remoteDef = m.def;
    a.ranged = m.ranged;
    a.levels = m.levels;
    a.benched = false;
    const me = s.player;
    f.home = [me.pos[0] + 2, me.pos[2] + 2];
    (s as any).revive(f);
    s.toast(`${p.name} 加入了你的江湖`);
    coop.relay?.send({ t: 'welcome', gid: m.gid, slot: p.slot, host: s.progress.level, wt: s.worldT });
    coop.status = `房间 ${coop.room.slice(2)} · ${coop.peers.length + 1} 人`;
    return;
  }
  const p = coop.peers.find((x) => x.gid === m.gid);
  if (!p) return;
  p.seen = s.time;
  if (m.t === 'in') {
    const a = s.fighters[p.slot] as any;
    const prev: RemoteIn = a.rin ?? { mx: 0, mz: 0, yaw: 0, cast: [] };
    a.rin = { mx: m.mx, mz: m.mz, yaw: m.yaw, jump: prev.jump || m.jump, dodge: prev.dodge || m.dodge, attack: prev.attack || m.attack, cast: [...(prev.cast ?? []), ...(m.cast ?? [])].slice(0, 4) };
  } else if (m.t === 'bye') {
    s.toast(`${p.name} 离开了`);
    bench(s, p.slot);
    coop.peers = coop.peers.filter((x) => x !== p);
    coop.status = `房间 ${coop.room.slice(2)} · ${coop.peers.length + 1} 人`;
  }
}
/** the host's effects are recorded as they're made, to go out with the snapshot */
function wrapHost(s: Sim) {
  const S = s as any;
  if (S.coopWrapped) return;
  S.coopWrapped = true;
  const vfx = s.vfx.bind(s), addFx = s.addFx.bind(s), emit = s.emit.bind(s);
  s.vfx = (n: string, ...a: any[]) => {
    if (coop.role === 'host' && coop.peers.length && n !== 'shake' && coop.outV.length < 160) coop.outV.push([n, a]);
    vfx(n, ...a);
  };
  s.addFx = (fx: any) => {
    if (coop.role === 'host' && coop.peers.length && coop.outFx.length < 120) coop.outFx.push(fx);
    addFx(fx);
  };
  s.emit = (e: any) => {
    if (coop.role === 'host' && coop.peers.length && coop.outEv.length < 80 && e.k !== 'level') coop.outEv.push(e);
    emit(e);
  };
}
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
/** after the host's step: a snapshot every 1/12 s */
export function hostAfterStep(s: Sim, dt: number) {
  if (coop.role !== 'host' || !coop.relay) return;
  // guests who went quiet are let go
  for (const p of [...coop.peers])
    if (s.time - p.seen > 12) {
      s.toast(`${p.name} 掉线了`);
      bench(s, p.slot);
      coop.peers = coop.peers.filter((x) => x !== p);
    }
  if (!coop.peers.length) {
    coop.outV.length = coop.outFx.length = coop.outEv.length = 0;
    return;
  }
  coop.sendT -= dt;
  if (coop.sendT > 0) return;
  coop.sendT = 1 / 12;
  const key = ++coop.key % 24 === 0;
  const players = [s.player, ...coop.peers.map((p) => s.fighters[p.slot])];
  const near = (f: Fighter) => players.some((p) => Math.hypot(p.pos[0] - f.pos[0], p.pos[2] - f.pos[2]) < 140);
  const F: any[] = [];
  for (const f of s.fighters) {
    const a = f as any;
    if (a.benched || a.away || (f.hp <= 0 && f.actT > 3 && f.team !== 'ally') || !near(f)) continue;
    const row: any[] = [f.id, r1(f.pos[0]), r2(f.pos[1]), r1(f.pos[2]), r2(f.yaw), f.act, f.anim, r2(f.actT), r2(f.actDur), Math.round(f.hp), Math.round(f.maxHp), a.hitAt ?? 0, a.hitHeavy ? 1 : 0, f.run ? [f.run.id, r2(f.run.t)] : 0];
    const g = a.giant;
    row.push(g ? [g.key, g.move ? g.move.m.id : '', g.move ? r2(g.move.t) : 0, r2(g.open), g.phase, g.awake ? 1 : 0] : 0);
    if (key || a.netDirty) row.push(f.model, f.name, f.team);
    a.netDirty = false;
    F.push(row);
  }
  const T = s.teles.map((t) => [t.shape, r1(t.x), r1(t.z), r2(t.yaw), r1(t.r), r2(t.r2), r2(t.t), t.wind, t.color, t.owner]);
  const zones = s.zones.map((z) => ({ ...z, touched: [], data: safe(z.data) }));
  const proj = s.proj.map((p) => safe(p));
  coop.relay.send({
    t: 's',
    wt: Math.round(s.worldT),
    w: [s.weather.kind, r2(s.weather.amt)],
    gf: s.giantFight,
    f: F,
    tel: T,
    z: zones,
    p: proj,
    v: coop.outV,
    fx: coop.outFx,
    ev: coop.outEv,
    end: s.end.ch ? { ch: { ...s.end.ch } } : s.end.tower ? { tower: { floor: s.end.tower.floor, state: s.end.tower.state, ids: s.end.tower.ids } } : null,
  });
  coop.outV = [];
  coop.outFx = [];
  coop.outEv = [];
}
/** a kill on the host pays the guests near it (their own saves) */
export function hostKill(s: Sim, def: Fighter, xp: number, coins: number) {
  if (coop.role !== 'host' || !coop.peers.length) return;
  for (const p of coop.peers) {
    const g = s.fighters[p.slot];
    if (Math.hypot(g.pos[0] - def.pos[0], g.pos[2] - def.pos[2]) < 60) coop.relay?.send({ t: 'pay', gid: p.gid, xp, coins, who: def.name });
  }
}
function safe(o: any) {
  if (!o || typeof o !== 'object') return o;
  const out: any = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'function') continue;
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 12) continue;
    out[k] = v;
  }
  return out;
}

// ================================================================ guest
function onGuestMsg(s: Sim, m: any) {
  if (m.gid && m.gid !== coop.gid) return; // for someone else
  if (m.t === 'no') {
    coop.status = m.why;
    coop.relay?.close();
    coop.role = 'off';
    return;
  }
  if (m.t === 'welcome') {
    coop.mySlot = m.slot;
    s.netGuest = true;
    coop.status = `已加入房间 ${coop.room.slice(2)}`;
    s.worldT = m.wt;
    // the host's own body stands in the slot that was mine
    const stand = s.fighters[coop.mySlot] as any;
    stand.benched = false;
    stand.remote = false;
    stand.hp = 1;
    s.toast('进入了房主的江湖：怪、任务和世界都是房主的；你打到的经验和铜钱记在自己身上');
    return;
  }
  if (m.t === 'pay') {
    const P = s.progress;
    P.coins = (P.coins ?? 0) + m.coins;
    const ups = gainXp(P, m.xp);
    s.text(s.player, `经验 +${m.xp}`, '#a5f3fc');
    if (ups > 0) {
      s.player.level = P.level;
      s.player.maxHp = fullHp(P);
      s.toast(`升级！${P.level} 级`);
    }
    save(P);
    return;
  }
  if (m.t === 'bye' && !m.gid) {
    s.toast('房主关了房间');
    leave(s);
    return;
  }
  if (m.t === 's' && coop.mySlot >= 0) applySnap(s, m);
}

function applySnap(s: Sim, m: any) {
  coop.lastSnap = s.time;
  if (Math.abs(s.worldT - m.wt) > 3) s.worldT = m.wt;
  s.weather.kind = m.w[0];
  s.weather.amt = m.w[1];
  s.giantFight = m.gf >= 0 ? mapId(m.gf) : -1;
  const seen = new Set<number>();
  for (const row of m.f) {
    const id = mapId(row[0]);
    const f = s.fighters[id];
    if (!f) continue;
    seen.add(id);
    const a = f as any;
    if (row.length > 15) {
      if (f.model !== row[15]) f.model = row[15];
      f.name = row[16];
      if (id !== 0) f.team = row[17];
    }
    a.benched = false;
    a.away = false;
    if (id === 0) {
      // my own body: I walk it; the host says how hurt I am and what my blows are doing
      f.hp = row[9];
      f.maxHp = row[10];
      if (Math.hypot(f.pos[0] - row[1], f.pos[2] - row[3]) > 3) f.pos = [row[1], row[2], row[3]];
      if (row[5] !== 'run' && row[5] !== 'idle' && row[5] !== 'walk') {
        f.act = row[5];
        f.anim = row[6];
        f.actT = row[7];
        f.actDur = row[8];
      }
    } else {
      coop.target.set(id, { x: row[1], y: row[2], z: row[3], yaw: row[4] });
      if (Math.hypot(f.pos[0] - row[1], f.pos[2] - row[3]) > 12) f.pos = [row[1], row[2], row[3]];
      f.act = row[5];
      f.anim = row[6];
      f.actT = row[7];
      f.actDur = row[8];
      f.hp = row[9];
      f.maxHp = row[10];
    }
    a.hitAt = row[11];
    a.hitHeavy = !!row[12];
    f.run = row[13] ? ({ ...(f.run ?? {}), id: row[13][0], t: row[13][1] } as any) : null;
    if (row[14] && a.giant) {
      const [key, mid, mt, open, phase, awake] = row[14];
      const def = GIANTS[key];
      a.giant.move = mid ? { m: def.moves.find((x) => x.id === mid), t: mt, marks: [], done: mt >= (def.moves.find((x) => x.id === mid)?.wind ?? 1) } : null;
      a.giant.open = open;
      a.giant.phase = phase;
      a.giant.awake = !!awake;
    }
  }
  // whoever the host didn't mention is out of sight (or benched): hide them
  for (const f of s.fighters) if (!seen.has(f.id) && f.id !== 0 && f.team !== 'npc' && !(f as any).folk) (f as any).benched = true;
  s.teles = m.tel.map((t: any[]) => ({ shape: t[0], x: t[1], z: t[2], yaw: t[3], r: t[4], r2: t[5], t: t[6], wind: t[7], color: t[8], owner: mapId(t[9]) }));
  s.zones = m.z.map((z: any) => ({ ...z, owner: mapId(z.owner) }));
  s.proj = m.p.map((p: any) => ({ ...p, owner: p.owner !== undefined ? mapId(p.owner) : p.owner }));
  for (const [n, a] of m.v) (s as any).vq.push({ n, a });
  for (const fx of m.fx) s.fx.push({ t: fx.max, ...fx, to: fx.to !== undefined ? mapId(fx.to) : fx.to, from: fx.from !== undefined ? mapId(fx.from) : fx.from });
  for (const e of m.ev) s.events.push({ ...e, id: e.id !== undefined ? mapId(e.id) : e.id, to: e.to !== undefined ? mapId(e.to) : e.to });
  s.end.ch = m.end?.ch ? { ...m.end.ch, id: mapId(m.end.ch.id) } : null;
  s.end.tower = m.end?.tower ? { ...m.end.tower, ids: m.end.tower.ids.map(mapId), t: 0, giant: -1 } : null;
}

/** the guest's frame in place of the sim's step: my own walking at once, everyone else eased toward the host's word */
export function guestStep(s: Sim, dt: number, inp: { move: number[]; camYaw: number; attack: boolean; dodge: boolean; jump: boolean; skills: boolean[]; ultHeld: boolean; interact: boolean }) {
  const S = s as any;
  dt = Math.min(dt, 0.05);
  s.time += dt;
  S.lastDt = dt;
  s.worldT += dt;
  s.clock = clockOf(s.worldT);
  const me = s.player;
  S.timers(me, dt);
  // walk, jump, roll here and now (no blows: those go to the host)
  S.control(me, { ...inp, attack: false, skills: inp.skills.map(() => false), ultHeld: false, interact: false });
  S.physics(me, dt);
  // everyone else: toward where the host last said
  const k = 1 - Math.exp(-dt * 10);
  for (const [id, t] of coop.target) {
    const f = s.fighters[id];
    if (!f) continue;
    f.pos[0] += (t.x - f.pos[0]) * k;
    f.pos[1] += (t.y - f.pos[1]) * k;
    f.pos[2] += (t.z - f.pos[2]) * k;
    let dy = t.yaw - f.yaw;
    dy = ((dy + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    f.yaw += dy * k;
    f.actT += dt;
  }
  for (const t of s.teles) t.t += dt;
  for (const fx of s.fx) fx.t -= dt;
  if (s.fx.length) s.fx = s.fx.filter((x) => x.t > 0);
  for (const t of s.toasts) t.t -= dt;
  if (s.toasts.length) s.toasts = s.toasts.filter((x) => x.t > 0);
  // what I pressed goes to the host (moves by their ids on my bar)
  const P = s.progress;
  if (inp.attack) coop.pending.attack = true;
  if (inp.dodge) coop.pending.dodge = true;
  if (inp.jump) coop.pending.jump = true;
  inp.skills.forEach((on, i) => {
    const id = P.bar[i];
    if (on && id && (P.skills[id] ?? 0) > 0 && (i !== BAR_R || true)) coop.pending.cast.push(id);
  });
  coop.inT -= dt;
  if (coop.inT <= 0 && coop.relay) {
    coop.inT = 1 / 20;
    const w = (me as any).wish ?? [0, 0];
    coop.relay.send({ t: 'in', gid: coop.gid, mx: r2(w[0]), mz: r2(w[1]), yaw: r2(inp.camYaw), ...coop.pending });
    coop.pending = { jump: false, dodge: false, attack: false, cast: [] };
  }
  if (s.time - coop.lastSnap > 8 && coop.lastSnap > 0) {
    s.toast('和房主断开了');
    leave(s);
  }
  void rearmGiant;
}

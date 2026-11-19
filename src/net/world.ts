// 大江湖 (owner: everyone online in the one world, chat, friends): when signed in, the game holds a socket to the hub
// (relay/src/hub.js /w) and says a few times a second where its player is, what they're doing and what they look
// like. Everyone else online comes back as a list; those near enough walk in this world as stand-ins (`GHOSTS`
// benched bodies made with the sim, team npc: nobody fights them, they fight nobody, nothing pushes them) eased to
// where their owner says, with their name over their head. Chat (附近 / 世界 / 队伍 / 私聊), friend requests and
// party invites (which open a 联机 room, net/coop.ts) go over the same socket.
import type { Sim } from '../game/sim';
import type { Fighter } from '../game/types';
import { RELAY_URL } from './relay';
import { account, onAuth } from './account';
import { coop, hostRoom, joinRoom } from './coop';
import { HEROES } from '../game/heroes';
import { GARMENTS } from '../game/wardrobe';

export const GHOSTS = 16;
export interface Other {
  i: string;
  n: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  a: string;
  m: string;
  l: number;
  h: number;
  r: number;
  g: string;
  p: string | null;
}
export interface ChatMsg {
  ch: 'world' | 'near' | 'party' | 'whisper' | 'sys';
  from?: string;
  name?: string;
  text: string;
  at: number;
  to?: string;
  toName?: string;
}
export interface Friend {
  id: string;
  name: string;
  on: boolean;
}
export const world = {
  status: 'off' as 'off' | 'connecting' | 'on' | 'retry',
  ws: null as WebSocket | null,
  me: null as { id: string; name: string } | null,
  players: [] as Other[],
  friends: [] as Friend[],
  reqs: [] as { id: string; name: string }[],
  invites: [] as { from: string; name: string; room: string; at: number }[],
  chat: [] as ChatMsg[],
  /** bumped on every change the panels show */
  rev: 0,
  tries: 0,
  sendT: 0,
  pingT: 0,
  party: null as string | null,
  /** ghost slot by player id */
  slot: new Map<string, number>(),
};
/** the bodies a player can wear (only these are loaded for someone else) */
let bodies: Set<string> | null = null;
const BODIES = { has: (m: string) => (bodies ??= new Set<string>(['wanderer_m.glb', ...HEROES.map((h) => h.model), ...GARMENTS.filter((g) => g.body).map((g) => g.body!)])).has(m) };

/** made once with the world (after the 联机 slots, so no one else's number moves) */
export function makeGhosts(s: Sim) {
  (s as any).ghostIds = [];
  for (let k = 0; k < GHOSTS; k++) {
    const f = (s as any).make('npc', null, '', 'wanderer_m.glb', 1, 0, -5000) as Fighter;
    const a = f as any;
    a.ghost = true;
    a.away = true;
    f.st.invuln = 1e9;
    (s as any).ghostIds.push(f.id);
  }
}
const push = (m: ChatMsg) => {
  world.chat.push(m);
  if (world.chat.length > 120) world.chat.splice(0, 40);
  world.rev++;
};
export function send(m: object) {
  if (world.ws && world.ws.readyState === 1) world.ws.send(JSON.stringify(m));
}
let simRef: Sim | null = null;
function connect() {
  if (!account.auth || world.ws) return;
  world.status = 'connecting';
  let ws: WebSocket;
  try {
    ws = new WebSocket(`${RELAY_URL}/w`);
  } catch {
    world.status = 'retry';
    return;
  }
  world.ws = ws;
  ws.onopen = () => {
    world.tries = 0;
    ws.send(JSON.stringify({ t: 'auth', token: account.auth?.token }));
  };
  ws.onmessage = (e) => {
    let m: any;
    try {
      m = JSON.parse(e.data);
    } catch {
      return;
    }
    onMsg(m);
  };
  ws.onclose = () => {
    world.ws = null;
    world.players = [];
    world.status = account.auth ? 'retry' : 'off';
    world.rev++;
    if (!account.auth) return;
    // the network blinked: back in a while (longer each time)
    const wait = Math.min(30000, 1500 * 2 ** world.tries++);
    setTimeout(connect, wait);
  };
  ws.onerror = () => {};
}
function onMsg(m: any) {
  const s = simRef;
  switch (m.t) {
    case 'hello':
      world.status = 'on';
      world.me = m.me;
      world.friends = m.friends ?? [];
      world.reqs = m.reqs ?? [];
      world.chat = (m.log ?? []).map((c: any) => ({ ...c }));
      for (const l of m.mail ?? []) push({ ch: 'whisper', from: l.src, name: l.name, text: l.text, at: l.at, to: m.me.id });
      if (m.mail?.length) s?.toast(`有 ${m.mail.length} 封留言（Enter 看聊天）`);
      if (world.reqs.length) s?.toast(`${world.reqs.length} 个好友请求（O 江湖 → 好友）`);
      world.party = null;
      sayParty();
      world.rev++;
      break;
    case 'w':
      world.players = m.ps ?? [];
      break;
    case 'chat':
      push(m);
      // said aloud near you: over their head
      if (s && (m.ch === 'near' || m.ch === 'world' || m.ch === 'party')) {
        const who = m.from === world.me?.id ? s.player : ghostOf(s, m.from);
        if (who && !(who as any).away) s.say(who.pos[0], who.pos[1] + 2.5, who.pos[2], m.text);
      }
      break;
    case 'sys':
      push({ ch: 'sys', text: m.text, at: Date.now() });
      break;
    case 'freq':
      world.reqs = [...world.reqs.filter((r) => r.id !== m.from), { id: m.from, name: m.name }];
      s?.toast(`${m.name}想加你为好友（O 江湖 → 好友）`);
      world.rev++;
      break;
    case 'friends':
      world.friends = m.friends ?? [];
      world.reqs = m.reqs ?? [];
      if (m.note) {
        s?.toast(m.note);
        push({ ch: 'sys', text: m.note, at: Date.now() });
      }
      world.rev++;
      break;
    case 'fon': {
      const f = world.friends.find((x) => x.id === m.id);
      if (f) {
        f.on = !!m.on;
        s?.toast(`好友${f.name}${m.on ? '上线了' : '下线了'}`);
      }
      world.rev++;
      break;
    }
    case 'inv':
      world.invites = [...world.invites.filter((v) => v.from !== m.from), { from: m.from, name: m.name, room: m.room, at: Date.now() }];
      s?.toast(`${m.name}邀请你组队`);
      world.rev++;
      break;
    case 'invr':
      s?.toast(m.ok ? `${m.name}答应了，正在进你的江湖` : `${m.name}婉拒了组队`);
      break;
    case 'bad':
      push({ ch: 'sys', text: m.error, at: Date.now() });
      break;
  }
}
onAuth(() => {
  if (account.auth) connect();
  else {
    world.ws?.close();
    world.ws = null;
    world.status = 'off';
    world.me = null;
    world.players = [];
    world.friends = [];
    world.reqs = [];
    world.rev++;
  }
});
/** the party you're in (the 联机 room), told to the hub so 队伍 chat reaches it */
function sayParty() {
  const room = coop.role === 'off' ? null : coop.room;
  if (room === world.party && world.status === 'on') return;
  world.party = room;
  send({ t: 'party', room });
}

// ---------------------------------------------------------------- what the panels call
export function chat(ch: ChatMsg['ch'], text: string, to?: string) {
  if (!world.me) return push({ ch: 'sys', text: '登录后才能说话（O 江湖 → 账号）', at: Date.now() });
  send({ t: 'chat', ch, text, to });
}
export const addFriend = (to: string) => send({ t: 'freq', to });
export const answerFriend = (from: string, ok: boolean) => {
  world.reqs = world.reqs.filter((r) => r.id !== from);
  world.rev++;
  send({ t: 'fans', from, ok });
};
export const dropFriend = (id: string) => send({ t: 'fdel', id });
/** invite someone into your 江湖: a room opens if you have none */
export function invite(s: Sim, to: string) {
  if (coop.role === 'guest') return s.toast('你在别人的江湖里，先离开才能邀请');
  if (coop.role === 'off') hostRoom(s);
  send({ t: 'inv', to, room: coop.room.slice(2) });
  s.toast('邀请已发出');
}
export function answerInvite(s: Sim, from: string, ok: boolean) {
  const v = world.invites.find((x) => x.from === from);
  world.invites = world.invites.filter((x) => x.from !== from);
  world.rev++;
  send({ t: 'invr', to: from, ok });
  if (ok && v) joinRoom(s, v.room);
}
export const ghostOf = (s: Sim, id: string) => {
  const k = world.slot.get(id);
  return k === undefined ? null : s.fighters[(s as any).ghostIds[k]];
};

// ---------------------------------------------------------------- every frame
export function stepWorld(s: Sim, dt: number, body: string) {
  simRef = s;
  if (account.auth && !world.ws && world.status === 'off') connect();
  const on = world.status === 'on';
  // where I am, four times a second
  if (on && (world.sendT -= dt) <= 0) {
    world.sendT = 0.25;
    const p = s.player;
    send({ t: 'st', x: +p.pos[0].toFixed(2), y: +p.pos[1].toFixed(2), z: +p.pos[2].toFixed(2), yaw: +p.yaw.toFixed(2), vx: +p.vel[0].toFixed(1), vz: +p.vel[2].toFixed(1), a: p.hp <= 0 ? 'dead' : (p as any).swim ? 'swim' : p.anim, m: body, l: s.progress.level, h: p.maxHp ? +(p.hp / p.maxHp).toFixed(2) : 1, r: s.indoor });
    sayParty();
  }
  if (on && (world.pingT -= dt) <= 0) {
    world.pingT = 25;
    send({ t: 'ping' });
  }
  // the others near enough walk here
  const ids: number[] = (s as any).ghostIds ?? [];
  const me = world.me?.id, p = s.player;
  const want = on
    ? world.players
        .filter((o) => o.i !== me && !(o.p && o.p === world.party) && o.r === s.indoor && Math.hypot(o.x - p.pos[0], o.z - p.pos[2]) < 110)
        .sort((a, b) => Math.hypot(a.x - p.pos[0], a.z - p.pos[2]) - Math.hypot(b.x - p.pos[0], b.z - p.pos[2]))
        .slice(0, ids.length)
    : [];
  const keepIds = new Set(want.map((o) => o.i));
  for (const [id, k] of world.slot) if (!keepIds.has(id)) world.slot.delete(id);
  const used = new Set(world.slot.values());
  for (const o of want)
    if (!world.slot.has(o.i)) {
      const k = ids.findIndex((_, j) => !used.has(j));
      if (k < 0) break;
      world.slot.set(o.i, k);
      used.add(k);
      const f = s.fighters[ids[k]];
      f.pos = [o.x, o.y, o.z];
    }
  ids.forEach((fid, k) => {
    const f = s.fighters[fid], a = f as any;
    const o = want.find((w) => world.slot.get(w.i) === k);
    if (!o) {
      a.away = true;
      a.other = null;
      return;
    }
    a.away = false;
    a.other = o.i;
    f.name = o.n;
    f.level = o.l;
    if (BODIES.has(o.m) && f.model !== o.m) f.model = o.m;
    // eased toward where they say they are (a little ahead, by their speed)
    const tx = o.x + o.vx * 0.12, tz = o.z + o.vz * 0.12;
    const d = Math.hypot(tx - f.pos[0], tz - f.pos[2]);
    if (d > 25) f.pos = [o.x, o.y, o.z];
    else {
      const k2 = Math.min(1, dt * 9);
      f.pos[0] += (tx - f.pos[0]) * k2;
      f.pos[2] += (tz - f.pos[2]) * k2;
      f.pos[1] += (o.y - f.pos[1]) * k2;
    }
    f.vel = [o.vx, 0, o.vz];
    const dy = ((o.yaw - f.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    f.yaw += dy * Math.min(1, dt * 12);
    f.hp = o.a === 'dead' ? 0 : Math.max(1, o.h * 100);
    f.maxHp = 100;
    const swim = o.a === 'swim', anim = o.a === 'dead' ? 'dead' : swim ? 'run' : o.a || 'idle';
    if (anim !== f.anim) {
      f.anim = anim;
      f.act = (anim === 'run' || anim === 'idle' || anim === 'dead' ? anim : 'attack') as any;
      f.actT = 0;
      f.actDur = 1;
    } else f.actT += dt;
    a.swim = swim ? 1 : 0;
  });
}

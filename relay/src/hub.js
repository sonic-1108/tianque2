// 天阙 · 散人行 hub (owner: accounts by email and password, one big 江湖 where everyone online meets, chat, friends).
// One Durable Object ("main") with its own SQLite: accounts, sessions, cloud saves, friends, friend requests and
// letters left for a friend who was away. The same object holds the world socket (/w): every signed-in game sends
// where its player is a few times a second; the hub sends everyone the list of who's out there (throttled, one
// message for all), carries chat (附近 / 世界 / 队伍 / 私聊), friend requests and party invites.
//
// Passwords: the game stretches the password itself (PBKDF2-SHA256, 100 000 rounds, salted with the email) and sends
// only that; the hub salts it again with its own random salt (PBKDF2, 2 000 rounds, cheap enough for a worker) and
// keeps that. Sessions are random 32-byte tokens; only their SHA-256 is stored. Wrong logins are rate limited.
// There is no mail service, so no verification mail and no reset by mail.

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' } });
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const rand = (n) => {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
async function stretch(pw, salt, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: iter }, key, 256));
}
/** the same length, compared without stopping early */
const same = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};
const SERVER_ITER = 2000;
const SESSION_MS = 60 * 24 * 3600 * 1000;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const cleanText = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);
const cleanName = (s) => cleanText(s, 12);
const SAVE_MAX = 600000;

export class Hub {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sql = state.storage.sql;
    for (const q of [
      `CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, hash TEXT NOT NULL, created INTEGER NOT NULL, last INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS sessions (th TEXT PRIMARY KEY, id TEXT NOT NULL, created INTEGER NOT NULL, last INTEGER NOT NULL)`,
      `CREATE INDEX IF NOT EXISTS sessions_id ON sessions (id)`,
      `CREATE TABLE IF NOT EXISTS saves (id TEXT PRIMARY KEY, data TEXT NOT NULL, level INTEGER NOT NULL, saved INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS friends (a TEXT NOT NULL, b TEXT NOT NULL, since INTEGER NOT NULL, PRIMARY KEY (a, b))`,
      `CREATE TABLE IF NOT EXISTS requests (src TEXT NOT NULL, dst TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (src, dst))`,
      `CREATE TABLE IF NOT EXISTS mail (n INTEGER PRIMARY KEY AUTOINCREMENT, dst TEXT NOT NULL, src TEXT NOT NULL, text TEXT NOT NULL, at INTEGER NOT NULL)`,
    ])
      this.sql.exec(q);
    /** where each signed-in player is (lost when the object sleeps; the games send it again) */
    this.st = new Map();
    this.sent = 0;
    this.log = [];
    this.fails = new Map(); // email or ip -> [times]
    this.talk = new Map(); // id -> last chat time
  }
  rows(q, ...a) {
    return this.sql.exec(q, ...a).toArray();
  }
  one(q, ...a) {
    return this.rows(q, ...a)[0] ?? null;
  }
  /** too many recent misses from this key? */
  limited(key, max, ms) {
    const now = Date.now(), list = (this.fails.get(key) ?? []).filter((t) => now - t < ms);
    this.fails.set(key, list);
    return list.length >= max;
  }
  miss(key) {
    const list = this.fails.get(key) ?? [];
    list.push(Date.now());
    this.fails.set(key, list);
    if (this.fails.size > 5000) this.fails.clear();
  }
  async session(token) {
    if (typeof token !== 'string' || token.length < 20 || token.length > 80) return null;
    const s = this.one('SELECT * FROM sessions WHERE th = ?', await sha(token));
    if (!s) return null;
    const now = Date.now();
    if (now - s.last > SESSION_MS) {
      this.sql.exec('DELETE FROM sessions WHERE th = ?', s.th);
      return null;
    }
    if (now - s.last > 3600000) this.sql.exec('UPDATE sessions SET last = ? WHERE th = ?', now, s.th);
    return this.one('SELECT id, email, name, created FROM accounts WHERE id = ?', s.id);
  }
  async newSession(id) {
    const token = rand(32), now = Date.now();
    this.sql.exec('INSERT INTO sessions (th, id, created, last) VALUES (?, ?, ?, ?)', await sha(token), id, now, now);
    // keep at most ten devices signed in per account
    const old = this.rows('SELECT th FROM sessions WHERE id = ? ORDER BY last DESC LIMIT -1 OFFSET 10', id);
    for (const o of old) this.sql.exec('DELETE FROM sessions WHERE th = ?', o.th);
    return token;
  }
  saveMeta(id) {
    const s = this.one('SELECT level, saved, length(data) AS size FROM saves WHERE id = ?', id);
    return s ? { level: s.level, saved: s.saved, size: s.size } : null;
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/w') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected a websocket', { status: 426 });
      const pair = new WebSocketPair();
      this.state.acceptWebSocket(pair[1]);
      pair[1].serializeAttachment({ id: null, name: null, party: null, at: Date.now() });
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
    const raw = await req.text();
    if (raw.length > SAVE_MAX + 4000) return json({ error: '太大了' }, 413);
    let b;
    try {
      b = JSON.parse(raw);
    } catch {
      return json({ error: 'bad json' }, 400);
    }
    if (!b || typeof b !== 'object') return json({ error: 'bad body' }, 400);
    const ip = req.headers.get('cf-connecting-ip') || 'local';
    const path = url.pathname.replace(/^\/api/, '');
    const now = Date.now();

    if (path === '/register') {
      const email = String(b.email ?? '').trim().toLowerCase(), name = cleanName(b.name), pw = String(b.pw ?? '');
      if (!EMAIL.test(email)) return json({ error: '邮箱格式不对' }, 400);
      if (!/^[0-9a-f]{64}$/.test(pw)) return json({ error: '密码没有按规矩加密' }, 400);
      if ([...name].length < 2) return json({ error: '名号至少两个字' }, 400);
      if (this.limited('reg:' + ip, 6, 3600000)) return json({ error: '注册太频繁，过一会儿再来' }, 429);
      if (this.one('SELECT id FROM accounts WHERE email = ?', email)) return json({ error: '这个邮箱已经注册过了' }, 409);
      if (this.one('SELECT id FROM accounts WHERE name = ?', name)) return json({ error: '这个名号已经有人用了' }, 409);
      const id = rand(12), salt = rand(16);
      this.sql.exec('INSERT INTO accounts (id, email, name, salt, hash, created, last) VALUES (?, ?, ?, ?, ?, ?, ?)', id, email, name, salt, await stretch(pw, salt, SERVER_ITER), now, now);
      this.miss('reg:' + ip);
      return json({ token: await this.newSession(id), id, name, email, save: null });
    }
    if (path === '/login') {
      const email = String(b.email ?? '').trim().toLowerCase(), pw = String(b.pw ?? '');
      if (this.limited('em:' + email, 8, 900000) || this.limited('ip:' + ip, 40, 900000)) return json({ error: '试错太多次了，十五分钟后再试' }, 429);
      const a = this.one('SELECT * FROM accounts WHERE email = ?', email);
      const ok = a && /^[0-9a-f]{64}$/.test(pw) && same(await stretch(pw, a.salt, SERVER_ITER), a.hash);
      if (!ok) {
        this.miss('em:' + email);
        this.miss('ip:' + ip);
        return json({ error: '邮箱或密码不对' }, 401);
      }
      this.sql.exec('UPDATE accounts SET last = ? WHERE id = ?', now, a.id);
      return json({ token: await this.newSession(a.id), id: a.id, name: a.name, email: a.email, save: this.saveMeta(a.id) });
    }
    const me = await this.session(b.token);
    if (!me) return json({ error: '登录过期了，请重新登录' }, 401);
    if (path === '/me') return json({ id: me.id, name: me.name, email: me.email, save: this.saveMeta(me.id) });
    if (path === '/logout') {
      this.sql.exec('DELETE FROM sessions WHERE th = ?', await sha(b.token));
      return json({ ok: true });
    }
    if (path === '/save/get') {
      const s = this.one('SELECT data, level, saved FROM saves WHERE id = ?', me.id);
      return json(s ?? { data: null });
    }
    if (path === '/save/put') {
      const data = typeof b.data === 'string' ? b.data : '';
      if (!data || data.length > SAVE_MAX) return json({ error: '存档太大或为空' }, 400);
      const level = Math.max(1, Math.min(999, Math.floor(Number(b.level) || 1)));
      this.sql.exec('INSERT INTO saves (id, data, level, saved) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, level = excluded.level, saved = excluded.saved', me.id, data, level, now);
      return json({ ok: true, saved: now });
    }
    if (path === '/password') {
      const pw = String(b.pw ?? ''), old = String(b.old ?? '');
      const a = this.one('SELECT * FROM accounts WHERE id = ?', me.id);
      if (!/^[0-9a-f]{64}$/.test(pw) || !same(await stretch(old, a.salt, SERVER_ITER), a.hash)) return json({ error: '原密码不对' }, 401);
      const salt = rand(16);
      this.sql.exec('UPDATE accounts SET salt = ?, hash = ? WHERE id = ?', salt, await stretch(pw, salt, SERVER_ITER), me.id);
      // every other device signs out
      this.sql.exec('DELETE FROM sessions WHERE id = ? AND th != ?', me.id, await sha(b.token));
      return json({ ok: true });
    }
    return json({ error: 'no such call' }, 404);
  }

  // ---------------------------------------------------------------- the world socket
  sockets() {
    return this.state.getWebSockets().map((ws) => ({ ws, a: ws.deserializeAttachment() ?? {} }));
  }
  online(except) {
    const s = new Set();
    for (const { ws, a } of this.sockets()) if (a.id && ws !== except) s.add(a.id);
    return s;
  }
  to(id, m) {
    const msg = typeof m === 'string' ? m : JSON.stringify(m);
    for (const { ws, a } of this.sockets()) if (a.id === id) this.put(ws, msg);
  }
  put(ws, msg) {
    try {
      ws.send(msg);
    } catch {
      /* closed */
    }
  }
  friendsOf(id) {
    const on = this.online();
    return this.rows('SELECT a.id, a.name FROM friends f JOIN accounts a ON a.id = f.b WHERE f.a = ? ORDER BY a.name', id).map((r) => ({ id: r.id, name: r.name, on: on.has(r.id) }));
  }
  requestsOf(id) {
    return this.rows('SELECT r.src AS id, a.name FROM requests r JOIN accounts a ON a.id = r.src WHERE r.dst = ?', id);
  }
  /** tell my friends I came or went */
  tellFriends(id, on, except) {
    const live = this.online(except);
    for (const f of this.rows('SELECT b FROM friends WHERE a = ?', id)) if (live.has(f.b)) this.to(f.b, { t: 'fon', id, on });
  }
  /** the list of everyone out there, to everyone (throttled) */
  broadcast(force = false, except) {
    const now = Date.now();
    if (!force && now - this.sent < 180) return;
    this.sent = now;
    for (const [k, v] of this.st) if (now - v.at > 12000) this.st.delete(k);
    const ps = [...this.st.values()].map(({ at, ...p }) => p);
    const msg = JSON.stringify({ t: 'w', ps });
    for (const { ws, a } of this.sockets()) if (a.id && ws !== except) this.put(ws, msg);
  }
  async webSocketMessage(ws, msg) {
    if (typeof msg !== 'string' || msg.length > 4000) return;
    let m;
    try {
      m = JSON.parse(msg);
    } catch {
      return;
    }
    const a = ws.deserializeAttachment() ?? {};
    if (m.t === 'ping') return this.put(ws, '{"t":"pong"}');
    if (m.t === 'auth') {
      const me = await this.session(m.token);
      if (!me) {
        this.put(ws, JSON.stringify({ t: 'bad', error: '登录过期了，请重新登录' }));
        try {
          ws.close(4001, 'auth');
        } catch {
          /* gone */
        }
        return;
      }
      const first = !this.online().has(me.id);
      ws.serializeAttachment({ ...a, id: me.id, name: me.name });
      const mail = this.rows('SELECT src, text, at, (SELECT name FROM accounts WHERE id = src) AS name FROM mail WHERE dst = ? ORDER BY n', me.id);
      this.sql.exec('DELETE FROM mail WHERE dst = ?', me.id);
      this.put(ws, JSON.stringify({ t: 'hello', me: { id: me.id, name: me.name }, friends: this.friendsOf(me.id), reqs: this.requestsOf(me.id), mail, log: this.log.slice(-30) }));
      if (first) this.tellFriends(me.id, true);
      return;
    }
    if (!a.id) return; // signed in first
    const now = Date.now();
    if (m.t === 'st') {
      const num = (v, lo, hi) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, +v)) : 0);
      this.st.set(a.id, {
        i: a.id,
        n: a.name,
        x: num(m.x, -9000, 9000),
        y: num(m.y, -2000, 2000),
        z: num(m.z, -9000, 9000),
        yaw: num(m.yaw, -100, 100),
        vx: num(m.vx, -40, 40),
        vz: num(m.vz, -40, 40),
        a: cleanText(m.a, 24),
        m: cleanText(m.m, 48),
        l: num(m.l, 1, 999),
        h: num(m.h, 0, 1),
        r: num(m.r, -1, 999),
        g: cleanText(m.g, 120),
        p: a.party ?? null,
        at: now,
      });
      return this.broadcast();
    }
    if (m.t === 'party') {
      ws.serializeAttachment({ ...a, party: m.room ? cleanText(m.room, 12) : null });
      return;
    }
    if (m.t === 'chat') {
      const text = cleanText(m.text, 120);
      if (!text) return;
      if (now - (this.talk.get(a.id) ?? 0) < 700) return this.put(ws, JSON.stringify({ t: 'sys', text: '说得太快了，歇口气' }));
      this.talk.set(a.id, now);
      const ch = ['world', 'near', 'party', 'whisper'].includes(m.ch) ? m.ch : 'world';
      const out = { t: 'chat', ch, from: a.id, name: a.name, text, at: now };
      if (ch === 'world') {
        this.log.push(out);
        if (this.log.length > 60) this.log.splice(0, 20);
        const s = JSON.stringify(out);
        for (const o of this.sockets()) if (o.a.id) this.put(o.ws, s);
      } else if (ch === 'near') {
        const me = this.st.get(a.id);
        const s = JSON.stringify(out);
        for (const o of this.sockets()) {
          if (!o.a.id) continue;
          const p = this.st.get(o.a.id);
          if (o.a.id === a.id || (me && p && p.r === me.r && Math.hypot(p.x - me.x, p.z - me.z) < 60)) this.put(o.ws, s);
        }
      } else if (ch === 'party') {
        if (!a.party) return this.put(ws, JSON.stringify({ t: 'sys', text: '你还没有组队' }));
        const s = JSON.stringify(out);
        for (const o of this.sockets()) if (o.a.id && o.a.party === a.party) this.put(o.ws, s);
      } else {
        // 私聊: by id or by 名号; a friend who's away finds it waiting
        const tgt = this.one('SELECT id, name FROM accounts WHERE id = ? OR name = ?', String(m.to ?? ''), String(m.to ?? ''));
        if (!tgt) return this.put(ws, JSON.stringify({ t: 'sys', text: '没有这个人' }));
        const w = { ...out, to: tgt.id, toName: tgt.name };
        if (this.online().has(tgt.id)) this.to(tgt.id, w);
        else if (this.one('SELECT 1 AS x FROM friends WHERE a = ? AND b = ?', a.id, tgt.id)) {
          this.sql.exec('INSERT INTO mail (dst, src, text, at) VALUES (?, ?, ?, ?)', tgt.id, a.id, text, now);
          this.sql.exec('DELETE FROM mail WHERE n IN (SELECT n FROM mail WHERE dst = ? ORDER BY n DESC LIMIT -1 OFFSET 30)', tgt.id);
          this.put(ws, JSON.stringify({ t: 'sys', text: `${tgt.name}不在线，话已经留下了` }));
        } else return this.put(ws, JSON.stringify({ t: 'sys', text: `${tgt.name}不在线` }));
        if (tgt.id !== a.id) this.to(a.id, w);
      }
      return;
    }
    if (m.t === 'freq') {
      const tgt = this.one('SELECT id, name FROM accounts WHERE id = ? OR name = ?', String(m.to ?? ''), String(m.to ?? ''));
      if (!tgt || tgt.id === a.id) return this.put(ws, JSON.stringify({ t: 'sys', text: '没有这个人' }));
      if (this.one('SELECT 1 AS x FROM friends WHERE a = ? AND b = ?', a.id, tgt.id)) return this.put(ws, JSON.stringify({ t: 'sys', text: `${tgt.name}已经是你的好友了` }));
      // they asked me already: that's a yes both ways
      if (this.one('SELECT 1 AS x FROM requests WHERE src = ? AND dst = ?', tgt.id, a.id)) return this.befriend(a.id, tgt.id);
      if (this.rows('SELECT src FROM requests WHERE src = ?', a.id).length > 50) return this.put(ws, JSON.stringify({ t: 'sys', text: '发出的请求太多了' }));
      this.sql.exec('INSERT OR REPLACE INTO requests (src, dst, at) VALUES (?, ?, ?)', a.id, tgt.id, now);
      this.to(tgt.id, { t: 'freq', from: a.id, name: a.name });
      return this.put(ws, JSON.stringify({ t: 'sys', text: `已向${tgt.name}发出好友请求` }));
    }
    if (m.t === 'fans') {
      const src = String(m.from ?? '');
      if (!this.one('SELECT 1 AS x FROM requests WHERE src = ? AND dst = ?', src, a.id)) return;
      this.sql.exec('DELETE FROM requests WHERE src = ? AND dst = ?', src, a.id);
      if (m.ok) return this.befriend(a.id, src);
      this.put(ws, JSON.stringify({ t: 'friends', friends: this.friendsOf(a.id), reqs: this.requestsOf(a.id) }));
      return;
    }
    if (m.t === 'fdel') {
      const id = String(m.id ?? '');
      this.sql.exec('DELETE FROM friends WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)', a.id, id, id, a.id);
      this.to(a.id, { t: 'friends', friends: this.friendsOf(a.id), reqs: this.requestsOf(a.id) });
      this.to(id, { t: 'friends', friends: this.friendsOf(id), reqs: this.requestsOf(id) });
      return;
    }
    if (m.t === 'inv' || m.t === 'invr') {
      const to = String(m.to ?? '');
      if (!this.online().has(to)) return this.put(ws, JSON.stringify({ t: 'sys', text: '对方不在线' }));
      this.to(to, { t: m.t, from: a.id, name: a.name, room: m.t === 'inv' ? cleanText(m.room, 12) : undefined, ok: !!m.ok });
      return;
    }
  }
  befriend(x, y) {
    const now = Date.now();
    this.sql.exec('INSERT OR IGNORE INTO friends (a, b, since) VALUES (?, ?, ?)', x, y, now);
    this.sql.exec('INSERT OR IGNORE INTO friends (a, b, since) VALUES (?, ?, ?)', y, x, now);
    this.sql.exec('DELETE FROM requests WHERE (src = ? AND dst = ?) OR (src = ? AND dst = ?)', x, y, y, x);
    const nx = this.one('SELECT name FROM accounts WHERE id = ?', x)?.name, ny = this.one('SELECT name FROM accounts WHERE id = ?', y)?.name;
    this.to(x, { t: 'friends', friends: this.friendsOf(x), reqs: this.requestsOf(x), note: `你和${ny}成了好友` });
    this.to(y, { t: 'friends', friends: this.friendsOf(y), reqs: this.requestsOf(y), note: `你和${nx}成了好友` });
  }
  webSocketClose(ws, code) {
    const a = ws.deserializeAttachment() ?? {};
    try {
      ws.close(code === 1005 ? 1000 : code, 'bye');
    } catch {
      /* already closed */
    }
    if (a.id && !this.online(ws).has(a.id)) {
      this.st.delete(a.id);
      this.tellFriends(a.id, false, ws);
      this.broadcast(true, ws);
    }
  }
  webSocketError(ws) {
    this.webSocketClose(ws, 1011);
  }
}

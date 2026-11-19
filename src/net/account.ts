// 账号 (owner: accounts by email and password): sign up or in against the hub (relay/src/hub.js), keep the session in
// localStorage `tq2_auth`, and keep the save in the cloud: the progress and the world clock go up a minute after they
// change (and as the page closes); signing in on another device offers the cloud's save instead of that device's.
// The password never leaves the page as typed: it's stretched here (PBKDF2-SHA256, 100 000 rounds, salted with the
// email) and only that goes to the hub, which salts and stretches it again before keeping it.
import { RELAY_URL } from './relay';

export const API = RELAY_URL.replace(/^ws/, 'http');
const KEY = 'tq2_auth';
export interface Auth {
  token: string;
  id: string;
  name: string;
  email: string;
}
export interface SaveMeta {
  level: number;
  saved: number;
}
export const account = {
  auth: null as Auth | null,
  /** the cloud's save as last heard of */
  cloud: null as SaveMeta | null,
  /** a sign-in found a cloud save: ask which to keep */
  choose: null as { cloud: SaveMeta; local: number } | null,
  lastUp: 0,
  lastSent: '',
  status: '',
};
try {
  const a = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (a && typeof a.token === 'string') account.auth = a;
} catch {
  /* none */
}
const enc = new TextEncoder();
async function stretch(email: string, pw: string) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('tianque2|' + email.trim().toLowerCase()), iterations: 100000 }, k, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function call(path: string, body: object): Promise<any> {
  let r: Response;
  try {
    // text/plain: a simple request (no preflight); the hub reads it as JSON
    r = await fetch(`${API}/api${path}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'text/plain' } });
  } catch {
    return { error: '连不上服务器' };
  }
  try {
    const j = await r.json();
    if (r.status === 401 && path !== '/login') signedOut();
    return j;
  } catch {
    return { error: `服务器出错（${r.status}）` };
  }
}
function keep(a: Auth | null) {
  account.auth = a;
  try {
    if (a) localStorage.setItem(KEY, JSON.stringify(a));
    else localStorage.removeItem(KEY);
  } catch {
    /* private window */
  }
  listeners.forEach((f) => f());
}
const listeners = new Set<() => void>();
/** told when you sign in or out (the world socket listens) */
export const onAuth = (f: () => void) => (listeners.add(f), () => listeners.delete(f));
function signedOut() {
  keep(null);
  account.cloud = null;
  account.choose = null;
}
const levelHere = () => {
  try {
    return JSON.parse(localStorage.getItem('tq2_progress_v2') || 'null')?.level ?? 0;
  } catch {
    return 0;
  }
};

export const EMAIL_OK = (e: string) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test(e.trim());
export async function register(email: string, pw: string, name: string): Promise<string | null> {
  if (!EMAIL_OK(email)) return '邮箱格式不对';
  if (pw.length < 8) return '密码至少八位';
  if ([...name.trim()].length < 2) return '名号至少两个字';
  const r = await call('/register', { email, name: name.trim(), pw: await stretch(email, pw) });
  if (r.error) return r.error;
  keep({ token: r.token, id: r.id, name: r.name, email: r.email });
  account.cloud = null;
  await upload(true); // this device's save becomes the account's
  return null;
}
export async function login(email: string, pw: string): Promise<string | null> {
  if (!EMAIL_OK(email)) return '邮箱格式不对';
  const r = await call('/login', { email, pw: await stretch(email, pw) });
  if (r.error) return r.error;
  keep({ token: r.token, id: r.id, name: r.name, email: r.email });
  account.cloud = r.save;
  // a save in the cloud: which one to play (unless this device has none worth keeping)
  if (r.save) {
    const here = levelHere();
    if (here <= 1 && r.save.level >= 1) await pickCloud();
    else account.choose = { cloud: r.save, local: here };
  } else await upload(true);
  return null;
}
export async function logout() {
  if (account.auth) {
    await upload(true);
    await call('/logout', { token: account.auth.token });
  }
  signedOut();
}
export async function changePassword(old: string, pw: string): Promise<string | null> {
  const a = account.auth;
  if (!a) return '还没登录';
  if (pw.length < 8) return '新密码至少八位';
  const r = await call('/password', { token: a.token, old: await stretch(a.email, old), pw: await stretch(a.email, pw) });
  return r.error ?? null;
}
/** still signed in? (on start) */
export async function checkSession() {
  if (!account.auth) return;
  const r = await call('/me', { token: account.auth.token });
  if (!r.error) account.cloud = r.save;
}
const snapshot = () => {
  const p = localStorage.getItem('tq2_progress_v2'), w = localStorage.getItem('tq2_world_v1');
  return p ? JSON.stringify({ v: 1, p, w }) : '';
};
/** the save up to the cloud (when it changed, or `force`) */
export async function upload(force = false) {
  const a = account.auth;
  if (!a || account.choose) return;
  const data = snapshot();
  if (!data || (!force && data === account.lastSent)) return;
  const r = await call('/save/put', { token: a.token, data, level: levelHere() || 1 });
  if (!r.error) {
    account.lastSent = data;
    account.lastUp = Date.now();
    account.cloud = { level: levelHere() || 1, saved: r.saved };
    account.status = '';
  } else account.status = r.error;
}
/** play the cloud's save: write it here and start again from it */
export async function pickCloud() {
  const a = account.auth;
  if (!a) return;
  const r = await call('/save/get', { token: a.token });
  if (r.error || !r.data) {
    account.choose = null;
    return;
  }
  try {
    const d = JSON.parse(r.data);
    if (d.p) localStorage.setItem('tq2_progress_v2', d.p);
    if (d.w) localStorage.setItem('tq2_world_v1', d.w);
  } catch {
    return;
  }
  account.choose = null;
  location.reload();
}
/** keep this device's save (it goes up over the cloud's) */
export async function pickLocal() {
  account.choose = null;
  await upload(true);
}
// a minute after a change, and as the page goes away
if (typeof window !== 'undefined') {
  setInterval(() => void upload(), 60000);
  const away = () => {
    const a = account.auth, data = snapshot();
    if (!a || account.choose || !data || data === account.lastSent) return;
    const body = JSON.stringify({ token: a.token, data, level: levelHere() || 1 });
    try {
      navigator.sendBeacon?.(`${API}/api/save/put`, new Blob([body], { type: 'text/plain' }));
      account.lastSent = data;
    } catch {
      /* gone */
    }
  };
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && away());
  window.addEventListener('pagehide', away);
}

// 聊天 (Enter): the last few lines bottom left (they fade unless you're typing), a line to type in with its channel
// (附近 / 世界 / 队伍 / 私聊; or start with /n /s /p, or /w 名号 for a whisper), and above it what's asked of you: friend
// requests and party invites, each with its answer. Also the one question a sign-in can ask: which save to play.
import { useEffect, useRef, useState } from 'react';
import type { Sim } from '../game/sim';
import { answerFriend, answerInvite, chat, world, type ChatMsg } from '../net/world';
import { account, pickCloud, pickLocal } from '../net/account';

const CH: Record<ChatMsg['ch'], string> = { near: '附近', world: '世界', party: '队伍', whisper: '私聊', sys: '系统' };
const ORDER: ChatMsg['ch'][] = ['near', 'world', 'party', 'whisper'];
const ago = (t: number) => {
  const s = (Date.now() - t) / 1000;
  return s < 60 ? '刚才' : s < 3600 ? `${Math.floor(s / 60)} 分钟前` : s < 86400 ? `${Math.floor(s / 3600)} 小时前` : `${Math.floor(s / 86400)} 天前`;
};

/** a sign-in found a save in the cloud: which one to play */
export function SaveChoice() {
  const [, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((n) => n + 1), 400);
    return () => clearInterval(t);
  }, []);
  const P = account.choose;
  return (
    <>
      {P && (
        <div className="game-wrap">
          <div className="game-box">
            <div className="game-title">选存档</div>
            <p className="game-note">
              这个账号在云端有存档：{P.cloud.level} 级，{ago(P.cloud.saved)}存的。这台设备上的存档是 {P.local} 级。玩哪一个？
            </p>
            <p className="game-tip">选了一个，另一个就会被它盖掉。</p>
            <div className="online-row">
              <button className="hot" onClick={() => void pickCloud()}>
                用云端存档（{P.cloud.level} 级）
              </button>
              <button onClick={() => void pickLocal().then(() => setN((n) => n + 1))}>用这台设备的（{P.local} 级）</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function Chat({ sim, open, setOpen }: { sim: Sim; open: boolean; setOpen: (v: boolean) => void }) {
  const [, setN] = useState(0);
  const [text, setText] = useState('');
  const [ch, setCh] = useState<ChatMsg['ch']>('near');
  const [to, setTo] = useState('');
  const box = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setInterval(() => setN((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);
  // Enter opens (when nothing else has the keys); Esc closes
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.code === 'Enter' && !open && tag !== 'INPUT' && tag !== 'TEXTAREA' && !sim.game && sim.dialog < 0) {
        e.preventDefault();
        if (document.pointerLockElement) document.exitPointerLock();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, sim, setOpen]);
  useEffect(() => {
    if (open) setTimeout(() => box.current?.focus(), 0);
  }, [open]);
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [world.chat.length, open]);
  // whisper someone from elsewhere (a name clicked, the friend list)
  useEffect(() => {
    const h = (e: Event) => {
      const n = (e as CustomEvent).detail as string;
      setCh('whisper');
      setTo(n);
      setOpen(true);
    };
    window.addEventListener('tq-whisper', h);
    return () => window.removeEventListener('tq-whisper', h);
  }, [setOpen]);
  const sendLine = () => {
    let t = text.trim();
    let c = ch, who = to;
    const m = t.match(/^\/(w|n|s|p)\s+(.*)$/);
    if (m) {
      c = ({ w: 'whisper', n: 'near', s: 'world', p: 'party' } as const)[m[1] as 'w'];
      t = m[2];
      if (c === 'whisper') {
        const sp = t.indexOf(' ');
        who = sp > 0 ? t.slice(0, sp) : t;
        t = sp > 0 ? t.slice(sp + 1) : '';
        setTo(who);
      }
      setCh(c);
    }
    if (t) {
      if (c === 'whisper' && !who) return;
      chat(c, t, c === 'whisper' ? who : undefined);
    }
    setText('');
    setOpen(false);
  };
  const now = Date.now();
  const shown = open ? world.chat.slice(-40) : world.chat.slice(-7).filter((m) => now - m.at < 15000);
  return (
    <>
      <SaveChoice />
      <div className="notices">
        {world.reqs.slice(0, 3).map((r) => (
          <div key={'f' + r.id} className="notice">
            <b>{r.name}</b> 想加你为好友
            <button className="hot" onClick={() => answerFriend(r.id, true)}>
              同意
            </button>
            <button onClick={() => answerFriend(r.id, false)}>拒绝</button>
          </div>
        ))}
        {world.invites
          .filter((v) => now - v.at < 90000)
          .slice(0, 2)
          .map((v) => (
            <div key={'i' + v.from} className="notice">
              <b>{v.name}</b> 邀请你组队
              <button className="hot" onClick={() => answerInvite(sim, v.from, true)}>
                进他的江湖
              </button>
              <button onClick={() => answerInvite(sim, v.from, false)}>不了</button>
            </div>
          ))}
      </div>
      <div className={'chat' + (open ? ' open' : '')}>
        <div className="chat-list" ref={list}>
          {shown.map((m, k) => (
            <div key={k + ':' + m.at} className={'chat-line ch-' + m.ch}>
              <span className="chat-ch">[{CH[m.ch]}]</span>
              {m.ch === 'whisper' && m.from === world.me?.id ? (
                <>
                  你对
                  <a onClick={() => window.dispatchEvent(new CustomEvent('tq-whisper', { detail: m.toName }))}>{m.toName}</a>：
                </>
              ) : m.name ? (
                <>
                  <a onClick={() => m.from !== world.me?.id && window.dispatchEvent(new CustomEvent('tq-whisper', { detail: m.name }))}>{m.name}</a>：
                </>
              ) : null}
              {m.text}
            </div>
          ))}
          {open && !world.chat.length && <div className="chat-line ch-sys">{world.me ? '还没人说话。' : '登录后才能聊天（O 江湖 → 账号）。'}</div>}
        </div>
        {open && (
          <div className="chat-in">
            <button className={'chat-chan ch-' + ch} onClick={() => setCh(ORDER[(ORDER.indexOf(ch) + 1) % ORDER.length])} title="点一下换频道（或 Tab）">
              {CH[ch]}
            </button>
            {ch === 'whisper' && <input className="chat-to" value={to} placeholder="名号" maxLength={12} onChange={(e) => setTo(e.target.value)} />}
            <input
              ref={box}
              value={text}
              maxLength={120}
              placeholder={ch === 'whisper' ? '悄悄话……' : '说点什么，回车发出'}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') sendLine();
                else if (e.key === 'Escape') {
                  setText('');
                  setOpen(false);
                } else if (e.key === 'Tab') {
                  e.preventDefault();
                  setCh(ORDER[(ORDER.indexOf(ch) + 1) % ORDER.length]);
                }
              }}
            />
          </div>
        )}
        {!open && world.me && <div className="chat-hint">Enter 聊天</div>}
      </div>
    </>
  );
}

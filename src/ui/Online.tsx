// 江湖 (O): your account (sign up / in with an email and a password, the cloud save, sign out), your friends (who's
// online and how far, whisper, invite, add by 名号, requests), everyone online, and 组队 (a 联机 room: open one and read
// its letters out, or type a friend's letters; an invite does the same in one click). From the very start of the game.
import { useEffect, useState } from 'react';
import type { Sim } from '../game/sim';
import { coop, hostRoom, joinRoom, leave } from '../net/coop';
import { account, changePassword, login, logout, register, upload } from '../net/account';
import { addFriend, answerFriend, dropFriend, invite, world } from '../net/world';

type Tab = 'me' | 'friends' | 'all' | 'party';
const whisper = (name: string) => window.dispatchEvent(new CustomEvent('tq-whisper', { detail: name }));

/** sign up or sign in (also on the start screen) */
export function AccountForm({ onDone }: { onDone?: () => void }) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (mode === 'up' && pw !== pw2) return setErr('两次密码不一样');
    setBusy(true);
    setErr('');
    const e = mode === 'in' ? await login(email, pw) : await register(email, pw, name);
    setBusy(false);
    if (e) setErr(e);
    else onDone?.();
  };
  const stop = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !busy) void go();
  };
  return (
    <div className="acct-form">
      <div className="ward-tabs">
        <button className={mode === 'in' ? 'on' : ''} onClick={() => (setMode('in'), setErr(''))}>
          登录
        </button>
        <button className={mode === 'up' ? 'on' : ''} onClick={() => (setMode('up'), setErr(''))}>
          注册
        </button>
      </div>
      <label>
        邮箱
        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={stop} />
      </label>
      {mode === 'up' && (
        <label>
          名号
          <input value={name} maxLength={12} placeholder="江湖上怎么称呼你（2 到 12 字）" onChange={(e) => setName(e.target.value)} onKeyDown={stop} />
        </label>
      )}
      <label>
        密码
        <input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={stop} />
      </label>
      {mode === 'up' && (
        <label>
          再输一遍
          <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={stop} />
        </label>
      )}
      {err && <p className="game-note warn">{err}</p>}
      <div className="online-row">
        <button className="hot" disabled={busy || !email || !pw} onClick={() => void go()}>
          {busy ? '稍等……' : mode === 'in' ? '登录' : '注册并登录'}
        </button>
      </div>
      <p className="game-tip">
        {mode === 'up' ? '密码至少八位。注册后，这台设备上的存档就跟着账号走，换台电脑登录也能接着玩。' : '登录后存档会存到云端；在别的设备登录可以接着玩。'}
        没有找回密码的邮件，请记好密码。
      </p>
    </div>
  );
}

function Me({ sim }: { sim: Sim }) {
  const [old, setOld] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [chg, setChg] = useState(false);
  const a = account.auth!;
  void sim;
  const c = account.cloud;
  return (
    <div className="acct-me">
      <p className="online-code">
        <b>{a.name}</b>
      </p>
      <p className="game-note">{a.email}</p>
      <p className="game-note">
        {world.status === 'on' ? `已连上江湖 · 在线 ${world.players.length} 人` : world.status === 'connecting' ? '正在连接江湖……' : world.status === 'retry' ? '江湖连接断了，重连中……' : '未连接'}
      </p>
      <p className="game-note">
        云端存档：{c ? `${c.level} 级，${new Date(c.saved).toLocaleString()}` : '还没有'}
        {account.status && <span className="warn"> · {account.status}</span>}
      </p>
      <div className="online-row">
        <button onClick={() => void upload(true).then(() => setMsg('已存到云端'))}>立即存到云端</button>
        <button onClick={() => setChg((v) => !v)}>改密码</button>
        <button onClick={() => void logout()}>退出登录</button>
      </div>
      {chg && (
        <div className="acct-form">
          <label>
            原密码
            <input type="password" autoComplete="current-password" value={old} onChange={(e) => setOld(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
          </label>
          <label>
            新密码
            <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
          </label>
          <div className="online-row">
            <button className="hot" onClick={() => void changePassword(old, pw).then((e) => (setMsg(e ?? '密码改好了，其他设备要重新登录'), setOld(''), setPw('')))}>
              确定
            </button>
          </div>
        </div>
      )}
      {msg && <p className="game-note">{msg}</p>}
    </div>
  );
}

const distOf = (sim: Sim, id: string) => {
  const o = world.players.find((p) => p.i === id);
  if (!o) return null;
  if (o.r !== sim.indoor) return '在屋里';
  const d = Math.hypot(o.x - sim.player.pos[0], o.z - sim.player.pos[2]);
  return d < 1000 ? `${Math.round(d)} 米外` : `${(d / 1000).toFixed(1)} 里外`;
};
function Friends({ sim }: { sim: Sim }) {
  const [name, setName] = useState('');
  const [drop, setDrop] = useState('');
  const on = world.friends.filter((f) => f.on), off = world.friends.filter((f) => !f.on);
  return (
    <div>
      {world.reqs.length > 0 && (
        <>
          <div className="party-sub">好友请求</div>
          <div className="board-list">
            {world.reqs.map((r) => (
              <div key={r.id} className="board-item online-person">
                <b>{r.name}</b>
                <span>
                  <button className="hot" onClick={() => answerFriend(r.id, true)}>
                    同意
                  </button>
                  <button onClick={() => answerFriend(r.id, false)}>拒绝</button>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="party-sub">好友（{on.length} 在线 / {world.friends.length}）</div>
      <div className="board-list">
        {[...on, ...off].map((f) => (
          <div key={f.id} className={'board-item online-person' + (f.on ? '' : ' done')}>
            <span>
              <i className={'dot' + (f.on ? ' on' : '')} /> <b>{f.name}</b> <span className="bi-where">{f.on ? distOf(sim, f.id) ?? '在线' : '不在线'}</span>
            </span>
            <span>
              <button onClick={() => whisper(f.name)}>{f.on ? '私聊' : '留言'}</button>
              {f.on && <button onClick={() => invite(sim, f.id)}>邀请组队</button>}
              {drop === f.id ? (
                <button className="hot" onClick={() => (dropFriend(f.id), setDrop(''))}>
                  确定删除
                </button>
              ) : (
                <button onClick={() => setDrop(f.id)}>删除</button>
              )}
            </span>
          </div>
        ))}
        {!world.friends.length && <p className="game-tip">还没有好友。在路上遇到人，走过去按 F；或者在下面输入名号。</p>}
      </div>
      <div className="online-row">
        <input value={name} maxLength={12} placeholder="好友的名号" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
        <button disabled={!name.trim()} onClick={() => (addFriend(name.trim()), setName(''))}>
          加好友
        </button>
      </div>
    </div>
  );
}
function All({ sim }: { sim: Sim }) {
  const friends = new Set(world.friends.map((f) => f.id));
  const list = world.players.filter((p) => p.i !== world.me?.id);
  const d = (p: (typeof list)[number]) => (p.r === sim.indoor ? Math.hypot(p.x - sim.player.pos[0], p.z - sim.player.pos[2]) : 1e9);
  return (
    <div>
      <div className="party-sub">在线的人（{list.length + 1}，含你）</div>
      <div className="board-list">
        {[...list]
          .sort((a, b) => d(a) - d(b))
          .map((p) => (
            <div key={p.i} className="board-item online-person">
              <span>
                <b>{p.n}</b> <span className="bi-where">{p.l} 级 · {distOf(sim, p.i)}</span>
              </span>
              <span>
                <button onClick={() => whisper(p.n)}>私聊</button>
                {!friends.has(p.i) && <button onClick={() => addFriend(p.i)}>加好友</button>}
                <button onClick={() => invite(sim, p.i)}>邀请组队</button>
              </span>
            </div>
          ))}
        {!list.length && <p className="game-tip">现在只有你一个人在江湖里。</p>}
      </div>
    </div>
  );
}
function Party({ sim, redraw }: { sim: Sim; redraw: () => void }) {
  const [code, setCode] = useState('');
  return (
    <div>
      {coop.role === 'off' && (
        <>
          <p className="game-note">组队就是请人进你的江湖：开个房间，把四个字母告诉朋友；或者输入朋友的四个字母，进他的江湖。也可以在好友里直接点「邀请组队」。最多四人。在别人的江湖里，怪、任务和世界都是房主的，打到的经验和铜钱记在自己身上。</p>
          <div className="online-row">
            <button className="hot" onClick={() => (hostRoom(sim), redraw())}>
              开房间
            </button>
          </div>
          <div className="online-row">
            <input value={code} maxLength={4} placeholder="四个字母" onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.stopPropagation()} />
            <button disabled={code.length !== 4} onClick={() => (joinRoom(sim, code), redraw())}>
              加入
            </button>
          </div>
        </>
      )}
      {coop.role !== 'off' && (
        <>
          {coop.role === 'host' && (
            <p className="online-code">
              房间号 <b>{coop.room.slice(2)}</b>
            </p>
          )}
          <p className="game-note">{coop.status}</p>
          {coop.role === 'host' && coop.peers.length > 0 && <p className="game-note">队友：{coop.peers.map((p) => p.name).join('、')}</p>}
          <div className="online-row">
            <button onClick={() => (leave(sim), redraw())}>{coop.role === 'host' ? '解散队伍' : '离开（回到自己的江湖）'}</button>
          </div>
        </>
      )}
    </div>
  );
}

export function Online({ sim, onClose }: { sim: Sim; onClose: () => void }) {
  const [, setN] = useState(0);
  const [tab, setTab] = useState<Tab>(account.auth ? 'friends' : 'me');
  useEffect(() => {
    const t = setInterval(() => setN((n) => n + 1), 400);
    return () => clearInterval(t);
  }, []);
  const redraw = () => setN((n) => n + 1);
  const signed = !!account.auth;
  return (
    <div className="game-wrap">
      <div className="game-box online-box">
        <div className="game-title">江 湖</div>
        <div className="ward-tabs">
          {(
            [
              ['me', signed ? '账号' : '登录 / 注册'],
              ['friends', `好友${world.reqs.length ? ` (${world.reqs.length})` : ''}`],
              ['all', '在线'],
              ['party', '组队'],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>
        {tab === 'me' && (signed ? <Me sim={sim} /> : <AccountForm onDone={() => setTab('friends')} />)}
        {tab === 'friends' && (signed ? <Friends sim={sim} /> : <p className="game-note">登录后才能加好友。</p>)}
        {tab === 'all' && (signed ? <All sim={sim} /> : <p className="game-note">登录后，在线的人都在同一个江湖里，路上就能遇见。</p>)}
        {tab === 'party' && <Party sim={sim} redraw={redraw} />}
        <button className="game-close" onClick={onClose}>
          离开 (Esc)
        </button>
      </div>
    </div>
  );
}

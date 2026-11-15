// 联机 (O): host a room and read its four letters out to a friend, or type a friend's letters to walk into their
// world. Opens once 伪帝 has fallen (net/coop.ts).
import { useEffect, useState } from 'react';
import type { Sim } from '../game/sim';
import { canCoop, coop, hostRoom, joinRoom, leave } from '../net/coop';
import { RELAY_URL } from '../net/relay';

export function Online({ sim, onClose }: { sim: Sim; onClose: () => void }) {
  const [code, setCode] = useState('');
  const [, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((n) => n + 1), 400);
    return () => clearInterval(t);
  }, []);
  const ok = canCoop(sim);
  return (
    <div className="game-wrap">
      <div className="game-box online-box">
        <div className="game-title">联机</div>
        {!ok && <p className="game-note">天阙的钟响过之后（打败伪帝），才能和朋友一起闯江湖。</p>}
        {ok && coop.role === 'off' && (
          <>
            <p className="game-note">开一个房间，把四个字母告诉朋友；或者输入朋友的四个字母，走进他的江湖。最多四人。在别人的江湖里，怪、任务和世界都是房主的，你打到的经验和铜钱记在自己身上。</p>
            <div className="online-row">
              <button className="hot" onClick={() => (hostRoom(sim), setN((n) => n + 1))}>
                开房间
              </button>
            </div>
            <div className="online-row">
              <input value={code} maxLength={4} placeholder="四个字母" onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.stopPropagation()} />
              <button disabled={code.length !== 4} onClick={() => (joinRoom(sim, code), setN((n) => n + 1))}>
                加入
              </button>
            </div>
          </>
        )}
        {ok && coop.role !== 'off' && (
          <>
            {coop.role === 'host' && (
              <p className="online-code">
                房间号 <b>{coop.room.slice(2)}</b>
              </p>
            )}
            <p className="game-note">{coop.status}</p>
            {coop.role === 'host' && coop.peers.length > 0 && <p className="game-note">同伴：{coop.peers.map((p) => p.name).join('、')}</p>}
            <div className="online-row">
              <button onClick={() => (leave(sim), setN((n) => n + 1))}>{coop.role === 'host' ? '关闭房间' : '离开（回到自己的江湖）'}</button>
            </div>
          </>
        )}
        <p className="game-note online-tip">服务器：{RELAY_URL.replace(/^wss?:\/\//, '')}</p>
        <button className="game-close" onClick={onClose}>
          离开 (Esc)
        </button>
      </div>
    </div>
  );
}

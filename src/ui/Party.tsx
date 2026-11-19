// 同伴 (P): who rides with you (two at most), who waits in the village, who's still on the bounty board. Swap them from
// anywhere: one called from far off comes along the road a moment later, one sent home sets off and is simply there.
// How they fight: 抢攻 (at any foe near you the moment they see it) or 护卫 (only at whoever comes at you).
import { useState } from 'react';
import type { Sim } from '../game/sim';
import { COMP_PERK, PARTY_MAX, callComp, party, sendComp, setStance, stanceOf, type PartyRow } from '../game/jianghu';
import { roadPoint } from '../game/layout';

const short = (name: string) => name.split(' · ');
const where = (road: number) => {
  const [x, z] = roadPoint(road, 250);
  const a = ((Math.atan2(-z, x) * 180) / Math.PI + 360 + 22.5) % 360;
  return ['东', '东北', '北', '西北', '西', '西南', '南', '东南'][Math.floor(a / 45)];
};
const STATE: Record<PartyRow['state'], string> = { follow: '跟在你身边', home: '在村里等你', wait: '在原地等你', down: '受了重伤，在缓气', coming: '正往你这儿赶', locked: '还没结识' };

function Pic({ id, dim }: { id: string; dim?: boolean }) {
  return (
    <div className={'party-pic' + (dim ? ' dim' : '')}>
      <img src={`${import.meta.env.BASE_URL}portraits/comp-${id}.png`} alt="" onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')} />
    </div>
  );
}
function Heart({ aff }: { aff: number }) {
  return (
    <div className="party-aff" title="好感（30 / 60 / 100 时会跟你说心里话）">
      <div className="party-aff-bar" style={{ width: `${Math.min(100, aff)}%` }} />
      {[30, 60].map((m) => (
        <i key={m} style={{ left: `${m}%` }} />
      ))}
      <span>好感 {Math.round(aff)}</span>
    </div>
  );
}

export function Party({ sim, onClose }: { sim: Sim; onClose: () => void }) {
  const [, setN] = useState(0);
  const [pick, setPick] = useState<string | null>(null); // the one you want to bring, while you choose whom to send home
  const [msg, setMsg] = useState('');
  const redraw = () => setN((k) => k + 1);
  const rows = party(sim);
  const along = rows.filter((w) => w.c?.mode === 'follow');
  const rest = rows.filter((w) => w.c?.mode !== 'follow');
  const st = stanceOf(sim.progress);
  const bring = (id: string) => {
    if (along.length >= PARTY_MAX) return setPick(id);
    const err = callComp(sim, id);
    setMsg(err ?? '');
    redraw();
  };
  const swap = (out: string) => {
    if (!pick) return;
    const err = callComp(sim, pick, out);
    setMsg(err ?? '');
    setPick(null);
    redraw();
  };
  const picked = rows.find((w) => w.r.id === pick);
  return (
    <div className="game-wrap">
      <div className="game-box party-box">
        <div className="game-title">同 伴</div>
        <div className="party-stance">
          <span>出手</span>
          <button className={st === 'charge' ? 'on' : ''} onClick={() => (setStance(sim, 'charge'), redraw())}>
            抢攻 · 见敌就上
          </button>
          <button className={st === 'guard' ? 'on' : ''} onClick={() => (setStance(sim, 'guard'), redraw())}>
            护卫 · 只打来犯之敌
          </button>
        </div>
        <div className="party-sub">身边（最多 {PARTY_MAX} 位）</div>
        <div className="party-along">
          {Array.from({ length: PARTY_MAX }, (_, k) => {
            const w = along[k];
            if (!w) return <div key={k} className="party-slot empty">空位：从下面挑一位带上</div>;
            const [title, name] = short(w.r.name);
            const f = w.f!;
            return (
              <div key={w.r.id} className={'party-slot' + (pick ? ' choose' : '')}>
                <Pic id={w.r.id} />
                <div className="party-info">
                  <div className="party-name">
                    <b>{name}</b> <span>{title}</span>
                  </div>
                  <div className="party-role">{COMP_PERK[w.r.id]?.role}</div>
                  <div className="party-perk">{COMP_PERK[w.r.id]?.perk}</div>
                  <div className="party-hp">
                    <div style={{ width: `${f.maxHp ? (f.hp / f.maxHp) * 100 : 0}%` }} />
                  </div>
                  <Heart aff={w.c!.aff} />
                  <div className="party-state">
                    {STATE[w.state]}
                    {w.state === 'down' && f.respawn ? `（${Math.ceil(f.respawn)} 秒）` : ''} · {f.level} 级
                  </div>
                  <div className="party-btns">
                    {pick ? (
                      <button className="hot" onClick={() => swap(w.r.id)}>
                        换下{name}
                      </button>
                    ) : (
                      <>
                        <button onClick={() => (sendComp(sim, w.r.id, 'home'), redraw())}>回村等我</button>
                        <button onClick={() => (sendComp(sim, w.r.id, 'wait'), redraw())}>在这儿等着</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {pick && picked && (
          <div className="party-ask">
            要带上{short(picked.r.name)[1]}，先换下身边一位（被换下的回村里等你）。
            <button onClick={() => setPick(null)}>算了</button>
          </div>
        )}
        <div className="party-sub">名册</div>
        <div className="party-list">
          {rest.map((w) => {
            const [title, name] = short(w.r.name);
            const locked = w.state === 'locked';
            return (
              <div key={w.r.id} className={'party-card' + (locked ? ' locked' : '') + (pick === w.r.id ? ' picked' : '')}>
                <Pic id={w.r.id} dim={locked} />
                <div className="party-name">
                  <b>{name}</b> <span>{title}</span>
                </div>
                <div className="party-role">{COMP_PERK[w.r.id]?.role}</div>
                {locked ? (
                  <div className="party-state">
                    悬赏榜上，{w.r.lvl} 级，常在村子{where(w.r.road)}边的大路上出没。打服了，愿意跟你走。
                  </div>
                ) : (
                  <>
                    <div className="party-perk">{COMP_PERK[w.r.id]?.perk}</div>
                    <Heart aff={w.c!.aff} />
                    <div className="party-state">
                      {STATE[w.state]}
                      {w.state === 'down' && w.f?.respawn ? `（${Math.ceil(w.f.respawn)} 秒）` : ''}
                    </div>
                    <div className="party-btns">
                      <button className="hot" disabled={w.state === 'down'} onClick={() => bring(w.r.id)}>
                        带上{name}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        {msg && <p className="game-note warn">{msg}</p>}
        <div className="game-tip">在野外叫来的同伴会从路上赶过来；换下的自己回村。走到同伴跟前按 F，可以送礼、聊聊心事。</div>
        <button className="game-close" onClick={onClose}>
          离开 (Esc / P)
        </button>
      </div>
    </div>
  );
}

// The panels and bars for what opens after 伪帝 (game/endgame.ts): 巨灵碑's board (each giant at 困难 / 噩梦 with its
// best time; 二周目 below, asked twice), and the bar over the screen in a challenge (its clock) or the trial tower
// (the floor, who is left).
import { useState } from 'react';
import type { Sim } from '../game/sim';
import { CH_GIANTS, GIANTS, TIERS, bestTime, canChallenge, newGamePlus, ngLevel, startChallenge, storyDone, towerBest } from '../game/endgame';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

export function SteleBoard({ sim, onClose }: { sim: Sim; onClose: () => void }) {
  const P = sim.progress;
  const [ask, setAsk] = useState(false);
  const ng = ngLevel(P);
  return (
    <div className="game-wrap">
      <div className="game-box stele-box">
        <div className="game-title">巨灵碑</div>
        <p className="game-note">碑上刻着你见过的巨灵。按一格，它就在自己的地盘上重新站起来：更硬、更狠、歇得更短。用时越短、倒下越少，评等越高（甲乙丙丁）。噩梦第一次过关有宝物。</p>
        <div className="stele-list">
          {CH_GIANTS.map((key) => {
            const def = GIANTS[key];
            const ok = canChallenge(sim, key);
            return (
              <div key={key} className={'stele-row' + (ok ? '' : ' locked')}>
                <div className="stele-name" style={{ color: ok ? def.color : undefined }}>
                  {ok ? def.name : key === 'tianmo' ? '？？？（后传）' : '？？？'}
                </div>
                {TIERS.map((T, i) => {
                  const b = bestTime(P, key, i);
                  return (
                    <button
                      key={i}
                      disabled={!ok}
                      className={i === 1 ? 'hot' : ''}
                      onClick={() => {
                        startChallenge(sim, key, i);
                        onClose();
                      }}
                    >
                      {T.name}
                      <small>{b ? ` 最好 ${mmss(b)}` : ' 未过'}</small>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        <p className="game-note">天阙试炼塔：最高到过第 {towerBest(P)} 层。塔就在碑后面，从塔门进去。</p>
        <div className="stele-ng">
          {!ask ? (
            <button disabled={!storyDone(P)} onClick={() => setAsk(true)}>
              再入江湖 · {ng ? `第 ${ng + 2} 周目` : '二周目'}
            </button>
          ) : (
            <>
              <p className="game-note warn">
                从序章重新走一遍主线。你的等级、招式、装备、铜钱、背包、名号、房子和伙伴都留着；所有恶人更硬更狠，赏钱也更多。确定吗？
              </p>
              <button
                className="hot"
                onClick={() => {
                  newGamePlus(sim);
                  location.reload();
                }}
              >
                确定，再入江湖
              </button>
              <button onClick={() => setAsk(false)}>再想想</button>
            </>
          )}
        </div>
        <button className="game-close" onClick={onClose}>
          离开 (Esc)
        </button>
      </div>
    </div>
  );
}

/** over the screen: the challenge's clock, or the tower's floor */
export function EndBar({ sim }: { sim: Sim }) {
  const C = sim.end.ch, T = sim.end.tower;
  if (C) {
    const g = sim.fighters[C.id];
    return (
      <div className="end-bar">
        巨人挑战 · {g.name} · {TIERS[C.tier].name} · <b>{mmss(sim.time - C.t0)}</b>
        {C.deaths > 0 && <span> · 倒下 {C.deaths} 次</span>}
      </div>
    );
  }
  if (T) {
    const left = T.ids.filter((id) => sim.fighters[id].hp > 0).length;
    return (
      <div className="end-bar">
        天阙试炼塔 · 第 <b>{T.floor}</b> 层 · {T.state === 'clear' ? '登阶中……' : `还剩 ${left} 人`}
      </div>
    );
  }
  return null;
}

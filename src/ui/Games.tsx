// The little games and panels of 玩法 (game/play.ts): the notice board, the bag, fishing, lantern riddles, the
// imperial exam, the cases at the drum, the morning court, dice and pot throwing. Space or F plays; Esc leaves.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Sim } from '../game/sim';
import { CASES, EXAM, RIDDLES, WANTS, type Quiz } from '../game/economy';
import {
  ITEMS, bag, caseDone, catchFish, debateDone, debateToday, diceRoll, done, examDone, fishNow, landFish, purse, riddleDone, titles, touhuDone, usable, use,
} from '../game/play';
import { GEAR, MAT_NAME, RIVALS, SLOT_NAME, equipped, forge, forgeBlock, gearOf, owned, wear, type Slot } from '../game/jianghu';
import { roadPoint } from '../game/layout';
/** which way out of the village a road runs (north is -z, as on the map) */
const roadDir = (k: number) => {
  const [x, z] = roadPoint(k, 250);
  const a = ((Math.atan2(-z, x) * 180) / Math.PI + 360 + 22.5) % 360;
  return ['东', '东北', '北', '西北', '西', '西南', '南', '东南'][Math.floor(a / 45)];
};

const shuffle = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
/** Space / F as the one button */
function usePress(fn: (down: boolean) => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const d = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.code === 'KeyF') && !e.repeat) {
        e.preventDefault();
        e.stopPropagation();
        ref.current(true);
      }
    };
    const u = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'KeyF') ref.current(false);
    };
    window.addEventListener('keydown', d, true);
    window.addEventListener('keyup', u, true);
    return () => {
      window.removeEventListener('keydown', d, true);
      window.removeEventListener('keyup', u, true);
    };
  }, []);
}
function useLoop(fn: (dt: number) => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    let last = performance.now(), id = 0;
    const tick = (t: number) => {
      ref.current(Math.min(0.05, (t - last) / 1000));
      last = t;
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
}

function Frame({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="game-wrap">
      <div className="game-box">
        <div className="game-title">{title}</div>
        {children}
        <button className="game-close" onClick={onClose}>
          离开 (Esc)
        </button>
      </div>
    </div>
  );
}

export function Games({ sim, onClose }: { sim: Sim; onClose: () => void }) {
  const g = sim.game;
  if (!g) return null;
  const close = () => {
    sim.game = null;
    onClose();
  };
  switch (g.kind) {
    case 'board':
      return <Board sim={sim} court={g.court} onClose={close} />;
    case 'bag':
      return <Bag sim={sim} onClose={close} />;
    case 'forge':
      return <Forge sim={sim} make onClose={close} />;
    case 'gear':
      return <Forge sim={sim} make={false} onClose={close} />;
    case 'fish':
      return <Fishing sim={sim} onClose={close} />;
    case 'riddle':
      return <QuizGame sim={sim} title="猜灯谜" pool={RIDDLES} n={5} onDone={(r) => riddleDone(sim, r)} result={(r) => `猜中 ${r} / 5 个`} onClose={close} />;
    case 'exam':
      return <QuizGame sim={sim} title="科举 · 礼部试" pool={EXAM} n={6} onDone={(r) => examDone(sim, r)} result={(r) => `答对 ${r} / 6 题`} onClose={close} />;
    case 'case':
      return <CaseGame sim={sim} idx={g.idx} onClose={close} />;
    case 'debate':
      return <Debate sim={sim} onClose={close} />;
    case 'dice':
      return <Dice sim={sim} onClose={close} />;
    case 'touhu':
      return <Touhu sim={sim} onClose={close} />;
  }
  return null;
}

// ---------------------------------------------------------------- 告示栏
function Board({ sim, court, onClose }: { sim: Sim; court: boolean; onClose: () => void }) {
  const D = done(sim.progress);
  const list = WANTS;
  return (
    <Frame title={court ? '永安城 · 告示' : '青石村 · 告示栏'} onClose={onClose}>
      <div className="board-list">
        {list.map((w) => {
          const ok = !!D['want:' + w.folk];
          return (
            <div key={w.folk} className={'board-item' + (ok ? ' done' : '')}>
              <div className="bi-head">
                <b>{w.folk}</b> <span className="bi-where">· {w.where}</span>
                <span className="bi-reward">{ok ? '已办妥' : `酬 ${w.coins} 文`}</span>
              </div>
              <div className="bi-ask">
                想要：{ITEMS[w.item].name}。{w.ask.split('（')[0]}
              </div>
            </div>
          );
        })}
      </div>
      <div className="game-title" style={{ marginTop: 14 }}>悬赏榜</div>
      <div className="board-list">
        {RIVALS.map((r) => {
          const ok = !!D['rival:' + r.id];
          return (
            <div key={r.id} className={'board-item' + (ok ? ' done' : '')}>
              <div className="bi-head">
                <b>{r.name}</b> <span className="bi-where">· {r.lvl} 级 · 出没在村子{roadDir(r.road)}边的大路上（离村 {r.r0} 到 {r.r1} 米）</span>
                <span className="bi-reward">{ok ? (r.join ? '已了结 · 成了同伴' : '已了结') : `赏 ${r.bounty} 文`}</span>
              </div>
              <div className="bi-ask">{r.crime}</div>
            </div>
          );
        })}
      </div>
      <div className="game-tip">东西在集市上买，或者自己去找；带着东西跟他们说话就能送上。悬赏犯在大地图（M）上是红色的“悬”。</div>
    </Frame>
  );
}

// ---------------------------------------------------------------- 包袱
function Bag({ sim, onClose }: { sim: Sim; onClose: () => void }) {
  const [, setN] = useState(0);
  const P = sim.progress, B = bag(P);
  const items = Object.entries(B).filter(([, n]) => n > 0);
  const T = titles(P);
  return (
    <Frame title="包袱" onClose={onClose}>
      <div className="bag-coins">铜钱 {purse(P)} 文</div>
      {T.length > 0 && <div className="bag-titles">名号：{T.map((t) => `「${t}」`).join(' ')}</div>}
      <GearLine sim={sim} />
      {items.length === 0 && <div className="game-tip">包袱里空空的。去青石集逛逛吧。</div>}
      <div className="bag-list">
        {items.map(([id, n]) => (
          <div key={id} className="bag-item">
            <div>
              <b>{ITEMS[id]?.name ?? id}</b> × {n}
              <div className="bag-desc">{ITEMS[id]?.desc}</div>
            </div>
            {usable(id) && (
              <button
                onClick={() => {
                  use(sim, id);
                  setN((k) => k + 1);
                }}
              >
                {id === 'book' ? '读' : id === 'plaster' ? '敷上' : '吃'}
              </button>
            )}
          </div>
        ))}
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- 钓鱼
function Fishing({ sim, onClose }: { sim: Sim; onClose: () => void }) {
  type Phase = 'wait' | 'bite' | 'reel' | 'got' | 'lost';
  const st = useRef({ phase: 'wait' as Phase, t: 2 + Math.random() * 4, fish: '', zone: 0.5, zv: 0, box: 0.3, hold: false, meter: 0.35 });
  const [, setN] = useState(0);
  const cast = () => {
    Object.assign(st.current, { phase: 'wait', t: 2 + Math.random() * 4, fish: '', meter: 0.35, box: 0.3 });
    setN((k) => k + 1);
  };
  usePress((down) => {
    const s = st.current;
    s.hold = down;
    if (!down) return;
    if (s.phase === 'bite') {
      s.fish = catchFish(fishNow(sim));
      s.phase = 'reel';
    } else if (s.phase === 'wait') {
      s.phase = 'lost';
      s.t = 0;
    } else if (s.phase === 'got' || s.phase === 'lost') cast();
  });
  useLoop((dt) => {
    const s = st.current;
    if (s.phase === 'wait' && (s.t -= dt) <= 0) {
      s.phase = 'bite';
      s.t = 0.85;
    } else if (s.phase === 'bite' && (s.t -= dt) <= 0) s.phase = 'lost';
    else if (s.phase === 'reel') {
      // the fish darts about; your float (the box) rises while you hold, sinks when you let go
      const wild = s.fish === 'goldcarp' ? 2.4 : ITEMS[s.fish].price > 15 ? 1.6 : 1;
      if (Math.random() < dt * 1.6 * wild) s.zv = (Math.random() - 0.5) * 1.6 * wild;
      s.zone = Math.max(0.08, Math.min(0.92, s.zone + s.zv * dt));
      if (s.zone <= 0.08 || s.zone >= 0.92) s.zv *= -1;
      s.box = Math.max(0, Math.min(0.78, s.box + (s.hold ? 0.9 : -0.8) * dt));
      const inside = s.zone > s.box && s.zone < s.box + 0.22;
      s.meter += (inside ? 0.32 : -0.22 * wild) * dt;
      if (s.meter >= 1) {
        s.phase = 'got';
        landFish(sim, s.fish);
      } else if (s.meter <= 0) s.phase = 'lost';
    }
    setN((k) => (k + 1) % 1000);
  });
  const s = st.current;
  const B = bag(sim.progress);
  const caught = Object.entries(B).filter(([id, n]) => ITEMS[id]?.kind === 'fish' && n > 0);
  return (
    <Frame title="借竿钓鱼" onClose={onClose}>
      <div className="fish-pond">
        <div className={'fish-float ' + s.phase} />
        {s.phase === 'reel' && (
          <div className="fish-bar">
            <div className="fish-box" style={{ bottom: `${s.box * 100}%` }} />
            <div className="fish-fish" style={{ bottom: `${s.zone * 100}%` }}>🐟</div>
            <div className="fish-meter" style={{ height: `${s.meter * 100}%` }} />
          </div>
        )}
      </div>
      <div className="game-say">
        {s.phase === 'wait' && '等鱼咬钩……（别心急，浮漂一沉再按）'}
        {s.phase === 'bite' && '浮漂一沉！快按空格！'}
        {s.phase === 'reel' && '按住空格让竹框往上，松开往下，罩住鱼，等右边的线拉满！'}
        {s.phase === 'got' && `钓上来一条${ITEMS[s.fish].name}！${ITEMS[s.fish].desc}（空格再钓一竿）`}
        {s.phase === 'lost' && '鱼跑了。（空格再钓一竿）'}
      </div>
      <div className="game-tip">
        鱼篓：{caught.length ? caught.map(([id, n]) => `${ITEMS[id].name}×${n}`).join('、') : '空的'} · 钓到的鱼可以卖给渔翁或面摊 · 雨天黄鳝多，听说雨夜里有金鲤
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- riddles and the exam
function QuizGame({ sim, title, pool, n, onDone, result, onClose }: { sim: Sim; title: string; pool: Quiz[]; n: number; onDone: (right: number) => string | void; result: (r: number) => string; onClose: () => void }) {
  const qs = useMemo(() => shuffle(pool).slice(0, n).map((q) => ({ ...q, opts: shuffle([0, 1, 2]) })), [pool, n]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const [end, setEnd] = useState<string | null>(null);
  if (end !== null)
    return (
      <Frame title={title} onClose={onClose}>
        <div className="game-say big">{result(right)}</div>
        {end && <div className="game-say">{end}</div>}
      </Frame>
    );
  const q = qs[i];
  return (
    <Frame title={`${title} · 第 ${i + 1} / ${n} 题`} onClose={onClose}>
      <div className="quiz-q">{q.q}</div>
      <div className="quiz-opts">
        {q.opts.map((k) => (
          <button
            key={k}
            className={picked === null ? '' : k === 0 ? 'right' : picked === k ? 'wrong' : 'dim'}
            disabled={picked !== null}
            onClick={() => {
              setPicked(k);
              if (k === 0) setRight((r) => r + 1);
            }}
          >
            {q.a[k]}
          </button>
        ))}
      </div>
      {picked !== null && (
        <>
          <div className="game-say">
            {picked === 0 ? '答对了！' : `不对，是“${q.a[0]}”。`}
            {q.why ?? ''}
          </div>
          <button
            className="game-next"
            onClick={() => {
              if (i + 1 >= n) {
                const total = right;
                setEnd((onDone(total) as string) || '');
              } else {
                setI(i + 1);
                setPicked(null);
              }
            }}
          >
            {i + 1 >= n ? '交卷' : '下一题'}
          </button>
        </>
      )}
      <div className="game-tip">{sim.progress.titles?.length ? `名号：${sim.progress.titles.join('、')}` : ''}</div>
    </Frame>
  );
}

// ---------------------------------------------------------------- 断案
function CaseGame({ sim, idx, onClose }: { sim: Sim; idx: number; onClose: () => void }) {
  const c = CASES[idx];
  const order = useMemo(() => shuffle([0, 1, 2]), [idx]);
  const [heard, setHeard] = useState(false);
  const [pick, setPick] = useState<number | null>(null);
  return (
    <Frame title={`击鼓鸣冤 · ${c.title}`} onClose={onClose}>
      {!heard ? (
        <>
          <div className="case-wrong">{c.wrong}</div>
          <button className="game-next" onClick={() => setHeard(true)}>
            升堂，传证人
          </button>
        </>
      ) : (
        <>
          <div className="case-says">
            {order.map((k) => (
              <div key={k} className={'case-say' + (pick === null ? '' : k === 0 ? ' guilty' : '')}>
                <b>{c.say[k][0]}：</b>
                {c.say[k][1]}
                {pick === null && (
                  <button
                    onClick={() => {
                      setPick(k);
                      caseDone(sim, idx, k === 0);
                    }}
                  >
                    指认他
                  </button>
                )}
              </div>
            ))}
          </div>
          {pick === null && <div className="game-tip">三个人里有一个在撒谎。仔细看他们的话，谁说了不该知道、或者自相矛盾的事？</div>}
          {pick !== null && (
            <div className="game-say">
              {pick === 0 ? `判得好！${c.tell}\n${c.verdict}` : `判错了。${c.say[0][0].split(' · ').pop()}才是真凶：${c.tell}`}
            </div>
          )}
        </>
      )}
    </Frame>
  );
}

// ---------------------------------------------------------------- 朝议
function Debate({ sim, onClose }: { sim: Sim; onClose: () => void }) {
  const d = debateToday(sim);
  const [k, setK] = useState<number | null>(null);
  return (
    <Frame title="早朝 · 朝议" onClose={onClose}>
      <div className="quiz-q">丞相：“{d.q}诸位有何良策？”（满朝文武都看着你）</div>
      <div className="quiz-opts col">
        {d.options.map((o, i) => (
          <button
            key={i}
            disabled={k !== null}
            className={k === null ? '' : k === i ? 'right' : 'dim'}
            onClick={() => {
              setK(i);
              debateDone(sim, i);
            }}
          >
            {o.say}
          </button>
        ))}
      </div>
      {k !== null && <div className="game-say">{d.options[k].note}（三天之内，天下都会感到这道旨意。）</div>}
    </Frame>
  );
}

// ---------------------------------------------------------------- 掷骰子
const PIPS = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
function Dice({ sim, onClose }: { sim: Sim; onClose: () => void }) {
  const [bet, setBet] = useState(10);
  const [roll, setRoll] = useState<{ d: number[]; sum: number; triple: boolean; win: boolean } | null>(null);
  const [spin, setSpin] = useState(0);
  const [, setN] = useState(0);
  useLoop(() => spin > 0 && setN((k) => (k + 1) % 1000));
  const go = (big: boolean) => {
    if (purse(sim.progress) < bet) return;
    setSpin(1);
    setRoll(null);
    setTimeout(() => {
      setRoll(diceRoll(sim, bet, big));
      setSpin(0);
    }, 800);
  };
  const faces = spin ? [0, 1, 2].map(() => PIPS[Math.floor(Math.random() * 6)]) : roll ? roll.d.map((v) => PIPS[v - 1]) : ['⚂', '⚃', '⚄'];
  return (
    <Frame title="赌坊 · 猜大小" onClose={onClose}>
      <div className="dice-row">{faces.map((f, i) => <span key={i}>{f}</span>)}</div>
      <div className="game-say">
        {roll ? `${roll.sum} 点，${roll.triple ? '豹子！庄家通吃' : roll.sum >= 11 ? '大' : '小'}。${roll.win ? `你赢了 ${bet} 文！` : `你输了 ${bet} 文。`}` : '钱八：“押大押小，买定离手！”（11 点以上为大，豹子庄家通吃）'}
      </div>
      <div className="dice-btns">
        押注：
        {[10, 30, 100].map((b) => (
          <button key={b} className={bet === b ? 'on' : ''} onClick={() => setBet(b)}>
            {b} 文
          </button>
        ))}
      </div>
      <div className="quiz-opts">
        <button disabled={!!spin || purse(sim.progress) < bet} onClick={() => go(true)}>
          押大
        </button>
        <button disabled={!!spin || purse(sim.progress) < bet} onClick={() => go(false)}>
          押小
        </button>
      </div>
      <div className="game-tip">你有 {purse(sim.progress)} 文 · 小赌怡情，大赌伤身</div>
    </Frame>
  );
}

// ---------------------------------------------------------------- 投壶
function Touhu({ sim, onClose }: { sim: Sim; onClose: () => void }) {
  const st = useRef({ x: 0, v: 1.3, arrows: 5, hits: 0, last: '' as '' | 'hit' | 'miss', over: false });
  const [, setN] = useState(0);
  usePress((down) => {
    const s = st.current;
    if (!down || s.over) return;
    const zone = 0.2 - (5 - s.arrows) * 0.025;
    const hit = Math.abs(s.x) < zone;
    s.last = hit ? 'hit' : 'miss';
    if (hit) s.hits++;
    s.arrows--;
    s.v = (1.3 + (5 - s.arrows) * 0.35) * Math.sign(s.v || 1);
    if (s.arrows === 0) {
      s.over = true;
      touhuDone(sim, s.hits);
    }
  });
  useLoop((dt) => {
    const s = st.current;
    if (!s.over) {
      s.x += s.v * dt;
      if (s.x > 1 || s.x < -1) {
        s.v *= -1;
        s.x = Math.max(-1, Math.min(1, s.x));
      }
    }
    setN((k) => (k + 1) % 1000);
  });
  const s = st.current, zone = 0.2 - (5 - s.arrows) * 0.025;
  return (
    <Frame title="茶楼 · 投壶" onClose={onClose}>
      <div className="touhu-pot">🏺</div>
      <div className="touhu-bar">
        <div className="touhu-zone" style={{ left: `${(0.5 - zone / 2) * 100}%`, width: `${zone * 100}%` }} />
        <div className="touhu-needle" style={{ left: `${(s.x + 1) * 50}%` }} />
      </div>
      <div className="game-say">
        {s.over ? `五支投完，中了 ${s.hits} 支。${s.hits >= 3 ? '好！' : ''}` : s.last === 'hit' ? '“啪”的一声，正中壶口！' : s.last === 'miss' ? '偏了，箭掉在地上。' : '指针走到中间的红框里时按空格，把箭投进壶里。'}
      </div>
      <div className="game-tip">
        剩 {s.arrows} 支 · 中 {s.hits} 支 · 中三支有赏，五支全中赏得最多
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- 装备 (worn in the bag; forged at 张记铁铺; changed at home or the smithy)
function GearLine({ sim }: { sim: Sim }) {
  const E = equipped(sim.progress), g = gearOf(sim.progress);
  const name = (sl: Slot) => GEAR.find((x) => x.id === E[sl])?.name ?? '无';
  const bits = [g.dmg && `伤害 +${Math.round(g.dmg * 100)}%`, g.def && `受伤 -${Math.round(g.def * 100)}%`, g.hp && `气血 +${Math.round(g.hp * 100)}%`, g.spd && `跑速 +${Math.round(g.spd * 100)}%`, g.mp && `回气 +${Math.round(g.mp * 100)}%`, g.leech && `吸血 ${Math.round(g.leech * 100)}%`].filter(Boolean);
  return (
    <div className="bag-titles">
      装备：{(['weapon', 'armor', 'charm'] as Slot[]).map((sl) => `${SLOT_NAME[sl]}「${name(sl)}」`).join(' ')}
      {bits.length > 0 && <div className="bag-desc">{bits.join('，')}（在家里的兵器架或铁铺换装）</div>}
    </div>
  );
}
function Forge({ sim, make, onClose }: { sim: Sim; make: boolean; onClose: () => void }) {
  const [, setN] = useState(0);
  const P = sim.progress, B = bag(P), E = equipped(P), mine = owned(P);
  const list = make ? GEAR : GEAR.filter((g) => mine.includes(g.id));
  const mats = Object.keys(MAT_NAME).map((m) => `${MAT_NAME[m]} ${B[m] ?? 0}`).join(' · ');
  return (
    <Frame title={make ? '张记铁铺 · 打造' : '兵器架 · 换装'} onClose={onClose}>
      <div className="bag-coins">
        铜钱 {purse(P)} 文 · {mats}
      </div>
      <GearLine sim={sim} />
      {list.length === 0 && <div className="game-tip">还没有打造过装备。带上铁料、兽皮、玄铁去张记铁铺找张大锤。</div>}
      <div className="bag-list">
        {list.map((g) => {
          const has = mine.includes(g.id), on = E[g.slot] === g.id;
          const why = make && !has ? forgeBlock(sim, g) : null;
          const cost = [g.coins ? `${g.coins} 文` : '', ...Object.entries(g.mats).map(([m, n]) => `${MAT_NAME[m]}×${n}`)].filter(Boolean).join(' ');
          return (
            <div key={g.id} className="bag-item">
              <div>
                <b>
                  {g.name}
                  <span className="bi-where"> · {SLOT_NAME[g.slot]}</span>
                </b>
                <div className="bag-desc">
                  {g.desc}
                  {make && !has && !g.prize && ` · 要 ${cost}${g.lvl > 1 ? ` · ${g.lvl} 级` : ''}`}
                </div>
              </div>
              {has ? (
                <button onClick={() => (wear(sim, g.id), setN((k) => k + 1))}>{on ? '卸下' : '穿上'}</button>
              ) : (
                <button disabled={!!why} title={why ?? ''} onClick={() => (forge(sim, g), setN((k) => k + 1))}>
                  {why ?? '打造'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

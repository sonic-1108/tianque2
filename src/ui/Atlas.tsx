// 兵器图谱 (G anywhere; 打造 at 张记铁铺 with 张大锤): the nine elements' weapon lines, five stages each, what every stage
// takes and where those things come from; the materials by element; armour and charms; the old plain weapons and the
// prizes. Forging and reforging only at the smithy (`make`); wearing anywhere. Logic in game/forge.ts, data in mats.ts.
import { useState } from 'react';
import type { Sim } from '../game/sim';
import { AFFINITY, EL, ELS, FORM_NAME, FORM_OF, GRADE_NAME, LINE_FORM, MATS, PAIRED, RESONANCE, STAGES, fwArt, fwId, fwName, holdsLine, matId, matName, recipe, BASE_MATS, type El, type Form } from '../game/mats';
import { fwBlock, fwForge, houseOf, ownedStage, wielded } from '../game/forge';
import { GEAR, SLOT_NAME, equipped, forge, forgeBlock, gearName, owned, wear, type Slot } from '../game/jianghu';
import { bag, purse } from '../game/play';

type Tab = 'atlas' | 'mats' | 'armor' | 'old';

/** a weapon drawn as a silhouette in its element's light; the stages add glow, runes and a halo */
export function WeaponGlyph({ form, el, n, size = 56 }: { form: Form; el: El; n: number; size?: number }) {
  const E = EL[el], id = `g${el}${n}${form}`;
  const blade = `url(#${id}b)`;
  const glow = [1.5, 3, 5, 8, 12][n - 1];
  const runes = n >= 2;
  const body = (() => {
    switch (form) {
      case 'jian':
        return (
          <g transform="rotate(45 32 32)">
            <path d="M29.6 42 L34.4 42 L33.6 11 L32 4 L30.4 11 Z" fill={blade} stroke={E.deep} strokeWidth="0.8" />
            {runes && <path d="M32 14 L32 38" stroke="#fff" strokeOpacity={0.35 + 0.12 * n} strokeWidth="0.9" strokeDasharray={n >= 4 ? '' : '2 2'} />}
            <path d={n >= 4 ? 'M22 42 Q32 47 42 42 L40 45 Q32 49 24 45 Z' : 'M24 42 L40 42 L40 45 L24 45 Z'} fill={E.deep} stroke={E.color} strokeWidth="0.6" />
            <rect x="30.4" y="45" width="3.2" height="10" rx="1" fill="#3a2a1c" />
            <circle cx="32" cy="57" r={n >= 3 ? 2.6 : 2} fill={n >= 3 ? E.color : E.deep} />
            {n >= 3 && <path d="M32 59 Q29 63 31 66 Q33 63 32 59" fill={E.color} opacity="0.85" />}
          </g>
        );
      case 'dao':
        return (
          <g transform="rotate(45 32 32)">
            <path d="M29.5 42 L34.5 42 C37.5 30 37.5 18 33 5 C31 15 29.5 30 29.5 42 Z" fill={blade} stroke={E.deep} strokeWidth="0.8" />
            {runes && <path d="M33.5 12 C35.5 22 35 32 33.5 39" fill="none" stroke="#fff" strokeOpacity={0.35 + 0.12 * n} strokeWidth="0.9" />}
            <ellipse cx="32" cy="43.5" rx={n >= 4 ? 7 : 5.5} ry="2" fill={E.deep} stroke={E.color} strokeWidth="0.6" />
            <rect x="30.4" y="45" width="3.2" height="10" rx="1" fill="#3a2a1c" />
            <circle cx="32" cy="58" r="2.8" fill="none" stroke={n >= 3 ? E.color : E.deep} strokeWidth="1.4" />
          </g>
        );
      case 'bi':
        return (
          <g transform="rotate(45 32 32)">
            <path d="M29.5 40 L34.5 40 L33.4 22 L32 15 L30.6 22 Z" fill={blade} stroke={E.deep} strokeWidth="0.8" />
            {runes && <path d="M32 22 L32 37" stroke="#fff" strokeOpacity={0.4 + 0.1 * n} strokeWidth="0.8" />}
            <path d="M26 40 L38 40 L36 43 L28 43 Z" fill={E.deep} stroke={E.color} strokeWidth="0.6" />
            <rect x="30.5" y="43" width="3" height="8" rx="1" fill="#3a2a1c" />
            <circle cx="32" cy="53" r="2" fill={n >= 3 ? E.color : E.deep} />
          </g>
        );
      case 'qiang':
        return (
          <g transform="rotate(45 32 32)">
            <rect x="31" y="14" width="2" height="50" rx="1" fill="#5a3a22" />
            <path d="M28.5 15 L32 1 L35.5 15 L32 18 Z" fill={blade} stroke={E.deep} strokeWidth="0.8" />
            <path d="M32 18 Q27 24 28 30 Q31 25 32 22 Q33 25 36 30 Q37 24 32 18" fill={E.color} opacity={0.55 + 0.08 * n} />
          </g>
        );
      case 'zhang':
        return (
          <g transform="rotate(45 32 32)">
            <rect x="30.8" y="12" width="2.4" height="52" rx="1.2" fill="#4a3220" />
            <circle cx="32" cy="9" r="6" fill="none" stroke={blade} strokeWidth="2.4" />
            <circle cx="32" cy="9" r={2 + n * 0.4} fill={E.color} />
            {n >= 3 && <circle cx="32" cy="9" r="9" fill="none" stroke={E.color} strokeOpacity="0.4" strokeWidth="0.8" />}
          </g>
        );
      case 'gong':
        return (
          <g>
            <path d="M18 8 Q50 32 18 56" fill="none" stroke={blade} strokeWidth="3.4" strokeLinecap="round" />
            <path d="M18 8 L18 56" stroke={E.color} strokeOpacity="0.8" strokeWidth="0.8" />
            <path d="M14 32 L48 32 M44 29 L49 32 L44 35" stroke={E.deep} strokeWidth="1.4" fill="none" />
            {n >= 3 && <circle cx="34" cy="32" r="2.4" fill={E.color} />}
          </g>
        );
      case 'nu':
        return (
          <g>
            <rect x="14" y="30" width="38" height="5" rx="1.5" fill="#4a3220" />
            <path d="M44 14 Q54 32 44 50" fill="none" stroke={blade} strokeWidth="3" strokeLinecap="round" />
            <path d="M44 14 L44 50" stroke={E.color} strokeOpacity="0.7" strokeWidth="0.8" />
            <path d="M18 35 L22 46 L26 35" fill="#3a2a1c" />
            {n >= 3 && <circle cx="40" cy="32.5" r="2.2" fill={E.color} />}
          </g>
        );
      case 'qin':
        return (
          <g transform="rotate(-20 32 32)">
            <rect x="8" y="24" width="48" height="14" rx="5" fill={blade} stroke={E.deep} strokeWidth="1" />
            {[0, 1, 2, 3, 4].map((k) => (
              <path key={k} d={`M10 ${27 + k * 2} L54 ${27 + k * 2}`} stroke="#fff" strokeOpacity={0.3 + 0.08 * n} strokeWidth="0.5" />
            ))}
            {n >= 3 && <circle cx="47" cy="31" r="2" fill={E.color} />}
          </g>
        );
      case 'wan':
        return (
          <g transform="rotate(-30 32 32)">
            <rect x="16" y="20" width="32" height="24" rx="8" fill={blade} stroke={E.deep} strokeWidth="1" />
            <path d="M24 20 L24 44 M32 20 L32 44 M40 20 L40 44" stroke={E.deep} strokeWidth="1.2" opacity="0.7" />
            {n >= 3 && <circle cx="32" cy="32" r="3.2" fill={E.color} stroke="#fff" strokeOpacity="0.6" strokeWidth="0.6" />}
          </g>
        );
      case 'xia':
        return (
          <g>
            <rect x="12" y="22" width="40" height="28" rx="3" fill={blade} stroke={E.deep} strokeWidth="1" />
            <path d="M26 22 Q26 14 32 14 Q38 14 38 22" fill="none" stroke={E.deep} strokeWidth="2" />
            <rect x="12" y="34" width="40" height="2" fill={E.deep} opacity="0.6" />
            {n >= 3 && <rect x="29" y="31" width="6" height="7" rx="1" fill={E.color} />}
          </g>
        );
    }
  })();
  return (
    <svg className={'wglyph' + (n >= 4 ? ' pulse' : '')} viewBox="0 0 64 64" width={size} height={size} style={{ filter: `drop-shadow(0 0 ${glow}px ${E.color})` }}>
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.55 + 0.08 * n} />
          <stop offset="0.45" stopColor={E.color} />
          <stop offset="1" stopColor={E.deep} />
        </linearGradient>
      </defs>
      {n >= 5 && <circle cx="32" cy="32" r="29" fill="none" stroke={E.color} strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 4" />}
      {body}
    </svg>
  );
}

/** a forged weapon's picture: rendered from its Tripo model when there is one, else drawn */
export function WeaponPic({ el, n, size = 56 }: { el: El; n: number; size?: number }) {
  if (fwArt(el, n))
    return <img className={'wpic' + (n >= 4 ? ' pulse' : '')} src={`${import.meta.env.BASE_URL}portraits/fw-${el}-${n}.png`} width={size} height={size} alt="" style={{ filter: `drop-shadow(0 0 ${[2, 3, 5, 8, 12][n - 1]}px ${EL[el].color})` }} />;
  return <WeaponGlyph form={LINE_FORM[el]} el={el} n={n} size={size} />;
}

/** a material's seal: its element's character, its grade in the border */
export function Seal({ id, size = 30 }: { id: string; size?: number }) {
  const M = MATS[id];
  if (!M) return <span className="mseal base" style={{ width: size, height: size, fontSize: size * 0.5 }}>{(BASE_MATS[id]?.name ?? id).slice(0, 1)}</span>;
  const E = EL[M.el];
  return (
    <span className={`mseal g${M.grade}`} style={{ width: size, height: size, fontSize: size * 0.55, background: E.deep, color: E.color, borderColor: M.grade === 2 ? '#f6c445' : E.color, boxShadow: M.grade ? `0 0 ${M.grade * 6}px ${E.color}` : undefined }} title={M.name}>
      {E.name}
    </span>
  );
}

export function Atlas({ sim, make, onClose }: { sim: Sim; make: boolean; onClose: () => void }) {
  const [, setN] = useState(0);
  const bump = () => setN((k) => k + 1);
  const P = sim.progress, B = bag(P);
  const house = houseOf(P), aff = AFFINITY[house ?? ''];
  const w = wielded(P);
  const [tab, setTab] = useState<Tab>('atlas');
  const [sel, setSel] = useState<{ el: El; n: number }>(() => (w ? { el: w.el, n: Math.min(5, w.n + 1) } : { el: aff ?? 'fire', n: 1 }));
  const [flash, setFlash] = useState('');
  const pro = !!P.hero;
  return (
    <div className="game-wrap">
      <div className="game-box atlas-box">
        <div className="game-title">{make ? '张记铁铺 · 兵器图谱' : '兵器图谱'}</div>
        <div className="atlas-top">
          <span className="bag-coins">铜钱 {purse(P)} 文</span>
          <span className="atlas-hand">
            手里：{gearName(P, equipped(P).weapon)}
            {w && <i style={{ color: EL[w.el].color }}> · {EL[w.el].name} {STAGES[w.n - 1].name}{w.res ? ' · 共鸣' : ''}</i>}
          </span>
        </div>
        <div className="ward-tabs">
          {(
            [
              ['atlas', '兵器图谱'],
              ['mats', '素材'],
              ['armor', '护甲佩饰'],
              ['old', '旧兵 · 奖赏'],
            ] as [Tab, string][]
          ).map(([k, name]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
              {name}
            </button>
          ))}
        </div>
        {tab === 'atlas' && (
          <div className="atlas-body">
            <div className="atlas-grid">
              <div className="ag-head" />
              {STAGES.map((st) => (
                <div key={st.n} className={'ag-head' + (st.pro ? ' pro' : '')}>
                  {st.name}
                  <small>{st.pro ? '转职后' : `${st.lvl} 级`}</small>
                </div>
              ))}
              {ELS.map((el) => {
                const E = EL[el], have = ownedStage(P, el);
                return [
                  <div key={el} className="ag-row" style={{ color: E.color }}>
                    <span className="ag-el" style={{ background: E.deep, borderColor: E.color }}>{E.name}</span>
                    <span className="ag-eff">
                      {E.effect}
                      {aff === el && <b className="ag-aff">本命</b>}
                    </span>
                  </div>,
                  ...STAGES.map((st) => {
                    const n = st.n, mine = have >= n, cur = have === n, on = w?.el === el && w.n === n;
                    const next = n === have + 1, ready = next && !fwBlock(sim, el, n, true);
                    const locked = st.pro && !pro;
                    return (
                      <button
                        key={el + n}
                        className={'ag-cell' + (mine ? ' mine' : '') + (cur ? ' cur' : '') + (on ? ' on' : '') + (ready && make ? ' ready' : '') + (locked ? ' locked' : '') + (sel.el === el && sel.n === n ? ' sel' : '') + (!mine && !next ? ' far' : '')}
                        onClick={() => setSel({ el, n })}
                        title={fwName(el, n, house)}
                      >
                        <WeaponPic el={el} n={n} size={40} />
                        <span className="ag-name">{E.names[n - 1]}</span>
                        {locked && <span className="ag-lock">转职</span>}
                      </button>
                    );
                  }),
                ];
              })}
            </div>
            <Detail sim={sim} make={make} el={sel.el} n={sel.n} flash={flash} onForge={(msg) => (setFlash(msg), bump(), setTimeout(() => setFlash(''), 900))} onWear={bump} />
          </div>
        )}
        {tab === 'mats' && (
          <div className="atlas-mats">
            <p className="bag-desc">每种敌人掉自己那一系的素材：粗料是寻常人身上的，精料要找头领、悬赏犯、外圈的人，极料一个大头目一天只掉一块。</p>
            {ELS.map((el) => {
              const E = EL[el];
              return (
                <div key={el} className="am-row">
                  <span className="ag-el" style={{ background: E.deep, borderColor: E.color, color: E.color }}>{E.name}</span>
                  {([0, 1, 2] as const).map((g) => {
                    const id = matId(el, g), M = MATS[id];
                    return (
                      <div key={id} className={'am-mat' + ((B[id] ?? 0) > 0 ? '' : ' none')}>
                        <Seal id={id} size={28} />
                        <div>
                          <b>
                            {M.name} <span className="am-n">× {B[id] ?? 0}</span>
                          </b>
                          <div className="bag-desc">{GRADE_NAME[g]}料 · {M.from}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <div className="am-row base">
              {Object.entries(BASE_MATS).map(([id, b]) => (
                <div key={id} className="am-mat">
                  <Seal id={id} size={28} />
                  <div>
                    <b>
                      {b.name} <span className="am-n">× {B[id] ?? 0}</span>
                    </b>
                    <div className="bag-desc">{b.from}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {(tab === 'armor' || tab === 'old') && <GearList sim={sim} make={make} which={tab} onChange={bump} />}
        {!make && <div className="game-tip">打造和重铸要到张记铁铺找张大锤；已有的兵器在这里就能换上。</div>}
        <button className="game-close" onClick={onClose}>
          离开 (Esc)
        </button>
      </div>
    </div>
  );
}

function Detail({ sim, make, el, n, flash, onForge, onWear }: { sim: Sim; make: boolean; el: El; n: number; flash: string; onForge: (msg: string) => void; onWear: () => void }) {
  const P = sim.progress, B = bag(P), E = EL[el], st = STAGES[n - 1];
  const house = houseOf(P), form = LINE_FORM[el], res = AFFINITY[house ?? ''] === el;
  const have = ownedStage(P, el), mine = have >= n, id = fwId(el, n);
  const why = mine ? null : fwBlock(sim, el, n, make);
  const R = recipe(el, n);
  const on = equipped(P).weapon === fwId(el, have);
  const extra = el === 'wind' ? '跑得快，出手快' : el === 'earth' ? '少受伤' : el === 'wood' ? '吸血' : el === 'water' ? '回气快' : el === 'metal' ? '暴击' : '';
  return (
    <div className={'atlas-detail' + (flash ? ' forged' : '')} style={{ borderColor: E.color }}>
      <div className="ad-pic" style={{ background: `radial-gradient(circle at 50% 45%, ${E.deep} 0%, #120d09 72%)` }}>
        <WeaponPic el={el} n={n} size={128} />
        {flash && <div className="ad-flash" style={{ color: E.color }}>{flash}</div>}
      </div>
      <div className="ad-name" style={{ color: E.color }}>
        {fwName(el, n, house)}
      </div>
      <div className="ad-sub">
        {E.name}系 · {st.name} · {FORM_NAME[form]}
        {house && PAIRED.has(house) && FORM_OF[house] === form ? '（一对）' : ''}
        {!holdsLine(house, el) && <span className="ad-note">（你的职业不拿{FORM_NAME[form]}：手里还是原来的兵器，带上{E.name}系的光和特效）</span>}
        {res && <b className="ag-aff">本命共鸣：特效强 {Math.round((RESONANCE - 1) * 100)}%</b>}
      </div>
      <div className="ad-stats">
        伤害 +{Math.round(st.dmg * 100)}%{extra && ` · ${extra}`} · 特效强度 {Math.round(st.k * (res ? RESONANCE : 1) * 100)}%
      </div>
      <ul className="ad-fx">
        <li>
          <b style={{ color: E.color }}>{E.effect}</b>　{E.desc}
        </li>
        <li className={n >= 3 ? '' : 'off'}>
          <b style={{ color: E.color }}>三阶 · {E.sub[0]}</b>　{E.sub[1]}
        </li>
        <li className={n >= 5 ? '' : 'off'}>
          <b style={{ color: E.color }}>五阶异象 · {E.ult[0]}</b>　{E.ult[1]}
        </li>
      </ul>
      {mine ? (
        <div className="ad-own">
          {have === n ? '已铸成' : `已铸到${STAGES[have - 1].name}`}
          {have === n && (
            <button
              onClick={() => {
                wear(sim, id);
                onWear();
              }}
            >
              {on ? '卸下' : '拿在手里'}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="ad-recipe">
            {n > 1 && (
              <div className={'ar-line' + (have >= n - 1 ? '' : ' short')}>
                <WeaponPic el={el} n={n - 1} size={26} />
                <span>{fwName(el, n - 1, house)}（回炉重铸）</span>
                <span className="ar-n">{have >= n - 1 ? '有' : '没有'}</span>
              </div>
            )}
            {Object.entries(R).map(([m, k]) => {
              const h = B[m] ?? 0;
              return (
                <div key={m} className={'ar-line' + (h >= k ? '' : ' short')}>
                  <Seal id={m} size={26} />
                  <span>
                    {matName(m)}
                    <small>{MATS[m]?.from ?? BASE_MATS[m]?.from}</small>
                  </span>
                  <span className="ar-n">
                    {h} / {k}
                  </span>
                </div>
              );
            })}
            <div className="ar-line coins">
              <span>铜钱 {st.coins} 文 · {st.lvl} 级{st.pro ? ' · 转职后' : ''}</span>
            </div>
          </div>
          <button
            className="ad-forge"
            disabled={!!why}
            onClick={() => {
              if (fwForge(sim, el, n)) onForge(n === 1 ? '铸成！' : '重铸成功！');
            }}
          >
            {why ?? (n === 1 ? '打造' : `重铸到${st.name}`)}
          </button>
        </>
      )}
    </div>
  );
}

function GearList({ sim, make, which, onChange }: { sim: Sim; make: boolean; which: 'armor' | 'old'; onChange: () => void }) {
  const P = sim.progress, E = equipped(P), mine = owned(P);
  const list = GEAR.filter((g) => (which === 'armor' ? g.slot !== 'weapon' : g.slot === 'weapon')).filter((g) => make || mine.includes(g.id) || g.prize);
  return (
    <div className="bag-list">
      {which === 'old' && <p className="bag-desc">没有元素的老式兵器，和打擂、挑战巨人、试炼塔赢来的彩头。</p>}
      {list.map((g) => {
        const has = mine.includes(g.id), on = E[g.slot as Slot] === g.id;
        const why = !has ? forgeBlock(sim, g) : null;
        const cost = [g.coins ? `${g.coins} 文` : '', ...Object.entries(g.mats).map(([m, n]) => `${matName(m)}×${n}`)].filter(Boolean).join(' ');
        return (
          <div key={g.id} className={'bag-item' + (on ? ' worn' : '')}>
            <div>
              <b>
                {g.name}
                <span className="bi-where"> · {SLOT_NAME[g.slot]}</span>
              </b>
              <div className="bag-desc">
                {g.desc}
                {!has && !g.prize && ` · 要 ${cost}${g.lvl > 1 ? ` · ${g.lvl} 级` : ''}`}
              </div>
            </div>
            {has ? (
              <button onClick={() => (wear(sim, g.id), onChange())}>{on ? '卸下' : '穿上'}</button>
            ) : g.prize ? (
              <span className="ward-where">{g.prize === 'arena' ? '擂台魁首' : g.prize === 'tower' ? '试炼塔' : '巨人挑战 · 噩梦'}</span>
            ) : make ? (
              <button disabled={!!why} onClick={() => (forge(sim, g), onChange())}>
                {why ?? '打造'}
              </button>
            ) : (
              <span className="ward-where">张记铁铺</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

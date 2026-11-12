// The start screen (散人 or a hero) and the skill tree (K): spend points, set the bar, 转职 at 30.
import { useState } from 'react';
import type { Sim } from '../game/sim';
import { SKILLS } from '../game/skills';
import { HEROES, HeroId, LOW_SKILLS, TRANSFER_LEVEL, WANDERER, heroOf } from '../game/heroes';
import { HOUSES } from '../game/sects';
import { BAR_KEYS, capOf, chooseHero, learn, resetSkills, spFree, spTotal, stepCost } from '../game/progress';

const IMG = import.meta.env.BASE_URL + 'portraits/';
const KEYS = BAR_KEYS;

export function StartScreen({ onPick }: { onPick: (hero: HeroId | null) => void }) {
  return (
    <div className="start">
      <h1>天阙 · 散人行</h1>
      <p className="sub">一开始就选好职业，或者做个散人一路闯到 30 级再转职。30 级之前没有大招。</p>
      <div className="picks">
        <button className="pick wanderer" onClick={() => onPick(null)}>
          <img src={IMG + WANDERER.portrait} alt="" />
          <b>散人</b>
          <small>十八家的基础招都能学（每招最高 5 级），没有大招。30 级可以转职。</small>
        </button>
        {HEROES.map((h) => (
          <button key={h.id} className="pick" style={{ borderColor: h.color }} onClick={() => onPick(h.id)}>
            <img src={IMG + h.portrait} alt="" />
            <b>
              {h.title} · {h.name}
            </b>
            <small>{h.blurb} 十招专精（最高 10 级）：三招起手，3 / 6 / 10 / 14 / 18 / 24 级陆续解锁，30 级解锁大招。</small>
          </button>
        ))}
      </div>
      <p className="sub">选了就不能改（散人到 30 级可以转一次）。进度保存在这个浏览器里。</p>
    </div>
  );
}

function SkillCard({ sim, id, onChange }: { sim: Sim; id: string; onChange: () => void }) {
  const P = sim.progress;
  const sk = SKILLS[id];
  const lv = P.skills[id] ?? 0;
  const { cap, why } = capOf(P, id);
  const can = cap > 0 && lv < cap && spFree(P) >= stepCost(lv + 1);
  const slot = P.bar.indexOf(id);
  const [msg, setMsg] = useState('');
  return (
    <div className={`card ${lv ? 'have' : ''} ${cap ? '' : 'locked'}`} title={sk.desc}>
      <div className="card-top">
        <span className="icon">{sk.icon}</span>
        <b>{sk.name}</b>
        {sk.ult && <em className="ult">大招</em>}
      </div>
      <div className="card-lv">{cap ? `Lv ${lv} / ${cap}` : why}</div>
      <p>{sk.desc}</p>
      <div className="card-btns">
        <button
          disabled={!can}
          onClick={() => {
            const e = learn(P, id);
            setMsg(e ?? '');
            onChange();
          }}
        >
          {lv ? `升级 (${stepCost(lv + 1)} 点)` : `学习 (1 点)`}
        </button>
        {lv > 0 && !sk.ult && (
          <select
            value={slot}
            onChange={(e) => {
              const k = +e.target.value;
              if (k >= 0) sim.setSlot(k, id);
              else if (slot >= 0) sim.setSlot(slot, '');
              onChange();
            }}
          >
            <option value={-1}>不放</option>
            {BAR_KEYS.slice(0, -1).map((_, k) => (
              <option key={k} value={k}>
                放在 {KEYS[k]} 键
              </option>
            ))}
          </select>
        )}
        {lv > 0 && sk.ult && <span className="on-r">R 键</span>}
      </div>
      {msg && <div className="card-msg">{msg}</div>}
    </div>
  );
}

export function SkillTree({ sim, onClose, onHero }: { sim: Sim; onClose: () => void; onHero: () => void }) {
  const [, force] = useState(0);
  const P = sim.progress;
  const h = heroOf(P.hero);
  const [pick, setPick] = useState<HeroId>('Berserker');
  const [armed, setArmed] = useState(false);
  const refresh = () => force((n) => n + 1);
  return (
    <div className="panel-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel">
        <header>
          <div>
            <h2>技能树 · {h ? `${h.title} ${h.name}` : '散人'}</h2>
            <div className="sp">
              Lv {P.level} · 技能点 <b>{spFree(P)}</b> / 共 {spTotal(P)}（每升一级 +2；1 到 5 级每级 1 点，6 到 10 级每级 2 点）
            </div>
          </div>
          <div className="hdr-btns">
            <button
              onClick={() => {
                if (!armed) return setArmed(true);
                resetSkills(P);
                setArmed(false);
                refresh();
              }}
              onBlur={() => setArmed(false)}
            >
              {armed ? '再点一次确认洗点' : '洗点'}
            </button>
            <button onClick={onClose}>关闭 (K)</button>
          </div>
        </header>
        {h ? (
          <div className="grid hero-grid">
            {[...h.tree, ...h.more].map((id) => (
              <SkillCard key={id} sim={sim} id={id} onChange={refresh} />
            ))}
          </div>
        ) : (
          <div className="houses">
            {HOUSES.map((ho) => (
              <div key={ho.id} className="house">
                <div className="house-name" style={{ color: ho.color }}>
                  <img src={IMG + ho.portrait} alt="" />
                  {ho.name}
                </div>
                {ho.skills.filter((id) => LOW_SKILLS.includes(id)).map((id) => (
                  <SkillCard key={id} sim={sim} id={id} onChange={refresh} />
                ))}
              </div>
            ))}
          </div>
        )}
        {!h && (
          <div className="transfer">
            <b>转职</b>
            {P.level < TRANSFER_LEVEL ? (
              <span>{TRANSFER_LEVEL} 级后可以转职成任意一个职业（现在 {P.level} 级）。转职后只保留那个职业的招，其它技能点退回。</span>
            ) : (
              <>
                <select value={pick} onChange={(e) => setPick(e.target.value as HeroId)}>
                  {HEROES.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title} · {x.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const e = chooseHero(P, pick);
                    if (!e) {
                      sim.refreshPlayer();
                      onHero();
                      refresh();
                    }
                  }}
                >
                  确认转职（不能反悔）
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

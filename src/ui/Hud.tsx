// On-screen: health and inner strength, level and experience, the six-slot bar with cooldowns, the target, messages,
// a minimap. Reads the sim ten times a second.
import { useEffect, useRef } from 'react';
import type { Sim } from '../game/sim';
import { ULT_CHARGE } from '../game/sim';
import { SKILLS } from '../game/skills';
import { DENS, FOE_KINDS, bossNameOf, menNameOf } from '../game/foes';
import { WORLD_R } from '../game/world';
import { ROADS } from '../game/layout';
import { PLACES } from '../game/places';
import { NPCS, QUESTS, questTarget } from '../game/quests';
import { heroOf } from '../game/heroes';
import { spFree } from '../game/progress';
import { cam } from '../render/Scene';

const KEYS = ['1', '2', '3', '4', '5', 'R'];

/** a 700 m window round the player, north up, over the owner's painted map; dens, roads, foes after you */
const MM_R = 350;
const mapImg = typeof Image !== 'undefined' ? Object.assign(new Image(), { src: import.meta.env.BASE_URL + 'terrain_color.jpg' }) : null;
function Minimap({ sim }: { sim: Sim }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const id = setInterval(() => {
      const c = ref.current;
      if (!c) return;
      const g = c.getContext('2d')!;
      const S = c.width;
      const p = sim.player.pos;
      const sc = S / (MM_R * 2);
      const X = (x: number) => S / 2 + (x - p[0]) * sc;
      const Z = (z: number) => S / 2 + (z - p[2]) * sc;
      g.save();
      g.clearRect(0, 0, S, S);
      g.beginPath();
      g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = '#26301f';
      g.fillRect(0, 0, S, S);
      if (mapImg?.complete && mapImg.naturalWidth) {
        const k = mapImg.naturalWidth / (WORLD_R * 2);
        g.globalAlpha = 0.9;
        g.drawImage(mapImg, (p[0] - MM_R + WORLD_R) * k, (p[2] - MM_R + WORLD_R) * k, MM_R * 2 * k, MM_R * 2 * k, 0, 0, S, S);
        g.globalAlpha = 1;
      }
      g.strokeStyle = 'rgba(240,220,170,0.75)';
      g.lineWidth = 1.5;
      for (const road of ROADS) {
        g.beginPath();
        road.forEach(([x, z], k) => (k ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
        g.stroke();
      }
      for (const d of DENS) {
        if (d.peak) {
          // 天阙: a gold palace mark
          g.fillStyle = '#e8b54a';
          g.strokeStyle = '#3a2a10';
          g.lineWidth = 1.5;
          g.fillRect(X(d.x) - 6, Z(d.z) - 5, 12, 10);
          g.strokeRect(X(d.x) - 6, Z(d.z) - 5, 12, 10);
          g.fillStyle = '#3a2a10';
          g.font = 'bold 9px serif';
          g.fillText('阙', X(d.x) - 4.5, Z(d.z) + 3.5);
          continue;
        }
        g.fillStyle = d.boss ? '#111' : FOE_KINDS[d.kind].color;
        g.beginPath();
        g.arc(X(d.x), Z(d.z), d.boss ? 5 : 3.5, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = d.boss ? '#ff4040' : '#000';
        g.lineWidth = 1;
        g.stroke();
      }
      // waystations: a small house mark (rest there)
      g.font = 'bold 9px serif';
      const MARK: Partial<Record<string, string>> = { inn: '驿', jianzhong: '冢', tomb: '墓' };
      for (const pl of PLACES) {
        if (!MARK[pl.kind]) continue;
        g.fillStyle = '#f1e2bd';
        g.strokeStyle = '#3a2a10';
        g.lineWidth = 1;
        g.fillRect(X(pl.x) - 5, Z(pl.z) - 5, 10, 10);
        g.strokeRect(X(pl.x) - 5, Z(pl.z) - 5, 10, 10);
        g.fillStyle = '#5a2a10';
        g.fillText(MARK[pl.kind]!, X(pl.x) - 4.5, Z(pl.z) + 3.5);
      }
      const qt = questTarget(sim);
      if (qt) {
        // the quest target: a gold star (pinned to the edge when it's off this window)
        let qx = X(qt[0]) - S / 2, qz = Z(qt[1]) - S / 2;
        const ql = Math.hypot(qx, qz);
        if (ql > S / 2 - 8) {
          qx *= (S / 2 - 8) / ql;
          qz *= (S / 2 - 8) / ql;
        }
        g.fillStyle = '#ffd36a';
        g.strokeStyle = '#3a2400';
        g.beginPath();
        for (let k = 0; k < 10; k++) {
          const r = k % 2 ? 3 : 7;
          const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
          g.lineTo(S / 2 + qx + Math.cos(a) * r, S / 2 + qz + Math.sin(a) * r);
        }
        g.closePath();
        g.fill();
        g.stroke();
      }
      for (const f of sim.fighters)
        if (f.team === 'sect' && f.hp > 0 && f.aggro) {
          g.fillStyle = '#ff5050';
          g.fillRect(X(f.pos[0]) - 1.5, Z(f.pos[2]) - 1.5, 3, 3);
        }
      g.save();
      g.translate(S / 2, S / 2);
      g.rotate(-cam.yaw);
      g.fillStyle = '#fff';
      g.beginPath();
      g.moveTo(0, -7);
      g.lineTo(4.5, 5);
      g.lineTo(-4.5, 5);
      g.closePath();
      g.fill();
      g.restore();
      g.fillStyle = '#fff';
      g.font = '11px sans-serif';
      g.fillText('北', S / 2 - 5, 13);
      g.restore();
    }, 200);
    return () => clearInterval(id);
  }, [sim]);
  return (
    <>
      <canvas ref={ref} className="minimap" width={180} height={180} />
      <div className="mm-hint">M 打开大地图</div>
    </>
  );
}

function QuestTracker({ sim }: { sim: Sim }) {
  const Q = sim.progress.quest;
  const q = QUESTS[Q.idx];
  if (!q) return null;
  const p = sim.player.pos;
  const giver = NPCS.find((n) => n.role === q.giver)!;
  const g = q.goal;
  let what = '';
  if (Q.state === 'offered') what = `回村找${giver.name}领任务`;
  else if (Q.state === 'ready') what = q.auto ? '' : `回村找${giver.name}交付`;
  else if (g.type === 'visit') what = `去${g.place}`;
  else if (g.type === 'folk') what = `去找${g.name}`;
  else if (g.type === 'learn') what = '按 K 学一招';
  else if (g.type === 'talk') what = `去找${NPCS.find((n) => n.role === g.npc)!.name}`;
  else if (g.type === 'kill') what = `打倒 ${menNameOf(DENS[g.den])} ${Math.min(Q.count, g.count)} / ${g.count}`;
  else if (g.type === 'boss') what = `打倒${bossNameOf(DENS[g.den])}`;
  else if (g.type === 'level') what = `练到 ${g.level} 级（现在 ${sim.progress.level}）`;
  const tgt = questTarget(sim);
  const dist = tgt ? Math.round(Math.hypot(tgt[0] - p[0], tgt[1] - p[2])) : 0;
  return (
    <div className="quest">
      <div className="quest-title">主线 · {q.title}</div>
      <div className="quest-what">{what}</div>
      {tgt && dist > 6 && <div className="quest-dist">距离 {dist} 米 · 跟着金色光柱走</div>}
    </div>
  );
}

export function Hud({ sim, tick }: { sim: Sim; tick: number }) {
  void tick;
  const p = sim.player;
  const P = sim.progress;
  const h = heroOf(P.hero);
  const t = sim.fighters[sim.lastTarget];
  const showT = t && t.hp > 0 && sim.dist(p, t) < 30;
  const free = spFree(P);
  return (
    <div className="hud">
      <div className="me">
        <div className="me-name">
          {p.name} <span className="lvl">Lv {P.level}</span> <span className="cls">{h ? `${h.title}` : '散人'}</span>
        </div>
        <div className="bar hp">
          <i style={{ width: `${(p.hp / p.maxHp) * 100}%` }} />
          <b>
            {Math.ceil(p.hp)} / {p.maxHp}
          </b>
        </div>
        <div className="bar mp">
          <i style={{ width: `${(p.mp / p.maxMp) * 100}%` }} />
        </div>
        <div className="bar xp">
          <i style={{ width: `${P.level >= 30 ? 100 : (P.xp / sim.xpNeed()) * 100}%` }} />
        </div>
        {free > 0 && <div className="sp-hint">有 {free} 个技能点 · 按 K 加点</div>}
      </div>
      {showT && (
        <div className="target">
          <div>
            {t.name} <span className="lvl">Lv {t.level}</span>
          </div>
          <div className="bar hp">
            <i style={{ width: `${(t.hp / t.maxHp) * 100}%` }} />
          </div>
        </div>
      )}
      <div className="skillbar">
        {P.bar.map((id, i) => {
          const sk = id ? SKILLS[id] : null;
          const cd = id ? p.cds[id] ?? 0 : 0;
          const lv = id ? P.skills[id] ?? 0 : 0;
          return (
            <div key={i} className={`slot ${sk ? '' : 'empty'} ${sk && p.mp < sk.mp ? 'nomp' : ''}`} title={sk ? `${sk.name}：${sk.desc}` : '空'}>
              <span className="icon">{sk ? sk.icon : '·'}</span>
              {cd > 0 && (
                <span className="cd" style={{ height: `${Math.min(1, cd / sk!.cd) * 100}%` }}>
                  <em>{cd.toFixed(cd < 1 ? 1 : 0)}</em>
                </span>
              )}
              <span className="key">{KEYS[i]}</span>
              <span className="name">{sk ? `${sk.name}${lv ? ` ${lv}` : ''}` : '空'}</span>
            </div>
          );
        })}
      </div>
      {sim.ultCharge !== null && (
        <div className="charge">
          <i style={{ width: `${Math.min(1, sim.ultCharge / ULT_CHARGE) * 100}%` }} />
          <b>蓄力 · 按住 R</b>
        </div>
      )}
      <div className="toasts">
        {sim.toasts.map((t) => (
          <div key={t.id} className="toast" style={{ opacity: Math.min(1, t.t) }}>
            {t.text}
          </div>
        ))}
      </div>
      {p.hp <= 0 && <div className="dead">你倒下了</div>}
      <QuestTracker sim={sim} />
      {sim.near >= 0 && sim.dialog < 0 && <div className="talk-hint">F 与 {sim.fighters[sim.near].name} 对话</div>}
      <div className="help">WASD 移动 · 鼠标转视角 · 左键攻击 · Shift/右键 闪避 · 空格 跳 · 1-5 技能 · 按住 R 大招 · K 技能树 · 滚轮 远近</div>
      <Minimap sim={sim} />
    </div>
  );
}

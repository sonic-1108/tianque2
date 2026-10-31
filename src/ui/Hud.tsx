// On-screen: health and inner strength, level and experience, the six-slot bar with cooldowns, the target, messages,
// a minimap. Reads the sim ten times a second.
import { useEffect, useRef } from 'react';
import type { Sim } from '../game/sim';
import { ULT_CHARGE } from '../game/sim';
import { SKILLS } from '../game/skills';
import { DENS, FOE_KINDS } from '../game/foes';
import { WORLD_R } from '../game/world';
import { heroOf } from '../game/heroes';
import { spFree } from '../game/progress';
import { cam } from '../render/Scene';

const KEYS = ['1', '2', '3', '4', '5', 'R'];

function Minimap({ sim }: { sim: Sim }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const id = setInterval(() => {
      const c = ref.current;
      if (!c) return;
      const g = c.getContext('2d')!;
      const S = c.width;
      const sc = S / (WORLD_R * 2 + 20);
      const p = sim.player.pos;
      g.clearRect(0, 0, S, S);
      g.fillStyle = 'rgba(20,28,22,0.75)';
      g.beginPath();
      g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
      g.fill();
      const X = (x: number) => S / 2 + x * sc;
      const Z = (z: number) => S / 2 + z * sc;
      g.fillStyle = '#d6c7a1';
      g.fillRect(X(0) - 3, Z(0) - 3, 6, 6);
      for (const d of DENS) {
        g.fillStyle = d.boss ? '#111' : FOE_KINDS[d.kind].color;
        g.globalAlpha = 0.8;
        g.beginPath();
        g.arc(X(d.x), Z(d.z), d.boss ? 4.5 : 3, 0, Math.PI * 2);
        g.fill();
        if (d.boss) {
          g.strokeStyle = '#ff4040';
          g.stroke();
        }
      }
      g.globalAlpha = 1;
      for (const f of sim.fighters)
        if (f.team === 'sect' && f.hp > 0 && f.aggro) {
          g.fillStyle = '#ff5050';
          g.fillRect(X(f.pos[0]) - 1.5, Z(f.pos[2]) - 1.5, 3, 3);
        }
      // you, and which way the camera looks
      g.save();
      g.translate(X(p[0]), Z(p[2]));
      g.rotate(-cam.yaw);
      g.fillStyle = '#fff';
      g.beginPath();
      g.moveTo(0, -7);
      g.lineTo(4.5, 5);
      g.lineTo(-4.5, 5);
      g.closePath();
      g.fill();
      g.restore();
    }, 200);
    return () => clearInterval(id);
  }, [sim]);
  return <canvas ref={ref} className="minimap" width={180} height={180} />;
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
      <div className="help">WASD 移动 · 鼠标转视角 · 左键攻击 · Shift/右键 闪避 · 空格 跳 · 1-5 技能 · 按住 R 大招 · K 技能树 · 滚轮 远近</div>
      <Minimap sim={sim} />
    </div>
  );
}

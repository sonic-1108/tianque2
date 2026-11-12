// The whole map (M): the land, the seven roads, 青石村, every den with its level (grey once cleared), the
// waystations and story places, 天阙, where the quest wants you and where you are. Click or M / Esc to close.
import { ROOMS } from '../game/interiors';
import { ARENA_AT, GLADES, firefliesOut } from '../game/jianghu';
import { HOME } from '../game/village';
import { postAt } from '../game/conflict';
import { CT_POS } from '../game/court';
import { useEffect, useRef } from 'react';
import type { Sim } from '../game/sim';
import { DENS, FOE_KINDS, bossNameOf, menNameOf } from '../game/foes';
import { ROADS, WORLD_R } from '../game/layout';
import { PLACES } from '../game/places';
import { QUESTS, questTarget } from '../game/quests';
import { cam } from '../render/Scene';

const mapImg = typeof Image !== 'undefined' ? Object.assign(new Image(), { src: import.meta.env.BASE_URL + 'terrain_color.jpg' }) : null;

export function BigMap({ sim, onClose }: { sim: Sim; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const draw = () => {
      const c = ref.current;
      if (!c) return;
      const S = Math.min(window.innerWidth, window.innerHeight) * 0.9 * (window.devicePixelRatio || 1);
      if (c.width !== Math.round(S)) c.width = c.height = Math.round(S);
      const g = c.getContext('2d')!;
      const k = S / (WORLD_R * 2);
      const X = (x: number) => (x + WORLD_R) * k;
      const Z = (z: number) => (z + WORLD_R) * k;
      const u = S / 900; // a unit that scales marks and text with the map
      g.clearRect(0, 0, S, S);
      g.save();
      g.beginPath();
      g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = '#26301f';
      g.fillRect(0, 0, S, S);
      if (mapImg?.complete && mapImg.naturalWidth) g.drawImage(mapImg, 0, 0, S, S);
      // the rings the dens stand on, faint
      g.strokeStyle = 'rgba(255,240,200,0.12)';
      g.lineWidth = 1 * u;
      for (const r of [300, 560, 800]) {
        g.beginPath();
        g.arc(X(0), Z(0), r * k, 0, Math.PI * 2);
        g.stroke();
      }
      g.strokeStyle = 'rgba(245,226,180,0.85)';
      g.lineWidth = 2.2 * u;
      for (const road of ROADS) {
        g.beginPath();
        road.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
        g.stroke();
      }
      const label = (t: string, x: number, y: number, size: number, color = '#f6ecd2') => {
        g.font = `bold ${size * u}px serif`;
        g.textAlign = 'center';
        g.lineWidth = 3 * u;
        g.strokeStyle = 'rgba(20,14,8,0.85)';
        g.strokeText(t, x, y);
        g.fillStyle = color;
        g.fillText(t, x, y);
      };
      // 青石村
      g.fillStyle = '#f1e2bd';
      g.beginPath();
      g.arc(X(0), Z(0), 9 * u, 0, Math.PI * 2);
      g.fill();
      label('青石村', X(0), Z(0) - 14 * u, 17);
      // the dens: a coloured dot with its level; bosses named; grey once nobody is left in it
      const alive = new Map<number, number>();
      for (const f of sim.fighters) if (f.team === 'sect' && f.hp > 0) alive.set((f as any).den, (alive.get((f as any).den) ?? 0) + 1);
      DENS.forEach((d, i) => {
        const x = X(d.x), y = Z(d.z);
        const empty = !alive.get(i);
        if (d.peak) {
          g.fillStyle = '#e8b54a';
          g.strokeStyle = '#3a2a10';
          g.lineWidth = 2 * u;
          g.fillRect(x - 11 * u, y - 9 * u, 22 * u, 18 * u);
          g.strokeRect(x - 11 * u, y - 9 * u, 22 * u, 18 * u);
          label('阙', x, y + 6 * u, 15, '#3a2a10');
          label(`天阙 · ${bossNameOf(d)} Lv${d.level}`, x, y - 15 * u, 15, '#ffd36a');
          return;
        }
        g.fillStyle = empty ? '#777' : d.boss ? '#111' : FOE_KINDS[d.kind].color;
        g.beginPath();
        g.arc(x, y, (d.boss ? 8 : 5.5) * u, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = d.boss ? '#ff4040' : '#000';
        g.lineWidth = 1.5 * u;
        g.stroke();
        if (d.boss) label(`${bossNameOf(d)} Lv${d.level + 3}`, x, y - 13 * u, 14, empty ? '#bbb' : '#ff8a7a');
        else label(`${menNameOf(d)} ${d.level}`, x, y - 9 * u, 11, empty ? '#aaa' : '#f6ecd2');
      });
      // waystations and the story's places
      const MARK: Partial<Record<string, string>> = { inn: '驿', jianzhong: '冢', tomb: '墓', smithy: '铁', tavern: '酒', shrine: '庙' };
      for (const pl of PLACES) {
        const m = MARK[pl.kind];
        if (!m || (pl.kind !== 'inn' && pl.kind !== 'jianzhong' && pl.kind !== 'tomb' && pl.kind !== 'smithy')) continue;
        const x = X(pl.x), y = Z(pl.z);
        g.fillStyle = '#f1e2bd';
        g.strokeStyle = '#3a2a10';
        g.lineWidth = 1.5 * u;
        g.fillRect(x - 8 * u, y - 8 * u, 16 * u, 16 * u);
        g.strokeRect(x - 8 * u, y - 8 * u, 16 * u, 16 * u);
        label(m, x, y + 5 * u, 12, '#5a2a10');
        label(pl.name, x, y + 21 * u, 11);
      }
      // the 江湖 things you can go and do: your house, the hunter, the ring, fireflies on a summer night
      const marks: [number, number, string, string][] = [
        [HOME.door[0], HOME.door[1], '家', sim.progress.home ? '你的家' : '空宅出售'],
        [...ROOMS.find((r) => r.theme === 'hunter')!.door, '猎', '猎户韩家'] as [number, number, string, string],
        [...ARENA_AT(), '擂', '擂台'] as [number, number, string, string],
      ];
      if (firefliesOut(sim)) for (const [gx, gz] of GLADES) marks.push([gx, gz, '萤', '萤火虫']);
      for (const [mx, mz, m, name] of marks) {
        const x = X(mx), y = Z(mz);
        g.fillStyle = '#d9f2d0';
        g.strokeStyle = '#1f4a22';
        g.lineWidth = 1.5 * u;
        g.fillRect(x - 7 * u, y - 7 * u, 14 * u, 14 * u);
        g.strokeRect(x - 7 * u, y - 7 * u, 14 * u, 14 * u);
        label(m, x, y + 4.5 * u, 11, '#1f4a22');
        label(name, x, y + 19 * u, 10);
      }
      // the false court's men: checkpoints (a red bar across the road) and patrols (red dots)
      sim.war.posts.forEach((po, k) => {
        if (!po.active) return;
        const [px, pz] = postAt(k);
        g.fillStyle = '#c8322a';
        g.fillRect(X(px) - 7 * u, Z(pz) - 3 * u, 14 * u, 6 * u);
        label('关卡', X(px), Z(pz) - 8 * u, 11, '#ff9a8a');
      });
      for (const pt of sim.war.patrols)
        for (const id of pt.ids) {
          const f = sim.fighters[id];
          if (f.hp <= 0) continue;
          g.fillStyle = '#ff5a4a';
          g.beginPath();
          g.arc(X(f.pos[0]), Z(f.pos[2]), 3 * u, 0, Math.PI * 2);
          g.fill();
        }
      // the wanted on the bounty board (悬), and your companions (green)
      for (const f of sim.fighters) {
        const fa = f as any;
        if (fa.rival !== undefined && f.team === 'sect' && f.hp > 0 && !fa.benched) {
          g.fillStyle = '#7a1010';
          g.strokeStyle = '#ffb0a0';
          g.lineWidth = 1.5 * u;
          g.beginPath();
          g.arc(X(f.pos[0]), Z(f.pos[2]), 7 * u, 0, Math.PI * 2);
          g.fill();
          g.stroke();
          label('悬', X(f.pos[0]), Z(f.pos[2]) + 4.5 * u, 11, '#ffd0c0');
          label(`${f.name.split(' · ')[1]} ${f.level}`, X(f.pos[0]), Z(f.pos[2]) - 10 * u, 11, '#ffb0a0');
        }
        if (fa.comp && f.hp > 0) {
          g.fillStyle = '#5ee08a';
          g.beginPath();
          g.arc(X(f.pos[0]), Z(f.pos[2]), 3.5 * u, 0, Math.PI * 2);
          g.fill();
        }
      }
      // 永安城: the court
      {
        const x = X(CT_POS[0]), y = Z(CT_POS[1]);
        g.fillStyle = '#c8322a';
        g.strokeStyle = '#ffd36a';
        g.lineWidth = 2 * u;
        g.fillRect(x - 11 * u, y - 11 * u, 22 * u, 22 * u);
        g.strokeRect(x - 11 * u, y - 11 * u, 22 * u, 22 * u);
        label('朝', x, y + 6 * u, 15, '#ffe9a8');
        label('永安城 · 朝廷', x, y + 27 * u, 13, '#ffd36a');
      }
      // the quest's goal
      const qt = questTarget(sim);
      const q = QUESTS[sim.progress.quest.idx];
      if (qt) {
        const x = X(qt[0]), y = Z(qt[1]);
        g.fillStyle = '#ffd36a';
        g.strokeStyle = '#5a3a00';
        g.lineWidth = 1.5 * u;
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = (i % 2 ? 5 : 12) * u;
          g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        g.closePath();
        g.fill();
        g.stroke();
        if (q) label(q.title, x, y + 26 * u, 14, '#ffd36a');
      }
      // you: an arrow the way the camera looks
      const p = sim.player.pos;
      const px = X(p[0]), py = Z(p[2]);
      const a = -cam.yaw; // forward on the map is (-sin yaw, -cos yaw)
      g.save();
      g.translate(px, py);
      g.rotate(a);
      g.fillStyle = '#7fd4ff';
      g.strokeStyle = '#08202c';
      g.lineWidth = 2 * u;
      g.beginPath();
      g.moveTo(0, -13 * u);
      g.lineTo(8 * u, 9 * u);
      g.lineTo(0, 4 * u);
      g.lineTo(-8 * u, 9 * u);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
      g.restore();
      // north
      label('北', S / 2, 26 * u, 18, '#ffd36a');
    };
    draw();
    const id = setInterval(draw, 250);
    window.addEventListener('resize', draw);
    return () => {
      clearInterval(id);
      window.removeEventListener('resize', draw);
    };
  }, [sim]);
  return (
    <div className="bigmap" onClick={onClose}>
      <canvas ref={ref} />
      <div className="bigmap-hint">M 或 Esc 关闭 · 金星是当前任务 · 灰点是已清空的寨子</div>
    </div>
  );
}

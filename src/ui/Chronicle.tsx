// 江湖志: the chronicle of the world, newest first (the seasons, the festivals, first snows, storms, what you did).
import type { Sim } from '../game/sim';
import { dateOf } from '../game/life';
import { weatherName } from '../game/clock';

export function Chronicle({ sim, onClose }: { sim: Sim; onClose: () => void }) {
  const list = [...sim.chronicle].reverse();
  return (
    <div className="chron" onClick={onClose}>
      <div className="chron-book" onClick={(e) => e.stopPropagation()}>
        <h2>江湖志</h2>
        <div className="chron-now">
          今 · {dateOf(sim.clock)} · {sim.clock.shichen}时 · {weatherName(sim.weather)}
        </div>
        {list.length === 0 && <div className="chron-row">尚无记载。</div>}
        {list.map((e, i) => (
          <div key={i} className="chron-row">
            <div className="chron-d">{e.d}</div>
            <div>{e.text}</div>
          </div>
        ))}
        <div className="chron-hint">J 或 Esc 关闭</div>
      </div>
    </div>
  );
}

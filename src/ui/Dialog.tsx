// Talking to a villager (F): the elder gives and takes the story quests, the doctor heals, the storyteller gossips.
import { useState } from 'react';
import type { Sim } from '../game/sim';
import { NPCS, QUESTS, TELLER_LINES } from '../game/quests';

export function Dialog({ sim, onClose, onChange }: { sim: Sim; onClose: () => void; onChange: () => void }) {
  const f = sim.fighters[sim.dialog];
  const role = (f as any)?.role as 'elder' | 'doctor' | 'teller' | undefined;
  const npc = NPCS.find((n) => n.role === role);
  const [line] = useState(() => TELLER_LINES[Math.floor(Math.random() * TELLER_LINES.length)]);
  if (!f || !npc) return null;
  const Q = sim.progress.quest;
  const q = QUESTS[Q.idx];
  const mine = q && q.giver === role;
  let body = npc.greet;
  const buttons: { label: string; go: () => void }[] = [];
  if (mine && Q.state === 'offered') {
    body = q.intro;
    buttons.push({ label: `接受任务：${q.title}`, go: () => sim.acceptQuest() });
  } else if (mine && Q.state === 'active') body = `${q.intro}\n\n（任务进行中）`;
  else if (mine && Q.state === 'ready') {
    body = q.done;
    buttons.push({ label: `交付任务（经验 +${q.xp}）`, go: () => sim.turnInQuest() });
  } else if (!q && role === 'elder') body = '青石村的山贼都清干净了。江湖还大，往后的路你自己走。';
  if (role === 'doctor') {
    if (Q.state === 'ready' && q?.goal.type === 'talk' && q.goal.npc === 'doctor') body = '村长让你来的吧？以后受了伤就来，我给你治。';
    buttons.push({ label: '请郎中治伤（回满生命和内力）', go: () => sim.healFull() });
  }
  if (role === 'teller') body = (q?.goal.type === 'talk' && q.goal.npc === 'teller' ? '村长让你来打听消息？好，听着：\n\n' : '') + line;
  return (
    <div className="dialog">
      <div className="dialog-name">{npc.name}</div>
      <div className="dialog-body">{body}</div>
      <div className="dialog-btns">
        {buttons.map((b) => (
          <button
            key={b.label}
            onClick={() => {
              b.go();
              onChange();
            }}
          >
            {b.label}
          </button>
        ))}
        <button onClick={onClose}>离开 (F)</button>
      </div>
    </div>
  );
}

// Talking to a villager (F): the elder gives and takes the story quests, the doctor heals, the storyteller gossips.
import { useState } from 'react';
import type { Sim } from '../game/sim';
import { NPCS, QUESTS, TELLER_LINES } from '../game/quests';
import { save } from '../game/progress';
import { ALL_FOLK } from '../game/interiors';

export function Dialog({ sim, onClose, onChange }: { sim: Sim; onClose: () => void; onChange: () => void }) {
  const f = sim.fighters[sim.dialog];
  const role = (f as any)?.role as 'elder' | 'doctor' | 'teller' | undefined;
  const npc = NPCS.find((n) => n.role === role);
  const [line] = useState(() => TELLER_LINES[Math.floor(Math.random() * TELLER_LINES.length)]);
  const folk = f && (f as any).folk !== undefined ? ALL_FOLK[(f as any).folk] : null;
  const [pick] = useState(() => Math.random());
  if (f && folk) {
    const said = folk.lines[Math.floor(pick * folk.lines.length)];
    return (
      <div className="dialog">
        <div className="dialog-name">{folk.name}</div>
        <div className="dialog-body">{said}</div>
        <div className="dialog-btns">
          {folk.heal && (
            <button
              onClick={() => {
                sim.healFull();
                onChange();
              }}
            >
              {folk.heal}
            </button>
          )}
          <button onClick={onClose}>离开 (F)</button>
        </div>
      </div>
    );
  }
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
    if (Q.state === 'ready' && q?.goal.type === 'talk' && q.goal.npc === 'doctor')
      body =
        q.title === '玉佩'
          ? '你看这本旧医书，这一页画的就是它：天阙守阙人的信物。\n守阙人一家，二十年前那一夜全死了，只有一个婴儿下落不明。\n……石伯捡到你，也是那年冬天。'
          : '石伯让你来的？这些伤药你带着。\n你这块玉佩……我好像在哪本旧医书里见过。等我翻翻。\n以后受了伤就来，我给你治。';
    buttons.push({ label: '请慧明治伤（回满生命和内力）', go: () => sim.healFull() });
  }
  if (role === 'teller')
    body =
      q?.goal.type === 'talk' && q.goal.npc === 'teller'
        ? '石伯让你来听天阙的事？好，听着。\n\n' + TELLER_LINES.slice(0, 3).join('\n\n') + '\n\n雷彪那封信上的印？那是天阙的金印。可盖印的人，不该还活着。'
        : line;
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

/** a chapter's opening card is due: its first quest is up and the card hasn't been shown */
export function chapterDue(sim: Sim) {
  if ((globalThis as any).__T2_NOCARD) return false; // headless tests
  const P = sim.progress;
  const q = QUESTS[P.quest.idx];
  return !!q?.chapter && !sim.note && (P.quest.state === 'offered' || (!!q.direct && P.quest.state === 'active')) && P.chapterSeen !== P.quest.idx;
}
/** the chapter card: its name, then the narration line by line */
export function ChapterCard({ sim, onClose }: { sim: Sim; onClose: () => void }) {
  const P = sim.progress;
  const q = QUESTS[P.quest.idx];
  if (!q?.chapter) return null;
  const close = () => {
    P.chapterSeen = P.quest.idx;
    save(P);
    onClose();
  };
  return (
    <div className="chapter" onClick={close}>
      <div className="chapter-name">{q.chapter.name}</div>
      <div className="chapter-text">
        {q.chapter.text.split('\n').map((l, i) => (
          <p key={i} style={{ animationDelay: `${0.6 + i * 1.1}s` }}>
            {l}
          </p>
        ))}
      </div>
      <button className="chapter-go" style={{ animationDelay: `${0.8 + q.chapter.text.split('\n').length * 1.1}s` }}>
        继续
      </button>
    </div>
  );
}

/** a story beat that just happened out in the world (an auto quest handed itself in): its words, then 继续 */
export function NoteCard({ sim, onClose }: { sim: Sim; onClose: () => void }) {
  const n = sim.note;
  if (!n) return null;
  const close = () => {
    sim.note = null;
    onClose();
  };
  const lines = n.text.split('\n');
  return (
    <div className="chapter note" onClick={close}>
      <div className="chapter-name">{n.title}</div>
      <div className="chapter-text">
        {lines.map((l, i) => (
          <p key={i} style={{ animationDelay: `${0.3 + i * 0.8}s` }}>
            {l}
          </p>
        ))}
      </div>
      <button className="chapter-go" style={{ animationDelay: `${0.5 + lines.length * 0.8}s` }}>
        继续
      </button>
    </div>
  );
}

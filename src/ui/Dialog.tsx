// Talking to a villager (F): the elder gives and takes the story quests, the doctor heals, the storyteller gossips.
import { useState } from 'react';
import type { Sim } from '../game/sim';
import { NPCS, QUESTS, TELLER_LINES } from '../game/quests';
import { save } from '../game/progress';
import { ALL_FOLK } from '../game/interiors';
import { worldRemark } from '../game/life';
import { BUYERS, ITEMS, SHOPS, bag, buy, done, give, nextCase, priceOf, purse, sell, startSpar, wantOf } from '../game/play';
import type { Sim as SimT } from '../game/sim';
import { GIFTS, RIVALS, arenaState, comps, giftTo, setMode, startArena, type Comp } from '../game/jianghu';

/** what you can do with a folk besides talk: buy, sell, give what they wished for, play their game */
function actionsFor(sim: SimT, name: string, changed: () => void, startGame: () => void) {
  const out: { label: string; go: () => void; hot?: boolean; off?: boolean }[] = [];
  const P = sim.progress, B = bag(P), D = done(P), c = sim.clock;
  for (const id of SHOPS[name] ?? []) {
    const it = ITEMS[id];
    out.push({ label: `买${it.name} · ${priceOf(sim, id)}文`, go: () => (buy(sim, id), changed()), off: it.kind === 'tool' && (B[id] ?? 0) > 0 });
  }
  if (name === '面摊 · 胖大海' && c.festival?.name === '中秋') out.push({ label: `买月饼 · ${priceOf(sim, 'mooncake')}文`, go: () => (buy(sim, 'mooncake'), changed()) });
  const kinds = BUYERS[name];
  if (kinds) {
    const n = Object.entries(B).filter(([id, k]) => k > 0 && id !== 'hen' && kinds.includes(ITEMS[id]?.kind)).reduce((a, [, k]) => a + k, 0);
    if (n) out.push({ label: kinds.includes('fish') ? `卖鱼（${n} 条）` : `卖药材（${n} 株）`, go: () => (sell(sim, kinds), changed()) });
  }
  const w = wantOf(sim, name);
  if (w && (B[w.item] ?? 0) > 0) out.push({ label: `送上${ITEMS[w.item].name}`, hot: true, go: () => (give(sim, w), changed()) });
  const play = (kind: string, extra: object = {}) => () => {
    sim.game = { kind, ...extra };
    startGame();
  };
  if (name === '渔翁 · 老钓') out.push({ label: '借竿钓鱼', go: play('fish') });
  if (name === '书摊 · 老夫子' || (name === '灯笼匠 · 胡老爹' && c.festival?.name === '元宵灯会'))
    out.push({ label: D.riddle === c.day ? '猜灯谜（今天猜过了）' : '猜灯谜', go: play('riddle'), off: D.riddle === c.day });
  if (name === '赌客 · 钱八') out.push({ label: '掷骰子', go: play('dice') });
  if (name === '茶博士') out.push({ label: '投壶', go: play('touhu') });
  if (name === '礼部主事 · 孔方') {
    const took = D.exam === c.year;
    out.push({ label: took ? '应试（今年考过了）' : '应试 · 20文', off: took || purse(P) < 20, go: () => {
      P.coins = purse(P) - 20;
      play('exam')();
    } });
  }
  if (name === '击鼓鸣冤的老汉') {
    const k = nextCase(sim);
    if (k >= 0) out.push({ label: D.casefail === c.day ? '替他击鼓（明天再来）' : '替他击鼓鸣冤', hot: true, off: D.casefail === c.day, go: play('case', { idx: k }) });
  }
  if (name === '丞相 · 魏如晦') {
    const morning = c.hour >= 6 && c.hour < 12;
    out.push({ label: D.debate === c.day ? '朝议（今日已议）' : morning ? '参与朝议' : '朝议（早朝在卯时到午时）', hot: morning && D.debate !== c.day, off: !morning || D.debate === c.day, go: play('debate') });
  }
  if (name === '铁匠 · 张大锤') out.push({ label: '打造兵器甲胄', hot: true, go: play('forge') });
  if (name === '擂台官 · 包金刚') {
    const st = arenaState(sim);
    out.push({ label: sim.jh.arena ? '打擂中……' : st === 'open' ? '上台打擂（五阵）' : st === 'done' ? '打擂（本季打过了）' : '打擂（每季第二天辰时到戌时）', hot: st === 'open', off: st !== 'open' || !!sim.jh.arena || !!sim.spar, go: () => (startArena(sim), startGame()) });
  }
  if (name === '镇国大将军 · 霍铮') out.push({ label: sim.spar ? '演武中……' : '请将军指点（演武）', off: !!sim.spar, go: () => (startSpar(sim), startGame()) });
  return out;
}

/** a companion: how they are with you, what they say, where they go, a gift */
function CompDialog({ sim, onClose, onChange }: { sim: Sim; onClose: () => void; onChange: () => void }) {
  const f = sim.fighters[sim.dialog];
  const r = RIVALS[(f as any).rival];
  const c: Comp | undefined = comps(sim.progress)[r?.id];
  if (!r || !c) return null;
  const short = r.name.split(' · ')[1];
  const B = bag(sim.progress);
  const told = c.told ?? 0;
  const said = told > 0 && r.story ? r.story[told - 1] : r.joinLine ?? r.beat;
  const mode = { follow: '跟着你', wait: '在原地等你', home: '在村里等你' }[c.mode];
  const go = (m: Comp['mode']) => () => {
    setMode(sim, f, m);
    onChange();
  };
  const gifts = GIFTS.filter((id) => (B[id] ?? 0) > 0);
  return (
    <div className="dialog">
      <div className="dialog-name">
        {r.name}
        <span className="dialog-act"> · 同伴 · {mode} · 好感 {Math.round(c.aff)}</span>
      </div>
      <div className="dialog-body">{said}</div>
      <div className="dialog-btns">
        {c.mode !== 'follow' && (
          <button className="hot" onClick={go('follow')}>
            跟我走
          </button>
        )}
        {c.mode !== 'wait' && <button onClick={go('wait')}>在这儿等着</button>}
        {c.mode !== 'home' && <button onClick={go('home')}>回村里等我</button>}
        {gifts.map((id) => (
          <button key={id} disabled={c.gift === sim.clock.day} onClick={() => (giftTo(sim, f, id), onChange())}>
            送{ITEMS[id].name}
          </button>
        ))}
        <button onClick={onClose}>离开 (F)</button>
      </div>
      <div className="dialog-purse">{short}和你一起打得越多，送的礼越合心意，好感越高（30 / 60 / 100 时会跟你说心里话）</div>
    </div>
  );
}

export function Dialog({ sim, onClose, onChange }: { sim: Sim; onClose: () => void; onChange: () => void }) {
  const f = sim.fighters[sim.dialog];
  if (f && (f as any).comp) return <CompDialog sim={sim} onClose={onClose} onChange={onChange} />;
  const role = (f as any)?.role as 'elder' | 'doctor' | 'teller' | undefined;
  const npc = NPCS.find((n) => n.role === role);
  const [line] = useState(() => TELLER_LINES[Math.floor(Math.random() * TELLER_LINES.length)]);
  const folk = f && (f as any).folk !== undefined ? ALL_FOLK[(f as any).folk] : null;
  const [pick] = useState(() => Math.random());
  if (f && folk) {
    // now and then they talk about the world: the weather, the season, the festival, what you've been up to
    const deeds = sim.chronicle.filter((e) => e.talk).map((e) => e.talk!);
    const remark = pick < 0.45 ? worldRemark(sim.clock, sim.weather, deeds, pick / 0.45) : null;
    const want = wantOf(sim, folk.name);
    const said = want ? want.ask : remark ?? folk.lines[Math.floor(pick * folk.lines.length)];
    const acts = actionsFor(sim, folk.name, () => onChange(), () => {
      sim.dialog = -1;
      onChange();
    });
    const act = (f as any).plan?.act;
    return (
      <div className="dialog">
        <div className="dialog-name">
          {folk.name}
          {act && <span className="dialog-act"> · {act}</span>}
        </div>
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
          {acts.map((a, i) => (
            <button key={i} className={a.hot ? 'hot' : ''} disabled={a.off} onClick={a.go}>
              {a.label}
            </button>
          ))}
          <button onClick={onClose}>离开 (F)</button>
        </div>
        <div className="dialog-purse">铜钱 {purse(sim.progress)} 文</div>
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
    sim.note = sim.noteQ.shift() ?? null;
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

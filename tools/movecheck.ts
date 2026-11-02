// Every move against a dummy 5 m in front, in plain node: damage, statuses, where both end up. Quick per-move check.
//   npx tsx tools/movecheck.ts [id ...]
import { Sim } from '../src/game/sim';
import { SKILLS, ALL_SKILL_IDS } from '../src/game/skills';
import { fresh } from '../src/game/progress';
import { groundHeight } from '../src/game/world';
(globalThis as any).localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ALL_SKILL_IDS;
const DT = 1 / 60;
const noIn = (o: any = {}) => ({ move: [0, 0], camYaw: 0, attack: false, dodge: false, jump: false, interact: false, skills: [false, false, false, false, false, false], ultHeld: false, ...o });
for (const id of ids) {
  const P = fresh();
  P.chosen = true;
  P.level = 30;
  const s = new Sim(P);
  const p = s.player;
  p.level = 30;
  const foe = s.fighters.find((f) => f.team === 'sect')!;
  for (const f of s.fighters) if (f !== p && f !== foe && f.team === 'sect') { f.hp = 0; f.respawn = 1e9; f.pos = [900, 0, 900]; }
  const X = 300, Z = 300;
  p.pos = [X, groundHeight(X, Z), Z];
  foe.pos = [X, groundHeight(X, Z - 5), Z - 5];
  foe.home = [X, Z - 5];
  foe.maxHp = foe.hp = 5000;
  foe.aiT = 1e9;
  foe.master = true; // a dummy: stands where it is
  p.yaw = 0;
  P.skills[id] = 1;
  const ult = !!SKILLS[id].ult;
  P.bar = ['', '', '', '', '', ''];
  P.bar[ult ? 5 : 0] = id;
  const log: string[] = [];
  let firstHit = -1;
  for (let t = 0; t < 4; t += DT) {
    const inp: any = noIn();
    if (ult) { inp.ultHeld = t < 1; if (t < DT) inp.skills[5] = true; }
    else if (t < DT) inp.skills[0] = true;
    if (id === "snipe" && t >= 1.7 && t < 1.7 + DT) inp.attack = true;
    const hp = foe.hp;
    foe.aiT = 1e9;
    s.step(DT, inp);
    if (foe.hp < hp && firstHit < 0) firstHit = t;
    s.vq.length = 0;
    s.events.length = 0;
  }
  const st = Object.entries(foe.st).filter(([, v]) => v > 0).map(([k, v]) => `${k}${(+v).toFixed(1)}`).join(' ');
  console.log(id.padEnd(22), `dmg ${(5000 - foe.hp).toFixed(0).padStart(5)} first ${firstHit.toFixed(2)} foe d ${Math.hypot(foe.pos[0] - X, foe.pos[2] - Z).toFixed(1)} act ${foe.act} | me d ${Math.hypot(p.pos[0] - X, p.pos[2] - Z).toFixed(1)} act ${p.act} hp ${p.hp.toFixed(0)}/${p.maxHp} ${st} ${log.join(' ')}`);
}

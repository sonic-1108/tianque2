// Which effects each kit move puts on screen (plain node): the effect commands it sends, zones it leaves and how long,
// buffs it sets. A move that sends next to nothing reads as "no effect" in game.  npx tsx tools/fxaudit.ts [id ...]
import { Sim } from '../src/game/sim';
import { SKILLS } from '../src/game/skills';
import { MOVES2 } from '../src/game/moves2';
import { fresh } from '../src/game/progress';
import { groundHeight } from '../src/game/world';
(globalThis as any).localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const ids = process.argv.slice(2).length ? process.argv.slice(2) : MOVES2.map((m) => m.id);
const DT = 1 / 60;
const noIn = (o: any = {}) => ({ move: [0, 0], camYaw: 0, attack: false, dodge: false, jump: false, interact: false, skills: Array(11).fill(false), ultHeld: false, ...o });
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
  foe.pos = [X, groundHeight(X, Z - 4), Z - 4];
  foe.home = [X, Z - 4];
  foe.maxHp = foe.hp = 5e4;
  foe.master = true;
  p.yaw = 0;
  P.skills[id] = 1;
  const ult = !!SKILLS[id].ult;
  P.bar = Array(11).fill('');
  P.bar[ult ? 10 : 0] = id;
  const names: Record<string, number> = {};
  let fx = 0, zones = 0, zt = 0, proj = 0;
  const seenZ = new Set<any>(), seenP = new Set<any>();
  for (let t = 0; t < 3; t += DT) {
    const inp: any = noIn();
    if (ult) { inp.ultHeld = t < 1.5; if (t < DT) inp.skills[10] = true; }
    else if (t < DT) inp.skills[0] = true;
    foe.aiT = 1e9;
    const f0 = s.fx.length;
    s.step(DT, inp);
    fx += Math.max(0, s.fx.length - f0);
    for (const c of s.vq.splice(0)) if (c.n !== 'sound') names[c.n] = (names[c.n] ?? 0) + 1;
    for (const z of s.zones) if (!seenZ.has(z)) { seenZ.add(z); zones++; zt = Math.max(zt, z.t); }
    for (const q of s.proj) if (!seenP.has(q)) { seenP.add(q); proj++; }
    s.events.length = 0;
  }
  const n = Object.values(names).reduce((a, b) => a + b, 0);
  const pets = ((s as any).kitW?.pets ?? []).length;
  console.log(`${id.padEnd(18)} ${String(n).padStart(4)} cmds  zones ${zones}${zones ? ' ' + zt.toFixed(1) + 's' : ''}  proj ${proj}  ${Object.entries(names).map(([k, v]) => k + 'x' + v).join(' ')}`);
}

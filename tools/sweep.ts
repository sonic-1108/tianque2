// 巡检: runs the game logic (no browser, no GPU) through every start choice and every situation we can think of,
// and reports anything that looks wrong. Run: npx tsx tools/sweep.ts   (SEED=n for another random run)
import { Sim, PLAYER } from '../src/game/sim';
import { SKILLS } from '../src/game/skills';
import { HEROES, HeroId, LOW_SKILLS } from '../src/game/heroes';
import { DENS, DEN_R } from '../src/game/foes';
import { TREES, WORLD_R, groundHeight, VILLAGE_SPAWN, MAX_SLOPE } from '../src/game/world';
import { ROADS, roadPoint } from '../src/game/layout';
import { fresh, chooseHero, learn, capOf } from '../src/game/progress';
import type { Fighter, InputState } from '../src/game/types';

const DT = 1 / 60;
let seed = +(process.env.SEED ?? 1);
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
Math.random = rnd; // the sim's own randomness, reproducible

type Issue = { kind: string; where: string; detail: string };
const issues: Issue[] = [];
const seen = new Map<string, number>();
function report(kind: string, where: string, detail: string) {
  const key = kind + '|' + where;
  seen.set(key, (seen.get(key) ?? 0) + 1);
  if ((seen.get(key) ?? 0) <= 3) issues.push({ kind, where, detail });
}

const noInput = (yaw = 0): InputState => ({ move: [0, 0], camYaw: yaw, attack: false, dodge: false, jump: false, interact: false, skills: [false, false, false, false, false, false], ultHeld: false });

/** watches every fighter every frame */
class Watch {
  stuckT = new Map<number, number>();
  actT = new Map<number, { act: string; t: number }>();
  runT = new Map<number, { id: string; t: number }>();
  maxStep = 0;
  constructor(public sim: Sim, public where: string) {}
  frame(wish: [number, number] | null) {
    const s = this.sim;
    for (const f of s.fighters) {
      const tag = `${this.where} #${f.id} ${f.name}`;
      const nums = [...f.pos, ...f.vel, f.hp, f.mp, f.yaw];
      if (nums.some((v) => !Number.isFinite(v))) report('NaN', tag, JSON.stringify({ pos: f.pos, vel: f.vel, hp: f.hp, act: f.act, run: f.run?.id }));
      if (f.hp > f.maxHp + 0.01) report('hp>max', tag, `${f.hp}/${f.maxHp}`);
      if (f.mp < -0.01) report('mp<0', tag, `${f.mp}`);
      const g = groundHeight(f.pos[0], f.pos[2]);
      if (f.pos[1] < g - 0.3 && f.act !== 'burrow') report('under ground', tag, `y ${f.pos[1].toFixed(2)} ground ${g.toFixed(2)} act ${f.act}`);
      if (f.pos[1] > g + 40) report('flew off', tag, `y ${f.pos[1].toFixed(1)} above ground ${g.toFixed(1)} act ${f.act} run ${f.run?.id}`);
      if (Math.max(Math.abs(f.pos[0]), Math.abs(f.pos[2])) > WORLD_R - 19) report('outside world', tag, `${f.pos[0].toFixed(0)},${f.pos[2].toFixed(0)}`);
      // an act that should end but doesn't
      const a = this.actT.get(f.id);
      const longOk = f.act === 'idle' || f.act === 'run' || f.act === 'dead' || f.act === 'glide' || f.act === 'burrow' || (f.act === 'jump' && !f.grounded);
      if (a && a.act === f.act + f.anim && !longOk && f.actT >= (a as any).last) {
        a.t += DT;
        if (a.t > 5) report('act never ends', tag, `act ${f.act} anim ${f.anim} run ${f.run?.id} grounded ${f.grounded} actT ${f.actT.toFixed(1)}/${f.actDur}`);
      } else this.actT.set(f.id, { act: f.act + f.anim, t: 0 });
      (this.actT.get(f.id) as any).last = f.actT;
      if (f.act === 'jump' && f.grounded) {
        const k = 'jg' + f.id;
        (this as any)[k] = ((this as any)[k] ?? 0) + DT;
        if ((this as any)[k] > 0.5) report('jump on the ground', tag, `run ${f.run?.id}`);
      } else (this as any)['jg' + f.id] = 0;
      if (f.act === 'glide' && f.run?.id !== 'patagonia') report('glide without vest', tag, `run ${f.run?.id}`);
      if (f.act === 'burrow' && f.run?.id !== 'burrow') report('burrow without move', tag, `run ${f.run?.id}`);
      const r = this.runT.get(f.id);
      if (f.run && r && r.id === f.run.id) {
        r.t += DT;
        if (r.t > 9) report('skill never ends', tag, `${f.run.id} act ${f.act}`);
      } else this.runT.set(f.id, { id: f.run?.id ?? '', t: 0 });
      if (f.run && f.hp <= 0 && f.act === 'dead') report('dead but casting', tag, f.run.id);
      if (f.hp <= 0 && f.respawn === undefined) report('dead with no respawn', tag, f.act);
      if (f.hp > 0 && f.act === 'dead') report('alive but lying dead', tag, `${f.hp}`);
      if (f.team === 'sect' && f.hp > 0 && Math.hypot(f.pos[0], f.pos[2]) < 30) report('bandit in the village', tag, `aggro ${f.aggro} at ${f.pos[0].toFixed(0)},${f.pos[2].toFixed(0)} act ${f.act}`);
    }
    // the player wants to move and can, but doesn't
    const p = s.player;
    if (wish && Math.hypot(wish[0], wish[1]) > 0.5) {
      const canMove = p.hp > 0 && (p.act === 'idle' || p.act === 'run') && p.st.root <= 0 && p.st.stun <= 0 && p.st.kneel <= 0 && s.ultCharge === null && p.grounded;
      const sp = Math.hypot(p.vel[0], p.vel[2]);
      if (canMove && sp < 0.8) {
        const t = (this.stuckT.get(PLAYER) ?? 0) + DT;
        this.stuckT.set(PLAYER, t);
        if (t > 1.2) report('player stuck', this.where, `at ${p.pos.map((v) => v.toFixed(1))} act ${p.act} vel ${sp.toFixed(2)} nearTree ${nearTree(p)}`);
      } else this.stuckT.set(PLAYER, 0);
    } else this.stuckT.set(PLAYER, 0);
    if (s.proj.length > 200) report('projectile leak', this.where, `${s.proj.length}`);
    if (s.zones.length > 60) report('zone leak', this.where, `${s.zones.length}`);
    if (s.fx.length > 400) report('fx leak', this.where, `${s.fx.length}`);
  }
}
function nearTree(f: Fighter) {
  let best = 99;
  for (const t of TREES) best = Math.min(best, Math.hypot(t.x - f.pos[0], t.z - f.pos[2]));
  return best.toFixed(2);
}

function step(sim: Sim, w: Watch, inp: InputState | null, wish: [number, number] | null = null) {
  const t0 = performance.now();
  sim.step(DT, inp);
  w.maxStep = Math.max(w.maxStep, performance.now() - t0);
  w.frame(wish);
}
function run(sim: Sim, w: Watch, sec: number, input: (t: number) => InputState | null = () => null) {
  for (let t = 0; t < sec; t += DT) {
    const inp = input(t);
    const wish = inp ? ([inp.move[0], inp.move[1]] as [number, number]) : null;
    step(sim, w, inp, wish);
  }
}
const yawTo = (f: Fighter, x: number, z: number) => Math.atan2(-(x - f.pos[0]), -(z - f.pos[2]));

function newSim(hero: HeroId | null, level = 30) {
  const p = fresh();
  chooseHero(p, hero);
  p.level = level;
  const s = new Sim(p);
  s.player.level = level;
  s.player.maxHp = s.player.hp = 500 + level * 45;
  // learn everything this path allows, max level
  const ids = hero ? HEROES.find((h) => h.id === hero)!.tree : LOW_SKILLS;
  (s.progress as any).level = 999; // points to spare for the test
  for (const id of ids) for (let k = 0; k < 10; k++) learn(s.progress, id);
  s.progress.level = level;
  return s;
}

function place(f: Fighter, x: number, z: number) {
  f.pos = [x, groundHeight(x, z), z];
  f.vel = [0, 0, 0];
  f.grounded = true;
  f.run = null;
  f.act = 'idle';
  f.anim = 'idle';
  f.actT = 0;
  f.actDur = 0;
}
function resetPlayer(s: Sim) {
  const p = s.player;
  p.hp = p.maxHp;
  p.mp = p.maxMp;
  p.cds = {};
  for (const k of Object.keys(p.st) as (keyof typeof p.st)[]) p.st[k] = 0;
  p.respawn = undefined;
  s.ultCharge = null;
}
/** park every foe at home and calm */
function calm(s: Sim) {
  for (const f of s.fighters) if (f.team === 'sect') {
    f.aggro = false;
    if (f.home) place(f, f.home[0], f.home[1]);
    f.hp = f.maxHp;
    f.respawn = undefined;
  }
}

// ---------------------------------------------------------------- 1. the world itself
function worldChecks() {
  // the big map is meant to have cliffs; what must be walkable is every road and every den
  ROADS.forEach((road, k) => {
    for (let i = 1; i < road.length; i++) {
      const [ax, az] = road[i - 1], [bx, bz] = road[i];
      for (let t = 0; t < 1; t += 0.1) {
        const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        if (!Number.isFinite(groundHeight(x, z))) report('terrain NaN', `${x},${z}`, '');
        const sl = Math.abs(groundHeight(x + (bx - ax) * 0.005, z + (bz - az) * 0.005) - groundHeight(x, z)) / (Math.hypot(bx - ax, bz - az) * 0.005);
        if (sl > MAX_SLOPE) report('road too steep', `road ${k} at ${x.toFixed(0)},${z.toFixed(0)}`, `rise ${sl.toFixed(2)} per metre`);
      }
    }
  });
  DENS.forEach((d, i) => {
    const trees = TREES.filter((t) => Math.hypot(t.x - d.x, t.z - d.z) < DEN_R).length;
    if (trees) report('trees in den', `den ${i}`, `${trees}`);
    if (Math.hypot(d.x, d.z) > WORLD_R - 20) report('den at the edge', `den ${i}`, '');
  });
  // trees so close together the player can't pass between (he'd be squeezed back and forth)
  let tight = 0;
  for (let i = 0; i < TREES.length; i++)
    for (let j = i + 1; j < TREES.length; j++) {
      const a = TREES[i], b = TREES[j];
      const gap = Math.hypot(a.x - b.x, a.z - b.z) - (0.45 * a.s + 0.35) - (0.45 * b.s + 0.35);
      if (gap < 0 && gap > -1.5) tight++;
    }
  if (tight) report('overlapping tree trunks', 'world', `${tight} pairs (a pocket can trap you)`);
}

// ---------------------------------------------------------------- 2. walk from the village to every den, and around
function walks(hero: HeroId | null) {
  const s = newSim(hero);
  const w = new Watch(s, `walk ${hero ?? '散人'}`);
  for (const f of s.fighters) if (f.team === 'sect') f.st.invuln = 1e9; // just walking
  for (const f of s.fighters) if (f.team === 'sect') (f as any).aggro = false;
  DENS.forEach((d, i) => {
    resetPlayer(s);
    s.player.st.invuln = 1e9;
    place(s.player, VILLAGE_SPAWN[0], VILLAGE_SPAWN[1]);
    const dist0 = Math.hypot(d.x - s.player.pos[0], d.z - s.player.pos[2]);
    let t = 0;
    const limit = d.r / 6.8 * 1.8 + 20;
    while (t < limit && Math.hypot(d.x - s.player.pos[0], d.z - s.player.pos[2]) > 4) {
      // like a player: follow the den's road out, then turn off to the den
      const pr = Math.hypot(s.player.pos[0], s.player.pos[2]);
      const [rx, rz] = roadPoint(d.road, Math.min(pr + 18, d.r));
      const near = Math.hypot(d.x - s.player.pos[0], d.z - s.player.pos[2]) < 60 || pr > d.r - 10;
      const y = near ? yawTo(s.player, d.x, d.z) : yawTo(s.player, rx, rz);
      const inp = { ...noInput(y), move: [0, 1] as [number, number] };
      // like a player, step round whatever is in the way (a house, a trunk)
      const W = w as any;
      W.trail = W.trail ?? [];
      W.trail.push([s.player.pos[0], s.player.pos[2]]);
      if (W.trail.length > 60) W.trail.shift();
      if (W.side > 0) {
        W.side -= DT;
        inp.move = [1, 0.4];
      } else if (W.trail.length === 60 && Math.hypot(W.trail[0][0] - s.player.pos[0], W.trail[0][1] - s.player.pos[2]) < 2) W.side = 1;
      // hop now and then like a player would
      if (rnd() < 0.01) inp.jump = true;
      step(s, w, inp, inp.move);
      t += DT;
    }
    const left = Math.hypot(d.x - s.player.pos[0], d.z - s.player.pos[2]);
    if (left > 4) report('could not walk to den', `den ${i} (${hero ?? '散人'})`, `${left.toFixed(0)} m short after ${t.toFixed(0)} s, at ${s.player.pos.map((v) => v.toFixed(0))}`);
  });
  // the rim of the world
  resetPlayer(s);
  place(s.player, 0, WORLD_R - 15);
  run(s, w, 6, () => ({ ...noInput(Math.PI), move: [0, 1] }));
  return w.maxStep;
}

// ---------------------------------------------------------------- 3. every move in every situation
const SITUATIONS = ['flat', 'slope', 'tree', 'edge', 'air', 'rooted', 'stunned', 'kneel', 'daze', 'rage', 'die-mid', 'hit-mid', 'no-foe', 'twice'] as const;
function situationPos(s: Sim, sit: string): [number, number] {
  if (sit === 'slope') {
    // the steepest spot we can find in the hills
    let best: [number, number] = [70, 0];
    let bs = 0;
    for (let k = 0; k < 400; k++) {
      const x = (rnd() - 0.5) * 300, z = (rnd() - 0.5) * 300;
      if (DENS.some((d) => Math.hypot(d.x - x, d.z - z) < DEN_R + 20) || Math.hypot(x, z) < 50) continue;
      const sl = Math.abs(groundHeight(x + 1, z) - groundHeight(x, z));
      if (sl > bs) (bs = sl), (best = [x, z]);
    }
    return best;
  }
  if (sit === 'tree') {
    const t = TREES[Math.floor(rnd() * TREES.length)];
    return [t.x + 1.4, t.z];
  }
  if (sit === 'edge') return [0, WORLD_R - 25];
  return [40 + rnd() * 5, 40 + rnd() * 5];
}
function moves(hero: HeroId | null) {
  const s = newSim(hero);
  const label = hero ?? '散人';
  const w = new Watch(s, `moves ${label}`);
  const ids = hero ? HEROES.find((h) => h.id === hero)!.tree : LOW_SKILLS;
  // one bandit to aim at
  const foe = s.fighters.find((f) => f.team === 'sect')!;
  for (const id of ids)
    for (const sit of SITUATIONS) {
      calm(s);
      resetPlayer(s);
      const [x, z] = situationPos(s, sit);
      const p = s.player;
      place(p, x, z);
      p.yaw = 0;
      if (sit !== 'no-foe') {
        place(foe, x, z - 5);
        foe.aiT = 99;
        foe.aggro = true;
      }
      if (sit === 'air') {
        p.vel[1] = 8.5;
        p.grounded = false;
        p.act = 'jump';
        p.anim = 'jump';
        step(s, w, noInput());
      }
      if (sit === 'rooted') p.st.root = 2;
      if (sit === 'stunned') p.st.stun = 1;
      if (sit === 'kneel') p.st.kneel = 1;
      if (sit === 'daze') p.st.daze = 1;
      if (sit === 'rage') p.st.rage = 5;
      s.progress.bar = ['', '', '', '', '', ''];
      const ult = !!SKILLS[id].ult;
      s.progress.bar[ult ? 5 : 0] = id;
      const hp0 = foe.hp;
      // press (ultimates: hold R)
      let held = 0;
      const press = (t: number): InputState => {
        const inp = noInput(0);
        if (ult) {
          inp.ultHeld = t < 1.0;
          if (t < DT * 1.5) inp.skills[5] = true;
        } else if (t < DT * 1.5 || (sit === 'twice' && Math.abs(t - 0.6) < DT)) inp.skills[0] = true;
        if (sit === 'twice' && ult && Math.abs(t - 1.3) < DT) inp.skills[5] = true;
        held++;
        return inp;
      };
      let castSeen = false;
      for (let t = 0; t < 7; t += DT) {
        const inp = press(t);
        if (sit === 'hit-mid' && Math.abs(t - (ult ? 0.5 : 0.25)) < DT / 2) s.hit(foe, p, 30, { knock: 5 });
        if (sit === 'die-mid' && Math.abs(t - 0.3) < DT / 2) s.hit(foe, p, 1e6, {});
        step(s, w, inp, null);
        if ((p.cds[id] ?? 0) > 0) castSeen = true;
        foe.aiT = 99;
      }
      const tag = `${label} ${id} @${sit}`;
      const blocked = ['rooted', 'stunned', 'kneel', 'daze', 'die-mid'].includes(sit) || (sit === 'air' && SKILLS[id].ground) || (sit === 'hit-mid' && ult) || (sit === 'no-foe' && ['drain_surplus', 'short_sell', 'thousand_shadows'].includes(id));
      if (!castSeen && !blocked && sit !== 'air') report('move did not go off', tag, `act ${p.act} hp ${p.hp.toFixed(0)} mp ${p.mp.toFixed(0)} bar ${s.progress.bar}`);
      if (castSeen && ['stunned', 'kneel', 'daze'].includes(sit) && !(id === 'patagonia' || id === 'burrow')) report('cast while disabled', tag, '');
      if (castSeen && sit === 'hit-mid' && ult) report('ultimate survived a hit while charging', tag, '');
      // after 7 s everything should be over
      if (p.hp > 0 && p.run && !SKILLS[p.run.id]?.parallel) report('still in the move after 7 s', tag, `${p.run.id} act ${p.act}`);
      if (p.hp > 0 && !['idle', 'run', 'jump'].includes(p.act)) report('not back to idle after 7 s', tag, `act ${p.act} anim ${p.anim} grounded ${p.grounded}`);
      if (p.hp > 0 && !p.grounded) report('still in the air after 7 s', tag, `y-ground ${(p.pos[1] - groundHeight(p.pos[0], p.pos[2])).toFixed(1)} act ${p.act} vel ${p.vel.map((v) => v.toFixed(1))}`);
      // can he walk afterwards?
      if (p.hp > 0) {
        const x0 = p.pos[0], z0 = p.pos[2];
        resetPlayer(s);
        run(s, w, 1, () => ({ ...noInput(Math.PI / 2), move: [0, 1] }));
        const moved = Math.hypot(p.pos[0] - x0, p.pos[2] - z0);
        if (moved < 2 && sit !== 'edge' && sit !== 'tree' && sit !== 'slope') report('cannot walk after the move', tag, `moved ${moved.toFixed(1)} act ${p.act} run ${p.run?.id}`);
      }
      // does it hurt (only moves meant to)
      void hp0;
    }
  return w.maxStep;
}

// ---------------------------------------------------------------- 4. real fights in every den with a simple bot
function fights(hero: HeroId | null) {
  const s = newSim(hero, 12);
  const label = hero ?? '散人';
  const w = new Watch(s, `fight ${label}`);
  const ids = hero ? HEROES.find((h) => h.id === hero)!.tree : LOW_SKILLS;
  s.progress.bar = [...ids.filter((id) => capOf(s.progress, id).cap && !SKILLS[id].ult).slice(0, 5), ...['', '', '', '', '']].slice(0, 5).concat([ids.find((id) => SKILLS[id].ult && capOf(s.progress, id).cap) ?? '']);
  const result: string[] = [];
  DENS.forEach((d, i) => {
    resetPlayer(s);
    calm(s);
    const p = s.player;
    place(p, d.x + DEN_R + 6, d.z);
    p.level = Math.min(30, d.level + 3);
    p.maxHp = p.hp = 500 + p.level * 45;
    const foes = s.fighters.filter((f) => (f as any).den === i);
    let t = 0;
    let deaths = 0;
    let lastAggro = 0;
    while (t < 60) {
      const alive = foes.filter((f) => f.hp > 0);
      if (!alive.length) break;
      if (p.hp <= 0) {
        deaths++;
        // skip the respawn wait and come back
        run(s, w, 4.2);
        place(p, d.x + DEN_R + 6, d.z);
        t += 4.2;
        if (deaths > 3) break;
        continue;
      }
      const tgt = alive.sort((a, b) => s.dist(p, a) - s.dist(p, b))[0];
      const dd = s.dist(p, tgt);
      const inp = noInput(yawTo(p, tgt.pos[0], tgt.pos[2]));
      if (dd > 2) inp.move = [0, 1];
      if (dd < 3 && rnd() < 0.2) inp.attack = true;
      if (rnd() < 0.03) inp.skills[Math.floor(rnd() * 5)] = true;
      if (rnd() < 0.01) inp.dodge = true;
      if (s.progress.bar[5] && rnd() < 0.005) inp.skills[5] = true;
      inp.ultHeld = s.ultCharge !== null;
      step(s, w, inp, inp.move);
      if (foes.some((f) => f.aggro)) lastAggro = t;
      t += DT;
    }
    const left = foes.filter((f) => f.hp > 0).length;
    result.push(`den ${i} Lv${d.level}${d.boss ? ' 头目' : ''}: ${left ? `${left}/${foes.length} left` : 'cleared'} in ${t.toFixed(0)} s, died ${deaths}`);
    if (left && t >= 60) report('den not cleared in 60 s', `${label} den ${i}`, `${left} left, player Lv ${p.level}, last aggro ${lastAggro.toFixed(0)} s`);
    if (deaths > 2) report('dies a lot', `${label} den ${i}`, `${deaths} deaths at Lv ${p.level} vs den Lv ${d.level}`);
    // the foes should go home and calm down once he leaves
    place(p, 0, 0);
    run(s, w, 20);
    for (const f of foes) if (f.hp > 0 && f.act !== 'dead' && f.home && Math.hypot(f.pos[0] - f.home[0], f.pos[2] - f.home[1]) > 4) report('foe did not go home', `${label} den ${i} #${f.id}`, `${Math.hypot(f.pos[0] - f.home[0], f.pos[2] - f.home[1]).toFixed(0)} m away, act ${f.act}`);
  });
  return { maxStep: w.maxStep, result };
}

// ---------------------------------------------------------------- 5. progression rules
function rules() {
  const p = fresh();
  if (chooseHero(p, null)) report('rule', 'pick 散人', 'refused');
  p.level = 10;
  if (!capOf(p, 'heaven_collapse').why) report('rule', '散人 ultimate', 'a 散人 could learn an ultimate');
  if (capOf(p, 'earth_cleave').cap !== 5) report('rule', '散人 cap', `${capOf(p, 'earth_cleave').cap}`);
  if (!chooseHero(p, 'Berserker')) report('rule', '转职 at 10', 'allowed before 30');
  p.level = 30;
  learn(p, 'earth_cleave');
  learn(p, 'pin_dart');
  if (chooseHero(p, 'Berserker')) report('rule', '转职 at 30', 'refused');
  if (p.skills.pin_dart) report('rule', '转职 refund', 'kept another house\'s move');
  if (!p.skills.earth_cleave) report('rule', '转职 keep', 'lost its own move');
  if (!chooseHero(p, 'Ranger')) report('rule', 'second 转职', 'allowed');
  const h = fresh();
  chooseHero(h, 'Ranger');
  h.level = 9;
  if (capOf(h, 'snipe').cap) report('rule', 'hero 4th move', 'before level 10');
  h.level = 29;
  if (capOf(h, 'rain_of_darts').cap) report('rule', 'hero ultimate', 'before level 30');
  h.level = 30;
  if (capOf(h, 'rain_of_darts').cap !== 10) report('rule', 'hero ultimate', 'not learnable at 30');
  // a fresh character with 3 points can learn a first move and it goes on the bar
  const n = fresh();
  chooseHero(n, null);
  if (learn(n, 'boomerang') || !n.bar.includes('boomerang')) report('rule', 'first move', `bar ${n.bar}`);
}

// ---------------------------------------------------------------- 6. a long idle soak: the world runs on its own
function soak() {
  const s = newSim(null, 1);
  const w = new Watch(s, 'soak');
  // drop the player into a den and let him get beaten, respawn, and so on, for 3 minutes
  place(s.player, DENS[0].x, DENS[0].z);
  run(s, w, 180, () => noInput());
  return w.maxStep;
}

// ---------------------------------------------------------------- run it all
const t0 = Date.now();
worldChecks();
rules();
const perf: Record<string, number> = {};
const fightLog: string[] = [];
const ONLY = process.env.ONLY; // 'walk' = only the walks, for a quick check
const PICK = process.env.HERO; // one start choice only ('none' = 散人)
for (const hero of (PICK ? [PICK === 'none' ? null : PICK] : ONLY ? [null] : [null, ...HEROES.map((h) => h.id)]) as (HeroId | null)[]) {
  const label = hero ?? '散人';
  perf['walk ' + label] = walks(hero);
  if (ONLY === 'walk') continue;
  console.error('walk done', label);
  perf['moves ' + label] = moves(hero);
  console.error('moves done', label);
  const f = fights(hero);
  perf['fight ' + label] = f.maxStep;
  fightLog.push(`== ${label}`, ...f.result);
  console.error(`done ${label} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
if (!ONLY) perf.soak = soak();

const byKind = new Map<string, Issue[]>();
for (const i of issues) byKind.set(i.kind, [...(byKind.get(i.kind) ?? []), i]);
console.log(`\n巡检 ${((Date.now() - t0) / 1000).toFixed(0)} s, ${issues.length} findings in ${byKind.size} kinds\n`);
for (const [k, list] of byKind) {
  const total = [...seen.entries()].filter(([key]) => key.startsWith(k + '|')).reduce((a, [, n]) => a + n, 0);
  console.log(`## ${k} (${total} frames/cases)`);
  for (const i of list.slice(0, 12)) console.log(`  - ${i.where}: ${i.detail}`);
}
console.log('\nslowest sim step (ms):', Object.entries(perf).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', '));
console.log('\nfights:\n' + fightLog.join('\n'));

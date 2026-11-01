// The whole game world, stepped once per frame: the player, the bandits in their dens, projectiles, zones on
// the ground and the little effects the renderer draws. Pure logic: no React, no three.js.
import type { Fighter, Fx, InputState, Projectile, SectId, Status, Team, Zone } from './types';
import { DENS, DEN_R, FOE_KINDS } from './foes';
import { MAX_SLOPE, VILLAGE_R, VILLAGE_SPAWN, WATER_Y, clampWorld, groundHeight, pushOutOfBuildings, pushOutOfTrees } from './world';

/** what a body stands on: the ground, or the lake's surface (wading / swimming) */
const floorAt = (x: number, z: number) => Math.max(groundHeight(x, z), WATER_Y - 1.1);
import { Progress, gainXp, load, playerMaxHp, playerPower, save, skillPower, xpFor } from './progress';
import { WANDERER, heroOf } from './heroes';
import { SKILLS } from './skills';

/** an ultimate goes off only after R is held this long (the owner's rule); letting go or a hit throws it away */
export const ULT_CHARGE = 0.8;

export const PLAYER = 0;
const GRAVITY = 24;
const RUN = 6.8;
const NPC_RUN = 5.0;
/** basic attack chain: duration, strike moment, damage */
const CHAIN = [
  { dur: 0.42, at: 0.17, dmg: 30 },
  { dur: 0.42, at: 0.17, dmg: 34 },
  { dur: 0.62, at: 0.3, dmg: 52 },
];
const MELEE_RANGE = 2.5;

export interface HitOpts {
  knock?: number; // push away (m/s)
  launch?: number; // up into the air and down
  stun?: number;
  root?: number;
  kneel?: number;
  slow?: number;
  daze?: number;
  mult?: number; // the move's level (defaults to the caster's current castMult; basic attacks pass 1)
  stagger?: boolean; // default true
  color?: string;
  fromX?: number; // push away from this point instead of the attacker
  fromZ?: number;
  noScale?: boolean; // a fixed amount (drain)
}

const noStatus = (): Status => ({ slow: 0, root: 0, stun: 0, kneel: 0, daze: 0, crit: 0, invuln: 0, armor: 0, buffAtk: 0, rage: 0, shield: 0, weak: 0 });

export class Sim {
  fighters: Fighter[] = [];
  proj: Projectile[] = [];
  zones: Zone[] = [];
  fx: Fx[] = [];
  time = 0;
  progress: Progress;
  toasts: { text: string; t: number; id: number }[] = [];
  lastTarget = -1;
  /** the player holding R for an ultimate: seconds held (null = not charging) */
  ultCharge: number | null = null;
  private toastId = 0;
  private nextId = 0;

  constructor(progress?: Progress) {
    this.progress = progress ?? load();
    const h = heroOf(this.progress.hero);
    const p = this.make('player', null, h ? h.name : WANDERER.name, h ? h.model : WANDERER.model, this.progress.level, VILLAGE_SPAWN[0], VILLAGE_SPAWN[1]);
    p.maxHp = p.hp = playerMaxHp(p.level);
    DENS.forEach((d, di) => {
      const kind = FOE_KINDS[d.kind];
      const n = d.count + (d.boss ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const boss = d.boss && k === n - 1;
        const a = (k / n) * Math.PI * 2;
        const r = boss ? 0 : 6;
        const f = this.make('sect', kind.house, boss ? `${kind.name}头目` : kind.name, kind.model, d.level + (boss ? 3 : k % 3), d.x + Math.cos(a) * r, d.z + Math.sin(a) * r);
        f.home = [f.pos[0], f.pos[2]];
        (f as any).den = di;
        if (boss) {
          (f as any).boss = true;
          f.maxHp = f.hp = Math.round(f.maxHp * 3);
        }
      }
    });
  }

  /** which move set a foe fights with */
  kindOf(f: Fighter) {
    const d = DENS[(f as any).den];
    return d ? FOE_KINDS[d.kind] : null;
  }

  private make(team: Team, sect: SectId | null, name: string, model: string, level: number, x: number, z: number): Fighter {
    const f: Fighter = {
      id: this.nextId++,
      name,
      team,
      sect,
      model,
      level,
      pos: [x, groundHeight(x, z), z],
      vel: [0, 0, 0],
      yaw: 0,
      grounded: true,
      hp: 0,
      maxHp: team === 'player' ? playerMaxHp(level) : 180 + level * 55,
      mp: 100,
      maxMp: 100,
      act: 'idle',
      actT: 0,
      actDur: 0,
      anim: 'idle',
      combo: 0,
      hitDone: false,
      cds: {},
      st: noStatus(),
      run: null,
      aiT: Math.random() * 2,
    };
    f.hp = f.maxHp;
    this.fighters.push(f);
    return f;
  }

  get player() {
    return this.fighters[PLAYER];
  }

  // ------------------------------------------------------------------ helpers the skills use
  fwd(f: Fighter): [number, number] {
    return [-Math.sin(f.yaw), -Math.cos(f.yaw)];
  }
  isEnemy(a: Fighter, b: Fighter) {
    if (a === b || b.hp <= 0 || b.team === 'npc' || a.team === 'npc') return false;
    return a.team !== b.team;
  }
  enemiesOf(f: Fighter) {
    return this.fighters.filter((o) => this.isEnemy(f, o));
  }
  dist(a: Fighter, b: Fighter) {
    return Math.hypot(a.pos[0] - b.pos[0], a.pos[2] - b.pos[2]);
  }
  /** nearest enemy within range, optionally only in front (cos of the half-angle) */
  nearestEnemy(f: Fighter, range: number, cone = -2): Fighter | null {
    const [fx, fz] = this.fwd(f);
    let best: Fighter | null = null;
    let bd = range;
    for (const o of this.enemiesOf(f)) {
      if (Math.abs(o.pos[1] - f.pos[1]) > 6) continue;
      const dx = o.pos[0] - f.pos[0];
      const dz = o.pos[2] - f.pos[2];
      const d = Math.hypot(dx, dz);
      if (d > bd) continue;
      if (cone > -2 && d > 0.5 && (dx * fx + dz * fz) / d < cone) continue;
      best = o;
      bd = d;
    }
    return best;
  }
  /** enemies in a cone in front (range, cos half-angle) */
  inCone(f: Fighter, range: number, cone: number) {
    const [fx, fz] = this.fwd(f);
    return this.enemiesOf(f).filter((o) => {
      const dx = o.pos[0] - f.pos[0];
      const dz = o.pos[2] - f.pos[2];
      const d = Math.hypot(dx, dz);
      return d <= range && Math.abs(o.pos[1] - f.pos[1]) < 3 && (d < 0.6 || (dx * fx + dz * fz) / d >= cone);
    });
  }
  inRadius(f: Fighter, x: number, z: number, r: number) {
    return this.enemiesOf(f).filter((o) => Math.hypot(o.pos[0] - x, o.pos[2] - z) <= r + 0.4);
  }
  faceTo(f: Fighter, x: number, z: number) {
    f.yaw = Math.atan2(-(x - f.pos[0]), -(z - f.pos[2]));
  }
  power(f: Fighter) {
    return f.team === 'player' ? playerPower(f.level) : 0.25 + f.level * 0.04; // bandits hit softer than you: a few at once is the danger
  }
  setAct(f: Fighter, act: Fighter['act'], dur: number, anim?: string) {
    f.act = act;
    f.actT = 0;
    f.actDur = dur;
    f.anim = anim ?? act;
    f.hitDone = false;
  }
  addFx(fx: Omit<Fx, 't'> & { t?: number }) {
    this.fx.push({ t: fx.max, ...fx } as Fx);
  }
  text(f: Fighter, text: string, color = '#ffffff') {
    this.addFx({ kind: 'text', x: f.pos[0], y: f.pos[1] + 2.3, z: f.pos[2], max: 0.9, r: 1, color, text });
  }
  toast(text: string) {
    this.toasts.push({ text, t: 3.5, id: this.toastId++ });
    if (this.toasts.length > 4) this.toasts.shift();
  }
  shoot(f: Fighter, p: Partial<Projectile> & { speed: number; yaw?: number; life: number; dmg: number }) {
    const yaw = p.yaw ?? f.yaw;
    const vx = -Math.sin(yaw) * p.speed;
    const vz = -Math.cos(yaw) * p.speed;
    const pr: Projectile = {
      owner: f.id,
      skill: p.skill ?? '',
      pos: p.pos ?? [f.pos[0] - Math.sin(yaw) * 0.6, f.pos[1] + 1.2, f.pos[2] - Math.cos(yaw) * 0.6],
      vel: [vx, 0, vz],
      life: p.life,
      radius: p.radius ?? 0.5,
      dmg: p.dmg,
      color: p.color ?? '#ffffff',
      shape: p.shape ?? 'dart',
      hit: [],
      pierce: p.pierce ?? false,
      homing: p.homing,
      target: p.target,
      returnAt: p.returnAt,
      onHit: p.onHit,
      mult: f.castMult ?? 1,
    };
    this.proj.push(pr);
    return pr;
  }
  zone(f: Fighter, skill: string, x: number, z: number, r: number, t: number, color: string) {
    const zn: Zone = { owner: f.id, skill, x, y: groundHeight(x, z), z, r, t, max: t, color, touched: [] };
    this.zones.push(zn);
    return zn;
  }
  heal(f: Fighter, n: number) {
    if (f.hp <= 0) return;
    const h = Math.min(f.maxHp - f.hp, n);
    if (h <= 0) return;
    f.hp += h;
    this.text(f, `+${Math.round(h)}`, '#4ade80');
  }

  /** a blow lands. Returns the damage done (0 when it couldn't land) */
  hit(att: Fighter, def: Fighter, base: number, o: HitOpts = {}): number {
    if (def.hp <= 0 || def.st.invuln > 0 || !this.isEnemy(att, def)) return 0;
    let dmg = o.noScale ? base : base * this.power(att) * (o.mult ?? att.castMult ?? 1);
    let crit = false;
    if (!o.noScale && att.st.crit > 0) {
      dmg *= 2;
      crit = true;
      att.st.crit = 0;
    }
    if (att.st.buffAtk > 0) dmg *= 1.1;
    if (def.st.buffAtk > 0) dmg *= 0.9;
    if (att.st.rage > 0) dmg *= 1.3;
    if (att.st.weak > 0) dmg *= 0.8;
    if (def.st.weak > 0) dmg *= 1.2;
    if (def.st.shield > 0) dmg *= 0.35;
    dmg = Math.max(1, Math.round(dmg));
    def.hp = Math.max(0, def.hp - dmg);
    if (att.st.rage > 0 && att.hp > 0) att.hp = Math.min(att.maxHp, att.hp + dmg * 0.12);
    if (att.id === PLAYER) this.lastTarget = def.id;
    this.text(def, crit ? `暴击 ${dmg}` : `${dmg}`, crit ? '#ffcf3a' : def.id === PLAYER ? '#ff6b6b' : o.color ?? '#ffffff');
    if (def.team === 'sect') def.aggro = true;
    // statuses
    if (o.root) def.st.root = Math.max(def.st.root, o.root);
    if (o.kneel) def.st.kneel = Math.max(def.st.kneel, o.kneel);
    if (o.slow) def.st.slow = Math.max(def.st.slow, o.slow);
    if (o.daze) def.st.daze = Math.max(def.st.daze, o.daze);
    if (o.stun) def.st.stun = Math.max(def.st.stun, o.stun);
    const ax = o.fromX ?? att.pos[0];
    const az = o.fromZ ?? att.pos[2];
    const dx = def.pos[0] - ax;
    const dz = def.pos[2] - az;
    const d = Math.hypot(dx, dz) || 1;
    if (def.hp <= 0) {
      this.kill(att, def, dx / d, dz / d);
      return dmg;
    }
    const armored = def.st.armor > 0 || def.st.shield > 0 || def.act === 'burrow' || def.act === 'glide';
    if (!armored) {
      if (o.launch) {
        def.vel[1] = o.launch;
        def.vel[0] = (dx / d) * (o.knock ?? 3);
        def.vel[2] = (dz / d) * (o.knock ?? 3);
        def.grounded = false;
        def.run = null;
        this.setAct(def, 'down', 1.2, 'down');
      } else if (o.knock) {
        def.vel[0] = (dx / d) * o.knock;
        def.vel[2] = (dz / d) * o.knock;
        def.run = null;
        this.setAct(def, 'hit', 0.45, 'hit');
      } else if (o.stagger !== false) {
        def.run = null;
        this.setAct(def, 'hit', 0.3, 'hit');
      }
    }
    return dmg;
  }

  private kill(att: Fighter, def: Fighter, nx: number, nz: number) {
    def.run = null;
    def.vel = [nx * 6, 7, nz * 6];
    def.grounded = false;
    this.setAct(def, 'dead', 0, 'dead');
    if (def.id === PLAYER) {
      def.respawn = 4;
      this.toast(`你被${att.name}打倒了 · 4 秒后回到村子`);
      return;
    }
    def.respawn = (def as any).boss ? 60 : 25;
    def.aggro = false;
    if (att.id === PLAYER) {
      const P = this.progress;
      // a foe far below you is worth little
      const gap = Math.max(0, P.level - def.level - 3);
      const xp = Math.max(3, Math.round((18 + def.level * 10) * ((def as any).boss ? 5 : 1) * Math.pow(0.75, gap)));
      this.text(att, `经验 +${xp}`, '#a5f3fc');
      const ups = gainXp(P, xp);
      if (ups > 0) {
        const p = this.player;
        p.level = P.level;
        p.maxHp = playerMaxHp(P.level);
        p.hp = p.maxHp;
        this.toast(`升级！${P.level} 级 · 技能点 +${ups * 2}，按 K 加点`);
        if (P.level === 30) this.toast(P.hero ? '30 级：大招解锁了，按 K 学' : '30 级：可以转职了，按 K 打开技能树');
        if (P.level === 10 && P.hero) this.toast('10 级：第四招解锁了');
        this.addFx({ kind: 'ring', x: p.pos[0], y: p.pos[1] + 0.1, z: p.pos[2], max: 0.8, r: 4, color: '#ffe08a' });
      }
      save(P);
    }
  }

  /** put a learned move on a slot (or clear the slot with '') */
  setSlot(slot: number, id: string) {
    const P = this.progress;
    if (id && !(P.skills[id] > 0)) return;
    const was = id ? P.bar.indexOf(id) : -1;
    if (was >= 0) P.bar[was] = P.bar[slot];
    P.bar[slot] = id;
    save(P);
  }

  /** the player picked a hero (or 转职'd): new body, new name */
  refreshPlayer() {
    const h = heroOf(this.progress.hero);
    const p = this.player;
    p.name = h ? h.name : WANDERER.name;
    p.model = h ? h.model : WANDERER.model;
  }

  // ------------------------------------------------------------------ actions
  free(f: Fighter) {
    if (f.hp <= 0 || f.st.stun > 0 || f.st.daze > 0) return false;
    if (f.act === 'idle' || f.act === 'run' || f.act === 'jump') return true;
    // the end of a swing can be cut into
    return f.act === 'attack' && f.hitDone && f.actT > f.actDur * 0.6;
  }

  attack(f: Fighter, ranged = false) {
    if (!this.free(f) || f.st.kneel > 0) return false;
    if (f.act === 'attack') f.combo = (f.combo + 1) % 3;
    else f.combo = 0;
    const slow = f.team === 'sect' ? 1.5 : 1; // disciples wind up slower: time to see it coming
    this.setAct(f, 'attack', CHAIN[f.combo].dur * slow, ranged ? 'throw' : `attack_${f.combo + 1}`);
    if (!(f.run && SKILLS[f.run.id]?.parallel)) f.run = ranged ? { id: '_throw', t: 0, data: {} } : null;
    if (f.id === PLAYER && !ranged) {
      // a swing steps in to the foe in front (within 4.5 m): no more swinging at air a step short
      const t = this.nearestEnemy(f, 4.5, Math.cos(0.9));
      if (t) {
        const d = this.dist(f, t);
        this.faceTo(f, t.pos[0], t.pos[2]);
        const [fx, fz] = this.fwd(f);
        const go = Math.max(0, d - 1.4) / 0.12;
        f.vel[0] = fx * Math.min(go, 22);
        f.vel[2] = fz * Math.min(go, 22);
        (f as any).lunge = 0.12;
      }
    }
    return true;
  }

  dodge(f: Fighter, dx: number, dz: number) {
    if (f.hp <= 0 || f.st.stun > 0 || f.st.root > 0 || (f.cds.dodge ?? 0) > 0) return false;
    if (!(this.free(f) || f.act === 'attack' || f.act === 'hit')) return false;
    const l = Math.hypot(dx, dz);
    if (l < 0.1) {
      const [fx, fz] = this.fwd(f);
      dx = -fx;
      dz = -fz;
    } else {
      dx /= l;
      dz /= l;
      f.yaw = Math.atan2(-dx, -dz);
    }
    f.run = null;
    if (f.id === PLAYER) this.ultCharge = null;
    this.setAct(f, 'dodge', 0.42, 'dodge');
    f.vel[0] = dx * 12;
    f.vel[2] = dz * 12;
    f.st.invuln = Math.max(f.st.invuln, 0.32);
    f.cds.dodge = 0.75;
    return true;
  }

  jump(f: Fighter) {
    if (!f.grounded || !this.free(f) || f.st.root > 0) return false;
    f.vel[1] = 8.5;
    f.grounded = false;
    this.setAct(f, 'jump', 0, 'jump');
    return true;
  }

  cast(f: Fighter, id: string): boolean {
    const sk = SKILLS[id];
    if (!sk) return false;
    // a running skill may take a second press (burrow out, fold the vest)
    if (f.run && f.run.id === id && sk.again) return sk.again(this, f);
    if (!this.free(f) || f.st.kneel > 0) return false;
    if ((f.cds[id] ?? 0) > 0) {
      if (f.id === PLAYER) this.text(f, `冷却 ${(f.cds[id] ?? 0).toFixed(1)}s`, '#9ca3af');
      return false;
    }
    if (f.mp < sk.mp) {
      if (f.id === PLAYER) this.text(f, '内力不足', '#60a5fa');
      return false;
    }
    if (sk.ground && !f.grounded) return false;
    // the player's moves hit by their level; foes by a flat share
    f.castMult = f.id === PLAYER ? skillPower(this.progress.skills[id] ?? 1) : 1;
    if (!sk.cast(this, f)) return false;
    f.mp -= sk.mp;
    f.cds[id] = sk.cd;
    return true;
  }

  // ------------------------------------------------------------------ the frame
  step(dt: number, input: InputState | null) {
    dt = Math.min(dt, 0.05);
    this.time += dt;
    (this as any).lastDt = dt;
    for (const f of this.fighters) this.timers(f, dt);
    if (input) this.control(this.player, input);
    for (const f of this.fighters) if (f.team !== 'player') this.think(f, dt);
    for (const f of this.fighters) this.physics(f, dt);
    // bodies don't stand inside each other
    const F = this.fighters;
    for (let i = 0; i < F.length; i++) {
      const a = F[i];
      if (a.hp <= 0 || a.act === 'burrow') continue;
      for (let j = i + 1; j < F.length; j++) {
        const b = F[j];
        if (b.hp <= 0 || b.act === 'burrow') continue;
        const dx = b.pos[0] - a.pos[0];
        if (dx > 0.9 || dx < -0.9) continue;
        const dz = b.pos[2] - a.pos[2];
        if (dz > 0.9 || dz < -0.9 || Math.abs(b.pos[1] - a.pos[1]) > 1.5) continue;
        const d = Math.hypot(dx, dz);
        if (d >= 0.9 || d < 1e-4) continue;
        const push = (0.9 - d) / 2;
        a.pos[0] -= (dx / d) * push;
        a.pos[2] -= (dz / d) * push;
        b.pos[0] += (dx / d) * push;
        b.pos[2] += (dz / d) * push;
      }
    }
    for (const f of this.fighters) this.acts(f, dt);
    this.projectiles(dt);
    this.zoneStep(dt);
    for (const x of this.fx) x.t -= dt;
    this.fx = this.fx.filter((x) => x.t > 0);
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
  }

  private timers(f: Fighter, dt: number) {
    const s = f.st;
    for (const k of Object.keys(s) as (keyof Status)[]) if (s[k] > 0) s[k] = Math.max(0, s[k] - dt);
    for (const k of Object.keys(f.cds)) f.cds[k] = Math.max(0, f.cds[k] - dt);
    if (f.hp > 0) f.mp = Math.min(f.maxMp, f.mp + dt * (f.team === 'player' ? 7 : 5));
    if (f.hp > 0 && f.team === 'player' && !this.enemiesOf(f).some((o) => o.aggro && this.dist(o, f) < 25)) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.02 * dt); // out of a fight: heal up
    if (f.hp > 0 && f.act === 'dead') this.setAct(f, 'idle', 0, 'idle'); // never alive and lying dead
    if (f.respawn !== undefined && f.hp <= 0) {
      f.respawn -= dt;
      if (f.respawn <= 0) this.revive(f);
    }
  }

  private revive(f: Fighter) {
    f.respawn = undefined;
    f.hp = f.maxHp;
    f.mp = f.maxMp;
    f.st = noStatus();
    f.run = null;
    f.cds = {};
    const [x, z] = f.home ?? VILLAGE_SPAWN;
    f.pos = [x, groundHeight(x, z), z];
    f.vel = [0, 0, 0];
    this.setAct(f, 'idle', 0, 'idle');
    if (f.id === PLAYER) f.st.invuln = 2;
  }

  /** the player's keys */
  private control(f: Fighter, inp: InputState) {
    if (f.hp <= 0) return;
    const cy = inp.camYaw;
    const fx = -Math.sin(cy);
    const fz = -Math.cos(cy);
    const rx = Math.cos(cy);
    const rz = -Math.sin(cy);
    let mx = rx * inp.move[0] + fx * inp.move[1];
    let mz = rz * inp.move[0] + fz * inp.move[1];
    const ml = Math.hypot(mx, mz);
    if (ml > 1) {
      mx /= ml;
      mz /= ml;
    }
    (f as any).wish = this.ultCharge !== null ? [0, 0] : [mx, mz];
    if (inp.dodge) this.dodge(f, mx, mz);
    if (inp.jump) this.jump(f);
    const aim = () => {
      // face where the camera looks, or the enemy nearest that line
      f.yaw = cy;
      const t = this.nearestEnemy(f, 12, Math.cos(0.6));
      if (t) this.faceTo(f, t.pos[0], t.pos[2]);
    };
    if (inp.attack && this.free(f) && this.ultCharge === null) {
      const y = f.yaw;
      aim();
      if (!this.attack(f, !!heroOf(this.progress.hero)?.ranged)) f.yaw = y;
    }
    // R holds an ultimate: rooted while it charges; letting go or being hit throws it away (nothing spent)
    const rId = this.progress.bar[5];
    const isUlt = !!rId && !!SKILLS[rId]?.ult;
    if (this.ultCharge !== null) {
      const hpWas = (this as any).ultHp ?? f.hp;
      if (!inp.ultHeld || f.hp < hpWas || f.act === 'hit' || f.act === 'down' || f.st.stun > 0) {
        this.ultCharge = null;
        this.text(f, '蓄力中断', '#9ca3af');
      } else {
        this.ultCharge += (this as any).lastDt ?? 0.016;
        f.vel[0] = f.vel[2] = 0;
        if (this.ultCharge >= ULT_CHARGE) {
          this.ultCharge = null;
          f.yaw = cy;
          const t = this.nearestEnemy(f, 14, Math.cos(0.6));
          if (t) this.faceTo(f, t.pos[0], t.pos[2]);
          this.cast(f, rId);
        }
      }
    }
    inp.skills.forEach((on, i) => {
      if (!on) return;
      if (i === 5 && isUlt) {
        const sk = SKILLS[rId];
        if (this.ultCharge !== null || !this.free(f)) return;
        if ((f.cds[rId] ?? 0) > 0) return void this.text(f, `冷却 ${(f.cds[rId] ?? 0).toFixed(1)}s`, '#9ca3af');
        if (f.mp < sk.mp) return void this.text(f, '内力不足', '#60a5fa');
        this.ultCharge = 0;
        (this as any).ultHp = f.hp;
        this.text(f, '按住 R 蓄力', '#ffd36a');
        return;
      }
      const id = this.progress.bar[i];
      if (!id) {
        this.text(f, `${'12345R'[i]} 键没放技能`, '#9ca3af');
        return;
      }
      const y = f.yaw;
      if (this.free(f)) aim();
      if (!this.cast(f, id)) f.yaw = y;
    });
  }

  /** disciples and masters */
  private think(f: Fighter, dt: number) {
    if (f.hp <= 0) return;
    const p = this.player;
    const home = f.home!;
    const fromHome = Math.hypot(f.pos[0] - home[0], f.pos[2] - home[1]);
    const d = this.dist(f, p);
    const pFromHome = Math.hypot(p.pos[0] - home[0], p.pos[2] - home[1]);
    // they give up when you leave their ground, and never follow you into the village
    const pInVillage = Math.hypot(p.pos[0], p.pos[2]) < VILLAGE_R + 10;
    if (p.hp <= 0 || pInVillage || pFromHome > DEN_R + 28 || fromHome > 38) f.aggro = false;
    else if (d < 15 && pFromHome < DEN_R + 16) f.aggro = true;
    let wx = 0;
    let wz = 0;
    if (f.st.daze > 0) {
      const t = this.time * 1.3 + f.id;
      (f as any).wish = [Math.sin(t) * 0.5, Math.cos(t * 0.7) * 0.5];
      return;
    }
    if (!f.aggro) {
      if (fromHome > 1.5) {
        wx = (home[0] - f.pos[0]) / fromHome;
        wz = (home[1] - f.pos[2]) / fromHome;
      } else f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.2 * dt); // back home: patched up
      (f as any).wish = [wx, wz];
      return;
    }
    const s = this.kindOf(f)!;
    const dx = (p.pos[0] - f.pos[0]) / (d || 1);
    const dz = (p.pos[2] - f.pos[2]) / (d || 1);
    const keep = s.ranged ? 8 : 1.6;
    if (d > keep + (s.ranged ? 3 : 0.3)) {
      wx = dx;
      wz = dz;
    } else if (s.ranged && d < 4) {
      // up close a thrower stands and fights (backing off made them impossible to catch)
      wx = wz = 0;
    } else {
      // circle a little so they don't stack
      wx = -dz * 0.35 * Math.sin(f.id);
      wz = dx * 0.35 * Math.sin(f.id);
    }
    (f as any).wish = [wx, wz];
    f.aiT = (f.aiT ?? 0) - dt;
    if (!this.free(f) || (f.aiT ?? 0) > 0) return;
    this.faceTo(f, p.pos[0], p.pos[2]);
    // a move of their house now and then (the ones their level allows)
    const usable = s.skills.filter((id, k) => f.level >= 1 + k * 4 && (f.cds[id] ?? 0) <= 0 && f.mp >= SKILLS[id].mp && d <= SKILLS[id].aiRange);
    if (usable.length && Math.random() < 0.35) {
      const id = usable[Math.floor(Math.random() * usable.length)];
      if (this.cast(f, id)) {
        f.aiT = 1.6 + Math.random() * 1.2;
        return;
      }
    }
    if (s.ranged ? d < 16 : d < MELEE_RANGE + 0.4) {
      this.attack(f, s.ranged && d > 3);
      f.aiT = s.ranged ? 1.4 + Math.random() : 0.9 + Math.random() * 0.8;
    }
  }

  private physics(f: Fighter, dt: number) {
    const wish: [number, number] = (f as any).wish ?? [0, 0];
    const canWalk = f.hp > 0 && f.st.root <= 0 && f.st.stun <= 0 && f.st.kneel <= 0 && (f.act === 'idle' || f.act === 'run' || f.act === 'jump' || (f.act === 'attack' && f.team === 'player' && f.actT > f.actDur * 0.7));
    const sk = f.run && !SKILLS[f.run.id]?.parallel ? SKILLS[f.run.id] : null;
    if ((f as any).lunge > 0) (f as any).lunge -= dt;
    // a bandit walking into a tree trunk (or another bandit) steps round it instead of pushing on for ever
    if (f.team === 'sect' && Math.hypot(wish[0], wish[1]) > 0.3 && f.grounded && (f.act === 'run' || f.act === 'idle')) {
      const sp = Math.hypot(f.vel[0], f.vel[2]);
      (f as any).blockT = sp < 1 ? ((f as any).blockT ?? 0) + dt : 0;
      if ((f as any).blockT > 0.4) (f as any).sideT = 0.8;
    }
    if ((f as any).sideT > 0) {
      (f as any).sideT -= dt;
      const sgn = f.id % 2 ? 1 : -1;
      wish[0] = wish[0] * 0.3 - wish[1] * sgn;
      wish[1] = wish[1] * 0.3 + wish[0] * sgn;
    }
    if (sk?.move) sk.move(this, f, wish, dt);
    else if (canWalk) {
      let spd = (f.team === 'player' ? RUN : NPC_RUN) * (f.st.slow > 0 ? 0.5 : 1) * (f.st.daze > 0 ? 0.5 : 1) * (f.st.rage > 0 ? 1.2 : 1) * (f.st.weak > 0 ? 0.8 : 1) * (groundHeight(f.pos[0], f.pos[2]) < WATER_Y - 0.5 ? 0.55 : 1);
      if (!f.aggro && f.team === 'sect' && Math.hypot(f.pos[0] - (f.home?.[0] ?? 0), f.pos[2] - (f.home?.[1] ?? 0)) < 6) spd *= 0.6; // strolling about at home
      const k = f.grounded ? 14 : 4;
      const tx = wish[0] * spd;
      const tz = wish[1] * spd;
      f.vel[0] += (tx - f.vel[0]) * Math.min(1, k * dt);
      f.vel[2] += (tz - f.vel[2]) * Math.min(1, k * dt);
      const moving = Math.hypot(wish[0], wish[1]) > 0.1;
      if (moving && f.act !== 'attack') f.yaw = turn(f.yaw, Math.atan2(-wish[0], -wish[1]), dt * 12);
      if (f.grounded && f.act !== 'attack') {
        if (moving && f.act === 'idle') this.setAct(f, 'run', 0, 'run');
        else if (!moving && f.act === 'run') this.setAct(f, 'idle', 0, 'idle');
      }
    } else if (f.grounded && !((f as any).lunge > 0) && f.act !== 'dodge' && f.act !== 'dead' && f.act !== 'down' && !(f.act === 'hit' && f.actT < 0.15)) {
      f.vel[0] *= Math.max(0, 1 - 10 * dt);
      f.vel[2] *= Math.max(0, 1 - 10 * dt);
    }
    if (f.act === 'dodge' || f.act === 'dead' || f.act === 'down' || f.act === 'hit') {
      const k = f.grounded ? 5 : 0.5;
      f.vel[0] *= Math.max(0, 1 - k * dt);
      f.vel[2] *= Math.max(0, 1 - k * dt);
    }
    // gravity
    const floating = sk?.float;
    if (!floating) f.vel[1] -= GRAVITY * dt;
    const ox = f.pos[0], oz = f.pos[2];
    const og = floorAt(ox, oz);
    f.pos[0] += f.vel[0] * dt;
    f.pos[1] += f.vel[1] * dt;
    f.pos[2] += f.vel[2] * dt;
    if (f.team === 'player' || f.act !== 'dead') {
      pushOutOfTrees(f.pos);
      pushOutOfBuildings(f.pos);
    }
    clampWorld(f.pos);
    // too steep to walk up: slide along the slope if one way is easier, otherwise stop (mountains are walls)
    if (f.grounded && groundHeight(ox, oz) > WATER_Y - 0.5) {
      // (out of the water you can always climb the bank)
      const steep = (x: number, z: number) => {
        const step = Math.hypot(x - ox, z - oz);
        const rise = floorAt(x, z) - og;
        return step > 1e-4 && rise > 0.05 && rise / step > MAX_SLOPE;
      };
      if (steep(f.pos[0], f.pos[2])) {
        if (!steep(f.pos[0], oz)) {
          f.pos[2] = oz;
          f.vel[2] = 0;
        } else if (!steep(ox, f.pos[2])) {
          f.pos[0] = ox;
          f.vel[0] = 0;
        } else {
          f.pos[0] = ox;
          f.pos[2] = oz;
          f.vel[0] = f.vel[2] = 0;
        }
      }
    }
    const g = floorAt(f.pos[0], f.pos[2]);
    if (f.pos[1] <= g) {
      f.pos[1] = g;
      if (f.vel[1] < 0) f.vel[1] = 0;
      if (!f.grounded) {
        f.grounded = true;
        if (f.act === 'jump') this.setAct(f, 'idle', 0, 'idle');
        if (f.run && SKILLS[f.run.id]?.land) SKILLS[f.run.id].land!(this, f);
      }
    } else if (f.pos[1] > g + 0.25) f.grounded = false;
    else if (f.vel[1] <= 0) f.pos[1] = g; // stick to slopes walking downhill
    if (!Number.isFinite(f.pos[0] + f.pos[1] + f.pos[2])) {
      const [x, z] = f.home ?? VILLAGE_SPAWN;
      f.pos = [x, groundHeight(x, z), z];
      f.vel = [0, 0, 0];
    }
  }

  private acts(f: Fighter, dt: number) {
    f.actT += dt;
    if (f.act === 'attack') {
      const c = CHAIN[f.combo];
      const slow = f.team === 'sect' ? 1.5 : 1;
      if (!f.hitDone && f.actT >= c.at * slow) {
        f.hitDone = true;
        if (f.run?.id === '_throw') {
          f.run = null;
          const t = f.id === PLAYER ? null : this.player;
          if (t && t.hp > 0) this.faceTo(f, t.pos[0], t.pos[2]);
          const pr = this.shoot(f, { speed: 22, life: 0.9, dmg: c.dmg * 0.8, color: this.kindOf(f)?.color ?? heroOf(this.progress.hero)?.color ?? '#fff', shape: 'dart', radius: 0.45 });
          pr.mult = 1;
        } else {
          const [fx, fz] = this.fwd(f);
          if (f.team === 'player') {
            f.vel[0] += fx * 3;
            f.vel[2] += fz * 3;
          }
          for (const o of this.inCone(f, MELEE_RANGE, 0.25)) this.hit(f, o, c.dmg, f.combo === 2 ? { knock: 6, mult: 1 } : { mult: 1 });
          this.addFx({ kind: 'slash', x: f.pos[0] + fx * 1.2, y: f.pos[1] + 1.1, z: f.pos[2] + fz * 1.2, max: 0.18, r: 1.4, color: f.team === 'player' ? '#e8f4ff' : this.kindOf(f)?.color ?? '#fff', yaw: f.yaw });
        }
      }
    }
    if (f.run) {
      const sk = SKILLS[f.run.id];
      f.run.t += dt;
      if (sk?.tick && f.hp > 0) sk.tick(this, f, dt);
    }
    if (f.actDur > 0 && f.actT >= f.actDur && f.act !== 'dead') {
      if (f.run && f.run.id !== '_throw' && SKILLS[f.run.id]?.tick && !SKILLS[f.run.id].parallel && f.act !== 'hit' && f.act !== 'down') return; // the skill ends itself
      f.run = f.run && (f.act === 'hit' || f.act === 'down') ? null : f.run;
      if (f.run?.id === '_throw') f.run = null;
      this.setAct(f, f.grounded ? 'idle' : 'jump', 0, f.grounded ? 'idle' : 'jump');
    }
  }

  private projectiles(dt: number) {
    for (const pr of this.proj) {
      pr.life -= dt;
      const owner = this.fighters[pr.owner];
      if (pr.homing && pr.target !== undefined) {
        const t = this.fighters[pr.target];
        if (t && t.hp > 0) {
          const sp = Math.hypot(pr.vel[0], pr.vel[2]);
          const want = Math.atan2(t.pos[0] - pr.pos[0], t.pos[2] - pr.pos[2]);
          const cur = Math.atan2(pr.vel[0], pr.vel[2]);
          const a = turn(cur, want, pr.homing * dt);
          pr.vel[0] = Math.sin(a) * sp;
          pr.vel[2] = Math.cos(a) * sp;
          pr.vel[1] = (t.pos[1] + 1.1 - pr.pos[1]) * 3;
        }
      }
      if (pr.returnAt !== undefined && pr.life < pr.returnAt && owner) {
        // the boomerang comes home
        const sp = Math.hypot(pr.vel[0], pr.vel[2]);
        const dx = owner.pos[0] - pr.pos[0];
        const dz = owner.pos[2] - pr.pos[2];
        const d = Math.hypot(dx, dz) || 1;
        pr.vel[0] = (dx / d) * sp;
        pr.vel[2] = (dz / d) * sp;
        if (!(pr as any).back) {
          (pr as any).back = true;
          pr.hit = [];
        }
        if (d < 1) pr.life = 0;
      }
      pr.pos[0] += pr.vel[0] * dt;
      pr.pos[1] += pr.vel[1] * dt;
      pr.pos[2] += pr.vel[2] * dt;
      if (!owner) continue;
      for (const o of this.enemiesOf(owner)) {
        if (pr.hit.includes(o.id) || (pr as any).shared?.has(o.id)) continue;
        if (Math.hypot(o.pos[0] - pr.pos[0], o.pos[2] - pr.pos[2]) > pr.radius + 0.45) continue;
        if (pr.pos[1] < o.pos[1] - 0.3 || pr.pos[1] > o.pos[1] + 2.3) continue;
        pr.hit.push(o.id);
        const opts: HitOpts = { color: pr.color, fromX: pr.pos[0] - pr.vel[0], fromZ: pr.pos[2] - pr.vel[2], mult: pr.mult ?? 1 };
        if (pr.onHit === 'root') opts.root = 1.5;
        if (pr.onHit === 'knock') opts.knock = 7;
        if (pr.onHit === 'launch') opts.launch = 7;
        if (pr.onHit === 'stagger') opts.stagger = true;
        const done = this.hit(owner, o, pr.dmg, opts);
        if (done && SKILLS[pr.skill]?.projHit) SKILLS[pr.skill].projHit!(this, owner, o, pr);
        this.addFx({ kind: 'burst', x: pr.pos[0], y: pr.pos[1], z: pr.pos[2], max: 0.25, r: 0.8, color: pr.color });
        if (!pr.pierce) pr.life = 0;
      }
      if (pr.pos[1] < groundHeight(pr.pos[0], pr.pos[2]) - 0.2 && !pr.homing && pr.returnAt === undefined) pr.life = 0;
    }
    this.proj = this.proj.filter((p) => p.life > 0);
  }

  private zoneStep(dt: number) {
    for (const z of this.zones) {
      z.t -= dt;
      const sk = SKILLS[z.skill];
      const owner = this.fighters[z.owner];
      // a fallen caster's zones do nothing (a heal zone used to bring the dead back to life without a respawn)
      if (sk?.zoneTick && owner && owner.hp > 0) sk.zoneTick(this, owner, z, dt);
    }
    this.zones = this.zones.filter((z) => z.t > 0);
  }

  /** for the HUD */
  xpNeed() {
    return xpFor(this.progress.level);
  }
}

/** turn angle a toward b by at most step */
export function turn(a: number, b: number, step: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + Math.max(-step, Math.min(step, d));
}

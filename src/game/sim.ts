// The whole game world, stepped once per frame: the player, the bandits in their dens, projectiles, zones on
// the ground and the little effects the renderer draws. Pure logic: no React, no three.js.
import { ROAD_N, roadPoint } from './layout';
import { makeAnimals, stepAnimals, type Animal } from './animals';
import { CT_POS } from './court';
import { makePools, newWar, raidOn, marketShut, shiftDread, stepWar, type War } from './conflict';
import { doTouch, earn, makeHerbs, policyNow, stepSpar, touchable, type Herb, type Touch } from './play';
import { clockOf, newWeather, stepWeather, SEASONS, type ClockInfo, type Weather } from './clock';
import { dateOf, hauntsFor, planFor, type Entry, type Plan } from './life';
import type { Folk } from './places';
import type { Fighter, Fx, InputState, Projectile, SectId, Status, Team, Zone } from './types';
import { DENS, DEN_R, FOE_KINDS, bossNameOf, menNameOf } from './foes';
import { MAX_SLOPE, VILLAGE_R, VILLAGE_SPAWN, WATER_Y, buildingFloor, clampWorld, groundHeight, pushOutOfBuildings, pushOutOfTrees } from './world';

/** what a body stands on: the ground, or the lake's surface (wading / swimming) */
/** what a body stands on: the ground (or the river's bed), or, given its feet's height, a roof, a terrace or a step it's on */
const floorAt = (x: number, z: number, y?: number) =>
  roomAt(x, z)
    ? Math.max(ROOM_Y, y === undefined ? -Infinity : buildingFloor(x, z, y)) // in a room: its floor, or the bench you're on
    : Math.max(groundHeight(x, z), WATER_Y - 1.1, y === undefined ? -Infinity : buildingFloor(x, z, y));
import { Progress, STORY_V, gainXp, load, playerMaxHp, playerPower, save, skillPower, xpFor } from './progress';
import { WANDERER, heroOf } from './heroes';
import { SKILLS } from './skills';
import { NPCS, QUESTS, fromStory2, type NpcRole } from './quests';
import { ALL_FOLK, ROOMS, ROOM_Y, roomAt, roomSpawn, roomExit } from './interiors';

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

export interface SimEvent {
  k: 'hit' | 'kill' | 'swing' | 'cast' | 'dodge' | 'jump' | 'land' | 'throw' | 'zone' | 'level' | 'step';
  x: number;
  y: number;
  z: number;
  id?: number; // who
  to?: number; // whom (hits)
  n?: number; // damage
  heavy?: boolean;
  crit?: boolean;
  color?: string;
  skill?: string;
}

export interface HitOpts {
  knock?: number; // push away (m/s)
  down?: number; // knocked down this long (with or without a launch)
  dur?: number; // a stagger this long (default 0.3, 0.45 with a knock)
  flinch?: boolean; // a twitch: interrupts nothing that has armour, staggers 0.2 s
  crit?: boolean; // shown as a critical (big gold number)
  heavy?: boolean; // the heavy hit effect and hit-stop
  ranged?: boolean; // from afar: 金钟罩 doesn't throw it back
  breakArmor?: boolean; // goes through 霸体 and 金钟罩's poise
  silence?: number;
  bury?: number; // 钉地斩: nailed into the ground
  reflected?: boolean;
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

const noStatus = (): Status => ({ slow: 0, root: 0, stun: 0, kneel: 0, daze: 0, crit: 0, invuln: 0, armor: 0, buffAtk: 0, rage: 0, shield: 0, weak: 0, silence: 0, protect: 0, wardT: 0, exhaust: 0 });

/** 血怒: basic attacks play this much faster, hit this much harder, legs this much quicker (天阙 1's numbers) */
export const RAGE = { t: 5, dmg: 1.2, lifesteal: 0.12, speed: 1.4, move: 1.15 };

/** an effect for the renderer: a VFXSystem call by name with plain arguments ([x,y,z] arrays become vectors) */
export interface VCmd {
  n: string;
  a: any[];
}

export class Sim {
  fighters: Fighter[] = [];
  proj: Projectile[] = [];
  zones: Zone[] = [];
  fx: Fx[] = [];
  time = 0;
  progress: Progress;
  toasts: { text: string; t: number; id: number }[] = [];
  lastTarget = -1;
  /** what happened this frame, for sound, effects and the camera (the renderer empties it) */
  events: SimEvent[] = [];
  /** a moment's freeze when the player lands a blow (seconds) */
  hitstop = 0;
  /** seconds of slow motion left (a kill by the player); the camera loop reads it */
  slowmo = 0;
  emit(e: SimEvent) {
    if (this.events.length < 200) this.events.push(e);
  }
  /** effect commands for the renderer (the old game's vfx.* calls, made from the sim) */
  vq: VCmd[] = [];
  vfx(n: string, ...a: any[]) {
    if (this.vq.length < 400) this.vq.push({ n, a });
  }
  /** a camera shake for whoever sees it: amount, and where (only felt near the player) */
  shake(amount: number, x: number, z: number) {
    const p = this.fighters[PLAYER];
    if (!p) return;
    const d = Math.hypot(p.pos[0] - x, p.pos[2] - z);
    if (d < 30) this.vfx('shake', amount * Math.max(0, 1 - d / 30));
  }
  /** something to do a moment from now (sim time): a delayed blow, a column of fire */
  private soon: { t: number; fn: () => void }[] = [];
  later(t: number, fn: () => void) {
    this.soon.push({ t, fn });
  }
  private projSeq = 0;
  /** the villager the player stands next to (F talks), and the one being talked to */
  near = -1;
  /** the door the player stands at: a room id (outside its door), -2 (at a room's way out) or -1 */
  door = -1;
  /** the room the player is in, and where they stood outside before going in */
  indoor = -1;
  /** the beasts on the map (animals.ts) */
  animals: Animal[] = makeAnimals();
  /** the world's clock (game seconds since it began) and its weather, kept between visits */
  worldT = 0;
  weather: Weather = newWeather();
  clock: ClockInfo = clockOf(0);
  private worldSaveT = 0;
  /** 江湖志: what happened and when (the year turning, festivals, first snow, what the player did) */
  chronicle: Entry[] = [];
  /** what the chronicle has already written (so a visit doesn't write the same festival twice) */
  private marks = { season: -1, fest: -1, snowY: -1, stormD: -1, quest: -1 };
  private boarSeen = false;
  private goreAt = -9;
  /** 玩法 (play.ts): short boosts (seconds left), the little game on screen, the court's counsel standing, the sparring
   *  bouts, the horse you're on, the herbs in the wild, what's in reach to touch, words floating over things */
  buffs = { speed: 0, dmg: 0, regen: 0 };
  game: any = null;
  policy: { id: string; until: number } | null = null;
  spar: { wave: number; t: number; ids: number[] } | null = null;
  riding = -1;
  herbs: Herb[] = makeHerbs();
  touch: Touch | null = null;
  bubbles: { x: number; y: number; z: number; text: string; t: number }[] = [];
  private sparPool: Fighter[] = [];
  /** 伪朝声势, its patrols and checkpoints, the night raids (conflict.ts) */
  war: War = newWar();
  /** the camera turns to this yaw on the next frame (going through a door), then it's cleared */
  camSnap: number | null = null;
  /** a short fade the UI plays when the player goes through a door */
  fadeT = 0;
  /** go in at the door you stand at, or out of the room you're in */
  useDoor() {
    const p = this.player;
    if (this.door >= 0) {
      const r = ROOMS[this.door];
      const [x, z] = roomSpawn(r);
      p.pos = [x, ROOM_Y, z];
      p.yaw = 0; // facing into the room (-z)
      this.indoor = r.id;
      this.camSnap = 0;
      this.toast(r.name);
    } else if (this.door === -2 && this.indoor >= 0) {
      const r = ROOMS[this.indoor];
      const fx = Math.sin(r.doorYaw), fz = Math.cos(r.doorYaw); // the way out of the door
      const x = r.door[0] + fx * 0.8, z = r.door[1] + fz * 0.8;
      p.pos = [x, groundHeight(x, z), z];
      p.yaw = Math.atan2(-fx, -fz);
      this.camSnap = p.yaw;
      this.indoor = -1;
    } else return;
    p.vel = [0, 0, 0];
    p.grounded = true;
    this.fadeT = 0.45;
    this.door = -1;
  }
  dialog = -1;
  /** the player holding R for an ultimate: seconds held (null = not charging) */
  ultCharge: number | null = null;
  private toastId = 0;
  private nextId = 0;

  constructor(progress?: Progress) {
    this.progress = progress ?? load();
    try {
      const w = JSON.parse(localStorage.getItem('tq2_world_v1') ?? 'null');
      if (w && typeof w.t === 'number' && isFinite(w.t)) {
        this.worldT = w.t;
        if (w.w?.kind) this.weather = { ...newWeather(), ...w.w };
        if (Array.isArray(w.c)) this.chronicle = w.c;
        if (w.m) this.marks = { ...this.marks, ...w.m };
        if (w.p?.id) this.policy = w.p;
        if (w.war) {
          const W = this.war;
          if (typeof w.war.d === 'number') W.dread = w.war.v2 ? w.war.d : Math.max(w.war.d, 30);
          W.after = w.war.a ?? null;
          W.lastTier = w.war.lt ?? 0;
          W.raidDay = w.war.rd ?? -1;
          (w.war.pd ?? []).forEach((d: number, k: number) => W.posts[k] && (W.posts[k].down = d));
        }
      }
    } catch {}
    this.clock = clockOf(this.worldT);
    if (this.progress.storyV === -2) {
      // a story 2 save: the same quests with new ones slotted in between
      const Q = this.progress.quest;
      this.progress.quest = { ...Q, idx: fromStory2(Q.idx) };
      if (this.progress.chapterSeen !== undefined) this.progress.chapterSeen = fromStory2(this.progress.chapterSeen);
      this.progress.storyV = STORY_V;
    }
    const h = heroOf(this.progress.hero);
    const p = this.make('player', null, h ? h.name : WANDERER.name, h ? h.model : WANDERER.model, this.progress.level, VILLAGE_SPAWN[0], VILLAGE_SPAWN[1]);
    p.maxHp = p.hp = playerMaxHp(p.level);
    for (const n of NPCS) {
      const f = this.make('npc', null, n.name, n.model, 30, n.x, n.z);
      f.master = true;
      f.st.invuln = 1e9;
      (f as any).role = n.role;
      f.yaw = Math.atan2(n.x, n.z);
    }
    // the folk of the village and the waystations
    ALL_FOLK.forEach((n, i) => {
      const f = this.make('npc', null, n.name, n.model, 10, n.x, n.z);
      f.master = true;
      f.st.invuln = 1e9;
      (f as any).folk = i;
      f.home = [n.x, n.z];
      f.yaw = Math.atan2(n.x, n.z);
    });
    DENS.forEach((d, di) => {
      const kind = FOE_KINDS[d.kind];
      const n = d.count + (d.boss ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const boss = d.boss && k === n - 1;
        const a = (k / n) * Math.PI * 2;
        const r = boss ? 0 : 6;
        const f = this.make('sect', kind.house, boss ? bossNameOf(d) : menNameOf(d), boss ? (kind.bossModel ?? kind.model) : kind.model, d.level + (boss ? (d.ring === 0 ? 1 : 3) : k % 3), d.x + Math.cos(a) * r, d.z + Math.sin(a) * r);
        f.home = [f.pos[0], f.pos[2]];
        (f as any).den = di;
        if (!boss) f.maxHp = f.hp = Math.round(f.maxHp * 0.85); // the men go down quicker
        if (boss) {
          (f as any).boss = true;
          // 雷彪, the first boss, is gentler: a couple of levels and a third less life than the later ones
          f.maxHp = f.hp = Math.round(f.maxHp * (d.ring === 0 ? 2.2 : 3));
        }
      }
    });
    // the general's sparring guards (演武): made now, benched until called
    const gk = FOE_KINDS.find((k) => k.model === 'guard.glb') ?? FOE_KINDS[0];
    for (let k = 0; k < 3; k++) {
      const f = this.make('sect', gk.house, '陪练禁军', gk.model, 1, CT_POS[0], CT_POS[1] - 60);
      f.hp = 0;
      (f as any).benched = true;
      (f as any).spar = true;
      (f as any).foeKind = gk;
      this.sparPool.push(f);
    }
    makePools(this);
  }
  /** calls one of the sparring guards onto the floor */
  sparrer(k: number, _kind: unknown, name: string, level: number, x: number, z: number) {
    const f = this.sparPool[k];
    f.name = name;
    f.level = level;
    f.maxHp = Math.round((180 + level * 55) * 0.65);
    f.home = [x, z];
    (f as any).benched = false;
    this.revive(f);
    f.aggro = true;
    return f;
  }
  /** words floating over a spot for a moment */
  say(x: number, y: number, z: number, text: string) {
    this.bubbles.push({ x, y, z, text, t: 1.8 });
  }

  /** which move set a foe fights with */
  kindOf(f: Fighter): (typeof FOE_KINDS)[number] | null {
    const d = DENS[(f as any).den];
    return d ? FOE_KINDS[d.kind] : ((f as any).foeKind ?? null);
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
    if (f.team === 'player') return playerPower(f.level) * (this.progress.relics?.includes('sword') ? 1.1 : 1);
    return (0.25 + f.level * 0.04) * ((f as any).boss ? 1 : 0.82); // the men hit softer than their bosses // bandits hit softer than you: a few at once is the danger
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
  shoot(f: Fighter, p: Partial<Projectile> & { speed: number; yaw?: number; life: number; dmg: number; dir?: [number, number, number] }) {
    const yaw = p.yaw ?? f.yaw;
    const dir = p.dir ?? [-Math.sin(yaw), 0, -Math.cos(yaw)];
    const pr: Projectile = {
      owner: f.id,
      skill: p.skill ?? '',
      pos: p.pos ?? [f.pos[0] - Math.sin(yaw) * 0.6, f.pos[1] + 1.2, f.pos[2] - Math.cos(yaw) * 0.6],
      vel: [dir[0] * p.speed, dir[1] * p.speed, dir[2] * p.speed],
      life: p.life,
      radius: p.radius ?? 0.5,
      dmg: p.dmg,
      color: p.color ?? '#ffffff',
      shape: p.shape ?? 'dart',
      hit: [],
      pierce: p.pierce ?? false,
      homing: p.homing,
      target: p.target,
      onHit: p.onHit,
      mult: f.castMult ?? 1,
      knock: p.knock,
      hitDur: p.hitDur,
      root: p.root,
      noStop: p.noStop,
      delay: p.delay,
      glyph: p.glyph,
      path: p.path,
      age: 0,
      id: this.projSeq++,
    };
    this.proj.push(pr);
    return pr;
  }
  /** from the thrower's hand to the enemy's chest when they're roughly in front, else straight ahead (天阙 1's aimDir) */
  aimDir(f: Fighter, from: [number, number, number], t: Fighter | null, spread = 0): [number, number, number] {
    const [fx, fz] = this.fwd(f);
    let dx = fx, dy = -0.02, dz = fz;
    if (t && t.hp > 0) {
      const tx = t.pos[0] - f.pos[0], tz = t.pos[2] - f.pos[2];
      const d = Math.hypot(tx, tz);
      if (d < 24 && (fx * tx + fz * tz) / Math.max(0.001, d) > 0.8) {
        dx = t.pos[0] - from[0];
        dy = t.pos[1] + 1.05 - from[1];
        dz = t.pos[2] - from[2];
      }
    }
    const l = Math.hypot(dx, dy, dz) || 1;
    dx /= l; dy /= l; dz /= l;
    if (spread) {
      const c = Math.cos(spread), s = Math.sin(spread);
      const x = dx * c + dz * s;
      const z = -dx * s + dz * c;
      dx = x;
      dz = z;
    }
    return [dx, dy, dz];
  }
  /** where a thrown thing leaves the hand */
  hand(f: Fighter): [number, number, number] {
    const [fx, fz] = this.fwd(f);
    const rx = Math.cos(f.yaw), rz = -Math.sin(f.yaw);
    return [f.pos[0] + fx * 0.45 + rx * 0.18, f.pos[1] + 1.35, f.pos[2] + fz * 0.45 + rz * 0.18];
  }
  zone(f: Fighter, skill: string, x: number, z: number, r: number, t: number, color: string) {
    const zn: Zone = { owner: f.id, skill, x, y: groundHeight(x, z), z, r, t, max: t, color, touched: [], age: 0, data: {} };
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
    if (def.hp <= 0 || def.st.invuln > 0 || def.act === 'burrow' || !this.isEnemy(att, def)) return 0;
    let dmg = o.noScale ? base : base * this.power(att) * (o.mult ?? att.castMult ?? 1);
    let crit = !!o.crit;
    if (!o.noScale && att.st.crit > 0) {
      dmg *= 2;
      crit = true;
      att.st.crit = 0;
    }
    if (!o.noScale) {
      if (att.st.buffAtk > 0) dmg *= 1.1;
      if (def.st.buffAtk > 0) dmg *= 0.9;
      if (att.st.rage > 0) dmg *= RAGE.dmg;
      if (att.st.weak > 0) dmg *= 0.8;
      if (def.st.weak > 0) dmg *= 1.25;
      if (att.id === PLAYER && this.buffs.dmg > 0) dmg *= 1.15;
      const pf = policyNow(this)?.foes;
      if (pf && att.team === 'sect' && !(att as any).spar) dmg *= pf;
      if (pf && def.team === 'sect' && !(def as any).spar) dmg /= pf;
      if ((att as any).spar) dmg *= 0.55; // sparring: they pull their blows
    }
    if (def.st.shield > 0) dmg *= 0.35;
    // 鹤羽护 soaks what it can
    if ((def.ward ?? 0) > 0 && def.st.wardT > 0) {
      const soak = Math.min(def.ward!, dmg);
      def.ward = def.ward! - soak;
      dmg -= soak;
      if (soak > 0) this.vfx('embers', [def.pos[0], def.pos[1] + 1.2, def.pos[2]], 8, '#f8fafc', 0.6, 0.8, 0.07);
      if (dmg <= 0) {
        this.text(def, '鹤羽护', '#f8fafc');
        return 0;
      }
    }
    dmg = Math.max(1, Math.round(dmg));
    def.hp = Math.max(0, def.hp - dmg);
    if (att.st.rage > 0 && att.hp > 0) att.hp = Math.min(att.maxHp, att.hp + dmg * RAGE.lifesteal);
    if (att.id === PLAYER) this.lastTarget = def.id;
    const heavy = !!(o.heavy || o.launch || o.down || (o.knock ?? 0) >= 6 || crit || dmg > def.maxHp * 0.12);
    this.emit({ k: 'hit', x: def.pos[0], y: def.pos[1] + 1.1, z: def.pos[2], id: att.id, to: def.id, n: dmg, heavy, crit, color: o.color });
    if ((att.id === PLAYER || def.id === PLAYER) && !o.noScale) this.hitstop = Math.max(this.hitstop, heavy ? 0.12 : 0.07);
    // for the renderer: the body flashes and jolts back the way the blow came
    (def as any).hitAt = this.time;
    (def as any).hitHeavy = heavy;
    this.text(def, crit ? `暴击 ${dmg}` : `${dmg}`, crit ? '#ffcf3a' : def.id === PLAYER ? '#ff6b6b' : o.color ?? '#ffffff');
    if (def.team === 'sect') def.aggro = true;
    // 金钟罩: whoever strikes it up close takes three tenths back
    if (def.st.shield > 0 && !o.ranged && !o.reflected && !o.noScale && this.dist(att, def) < 3.5 && att.hp > 0) {
      this.hit(def, att, dmg * 0.3, { noScale: true, reflected: true, ranged: true, stagger: false, color: '#fde68a' });
      this.vfx('bellHit', this.slotOf(def));
    }
    // statuses (人间不渡 keeps you on your feet)
    const prot = def.st.protect > 0;
    if (o.root) def.st.root = Math.max(def.st.root, o.root);
    if (o.kneel) def.st.kneel = Math.max(def.st.kneel, o.kneel);
    if (o.slow) def.st.slow = Math.max(def.st.slow, o.slow);
    if (o.daze) def.st.daze = Math.max(def.st.daze, o.daze);
    if (o.stun && !prot) def.st.stun = Math.max(def.st.stun, o.stun);
    if (o.silence) def.st.silence = Math.max(def.st.silence, o.silence);
    const ax = o.fromX ?? att.pos[0];
    const az = o.fromZ ?? att.pos[2];
    const dx = def.pos[0] - ax;
    const dz = def.pos[2] - az;
    const d = Math.hypot(dx, dz) || 1;
    if (def.hp <= 0) {
      if (att.id === PLAYER) {
        this.hitstop = Math.max(this.hitstop, (def as any).boss ? 0.3 : 0.16);
        this.slowmo = Math.max(this.slowmo, (def as any).boss ? 1.2 : 0.35);
      }
      this.kill(att, def, dx / d, dz / d);
      return dmg;
    }
    // a boss stands his ground against light blows: only heavy ones (finishers, crits, big moves) stagger him
    // (雷彪, the first, still reels from anything)
    if ((def as any).boss && DENS[(def as any).den]?.ring > 0 && !heavy && !o.launch && !o.down && !o.stun) {
      if (def.act === 'idle' || def.act === 'run') this.setAct(def, 'hit', 0.12, 'hit');
      return dmg;
    }
    const armored = !o.breakArmor && (def.st.armor > 0 || def.st.shield > 0 || def.act === 'glide');
    if (armored) return dmg;
    const stop = () => {
      if (!(def.run && SKILLS[def.run.id]?.parallel)) def.run = null;
      if (def.id === PLAYER) this.ultCharge = null;
    };
    if ((o.launch || o.down || o.bury) && !prot) {
      stop();
      if (o.launch) {
        def.vel[1] = o.launch;
        def.grounded = false;
      }
      def.vel[0] = (dx / d) * (o.knock ?? (o.launch ? 3 : 0));
      def.vel[2] = (dz / d) * (o.knock ?? (o.launch ? 3 : 0));
      this.setAct(def, 'down', (o.down ?? o.bury ?? 0.9) + (o.launch ? 0.3 : 0), o.bury ? 'hit' : 'down');
      if (o.bury) def.st.root = Math.max(def.st.root, o.bury);
    } else if (o.knock && o.stagger !== false) {
      stop();
      def.vel[0] = (dx / d) * o.knock;
      def.vel[2] = (dz / d) * o.knock;
      this.setAct(def, 'hit', o.dur ?? 0.45, 'hit');
    } else if (o.flinch) {
      if (def.act === 'idle' || def.act === 'run' || def.act === 'attack') this.setAct(def, 'hit', 0.2, 'hit');
    } else if (o.stagger !== false) {
      stop();
      this.setAct(def, 'hit', o.dur ?? 0.3, 'hit');
    }
    return dmg;
  }
  /** a boar's tusks: a heavy shove and a bruise (never the last of your life) */
  private gore(a: Animal) {
    const p = this.player;
    if (p.st.invuln > 0 || p.act === 'dodge' || p.hp <= 1 || this.time - this.goreAt < 2) return;
    this.goreAt = this.time;
    const att = { id: -7, team: 'sect', name: '野猪', pos: [a.x, a.y, a.z], hp: 1, maxHp: 1, st: { rage: 0, crit: 0, buffAtk: 0, weak: 0 } } as unknown as Fighter;
    const dmg = Math.min(p.hp - 1, Math.round(p.maxHp * 0.09));
    this.hit(att, p, dmg, { noScale: true, knock: 10, heavy: true, dur: 0.5 });
    this.shake(0.5, a.x, a.z);
    if (!this.boarSeen) {
      this.toast('野猪发了疯，一头撞了上来！');
      this.boarSeen = true;
    }
  }
  /** the effect slot a fighter's per-body effects use (vortex, bell, pillar) */
  slotOf(f: Fighter) {
    return f.id === PLAYER ? 0 : 1 + (f.id % 11);
  }

  private kill(att: Fighter, def: Fighter, nx: number, nz: number) {
    def.run = null;
    this.emit({ k: 'kill', x: def.pos[0], y: def.pos[1] + 1, z: def.pos[2], id: att.id, to: def.id });
    def.vel = [nx * 6, 7, nz * 6];
    def.grounded = false;
    this.setAct(def, 'dead', 0, 'dead');
    if (def.id === PLAYER) {
      def.respawn = 4;
      this.toast(`你被${att.name}打倒了 · 4 秒后回到村子`);
      return;
    }
    def.respawn = (def as any).boss ? 60 : 25;
    if ((def as any).spar || (def as any).pooled) def.respawn = undefined;
    def.aggro = false;
    if (att.id === PLAYER) {
      const P = this.progress;
      this.questKill(def);
      if ((def as any).boss) {
        this.chron(`你击败了${def.name}。`, `听说${def.name}栽在一个年轻人手里了，是你吧？`);
        shiftDread(this, -15);
      }
      // a foe far below you is worth little
      const gap = Math.max(0, P.level - def.level - 3);
      const xp = Math.max(3, Math.round((18 + def.level * 10) * ((def as any).boss ? 5 : 1) * Math.pow(0.75, gap)));
      this.text(att, `经验 +${xp}`, '#a5f3fc');
      if (!(def as any).spar) earn(this, (def as any).boss ? 60 : 2 + Math.floor(def.level / 3));
      const ups = gainXp(P, xp);
      if (ups > 0) {
        const p = this.player;
        p.level = P.level;
        p.maxHp = playerMaxHp(P.level);
        p.hp = p.maxHp;
        this.toast(`升级！${P.level} 级 · 技能点 +${ups * 2}，按 K 加点`);
        this.emit({ k: 'level', x: p.pos[0], y: p.pos[1], z: p.pos[2], id: PLAYER });
        if (P.level % 5 === 0) this.chron(`你的功夫练到了 ${P.level} 级。`);
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

  // ------------------------------------------------------------------ the story
  quest() {
    return QUESTS[this.progress.quest.idx] ?? null;
  }
  private questKill(def: Fighter) {
    const Q = this.progress.quest;
    const q = this.quest();
    if (!q || Q.state !== 'active') return;
    const den = (def as any).den;
    if (q.goal.type === 'kill' && den === q.goal.den) {
      Q.count++;
      this.toast(`${q.title}：${Math.min(Q.count, q.goal.count)} / ${q.goal.count}`);
    }
    if (q.goal.type === 'boss' && den === q.goal.den && (def as any).boss) Q.count = 1;
  }
  /** goals that are states of the world (learned a move, a level), and finished counts */
  private questCheck() {
    const Q = this.progress.quest;
    const q = this.quest();
    if (!q || Q.state !== 'active') return;
    const g = q.goal;
    const P = this.progress;
    const done =
      (g.type === 'learn' && Object.values(P.skills).some((l) => l > 0)) ||
      (g.type === 'level' && P.level >= g.level) ||
      (g.type === 'kill' && Q.count >= g.count) ||
      (g.type === 'boss' && Q.count >= 1) ||
      (g.type === 'visit' && Math.hypot(this.player.pos[0] - g.at[0], this.player.pos[2] - g.at[1]) < g.r);
    if (done) {
      Q.state = 'ready';
      if (q.auto) return this.turnInQuest();
      this.toast(`任务完成：${q.title} · 回村找${NPCS.find((n) => n.role === q.giver)!.name}交付`);
      this.emit({ k: 'level', x: this.player.pos[0], y: this.player.pos[1], z: this.player.pos[2], id: PLAYER });
      save(P);
    }
  }
  /** the player talks to a villager: quest offers, turn-ins and talk goals happen here */
  talk(role: NpcRole | undefined, folk?: string) {
    const Q = this.progress.quest;
    const q = this.quest();
    if (!q || Q.state !== 'active') return;
    if ((q.goal.type === 'talk' && q.goal.npc === role) || (q.goal.type === 'folk' && folk && q.goal.name === folk)) {
      Q.state = 'ready';
      save(this.progress);
      if (q.auto) {
        this.dialog = -1;
        this.turnInQuest();
      }
    }
  }
  /** a story card to show (an auto quest just handed itself in); the UI clears it */
  note: { title: string; text: string } | null = null;
  acceptQuest() {
    const Q = this.progress.quest;
    if (Q.state !== 'offered' || !this.quest()) return;
    Q.state = 'active';
    Q.count = 0;
    this.toast(`接受任务：${this.quest()!.title}`);
    save(this.progress);
    this.questCheck();
  }
  turnInQuest() {
    const Q = this.progress.quest;
    const q = this.quest();
    if (!q || Q.state !== 'ready') return;
    const P = this.progress;
    const ups = gainXp(P, q.xp);
    this.text(this.player, `经验 +${q.xp}`, '#a5f3fc');
    earn(this, 20);
    if (ups > 0) {
      const p = this.player;
      p.level = P.level;
      p.maxHp = playerMaxHp(P.level);
      p.hp = p.maxHp;
      this.toast(`升级！${P.level} 级 · 技能点 +${ups * 2}，按 K 加点`);
    }
    this.emit({ k: 'level', x: this.player.pos[0], y: this.player.pos[1], z: this.player.pos[2], id: PLAYER });
    if (q.auto) this.note = { title: q.goal.type === 'folk' ? q.goal.name : q.title, text: q.done };
    if (q.relic === 'sword' && !(P.relics ?? []).includes('sword')) {
      P.relics = [...(P.relics ?? []), 'sword'];
      this.toast('断剑重铸 · 伤害 +10%');
    }
    P.quest = { idx: Q.idx + 1, count: 0, state: 'offered' };
    const next = QUESTS[P.quest.idx];
    if (next?.direct) {
      P.quest.state = 'active';
      this.toast(`新任务：${next.title}`);
    }
    save(P);
    if (next?.direct) this.questCheck();
  }
  healFull() {
    const p = this.player;
    p.hp = p.maxHp;
    p.mp = p.maxMp;
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
    if (f.hp <= 0 || f.st.stun > 0 || f.st.daze > 0 || f.st.exhaust > 0) return false;
    if (f.act === 'idle' || f.act === 'run' || f.act === 'jump') return true;
    // the end of a swing can be cut into
    return f.act === 'attack' && f.hitDone && f.actT > f.actDur * 0.6;
  }

  attack(f: Fighter, ranged = false) {
    if (!this.free(f) || f.st.kneel > 0) return false;
    if (f.act === 'attack') f.combo = (f.combo + 1) % 3;
    else f.combo = 0;
    const slow = f.team === 'sect' ? 1.5 : 1; // disciples wind up slower: time to see it coming
    this.setAct(f, 'attack', (CHAIN[f.combo].dur * slow) / (f.st.rage > 0 ? RAGE.speed : 1), ranged ? 'throw' : `attack_${f.combo + 1}`);
    this.emit({ k: 'swing', x: f.pos[0], y: f.pos[1] + 1, z: f.pos[2], id: f.id, heavy: f.combo === 2 });
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
    // a roll cuts out of most moves (not the ones that must play out: 暴雨梨花, 万佛朝宗, 千影杀)
    const cutting = (f.act === 'cast' || f.act === 'channel') && !(f.run && SKILLS[f.run.id]?.noCancel);
    if (!(this.free(f) || f.act === 'attack' || (f.act === 'hit' && f.actT > 0.12) || cutting)) return false;
    if (f.run && SKILLS[f.run.id]?.parallel) {
      // a beam or a tether stays on
    } else if (f.run && SKILLS[f.run.id]?.again && f.act === 'burrow') return false;
    f.st.armor = 0;
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
    this.emit({ k: 'dodge', x: f.pos[0], y: f.pos[1], z: f.pos[2], id: f.id });
    return true;
  }

  jump(f: Fighter) {
    if (!f.grounded || !this.free(f) || f.st.root > 0) return false;
    f.vel[1] = 8.5;
    f.grounded = false;
    this.setAct(f, 'jump', 0, 'jump');
    this.emit({ k: 'jump', x: f.pos[0], y: f.pos[1], z: f.pos[2], id: f.id });
    return true;
  }

  cast(f: Fighter, id: string): boolean {
    const sk = SKILLS[id];
    if (!sk) return false;
    // a running skill may take a second press (burrow out, fold the vest)
    if (f.run && f.run.id === id && sk.again) return sk.again(this, f);
    if (!this.free(f) || f.st.kneel > 0) return false;
    if (f.st.silence > 0) {
      if (f.id === PLAYER) this.text(f, '封印中', '#fbbf24');
      return false;
    }
    if ((f.cds[id] ?? 0) > 0) {
      if (f.id === PLAYER) this.text(f, `冷却 ${(f.cds[id] ?? 0).toFixed(1)}s`, '#9ca3af');
      return false;
    }
    if (f.mp < sk.mp) {
      if (f.id === PLAYER) this.text(f, '内力不足', '#60a5fa');
      return false;
    }
    if (sk.ground && !f.grounded) {
      if (f.id === PLAYER) this.text(f, '落地才能施展', '#9ca3af');
      return false;
    }
    // the player's moves hit by their level; foes by a flat share
    f.castMult = f.id === PLAYER ? skillPower(this.progress.skills[id] ?? 1) : 1;
    if (!sk.cast(this, f)) return false;
    if (!sk.payOnFire) {
      f.mp -= sk.mp;
      f.cds[id] = sk.cd;
    }
    this.emit({ k: 'cast', x: f.pos[0], y: f.pos[1] + 1, z: f.pos[2], id: f.id, skill: id });
    return true;
  }

  // ------------------------------------------------------------------ the frame
  step(dt: number, input: InputState | null) {
    dt = Math.min(dt, 0.05);
    this.time += dt;
    (this as any).lastDt = dt;
    for (const f of this.fighters) this.timers(f, dt);
    if (this.soon.length) {
      const due = this.soon.filter((x) => (x.t -= dt) <= 0);
      if (due.length) {
        this.soon = this.soon.filter((x) => x.t > 0);
        for (const x of due) x.fn();
      }
    }
    if (input) this.control(this.player, input);
    for (const f of this.fighters) if (f.team !== 'player') this.think(f, dt);
    for (const f of this.fighters) this.physics(f, dt);
    // bodies don't stand inside each other
    const F = this.fighters;
    for (let i = 0; i < F.length; i++) {
      const a = F[i];
      if (a.hp <= 0 || a.act === 'burrow' || a.st.invuln > 0) continue; // a roll or a blink goes through bodies
      if ((a as any).away) continue;
      for (let j = i + 1; j < F.length; j++) {
        const b = F[j];
        if (b.hp <= 0 || b.act === 'burrow' || (b.st.invuln > 0 && !b.master) || (b as any).away) continue;
        const dx = b.pos[0] - a.pos[0];
        if (dx > 0.9 || dx < -0.9) continue;
        const dz = b.pos[2] - a.pos[2];
        if (dz > 0.9 || dz < -0.9 || Math.abs(b.pos[1] - a.pos[1]) > 1.5) continue;
        const d = Math.hypot(dx, dz);
        if (d >= 0.9 || d < 1e-4) continue;
        const push = (0.9 - d) / 2;
        const ka = a.master ? 0 : b.master ? 2 : 1; // a villager stands his ground
        const kb = b.master ? 0 : a.master ? 2 : 1;
        a.pos[0] -= (dx / d) * push * ka;
        a.pos[2] -= (dz / d) * push * ka;
        b.pos[0] += (dx / d) * push * kb;
        b.pos[2] += (dz / d) * push * kb;
        // shoved up a slope: onto the ground there, never left inside it
        if (a.grounded) a.pos[1] = Math.max(a.pos[1], floorAt(a.pos[0], a.pos[2], a.pos[1]));
        if (b.grounded) b.pos[1] = Math.max(b.pos[1], floorAt(b.pos[0], b.pos[2], b.pos[1]));
      }
    }
    for (const f of this.fighters) this.acts(f, dt);
    this.projectiles(dt);
    this.zoneStep(dt);
    // 玩法: boosts run out, the horse carries you, the bouts go on, what's in reach
    {
      const pl = this.player, B = this.buffs;
      for (const k of ['speed', 'dmg', 'regen'] as const) if (B[k] > 0) B[k] = Math.max(0, B[k] - dt);
      if (B.regen > 0 && pl.hp > 0) pl.hp = Math.min(pl.maxHp, pl.hp + pl.maxHp * 0.012 * dt);
      const ride = this.riding >= 0 ? 2.3 * (policyNow(this)?.ride ?? 1) : 1;
      (pl as any).spdMul = (B.speed > 0 ? 1.25 : 1) * ride;
      if (this.riding >= 0) {
        const a = this.animals[this.riding];
        const sp = Math.hypot(pl.vel[0], pl.vel[2]);
        a.x = pl.pos[0];
        a.z = pl.pos[2];
        a.y = groundHeight(a.x, a.z);
        a.speed = sp;
        if (sp > 0.4) a.yaw = Math.atan2(pl.vel[0], pl.vel[2]);
        a.state = 'graze';
        a.t = 99;
        if (pl.hp <= 0 || this.indoor >= 0) {
          (a as any).ridden = false;
          this.riding = -1;
        }
      }
      stepSpar(this, dt);
      this.touch = this.near < 0 && this.door === -1 && this.dialog < 0 ? touchable(this) : null;
      for (const b of this.bubbles) b.t -= dt;
      if (this.bubbles.length) this.bubbles = this.bubbles.filter((b) => b.t > 0);
    }
    // the world turns: the hour, the season, the weather
    this.worldT += dt;
    this.clock = clockOf(this.worldT);
    stepWeather(this.weather, dt, this.clock);
    this.writeChronicle();
    stepWar(this, dt);
    if ((this.worldSaveT -= dt) <= 0) {
      this.worldSaveT = 10;
      try {
        localStorage.setItem('tq2_world_v1', JSON.stringify({ t: this.worldT, w: this.weather, c: this.chronicle.slice(-200), m: this.marks, p: this.policy, war: { v2: 1, d: this.war.dread, a: this.war.after, lt: this.war.lastTier, rd: this.war.raidDay, pd: this.war.posts.map((p) => p.down) } }));
      } catch {}
    }
    {
      const pl = this.player;
      stepAnimals(this.animals, dt, { px: pl.pos[0], pz: pl.pos[2], here: pl.hp > 0 && this.indoor < 0, loud: pl.act === 'attack' || !!pl.run, gore: (a) => this.gore(a) });
    }
    for (const x of this.fx) x.t -= dt;
    this.fx = this.fx.filter((x) => x.t > 0);
    for (const t of this.toasts) t.t -= dt;
    if (this.fadeT > 0) this.fadeT -= dt;
    // the villager the player stands next to
    const pl = this.player;
    this.near = -1;
    let nearD = Infinity;
    for (const f of this.fighters)
      if (f.master && !(f as any).away && pl.hp > 0 && this.dist(f, pl) < 3.6 && this.dist(f, pl) < nearD) {
        this.near = f.id;
        nearD = this.dist(f, pl);
      }
    if (this.dialog >= 0 && this.near !== this.dialog) this.dialog = -1;
    // a door the player stands at: a room's way in (outside) or its way out (inside)
    this.door = -1;
    if (pl.hp > 0) {
      const inside = roomAt(pl.pos[0], pl.pos[2]);
      this.indoor = inside ? inside.id : -1;
      if (inside) {
        const [ex, ez] = roomExit(inside);
        const dd = Math.hypot(pl.pos[0] - ex, pl.pos[2] - ez);
        if (dd < 1.7 && dd < nearD) this.door = -2;
      } else
        for (const r of ROOMS) {
          const dd = Math.hypot(pl.pos[0] - r.door[0], pl.pos[2] - r.door[1]);
          if (dd < 2.2 && dd < nearD) this.door = r.id;
        }
      // whichever is closer, a door or a person, is what F does
      if (this.door !== -1) this.near = -1;
    }
    this.questCheck();
    this.toasts = this.toasts.filter((t) => t.t > 0);
  }

  private timers(f: Fighter, dt: number) {
    const s = f.st;
    // 金钟罩 breaks: half a second to catch breath
    if (s.shield > 0 && s.shield <= dt && f.hp > 0) {
      s.exhaust = 0.5;
      this.text(f, '气竭', '#a3a3a3');
    }
    // 做空: the price slides and the health with it; six tenths of it is the trader's profit
    if (s.weak > 0 && f.hp > 1) {
      const by = this.fighters[(f as any).shortBy ?? -1];
      const d = Math.min(f.hp - 1, f.maxHp * 0.025 * dt);
      f.hp -= d;
      (f as any).shortAcc = ((f as any).shortAcc ?? 0) + d;
      if (by && by.hp > 0) by.hp = Math.min(by.maxHp, by.hp + d * 0.6);
      if ((f as any).shortAcc >= Math.max(12, f.maxHp * 0.03)) {
        this.addFx({ kind: 'text', x: f.pos[0], y: f.pos[1] + 2.1, z: f.pos[2], max: 0.8, r: 1, color: '#ff3b3b', text: `▼${Math.round((f as any).shortAcc)}` });
        if (by) this.addFx({ kind: 'text', x: by.pos[0], y: by.pos[1] + 2.1, z: by.pos[2], max: 0.8, r: 1, color: '#4ade80', text: `+${Math.round((f as any).shortAcc * 0.6)}` });
        (f as any).shortAcc = 0;
      }
    }
    for (const k of Object.keys(s) as (keyof Status)[]) if (s[k] > 0) s[k] = Math.max(0, s[k] - dt);
    for (const k of Object.keys(f.cds)) f.cds[k] = Math.max(0, f.cds[k] - dt);
    if (s.wardT <= 0) f.ward = 0;
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
    if (this.riding >= 0) inp = { ...inp, attack: false, dodge: false, ultHeld: false, skills: inp.skills.map(() => false) };
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
    if (inp.interact && this.riding >= 0) doTouch(this, { kind: 'dismount', id: this.riding, label: '' });
    else if (inp.interact && this.near < 0 && this.door !== -1 && this.dialog < 0) this.useDoor();
    else if (inp.interact && this.near < 0 && this.touch && this.dialog < 0 && !this.game) doTouch(this, this.touch);
    else if (inp.interact && this.near >= 0) {
      this.dialog = this.dialog >= 0 ? -1 : this.near;
      if (this.dialog >= 0) {
        const t = this.fighters[this.dialog] as any;
        this.talk(t.role, t.folk !== undefined ? t.name : undefined);
      }
    }
    if (inp.dodge) this.dodge(f, mx, mz);
    if (inp.jump) this.jump(f);
    const aim = () => {
      // face where the camera looks, or the enemy nearest that line
      f.yaw = cy;
      // (or, with nobody on that line, whoever is right beside you: a foe at your elbow gets cut, not the air)
      const t = this.nearestEnemy(f, 12, Math.cos(0.6)) ?? this.nearestEnemy(f, 3.2, -1);
      if (t) this.faceTo(f, t.pos[0], t.pos[2]);
    };
    const running = f.run ? SKILLS[f.run.id] : null;
    if (running?.aim) f.yaw = cy; // 穿云狙: the scope turns with the camera
    if (inp.attack && running?.fire) running.fire(this, f);
    else if (inp.attack && this.free(f) && this.ultCharge === null) {
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

  /** writes the year into the chronicle as it happens */
  chron(text: string, talk?: string) {
    this.chronicle.push({ d: dateOf(this.clock), text, talk });
    if (this.chronicle.length > 240) this.chronicle.splice(0, this.chronicle.length - 200);
  }
  private writeChronicle() {
    const c = this.clock, m = this.marks, w = this.weather;
    const NOTE = ['草长莺飞，杏花开满了青石村。', '日头毒起来，蝉叫了一整天。', '山上的叶子一夜之间红了。', '北风起，雪线往山下压。'];
    if (c.season !== m.season) {
      if (m.season >= 0 || !this.chronicle.length) this.chron(`${SEASONS[c.season]}天到了。${NOTE[c.season]}`);
      m.season = c.season;
    }
    if (c.festival && m.fest !== c.day) {
      m.fest = c.day;
      this.chron(`${c.festival.name}。${c.festival.note}`);
      this.toast(`今日 ${c.festival.name}：${c.festival.note}`);
    }
    if (w.kind === 'snow' && w.amt > 0.5 && m.snowY !== c.year) {
      m.snowY = c.year;
      this.chron('今冬第一场雪落下来了。', '下雪了。听说每年头一场雪，那个戴面具的客人就会来杏花酒肆。');
    }
    if (w.kind === 'storm' && w.amt > 0.5 && m.stormD !== c.day) {
      m.stormD = c.day;
      this.chron('雷雨大作，河水涨了。');
    }
    const qi = this.progress.quest.idx;
    if (qi !== m.quest) {
      const ch = QUESTS[qi]?.chapter;
      if (ch && m.quest >= 0) this.chron(`【${ch.name}】`);
      m.quest = qi;
    }
  }
  /** wander round a spot: walk to a point near it, stand a while, pick another */
  private stroll(f: Fighter, base: [number, number], radius: number, dt: number) {
    const a = f as any;
    if (!a.goal || (a.wait ?? 0) > 0 || Math.hypot(a.goal[0] - base[0], a.goal[1] - base[1]) > radius + 0.5) {
      a.wait = (a.wait ?? 0) - dt;
      if (a.wait <= 0 || !a.goal || Math.hypot(a.goal[0] - base[0], a.goal[1] - base[1]) > radius + 0.5) {
        const r = Math.random() * radius, t = Math.random() * Math.PI * 2;
        a.goal = [base[0] + Math.cos(t) * r, base[1] + Math.sin(t) * r];
        a.wait = 0;
      }
      if (a.wait > 0) return;
    }
    const dx = a.goal[0] - f.pos[0], dz = a.goal[1] - f.pos[2];
    const d = Math.hypot(dx, dz);
    if (d < 0.6) {
      a.wait = 2 + Math.random() * 5;
      return;
    }
    a.wish = [(dx / d) * 0.3, (dz / d) * 0.3];
  }
  /** a folk's day: where the hour, the weather and the festival want them (life.ts), and getting there */
  private live(f: Fighter, folk: Folk, dt: number) {
    const a = f as any, p = this.player;
    if ((a.planT = (a.planT ?? 0) - dt) <= 0) {
      a.planT = 0.8 + Math.random() * 0.6;
      a.plan = planFor(folk, (a.haunts ??= hauntsFor(folk)), this.clock, this.weather, { alarm: raidOn(this) && Math.hypot(f.pos[0], f.pos[2]) < 220, shut: marketShut(this) });
    }
    const pl: Plan = a.plan;
    let dx = pl.at[0] - f.pos[0], dz = pl.at[1] - f.pos[2];
    const d = Math.hypot(dx, dz);
    // into or out of the village ring the way goes by a road (the houses' backs face outward, their doors the square)
    {
      const rin = Math.hypot(f.pos[0], f.pos[2]), rto = Math.hypot(pl.at[0], pl.at[1]);
      const IN = 25;
      if ((rin > IN) !== (rto > IN) && d > 3) {
        const outside: [number, number] = rto > IN ? pl.at : [f.pos[0], f.pos[2]];
        let kb = 0, bd = Infinity;
        for (let k = 0; k < ROAD_N; k++) {
          const q = roadPoint(k, 32);
          const e = Math.hypot(q[0] - outside[0], q[1] - outside[1]);
          if (e < bd) {
            bd = e;
            kb = k;
          }
        }
        const gapOut = roadPoint(kb, 32), gapIn = roadPoint(kb, 9);
        let via: [number, number] | null = null;
        if (rin > IN) via = rin > 30 && Math.hypot(gapOut[0] - f.pos[0], gapOut[1] - f.pos[2]) > 4 ? gapOut : rin > 11 ? gapIn : null;
        else via = rin < 12 && Math.hypot(gapIn[0] - f.pos[0], gapIn[1] - f.pos[2]) > 3 ? gapIn : gapOut;
        if (via) {
          dx = via[0] - f.pos[0];
          dz = via[1] - f.pos[2];
        }
      }
    }
    // nobody near enough to see: they're simply where the day says
    if (this.indoor >= 0 || this.dist(f, p) > 150) {
      if (d > Math.max(2, pl.roam + 1)) {
        f.pos = [pl.at[0], floorAt(pl.at[0], pl.at[1]), pl.at[1]];
        f.vel = [0, 0, 0];
        a.goal = null;
      }
      a.away = pl.away;
      return;
    }
    if (d > Math.max(1.4, pl.roam + 0.5)) {
      // on the way there; a step aside when something stands in the way
      a.away = false;
      // a trip that goes on too long has met a house it can't get round: when you're not right there, they're simply there
      a.tripT = (a.tripT ?? 0) + dt;
      if (a.tripT > 50 && this.dist(f, p) > 25) {
        f.pos = [pl.at[0], floorAt(pl.at[0], pl.at[1]), pl.at[1]];
        f.vel = [0, 0, 0];
        a.tripT = 0;
        return;
      }
      a.stuckT = (a.stuckT ?? 0) + dt;
      if (a.stuckT > 2.2) {
        const moved = a.stuckAt ? Math.hypot(f.pos[0] - a.stuckAt[0], f.pos[2] - a.stuckAt[1]) : 9;
        a.stuckAt = [f.pos[0], f.pos[2]];
        a.stuckT = 0;
        if (moved < 0.6) {
          a.sideT = 1.4;
          a.side = Math.random() < 0.5 ? 1 : -1;
        }
      }
      const dv = Math.hypot(dx, dz) || 1;
      let ux = dx / dv, uz = dz / dv;
      if ((a.sideT ?? 0) > 0) {
        a.sideT -= dt;
        const s = a.side;
        [ux, uz] = [ux * 0.3 - uz * s, uz * 0.3 + ux * s];
      }
      // they run when raiders are in the village
      const pace = pl.act === '躲在家里' ? 0.95 : 0.45;
      a.wish = [ux * pace, uz * pace];
      return;
    }
    a.tripT = 0;
    if (pl.away) {
      a.away = true;
      return;
    }
    a.away = false;
    if (pl.roam > 0.9) this.stroll(f, pl.at, pl.roam, dt);
  }

  /** disciples and masters */
  private think(f: Fighter, dt: number) {
    if (f.hp <= 0) return;
    const p = this.player;
    if (f.master) {
      const a = f as any;
      a.wish = [0, 0];
      const folk = a.folk !== undefined ? ALL_FOLK[a.folk] : null;
      // those who keep their own hours go about their day (life.ts); the hidden ones are at home
      if (folk?.life) {
        this.live(f, folk, dt);
        if (a.away) return;
      }
      const talking = p.hp > 0 && this.dist(f, p) < (folk?.walk || folk?.life ? 4 : 10);
      if (talking || this.fighters[this.dialog] === f) {
        a.wish = [0, 0];
        this.faceTo(f, p.pos[0], p.pos[2]);
        return;
      }
      if (folk?.life) return;
      // a stroller: walks to a spot near home, stands a while, picks another
      if (folk?.walk && f.home) this.stroll(f, f.home, folk.walk, dt);
      return;
    }
    const home = f.home!;
    const fromHome = Math.hypot(f.pos[0] - home[0], f.pos[2] - home[1]);
    const d = this.dist(f, p);
    const pFromHome = Math.hypot(p.pos[0] - home[0], p.pos[2] - home[1]);
    // they give up when you leave their ground, and never follow you into the village
    const pInVillage = Math.hypot(p.pos[0], p.pos[2]) < VILLAGE_R + 10;
    const mode = (f as any).mode;
    if (mode === 'raid') f.aggro = p.hp > 0 && this.indoor < 0 && d < 22;
    else if (mode === 'hunt') f.aggro = p.hp > 0 && this.indoor < 0 && d < 160;
    else if (mode) {
      if (p.hp <= 0 || pFromHome > 60 || this.indoor >= 0) f.aggro = false;
      else if (d < 24) f.aggro = true;
    } else if (p.hp <= 0 || pInVillage || pFromHome > DEN_R + 28 || fromHome > 38) f.aggro = false;
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
      } else if (!(f as any).mode) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.2 * dt); // back home: patched up
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
      let spd = (f.team === 'player' ? RUN : NPC_RUN) * (f.st.slow > 0 ? 0.5 : 1) * (f.st.daze > 0 ? 0.5 : 1) * (f.st.rage > 0 ? RAGE.move : 1) * (f.st.weak > 0 ? 0.8 : 1) * ((f as any).spdMul ?? 1) * (groundHeight(f.pos[0], f.pos[2]) < WATER_Y - 0.5 ? 0.55 : 1);
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
    (f as any).spdMul = 1; // zones set it again for the next frame
    // 锁链钩: dragged in to the chain's end
    if (f.pull) {
      f.pull.t -= dt;
      const k = Math.min(1, dt / Math.max(dt, f.pull.t + dt));
      f.vel[0] = ((f.pull.x - f.pos[0]) * k) / dt;
      f.vel[2] = ((f.pull.z - f.pos[2]) * k) / dt;
      if (f.pull.t <= 0 || f.hp <= 0) {
        f.pull = undefined;
        f.vel[0] = f.vel[2] = 0;
      }
    }
    // gravity
    const floating = sk?.float && sk.float(this, f);
    if (!floating) f.vel[1] -= GRAVITY * dt;
    if (sk?.fallCap !== undefined) f.vel[1] = Math.max(f.vel[1], -sk.fallCap);
    const ox = f.pos[0], oz = f.pos[2];
    const og = floorAt(ox, oz);
    f.pos[0] += f.vel[0] * dt;
    f.pos[1] += f.vel[1] * dt;
    f.pos[2] += f.vel[2] * dt;
    if (f.team === 'player' || f.act !== 'dead') {
      pushOutOfTrees(f.pos);
      pushOutOfBuildings(f.pos);
    }
    if (!roomAt(f.pos[0], f.pos[2])) clampWorld(f.pos);
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
    const g = floorAt(f.pos[0], f.pos[2], f.pos[1]);
    if (f.pos[1] <= g) {
      f.pos[1] = g;
      const vy = f.vel[1];
      if (f.vel[1] < 0) f.vel[1] = 0;
      if (!f.grounded) {
        f.grounded = true;
        if (f.id === PLAYER || vy < -12) this.emit({ k: 'land', x: f.pos[0], y: f.pos[1], z: f.pos[2], id: f.id, heavy: vy < -12 });
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
      const slow = (f.team === 'sect' ? 1.5 : 1) / (f.st.rage > 0 ? RAGE.speed : 1);
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
          for (const o of this.inCone(f, MELEE_RANGE, 0.25)) this.hit(f, o, c.dmg, f.combo === 2 ? { knock: 8, heavy: true, dur: 0.55, mult: 1 } : f.team === 'player' ? { knock: 2.2, dur: 0.3, mult: 1 } : { mult: 1 });
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
      pr.age = (pr.age ?? 0) + dt;
      const owner = this.fighters[pr.owner];
      if (!owner) {
        pr.life = 0;
        continue;
      }
      // stuck in the ground: lies there a while, harmless
      if (pr.stuck !== undefined) {
        pr.stuck -= dt;
        if (pr.stuck <= 0) pr.life = 0;
        else pr.life = Math.max(pr.life, 0.01);
        continue;
      }
      // held a beat in the hand (the Rolex comes off the wrist first)
      if ((pr.delay ?? 0) > 0) {
        pr.delay! -= dt;
        const sp = Math.hypot(pr.vel[0], pr.vel[1], pr.vel[2]) || 1;
        pr.pos = [owner.pos[0] + (pr.vel[0] / sp) * 0.6, owner.pos[1] + 1.35, owner.pos[2] + (pr.vel[2] / sp) * 0.6];
        pr.life += dt;
        continue;
      }
      for (let sub = 0; sub < 2 && pr.life > 0; sub++) this.projSub(pr, owner, dt / 2);
    }
    this.proj = this.proj.filter((p) => p.life > 0);
  }

  /** half a frame of one projectile: move it, then see whom it reached */
  private projSub(pr: Projectile, owner: Fighter, h: number) {
    if (pr.path) {
      // 回旋镖: a loop out to the right, round the target, back on the left; the way home bends to the thrower
      const P = pr.path;
      P.u += h / P.T;
      if (P.u >= 1 || owner.hp <= 0) return void (pr.life = 0);
      const th = P.u * Math.PI * 2;
      const hk = Math.max(0, P.u - 0.5) * 2;
      const px = pr.pos[0], py = pr.pos[1], pz = pr.pos[2];
      pr.pos[0] = P.ox + P.fx * (P.L / 2) * (1 - Math.cos(th)) + P.sx * (P.W / 2) * Math.sin(th) + (owner.pos[0] - P.ox) * hk;
      pr.pos[2] = P.oz + P.fz * (P.L / 2) * (1 - Math.cos(th)) + P.sz * (P.W / 2) * Math.sin(th) + (owner.pos[2] - P.oz) * hk;
      const baseY = P.u < 0.5 ? P.y0 : owner.pos[1] + 1.2;
      pr.pos[1] = baseY + (P.ty - baseY) * Math.sin(P.u * Math.PI);
      pr.vel = [(pr.pos[0] - px) / h, (pr.pos[1] - py) / h, (pr.pos[2] - pz) / h];
      P.back = P.u >= 0.5;
      if (P.u > 0.04 && pr.pos[1] < groundHeight(pr.pos[0], pr.pos[2]) - 0.1) {
        this.vfx('sparkBurst', [...pr.pos], 12, '#e5e7eb', 4, 0.05);
        return void (pr.life = 0);
      }
      if (P.back && P.u > 0.85 && Math.hypot(pr.pos[0] - owner.pos[0], pr.pos[1] - owner.pos[1] - 1.2, pr.pos[2] - owner.pos[2]) < 1) return void (pr.life = 0);
    } else if (pr.shape === 'glyph') {
      // 六字真言: drift out of the fan, then hunt harder and harder
      const t = pr.target !== undefined ? this.fighters[pr.target] : null;
      const age = pr.age ?? 0;
      if (!t || t.hp <= 0) {
        pr.pos[0] += pr.vel[0] * h;
        pr.pos[1] += pr.vel[1] * h;
        pr.pos[2] += pr.vel[2] * h;
        pr.vel = pr.vel.map((v) => v * 0.985) as [number, number, number];
        if (age > 1.1) {
          this.vfx('sparkBurst', [...pr.pos], 6, '#ffe9a8', 2, 0.04);
          pr.life = 0;
        }
        return;
      }
      const tx = t.pos[0], ty = t.pos[1] + 1.15, tz = t.pos[2];
      glyphSteer(pr.pos, pr.vel, tx, ty, tz, age, h);
      if (age > 2.4) return void (pr.life = 0);
      if (Math.hypot(pr.pos[0] - tx, pr.pos[1] - ty, pr.pos[2] - tz) > 0.75) return;
      pr.life = 0;
      if (t.st.invuln > 0 || t.act === 'dodge') return void this.text(t, '闪', '#e5e7eb');
      const last = pr.glyph === 5;
      const done = last
        ? this.hit(owner, t, 90, { knock: 5, dur: 0.5, breakArmor: true, ranged: true, crit: true, heavy: true, mult: pr.mult, color: '#fbbf24' })
        : this.hit(owner, t, 32, { knock: 1, flinch: true, ranged: true, mult: pr.mult, color: '#ffe9a8' });
      if (last) {
        if (done && t.hp > 0) {
          t.st.silence = Math.max(t.st.silence, 2.2);
          this.addFx({ kind: 'text', x: t.pos[0], y: t.pos[1] + 2.6, z: t.pos[2], max: 1, r: 2, color: '#fbbf24', text: '封印' });
          this.vfx('ring', [t.pos[0], t.pos[1] + 0.05, t.pos[2]], 1.6, '#fbbf24', 0.5, 0.14, 0.4);
        }
        this.vfx('flash', [tx, ty, tz], '#ffd36a', 50, 0.2, 9);
        this.vfx('sparkBurst', [tx, ty, tz], 30, '#ffe9a8', 9, 0.08, 'up', 1.4);
        this.vfx('sound', 'gong');
      } else this.vfx('sparkBurst', [tx, ty, tz], 8, '#ffe9a8', 5, 0.05);
      return;
    } else {
      // homing: a thrown knife curves in on its mark, a Rolex on whoever is near it
      let t: Fighter | null = null;
      if (pr.shape === 'watch') {
        let bd = 12;
        for (const o of this.enemiesOf(owner)) {
          const d = Math.hypot(o.pos[0] - pr.pos[0], o.pos[2] - pr.pos[2]);
          if (d < bd) {
            bd = d;
            t = o;
          }
        }
      } else if (pr.homing && pr.target !== undefined) t = this.fighters[pr.target] ?? null;
      if (pr.homing && t && t.hp > 0) {
        const sp = Math.hypot(pr.vel[0], pr.vel[1], pr.vel[2]);
        let wx = t.pos[0] - pr.pos[0], wy = t.pos[1] + 1.1 - pr.pos[1], wz = t.pos[2] - pr.pos[2];
        const wl = Math.hypot(wx, wy, wz) || 1;
        const k = Math.min(1, pr.shape === 'watch' ? pr.homing * h : (pr.homing * h) / 2);
        let vx = pr.vel[0] / sp + (wx / wl - pr.vel[0] / sp) * k;
        let vy = pr.vel[1] / sp + (wy / wl - pr.vel[1] / sp) * k;
        let vz = pr.vel[2] / sp + (wz / wl - pr.vel[2] / sp) * k;
        const vl = Math.hypot(vx, vy, vz) || 1;
        pr.vel = [(vx / vl) * sp, (vy / vl) * sp, (vz / vl) * sp];
      }
      pr.pos[0] += pr.vel[0] * h;
      pr.pos[1] += pr.vel[1] * h;
      pr.pos[2] += pr.vel[2] * h;
      // into the ground: a dart or a knife sticks there a while; a watch just drops
      const gy = groundHeight(pr.pos[0], pr.pos[2]);
      if (pr.pos[1] < gy + 0.02) {
        if (pr.shape === 'watch') return void (pr.life = 0);
        pr.pos[1] = Math.max(pr.pos[1], gy - 0.25);
        pr.stuck = pr.noStop ? 1.0 : 2.5;
        this.vfx('dustPuff', [pr.pos[0], gy + 0.05, pr.pos[2]], 2, 0.1, 0.8, 0.25);
        return;
      }
    }
    // whom it reached
    const rad = pr.path ? 0.9 : pr.shape === 'watch' ? 0.85 : 0.55;
    const P = pr.path;
    const seen = P ? (P.back ? ((pr as any).hitB ??= []) : pr.hit) : pr.hit;
    for (const o of this.enemiesOf(owner)) {
      if (seen.includes(o.id)) continue;
      if (Math.hypot(o.pos[0] - pr.pos[0], o.pos[2] - pr.pos[2]) > rad + 0.2) continue;
      if (pr.pos[1] < o.pos[1] - 0.2 || pr.pos[1] > o.pos[1] + 2.1) continue;
      if (o.act === 'burrow') continue;
      seen.push(o.id);
      if (o.st.invuln > 0) {
        // through the roll: flies on
        this.text(o, '闪', '#e5e7eb');
        continue;
      }
      const opts: HitOpts = {
        color: pr.color,
        fromX: pr.pos[0] - pr.vel[0],
        fromZ: pr.pos[2] - pr.vel[2],
        mult: pr.mult ?? 1,
        ranged: true,
        knock: pr.knock ?? 1.2,
        dur: pr.hitDur ?? 0.22,
        heavy: pr.shape !== 'dart' && pr.shape !== 'knife',
        crit: pr.shape === 'watch',
      };
      if (pr.noStop) opts.stagger = false;
      else if (pr.onHit !== 'stagger' && (pr.shape === 'dart' || pr.shape === 'knife')) opts.flinch = true;
      if (pr.noStop || opts.flinch) opts.knock = pr.noStop ? 0 : opts.knock;
      const done = this.hit(owner, o, pr.dmg, opts);
      if (done && pr.root && o.hp > 0) {
        o.st.root = Math.max(o.st.root, pr.root);
        this.vfx('ring', [o.pos[0], o.pos[1] + 0.05, o.pos[2]], 1.3, '#5eead4', 0.5, 0.12, 0.4);
        this.addFx({ kind: 'text', x: o.pos[0], y: o.pos[1] + 2.4, z: o.pos[2], max: 0.9, r: 2, color: '#5eead4', text: '定身' });
      }
      if (done && pr.shape === 'watch') {
        this.vfx('sparkBurst', [...pr.pos], 18, '#ffd36a', 3, 0.06, 'up', 0.7);
        this.addFx({ kind: 'text', x: o.pos[0], y: o.pos[1] + 2.6, z: o.pos[2], max: 0.9, r: 2, color: '#ffd36a', text: 'Rolex!' });
      }
      if (done && SKILLS[pr.skill]?.projHit) SKILLS[pr.skill].projHit!(this, owner, o, pr);
      if (!pr.pierce && !P) return void (pr.life = 0);
    }
  }

  private zoneStep(dt: number) {
    for (const z of this.zones) {
      z.t -= dt;
      z.age += dt;
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

/** 六字真言's homing (the old game's glyphSteer, on plain numbers): drift out of the fan, then hunt harder and harder */
export function glyphSteer(pos: number[], vel: number[], tx: number, ty: number, tz: number, age: number, dt: number) {
  let wx = tx - pos[0], wy = ty - pos[1], wz = tz - pos[2];
  const d = Math.hypot(wx, wy, wz);
  if (age > 0.18 && d > 1e-3) {
    const speed = Math.min(26, 11 + (age - 0.18) * 34);
    wx *= speed / d;
    wy *= speed / d;
    wz *= speed / d;
    const k = 1 - Math.exp(-dt * (4 + age * 10));
    vel[0] += (wx - vel[0]) * k;
    vel[1] += (wy - vel[1]) * k;
    vel[2] += (wz - vel[2]) * k;
  } else {
    const k = Math.exp(-dt * 2.5);
    vel[0] *= k;
    vel[1] *= k;
    vel[2] *= k;
  }
  pos[0] += vel[0] * dt;
  pos[1] += vel[1] * dt;
  pos[2] += vel[2] * dt;
}

/** turn angle a toward b by at most step */
export function turn(a: number, b: number, step: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + Math.max(-step, Math.min(step, d));
}

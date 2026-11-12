// Shared shapes for the simulation. The sim (src/game) never touches React or three.js scene objects: the renderer
// (src/render) and the HUD (src/ui) only read this state.

export type SectId =
  | 'kuangren' | 'anqi' | 'yingren' | 'jiaoyi' | 'fanyin' | 'dixian' | 'tianzi'
  // the eleven houses the owner added
  | 'jianke' | 'qiangwang' | 'quanshi' | 'fushi' | 'qinshi' | 'yushou' | 'duzong' | 'gongshou' | 'shuangdao' | 'qizong' | 'jiguan';

/** what the body is doing; the renderer picks a clip from it */
export type Act = 'idle' | 'run' | 'jump' | 'attack' | 'cast' | 'channel' | 'dodge' | 'hit' | 'down' | 'dead' | 'glide' | 'burrow';

export type Team = 'player' | 'sect' | 'npc' | 'ally'; // ally: companions and the village militia, on your side

export interface Status {
  slow: number; // seconds left of 50% move speed
  root: number; // can't move
  stun: number; // can't move or act
  kneel: number; // 跪: can't move or cast
  daze: number; // 白日梦: wanders, can't act
  crit: number; // next hit crits
  invuln: number; // nothing hits
  armor: number; // not staggered by hits
  buffAtk: number; // seconds of +10% atk/def (禅定结界 inside)
  rage: number; // 血怒: +30% damage, lifesteal, faster
  shield: number; // 金钟罩: 65% less damage, not staggered
  weak: number; // 做空: -20% attack, +25% damage taken, -20% speed
  silence: number; // 封印 / 跪: no moves at all
  protect: number; // 人间不渡: can't be knocked down, launched or stunned
  wardT: number; // 鹤羽护: the feather shield is up (amount in Fighter.ward)
  exhaust: number; // 金钟罩 just broke: a half-second gasp
}

export interface Fighter {
  id: number;
  name: string;
  team: Team;
  sect: SectId | null; // null = the player (散人)
  model: string; // file in public/models
  level: number;
  pos: [number, number, number];
  vel: [number, number, number];
  yaw: number; // facing; forward is (-sin yaw, -cos yaw)
  grounded: boolean;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  act: Act;
  actT: number; // time in the current act
  actDur: number; // how long the act lasts (0 = until changed)
  anim: string; // clip key for the renderer (attack_1, skill_slash, ...)
  combo: number; // basic-attack chain step
  hitDone: boolean; // the current swing already landed
  cds: Record<string, number>;
  st: Status;
  /** a running skill's own state (whirlwind ticks, burrow, drain beam ...) */
  run: { id: string; t: number; data: Record<string, number> } | null;
  castMult?: number; // the level share of the move being cast
  ward?: number; // 鹤羽护: damage the feather shield still soaks
  pull?: { x: number; z: number; t: number }; // 锁链钩: dragged to this point over t seconds
  // NPC only
  home?: [number, number];
  respawn?: number;
  aiT?: number;
  aggro?: boolean;
  master?: boolean;
}

export type ShotLook = 'arrow' | 'rock' | 'talisman' | 'note' | 'orb' | 'crescent';
export interface Projectile {
  owner: number;
  skill: string;
  pos: [number, number, number];
  vel: [number, number, number];
  life: number;
  radius: number;
  dmg: number;
  color: string;
  shape: 'dart' | 'pin' | 'knife' | 'glyph' | 'watch' | 'boomerang';
  hit: number[]; // fighter ids already hit
  pierce: boolean;
  homing?: number; // turn rate toward target
  target?: number;
  returnAt?: number; // boomerang: life at which it turns round
  onHit?: string; // effect tag: root / knock / stagger / launch
  mult?: number; // the move's level share when it was thrown
  knock?: number; // push on a hit
  hitDur?: number; // how long the hit staggers (0 = a flinch only)
  root?: number; // 定身镖
  noStop?: boolean; // goes on through bodies (暴雨梨花)
  delay?: number; // held in the hand this long before it flies (劳力士)
  stuck?: number; // in the ground or a wall: lies there this long, harmless
  glyph?: number; // 六字真言: which syllable (0..5)
  /** how a kit shot is drawn (render/Juice shotLook): an arrow, a stone, a paper talisman, a note, a ball of qi, a crescent of sword qi */
  look?: ShotLook;
  age?: number;
  /** 回旋镖: the loop it flies (origin, forward, side, length, width, start height, target height, progress, time) */
  path?: { ox: number; oz: number; fx: number; fz: number; sx: number; sz: number; L: number; W: number; y0: number; ty: number; u: number; T: number; back: boolean; hitOut: boolean; hitBack: boolean };
  id?: number;
}

export interface Zone {
  owner: number;
  skill: string;
  x: number;
  y: number;
  z: number;
  r: number;
  t: number; // seconds left
  max: number;
  color: string;
  touched: number[]; // ids already given the one-time effect
  age: number; // seconds since it was laid
  data: Record<string, any>; // the move's own state (a cage's prisoners, a candle's warning ...)
}

export interface Fx {
  kind: 'ring' | 'burst' | 'beam' | 'seal' | 'text' | 'slash';
  x: number;
  y: number;
  z: number;
  t: number;
  max: number;
  r: number;
  color: string;
  text?: string;
  to?: number; // beam: fighter id at the far end
  from?: number;
  yaw?: number;
}

export interface InputState {
  move: [number, number]; // x = right, y = forward, camera relative
  camYaw: number;
  attack: boolean;
  dodge: boolean;
  jump: boolean;
  interact: boolean;
  skills: boolean[]; // six slots, pressed this frame
  ultHeld: boolean; // R is down (ultimates charge while it's held)
}

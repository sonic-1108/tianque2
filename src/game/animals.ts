// The wild things (and the village's own beasts): where they live and what they do. Pure logic, no three.js.
// Deer keep in herds and bolt together; rabbits and foxes dart off alone; a boar warns, then charges whoever comes
// too near; the ox grazes by the mill; the village dog trots after you while you're in the village.
// Only beasts near the player think (the rest stand still where they are), so a big map costs nothing.
import { WALL_R } from './village';
import { groundHeight, inBuilding, WATER_Y, VILLAGE_R } from './world';
import { DENS, DEN_R } from './foes';
import { WORLD_R, nearTq } from './layout';
import { ctWorld } from './court';
import { PLACES, placeAt } from './places';

export type AnimalKind = 'deer' | 'rabbit' | 'fox' | 'boar' | 'ox' | 'dog' | 'hen' | 'crane' | 'horse';
export interface AnimalSpec {
  file: string;
  name: string;
  /** standing height in metres (the model is scaled to it) */
  h: number;
  walk: number;
  run: number;
  /** a body that comes this near sends it off (0: never shy) */
  fear: number;
  /** how far from home it wanders */
  roam: number;
  /** the walk clip's pace at timescale 1 (m/s): the renderer plays it faster as the beast speeds up */
  stride: number;
}
export const ANIMALS: Record<AnimalKind, AnimalSpec> = {
  deer: { file: 'deer.glb', name: '梅花鹿', h: 1.45, walk: 1.1, run: 9.5, fear: 17, roam: 28, stride: 1.1 },
  rabbit: { file: 'rabbit.glb', name: '野兔', h: 0.42, walk: 0.7, run: 7.5, fear: 8, roam: 10, stride: 0.6 },
  fox: { file: 'fox.glb', name: '狐狸', h: 0.6, walk: 1.2, run: 8.5, fear: 13, roam: 34, stride: 1.0 },
  boar: { file: 'boar.glb', name: '野猪', h: 0.95, walk: 1.0, run: 7, fear: 0, roam: 22, stride: 1.0 },
  ox: { file: 'ox.glb', name: '老黄牛', h: 1.55, walk: 0.7, run: 2, fear: 0, roam: 9, stride: 0.9 },
  dog: { file: 'dog.glb', name: '大黄', h: 0.7, walk: 1.3, run: 5.5, fear: 0, roam: 14, stride: 1.1 },
  hen: { file: 'chicken.glb', name: '母鸡', h: 0.42, walk: 0.5, run: 3.5, fear: 3, roam: 9, stride: 0.45 },
  crane: { file: 'crane.glb', name: '仙鹤', h: 1.4, walk: 0.6, run: 2.6, fear: 7, roam: 16, stride: 0.6 },
  horse: { file: 'horse.glb', name: '驿马', h: 1.65, walk: 0.8, run: 3, fear: 0, roam: 5, stride: 1.0 },
};

export interface Animal {
  id: number;
  kind: AnimalKind;
  x: number;
  y: number;
  z: number;
  /** facing: forward is (sin yaw, cos yaw) */
  yaw: number;
  speed: number;
  home: [number, number];
  herd: number;
  state: 'graze' | 'walk' | 'flee' | 'warn' | 'charge' | 'follow';
  t: number;
  goal: [number, number];
  /** a call shown over it for a moment (汪, 哞, the boar's snort) */
  say: string;
  sayT: number;
  cool: number;
}

const rnd = (a: number, b = 0) => {
  const v = Math.sin(a * 127.1 + b * 311.7 + 17.3) * 43758.5453;
  return v - Math.floor(v);
};

/** somewhere a beast may stand: dry, open, not in a den, a building, the village (unless it lives there) or on 天阙 */
export function okSpot(x: number, z: number, village = false) {
  const r = Math.hypot(x, z);
  if (r > WORLD_R - 60) return false;
  if (!village && r < WALL_R + 8) return false;
  if (village && r > WALL_R - 3) return false;
  if (nearTq(x, z, 95)) return false;
  const y = groundHeight(x, z);
  if (y < WATER_Y + 0.4) return false;
  if (inBuilding(x, y + 0.5, z, 1.2)) return false;
  for (const d of DENS) if (Math.hypot(x - d.x, z - d.z) < DEN_R + 22) return false;
  // not on a cliff: the ground round about is about as high
  for (const [ox, oz] of [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) if (Math.abs(groundHeight(x + ox, z + oz) - y) > 1.4) return false;
  return true;
}

export function makeAnimals(): Animal[] {
  const out: Animal[] = [];
  let seed = 1;
  const add = (kind: AnimalKind, x: number, z: number, herd = -1, home?: [number, number]) => {
    const id = out.length;
    out.push({ id, kind, x, z, y: groundHeight(x, z), yaw: rnd(id, 9) * 6.28, speed: 0, home: home ?? [x, z], herd, state: 'graze', t: rnd(id, 4) * 5, goal: [x, z], say: '', sayT: 0, cool: 0 });
  };
  /** a spot in the ring [r0, r1] that passes okSpot */
  /** keeps its kind this far apart (each herd, each fox, each boar has its own ground) */
  const SPREAD: Record<AnimalKind, number> = { deer: 70, rabbit: 18, fox: 60, boar: 70, ox: 10, dog: 6, hen: 1.5, crane: 3, horse: 3 };
  const find = (r0: number, r1: number, kind: AnimalKind, village = false): [number, number] | null => {
    for (let k = 0; k < 80; k++, seed++) {
      const a = rnd(seed, 1) * Math.PI * 2, r = r0 + rnd(seed, 2) * (r1 - r0);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (out.some((o) => o.kind === kind && Math.hypot(o.home[0] - x, o.home[1] - z) < SPREAD[kind])) continue;
      if (okSpot(x, z, village)) return [x, z];
    }
    return null;
  };
  // deer: herds of three to five in the meadows and woods of the first rings
  for (let h = 0; h < 10; h++) {
    const c = find(110, 620, 'deer');
    if (!c) continue;
    const n = 3 + Math.floor(rnd(h, 7) * 3);
    for (let k = 0; k < n; k++) {
      const x = c[0] + (rnd(h * 9 + k, 3) - 0.5) * 9, z = c[1] + (rnd(h * 9 + k, 5) - 0.5) * 9;
      if (okSpot(x, z)) add('deer', x, z, h, c);
    }
  }
  for (let k = 0; k < 22; k++) {
    const c = find(45, 380, 'rabbit');
    if (c) add('rabbit', c[0], c[1]);
  }
  for (let k = 0; k < 8; k++) {
    const c = find(160, 700, 'fox');
    if (c) add('fox', c[0], c[1]);
  }
  for (let k = 0; k < 9; k++) {
    const c = find(260, 820, 'boar');
    if (c) add('boar', c[0], c[1]);
  }
  // the village's own: two oxen grazing outside the fence, two dogs inside it
  for (let k = 0; k < 2; k++) {
    const c = find(VILLAGE_R + 8, VILLAGE_R + 30, 'ox', true);
    if (c) add('ox', c[0], c[1]);
  }
  for (const [x, z] of [[8, 6], [-10, 4]] as const) if (okSpot(x, z, true)) add('dog', x, z);
  // hens pecking round the houses
  for (let k = 0; k < 9; k++) {
    const a = rnd(k, 21) * Math.PI * 2, r = 9 + rnd(k, 22) * 16;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (okSpot(x, z, true)) add('hen', x, z);
  }
  // the palace's cranes strolling its courtyard
  for (const [lx, lz] of [[-30, -16], [-24, -22], [30, -20], [26, -26]] as const) {
    const [x, z] = ctWorld(lx, lz);
    if (okSpot(x, z)) add('crane', x, z);
  }
  // a horse tethered at every waystation
  for (const p of PLACES) {
    if (p.kind !== 'inn') continue;
    const [x, z] = placeAt(p, -9.2, 5.5);
    if (okSpot(x, z)) add('horse', x, z);
  }
  return out;
}

export interface AnimalWorld {
  px: number;
  pz: number;
  /** the player is alive, outdoors, and can be seen */
  here: boolean;
  /** the player is swinging (scares everything near) */
  loud: boolean;
  /** the boar's tusks reach the player */
  gore(a: Animal): void;
}

const ANG = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const THINK_R = 150;

function setGoal(a: Animal, s: AnimalSpec) {
  for (let k = 0; k < 8; k++) {
    const t = Math.random() * Math.PI * 2, r = s.roam * (0.3 + Math.random() * 0.7);
    const x = a.home[0] + Math.cos(t) * r, z = a.home[1] + Math.sin(t) * r;
    if (okSpot(x, z, a.kind === 'dog' || a.kind === 'ox' || a.kind === 'hen')) {
      a.goal = [x, z];
      return true;
    }
  }
  return false;
}
function speak(a: Animal, text: string, t = 1.6) {
  a.say = text;
  a.sayT = t;
}

export function stepAnimals(list: Animal[], dt: number, w: AnimalWorld) {
  for (const a of list) {
    if (a.sayT > 0) a.sayT -= dt;
    // in someone's arms, or under the player
    if ((a as any).caught || (a as any).ridden || (a as any).dead) continue;
    const s = ANIMALS[a.kind];
    const dxp = w.px - a.x, dzp = w.pz - a.z;
    const dp = Math.hypot(dxp, dzp);
    if (dp > THINK_R) {
      a.speed = 0;
      continue;
    }
    a.t -= dt;
    a.cool -= dt;
    let want = 0; // speed it would like
    let face: number | null = null; // heading it would like
    // the shy ones: a body too near, or a fight nearby
    if (s.fear && w.here && a.state !== 'flee' && (dp < s.fear || (w.loud && dp < s.fear * 1.6))) {
      const flee = (b: Animal) => {
        b.state = 'flee';
        b.t = 2.5 + Math.random() * 2;
        b.yaw = Math.atan2(b.x - w.px, b.z - w.pz) + (Math.random() - 0.5) * 0.6;
      };
      flee(a);
      // a herd goes as one
      if (a.herd >= 0) for (const b of list) if (b.herd === a.herd && b !== a && b.state !== 'flee' && Math.hypot(b.x - a.x, b.z - a.z) < 18) flee(b);
    }
    switch (a.state) {
      case 'graze':
        if (a.kind === 'dog' && w.here && dp < 9 && Math.hypot(w.px, w.pz) < WALL_R) {
          a.state = 'follow';
          speak(a, '汪！');
          break;
        }
        if (a.kind === 'boar' && w.here && dp < 11 && a.cool <= 0) {
          a.state = 'warn';
          a.t = 0.9;
          speak(a, '哼哧！', 1.2);
          break;
        }
        if (a.kind === 'ox' && Math.random() < dt * 0.04) speak(a, '哞～', 2);
        if (a.kind === 'hen' && Math.random() < dt * 0.03) speak(a, '咯咯哒！', 1.4);
        if (a.kind === 'horse' && Math.random() < dt * 0.02) speak(a, '咴儿～', 1.6);
        if (a.t <= 0) {
          if (setGoal(a, s)) a.state = 'walk';
          a.t = 6 + Math.random() * 6;
        }
        break;
      case 'walk': {
        const gx = a.goal[0] - a.x, gz = a.goal[1] - a.z;
        const d = Math.hypot(gx, gz);
        if (d < 0.8 || a.t <= 0) {
          a.state = 'graze';
          a.t = 2 + Math.random() * 6;
          break;
        }
        want = s.walk;
        face = Math.atan2(gx, gz);
        if (a.kind === 'boar' && w.here && dp < 11 && a.cool <= 0) {
          a.state = 'warn';
          a.t = 0.9;
          speak(a, '哼哧！', 1.2);
        }
        break;
      }
      case 'flee':
        want = s.run;
        if (a.t <= 0) {
          a.state = 'graze';
          a.t = 1 + Math.random() * 3;
          // it settles where it ran to
          a.home = [a.x, a.z];
        }
        break;
      case 'warn':
        // pawing the ground, turned on you
        face = Math.atan2(dxp, dzp);
        if (a.t <= 0) {
          a.state = 'charge';
          a.t = 1.7;
        }
        break;
      case 'charge':
        want = s.run * 1.6;
        if (dp > 1.4) face = Math.atan2(dxp, dzp);
        if (w.here && dp < 1.5) {
          w.gore(a);
          a.state = 'flee';
          a.t = 2.5;
          a.cool = 9;
        } else if (a.t <= 0 || dp > 22) {
          a.state = 'graze';
          a.t = 2;
          a.cool = 6;
        }
        break;
      case 'follow': {
        const inVillage = Math.hypot(w.px, w.pz) < WALL_R;
        if (!w.here || dp > 16 || !inVillage) {
          a.state = 'graze';
          a.t = 3;
          a.home = [a.x, a.z];
          break;
        }
        face = Math.atan2(dxp, dzp);
        want = dp > 3.2 ? Math.min(s.run, s.walk + (dp - 3.2) * 1.5) : 0;
        if (Math.random() < dt * 0.12) speak(a, Math.random() < 0.5 ? '汪！' : '汪汪！');
        break;
      }
    }
    // turn toward the heading (quick when bolting), ease the speed
    if (face !== null) {
      const turn = a.state === 'flee' || a.state === 'charge' ? 9 : 3;
      a.yaw += ANG(face - a.yaw) * Math.min(1, dt * turn);
    }
    a.speed += (want - a.speed) * Math.min(1, dt * (want > a.speed ? 4 : 6));
    if (a.speed < 0.02) {
      a.speed = 0;
      continue;
    }
    // step, unless the way is blocked (water, a wall, a cliff, a den's palisade): then turn aside
    const nx = a.x + Math.sin(a.yaw) * a.speed * dt, nz = a.z + Math.cos(a.yaw) * a.speed * dt;
    const village = a.kind === 'dog' || a.kind === 'ox' || a.kind === 'hen';
    const ny = groundHeight(nx, nz);
    const blocked =
      ny < WATER_Y + 0.3 ||
      Math.abs(ny - a.y) > Math.max(0.5, a.speed * dt * 1.6) ||
      inBuilding(nx, ny + 0.4, nz, 0.4) ||
      Math.hypot(nx, nz) > WORLD_R - 40 ||
      (!village && Math.hypot(nx, nz) < WALL_R + 4) ||
      (village && Math.hypot(nx, nz) > WALL_R - 2);
    if (blocked) {
      a.yaw += (Math.random() < 0.5 ? 1 : -1) * (0.8 + Math.random());
      if (a.state === 'walk') a.state = 'graze';
      a.speed *= 0.3;
      continue;
    }
    a.x = nx;
    a.z = nz;
    a.y = ny;
  }
}

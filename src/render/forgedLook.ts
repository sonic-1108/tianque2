// How a forged weapon (game/forge.ts, mats.ts) shows in the hand: whatever the house holds takes the element's light,
// brighter stage by stage (一阶 a faint sheen, 三阶 a glowing edge and motes coming off it, 四阶 a halo round the blade,
// 五阶 the halo breathing and the element's 异象 crackling off the steel). Rig calls dressWeapon each frame for the
// player; Juice calls weaponMotes for the particles and takes the trail's colour from forgedColor.
import * as THREE from 'three';
import type { Sim } from '../game/sim';
import { houseOf, wielded } from '../game/forge';
import { fwArt, holdsLine } from '../game/mats';
import { propFrom } from './weapons';
import { EL, type El } from '../game/mats';
import type { VFXSystem } from './vfx/VFXSystem';

const GLOW = [0.22, 0.4, 0.65, 0.95, 1.35];
let glowTexture: THREE.Texture | null = null;
function glowTex() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}

/** the key of what the player wields ('' bare): Rig redresses only when it changes */
export const forgedKey = (sim: Sim) => {
  const w = wielded(sim.progress);
  return w ? `${w.el}:${w.n}` : '';
};
export const forgedColor = (sim: Sim) => {
  const w = wielded(sim.progress);
  return w ? EL[w.el].color : null;
};

/** the forged weapon's own Tripo model (mats.ts FW_ART) goes into the hands that hold that kind of weapon, in place of
 * what the body carried; the trail's sockets move to the model's length. Put back when it's laid down */
function swapModel(sim: Sim, held: THREE.Object3D[], base: THREE.Object3D | null, tip: THREE.Object3D | null) {
  const w = wielded(sim.progress);
  const art = w ? fwArt(w.el, w.n) : undefined;
  const want = w && art && holdsLine(houseOf(sim.progress), w.el) ? `${w.el}:${w.n}` : '';
  for (const h of held) {
    const hand = h.userData.hand;
    if (hand !== 'right' && hand !== 'left') continue;
    if ((h.userData.fwKey ?? '') === want) continue;
    h.userData.fwKey = want;
    const old = h.getObjectByName('fw-model');
    if (old) h.remove(old);
    for (const c of h.children) {
      if (c.name === 'fw-halo' || c === base || c === tip) continue;
      if (c.userData.fwShown === undefined) c.userData.fwShown = c.visible;
      c.visible = want ? false : c.userData.fwShown;
    }
    if (want && art) {
      const r = propFrom(art, (inner) =>
        inner.traverse((o: any) => {
          if (o.isMesh) {
            o.userData.fwArt = true;
            o.userData.weapon = true;
          }
        }),
      );
      r.group.name = 'fw-model';
      h.add(r.group);
    }
    if (hand === 'right' && base && tip) {
      if (base.userData.y0 === undefined) {
        base.userData.y0 = base.position.y;
        tip.userData.y0 = tip.position.y;
      }
      base.position.y = want && art ? art.len * 0.15 : base.userData.y0;
      tip.position.y = want && art ? art.len * (1 - art.grip) * 0.95 : tip.userData.y0;
    }
  }
}
/** a Tripo model's glow: its own colours lit from within (the bright inlays shine), not tinted */
const ART_GLOW = [0.05, 0.09, 0.16, 0.28, 0.42];

/** each frame: the held weapons' meshes take the element's light (their own materials kept to put back) and the halo
 * breathes. `held` are the weapon roots in the hands (Rig's userData.held), `blade` the trail's base and tip */
export function dressWeapon(sim: Sim, held: THREE.Object3D[] | undefined, base: THREE.Object3D | null, tip: THREE.Object3D | null, t: number) {
  if (!held?.length) return;
  swapModel(sim, held, base, tip);
  const w = wielded(sim.progress);
  const col = w ? new THREE.Color(EL[w.el].color) : null;
  const pulse = w && w.n >= 4 ? 0.75 + 0.25 * Math.sin(t * (w.n >= 5 ? 5 : 3)) : 1;
  for (const h of held)
    h.traverse((o: any) => {
      if (!o.isMesh || o.userData.halo) return;
      const ud = o.userData;
      if (!w) {
        if (ud.orig) {
          o.material = ud.orig;
          ud.orig = null;
        }
        return;
      }
      if (!ud.orig) {
        ud.orig = o.material;
        const m = (Array.isArray(o.material) ? o.material[0] : o.material)?.clone?.();
        if (!m) return;
        o.material = m;
        ud.base = m.color ? m.color.clone() : null;
        if (ud.fwArt && m.map) {
          m.emissiveMap = m.map;
          m.needsUpdate = true;
        }
      }
      const m = o.material as THREE.MeshStandardMaterial;
      if (ud.fwArt) {
        if (m.emissive) {
          m.emissive.copy(col!);
          m.emissiveIntensity = ART_GLOW[w.n - 1] * pulse;
        }
        return;
      }
      if (m.emissive) {
        m.emissive.copy(col!);
        m.emissiveIntensity = GLOW[w.n - 1] * pulse;
      }
      // the steel itself leans toward the element as the stages climb
      if (m.color && ud.base) m.color.copy(ud.base).lerp(col!, 0.12 + 0.07 * w.n);
    });
  // the halo along the blade (四阶 up)
  const host = held[0];
  let halo = host.getObjectByName('fw-halo') as THREE.Sprite | undefined;
  if (w && w.n >= 4) {
    if (!halo) {
      halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      halo.name = 'fw-halo';
      halo.userData.halo = true;
      host.add(halo);
    }
    const a = base?.position ?? new THREE.Vector3(0, 0.15, 0), b = tip?.position ?? new THREE.Vector3(0, 0.7, 0);
    halo.position.copy(a).add(b).multiplyScalar(0.5);
    const len = Math.max(0.35, a.distanceTo(b));
    halo.scale.setScalar(len * (w.n >= 5 ? 1.7 : 1.25) * (0.85 + 0.15 * pulse));
    (halo.material as THREE.SpriteMaterial).color.copy(col!);
    (halo.material as THREE.SpriteMaterial).opacity = w.n >= 5 ? 0.75 : 0.5;
    halo.visible = true;
  } else if (halo) halo.visible = false;
}

const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
let acc = 0, arcT = 0;
/** motes off the blade from the third stage (more at the fourth and fifth), the 异象's flourish at the fifth. `a` and
 * `b` the blade's base and tip in the world (null: no blade, the motes come off the hands) */
export function weaponMotes(vfx: VFXSystem, sim: Sim, a: THREE.Vector3 | null, b: THREE.Vector3 | null, dt: number) {
  const w = wielded(sim.progress);
  if (!w || w.n < 3 || sim.player.hp <= 0) return;
  const p = sim.player;
  if (!a || !b) {
    a = va.set(p.pos[0], p.pos[1] + 1.0, p.pos[2]);
    b = vb.set(p.pos[0] - Math.sin(p.yaw) * 0.4, p.pos[1] + 1.2, p.pos[2] - Math.cos(p.yaw) * 0.4);
  }
  const col = EL[w.el].color;
  acc += dt * (w.n >= 5 ? 26 : w.n >= 4 ? 14 : 7);
  while (acc >= 1) {
    acc -= 1;
    const at = vc.copy(a).lerp(b, 0.25 + Math.random() * 0.75);
    mote(vfx, w.el, at, col);
  }
  // 五阶: the element shows itself on the steel now and then
  arcT -= dt;
  if (w.n >= 5 && arcT <= 0) {
    arcT = 0.35 + Math.random() * 0.5;
    flourish(vfx, w.el, a, b, col);
  }
}
const DOWN = new THREE.Vector3(0, -1, 0), UPV = new THREE.Vector3(0, 1, 0);
function mote(vfx: VFXSystem, el: El, at: THREE.Vector3, col: string) {
  switch (el) {
    case 'fire':
      vfx.embers(at, 1, Math.random() < 0.3 ? '#ffd27a' : col, 0.05, 1.6, 0.06);
      break;
    case 'ice':
      vfx.embers(at, 1, Math.random() < 0.5 ? '#ffffff' : col, 0.08, 0.25, 0.05);
      break;
    case 'thunder':
      vfx.sparkBurst(at, 1, Math.random() < 0.5 ? '#eef2ff' : col, 2.5, 0.04);
      break;
    case 'wind':
      vfx.embers(at, 1, col, 0.15, 0.9, 0.05);
      break;
    case 'venom':
      vfx.sparkBurst(at, 1, col, 1.2, 0.05, DOWN, 0.25);
      break;
    case 'metal':
      vfx.embers(at, 1, Math.random() < 0.4 ? '#fff3c4' : col, 0.05, 0.6, 0.045);
      break;
    case 'earth':
      vfx.embers(at, 1, Math.random() < 0.5 ? '#8a6a48' : col, 0.08, 0.3, 0.06);
      break;
    case 'wood':
      vfx.embers(at, 1, Math.random() < 0.3 ? '#f9a8d4' : col, 0.12, 0.7, 0.06);
      break;
    case 'water':
      vfx.sparkBurst(at, 1, Math.random() < 0.5 ? '#dff4ff' : col, 1, 0.05, DOWN, 0.4);
      break;
  }
}
function flourish(vfx: VFXSystem, el: El, a: THREE.Vector3, b: THREE.Vector3, col: string) {
  const mid = vc.copy(a).lerp(b, 0.5);
  switch (el) {
    case 'thunder': // a crackle along the steel
      vfx.kitBeam(a.clone(), b.clone(), 0.12, col, 0.12, 'fushi');
      break;
    case 'fire': // a lick of flame off the edge
      vfx.embers(mid, 6, '#ffb347', 0.12, 2.4, 0.08);
      break;
    case 'ice': // frost breath falling off it
      vfx.dustPuff(mid.clone(), 2, 0.15, 0.4, 0.35, '#e8f8ff');
      break;
    case 'wind': // a twist of air round the blade
      vfx.spiral(mid.clone(), 0.35, Math.random() * 6, col);
      break;
    case 'venom': // a green breath
      vfx.dustPuff(mid.clone(), 2, 0.12, 0.5, 0.35, '#3f6f2a');
      break;
    case 'metal': // a glint running up the edge
      vfx.flash(b.clone(), '#fff3c4', 2, 0.12, 3);
      vfx.sparkBurst(b.clone(), 3, '#fff3c4', 2, 0.05, UPV, 0.6);
      break;
    case 'earth': // grit shaken off
      vfx.rocks(mid.clone(), 2, 1.5, 0.04);
      break;
    case 'wood': // petals
      vfx.embers(mid, 3, '#f9a8d4', 0.2, 0.5, 0.07);
      break;
    case 'water': // a ring of droplets
      vfx.ring(mid.clone(), 0.3, col, 0.35, 0.04, 0);
      break;
  }
}

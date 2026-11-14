// The feel of every move: the old game's effect system (sparks, embers, dust, slash marks, damage numbers, the
// weapon's ribbon, the monk's palms and bell, the emperor's dragon, guards, walls and seal), its sound engine,
// camera shake and FOV punch. The sim says what to show (sim.vq: the old game's vfx.* calls by name, sim.events,
// sim.fx); this turns that into the effect system's calls each frame, and keeps the projectiles' meshes.
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { Sim, SimEvent, VCmd } from '../game/sim';
import { PLAYER } from '../game/sim';
import { VFXSystem } from './vfx/VFXSystem';
import { sfx } from '../audio/audio';
import { swordSockets } from './Rig';
import type { Fx, Projectile } from '../game/types';
import { questTarget } from '../game/quests';
import { groundHeight } from '../game/world';
import { animateShot, disposeShot, shotMesh } from './shotLook';
import { KitAuras } from './KitAuras';

/** camera trauma (0..1) and FOV punch the camera loop reads */
export const juice = { trauma: 0, kick: 0, push: 0, px: 0, pz: 0 };

const UP = new THREE.Vector3(0, 1, 0);
const SOUND_ALIAS: Record<string, string> = { click: 'wood', fanfare: 'ultRise' };

/** a full-screen flash (天崩, 万佛朝宗's last palm, 血怒): one div over the canvas */
function screenFlash(color: string) {
  if (typeof document === 'undefined') return;
  let d = document.getElementById('tq-flash') as HTMLDivElement | null;
  if (!d) {
    d = document.createElement('div');
    d.id = 'tq-flash';
    d.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;opacity:0;transition:opacity 0.45s ease-out;';
    document.body.appendChild(d);
  }
  d.style.transition = 'none';
  d.style.background = color;
  d.style.opacity = '1';
  void d.offsetWidth;
  d.style.transition = 'opacity 0.45s ease-out';
  d.style.opacity = '0';
}

/** a little gold Rolex for 甩劳力士 (bezel, face, strap) */
function buildWatch() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: '#e6c25a', metalness: 1, roughness: 0.22, emissive: '#3a2a00', emissiveIntensity: 0.6 });
  const face = new THREE.MeshStandardMaterial({ color: '#0f3d2a', metalness: 0.4, roughness: 0.2 });
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 10, 28), gold));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 28).rotateX(Math.PI / 2), face));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.2, 0.03).translate(0, 0.25, 0), gold));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.2, 0.03).translate(0, -0.25, 0), gold));
  g.scale.setScalar(1.6);
  g.visible = false;
  return g;
}

export function Juice({ sim }: { sim: Sim }) {
  const vfx = useMemo(() => new VFXSystem(), []);
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera);
  const trail = useMemo(() => vfx.createTrail('#dff3ff'), [vfx]);
  const seen = useRef(new WeakSet<Fx>());
  const stepT = useRef(0);
  const lastT = useRef(sim.time);
  const v = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3() }), []);
  // sim keys -> effect handles (dragons, spectral charges, cages)
  const keys = useRef(new Map<number, number>());
  const charges = useRef<{ k: number; key: number; until: number }[]>([]);
  // projectile id -> its mesh
  const projObj = useRef(new Map<number, THREE.Object3D>());
  // the kit's shots with a look of their own (arrows, stones, talismans, notes, qi)
  const lookObj = useRef(new Map<number, THREE.Object3D>());
  const lookRoot = useMemo(() => new THREE.Group(), []);
  const watches = useMemo(() => Array.from({ length: 8 }, buildWatch), []);
  const glyphsSent = useRef(new Set<number>());
  useEffect(() => vfx.setViewportHeight(size.height), [vfx, size.height]);
  useEffect(() => void ((globalThis as any).__T2_VFX = vfx), [vfx]); // for the effect tests
  // the quest beacon: a tall golden pillar of light over wherever the story wants you
  const beacon = useMemo(() => {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 160, 16, 1, true).translate(0, 80, 0),
      new THREE.MeshBasicMaterial({ color: '#ffd36a', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }),
    );
    m.renderOrder = 5;
    return m;
  }, []);
  useEffect(() => () => vfx.dispose(), [vfx]);

  useFrame((state, dt) => {
    const p = sim.player;
    const near = (x: number, z: number, r = 70) => Math.abs(x - p.pos[0]) < r && Math.abs(z - p.pos[2]) < r;
    for (const e of sim.events.splice(0)) handle(e, near(e.x, e.z, 45));
    for (const c of sim.vq.splice(0)) run(c);
    // the sim's little effects: texts, rings, slashes
    for (const x of sim.fx) {
      if (seen.current.has(x)) continue;
      seen.current.add(x);
      if (!near(x.x, x.z)) continue;
      v.a.set(x.x, x.y, x.z);
      if (x.kind === 'text') vfx.damageNumber(v.a, x.text ?? '', /暴击|升级|!|！/.test(x.text ?? '') || x.r > 1, x.color);
      else if (x.kind === 'ring') vfx.ring(v.a, x.r, x.color, x.max, 0.16, 0.08);
      else if (x.kind === 'slash') vfx.slashMark(v.a, x.color, x.r * 0.9, 0.16);
      else if (x.kind === 'burst') {
        vfx.sparkBurst(v.a, Math.round(6 + x.r * 8), x.color, 4 + x.r * 2, 0.1);
        vfx.embers(v.a, Math.round(3 + x.r * 3), x.color, x.r * 0.6, 2, 0.08);
      }
    }
    // the spectral guards run over the ground
    charges.current = charges.current.filter((c) => c.until > sim.time);
    for (const c of charges.current)
      for (let g = 0; g < 5; g++) {
        if (vfx.emperor.imperial.guardStopped(c.k, g)) continue;
        vfx.emperor.imperial.guardAhead(c.k, g, v.c);
        vfx.emperor.imperial.setGuardY(c.k, g, groundHeight(v.c.x, v.c.z));
      }
    vfx.emperor.imperial.setView(camera.position, v.d.set(p.pos[0], p.pos[1] + 1.2, p.pos[2]));
    drawProjectiles(state.clock.elapsedTime);
    // what's on people: rage, the golden bell, daydreams, being pinned or sealed
    for (const f of sim.fighters) {
      if (f.hp <= 0 || !near(f.pos[0], f.pos[2], 50)) continue;
      v.b.set(f.pos[0], f.pos[1] + 1, f.pos[2]);
      vfx.followFighter(sim.slotOf(f), v.b);
      if (f.st.rage > 0 && Math.random() < dt * 30) vfx.embers(v.b, 1, Math.random() < 0.5 ? '#ff3b1f' : '#ff9a3a', 0.5, 2.5, 0.08);
      if (f.st.shield > 0 && Math.random() < dt * 14) vfx.embers(v.b, 1, '#ffd36a', 0.7, 1, 0.07);
      if (f.st.silence > 0 && Math.random() < dt * 6) vfx.embers(v.c.set(f.pos[0], f.pos[1] + 2.2, f.pos[2]), 1, '#fbbf24', 0.3, 0.6, 0.07);
      if (f.st.protect > 0 && Math.random() < dt * 8) vfx.embers(v.b, 1, '#bbf7d0', 0.6, 1.4, 0.07);
      if ((f.st.root > 0 || f.st.kneel > 0) && Math.random() < dt * 4) vfx.ring(v.c.set(f.pos[0], f.pos[1] + 0.08, f.pos[2]), 0.9, f.st.kneel > 0 ? '#ffd36a' : '#5eead4', 0.4, 0.1);
    }
    // the player's blade leaves a ribbon while it swings
    const swinging = p.act === 'attack' || p.act === 'cast';
    if (swordSockets.base && swordSockets.tip && swinging) {
      swordSockets.base.getWorldPosition(v.c);
      swordSockets.tip.getWorldPosition(v.d);
      trail.update(dt, v.c, v.d, state.clock.elapsedTime);
    } else trail.update(dt, null, null, state.clock.elapsedTime);
    // footsteps
    if (p.act === 'run' && p.grounded) {
      stepT.current -= dt * Math.max(0.6, Math.hypot(p.vel[0], p.vel[2]) / 6);
      if (stepT.current <= 0) {
        stepT.current = 0.34;
        sfx('step');
      }
    }
    const qt = questTarget(sim);
    beacon.visible = !!qt && Math.hypot(qt[0] - p.pos[0], qt[1] - p.pos[2]) > 8;
    if (qt) {
      beacon.position.set(qt[0], groundHeight(qt[0], qt[1]), qt[1]);
      (beacon.material as THREE.MeshBasicMaterial).opacity = 0.16 + Math.sin(state.clock.elapsedTime * 2) * 0.06;
    }
    // effects run on the sim's clock, so they stay in step with the blows they show (and freeze with hit-stop)
    const sdt = Math.max(0, Math.min(0.1, sim.time - lastT.current));
    lastT.current = sim.time;
    vfx.update(sdt);
    juice.trauma = Math.max(0, juice.trauma - dt * 1.8);
    juice.kick *= Math.exp(-dt * 9);
    juice.push *= Math.exp(-dt * 14);
  });

  /** darts, pins, knives and boomerangs: the old game's meshes; Rolexes; the mantra's words go to the monk effects */
  function drawProjectiles(time: number) {
    const live = new Set<number>();
    let w = 0;
    for (const pr of sim.proj) {
      const id = pr.id ?? -1;
      live.add(id);
      if (pr.look) {
        let o = lookObj.current.get(id);
        if (!o) {
          o = shotMesh(pr.look, pr.color, pr.radius);
          lookRoot.add(o);
          lookObj.current.set(id, o);
        }
        o.visible = (pr.delay ?? 0) <= 0;
        o.position.set(pr.pos[0], pr.pos[1], pr.pos[2]);
        if (pr.vel[0] * pr.vel[0] + pr.vel[1] * pr.vel[1] + pr.vel[2] * pr.vel[2] > 0.01) o.lookAt(v.c.set(pr.pos[0] - pr.vel[0], pr.pos[1] - pr.vel[1], pr.pos[2] - pr.vel[2]));
        animateShot(o, pr.look, time, id);
        if (pr.look !== 'arrow' && pr.look !== 'rock' && Math.random() < 0.5 && Math.abs(pr.pos[0] - sim.player.pos[0]) < 60) vfx.dartTrail(v.a.set(pr.pos[0], pr.pos[1], pr.pos[2]), pr.color);
        continue;
      }
      if (pr.shape === 'glyph') {
        if (!glyphsSent.current.has(id)) {
          glyphsSent.current.add(id);
          const t = pr.target !== undefined ? sim.fighters[pr.target] : null;
          if (t) vfx.glyph(pr.glyph ?? 0, v.a.set(pr.pos[0], pr.pos[1], pr.pos[2]), v.b.set(pr.vel[0], pr.vel[1], pr.vel[2]), sim.slotOf(t));
        }
        continue;
      }
      if (pr.shape === 'watch') {
        const m = watches[w++];
        if (!m) continue;
        m.visible = (pr.delay ?? 0) <= 0;
        m.position.set(pr.pos[0], pr.pos[1], pr.pos[2]);
        m.rotation.set(time * 18, time * 12.6, 0);
        continue;
      }
      let o = projObj.current.get(id);
      if (!o) {
        const kind = pr.shape === 'pin' ? 'pin' : pr.shape === 'boomerang' ? 'boomerang' : 'dart';
        o = vfx.takeProjectile(kind, pr.color) ?? undefined;
        if (!o) continue;
        if (pr.shape === 'knife') o.scale.setScalar(1.8); // 影刃's knives: big enough to see coming
        projObj.current.set(id, o);
      }
      o.position.set(pr.pos[0], pr.pos[1], pr.pos[2]);
      if (pr.shape === 'boomerang') {
        const sp = o.getObjectByName('spin');
        if (sp) sp.rotation.y = time * 28;
        o.rotation.z = pr.path && pr.path.u < 0.5 ? -0.35 : 0.35;
      } else if (pr.stuck === undefined) {
        o.lookAt(v.c.set(pr.pos[0] - pr.vel[0], pr.pos[1] - pr.vel[1], pr.pos[2] - pr.vel[2]));
        const tassel = o.getObjectByName('tassel');
        if (tassel) {
          tassel.rotation.x = Math.sin(time * 42 + id) * 0.14;
          tassel.rotation.y = Math.cos(time * 35 + id * 1.7) * 0.14;
        }
      }
      if (pr.stuck === undefined && Math.random() < 0.3 && Math.abs(pr.pos[0] - sim.player.pos[0]) < 60) vfx.dartTrail(v.a.set(pr.pos[0], pr.pos[1], pr.pos[2]), pr.color);
    }
    for (; w < watches.length; w++) watches[w].visible = false;
    for (const [id, o] of projObj.current)
      if (!live.has(id)) {
        vfx.releaseProjectile(o);
        projObj.current.delete(id);
      }
    for (const [id, o] of lookObj.current)
      if (!live.has(id)) {
        lookRoot.remove(o);
        disposeShot(o);
        lookObj.current.delete(id);
      }
    if (glyphsSent.current.size > 200) for (const id of glyphsSent.current) if (!live.has(id)) glyphsSent.current.delete(id);
  }

  /** one of the sim's effect commands */
  function run(c: VCmd) {
    const a = c.a;
    const vec = (x: any, out = new THREE.Vector3()) => (Array.isArray(x) && x.length === 3 ? out.set(x[0], x[1], x[2]) : x === 'up' ? UP.clone() : x);
    // far from the player: nothing to see (but the emperor's things keep their bookkeeping)
    const pos0 = Array.isArray(a[0]) && a[0].length === 3 ? a[0] : Array.isArray(a[1]) && a[1].length === 3 ? a[1] : null;
    const far = !!pos0 && (Math.abs(pos0[0] - sim.player.pos[0]) > 80 || Math.abs(pos0[2] - sim.player.pos[2]) > 80);
    switch (c.n) {
      case 'shake':
        juice.trauma = Math.min(1, juice.trauma + a[0] * 0.8);
        return;
      case 'sound':
        if (sim.player) sfx((SOUND_ALIAS[a[0]] ?? a[0]) as Parameters<typeof sfx>[0]);
        return;
      case 'screenFlash':
        screenFlash(a[0]);
        return;
      case 'emp.edict':
        if (!far) vfx.emperor.imperial.edict(vec(a[0]), a[1]);
        return;
      case 'emp.charge': {
        const k = vfx.emperor.imperial.charge(vec(a[1]), a[2], a[3]);
        keys.current.set(a[0], k);
        charges.current.push({ k, key: a[0], until: sim.time + a[3] + 0.6 });
        return;
      }
      case 'emp.stopGuard': {
        const k = keys.current.get(a[0]);
        if (k !== undefined) vfx.emperor.imperial.stopGuard(k, a[1], a[2]);
        return;
      }
      case 'emp.cage': {
        const k = vfx.emperor.imperial.cage(vec(a[1]), a[2], a[3]);
        keys.current.set(a[0], k);
        return;
      }
      case 'emp.cageOwner': {
        const k = keys.current.get(a[0]);
        if (k !== undefined) vfx.emperor.imperial.cageOwner(k, a[1] ? vec(a[1]) : null);
        return;
      }
      case 'emp.fan':
        if (!far) vfx.emperor.fan(vec(a[0]), a[1], a[2], a[3], a[4]);
        return;
      case 'emp.seal': {
        if (far) return;
        const p0 = vec(a[0]).clone();
        vfx.emperor.imperial.seal(p0, a[1], () => {
          const p = new THREE.Vector3(p0.x, p0.y + 0.1, p0.z);
          vfx.ring(p, 1.4, '#ffffff', 0.25, 0.35, 1);
          vfx.ring(p, 2.8, '#4fe0a0', 0.6, 0.2, 0.4);
          vfx.ring(p, 4.8, '#ffd36a', 0.8, 0.06);
          vfx.flash(new THREE.Vector3(p.x, p.y + 1.2, p.z), '#7affc0', 110, 0.4, 14);
          vfx.sparkBurst(new THREE.Vector3(p.x, p.y + 0.4, p.z), 80, '#6affb0', 11, 0.12, UP, 1.5);
          vfx.sparkBurst(new THREE.Vector3(p.x, p.y + 0.4, p.z), 40, '#ffd36a', 9, 0.1, UP, 1.5);
          vfx.rocks(p, 28, 8, 0.13);
          vfx.dustPuff(p, 40, 2.2, 5, 1.1, '#cfc0a0');
          vfx.decal(p, 4.5, 3);
          vfx.damageNumber(new THREE.Vector3(p.x, p.y + 2.4, p.z), '受命于天', true, '#ffd36a');
          sfx('boom');
        });
        return;
      }
      case 'kitShow': {
        // a = [kind, origin, target, yaw, dur, color, caster id]
        const id = a[6];
        vfx.show.play(a[0], vec(a[1]).clone(), vec(a[2]).clone(), a[3], a[4], a[5], () => {
          const f = sim.fighters[id];
          return f && f.hp > 0 ? new THREE.Vector3(f.pos[0], f.pos[1], f.pos[2]) : null;
        });
        return;
      }
      case 'emp.dragon': {
        const target = vec(a[2]).clone();
        const k = vfx.emperor.summonDragon(vec(a[1]).clone(), target, a[3], a[4], () => {
          const p = new THREE.Vector3(target.x, target.y + 0.08, target.z);
          vfx.ring(p, 1.6, '#ffffff', 0.25, 0.35, 1);
          vfx.ring(p, 3.6, '#ffcf5a', 0.6, 0.18, 0.4);
          vfx.ring(p, 5.7, '#ff8a1a', 0.9, 0.06);
          vfx.flash(new THREE.Vector3(p.x, p.y + 1.5, p.z), '#ffd36a', 140, 0.5, 16);
          vfx.sparkBurst(new THREE.Vector3(p.x, p.y + 0.3, p.z), 90, '#ffcf5a', 12, 0.13, UP, 1.5);
          vfx.embers(p, 40, '#ffb347', 2.2, 4, 0.09);
          vfx.rocks(p, 24, 8, 0.12);
          vfx.dustPuff(p, 36, 2, 5, 1, '#d8c49a');
          for (let k2 = 0; k2 < 6; k2++) {
            const ang = (k2 / 6) * Math.PI * 2;
            vfx.fireColumn(new THREE.Vector3(p.x + Math.cos(ang) * 2.2, p.y, p.z + Math.sin(ang) * 2.2), 1.8, '#ffb02a');
          }
          sfx('boom');
        }, a[5]);
        keys.current.set(a[0], k);
        (keys.current as any)['t' + a[0]] = target;
        return;
      }
      case 'emp.retarget': {
        const k = keys.current.get(a[0]);
        const t: THREE.Vector3 | undefined = (keys.current as any)['t' + a[0]];
        if (t) t.set(a[1][0], a[1][1], a[1][2]);
        if (k !== undefined) vfx.emperor.retarget(k, vec(a[1]));
        return;
      }
    }
    if (far) return;
    const fn = (vfx as any)[c.n];
    if (typeof fn !== 'function') return;
    // the effect system keeps some vectors it's given: fresh ones every call
    fn.apply(vfx, a.map((x) => vec(x)));
  }

  function handle(e: SimEvent, close: boolean) {
    const mine = e.id === PLAYER || e.to === PLAYER;
    v.a.set(e.x, e.y, e.z);
    switch (e.k) {
      case 'hit': {
        if (!close) return;
        const att = sim.fighters[e.id ?? -1];
        v.b.set(e.x - (att?.pos[0] ?? e.x), 0, e.z - (att?.pos[2] ?? e.z)).normalize();
        vfx.hitImpact(v.a, v.b, !!e.heavy, e.to === PLAYER ? '#ff3b2b' : e.color ?? '#ffb347');
        sfx(e.heavy ? 'hitHeavy' : 'hitLight');
        if (e.to === PLAYER) juice.trauma = Math.min(1, juice.trauma + (e.heavy ? 0.45 : 0.2));
        else if (e.id === PLAYER) {
          juice.trauma = Math.min(1, juice.trauma + (e.heavy ? 0.42 : 0.17));
          juice.kick = e.heavy ? -5 : -1.4;
          // the blow's line: the camera nudges the way the foe is knocked
          juice.push = e.heavy ? 0.35 : 0.12;
          juice.px = v.b.x;
          juice.pz = v.b.z;
        }
        if (e.crit) sfx('perfect');
        return;
      }
      case 'kill':
        if (!close) return;
        vfx.dustPuff(v.a, 10, 0.6, 2.5, 0.9);
        vfx.sparkBurst(v.a, 18, '#fff1c4', 6, 0.1);
        if (mine) {
          sfx('gong');
          juice.trauma = Math.min(1, juice.trauma + 0.3);
        }
        return;
      case 'swing':
        if (close) sfx(e.heavy ? 'swingHeavy' : 'swingLight');
        return;
      case 'cast':
        if (close && e.id === PLAYER) juice.kick = -2;
        return;
      case 'dodge':
        if (close) {
          sfx('dodge');
          vfx.dustPuff(v.a, 6, 0.4, 2, 0.6);
        }
        return;
      case 'jump':
        if (e.id === PLAYER) sfx('jump');
        return;
      case 'land':
        if (close) {
          sfx(e.heavy ? 'slam' : 'land');
          vfx.dustPuff(v.a, e.heavy ? 12 : 4, e.heavy ? 0.8 : 0.4, 2, e.heavy ? 1 : 0.6);
          if (e.heavy && e.id === PLAYER) juice.trauma = Math.min(1, juice.trauma + 0.25);
        }
        return;
      case 'level':
        sfx('gong');
        setTimeout(() => sfx('chime'), 250);
        vfx.embers(v.a.setY(e.y + 1), 40, '#ffe08a', 1, 3.5, 0.1);
        vfx.ring(v.a.setY(e.y + 0.1), 4, '#ffe08a', 0.8, 0.2, 0.2);
        return;
    }
  }

  return (
    <>
      <primitive object={vfx.root} />
      <primitive object={beacon} />
      <primitive object={lookRoot} />
      <KitAuras sim={sim} vfx={vfx} />
      {watches.map((w, i) => (
        <primitive key={i} object={w} />
      ))}
    </>
  );
}

export type { Projectile };

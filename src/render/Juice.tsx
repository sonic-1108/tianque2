// The feel of a hit: the old game's effect system (sparks, embers, dust, slash marks, damage numbers, the weapon's
// ribbon trail), its sound engine, camera shake and FOV punch, all driven by the sim's events each frame.
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { Sim, SimEvent } from '../game/sim';
import { PLAYER } from '../game/sim';
import { SKILLS } from '../game/skills';
import { VFXSystem } from './vfx/VFXSystem';
import { sfx } from '../audio/audio';
import { cam } from './Scene';
import { swordSockets } from './Rig';
import type { Fx } from '../game/types';
import { questTarget } from '../game/quests';
import { groundHeight } from '../game/world';

/** camera trauma (0..1) and FOV punch the camera loop reads */
export const juice = { trauma: 0, kick: 0 };

const SECT_SOUND: Record<string, Parameters<typeof sfx>[0][]> = {
  kuangren: ['slam', 'whirl', 'charge'],
  anqi: ['throwDart', 'throwFan', 'dodge'],
  fanyin: ['gong', 'chime', 'chime'],
  yingren: ['dodge', 'throwFan', 'wood'],
  tianzi: ['gong', 'boom', 'slam'],
  jiaoyi: ['throwHeavy', 'chime', 'jump'],
  dixian: ['chime', 'poison', 'chime'],
};

export function Juice({ sim }: { sim: Sim }) {
  const vfx = useMemo(() => new VFXSystem(), []);
  const size = useThree((s) => s.size);
  const trail = useMemo(() => vfx.createTrail('#dff3ff'), [vfx]);
  const seen = useRef(new WeakSet<Fx>());
  const stepT = useRef(0);
  const v = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3() }), []);
  useEffect(() => vfx.setViewportHeight(size.height), [vfx, size.height]);
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
    const near = (e: { x: number; z: number }) => Math.hypot(e.x - p.pos[0], e.z - p.pos[2]) < 45;
    for (const e of sim.events.splice(0)) handle(e, near(e));
    // the sim's little effects: show each once through the effect system
    for (const x of sim.fx) {
      if (seen.current.has(x)) continue;
      seen.current.add(x);
      if (Math.hypot(x.x - p.pos[0], x.z - p.pos[2]) > 70 && x.kind !== 'beam') continue;
      v.a.set(x.x, x.y, x.z);
      if (x.kind === 'text') vfx.damageNumber(v.a, x.text ?? '', /暴击|升级|!/.test(x.text ?? '') || x.r > 1, x.color);
      else if (x.kind === 'ring') vfx.ring(v.a, x.r, x.color, x.max, 0.16, 0.08);
      else if (x.kind === 'burst') {
        const c = x.color.toLowerCase();
        if (c === '#ff6a1a' && x.r >= 3.5) vfx.ultimateImpact(v.a); // 天崩
        else if (c === '#ff6a1a') vfx.fireColumn(v.a, 1.8); // 裂地斩's crack
        else if (c === '#f5b942' && x.r > 1.4) vfx.palmStrike(v.a, x.r * 0.45, 0.3); // 金刚掌 / 万佛朝宗
        else if (c === '#c9a24a') vfx.groundSlam(v.a, 1.4, '#ffd36a'); // 玉玺落地
        else if (c === '#ef4444') vfx.groundSlam(v.a, x.r * 0.5, '#ef4444'); // K 线砸地
        else if (c === '#8b6b45') vfx.rocks(v.a, x.r > 1 ? 14 : 3, x.r > 1 ? 8 : 3, 0.1); // 遁地 earth
        else {
          vfx.sparkBurst(v.a, Math.round(6 + x.r * 8), x.color, 4 + x.r * 2, 0.1);
          vfx.embers(v.a, Math.round(3 + x.r * 3), x.color, x.r * 0.6, 2, 0.08);
        }
        if (x.r > 1.2) vfx.dustPuff(v.a, 5, x.r * 0.4, 2, 0.8);
      } else if (x.kind === 'slash') vfx.slashMark(v.a, x.color, x.r * 0.9, 0.16);
    }
    // projectiles leave sparkling trails
    for (const pr of sim.proj) {
      if (Math.abs(pr.pos[0] - p.pos[0]) > 60 || Math.abs(pr.pos[2] - p.pos[2]) > 60) continue;
      v.b.set(pr.pos[0], pr.pos[1], pr.pos[2]);
      vfx.dartTrail(v.b, pr.color);
      if (pr.shape === 'guard' || pr.shape === 'orb') vfx.embers(v.b, 1, pr.color, 0.5, 1, 0.1);
      if (pr.shape === 'glyph' && Math.random() < 0.5) vfx.embers(v.b, 1, '#ffd36a', 0.2, 0.5, 0.08);
    }
    // what's on people: rage, the golden bell, daydreams, being pinned, running moves
    for (const f of sim.fighters) {
      if (f.hp <= 0 || Math.abs(f.pos[0] - p.pos[0]) > 50 || Math.abs(f.pos[2] - p.pos[2]) > 50) continue;
      v.b.set(f.pos[0], f.pos[1] + 1, f.pos[2]);
      const slot = f.id === PLAYER ? 0 : 1 + (f.id % 11);
      vfx.followFighter(slot, v.b);
      if (f.st.rage > 0 && Math.random() < dt * 30) vfx.embers(v.b, 1, Math.random() < 0.5 ? '#ff3b1f' : '#ff9a3a', 0.5, 2.5, 0.08);
      if (f.st.shield > 0 && Math.random() < dt * 14) vfx.embers(v.b, 1, '#ffd36a', 0.7, 1, 0.07);
      if (f.st.daze > 0 && Math.random() < dt * 8) vfx.embers(v.c.set(f.pos[0], f.pos[1] + 2.3, f.pos[2]), 1, '#4ade80', 0.4, 1, 0.08);
      if ((f.st.root > 0 || f.st.kneel > 0) && Math.random() < dt * 4) vfx.ring(v.c.set(f.pos[0], f.pos[1] + 0.08, f.pos[2]), 0.9, f.st.kneel > 0 ? '#ffd36a' : '#f472b6', 0.4, 0.1);
      const run = f.run?.id;
      if (run === 'whirlwind_blade') vfx.spiral(v.b, 2.6, sim.time * 14, '#ff8a5a');
      else if (run === 'bull_charge' && Math.random() < 0.6) {
        v.c.set(-Math.sin(f.yaw), 0, -Math.cos(f.yaw));
        vfx.chargeWave(v.b, v.c, '#ffb15a');
        vfx.dustPuff(v.d.set(f.pos[0], f.pos[1], f.pos[2]), 2, 0.4, 2, 0.6);
      } else if (run === 'burrow' && Math.random() < 0.5) vfx.dustPuff(v.c.set(f.pos[0], f.pos[1], f.pos[2]), 2, 0.4, 1.5, 0.6, '#8b6b45');
      else if (run === 'fold_earth') vfx.embers(v.b, 3, '#86efac', 0.4, 0.5, 0.08);
      else if ((run === 'qingfeng' || run === 'six_syllable_mantra' || run === 'ten_thousand_buddhas') && Math.random() < 0.5) vfx.embers(v.b, 2, run === 'qingfeng' ? '#86efac' : '#ffd36a', 0.9, 1.5, 0.08);
      else if (run === 'drain_surplus' || run === 'short_sell') {
        const t = sim.fighters[f.run!.data.target];
        if (t && Math.random() < dt * 3) vfx.chain(v.b, v.c.set(t.pos[0], t.pos[1] + 1, t.pos[2]), 0.35);
      } else if (run === 'rain_of_darts' && Math.random() < 0.5) vfx.embers(v.b, 1, '#f9a8d4', 0.6, 0.5, 0.08);
    }
    // zones on the ground glitter
    for (const z of sim.zones) {
      if (Math.abs(z.x - p.pos[0]) > 60 || Math.abs(z.z - p.pos[2]) > 60) continue;
      const rx = z.x + (Math.random() - 0.5) * z.r * 1.6, rz = z.z + (Math.random() - 0.5) * z.r * 1.6;
      if (z.skill === 'make_it_rain' && Math.random() < 0.6) vfx.grains(v.b.set(rx, z.y + 3.5, rz), 2, '#7ee08a', v.c.set(0, -1, 0), 0.4, 0.09);
      else if ((z.skill === 'earth_spring' || z.skill === 'mortal_realm') && Math.random() < 0.4) vfx.embers(v.b.set(rx, z.y + 0.2, rz), 1, '#a7f3d0', 0.3, 1.5, 0.08);
      else if (z.skill === 'palace_cage' && Math.random() < 0.15) vfx.fireColumn(v.b.set(z.x + Math.cos(sim.time * 3) * z.r, z.y, z.z + Math.sin(sim.time * 3) * z.r), 1.2, '#dc2626');
      else if (z.skill === 'zen_domain' && Math.random() < 0.3) vfx.embers(v.b.set(rx, z.y + 0.1, rz), 1, '#ffd36a', 0.2, 1, 0.07);
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
    vfx.update(dt);
    juice.trauma = Math.max(0, juice.trauma - dt * 1.8);
    juice.kick *= Math.exp(-dt * 9);
  });

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
          juice.trauma = Math.min(1, juice.trauma + (e.heavy ? 0.28 : 0.08));
          if (e.heavy) juice.kick = -4;
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
      case 'cast': {
        if (!close) return;
        const sk = SKILLS[e.skill ?? ''];
        if (!sk) return;
        if (sk.ult) {
          if (e.skill === 'ten_thousand_buddhas') vfx.buddha(v.b.set(e.x, e.y - 1, e.z), 2.6);
          if (e.skill === 'true_dragon' || e.skill === 'black_monday') vfx.flash(v.a, e.skill === 'true_dragon' ? '#ffd36a' : '#ef4444', 4, 0.5, 14);
          sfx('ultRise');
          setTimeout(() => sfx('ultImpact'), 350);
          vfx.ring(v.a.setY(e.y - 0.9), 3, '#ffd36a', 0.6, 0.2, 0.15);
          vfx.embers(v.a, 24, '#ffd36a', 1.2, 3, 0.09);
          if (mine) {
            juice.trauma = Math.min(1, juice.trauma + 0.35);
            juice.kick = -6;
          }
          return;
        }
        const f = sim.fighters[e.id ?? -1];
        const slot = e.id === PLAYER ? 0 : 1 + ((e.id ?? 0) % 11);
        v.b.set(e.x, e.y - 1, e.z);
        switch (e.skill) {
          case 'zen_domain':
            vfx.zenField(v.b, 4.5, 5, slot);
            break;
          case 'golden_bell_shield':
            vfx.bell(4, slot);
            break;
          case 'blood_rage':
            vfx.flash(v.a, '#ff3b1f', 3, 0.3, 10);
            vfx.embers(v.a, 30, '#ff3b1f', 1, 3, 0.1);
            break;
          case 'vajra_palm':
            if (f) vfx.palmPush(v.a, v.c.set(-Math.sin(f.yaw), 0, -Math.cos(f.yaw)), 1.2, 3.5);
            break;
          case 'shadow_step':
            vfx.dustPuff(v.b, 10, 0.6, 2, 0.9, '#3b2a55');
            vfx.sparkBurst(v.a, 16, '#a78bfa', 5, 0.08);
            break;
          case 'jade_seal':
          case 'edict':
          case 'phantom_guard':
            vfx.flash(v.a, '#ffd36a', 2.5, 0.25, 9);
            break;
          case 'patagonia':
            vfx.dustPuff(v.b, 14, 0.6, 2.5, 0.8);
            break;
          case 'earth_spring':
          case 'qingfeng':
            vfx.flash(v.a, '#86efac', 2, 0.3, 8);
            break;
        }
        const list = SECT_SOUND[sk.sect] ?? ['chime'];
        const idx = Object.values(SKILLS).filter((s) => s.sect === sk.sect && !s.ult).indexOf(sk);
        sfx(list[Math.max(0, idx) % list.length]);
        vfx.embers(v.a, 8, '#fff3c4', 0.6, 2, 0.07);
        return;
      }
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

  void cam;
  return (
    <>
      <primitive object={vfx.root} />
      <primitive object={beacon} />
    </>
  );
}

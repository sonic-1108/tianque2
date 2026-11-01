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
        vfx.sparkBurst(v.a, Math.round(6 + x.r * 8), x.color, 4 + x.r * 2, 0.1);
        vfx.embers(v.a, Math.round(3 + x.r * 3), x.color, x.r * 0.6, 2, 0.08);
        if (x.r > 1.2) vfx.dustPuff(v.a, 5, x.r * 0.4, 2, 0.8);
      } else if (x.kind === 'slash') vfx.slashMark(v.a, x.color, x.r * 0.9, 0.16);
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
  return <primitive object={vfx.root} />;
}

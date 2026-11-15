// 冰封 (sim.freeze): whoever 天狼's frost catches stands locked in a heap of rough ice blocks, blue-white and lit
// from inside, frost smoking off it; each knock of A / D shakes it and cracks it a little more; when it breaks the
// blocks burst outward and fall, when it melts they sink and fade.
import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Sim } from '../game/sim';

const HEAPS = 6, BLOCKS = 11;

/** a rough lump of ice: an icosahedron pulled out of shape, flat-shaded so its faces catch the light */
function shard(seed: number) {
  const g = new THREE.IcosahedronGeometry(1, 0);
  const p = g.attributes.position as THREE.BufferAttribute;
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.75 + rnd() * 0.5), p.getY(i) * (0.8 + rnd() * 0.7), p.getZ(i) * (0.75 + rnd() * 0.5));
  g.computeVertexNormals();
  return g.toNonIndexed();
}

export function Frozen({ sim }: { sim: Sim }) {
  const S = useMemo(() => {
    const root = new THREE.Group();
    const ice = new THREE.MeshStandardMaterial({ color: '#dff4ff', emissive: '#7fcfff', emissiveIntensity: 0.45, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.78, flatShading: true });
    const core = new THREE.MeshBasicMaterial({ color: '#a8e4ff', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
    const geos = Array.from({ length: 5 }, (_, k) => shard(k * 37 + 11));
    const heaps = Array.from({ length: HEAPS }, (_, h) => {
      const g = new THREE.Group();
      g.visible = false;
      const blocks = Array.from({ length: BLOCKS }, (_, k) => {
        const m = new THREE.Mesh(geos[(k + h) % geos.length], ice.clone());
        // a heap round the body: big ones low, smaller up to the shoulders, a couple sticking out
        const a = (k / BLOCKS) * Math.PI * 2 + h, up = k / BLOCKS;
        const r = 0.42 + Math.sin(k * 2.3) * 0.12;
        const home = new THREE.Vector3(Math.cos(a) * r, 0.2 + up * 1.45, Math.sin(a) * r);
        const size = new THREE.Vector3(0.38 - up * 0.14, 0.45 + Math.sin(k * 1.7) * 0.15, 0.32 - up * 0.1);
        m.position.copy(home);
        m.scale.copy(size);
        m.rotation.set(k * 0.7, k * 1.3, k * 0.4);
        g.add(m);
        return { m, home, size, vel: new THREE.Vector3(), spin: new THREE.Vector3() };
      });
      const glow = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), core);
      glow.scale.set(0.62, 1.05, 0.62);
      glow.position.y = 0.9;
      g.add(glow);
      root.add(g);
      return { g, blocks, glow, id: -1, t: 0, state: 'off' as 'off' | 'on' | 'burst' | 'melt', knock: 0 };
    });
    return { root, heaps };
  }, []);

  useFrame((state, dt) => {
    const now = sim.time;
    // who is in ice now
    for (const f of sim.fighters) {
      const fr = (f as any).frozen;
      if (!fr || f.hp <= 0) continue;
      if (S.heaps.some((h) => h.id === f.id && (h.state === 'on'))) continue;
      const h = S.heaps.find((x) => x.state === 'off') ?? S.heaps.reduce((a, b) => (a.t < b.t ? a : b));
      h.id = f.id;
      h.state = 'on';
      h.t = 0;
      h.g.visible = true;
      for (const b of h.blocks) {
        b.m.position.copy(b.home);
        b.m.scale.set(0.001, 0.001, 0.001);
        ((b.m.material as THREE.MeshStandardMaterial).opacity = 0.78);
      }
    }
    for (const h of S.heaps) {
      if (h.state === 'off') continue;
      const f = sim.fighters[h.id];
      h.t += dt;
      if (h.state === 'on') {
        h.g.position.set(f.pos[0], f.pos[1], f.pos[2]);
        const fr = (f as any).frozen;
        if (!fr) {
          // out: burst if broken, else melt
          h.state = (f as any).thawBroke ? 'burst' : 'melt';
          h.t = 0;
          for (const b of h.blocks) {
            const out = b.m.position.clone().setY(0).normalize();
            b.vel.set(out.x * (2 + Math.random() * 3), 2 + Math.random() * 4, out.z * (2 + Math.random() * 3));
            b.spin.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4);
          }
          continue;
        }
        // grow in over a quarter second, then shake at each knock, cracking open as the knocks add up
        const grow = Math.min(1, h.t / 0.25), crack = fr.need > 0 ? fr.got / fr.need : 0;
        const knock = Math.max(0, 1 - (now - ((f as any).iceKnock ?? -9)) / 0.15);
        h.blocks.forEach((b, k) => {
          const loose = crack * 0.12;
          b.m.position.set(b.home.x * (1 + loose) + (Math.random() - 0.5) * 0.06 * knock, b.home.y + (Math.random() - 0.5) * 0.04 * knock, b.home.z * (1 + loose) + (Math.random() - 0.5) * 0.06 * knock);
          b.m.scale.copy(b.size).multiplyScalar(grow * (1 - crack * 0.15));
          (b.m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.45 + Math.sin(state.clock.elapsedTime * 3 + k) * 0.1 + knock * 0.6;
        });
        h.glow.visible = true;
        (h.glow.material as THREE.MeshBasicMaterial).opacity = 0.18 + 0.08 * Math.sin(state.clock.elapsedTime * 4);
      } else {
        // pieces flying (burst) or sinking (melt), fading
        const life = h.state === 'burst' ? 0.9 : 1.2;
        h.glow.visible = false;
        for (const b of h.blocks) {
          if (h.state === 'burst') {
            b.vel.y -= 9.8 * dt;
            b.m.position.addScaledVector(b.vel, dt);
            b.m.rotation.x += b.spin.x * dt;
            b.m.rotation.y += b.spin.y * dt;
            if (b.m.position.y < 0.05) {
              b.m.position.y = 0.05;
              b.vel.multiplyScalar(0.4);
            }
          } else {
            b.m.position.y -= dt * 0.6;
            b.m.scale.multiplyScalar(1 - dt * 0.8);
          }
          (b.m.material as THREE.MeshStandardMaterial).opacity = 0.78 * Math.max(0, 1 - h.t / life);
        }
        if (h.t > life) {
          h.state = 'off';
          h.g.visible = false;
          h.id = -1;
        }
      }
    }
  });
  return <primitive object={S.root} />;
}

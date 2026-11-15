// 冰封 (sim.freeze): whoever 天狼's frost catches stands locked inside a rough crystal of ice with spikes grown out of
// it (render/iceHeap.ts draws one); each knock of A / D shakes it and lights its cracks; when it breaks the ice bursts
// outward in lumps, when it melts it sinks and fades.
import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Sim } from '../game/sim';
import { makeIceHeap, type IceHeap } from './iceHeap';

const HEAPS = 6;

export function Frozen({ sim }: { sim: Sim }) {
  const S = useMemo(() => {
    const root = new THREE.Group();
    const heaps = Array.from({ length: HEAPS }, (_, h) => {
      const ih: IceHeap = makeIceHeap(h);
      root.add(ih.g);
      return { ih, id: -1, t: 0, state: 'off' as 'off' | 'on' | 'gone' };
    });
    return { root, heaps };
  }, []);

  useFrame((state, dt) => {
    const now = sim.time;
    // who is in ice now
    for (const f of sim.fighters) {
      const fr = (f as any).frozen;
      if (!fr || f.hp <= 0) continue;
      if (S.heaps.some((h) => h.id === f.id && h.state === 'on')) continue;
      const h = S.heaps.find((x) => x.state === 'off') ?? S.heaps.reduce((a, b) => (a.t > b.t ? a : b));
      h.id = f.id;
      h.state = 'on';
      h.t = 0;
    }
    for (const h of S.heaps) {
      if (h.state === 'off') continue;
      const f = sim.fighters[h.id];
      h.t += dt;
      if (h.state === 'on') {
        h.ih.g.position.set(f.pos[0], f.pos[1], f.pos[2]);
        const fr = (f as any).frozen;
        if (!fr || f.hp <= 0) {
          // out: burst if broken (or struck down in it), else melt
          h.ih.release(!!(f as any).thawBroke || f.hp <= 0);
          h.state = 'gone';
          h.t = 0;
          continue;
        }
        // it forms in a quarter second, shakes at each knock, cracks open as the knocks add up
        const grow = Math.min(1, h.t / 0.25), crack = fr.need > 0 ? Math.min(1, fr.got / fr.need) : 0;
        const knock = Math.max(0, 1 - (now - ((f as any).iceKnock ?? -9)) / 0.15);
        h.ih.hold(grow, crack, knock, state.clock.elapsedTime);
      } else if (!h.ih.fall(dt)) {
        h.state = 'off';
        h.id = -1;
      }
    }
  });
  return <primitive object={S.root} />;
}

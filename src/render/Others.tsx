// The others online (net/world.ts): a name over each one's head, gold for a friend, with their level.
import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Sim } from '../game/sim';
import { world } from '../net/world';

function tag(text: string, friend: boolean) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.font = 'bold 30px serif';
  const w = Math.min(248, g.measureText(text).width + 24);
  g.fillStyle = 'rgba(20,14,8,0.55)';
  g.beginPath();
  g.roundRect((256 - w) / 2, 10, w, 44, 10);
  g.fill();
  g.fillStyle = friend ? '#ffd36a' : '#f4ead6';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 33);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function Others({ sim }: { sim: Sim }) {
  const S = useMemo(() => {
    const root = new THREE.Group();
    const cache = new Map<string, THREE.Texture>();
    const sprites = Array.from({ length: 16 }, () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: true }));
      s.scale.set(1.6, 0.4, 1);
      s.visible = false;
      s.renderOrder = 5;
      root.add(s);
      return { s, key: '' };
    });
    return { root, cache, sprites };
  }, []);
  useFrame(() => {
    const ids: number[] = (sim as any).ghostIds ?? [];
    const friends = new Set(world.friends.map((f) => f.id));
    ids.forEach((fid, k) => {
      const f = sim.fighters[fid], a = f as any, sp = S.sprites[k];
      if (!sp) return;
      const show = !a.away && a.other && Math.hypot(f.pos[0] - sim.player.pos[0], f.pos[2] - sim.player.pos[2]) < 60;
      sp.s.visible = !!show;
      if (!show) return;
      const fr = friends.has(a.other);
      const key = `${f.name} · ${f.level}级|${fr ? 1 : 0}`;
      if (sp.key !== key) {
        sp.key = key;
        let t = S.cache.get(key);
        if (!t) {
          t = tag(`${f.name} · ${f.level}级`, fr);
          S.cache.set(key, t);
          if (S.cache.size > 80) S.cache.clear();
        }
        (sp.s.material as THREE.SpriteMaterial).map = t;
        (sp.s.material as THREE.SpriteMaterial).needsUpdate = true;
      }
      sp.s.position.set(f.pos[0], f.pos[1] + 2.35, f.pos[2]);
    });
  });
  return <primitive object={S.root} />;
}

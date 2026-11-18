// 水战 on the water: rings spread from anyone wading or swimming as they move, a burst of spray when someone in the
// water is struck or lands, bigger for a giant. Pooled meshes on the water's surface (world.ts WATER_Y).
import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Sim } from '../game/sim';
import { WATER_Y, groundHeight } from '../game/world';
import { bodyR } from '../game/giants';
import { WATER_U } from './season';

const RINGS = 48, DROPS = 220;
/** spray asked for from elsewhere (the river dragon breaking the surface): where, how many drops, how hard, a ring */
export const WATER_FX: { x: number; z: number; n: number; p: number; r?: number }[] = [];

function softTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export function WaterFx({ sim }: { sim: Sim }) {
  const S = useMemo(() => {
    const root = new THREE.Group();
    // a ripple, not a drawn circle: a soft band, brightest a little inside its edge, fading out both ways
    const ringGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    const rtex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const x = c.getContext('2d')!;
      const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.72, 'rgba(255,255,255,0)');
      g.addColorStop(0.86, 'rgba(255,255,255,0.75)');
      g.addColorStop(0.92, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    const rings = Array.from({ length: RINGS }, () => {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ map: rtex, color: '#e8f6ff', transparent: true, opacity: 0, depthWrite: false, fog: true }));
      m.visible = false;
      m.renderOrder = 3;
      root.add(m);
      return { m, t: 0, max: 1, r0: 0.3, r1: 1.6 };
    });
    const tex = softTex();
    const drops = Array.from({ length: DROPS }, () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#f2fbff', transparent: true, depthWrite: false, opacity: 0 }));
      s.visible = false;
      root.add(s);
      return { s, t: 0, v: new THREE.Vector3(), size: 0.2 };
    });
    return { root, rings, drops, last: new Map<number, { ripple: number; hit: number }>(), clock: 0 };
  }, []);

  const ring = (x: number, z: number, r0: number, r1: number, life: number) => {
    const it = S.rings.find((r) => r.t <= 0) ?? S.rings.reduce((a, b) => (a.t < b.t ? a : b));
    it.m.position.set(x, WATER_Y + 0.03, z);
    it.t = it.max = life;
    it.r0 = r0;
    it.r1 = r1;
    it.m.visible = true;
  };
  const splash = (x: number, z: number, n: number, power: number) => {
    for (let k = 0; k < n; k++) {
      const d = S.drops.find((q) => q.t <= 0) ?? S.drops[Math.floor(Math.random() * DROPS)];
      const a = Math.random() * Math.PI * 2, out = (0.6 + Math.random()) * power;
      d.s.position.set(x + Math.cos(a) * 0.3 * power, WATER_Y + 0.1, z + Math.sin(a) * 0.3 * power);
      d.v.set(Math.cos(a) * out, (2.5 + Math.random() * 3.5) * power, Math.sin(a) * out);
      d.size = (0.15 + Math.random() * 0.25) * Math.sqrt(power);
      d.t = 0.7 + Math.random() * 0.5;
      d.s.visible = true;
    }
  };

  useFrame((state, dt) => {
    S.clock += dt;
    const cam = state.camera.position;
    for (const f of sim.fighters) {
      const a = f as any;
      if (a.benched || a.away || f.hp <= 0) continue;
      if (Math.hypot(f.pos[0] - cam.x, f.pos[2] - cam.z) > 70) continue;
      const g = groundHeight(f.pos[0], f.pos[2]);
      if (g > WATER_Y - 0.25 || f.pos[1] > WATER_Y + 0.4) continue; // dry, or up out of it
      const big = bodyR(f);
      let L = S.last.get(f.id);
      if (!L) S.last.set(f.id, (L = { ripple: 0, hit: a.hitAt ?? 0 }));
      const sp = Math.hypot(f.vel[0], f.vel[2]);
      // rings as it moves (and slowly even standing: the water laps at it)
      if (S.clock - L.ripple > (sp > 0.5 ? 0.28 : 1.1)) {
        L.ripple = S.clock;
        const r = big > 0 ? big * 0.9 : 0.35;
        ring(f.pos[0], f.pos[2], r, r + (sp > 0.5 ? 1.6 : 0.8) + big * 0.6, sp > 0.5 ? 1.1 : 1.6);
        if (sp > 2) splash(f.pos[0] - f.vel[0] * 0.05, f.pos[2] - f.vel[2] * 0.05, big > 0 ? 6 : 2, big > 0 ? 1.6 : 0.5);
      }
      // struck in the water: spray
      if ((a.hitAt ?? 0) !== L.hit) {
        L.hit = a.hitAt ?? 0;
        splash(f.pos[0], f.pos[2], big > 0 ? 18 : a.hitHeavy ? 12 : 7, big > 0 ? 2.2 : a.hitHeavy ? 1.2 : 0.8);
        ring(f.pos[0], f.pos[2], 0.4, 2.6 + big, 0.9);
      }
    }
    // a giant's blow landing in the water throws a wall of it up
    for (const t of sim.teles)
      if (t.t >= t.wind && t.t - dt < t.wind && groundHeight(t.x, t.z) < WATER_Y - 0.3) {
        splash(t.x, t.z, 24, t.shape === 'circle' ? 1.6 + t.r * 0.1 : 1.4);
        ring(t.x, t.z, 0.5, t.r + 2, 1.4);
      }
    // white water by day, a dim grey under the moon (these are unlit: they must not glow at night)
    const lum = 0.16 + 0.84 * Math.min(1, Math.max(0, WATER_U.uDay.value));
    for (let e = WATER_FX.shift(); e; e = WATER_FX.shift()) {
      splash(e.x, e.z, e.n, e.p);
      if (e.r) ring(e.x, e.z, 0.5, e.r, 1.3);
    }
    for (const r of S.rings)
      if (r.t > 0) {
        r.t -= dt;
        const u = 1 - r.t / r.max, rr = r.r0 + (r.r1 - r.r0) * (1 - (1 - u) * (1 - u));
        r.m.scale.set(rr, 1, rr);
        (r.m.material as THREE.MeshBasicMaterial).color.setRGB(0.91 * lum, 0.96 * lum, lum);
        (r.m.material as THREE.MeshBasicMaterial).opacity = 0.4 * (1 - u) * Math.min(1, u * 6);
        if (r.t <= 0) r.m.visible = false;
      }
    for (const d of S.drops)
      if (d.t > 0) {
        d.t -= dt;
        d.v.y -= 9.8 * dt;
        d.s.position.addScaledVector(d.v, dt);
        d.s.scale.setScalar(d.size);
        (d.s.material as THREE.SpriteMaterial).color.setRGB(0.95 * lum, 0.98 * lum, lum);
        (d.s.material as THREE.SpriteMaterial).opacity = Math.min(0.85, d.t * 1.4);
        if (d.t <= 0 || d.s.position.y < WATER_Y - 0.1) {
          d.t = 0;
          d.s.visible = false;
        }
      }
  });
  return <primitive object={S.root} />;
}

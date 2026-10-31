// Everything the sim throws, lays down or flashes: projectiles, zones on the ground, rings, bursts, beams, damage text.
// Drawn from pools rebuilt into each frame (no React state per effect).
import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Sim } from '../game/sim';

const N_PROJ = 48;
const N_ZONE = 16;
const N_FX = 64;
const N_TEXT = 40;

function textTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { c, t, last: '' };
}

export function Fx({ sim }: { sim: Sim }) {
  const pools = useMemo(() => {
    const root = new THREE.Group();
    const projGeo: Record<string, THREE.BufferGeometry> = {
      dart: new THREE.ConeGeometry(0.08, 0.5, 6).rotateX(-Math.PI / 2),
      blade: new THREE.BoxGeometry(0.06, 0.02, 0.5),
      orb: new THREE.SphereGeometry(0.25, 10, 8),
      glyph: new THREE.TorusGeometry(0.28, 0.07, 6, 12),
      guard: new THREE.CapsuleGeometry(0.35, 1.2, 4, 8),
      watch: new THREE.TorusGeometry(0.22, 0.08, 6, 14),
      boomerang: new THREE.TorusGeometry(0.5, 0.08, 4, 10, Math.PI * 1.2),
    };
    const proj = Array.from({ length: N_PROJ }, () => {
      const m = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>(projGeo.dart, new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.95 }));
      m.visible = false;
      root.add(m);
      return m;
    });
    const zoneGeo = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
    const zones = Array.from({ length: N_ZONE }, () => {
      const m = new THREE.Mesh(zoneGeo, new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.25, depthWrite: false }));
      m.visible = false;
      m.renderOrder = 2;
      root.add(m);
      return m;
    });
    const ringGeo = new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2);
    const burstGeo = new THREE.SphereGeometry(1, 10, 8);
    const slashGeo = new THREE.RingGeometry(0.7, 1, 20, 1, -0.9, 1.8).rotateX(-Math.PI / 2);
    const sealGeo = new THREE.BoxGeometry(1, 1, 1);
    const beamGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 6).rotateX(Math.PI / 2);
    const fx = Array.from({ length: N_FX }, () => {
      const m = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>(ringGeo, new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false;
      root.add(m);
      return m;
    });
    const texts = Array.from({ length: N_TEXT }, () => {
      const tt = textTexture();
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tt.t, transparent: true, depthTest: false }));
      s.visible = false;
      s.renderOrder = 10;
      root.add(s);
      return { s, tt };
    });
    return { root, proj, projGeo, zones, fx, texts, geos: { ring: ringGeo, burst: burstGeo, slash: slashGeo, seal: sealGeo, beam: beamGeo } };
  }, []);

  useFrame(() => {
    const P = pools;
    // projectiles
    P.proj.forEach((m, i) => {
      const p = sim.proj[i];
      m.visible = !!p;
      if (!p) return;
      m.geometry = P.projGeo[p.shape] ?? P.projGeo.dart;
      (m.material as THREE.MeshBasicMaterial).color.set(p.color);
      m.position.set(p.pos[0], p.pos[1], p.pos[2]);
      m.rotation.set(0, Math.atan2(p.vel[0], p.vel[2]), 0);
      if (p.shape === 'boomerang' || p.shape === 'watch' || p.shape === 'glyph') m.rotation.x = performance.now() * 0.02;
      if (p.shape === 'guard') m.rotation.x = 0;
    });
    // zones
    P.zones.forEach((m, i) => {
      const z = sim.zones[i];
      m.visible = !!z;
      if (!z) return;
      m.position.set(z.x, z.y + 0.08, z.z);
      m.scale.setScalar(z.r);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.color.set(z.color);
      mat.opacity = 0.18 + 0.1 * Math.sin(performance.now() * 0.006) + (z.skill === 'jade_seal' ? 0.25 * (1 - z.t / z.max) : 0);
    });
    // rings, bursts, slashes, beams, seals
    let k = 0;
    let ti = 0;
    for (const x of sim.fx) {
      const a = 1 - x.t / x.max; // 0 -> 1 over its life
      if (x.kind === 'text') {
        const T = P.texts[ti++];
        if (!T) continue;
        if (T.tt.last !== x.text + x.color) {
          const g = T.tt.c.getContext('2d')!;
          g.clearRect(0, 0, 256, 64);
          g.font = '900 40px "PingFang SC","Microsoft YaHei",sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.lineWidth = 7;
          g.strokeStyle = 'rgba(10,6,4,0.85)';
          g.strokeText(x.text ?? '', 128, 32);
          g.fillStyle = x.color;
          g.fillText(x.text ?? '', 128, 32);
          T.tt.t.needsUpdate = true;
          T.tt.last = (x.text ?? '') + x.color;
        }
        T.s.visible = true;
        T.s.position.set(x.x, x.y + a * 0.9, x.z);
        const sc = (x.r > 1 ? 1.6 : 1) * (a < 0.15 ? 0.7 + a * 2 : 1);
        T.s.scale.set(2.4 * sc, 0.6 * sc, 1);
        (T.s.material as THREE.SpriteMaterial).opacity = a > 0.7 ? 1 - (a - 0.7) / 0.3 : 1;
        continue;
      }
      const m = P.fx[k++];
      if (!m) continue;
      m.visible = true;
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.color.set(x.color);
      m.rotation.set(0, 0, 0);
      if (x.kind === 'ring') {
        m.geometry = P.geos.ring;
        m.position.set(x.x, x.y, x.z);
        m.scale.setScalar(x.r * (0.3 + a * 0.7));
        mat.opacity = 1 - a;
      } else if (x.kind === 'burst') {
        m.geometry = P.geos.burst;
        m.position.set(x.x, x.y, x.z);
        m.scale.setScalar(x.r * (0.4 + a * 0.6));
        mat.opacity = 0.7 * (1 - a);
      } else if (x.kind === 'slash') {
        m.geometry = P.geos.slash;
        m.position.set(x.x, x.y, x.z);
        m.rotation.y = (x.yaw ?? 0) + Math.PI / 2;
        m.scale.setScalar(x.r);
        mat.opacity = 0.85 * (1 - a);
      } else if (x.kind === 'seal') {
        // the jade seal comes down out of the sky
        m.geometry = P.geos.seal;
        m.position.set(x.x, x.y + 0.9 + (1 - a) * 14, x.z);
        m.scale.set(x.r * 1.3, 1.8, x.r * 1.3);
        mat.opacity = 0.95;
      } else if (x.kind === 'beam') {
        const f = sim.fighters[x.from ?? -1];
        const t = sim.fighters[x.to ?? -1];
        if (!f || !t) {
          m.visible = false;
          continue;
        }
        m.geometry = P.geos.beam;
        const ax = f.pos[0], ay = f.pos[1] + 1.3, az = f.pos[2];
        const bx = t.pos[0], by = t.pos[1] + 1.1, bz = t.pos[2];
        m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
        m.lookAt(bx, by, bz);
        m.scale.set(1.5, 1.5, Math.hypot(bx - ax, by - ay, bz - az));
        mat.opacity = 0.85;
      }
    }
    for (; k < P.fx.length; k++) P.fx[k].visible = false;
    for (; ti < P.texts.length; ti++) P.texts[ti].s.visible = false;
  });

  return <primitive object={pools.root} />;
}

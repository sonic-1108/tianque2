// 雪岭 (game/snow.ts): the camp under the snow (two hide tents, a stone fire ring with a crackling fire, a rack of
// drying herbs, crates, the ginseng digger's sign), two rock shelters with fires up on the snow, the snow lotus glowing
// in their drifts, the old temple's ice cave (a mouth of black under great shards of ice), the summit's cairn with its
// prayer flags snapping in the wind, and snow always drifting down round you up there, whatever the weather below.
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Sim } from '../game/sim';
import { ICE_CAVE, LOTUS, SNOW_CAMP, SNOW_FIRES, SUMMIT, onSnow } from '../game/snow';
import { SNOW_Y, groundHeight } from '../game/world';
import { Builder, Built } from './build';

function camp() {
  const b = new Builder();
  const { x, z } = SNOW_CAMP, y = groundHeight(x, z);
  // two A-frame tents of hide, open toward the fire
  ([[-4, -3, 0.5], [4.5, -2, -0.6]] as const).forEach(([dx, dz, rot]) => {
    const tx = x + dx, tz = z + dz, ty = groundHeight(tx, tz);
    const local = new Builder();
    // two hide panels leaning together to a ridge pole, two crossed poles at each end
    for (const s of [-1, 1]) local.add('fur', new THREE.BoxGeometry(0.08, 2.3, 3.2).rotateZ(s * 0.62), s * 0.68, 0.95, 0);
    local.box('wood', 0, 1.88, 0, 0.1, 0.1, 3.5);
    for (const zz of [-1.62, 1.62]) for (const s of [-1, 1]) local.add('wood', new THREE.CylinderGeometry(0.035, 0.035, 2.3, 5).rotateZ(-s * 0.55), s * 0.55, 1.0, zz);
    b.merge(local, tx, ty - 0.05, tz, rot);
  });
  // the fire ring
  const [fx, fz] = SNOW_FIRES[0], fy = groundHeight(fx, fz);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    b.add('stone', new THREE.DodecahedronGeometry(0.22, 0).scale(1.2, 0.8, 1), fx + Math.cos(a) * 0.85, fy + 0.08, fz + Math.sin(a) * 0.85);
  }
  for (let k = 0; k < 4; k++) b.box('wood', fx, fy + 0.05, fz, 0.12, 0.12, 1.1, (k * Math.PI) / 4);
  // logs to sit on round it
  for (const a of [0.6, 2.4, 4.2]) b.box('wood', fx + Math.cos(a) * 2.2, fy, fz + Math.sin(a) * 2.2, 0.36, 0.36, 1.6, a + Math.PI / 2);
  // a drying rack of herbs, crates, the sign
  b.col('wood', x + 2, y, z - 6, 0.05, 1.8, 6);
  b.col('wood', x + 4, y, z - 6, 0.05, 1.8, 6);
  b.box('wood', x + 3, y + 1.7, z - 6, 2.2, 0.06, 0.06);
  for (let k = 0; k < 5; k++) b.box('hay', x + 2.2 + k * 0.4, y + 1.25, z - 6, 0.12, 0.45, 0.12);
  b.box('wood', x - 1, y, z + 4, 0.8, 0.7, 0.8, 0.3);
  b.box('wood', x - 1.6, y, z + 4.7, 0.7, 0.6, 0.7, -0.2);
  b.box('wood', x - 1.2, y + 0.7, z + 4.2, 0.6, 0.5, 0.6, 0.6);
  b.col('wood', x + 6, y, z + 3, 0.06, 1.9, 6);
  b.box('plank', x + 6, y + 1.5, z + 3.05, 0.8, 0.5, 0.06);
  return b;
}
function shelter(fx: number, fz: number) {
  const b = new Builder(), y = groundHeight(fx, fz);
  // a leaning slab on two boulders, the fire under it
  b.add('stone', new THREE.DodecahedronGeometry(1.4, 1).scale(1, 1.3, 1), fx - 2.2, y + 0.6, fz - 1.2);
  b.add('stone', new THREE.DodecahedronGeometry(1.2, 1).scale(1, 1.2, 1), fx + 2.2, y + 0.5, fz - 1.4);
  b.box('stone', fx, y + 2.1, fz - 1.1, 5.4, 0.5, 2.8, 0.1);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    b.add('stone', new THREE.DodecahedronGeometry(0.2, 0), fx + Math.cos(a) * 0.7, y + 0.06, fz + Math.sin(a) * 0.7);
  }
  for (let k = 0; k < 3; k++) b.box('wood', fx, y + 0.05, fz, 0.1, 0.1, 0.9, (k * Math.PI) / 3);
  return b;
}
function summit() {
  const b = new Builder();
  const [x, z] = SUMMIT, y = groundHeight(x, z);
  for (let k = 0; k < 7; k++) b.add('stone', new THREE.DodecahedronGeometry(0.55 - k * 0.06, 0).scale(1.3, 0.7, 1.1), x + Math.sin(k * 2.1) * 0.1, y + 0.25 + k * 0.42, z + Math.cos(k * 1.7) * 0.1);
  b.col('wood', x, y, z, 0.05, 4.2, 6);
  return b;
}
/** the ice cave's mouth: a black opening under a crown of ice shards, rocks heaped round */
function cave() {
  const b = new Builder();
  const { x, z, rot } = ICE_CAVE, y = groundHeight(x, z);
  const local = new Builder();
  for (let k = 0; k < 9; k++) {
    const a = -1.25 + (k / 8) * 2.5, r = 3.4;
    local.add('stone', new THREE.DodecahedronGeometry(1.0 + (k % 3) * 0.3, 0).scale(1, 1.4, 1), Math.sin(a) * r, Math.cos(a) * r * 0.9 + 0.3, -0.6);
  }
  local.box('stone', 0, 3.6, -0.8, 7.5, 1.4, 3);
  local.box('dark', 0, -0.2, -0.75, 4.2, 3.9, 0.3);
  return { b, local, x, y, z, rot };
}

export function Snow({ sim }: { sim: Sim }) {
  const S = useMemo(() => {
    const b = camp();
    for (const [fx, fz] of SNOW_FIRES.slice(1)) b.merge(shelter(fx, fz), 0, 0, 0, 0);
    b.merge(summit(), 0, 0, 0, 0);
    const cv = cave();
    b.merge(cv.local, cv.x, cv.y, cv.z, cv.rot);
    const root = new THREE.Group();
    // the ice: tall clear-blue shards crowning the cave mouth
    const ice = new THREE.MeshStandardMaterial({ color: '#cfeaff', emissive: '#4fa8e8', emissiveIntensity: 0.25, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.82 });
    const cg = new THREE.Group();
    for (let k = 0; k < 11; k++) {
      const h = 1.6 + ((k * 37) % 7) * 0.45;
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.35 + (k % 3) * 0.12, h, 5), ice);
      const a = -1.3 + (k / 10) * 2.6;
      m.position.set(Math.sin(a) * 3.3, 4.2 + Math.cos(a) * 0.8 + h * 0.3, -0.2 + (k % 2) * 0.4);
      m.rotation.set((k % 2 ? 0.2 : -0.15), 0, -a * 0.5);
      cg.add(m);
    }
    for (let k = 0; k < 6; k++) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.9 + (k % 3) * 0.3, 5), ice);
      m.position.set(-1.6 + k * 0.64, 3.1, -0.55);
      m.rotation.x = Math.PI; // icicles hanging over the mouth
      cg.add(m);
    }
    cg.position.set(cv.x, cv.y, cv.z);
    cg.rotation.y = cv.rot;
    root.add(cg);
    // flames: a few additive cones per fire, flickered each frame
    const flameMat = new THREE.MeshBasicMaterial({ color: '#ff9a3c', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const coreMat = new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const flames = SNOW_FIRES.map(([fx, fz]) => {
      const g = new THREE.Group();
      for (let k = 0; k < 5; k++) {
        const m = new THREE.Mesh(new THREE.ConeGeometry(0.22 - k * 0.02, 0.9 - k * 0.08, 7, 1, true), k < 2 ? coreMat : flameMat);
        m.position.set(Math.cos(k * 1.3) * 0.15, 0.4, Math.sin(k * 1.3) * 0.15);
        g.add(m);
      }
      g.position.set(fx, groundHeight(fx, fz) + 0.05, fz);
      root.add(g);
      return g;
    });
    // the lotus: white petals round a gold heart, a soft glow
    const petal = new THREE.MeshStandardMaterial({ color: '#f8fbff', emissive: '#cfe6ff', emissiveIntensity: 0.6, roughness: 0.5, side: THREE.DoubleSide });
    const heart = new THREE.MeshStandardMaterial({ color: '#ffe08a', emissive: '#ffb347', emissiveIntensity: 0.8 });
    const glowTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const x = c.getContext('2d')!;
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    const lotus = LOTUS.map(([lx, lz]) => {
      const g = new THREE.Group();
      for (let ring = 0; ring < 2; ring++)
        for (let k = 0; k < 8; k++) {
          const p = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6).scale(0.55, 0.18, 1.3).translate(0, 0, 0.13), petal);
          p.rotation.set(-0.5 - ring * 0.45, (k / 8) * Math.PI * 2 + ring * 0.4, 0, 'YXZ');
          p.position.y = 0.12 + ring * 0.03;
          g.add(p);
        }
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), heart);
      h.position.y = 0.16;
      g.add(h);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#cfe6ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
      s.scale.setScalar(1.4);
      s.position.y = 0.25;
      g.add(s);
      g.position.set(lx, groundHeight(lx, lz), lz);
      root.add(g);
      return g;
    });
    // prayer flags on a line from the summit pole down to a stake
    const [sx, sz] = SUMMIT, sy = groundHeight(sx, sz);
    const flags: THREE.Mesh[] = [];
    const cols = ['#2563eb', '#f8fafc', '#dc2626', '#16a34a', '#facc15'];
    const end = new THREE.Vector3(sx + 5, groundHeight(sx + 5, sz + 2) + 0.6, sz + 2);
    const top = new THREE.Vector3(sx, sy + 4.1, sz);
    for (let k = 0; k < 10; k++) {
      const u = (k + 0.5) / 10, p = top.clone().lerp(end, u);
      p.y -= Math.sin(Math.PI * u) * 0.5;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.42).translate(0, -0.21, 0), new THREE.MeshStandardMaterial({ color: cols[k % 5], side: THREE.DoubleSide, roughness: 0.9 }));
      m.position.copy(p);
      m.rotation.y = Math.atan2(end.x - top.x, end.z - top.z) + Math.PI / 2;
      root.add(m);
      flags.push(m);
    }
    // snow drifting round you on the heights
    const N = 900;
    const pos = new Float32Array(N * 3);
    for (let k = 0; k < N; k++) pos.set([(Math.random() - 0.5) * 40, Math.random() * 18, (Math.random() - 0.5) * 40], k * 3);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const flakes = new THREE.Points(sg, new THREE.PointsMaterial({ map: glowTex, color: '#ffffff', size: 0.16, transparent: true, depthWrite: false, opacity: 0 }));
    flakes.frustumCulled = false;
    root.add(flakes);
    return { parts: b.build(), root, flames, lotus, flags, flakes, pos };
  }, []);
  const light = useRef<THREE.PointLight>(null);
  const tick = useRef(0);
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime, p = sim.player.pos;
    const out = sim.indoor < 0;
    const near = out && Math.hypot(p[0] - SNOW_CAMP.x, p[2] - SNOW_CAMP.z) < 420;
    S.root.visible = near;
    if (!near) return;
    // flicker
    S.flames.forEach((g, i) => {
      g.children.forEach((m, k) => {
        m.scale.set(1 + Math.sin(t * 13 + k * 2 + i) * 0.12, 1 + Math.sin(t * 9 + k * 3.1 + i) * 0.25, 1);
        m.rotation.y = t * (1 + k * 0.3);
      });
    });
    // the real light sits on the fire nearest you
    let best = 0, bd = 1e9;
    SNOW_FIRES.forEach(([fx, fz], i) => {
      const d = Math.hypot(fx - p[0], fz - p[2]);
      if (d < bd) (bd = d), (best = i);
    });
    if (light.current) {
      const [fx, fz] = SNOW_FIRES[best];
      light.current.position.set(fx, groundHeight(fx, fz) + 1.2, fz);
      light.current.intensity = bd < 60 ? 9 + Math.sin(t * 11) * 1.5 + Math.sin(t * 23) * 0.8 : 0;
    }
    // the lotus that have been picked are gone till they grow back
    if ((tick.current -= dt) <= 0) {
      tick.current = 0.5;
      S.lotus.forEach((g, i) => (g.visible = sim.snow.lotusBack[i] <= sim.worldT));
    }
    S.lotus.forEach((g, i) => (g.rotation.y = Math.sin(t * 0.7 + i) * 0.2));
    S.flags.forEach((m, k) => (m.rotation.x = Math.sin(t * 6 + k * 0.8) * 0.45));
    // flakes: drift down round the player while they're up on the snow
    const up = onSnow(p[1] + 6) ? Math.min(1, (p[1] - (SNOW_Y - 20)) / 15) : 0;
    const fm = S.flakes.material as THREE.PointsMaterial;
    fm.opacity += (up * 0.85 - fm.opacity) * Math.min(1, dt * 2);
    S.flakes.visible = fm.opacity > 0.02;
    if (S.flakes.visible) {
      S.flakes.position.set(p[0], p[1] - 4, p[2]);
      const a = S.pos;
      for (let k = 0; k < a.length; k += 3) {
        a[k + 1] -= dt * (1.1 + (k % 7) * 0.08);
        a[k] += Math.sin(t * 0.8 + k) * dt * 0.4 + dt * 0.6;
        if (a[k + 1] < 0) (a[k + 1] += 18), (a[k] = (Math.random() - 0.5) * 40), (a[k + 2] = (Math.random() - 0.5) * 40);
        if (a[k] > 20) a[k] -= 40;
      }
      S.flakes.geometry.attributes.position.needsUpdate = true;
    }
  });
  return (
    <>
      <Built parts={S.parts} />
      <primitive object={S.root} />
      <pointLight ref={light} color="#ff9a4a" intensity={0} distance={16} decay={1.4} />
    </>
  );
}

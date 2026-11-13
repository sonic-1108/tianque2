// 青石村 at night (owner: the village lit up, a busy night market): red paper lanterns on poles down 青石集's street and
// the village roads, strings of small lanterns across the market, a pair at every stall and every house door, the
// teahouse's row, the night carts' own; each with a halo and a warm pool on the ground. They light at dusk and go out
// at dawn; the handful nearest you throw real light. Unlit by day they still hang there, red.
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Sim } from '../game/sim';
import { roadFrame } from '../game/layout';
import { MARKET_FROM, MARKET_ROAD, MARKET_TO, STALLS, TEAHOUSE } from '../game/props';
import { BUILDINGS, groundHeight, inBuilding, WATER_Y } from '../game/world';
import { HOME, HOME_D } from '../game/village';
import { FOLK } from '../game/places';
import { ROAD_N } from '../game/layout';
import { Builder, Built } from './build';

type V3 = [number, number, number];
interface Spots {
  big: V3[]; // the street and door lanterns
  small: V3[]; // the strings across the market
  poles: Builder;
}
const clear = (x: number, z: number) => {
  const y = groundHeight(x, z);
  return y > WATER_Y + 0.3 && !inBuilding(x, y + 1.2, z, 0.5);
};

/** where every lantern hangs (worked out once) */
function spots(): Spots {
  const big: V3[] = [], small: V3[] = [];
  const b = new Builder();
  // a post with an arm reaching over the road, the lantern hanging off its end
  const pole = (x: number, z: number, ax: number, az: number, h = 3.7) => {
    if (!clear(x, z)) return false;
    const y = groundHeight(x, z);
    b.col('wood', x, y - 0.2, z, 0.07, h + 0.2, 6);
    const ex = x + ax * 0.7, ez = z + az * 0.7;
    b.box('wood', (x + ex) / 2, y + h - 0.12, (z + ez) / 2, 0.08, 0.08, 0.74, Math.atan2(ax, az));
    big.push([ex, y + h - 0.62, ez]);
    return true;
  };
  // 青石集's street: both sides every 8 m, arms over the road
  const tops: Record<string, V3> = {};
  for (let r = MARKET_FROM - 6, k = 0; r <= MARKET_TO + 6; r += 8, k++)
    for (const s of [-1, 1]) {
      const f = roadFrame(MARKET_ROAD, r), off = 5.2;
      const x = f.x + s * f.uz * off, z = f.z - s * f.ux * off;
      if (pole(x, z, -s * f.uz, s * f.ux)) tops[`${k}:${s}`] = [x, groundHeight(x, z) + 3.6, z];
    }
  // strings of small lanterns across the street between facing posts, every other pair
  for (let k = 0; k < 20; k += 2) {
    const a = tops[`${k}:-1`], c = tops[`${k}:1`];
    if (!a || !c) continue;
    const n = 7;
    let last: V3 = a;
    for (let i = 0; i <= n; i++) {
      const u = i / n, sag = Math.sin(Math.PI * u) * 0.7;
      const p: V3 = [a[0] + (c[0] - a[0]) * u, a[1] + (c[1] - a[1]) * u - sag, a[2] + (c[2] - a[2]) * u];
      if (i > 0) {
        const dx = p[0] - last[0], dy = p[1] - last[1], dz = p[2] - last[2], L = Math.hypot(dx, dy, dz);
        const g = new THREE.CylinderGeometry(0.012, 0.012, L, 4);
        g.rotateX(Math.PI / 2);
        g.lookAt(new THREE.Vector3(dx, dy, dz));
        b.add('dark', g, (p[0] + last[0]) / 2, (p[1] + last[1]) / 2, (p[2] + last[2]) / 2);
      }
      if (i > 0 && i < n) small.push([p[0], p[1] - 0.25, p[2]]);
      last = p;
    }
  }
  // every stall: a pair at its front corners
  for (const st of STALLS) {
    const fx = Math.sin(st.rot), fz = Math.cos(st.rot), sx = fz, sz = -fx, h = st.size * 0.5;
    for (const s of [-1, 1]) {
      const x = st.x + fx * h * 0.95 + sx * s * h * 0.85, z = st.z + fz * h * 0.95 + sz * s * h * 0.85;
      big.push([x, groundHeight(x, z) + 2.3, z]);
    }
  }
  // the teahouse's front
  {
    const T = TEAHOUSE, fx = Math.sin(T.rot), fz = Math.cos(T.rot), sx = fz, sz = -fx;
    for (const s of [-5.2, -2.6, 2.6, 5.2]) {
      const x = T.x + fx * T.size * 0.52 + sx * s, z = T.z + fz * T.size * 0.52 + sz * s;
      big.push([x, groundHeight(x, z) + 3.1, z]);
    }
  }
  // the village: a pair by every house door (open pavilions get one under the roof), and the house you can buy
  for (const B of BUILDINGS) {
    if (Math.hypot(B.x, B.z) > 70) continue;
    const y0 = groundHeight(B.x, B.z);
    if (B.posts) {
      if (/pavilion/.test(B.model)) big.push([B.x, y0 + B.h * 0.72, B.z]);
      continue;
    }
    const fx = Math.sin(B.rot), fz = Math.cos(B.rot), sx = fz, sz = -fx;
    for (const s of [-1, 1]) {
      const x = B.x + fx * (B.hz + 0.35) + sx * s * Math.min(1.6, B.hx * 0.4), z = B.z + fz * (B.hz + 0.35) + sz * s * Math.min(1.6, B.hx * 0.4);
      big.push([x, groundHeight(x, z) + 2.5, z]);
    }
  }
  {
    const fx = Math.sin(HOME.rot), fz = Math.cos(HOME.rot), sx = fz, sz = -fx;
    const x = HOME.x + fx * (HOME_D / 2 + 0.3) - sx * 1.2, z = HOME.z + fz * (HOME_D / 2 + 0.3) - sz * 1.2;
    big.push([x, groundHeight(x, z) + 2.5, z]);
  }
  // the village roads from the square to the gates, a post every 9 m on alternate sides; a ring round the square
  for (let k = 0; k < ROAD_N; k++)
    for (let r = 16, i = 0; r <= 60; r += 9, i++) {
      const f = roadFrame(k, r), s = i % 2 ? 1 : -1, off = 3.4;
      pole(f.x + s * f.uz * off, f.z - s * f.ux * off, -s * f.uz, s * f.ux, 3.4);
    }
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + 0.31, x = Math.cos(a) * 13.5, z = Math.sin(a) * 13.5;
    pole(x, z, -Math.cos(a), -Math.sin(a), 3.5);
  }
  // the night carts carry their own (render/NightMarket.tsx puts the cart beside its keeper)
  for (const f of FOLK)
    if (f.cartAt && !['fire', 'juggle', 'sanxian'].includes(f.cart!)) {
      // at the end of the cart's lantern stick (NightMarket.tsx lampStick): 0.95 to its right, 0.9 toward the street
      const [x, z, rot] = f.cartAt, fx = Math.sin(rot), fz = Math.cos(rot), sx = fz, sz = -fx;
      big.push([x + sx * 0.95 + fx * 0.9, groundHeight(x, z) + 2.1, z + sz * 0.95 + fz * 0.9]);
    }
  return { big, small, poles: b };
}

let glowTexture: THREE.Texture | null = null;
function glowTex() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}
function lanternGeo(s: number) {
  const prof = [[0.0, -0.24], [0.1, -0.24], [0.1, -0.21], [0.19, -0.15], [0.23, 0], [0.19, 0.15], [0.1, 0.21], [0.1, 0.24], [0, 0.24]].map(([x, y]) => new THREE.Vector2(x * s, y * s));
  return new THREE.LatheGeometry(prof, 10);
}
const NLIGHT = 6;

export function NightLights({ sim }: { sim: Sim }) {
  const S = useMemo(() => {
    const sp = spots();
    const all = [...sp.big, ...sp.small];
    const mat = new THREE.MeshStandardMaterial({ color: '#c8261b', emissive: '#ff5a1e', emissiveIntensity: 0.15, roughness: 0.7 });
    const make = (list: V3[], s: number) => {
      const im = new THREE.InstancedMesh(lanternGeo(s), mat, list.length);
      const m = new THREE.Matrix4();
      list.forEach((p, i) => im.setMatrixAt(i, m.makeTranslation(p[0], p[1], p[2])));
      im.frustumCulled = false;
      im.castShadow = false;
      return im;
    };
    const big = make(sp.big, 1.25), small = make(sp.small, 0.75);
    // halos: one glowing point per lantern
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.Float32BufferAttribute(all.flat(), 3));
    const halo = new THREE.Points(hg, new THREE.PointsMaterial({ map: glowTex(), color: '#ffab5c', size: 1.7, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 }));
    halo.frustumCulled = false;
    // a warm pool of light on the ground under the big ones
    const pg = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const pmat = new THREE.MeshBasicMaterial({ map: glowTex(), color: '#ff9a4a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: true, toneMapped: false });
    const pools = new THREE.InstancedMesh(pg, pmat, sp.big.length);
    {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(5, 1, 5), v = new THREE.Vector3();
      sp.big.forEach((p, i) => pools.setMatrixAt(i, m.compose(v.set(p[0], groundHeight(p[0], p[2]) + 0.06, p[2]), q, sc)));
    }
    pools.frustumCulled = false;
    pools.renderOrder = 2;
    return { sp, all, mat, big, small, halo, pools, pmat, poles: sp.poles.build() };
  }, []);
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const pickT = useRef(0);
  useFrame((state, dt) => {
    const c = sim.clock, out = sim.indoor < 0;
    // lit from dusk to dawn, a slow flicker
    const lit = out ? Math.min(1, Math.max(0, (0.34 - c.light) / 0.22)) : 0;
    const t = state.clock.elapsedTime;
    S.mat.emissiveIntensity = 0.15 + lit * (2.6 + Math.sin(t * 7.3) * 0.12);
    (S.halo.material as THREE.PointsMaterial).opacity = lit * 0.7;
    S.halo.visible = lit > 0.01;
    S.pmat.opacity = lit * 0.32;
    S.pools.visible = lit > 0.01;
    S.big.visible = S.small.visible = out;
    // the real lights go to the lanterns nearest you, kept apart so they spread over the street
    if ((pickT.current -= dt) <= 0) {
      pickT.current = 0.4;
      const p = sim.player.pos;
      const near = S.sp.big
        .map((q) => ({ q, d: Math.hypot(q[0] - p[0], q[2] - p[2]) }))
        .filter((o) => o.d < 60)
        .sort((a, b) => a.d - b.d);
      const chosen: V3[] = [];
      for (const o of near) {
        if (chosen.length >= NLIGHT) break;
        if (chosen.every((c2) => Math.hypot(c2[0] - o.q[0], c2[2] - o.q[2]) > 6)) chosen.push(o.q);
      }
      lights.current.forEach((L, i) => {
        if (!L) return;
        const q = chosen[i];
        L.visible = true;
        if (q) L.position.set(q[0], q[1] - 0.4, q[2]);
        L.userData.on = !!q;
      });
    }
    for (const L of lights.current) if (L) L.intensity = L.userData.on ? lit * (14 + Math.sin(t * 9 + L.position.x) * 1.2) : 0;
  });
  return (
    <>
      <Built parts={S.poles} />
      <primitive object={S.big} />
      <primitive object={S.small} />
      <primitive object={S.pools} />
      <primitive object={S.halo} />
      {Array.from({ length: NLIGHT }, (_, i) => (
        <pointLight key={i} ref={(l) => (lights.current[i] = l)} color="#ffa25a" intensity={0} distance={13} decay={1.4} />
      ))}
    </>
  );
}

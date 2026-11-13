// 青石集's night market (game/places.ts NIGHT, life 'night'): the carts that come out after dark beside their keepers,
// a wonton carrier's two baskets and stove, a red-hot yam drum, a tangyuan table with stools, a rack of paper lanterns,
// a sugar blower's straw post, a skewer grill, the ring toss mat, the fire breather's torch, the juggler's bowls, the
// blind singer's bench. Steam off the pots, smoke and sparks off the grills, and every few seconds a jet of flame.
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Sim } from '../game/sim';
import { FOLK, type CartKind } from '../game/places';
import { groundHeight } from '../game/world';
import { Builder, Built } from './build';

/** one cart, in its own frame: the street is +z, the keeper stands in front */
function cart(kind: CartKind): Builder {
  const b = new Builder();
  const legs = (w: number, d: number, h: number) => {
    for (const [x, z] of [[-w / 2 + 0.06, -d / 2 + 0.06], [w / 2 - 0.06, -d / 2 + 0.06], [-w / 2 + 0.06, d / 2 - 0.06], [w / 2 - 0.06, d / 2 - 0.06]]) b.box('wood', x, 0, z, 0.06, h, 0.06);
  };
  const stove = (x: number, z: number, r = 0.26, h = 0.55) => {
    b.col('dark', x, 0, z, r, h, 10);
    b.col('flame', x, h * 0.35, z + r * 0.92, r * 0.45, h * 0.3, 6); // the fire mouth
    b.col('bronze', x, h, z, r * 1.05, 0.34, 12); // the pot
    b.col('dark', x, h + 0.34, z, r * 1.1, 0.04, 12);
  };
  const lampStick = () => {
    // the cart's lantern hangs from a bamboo stick at its right (render/NightLights hangs it there)
    b.col('wood', 0.95, 0, -0.1, 0.03, 2.5, 5);
    b.box('wood', 0.95, 2.42, 0.4, 0.04, 0.04, 1.0);
  };
  switch (kind) {
    case 'wonton': {
      for (const s of [-1, 1]) {
        b.col('wood', s * 0.75, 0, 0, 0.3, 0.45, 10);
        b.col('wood', s * 0.75, 0.45, 0, 0.32, 0.05, 10);
      }
      stove(0.75, 0, 0.24, 0.5);
      b.box('white', -0.75, 0.5, 0, 0.36, 0.14, 0.36); // a stack of bowls
      b.box('wood', 0, 1.05, 0, 1.9, 0.06, 0.06); // the carrying pole
      for (const s of [-1, 1]) b.box('dark', s * 0.75, 0.5, 0, 0.02, 0.56, 0.02);
      lampStick();
      break;
    }
    case 'yam': {
      b.col('dark', 0, 0, 0, 0.38, 0.85, 12);
      b.col('flame', 0, 0.5, 0.34, 0.16, 0.18, 6);
      b.col('bronze', 0, 0.85, 0, 0.42, 0.05, 12);
      for (let k = 0; k < 5; k++) b.add('soil', new THREE.SphereGeometry(0.07, 6, 4).scale(1.8, 1, 1), Math.cos(k * 1.3) * 0.2, 0.93, Math.sin(k * 1.3) * 0.2);
      b.box('plank', -0.8, 0.62, 0, 0.7, 0.05, 0.5);
      legs(0.7, 0.5, 0.62);
      lampStick();
      break;
    }
    case 'tangyuan': {
      b.box('plank', 0, 0.72, 0.1, 1.4, 0.06, 0.7);
      for (const [x, z] of [[-0.62, -0.2], [0.62, -0.2], [-0.62, 0.4], [0.62, 0.4]]) b.box('wood', x, 0, z, 0.06, 0.72, 0.06);
      stove(-0.35, 0.05, 0.26, 0.72);
      for (let k = 0; k < 4; k++) b.col('white', 0.2 + (k % 2) * 0.25, 0.78, -0.05 + Math.floor(k / 2) * 0.25, 0.08, 0.06, 8);
      for (const x of [-0.5, 0.5]) {
        b.box('wood', x, 0.38, 1.0, 0.36, 0.05, 0.28);
        for (const [dx, dz] of [[-0.14, -0.1], [0.14, -0.1], [-0.14, 0.1], [0.14, 0.1]]) b.box('wood', x + dx, 0, 1.0 + dz, 0.04, 0.38, 0.04);
      }
      lampStick();
      break;
    }
    case 'lamps': {
      // a frame hung with lanterns of every shape
      for (const x of [-1, 1]) b.col('wood', x, 0, 0, 0.04, 2.1, 5);
      for (const y of [1.2, 1.9]) b.box('wood', 0, y, 0, 2.1, 0.04, 0.04);
      for (let k = 0; k < 7; k++) {
        const x = -0.85 + k * 0.28, y = k % 2 ? 1.05 : 1.75;
        const g = k % 3 === 0 ? new THREE.SphereGeometry(0.13, 10, 8).scale(1, 1.25, 1) : k % 3 === 1 ? new THREE.CylinderGeometry(0.1, 0.1, 0.26, 8) : new THREE.SphereGeometry(0.12, 8, 6).scale(1.3, 0.8, 1);
        b.add(k % 2 ? 'paper' : 'lamp', g, x, y - 0.12, 0);
      }
      b.box('plank', 0, 0.5, 0.35, 1.2, 0.05, 0.5);
      legs(1.2, 0.5, 0.5);
      lampStick();
      break;
    }
    case 'sugar': {
      b.box('plank', 0, 0.72, 0, 0.9, 0.05, 0.55);
      legs(0.9, 0.55, 0.72);
      b.col('hay', 0.25, 0.77, 0, 0.1, 0.95, 8); // the straw post the sugar figures stand in
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2, y = 1.2 + (k % 3) * 0.16;
        b.box('wood', 0.25 + Math.cos(a) * 0.13, y, Math.sin(a) * 0.13, 0.015, 0.3, 0.015);
        b.add('gold', new THREE.SphereGeometry(0.06, 6, 5).scale(1, 1.3, 0.5), 0.25 + Math.cos(a) * 0.17, y + 0.36, Math.sin(a) * 0.17);
      }
      stove(-0.25, 0, 0.14, 0.77);
      lampStick();
      break;
    }
    case 'skewer': {
      b.box('dark', 0, 0.75, 0, 1.5, 0.16, 0.36);
      b.box('flame', 0, 0.91, 0, 1.38, 0.02, 0.26); // the coals
      legs(1.5, 0.36, 0.75);
      for (let k = 0; k < 9; k++) {
        b.box('wood', -0.6 + k * 0.15, 0.95, 0, 0.012, 0.012, 0.5);
        for (let j = 0; j < 3; j++) b.box('soil', -0.6 + k * 0.15, 0.95, -0.08 + j * 0.08, 0.04, 0.04, 0.05);
      }
      lampStick();
      break;
    }
    case 'rings': {
      b.box('cloth', 0, 0, 0, 2.2, 0.03, 1.5);
      for (let k = 0; k < 12; k++) {
        const x = -0.85 + (k % 4) * 0.56, z = -0.5 + Math.floor(k / 4) * 0.5;
        if (k % 3 === 0) b.add('soil', new THREE.SphereGeometry(0.09, 8, 6).scale(1, 1.4, 1), x, 0.15, z);
        else if (k % 3 === 1) b.add('dark', new THREE.SphereGeometry(0.1, 8, 5).scale(1.3, 0.5, 1), x, 0.08, z);
        else b.col('white', x, 0.03, z, 0.07, 0.16, 8);
      }
      b.box('wood', -1.2, 0, 0.9, 0.4, 0.3, 0.3); // a basket of rings
      lampStick();
      break;
    }
    case 'fire': {
      // a torch on a stand, a jar of oil, a basket for coins
      b.col('wood', -0.7, 0, -0.2, 0.035, 1.5, 6);
      b.add('flame', new THREE.ConeGeometry(0.12, 0.35, 8), -0.7, 1.65, -0.2);
      b.col('dark', 0.6, 0, -0.3, 0.16, 0.42, 10);
      b.col('wood', 0.2, 0, 0.6, 0.22, 0.14, 10);
      break;
    }
    case 'juggle': {
      b.box('cloth', 0, 0, 0, 1.8, 0.03, 1.2);
      for (let k = 0; k < 6; k++) b.col('white', 0.6, 0.03 + k * 0.05, -0.4, 0.13, 0.04, 12);
      b.col('wood', -0.6, 0, -0.4, 0.02, 1.1, 5);
      b.col('wood', -0.4, 0, -0.4, 0.02, 1.1, 5);
      break;
    }
    case 'sanxian': {
      b.box('wood', 0, 0.42, -0.3, 0.9, 0.05, 0.32);
      for (const x of [-0.38, 0.38]) b.box('wood', x, 0, -0.3, 0.05, 0.42, 0.28);
      b.col('wood', 0.3, 0, 0.5, 0.12, 0.1, 10); // the bowl for coins
      break;
    }
  }
  return b;
}

// ---- smoke, steam and flame: soft round points with their own size and fade
const VS = `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; varying float vA; varying vec3 vC;
  void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vA = aAlpha; vC = aColor; gl_PointSize = aSize * (420.0 / -mv.z); gl_Position = projectionMatrix * mv; }`;
const FS = `varying float vA; varying vec3 vC;
  void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard; float a = smoothstep(0.5, 0.0, r) * vA; gl_FragColor = vec4(vC, a); }`;
class Puffs {
  n: number;
  pos: Float32Array;
  vel: Float32Array;
  life: Float32Array;
  max: Float32Array;
  size: Float32Array;
  grow: Float32Array;
  alpha: Float32Array;
  a0: Float32Array;
  color: Float32Array;
  geo = new THREE.BufferGeometry();
  pts: THREE.Points;
  next = 0;
  constructor(n: number, additive: boolean) {
    this.n = n;
    this.pos = new Float32Array(n * 3).fill(-1e4);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n).fill(1);
    this.size = new Float32Array(n);
    this.grow = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.a0 = new Float32Array(n);
    this.color = new Float32Array(n * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3));
    this.pts = new THREE.Points(
      this.geo,
      new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }),
    );
    this.pts.frustumCulled = false;
  }
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, grow: number, a: number, c: THREE.Color) {
    const i = this.next++ % this.n;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.life[i] = this.max[i] = life;
    this.size[i] = size;
    this.grow[i] = grow;
    this.a0[i] = a;
    this.color.set([c.r, c.g, c.b], i * 3);
  }
  step(dt: number, drag = 0.6) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const k = i * 3, u = 1 - this.life[i] / this.max[i];
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      this.vel[k] *= 1 - drag * dt;
      this.vel[k + 2] *= 1 - drag * dt;
      this.size[i] += this.grow[i] * dt;
      this.alpha[i] = this.a0[i] * Math.min(1, u * 5) * Math.max(0, this.life[i] / this.max[i]);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
  }
}

const STEAM = new THREE.Color('#e8e4dc'), SMOKE = new THREE.Color('#6b625a'), EMBER = new THREE.Color('#ff8a2a'), FIRE = new THREE.Color('#ff6a1a'), HOT = new THREE.Color('#ffd27a');

export function NightMarket({ sim }: { sim: Sim }) {
  const carts = useMemo(
    () =>
      FOLK.map((f, i) => ({ f, i }))
        .filter(({ f }) => f.cart && f.cartAt)
        .map(({ f, i }) => {
          const [x, z, rot] = f.cartAt!;
          const y = groundHeight(x, z);
          const b = new Builder();
          b.merge(cart(f.cart!), x, y, z, rot);
          return { f, i, x, y, z, rot, parts: b.build() };
        }),
    [],
  );
  const groups = useRef<(THREE.Group | null)[]>([]);
  const fx = useMemo(() => ({ steam: new Puffs(260, false), fire: new Puffs(240, true), flash: { t: 0, x: 0, y: 0, z: 0 }, blowT: carts.map((_, k) => 2 + k * 1.7) }), [carts]);
  const flashLight = useRef<THREE.PointLight>(null);
  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05);
    const out = sim.indoor < 0, p = sim.player.pos;
    // which keepers are out tonight (their fighter isn't away)
    const outNow = new Set<number>();
    for (const f of sim.fighters) {
      const i = (f as any).folk;
      if (i !== undefined && !(f as any).away && f.hp > 0) outNow.add(i);
    }
    carts.forEach((c, k) => {
      const g = groups.current[k];
      const on = out && outNow.has(c.i);
      if (g) g.visible = on;
      if (!on || Math.hypot(c.x - p[0], c.z - p[2]) > 50) return;
      const fx0 = Math.sin(c.rot), fz0 = Math.cos(c.rot), sx = fz0, sz = -fx0;
      const at = (lx: number, ly: number, lz: number): [number, number, number] => [c.x + sx * lx + fx0 * lz, c.y + ly, c.z + sz * lx + fz0 * lz];
      const r = Math.random;
      switch (c.f.cart) {
        case 'wonton':
        case 'tangyuan': {
          const [x, y, z] = c.f.cart === 'wonton' ? at(0.75, 0.9, 0) : at(-0.35, 1.12, 0.05);
          if (r() < dt * 9) fx.steam.emit(x + (r() - 0.5) * 0.2, y, z + (r() - 0.5) * 0.2, (r() - 0.5) * 0.15, 0.55 + r() * 0.3, (r() - 0.5) * 0.15, 2.2, 0.35, 0.5, 0.42, STEAM);
          break;
        }
        case 'yam': {
          const [x, y, z] = at(0, 0.95, 0);
          if (r() < dt * 4) fx.steam.emit(x, y, z, 0, 0.5, 0, 2.6, 0.3, 0.45, 0.3, SMOKE);
          if (r() < dt * 3) fx.fire.emit(x + (r() - 0.5) * 0.3, y, z, (r() - 0.5) * 0.3, 0.9 + r() * 0.6, (r() - 0.5) * 0.3, 0.9, 0.05, 0, 0.9, EMBER);
          break;
        }
        case 'skewer': {
          const [x, y, z] = at((r() - 0.5) * 1.3, 1.0, 0);
          if (r() < dt * 10) fx.steam.emit(x, y, z, (r() - 0.5) * 0.2, 0.7 + r() * 0.3, (r() - 0.5) * 0.2, 2.4, 0.3, 0.6, 0.35, SMOKE);
          if (r() < dt * 7) fx.fire.emit(x, y, z, (r() - 0.5) * 0.4, 1 + r() * 0.8, (r() - 0.5) * 0.4, 0.8, 0.05, 0, 1, EMBER);
          break;
        }
        case 'sugar': {
          const [x, y, z] = at(-0.25, 1.0, 0);
          if (r() < dt * 3) fx.steam.emit(x, y, z, 0, 0.4, 0, 1.6, 0.2, 0.3, 0.3, STEAM);
          break;
        }
        case 'fire': {
          // the torch's own flame, and every few seconds the breather's jet over the street
          const [tx, ty, tz] = at(-0.7, 1.75, -0.2);
          if (r() < dt * 14) fx.fire.emit(tx + (r() - 0.5) * 0.08, ty, tz + (r() - 0.5) * 0.08, 0, 0.8 + r() * 0.5, 0, 0.45, 0.18, -0.2, 0.8, FIRE);
          if ((fx.blowT[k] -= dt) <= 0) fx.blowT[k] = 5 + r() * 3;
          const t = fx.blowT[k];
          if (t > 4.2) {
            // the keeper stands in front of his cart: the jet goes up and out over the street from his mouth
            const kx = c.f.x, kz = c.f.z, ky = groundHeight(kx, kz) + 1.65;
            for (let n = 0; n < 4; n++) {
              const sp = 5 + r() * 3;
              fx.fire.emit(kx + fx0 * 0.3, ky, kz + fz0 * 0.3, fx0 * sp * 0.75 + (r() - 0.5), sp * 0.7 + r(), fz0 * sp * 0.75 + (r() - 0.5), 0.55 + r() * 0.3, 0.35, 1.6, 0.9, r() < 0.3 ? HOT : FIRE);
            }
            fx.flash.t = 0.25;
            fx.flash.x = kx + fx0 * 2;
            fx.flash.y = ky + 1.5;
            fx.flash.z = kz + fz0 * 2;
          }
          break;
        }
      }
    });
    fx.steam.step(dt, 0.4);
    fx.fire.step(dt, 1.2);
    const L = flashLight.current;
    if (L) {
      fx.flash.t -= dt;
      L.position.set(fx.flash.x, fx.flash.y, fx.flash.z);
      L.intensity = fx.flash.t > 0 ? 40 * (fx.flash.t / 0.25) : 0;
    }
  });
  return (
    <>
      {carts.map((c, k) => (
        <group key={k} ref={(g) => (groups.current[k] = g)} visible={false}>
          <Built parts={c.parts} />
        </group>
      ))}
      <primitive object={fx.steam.pts} />
      <primitive object={fx.fire.pts} />
      <pointLight ref={flashLight} color="#ff8a3a" intensity={0} distance={16} decay={1.5} />
    </>
  );
}

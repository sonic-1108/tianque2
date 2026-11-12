// What the kit leaves lasting in the world (game/kit.ts): its zones drawn on the ground for as long as they stand
// (poison fog, arrays, songs, fields, traps), the buffs it puts on a body (shields, parries, thorns, speed, focus,
// a second life, orbiting blades), the marks and charges on foes, and the poison, bleeding and fire they carry.
import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Sim } from '../game/sim';
import type { Fighter, Zone } from '../game/types';
import { kitWorld } from '../game/kit';
import type { VFXSystem } from './vfx/VFXSystem';
import { sigilTex } from './vfx/KitFX';

const additive = (o: Partial<THREE.MeshBasicMaterialParameters> = {}) =>
  new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false, ...o });
let glowTexture: THREE.Texture | null = null;
function glowTex() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.35)');
  g.addColorStop(0.92, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}
const wordTex = new Map<string, THREE.Texture>();
function word(ch: string) {
  let t = wordTex.get(ch);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  x.fillStyle = '#fff';
  x.font = '700 48px "Noto Serif SC", serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(ch, 32, 35);
  t = new THREE.CanvasTexture(c);
  wordTex.set(ch, t);
  return t;
}
/** a shell bright at its rim (facing away from the eye), clear in the middle */
function shellMat(color: string) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uA: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uA; varying vec3 vN; varying vec3 vV;
      void main(){ float r = pow(1.0 - abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(uColor * (0.15 + 1.6*r), (0.06 + 0.9*r) * uA); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}
function pool<T extends THREE.Object3D>(root: THREE.Group, n: number, make: () => T) {
  const items = Array.from({ length: n }, () => {
    const o = make();
    o.visible = false;
    o.frustumCulled = false;
    o.traverse((c) => (c.frustumCulled = false));
    root.add(o);
    return o;
  });
  let used = 0;
  return {
    items,
    reset() {
      used = 0;
    },
    next(): T | null {
      return used < items.length ? items[used++] : null;
    },
    hideRest() {
      for (let k = used; k < items.length; k++) items[k].visible = false;
    },
  };
}
const ZONE_PARTICLE: Record<string, string> = {
  poison: '#4d7c2a', fire: '#ff8a3a', holy: '#fff3c4', shadow: '#2a2540', earth: '#9a8a78', wood: '#6aa84f', ice: '#e0f2fe', gold: '#ffd36a',
};

export function KitAuras({ sim, vfx }: { sim: Sim; vfx: VFXSystem }) {
  const P = useMemo(() => {
    const root = new THREE.Group();
    const zones = pool(root, 18, () => {
      const g = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), additive({ map: glowTex(), opacity: 0.3 }));
      disc.name = 'disc';
      const sig = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), additive({ map: sigilTex(), opacity: 0.6 }));
      sig.name = 'sig';
      sig.position.y = 0.02;
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 40, 1, true).translate(0, 0.5, 0), shellMat('#ffffff'));
      wall.name = 'wall';
      g.add(disc, sig, wall);
      g.renderOrder = 4;
      return g;
    });
    const strips = pool(root, 8, () => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, -0.5), additive({ map: glowTex(), opacity: 0.35 }));
      return m;
    });
    const shells = pool(root, 12, () => new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), shellMat('#93c5fd')));
    const parries = pool(root, 8, () => new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.05, 6, 28, Math.PI * 0.9).rotateX(Math.PI / 2), additive({ color: '#e0f2fe', opacity: 0.9 })));
    const thorns = pool(root, 8, () => {
      const g = new THREE.Group();
      const m = additive({ color: '#f87171', opacity: 0.8 });
      for (let k = 0; k < 10; k++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.38, 5), m);
        const a = (k / 10) * Math.PI * 2;
        c.position.set(Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62);
        c.rotation.set(0, -a, -Math.PI / 2);
        g.add(c);
      }
      return g;
    });
    const feet = pool(root, 12, () => new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), additive({ map: sigilTex(), opacity: 0.7 })));
    const heads = pool(root, 16, () => new THREE.Sprite(new THREE.SpriteMaterial({ map: word('印'), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })));
    const orbs = pool(root, 24, () => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), additive({ color: '#ffffff', opacity: 0.95 })));
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#a7f3d0', transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
      s.scale.setScalar(0.7);
      s.name = 'glow';
      g.add(s);
      return g;
    });
    return { root, zones, strips, shells, parries, thorns, feet, heads, orbs };
  }, []);
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, dtRaw) => {
    const time = state.clock.elapsedTime;
    const dt = Math.min(0.1, dtRaw);
    const pl = sim.player;
    const near = (x: number, z: number, r: number) => Math.abs(x - pl.pos[0]) < r && Math.abs(z - pl.pos[2]) < r;
    for (const k of ['zones', 'strips', 'shells', 'parries', 'thorns', 'feet', 'heads', 'orbs'] as const) P[k].reset();
    const outdoors = sim.indoor < 0;
    const emit = (rate: number) => Math.random() < rate * dt;

    // ---- zones
    if (outdoors)
      for (const z of sim.zones as Zone[]) {
        const a = z.data.kit, trap = z.data.trap;
        if ((!a && !trap) || !near(z.x, z.z, 70)) continue;
        const owner = sim.fighters[z.owner];
        const mine = owner && (owner.team === 'player' || owner.team === 'ally');
        const fade = Math.min(1, z.age / 0.3) * Math.min(1, z.t / 0.5);
        const color = z.color;
        if (a?.line) {
          const m = P.strips.next();
          if (!m) continue;
          m.visible = true;
          m.position.set(z.x, z.y + 0.08, z.z);
          m.rotation.set(0, Math.atan2(-z.data.fx, -z.data.fz), 0);
          m.scale.set(a.r * 2, 1, a.line);
          const mat = m.material as THREE.MeshBasicMaterial;
          mat.color.set(color);
          mat.opacity = 0.45 * fade * (0.8 + 0.2 * Math.sin(time * 6));
          if (emit(14)) {
            const u = Math.random() * a.line, w = (Math.random() - 0.5) * a.r * 2;
            v.set(z.x + z.data.fx * u + z.data.fz * w, z.y + 0.2, z.z + z.data.fz * u - z.data.fx * w);
            vfx.embers(v, 3, color, 0.3, 1.6, 0.07);
          }
          continue;
        }
        const g = P.zones.next();
        if (!g) continue;
        const r = trap ? trap.r : z.r;
        g.visible = true;
        g.position.set(z.x, z.y + 0.06, z.z);
        g.scale.set(r, 1, r);
        const disc = g.getObjectByName('disc') as THREE.Mesh, sig = g.getObjectByName('sig') as THREE.Mesh, wall = g.getObjectByName('wall') as THREE.Mesh;
        const seen = trap ? (mine ? 0.55 : 0.18) : 1;
        (disc.material as THREE.MeshBasicMaterial).color.set(color);
        (disc.material as THREE.MeshBasicMaterial).opacity = 0.3 * fade * seen * (0.85 + 0.15 * Math.sin(time * 3 + z.x));
        (sig.material as THREE.MeshBasicMaterial).color.set(color);
        (sig.material as THREE.MeshBasicMaterial).opacity = 0.7 * fade * seen;
        sig.rotation.y = time * (trap ? 2 : 0.5) + z.x;
        const kind: string | undefined = a?.fx;
        // a low wall of light at the rim: fields and songs and fog show where they end
        wall.visible = !trap;
        wall.scale.set(1, kind === 'poison' || kind === 'shadow' ? 1.6 : 0.9, 1);
        (wall.material as THREE.ShaderMaterial).uniforms.uColor.value.set(color);
        (wall.material as THREE.ShaderMaterial).uniforms.uA.value = 0.55 * fade;
        if (trap || !near(z.x, z.z, 50)) continue;
        // what rises from it
        const rate = 6 + z.r * 4;
        if (emit(rate)) {
          const ang = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * z.r;
          v.set(z.x + Math.cos(ang) * d, z.y + 0.15, z.z + Math.sin(ang) * d);
          const pc = ZONE_PARTICLE[kind ?? ''] ?? color;
          if (kind === 'poison' || kind === 'shadow') vfx.dustPuff(v, 2, 0.5, 0.8, 1.2, pc);
          else if (kind === 'earth') vfx.dustPuff(v, 2, 0.4, 1.2, 0.8, pc);
          else if (kind === 'lightning' && Math.random() < 0.15) vfx.tracer(v.clone().setY(z.y + 7), v.clone(), '#e6f0ff');
          else vfx.embers(v, 2, pc, 0.2, kind === 'fire' ? 3.2 : 2, 0.08);
        }
        if (kind === 'sound' && Math.floor(z.age * 2.2) !== Math.floor((z.age - dt) * 2.2)) vfx.ring(v.set(z.x, z.y + 1, z.z), z.r * 0.9, color, 0.5, 0.06, 0);
      }

    // ---- bodies
    const W = kitWorld(sim);
    for (const f of sim.fighters as Fighter[]) {
      if (f.hp <= 0 || (f as any).benched || (f as any).away || !near(f.pos[0], f.pos[2], 45)) continue;
      if (!outdoors && f.team !== 'player') continue;
      const K = (f as any).kit;
      const dots = W.dots.filter((d) => d.tgt === f.id && d.t > 0);
      const x = f.pos[0], y = f.pos[1], z = f.pos[2];
      if (dots.length) {
        for (const d of dots) {
          v.set(x + (Math.random() - 0.5) * 0.6, y + 0.6 + Math.random() * 1.1, z + (Math.random() - 0.5) * 0.6);
          if (d.kind === 'poison' && emit(10)) vfx.embers(v, 1, '#84cc16', 0.15, 1.2, 0.08);
          if (d.kind === 'bleed' && emit(9)) vfx.sparkBurst(v, 2, '#b3121f', 1.5, 0.06);
          if (d.kind === 'burn' && emit(14)) vfx.embers(v, 2, '#ff8a3a', 0.2, 2.6, 0.08);
        }
      }
      if (!K) continue;
      // a shield: absorb in the house's blue, 免疫 in gold
      if (K.absorb > 0 || K.immune > 0) {
        const m = P.shells.next();
        if (m) {
          m.visible = true;
          m.position.set(x, y + 1.0, z);
          m.scale.set(0.85, 1.15, 0.85).multiplyScalar(1 + 0.03 * Math.sin(time * 7));
          const u = (m.material as THREE.ShaderMaterial).uniforms;
          u.uColor.value.set(K.immune > 0 ? '#ffd36a' : '#93c5fd');
          u.uA.value = Math.min(1, (K.immune > 0 ? K.immune : K.absorb) * 2);
        }
      }
      if (K.parry > 0) {
        const m = P.parries.next();
        if (m) {
          m.visible = true;
          m.position.set(x, y + 1.15, z);
          m.rotation.set(Math.sin(time * 9) * 0.25, f.yaw + Math.PI * 0.55, 0, 'YXZ');
          (m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, K.parry * 3) * (0.7 + 0.3 * Math.sin(time * 20));
        }
      }
      if (K.thorns > 0) {
        const m = P.thorns.next();
        if (m) {
          m.visible = true;
          m.position.set(x, y + 0.9, z);
          m.rotation.y = time * 1.5;
        }
      }
      const footColor = K.speed > 0 ? '#bae6fd' : K.regen > 0 ? '#86efac' : K.focus > 0 ? '#fde68a' : K.evade > 0 ? '#e9d5ff' : K.qiBlade > 0 || K.bleedHits > 0 ? (K.bleedHits > 0 ? '#fb7185' : '#bfe8ff') : null;
      if (footColor) {
        const m = P.feet.next();
        if (m) {
          m.visible = true;
          m.position.set(x, y + 0.07, z);
          m.scale.setScalar(K.speed > 0 ? 0.7 : 0.55);
          m.rotation.y = time * (K.speed > 0 ? 6 : 1.2);
          (m.material as THREE.MeshBasicMaterial).color.set(footColor);
        }
        v.set(x + (Math.random() - 0.5) * 0.7, y + 0.2 + Math.random() * 1.4, z + (Math.random() - 0.5) * 0.7);
        if (K.regen > 0 && emit(10)) vfx.embers(v, 1, '#86efac', 0.2, 1.8, 0.07);
        if (K.evade > 0 && emit(8)) vfx.sparkBurst(v, 2, '#e9d5ff', 1, 0.05);
        if (K.speed > 0 && emit(12)) vfx.dustPuff(v.setY(y + 0.1), 1, 0.2, 1.2, 0.4);
        if ((K.qiBlade > 0 || K.bleedHits > 0 || K.focus > 0) && emit(8)) vfx.sparkBurst(v, 2, footColor, 1.2, 0.05);
      }
      // over the head: marks (印 ×n), a planted charge (种), a second life (免)
      const words: [string, string][] = [];
      for (let k = 0; k < Math.min(3, K.marks ?? 0); k++) if (K.markT > 0) words.push(['印', '#ef4444']);
      if (K.seed) words.push(['种', '#a78bfa']);
      if (K.cheat > 0) words.push(['免', '#ffd36a']);
      words.forEach(([ch, c], k) => {
        const s = P.heads.next();
        if (!s) return;
        s.visible = true;
        const n = words.length;
        s.position.set(x + (k - (n - 1) / 2) * 0.42, y + 2.45 + Math.sin(time * 3 + k) * 0.05, z);
        s.scale.setScalar(0.42);
        s.material.map = word(ch);
        s.material.color.set(c);
      });
      if (K.orbit) {
        const O = K.orbit;
        for (let k = 0; k < O.n; k++) {
          const g = P.orbs.next();
          if (!g) break;
          const ang = O.a + (k / O.n) * Math.PI * 2;
          g.visible = true;
          g.position.set(x + Math.cos(ang) * O.r, y + 1.1 + Math.sin(ang * 2) * 0.12, z + Math.sin(ang) * O.r);
        }
      }
    }
    for (const k of ['zones', 'strips', 'shells', 'parries', 'thorns', 'feet', 'heads', 'orbs'] as const) P[k].hideRest();
  });
  return <primitive object={P.root} />;
}

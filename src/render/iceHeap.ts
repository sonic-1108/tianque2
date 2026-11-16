// 冰封's ice, one heap per frozen body (render/Frozen.tsx runs them): the body stands inside a single rough crystal of
// clear ice from the ground to over the head, its facets edged in light, spikes of ice grown out of it at angles,
// frost spread on the ground round it, a cold glow inside. Knocks of A / D shake it and light up its edges as it
// cracks; broken out, the crystal bursts into lumps that fly and fall; let melt, it sinks and fades.
import * as THREE from 'three';

let seedV = 1;
const rnd = () => ((seedV = (seedV * 9301 + 49297) % 233280) / 233280);

/** a rough lump of ice: an icosahedron pulled out of shape (flat shaded, so its faces catch the light) */
function lump(seed: number) {
  seedV = seed;
  const g = new THREE.IcosahedronGeometry(1, 0);
  const p = g.attributes.position as THREE.BufferAttribute;
  const k = new Map<string, [number, number, number]>();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!k.has(key)) k.set(key, [0.75 + rnd() * 0.5, 0.8 + rnd() * 0.7, 0.75 + rnd() * 0.5]);
    const m = k.get(key)!;
    p.setXYZ(i, p.getX(i) * m[0], p.getY(i) * m[1], p.getZ(i) * m[2]);
  }
  g.computeVertexNormals();
  return g;
}

/** the crystal round the body: a finer icosahedron, every corner pushed in or out (corners shared by faces move
 * together, so it stays whole), stretched tall */
function crystal(seed: number) {
  seedV = seed;
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position as THREE.BufferAttribute;
  const k = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!k.has(key)) k.set(key, 0.84 + rnd() * 0.32);
    const m = k.get(key)!;
    p.setXYZ(i, p.getX(i) * m, p.getY(i) * m, p.getZ(i) * m);
  }
  g.computeVertexNormals();
  return g;
}

/** a spike of ice: a six-sided crystal with a point, its foot at the origin, growing up +y (also the ice that
 * erupts from the ground under an ice blow: VFXSystem.iceSpikes) */
export function iceSpikeGeometry() {
  return spike();
}
function spike() {
  const body = new THREE.CylinderGeometry(0.8, 1, 1, 6, 1).translate(0, 0.5, 0);
  const tip = new THREE.ConeGeometry(0.8, 0.9, 6, 1).translate(0, 1.45, 0);
  const g = new THREE.BufferGeometry();
  const a = body.toNonIndexed(), b = tip.toNonIndexed();
  const pos = new Float32Array([...(a.attributes.position.array as Float32Array), ...(b.attributes.position.array as Float32Array)]);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function frostTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)');
  gr.addColorStop(0.45, 'rgba(225,245,255,0.65)');
  gr.addColorStop(1, 'rgba(225,245,255,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 128, 128);
  // frost feathers reaching out
  x.strokeStyle = 'rgba(255,255,255,0.8)';
  seedV = 77;
  for (let k = 0; k < 26; k++) {
    const a = rnd() * Math.PI * 2, r0 = 10 + rnd() * 14, r1 = 34 + rnd() * 26;
    x.lineWidth = 1 + rnd() * 1.5;
    x.beginPath();
    x.moveTo(64 + Math.cos(a) * r0, 64 + Math.sin(a) * r0);
    x.lineTo(64 + Math.cos(a) * r1, 64 + Math.sin(a) * r1);
    x.stroke();
  }
  return new THREE.CanvasTexture(c);
}

const SPIKES = 10, LUMPS = 12;
let shared: { cry: THREE.BufferGeometry; edges: THREE.BufferGeometry; spike: THREE.BufferGeometry; lumps: THREE.BufferGeometry[]; frost: THREE.Texture } | null = null;

export interface IceHeap {
  g: THREE.Group;
  /** frozen: grow 0..1 as it forms, crack 0..1 (knocks so far of those needed), knock 0..1 (just struck) */
  hold(grow: number, crack: number, knock: number, time: number): void;
  /** it comes apart: burst (broken out) or melt */
  release(burst: boolean): void;
  /** while it comes apart; false once it's gone */
  fall(dt: number): boolean;
}

export function makeIceHeap(h: number): IceHeap {
  shared ??= (() => {
    const cry = crystal(4242);
    return { cry, edges: new THREE.EdgesGeometry(cry, 12), spike: spike(), lumps: Array.from({ length: 5 }, (_, k) => lump(k * 37 + 11)), frost: frostTex() };
  })();
  const S = shared;
  const g = new THREE.Group();
  g.visible = false;
  // the crystal: its far side drawn first, darker, then its near side clear, so it reads as a thick lump of ice
  const back = new THREE.Mesh(S.cry, new THREE.MeshStandardMaterial({ color: '#9fd6f5', emissive: '#4aa8e0', emissiveIntensity: 0.25, roughness: 0.1, transparent: true, opacity: 0.35, flatShading: true, side: THREE.BackSide, depthWrite: false }));
  const front = new THREE.Mesh(S.cry, new THREE.MeshStandardMaterial({ color: '#d9f3ff', emissive: '#5ec2ff', emissiveIntensity: 0.4, roughness: 0.03, metalness: 0.05, transparent: true, opacity: 0.46, flatShading: true, depthWrite: false }));
  const edgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color('#e9fbff').multiplyScalar(1.3), transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false });
  const edges = new THREE.LineSegments(S.edges, edgeMat);
  const coffin = new THREE.Group();
  coffin.add(back, front, edges);
  back.renderOrder = 7;
  front.renderOrder = 8;
  edges.renderOrder = 9;
  coffin.position.y = 0.98;
  coffin.rotation.y = h * 1.7;
  const coffinScale = new THREE.Vector3(0.62, 1.14, 0.56);
  g.add(coffin);
  // spikes grown out of it, leaning out, a ring low down and a few higher on the shoulders
  seedV = 900 + h * 13;
  const spikeMat = new THREE.MeshStandardMaterial({ color: '#e8f8ff', emissive: '#6cc8ff', emissiveIntensity: 0.55, roughness: 0.04, transparent: true, opacity: 0.86, flatShading: true });
  const spikes = Array.from({ length: SPIKES }, (_, k) => {
    const m = new THREE.Mesh(S.spike, spikeMat);
    const low = k < 6, a = (k / (low ? 6 : 4)) * Math.PI * 2 + (low ? 0 : 0.6) + rnd() * 0.5;
    const y = low ? 0.05 + rnd() * 0.25 : 1.0 + rnd() * 0.55, r = low ? 0.42 : 0.5;
    const lean = low ? 0.5 + rnd() * 0.45 : 0.9 + rnd() * 0.4;
    m.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    // lean out from the body: turn about the horizontal axis at right angles to the way out
    m.quaternion.setFromAxisAngle(new THREE.Vector3(Math.sin(a), 0, -Math.cos(a)), lean);
    const w = low ? 0.1 + rnd() * 0.06 : 0.065 + rnd() * 0.04, L = low ? 0.38 + rnd() * 0.28 : 0.2 + rnd() * 0.16;
    const size = new THREE.Vector3(w, L, w);
    m.scale.copy(size);
    m.renderOrder = 6;
    g.add(m);
    return { m, size, home: m.position.clone(), out: new THREE.Vector3(Math.cos(a), 0.3, Math.sin(a)), vel: new THREE.Vector3(), spin: new THREE.Vector3() };
  });
  // frost on the ground
  const frost = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: S.frost, color: '#eaf8ff', transparent: true, opacity: 0.8, depthWrite: false }));
  frost.position.y = 0.04;
  frost.rotation.y = h;
  frost.renderOrder = 3;
  g.add(frost);
  // the cold glow inside
  const glow = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: '#a8e4ff', transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.set(0.5, 0.95, 0.5);
  glow.position.y = 0.95;
  g.add(glow);
  // the lumps it breaks into (hidden while it holds)
  const lumpMat = new THREE.MeshStandardMaterial({ color: '#e2f6ff', emissive: '#86d2ff', emissiveIntensity: 0.4, roughness: 0.05, transparent: true, opacity: 0.85, flatShading: true });
  const lumps = Array.from({ length: LUMPS }, (_, k) => {
    const m = new THREE.Mesh(S.lumps[(k + h) % S.lumps.length], lumpMat);
    m.visible = false;
    g.add(m);
    return { m, vel: new THREE.Vector3(), spin: new THREE.Vector3(), size: 0.12 + rnd() * 0.12 };
  });
  let mode: 'hold' | 'burst' | 'melt' = 'hold', t = 0;
  const mats = [back.material, front.material, spikeMat, lumpMat] as THREE.MeshStandardMaterial[];
  const base = mats.map((m) => m.opacity);

  return {
    g,
    hold(grow, crack, knock, time) {
      mode = 'hold';
      t = 0;
      g.visible = true;
      // it rises out of the ground round the body, spikes shooting out a beat later
      const u = 1 - (1 - grow) * (1 - grow);
      coffin.visible = true;
      coffin.scale.set(coffinScale.x * (0.6 + 0.4 * u), coffinScale.y * u, coffinScale.z * (0.6 + 0.4 * u));
      coffin.position.y = 0.98 * u;
      coffin.position.x = (Math.random() - 0.5) * 0.07 * knock;
      coffin.position.z = (Math.random() - 0.5) * 0.07 * knock;
      spikes.forEach((s, k) => {
        const v = Math.max(0, Math.min(1, grow * 1.6 - k * 0.04 - 0.3));
        s.m.visible = v > 0;
        s.m.scale.copy(s.size).multiplyScalar(Math.max(0.001, v));
        s.m.position.copy(s.home).addScaledVector(s.out, crack * 0.08);
      });
      for (const l of lumps) l.m.visible = false;
      frost.visible = true;
      frost.scale.setScalar(0.4 + 0.6 * u);
      (frost.material as THREE.MeshBasicMaterial).opacity = 0.8;
      // a cold shimmer, a flash at each knock, the edges brightening as it cracks
      const pulse = Math.sin(time * 3 + h) * 0.08;
      (front.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + pulse + knock * 0.6;
      (front.material as THREE.MeshStandardMaterial).opacity = base[1] * (1 - crack * 0.25);
      spikeMat.emissiveIntensity = 0.55 + pulse + knock * 0.5;
      edgeMat.opacity = 0.45 + crack * 0.5 + knock * 0.3;
      glow.visible = true;
      (glow.material as THREE.MeshBasicMaterial).opacity = 0.16 + 0.07 * Math.sin(time * 4) + knock * 0.2;
      for (let i = 0; i < mats.length; i++) if (i !== 1) mats[i].opacity = base[i];
    },
    release(burst) {
      mode = burst ? 'burst' : 'melt';
      t = 0;
      glow.visible = false;
      if (burst) {
        // the crystal is gone at once, flying apart in lumps; the spikes snap off and fly too
        coffin.visible = false;
        for (const l of lumps) {
          const a = Math.random() * Math.PI * 2, y = 0.2 + Math.random() * 1.7;
          l.m.visible = true;
          l.m.position.set(Math.cos(a) * 0.4, y, Math.sin(a) * 0.4);
          l.m.scale.setScalar(l.size);
          l.vel.set(Math.cos(a) * (2.5 + Math.random() * 3), 1.5 + Math.random() * 4, Math.sin(a) * (2.5 + Math.random() * 3));
          l.spin.set(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5);
        }
        for (const s of spikes) {
          s.vel.copy(s.out).multiplyScalar(3 + Math.random() * 3);
          s.vel.y = 2 + Math.random() * 3;
          s.spin.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4);
        }
      }
    },
    fall(dt) {
      t += dt;
      const life = mode === 'burst' ? 0.95 : 1.3, k = Math.max(0, 1 - t / life);
      if (mode === 'burst') {
        const move = (o: THREE.Object3D, v: THREE.Vector3, sp: THREE.Vector3) => {
          v.y -= 9.8 * dt;
          o.position.addScaledVector(v, dt);
          o.rotation.x += sp.x * dt;
          o.rotation.y += sp.y * dt;
          o.rotation.z += sp.z * dt;
          if (o.position.y < 0.06) {
            o.position.y = 0.06;
            v.multiplyScalar(0.35);
          }
        };
        for (const l of lumps) move(l.m, l.vel, l.spin);
        for (const s of spikes) move(s.m, s.vel, s.spin);
      } else {
        // melting: it sinks into its own frost and goes clear
        coffin.position.y -= dt * 0.5;
        coffin.scale.multiplyScalar(1 - dt * 0.35);
        for (const s of spikes) s.m.scale.multiplyScalar(1 - dt * 1.2);
      }
      for (let i = 0; i < mats.length; i++) mats[i].opacity = base[i] * k;
      edgeMat.opacity = 0.5 * k;
      (frost.material as THREE.MeshBasicMaterial).opacity = 0.8 * k;
      if (t > life) {
        g.visible = false;
        return false;
      }
      return true;
    },
  };
}

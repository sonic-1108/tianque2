// The kit's own shapes of light (game/kit.ts sends them as kitArc / kitBeam / kitSigil through sim.vq): the sweep of a
// cone strike drawn at its real reach and width, the strip of a line strike, the house's circle under every cast.
// Pooled meshes, additive, faded on the sim clock by VFXSystem.update.
import * as THREE from 'three';
import { sigilOf, type SigilStyle } from './sigils';

/** the old single circle, kept for callers that name no house */
export function sigilTex() {
  return sigilOf('bagua');
}
/** across a strip: dark at the edges, bright in the middle */
let stripTexture: THREE.Texture | null = null;
function stripTex() {
  if (stripTexture) return stripTexture;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 4;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(0.65, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 4);
  stripTexture = new THREE.CanvasTexture(c);
  return stripTexture;
}
const addMat = (map?: THREE.Texture, vc = false) =>
  new THREE.MeshBasicMaterial({ map, vertexColors: vc, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false });

interface Item {
  mesh: THREE.Mesh;
  life: number;
  max: number;
  spin: number;
  grow: number;
  base: number;
  wait: number; // seconds before it shows (ripples, second cuts)
}

/** each house's look: its circle, how its sweeps and strips are drawn, what its blows throw off */
export interface HouseLook {
  sigil: SigilStyle;
  arc: 'blade' | 'thin' | 'twin' | 'claw' | 'ripple' | 'heavy' | 'wave' | 'shock' | 'mist';
  beam: 'beam' | 'spear' | 'lightning' | 'qi' | 'arrow' | 'claw';
}
export const HOUSE_LOOK: Record<string, HouseLook> = {
  kuangren: { sigil: 'crack', arc: 'heavy', beam: 'beam' },
  anqi: { sigil: 'star', arc: 'thin', beam: 'arrow' },
  fanyin: { sigil: 'lotus', arc: 'wave', beam: 'qi' },
  yingren: { sigil: 'moon', arc: 'twin', beam: 'beam' },
  tianzi: { sigil: 'seal', arc: 'heavy', beam: 'spear' },
  jiaoyi: { sigil: 'coin', arc: 'blade', beam: 'beam' },
  dixian: { sigil: 'leaf', arc: 'wave', beam: 'qi' },
  jianke: { sigil: 'sword', arc: 'thin', beam: 'spear' },
  qiangwang: { sigil: 'spear', arc: 'blade', beam: 'spear' },
  quanshi: { sigil: 'taiji', arc: 'shock', beam: 'qi' },
  fushi: { sigil: 'bagua', arc: 'blade', beam: 'lightning' },
  qinshi: { sigil: 'qin', arc: 'ripple', beam: 'qi' },
  yushou: { sigil: 'beast', arc: 'claw', beam: 'claw' },
  duzong: { sigil: 'poison', arc: 'mist', beam: 'beam' },
  gongshou: { sigil: 'target', arc: 'thin', beam: 'arrow' },
  shuangdao: { sigil: 'twin', arc: 'twin', beam: 'beam' },
  qizong: { sigil: 'cloud', arc: 'wave', beam: 'qi' },
  jiguan: { sigil: 'gear', arc: 'blade', beam: 'lightning' },
};
export const lookOf = (house?: string): HouseLook => HOUSE_LOOK[house ?? ''] ?? { sigil: 'bagua', arc: 'blade', beam: 'beam' };

/** a flat crescent fan, bright toward the rim (sharp: how thin that bright band is), the leading edge brightest */
function fanGeometry(r: number, spread: number, sharp = 2.2, inner = 0.25, even = false) {
  const seg = 32, rings = 6;
  const pos: number[] = [], colr: number[] = [], idx: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const u = i / rings, rr = r * (inner + (1 - inner) * u);
    for (let j = 0; j <= seg; j++) {
      const v = j / seg, a = -spread + 2 * spread * v;
      const edge = Math.sin(Math.PI * Math.min(1, v * 1.04));
      const b = Math.pow(u, sharp) * (even ? 1 : 0.35 + 0.65 * v) * edge;
      pos.push(Math.sin(a) * rr, 0, -Math.cos(a) * rr);
      colr.push(b, b, b);
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < seg; j++) {
      const a = i * (seg + 1) + j, b = a + seg + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  g.setIndex(idx);
  return g;
}

export class KitFX {
  root = new THREE.Group();
  private arcs: Item[] = [];
  private beams: Item[] = [];
  private sigils: Item[] = [];
  private tips: Item[] = [];
  private v = new THREE.Vector3();
  private q = new THREE.Quaternion();
  constructor() {
    const item = (mesh: THREE.Mesh): Item => ({ mesh, life: 0, max: 1, spin: 0, grow: 0, base: 1, wait: 0 });
    for (let k = 0; k < 28; k++) {
      const m = new THREE.Mesh(new THREE.BufferGeometry(), addMat(undefined, true));
      m.visible = false;
      m.frustumCulled = false;
      m.renderOrder = 6;
      this.root.add(m);
      this.arcs.push(item(m));
    }
    for (let k = 0; k < 28; k++) {
      const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, -0.5);
      const m = new THREE.Mesh(g, addMat(stripTex()));
      // a second, upright strip so the beam reads from the side too (the gradient runs up it)
      const up = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(0, 0, -0.5), m.material);
      m.add(up);
      m.visible = false;
      m.frustumCulled = up.frustumCulled = false;
      m.renderOrder = 6;
      this.root.add(m);
      this.beams.push(item(m));
    }
    for (let k = 0; k < 20; k++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), addMat(sigilTex()));
      m.visible = false;
      m.renderOrder = 5;
      this.root.add(m);
      this.sigils.push(item(m));
    }
    // spearheads of light at the end of a thrust
    for (let k = 0; k < 8; k++) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 4, 1).rotateX(-Math.PI / 2).translate(0, 0, -0.45), addMat());
      m.visible = false;
      m.frustumCulled = false;
      m.renderOrder = 6;
      this.root.add(m);
      this.tips.push(item(m));
    }
  }
  private take(list: Item[]) {
    return list.find((x) => x.life <= 0) ?? list.reduce((a, b) => (a.life < b.life ? a : b));
  }
  private fan(pos: THREE.Vector3, yaw: number, r: number, spread: number, color: THREE.ColorRepresentation, life: number, tilt: number, o: { sharp?: number; inner?: number; even?: boolean; grow?: number; wait?: number; bright?: number; roll?: number } = {}) {
    const it = this.take(this.arcs);
    it.mesh.geometry.dispose();
    it.mesh.geometry = fanGeometry(r, Math.max(0.1, Math.min(Math.PI, spread)), o.sharp, o.inner, o.even);
    (it.mesh.material as THREE.MeshBasicMaterial).color.set(color).multiplyScalar(o.bright ?? 1.6);
    (it.mesh.material as THREE.MeshBasicMaterial).opacity = 0;
    it.mesh.position.copy(pos);
    it.mesh.rotation.set(tilt, yaw, o.roll ?? 0, 'YXZ');
    it.base = 0.7;
    it.grow = o.grow ?? 0.3;
    it.mesh.scale.setScalar(it.base);
    it.wait = o.wait ?? 0;
    it.mesh.visible = it.wait <= 0;
    it.life = it.max = life;
  }
  /** a cone strike's sweep, drawn the house's way: centred on yaw (the way -z turns), reach r, half-width spread */
  arc(pos: THREE.Vector3, yaw: number, r: number, spread: number, color: THREE.ColorRepresentation, life = 0.24, tilt = 0, house?: string) {
    const L = lookOf(house);
    switch (L.arc) {
      case 'thin': // 剑客 弓手 暗器: two hair-thin cuts, the second a beat late
        this.fan(pos, yaw, r * 1.05, spread, color, life * 0.8, tilt, { sharp: 9, inner: 0.6, bright: 2.4 });
        this.fan(pos, yaw, r * 0.85, spread * 0.9, '#ffffff', life * 0.7, tilt - 0.15, { sharp: 12, inner: 0.7, bright: 1.6, wait: 0.06 });
        return;
      case 'twin': // 双刀客 影刃: two blades crossing in an X
        this.fan(pos, yaw, r, spread, color, life, 0.55, { sharp: 5, inner: 0.5, roll: 0.4 });
        this.fan(pos, yaw, r, spread, color, life, -0.55, { sharp: 5, inner: 0.5, roll: -0.4, wait: 0.05 });
        return;
      case 'heavy': // 狂刃 天子: a broad slab of a swing, and its echo along the ground
        this.fan(pos, yaw, r * 1.1, spread, color, life * 1.3, tilt, { sharp: 1.2, inner: 0.15, grow: 0.45, bright: 1.9 });
        this.fan(this.v.copy(pos).setY(pos.y - 0.75), yaw, r, spread, color, life * 1.5, 0, { sharp: 1.6, inner: 0.1, grow: 0.5 });
        return;
      case 'wave': // 气宗 梵音 地仙: a soft wall of force pushing out
        this.fan(pos, yaw, r, spread, color, life * 1.6, 0, { sharp: 0.8, inner: 0.05, even: true, grow: 0.9, bright: 0.9 });
        this.fan(pos, yaw, r * 0.6, spread, '#ffffff', life * 1.2, 0, { sharp: 3, inner: 0.4, even: true, grow: 0.9, bright: 0.7, wait: 0.05 });
        return;
      case 'ripple': // 琴师: rings of sound one after another
        for (let k = 0; k < 4; k++) this.fan(pos, yaw, r * (0.35 + k * 0.22), spread, color, life * 1.1, 0, { sharp: 14, inner: 0.85, even: true, grow: 0.25, wait: k * 0.06, bright: 2 });
        return;
      case 'shock': // 拳师: a short punch of air and a burst at the end of it
        this.fan(pos, yaw, r, spread * 0.7, color, life, 0, { sharp: 0.9, inner: 0.1, even: true, grow: 0.6, bright: 1.4 });
        this.fan(pos, yaw, r * 1.1, spread * 0.8, '#ffffff', life * 0.7, 0, { sharp: 10, inner: 0.8, even: true, grow: 0.5, wait: 0.04 });
        return;
      case 'claw': { // 御兽师: three raking claw marks
        for (let k = -1; k <= 1; k++) {
          const a = yaw + k * spread * 0.45;
          this.v.set(pos.x - Math.sin(a) * r * 0.15, pos.y + k * 0.12, pos.z - Math.cos(a) * r * 0.15);
          this.fan(this.v, a, r, 0.12, color, life, 1.1 + k * 0.1, { sharp: 1.5, inner: 0.2, even: true, bright: 2.2, wait: (k + 1) * 0.04 });
        }
        return;
      }
      case 'mist': // 毒宗: no blade, the cloud is drawn by the sim's puffs; a faint ground sheen
        this.fan(this.v.copy(pos).setY(pos.y - 0.9), yaw, r, spread, color, life * 2, 0, { sharp: 0.6, inner: 0.05, even: true, grow: 0.6, bright: 0.6 });
        return;
      default:
        this.fan(pos, yaw, r, spread, color, life, tilt, {});
    }
  }
  private strip(from: THREE.Vector3, to: THREE.Vector3, w: number, color: THREE.ColorRepresentation, life: number, bright = 1.5, wait = 0) {
    const it = this.take(this.beams);
    const d = this.v.copy(to).sub(from), L = d.length() || 0.1;
    it.mesh.position.copy(from);
    it.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), d.normalize());
    it.mesh.scale.set(w, w, L);
    (it.mesh.material as THREE.MeshBasicMaterial).color.set(color).multiplyScalar(bright);
    it.wait = wait;
    it.mesh.visible = wait <= 0;
    it.life = it.max = life;
    it.base = w;
    return it;
  }
  /** a line strike's strip, from → to, width w, the house's way */
  beam(from: THREE.Vector3, to: THREE.Vector3, w: number, color: THREE.ColorRepresentation, life = 0.3, house?: string) {
    const L = lookOf(house);
    switch (L.beam) {
      case 'spear': { // a narrow white-hot core, a wide faint shaft, a spearhead of light at the end
        this.strip(from, to, w * 0.25, '#ffffff', life * 0.8, 2);
        this.strip(from, to, w, color, life, 1.1);
        const t = this.take(this.tips);
        t.mesh.position.copy(to);
        this.q.setFromUnitVectors(new THREE.Vector3(0, 0, -1), this.v.copy(to).sub(from).normalize());
        t.mesh.quaternion.copy(this.q);
        t.mesh.scale.setScalar(Math.max(0.8, w));
        (t.mesh.material as THREE.MeshBasicMaterial).color.set(color).multiplyScalar(2);
        t.mesh.visible = true;
        t.wait = 0;
        t.life = t.max = life;
        t.base = Math.max(0.8, w);
        return;
      }
      case 'lightning': { // a crooked bolt in pieces
        const n = 5, d = to.clone().sub(from);
        let a = from.clone();
        for (let k = 1; k <= n; k++) {
          const b = from.clone().addScaledVector(d, k / n);
          if (k < n) b.add(new THREE.Vector3((Math.random() - 0.5) * w * 1.2, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * w * 1.2));
          this.strip(a, b, w * 0.35, '#eef4ff', life * 0.7, 2.2);
          this.strip(a, b, w * 0.9, color, life, 1);
          a = b;
        }
        return;
      }
      case 'qi': // a wide soft river of force, rippling
        this.strip(from, to, w * 1.6, color, life * 1.4, 0.8);
        this.strip(from, to, w * 0.6, '#ffffff', life, 0.9, 0.05);
        return;
      case 'arrow': // a thin fast streak, twice
        this.strip(from, to, w * 0.18, '#ffffff', life * 0.6, 2.4);
        this.strip(from, to, w * 0.5, color, life * 0.8, 1.4, 0.03);
        return;
      case 'claw': { // three parallel rakes
        const d = this.v.copy(to).sub(from).normalize(), side = new THREE.Vector3(-d.z, 0, d.x);
        for (let k = -1; k <= 1; k++) this.strip(from.clone().addScaledVector(side, k * w * 0.35), to.clone().addScaledVector(side, k * w * 0.35), w * 0.22, color, life, 2, (k + 1) * 0.04);
        return;
      }
      default:
        this.strip(from, to, w, color, life);
    }
  }
  /** a magic circle on the ground, the house's own pattern: radius r, turning */
  sigil(pos: THREE.Vector3, r: number, color: THREE.ColorRepresentation, life = 0.7, spin = 1.2, house?: string) {
    const it = this.take(this.sigils);
    const mat = it.mesh.material as THREE.MeshBasicMaterial;
    const tex = sigilOf(lookOf(house).sigil);
    if (mat.map !== tex) {
      mat.map = tex;
      mat.needsUpdate = true;
    }
    it.mesh.position.set(pos.x, pos.y + 0.07, pos.z);
    it.mesh.scale.setScalar(r * 0.5);
    it.mesh.rotation.y = Math.random() * 6;
    mat.color.set(color).multiplyScalar(1.4);
    it.mesh.visible = true;
    it.wait = 0;
    it.life = it.max = life;
    it.spin = spin;
    it.base = r;
  }
  update(dt: number) {
    const wake = (it: Item) => {
      if (it.wait <= 0) return true;
      it.wait -= dt;
      if (it.wait <= 0) it.mesh.visible = true;
      return it.wait <= 0;
    };
    for (const it of this.arcs)
      if (it.life > 0 && wake(it)) {
        it.life -= dt;
        const u = 1 - it.life / it.max;
        it.mesh.scale.setScalar(it.base + it.grow * Math.min(1, u * 3));
        (it.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, it.life / it.max) ** 0.7;
        if (it.life <= 0) it.mesh.visible = false;
      }
    for (const it of this.beams)
      if (it.life > 0 && wake(it)) {
        it.life -= dt;
        const k = Math.max(0, it.life / it.max);
        it.mesh.scale.x = it.mesh.scale.y = it.base * (0.3 + 0.7 * k);
        (it.mesh.material as THREE.MeshBasicMaterial).opacity = k;
        if (it.life <= 0) it.mesh.visible = false;
      }
    for (const it of this.tips)
      if (it.life > 0) {
        it.life -= dt;
        const k = Math.max(0, it.life / it.max);
        it.mesh.scale.setScalar(it.base * (1 + (1 - k) * 0.6));
        (it.mesh.material as THREE.MeshBasicMaterial).opacity = k;
        if (it.life <= 0) it.mesh.visible = false;
      }
    for (const it of this.sigils)
      if (it.life > 0) {
        it.life -= dt;
        const u = 1 - it.life / it.max;
        it.mesh.rotation.y += it.spin * dt;
        it.mesh.scale.setScalar(it.base * 0.5 * (0.75 + 0.25 * Math.min(1, u * 4)));
        (it.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, u * 6) * Math.max(0, it.life / it.max) ** 0.6;
        if (it.life <= 0) it.mesh.visible = false;
      }
  }
}

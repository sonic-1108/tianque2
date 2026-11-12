// The kit's own shapes of light (game/kit.ts sends them as kitArc / kitBeam / kitSigil through sim.vq): the sweep of a
// cone strike drawn at its real reach and width, the strip of a line strike, the house's circle under every cast.
// Pooled meshes, additive, faded on the sim clock by VFXSystem.update.
import * as THREE from 'three';

/** a white magic circle: two rims, a ring of ticks, an eight-sided figure and spokes; tinted by the material */
let sigilTexture: THREE.Texture | null = null;
export function sigilTex() {
  if (sigilTexture) return sigilTexture;
  const N = 256, c = document.createElement('canvas');
  c.width = c.height = N;
  const x = c.getContext('2d')!;
  x.translate(N / 2, N / 2);
  x.strokeStyle = '#fff';
  x.fillStyle = '#fff';
  x.lineWidth = 5;
  x.beginPath();
  x.arc(0, 0, 122, 0, Math.PI * 2);
  x.stroke();
  x.lineWidth = 2.5;
  x.beginPath();
  x.arc(0, 0, 104, 0, Math.PI * 2);
  x.stroke();
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2, l = k % 6 === 0 ? 14 : 6;
    x.beginPath();
    x.moveTo(Math.cos(a) * 104, Math.sin(a) * 104);
    x.lineTo(Math.cos(a) * (104 + l), Math.sin(a) * (104 + l));
    x.stroke();
  }
  x.lineWidth = 3;
  x.beginPath();
  for (let k = 0; k <= 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    if (k === 0) x.moveTo(Math.cos(a) * 92, Math.sin(a) * 92);
    else x.lineTo(Math.cos(a) * 92, Math.sin(a) * 92);
  }
  x.stroke();
  // the eight trigram bars between the figure and the inner rim
  for (let k = 0; k < 8; k++) {
    x.save();
    x.rotate((k / 8) * Math.PI * 2);
    for (let b = 0; b < 3; b++) {
      const broken = (k >> b) & 1, y = -70 + b * 9;
      if (broken) {
        x.fillRect(-14, y, 11, 4);
        x.fillRect(3, y, 11, 4);
      } else x.fillRect(-14, y, 28, 4);
    }
    x.restore();
  }
  x.lineWidth = 2;
  x.beginPath();
  x.arc(0, 0, 40, 0, Math.PI * 2);
  x.stroke();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    x.beginPath();
    x.moveTo(Math.cos(a) * 40, Math.sin(a) * 40);
    x.lineTo(Math.cos(a) * 54, Math.sin(a) * 54);
    x.stroke();
  }
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 40);
  g.addColorStop(0, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.beginPath();
  x.arc(0, 0, 40, 0, Math.PI * 2);
  x.fill();
  sigilTexture = new THREE.CanvasTexture(c);
  return sigilTexture;
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
}

/** a flat crescent fan: bright at the rim, dark inside (vertex colours under additive blending) */
function fanGeometry(r: number, spread: number) {
  const seg = 28, rings = 4;
  const pos: number[] = [], colr: number[] = [], idx: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const u = i / rings, rr = r * (0.25 + 0.75 * u);
    for (let j = 0; j <= seg; j++) {
      const v = j / seg, a = -spread + 2 * spread * v;
      // the leading edge (v near 1) brightest: the swing's direction
      const b = Math.pow(u, 2.2) * (0.35 + 0.65 * v) * Math.sin(Math.PI * Math.min(1, v * 1.08));
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
  constructor() {
    for (let k = 0; k < 14; k++) {
      const m = new THREE.Mesh(new THREE.BufferGeometry(), addMat(undefined, true));
      m.visible = false;
      m.frustumCulled = false;
      m.renderOrder = 6;
      this.root.add(m);
      this.arcs.push({ mesh: m, life: 0, max: 1, spin: 0, grow: 0, base: 1 });
    }
    for (let k = 0; k < 14; k++) {
      const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, -0.5);
      const m = new THREE.Mesh(g, addMat(stripTex()));
      // a second, upright strip so the beam reads from the side too (the gradient runs up it)
      const up = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(0, 0, -0.5), m.material);
      m.add(up);
      m.visible = false;
      m.frustumCulled = up.frustumCulled = false;
      m.renderOrder = 6;
      this.root.add(m);
      this.beams.push({ mesh: m, life: 0, max: 1, spin: 0, grow: 0, base: 1 });
    }
    for (let k = 0; k < 16; k++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), addMat(sigilTex()));
      m.visible = false;
      m.renderOrder = 5;
      this.root.add(m);
      this.sigils.push({ mesh: m, life: 0, max: 1, spin: 0, grow: 0, base: 1 });
    }
  }
  private take(list: Item[]) {
    return list.find((x) => x.life <= 0) ?? list.reduce((a, b) => (a.life < b.life ? a : b));
  }
  /** a cone strike's sweep: centred on yaw (the way -z turns), reach r, half-width spread (radians) */
  arc(pos: THREE.Vector3, yaw: number, r: number, spread: number, color: THREE.ColorRepresentation, life = 0.24, tilt = 0) {
    const it = this.take(this.arcs);
    it.mesh.geometry.dispose();
    it.mesh.geometry = fanGeometry(r, Math.max(0.25, Math.min(Math.PI, spread)));
    (it.mesh.material as THREE.MeshBasicMaterial).color.set(color).multiplyScalar(1.6);
    it.mesh.position.copy(pos);
    it.mesh.rotation.set(tilt, yaw, 0, 'YXZ');
    it.mesh.scale.setScalar(0.7);
    it.mesh.visible = true;
    it.life = it.max = life;
    it.grow = 0.3;
    it.base = 0.7;
  }
  /** a line strike's strip, from → to, width w */
  beam(from: THREE.Vector3, to: THREE.Vector3, w: number, color: THREE.ColorRepresentation, life = 0.3) {
    const it = this.take(this.beams);
    const d = to.clone().sub(from), L = d.length() || 0.1;
    it.mesh.position.copy(from);
    it.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), d.normalize());
    it.mesh.scale.set(w, w, L);
    (it.mesh.material as THREE.MeshBasicMaterial).color.set(color).multiplyScalar(1.5);
    it.mesh.visible = true;
    it.life = it.max = life;
    it.base = w;
  }
  /** a magic circle on the ground: radius r, turning */
  sigil(pos: THREE.Vector3, r: number, color: THREE.ColorRepresentation, life = 0.7, spin = 1.2) {
    const it = this.take(this.sigils);
    it.mesh.position.set(pos.x, pos.y + 0.07, pos.z);
    it.mesh.scale.setScalar(r * 0.5);
    it.mesh.rotation.y = Math.random() * 6;
    (it.mesh.material as THREE.MeshBasicMaterial).color.set(color).multiplyScalar(1.4);
    it.mesh.visible = true;
    it.life = it.max = life;
    it.spin = spin;
    it.base = r;
  }
  update(dt: number) {
    for (const it of this.arcs)
      if (it.life > 0) {
        it.life -= dt;
        const u = 1 - it.life / it.max;
        it.mesh.scale.setScalar(it.base + it.grow * Math.min(1, u * 3));
        (it.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, it.life / it.max) ** 0.7;
        if (it.life <= 0) it.mesh.visible = false;
      }
    for (const it of this.beams)
      if (it.life > 0) {
        it.life -= dt;
        const k = Math.max(0, it.life / it.max);
        it.mesh.scale.x = it.mesh.scale.y = it.base * (0.3 + 0.7 * k);
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

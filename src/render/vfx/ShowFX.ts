// The new houses' great moments (game/kit.ts MoveSpec.show, sent as kitShow): what fills the sky when they let go.
// 剑客 万剑归宗: a ring of spectral swords over him, then a rain of them, a giant sword last. 枪王 霸王枪: a silver dragon
// rides his leap down. 拳师 天罡百裂拳: a storm of fist shadows and a golden fist the size of a house from the sky.
// 符师 五雷正法: a bagua spinning in the clouds, thunder out of it. 琴师 广陵散: domes of sound and notes circling.
// 御兽师 百兽奔腾: a pack of spirit wolves. 毒宗 五毒天罗: a venom dragon. 弓手 落日箭: a sun in the sky and a flaming
// arrow falling like a meteor. 双刀客 修罗刀狱: a tornado of blades. 气宗 天地无极: the azure dragon. 机关师 木鸢轰炸:
// wooden kites over the field dropping bombs.
import * as THREE from 'three';
import { GLTFLoader, SkeletonUtils, MeshoptDecoder } from 'three-stdlib';
import { DragonFX, DRAGON_PALETTES } from './DragonFX';
import { sigilOf } from './sigils';

export type ShowKind =
  | 'swordRain' | 'dragonSilver' | 'dragonAzure' | 'dragonVenom' | 'fistFlurry' | 'giantFist' | 'baguaThunder'
  | 'soundDomes' | 'stampede' | 'meteorArrow' | 'bladeStorm' | 'kites';

/** the effect helpers ShowFX borrows from VFXSystem */
export interface FxHost {
  ring(pos: THREE.Vector3, radius: number, color: THREE.ColorRepresentation, life?: number, width?: number, fill?: number): void;
  flash(pos: THREE.Vector3, color: THREE.ColorRepresentation, intensity: number, life?: number, distance?: number): void;
  sparkBurst(pos: THREE.Vector3, count: number, color: THREE.ColorRepresentation, speed?: number, size?: number, dir?: THREE.Vector3, spread?: number): void;
  embers(pos: THREE.Vector3, count: number, color: THREE.ColorRepresentation, radius?: number, rise?: number, size?: number): void;
  dustPuff(pos: THREE.Vector3, count: number, radius?: number, speed?: number, size?: number, color?: THREE.ColorRepresentation): void;
  tracer(from: THREE.Vector3, to: THREE.Vector3, color?: THREE.ColorRepresentation): void;
  fireColumn(pos: THREE.Vector3, height?: number, color?: THREE.ColorRepresentation): void;
  rocks(pos: THREE.Vector3, count: number, power?: number, size?: number): void;
  decal(pos: THREE.Vector3, size: number, life?: number): void;
}

const UP = new THREE.Vector3(0, 1, 0);
const glow = (c: THREE.ColorRepresentation, o = 1) =>
  new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false });
let glowTexture: THREE.Texture | null = null;
function glowTex() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}
const sprite = (c: THREE.ColorRepresentation, s: number) => {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  m.scale.setScalar(s);
  return m;
};
let noteTexture: THREE.Texture | null = null;
function noteTex() {
  if (noteTexture) return noteTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  x.fillStyle = '#fff';
  x.beginPath();
  x.ellipse(22, 46, 11, 8, -0.4, 0, Math.PI * 2);
  x.fill();
  x.fillRect(30, 10, 5, 36);
  x.beginPath();
  x.moveTo(35, 10);
  x.quadraticCurveTo(54, 18, 48, 34);
  x.lineWidth = 5;
  x.strokeStyle = '#fff';
  x.stroke();
  noteTexture = new THREE.CanvasTexture(c);
  return noteTexture;
}
const merge = (gs: THREE.BufferGeometry[]) => {
  const pos: number[] = [];
  for (const g of gs) {
    const n = g.index ? g.toNonIndexed() : g;
    pos.push(...(n.attributes.position.array as Float32Array));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.computeVertexNormals();
  return out;
};
/** a straight sword pointing down its -Y: blade, guard, grip, pommel */
function swordGeo() {
  const blade = new THREE.CylinderGeometry(0.0, 0.07, 1.3, 4);
  blade.scale(1, 1, 0.25);
  blade.translate(0, -0.65, 0);
  const guard = new THREE.BoxGeometry(0.34, 0.05, 0.08);
  const grip = new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6).translate(0, 0.17, 0);
  const pommel = new THREE.SphereGeometry(0.045, 6, 4).translate(0, 0.34, 0);
  return merge([blade, guard, grip, pommel]);
}
/** a closed fist, knuckles down its -Y (about 1 m tall before scaling) */
function fistGeo() {
  const parts: THREE.BufferGeometry[] = [];
  const palm = new THREE.BoxGeometry(0.62, 0.55, 0.46);
  parts.push(palm.translate(0, 0.05, 0));
  for (let k = 0; k < 4; k++) {
    const f = new THREE.CapsuleGeometry(0.1, 0.28, 3, 8).rotateX(Math.PI / 2);
    parts.push(f.translate(-0.24 + k * 0.16, -0.3, 0.06));
  }
  parts.push(new THREE.CapsuleGeometry(0.1, 0.22, 3, 8).rotateZ(1.2).translate(0.36, -0.08, 0.18));
  parts.push(new THREE.CylinderGeometry(0.26, 0.3, 0.5, 10).translate(0, 0.55, 0)); // the wrist
  return merge(parts);
}
/** a long arrow pointing down its -Z */
function arrowGeo() {
  const shaft = new THREE.CylinderGeometry(0.035, 0.035, 1.6, 6).rotateX(Math.PI / 2);
  const head = new THREE.ConeGeometry(0.1, 0.32, 6).rotateX(-Math.PI / 2).translate(0, 0, -0.95);
  const f1 = new THREE.BoxGeometry(0.22, 0.01, 0.3).translate(0, 0, 0.7);
  const f2 = new THREE.BoxGeometry(0.01, 0.22, 0.3).translate(0, 0, 0.7);
  return merge([shaft, head, f1, f2]);
}
/** a flat crescent blade lying in its XZ plane */
function crescentGeo() {
  const s = new THREE.Shape();
  s.absarc(0, 0, 0.55, -1.1, 1.1, false);
  s.absarc(0.22, 0, 0.42, 1.0, -1.0, true);
  return new THREE.ShapeGeometry(s, 10).rotateX(-Math.PI / 2);
}
/** a 墨家 wooden kite: a slim body, broad swept wings, a fan tail; nose down its -Z */
function kiteGeo() {
  const body = new THREE.BoxGeometry(0.28, 0.2, 2.2);
  const wing = new THREE.BufferGeometry();
  const w = [0, 0, -0.5, 2.6, 0.15, 0.4, 0, 0, 0.6, 0, 0, -0.5, -2.6, 0.15, 0.4, 0, 0, 0.6];
  wing.setAttribute('position', new THREE.Float32BufferAttribute(w, 3));
  const tail = new THREE.BufferGeometry();
  tail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.9, 0.7, 0.05, 1.6, -0.7, 0.05, 1.6], 3));
  const head = new THREE.ConeGeometry(0.16, 0.4, 6).rotateX(-Math.PI / 2).translate(0, 0, -1.3);
  return merge([body, wing, tail, head]);
}

interface Live {
  kind: ShowKind;
  t: number;
  dur: number;
  o: THREE.Vector3; // where it started (the caster)
  at: THREE.Vector3; // its mark
  yaw: number;
  color: string;
  follow?: () => THREE.Vector3 | null;
  objs: THREE.Object3D[];
  data: any;
  done?: boolean;
}

export class ShowFX {
  root = new THREE.Group();
  private live: Live[] = [];
  private dragons: DragonFX[] = [];
  private swords: THREE.InstancedMesh;
  private swordCore: THREE.InstancedMesh;
  private swordUse = 0;
  private blades: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private w = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private fistG = fistGeo();
  private arrowG = arrowGeo();
  private kiteG = kiteGeo();
  private wolf: Promise<{ scene: THREE.Object3D; clip: THREE.AnimationClip | null; scale: number; turn: number; floor: number }> | null = null;
  private mixers: THREE.AnimationMixer[] = [];
  constructor(private fx: FxHost) {
    // spectral swords: a pale glowing blade over a white core
    // a solid bright steel core (it must read against a daytime sky, where additive light vanishes) in a cyan glow
    this.swords = new THREE.InstancedMesh(swordGeo().scale(2.2, 1.7, 2.2), glow('#38bdf8', 0.7), 90);
    this.swordCore = new THREE.InstancedMesh(swordGeo().scale(1.1, 1.6, 1.1), new THREE.MeshStandardMaterial({ color: '#f0f9ff', emissive: '#7dd3fc', emissiveIntensity: 1.4, metalness: 0.6, roughness: 0.25 }), 90);
    this.blades = new THREE.InstancedMesh(crescentGeo(), glow('#ff4d6d', 0.85), 60);
    for (const im of [this.swords, this.swordCore, this.blades]) {
      im.count = 0;
      im.frustumCulled = false;
      im.renderOrder = 7;
      this.root.add(im);
    }
    for (let k = 0; k < 3; k++) {
      const d = new DragonFX(this.root);
      d.embers = (p, n, c) => this.fx.embers(p, n, c, 0.5, 2, 0.08);
      d.clouds = (p) => this.fx.dustPuff(p, 2, 0.35, 0.5, 1.1, d.sparkColor);
      this.dragons.push(d);
    }
  }

  /** start one */
  play(kind: ShowKind, origin: THREE.Vector3, target: THREE.Vector3, yaw: number, dur: number, color: string, follow?: () => THREE.Vector3 | null) {
    const L: Live = { kind, t: 0, dur, o: origin.clone(), at: target.clone(), yaw, color, follow, objs: [], data: {} };
    this.setup(L);
    this.live.push(L);
  }

  private add(L: Live, o: THREE.Object3D) {
    o.frustumCulled = false;
    o.traverse((c) => (c.frustumCulled = false));
    this.root.add(o);
    L.objs.push(o);
    return o;
  }
  private fwd(L: Live) {
    return this.w.set(-Math.sin(L.yaw), 0, -Math.cos(L.yaw));
  }

  private setup(L: Live) {
    const f = this.fwd(L).clone();
    switch (L.kind) {
      case 'dragonSilver':
      case 'dragonAzure':
      case 'dragonVenom': {
        const d = this.dragons.find((x) => !x.active) ?? this.dragons[0];
        d.paint(DRAGON_PALETTES[L.kind === 'dragonSilver' ? 'silver' : L.kind === 'dragonAzure' ? 'azure' : 'venom']);
        const rise = L.dur * 0.6, dive = L.dur * 0.4, c = d.sparkColor;
        d.start(L.o, L.at, rise, dive, () => {
          const p = new THREE.Vector3(L.at.x, L.at.y + 0.1, L.at.z);
          this.fx.ring(p, 2, '#ffffff', 0.3, 0.3, 1);
          this.fx.ring(p, 5, c, 0.7, 0.16, 0.3);
          this.fx.flash(new THREE.Vector3(p.x, p.y + 1.5, p.z), c, 120, 0.5, 16);
          this.fx.sparkBurst(new THREE.Vector3(p.x, p.y + 0.4, p.z), 80, c, 12, 0.12, UP, 1.5);
          this.fx.dustPuff(p, 30, 2, 5, 1, L.kind === 'dragonVenom' ? '#4d7c0f' : '#d8d4c8');
          this.fx.rocks(p, 16, 7, 0.1);
        }, L.yaw + Math.PI);
        L.data.dragon = d;
        break;
      }
      case 'giantFist': {
        const m = new THREE.Mesh(this.fistG, new THREE.MeshStandardMaterial({ color: '#ffd36a', emissive: '#ff9a20', emissiveIntensity: 1.6, metalness: 0.4, roughness: 0.35, transparent: true }));
        m.scale.setScalar(3.4);
        m.rotation.y = L.yaw;
        const halo = sprite('#ffcf5a', 9);
        this.add(L, m);
        this.add(L, halo);
        L.data = { m, halo };
        break;
      }
      case 'fistFlurry': {
        const pool: THREE.Mesh[] = [];
        for (let k = 0; k < 18; k++) {
          const m = new THREE.Mesh(this.fistG, glow('#ffcf7a', 0));
          m.scale.setScalar(0.55);
          pool.push(this.add(L, m) as THREE.Mesh);
        }
        L.data = { pool, life: new Float32Array(18), next: 0, acc: 0 };
        break;
      }
      case 'baguaThunder': {
        const c = this.v.copy(L.o).addScaledVector(f, 4);
        const disc = new THREE.Mesh(new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: sigilOf('bagua'), color: new THREE.Color('#fde047').multiplyScalar(1.6), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false }));
        disc.position.set(c.x, L.o.y + 13, c.z);
        const cloud = sprite('#3b3f6b', 26);
        (cloud.material as THREE.SpriteMaterial).blending = THREE.NormalBlending;
        cloud.position.set(c.x, L.o.y + 14, c.z);
        this.add(L, cloud);
        this.add(L, disc);
        L.data = { disc, cloud, c: c.clone(), bolt: 0 };
        break;
      }
      case 'soundDomes': {
        const shells: THREE.Mesh[] = [];
        for (let k = 0; k < 8; k++) {
          const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), domeMat(L.color));
          m.visible = false;
          shells.push(this.add(L, m) as THREE.Mesh);
        }
        const notes: THREE.Sprite[] = [];
        for (let k = 0; k < 14; k++) {
          const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex(), color: L.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
          s.scale.setScalar(0.6);
          notes.push(this.add(L, s) as THREE.Sprite);
        }
        L.data = { shells, notes, beat: 0 };
        break;
      }
      case 'stampede': {
        const pack: { g: THREE.Group; side: number; lag: number; mixer?: THREE.AnimationMixer }[] = [];
        for (let k = 0; k < 9; k++) {
          const g = new THREE.Group();
          g.visible = false;
          this.add(L, g);
          pack.push({ g, side: ((k % 3) - 1) * 1.6 + (Math.random() - 0.5) * 0.6, lag: Math.floor(k / 3) * 0.16 + Math.random() * 0.06 });
        }
        L.data = { pack };
        this.wolfBody().then((b) => {
          for (const w of pack) {
            const obj = SkeletonUtils.clone(b.scene);
            obj.traverse((o: any) => {
              if (o.isMesh) {
                o.material = new THREE.MeshBasicMaterial({ color: '#ffd28a', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
                o.frustumCulled = false;
              }
            });
            const inner = new THREE.Group();
            inner.add(obj);
            inner.rotation.y = b.turn;
            inner.position.y = b.floor;
            inner.scale.setScalar(b.scale);
            w.g.add(inner);
            if (b.clip) {
              const mx = new THREE.AnimationMixer(obj);
              mx.clipAction(b.clip).play();
              mx.timeScale = 2.6;
              w.mixer = mx;
              this.mixers.push(mx);
            }
          }
        });
        break;
      }
      case 'meteorArrow': {
        const sun = sprite('#ffb347', 30);
        const top = L.at.clone().addScaledVector(f, -10).setY(L.at.y + 34);
        sun.position.copy(top).add(new THREE.Vector3(0, 6, 0));
        (sun.material as THREE.SpriteMaterial).opacity = 0;
        const arrow = new THREE.Mesh(this.arrowG, new THREE.MeshStandardMaterial({ color: '#ffb36b', emissive: '#ff5a12', emissiveIntensity: 2.2 }));
        arrow.scale.setScalar(4);
        arrow.visible = false;
        const fire = sprite('#ff7a1a', 9);
        fire.visible = false;
        const up = new THREE.Mesh(this.arrowG, new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffcf5a', emissiveIntensity: 2 }));
        this.add(L, sun);
        this.add(L, arrow);
        this.add(L, fire);
        this.add(L, up);
        L.data = { sun, arrow, fire, up, top };
        break;
      }
      case 'bladeStorm': {
        L.data = { n: 48, seed: Array.from({ length: 48 }, () => [Math.random(), Math.random(), Math.random()]) };
        break;
      }
      case 'kites': {
        const kites: THREE.Mesh[] = [];
        for (let k = 0; k < 3; k++) {
          const m = new THREE.Mesh(this.kiteG, new THREE.MeshStandardMaterial({ color: k === 1 ? '#a3281a' : '#8a5a2e', roughness: 0.7, side: THREE.DoubleSide }));
          m.scale.setScalar(1.3);
          kites.push(this.add(L, m) as THREE.Mesh);
        }
        const bombs: THREE.Mesh[] = [];
        for (let k = 0; k < 8; k++) {
          const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.6 }));
          b.visible = false;
          bombs.push(this.add(L, b) as THREE.Mesh);
        }
        L.data = { kites, bombs, f: f.clone(), side: new THREE.Vector3(-f.z, 0, f.x) };
        break;
      }
      case 'swordRain': {
        const N = 60;
        L.data = {
          sw: Array.from({ length: N }, (_, k) => ({ a: (k / N) * Math.PI * 2, fall: -1, x: 0, z: 0, y0: 0, stuck: 0, k })),
          big: { fall: -1 },
        };
        break;
      }
    }
  }

  private wolfBody() {
    if (!this.wolf) {
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(typeof MeshoptDecoder === 'function' ? (MeshoptDecoder as any)() : MeshoptDecoder);
      this.wolf = loader.loadAsync(import.meta.env.BASE_URL + 'models/s-wolf.glb').then((g) => {
        g.scene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(g.scene);
        const size = box.getSize(new THREE.Vector3());
        const scale = 1.25 / Math.max(0.05, size.y);
        const bones: THREE.Object3D[] = [];
        g.scene.traverse((o: any) => o.isBone && bones.push(o));
        const at = (re: RegExp) => bones.find((b) => re.test(b.name))?.getWorldPosition(new THREE.Vector3());
        const head = at(/head/i), tail = at(/tail/i) ?? at(/root|hips|spine/i);
        // turn so the head leads along -Z (the way the pack runs in its group)
        const turn = head && tail ? -Math.atan2(head.x - tail.x, head.z - tail.z) + Math.PI : Math.PI / 2;
        const clip = g.animations[0]?.clone() ?? null;
        if (clip) clip.tracks = clip.tracks.filter((t) => !(t.name.endsWith('.position') && /root/i.test(t.name)));
        return { scene: g.scene, clip, scale, turn, floor: -box.min.y * scale };
      });
    }
    return this.wolf;
  }

  update(dt: number, time: number) {
    for (const d of this.dragons) d.update(dt, time);
    for (const mx of this.mixers) mx.update(dt);
    this.swordUse = 0;
    let bladeUse = 0;
    for (const L of this.live) {
      L.t += dt;
      const t = L.t, u = Math.min(1, t / L.dur);
      const here = (L.follow?.() ?? L.o).clone();
      const f = this.fwd(L);
      const D = L.data;
      switch (L.kind) {
        case 'dragonSilver':
        case 'dragonAzure':
        case 'dragonVenom':
          if (!D.dragon.active && t > 0.2) L.done = true;
          break;
        case 'giantFist': {
          // it falls out of the sky, faster and faster, on its mark; then fades where it struck
          const fall = Math.min(1, t / L.dur);
          const y = L.at.y + 1.6 + (1 - fall * fall) * 16;
          D.m.position.set(L.at.x, y, L.at.z);
          D.halo.position.copy(D.m.position);
          const after = t - L.dur;
          const k = after > 0 ? Math.max(0, 1 - after / 0.5) : Math.min(1, t / 0.15);
          (D.m.material as THREE.MeshStandardMaterial).opacity = k;
          (D.halo.material as THREE.SpriteMaterial).opacity = k * 0.8;
          if (after > 0 && !D.hit) {
            D.hit = true;
            const p = new THREE.Vector3(L.at.x, L.at.y + 0.1, L.at.z);
            this.fx.ring(p, 3, '#ffffff', 0.35, 0.3, 1);
            this.fx.ring(p, 7, '#ffcf5a', 0.8, 0.14, 0.2);
            this.fx.flash(new THREE.Vector3(p.x, p.y + 2, p.z), '#ffd36a', 140, 0.5, 18);
            this.fx.dustPuff(p, 40, 2.5, 6, 1.2, '#d8c49a');
            this.fx.rocks(p, 26, 9, 0.13);
            this.fx.decal(p, 6, 3);
            this.fx.sparkBurst(new THREE.Vector3(p.x, p.y + 0.5, p.z), 90, '#ffcf5a', 13, 0.12, UP, 1.4);
          }
          if (after > 0.55) L.done = true;
          break;
        }
        case 'fistFlurry': {
          // fist shadows burst out in front of him, one after another
          D.acc += dt;
          while (t < L.dur && D.acc > 0.035) {
            D.acc -= 0.035;
            const i = D.next++ % D.pool.length, m = D.pool[i] as THREE.Mesh;
            const side = (Math.random() - 0.5) * 1.4, h = 0.9 + Math.random() * 0.8;
            m.position.set(here.x + f.x * 0.6 + f.z * side, here.y + h, here.z + f.z * 0.6 - f.x * side);
            m.rotation.set(Math.PI / 2, L.yaw, 0, 'YXZ');
            m.userData.v = 7 + Math.random() * 4;
            D.life[i] = 0.18;
          }
          for (let i = 0; i < D.pool.length; i++) {
            const m = D.pool[i] as THREE.Mesh;
            if (D.life[i] > 0) {
              D.life[i] -= dt;
              m.position.addScaledVector(f, m.userData.v * dt);
              (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, D.life[i] / 0.18) * 0.8;
            } else (m.material as THREE.MeshBasicMaterial).opacity = 0;
          }
          if (t > L.dur + 0.3) L.done = true;
          break;
        }
        case 'baguaThunder': {
          const k = Math.min(1, t / 0.35) * Math.max(0, Math.min(1, (L.dur + 0.4 - t) / 0.4));
          (D.disc.material as THREE.MeshBasicMaterial).opacity = k;
          (D.cloud.material as THREE.SpriteMaterial).opacity = k * 0.75;
          D.disc.rotation.y += dt * (1 + t * 2);
          D.disc.scale.setScalar(0.6 + 0.4 * Math.min(1, t / 0.4));
          // bolts out of the bagua onto the ground round its middle, faster as it spins up
          if (t > 0.35 && t < L.dur) {
            D.bolt -= dt;
            if (D.bolt <= 0) {
              D.bolt = 0.09;
              const a = Math.random() * Math.PI * 2, r = Math.random() * 9;
              const g = new THREE.Vector3(D.c.x + Math.cos(a) * r, L.o.y, D.c.z + Math.sin(a) * r);
              const top = new THREE.Vector3(D.c.x + Math.cos(a) * r * 0.5, L.o.y + 13, D.c.z + Math.sin(a) * r * 0.5);
              this.fx.tracer(top, g, '#eef4ff');
              this.fx.tracer(top.clone().add(new THREE.Vector3(0.3, -3, 0.2)), g, '#c7d2fe');
              this.fx.flash(g.clone().setY(g.y + 1), '#c7d2fe', 30, 0.12, 9);
              this.fx.sparkBurst(g.clone().setY(g.y + 0.2), 14, '#e0e7ff', 8, 0.07, UP, 1);
            }
          }
          if (t > L.dur + 0.45) L.done = true;
          break;
        }
        case 'soundDomes': {
          // a dome of sound swells out on each beat; notes wheel round him, rising
          const beats = [0, 0.32, 0.64, 0.96, 1.28, 1.6, 2.1];
          while (D.beat < beats.length && t >= beats[D.beat]) {
            const sh = D.shells[D.beat % D.shells.length] as THREE.Mesh;
            sh.visible = true;
            sh.userData.t = 0;
            sh.userData.big = D.beat === beats.length - 1;
            D.beat++;
          }
          for (const sh of D.shells as THREE.Mesh[]) {
            if (!sh.visible) continue;
            sh.userData.t += dt;
            const k = sh.userData.t / (sh.userData.big ? 0.7 : 0.5);
            sh.position.copy(here);
            sh.scale.set(1, 0.6, 1).multiplyScalar(0.5 + 10 * Math.min(1, k) ** 0.6);
            (sh.material as THREE.ShaderMaterial).uniforms.uA.value = Math.max(0, 1 - k) * (sh.userData.big ? 1.6 : 1);
            if (k >= 1) sh.visible = false;
          }
          D.notes.forEach((s: THREE.Sprite, i: number) => {
            const a = t * 2.2 + (i / D.notes.length) * Math.PI * 2, r = 2.2 + Math.sin(t * 3 + i) * 0.4;
            s.position.set(here.x + Math.cos(a) * r, here.y + 0.6 + ((t * 0.9 + i * 0.37) % 3.2), here.z + Math.sin(a) * r);
            (s.material as THREE.SpriteMaterial).opacity = Math.min(1, t / 0.3) * Math.max(0, Math.min(1, (L.dur + 0.3 - t) / 0.3));
          });
          if (t > L.dur + 0.8) L.done = true;
          break;
        }
        case 'stampede': {
          // from behind him, down the line and past: bounding, kicking up dust
          for (const w of D.pack) {
            const k = (t - w.lag) / L.dur;
            w.g.visible = k > 0 && k < 1.05;
            if (!w.g.visible) continue;
            const along = -3 + k * 19;
            w.g.position.set(L.o.x + f.x * along + f.z * w.side, L.o.y + Math.abs(Math.sin(k * 26 + w.side)) * 0.35, L.o.z + f.z * along - f.x * w.side);
            w.g.rotation.y = L.yaw;
            if (Math.random() < dt * 14) this.fx.dustPuff(w.g.position.clone().setY(L.o.y), 2, 0.4, 1.6, 0.9, '#b59a74');
            if (Math.random() < dt * 8) this.fx.embers(w.g.position.clone().setY(L.o.y + 0.6), 2, '#ffd28a', 0.4, 1.2, 0.07);
          }
          if (t > L.dur + 0.6) L.done = true;
          break;
        }
        case 'meteorArrow': {
          // up from his bow into the sky; a sun flares; the arrow comes back down as a burning star
          const upT = 0.35;
          if (t < upT) {
            D.up.visible = true;
            const p = here.clone().setY(here.y + 1.5 + (t / upT) * 30);
            D.up.position.copy(p);
            D.up.lookAt(p.clone().add(new THREE.Vector3(0, -1, 0)));
            if (Math.random() < 0.7) this.fx.embers(p, 2, '#fff3c4', 0.1, 0, 0.08);
          } else D.up.visible = false;
          (D.sun.material as THREE.SpriteMaterial).opacity = Math.min(1, Math.max(0, (t - 0.2) / 0.3)) * Math.max(0, Math.min(1, (L.dur + 0.6 - t) / 0.6)) * 0.9;
          if (t >= upT && t < L.dur) {
            const k = (t - upT) / (L.dur - upT), e = k * k;
            const p = D.top.clone().lerp(L.at, e);
            D.arrow.visible = D.fire.visible = true;
            D.arrow.position.copy(p);
            D.arrow.lookAt(p.clone().sub(L.at.clone().sub(D.top)));
            D.fire.position.copy(p);
            this.fx.embers(p, 5, '#ff8a2a', 0.6, 0.5, 0.12);
            if (Math.random() < 0.6) this.fx.fireColumn(p, 1.2, '#ff6a1a');
          } else D.arrow.visible = D.fire.visible = false;
          if (t >= L.dur && !D.hit) {
            D.hit = true;
            const p = L.at.clone().setY(L.at.y + 0.1);
            this.fx.flash(p.clone().setY(p.y + 2), '#ff8a2a', 160, 0.6, 20);
            this.fx.ring(p, 7, '#ffb347', 0.9, 0.18, 0.3);
            for (let k = 0; k < 8; k++) {
              const a = (k / 8) * Math.PI * 2;
              this.fx.fireColumn(new THREE.Vector3(p.x + Math.cos(a) * 3, p.y, p.z + Math.sin(a) * 3), 2.6, '#ff6a1a');
            }
            this.fx.rocks(p, 24, 9, 0.12);
            this.fx.decal(p, 6, 4);
          }
          if (t > L.dur + 0.7) L.done = true;
          break;
        }
        case 'bladeStorm': {
          // a tornado of blades round him: low and wide at the bottom, narrow and high above
          const fade = Math.min(1, t / 0.25) * Math.max(0, Math.min(1, (L.dur - t) / 0.3));
          for (let i = 0; i < D.n && bladeUse < 60; i++) {
            const [a0, h0, r0] = D.seed[i];
            const hgt = h0 * 4.2, r = (1.2 + r0 * 4.6) * (1 - h0 * 0.45) * (0.5 + 0.5 * fade);
            const a = a0 * Math.PI * 2 + t * (9 - h0 * 3);
            this.v.set(here.x + Math.cos(a) * r, here.y + 0.3 + hgt, here.z + Math.sin(a) * r);
            this.q.setFromEuler(new THREE.Euler(0.2 * Math.sin(a * 3), -a + Math.PI / 2, 0));
            this.sc.setScalar((0.8 + r0 * 0.8) * fade);
            this.m.compose(this.v, this.q, this.sc);
            this.blades.setMatrixAt(bladeUse++, this.m);
          }
          if (Math.random() < dt * 20) this.fx.sparkBurst(here.clone().setY(here.y + 1 + Math.random() * 2), 4, '#ff4d6d', 6, 0.06);
          if (t > L.dur) L.done = true;
          break;
        }
        case 'kites': {
          // three kites sweep over from behind him down the line, dropping a bomb on each mark
          const span = 30;
          D.kites.forEach((m: THREE.Mesh, k: number) => {
            const kk = (t - k * 0.12) / L.dur;
            m.visible = kk > 0 && kk < 1;
            const along = -6 + kk * span, side = (k - 1) * 3.2;
            m.position.set(L.o.x + D.f.x * along + D.side.x * side, L.o.y + 9 + k * 0.8 + Math.sin(kk * 9 + k) * 0.4, L.o.z + D.f.z * along + D.side.z * side);
            m.rotation.set(-0.12, L.yaw, Math.sin(kk * 7 + k) * 0.25, 'YXZ');
          });
          // the bombs: released 0.3 s before each blast at 3 + 2.4k m (the sim's delays)
          D.bombs.forEach((b: THREE.Mesh, k: number) => {
            const rel = 0.15 + k * 0.15, land = rel + 0.3;
            if (t < rel || t > land + 0.02) {
              b.visible = false;
              return;
            }
            const along = 3 + k * 2.4, kk = (t - rel) / 0.3;
            b.visible = true;
            b.position.set(L.o.x + D.f.x * along, L.o.y + 9 * (1 - kk * kk) + 0.3, L.o.z + D.f.z * along);
            if (Math.random() < 0.6) this.fx.sparkBurst(b.position.clone().setY(b.position.y + 0.25), 2, '#ffb347', 2, 0.05);
          });
          if (t > L.dur + 0.3) L.done = true;
          break;
        }
        case 'swordRain': {
          // a ring of swords gathers over him, then they fall on the field one after another, stick and fade;
          // last a giant sword drops in the middle
          const gather = 0.45;
          for (const s of D.sw) {
            if (this.swordUse >= 88) break;
            let y = 0, x = 0, z = 0, tilt = 0, scale = 1;
            if (t < gather || s.fall < 0) {
              // circling over him, points down
              const a = s.a + t * 2.2, r = 2.4 + (s.k % 3) * 0.6;
              x = here.x + Math.cos(a) * r;
              z = here.z + Math.sin(a) * r;
              y = here.y + 4.2 + (s.k % 4) * 0.35 + Math.sin(t * 4 + s.k) * 0.1;
              scale = Math.min(1, t / 0.3);
              if (t >= gather + (s.k / D.sw.length) * (L.dur - gather - 0.3) && t < L.dur) {
                s.fall = 0;
                const a2 = Math.random() * Math.PI * 2, r2 = Math.sqrt(Math.random()) * 7;
                s.x = L.at.x + Math.cos(a2) * r2;
                s.z = L.at.z + Math.sin(a2) * r2;
                s.y0 = y;
                s.sx = x;
                s.sz = z;
              }
              if (t >= L.dur) continue;
            } else if (s.fall < 0.22) {
              s.fall += dt;
              const k = Math.min(1, s.fall / 0.22), e = k * k;
              x = s.sx + (s.x - s.sx) * e;
              z = s.sz + (s.z - s.sz) * e;
              y = s.y0 + (L.at.y + 0.6 - s.y0) * e;
              tilt = 0;
              if (k >= 1) {
                this.fx.sparkBurst(new THREE.Vector3(s.x, L.at.y + 0.2, s.z), 6, '#bfe8ff', 5, 0.06, UP, 0.8);
                if (s.k % 3 === 0) this.fx.ring(new THREE.Vector3(s.x, L.at.y + 0.05, s.z), 0.9, '#bfe8ff', 0.3, 0.1, 0.2);
              }
            } else {
              // stuck in the ground, fading
              s.fall += dt;
              x = s.x;
              z = s.z;
              y = L.at.y + 0.6;
              scale = Math.max(0, 1 - (s.fall - 0.22) / 0.5);
              if (scale <= 0) continue;
            }
            this.q.setFromEuler(new THREE.Euler(tilt, s.a, 0));
            this.sc.setScalar(scale);
            this.m.compose(this.v.set(x, y, z), this.q, this.sc);
            this.swords.setMatrixAt(this.swordUse, this.m);
            this.swordCore.setMatrixAt(this.swordUse, this.m);
            this.swordUse++;
          }
          // the great sword: falls from high at the end
          const bt = t - (L.dur - 0.2);
          if (bt > -0.25 && bt < 0.9 && this.swordUse < 89) {
            const k = Math.min(1, (bt + 0.25) / 0.25);
            const y = L.at.y + 3.8 + (1 - k * k) * 20;
            const sc = 4.2 * (bt > 0.25 ? Math.max(0, 1 - (bt - 0.25) / 0.6) : 1);
            this.m.compose(this.v.set(L.at.x, y, L.at.z), this.q.setFromEuler(new THREE.Euler(0, L.yaw, 0)), this.sc.setScalar(sc));
            this.swords.setMatrixAt(this.swordUse, this.m);
            this.swordCore.setMatrixAt(this.swordUse, this.m);
            this.swordUse++;
            if (k >= 1 && !D.big.hit) {
              D.big.hit = true;
              const p = new THREE.Vector3(L.at.x, L.at.y + 0.1, L.at.z);
              this.fx.flash(p.clone().setY(p.y + 2), '#bfe8ff', 140, 0.5, 18);
              this.fx.ring(p, 6, '#bfe8ff', 0.8, 0.16, 0.3);
              this.fx.sparkBurst(p, 70, '#e0f2fe', 12, 0.1, UP, 1.3);
              this.fx.rocks(p, 20, 8, 0.12);
              this.fx.decal(p, 5, 3);
            }
          }
          if (t > L.dur + 1) L.done = true;
          break;
        }
      }
    }
    this.swords.count = this.swordCore.count = this.swordUse;
    this.swords.instanceMatrix.needsUpdate = this.swordCore.instanceMatrix.needsUpdate = true;
    this.blades.count = bladeUse;
    this.blades.instanceMatrix.needsUpdate = true;
    // finished ones: their meshes go
    for (const L of this.live)
      if (L.done)
        for (const o of L.objs) {
          this.root.remove(o);
          o.traverse((c: any) => {
            // (the wolves' clones share their model's geometry: keep it)
            if (c.isMesh && L.kind !== 'stampede' && c.geometry !== this.fistG && c.geometry !== this.arrowG && c.geometry !== this.kiteG) c.geometry.dispose();
            if (c.material) c.material.dispose?.();
          });
          if (L.kind === 'stampede') for (const w of L.data.pack) if (w.mixer) this.mixers.splice(this.mixers.indexOf(w.mixer), 1);
        }
    this.live = this.live.filter((L) => !L.done);
  }
}

/** a dome of sound: clear in the middle, bright at its rim */
function domeMat(color: string) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uA: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uA; varying vec3 vN; varying vec3 vV;
      void main(){ float r = pow(1.0 - abs(dot(vN, vV)), 2.0); gl_FragColor = vec4(uColor * (0.3 + 1.8 * r), (0.05 + 0.8 * r) * uA); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

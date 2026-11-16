// What the 散人 wears (game/wardrobe.ts) put on his body. The outfit itself is the body (Rig loads it); on top of it:
//   a hat set on the skull's top (found from the head bones, so it sits right on every outfit's head)
//   a cloak hung from the shoulders as real cloth: a grid of points pinned along the upper back, falling under
//     gravity, trailing and flapping as you run, kept off the back, hips and legs (bone capsules), never through
//     the ground
//   something hung at the right hip (purse, sachet, gourd, jade, token) that swings like a pendulum
// Pieces are made in metres; they are fitted with the skeleton put back in its bind pose (the rest stance it was
// rigged in), so the same piece fits every outfit's body whatever pose the body is in when you change.
import * as THREE from 'three';
import { garment, type Garment, type Slot } from '../game/wardrobe';

const mat = (c: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0, ...o });
const norm = (n: string) => n.toLowerCase().replace(/^mixamorig[:_]?/, '').replace(/[^a-z0-9]/g, '');

// ---------------------------------------------------------------- textures (drawn once)
const texCache = new Map<string, THREE.Texture>();
function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = false) {
  let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
}
/** woven bamboo: radial splints crossed by rings (a 斗笠's top, u round, v out from the apex) */
const weave = () =>
  canvasTex('weave', 512, 256, (g) => {
    g.fillStyle = '#c4a468';
    g.fillRect(0, 0, 512, 256);
    for (let x = 0; x < 512; x += 6) {
      g.fillStyle = x % 12 ? 'rgba(90,64,30,0.35)' : 'rgba(255,240,200,0.25)';
      g.fillRect(x, 0, 2, 256);
    }
    for (let y = 0; y < 256; y += 9) {
      g.fillStyle = 'rgba(80,56,26,0.4)';
      g.fillRect(0, y, 512, 2);
      for (let x = (y / 9) % 2 ? 0 : 6; x < 512; x += 12) {
        g.fillStyle = 'rgba(255,236,190,0.22)';
        g.fillRect(x, y + 2, 6, 7);
      }
    }
    g.fillStyle = 'rgba(70,46,20,0.8)';
    g.fillRect(0, 248, 512, 8);
  });
/** thin gauze, fading toward its hem, with faint threads */
const gauze = () =>
  canvasTex('gauze', 256, 256, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, 'rgba(250,248,240,0.62)');
    gr.addColorStop(0.75, 'rgba(250,248,240,0.38)');
    gr.addColorStop(1, 'rgba(250,248,240,0.12)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 3) {
      g.fillStyle = `rgba(255,255,255,${0.08 + (x % 9 === 0 ? 0.1 : 0)})`;
      g.fillRect(x, 0, 1, 256);
    }
  });
/** fur: soft streaks of light and dark */
const fur = (base: string) =>
  canvasTex('fur' + base, 256, 256, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 1400; k++) {
      const x = Math.random() * 256, y = Math.random() * 256, l = 6 + Math.random() * 14;
      g.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';
      g.lineWidth = 1 + Math.random();
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (Math.random() - 0.5) * 4, y + l);
      g.stroke();
    }
  }, true);
/** cloth for a cloak: a fine weave, the trim band round its edge and hem (u across, v down) */
function clothTex(a: string, b: string, furry: boolean) {
  return canvasTex(`cloth${a}${b}${furry}`, 256, 512, (g) => {
    g.fillStyle = a;
    g.fillRect(0, 0, 256, 512);
    if (furry) {
      for (let k = 0; k < 3000; k++) {
        const x = Math.random() * 256, y = Math.random() * 512, l = 8 + Math.random() * 18;
        g.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(120,110,95,0.16)';
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (Math.random() - 0.5) * 5, y + l);
        g.stroke();
      }
      return;
    }
    for (let y = 0; y < 512; y += 2) {
      g.fillStyle = `rgba(0,0,0,${0.03 + ((y / 2) % 3 === 0 ? 0.03 : 0)})`;
      g.fillRect(0, y, 256, 1);
    }
    for (let x = 0; x < 256; x += 2) {
      g.fillStyle = 'rgba(255,255,255,0.025)';
      g.fillRect(x, 0, 1, 512);
    }
    // the trim: a band down both edges and along the hem, a thin line inside it
    g.fillStyle = b;
    g.fillRect(0, 0, 12, 512);
    g.fillRect(244, 0, 12, 512);
    g.fillRect(0, 486, 256, 26);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(14, 0, 2, 484);
    g.fillRect(240, 0, 2, 484);
    g.fillRect(14, 482, 228, 2);
  });
}

// ---------------------------------------------------------------- hats (origin: the top of the skull, y up, z to the face)
function hat(g: Garment) {
  const out = new THREE.Group();
  const A = mat(g.a), B = mat(g.b);
  if (g.shape === 'douli' || g.shape === 'veil') {
    // a wide shallow cone of woven bamboo, a bound rim, a knob at the apex, a cord under the chin
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.37, 0.16, 48, 1, true), mat('#ffffff', { map: weave(), side: THREE.DoubleSide, roughness: 0.9 }));
    top.position.y = 0.03;
    out.add(top);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.368, 0.011, 6, 48), mat(g.shape === 'veil' ? g.a : g.b, { roughness: 0.7 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -0.05;
    out.add(rim);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), B);
    knob.position.y = 0.115;
    out.add(knob);
    // the inner band that sits on the head
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.1, 0.05, 20, 1, true), mat('#3a2c18', { side: THREE.DoubleSide }));
    band.position.y = -0.01;
    out.add(band);
    for (const s of [-1, 1]) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.2, 4), mat('#2a1d10'));
      cord.position.set(s * 0.075, -0.13, 0.03);
      cord.rotation.z = -s * 0.32;
      out.add(cord);
    }
    if (g.shape === 'veil') {
      const veil = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.37, 0.44, 40, 1, true), new THREE.MeshStandardMaterial({ map: gauze(), transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 1 }));
      veil.position.y = -0.27;
      veil.name = 'veil';
      out.add(veil);
    }
  } else if (g.shape === 'crown') {
    // a little lotus of white jade on the topknot, a gold pin through it
    const pts = [new THREE.Vector2(0.0, 0), new THREE.Vector2(0.034, 0.0), new THREE.Vector2(0.046, 0.02), new THREE.Vector2(0.052, 0.045), new THREE.Vector2(0.044, 0.06), new THREE.Vector2(0.05, 0.072)];
    const cup = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), mat(g.a, { roughness: 0.25, metalness: 0.05 }));
    cup.position.set(0, -0.005, 0);
    out.add(cup);
    for (let k = 0; k < 6; k++) {
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6).scale(0.7, 1.5, 0.35), mat(g.a, { roughness: 0.25 }));
      const a = (k / 6) * Math.PI * 2;
      petal.position.set(Math.cos(a) * 0.045, 0.06, Math.sin(a) * 0.045);
      petal.rotation.y = -a;
      petal.rotation.z = 0.35;
      out.add(petal);
    }
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 6), mat(g.b, { metalness: 0.4, roughness: 0.35 }));
    pin.rotation.z = Math.PI / 2;
    pin.position.set(0, 0.035, 0);
    out.add(pin);
    for (const s of [-1, 1]) {
      const end = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), mat(g.b, { metalness: 0.4, roughness: 0.35 }));
      end.position.set(s * 0.1, 0.035, 0);
      out.add(end);
    }
  } else if (g.shape === 'scarf') {
    // the scholar's soft cloth cap (幞头): a rounded crown over the skull and topknot, a band at the brow, a knot
    // at the back and its two ribbons hanging down
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.104, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.95, 1.14), mat(g.a, { roughness: 0.95 }));
    cap.position.set(0, -0.035, -0.012);
    out.add(cap);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.106, 0.108, 0.03, 28, 1, true).scale(1, 1, 1.14), mat(g.b, { roughness: 0.95, side: THREE.DoubleSide }));
    band.position.set(0, -0.045, -0.012);
    out.add(band);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8).scale(1.4, 1, 0.8), mat(g.b, { roughness: 0.95 }));
    knot.position.set(0, -0.03, -0.128);
    out.add(knot);
    for (const s of [-1, 1]) {
      const rib = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.34), mat(g.b, { side: THREE.DoubleSide, roughness: 0.95 }));
      rib.position.set(s * 0.03, -0.2, -0.135);
      rib.rotation.x = 0.18;
      rib.name = 'ribbon';
      out.add(rib);
    }
  } else {
    // felt: a round fur hat close over the head, a turned-up fur band at the brow, ear flaps
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.3, 1.12), mat('#ffffff', { map: fur(g.a), roughness: 1 }));
    dome.position.set(0, -0.062, -0.012);
    out.add(dome);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.102, 0.022, 10, 28).scale(1, 1.1, 1), mat('#ffffff', { map: fur(g.b), roughness: 1 }));
    band.rotation.x = Math.PI / 2;
    band.position.set(0, -0.066, -0.01);
    out.add(band);
    for (const s of [-1, 1]) {
      const flap = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 8).scale(0.32, 1.25, 0.85), mat('#ffffff', { map: fur(g.a), roughness: 1 }));
      flap.position.set(s * 0.098, -0.112, -0.014);
      flap.rotation.z = s * 0.12;
      out.add(flap);
    }
  }
  return out;
}

// ---------------------------------------------------------------- hangings at the right hip (origin: where it hangs from)
function hanging(g: Garment) {
  const out = new THREE.Group();
  const cord = (len: number, c: string) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, len, 5), mat(c));
    m.position.y = -len / 2;
    return m;
  };
  const tassel = (y: number, c: string) => {
    const t = new THREE.Group();
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), mat(c));
    knot.position.y = y;
    t.add(knot);
    for (let k = 0; k < 7; k++) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0015, 0.09, 4), mat(c, { roughness: 0.9 }));
      s.position.set(Math.cos(k) * 0.006, y - 0.05, Math.sin(k) * 0.006);
      t.add(s);
    }
    return t;
  };
  if (g.shape === 'gourd') {
    out.add(cord(0.06, '#a8322a'));
    const gm = mat(g.a, { roughness: 0.45 });
    const up = new THREE.Mesh(new THREE.SphereGeometry(0.038, 14, 10), gm);
    up.position.y = -0.09;
    const low = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), gm);
    low.position.y = -0.17;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.04, 10), gm);
    neck.position.y = -0.055;
    const stop = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.02, 8), mat('#5a3a1a'));
    stop.position.y = -0.03;
    out.add(up, low, neck, stop);
  } else if (g.shape === 'purse') {
    out.add(cord(0.04, g.b));
    const bag = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10).scale(1, 1.1, 0.6), mat(g.a, { roughness: 1 }));
    bag.position.y = -0.1;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.035, 10), mat(g.a, { roughness: 1 }));
    neck.position.y = -0.045;
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 5, 12), mat(g.b));
    tie.rotation.x = Math.PI / 2;
    tie.position.y = -0.05;
    out.add(bag, neck, tie);
  } else if (g.shape === 'sachet') {
    out.add(cord(0.05, g.b));
    const bag = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.075, 6).scale(1, 1, 0.45), mat(g.a, { roughness: 0.8 }));
    bag.position.y = -0.09;
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.03, 6).scale(1, 1, 0.45), mat(g.a, { roughness: 0.8 }));
    top.position.y = -0.04;
    const flower = new THREE.Mesh(new THREE.CircleGeometry(0.016, 10), mat(g.b, { side: THREE.DoubleSide }));
    flower.position.set(0, -0.09, 0.024);
    out.add(bag, top, flower, tassel(-0.13, g.b));
  } else if (g.shape === 'jade') {
    out.add(cord(0.05, g.b));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.016, 10, 28).scale(1, 1, 0.5), mat(g.a, { roughness: 0.2, metalness: 0.05, emissive: '#2a3a2e', emissiveIntensity: 0.25 }));
    ring.position.y = -0.095;
    out.add(ring, tassel(-0.15, g.b));
  } else {
    // token: a gilt plaque with a raised rim on a dark red cord
    out.add(cord(0.05, g.b));
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.008), mat(g.a, { metalness: 0.4, roughness: 0.35, emissive: g.a, emissiveIntensity: 0.12 }));
    plate.position.y = -0.105;
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.108, 0.005), mat('#9a7426', { metalness: 0.4, roughness: 0.45 }));
    rim.position.set(0, -0.105, -0.002);
    out.add(plate, rim, tassel(-0.165, g.b));
  }
  // flat pieces lie against the thigh, their face outward (the swing turns the outer group about the body's axes)
  const swing = new THREE.Group();
  out.rotation.y = -Math.PI / 2;
  swing.add(out);
  return swing;
}

// ---------------------------------------------------------------- the cloak: cloth
interface Collider {
  a: THREE.Object3D;
  b: THREE.Object3D | null;
  r: number;
}
interface Cloth {
  W: number;
  H: number;
  p: Float32Array;
  q: Float32Array;
  links: [number, number, number][];
  /** the top row's points in the chest's rest frame */
  anchors: THREE.Vector3[];
  chest: THREE.Object3D;
  /** the chest's turn at rest relative to the body, undone each frame so the anchors follow the chest's own turn */
  rest: THREE.Quaternion;
  cols: Collider[];
  geo: THREE.BufferGeometry;
  ok: boolean;
}
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpQ = new THREE.Quaternion();

function makeCloth(g: Garment, chest: THREE.Object3D, rest: THREE.Quaternion, top: { y: number; back: number; half: number }, cols: Collider[], length: number) {
  const furry = g.shape === 'fur';
  const W = 9, H = 12;
  const anchors: THREE.Vector3[] = [];
  for (let i = 0; i < W; i++) {
    const u = i / (W - 1) - 0.5;
    // an arc over the shoulder blades, its ends coming forward over the shoulders
    anchors.push(new THREE.Vector3(u * 2 * top.half, top.y - Math.abs(u) * 0.05, top.back + Math.pow(Math.abs(u) * 2, 2) * 0.07));
  }
  const p = new Float32Array(W * H * 3), q = new Float32Array(W * H * 3);
  const links: [number, number, number][] = [];
  const dy = length / (H - 1);
  // the hem is wider than the shoulders
  const spread = (j: number) => 1 + (j / (H - 1)) * (furry ? 0.25 : 0.45);
  const idx = (i: number, j: number) => j * W + i;
  const restPos = (i: number, j: number) => {
    const a = anchors[i];
    return [a.x * spread(j), a.y - j * dy, a.z - j * dy * 0.12];
  };
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const r = restPos(i, j);
      if (i + 1 < W) {
        const r2 = restPos(i + 1, j);
        links.push([idx(i, j), idx(i + 1, j), Math.hypot(r2[0] - r[0], r2[1] - r[1], r2[2] - r[2])]);
      }
      if (j + 1 < H) {
        const r2 = restPos(i, j + 1);
        links.push([idx(i, j), idx(i, j + 1), Math.hypot(r2[0] - r[0], r2[1] - r[1], r2[2] - r[2])]);
        if (i + 1 < W) {
          const r3 = restPos(i + 1, j + 1);
          links.push([idx(i, j), idx(i + 1, j + 1), Math.hypot(r3[0] - r[0], r3[1] - r[1], r3[2] - r[2])]);
          const r4 = restPos(i + 1, j);
          links.push([idx(i + 1, j), idx(i, j + 1), Math.hypot(r2[0] - r4[0], r2[1] - r4[1], r2[2] - r4[2])]);
        }
      }
      if (j + 2 < H) {
        const r2 = restPos(i, j + 2);
        links.push([idx(i, j), idx(i, j + 2), Math.hypot(r2[0] - r[0], r2[1] - r[1], r2[2] - r[2])]);
      }
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(W * H * 3), 3));
  const uv = new Float32Array(W * H * 2);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) uv.set([i / (W - 1), j / (H - 1)], idx(i, j) * 2);
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const ix: number[] = [];
  for (let j = 0; j < H - 1; j++)
    for (let i = 0; i < W - 1; i++) {
      const a = idx(i, j), b = idx(i + 1, j), c = idx(i, j + 1), d = idx(i + 1, j + 1);
      ix.push(a, b, c, b, d, c);
    }
  geo.setIndex(ix);
  const cloth: Cloth = { W, H, p, q, links, anchors, chest, rest, cols, geo, ok: false };
  const tex = clothTex(g.a, g.b, furry);
  const outer = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#ffffff', map: tex, side: THREE.FrontSide, roughness: furry ? 1 : 0.88 }));
  const inner = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: furry ? g.b : g.b, side: THREE.BackSide, roughness: 0.9 }));
  const group = new THREE.Group();
  for (const m of [outer, inner]) {
    m.castShadow = true;
    m.frustumCulled = false;
    // the cloth lives in world space: its points are worked out there
    m.matrixAutoUpdate = false;
    m.matrixWorldAutoUpdate = false;
    m.userData.weapon = true;
    group.add(m);
  }
  group.userData.cloth = cloth;
  return group;
}

/** the anchor points in the world now */
function anchorsNow(c: Cloth, out: THREE.Vector3[]) {
  c.chest.getWorldPosition(tmpA);
  c.chest.getWorldQuaternion(tmpQ);
  tmpQ.multiply(c.rest);
  for (let i = 0; i < c.W; i++) out[i] = (out[i] ?? new THREE.Vector3()).copy(c.anchors[i]).applyQuaternion(tmpQ).add(tmpA);
  return tmpQ;
}
const anchorBuf: THREE.Vector3[] = [];
function stepCloth(c: Cloth, dt: number, feetY: number, t: number) {
  const A = anchorsNow(c, anchorBuf);
  const W = c.W, H = c.H, p = c.p, q = c.q;
  // at the start (or after a jump across the map) hang it straight down behind
  const a0 = anchorBuf[0];
  const jump = c.ok && Math.hypot(p[0] - a0.x, p[1] - a0.y, p[2] - a0.z) > 1.5;
  if (!c.ok || jump) {
    const back = new THREE.Vector3(0, 0, -1).applyQuaternion(A);
    const mid = anchorBuf[(W - 1) >> 1];
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const k = (j * W + i) * 3, a = anchorBuf[i];
        const s = (j / (H - 1)) * 0.35;
        p[k] = q[k] = a.x + (a.x - mid.x) * s + back.x * j * 0.02;
        p[k + 1] = q[k + 1] = a.y - j * 0.095;
        p[k + 2] = q[k + 2] = a.z + (a.z - mid.z) * s + back.z * j * 0.02;
      }
    c.ok = true;
  }
  // (a viewer on slow software frames lets the cloth catch up: __T2_CLOTHCAP)
  const cap = (globalThis as any).__T2_CLOTHCAP ?? 1 / 20;
  const n = Math.min(Math.ceil(cap * 90), Math.max(1, Math.ceil(dt / (1 / 90))));
  const h = Math.min(dt, cap) / n;
  // a gust that comes and goes, across the body's back
  const gust = 0.6 + Math.sin(t * 1.3) * 0.4 + Math.sin(t * 3.7) * 0.2;
  for (let s = 0; s < n; s++) {
    for (let j = 1; j < H; j++)
      for (let i = 0; i < W; i++) {
        const k = (j * W + i) * 3;
        const vx = (p[k] - q[k]) * 0.985, vy = (p[k + 1] - q[k + 1]) * 0.985, vz = (p[k + 2] - q[k + 2]) * 0.985;
        q[k] = p[k];
        q[k + 1] = p[k + 1];
        q[k + 2] = p[k + 2];
        const flutter = Math.sin(t * 9 + i * 1.7 + j * 0.9) * 0.6 * gust * (j / H);
        p[k] += vx + flutter * 0.4 * h * h;
        p[k + 1] += vy - 9.8 * h * h;
        p[k + 2] += vz + flutter * 0.3 * h * h;
      }
    for (let it = 0; it < 5; it++) {
      for (let i = 0; i < W; i++) {
        const k = i * 3, a = anchorBuf[i];
        p[k] = a.x;
        p[k + 1] = a.y;
        p[k + 2] = a.z;
      }
      for (const [a, b, L] of c.links) {
        const ka = a * 3, kb = b * 3;
        const dx = p[kb] - p[ka], dy = p[kb + 1] - p[ka + 1], dz = p[kb + 2] - p[ka + 2];
        const d = Math.hypot(dx, dy, dz) || 1e-6;
        const pinA = a < W, pinB = b < W;
        const f = (d - L) / d;
        if (pinA && pinB) continue;
        const wa = pinA ? 0 : pinB ? 1 : 0.5, wb = pinB ? 0 : pinA ? 1 : 0.5;
        p[ka] += dx * f * wa;
        p[ka + 1] += dy * f * wa;
        p[ka + 2] += dz * f * wa;
        p[kb] -= dx * f * wb;
        p[kb + 1] -= dy * f * wb;
        p[kb + 2] -= dz * f * wb;
      }
      // off the body and legs, above the ground
      for (const col of c.cols) {
        col.a.getWorldPosition(tmpB);
        if (col.b) col.b.getWorldPosition(tmpC);
        for (let k = W * 3; k < p.length; k += 3) {
          let cx = tmpB.x, cy = tmpB.y, cz = tmpB.z;
          if (col.b) {
            const sx = tmpC.x - tmpB.x, sy = tmpC.y - tmpB.y, sz = tmpC.z - tmpB.z;
            const L2 = sx * sx + sy * sy + sz * sz || 1e-6;
            const u = Math.max(0, Math.min(1, ((p[k] - tmpB.x) * sx + (p[k + 1] - tmpB.y) * sy + (p[k + 2] - tmpB.z) * sz) / L2));
            cx += sx * u;
            cy += sy * u;
            cz += sz * u;
          }
          const dx = p[k] - cx, dy = p[k + 1] - cy, dz = p[k + 2] - cz, d = Math.hypot(dx, dy, dz);
          if (d < col.r && d > 1e-5) {
            const f = col.r / d;
            p[k] = cx + dx * f;
            p[k + 1] = cy + dy * f;
            p[k + 2] = cz + dz * f;
          }
        }
      }
      for (let k = W * 3; k < p.length; k += 3) if (p[k + 1] < feetY + 0.03) p[k + 1] = feetY + 0.03;
    }
  }
  const pos = c.geo.getAttribute('position') as THREE.BufferAttribute;
  (pos.array as Float32Array).set(p);
  pos.needsUpdate = true;
  c.geo.computeVertexNormals();
  c.geo.computeBoundingSphere();
}

// ---------------------------------------------------------------- putting it all on
const BONES = {
  head: /^head$/,
  top: /^headtopend$/,
  chest: /^spine2$/,
  chest1: /^spine1$/,
  hips: /^hips$/,
  lthigh: /^leftupleg$/,
  rthigh: /^rightupleg$/,
  lknee: /^leftleg$/,
  rknee: /^rightleg$/,
  lfoot: /^leftfoot$/,
  rfoot: /^rightfoot$/,
  larm: /^leftarm$/,
  rarm: /^rightarm$/,
  neck: /^neck$/,
};
type BoneKey = keyof typeof BONES;

/** the body's own frame at rest, read from its bones (Tripo bodies stand facing +x in their rig, the 散人's own faces
 * +z): x to his left, y up, z the way he faces; o its origin (the hips), all in the model's own space */
interface BodyFrame {
  o: THREE.Vector3;
  m: THREE.Matrix4;
  inv: THREE.Matrix4;
}
function bodyFrame(pos: (k: BoneKey) => THREE.Vector3 | null): BodyFrame {
  const hips = pos('hips') ?? new THREE.Vector3(), head = pos('head') ?? hips.clone().add(new THREE.Vector3(0, 1, 0));
  const la = pos('larm'), ra = pos('rarm');
  const up = head.clone().sub(hips).normalize();
  const right = la && ra ? ra.clone().sub(la).normalize() : new THREE.Vector3(-1, 0, 0);
  const fwd = new THREE.Vector3().crossVectors(up, right).normalize();
  const left = new THREE.Vector3().crossVectors(up, fwd).normalize();
  const up2 = new THREE.Vector3().crossVectors(fwd, left).normalize();
  const m = new THREE.Matrix4().makeBasis(left, up2, fwd);
  return { o: hips, m, inv: m.clone().invert() };
}
/** a point in the model's space into the body frame (relative to its origin), and back */
const toFrame = (F: BodyFrame, v: THREE.Vector3) => v.clone().sub(F.o).applyMatrix4(F.inv);
const fromFrame = (F: BodyFrame, v: THREE.Vector3) => v.clone().applyMatrix4(F.m).add(F.o);

/** every skinned vertex of the body (not its weapons or worn pieces) in the body frame, in metres, as it stands now */
function bodyPoints(obj: THREE.Object3D, F: BodyFrame, k: number) {
  const out: number[] = [];
  const v = new THREE.Vector3(), inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
  obj.traverse((o: any) => {
    if (!o.isSkinnedMesh || o.userData.weapon || o.userData.outfit) return;
    const pos = o.geometry.getAttribute('position') as THREE.BufferAttribute;
    const step = Math.max(1, Math.floor(pos.count / 60000));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i);
      o.applyBoneTransform?.(i, v);
      v.applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      const r = toFrame(F, v);
      out.push(r.x / k, r.y / k, r.z / k);
    }
  });
  return new Float32Array(out);
}
/** a quantile of what pick() gives for the points it doesn't skip (undefined), or dflt when none */
function quant(P: Float32Array, pick: (x: number, y: number, z: number) => number | undefined, q: number, dflt: number) {
  const a: number[] = [];
  for (let i = 0; i < P.length; i += 3) {
    const r = pick(P[i], P[i + 1], P[i + 2]);
    if (r !== undefined) a.push(r);
  }
  if (a.length < 8) return dflt;
  a.sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(a.length * q))];
}
/** the head as worn: the skull's top and middle under the hair, the topknot (if any) above it, all in metres.
 * The middle comes from the head's widest part (ears and brow); the top from the hair's height on a ring round that
 * middle (the median, so a topknot over one side doesn't count), plus the dome's rise to the centre */
function headShape(P: Float32Array, head: THREE.Vector3) {
  const xs: number[] = [], zs: number[] = [];
  for (let i = 0; i < P.length; i += 3) {
    const y = P[i + 1] - head.y;
    if (y < 0.07 || y > 0.15 || Math.hypot(P[i] - head.x, P[i + 2] - head.z) > 0.15) continue;
    xs.push(P[i]);
    zs.push(P[i + 2]);
  }
  const mid = (a: number[], d: number) => {
    if (a.length < 20) return d;
    a.sort((u, v) => u - v);
    return (a[Math.floor(a.length * 0.03)] + a[Math.floor(a.length * 0.97)]) / 2;
  };
  const cx = mid(xs, head.x), cz = mid(zs, head.z + 0.01);
  /** the highest point of the head within r of (x, z) */
  const hAt = (x: number, z: number, r: number) => {
    let h = -1e9;
    for (let i = 0; i < P.length; i += 3) {
      const y = P[i + 1];
      if (y < head.y + 0.05 || y > head.y + 0.5) continue;
      if (Math.hypot(P[i] - x, P[i + 2] - z) < r && y > h) h = y;
    }
    return h;
  };
  const ring: number[] = [];
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const h = hAt(cx + Math.cos(a) * 0.055, cz + Math.sin(a) * 0.055, 0.014);
    if (h > -1e8) ring.push(h);
  }
  ring.sort((u, v) => u - v);
  const skullTop = ring.length >= 6 ? ring[Math.floor(ring.length / 2)] + 0.018 : head.y + 0.2;
  let bn = 0, bx = 0, bz = 0, bTop = -1e9;
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], z = P[i + 2];
    if (y > skullTop + 0.012 && y < head.y + 0.5 && Math.hypot(x - cx, z - cz) < 0.12) {
      bn++;
      bx += x;
      bz += z;
      bTop = Math.max(bTop, y);
    }
  }
  const bun = bn > 30 ? { x: bx / bn, z: bz / bn, top: bTop } : null;
  return { skullTop, cx, cz, bun, bunH: bun ? bun.top - skullTop : 0 };
}

/** put the shown pieces on a loaded body (removing what was there) */
export function dressBody(obj: THREE.Object3D, worn: Partial<Record<Slot, string>>) {
  const old: THREE.Object3D[] = [];
  obj.traverse((o) => o.userData.outfit && old.push(o));
  for (const o of old) o.parent?.remove(o);
  obj.userData.cloth = null;
  obj.userData.hangs = [];
  const bones: Partial<Record<BoneKey, THREE.Object3D>> = {};
  obj.traverse((o: any) => {
    if (!o.isBone) return;
    const n = norm(o.name);
    for (const k of Object.keys(BONES) as BoneKey[]) if (!bones[k] && BONES[k].test(n)) bones[k] = o;
  });
  if (!bones.head) return;
  // fit in the rest stance (kept by keepRest when the body was cloned), whatever it is doing now, then put it back.
  // Not Skeleton.pose(): a Tripo body's mesh is bound in a space other than its armature's, and pose() would leave
  // every bone scaled by the difference (the body drawn twice its size)
  const saved: [THREE.Object3D, THREE.Vector3, THREE.Quaternion, THREE.Vector3][] = [];
  obj.traverse((o: any) => {
    const r = o.isBone && o.userData.rest;
    if (!r) return;
    saved.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]);
    o.position.copy(r[0]);
    o.quaternion.copy(r[1]);
    o.scale.copy(r[2]);
  });
  obj.updateMatrixWorld(true);
  try {
    fit(obj, bones, worn);
  } finally {
    for (const [o, p, q, s] of saved) {
      o.position.copy(p);
      o.quaternion.copy(q);
      o.scale.copy(s);
    }
    obj.updateMatrixWorld(true);
  }
}

/** remember every bone's rest transform: call on a fresh clone, before any clip has moved it */
export function keepRest(obj: THREE.Object3D) {
  obj.traverse((o: any) => {
    if (o.isBone) o.userData.rest = [o.position.clone(), o.quaternion.clone(), o.scale.clone()];
  });
}

function fit(obj: THREE.Object3D, bones: Partial<Record<BoneKey, THREE.Object3D>>, worn: Partial<Record<Slot, string>>) {
  if (!bones.head) return;
  const rootQ = obj.getWorldQuaternion(new THREE.Quaternion());
  const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
  const sc = new THREE.Vector3();
  obj.getWorldScale(sc);
  const k = 1 / sc.y; // metres to the model's own units
  const local = (b: THREE.Object3D) => b.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
  const pos = (key: BoneKey) => (bones[key] ? local(bones[key]!) : null);
  const F = bodyFrame(pos);
  /** a bone's place in the body frame, in metres */
  const at = (key: BoneKey) => (bones[key] ? toFrame(F, local(bones[key]!)).divideScalar(k) : null);
  // the body frame's turn in the world at rest
  const frameQ = rootQ.clone().multiply(new THREE.Quaternion().setFromRotationMatrix(F.m));
  /** a piece hung under a bone, upright and facing the body's front at rest; where: in the body frame, in metres */
  const attach = (bone: THREE.Object3D, piece: THREE.Object3D, where: THREE.Vector3, slot: string) => {
    const bs = new THREE.Vector3();
    bone.getWorldScale(bs);
    const holder = new THREE.Group();
    holder.userData.outfit = slot;
    const bq = bone.getWorldQuaternion(new THREE.Quaternion());
    holder.quaternion.copy(bq.clone().invert().multiply(frameQ));
    const wp = fromFrame(F, where.clone().multiplyScalar(k)).applyMatrix4(obj.matrixWorld);
    bone.worldToLocal(wp);
    holder.position.copy(wp);
    holder.scale.set(1 / bs.x, 1 / bs.y, 1 / bs.z);
    piece.traverse((o: any) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.userData.weapon = true; // kept out of the character shader and its hit flash
      }
    });
    holder.add(piece);
    bone.add(holder);
    return holder;
  };
  const P = bodyPoints(obj, F, k);
  const head = at('head')!;
  const hs = headShape(P, head);
  const neck = at('neck') ?? head.clone().add(new THREE.Vector3(0, -0.1, -0.01));
  const hips = at('hips') ?? new THREE.Vector3();
  if ((globalThis as any).__T2_FITLOG) console.error('[fit] head', head.toArray().map((v) => v.toFixed(3)).join(','), 'skull', hs.skullTop.toFixed(3), hs.cx.toFixed(3), hs.cz.toFixed(3), 'bun', JSON.stringify(hs.bun), 'neck', neck.toArray().map((v) => v.toFixed(3)).join(','), 'pts', P.length / 3);
  // ---- hat: a wide or soft one sits on the skull (raised over a tall topknot); the jade crown sits on the topknot
  const hg = garment(worn.hat);
  if (hg) {
    let where: THREE.Vector3;
    if (hg.shape === 'crown') where = hs.bun ? new THREE.Vector3(hs.bun.x, hs.bun.top - 0.04, hs.bun.z) : new THREE.Vector3(hs.cx, hs.skullTop - 0.01, hs.cz - 0.02);
    else {
      // room inside each kind over the skull's top: the cone's tip, the fur dome, the soft cap
      const room = hg.shape === 'felt' ? 0.06 : hg.shape === 'scarf' ? 0.058 : 0.08;
      const lift = Math.max(hg.shape === 'felt' || hg.shape === 'scarf' ? -0.008 : 0, hs.bunH - room);
      where = new THREE.Vector3(hs.cx, hs.skullTop + lift, hs.cz);
    }
    attach(bones.head, hat(hg), where, 'hat');
  }
  // ---- hanging at the right hip, just outside the clothes there
  const bg = garment(worn.belt);
  if (bg && bones.hips) {
    const side = quant(P, (x, y, z) => (y > hips.y - 0.02 && y < hips.y + 0.1 && x < 0 && x > -0.27 && Math.abs(z - hips.z) < 0.12 ? -x : undefined), 0.97, 0.15);
    const holder = attach(bones.hips, hanging(bg), new THREE.Vector3(hips.x - Math.max(0.14, side + 0.012), hips.y + 0.06, hips.z + 0.02), 'belt');
    holder.userData.swing = { ax: 0, vx: 0, az: 0, vz: 0, last: new THREE.Vector3(), vel: new THREE.Vector3(), init: false };
    obj.userData.hangs.push(holder);
  }
  // ---- cloak: cloth hung from the shoulders, tied by cords over them to a clasp on the chest
  const cg = garment(worn.cloak);
  const chest = bones.chest ?? bones.chest1;
  if (cg && chest) {
    const cp = toFrame(F, local(chest)).divideScalar(k);
    // the back between the shoulder blades, the shoulders' tops, the front of the chest under the collar
    const backZ = quant(P, (x, y, z) => (Math.abs(x) < 0.12 && y > cp.y && y < neck.y ? z : undefined), 0.02, cp.z - 0.12);
    const la = at('larm'), ra = at('rarm');
    const armHalf = la && ra ? Math.abs(la.x - ra.x) / 2 : 0.17;
    const half = Math.min(0.27, Math.max(0.17, armHalf + 0.03));
    const shoulderY = quant(P, (x, y, z) => (Math.abs(x) > 0.13 && Math.abs(x) < 0.17 && Math.abs(z - cp.z) < 0.06 && y > cp.y && y < neck.y + 0.05 ? y : undefined), 0.95, neck.y - 0.03);
    const claspY = neck.y - 0.075;
    const frontZ = quant(P, (x, y, z) => (Math.abs(x) < 0.06 && Math.abs(y - claspY) < 0.025 ? z : undefined), 0.98, cp.z + 0.12);
    // the anchors, relative to the chest bone, in metres
    // (not further back than 24 cm: the 散人's bedroll pokes through rather than holding the cloak off like a board)
    const top = { y: neck.y - cp.y - 0.03, back: Math.max(-0.24, backZ - cp.z - 0.025), half };
    const feet = at('lfoot') ?? new THREE.Vector3(0, -0.9, 0);
    const length = Math.max(0.7, (neck.y - feet.y) * 0.72);
    // the chest's rest turn relative to the body frame (undone each frame, so the top follows the chest)
    const cq = chest.getWorldQuaternion(new THREE.Quaternion());
    const rest = cq.clone().invert().multiply(frameQ);
    const cols: Collider[] = [];
    if (bones.hips) cols.push({ a: bones.hips, b: chest, r: Math.max(0.14, -top.back - 0.02) });
    if (bones.lthigh && bones.lknee) cols.push({ a: bones.lthigh, b: bones.lknee, r: 0.1 });
    if (bones.rthigh && bones.rknee) cols.push({ a: bones.rthigh, b: bones.rknee, r: 0.1 });
    if (bones.lknee && bones.lfoot) cols.push({ a: bones.lknee, b: bones.lfoot, r: 0.08 });
    if (bones.rknee && bones.rfoot) cols.push({ a: bones.rknee, b: bones.rfoot, r: 0.08 });
    if ((globalThis as any).__T2_FITLOG) console.error('[fit] cloak top', JSON.stringify(top), 'armHalf', armHalf.toFixed(3), 'shoulderY', (shoulderY - cp.y).toFixed(3), 'frontZ', (frontZ - cp.z).toFixed(3), 'length', length.toFixed(2));
    const g = makeCloth(cg, chest, rest, top, cols, length);
    g.userData.outfit = 'cloak';
    obj.add(g);
    obj.userData.cloth = g.userData.cloth;
    attach(chest, ties(cg, top, shoulderY - cp.y, claspY - cp.y, frontZ - cp.z), cp, 'ties');
  }
}

/** how a cloak is tied: from its two top corners a cord over each shoulder down to a clasp at the chest (a fur ruff
 * for the fox fur); coordinates relative to the chest bone, metres, body frame */
function ties(g: Garment, top: { y: number; back: number; half: number }, shoulderY: number, claspY: number, frontZ: number) {
  const out = new THREE.Group();
  if (g.shape === 'fur') {
    // a thick fur ruff laid round the neck on the shoulders, closed under the chin
    const ring = [
      [0, top.y - 0.005, top.back + 0.035],
      [0.1, shoulderY + 0.0, top.back * 0.55],
      [0.135, shoulderY + 0.01, 0.0],
      [0.09, claspY + 0.045, frontZ - 0.015],
      [0, claspY + 0.025, frontZ + 0.012],
      [-0.09, claspY + 0.045, frontZ - 0.015],
      [-0.135, shoulderY + 0.01, 0.0],
      [-0.1, shoulderY + 0.0, top.back * 0.55],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
    out.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ring, true), 48, 0.038, 10, true), mat('#ffffff', { map: fur(g.a), roughness: 1 })));
    return out;
  }
  const cord = mat('#' + new THREE.Color(g.b).multiplyScalar(0.55).getHexString(), { roughness: 0.75 });
  for (const s of [-1, 1]) {
    const pts = [
      new THREE.Vector3(s * top.half, top.y - 0.025, top.back + 0.07),
      new THREE.Vector3(s * 0.15, shoulderY + 0.01, top.back * 0.2),
      new THREE.Vector3(s * 0.08, claspY + 0.045, frontZ + 0.008),
      new THREE.Vector3(s * 0.02, claspY + 0.004, frontZ + 0.013),
    ];
    out.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.004, 6, false), cord));
  }
  const clasp = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.007, 18).rotateX(Math.PI / 2), mat('#c9a24a', { metalness: 0.4, roughness: 0.35 }));
  clasp.position.set(0, claspY, frontZ + 0.016);
  out.add(clasp);
  return out;
}

/** each frame: the cloak's cloth, the hangings' swing, a veil or ribbons stirring */
export function stepOutfit(obj: THREE.Object3D, dt: number, feetY: number, t: number) {
  const c = obj.userData.cloth as Cloth | null;
  if (c) stepCloth(c, Math.min(dt, (globalThis as any).__T2_CLOTHCAP ?? 1 / 20), feetY, t);
  for (const h of (obj.userData.hangs ?? []) as THREE.Object3D[]) {
    const s = h.userData.swing;
    h.getWorldPosition(tmpA);
    if (!s.init) {
      s.last.copy(tmpA);
      s.init = true;
    }
    const v = tmpB.copy(tmpA).sub(s.last).divideScalar(Math.max(dt, 1e-3));
    const acc = tmpC.copy(v).sub(s.vel).divideScalar(Math.max(dt, 1e-3)).clampLength(0, 60);
    s.vel.copy(v);
    s.last.copy(tmpA);
    // into the body's frame (the holder's parent turn): forward/back swing about x, sideways about z
    h.parent!.getWorldQuaternion(tmpQ);
    acc.applyQuaternion(tmpQ.clone().invert());
    const L = 0.12, w2 = 9.8 / L;
    // small steps (a stiff short pendulum blows up on a long frame)
    const T = Math.min(dt, 0.25), n = Math.ceil(T / (1 / 120)), step = T / n;
    for (let i = 0; i < n; i++) {
      s.vx += (-w2 * Math.sin(s.ax) - 3.5 * s.vx + (acc.z / L) * 0.4 * (i === 0 ? n : 0)) * step;
      s.vz += (-w2 * Math.sin(s.az) - 3.5 * s.vz - (acc.x / L) * 0.4 * (i === 0 ? n : 0)) * step;
      s.ax = Math.max(-1.1, Math.min(1.1, s.ax + s.vx * step));
      s.az = Math.max(-1.1, Math.min(1.1, s.az + s.vz * step));
    }
    const piece = h.children[0];
    if (piece) {
      piece.rotation.x = s.ax;
      piece.rotation.z = s.az;
    }
  }
  obj.traverse((o) => {
    if (o.name === 'veil') o.rotation.y = Math.sin(t * 1.7) * 0.05;
    if (o.name === 'ribbon') o.rotation.x = 0.18 + Math.sin(t * 3 + o.position.x * 40) * 0.12;
  });
}

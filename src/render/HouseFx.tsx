// 地仙's and 交易员's things in the world, drawn the way 天阙 1's DixianFx / TraderFx drew them: the 地脉回春 ring on
// the ground, the white crane of 人间不渡, the pink 损有余 beam, 鹤羽护's feather shell, 清风诀's closing ring; the
// cash of 撒钱 fluttering down, the red candles of 黑色星期一, the SHORT arrow and the $$$ daydream over heads.
import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Sim } from '../game/sim';

const springTex = (() => {
  let t: THREE.Texture | null = null;
  return () => {
    if (t) return t;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(128, 128, 10, 128, 128, 126);
    grd.addColorStop(0, 'rgba(242,204,107,0.05)');
    grd.addColorStop(0.75, 'rgba(214,160,60,0.2)');
    grd.addColorStop(0.97, 'rgba(250,224,150,0.6)');
    grd.addColorStop(1, 'rgba(250,224,150,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(128, 128, 126, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,240,200,0.9)';
    g.lineWidth = 3;
    for (const r of [118, 92]) {
      g.beginPath();
      g.arc(128, 128, r, 0, Math.PI * 2);
      g.stroke();
    }
    g.lineWidth = 5;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      for (const off of [-0.07, 0, 0.07]) {
        const b = a + off;
        g.beginPath();
        g.moveTo(128 + Math.cos(b) * 97, 128 + Math.sin(b) * 97);
        g.lineTo(128 + Math.cos(b) * 113, 128 + Math.sin(b) * 113);
        g.stroke();
      }
    }
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
})();

function buildCrane() {
  const root = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.6, emissive: '#d1fae5', emissiveIntensity: 0.35 });
  const black = new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.7 });
  const red = new THREE.MeshStandardMaterial({ color: '#dc2626', emissive: '#7f1d1d', emissiveIntensity: 0.6 });
  const beakM = new THREE.MeshStandardMaterial({ color: '#a3a38a', roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), white);
  body.scale.set(0.7, 0.6, 1.5);
  root.add(body);
  root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.05, -0.5), new THREE.Vector3(0, 0.2, -0.9), new THREE.Vector3(0, 0.25, -1.35)]), 10, 0.07, 6, false), white));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), black);
  head.position.set(0, 0.27, -1.4);
  root.add(head);
  const crest = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), red);
  crest.position.set(0, 0.36, -1.4);
  root.add(crest);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.4, 6), beakM);
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, 0.25, -1.68);
  root.add(beak);
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 4), black);
  legs.rotation.x = Math.PI / 2;
  legs.position.set(0, -0.05, 0.95);
  root.add(legs);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 6), black);
  tail.rotation.x = Math.PI / 2;
  tail.position.set(0, 0.02, 0.7);
  root.add(tail);
  const wings: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    w.position.set(s * 0.22, 0.12, -0.05);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.75), white);
    inner.position.set(s * 0.65, 0, 0);
    const outer = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.035, 0.55), white);
    outer.position.set(s * 1.7, 0, 0.08);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.5), black);
    tip.position.set(s * 2.35, 0, 0.12);
    w.add(inner, outer, tip);
    w.userData.side = s;
    wings.push(w);
    root.add(w);
  }
  root.userData.wings = wings;
  root.visible = false;
  return root;
}

function label(text: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  void text;
  return t;
}
const shortTex = () =>
  label('SHORT', 256, 160, (g) => {
    g.fillStyle = '#ff2a2a';
    g.beginPath();
    g.moveTo(88, 70);
    g.lineTo(168, 70);
    g.lineTo(168, 100);
    g.lineTo(200, 100);
    g.lineTo(128, 156);
    g.lineTo(56, 100);
    g.lineTo(88, 100);
    g.closePath();
    g.fill();
    g.font = 'bold 54px Arial, sans-serif';
    g.textAlign = 'center';
    g.lineWidth = 8;
    g.strokeStyle = '#300';
    g.strokeText('SHORT', 128, 52);
    g.fillText('SHORT', 128, 52);
  });
const dreamTex = () =>
  label('$$$', 200, 160, (g) => {
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.strokeStyle = '#2f6b3f';
    g.lineWidth = 5;
    g.beginPath();
    g.ellipse(100, 62, 88, 54, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    for (const [x, y, r] of [[48, 128, 12], [28, 148, 7]]) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    g.fillStyle = '#2f8a3f';
    g.font = 'bold 70px Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('$$$', 100, 66);
  });
const billTex = () =>
  label('100', 128, 56, (g) => {
    g.fillStyle = '#c9dcb8';
    g.fillRect(0, 0, 128, 56);
    g.strokeStyle = '#3d6b3a';
    g.lineWidth = 4;
    g.strokeRect(4, 4, 120, 48);
    g.fillStyle = '#4f7d49';
    g.beginPath();
    g.ellipse(64, 28, 14, 17, 0, 0, Math.PI * 2);
    g.fill();
    g.font = 'bold 20px Georgia, serif';
    g.fillText('100', 10, 24);
    g.fillText('100', 86, 48);
  });

const BILLS = 120;
const MAX_HEADS = 10;
const vA = new THREE.Vector3();
const vB = new THREE.Vector3();
const vC = new THREE.Vector3();
const UPV = new THREE.Vector3(0, 1, 0);

export function HouseFx({ sim }: { sim: Sim }) {
  const P = useMemo(() => {
    const root = new THREE.Group();
    const add = <T extends THREE.Object3D>(o: T) => (root.add(o), o);
    const disc = new THREE.MeshBasicMaterial({ map: springTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const wallM = new THREE.MeshBasicMaterial({ color: '#e9b949', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const discs = Array.from({ length: 6 }, () => add(Object.assign(new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), disc.clone()), { visible: false, renderOrder: 2 })));
    const walls = Array.from({ length: 6 }, () => add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.6, 48, 1, true), wallM.clone()), { visible: false })));
    const cranes = Array.from({ length: 3 }, () => add(buildCrane()));
    const unitBeam = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
    const threads = Array.from({ length: 6 }, () => {
      const g = new THREE.Group();
      const core = new THREE.Mesh(unitBeam, new THREE.MeshBasicMaterial({ color: '#fdf2f8', transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
      core.name = 'core';
      const halo = new THREE.Mesh(unitBeam, new THREE.MeshBasicMaterial({ color: '#f472b6', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      halo.name = 'halo';
      const from = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f43f5e', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
      from.name = 'from';
      const to = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#4ade80', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
      to.name = 'to';
      g.add(core, halo, from, to);
      g.visible = false;
      g.traverse((o) => (o.frustumCulled = false));
      return add(g);
    });
    const winds = Array.from({ length: 4 }, () => add(Object.assign(new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#86efac', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })), { visible: false })));
    const shellM = new THREE.MeshBasicMaterial({ color: '#f0fdf4', transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending });
    const shells = Array.from({ length: MAX_HEADS }, () => add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), shellM), { visible: false })));
    const im = (g: THREE.BufferGeometry, m: THREE.Material, n: number) => {
      const x = new THREE.InstancedMesh(g, m, n);
      x.count = 0;
      x.frustumCulled = false;
      return add(x);
    };
    const bills = im(new THREE.PlaneGeometry(0.34, 0.15).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: billTex(), roughness: 0.85, side: THREE.DoubleSide }), 6 * BILLS);
    const candle = im(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#d4181c', emissive: '#7a0000', emissiveIntensity: 0.8, roughness: 0.4 }), 24);
    const wick = im(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#ff3b3b', emissive: '#ff0000', emissiveIntensity: 1 }), 24);
    const ring = im(new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff2020', transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }), 24);
    const st = shortTex();
    const dt = dreamTex();
    const sprite = (map: THREE.Texture, w: number, h: number) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false, transparent: true }));
      s.scale.set(w, h, 1);
      s.visible = false;
      s.renderOrder = 10;
      return add(s);
    };
    const shorts = Array.from({ length: MAX_HEADS }, () => sprite(st, 1.1, 0.7));
    const dreams = Array.from({ length: MAX_HEADS }, () => sprite(dt, 1.0, 0.8));
    return { root, discs, walls, cranes, threads, winds, shells, bills, candle, wick, ring, shorts, dreams };
  }, []);
  const o = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const pl = sim.player;
    const near = (x: number, z: number, r = 80) => Math.abs(x - pl.pos[0]) < r && Math.abs(z - pl.pos[2]) < r;
    const zones = sim.zones.filter((z) => near(z.x, z.z));
    const of = (id: string) => zones.filter((z) => z.skill === id);
    // 地脉回春
    const springs = of('earth_spring');
    P.discs.forEach((d, k) => {
      const s = springs[k];
      const w = P.walls[k];
      d.visible = w.visible = !!s;
      if (!s) return;
      const grow = Math.min(1, s.age / 0.35);
      const fade = Math.min(1, s.t / 0.6);
      const r = s.r * (0.3 + 0.7 * grow);
      d.position.set(s.x, s.y + 0.06, s.z);
      d.scale.setScalar(r);
      d.rotation.y = time * 0.25;
      (d.material as THREE.MeshBasicMaterial).opacity = (0.75 + 0.25 * Math.sin(time * 3)) * fade;
      w.position.set(s.x, s.y + 0.3, s.z);
      w.scale.set(r, 1, r);
      (w.material as THREE.MeshBasicMaterial).opacity = 0.12 * fade;
    });
    // 人间不渡: the crane comes down in a wide circle, flaps round him, then climbs away
    const cr = of('mortal_realm');
    P.cranes.forEach((c, k) => {
      const z = cr[k];
      c.visible = !!z;
      if (!z) return;
      const t = z.age;
      const a = t * 1.9;
      const rad = 5.5 - Math.min(2, t) * 0.9;
      const h = t < 0.6 ? 14 - t * 15 : t > 3.6 ? 5 + (t - 3.6) * 12 : 5 + Math.sin(t * 2) * 0.4;
      c.position.set(z.x + Math.cos(a) * rad, z.y + h, z.z + Math.sin(a) * rad);
      c.rotation.set(0, Math.PI - a, 0.35, 'YXZ');
      c.scale.setScalar(1.1);
      const flap = Math.sin(time * 9) * 0.55;
      for (const w of c.userData.wings as THREE.Group[]) w.rotation.z = flap * (w.userData.side as number);
    });
    // 损有余
    const drains = of('drain_surplus');
    P.threads.forEach((g, k) => {
      const z = drains[k];
      const a = z && sim.fighters[z.data.from];
      const b = z && sim.fighters[z.owner];
      g.visible = !!(a && b && a.hp > 0 && b.hp > 0);
      if (!g.visible) return;
      vA.set(a.pos[0], a.pos[1] + 1.2, a.pos[2]);
      vB.set(b.pos[0], b.pos[1] + 1.2, b.pos[2]);
      const len = vA.distanceTo(vB);
      const pulse = 1 + 0.25 * Math.sin(time * 14);
      for (const name of ['core', 'halo']) {
        const m = g.getObjectByName(name)!;
        m.position.copy(vA).add(vB).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(UPV, vC.copy(vB).sub(vA).normalize());
        const w = name === 'core' ? 0.05 : 0.16 * pulse;
        m.scale.set(w, len, w);
      }
      const from = g.getObjectByName('from')!;
      from.position.set(a.pos[0], a.pos[1] + 0.06, a.pos[2]);
      from.scale.setScalar(0.9 + 0.2 * Math.sin(time * 8));
      const to = g.getObjectByName('to')!;
      to.position.set(b.pos[0], b.pos[1] + 0.06, b.pos[2]);
      to.scale.setScalar(0.9 + 0.2 * Math.sin(time * 8 + 2));
    });
    // fighters near the player: 清风诀 rings, feather shells, SHORT and daydreams
    const close = sim.fighters.filter((f) => f.hp > 0 && near(f.pos[0], f.pos[2], 45));
    const breezing = close.filter((f) => f.run?.id === 'qingfeng');
    P.winds.forEach((m, k) => {
      const f = breezing[k];
      m.visible = !!f;
      if (!f) return;
      m.position.set(f.pos[0], f.pos[1] + 0.06, f.pos[2]);
      m.scale.setScalar(2.4 - 1.7 * Math.min(1, f.run!.t / 0.9));
      m.rotation.y = time * 3;
    });
    const warded = close.filter((f) => (f.ward ?? 0) > 0 && f.st.wardT > 0);
    P.shells.forEach((m, k) => {
      const f = warded[k];
      m.visible = !!f;
      if (!f) return;
      m.position.set(f.pos[0], f.pos[1] + 1.0, f.pos[2]);
      m.scale.set(0.85, 1.2, 0.85);
      m.rotation.y = time;
    });
    const shorted = close.filter((f) => f.st.weak > 0);
    P.shorts.forEach((sp, k) => {
      const f = shorted[k];
      sp.visible = !!f;
      if (f) sp.position.set(f.pos[0], f.pos[1] + 2.55 + Math.sin(time * 4) * 0.08, f.pos[2]);
    });
    const dreaming = close.filter((f) => f.st.daze > 0);
    P.dreams.forEach((sp, k) => {
      const f = dreaming[k];
      sp.visible = !!f;
      if (f) sp.position.set(f.pos[0] + 0.35, f.pos[1] + 2.4 + Math.sin(time * 2.5) * 0.1 + (f.st.weak > 0 ? 0.8 : 0), f.pos[2]);
    });
    // cash on the ground: each patch scattered by its seed, the bills fluttering down over the first second
    let b = 0;
    for (const Z of of('make_it_rain')) {
      const age = Z.age - (Z.data.delay ?? 0);
      if (age < 0) continue;
      let s = Z.data.seed >>> 0;
      const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
      const fade = Math.min(1, Z.t / 0.8);
      for (let k = 0; k < BILLS && b < 6 * BILLS; k++) {
        const a = rnd() * Math.PI * 2;
        const d = Math.sqrt(rnd()) * Z.r;
        const fall = Math.max(0, 1 - (age - rnd() * 0.5) / 0.9);
        const h = fall * (2.5 + rnd() * 3);
        const x = Z.x + Math.cos(a) * d, zz = Z.z + Math.sin(a) * d;
        o.position.set(x + Math.sin(time * 6 + k) * 0.25 * fall, Z.y + 0.03 + rnd() * 0.05 + h, zz);
        o.rotation.set((rnd() - 0.5) * 0.3 + fall * Math.sin(time * 7 + k) * 1.2, rnd() * 6.28 + fall * time * 3, (rnd() - 0.5) * 0.3);
        o.scale.setScalar(1.3 * fade);
        o.updateMatrix();
        P.bills.setMatrixAt(b++, o.matrix);
      }
    }
    P.bills.count = b;
    P.bills.instanceMatrix.needsUpdate = true;
    // 黑色星期一: a red ring while each candle is coming, then the red bar out of the sky
    let c = 0;
    let rc = 0;
    for (const C of of('bm_candle')) {
      if (c >= 24) break;
      const big = C.data.big;
      const warn = C.data.warn;
      const w = big ? 3.0 : 1.1;
      const h = big ? 14 : 5.5;
      if (C.age < warn) {
        o.position.set(C.x, C.y + 0.06, C.z);
        o.rotation.set(0, 0, 0);
        o.scale.setScalar(C.r * (0.6 + 0.4 * (C.age / warn)));
        o.updateMatrix();
        P.ring.setMatrixAt(rc++, o.matrix);
      }
      const fall = Math.max(0, C.age - warn + 0.35) / 0.35;
      if (fall <= 0) continue;
      const drop = Math.max(0, 1 - fall);
      const sink = Math.max(0, C.age - warn - 0.8) * 4;
      const y = C.y + h / 2 + drop * drop * 40 - sink;
      o.rotation.set(0, (C.x * 13 + C.z * 7) % 6.28, 0);
      o.position.set(C.x, y, C.z);
      o.scale.set(w, h, w);
      o.updateMatrix();
      P.candle.setMatrixAt(c, o.matrix);
      o.position.set(C.x, y + h / 2 + h * 0.18, C.z);
      o.scale.set(w * 0.12, h * 0.36, w * 0.12);
      o.updateMatrix();
      P.wick.setMatrixAt(c, o.matrix);
      c++;
    }
    P.candle.count = P.wick.count = c;
    P.ring.count = rc;
    P.candle.instanceMatrix.needsUpdate = P.wick.instanceMatrix.needsUpdate = P.ring.instanceMatrix.needsUpdate = true;
  });

  return <primitive object={P.root} />;
}

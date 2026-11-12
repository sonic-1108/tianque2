// How the new houses' shots look in flight (game/kit.ts sets Projectile.look): 弓手's and 机关师's arrows and bolts,
// 狂刃's thrown stone, 符师's paper talismans, 琴师's notes, 气宗's balls of qi, 剑客's crescent of sword qi.
// Each mesh points its tip down -z (Juice turns +z away from the flight, as with the old darts).
import * as THREE from 'three';
import type { ShotLook } from '../game/types';

const glowTex = (() => {
  let t: THREE.Texture | null = null;
  return () => {
    if (t) return t;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    t = new THREE.CanvasTexture(c);
    return t;
  };
})();
const glyphTex = new Map<string, THREE.Texture>();
function charTex(ch: string, paper: boolean) {
  const k = ch + paper;
  let t = glyphTex.get(k);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = paper ? 128 : 64;
  const x = c.getContext('2d')!;
  if (paper) {
    x.fillStyle = '#f3d46b';
    x.fillRect(0, 0, 64, 128);
    x.strokeStyle = '#b4231a';
    x.lineWidth = 3;
    x.strokeRect(5, 5, 54, 118);
    x.fillStyle = '#b4231a';
    x.font = '700 30px "Noto Serif SC", serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('敕', 32, 36);
    x.fillText('令', 32, 82);
    x.fillRect(30, 100, 4, 20);
  } else {
    x.fillStyle = '#fff';
    x.font = '700 54px serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(ch, 32, 36);
  }
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  glyphTex.set(k, t);
  return t;
}
const add = (c: THREE.ColorRepresentation, o = 1) =>
  new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide });
function glow(color: THREE.ColorRepresentation, s: number, o = 0.9) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  m.scale.setScalar(s);
  return m;
}

/** a fresh mesh for one shot; `spin` (if any) is turned by the caller each frame */
export function shotMesh(look: ShotLook, color: string, radius: number): THREE.Object3D {
  const g = new THREE.Group();
  const col = new THREE.Color(color);
  switch (look) {
    case 'arrow': {
      const wood = new THREE.MeshStandardMaterial({ color: '#7a5a36', roughness: 0.8 });
      const iron = new THREE.MeshStandardMaterial({ color: '#9aa3ad', metalness: 0.8, roughness: 0.35 });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.95, 5).rotateX(Math.PI / 2), wood);
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 6).rotateX(-Math.PI / 2), iron);
      head.position.z = -0.55;
      g.add(shaft, head);
      const fl = new THREE.MeshStandardMaterial({ color: col.clone().lerp(new THREE.Color('#ffffff'), 0.3), roughness: 0.9, side: THREE.DoubleSide });
      for (const r of [0, Math.PI / 2]) {
        const f = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.22), fl);
        f.rotation.set(Math.PI / 2, 0, r);
        f.position.z = 0.38;
        g.add(f);
      }
      // a faint streak behind so it reads at speed
      const streak = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 1.4).rotateX(Math.PI / 2).translate(0, 0, 1.0), add(color, 0.45));
      g.add(streak);
      break;
    }
    case 'rock': {
      const s = Math.max(0.35, radius * 0.55);
      const geo = new THREE.DodecahedronGeometry(s, 0);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * (1 + Math.sin(i * 7.1) * 0.15), pos.getY(i) * 0.85, pos.getZ(i) * (1 + Math.cos(i * 3.3) * 0.15));
      geo.computeVertexNormals();
      const rock = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#7d6a58', roughness: 0.95, flatShading: true }));
      rock.name = 'spin';
      rock.castShadow = true;
      g.add(rock);
      break;
    }
    case 'talisman': {
      const paper = new THREE.Mesh(
        new THREE.PlaneGeometry(0.24, 0.48),
        new THREE.MeshBasicMaterial({ map: charTex('符', true), side: THREE.DoubleSide, fog: false, transparent: true }),
      );
      paper.name = 'flutter';
      g.add(paper, glow(color, 0.9, 0.7));
      break;
    }
    case 'note': {
      const ch = '♪♫♩'[Math.floor(Math.random() * 3)];
      const n = new THREE.Sprite(new THREE.SpriteMaterial({ map: charTex(ch, false), color, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
      n.scale.setScalar(0.55);
      n.name = 'bob';
      g.add(n, glow(color, 1.0, 0.6));
      break;
    }
    case 'orb': {
      const s = Math.max(0.18, radius * 0.45);
      const core = new THREE.Mesh(new THREE.SphereGeometry(s * 0.55, 12, 10), add('#ffffff', 0.95));
      const shell = new THREE.Mesh(new THREE.SphereGeometry(s, 14, 12), add(color, 0.5));
      shell.name = 'pulse';
      const tail = new THREE.Mesh(new THREE.ConeGeometry(s * 0.8, s * 5, 12, 1, true).rotateX(Math.PI / 2).translate(0, 0, s * 2.5), add(color, 0.28));
      g.add(core, shell, tail, glow(color, s * 6, 0.8));
      break;
    }
    case 'crescent': {
      // a flat arc of light lying across the flight, bowed forward
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 6, 24, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI), add(color, 0.9));
      arc.scale.set(1, 1, 0.55);
      const inner = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.14, 6, 24, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI), add(color, 0.3));
      inner.scale.set(1, 0.3, 0.55);
      g.add(arc, inner, glow(color, 1.4, 0.5));
      break;
    }
  }
  return g;
}

/** a frame's motion of the mesh's own parts */
export function animateShot(o: THREE.Object3D, look: ShotLook, time: number, id: number) {
  const spin = o.getObjectByName('spin');
  if (spin) spin.rotation.set(time * 9 + id, time * 6.3, 0);
  const fl = o.getObjectByName('flutter');
  if (fl) fl.rotation.set(Math.sin(time * 20 + id) * 0.5, time * 7 + id, 0);
  const bob = o.getObjectByName('bob');
  if (bob) bob.position.y = Math.sin(time * 14 + id) * 0.12;
  const pulse = o.getObjectByName('pulse');
  if (pulse) pulse.scale.setScalar(1 + Math.sin(time * 30 + id) * 0.12);
  void look;
}

export function disposeShot(o: THREE.Object3D) {
  o.traverse((x: any) => {
    if (x.geometry) x.geometry.dispose();
    if (x.material) x.material.dispose(); // the shared canvas textures stay
  });
}

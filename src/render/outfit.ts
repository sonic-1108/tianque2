// What the player wears (game/wardrobe.ts) put on the body: a hat on the head bone, a cloak hung from the upper spine,
// a belt round the hips (with its jade, gold or gourd). Pieces are made in metres and set under the bones with the
// bones' own scale undone, so they fit whatever size the model was loaded at. The robe is a dye in the character
// shader (characterShading TQ_DYE), not a piece.
import * as THREE from 'three';
import { garment, type Garment, type Slot } from '../game/wardrobe';

const mat = (c: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0, ...o });

function hat(g: Garment) {
  const out = new THREE.Group();
  const A = mat(g.a), B = mat(g.b);
  if (g.shape === 'douli' || g.shape === 'veil') {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.15, 24, 1, true), mat(g.shape === 'veil' ? g.a : g.a, { side: THREE.DoubleSide }));
    cone.position.y = 0.2;
    out.add(cone);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.012, 6, 32), B);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.13;
    out.add(rim);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), B);
    knob.position.y = 0.28;
    out.add(knob);
    if (g.shape === 'veil') {
      const veil = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.33, 0.42, 28, 1, true), mat(g.b, { transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }));
      veil.position.y = -0.08;
      out.add(veil);
    }
  } else if (g.shape === 'crown') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.06, 12), A);
    base.position.set(0, 0.2, -0.03);
    out.add(base);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 6), mat(g.b, { metalness: 0.8, roughness: 0.3 }));
    pin.rotation.z = Math.PI / 2;
    pin.position.set(0, 0.2, -0.03);
    out.add(pin);
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat('#141210'));
    bun.position.set(0, 0.17, -0.03);
    out.add(bun);
  } else if (g.shape === 'scarf') {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.22), A);
    cap.position.set(0, 0.17, -0.01);
    out.add(cap);
    for (const s of [-1, 1]) {
      const rib = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.3), mat(g.b, { side: THREE.DoubleSide }));
      rib.position.set(s * 0.05, 0.02, -0.13);
      rib.rotation.x = 0.25;
      out.add(rib);
    }
  } else {
    // felt: a round fur hat with a pale rim
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), A);
    dome.position.y = 0.11;
    out.add(dome);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 8, 24), B);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.11;
    out.add(rim);
  }
  return out;
}

function cloak(g: Garment) {
  const out = new THREE.Group();
  const fur = g.shape === 'fur';
  // a curved sheet down the back, wider at the hem; the lining shows on the inside
  const geo = new THREE.CylinderGeometry(0.26, 0.4, 1.05, 18, 6, true, Math.PI * 0.62, Math.PI * 0.76);
  geo.translate(0, -0.48, 0);
  const outer = new THREE.Mesh(geo, mat(g.a, { side: THREE.FrontSide, roughness: fur ? 1 : 0.85 }));
  const inner = new THREE.Mesh(geo, mat(g.b, { side: THREE.BackSide }));
  const sheet = new THREE.Group();
  sheet.add(outer, inner);
  sheet.position.set(0, 0.12, -0.02);
  sheet.name = 'sheet';
  out.add(sheet);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.13, fur ? 0.06 : 0.025, 8, 20), mat(fur ? g.b : g.a, { roughness: 1 }));
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.16, 0);
  out.add(collar);
  return out;
}

function belt(g: Garment) {
  const out = new THREE.Group();
  const shape = g.shape;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.15, shape === 'cloth' || shape === 'gourd' ? 0.022 : 0.018, 6, 28), mat(shape === 'gourd' ? '#5a4632' : g.a, shape === 'gold' ? { metalness: 0.8, roughness: 0.3 } : {}));
  band.rotation.x = Math.PI / 2;
  band.scale.set(1.15, 0.85, 1);
  band.position.y = 0.05;
  out.add(band);
  if (shape === 'jade' || shape === 'gold') {
    const buckle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 16), mat(g.b, { metalness: shape === 'gold' ? 0.8 : 0.1, roughness: 0.3 }));
    buckle.rotation.x = Math.PI / 2;
    buckle.position.set(0, 0.05, 0.13);
    out.add(buckle);
  }
  if (shape === 'gourd') {
    const gm = mat(g.a, { roughness: 0.5 });
    const low = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), gm);
    low.position.set(0.17, -0.07, 0.02);
    const up = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), gm);
    up.position.set(0.17, 0.0, 0.02);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 4), mat('#c0392b'));
    cord.position.set(0.17, 0.05, 0.02);
    out.add(low, up, cord);
  }
  if (shape === 'cloth') {
    for (const s of [-1, 1]) {
      const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.2), mat(g.a, { side: THREE.DoubleSide }));
      tail.position.set(0.04 * s + 0.06, -0.06, 0.14);
      out.add(tail);
    }
  }
  return out;
}

const BONE: Record<Exclude<Slot, 'robe'>, RegExp> = { hat: /head$/i, cloak: /spine2$|spine1$/i, belt: /hips$/i };

/** put the worn pieces on a loaded body (removing what was there) */
export function dressBody(obj: THREE.Object3D, worn: Partial<Record<Slot, string>>) {
  const old: THREE.Object3D[] = [];
  obj.traverse((o) => o.userData.outfit && old.push(o));
  for (const o of old) o.parent?.remove(o);
  obj.updateMatrixWorld(true);
  const bones: THREE.Object3D[] = [];
  obj.traverse((o) => (o as any).isBone && bones.push(o));
  for (const slot of ['hat', 'cloak', 'belt'] as const) {
    const g = garment(worn[slot]);
    if (!g) continue;
    const bone = bones.find((b) => BONE[slot].test(b.name.replace(/^mixamorig:?/i, ''))) ?? bones.find((b) => BONE[slot].test(b.name));
    if (!bone) continue;
    const piece = slot === 'hat' ? hat(g) : slot === 'cloak' ? cloak(g) : belt(g);
    piece.userData.outfit = slot;
    // undo the bone's world scale (the model is scaled to its height when loaded) so the piece is in metres
    const s = new THREE.Vector3();
    bone.getWorldScale(s);
    piece.scale.set(1 / s.x, 1 / s.y, 1 / s.z);
    // and its world turn, so the piece stands upright facing the body's front at rest
    const q = new THREE.Quaternion();
    bone.getWorldQuaternion(q);
    const qo = new THREE.Quaternion();
    obj.getWorldQuaternion(qo);
    piece.quaternion.copy(q.invert().multiply(qo));
    piece.traverse((o: any) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.userData.weapon = true; // kept out of the character shader and its hit flash
      }
    });
    bone.add(piece);
  }
}

/** the cloak swings back as you run */
export function swayCloak(obj: THREE.Object3D, speed: number, t: number) {
  obj.traverse((o) => {
    if (o.name !== 'sheet') return;
    const k = Math.min(1, speed / 7);
    o.rotation.x = -(0.08 + k * 0.55) - Math.sin(t * 6) * 0.04 * (0.3 + k);
  });
}

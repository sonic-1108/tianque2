// Hand weapons from the old game (天阙 1): each hero's own, built from shapes (a few load a Tripo prop). Laid along +Y with the grip at the origin; base/tip markers drive the ribbon trail.
import * as THREE from 'three';
import { GLTFLoader, MeshoptDecoder } from 'three-stdlib';
const DAGGER_URL = `${import.meta.env.BASE_URL}models/dagger.glb`;
const EMPEROR_SWORD_URL = `${import.meta.env.BASE_URL}models/emperor_sword.glb`;
export function buildJian() {
  const g = new THREE.Group();
  const blade = new THREE.Shape();
  blade.moveTo(-0.019, 0);
  blade.lineTo(0.019, 0);
  blade.lineTo(0.016, 0.66);
  blade.lineTo(0, 0.74);
  blade.lineTo(-0.016, 0.66);
  blade.closePath();
  const geo = new THREE.ExtrudeGeometry(blade, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.005, bevelSegments: 2 });
  geo.translate(0, 0, -0.003);
  const steel = new THREE.MeshStandardMaterial({ color: '#b9bec4', metalness: 0.9, roughness: 0.32, envMapIntensity: 1.2 });
  const b = new THREE.Mesh(geo, steel);
  b.position.y = 0.11;
  b.castShadow = true;
  const iron = new THREE.MeshStandardMaterial({ color: '#4a4741', metalness: 0.7, roughness: 0.5 });
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.022, 0.03), iron);
  guard.position.y = 0.1;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.017, 0.16, 10), new THREE.MeshStandardMaterial({ color: '#d8ccb0', roughness: 0.95 }));
  grip.position.y = 0.01;
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.021, 10, 8), iron);
  pommel.position.y = -0.08;
  // a short hemp tassel off the pommel
  const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.012, 0.09, 6), new THREE.MeshStandardMaterial({ color: '#cbb994', roughness: 1 }));
  tassel.position.y = -0.135;
  g.add(b, guard, grip, pommel, tassel);
  return g;
}

/** 交易员's weapon: a silver attaché case stuffed with cash, the handle in the fist, the case along the swing */
export function buildBriefcase() {
  const g = new THREE.Group();
  const alu = new THREE.MeshStandardMaterial({ color: '#c8ccd2', metalness: 0.9, roughness: 0.3, envMapIntensity: 1.3 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1b1c1f', metalness: 0.3, roughness: 0.6 });
  const cash = new THREE.MeshStandardMaterial({ color: '#7fae6a', roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.11), alu);
  body.position.set(0, 0.26, 0);
  body.castShadow = true;
  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.35, 0.012), dark);
  rim.position.set(0, 0.26, 0);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 14, Math.PI), dark);
  handle.rotation.set(0, 0, Math.PI);
  handle.position.set(0, 0.09, 0);
  // a few bills poking out of the seam
  for (const x of [-0.12, 0.04, 0.15]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.004), cash);
    b.position.set(x, 0.44, 0.012);
    b.rotation.z = x * 2;
    g.add(b);
  }
  for (const x of [-0.15, 0.15]) {
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.02), dark);
    latch.position.set(x, 0.12, 0.06);
    g.add(latch);
  }
  g.add(body, rim, handle);
  // the weapon group is turned a quarter round the hand; undo that so the case hangs off the fist along the fingers
  // (down at the side when the arm hangs, out in front on a swing) instead of across the shoulder
  g.rotation.z = -Math.PI / 2;
  g.position.set(0.005, 0, -0.025);
  g.scale.setScalar(0.85);
  return g;
}

/** 地仙's 鹤头杖: gnarled dark wood, a silver crane head on top, a little celadon gourd on a green cord. Laid along +Y
 *  like a blade (so the swings carry it), gripped a third of the way up */
export function buildCraneStaff() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#3b2a1e', roughness: 0.85 });
  const silver = new THREE.MeshStandardMaterial({ color: '#c9ccc8', metalness: 0.85, roughness: 0.35 });
  const jade = new THREE.MeshStandardMaterial({ color: '#8fbfa4', metalness: 0.05, roughness: 0.3, emissive: new THREE.Color('#0f2a1c') });
  const cord = new THREE.MeshStandardMaterial({ color: '#2f5a43', roughness: 0.9 });
  // the shaft, a little crooked: three pieces leaning off true
  const pts = [new THREE.Vector3(0, -0.55, 0), new THREE.Vector3(0.015, 0.0, 0.01), new THREE.Vector3(-0.012, 0.55, -0.008), new THREE.Vector3(0.01, 1.05, 0.005)];
  const shaft = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.019, 7, false), wood);
  shaft.castShadow = true;
  g.add(shaft);
  for (const y of [-0.2, 0.35, 0.8]) {
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.027, 8, 6), wood);
    knot.position.set(0, y, 0);
    knot.scale.set(1, 0.6, 1);
    g.add(knot);
  }
  // crane head: neck curving forward, the head, a long beak
  const neck = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.01, 1.03, 0), new THREE.Vector3(0.0, 1.13, 0.0), new THREE.Vector3(0.03, 1.2, 0.0), new THREE.Vector3(0.08, 1.21, 0)]), 12, 0.013, 6, false), silver);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), silver);
  head.position.set(0.085, 1.215, 0);
  head.scale.set(1.2, 0.9, 0.85);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.09, 6), silver);
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.15, 1.21, 0);
  const crest = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), new THREE.MeshStandardMaterial({ color: '#b3121b', roughness: 0.5 }));
  crest.position.set(0.085, 1.24, 0);
  g.add(neck, head, beak, crest);
  // the gourd hanging under the head
  const cordM = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.12, 4), cord);
  cordM.position.set(0.02, 0.98, 0.03);
  const g1 = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), jade);
  g1.position.set(0.02, 0.89, 0.03);
  const g2 = new THREE.Mesh(new THREE.SphereGeometry(0.021, 10, 8), jade);
  g2.position.set(0.02, 0.935, 0.03);
  g.add(cordM, g1, g2);
  g.position.set(0, -0.05, 0);
  return g;
}

export function buildCleaver(glow: THREE.Color) {
  const group = new THREE.Group();

  const blade = new THREE.Shape();
  blade.moveTo(-0.028, 0.0);
  blade.lineTo(0.03, 0.0);
  blade.bezierCurveTo(0.075, 0.25, 0.085, 0.5, 0.05, 0.74);
  blade.lineTo(0.0, 0.8);
  blade.bezierCurveTo(-0.03, 0.62, -0.035, 0.3, -0.028, 0.0);
  const bladeGeo = new THREE.ExtrudeGeometry(blade, {
    depth: 0.012,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.008,
    bevelSegments: 3,
    curveSegments: 24,
  });
  bladeGeo.translate(0, 0, -0.006);
  const steel = new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 0.95, roughness: 0.22, envMapIntensity: 1.4 });
  const bladeMesh = new THREE.Mesh(bladeGeo, steel);
  bladeMesh.position.y = 0.11;
  bladeMesh.castShadow = true;

  // fuller groove glow (subtle, pulses with blood rage)
  const fullerGeo = new THREE.PlaneGeometry(0.012, 0.5);
  const fullerMat = new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const fuller = new THREE.Mesh(fullerGeo, fullerMat);
  fuller.position.set(0.012, 0.42, 0.013);
  fuller.name = 'fuller';

  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.025, 0.045),
    new THREE.MeshStandardMaterial({ color: '#3b2a1c', metalness: 0.6, roughness: 0.45 })
  );
  guard.position.y = 0.1;
  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.019, 0.17, 12),
    new THREE.MeshStandardMaterial({ color: '#2a1a12', metalness: 0.1, roughness: 0.85 })
  );
  grip.position.y = 0.01;
  const pommel = new THREE.Mesh(
    new THREE.SphereGeometry(0.024, 12, 10),
    new THREE.MeshStandardMaterial({ color: '#8a6a3a', metalness: 0.8, roughness: 0.35 })
  );
  pommel.position.y = -0.085;

  const base = new THREE.Object3D();
  base.position.y = 0.16;
  base.name = 'bladeBase';
  const tip = new THREE.Object3D();
  tip.position.y = 0.88;
  tip.name = 'bladeTip';

  group.add(bladeMesh, fuller, guard, grip, pommel, base, tip);
  return { group, base, tip, fullerMat, steel };
}

// Short throwing knife held by 暗器 (blade along +Y)
export function buildKnife(glow: THREE.Color) {
  const group = new THREE.Group();
  const blade = new THREE.Shape();
  blade.moveTo(-0.018, 0);
  blade.lineTo(0.018, 0);
  blade.lineTo(0.012, 0.2);
  blade.lineTo(0, 0.26);
  blade.lineTo(-0.012, 0.2);
  blade.closePath();
  const geo = new THREE.ExtrudeGeometry(blade, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.004, bevelSegments: 2 });
  geo.translate(0, 0, -0.003);
  const steel = new THREE.MeshStandardMaterial({ color: '#e3e9ef', metalness: 0.95, roughness: 0.2 });
  const b = new THREE.Mesh(geo, steel);
  b.position.y = 0.06;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 8), new THREE.MeshStandardMaterial({ color: '#1f4d48', roughness: 0.7 }));
  grip.position.y = 0.01;
  const tassel = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ color: glow }));
  tassel.position.y = -0.045;
  const base = new THREE.Object3D();
  base.position.y = 0.08;
  const tip = new THREE.Object3D();
  tip.position.y = 0.33;
  group.add(b, grip, tassel, base, tip);
  const fullerMat = new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0 });
  return { group, base, tip, fullerMat, steel };
}

// 影刃's dagger: the Tripo prop, shared geometry, loaded once (blade along +Y, grip at the origin)
let daggerProto: Promise<THREE.Object3D> | null = null;
function daggerModel() {
  if (!daggerProto)
    daggerProto = new Promise((resolve, reject) =>
      newLoader().load(
        DAGGER_URL,
        (g) => {
          g.scene.traverse((o: any) => {
            if (o.isMesh) o.castShadow = true;
          });
          const box = new THREE.Box3().setFromObject(g.scene);
          const len = Math.max(0.01, box.max.y - box.min.y);
          g.scene.scale.setScalar(0.32 / len); // about 32 cm from pommel to point
          resolve(g.scene);
        },
        undefined,
        reject
      )
    );
  return daggerProto;
}
let swordProto: Promise<THREE.Object3D> | null = null;
function swordModel() {
  if (!swordProto)
    swordProto = new Promise((resolve, reject) =>
      newLoader().load(
        EMPEROR_SWORD_URL,
        (g) => {
          g.scene.traverse((o: any) => {
            if (o.isMesh) {
              o.castShadow = true;
              // a little self-light so the gilt and the blade catch the eye at night
              const m = (o.material as THREE.MeshStandardMaterial).clone();
              m.emissive = new THREE.Color('#ffffff');
              m.emissiveMap = m.map;
              m.emissiveIntensity = 0.18;
              o.material = m;
            }
          });
          const box = new THREE.Box3().setFromObject(g.scene);
          g.scene.scale.setScalar(1.05 / Math.max(0.01, box.max.y - box.min.y)); // about 1 m from pommel to point
          resolve(g.scene);
        },
        undefined,
        reject
      )
    );
  return swordProto;
}
export function buildImperialSword(glow: THREE.Color) {
  const group = new THREE.Group();
  swordModel()
    .then((proto) => group.add(proto.clone()))
    .catch(() => group.add(buildCleaver(glow).group)); // missing file: a cleaver stands in
  const base = new THREE.Object3D();
  base.position.y = 0.2;
  const tip = new THREE.Object3D();
  tip.position.y = 0.88;
  group.add(base, tip);
  const fullerMat = new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0 });
  const steel = new THREE.MeshStandardMaterial({ color: '#c8d3de', metalness: 0.9, roughness: 0.25 });
  return { group, base, tip, fullerMat, steel };
}

export function buildDagger(glow: THREE.Color) {
  const group = new THREE.Group();
  daggerModel()
    .then((proto) => group.add(proto.clone()))
    .catch(() => group.add(buildKnife(glow).group)); // missing file: a plain knife stands in
  const base = new THREE.Object3D();
  base.position.y = 0.08;
  const tip = new THREE.Object3D();
  tip.position.y = 0.27;
  group.add(base, tip);
  const fullerMat = new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0 });
  const steel = new THREE.MeshStandardMaterial({ color: '#c8d3de', metalness: 0.9, roughness: 0.25 });
  return { group, base, tip, fullerMat, steel };
}

function newLoader() {
  const l = new GLTFLoader();
  l.setMeshoptDecoder(typeof MeshoptDecoder === 'function' ? (MeshoptDecoder as any)() : MeshoptDecoder);
  return l;
}

/** which weapon(s) a body holds, by model file */
export function weaponsFor(model: string, glow: THREE.Color): { right: THREE.Object3D | null; left: THREE.Object3D | null; reverse: boolean; staff: THREE.Object3D | null; base: THREE.Object3D | null; tip: THREE.Object3D | null } {
  const none = { right: null, left: null, reverse: false, staff: null, base: null, tip: null };
  const pair = (mk: () => { group: THREE.Object3D; base: THREE.Object3D; tip: THREE.Object3D }, reverse = false) => {
    const r = mk();
    return { right: r.group, left: mk().group, reverse, staff: null, base: r.base, tip: r.tip };
  };
  switch (model) {
    case 'berserker.glb':
      return pair(() => buildCleaver(glow));
    case 'ranger.glb':
      return pair(() => buildKnife(glow));
    case 'shadowblade.glb':
      return pair(() => buildDagger(glow), true);
    case 'emperor.glb': {
      const r = buildImperialSword(glow);
      return { ...none, right: r.group, base: r.base, tip: r.tip };
    }
    case 'trader.glb':
      return { ...none, right: buildBriefcase() };
    case 'dixian.glb':
      return { ...none, staff: buildCraneStaff() };
    case 'wanderer_m.glb': {
      const g = buildJian();
      const base = new THREE.Object3D();
      base.position.y = 0.1;
      const tip = new THREE.Object3D();
      tip.position.y = 0.72;
      g.add(base, tip);
      return { ...none, right: g, base, tip };
    }
    default:
      return none;
  }
}

// A 秘境 (game/realms.ts): its Gaussian splats, made by World Labs Atlas, drawn by Spark (World Labs' own splat
// renderer for three.js). One SparkRenderer for the canvas; each place's SplatMesh loads the first time you go in
// (a line at the top shows how much has come) and is kept for the next visit. The bodies in there get the place's
// own soft light, a shadow on its floor (an invisible catcher that follows you), and the way out is a ring of pale
// light on the floor.
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import type { Sim } from '../game/sim';
import type { Room } from '../game/interiors';
import { realmById, realmFloor, realmFloorLocal, type Realm } from '../game/realms';
import { sigilOf } from './vfx/sigils';

let spark: SparkRenderer | null = null;
const meshes = new Map<string, SplatMesh>();
const loaded = new Set<string>();

/** the loading line: a thin bar and the place's name over the top of the screen */
function bar(name: string) {
  const el = document.createElement('div');
  el.className = 'realm-load';
  el.innerHTML = `<b>${name}</b><span>冰雪凝形中</span><i><u></u></i>`;
  document.body.appendChild(el);
  const fill = el.querySelector('u') as HTMLElement, txt = el.querySelector('span') as HTMLElement;
  return {
    set(f: number, mb: number) {
      fill.style.width = `${Math.round(Math.min(1, f) * 100)}%`;
      txt.textContent = f > 0 && f <= 1 ? `冰雪凝形中 ${Math.round(f * 100)}%` : `冰雪凝形中 ${mb.toFixed(0)} MB`;
    },
    done() {
      el.classList.add('done');
      setTimeout(() => el.remove(), 700);
    },
  };
}

function meshFor(R: Realm) {
  // one mesh per file (the seven inns share theirs), set where this room wants it each time it's shown
  let m = meshes.get(R.url);
  if (!m) {
    const b = bar(R.name);
    const url = R.url;
    m = new SplatMesh({
      url: import.meta.env.BASE_URL + url,
      onProgress: (e: ProgressEvent) => b.set(e.total ? e.loaded / e.total : 0, e.loaded / 1048576),
      onLoad: () => {
        loaded.add(url);
        b.done();
      },
    });
    m.initialized.catch(() => b.done());
    meshes.set(url, m);
  }
  // the capture point to (ox, 0, oz): the file's floor there is `eye` under its origin; a file stored y down turns
  // over, then the grid's levelling turn makes its floor flat (floor.py worked out both)
  m.position.set(R.ox, R.grid.eye * R.scale, R.oz);
  const q = new THREE.Quaternion();
  if (R.grid.level) q.fromArray(R.grid.level);
  if (R.grid.flip) q.multiply(new THREE.Quaternion(1, 0, 0, 0));
  m.quaternion.copy(q);
  m.scale.setScalar(R.scale);
  m.updateMatrixWorld(true);
  return m;
}

function exitRing() {
  const g = new THREE.Group();
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(1.3, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: sigilOf('bagua'), color: '#bfe6ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0.8 }),
  );
  face.position.y = 0.04;
  g.add(face);
  const col = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.2, 3.2, 28, 1, true).translate(0, 1.6, 0),
    new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 } },
      vertexShader: 'varying float vY; varying vec2 vUv; void main(){ vY = position.y / 3.2; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uT; varying float vY; varying vec2 vUv;
        void main(){ float s = 0.6 + 0.4 * sin(vUv.x * 30.0 + uT * 2.0) * sin(vY * 8.0 - uT * 2.5);
          gl_FragColor = vec4(vec3(0.75, 0.9, 1.0) * 1.3, pow(1.0 - vY, 2.4) * 0.38 * s); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  g.add(col);
  return { g, face, col };
}

export function RealmScene({ room, sim }: { room: Room; sim: Sim }) {
  const R = realmById(room.realm)!;
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const ring = useMemo(exitRing, []);
  const catcher = useMemo(() => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(4, 32).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.42, depthWrite: false }));
    m.receiveShadow = true;
    m.renderOrder = 2;
    return m;
  }, []);
  useEffect(() => {
    if (!spark) spark = new SparkRenderer({ renderer: gl });
    const m = meshFor(R);
    scene.add(spark);
    scene.add(m);
    return () => {
      scene.remove(m);
      if (spark) scene.remove(spark);
    };
  }, [R, gl, scene]);
  const ex = R.exit, ey = realmFloorLocal(R, ex[0], ex[1]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    (ring.col.material as THREE.ShaderMaterial).uniforms.uT.value = t;
    ring.face.rotation.y = t * 0.2;
    (ring.face.material as THREE.MeshBasicMaterial).opacity = 0.65 + Math.sin(t * 1.7) * 0.15;
    const p = sim.player.pos;
    catcher.position.set(p[0], realmFloor(R, p[0], p[2]) + 0.03, p[2]);
  });
  const L = R.light;
  return (
    <group>
      <hemisphereLight args={[L.sky, L.ground, 0.75]} />
      <pointLight position={[R.ox + L.keyAt[0], L.keyAt[1], R.oz + L.keyAt[2]]} color={L.key} intensity={L.keyI * 60} distance={40} decay={1.2} />
      <primitive object={catcher} />
      <group position={[R.ox + ex[0], ey, R.oz + ex[1]]}>
        <primitive object={ring.g} />
      </group>
    </group>
  );
}

/** for tests: has this realm's splat finished loading */
(globalThis as any).__T2_REALM_LOADED = (id: string) => loaded.has(realmById(id)?.url ?? `splats/${id}.spz`);

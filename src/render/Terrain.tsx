// The 2 km landscape: the ground in 125 m chunks whose detail drops with distance (rebuilt a few per frame as you
// move), coloured by height and slope with fine noise in the shader; lakes; forests of instanced trees; the sky.
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky } from 'three-stdlib';
import { SNOW_Y, TREES, VILLAGE_R, WATER_Y, WORLD_R, groundHeight, pathDist, slopeAt } from '../game/world';
import { DENS, DEN_R } from '../game/foes';
import type { Sim } from '../game/sim';

const CH = 125;
const NCH = Math.ceil((WORLD_R * 2 + 200) / CH);
const ORIGIN = -NCH * CH * 0.5;
const LODS = [40, 20, 10, 5]; // segments per chunk side
const lodFor = (d: number) => (d < 220 ? 0 : d < 480 ? 1 : d < 900 ? 2 : 3);

const C = {
  grass: new THREE.Color('#5f7f38'),
  grass2: new THREE.Color('#86924a'),
  dry: new THREE.Color('#9a8f5a'),
  dirt: new THREE.Color('#8a6f4c'),
  road: new THREE.Color('#a88d63'),
  rock: new THREE.Color('#6f6a62'),
  rock2: new THREE.Color('#8b857b'),
  snow: new THREE.Color('#eef2f6'),
  sand: new THREE.Color('#b8a679'),
  mud: new THREE.Color('#4b4a36'),
};
const tmp = new THREE.Color();
function colorAt(x: number, z: number, h: number, sl: number, out: THREE.Color) {
  const n = Math.sin(x * 0.07 + Math.cos(z * 0.05) * 2) * 0.5 + 0.5;
  out.copy(C.grass).lerp(C.grass2, n * 0.7);
  if (h > 35) out.lerp(C.dry, Math.min(1, (h - 35) / 40));
  // steep = bare rock
  const rk = Math.min(1, Math.max(0, (sl - 0.55) / 0.45));
  tmp.copy(C.rock).lerp(C.rock2, n);
  out.lerp(tmp, rk);
  // snow on the heights (less on cliffs)
  const sn = Math.min(1, Math.max(0, (h - SNOW_Y) / 25)) * (1 - rk * 0.7);
  out.lerp(C.snow, sn);
  // shores and lake beds
  if (h < WATER_Y + 1.5) out.lerp(C.sand, Math.min(1, (WATER_Y + 1.5 - h) / 1.5));
  if (h < WATER_Y - 0.5) out.lerp(C.mud, 0.6);
  // roads, the village square, den grounds
  const pd = pathDist(x, z);
  if (pd < 5) out.lerp(C.road, Math.min(1, (5 - pd) / 2.5) * 0.9);
  if (Math.hypot(x, z) < VILLAGE_R) out.lerp(C.road, 0.55);
  for (const d of DENS) if (Math.abs(d.x - x) < DEN_R && Math.abs(d.z - z) < DEN_R && Math.hypot(d.x - x, d.z - z) < DEN_R) out.lerp(C.dirt, 0.5);
  return out;
}

function buildChunk(ci: number, cj: number, segs: number) {
  const x0 = ORIGIN + ci * CH;
  const z0 = ORIGIN + cj * CH;
  const n = segs + 1;
  const step = CH / segs;
  const verts = n * n + segs * 4 * 2; // grid + skirt
  const pos = new Float32Array(verts * 3);
  const nor = new Float32Array(verts * 3);
  const col = new Float32Array(verts * 3);
  const idx: number[] = [];
  const c = new THREE.Color();
  const e = 1.5;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const x = x0 + i * step;
      const z = z0 + j * step;
      const h = groundHeight(x, z);
      const k = i * n + j;
      pos.set([x, h, z], k * 3);
      const hx = groundHeight(x + e, z) - groundHeight(x - e, z);
      const hz = groundHeight(x, z + e) - groundHeight(x, z - e);
      const nx = -hx, ny = 2 * e, nz = -hz;
      const l = Math.hypot(nx, ny, nz);
      nor.set([nx / l, ny / l, nz / l], k * 3);
      colorAt(x, z, h, Math.hypot(hx, hz) / (2 * e), c);
      col.set([c.r, c.g, c.b], k * 3);
    }
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < segs; j++) {
      const a = i * n + j, b = (i + 1) * n + j, cc = i * n + j + 1, d = (i + 1) * n + j + 1;
      idx.push(a, cc, b, b, cc, d);
    }
  // skirts: a strip hanging 10 m down round the edge hides cracks between chunks of different detail
  let v = n * n;
  const edge = (list: number[]) => {
    for (let k = 0; k < list.length - 1; k++) {
      const a = list[k], b = list[k + 1];
      const a2 = v++, b2 = v++;
      pos.set([pos[a * 3], pos[a * 3 + 1] - 10, pos[a * 3 + 2]], a2 * 3);
      pos.set([pos[b * 3], pos[b * 3 + 1] - 10, pos[b * 3 + 2]], b2 * 3);
      nor.set([nor[a * 3], nor[a * 3 + 1], nor[a * 3 + 2]], a2 * 3);
      nor.set([nor[b * 3], nor[b * 3 + 1], nor[b * 3 + 2]], b2 * 3);
      col.set([col[a * 3], col[a * 3 + 1], col[a * 3 + 2]], a2 * 3);
      col.set([col[b * 3], col[b * 3 + 1], col[b * 3 + 2]], b2 * 3);
      idx.push(a, b, a2, b, b2, a2, a, a2, b, b, a2, b2);
    }
  };
  const row = (i: number) => Array.from({ length: n }, (_, j) => i * n + j);
  const colm = (j: number) => Array.from({ length: n }, (_, i) => i * n + j);
  edge(row(0));
  edge(row(segs));
  edge(colm(0));
  edge(colm(segs));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** the ground material: vertex colours, broken up by two scales of noise so it never reads as flat paint */
function groundMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWP;
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float d1 = vn(vWP.xz*0.9), d2 = vn(vWP.xz*0.17), d3 = vn(vWP.xz*3.1);
diffuseColor.rgb *= 0.78 + 0.22*d1 + 0.18*(d2-0.5) + 0.1*(d3-0.5);`,
      );
  };
  return m;
}

function Ground({ sim }: { sim: Sim }) {
  const group = useRef<THREE.Group>(null);
  const state = useMemo(() => {
    const mat = groundMaterial();
    const chunks: { mesh: THREE.Mesh; lod: number; ci: number; cj: number }[] = [];
    for (let i = 0; i < NCH; i++)
      for (let j = 0; j < NCH; j++) {
        const cx = ORIGIN + (i + 0.5) * CH, cz = ORIGIN + (j + 0.5) * CH;
        if (Math.hypot(cx, cz) > WORLD_R + 250) continue;
        const lod = lodFor(Math.hypot(cx - sim.player.pos[0], cz - sim.player.pos[2]));
        const mesh = new THREE.Mesh(buildChunk(i, j, LODS[lod]), mat);
        mesh.receiveShadow = true;
        mesh.castShadow = lod <= 1;
        chunks.push({ mesh, lod, ci: i, cj: j });
      }
    return { chunks, mat };
  }, [sim]);
  useEffect(() => {
    const g = group.current!;
    for (const c of state.chunks) g.add(c.mesh);
    return () => {
      for (const c of state.chunks) {
        g.remove(c.mesh);
        c.mesh.geometry.dispose();
      }
    };
  }, [state]);
  useFrame(() => {
    // re-detail the chunks whose distance band changed, a few per frame
    const p = sim.player.pos;
    let budget = 3;
    for (const c of state.chunks) {
      const cx = ORIGIN + (c.ci + 0.5) * CH, cz = ORIGIN + (c.cj + 0.5) * CH;
      const want = lodFor(Math.hypot(cx - p[0], cz - p[2]));
      if (want === c.lod) continue;
      c.mesh.geometry.dispose();
      c.mesh.geometry = buildChunk(c.ci, c.cj, LODS[want]);
      c.mesh.castShadow = want <= 1;
      c.lod = want;
      if (--budget <= 0) break;
    }
  });
  return <group ref={group} />;
}

function Water() {
  return (
    <mesh position={[0, WATER_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <circleGeometry args={[WORLD_R + 100, 96]} />
      <meshStandardMaterial color="#3d6f8a" transparent opacity={0.78} roughness={0.08} metalness={0.2} depthWrite={false} />
    </mesh>
  );
}

function Trees() {
  const meshes = useMemo(() => {
    const bark = new THREE.MeshStandardMaterial({ color: '#4a3424', roughness: 1 });
    const needles = new THREE.MeshStandardMaterial({ color: '#2c4f2a', roughness: 0.9, flatShading: true });
    const leaves = new THREE.MeshStandardMaterial({ color: '#4d7330', roughness: 0.9, flatShading: true });
    const dead = new THREE.MeshStandardMaterial({ color: '#6b5b4b', roughness: 1 });
    // a pine: trunk + three stacked tiers
    const pineParts = [new THREE.CylinderGeometry(0.22, 0.4, 4, 6).translate(0, 2, 0)];
    const tiers = [new THREE.ConeGeometry(2.4, 3.4, 8).translate(0, 4.2, 0), new THREE.ConeGeometry(1.9, 3, 8).translate(0, 5.9, 0), new THREE.ConeGeometry(1.3, 2.6, 8).translate(0, 7.5, 0)];
    const leafy = [new THREE.IcosahedronGeometry(2.3, 1).scale(1, 0.85, 1).translate(0, 5, 0), new THREE.IcosahedronGeometry(1.6, 1).translate(1.1, 6.2, 0.4)];
    const deadParts = [new THREE.CylinderGeometry(0.15, 0.32, 5, 5).translate(0, 2.5, 0), new THREE.CylinderGeometry(0.06, 0.12, 2.2, 4).rotateZ(0.9).translate(0.8, 3.6, 0), new THREE.CylinderGeometry(0.05, 0.1, 1.8, 4).rotateZ(-1).translate(-0.6, 4.2, 0.2)];
    const merge = (list: THREE.BufferGeometry[]) => {
      // tiny merge (no addon): concatenate non-indexed copies
      const parts = list.map((g) => g.toNonIndexed());
      const n = parts.reduce((a, g) => a + g.getAttribute('position').count, 0);
      const pos = new Float32Array(n * 3);
      const nor = new Float32Array(n * 3);
      let o = 0;
      for (const g of parts) {
        pos.set(g.getAttribute('position').array as Float32Array, o * 3);
        nor.set(g.getAttribute('normal').array as Float32Array, o * 3);
        o += g.getAttribute('position').count;
      }
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      return out;
    };
    const kinds = [0, 1, 2].map((k) => TREES.filter((t) => t.kind === k));
    const make = (geo: THREE.BufferGeometry, mat: THREE.Material, list: typeof TREES, sy = 1) => {
      const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3();
      const p = new THREE.Vector3();
      list.forEach((t, i) => {
        p.set(t.x, groundHeight(t.x, t.z) - 0.3, t.z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (t.x * 13.1 + t.z * 7.7) % 6.28);
        s.set(t.s, t.s * sy, t.s);
        m.compose(p, q, s);
        im.setMatrixAt(i, m);
      });
      im.count = list.length;
      im.castShadow = true;
      im.receiveShadow = true;
      im.frustumCulled = false;
      return im;
    };
    return [
      make(pineParts[0], bark, kinds[0]),
      make(merge(tiers), needles, kinds[0]),
      make(pineParts[0], bark, kinds[1], 1.1),
      make(merge(leafy), leaves, kinds[1]),
      make(merge(deadParts), dead, kinds[2]),
    ];
  }, []);
  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  );
}

function SkyDome() {
  const sky = useMemo(() => {
    const s = new Sky();
    s.scale.setScalar(20000);
    const u = s.material.uniforms;
    u.turbidity.value = 6;
    u.rayleigh.value = 1.4;
    u.mieCoefficient.value = 0.006;
    u.mieDirectionalG.value = 0.85;
    const sun = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(62), THREE.MathUtils.degToRad(210));
    u.sunPosition.value.copy(sun);
    return s;
  }, []);
  return <primitive object={sky} />;
}

/** the landscape (ground, lakes, trees, sky) */
export function Landscape({ sim }: { sim: Sim }) {
  const cam = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useEffect(() => {
    cam.far = 4000;
    cam.updateProjectionMatrix();
  }, [cam]);
  void slopeAt;
  return (
    <>
      <SkyDome />
      <Ground sim={sim} />
      <Water />
      <Trees />
    </>
  );
}

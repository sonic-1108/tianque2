// The 2 km landscape: the ground in 125 m chunks whose detail drops with distance (rebuilt a few per frame as you
// move), coloured by height and slope with fine noise in the shader; lakes; forests of instanced trees; the sky.
import { CT_PAD, nearCourt } from '../game/court';
import { SEASON_U, withSnow } from './season';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky, mergeVertices } from 'three-stdlib';
import { ICE, SNOW_Y, TREES, VILLAGE_R, WATER_Y, WORLD_R, groundHeight, noise, pathDist, slopeAt } from '../game/world';
import { DENS, DEN_R } from '../game/foes';
import { nearTq, onGudao } from '../game/layout';
import { PLACES, nearPlace } from '../game/places';
import type { Sim } from '../game/sim';

const CH = 125;
const NCH = Math.ceil((WORLD_R * 2 + 200) / CH);
const ORIGIN = -NCH * CH * 0.5;
const LODS = [40, 20, 10, 5]; // segments per chunk side
const lodFor = (d: number) => (d < 220 ? 0 : d < 480 ? 1 : d < 900 ? 2 : 3);

/** what the ground is made of here, for the shader: r = road / trampled path, g = bare dirt (village square,
 *  den grounds), b = wet shore. Everything else (grass, rock, snow) the shader works out from height, slope and noise. */
function maskAt(x: number, z: number, h: number, out: THREE.Color) {
  const pd = pathDist(x, z);
  const road = Math.min(1, Math.max(0, (4.5 - pd) / 2.5));
  let bare = 0;
  const rv = Math.hypot(x, z);
  if (rv < VILLAGE_R + 10) bare = Math.min(1, (VILLAGE_R + 10 - rv) / 10) * 0.85;
  for (const d of DENS) {
    if (Math.abs(d.x - x) > DEN_R + 8 || Math.abs(d.z - z) > DEN_R + 8) continue;
    const dd = Math.hypot(d.x - x, d.z - z);
    if (dd < DEN_R + 8) bare = Math.max(bare, Math.min(1, (DEN_R + 8 - dd) / 8));
  }
  for (const p of PLACES) {
    if (Math.abs(p.x - x) > p.pad + 6 || Math.abs(p.z - z) > p.pad + 6) continue;
    const dd = Math.hypot(p.x - x, p.z - z);
    if (dd < p.pad + 6) bare = Math.max(bare, Math.min(1, (p.pad + 6 - dd) / 8) * 0.8);
  }
  const shore = h < WATER_Y + 1.4 ? Math.min(1, (WATER_Y + 1.4 - h) / 1.2) : 0;
  out.setRGB(road, bare, shore);
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
      maskAt(x, z, h, c);
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

/** the ground: grass, dry grass, earth, rock and snow worked out per pixel from height, slope and several scales of
 *  noise (no painted map stretched over it: that read as a blotchy digital camouflage), roads and den grounds from
 *  the vertex masks. Fine detail fades with distance so far hills don't shimmer. */
function groundMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSnow = { value: SNOW_Y };
    sh.uniforms.uSeason = SEASON_U.uSeason;
    sh.uniforms.uSnowCover = SEASON_U.uSnowCover;
    sh.uniforms.uWet = SEASON_U.uWet;
    sh.uniforms.uWater = { value: WATER_Y };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uSnow;
uniform float uWater;
uniform vec4 uSeason;
uniform float uSnowCover;
uniform float uWet;
varying vec3 vWP;
varying vec3 vWN;
float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float a=0.5, s=0.0; mat2 r=mat2(0.8,0.6,-0.6,0.8); for(int k=0;k<5;k++){ s+=a*vn(p); p=r*p*2.03+17.1; a*=0.5; } return s; }`,
      )
      .replace(
        '#include <color_fragment>',
        `float dist = length(vWP - cameraPosition);
float fine = 1.0 - smoothstep(40.0, 160.0, dist);   // the close detail fades out with distance
float macro = fbm(vWP.xz * 0.0045);                  // big patches across the land
float mid = fbm(vWP.xz * 0.045);
float small = vn(vWP.xz * 0.6);
float tiny = vn(vWP.xz * 3.7);
float slope = 1.0 - clamp(vWN.y, 0.0, 1.0);
// grass: two greens and a dry straw, mottled
vec3 g1 = vec3(0.150, 0.250, 0.075);
vec3 g2 = vec3(0.260, 0.350, 0.110);
vec3 dry = vec3(0.450, 0.410, 0.210);
vec3 grass = mix(g1, g2, smoothstep(0.3, 0.7, mid));
grass = mix(grass, dry, smoothstep(0.52, 0.78, macro) * 0.75 + smoothstep(40.0, 85.0, vWP.y) * 0.35);
grass *= 0.86 + 0.24 * mix(0.5, small, fine) + 0.1 * (tiny - 0.5) * fine;
// little flowers and clover in the grass up close
float spot = step(0.93, vn(vWP.xz * 1.9)) * fine * (1.0 - smoothstep(0.25, 0.4, slope));
grass = mix(grass, mix(vec3(0.85, 0.82, 0.55), vec3(0.75, 0.55, 0.75), step(0.5, h21(floor(vWP.xz * 1.9)))), spot * 0.35 * (1.0 + uSeason.x * 1.4) * (1.0 - uSeason.w));
// the seasons: fresh in spring, deep in summer, gold and russet in autumn, dun and bare in winter
vec3 gSpring = grass * vec3(1.02, 1.12, 0.86);
vec3 gSummer = grass * vec3(0.88, 1.0, 0.82);
vec3 gAutumn = mix(grass, mix(vec3(0.58, 0.44, 0.15), vec3(0.62, 0.30, 0.12), smoothstep(0.35, 0.75, mid)) * (0.8 + 0.4 * small), 0.72);
vec3 gWinter = mix(grass, vec3(0.40, 0.37, 0.27) * (0.85 + 0.3 * small), 0.78);
grass = gSpring * uSeason.x + gSummer * uSeason.y + gAutumn * uSeason.z + gWinter * uSeason.w;
// earth
vec3 earth = mix(vec3(0.360, 0.290, 0.200), vec3(0.480, 0.400, 0.290), mid);
earth *= 0.85 + 0.25 * mix(0.5, small, fine) + 0.12 * (tiny - 0.5) * fine;
// rock: grey with darker bands along the strata and lichen patches
// on a steep face the ground's xz noise stretches into streaks: there it's read across the face instead
vec2 tng = normalize(vec2(-vWN.z, vWN.x) + vec2(1e-4, 0.0));
vec2 face = mix(vWP.xz, vec2(dot(vWP.xz, tng), vWP.y), smoothstep(0.35, 0.7, slope));
float rmid = fbm(face * 0.045);
float rsmall = vn(face * 0.6);
float rtiny = vn(face * 3.7);
float strata = sin(vWP.y * 1.3 + rmid * 6.0 + face.x * 0.05) * 0.5 + 0.5;
vec3 rock = mix(vec3(0.330, 0.320, 0.300), vec3(0.520, 0.500, 0.470), rmid);
rock *= 0.78 + 0.22 * strata + 0.15 * (rsmall - 0.5) + 0.1 * (rtiny - 0.5) * fine;
rock = mix(rock, vec3(0.40, 0.42, 0.28), smoothstep(0.62, 0.8, fbm(face * 0.3)) * 0.35 * (1.0 - smoothstep(0.5, 0.8, slope)));
// snow, bluish where it faces away from the sun
vec3 snow = mix(vec3(0.80, 0.85, 0.92), vec3(0.96, 0.97, 0.99), smoothstep(-0.2, 0.6, vWN.x * 0.6 + vWN.y * 0.4));
// sand at the water
vec3 sand = mix(vec3(0.56, 0.50, 0.37), vec3(0.66, 0.60, 0.45), small);
// put it together: grass, then earth showing through, then rock on the steep, snow up high
vec3 col = grass;
float bareN = smoothstep(0.62, 0.8, mid + (small - 0.5) * 0.3) * 0.5;
col = mix(col, earth, bareN);
float rockW = smoothstep(0.30, 0.55, slope + (mid - 0.5) * 0.25);
col = mix(col, rock, rockW);
float snowW = smoothstep(uSnow - 12.0, uSnow + 12.0, vWP.y + (mid - 0.5) * 30.0) * (1.0 - smoothstep(0.45, 0.75, slope));
col = mix(col, snow, snowW);
// paths and grounds from the masks: worn earth with a lighter middle, grass creeping in at the edges
float road = vColor.r * smoothstep(0.15, 0.55, vColor.r + (small - 0.5) * 0.5);
vec3 path = mix(earth * 1.12, vec3(0.58, 0.50, 0.38), smoothstep(0.6, 1.0, vColor.r)) * (0.9 + 0.2 * tiny);
col = mix(col, path, road * (1.0 - snowW * 0.7));
float bare = vColor.g * smoothstep(0.1, 0.5, vColor.g + (small - 0.5) * 0.4);
col = mix(col, earth * (0.95 + 0.1 * tiny), bare * 0.9);
col = mix(col, sand, vColor.b);
// wet and dark just above the water line
col *= 1.0 - 0.35 * (1.0 - smoothstep(uWater - 0.1, uWater + 0.5, vWP.y));
// rain darkens it; lying snow covers the flat ground (thinner where feet have trodden the paths)
float wetK = uWet * (1.0 - snowW);
col *= 1.0 - wetK * 0.3;
float cover = uSnowCover * smoothstep(0.25, 0.7, vWN.y) * smoothstep(0.15, 0.55, uSnowCover * 1.2 + (mid - 0.5) * 0.6 + (small - 0.5) * 0.25) * (1.0 - road * 0.45);
col = mix(col, snow, clamp(cover, 0.0, 1.0));
snowW = max(snowW, cover);
diffuseColor.rgb = col;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(mix(0.97, 0.45, wetK), 0.55, snowW) ;`,
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

/** a deterministic hash for placements: the same field every visit */
const hash = (x: number, z: number) => {
  const v = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
/** smooth-shaded blob: an icosphere pushed in and out by noise (canopies, boulders) */
function lumpy(r: number, detail: number, amp: number, seed: number) {
  // welded first, so the noise moves shared corners together and the normals come out smooth
  const g = mergeVertices(new THREE.IcosahedronGeometry(r, detail).deleteAttribute('normal').deleteAttribute('uv'));
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 2.1 + seed) * Math.sin(v.y * 2.7 + seed * 1.3) * Math.sin(v.z * 2.3 + seed * 0.7);
    v.multiplyScalar(1 + n * amp);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
function mergeGeos(list: THREE.BufferGeometry[]) {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
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
}

/** lakes and rivers: small moving ripples in the normals, a fresnel sheen, clearer looking straight down */
function Water() {
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: '#2d5a6b', transparent: true, opacity: 0.84, roughness: 0.12, metalness: 0.1, depthWrite: false });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = { value: 0 };
      sh.uniforms.uIce = { value: 0 };
      m.userData.sh = sh;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWP2;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP2 = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uIce;\nvarying vec3 vWP2;')
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
vec2 q = vWP2.xz;
float t = uTime;
vec2 w = vec2(sin(q.x*0.9+t*1.3)+sin(q.y*1.3-t*1.1)*0.7+sin((q.x+q.y)*2.7+t*2.2)*0.35, cos(q.y*0.8+t*1.2)+cos(q.x*1.6-t*0.9)*0.6+cos((q.x-q.y)*3.1-t*2.5)*0.3);
normal = normalize(normal + (viewMatrix * vec4(w.x*0.08, 0.0, w.y*0.08, 0.0)).xyz * (1.0 - uIce));`,
        )
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
float fr = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 3.0);
gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.62, 0.74, 0.82), fr * 0.55);
gl_FragColor.a = mix(0.7, 0.95, fr);
// frozen over in deep winter: pale, milky, cracked here and there
float crack = smoothstep(0.96, 1.0, abs(sin(vWP2.x*0.37+sin(vWP2.z*0.21)*2.0)*cos(vWP2.z*0.29-vWP2.x*0.11)));
vec3 ice = mix(vec3(0.80, 0.88, 0.92), vec3(0.55, 0.66, 0.74), crack * 0.6);
gl_FragColor.rgb = mix(gl_FragColor.rgb, ice, uIce * 0.85);
gl_FragColor.a = mix(gl_FragColor.a, 0.97, uIce);`,
        );
    };
    return m;
  }, []);
  useFrame((st) => {
    const sh = mat.userData.sh;
    if (sh) {
      sh.uniforms.uTime.value = st.clock.elapsedTime;
      sh.uniforms.uIce.value = ICE.amt;
    }
  });
  return (
    <mesh position={[0, WATER_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1} material={mat}>
      <planeGeometry args={[WORLD_R * 2 + 200, WORLD_R * 2 + 200, 1, 1]} />
    </mesh>
  );
}

/** trees: pines of drooping tiers, round broadleaf crowns of several lumps, bare dead trees; every one a slightly
 *  different green, smooth shaded (the faceted cones read as low-poly toys) */
/** broadleaf crowns through the year: light green and a few in peach blossom in spring, deep green in summer,
 *  orange, red and gold in autumn, thin brown in winter (each tree its own shade, from its instance colour) */
function seasonalLeaves(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSeason = SEASON_U.uSeason;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec4 uSeason;').replace(
      '#include <color_fragment>',
      `#include <color_fragment>
vec3 lb = diffuseColor.rgb;
float hv = fract(sin(dot(vColor.rgb, vec3(129.898, 782.33, 377.19))) * 43758.5453);
vec3 lSpring = mix(lb * vec3(1.05, 1.3, 0.85), vec3(0.96, 0.62, 0.72), step(0.7, hv) * 0.85);
vec3 lSummer = lb * vec3(0.85, 1.0, 0.8);
vec3 lAutumn = mix(mix(vec3(0.86, 0.45, 0.08), vec3(0.72, 0.16, 0.06), hv), vec3(0.85, 0.68, 0.16), step(0.62, hv)) * (0.55 + length(lb) * 1.3);
vec3 lWinter = mix(lb * 0.55, vec3(0.36, 0.29, 0.22), 0.75);
diffuseColor.rgb = lSpring * uSeason.x + lSummer * uSeason.y + lAutumn * uSeason.z + lWinter * uSeason.w;`,
    );
  };
  m.customProgramCacheKey = () => 'leaves';
}
function Trees() {
  const meshes = useMemo(() => {
    const bark = new THREE.MeshStandardMaterial({ color: '#4a3526', roughness: 1 });
    const needles = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92 });
    const leaves = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 });
    const dead = new THREE.MeshStandardMaterial({ color: '#6b5b4b', roughness: 1 });
    seasonalLeaves(leaves);
    for (const m of [bark, needles, leaves, dead]) withSnow(m);
    const trunk = new THREE.CylinderGeometry(0.18, 0.42, 5, 7).translate(0, 2.5, 0);
    const tiers: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 5; k++) {
      const r = 2.6 - k * 0.45;
      const c = new THREE.ConeGeometry(r, 2.6 - k * 0.15, 12, 2, true);
      // the rim droops and is a little ragged
      const p = c.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        if (y < 0) p.setY(i, y - 0.25 - hash(i, k) * 0.35);
        const s = 1 + (hash(i * 3.1, k * 7.7) - 0.5) * 0.25;
        p.setX(i, p.getX(i) * s);
        p.setZ(i, p.getZ(i) * s);
      }
      c.computeVertexNormals();
      tiers.push(c.translate(0, 3.2 + k * 1.25, 0));
    }
    const crown = [lumpy(2.2, 3, 0.16, 1).scale(1, 0.85, 1).translate(0, 5.2, 0), lumpy(1.6, 3, 0.18, 2).translate(1.2, 6.1, 0.5), lumpy(1.5, 3, 0.18, 3).translate(-1.0, 5.8, -0.6), lumpy(1.3, 3, 0.2, 4).translate(0.2, 6.9, -0.2)];
    const deadParts = [new THREE.CylinderGeometry(0.15, 0.32, 5, 6).translate(0, 2.5, 0), new THREE.CylinderGeometry(0.06, 0.12, 2.2, 5).rotateZ(0.9).translate(0.8, 3.6, 0), new THREE.CylinderGeometry(0.05, 0.1, 1.8, 5).rotateZ(-1).translate(-0.6, 4.2, 0.2)];
    const kinds = [0, 1, 2].map((k) => TREES.filter((t) => t.kind === k));
    const make = (geo: THREE.BufferGeometry, mat: THREE.Material, list: typeof TREES, sy: number, tint?: (t: (typeof TREES)[number]) => THREE.Color) => {
      const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const sc = new THREE.Vector3();
      const p = new THREE.Vector3();
      list.forEach((t, i) => {
        p.set(t.x, groundHeight(t.x, t.z) - 0.3, t.z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (t.x * 13.1 + t.z * 7.7) % 6.28);
        sc.set(t.s, t.s * sy * (0.9 + hash(t.x, t.z) * 0.25), t.s);
        m.compose(p, q, sc);
        im.setMatrixAt(i, m);
        if (tint) im.setColorAt(i, tint(t));
      });
      im.count = list.length;
      im.castShadow = true;
      im.receiveShadow = true;
      im.frustumCulled = false;
      return im;
    };
    const pineCol = (t: (typeof TREES)[number]) => new THREE.Color().setHSL(0.3 + hash(t.x, t.z) * 0.06, 0.38 + hash(t.z, t.x) * 0.12, 0.17 + hash(t.x + 1, t.z) * 0.06);
    const leafCol = (t: (typeof TREES)[number]) => new THREE.Color().setHSL(0.2 + hash(t.x, t.z) * 0.08, 0.42 + hash(t.z, t.x) * 0.15, 0.24 + hash(t.x + 2, t.z) * 0.08);
    return [
      make(trunk, bark, kinds[0], 1),
      make(mergeGeos(tiers), needles, kinds[0], 1, pineCol),
      make(trunk, bark, kinds[1], 1),
      make(mergeGeos(crown), leaves, kinds[1], 1, leafCol),
      make(mergeGeos(deadParts), dead, kinds[2], 1),
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

/** boulders and stones: big ones on the hillsides and in the mountains, small ones by the paths */
function Rocks() {
  const mesh = useMemo(() => {
    const spots: { x: number; z: number; s: number; y: number }[] = [];
    const R = WORLD_R - 30;
    for (let k = 0; k < 9000 && spots.length < 2600; k++) {
      const x = (hash(k, 1.7) * 2 - 1) * R;
      const z = (hash(k * 1.3, 9.1) * 2 - 1) * R;
      const h = groundHeight(x, z);
      if (h < WATER_Y + 0.5 || Math.hypot(x, z) < VILLAGE_R + 15 || pathDist(x, z) < 3.5) continue;
      if (nearTq(x, z, 47) || nearCourt(x, z, CT_PAD) || onGudao(x, z, pathDist(x, z)) || nearPlace(x, z, 2) || DENS.some((d) => Math.hypot(d.x - x, d.z - z) < DEN_R + 4)) continue;
      const sl = slopeAt(x, z);
      const want = sl > 0.35 ? 0.9 : h > 40 ? 0.6 : pathDist(x, z) < 12 ? 0.5 : 0.18;
      if (hash(x, z) > want) continue;
      const s = sl > 0.35 ? 0.6 + hash(z, x) * 2.4 : 0.25 + hash(z, x) * 0.9;
      spots.push({ x, z, s, y: h });
    }
    const geo = lumpy(1, 2, 0.3, 5).scale(1, 0.62, 1);
    const im = new THREE.InstancedMesh(geo, withSnow(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 })), spots.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    spots.forEach((r, i) => {
      e.set((hash(r.x, 3) - 0.5) * 0.5, hash(r.z, 4) * 6.28, (hash(r.x, 5) - 0.5) * 0.5);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(r.x, r.y - r.s * 0.25, r.z), q, new THREE.Vector3(r.s * (0.8 + hash(r.x, 6) * 0.5), r.s, r.s * (0.8 + hash(r.z, 7) * 0.5)));
      im.setMatrixAt(i, m);
      const g = 0.36 + hash(r.x, r.z) * 0.16;
      im.setColorAt(i, new THREE.Color(g, g * 0.97, g * 0.92));
    });
    im.castShadow = true;
    im.receiveShadow = true;
    im.frustumCulled = false;
    return im;
  }, []);
  return <primitive object={mesh} />;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** the blade texture: a tuft of tapering blades, light at the tips */
function bladeTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  for (let k = 0; k < 38; k++) {
    const x = 6 + hash(k, 1) * 116;
    const lean = (hash(k, 2) - 0.5) * 46;
    const h = 40 + hash(k, 3) * 86;
    const w = 1.6 + hash(k, 4) * 2.4;
    const t = hash(k, 5);
    const grd = g.createLinearGradient(0, 128, 0, 128 - h);
    grd.addColorStop(0, `rgb(${52 + t * 20},${74 + t * 20},${30 + t * 8})`);
    grd.addColorStop(0.55, `rgb(${110 + t * 30},${140 + t * 20},${60 + t * 10})`);
    grd.addColorStop(1, `rgb(${175 + t * 40},${185 + t * 20},${105 + t * 20})`);
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(x - w, 128);
    g.quadraticCurveTo(x + lean * 0.3, 128 - h * 0.5, x + lean, 128 - h);
    g.quadraticCurveTo(x + lean * 0.3 + w * 0.4, 128 - h * 0.5, x + w, 128);
    g.closePath();
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const GRASS_N = 20000;
const GRASS_R = 44;
/** grass tufts round the player, swaying in the wind; laid again as he walks (same tufts in the same places) */
/** the grass blades' material: the climate tints it with the season */
export const GRASS: { mat: THREE.MeshStandardMaterial | null } = { mat: null };
function Grass({ sim }: { sim: Sim }) {
  const st = useMemo(() => {
    const q1 = new THREE.PlaneGeometry(1.1, 0.55).translate(0, 0.26, 0);
    const q2 = q1.clone().rotateY(Math.PI / 2);
    const q3 = q1.clone().rotateY(Math.PI / 4);
    const geo = new THREE.BufferGeometry();
    const parts = [q1, q2, q3].map((g) => g.toNonIndexed());
    const n = parts.reduce((a, g) => a + g.getAttribute('position').count, 0);
    const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), nor = new Float32Array(n * 3);
    let o = 0;
    for (const g of parts) {
      const c = g.getAttribute('position').count;
      pos.set(g.getAttribute('position').array as Float32Array, o * 3);
      uv.set(g.getAttribute('uv').array as Float32Array, o * 2);
      for (let i = 0; i < c; i++) nor.set([0, 1, 0], (o + i) * 3); // lit like the ground under it
      o += c;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    const mat = new THREE.MeshStandardMaterial({ map: bladeTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 });
    GRASS.mat = mat;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = { value: 0 };
      sh.uniforms.uSeason = SEASON_U.uSeason;
      sh.uniforms.uSnowCover = SEASON_U.uSnowCover;
      mat.userData.sh = sh;
      // both faces lit as the ground under them (the back faces used to turn black)
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);')
        .replace('#include <common>', '#include <common>\nuniform vec4 uSeason;\nuniform float uSnowCover;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
// the blades with the seasons: lush in spring and summer, straw and russet in autumn, dun in winter, frosted white in snow
float gl = dot(diffuseColor.rgb, vec3(0.3, 0.5, 0.2));
vec3 gc = diffuseColor.rgb * (uSeason.x * vec3(1.0, 1.1, 0.85) + uSeason.y * vec3(0.9, 1.0, 0.85));
gc += uSeason.z * mix(diffuseColor.rgb, vec3(0.78, 0.6, 0.24) * gl * 2.6, 0.75);
gc += uSeason.w * mix(diffuseColor.rgb, vec3(0.5, 0.45, 0.33) * gl * 2.4, 0.8);
diffuseColor.rgb = mix(gc, vec3(0.9, 0.93, 0.97), uSnowCover * 0.75);`,
        );
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uSnowCover;').replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
float sway = sin(uTime * 1.7 + ip.x * 0.35 + ip.z * 0.27) * 0.5 + sin(uTime * 3.1 + ip.x * 0.9) * 0.2;
transformed.y *= 1.0 - uSnowCover * 0.55; // half buried in snow
transformed.x += sway * 0.18 * uv.y;
transformed.z += sway * 0.08 * uv.y;`,
      );
    };
    const im = new THREE.InstancedMesh(geo, mat, GRASS_N);
    im.count = 0;
    im.frustumCulled = false;
    im.receiveShadow = true;
    return { im, mat, cx: 1e9, cz: 1e9 };
  }, []);
  useFrame((state) => {
    const sh = st.mat.userData.sh;
    if (sh) sh.uniforms.uTime.value = state.clock.elapsedTime;
    const p = sim.player.pos;
    const cx = Math.round(p[0] / 8) * 8, cz = Math.round(p[2] / 8) * 8;
    if (cx === st.cx && cz === st.cz) return;
    st.cx = cx;
    st.cz = cz;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const col = new THREE.Color();
    const Y = new THREE.Vector3(0, 1, 0);
    const S = 0.92;
    let n = 0;
    const near = DENS.filter((d) => Math.abs(d.x - cx) < GRASS_R + DEN_R + 4 && Math.abs(d.z - cz) < GRASS_R + DEN_R + 4);
    const town = Math.hypot(cx, cz) < GRASS_R + VILLAGE_R + 8;
    const tq = nearTq(cx, cz, 300);
    const ct = nearCourt(cx, cz, 200);
    for (let gx = Math.floor((cx - GRASS_R) / S); gx <= Math.ceil((cx + GRASS_R) / S) && n < GRASS_N; gx++)
      for (let gz = Math.floor((cz - GRASS_R) / S); gz <= Math.ceil((cz + GRASS_R) / S) && n < GRASS_N; gz++) {
        const x = (gx + hash(gx, gz)) * S, z = (gz + hash(gz, gx)) * S;
        const dd = Math.hypot(x - cx, z - cz);
        if (dd > GRASS_R) continue;
        // thinner towards the edge of the patch, and in the dry places
        const dens = hash(gx * 1.7, gz * 2.3);
        if (dens > 1 - dd / GRASS_R * 0.55) continue;
        if (town && Math.hypot(x, z) < VILLAGE_R + 6) continue;
        let skip = false;
        for (const d of near) if (Math.hypot(d.x - x, d.z - z) < DEN_R + 3) skip = true;
        if (skip) continue;
        const h = groundHeight(x, z);
        if (h < WATER_Y + 0.4 || h > SNOW_Y - 20) continue;
        const pd = pathDist(x, z);
        if (pd < 3.2 || (tq && (nearTq(x, z, 46) || onGudao(x, z, pd))) || (ct && nearCourt(x, z, 92))) continue;
        if (slopeAt(x, z) > 0.55 || nearPlace(x, z, -3)) continue;
        q.setFromAxisAngle(Y, hash(x, z) * 6.28);
        // smaller toward the patch's rim, so it ends softly instead of in a ring
        const s = (0.6 + hash(z, x) * 0.75) * (1 - smoothstep(GRASS_R * 0.6, GRASS_R, dd) * 0.7);
        sc.set(s, s * (0.8 + hash(x * 3, z) * 0.6), s);
        m.compose(v.set(x, h - 0.05, z), q, sc);
        st.im.setMatrixAt(n, m);
        // patches of greener and drier tufts, following a slow noise like the ground's
        const dry = Math.max(0, Math.min(1, noise(x * 0.03, z * 0.03) * 0.9 + 0.35));
        col.setHSL(0.24 - dry * 0.07 + hash(x, z * 2) * 0.03, 0.42 - dry * 0.1, 0.34 + dry * 0.1 + hash(x * 2, z) * 0.1);
        st.im.setColorAt(n, col);
        n++;
      }
    st.im.count = n;
    st.im.instanceMatrix.needsUpdate = true;
    if (st.im.instanceColor) st.im.instanceColor.needsUpdate = true;
  });
  return <primitive object={st.im} />;
}

/** the sky dome, for the climate to move its sun and thicken its haze */
export const SKY: { sky: Sky | null } = { sky: null };
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
    SKY.sky = s;
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
  return (
    <>
      <SkyDome />
      <Ground sim={sim} />
      <Water />
      <Trees />
      <Rocks />
      <Grass sim={sim} />
    </>
  );
}

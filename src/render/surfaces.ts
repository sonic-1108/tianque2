// Surfaces for the shapes buildings are made of: each material gets a painted grey pattern (boards, stone blocks,
// plaster, tiles, thatch, weave, patina) sampled in world space from three sides (no stretching on long boxes), a
// little tone shift per piece and dirt toward the ground, so a wall reads as a wall and not a smooth plastic block.
import * as THREE from 'three';

type Pat = 'planks' | 'lacquer' | 'blocks' | 'flags' | 'plaster' | 'tiles' | 'thatch' | 'weave' | 'patina' | 'bark' | 'rough';

// a small tileable value noise on an n x n lattice
function noiseField(n: number, seed: number) {
  const v = new Float32Array(n * n);
  let s = seed * 9301 + 49297;
  for (let i = 0; i < v.length; i++) {
    s = (s * 9301 + 49297) % 233280;
    v[i] = s / 233280;
  }
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const a = v[((yi % n + n) % n) * n + ((xi % n + n) % n)], b = v[((yi % n + n) % n) * n + (((xi + 1) % n + n) % n)];
    const c = v[(((yi + 1) % n + n) % n) * n + ((xi % n + n) % n)], d = v[(((yi + 1) % n + n) % n) * n + (((xi + 1) % n + n) % n)];
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}
const fbm = (f: (x: number, y: number) => number, x: number, y: number, o = 4) => {
  let t = 0, a = 0.5, k = 1, w = 0;
  for (let i = 0; i < o; i++) {
    t += f(x * k, y * k) * a;
    w += a;
    a *= 0.5;
    k *= 2;
  }
  return t / w;
};

const N = 256;
function paint(p: Pat) {
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  const img = g.createImageData(N, N);
  const n1 = noiseField(16, p.length * 7 + 3), n2 = noiseField(64, p.length * 13 + 5), n3 = noiseField(8, p.length * 3 + 1);
  const rows = 8; // boards / courses per tile
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N;
      let t = 0.82;
      const fine = fbm(n2, u * 64, v * 64, 3);
      const coarse = fbm(n1, u * 16, v * 16, 4);
      if (p === 'planks' || p === 'lacquer') {
        // horizontal boards: a dark seam between them, each board its own tone, grain running along it
        const row = Math.floor(v * rows), fv = v * rows - row;
        const tone = noiseField(16, row + 1)(row * 3.1, 0.5);
        const grain = fbm(n2, u * 6 + row * 1.7, v * 120, 3);
        t = (p === 'planks' ? 0.62 + tone * 0.3 + (grain - 0.5) * 0.45 : 0.84 + (grain - 0.5) * 0.12 + (coarse - 0.5) * 0.15);
        if (fv < 0.07 || fv > 0.95) t *= p === 'planks' ? 0.45 : 0.8;
        // a knot now and then
        if (p === 'planks') {
          const kx = ((u * 3 + row * 0.37) % 1) - 0.5, ky = fv - 0.5;
          if (tone > 0.72 && kx * kx * 9 + ky * ky * 4 < 0.05) t *= 0.6;
        }
      } else if (p === 'blocks' || p === 'flags') {
        // courses of cut stone, every other course offset half a block; mortar lines; each block its own shade,
        // chipped edges and lichen in the low corners
        const cr = p === 'blocks' ? 4 : 3;
        const row = Math.floor(v * cr), fv = v * cr - row;
        const cols = p === 'blocks' ? 2 : 3;
        const uu = u * cols + (row % 2) * 0.5, col = Math.floor(uu), fu = uu - col;
        const id = noiseField(32, 11)(col * 2.3 + row * 7.1, row * 1.3);
        const edge = Math.min(fu, 1 - fu, fv * (cols / cr) * 1.0, (1 - fv) * (cols / cr));
        t = 0.62 + id * 0.32 + (fine - 0.5) * 0.28 + (coarse - 0.5) * 0.2;
        const m = 0.035 + (fine - 0.5) * 0.02;
        if (edge < m) t = 0.36 + fine * 0.1;
        else if (edge < m * 2.2) t *= 0.86;
      } else if (p === 'plaster') {
        // limewash over brick: mottled, stained in streaks, brick showing through where it flaked
        t = 0.78 + (coarse - 0.5) * 0.35 + (fine - 0.5) * 0.12;
        const streak = fbm(n3, u * 8, v * 1.5, 3);
        t -= Math.max(0, streak - 0.55) * 0.5;
        if (fbm(n1, u * 10 + 3, v * 10, 3) > 0.7) {
          const row = Math.floor(v * 16), fv = v * 16 - row;
          const fu = (u * 8 + (row % 2) * 0.5) % 1;
          t = fv < 0.12 || fu < 0.06 ? 0.45 : 0.6 + fine * 0.15;
        }
      } else if (p === 'tiles') {
        // rows of half round tiles: a ridge and a gutter across, an overlap line every course
        const fu = (u * 12) % 1, row = Math.floor(v * 10), fv = v * 10 - row;
        const round = Math.sin(fu * Math.PI);
        t = 0.45 + round * 0.45 + (fine - 0.5) * 0.15 + (noiseField(16, 5)(Math.floor(u * 12) * 1.7, row * 2.3) - 0.5) * 0.2;
        if (fv > 0.88) t *= 0.55;
      } else if (p === 'thatch') {
        const s1 = fbm(n2, u * 90, v * 6, 3);
        t = 0.5 + s1 * 0.55 + (coarse - 0.5) * 0.2;
        if ((v * 6) % 1 > 0.92) t *= 0.7;
      } else if (p === 'weave') {
        const a = Math.sin(u * N * 0.5) * Math.sin(v * N * 0.5);
        t = 0.8 + a * 0.08 + (coarse - 0.5) * 0.3;
      } else if (p === 'patina') {
        t = 0.75 + (coarse - 0.5) * 0.5 + (fine - 0.5) * 0.2;
      } else if (p === 'bark') {
        const s1 = fbm(n2, u * 10, v * 70, 3);
        t = 0.55 + s1 * 0.45;
        if (fbm(n1, u * 20, v * 4, 2) > 0.66) t *= 0.6;
      } else {
        t = 0.7 + (coarse - 0.5) * 0.4 + (fine - 0.5) * 0.3;
      }
      const k = Math.max(0, Math.min(1, t)) * 255;
      const o = (y * N + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = k;
      img.data[o + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  return tex;
}
const texCache = new Map<Pat, THREE.Texture>();
const texOf = (p: Pat) => {
  let t = texCache.get(p);
  if (!t) texCache.set(p, (t = paint(p)));
  return t;
};

/** which pattern a material wears, and how many metres one tile of it covers */
export const SURFACE: Record<string, [Pat, number]> = {
  stone: ['blocks', 2.4],
  step: ['flags', 2.4],
  pave: ['flags', 2.8],
  pave2: ['flags', 2.8],
  rock: ['rough', 3],
  wall: ['plaster', 4],
  red: ['lacquer', 2.5],
  wood: ['planks', 2],
  plank: ['planks', 2],
  log: ['bark', 1.6],
  roof: ['tiles', 3],
  tile: ['tiles', 3],
  thatch: ['thatch', 2.5],
  hay: ['thatch', 1.6],
  canvas: ['weave', 1],
  cloth: ['weave', 1],
  bronze: ['patina', 1.5],
  soil: ['rough', 1.5],
  ridge: ['patina', 1.2],
};

/** give a material its pattern (world space, three sided), a tone shift per piece and dirt toward the ground */
export function dress(mat: THREE.MeshStandardMaterial, name: string) {
  const s = SURFACE[name];
  if (!s) return;
  const tex = texOf(s[0]);
  const scale = 1 / s[1];
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tqTex = { value: tex };
    sh.uniforms.tqScale = { value: scale };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 tqP;\nvarying vec3 tqN;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ntqP = (modelMatrix * vec4(transformed, 1.0)).xyz;\ntqN = normalize(mat3(modelMatrix) * objectNormal);',
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tqTex;\nuniform float tqScale;\nvarying vec3 tqP;\nvarying vec3 tqN;\nfloat tqT = 1.0;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          vec3 bw = pow(abs(normalize(tqN)), vec3(4.0));
          bw /= (bw.x + bw.y + bw.z);
          vec3 q = tqP * tqScale;
          tqT = texture2D(tqTex, vec2(q.z, q.y)).r * bw.x + texture2D(tqTex, vec2(q.x, q.z)).r * bw.y + texture2D(tqTex, vec2(q.x, q.y)).r * bw.z;
          // each piece a shade apart (by the metre cell it sits in), and a far-off softening so distant walls don't shimmer
          float h = fract(sin(dot(floor(tqP.xz * 0.4 + 0.5) + floor(tqP.y * 0.25), vec2(12.9898, 78.233))) * 43758.5453);
          tqT = mix(tqT, 0.8, clamp(length(cameraPosition - tqP) / 140.0, 0.0, 0.6));
          diffuseColor.rgb *= tqT * 1.18 * (0.9 + 0.2 * h);
        }`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * (1.25 - 0.35 * tqT), 0.0, 1.0);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= tqT;');
  };
  mat.customProgramCacheKey = () => 'tq-surface-' + s[0];
  mat.needsUpdate = true;
}

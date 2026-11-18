// The rivers (owner: the water had no body and no character). A map of the water is baked once from the ground: how
// deep, how far from the bank, which way the river runs (along the painted river, downstream away from the middle of
// the map; still in the wide pools). The surface: ripples carried downstream (two phases crossfaded so they never
// stretch), jade green in the shallows where you see the bed, deep blue green in the channel, the sky and the sun in
// it at a glance, white foam along the banks, rings in the rain, peach petals floating in spring and red leaves in
// autumn, milky ice in deep winter. Along it: reeds in the shallows (green, gold in autumn, pale in winter), lotus in
// the still water near the village (flowers in summer, seed heads in autumn), mist lying on it at dawn and at night,
// river lanterns drifting down past the village after dark, a carp leaping now and then near you. A great body lying
// in the water (the river dragon, GiantSerpent) churns it: white water hugging it where it meets the surface and rings
// pushed out from it (`WATER_BODY`, filled each frame by whoever is in the water).
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ICE, WATER_Y, WORLD_R, groundHeight } from '../game/world';
import { mapWater } from '../game/mapsample';
import type { Sim } from '../game/sim';
import { weatherMix } from '../game/clock';
import { SEASON_U, WATER_U } from './season';

// ================================================================ the water map
const N = 1024;
const CELL = (2 * WORLD_R) / N;
export interface WaterMap {
  /** metres below the water line (<= 0: land) */
  depth: Float32Array;
  /** metres to the nearest bank */
  shore: Float32Array;
  /** downstream, its length how much it runs (0 in a still pool) */
  fx: Float32Array;
  fz: Float32Array;
  tex: THREE.DataTexture;
}
let MAP: WaterMap | null = null;
const idx = (x: number, z: number) => {
  const i = Math.floor((x + WORLD_R) / CELL), j = Math.floor((z + WORLD_R) / CELL);
  return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i;
};
/** the water at a point: depth (m), downstream (x, z) */
export function waterAt(x: number, z: number) {
  const m = waterMap(), k = idx(x, z);
  return k < 0 ? { d: 0, fx: 0, fz: 0, shore: 0 } : { d: m.depth[k], fx: m.fx[k], fz: m.fz[k], shore: m.shore[k] };
}
function blur(src: Float32Array, r: number) {
  // separable box blur, twice (close to a gaussian)
  const tmp = new Float32Array(N * N), out = new Float32Array(N * N);
  const pass = (a: Float32Array, b: Float32Array, horiz: boolean) => {
    for (let l = 0; l < N; l++) {
      let acc = 0;
      const at = (k: number) => (horiz ? a[l * N + k] : a[k * N + l]);
      for (let k = -r; k <= r; k++) acc += at(Math.min(N - 1, Math.max(0, k)));
      for (let k = 0; k < N; k++) {
        const v = acc / (2 * r + 1);
        if (horiz) b[l * N + k] = v;
        else b[k * N + l] = v;
        acc += at(Math.min(N - 1, k + r + 1)) - at(Math.max(0, k - r));
      }
    }
  };
  pass(src, tmp, true);
  pass(tmp, out, false);
  pass(out, tmp, true);
  pass(tmp, out, false);
  return out;
}
export function waterMap(): WaterMap {
  if (MAP) return MAP;
  const X = (i: number) => -WORLD_R + (i + 0.5) * CELL;
  const depth = new Float32Array(N * N).fill(-1);
  // only where the painted rivers are is the ground asked (the rest is land)
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x = X(i), z = X(j);
      if (mapWater(x, z) < 0.003) continue;
      depth[j * N + i] = WATER_Y - groundHeight(x, z);
    }
  // how far from the bank (chamfer distance, metres)
  const shore = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) shore[k] = depth[k] > 0.02 ? 1e9 : 0;
  const D1 = CELL, D2 = CELL * Math.SQRT2;
  for (let j = 1; j < N; j++)
    for (let i = 1; i < N - 1; i++) {
      const k = j * N + i;
      if (!shore[k]) continue;
      shore[k] = Math.min(shore[k], shore[k - 1] + D1, shore[k - N] + D1, shore[k - N - 1] + D2, shore[k - N + 1] + D2);
    }
  for (let j = N - 2; j >= 0; j--)
    for (let i = N - 2; i >= 1; i--) {
      const k = j * N + i;
      if (!shore[k]) continue;
      shore[k] = Math.min(shore[k], shore[k + 1] + D1, shore[k + N] + D1, shore[k + N + 1] + D2, shore[k + N - 1] + D2);
    }
  // which way it runs: across the river is where the water's edge changes most (structure tensor of the blurred
  // water), downstream is square to that; how sure (coherence) says river or still pool
  const wet = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) wet[k] = depth[k] > 0 ? 1 : 0;
  const s = blur(wet, 3);
  const jxx = new Float32Array(N * N), jxz = new Float32Array(N * N), jzz = new Float32Array(N * N);
  for (let j = 1; j < N - 1; j++)
    for (let i = 1; i < N - 1; i++) {
      const k = j * N + i, gx = s[k + 1] - s[k - 1], gz = s[k + N] - s[k - N];
      jxx[k] = gx * gx;
      jxz[k] = gx * gz;
      jzz[k] = gz * gz;
    }
  const bxx = blur(jxx, 8), bxz = blur(jxz, 8), bzz = blur(jzz, 8);
  const fx = new Float32Array(N * N), fz = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) {
    if (depth[k] <= 0) continue;
    const a = bxx[k], b = bxz[k], c = bzz[k];
    const th = 0.5 * Math.atan2(2 * b, a - c); // across the river
    const coh = Math.min(1, Math.sqrt((a - c) * (a - c) + 4 * b * b) / (a + c + 1e-6));
    fx[k] = -Math.sin(th) * coh;
    fz[k] = Math.cos(th) * coh;
  }
  // one way along each river: from the end nearest the middle of the map, every cell agrees with the one it was
  // reached from
  const seen = new Uint8Array(N * N);
  const order: number[] = [];
  for (let k = 0; k < N * N; k++) if (depth[k] > 0) order.push(k);
  order.sort((p, q) => {
    const px = (p % N) - N / 2, pz = Math.floor(p / N) - N / 2, qx = (q % N) - N / 2, qz = Math.floor(q / N) - N / 2;
    return px * px + pz * pz - (qx * qx + qz * qz);
  });
  const queue = new Int32Array(order.length);
  for (const start of order) {
    if (seen[start]) continue;
    // the river's first cell runs away from the middle
    const sx = (start % N) - N / 2, sz = Math.floor(start / N) - N / 2;
    if (fx[start] * sx + fz[start] * sz < 0) {
      fx[start] = -fx[start];
      fz[start] = -fz[start];
    }
    let h = 0, t = 0;
    queue[t++] = start;
    seen[start] = 1;
    while (h < t) {
      const k = queue[h++];
      const i = k % N, j = (k - i) / N;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue;
        const q = jj * N + ii;
        if (seen[q] || depth[q] <= 0) continue;
        seen[q] = 1;
        if (fx[q] * fx[k] + fz[q] * fz[k] < 0) {
          fx[q] = -fx[q];
          fz[q] = -fz[q];
        }
        queue[t++] = q;
      }
    }
  }
  const data = new Uint8Array(N * N * 4);
  for (let k = 0; k < N * N; k++) {
    data[k * 4] = Math.max(0, Math.min(255, (depth[k] / 4) * 255));
    data[k * 4 + 1] = Math.max(0, Math.min(255, (shore[k] / 24) * 255));
    data[k * 4 + 2] = Math.round((fx[k] * 0.5 + 0.5) * 255);
    data[k * 4 + 3] = Math.round((fz[k] * 0.5 + 0.5) * 255);
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  MAP = { depth, shore, fx, fz, tex };
  return MAP;
}

// ================================================================ the surface
/** points where a great body cuts the surface (x, z, its girth there, how hard it churns 0..1); uBodyOn 0 when none */
export const BODY_N = 10;
export const WATER_BODY = { uBody: { value: Array.from({ length: BODY_N }, () => new THREE.Vector4()) }, uBodyOn: { value: 0 } };
const NOISE = `
float wh(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float wn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(wh(i),wh(i+vec2(1,0)),u.x), mix(wh(i+vec2(0,1)),wh(i+vec2(1,1)),u.x), u.y); }
float wavesH(vec2 p){ return wn(p*0.55)*0.55 + wn(p*1.31+vec2(7.1,3.3))*0.3 + wn(p*3.07+vec2(1.7,9.2))*0.15; }
vec2 wavesD(vec2 p){ float e = 0.15; float h = wavesH(p); return vec2(wavesH(p+vec2(e,0.0))-h, wavesH(p+vec2(0.0,e))-h)/e; }
`;
function waterMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: '#2d5a6b', transparent: true, roughness: 0.06, metalness: 0.02, depthWrite: false });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWaterMap = { value: waterMap().tex };
    sh.uniforms.uIce = { value: 0 };
    sh.uniforms.uSeason = SEASON_U.uSeason;
    Object.assign(sh.uniforms, WATER_U, WATER_BODY);
    m.userData.sh = sh;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP2;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP2 = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D uWaterMap;
uniform float uTime;
uniform float uIce;
uniform float uRain;
uniform float uNight;
uniform float uDay;
uniform vec3 uSunDir;
uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform vec4 uSeason;
uniform vec4 uBody[${BODY_N}];
uniform float uBodyOn;
varying vec3 vWP2;
${NOISE}
float wDep; float wShore; vec2 wFlow; float wDetail; float wFoam; float wBody;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec4 wi = texture2D(uWaterMap, (vWP2.xz + ${WORLD_R.toFixed(1)}) / ${(2 * WORLD_R).toFixed(1)});
wDep = wi.r * 4.0;
wShore = wi.g * 24.0;
wFlow = wi.ba * 2.0 - 1.0;
wDetail = 1.0 - smoothstep(110.0, 420.0, length(vWP2 - cameraPosition));
// jade in the shallows, deep blue green in the channel; autumn greyer, winter darker
vec3 shallowC = mix(vec3(0.30, 0.55, 0.48), vec3(0.34, 0.50, 0.45), uSeason.z * 0.6 + uSeason.w * 0.4);
vec3 deepC = mix(vec3(0.03, 0.16, 0.21), vec3(0.04, 0.12, 0.17), uSeason.w);
diffuseColor.rgb = mix(shallowC, deepC, smoothstep(0.0, 2.3, wDep));
diffuseColor.a = mix(0.34, 0.93, smoothstep(0.0, 1.7, wDep));`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
{
  // ripples carried downstream: two phases of the same pattern, each sliding for half a cycle, crossfaded
  float T = uTime * 0.32;
  float ph0 = fract(T), ph1 = fract(T + 0.5);
  float wt = abs(ph0 * 2.0 - 1.0);
  vec2 run = wFlow * 3.4;
  vec2 p = vWP2.xz;
  vec2 dW = mix(wavesD(p - run * ph0), wavesD(p - run * ph1 + vec2(13.7, 5.1)), wt);
  // the wind's small ripples over everything
  dW += wavesD(p * 2.4 + vec2(uTime * 0.55, uTime * 0.37)) * 0.32;
  // rain: rings opening everywhere
  if (uRain > 0.01) {
    vec2 cp = p * 1.4; vec2 ci = floor(cp); vec2 cf = fract(cp) - 0.5;
    float age = fract(uTime * 0.85 + wh(ci));
    vec2 rv = cf - (vec2(wh(ci + 3.1), wh(ci + 7.7)) - 0.5) * 0.5;
    float rr = length(rv), R = age * 0.42;
    float ring = sin((rr - R) * 70.0) * smoothstep(0.07, 0.0, abs(rr - R)) * (1.0 - age);
    dW += rv / (rr + 1e-3) * ring * 1.6 * uRain;
  }
  float amp = (0.09 + length(wFlow) * 0.13) * wDetail * (1.0 - uIce);
  // a great body in the water: white water hugging it, rings pushed out from it
  vec2 bD = vec2(0.0);
  wBody = 0.0;
  if (uBodyOn > 0.5 && uIce < 0.5) {
    float bn = wn(p * 1.3 + vec2(uTime * 0.9, -uTime * 0.6)) * 0.6 + wn(p * 3.7 - vec2(uTime * 1.7, uTime * 0.4)) * 0.4;
    for (int k = 0; k < ${BODY_N}; k++) {
      vec4 b = uBody[k];
      if (b.w <= 0.0) continue;
      vec2 dv = p - b.xy;
      float d = length(dv), edge = d - b.z;
      wBody = max(wBody, b.w * smoothstep(0.7 + bn * 1.6, 0.0, edge));
      float rip = sin(edge * 2.4 - uTime * 4.5) * smoothstep(10.0, 0.6, edge) * step(-0.3, edge);
      bD += dv / (d + 1e-3) * rip * 0.35 * b.w;
    }
  }
  vec3 nW = normalize(vec3(-dW.x * amp - bD.x * wDetail, 1.0, -dW.y * amp - bD.y * wDetail));
  normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
  // foam: along the banks, breaking up and drifting; streaks where the river runs quick
  vec2 fp = p - wFlow * uTime * 0.7;
  float fn = wn(fp * 1.7) * 0.6 + wn(fp * 4.3) * 0.4;
  float bank = 1.0 - smoothstep(0.0, 0.6, wDep);
  wFoam = smoothstep(0.55, 0.75, fn + bank * 0.55) * bank;
  vec2 along = normalize(wFlow + 1e-4);
  // soft drifts of froth on the quick water, long along the current and broken up (not hard lines)
  vec2 sq = vec2(dot(p, along) * 0.07, dot(p, vec2(-along.y, along.x)) * 0.55) - vec2(uTime * length(wFlow) * 0.3, 0.0);
  float drift = smoothstep(0.62, 0.9, wn(sq)) * smoothstep(0.45, 0.8, wn(p * 1.1 - wFlow * uTime * 0.5));
  wFoam += drift * smoothstep(0.35, 0.85, length(wFlow)) * 0.14 * wDetail * smoothstep(0.8, 2.0, wDep);
  wFoam *= 1.0 - uIce;
  wFoam = max(wFoam, smoothstep(0.25, 0.85, wBody) * 0.95);
}`,
      )
      .replace(
        '#include <opaque_fragment>',
        `{
  vec3 V = normalize(cameraPosition - vWP2);
  vec3 nW = inverseTransformDirection(normal, viewMatrix);
  float fr = 0.02 + 0.98 * pow(1.0 - max(dot(nW, V), 0.0), 5.0);
  vec3 R = reflect(-V, nW);
  vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, R.y));
  outgoingLight = mix(outgoingLight, sky, clamp(fr * 0.9, 0.0, 0.92));
  // the sun (or the moon) in it: a hard glint and a broad sheen
  float sd = max(dot(R, normalize(uSunDir)), 0.0);
  vec3 sunC = mix(vec3(1.0, 0.93, 0.78), vec3(0.62, 0.72, 0.95), uNight);
  outgoingLight += sunC * (pow(sd, 700.0) * 7.0 + pow(sd, 60.0) * 0.25) * (uDay * 0.9 + uNight * 0.35) * wDetail;
  // foam
  // (white by day, a dim moonlit grey at night: it must not glow in the dark)
  vec3 foamC = mix(vec3(0.07, 0.09, 0.13), vec3(0.86, 0.9, 0.9), clamp(uDay, 0.0, 1.0));
  outgoingLight = mix(outgoingLight, foamC, clamp(wFoam, 0.0, 1.0) * 0.85);
  diffuseColor.a = max(diffuseColor.a, wFoam * 0.9);
  diffuseColor.a = max(diffuseColor.a, fr * 0.9);
  // petals in spring, red and gold leaves in autumn, floating downstream (two phases, fading in and out)
  float season = uSeason.x + uSeason.z;
  if (season > 0.05 && wDetail > 0.0 && uIce < 0.5) {
    for (int k = 0; k < 2; k++) {
      float ph = fract(uTime * 0.05 + float(k) * 0.5);
      float wgt = 1.0 - abs(ph * 2.0 - 1.0);
      vec2 q = vWP2.xz - wFlow * ph * 18.0 + float(k) * vec2(31.7, 17.3);
      vec2 ci = floor(q / 1.9);
      vec2 cf = q / 1.9 - ci - 0.5;
      float has = step(wh(ci + 0.37), 0.16 * season * (0.4 + 0.6 * (1.0 - length(wFlow))));
      vec2 off = (vec2(wh(ci + 1.3), wh(ci + 2.9)) - 0.5) * 0.6;
      float ang = wh(ci + 5.1) * 6.283;
      vec2 d = cf - off;
      d = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * d;
      float petal = smoothstep(1.0, 0.75, length(d * vec2(9.0, 15.0)));
      vec3 pc = uSeason.x > uSeason.z ? mix(vec3(0.98, 0.76, 0.82), vec3(1.0, 0.9, 0.93), wh(ci + 8.8)) : mix(vec3(0.80, 0.25, 0.08), vec3(0.88, 0.62, 0.15), wh(ci + 8.8));
      float a = petal * has * wgt * smoothstep(0.15, 0.6, wDep) * wDetail;
      outgoingLight = mix(outgoingLight, pc * (0.08 + 0.92 * clamp(uDay, 0.0, 1.0)), a);
      diffuseColor.a = max(diffuseColor.a, a);
    }
  }
  // frozen over in deep winter: pale, milky, cracked here and there
  float crack = smoothstep(0.96, 1.0, abs(sin(vWP2.x*0.37+sin(vWP2.z*0.21)*2.0)*cos(vWP2.z*0.29-vWP2.x*0.11)));
  vec3 ice = mix(vec3(0.80, 0.88, 0.92), vec3(0.55, 0.66, 0.74), crack * 0.6) * (0.5 + 0.5 * max(uDay, 0.3));
  outgoingLight = mix(outgoingLight, ice, uIce * 0.85);
  diffuseColor.a = mix(diffuseColor.a, 0.97, uIce);
}
#include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => 'tq-river-v4';
  return m;
}

export function Water() {
  const mat = useMemo(waterMaterial, []);
  useFrame((st) => {
    WATER_U.uTime.value = st.clock.elapsedTime;
    const sh = mat.userData.sh;
    if (sh) sh.uniforms.uIce.value = ICE.amt;
  });
  return (
    <mesh position={[0, WATER_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1} material={mat}>
      <planeGeometry args={[WORLD_R * 2 + 200, WORLD_R * 2 + 200, 1, 1]} />
    </mesh>
  );
}

// ================================================================ along the river
/** a small seeded random, so the reeds and lotus stand in the same places every time */
function rnd(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/** places along the water that pass a test, on a grid with jitter */
function scatter(step: number, test: (d: number, shore: number, flow: number, x: number, z: number) => number, seed: number) {
  const m = waterMap(), r = rnd(seed), out: [number, number, number][] = [];
  for (let z = -WORLD_R; z < WORLD_R; z += step)
    for (let x = -WORLD_R; x < WORLD_R; x += step) {
      const px = x + (r() - 0.5) * step, pz = z + (r() - 0.5) * step;
      const k = idx(px, pz);
      if (k < 0) continue;
      const d = m.depth[k];
      if (d < -0.6) continue;
      const p = test(d, m.shore[k], Math.hypot(m.fx[k], m.fz[k]), px, pz);
      if (p > 0 && r() < p) out.push([px, pz, r()]);
    }
  return out;
}

/** reed clumps: a dozen tapering blades and a few cattail heads, leaning, swaying in the wind */
function reedClump(): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], sway: number[] = [];
  const r = rnd(7);
  const blade = (bx: number, bz: number, h: number, w: number, lean: number, ang: number, tint: number) => {
    const segs = 4;
    const lx = Math.cos(ang) * lean, lz = Math.sin(ang) * lean;
    const px = -Math.sin(ang) * w, pz = Math.cos(ang) * w;
    for (let k = 0; k < segs; k++) {
      const t0 = k / segs, t1 = (k + 1) / segs;
      const c0 = t0 * t0, c1 = t1 * t1;
      const w0 = 1 - t0 * 0.9, w1 = 1 - t1 * 0.9;
      const a = [bx + lx * c0 - px * w0, h * t0, bz + lz * c0 - pz * w0];
      const b = [bx + lx * c0 + px * w0, h * t0, bz + lz * c0 + pz * w0];
      const c = [bx + lx * c1 - px * w1, h * t1, bz + lz * c1 - pz * w1];
      const d = [bx + lx * c1 + px * w1, h * t1, bz + lz * c1 + pz * w1];
      for (const v of [a, b, c, b, d, c]) {
        pos.push(...v);
        const shade = 0.55 + 0.45 * (v[1] / h);
        col.push(shade * tint, shade, shade * tint * 0.9);
        sway.push(v[1] / h);
      }
    }
  };
  for (let k = 0; k < 14; k++) {
    const a = r() * Math.PI * 2, rr = r() * 0.45;
    blade(Math.cos(a) * rr, Math.sin(a) * rr, 1.3 + r() * 1.1, 0.025 + r() * 0.02, 0.2 + r() * 0.45, r() * Math.PI * 2, 0.85 + r() * 0.3);
  }
  // cattail heads: a brown spindle on a thin stalk
  for (let k = 0; k < 3; k++) {
    const a = r() * Math.PI * 2, rr = r() * 0.35, x = Math.cos(a) * rr, z = Math.sin(a) * rr, h = 1.6 + r() * 0.6;
    blade(x, z, h, 0.008, 0.08, a, 0.9);
    const hx = x + Math.cos(a) * 0.08, hz = z + Math.sin(a) * 0.08;
    for (let s = 0; s < 6; s++) {
      const a0 = (s / 6) * Math.PI * 2, a1 = ((s + 1) / 6) * Math.PI * 2, R = 0.035;
      const y0 = h - 0.05, y1 = h + 0.22;
      const q = [
        [hx + Math.cos(a0) * R, y0, hz + Math.sin(a0) * R],
        [hx + Math.cos(a1) * R, y0, hz + Math.sin(a1) * R],
        [hx + Math.cos(a0) * R, y1, hz + Math.sin(a0) * R],
        [hx + Math.cos(a1) * R, y1, hz + Math.sin(a1) * R],
      ];
      for (const v of [q[0], q[1], q[2], q[1], q[3], q[2]]) {
        pos.push(...v);
        col.push(0.42, 0.26, 0.14);
        sway.push(1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 1));
  g.computeVertexNormals();
  return g;
}
function swayMaterial(base: THREE.MeshStandardMaterial, seasonal: boolean) {
  base.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = WATER_U.uTime;
    sh.uniforms.uSeason = SEASON_U.uSeason;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSway;\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vec4 iw = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
float ph = iw.x * 0.21 + iw.z * 0.17;
float bend = aSway * aSway;
transformed.x += (sin(uTime * 1.7 + ph) * 0.12 + sin(uTime * 3.1 + ph * 2.0) * 0.04) * bend;
transformed.z += (cos(uTime * 1.3 + ph) * 0.09) * bend;`,
      );
    if (seasonal)
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec4 uSeason;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
vec3 rg = diffuseColor.rgb;
vec3 autumn = vec3(dot(rg, vec3(0.5)) * 1.25, dot(rg, vec3(0.5)) * 1.0, dot(rg, vec3(0.5)) * 0.45);
vec3 winter = vec3(dot(rg, vec3(0.45))) * vec3(1.15, 1.08, 0.9);
diffuseColor.rgb = rg * (uSeason.x * vec3(0.9, 1.1, 0.8) + uSeason.y) + autumn * uSeason.z + winter * uSeason.w;`,
        );
  };
  base.customProgramCacheKey = () => 'tq-sway-' + seasonal;
  return base;
}

/** a lotus pad: a shallow cup cut by its notch, veins in the vertex shade */
function padGeometry() {
  const pos: number[] = [], col: number[] = [];
  const segs = 22, notch = 0.32;
  for (let s = 0; s < segs; s++) {
    const a0 = notch / 2 + (s / segs) * (Math.PI * 2 - notch), a1 = notch / 2 + ((s + 1) / segs) * (Math.PI * 2 - notch);
    const rim = (a: number) => [Math.cos(a), 0.06 + 0.03 * Math.sin(a * 5), Math.sin(a)];
    const c = [0, 0.02, 0], p0 = rim(a0), p1 = rim(a1);
    for (const v of [c, p1, p0]) {
      pos.push(...v);
      const vein = v === c ? 0.8 : 1;
      col.push(0.2 * vein, 0.42 * vein, 0.16 * vein);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
/** a lotus flower: two rings of pointed petals round a yellow heart (pink in summer; a seed head in autumn) */
function flowerGeometry() {
  const pos: number[] = [], col: number[] = [];
  const petal = (ang: number, tilt: number, len: number, w: number, y0: number) => {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const tip = [ca * len * Math.cos(tilt), y0 + len * Math.sin(tilt), sa * len * Math.cos(tilt)];
    const mid = (k: number) => {
      const r = len * 0.5;
      return [ca * r * Math.cos(tilt) - sa * w * k, y0 + r * Math.sin(tilt) * 0.9, sa * r * Math.cos(tilt) + ca * w * k];
    };
    const base = [0, y0, 0];
    for (const v of [base, mid(1), tip, base, tip, mid(-1)]) {
      pos.push(...v);
      const t = v === tip ? 1 : v === base ? 0 : 0.5;
      col.push(0.98, 0.78 - t * 0.38, 0.86 - t * 0.3);
    }
  };
  for (let k = 0; k < 8; k++) petal((k / 8) * Math.PI * 2, 0.55, 0.32, 0.09, 0.05);
  for (let k = 0; k < 6; k++) petal((k / 6) * Math.PI * 2 + 0.4, 1.0, 0.26, 0.075, 0.07);
  for (let s = 0; s < 8; s++) {
    const a0 = (s / 8) * Math.PI * 2, a1 = ((s + 1) / 8) * Math.PI * 2;
    for (const v of [[0, 0.16, 0], [Math.cos(a1) * 0.07, 0.12, Math.sin(a1) * 0.07], [Math.cos(a0) * 0.07, 0.12, Math.sin(a0) * 0.07]]) {
      pos.push(...v);
      col.push(0.95, 0.8, 0.25);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V3 = new THREE.Vector3(), S3 = new THREE.Vector3(), E = new THREE.Euler();
function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, list: { x: number; y: number; z: number; s: number; rot: number; tilt?: number }[]) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  m.count = list.length;
  list.forEach((p, i) => {
    E.set(p.tilt ?? 0, p.rot, 0);
    Q.setFromEuler(E);
    M4.compose(V3.set(p.x, p.y, p.z), Q, S3.setScalar(p.s));
    m.setMatrixAt(i, M4);
  });
  m.instanceMatrix.needsUpdate = true;
  m.frustumCulled = false;
  return m;
}

export function RiverLife({ sim }: { sim: Sim }) {
  const { camera } = useThree();
  const built = useMemo(() => {
    // reeds: in the shallows and on the wet bank, in patches
    const reeds = scatter(2.6, (d, _sh, _fl, x, z) => (d > -0.5 && d < 0.75 ? 0.5 + 0.5 * Math.sin(x * 0.05 + Math.cos(z * 0.043) * 3) : 0), 11)
      .filter(([x, z]) => Math.hypot(x, z) > 62)
      .map(([x, z, r]) => ({ x, y: Math.max(WATER_Y - 0.4, groundHeight(x, z)) - 0.05, z, s: 0.7 + r * 0.6, rot: r * 20 }));
    // lotus: in still water near the village (the first stretch of each river), pads in rafts with flowers among them
    const lot = scatter(1.7, (d, sh, fl, x, z) => (d > 0.5 && sh > 3 && fl < 0.85 && Math.hypot(x, z) < 420 ? 0.35 * (0.5 + 0.5 * Math.sin(x * 0.11) * Math.cos(z * 0.09)) : 0), 23);
    const pads = lot.map(([x, z, r]) => ({ x, y: WATER_Y + 0.03, z, s: 0.38 + r * 0.42, rot: r * 40 }));
    const flowers = lot.filter((_, i) => i % 5 === 0).map(([x, z, r]) => ({ x: x + 0.2, y: WATER_Y + 0.08, z: z - 0.1, s: 0.8 + r * 0.5, rot: r * 9 }));
    const reedMat = swayMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85, color: '#9fbf6a' }), true);
    const padMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.55 });
    padMat.onBeforeCompile = (sh) => {
      sh.uniforms.uSeason = SEASON_U.uSeason;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec4 uSeason;')
        .replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb = diffuseColor.rgb * (uSeason.x * vec3(1.1, 1.15, 0.9) + uSeason.y) + vec3(0.42, 0.33, 0.14) * uSeason.z + vec3(0.25, 0.22, 0.16) * uSeason.w;`);
    };
    const flowerMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6, emissive: '#3a1020', emissiveIntensity: 0.25 });
    return {
      reeds: instanced(reedClump(), reedMat, reeds),
      pads: instanced(padGeometry(), padMat, pads),
      flowers: instanced(flowerGeometry(), flowerMat, flowers),
      lanterns: lanterns(),
      mist: mist(),
      fish: fish(),
    };
  }, []);
  useFrame((_, dt) => {
    const c = sim.clock, sea = SEASON_U.uSeason.value;
    // lotus: pads from late spring, flowers in summer, none under winter's ice
    built.pads.visible = sea.w < 0.6 && ICE.amt < 0.5;
    built.flowers.visible = sea.y > 0.35;
    built.reeds.visible = true;
    stepLanterns(built.lanterns, sim, dt, camera);
    stepMist(built.mist, sim, camera, dt);
    stepFish(built.fish, sim, camera, dt);
    void c;
  });
  return (
    <>
      <primitive object={built.reeds} />
      <primitive object={built.pads} />
      <primitive object={built.flowers} />
      <primitive object={built.lanterns.group} />
      <primitive object={built.mist.group} />
      <primitive object={built.fish.group} />
    </>
  );
}

// ---------------------------------------------------------------- river lanterns: after dark they float down past the village
interface Lantern {
  x: number;
  z: number;
  bob: number;
  o: THREE.Object3D;
}
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
let GLOW: THREE.Texture | null = null;
const glow = () => (GLOW ??= glowTexture());
/** where lanterns are set on the water: the river cells nearest the village */
let LAUNCH: [number, number][] | null = null;
function launchSpots() {
  if (LAUNCH) return LAUNCH;
  const m = waterMap(), out: [number, number, number][] = [];
  for (let z = -300; z < 300; z += 6)
    for (let x = -300; x < 300; x += 6) {
      const k = idx(x, z);
      if (k < 0 || m.depth[k] < 1 || m.shore[k] < 6) continue;
      out.push([x, z, Math.hypot(x, z)]);
    }
  out.sort((a, b) => a[2] - b[2]);
  LAUNCH = out.slice(0, 40).map(([x, z]) => [x, z]);
  return LAUNCH;
}
function lanterns() {
  const group = new THREE.Group();
  const list: Lantern[] = [];
  const body = new THREE.CylinderGeometry(0.16, 0.22, 0.2, 8);
  const petals = flowerGeometry();
  const paper = new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ff9a3c', emissiveIntensity: 2.6, roughness: 0.8 });
  // the lantern's light laid on the water toward whoever looks at it: a long soft streak
  const streakTex = (() => {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 128;
    const x = c.getContext('2d')!;
    for (let j = 0; j < 128; j++) {
      const v = j / 127, a = Math.pow(1 - v, 1.6) * 0.9;
      const g = x.createLinearGradient(0, 0, 32, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, `rgba(255,255,255,${a.toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, j, 32, 1);
    }
    return new THREE.CanvasTexture(c);
  })();
  const streakGeo = new THREE.PlaneGeometry(0.9, 6).rotateX(-Math.PI / 2).translate(0, 0, 3);
  const petalMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: '#ff5a7a', emissiveIntensity: 0.6 });
  for (let k = 0; k < 14; k++) {
    const o = new THREE.Group();
    const b = new THREE.Mesh(body, paper);
    b.position.y = 0.16;
    const p = new THREE.Mesh(petals, petalMat);
    p.scale.setScalar(1.1);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: '#ffb35a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
    halo.scale.setScalar(3.4);
    halo.position.y = 0.3;
    const pool = new THREE.Mesh(new THREE.CircleGeometry(2.6, 20), new THREE.MeshBasicMaterial({ map: glow(), color: '#ff9a3c', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.02;
    const streak = new THREE.Mesh(streakGeo, new THREE.MeshBasicMaterial({ map: streakTex, color: '#ffa04a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
    streak.position.y = 0.03;
    streak.name = 'streak';
    o.add(b, p, halo, pool, streak);
    o.scale.setScalar(1.5);
    o.visible = false;
    group.add(o);
    list.push({ x: 0, z: 0, bob: Math.random() * 6, o });
  }
  return { group, list, on: 0 };
}
function stepLanterns(L: ReturnType<typeof lanterns>, sim: Sim, dt: number, camera: THREE.Camera) {
  const hour = sim.clock.hour, spots = launchSpots();
  const night = (hour >= 19 || hour < 1) && ICE.amt < 0.5 && spots.length > 0;
  const fest = !!sim.clock.festival;
  const want = night ? (fest ? L.list.length : 7) : 0;
  L.list.forEach((l, i) => {
    if (i >= want) {
      l.o.visible = false;
      return;
    }
    if (!l.o.visible) {
      const [x, z] = spots[Math.floor(Math.random() * spots.length)];
      l.x = x + (Math.random() - 0.5) * 4;
      l.z = z + (Math.random() - 0.5) * 4;
      l.o.visible = true;
    }
    const w = waterAt(l.x, l.z);
    if (w.d < 0.3 || Math.hypot(l.x, l.z) > 520) {
      l.o.visible = false; // drifted ashore or out of sight: set again upstream
      return;
    }
    const sp = 0.55 + Math.hypot(w.fx, w.fz) * 0.6;
    l.x += (w.fx * sp + Math.sin(sim.time * 0.3 + i) * 0.05) * dt;
    l.z += (w.fz * sp + Math.cos(sim.time * 0.27 + i) * 0.05) * dt;
    l.bob += dt;
    l.o.position.set(l.x, WATER_Y + 0.02 + Math.sin(l.bob * 1.8) * 0.03, l.z);
    // the streak runs from the lantern toward the eye (the group doesn't turn, so it stays put while the paper spins)
    const st = l.o.getObjectByName('streak');
    if (st) st.rotation.y = Math.atan2(camera.position.x - l.x, camera.position.z - l.z);
    l.o.children[0].rotation.y += dt * 0.1;
    l.o.children[1].rotation.y += dt * 0.1;
  });
}

// ---------------------------------------------------------------- mist on the water at dawn and at night
function mistTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  for (let k = 0; k < 40; k++) {
    const px = 30 + Math.random() * 68, py = 40 + Math.random() * 48, r = 14 + Math.random() * 26;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(c);
}
function mist() {
  const group = new THREE.Group();
  const tex = mistTexture();
  const list: { o: THREE.Sprite; x: number; z: number; life: number; max: number }[] = [];
  for (let k = 0; k < 18; k++) {
    const o = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, color: '#e8eef2' }));
    o.scale.set(26, 7, 1);
    group.add(o);
    list.push({ o, x: 0, z: 0, life: 0, max: 1 });
  }
  return { group, list };
}
function stepMist(M: ReturnType<typeof mist>, sim: Sim, camera: THREE.Camera, dt: number) {
  const h = sim.clock.hour, fogW = weatherMix(sim.weather, 'fog');
  const dawn = h >= 4.5 && h < 8.5 ? 1 - Math.abs(h - 6.3) / 2.2 : 0;
  const night = h >= 21 || h < 4 ? 0.55 : 0;
  const k = Math.max(dawn, night, fogW) * (1 - ICE.amt);
  for (const m of M.list) {
    m.life -= dt;
    if (m.life <= 0) {
      // a new wisp on the water somewhere ahead of the camera
      for (let t = 0; t < 8; t++) {
        const a = Math.random() * Math.PI * 2, r = 20 + Math.random() * 120;
        const x = camera.position.x + Math.cos(a) * r, z = camera.position.z + Math.sin(a) * r;
        if (waterAt(x, z).d > 0.6) {
          m.x = x;
          m.z = z;
          m.max = m.life = 14 + Math.random() * 12;
          break;
        }
      }
      if (m.life <= 0) m.life = 2;
    }
    const w = waterAt(m.x, m.z);
    m.x += w.fx * 0.4 * dt;
    m.z += w.fz * 0.4 * dt;
    const a = m.max > 0 ? Math.sin((1 - m.life / m.max) * Math.PI) : 0;
    (m.o.material as THREE.SpriteMaterial).opacity = a * k * 0.75;
    m.o.position.set(m.x, WATER_Y + 1.6, m.z);
    m.o.visible = k > 0.01;
  }
}

// ---------------------------------------------------------------- a carp leaping near you now and then
function fishGeometry() {
  const g = new THREE.SphereGeometry(0.12, 10, 6);
  g.scale(2.4, 0.9, 0.7);
  const tail = new THREE.ConeGeometry(0.11, 0.2, 4);
  tail.rotateZ(Math.PI / 2);
  tail.translate(-0.36, 0, 0);
  const merged = new THREE.BufferGeometry();
  const a = g.toNonIndexed(), b = tail.toNonIndexed();
  const pa = a.getAttribute('position').array as Float32Array, pb = b.getAttribute('position').array as Float32Array;
  const pos = new Float32Array(pa.length + pb.length);
  pos.set(pa);
  pos.set(pb, pa.length);
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  merged.computeVertexNormals();
  return merged;
}
function fish() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#e0702a', roughness: 0.35, metalness: 0.2 });
  const o = new THREE.Mesh(fishGeometry(), mat);
  o.visible = false;
  const ringMat = new THREE.MeshBasicMaterial({ color: '#dff2ff', transparent: true, opacity: 0, depthWrite: false });
  const rings = [0, 1].map(() => {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32), ringMat.clone());
    r.rotation.x = -Math.PI / 2;
    group.add(r);
    return { r, t: 9 };
  });
  group.add(o);
  return { group, o, rings, t: 0, wait: 6, from: new THREE.Vector3(), to: new THREE.Vector3(), dur: 1, gold: false };
}
function stepFish(F: ReturnType<typeof fish>, sim: Sim, camera: THREE.Camera, dt: number) {
  for (const r of F.rings) {
    r.t += dt;
    const k = r.t / 1.6;
    r.r.visible = k < 1;
    if (k < 1) {
      r.r.scale.setScalar(0.3 + k * 1.6);
      (r.r.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.55;
    }
  }
  if (!F.o.visible) {
    F.wait -= dt;
    if (F.wait > 0 || ICE.amt > 0.3) return;
    F.wait = 5 + Math.random() * 9;
    for (let t = 0; t < 10; t++) {
      const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 30;
      const x = camera.position.x + Math.cos(a) * r, z = camera.position.z + Math.sin(a) * r;
      const w = waterAt(x, z);
      if (w.d < 0.9) continue;
      const b = Math.random() * Math.PI * 2, len = 1.2 + Math.random() * 1.2;
      F.from.set(x, WATER_Y, z);
      F.to.set(x + Math.cos(b) * len, WATER_Y, z + Math.sin(b) * len);
      F.dur = 0.75 + Math.random() * 0.3;
      F.t = 0;
      F.gold = Math.random() < 0.3;
      (F.o.material as THREE.MeshStandardMaterial).color.set(F.gold ? '#f2c14e' : Math.random() < 0.5 ? '#e0702a' : '#e9e3d8');
      F.o.visible = true;
      F.rings[0].r.position.set(x, WATER_Y + 0.02, z);
      F.rings[0].t = 0;
      return;
    }
    return;
  }
  F.t += dt;
  const k = F.t / F.dur;
  if (k >= 1) {
    F.o.visible = false;
    F.rings[1].r.position.set(F.to.x, WATER_Y + 0.02, F.to.z);
    F.rings[1].t = 0;
    return;
  }
  const y = Math.sin(k * Math.PI) * 0.9;
  F.o.position.lerpVectors(F.from, F.to, k);
  F.o.position.y = WATER_Y + y;
  F.o.lookAt(F.to.x, WATER_Y + Math.cos(k * Math.PI) * 0.9, F.to.z);
  F.o.rotateY(-Math.PI / 2);
  F.o.rotateZ(Math.cos(k * Math.PI) * 0.9);
  void sim;
}

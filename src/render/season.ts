// What the seasons and the weather do to every surface, as shared shader uniforms the climate updates each frame:
// uSeason (spring, summer, autumn, winter weights, blended across the turn of a season), uSnowCover (snow lying on
// whatever faces up), uWet (rain-darkened, a little glossy). `withSnow` adds the lying snow and the wet to any
// standard material, keeping whatever shader patch it already has.
import * as THREE from 'three';

export const SEASON_U = {
  uSeason: { value: new THREE.Vector4(1, 0, 0, 0) },
  uSnowCover: { value: 0 },
  uWet: { value: 0 },
};

const SNOW_GLSL = `
vec3 tqWN = inverseTransformDirection(normal, viewMatrix);
float tqUp = smoothstep(0.35, 0.85, tqWN.y);
diffuseColor.rgb *= 1.0 - uWet * 0.22 * tqUp;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.90, 0.93, 0.98), clamp(uSnowCover * tqUp * 1.15, 0.0, 0.92));
#include <emissivemap_fragment>`;

/** lying snow and rain-wet on a material's upward faces (chained after its own onBeforeCompile) */
export function withSnow<M extends THREE.Material>(m: M): M {
  if ((m as any).userData?.tqSnow) return m;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    sh.uniforms.uSnowCover = SEASON_U.uSnowCover;
    sh.uniforms.uWet = SEASON_U.uWet;
    if (!sh.fragmentShader.includes('uniform float uSnowCover;')) sh.fragmentShader = 'uniform float uSnowCover;\nuniform float uWet;\n' + sh.fragmentShader;
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', SNOW_GLSL);
  };
  const key = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => (key ? key() : '') + '|snow';
  (m.userData ||= {}).tqSnow = true;
  m.needsUpdate = true;
  return m;
}

/** the season blend for a point in the year: each season fully itself, easing into the next over its last third */
export function seasonWeights(season: number, seasonT: number, out: THREE.Vector4) {
  const b = THREE.MathUtils.smoothstep(seasonT, 0.66, 1);
  const w = [0, 0, 0, 0];
  w[season] = 1 - b;
  w[(season + 1) % 4] += b;
  return out.set(w[0], w[1], w[2], w[3]);
}

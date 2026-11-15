// A giant's warnings (game/giants.ts sim.teles): a red mark on the ground for every blow on its way, the shape of where
// it lands (a disc, a ring, a fan, a strip), its edge bright, filling from the middle as the moment comes; a white flash
// in its last tenth of a second.
import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Sim } from '../game/sim';
import type { Tele } from '../game/giants';

const VS = `uniform float uS; varying vec2 vP; void main(){ vP = position.xy * uS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// uShape 0 disc, 1 ring, 2 fan, 3 strip; vP in metres in the mark's own frame (y forward)
const FS = `uniform float uShape; uniform float uR; uniform float uR2; uniform float uK; uniform vec3 uC; uniform float uT;
varying vec2 vP;
void main(){
  float d = length(vP), inside = 0.0, edge = 0.0, fill = 0.0;
  if (uShape < 0.5) { inside = step(d, uR); edge = smoothstep(uR - 0.35, uR, d) * inside; fill = step(d, uR * uK); }
  else if (uShape < 1.5) { inside = step(d, uR) * step(uR2, d); edge = (smoothstep(uR - 0.35, uR, d) + 1.0 - smoothstep(uR2, uR2 + 0.35, d)) * inside;
    fill = step(d, uR2 + (uR - uR2) * uK) * inside; }
  else if (uShape < 2.5) { float a = abs(atan(vP.x, vP.y)); inside = step(d, uR) * step(a, uR2);
    edge = max(smoothstep(uR - 0.4, uR, d), smoothstep(uR2 - 0.05, uR2, a)) * inside; fill = step(d, uR * uK) * inside; }
  else { inside = step(abs(vP.x), uR2) * step(-1.0, vP.y) * step(vP.y, uR);
    edge = max(smoothstep(uR2 - 0.3, uR2, abs(vP.x)), smoothstep(uR - 0.4, uR, vP.y)) * inside; fill = step(vP.y, -1.0 + (uR + 1.0) * uK) * inside; }
  if (inside < 0.5) discard;
  float stripes = 0.5 + 0.5 * sin((d - uT * 3.0) * 4.0);
  float a = 0.16 + 0.14 * stripes + edge * 0.6 + fill * 0.32;
  vec3 c = mix(uC, vec3(1.0), smoothstep(0.9, 1.0, uK) * 0.8);
  gl_FragColor = vec4(c * 1.4, a);
}`;

const SHAPE: Record<Tele['shape'], number> = { circle: 0, ring: 1, cone: 2, line: 3 };

export function Telegraphs({ sim }: { sim: Sim }) {
  const pool = useMemo(() => {
    const group = new THREE.Group();
    const items: THREE.Mesh[] = [];
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.ShaderMaterial({
          uniforms: { uS: { value: 1 }, uShape: { value: 0 }, uR: { value: 1 }, uR2: { value: 0 }, uK: { value: 0 }, uC: { value: new THREE.Color('#ff3b2f') }, uT: { value: 0 } },
          vertexShader: VS,
          fragmentShader: FS,
          transparent: true,
          depthWrite: false,
          toneMapped: false,
          polygonOffset: true,
          polygonOffsetFactor: -4,
        }),
      );
      m.rotation.order = 'YXZ';
      m.visible = false;
      m.renderOrder = 4;
      group.add(m);
      items.push(m);
    }
    return { group, items };
  }, []);
  useFrame((state) => {
    const T = sim.teles;
    pool.items.forEach((m, i) => {
      const t = T[i];
      if (!t || t.t > t.wind + 0.15) {
        m.visible = false;
        return;
      }
      m.visible = true;
      const u = (m.material as THREE.ShaderMaterial).uniforms;
      u.uShape.value = SHAPE[t.shape];
      u.uR.value = t.r;
      u.uR2.value = t.r2;
      u.uK.value = Math.min(1, t.t / t.wind);
      u.uT.value = state.clock.elapsedTime;
      (u.uC.value as THREE.Color).set(t.color);
      // a plane big enough for the shape, lying on the ground, turned to point where the blow goes
      const size = t.shape === 'line' ? 2 * Math.max(t.r + 2, t.r2 + 1) : t.r * 2 + 1;
      m.scale.set(size, size, 1);
      u.uS.value = size; // the shader works in metres
      // the plane's own y is the mark's forward: face it along (-sin yaw, -cos yaw)
      m.rotation.set(-Math.PI / 2, t.yaw, 0);
      m.position.set(t.x, sim.floorAt(t.x, t.z) + 0.12, t.z);
    });
  });
  return <primitive object={pool.group} />;
}

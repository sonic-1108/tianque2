// Tripo props come in dark (baked texture, little light in the shadow side): the stone gates especially read as
// black shapes. Their materials get a share of their own texture back as glow.
import * as THREE from 'three';
import { withSnow } from './season';

const LIFT: Record<string, number> = { 'paifang.glb': 0.55, 'pavilion.glb': 0.25, 'house.glb': 0.15, 'paifang-b.glb': 0.5, 'pavilion-b.glb': 0.2, 'watchtower.glb': 0.15, 'well.glb': 0.2 };
export function liftProp(scene: THREE.Object3D, file: string) {
  // snow lies on every prop's roof and ledges in winter, rain darkens them
  scene.traverse((o: any) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m?.isMeshStandardMaterial) withSnow(m);
  });
  const k = LIFT[file];
  if (!k) return;
  scene.traverse((o: any) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m?.isMeshStandardMaterial) continue;
      m.emissive = new THREE.Color('#ffffff');
      m.emissiveMap = m.map ?? null;
      m.emissiveIntensity = m.map ? k : k * 0.3;
      m.needsUpdate = true;
    }
  });
}

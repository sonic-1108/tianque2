// Measures every model in public/props and public/models (bounding box in model units, and a slice of its footprint
// at knee height for open things: columns) and writes src/game/propdims.json, which the pure game code uses for
// collision. Run after adding a model: npx tsx tools/propdims.mts
import * as fs from 'fs';
import * as path from 'path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
(globalThis as any).self = globalThis;
const out: Record<string, { min: number[]; max: number[] }> = {};
const load = (file: string) =>
  new Promise<THREE.Object3D>((res, rej) => {
    const buf = fs.readFileSync(file);
    const l = new GLTFLoader();
    l.setMeshoptDecoder(MeshoptDecoder);
    l.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (g) => res(g.scene), rej);
  });
for (const dir of ['public/props', 'public/models']) {
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.glb')).sort()) {
    try {
      const s = await load(path.join(dir, f));
      s.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(s);
      out[f] = { min: b.min.toArray().map((v) => +v.toFixed(4)), max: b.max.toArray().map((v) => +v.toFixed(4)) };
    } catch (e) {
      console.log('skip', f, String(e).slice(0, 80));
    }
  }
}
fs.writeFileSync('src/game/propdims.json', JSON.stringify(out, null, 1));
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(22), v.min.map((x) => x.toFixed(2)).join(','), '|', v.max.map((x) => x.toFixed(2)).join(','));

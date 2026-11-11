// Words over heads: the market's criers calling their wares, the dog's bark, the ox's low, the boar's snort.
// A few sprites reused for whoever is calling near the player; each text is drawn once onto a canvas and kept.
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Sim } from '../game/sim';
import { ALL_FOLK } from '../game/interiors';
import { ANIMALS } from '../game/animals';

const texCache = new Map<string, { tex: THREE.CanvasTexture; aspect: number }>();
function textTex(text: string) {
  let t = texCache.get(text);
  if (!t) {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    const font = '600 44px "Noto Serif SC", "Songti SC", "STSong", serif';
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 44;
    c.width = w;
    c.height = 76;
    ctx.font = font;
    // a paper slip with an ink border
    ctx.fillStyle = 'rgba(250, 244, 228, 0.92)';
    ctx.strokeStyle = 'rgba(70, 48, 30, 0.85)';
    ctx.lineWidth = 3;
    const r = 18;
    ctx.beginPath();
    ctx.roundRect(2, 2, w - 4, 72, r);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3b2a1a';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 22, 40);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    t = { tex, aspect: w / 76 };
    texCache.set(text, t);
  }
  return t;
}

const N = 6;
const CRY_R = 16;
const PERIOD = 8;
const SHOWN = 3.6;
/** how tall the speaker stands (children and grannies are shorter), for where the slip floats */
export const SPEAKER_H: Record<string, number> = {
  'npc-girl.glb': 1.2, 'npc-boy.glb': 1.35, 'npc-kid2.glb': 1.22, 'npc-novice.glb': 1.6,
  'npc-granny.glb': 1.5, 'npc-oldman.glb': 1.62, 'npc-beggar.glb': 1.68,
  'npc-lady.glb': 1.64, 'npc-courtesan.glb': 1.63, 'npc-dancer.glb': 1.62, 'npc-princess.glb': 1.64, 'npc-maid.glb': 1.58, 'npc-nun.glb': 1.63, 'npc-merchantwoman.glb': 1.58,
  'npc-butcher.glb': 1.9, 'npc-general.glb': 1.92, 'npc-palaceguard.glb': 1.84, 'npc-noodle.glb': 1.72,
};

export function Calls({ sim }: { sim: Sim }) {
  const sprites = useMemo(
    () =>
      Array.from({ length: N }, () => {
        const m = new THREE.SpriteMaterial({ transparent: true, depthWrite: false, fog: false });
        const s = new THREE.Sprite(m);
        s.visible = false;
        s.renderOrder = 10;
        return s;
      }),
    [],
  );
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const p = sim.player.pos;
    const out: { x: number; y: number; z: number; text: string; d: number }[] = [];
    if (sim.player.hp > 0) {
      // the folk who cry their wares (indoors too: the tavern's girl sings)
      for (const f of sim.fighters) {
        const i = (f as any).folk;
        if (i === undefined) continue;
        const cry = ALL_FOLK[i].cry;
        if (!cry?.length || sim.dialog === f.id || (f as any).away) continue;
        // those who keep hours call only while at it (the stall open, the watchman on his round)
        if (ALL_FOLK[i].life && !(f as any).plan?.cry) continue;
        const d = Math.hypot(f.pos[0] - p[0], f.pos[2] - p[2]);
        if (d > CRY_R) continue;
        const ph = sim.time + i * 2.7;
        if (ph % PERIOD > SHOWN) continue;
        out.push({ x: f.pos[0], y: f.pos[1] + (SPEAKER_H[f.model] ?? 1.8) + 0.45, z: f.pos[2], text: cry[Math.floor(ph / PERIOD) % cry.length], d });
      }
      for (const b of sim.bubbles) {
        const d = Math.hypot(b.x - p[0], b.z - p[2]);
        if (d < 60) out.push({ x: b.x, y: b.y, z: b.z, text: b.text, d: d * 0.5 });
      }
      for (const a of sim.animals) {
        if (a.sayT <= 0) continue;
        const d = Math.hypot(a.x - p[0], a.z - p[2]);
        if (d < 30) out.push({ x: a.x, y: a.y + ANIMALS[a.kind].h + 0.35, z: a.z, text: a.say, d });
      }
    }
    out.sort((a, b) => a.d - b.d);
    sprites.forEach((s, k) => {
      const c = out[k];
      s.visible = !!c;
      if (!c) return;
      const t = textTex(c.text);
      const m = s.material as THREE.SpriteMaterial;
      if (m.map !== t.tex) {
        m.map = t.tex;
        m.needsUpdate = true;
      }
      const h = 0.42 * Math.min(1.8, Math.max(0.8, c.d * 0.07));
      s.scale.set(h * t.aspect, h, 1);
      s.position.set(c.x, c.y, c.z);
    });
  });
  return (
    <group ref={group}>
      {sprites.map((s, k) => (
        <primitive key={k} object={s} />
      ))}
    </group>
  );
}

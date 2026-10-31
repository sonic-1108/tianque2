// One fighter's body: the model (Tripo + Mixamo rig), its clips, the clip for what the sim says it's doing.
// Every model shares the Mixamo skeleton, so a model without moves of its own borrows another's.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { GLTFLoader, SkeletonUtils, MeshoptDecoder } from 'three-stdlib';
import type { Fighter } from '../game/types';
import type { Sim } from '../game/sim';

const BASE = import.meta.env.BASE_URL + 'models/';
const TARGET_H = 1.8;
const FPS = 24;
/** models whose own clips are few: fighting moves come from these */
const CLIP_SOURCE: Record<string, string[]> = {
  'wanderer_m.glb': ['shadowblade.glb'],
  'trader.glb': ['berserker.glb'],
  'dixian.glb': ['berserker.glb'],
  'emperor.glb': ['berserker.glb'],
};

interface Spec {
  match: string[];
  start?: number;
  end?: number;
  loop?: boolean;
  fit?: boolean; // stretch to the act's duration
  speed?: number;
}
const PLAN: Record<string, Spec> = {
  idle: { match: ['standing_relax', 'idle', 'wait'], loop: true },
  run: { match: ['run'], loop: true },
  jump: { match: ['jump'], start: 0.0, end: 0.2 },
  dodge: { match: ['dive', 'flip'], start: 0.36, end: 0.92, fit: true },
  attack_1: { match: ['box_01', 'slash'], start: 0.1, end: 0.48, fit: true },
  attack_2: { match: ['box_03', 'box_02', 'slash'], start: 0.12, end: 0.47, fit: true },
  attack_3: { match: ['slash', 'chop'], start: 0.25, end: 0.52, fit: true },
  throw: { match: ['pitch_baseball', 'shoot', 'box_01'], start: 0.3, end: 0.56, fit: true },
  hit: { match: ['hit_to_body_01', 'hit_to_side', 'hit_to_body_02'], start: 0, end: 0.75, fit: true },
  down: { match: ['hit_to_stomach', 'fall'], start: 0, end: 0.6, fit: true },
  dead: { match: ['defeat_02', 'fall', 'defeat_03'], start: 0.2, end: 0.9 },
  skill_slash: { match: ['slash', 'chop'], start: 0.2, end: 0.55, fit: true },
  skill_spin: { match: ['box_03', 'box_02', 'slash'], start: 0.15, end: 0.45, loop: true, speed: 1.8 },
  skill_dash: { match: ['run'], loop: true, speed: 2 },
  skill_throw: { match: ['pitch_baseball', 'shoot', 'box_01'], start: 0.3, end: 0.56, fit: true },
  skill_flip: { match: ['flip', 'dive'], start: 0.3, end: 0.75, fit: true },
  skill_palm: { match: ['cast_a_spell', 'box_02', 'box_01'], start: 0.3, end: 0.7, fit: true },
  skill_stomp: { match: ['angry_01', 'angry_03', 'agree'], start: 0.4, end: 0.8, fit: true },
  skill_spell: { match: ['cast_a_spell', 'cheer', 'agree'], start: 0.2, end: 0.8, loop: true, speed: 0.8 },
  skill_point: { match: ['angry_02', 'cast_a_spell', 'box_01'], start: 0.4, end: 0.85, fit: true },
  skill_raise: { match: ['cheer', 'agree', 'cast_a_spell'], start: 0, end: 0.6, fit: true },
  glide: { match: ['jump', 'fall'], start: 0.15, end: 0.25, loop: true, speed: 0.3 },
  burrow: { match: ['sit', 'jump_down', 'dive'], start: 0.3, end: 0.5, loop: true, speed: 0.2 },
};

const loader = new GLTFLoader();
loader.setMeshoptDecoder(typeof MeshoptDecoder === 'function' ? (MeshoptDecoder as any)() : MeshoptDecoder);
interface Loaded {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
  scale: number;
  floor: number;
}
const cache = new Map<string, Promise<Loaded>>();
function loadModel(file: string): Promise<Loaded> {
  let p = cache.get(file);
  if (!p) {
    p = new Promise<Loaded>((res, rej) =>
      loader.load(
        BASE + file,
        (g) => {
          g.scene.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(g.scene);
          const h = Math.max(0.1, box.max.y - box.min.y);
          const scale = TARGET_H / h;
          g.scene.traverse((o: any) => {
            if (o.isMesh) {
              o.castShadow = true;
              o.frustumCulled = false;
            }
          });
          res({ scene: g.scene, clips: g.animations ?? [], scale, floor: -box.min.y * scale });
        },
        undefined,
        rej,
      ),
    );
    cache.set(file, p);
  }
  return p;
}

/** hips keep their height but not their travel: the sim moves the body */
function noRootMotion(c: THREE.AnimationClip) {
  const out = c.clone();
  for (const t of out.tracks) {
    const n = t.name.toLowerCase();
    if (!n.endsWith('.position')) continue;
    if (!n.includes('hips')) continue;
    const v = t.values;
    for (let i = 0; i < v.length; i += 3) {
      v[i] = v[0];
      v[i + 2] = v[2];
    }
  }
  out.tracks = out.tracks.filter((t) => !t.name.toLowerCase().endsWith('.position') || t.name.toLowerCase().includes('hips'));
  return out;
}

function buildClips(raw: THREE.AnimationClip[]) {
  const clean = raw.map(noRootMotion);
  const out: Record<string, { clip: THREE.AnimationClip; spec: Spec }> = {};
  for (const [key, spec] of Object.entries(PLAN)) {
    let src: THREE.AnimationClip | undefined;
    for (const m of spec.match) {
      src = clean.find((c) => c.name.toLowerCase().replace(/\.\d+$/, '') === m) ?? clean.find((c) => c.name.toLowerCase().includes(m));
      if (src) break;
    }
    if (!src) continue;
    let clip = src;
    if (spec.start !== undefined && spec.end !== undefined) {
      const n = Math.round(src.duration * FPS);
      const a = Math.floor(spec.start * n);
      const b = Math.max(a + 2, Math.ceil(spec.end * n));
      clip = THREE.AnimationUtils.subclip(src, key, a, b, FPS);
    }
    out[key] = { clip, spec };
  }
  return out;
}

/** a plain 剑 for the 散人 */
function buildSword() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: '#dfe6ee', metalness: 0.9, roughness: 0.25 });
  const wood = new THREE.MeshStandardMaterial({ color: '#4a2f1d', roughness: 0.8 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.85, 0.008), steel);
  blade.position.y = 0.52;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.03), new THREE.MeshStandardMaterial({ color: '#b08d57', metalness: 0.7, roughness: 0.4 }));
  guard.position.y = 0.09;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 8), wood);
  grip.position.y = 0;
  g.add(blade, guard, grip);
  return g;
}

export function Rig({ sim, id }: { sim: Sim; id: number }) {
  const f = sim.fighters[id];
  const group = useRef<THREE.Group>(null);
  const [model, setModel] = useState<{ obj: THREE.Object3D; clips: ReturnType<typeof buildClips>; scale: number; floor: number } | null>(null);

  useEffect(() => {
    let alive = true;
    const extra = CLIP_SOURCE[f.model] ?? [];
    Promise.all([loadModel(f.model), ...extra.map(loadModel)])
      .then(([m, ...more]) => {
        if (!alive) return;
        const obj = SkeletonUtils.clone(m.scene);
        // own clips first, borrowed ones fill the gaps
        const raw = [...m.clips, ...more.flatMap((x) => x.clips.filter((c) => !m.clips.some((o) => o.name === c.name)))];
        if (f.team === 'player') {
          let hand: THREE.Object3D | null = null;
          obj.traverse((o) => {
            if (!hand && /righthand$/i.test(o.name.replace(/[^a-z]/gi, ''))) hand = o;
          });
          if (hand) {
            const sw = buildSword();
            sw.scale.setScalar(1 / m.scale);
            sw.rotation.x = Math.PI / 2;
            (hand as THREE.Object3D).add(sw);
          }
        }
        setModel({ obj, clips: buildClips(raw), scale: m.scale, floor: m.floor });
      })
      .catch((e) => console.warn('[tq2] model', f.model, e));
    return () => {
      alive = false;
    };
  }, [f.model, f.team]);

  const mixer = useMemo(() => (model ? new THREE.AnimationMixer(model.obj) : null), [model]);
  const actions = useMemo(() => {
    const out: Record<string, THREE.AnimationAction> = {};
    if (!mixer || !model) return out;
    for (const [k, { clip, spec }] of Object.entries(model.clips)) {
      const a = mixer.clipAction(clip);
      a.setLoop(spec.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      a.clampWhenFinished = !spec.loop;
      out[k] = a;
    }
    actions_play(out, 'idle');
    return out;
  }, [mixer, model]);
  const cur = useRef('idle');
  const lastAct = useRef<{ act: string; anim: string; t: number }>({ act: '', anim: '', t: 0 });

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const p = sim.player;
    const far = Math.hypot(f.pos[0] - p.pos[0], f.pos[2] - p.pos[2]) > 95;
    g.visible = !far && !(f.team !== 'player' && f.hp <= 0 && f.actT > 3); // the fallen fade from the field until they come back
    if (!g.visible) return;
    g.position.set(f.pos[0], f.pos[1] - (f.act === 'burrow' ? 1.3 : 0), f.pos[2]);
    g.rotation.y = f.yaw + Math.PI;
    if (!mixer) return;
    // which clip: the anim key, falling back to something close
    let key = f.anim;
    if (!actions[key]) key = key.startsWith('skill') ? 'skill_slash' : key === 'channel' ? 'skill_spell' : 'idle';
    if (!actions[key]) key = 'idle';
    const restarted = f.act !== lastAct.current.act || f.anim !== lastAct.current.anim || f.actT < lastAct.current.t - 0.01;
    lastAct.current = { act: f.act, anim: f.anim, t: f.actT };
    if (key !== cur.current || (restarted && !PLAN[key]?.loop)) {
      const next = actions[key];
      const prev = actions[cur.current];
      if (next) {
        next.reset();
        const spec = PLAN[key];
        let ts = spec?.speed ?? 1;
        if (spec?.fit && f.actDur > 0) ts = next.getClip().duration / f.actDur;
        next.setEffectiveTimeScale(ts);
        next.setEffectiveWeight(1);
        next.play();
        if (prev && prev !== next) next.crossFadeFrom(prev, key === 'dead' || key === 'hit' ? 0.06 : 0.12, false);
      }
      cur.current = key;
    }
    if (key === 'run') {
      const sp = Math.hypot(f.vel[0], f.vel[2]);
      actions.run?.setEffectiveTimeScale(Math.max(0.6, Math.min(1.6, sp / 6)));
    }
    mixer.update(dt);
  });

  return (
    <group ref={group}>
      {model && <primitive object={model.obj} scale={model.scale} position={[0, model.floor, 0]} />}
      {!model && (
        <mesh position={[0, 0.9, 0]} castShadow>
          <capsuleGeometry args={[0.35, 1.1, 4, 8]} />
          <meshStandardMaterial color={f.team === 'player' ? '#d6c7a1' : '#666'} />
        </mesh>
      )}
    </group>
  );
}

function actions_play(a: Record<string, THREE.AnimationAction>, k: string) {
  a[k]?.play();
}

// One fighter's body: the model (Tripo + Mixamo rig), its clips, the clip for what the sim says it's doing.
// Every model shares the Mixamo skeleton, so a model without moves of its own borrows another's.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { GLTFLoader, SkeletonUtils, MeshoptDecoder } from 'three-stdlib';
import type { Fighter } from '../game/types';
import { KIT_FLY } from '../game/kit';
import type { Sim } from '../game/sim';
import { heroWeapons, weaponsFor } from './weapons';
import { buildUmbrella, type Umbrella } from './umbrella';
import { applyGlidePose, collectLimbs, fistCentre, type Limbs } from './climbPose';
import { applyCharacterShading } from './characterShading';
import { SPEAKER_H } from './Calls';

/** Tripo's rigged townsfolk (npc-*.glb): they face +x, and carry their own idle and walk (nothing to fight with) */
const isTownsfolk = (m: string) => m.startsWith('npc-');
/** Tripo bodies for everyone who fights and isn't one of the seven houses (owner: only the houses wear the houses'
 *  looks): each fights the way a house does, borrowing that house's clips, plan and weapons; they face +x too */
export const BODY_AS: Record<string, string> = {
  'foe-bandit.glb': 'berserker.glb', 'boss-leibiao.glb': 'berserker.glb', 'comp-shimeng.glb': 'berserker.glb',
  'foe-thief.glb': 'ranger.glb', 'comp-feiyan.glb': 'ranger.glb',
  'foe-monk.glb': 'monk.glb', 'comp-liaochen.glb': 'monk.glb',
  'foe-assassin.glb': 'shadowblade.glb', 'boss-wumian.glb': 'shadowblade.glb', 'comp-mohan.glb': 'shadowblade.glb', 'ally-militia.glb': 'shadowblade.glb',
  'foe-merchant.glb': 'trader.glb',
  'foe-taoist.glb': 'dixian.glb', 'boss-xuanyin.glb': 'dixian.glb',
  // the added houses' heroes
  'hero-jianke.glb': 'emperor.glb', 'hero-fushi.glb': 'emperor.glb',
  'hero-qiangwang.glb': 'berserker.glb', 'hero-shuangdao.glb': 'berserker.glb',
  'hero-quanshi.glb': 'monk.glb', 'hero-qinshi.glb': 'monk.glb', 'hero-qizong.glb': 'monk.glb',
  'hero-yushou.glb': 'dixian.glb',
  'hero-duzong.glb': 'ranger.glb', 'hero-gongshou.glb': 'ranger.glb',
  'hero-jiguan.glb': 'trader.glb',
};
// a borrowed house clip carries the house's own facing, so these bodies play only borrowed clips and need no turn
const facesX = (m: string) => isTownsfolk(m);
const TOWN_PLAN: Record<string, Spec> = { idle: { match: ['idle'], loop: true }, run: { match: ['walk'], loop: true } };

const BASE = import.meta.env.BASE_URL + 'models/';
/** the player's blade, base and tip, for the ribbon trail (set when his model is in) */
export const swordSockets: { base: THREE.Object3D | null; tip: THREE.Object3D | null } = { base: null, tip: null };
const TARGET_H = 1.8;
const FPS = 24;
/** models whose own clips are few: fighting moves come from these */
const CLIP_SOURCE: Record<string, string[]> = {
  'wanderer_m.glb': ['shadowblade.glb', 'monk.glb'], // the monk fills in the cheers, claps and stamps the 散人 borrows
  'trader.glb': ['berserker.glb'],
  'dixian.glb': ['berserker.glb'],
  'emperor.glb': ['berserker.glb'],
  'guard.glb': ['emperor.glb', 'berserker.glb'],
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
  // ---- each move with the clip 天阙 1 gave it (its CharacterRig3D plans), whoever borrows it
  kr_cleave: { match: ['slash', 'chop'], start: 0.25, end: 0.52, fit: true },
  kr_spin: { match: ['box_03', 'box_02', 'slash'], start: 0.15, end: 0.45, loop: true, speed: 1.6 },
  kr_charge: { match: ['run'], loop: true, speed: 1.9 },
  kr_roar: { match: ['angry_01', 'angry_03', 'cheer'], start: 0.52, end: 0.82, fit: true },
  kr_ult_air: { match: ['jump', 'flip'], start: 0.0, end: 0.17, speed: 0.35 },
  kr_ult_slam: { match: ['slash', 'chop'], start: 0.27, end: 0.56 },
  aq_boomerang: { match: ['slash', 'chop'], start: 0.22, end: 0.42, fit: true },
  aq_pin: { match: ['pitch_baseball', 'chop', 'box_01'], start: 0.3, end: 0.54, fit: true },
  aq_flip: { match: ['flip', 'jump', 'dive'], start: 0.0, end: 0.3, fit: true },
  aq_aim: { match: ['angry_02', 'agree', 'shoot'], start: 0.0, end: 0.3, speed: 0.6 },
  aq_shot: { match: ['shoot', 'pitch_baseball', 'box_01'], start: 0.3, end: 0.56, fit: true },
  aq_rain: { match: ['box_01', 'box_03', 'pitch_baseball'], start: 0.08, end: 0.32, loop: true, speed: 2.2 },
  fy_palm: { match: ['cast_a_spell', 'box_02'], start: 0.3, end: 0.72, fit: true },
  fy_zen: { match: ['angry_01', 'angry_03'], start: 0.42, end: 0.8, fit: true },
  fy_chant: { match: ['clap', 'bow', 'agree'], start: 0.08, end: 0.85, fit: true },
  fy_bell: { match: ['angry_01', 'angry_03'], start: 0.3, end: 0.68, fit: true },
  fy_ult: { match: ['sit', 'clap', 'standing_relax'], start: 0.3, end: 0.75, loop: true, speed: 0.3 },
  yr_step: { match: ['slash', 'chop'], start: 0.28, end: 0.5, fit: true },
  yr_knives: { match: ['pitch_baseball', 'shoot'], start: 0.3, end: 0.56, fit: true },
  yr_chain: { match: ['cast_a_spell', 'agree'], start: 0.25, end: 0.6, fit: true },
  yr_ult: { match: ['slash', 'chop'], start: 0.25, end: 0.5, loop: true, speed: 2.2 },
  tz_edict: { match: ['angry_02', 'cast_a_spell'], start: 0.42, end: 0.88, fit: true },
  tz_guard: { match: ['cheer', 'agree'], start: 0.0, end: 0.6, fit: true },
  tz_seal: { match: ['angry_03', 'angry_01'], start: 0.3, end: 0.8, fit: true },
  tz_cage: { match: ['slash', 'chop'], start: 0.22, end: 0.56, fit: true },
  tz_dragon: { match: ['angry_01', 'cheer'], start: 0.3, end: 0.78, fit: true },
  jy_throw: { match: ['box_02', 'box_03', 'pitch_baseball', 'angry_02'], start: 0.12, end: 0.47, fit: true },
  jy_cash: { match: ['angry_01', 'agree'], start: 0.52, end: 0.82, fit: true },
  jy_point: { match: ['angry_02', 'angry_01'], start: 0.4, end: 0.85, fit: true },
  dx_breeze: { match: ['cheer', 'agree'], start: 0.0, end: 0.5, fit: true },
  dx_drain: { match: ['agree', 'cast_a_spell'], start: 0.0, end: 0.6, fit: true },
  dx_spring: { match: ['angry_03', 'angry_01'], start: 0.3, end: 0.8, fit: true },
  dx_fold: { match: ['run'], loop: true, speed: 1.8 },
  dx_ult: { match: ['cheer', 'agree'], start: 0.0, end: 0.6, fit: true },
  burrow: { match: ['sit', 'jump_down', 'dive'], start: 0.3, end: 0.5, loop: true, speed: 0.2 },
};

/** each house fights its own way (the old game's per-hero clip choices) */
const PLAN_BY_MODEL: Record<string, Record<string, Spec>> = {
  'ranger.glb': {
    attack_1: { match: ['box_01', 'throw', 'punch'], start: 0.08, end: 0.32, fit: true },
    attack_2: { match: ['box_03', 'box_02', 'throw'], start: 0.12, end: 0.4, fit: true },
    attack_3: { match: ['pitch_baseball', 'throw', 'slash'], start: 0.3, end: 0.54, fit: true },
    dodge: { match: ['roll', 'dodge', 'dive', 'flip'], start: 0.36, end: 0.92, fit: true },
  },
  'monk.glb': {
    attack_1: { match: ['box_01', 'punch'], start: 0.1, end: 0.48, fit: true },
    attack_2: { match: ['box_03', 'box_02', 'punch'], start: 0.12, end: 0.47, fit: true },
    attack_3: { match: ['cast_a_spell', 'box_02'], start: 0.28, end: 0.68, fit: true },
    skill_palm: { match: ['cast_a_spell', 'box_02'], start: 0.3, end: 0.72, fit: true },
    skill_spell: { match: ['clap', 'bow', 'agree'], start: 0.08, end: 0.85, loop: true, speed: 0.8 },
  },
  'shadowblade.glb': {
    attack_1: { match: ['box_01', 'slash'], start: 0.08, end: 0.4, fit: true },
    attack_2: { match: ['box_03', 'box_02', 'slash'], start: 0.12, end: 0.42, fit: true },
    attack_3: { match: ['slash', 'chop'], start: 0.25, end: 0.52, fit: true },
    burrow: { match: ['jump_down', 'dive'], start: 0.0, end: 0.35, loop: true, speed: 0.3 },
  },
  'emperor.glb': {
    skill_point: { match: ['angry_02'], start: 0.42, end: 0.88, fit: true },
    skill_raise: { match: ['cheer'], start: 0.0, end: 0.6, fit: true },
    skill_stomp: { match: ['angry_03'], start: 0.3, end: 0.8, fit: true },
  },
  'dixian.glb': {
    idle: { match: ['standing_relax', 'idle'], loop: true, speed: 0.7 },
    skill_spell: { match: ['cheer'], start: 0.0, end: 0.5, loop: true, speed: 0.7 },
    skill_stomp: { match: ['angry_03'], start: 0.3, end: 0.8, fit: true },
  },
};
const planOf = (model: string): Record<string, Spec> => {
  if (isTownsfolk(model)) return TOWN_PLAN;
  const as = BODY_AS[model] ?? model;
  return { ...PLAN, ...(PLAN_BY_MODEL[as] ?? (as === 'wanderer_m.glb' ? PLAN_BY_MODEL['shadowblade.glb'] : {})) };
};

/** flips and spins turn about the hips, not the feet */
const PIVOT = 0.95;
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
          const scale = (SPEAKER_H[file] ?? TARGET_H) / h;
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

function buildClips(raw: THREE.AnimationClip[], plan: Record<string, Spec> = PLAN) {
  const clean = raw.map(noRootMotion);
  const out: Record<string, { clip: THREE.AnimationClip; spec: Spec }> = {};
  for (const [key, spec] of Object.entries(plan)) {
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

export function Rig({ sim, id }: { sim: Sim; id: number }) {
  const f = sim.fighters[id];
  const group = useRef<THREE.Group>(null);
  const [model, setModel] = useState<{ obj: THREE.Object3D; clips: ReturnType<typeof buildClips>; scale: number; floor: number } | null>(null);

  useEffect(() => {
    let alive = true;
    const extra = BODY_AS[f.model] ? [BODY_AS[f.model], ...(CLIP_SOURCE[BODY_AS[f.model]] ?? [])] : CLIP_SOURCE[f.model] ?? [];
    Promise.all([loadModel(f.model), ...extra.map(loadModel)])
      .then(([m, ...more]) => {
        if (!alive) return;
        const obj = SkeletonUtils.clone(m.scene);
        // own clips first, borrowed ones fill the gaps
        const own = BODY_AS[f.model] ? [] : m.clips;
        const raw = [...own, ...more.flatMap((x) => x.clips.filter((c) => !own.some((o) => o.name === c.name)))];
        // each body holds its own weapon(s) (the old game's builders), in the Mixamo hand frame
        const bones: Record<string, THREE.Object3D> = {};
        obj.traverse((o) => {
          const n = o.name.toLowerCase().replace(/^mixamorig[:_]?/, '').replace(/[^a-z0-9]/g, '');
          if ((o as any).isBone && !bones[n]) bones[n] = o;
        });
        const glow = new THREE.Color(f.team === 'player' ? '#ff3b1f' : '#7dd3fc');
        const w: ReturnType<typeof heroWeapons> & {} = heroWeapons(f.model) ?? weaponsFor(BODY_AS[f.model] ?? f.model, glow);
        if ((f as any).folk !== undefined) w.right = w.left = w.staff = undefined as any; // villagers go unarmed
        const held: THREE.Object3D[] = [];
        if (w.right && bones.righthand) {
          w.right.rotation.set(0, 0, w.reverse ? -Math.PI / 2 : Math.PI / 2);
          w.right.position.set(0, 0.075, 0.025);
          bones.righthand.add(w.right);
          held.push(w.right);
        }
        if (w.left && bones.lefthand) {
          w.left.rotation.set(Math.PI, 0, w.reverse ? Math.PI / 2 : -Math.PI / 2);
          w.left.position.set(0, 0.075, 0.025);
          bones.lefthand.add(w.left);
          held.push(w.left);
        }
        if (w.staff && bones.righthand) {
          w.staff.rotation.set(Math.PI, 0, 0);
          w.staff.position.set(0, 0.36, 0.02);
          bones.righthand.add(w.staff);
          held.push(w.staff);
        }
        // a guqin across the back
        if (w.back && (bones.spine2 || bones.spine1)) {
          w.back.rotation.set(0, 0, Math.PI * 0.3);
          w.back.position.set(0, 0.05, -0.2);
          (bones.spine2 ?? bones.spine1).add(w.back);
          held.push(w.back);
        }
        if (f.team === 'player') {
          swordSockets.base = w.base;
          swordSockets.tip = w.tip;
        }
        (obj as any).userData.held = held;
        for (const h of held) h.traverse((o) => (o.userData.weapon = true));
        // the old game's character look: a soft fill from the viewer (faces never black), a coloured rim
        obj.traverse((o: any) => {
          if (!o.isMesh || !(o.material as any)?.isMeshStandardMaterial || o.userData.weapon) return;
          const mat = (o.material as THREE.MeshStandardMaterial).clone();
          mat.emissive = new THREE.Color('#000000');
          applyCharacterShading(mat, f.team === 'player', (BODY_AS[f.model] ?? f.model) === 'monk.glb');
          o.material = mat;
          ((obj as any).userData.mats ||= []).push(mat);
        });
        ((globalThis as any).__T2_OBJ ??= {})[f.id] = obj; // headless tests read bone positions
        setModel({ obj, clips: buildClips(raw, planOf(f.model)), scale: m.scale, floor: m.floor });
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
  // gliding (Patagonia 起飞): arms up on the straps of an umbrella-glider that opens over the head
  const glide = useMemo(() => {
    const umb: Umbrella = buildUmbrella();
    umb.group.visible = false;
    return { umb, limbs: null as Limbs | null, blend: 0, t: 0, a: new THREE.Vector3(), b: new THREE.Vector3(), fwd: new THREE.Vector3() };
  }, []);
  useEffect(() => {
    if (model) glide.limbs = collectLimbs(model.obj);
    const g = group.current;
    if (g) g.add(glide.umb.group);
    return () => {
      glide.umb.group.removeFromParent();
    };
  }, [model, glide]);
  const lastAct = useRef<{ act: string; anim: string; t: number }>({ act: '', anim: '', t: 0 });
  const pose = useRef<THREE.Group>(null);
  const body = useMemo(() => ({ spin: 0, lean: 0, lev: 0, lastHit: -1, jolt: 0, flash: 0, flashOn: false }), []);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const p = sim.player;
    const far = Math.hypot(f.pos[0] - p.pos[0], f.pos[2] - p.pos[2]) > 95;
    g.visible = !far && !(f as any).away && !(f as any).benched && !(f.team !== 'player' && f.hp <= 0 && f.actT > 3) && !(f.team === 'player' && f.run?.id === 'snipe'); // the fallen fade from the field until they come back; down your own scope your body would block it
    if (!g.visible) return;
    // in the saddle: sat up on the horse's back
    const saddle = f.id === 0 && sim.riding >= 0 ? 1.05 : 0;
    g.position.set(f.pos[0], f.pos[1] - (f.act === 'burrow' ? 1.3 : 0) + saddle, f.pos[2]);
    g.rotation.y = f.yaw + Math.PI;
    // struck: a white flash and a jolt back (on render time, so they play through the hit-stop)
    const ha = (f as any).hitAt;
    if (ha !== undefined && ha !== body.lastHit) {
      if (body.lastHit !== -1 || f.hp < f.maxHp) {
        const heavy = !!(f as any).hitHeavy;
        body.jolt = heavy ? 1 : 0.6;
        body.flash = heavy ? 1 : 0.75;
      }
      body.lastHit = ha;
    }
    if (body.jolt > 0.005) {
      g.position.x += Math.sin(f.yaw) * 0.22 * body.jolt;
      g.position.z += Math.cos(f.yaw) * 0.22 * body.jolt;
      body.jolt *= Math.exp(-dt * 11);
    }
    const mats: THREE.MeshStandardMaterial[] | undefined = (model?.obj as any)?.userData.mats;
    if (mats && (body.flash > 0.01 || body.flashOn)) {
      const k = body.flash > 0.01 ? body.flash * body.flash * 0.9 : 0;
      for (const m of mats) m.emissive.setRGB(k, k * 0.95, k * 0.85);
      body.flashOn = k > 0;
      body.flash *= Math.exp(-dt * 15);
    }
    if (!mixer) return;
    const held: THREE.Object3D[] | undefined = (model?.obj as any)?.userData.held;
    if (held?.length && !(model!.obj as any).userData.scaled) {
      // the hand bones carry the model's own scale: undo it so a weapon is its real size
      model!.obj.updateMatrixWorld(true);
      const sv = new THREE.Vector3();
      for (const h of held) {
        h.parent?.getWorldScale(sv);
        if (sv.x > 1e-4) h.scale.setScalar(1 / sv.x);
      }
      (model!.obj as any).userData.scaled = true;
    }
    // which clip: the anim key, falling back to something close
    let key = f.anim;
    if (f.id === 0 && sim.riding >= 0 && (key === 'run' || key === 'walk')) key = 'idle';
    if (!actions[key]) key = /^(skill|kr_|aq_|fy_|yr_|tz_|jy_|dx_)/.test(key) ? 'skill_slash' : key === 'channel' ? 'skill_spell' : 'idle';
    if (!actions[key]) key = 'idle';
    const restarted = f.act !== lastAct.current.act || f.anim !== lastAct.current.anim || f.actT < lastAct.current.t - 0.01;
    lastAct.current = { act: f.act, anim: f.anim, t: f.actT };
    if (key !== cur.current || (restarted && !planOf(f.model)[key]?.loop)) {
      const next = actions[key];
      const prev = actions[cur.current];
      if (next) {
        next.reset();
        const spec = planOf(f.model)[key];
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
      actions.run?.setEffectiveTimeScale(isTownsfolk(f.model) ? Math.max(0.5, Math.min(1.8, sp / 1.4)) : Math.max(0.6, Math.min(1.6, sp / 6)));
    }
    mixer.update(dt);
    // the whole-body layer 天阙 1 laid over the clips: the whirlwind's spin, somersaults, leaning into a charge,
    // the monk floating while he meditates
    const ps = pose.current;
    if (ps) {
      const rt = f.run?.t ?? 0;
      // a kit move that lifts its caster (game/kit.ts KIT_FLY): up over the first third of a second, down at the end
      const kf = f.run ? KIT_FLY[f.run.id] : undefined;
      let kUp = 0;
      if (kf) {
        const kt = rt - kf.charge, from = kf.from ?? 0.05, to = kf.to ?? kf.dur - 0.2;
        const ss = (a: number, b: number, x: number) => Math.max(0, Math.min(1, (x - a) / (b - a)));
        const e = (x: number) => x * x * (3 - 2 * x);
        kUp = e(ss(from, from + 0.35, kt)) * (1 - e(ss(to, to + 0.3, kt)));
      }
      if (f.anim === 'kr_spin') body.spin -= dt * 15;
      else if (kf?.spin && kUp > 0.05) body.spin -= dt * kf.spin * kUp;
      else body.spin += (Math.round(body.spin / (Math.PI * 2)) * Math.PI * 2 - body.spin) * Math.min(1, dt * 14);
      let flip = 0;
      if (f.anim === 'kr_ult_air') flip = -Math.min(1, rt / 0.55) * Math.PI * 2;
      else if (kf?.flip) flip = -Math.min(1, Math.max(0, rt - kf.charge - (kf.from ?? 0.05)) / 0.6) * Math.PI * 2;
      else if (f.anim === 'aq_flip') flip = Math.min(1, rt / 0.5) * Math.PI * 2;
      let lean = 0;
      if (f.anim === 'kr_charge') lean = 0.32;
      else if (f.anim === 'dx_fold') lean = 0.34;
      else if (f.act === 'hit') lean = -0.12;
      body.lean += (lean - body.lean) * Math.min(1, dt * 10);
      const lev = f.anim === 'fy_ult' ? 0.45 + Math.sin(performance.now() * 0.003) * 0.05 : kf ? kf.h * kUp + Math.sin(performance.now() * 0.004) * 0.08 * kUp : 0;
      body.lev += (lev - body.lev) * Math.min(1, dt * 6);
      ps.rotation.set(body.lean + flip - body.jolt * 0.28, body.spin, 0, 'YXZ');
      ps.position.y = PIVOT + body.lev;
    }
    // the glider: blend the arms up onto the straps, open the canopy above the fists
    const gliding = f.act === 'glide' && f.hp > 0;
    glide.blend += ((gliding ? 1 : 0) - glide.blend) * Math.min(1, dt * 8);
    glide.t = gliding ? glide.t + dt : 0;
    if (glide.limbs && glide.blend > 0.01) {
      const lift = Math.min(1, glide.t / 0.5);
      glide.fwd.set(-Math.sin(f.yaw), 0, -Math.cos(f.yaw));
      g.updateMatrixWorld(true);
      applyGlidePose(glide.limbs, glide.fwd, lift, glide.blend, performance.now() / 1000, 0.14);
      g.updateMatrixWorld(true);
      const u = glide.umb;
      u.group.visible = glide.blend > 0.15;
      fistCentre(glide.limbs, 0, glide.a);
      fistCentre(glide.limbs, 1, glide.b);
      g.worldToLocal(glide.a);
      g.worldToLocal(glide.b);
      const now = performance.now() / 1000;
      u.group.position.copy(glide.a).add(glide.b).multiplyScalar(0.5);
      u.group.position.y += 0.9;
      u.group.rotation.set(Math.sin(now * 3.6) * 0.05 * lift, 0, Math.sin(now * 2.7) * 0.06 * lift);
      // folded (a long narrow bundle) opening into the dome
      u.canopy.scale.set(THREE.MathUtils.lerp(0.1, 1, lift), THREE.MathUtils.lerp(2.4, 1, lift), THREE.MathUtils.lerp(0.1, 1, lift));
      u.shaft.scale.set(1, 1.08, 1);
    } else glide.umb.group.visible = false;
    // both hands are on the umbrella's shaft while gliding: the weapon they hold is put away (it used to poke out of the canopy)
    const stow = glide.umb.group.visible;
    if (held) for (const h of held) if (h.visible === stow) h.visible = !stow;
  });

  return (
    <group ref={group}>
      <group ref={pose} position={[0, PIVOT, 0]}>
        {model && <primitive object={model.obj} scale={model.scale} position={[0, model.floor - PIVOT, 0]} rotation={[0, facesX(f.model) ? -Math.PI / 2 : 0, 0]} />}
      </group>
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

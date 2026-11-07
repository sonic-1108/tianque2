// The page: the start screen until a path is chosen, then the 3D view with the HUD over it.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Sim } from './game/sim';
import { SKILLS } from './game/skills';
import { groundHeight } from './game/world';
import { chooseHero } from './game/progress';
import { Scene } from './render/Scene';
import { Hud } from './ui/Hud';
import { SkillTree, StartScreen } from './ui/Panels';
import { TQ_POS, TQ_ROAD, roadPoint, tqWorld } from './game/layout';
import { Dialog, ChapterCard, NoteCard, chapterDue } from './ui/Dialog';
import { attachInput, ui } from './input';

declare const __BUILD_TIME__: string;

export function App() {
  const sim = useMemo(() => new Sim(), []);
  const [started, setStarted] = useState(sim.progress.chosen);
  const [tree, setTree] = useState(false);
  const [tick, setTick] = useState(0);
  const [version, setVersion] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  (globalThis as any).__T2 = sim;
  (globalThis as any).__T2_SKILLS = SKILLS;
  (globalThis as any).__T2_GROUND = groundHeight;
  (globalThis as any).__T2_TQ = { c: TQ_POS, gate: tqWorld(0, 30), far: roadPoint(TQ_ROAD, 560), road: roadPoint(TQ_ROAD, 735) };
  const card = started && !tree && chapterDue(sim);
  const note = started && !tree && !!sim.note && !(globalThis as any).__T2_NOCARD;

  useEffect(() => {
    if (!started || !wrap.current) return;
    const canvas = wrap.current.querySelector('canvas');
    if (!canvas) return;
    return attachInput(canvas);
  }, [started]);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    ui.open = tree || !started || sim.dialog >= 0 || card || note;
    if (ui.open && document.pointerLockElement) document.exitPointerLock();
  }, [tree, started, tick >= 0 && sim.dialog >= 0, card, note]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!started) return;
      if (e.code === 'KeyK' || e.code === 'Tab') setTree((v) => !v);
      if (e.code === 'Escape') {
        setTree(false);
        sim.dialog = -1;
      }
      if (e.code === 'KeyF' && sim.dialog >= 0 && ui.open) sim.dialog = -1;
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [started]);

  return (
    <div ref={wrap} className="app">
      {started && (
        <>
          <Canvas
            shadows
            dpr={[1, 1.75]}
            camera={{ fov: 62, near: 0.15, far: 2000 }}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
            onCreated={({ gl }) => {
              gl.toneMapping = THREE.NoToneMapping; // the post pass does ACES
              gl.shadowMap.type = THREE.PCFShadowMap;
            }}
          >
            <Scene sim={sim} version={version} />
          </Canvas>
          <Hud sim={sim} tick={tick} />
          {sim.dialog >= 0 && !tree && <Dialog sim={sim} onClose={() => (sim.dialog = -1)} onChange={() => setTick((n) => n + 1)} />}
          {note && <NoteCard sim={sim} onClose={() => setTick((n) => n + 1)} />}
          {card && <ChapterCard sim={sim} onClose={() => setTick((n) => n + 1)} />}
          {tree && <SkillTree sim={sim} onClose={() => setTree(false)} onHero={() => setVersion((v) => v + 1)} />}
          {!document.pointerLockElement && !tree && <div className="lockhint">点击画面开始（锁定鼠标转视角）</div>}
          <div className="build">tianque2 · {new Date(__BUILD_TIME__).toLocaleString()}</div>
        </>
      )}
      {!started && (
        <StartScreen
          onPick={(hero) => {
            chooseHero(sim.progress, hero);
            sim.refreshPlayer();
            setVersion((v) => v + 1);
            setStarted(true);
            if (!Object.keys(sim.progress.skills).length) sim.toast('按 K 打开技能树，用技能点学第一招');
          }}
        />
      )}
    </div>
  );
}

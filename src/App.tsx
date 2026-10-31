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
    ui.open = tree || !started;
    if (ui.open && document.pointerLockElement) document.exitPointerLock();
  }, [tree, started]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!started) return;
      if (e.code === 'KeyK' || e.code === 'Tab') setTree((v) => !v);
      if (e.code === 'Escape') setTree(false);
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
            dpr={[1, 1.5]}
            camera={{ fov: 62, near: 0.1, far: 600 }}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
            onCreated={({ gl }) => {
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.shadowMap.type = THREE.PCFSoftShadowMap;
            }}
          >
            <Scene sim={sim} version={version} />
          </Canvas>
          <Hud sim={sim} tick={tick} />
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

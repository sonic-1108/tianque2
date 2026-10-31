# 天阙 · 散人行 (tianque2) — notes for Claude

A restart of 天阙 (old code: sonic-1108/tianque-assets, branch archive-v1). The owner talks in Chinese: reply in
Chinese, short, no dashes in prose, deploy quickly when asked, say plainly what was not tested.

## The game (owner's design, the 百业 way)
- Start screen: pick 散人 or one of 7 heroes. A hero learns only its five moves (levels 1-10; the 4th from Lv 10,
  the ultimate from Lv 30). A 散人 learns every house's three basic moves (levels 1-5), never an ultimate, and may
  转职 once at Lv 30. Skill points: 3 + 2 per level; levels 1-5 cost 1, 6-10 cost 2. K opens the skill tree.
- Ultimates must be held on R for 0.8 s (ULT_CHARGE); letting go or a hit cancels with nothing spent.
- Open map: village in the middle, bandit dens on three rings (src/game/foes.ts), harder further out, a boss den per ring.
- No sect camps or masters on the map (the owner said no).

## Code
- `src/game/`: pure logic, no React/three. `sim.ts` (Sim.step), `skills.ts` (all 35 moves as data + hooks),
  `progress.ts` (levels, points, save in localStorage `tq2_progress_v2`), `heroes.ts`, `foes.ts`, `world.ts` (terrain).
- `src/render/`: `Scene.tsx` (loop + camera), `Rig.tsx` (Mixamo models, clip plan), `World.tsx`, `Fx.tsx`.
- `src/ui/`: `Hud.tsx`, `Panels.tsx` (start screen, skill tree). `src/input.ts`.
- Models in `public/models` (Tripo + Mixamo rig); the 散人 borrows shadowblade.glb clips.

## Run / test / deploy
- `npm ci`, `npm run dev`, `npx tsc --noEmit -p .`.
- Headless (no GPU): `BASE=/ npx vite build --outDir /tmp/t2b`, `BASE=/ npx vite preview --outDir /tmp/t2b --port 4191`,
  `URL=http://localhost:4191/ node tools/tests/smoke.cjs` (every move) and `tools/tests/ai.cjs` (bandits fight, xp).
  Hooks: `__T2` (sim), `__T2_PRESS(code)`, `__T2_HOLD(code, on)`, `__T2_TURBO`.
- Deploy = push to `main` (GitHub Pages workflow). Site: https://sonic-1108.github.io/tianque2/
- Don't `pkill -f` a pattern that is in your own command line.

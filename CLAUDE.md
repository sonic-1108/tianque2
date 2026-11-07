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
- Names must fit the body (owner's rule): ranger.glb is a young woman (女飞贼, 杏娘, 秀兰), emperor.glb is only ever
  萧承乾 (`bossModel`; his men and kind 4 dens are 伪朝禁军 / 金甲卫 on guard.glb), trader.glb is a merchant (奸商),
  monk.glb a monk (僧医 · 慧明, 庙祝 · 慧觉), plain folk use wanderer_m.glb. Check portraits/ before naming anyone.
- Hit feel (owner wants it strong): every basic hit pushes (2.2), the third launches back (8, heavy); hit-stop 0.07 /
  0.12 s; a kill by the player adds `sim.slowmo`; struck bodies flash white and jolt back (Rig `hitAt`); the camera
  shakes and nudges along the blow (`juice.push`). Swings face the foe on the camera line, else anyone within 3.2 m.
- Difficulty (owner's rule): the men stay easy (x0.82 damage, x0.85 life); bosses can be hard. Bosses past ring 0
  ignore light hits (only heavy ones stagger); 雷彪 (ring 0) is softened and still reels.
- Collision knows height (world.ts): over a building's top nothing pushes (flying, gliding), tops are floors
  (`buildingFloor`, sim `floorAt(x, z, y)`), a box whose top is within `STEP_UP` (0.6) of your feet is a step.
  Open things block only by posts (pavilions `PAVILION_POSTS`, porches, sheds). Each place's solid parts are
  `PLACE_PARTS` (places.ts) and must match what Places.tsx draws; 天阙's terrace + stairs are in `TQ_PARTS`.
  Check with a headless walk (drop on a roof, glide over a house, up 天阙's stairs, into a pavilion).
- View: camera far 2000, fog 240 to 1500 (the rim and 天阙 show from the village). Worked stone and props glow a
  little of their own colour (`LIFT` in build.tsx, `render/propLook.ts`) so arches never read black.
- Places (`src/game/places.ts`, drawn by `render/Places.tsx`): beyond the village fence 张记铁铺, 杏花酒肆, 土地庙; a
  驿站 on every road (inn, two house.glb, fenced yard, 驿 on the minimap). `FOLK`: unarmed, unhurtable villagers and
  travellers who stand or stroll (`walk`), talk on F; innkeepers and 杏娘 heal (`heal`). Yards are levelled in rawHeight.
- 天阙古道 (`render/Gudao.tsx`, `GD_*` / `roadFrame` / `onGudao` in layout.ts): the last climb of road 4, tilted
  flagstones, a stone arch (天阙 board) and stele at its foot, stone lanterns, 望阙台 terrace with a pavilion.
- The story (`src/game/quests.ts`, the owner asked for one): 序章 青石村, 第一章 山雨欲来, 第二章 七家散落, 第三章 雪线之下,
  终章 天阙. You are the lost child of 天阙's keeper; ring bosses 雷彪, 玄阴真人, 无面; the last boss 伪帝 · 萧承乾 waits on
  天阙, a palace on a cliff mesa at the end of road 4 (`TQ_*` in layout.ts, mesa in world.ts rawHeight, footprints
  `TQ_PARTS` / `tqWall`, drawn by `render/Tianque.tsx`). Chapter cards (`ChapterCard` in ui/Dialog.tsx) open each chapter;
  headless tests set `__T2_NOCARD`. Story 3 added quests marked `v3` (story 2 saves keep their place via `fromStory2`;
  older ones restart the quest line, keeping level). Goals also `visit` (reach a spot) and `folk` (talk to one of FOLK);
  `direct` quests start without going back to the elder, `auto` ones hand themselves in and show `done` as a story card
  (`sim.note`, `NoteCard`). Story places: 断剑冢 (beside road 2, ring 1: find the sword's other half, 铁匠 reforges it,
  `relics: ['sword']` = +10% damage) and 守阙人之墓 (by the 古道 arch); 秀兰, 铁匠, 杏娘 have story talks; 尾声 card at the end.

## Code
- `src/game/`: pure logic, no React/three. `sim.ts` (Sim.step), `skills.ts` (all 35 moves as data + hooks, ported
  from 天阙 1: same timings, reach, damage, statuses; its `vfx.*` calls become `s.vfx(name, ...args)` commands in
  `sim.vq`, run by `Juice.tsx`; emperor effects by key: `emp.dragon/charge/cage/seal/edict/fan`),
  `progress.ts` (levels, points, save in localStorage `tq2_progress_v2`), `heroes.ts`, `foes.ts`, `world.ts` (terrain).
- `src/render/`: `Scene.tsx` (loop + camera, scope zoom), `Rig.tsx` (Mixamo models, clip plan: one key per move
  `kr_* aq_* fy_* yr_* tz_* jy_* dx_*` with 天阙 1's clip choices, plus a pose layer for spins, flips, leans,
  levitation), `World.tsx` (village dressing, den palisades: shapes merged per material by `build.tsx`), `Tianque.tsx`, `Juice.tsx` (effects, sounds, shake, projectile meshes), `HouseFx.tsx` (地仙 / 交易员
  world things drawn from zones), `vfx/` (天阙 1's VFXSystem, MonkFX, EmperorFX, ImperialFX, DragonFX; guard.glb).
- `src/ui/`: `Hud.tsx`, `Panels.tsx` (start screen, skill tree). `src/input.ts`.
- Models in `public/models` (Tripo + Mixamo rig); the 散人 borrows shadowblade.glb clips.

## Run / test / deploy
- `npm ci`, `npm run dev`, `npx tsc --noEmit -p .`.
- Headless (no GPU): `BASE=/ npx vite build --outDir /tmp/t2b`, `BASE=/ npx vite preview --outDir /tmp/t2b --port 4191`,
  `URL=http://localhost:4191/ node tools/tests/smoke.cjs` (every move) and `tools/tests/ai.cjs` (bandits fight, xp).
  巡检 (all start choices x walks to every den, every move in 14 situations, den fights, rules, soak):
  `npx tsx tools/sweep.ts` (~15 min, prints findings). Real software render screenshot: `tools/tests/shot.cjs` (SPOT=village|village2|den|far|tq|tqroad|tqfar).
  Hooks: `__T2` (sim), `__T2_PRESS(code)`, `__T2_HOLD(code, on)`, `__T2_TURBO`, `__T2_VFX`.
  Per move in plain node (dummy 5 m ahead, damage, first hit, statuses): `npx tsx tools/movecheck.ts [id ...]`.
  One move's effect really rendered: `MOVE=true_dragon AT=0.4,1.2 OUT=/path/x node tools/tests/fxshot.cjs` (effects
  run on sim time, so slow software frames still show the right moment).
- Deploy = push to `main` (GitHub Pages workflow). Site: https://sonic-1108.github.io/tianque2/
- Don't `pkill -f` a pattern that is in your own command line.

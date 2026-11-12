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
- M opens the full map (`ui/BigMap.tsx`: dens with names and levels, grey once cleared, places, quest star, you).
- Built shapes wear painted patterns (`render/surfaces.ts`: boards, cut stone, plaster, tiles, thatch, bark, sampled
  in world space from three sides, a shade per piece) so nothing reads as plain plastic; new materials get a
  `SURFACE` entry.
- Roofs (`Builder.roof`): curved hip roofs, steep under the ridge, easing flat to the eaves, corners swept up.
- Tripo: `.github/workflows/tripo.yml` makes a model from a prompt (`gh workflow run tripo.yml -f name=x -f prompt=...`)
  with the owner's repo secret TRIPO_API_KEY (never ask for it or print it) and pushes it to the `tripo-models`
  branch (`models/<name>.glb` + preview png). Review it there, then copy into public/props.
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

- Interiors (`src/game/interiors.ts`, drawn by `render/Interiors.tsx`): 16 rooms (7 village houses, 酒肆, 7 inns, 土地庙)
  entered by F at the door; rooms sit off map at x/z >= 3300, only the current one is drawn, walls and furniture are
  BUILDINGS. `ROOM_FOLK` live inside (`ALL_FOLK`). Test: scratch rooms.mts style headless walk through every door.
- Tripo props (`src/game/props.ts`, sizes from `propdims.json`, rerun `npx tsx tools/propdims.mts` after adding a glb):
  new Tripo models face +x and are centred, `fit()` gives scale, turn, lift, footprint. 青石集 market (10 stalls on road 0,
  teahouse at its end), watermill on the river, den tents and watchtowers (`DECOR`), village houses, gate, pavilions, well.
- Townsfolk models `npc-*.glb` (Tripo, rigged on Mixamo bones, own `idle` + `walk` clips, face +x: Rig turns them and
  uses `TOWN_PLAN`; heights in `SPEAKER_H`, render/Calls.tsx). Market keepers (`KEEPERS` in places.ts) and strollers;
  `cry` lines float over heads as paper slips (render/Calls.tsx). 清风茶楼 has a room (storyteller, tea tables).
- Animals (`src/game/animals.ts`, drawn by `render/Animals.tsx`): deer herds bolt together, rabbits, foxes flee, boars
  warn then charge (`sim.gore`, 9% life, never kills), oxen by the fence, the village dog follows you in the village.
  Only beasts within 150 m think. Tripo quadrupeds carry one walk clip; facing is worked out from head and tail bones.

- World clock and weather (`src/game/clock.ts`): a day is 15 min (`DAY_S`, owner's choice), a season 2 days (half an hour), a year 8 days, three solar terms a day, the era 承乾 (the year
  counts up from 三年); solar terms, festivals (`FESTIVALS` by day of year), weather spells picked per season (clear,
  cloudy, rain, storm, fog, snow; winter rain falls as snow), ground `wet` and lying `snow`. Saved in localStorage
  `tq2_world_v1`. Drawn by `render/Climate.tsx` (sun arc, moon and stars, cloud shell, fog, lightning, rain / snow /
  petals / leaves / fireflies round the camera) through shared uniforms in `render/season.ts` (`SEASON_U`, `withSnow`
  on Builder materials, props, trees, rocks; ground, grass and leaves have their own season blends in Terrain.tsx).
  The HUD shows date, watch and weather over the minimap. Test a moment: set `__T2.worldT` and `__T2.weather`.

- 永安城 · 朝廷 (`src/game/court.ts`, frame `ctWorld`, at the end of road 1, r 835): walls, the great gate (open
  between its piers: `posts` rows), 金銮殿 (a room: the empty dragon throne on its dais), drum tower, six ministries,
  lions, banners, the street 关厢 outside; paving and lanterns in World.tsx `buildCourt`; people in places.ts `COURT`.
  The plain is levelled in rawHeight (`CT_PAD`). Map props load when the camera comes near and hide past 320 / 720 m.
- More beasts: hens in the village, cranes in the palace yard, a horse at every waystation. 渔翁 by the river (`FISH_SPOT`).

- Folk lives (`src/game/life.ts`): a folk with `life` (stall, stroll, street, court, woodcutter, watchman, fisher) keeps
  hours: `planFor` says where (spot, evening spot, home door, nearest shelter in rain or snow) and what (`act`, shown
  in the talk hint and dialog); at home they're `away` (hidden, not talked to). Sim `live()` walks them there (a
  sidestep when blocked; out of the player's sight they're simply there; a trip over 50 s snaps when nobody's near).
  Festivals change hours (元宵 keeps the market open at night). `MORE` (places.ts) adds villagers, the 戏班 and a market crowd; `TRAVEL` folk
  have life `road` and a `route` of two road points: they walk legs by day and lodge at the nearest inn at night. Story folk (秀兰, 铁匠, 杏娘, healers, guards) have no
  life, so quests can always find them. Folk also remark on weather, season, festival and your deeds (`worldRemark`).
- 江湖志 (J): `sim.chronicle` writes the seasons, festivals, first snow, storms, chapters, bosses beaten and level
  milestones with their dates; saved with the world clock. Festival dressing in render/Festive.tsx (lanterns, fireworks).

- 玩法 (data in `src/game/economy.ts`, logic in `src/game/play.ts`, panels in `ui/Games.tsx`, map things in
  `render/Play.tsx`): 铜钱 (`progress.coins`, from kills, quests, games), `bag`, `done` flags, `titles` (名号). Stalls
  sell (`SHOPS`; food eaten at once, `whet` a 3 min damage boost, lantern and thrush are kept tools), buyers take fish
  and herbs (`BUYERS`), 委托 (`WANTS`: give a folk what they wish for; notice boards `BOARDS` list them). Things to
  touch (`touchable`): catch a hen, pick 血参 (glow red, back after a day), ride the waystation horse (x2.3, no
  fighting from the saddle), the drum tower. Games: fishing (渔翁), riddles (书摊, once a day; 灯笼匠 at 元宵), dice
  (钱八), 投壶 (茶博士), exam (礼部主事, once a year), cases at the drum (击鼓老汉, `CASES`), 朝议 in 金銮殿 (丞相,
  mornings: a `POLICY` stands three days: prices, bandit strength, horse speed), 演武 with 霍铮 (three bouts of the
  benched `sparPool` guards, they pull their blows). Keys: B bag, H 金疮药. Test: scratch play.mts.

- 冲突 (`src/game/conflict.ts`, drawn by `render/War.tsx`): `war.dread` 伪朝声势 (0 to 100, starts 15, +5 a day,
  shifted by 朝议 `POLICY_DREAD`, -4 a routed patrol, -7 a razed checkpoint, -6 / +8 a raid won / lost, -15 a ring
  boss). Tiers: 20 patrols of three march the post roads, 40 checkpoints (关卡, three men and a 校尉 across a road at
  r 330), 60 天阙税 (prices x1.2), 80 the dark. Every third night (`raidNight`) raiders warn at dusk and fall on
  青石村 at 21:00 in three waves; unopposed raiders at the house doors burn the village (bar on the HUD); won:
  next day a feast (half price) and a title; lost: the stalls stay shut a day. Folk run indoors during a raid.
  The men come from benched pools (`makePools`, `mode` patrol / post / raid / hunt in the bandit AI). Test: scratch war.mts.
- 追杀 (owner: something must come for you): out on the land (not the village, the court plain, a room) a band of
  three runs at you from behind every two or three minutes (faster at night and as 声势 grows): 截道的山贼 by day,
  夜行刺客 by night, 金甲卫 from 声势 40. Wipe them for coins; get 140 m away or into the village and they go.
  声势 now starts at 30 (old saves raised to 30 once, `war.v2`), raids every other night (and the first evening).
- 青石村 stockade (`src/game/village.ts`, drawn by `render/Stockade.tsx`): sharpened log wall at `WALL_R` 64 (solid runs
  in `WALL_RUNS`), a gate with two towers and the 青石村 board on every road (`GATE_A`, `GATE_TOWERS`). Inside: the
  houses, the square, 铁铺 / 酒肆 / 土地庙, the fields, and the Tripo yard things `VILLAGE_PROPS` (placed once each
  file is in propdims). 青石集 is outside the east gate (road 0, r 74 to 162). Test: scratch wall.mts.
- Townsfolk style (owner's rule): realistic like the heroes (portraits/), never cartoon. Tripo prompts end with the
  realistic style line and the workflow's `negative` input (cartoon, chibi, stylized, big head ...).

- 江湖 (`src/game/jianghu.ts`, owner asked for all of it): gear `GEAR` forged by 铁匠 · 张大锤 (panel `forge`, worn on
  weapon / armour / charm, changed at the smithy or the home rack `gear`; `gearOf` feeds power, damage taken, life
  `fullHp`, speed, mp, leech); materials 铁料 / 兽皮 / 玄铁 drop from foes (`dropFrom`) and the hunt. 悬赏榜 `RIVALS`: ten
  named wanderers walk their stretch of road (`mode: 'rival'`, elite), on the notice boards and the big map (悬); the five
  good ones join when beaten and become companions (team `ally`, `allyThink`: follow / wait / home, max 2 following, 好感
  from kills and gifts, three story cards at 30 / 60 / 100). Bandits pick the nearest of you and your allies. Village
  growth `VLEVELS` (pts from raids won/lost, posts, patrols, bosses, bounties): new folk with `vlvl`, two 乡勇 militia
  (wanderer_m, hold the gates from level 2), stone wall and gate board 青石城 at level 3 (Stockade). 擂台 at court
  (擂台官 · 包金刚, second day of each season, five bouts, prize 金丝软甲). Seasons: river ice in deep winter (`ICE` in
  world.ts: floorAt and the water shader), firefly glades on summer nights, the hunt with a 猎弓 (from 猎户 · 韩老三,
  F at game in front within 26 m, autumn doubles), seasonal fish. Your house (`HOME` in village.ts, drawn by
  render/Home.tsx, room theme `home`): bought at its sale board for 300, bed sleeps to dawn, rack changes gear.
  Test: scratch jh.mts.
- `Builder.roof` once moved its dark underside twice (every roof's underside floated at double its x, y, z); fixed.

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

// Headless logic test (no GPU): WebGL draws stubbed. Starts a run, learns moves, fights, casts every move.
//   BASE=/ npx vite build --outDir /tmp/t2b && npx vite preview --outDir /tmp/t2b --port 4190
//   URL=http://localhost:4190/ node tools/tests/smoke.cjs
const { chromium } = require(process.env.PW || '/opt/npm-tools/node_modules/playwright/index.js');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 300)));
  p.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text().slice(0, 200)));
  await p.addInitScript(() => { for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) { const P = C.prototype; for (const f of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) if (P[f]) P[f] = function () {}; P.compileShader = function () {}; P.linkProgram = function () {}; const gsp = P.getShaderParameter; P.getShaderParameter = function (s, pn) { return pn === this.COMPILE_STATUS ? true : gsp.call(this, s, pn); }; P.getProgramParameter = function (pr, pn) { if (pn === this.LINK_STATUS || pn === 0x8B82) return true; return 0; }; P.getShaderInfoLog = () => ''; P.getProgramInfoLog = () => ''; } localStorage.clear(); });
  await p.goto((process.env.URL || 'http://localhost:4190/') + '?silent=1');
  await p.waitForSelector('.pick');
  await p.click(process.env.HERO ? `.pick:nth-child(${2 + ['Berserker','Ranger','BuddhistMage','Shadowblade','Emperor','Trader','HeavyHealer'].indexOf(process.env.HERO)})` : '.pick.wanderer');
  await p.waitForFunction(() => globalThis.__T2?.time > 1, null, { timeout: 120000 });
  const r = await p.evaluate(async () => {
    const S = globalThis.__T2;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const waitG = async (sec) => { const t0 = S.time; for (let k = 0; k < 2000 && S.time - t0 < sec; k++) await wait(16); };
    const out = { fighters: S.fighters.length, moves: {}, bad: [] };
    const me = S.player;
    // walk forward (W) for 1 s
    const x0 = me.pos[0], z0 = me.pos[2];
    globalThis.__T2_HOLD('KeyW', true); await waitG(1); globalThis.__T2_HOLD('KeyW', false);
    out.walked = +Math.hypot(me.pos[0] - x0, me.pos[2] - z0).toFixed(1);
    // a level-30 player with all points, so every move can be learned
    S.progress.level = 30; me.level = 30;
    return out;
  });
  // learn + cast each move through the real code paths
  const r2 = await p.evaluate(async () => {
    const S = globalThis.__T2;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const waitG = async (sec) => { const t0 = S.time; for (let k = 0; k < 3000 && S.time - t0 < sec; k++) await wait(16); };
    const me = S.player;
    const P = S.progress;
    const bar = P.bar;
    const res = {};
    const foe = S.fighters.find((f) => f.team === 'sect');
    const all = Object.keys(globalThis.__T2_SKILLS || {});
    for (const id of all) {
      if (!(P.skills[id] > 0)) P.skills[id] = 1;
      me.pos = [0, 0, 0]; me.pos[1] = 0; me.vel = [0, 0, 0]; me.run = null; me.act = 'idle'; me.actT = 0; me.actDur = 0; me.mp = 100; me.cds = {}; me.st.invuln = 0; me.hp = me.maxHp;
      const g = (globalThis.__T2_GROUND || ((x, z) => 0));
      me.pos[1] = g(0, 0);
      foe.hp = foe.maxHp; foe.pos = [0, g(0, -5), -5]; foe.vel = [0, 0, 0]; foe.st.invuln = 0; foe.home = [0, -5]; foe.run = null; foe.act = 'idle'; foe.aiT = 99; foe.respawn = undefined;
      me.yaw = 0;
      const hp0 = foe.hp, my0 = me.hp - 0;
      const isUlt = globalThis.__T2_SKILLS[id].ult;
      if (isUlt) { bar[5] = id; globalThis.__T2_HOLD('KeyR', true); globalThis.__T2_PRESS('KeyR'); await waitG(1.0); globalThis.__T2_HOLD('KeyR', false); }
      else { bar[0] = id; globalThis.__T2_PRESS('Digit1'); }
      let maxd = 0;
      for (let k = 0; k < 30; k++) { await waitG(0.1); foe.aiT = 99; maxd = Math.max(maxd, Math.hypot(me.pos[0], me.pos[2])); }
      res[id] = { dmg: Math.round(hp0 - foe.hp), cd: +(me.cds[id] || 0).toFixed(1), act: me.act, moved: +maxd.toFixed(1), healed: me.hp >= my0 };
    }
    return res;
  });
  console.log(JSON.stringify(r));
  for (const [k, v] of Object.entries(r2)) console.log(k.padEnd(22), JSON.stringify(v));
  if (errs.length) console.log('ERRORS', [...new Set(errs)].join('\n'));
  await b.close();
})();

// The bandits fight back: stand the player in the first den and watch for 12 s; then kill one for experience.
const { chromium } = require(process.env.PW || '/opt/npm-tools/node_modules/playwright/index.js');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 300)));
  await p.addInitScript(() => { for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) { const P = C.prototype; for (const f of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) if (P[f]) P[f] = function () {}; P.compileShader = function () {}; P.linkProgram = function () {}; const gsp = P.getShaderParameter; P.getShaderParameter = function (s, pn) { return pn === this.COMPILE_STATUS ? true : gsp.call(this, s, pn); }; P.getProgramParameter = function (pr, pn) { if (pn === this.LINK_STATUS || pn === 0x8B82) return true; return 0; }; P.getShaderInfoLog = () => ''; P.getProgramInfoLog = () => ''; } localStorage.clear(); });
  await p.goto((process.env.URL || 'http://localhost:4191/') + '?silent=1');
  await p.waitForSelector('.pick');
  await p.click('.pick.wanderer');
  await p.waitForFunction(() => globalThis.__T2?.time > 1, null, { timeout: 120000 });
  const r = await p.evaluate(async () => {
    const S = globalThis.__T2;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const waitG = async (sec) => { const t0 = S.time; for (let k = 0; k < 4000 && S.time - t0 < sec; k++) await wait(16); };
    const me = S.player;
    const foes = S.fighters.filter((f) => f.team === 'sect' && f.den === 0);
    const [hx, hz] = foes[0].home;
    me.pos = [hx + 3, globalThis.__T2_GROUND(hx + 3, hz), hz];
    const hp0 = me.hp;
    const acts = new Set();
    for (let k = 0; k < 60; k++) { await waitG(0.2); foes.forEach((f) => acts.add(f.anim)); if (me.hp <= 0) break; }
    const took = Math.round(hp0 - me.hp);
    // now kill one with basic attacks
    me.hp = me.maxHp; me.respawn = undefined; me.act = 'idle'; me.actDur = 0; me.st.invuln = 99;
    const t = foes[0];
    t.hp = 5;
    const lvl0 = S.progress.level, xp0 = S.progress.xp;
    for (let k = 0; k < 20 && t.hp > 0; k++) { me.pos = [t.pos[0], t.pos[1], t.pos[2] + 1.5]; me.yaw = 0; globalThis.__T2_PRESS('Mouse0'); await waitG(0.25); }
    return { took, aggro: foes.map((f) => f.aggro), anims: [...acts], killed: t.hp <= 0, xp: [lvl0, xp0, S.progress.level, S.progress.xp], toasts: S.toasts.map((x) => x.text) };
  });
  console.log(JSON.stringify(r, null, 1));
  if (errs.length) console.log('ERRORS', [...new Set(errs)].join('\n'));
  await b.close();
})();

// Every start choice in a real page: the models load, no errors, the HUD comes up.
const { chromium } = require(process.env.PW || '/opt/npm-tools/node_modules/playwright/index.js');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  for (let k = 0; k < 8; k++) {
    const p = await b.newPage({ viewport: { width: 640, height: 360 } });
    const errs = [];
    const bad = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
    p.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errs.push(m.text().slice(0, 200)));
    p.on('response', (r) => r.status() >= 400 && bad.push(r.status() + ' ' + r.url()));
    await p.addInitScript(() => { for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) { const P = C.prototype; for (const f of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) if (P[f]) P[f] = function () {}; P.compileShader = function () {}; P.linkProgram = function () {}; const gsp = P.getShaderParameter; P.getShaderParameter = function (s, pn) { return pn === this.COMPILE_STATUS ? true : gsp.call(this, s, pn); }; P.getProgramParameter = function (pr, pn) { if (pn === this.LINK_STATUS || pn === 0x8B82) return true; return 0; }; P.getShaderInfoLog = () => ''; P.getProgramInfoLog = () => ''; } localStorage.clear(); });
    await p.goto((process.env.URL || 'http://localhost:4191/') + '?silent=1');
    await p.waitForSelector('.pick');
    await p.click(`.pick:nth-child(${k + 1})`);
    await p.waitForFunction(() => globalThis.__T2?.time > 3, null, { timeout: 180000 }).catch(() => errs.push('sim never ran'));
    await new Promise((r) => setTimeout(r, 8000));
    const st = await p.evaluate(() => ({ name: globalThis.__T2.player.name, model: globalThis.__T2.player.model, hud: !!document.querySelector('.skillbar'), t: +globalThis.__T2.time.toFixed(1) }));
    // open and close the skill tree
    await p.keyboard.press('KeyK');
    const tree = await p.evaluate(() => document.querySelectorAll('.panel .card').length);
    await p.keyboard.press('KeyK');
    console.log(k, JSON.stringify(st), 'cards', tree, bad.length ? 'HTTP ' + bad.join(' ') : '', errs.length ? 'ERR ' + [...new Set(errs)].join(' | ') : '');
    await p.close();
  }
  await b.close();
})();

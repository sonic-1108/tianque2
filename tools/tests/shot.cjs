// Real software render (slow): a screenshot from the player's camera. SPOT=village|den|far
const { chromium } = require(process.env.PW || '/opt/npm-tools/node_modules/playwright/index.js');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  p.on('pageerror', (e) => console.log('PE', e.message.slice(0, 200)));
  await p.addInitScript(() => localStorage.clear());
  await p.goto((process.env.URL || 'http://localhost:4192/') + '?silent=1');
  await p.waitForSelector('.pick');
  await p.click(`.pick:nth-child(${+(process.env.PICK || 1)})`);
  await p.waitForFunction(() => globalThis.__T2?.time > 0.5, null, { timeout: 300000 });
  await p.evaluate((spot) => {
    const S = globalThis.__T2;
    const me = S.player;
    if (spot === 'den') { const f = S.fighters.find((f) => f.team === 'sect'); me.pos = [f.home[0] + 7, me.pos[1], f.home[1] + 3]; me.st.invuln = 999; }
    if (spot === 'far') { me.pos = [120, me.pos[1], 60]; }
    me.pos[1] = globalThis.__T2_GROUND(me.pos[0], me.pos[2]);
  }, process.env.SPOT || 'village');
  await new Promise((r) => setTimeout(r, +(process.env.WAIT || 60000)));
  await p.screenshot({ timeout: 180000, path: process.env.OUT || '/tmp/shot.png' });
  console.log('t', await p.evaluate(() => globalThis.__T2.time.toFixed(1)));
  await b.close();
})();

// Real software render of one move's effect: MOVE=true_dragon AT=1.3 (sim seconds after the press) OUT=/tmp/x.png
//   (slow: swiftshader). The player stands in the open with a dummy bandit 6 m ahead.
const { chromium } = require(process.env.PW || '/opt/npm-tools/node_modules/playwright/index.js');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: +(process.env.VW || 800), height: Math.round(+(process.env.VW || 800) * 0.5625) } });
  p.on('pageerror', (e) => console.log('PE', e.message.slice(0, 300)));
  p.on('console', (m) => m.type() === 'error' && console.log('CE', m.text().slice(0, 200)));
  await p.addInitScript(() => { localStorage.clear(); globalThis.__T2_NOCARD = true; });
  await p.goto((process.env.URL || 'http://localhost:4201/') + '?silent=1');
  await p.waitForSelector('.pick');
  // HERO=Jianke picks that house (its body and weapons show); else the 散人
  if (process.env.HERO) {
    const i = await p.evaluate((h) => [...document.querySelectorAll('.pick')].findIndex((b) => b.textContent.includes(h)), process.env.HERO);
    await p.locator('.pick').nth(i < 0 ? 0 : i).click();
  } else await p.click('.pick.wanderer');
  await p.waitForFunction(() => globalThis.__T2?.time > 0.5, null, { timeout: 300000 });
  const ats = (process.env.AT || '1').split(',').map(Number);
  await p.evaluate(([id, cam]) => {
    const S = globalThis.__T2;
    const me = S.player;
    const g = globalThis.__T2_GROUND;
    const X = 110, Z = 120;
    const C = globalThis.__T2_CAM; C.dist = cam[0]; C.pitch = cam[1]; C.yaw = cam[2];
    S.progress.level = 30; me.level = 30;
    S.progress.skills[id] = 1;
    const ult = globalThis.__T2_SKILLS[id].ult;
    S.progress.bar = Array(11).fill('');
    S.progress.bar[ult ? 10 : 0] = id;
    me.pos = [X, g(X, Z), Z]; me.yaw = 0; me.st.invuln = 0; me.mp = 100;
    const foe = S.fighters.find((f) => f.team === 'sect');
    foe.pos = [X, g(X, Z - 6), Z - 6]; foe.home = [X, Z - 6]; foe.master = true; foe.maxHp = foe.hp = 1e5; foe.yaw = Math.PI;
    for (const f of S.fighters) if (f.team === 'sect' && f !== foe) { f.hp = 0; f.respawn = 1e9; }
  }, [process.env.MOVE, (process.env.CAM || '3.6,0.18,0.6').split(',').map(Number)]);
  // hide the HUD so the shot shows the move
  await p.evaluate(() => {
    const cv = document.querySelector('canvas');
    for (const el of document.body.querySelectorAll('*')) if (!el.contains(cv) && !cv.contains(el) && el !== cv) el.style.visibility = 'hidden';
  });
  await new Promise((r) => setTimeout(r, 4000));
  const ult = await p.evaluate((id) => globalThis.__T2_SKILLS[id].ult, process.env.MOVE);
  const t0 = await p.evaluate((ult) => {
    if (ult) { globalThis.__T2_HOLD('KeyR', true); globalThis.__T2_PRESS('KeyR'); }
    else globalThis.__T2_PRESS('Digit1');
    return globalThis.__T2.time;
  }, ult);
  let k = 0;
  for (const at of ats) {
    await p.waitForFunction(([t0, at]) => globalThis.__T2.time - t0 >= at, [t0, at + (ult ? 0.8 : 0)], { timeout: 300000, polling: 16 });
    await p.screenshot({ timeout: 180000, path: (process.env.OUT || '/tmp/fx') + `_${k++}.png` });
  }
  if (ult) await p.evaluate(() => globalThis.__T2_HOLD('KeyR', false));
  console.log('ok', process.env.MOVE);
  await b.close();
})();

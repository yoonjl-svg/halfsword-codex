import { chromium } from '/home/user/halfsword/node_modules/playwright/index.mjs';
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
for (const st of ['poseidon_night', 'poseidon']) {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  page.on('pageerror', (e) => errors.push(st + ' pageerror: ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(st + ' console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${st} http ${r.status()}: ${r.url()}`); });
  await page.goto(`http://127.0.0.1:5173/?stage=${st}&weapon=longsword`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
  await page.tap('#btnStart');
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 90000 });
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => ({ stage: window.game.stage.id, foe: document.querySelector('#foeIntro b')?.textContent, soundStage: window.game.sound?.stage }));
  console.log(st, JSON.stringify(info));
  if (st === 'clearing') await page.screenshot({ path: `${out}/clearing_b_live.png` });
  await page.close();
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ZERO console errors');
await browser.close();

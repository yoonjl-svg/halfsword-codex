import { chromium } from '/home/user/halfsword/node_modules/playwright/index.mjs';
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
await page.goto('http://127.0.0.1:5173/?weapon=longsword', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
for (let r = 1; r <= 6; r++) {
  await page.tap('#btnStart');
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 90000 });
  await page.waitForTimeout(600);
  const info = await page.evaluate(() => ({ stage: window.game.stage.id, intro: document.querySelector('#foeIntro b')?.textContent }));
  console.log('round', r, JSON.stringify(info));
  if (r === 2) await page.screenshot({ path: `${out}/round2_clearing.png` });
  await page.evaluate(() => { window.game.enemy.blood = 0.1; });
  await page.waitForFunction(() => document.getElementById('menu').classList.contains('show'), null, { timeout: 60000 }).catch(() => console.log('menu wait timeout'));
  await page.waitForTimeout(500);
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ZERO console errors');
await browser.close();

import { chromium } from '/home/user/halfsword/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
await page.goto('http://127.0.0.1:5173/?weapon=longsword', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
// W: 이김, L: 짐, R: 도중에 처음부터 다시
const plan = ['W', 'W', 'W', 'W', 'W', 'W', 'W'];
for (let r = 0; r < plan.length; r++) {
  await page.tap('#btnStart');
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 90000 });
  await page.waitForTimeout(500);
  const info = await page.evaluate(() => `${window.game.stage.id}/${document.querySelector('#foeIntro b')?.textContent}`);
  const act = plan[r];
  if (r === 4) await page.screenshot({ path: '/tmp/claude-0/-home-user-halfsword/9fbda44b-c017-5e21-91ef-deb2c6dbddd3/scratchpad/desc/night_live.png' });
  if (act === 'R') {
    await page.tap('#btnPause');
    await page.waitForFunction(() => document.getElementById('menu').classList.contains('show'), null, { timeout: 20000 });
  } else {
    await page.evaluate((a) => { (a === 'W' ? window.game.enemy : window.game.player).blood = 0.1; }, act);
    await page.waitForFunction(() => document.getElementById('menu').classList.contains('show'), null, { timeout: 60000 });
  }
  const btn = await page.textContent('#btnStart');
  console.log(`round ${r + 1}: ${info}  → ${act}  button="${btn}"`);
  await page.waitForTimeout(300);
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ZERO console errors');
await browser.close();

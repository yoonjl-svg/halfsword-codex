import { chromium } from '/home/user/halfsword/node_modules/playwright/index.mjs';
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('http://127.0.0.1:5173/?foe=bran&weapon=longsword', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
for (let r = 1; r <= 2; r++) {
  await page.tap('#btnStart');
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 60000 });
  let seen = '';
  for (let i = 0; i < 40 && !seen; i++) {
    await page.waitForTimeout(100);
    seen = await page.evaluate(() => (document.getElementById('emoMsg')?.classList.contains('show') ? document.getElementById('emoMsg').textContent : ''));
  }
  console.log('round', r, 'ai emotion', await page.evaluate(() => window.game.ai?.emotion), '| notice:', seen || '(none)');
  if (r === 1) await page.screenshot({ path: `${out}/bran_anger.png` });
  // 판을 끝내고 메뉴로: 일시정지 메뉴의 '처음부터 다시' 대신 강제로 상대를 쓰러뜨린다
  await page.evaluate(() => { window.game.enemy.blood = 0.1; });
  await page.waitForFunction(() => window.game.state !== 'fight' || document.getElementById('menu').classList.contains('show'), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(4000);
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ZERO console errors');
await browser.close();

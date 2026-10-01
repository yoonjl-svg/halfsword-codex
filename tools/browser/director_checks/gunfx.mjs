import { chromium } from '/home/user/halfsword/node_modules/playwright/index.mjs';
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('http://127.0.0.1:5173/?stage=castle&foe=bran&weapon=pistol', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
await page.tap('#btnStart');
await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 120000 });
await page.waitForTimeout(1500);
const fired = await page.evaluate(() => window.game.player.skill.thrust());
for (const ms of [40, 120, 400]) { await page.waitForTimeout(ms); await page.screenshot({ path: `${out}/gunfx_${ms}.png` }); }
const vis = await page.evaluate(() => { let n = 0; window.game.scene?.traverse?.((o) => { if ((o.isSprite || o.isPoints) && o.visible) n++; }); return n; });
console.log('fired', fired, 'visible sprites/points', vis);
// 판 다시 열기 → 효과가 남지 않는지
await page.tap('#btnPause'); await page.waitForTimeout(300); await page.tap('#btnStart');
await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 120000 });
await page.waitForTimeout(1500); await page.evaluate(() => window.game.player.skill.thrust()); await page.waitForTimeout(60); await page.screenshot({ path: out + '/gunfx_round2.png' });
await page.tap('#btnPause'); await page.waitForTimeout(300); await page.tap('#btnStart');
await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 120000 });
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ZERO console errors');
await browser.close();

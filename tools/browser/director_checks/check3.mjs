import { chromium } from '/home/user/halfsword/node_modules/playwright/index.mjs';
const [out, sizes, q, tag] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
for (const [w, h] of sizes.split(',').map((s) => s.split('x').map(Number))) {
  const touch = w < 1000;
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch });
  page.on('pageerror', (e) => errors.push(w + ' pageerror: ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(w + ' console: ' + m.text()); });
  await page.goto(`http://127.0.0.1:5173/?stage=castle&foe=isolde&${q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
  if (touch) await page.tap('#btnStart'); else await page.click('#btnStart');
  await page.waitForFunction(() => window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6, null, { timeout: 90000 });
  const c = page.locator('#draw .wcard').nth(0);
  if (h > w) await page.evaluate(() => document.querySelector('#draw .wcard').click()); else if (touch) await c.tap(); else await c.click();
  await page.waitForTimeout(300); console.log('after tap', await page.evaluate(() => JSON.stringify({ st: window.game.state, stage: window.game.draw.stage, t: window.game.draw.t, pick: window.game.draw.pick })));
  await page.waitForFunction(() => window.game.draw.t > 1.35 || window.game.state === 'fight', null, { timeout: 60000, polling: 50 });
  await page.evaluate(() => { window.game.draw.hold = true; });
  const m = await page.evaluate(() => [...document.querySelectorAll('#draw .wcard')].map((card) => {
    const f = card.querySelector('.wface').getBoundingClientRect();
    const d = card.querySelector('.wdesc').getBoundingClientRect();
    const a = card.querySelector('.wabil').getBoundingClientRect();
    return { name: card.querySelector('.wname').textContent, tier: card.querySelector('.wtier').textContent, abil: card.querySelector('.wabil').textContent, overflow: Math.max(d.bottom, a.bottom) > f.bottom + 0.5 || Math.max(d.right, a.right) > f.right + 0.5 };
  }));
  console.log(`${w}x${h}`, JSON.stringify(m));
  await page.screenshot({ path: `${out}/card_${tag}_${w}x${h}.png` });
  await page.close();
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ZERO console errors');
await browser.close();

import { chromium } from '/home/user/halfsword/node_modules/playwright/index.mjs';
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const runs = (process.argv[3] || '568x320').split(',').map((s) => s.split('x').map(Number));
for (const [w, h] of runs) {
  const touch = w < 1000;
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch });
  page.on('pageerror', (e) => errors.push(w + ' pageerror: ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(w + ' console: ' + m.text()); });
  console.log('go', w); await page.goto(`http://127.0.0.1:5173/?stage=poseidon&foe=isolde&' + (process.argv[4] || 'cards=qinggang,monohoshizao&foeWeapon=lightsaber') + '`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
  if (touch) await page.tap('#btnStart'); else await page.click('#btnStart');
  await page.waitForFunction(() => window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6, null, { timeout: 60000 });
  const c = page.locator('#draw .wcard').nth(0);
  if (touch) await c.tap(); else await c.click();
  await page.waitForFunction(() => window.game.draw.t > 1.35, null, { timeout: 60000, polling: 50 });
  const m = await page.evaluate(() => [...document.querySelectorAll('#draw .wcard')].map((card) => {
    const f = card.querySelector('.wface').getBoundingClientRect();
    const d = card.querySelector('.wdesc');
    const a = card.querySelector('.wabil'); const r = d.getBoundingClientRect(); const ra = a.getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(d).lineHeight);
    return { name: card.querySelector('.wname').textContent, tier: card.querySelector('.wtier').textContent, abil: card.querySelector('.wabil').textContent, lines: Math.round(r.height / lh), overflow: r.bottom > f.bottom + 0.5 || r.right > f.right + 0.5 || ra.bottom > f.bottom + 0.5 };
  }));
  console.log(w + 'x' + h, JSON.stringify(m));
  await page.screenshot({ path: `${out}/card_${w}x${h}_${(process.argv[4]||'epic').slice(6,14)}.png` });
  await page.close();
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ZERO console errors');
await browser.close();

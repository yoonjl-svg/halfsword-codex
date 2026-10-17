// 결과 창 · 가로 화면만 · 공지 제목 사진 (사장님 10/16 14:0x — docs/import/ui_fix_2026-10-16.md §11). 저장 docs/handoff/resultfix_<장면>_<크기>.png
//  크기: phone-landscape 844×390 · phone-portrait 390×844 (둘 다 화소 비 2 · 터치)
//  장면: result-win · result-win-head · result-loss(폰 가로 — 금화 줄 같은 색 · 빈 줄 하나 · 대기실 금화 그림 · 진 까닭 / “대사”) · notices(폰 가로 — 공지 제목 10)
//        title-rotate(폰 세로 — 첫 화면을 '폰을 가로로 돌려 주세요'가 덮음)
//  npm run build && npx vite preview --port 5240 →  node tools/browser/resultfix_capture.mjs http://127.0.0.1:5240 docs/handoff
import { chromium } from 'playwright';
import { titleToLobby } from './to_lobby.mjs'; // 10/17: 첫 화면 → 곧바로 여정 → 정지 → 대기실 (사장님 '첫화면에서 바로 전투로')
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:5240', out = process.argv[3] || 'docs/handoff';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const IGNORED = /deprecated parameters for the initialization function/;
const errors = [], saved = [];
async function context(size, width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route('https://*.supabase.co/**', (r) => { errors.push(`${size}: auth server called`); r.abort(); });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${size}: ${e}`)); p.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(`${size}: ${m.text()}`); });
  return { ctx, p };
}
const shot = async (p, name, size) => { const path = `${out}/resultfix_${name}_${size}.png`; await p.screenshot({ path }); saved.push(path); };
const phase = (p) => p.evaluate(() => document.querySelector('#gameEntrance')?.shadowRoot.getElementById('entrance')?.dataset.phase);
const title = async (p) => {
  await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
  if (await p.locator('#noticeDialog').evaluate((d) => d.open)) await p.locator('#confirmNotices').click();
  await p.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 20000 });
};
const toLobby = async (p) => { await title(p); await titleToLobby(p); };
const depart = async (p) => { await p.locator('#lobbyDepart').click(); await p.waitForFunction(() => !document.getElementById('gameEntrance') && ['draw', 'fight'].includes(game.state), null, { timeout: 60000 }); };
const pick = async (p) => { await p.waitForFunction(() => game.state === 'draw' && game.draw.t > 0.6, null, { timeout: 30000 }); await p.locator('#draw .wcard[data-i="0"]').click(); await p.waitForFunction(() => game.state === 'fight', null, { timeout: 30000 }); };
const settle = (p) => p.waitForFunction(() => game.stats.simTime > 4.5, null, { timeout: 90000 }); // 판 시작 훑기 · 알림이 지나간 뒤
const paused = (p) => p.waitForFunction(() => game.state === 'paused' && document.getElementById('menu').classList.contains('show'), null, { timeout: 40000 }).then(() => p.waitForTimeout(300));
const end = async (p, who) => { await p.evaluate((w) => game[w].die('기절', true), who); await paused(p); };
const reward = (p) => p.evaluate(() => { const el = document.getElementById('menuReward'); return { text: el.textContent, color: getComputedStyle(el).color, icons: el.querySelectorAll('img').length }; }); // 금화 · 주머니 그림 = 매끈한 img (10/16 15:3x — docs/import/item_art_2026-10-16.md)

// 결과 창 셋 (첫 화면·대기실 여정 — 폰 가로)
{
  const size = 'phone-landscape';
  const { ctx, p } = await context(size, 844, 390);
  await p.goto(base + '/?title=1&cards=longsword,rapier', { waitUntil: 'networkidle' });
  await toLobby(p); await depart(p); await pick(p); await settle(p);
  await end(p, 'enemy');
  const win = await reward(p);
  assert.match(win.text, /^금화 \+\d+$/); assert.equal(win.icons, 1);
  await shot(p, 'result-win', size);
  await p.locator('#btnStart').click(); await pick(p); await settle(p);
  await end(p, 'player');
  const loss = await reward(p);
  assert.match(loss.text, /^금화 (−\d|±0)$/); assert.equal(loss.icons, 1); assert.equal(loss.color, win.color);
  assert.equal(await p.locator('#btnStart').textContent(), '다시 겨루기');
  await shot(p, 'result-loss', size);
  await p.locator('#btnStart').click(); await pick(p); await settle(p);
  await p.evaluate(() => { for (let i = 0; i < 2; i++) game.enemy.detachHeadFromWound({ severity: 1, zone: 'neck', finishPower: false }); });
  await paused(p);
  const head = await reward(p);
  assert.match(head.text, /^금화 \+\d+ · 머리 \+1$/); assert.equal(head.icons, 2);
  await shot(p, 'result-win-head', size);
  await ctx.close();
}
// 공지 (폰 가로 — 처음 들어온 사람)
{
  const size = 'phone-landscape';
  const { ctx, p } = await context(size, 844, 390);
  await p.goto(base + '/', { waitUntil: 'networkidle' }); await p.locator('#noticeDialog').waitFor({ state: 'attached', timeout: 30000 }); await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(600);
  assert.equal(await p.locator('#rotate').isVisible(), false);
  await shot(p, 'notices', size);
  await ctx.close();
}
// 첫 화면 — 폰 세로: 돌려 달라는 안내가 덮는다 (뒤는 첫 화면 — 공지는 가로로 돌려 확인한 뒤 다시 세로로)
{
  const size = 'phone-portrait';
  const { ctx, p } = await context(size, 390, 844);
  await p.goto(base + '/', { waitUntil: 'networkidle' }); await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
  if (await p.locator('#noticeDialog').evaluate((d) => d.open)) { await p.setViewportSize({ width: 844, height: 390 }); await p.locator('#confirmNotices').click(); await p.setViewportSize({ width: 390, height: 844 }); }
  await p.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 20000 });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  assert.equal(await phase(p), 'ready');
  assert.equal(await p.locator('#rotate').isVisible(), true);
  assert.equal(await p.evaluate(() => document.getElementById('rotate').contains(document.elementFromPoint(innerWidth / 2, innerHeight / 2))), true);
  await shot(p, 'title-rotate', size);
  await ctx.close();
}
await browser.close();
assert.deepEqual(errors, []);
console.log(JSON.stringify({ saved, errors }, null, 1));

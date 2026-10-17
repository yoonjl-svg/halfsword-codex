// 화면 고침 사진 (우리 게임 실제 화면 — docs/import/ui_fix_2026-10-16.md §8). 저장 docs/handoff/uifix_<장면>_<크기>.png
//  크기: phone-landscape 844×390 · phone-portrait 390×844 (둘 다 화소 비 2 · 터치). 세로에서 싸움 창(정지 · 결과)은 '폰을 가로로 돌려 주세요'가 덮으므로
//   창 꼴만 보려고 그 셋은 터치 없이(같은 크기 · 화소 비) 찍는다.
//  장면: notices(본문·날짜 10) · lobby(안내 줄 없음) · pause(정지 창 '대기실') · result-win · result-loss(금화 줄 · 설정 줄 없음 · 다음 여정/다시 겨루기 · 대기실)
//  npm run build && npx vite preview --port 5230 →  node tools/browser/uifix_capture.mjs http://127.0.0.1:5230 docs/handoff
import { chromium } from 'playwright';
import { titleToLobby } from './to_lobby.mjs'; // 10/17: 첫 화면 → 곧바로 여정 → 정지 → 대기실 (사장님 '첫화면에서 바로 전투로')
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:5230', out = process.argv[3] || 'docs/handoff';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const IGNORED = /deprecated parameters for the initialization function/;
const errors = [], saved = [];
const SIZES = [['phone-landscape', 844, 390], ['phone-portrait', 390, 844]];
async function context(size, width, height, touch) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: touch, hasTouch: touch });
  await ctx.route('https://*.supabase.co/**', (r) => { errors.push(`${size}: auth server called`); r.abort(); });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${size}: ${e}`)); p.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(`${size}: ${m.text()}`); });
  return { ctx, p };
}
const shot = async (p, name, size) => { const path = `${out}/uifix_${name}_${size}.png`; await p.screenshot({ path }); saved.push(path); };
const title = async (p) => {
  await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
  if (await p.locator('#noticeDialog').evaluate((d) => d.open)) await p.locator('#confirmNotices').click();
  await p.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 20000 });
};
const toLobby = async (p) => { await title(p); await titleToLobby(p); await p.waitForTimeout(600); };
const depart = async (p) => { await p.locator('#lobbyDepart').click(); await p.waitForFunction(() => !document.getElementById('gameEntrance') && ['draw', 'fight'].includes(game.state), null, { timeout: 60000 }); };
const pick = async (p) => { await p.waitForFunction(() => game.state === 'draw' && game.draw.t > 0.6, null, { timeout: 30000 }); await p.locator('#draw .wcard[data-i="0"]').click(); await p.waitForFunction(() => game.state === 'fight', null, { timeout: 30000 }); };
const settle = (p) => p.waitForFunction(() => game.stats.simTime > 4.5, null, { timeout: 90000 }); // 판 시작 훑기 · 알림이 지나간 뒤
const end = async (p, who) => { await p.evaluate((w) => game[w].die('기절', true), who); await p.waitForFunction(() => game.state === 'paused' && document.getElementById('menu').classList.contains('show'), null, { timeout: 40000 }); await p.waitForTimeout(300); };

for (const [size, width, height] of SIZES) {
  // 공지 · 대기실 (실제 폰 — 터치)
  {
    const { ctx, p } = await context(size, width, height, true);
    await p.goto(base + '/', { waitUntil: 'networkidle' }); await p.locator('#noticeDialog').waitFor({ state: 'attached', timeout: 30000 }); await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(600); await shot(p, 'notices', size);
    await toLobby(p);
    assert.ok(!/드래그/.test(await p.evaluate(() => document.querySelector('#gameEntrance').shadowRoot.querySelector('.lobby').textContent)));
    await shot(p, 'lobby', size);
    await ctx.close();
  }
  // 정지 창 · 결과 창 (첫 화면·대기실 여정 — 세로는 터치 없이)
  {
    const portrait = height > width;
    const { ctx, p } = await context(size, width, height, !portrait);
    await p.goto(base + '/?title=1&cards=longsword,rapier', { waitUntil: 'networkidle' });
    await toLobby(p); await depart(p); await pick(p); await settle(p);
    await p.locator('#btnPause').click(); await p.waitForFunction(() => game.state === 'paused', null, { timeout: 10000 }); await p.waitForTimeout(300);
    assert.equal(await p.locator('#btnLobby').isVisible(), true);
    await shot(p, 'pause', size);
    await p.locator('#btnResume').click();
    await end(p, 'enemy');
    assert.equal(await p.locator('#btnStart').textContent(), '다음 여정'); assert.equal(await p.locator('#fpsRow').isVisible(), false);
    await shot(p, 'result-win', size);
    await p.locator('#btnStart').click(); await pick(p); await settle(p);
    await end(p, 'player');
    assert.equal(await p.locator('#btnStart').textContent(), '다시 겨루기'); assert.equal(await p.locator('#btnLobby').isVisible(), true);
    await shot(p, 'result-loss', size);
    await ctx.close();
  }
}
await browser.close();
assert.deepEqual(errors, []);
console.log(JSON.stringify({ saved, errors }, null, 1));

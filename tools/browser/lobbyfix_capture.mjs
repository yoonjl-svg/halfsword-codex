// 대기실 고친 것 사진 (우리 게임 실제 화면 — docs/import/lobby_fix_2026-10-16.md §8). 저장 docs/handoff/lobbyfix_<장면>_<크기>.png
//  폰 가로 844×390 · 폰 세로 390×844 (화소 비 2 · 터치) · PC 1280×720 (화소 비 1): 공지 · 첫 화면 · 대기실(새 글자 · 금화 · 천 주머니 · 인장 바꿈 알림) · 나뭇가지 카드 · 케틀 햇 레전드 카드 ·
//  스킬북 별자리(독일 — 안 삼·값 / 봉인 / 사용 둥근 빛 · 일본) · 책 설명(안 삼 = 구입 · 산 책 = 사용/봉인 · 고유자세 넷) / 폰 가로만: 계정 번호 단계 · 싸움 기력 막대 130 · 결과 창 금화·머리 /
//  폰 세로만: 대기실 가로 안내 · 출발 뒤 돌려 달라는 안내 / 미리보기 맞대기(고치기 전 배포판 주소를 주면 — 화소 비 3 확대)
//  저장 상태: 깬 무대 37(인장 3 → 첫 대기실에서 금화 +300) · 금화 940 + 300 · 머리 3 · 산 책 = 독일 I·II·III(II 봉인) · 일본 I·V — 사진용 미리 채움(실제 사기 흐름은 lobby_fix_smoke 가 본다)
//  npm run build && npx vite preview --port 5210 →  node tools/browser/lobbyfix_capture.mjs http://127.0.0.1:5210 docs/handoff [고치기 전 배포판 주소]
import { chromium } from 'playwright';
import { titleToLobby } from './to_lobby.mjs'; // 10/17: 첫 화면 → 곧바로 여정 → 정지 → 대기실 (사장님 '첫화면에서 바로 전투로')
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:5210', out = process.argv[3] || 'docs/handoff', before = process.argv[4] || null;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const IGNORED = /deprecated parameters for the initialization function/;
const errors = [], saved = [];
const SIZES = [['phone-landscape', 844, 390, true], ['phone-portrait', 390, 844, true], ['desktop', 1280, 720, false]];
const inRoot = (p, body) => p.evaluate(new Function(`const root=document.querySelector('#gameEntrance').shadowRoot;${body}`));
const seed = () => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.setItem('stillness.journeyClears.v1', '37');
  localStorage.setItem('stillness.lobby.neck.v1', '{"version":1,"neck":null}'); // 용사의 눈물은 벗고 (10/17 기본 장착 — 아래 내 기력 막대 사진이 그대로 나오게)
  const books = ['german:1', 'german:2', 'german:3', 'japanese:1', 'japanese:5'];
  localStorage.setItem('stillness.lobby.progress.v1', JSON.stringify({ version: 1, coins: 940, heads: 3, titles: [], title: '여행자', acquisitions: books.map((b) => ({ receipt: `skillbook:${b}`, kind: 'skillbook' })) }));
  localStorage.setItem('stillness.lobby.skillbooks.v1', JSON.stringify({ version: 1, sealed: ['german:2'] }));
};
for (const [size, width, height, phone] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
  await ctx.route('https://*.supabase.co/**', async (route) => { const path = new URL(route.request().url()).pathname; if (path.endsWith('/otp')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); errors.push(`${size}: unexpected auth request ${path}`); return route.abort(); });
  await ctx.addInitScript(seed);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${size}: ${e}`)); p.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(`${size}: ${m.text()}`); });
  const shot = async (name, opts = {}) => { const path = `${out}/lobbyfix_${name}_${size}.png`; await p.screenshot({ path, ...opts }); saved.push(path); };
  const tap = (sel) => (phone ? p.locator(sel).tap() : p.locator(sel).click());
  const scrollTo = async (sel) => { await p.locator(sel).scrollIntoViewIfNeeded(); await p.waitForTimeout(150); };
  await p.goto(base + '/', { waitUntil: 'networkidle' }); await p.locator('#noticeDialog').waitFor({ state: 'attached', timeout: 30000 }); await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(600); await shot('notices');
  await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
  await tap('#confirmNotices'); await p.waitForFunction(() => document.querySelector('#gameEntrance').shadowRoot.getElementById('entrance').dataset.phase === 'ready', null, { timeout: 20000 });
  await p.waitForFunction(() => !document.querySelector('#gameEntrance').shadowRoot.getElementById('openAccount').disabled, null, { timeout: 20000 });
  await p.waitForTimeout(400); await shot('title');
  if (size === 'phone-landscape') {
    await tap('#openAccount'); await p.locator('#accountEmail').fill('traveler.test@example.com');
    await tap('#accountSend'); await p.locator('#accountCode').waitFor({ state: 'visible' }); await p.locator('#accountCode').fill('123456'); await p.waitForTimeout(200); await shot('account-code');
    await tap('#closeAccount');
  }
  await titleToLobby(p, '#newJourney', phone ? 'tap' : 'click'); await p.waitForTimeout(700);
  assert.match(await p.locator('#lobbyStatus').textContent(), /인장 3개를 금화 300으로/);
  await inRoot(p, `root.querySelector('.lobby').scrollTop=0;`); await shot('lobby');
  if (height > width) { assert.equal(await p.locator('#landscapeHint').isVisible(), true); await scrollTo('#landscapeHint'); await shot('landscape-hint'); }
  await scrollTo('[data-weapon=tree_branch]'); await tap('[data-weapon=tree_branch]'); await tap('#equipItem'); await scrollTo('#itemDetail'); await shot('branch-card');
  await tap('#unequipItem');
  await tap('#tabArmor'); await tap('button[data-armor=kettle]'); await p.locator('button[data-armor=kettle] img').evaluate((img) => img.decode());
  assert.equal(await p.locator('#itemRarity').textContent(), '레전드'); await scrollTo('#itemDetail'); await shot('kettle-card');
  await tap('#tabSkills'); await scrollTo('.tree-frame'); await shot('tree-german');
  await tap('.book-node[data-book="4"]'); await scrollTo('.tree-frame'); await shot('book-unowned'); await tap('.detail-close');
  await tap('.book-node[data-book="2"]'); await shot('book-sealed'); await tap('.detail-close');
  await tap('.book-node[data-book="3"]'); await shot('book-unique'); await tap('.detail-close');
  await tap('.school-tabs [data-school=japanese]'); await p.waitForTimeout(150); await shot('tree-japanese');
  if (phone && height > width) {
    await tap('#tabWeapons'); await scrollTo('#lobbyDepart'); await tap('#lobbyDepart');
    await p.waitForFunction(() => game.state === 'draw' && !document.getElementById('gameEntrance'), null, { timeout: 60000 }); await p.waitForTimeout(700); await shot('rotate');
  }
  if (size === 'phone-landscape') {
    await tap('#tabWeapons'); await tap('#lobbyDepart'); await p.waitForFunction(() => game.state === 'draw' && game.draw.t > 0.6, null, { timeout: 60000 });
    await tap('#draw .wcard[data-i="0"]'); await p.waitForFunction(() => game.state === 'fight', null, { timeout: 60000 });
    await p.evaluate(() => { game.ai.update = () => {}; game.config.ARENA.startHold = 0; game.camOpen.mode = 'old'; });
    await p.waitForFunction(() => !document.querySelector('.stamina-bar').hidden, null, { timeout: 60000 }); await p.waitForTimeout(400);
    assert.deepEqual(await p.evaluate(() => [game.player.stamina.max, Math.round(game.player.stamina.value)]), [130, 130]);
    const bar = await p.locator('.stamina-bar').first().boundingBox();
    await shot('stamina130'); await shot('stamina130-zoom', { clip: { x: Math.max(0, bar.x - 50), y: Math.max(0, bar.y - 34), width: 156, height: 84 } });
    await p.evaluate(() => { game.player.stamina.value = 65; game.player.stamina.rest = -100; }); await p.waitForTimeout(250);
    await shot('stamina65-zoom', { clip: { x: Math.max(0, bar.x - 50), y: Math.max(0, bar.y - 34), width: 156, height: 84 } });
    await p.evaluate(() => { game.enemy.detachHeadFromWound({ severity: 1, zone: 'neck', finishPower: false }); }); await p.waitForFunction(() => game.state === 'paused', null, { timeout: 60000 });
    await p.waitForTimeout(200); await shot('result-win');
    await tap('#btnStart'); await p.waitForFunction(() => game.state === 'draw' && game.draw.t > 0.6, null, { timeout: 60000 }); await tap('#draw .wcard[data-i="0"]');
    await p.waitForFunction(() => game.state === 'fight', null, { timeout: 60000 });
    await p.evaluate(() => game.player.die('기절', true)); await p.waitForFunction(() => game.state === 'paused', null, { timeout: 60000 }); await p.waitForTimeout(200); await shot('result-loss');
  }
  await ctx.close();
}
// 미리보기 맞대기 (폰 가로 · 화소 비 3 — 실제 폰과 같은 비): 고치기 전(화소 비 1 · 계단 펴기 없음) ↔ 고친 판(화소 비 3 · 계단 펴기). 캐릭터 칸만 잘라 크게
async function previewCloseUp(url, name) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(`${name}: ${e}`));
  await p.goto(url + '/', { waitUntil: 'networkidle' }); await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
  if (await p.locator('#noticeDialog').evaluate((d) => d.open)) await p.locator('#confirmNotices').click();
  await p.waitForFunction(() => document.querySelector('#gameEntrance').shadowRoot.getElementById('entrance').dataset.phase === 'ready', null, { timeout: 20000 });
  await titleToLobby(p); await p.waitForTimeout(800);
  const box = await p.locator('#characterView').boundingBox();
  const path = `${out}/lobbyfix_${name}_phone-landscape.png`;
  await p.screenshot({ path, clip: { x: box.x + box.width * 0.18, y: box.y + 4, width: box.width * 0.64, height: box.height * 0.62 } }); saved.push(path);
  await ctx.close();
}
if (before) await previewCloseUp(before, 'preview-before');
await previewCloseUp(base, 'preview-after');
await browser.close();
console.log(JSON.stringify({ saved: saved.length, errors }, null, 1));
if (errors.length) process.exit(1);

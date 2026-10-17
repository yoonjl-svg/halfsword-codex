// 아이템 그림 사진 (사장님 10/16 14:4x ③ · 15:3x ⑦⑧⑨ — docs/import/item_art_2026-10-16.md). 폰 가로 844×390 · 화소 비 3 · 터치 (실제 폰과 같은 비)
//  장면: tree(스킬북 별자리 — 독일: I 사용 · II 봉인 · III 사용 · IV·V 안 삼 + 값 표지) · detail(책 III 설명 카드) · wallet(대기실 지갑 금화 · 머리) · result(이긴 판 결과 창 — 금화 + 머리)
//   + tree_<유파>(이탈리아 · 이베리아 · 일본 · 동방 — 같은 상태: I · III 사용 · II 봉인 · IV · V 안 삼) · detail_japanese(일본 III 설명 카드) — 문서 꼴 다섯 (사장님 17:3x · 17:4x)
//  저장: <out>/<장면>.png (전체 화면) + <out>/rects.json (자를 자리 — 사진 판 만들기 tools/browser/itemart_sheet.py 가 읽는다)
//  --lobby-smooth : 대기실 금화 · 머리 그림의 '픽셀 확대'(lobby.css .coin-icon image-rendering: pixelated)를 사진에서만 끈다 —
//                   그 줄은 다른 작업자가 지우는 중이라(같은 날 2 단계), 합친 뒤 모습을 미리 보려고. 저장소 CSS 는 안 바꾼다.
//  배포판 + 미리 보기 서버 →  node tools/browser/itemart_capture.mjs http://127.0.0.1:5250 /tmp/<빈 폴더> [--lobby-smooth]
import { chromium } from 'playwright';
import { titleToLobby } from './to_lobby.mjs'; // 10/17: 첫 화면 → 곧바로 여정 → 정지 → 대기실 (사장님 '첫화면에서 바로 전투로')
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:5250', out = process.argv[3] || '/tmp/itemart-capture', smooth = process.argv.includes('--lobby-smooth');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const IGNORED = /deprecated parameters for the initialization function/;
const errors = [], rects = {};
const seed = () => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.setItem('stillness.journeyClears.v1', '0');
  const books = ['german', 'italian', 'iberian', 'japanese', 'chinese'].flatMap((s) => [`${s}:1`, `${s}:2`, `${s}:3`]); // 유파마다 I · II · III 삼
  localStorage.setItem('stillness.lobby.progress.v1', JSON.stringify({ version: 1, coins: 1240, heads: 3, titles: [], title: '여행자', acquisitions: books.map((b) => ({ receipt: `skillbook:${b}`, kind: 'skillbook' })) }));
  localStorage.setItem('stillness.lobby.skillbooks.v1', JSON.stringify({ version: 1, sealed: ['german:2', 'italian:2', 'iberian:2', 'japanese:2', 'chinese:2'] })); // II 는 봉인
};
const rectOf = (p, sel) => p.evaluate((s) => {
  const root = document.querySelector('#gameEntrance')?.shadowRoot, el = root?.querySelector(s) ?? document.querySelector(s);
  const r = el.getBoundingClientRect();
  return [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10);
}, sel);
try {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await ctx.route('https://*.supabase.co/**', (r) => { errors.push('auth server called'); r.abort(); });
  await ctx.addInitScript(seed);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(m.text()); });
  const shot = (name) => p.screenshot({ path: `${out}/${name}.png` });
  const images = () => p.evaluate(() => Promise.all([...document.querySelector('#gameEntrance').shadowRoot.querySelectorAll('img')].map((i) => i.decode().catch(() => {}))));
  await p.goto(base + '/?title=1&cards=longsword,rapier', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
  if (await p.locator('#noticeDialog').evaluate((d) => d.open)) await p.locator('#confirmNotices').tap();
  await p.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 20000 });
  await titleToLobby(p, '#newJourney', 'tap');
  if (smooth) await p.evaluate(() => { const s = document.createElement('style'); s.textContent = '.coin-icon{image-rendering:auto}'; document.querySelector('#gameEntrance').shadowRoot.append(s); });
  await p.evaluate(() => document.fonts.ready); await images(); await p.waitForTimeout(600);
  rects.wallet = await rectOf(p, '.coin-balance');
  await shot('wallet');
  await p.locator('#tabSkills').tap(); await p.locator('.school-tabs [data-school=german]').tap(); await images(); await p.waitForTimeout(400);
  rects.tree = await rectOf(p, '#panelSkills');
  rects.panelWallet = await rectOf(p, '.panel-wallet');
  assert.equal(await p.locator('.book-node[data-state=use]').count(), 2);
  assert.equal(await p.locator('.book-node[data-state=unowned]').count(), 2);
  await shot('tree');
  await p.locator('.book-node[data-book="3"]').tap(); await p.locator('.book-detail').waitFor(); await images(); await p.waitForTimeout(300);
  rects.detail = await rectOf(p, '#panelSkills');
  await shot('detail');
  await p.locator('.detail-close').tap();
  // 나머지 유파 넷 (같은 상태 — 문서 꼴이 유파마다 다르다)
  for (const school of ['italian', 'iberian', 'japanese', 'chinese']) {
    await p.locator(`.school-tabs [data-school=${school}]`).tap(); await images(); await p.waitForTimeout(300);
    assert.equal(await p.locator('.book-node[data-state=use]').count(), 2);
    assert.equal(await p.locator('.book-node[data-state=unowned]').count(), 2);
    rects[`tree_${school}`] = await rectOf(p, '#panelSkills');
    await shot(`tree_${school}`);
  }
  await p.locator('.school-tabs [data-school=japanese]').tap(); await images(); // 일본 III 설명 카드 (제목 쪽지 두루마리)
  await p.locator('.book-node[data-book="3"]').tap(); await p.locator('.book-detail').waitFor(); await images(); await p.waitForTimeout(300);
  rects.detail_japanese = await rectOf(p, '#panelSkills');
  await shot('detail_japanese');
  await p.locator('.detail-close').tap();
  // 이긴 판 결과 창 (금화 + 머리): 여정 → 카드 → 상대 목을 벰
  await p.locator('#tabWeapons').tap(); await p.locator('#lobbyDepart').tap();
  await p.waitForFunction(() => game.state === 'draw' && game.draw.t > 0.6, null, { timeout: 60000 });
  await p.locator('#draw .wcard[data-i="0"]').tap(); await p.waitForFunction(() => game.state === 'fight', null, { timeout: 60000 });
  await p.waitForFunction(() => game.stats.simTime > 4.5, null, { timeout: 90000 });
  await p.evaluate(() => { for (let i = 0; i < 2; i++) game.enemy.detachHeadFromWound({ severity: 1, zone: 'neck', finishPower: false }); });
  await p.waitForFunction(() => game.state === 'paused' && document.getElementById('menu').classList.contains('show'), null, { timeout: 60000 });
  await p.evaluate(() => Promise.all([...document.querySelectorAll('#menuReward img')].map((i) => i.decode().catch(() => {}))));
  await p.waitForTimeout(400);
  assert.match(await p.locator('#menuReward').textContent(), /^금화 \+\d+ · 머리 \+1$/);
  rects.result = await rectOf(p, '#menu .card');
  rects.reward = await rectOf(p, '#menuReward');
  await shot('result');
  await ctx.close();
} finally {
  fs.writeFileSync(`${out}/rects.json`, JSON.stringify({ rects, errors, smooth }, null, 2));
  await browser.close();
}
console.log(errors.length ? 'errors:\n' + errors.join('\n') : `saved ${Object.keys(rects).length} rects → ${out}`);
if (errors.length) process.exit(1);

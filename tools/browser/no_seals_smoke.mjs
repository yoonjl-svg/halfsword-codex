// 인장 없앰 실제 흐름 점검 (사장님 10/16 08:1x "인장 제도 없애." — docs/strike/school_kit_map.md §2 · §3) — 배포판 + 미리 보기 서버, 인증 서버는 막음(부르면 실패)
//  ① 새 프로필: 바꿈 알림 없음 · 대기실·별자리 어디에도 '인장' 글 없음 · 책 없는 여정 판 = 기본 몫 · 이겨도 인장 안내 없음(깬 수만 +1)
//  ② 옛 메뉴 여정(게임 인자 주소): 깬 수 9 → 이겨서 10 이 되어도 안내 줄에 인장 없음 · 플레이어 몫은 산 책(새 프로필 = 없음)
//  ③ 깬 수 35 프로필: 첫 대기실에서 금화 +300 한 번(알림 한 줄) · 첫 화면으로 돌아오거나 새로 고침 · 깬 수가 늘어도 다시 안 줌 · 이미 바꾼 기록이 있으면 안 줌
//     · 옛 메뉴로 먼저 연 사람(깬 수 39): 판을 연 때 바꿈 · 그 뒤 이겨 40 이 되어도 안 줌 · 다음 대기실이 알림 한 번 (확인표 1928)
//  ④ 테스트 경로 = 책 모두 '사용'(일본 걸음 · 버티기 · 유파 막기 · 고유 공격 넷 · 비기)
//  ⑤ 주소 판: 책 없음 = 기본 몫 · ?uniqueStage=0 / 2 / 5 = 책 없음 / 보법·막기 / 모두 · 산 책(일본 I · V)은 주소 판에서도 그대로
//  10/17 11:2x 흐름: 대기실 = 첫 화면 'Stage 1' → 곧바로 카드 → 정지 → '대기실' (tools/browser/to_lobby.mjs) · 대기실 출발 = 'Stage 입장'(같은 카드)
//  npm run build && npx vite preview --port 5220 →  node tools/browser/no_seals_smoke.mjs http://127.0.0.1:5220 /tmp/<빈 폴더>
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { titleToLobby } from './to_lobby.mjs';
const base = process.argv[2] || 'http://127.0.0.1:5220', out = process.argv[3] || '/tmp/no-seals';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const errors = [], checks = [];
const IGNORED = /deprecated parameters for the initialization function/;
const watch = (p) => { p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(m.text()); }); };
const noAuth = (c) => c.route('https://*.supabase.co/**', (r) => { errors.push('auth server called: ' + r.request().url()); r.abort(); });
// 저장 상태를 첫 열기에만 심는다 (새로 고침하면 그대로 이어짐)
const seed = (c, items) => c.addInitScript((kv) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); } }, items);
// 안내 줄(#hint)에 뜬 글을 모두 적는다 — 판 끝 인장 안내가 3.4 s 만 떠도 놓치지 않게
const hintLog = (c) => c.addInitScript(() => { window.__hints = []; addEventListener('DOMContentLoaded', () => { const h = document.getElementById('hint'); if (h) new MutationObserver(() => window.__hints.push(h.textContent)).observe(h, { childList: true, characterData: true, subtree: true }); }); });
async function title(p) {
  await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
  if (await p.locator('#noticeDialog').evaluate((d) => d.open)) await p.locator('#confirmNotices').click();
  await p.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 20000 });
}
async function lobby(p, url) { // 첫 화면 → 곧바로 여정 → 정지 → 대기실 (url 없으면 지금 첫 화면에서)
  if (url != null) await p.goto(base + url, { waitUntil: 'networkidle' });
  await title(p);
  await titleToLobby(p);
}
const shadowText = (p) => p.evaluate(() => document.querySelector('#gameEntrance')?.shadowRoot.querySelector('.lobby')?.textContent ?? '');
const clears = (p) => p.evaluate(() => localStorage.getItem('stillness.journeyClears.v1'));
const pick = async (p, i = 0) => { await p.waitForFunction(() => game.state === 'draw' && game.draw.t > 0.6, null, { timeout: 30000 }); await p.locator(`#draw .wcard[data-i="${i}"]`).click(); await p.waitForFunction(() => game.state === 'fight', null, { timeout: 30000 }); };
const kit = async (p) => { await p.waitForFunction(() => game.player?.gait?.P && game.playerUnique && game.playerSecret, null, { timeout: 30000 }); await p.waitForTimeout(300); return p.evaluate(() => ({ w: game.player.weapon.id, fw: game.player.schoolFootwork !== false, gait: game.player.gait.P.tradition ?? null, sway: game.player.swayScale, parry: game.player.schoolParry !== false, uniq: game.playerUnique.list.length, secret: !!game.playerSecret.S })); };
const NONE = { fw: false, gait: null, sway: 1, parry: false, uniq: 0, secret: false };
const win = async (p) => { await p.evaluate(() => game.enemy.die('기절', true)); await p.waitForFunction(() => game.state === 'paused', null, { timeout: 30000 }); };
const noSeal = async (p, where) => {
  const hints = await p.evaluate(() => window.__hints ?? []);
  const shown = await p.evaluate(() => [document.getElementById('hint')?.textContent ?? '', document.getElementById('menu')?.textContent ?? ''].join(' | '));
  assert.ok(!hints.some((t) => /인장/.test(t)) && !/인장/.test(shown), `${where}: ${JSON.stringify({ hints, shown })}`);
  return hints;
};

try {
  // ① 새 프로필
  {
    const c = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, reducedMotion: 'reduce' }); await noAuth(c); await hintLog(c);
    const p = await c.newPage(); watch(p);
    await lobby(p, '/?title=1&cards=longsword,rapier');
    assert.equal(await p.locator('#lobbyStatus').textContent(), ''); assert.equal(await p.locator('#lobbyCoins').textContent(), '100');
    await p.locator('#tabSkills').click(); await p.locator('.book-node').first().waitFor();
    assert.ok(!/인장/.test(await shadowText(p)), 'lobby text mentions 인장');
    assert.deepEqual(JSON.parse(await p.evaluate(() => localStorage.getItem('stillness.lobby.sealCoins.v1'))).converted, 0); // 인장 0 — 알림 없이 기록만 (다시 안 바꿈)
    assert.equal(await p.locator('#lobbyDepart').textContent(), 'Stage 입장');
    await p.locator('#lobbyDepart').click(); await pick(p, 0); // 첫 화면에서 펼친 같은 카드 (이어하기 지점)
    assert.deepEqual({ ...(await kit(p)), w: undefined }, { ...NONE, w: undefined });
    await win(p); const hints = await noSeal(p, 'lobby journey win');
    assert.equal(await clears(p), '1');
    await p.screenshot({ path: `${out}/fresh-win.png` });
    checks.push({ check: 'fresh profile (title Stage 1 → cards → pause → 대기실): no conversion notice, no 인장 text in the lobby or skill tree, book-less journey (Stage 입장) = base kit, a win shows no seal hint (clear count 0 → 1)', hints });
    await c.close();
  }
  // ② 옛 메뉴 여정 — 깬 수 9 → 10
  {
    const c = await browser.newContext({ viewport: { width: 844, height: 390 }, reducedMotion: 'reduce' }); await noAuth(c); await hintLog(c);
    await seed(c, { 'stillness.journeyClears.v1': '9' });
    const p = await c.newPage(); watch(p);
    await p.goto(base + '/?cards=longsword,rapier', { waitUntil: 'networkidle' }); await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
    assert.equal(await p.locator('#gameEntrance').count(), 0); // 게임 인자 → 옛 메뉴
    await p.locator('#btnStart').click(); await pick(p, 0);
    assert.deepEqual({ ...(await kit(p)), w: undefined }, { ...NONE, w: undefined }); // 옛 메뉴 판도 산 책 — 새 프로필 = 없음 (전엔 보법·막기 늘 켬 · 인장 단계)
    await win(p); const hints = await noSeal(p, 'old-menu journey win at 10 clears');
    assert.equal(await clears(p), '10');
    await p.screenshot({ path: `${out}/old-menu-win-10.png` });
    checks.push({ check: 'old-menu journey: 9 → 10 clears with no seal hint; the player kit comes from books (none in a fresh profile)', hints });
    await c.close();
  }
  // ③ 깬 수 35 → 금화 300 한 번
  {
    const c = await browser.newContext({ viewport: { width: 844, height: 390 }, reducedMotion: 'reduce' }); await noAuth(c);
    await seed(c, { 'stillness.journeyClears.v1': '35' });
    const p = await c.newPage(); watch(p);
    await lobby(p, '/');
    assert.equal(await p.locator('#lobbyStatus').textContent(), '인장 3개를 금화 300으로 바꿨습니다.'); assert.equal(await p.locator('#lobbyCoins').textContent(), '400');
    await p.screenshot({ path: `${out}/convert-35.png` });
    await p.locator('#lobbyBack').click(); await lobby(p);
    assert.equal(await p.locator('#lobbyStatus').textContent(), ''); assert.equal(await p.locator('#lobbyCoins').textContent(), '400');
    await p.evaluate(() => localStorage.setItem('stillness.journeyClears.v1', '120')); // 바꾼 뒤에 깬 무대가 늘어도
    await p.reload({ waitUntil: 'networkidle' }); await lobby(p);
    assert.equal(await p.locator('#lobbyStatus').textContent(), ''); assert.equal(await p.locator('#lobbyCoins').textContent(), '400');
    assert.deepEqual(JSON.parse(await p.evaluate(() => localStorage.getItem('stillness.lobby.sealCoins.v1'))).converted, 3);
    checks.push('35 clears: 300 coins once with the notice; back to title, reload and more clears do not pay again');
    await c.close();
    const d = await browser.newContext({ viewport: { width: 844, height: 390 }, reducedMotion: 'reduce' }); await noAuth(d);
    await seed(d, { 'stillness.journeyClears.v1': '120', 'stillness.lobby.sealCoins.v1': JSON.stringify({ version: 1, converted: 3, at: '2026-10-16' }) });
    const q = await d.newPage(); watch(q);
    await lobby(q, '/');
    assert.equal(await q.locator('#lobbyStatus').textContent(), ''); assert.equal(await q.locator('#lobbyCoins').textContent(), '100');
    checks.push('a player who already converted (10/16 04:5x record) gets nothing again');
    await d.close();
    // 옛 메뉴(주소 판)로 먼저 연 사람 (확인표 1928): 판을 연 때 바꿈 — 깬 수 39 = 인장 3 → 금화 400 저장 · 그 뒤 주소 판에서 이겨 40 이 되어도 안 바꿈 · 다음 대기실이 알림 한 번
    const e = await browser.newContext({ viewport: { width: 844, height: 390 }, reducedMotion: 'reduce' }); await noAuth(e); await hintLog(e);
    await seed(e, { 'stillness.journeyClears.v1': '39' });
    const r = await e.newPage(); watch(r);
    await r.goto(base + '/?cards=longsword,rapier', { waitUntil: 'networkidle' }); await r.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
    const stored = () => r.evaluate(() => ({ coins: JSON.parse(localStorage.getItem('stillness.lobby.progress.v1'))?.coins ?? null, record: JSON.parse(localStorage.getItem('stillness.lobby.sealCoins.v1')) }));
    const atLoad = await stored();
    assert.equal(atLoad.coins, 400); assert.equal(atLoad.record.converted, 3); assert.equal(atLoad.record.notice, true);
    await r.locator('#btnStart').click(); await pick(r, 0); await win(r); await noSeal(r, 'old-menu win after the conversion');
    assert.equal(await clears(r), '40'); assert.equal((await stored()).coins, 400);
    await lobby(r, '/');
    assert.equal(await r.locator('#lobbyStatus').textContent(), '인장 3개를 금화 300으로 바꿨습니다.'); assert.equal(await r.locator('#lobbyCoins').textContent(), '400');
    await r.locator('#lobbyBack').click(); await lobby(r);
    assert.equal(await r.locator('#lobbyStatus').textContent(), ''); assert.equal((await stored()).record.notice, false);
    checks.push('old-menu first: 39 clears convert at load (300 once) · a later URL win to 40 pays nothing · the next lobby shows the notice once');
    await e.close();
  }
  // ④ 테스트 경로 = 모두
  {
    const c = await browser.newContext({ viewport: { width: 844, height: 390 }, reducedMotion: 'reduce' }); await noAuth(c);
    const p = await c.newPage(); watch(p);
    await p.goto(base + '/?test=1&weapon=uchigatana&hero=player&foe=isolde&stage=castle', { waitUntil: 'networkidle' }); await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
    await p.locator('#btnStart').click(); await p.waitForFunction(() => game.state === 'fight', null, { timeout: 30000 });
    assert.deepEqual(await kit(p), { w: 'uchigatana', fw: true, gait: 'japanese', sway: 0.75, parry: true, uniq: 4, secret: true });
    checks.push('test route: every book in use (Japanese gait · steady 0.75 · school parry · four unique attacks · secret)');
    await c.close();
  }
  // ⑤ 주소 판 — 산 책 · ?uniqueStage
  {
    const want = {
      '': NONE,
      '&uniqueStage=0': NONE,
      '&uniqueStage=2': { fw: true, gait: 'japanese', sway: 0.75, parry: true, uniq: 0, secret: false },
      '&uniqueStage=5': { fw: true, gait: 'japanese', sway: 0.75, parry: true, uniq: 4, secret: true },
    };
    const c = await browser.newContext({ viewport: { width: 844, height: 390 }, reducedMotion: 'reduce' }); await noAuth(c);
    const p = await c.newPage(); watch(p);
    const got = {};
    for (const [q, w] of Object.entries(want)) {
      await p.goto(`${base}/?weapon=uchigatana&foe=default&stage=castle&emo=0${q}`, { waitUntil: 'networkidle' }); await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
      await p.locator('#btnStart').click(); await p.waitForFunction(() => game.state === 'fight', null, { timeout: 30000 });
      got[q || '(none)'] = await kit(p);
      assert.deepEqual({ ...got[q || '(none)'], w: undefined }, { ...w, w: undefined }, q);
    }
    // 산 책: 일본 I(보법) · V(비기) — 주소 판도 그대로 읽는다
    await p.evaluate(() => localStorage.setItem('stillness.lobby.progress.v1', JSON.stringify({ version: 1, acquisitions: [{ receipt: 'skillbook:japanese:1', kind: 'skillbook' }, { receipt: 'skillbook:japanese:5', kind: 'skillbook' }], coins: 0, heads: 0, titles: [], title: '여행자' })));
    await p.goto(`${base}/?weapon=uchigatana&foe=default&stage=castle&emo=0`, { waitUntil: 'networkidle' }); await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
    await p.locator('#btnStart').click(); await p.waitForFunction(() => game.state === 'fight', null, { timeout: 30000 });
    got.owned = await kit(p);
    assert.deepEqual(got.owned, { w: 'uchigatana', fw: true, gait: 'japanese', sway: 0.75, parry: false, uniq: 0, secret: true });
    checks.push({ check: 'URL fights read books: none = base kit · ?uniqueStage=0/2/5 = none / footwork+parry / all · owned Japanese I+V = footwork + secret', got });
    await c.close();
  }
  assert.deepEqual(errors, []);
} finally {
  fs.writeFileSync(`${out}/no_seals.json`, JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
}
console.log(`PASS ${checks.length} no-seal checks; errors ${errors.length}`);

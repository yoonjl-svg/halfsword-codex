// 전달 확인: 수신측 hero_profiles_shots.mjs를 베르나르도 한 명으로 한정.
// 손님 인물 셋 프로필 확정본 화면 점검 (10/24 — docs/import/hero_profiles_import_2026-10-24.md §5): 폰 가로 844 × 390 · 화면 배율 2
//  ① 대기실 프로필 칸: 첫 화면(?title=1&hero=<id>) → 여정 → 정지 → 대기실 — 칸 그림이 그 인물의 ui/portraits/<id>.webp(768²)
//  ② 패배 창: ?foe=<id> 로 세워 짐 → 결과 창 왼쪽 상대 프로필 + 오른쪽 승리 대사
//  ③ 방랑 패배 창: 저장에 그 인물과의 방랑 판을 넣고 대기실 '방랑 이어가기' → 짐 → '… · 방랑 종료' 창의 상대 프로필
//  (판 끝은 연결 확인용으로 강제 — 승률 자료 아님)
//  실행: npm run build (vite build + tools/pwa/build.mjs — sw.js 가 없으면 페이지마다 콘솔 오류 하나) → npx vite preview --port 5414 --strictPort →
//        node tools/browser/hero_profiles_shots.mjs http://127.0.0.1:5414 <빈 그림 폴더> → python3 -I tools/ui/hero_profiles_sheet.py <그 폴더> docs/handoff/hero_profiles_2026-10-24
//  출력: 그림 폴더에 PNG(lobby_<id> · defeat_<id> · wander_defeat_<id>) · 끝에 결과 줄(어긋나면 exit 1). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { titleToLobby } from '../../../tools/browser/to_lobby.mjs';
import { UPDATE_NOTES } from '../../../src/update_notes.js';
import { STAGE_ORDER } from '../../../src/stages.js';

const base = (process.argv[2] || 'http://127.0.0.1:5414').replace(/\/$/, '');
const out = process.argv[3] || 'docs/handoff/hero_profiles_2026-10-24';
fs.mkdirSync(out, { recursive: true });
const HEROES = [['bernardo', 'tizona', 'cathedral']];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [], fails = [], notes = [];
const check = (ok, what) => { (ok ? notes : fails).push(`${ok ? 'OK ' : 'FAIL '}${what}`); console.log(ok ? 'OK  ' : 'FAIL', what); };
const NOTICES = { hideRead: true, readIds: UPDATE_NOTES.map((n) => n.id) };
const TREE = { v: 1, at: '2026-10-21', books: 0, coins: 0, heads: 0, bonus: 500, notice: false };
const progressSeed = (extra = {}) => ({ version: 1, coins: 500, heads: 0, acquisitions: [], titles: [], title: '여행자', tree: TREE, ...extra });
const BASE = { 'stillness.lobby.sealCoins.v1': { version: 1, converted: 0, at: '2026-10-16', notice: false }, 'stillness.lobby.progress.v1': progressSeed() };

/** 새 문맥: seed = 처음 한 번만 넣을 저장 · query = 주소 인자 */
async function open(seed = {}, query = '', title = true) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(([seed, notices]) => {
    if (sessionStorage.getItem('heroShotSeeded')) return;
    localStorage.clear();
    localStorage.setItem('stillness.title.notices.v1', JSON.stringify(notices));
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    sessionStorage.setItem('heroShotSeeded', '1');
  }, [{ ...BASE, ...seed }, NOTICES]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(base + '/' + query, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player, null, { timeout: 300000 });
  if (title) await page.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot?.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 120000 });
  return { ctx, page };
}
const shadow = (page, fn, arg) => page.evaluate(([src, arg]) => { const r = document.querySelector('#gameEntrance').shadowRoot; return new Function('r', 'arg', src)(r, arg); }, [fn, arg]);
async function toFight(page) {
  await page.waitForFunction(() => ['draw', 'fight'].includes(window.game.state), null, { timeout: 120000 });
  if (await page.evaluate(() => window.game.state) === 'draw') {
    await page.waitForFunction(() => window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6, null, { timeout: 120000 });
    await page.locator('#draw .wcard[data-i="0"]').click();
  }
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 120000 });
}
/** 지고 결과 창 · 상대 그림이 풀릴 때까지 */
async function lose(page) {
  await page.waitForFunction(() => !document.getElementById('foeIntro').classList.contains('show'), null, { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => window.game.player.die('목', true));
  await page.waitForFunction(() => document.getElementById('menu').classList.contains('show') && document.getElementById('menuTitle').textContent === '패배', null, { timeout: 180000 });
  await page.waitForFunction(() => { const f = document.getElementById('menuFoe'), i = document.getElementById('menuFoeImg'); return f.hidden || (i.complete && i.naturalWidth > 0); }, null, { timeout: 30000 });
}
const popup = (page) => page.evaluate(() => {
  const f = document.getElementById('menuFoe'), i = document.getElementById('menuFoeImg');
  return { shown: !f.hidden, id: f.dataset.portrait ?? null, src: i.getAttribute('src'), natural: i.naturalWidth, sub: document.getElementById('menuSub').textContent, line: document.getElementById('menuFoeLine').hidden ? '' : document.getElementById('menuFoeQuote').textContent };
});

for (const [id, weapon, stage] of HEROES) {
  // ① 대기실 프로필 칸 (?hero=<id>)
  {
    const { ctx, page } = await open({}, `?title=1&hero=${id}`);
    await titleToLobby(page);
    const s = await shadow(page, `const f = r.getElementById('lobbyPortrait'), i = r.getElementById('lobbyPortraitImg'); return { id: f.dataset.portrait, src: i.getAttribute('src'), natural: i.naturalWidth, empty: f.hasAttribute('data-empty') };`);
    check(s.id === id && s.src === `ui/portraits/${id}.webp` && s.natural === 768 && !s.empty, `① 대기실 ${id}: ${JSON.stringify(s)}`);
    await page.screenshot({ path: `${out}/lobby_${id}.png` });
    await ctx.close();
  }
  // ② 패배 창 (?foe=<id>)
  {
    const { ctx, page } = await open({}, `?foe=${id}&foeWeapon=${weapon}&weapon=longsword&stage=${stage}`, false);
    await page.evaluate(() => document.getElementById('btnStart').click());
    await toFight(page);
    await lose(page);
    const a = await popup(page);
    check(a.shown && a.id === id && a.src === `ui/portraits/${id}.webp` && a.natural === 768 && !!a.line, `② 패배 창 ${id}: ${JSON.stringify(a)}`);
    await page.screenshot({ path: `${out}/defeat_${id}.png` });
    await ctx.close();
  }
  // ③ 방랑 패배 창
  {
    const run = { id: `shot-${id}`, round: 1, wins: 0, stage, foe: id, foeWeapon: weapon, status: 'active', weapon: null, cards: null, lastWeapon: null, headTaken: false };
    const seed = {
      'stillness.journey.checkpoint.v1': { version: 1, stage: 'poseidon' },
      'stillness.lobby.progress.v1': progressSeed({ wander: { cleared: STAGE_ORDER, unlocked: true, legacyChecked: true, noticeSeen: true, run } }),
    };
    const { ctx, page } = await open(seed);
    await titleToLobby(page, '#continueJourney');
    await shadow(page, `r.getElementById('lobbyWander').click();`);
    await page.waitForFunction(() => !document.getElementById('gameEntrance') && ['draw', 'fight'].includes(window.game?.state), null, { timeout: 120000 });
    await toFight(page);
    await lose(page);
    const a = await popup(page);
    check(a.shown && a.id === id && a.src === `ui/portraits/${id}.webp` && / · 방랑 종료$/.test(a.sub), `③ 방랑 패배 창 ${id}: ${JSON.stringify(a)}`);
    await page.screenshot({ path: `${out}/wander_defeat_${id}.png` });
    await ctx.close();
  }
}

await browser.close();
console.log('\n' + (fails.length ? `FAIL ${fails.length}` : `PASS ${notes.length}`) + ' · 콘솔 오류 ' + errors.length);
for (const e of errors) console.log('  ' + e);
process.exit(fails.length || errors.length ? 1 : 0);

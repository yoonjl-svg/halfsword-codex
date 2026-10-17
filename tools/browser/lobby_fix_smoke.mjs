// 대기실 고친 것 실제 흐름 점검 (docs/import/lobby_fix_2026-10-16.md §9) — 배포판 + 미리 보기 서버, 인증 서버는 막음(부르면 실패)
//  ① 나뭇가지 장착 → 대기실 출발('Stage 입장') · 첫 화면 'Stage 1' = 카드 없이 나뭇가지 · 해제 → 카드가 돌아옴 ② 케틀 햇: 장착 = 투구 + 최대 기력 130(머리 위 막대 = 130 의 몫) · 벗음 = 맨머리 + 100
//  ③ 스킬북: 어둡게·값 → 구입 → 사용(둥근 빛) → 봉인 — 봉인/안 삼이면 싸움에서 실제로 꺼짐(일본 보법 · 막기 · 고유 공격 넷 · 비기)
//  ④ 금화: 진 판 −1~5 · 0 밑으로 안 감 · 결과 창 한 줄 ⑤ 머리: 상대 목을 베면 1(한 번) ⑥ 인장 → 금화 한 번 ⑦ 테스트 경로 = 정지 창에 대기실 없음 · 싸움은 책 모두 · 금화·인장 그대로 ⑧ 세로 폰 = 돌려 달라는 안내가 대기실을 덮음 · 미리보기 화소 비
//  10/17 11:2x 흐름: 첫 화면 'Stage 1' · '이어하기' → 곧바로 여정(카드, 장착한 무기가 있으면 싸움) → 정지 → 대기실 (tools/browser/to_lobby.mjs) · 대기실 출발 = 이어하기 지점부터
//  npm run build && npx vite preview --port 5210 →  node tools/browser/lobby_fix_smoke.mjs http://127.0.0.1:5210 /tmp/<빈 폴더>
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { departTitle, titleToLobby } from './to_lobby.mjs';
const base = process.argv[2] || 'http://127.0.0.1:5210', out = process.argv[3] || '/tmp/lobby-fix';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const errors = [], checks = [];
const IGNORED = /deprecated parameters for the initialization function/;
const watch = (p) => { p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(m.text()); }); };
const noAuth = (c) => c.route('https://*.supabase.co/**', (r) => { errors.push('auth server called: ' + r.request().url()); r.abort(); });
const shadow = (p, js) => p.evaluate(`(()=>{const root=document.querySelector('#gameEntrance')?.shadowRoot;${js}})()`);
async function title(p) {
  await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
  if (await p.locator('#noticeDialog').evaluate((d) => d.open)) await p.locator('#confirmNotices').click();
  await p.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 20000 });
}
// 첫 화면 → 곧바로 여정 → 정지 → 대기실 (url 없으면 지금 첫 화면에서). 돌려줌: 첫 화면에서 출발한 판 'draw' | 'fight'
async function lobby(p, url, sel = '#newJourney') {
  if (url != null) await p.goto(base + url, { waitUntil: 'networkidle' });
  await title(p);
  return titleToLobby(p, sel);
}
// 첫 화면 → 곧바로 여정 (대기실을 거치지 않음)
async function fromTitle(p, url) {
  await p.goto(base + url, { waitUntil: 'networkidle' }); await title(p);
  return departTitle(p);
}
const progress = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('stillness.lobby.progress.v1')));
const depart = async (p, state) => { await p.locator('#lobbyDepart').click(); await p.waitForFunction((s) => game.state === s, state, { timeout: 60000 }); await p.waitForFunction(() => !document.getElementById('gameEntrance'), null, { timeout: 5000 }); };
const pick = async (p, i = 0) => { await p.waitForFunction(() => game.draw.t > 0.6, null, { timeout: 60000 }); await p.locator(`#draw .wcard[data-i="${i}"]`).click(); await p.waitForFunction(() => game.state === 'fight', null, { timeout: 90000 }); };
// 매끈한 아이템 그림 (10/16 15:3x ⑦⑨ — docs/import/item_art_2026-10-16.md): 실제로 읽혔나(complete · 가로 256) · 주소 · 세로 · alt · aria-hidden · 그린 크기
const imgs = (p, sel, inShadow = true) => p.evaluate(([s, sh]) => Promise.all([...(sh ? document.querySelector('#gameEntrance').shadowRoot : document).querySelectorAll(s)].map((i) => i.decode().catch(() => {}).then(() => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth === 256, h: i.naturalHeight, alt: i.getAttribute('alt'), hidden: i.getAttribute('aria-hidden'), w: Math.round(i.getBoundingClientRect().width * 10) / 10 })))), [sel, inShadow]);
const book = async (p, school, tier) => { await p.locator('#tabSkills').click(); await p.locator(`.school-tabs [data-school=${school}]`).click(); await p.locator(`.book-node[data-book="${tier}"]`).click(); await p.locator('.book-detail').waitFor(); };
const closeBook = (p) => p.locator('.detail-close').click();

try {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  await noAuth(ctx);
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('stillness.journeyClears.v1', '0'); localStorage.setItem('stillness.lobby.neck.v1', '{"version":1,"neck":null}'); } }); // 용사의 눈물은 벗고 (10/17 기본 장착 — 걸면 기력이 늘 가득이라 아래 130 막대 확인이 안 됨 · 건 쪽은 hero_tear_smoke)
  const p = await ctx.newPage(); watch(p);

  // ① 장착한 무기로 곧장 · 해제하면 카드
  assert.equal(await lobby(p, '/'), 'draw'); // 새 프로필 = 장착 없음 → 첫 화면에서 곧바로 카드 (그 뒤 정지 → 대기실)
  assert.equal(await p.locator('#characterView').getAttribute('data-ratio'), '2'); // 미리보기 = 기기 화소 비 (전 1)
  const cv = await p.locator('#characterView canvas').evaluate((c) => [c.width, c.clientWidth]); assert.ok(Math.abs(cv[0] - cv[1] * 2) <= 1, JSON.stringify(cv));
  await p.locator('[data-weapon=tree_branch]').click(); await p.locator('#equipItem').click();
  await depart(p, 'fight');
  assert.equal(await p.evaluate(() => game.player.weapon.id), 'tree_branch'); assert.equal(await p.evaluate(() => document.getElementById('draw').classList.contains('show')), false);
  // 케틀 햇 기본 장착: 투구 + 최대 130 (머리 위 막대 100% = 130)
  assert.equal(await p.evaluate(() => game.player.hasHelmet), true);
  assert.deepEqual(await p.evaluate(() => [game.player.stamina.max, game.player.stamina.value, game.enemy.stamina.max]), [130, 130, 100]);
  await p.evaluate(() => { game.player.stamina.value = 65; });
  assert.equal(await p.evaluate(() => Math.round(game.player.stamina.ratio * 100)), 50);
  checks.push('title Stage 1 → straight to the card draw → pause → 대기실; branch equipped → departing (Stage 입장) fights with the branch, no card draw; kettle hat default → helmet + stamina max 130 (bar = share of 130), foe 100');
  assert.equal(await lobby(p, '/?title=1&cards=longsword,rapier'), 'fight'); // 장착한 나뭇가지는 첫 화면 출발에도 — 카드 없이 곧장 싸움 (그 뒤 정지 → 대기실)
  assert.equal(await p.evaluate(() => game.player.weapon.id), 'tree_branch');
  await p.locator('[data-weapon=tree_branch]').click(); await p.locator('#unequipItem').click(); // 카드 고정 — 무작위 카드에 나뭇가지가 나와 아래 '나뭇가지 아님'이 가끔 틀리던 것 (10/16 고침)
  await p.locator('#tabArmor').click(); await p.locator('button[data-armor=kettle]').click(); await p.locator('#unequipItem').click();
  await depart(p, 'draw'); await pick(p, 0);
  assert.notEqual(await p.evaluate(() => game.player.weapon.id), 'tree_branch');
  assert.deepEqual(await p.evaluate(() => [game.player.hasHelmet, !!game.player.helmetGroup, game.player.stamina.max, game.player.stamina.value]), [false, false, 100, 100]);
  checks.push('branch equipped → Stage 1 on the title also fights with the branch at once; unequip in the lobby → card draw returns; kettle hat removed → bare head (no helmet look, no head armor) and stamina max 100');

  // ③ 스킬북 — 일본 책을 사서 싸움에서 켜고 끔 (카드 고정 ?cards= · 금화 ?coins=)
  assert.equal(await lobby(p, '/?title=1&cards=monohoshizao,rapier&coins=1500'), 'draw'); // 대기실 출발 = 첫 화면에서 펼친 같은 카드 (이어하기 지점)
  await p.locator('#tabArmor').click(); await p.locator('button[data-armor=kettle]').click(); await p.locator('#equipItem').click(); // 다시 케틀 햇
  await book(p, 'japanese', 1);
  assert.equal(await p.locator('.book-detail').getAttribute('data-state'), 'unowned'); assert.equal(await p.locator('#buyBook').textContent(), '구입 · 금화 100');
  const dim = await shadow(p, `return getComputedStyle(root.querySelector('.book-node[data-book="1"] .book-thumb')).filter`); assert.match(dim, /grayscale/);
  // 아이템 그림: 지갑(내 정보 20 px · 스킬북 칸 14 px — 금화 · 머리) · 별자리 책 다섯(일본 I~V) · 값 표지 금화 · 설명 카드 책 — 모두 매끈한 256 px 그림이 읽힘 · 옛 도트 svg 없음
  const wallet = await imgs(p, '.coin-balance img'), panelWallet = await imgs(p, '.panel-wallet img');
  for (const w of [wallet, panelWallet]) assert.deepEqual(w.map(({ src, ok, alt, hidden }) => ({ src, ok, alt, hidden })), [{ src: 'ui/wallet/coins.webp', ok: true, alt: '금화', hidden: null }, { src: 'ui/wallet/pouch.webp', ok: true, alt: '머리', hidden: null }], JSON.stringify(w));
  assert.deepEqual(panelWallet.map((i) => i.w), [14, 14]);
  const nodes = await imgs(p, '.book-node .book-svg');
  assert.deepEqual(nodes.map(({ src, ok, h, alt, hidden }) => ({ src, ok, h, alt, hidden })), [1, 2, 3, 4, 5].map((k) => ({ src: `ui/books/japanese_${k}.webp`, ok: true, h: 336, alt: '', hidden: 'true' })), JSON.stringify(nodes));
  const prices = await imgs(p, '.book-price .price-coin');
  assert.equal(prices.length, 5); assert.ok(prices.every((i) => i.ok && i.src === 'ui/wallet/coins.webp' && i.hidden === 'true'), JSON.stringify(prices));
  const detailBook = await imgs(p, '.detail-thumb .book-svg');
  assert.deepEqual(detailBook.map(({ src, ok, h }) => ({ src, ok, h })), [{ src: 'ui/books/japanese_1.webp', ok: true, h: 336 }], JSON.stringify(detailBook));
  assert.equal(await shadow(p, `return root.querySelectorAll('.book-svg path, .price-coin path, .coin-icon path').length`), 0);
  checks.push(`item pictures load (256 px smooth webp): lobby wallet coins + pouch (alt 금화 · 머리, ${wallet.map((i) => i.w)} px · panel 14 px), five Japanese book nodes (${nodes.map((i) => i.w)} px wide), five price-tag coins (${prices[0].w} px), the book detail thumbnail (${detailBook[0].w} px); no pixel svg left`);
  for (const tier of [1, 2, 3, 5]) { if (tier !== 1) { await closeBook(p); await book(p, 'japanese', tier); } await p.locator('#buyBook').click(); assert.equal(await p.locator('.book-detail').getAttribute('data-state'), 'use'); }
  assert.equal((await progress(p)).coins, 1500 - 100 - 200 - 300 - 500);
  assert.equal(await p.locator('#lobbySchool').count(), 0); // 대표 유파 칸은 뺐다 (사장님 10/16 15:3x ⑥ — 책을 사도 내 정보 칸은 그대로)
  assert.equal(await p.locator('#lobbyLevel').textContent(), 'Lv.5'); // 레벨 = 1 + 산 책 넷
  const glow = await shadow(p, `const s=getComputedStyle(root.querySelector('.book-node[data-book="5"] .book-thumb'),'::before');return [s.content,s.borderRadius,s.opacity];`); assert.equal(glow[0], '""'); assert.equal(glow[1], '50%');
  await closeBook(p); await p.screenshot({ path: `${out}/tree-japanese-use.png` });
  await depart(p, 'draw'); await pick(p, 0); await p.evaluate(() => { game.config.ARENA.startHold = 0; }); await p.waitForTimeout(300);
  const on = await p.evaluate(() => ({ w: game.player.weapon.id, fw: game.player.schoolFootwork !== false, gait: game.player.gait.P.tradition ?? null, sway: game.player.swayScale, parry: game.player.schoolParry !== false, pad: game.playerGuard.padOf('lowR'), uniq: game.playerUnique.list.length, secret: !!game.playerSecret.S }));
  assert.deepEqual({ ...on, pad: undefined }, { w: 'monohoshizao', fw: true, gait: 'japanese', sway: 0.75, parry: true, pad: undefined, uniq: 4, secret: true });
  checks.push('bought Japanese books (사용): school footwork (gait · steady 0.75), school parry, the four unique attacks and the secret are on in the fight');
  assert.equal(await lobby(p, '/?title=1&cards=monohoshizao,rapier'), 'draw');
  for (const tier of [1, 2, 3, 5]) { await book(p, 'japanese', tier); await p.locator('#sealBook').click(); assert.equal(await p.locator('.book-detail').getAttribute('data-state'), 'sealed'); await closeBook(p); }
  const sealedGlow = await shadow(p, `return getComputedStyle(root.querySelector('.book-node[data-book="1"] .book-thumb'),'::before').content`); assert.equal(sealedGlow, 'none');
  await p.screenshot({ path: `${out}/tree-japanese-sealed.png` });
  await depart(p, 'draw'); await pick(p, 0); await p.waitForTimeout(300);
  const off = await p.evaluate(() => ({ fw: game.player.schoolFootwork !== false, gait: game.player.gait.P.tradition ?? null, sway: game.player.swayScale, parry: game.player.schoolParry !== false, pad: game.playerGuard.padOf('lowR'), uniq: game.playerUnique.list.length, secret: !!game.playerSecret.S }));
  assert.deepEqual({ ...off, pad: undefined }, { fw: false, gait: null, sway: 1, parry: false, pad: undefined, uniq: 0, secret: false });
  assert.notDeepEqual(off.pad, on.pad); // 일본 막기 자리 → 무유파 자리
  checks.push('sealed books (봉인): base walking (no gait table · no steady), no-school parry pad, no unique attacks, no secret in the fight');
  // 안 산 유파(이탈리아 레이피어 — 카드 1): 책 없음 = 기본 몫만 (첫 화면에서 곧장 카드)
  assert.equal(await fromTitle(p, '/?title=1&cards=monohoshizao,rapier'), 'draw'); await pick(p, 1);
  assert.deepEqual(await p.evaluate(() => [game.player.weapon.id, game.player.schoolFootwork, game.player.schoolParry, game.player.gait.P.tradition ?? null, game.playerUnique.list.length, !!game.playerSecret.S]), ['rapier', false, false, null, 0, false]);
  checks.push('a school with no books (Italian rapier) = base moves only');

  // ④ 진 판 금화 · 바닥 0 · ⑤ 머리
  assert.equal(await fromTitle(p, '/?coins=2'), 'draw'); await pick(p, 0);
  await p.evaluate(() => game.player.die('기절', true)); await p.waitForFunction(() => game.state === 'paused', null, { timeout: 90000 });
  const lost = await progress(p); assert.ok(lost.coins >= 0 && lost.coins <= 1, JSON.stringify(lost));
  assert.equal(await p.locator('#menuReward').textContent(), `금화 −${2 - lost.coins}`); await p.screenshot({ path: `${out}/result-loss.png` });
  checks.push('journey loss: coins −1..5 with a floor at 0, shown on the result screen');
  await p.locator('#btnStart').click(); await p.waitForFunction(() => game.state === 'draw', null, { timeout: 90000 }); await pick(p, 0);
  const headsBefore = (await progress(p)).heads;
  await p.evaluate(() => { game.enemy.detachHeadFromWound({ severity: 1, zone: 'neck', finishPower: false }); game.enemy.detachHeadFromWound({ severity: 1, zone: 'neck', finishPower: false }); });
  await p.waitForFunction(() => game.state === 'paused', null, { timeout: 90000 });
  const won = await progress(p); assert.equal(won.heads, headsBefore + 1);
  assert.match(await p.locator('#menuReward').textContent(), /^금화 \+(?:[5-9]|1[0-5]) · 머리 \+1$/); await p.screenshot({ path: `${out}/result-win-head.png` });
  const rewardIcons = await imgs(p, '#menuReward img', false); // 결과 창 금화 · 주머니 그림 (꾸밈 — 빈 alt · aria-hidden · 14 px)
  assert.deepEqual(rewardIcons.map(({ src, ok, alt, hidden, w }) => ({ src, ok, alt, hidden, w })), [{ src: 'ui/wallet/coins.webp', ok: true, alt: '', hidden: 'true', w: 14 }, { src: 'ui/wallet/pouch.webp', ok: true, alt: '', hidden: 'true', w: 14 }], JSON.stringify(rewardIcons));
  checks.push('decapitating the foe in a journey gives one head (once per foe) and the result line shows coins + head (smooth coin + pouch pictures load, 14 px, hidden from screen readers)');
  await lobby(p, '/'); assert.equal(await p.locator('#lobbyHeads').textContent(), String(headsBefore + 1));

  // ⑥ 인장 → 금화 한 번 (Stage 1 · 이어하기 · 새로 고침 — 대기실은 그때마다 싸움의 정지에서)
  const sc = await browser.newContext({ viewport: { width: 844, height: 390 }, reducedMotion: 'reduce' }); await noAuth(sc);
  await sc.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('stillness.journeyClears.v1', '250'); } });
  const q = await sc.newPage(); watch(q);
  await lobby(q, '/'); assert.equal(await q.locator('#lobbyStatus').textContent(), '인장 25개를 금화 2,500으로 바꿨습니다.'); assert.equal(await q.locator('#lobbyCoins').textContent(), '2,600');
  await q.locator('#lobbyBack').click(); assert.equal(await lobby(q, null, '#continueJourney'), 'draw'); // 이어하기 = 첫 'Stage 1' 이 남긴 지점(같은 무대 · 같은 카드)
  assert.equal(await q.locator('#lobbyStatus').textContent(), ''); assert.equal(await q.locator('#lobbyCoins').textContent(), '2,600');
  await q.reload({ waitUntil: 'networkidle' }); await lobby(q);
  assert.equal(await q.locator('#lobbyCoins').textContent(), '2,600');
  checks.push('seals → coins once: 25 seals = 2,500 with a notice in the first lobby (Stage 1 → pause → 대기실); back to title → 이어하기 / reload → Stage 1 does not repeat');
  // ⑦ 테스트 경로(?title=1&test=1): 첫 화면 → 곧바로 싸움 · 여정이 아니라 정지 창에 '대기실' 없음(ui_fix ③ 과 같은 규칙 — 10/17 부터 대기실 쪽 '책 모두 열림'은 이 길로 못 본다)
  //  인장 바꾸기 안 함 · 싸움의 유파 몫 플래그 그대로(= 모두) · 금화 그대로
  await q.evaluate(() => localStorage.removeItem('stillness.lobby.sealCoins.v1'));
  if (await fromTitle(q, '/?title=1&test=1') === 'draw') await pick(q, 0);
  assert.equal(await q.evaluate(() => localStorage.getItem('stillness.lobby.sealCoins.v1')), null); assert.equal((await progress(q)).coins, 2600); // 판을 열 때 인장을 바꾸지 않았다
  await q.evaluate(() => document.getElementById('btnPause').click()); await q.waitForFunction(() => game.state === 'paused', null, { timeout: 10000 });
  assert.equal(await q.evaluate(() => document.getElementById('btnLobby').hidden), true);
  await q.locator('#btnResume').click(); await q.waitForFunction(() => game.state === 'fight', null, { timeout: 10000 });
  const t = await q.evaluate(() => ({ fw: game.player.schoolFootwork, parry: game.player.schoolParry, secretStage: game.playerSecret.S ? 'open' : 'locked' }));
  assert.equal(t.fw, undefined); assert.equal(t.parry, undefined); // 테스트 경로는 플래그를 안 건다 = 지금처럼 모두
  const before = JSON.stringify(await progress(q)); await q.evaluate(() => game.enemy.die('기절', true)); await q.waitForFunction(() => game.state === 'paused', null, { timeout: 90000 });
  assert.equal(JSON.stringify(await progress(q)), before); assert.equal(await q.locator('#menuReward').isVisible(), false);
  checks.push('test route (?title=1&test=1): Stage 1 goes straight to the fight; no 대기실 in its pause (not a journey); no seal conversion; school kit flags untouched in the fight (= every book); coins unchanged');
  await sc.close();

  // ⑧ 폰: 대기실은 가로 화면만 (사장님 10/16 14:0x — docs/import/ui_fix_2026-10-16.md §11). 세로로 돌리면 싸움과 같은 '폰을 가로로 돌려 주세요'가 대기실을 덮고(누름도 막음)
  //  가로로 돌리면 그대로 · 대기실 안 '싸움은 가로 화면입니다' 줄은 없다(전 ⑧ 은 그 줄과 출발 뒤 안내가 서서히 나타나는 것을 봤다) · 미리보기 = 기기 화소 비 3
  const pc = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); await noAuth(pc);
  const r = await pc.newPage(); watch(r);
  const cover = () => r.evaluate(() => { const el = document.getElementById('rotate'); return { shown: getComputedStyle(el).display !== 'none', top: el.contains(document.elementFromPoint(innerWidth / 2, innerHeight / 2)) }; });
  assert.equal(await lobby(r, '/'), 'draw');
  assert.equal(await r.locator('#characterView').getAttribute('data-ratio'), '3');
  assert.equal(await shadow(r, `return root.querySelectorAll('#landscapeHint, .landscape-hint').length`), 0);
  assert.deepEqual(await cover(), { shown: false, top: false });
  await r.setViewportSize({ width: 390, height: 844 }); // 세로로
  assert.deepEqual(await cover(), { shown: true, top: true });
  await r.setViewportSize({ width: 844, height: 390 }); // 다시 가로로 — 대기실 그대로
  assert.deepEqual(await cover(), { shown: false, top: false });
  await depart(r, 'draw');
  assert.equal(await r.evaluate(() => getComputedStyle(document.getElementById('rotate')).animationName), 'none'); // 출발 뒤 서서히 나타나던 것 지움
  await r.setViewportSize({ width: 390, height: 844 }); assert.deepEqual(await cover(), { shown: true, top: true }); // 싸움(카드)도 그대로 덮음
  checks.push('phone: the lobby is landscape-only — in portrait the rotate screen covers it (and takes the taps), back to landscape it is as it was; no in-lobby landscape hint; no fade-in after departure; preview at device ratio 3');
  await pc.close();
  assert.deepEqual(errors, []);
} finally {
  fs.writeFileSync(`${out}/lobby_fix.json`, JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
}
console.log(`PASS ${checks.length} lobby-fix checks; errors ${errors.length}`);

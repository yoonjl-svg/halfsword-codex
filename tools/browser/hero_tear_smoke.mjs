// 용사의 눈물 실제 흐름 점검 (사장님 10/17 — docs/import/hero_tear_2026-10-17.md). 배포판 + 미리 보기 서버, 인증 서버는 막음(부르면 실패)
//  ① 대기실 방어구 칸: 케틀 햇 · 용사의 눈물 두 칸(그림 256 px · 레전드 빛) · 설명 카드(이름 · 레전드 · 글 · 능력 줄) · 장착 → 둘 다 '장착 중' · 미리보기 그대로(겉모습 변화 없음)
//  ② 장착하고 여정 → 카드 → 싸움: 플레이어 기력 무한(케틀 햇 덧까지 130 늘 가득) · 내 머리 위 막대 없음 · 상대 막대 그대로 · 몸에 붙은 것 없음(검객 메쉬 수가 ③과 같음)
//     상처를 끄고(판이 끝나지 않게 — 시험만) 상대 AI 는 그대로 싸우게 둔 채 손가락 끌기 · 톡 · 막기(F) 로 몰아붙여도 값 · 단계 · 탈진 · 빠르기가 그대로인지 시간에 따라 읽는다
//     (청구 시도 = 장부 spend 에 들어온 값 — 기력 무한이면 모두 거절되고 spent 0)
//  ③ 같은 흐름에 용사의 눈물 없이: 내 막대가 보이고 같은 몰아붙이기에 기력이 깎이고 지친다 (전과 같음)
//  ④ 케틀 햇만 벗고 용사의 눈물만: 맨머리 + 기력 무한 (두 자리가 따로) ⑤ 테스트 경로(여정이 아님)는 저장된 용사의 눈물을 읽지 않는다 (케틀 햇과 같은 규칙)
//  10/17 11:2x 흐름: 첫 화면 'Stage 1' → 곧바로 카드 → 정지 → 대기실 (tools/browser/to_lobby.mjs) · 대기실 출발 = 'Stage 입장'(첫 화면에서 펼친 같은 카드) · ③ 은 첫 화면에서 곧장 싸움
//  npm run build && npx vite preview --port 4304 →  node tools/browser/hero_tear_smoke.mjs http://127.0.0.1:4304 /tmp/<빈 폴더> [사진 폴더]
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { departTitle, lobbyFromBattle } from './to_lobby.mjs';
const base = process.argv[2] || 'http://127.0.0.1:4304', out = process.argv[3] || '/tmp/hero-tear', shots = process.argv[4] || out;
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const errors = [], checks = [], report = {};
const IGNORED = /deprecated parameters for the initialization function/;
const watch = (p) => { p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(m.text()); }); p.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); }); };
const shot = (p, name, opt = {}) => p.screenshot({ path: `${shots}/${name}.png`, ...opt });
async function context(seed = null, dpr = 1) { // 싸움 흐름은 화소 비 1 (소프트웨어 GL 이 느려 화소 비가 크면 게임 시간이 거의 안 흐른다) · 대기실 사진만 화소 비 3
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await ctx.route('https://*.supabase.co/**', (r) => { errors.push('auth server called: ' + r.request().url()); r.abort(); });
  await ctx.addInitScript((seed) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('stillness.journeyClears.v1', '0');
    for (const [k, v] of Object.entries(seed ?? {})) localStorage.setItem(k, v);
  }, seed);
  const p = await ctx.newPage(); watch(p);
  return { ctx, p };
}
async function title(p, url = '/?title=1&cards=longsword,rapier') { // 카드 고정 — 무작위 카드에 나뭇가지가 나와도 흐름이 같게 (lobby_fix_smoke 와 같은 주소)
  await p.goto(base + url, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.game?.player, null, { timeout: 90000 });
  if (await p.locator('#noticeDialog').evaluate((d) => d.open)) await p.locator('#confirmNotices').tap();
  await p.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 30000 });
}
async function lobby(p) { // 첫 화면 'Stage 1' → 곧바로 카드(무기 장착 없음) → 정지 → '대기실'
  await title(p);
  assert.equal(await departTitle(p, '#newJourney', 'tap'), 'draw');
  await lobbyFromBattle(p, 'tap');
}
const card = (p) => p.locator('#itemDetail').evaluate((e) => { const r = e.getBoundingClientRect(), f = e.closest('.inventory-frame').getBoundingClientRect(); return { hidden: e.hidden, tier: e.dataset.tier, name: e.querySelector('#itemName').textContent, rarity: e.querySelector('#itemRarity').textContent, description: e.querySelector('#itemDescription').textContent, abilityColor: getComputedStyle(e.querySelector('.item-ability')).color, inside: r.left >= f.left - .5 && r.right <= f.right + .5 && r.top >= f.top - .5 && r.bottom <= f.bottom + .5, overflow: e.scrollHeight > e.clientHeight + 1 }; });
const badges = (p) => p.locator('.inventory-item').evaluateAll((els) => els.map((e) => ({ id: e.dataset.item, on: !e.querySelector('.equipped-badge').hidden, label: e.getAttribute('aria-label') })));
async function pickFirst(p) { // 카드 → 첫 카드(롱소드) → 싸움 · 발이 풀릴 때까지 (첫 무대 훑기)
  await p.waitForFunction(() => game.state === 'draw' && game.draw.t > 0.6, null, { timeout: 90000 });
  await p.locator('#draw .wcard[data-i="0"]').tap();
  await p.waitForFunction(() => game.state === 'fight' && !game.player.feetHeld && game.stats.simTime > 1, null, { timeout: 180000 });
}
async function depart(p) { // 대기실 'Stage 입장'(무기 장착 없음) → 첫 화면에서 펼친 같은 카드 → 첫 카드
  assert.equal(await p.locator('#lobbyDepart').textContent(), 'Stage 입장');
  await p.locator('#lobbyDepart').tap();
  await pickFirst(p);
}
// 플레이어 몸에 붙은 그림 (몸 조각 · 칼 · 투구 · 손 — Fighter.meshes 의 group 아래 메쉬 수 · 그 메쉬들의 꼭짓점 수) — 용사의 눈물이 있든 없든 같아야 한다 (몸에 아무것도 안 붙임)
const meshCount = (p) => p.evaluate(() => { let n = 0, v = 0; for (const { group } of game.player.meshes) group.traverse((c) => { if (c.isMesh) { n++; v += c.geometry?.attributes?.position?.count ?? 0; } }); return `${n} meshes / ${v} vertices`; });
const bars = (p) => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.stamina-bar')].map((b) => [b.getAttribute('aria-label'), { hidden: b.hidden, now: b.getAttribute('aria-valuenow'), text: b.getAttribute('aria-valuetext') }])));
// 장부 엿보기: 플레이어 장부의 spend 에 들어온 청구(종류 · 양)를 센다 — 기력 무한이면 모두 거절(값 그대로), 보통이면 그대로 깎임 (시험만 — 게임 코드는 그대로)
const tapLedger = (p) => p.evaluate(() => {
  const s = game.player.stamina, orig = s.spend.bind(s), tried = {};
  s.spend = (kind, amount) => { if (amount > 0) { tried[kind] = (tried[kind] ?? 0) + amount; if (kind === 'block') window.__blocks = (window.__blocks ?? 0) + 1; } return orig(kind, amount); };
  window.__tried = tried; window.__blocks = 0;
  game.player.applyWound = () => {}; game.enemy.applyWound = () => {}; // 판이 끝나지 않게 (몸 · 칼 물리 · 상대 AI 는 그대로)
  document.getElementById('hint')?.classList.remove('show');
});
const st = (p) => p.evaluate(() => {
  const s = game.player.stamina, b = document.querySelector('.stamina-bar[aria-label="나 기력"]'), e = document.querySelector('.stamina-bar[aria-label="상대 기력"]');
  const r = (v) => Math.round(v * 100) / 100;
  return { t: r(game.stats.simTime), value: r(s.value), max: s.max, level: s.level, exhausted: s.exhausted, speed: s.speed, power: s.power, infinite: s.infinite,
    swings: s.counts.cut + s.counts.thrust, blocks: window.__blocks ?? 0, spent: r(Object.values(s.spent).reduce((a, x) => a + x, 0)), tried: Object.fromEntries(Object.entries(window.__tried ?? {}).map(([k, v]) => [k, r(v)])),
    myBar: b.hidden ? null : +b.getAttribute('aria-valuenow'), foeBar: e.hidden ? null : +e.getAttribute('aria-valuenow'), foeValue: r(game.enemy.stamina.value), foeSwings: game.enemy.stamina.counts.cut + game.enemy.stamina.counts.thrust };
});
const frame = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => r()))); // 게임 화면 한 장이 지나갈 때까지
/** 화면 오른쪽 절반에서 손가락 하나로 좌우 끌기 (stamina_route_probe 와 같은 사건) — 움직임 하나마다 게임 화면 한 장 (느린 소프트웨어 GL 에서도 끌기가 뭉치지 않게) */
async function swipe(p, dir, id, y = 200) {
  const [x0, x1] = dir > 0 ? [560, 800] : [800, 560];
  await p.evaluate(({ x0, y, id }) => { document.getElementById('game').dispatchEvent(new PointerEvent('pointerdown', { pointerId: id, pointerType: 'touch', clientX: x0, clientY: y, bubbles: true, isPrimary: true, button: 0 })); }, { x0, y, id });
  for (let i = 1; i <= 6; i++) { await p.evaluate(({ x, y, id }) => window.dispatchEvent(new PointerEvent('pointermove', { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true })), { x: x0 + (x1 - x0) * i / 6, y, id }); await frame(p); }
  await p.evaluate(({ x1, y, id }) => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, pointerType: 'touch', clientX: x1, clientY: y, bubbles: true, isPrimary: true, button: 0 })), { x1, y, id });
}
const tap = (p, id) => p.evaluate((id) => { const o = { pointerId: id, pointerType: 'touch', clientX: 700, clientY: 170, bubbles: true, isPrimary: true, button: 0 }; document.getElementById('game').dispatchEvent(new PointerEvent('pointerdown', o)); window.dispatchEvent(new PointerEvent('pointerup', o)); }, id);
/** 몰아붙이기 (상대 AI 는 그대로 싸운다 · 모든 대기는 게임 시간):
 *  ① 막기 — 앞으로 1 초 걸은 뒤(W) 막기(F)를 쥐고 상대 공격을 칼로 받는다: 막아 받기 청구 시도가 둘 나올 때까지(많아야 게임 14 초) · 0.5 초마다 장부를 읽는다
 *  ② 베기 — 앞 1/3 은 앞으로 걸으며 끌기(베기) n 번 · 세 번마다 톡(찌르기) · 2/3 에서 막기 게임 2 초 · 끌기마다 게임 0.3 초(긋기 끊김 0.12 초보다 길게) 기다려 읽는다 */
async function hammer(p, n, idBase) {
  const line = [], waitGame = async (sec) => { const t = await p.evaluate(() => game.stats.simTime); await p.waitForFunction(([t, sec]) => game.stats.simTime > t + sec, [t, sec], { timeout: 120000, polling: 50 }); };
  const blocks = () => p.evaluate(() => window.__blocks ?? 0);
  await p.keyboard.down('KeyW'); await waitGame(1); await p.keyboard.up('KeyW');
  const g0 = await p.evaluate(() => game.stats.simTime);
  await p.keyboard.down('KeyF');
  while ((await blocks()) < 2 && (await p.evaluate(() => game.stats.simTime)) < g0 + 14) { await waitGame(0.5); line.push({ phase: 'guard', ...(await st(p)) }); }
  await p.keyboard.up('KeyF');
  await p.keyboard.down('KeyW');
  for (let k = 0; k < n; k++) {
    if (k === Math.floor(n / 3)) await p.keyboard.up('KeyW');
    await swipe(p, k % 2 ? -1 : 1, idBase + k);
    if (k % 3 === 2) { await waitGame(0.15); await tap(p, idBase + 500 + k); }
    if (k === Math.floor((n * 2) / 3)) { await p.keyboard.down('KeyF'); await waitGame(2); await p.keyboard.up('KeyF'); }
    await waitGame(0.3);
    line.push({ phase: 'swing', ...(await st(p)) });
  }
  await p.keyboard.up('KeyW');
  return line;
}
async function overlay(p, text) { // 사진에만 붙이는 읽기 표 (게임 화면 아님 — 찍고 바로 뗀다)
  await p.evaluate((text) => { const d = document.createElement('div'); d.id = '__probe'; d.textContent = text; d.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;padding:4px 8px;font:600 11px/1.45 monospace;white-space:pre;color:#f3e9d8;background:rgba(10,8,6,.72);border:1px solid rgba(243,233,216,.35);border-radius:4px;pointer-events:none'; document.body.append(d); }, text);
}
const unoverlay = (p) => p.evaluate(() => document.getElementById('__probe')?.remove());
// 두 머리 위 막대 자리 (stamina_hud.js 와 같은 점 — 머리 + 0.28 m 를 화면에) · 사진을 확대해 잘라 볼 때 쓴다
const spots = (p) => p.evaluate(() => { const v = new game.THREE.Vector3(); return Object.fromEntries(['player', 'enemy'].map((w) => { const h = game[w].bodies.head.translation(); v.set(h.x, h.y + 0.28, h.z).project(game.camera); return [w, [Math.round((v.x + 1) * innerWidth / 2), Math.round((1 - v.y) * innerHeight / 2)]]; })); });
const summary = (line) => ({ samples: line.length, guardSamples: line.filter((s) => s.phase === 'guard').length, blocks: line.at(-1).blocks, minValue: Math.min(...line.map((s) => s.value)), maxLevel: Math.max(...line.map((s) => s.level)), exhaustedSamples: line.filter((s) => s.exhausted).length, minSpeed: Math.min(...line.map((s) => s.speed)), swings: line.at(-1).swings, spent: line.at(-1).spent, tried: line.at(-1).tried, myBarShown: line.filter((s) => s.myBar != null).length, foeBarShown: line.filter((s) => s.foeBar != null).length, foeSwings: line.at(-1).foeSwings, simSeconds: +(line.at(-1).t - line[0].t).toFixed(2) });

try {
  // ── 사진: 대기실 방어구 칸 · 설명 카드 · 장착 (화소 비 3 — 폰과 같은 비 · 아래 ①과 같은 흐름) ──
  {
    const P = await context(null, 3);
    await lobby(P.p);
    await P.p.locator('#tabArmor').tap();
    await P.p.locator('.inventory-item img').evaluateAll((els) => Promise.all(els.map((i) => i.decode().catch(() => {}))));
    await P.p.waitForTimeout(400); await shot(P.p, '01_lobby_armor_list');
    await P.p.locator('button[data-armor=hero_tear]').tap(); await P.p.waitForTimeout(200); await shot(P.p, '02_tear_card'); // 새 기기 = 처음부터 장착 중 (사장님 10/17)
    await P.p.locator('#unequipItem').tap(); await P.p.waitForTimeout(200); await shot(P.p, '03_tear_unequipped');
    await P.ctx.close();
  }
  // ── ① 대기실 ──
  const A = await context();
  const p = A.p;
  await lobby(p);
  await p.locator('#tabArmor').tap();
  assert.equal(await p.locator('#inventoryCount').textContent(), '2개');
  assert.equal(await p.locator('.inventory-item').count(), 2); assert.equal(await p.locator('.inventory-slot').count(), 18);
  const thumbs = await p.locator('.inventory-item img').evaluateAll((els) => Promise.all(els.map((i) => i.decode().catch(() => {}).then(() => ({ src: i.getAttribute('src'), alt: i.alt, ok: i.complete && i.naturalWidth === 256, fit: i.dataset.fit })))));
  assert.deepEqual(thumbs.map((t) => [t.src, t.alt, t.ok]), [['ui/armor/kettle.webp', '케틀 햇', true], ['ui/armor/hero_tear.webp', '용사의 눈물', true]], JSON.stringify(thumbs));
  assert.deepEqual(await p.locator('.inventory-item').evaluateAll((els) => els.map((e) => [e.dataset.armor, e.dataset.tier])), [['kettle', 'legend'], ['hero_tear', 'legend']]);
  assert.deepEqual((await badges(p)).map((b) => [b.id, b.on]), [['kettle', true], ['hero_tear', true]]); // 새 기기: 둘 다 씀 (사장님 10/17 '용사의 눈물은 장착을 기본으로')
  await p.waitForTimeout(400);
  checks.push('lobby (title Stage 1 → cards → pause → 대기실) armor tab: 2 items (kettle hat · hero tear), both thumbnails load at 256 px, legend glow; new device = kettle on, tear on (default equipped)');
  const view = await p.locator('#characterView').boundingBox();
  const frames = () => p.locator('#characterView').getAttribute('data-frames');
  const before = await p.screenshot({ clip: view }), framesBefore = await frames();
  await p.locator('button[data-armor=hero_tear]').tap();
  const k = await card(p);
  assert.deepEqual([k.hidden, k.tier, k.name, k.rarity, k.description], [false, 'legend', '용사의 눈물', '레전드', '물방울 모양의 작은 다이아 목걸이. 옷 안에 걸어 겉으로는 보이지 않는다. (기력 무한)']);
  assert.equal(k.abilityColor, 'rgb(255, 210, 74)'); assert.ok(k.inside && !k.overflow, JSON.stringify(k));
  assert.equal(await p.locator('#equipItem').isEnabled(), false); assert.equal(await p.locator('#unequipItem').isEnabled(), true); // 처음부터 장착 중
  await p.locator('#unequipItem').tap();
  assert.deepEqual((await badges(p)).map((b) => [b.id, b.on]), [['kettle', true], ['hero_tear', false]]); // 벗음 — 케틀 햇은 그대로 (자리가 다름)
  assert.match(await p.locator('#equipmentStatus').textContent(), /^용사의 눈물 장착 해제/);
  assert.equal(await p.evaluate(() => localStorage.getItem('stillness.lobby.neck.v1')), '{"version":1,"neck":null}'); // 벗은 채로 저장
  await p.locator('#equipItem').tap();
  assert.deepEqual((await badges(p)).map((b) => [b.id, b.on]), [['kettle', true], ['hero_tear', true]]); // 다시 둘 다 장착
  assert.match(await p.locator('#equipmentStatus').textContent(), /^용사의 눈물 장착/);
  assert.equal(await p.locator('#equipItem').isEnabled(), false); assert.equal(await p.locator('#unequipItem').isEnabled(), true);
  assert.equal(await p.locator('#characterView').getAttribute('data-armor'), 'kettle'); // 미리보기 투구 그대로
  assert.equal(await p.evaluate(() => document.querySelector('#gameEntrance').shadowRoot.getElementById('characterView').lobbyPreview.fighter.helmetGroup.visible), true);
  await p.waitForTimeout(300);
  const after = await p.screenshot({ clip: view });
  assert.ok(before.equals(after), 'preview pixels changed after unequipping/equipping the tear'); // 겉모습 변화 없음 — 미리보기 화소가 한 점도 안 바뀜
  assert.equal(await frames(), framesBefore); // 미리보기를 다시 그리지도 않았다 (목 자리는 미리보기에 손대지 않음)
  assert.deepEqual(await p.evaluate(() => [localStorage.getItem('stillness.lobby.armor.v1'), localStorage.getItem('stillness.lobby.neck.v1')]), [null, '{"version":1,"neck":"hero_tear"}']); // 케틀 햇은 기본 장착(저장 없음) 그대로
  await p.locator('button[data-armor=hero_tear]').tap(); assert.equal((await card(p)).hidden, true); await p.locator('button[data-armor=hero_tear]').tap(); assert.equal((await card(p)).hidden, false); // 카드 닫았다 다시 — 장착 중 그대로
  assert.deepEqual((await badges(p)).map((b) => b.on), [true, true]);
  checks.push('tear card: 용사의 눈물 · 레전드 · description + (기력 무한) in legend colour, inside the frame; new device = 장착 중; unequip → saved null, kettle stays; equip again → both items 장착 중; preview pixels identical before/after (no look change); saved in stillness.lobby.neck.v1');

  // ── ② 장착하고 싸움 ──
  await depart(p);
  const fight = await p.evaluate(() => ({ infinite: game.player.stamina.infinite, foeInfinite: game.enemy.stamina.infinite, max: game.player.stamina.max, value: game.player.stamina.value, helmet: game.player.hasHelmet, weapon: game.player.weapon.id }));
  assert.deepEqual(fight, { infinite: true, foeInfinite: false, max: 130, value: 130, helmet: true, weapon: 'longsword' });
  const meshesTear = await meshCount(p);
  await p.waitForFunction(() => !document.querySelector('.stamina-bar[aria-label="상대 기력"]').hidden, null, { timeout: 30000 }).catch(() => {});
  const b0 = await bars(p);
  assert.equal(b0['나 기력'].hidden, true); assert.equal(b0['상대 기력'].hidden, false, JSON.stringify(b0));
  report.tearSpots = await spots(p); await shot(p, '04_fight_tear_start');
  await tapLedger(p);
  const lineTear = await hammer(p, 36, 100);
  const sTear = summary(lineTear);
  report.tear = { fight, meshes: meshesTear, summary: sTear, line: lineTear };
  assert.equal(sTear.minValue, 130); assert.equal(sTear.maxLevel, 0); assert.equal(sTear.exhaustedSamples, 0); assert.equal(sTear.minSpeed, 1);
  assert.equal(sTear.spent, 0); assert.equal(sTear.myBarShown, 0); assert.ok(sTear.foeBarShown > 0);
  assert.ok(sTear.blocks >= 1, `block attempts ${sTear.blocks}`); // 상대 공격을 칼로 받았다 — 막아 받기 청구 시도도 거절
  assert.ok(sTear.swings >= 20, `player swings ${sTear.swings}`); assert.ok((sTear.tried.attack ?? 0) >= 20 * 7, JSON.stringify(sTear.tried)); // 청구 시도가 실제로 많았다 — 모두 거절
  const last = lineTear.at(-1);
  await overlay(p, `용사의 눈물 장착 · 게임 ${sTear.simSeconds}s 몰아붙인 뒤\n기력 ${last.value}/${last.max} · 지침 ${sTear.maxLevel} · 탈진 ${sTear.exhaustedSamples} · 빠르기 ${sTear.minSpeed}\n휘두름 ${sTear.swings} · 막아 받기 ${sTear.blocks} · 청구 시도 ${Object.entries(sTear.tried).map(([k, v]) => `${k} ${v}`).join(' · ')} → 깎인 것 ${sTear.spent}\n내 막대 ${sTear.myBarShown}/${sTear.samples} 번 보임 · 상대 막대 ${last.foeBar ?? '-'}% (상대 기력 ${last.foeValue})`);
  await shot(p, '05_fight_tear_after_swings'); await unoverlay(p);
  checks.push(`tear fight (lobby Stage 입장 → the same cards dealt from the title): infinite on player only (foe false) · max 130 with kettle · my bar never shown, foe bar shown · guard phase ${sTear.blocks} blocked foe attacks + ${sTear.swings} swings/thrusts + parry hold over ${sTear.simSeconds} s game time: min value 130, level 0, exhausted 0, speed 1, spent 0 (tried ${JSON.stringify(sTear.tried)})`);
  await A.ctx.close();

  // ── ③ 용사의 눈물 없이 (전과 같음 — 이제 처음부터 걸려 있으니 벗은 저장으로 시작) · 첫 화면에서 곧장 (대기실을 거치지 않아도 저장된 장착을 읽는다) ──
  const B = await context({ 'stillness.lobby.neck.v1': '{"version":1,"neck":null}' });
  await title(B.p);
  assert.equal(await departTitle(B.p, '#newJourney', 'tap'), 'draw');
  await pickFirst(B.p);
  const plainFight = await B.p.evaluate(() => ({ infinite: game.player.stamina.infinite, max: game.player.stamina.max, value: game.player.stamina.value, helmet: game.player.hasHelmet }));
  assert.deepEqual(plainFight, { infinite: false, max: 130, value: 130, helmet: true });
  const meshesPlain = await meshCount(B.p);
  assert.equal(meshesTear, meshesPlain, `fighter meshes with tear ${meshesTear} vs without ${meshesPlain}`); // 몸 · 칼 · 투구 메쉬 수가 같다 — 목걸이를 몸에 붙이지 않았다
  await B.p.waitForFunction(() => !document.querySelector('.stamina-bar[aria-label="나 기력"]').hidden, null, { timeout: 30000 });
  report.plainSpots = await spots(B.p); await shot(B.p, '06_fight_plain_start');
  await tapLedger(B.p);
  const linePlain = await hammer(B.p, 36, 100);
  const sPlain = summary(linePlain);
  report.plain = { fight: plainFight, meshes: meshesPlain, summary: sPlain, line: linePlain };
  assert.ok(sPlain.myBarShown > 0); assert.ok(sPlain.minValue < 0, `plain min ${sPlain.minValue}`); assert.ok(sPlain.maxLevel >= 1); assert.ok(sPlain.spent > 100);
  const lastP = linePlain.at(-1);
  await overlay(B.p, `용사의 눈물 없음 (전과 같음) · 게임 ${sPlain.simSeconds}s 몰아붙인 뒤\n기력 ${lastP.value}/${lastP.max} · 가장 낮음 ${sPlain.minValue} · 지침 최대 ${sPlain.maxLevel} · 탈진 ${sPlain.exhaustedSamples}/${sPlain.samples}\n휘두름 ${sPlain.swings} · 막아 받기 ${sPlain.blocks} · 깎인 것 ${sPlain.spent}\n내 막대 ${sPlain.myBarShown}/${sPlain.samples} 번 보임 (지금 ${lastP.myBar ?? '-'}%)`);
  await shot(B.p, '07_fight_plain_after_swings'); await unoverlay(B.p);
  checks.push(`without tear (saved unequipped, Stage 1 on the title straight to the cards — no lobby): my bar shown (${sPlain.myBarShown}/${sPlain.samples}) · same hammering drains: min ${sPlain.minValue}, max level ${sPlain.maxLevel}, exhausted samples ${sPlain.exhaustedSamples}, spent ${sPlain.spent}; fighter mesh count equal with/without tear (${meshesPlain})`);
  await B.ctx.close();

  // ── ④ 케틀 햇만 벗고 용사의 눈물만 ──
  const C = await context({ 'stillness.lobby.armor.v1': '{"version":1,"armor":null}', 'stillness.lobby.neck.v1': '{"version":1,"neck":"hero_tear"}' });
  await lobby(C.p);
  await C.p.locator('#tabArmor').tap();
  assert.deepEqual((await badges(C.p)).map((b) => [b.id, b.on]), [['kettle', false], ['hero_tear', true]]);
  assert.equal(await C.p.locator('#characterView').getAttribute('data-armor'), '');
  await depart(C.p);
  assert.deepEqual(await C.p.evaluate(() => [game.player.hasHelmet, game.player.stamina.infinite, game.player.stamina.max, document.querySelector('.stamina-bar[aria-label="나 기력"]').hidden]), [false, true, 100, true]);
  checks.push('kettle off + tear on: bare head (kettle rule unchanged) + infinite stamina (max 100) + no bar — the two slots are independent');
  await C.ctx.close();

  // ── ⑤ 테스트 경로 (여정 아님) — 저장된 용사의 눈물을 읽지 않는다 ──
  const D = await context({ 'stillness.lobby.neck.v1': '{"version":1,"neck":"hero_tear"}' });
  await D.p.goto(`${base}/index.html?test=1&weapon=longsword&hero=player&foe=isolde&stage=castle&openSweep=0`, { waitUntil: 'networkidle' });
  await D.p.waitForFunction(() => window.game?.player?.sword && document.getElementById('btnStart'), null, { timeout: 120000 });
  await D.p.evaluate(() => document.getElementById('btnStart').click());
  await D.p.waitForFunction(() => game.state === 'fight' && !game.player.feetHeld, null, { timeout: 120000 });
  assert.deepEqual(await D.p.evaluate(() => [game.player.stamina.infinite, game.enemy.stamina.infinite]), [false, false]);
  await D.p.waitForFunction(() => !document.querySelector('.stamina-bar[aria-label="나 기력"]').hidden, null, { timeout: 30000 });
  checks.push('test route (not a journey) ignores the saved tear — same rule as the kettle hat; bar shown');
  await D.ctx.close();
  assert.deepEqual(errors, []);
} finally {
  fs.writeFileSync(`${out}/hero_tear.json`, JSON.stringify({ checks, errors, report }, null, 2));
  await browser.close();
}
console.log(checks.map((c, i) => `${i + 1}. ${c}`).join('\n'));
console.log(`PASS ${checks.length} hero-tear checks; errors ${errors.length}`);

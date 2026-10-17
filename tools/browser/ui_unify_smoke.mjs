// 첫 화면·대기실 ↔ 전투 화면 맞추기 점검 (사장님 10/16 15:3x ② ③ ⑤ ⑥ ⑨ · 16:0x — docs/import/ui_unify_2026-10-16.md §9) — 배포판 + 미리 보기 서버, 인증 서버는 막음(부르면 실패)
//  ① 단추 = 싸움 화면 단추: 싸움 #btnStart(주) · 정지 창 #btnResume(부) 와 첫 화면 · 창 · 대기실 단추의 계산값(모서리 · 바탕 · 글 색 · 글꼴 · 크기 · 굵기 · 테두리 · 패딩 · 최소 높이 · 줄 높이)이 같다
//     — 다른 것은 자리 때문만: 폭 · 그림 위 부 단추 바탕(= 싸움 창 .card 바탕) · 작은 부 단추(글 12 · 패딩 6 12) · 누를 수 없는 단추(흐리게 .4)
//  ② 픽셀 단추 흔적 없음: 누르는 동안 내려앉기 없음 · 모서리 8 · 납작한 바탕(그러데이션 · 그림자 · 잘라 낸 모서리 · 글 그림자 없음) · 나무 판자 CSS 없음 ·
//     첫 화면 나타나기 = 픽셀 제목 글자만 steps(7), 단추 · 아래 줄은 매끈하게
//  ③ 미닫이: '화면 60 fps 제한' · '지난 업데이트 숨김' = 싸움 화면 .toggle 과 같은 꼴(44 × 24 · 손잡이 18) · role=switch · aria-checked · 하는 일 · 저장 그대로
//  ④ 호칭 내림 상자(16:0x): 단추 = 부 단추 꼴(금색 아님) · 누르면 바로 아래로 · 반투명(알파 < 1) · 가진 호칭만 · '(호칭 없음)' 같은 글 없음 · Esc · 바깥 누름으로 닫힘 · 방향키 · 고른 호칭 저장(새로 고쳐도)
//  ⑤ 대표 유파 칸 없음
//  ⑥ 세 칸 위아래 줄 같음 · 사슬 틀 두께 셋 다 14 · 재고 틀 = 별자리 틀(크기 · 자리) · 재고 틀 안 남는 띠 없음 · 캐릭터 카드 약 2 : 3 · 틀 길이 = 사슬 마디(12 px)의 배수 — 844×390 · 932×430 · 1280×720
//  ⑦ 칸 그림: 보이는 부분이 칸의 약 80 % · 매끈하게(픽셀 확대 아님) · 뒤에 등급 빛(케틀 햇 레전드 · 나뭇가지 쓰레기) · '장착 중'이 그림을 안 가림 · 금화 그림 픽셀 확대 아님
//  10/17 11:2x: 첫 화면 주 단추 = 'Stage 1'(전 '처음부터') · 한글 제목 줄 없음(이름은 Stillness 하나) · 대기실 = 첫 화면 → 곧바로 카드 → 정지 → '대기실'(tools/browser/to_lobby.mjs) — 대기실 출발 단추는 늘 'Stage 입장'(12:1x — 전 '여정 시작' · '여정 이어가기')
//  npm run build && node tools/pwa/build.mjs && npx vite preview --port 5261 →  node tools/browser/ui_unify_smoke.mjs http://127.0.0.1:5261 /tmp/<빈 폴더>
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { titleToLobby } from './to_lobby.mjs';
const base = process.argv[2] || 'http://127.0.0.1:5261', out = process.argv[3] || '/tmp/ui-unify';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const errors = [], checks = [];
const IGNORED = /deprecated parameters for the initialization function/;
const watch = (p) => { p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(m.text()); }); p.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); }); };
const noAuth = (c) => c.route('https://*.supabase.co/**', (r) => { errors.push('auth server called: ' + r.request().url()); r.abort(); });
const PROPS = ['borderRadius', 'backgroundColor', 'color', 'fontFamily', 'fontSize', 'fontWeight', 'borderTopWidth', 'borderTopStyle', 'borderTopColor', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'minHeight', 'lineHeight', 'letterSpacing'];
// 계산값 읽기 — 싸움 화면(문서) · 첫 화면/대기실(Shadow DOM) 같은 함수
const READ = `(sel, inShadow, props) => { const root = inShadow ? document.querySelector('#gameEntrance').shadowRoot : document; const e = root.querySelector(sel); if (!e) return null; const s = getComputedStyle(e), r = e.getBoundingClientRect();
  const o = Object.fromEntries(props.map((k) => [k, s[k]])); o.height = +r.height.toFixed(2); o.width = +r.width.toFixed(2); o.opacity = s.opacity; o.transform = s.transform; o.boxShadow = s.boxShadow; o.backgroundImage = s.backgroundImage; o.clipPath = s.clipPath; o.textShadow = s.textShadow; return o; }`;
const read = (p, sel, inShadow = true) => p.evaluate(`(${READ})(${JSON.stringify(sel)}, ${inShadow}, ${JSON.stringify(PROPS)})`);
const shadow = (p, js) => p.evaluate(`(()=>{const root=document.querySelector('#gameEntrance')?.shadowRoot;${js}})()`);
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));
const same = (a, b, keys, what) => { for (const k of keys) assert.equal(a[k], b[k], `${what}: ${k} ${a[k]} ≠ battle ${b[k]}`); };
async function title(p) {
  await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
  if (await p.locator('#noticeDialog').evaluate((d) => d.open)) await p.locator('#confirmNotices').click();
  await p.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 20000 });
}
const toLobby = (p) => titleToLobby(p); // 첫 화면 'Stage 1' → 곧바로 카드 → 정지 → '대기실'
const report = {};

try {
  // ── ① 싸움 화면 단추 = 첫 화면 · 대기실 단추 (낮은 화면 844×390 = 패딩 10/8 · 큰 화면 1280×720 = 13/11) ──
  for (const [size, w, h] of [['844x390', 844, 390], ['1280x720', 1280, 720]]) {
    const bc = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' }); await noAuth(bc);
    const b = await bc.newPage(); watch(b);
    await b.goto(base + '/?stage=poseidon&weapon=longsword', { waitUntil: 'networkidle' }); await b.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
    const battle = { primary: await read(b, '#btnStart', false), toggle: await read(b, '.toggle', false), card: await read(b, '.card', false) };
    battle.knob = await b.evaluate(() => { const s = getComputedStyle(document.querySelector('.toggle'), '::after'); return { w: s.width, h: s.height, left: s.left, bg: s.backgroundColor }; });
    await b.locator('#btnStart').click(); await b.waitForFunction(() => game.state === 'fight', null, { timeout: 60000 });
    await b.locator('#btnPause').click(); await b.waitForFunction(() => game.state === 'paused', null, { timeout: 10000 });
    battle.secondary = await read(b, '#btnResume', false);
    await bc.close();

    const ec = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' }); await noAuth(ec);
    await ec.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('stillness.lobby.progress.v1', JSON.stringify({ version: 1, coins: 50, heads: 0, titles: [], title: '여행자', acquisitions: [{ receipt: 'skillbook:german:1', kind: 'skillbook' }] })); } });
    const p = await ec.newPage(); watch(p);
    await p.goto(base + '/', { waitUntil: 'networkidle' }); await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
    const got = {};
    got['공지 확인'] = await read(p, '#confirmNotices'); got['지난 업데이트 숨김'] = await read(p, '#hideRead');
    await title(p);
    assert.deepEqual(await shadow(p, `return ['newJourney', 'continueJourney'].map((id) => root.getElementById(id).textContent.trim());`), ['Stage 1', '이어하기']);
    got['Stage 1'] = await read(p, '#newJourney'); got['이어하기'] = await read(p, '#continueJourney'); got['공지사항'] = await read(p, '#openNotices');
    await p.locator('#openSettings').click(); await p.waitForFunction(() => !document.querySelector('#gameEntrance').shadowRoot.getElementById('titleFps').disabled);
    got['설정 확인'] = await read(p, '#closeSettings'); got['60 fps 제한'] = await read(p, '#titleFps');
    await p.locator('#closeSettings').click();
    await p.waitForFunction(() => !document.querySelector('#gameEntrance').shadowRoot.getElementById('openAccount').disabled, null, { timeout: 20000 });
    await p.locator('#openAccount').click(); got['인증번호 받기'] = await read(p, '#accountSend'); got['계정 닫기'] = await read(p, '#closeAccount'); await p.locator('#closeAccount').click();
    await toLobby(p);
    assert.equal(await shadow(p, `return root.getElementById('lobbyDepart').textContent.trim();`), 'Stage 입장'); // 출발 단추 글은 하나 (12:1x · 하는 일은 이어하기 지점부터)
    got['Stage 입장'] = await read(p, '#lobbyDepart'); got['첫 화면'] = await read(p, '#lobbyBack');
    assert.equal((await shadow(p, `return root.getElementById('lobbyBack').textContent.trim();`)), '첫 화면'); // 화살표 없음 — 첫 화면 '공지사항'과 같은 꼴 (사장님 18:0x) · 글 '첫 화면'(12:2x — 전 '첫 화면으로')
    await p.locator('[data-weapon=tree_branch]').click();
    got['장착(누를 수 있음)'] = await read(p, '#equipItem'); got['해제(누를 수 없음)'] = await read(p, '#unequipItem');
    await p.locator('#tabSkills').click(); await p.locator('.book-node[data-book="1"]').click();
    got['봉인(누를 수 있음)'] = await read(p, '#sealBook'); got['사용(누를 수 없음)'] = await read(p, '#useBook');
    await p.locator('.detail-close').click();
    await p.locator('#editName').click(); got['이름 저장'] = await read(p, '#nameForm button[type=submit]'); got['이름 취소'] = await read(p, '#cancelName'); await p.locator('#cancelName').click();
    // 주 단추: 모든 값 같음 + 높이 같음 (폭만 자리 값)
    const ALL = PROPS;
    for (const k of ['Stage 1', '공지 확인', '설정 확인', '인증번호 받기', 'Stage 입장', '장착(누를 수 있음)', '봉인(누를 수 있음)', '이름 저장']) { same(got[k], battle.primary, ALL, k); assert.equal(got[k].height, battle.primary.height, `${k} height`); }
    // 부 단추: 모든 값 같음 + 높이 같음
    for (const k of ['계정 닫기', '이름 취소']) { same(got[k], battle.secondary, ALL, k); assert.equal(got[k].height, battle.secondary.height, `${k} height`); }
    // 그림 위 부 단추(이어하기): 바탕만 싸움 창(.card) 바탕 — 싸움 부 단추는 늘 창 위에 있다
    same(got['이어하기'], battle.secondary, ALL.filter((k) => k !== 'backgroundColor'), '이어하기'); assert.equal(got['이어하기'].backgroundColor, battle.card.backgroundColor); assert.equal(got['이어하기'].height, battle.secondary.height);
    // 작은 부 단추(아래 줄 · 첫 화면): 글 크기 12 · 패딩만 다름
    same(got['첫 화면'], got['공지사항'], PROPS.filter((k) => !/width|height/i.test(k) || /border|min/i.test(k)), '첫 화면 = 공지사항'); // 사장님 18:0x '첫 화면의 공지사항처럼'
    // 줄 높이는 글자 크기 + 2px (entrance_ui.css — 10/17 라틴 글자 단추 높이 고침) → 작은 단추는 12 + 2 = 14px, 싸움 부 단추는 16px
    for (const k of ['공지사항', '첫 화면']) { same(got[k], battle.secondary, ['borderRadius', 'color', 'fontFamily', 'fontWeight', 'borderTopWidth', 'borderTopStyle', 'borderTopColor', 'minHeight', 'letterSpacing'], k); assert.equal(got[k].fontSize, '12px'); assert.equal(got[k].lineHeight, '14px'); assert.equal(got[k].backgroundColor, battle.card.backgroundColor); }
    // 누를 수 없는 짝 단추: 부 단추 꼴 + 흐리게 .4
    for (const k of ['해제(누를 수 없음)', '사용(누를 수 없음)']) { same(got[k], battle.secondary, ALL, k); assert.equal(got[k].opacity, '0.4'); }
    // 미닫이 = 싸움 .toggle (켜진 꼴 — 싸움 메뉴의 60 fps 는 처음에 켜져 있다)
    for (const k of ['60 fps 제한']) { same(got[k], battle.toggle, ['width', 'height', 'borderRadius', 'borderTopWidth', 'borderTopStyle', 'borderTopColor', 'backgroundColor'], k); }
    report[size] = { battle: { primary: pick(battle.primary, [...ALL, 'height', 'width']), secondary: pick(battle.secondary, [...ALL, 'height', 'width']), card: battle.card.backgroundColor }, entrance: Object.fromEntries(Object.entries(got).map(([k, v]) => [k, pick(v, ['height', 'width', 'backgroundColor', 'paddingTop', 'fontSize', 'opacity'])])) };
    checks.push(`${size}: entrance primaries (Stage 1 · 공지/설정 확인 · 인증번호 받기 · Stage 입장 · 장착 · 봉인 · 이름 저장) and secondaries (계정 닫기 · 이름 취소) equal the battle #btnStart / pause #btnResume on ${ALL.length} computed values and height (${battle.primary.height} / ${battle.secondary.height}); 이어하기 = secondary on the battle card fill; small secondaries 12 px; disabled pair = secondary at .4; toggles = battle .toggle`);
    await ec.close();
  }

  // ── ② 픽셀 단추 흔적 · ③ 미닫이 (폰 가로 844×390 · 터치) ──
  {
    const c = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await noAuth(c);
    const p = await c.newPage(); watch(p);
    await p.goto(base + '/', { waitUntil: 'networkidle' }); await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
    const css = await shadow(p, `return [...root.querySelectorAll('style')].map((s) => s.textContent).join('\\n')`);
    assert.ok(!/translateY\(3px\)/.test(css) && !/--button-fill/.test(css), 'no wood-plank button CSS (press drop · plank fill)');
    // 공지 '지난 업데이트 숨김' 미닫이
    const sw = (sel) => shadow(p, `const e=root.querySelector('${sel}'),s=getComputedStyle(e),k=getComputedStyle(e,'::after');return {role:e.getAttribute('role'),checked:e.getAttribute('aria-checked'),w:s.width,h:s.height,radius:s.borderRadius,bg:s.backgroundColor,knob:[k.width,k.height,k.left,k.borderRadius],label:e.getAttribute('aria-labelledby')&&root.getElementById(e.getAttribute('aria-labelledby')).textContent}`);
    let t = await sw('#hideRead');
    assert.deepEqual({ ...t, bg: undefined, knob: undefined }, { role: 'switch', checked: 'false', w: '44px', h: '24px', radius: '12px', bg: undefined, knob: undefined, label: '지난 업데이트 숨김' });
    assert.equal(t.bg, 'rgba(0, 0, 0, 0.4)'); assert.deepEqual(t.knob, ['18px', '18px', '2px', '50%']);
    await p.locator('.hide-read span').tap(); // 글을 눌러도 켜진다
    await p.waitForTimeout(250); t = await sw('#hideRead'); assert.equal(t.checked, 'true'); assert.equal(t.bg, 'rgb(217, 164, 65)'); assert.equal(t.knob[2], '22px');
    await p.locator('#hideRead').tap(); assert.equal((await sw('#hideRead')).checked, 'false'); await p.locator('#hideRead').tap(); // 다시 켬 → 확인에서 저장
    await p.locator('#confirmNotices').tap();
    assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('stillness.title.notices.v1')).hideRead), true);
    checks.push('notices: 지난 업데이트 숨김 = switch (role=switch · aria-checked · label) 44×24 pill with an 18 px knob 2 → 22 px, accent when on; label tap toggles; saved on 확인 as before');
    await p.waitForFunction(() => document.querySelector('#gameEntrance').shadowRoot.getElementById('entrance').dataset.phase === 'ready', null, { timeout: 20000 });
    // 나타나기: 픽셀 제목 글자(STILLNESS · 가름줄)만 끊어서 · 단추와 아래 줄은 매끈하게 · 한글 제목 줄 없음 (10/17 — 이름은 Stillness 하나)
    const appear = await shadow(p, `const t=(s)=>getComputedStyle(root.querySelector(s)).transitionTimingFunction;return {wordmark:t('.pixel-wordmark'),rule:t('.title-rule'),buttons:t('.start-actions'),footer:t('.title-footer'),screen:getComputedStyle(root.querySelector('.title-screen')).transitionDuration,korean:root.querySelectorAll('.title-korean').length,name:root.querySelector('.title-group h1').textContent.trim()}`);
    assert.equal(appear.korean, 0); assert.equal(appear.name, 'Stillness');
    for (const k of ['wordmark', 'rule']) assert.match(appear[k], /steps\(7/, `${k}: ${appear[k]}`);
    for (const k of ['buttons', 'footer']) assert.ok(!/steps/.test(appear[k]) && /ease/.test(appear[k]), `${k}: ${appear[k]}`);
    // 단추마다: 납작한 바탕 · 그림자 · 잘라 낸 모서리 · 글 그림자 없음 · 네 테두리 색 같음(볼록 테두리 아님) · 모서리 8
    const flat = await shadow(p, `return [...root.querySelectorAll('#titleScreen button')].filter((e)=>e.getClientRects().length).map((e)=>{const s=getComputedStyle(e);return {id:e.id,radius:s.borderRadius,shadow:s.boxShadow,image:s.backgroundImage,clip:s.clipPath,text:s.textShadow,bevel:new Set([s.borderTopColor,s.borderRightColor,s.borderBottomColor,s.borderLeftColor]).size,transition:s.transitionTimingFunction};})`);
    for (const f of flat) assert.deepEqual({ ...f, id: undefined, transition: undefined }, { id: undefined, transition: undefined, radius: '8px', shadow: 'none', image: 'none', clip: 'none', text: 'none', bevel: 1 }, f.id);
    // 누르는 동안: 내려앉지 않는다 (전 나무 판자 3 px) — 누른 채 단추 밖으로 옮겨 놓는다(눌림으로 치지 않게)
    const press = async (sel) => { const box = await p.locator(sel).boundingBox(); await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); const during = await shadow(p, `const e=root.querySelector('${sel}');return {transform:getComputedStyle(e).transform,shadow:getComputedStyle(e).boxShadow,y:e.getBoundingClientRect().y,active:e.matches(':active')}`); await p.mouse.move(2, 2); await p.mouse.up(); return { before: box.y, ...during }; };
    for (const sel of ['#newJourney', '#continueJourney']) { const r = await press(sel); assert.equal(r.active, true, sel); assert.equal(r.transform, 'none', sel); assert.equal(r.shadow, 'none', sel); assert.ok(Math.abs(r.y - r.before) < .5, `${sel} moved ${r.before} → ${r.y}`); }
    checks.push({ check: 'title buttons: no wood-plank CSS left, flat fill, radius 8, no bevel/clip/text shadow; pressing does not drop (transform none, same y); no Korean title line (name = Stillness); only the pixel lettering appears in 7 steps, buttons and footer ease in', appear });
    // 설정 '화면 60 fps 제한' 미닫이 — 같은 값 · 같은 저장 (gladiator-settings · 메뉴 미닫이)
    await p.locator('#openSettings').tap(); await p.waitForFunction(() => !document.querySelector('#gameEntrance').shadowRoot.getElementById('titleFps').disabled);
    t = await sw('#titleFps'); assert.equal(t.role, 'switch'); assert.equal(t.checked, 'true'); assert.equal(t.label, '화면 60 fps 제한');
    await p.locator('#titleFps').tap();
    assert.equal((await sw('#titleFps')).checked, 'false');
    assert.deepEqual(await p.evaluate(() => [JSON.parse(localStorage.getItem('gladiator-settings')).fpsCap, game.settings.fpsCap, document.querySelector('[data-setting=fpsCap]').classList.contains('on')]), [false, false, false]);
    await p.locator('.setting-row span').tap(); // 글을 눌러도
    assert.equal((await sw('#titleFps')).checked, 'true'); assert.equal(await p.evaluate(() => game.settings.fpsCap), true);
    await p.locator('#closeSettings').tap();
    checks.push('settings: 화면 60 fps 제한 = switch (role=switch · aria-checked · label) — tap/label tap flips it and writes the same gladiator-settings fpsCap + the battle menu toggle');
    // 대기실 단추 · 탭 · 칸
    await toLobby(p);
    await p.locator('[data-weapon=tree_branch]').tap();
    const lobbyButtons = await shadow(p, `return [...root.querySelectorAll('.lobby button, dialog button')].filter((e)=>e.getClientRects().length&&!e.matches('.edit-name,.detail-close,.book-node,.inventory-item')).map((e)=>{const s=getComputedStyle(e);return {id:e.id||e.textContent,radius:s.borderRadius,shadow:s.boxShadow,image:s.backgroundImage,clip:s.clipPath,text:s.textShadow,bevel:new Set([s.borderTopColor,s.borderRightColor,s.borderBottomColor,s.borderLeftColor]).size};})`);
    assert.ok(lobbyButtons.length >= 9, JSON.stringify(lobbyButtons));
    for (const f of lobbyButtons) assert.deepEqual({ ...f, id: undefined }, { id: undefined, radius: '8px', shadow: 'none', image: 'none', clip: 'none', text: 'none', bevel: 1 }, f.id);
    const r = await press('#lobbyDepart'); assert.equal(r.transform, 'none'); assert.ok(Math.abs(r.y - r.before) < .5);
    const tabs = await shadow(p, `return [...root.querySelectorAll('.lobby-tabs [role=tab]')].map((e)=>{const s=getComputedStyle(e);return {sel:e.getAttribute('aria-selected'),border:s.borderTopColor,color:s.color,bg:s.backgroundColor,radius:s.borderRadius,w:s.borderTopWidth};})`);
    assert.deepEqual(tabs[0], { sel: 'true', border: 'rgb(217, 164, 65)', color: 'rgb(217, 164, 65)', bg: 'rgba(0, 0, 0, 0)', radius: '8px', w: '1px' });
    assert.deepEqual(tabs[1], { sel: 'false', border: 'rgba(243, 233, 216, 0.18)', color: 'rgb(184, 168, 142)', bg: 'rgba(0, 0, 0, 0)', radius: '8px', w: '1px' });
    await p.locator('#tabSkills').tap();
    const schoolTabs = await shadow(p, `return [...root.querySelectorAll('.school-tabs [role=tab]')].slice(0,2).map((e)=>{const s=getComputedStyle(e);return {sel:e.getAttribute('aria-selected'),border:s.borderTopColor,color:s.color,bg:s.backgroundColor,radius:s.borderRadius,w:s.borderTopWidth};})`);
    assert.deepEqual(schoolTabs, tabs.slice(0, 2)); // 메뉴 탭 = 유파 탭 같은 꼴
    checks.push('lobby buttons (Stage 입장 · 첫 화면 · 탭 · 장착/해제 · 이름 창) flat, radius 8, no bevel/shadow; pressing Stage 입장 does not drop; category tabs = school tabs (outline · selected accent border + text · radius 8)');
    await c.close();
  }

  // ── ④ 호칭 내림 상자 · ⑤ 대표 유파 없음 ──
  {
    const c = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, reducedMotion: 'reduce' }); await noAuth(c);
    const p = await c.newPage(); watch(p);
    await p.goto(base + '/', { waitUntil: 'networkidle' }); await title(p); await toLobby(p);
    const text = await shadow(p, `return root.querySelector('.lobby').textContent`);
    assert.ok(!/대표 유파/.test(text), 'no 대표 유파'); assert.equal(await shadow(p, `return root.querySelectorAll('#lobbySchool').length`), 0);
    assert.equal(await p.locator('#lobbyLevel').textContent(), 'Lv.1'); assert.equal(await p.locator('#titleCurrent').textContent(), '여행자');
    const btn = await shadow(p, `const e=root.getElementById('titleSelect'),s=getComputedStyle(e),l=getComputedStyle(root.getElementById('lobbyLevel'));return {popup:e.getAttribute('aria-haspopup'),expanded:e.getAttribute('aria-expanded'),color:s.color,border:s.borderTopWidth+' '+s.borderTopStyle+' '+s.borderTopColor,radius:s.borderRadius,bg:s.backgroundColor,level:l.color}`);
    assert.deepEqual(btn, { popup: 'listbox', expanded: 'false', color: 'rgb(243, 233, 216)', border: '1px solid rgba(243, 233, 216, 0.18)', radius: '8px', bg: 'rgba(0, 0, 0, 0)', level: 'rgb(243, 233, 216)' }); // 금색 아님
    await p.locator('#titleSelect').click();
    const opened = await shadow(p, `const b=root.getElementById('titleSelect').getBoundingClientRect(),l=root.getElementById('titleList'),r=l.getBoundingClientRect(),s=getComputedStyle(l);
      return {expanded:root.getElementById('titleSelect').getAttribute('aria-expanded'),hidden:l.hidden,role:l.getAttribute('role'),gap:+(r.top-b.bottom).toFixed(1),dx:+(r.left-b.left).toFixed(1),bg:s.backgroundColor,border:s.borderTopWidth+' '+s.borderTopStyle+' '+s.borderTopColor,radius:s.borderRadius,
        options:[...l.querySelectorAll('[role=option]')].map((o)=>[o.textContent,o.getAttribute('aria-selected')]),text:l.textContent,focus:root.activeElement?.textContent}`);
    assert.equal(opened.expanded, 'true'); assert.equal(opened.hidden, false); assert.equal(opened.role, 'listbox');
    assert.ok(opened.gap >= 0 && opened.gap <= 8 && Math.abs(opened.dx) < 1, `opens directly below the control: ${JSON.stringify(opened)}`);
    const alpha = +(opened.bg.match(/rgba\(.*,\s*([\d.]+)\)/)?.[1] ?? 1); assert.ok(alpha < 1, `translucent box: ${opened.bg}`);
    assert.equal(opened.bg, 'rgba(24, 18, 14, 0.88)'); assert.equal(opened.border, '1px solid rgba(243, 233, 216, 0.18)'); assert.equal(opened.radius, '10px');
    assert.deepEqual(opened.options, [['여행자', 'true']]); // 가진 호칭만 — 지금은 기본 '여행자' 하나(지금 호칭)
    assert.ok(!/호칭 없음/.test(opened.text) && !/호칭 없음/.test(await shadow(p, `return root.querySelector('.lobby').textContent`)), 'no (호칭 없음) / system text in the box');
    assert.equal(opened.focus, '여행자');
    await p.screenshot({ path: `${out}/titles-open.png` });
    await p.keyboard.press('Escape');
    assert.deepEqual(await shadow(p, `return [root.getElementById('titleList').hidden, root.getElementById('titleSelect').getAttribute('aria-expanded'), root.activeElement?.id]`), [true, 'false', 'titleSelect']);
    await p.locator('#titleSelect').click(); await p.locator('.panel-heading h2').first().click(); // 바깥 누름
    assert.equal(await shadow(p, `return root.getElementById('titleList').hidden`), true);
    checks.push({ check: 'title dropdown: battle secondary look (body text · 1 px line · radius 8 · not gold) · Lv plain body text · opens directly below (gap/dx) · translucent --panel box (alpha < 1) · 1 px line · radius 10 · lists only owned titles (여행자 current) · no (호칭 없음) text · Escape and outside tap close · no 대표 유파', opened });
    // 얻은 호칭이 있으면 같은 목록에 (시험용 이름 — 게임에 넣는 호칭 아님) · 방향키 · Enter · 저장
    await p.evaluate(() => { const v = JSON.parse(localStorage.getItem('stillness.lobby.progress.v1') || '{"version":1,"acquisitions":[],"coins":100,"heads":0,"titles":[],"title":"여행자"}'); v.titles = [{ event: 'smoke-test', name: '시험용 호칭' }]; localStorage.setItem('stillness.lobby.progress.v1', JSON.stringify(v)); });
    await p.locator('#lobbyBack').click(); await title(p); await toLobby(p);
    await p.locator('#titleSelect').focus(); await p.keyboard.press('ArrowDown');
    assert.deepEqual(await shadow(p, `return [[...root.querySelectorAll('#titleList [role=option]')].map((o)=>o.textContent), root.activeElement?.textContent]`), [['여행자', '시험용 호칭'], '여행자']);
    await p.keyboard.press('ArrowDown'); assert.equal(await shadow(p, `return root.activeElement?.textContent`), '시험용 호칭');
    await p.keyboard.press('ArrowUp'); assert.equal(await shadow(p, `return root.activeElement?.textContent`), '여행자');
    await p.keyboard.press('End'); await p.keyboard.press('Enter');
    assert.equal(await p.locator('#titleCurrent').textContent(), '시험용 호칭'); assert.equal(await shadow(p, `return root.getElementById('titleList').hidden`), true);
    assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('stillness.lobby.progress.v1')).title), '시험용 호칭');
    await p.reload({ waitUntil: 'networkidle' }); await title(p); await toLobby(p);
    assert.equal(await p.locator('#titleCurrent').textContent(), '시험용 호칭');
    await p.locator('#titleSelect').click(); await p.locator('#titleList [role=option] >> text=여행자').click();
    assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('stillness.lobby.progress.v1')).title), '여행자');
    checks.push('earned titles join the same list; ArrowDown opens on the current option, ArrowUp/Down/End move, Enter selects; selection saved in title and still shown after reload; tap selects back to 여행자');
    await c.close();
  }

  // ── ⑥ 세 칸 · 사슬 틀 · ⑦ 칸 그림 ──
  for (const [size, w, h] of [['844x390', 844, 390], ['932x430', 932, 430], ['1280x720', 1280, 720]]) {
    const c = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' }); await noAuth(c);
    const p = await c.newPage(); watch(p);
    await p.goto(base + '/', { waitUntil: 'networkidle' }); await title(p); await toLobby(p);
    await p.locator('[data-weapon=tree_branch]').click(); await p.locator('#equipItem').click(); await p.locator('[data-weapon=tree_branch]').click(); // 장착 중 표시 · 설명 카드 닫음
    const L = () => shadow(p, `const R=(s)=>{const r=root.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,r:r.right};};const bw=(s)=>getComputedStyle(root.querySelector(s)).borderTopWidth;
      return {card:R('.portrait-card'),depart:R('#lobbyDepart'),profile:R('.profile-panel'),contents:R('.contents-panel'),inv:R('.inventory-frame'),grid:R('.inventory-grid'),host:R('.skill-tree-host'),frames:[bw('.portrait-card'),bw('.inventory-frame'),bw('.skill-tree-host')],round:CSS.supports('width','round(down, 10px, 3px)')};`);
    const a = await L();
    const near = (x, y, what, tol = 1) => assert.ok(Math.abs(x - y) <= tol, `${size} ${what}: ${x} vs ${y}`);
    near(a.card.y, a.profile.y, 'card top = profile top'); near(a.card.y, a.contents.y, 'card top = contents top');
    near(a.depart.b, a.contents.b, 'depart bottom = contents bottom');
    // 내 정보 칸 = 내용만큼 (사장님 18:0x '두 번째 영역이 지금 정보에 비해 너무 크네. 상하좌우 다 작아져도 돼'): 위 줄만 같이 · 아래는 메뉴 넷 바로 밑 · 폭 = --profile-w(남는 폭을 안 가짐)
    const pp = await shadow(p, `const e=root.querySelector('.profile-panel'),t=root.querySelector('.lobby-tabs').getBoundingClientRect(),r=e.getBoundingClientRect(),s=getComputedStyle(e);return {w:r.width,pad:parseFloat(s.paddingBottom),tabsB:t.bottom,b:r.bottom,want:parseFloat(getComputedStyle(root.querySelector('.lobby')).getPropertyValue('--profile-w'))};`);
    near(pp.w, pp.want, 'profile width = --profile-w', 1); near(pp.b - pp.tabsB, pp.pad + 1, 'profile ends right under the menu tabs', 1.5);
    assert.ok(a.profile.b < a.contents.b - 20, `${size} profile shorter than the columns`);
    // 세 칸 모서리 = 각짐 (사장님 18:0x '3단 영역 모서리에 애매한 라운딩이 들어간 게 싫어') — 떠 있는 창 · 단추는 그대로 둥글게
    const rr = await shadow(p, `return ['.profile-panel','.contents-panel'].map((q)=>getComputedStyle(root.querySelector(q)).borderTopLeftRadius);`);
    assert.deepEqual(rr, ['0px', '0px'], `${size} column panels square`);
    assert.ok(a.depart.y >= a.card.b, `${size} depart below card`);
    assert.deepEqual(a.frames, ['14px', '14px', '14px'], `${size} frame thickness`);
    const ratio = a.card.w / a.card.h; assert.ok(ratio > 0.62 && ratio < 0.7, `${size} card ratio ${ratio}`);
    near(a.grid.x - a.inv.x, 14, 'grid fills frame (left)', .5); near(a.inv.r - a.grid.r, 14, 'grid fills frame (right)', .5); near(a.grid.y - a.inv.y, 14, 'grid fills frame (top)', .5); near(a.inv.b - a.grid.b, 14, 'grid fills frame (bottom)', .5);
    if (a.round) for (const [k, f] of [['card', a.card], ['inv', a.inv]]) for (const d of [f.w, f.h]) assert.ok(Math.abs(((d - 28) % 12 + 12) % 12) < .51 || Math.abs(((d - 28) % 12) - 12) < .51, `${size} ${k} ${d}: whole chain links`);
    // 칸 그림 (보이는 부분 = 그림 파일의 불투명 상자 × 그린 크기) · 등급 빛 · '장착 중' 자리
    const cells = async () => shadow(p, `return Promise.all([...root.querySelectorAll('.inventory-item')].map(async (b)=>{const img=b.querySelector('img');await img.decode().catch(()=>{});
        const n=64,cv=document.createElement('canvas');cv.width=cv.height=n;const x=cv.getContext('2d');x.drawImage(img,0,0,n,n);const d=x.getImageData(0,0,n,n).data;let x0=n,x1=-1,y0=n,y1=-1;
        for(let y=0;y<n;y++)for(let i=0;i<n;i++)if(d[(y*n+i)*4+3]>24){x0=Math.min(x0,i);x1=Math.max(x1,i);y0=Math.min(y0,y);y1=Math.max(y1,y);}
        const c=b.getBoundingClientRect(),r=img.getBoundingClientRect(),vis={l:r.left+x0/n*r.width,r:r.left+(x1+1)/n*r.width,t:r.top+y0/n*r.height,b:r.top+(y1+1)/n*r.height};
        const badge=b.querySelector('.equipped-badge'),br=badge.hidden?null:badge.getBoundingClientRect(),s=getComputedStyle(b),i=getComputedStyle(img);
        // '장착 중'이 그림을 가리나: 알약 상자 안의 불투명 화소 수 (그림 파일 화소 기준)
        let covered=0;if(br)for(let y=0;y<n;y++)for(let k=0;k<n;k++){if(d[(y*n+k)*4+3]<=24)continue;const px=r.left+(k+.5)/n*r.width,py=r.top+(y+.5)/n*r.height;if(px>br.left&&px<br.right&&py>br.top&&py<br.bottom)covered++;}
        return {item:b.dataset.item,tier:b.dataset.tier,visible:+(Math.max(vis.r-vis.l,vis.b-vis.t)/c.width).toFixed(3),rendering:i.imageRendering,bg:s.backgroundImage,badge:br?badge.textContent:null,covered};}))`);
    let got = await cells();
    assert.equal(got.length, 1); assert.equal(got[0].badge, '장착 중');
    await p.locator('#tabArmor').click(); got = got.concat(await cells());
    for (const g of got) {
      assert.ok(g.visible >= 0.7 && g.visible <= 0.86, `${size} ${g.item} picture ${g.visible} of the cell`);
      assert.notEqual(g.rendering, 'pixelated', `${size} ${g.item} smooth`);
      assert.equal(g.covered, 0, `${size} ${g.item}: 장착 중 covers ${g.covered} picture pixels`);
    }
    assert.match(got.find((g) => g.item === 'tree_branch').bg, /radial-gradient\(closest-side, rgba\(190, 188, 180, 0\.2\)/); // 쓰레기 회색 빛
    assert.match(got.find((g) => g.item === 'kettle').bg, /radial-gradient\(closest-side, rgba\(255, 210, 74, 0\.6\)/); // 레전드 금빛
    assert.notEqual(await shadow(p, `return getComputedStyle(root.querySelector('.coin-icon')).imageRendering`), 'pixelated');
    // 탭을 바꿔도 틀이 그대로: 재고 틀 = 별자리 틀 (크기 · 자리)
    await p.locator('#tabSkills').click(); await p.waitForTimeout(150);
    const s = await L();
    for (const k of ['x', 'y', 'w', 'h']) near(s.host[k], a.inv[k], `star-board frame ${k} = inventory frame`, .5);
    if (size === '844x390') await p.screenshot({ path: `${out}/lobby-skills-844.png` });
    report[`frames ${size}`] = { card: [a.card.w, a.card.h, +ratio.toFixed(3)], inventory: [a.inv.w, a.inv.h], starBoard: [s.host.w, s.host.h], columns: { top: [a.card.y, a.profile.y, a.contents.y], bottom: [a.depart.b, a.profile.b, a.contents.b] }, pictures: got.map((g) => [g.item, g.visible]) };
    checks.push(`${size}: columns share top/bottom lines; chain frames 14 px; card ${a.card.w}×${a.card.h} (${ratio.toFixed(3)}); inventory frame ${a.inv.w}×${a.inv.h} = star-board frame, grid fills it (no strips)${a.round ? ', whole chain links' : ''}; pictures ${got.map((g) => `${g.item} ${g.visible}`).join(' · ')} smooth with tier glow; 장착 중 covers no picture pixel`);
    await c.close();
  }
  assert.deepEqual(errors, []);
} finally {
  fs.writeFileSync(`${out}/ui_unify.json`, JSON.stringify({ checks, report, errors }, null, 2));
  await browser.close();
}
console.log(`PASS ${checks.length} ui-unify checks; errors ${errors.length}`);

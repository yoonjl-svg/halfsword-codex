// 게임 화면 글자(HUD) 지금 모습 캡처 + 목업 캡처 (10/10 HUD 글자 체계 — docs/ui/hud_type_system_2026-10-10.md)
//  게임 코드는 건드리지 않는다. 싸움을 실제로 띄워 찍고, 띄우기 어려운 알림(내 비기·경직·결과·감정)은 DOM 에 직접 넣어 찍는다
//  (넣은 순간 게임 루프가 지우지 않게 그 요소의 classList.remove 만 이 페이지 안에서 막는다 — 찍은 장면마다 'injected' 를 적는다).
//  실행: npx vite build && npx vite preview --port 4317 --strictPort &
//        node tools/ui/hud_shots.mjs before  http://127.0.0.1:4317 docs/ui     → hud_before_{portrait,landscape}_<장면>.png + hud_bg_<방향>.png(글자 없는 배경) + 잰 값 JSON
//        node tools/ui/hud_shots.mjs mockup  - docs/ui                          → tools/ui/hud_mockup.html 을 배경 위에 얹어 hud_mockup_{portrait,landscape}.png
//        node tools/ui/hud_shots.mjs after   http://127.0.0.1:4317 docs/ui     → 구현 뒤 같은 장면 hud_after_*.png (새 칸 #techSlot·#secretSlot·#stateCue, 배경은 다시 찍지 않는다)
//        node tools/ui/hud_shots.mjs v2      http://127.0.0.1:4317 docs/ui     → 10/10 19:2x 세 묶음 hud_v2_*.png (설정 창 · 판 시작 · 패시브+비기 · 경직+상태 · 겹침 · 색 견본)
//        node tools/ui/hud_shots.mjs v3      http://127.0.0.1:4317 docs/ui     → 10/10 20:3x 두 묶음·한 줄 hud_v3_*.png (설정 창 · 테스트 경로 설정 창 · 판 시작 · 상대 패시브→비기 · 감정 줄)
//  저장소에 넣을 때는 PNG 를 256 색으로 줄였다 (PIL quantize MEDIANCUT · 디더 없음 — 21 MB → 9 MB).
//  띄우기는 tools/browser/*.mjs 와 같다 (설치된 Chromium + swiftshader GL). 소프트웨어 GL 은 느리다 — 장면 하나에 수십 초.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MODE = process.argv[2] || 'before';
const AFTER = MODE === 'after' || MODE === 'v2' || MODE === 'v3';
const base = process.argv[3] && process.argv[3] !== '-' ? process.argv[3] : 'http://127.0.0.1:4317';
const dir = process.argv[4] || 'docs/ui';
const ONLY = (process.env.ORIENT || 'portrait,landscape').split(',');
fs.mkdirSync(dir, { recursive: true });
const here = path.dirname(fileURLToPath(import.meta.url));
const VIEW = { portrait: { width: 390, height: 844 }, landscape: { width: 844, height: 390 } };
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const metrics = {};

async function newPage(o) {
  const ctx = await browser.newContext({ viewport: VIEW[o], hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${o} pageerror ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${o} ${m.text()}`));
  return page;
}

// 글자 요소의 자리·글꼴·색을 잰다 (보이는 것만)
const MEASURE = () => {
  const sel = ['#guardName b', '#guardName span', '#guardName small', '#techCue > b', '#techCue > small', '#techSlot b', '#secretSlot b', '#stateCue b', '#toast', '#emoMsg', '#hint', '#foeIntro b', '#foeIntro i', '#foeIntro span', '#foeIntro em', '#topButtons', '#moveStick', '.drawRow'];
  const out = {};
  for (const s of sel) {
    const el = document.querySelector(s);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (!r.width) continue;
    const cs = getComputedStyle(el);
    let op = 1;
    for (let p = el; p && p !== document.body; p = p.parentElement) op *= +getComputedStyle(p).opacity;
    out[s] = { box: [r.left, r.top, r.width, r.height].map(Math.round), font: `${cs.fontWeight} ${cs.fontSize}`, color: cs.color, op: +op.toFixed(2), text: el.innerText?.slice(0, 40) };
  }
  return out;
};

async function openFight(o, q) {
  const page = await newPage(o);
  await page.goto(`${base}/${q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
  // 세로 터치 화면은 실제로 '폰을 가로로 돌려주세요'(#rotate)가 덮는다 — 세로 HUD 를 보려고 그 안내만 숨긴다 (안내 자체는 'rotate' 장면에서 따로 찍는다)
  if (o === 'portrait') await page.addStyleTag({ content: '#rotate.enabled{display:none!important}' }).then((h) => h.evaluate((el) => (el.id = '__norotate')));
  return page;
}

async function shot(page, o, name, note) {
  const file = path.join(dir, `hud_${AFTER ? 'after' : 'before'}_${o}_${name}.png`);
  await page.screenshot({ path: file });
  metrics[`${o}_${name}`] = { note, ...(await page.evaluate(MEASURE)) };
  console.log('SHOT', file, note);
}

// 요소를 지금 모습 그대로 붙잡는다 (게임 루프가 show 를 떼지 못하게) — 이 캡처 페이지 안에서만
const PIN = `window.__pin = (id) => { const el = document.getElementById(id); el.classList.remove = () => {}; return el; };
window.__after = ${AFTER};
// '한국어 (원어)' → [한국어, 원어] (main.js splitName 과 같은 규칙)
window.__split = (s) => { const m = /^(.*?)\\s*\\(([^()]*)\\)\\s*(.*)$/.exec(s); if (!m || !m[1]) return [s, '']; const r = m[3].replace(/^·\\s*/, ''); return !r || m[3].startsWith('·') ? [m[1], [m[2], r].filter(Boolean).join(' · ')] : [m[1] + ' ' + r, m[2]]; };
// 자세 칸에 글 넣기 (지금: b + span 한 줄 이름 / 뒤: b 한국어 + small 원어 · 설명)
window.__guard = (info) => { const gn = __pin('guardName'); if (__after) { const [a, b] = __split(info.name); gn.innerHTML = '<b>' + a + '</b><small>' + [b, info.desc].filter(Boolean).join(' · ') + '</small>'; } else gn.innerHTML = '<b>' + info.name + '</b><span>' + info.desc + '</span>'; gn.classList.add('show'); };
// 기술 알림 넣기 (지금: #techCue 한 칸 / 뒤: 종류에 따라 R2 #techSlot · R3 #secretSlot · C #stateCue, 다른 칸은 비운다)
window.__cue = (kind, text, tag) => {
  const who = tag.startsWith('내') ? 'me' : 'foe';
  const put = (id, b, sm) => { const el = __pin(id); el.innerHTML = '<b>' + b + '</b><small>' + sm + '</small>'; el.dataset.kind = kind; el.dataset.who = who; el.classList.add('show'); };
  if (!__after) return put('techCue', text, tag);
  const [a, b] = __split(text);
  const slot = { passive: 'techSlot', unique: 'techSlot', secret: 'secretSlot', secretReady: 'secretSlot', secretArm: 'secretSlot', stiff: 'stateCue' }[kind];
  for (const id of ['secretSlot', 'stateCue']) if (id !== slot) document.getElementById(id).className = id === 'stateCue' ? '' : 'slot';
  if (kind === 'stiff') return put('stateCue', text, tag);
  const sm = (b ? '<span class="o">' + b + '</span><span class="t">&nbsp;· ' : '<span class="t">') + tag + '</span>'; // main.js paintSlot 과 같은 짜임
  put(slot, a, sm);
  if (kind === 'secretReady') put('stateCue', a, '<span class="t">' + tag + '</span>');
};`;
// 장면 글 (편집자 문구 정리 뒤 서양 유파 이름은 '한국어 (원어)')
const TXT = AFTER
  ? { passive: '맞받기 (인데스)', secret: '받아 베기 (페어제첸)', nach: '따라 들어가기 (나흐라이젠)', tagP: '상대 독일 · 패시브', tagMe: '내 독일 · 비기', tagArm: '내 일본 · 비기', tagStiff: '상대 독일 · 비기' }
  : { passive: 'Indes (맞받기)', secret: 'Versetzen (받아 베기)', nach: 'Nachreisen (따라 들어가기)', tagP: '독일 · 패시브', tagMe: '내 독일 · 비기', tagArm: '내 일본 · 비기', tagStiff: '상대 독일 · 비기 뒤' };
const R2 = AFTER ? 'techSlot' : 'techCue';
const R3 = AFTER ? 'secretSlot' : 'techCue';

async function before(o) {
  // 1) 무기 뽑기: 상대 소개(이름·칭호·한마디) + 안내 em + 카드 세 장
  let page = await openFight(o, '?stage=poseidon&cards=excalibur,qinggang&foeWeapon=rapier');
  await page.waitForTimeout(600);
  await shot(page, o, 'menu', 'real: 처음 메뉴(.overlay .card — 제목·.sub·.row·.seg·.toggle·.primary·.howto)');
  await page.getByText('여정 시작').click();
  await page.waitForFunction(() => window.game.state === 'draw' && window.game.draw.stage === 'choose', null, { timeout: 90000 });
  await page.evaluate(() => (window.game.draw.hold = true));
  await page.waitForTimeout(1200);
  await shot(page, o, 'draw', 'real: 무기 뽑기 (foeIntro b·i·span·em + 카드 뒷면·번호 배지)');
  // 1b) 카드 앞면: 첫 카드를 골라 셋 다 뒤집힌 뒤 멈춘다 (레전드·에픽·레어 — ?cards=excalibur,qinggang&foeWeapon=rapier)
  await page.evaluate(() => (window.game.draw.hold = false));
  await page.waitForTimeout(1500); // 막 뜬 카드는 고르지 못한다 (DRAW_T.ready — 게임 시간)
  await page.locator('.wcard').first().click();
  await page.waitForFunction(() => window.game.draw.stage !== 'choose', null, { timeout: 5000 }).catch(async () => {
    await page.waitForTimeout(3000);
    await page.locator('.wcard').first().click();
  });
  await page.waitForFunction(() => window.game.draw.foe, null, { timeout: 90000 });
  await page.evaluate(() => (window.game.draw.hold = true));
  await page.waitForTimeout(900);
  await shot(page, o, 'cards', 'real: 카드 앞면 (.wwho·.wname·.wsub·.wtier·.wdesc·.wabil, 등급 색)');
  await page.context().close();

  // 2) 싸움 시작 순간: Battle(toast) + 조작 안내(hint) + 상대 소개 — 무기 고정(?weapon)이라 뽑기 없이 바로
  page = await openFight(o, '?stage=poseidon&weapon=longsword');
  await page.getByText('여정 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 90000 });
  await page.waitForTimeout(150);
  await shot(page, o, 'start', 'real: Battle toast + hint + foeIntro');

  // 3) 싸움 중: 자세 이름(실제 자세표 글) + 상대 패시브 알림(실제 경로 enemy.techCue) + 감정 알림(DOM 직접)
  await page.waitForFunction(() => window.game.player.fightT > 2.4, null, { timeout: 120000 });
  await page.evaluate(PIN);
  await page.evaluate((t) => {
    const g = window.game;
    g.enemy.techCue = { text: t, kind: 'passive', schoolKo: '독일', t: -11 };
  }, TXT.passive);
  await page.waitForFunction((id) => document.getElementById(id).classList.contains('show'), R2, { timeout: 30000 });
  await page.evaluate((r2) => {
    const g = window.game;
    __pin(r2);
    __guard(g.player.swordArt.names[3] ?? { name: '황소 (옥스)', desc: '칼자루는 머리 옆, 칼끝은 상대 얼굴 · 찌르기 준비' });
    const em = __pin('emoMsg');
    em.textContent = '분노가 폭발한다';
    em.dataset.emotion = 'anger';
    em.classList.add('show');
    for (const id of ['toast', 'hint', 'foeIntro']) document.getElementById(id).classList.remove('show');
  }, R2);
  await page.waitForTimeout(500);
  await shot(page, o, 'fight', 'real: techCue passive(enemy.techCue 경로) · injected: guardName 글(실제 자세표), emoMsg');

  // 4) 상대 비기 (실제 경로 kind secret) — 자세 이름 그대로
  await page.evaluate(([t, r3]) => {
    const el = document.getElementById(r3);
    delete el.classList.remove; // 다시 게임이 쓰게 (뒤: R2 패시브는 붙잡은 채 — 패시브·비기 두 칸이 함께 보인다)
    window.game.enemy.techCue = { text: t, kind: 'secret', schoolKo: '독일', t: -12 };
  }, [TXT.secret, R3]);
  await page.waitForFunction((id) => document.getElementById(id).dataset.kind === 'secret' && document.getElementById(id).classList.contains('show'), R3, { timeout: 30000 });
  await page.evaluate((r3) => { __pin(r3); document.getElementById('emoMsg').style.opacity = '0'; }, R3);
  await page.waitForTimeout(400);
  await shot(page, o, 'foe_secret', 'real: techCue secret(상대) · injected: guardName');

  // 5) 내 비기 창(secretReady) · 고노센 준비(secretArm) · 경직(stiff) — DOM 직접 (같은 칸에 섞여 뜨는 모습)
  for (const [kind, text, tag] of [
    ['secretReady', TXT.secret, TXT.tagMe],
    ['secretArm', '고노센 준비', TXT.tagArm],
    ['stiff', '경직', TXT.tagStiff],
  ]) {
    await page.evaluate(([kind, text, tag]) => __cue(kind, text, tag), [kind, text, tag]);
    await page.waitForTimeout(400);
    await shot(page, o, `cue_${kind}`, `injected: techCue data-kind=${kind}`);
  }

  // 6) 판 끝: 결과(toast 패배) + 상대 승리 대사(foeIntro 재사용) — DOM 직접
  await page.evaluate(() => {
    const t = __pin('toast');
    t.textContent = '패배';
    t.classList.add('show');
    const f = __pin('foeIntro');
    f.querySelector('b').textContent = '하인리히';
    f.querySelector('i').textContent = '';
    f.querySelector('span').textContent = '“은화! 은화 어딨어!”';
    f.querySelector('em').textContent = '';
    f.classList.add('show');
    const c = document.getElementById('techCue');
    c.classList.toggle('show', false);
    c.style.opacity = '0';
    document.getElementById('guardName').style.opacity = '0';
  });
  await page.waitForTimeout(500);
  await shot(page, o, 'result', 'injected: toast 패배 + foeIntro 승리 대사');

  // 6b) 일시정지 창 (실제 단추) → 판 끝 결과 창(같은 .card 에 결과 글 — DOM 직접)
  await page.evaluate(() => {
    for (const id of ['toast', 'foeIntro']) document.getElementById(id).style.opacity = '0';
  });
  await page.locator('#btnPause').click();
  await page.waitForTimeout(500);
  await shot(page, o, 'pause', 'real: 일시정지 창');
  await page.evaluate(() => {
    document.getElementById('menuTitle').textContent = '패배';
    document.getElementById('menuSub').textContent = '목을 베였다'; // 부제 = 진 까닭 한 줄뿐 (사장님 10/16 14:4x — 대사는 싸움 화면에만)
    document.getElementById('btnStart').textContent = '다시 겨루기';
    document.getElementById('btnResume').style.display = 'none';
  });
  await page.waitForTimeout(300);
  await shot(page, o, 'result_card', 'injected: 결과 창 글(menuTitle·menuSub·btnStart)');
  if (o === 'portrait') {
    await page.evaluate(() => (document.getElementById('__norotate').sheet.disabled = true));
    await page.waitForTimeout(200);
    await shot(page, o, 'rotate', 'real: #rotate 안내 (세로 터치 화면에서 실제로 뜨는 것)');
    await page.evaluate(() => (document.getElementById('__norotate').sheet.disabled = false));
  }
  await page.locator('#btnResume').evaluate((b) => (b.style.display = ''));
  await page.locator('#btnResume').click();
  await page.waitForTimeout(500);
  for (const id of ['toast', 'foeIntro']) await page.evaluate((id) => (document.getElementById(id).style.opacity = ''), id);

  // 7) 글자 없는 배경 (목업 바탕): 글자 요소만 숨기고 일시정지 버튼·조이스틱은 둔다 (구현 뒤 캡처에서는 다시 찍지 않는다)
  if (!AFTER) await page.evaluate(() => {
    for (const id of ['guardName', 'techCue', 'toast', 'emoMsg', 'hint', 'foeIntro']) document.getElementById(id).style.visibility = 'hidden';
  });
  if (!AFTER) {
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(dir, `hud_bg_${o}.png`) });
    metrics[`${o}_bg`] = await page.evaluate(MEASURE);
  }
  await page.context().close();

  // 8) 겹침: 개울가 브란(분노로 시작) 판의 시작 — Battle + 안내 + 소개 + 감정 + 상대 패시브 + 자세 이름이 한꺼번에
  page = await openFight(o, '?stage=clearing&weapon=longsword');
  await page.getByText('여정 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 90000 });
  await page.evaluate(PIN);
  await page.evaluate(([nach, tagP]) => {
    for (const id of ['toast', 'hint', 'foeIntro', 'emoMsg']) __pin(id);
    const em = document.getElementById('emoMsg');
    if (!em.classList.contains('show')) { em.textContent = '오소리 브란의 분노가 폭발한다'; em.dataset.emotion = 'anger'; em.classList.add('show'); }
    __cue('passive', nach, tagP);
    __guard(window.game.player.swordArt.names[0]);
  }, [TXT.nach, TXT.tagP]);
  await page.waitForTimeout(400);
  await shot(page, o, 'overlap', 'real: toast·hint·foeIntro(시작) · injected: emoMsg(브란 시작 분노와 같은 글), techCue passive, guardName');
  await page.context().close();
}

// v2 (10/10 19:2x 사장님 답 — §13): 오른쪽 위 세 묶음 · 가운데 판 알림만 · 줄인 설정 창 · 색 후보 견본 → hud_v2_<방향>_<장면>.png
//  전(같은 장면의 v1)은 hud_after_<방향>_<장면>.png — python3 tools/ui/hud_compare.py docs/ui v2 로 나란히
async function v2(o) {
  const file = (name) => path.join(dir, `hud_v2_${o}_${name}.png`);
  const snap = async (page, name, note) => {
    await page.screenshot({ path: file(name) });
    metrics[`${o}_${name}`] = { note, ...(await page.evaluate(MEASURE)) };
    console.log('SHOT', file(name), note);
  };
  // 1) 설정 창 (처음 메뉴) → 2) 판 시작: 판 알림 '결투' + 안내 + 소개
  let page = await openFight(o, '?stage=poseidon&weapon=longsword');
  await page.waitForTimeout(600);
  await snap(page, 'menu', 'real: 처음 메뉴 (설정 줄 둘)');
  await page.getByText('여정 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 90000 });
  await page.waitForTimeout(150);
  await snap(page, 'start', 'real: 판 시작 toast(대면) + hint + foeIntro');
  // 3) 상대 패시브 + 상대 비기: 실제 경로(enemy.techCue)로 잇달아 → ② 묶음에 두 줄
  await page.waitForFunction(() => window.game.player.fightT > 2.4, null, { timeout: 120000 });
  await page.evaluate(PIN);
  await page.evaluate(() => (window.__pinEl = (el) => ((el.classList.remove = () => {}), el)));
  await page.evaluate((t) => (window.game.enemy.techCue = { text: t, kind: 'passive', schoolKo: '독일', t: -11 }), TXT.passive);
  await page.waitForFunction(() => document.querySelector('#techSlot .slot.show'), null, { timeout: 30000 });
  await page.evaluate((t) => (window.game.enemy.techCue = { text: t, kind: 'secret', schoolKo: '독일', t: -12 }), TXT.secret);
  await page.waitForFunction(() => document.querySelectorAll('#techSlot .slot.show').length === 2, null, { timeout: 30000 });
  await page.evaluate(() => {
    document.querySelectorAll('#techSlot .slot').forEach(__pinEl);
    __pin('techCue');
    __guard(window.game.player.swordArt.names[3] ?? { name: '황소 (옥스)', desc: '칼자루는 머리 옆, 칼끝은 상대 얼굴 · 찌르기 준비' });
    for (const id of ['toast', 'hint', 'foeIntro']) document.getElementById(id).classList.remove('show');
  });
  await page.waitForTimeout(500);
  await snap(page, 'foe_secret', 'real: 상대 패시브 + 상대 비기 (② 두 줄) · injected: 자세 글');
  // 4) 경직 + 상태: ③ 묶음에 '경직 / 상대 · 이름' + '분노 / 나' (DOM 직접 — main.js paintLine 과 같은 짜임) · ② 는 붙잡은 채
  await page.evaluate(() => {
    const name = document.querySelector('#foeIntro b')?.textContent || '상대';
    const L = [...document.querySelectorAll('#stateCue .slot')].map(__pinEl);
    const put = (el, b, t, kind, who) => { el.innerHTML = `<b>${b}</b><small><span class="t">${t}</span></small>`; el.dataset.kind = kind; el.dataset.who = who; el.classList.add('show'); };
    put(L[0], '경직', `상대 · ${name}`, 'stiff', 'foe');
    put(L[1], '분노', '나', 'anger', 'me');
  });
  await page.waitForTimeout(400);
  await snap(page, 'state', 'real: ② 상대 패시브·비기 · injected: ③ 경직(상대) + 분노(나), 자세 글');
  await page.context().close();
  // 5) 겹침: 개울가 브란(분노로 시작) 판의 시작 — 실제 경로로 ③ 에 '분노 / 상대 · 오소리 브란'
  page = await openFight(o, '?stage=clearing&weapon=longsword');
  await page.getByText('여정 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 90000 });
  await page.evaluate(PIN);
  await page.evaluate(() => { for (const id of ['toast', 'hint', 'foeIntro']) __pin(id); });
  await page.waitForFunction(() => document.querySelector('#stateCue .slot.show'), null, { timeout: 60000 }).catch(() => console.log('NOTE: 브란 분노가 아직 안 떴다'));
  await page.evaluate(() => { document.querySelectorAll('#stateCue .slot').forEach((el) => (el.classList.remove = () => {})); });
  await page.waitForTimeout(400);
  await snap(page, 'overlap', 'real: 판 시작 toast·hint·foeIntro + ③ 브란 분노(실제 경로)');
  await page.context().close();
  // 6) 색 후보 견본 (실제 배경 hud_bg_<방향>.png 위, 외곽선 있음)
  page = await newPage(o);
  await page.goto(pathToFileURL(path.join(here, 'hud_mockup.html')).href + `?o=${o}&scene=swatch2`, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: file('swatch') });
  console.log('SHOT', file('swatch'));
  await page.context().close();
}

// v3 (10/10 20:3x 사장님 답 — §14): ② 패시브·비기 줄 하나(바꿔 끼우기) · ③ 묶음 없앰 → 감정 문장 아래 가운데 · 한 열 좁은 설정 창 → hud_v3_<방향>_<장면>.png
//  전(같은 장면의 v2)은 hud_v2_<방향>_<장면>.png — python3 tools/ui/hud_compare.py docs/ui v3 로 나란히
async function v3(o) {
  const file = (name) => path.join(dir, `hud_v3_${o}_${name}.png`);
  const snap = async (page, name, note) => {
    await page.screenshot({ path: file(name) });
    metrics[`${o}_${name}`] = { note, ...(await page.evaluate(MEASURE)) };
    console.log('SHOT', file(name), note);
  };
  // 0) 테스트 경로 설정 창 ('테스트 고르기로' 단추 · 안내 한 줄이 좁은 폭에 맞는지)
  let page = await openFight(o, '?test=1&weapon=longsword');
  await page.waitForTimeout(600);
  await snap(page, 'menu_test', 'real: 테스트 경로(test=1) 처음 메뉴');
  await page.context().close();
  // 1) 설정 창 (처음 메뉴) → 2) 판 시작
  page = await openFight(o, '?stage=poseidon&weapon=longsword');
  await page.waitForTimeout(600);
  await snap(page, 'menu', 'real: 처음 메뉴 (한 열 · 좁은 폭)');
  await page.getByText('여정 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 90000 });
  await page.waitForTimeout(150);
  await snap(page, 'start', 'real: 판 시작 toast(대면) + hint + foeIntro');
  // 3) 상대 패시브 → 상대 비기: 실제 경로(enemy.techCue)로 잇달아 → ② 줄 하나가 비기로 바뀐다
  await page.waitForFunction(() => window.game.player.fightT > 2.4, null, { timeout: 120000 });
  await page.evaluate(PIN);
  await page.evaluate(() => (window.__pinEl = (el) => ((el.classList.remove = () => {}), el)));
  await page.evaluate((t) => (window.game.enemy.techCue = { text: t, kind: 'passive', schoolKo: '독일', t: -11 }), TXT.passive);
  await page.waitForFunction(() => document.querySelector('#techSlot .slot.show'), null, { timeout: 30000 });
  await page.evaluate((t) => (window.game.enemy.techCue = { text: t, kind: 'secret', schoolKo: '독일', t: -12 }), TXT.secret);
  await page.waitForFunction(() => document.querySelector('#techSlot .slot.show')?.dataset.kind === 'secret', null, { timeout: 30000 });
  await page.evaluate(() => {
    document.querySelectorAll('#techSlot .slot').forEach(__pinEl);
    __pin('techCue');
    __guard(window.game.player.swordArt.names[3] ?? { name: '황소 (옥스)', desc: '칼자루는 머리 옆, 칼끝은 상대 얼굴 · 찌르기 준비' });
    for (const id of ['toast', 'hint', 'foeIntro']) document.getElementById(id).classList.remove('show');
  });
  await page.waitForTimeout(500);
  await snap(page, 'foe_tech', 'real: 상대 패시브 → 상대 비기 (② 줄 하나, 바꿔 끼움) · injected: 자세 글');
  await page.context().close();
  // 4) 감정 줄: 개울가 브란(분노로 시작) 판의 시작 — 실제 경로로 아래 가운데 '오소리 브란의 분노가 폭발한다'
  page = await openFight(o, '?stage=clearing&weapon=longsword');
  await page.getByText('여정 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 90000 });
  await page.evaluate(PIN);
  await page.evaluate(() => { for (const id of ['toast', 'hint', 'foeIntro']) __pin(id); });
  await page.waitForFunction(() => document.querySelector('#emoMsg.show'), null, { timeout: 60000 }).catch(() => console.log('NOTE: 브란 분노가 아직 안 떴다'));
  await page.evaluate(() => __pin('emoMsg'));
  await page.waitForTimeout(400);
  await snap(page, 'emo', 'real: 판 시작 toast·hint·foeIntro + 감정 줄 브란 분노(실제 경로)');
  await page.context().close();
}

async function mockup(o) {
  // hud = 모든 역할 한 화면(hud_mockup_<방향>.png) · map 화면 지도 · cards 카드 화면 · menu 창 · swatch 오렌지 후보
  for (const scene of (process.env.SCENES || 'hud,map,cards,menu,swatch').split(',')) {
    const page = await newPage(o);
    const url = pathToFileURL(path.join(here, 'hud_mockup.html')).href + `?o=${o}&scene=${scene}`;
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    const file = path.join(dir, scene === 'hud' ? `hud_mockup_${o}.png` : `hud_mockup_${o}_${scene}.png`);
    await page.screenshot({ path: file });
    console.log('SHOT', file);
    metrics[`mockup_${o}_${scene}`] = await page.evaluate(() =>
      Object.fromEntries([...document.querySelectorAll('[data-role]')].map((el) => {
        const r = el.getBoundingClientRect();
        return [el.dataset.role, [r.left, r.top, r.width, r.height].map(Math.round)];
      })),
    );
    await page.context().close();
  }
}

for (const o of ONLY) await (MODE === 'mockup' ? mockup(o) : MODE === 'v2' ? v2(o) : MODE === 'v3' ? v3(o) : before(o)); // before · after 는 같은 장면 (after = 새 칸) · v2 = 10/10 19:2x 세 묶음 · v3 = 20:3x 두 묶음·한 줄
fs.writeFileSync(path.join(process.env.METRICS_DIR || dir, `hud_${MODE}_metrics.json`), JSON.stringify(metrics, null, 1));
console.log('ERRORS', JSON.stringify(errors));
await browser.close();

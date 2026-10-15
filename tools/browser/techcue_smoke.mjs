// 유파 기술 알림(#techCue, 10/9) 브라우저 확인 — 10/14 03:1x·03:3x 규칙 (docs/ui/hud_type_system_2026-10-10.md §15)
//  10/10 20:3x: #techCue 는 겉 칸 — ② 패시브·비기 #techSlot(자세 아래)에 줄 하나(.slot), 새 알림은 그 자리에서 바꿔 끼운다 (③ 경직·상태 묶음은 없앴다).
//  10/14 03:1x: ② 는 마지막으로 낸 내 기술이 계속 보인다 (시간으로 안 사라짐 · 다음 기술이 오면 바꿔 끼움 · 새 판이 열리면 비움).
//   잠깐짜리 상태 알림(비기 창 열림 secretReady · 고노센/길목 준비 secretArm)만 그 동안 덮었다가 마지막 기술로 돌아온다.
//  10/14 03:3x: ① 자세(#guardName)도 싸움 중에는 계속 보인다 · 상대 기술 알림(AI 이름 · 기술 — 왼쪽 위 둘째 줄 #stageInfo .foe)은 화면에서 아예 없앴다.
//  이 도구가 보는 것 (실제 표시 길 — 내 기술은 player.uniqueCue, 상대 기술은 enemy.techCue · techAll 을 적어 main.js 가 읽게 한다. AI·물리는 상대를 세워 두는 것 말고 건드리지 않는다):
//   A 롱소드: ① 이 3 s 넘게 계속 보임 · ② 내 기술이 3 s 넘게 남음 → 다음 기술로 바꿔 끼움 · 비기 창 열림이 덮었다가 닫히면 돌아옴 · 상대 기술은 어디에도 안 뜸 · 새 판(처음부터 다시)에 ② 비움
//   B 우치가타나: 고노센 준비(간격 밖에 서 있기)가 마지막 기술을 덮었다가, 준비가 풀리면 돌아옴
//  실행: npx vite --port <빈 포트> --strictPort &   (5173·5174 는 쓰지 않는다)
//        node tools/browser/techcue_smoke.mjs http://127.0.0.1:<포트> [스크린샷 폴더 — 주면 장면마다 PNG]
//  소프트웨어 GL 은 느리다(벽 10 s ≈ 게임 1~2 s). playwright 는 저장소 의존성에 없다 (npm i --no-save playwright)
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4173';
const shotDir = process.argv[3] || '';
if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const fails = [];
const check = (ok, what, got) => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${what}${got === undefined ? '' : ' ' + JSON.stringify(got)}`);
  if (!ok) fails.push(what);
};
// 오른쪽 위 ①·② 와 왼쪽 위 칸을 읽는다 (보임 = show 칸 + 계산된 불투명도)
const READ = () => {
  const g = window.game;
  const line = (el) => (el ? { show: el.classList.contains('show'), op: +getComputedStyle(el).opacity, kind: el.dataset.kind ?? null, text: el.innerText.replace(/\s+/g, ' ').trim() } : null);
  return {
    state: g.state,
    sim: +g.stats.simTime.toFixed(2),
    alive: !!g.player?.alive,
    guard: line(document.getElementById('guardName')),
    tech: line(document.querySelector('#techSlot .slot')),
    slots: document.querySelectorAll('#techSlot .slot').length,
    foeLine: !!document.querySelector('#stageInfo .foe'),
    stageInfo: document.getElementById('stageInfo').innerText.replace(/\s+/g, ' ').trim(),
  };
};
async function open(q, label) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${label} pageerror ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${label} ${m.text()}`));
  // openSweep=0: 판 시작을 9/30 꼴(정지 2 s)로 — 10/15 무대 훑기는 첫 판 3.3 게임 초 발을 묶어 fight() 의 2.5 s 가 어긋난다 (docs/strike/camera_open_2026-10-15.md)
  await page.goto(base + '/' + q + '&openSweep=0', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
  return page;
}
const waitSim = (page, dt) => page.evaluate((d) => window.game.stats.simTime + d, dt).then((s) => page.waitForFunction((x) => window.game.stats.simTime > x, s, { timeout: 300000, polling: 100 }));
const shot = async (page, name) => shotDir && page.screenshot({ path: `${shotDir}/techcue_${name}.png` });
// 내 고유 동작 알림 (unique_assist.js 가 발동 순간 적는 것과 같은 꼴 — 새 객체면 main.js 가 새 기술로 읽는다)
const myTech = (page, text) => page.evaluate((t) => (window.game.player.uniqueCue = { text: t, kind: 'unique', who: 'me', schoolKo: '시험', name: t, t: Math.random() }), text);
// 싸움을 띄우고 판 시작 정지(ARENA.startHold)가 풀린 뒤 상대를 세운다 (판이 끝나지 않게 — 시험만)
async function fight(page) {
  await page.getByText('여정 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 90000 });
  await page.waitForFunction(() => window.game.player.fightT > 2.5, null, { timeout: 300000, polling: 100 });
  await page.evaluate(() => (window.game.ai.update = () => {}));
}

// ── A 롱소드 ──
{
  const page = await open('?weapon=longsword&foeWeapon=monohoshizao&uniqueStage=5', 'A');
  const pre = await page.evaluate(() => ({
    el: !!document.getElementById('techCue'),
    row: document.querySelectorAll('#menu [data-setting="techCue"]').length, // 0 (설정 줄 지움)
    slots: document.querySelectorAll('#techSlot .slot').length, // 1 (줄 하나)
    stateCue: !!document.getElementById('stateCue'), // false (③ 묶음 없앰)
    foeLine: !!document.querySelector('#stageInfo .foe'), // false (10/14 03:3x AI 줄 없앰)
    shown: document.getElementById('techCue').classList.contains('show') || document.getElementById('guardName').classList.contains('show'), // 메뉴 동안엔 숨김
  }));
  check(pre.el && pre.row === 0 && pre.slots === 1 && !pre.stateCue && !pre.foeLine && !pre.shown, '메뉴: 칸 하나 · 설정 줄 없음 · ③ 없음 · AI 줄 없음 · 오른쪽 위 숨김', pre);
  await fight(page);
  let r = await page.evaluate(READ);
  check(r.guard.show && r.guard.op > 0.9 && !!r.guard.text, '① 판 시작 뒤 자세 이름 보임', r.guard);
  check(!r.tech.show, '② 판 시작 — 비었음', r.tech);
  // ① 이 3 s 넘게 계속 보이는가 (1.6 s 사라짐 없앰)
  const s0 = r.sim;
  let hidden = 0;
  let n = 0;
  while (r.sim < s0 + 3.2) {
    await page.waitForTimeout(250);
    r = await page.evaluate(READ);
    n++;
    if (!(r.guard.show && r.guard.op > 0.5)) hidden++;
  }
  check(hidden === 0, `① 3 s 넘게 계속 보임 (${n} 번 잼)`, { hidden, guard: r.guard.text });
  // 상대 기술 알림: 어디에도 안 뜬다 (② 로 되돌리지 않았는지)
  await page.evaluate(() => {
    const e = window.game.enemy;
    e.techCue = { text: '시험 상대 비기 (Probe)', kind: 'secret', schoolKo: '일본', t: -1 };
    e.techAll = { text: '시험 상대 기술', kind: 'all', schoolKo: '일본', t: -2 };
  });
  await waitSim(page, 0.3);
  r = await page.evaluate(READ);
  const foeShown = r.tech.text.includes('시험 상대') || r.stageInfo.includes('시험 상대') || r.foeLine;
  check(!foeShown, '상대 기술 알림 — 화면 어디에도 없음', { tech: r.tech.text, stageInfo: r.stageInfo, foeLine: r.foeLine });
  // ② 내 기술: 뜨고, 3 s 넘게 남고, 다음 기술이 오면 바꿔 끼운다
  await myTech(page, '시험 기술 하나 (Probe One)');
  await waitSim(page, 0.1);
  r = await page.evaluate(READ);
  check(r.tech.show && r.tech.kind === 'unique' && r.tech.text.startsWith('시험 기술 하나'), '② 내 기술 뜸', r.tech);
  await waitSim(page, 3.2);
  await page.waitForTimeout(400);
  r = await page.evaluate(READ);
  await shot(page, 'A_tech3s');
  check(r.tech.show && r.tech.op > 0.9 && r.tech.text.startsWith('시험 기술 하나'), '② 3 s 넘게 지나도 마지막 기술 그대로', r.tech);
  check(r.guard.show && r.guard.op > 0.9, '① 도 그대로 보임', r.guard);
  await myTech(page, '시험 기술 둘 (Probe Two)');
  await waitSim(page, 0.1);
  r = await page.evaluate(READ);
  check(r.tech.show && r.tech.text.startsWith('시험 기술 둘'), '② 다음 기술로 바꿔 끼움', r.tech);
  // 비기 창 열림(상태 알림)이 덮었다가 닫히면 마지막 기술로 돌아온다
  const hasSecret = await page.evaluate(() => !!window.game.playerSecret?.S);
  if (hasSecret) {
    await page.evaluate(() => {
      const W = window.game.playerSecret;
      W.openWindow(null);
      W.open.t = 30; // 느린 화면에서도 읽히게 (시험만)
    });
    await waitSim(page, 0.2);
    r = await page.evaluate(READ);
    await shot(page, 'A_ready');
    check(r.tech.show && r.tech.kind === 'secretReady', '비기 창 열림이 ② 를 덮음', r.tech);
    await page.evaluate(() => {
      const W = window.game.playerSecret;
      if (W.open) W.open.t = 0.01;
    });
    await waitSim(page, 0.3);
    r = await page.evaluate(READ);
    await shot(page, 'A_back');
    check(r.tech.show && r.tech.kind === 'unique' && r.tech.text.startsWith('시험 기술 둘'), '창이 닫히면 마지막 기술로 돌아옴', r.tech);
  } else check(false, '롱소드 비기가 없다 (uniqueStage=5 인데)');
  // 새 판 (일시정지 → 처음부터 다시): ② 비움, ① 은 새 판 자세로 다시
  await page.locator('#btnPause').click();
  await page.waitForFunction(() => window.game.state === 'paused', null, { timeout: 60000 });
  // 보임은 매 프레임 정한다 — 소프트웨어 GL 은 한 프레임이 0.3 s 를 넘기도 해서 몇 프레임 기다린다 (15 s 안에 안 숨으면 실패)
  await page
    .waitForFunction(() => !document.getElementById('guardName').classList.contains('show') && !document.querySelector('#techSlot .slot').classList.contains('show'), null, { timeout: 15000, polling: 100 })
    .catch(() => {});
  r = await page.evaluate(READ);
  check(!r.guard.show && !r.tech.show, '일시정지 창 동안 오른쪽 위 숨김', { guard: r.guard.show, tech: r.tech.show });
  await page.locator('#btnStart').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 90000 });
  await waitSim(page, 0.3);
  r = await page.evaluate(READ);
  await shot(page, 'A_newround');
  check(!r.tech.show, '새 판 — ② 비움 (지난 판 기술이 안 남음)', r.tech);
  check(r.guard.show && !!r.guard.text, '새 판 — ① 자세 이름 다시 보임', r.guard);
  await page.context().close();
}

// ── B 우치가타나: 고노센 준비가 마지막 기술을 덮었다가 풀리면 돌아온다 ──
{
  const page = await open('?weapon=uchigatana&foeWeapon=longsword&uniqueStage=5', 'B');
  await fight(page);
  const instant = await page.evaluate(() => !!window.game.playerSecret?.S?.do?.instant && !!window.game.config.SECRET.iai);
  if (!instant) check(false, '우치가타나 비기가 발도(고노센)가 아니다');
  else {
    await myTech(page, '시험 기술 셋 (Probe Three)');
    // 간격 밖에 서 있으면 iaiArmTime(1.5 s) 뒤 준비 — 기술을 낸 뒤 손대지 않고 기다린다
    await page.waitForFunction(() => window.game.playerSecret.iaiArm.armed, null, { timeout: 300000, polling: 100 }).catch(() => {});
    await waitSim(page, 0.2);
    let r = await page.evaluate(READ);
    await shot(page, 'B_arm');
    check(r.tech.show && r.tech.kind === 'secretArm', '고노센 준비가 ② 를 덮음', r.tech);
    await page.evaluate(() => window.game.playerSecret.iaiArm.consume()); // 준비가 풀림 (간격 안으로 들어오거나 휘두른 것과 같은 결과)
    await waitSim(page, 0.1);
    r = await page.evaluate(READ);
    await shot(page, 'B_back');
    check(r.tech.show && r.tech.kind === 'unique' && r.tech.text.startsWith('시험 기술 셋'), '준비가 풀리면 마지막 기술로 돌아옴 (준비 글이 안 남음)', r.tech);
  }
  await page.context().close();
}
console.log('ERRORS ' + JSON.stringify(errors));
console.log(fails.length || errors.length ? `FAIL ${fails.length} (${fails.join(' / ')}) · 콘솔 에러 ${errors.length}` : 'PASS (콘솔 에러 0)');
await browser.close();
process.exit(fails.length || errors.length ? 1 : 0);

// 판 시작 카메라 흐름 확인 (10/15 — docs/strike/camera_open_2026-10-15.md §3): 실제 페이지를 가상 시계 60 fps 로 돌려 판을 여러 번 연다.
//  ① 여정: 메뉴에서 시작(포세이돈 — 훑기) → 상대를 쓰러뜨려 '다음 여정'(화전 터 — 훑기) → 내가 쓰러져 '다시 겨루기'(같은 무대 — 내려앉기 1 s) → 일시정지 '처음부터 다시'(내려앉기)
//  ② `?openSweep=0`: 9/30 판 시작 (정지 2 s · 소개는 정지 동안)
//  ③ 카드 뽑기 흐름(?weapon 없이 · ?stage=castle): 카드를 고르는 동안 카메라가 훑기 시작 자리에 서 있나 → 카드가 사라지면 훑기
//  ④ 기본 상대(?foe=default — 판 시작 몸짓 persona.idle 이 없는 AI): 훑기 동안 나서거나 휘두르지 않나
//  판마다: mode · 정지 길이(게임 초) · 훑기 동안 두 발 묶임 · 카메라가 닿는 화면에서 발이 풀리나 · 닿을 때 평소 자리와의 차이 · 상대 골반 움직임 · AI 꼴 · 소개가 뜬/걷힌 게임 시각 · '대면'
//  실행: 개발 서버를 띄운 뒤  node tools/browser/cam_open_flows.mjs http://127.0.0.1:5191
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:5191';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
let bad = 0;

async function open(query) {
  const page = await browser.newPage({ viewport: { width: 420, height: 200 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.addInitScript(() => {
    let vt = 0;
    performance.now = () => vt;
    let q = [];
    window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
    window.__rec = null;
    window.__tick = (n) => {
      for (let i = 0; i < n; i++) {
        vt += 1000 / 60;
        const list = q; q = [];
        for (const cb of list) cb(vt);
        const g = window.game;
        if (window.__rec && g?.state === 'fight') {
          const hold = g.config.ARENA.startHold;
          const e = g.enemy.bodies.pelvis.translation();
          window.__rec.push({ fightT: g.player.fightT, hold, mode: g.camOpen.mode, cam: g.camera.position.toArray(), end: g.camOpen.endPos.toArray(), feet: g.player.feetHeld, efeet: g.enemy.feetHeld, e: [e.x, e.z], intro: document.getElementById('foeIntro').classList.contains('show'), toast: document.getElementById('toast').classList.contains('show'), ai: `${g.ai.mode}/${g.ai.phase}`, tip: g.enemy.tipVel?.length?.() ?? 0, swings: g.enemy.skill?.swings ?? 0, stage: g.stage.id });
        }
      }
    };
  });
  await page.goto(`${base}/?${query}`, { waitUntil: 'domcontentloaded' });
  // 이 계기는 RAF를 수동으로 진행하므로 초기 로딩 대기는 실제 타이머로 확인한다.
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000, polling: 100 });
  await page.evaluate(() => window.__tick(3));
  return { page, errors };
}
/** 판 하나를 지켜본다: 기록을 비우고 fn(시작 단추 누르기 등) → 판 시작이 끝나고 0.5 s 더 */
async function watchRound(page, label, start) {
  await page.evaluate(() => { window.__rec = []; });
  await start();
  for (let k = 0; k < 80; k++) {
    const done = await page.evaluate(() => { window.__tick(10); const R = window.__rec; return R.length > 0 && R.at(-1).fightT > R.at(-1).hold + 0.5; });
    if (done) break;
  }
  const r = await page.evaluate(() => {
    const R = window.__rec;
    const land = R.findIndex((x) => !x.feet);
    const pre = R.slice(0, Math.max(0, land));
    const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    const on = R.find((x) => x.intro), off = on ? R.find((x) => x.fightT > on.fightT && !x.intro) : null;
    return {
      stage: R[0]?.stage, mode: R[0]?.mode, hold: +(R[0]?.hold ?? 0).toFixed(3), landT: land >= 0 ? +R[land].fightT.toFixed(3) : null,
      bothHeldBefore: pre.every((x) => x.feet && x.efeet), foeFreeAtLand: land >= 0 ? !R[land].efeet : null,
      camGapAtLand: land >= 0 ? +d(R[land].cam, R[land].end).toFixed(4) : null, camGapBefore: land > 0 ? +d(R[land - 1].cam, R[land - 1].end).toFixed(3) : null,
      camStepAtLand: land > 0 ? +d(R[land].cam, R[land - 1].cam).toFixed(3) : null, camStepBefore: land > 1 ? +d(R[land - 1].cam, R[land - 2].cam).toFixed(3) : null,
      foeMove: +Math.max(0, ...pre.map((x) => Math.hypot(x.e[0] - R[0].e[0], x.e[1] - R[0].e[1]))).toFixed(3), ai: [...new Set(pre.map((x) => x.ai))], foeSwingsDuringOpen: pre.length ? pre.at(-1).swings - pre[0].swings : 0, foeTipMax: +Math.max(0, ...pre.map((x) => x.tip)).toFixed(1),
      introOn: on ? +on.fightT.toFixed(2) : null, introOff: off ? +off.fightT.toFixed(2) : null, toast: R.some((x) => x.toast),
    };
  });
  console.log(`  ${label}: ${JSON.stringify(r)}`);
  return r;
}
const expect = (cond, msg) => { if (!cond) { bad++; console.log(`   ✗ ${msg}`); } };

// ① 여정
{
  console.log('① 여정 (?weapon=longsword — 카드 없이)');
  const { page, errors } = await open('weapon=longsword');
  const a = await watchRound(page, '메뉴에서 시작', () => page.evaluate(() => document.getElementById('btnStart').click()));
  expect(a.mode === 'sweep' && a.stage === 'poseidon' && Math.abs(a.hold - 3.3) < 1e-3, '첫 판은 포세이돈 훑기 3.3 s');
  // 상대를 쓰러뜨려 이긴다 → 결과 창 → '다음 여정'
  await page.evaluate(() => { window.game.enemy.die('출혈', true); window.__tick(300); });
  const label1 = await page.evaluate(() => document.getElementById('btnStart').textContent);
  console.log(`   결과 단추: ${label1}`);
  const b = await watchRound(page, `'${label1}'`, () => page.evaluate(() => document.getElementById('btnStart').click()));
  expect(b.mode === 'sweep' && b.stage === 'clearing', "'다음 여정' 새 무대는 훑기");
  // 내가 쓰러져 진다 → '다시 겨루기' (같은 무대)
  await page.evaluate(() => { window.game.player.die('출혈', true); window.__tick(300); });
  const label2 = await page.evaluate(() => document.getElementById('btnStart').textContent);
  console.log(`   결과 단추: ${label2}`);
  const c = await watchRound(page, `'${label2}'`, () => page.evaluate(() => document.getElementById('btnStart').click()));
  expect(c.mode === 'settle' && c.stage === 'clearing' && Math.abs(c.hold - 1.1) < 1e-3, "'다시 겨루기'는 내려앉기 1.1 s");
  // 일시정지 → 처음부터 다시
  await page.evaluate(() => { window.__tick(30); document.getElementById('btnPause').click(); window.__tick(2); });
  const d = await watchRound(page, '처음부터 다시', () => page.evaluate(() => document.getElementById('btnStart').click()));
  expect(d.mode === 'settle', '처음부터 다시도 내려앉기');
  for (const r of [a, b, c, d]) {
    expect(r.bothHeldBefore, `${r.stage}/${r.mode}: 판 시작 동안 두 발 묶임`);
    expect(r.foeFreeAtLand, `${r.stage}/${r.mode}: 카메라가 닿는 화면에서 발이 풀림`);
    expect(r.camGapAtLand != null && r.camGapAtLand < 0.01, `${r.stage}/${r.mode}: 닿을 때 평소 자리와 같음`);
  }
  expect(a.introOn > 1.0 && a.introOn < 1.2 && Math.abs(a.introOff - a.landT) < 0.05, '훑기 판 소개: 1.1 게임 초에 떠서 닿을 때 걷힘');
  console.log(`   콘솔 오류 ${errors.length}${errors.length ? '\n   ' + errors.slice(0, 8).join('\n   ') : ''}`);
  bad += errors.length;
  await page.close();
}
// ② 예전 판 시작
{
  console.log('② ?openSweep=0');
  const { page, errors } = await open('weapon=longsword&openSweep=0');
  const a = await watchRound(page, '메뉴에서 시작', () => page.evaluate(() => document.getElementById('btnStart').click()));
  expect(a.mode === 'old' && Math.abs(a.hold - 2.0) < 1e-3 && a.introOn != null && a.introOn < 0.05, '예전 판 시작: 정지 2.0 s · 소개는 판 시작부터');
  console.log(`   콘솔 오류 ${errors.length}`);
  bad += errors.length;
  await page.close();
}
// ③ 카드 뽑기 흐름
{
  console.log('③ 카드 뽑기 (?stage=castle)');
  const { page, errors } = await open('stage=castle');
  await page.evaluate(() => { document.getElementById('btnStart').click(); window.__tick(60); });
  const during = await page.evaluate(() => ({ state: window.game.state, u: window.game.player.fightT, mode: window.game.camOpen.mode }));
  console.log(`   카드 고르는 동안: ${JSON.stringify(during)}`);
  expect(during.state === 'draw' && during.u === 0 && during.mode === 'sweep', '카드 고르는 동안 훑기 시작 자리(시계 0)');
  const a = await watchRound(page, '카드 고른 뒤', () => page.evaluate(() => { document.querySelector('#draw .wcard[data-i="0"]').click(); }));
  expect(a.mode === 'sweep' && a.bothHeldBefore && a.foeFreeAtLand, '카드가 사라지면 훑기 → 닿을 때 시작');
  console.log(`   콘솔 오류 ${errors.length}`);
  bad += errors.length;
  await page.close();
}
// ④ 기본 상대
{
  console.log('④ ?foe=default (판 시작 몸짓 없는 AI)');
  const { page, errors } = await open('weapon=longsword&foe=default');
  const a = await watchRound(page, '메뉴에서 시작', () => page.evaluate(() => document.getElementById('btnStart').click()));
  expect(a.foeMove < 0.15, '기본 상대: 훑기 동안 제자리');
  expect(a.foeSwingsDuringOpen === 0, '기본 상대: 훑기 동안 휘두르지 않음');
  console.log(`   콘솔 오류 ${errors.length}`);
  bad += errors.length;
  await page.close();
}
await browser.close();
console.log(bad ? `문제 ${bad}` : '흐름 모두 맞음 · 콘솔 오류 0');
process.exit(bad ? 1 : 0);

// 부활 연출 확인 (이졸데, src/revive.js · revive_fx.js): 실제 게임 화면(844×390 가로 폰)에서 이졸데를 강제로 쓰러뜨리고
//  쓰러짐 → 빛이 내려옴 → 빛이 다 내려옴(알림) → 빛 속에서 일어섬 → 선 채 빛이 사라짐 → (두 번째 죽음) 결과 화면을 찍는다.
//  시간은 playwright 가짜 시계로 한 프레임(1/60초)씩 돌린다 → 느린 그래픽(소프트웨어 렌더링)에서도 매번 같은 순간이 찍힌다.
//  확인하는 것: 콘솔 에러 0, 부활 뒤 칼을 쥐고 섰나, 알림 글, 연출이 끝나면 장면에 연출 물체·빛이 남지 않나(장면 자식 수 전·후),
//   두 번째 죽음 → 승리 화면, (defeat) 부활하는 동안 주인공이 죽으면 → 패배 화면, 결과 화면·배경 바꿈 뒤 연출 없음
//  실행: vite 개발 서버를 띄운 뒤
//    node tools/browser/revive_shots.mjs http://127.0.0.1:5173 <출력 폴더> [castle,cathedral,darkhall,clearing,castle_px,defeat]
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const out = process.argv[3] || '.';
const runs = (process.argv[4] || 'castle,cathedral,darkhall,clearing,castle_px,defeat').split(',');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
const report = [];

async function open(stage, { pixel = false, tag }) {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${tag} console: ${m.text()}`));
  page.on('requestfailed', (r) => errors.push(`${tag} requestfailed: ${r.url()}`));
  page.on('response', (r) => r.status() >= 400 && errors.push(`${tag} http ${r.status()}: ${r.url()}`));
  await page.addInitScript((px) => localStorage.setItem('gladiator-settings', JSON.stringify({ pixel: px })), pixel);
  // 가짜 시계: 처음부터 멈춰 두고 runFor 로만 돌린다 (install 만 하면 실제 시간대로 흘러, 찍고 재는 동안에도 게임이 흐른다)
  await page.clock.install({ time: new Date('2026-09-28T12:00:00') });
  await page.clock.pauseAt(new Date('2026-09-28T12:00:01'));
  await page.goto(`${base}/?foe=isolde&stage=${stage}&weapon=longsword`, { waitUntil: 'networkidle' });
  for (let i = 0; i < 300 && !(await page.evaluate(() => !!window.game?.player?.sword)); i++) await page.waitForTimeout(100);
  await page.clock.runFor(200);
  await page.evaluate(() => document.getElementById('btnStart').click());
  await run(page, 100);
  return page;
}
const run = (page, ms) => page.clock.runFor(ms);
/** 조건이 참이 될 때까지 한 프레임씩 (최대 maxMs 가짜 시간) */
async function until(page, fn, arg, maxMs = 15000) {
  for (let t = 0; t < maxMs; t += 17) {
    if (await page.evaluate(fn, arg)) return true;
    await run(page, 17);
  }
  return false;
}
const shot = async (page, name) => {
  const file = path.join(out, `${name}.png`);
  fs.writeFileSync(file, await page.screenshot());
  return file;
};
const info = (page) =>
  page.evaluate(() => {
    const g = window.game;
    const scene = g.player.scene;
    let fxObjs = 0;
    let lights = 0;
    scene.traverse((o) => {
      if (o.name === 'reviveFx') fxObjs++;
      if (o.isLight) lights++;
    });
    const V = g.enemy.revival;
    const el = document.getElementById('emoMsg');
    return {
      state: g.state,
      e: g.enemy.state,
      p: g.player.state,
      armed: g.enemy.armed,
      broken: g.enemy.weaponBroken,
      revival: V ? { phase: V.phase, t: +V.t.toFixed(2), standT: +V.standT.toFixed(2) } : null,
      left: g.enemy.revive?.left,
      blood: +g.enemy.blood.toFixed(2),
      bleed: +g.enemy.bleed.toFixed(3),
      emotion: g.ai.emotion,
      children: scene.children.length,
      fxObjs,
      lights,
      fxActive: g.reviveFx.active,
      notice: el.classList.contains('show') ? el.textContent : '',
      title: document.getElementById('menu').classList.contains('show') ? document.getElementById('menuTitle').textContent + ' / ' + document.getElementById('menuSub').textContent : '',
      render: g.renderInfo(),
      stageLight: +g.fighterLight.stageLight.toFixed(2),
      stage: g.stage.id,
    };
  });

async function reviveRun(tag, stage, { pixel = false, disarm = false, second = true, stageChange = false } = {}) {
  const page = await open(stage, { pixel, tag });
  const r = { tag, stage, pixel, disarm };
  await run(page, 1200);
  r.before = await info(page);
  // 이졸데를 쓰러뜨린다 (피를 쓰러짐 문턱 아래로 — 다음 물리 스텝에 '출혈'로 죽는다 → 부활)
  await page.evaluate((d) => {
    const e = window.game.enemy;
    if (d) e.dropSword();
    e.blood = 0.3;
  }, disarm);
  await until(page, () => !!window.game.enemy.revival);
  const at = (t) => until(page, (x) => (window.game.enemy.revival?.t ?? 99) >= x, t);
  await at(0.7);
  r.fall = await info(page);
  r.shots = [await shot(page, `${tag}_1_fall`)];
  await at(1.36);
  r.descend = await info(page);
  r.shots.push(await shot(page, `${tag}_2_descend`));
  await at(1.75);
  r.full = await info(page);
  r.shots.push(await shot(page, `${tag}_3_notice`));
  await at(2.62);
  r.rising = await info(page);
  r.shots.push(await shot(page, `${tag}_4_rising`));
  // 옆에서 한 장 (기본 카메라는 주인공 어깨 너머라 주인공 몸이 그녀를 가리기도 한다). 찍고 나서 카메라를 그대로 되돌린다
  await page.evaluate(() => {
    const g = window.game;
    const T = g.THREE;
    const e = g.enemy.pelvisPos;
    const d = new T.Vector3().subVectors(e, g.player.pelvisPos).setY(0).normalize();
    g.__cam = { p: g.camera.position.clone(), q: g.camera.quaternion.clone() };
    g.freeCam = true;
    g.camera.position.copy(e).addScaledVector(new T.Vector3(-d.z, 0, d.x), 3.4).addScaledVector(d, -1.4).setY(1.5);
    g.camera.lookAt(e.x, 1.25, e.z);
  });
  await run(page, 17);
  r.shots.push(await shot(page, `${tag}_4b_side`));
  await page.evaluate(() => {
    const g = window.game;
    g.camera.position.copy(g.__cam.p);
    g.camera.quaternion.copy(g.__cam.q);
    g.freeCam = false;
  });
  await until(page, () => window.game.enemy.revival?.phase === 'stand');
  r.stood = await info(page);
  await until(page, () => {
    const V = window.game.enemy.revival;
    return !V || V.t >= V.standT + 0.8;
  });
  r.fading = await info(page);
  r.shots.push(await shot(page, `${tag}_5_fading`));
  await until(page, () => !window.game.enemy.revival);
  await run(page, 100);
  r.after = await info(page);
  await run(page, 1500);
  r.fighting = await info(page);
  r.shots.push(await shot(page, `${tag}_6_fighting`));
  if (second) {
    await page.evaluate(() => (window.game.enemy.blood = 0.3));
    await until(page, () => window.game.enemy.state === 'dead');
    r.dead2 = await info(page);
    await until(page, () => document.getElementById('menu').classList.contains('show'), null, 8000);
    await run(page, 400);
    r.result = await info(page);
    r.shots.push(await shot(page, `${tag}_7_result`));
  }
  if (stageChange) {
    await page.evaluate(() => window.game.setStage('cathedral'));
    await run(page, 100);
    r.stageChanged = await info(page);
  }
  await page.close();
  return r;
}

/** 이졸데가 일어서는 동안 주인공이 죽는다 → 패배 화면, 연출은 치워진다 */
async function defeatRun() {
  const tag = 'defeat';
  const page = await open('castle', { tag });
  const r = { tag, stage: 'castle' };
  await run(page, 1200);
  r.before = await info(page);
  await page.evaluate(() => (window.game.enemy.blood = 0.3));
  await until(page, () => (window.game.enemy.revival?.t ?? 0) >= 1.0);
  await page.evaluate(() => window.game.player.die('목'));
  await run(page, 600);
  r.playerDead = await info(page);
  r.shots = [await shot(page, `${tag}_1_player_dead_in_revive`)];
  await until(page, () => document.getElementById('menu').classList.contains('show'), null, 8000);
  await run(page, 400);
  r.result = await info(page);
  r.shots.push(await shot(page, `${tag}_2_result`));
  await page.close();
  return r;
}

for (const k of runs) {
  if (k === 'defeat') report.push(await defeatRun());
  else if (k === 'castle') report.push(await reviveRun('castle', 'castle', { disarm: true, stageChange: true }));
  else if (k === 'castle_px') report.push(await reviveRun('castle_px', 'castle', { pixel: true, second: false }));
  else report.push(await reviveRun(k, k, { second: false }));
}
fs.writeFileSync(path.join(out, 'revive_shots.json'), JSON.stringify(report, null, 1));
for (const r of report) {
  const s = (x) => (x ? JSON.stringify({ ...x, render: undefined }) : '-');
  console.log(`\n== ${r.tag} (${r.stage}${r.pixel ? ', pixel' : ''}${r.disarm ? ', 칼 놓침' : ''})`);
  for (const k of ['before', 'fall', 'descend', 'full', 'rising', 'stood', 'fading', 'after', 'fighting', 'dead2', 'result', 'stageChanged', 'playerDead']) if (r[k]) console.log(`${k.padEnd(12)} ${s(r[k])}`);
  if (r.before && r.full) console.log(`draw calls ${r.before.render.calls} → ${r.full.render.calls}, triangles ${r.before.render.triangles} → ${r.full.render.triangles}`);
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : '\nZERO console errors');
await browser.close();
process.exit(errors.length ? 1 : 0);

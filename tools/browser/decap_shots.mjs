// 참수 연출 확인 (사장님 9/30, config.js COMBAT.decapitate): 실제 게임 화면(844×390 가로 폰)에서 상대의 목을 스크립트로 베고
//  0.2초·1.5초 뒤를 찍는다 (기본 카메라 + 옆에서). 시간은 playwright 가짜 시계로 한 프레임(1/60초)씩 돌린다.
//  베는 법(시험 전용, window.game): 상대 칼 충돌을 끄고, 내 칼의 손목 관절을 떼어 칼날을 상대 목 높이에 가로로 눕히고
//   날이 앞장서게 옆으로 몬다 — 첫 상처가 날 때까지만 속도를 정하고 그 뒤는 물리에 맡긴다 (tools/sim/decap_check.mjs drive 와 같다).
//  확인하는 것: 콘솔 에러 0, 참수(목 관절 뗌·머리가 떨어져 나감·목 단면 상처), 이졸데면 부활하지 않음, 결과 화면 뒤 다시 싸우기 →
//   새 상대는 머리가 붙어 있다
//  실행: vite 개발 서버를 띄운 뒤
//    node tools/browser/decap_shots.mjs http://127.0.0.1:5173 <출력 폴더> [liao,isolde]  (상대 캐릭터 id 마다 한 판)
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const out = process.argv[3] || '.';
const runs = (process.argv[4] || 'liao,isolde').split(',');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
const report = [];
const fails = [];

const run = (page, ms) => page.clock.runFor(ms);
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
/** 옆에서 상대 쪽을 한 장 찍고 카메라를 되돌린다 */
async function sideShot(page, name) {
  await page.evaluate(() => {
    const g = window.game;
    const T = g.THREE;
    const e = g.enemy.pelvisPos;
    const d = new T.Vector3().subVectors(e, g.player.pelvisPos).setY(0).normalize();
    g.__cam = { p: g.camera.position.clone(), q: g.camera.quaternion.clone() };
    g.freeCam = true;
    g.camera.position.copy(e).addScaledVector(new T.Vector3(-d.z, 0, d.x), 3.2).addScaledVector(d, -1.2).setY(1.6);
    g.camera.lookAt(e.x, 1.1, e.z);
  });
  await run(page, 17);
  const f = await shot(page, name);
  await page.evaluate(() => {
    const g = window.game;
    g.camera.position.copy(g.__cam.p);
    g.camera.quaternion.copy(g.__cam.q);
    g.freeCam = false;
  });
  return f;
}
const info = (page) =>
  page.evaluate(() => {
    const g = window.game;
    const E = g.enemy;
    const h = E.bodies.head.translation();
    const c = E.bodies.chest.translation();
    // 목 관절 자리 틈: 가슴 몸 (0, 0.17, 0) 과 머리 몸 (0, -0.12, 0) — 붙어 있으면 0 가까이
    const T = g.THREE;
    const at = (b, y) => { const r = b.rotation(), t = b.translation(); return new T.Vector3(0, y, 0).applyQuaternion(new T.Quaternion(r.x, r.y, r.z, r.w)).add(new T.Vector3(t.x, t.y, t.z)); };
    return {
      neckGap: +at(E.bodies.chest, 0.17).distanceTo(at(E.bodies.head, -0.12)).toFixed(3),
      state: g.state,
      e: E.state,
      cause: E.causeOfDeath ?? null,
      decap: !!E.decapitated,
      joints: E.joints.length,
      headChest: +Math.hypot(h.x - c.x, h.y - c.y, h.z - c.z).toFixed(3),
      headY: +h.y.toFixed(3),
      stump: E.wounds.some((w) => w.stump),
      revival: !!E.revival,
      left: E.revive?.left ?? null,
      sim: +g.stats.simTime.toFixed(2),
      foe: E.name,
      weapon: g.player.weapon.id,
      foeWeapon: E.weapon.id,
      menu: document.getElementById('menu').classList.contains('show') ? document.getElementById('menuTitle').textContent + ' / ' + document.getElementById('menuSub').textContent : '',
    };
  });

async function decapRun(tag) {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${tag} console: ${m.text()}`));
  page.on('requestfailed', (r) => errors.push(`${tag} requestfailed: ${r.url()}`));
  page.on('response', (r) => r.status() >= 400 && errors.push(`${tag} http ${r.status()}: ${r.url()}`));
  await page.clock.install({ time: new Date('2026-09-30T12:00:00') });
  await page.clock.pauseAt(new Date('2026-09-30T12:00:01'));
  const q = `weapon=zweihander&stage=castle&foe=${tag}`;
  await page.goto(`${base}/?${q}`, { waitUntil: 'networkidle' });
  for (let i = 0; i < 300 && !(await page.evaluate(() => !!window.game?.player?.sword)); i++) await page.waitForTimeout(100);
  await run(page, 200);
  await page.evaluate(() => document.getElementById('btnStart').click());
  await run(page, 2700); // 시작 정지(ARENA.startHold 2초) 뒤
  const r = { tag, query: q, before: await info(page), shots: [] };
  // 목으로 칼을 몬다
  r.drive = await page.evaluate((speed) => {
    const g = window.game;
    const T = g.THREE;
    const P = g.player, E = g.enemy;
    for (const c of E.swordColliders) c.setCollisionGroups(0);
    g.world.removeImpulseJoint(P.gripJoint, true);
    const hb = E.bodies.head;
    const hr = hb.rotation(), ht = hb.translation();
    const neck = new T.Vector3(0, -0.075, 0).applyQuaternion(new T.Quaternion(hr.x, hr.y, hr.z, hr.w)).add(new T.Vector3(ht.x, ht.y, ht.z));
    const fwd = E.pelvisPos.sub(P.pelvisPos).setY(0).normalize();
    const m = new T.Vector3(0, 1, 0).cross(fwd).normalize();
    const zl = m.clone().cross(fwd).normalize();
    const qq = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(m, fwd, zl));
    const L = P.weaponCfg.hiltLength + 0.6 * P.weaponCfg.bladeLength;
    const o = neck.clone().addScaledVector(fwd, -L).addScaledVector(m, -0.3);
    const sw = P.sword;
    sw.setTranslation({ x: o.x, y: o.y, z: o.z }, true);
    sw.setRotation({ x: qq.x, y: qq.y, z: qq.z, w: qq.w }, true);
    P.tipPrev = null;
    P.hitPointPrev = null;
    const n0 = E.wounds.length;
    const cache = P.cacheState.bind(P);
    let steps = 0;
    P.cacheState = () => {
      if (E.wounds.length === n0 && steps++ < 60) {
        sw.setLinvel({ x: m.x * speed, y: m.y * speed, z: m.z * speed }, true);
        sw.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
      cache();
    };
    return { neckY: +neck.y.toFixed(3), speed };
  }, 14);
  const ok = await until(page, () => window.game.enemy.decapitated || window.game.enemy.wounds.length > 0, null, 3000);
  r.hit = await page.evaluate(() => window.game.stats.hits.slice(-3));
  if (!ok || !(await page.evaluate(() => window.game.enemy.decapitated))) {
    fails.push(`${tag}: 참수 안 됨 ${JSON.stringify(r.hit)}`);
    await page.close();
    return r;
  }
  await run(page, 200);
  r.t02 = await info(page);
  r.shots.push(await shot(page, `${tag}_1_0.2s`));
  r.shots.push(await sideShot(page, `${tag}_1b_0.2s_side`));
  await run(page, 1300);
  r.t15 = await info(page);
  r.shots.push(await shot(page, `${tag}_2_1.5s`));
  r.shots.push(await sideShot(page, `${tag}_2b_1.5s_side`));
  // 결과 화면 → 다시 싸우기: 새 상대는 머리가 붙어 있다
  await until(page, () => document.getElementById('menu').classList.contains('show'), null, 15000);
  await run(page, 300);
  r.result = await info(page);
  r.shots.push(await shot(page, `${tag}_3_result`));
  await page.evaluate(() => document.getElementById('btnStart').click());
  await run(page, 1500);
  r.restart = await info(page);
  r.shots.push(await shot(page, `${tag}_4_restart`));
  if (!(r.t02.decap && r.t02.joints === 12 && r.t02.stump && r.t02.e === 'dead')) fails.push(`${tag}: 0.2초 ${JSON.stringify(r.t02)}`);
  // 1.5초(화면 시간)는 결정타 슬로모션 때문에 물리로는 약 0.4초 — 판 끝 화면(물리 약 1.3초)에서 0.3 m 넘게 벌어졌나
  if (!(r.result.neckGap > 0.3)) fails.push(`${tag}: 판 끝 목 자리 틈 ${r.result.neckGap} m`);
  if (tag === 'isolde' && (r.t15.revival || r.t15.left !== 1)) fails.push(`${tag}: 부활 ${r.t15.revival} 남은 ${r.t15.left}`);
  if (!(r.restart.decap === false && r.restart.joints === 13 && r.restart.neckGap < 0.02 && r.restart.e !== 'dead')) fails.push(`${tag}: 다시 싸우기 ${JSON.stringify(r.restart)}`);
  await page.close();
  return r;
}

for (const k of runs) report.push(await decapRun(k));
fs.writeFileSync(path.join(out, 'decap_shots.json'), JSON.stringify(report, null, 1));
for (const r of report) {
  console.log(`\n== ${r.tag} (${r.query}) 몰기 ${JSON.stringify(r.drive)} 타격 ${JSON.stringify(r.hit)}`);
  for (const k of ['before', 't02', 't15', 'result', 'restart']) if (r[k]) console.log(`${k.padEnd(8)} ${JSON.stringify(r[k])}`);
}
console.log(fails.length ? 'FAILS:\n' + fails.join('\n') : '\n참수 확인 통과');
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ZERO console errors');
await browser.close();
process.exit(errors.length || fails.length ? 1 : 0);

// 대검 겨눔 팔 브라우저 재기 · 그림 (10/31 사장님 '언젠가부터 대검을 이상하게 들더라' — docs/motion/guard_arms_2026-10-31.md · 확인표 3320 ~ 3329). 읽기만.
//  실제 빌드(주소 판 ?weapon=<무기>&stage=poseidon&foe=heinrich · 844 × 390 · CDP 터치)에서 상대 AI 를 멈추고 사람 몸 겨눔을 장면마다 잰다(가슴 틀 [앞, 위, 칼 든 쪽] 두 손 · 팔꿈치 각 · 칼 올림/방위 ·
//   쉼 무게 bodyPose.idle · handHeld · handGrip) · 그림 셋(게임 카메라 뒤 · 옆 · 앞 — 멈춤 KeyP 동안).
//  장면: idle(손 뗌) · rest(엄지를 얹고 2 s — 안 끔: 사장님 화면) · drag(40 px 천천히 끈 뒤 댄 채 1.5 s) · swipeRest(가로 긋고 곧 다시 얹어 2.5 s) ·
//   jitter(얹은 엄지가 ±1 px 떨고 4 px 까지 떠돎 2 s) · wind(얹고 1.6 s — 풍차 베기 감기 · 떼고 1.5 s 뒤 서 있나, 그림 없음) · pad:x:y(패드를 그 자리에 놓고 손 뗌)
//  실행 (자기 포트): npx vite build && npx http-server dist -p 4472 -s &
//        node tools/browser/guard_arms_shots.mjs http://127.0.0.1:4472 zweihander after idle,rest,drag,swipeRest [주소 덧붙임 예 restTouch=0] [그림 폴더 (기본 .tmp/shots)]
//  끝 줄 = JSON { tag, weapon, extra, out: [장면마다 수], errors(콘솔 · 페이지 오류 — 404 빼고) }
import fs from 'node:fs';
import { createRequire } from 'node:module';
let chromium;
try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')); } // 저장소에 playwright 가 없으면 전역 설치
const [base, weapon, tag, scenesArg, extra = '', shotDir = '.tmp/shots'] = process.argv.slice(2);
const scenes = scenesArg.split(',');
fs.mkdirSync(shotDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror ' + e));
page.on('console', (m) => m.type() === 'error' && !/404/.test(m.text()) && errors.push(m.text()));
await page.goto(`${base}/?weapon=${weapon}&stage=poseidon&foe=${process.env.FOE || 'heinrich'}${extra ? '&' + extra : ''}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 180000 });
await page.getByText('여정 시작').click();
await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 180000 });
await page.evaluate(() => {
  const g = window.game, e = g.enemy;
  g.ai.update = () => e.move.set(0, 0);
  e.die = () => {};
  const tc = document.getElementById('techCue'); if (tc) tc.style.visibility = 'hidden';
});
const simNow = () => page.evaluate(() => window.game.stats.simTime);
const waitSim = async (dt) => { const t = await simNow(); await page.waitForFunction((t) => window.game.stats.simTime > t, t + dt, { timeout: 600000 }); };
await page.waitForFunction(() => window.game.stats.simTime > 3.0, null, { timeout: 600000 });
const probe = () => page.evaluate(() => {
  const g = window.game, f = g.player;
  const Q = (b) => { const r = b.rotation(); return [r.x, r.y, r.z, r.w]; };
  const ap = ([x, y, z, w], v) => { const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2]; return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]; };
  const W = (b, l) => { const t = b.translation(); const p = ap(Q(b), l); return [p[0] + t.x, p[1] + t.y, p[2] + t.z]; };
  const ch = f.bodies.chest, ct = ch.translation(), cq = Q(ch), ci = [-cq[0], -cq[1], -cq[2], cq[3]];
  const L = (p) => { const v = ap(ci, [p[0] - ct.x, p[1] - ct.y, p[2] - ct.z]); return [v[0], v[1], v[2] * f.side]; };
  const B = f.bodies;
  const shS = W(B.uarmS, [-0.15, 0, 0]), elS = W(B.uarmS, [0.15, 0, 0]), haS = W(B.farmS, [0.135, 0, 0]);
  const shO = W(B.uarmO, [0, 0.15, 0]), elO = W(B.uarmO, [0, -0.15, 0]), haO = W(B.farmO, [0, -0.135, 0]);
  const ang = (a, b, c) => { const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], v = [c[0] - b[0], c[1] - b[1], c[2] - b[2]]; const d = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / Math.hypot(...u) / Math.hypot(...v); return Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI; };
  const dW = ap(Q(f.sword), [0, 1, 0]); const dL = ap(ci, dW); const dir = [dL[0], dL[1], dL[2] * f.side];
  const r3 = (a) => a.map((x) => +x.toFixed(3));
  const gp = f.guardPose;
  return { sim: +g.stats.simTime.toFixed(2), hud: f.swordArt?.names?.[gp?.nearest ?? -1]?.name ?? null, pad: r3([f.handOffset.x, f.handOffset.y]), held: !!f.handHeld, grip: f.handGrip, idleW: +(f.bodyPose?.idle ?? NaN).toFixed(2),
    handS: r3(L(haS)), handO: r3(L(haO)), elbowAngS: +ang(shS, elS, haS).toFixed(1), elbowAngO: +ang(shO, elO, haO).toFixed(1),
    bladeEl: +(Math.asin(Math.max(-1, Math.min(1, dir[1]))) * 180 / Math.PI).toFixed(1), bladeAz: +(Math.atan2(dir[2], dir[0]) * 180 / Math.PI).toFixed(1), gripping: f.gripping };
});
const cdp = await ctx.newCDPSession(page);
const W0 = 844, H0 = 390;
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 7 }], timestamp: Date.now() / 1000 });
async function views(name) {
  await page.evaluate(() => { const g = window.game; if (g.state === 'fight') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); const m = document.getElementById('menu'); if (m) m.style.visibility = 'hidden'; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${shotDir}/${tag}_${name}_back.png` });
  for (const v of ['side', 'front']) {
    await page.evaluate((v) => {
      const g = window.game, f = g.player, o = g.enemy;
      const b = f.bodies.chest.translation(), a = o.bodies.chest.translation();
      let fx = a.x - b.x, fz = a.z - b.z; const Ln = Math.hypot(fx, fz) || 1; fx /= Ln; fz /= Ln;
      const rx = -fz, rz = fx, s = f.side;
      g.freeCam = true;
      if (v === 'side') { g.camera.position.set(b.x + rx * s * 2.3 + fx * 0.3, 1.45, b.z + rz * s * 2.3 + fz * 0.3); g.camera.lookAt(b.x + fx * 0.35, 1.3, b.z + fz * 0.35); }
      else { g.camera.position.set(b.x + fx * 2.1 + rx * s * 0.5, 1.5, b.z + fz * 2.1 + rz * s * 0.5); g.camera.lookAt(b.x, 1.3, b.z); }
    }, v);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${shotDir}/${tag}_${name}_${v}.png` });
  }
  await page.evaluate(() => { const g = window.game; g.freeCam = false; if (g.state === 'paused') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); const m = document.getElementById('menu'); if (m) m.style.visibility = ''; });
  await page.waitForTimeout(200);
}
const out = [];
for (const sc of scenes) {
  const x = W0 * 0.72, y = H0 * 0.45;
  if (sc === 'idle') { await waitSim(1.0); out.push({ sc, ...(await probe()) }); await views(sc); continue; }
  if (sc === 'rest') {
    await touch('touchStart', x, y); await waitSim(2.0);
    out.push({ sc, ...(await probe()) }); await views(sc); await touch('touchEnd'); await waitSim(1.5); continue;
  }
  if (sc === 'jitter') { // 얹은 엄지 떨림 · 떠돎 (±1 px 흔들림 + 4 px 까지 떠돎 — 확인표 3154 실측 꼴) 2 s
    await touch('touchStart', x, y);
    const t0 = await simNow();
    for (let i = 0; (await simNow()) < t0 + 2.0; i++) { await touch('touchMove', x + (i % 2 ? 1 : -1) + Math.min(4, i * 0.1), y + (i % 3) - 1); await page.waitForTimeout(50); }
    out.push({ sc, ...(await probe()) }); await views(sc); await touch('touchEnd'); await waitSim(1.5); continue;
  }
  if (sc === 'wind') {
    await touch('touchStart', x, y); await waitSim(1.6);
    const a = await probe(); a.winding = await page.evaluate(() => !!window.game.player.skill.uniq?.winding); out.push({ sc: 'wind-hold', ...a });
    await touch('touchEnd'); await waitSim(1.5);
    const b = await probe(); b.state = await page.evaluate(() => window.game.player.state); out.push({ sc: 'wind-after', ...b }); continue;
  }
  if (sc === 'drag') {
    await touch('touchStart', x, y); for (let i = 1; i <= 8; i++) { await touch('touchMove', x - 5 * i, y); await page.waitForTimeout(60); }
    await waitSim(1.5); out.push({ sc, ...(await probe()) }); await views(sc); await touch('touchEnd'); await waitSim(1.5); continue;
  }
  if (sc === 'swipeRest') {
    await touch('touchStart', W0 * 0.85, y); for (let i = 1; i <= 8; i++) { await touch('touchMove', W0 * (0.85 - 0.04 * i), y); await page.waitForTimeout(22); }
    await touch('touchEnd'); await page.waitForTimeout(40); await touch('touchStart', x, y); await waitSim(2.5);
    out.push({ sc, ...(await probe()) }); await views(sc); await touch('touchEnd'); await waitSim(1.5); continue;
  }
  if (sc.startsWith('pad:')) {
    const [, px, py] = sc.split(':');
    await page.evaluate(([px, py]) => { const f = window.game.player; f.handOffset.set(+px, +py); const k = f.skill; for (const v of [k.prev, k.aim, k.aimRaw, k.anchor]) v?.set(+px, +py); k.aimVel?.set(0, 0); k.vel?.set(0, 0); }, [px, py]);
    await waitSim(1.5); out.push({ sc, ...(await probe()) }); await views(sc.replace(/[:.]/g, '_')); continue;
  }
}
console.log(JSON.stringify({ tag, weapon, extra, out, errors }));
await browser.close();

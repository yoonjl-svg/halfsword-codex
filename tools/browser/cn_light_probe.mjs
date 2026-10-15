// 동방 보법 '가벼운 발' 브라우저 확인 (10/15 — docs/strike/cn_light_feet_2026-10-15.md §3-E): 실제 게임(테스트 경로, 청강검 사람 대 이졸데 — AI 판단 끔·상처 끔)에서
//  키보드(W·S — Playwright 가 CDP 로 누름)로 ① 앞 끝 1.2 s 걷다 놓기 ② 앞 끝 1.2 s → 뒤 끝 1.2 s 바꾸기를 하고, 같은 차례를 `&cnLight=0` 으로 한 번 더 한다.
//  물리 스텝마다 골반 자리·빠르기·스틱을 적고(combat.afterStep 을 감싸 읽기만) 콘솔·페이지 오류·HTTP 400 이상을 센다. 판 시작 거리(5.6 m)에서 시작해 상대와 멀다(따라붙는 걸음 문턱 3.3 m 밖).
//  잰다: ① 놓기 전 0.3 s 골반 빠르기 · 서기까지(골반 수평 빠르기 ≤ 0.1 m/s 첫 때) · 미끄러짐(골반) ② 바꾸기 전 빠르기 · 뒤로 0.5 m/s 넘게 갈 때까지 · 바꾼 뒤 앞으로 더 간 거리 —
//  시뮬 tools/sim/cn_light_feel.mjs 의 stop·turn 과 같은 셈(시간은 게임 시간 — 테스트 경로 템포 1.1 은 화면 시계만 바꾼다). 사진은 출력 폴더에만(저장소에 넣지 않음).
//  실행: npx vite --config <자기 설정 — 자기 포트(5190 이상)·자기 캐시 폴더> & → node tools/browser/cn_light_probe.mjs http://127.0.0.1:<포트> <출력 폴더>
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:5291';
const dir = process.argv[3] || '.';
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];

async function open(extra = '') {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror${extra}: ${e}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console${extra}: ${m.text()}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`http ${r.status()}${extra}: ${r.url()}`);
  });
  await page.goto(`${base}/index.html?test=1&weapon=qinggang&hero=player&foe=isolde&stage=castle&openSweep=0${extra}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword && document.getElementById('btnStart'), null, { timeout: 120000 });
  await page.evaluate(() => document.getElementById('btnStart').click());
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 120000 });
  await page.evaluate(() => {
    const g = window.game;
    const P = g.player;
    const E = g.enemy;
    P.applyWound = () => {};
    E.applyWound = () => {};
    g.ai.update = () => E.move.set(0, 0); // 상대는 제자리 (AI 판단 끔)
    g._log = [];
    const c = g.combat;
    const o = c.afterStep.bind(c);
    c.afterStep = (...a) => {
      const res = o(...a);
      const p = P.bodies.pelvis.translation();
      const v = P.bodies.pelvis.linvel();
      g._log.push([g.stats.simTime, p.x, p.z, v.x, v.z, Math.cos(P.heading), -Math.sin(P.heading), P.move.y, P.foeDistance()]);
      if (g._log.length > 30000) g._log.splice(0, 15000);
      return res;
    };
  });
  return page;
}
const sim = (page) => page.evaluate(() => window.game.stats.simTime);
const waitSim = (page, t) => page.waitForFunction((t) => window.game.stats.simTime >= t, t, { timeout: 180000 });
async function settle(page) {
  await page.waitForFunction(() => {
    const G = window.game.player.gait;
    return G.active && G.legs.F.stance && G.legs.B.stance && G.sinceTD > 0.6 && !G.walking && window.game.stats.simTime > 3;
  }, null, { timeout: 180000 });
}
/** 기록에서: 스틱 앞뒤 값이 바뀐 첫 스텝(t1) 뒤를 잼 (골반 — 바꾼 때 몸의 앞 축) */
async function measure(page, t0, kind) {
  return page.evaluate(
    ([t0, kind]) => {
      const L = window.game._log.filter((q) => q[0] >= t0);
      let i1 = -1;
      for (let i = 1; i < L.length; i++) if (L[i - 1][7] > 0.5 && L[i][7] < 0.5) {
        i1 = i - 1;
        break;
      }
      if (i1 < 0) return null;
      const [t1, x1, z1, , , fx, fz] = L[i1];
      const pre = L.filter((q) => q[0] > t1 - 0.3 && q[0] <= t1).map((q) => q[3] * fx + q[4] * fz);
      const v0 = pre.reduce((a, b) => a + b, 0) / pre.length;
      const out = { v0, d1: L[i1][8], light: window.game.player.gait.P.light ?? null, cnLight: window.game.config?.GAIT?.cnLight ?? null };
      if (kind === 'stop') {
        for (let i = i1 + 1; i < L.length; i++) {
          if (Math.hypot(L[i][3], L[i][4]) <= 0.1) {
            out.ts = L[i][0] - t1;
            out.ds = Math.hypot(L[i][1] - x1, L[i][2] - z1);
            break;
          }
        }
      } else {
        let extra = 0;
        for (let i = i1 + 1; i < L.length; i++) {
          const f = (L[i][1] - x1) * fx + (L[i][2] - z1) * fz;
          extra = Math.max(extra, f);
          if (out.tb == null && L[i][3] * fx + L[i][4] * fz < -0.5) out.tb = L[i][0] - t1;
        }
        out.extra = extra;
      }
      return out;
    },
    [t0, kind],
  );
}
async function hold(page, key, secs) {
  const t = await sim(page);
  await page.keyboard.down(key);
  await waitSim(page, t + secs);
  await page.keyboard.up(key);
}
const f2 = (v) => (v == null || !Number.isFinite(v) ? '-' : v.toFixed(2));
const rows = [];
for (const [extra, name] of [['', '기본 (켬)'], ['&cnLight=0', '`?cnLight=0` (끔)']]) {
  const page = await open(extra);
  await settle(page);
  // ① 앞 끝 1.2 s 걷다 놓기
  let t0 = await sim(page);
  await hold(page, 'KeyW', 1.2);
  await waitSim(page, (await sim(page)) + 1.5);
  const a = await measure(page, t0, 'stop');
  await page.screenshot({ path: `${dir}/cn_light${extra ? '_off' : '_on'}_stop.png` });
  // 판 시작 거리 쪽으로 되돌아감 (뒤 끝) → 선 뒤 ② 앞 끝 1.2 s → 뒤 끝 1.2 s
  await hold(page, 'KeyS', 1.6);
  await settle(page);
  t0 = await sim(page);
  const t = await sim(page);
  await page.keyboard.down('KeyW');
  await waitSim(page, t + 1.2);
  await page.keyboard.down('KeyS');
  await page.keyboard.up('KeyW');
  await waitSim(page, t + 2.4);
  await page.keyboard.up('KeyS');
  await waitSim(page, (await sim(page)) + 0.5);
  const b = await measure(page, t0, 'turn');
  await page.screenshot({ path: `${dir}/cn_light${extra ? '_off' : '_on'}_turn.png` });
  rows.push({ name, a, b });
  await page.context().close();
}
console.log('| 판 | light · cnLight | ① 놓을 때 상대 거리 m | 놓기 전 골반 빠르기 m/s | 서기까지 s | 미끄러짐 골반 m | ② 바꿀 때 상대 거리 m | 바꾸기 전 빠르기 m/s | 뒤로 0.5 m/s 넘게까지 s | 바꾼 뒤 앞으로 더 간 거리 m |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.name} | ${r.a?.light ?? '-'} · ${r.a?.cnLight ?? '-'} | ${f2(r.a?.d1)} | ${f2(r.a?.v0)} | ${f2(r.a?.ts)} | ${f2(r.a?.ds)} | ${f2(r.b?.d1)} | ${f2(r.b?.v0)} | ${f2(r.b?.tb)} | ${f2(r.b?.extra)} |`);
console.log(`\n오류 ${errors.length}${errors.length ? '\n' + errors.join('\n') : ''}`);
await browser.close();

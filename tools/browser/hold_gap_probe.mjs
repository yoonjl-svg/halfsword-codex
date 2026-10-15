// 독일 간격 잡기 브라우저 확인 (10/15 — docs/strike/german_hold_2026-10-15.md): 실제 게임(테스트 경로, 롱소드 사람 대 이졸데 — AI 판단 끔·상처 끔)에서
//  키보드로 앞(W) 걸어 2 m 남짓에 선 뒤 콘솔처럼 game.player.gait.foeWhiff() 를 불러(상대 헛침) 0.2 s 뒤 앞(W)을 누른다.
//  상대 칼 충돌은 끈다(corr_s0 장면 a 와 같음) — 켜 두면 상대(이졸데) 겨눔 칼끝에 내 몸이 걸려 contact(1.57 m)까지 못 들어간다(첫 판: 잡기 0 · 1.98 m 에서 밀어도 1.82 m 에서 멈춤).
//  알아 둘 것: 사람 겨눔은 테스트 경로 기본(긴 자세 — 칼끝을 상대 쪽으로 뻗음)이라 내 칼끝이 1.6 m 쯤에서 상대 몸에 닿아 그보다 깊이는 잘 안 들어간다
//  A: 1.3 s 누름 — 잡기가 걸리고(가슴-가슴 거리 · 걸린 때) 시간(0.6 s)으로 풀리나 · B: 잡기가 걸리고 0.15 s 뒤 0.1 s 놓았다 다시 누름 — 스틱 놓음으로 바로 풀리나.
//  같은 차례를 `&deHold=0` 으로 한 번 더(잡기 없어야 함 — 빠른 디딤은 그대로). 물리 스텝마다 거리·잡기·빠른 걸음을 적고(combat.afterStep 을 감싸 읽기만) 콘솔·페이지 오류를 센다.
//  사진은 출력 폴더에만(저장소에 넣지 않음). 화면 왼쪽 위 글은 이 도구가 붙인 설명(게임 화면 글 아님).
//  실행: npx vite --port 5197 --strictPort (자기 포트·자기 캐시 폴더) & → node tools/browser/hold_gap_probe.mjs http://127.0.0.1:5197 <출력 폴더>
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:5197';
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
  await page.goto(`${base}/index.html?test=1&weapon=longsword&hero=player&foe=isolde&stage=castle&openSweep=0${extra}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword && document.getElementById('btnStart'), null, { timeout: 120000 });
  await page.evaluate(() => document.getElementById('btnStart').click());
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 120000 });
  await page.evaluate(() => {
    const g = window.game;
    const P = g.player;
    const E = g.enemy;
    const lab = document.createElement('div');
    lab.id = 'shotLabel';
    lab.style.cssText = 'position:fixed;left:8px;top:6px;z-index:99;font:600 15px sans-serif;color:#fff;background:rgba(0,0,0,.55);padding:3px 8px;border-radius:4px';
    document.body.appendChild(lab);
    document.getElementById('techCue').style.visibility = 'hidden';
    P.applyWound = () => {};
    E.applyWound = () => {};
    g.ai.update = () => E.move.set(0, 0); // 상대는 제자리 (AI 판단 끔)
    for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0); // 상대 칼 충돌 끔 (긴 자세 칼끝이 몸을 막지 않게)
    g._log = [];
    const c = g.combat;
    const o = c.afterStep.bind(c);
    c.afterStep = (...a) => {
      const res = o(...a);
      const G = P.gait;
      g._log.push([g.stats.simTime, P.foeDistance(), G.hold ? 1 : 0, G.holdEnd, G.fastK, P.move.y, P.stickY ?? 0, G.chase ? 1 : 0]);
      if (g._log.length > 20000) g._log.splice(0, 10000);
      return res;
    };
  });
  return page;
}
const sim = (page) => page.evaluate(() => window.game.stats.simTime);
const waitSim = (page, t) => page.waitForFunction((t) => window.game.stats.simTime >= t, t, { timeout: 180000 });
const dist = (page) => page.evaluate(() => window.game.player.foeDistance());
async function settle(page) {
  await page.waitForFunction(() => {
    const G = window.game.player.gait;
    return G.active && G.legs.F.stance && G.legs.B.stance && G.sinceTD > 0.6 && !G.walking;
  }, null, { timeout: 180000 });
}
// 앞(W)·뒤(S)로 걸어 가슴-가슴 거리를 [lo, hi] 안에 세움 (놓은 뒤 미끄러짐까지 보고 다시)
async function place(page, lo, hi) {
  for (let k = 0; k < 8; k++) {
    await settle(page);
    const d = await dist(page);
    if (d >= lo && d <= hi) return d;
    const key = d > hi ? 'KeyW' : 'KeyS';
    const target = d > hi ? hi + 0.5 : lo - 0.1;
    await page.keyboard.down(key);
    await page.waitForFunction(
      ([t, fwd]) => {
        const d = window.game.player.foeDistance();
        return fwd ? d <= t : d >= t;
      },
      [target, key === 'KeyW'],
      { timeout: 60000 },
    );
    await page.keyboard.up(key);
  }
  return dist(page);
}
async function run(page, mode, tag, label) {
  const d0 = await place(page, 1.95, 2.15);
  await settle(page);
  const t0 = await sim(page);
  const opened = await page.evaluate(() => {
    window.game.player.gait.foeWhiff(); // 콘솔에서 부르는 것과 같음 — 상대 헛침
    return !!window.game.player.gait.chase;
  });
  await waitSim(page, t0 + 0.2);
  const tPush = await sim(page);
  await page.keyboard.down('KeyW');
  let shot = null;
  if (mode === 'A') {
    // 잡기가 걸리면 0.25 s 뒤 한 장 (잡기 없으면 민 뒤 0.8 s)
    try {
      await page.waitForFunction(() => !!window.game.player.gait.hold, null, { timeout: 4000 });
    } catch {}
    const th = await sim(page);
    await waitSim(page, Math.min(th, tPush + 0.55) + 0.25);
    await page.evaluate((s) => (document.getElementById('shotLabel').textContent = s), label);
    shot = `${dir}/${tag}.png`;
    await page.screenshot({ path: shot });
    await waitSim(page, tPush + 1.3);
    await page.keyboard.up('KeyW');
  } else {
    let held = true;
    try {
      await page.waitForFunction(() => !!window.game.player.gait.hold, null, { timeout: 4000 });
    } catch {
      held = false;
    }
    const th = await sim(page);
    if (held) {
      await waitSim(page, th + 0.15);
      await page.keyboard.up('KeyW');
      await waitSim(page, th + 0.25);
      await page.keyboard.down('KeyW');
    }
    await waitSim(page, th + 0.65);
    await page.keyboard.up('KeyW');
  }
  await waitSim(page, (await sim(page)) + 0.3);
  const r = await page.evaluate(
    ([t0, tPush]) => {
      const L = window.game._log.filter((q) => q[0] >= t0);
      let on = null;
      let off = null;
      let prev = 0;
      let minHold = Infinity;
      let fast = 0;
      let fprev = 1;
      let rel = null;
      let sPrev = 0;
      for (const q of L) {
        if (q[2] && !prev) on = { t: q[0] - tPush, d: q[1] };
        if (!q[2] && prev) off = { t: q[0] - tPush, d: q[1], why: q[3] };
        if (q[2]) minHold = Math.min(minHold, q[1]);
        if (q[4] > 1 && fprev <= 1) fast++;
        if (on && !rel && sPrev > 0 && q[6] === 0) rel = q[0] - tPush;
        sPrev = q[6];
        fprev = q[4];
        prev = q[2];
      }
      const dEnd = L.length ? L[L.length - 1][1] : null;
      // 민 뒤 0.1 s 마다 거리 (H = 잡는 중 · F = 빠른 걸음 중 · 0 = 스틱 놓음)
      const line = [];
      for (let k = 0, i = 0; k <= 16; k++) {
        while (i < L.length - 1 && L[i][0] - tPush < k * 0.1 - 1e-6) i++;
        const q = L[i];
        if (q && q[0] - tPush >= k * 0.1 - 0.02) line.push(`${q[1].toFixed(2)}${q[2] ? 'H' : ''}${q[4] > 1 ? 'F' : ''}${q[6] === 0 ? '0' : ''}`);
      }
      return { on, off, minHold, fast, rel, dEnd, n: L.length, line: line.join(' ') };
    },
    [t0, tPush],
  );
  return { d0, opened, ...r, shot };
}

const out = [];
for (const [extra, nm] of [
  ['', '간격 잡기 켬(기본)'],
  ['&deHold=0', '`?deHold=0`'],
]) {
  const page = await open(extra);
  const tag = extra ? 'hold_off' : 'hold_on';
  const A = await run(page, 'A', `${tag}_A`, `${nm} · 헛침(콘솔 foeWhiff) → 0.2 s 뒤 앞(W) 누름`);
  const B = await run(page, 'B', `${tag}_B`, `${nm} · 잡기 중 0.1 s 놓았다 다시`);
  out.push({ nm, A, B });
  await page.context().close();
}
await browser.close();
const f2 = (v) => (v == null || !Number.isFinite(v) ? '-' : v.toFixed(2));
const why = (w) => ({ time: '시간', stick: '스틱 놓음', state: '상태' })[w] ?? w ?? '-';
console.log('| 판 | 차례 | 헛침 때 거리 m | 받을 창 | 잡기 걸림 (민 뒤 s · 거리 m) | 잡는 동안 가장 가까움 m | 풀림 (민 뒤 s · 까닭) | 빠른 걸음 묶음 | 놓은 때 (민 뒤 s) | 끝 거리 m |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const r of out)
  for (const [k, q] of [['A 1.3 s 누름', r.A], ['B 잡는 중 0.1 s 놓음', r.B]])
    console.log(`| ${r.nm} | ${k} | ${f2(q.d0)} | ${q.opened ? '열림' : '-'} | ${q.on ? `${f2(q.on.t)} · ${f2(q.on.d)}` : '-'} | ${f2(q.minHold)} | ${q.off ? `${f2(q.off.t)} · ${why(q.off.why)}` : '-'} | ${q.fast} | ${f2(q.rel)} | ${f2(q.dEnd)} |`);
console.log('\n민 뒤 0.1 s 마다 가슴-가슴 거리 m (H = 잡는 중 · F = 빠른 걸음 중 · 0 = 스틱 놓음)');
for (const r of out) for (const [k, q] of [['A', r.A], ['B', r.B]]) console.log(`- ${r.nm} ${k}: ${q.line}`);
console.log(`\n오류 ${errors.length}${errors.length ? '\n' + errors.join('\n') : ''}`);
for (const r of out) if (r.A.shot) console.log(`사진: ${r.A.shot}`);

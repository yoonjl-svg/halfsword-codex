// 이탈리아 박자 걸음 디딤 셈 브라우저 확인 (10/15 — docs/strike/italian_rhythm_2026-10-15.md §8): 테스트 경로 레이피어 플레이어가 상대 가슴 2.3 m 를 지키는 동안(짝걸음)
//  서 있다가 스틱 뒤 0.6 으로 4 s 물러날 때 앞뒤 디딤마다 빠른 디딤인지(gait.fastK > 1)를 차례로 적는다 — 주소 `?itRhythm=` 값마다(기본 2+2 · 4+2 · 3+2 · 0 · 3 = 옛 짝 셈 — 10/15 15:1x 기본 2+2 · ×1.3, 지난 판 갈래는 ×1.5).
//  주소에 openSweep=0(9/30 판 시작 — 정지 2 s): 무대 훑기(3.3 게임 초)면 아래 5 s 에 상대가 아직 다가오는 중일 수 있다
//  읽힌 셈(플레이어 걸음 값 gait.P.rhythm — 게임이 쓰는 칸)과 콘솔 오류를 본다. 상대(AI 판단 끔)는 거리만 지키고 둘 다 상처를 끈다.
//  실행: npx vite --port 5213 --strictPort (자기 포트·자기 캐시 폴더) & → node tools/browser/it_foot_probe.mjs http://127.0.0.1:5213
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:5213';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const out = [];
for (const q of ['', '&itRhythm=2%2B2', '&itRhythm=4%2B2', '&itRhythm=3%2B2', '&itRhythm=0', '&itRhythm=3']) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  await page.goto(`${base}/index.html?test=1&weapon=rapier&hero=player&foe=isolde&stage=castle&openSweep=0${q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword && document.getElementById('btnStart'), null, { timeout: 120000 });
  await page.evaluate(() => document.getElementById('btnStart').click());
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 120000 });
  const R = await page.evaluate(async () => {
    const g = window.game;
    const P = g.player;
    const E = g.enemy;
    P.applyWound = () => {};
    E.applyWound = () => {};
    g.ai.update = () => E.move.set(0, Math.max(-1, Math.min(1, 2 * (P.foeDistance() - 2.3)))); // 상대는 가슴 거리 2.3 m 를 지킴
    const mv = P.move;
    const set0 = mv.set.bind(mv);
    mv.set = (x, y) => (g._ovr ? set0(g._ovr.x, g._ovr.y) : set0(x, y)); // 스틱 덮기
    const G = P.gait;
    const b0 = G.begin.bind(G);
    g._feet = [];
    G.begin = (l, kind, T) => {
      b0(l, kind, T);
      if (g._count && (kind === 'walk' || (kind === 'catch' && G.walking))) g._feet.push(G.fastK > 1 ? (G.pairOn ? (G.pairStep === 'trail' ? 'f' : 'F') : 'F') : G.pairOn ? (G.pairStep === 'trail' ? 'n' : 'N') : 'N');
    };
    const r = G.P.rhythm; // 게임이 쓰는 칸(동적 import 는 다른 모듈 사본일 수 있어 걸음 값에서 읽음)
    return { count: r.count, normal: r.normal, fast: r.fast, every: r.every, mul: r.mul };
  });
  // 판 시작 정지 · 다가가서 2.3 m · 쉼(셈 처음부터) → 뒤 0.6 4 s
  await page.waitForFunction(() => window.game.stats.simTime > 5, null, { timeout: 180000 });
  const t0 = await page.evaluate(() => {
    window.game._count = true;
    window.game._ovr = { x: 0, y: -0.6 };
    return window.game.stats.simTime;
  });
  await page.waitForFunction((t) => window.game.stats.simTime > t + 4, t0, { timeout: 180000 });
  const feet = await page.evaluate(() => window.game._feet.join(''));
  out.push({ q: q || '(기본)', R, feet });
  await ctx.close();
}
await browser.close();
console.log('| 주소 | 읽힌 셈 | 디딤 차례 (N/n 보통 이끄는·따라붙는 발 · F/f 빠른 — 짝걸음이 아니면 N·F) |');
console.log('|---|---|---|');
for (const r of out) console.log(`| ${r.q} | ${r.R.count}${r.R.count === 'foot' ? ` ${r.R.normal} + ${r.R.fast} ×${r.R.mul}` : r.R.count === 'pair' ? ` ${r.R.every} + 1 ×${r.R.mul}` : ''} | ${r.feet} |`);
console.log(`콘솔·페이지 오류: ${errors.length}`);
for (const e of errors.slice(0, 10)) console.log('  ' + e);

// 대기실 캐릭터 미리보기 그리기 값 재기 (docs/import/lobby_fix_2026-10-16.md §5) — 고치기 전 배포판과 고친 배포판을 같은 잣대로
//  잣대: WebGL 그리기 호출(drawElements · drawArrays …)을 미리보기 캔버스(#characterView 안)에서만 센다 — 옛 판에도 시험용 값이 없어도 된다
//   · 첫 그림 = '처음부터'를 누른 때 → 미리보기 첫 그리기 호출까지 (게임·대기실 묶음 받기 포함 — 이 상자에선 흔들림이 크다) — 판마다 새 창, 같은 판 n 번의 가운데 값과 범위
//   · 미리보기 준비 = 미리보기 캔버스의 WebGL 문맥을 만든 때 → 첫 그리기 호출까지 (그리개 · 복제 · 셰이더 — 미리보기 몫만)
//   · 한 번 그리기 = 한 번 그리는 데 든 시간(gl.finish 까지 — 10/16 돌림판 판은 시험 고리로, 옛 판은 방향키로 바로 그림) · 그리는 화소 수(캔버스 너비 × 높이)
//   · 10/17 판(docs/import/lobby_preview_2026-10-17.md): 위 '한 번 그리기'는 장착을 바꿀 때(그림자 지도까지) · turnMs · callsPerTurn = 돌릴 때(카메라만 — lobbyPreview.turnTo) · samples = 계단 펴기 표본 수
//  node tools/browser/lobby_preview_cost.mjs <주소> [n=5] [화소 비=3]   (폰 가로 844×390 · 소프트웨어 GL — 실기기 값이 아니라 두 판의 비)
import { chromium } from 'playwright';
import { departTitle } from './to_lobby.mjs'; // 10/17: 첫 화면 → 곧바로 여정 (사장님 '첫화면에서 바로 전투로')
const base = process.argv[2] || 'http://127.0.0.1:5210', runs = +(process.argv[3] || 5), dpr = +(process.argv[4] || 3);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const counter = () => {
  const S = (window.__preview = { calls: 0, first: null, start: null, ctx: null, init: null });
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (...a) { if (S.start != null && S.ctx == null && /webgl/.test(a[0])) S.ctx = performance.now(); return gc.apply(this, a); };
  for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) for (const m of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) {
    const f = C.prototype[m]; if (!f) continue;
    C.prototype[m] = function (...a) { if (this.canvas?.parentElement?.id === 'characterView') { S.calls++; if (S.first == null && S.start != null) { const now = performance.now(); S.first = now - S.start; S.init = now - S.ctx; } } return f.apply(this, a); };
  }
};
const rows = [];
try {
  for (let i = 0; i < runs; i++) {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    await ctx.route('https://*.supabase.co/**', (r) => r.abort());
    await ctx.addInitScript(counter);
    const p = await ctx.newPage();
    await p.goto(base + '/', { waitUntil: 'networkidle' });
    await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
    if (await p.locator('#noticeDialog').evaluate((d) => d.open)) await p.locator('#confirmNotices').click();
    await p.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 20000 });
    await departTitle(p); // 10/17: 첫 화면 → 곧바로 여정 — 대기실은 정지 → '대기실'에서 연다 (준비 시간은 '대기실'을 누른 때부터)
    await p.evaluate(() => document.getElementById('btnPause').click());
    await p.waitForFunction(() => window.game.state === 'paused' && !document.getElementById('btnLobby').hidden, null, { timeout: 30000 });
    await p.evaluate(() => { window.__preview.start = performance.now(); });
    await p.locator('#btnLobby').click();
    await p.waitForFunction(() => window.__preview.first != null, null, { timeout: 30000 });
    await p.waitForTimeout(300);
    const one = await p.evaluate(() => {
      const view = document.querySelector('#gameEntrance').shadowRoot.getElementById('characterView'), c = view.querySelector('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      const calls0 = window.__preview.calls, times = [];
      // 한 번 그리기: 10/16 돌림판부터 방향키는 화면 한 장씩 부드럽게 돌아(바로 그리지 않음) — 그 판은 시험 고리(lobbyPreview.setArmor 가 바로 한 번 그림)로, 옛 판은 방향키로
      //  10/17 판부터 setArmor 는 그림자 지도도 다시 그린다(장착을 바꿀 때 값) — 돌릴 때 값은 아래 turnTo 로 따로
      const once = view.lobbyPreview?.setArmor ? () => view.lobbyPreview.setArmor(view.dataset.armor || null) : () => view.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      for (let k = 0; k < 12; k++) { const t0 = performance.now(); once(); gl.finish(); times.push(performance.now() - t0); }
      times.sort((a, b) => a - b);
      // 돌릴 때 한 번 그리기 (10/17 — lobbyPreview.turnTo 가 있는 판만: 카메라만 돌고 그림자 지도는 그대로)
      let turnCalls = null, turnMs = null;
      if (view.lobbyPreview?.turnTo) {
        const c1 = window.__preview.calls, tt = [];
        for (let k = 0; k < 12; k++) { const t0 = performance.now(); view.lobbyPreview.turnTo(k * 30); gl.finish(); tt.push(performance.now() - t0); }
        tt.sort((a, b) => a - b); turnCalls = (window.__preview.calls - c1) / 12; turnMs = tt[6];
      }
      return { first: window.__preview.first, init: window.__preview.init, callsPerRender: (window.__preview.calls - calls0) / 12, renderMs: times[6], turnCalls, turnMs, css: [c.clientWidth, c.clientHeight], buffer: [c.width, c.height], aa: gl.getContextAttributes().antialias, samples: gl.getParameter(gl.SAMPLES) };
    });
    rows.push(one);
    await ctx.close();
  }
} finally { await browser.close(); }
const firsts = rows.map((r) => r.first).sort((a, b) => a - b), renders = rows.map((r) => r.renderMs).sort((a, b) => a - b), inits = rows.map((r) => r.init).sort((a, b) => a - b), r0 = rows[0];
const turns = rows[0].turnMs == null ? null : rows.map((r) => r.turnMs).sort((a, b) => a - b);
console.log(JSON.stringify({ base, dpr, runs, callsPerRender: r0.callsPerRender, callsPerTurn: r0.turnCalls, cssPx: r0.css, bufferPx: r0.buffer, pixels: r0.buffer[0] * r0.buffer[1], antialias: r0.aa, samples: r0.samples,
  turnMs: turns && { median: +turns[runs >> 1].toFixed(2), min: +turns[0].toFixed(2), max: +turns.at(-1).toFixed(2) },
  firstFrameMs: { median: +firsts[runs >> 1].toFixed(1), min: +firsts[0].toFixed(1), max: +firsts.at(-1).toFixed(1) }, previewInitMs: { median: +inits[runs >> 1].toFixed(1), min: +inits[0].toFixed(1), max: +inits.at(-1).toFixed(1) }, renderMs: { median: +renders[runs >> 1].toFixed(2), min: +renders[0].toFixed(2), max: +renders.at(-1).toFixed(2) } }));

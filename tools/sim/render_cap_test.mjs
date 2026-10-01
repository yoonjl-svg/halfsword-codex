// 화면 갱신 상한 시험 (src/render_cap.js, CONFIG.RENDER.fpsCap): 가짜 rAF 간격으로 초당 그린 프레임을 잰다.
//  120·90·144·75·100·240 Hz → 60 (120 Hz 근처 119.88·120.1 은 간격까지 고르게), 60 Hz(59.94·60.05·흔들림) → 한 프레임도 안 빠짐,
//  24~45 fps → 매 프레임, 끄면 매 프레임, 멈췄다 돌아와도 몰아 그리지 않음.
//  실행: node tools/sim/render_cap_test.mjs   (실패하면 exit 1)
import { createRenderCap } from '../../src/render_cap.js';
import { RENDER } from '../../src/config.js';

let s = 12345;
const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
const CAP = RENDER.fpsCap;
const SEC = 20; // 가짜 시간(초)
const WARM = 1; // 첫 1초(화면 간격 재는 중)는 빼고 센다

function run(name, next, { fps = CAP, expect, even = false }) {
  const cap = createRenderCap();
  let t = 0, frames = 0, paints = 0, drops = 0, maxGap = 0, minGap = Infinity, lastPaint = null;
  while (t < SEC) {
    const dt = next(t);
    t += dt;
    const p = cap.tick(Math.min(0.1, dt), fps);
    if (t < WARM) continue;
    frames++;
    if (p) {
      paints++;
      if (lastPaint != null) {
        maxGap = Math.max(maxGap, t - lastPaint);
        minGap = Math.min(minGap, t - lastPaint);
      }
      lastPaint = t;
    } else {
      drops++;
    }
  }
  const span = t - WARM;
  const r = { name, fps: +(frames / span).toFixed(1), paintFps: +(paints / span).toFixed(2), drops };
  // 'all' = 한 프레임도 거르지 않음, 'noBurst' = 멈춤 뒤에도 몰아 그리지 않음(120 Hz 에서 그림 간격 늘 두 프레임 이상), 숫자 = 초당 그림
  //  even = 그림 간격이 늘 상한 간격(16.7 ms)의 0.75~1.25배: 120 Hz 근처에서 8 ms·25 ms 간격이 끼지 않는다
  let ok = expect === 'all' ? drops === 0 : expect === 'noBurst' ? minGap > 1.9 / 120 : Math.abs(r.paintFps - expect) < 0.2 && r.paintFps <= expect + 0.1;
  if (even) ok &&= minGap > 0.75 / CAP && maxGap < 1.25 / CAP;
  const ms = (x) => (x * 1000).toFixed(1);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(34)} rAF ${String(r.fps).padStart(6)}/s  그림 ${String(r.paintFps).padStart(6)}/s  거름 ${String(drops).padStart(5)}  그림 간격 ${ms(minGap)}~${ms(maxGap)}ms`);
  return ok;
}

const hz = (h) => () => 1 / h;
// 흔들림은 시각(rAF 타임스탬프)에 붙인다: 간격 = 1/h + (이번 흔들림 − 지난 흔들림) — 실제 rAF 처럼 쌓이지 않는다
const jit = (h, ms) => {
  let prev = 0;
  return () => {
    const e = ((rnd() - 0.5) * 2 * ms) / 1000;
    const dt = 1 / h + e - prev;
    prev = e;
    return dt;
  };
};
let pass = true;
pass &= run('120 Hz', hz(120), { expect: CAP, even: true });
pass &= run('120 Hz ±0.5ms 흔들림', jit(120, 0.5), { expect: CAP, even: true });
pass &= run('119.88 Hz ±0.1ms', jit(119.88, 0.1), { expect: CAP, even: true });
pass &= run('120.1 Hz ±0.1ms', jit(120.1, 0.1), { expect: CAP, even: true });
pass &= run('240 Hz', hz(240), { expect: CAP, even: true });
pass &= run('120 Hz, 가끔 한 프레임 밀림(16.7ms)', () => (rnd() < 0.05 ? 2 / 120 : 1 / 120), { expect: CAP });
pass &= run('90 Hz', hz(90), { expect: CAP });
pass &= run('90 Hz ±0.5ms', jit(90, 0.5), { expect: CAP });
pass &= run('144 Hz', hz(144), { expect: CAP });
pass &= run('100 Hz', hz(100), { expect: CAP });
pass &= run('75 Hz', hz(75), { expect: CAP });
pass &= run('60 Hz', hz(60), { expect: 'all' });
pass &= run('59.94 Hz', hz(59.94), { expect: 'all' });
pass &= run('60.05 Hz', hz(60.05), { expect: 'all' });
pass &= run('60.5 Hz', hz(60.5), { expect: 'all' });
pass &= run('60 Hz ±1ms 흔들림', jit(60, 1), { expect: 'all' });
pass &= run('60 Hz ±3ms 흔들림', jit(60, 3), { expect: 'all' });
pass &= run('24~45 fps 흔들림', () => 1 / (24 + rnd() * 21), { expect: 'all' });
pass &= run('30 fps', hz(30), { expect: 'all' });
pass &= run('120 Hz, 상한 끔(설정 끔)', hz(120), { fps: 0, expect: 'all' });
// 120 Hz 화면에서 게임이 무거워 40~55 fps 로 떨어지면: 매 프레임 그린다
pass &= run('120 Hz 화면, 무거워서 40~55 fps', () => Math.ceil((1 / (40 + rnd() * 15)) * 120) / 120, { expect: 'all' });
// 멈췄다(탭 숨김 0.1 s 잘림) 돌아와도 몰아 그리지 않는다: 120 Hz 에서 3초마다 멈춤
pass &= run('120 Hz, 3초마다 긴 멈춤', (t) => (t % 3 < 1 / 120 ? 0.5 : 1 / 120), { expect: 'noBurst' });
console.log(pass ? '모두 통과' : '실패 있음');
process.exit(pass ? 0 : 1);

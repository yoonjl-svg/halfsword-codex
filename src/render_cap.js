// ─────────────────────────────────────────────────────────────
//  화면 갱신 상한 (CONFIG.RENDER.fpsCap). 사장님 9/30 "해상도는 그대로 유지하고 fps는 묶어." — 발열.
//   90/120 Hz 화면에서 그리기만 거른다. 물리 스텝·입력·소리는 main.js 가 rAF 마다 예전 그대로 돈다.
//   tick() 은 rAF 마다 한 번: 이번 프레임을 그릴지(true) 돌려준다.
//   · 화면 간격 disp 는 프레임 간격의 지수 평균. 상한 간격의 0.9배보다 짧을 때만(60 상한 → 66 Hz 넘는 화면) 거른다.
//     60 Hz 화면(59.9~60.5 Hz 흔들림 포함)·느린 폰(24~45 fps)은 매 프레임 그린다 → 상한은 아무 일도 안 한다
//   · 딱 나눠지는 화면(120·180·240 Hz)은 화면 프레임을 세어 n 번째마다 그린다. 119.88·120.1 Hz 처럼 조금 어긋난 화면에서
//     시간 몫으로 정확히 60 을 맞추려 하면 몇 초마다 8 ms·25 ms 간격이 끼어 떨린다 → 그 대신 59.94·60.05 로 고르게
//   · 나머지(90·144·100·75 Hz)는 그리기 몫 acc 를 쌓아 1/fpsCap 마다 한 번 (몫을 빼서 넘기므로 밀림 없이 평균 정확히 fpsCap).
//     몫이 조금 모자라도(화면 간격의 1/4 까지) 그린다 → 간격 흔들림 때문에 한 프레임씩 빠지지 않게
//  DOM·three 없이 숫자만 — tools/sim/render_cap_test.mjs 가 가짜 프레임 간격으로 시험한다
// ─────────────────────────────────────────────────────────────

const EMA = 0.1; // 화면 간격 평균 갱신 비율 (120 Hz 화면이면 3~4 프레임 만에 거르기 시작)
const FAST = 0.9; // 화면 간격 < 상한 간격 × 이 값일 때만 거른다
const SLACK = 0.25; // 몫이 화면 간격의 이만큼 모자라도 그린다
const SNAP = 0.03; // 상한 간격 ÷ 화면 간격이 정수 n(≥2)에서 이만큼 안이면 n 프레임마다 (120 Hz 기준 118.2~121.8 Hz)

export function createRenderCap() {
  let disp = 1 / 60; // 잰 화면 간격(초). 재기 전엔 60 Hz 로 본다 (처음엔 거르지 않는다)
  let acc = 0; // 그리기 몫(초) — 지난 그림 뒤로 흐른 시간에서 넘겨받은 몫
  let cnt = 0; // 지난 그림 뒤로 지난 화면 프레임 수 (밀린 프레임은 그만큼 센다)
  return {
    /** 잰 화면 간격(초) */
    get interval() {
      return disp;
    },
    /** frameSec: 이번 rAF 간격(초, main.js dt 와 같이 0.1 로 자른 값). fps: 상한 (0 이하면 묶지 않음). 그리면 true */
    tick(frameSec, fps) {
      const f = Math.max(0, frameSec);
      disp += (Math.min(0.05, Math.max(0.002, f)) - disp) * EMA; // 멈췄다 돌아온 긴 간격 하나에 크게 흔들리지 않게 잘라서
      const I = fps > 0 ? 1 / fps : 0;
      if (disp >= I * FAST) {
        acc = cnt = 0;
        return true;
      }
      acc += f;
      cnt += Math.max(1, Math.round(f / disp));
      const q = I / disp; // 화면 몇 프레임에 한 번 그리나 (120 Hz → 2, 90 Hz → 1.5)
      const n = Math.round(q);
      if (n >= 2 && Math.abs(q - n) < SNAP) {
        if (cnt < n) return false;
        acc = cnt = 0; // 밀린 프레임 뒤엔 거기서부터 다시 센다 (몰아 그리지 않는다)
        return true;
      }
      if (acc < I - SLACK * disp) return false;
      acc -= I;
      if (acc > I) acc = 0; // 오래 멈췄다 돌아온 뒤 몰아 그리지 않게
      cnt = 0;
      return true;
    },
  };
}

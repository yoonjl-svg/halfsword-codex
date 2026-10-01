// 성능 측정 표시 (?fps=1). 사장님 폰에서 실제 부하를 재기 위한 것 — 평소에는 아무 일도 하지 않는다.
//  보여 주는 것:
//   초당 프레임(평균 · 느린 5%) · 한 프레임 시간 · 초당 그린 프레임(화면 갱신 상한 CONFIG.RENDER.fpsCap — 120 Hz 폰이면 FPS 120, 그림 60)
//   물리(한 프레임 동안 물리 계산에 쓴 시간, 스텝 수) · 그리기(그린 프레임 하나의 렌더 호출 시간)
//   게임 속도: 실제로 흐른 게임 시간 ÷ 흘러야 할 게임 시간. 100% 아래면 폰이 못 따라가서 슬로 모션이 된 것
//   그리기 호출 수 · 삼각형 수 · 화면 해상도 · 자바스크립트 메모리(크롬만)
//   extra() 가 주는 한 줄 (main.js: 지금 배경과 그 배경을 짓는 데 걸린 시간 — 배경이 판마다 바뀌어 어느 배경의 수치인지 적는다)

const WINDOW = 120; // 느린 5%를 셀 최근 프레임 수

export class PerfMeter {
  constructor(renderer, extra = null) {
    this.renderer = renderer;
    this.extra = extra;
    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position: 'fixed',
      left: 'max(6px, env(safe-area-inset-left))',
      top: 'max(6px, env(safe-area-inset-top))',
      zIndex: 5,
      pointerEvents: 'none',
      font: '11px/1.35 ui-monospace, Menlo, Consolas, monospace',
      color: '#e8f0e0',
      background: 'rgba(0,0,0,.55)',
      padding: '4px 6px',
      borderRadius: '4px',
      whiteSpace: 'pre',
    });
    document.body.appendChild(this.el);
    this.frames = new Float32Array(WINDOW);
    this.fi = 0;
    this.fn = 0;
    this.reset(performance.now());
  }

  reset(now) {
    this.t0 = now;
    this.n = 0;
    this.sumFrame = 0;
    this.physMs = 0;
    this.renderMs = 0;
    this.painted = 0; // 실제로 그린 프레임 수 (화면 갱신 상한으로 거른 프레임 빼고)
    this.steps = 0;
    this.capped = 0;
    this.want = 0; // 흘러야 할 게임 시간(초)
    this.got = 0; // 실제로 흐른 게임 시간(초)
  }

  /** 한 프레임 끝에 부른다. frameMs = 앞 프레임과의 간격, want/got = 이번 프레임의 게임 시간, painted = 이번 프레임을 그렸나 */
  frame(now, frameMs, physMs, renderMs, steps, capped, want, got, painted = true) {
    this.frames[this.fi] = frameMs;
    this.fi = (this.fi + 1) % WINDOW;
    this.fn = Math.min(WINDOW, this.fn + 1);
    this.n++;
    this.sumFrame += frameMs;
    this.physMs += physMs;
    this.renderMs += renderMs;
    if (painted) this.painted++;
    this.steps += steps;
    if (capped) this.capped++;
    this.want += want;
    this.got += got;
    if (now - this.t0 >= 500) this.show(now);
  }

  show(now) {
    const n = Math.max(1, this.n);
    const avg = this.sumFrame / n;
    const sorted = Array.from(this.frames.subarray(0, this.fn)).sort((a, b) => b - a);
    const slow = sorted[Math.floor(this.fn * 0.05)] || avg; // 느린 쪽 5% 경계
    const info = this.renderer.info.render;
    const speed = this.want > 1e-6 ? (100 * this.got) / this.want : 100;
    const mem = performance.memory ? `${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)}MB` : '-';
    const c = this.renderer.domElement;
    const paintFps = (1000 * this.painted) / Math.max(1, this.sumFrame); // FPS 와 같은 기준(프레임 간격의 합)
    this.el.textContent =
      `FPS ${(1000 / avg).toFixed(0)} (느린5% ${(1000 / slow).toFixed(0)})  ${avg.toFixed(1)}ms  그림 ${paintFps.toFixed(0)}fps\n` +
      `물리 ${(this.physMs / n).toFixed(1)}ms ×${(this.steps / n).toFixed(1)}스텝  그리기 ${(this.renderMs / Math.max(1, this.painted)).toFixed(1)}ms\n` +
      `게임 속도 ${speed.toFixed(0)}%${this.capped ? `  밀림 ${this.capped}` : ''}\n` +
      `호출 ${info.calls}  삼각형 ${(info.triangles / 1000).toFixed(0)}k  ${c.width}×${c.height}  메모리 ${mem}` +
      (this.extra ? `\n${this.extra()}` : '');
    this.reset(now);
  }
}

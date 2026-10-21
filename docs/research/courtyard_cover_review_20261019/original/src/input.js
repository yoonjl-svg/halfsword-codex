// ─────────────────────────────────────────────────────────────
//  입력 처리
//   - 스마트폰: 화면을 손가락으로 끌면 손(칼자루)이 그만큼 움직인다(상대 이동). 짧게 톡 치면 찌른다(탭 = 찌르기).
//              왼쪽 아래 조이스틱으로 걷는다 (기울여서 걷기는 10/10 사장님 '어차피 안 씀'으로 기능째 지웠다).
//   - PC: 화면 클릭 → 마우스 잠금. 마우스를 움직이면 칼, 끌지 않고 클릭하면 찌르기, WASD(방향키)로 이동.
// ─────────────────────────────────────────────────────────────
import { INPUT } from './config.js';
import { flushHaptic } from './effects.js';
import { configureMobileIntent, mapMobileHandDelta } from './mobile_intent.js'; // 10/7 폰 세로 1.35 배 (사장님 선택, 샛별 일반판 그대로)

export class Input {
  constructor(canvas, params = typeof window !== 'undefined' && window.location ? new URLSearchParams(window.location.search) : new URLSearchParams()) {
    this.canvas = canvas;
    this.mobileIntent = configureMobileIntent(params); // 폰 touch 세로 배율 (기본 1.35, ?mobileVerticalGain=1 이 옛 매핑; 시뮬 도구는 1 을 넘겨 기준선을 지킨다)
    this.handDX = 0; // 누적된 손 이동량(m). +x = 화면 오른쪽
    this.handDY = 0; // +y = 위
    this.keys = new Set();
    this.stickMove = { x: 0, y: 0 }; // 화면 조이스틱 (터치 이동)
    this.enabled = false;
    this.activeTouch = null;
    this.lastX = 0;
    this.lastY = 0;
    this.isTouchDevice = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.trail = null; // 조작 흔적 (main.js가 넣어 준다)
    // 탭 = 찌르기: 칼 쪽 화면을 짧게 톡 친 횟수 (main.js 가 consumeTaps 로 가져간다)
    //  press = 지금 누르고 있는 손가락(마우스) { id, t(누른 시각 ms), x, y, moved(움직인 거리 px), mouse, ok }
    this.taps = 0;
    this.press = null;
    this.tapOnDown = false; // 권총(main.js 가 켠다): 손가락이 닿는(클릭하는) 순간 한 번 친 것으로 센다 — 떼는 때·누른 시간과 상관없이

    this._resetHooks = new Set(); // 조이스틱처럼 자체 포인터 상태를 가진 입력 장치가 등록한다 (resetTransient 때 함께 초기화)

    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    // 10/8 입력 수명주기(사장님 승인, 샛별 일반판과 같은 자리): 취소·캡처 상실·창 이탈이면 들고 있던 손가락 상태를 한 번에 버린다 —
    //  안 버리면 다음 손가락이 지난 손가락의 이동량·누름을 물려받아 첫 획이 튄다. 입력이 꺼진 동안의 키도 무시한다
    window.addEventListener('pointercancel', (e) => this.onCancel(e));
    canvas.addEventListener('lostpointercapture', (e) => this.onCancel(e));
    window.addEventListener('keydown', (e) => this.keys.add(e.code)); // 물리적으로 누른 키는 늘 기록 — 읽는 쪽(move)이 enabled 로 거른다
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.resetTransient(); this.keys.clear(); }); // 창을 떠나면 keyup 이 안 오므로 키도 지운다
  }

  /** 칼 손가락의 손짓만 버린다 (취소·캡처 상실: 조이스틱 엄지와 누르고 있는 키는 그대로 — 10/8 검토 5) */
  resetHand() {
    this.handDX = 0;
    this.handDY = 0;
    this.taps = 0;
    this.press = null;
    this.activeTouch = null;
    this.lastX = 0;
    this.lastY = 0;
    if (this.trail?.clear) this.trail.clear();
    else this.trail?.lift?.();
  }

  /** 끝났거나 끊긴 손짓을 전부 버린다(판 경계·일시정지·계속) — 감도·기울기 기준 같은 저장 설정과 물리적으로 누르고 있는 키(keys)는 그대로(키는 keyup·blur 가 지운다, 10/8 검토 6) */
  resetTransient() {
    this.resetHand();
    this.stickMove = { x: 0, y: 0 };
    for (const reset of this._resetHooks) reset();
  }

  onCancel(e) {
    if (e.pointerId === this.activeTouch || e.pointerId === this.press?.id) this.resetHand();
  }

  onDown(e) {
    if (!this.enabled) return;
    // 마우스 잠금을 거는 첫 클릭은 찌르기로 치지 않는다 (잠금을 못 거는 브라우저는 클릭 그대로)
    const lockedBefore = document.pointerLockElement === this.canvas || !this.canvas.requestPointerLock;
    if (e.pointerType === 'mouse') {
      // PC: 마우스를 화면에 잠가서 하프 소드처럼 마우스 움직임 = 칼 움직임
      if (document.pointerLockElement !== this.canvas && this.canvas.requestPointerLock) {
        try {
          const p = this.canvas.requestPointerLock();
          if (p && p.catch) p.catch(() => {});
        } catch {
          /* 지원 안 하면 드래그 방식으로 동작 */
        }
      }
    }
    if (this.tapOnDown && (e.pointerType !== 'mouse' || (lockedBefore && e.button === 0))) this.taps++; // 권총: 두 번째 손가락으로 쳐도 쏜다
    if (this.activeTouch !== null) return; // 칼은 손가락 하나로만
    this.activeTouch = e.pointerId;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    const mouse = e.pointerType === 'mouse';
    // 시간은 이벤트가 생긴 시각(e.timeStamp)으로 잰다: 한 프레임이 길면 핸들러가 늦게 돌아 누른 시간이 부풀려진다
    // 마우스는 왼쪽(주) 버튼 클릭만 찌르기 (오른쪽·가운데 버튼은 아니다)
    this.press = { id: e.pointerId, t: e.timeStamp || performance.now(), x: e.clientX, y: e.clientY, moved: 0, mouse, ok: !this.tapOnDown && (!mouse || (lockedBefore && e.button === 0)) }; // 권총은 이미 셌다
    if (!mouse) this.trail?.addTouch(e.clientX, e.clientY, performance.now() / 1000);
  }

  onMove(e) {
    if (!this.enabled) return;
    if (e.pointerType === 'mouse' && document.pointerLockElement === this.canvas) {
      // 일부 브라우저는 잠금 직후 엉뚱하게 큰 값을 한 번 보낸다 → 무시
      if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
      this.handDX += e.movementX * INPUT.mouseSensitivity;
      this.handDY -= e.movementY * INPUT.mouseSensitivity;
      if (this.press?.mouse) this.press.moved += Math.hypot(e.movementX, e.movementY);
      return;
    }
    if (e.pointerId !== this.activeTouch) return;
    if (this.press?.id === e.pointerId) this.press.moved = Math.max(this.press.moved, Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y));
    const delta = mapMobileHandDelta({ dx: e.clientX - this.lastX, dy: e.clientY - this.lastY, height: window.innerHeight, sensitivity: INPUT.touchSensitivity, pointerType: e.pointerType, verticalGain: this.mobileIntent.verticalGain });
    this.handDX += delta.x;
    this.handDY += delta.y;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.trail?.addTouch(e.clientX, e.clientY, performance.now() / 1000);
  }

  onUp(e) {
    const p = this.press;
    if (p && e.pointerId === p.id) {
      // 짧게 톡 쳤다(끌지도, 누르고 있지도 않았다) → 찌르기
      const dur = (e.timeStamp || performance.now()) - p.t;
      const tap = p.mouse ? dur < INPUT.clickMs && p.moved < INPUT.clickPx : dur < INPUT.tapMs && p.moved < INPUT.tapPx;
      if (tap && p.ok && e.type === 'pointerup' && this.enabled) this.taps++;
      this.press = null;
    }
    if (e.pointerId === this.activeTouch) {
      this.activeTouch = null;
      this.trail?.lift();
    }
    flushHaptic(); // 아이폰: 손가락을 떼는 순간에만 진동이 허락된다
  }

  /** 지난번 이후 톡 친 횟수 (찌르기) */
  consumeTaps() {
    const n = this.taps;
    this.taps = 0;
    return n;
  }

  consumeHandDelta() {
    const d = { x: this.handDX, y: this.handDY };
    this.handDX = 0;
    this.handDY = 0;
    return d;
  }

  /** { x: 옆걸음 -1(왼)~1(오른), y: -1(뒤)~1(앞) } */
  get move() {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    x += this.stickMove.x;
    y += this.stickMove.y;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }
}

/**
 * 화면 왼쪽 아래 가상 조이스틱 (터치 화면에서 싸우는 동안 보인다)
 * @param {HTMLElement} pad  바깥 원
 * @param {HTMLElement} knob 안쪽 손잡이
 */
export function attachStick(input, pad, knob) {
  let id = null;
  const R = 40;
  const DEAD = 0.15; // 가운데 근처 살짝 건드린 건 무시
  const reset = () => {
    const captured = id;
    id = null;
    knob.style.transform = '';
    input.stickMove = { x: 0, y: 0 };
    if (captured !== null && pad.releasePointerCapture) {
      try {
        if (!pad.hasPointerCapture || pad.hasPointerCapture(captured)) pad.releasePointerCapture(captured);
      } catch { /* 이미 취소·해제된 포인터는 다시 해제할 필요가 없다 */ }
    }
  };
  input._resetHooks.add(reset);
  const update = (e) => {
    if (!input.enabled) { reset(); return; }
    const r = pad.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > R) {
      dx = (dx / len) * R;
      dy = (dy / len) * R;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    let x = dx / R;
    let y = -dy / R;
    const m = Math.hypot(x, y);
    const k = m < DEAD ? 0 : (m - DEAD) / (1 - DEAD) / m;
    input.stickMove = { x: x * k, y: y * k };
  };
  pad.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (!input.enabled || id !== null) return;
    id = e.pointerId;
    try { pad.setPointerCapture(id); } catch { /* 캡처 미지원 환경에서도 패드 안 조작은 유지한다 */ }
    update(e);
  });
  pad.addEventListener('pointermove', (e) => e.pointerId === id && update(e));
  const end = (e) => {
    if (e.pointerId !== id) return;
    reset();
  };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
  pad.addEventListener('lostpointercapture', end);
}

// ─────────────────────────────────────────────────────────────
//  입력 처리
//   - 스마트폰: 화면을 손가락으로 끌면 손(칼자루)이 그만큼 움직인다(상대 이동). 짧게 톡 치면 찌른다(탭 = 찌르기).
//              폰을 앞뒤로 기울이면 전진/후퇴, 좌우로 기울이면 옆걸음.
//   - PC: 화면 클릭 → 마우스 잠금. 마우스를 움직이면 칼, 끌지 않고 클릭하면 찌르기, WASD(방향키)로 이동.
// ─────────────────────────────────────────────────────────────
import { INPUT } from './config.js';
import { flushHaptic } from './effects.js';
import { configureMobileIntent, mapMobileHandDelta } from './mobile_intent.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mobileIntent = configureMobileIntent(new URLSearchParams(window.location.search));
    this.handDX = 0; // 누적된 손 이동량(m). +x = 화면 오른쪽
    this.handDY = 0; // +y = 위
    this.keys = new Set();
    this.stickMove = { x: 0, y: 0 }; // 화면 조이스틱(센서가 없을 때 대체용)
    this.tiltMove = { x: 0, y: 0 };
    this.tiltActive = false;
    this.useTilt = false; // 설정에서 '기울기' 이동을 골랐을 때만 true
    this.tiltBaseline = null; // { roll, pitch }
    this.tiltRaw = { roll: 0, pitch: 0 };
    this.invertTilt = false;
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

    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
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
    const delta = mapMobileHandDelta({ dx: e.clientX - this.lastX, dy: e.clientY - this.lastY,
      height: window.innerHeight, sensitivity: INPUT.touchSensitivity,
      pointerType: e.pointerType, verticalGain: this.mobileIntent.verticalGain });
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
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    x += this.stickMove.x;
    y += this.stickMove.y;
    if (this.useTilt && this.tiltActive) {
      x += this.tiltMove.x;
      y += this.tiltMove.y;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  // ── 기울기(틸트) ──
  // 반드시 사용자가 버튼을 누른 순간에 호출해야 한다(아이폰 권한 요청 규칙).
  async enableTilt() {
    if (typeof DeviceMotionEvent === 'undefined') return false;
    try {
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        const res = await DeviceMotionEvent.requestPermission();
        if (res !== 'granted') return false;
      }
    } catch {
      return false;
    }
    // 아이폰은 중력 값 부호가 안드로이드와 반대다.
    const iOS = typeof DeviceMotionEvent.requestPermission === 'function' || /iP(hone|ad|od)/.test(navigator.userAgent);
    const sign = iOS ? -1 : 1;
    if (!this._motionHandler) {
      this._motionHandler = (e) => {
        const g = e.accelerationIncludingGravity;
        if (!g || g.x === null) return;
        const a = (((screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0) * Math.PI) / 180;
        // 기기 좌표 → 화면 좌표로 회전
        const sx = g.x * Math.cos(a) - g.y * Math.sin(a);
        const sy = g.x * Math.sin(a) + g.y * Math.cos(a);
        const sz = g.z;
        // roll: 운전대처럼 좌우로 돌린 각도 / pitch: 화면 윗부분을 앞으로 넘긴 각도
        const roll = (Math.atan2(sign * sx, sign * sy) * 180) / Math.PI;
        const pitch = (Math.atan2(sign * sz, sign * sy) * 180) / Math.PI;
        this.tiltRaw = { roll, pitch };
        if (this.tiltBaseline === null) this.tiltBaseline = { roll, pitch };
        this.tiltActive = true;
        const axis = (v) => {
          let d = v;
          if (d > 180) d -= 360;
          if (d < -180) d += 360;
          const mag = Math.max(0, Math.abs(d) - INPUT.tiltDeadDeg) / (INPUT.tiltFullDeg - INPUT.tiltDeadDeg);
          return Math.sign(d) * Math.min(1, mag);
        };
        const inv = this.invertTilt ? -1 : 1;
        this.tiltMove = {
          x: inv * axis(roll - this.tiltBaseline.roll),
          y: inv * axis(pitch - this.tiltBaseline.pitch),
        };
      };
      window.addEventListener('devicemotion', this._motionHandler);
    }
    return true;
  }

  /** 지금 폰 각도를 "똑바로"로 삼는다 */
  calibrateTilt() {
    this.tiltBaseline = this.tiltActive ? { ...this.tiltRaw } : null;
    this.tiltMove = { x: 0, y: 0 };
  }
}

/**
 * 화면 왼쪽 아래 가상 조이스틱 (기울기 센서가 없을 때만 보인다)
 * @param {HTMLElement} pad  바깥 원
 * @param {HTMLElement} knob 안쪽 손잡이
 */
export function attachStick(input, pad, knob) {
  let id = null;
  const R = 40;
  const DEAD = 0.15; // 가운데 근처 살짝 건드린 건 무시
  const update = (e) => {
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
    id = e.pointerId;
    pad.setPointerCapture(id);
    update(e);
  });
  pad.addEventListener('pointermove', (e) => e.pointerId === id && update(e));
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    knob.style.transform = '';
    input.stickMove = { x: 0, y: 0 };
  };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
}

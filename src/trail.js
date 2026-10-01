// ─────────────────────────────────────────────────────────────
//  조작 흔적: 방금 칼을 어떻게 움직였는지 화면에 반투명한 선으로 잠깐 남긴다.
//   - 손가락(터치): 손가락이 지나간 자리에 선. 빠르게 그을수록 굵고 밝다 → 조작의 세기와 방향이 보인다.
//   - 마우스(화면 잠금): 오른쪽 아래 작은 원판 위에 "손 위치(패드)"가 움직인 길을 그린다.
//  선은 0.7초 동안 서서히 사라진다. 게임 판정에는 아무 영향이 없다 (보여 주기만).
// ─────────────────────────────────────────────────────────────

const LIFE = 0.8; // 흔적이 남아 있는 시간 (초)
const SWING_PX = 900; // 이 속도(px/s)면 "휘두르기"로 보고 가장 굵고 밝게

export class InputTrail {
  constructor(anchor) {
    const c = document.createElement('canvas');
    c.id = 'trail';
    c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;';
    anchor.after(c); // 게임 화면 바로 위, 메뉴·버튼보다는 아래
    this.canvas = c;
    this.ctx = c.getContext('2d');
    this.touch = []; // { x, y, t, v } (null = 손가락을 뗀 자리: 선을 끊는다)
    this.pad = []; // { x, y, t } (패드 좌표, m)
    this.enabled = true;
    this.drawn = false; // 캔버스에 지우지 않은 그림이 있나 (없으면 지우지 않는다 — 빈 캔버스를 매 프레임 지우지 않게)
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.canvas.width = Math.round(window.innerWidth * dpr);
    this.canvas.height = Math.round(window.innerHeight * dpr);
    this.drawn = false; // 크기를 정하면 캔버스가 비워진다
  }

  /** 손가락이 움직였다 (화면 좌표 px, 시간 초) */
  addTouch(x, y, t) {
    const last = this.touch[this.touch.length - 1];
    let v = 0;
    if (last && last.t < t) v = Math.hypot(x - last.x, y - last.y) / (t - last.t);
    this.touch.push({ x, y, t, v: last ? (last.v * 0.4 + v * 0.6) : 0 });
  }

  /** 손가락을 뗐다 → 다음 선과 이어지지 않게 */
  lift() {
    if (this.touch.length && this.touch[this.touch.length - 1] !== null) this.touch.push(null);
  }

  /** 마우스로 조작할 때: 손 위치(패드, m)를 기록 */
  addPad(x, y, t) {
    const last = this.pad[this.pad.length - 1];
    if (last && Math.abs(last.x - x) + Math.abs(last.y - y) < 1e-4) {
      last.t = t; // 가만히 있으면 점만 새로 고친다
      return;
    }
    this.pad.push({ x, y, t });
  }

  clear() {
    this.touch.length = 0;
    this.pad.length = 0;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawn = false;
  }

  draw(now, showPad) {
    const g = this.ctx;
    const dpr = this.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (this.drawn) {
      g.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.drawn = false;
    }
    if (!this.enabled) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.lineCap = 'round';
    // 오래된 점 버리기
    while (this.touch.length && (this.touch[0] === null || now - this.touch[0].t > LIFE)) this.touch.shift();
    while (this.pad.length > 1 && now - this.pad[0].t > LIFE) this.pad.shift();
    // 아래에서 무엇이든 그릴 수 있으면 다음 프레임에 지운다 (선 두 점 이상, 또는 마우스 원판)
    if (this.touch.length > 1 || (showPad && this.pad.length)) this.drawn = true;

    // 손가락 흔적: 어두운 테두리 위에 밝은 선 (모래·하늘 어디서든 보이게). 처음엔 또렷하다가 끝에 빨리 사라진다
    for (const pass of [0, 1]) {
      for (let i = 1; i < this.touch.length; i++) {
        const a = this.touch[i - 1];
        const b = this.touch[i];
        if (!a || !b) continue;
        const age = (now - b.t) / LIFE;
        if (age >= 1) continue;
        const fade = 1 - age * age;
        const s = Math.min(1, b.v / SWING_PX); // 빠르기 0~1
        const w = 3 + 11 * s;
        if (pass === 0) {
          g.strokeStyle = `rgba(20, 12, 6, ${fade * 0.35})`;
          g.lineWidth = w + 4;
        } else {
          g.strokeStyle = `rgba(255, ${Math.round(240 - 100 * s)}, ${Math.round(210 - 160 * s)}, ${fade * (0.55 + 0.4 * s)})`;
          g.lineWidth = w;
        }
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.stroke();
      }
    }

    // 마우스: 오른쪽 아래 원판 위의 손 위치 흔적
    if (showPad && this.pad.length) {
      const R = Math.min(70, window.innerHeight * 0.14);
      const cx = window.innerWidth - R - 24;
      const cy = window.innerHeight - R - 24;
      const toX = (x) => cx + (x / 0.62) * R;
      const toY = (y) => cy - (y / 0.62) * R;
      g.fillStyle = 'rgba(20, 14, 10, 0.25)';
      g.strokeStyle = 'rgba(243, 230, 200, 0.25)';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      for (let i = 1; i < this.pad.length; i++) {
        const a = this.pad[i - 1];
        const b = this.pad[i];
        const age = (now - b.t) / LIFE;
        const dt = Math.max(1e-3, b.t - a.t);
        const s = Math.min(1, Math.hypot(b.x - a.x, b.y - a.y) / dt / 3); // 손 위치가 3 m/s면 최대
        g.strokeStyle = `rgba(255, ${Math.round(236 - 90 * s)}, ${Math.round(200 - 150 * s)}, ${Math.max(0, 1 - age) * (0.3 + 0.5 * s)})`;
        g.lineWidth = 1.5 + 5 * s;
        g.beginPath();
        g.moveTo(toX(a.x), toY(a.y));
        g.lineTo(toX(b.x), toY(b.y));
        g.stroke();
      }
      const p = this.pad[this.pad.length - 1];
      g.fillStyle = 'rgba(255, 240, 210, 0.85)';
      g.beginPath();
      g.arc(toX(p.x), toY(p.y), 3.5, 0, Math.PI * 2);
      g.fill();
    }
  }
}

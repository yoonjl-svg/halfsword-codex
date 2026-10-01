// ─────────────────────────────────────────────────────────────
//  AI의 눈: 상대를 "조금 늦게" 본다
//
//  사람은 본 것을 알아차리는 데 시간이 걸린다(반응 시간). 그래서 AI는 매 순간 상대의 모습을
//  기록해 두고, reaction초 전의 모습을 보고 판단한다. 난이도가 낮을수록 더 늦게 본다.
//  읽는 것은 사람이 눈으로 볼 수 있는 것뿐이다: 몸 위치·움직임, 손(칼자루) 위치와 움직임,
//  칼끝 위치와 속도, 자세, 비틀거림. (상대 조종 입력을 몰래 읽지 않는다)
// ─────────────────────────────────────────────────────────────

const N = 96; // 기록 개수 (1/120초마다 → 0.8초)

function snap() {
  return {
    t: -1,
    cx: 0, cz: 0, cy: 0, // 가슴 위치
    vx: 0, vz: 0, // 몸(골반) 속도
    tx: 0, ty: 0, tz: 0, // 칼끝 위치
    tvx: 0, tvy: 0, tvz: 0, // 칼끝 속도
    mx: 0, my: 0, mz: 0, // 칼날 가운데(타격점) 위치
    mvx: 0, mvy: 0, mvz: 0, // 타격점 속도
    hx: 0, hy: 0, // 손 위치 (패드 좌표: 상대 기준 x = 상대의 칼 든 쪽)
    hvx: 0, hvy: 0, // 손 움직임 빠르기
    guard: -1,
    state: 'stand',
    offBalance: 0,
    balance: 100,
    armed: true,
    vigor: 1,
  };
}

export class Senses {
  constructor(me, foe) {
    this.me = me;
    this.foe = foe;
    this.buf = Array.from({ length: N }, snap);
    this.head = -1;
    this.t = 0;
  }

  /** 지금 상대의 모습을 기록한다 (매 스텝) */
  record(dt) {
    this.t += dt;
    const f = this.foe;
    this.head = (this.head + 1) % N;
    const s = this.buf[this.head];
    s.t = this.t;
    const c = f.bodies.chest.translation();
    s.cx = c.x;
    s.cy = c.y;
    s.cz = c.z;
    const v = f.bodies.pelvis.linvel();
    s.vx = v.x;
    s.vz = v.z;
    const tp = f.tipPrev;
    if (tp) {
      s.tx = tp.x;
      s.ty = tp.y;
      s.tz = tp.z;
    }
    s.tvx = f.tipVel.x;
    s.tvy = f.tipVel.y;
    s.tvz = f.tipVel.z;
    const mp = f.hitPointPrev;
    if (mp) {
      s.mx = mp.x;
      s.my = mp.y;
      s.mz = mp.z;
    }
    s.mvx = f.hitPointVel.x;
    s.mvy = f.hitPointVel.y;
    s.mvz = f.hitPointVel.z;
    s.hx = f.skill.aim.x;
    s.hy = f.skill.aim.y;
    s.hvx = f.skill.aimVel.x;
    s.hvy = f.skill.aimVel.y;
    s.guard = f.guardPose.nearest ?? -1;
    s.state = f.state;
    s.offBalance = f.offBalance;
    s.balance = f.balance;
    s.armed = f.armed;
    s.vigor = f.vigor;
  }

  /** delay초 전의 모습 (기록이 모자라면 가장 오래된 것) */
  seen(delay) {
    const back = Math.min(N - 1, Math.max(0, Math.round(delay * 120)));
    let i = (this.head - back + N * 2) % N;
    if (this.buf[i].t < 0) i = (this.head + 1) % N;
    for (let k = 0; k < N && this.buf[i].t < 0; k++) i = (i + 1) % N;
    return this.buf[i];
  }

  /** delay초 전부터 span초 동안 손이 가장 빨리 움직인 빠르기 (방금 크게 휘둘렀는지) */
  recentHandSpeed(delay, span) {
    let best = 0;
    const b0 = Math.round(delay * 120);
    const b1 = Math.min(N - 1, b0 + Math.round(span * 120));
    for (let b = b0; b <= b1; b++) {
      const s = this.buf[(this.head - b + N * 2) % N];
      if (s.t < 0) break;
      const sp = Math.hypot(s.hvx, s.hvy);
      if (sp > best) best = sp;
    }
    return best;
  }
}

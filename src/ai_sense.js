// ─────────────────────────────────────────────────────────────
//  AI의 눈: 상대를 "조금 늦게" 본다
//
//  사람은 본 것을 알아차리는 데 시간이 걸린다(반응 시간). 그래서 AI는 매 순간 상대의 모습을
//  기록해 두고, reaction초 전의 모습을 보고 판단한다. 난이도가 낮을수록 더 늦게 본다.
//  읽는 것은 사람이 눈으로 볼 수 있는 것뿐이다: 몸 위치·움직임, 손(칼자루) 위치와 움직임,
//  칼끝 위치와 속도, 자세, 비틀거림. (상대 조종 입력을 몰래 읽지 않는다)
// ─────────────────────────────────────────────────────────────

import { FINISH } from './finish.js';
import { TIME } from './config.js';
import { captureVitalPose } from './vital_target.js';

const N = Math.round(96 * TIME.k); // 기록 개수 (1/120초마다 → 게임 0.8초 × std = 실제 0.8 초 — 표준 시간 10/25 · 옛 판 96)

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
    crouch: 0, // 고노센 웅크림 무게 (f.iaiReadyW — 10/27 21:4x 웅크린 사람에게 낮게 치기 · ai.js crouchLow)
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
    s.crouch = f.iaiReadyW ?? 0; // 웅크림 (몸이 낮아진 것 — 눈으로 보이는 것)
    // 약한 자세 겨눔 (FINISH.vital, 10/12): 머리·목·가슴·칼 자리 사본 — AI 는 이것도 반응 시간만큼 늦게 본다 (끄면 기록하지 않는다)
    s.vital = FINISH.vital ? captureVitalPose(f) : null;
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

// ── 2:2 (동시 대전 3단계 — 10/29): 사람 쪽 창(secret.js PlayerSecretWatch) · 막기 단추(parry_button.js PlayerParryGuard)의 눈을 상대마다 ──
//  host = { me, foe, sense }. addFoeSense 를 한 번도 안 부르면(1:1) recordFoeSenses = 예전 host.sense.record(dt) 한 줄.
//  상대마다 Senses 하나 · 모두 매 스텝 적어 시계(sense.t)가 같다 (ai.js setFoe 와 같은 꼴 — AI 는 PER_FOE 로 더 많은 칸을 바꾼다)
/** 겨눌 수 있는 상대를 하나 더 (판 시작에) */
export function addFoeSense(host, f) {
  if (!f || f === host.me) return;
  const M = (host.foeSenses ??= new Map([[host.foe, host.sense]]));
  if (M.has(f)) return;
  const s = new Senses(host.me, f);
  s.t = host.sense.t;
  M.set(f, s);
}
/** 겨눈 상대를 f 로 (같으면 아무 일 없음) */
export function setFoeSense(host, f) {
  if (!f || f === host.foe) return;
  addFoeSense(host, f);
  host.foe = f;
  host.sense = host.foeSenses.get(f);
}
/** 매 스텝: 지금 상대 + (2:2) 다른 상대들의 눈 */
export function recordFoeSenses(host, dt) {
  if (!host.foeSenses) return host.sense.record(dt);
  for (const s of host.foeSenses.values()) s.record(dt);
}

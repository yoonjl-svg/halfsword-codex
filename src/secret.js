// ─────────────────────────────────────────────────────────────
//  유파 비기 — 조건 판정 공용 (AI·플레이어 같은 함수)
//
//  10/9 사장님 23:3x '인간 플레이어로서는 비기를 아예 못 쓰겠어' → 플레이어 비기 (docs/strike/player_secret_2026-10-09.md).
//  비기의 조건(상대 사건을 지금 모습으로 봄 · cond)을 ai.js 에만 두면 플레이어 쪽이 따로 베껴야 한다 → 여기 한 곳에 두고
//  ai.js(secretScan·secretCond)와 플레이어 창(PlayerSecretWatch, main.js)이 함께 부른다. 난수 없음.
//
//  view = 판정하는 쪽의 간격 { reach(내 간격 끝), foeReach(상대 칼 닿는 거리 추정), clinch } — AI 는 this.M·this.foeReach,
//   플레이어는 검술 풀이의 measure(같은 꾸러미 값)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { SECRET, SKILL, BIND } from './config.js';
import { TRADITIONS } from './schools.js';
import { Senses } from './ai_sense.js';
import { segDist } from './skill.js';

const clamp = THREE.MathUtils.clamp;
const _r = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/** 칸 값: 문자열이면 SECRET 의 열쇠 (schools.js 는 수를 갖지 않는다) */
export function secretVal(v) {
  return typeof v === 'string' ? SECRET[v] : v;
}

/** threat() 와 같은 셈을 지금 모습 s 로 (위협 번호는 건드리지 않는다): { line, thrust, sp, E(칼끝 추정 에너지 ½·m·v²), high(상대 손이 높음) } 또는 null.
 *  lag: s 를 몇 초 전 모습으로 넘겼나 (기본 0 — 비기 판정). 플레이어 막기 버튼(parry_button.js)은 AI 처럼 반응 지연만큼 늦은 모습을 넘기므로 '어디서 칼을 들었었나'도 그만큼 앞을 본다 (ai.js threat 의 reaction + 0.15) */
export function threatNow(sense, foe, s, c, r, d, foeReach, lag = 0) {
  if (d > foeReach + 0.9) return null;
  let hit = null;
  for (let k = 0; k < 2; k++) {
    const px = k ? s.mx : s.tx;
    const py = k ? s.my : s.ty;
    const pz = k ? s.mz : s.tz;
    const vx = k ? s.mvx : s.tvx;
    const vy = k ? s.mvy : s.tvy;
    const vz = k ? s.mvz : s.tvz;
    const sp = Math.hypot(vx, vy, vz);
    if (sp < 3.5) continue;
    const rx = px - c.x;
    const ry = py - c.y;
    const rz = pz - c.z;
    const vh2 = vx * vx + vz * vz;
    const tc = clamp(vh2 > 1e-3 ? -(rx * vx + rz * vz) / vh2 : 0, 0, 0.45);
    const hx = rx + vx * tc;
    const hy = ry + vy * tc;
    const hz = rz + vz * tc;
    if (Math.hypot(hx, hz) > 0.55 || hy < -1.3 || hy > 0.75) continue;
    if (!hit || tc < hit.tc) hit = { tc, hx, hy, hz, vx, vy, vz, sp };
  }
  if (!hit) return null;
  const lat = hit.hx * r.x + hit.hz * r.z;
  const bx = s.tx - s.mx;
  const by = s.ty - s.my;
  const bz = s.tz - s.mz;
  const along = (bx * hit.vx + by * hit.vy + bz * hit.vz) / ((Math.hypot(bx, by, bz) || 1) * hit.sp);
  const thrust = along > 0.75;
  let line;
  if (thrust) line = 'thrust';
  else {
    const ch = sense.seen(lag + 0.15); // 어디서 칼을 들었었나 (threat 와 같은 0.15 s 앞 — 반응 지연은 lag, 비기는 0)
    if (ch.hy > 0.15) line = ch.hx > 0.15 ? 'highL' : ch.hx < -0.15 ? 'highR' : 'highC';
    else if (ch.hy < -0.2) line = ch.hx >= 0 ? 'lowL' : 'lowR';
    else if (hit.hy > -0.1) line = lat > 0.12 ? 'highR' : lat < -0.12 ? 'highL' : 'highC';
    else line = lat >= 0 ? 'lowR' : 'lowL';
  }
  const m = foe.swordProps?.m ?? 1.5;
  const v2 = s.tvx * s.tvx + s.tvy * s.tvy + s.tvz * s.tvz;
  return { line, thrust, sp: hit.sp, E: 0.5 * m * v2, high: s.hy > 0.15 };
}

/** 상대 칼끝 추정 에너지 ½·m·v² 의 최고 (지금부터 span 초 앞까지, 지금 모습 — 반응 지연 0) */
export function foeRecentTipE(sense, foe, span) {
  const B = sense.buf;
  const N = B.length;
  let best = 0;
  for (let b = 0; b <= Math.min(N - 1, Math.round(span * 120)); b++) {
    const s = B[(sense.head - b + N * 2) % N];
    if (s.t < 0) break;
    const v2 = s.tvx * s.tvx + s.tvy * s.tvy + s.tvz * s.tvz;
    if (v2 > best) best = v2;
  }
  return 0.5 * (foe.swordProps?.m ?? 1.5) * best;
}

/**
 * 치명적인 칼인가 — 궤적 (10/10 사장님 '치명성을 J 로 판단하는 게 이상하다. 목을 노리는 궤적 같은 걸로는?' → 디렉터 안 승인):
 *  들어오는 상대 칼끝(지금 모습 s)의 위치·속도로 앞 SECRET.lethalLook 초를 곧게 내다본 선분이 내 머리(공 r 0.1)·목(가슴 → 머리 사이 점, r 0.06)
 *  겉에서 얼마나 가까이 지나나(ctx.lethalD, m)와 칼끝 빠르기(ctx.tipSp, m/s)를 ctx 에 적는다. 판정은 secretCond (lethalDist·lethalSpeed)
 */
function lethalPath(ctx, s, me) {
  const T = SECRET.lethalLook;
  const ax = s.tx;
  const ay = s.ty;
  const az = s.tz;
  const bx = ax + s.tvx * T;
  const by = ay + s.tvy * T;
  const bz = az + s.tvz * T;
  const h = me.bodies.head.translation();
  const ch = me.bodies.chest.translation();
  const nx = ch.x + (h.x - ch.x) * 0.6;
  const ny = ch.y + (h.y - ch.y) * 0.6;
  const nz = ch.z + (h.z - ch.z) * 0.6;
  const dHead = segPoint(ax, ay, az, bx, by, bz, h.x, h.y, h.z) - 0.1;
  const dNeck = segPoint(ax, ay, az, bx, by, bz, nx, ny, nz) - 0.06;
  ctx.lethalD = Math.min(dHead, dNeck);
  ctx.tipSp = Math.hypot(s.tvx, s.tvy, s.tvz);
}

/** 선분 a–b 와 점 p 사이 거리 */
function segPoint(ax, ay, az, bx, by, bz, px, py, pz) {
  const ux = bx - ax;
  const uy = by - ay;
  const uz = bz - az;
  const L2 = ux * ux + uy * uy + uz * uz;
  const t = L2 > 1e-9 ? clamp(((px - ax) * ux + (py - ay) * uy + (pz - az) * uz) / L2, 0, 1) : 0;
  return Math.hypot(ax + ux * t - px, ay + uy * t - py, az + uz * t - pz);
}

/**
 * 상대 사건 (S.when 의 threat·foeRaise·foeCharge·foeRecover) 을 지금 모습 s0 로 본다. { on, ctx } — 사건이 없거나 S 가 상대 사건 비기가 아니면 on false.
 *  ctx: threat 면 threatNow 의 값, 아니면 { ev: 'raise' | 'recover', tipE? }
 */
export function secretEvent(S, sense, foe, s0, c, r, d0, foeReach, me = null, ex = null) {
  const W = [].concat(S.when);
  if (W.includes('inside')) return insideEvent(s0, c, d0, ex);
  if (W.includes('gilmok')) return gilmokEvent(s0, c, d0, ex);
  if (W.includes('threat')) {
    const ctx = threatNow(sense, foe, s0, c, r, d0, foeReach);
    if (ctx && S.cond?.lethal && me) lethalPath(ctx, s0, me);
    return { on: !!ctx, ctx };
  }
  if (!(W.includes('foeRecover') || W.includes('foeRaise') || W.includes('foeCharge'))) return { on: false, ctx: null };
  const dx = s0.cx - c.x;
  const dz = s0.cz - c.z;
  // preThreat 의 raising·charging 과 같은 꼴 — 지금 모습으로. 거리 창(cond.window)이 있는 비기(일본)는 preThreat 의 '가까움' 문턱 대신 그 창이 거리를 맡는다
  const closing = Math.max(0, -(s0.vx * dx + s0.vz * dz) / d0);
  const raising = W.includes('foeRaise') && s0.hvy > 1.6 && s0.hy > 0.05;
  const charging = W.includes('foeCharge') && closing > 0.9;
  let on = (raising || charging) && (!!S.cond?.window || d0 < foeReach + closing * 0.4 + 0.3);
  // 결심한 공격만 (cond.commit — 10/9 사장님 '발동은 좀 줄되'): 들어 올림이면 손이 commit 패드 m/s 이상으로 움직일 때만(달려듦은 그대로)
  if (on && S.cond?.commit && !charging && Math.hypot(s0.hvx, s0.hvy) < secretVal(S.cond.commit)) on = false;
  if (on) return { on, ctx: { ev: 'raise' } };
  // seize 의 recovering 과 같은 꼴(방금 크게 휘두르고 손이 멎음) — 늦지 않게 지금 모습으로 (일본은 들어 올림 다음 차례의 보조 사건)
  if (W.includes('foeRecover') && sense.recentHandSpeed(0, 0.6) > 3.5 && Math.hypot(s0.hvx, s0.hvy) < 1.8) {
    return { on: true, ctx: { ev: 'recover', tipE: foeRecentTipE(sense, foe, 0.6) } }; // 진짜 헛스윙인가 — 그 휘두름의 칼끝 추정 에너지 (cond.whiff)
  }
  return { on: false, ctx: null };
}

/**
 * 이베리아 '호 안쪽' 사건 (10/10 04:4x 사장님 — 전 BindCount 맺힘 셋을 바꿈): 상대 몸통(가슴)이 내 칼 호 안쪽까지 밀고 들어옴 —
 *  거리 d0 < 내 reach − SECRET.iberianInside 이고, 상대가 다가오는 중(가슴이 나 쪽으로 SECRET.iberianInsideClosing m/s 넘게)이거나 그 거리에 SECRET.iberianInsideDwell 초 머묾.
 *  ex = { reach, dt, st } — st.insideT 에 머문 시간을 센다 (AI secretEv · 플레이어 창 ev 칸, 같은 셈). 굴림 없음
 */
function insideEvent(s0, c, d0, ex) {
  if (!ex || !(ex.reach > 0)) return { on: false, ctx: null };
  const st = ex.st;
  const inside = d0 < ex.reach - SECRET.iberianInside;
  st.insideT = inside ? (st.insideT ?? 0) + (ex.dt ?? 0) : 0;
  if (!inside) return { on: false, ctx: null };
  const closing = Math.max(0, -(s0.vx * (s0.cx - c.x) + s0.vz * (s0.cz - c.z)) / d0);
  const on = closing > SECRET.iberianInsideClosing || st.insideT >= SECRET.iberianInsideDwell;
  return on ? { on, ctx: { ev: 'inside', closing, dwell: st.insideT } } : { on: false, ctx: null };
}

/**
 * 이베리아 길목 지키기 사건 (10/11 03:3x 사장님 '길목 지키기 비기로 해보자' — v6): 준비(ex.armed — IaiArm 'gilmok' 셈, 칼끝 거리 reach 밖에서 쌓임)된 채, 상대 가슴이 내 칼끝 거리
 *  (ex.reach)를 **다가오며 넘어 들어오는 그 순간** — 지난 스텝 거리 ≥ reach 이고 이번 스텝 거리 < reach, 그리고 상대 가슴이 나 쪽으로 SECRET.iberianInsideClosing m/s 넘게 다가옴.
 *  (경계를 맞닿기 contact 로 옮겨 봤다: 48 판에서 상대 롱소드 AI 가 reach 와 contact 사이(1.85~1.96 m)에 서서 유예 0.5 s 안에 contact 를 넘지 않아 창 0 — 되돌림)
 *  (v4·v5 '호 안쪽'의 다가옴 문턱 0.3 을 그대로 다시 씀 — 새 값 아님. 내가 걸어 들어가 경계를 넘은 것은 상대가 '길목에 들어온' 것이 아니다).
 *  안에 머무는 것은 세지 않는다(v5 '호 안쪽'은 상태라 맞붙은 거리 내내 창이 열렸다). ex = { reach, dt, st, armed } — st.gilPrevD 에 지난 거리를 적는다. 굴림 없음
 *  근거: 피 단Ⅶ 「This rule serves to deter people in a street and impede them moving from one end to another」 [원문 영역] — 몬탄테는 자리(길목)를 지키는 칼 [해석]
 */
function gilmokEvent(s0, c, d0, ex) {
  if (!ex || !(ex.reach > 0)) return { on: false, ctx: null };
  const st = ex.st;
  const prev = st.gilPrevD;
  st.gilPrevD = d0;
  const B = ex.reach;
  if (!ex.armed || prev == null || !(prev >= B && d0 < B)) return { on: false, ctx: null };
  const closing = Math.max(0, -(s0.vx * (s0.cx - c.x) + s0.vz * (s0.cz - c.z)) / d0);
  return closing > SECRET.iberianInsideClosing ? { on: true, ctx: { ev: 'gilmok', closing } } : { on: false, ctx: null };
}

/** 비기 조건 (cond) — 굴림 없음. view = { reach, foeReach, clinch } */
export function secretCond(S, ctx, d, view) {
  const C = S.cond;
  if (!C) return true;
  if (C.lethal && !(ctx && ctx.tipSp >= SECRET.lethalSpeed && ctx.lethalD <= SECRET.lethalDist)) return false; // 10/10: J 문턱(옛 lethalJ 247) 대신 궤적 — 칼끝 길이 내 머리·목 곁을 지남 (lethalPath)
  if (C.armed && SECRET.iai && !view.armed) return false; // 일본 발도: 발도 대기에서만 (IaiArm)
  if (C.armed && SECRET.iai && view.contact != null && d > view.contact + SECRET.iaiStep + SECRET.iaiMargin) return false; // 발도가 닿는 거리: 내디딤(iaiStep) 뒤 맞닿기 + 여유 안
  if (C.whiff && ctx?.ev === 'recover' && !(ctx.tipE >= secretVal(C.whiff))) return false; // 일본 보조 사건(헛침): 상대가 헛친 칼이 제대로 휘두른 칼이었나
  if (C.window) {
    // 일본 後の先 창: 상대 공격은 명백히 안 닿고(상대 칼 닿는 거리 foeReach + 여유 밖) 내 後の先 은 닿는다(내 간격 끝 + 기술 reach + 강한 내딛음 몫 안)
    if (!(C.armed && SECRET.iai) && (d <= view.foeReach + SECRET.japaneseFoeMargin || d > view.reach + SECRET.japaneseReach + SECRET.japaneseFar)) return false; // (발도는 아래 대기·닿는 거리가 창을 맡는다)
  }
  if (C.line && !C.line.includes(ctx?.line)) return false;
  if (C.range === 'counter' && !(d < view.reach + 0.3 && d > view.clinch + 0.1)) return false; // ai.js counterRange 와 같은 식
  if (C.dist) {
    const w = secretVal(C.dist);
    if (d < view.reach + w[0] || d > view.reach + w[1]) return false;
  }
  return true;
}

/**
 * 중국 연환삼격 조건 (10/10 01:2x 사장님 '쉬었다가 들어가며' → 정확한 값): 내 공격 없이 SECRET.chineseRest 초 이상 지난 뒤 들어가며 친 첫 칼이
 *  맞았나 (cond.landed 면 맞물림 제외). rest = 그 칼을 시작하기 전 내 공격 없이 지난 시간 (s). AI(secretFirstHit)·플레이어 창이 같은 함수
 */
export function firstHitOk(S, rest, landed, bound) {
  if (S.cond?.rest != null && !(rest >= secretVal(S.cond.rest))) return false;
  return landed || (!S.cond?.landed && bound);
}

/**
 * 이베리아 맺힘 셈 (10/10 01:2x 사장님 '내 베기가 피해를 주지 못하고 칼끼리만 부딪힌 횟수가 3 회가 되면 다음 공격이 비기' — 세는 법 디렉터 정의):
 *  내 베기 공격이 상대 칼과 닿고(맺힘·막힘) 상처를 못 내고 끝나면 +1 · 내 공격이 상처를 내면 0 · SECRET.iberianReset 초 동안 내 칼이 상대 칼에
 *  닿지 않으면 0 · 헛친 베기(아무것도 안 닿음)는 그대로 · 비기를 내면 0. n ≥ SECRET.iberianBinds 면 ready. AI·플레이어 같은 셈
 */
export class BindCount {
  constructor() {
    this.n = 0;
    this.quiet = 0; // 내 칼이 상대 칼에 닿지 않은 시간
  }
  /** 매 스텝: 칼끼리 닿아 있나 */
  tick(dt, touching) {
    this.quiet = touching ? 0 : this.quiet + dt;
    if (this.quiet >= SECRET.iberianReset) this.n = 0;
  }
  /** 내 베기 공격 하나가 끝남 */
  strike(landed, bound) {
    if (landed) this.n = 0;
    else if (bound) this.n++;
  }
  get ready() {
    return this.n >= SECRET.iberianBinds;
  }
  reset() {
    this.n = 0;
  }
}

/**
 * 일본 발도 대기 (10/10 02:4x 사장님 '뒤로 몇 초 이상 물러서면?'): 상대 간격 밖(상대 칼 닿는 거리 밖)에 SECRET.iaiArmTime 초 이상 계속 머물면 armed.
 *  간격 안으로 들어가거나 공격·막기(busy)면 풀린다. AI 는 이때 웅크린 발도 대기 자세(secret_instant.js iaiReadyPose), 플레이어는 '고노센 준비' 표시만.
 *  고노센(cond.armed)은 armed 일 때만 — SECRET.iai 일 때. AI·플레이어 같은 셈
 */
//  10/11 이베리아 길목 지키기(v6)도 같은 셈을 쓴다 — 열쇠만 다르다(new IaiArm('gilmokArmTime', 'gilmokArmGrace'), outside = 내 칼끝 거리 reach 밖). 일본은 열쇠 없이 부르니 전과 같다.
//  ons = 준비가 켜진 수 (재기 — 판정에는 안 씀) · consume() = 창을 열었거나 비기를 냄 → 준비가 풀림 (길목: 한 번 준비에 한 번 기회)
export class IaiArm {
  constructor(timeKey = 'iaiArmTime', graceKey = 'iaiArmGrace') {
    this.t = 0;
    this.armed = false;
    this.timeKey = timeKey;
    this.graceKey = graceKey;
    this.ons = 0;
  }
  tick(dt, outside, busy) {
    if (busy) {
      this.t = 0;
      this.armed = false;
      return;
    }
    if (outside) {
      this.t += dt;
      this.grace = SECRET[this.graceKey];
      const was = this.armed;
      this.armed = this.t >= SECRET[this.timeKey];
      if (this.armed && !was) this.ons++;
      return;
    }
    // 간격 안: 대기 자세는 iaiArmGrace 초 뒤에 풀린다 (달려드는 상대가 간격 안으로 막 들어온 순간을 받을 수 있게)
    if (this.armed && (this.grace -= dt) > 0) return;
    this.t = 0;
    this.armed = false;
  }
  consume() {
    this.t = 0;
    this.armed = false;
  }
}

/** 두 칼이 닿아 있나: 칼끼리 부딪힘(combat.bladeClash 가 적는 fighter.feel.touching — 실제 접촉 충격) 또는 ai.js checkBind 와 같은 기하(칼날 0.1 지점 ~ 칼끝 선분 사이 < 0.07 m) */
export function bladesTouch(me, foe) {
  if (!me.armed || !foe.armed) return false;
  if (me.feel?.touching) return true;
  if (!me.tipPrev || !foe.tipPrev) return false;
  return segDist(me.bladePoint(0.1, _a), me.tipPrev, foe.bladePoint(0.1, _b), foe.tipPrev) < 0.07;
}

/**
 * 넓은 뜻의 맞부딪힘 (자연 바인드 실험 2안 — BIND.natural, 사장님 10/11 20:3x '꼭 검을 맞댄 게 아니어도 밀착해서 힘을 경합하는 경우를 넓은 의미의 맞부딪힘으로 해석'):
 *  칼날이 아닌 곳끼리 붙어 미는 접촉 — ① 내 팔·코등이·자루 ↔ 상대 팔·코등이·자루·몸통 (칼자루끼리 · 손과 칼자루 · 칼자루로 몸을 누름) ② 몸통끼리(가슴·배·골반).
 *  칼날이 몸에 닿은 것(베기)·칼날끼리(bladesTouch 가 맡음)는 넣지 않는다. 근접 밀치기 누르기(fighter.closeStep)에서 칼이 엇걸린 채 누르는 것은 칼날끼리라 bladesTouch 로 이미 든다.
 *  근거: Ringeck·Lew 「Ringen am Schwert」(칼을 쥔 씨름)·「Einlaufen」(뛰어들기 — 왕관에서 'rush in') [원전 2차]. Rapier 접촉을 읽기만 한다(물리 무관). 가슴 거리 1.5 m 밖은 묻지 않는다(팔이 닿을 수 없는 거리 — 셈 줄이기)
 */
const WIDE_ARMS = ['uarmS', 'farmS', 'uarmO', 'farmO'];
const WIDE_TORSO = ['chest', 'abdomen', 'pelvis'];
export function wideTouch(me, foe) {
  const W = me.world;
  if (!W || !foe?.bodies || !me.bodies) return false;
  const a = me.bodies.chest.translation();
  const b = foe.bodies.chest.translation();
  if (Math.hypot(a.x - b.x, a.z - b.z) > 1.5) return false;
  const hilts = (f) => (f.armed ? f.swordColliders.filter((c) => !f.bladeColliders.includes(c)) : []);
  const cols = (f, names) => names.map((n) => f.bodies[n]?.collider(0)).filter(Boolean);
  const touch = (A, B) => {
    for (const x of A) for (const y of B) {
      let hit = false;
      W.contactPair(x, y, (m) => { if (m.numContacts() > 0) hit = true; });
      if (hit) return true;
    }
    return false;
  };
  const mine = [...cols(me, WIDE_ARMS), ...hilts(me)];
  const theirs = [...cols(foe, WIDE_ARMS), ...hilts(foe)];
  return touch(mine, [...theirs, ...cols(foe, WIDE_TORSO)]) || touch(theirs, cols(me, WIDE_TORSO)) || touch(cols(me, WIDE_TORSO), cols(foe, WIDE_TORSO));
}

/** 바인드(맞부딪힘)인가: 칼끼리 닿음(bladesTouch) — 자연 바인드 실험(BIND.natural)이면 넓은 뜻의 맞부딪힘(wideTouch)도. 끄면 bladesTouch 그대로 */
export function bindTouch(me, foe) {
  if (bladesTouch(me, foe)) return true;
  return !!BIND.natural && me.armed && foe.armed && wideTouch(me, foe);
}

/**
 * 이베리아 멈추지 않는 흐름의 수 (10/11 — schools.js IBERIAN_SECRET do.flow, AI ai.js secretGo · 플레이어 skill.js secret 같은 함수). 난수 없음.
 *  hand = 지금 손 패드 [x, y] · dir = 지금 칼(손)이 움직이는 쪽 [x, y] (플레이어는 비기를 낸 끌기, 없으면 걸러진 손 목표 속도 — 크기는 안 봄) · D = do 칸.
 *  첫 쪽 s(+1 오른쪽 = 탈류부터 · −1 왼쪽 = 레베스부터)는 지금 흐름이 정한다 — 칼을 그대로 그쪽으로 떨어뜨려 감고(피 복Ⅰ) 거기서 올린다:
 *   ① 올려 베는 중(dir 위로)이면 그 올려베기를 첫 수로 이어 끝까지 · ② 옆·아래로 가는 중이면 그 쪽으로 · ③ 멈춰 있으면 손이 있는 쪽, 가운데면 오른쪽(피 단Ⅰ 탈류부터).
 *  내려 베는 중이면 꺾지 않고 곧장 그 쪽 아래로, 아니면 바깥 옆([s × 0.5, …])을 돌아 떨어진다.
 *  수 = 한 방향 한 토막 (떨어뜨림 → 올려베기 → 떨어뜨림 → 올려베기 … → 머리 위로 넘김 → 둘러 베는 큰 한 칼). 토막 끝마다 gate(flowGate — 실제 칼이 그 자리에 갔나)가 있어
 *   손 목표가 먼저 끝나도 칼이 따라오기 전엔 다음 토막을 열지 않는다 — 무거운 칼이 명령을 못 따라와 번갈아 베기가 한쪽에서 뭉개지던 것(탐침: 칼끝 옆 폭 0.23 m)을 막는다.
 *  토막 = { name, nameKo, from, pre: [](이음새 물레 점 없음 — 앞 토막 끝에서 곧장), path, gate?, open, kind, reach, base }
 */
export function montanteFlowSeq(hand, dir, D, f = null) {
  if (D.gilmok) return gilmokSeq(hand, D, f); // v6 길목 지키기: 한 칼 (아래)
  const hx = hand[0];
  const hy = hand[1];
  const len = Math.hypot(dir?.[0] ?? 0, dir?.[1] ?? 0);
  const ux = len > 1e-6 ? dir[0] / len : 0;
  const uy = len > 1e-6 ? dir[1] / len : 0;
  const side = (v) => (v < 0 ? -1 : 1);
  const P = (o, s) => o[s].slice();
  const rising = uy > 0.5; // ① 올려 베는 중
  let s;
  if (rising) s = Math.abs(ux) > 0.2 ? -side(ux) : side(hx); // 올라가는 쪽의 반대가 시작 쪽
  else if (Math.abs(ux) > 0.3) s = side(ux); // ② 그 쪽으로 가는 중
  else s = Math.abs(hx) > 0.1 ? side(hx) : 1; // ③ 멈춰 있음
  const seq = [];
  let at = [hx, hy];
  const push = (t) => {
    seq.push({ kind: 'cut', reach: 0, base: 1, ...t, from: at.slice(), pre: [] });
    at = t.path[t.path.length - 1].slice();
  };
  const fall = (sd, path) => push({ name: sd > 0 ? 'flowFallR' : 'flowFallL', nameKo: sd > 0 ? '오른쪽으로 떨어뜨림 (알티바슈)' : '왼쪽으로 떨어뜨림 (알티바슈 드 레베스)', path, gate: { low: sd }, open: 'H' });
  const rise = (sd, path) => push({ name: sd > 0 ? 'flowTalhoBaixo' : 'flowRevezBaixo', nameKo: sd > 0 ? '올려 탈류 (탈류 드 바슈)' : '올려 레베스 (레베스 드 바슈)', path, gate: { cross: -sd }, open: sd > 0 ? 'LL' : 'LR' }); // 빈틈 = unterhau · unterhauL
  const mid = (sd) => [sd * D.riseMid, -0.08];
  // 첫 토막: 지금 손에서 곧장 (순간이동·멈춤 없음)
  if (rising) {
    rise(s, hy > -0.08 || hx * s < 0 ? [P(D.high, -s)] : [mid(s), P(D.high, -s)]); // 이미 올라가는 중 — 가운데 점을 지났으면 높이 비낌으로 곧장
  } else {
    if (uy < -0.3 || Math.hypot(hx - D.low[s][0], hy - D.low[s][1]) < 0.15) fall(s, [P(D.low, s)]); // 내려 베는 중(또는 이미 아래) — 꺾지 않고 그 쪽 아래로
    else fall(s, [[s * D.fall[0], Math.min(0.1, Math.max(-0.2, hy * 0.5))], P(D.low, s)]); // 옆·멈춤 — 바깥 옆을 돌아 떨어뜨림
    rise(s, [mid(s), P(D.high, -s)]);
  }
  let cur = s;
  for (let i = 1; i < (D.rise ?? 2); i++) {
    const n = -cur;
    fall(n, [[n * D.fall[0], D.fall[1]], P(D.low, n)]); // 앞 토막 끝(높이 비낌, n 쪽)에서 그 쪽으로 떨어뜨려 감고
    rise(n, [mid(n), P(D.high, -n)]); // 거기서 올림
    cur = n;
  }
  // 큰 한 칼: 마지막 올려베기 끝(높이 비낌, c 쪽)에서 머리 위로 넘겨 어깨 뒤로 그 쪽 옆에 떨어뜨리고(피 복Ⅱ 「pass it over the head and behind the shoulders, such that it falls over the left arm」)
  //  몸 가운데 높이로 반대쪽 끝까지 둘러 벤다(circling — 피 복Ⅱ 「circling revez」·단Ⅺ·복Ⅺ 「revez orizontal cingido」 · 고 규칙 9 「in mittlerer Höhe」). 길 = redondo 앞 절반 · zwerch(L) 줄
  const c = -cur;
  push({ name: c > 0 ? 'flowOverR' : 'flowOverL', nameKo: '머리 위로 넘김', path: [[c * D.over[0], D.over[1]], P(D.side, c)], gate: { side: c, behind: true }, open: 'H' });
  push({ name: c > 0 ? 'flowTalhoCingido' : 'flowRevezCingido', nameKo: c > 0 ? '둘러 베는 탈류 (talho cingido)' : '둘러 베는 레베스 (revez cingido)', path: [D.cutMid.slice(), P(D.side, -c)], open: c > 0 ? 'UL' : 'UR' }); // 빈틈 = zwerch · zwerchL
  return seq;
}

/**
 * 이베리아 길목 지키기의 한 칼 (10/11 v6 — schools.js IBERIAN_SECRET_GILMOK do.gilmok, AI·플레이어 같은 함수). 난수 없음.
 *  감아 둔 쪽 s(손이 있는 쪽 — 가운데면 오른쪽 = 탈류, 피 단Ⅰ)에서 몸 전체를 돌려 몸 가운데 높이(고 규칙 9 「in mittlerer Höhe」)로 반대쪽 끝까지 둘러 벤다.
 *  길 = v5 마지막 칼(flowTalhoCingido/flowRevezCingido: cutMid [0, 0.1] → 반대쪽 옆 자세) = 꾸러미 zwerch·zwerchL 줄. 물리 서보 길(순간이동·스텝마다 자리 지정 없음).
 *  손이 그 쪽 옆 자세(D.side[s])에서 패드 거리 0.15 밖이면(v5 montanteFlowSeq 의 '이미 아래' 판정 0.15 그대로 — 새 값 아님)(플레이어 — 준비 자세를 잡지 않고 창을 받은 때) 먼저 그 쪽으로 감는 토막(문 = 칼끝이 그 쪽 · 가슴보다 뒤 —
 *  v5 '머리 위로 넘김'과 같은 문)을 둔다. AI 는 준비 동안 옆 자세를 잡고 있으니 곧장 벤다
 */
/**
 * 길목 준비 자세 규칙 (10/11 v6 2차 AI · 5차 플레이어도 같은 함수): 준비가 켜질 때 기다릴 낮은 자세 — 지금 자세가 낮은 셋(아래 탈류·아래 레베스·칼끝 땅에)이면 그대로,
 *  아니면 손에서 가장 가까운 낮은 자세. guards = 이 유파 간 보는 자세 목록 · cur = 지금 자세 · hand = 손 패드 [x, y]
 */
export const GILMOK_LOW = ['wechselR', 'wechselL', 'alber'];
export function gilmokLowGuard(guards, cur, hand) {
  if (GILMOK_LOW.includes(cur?.name)) return cur;
  let best = null;
  const dd = (g) => Math.hypot(hand[0] - g.pad[0], hand[1] - g.pad[1]); // ai_techniques.js padDist 와 같은 셈
  for (const g of guards) if (GILMOK_LOW.includes(g.name) && (!best || dd(g) < dd(best))) best = g;
  return best ?? cur;
}
/** 감는 시간 남음 (같은 규칙): 상대가 다가오는 중(> iberianInsideClosing)이고 가까우면(< reach + 다가옴 × 0.4 + 0.3 — preThreat '가까움' 꼴) gilmokArmGrace 로 다시 채우고, 아니면 줄인다. > 0 이면 옆 자세로 감음 */
export function gilmokWindT(windT, closing, d, reach, dt) {
  return closing > SECRET.iberianInsideClosing && d < reach + closing * 0.4 + 0.3 ? SECRET.gilmokArmGrace : Math.max(0, (windT ?? 0) - dt);
}

/**
 * 길목 경계 선 (10/11 v6 4차 — 디렉터 '북부 대공의 검 경계는 스위치로'): 준비(밖)·순간(넘음)을 재는 가슴 거리.
 *  SECRET.gilmokEdge 'reach'(기본) = 무기 간격 끝(검술 풀이 measure.reach) · 'cut' = 이 한 칼의 칼끝이 실제로 닿는 앞 거리 + 디딤 —
 *  덧씌우기 가운데 손 앞(SECRET.iaiPath.M.hand[0] 0.5) + 날 길이(weaponCfg.bladeLength) + 디딤(do.step.fwd 0.3). 칼 길이·손 자리에서 계산(탐침 값 아님)
 */
export function gilmokLine(f, reach, D) {
  if (SECRET.gilmokEdge !== 'cut') return reach;
  return SECRET.iaiPath.M.hand[0] + (f.weaponCfg?.bladeLength ?? 0) + (D?.step?.fwd ?? 0);
}

/**
 * 길목 한 칼의 디딤 (10/11 v6 3차 — 디렉터 '디딤을 그 순간 상대와의 간격에 맞추세요'): 디딤 = (그 순간 상대 가슴 거리 − 이 한 칼의 칼끝 앞 거리)를
 *  [st.fwd 0.3 (talhoRodeado), st.max 0.6 (japaneseStep)] 로 자름 — 기하로 정하는 값. 칼끝 앞 거리 = 덧씌우기 가운데 손 앞(SECRET.iaiPath.M.hand[0] 0.5) + 날 길이(weaponCfg.bladeLength).
 *  f 가 없으면(도구) st.fwd 그대로
 */
function gilmokStep(st, f) {
  if (!f?.foe || st.max == null) return { lat: st.lat, fwd: st.fwd, when: st.when };
  const tip = SECRET.iaiPath.M.hand[0] + (f.weaponCfg?.bladeLength ?? 0);
  return { lat: st.lat, fwd: clamp(f.foeDistance() - tip, st.fwd, st.max), when: st.when };
}

export function gilmokSeq(hand, D, f = null) {
  const hx = hand[0];
  const s = Math.abs(hx) > 0.05 ? (hx < 0 ? -1 : 1) : 1;
  const P = (o, k) => o[k].slice();
  const seq = [];
  let at = hand.slice();
  const push = (t) => {
    seq.push({ kind: 'cut', reach: 0, base: 1, ...t, from: at.slice(), pre: [] });
    at = t.path[t.path.length - 1].slice();
  };
  const side = P(D.side, s);
  if (Math.hypot(hand[0] - side[0], hand[1] - side[1]) > 0.15) push({ name: s > 0 ? 'gilmokWindR' : 'gilmokWindL', nameKo: s > 0 ? '가로 탈류로 감음' : '가로 레베스로 감음', path: [side], gate: { side: s, behind: true }, open: 'H' });
  // 한 칼을 두 토막으로 (길은 그대로 — cutMid → 반대쪽 옆 자세): 옆 자세에서 칼이 몸 뒤로 감겨 있어 칼끝이 손보다 늦게 온다. 탐침(tools/sim/iberian_flow_probe.mjs):
  //   ① 문이 없으면 손 목표가 먼저 끝나 칼이 경직 동안에야 건너갔다 ② 끝에만 문(반대쪽)을 두면 손이 가운데를 0.03 s 에 지나 칼끝이 앞으로 오지 않고 머리 위 뒤로 돌아 건너갔다(칼끝 앞 ≤ 0.06 m · 상처 0).
  //   → 가운데 점에 문 front(칼끝이 가슴보다 앞) — 칼끝이 앞으로 돌아 나온 뒤 반대쪽으로 둘러 벤다(문 past: 칼끝이 반대쪽). 문마다 최대 FLOW_GATE_MAX, 맞히면 곧장 (v5 문과 같음)
  const nm = s > 0 ? 'gilmokTalho' : 'gilmokRevez';
  const ko = s > 0 ? '길목 둘러 베기 (talho orizontal cingido)' : '길목 둘러 베기 (revez orizontal cingido)';
  push({ name: nm, nameKo: ko, path: [D.cutMid.slice()], gate: { front: true }, open: s > 0 ? 'UL' : 'UR', ...(D.step ? { step: gilmokStep(D.step, f) } : {}) }); // 빈틈 = zwerch · zwerchL · 걸음(D.step)은 첫 토막에
  push({ name: nm + 'End', nameKo: ko, path: [P(D.side, -s)], gate: { past: -s }, open: s > 0 ? 'UL' : 'UR' });
  return seq;
}

/** 흐름 토막 문을 기다리는 최대 (s) — 따라 지나감(손이 끝 자세에 닿은 뒤 칼이 지나가길 기다림)의 바탕 시간과 같은 값 (ai.js follow timer 0.3 · skill.js follow run.t ≥ 0.3).
 *  탐침(tools/sim/iberian_flow_probe.mjs): 0.5 면 막힌 토막에서 칼끝이 0 가까이 멎은 채 0.5 s 씩 서 흐름이 끊겨 보였다(플레이어 2.4~2.7 s) — 0.3 (1.6~1.9 s) */
export const FLOW_GATE_MAX = 0.3;
const _gc = new THREE.Vector3();
const _gr = new THREE.Vector3();
const _gf = new THREE.Vector3();
/**
 * 흐름 토막 문 (montanteFlowSeq 의 gate): 실제 칼끝(물리)이 그 토막의 끝 자리에 갔나 — 몸 기준(가슴 원점), 문턱은 모두 0(가슴 높이 · 몸 가운데 · 가슴 앞뒤):
 *  low: s — 칼끝이 s 쪽(칼 든 쪽 +)이고 가슴보다 아래 (그 쪽으로 떨어졌다) · cross: s — 칼끝이 s 쪽이고 가슴보다 위 (올려 벤 칼이 반대쪽으로 건너갔다) ·
 *  behind(+ side: s) — 칼끝이 가슴보다 뒤(이고 s 쪽) (머리 위로 넘겨 어깨 뒤로 그 쪽에 떨어졌다). AI·플레이어 같은 함수.
 *  그 토막이 상대 몸을 맞혔으면 부른 쪽이 기다리지 않고 넘긴다 — 맞은 칼은 문 자리에 못 가지만 흐름은 멈추지 않는다(피 복Ⅶ 「in each step you must give a blow」).
 *  (칼끼리 닿음으로 넘기는 것은 재 보고 뺐다 — 붙은 거리에선 상대 칼이 늘 곁에 있어 문이 바로 열려 토막이 0.1 s 로 뭉개졌다)
 */
export function flowGate(f, g) {
  const tp = f.tipPrev ?? f.bladePoint(1, _gc);
  const c = f.bodies.chest.translation();
  f.right(_gr);
  f.forward(_gf);
  const rx = tp.x - c.x;
  const ry = tp.y - c.y;
  const rz = tp.z - c.z;
  const lat = f.side * (rx * _gr.x + rz * _gr.z);
  const fw = rx * _gf.x + rz * _gf.z;
  if (g.low != null) return lat * g.low > 0 && ry < 0;
  if (g.cross != null) return lat * g.cross > 0 && ry > 0;
  if (g.behind) return fw < 0 && (g.side == null || lat * g.side > 0);
  if (g.past != null) return lat * g.past > 0; // v6 길목 한 칼: 칼끝이 반대쪽(past)으로 건너갔다
  if (g.front) return fw > 0; // v6 길목 한 칼 가운데: 칼끝이 가슴보다 앞으로 돌아 나왔다
  return true;
}

/**
 * 막기 연환의 자리 (10/11 — schools.js *_SECRET_PARRY cond.slots): 이 막기가 유파가 정한 자세로 한 막기인가 → 자리 열쇠 또는 null. 굴림 없음.
 *  손(패드 [x, y])이 그 줄의 막기 자리 패드(꾸러미 parry[줄]) 0.15 안 — 0.15 는 v5·v6 '이미 그 자세' 판정(montanteFlowSeq·gilmokSeq)의 패드 폭 그대로(새 값 아님).
 *  AI: line = 막은 줄(defLine) — 그 줄이 정한 줄이고 손이 그 자리에 있어야. 플레이어: line = null — 막기 자리가 없으니 손이 정한 자리 패드 가운데 가장 가까운 것(0.15 안).
 *   두 자리가 같은 패드면(중국 거정세·표두세 = G.tag) hint(그때 들어오던 상대 칼의 줄 — threatNow)로 고르고, 없으면 cond.slots 의 뒤 것(중국: 표두세 — 플레이어 자세표에서 그 패드의 꼴)
 */
export function parrySlotOf(S, line, hand, parry, hint = null) {
  const L = S?.cond?.slots;
  if (!L || !parry) return null;
  const dist = (ln) => (parry[ln] ? Math.hypot(hand[0] - parry[ln][0], hand[1] - parry[ln][1]) : Infinity);
  if (line != null) return L[line] && dist(line) <= 0.15 ? L[line] : null;
  if (hint && L[hint] && dist(hint) <= 0.15) return L[hint];
  let best = null;
  let bd = 0.15;
  for (const ln of Object.keys(L)) if (dist(ln) <= bd) (bd = dist(ln)), (best = L[ln]);
  return best;
}

/**
 * 독일 막기 연환의 붙은 시간 어드밴티지 (10/11 19:1x 사장님 '오래 붙어 있었을수록 깊고 강한 공격'): held = 창이 열린 뒤(붙음이 SECRET.deBindMin 을 넘은 뒤) 낼 때까지 붙어 있던 시간 (s).
 *  0 이면 1(다른 비기와 같은 판정 배율·힘 창), deBindFull − deBindMin 초에 SECRET.deBindGain(최대)까지 곧게 오른다 — 판정 배율(hitMul)과 서보 힘 창(power)에 곱한다 [확인 전]
 */
export function bindGain(held) {
  const span = Math.max(1e-6, SECRET.deBindFull - SECRET.deBindMin);
  return 1 + (SECRET.deBindGain - 1) * clamp(held / span, 0, 1);
}

/** 상대 칼끝 빠르기의 최고 (m/s, 지금부터 span 초 앞까지 — 지금 모습). 막기 연환의 '상대 칼이 들어오던 중' (foeRecentTipE 와 같은 버퍼 셈) */
export function foeRecentTipSp(sense, span) {
  const B = sense.buf;
  const N = B.length;
  let best = 0;
  for (let b = 0; b <= Math.min(N - 1, Math.round(span * 120)); b++) {
    const s = B[(sense.head - b + N * 2) % N];
    if (s.t < 0) break;
    best = Math.max(best, Math.hypot(s.tvx, s.tvy, s.tvz));
  }
  return best;
}

/** 내 베기 사건 비기(combo·firstHit)의 거리: 이어 치기 거리 안 (ai.js secretCombo·secretFirstHit 와 같은 식) */
export function chainRange(d, view) {
  return d <= view.reach + 0.1 && d >= view.clinch - 0.5;
}

// ─────────────────────────────────────────────────────────────
//  플레이어 비기 창 (main.js 가 물리 스텝마다 부른다 — 시뮬 도구에는 없다)
//   내 무기 유파의 비기 조건이 차면 SECRET.playerWindow 초 동안 창이 열린다. 그 안에 공격 입력이 오면 main.js 가
//   player.skill.secret(fire()) 로 완벽 실행. 창을 놓치면 보통 공격. 횟수 제한 없음.
//  사건: 상대 사건은 AI 와 같은 눈(Senses — 지금 모습 seen(0))과 같은 함수(secretEvent·secretCond).
//   내 베기 사건은 플레이어 휘두름(skill.swinging 이 켜졌다 꺼진 한 덩이 = 베기 한 번)으로 센다:
//   combo(이베리아) = 쉼(SECRET.playerChainGap 초) 없이 이어진 베기 수 · firstHit(중국) = 쉬었다가 들어가며 친 첫 베기가 맞음(상대 아픔 +0.05 — AI 와 같은 눈, 막힘 제외)
// ─────────────────────────────────────────────────────────────
export class PlayerSecretWatch {
  /** locked: 이 판엔 비기를 아직 못 배움 (사장님 결정 10/13 23:1x — 손에 든 무기 유파 숙련도 5 에서 비기, main.js) → S = null (창이 안 열린다 · 무유파와 같은 길) */
  constructor(me, foe, { locked = false } = {}) {
    this.me = me;
    this.foe = foe;
    this.S = locked ? null : playerSecretOf(me);
    this.sense = new Senses(me, foe);
    this.ev = { armed: true, off: 0 };
    this.open = null; // 열린 창 { S, ctx, t }
    this.queued = null; // 미리 받은 입력으로 곧 낼 연환 { dir } (canBuffer — 중국 막기 연환, 10/12)
    this.combo = 0;
    this.binds = new BindCount(); // 이베리아 맺힘 셈 (10/10)
    this.iaiArm = new IaiArm(); // 일본 발도 대기 (10/10 02:4x — 플레이어는 표시만)
    this.gilArm = new IaiArm('gilmokArmTime', 'gilmokArmGrace'); // 이베리아 길목 지키기 준비 (10/11 v6 — 플레이어는 표시만, AI 와 같은 셈)
    this.gilWins = 0; // 길목 창 수 (재기)
    this.gap = Infinity; // 마지막 베기 끝에서 지난 시간
    this.swing = null; // 지금 베기 { first, landed }
    this.prevFoePain = foe.pain;
    this.opened = 0; // 창이 열린 수 (재기)
  }

  /** 판정 쪽 간격 (검술 풀이의 꾸러미 값 — AI 와 같은 수) */
  view() {
    const art = this.me.swordArt;
    const M = art.measure;
    return { reach: M.reach, clinch: M.clinch, contact: M.contact, foeReach: art.measureFor(this.foe.weapon).reach + 0.05, armed: this.iaiArm.armed };
  }

  /** 매 물리 스텝. busy = 플레이어 비기 실행 중(창을 새로 열지 않는다) */
  update(dt, busy) {
    const me = this.me;
    const foe = this.foe;
    this.sense.record(dt);
    if (this.open && (this.open.t -= dt) <= 0) this.open = null;
    const S = this.S;
    const painUp = foe.pain > this.prevFoePain + 0.05;
    this.prevFoePain = foe.pain;
    if (!S || !me.alive || !foe.alive || !me.armed || me.state !== 'stand') {
      this.open = null;
      this.queued = null;
      this.swing = null;
      this.combo = 0;
      this.iaiArm.tick(0, false, true);
      this.gilArm.tick(0, false, true);
      if (this.pc) this.pc.pend = this.pc.buf = null;
      return;
    }
    const c = me.bodies.chest.translation();
    const s0 = this.sense.seen(0);
    const dx = s0.cx - c.x;
    const dz = s0.cz - c.z;
    const d0 = Math.max(0.01, Math.hypot(dx, dz));
    const V = this.view();
    // 내 베기 덩이
    const sw = me.skill.swinging && !busy;
    if (sw && !this.swing) this.swing = { first: this.gap > SECRET.playerChainGap, rest: this.gap, landed: false, bound: false, w0: foe.wounds?.length ?? 0 };
    if (this.swing && painUp) this.swing.landed = true;
    const touch = bladesTouch(me, foe);
    if (this.swing && touch) this.swing.bound = true; // 칼 맞물림 (ai.js checkBind 와 같은 기하)
    if (S.when === 'parry') this.parryTick(dt, BIND.natural ? bindTouch(me, foe) : touch, sw || !!me.skill.tap, s0, c, d0, V, busy); // 막기 연환 (10/11) · 자연 바인드 실험이면 넓은 맞부딪힘도 (bindTouch)
    if (S.when === 'bindCount') this.binds.tick(dt, touch);
    if (S.do?.instant) this.iaiArm.tick(dt, d0 > V.foeReach, sw || busy);
    if (S.do?.gilmok) {
      const was = this.gilArm.armed;
      this.gilArm.tick(dt, d0 > gilmokLine(me, V.reach, S.do), sw || busy); // 길목: 내 칼끝 거리 밖 (일본은 상대 칼 닿는 거리 밖)
      this.gilmokRest(dt, was, s0, c, d0, V, sw || busy);
    }
    if (!sw && this.swing) {
      // 베기 하나가 끝났다
      const w = this.swing;
      this.swing = null;
      this.combo = this.gap > SECRET.playerChainGap ? 1 : this.combo + 1;
      this.gap = 0;
      if (S.when === 'bindCount') {
        this.binds.strike(SECRET.iberianHurt === 'wound' ? (foe.wounds?.length ?? 0) > w.w0 : w.landed, w.bound); // '피해' = 벤 상처(iberianHurt 'wound') 또는 아픔 +0.05
        if (!busy && !this.open && this.binds.ready) this.openWindow(null, SECRET.iberianWindow); // 셋째 맺힘 → 다음 공격 입력이 비기 (창 iberianWindow)
      }
      if (!busy && !this.open && chainRange(d0, V)) {
        if (S.when === 'combo' && this.combo >= SECRET.comboN && (!S.cond?.touch || w.landed || w.bound)) this.openWindow(null); // (10/10 이베리아는 bindCount 로 바뀜 — 옛 길)
        if (S.when === 'firstHit' && firstHitOk(S, w.rest, w.landed, w.bound)) this.openWindow(null);
      }
    } else if (!sw) this.gap += dt;
    if (me.jolt > 0.5) this.combo = 0; // 맞아 흔들림 = 끊김
    if (busy) return;
    // 상대 사건 (AI secretScan 과 같은 꼴: 사건 한 번에 한 번, 0.3 s 그치면 다시 건다)
    const r = me.right(_r);
    const E = this.ev;
    const { on, ctx } = secretEvent(S, this.sense, foe, s0, c, r, d0, V.foeReach, me, { reach: S.do?.gilmok ? gilmokLine(me, V.reach, S.do) : V.reach, dt, st: E, armed: this.gilArm.armed }); // ex: 이베리아 호 안쪽 (reach · 머문 시간) · 길목 (준비)
    if (!on) {
      E.off += dt;
      if (E.off > 0.3) E.armed = true;
      return;
    }
    E.off = 0;
    if (!E.armed || s0.state !== 'stand' || this.open) return;
    if (!secretCond(S, ctx, d0, V)) return;
    E.armed = false;
    if (ctx?.ev === 'gilmok') {
      this.gilArm.consume(); // 한 번 준비에 한 번 기회 — 창을 놓치면 다시 간격 밖에서 준비해야 한다
      this.gilWins++;
    }
    this.openWindow(ctx);
  }

  /**
   * 플레이어 길목 준비 자세 (10/11 v6 5차 — 디렉터): 준비(armed)이고 손가락을 떼고 있으면(handHeld 거짓 — 쉴 자세로 돌아가는 그 자리) 쉴 목표를 AI 준비 자세와 같은 규칙으로 —
   *  기본은 낮은 자세(gilmokLowGuard — 손에서 가까운 아래 탈류·아래 레베스·칼끝 땅에), 상대가 다가오고 가까우면(gilmokWindT) 그 쪽 옆 자세로 감고 0.5 s 유지. 손 빠르기 =
   *  쉴 자세로 돌아가는 빠르기 SKILL.recoverSpeed(휘두르기로 오인되지 않게 — 그대로). 손가락을 대고 있으면 플레이어 손 그대로(창에서는 감는 토막이 붙는 꼴).
   *  까닭: 4차 원인 — 손이 옆 자세 밖에서 창을 받으면 감는 토막의 떨어지는 힘으로 칼끝이 처져 넓적다리를 벤다. 미리 옆 자세면 가슴 높이(탐침)
   */
  gilmokRest(dt, was, s0, c, d0, V, busy) {
    const me = this.me;
    const P = (this.gilPose ??= { guard: null, side: 1, windT: 0 });
    if (!this.gilArm.armed) {
      P.windT = 0;
      return;
    }
    if (!was) {
      const guards = TRADITIONS[me.swordArt?.tradition]?.guards ?? [];
      P.guard = gilmokLowGuard(guards, null, [me.handOffset.x, me.handOffset.y]);
      P.side = P.guard?.name === 'wechselL' ? -1 : 1;
      P.windT = 0;
    }
    const closing = Math.max(0, -(s0.vx * (s0.cx - c.x) + s0.vz * (s0.cz - c.z)) / d0); // 상대 가슴이 나 쪽으로 (지금 모습 — insideEvent·gilmokEvent 와 같은 셈)
    P.windT = gilmokWindT(P.windT, closing, d0, V.reach, dt);
    if (me.handHeld || busy || !P.guard) return;
    const side = this.S.do.side[P.side];
    const tgt = P.windT > 0 ? side : P.guard.pad;
    const off = me.handOffset;
    const hx = tgt[0] - off.x;
    const hy = tgt[1] - off.y;
    const d = Math.hypot(hx, hy);
    const step = SKILL.recoverSpeed * dt;
    if (d <= step) off.set(tgt[0], tgt[1]);
    else {
      off.x += (hx / d) * step;
      off.y += (hy / d) * step;
    }
    me.skill.recovering = false; // 검술 층의 쉴 자세 걷기와 다투지 않게 (이 동안은 길목 준비 자세가 쉴 자리)
  }

  /**
   * 플레이어 막기 연환 (10/11 — AI ai.js parryCombo 와 같은 뜻). 플레이어는 막기 모드가 없으니 '막기' = 내가 휘두르거나 찌르지 않는 동안(attacking 거짓)
   *  상대 칼이 들어오던 중(지난 0.6 s 안 상대 칼끝 ≥ 3.5 m/s — 3.5 = threatNow 칼끝 하한, 0.6 = 일본 헛침 셈 foeRecentTipE 의 span) 칼끼리 새로 맞닿음.
   *  막기 성공 = 그 0.6 s 안 내 몸 상처 없음 (pc.ok). 정한 자세 = 그 순간 손이 정한 자리 패드 0.15 안(parrySlotOf — pc.slot).
   *  독일(window 'bind'): 붙음이 cond.min 초(SECRET.deBindMin) 이어지면 창이 열리고 칼이 붙어 있는 동안 계속 (떨어지면 닫힘 · ctx.held = 열린 뒤 붙은 시간 → bindGain) ·
   *  중국(window 'apart'): 칼이 갈라지는 순간 창이 열려 cond.time 초.
   *  창이 열린 동안 막기가 뚫려 상처가 나면 닫힘. 재기: pc.binds = 맞닿음이 이어진 시간들 (s) — 독일 창 길이 판단용
   */
  parryTick(dt, touch, attacking, s0, c, d0, V, busy) {
    const me = this.me;
    const S = this.S;
    const P = (this.pc ??= { prev: false, nw: me.wounds?.length ?? 0, woundAge: Infinity, line: null, lineAge: Infinity, pend: null, ok: 0, slot: 0, bindT: 0, binds: [], parryBinds: [], inParry: false });
    const nw = me.wounds?.length ?? 0;
    P.woundAge = nw > P.nw ? 0 : P.woundAge + dt;
    P.nw = nw;
    P.lineAge += dt;
    if (Math.hypot(s0.tvx, s0.tvy, s0.tvz) >= 3.5) {
      const th = threatNow(this.sense, this.foe, s0, c, me.right(_r), d0, V.foeReach); // 들어오는 줄 (같은 패드 두 자리 고르기 — parrySlotOf hint)
      if (th) (P.line = th.line), (P.lineAge = 0);
    }
    const start = touch && !P.prev;
    const sep = !touch && P.prev;
    P.prev = touch;
    if (touch) P.bindT += dt;
    else if (sep) {
      P.binds.push(P.bindT);
      if (P.inParry) P.parryBinds.push(P.bindT);
      P.bindT = 0;
      P.inParry = false;
    }
    const o = this.open;
    if (o?.ctx?.ev === 'parry') {
      if (P.woundAge === 0 || (S.cond.window === 'bind' && !touch)) this.open = null; // 뚫림 · 독일: 칼이 떨어짐
      else if (S.cond.window === 'bind') o.ctx.held += dt; // 독일: 창이 열린 뒤 붙어 있는 시간 (어드밴티지 — bindGain · 화면 차오름)
    }
    if (P.buf && (P.buf.t += dt) > secretVal(S.cond.time)) {
      P.buf = null; // 미리 받은 입력: 떨어지지 않고 창 길이(cnParryWindow)보다 오래 붙어 있으면 버린다 (기다림은 그대로 — 떨어지면 창은 열린다)
      P.bufDrop = (P.bufDrop ?? 0) + 1;
    }
    if (P.pend) {
      if (P.woundAge === 0 || attacking) P.pend = P.buf = null;
      else if (S.cond.window === 'apart') {
        if (sep) {
          if (!busy && !this.open) {
            this.openWindow({ ev: 'parry', slot: P.pend.slot }, secretVal(S.cond.time));
            if (P.buf) (this.queued = P.buf), (P.bufFired = (P.bufFired ?? 0) + 1); // 미리 받은 입력 → 이 스텝 곧장 연환 (main.js 가 update 뒤에 fire)
          }
          P.pend = P.buf = null;
        }
      } else if (!touch) P.pend = null;
      else if ((P.pend.t += dt) >= secretVal(S.cond.min)) {
        if (!busy && !this.open) this.openWindow({ ev: 'parry', slot: P.pend.slot, held: 0 }, Infinity); // 붙어 있는 동안 열림 (떨어지면 위에서 닫힘)
        P.pend = null;
      }
    }
    if (!start) return;
    P.edges = (P.edges ?? 0) + 1; // 재기: 새 맞닿음 · 그때 내가 휘두르던 중 · 상대 칼이 느림 · 상처 0.6 s 안
    if (attacking || busy) return void (P.rejAtk = (P.rejAtk ?? 0) + 1);
    if (!(foeRecentTipSp(this.sense, 0.6) >= 3.5)) return void (P.rejSlow = (P.rejSlow ?? 0) + 1);
    if (P.woundAge < 0.6) return void (P.rejHurt = (P.rejHurt ?? 0) + 1);
    P.ok++;
    P.inParry = true;
    const slot = parrySlotOf(S, null, [me.handOffset.x, me.handOffset.y], me.swordArt?.school?.parry, P.lineAge < 0.6 ? P.line : null);
    if (!slot) return;
    P.slot++;
    P.pend = { slot, t: 0 };
  }

  /**
   * 미리 받기 (10/12 사장님 01:1x '그런 공격을 운 좋게 막아도 인간 반사신경으로 커맨드 넣기 어려웠어' — SECRET.cnBuffer, docs/strike/cn_combo_play_2026-10-12.md §4):
   *  중국 막기 연환(window 'apart')에서 정한 자세로 막아 칼이 맞닿아 있는 동안(pend) 온 공격 입력(톡·빠른 끌기 — main.js 의 비기 입력과 같은 문턱)을 취소 대신 받아 둔다.
   *  그동안 그 입력은 보통 공격으로 새지 않는다(main.js 가 칼 입력을 삼킴 — bufferHold). 칼이 떨어지는 스텝에 창이 열리며 곧장 연환(내는 순간은 떨어진 뒤 — '떨어짐' 그대로).
   *  창 길이(cond.time)보다 오래 붙어 있으면 버린다. 새 값 없음. 플레이어만 (AI 는 창 없이 곧장 — 전과 같음)
   */
  canBuffer() {
    const P = this.pc;
    return !!(SECRET.cnBuffer && this.S?.when === 'parry' && this.S.cond?.window === 'apart' && P?.pend && !P.buf && !this.open && !this.queued);
  }

  /** 입력을 받아 둔다 (dir = 그 끌기의 방향 — fire 의 o.dir 와 같은 꼴) */
  buffer(dir) {
    const P = this.pc;
    P.buf = { dir, t: 0 };
    P.bufN = (P.bufN ?? 0) + 1;
  }

  /** 받아 둔 입력이 있거나 곧 낼 차례 — main.js 가 그동안 칼 입력을 삼킨다 */
  get bufferHold() {
    return !!(this.pc?.buf || this.queued);
  }

  openWindow(ctx, t = SECRET.playerWindow) {
    this.open = { S: this.S, ctx, t };
    this.opened++;
  }

  /** 창 안의 공격 입력: 열린 창을 닫고 그 비기 { S, ctx } 를 돌려준다 (없으면 null) */
  fire() {
    const o = this.open;
    this.open = null;
    if (o && this.queued) o.dir = this.queued.dir; // 미리 받은 입력의 끌기 방향
    this.queued = null;
    if (o) {
      this.combo = 0;
      this.binds.reset(); // 비기를 내면 0
    }
    return o;
  }

  /**
   * 길목 준비에서 곧장 내기 (사장님 결정 10/11 13:2x — '발동 시점이 좀 늦어. 미리 쓸 수 있게 해야해. 너무 미리 써서 미스가 나는 게 그 반대보다 말이 돼'):
   *  플레이어만, 길목 준비(gilArm.armed — 경계 안으로 들어온 뒤 유예 gilmokArmGrace 동안도 포함)가 켜져 있으면 창(경계 넘음 사건)을 기다리지 않고 공격 입력 하나가 곧 길목 한 칼.
   *  준비는 쓰면 풀린다(한 번 준비에 한 번). 너무 이르면 칼끝이 못 미쳐 헛치고, 늦으면 상대가 안쪽이라 걸린다 — 보정 없음(물리 그대로). 새 값 없음. AI 는 그대로 경계 넘음 순간에 낸다
   *  돌려줌: { S, ctx } (fire() 와 같은 꼴) 또는 null
   */
  fireArmed() {
    if (!this.S?.do?.gilmok || !this.gilArm.armed) return null;
    this.gilArm.consume();
    this.open = null;
    this.combo = 0;
    this.binds.reset();
    return { S: this.S, ctx: { ev: 'gilmokArmed' } };
  }
}

/** 플레이어 무기의 유파 비기 (내 무기 전통 = 검술 풀이 tradition — schoolOf(w.id)). 스위치(SKILL.schoolArt·schoolSecret·playerSecret)가 꺼졌거나 무유파면 null */
export function playerSecretOf(f) {
  if (!(SKILL.schoolArt && SKILL.schoolSecret && SKILL.playerSecret) || f.weapon?.gun) return null;
  return TRADITIONS[f.swordArt?.tradition]?.secret ?? null;
}

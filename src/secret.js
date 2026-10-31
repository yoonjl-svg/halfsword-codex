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
import { SECRET, SKILL, BIND, CLOSE, UNIQUE_ASSIST, GAIT, realS } from './config.js';
import { TRADITIONS, playerSecretDef } from './schools.js';
import { Senses, addFoeSense, setFoeSense, recordFoeSenses } from './ai_sense.js';
import { segDist } from './skill.js';
import { kitOff } from './skill_kit.js'; // 격살 (10/22): 받은 자세가 동방 막기 I(C7 — 몸꼴 parryCover)일 때만
import { RisolutoWatch, lungeGapOk } from './italian_risoluto.js'; // 이탈리아 거침없이 나아가 찌르기 — 덮인 채 나아가기 (10/22 사람 먼저)
import { stickTurnState, stickTurnStep, stickTurnClear } from './stick_turn.js'; // 이베리아 휘감아 돌기 스틱 판 — 이동 스틱 돌리기 몸짓 (10/23)
import { circleState, circleStep, circleClear, circleLive } from './attack_circle.js'; // 이베리아 싱지르 공격 원 판 — 공격 입력으로 원 그리기 몸짓 (10/24)
import { iaiReadyPosePlayer } from './secret_instant.js'; // 사람 고노센 준비 웅크림 (10/25 23:0x — SECRET.gnsCrouch)

const clamp = THREE.MathUtils.clamp;
const _r = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
// 표준 시간 (10/25 22:3x — config.js TIME): 아래 규칙 시간은 실제 초로 적고 한 번 게임 초로 바꾼다
const RECENT = realS(0.6); // '방금' — 상대가 방금 휘둘렀나 · 방금 베였나 · 최근 빠르기 평균 (실제 0.6 s)
const EV_REARM = realS(0.3); // 상대 사건이 이만큼 그치면 다시 건다 (실제 0.3 s — ai.js secretScan · preThreat 와 같은 수)

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
  // 달려듦 빠르기의 최근 평균 (10/25 16:0x — SECRET.foeChargeAvg): 상대 골반 빠르기의 나 쪽 몫은 걸음마다 출렁인다(스틱 0.5 걸음 p50 0.86 m/s 에 한 스텝 최고 1.75 · 스틱 1 은 넘는 스텝 4 / 15 가 1.2 아래 —
  //  §18) → 들어옴 판정과 같은 최근 0.6 s 지수 평균(GNS_RECENT)으로 '빠르게 걸어 들어옴'을 본다. ex.st 가 없으면(시험 · 옛 부름) 지금 모습 그대로. 아래 달려듦 · 들어옴 fast 가 읽는다
  if (ex?.st) ex.st.foeInAvg = (ex.st.foeInAvg ?? 0) + (-(s0.vx * (s0.cx - c.x) + s0.vz * (s0.cz - c.z)) / d0 - (ex.st.foeInAvg ?? 0)) * Math.min(1, (ex.dt ?? 0) / GNS_RECENT);
  // 일본 들어옴 (10/25 — enterEvent): 다른 사건보다 먼저 본다(지난 거리를 스텝마다 적어야 넘음을 안다). ex.enterLine 이 있을 때만 — 사람 SECRET.gnsEnter · AI SECRET.gnsEnterAI
  if (W.includes('foeEnter') && ex?.enterLine > 0) {
    const en = enterEvent(s0, c, d0, ex, me);
    if (en.on) return en;
  }
  const dx = s0.cx - c.x;
  const dz = s0.cz - c.z;
  // preThreat 의 raising·charging 과 같은 꼴 — 지금 모습으로. 거리 창(cond.window)이 있는 비기(일본)는 preThreat 의 '가까움' 문턱 대신 그 창이 거리를 맡는다
  const closing = Math.max(0, -(s0.vx * dx + s0.vz * dz) / d0);
  const raising = W.includes('foeRaise') && s0.hvy > 1.6 && s0.hy > 0.05;
  const charging = W.includes('foeCharge') && (SECRET.foeChargeAvg && ex?.st ? ex.st.foeInAvg : closing) > SECRET.foeChargeSpeed; // 달려듦 (10/25 16:0x 사장님 '최고 속도 기준으로 상위 30% 정도를 빠르게 걸어들어오는 것으로' — 0.9 → 1.2 (16:1x '1.2m를 기준으로') · `?foeChargeSpeed=0.9` 옛 판)
  let on = (raising || charging) && (!!S.cond?.window || d0 < foeReach + closing * 0.4 + 0.3);
  // 결심한 공격만 (cond.commit — 10/9 사장님 '발동은 좀 줄되'): 들어 올림이면 손이 commit 패드 m/s 이상으로 움직일 때만(달려듦은 그대로)
  if (on && S.cond?.commit && !charging && Math.hypot(s0.hvx, s0.hvy) < secretVal(S.cond.commit)) on = false;
  if (on) return { on, ctx: { ev: 'raise', charge: charging && !raising } }; // charge: 달려듦만으로 열림 (재기 — 판정에는 안 씀)
  // seize 의 recovering 과 같은 꼴(방금 크게 휘두르고 손이 멎음) — 늦지 않게 지금 모습으로 (일본은 들어 올림 다음 차례의 보조 사건)
  if (W.includes('foeRecover') && sense.recentHandSpeed(0, RECENT) > 3.5 && Math.hypot(s0.hvx, s0.hvy) < 1.8) {
    return { on: true, ctx: { ev: 'recover', tipE: foeRecentTipE(sense, foe, RECENT) } }; // 진짜 헛스윙인가 — 그 휘두름의 칼끝 추정 에너지 (cond.whiff)
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

/**
 * 일본 고노센 '들어옴' 사건 (10/25 01:3x 사장님 '이 경우에 창이 안 열리고 천천히 다가와서 가까이 붙어 버리던데?' — docs/strike/school_secret_2026-10-09.md §16):
 *  발도 대기(ex.iaiArmed)인 채, 상대 가슴이 내 발도가 닿는 거리(ex.enterLine — gnsEnterLine)를 **안으로 넘는 그 스텝**(지난 스텝 거리 > 선 ≥ 이번 스텝 거리)에 한 번 —
 *  그 넘음이 상대가 들어와서인가: 최근(GNS_RECENT 0.6 s — 아래 foeRecover 의 '방금' 과 같은 시간) 상대 가슴의 나 쪽 빠르기 > 0 이고 > 내 가슴의 상대 쪽 빠르기.
 *  내가 걸어 들어가 선을 넘은 것은 상대가 '들어온' 것이 아니다. 문턱 수가 없다(길목 지키기 gilmokEvent 는 0.3 m/s 문턱).
 *  첫 꼴은 길목과 같은 0.3 m/s 문턱이었으나 AI 는 0.1 ~ 0.25 m/s 로 기어 들어와(넘는 스텝 p50 0.18 ~ 0.26 m/s) 선 안에서 멈추고 유예 0.5 s 가 먼저 지나 창을 놓쳤다(§16-4).
 *  최근 빠르기(0.6 s 지수 평균)로 보는 까닭: 천천히 걷는 상대의 가슴 빠르기는 걸음마다 0 근처로 출렁인다(시험 걸음 0.47 m/s 에서 −0.01 ~ 0.69).
 *  창을 연 넘음 뒤로는(st.gnsEnter 'done') 준비가 풀리거나 상대가 선 밖에 iaiArmTime 머물 때까지 다시 걸지 않는다 — 선 언저리에 선 상대가 흔들려 선을 오가도 창이 거듭 뜨지 않게
 *  (길목 '한 번 준비에 한 번'과 같은 틀). 칼을 듦 · 달려듦 · 헛침 창은 그대로. 칼을 들지도 달려들지도 않고 천천히 걸어 드는 상대에게도 창이 열린다.
 *  근거: 出端(데바나) — 상대가 나서는 때를 친다(兵法家伝書 p16/15 「一ッ上れば、つけて打」 [원문] — 유령 패시브 debana 와 같은 출처) · 그 때를 '내 간격 선을 넘는 때'로 읽음 [해석]
 *  ex = { enterLine, iaiArmed, st, dt } · me = 나(가슴 빠르기 — 없으면 0) — st 에 지난 거리 gnsPrevD · 최근 빠르기 gnsFoeIn · gnsMeIn · 넘음 gnsEnter · 선 밖 시간 gnsOutT. 굴림 없음
 */
const GNS_RECENT = RECENT; // 실제 0.6 s (표준 시간 10/25)
function enterEvent(s0, c, d0, ex, me) {
  const st = ex.st;
  const prev = st.gnsPrevD;
  st.gnsPrevD = d0;
  const ux = (s0.cx - c.x) / d0;
  const uz = (s0.cz - c.z) / d0;
  const v = me?.bodies?.chest?.linvel();
  const k = Math.min(1, (ex.dt ?? 0) / GNS_RECENT);
  st.gnsFoeIn = (st.gnsFoeIn ?? 0) + (-(s0.vx * ux + s0.vz * uz) - (st.gnsFoeIn ?? 0)) * k; // 상대 가슴이 나 쪽으로 (m/s · 최근)
  st.gnsMeIn = (st.gnsMeIn ?? 0) + ((v ? v.x * ux + v.z * uz : 0) - (st.gnsMeIn ?? 0)) * k; // 내 가슴이 상대 쪽으로
  const B = ex.enterLine;
  if (!ex.iaiArmed) {
    st.gnsEnter = null; // 준비 풀림 → 다음 준비에서 다시
    return { on: false, ctx: null };
  }
  if (d0 > B) {
    st.gnsOutT = (st.gnsOutT ?? 0) + (ex.dt ?? 0);
    if (st.gnsEnter === 'done' && st.gnsOutT >= SECRET.iaiArmTime) st.gnsEnter = null; // 선 밖에 준비 시간만큼 머물면 다시 걸 수 있다 (준비 셈과 같은 수)
    return { on: false, ctx: null };
  }
  st.gnsOutT = 0;
  if (prev == null || !(prev > B) || st.gnsEnter === 'done') return { on: false, ctx: null };
  if (!(st.gnsFoeIn > 0 && st.gnsFoeIn > st.gnsMeIn)) return { on: false, ctx: null }; // 내가 들어가 넘음 (또는 둘 다 서 있음)
  if (SECRET.gnsEnterOpen && foeOnline(s0, c)) return { on: false, ctx: null }; // 여쭘 C (10/25 08:0x · 기본 끔): 칼끝을 내 몸에 겨눈 채 들어옴은 빈틈이 아님 — 이 넘음은 창 없음
  st.gnsEnter = 'done';
  // fast: 상대가 달려듦 빠르기(foeChargeSpeed — secretEvent 의 달려듦과 같은 셈)로 들어와 넘음 — 이 창은 달려듦과 같은 몫이라 B 의 막힘이 안 걸림 (10/25 16:0x)
  const fast = (SECRET.foeChargeAvg ? st.gnsFoeIn : -(s0.vx * ux + s0.vz * uz)) > SECRET.foeChargeSpeed; // foeChargeAvg: 넘음 판정의 최근 0.6 s 평균 그대로
  return { on: true, ctx: { ev: 'enter', closing: st.gnsFoeIn, meIn: st.gnsMeIn, fast } };
}

/**
 * 상대 칼끝이 내 몸을 겨누나 — ai.js foeClass 의 online 과 같은 셈(상대 손 → 칼끝 방향과 상대 손 → 내 가슴 방향의 cos > 0.88 — 그 수 그대로). AI 가 '걸어 들어오는 상대'를
 *  치는 기회(opportunity 'stepin')는 칼끝이 비켰을 때만이다 — 여쭘 C(SECRET.gnsEnterOpen · 10/25 08:0x)가 들어옴 창에 같은 셈을 쓴다. s = 상대 지금 모습 · c = 내 가슴. 굴림 없음
 */
export function foeOnline(s, c) {
  const bx = s.tx - s.mx;
  const by = s.ty - s.my;
  const bz = s.tz - s.mz;
  const qx = c.x - s.mx;
  const qy = c.y - s.my;
  const qz = c.z - s.mz;
  return (bx * qx + by * qy + bz * qz) / (Math.hypot(bx, by, bz) * Math.hypot(qx, qy, qz) + 1e-6) > 0.88;
}

/**
 * 이 몸이 고노센을 쓰나 (AI 고노센 경계 — ai.js gnsWatch · 10/25 08:0x 사장님 '⑤'): AI 몸 = 그 AI 의 비기가 고노센(숙련도 5 · aiOpenSchools — ai.js this.secret) ·
 *  사람 몸 = 손에 든 무기 유파 비기가 고노센(열린 유파 · 사람 비기 스위치 — playerSecretOf)이고 비기 칸을 익힘(skillKit.secret — 몸에 skillKit 이 없으면 켬, skill_kit.js kitOff 와 같은 규칙)
 */
export function gnsUser(f) {
  if (!f) return false;
  if (f.aiControlled) return f.aiCtl?.secret?.name === 'goNoSen' && !!f.aiCtl.iaiArm;
  return SECRET.openSchools.includes(f.swordArt?.tradition) && playerSecretOf(f)?.name === 'goNoSen' && !kitOff(f, 'secret');
}

/**
 * 고노센 B 의 발도 막힘 꼴 (10/25 — SECRET.gnsEnterBlock): 이 창(ctx)에서 낸 발도가 막힐 수 있나 → requestIai 의 block 값.
 *  천천히 걸어 든 들어옴 창(ev 'enter' · fast 아님)만 — 1 = 칼이 몸보다 먼저 상대 칼에 닿으면 막힘 · 2 = 그에 더해 낼 때 상대가 앞을 가리고 있으면 몸에 닿는 자리에서 막힘('cover'):
 *  상대가 막고 있음(사람 = 막기 단추를 누름 · 깨지지 않음 — parry_button.js · AI = 막기 꼴 mode 'defend') 또는 상대 칼끝이 내 몸을 겨눔(foeOnline — 상대 몸의 지금 칼 자리).
 *  그 밖 창 · 0 = false. me = 내는 몸 (사람 skill.js · AI ai.js 같은 함수). 새 수 없음
 */
export function gnsBlockOf(ctx, me) {
  const B = SECRET.gnsEnterBlock;
  if (!B || ctx?.ev !== 'enter' || ctx.fast) return false;
  if (B !== 2) return true;
  const foe = me.foe;
  const G = foe?.parryGuard;
  if ((G?.held && !G.broken) || foe?.aiCtl?.mode === 'defend') return 'cover';
  const t = foe?.tipPrev;
  const m = foe?.hitPointPrev;
  if (t && m && foeOnline({ tx: t.x, ty: t.y, tz: t.z, mx: m.x, my: m.y, mz: m.z }, me.bodies.chest.translation())) return 'cover';
  return true;
}

/** 고노센 들어옴 선 = 내 발도가 닿는 거리 — secretCond 의 발도 창 위 끝 그대로(맞닿기 + iaiStep + iaiMargin) · iai 0 이면 옛 창 위 끝(reach + japaneseReach + japaneseFar). view = { reach, contact } */
export function gnsEnterLine(view) {
  return SECRET.iai ? view.contact + SECRET.iaiStep + SECRET.iaiMargin : view.reach + SECRET.japaneseReach + SECRET.japaneseFar;
}

/**
 * 고노센 준비가 쌓이고 이어지는 '밖' (사람 · AI 같은 셈 — IaiArm.tick 의 outside — 10/25 22:3x 부터 SECRET.gnsReady 'dist' 판에서만 · 아래 gnsArmTick): 상대 칼 거리(view.foeReach) 밖.
 *  긴 칼 상대 규칙(long — SECRET.gnsLong, 제안 · 기본 끔): 상대 칼 거리 ≥ 내 발도가 닿는 거리(띠가 빈 짝 — 상대 칼 거리 밖에서는 발도가 안 닿음)면,
 *  이미 준비된 채로는 상대 가슴이 내 발도가 닿는 거리 밖에 있는 동안도 밖으로 친다 — 유예(iaiArmGrace)가 그 사이에서 다 지나 버리지 않고 들어옴 사건까지 이어짐.
 *  새로 준비를 쌓는 것은 그대로 상대 칼 거리 밖에서만. long 끔이면 d0 > foeReach 그대로(옛 셈)
 */
export function gnsOutside(d0, view, armed, long) {
  if (d0 > view.foeReach) return true;
  if (!long || !armed) return false;
  const L = gnsEnterLine(view);
  return view.foeReach >= L && d0 > L;
}

/** 비기 무장 시계를 아직 세지 않나 (10/27 23:0x 사장님 '고노센과 싱지르는 전투 시작 후, 실제 공격이 가능해진 때부터 시간을 카운트 해' — SECRET.armAtFight): 그 몸의 판 시작 정지(fighter.openHold) 동안. 끄면 늘 거짓(옛 판) */
export const armHold = (f) => !!SECRET.armAtFight && !!f?.openHold;

/**
 * 고노센 준비 한 스텝 (10/25 22:3x 사장님 '2] … 거리와 상관없이 '1.5초 동안 치지도 막지도 않고 침착하게 있으면 준비'로 바꾸는 것 이것도 좋다. 그렇게 바꿔.' ·
 *  '3] 시간도 1.5초에서 2초로' · 22:5x(감독 전달) '아무 행동 없이 2초' = 이동 입력도 없이 · '고노센은 일단 준비가 활성화되면 걸어도 준비가 유지돼' —
 *  SECRET.gnsReady · docs/strike/school_secret_2026-10-09.md §19). 사람 창(PlayerSecretWatch) · AI(ai.js) · AI 가 읽는 사람 준비(gnsWatch)가 같이 부른다.
 *  'idle'(기본): 거리와 상관없이 — unsettled(공격 · 막기 · 맞음 · 비기 — 부르는 쪽이 그 몸에 맞게 셈)면 곧장 풀림(유예 없음) · 준비가 아직이면 moving(이동 입력 — gnsMoving)도 셈을 0 으로 ·
 *   그 밖엔 iaiArmTime 초 쌓여 준비 · 준비된 뒤엔 걸어도(moving) 유지.
 *  'dist'(10/25 전 판 `?gnsReady=dist`): old = { outside, busy } 그대로 — 상대 칼 거리 밖(gnsOutside)에서 쌓이고 간격 안이면 iaiArmGrace 뒤 풀림 · 풀림은 그 판 몫(휘두름 · 비기 / AI 공격 · 막기 꼴)만.
 *  A = IaiArm (열쇠 iaiArmTime · iaiArmGrace). hold = 그 몸의 판 시작 정지(fighter.openHold — 10/27 23:0x) 동안이면 셈 0. 굴림 없음
 */
export function gnsArmTick(A, dt, unsettled, moving, old, hold = false) {
  if (hold) return A.tick(0, false, true); // 판 시작 정지 동안(fighter.openHold — 10/27 23:0x 사장님 '실제 공격이 가능해진 때부터 시간을 카운트') 셈 0 · 준비 아님 — 두 판 모두
  if (SECRET.gnsReady === 'dist') return A.tick(dt, old.outside, old.busy);
  A.tick(dt, true, !!unsettled || (!A.armed && !!moving));
}

/** 걷는 중인가 (고노센 준비 'idle' — 쌓는 동안만 셈을 0 으로): 이동 스틱 원값(사람 main.js · AI moveFeet 의 걸음 뜻 — 둘 다 stickX · stickY)이 0 이 아님. 새 문턱 없음 */
export function gnsMoving(f) {
  return Math.hypot(f?.stickX || 0, f?.stickY || 0) > 0;
}

/**
 * 사람 걸음 뜻 (고노센 준비 'idle' — 사람 창 · AI 가 읽는 사람 준비 gnsWatch 같은 셈 · 10/31 13:xx 사장님 '1-2번 다 고쳐' — SECRET.gnsStickWalk · docs/strike/gonosen_window_2026-10-31.md §10):
 *  스틱에 얹은 엄지가 가운데에서 데드존(6 px) 밖으로 조금 떠돌아도 걸음 뜻이 아님 — 스틱이 몸을 **걷게 할 때만** 걸음:
 *  스틱 값(데드존 뒤)을 몸이 가려는 빠르기로 바꿔(fighter.js 와 같은 몫 — 앞 1 · 뒤 GAIT.backFactor · 옆 GAIT.sideFactor × GAIT.moveSpeed × 유파 걸음 빠르기 gait P.speedMul)
 *  걸음 문턱 GAIT.walkMin(gait.js — 이보다 빨리 가려 해야 발을 떼어 걷는다)을 넘나. 새 수 없음. 끄면(0) gnsMoving 그대로(0 이 아니면 걸음). AI 자기 준비는 gnsMoving 그대로
 */
export function gnsHumanMoving(f) {
  if (!SECRET.gnsStickWalk) return gnsMoving(f);
  const x = f?.stickX || 0;
  const y = f?.stickY || 0;
  if (!x && !y) return false;
  const along = y * (y < 0 ? GAIT.backFactor : 1);
  return Math.hypot(along, x * GAIT.sideFactor) * GAIT.moveSpeed * (f.gait?.P?.speedMul || 1) > GAIT.walkMin;
}

/**
 * 사람 몸이 침착하지 않나 (고노센 준비 'idle' 의 unsettled — 사람 창 · AI 가 읽는 사람 준비 gnsWatch 같은 셈): 휘두름(skill.swinging) · 탭 찌르기 · 손잡이 찍기 · 비기 실행 ·
 *  막기 단추를 누름(parry_button.js held) · 맞음(hurt — 부르는 쪽이 아픔 +0.05 로 셈: AI '맞았나' 와 같은 수). 걷기는 gnsMoving 이 따로(쌓는 동안만). 새 수 없음
 */
export function gnsHumanUnsettled(f, hurt) {
  const sk = f.skill;
  return !!(sk?.swinging || sk?.tap || sk?.pom || sk?.sec) || !!f.parryGuard?.held || !!hurt;
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
//  10/22 이베리아 휘감아 돌기도 같은 셈 — 값 칸이 SECRET.ibSpin 안이라 group 'ibSpin' 으로 연다(new IaiArm('armTime', 'armGrace', 'ibSpin')). 열쇠 없이 부르면 전과 같다.
//  10/25 22:3x 일본 고노센 준비는 거리를 안 본다(SECRET.gnsReady 'idle' — gnsArmTick 이 outside 를 늘 참으로 · 풀림만 봄). 'dist' 판 · 길목 · 싱지르는 위 그대로.
export class IaiArm {
  constructor(timeKey = 'iaiArmTime', graceKey = 'iaiArmGrace', group = null) {
    this.t = 0;
    this.armed = false;
    this.timeKey = timeKey;
    this.graceKey = graceKey;
    this.group = group;
    this.ons = 0;
  }
  tick(dt, outside, busy) {
    if (busy) {
      this.t = 0;
      this.armed = false;
      return;
    }
    if (outside) {
      const V = this.group ? SECRET[this.group] : SECRET;
      this.t += dt;
      this.grace = V[this.graceKey];
      const was = this.armed;
      this.armed = this.t >= V[this.timeKey];
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
 *  [st.fwd 0.3 (talhoRodeado 와 같던 수 — 10/29 뒤 talhoRodeado 0.45 · 이 값은 0.3 칸 그대로), st.max 0.6 (japaneseStep)] 로 자름 — 기하로 정하는 값. 칼끝 앞 거리 = 덧씌우기 가운데 손 앞(SECRET.iaiPath.M.hand[0] 0.5) + 날 길이(weaponCfg.bladeLength).
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

/**
 * 독일 모르트슐라크 누르기 셈 (10/22 사람 — PlayerSecretWatch.pressTick · 10/24 AI — ai.js mordTick, 같은 셈 · 10/25 23:1x 끊김 너그러움 SECRET.mordGrace): st 의 pressT(지금 셈) · pressHeld(이 누르기 길이 — 너그러움으로 이은 것 포함) ·
 *  pressMax(가장 긴 누르기) · pressRuns(창까지 이어진 수)를 고친다. pressing = 밀치기 누르기(fighter.barge phase 'press') · busy = 비기 실행 · 굳음(셈 0) ·
 *  open = 창이 열려 있음(새 창 없음 — 셈은 이어짐) · need = 창까지 초(SECRET.mordPress). 창을 열 때면 셈 0 으로 하고 true
 *  step = 지금 밀치기가 딛는 단계(fighter.barge phase 'step')면 그 barge — 10/27 23:0x 사장님 '둘다 제안대로'(SECRET.mordStepPause): 끊긴 뒤 다시 시작한 밀치기의
 *   첫 걸음이 딛는 동안(걸음 시작부터 그 발이 땅에 닿아 누르기가 될 때까지)은 너그러움 시계를 멈춤 — 그 걸음 하나만(끝나거나 다른 걸음이면 다시 감 · 새 수 없음 — 걸음은 0.7 s 안팎에 닿음)
 */
export function pressStep(st, dt, pressing, busy, open, need, step = null) {
  if (pressing) {
    st.pressOff = 0;
    st.pauseStep = null;
    st.pauseDone = false;
    st.pressT = (st.pressT ?? 0) + dt;
    st.pressHeld = (st.pressHeld ?? 0) + dt;
    if (st.pressHeld > (st.pressMax ?? 0)) st.pressMax = st.pressHeld;
  } else if ((st.pressHeld ?? 0) > 0 && SECRET.mordStepPause && step && !st.pauseDone && (!st.pauseStep || st.pauseStep === step)) {
    st.pauseStep = step; // 다시 시작한 밀치기의 첫 걸음 — 너그러움 시계 멈춤(셈도 쥔 채 · 안 셈)
    st.pausedT = (st.pausedT ?? 0) + dt; // 재기: 멈춘 시간 합 (판정에는 안 씀)
  } else if ((st.pressHeld ?? 0) > 0 && (st.pressOff = (st.pressOff ?? 0) + dt) <= (SECRET.mordGrace ?? 0)) {
    // 너그러움 (10/25 23:1x 사장님 '리솔루토처럼 0.2초 안에 다시 붙으면 이어서 세' · 10/27 21:4x '0.2초 간격을 0.4초로 늘려' — SECRET.mordGrace · risolutoGrace 와 같은 틀): 끊긴 지 mordGrace 초 안이면 셈을 쥔 채 기다림(그동안은 안 셈)
    if (st.pauseStep) (st.pauseStep = null), (st.pauseDone = true); // 멈춘 걸음이 끝남(누르기가 아님 — 떨어짐 · 거절 등) — 그 뒤 걸음은 멈추지 않음
  } else st.pressT = st.pressHeld = st.pressOff = 0, (st.pauseStep = null), (st.pauseDone = false);
  if (busy) st.pressT = 0; // 비기 실행 · 굳음 동안은 세지 않는다 (끝난 뒤 다시 need 초)
  if (busy || open || !(st.pressT >= need)) return false;
  st.pressT = 0;
  st.pressRuns = (st.pressRuns ?? 0) + 1;
  return true;
}

/** 내 베기 사건 비기(combo·firstHit)의 거리: 이어 치기 거리 안 (ai.js secretCombo·secretFirstHit 와 같은 식) */
export function chainRange(d, view) {
  return d <= view.reach + 0.1 && d >= view.clinch - 0.5;
}

/**
 * 유파 비기 판당 쓸 수 (사장님 10/29 19:5x '비기는 쿨타임을 없애고 판당 1회만 쓸 수 있게 하자.(동방 격살은 3회)' · 19:4x 'AI의 모든 쿨타임은 사람과 맞춰.' — config UNIQUE_ASSIST.secretUses):
 *  그 몸 손에 든 무기 유파(swordArt.tradition)의 수 · 없으면 default · 표가 없으면 끝없음. 셈은 몸(fighter.secretUsed — 판마다 새 Fighter)에 — 사람 창(PlayerSecretWatch) · AI(ai.js) · AI 가 읽는 사람 고노센 준비(gnsWatch) 같은 칸
 */
export function secretUsesOf(f) {
  const U = UNIQUE_ASSIST.secretUses;
  if (!U) return Infinity;
  return U[f?.swordArt?.tradition] ?? U.default ?? Infinity;
}
/** 이 판에 남은 비기 수 */
export const secretLeft = (f) => Math.max(0, secretUsesOf(f) - (f?.secretUsed ?? 0));
/** 이 판 비기를 다 썼나 */
export const secretSpent = (f) => secretLeft(f) <= 0;
/** 비기가 나감 — 한 번 셈 (사람: PlayerSecretWatch.update 가 새 실행을 본 때 · AI: 비기 실행을 건 때) */
export function useSecret(f) {
  f.secretUsed = (f.secretUsed ?? 0) + 1;
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
    this.S = locked || !SECRET.openSchools.includes(me.swordArt?.tradition) ? null : playerSecretOf(me); // 10/21 닫힌 유파 비기 없음 (config SECRET.openSchools)
    this.sense = new Senses(me, foe);
    this.ev = { armed: true, off: 0 };
    this.open = null; // 열린 창 { S, ctx, t, age } — age = 열린 뒤 지난 시간 (secretHold)
    this.queued = null; // 미리 받은 입력으로 곧 낼 연환 { dir } (canBuffer — 중국 막기 연환, 10/12)
    this.combo = 0;
    this.binds = new BindCount(); // 이베리아 맺힘 셈 (10/10)
    this.iaiArm = new IaiArm(); // 일본 발도 대기 (10/10 02:4x — 플레이어는 표시만)
    this.gilArm = new IaiArm('gilmokArmTime', 'gilmokArmGrace'); // 이베리아 길목 지키기 준비 (10/11 v6 — 플레이어는 표시만, AI 와 같은 셈)
    this.gilWins = 0; // 길목 창 수 (재기)
    this.spinArm = new IaiArm('armTime', 'armGrace', 'ibSpin'); // 이베리아 휘감아 돌기 무장 (10/22 — 내 칼끝 거리 밖 SECRET.ibSpin.armTime 초, 발도 대기와 같은 셈) · 무장 동안 창이 열려 있다
    this.spinW = me.wounds?.length ?? 0; // 무장 동안 상처 셈 (SECRET.ibSpin.hurtDisarm)
    this.gap = Infinity; // 마지막 베기 끝에서 지난 시간
    this.swing = null; // 지금 베기 { first, landed }
    this.prevFoePain = foe.pain;
    this.opened = 0; // 창이 열린 수 (재기)
    this.riso = this.S?.when === 'risoluto' ? new RisolutoWatch(me, foe) : null; // 이탈리아 거침없이 나아가 찌르기 (10/22 — italian_risoluto.js)
    this.secRun = me.skill?.sec ?? null; // 지난 스텝의 비기 실행(me.skill.sec) — 새 실행이 보이면 그때 비기가 나간 것 (창을 만들 때 이미 돌던 실행은 이 창에서 나간 것이 아님)
    this.poor = { refused: 0, by: {}, step: 0, last: -9, steps: 0 }; // 기력이 0 이하라 거절한 창 · 내기 (10/30 08:2x — 재기 · 잇단 스텝 거절은 한 번)
  }

  /** 이 판에 남은 비기 수 (사장님 10/29 19:5x 판당 1회 · 동방 격살 3회 — UNIQUE_ASSIST.secretUses · 읽기만 · 재는 도구 · 앞으로 화면) */
  get left() {
    return secretLeft(this.me);
  }

  /** 2:2 (동시 대전 3단계 10/29): 상대를 하나 더 · 겨눈 상대 바꾸기 — 눈(Senses)만 상대마다 (ai_sense.js) · 창 걸쇠 · 셈은 내 몸의 것이라 그대로 */
  addFoe(f) {
    addFoeSense(this, f);
  }
  setFoe(f) {
    setFoeSense(this, f);
    if (this.riso && f) this.riso.foe = f; // 이탈리아 거침없이 나아가 찌르기도 지금 상대의 걸음을 본다
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
    // 비기 판당 쓸 수 (사장님 10/29 19:5x '비기는 쿨타임을 없애고 판당 1회만 쓸 수 있게 하자.(동방 격살은 3회)' — UNIQUE_ASSIST.secretUses · 10/29 17:5x 의 식힘 10 s 를 바꿈):
    //  비기가 나간 때(skill.secret 이 받아 me.skill.sec 에 새 실행이 걸린 때 — 창을 썼어도 skill.secret 이 받지 않았으면 아님) 한 번 셈(몸 fighter.secretUsed — 판마다 새 몸).
    //  다 쓰면 그 판엔 그 비기의 창 · 조건은 없는 것 = 비기가 도는 동안과 같은 '바쁨'(창을 새로 열지 않음 · 무장 · 누르기 셈 · 덮음 셈 · 격살 기다림이 안 걸림 · 고노센 웅크림도 풀림) — 공격 입력은 보통 공격
    const run = me.skill?.sec ?? null;
    if (run && run !== this.secRun) useSecret(me);
    this.secRun = run;
    if (secretSpent(me)) {
      busy = true;
      this.open = null; // 다 쓴 판엔 창이 없음 (보통 길에선 이미 닫혀 있음 — fire 가 닫고 냄)
      this.queued = null;
    }
    // 기력이 0 이하 (사장님 10/30 08:2x '기력이 모자라면 못써(다른 비기도 그렇게 해)' · 18:3x '0 이하' — SECRET.secretStamina · stamina.secretReady): 창이 안 열림(openWindow 가 거절) · 열린 창도 닫힘 —
    //  아무것도 안 나가고 판당 쓸 수도 안 씀. 무장 · 누르기 셈 · 덮음 셈은 그대로 (기력이 차면 다음 창)
    this.poor.step++;
    if (!me.stamina?.secretReady) {
      this.poor.steps++;
      if (this.open) this.refusePoor(this.open.ctx);
      this.open = null;
      this.queued = null;
    }
    recordFoeSenses(this, dt); // 1:1 = this.sense.record(dt) 그대로 (2:2 는 상대마다 — setFoe)
    if (this.open) {
      this.open.age = (this.open.age ?? 0) + dt;
      if ((this.open.t -= dt) <= 0 && !this.holding()) this.open = null; // 창 끝 (secretHold: 열린 뒤 playerWindow 초까지는 짧은 창도 지킴)
    }
    const S = this.S;
    const painUp = foe.pain > this.prevFoePain + 0.05;
    this.prevFoePain = foe.pain;
    const hurt = me.pain > (this.prevMyPain ?? me.pain) + 0.05; // 내가 맞음 (고노센 준비 'idle' 풀림 — AI '맞았나' 와 같은 셈 · 10/25 22:3x)
    this.prevMyPain = me.pain;
    if (!S || !me.alive || !foe.alive || !me.armed || me.state !== 'stand') {
      this.open = null; // 몸이 비기를 낼 수 없음(skill.secret 이 받지 않는 몸 — 내가 넘어짐 · 죽음 · 칼 없음 · 상대 죽음) — secretHold 도 지키지 않음
      this.queued = null;
      this.swing = null;
      this.combo = 0;
      this.iaiArm.tick(0, false, true);
      if (S?.do?.instant && (SECRET.gnsCrouch || SECRET.gnsReadyHip)) iaiReadyPosePlayer(me, false, true, dt, !SECRET.gnsCrouch); // 웅크림 · 허리 대기도 풀림 (손 · 칼은 곧장 · 몸은 gnsCrouchOut)
      this.gilArm.tick(0, false, true);
      this.spinArm.tick(0, false, true);
      if (this.pc) this.pc.pend = this.pc.buf = null;
      this.riso?.reset();
      return;
    }
    if (this.riso) return this.risoTick(dt, busy); // 이탈리아 거침없이 나아가 찌르기: 덮인 채 나아가기만 본다 (상대 사건 · 내 베기 사건 없음)
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
    if (S.when === 'gyeoksal') this.gyeoksalTick(dt, touch, sw || !!me.skill.tap, busy); // 동방 막아 죽이기 (10/22 — 막기 단추 · 때맞춤 · 스틱 앞)
    if (S.when === 'parry') this.parryTick(dt, BIND.natural ? bindTouch(me, foe) : touch, sw || !!me.skill.tap, s0, c, d0, V, busy); // 막기 연환 (10/11) · 자연 바인드 실험이면 넓은 맞부딪힘도 (bindTouch)
    if (S.when === 'bindCount') this.binds.tick(dt, touch);
    if (S.when === 'press') this.pressTick(dt, busy);
    // 고노센 준비 (10/25 22:3x · 22:5x 사장님 '거리와 상관없이 … 아무 행동 없이 2초' · '준비가 활성화되면 걸어도 유지' — gnsArmTick 'idle'): 휘두름 · 탭 · 손잡이 찍기 · 비기 · 막기 단추 · 맞음이면 풀림 ·
    //  준비 전엔 이동 입력도 셈을 0 으로 · 'dist'(10/25 전 판) = 상대 칼 거리 밖(긴 칼 상대 규칙 gnsLong 이 아니면 d0 > foeReach 그대로) · 휘두름 · 비기만 풀림
    if (S.do?.instant) gnsArmTick(this.iaiArm, dt, gnsHumanUnsettled(me, hurt) || busy, gnsHumanMoving(me), { outside: gnsOutside(d0, V, this.iaiArm.armed, SECRET.gnsEnter && SECRET.gnsLong), busy: sw || busy }, armHold(me)); // 판 시작 정지 동안 셈 0 (10/27 23:0x)
    // 웅크림 (10/25 23:0x 사장님 '플레이어도 고노센 준비가 되면 웅크리게 해.' — SECRET.gnsCrouch · secret_instant.js iaiReadyPosePlayer): 준비된 동안 AI 와 같은 발도 대기 자세 ·
    //  칼을 쥐면(손가락 움직임 · 막기 단추 · 휘두름) 손 · 칼은 곧장 사람 것 — 몸 웅크림은 그대로 · 0 이면 '고노센 준비' 표시만(전 판)
    //  10/31 허리 대기 (사장님 08:xx '웅크리기를 없앴더니 고노센 발동창이 안열려.' — SECRET.gnsReadyHip · 웅크림 0 일 때): 몸은 선 채 손 · 칼만 왼 허리 발도 대기 —
    //   칼을 쥠 = 손가락이 닿은 자리에서 길게 누름 한도(INPUT.holdPx)를 넘게 끌었음(main.js handGrip — 얹은 손가락의 떨림 · 떠돎은 쥠이 아님) · 막기 단추 · 휘두름. 손가락 몸이 없으면(시뮬 · 마우스) 손가락 움직임 그대로
    if (S.do?.instant && SECRET.iai && SECRET.gnsCrouch) iaiReadyPosePlayer(me, this.iaiArm.armed && !busy, !!me.inputActive || !!me.parryGuard?.held || sw, dt);
    else if (S.do?.instant && SECRET.iai && SECRET.gnsReadyHip) iaiReadyPosePlayer(me, this.iaiArm.armed && !busy, !!(me.handGrip ?? me.inputActive) || !!me.parryGuard?.held || sw, dt, true);
    if (S.do?.gilmok) {
      const was = this.gilArm.armed;
      this.gilArm.tick(dt, d0 > gilmokLine(me, V.reach, S.do), sw || busy || armHold(me)); // 길목: 내 칼끝 거리 밖 (일본은 상대 칼 닿는 거리 밖) · 판 시작 정지 동안 셈 0 (10/27 23:0x — 싱지르와 같은 무장 시계)
      this.gilmokRest(dt, was, s0, c, d0, V, sw || busy);
    }
    if (S.do?.spin) this.spinTick(dt, d0, V, busy, sw);
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
    const enter = SECRET.gnsWalkIn && SECRET.gnsEnter && S.do?.instant ? { enterLine: gnsEnterLine(V), iaiArmed: V.armed } : null; // 일본 들어옴 (10/25 — 발도 대기인 채 상대가 내 발도가 닿는 거리를 넘어 듦) · 10/25 22:3x 들어옴 창 gnsWalkIn 0(기본 — 사장님 입력 글에 없음)이면 안 봄
    const { on, ctx } = secretEvent(S, this.sense, foe, s0, c, r, d0, V.foeReach, me, { reach: S.do?.gilmok ? gilmokLine(me, V.reach, S.do) : V.reach, dt, st: E, armed: this.gilArm.armed, ...enter }); // ex: 이베리아 호 안쪽 (reach · 머문 시간) · 길목 (준비) · 일본 들어옴
    // 고노센 든 칼 이어 봄 (10/31 — SECRET.gnsRaiseLatch · 사장님 확인 전): 준비된 채 상대가 발도가 닿는 거리 밖에서 칼을 들었으면(창 없음) 그 들기를 playerWindow 초 붙잡아,
    //  그 사이 상대가 그 칼로 내 발도 선 안에 들면 그때 창(같은 '듦' 창) — 선 밖에서 시작해 들어오며 치는 칼도 '내 간격에서 공격을 시도'로 셈. 새 수 없음(창 길이 그대로) · 끄면 이 몫 없음
    if (E.latch) {
      E.latch.t += dt;
      if (E.latch.t > SECRET.playerWindow || !V.armed || this.open || s0.state !== 'stand') E.latch = null;
      else if (secretCond(S, E.latch.ctx, d0, V)) {
        const lc = { ...E.latch.ctx, latched: +E.latch.t.toFixed(3) };
        E.latch = null;
        E.armed = false;
        return this.openWindow(lc, SECRET.playerWindow);
      }
    }
    if (!on) {
      E.off += dt;
      if (E.off > EV_REARM) E.armed = true;
      return;
    }
    E.off = 0;
    if (!E.armed || s0.state !== 'stand' || this.open) return;
    if (!secretCond(S, ctx, d0, V)) {
      if (SECRET.gnsRaiseLatch && S.do?.instant && ctx?.ev === 'raise' && V.armed && !E.latch) E.latch = { ctx, t: 0 }; // 위 — 든 칼 이어 봄
      return;
    }
    E.armed = false;
    if (ctx?.ev === 'gilmok') {
      this.gilArm.consume(); // 한 번 준비에 한 번 기회 — 창을 놓치면 다시 간격 밖에서 준비해야 한다
      this.gilWins++;
    }
    this.openWindow(ctx, ctx?.ev === 'enter' && SECRET.gnsEnterWindow > 0 ? SECRET.gnsEnterWindow : SECRET.playerWindow); // 여쭘 A (10/25 08:0x · 기본 0 = 다른 창과 같은 playerWindow): 들어옴 창만 짧게
  }

  /**
   * 독일 죽음의 일격 (10/29 20:0x 부터 기본 'close' — 몸이 붙은 채(가슴 사이 ≤ n) 2 s · 아래 코드 · SECRET.mordRule. 이 아래 글은 옛 'press' 판):
   *  옛 판 — 독일 죽음의 일격 (10/22 사장님 '막기로 버틸 때나 서로 몸이 맞붙어 클린치 상태일 때 밀기가 n초 이상 작동하면 발동' · '1.5로 해' — mordschlag.js):
   *  밀치기 누르기(fighter.closeStep 의 barge phase 'press' — 가슴 사이 CLOSE.reach 안에서 상대 쪽으로 미는 동안 · 10/25 23:3x 부터 놓았다 밀 것 없음 CLOSE.latch 0)가 cond.press 초(SECRET.mordPress — 10/25 23:1x 2 s)
   *  이어지면 창(playerWindow)을 연다. 누르기가 끝나면(떨어짐 · 스틱 놓음 · 팔 다 펴짐 · 베기 · 넘어짐) SECRET.mordGrace(10/27 21:4x 0.4 s) 안에 다시 누르면 셈을 이어감 · 넘으면 셈 0 · 창을 열면 셈 0(계속 누르면 다시 cond.press 초 뒤 또 창).
   *  비기 실행 · 굳음 동안은 셈 0. 상대가 막는 중이든 몸만 붙었든 같다. 새 값 없음(누르기 판정은 밀치기 그대로). 재기: pressT(지금 셈) · pressRuns(창까지 이어진 수) · pressMax(가장 긴 누르기)
   *  셈은 pressStep(위 — 10/24 AI 와 같이 씀 · ai.js mordTick)
   */
  pressTick(dt, busy) {
    const me = this.me;
    if (SECRET.mordRule === 'press') {
      const b = me.barge;
      if (pressStep(this, dt, b?.phase === 'press', busy, !!this.open, secretVal(this.S.cond.press), b?.phase === 'step' ? b : null)) this.openWindow({ ev: 'press', held: this.pressHeld });
      return;
    }
    // 'close' (10/29 20:0x 사장님 — SECRET.mordRule): 몸이 붙어 있음 = 가슴 사이 ≤ mordCloseN(0.8 m 모든 무기 — 10/30 00:4x 사장님 · null 이면 밀치기가 닿는 거리 CLOSE.reach) · 나 · 상대 서 있음 — 밀치기 꼴 · 스틱 · 긋기와 상관없이.
    //  셈 · 너그러움(mordGrace) · 창은 같은 pressStep(첫 걸음 멈춤 mordStepPause 는 밀치기 걸음 몫이라 안 씀)
    const n = SECRET.mordCloseN ?? CLOSE.reach(me.armed ? me.weapon : null);
    const foe = this.foe;
    const close = me.state === 'stand' && foe.alive && foe.state === 'stand' && me.foeDistance() <= n;
    if (pressStep(this, dt, close, busy, !!this.open, secretVal(this.S.cond.press), null)) this.openWindow({ ev: 'press', held: this.pressHeld, close: true });
  }

  /**
   * 이베리아 휘감아 돌기 무장 (10/22 — schools.js IBERIAN_SECRET_SPIN): 상대 가슴이 내 칼끝 거리(reach) 밖에 SECRET.ibSpin.armTime 초 머물면 무장(발도 대기 IaiArm 과 같은 셈 —
   *  휘두르거나 비기 중이면 풀림 · 간격 안으로 들어와도 armGrace 초 남음). 무장이 이어지는 동안 창이 열려 있다(끝 없음 — 금색 '!' · 비기 이름 알림) → 공격 입력으로 원 한 바퀴
   *  (10/24 공격 원 판 기본 — 아래 spinCircle) · 이동 스틱 반 바퀴(10/23 스틱 판 'stick' — 아래 spinStick) · 옛 판(SECRET.ibSpin.input 'attack')은 공격 입력 하나가 휘감아 돌기.
   *  hurtDisarm: 무장 동안 내 몸에 상처가 나면 곧장 풀림(발도 대기에 없는 규칙 — 스위치). 창을 쓰면(fire) 무장도 풀린다 — 한 번 무장에 한 번
   */
  spinTick(dt, d0, V, busy, sw = false) {
    const me = this.me;
    const nw = me.wounds?.length ?? 0;
    const hurt = !!SECRET.ibSpin.hurtDisarm && nw > this.spinW;
    this.spinW = nw;
    // 공격 원 판 (10/24 — SECRET.ibSpin.input 'attackCircle'): 원을 그리는 손은 칼을 휘두른다 — 무장된 동안은 휘두름을 그 획이 끝날 때(손가락을 떼거나 멈춤 ·
    //  circleTime 초가 지남) 센다: 그 획이 원이 되면(spinCircle → fire) 무장은 비기로 쓰이고, 안 되면 그때 풀린다(보통 공격 — 스틱 판과 같은 규칙). 무장 전에는 전처럼 곧장 셈을 비운다
    let swing = sw;
    if (SECRET.ibSpin.input === 'attackCircle' && this.spinArm.armed) {
      if (sw) this.circSwung = true;
      const live = !!this.circ && circleLive(this.circ, SECRET.ibSpin.circleTime);
      swing = !!this.circSwung && !live;
      if (!live) this.circSwung = false;
    } else this.circSwung = false;
    this.spinArm.tick(dt, d0 > V.reach, busy || swing || hurt || armHold(me)); // 판 시작 정지 동안 셈 0 (10/27 23:0x 사장님 '전투 시작 후, 실제 공격이 가능해진 때부터')
    const o = this.open;
    if (this.spinArm.armed) {
      if (!o && !busy) this.openWindow({ ev: 'spin' }, Infinity);
    } else if (o?.ctx?.ev === 'spin' && !this.holding()) this.open = null; // 무장이 풀림 (secretHold: 열린 뒤 playerWindow 초는 지킴)
  }

  /** 이베리아 휘감아 돌기 창이 스틱 판인가 (SECRET.ibSpin.input 'stick') — 참이면 그 창은 공격 입력으로 나가지 않는다(공격은 보통 공격 · main.js) */
  stickOwns() {
    return SECRET.ibSpin.input === 'stick' && this.open?.ctx?.ev === 'spin';
  }

  /** 싱지르 창이 공격 원 판인가 (10/24 — SECRET.ibSpin.input 'attackCircle') — 참이면 그 창은 톡 · 끌기 하나로 나가지 않는다(원이 아닌 공격은 보통 공격 · main.js) */
  circleOwns() {
    return SECRET.ibSpin.input === 'attackCircle' && this.open?.ctx?.ev === 'spin';
  }

  /**
   * 싱지르 공격 원 판 (10/24 사장님 02:5x '커맨드를 방향키 말고 공격 동작 360도 원형 입력으로 변경' — main.js 가 프레임마다 부른다):
   *  무장 창이 열려 있고 낼 수 있는 동안(can — 스틱 판과 같은 조건) 이 프레임의 공격 손 움직임 d(input.consumeHandDelta — 손 m) · 손가락이 닿아 있나(down — 마우스는 늘)를 읽어
   *  최근 SECRET.ibSpin.circleTime 초 안에 원을 한 바퀴(그 길의 가운데 둘레로 360° · 반지름 circleR 이상) 그렸으면 참(그 스텝에 fire() → skill.secret).
   *  창이 없거나 · 낼 수 없거나 · 다른 판이면 셈을 비우고 거짓. 몸짓 셈 = src/attack_circle.js (순수 함수). 참이면 창 ctx 에 그린 쪽 turnDir(+1 반시계 · −1 시계 — 몸이 그쪽으로 돈다)
   */
  spinCircle(dt, d, down, can) {
    const st = (this.circ ??= circleState());
    if (!can || !this.circleOwns()) {
      circleClear(st);
      st.t += dt;
      return false;
    }
    const V = SECRET.ibSpin;
    const go = circleStep(st, dt, d.x, d.y, down, { time: V.circleTime, need: 2 * Math.PI, rMin: V.circleR, gap: V.circleGap, inner: V.circleInner });
    if (go) {
      this.open.ctx = { ...this.open.ctx, turnDir: st.sgn };
      this.circleFires = (this.circleFires ?? 0) + 1;
    }
    return go;
  }

  /**
   * 이베리아 휘감아 돌기 스틱 판 (10/23 사장님 '공격 버튼 대신 이동 버튼을 360도 돌린다거나' · '한 바퀴로 하지 말고 반 바퀴 이상으로' — main.js 가 프레임마다 부른다):
   *  무장 창이 열려 있고 낼 수 있는 동안(can — 공격 입력 길과 같은 조건: 기력 · 굳음 · 비기 중 아님 · 살아 있음) 이동 스틱 m(input.move)을 읽어
   *  최근 SECRET.ibSpin.stickTime 초 안에 어느 쪽으로든 stickTurn° 돌았으면 참(그 스텝에 fire() → skill.secret — 공격 입력 길과 같은 함수).
   *  창이 없거나 · 낼 수 없거나 · 'attack' 판이면 셈을 비우고 거짓. 몸짓 셈 = src/stick_turn.js (순수 함수).
   *  참이면 창 ctx 에 돌린 쪽 turnDir(+1 반시계 · −1 시계)을 적는다 — 몸이 그쪽으로 돈다(10/23 사장님 '조이스틱 회전에 따라 반대로도' · SECRET.ibSpin.reverse)
   */
  spinStick(dt, m, can) {
    const st = (this.turn ??= stickTurnState());
    if (!can || !this.stickOwns()) {
      stickTurnClear(st);
      return false;
    }
    const V = SECRET.ibSpin;
    const go = stickTurnStep(st, dt, m.x, m.y, { time: V.stickTime, need: (V.stickTurn * Math.PI) / 180, path: !!V.stickPath, rate: !!V.stickRate, from: !!V.stickFrom });
    if (go) this.open.ctx = { ...this.open.ctx, turnDir: st.sgn }; // 돌린 쪽 (+1 = 반시계 = 몸이 왼쪽으로 · −1 = 시계 = 오른쪽으로 — iberian_spin.js requestSpin want)
    return go;
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
      if ((P.woundAge === 0 || (S.cond.window === 'bind' && !touch)) && !this.holding()) this.open = null; // 뚫림 · 독일: 칼이 떨어짐 (secretHold: 열린 뒤 playerWindow 초는 지킴)
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
    if (!(foeRecentTipSp(this.sense, RECENT) >= 3.5)) return void (P.rejSlow = (P.rejSlow ?? 0) + 1);
    if (P.woundAge < RECENT) return void (P.rejHurt = (P.rejHurt ?? 0) + 1);
    P.ok++;
    P.inParry = true;
    const slot = parrySlotOf(S, null, [me.handOffset.x, me.handOffset.y], me.swordArt?.school?.parry, P.lineAge < RECENT ? P.line : null);
    if (!slot) return;
    P.slot++;
    P.pend = { slot, t: 0 };
  }

  /**
   * 동방 막아 죽이기 (격살 · 10/22 — schools.js CHINESE_SECRET_GYEOKSAL · SECRET.gyeoksal · docs/strike/chinese_gyeoksal_2026-10-22.md). 플레이어만 (main.js · 시뮬 도구가 부른다).
   *  ① 때맞춤: 막기 단추(me.parryGuard — parry_button.js)를 새로 누른 뒤 SECRET.gyeoksal.press 초 안에 칼끼리 새로 닿음 (닿는 그 순간 단추를 쥐고 있어야 — held · broken 아님)
   *  ② 앞으로: 그 순간 이동 스틱이 상대 쪽 — 근접 밀치기의 '밂'과 같은 가름 stickY > |stickX| (docs/strike/shove_design_2026-09-30.md 트리거)
   *  ③ 받은 자세: 막기 단추가 막는 중이면 그 줄(defLine), 기다림이면 닿은 순간 손(패드)에서 가장 가까운 막기 자리(0.15 안 — parrySlotOf 와 같은 폭) → cond.stances.
   *     스킬트리 동방 막기 I(C7 — 자리 + 몸꼴)이 없으면(무유파 자리) 동방 자세가 아니라 창 없음
   *  ④ 받아 냄: 그 공격이 나를 베지 못함 — 상대 칼이 들어오던 중(지난 0.6 s 칼끝 ≥ 3.5 m/s — 막기 연환과 같은 셈)이고, 닿기 전 0.6 s · 닿아 있는 동안 내 칼날 상처가 없고,
   *     칼이 떨어지는 순간 창(SECRET.playerWindow) — 그동안 온 공격 입력은 미리 받아 둔다(canBuffer · SECRET.cnBuffer). 내가 휘두르거나 찌르면(단추가 풀림) 취소.
   *  재기: pc.gk = { edges, busy, atk, noPress, late, notFwd, slow, hurt, noStance, pend, cut, open, stance: {거정 …}, by: { line, pad } } (판정에는 안 씀)
   */
  gyeoksalTick(dt, touch, attacking, busy) {
    const me = this.me;
    const S = this.S;
    const G = me.parryGuard;
    const P = (this.pc ??= { prev: false, nw: me.wounds?.length ?? 0, woundAge: Infinity, pend: null, pressAge: Infinity, held: false });
    const K = (P.gk ??= { edges: 0, noPress: 0, late: 0, notFwd: 0, slow: 0, hurt: 0, atk: 0, noStance: 0, pend: 0, cut: 0, open: 0, stance: {}, by: { line: 0, pad: 0 } });
    const nw = me.wounds?.length ?? 0;
    P.woundAge = nw > P.nw ? 0 : P.woundAge + dt;
    P.nw = nw;
    const held = !!G?.held;
    P.pressAge = held && !P.held ? 0 : P.pressAge + dt; // 새 누름부터 센다 (떼면 더 늘기만)
    P.held = held;
    const start = touch && !P.prev;
    const sep = !touch && P.prev;
    P.prev = touch;
    if (P.buf && (P.buf.t += dt) > secretVal(S.cond.time)) {
      P.buf = null; // 미리 받은 입력: 칼이 붙은 채 창 길이보다 오래면 버린다 (막기 연환과 같은 꼴 — 떨어지면 창은 열린다)
      P.bufDrop = (P.bufDrop ?? 0) + 1;
    }
    if (this.open?.ctx?.ev === 'gyeoksal' && P.woundAge === 0 && !this.holding()) this.open = null; // 창이 열린 뒤 베이면 닫힘 (막기 연환과 같음 · secretHold: 열린 뒤 playerWindow 초는 지킴)
    if (P.pend) {
      if (P.woundAge === 0 || attacking) {
        if (P.woundAge === 0) K.cut++;
        P.pend = P.buf = null; // 뚫림(받아 내지 못함) · 내가 공격 — 창 없음
      } else if (sep) {
        if (!busy && !this.open && this.openWindow({ ev: 'gyeoksal', slot: P.pend.stance, stance: P.pend.stance, line: P.pend.line, by: P.pend.by }, SECRET.playerWindow)) { // 기력이 모자라면 창 없음 (10/30 08:2x)
          K.open++;
          K.stance[P.pend.stance] = (K.stance[P.pend.stance] ?? 0) + 1;
          if (P.buf) (this.queued = P.buf), (P.bufFired = (P.bufFired ?? 0) + 1); // 미리 받은 입력 → 이 스텝 곧장 (main.js 가 update 뒤에 fire)
          else if (SECRET.gyeoksal.auto) (this.queued = { dir: null, auto: true }), (K.auto = (K.auto ?? 0) + 1); // 10/24 사장님: 받아 내면 저절로 — 스틱 앞(조건 ②)이 곧 입력 · 겨눌 곳은 받은 자세가 정함
        }
        P.pend = P.buf = null;
      }
    }
    if (!start) return;
    K.edges++;
    if (busy) return void (K.busy = (K.busy ?? 0) + 1); // 내 비기가 도는 중 (그 칼이 상대 칼에 닿음)
    if (attacking) return void K.atk++;
    if (!held || G.broken) return void K.noPress++;
    if (!(P.pressAge <= SECRET.gyeoksal.press)) return void K.late++;
    if (!(me.stickY > Math.abs(me.stickX))) return void K.notFwd++;
    if (!(foeRecentTipSp(this.sense, RECENT) >= 3.5)) return void K.slow++;
    if (P.woundAge < RECENT) return void K.hurt++;
    const st = this.gyeoksalStance(G);
    if (!st) return void K.noStance++;
    K.pend++;
    K.by[st.by]++;
    P.pend = { stance: st.stance, line: st.line, by: st.by, t: 0 };
  }

  /** 격살 받은 자세 { stance, line, by: 'line' | 'pad' } 또는 null — 막기 단추가 막는 중이면 그 줄, 아니면 손에서 가장 가까운 막기 자리(0.15 안). 동방 막기 I(C7) 없음 = null */
  gyeoksalStance(G) {
    const me = this.me;
    const map = this.S.cond.stances;
    const school = me.swordArt?.school;
    if (!school || me.schoolParry === false || kitOff(me, 'parryCover')) return null;
    if (G?.mode === 'defend' && map[G.defLine]) return { stance: map[G.defLine], line: G.defLine, by: 'line' };
    const h = [me.handOffset.x, me.handOffset.y];
    let best = null;
    let bd = 0.15; // parrySlotOf 의 패드 폭 (v5 · v6 '이미 그 자세' 판정 — 새 값 아님)
    for (const ln of Object.keys(map)) {
      const p = school.parry?.[ln];
      if (!p) continue;
      const d = Math.hypot(h[0] - p[0], h[1] - p[1]);
      if (d <= bd) (bd = d), (best = ln);
    }
    return best ? { stance: map[best], line: best, by: 'pad' } : null;
  }

  /**
   * 미리 받기 (10/12 사장님 01:1x '그런 공격을 운 좋게 막아도 인간 반사신경으로 커맨드 넣기 어려웠어' — SECRET.cnBuffer, docs/strike/cn_combo_play_2026-10-12.md §4):
   *  중국 막기 연환(window 'apart')에서 정한 자세로 막아 칼이 맞닿아 있는 동안(pend) 온 공격 입력(톡·빠른 끌기 — main.js 의 비기 입력과 같은 문턱)을 취소 대신 받아 둔다.
   *  그동안 그 입력은 보통 공격으로 새지 않는다(main.js 가 칼 입력을 삼킴 — bufferHold). 칼이 떨어지는 스텝에 창이 열리며 곧장 연환(내는 순간은 떨어진 뒤 — '떨어짐' 그대로).
   *  창 길이(cond.time)보다 오래 붙어 있으면 버린다. 새 값 없음. 플레이어만 (AI 는 창 없이 곧장 — 전과 같음)
   */
  canBuffer() {
    const P = this.pc;
    return !!(SECRET.cnBuffer && ((this.S?.when === 'parry' && this.S.cond?.window === 'apart') || this.S?.when === 'gyeoksal') && P?.pend && !P.buf && !this.open && !this.queued); // 격살(10/22)도 같은 미리 받기
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

  /**
   * 이탈리아 거침없이 나아가 찌르기 (10/22 — italian_risoluto.js RisolutoWatch): 덮인 채 나아가기가 risolutoHold 초 이어지거나(두 번째 길: 그러던 중 상대 박자)
   *  창(playerWindow)을 연다. 창이 열린 동안 내가 베기를 시작하면(손 휘두르기 · 긋기) 창을 닫는다 — 덮음을 버리고 벤 것이라 [해석]. busy(비기 실행 중) = 셈을 새로
   */
  risoTick(dt, busy) {
    const R = this.riso;
    if (busy) return void R.reset();
    if (this.open && (this.me.skill?.swinging || this.me.stamina?.stroke?.paid)) {
      if (!this.holding()) this.open = null;
      else R.swingHeld = (R.swingHeld ?? 0) + 1; // 재기: secretHold 가 지킨 스텝 (내 휘두름 — 10/25 부터 끌기도 비기 입력이라 그 프레임에 나감)
    }
    // 런지 간격 조건 (10/24 13:2x 사장님 '간격이 약간 있어야 쓸 수 있게 해 너무 가까우면 못쓰게' — italian_risoluto.js lungeGap): 가슴 사이가 런지 최소 간격보다 가까우면
    //  창 조건이 차도 창을 열지 않고(금색 '!' 없음 — 재기 gapBlocked) · 열린 창은 닫는다(재기 gapClosed). 창이 없으니 그때의 탭은 보통 탭 찌르기 (main.js)
    //  10/25 21:0x secretHold(기본): 열린 창은 playerWindow 초 동안 닫지 않음(재기 gapHeld — 그 사이 비기를 내면 런지 몸 미끄러짐 0 · secret_instant.js comboMoveStart)
    const gapOk = lungeGapOk(this.me);
    if (this.open && !gapOk) {
      if (this.holding()) {
        if (!this.open.gapShort) (this.open.gapShort = true), (R.gapHeld = (R.gapHeld ?? 0) + 1);
      } else {
        this.open = null;
        R.gapClosed = (R.gapClosed ?? 0) + 1;
      }
    }
    const ctx = R.tick(dt, !this.open);
    if (ctx && !gapOk) R.gapBlocked = (R.gapBlocked ?? 0) + 1;
    else if (ctx) this.openWindow(ctx);
  }

  /** 창을 연다 — 기력이 0 이하면 열지 않고 false (사장님 10/30 08:2x '기력이 모자라면 못써' — SECRET.secretStamina) */
  openWindow(ctx, t = SECRET.playerWindow) {
    if (!this.me.stamina?.secretReady) return this.refusePoor(ctx);
    this.open = { S: this.S, ctx, t, age: 0 };
    this.opened++;
    return true;
  }

  /** 기력이 모자라 거절 (재기 poor.refused — 잇단 스텝 거절은 한 번 · 갈래 by[ctx.ev]) · false */
  refusePoor(ctx) {
    const P = this.poor;
    if (P.last < P.step - 1) {
      P.refused++;
      const k = ctx?.ev ?? 'window';
      P.by[k] = (P.by[k] ?? 0) + 1;
    }
    P.last = P.step;
    return false;
  }

  /**
   * 창 지킴 (사장님 10/25 21:0x '비기 발동창이 열리면 어떻게 상황이 변하더라도 최소 0.6초는 열린 상태를 유지해서 비기가 나갈 수 있도록 해' — SECRET.secretHold):
   *  열린 창이 열린 뒤 SECRET.playerWindow 초가 안 됐으면 참 — 그동안은 창을 연 조건이 바뀌어도(간격 · 내 휘두름 · 무장 풀림 · 칼 떨어짐 · 베임) 닫지 않는다.
   *  몸이 비기를 낼 수 없는 때(update 첫머리 — 내가 넘어짐 · 죽음 · 칼 없음 · 상대 죽음)는 이것과 상관없이 닫는다. `?secretHold=0` = 전
   */
  holding() {
    return !!SECRET.secretHold && !!this.open && (this.open.age ?? 0) < SECRET.playerWindow - 1e-6; // 1e-6: 스텝 시간 더하기의 떠다니는 소수 (창 끝과 같은 스텝에 닫히게)
  }

  /** 창 안의 공격 입력: 열린 창을 닫고 그 비기 { S, ctx } 를 돌려준다 (없으면 null) */
  fire() {
    if (this.open && !this.me.stamina?.secretReady) {
      // 기력이 0 이하 (10/30 08:2x · 18:3x — 창이 열린 뒤 이번 스텝 전에 모자라졌음): 창을 닫고 null (main.js 는 그 입력을 보통 공격으로)
      this.refusePoor(this.open.ctx);
      this.open = null;
      this.queued = null;
      return null;
    }
    if (this.riso && this.open && !lungeGapOk(this.me) && !this.holding()) {
      // 런지 간격 조건 (10/24 13:2x): 창이 열린 뒤 이번 물리 스텝 전에 간격이 모자라졌으면 비기가 아님 — 창을 닫고 null (main.js 는 그 탭을 보통 탭 찌르기로) · secretHold 동안은 비기
      this.open = null;
      this.riso.gapClosed = (this.riso.gapClosed ?? 0) + 1;
      return null;
    }
    const o = this.open;
    this.open = null;
    if (o && this.queued) o.dir = this.queued.dir; // 미리 받은 입력의 끌기 방향
    this.queued = null;
    if (o) {
      this.combo = 0;
      this.binds.reset(); // 비기를 내면 0
      if (o.ctx?.ev === 'spin') this.spinArm.consume(); // 휘감아 돌기: 한 번 무장에 한 번 (10/22)
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
    if (!this.me.stamina?.secretReady) return this.refusePoor({ ev: 'gilmokArmed' }) || null; // 기력이 모자람 (10/30 08:2x) — 준비는 그대로 · 이 입력은 보통 공격
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
  return playerSecretDef(f.swordArt?.tradition); // 사람 비기 판 (10/22 — 이탈리아는 거침없이 나아가 찌르기 · schools.js playerSecretDef)
}

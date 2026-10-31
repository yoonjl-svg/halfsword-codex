// ─────────────────────────────────────────────────────────────
//  special_balance.mjs — 유파 특수 공격 다섯(+ 일본 손목 치기) 세기 견줌 (사장님 10/27 22:4x '특수 공격들끼리 밸런스가 맞나' · 기록 docs/strike/special_balance_2026-10-27.md)
//   재기만 한다 — 게임 값은 건드리지 않는다. 사람 몸(0 번 자리)을 손가락 봇이 긋는다(schielhau_strike.mjs playerRun · tsubameRun · playerFight 꼴을 다섯 유파로 넓힘).
//   줄(row): german 곁눈 베기(롱소드 · 분노의 베기) · italian 위에서 내려 찌르기(레이피어 · 황소 찌르기) · iberian 머리 위 돌려 베기(츠바이핸더 · 왼 가로베기 + 곧장 되긋기)
//            japanese 제비 베기(우치가타나 · 정수리 내려베기 → 곧장 위로) · kote 손목 치기(우치가타나 · 긴 자세에서 짧게 내려베기) · chinese 허리 베기(환도 · 가로베기)
//   변형: on = 그 특수 공격을 연 판 · off = 같은 손가락 입력, 그 특수 공격만 닫음(바탕 동작 그대로 — '바탕 견줌')
//   drill = 서 있는(still) · 걷는(walk — 칼을 아래에 둔 채 걷기만 하는 AI) 상대 · 시도 = 그 특수 공격의 손가락 입력 한 번(제비 베기 · 돌려 베기는 두 획)
//           맞는 쪽 상처는 몸에 안 걸고(통증만 — 앞 칼이 맞았나 '빗나감' 판단은 게임 그대로) 무릎 꿇기 · 칼 떨굼은 굴림만 세고 몸엔 안 검 → 시도마다 같은 몸 (고른 견줌)
//           씨앗마다 앞 FIRST 시도만(지치기 전). 상처마다 '새 몸이었다면' 갈래: 즉사(목 > 0.5 · 머리 베기 > 0.8 · 찌르기 > 0.5) · 칼 놓침(칼 팔 심각도 ≥ 1.21) · 깊음(≥ 1.0)
//   fight = 사람 손가락 봇 대 치고 막는 AI(숙련 PROF) · 30 s · 상대 OPPS × 씨앗 × 반응 지연(0.12 · 0.22 s — 10/20 실험과 같음)
//           봇: 칠 때 SHARE 몫은 특수 공격 입력 · 나머지는 다른 기본 긋기(15 % 탭 찌르기 · 30 % 되긋기) · 상대 칼이 빠르게 오면 지연 뒤 COUNTER 몫은 특수 입력으로 맞받고 나머지는 막기 단추
//           on = 그 유파 고유 공격 모두 연 판(스킬트리 다 익힌 사람) · off = 그 특수 공격만 닫음
//   손가락 흔들림(사람 손): 시작 자리 가우스 σ = SJIT 패드 m(기본 0.06 — 자세 패드 반경 0.15 안 약 96 %) · 길 점 ± JIT 0.04 · 빠르기 3 ~ 5.5 패드 m/s
//   ease = 손가락 입력만 기하로(물리 없음): 시작 자리 σ 여럿에서 그 입력이 특수 공격으로 읽히는 몫 (classifyStroke · 방향 조건 — unique_assist.js 와 같은 규칙)
//  사용법: node tools/sim/special_balance.mjs drill|fight|ease [--rows=german,italian,...] [--foes=still,walk] [--seeds=12] [--first=5] [--dur=14]
//          [--opps=longsword,uchigatana,zweihander] [--fseeds=901,902,903,904] [--delays=0.12,0.22] [--prof=3] [--sjit=0.06] [--variants=on,off] [--json=파일]
//          node tools/sim/special_balance.mjs agg <json ...>  (drill · fight 결과를 표로)
//          node tools/sim/special_balance.mjs reach [--rows=italian,italianTap,german] [--seeds=4]  (칼끝 ↔ 상대 가슴 · 머리 가장 가까운 거리 — 서 있는 상대)
//   10/28 (docs/strike/imbroccata_2026-10-27.md · cavazione_2026-10-28.md · lianchi_2026-10-28.md · duplieren_2026-10-28.md): --set=UNIQUE_ASSIST.imbroReach=0,… = 게임 값 바꿔 견줌(전 판) ·
//    탭 특수 공격 줄 cavTap(막아찌르기 실패 → 탭) · lianTap(물러나며 탭) · dupTap(맞물린 채 탭) — cavBot · drill --helm=1 = 투구 쓴 상대 · 머리 표(head) · 유파 패시브 실린 맞음(spIndes) ·
//    drill 상대 guard = 칼끝을 내게 겨눈 긴 자세 · guardHigh = 칼끝을 든 가운데 자세 · 첫 특수 맞음 손목(wrist_audit wristSample) · 틈 파고들기(I8 — 내려 찌르기 찌른 상처) · 끌고 간 칼 재기(지난 길이 · 칼 높이각) · 맞은 점 높이(dy)
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, DT, CONFIG, AI, THREE } from './harness_m.mjs';
import { applyWeaponMeasure } from './weapon_measures.mjs';
import { strokeTechOf, PlayerUniqueAssist, PLAYER_UNIQUE } from '../../src/unique_assist.js';
import { TECH, TECH_BY_NAME, G as PAD } from '../../src/ai_techniques.js';
import { TRADITIONS } from '../../src/schools.js';
import { MEASURED } from '../../src/weapon_measured.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { classifyStroke } from '../../src/attack_stroke.js';
import { isMain } from './is_main.mjs';
import { applyB4Old } from '../../src/config.js';
if (+(process.env.B4_OLD ?? 0)) applyB4Old(true); // B4 옛 판 견줌 (10/31 19:xx — `?b4Old=1` 과 같음)
if (process.env.B4_ANGLE) CONFIG.UNIQUE_ASSIST.rdTajo = { ...CONFIG.UNIQUE_ASSIST.rdTajo, angle: +process.env.B4_ANGLE }; // B4 벰 면 각 견줌 (45 ~ 90)
import { wristSample, outOfRange, OOR_EPS, ROLL_AT } from './wrist_audit.mjs';

const UA = CONFIG.UNIQUE_ASSIST;
const T = (n) => ({ from: TECH_BY_NAME[n].from, path: TECH_BY_NAME[n].path });
const TSU = (() => {
  const u = TRADITIONS.japanese.unique.find((x) => x.name === 'tsubameGaeshi');
  return { from: u.from, path: u.path }; // 정수리 내려베기 두 점 → 곧장 위로 두 점 (schielhau_strike.mjs COMBO 와 같음)
})();
const ZW_BACK = { from: PAD.sideR, path: [[0.0, 0.1], PAD.sideL] }; // 왼 가로베기 뒤 곧장 되긋기 (돌려 베기 뒷몫 — 박자 창 chainWait 안)
/** 줄: 유파 · 무기(커먼) · 특수 공격 이름 · 바탕 동작(off 에서 같은 입력이 내는 것) · 손가락 획들(chain = 앞 획에 멈춤 없이 이어 그음) · 제비 베기 아래 획 바탕 이름 */
export const ROWS = {
  german: { trad: 'german', w: 'longsword', name: 'schielhau', base: 'zornhau', ko: '곁눈 베기', strokes: [T('zornhau')] },
  italian: { trad: 'italian', w: 'rapier', name: 'imbroccata', base: 'stichOchs', ko: '위에서 내려 찌르기', strokes: [T('stichOchs')] },
  // 10/28 탭으로 내는 특수 공격 (사장님 10/28 01:2x — cavBot): cavTap = 막기 단추 새 누름(막아찌르기) → 상처를 못 냈으면 끝난 때부터 0.65 ~ 1.05 s 뒤 탭 ·
  //  lianTap = 스틱 뒤 0.15 ~ 0.35 s → 물러나는 채 · 놓고 곧 탭 · dupTap = 분노의 베기 긋기 → 맞물려 칼이 닿은 동안 탭
  cavTap: { trad: 'italian', w: 'rapier', name: 'cavazione', base: 'tap', ko: '칼끝 돌려 빼기 (막아찌르기 빗나감 → 탭)', strokes: [], cav: 'tap' },
  lianTap: { trad: 'chinese', w: 'hwando', name: 'lianchi', base: 'tap', ko: '날개 접기 (물러나며 탭)', strokes: [], lian: true },
  dupTap: { trad: 'german', w: 'longsword', name: 'duplieren', base: 'zornhau', ko: '겹치기 (긋기 맞물림 → 탭)', strokes: [], dup: true, cut: T('zornhau') },
  iberian: { trad: 'iberian', w: 'zweihander', name: 'redondo', base: 'zwerchL', ko: '머리 위 돌려 베기 (10/29 전 판 — 사람 강화동작 · 지금은 AI 몫만)', strokes: [T('zwerchL'), { ...ZW_BACK, chain: true }] },
  // 10/29 풍차 베기 (이베리아 B4 특수 공격 — 사장님 10/29 · rdBot): 칼끝 거리 + startAdd 안에서 탭을 길게 누름 → 감는 동안 앞으로 걸음 → 상대 가슴이 releaseAt(맞닿기 ~ 칼끝 거리 + 0.15) 안이고
  //  (반은) 한 바퀴 넘게 돈 뒤 뗌 · 4 s 넘으면 뗌 · combo 몫은 앞 칼(1 ~ 2 이어 긋기) 끝 0.05 ~ 0.25 s 안에 누름(이어 긋기 사슬 안)
  rdHold: { trad: 'iberian', w: 'zweihander', name: 'redondo', base: 'tap', ko: '풍차 베기 (길게 눌러 돌리다 뗌)', strokes: [], rd: true, startAdd: 0.9 },
  japanese: { trad: 'japanese', w: 'uchigatana', name: 'tsubameGaeshi', base: 'oberhau', ko: '제비 베기', strokes: [TSU], combo: true },
  kote: { trad: 'japanese', w: 'uchigatana', name: 'kote', base: 'langortDown', ko: '손목 치기', strokes: [{ from: PAD.langort, path: [[0.02, -0.22]] }] },
  chinese: { trad: 'chinese', w: 'hwando', name: 'yaoji', base: 'zwerch', ko: '허리 베기', strokes: [T('zwerch')] },
  // 견줌 줄: 허리 베기를 앞으로 미는 스틱 0.45 안에서만 (걸음 명령 '앞' 문턱 0.5 아래 — 끌어 딛고 허리 베기에 밀리지 않는 손)
  chineseLight: { trad: 'chinese', w: 'hwando', name: 'yaoji', base: 'zwerch', ko: '허리 베기 (스틱 가볍게)', strokes: [T('zwerch')], fwdCap: 0.45 },
  // 견줌 줄 (특수 공격 아님): 레이피어 탭 찌르기 — 이탈리아 사람이 실제로 많이 쓰는 바탕 공격 (skill.js thrust · 이탈리아 찌르기 런지 THRUST.itLunge)
  italianTap: { trad: 'italian', w: 'rapier', name: 'tap', base: 'tap', ko: '탭 찌르기 (견줌)', strokes: [], tap: true },
  // 10/31 이탈리아 자리 바꿈 (docs/strike/italian_swap_2026-10-31.md — fight 만): cavTouch = 칼끝 돌려 빼기(I2 기본 기술) — 공격은 탭 찌르기 · 맞받기는 막기 단추를 쥠 · 칼끼리 새 닿음을 느끼면
  //  (85 %) 그 닿음 처음부터 0.25 ~ 0.95 s 뒤 탭(사람 반응 — 창 0.2 ~ 1.2 s 를 모르는 손) / inqVoid = 비껴서며 찌르기(I9 특수 공격) — 상대 칼이 오는 걸 본 맞받기(counter 몫)에서 스틱을 옆(±0.9 · 0.4 s)으로 밀고 0.03 ~ 0.11 s 뒤 탭 ·
  //  공격은 다른 기본 긋기. off = 그 기술만 닫음(같은 손 — 보통 탭 찌르기 · 옆걸음). 판마다 it 칸: 닿음 · 셈 밖(내 긋기 동안) · 탭 · 맞받기마다 받은 상처(0.6 s 안) · 넘어짐
  cavTouch: { trad: 'italian', w: 'rapier', name: 'cavazione', base: 'tap', ko: '칼끝 돌려 빼기 (칼끼리 닿음 → 탭 · 10/31)', strokes: [], touch: true },
  inqVoid: { trad: 'italian', w: 'rapier', name: 'inquartata', base: 'tap', ko: '비껴서며 찌르기 (공격해 올 때 옆 + 탭 · 10/31)', strokes: [], inq: true },
};

const p50 = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor((s.length - 1) / 2)];
};
const RD_COMBO = +(process.env.RD_COMBO ?? 0.5); // 풍차 베기 시도 가운데 이어 긋기 사슬 안에서 누르는 몫 (rdBot · 10/29)
// 10/31 19:xx B4 옆걸음 판 (사장님 '살짝 사선이어야 … 사이드 스텝 밟으면서 발동해서 더 잘 맞출 수 있어'): RD_SIDE=1 이면 뗄 때가 되면 먼저 스틱을 옆(무작위 왼 · 오른 — 이베리아 옆 박차기 B2)으로 밀고
//  RD_SIDE_LEAD 실제 초 뒤에 뗌 · 뗀 뒤 0.12 게임 초까지 옆걸음 이어감 (기본 0 = 전과 같음 — 난수 수도 같음)
const RD_SIDE = +(process.env.RD_SIDE ?? 0);
const RD_SIDE_LEAD = CONFIG.realS(+(process.env.RD_SIDE_LEAD ?? 0.2));
const RD_HELD = +(process.env.RD_HELD ?? 1); // 풍차 베기 누름 동안 손가락 닿음(handHeld) — 게임과 같음 (10/29 20:0x · RD_HELD=0 = 10/29 판 봇: 누르는 동안 손가락이 안 닿은 것으로 셈)
const OTHER_RD = ['zornhau', 'zwerch', 'zornhauL', 'oberhau'].map((n) => ({ from: TECH_BY_NAME[n].from, path: TECH_BY_NAME[n].path }));
const APPR = CONFIG.SKILL.recoverSpeed; // 1.2 패드 m/s — 손가락으로 자세를 잡는 빠르기 (게임의 자세로 돌아가기와 같은 수)
const r3 = (x) => (x == null || !isFinite(x) ? null : +x.toFixed(3));
const LOW = [0, -0.5];
const GUARD = [0, 0.03]; // 긴 자세 (ai_techniques.js G.langort — 칼끝을 상대 가슴으로)
const GUARD_HIGH = [0, 0.25]; // 칼끝을 든 가운데 자세 (짧은 칼이 그 칼 밑으로 다가가 긋기가 칼에 부딪히는 판 — 날개 접기 · 10/28)
function holdLow(f, xy) {
  f.handOffset.set(xy[0], xy[1]);
  const sk = f.skill;
  for (const k of ['prev', 'aim', 'aimRaw', 'anchor']) sk[k]?.set(xy[0], xy[1]);
  for (const k of ['aimVel', 'vel', 'follow']) sk[k]?.set(0, 0);
}
/** 칼을 아래에 둔 채 걷기만 하는 AI (치지도 막지도 않음 — schielhau_strike.mjs LowFoe 와 같음) */
class LowFoe extends AI {
  startAttack() {
    return false;
  }
  respond() {
    return false;
  }
  moveHand() {
    this.me.handOffset.set(LOW[0], LOW[1]);
  }
}
/** 맞는 순간 놓인 칼의 날 맞춤 cos (schielhau_strike.mjs edgeOf 와 같음) */
function edgeOf(f) {
  const v = f.hitPointVel;
  if (!v || !f.sword) return null;
  const r = f.sword.rotation();
  const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
  const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const ed = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const p = v.clone().addScaledVector(ax, -v.dot(ax));
  const pl = p.length();
  return pl > 1e-3 ? p.dot(ed) / pl : null;
}
// 10/29 특수 공격 진단 (사장님 '쓸 기회가 없거나 잘 안 맞는거지 공격력이 약한거니?'): 내 칼날 ↔ 상대 몸 콜라이더 겉 거리 (duplieren_check.mjs segCol 과 같은 셈 — 음수 = 닿음)
const _V = (p) => new THREE.Vector3(p.x, p.y, p.z);
const _Q = (q) => new THREE.Quaternion(q.x, q.y, q.z, q.w);
function segPoint(a, b, p) {
  const u = b.clone().sub(a);
  const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(u) / Math.max(1e-9, u.lengthSq())));
  return a.clone().addScaledVector(u, t).distanceTo(p);
}
function segCol(a, b, col) {
  const sh = col.shape;
  const ct = _V(col.translation());
  const cq = _Q(col.rotation());
  if (sh.type === 0) return segPoint(a, b, ct) - sh.radius;
  if (sh.type === 2) {
    const ax = new THREE.Vector3(0, sh.halfHeight, 0).applyQuaternion(cq);
    let m = Infinity;
    for (let i = 0; i <= 10; i++) m = Math.min(m, segPoint(ct.clone().sub(ax), ct.clone().add(ax), a.clone().lerp(b, i / 10)));
    return m - sh.radius;
  }
  if (sh.type === 1) {
    const he = sh.halfExtents;
    const inv = cq.clone().invert();
    let best = Infinity;
    for (let i = 0; i <= 10; i++) {
      const q = a.clone().lerp(b, i / 10).sub(ct).applyQuaternion(inv);
      const qx = Math.abs(q.x) - he.x, qy = Math.abs(q.y) - he.y, qz = Math.abs(q.z) - he.z;
      best = Math.min(best, Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0));
    }
    return best;
  }
  return Infinity;
}
/** 내 칼날 ↔ 상대 몸 가장 가까운 겉 거리 (m) · 그 몸 이름 */
function bodyGap(P, D) {
  if (!P.sword || !D?.bodies) return { gap: Infinity, part: null };
  const b0 = P.bladePoint(0, new THREE.Vector3()), b1 = P.bladePoint(1, new THREE.Vector3());
  let gap = Infinity, part = null;
  for (const [n, b] of Object.entries(D.bodies)) {
    const col = b?.collider?.(0);
    if (!col) continue;
    const g = segCol(b0, b1, col);
    if (g < gap) (gap = g), (part = n);
  }
  return { gap, part };
}
const SWORD_ARM = new Set(['uarmS', 'farmS']);
const DISARM_SEV = (1 - CONFIG.VITALS.dropSwordArm) / 0.7; // fighter.js applyWound: 칼 팔 기능 −= 심각도 × 0.7 → dropSwordArm 아래면 칼 놓침
/** 새 몸이었다면 이 상처 하나로: 'kill' 즉사(fighter.js applyWound 치명상 문턱) · 'disarm' 칼 놓침 · 'deep' 심각도 ≥ 1 · null */
function freshOutcome(r, part) {
  const sev = r.severity ?? 0;
  if (r.type === 'blunt' || !(sev > 0)) return null;
  if (r.zone === 'neck' && sev > 0.5) return 'kill';
  if (r.zone === 'head' && ((r.type === 'cut' && sev > 0.8) || (r.type === 'stab' && sev > 0.5))) return 'kill';
  if (SWORD_ARM.has(part) && sev >= DISARM_SEV) return 'disarm';
  if (sev >= 1) return 'deep';
  return null;
}
/** 걸음 (내 무기 간격 띠 — schielhau_strike.mjs 손가락 봇 꼴 + 칠 차례면 칼끝 거리 startAt 안으로 들어감): 긋는 동안 맞닿기 밖이면 앞으로 ·
 *  칠 차례인데 startAt 밖이면 앞으로 · 맞닿기 + 0.1 안이면 뒤로 · 칼끝 거리 + 0.25 밖이면 앞으로 (칼끝 거리 = weapon_measured.js 둘째 수) */
function stepIn(P, dist, stroking, ready, CONTACT, REACH, startAt) {
  if (P.stamina.exhausted || !P.alive) return 0;
  if (stroking && dist > CONTACT) return 0.6;
  if (ready && dist > startAt) return 0.5;
  if (dist < CONTACT + 0.1) return -0.55;
  if (dist > REACH + 0.25) return 0.45;
  return 0;
}
/** 시드 난수 (LCG — schielhau_strike.mjs 와 같은 꼴) · 가우스 */
function rng(seed) {
  let rs = seed >>> 0;
  const rnd = () => (rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296;
  rnd.gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  return rnd;
}

/** 손가락 봇 (프레임 = 2 스텝 · main.js 와 같은 차례: feed → 손 목표에 더함) */
function fingerBot(G, P, rnd, { sjit, jit, spd }) {
  const FRAME = 2 * DT;
  const B = { queue: [], fx: P.handOffset.x, fy: P.handOffset.y, step: 0 };
  const to = (p, vel, held) => {
    const fr = [];
    let x = B.fx;
    let y = B.fy;
    for (let k = 0; k < 400; k++) {
      const dx = p[0] - x;
      const dy = p[1] - y;
      const d = Math.hypot(dx, dy);
      if (d < 1e-6) break;
      const st = Math.min(d, vel * FRAME);
      x += (dx / d) * st;
      y += (dy / d) * st;
      fr.push([(dx / d) * st, (dy / d) * st, held]);
    }
    B.fx = x;
    B.fy = y;
    return fr;
  };
  /** 획들 → 프레임: 첫 획은 시작 자리(+ 가우스 흔들림)로 1.6 패드 m/s(손 뗌) · 4 프레임 멈춤 · 길 점마다 ± jit · chain 획은 멈춤 없이 이어 그음 */
  B.make = (strokes, { back = false, v = null } = {}) => {
    B.fx = P.handOffset.x; // 사람은 칼이 지금 어디 있는지 본다 (자세로 돌아가던 손 자리부터)
    B.fy = P.handOffset.y;
    const vel = v ?? spd[0] + rnd() * (spd[1] - spd[0]);
    const fr = [];
    B.marks = [];
    B.fed = 0;
    strokes.forEach((s, i) => {
      if (!s.chain || i === 0) {
        const f0 = [s.from[0] + rnd.gauss() * sjit, s.from[1] + rnd.gauss() * sjit];
        fr.push(...to(f0, APPR, false)); // 자세로 옮김은 휘두르기 문턱(SKILL.swingSpeed 1.5) 아래 — 옮기는 손이 긋기로 읽혀 따로 맞히지 않게
        fr.push(...Array(4).fill([0, 0, false]));
      }
      for (const p of s.path) {
        fr.push(...to([p[0] + (rnd() * 2 - 1) * jit, p[1] + (rnd() * 2 - 1) * jit], vel, true));
        B.marks.push(fr.length); // 길 점마다 그 점에 닿는 프레임 (제비 베기 '빗나감' 판이 아래 획 끝을 읽음)
      }
    });
    if (back) {
      const s = strokes[0];
      fr.push(...Array(3).fill([0, 0, true]));
      fr.push(...to(s.from, vel, true));
    }
    fr.push(...Array(6).fill([0, 0, false]));
    return fr;
  };
  B.feed = () => {
    if ((B.step++ & 1) !== 0) return;
    const f = B.queue.shift() ?? [0, 0, false];
    B.fed++;
    const u = P.skill.uniq;
    u?.feed(f[0], f[1], FRAME, false);
    if (!(u ? (u.holdsHand ?? u.running) : false)) {
      P.handOffset.x += f[0];
      P.handOffset.y += f[1];
    }
    P.handHeld = f[2] || (RD_HELD && !!B.hold); // 풍차 베기 길게 누름 동안 손가락이 닿아 있음 (게임 main.js handHeld = activeTouch — 10/29 20:0x: 전엔 거짓이라 쉼 자세 · 휘청이 게임과 달랐음)
    if (Math.abs(f[0]) + Math.abs(f[1]) > 1e-5) P.inputActive = true;
  };
  return B;
}

/** 고유 공격 강화가 긋기마다 남기는 기록(긋기 시작 = detect 의 cur)을 모은다 — 끝난 뒤에도 다음 긋기 전까지 landed · bound 가 갱신되므로 끝에 읽는다 */
function strokeLog(uq) {
  const log = [];
  if (!uq?.list?.length) return log;
  const det = uq.detect.bind(uq);
  uq.detect = (...a) => {
    const before = uq.cur;
    const r = det(...a);
    if (uq.cur && uq.cur !== before) log.push(uq.cur);
    return r;
  };
  return log;
}

/** 시도 기록 하나에 상처 r 을 더함 */
function addHit(a, r, part, P, name) {
  const sev = r.type === 'blunt' ? 0 : r.severity ?? 0;
  const tech = strokeTechOf(P) ?? (name === 'tap' && P.skill?.tap ? 'tap' : null);
  const bleed = sev * (r.bleedPerSev ?? 0) * (r.type === 'stab' ? 1.6 : 1); // fighter.js applyWound 출혈 (초당 피 몫 — 허리 베기 몸통 × 1.5 가 여기 실림)
  const h = { type: r.type, zone: r.zone, part, sev: r3(sev), bleed: r3(bleed), energy: r3(r.energy), tech, edge: r3(edgeOf(P)), stack: P.skill?.uniq?.stackN ?? 0, out: freshOutcome(r, part), sk: r3(r.schoolK ?? 1), helm: !!r.helmet }; // sk = 유파 패시브 배율(인데스 · 켄타이 — combat.js schoolK) · helm = 투구가 받은 맞음
  // 10/28: 첫 특수 맞음 손목 (wrist_audit 잣대) · 끌고 가는 칼 맞음인가 · 위에서 내려 찌르기 찌른 상처 = 틈 파고들기(I8 — combat.js gap) 걸림
  if (tech === name && !a.hits.some((x) => x.tech === name)) {
    const ws = wristSample(P);
    h.w = ws ? { oor: r3(outOfRange(ws)), roll: r3(ws.roll), fe: r3(ws.fe), dev: r3(ws.dev), elbowUp: r3(ws.elbowUp) } : null;
  }
  h.snap = !!P.iai;
  if (P.ibFlowK) { h.ibK = r3(P.ibFlowOn ? P.ibFlowK() : 1); h.ibN = P.ibStrike?.n ?? (P.ibFlowOn ? P.ibCutN ?? 0 : 0); } // 흐르는 긋기 위력 · 이어 그은 수 (10/29 — 이베리아)
  if (P.iai?.artReach) h.reach = { over: r3(P.iai.overshoot), el: r3(P.iai.artReach.el), dX: r3(P.iai.artReach.dX) };
  if (tech === 'imbroccata' && r.type === 'stab') h.gap = 1;
  a.hits.push(h);
  a.sev += sev;
  a.bleed = (a.bleed ?? 0) + bleed;
  if (tech === name) a.sevSp += sev;
}

/** 탭으로 내는 특수 공격 손 (10/28 01:2x 사장님 조건 — 줄 cavTap · lianTap · dupTap): start() = 첫 입력 · step() 마다 · done 이면 끝.
 *  cav = 막기 단추를 한 번 새로 누름(막아찌르기 I6 — 짧게) → 그 막아찌르기가 끝났을 때 상처를 못 냈으면(lastEnd.dealt 거짓) 끝난 때부터 cavFrom + 0.05 ~ + 0.45 s 에 탭(막기 시계) · 냈으면 끝
 *  lian = 스틱을 뒤로 0.15 ~ 0.35 s → 반은 물러나는 채 탭 · 반은 놓고 0.05 ~ 0.4 s 뒤 탭
 *  dup = 사선 내려 긋기 → 그 긋기 기록이 맞물렸고 칼이 아직 닿아 있으면 0.03 ~ 0.15 s 뒤 탭(닿은 동안) · 안 맞물리고 긋기가 끝나면 끝 */
function cavBot(G, P, uq, bot, rnd, R, guard) {
  const UAc = CONFIG.UNIQUE_ASSIST;
  const c = { stage: 'idle', bound: 0, second: 0, stick: null, press: false };
  c.start = () => {
    c.cool = null; // 탭을 낸 때 식힘 중이었나 (10/29 진단)
    c.bound = 0;
    c.second = 0;
    c.rec = null;
    c.t1 = G.t;
    c.stick = null;
    if (R.cav) {
      c.stage = guard && !guard.held ? 'press' : 'done';
      c.press = c.stage === 'press';
      c.runSeen = false;
    } else if (R.lian) {
      c.stage = 'back';
      c.backEnd = G.t + 0.15 + rnd() * 0.2;
      c.hold = rnd() < 0.5;
      c.stick = -0.8;
    } else if (R.dup) {
      bot.queue = bot.make([R.cut]);
      c.stage = 'cut1';
      c.endT = null;
    } else if (R.rd) {
      const [CONTACT, REACH] = MEASURED[R.w] ?? MEASURED.longsword;
      c.releaseAt = CONTACT + rnd() * (REACH + 0.15 - CONTACT);
      c.minTurns = rnd() < 0.5 ? 1 : 0; // 반은 한 바퀴 넘게 돌린 뒤 (흐르는 긋기 셈 — IB_FLOW.windmillChain)
      c.stage = c.pre ? 'rdPre' : 'rdPress';
      c.stick = 0.6;
      c.rr = { pre: !!c.pre, gap: null, inWin: null, tip: [], tip0: null }; // 'inside' 닿음 재기 (10/29 감독): 누름 시작 ↔ 마지막 진짜 긋기 끝 · 누름 첫 0.6 s 칼끝 빠르기
      if (c.pre) {
        bot.queue = bot.make(c.pre);
        c.pre = null;
      }
    }
  };
  c.step = () => {
    if (c.sideEnd != null && G.t > c.sideEnd) (c.side = 0), (c.sideEnd = null), (c.sideAt = null); // 옆걸음 판 끝 (RD_SIDE)
    if (c.stage === 'rdPre') {
      // 앞 칼(이어 긋기)이 끝나면 0.05 ~ 0.25 s 안에 누름 — 이어 긋기 창(0.6 s) 안
      if (bot.queue.length) return;
      c.preEnd ??= G.t + 0.05 + rnd() * 0.2;
      if (G.t < c.preEnd) return;
      c.stage = 'rdPress';
      c.t1 = G.t;
    }
    if (c.stage === 'rdPress') {
      const dist = P.foeDistance();
      const W = P.rdWind;
      if (c.rr && c.rr.gap == null) {
        c.rr.gap = (P.ibFlowT ?? 0) - (P.ibFlowCutEnd ?? -9); // 누름 시작 = 마지막 진짜 긋기 끝에서 (s — 게임 초)
        c.rr.inWin = c.rr.gap <= UAc.afterWindow; // 이어 긋기 창(0.6 s) 안에서 누름 = 'inside' 가 닿는 자리
        c.rr.chainN = P.ibFlowChainNow?.() ?? -1;
      }
      if (c.rr && !uq.winding && uq.hold?.st === 'press') {
        const tp = P.bladePoint(1, new THREE.Vector3());
        if (c.rr.tip0) c.rr.tip.push(tp.distanceTo(c.rr.tip0) / DT);
        c.rr.tip0 = tp;
      }
      if (c.rr && uq.winding && !c.rr.done) {
        c.rr.done = true;
        (uq.stats.rdReach ??= []).push({ pre: c.rr.pre, gap: r3(c.rr.gap), inWin: c.rr.inWin, chainN: c.rr.chainN, tipP50: r3(p50(c.rr.tip)), tipMax: r3(Math.max(0, ...c.rr.tip)), still: c.rr.tip.length ? r3(c.rr.tip.filter((v) => v < 1.5).length / c.rr.tip.length) : null });
      }
      uq.holdInput(true, true, false);
      bot.hold = true; // 손가락이 닿아 있음 (feed → handHeld)
      c.stick = dist < (MEASURED[R.w] ?? MEASURED.longsword)[0] + 0.1 ? 0 : 0.6;
      if (uq.winding) c.bound = 1;
      let go = uq.winding && dist <= c.releaseAt && (W?.turns ?? 0) >= c.minTurns;
      if (RD_SIDE && uq.winding && (go || c.sideAt != null)) {
        // 옆걸음 판: 뗄 때가 되면 옆으로 먼저 딛고 RD_SIDE_LEAD 뒤에 뗌 (다가가기 스틱은 멈춤)
        if (c.sideAt == null) (c.sideAt = G.t), (c.side = rnd() < 0.5 ? -1 : 1);
        c.stick = 0;
        go = G.t - c.sideAt >= RD_SIDE_LEAD;
      }
      if (go || (uq.winding && G.t - c.t1 > 4) || (!uq.winding && G.t - c.t1 > UAc.rdHoldTime + 0.3)) {
        if (c.sideAt != null) c.sideEnd = G.t + 0.12;
        uq.holdInput(false, true, false);
        bot.hold = false;
        c.second = uq.winding ? 1 : 0;
        c.stage = 'tap2';
        c.t2 = G.t;
        c.stick = null;
      }
      return;
    }
    const O = guard?.opposition;
    if (c.stage === 'press') {
      // 새 누름 한 스텝 → 놓음 (막아찌르기는 놓아도 마침)
      if (O?.run) c.runSeen = true;
      if (G.t - c.t1 > 2 * DT) c.press = false;
      if (c.runSeen && !O.run) {
        const E = O.lastEnd;
        if (E && !E.dealt) {
          c.bound = 1;
          c.stage = 'wait';
          c.fireAt = E.t + UAc.cavFrom + 0.05 + rnd() * 0.4;
        } else c.stage = 'done';
      } else if (!c.runSeen && G.t - c.t1 > 0.2) c.stage = 'done'; // 막아찌르기가 안 남(몸이 바쁨 등)
      return;
    }
    if (c.stage === 'back') {
      if (G.t < c.backEnd) return;
      c.bound = 1;
      if (c.hold) {
        c.cool = (uq.coolLeft?.(R.name) ?? 0) > 0;
        P.skill.thrust(); // 물러나는 채 탭
        c.stick = null;
        c.stage = 'tap2';
        c.second = 1;
        c.t2 = G.t;
      } else {
        c.stick = null;
        c.stage = 'wait';
        c.fireAt = uq.t + 0.05 + rnd() * 0.35;
      }
      return;
    }
    if (c.stage === 'cut1') {
      if (!c.rec && uq?.cur?.kind === 'cut') c.rec = uq.cur;
      // 10/31 겹치기 재기 손잡이 (기본 = 전 판): SP_DUP_ANY=1 이면 맞물림이 아니어도 칼끼리 닿으면 · SP_DUP_DELAY='0.2,0.3' = 사람 반응 늦음(실제 s — 기본 0.03 ~ 0.15)
      const dupAnyBot = process.env.SP_DUP_ANY === '1';
      if ((dupAnyBot || c.rec?.bound) && uq.bladeTouch()) {
        c.bound = 1;
        c.stage = 'wait';
        const DD = (process.env.SP_DUP_DELAY || '0.03,0.15').split(',').map(Number);
        c.fireAt = uq.t + DD[0] + rnd() * (DD[1] - DD[0]);
      } else if (!bot.queue.length && uq?.cur !== c.rec) {
        c.endT ??= G.t;
        if (G.t - c.endT > 0.3) c.stage = 'done'; // 긋기가 끝나도 0.3 s 는 맞댐을 봄 (맞물린 채 멈춘 칼)
      }
      return;
    }
    if (c.stage === 'wait') {
      const now = R.cav ? guard.clock : uq.t;
      if (now < c.fireAt) return;
      c.second = 1;
      c.cool = (uq.coolLeft?.(R.name) ?? 0) > 0;
      P.skill.thrust();
      c.stage = 'tap2';
      c.t2 = G.t;
    } else if (c.stage === 'tap2') {
      if (P.skill.tap || P.iai || bot.queue.length || G.t - c.t2 < 0.05) return;
      c.stage = 'done';
    }
  };
  c.busy = () => c.stage === 'press' || c.stage === 'back' || c.stage === 'cut1' || c.stage === 'wait' || c.stage === 'tap2' || c.stage === 'rdPre' || c.stage === 'rdPress';
  return c;
}

/** 풍차 베기 감기 기록 (10/29 — unique_assist.js holdTick stats): 감기 · 냄(뗌 · 기력 바닥) · 그만둠 까닭 · 돈 바퀴 · 이어 그은 수 n(0 = 흐름 셈 없음) */
function windStats(uq) {
  const S = uq?.stats ?? {};
  return S.winds || S.holdRefused ? { winds: S.winds ?? 0, fire: S.windFire ?? {}, cancel: S.windCancel ?? {}, refused: S.holdRefused ?? 0, touch: S.windTouch ?? 0, turns: S.windTurns ?? [], chain: S.windChain ?? [], reach: S.rdReach ?? [] } : null;
}
/** 감기 기록 묶음 */
export function windSummary(list) {
  const W = list.filter(Boolean);
  if (!W.length) return null;
  const add = (o, k, v) => ((o[k] = (o[k] ?? 0) + v), o);
  const fire = {}, cancel = {}, nDist = {};
  let winds = 0, refused = 0, touch = 0;
  const turns = [];
  const reach = [];
  for (const w of W) {
    reach.push(...(w.reach ?? []));
    winds += w.winds;
    refused += w.refused;
    touch += w.touch ?? 0;
    for (const [k, v] of Object.entries(w.fire)) add(fire, k, v);
    for (const [k, v] of Object.entries(w.cancel)) add(cancel, k, v);
    turns.push(...w.turns);
    for (const n of w.chain) add(nDist, n, 1);
  }
  const fired = Object.values(fire).reduce((q, v) => q + v, 0);
  // 'inside' 닿음 (10/29 감독 — 사장님 'simple' 결정 08:3x 뒤 재기만): 감기까지 간 누름 가운데 앞 칼(이어 긋기) 뒤 누름 · 이어 긋기 창(0.6 s) 안에서 누른 몫 · 누름 첫 0.6 s 칼끝 빠르기(p50 · 1.5 m/s 밑 몫 = 칼이 섬)
  const pre = reach.filter((x) => x.pre);
  const rq = { n: reach.length, pre: pre.length, inWin: reach.filter((x) => x.inWin).length, inWinPre: pre.filter((x) => x.inWin).length, gapPreP50: r3(p50(pre.map((x) => x.gap))), tipP50: r3(p50(reach.map((x) => x.tipP50))), stillP50: r3(p50(reach.map((x) => x.still))), insideN: reach.filter((x) => x.chainN >= 0).map((x) => x.chainN + 1) };
  return { winds, fired, fire, cancel, refused, touchSteps: touch, reach: rq, turnsP50: r3(p50(turns)), turnsMin: r3(Math.min(...turns)), turns1: turns.length ? r3(turns.filter((x) => x >= 1).length / turns.length) : null, nDist, k: Object.fromEntries(Object.entries(nDist).map(([n]) => [n, n === '0' ? 1 : r3(1 + (CONFIG.IB_FLOW.power - 1) * +n)])) };
}

// ── drill: 서 있는 · 걷는 상대 ──
export function drillRun(rowKey, seed, { foe = 'still', variant = 'on', dur = 14, sjit = 0.06, jit = 0.04, spd = [3, 5.5], foeW = 'longsword', startAdd = 0, probe = null, helm = false } = {}) {
  const R = ROWS[rowKey];
  // 'onG' · 'offG' = 제비 베기 '빗나감' 판(schielhau_strike.mjs --ghostDown 과 같음): 아래 획(내려베기)이 상대 몸을 지나가게(instantGhost) — 제비 베기가 실제로 나는 조건(앞 칼 빗나감 · 막힘)
  const ghost = variant.endsWith('G');
  variant = ghost ? variant.slice(0, -1) : variant;
  const G = newRound({ walls: true, seed, weapon: R.w, weapon2: foeW, AIClass: foe === 'walk' ? LowFoe : AI, persona: { proficiency: 4 } });
  const P = G.player;
  const D = G.enemy;
  if (foe !== 'walk') G.ai.update = () => {};
  // 상처는 몸에 안 건다 — 통증만(fighter.js applyWound 와 같은 식: 앞 칼 '맞힘' 판단 = 상대 통증 +0.05 · 통증은 스스로 빠짐). 무릎 꺾기 · 칼 떨굼은 굴림만 남기고 몸엔 안 검
  D.applyWound = (h) => {
    if (D.state === 'dead') return;
    D.pain = Math.min(2, D.pain + (h.severity ?? 0) * 0.8 + h.energy / 150);
  };
  D.knockDown = () => {};
  D.dropSword = () => {};
  if (helm) {
    // 투구 쓴 상대 (10/28 머리 표 — 케틀햇: 머리 틀 −0.01 m 위만 막음 · 그 아래 얼굴은 맨머리 · combat.js) · 상처를 몸에 안 거므로 닳지 않음
    D.hasHelmet = true;
    D.helmetType = 'kettle';
    D.helmetSpec = CONFIG.ARMOR.helmets.kettle;
    D.helmetIntegrity = 1;
  }
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  // 칼끝 돌려 빼기 줄 끔 판: 맞물림을 적는 몸이 있어야 손이 뒤 칼을 낸다 — 옆 스틱이 없으면 안 나는 비껴서며 찌르기만 연 몸(그대로 보통 탭)
  const uq = new PlayerUniqueAssist(P, { names: new Set(variant === 'on' && !R.tap ? [R.name] : R.cav ? ['inquartata'] : R.lian ? ['chebuYaoji'] : R.dup ? ['zwerchAbtritt'] : R.rd ? ['talhoRodeado'] : []) });
  if (variant === 'on' && !R.tap && !uq.list.length) throw new Error(`${R.name} 이 열리지 않음`);
  const slog = strokeLog(uq);
  const rnd = rng(seed * 7919 + 17);
  const bot = fingerBot(G, P, rnd, { sjit, jit, spd });
  // 막기 단추 (칼끝 돌려 빼기 줄 — 막아찌르기 I6 를 누르는 손 · 10/28 01:2x)
  const guard = R.cav ? new PlayerParryGuard(P, D) : null;
  if (guard) P.stamina.controller = guard;
  const cav = R.cav || R.lian || R.dup || R.rd ? cavBot(G, P, uq, bot, rnd, R, guard) : null;
  const [CONTACT, REACH] = MEASURED[R.w] ?? MEASURED.longsword;
  const atts = [];
  let cur = null;
  let nextAtk = 1.5;
  startAdd += R.startAdd ?? 0; // 풍차 베기: 감고 걸어 들어갈 몫
  G.before = () => {
    const t = G.t;
    const dist = P.foeDistance();
    cav?.step();
    if (cur && !cur.tap && !cur.cav && !bot.queue.length && cur.tq == null) cur.tq = t;
    if (cur?.cav && cur.tq == null && !cav.busy() && !bot.queue.length) {
      cur.tq = t;
      cur.bound = cav.bound;
      cur.second = cav.second;
    }
    if (cur && cur.tq != null && t - cur.tq > 0.35) cur = null;
    if (!bot.queue.length && !cur && t >= nextAtk && dist < REACH + startAdd && P.alive && P.armed && !P.stamina.exhausted) {
      if (R.tap) P.skill.thrust();
      else if (cav) {
        if (R.rd && rnd() < RD_COMBO) cav.pre = [OTHER_RD[Math.floor(rnd() * OTHER_RD.length)]]; // 이어 긋기 사슬 안에서 누름 (앞 칼 하나)
        cav.start();
      } else bot.queue = bot.make(R.strokes);
      cur = { t0: +t.toFixed(3), tq: null, tap: !!R.tap, cav: !!cav, hits: [], sev: 0, sevSp: 0, fired0: uq.stats?.fired?.[R.name] ?? 0, chain0: uq.stats?.ends?.chained ?? 0, s0: slog.length, dist0: r3(dist) };
      atts.push(cur);
      nextAtk = t + 0.8 + rnd() * 0.6 + (R.tap ? 0.6 : R.rd ? CONFIG.UNIQUE_ASSIST.specialCooldown + 4.5 : cav ? 2.0 : bot.queue.length * 2 * DT); // 풍차 베기: 식힘(내려침부터 6 s)을 넘겨 — 혼자 판은 나갔을 때를 잼 // 다음 시도: 이 입력이 끝나고 0.8 ~ 1.4 s 뒤 (탭은 찌르기 길이 약 0.6 s · 칼끝 돌려 빼기 손은 탭 둘 — 2 s)
    }
    if (cur?.tap && cur.tq == null && !P.skill.tap && t - cur.t0 > 0.05) cur.tq = t;
    if (guard) {
      guard.held = !!cav?.press;
      guard.broken = false;
      guard.step(DT);
      P.inputActive = guard.active;
    }
    bot.feed();
    // 아래 획 끝(길 점 1 — 맨 아래 [0, −0.5])을 지나 3 프레임까지 내 칼 ↔ 상대 몸 충돌 끔 (on · off 같은 프레임 — on 은 꺾는 순간부터 끌고 가는 칼이 제 충돌 끔을 둔다)
    if (ghost && R.combo && cur && bot.queue.length && bot.fed < (bot.marks[1] ?? 0) + 3) P.instantGhost = Math.max(P.instantGhost ?? 0, 2);
    const fwd = cav?.stick ?? Math.min(R.fwdCap ?? 1, stepIn(P, dist, bot.queue.length, t >= nextAtk && !cur, CONTACT, REACH, REACH + startAdd)); // 날개 접기 줄: 물러나는 손(스틱 뒤)
    P.move.set(cav?.side ?? 0, fwd); // side: B4 옆걸음 판 (RD_SIDE — 기본 0)
    P.stickX = cav?.side ?? 0;
    P.stickY = fwd;
  };
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    if (att !== P || vic !== D || !cur) return;
    addHit(cur, r, rest[1]?.v?.part ?? null, P, R.name);
    const pt = rest[0];
    if (pt && cur.hits.length) cur.hits[cur.hits.length - 1].dy = r3(pt.y - D.bodies.chest.translation().y); // 맞은 점 높이 − 상대 가슴 몸체 가운데 (목 경계 + 0.11)
  };
  try {
    while (G.t < dur && D.alive && P.alive) {
      if (foe !== 'walk') holdLow(D, foe === 'guard' ? GUARD : foe === 'guardHigh' ? GUARD_HIGH : LOW); // guard = 칼끝을 내게 겨눈 긴 자세 (내 찌르기가 그 칼에 맞물리는 판 — 칼끝 돌려 빼기 · 10/28)
      G.step();
      if (cur) cur.stackMax = Math.max(cur.stackMax ?? 0, uq.stackN ?? 0);
      probe?.(G, P, D, cur); // 재는 도구만 (스텝마다 — 칼끝 거리 등)
    }
    // 시도마다: 특수 공격 발동 수 · 강화 끝 · 그 시도 동안의 긋기 기록(기술 · 맞힘 · 맞물림) · 굴림(무릎 꺾기 · 칼 떨굼)
    const bl = G.combat.buckleLog ?? [];
    const kl = G.combat.koteLog ?? [];
    atts.forEach((a, i) => {
      const nx = atts[i + 1];
      a.fired = R.tap ? 1 : (nx ? nx.fired0 : uq.stats?.fired?.[R.name] ?? 0) - a.fired0; // 탭 견줌 줄은 시도 = 발동
      a.chained = (nx ? nx.chain0 : uq.stats?.ends?.chained ?? 0) - a.chain0;
      a.strokes = slog.slice(a.s0, nx ? nx.s0 : slog.length).map((s) => ({ tech: s.tech, pad: s.pad, unique: s.unique, landed: s.landed, bound: s.bound }));
      const t1 = a.tq != null ? a.tq + 0.35 : G.t;
      a.buckle = bl.filter((b) => b.att === 0 && b.t >= a.t0 && b.t <= t1).map((b) => b.hit);
      a.koteDrop = kl.filter((b) => b.att === 0 && b.t >= a.t0 && b.t <= t1).map((b) => b.drop);
      a.sev = r3(a.sev);
      a.sevSp = r3(a.sevSp);
      a.len = a.tq != null ? r3(a.tq - a.t0) : null;
      delete a.fired0;
      delete a.chain0;
      delete a.s0;
    });
    return { row: rowKey, seed, foe, variant: variant + (ghost ? 'G' : ''), atts: atts.filter((a) => a.tq != null), wind: windStats(uq) };
  } finally {
    G.world.free();
  }
}

/** 10/31 줄 cavTouch · inqVoid 판 기록: 닿음 수 · 셈 밖(내 긋기 동안) · 이른 탭 · 탭 · 맞받기마다 0.6 s 안에 받은 상처(낸 · 안 낸) · 낸 뒤 1 s 안 넘어짐 · 낸 칼 결과 */
function itStats(IT, uq, fires) {
  const S = uq.stats ?? {};
  const recvIn = (t0, w = 0.6) => IT.recvLog.filter(([t]) => t >= t0 && t <= t0 + w).reduce((a, [, sv]) => a + sv, 0);
  const inq = IT.inq.map((x) => ({ ...x, recv: r3(recvIn(x.t)), hit: recvIn(x.t) > 0, fall: IT.falls.some((f) => f.t >= x.t && f.t <= x.t + 1) }));
  const kill3 = fires.filter((x) => IT.foeDeadT != null && IT.foeDeadT >= x.t && IT.foeDeadT <= x.t + 3).length; // 낸 뒤 3 s 안에 상대가 죽은 낸 수 (헛누름 견줌 — 10/31)
  return { touches: S.touches ?? 0, touchCut: S.touchCut ?? 0, early: S.tapEarly ?? 0, touchTaps: IT.touchTaps, armSlow: S.armSlow ?? 0, cavCancel: S.cavCancel ?? 0, inq, falls: IT.falls, knock: IT.knock ?? [], fires: fires.map((x) => x.res), fireT: fires.map((x) => r3(x.t)), fireDur: fires.map((x) => (x.dur != null ? r3(x.dur) : null)), tapDur: IT.tapDur ?? [], tapRes: (IT.tapRes ?? []).map((x) => ({ ...x, E: r3(x.E), sev: r3(x.sev), kill3: IT.foeDeadT != null && IT.foeDeadT >= x.t0 && IT.foeDeadT <= x.t0 + 3 })), foeDeadT: IT.foeDeadT ?? null, kill3, recvLog: IT.recvLog.map(([t, sv, z, ty, E]) => [r3(t), r3(sv), z, ty, E]) };
}

// ── fight: 손가락 봇 대 치고 막는 AI ──
export function fightRun(rowKey, seed, opp, { variant = 'on', dur = 30, prof = 3, delay = 0.15, share = 0.5, counter = 0.5, sjit = 0.06, jit = 0.04, spd = [3, 5.5], startAdd = 0, probe = null } = {}) {
  const R = ROWS[rowKey];
  const G = newRound({ walls: true, seed, weapon: R.w, weapon2: opp, persona: { proficiency: prof } });
  applyWeaponMeasure(G.ai, opp);
  const P = G.player;
  const A = G.enemy;
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  const guard = new PlayerParryGuard(P, A);
  P.stamina.controller = guard;
  const all = (PLAYER_UNIQUE[R.trad] ?? []).map((e) => e.name);
  const uq = new PlayerUniqueAssist(P, { names: new Set(variant === 'on' ? all : all.filter((n) => n !== R.name)) });
  const slog = strokeLog(uq);
  const rnd = rng(seed * 7919 + Math.round(delay * 1000));
  const bot = fingerBot(G, P, rnd, { sjit, jit, spd });
  const [CONTACT, REACH] = MEASURED[R.w] ?? MEASURED.longsword;
  const baseNames = new Set([R.base]); // 다른 기본 긋기 = 특수 입력의 바탕 동작만 뺀 열두 가지
  const OTHER = TECH.filter((t) => !baseNames.has(t.name)).map((t) => ({ from: t.from, path: t.path }));
  const atts = [];
  let cur = null;
  let nextAtk = 2.6;
  let due = Infinity;
  let heldUntil = 0;
  let lastMotion = -1;
  let notice = false;
  let strokesN = 0;
  let taps = 0;
  let counters = 0;
  const cav = R.cav || R.lian || R.dup || R.rd ? cavBot(G, P, uq, bot, rnd, R, guard) : null;
  startAdd += R.startAdd ?? 0; // 풍차 베기: 감고 걸어 들어갈 몫
  // 10/31 줄 cavTouch · inqVoid 손 (위 ROWS 머리말)
  const IT = R.touch || R.inq ? { touchTaps: 0, inq: [], recvLog: [], falls: [], st: 'stand' } : null;
  // 넘어짐 까닭 (11/01 칼끝 돌려 빼기 넘어짐 고침 재기): knockDown 을 부른 곳 — 'footing'(발 밖 lostFooting) · 'tilt'(기울기) · 'gauge'(맞아 깎인 휘청 게이지) · 'legs' · 'hit'(머리 세게 맞음 · 팔다리 잘림 · 그 밖)
  if (IT) {
    const kd = P.knockDown.bind(P);
    P.knockDown = (heavy = true) => {
      if (P.state === 'stand') {
        const st = new Error().stack ?? '';
        const upd = /updateState/.test(st.split('\n').slice(2, 3).join(''));
        const tilt = P.tiltDeg() - (P.hunch ?? 0) * (180 / Math.PI);
        const why = !upd ? 'hit' : P.offBalanceTime > CONFIG.BALANCE.fallDelay ? 'footing' : tilt > CONFIG.BODY.fallTiltDeg ? 'tilt' : P.balance <= 0 ? 'gauge' : P.legsCannotSupport ? 'legs' : 'other';
        IT.knock = IT.knock ?? [];
        IT.knock.push({ t: r3(G.t), heavy, why });
      }
      return kd(heavy);
    };
  }
  let touchSeen = null;
  let tapAt = null;
  let inqHand = null;
  const special = (t, why) => {
    if (R.touch) {
      if (why === 'counter') heldUntil = t + 0.6 + rnd() * 0.4; // 맞받기 = 막기 단추를 쥠 (막고 서 있다 닿음)
      else if (P.skill.thrust()) taps++; // 공격 = 탭 찌르기 (내 찌르기가 상대 칼에 닿음)
      return;
    }
    if (R.inq) {
      if (why === 'counter') {
        inqHand = { t0: t, side: rnd() < 0.5 ? -0.9 : 0.9, tapAt: t + 0.03 + rnd() * 0.08, until: t + 0.4, fired0: uq.stats.fired?.inquartata ?? 0, tapped: false };
        return;
      }
      const b = OTHER[Math.floor(rnd() * OTHER.length)];
      bot.queue = bot.make([b], { back: rnd() < 0.3 });
      strokesN++;
      return;
    }
    const dist = P.foeDistance();
    if (cav && R.rd && rnd() < RD_COMBO) cav.pre = [OTHER[Math.floor(rnd() * OTHER.length)]]; // 이어 긋기 사슬 안에서 누름 (앞 칼 하나)
    if (cav) cav.start();
    else bot.queue = bot.make(R.strokes);
    cur = { t0: +t.toFixed(3), tq: null, why, cav: !!cav, hits: [], sev: 0, sevSp: 0, fired0: uq.stats?.fired?.[R.name] ?? 0, firedAll0: { ...(uq.stats?.fired ?? {}) }, s0: slog.length, dist0: r3(dist), cool: cav ? null : (uq.coolLeft?.(R.name) ?? 0) > 0 };
    atts.push(cur);
    strokesN++;
  };
  // 10/29 진단: 특수 공격이 나간 때마다 — 나간 때 상대 거리 · 끌고 가는 칼(iai tech)이 돌았나 · 칼날 ↔ 상대 몸 가장 가까운 겉 거리 · 그동안 가장 가까운 상대 거리 · 결과(막힘 · 맞음)
  const fires = [];
  let fireCur = null;
  let firedSeen = 0;
  const fireTick = () => {
    const fNow = uq.stats?.fired?.[R.name] ?? 0;
    if (fNow > firedSeen) {
      firedSeen = fNow;
      fireCur = { t: G.t, dist0: P.foeDistance(), snap: false, gap: Infinity, gapPart: null, minDist: Infinity, distSnap0: null, hits: [], res: null, done: false, ...(cav?.side ? { side: cav.side } : {}) }; // side: B4 옆걸음 판 쪽 (RD_SIDE — +1 칼 든 쪽)
      fires.push(fireCur);
    }
    if (!fireCur || fireCur.done) return;
    const I = P.iai;
    if (I && I.tech === R.name) {
      if (!fireCur.snap) fireCur.distSnap0 = P.foeDistance();
      fireCur.snap = true;
      const g = bodyGap(P, A);
      if (g.gap < fireCur.gap) (fireCur.gap = g.gap), (fireCur.gapPart = g.part);
      fireCur.minDist = Math.min(fireCur.minDist, P.foeDistance());
    } else if (fireCur.snap || G.t - fireCur.t > 1.5) {
      fireCur.done = true;
      fireCur.dur = G.t - fireCur.t; // 팔이 묶인 시간 (낸 때 ~ 끌고 가는 칼이 끝난 때 — 11/01 재기)
      const r = P.instantResult;
      if (fireCur.snap && r?.combo && r.tech === R.name) fireCur.res = { hits: r.hits, blocked: !!r.blocked, zone: r.zone, type: r.type, E: r3(r.energy), sev: r3(r.sev) };
    }
  };
  G.before = () => {
    const t = G.t;
    const dist = P.foeDistance();
    cav?.step();
    fireTick();
    if (IT) {
      if (!A.alive && IT.foeDeadT == null) IT.foeDeadT = r3(t);
      // 보통 탭 찌르기가 팔을 묶는 시간 (skill.tap 이 선 때 ~ 끝난 때 — 11/01 재기 · 칼끝 돌려 빼기와 견줌)
      if (P.skill.tap && IT.tapT0 == null) {
        IT.tapT0 = t;
        IT.tapCur = { t0: r3(t), touch: !!IT.nextTouch, hits: 0, E: 0, sev: 0, bladeTouch: false }; // 보통 탭 찌르기 하나의 결과 (11/01 — 닿음 뒤 탭이면 touch)
        IT.nextTouch = false;
      } else if (!P.skill.tap && IT.tapT0 != null) {
        (IT.tapDur ??= []).push(r3(t - IT.tapT0));
        IT.tapT0 = null;
        if (IT.tapCur) (IT.tapRes ??= []).push(IT.tapCur);
        IT.tapCur = null;
      }
      if (IT.tapCur && P.feel?.touching) IT.tapCur.bladeTouch = true;
      if (P.state !== IT.st) {
        if (IT.st === 'stand' && P.state !== 'stand') IT.falls.push({ t: r3(t), to: P.state });
        IT.st = P.state;
      }
      // 칼끝 돌려 빼기 손: 새 닿음을 느끼면 0.25 ~ 0.95 s 뒤 탭 (사람 반응 · 85 %)
      const C = uq.touch;
      if (R.touch && C && C !== touchSeen) {
        touchSeen = C;
        tapAt = rnd() < 0.85 ? C.t0 + 0.25 + rnd() * 0.7 : null;
      }
      if (R.touch && tapAt != null && uq.t >= tapAt) {
        tapAt = null;
        IT.touchTaps++;
        IT.nextTouch = true; // 다음에 서는 보통 탭 찌르기 = 닿음 뒤 탭 (칼끝 돌려 빼기가 나가면 탭이 서지 않음)
        P.skill.thrust();
        if (!P.skill.tap) IT.nextTouch = false;
      }
      // 비껴서며 찌르기 손: 맞받기에서 스틱 옆 · 곧 탭
      if (inqHand && !inqHand.tapped && t >= inqHand.tapAt) {
        inqHand.tapped = true;
        P.skill.thrust();
        const fired = (uq.stats.fired?.inquartata ?? 0) > inqHand.fired0;
        IT.inq.push({ t: r3(t), fired, threat: (guard.noThreat ?? 9) <= CONFIG.UNIQUE_ASSIST.inqThreat, noThreat: r3(Math.min(9, guard.noThreat ?? 9)), threatT: r3(inqHand.threatT ?? 0), cool: (uq.coolLeft?.('inquartata') ?? 0) > 0 && !fired });
      }
      if (inqHand && !inqHand.tapped && guard.noThreat === 0) inqHand.threatT = (inqHand.threatT ?? 0) + DT; // 맞받기 손 동안 위협이 읽힌 시간 (재기)
      if (inqHand && t >= inqHand.until) inqHand = null;
    }
    if (cur && !cur.cav && !bot.queue.length && cur.tq == null) cur.tq = t;
    if (cur?.cav && cur.tq == null && !cav.busy() && !bot.queue.length) {
      cur.tq = t;
      cur.bound = cav.bound;
      cur.second = cav.second;
      cur.cool = cav.cool;
    }
    if (cur && cur.tq != null && t - cur.tq > 0.35) cur = null;
    const motion = A.armed && dist < 2.2 && Math.hypot(A.hitPointVel.x, A.hitPointVel.y, A.hitPointVel.z) > 2.5;
    if (motion) {
      lastMotion = t;
      if (!notice && !guard.held && due === Infinity && !bot.queue.length && !cav?.busy()) {
        due = t + delay + rnd() * 0.1;
        notice = true;
      }
    } else if (t - lastMotion > 0.3) notice = false;
    if (t >= due) {
      due = Infinity;
      if (P.armed && !P.stamina.exhausted && !R.rd && rnd() < counter) { // 풍차 베기는 맞받지 않음 (길게 눌러야 — 막기 단추)
        special(t, 'counter');
        counters++;
        nextAtk = t + 1.0 + rnd() * 0.6;
      } else heldUntil = t + 0.6 + rnd() * 0.4;
    }
    const pressing = cav?.stage === 'press'; // 칼끝 돌려 빼기 손: 막아찌르기가 도는 동안은 막기 단추를 깨지 않음
    guard.held = !!cav?.press || (t < heldUntil && !bot.queue.length && !P.skill.tap && !cav?.busy());
    guard.broken = !pressing && !!(P.skill.tap || P.skill.pom || bot.queue.length || cav?.busy());
    if (!guard.held && !bot.queue.length && !cav?.busy() && t >= nextAtk && dist < REACH + startAdd && P.alive && P.armed && !P.stamina.exhausted) {
      if (rnd() < share) special(t, 'attack');
      else if (rnd() < 0.15) {
        cur = null; // 특수 시도 기록은 다른 칼을 내는 순간 닫는다
        if (P.skill.thrust()) taps++;
      } else {
        cur = null;
        const b = OTHER[Math.floor(rnd() * OTHER.length)];
        bot.queue = bot.make([b], { back: rnd() < 0.3 });
        strokesN++;
      }
      nextAtk = t + 1.0 + rnd() * 0.6;
    }
    guard.step(DT);
    P.inputActive = guard.active;
    bot.feed();
    const fwd = cav?.stick ?? Math.min(R.fwdCap ?? 1, stepIn(P, dist, bot.queue.length, t >= nextAtk && !guard.held, CONTACT, REACH, REACH + startAdd));
    P.move.set(inqHand ? inqHand.side : cav?.side ? cav.side : cav?.stick != null ? 0 : 0.18 * Math.sin(t * 0.65 + seed), inqHand ? 0 : fwd); // cav.side: B4 옆걸음 판 (RD_SIDE — 기본 0)
    P.stickX = P.move.x;
    P.stickY = P.move.y;
  };
  let dealt = 0;
  let bleedDealt = 0;
  let recv = 0;
  let spSev = 0;
  let spHits = 0;
  let lastTech = null;
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    const sv = r.type === 'blunt' ? 0 : r.severity ?? 0;
    if (att === A && vic === P) recv += sv;
    if (IT && att === A && vic === P) IT.recvLog.push([G.t, sv, r.zone, r.type, r3(r.energy)]);
    if (att !== P || vic !== A) return;
    dealt += sv;
    if (IT?.tapCur && !strokeTechOf(P) && P.skill?.tap) (IT.tapCur.hits += sv > 0 ? 1 : 0), (IT.tapCur.E = Math.max(IT.tapCur.E, r.energy ?? 0)), (IT.tapCur.sev += sv); // 보통 탭 찌르기 맞음
    bleedDealt += sv * (r.bleedPerSev ?? 0) * (r.type === 'stab' ? 1.6 : 1);
    const tn = strokeTechOf(P) ?? (P.skill?.tap ? 'tap' : '-');
    if (sv > 0) lastTech = tn;
    if (tn === R.name) {
      spSev += sv;
      if (sv > 0) spHits++;
      if (fireCur && !fireCur.done) fireCur.hits.push({ type: r.type, zone: r.zone, sev: r3(sv), E: r3(r.energy), edge: r3(edgeOf(P)) });
    }
    if (cur) addHit(cur, r, rest[1]?.v?.part ?? null, P, R.name);
  };
  let end = dur;
  try {
    for (let i = 0; i < Math.round(dur / DT); i++) {
      G.step();
      probe?.(G, P, A, uq); // 재기 손잡이 (10/31 — 판마다 스텝 뒤)
      if ((!P.alive || !A.alive) && end === dur) end = G.t + 0.5;
      if (G.t >= end) break;
    }
    const bl = G.combat.buckleLog ?? [];
    const kl = G.combat.koteLog ?? [];
    atts.forEach((a, i) => {
      const nx = atts[i + 1];
      const fNow = nx ? nx.firedAll0 : uq.stats?.fired ?? {};
      a.fired = (fNow[R.name] ?? 0) - a.fired0;
      a.firedOther = Object.fromEntries(Object.entries(fNow).map(([k, v]) => [k, v - (a.firedAll0[k] ?? 0)]).filter(([k, v]) => v > 0 && k !== R.name));
      a.strokes = slog.slice(a.s0, nx ? nx.s0 : slog.length).map((s) => ({ tech: s.tech, pad: s.pad, unique: s.unique, landed: s.landed, bound: s.bound }));
      const t1 = a.tq != null ? a.tq + 0.35 : G.t;
      a.buckle = bl.filter((b) => b.att === 0 && b.t >= a.t0 && b.t <= t1).map((b) => b.hit);
      a.koteDrop = kl.filter((b) => b.att === 0 && b.t >= a.t0 && b.t <= t1).map((b) => b.drop);
      a.sev = r3(a.sev);
      a.sevSp = r3(a.sevSp);
      a.len = a.tq != null ? r3(a.tq - a.t0) : null;
      delete a.fired0;
      delete a.firedAll0;
      delete a.s0;
    });
    // 모든 긋기 기록 (제비 베기 기회 = 정수리 · 사선 내려베기가 못 맞힌 수)
    const downs = slog.filter((s) => s.tech === 'oberhau' || s.tech === 'zornhau' || s.tech === 'zornhauL');
    return {
      row: rowKey, seed, opp, delay, variant, t: r3(G.t),
      win: !A.alive && P.alive, lose: !P.alive && A.alive,
      killedBy: !A.alive ? lastTech : null,
      dealt: r3(dealt), bleedDealt: r3(bleedDealt), recv: r3(recv), spSev: r3(spSev), spHits, strokesN, taps, counters,
      fired: { ...(uq.stats?.fired ?? {}) }, uqStrokes: slog.length, wind: windStats(uq),
      it: IT ? itStats(IT, uq, fires) : undefined,
      fires: fires.map((x) => ({ dist0: r3(x.dist0), snap: x.snap, distSnap0: r3(x.distSnap0), minDist: r3(x.minDist), gap: r3(x.gap), gapPart: x.gapPart, hits: x.hits, res: x.res, ...(x.side ? { side: x.side } : {}) })), // side: B4 옆걸음 판 (RD_SIDE)
      downs: downs.length, downsMiss: downs.filter((s) => !s.landed).length,
      atts,
    };
  } finally {
    G.world.free();
  }
}

// ── ease: 손가락 입력만 기하로 (물리 없음) ──
//  시작 자리 = 바탕 동작 from + 가우스 σ · 첫 방향 = 시작 자리 → 첫 길 점(± jit). 특수 공격으로 읽히나 = unique_assist.js 규칙:
//   강화동작 = classifyStroke 가 그 바탕 동작 · 손목 치기 = 긴 자세 패드 + 아래 ± 40° · 제비 베기 = 아래 획이 정수리(또는 사선) 내려베기로 읽히고 꺾은 자리에서 위 획 첫 방향이 위 ± 40°
//   (앞 칼 빗나감 · 창 0.6 s 조건은 물리 판이라 여기선 안 봄) · 돌려 베기 뒷몫 = 앞 획이 읽히면 되긋기는 방향 조건 없음(박자 창만)
export function easeGeom(rowKey, sigma, n = 4000, jit = 0.04, seed = 1) {
  const R = ROWS[rowKey];
  if (!R.strokes.length) return null; // 탭 견줌 줄
  const rnd = rng(seed);
  const ang = (d, w) => (Math.acos(Math.max(-1, Math.min(1, (d[0] * w[0] + d[1] * w[1]) / (Math.hypot(...d) * Math.hypot(...w) || 1)))) * 180) / Math.PI;
  let ok = 0;
  for (let i = 0; i < n; i++) {
    const s = R.strokes[0];
    const st = [s.from[0] + rnd.gauss() * sigma, s.from[1] + rnd.gauss() * sigma];
    const p1 = [s.path[0][0] + (rnd() * 2 - 1) * jit, s.path[0][1] + (rnd() * 2 - 1) * jit];
    const dir = [p1[0] - st[0], p1[1] - st[1]];
    const c = classifyStroke(st, dir);
    let hit;
    if (rowKey === 'kote') hit = c.pad === 'langort' && ang(dir, [0, -1]) <= UA.angle;
    else if (R.combo) {
      const down = c.tech === 'oberhau' || c.tech === 'zornhau' || c.tech === 'zornhauL';
      const turn = [s.path[1][0] + (rnd() * 2 - 1) * jit, s.path[1][1] + (rnd() * 2 - 1) * jit];
      const up = [s.path[2][0] + (rnd() * 2 - 1) * jit - turn[0], s.path[2][1] + (rnd() * 2 - 1) * jit - turn[1]];
      hit = down && ang(up, [0, 1]) <= UA.angle;
    } else hit = c.tech === R.base;
    if (hit) ok++;
  }
  return ok / n;
}

// ── 묶음 ──
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
/** 부트스트랩 95 % (평균) */
function boot(a, B = 2000, seed = 7) {
  if (a.length < 2) return [null, null];
  const rnd = rng(seed);
  const m = [];
  for (let b = 0; b < B; b++) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[Math.floor(rnd() * a.length)];
    m.push(s / a.length);
  }
  m.sort((x, y) => x - y);
  return [r3(m[Math.floor(0.025 * B)]), r3(m[Math.floor(0.975 * B)])];
}
/** 시도 묶음: 발동 몫 · 시도당 심각도(그 시도의 모든 칼날 상처) · 발동한 시도의 특수 공격 심각도 · 첫 맞음 갈래 · 부위 · 날 몫 · 새 몸 갈래 · 굴림 */
export function attSummary(atts, name, row = null) {
  const n = atts.length;
  // 안 나간 시도 갈래: landed = 제비 베기 앞 칼이 맞아 버림 · displaced = 다른 고유 공격이 먼저(이어 긋기 · 걸음 명령) · misread = 바탕 동작으로 안 읽힘(시작 자리 · 첫 방향) · other = 읽혔으나 몸이 바쁨 등
  const R = row ? ROWS[row] : null;
  const DOWN = ['oberhau', 'zornhau', 'zornhauL'];
  const why = { landed: 0, displaced: 0, misread: 0, other: 0 };
  if (R && !R.tap)
    for (const a of atts) {
      if (a.fired > 0) continue;
      const S = a.strokes ?? [];
      if (Object.keys(a.firedOther ?? {}).length || S.some((x) => x.unique && x.unique !== name)) why.displaced++;
      else if (R.cav || R.lian || R.dup) a.bound ? why.other++ : why.misread++; // 칼끝 돌려 빼기 · 날개 접기 줄: 첫 칼이 맞물리지 · 부딪히지 않음 = misread 칸에 셈
      else if (R.combo) {
        const d = S.find((x) => DOWN.includes(x.tech));
        if (!d) why.misread++;
        else if (d.landed) why.landed++;
        else why.other++;
      } else if (row === 'kote' ? !S.some((x) => x.pad === 'langort') : !S.some((x) => x.tech === R.base)) why.misread++;
      else why.other++;
    }
  const F = atts.filter((a) => a.fired > 0);
  const spFirst = F.map((a) => a.hits.find((h) => h.tech === name)).filter(Boolean);
  const parts = {};
  for (const h of spFirst) parts[h.zone] = (parts[h.zone] ?? 0) + 1;
  const blade = spFirst.filter((h) => h.type !== 'blunt').length;
  const edgeOk = spFirst.filter((h) => h.edge != null && Math.abs(h.edge) > CONFIG.STRIKE.edgeAlign).length;
  const outs = { kill: 0, disarm: 0, deep: 0 };
  for (const a of atts) {
    const o = new Set(a.hits.filter((h) => h.tech === name).map((h) => h.out).filter(Boolean));
    for (const k of o) outs[k]++;
  }
  const outAny = (a) => a.hits.some((h) => h.out);
  const outAll = { kill: 0, disarm: 0, deep: 0 };
  for (const a of atts) for (const k of new Set(a.hits.map((h) => h.out).filter(Boolean))) outAll[k]++;
  const lens = atts.map((a) => a.len).filter((x) => x != null);
  return {
    n,
    fired: F.length,
    fireRate: n ? r3(F.length / n) : null,
    why,
    bleedPerAtt: r3(mean(atts.map((a) => a.bleed ?? 0))),
    spBleedPerFired: r3(mean(F.map((a) => a.hits.filter((h) => h.tech === name).reduce((q, h) => q + (h.bleed ?? 0), 0)))),
    sevPerAtt: r3(mean(atts.map((a) => a.sev))),
    sevPerAttCI: boot(atts.map((a) => a.sev)),
    spPerAtt: r3(mean(atts.map((a) => a.sevSp))),
    spPerFired: r3(mean(F.map((a) => a.sevSp))),
    spHitRate: F.length ? r3(F.filter((a) => a.hits.some((h) => h.tech === name && h.sev > 0)).length / F.length) : null,
    spContact: F.length ? r3(spFirst.length / F.length) : null,
    spSevPerHit: r3(mean(F.flatMap((a) => a.hits.filter((h) => h.tech === name && h.sev > 0).map((h) => h.sev)))),
    hitRate: n ? r3(atts.filter((a) => a.hits.some((h) => h.sev > 0)).length / n) : null,
    zones: parts,
    bladeShare: spFirst.length ? r3(blade / spFirst.length) : null,
    edgeShare: spFirst.length ? r3(edgeOk / spFirst.length) : null,
    outSp: outs,
    outAll,
    decisiveAll: n ? r3(atts.filter(outAny).length / n) : null,
    buckleRolls: atts.reduce((s, a) => s + (a.buckle?.length ?? 0), 0),
    buckleHits: atts.reduce((s, a) => s + (a.buckle?.filter(Boolean).length ?? 0), 0),
    koteRolls: atts.reduce((s, a) => s + (a.koteDrop?.length ?? 0), 0),
    koteDrops: atts.reduce((s, a) => s + (a.koteDrop?.filter(Boolean).length ?? 0), 0),
    stackMax: atts.reduce((m, a) => Math.max(m, a.stackMax ?? 0, ...a.hits.map((h) => h.stack ?? 0)), 0),
    chained: atts.reduce((s, a) => s + (a.chained ?? 0), 0),
    len: r3(mean(lens)),
    sevPerSec: lens.length ? r3(mean(atts.map((a) => a.sev)) / mean(lens)) : null,
    downLanded: atts.filter((a) => a.strokes?.[0] && ['oberhau', 'zornhau', 'zornhauL'].includes(a.strokes[0].tech) && a.strokes[0].landed).length,
    downRead: atts.filter((a) => a.strokes?.[0] && ['oberhau', 'zornhau', 'zornhauL'].includes(a.strokes[0].tech)).length,
    // 10/28 (위에서 내려 찌르기): 첫 특수 맞음의 갈래 · 끌고 간 칼 몫 · 손목(범위 밖 > 1° · 굴림 ≥ 78 · 굽힘 · 폄 p50 · dev p50) · 틈 파고들기가 걸린 찌른 상처(칼날 · 심각도 > 0) · 칼끝이 겨눈 곳을 지난 길이 p50
    cavBound: R?.cav || R?.lian || R?.dup ? atts.filter((a) => a.bound).length : undefined, // 칼끝 돌려 빼기 줄: 첫 탭이 맞물린 시도
    spTypes: spFirst.reduce((m, h) => ((m[h.type] = (m[h.type] ?? 0) + 1), m), {}),
    spSnap: spFirst.filter((h) => h.snap).length,
    wrist: (() => {
      const W = spFirst.map((h) => h.w).filter(Boolean);
      return W.length ? { n: W.length, oor: W.filter((w) => w.oor > OOR_EPS).length, feOut: W.filter((w) => Math.abs(w.fe) > CONFIG.JOINTS.wristFE).length, roll78: W.filter((w) => w.roll >= ROLL_AT).length, fe: r3(p50(W.map((w) => Math.abs(w.fe)))), dev: r3(p50(W.map((w) => w.dev))), roll: r3(p50(W.map((w) => w.roll))), elbowUp30: W.filter((w) => w.elbowUp > 30).length } : null;
    })(),
    gapStabs: F.reduce((q, a) => q + a.hits.filter((h) => h.tech === name && h.gap && h.sev > 0).length, 0),
    gapSev: r3(F.reduce((q, a) => q + a.hits.filter((h) => h.tech === name && h.gap && h.sev > 0).reduce((u, h) => u + h.sev, 0), 0)),
    over: r3(p50(spFirst.map((h) => h.reach?.over).filter((x) => x != null))),
    el: r3(p50(spFirst.map((h) => h.reach?.el).filter((x) => x != null))),
    // 10/28 머리 표 (겹치기 — 감독 전달): 이 특수 공격의 머리 맞음(첫 맞음 아님 — 전부) 투구 밖 · 안 마다 수 · 에너지 p50 · 최대 · 심각도 p50 · 새 몸이었다면 즉사(베기 > 0.8 · 찌르기 > 0.5) 몫
    head: (() => {
      const H = atts.flatMap((a) => a.hits.filter((h) => h.tech === name && h.zone === 'head'));
      const one = (X) => (X.length ? { n: X.length, E: r3(p50(X.map((h) => h.energy))), Emax: r3(Math.max(...X.map((h) => h.energy))), sev: r3(p50(X.map((h) => h.sev))), sevMax: r3(Math.max(...X.map((h) => h.sev))), kill: r3(X.filter((h) => h.out === 'kill').length / X.length), cut: X.filter((h) => h.type === 'cut').length, blunt: X.filter((h) => h.type === 'blunt').length } : { n: 0 });
      return { bare: one(H.filter((h) => !h.helm)), helm: one(H.filter((h) => h.helm)) };
    })(),
    spIndes: atts.reduce((q, a) => q + a.hits.filter((h) => h.tech === name && h.sk > 1).length, 0), // 유파 패시브 배율(독일 인데스 등)이 실린 이 특수 공격 맞음 수
    spHits: atts.reduce((q, a) => q + a.hits.filter((h) => h.tech === name).length, 0),
    firstTech: Object.entries(atts.reduce((m, a) => ((m[a.strokes?.[0]?.unique ?? a.strokes?.[0]?.tech ?? '-'] = (m[a.strokes?.[0]?.unique ?? a.strokes?.[0]?.tech ?? '-'] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).slice(0, 4),
  };
}
/** 10/29 진단 묶음: 시도 → 식힘 · 나감 / 나감 → 끌고 간 칼 · 막힘 · 맞음(상처) · 스침(둔타 · 심각도 0) · 헛침(칼날 ↔ 상대 몸 겉 거리) / 상처당 심각도 · 맞은 곳 · 나간 때 거리 */
export function fireDiag(runs) {
  const atts = runs.flatMap((r) => r.atts);
  const F = runs.flatMap((r) => r.fires ?? []);
  const q = (a, p) => { const b = a.filter((x) => x != null && isFinite(x)).sort((x, y) => x - y); return b.length ? r3(b[Math.min(b.length - 1, Math.floor(p * (b.length - 1)))]) : null; };
  const wound = (h) => h.type !== 'blunt' && h.sev > 0;
  const cls = F.map((f) => (!f.snap ? 'noStrike' : f.hits.some(wound) ? 'wound' : f.hits.length ? 'glance' : f.res?.blocked ? 'blocked' : 'miss'));
  const by = cls.reduce((o, k) => ((o[k] = (o[k] ?? 0) + 1), o), {});
  const H = F.flatMap((f) => f.hits);
  const W = H.filter(wound);
  const miss = F.filter((f, i) => cls[i] === 'miss');
  const zones = H.reduce((o, h) => ((o[h.zone] = (o[h.zone] ?? 0) + 1), o), {});
  const flat = H.filter((h) => h.edge != null && Math.abs(h.edge) <= CONFIG.STRIKE.edgeAlign).length;
  return {
    attempts: atts.length, cool: atts.filter((a) => a.cool).length, fired: atts.filter((a) => a.fired > 0).length, notFiredNotCool: atts.filter((a) => !(a.fired > 0) && !a.cool).length,
    fires: F.length, by, blockedAny: F.filter((f) => f.res?.blocked).length,
    hits: H.length, woundHits: W.length, bluntHits: H.filter((h) => h.type === 'blunt').length, sev0Hits: H.filter((h) => h.type !== 'blunt' && !(h.sev > 0)).length, flatHits: flat,
    sevPerWound: { mean: r3(W.reduce((a, h) => a + h.sev, 0) / Math.max(1, W.length)), p50: q(W.map((h) => h.sev), 0.5) }, E: { p50: q(H.map((h) => h.E), 0.5) },
    zones, dist0: [q(F.map((f) => f.dist0), 0.1), q(F.map((f) => f.dist0), 0.5), q(F.map((f) => f.dist0), 0.9)], distSnap0: q(F.map((f) => f.distSnap0), 0.5), minDist: q(F.map((f) => f.minDist), 0.5),
    missGap: [q(miss.map((f) => f.gap), 0.1), q(miss.map((f) => f.gap), 0.5), q(miss.map((f) => f.gap), 0.9)], missGapPart: miss.reduce((o, f) => ((o[f.gapPart] = (o[f.gapPart] ?? 0) + 1), o), {}),
  };
}
export function fightSummary(runs, name, row = null) {
  const n = runs.length;
  const atts = runs.flatMap((r) => r.atts);
  const sum = (f) => runs.reduce((s, r) => s + f(r), 0);
  const per30 = (f) => r3((sum(f) / sum((r) => r.t)) * 30);
  const disp = {};
  for (const a of atts) for (const [k, v] of Object.entries(a.firedOther ?? {})) disp[k] = (disp[k] ?? 0) + v;
  const kills = {};
  for (const r of runs) if (r.killedBy) kills[r.killedBy] = (kills[r.killedBy] ?? 0) + 1;
  return {
    n,
    win: runs.filter((r) => r.win).length,
    lose: runs.filter((r) => r.lose).length,
    pts: r3(mean(runs.map((r) => (r.win ? 1 : r.lose ? 0 : 0.5)))),
    dealt: r3(mean(runs.map((r) => r.dealt))),
    dealtCI: boot(runs.map((r) => r.dealt)),
    recv: r3(mean(runs.map((r) => r.recv))),
    spSev: r3(mean(runs.map((r) => r.spSev))),
    attPer30: per30((r) => r.atts.length),
    firedPer30: per30((r) => r.fired[name] ?? 0),
    strokesPer30: per30((r) => r.strokesN + r.taps),
    downsMissPer30: per30((r) => r.downsMiss),
    downsPer30: per30((r) => r.downs),
    spKills: kills[name] ?? 0,
    kills,
    displaced: disp,
    byDelay: Object.fromEntries([...new Set(runs.map((r) => r.delay))].map((d) => {
      const R = runs.filter((r) => r.delay === d);
      const A = attSummary(R.flatMap((r) => r.atts), name, row);
      return [d, { n: R.length, pts: r3(mean(R.map((r) => (r.win ? 1 : r.lose ? 0 : 0.5)))), dealt: r3(mean(R.map((r) => r.dealt))), fire: A.fireRate, sevPerAtt: A.sevPerAtt, spPerFired: A.spPerFired }];
    })),
    byOpp: Object.fromEntries([...new Set(runs.map((r) => r.opp))].map((o) => {
      const R = runs.filter((r) => r.opp === o);
      const A = attSummary(R.flatMap((r) => r.atts), name, row);
      return [o, { n: R.length, w: R.filter((r) => r.win).length, l: R.filter((r) => r.lose).length, dealt: r3(mean(R.map((r) => r.dealt))), fire: A.fireRate, sevPerAtt: A.sevPerAtt }];
    })),
    bleedDealt: r3(mean(runs.map((r) => r.bleedDealt ?? 0))),
    att: attSummary(atts, name, row),
  };
}

function parseArgs() {
  const args = { _: [] };
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] ?? true;
    else args._.push(a);
  }
  return args;
}

// 겹치기 자동 재기(duplieren_auto.mjs — 10/31)가 같은 손가락 봇 · 걸음 · 난수를 쓴다 (내보내기만 — 이 파일 판은 그대로)
export { fingerBot, rng, stepIn, bodyGap, strokeLog, edgeOf, freshOutcome };

if (isMain(import.meta.url)) {
  const args = parseArgs();
  const mode = args._[0] ?? 'drill';
  // --set=UNIQUE_ASSIST.imbroReach=0,… : 게임 값을 바꿔 견줌 (schielhau_strike.mjs --set 과 같은 꼴)
  for (const kv of String(args.set ?? '').split(',').filter(Boolean)) {
    const [path, v] = kv.split('=');
    const ks = path.split('.');
    let o = CONFIG;
    for (const k of ks.slice(0, -1)) o = o[k];
    o[ks.at(-1)] = isNaN(+v) ? v : +v;
  }
  const rows = String(args.rows ?? Object.keys(ROWS).join(',')).split(',');
  const variants = String(args.variants ?? 'on,off').split(',');
  const sjit = +(args.sjit ?? 0.06);
  const out = { mode, sjit, at: new Date().toISOString(), res: [] };
  const t0 = Date.now();
  if (mode === 'drill') {
    const foes = String(args.foes ?? 'still,walk').split(',');
    const seeds = +(args.seeds ?? 12);
    const first = +(args.first ?? 5);
    for (const row of rows)
      for (const foe of foes)
        for (const variant of variants) {
          const runs = [];
          const s0 = +(args.seed0 ?? 1);
          for (let s = s0; s < s0 + seeds; s++) runs.push(drillRun(row, s, { foe, variant, dur: +(args.dur ?? 14), sjit, helm: !!+(args.helm ?? 0) }));
          const atts = runs.flatMap((r) => r.atts.slice(0, first));
          const sm = attSummary(atts, ROWS[row].name, row);
          const ws = windSummary(runs.map((r) => r.wind));
          out.res.push({ row, foe, variant, sum: sm, atts, wind: ws });
          console.log(`${row} ${foe} ${variant}: ${JSON.stringify(sm)}${ws ? `\n   wind: ${JSON.stringify(ws)}` : ''}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
        }
  } else if (mode === 'fight') {
    const opps = String(args.opps ?? 'longsword,uchigatana,zweihander').split(',');
    const fseeds = String(args.fseeds ?? '901,902,903,904').split(',').map(Number);
    const delays = String(args.delays ?? '0.12,0.22').split(',').map(Number);
    for (const row of rows)
      for (const variant of variants) {
        const runs = [];
        for (const opp of opps) for (const seed of fseeds) for (const delay of delays) runs.push(fightRun(row, seed, opp, { variant, delay, prof: +(args.prof ?? 3), dur: +(args.dur ?? 30), share: +(args.share ?? 0.5), sjit }));
        const sm = fightSummary(runs, ROWS[row].name, row);
        sm.wind = windSummary(runs.map((r) => r.wind));
        sm.diag = fireDiag(runs);
        out.res.push({ row, variant, sum: sm, runs });
        console.log(`${row} fight ${variant}: ${JSON.stringify({ ...sm, att: undefined, diag: undefined })}\n   att: ${JSON.stringify(sm.att)}\n   diag: ${JSON.stringify(sm.diag)}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
      }
  } else if (mode === 'ease') {
    const sig = String(args.sigmas ?? '0.03,0.06,0.09,0.12').split(',').map(Number);
    for (const row of rows) {
      const e = Object.fromEntries(sig.map((s) => [s, r3(easeGeom(row, s))]));
      out.res.push({ row, ease: e });
      console.log(`${row}: ${JSON.stringify(e)}`);
    }
  } else if (mode === 'reach') {
    // 칼끝 닿음 탐침: 시도마다 내 칼끝 ↔ 상대 가슴 · 머리 몸체 가운데의 가장 가까운 거리 · 칼끝 최고 빠르기 (서 있는 상대 · 켬 — 견줌 줄은 끔)
    const seeds = +(args.seeds ?? 4);
    const v = new THREE.Vector3();
    for (const row of rows) {
      const A = [];
      for (let s = 1; s <= seeds; s++) {
        const r = drillRun(row, s, { foe: 'still', variant: ROWS[row].tap ? 'off' : 'on', dur: +(args.dur ?? 14), sjit, probe: (G, P, D, cur) => {
          if (!cur) return;
          const tip = P.bladePoint(1.0, v);
          const d = (b) => { const c = D.bodies[b].translation(); return Math.hypot(tip.x - c.x, tip.y - c.y, tip.z - c.z); };
          cur.minC = Math.min(cur.minC ?? 9, d('chest'));
          cur.minH = Math.min(cur.minH ?? 9, d('head'));
          cur.tipV = Math.max(cur.tipV ?? 0, P.tipVel?.length?.() ?? 0);
        } });
        A.push(...r.atts.slice(0, +(args.first ?? 5)));
      }
      const e = { n: A.length, minChest: r3(p50(A.map((a) => a.minC))), minHead: r3(p50(A.map((a) => a.minH))), tipV: r3(p50(A.map((a) => a.tipV))), dist0: r3(p50(A.map((a) => a.dist0))), contacts: A.filter((a) => a.hits.length).length, sev: r3(A.reduce((q, a) => q + a.sev, 0)) };
      out.res.push({ row, reach: e });
      console.log(`${row}: ${JSON.stringify(e)}`);
    }
  } else if (mode === 'agg') {
    // 묶음: drill · fight JSON 여럿을 줄 · 상대 · 변형마다 합쳐 다시 셈 → 줄마다 한 줄 + 표
    const D = new Map();
    const F = new Map();
    for (const fn of args._.slice(1)) {
      const J = JSON.parse(readFileSync(fn, 'utf8'));
      for (const x of J.res) {
        if (J.mode === 'drill') {
          const k = `${x.row}|${x.foe}|${x.variant}`;
          D.set(k, [...(D.get(k) ?? []), ...x.atts]);
        } else if (J.mode === 'fight') {
          const k = `${x.row}|${x.variant}`;
          F.set(k, [...(F.get(k) ?? []), ...x.runs]);
        }
      }
    }
    const res = {};
    for (const row of Object.keys(ROWS)) {
      const nm = ROWS[row].name;
      const d = (foe, v) => (D.has(`${row}|${foe}|${v}`) ? attSummary(D.get(`${row}|${foe}|${v}`), nm, row) : null);
      const f = (v) => (F.has(`${row}|${v}`) ? fightSummary(F.get(`${row}|${v}`), nm, row) : null);
      const R = { geom: { 0.06: r3(easeGeom(row, 0.06)), 0.09: r3(easeGeom(row, 0.09)) } };
      if (![...D.keys(), ...F.keys()].some((k) => k.startsWith(row + '|'))) continue;
      for (const foe of ['still', 'walk']) for (const v of ['on', 'off', 'onG', 'offG']) { const x = d(foe, v); if (x) R[`${foe}_${v}`] = x; }
      for (const v of ['on', 'off']) { const x = f(v); if (x) R[`fight_${v}`] = x; }
      res[row] = R;
      console.log(`\n## ${row} ${ROWS[row].ko} (${ROWS[row].w})  기하 읽힘 σ0.06 ${R.geom[0.06]} · σ0.09 ${R.geom[0.09]}`);
      for (const k of Object.keys(R).filter((k) => k !== 'geom')) {
        const x = R[k];
        const a = x.att ?? x;
        const fx = x.att ? ` · 판 ${x.n} 승 ${x.win} 패 ${x.lose} 승점 ${x.pts} · 준 ${x.dealt} ${JSON.stringify(x.dealtCI)} 준 출혈 ${x.bleedDealt} 받은 ${x.recv} · 특수 심각도/판 ${x.spSev} · 시도/30s ${x.attPer30} 발동/30s ${x.firedPer30} 긋기/30s ${x.strokesPer30} · 내려베기/30s ${x.downsPer30} 그중 못 맞힘 ${x.downsMissPer30} · 특수로 끝냄 ${x.spKills} · 끝낸 기술 ${JSON.stringify(x.kills)} · 밀려남 ${JSON.stringify(x.displaced)}\n      지연별 ${JSON.stringify(x.byDelay)}\n      상대별 ${JSON.stringify(x.byOpp)}` : '';
        console.log(`  ${k}: 시도 ${a.n} 발동 ${a.fireRate} · 안 나감 ${JSON.stringify(a.why)} · 시도당 ${a.sevPerAtt} ${JSON.stringify(a.sevPerAttCI)} 출혈/시도 ${a.bleedPerAtt} 특수 출혈/발동 ${a.spBleedPerFired} · 특수/시도 ${a.spPerAtt} · 특수/발동 ${a.spPerFired} · 특수 맞힘 ${a.spHitRate} 닿음 ${a.spContact} 맞음당 ${a.spSevPerHit} · 곳 ${JSON.stringify(a.zones)} · 날 ${a.bladeShare} 날맞춤 ${a.edgeShare} · 새 몸 ${JSON.stringify(a.outSp)} 모두 ${JSON.stringify(a.outAll)} · 무릎 ${a.buckleHits}/${a.buckleRolls} 칼떨굼 ${a.koteDrops}/${a.koteRolls} · 쌓기 ${a.stackMax} 잇기 ${a.chained} · 길이 ${a.len} s · 초당 ${a.sevPerSec} · 내려베기 맞힘 ${a.downLanded}/${a.downRead} · 첫 특수 맞음 갈래 ${JSON.stringify(a.spTypes)} 끌고 간 칼 ${a.spSnap} · 손목 ${JSON.stringify(a.wrist)} · 틈 찌름 ${a.gapStabs} (${a.gapSev}) · 지난 길이 ${a.over} 높이각 ${a.el}${fx}`);
      }
    }
    out.res = res;
  } else throw new Error(`판 ${mode}?`);
  if (args.json) writeFileSync(String(args.json), JSON.stringify(out));
}

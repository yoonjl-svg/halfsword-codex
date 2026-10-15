import { classifyStroke } from './attack_stroke.js';
// ─────────────────────────────────────────────────────────────
//  플레이어 고유 동작 강화 (10/14 — docs/strike/unique_player_2026-10-13.md '10/14 강화 방식'. 10/13 판 '이어 주기'를 다시 만듦)
//
//  사장님 승인 (10/13 22:0x): "플레이어가 긋는 동작이 고유 동작의 시작 자리·방향과 맞으면 …" · 지향점: "자연스러운 '향상'이라고 느끼면 좋겠네."
//  사장님 결정 (10/14 01:5x): 같은 고유 동작 표를 AI 와 플레이어에게 다르게 적용한다. AI 는 지금처럼 궤적을 따른다(ai.js — 이 파일은 표의 단계만 내준다).
//   플레이어는 '궤적은 끝까지 내 손가락, 고유 동작은 손가락으로는 못 하는 몫만 더한다' — 10/13 판(손 목표를 고유 동작 길로 끌고 그동안 손가락을 막음)이
//   "원하는 위치로 칼이 안 가는 느낌 … 원하는 궤적으로 칼이 안 돌아"(사장님 10/14 01:xx) 였기 때문.
//
//  긋기 읽기는 10/13 판 그대로: 플레이어 긋기가 시작되는 순간(손 목표가 휘두르기 문턱 SKILL.swingSpeed 를 넘는 스텝 — 검술 층 skill.js 가 쓰는 같은 사건)에
//   ① 시작 자리(가장 가까운 자세 패드 G.*)와 처음 방향(손 속도 방향)으로 기본 12 동작(ai_techniques.js TECH) 가운데 어느 긋기인지 고르고,
//   ② 해금된 고유 동작 가운데 그 긋기(또는 아래 표의 조건 · 길과 꼴이 맞는지 join)에 맞는 것이 있으면 그 긋기 동안 '강화'만 얹는다. 손 목표(handOffset)는 건드리지 않는다.
//  강화 넷 (세기 손잡이 UNIQUE_ASSIST.enhance 하나 — 0 = 이름 알림만):
//   · 발놀림 — 표의 step 칸(schools.js — zwerchAbtritt·inquartata·talhoRodeado·hirakiGiri·chebuYaoji)은 긋기와 함께 그 걸음을 딛는다(AI 기술 걸음 ai.js techStepRequest 와 같은 꼴의 gait 걸음 요청)
//   · 몸 — 긋는 동안 표의 body(뒷몫은 body2)만큼 몸통 돌림·숙임·낮춤을 얹는다(덧씌우기 칸 몸 값과 같은 길 — skill.uniqBody → fighter.js updateBodyPose).
//          값 = 고유 동작 몸 꼴 점검(10/12 …/body-audit-2q36ha)의 [추정]·[해석] 값의 절반 안팎
//   · 끝 힘 — 긋기 뒷몫(손 목표가 그 몫 길이의 powerAt 넘게 간 뒤)에 팔 서보 힘을 조금 올린다(비기 힘 창 SECRET.power 와 같은 칸 f.powerMul)
//   · 날 세우기 — 손 목표가 손가락 그대로라 플레이어 날 세우기(fighter.js inputEdgeLead)가 읽는 손 목표는 실제 칼 움직임과 같다. 덧씌운 몸 돌림 몫만 날이 늦게 따라가서
//          그 빠르기(uniqBody.yawRate)를 날 세우기 앞당김에 더했다(10/14 탐침 — 문서)
//  잇는 동작(chain 칸 — 머리 위 돌려 베기·코코 연타·위아래 사슬·번갈아 올려베기·겹치기)은 플레이어가 박자 창(chainWait) 안에 실제로 이어 그을 때만 그 긋기에 뒷몫 강화를 얹는다.
//   자동으로 두 번째 칼을 내지 않는다. 앞 긋기 조건으로 여는 것(츠바메가에시·카바치오네·염시·자→격)은 그 긋기 자체가 이어 그은 것이다.
//  비기·막기 버튼·탭 찌르기·손잡이 찍기·마무리 찍기·약한 자세 간격 맞추기가 돌고 있으면 발동하지 않고, 강화 중에 그것들이 시작되면 곧장 물러난다.
//  발동하면 기술 이름 알림(main.js showTechCue 'unique' — AI 고유 동작 알림과 같은 칸, '내 · 굽은 베기' 꼴).
//  AI 쪽은 아래 표의 단계만 읽는다(aiUniqueStages — 숙련도 거르기 10/13, sword_art.js applySchoolArt · ai.js). body·body2 칸은 플레이어만.
//  수는 config.js UNIQUE_ASSIST (확인표 1040~1047 · 10/14 강화 수는 owner_defaults_table.md 끝, 사장님 확인 전). 끄기 `?uniqueAssist=0`.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { UNIQUE_ASSIST as UA, SKILL } from './config.js';
import { G, TECH, TECH_BY_NAME } from './ai_techniques.js';
import { TRADITIONS } from './schools.js';
import { segDist } from './skill.js';

// ── 고유 동작 표 (디렉터 안 → 사장님 확정 10/13 22:3x. 바뀌면 여기 한 곳만 고친다) ──
//  유파마다 넷 = 발 기술 1 · 공유 2 · 대표 1. stage = 그 동작이 열리는 성장 단계(1~4). name = schools.js 그 유파 unique 의 이름(path 가 있으면 그 이름의 길을 빌림).
//  on = 여는 조건 목록(하나라도 맞으면):
//   { tech }        이 긋기가 그 기본 동작(시작 패드 + 첫 방향)
//   { pad, dir }    시작 패드 + 방향('up' | 'down' | 'horiz')
//   { prev, when, dir? } 앞 긋기 뒤: prev = 'cut' | 'thrust' | 기본 동작 이름 · when = 'bound'(앞 긋기가 칼에 맞물림·막힘) | 'miss'(못 맞힘 — 막힘 포함) |
//                   'any'(맞든 빗나가든) — 셋 다 앞 긋기가 끝나고 afterWindow 안 · 'turn'(앞 찌르기가 시작되고 turnWindow 안에 방향을 허용 각 넘게 꺾음)
//  far = 조건으로 여는 동작이지만 길과의 거리(joinMax)를 보지 않는다(겹치기: 맞물린 자리가 길에서 멀어도 다음 긋기 방향만 맞으면 — 어긋남은 blend 로 줄어든다)
//  anchor 'start' = 고유 동작 길이 기본 긋기보다 짧아 손이 곧 지나쳐 버리는 것(코테·좌익격 — 끝 자리가 긴 자세 바로 밑): 길 토막을 긋기 시작 자리에 옮겨 놓고 그 위에서 잇는다
//  chain = 두 번 잇는 동작: at = 뒷부분이 시작되는 길 점 번호(점 목록 = [from, ...path] 또는 [가짜 자리, ...then]) · dir = 그 자리에서 손가락이 그쪽으로 그어야 이음
//  탭 찌르기도 '내 찌르기'로 센다(prev 'thrust' — 맞물림·any). 이베리아 rodaCounter(길 없는 맞받아치기 목록)는 플레이어 표에서 뺀다(AI 데이터는 그대로)
//  body = 플레이어 강화의 몸 꼴 (10/14, 플레이어만 — AI 는 읽지 않는다) [골반 돌림 °, 가슴 돌림 °, 숙임 °, 낮춤 m] · body2 = 잇는 동작 뒷몫(플레이어가 이어 그은 긋기)의 몸 꼴(없으면 body).
//   돌림 부호는 자세표(guards.js)와 같음(+ 오른쪽으로 감음 · − 왼쪽). 값 = 고유 동작 몸 꼴 점검(10/12 …/body-audit-2q36ha, 모두 [추정]·[해석])의 절반 안팎 — 사장님 확인 전.
//   한 동작 안에서 두 방향으로 도는 것(머리 위 돌려 베기 +40 → −40 등)은 앞 긋기 = 앞 방향, 이어 그은 뒷몫 = 뒤 방향. 세기는 UNIQUE_ASSIST.enhance 로 한꺼번에
export const PLAYER_UNIQUE = {
  german: [
    { stage: 1, name: 'zwerchAbtritt', body: [-15, -20, 1.5, 0.025], on: [{ tech: 'zwerch' }] }, // 비껴 딛는 가로베기 ← 가로베기
    { stage: 2, name: 'krumphau', body: [-8, -10, 4, 0.015], on: [{ tech: 'zornhau' }] }, // 굽은 베기 ← 분노의 베기
    { stage: 3, name: 'duplieren', far: true, body: [5, -3, 3, 0], on: [{ prev: 'cut', when: 'bound' }], chain: { at: 1 } }, // 겹치기 ← 내 베기가 맞물린 뒤 다음 긋기 (맞물린 자리가 어디든 — 칼자루를 들어 다시 머리로)
    { stage: 4, name: 'schielhau', body: [12, 8, 2, 0.02], on: [{ tech: 'stichOchs' }] }, // 곁눈 베기 ← 황소 찌르기
  ],
  italian: [
    { stage: 1, name: 'inquartata', body: [18, 10, 5, 0.025], on: [{ tech: 'stichPflugL' }] }, // 비껴서며 찌르기 ← 왼 쟁기 찌르기
    { stage: 2, name: 'imbroccata', body: [10, 12, 8, 0.04], on: [{ tech: 'stichOchs' }] }, // 위에서 내려 찌르기 ← 황소 찌르기
    { stage: 3, name: 'cavazione', nameKo: '칼끝 돌려 빼기 (cavazione)', body: [5, 8, 4, 0.02], on: [{ prev: 'thrust', when: 'bound' }, { prev: 'thrust', when: 'turn' }] }, // 칼끝 돌려 빼기(속임 then 길) ← 내 찌르기가 맞물림 · 찌르다 꺾음
    { stage: 4, name: 'passataSotto', body: [8, 5, 12, 0.08], on: [{ tech: 'stichPflug' }] }, // 밑으로 들어가 찌르기 ← 쟁기 찌르기 (런지 자세는 이탈리아 비기 몫 — 붙이지 않음)
  ],
  iberian: [
    { stage: 1, name: 'talhoRodeado', body: [15, 8, 4, 0.02], on: [{ tech: 'zornhau' }] }, // 둥근 걸음 탈류 ← 분노의 베기
    { stage: 2, name: 'altibaixo', body: [8, 5, 10, 0.03], body2: [8, 5, 0, 0.03], on: [{ tech: 'oberhau' }], chain: { at: 2, dir: 'up' } }, // 위아래 사슬 ← 정수리 베기 (내려벤 뒤 위로 이어 그으면 되올림)
    { stage: 3, name: 'redondo', body: [12, 8, 2, 0], body2: [-12, -8, 2, 0], on: [{ tech: 'zwerch' }], chain: { at: 3 } }, // 머리 위 돌려 베기 ← 가로베기
    { stage: 4, name: 'talhoRevezBaixo', body: [8, 6, -2, 0.04], body2: [-8, -6, -2, 0], on: [{ tech: 'unterhau' }], chain: { at: 2 } }, // 번갈아 올려베기 ← 올려베기
  ],
  japanese: [
    { stage: 1, name: 'hirakiGiri', body: [-18, -12, 2, 0.02], on: [{ tech: 'zornhauL' }] }, // 히라키기리 ← 왼 분노의 베기
    { stage: 2, name: 'kote', anchor: 'start', body: [5, 3, 4, 0.015], on: [{ pad: 'langort', dir: 'down' }] }, // 코테 ← 가운데(긴 자세)에서 짧게 내려베기 (머리 위 시작 정수리 베기와는 시작 패드로 가름)
    { stage: 3, name: 'tsubameGaeshi', body: [0, 0, 5, 0.02], body2: [0, 0, 0, 0.02], on: [{ prev: 'oberhau', when: 'miss', dir: 'up' }], chain: { at: 2 } }, // 츠바메가에시 ← 정수리 베기가 빗나가거나 막힌 뒤 위로 이어 그음
    { stage: 4, name: 'kokoRenda', body: [12, 8, 3, 0.015], body2: [-12, -8, 3, 0.015], on: [{ tech: 'zornhau' }], chain: { at: 2 } }, // 코코 연타 ← 분노의 베기
  ],
  chinese: [
    { stage: 1, name: 'chebuYaoji', body: [-15, -20, 1.5, 0.02], on: [{ tech: 'zwerch' }] }, // 체보요격 ← 가로베기
    { stage: 2, name: 'zuoyi', anchor: 'start', body: [5, 3, 5, 0.015], on: [{ pad: 'langort', dir: 'down' }] }, // 좌익격 ← 코테와 같음
    { stage: 3, name: 'lianchi', body: [-15, -20, 0, 0], on: [{ prev: 'stichPflug', when: 'turn' }] }, // 염시(속임 then 길) ← 쟁기 찌르기를 시작했다가 짧은 창 안에 거둠
    // 자→격 (刺→擊): 새 표 항목이지만 새 길은 없다 — yaoji 길(긴 자세 자리에서 시작하는 허리 베기). 출처는 schools.js ciji 패시브와 같은 「向前進步腰擊」
    { stage: 4, name: 'ciji', path: 'yaoji', nameKo: '자→격 (刺→擊)', body: [-15, -20, 1.5, 0.015], on: [{ prev: 'thrust', when: 'any', dir: 'horiz' }] }, // ← 내 찌르기(맞든 빗나가든) 뒤 짧은 창 안의 가로 긋기
  ],
};

/**
 * AI 숙련도 거르기 (사장님 결정 10/13 22:4x '숙련도 수치에 따라 쓸지 말지' — docs/strike/ai_proficiency_2026-10-13.md): 위 표를 AI 쪽에서 읽는 자리.
 *  유파 tradition 의 { unique: 고유 동작 이름 → 단계, passive: 패시브 이름 → 단계 }. AI 는 단계 ≤ 숙련도인 것만 쓴다(sword_art.js applySchoolArt · ai.js).
 *  표 이름이 그 유파 unique 의 이름이면 그 동작. path 로 길을 빌린 항목(동방 자→격 ciji → yaoji)은 AI 쪽에서 빌린 길(단독 동작 yaoji)과
 *  같은 이름의 패시브(schools.js ciji 고리 — yaoji 이음) 둘 다. 표에 없는 것(이베리아 rodaCounter 맞받아치기 목록, 그 밖의 패시브)은 거르지 않는다
 */
export function aiUniqueStages(tradition) {
  const unique = new Map();
  const passive = new Map();
  for (const e of PLAYER_UNIQUE[tradition] ?? []) {
    unique.set(e.path ?? e.name, e.stage);
    if (e.path) passive.set(e.name, e.stage);
  }
  return { unique, passive };
}

const D2R = Math.PI / 180;
const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const hyp = (x, y) => Math.hypot(x, y);
/** 두 2D 방향 사이 각(°) */
function angDeg(a, b) {
  const na = hyp(a[0], a[1]);
  const nb = hyp(b[0], b[1]);
  if (na < 1e-9 || nb < 1e-9) return 180;
  return Math.acos(THREE.MathUtils.clamp((a[0] * b[0] + a[1] * b[1]) / (na * nb), -1, 1)) / D2R;
}
/** 방향 조건 'up' | 'down' | 'horiz' */
function dirOk(d, want) {
  if (want === 'up') return angDeg(d, [0, 1]) <= UA.angle;
  if (want === 'down') return angDeg(d, [0, -1]) <= UA.angle;
  if (want === 'horiz') return Math.min(angDeg(d, [1, 0]), angDeg(d, [-1, 0])) <= UA.angle;
  return true;
}
/** 토막 AB 에서 p 에 가장 가까운 점 */
function closest(A, B, p) {
  const ex = B[0] - A[0];
  const ey = B[1] - A[1];
  const L2 = ex * ex + ey * ey;
  const t = L2 > 1e-12 ? THREE.MathUtils.clamp(((p[0] - A[0]) * ex + (p[1] - A[1]) * ey) / L2, 0, 1) : 0;
  return [A[0] + ex * t, A[1] + ey * t];
}

/** 표 항목의 고유 동작 (schools.js 그 유파 unique 에서): 이름 · 알림 이름 · 칼 종류 · 길 점 · 걸음. 없으면 null */
export function uniqueDef(tradition, e) {
  const list = TRADITIONS[tradition]?.unique ?? [];
  const key = e.path ?? e.name;
  const u = list.find((x) => x.name === key);
  if (!u) return null;
  if (u.feint) {
    const fk = TECH_BY_NAME[u.feint.fake];
    if (!fk) return null;
    const a = u.feint.at;
    const p0 = [fk.from[0] + (fk.path[0][0] - fk.from[0]) * a, fk.from[1] + (fk.path[0][1] - fk.from[1]) * a]; // 가짜 기술을 at 만큼 간 자리 (ai.js startStrike 와 같은 점)
    return { name: e.name, nameKo: e.nameKo ?? u.nameKo ?? u.feint.name, kind: u.feint.open === 'C' ? 'thrust' : 'cut', pts: [p0, ...u.feint.then.map((p) => p.slice())], step: null };
  }
  if (!u.path?.length) return null; // 길 없는 것(맞받아치기 목록 등)은 플레이어 몫이 아니다
  return { name: e.name, nameKo: e.nameKo ?? u.nameKo ?? u.name, kind: u.kind, pts: [u.from.slice(), ...u.path.map((p) => p.slice())], step: u.step ?? null };
}

// ── 해금 (사장님 결정 10/13 22:3x — 주인공 하나 기준) ──
//  여정(foe=stage)에서 무대를 깰 때마다 깬 수 +1 (localStorage — 읽기·쓰기 실패해도 0 으로 그냥 동작). UNIQUE_ASSIST.sealEvery 번마다 인장 하나를
//  sealOrder 유파 차례로 돌아가며 준다(sealMax 개에서 끝). 유파 숙련도 = 그 유파 인장 수(0~5) = 그 유파 무기를 들었을 때 열리는 고유 동작 단계.
//  5 단계(UNIQUE_ASSIST.secretStage) = 그 유파 비기 (사장님 결정 10/13 23:1x — 21~25 번째 인장. 그 전엔 플레이어 비기 창이 안 열린다: main.js PlayerSecretWatch locked).
//  인장 이름(단계별 — 사장님 결정 10/13 23:1x 1 견습생 · 2 숙련자 · 3 전문가 · 4 마스터 · 5 신: 여기 한 곳). 유파 이름은 TRADITIONS[유파].nameKo 를 그때 읽는다(글자를 박지 않는다)
export const SEAL_NAMES = ['견습생', '숙련자', '전문가', '마스터', '신'];
const CLEAR_KEY = 'stillness.journeyClears.v1';
let clearsOverride = null; // 시험용 `?clears=N` (main.js setClearsOverride): 있으면 저장소 대신 이 값을 쓰고 깬 수도 여기에만 더한다
export function setClearsOverride(n) {
  const v = n == null || n === '' ? NaN : Number(n);
  clearsOverride = Number.isInteger(v) && v >= 0 ? v : null;
  return clearsOverride;
}
/** 지금까지 깬 무대 수 */
export function journeyClears() {
  if (clearsOverride != null) return clearsOverride;
  try {
    const n = Number(localStorage.getItem(CLEAR_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}
/** 무대를 하나 깸 (main.js — 여정에서 이겨 다음 무대로 넘어가는 판): 깬 수 +1. { clears, seal } — seal = 이번에 얻은 인장 { k, school, stage } (없으면 null) */
export function addJourneyClear() {
  const before = journeyClears();
  const clears = before + 1;
  if (clearsOverride != null) clearsOverride = clears;
  else {
    try {
      localStorage.setItem(CLEAR_KEY, String(clears));
    } catch {
      /* 저장 못 해도 이번 판은 그대로 */
    }
  }
  const k = sealCount(clears);
  return { clears, seal: k > sealCount(before) ? sealAt(k) : null };
}
/** 깬 수 → 받은 인장 수 (sealMax 에서 멈춤) */
export function sealCount(clears) {
  return Math.min(UA.sealMax, Math.floor(Math.max(0, clears) / UA.sealEvery));
}
/** 인장 k(1부터): { k, school: sealOrder[(k−1) mod 5], stage: ⌊(k−1)/5⌋+1 } */
export function sealAt(k) {
  const O = UA.sealOrder;
  return { k, school: O[(k - 1) % O.length], stage: Math.floor((k - 1) / O.length) + 1 };
}
/** 유파별 숙련도 (그 유파 인장 수 0~5) */
export function masteryOf(clears) {
  const m = Object.fromEntries(UA.sealOrder.map((s) => [s, 0]));
  for (let k = 1; k <= sealCount(clears); k++) m[sealAt(k).school]++;
  return m;
}
/** 이번 판의 해금 단계 (손에 든 무기 유파): 주소 ?uniqueStage=0..5(모든 유파) > 테스트 경로(testStage) > 그 유파 숙련도. 5 = 비기까지 (secretStage) */
export function uniqueStageFor(tradition, { test = false, param = null, clears = journeyClears() } = {}) {
  const p = param == null || param === '' ? NaN : Number(param);
  if (Number.isInteger(p) && p >= 0 && p <= UA.secretStage) return { stage: p, source: 'url' };
  if (test) return { stage: UA.testStage, source: 'test' };
  return { stage: masteryOf(clears)[tradition] ?? 0, source: 'seals' };
}
/** 인장 알림 한 줄 (사장님 결정 10/13 23:1x '독일 유파 신 이렇게'): 「독일 유파 견습생」 인장 — 비껴 딛는 가로베기 열림 · 「동방 유파 신」 인장 — 비기 연환삼격 열림
 *  (유파 이름은 TRADITIONS 에서 · 동작·비기 이름은 괄호 앞) */
export function sealNotice(seal) {
  if (!seal) return '';
  const school = TRADITIONS[seal.school]?.nameKo ?? seal.school;
  const e = (PLAYER_UNIQUE[seal.school] ?? []).find((x) => x.stage === seal.stage);
  const U = e ? uniqueDef(seal.school, e) : null;
  const short = (t) => String(t).replace(/\s*[(·].*$/, '');
  const secret = seal.stage >= UA.secretStage ? TRADITIONS[seal.school]?.secret : null;
  const move = U ? short(U.nameKo) : secret?.nameKo ? `비기 ${short(secret.nameKo)}` : '';
  return `「${school} 유파 ${SEAL_NAMES[seal.stage - 1] ?? ''}」 인장${move ? ` — ${move} 열림` : ''}`;
}

/**
 * 플레이어 한 명의 고유 동작 강화 (10/14 — 궤적은 손가락, 고유 동작은 손가락으로 못 하는 몫만). 붙이면(f.skill.uniq = this) 검술 층이 매 스텝
 *  drive(머리 — 강화 몫 갱신: 몸 덧씌우기 · 끝 힘 · 걸음 다시 부탁) · detect(휘두르기 판단 뒤 — 긋기 읽기·발동·잇는 동작 읽기)를 부른다.
 *  main.js 는 프레임마다 feed(손가락 움직임)를 부르고, 손가락 움직임은 늘 손 목표에 그대로 더한다(손 목표를 쥐지 않는다 — holdsHand 거짓).
 *  열린 동작이 없으면(단계 0 · 표에 없는 유파 · 스위치 끔) 붙지 않는다 → 검술 층은 전과 같다
 */
export class PlayerUniqueAssist {
  constructor(f, { stage = 0, tradition = f.swordArt?.tradition } = {}) {
    this.f = f;
    this.stage = stage;
    this.tradition = tradition;
    this.list = UA.on && !f.weapon?.gun ? (PLAYER_UNIQUE[tradition] ?? []).filter((e) => e.stage <= stage).map((e) => ({ ...e, U: uniqueDef(tradition, e) })).filter((e) => e.U) : [];
    this.r = null; // 강화 중인 긋기 { e, U, part(1 앞 긋기 | 2 잇는 뒷몫), t, travel, len, stepAsked, chainable }
    this.t = 0;
    this.cur = null; // 지금 긋기 { tech, kind, pad, t0, dir, landed, bound, tEnd, unique }
    this.last = null; // 바로 앞 긋기 (끝난 것 — 결과는 다음 긋기가 시작될 때까지 계속 적는다)
    this.chainFrom = null; // 뒷몫을 이을 수 있는 앞 긋기 { e, U, tEnd } — 플레이어가 박자 창(chainWait) 안에 이어 그으면 그 긋기가 뒷몫
    this.tapRec = null; // 진행 중인 탭 찌르기 (끝나면 last 로)
    this.wasSwing = false;
    this.quietT = 1;
    this.restPos = [f.handOffset.x, f.handOffset.y];
    this.blocked = false; // main.js: 막기 버튼·미리 받기가 손을 쥐는 중
    this.painFoe = null;
    this.fv = new THREE.Vector2(); // 손가락 속도 (고른 값, 패드 m/s)
    this.fSpeed = 0;
    this.fIdle = 0;
    this.body = [0, 0, 0, 0]; // 지금 얹은 몸 [골반 돌림 rad, 가슴 돌림 rad, 숙임 rad, 낮춤 m] (덧씌우기 칸 몸 값과 같은 부호 — fighter.js updateBodyPose)
    this.powV = 0; // 내가 둔 끝 힘 배율 (f.powerMul 이 아직 이 값일 때만 되돌린다)
    this.stats = { strokes: 0, techs: {}, fired: {}, ends: {}, steps: 0, power: 0 };
    f.uniqueCue = null;
    f.skill.uniqBody = null;
    f.skill.uniq = this.list.length ? this : null;
  }

  /** 강화 중인가 (손 목표는 쥐지 않는다) */
  get running() {
    return !!this.r;
  }
  /** 손 목표를 쥐나 — 이 판은 늘 거짓(손가락이 궤적을 낸다). 탐침·main.js 가 읽는다 */
  get holdsHand() {
    return false;
  }

  /** 프레임마다 (main.js): 이번 프레임 손가락 움직임(패드 m)·프레임 시간·손을 쥔 다른 동작이 있나 */
  feed(dx, dy, dt, blocked = false) {
    this.blocked = blocked;
    if (!(dt > 0)) return;
    const k = 1 - Math.exp(-dt / UA.fingerTau);
    this.fv.x += (dx / dt - this.fv.x) * k;
    this.fv.y += (dy / dt - this.fv.y) * k;
    this.fSpeed = this.fv.length();
    this.fIdle = Math.abs(dx) + Math.abs(dy) > 1e-5 ? 0 : this.fIdle + dt;
  }

  /** 발동하지 않는 때: 다른 플레이어 동작이 돌거나 칼을 못 쓰는 때 */
  busy() {
    const f = this.f;
    const sk = f.skill;
    return this.blocked || !UA.on || !!sk.sec || !!sk.tap || !!sk.pom || !!sk.vitalRange || !f.alive || !f.armed || f.weaponBroken || f.state !== 'stand' || !f.foe || f.finish?.amt > 0.5;
  }

  /** 긋기 결과 적기: 맞힘(상대 아픔 +0.05 — 비기와 같은 눈) · 칼 맞물림(ai.js checkBind 와 같은 기하 0.07 m). 탭 찌르기도 한 긋기로 센다 */
  track() {
    const f = this.f;
    const sk = f.skill;
    if (sk.tap && !this.tapRec) this.tapRec = { tech: 'tap', kind: 'thrust', tap: true, t0: this.t, dir: [0, 0], landed: false, bound: false, tEnd: null };
    if (!sk.tap && this.tapRec) {
      this.tapRec.tEnd = this.t;
      this.last = this.tapRec;
      this.tapRec = null;
    }
    const foe = f.foe;
    if (!foe) return;
    const rec = this.tapRec ?? this.cur ?? this.last;
    if (this.painFoe != null && rec && foe.pain > this.painFoe + 0.05) rec.landed = true;
    this.painFoe = foe.pain;
    if (rec && !rec.bound && foe.armed && f.tipPrev && foe.tipPrev && segDist(f.bladePoint(0.1, _a), f.tipPrev, foe.bladePoint(0.1, _b), foe.tipPrev) < 0.07) rec.bound = true;
  }

  closeStroke(tEnd) {
    this.cur.tEnd = tEnd;
    this.last = this.cur;
    this.cur = null;
    if (this.r) this.end('done', tEnd);
  }

  /** 시작 자리·처음 방향 → 기본 동작 (시작 패드가 그 동작의 from 이고 첫 방향이 허용 각 안). { pad, tech, kind } */
  classify(start, dir) { return classifyStroke(start, dir); }

  condOk(c, cur, dir, now) {
    if (c.tech && cur.tech !== c.tech) return false;
    if (c.pad && cur.pad !== c.pad) return false;
    if (c.dir && !dirOk(dir, c.dir)) return false;
    if (!c.prev) return true;
    const L = this.last;
    if (!L) return false;
    if (c.prev === 'cut' || c.prev === 'thrust' ? L.kind !== c.prev : L.tech !== c.prev) return false;
    if (c.when === 'turn') return !L.tap && now - L.t0 <= UA.turnWindow && angDeg(dir, L.dir) > UA.angle;
    if (L.tEnd == null || now - L.tEnd > UA.afterWindow) return false;
    if (c.when === 'bound') return L.bound;
    if (c.when === 'miss') return !L.landed;
    return true;
  }

  /**
   * 고유 동작 꼴과 맞나 (발동 판단만 — 손 목표는 옮기지 않는다): 길 토막마다 지금 손에서 가장 가까운 점 J, 어긋남 o = 손 − J 를 남은 길의 blend 몫에 걸쳐 0 으로 줄인 점들.
   *  지금 손에서 첫 점으로 가는 방향이 손가락 방향과 허용 각 안인 토막만 — 그 가운데 어긋남이 가장 작은 것(같으면 앞 토막).
   *  maxO = 어긋남 상한(조건으로 여는 동작만). 없으면 null. (10/13 이어 주기의 길 들어가기 판단을 그대로 — 발동 맞음/틀림이 전과 같게)
   */
  join(pts0, hand, dir, maxO, start = null) {
    let best = null;
    for (let k = 0; k < pts0.length - 1; k++) {
      const pts = start ? pts0.map((p) => [p[0] + start[0] - pts0[k][0], p[1] + start[1] - pts0[k][1]]) : pts0; // anchor 'start': 이 토막의 시작을 긋기 시작 자리에
      const J = closest(pts[k], pts[k + 1], hand);
      const ox = hand[0] - J[0];
      const oy = hand[1] - J[1];
      const on = hyp(ox, oy);
      if (on > maxO) continue;
      const rest = [J, ...pts.slice(k + 1)];
      const cum = [0];
      for (let i = 1; i < rest.length; i++) cum.push(cum[i - 1] + hyp(rest[i][0] - rest[i - 1][0], rest[i][1] - rest[i - 1][1]));
      const total = cum[cum.length - 1];
      if (total < 1e-3) continue;
      const tg = [];
      for (let i = 1; i < rest.length; i++) {
        const s = cum[i] / (UA.blend * total);
        const w = s >= 1 ? 0 : 1 - s * s * (3 - 2 * s);
        tg.push([rest[i][0] + ox * w, rest[i][1] + oy * w]);
      }
      let first = 0;
      while (first < tg.length - 1 && hyp(tg[first][0] - hand[0], tg[first][1] - hand[1]) < 1e-3) first++;
      if (angDeg(dir, [tg[first][0] - hand[0], tg[first][1] - hand[1]]) > UA.angle) continue;
      if (!best || on < best.o - 1e-6) best = { k, o: on, tg };
    }
    return best;
  }

  /**
   * 열린 동작 가운데 이 긋기에 맞는 것: 앞 긋기 조건(더 좁은 것)이 먼저, 그 안에선 길과의 어긋남이 작은 것.
   *  10/14: 앞 긋기 조건으로 여는 것(겹치기·카바치오네·츠바메가에시·염시·자→격)은 표의 조건(앞 긋기·창·방향)만 본다 — 10/13 판의 '길까지 거리(joinMax)·길 첫 방향' 은
   *  손을 그 길로 끌고 들어가기 위한 것이었다. 이제 손은 손가락이 둔 자리라(10/13 판은 앞 고유 동작이 손을 길 끝에 두었다) 그 판단이 뜻이 없다. 기본 동작으로 여는 것은 join 그대로
   */
  choose(cur, hand, dir, now) {
    let best = null;
    for (const e of this.list) {
      if (!e.on.some((c) => this.condOk(c, cur, dir, now))) continue;
      const after = e.on.some((c) => c.prev);
      const j = after ? { o: 0 } : this.join(e.U.pts, hand, dir, Infinity, e.anchor === 'start' ? cur.start : null);
      if (!j) continue;
      const rank = after ? 0 : 1;
      if (!best || rank < best.rank || (rank === best.rank && j.o < best.j.o - 1e-6)) best = { e, j, rank };
    }
    return best;
  }

  /** 기술 걸음 (ai.js techStepRequest 와 같은 꼴): 비껴 가는 쪽 발이 앞발이면 내딛고(lunge), 뒷발이면 앞발을 지나(pass). 받으면 true. 걸음 크기 × min(1, 세기) */
  askStep(st) {
    const f = this.f;
    const g = f.gait;
    if (!g?.requestStep || !g.active || f.state !== 'stand') return false;
    const k = Math.min(1, UA.enhance);
    const front = g.frontLeg(f.forward(_v));
    const lead = Math.sign(g.legs[front].side) === Math.sign(st.lat);
    const ok = g.requestStep({ kind: st.kind ?? (lead ? 'lunge' : 'pass'), fwd: st.fwd * k, side: st.lat * k, duration: st.dur ?? 0.35 });
    if (ok) this.stats.steps++;
    return ok;
  }

  /** 새 긋기로 보는 꺾임 각: 시작한 지 turnWindow 안의 찌르기는 허용 각(꺾음 — 카바치오네·염시), 그 밖엔 turnDeg */
  turnAt(now) {
    const c = this.cur;
    return c && c.kind === 'thrust' && now - c.t0 <= UA.turnWindow ? UA.angle : UA.turnDeg;
  }

  /** 길 점들 pts[a..b] 의 길이 (끝 힘이 들어가는 '뒷몫' 을 재는 잣대) */
  static lenOf(pts, a = 0, b = pts.length - 1) {
    let L = 0;
    for (let i = a + 1; i <= b; i++) L += hyp(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return L;
  }

  /** 매 스텝, 검술 층이 휘두르기를 판단한 뒤: 긋기 시작을 읽고 맞으면 강화를 연다 (잇는 동작의 뒷몫이 먼저) */
  detect(dt, swinging) {
    const now = this.t;
    this.track();
    const was = this.wasSwing;
    this.wasSwing = swinging;
    const f = this.f;
    const hand = [f.handOffset.x, f.handOffset.y];
    if (this.r) this.r.travel += hyp(f.skill.vel.x, f.skill.vel.y) * dt; // 이 긋기에서 손 목표가 간 길 (끝 힘 '뒷몫' 판단)
    if (!swinging) {
      this.quietT += dt;
      if (this.cur && this.quietT >= UA.onsetQuiet) this.closeStroke(now - this.quietT);
      if (this.fSpeed < SKILL.swingSpeed) this.restPos = hand; // 시작 자리 = 손가락이 빨라지기 직전 자리 (검술 층 휘두르기 판단은 손 목표 속도를 고르느라 한두 프레임 늦다)
      return;
    }
    this.quietT = 0;
    const v = f.skill.vel;
    const sp = hyp(v.x, v.y);
    const dir = [v.x / sp, v.y / sp];
    let start = null;
    const turnAt = this.turnAt(now);
    if (!was) start = this.cur && angDeg(dir, this.cur.dir) <= turnAt ? null : this.restPos; // 짧은 끊김에 같은 쪽이면 같은 긋기
    else if (!this.cur) start = hand;
    else if (angDeg(dir, this.cur.dir) > turnAt) start = hand; // 휘두르는 채로 꺾음 = 새 긋기 (꺾인 자리에서)
    if (!start) return;
    if (this.cur) this.closeStroke(now);
    const c = this.classify(start, dir);
    const cur = (this.cur = { tech: c.tech, kind: c.kind, pad: c.pad, t0: now, dir, start, landed: false, bound: false, tEnd: null, unique: null });
    this.stats.strokes++;
    this.stats.techs[c.tech ?? '-'] = (this.stats.techs[c.tech ?? '-'] ?? 0) + 1;
    const C = this.chainFrom;
    this.chainFrom = null;
    if (this.busy()) return;
    // 잇는 동작의 뒷몫: 앞 긋기가 그 고유 동작이었고, 플레이어가 박자 창(chainWait) 안에 다시 그었고(방향 조건이 있으면 그쪽) — 자동으로 두 번째 칼을 내지 않는다
    if (C && now - C.tEnd <= UA.chainWait && (!C.e.chain.dir || dirOk(dir, C.e.chain.dir))) return this.start(C.e, cur, 2);
    const pick = this.choose(cur, hand, dir, now);
    if (pick) this.start(pick.e, cur, 1);
  }

  /** 강화 시작: part 1 = 고유 동작으로 읽힌 긋기 · part 2 = 잇는 동작의 뒷몫 (플레이어가 이어 그은 긋기) */
  start(e, cur, part) {
    const f = this.f;
    const U = e.U;
    const at = e.chain ? Math.min(e.chain.at, U.pts.length - 1) : U.pts.length - 1;
    const len = part === 2 ? PlayerUniqueAssist.lenOf(U.pts, at) : PlayerUniqueAssist.lenOf(U.pts, 0, at);
    this.r = { e, U, part, t: 0, travel: 0, len: Math.max(0.05, len), stepAsked: false };
    cur.kind = part === 2 ? cur.kind : U.kind;
    cur.unique = U.name;
    if (part === 2) {
      this.stats.ends.chained = (this.stats.ends.chained ?? 0) + 1;
      return;
    }
    this.stats.fired[U.name] = (this.stats.fired[U.name] ?? 0) + 1;
    f.uniqueCue = { text: U.nameKo, kind: 'unique', who: 'me', schoolKo: TRADITIONS[this.tradition]?.nameKo ?? '', name: U.name, t: this.t };
    if (U.step && UA.enhance > 0) this.r.stepAsked = this.askStep(U.step);
  }

  /** 매 스텝, 검술 층 머리 (비기 updateSecret 자리 옆): 강화 몫 갱신 — 손 목표는 건드리지 않는다 */
  drive(dt) {
    this.t += dt;
    const f = this.f;
    const R = this.r;
    const E = UA.enhance;
    if (R) {
      R.t += dt;
      if (this.busy()) this.end('yield');
      else if (R.U.step && !R.stepAsked && E > 0 && R.t < 0.3) R.stepAsked = this.askStep(R.U.step); // 못 받았으면(뒤로 당긴 스틱 등) 잠깐 다시 부탁 (AI 와 같음)
    }
    const r = this.r;
    // ② 몸: 긋는 동안 표의 몸 꼴(body · 뒷몫은 body2)을 bodyIn 초에 얹고, 긋기가 끝나면 bodyOut 초에 걷는다 (덧씌우기 칸 몸 값 — fighter.js updateBodyPose 가 더한다)
    const B = r && E > 0 ? (r.part === 2 ? r.e.body2 ?? r.e.body : r.e.body) : null;
    const k = Math.min(1, dt / (B ? UA.bodyIn : UA.bodyOut));
    let any = false;
    for (let i = 0; i < 4; i++) {
      const tgt = B ? B[i] * (i < 3 ? D2R : 1) * E : 0;
      this.body[i] += (tgt - this.body[i]) * k;
      if (Math.abs(this.body[i]) > 1e-4) any = true;
      else if (!B) this.body[i] = 0;
    }
    const sk = f.skill;
    if (any) {
      const ub = (sk.uniqBody ??= { pelvisYaw: 0, chestYaw: 0, pitch: 0, drop: 0 });
      ub.pelvisYaw = this.body[0];
      ub.yawRate = dt > 0 ? (this.body[1] - ub.chestYaw) / dt : 0; // 덧씌운 가슴 돌림의 빠르기 (rad/s) — 날 세우기 앞당김(fighter.js inputEdgeLead)이 읽는다
      ub.chestYaw = this.body[1];
      ub.pitch = this.body[2];
      ub.drop = this.body[3];
    } else if (sk.uniqBody) sk.uniqBody = null;
    // ③ 끝 힘: 긋기 뒷몫(손 목표가 그 몫 길이의 powerAt 넘게 간 뒤 · 시작부터 powerMax 초까지)에 팔 서보 힘 × (1 + (endPower − 1)·세기) — 비기 힘 창 SECRET.power 와 같은 칸(f.powerMul)
    const pv = r && E > 0 && r.travel >= UA.powerAt * r.len && r.t <= UA.powerMax ? 1 + (UA.endPower - 1) * E : 0;
    if (pv) {
      if (f.powerMul === 1 || f.powerMul === this.powV) {
        if (!this.powV) this.stats.power++;
        f.powerMul = pv;
        this.powV = pv;
      }
    } else this.dropPower();
  }

  /** 내가 둔 끝 힘을 걷는다 (다른 동작이 바꿔 놓았으면 그대로 둔다) */
  dropPower() {
    if (!this.powV) return;
    if (this.f.powerMul === this.powV) this.f.powerMul = 1;
    this.powV = 0;
  }

  /** 강화 끝: done = 긋기가 끝남(쉼·꺾음) · yield = 다른 동작에 내줌. 잇는 동작의 앞 긋기가 끝나면 뒷몫을 기다린다 */
  end(why, tEnd = this.t) {
    const R = this.r;
    this.r = null;
    this.dropPower();
    this.stats.ends[why] = (this.stats.ends[why] ?? 0) + 1;
    if (why === 'done' && R?.part === 1 && R.e.chain) this.chainFrom = { e: R.e, U: R.U, tEnd };
  }
}

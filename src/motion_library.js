// ─────────────────────────────────────────────────────────────
//  동작 라이브러리 (무기 PM — 사장님: "분류에 이어 동작 개발까지", 다음 버전 게임에 쓸 바탕. docs/weapon_motions.md)
//
//  무기 유형(weapon_class.js: 몸 틀 × 싸움 방식)마다 동작 세 층을 모은다.
//   1) 자세표 (몸 틀별): 같은 패드 자리(손가락 위치)를 그 전통의 자세로 다시 읽는다.
//      예) 패드 "머리 위"는 롱소드에선 지붕(Vom Tag), 양손 앞무게에선 상단(上段), 한손에선 머리 막기(St. George).
//      guards.js guardAt 이 fighter.guardPose.table 을 읽는다(없으면 예전 표 그대로).
//      → 패드 자리가 같으니 플레이어 입력·AI 기술 길(자세에서 자세로)이 그대로 통한다. 같은 손놀림이 무기마다 다른 몸놀림이 된다.
//   2) 기술 목록 (싸움 방식별 + 몸 틀 덧붙임): AI 가 고르는 기술(ai_techniques.js TECH 모양 — 시작 자세, 손이 지나갈 점들, 노리는 빈틈).
//   3) 덧씌우는 동작 (몸 틀·방식별): 찌르기의 런지처럼 검술 층(skill.js)이 덧씌우는 것 — THRUST 값 덮어쓰기로 준다.
//
//  지금 게임은 이 파일을 읽지 않는다(MOTION.lib 이 꺼져 있고, 켜는 곳은 점검 도구뿐). 켜려면 applyMotionLibrary(fighter).
//  숫자 근거: [원전]·[해석]·[추정] 표시는 docs/weapon_motions.md 에 있다. 여기 적은 값은 모두 몸 크기(키 1.75 m)에 맞춘 추정이다.
// ─────────────────────────────────────────────────────────────
import { GUARD_BASE, GUARD_BASE_ONE } from './guards.js';
import { TECH, FEINTS, G, WATCH_GUARDS, TECH_BY_NAME } from './ai_techniques.js';
import { THRUST, SKILL } from './config.js';

export const MOTION = {
  lib: false, // 게임 기본은 끔. 점검 도구(tools/sim/motion_lab.mjs)가 켠다
  coverIn: 0.08, // 막기 덧씌우기: 덮는 시간(초)
  coverOut: 0.15, // 걷는 시간(초)
  useParry: false, // 무기별 막기 자리(LIB_PARRY)를 AI 에 끼울까 — 기본 끔: 바뀐 자세표(막기 자세 포함)로 잰 값이라 지금 표와 맞지 않는다
  poleStrikes: new Set(), // 점검용: E 자루에 찌르기 말고 더 줄 칼 기술 이름 (봉 치기 새 길이 생기기 전 시험)
  skip: new Set(), // 점검용: 이 이름의 자세 자리는 바꾸지 않는다 (어느 자세가 싸움에 해로운지 가려낼 때)
};

const D2R = Math.PI / 180;

/** 교본 자세 한 칸을 새 값으로 (각도는 도로 적는다 — guards.js RAW 와 같은 모양) */
function remake(g, o) {
  const blade = o.blade ?? [Math.asin(Math.max(-1, Math.min(1, g.dir[1]))) / D2R, Math.atan2(g.dir[2], g.dir[0]) / D2R];
  const el = blade[0] * D2R;
  const az = blade[1] * D2R;
  return {
    ...g,
    name: o.name ?? g.name,
    desc: o.desc ?? g.desc,
    hand: o.hand ?? g.hand,
    dir: o.blade ? [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)] : g.dir,
    pelvisYaw: o.pelvisYaw != null ? o.pelvisYaw * D2R : g.pelvisYaw,
    chestYaw: o.chestYaw != null ? o.chestYaw * D2R : g.chestYaw,
    pitch: o.pitch != null ? o.pitch * D2R : g.pitch,
    drop: o.drop ?? g.drop,
    src: o.src ?? null,
  };
}
function table(base, overrides) {
  return base.map((g) => (overrides[g.name] ? remake(g, overrides[g.name]) : g));
}

// ── 1) 자세표 ──────────────────────────────────────────────
// 패드 자리 이름(guards.js 교본 이름) → 그 몸 틀의 자세. 적지 않은 자리는 바탕 표 그대로
export const FRAME_GUARDS = {
  // A 양손 보통: 지금 롱소드 표 그대로 (리히테나워·마이어)
  two: {},

  // B 양손 앞무게 (츠바이핸더·모노호시자오·참치): 칼을 미리 높이 들거나 어깨에 메고 기다렸다 한 칼에 내리친다.
  //  몬탄테(고디뉴 1599·피게이레두 1651)의 "어깨에서 탈류(talho)·레베스(revés)를 번갈아", 일본 오다치의 상단·팔상.
  //  칼끝을 뒤로 눕혀 두면 무거운 칼끝이 내려오는 길이 길어 가속할 시간을 번다(롱소드 지붕 100° → 상단 135°)
  heavy: {
    '지붕 (Vom Tag)': { name: '상단 (上段)', desc: '칼자루를 이마 위로, 칼끝은 뒤로 눕힌다 · 한 칼로 내려벤다', hand: [0.2, 0.46, 0.05], blade: [115, 0], pelvisYaw: 15, chestYaw: 15, pitch: -2, drop: 0.05, src: 'kendo jōdan: 이마 위 한 주먹, 칼 45°, 칼끝 뒤 [원전 2차]' },
    '어깨 지붕 (Vom Tag)': { name: '팔상 (八相) · 어깨 메기', desc: '칼자루를 오른 어깨 앞에 세우고 칼끝을 뒤로 · 사선으로 내려벤다', hand: [0.12, 0.22, 0.2], blade: [70, 165], pelvisYaw: 35, chestYaw: 45, pitch: 2, drop: 0.06, src: 'hassō: 칼자루 오른 어깨 앞, 칼 약 45°로 뒤로 기움 [원전 2차] · 츠바이핸더는 어깨에 메고 다녔다 [원전 2차]' },
    '왼쪽 어깨 지붕': { name: '왼 팔상 · 레베스 준비', desc: '칼을 왼 어깨에 세운 자세 · 반대쪽 사선 베기(revés)', hand: [0.16, 0.22, -0.12], blade: [70, -165], pelvisYaw: -30, chestYaw: -40, pitch: 2, drop: 0.06, src: '몬탄테 첫 규칙: 오른 어깨에서 탈류, 왼 어깨에서 레베스 [원전 2차]' },
    // (시도했다 뺌) 황소·옆 자세를 무거운 칼이 버티게 고치면(손을 몸 쪽으로, 칼을 세움) 자세는 버티지만(16.9 → 6.1 cm, 20.1 → 2.6 cm)
    //  두 자리가 베기 경유점이라 싸움은 나빠졌다(참치 25 → 10%, 모노호시자오 46 → 33%) — 규칙 1 (docs/weapon_motions.md §5-2).
    //  왼 팔상도 손을 앞으로 [0.24, 0.2, −0.1] 옮기면 츠바이핸더는 17.7 → 13.2 cm 로 버티지만 모노호시자오가 46 → 31% (왼 분노의 베기 시작점)
    '긴 자세 (Langort)': { name: '중단 (中段)', desc: '칼끝을 상대 목에 두고 손은 배꼽 앞 · 무거운 칼을 오래 뻗지 않는다', hand: [0.38, -0.1, 0.03], blade: [12, 0], pelvisYaw: -5, chestYaw: -5, pitch: 4, drop: 0.07, src: 'chūdan [원전 2차] · 무거운 칼끝을 뻗어 들고 있기 어렵다 [추정]' },
    '옆 지킴 (Nebenhut)': { name: '협 (脇構え)', desc: '칼을 오른 허리 뒤로 숨겨 칼끝을 뒤 아래로 · 길이를 감춘다', hand: [0.05, -0.25, 0.2], blade: [-35, 160], pelvisYaw: 45, chestYaw: 50, pitch: 4, drop: 0.08, src: 'waki-gamae: 칼 길이를 몸 뒤로 감추고 칼끝 45° 아래 [원전 2차]' },
  },

  // C 한손 (세이버·팔쉬온·청강검·레이피어·나뭇가지·고무 닭): 한손 자세표(10라운드 R2) 위에 한손 칼 교본 자세.
  //  세이버(앵젤로 1798·로워스·허턴 1889)의 걸친 막기·머리 막기, 레이피어(카포 페로 1610)의 3번·4번 자세
  one: {
    '긴 자세 (Langort)': { name: '3번 자세 (Terza)', desc: '팔을 곧게 뻗어 칼끝으로 겨누고 몸을 옆으로 세운다 · 런지로 찌른다', src: '카포 페로 3번 자세 [해석] — 손 위치는 R2 한손 뻗기 값' },
    '쟁기 (Pflug)': { name: '바깥 막기 (Seconda)', desc: '손을 허리 바깥에, 칼끝은 상대 얼굴 · 바깥 선을 닫는다', src: '[해석] — 손 위치는 R2 값' },
    // 안쪽 막기(Quarta)는 이름만 붙인다: 손·칼끝을 바꾸면(손 [0.42,−0.10,0.05]·칼끝 [15,8]) 청강검이 50% → 31% (값 그대로 두면 44%) — 이 자리도 베기 길이 지난다
    '왼쪽 쟁기': { name: '안쪽 막기 (Quarta)', desc: '손바닥을 위로 돌려 안쪽 선에, 칼끝은 상대 얼굴 · 안쪽 선을 닫는다', src: '레이피어 4번 자세(quarta) = 손목을 돌린 상태 [원전 2차 카포 페로] — 손 위치는 롱소드 왼쪽 쟁기 그대로' },
  },

  //  머리 막기(St. George)·걸친 막기(Hanging)는 표에 넣지 않는다 → 아래 COVERS (측정: 표의 지붕·황소 자리를 이 막기 자세로 바꾸자
  //  그 자리를 지나는 베기 길이 모두 휘어 세이버 35% → 10%, 나뭇가지 40% → 15%. 둘을 빼면 38%·42% 로 돌아온다)
  // D 사격: 사격 자세는 gun.js gunPose 가 따로 덧씌운다 (자세표는 한손 표 그대로)
  gun: {},
  // E 자루 무기: 로스터에 없다. 아래 POLE_GUARDS(마이어 봉)를 쓴다 — 표를 만들 때 채운다(아래 frameTable). 점검: tools/sim/staff_proto.mjs
  pole: {},
};

// 싸움 방식이 자세표를 더 고치는 몫 (몸 틀 표 위에 덮는다)
//  한손 찌르기(레이피어): 카포 페로 3번 자세 — 몸을 거의 옆으로 세우고(골반 −60·가슴 −70) 뒷무릎을 굽혀 체중을 뒤에, 팔은 굽혀 칼끝만 앞으로.
//  "칼 길이 = 런지 보폭" — 칼끝을 멀리 두고 런지로 한 번에 닿는다
export const STYLE_GUARDS = {
  'one:thrust': {
    // 3번 자세는 이름만(손은 R2 한손 뻗기 값): 카포 페로식으로 팔을 굽히고 옆으로 세우면(손 [0.50,−0.05,0.20]·골반 −55·가슴 −65·낮춤 0.12)
    //  칼끝이 덜 나가 레이피어가 진다 — 96판: 굽힌 3번 39% · 뻗은 3번 47% · 라이브러리 끔 45%. 런지가 굽힌 팔을 메워 주지만 다 메우지는 못한다
    '긴 자세 (Langort)': { name: '3번 자세 (Terza)', desc: '팔을 뻗어 칼끝으로 상대 얼굴을 겨누고 몸을 옆으로 세운다 · 런지로 찌른다', src: '카포 페로 3번 자세 [원전 2차] — 손 위치는 R2 한손 뻗기 값(굽힌 팔은 싸움에서 졌다)' },
    '쟁기 (Pflug)': { name: '2번 자세 (Seconda)', desc: '손을 어깨 높이로 뻗고 손바닥을 아래로 · 칼끝은 상대 가슴', hand: [0.5, 0.08, 0.24], blade: [-3, -3], pelvisYaw: -50, chestYaw: -60, pitch: 2, drop: 0.12, src: '카포 페로 2번 자세: 손바닥 아래, 어깨 높이 [원전 2차]' },
    // 1번 자세(Prima: 손을 머리 위로, 칼끝을 내려 겨눔)는 뺐다 — 황소 자리는 찌르기·베기 길의 경유점이라 칼끝을 내리면 길이 휜다
    //  (측정 48판: 넣으면 15%, 빼면 40%. 한손 막기 자세와 같은 까닭 — COVERS)
  },
};


// 막기 자세 (다음 버전: 자세표가 아니라 "막기 덧씌우기"로 — AI 가 그 줄을 막을 때만 손·칼끝을 이 자세로 덮는다).
//  패드 자리는 베기 길의 경유점이라, 막기 자세를 자세표에 넣으면 그 자리를 지나는 모든 베기가 휜다(§ FRAME_GUARDS.one 주석, docs/weapon_motions.md §5)
export const COVERS = {
  one: {
    highC: { name: '머리 막기 (St. George)', desc: '칼을 머리 위로 가로 눕힌다 · 위에서 오는 칼을 받아 곧바로 되벤다', hand: [0.3, 0.4, 0.08], blade: [5, -80], pelvisYaw: -20, chestYaw: -30, pitch: 0, drop: 0.06, src: '허턴 Cold Steel(1889) 도판 VII "St. George\'s guard" [원전 2차] · 가로 막기 모양 [해석]' },
    highR: { name: '걸친 막기 (Hanging guard)', desc: '팔꿈치를 들어 손을 머리 높이로, 칼끝은 상대 가슴으로 늘어뜨린다 · 머리·어깨·가슴을 한 번에 덮는다', hand: [0.4, 0.38, 0.12], blade: [-35, -20], pelvisYaw: -25, chestYaw: -40, pitch: 5, drop: 0.08, src: '페이지 The Use of the Broad Sword(1746): 칼 팔 팔꿈치를 들고 칼끝을 상대 가슴에, 자기 머리를 덮는다 [원전 2차]' },
  },
};

/** 보여 주기용: 막기 자세(COVERS)를 그 줄의 막기 자리(highC=지붕 자리, highR=황소 자리)에 얹은 표 — 겉모습 확인(도구 motion_gallery)만 쓴다 */
export function frameTableWithCovers(frame, style = null) {
  const c = COVERS[frame] ?? {};
  const o = { ...(FRAME_GUARDS[frame] ?? {}), ...(STYLE_GUARDS[`${frame}:${style}`] ?? {}) };
  if (c.highC) o['지붕 (Vom Tag)'] = c.highC;
  if (c.highR) o['황소 (Ochs)'] = c.highR;
  return table(frame === 'one' || frame === 'gun' ? GUARD_BASE_ONE : GUARD_BASE, o);
}

/** 몸 틀(+싸움 방식)의 자세표 (guards.js 와 같은 순서·같은 패드). 고칠 것이 없으면 null(바탕 표 그대로) */
export function frameTable(frame, style = null, skip = []) {
  const o = { ...(frame === 'pole' ? POLE_GUARDS : FRAME_GUARDS[frame] ?? {}), ...(STYLE_GUARDS[`${frame}:${style}`] ?? {}) };
  for (const k of MOTION.skip) delete o[k];
  for (const k of skip) delete o[k];
  if (!Object.keys(o).length && frame !== 'one') return null;
  return table(frame === 'one' || frame === 'gun' ? GUARD_BASE_ONE : GUARD_BASE, o);
}

// E 자루 무기 자세표 초안 (docs/pole_frame_design.md) — 데이터만. 두 손 간격·뒤로 뻗은 자루·미끄러지는 쥔 점 물리가 먼저라 아무 데서도 읽지 않는다.
//  hand = 앞손(칼 원점), rear = 뒷손. 마이어 봉 자세 [원전 2차], 수치 [추정]. 몸은 왼발 앞(골반 yaw +)
export const POLE_GUARDS = {
  '긴 자세 (Langort)': { name: 'Mittelhut (Gerade Versatzung)', hand: [0.45, -0.05, -0.05], rear: [0.1, -0.25, 0.15], blade: [10, 0], pelvisYaw: 35, chestYaw: 30 },
  '지붕 (Vom Tag)': { name: 'Oberhut', hand: [0.25, 0.5, 0.05], rear: [0.15, 0.0, 0.05], blade: [85, 0], pelvisYaw: 30, chestYaw: 25 },
  '바보 (Alber)': { name: 'Unterhut', hand: [0.4, -0.25, 0.0], rear: [0.05, 0.0, 0.2], blade: [-30, 0], pelvisYaw: 35, chestYaw: 30 },
  '쟁기 (Pflug)': { name: 'Steurhut', hand: [0.25, -0.1, -0.2], rear: [0.3, 0.35, 0.15], blade: [-60, -30], pelvisYaw: 30, chestYaw: 20 },
  '왼쪽 바꿈': { name: 'Nebenhut', hand: [0.05, -0.3, -0.25], rear: [0.15, -0.1, 0.1], blade: [-20, -150], pelvisYaw: 45, chestYaw: 50 },
  '옆 지킴 (Nebenhut)': { name: 'Wechselhut', hand: [0.0, -0.35, 0.25], rear: [0.1, -0.15, 0.0], blade: [-25, 150], pelvisYaw: 20, chestYaw: 10 },
};
// 자세마다 어느 끝이 앞인가(frontEnd): 봉은 모두 'head'. 폴액스·나기나타는 꼬리(butt) 앞 자세가 있어 자세 칸 값으로 둔다 (docs/pole_frame_design.md §4-2)
for (const g of Object.values(POLE_GUARDS)) g.frontEnd = 'head';

// 손 간격(앞손~뒷손, m)은 자세 값이 아니라 무기·유파 값이다 → 스펙 handGap. [원전 2차] 영국 봉·나기나타, [추정] 마이어 봉·창
export const POLE_HAND_GAP = { englishStaff: 0.35, naginata: 0.4, meyerStaff: 0.6, spear: [0.6, 0.9] };

// 교차 베기(Kreutzhauw): 8자리를 멈추지 않고 거친다 — 연구 세션 pole_motion_research.md 로 고친 순서 [원전 2차]
//  B 틀 talhoReves 처럼 흐름(flow)으로 잇는다. 오른/왼 지붕은 같은 Oberhut 을 좌우로 쓴다
export const POLE_KREUTZHAUW = ['Nebenhut', 'Steurhut', 'Oberhut(R)', 'Wechselhut', 'Unterhut', 'Mittelhut', 'Oberhut(L)', 'Nebenhut'];
// 마이어의 찌르기는 앞손을 놓지 않는다: 뒷손을 겨드랑이로 당겨(Ruck) 자루를 앞손 속으로 밀어낸다. 놓고 뻗는 찌르기는 영국 봉(스웻넘)
export const POLE_THRUST = { meyer: 'ruck', english: 'release' };

const POLE_STRIKES = new Set(['oberhau']); // E 자루가 쓰는 칼 베기 길: 정수리 내려치기만

// ── 2) 기술 목록 ───────────────────────────────────────────
const weight = (tech, pred, k) => tech.map((t) => (pred(t) ? { ...t, base: t.base * k } : t));

// 새 기술 (몸 틀 덧붙임)
export const NEW_TECH = {
  // B: 어깨에서 멈추지 않고 이어 벤다 — 몬탄테 첫 규칙의 탈류→레베스(오른 어깨에서 사선으로 내리고, 왼 어깨로 돌려 올려 다시 사선).
  //  무거운 칼을 되돌려 세우지 않고 관성을 이어 쓴다(빠른 왕복 19 J → 물레 170 J, weapon_tempo). 8자를 한 번 그린다
  heavy: [
    { name: 'talhoReves', from: G.tagR, path: [[0.12, 0.14], G.wechselL, [-0.5, 0.05], G.tagL, [-0.1, 0.14], G.wechselR], open: 'UL', kind: 'cut', reach: 0.05, base: 1.1, presses: true, chain: 2, src: '몬탄테 규칙 1 [원전 2차]' },
  ],
  // C: 손목으로 칼을 한 바퀴 돌려 되벤다(몰리넬로) · 앞에 나온 상대 손목·아래팔을 끊어 친다
  one: [
    // 몰리넬로는 사람이 손가락으로 그리는 길로만 둔다(ai: false): AI 가 골라 쓰면 한 판에 70~99번 쓰며 진다
    //  (측정 48판: 세이버 켬 17% → 몰리넬로 빼면 44%, 나뭇가지 15% → 40%). 원을 돌리는 0.25초 동안 가운데가 비고 첫 베기가 약하다
    { name: 'molinello', ai: false, from: G.langort, path: [[0.25, -0.35], G.nebenR, G.tagR, [0.12, 0.14], G.wechselL], open: 'UL', kind: 'cut', reach: 0, base: 0.9, chain: 1, src: '세이버 몰리넬로(moulinet) [해석]' },
    { name: 'wristCut', from: G.tagR, path: [[0.2, 0.1], [0.05, -0.08]], open: 'UL', kind: 'cut', reach: 0.25, base: 0.7, fast: true, src: '세이버·검의 손목 베기: 어깨에서 짧게 내려 앞손·아래팔을 끊는다(몸통보다 0.3~0.4 m 가깝다). 길이 0.62 — 분노의 베기의 절반 [해석]' },
  ],
};

/** 싸움 방식 × 몸 틀 → AI 기술 목록 (TECH 모양) */
export function styleTech(style, frame) {
  // E 자루: 찌르기 + 머리 내려치기(정수리 베기 길) 하나 (docs/pole_frame_design.md §8, 봉 시제품):
  //  찌르기만 48% · + 머리 치기 65%(96판) · 사선 베기까지 넣으면 27% · 칼 기술 전부 15% — 봉 자세표에서 사선·수평 베기 길은 휜다.
  //  원전도 같다: 높은 자세에서 머리를 내려치고 찌른다(스웻넘·실버 [원전 2차]). 교차 베기 등은 봉 자세표에 맞춘 새 길로 따로
  //  싸움 방식(봉은 때리기, 창은 찌르기)과 상관없이 찌르기 우선 가중치(찌르기 방식과 같음)로
  if (frame === 'pole') return weight(weight(TECH, (x) => x.kind === 'thrust', 1.8), (x) => x.kind === 'cut', 0.7).filter((x) => x.kind === 'thrust' || POLE_STRIKES.has(x.name) || MOTION.poleStrikes.has(x.name));
  let t = TECH;
  if (style === 'cut') t = weight(t, (x) => x.kind === 'thrust', 0.5); // 베기 무기: 찌르기는 덜 믿는다 (schools.js weakThrust 와 같은 뜻)
  if (style === 'thrust') t = weight(weight(t, (x) => x.kind === 'thrust', 1.8), (x) => x.kind === 'cut', 0.7); // 찌르기 무기: 찌르기를 먼저
  if (style === 'blunt') t = t.filter((x) => x.kind !== 'thrust'); // 때리기: 동작은 베기와 같고 찌르기만 뺀다 (docs/weapon_types.md §4-3)
  // 앞무게: 높은 자세에서 내리치는 베기(분노의 베기=가사베기, 정수리 베기=상단 정면)를 먼저 — 가속할 길이 길다 (10라운드 6-7 과 같은 뜻)
  if (frame === 'heavy') t = weight(t, (x) => x.presses, 1.4);
  // 손목 베기는 날 있는 한손 칼만: 나뭇가지(때리기)에 넣으면 40% → 19% (가볍고 날이 없어 앞손을 끊지 못하고 틈만 준다)
  const add = (NEW_TECH[frame] ?? []).filter((x) => !(style === 'blunt' && x.name === 'wristCut'));
  return [...t, ...(style === 'thrust' ? add.filter((x) => x.kind === 'thrust') : add)].filter((x) => x.ai !== false);
}

/** 속임수: 찌르기 없는 방식이면 찌르기 속임수를 뺀다 */
export function styleFeints(style, frame = null) {
  if (frame === 'pole') return FEINTS.filter((f) => TECH_BY_NAME[f.fake].kind === 'thrust'); // 자루: 기술이 찌르기뿐이다
  if (style === 'blunt') return FEINTS.filter((f) => TECH_BY_NAME[f.fake].kind !== 'thrust');
  return FEINTS;
}

/** 간 보는 자세: 앞무게는 높은 자세(상단·팔상)를 먼저 — 칼을 미리 들어 가속할 시간을 번다(10라운드 6-7) */
export function frameWatchGuards(frame) {
  if (frame === 'heavy') return WATCH_GUARDS.map((g) => (g.high >= 0.6 ? { ...g, pref: 1.6 } : g));
  return WATCH_GUARDS;
}

// ── 2b) 막기 자리 (AI parry 표) ─────────────────────────────
//  자세표가 바뀌면 "어느 패드가 어느 줄을 막나"가 바뀐다 → 롱소드 유파의 parry 표(공격 줄 × 자세를 물리로 부딪쳐 고른 것)를
//  그대로 쓰면 AI 가 엉뚱한 자세로 막는다(측정: 한손 자세표를 입히자 레이피어 48% → 4%). 무기마다 같은 방법으로 다시 찾은 값
//  (tools/sim/motion_lab.mjs parry <무기> on — 롱소드가 기술 6가지를 11 m/s 로 치고, 막는 쪽이 14 자세를 들고 버틴다, 간격 1.45·1.6 m).
//  2판씩이라 거칠다: 다음 버전에서는 판 수를 늘리고 AI 가 막으며 움직이는 것까지 넣어 다시 찾는다
export const LIB_PARRY = {
  zweihander: { highL: [-0.4, 0.42], highR: [-0.22, 0.26], highC: [0.38, -0.44], lowL: [0, 0.03], lowR: [0.18, -0.28], thrust: [0.02, 0.52] }, // 넓게 찾음(12판/자세)
  monohoshizao: { highL: [-0.22, 0.26], highR: [-0.22, 0.26], highC: [0.18, -0.28], lowL: [0.18, -0.28], lowR: [0, 0.03], thrust: [0.18, -0.28] }, // 넓게 찾음
  frozen_tuna: { highL: [-0.4, -0.42], highR: [-0.22, 0.26], highC: [-0.4, -0.42], lowL: [0, 0.03], lowR: [-0.4, -0.42], thrust: [-0.4, -0.42] }, // 넓게 찾음
  longsword: { highL: [-0.4, 0.42], highR: [-0.4, -0.42], highC: [0.55, -0.26], lowL: [0.42, 0.42], lowR: [0.18, -0.28], thrust: [-0.4, -0.42] }, // 점검용: 같은 방법으로 롱소드를 찾은 값 (원래 표와 비교)
  sabre: { highL: [-0.52, 0.03], highR: [0, 0.03], highC: [-0.4, -0.42], lowL: [-0.4, -0.42], lowR: [-0.18, -0.28], thrust: [-0.4, -0.42] },
  falchion: { highL: [-0.52, 0.03], highR: [-0.4, -0.42], highC: [0.42, 0.42], lowL: [0.42, 0.42], lowR: [0.22, 0.26], thrust: [-0.4, -0.42] },
  rapier: { highL: [0.52, 0.03], highR: [-0.52, 0.03], highC: [0.42, 0.42], lowL: [0.55, -0.26], lowR: [-0.4, -0.42], thrust: [-0.22, 0.26] },
  qinggang: { highL: [-0.4, -0.42], highR: [-0.22, 0.26], highC: [0.42, 0.42], lowL: [0.42, 0.42], lowR: [-0.4, -0.42], thrust: [-0.4, -0.42] },
  tree_branch: { highL: [-0.18, -0.28], highR: [0, 0.03], highC: [0.18, -0.28], lowL: [0.52, 0.03], lowR: [-0.4, 0.42], thrust: [-0.52, 0.03] },
};

// ── 3) 덧씌우는 동작 (skill.js THRUST 값 위에 덮어쓸 몫) ────────
//  런지(찌르기 무기): 뒷다리를 펴며 앞발을 크게 내디뎌 몸을 낮추고 팔을 끝까지 뻗는다 (카포 페로). 걸음 0.3 → 0.6 m, 몸 낮추기 0.07 → 0.16 m
export const OVERLAY = {
  thrust: { lunge: { step: 0.6, reach: 0.08, body: { pelvisYaw: -35, chestYaw: -45, pitch: 12, drop: 0.16 }, src: '카포 페로 런지 [해석] · 걸음 길이 [추정]' } },
};

/**
 * 한 검객에게 라이브러리를 입힌다 (점검 도구가 부른다). 무기 스펙의 frame·style 을 읽는다.
 *  반환: { frame, style, table, tech, feints, watch, overlay }
 */
export function motionFor(weapon) {
  const frame = weapon.frame ?? 'two';
  const style = weapon.style ?? 'versatile';
  return { frame, style, table: frameTable(frame, style, weapon.motionSkip ?? []), tech: styleTech(style, frame), feints: styleFeints(style, frame), watch: frameWatchGuards(frame), overlay: OVERLAY[style] ?? null, parry: MOTION.useParry ? LIB_PARRY[weapon.id] ?? null : null, noTwist: style === 'blunt', flow: frame === 'heavy', counter: frame === 'pole' ? { default: styleTech(style, frame).map((t) => t.name) } : null }; // counter: 유파 맞받아치기 목록을 바꿔야 하는 틀(자루)만
}
export function applyMotionLibrary(fighter, { overlay = true, flow = true, noTwist = false, ai = null, cover = true } = {}) {
  const m = motionFor(fighter.weapon ?? {});
  fighter.guardPose.table = fighter.bodyGuard.table = m.table ?? undefined;
  fighter.motion = m;
  if (overlay && m.overlay?.lunge) installLunge(fighter, m.overlay.lunge);
  // 날 세우기(손목 비틀기)를 끈다: 날 없는 무기(④ 때리기)는 어느 면으로 맞아도 같다.
  //  비트는 힘도 손목 힘 한도(cap) 안에서 나눠 쓰므로, 끄면 그만큼 휘두르는 데 쓴다 (무기-검술 연구 ② 제안).
  //  잰 값(motion_lab swings): 나뭇가지 +15~30%, 참치는 베기마다 들쭉날쭉. 라이트세이버(연구 ⑥ 제안)는 우리 판정이 날 있는 칼로 보므로
  //  끄면 날이 안 서 베기 지표가 0 이 된다 — 넣지 않는다.
  //  기본은 끔(noTwist=false): 실제 싸움에서 참치 23% → 8%, 나뭇가지도 떨어졌다 (비트는 힘이 칼을 붙잡아 주는 몫이 컸다). 기록용으로만 남긴다
  if (overlay && noTwist && m.noTwist) fighter.twistScale = 0;
  // 흐름(SKILL.flow — 멈추지 않고 이어 베기)을 이 검객에게만 켠다: 앞무게(B)는 되돌리지 않고 이어 도는 것이 빠른 길 (몬탄테)
  if (overlay && flow && m.flow) installFlow(fighter);
  // 막기 덧씌우기(COVERS): AI 가 그 줄을 칼로 막는 동안만 손·칼끝을 막기 자세로 덮는다 (자세표에 넣으면 베기 길이 휜다 — COVERS 주석)
  if (overlay && cover && ai && COVERS[m.frame]) installCover(fighter, ai, COVERS[m.frame]);
  return m;
}

/** 막기 덧씌우기 (시제품): 검술 층 update 뒤에 thrustPose(덧씌우기 칸)를 막기 자세로 채운다. 찌르기(tap)·사격 중엔 건드리지 않는다 */
function installCover(fighter, ai, covers) {
  const sk = fighter.skill;
  if (!sk || sk._cover) return;
  const D = Object.fromEntries(Object.entries(covers).map(([k, o]) => {
    const el = o.blade[0] * D2R;
    const az = o.blade[1] * D2R;
    return [k, { ...o, dir: [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)] }];
  }));
  sk._cover = { w: 0, last: null };
  const upd = sk.update.bind(sk);
  sk.update = (dt) => {
    const r = upd(dt);
    const st = sk._cover;
    if (sk.tap || fighter.weapon?.gun) {
      st.w = 0;
      return r;
    }
    const want = ai.mode === 'defend' && !ai.defVoid ? D[ai.defLine] : null;
    if (want) st.last = want;
    st.w = Math.max(0, Math.min(1, st.w + (want ? dt / MOTION.coverIn : -dt / MOTION.coverOut))); // 덮는 시간·걷는 시간 (MOTION)
    const c = st.last;
    const pose = sk.thrustPose;
    if (!c || st.w <= 0) {
      if (pose.w && !sk.tap) pose.w = 0;
      return r;
    }
    for (let k = 0; k < 3; k++) {
      pose.hand[k] = c.hand[k];
      pose.dir[k] = c.dir[k];
    }
    pose.pelvisYaw = c.pelvisYaw * D2R;
    pose.chestYaw = c.chestYaw * D2R;
    pose.pitch = c.pitch * D2R;
    pose.drop = c.drop;
    pose.w = st.w;
    sk.covers = (sk.covers ?? 0) + (want ? dt : 0);
    return r;
  };
}

function installFlow(fighter) {
  const sk = fighter.skill;
  if (!sk || sk._flow) return;
  sk._flow = true;
  const upd = sk.update.bind(sk);
  sk.update = (dt) => {
    const keep = SKILL.flow;
    SKILL.flow = true;
    try {
      return upd(dt);
    } finally {
      SKILL.flow = keep;
    }
  };
}

/**
 * 런지 덧씌우기 (시제품 — skill.js 를 고치지 않고 이 검객의 찌르기만 감싼다):
 *  찌르기를 시작하면 손을 L.reach 더 뻗고, 찌르는 동안 몸을 런지 자세(L.body: 옆으로 세우고 숙이고 크게 낮춤)로.
 *  사람(탭, step=true)은 내딛는 걸음을 THRUST.step 대신 L.step 으로. AI 의 찌르기 기술은 이미 0.6 m 런지 걸음을 부탁한다(ai.js gaitStep) → 걸음은 그대로
 *  다음 버전에서는 skill.js thrust 가 무기의 덧씌우기 값을 직접 읽으면 된다 (이 감싸기는 그 자리를 보여 주는 시제품)
 */
function installLunge(fighter, L) {
  const sk = fighter.skill;
  if (!sk || sk._lunge) return;
  sk._lunge = L;
  const thrust = sk.thrust.bind(sk);
  const upd = sk.updateThrust.bind(sk);
  sk.thrust = (opts = {}) => {
    const keep = THRUST.step;
    THRUST.step = L.step;
    let ok;
    try {
      ok = thrust(opts);
    } finally {
      THRUST.step = keep;
    }
    if (ok && sk.tap && !sk.tap.down) {
      sk.tap.K.reach += L.reach;
      sk.tap.lunge = true;
      sk.lunges = (sk.lunges ?? 0) + 1;
    }
    return ok;
  };
  sk.updateThrust = (dt) => {
    if (!sk.tap?.lunge) return upd(dt);
    const keep = THRUST.body;
    THRUST.body = L.body;
    try {
      return upd(dt);
    } finally {
      THRUST.body = keep;
    }
  };
}

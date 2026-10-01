// ─────────────────────────────────────────────────────────────
//  AI 검술 교본: 자세(가드)와 기술 (독일식 롱소드, 리히테나워 전통)
//
//  AI도 플레이어처럼 "패드 위치"(손 목표, 몸 앞 평면의 좌우 x·위아래 y, 미터)만 움직인다.
//  guards.js가 이 위치를 실제 자세(손 깊이·칼끝 방향·허리 틀기)로 바꾸므로,
//  자세에서 자세로 손을 빠르게 옮기는 것이 곧 베기다.
//
//  좌표: x = 칼 든 쪽(오른쪽)이 +, y = 위가 +.  얼굴을 마주 보므로
//        내 오른쪽에서 시작하는 베기는 상대의 "왼쪽"을 친다.
//
//  네 곳의 빈틈(Vier Blößen, 상대 몸 기준): UL 왼쪽 위, UR 오른쪽 위, LL 왼쪽 아래, LR 오른쪽 아래
//   + C 가운데(찌르기: 가슴·얼굴), H 정수리(위에서 곧게 내려베기)
// ─────────────────────────────────────────────────────────────

// 자세 (guards.js의 패드 위치와 같다)
export const G = {
  tag: [0.02, 0.52], // 지붕 (Vom Tag, 머리 위)
  tagR: [0.42, 0.42], // 어깨 지붕 (오른쪽 어깨)
  ochsR: [0.22, 0.26], // 황소 (칼자루가 머리 오른쪽, 칼끝이 얼굴을 겨눔)
  langort: [0.0, 0.03], // 긴 자세 (팔을 쭉 뻗어 칼끝으로 겨눔)
  sideR: [0.52, 0.06], // 옆 자세 (가로베기 준비)
  pflugR: [0.18, -0.28], // 쟁기 (칼자루가 오른쪽 허리, 칼끝이 얼굴을 겨눔)
  wechselR: [0.38, -0.44], // 바꿈 (칼끝이 오른쪽 아래)
  nebenR: [0.55, -0.26], // 옆 지킴 (칼을 옆 뒤로 숨김)
  alber: [0.0, -0.5], // 바보 (칼끝이 땅을 향함 → 일부러 머리를 비워 유인)
  tagL: [-0.4, 0.42],
  ochsL: [-0.22, 0.26],
  sideL: [-0.52, 0.06],
  pflugL: [-0.18, -0.28],
  wechselL: [-0.4, -0.42],
  kron: [0.02, 0.4], // 왕관: 칼자루를 머리 위로 들어 위에서 오는 칼을 받는다
};

// 겨루기(간 보기) 중에 쓰는 자세. 칼끝이 상대를 겨누는 자세(황소·쟁기·긴 자세)가 많다.
//  threat: 칼끝이 상대를 겨누는 정도 (가까이 들어오는 상대를 막는다)
//  high: 위쪽 공격이 쉬운 자세, low: 아래에서 올려치거나 찌르기 쉬운 자세
export const WATCH_GUARDS = [
  { name: 'tag', pad: G.tag, threat: 0.1, high: 1, low: 0 },
  { name: 'tagR', pad: G.tagR, threat: 0.1, high: 1, low: 0 },
  { name: 'ochsR', pad: G.ochsR, threat: 0.8, high: 0.6, low: 0.2 },
  { name: 'ochsL', pad: G.ochsL, threat: 0.7, high: 0.6, low: 0.2 },
  { name: 'pflugR', pad: G.pflugR, threat: 0.9, high: 0.2, low: 0.8 },
  { name: 'pflugL', pad: G.pflugL, threat: 0.8, high: 0.2, low: 0.8 },
  { name: 'langort', pad: G.langort, threat: 1, high: 0.3, low: 0.3 },
  { name: 'alber', pad: G.alber, threat: 0.1, high: 0, low: 1 }, // 유인 자세: 머리를 비워 두고 올려친다
  { name: 'wechselR', pad: G.wechselR, threat: 0.1, high: 0, low: 1 },
];

// 기술. from = 시작 자세(준비), path = 손이 지나가는 점들(마지막 = 끝 자세),
//  open = 노리는 빈틈, kind = cut | thrust, reach = 칼이 닿는 거리 보정(m)
//  base = 얼마나 믿을 만한 기술인가: 가만히 선 상대(자세 6가지)에게 거리별로 물리로 쳐 본 결과로 정했다.
//   분노의 베기는 상대 칼을 위에서 눌러 비키며 머리·목에 닿는다(가장 잘 통함). 가로베기는 이 자세 지도에서
//   칼자루를 머리 위로 들지 못해(가슴 높이) 상대 칼에 거의 다 막히고, 찌르기는 힘이 약해 대부분 막히거나 튕긴다.
//  presses = 위에서 상대 칼을 눌러 비키며 들어가는 베기 (칼끝으로 겨누는 상대에게 좋다)
//  fast = 준비가 짧아 순간을 잡기 좋은 기술
export const TECH = [
  // 분노의 베기: 오른쪽 어깨 → 긴 자세를 지나 → 왼쪽 아래. 상대 칼을 누르며 왼쪽 위 빈틈(머리·목)을 친다
  { name: 'zornhau', from: G.tagR, path: [[0.12, 0.14], G.wechselL], open: 'UL', kind: 'cut', reach: 0, base: 1.4, presses: true },
  // 정수리 베기: 지붕 → 긴 자세 → 바보. 칼을 낮춘 상대의 머리를 곧게 친다 (주로 팔에 막힌다)
  { name: 'oberhau', from: G.tag, path: [[0.0, 0.14], G.alber], open: 'H', kind: 'cut', reach: -0.05, base: 0.8, presses: true },
  // 가로베기(Zwerchhau): 옆에서 수평으로
  { name: 'zwerch', from: G.sideR, path: [[0.0, 0.1], G.sideL], open: 'UL', kind: 'cut', reach: 0, base: 0.25 },
  // 올려베기: 오른쪽 아래 → 왼쪽 황소. 손·팔과 아래쪽 빈틈 (힘은 약하다: 무게의 도움이 없다)
  { name: 'unterhau', from: G.wechselR, path: [[0.04, -0.08], G.ochsL], open: 'LL', kind: 'cut', reach: -0.05, base: 0.6 },
  // 왼쪽에서 (거울)
  { name: 'zornhauL', from: G.tagL, path: [[-0.1, 0.14], G.wechselR], open: 'UR', kind: 'cut', reach: -0.05, base: 1.0, presses: true },
  { name: 'zwerchL', from: G.sideL, path: [[0.0, 0.1], G.sideR], open: 'UR', kind: 'cut', reach: 0, base: 0.2 },
  { name: 'unterhauL', from: G.wechselL, path: [[-0.04, -0.08], G.ochsR], open: 'LR', kind: 'cut', reach: -0.1, base: 0.35 },
  // 찌르기: 칼끝이 곧게 나아간다 (쟁기·황소·바보에서 긴 자세로). 준비가 짧다
  { name: 'stichPflug', from: G.pflugR, path: [[0.06, -0.1], G.langort], open: 'C', kind: 'thrust', reach: 0.1, base: 0.35, fast: true },
  { name: 'stichPflugL', from: G.pflugL, path: [[-0.06, -0.1], G.langort], open: 'C', kind: 'thrust', reach: 0.1, base: 0.25, fast: true },
  { name: 'stichOchs', from: G.ochsR, path: [[0.08, 0.12], G.langort], open: 'C', kind: 'thrust', reach: 0.1, base: 0.25, fast: true },
  { name: 'stichOchsL', from: G.ochsL, path: [[-0.08, 0.12], G.langort], open: 'C', kind: 'thrust', reach: 0.1, base: 0.2, fast: true },
  { name: 'stichAlber', from: G.alber, path: [[0.0, -0.2], G.langort], open: 'C', kind: 'thrust', reach: 0.05, base: 0.3, fast: true },
];

// 속임수(Fehler): 가짜 기술을 at(0~1)만큼 시작했다가(발은 내딛지 않는다) then 길로 바꿔 다른 빈틈을 친다.
//  상대가 가짜에 칼을 들어 막으려 하면, 그 사이 비워진 곳으로 들어간다.
export const FEINTS = [
  // 정수리를 치는 척 → 칼을 오른쪽 아래로 틀어 다리를 벤다
  { name: '위→다리', fake: 'oberhau', at: 0.55, then: [[0.22, -0.1], G.wechselR], open: 'LL' },
  // 분노의 베기를 하는 척 → 칼을 머리 위로 넘겨(Umschlagen) 반대쪽 어깨에서 벤다
  { name: '오른쪽→왼쪽', fake: 'zornhau', at: 0.45, then: [[-0.12, 0.5], G.tagL, [-0.1, 0.14], G.wechselR], open: 'UR' },
  { name: '왼쪽→오른쪽', fake: 'zornhauL', at: 0.45, then: [[0.12, 0.5], G.tagR, [0.12, 0.14], G.wechselL], open: 'UL' },
  // 얼굴을 찌르는 척 → 칼을 오른쪽 어깨로 당겨 분노의 베기
  { name: '찌르기→베기', fake: 'stichPflug', at: 0.6, then: [G.tagR, [0.12, 0.14], G.wechselL], open: 'UL' },
];

export const TECH_BY_NAME = Object.fromEntries(TECH.map((t) => [t.name, t]));

// 높은 자세 (10라운드 6-7 모노호시자오 한 칼 자세): 상단·팔상처럼 칼을 미리 높이 들고 기다린다 — 느린 칼이 가속할 시간을 번다
export const HIGH_GUARDS = WATCH_GUARDS.filter((g) => g.high >= 0.6);

/** 두 패드 위치 사이 거리 */
export const padDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);


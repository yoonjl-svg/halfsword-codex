// ─────────────────────────────────────────────────────────────
//  인물 다섯 유파 숙련도 · 전투성향 (초안 — 사장님 확인 전)
//
//  사장님 10/29 14:5x: "인물마다 설정과 개성을 살려서 다섯 유파 숙련도 초안을 만들고 전투성향도 만들어.
//   여기서 만든 전투성향은 나중에 밸런스 조정 때 캐릭터별 전투 방식 차이에 반영할 거니 중요해. 잘 저장해둬."
//  기록 · 근거 줄: docs/characters/temperament_2026-10-29.md (인물마다 유파별 까닭 · 성향 글 · 2:2 · 여쭐 것)
//
//  자료만 있다 — 아무 데도 이어지지 않았다(게임 · 시뮬 · AI 는 이 파일을 읽지 않는다). 다른 모듈을 읽지 않고, 읽어도 아무 일이 일어나지 않는다.
//  범위: 기본 회전 CHARACTERS 열둘 + 손님 인물 CHARACTER_GUESTS 여덟(special: true — 나중에 특별 토큰으로 고용하는 특별 동료 후보 · 10/30 쥘리아 — 사장님 10/30 22:1x '상점주인이자 방랑과 생사전에 나오게 해').
//   변형(*_mad)은 따로 적지 않는다 — 원본과 같은 칸을 쓴다(proficiencyOf · temperamentOf 가 '_mad' 를 떼고 찾음).
//   예외: 성향이 원본과 다른 얼터는 ALTER_TEMPERAMENT 에 따로(광기의 쥘리아 — 감독 초안 10/30 '더 차갑고 기계적이고 끈질김 · 설정 없음') — 숙련도는 그대로 원본 칸 + 얼터 +1.
//   얼터의 숙련도 +1(characters.js VARIANT_PLUS — 시트 무기 유파에 붙음)은 지금처럼 characters.js 몫이다.
// ─────────────────────────────────────────────────────────────

export const STATUS = '사장님 확인 전'; // 이 파일의 모든 새 값 (기본 유파 숙련도만 사장님 결정 — 아래 PROFICIENCY 머리말)

// ── 숙련도 ──
//  척도는 지금 그대로(docs/strike/ai_proficiency_2026-10-13.md · config.js AI_PROFICIENCY): 0 = 그 유파 고유 동작 없음 · 1 견습생 · 2 숙련자 · 3 전문가 · 4 마스터 · 5 신(비기) ·
//   6 = 상한(사장님 10/29 22:4x '상한 6으로 올려' — 전엔 롤랑 · 베르나르도만 쓰는 칸 10/24 01:1x · 지금 롤랑 · 베르나르도 · 아르토리아 + 얼터 광기의 아르토리아 · 광기의 미나미). 정수 0 ~ 6.
export const SCHOOLS = Object.freeze(['german', 'italian', 'japanese', 'chinese', 'iberian']); // schools.js TRADITIONS 열쇠 (화면 이름 독일 · 이탈리아 · 일본 · 동방 · 이베리아)
export const PROF_MIN = 0;
export const PROF_MAX = 6; // = AI_PROFICIENCY.levels.length − 1 (시험이 맞춰 봄)

/**
 * 기본 유파 = 시트 무기의 유파 (schools.js traditionOf(WEAPONS[weapon]) — 시험이 맞춰 봄). 'none' = 무유파 무기(나뭇가지 · 권총 · 모르겐슈테른).
 *  기본 유파 칸 = 시트 ai.proficiency 그대로 (사장님 결정 — 10/13 표 · 미나미 10/14 · 손님 10/14 · 10/24 · 마야 10/20 · 투야나 10/25 · 찬다 10/27 — 이 파일은 그 값을 바꾸지 않는다)
 */
export const MAIN_SCHOOL = Object.freeze({
  bran: 'none', isolde: 'german', liao: 'chinese', heinrich: 'german', margarethe: 'german', tome: 'italian',
  omari: 'iberian', minami: 'japanese', artoria: 'german', samira: 'none', renji: 'none', eira: 'italian',
  ratna: 'iberian', silver_wanderer: 'japanese', chanda: 'chinese', terracotta: 'chinese', roland: 'iberian', white_scale: 'japanese', bernardo: 'iberian',
  julia: 'italian', // 10/30 쥘리아 (사장님 10/30 22:1x '상점주인이자 방랑과 생사전에 나오게 해') — 레이피어 · 이탈리아 4 (시트 · 전달본) · 사장님 확인 전
});

const P5 = (german, italian, japanese, chinese, iberian, none) =>
  Object.freeze(none == null ? { german, italian, japanese, chinese, iberian } : { german, italian, japanese, chinese, iberian, none });

/**
 * { 유파: 숙련도 } — persona.proficiency 와 같은 꼴(sword_art.js proficiencyIn 이 그대로 읽을 수 있다). 무유파가 기본인 인물만 'none' 칸이 있다(= ai.proficiency).
 *  다른 유파는 설정에서: 스승 · 출신 · 들었던 무기 · 떠돈 곳 (까닭 줄은 문서 §3). 규칙: 다른 유파 ≤ 기본 유파 · noSwordsmanship 인물은 다섯 유파 모두 0.
 */
export const PROFICIENCY = Object.freeze({
  //                 독일 이탈 일본 동방 이베 무유파
  bran: P5(0, 0, 0, 0, 0, 1), // 검술을 배우지 못함 (noSwordsmanship — 사장님 10/25 20:0x '화전민이고 검술을 배우지 못한 대신 힘이 매우 세')
  isolde: P5(1, 1, 0, 0, 0), // 피오레(이탈리아식) 기본기를 독일식 이름으로 — school '피오레 데이 리베리(이탈리아식)의 기본기를 독일식 자세 이름으로 옮겨 배웠다'
  liao: P5(1, 0, 0, 3, 0), // 동방 도검술을 '서양 롱소드에 옮겨 쓴다'(school) · 열두 해째 서쪽 결투장
  heinrich: P5(2, 2, 0, 0, 0), // 마이어 사범 + '원래 귀족이고 파펜하이머가 원래 자신의 진짜 무기'(사장님 10/25 20:1x) — 광기의 하인리히 이탈리아 3 = 이 칸 2 + 1
  margarethe: P5(3, 0, 0, 0, 0), // '리히테나워 전통의 정수' — 40 년 한 계보
  tome: P5(0, 2, 0, 0, 0), // 레이피어 · 볼로냐 아르키진나시오의 사서 — 다른 유파를 몸에 익힌 줄 없음
  omari: P5(1, 0, 0, 0, 2), // 이베리아 2 (사장님 10/29 22:5x — 전 1) · 뱃사람 · 본디 펄션(사장님 10/9 23:4x '해적이라 펄션을 들었지만 우선 … 츠바이핸더') — 펄션 = 독일(두삭 가지)
  minami: P5(0, 0, 5, 0, 0), // 신목의 숲 수호자 — 일본 한 갈래 (10/29 22:4x 시트 무기 쿠사나기 — 일본 그대로)
  artoria: P5(6, 0, 0, 0, 0), // 독일 6 (사장님 10/29 22:4x — 전 5) · 엑스칼리버 유파(독일) — school '엑스칼리버 유파(독일)를 사용한다'
  samira: P5(2, 0, 0, 0, 0, 4), // 권총(무유파 4 — 사장님 10/29 22:5x · 전 3 · 광기의 마야 세이버 독일 5) · 라지푸트 가문의 군 전령 · 얼터는 늘 세이버(사장님 10/20 00:4x) — 세이버 = 독일(두삭 가지)
  renji: P5(0, 0, 0, 0, 0, 2), // 형의 검은 벽에 걸어 둠 · 얼터가 형의 칼을 들어도 '무유파 몸놀림과 성향을 유지'
  eira: P5(0, 3, 0, 0, 0), // '얼어붙은 길에서 자신과 짐을 지키려 레이피어를 배웠다'
  ratna: P5(0, 0, 0, 0, 2), // 습지 안내인 · 츠바이핸더(몬탄테) 하나
  silver_wanderer: P5(0, 0, 4, 0, 0), // '검을 다루는 몸의 기억' = 낯선 칼 하나 (10/29 22:5x 낮은 우치가타나 — 일본 그대로 · 10/30 00:4x backstory '낯선 긴 칼로' → '낯선 칼로')
  chanda: P5(0, 0, 0, 3, 0), // 물길 따라 건너온 환도를 물려받음
  terracotta: P5(0, 0, 0, 2, 0), // 월의 유민 · 월왕구천검
  roland: P5(0, 0, 0, 0, 6), // 이베리아 몬탄테 · 뒤랑달
  white_scale: P5(0, 0, 5, 0, 0), // '몽골에서 태어나 … 일본 검술을 배운 전사' — 초원의 칼은 다섯 유파 밖 (사연 미정 시안)
  bernardo: P5(0, 0, 0, 0, 6), // 레온의 영웅 · 티소나
  julia: P5(1, 4, 1, 2, 3), // 온 나라 칼을 다루는 상인 — 기본 이탈리아 4(레이피어 · 시트) · **이베리아 3 · 동방 2 = 사장님 10/30 22:4x 결정 — 이베리아 3 · 동방 2 (쥘리아 · 광기의 쥘리아)** · 독일 · 일본 1(감독 초안 · 사장님 확인 전 — '칼은 써 봐야 안다') · 광기의 쥘리아 = 이탈리아 5(얼터 +1)
});

// ── 전투성향 축 ──
//  0 ~ 1 (wounded 는 낱말 셋). 칸마다 knobs = 나중에 움직일 지금 손잡이(ai.js · persona) · read = 지금 손잡이 값 → 이 축 값(시험이 쓰는 식).
//  '겹침' 규칙: 인물 시트(persona.level · pers · startEmotion · whole · close)에 적힌 손잡이는 그 값으로 읽은 축 값과 초안이 맞는다(±0.05 — 시험).
//   시트에 없는 손잡이(유파 기질 범위에서 판마다 굴리거나 실력 이름 기본값)는 설정에서 정했고, 그 손잡이 범위([lo, hi]) 안에서 아무 값이나 될 수 있는 것으로 본다.
//  설정이 지금 숫자와 다른 쪽을 가리키면 값은 숫자에 맞추고 lean(+1 올릴 쪽 · −1 내릴 쪽)에 적는다 — 밸런스 때 볼 후보 (문서 §3 각 인물 '설정 쪽 기울기').
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const n = (x, a, b) => clamp01((x - a) / (b - a));
const K = (o) => Object.freeze(o);

export const AXES = Object.freeze({
  // 선공: 먼저 들어가는가. 0 기다림 · 1 먼저 친다.
  //  손잡이: pers.aggr × level.aggression (참을성이 줄어드는 빠르기 · 공격 문턱 need = 1 − 0.3(aggr·aggression − 0.8) — ai.js watch) · startEmotion.anger (화난 채 시작 — 참을성 0.2 에서)
  initiative: K({ ko: '선공', knobs: K({ 'pers.aggr': [0.6, 1.4], 'level.aggression': [0.6, 1.2], 'startEmotion.anger': [0, 0] }),
    read: (k) => clamp01(k['pers.aggr'] * k['level.aggression'] - 0.5 + 0.3 * k['startEmotion.anger']) }),
  // 참을성: 오래 기다리고 자세를 느긋하게 바꾸는가. 0 조급 · 1 느긋.
  //  손잡이: pers.patienceTime (s — 참을성이 바닥나는 시간) · pers.rhythm (s — 자세 바꾸는 박자)
  patience: K({ ko: '참을성', knobs: K({ 'pers.patienceTime': [4, 16], 'pers.rhythm': [1, 7.5] }),
    read: (k) => 0.5 * n(k['pers.patienceTime'], 4, 16) + 0.5 * n(k['pers.rhythm'], 1, 7.5) }),
  // 간격: 어디에 서는가. 0 바짝 · 1 멀찍이.
  //  손잡이: pers.margin (m — 상대 칼 닿는 거리 밖 여유, ai.js holdDist). 그 간격을 얼마나 굳게 지키나는 level.discipline (같이 움직일 손잡이 — 식에는 안 넣음)
  distance: K({ ko: '간격', knobs: K({ 'pers.margin': [0.1, 0.5] }), read: (k) => n(k['pers.margin'], 0.1, 0.5) }),
  // 받아치기: 상대 칼에 칼로 답하는가. 0 먼저 쳐서 끝낸다 · 1 들어오는 칼을 받아친다.
  //  손잡이: level.counter (막는 대신 같은 순간 맞받아 베기 — Indes) · pers.vor (달려드는 상대를 맞받나(1) 물러나 헛치게 하나(0) — ai.js preThreat) · whole.punish (초안 — 안 읽힘)
  counter: K({ ko: '받아치기', knobs: K({ 'level.counter': [0, 0.7], 'pers.vor': [0, 1] }),
    read: (k) => 0.5 * n(k['level.counter'], 0, 0.7) + 0.5 * k['pers.vor'] }),
  // 속임: 가짜 기술을 섞는가. 0 정직 · 1 겹겹이.
  //  손잡이: level.feint (속임 확률 — 막힌 수만큼 더 · ai.js startAttack)
  feint: K({ ko: '속임', knobs: K({ 'level.feint': [0, 0.5] }), read: (k) => n(k['level.feint'], 0, 0.5) }),
  // 막힌 뒤: 막히거나 맞부딪힌 뒤 이어 붙이는가. 0 한 번 치고 끝 · 1 반드시 잇는다.
  //  손잡이: level.followUp (이어 치기 · 막은 뒤 되받기) · pers.angry (10 초에 두 번 막히면 분노 → 이어 치기 +0.2 · 큰 베기)
  press: K({ ko: '막힌 뒤', knobs: K({ 'level.followUp': [0, 0.9], 'pers.angry': [0, 1] }),
    read: (k) => 0.7 * n(k['level.followUp'], 0, 0.9) + 0.3 * k['pers.angry'] }),
  // 모험: 맞바꾸기를 감수하는가. 0 안전 · 1 몸을 다 싣고 들이받는다.
  //  손잡이: whole.sPref (몸 싣기 — 초안, 게임은 아직 안 읽음) · whole.evade (큰 베기에 비켜서기 — 초안, 거꾸로) · close.rate (근접 밀치기 확률 — ai.js closeQuarters)
  risk: K({ ko: '모험', knobs: K({ 'whole.sPref': [0, 1], 'whole.evade': [0, 1], 'close.rate': [0, 1] }),
    read: (k) => (k['whole.sPref'] + (1 - k['whole.evade']) + k['close.rate']) / 3 }),
  // 상처 앞 침착: 베였을 때 흔들리지 않는가. 0 쉽게 겁먹음 · 1 흔들림 없음. 함께 적는 wounded = 베인 뒤 하는 일.
  //  손잡이: pers.fearful (공포 문턱 — emotions.js) · 베이면 물러남(ai.js startWithdraw 0.8 — 모두 같음, 나중에 wounded 로 갈림)
  composure: K({ ko: '상처 앞 침착', knobs: K({ 'pers.fearful': [0, 0.5] }), read: (k) => 1 - n(k['pers.fearful'], 0, 0.5) }),
  // 끝내기: 상대가 피 흘리면 물고 늘어지는가. 0 쫓지 않음 · 1 끝까지.
  //  손잡이: pers.dogged (집념 문턱 — 이어 치기 3 · 간격 −0.15 m) · 쓰러진 상대 기회(opportunity 'finish') · hurry().cautious(상대가 피를 쏟으면 기다림 — 지금 모두 같음)
  finisher: K({ ko: '끝내기', knobs: K({ 'pers.dogged': [0, 0.7] }), read: (k) => n(k['pers.dogged'], 0, 0.7) }),
  // 기력 아끼기: 0 다 쓴다 · 1 아껴 쓴다. 인물 손잡이 없음 — 지금은 aggr × aggression > 1.15 이면 기력 −10 까지 · 아니면 20 에서 쉼(config.js STAMINA.aiRestAt · aiAggressiveRestAt)
  stamina: K({ ko: '기력 아끼기', knobs: K({}), read: null }),
  // 유파 특성: 고유 동작 · 패시브 · 비기를 얼마나 적극적으로 쓰나 (그 유파 숙련도가 연 것 안에서). 인물 손잡이 — 지금은 숙련도 표 AI_PROFICIENCY.schoolK[숙련도] 하나 +
  //  (10/29 15:5x) 싱지르 걸쇠 pers.spinHold (무장하면 먼저 치지 않고 기다리나 — 기본 true · 15:5x ~ 21:0x 베르나르도 false · 21:0x 부터 쓰는 인물 없음). 식에는 넣지 않음(낱말 손잡이)
  schoolArt: K({ ko: '유파 특성', knobs: K({}), read: null }),
});

/** 상처 앞에서 하는 일: 버틴다 · 허둥대며 마구 달려든다 · 물러나 다시 잰다 */
export const WOUNDED = Object.freeze(['fightOn', 'panic', 'withdraw']);
/**
 * 2:2 (아직 싸움이 없다 — 손잡이 없음):
 *  target 노리는 상대 — weakest 더 다친 쪽 · strongest 더 센 쪽 · allyAttacker 내 편을 치는 쪽 · nearest 가까운 쪽
 *  guard 0 둘이 하나를 몰아친다 · 1 내 편을 지킨다 / woundedFight 0 다쳤으면 다음 판에 안 나선다 · 1 다쳐도 나선다(생사전 같은 이어지는 판)
 */
export const TEAM_TARGETS = Object.freeze(['weakest', 'strongest', 'allyAttacker', 'nearest']);

const T = (o) => Object.freeze({ ...o, team: Object.freeze(o.team), lean: Object.freeze(o.lean ?? {}) });

/**
 * 인물 전투성향 초안. 값 뒤 '지금:' 주석 = 겹치는 시트 손잡이 값 (그 값으로 읽은 축 값과 초안이 맞는다). 시트에 없는 칸은 설정에서 — 근거 줄은 문서 §3.
 */
export const TEMPERAMENT = Object.freeze({
  // 지금: aggr .95 × aggression .9 + 시작 분노 .7 · pt 8 rhythm 1.6 · margin .22 · counter 0 vor .55 · feint 0 · followUp .12 angry .7 · sPref .9 evade .15 close .8 · fearful .45 · dogged .3
  bran: T({ initiative: 0.55, patience: 0.2, distance: 0.3, counter: 0.3, feint: 0, press: 0.3, risk: 0.85, composure: 0.1, wounded: 'panic', finisher: 0.45, stamina: 0.1, schoolArt: 0,
    team: { target: 'nearest', guard: 0.2, woundedFight: 0.35 } }),
  // 지금: aggr .78 × aggression .68 · pt 10 rhythm 5.2 · margin .4 · counter .12 vor .36 · feint .05 · followUp .28 angry .2 · sPref .35 evade .55 close .35 · fearful .35 · dogged .25
  isolde: T({ initiative: 0.05, patience: 0.55, distance: 0.75, counter: 0.25, feint: 0.1, press: 0.3, risk: 0.4, composure: 0.3, wounded: 'withdraw', finisher: 0.35, stamina: 0.8, schoolArt: 0.4,
    team: { target: 'nearest', guard: 0.6, woundedFight: 0.9 } }),
  // 지금: aggr 1.1 × aggression 1.05 · pt 8 rhythm 1.8 · margin .28 · counter .15 vor .5 · feint .36 · followUp .62 angry .3 · sPref .3 evade .75 close .25 · fearful .15 · dogged .5
  liao: T({ initiative: 0.65, patience: 0.25, distance: 0.45, counter: 0.35, feint: 0.7, press: 0.55, risk: 0.25, composure: 0.7, wounded: 'fightOn', finisher: 0.7, stamina: 0.55, schoolArt: 0.85,
    team: { target: 'strongest', guard: 0.25, woundedFight: 0.45 } }),
  // 지금: aggr 1.3 × aggression 1.15 · pt 6 rhythm 1.3 · margin .2 · counter .32 vor .72 · feint .46 · followUp .72 angry .6 · sPref .75 evade .3 close .6 · fearful .08 · dogged .7
  heinrich: T({ initiative: 1, patience: 0.1, distance: 0.25, counter: 0.6, feint: 0.9, press: 0.75, risk: 0.7, composure: 0.85, wounded: 'fightOn', finisher: 1, stamina: 0.2, schoolArt: 0.75,
    team: { target: 'weakest', guard: 0.1, woundedFight: 1 } }),
  // 지금: aggr 1.05 × aggression 1 · pt 8 rhythm 6 · margin .34 · counter .68 vor .45 · feint .1 · followUp .88 angry .1 · sPref .55 evade .45 close .15 · fearful 0 · dogged .4
  margarethe: T({ initiative: 0.55, patience: 0.55, distance: 0.6, counter: 0.7, feint: 0.2, press: 0.7, risk: 0.4, composure: 1, wounded: 'fightOn', finisher: 0.55, stamina: 0.9, schoolArt: 0.4,
    team: { target: 'allyAttacker', guard: 0.6, woundedFight: 0.7 }, lean: { initiative: -1, patience: +1 } }),
  // 지금: 시트 값 없음 (pers {} — 이탈리아 기질 범위에서 판마다 굴림 · 감정 문턱 0 = 감정 꺼짐)
  tome: T({ initiative: 0.35, patience: 0.6, distance: 0.35, counter: 0.55, feint: 0.25, press: 0.4, risk: 0.25, composure: 0.7, wounded: 'withdraw', finisher: 0.45, stamina: 0.7, schoolArt: 0.6,
    team: { target: 'nearest', guard: 0.5, woundedFight: 0.4 } }),
  // 지금: 시트 값 없음 (pers {} — 이베리아 기질 범위)
  omari: T({ initiative: 0.5, patience: 0.25, distance: 0.65, counter: 0.3, feint: 0.05, press: 0.55, risk: 0.55, composure: 0.7, wounded: 'fightOn', finisher: 0.4, stamina: 0.45, schoolArt: 0.5,
    team: { target: 'allyAttacker', guard: 0.8, woundedFight: 0.6 } }),
  // 지금: 시트 값 없음 (pers {} — 일본 기질 범위)
  minami: T({ initiative: 0.2, patience: 0.8, distance: 0.7, counter: 0.5, feint: 0.15, press: 0.3, risk: 0.3, composure: 0.8, wounded: 'fightOn', finisher: 0.2, stamina: 0.7, schoolArt: 0.8,
    team: { target: 'allyAttacker', guard: 0.9, woundedFight: 0.85 } }),
  // 지금: aggr .85 × aggression .8 · pt 4.5 rhythm 2.6 · margin .22 · counter .35 vor .45 · feint .2 · followUp .42 angry .2 · close .25 (whole 없음) · fearful .2 · dogged .45
  artoria: T({ initiative: 0.2, patience: 0.15, distance: 0.3, counter: 0.5, feint: 0.4, press: 0.4, risk: 0.45, composure: 0.6, wounded: 'fightOn', finisher: 0.65, stamina: 0.6, schoolArt: 0.65,
    team: { target: 'allyAttacker', guard: 0.9, woundedFight: 0.8 } }),
  // 지금: aggr .95 × aggression .9 · pt 6 rhythm 4 · margin .3 · counter .55 vor .45 · feint .15 · followUp .65 angry .12 · fearful .08 · dogged .4 — 권총 판은 gun.js 가 몰아 이 숫자를 거의 안 읽음(세이버를 든 얼터가 읽음)
  samira: T({ initiative: 0.35, patience: 0.3, distance: 0.5, counter: 0.6, feint: 0.3, press: 0.55, risk: 0.25, composure: 0.85, wounded: 'fightOn', finisher: 0.55, stamina: 0.7, schoolArt: 0.35,
    team: { target: 'allyAttacker', guard: 0.85, woundedFight: 0.45 } }),
  // 지금: aggr .84 × aggression .8 · rhythm 2.8 · vor .45 · angry .2 · fearful .22 · dogged .4 (pt · margin · counter · feint · followUp 없음)
  renji: T({ initiative: 0.15, patience: 0.4, distance: 0.3, counter: 0.5, feint: 0.1, press: 0.5, risk: 0.35, composure: 0.55, wounded: 'fightOn', finisher: 0.55, stamina: 0.6, schoolArt: 0.2,
    team: { target: 'allyAttacker', guard: 0.95, woundedFight: 0.7 }, lean: { finisher: -1 } }),
  // 지금: aggr .78 × aggression .75 · rhythm 3.2 · vor .35 · angry .1 · fearful .25 · dogged .3 (pt · margin · counter · feint · followUp 없음)
  eira: T({ initiative: 0.1, patience: 0.45, distance: 0.5, counter: 0.55, feint: 0.15, press: 0.35, risk: 0.25, composure: 0.5, wounded: 'withdraw', finisher: 0.45, stamina: 0.75, schoolArt: 0.5,
    team: { target: 'allyAttacker', guard: 0.85, woundedFight: 0.55 }, lean: { finisher: -1 } }),

  // ── 손님 인물 (special: true — 나중에 특별 토큰으로 고용하는 특별 동료 후보) ──
  // 지금: aggr .78 × aggression .76 · rhythm 2.9 · vor .4 · angry .12 · fearful .24 · dogged .4 (pt · margin · counter · feint · followUp 없음)
  ratna: T({ special: true, initiative: 0.1, patience: 0.5, distance: 0.65, counter: 0.45, feint: 0.15, press: 0.65, risk: 0.4, composure: 0.5, wounded: 'withdraw', finisher: 0.55, stamina: 0.7, schoolArt: 0.45,
    team: { target: 'nearest', guard: 0.7, woundedFight: 0.5 } }),
  // 지금: aggr .8 × aggression .85 · pt 16 rhythm 7.5 · counter .45 vor .6 · feint .12 · angry .05 · fearful .1 · dogged .25 (margin · followUp 없음)
  silver_wanderer: T({ special: true, initiative: 0.2, patience: 1, distance: 0.7, counter: 0.6, feint: 0.25, press: 0.5, risk: 0.3, composure: 0.8, wounded: 'fightOn', finisher: 0.35, stamina: 0.75, schoolArt: 0.6,
    team: { target: 'allyAttacker', guard: 1, woundedFight: 0.9 } }),
  // 지금: aggr .8 × aggression .78 · pt 10 rhythm 4.2 · margin .12 · counter .3 vor .45 · feint .05 · followUp .65 angry .06 · fearful .12 · dogged .18
  chanda: T({ special: true, initiative: 0.1, patience: 0.5, distance: 0.05, counter: 0.45, feint: 0.1, press: 0.5, risk: 0.3, composure: 0.75, wounded: 'fightOn', finisher: 0.25, stamina: 0.65, schoolArt: 0.5,
    team: { target: 'allyAttacker', guard: 0.7, woundedFight: 0.6 } }),
  // 지금: 시트 값 없음 (pers {} — 동방 기질 범위 · 흙 몸: 피를 흘리지 않고 머리가 떨어져야 쓰러짐)
  terracotta: T({ special: true, initiative: 0.5, patience: 0.45, distance: 0.3, counter: 0.35, feint: 0.2, press: 0.6, risk: 0.7, composure: 0.95, wounded: 'fightOn', finisher: 0.6, stamina: 0.5, schoolArt: 0.5,
    team: { target: 'nearest', guard: 0.2, woundedFight: 1 } }),
  // 지금 (10/29 15:5x 제 기질 — 전: 아르토리아 시트를 빌림): aggr .95 × aggression .85 · pt 9 rhythm 3.6 · margin .4 · counter .3 vor .65 · feint .08 · followUp .7 angry .45 · close .3 (whole 없음) · fearful .05 · dogged .6 · spinHold true
  roland: T({ special: true, initiative: 0.3, patience: 0.4, distance: 0.75, counter: 0.55, feint: 0.15, press: 0.7, risk: 0.6, composure: 0.9, wounded: 'fightOn', finisher: 0.85, stamina: 0.3, schoolArt: 0.85,
    team: { target: 'nearest', guard: 0.45, woundedFight: 1 } }),
  // 지금: 시트 값 없음 (pers {} — 일본 기질 범위) · 이름 · 사연 미정 시안이라 근거가 얇다(thin)
  white_scale: T({ special: true, thin: true, initiative: 0.5, patience: 0.65, distance: 0.7, counter: 0.45, feint: 0.35, press: 0.55, risk: 0.4, composure: 0.85, wounded: 'fightOn', finisher: 0.5, stamina: 0.6, schoolArt: 0.7,
    team: { target: 'nearest', guard: 0.5, woundedFight: 0.75 } }),
  // 지금 (10/29 21:0x 롤랑의 상극 '골짜기의 매복' — 문서 §7-5): aggr .9 × aggression .95 · pt 14 rhythm 2.5 · margin .6 · counter .55 vor .3 · feint .2 · followUp .75 angry .5 · close .6 (whole 없음) · fearful .1 · dogged .55
  //  싱지르 걸쇠 spinHold true (무장하면 칼끝 거리 끝에서 기다림 — 롤랑과 같음 · 유파 특성 .85) · 기력: aggr × aggression .86 ≤ 1.15 → 20 에서 쉼
  //  전 (10/29 15:5x 먼저 들어가는 칼): 선공 .8 · 참을성 .1 · 간격 .2 · 받아치기 .65 · 기력 .25 · 유파 특성 .6 (spinHold false) — 나머지 같음
  bernardo: T({ special: true, initiative: 0.35, patience: 0.55, distance: 1, counter: 0.55, feint: 0.4, press: 0.75, risk: 0.75, composure: 0.8, wounded: 'fightOn', finisher: 0.8, stamina: 0.4, schoolArt: 0.85,
    team: { target: 'strongest', guard: 0.5, woundedFight: 1 } }),
  // 11/01 본판 병합: 10/30 이후 확정된 character_julia.js 시트의 손잡이를 AXES.read로 환산했다.
  //  선공 .156 · 참을성 .316 · 간격 .45 · 받아치기 .481 · 속임 .84 · 막힌 뒤 .646 · 침착 .7 · 끝내기 .357.
  //  실제 AI 시트는 그대로 둔다. 직접 환산할 수 없는 모험 · 상처 반응 · 기력 · 유파 특성 · 팀 성향은 생사전 초안을 유지한다.
  julia: T({ special: true, initiative: 0.156, patience: 0.316, distance: 0.45, counter: 0.481, feint: 0.84, press: 0.646, risk: 0.3, composure: 0.7, wounded: 'withdraw', finisher: 0.357, stamina: 0.7, schoolArt: 0.7,
    team: { target: 'weakest', guard: 0.4, woundedFight: 0.6 } }),
});

/**
 * 성향이 원본과 다른 얼터 (예외 — 나머지 얼터는 원본 칸). 숙련도 표는 늘 원본 칸(+ 얼터 +1 은 characters.js).
 *  광기의 쥘리아 (10/30 — 사장님 10/30 22:1x '상점주인이자 방랑과 생사전에 나오게 해' · 감독 초안 '같은 유파 꼴 · 성향은 더 차갑고 기계적이고 끈질김 · 설정 없음' · 사장님 확인 전):
 *   먼저 들어감 .75 · 기다리지 않음 .15 · 간격 .45 · 받아치기 .6 · 속임 .3(흥정 없음) · 막힌 뒤 .95 · 모험 .55 · 침착 1 · 버팀 · 끝내기 1 · 기력 아끼지 않음 .35 · 2:2 다친 쪽 · 지킴 .05 · 다쳐도 나섬 1
 */
export const ALTER_TEMPERAMENT = Object.freeze({
  julia_mad: T({ special: true, thin: true, initiative: 0.75, patience: 0.15, distance: 0.45, counter: 0.6, feint: 0.3, press: 0.95, risk: 0.55, composure: 1, wounded: 'fightOn', finisher: 1, stamina: 0.35, schoolArt: 0.6,
    team: { target: 'weakest', guard: 0.05, woundedFight: 1 } }),
});

const baseId = (id) => (id in PROFICIENCY ? id : String(id ?? '').replace(/_mad$/, ''));
/** 인물 id → { 유파: 숙련도 } (변형 id 는 원본 칸 · 없으면 null) */
export function proficiencyOf(id) {
  return PROFICIENCY[baseId(id)] ?? null;
}
/** 인물 id → 전투성향 (변형 id 는 원본 칸 · 없으면 null) */
export function temperamentOf(id) {
  return ALTER_TEMPERAMENT[id] ?? TEMPERAMENT[baseId(id)] ?? null; // 성향이 따로 있는 얼터 먼저 (광기의 쥘리아)
}

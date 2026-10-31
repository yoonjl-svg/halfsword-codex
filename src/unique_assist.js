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
//   · 길 덧칸 (10/25 18:0x 사장님 '같은 길 입혀' — 지금은 곁눈 베기만 · config UNIQUE_ASSIST.schielPlayer): AI 다시 그린 길과 같은 칼끝 들기 · 손 뻗기 · 손 돌리기(사장님 10/25 20:2x '칼끝 들기 빼지 마' · schielPlayerTip 0 은 시험용)를
//          손가락이 그 길 위 어디쯤인지로 섞어 얹는다(planStep → fighter.techPlan → fighter.js driveSword). 손 목표는 그대로 손가락 — 덧칸이 손 목표를 몸 앞으로 미는 몫은 driveSword 안
//  잇는 동작(chain 칸 — 머리 위 돌려 베기·겹치기 · 10/21 통폐합 전엔 코코 연타·위아래 사슬·번갈아 올려베기도)은 플레이어가 박자 창(chainWait) 안에 실제로 이어 그을 때만 그 긋기에 뒷몫 강화를 얹는다.
//   자동으로 두 번째 칼을 내지 않는다. 앞 긋기 조건으로 여는 것(츠바메가에시·카바치오네·염시·자→격)은 그 긋기 자체가 이어 그은 것이다.
//  비기·막기 버튼·탭 찌르기·손잡이 찍기·마무리 찍기·약한 자세 간격 맞추기가 돌고 있으면 발동하지 않고, 강화 중에 그것들이 시작되면 곧장 물러난다.
//  발동하면 기술 이름 알림(main.js showTechCue 'unique' — AI 고유 동작 알림과 같은 칸, '내 · 굽은 베기' 꼴).
//  AI 쪽은 아래 표의 단계만 읽는다(aiUniqueStages — 숙련도 거르기 10/13, sword_art.js applySchoolArt · ai.js). body·body2 칸은 플레이어만.
//  수는 config.js UNIQUE_ASSIST (확인표 1040~1047 · 10/14 강화 수는 owner_defaults_table.md 끝, 사장님 확인 전). 끄기 `?uniqueAssist=0`.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { UNIQUE_ASSIST as UA, SKILL, SECRET, STAMINA, IB_FLOW, THRUST } from './config.js';
import { G, TECH, TECH_BY_NAME } from './ai_techniques.js';
import { TRADITIONS } from './schools.js';
import { segDist } from './skill.js';
import { requestArtReturn, requestArtSnap, requestArtThrust, requestArtFold, requestArtDup, requestArtRedondo, setArtTechOf, iaiBusy } from './secret_instant.js'; // 진 · 츠바메가에시 되돌림 칼 · 고유 동작 잔상 (10/21) · 제비 베기 되돌림 칼 (10/25 해법 ②) · 칼끝 돌려 빼기 운동학 찌름 (10/28)
import { perkOff, kitOff } from './skill_kit.js';
import { beginFlowRecovery } from './nagashi_recovery.js'; // 칼끝 돌려 빼기 심화 · 헛누름 — 상대 두 팔 늦춤 (흘림과 같은 장치 · 10/31)
import { windStart, windStep, windEnd, windLoopOf, windRopesBack } from './iberian_redondo.js'; // 풍차 베기 머리 위 감기 (B4 — 10/29) // 플레이어 스킬트리 몫 (10/21 — 돌려 베기 쌓기 = 이베리아 심화 B6)

// ── 고유 동작 표 (디렉터 안 → 사장님 확정 10/13 22:3x. 바뀌면 여기 한 곳만 고친다) ──
//  유파마다 넷 = 발 기술 1 · 공유 2 · 대표 1 (10/21 통폐합으로 둘~셋 — 아래 머리말). stage = 단계(1~4 — AI 는 숙련도로 거른다: 아래 aiUniqueStages · 플레이어는 스킬트리 칸마다 하나 — 10/21 skill_tree_data.js u 칸). name =schools.js 그 유파 unique 의 이름(path 가 있으면 그 이름의 길을 빌림).
//  on = 여는 조건 목록(하나라도 맞으면):
//   { tech }        이 긋기가 그 기본 동작(시작 패드 + 첫 방향)
//   { pad, dir }    시작 패드 + 방향('up' | 'down' | 'horiz')
//   { prev, when, dir? } 앞 긋기 뒤: prev = 'cut' | 'thrust' | 기본 동작 이름 · when = 'bound'(앞 긋기가 칼에 맞물림·막힘) | 'miss'(못 맞힘 — 막힘 포함) |
//                   'any'(맞든 빗나가든) — 셋 다 앞 긋기가 끝나고 afterWindow 안 · 'turn'(앞 찌르기가 시작되고 turnWindow 안에 방향을 허용 각 넘게 꺾음)
//  far = 조건으로 여는 동작이지만 길과의 거리(joinMax)를 보지 않는다(겹치기: 맞물린 자리가 길에서 멀어도 다음 긋기 방향만 맞으면 — 어긋남은 blend 로 줄어든다)
//  anchor 'start' = 고유 동작 길이 기본 긋기보다 짧아 손이 곧 지나쳐 버리는 것(코테 — 끝 자리가 긴 자세 바로 밑 · 10/21 통폐합 전엔 좌익격도): 길 토막을 긋기 시작 자리에 옮겨 놓고 그 위에서 잇는다
//  chain = 두 번 잇는 동작: at = 뒷부분이 시작되는 길 점 번호(점 목록 = [from, ...path] 또는 [가짜 자리, ...then]) · dir = 그 자리에서 손가락이 그쪽으로 그어야 이음
//  탭 찌르기도 '내 찌르기'로 센다(prev 'thrust' — 맞물림·any). 이베리아 rodaCounter(길 없는 맞받아치기 목록)는 플레이어 표에서 뺀다(AI 데이터는 그대로)
//  body = 플레이어 강화의 몸 꼴 (10/14, 플레이어만 — AI 는 읽지 않는다) [골반 돌림 °, 가슴 돌림 °, 숙임 °, 낮춤 m] · body2 = 잇는 동작 뒷몫(플레이어가 이어 그은 긋기)의 몸 꼴(없으면 body).
//   돌림 부호는 자세표(guards.js)와 같음(+ 오른쪽으로 감음 · − 왼쪽). 값 = 고유 동작 몸 꼴 점검(10/12 …/body-audit-2q36ha, 모두 [추정]·[해석])의 절반 안팎 — 사장님 확인 전.
//   한 동작 안에서 두 방향으로 도는 것(머리 위 돌려 베기 +40 → −40 등)은 앞 긋기 = 앞 방향, 이어 그은 뒷몫 = 뒤 방향. 세기는 UNIQUE_ASSIST.enhance 로 한꺼번에
// 통폐합으로 뺀 고유 동작 (10/21 — 사장님 'ai 도 줄이고'): AI 도 평소 고르는 꾸러미에서 뺀다. 다만 비기가 빌려 쓰는 길(이탈리아 엇박 찌르기 = passataSotto ·
//  옛 판 비기 독일 v1 krumphau · 동방 v1 zuoyi)은 꾸러미의 이름 표(techByName)에만 남겨 둔다(고르는 목록 tech 에는 없음 — sword_art.js applySchoolArt)
export const RETIRED_UNIQUE = new Set(['krumphau', 'passataSotto', 'altibaixo', 'talhoRevezBaixo', 'kokoRenda', 'zuoyi']);
// 통폐합 (10/21 사장님 '판정표대로 통폐합 해' — 판정은 docs/strike/unique_attack_study_result_2026-10-20.md 뒤 의견 · 사람 기술 기준): 유파마다 넷 → 둘~셋.
//  뺀 것: 독일 굽은 베기(분노의 베기와 구별 안 됨 · 쓰임 최저) · 이탈리아 밑으로 들어가 찌르기(드묾 · 비기 런지와 겹침) · 이베리아 위아래 사슬 · 번갈아 올려베기(이어 긋기 셋이
//  비슷 — 머리 위 돌려 베기로 모음, 이어 그을수록 힘이 쌓이는 강화는 다음 단계) · 일본 코코 연타(이베리아 돌려 베기와 같은 몸 뒤집는 이어 긋기) · 동방 좌익격(일본 코테와 같은 동작).
//  동방 체보요격은 독일 비껴 딛는 가로베기와 걸음 · 몸 값이 같아 앞으로 끌어 딛는 걸음(schools.js step — AI 같이) · 낮은 몸(body — 플레이어)으로 바꿈(값은 사장님 확인 전).
//  단계 번호는 그대로(빈 번호는 뺀 것). AI 도 이 표를 따른다(10/21 'ai 도 줄이고' — 아래 aiUniqueStages · RETIRED_UNIQUE)
// 강화동작 · 명령 (10/21 사장님 '그걸 강화동작이라고 부르자. 그 구조로 진행해'): 유파마다 기본 동작 하나가 강화동작으로 바뀌고(그 기본 동작은 없어짐 — 늘 강화동작),
//  나머지는 명령으로 쓴다. role 칸 —
//   'enh'   강화동작: replaces 의 기본 동작을 그으면 늘 이것(명령 없음 · 끝 힘 UNIQUE_ASSIST.enhPower · stack 이면 이어 그을수록 + stack 씩, 셋까지). AI 도 그 기본 동작 대신 이것(sword_art.js)
//   'step'  걸음 명령: 긋기를 시작할 때 스틱(키)을 stick 쪽('side' 옆 · 'fwd' 앞)으로 밀고 있으면 그 쪽으로 디디며(옆은 스틱 쪽으로 걸음 좌우를 맞춤). 안 밀면 기본 동작 그대로
//   'chain' 이어 긋기: 앞 동작 뒤 창 안의 긋기 — 창이 열리면 자세 칸에 이름이 뜬다(ready · main.js updateGuardName)
//  hint = 대기실 스킬북 목록의 쓰는 법 한 줄
// 사람 제비 베기 올려 긋는 길 (사장님 10/25 21:1x 해법 ③ — 아래 tsubameGaeshi aim · config UNIQUE_ASSIST.tsuAim · 기록 docs/strike/tsubame_snap_2026-10-25.md): 패드 점 · 덧칸 [칼끝 들기 °, 손 뻗기 m, 손 돌리기 °].
//  꺾은 자리(덧칸 첫 칸)에서 칼끝을 30° 더 떨궈(내려간 칼이 상대 다리 곁을 비킴 — 제비가 몸을 뒤집는 자리) 오른 아래 [0.2, −0.2](칼끝 10° 떨굼)를 지나 가슴 높이 가운데 [0, 0.1] 로 올려 긋는다
//  (전 길 = schools.js 의 [0.06, −0.15] → 오른 황소 [0.22, 0.26] — 내려간 칼이 상대 다리 · 골반을 먼저 지남). 손 돌리기 −40° = 날이 앞장선 칼 면에서 뒤침 쪽으로 40°
//  (날 세우기 문턱 STRIKE.edgeAlign 0.6 안 — 날이 앞장선 그대로면 아래팔 굴림이 손목 밧줄 끝 80° 가까이). 손 뻗기는 0(손을 몸 쪽으로 거두면 끌고 가는 팔이 상대 칼 · 내 몸에 박혀 몸이 튕김 — 기록).
//  수는 [추정] — 사장님 확인 전 (확인표 2575 · 2576). 도구가 시험 길로 덮어쓸 수 있게 따로 둔다 (tools/sim/schielhau_strike.mjs --tsuPath · --tsuPlan)
//  band (사장님 10/25 23:1x '위팔·가슴을 노리기보다 자연스럽게 몸통 전체(다리 위 골반부터 목 아래 가슴까지)를' — config UNIQUE_ASSIST.tsuBand 1): 가슴 높이 끝 점에 맞춘 덧칸 대신
//   위와 같은 길(앞으로 뻗어 상대에 닿는 길 — 오른 황소 쪽 AI 길은 뒤로 거둬 싸움에서 끌고 간 칼 셋에 둘이 아무 데도 안 닿음)을 끌고 가되, 그 길이 지금 상대에게 처음 닿을 곳이
//   몸통 띠(골반 · 배 · 목 아래 가슴) 밖이면 길 높이를 가장 적게 옮긴다(secret_instant.js comboBandShift — 다리면 위로 · 목 · 머리면 아래로 · 팔이면 가까운 쪽 먼저).
//   칼끝 떨굼은 옮긴 높이의 자세 지도가 손 · 칼끝을 함께 정하고, 손 돌리기는 날이 앞장서게 두되 사람 손목(손목 밧줄 HUMAN.forearmRoll)이 못 하면 한도까지만(placeIai 굴림 묶음) —
//   끌고 가는 칼 덧칸은 0 · 끌고 간 칼이 끝난 뒤 손가락 몫 덧칸(planStep)은 위 plan 그대로. 길은 2575 그대로 · 띠 규칙 사장님 10/25 결정(확인표 2586) ·
//   옮김 칸 수 [추정] 사장님 확인 전(2587). tsuBand 0 = 위 path · plan (10/25 21:1x 판)
//  line (사장님 10/31 16:xx '제비 베기는 곧은 길로 바꿔' — config UNIQUE_ASSIST.tsuHook 0 · 기록 docs/strike/tsubame_straight_2026-10-31.md · 확인표 3230 ~ 3239): band 의 갈고리
//   ([0.2, −0.2] 로 칼 든 쪽에 0.3 m 나갔다 되돌아옴 — 곧은 줄 대비 0.5 · 꺾임 약 100°) 대신 꺾은 자리에서 왼 위 [−0.3, 0.25] 로 곧게 한 번(점 하나라 꺾은 자리가 어디든 곧은 줄).
//   등 뒤에서 보아 칼끝이 골반 높이에서 머리 높이로 왼쪽 약 30° 기울어 오름 — 오른 위(전 길 [0.06, −0.15] → [0.22, 0.26])로 곧게 올리면 손목 밧줄 안에서 날이 앞장설 수 없어
//   칼등이 앞장섬(92 %). 몸통 띠 · 굴림 묶음은 band 와 같고 셋을 더함: shift 'slide' = 띠 옮김이 위로면 길을 제 줄 따라 밀어 올림 · 아래로면 꺾은 자리를 축으로 기울임(곧은 줄 그대로) ·
//   pathHint = 날 쪽을 길 위 칼끝으로 잼(놓인 칼끝으로 재면 손목 교정 · 날 쪽이 스텝마다 오가며 곧은 길이 40 ~ 60° 꺾임) · arcCut = 잔상은 베는 토막만(꺾은 자리로 거두는 준비 토막은 안 그림).
//   끌고 가는 칼 · 끌고 간 뒤 손가락 몫 덧칸 0. 수는 [추정] — 사장님 확인 전 (확인표 3231)
export const TSU_AIM = {
  path: [[0.2, -0.2], [0, 0.1]],
  plan: [[-30, 0, -40], [-10, 0, -40], [0, 0, -40]],
  band: { path: [[0.2, -0.2], [0, 0.1]], plan: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] },
  line: { path: [[-0.3, 0.25]], plan: [[0, 0, 0], [0, 0, 0]], shift: 'slide', pathHint: true, arcCut: true },
};
export const PLAYER_UNIQUE = {
  german: [
    { stage: 1, name: 'zwerchAbtritt', role: 'step', stick: 'side', hint: '옆으로 걸으며 가로 긋기', body: [-15, -20, 1.5, 0.025], on: [{ tech: 'zwerch' }] }, // 비껴 딛는 가로베기 ← 옆 + 가로베기
    { stage: 3, name: 'duplieren', role: 'chain', hint: '칼이 맞물린 뒤 다시 긋기', far: true, body: [5, -3, 3, 0], on: [], // 겹치기 — 사람은 탭으로만 (10/28 01:2x 사장님 '지금대로' — 맞물린 뒤 다음 긋기 입력은 뺌 · AI 는 schools.js 그대로 — 이 칸을 안 읽음)
      // tapKey = 탭으로 내는 조건 (TAP_TRIG 'dup' — config UNIQUE_ASSIST.dupTap): 내 긋기가 상대 칼에 맞물려 지금도 닿아 있는 동안의 탭 · tapDup = 맞물린 자리에서 칼을 떼지 않고
      //  상대 칼 뒤로 밀어 넣어 엇갈린 손으로 얼굴을 사선으로 베는 운동학 칼(secret_instant.js requestArtDup)
      //  10/31 18:xx 사장님 결정부터 기본은 탭 없이 저절로 (UNIQUE_ASSIST.dupAuto 'bind' — dupAutoTick: 가슴 사이 0.8 ~ 1.6 m 에서 칼끼리 맞댄 채 0.6 s) · 탭 조건은 dupAuto 0 일 때만
      tapKey: 'dup', tapDup: 1, special: true },
    { stage: 4, name: 'schielhau', role: 'enh', replaces: 'zornhau', hint: '강화동작 · 분노의 베기 대신 · 맞은 상대가 무릎을 꿇기도 함', body: [-12, -8, 2, 0.02], /* 10/21 전수 조사: 오른쪽 위 → 왼쪽 아래 긋기라 몸도 왼쪽(−) — 전 +12 · +8 은 긋기와 반대 */ on: [{ tech: 'zornhau' }] }, // 곁눈 베기 ← 분노의 베기 (늘 — 같은 시작 자리 오른쪽 머리 위 · 10/21 사장님 '분노의 베기를 바꾸는 걸로' · 전 황소 찌르기는 찌르기 → 베기로 어긋나 AI 손해)
  ],
  italian: [
    // 10/31 이탈리아 자리 바꿈 (사장님 10/31 12:xx — 칼끝 돌려 빼기 = 기본 고유 공격 I2 · 비껴서며 찌르기 = 특수 공격 I9 · config UNIQUE_ASSIST cav* · inq* · docs/strike/italian_swap_2026-10-31.md):
    //  단계(AI 숙련도 거르기)도 칸 깊이를 따름(전 판도 단계 = 칸 깊이 − 1 이었음 — 비껴서며 찌르기 d 2 = 1 · 내려 찌르기 d 3 = 2 · 돌려 빼기 d 4 = 3) — 10/31 12:xx 사장님 '임브로카타를 먼저 배우고 카바치오네를 배우고':
    //  위에서 내려 찌르기 I2 d 2 = 1 · 칼끝 돌려 빼기 I7 d 3 = 2 · 비껴서며 찌르기 I9 d 4 = 3 (다른 유파 특수 공격과 같은 3)
    { stage: 2, name: 'cavazione', role: 'chain', hint: '칼이 상대 칼에 닿은 채 박자를 맞추어 탭', nameKo: '칼끝 돌려 빼기 (카바치오네)', orig: 'cavazione', body: [5, 8, 4, 0.02], on: [], // 칼끝 돌려 빼기 — 사람은 탭으로만 (AI 는 schools.js 속임 · 빼서 찌르기 패시브 그대로 — 이 칸을 안 읽음)
      // tapKey = 탭으로 내는 조건 (TAP_TRIG 'cav' — 10/31 칼끼리 닿음 뒤 cavFrom ~ cavTo 의 탭 · 내 긋기 동안의 닿음은 셈 밖) · tapSnap = 상대 칼 밑으로 돌려 빼 반대쪽을 찌르는 운동학 칼(requestArtThrust — 보통 찌르기 빠르기 · 잔상 없음)
      //  special 없음 = 특수 공격 식힘 · 잔상 · 고노센 몫 없음 (10/31 사장님 '카바치오네는 이제 특수공격이 아니고')
      tapKey: 'cav', tapSnap: 1 },
    // 10/31 12:xx 사장님 'I7은 어떤 방향이나 높이에서든 다른 유파의 내려 긋는 베기에 해당하는 커맨드를 내려찌르기로 전환해 주도록 하자. 어차피 지금 이탈리아 수직 베기는 거의 공격으로서 의미가 없잖아':
    //  사람 = 황소 찌르기 긋기(stichOchs) · 그 거울(stichOchsL — 왼 황소에서 내려 찌르는 긋기) · 아래로 가는 베기(down — 곧장 아래 ↓ · 사선 아래 ↙/↘ · 어느 자세 · 높이에서든: UNIQUE_ASSIST.imbroDown) 모두 →
    //  위에서 내려 찌르기 탭 찌르기(아래 tap). 수평 · 올려 긋기 · 다른 찌르는 긋기 · 탭은 그대로. AI 는 replaces 그대로(황소 찌르기 자리만 — sword_art.js) · 전 on [{ tech: 'stichOchs' }] · `?imbroDown=0`
    { stage: 1, name: 'imbroccata', role: 'enh', replaces: 'stichOchs', hint: '강화동작 · 내려 긋는 칼 대신', body: [10, 12, 8, 0.04], on: [{ tech: 'stichOchs' }, { tech: 'stichOchsL', down: true }, { down: true }], // 위에서 내려 찌르기 ← 황소 찌르기 (늘) · 10/31 내려 긋는 칼 모두 (down 칸 — condOk)
      // tap = 읽힌 순간 탭 찌르기 덧씌우기로 찌름 (사장님 10/27 23:5x '찌르기 뻗게 고치고' — config UNIQUE_ASSIST.imbroReach · AI 임브로카타와 같은 길 · 기록 docs/strike/imbroccata_2026-10-27.md)
      tap: 1 },
    { stage: 3, name: 'inquartata', role: 'step', hint: '상대가 공격해 올 때 옆으로 움직이며 탭', nameKo: '비껴서며 찌르기 (인콰르타타)', orig: 'inquartata', body: [18, 10, 5, 0.025], bodyMirror: 1, /* 몸을 칼 줄 밖으로 빼는 쪽 = 디딘 쪽(10/21 — 스틱 쪽) */ on: [], // 비껴서며 찌르기 — 사람은 탭으로만 (10/31 · 전 판 걸음 명령 '옆 + 쟁기 찌르기 긋기'는 사람 몫에서 뺌 — on 없음 · stick 없음 · role 'step' 은 카드 갈래 '걸음 기술' 글만 · AI 는 schools.js 걸음 기술 그대로)
      // tapKey = 탭으로 내는 조건 (TAP_TRIG 'inq' — 상대 칼이 들어오는 동안 스틱 옆의 탭) · tapVoid = 스틱 쪽으로 몸을 빼며(뒷발을 돌려 디딤) 넷째 자세로 가슴을 찌르는 운동학 칼(requestArtThrust void · 고노센 × specialShare.inquartata · 잔상)
      tapKey: 'inq', tapVoid: 1, special: true }, // special = 특수 공격 공통 식힘(UNIQUE_ASSIST.specialCooldown) · AI 특수 공격 몫도 이 이름(ai.js SPECIALS — schools.js 걸음 기술 inquartata)
  ],
  iberian: [
    { stage: 1, name: 'talhoRodeado', role: 'step', stick: 'side', hint: '옆으로 걸으며 사선 내려 긋기', body: [-15, -8, 4, 0.02], /* 10/21 전수 조사: 탈류(오른쪽 위 → 왼쪽 아래) · 원전 「왼쪽 위로 나사처럼」 — 몸 왼쪽(−) · 전 +15 · +8 은 긋기와 반대 */ on: [{ tech: 'zornhau' }] }, // 둥근 걸음 탈류 ← 옆 + 분노의 베기
    // 풍차 베기 (B4 레돈두 — 이베리아 특수 공격 · 사장님 10/29 01:3x '레돈두를 지금 우리가 개발 중인 특수공격으로' · 01:5x '레돈두는 풍차 베기로' — config UNIQUE_ASSIST.rdHold · 확인표 2727):
    //  사람 = role 'hold' — 탭을 길게 눌러 머리 위로 칼을 돌리다(iberian_redondo.js) 떼면 곧장 왼 위 → 오른 아래 사선으로 내려 벰(secret_instant.js requestArtRedondo — 10/30 rdRelease 'direct' · 'chamber' = 10/29 판 왼팔 위로 떨어뜨림) · 왼 가로베기는 사람에게 보통 긋기로 돌아감(긋기 조건 on 없음).
    //  ai = AI 몫 그대로(전 판 강화동작 — 왼 가로베기 대신 · enhancedMoves · sword_art.js 가 읽음) · stack = AI 이어 그을수록 맞는 순간 에너지 + 10 %(셋까지 — strokeHitK · 사람은 쌓기 칸이 없어 안 받음 — 10/29 B6 은 이어지는 흐름)
    { stage: 3, name: 'redondo', role: 'hold', hold: 1, special: true, nameKo: '풍차 베기 (레돈두)', orig: 'redondo', hint: '탭을 길게 눌러 머리 위로 칼을 돌리다 떼면 내려 벤다', on: [], ai: { role: 'enh', replaces: 'zwerchL' }, stack: 0.1 },
  ],
  japanese: [
    { stage: 1, name: 'hirakiGiri', role: 'step', stick: 'side', hint: '옆으로 걸으며 왼 사선 내려 긋기', body: [-18, -12, 2, 0.02], bodyMirror: -1, /* 開き = 비스듬히 디딘 뒤 몸을 상대 쪽으로 엶 → 디딘 쪽의 반대로(오른쪽으로 디디면 왼쪽) · 원전에 몸 돌림 수 없음 — 10/21 확인 */ on: [{ tech: 'zornhauL' }] }, // 히라키기리 ← 옆 + 왼 분노의 베기
    { stage: 2, name: 'kote', role: 'enh', replaces: 'langortDown', hint: '강화동작 · 가운데서 짧게 내려베기 대신', anchor: 'start', body: [5, 3, 4, 0.015], on: [{ pad: 'langort', dir: 'down' }] }, // 코테 ← 긴 자세에서 짧게 내려베기 (늘)
    { stage: 3, name: 'tsubameGaeshi', role: 'chain', hint: '내려벤 칼이 빗나가거나 막힌 뒤 위로 긋기', body: [0, 0, 5, 0.02], body2: [0, 0, 0, 0.02], on: [{ prev: 'oberhau', when: 'miss', dir: 'up' }, { prev: 'zornhau', when: 'miss', dir: 'up' }, { prev: 'zornhauL', when: 'miss', dir: 'up' }], /* 10/21 15:4x 사장님 '츠바메가에시 자체의 발동을 완화하고 데미지는 진에서 세게' — 정수리 · 좌우 사선 내려베기가 빗나가거나 막힌 뒤 위로 */ chain: { at: 2 },
      // 세 해법 (사장님 10/25 21:1x '해법 1~3 좋아' — config UNIQUE_ASSIST.tsuRuler · tsuSnap · tsuAim · 사람만): ruler 'turn' = 끝 힘 잣대를 꺾은 자리부터(이 동작은 앞 칼 조건으로 열려 강화되는 긋기가 곧 올려 긋기) ·
      //  snap = 꺾는 순간 올려 긋는 길을 끌고 감(secret_instant.js requestArtSnap) · aim = 올려 긋는 길(꺾은 자리 다음 점부터 — 길 점 번호 chain.at 뒤를 바꿈) · plan = [꺾은 자리, ...path] 점마다 [칼끝 들기 °, 손 뻗기 m, 손 돌리기 °]
      //  (곁눈 베기 같은 길 덧칸과 같은 칸 — planStep). 수는 [추정] — 사장님 확인 전 (확인표 2575 · 2576)
      ruler: 'turn', snap: 1, aim: TSU_AIM, special: true }, // 츠바메가에시 (special — 특수 공격 공통 식힘 · 10/28 02:0x)
  ],
  chinese: [
    { stage: 1, name: 'chebuYaoji', role: 'step', stick: 'fwd', hint: '앞으로 걸으며 가로 긋기', body: [-8, -12, 4, 0.045], on: [{ tech: 'zwerch' }] }, // 체보요격 ← 앞 + 가로베기 (앞으로 끌어 딛고 낮게)
    { stage: 3, name: 'lianchi', role: 'chain', hint: '찌르다가 거두어 베기', nameKo: '날개 접기 (염시)', orig: '斂翅', body: [-15, -20, 0, 0], on: [], // 염시 — 사람은 탭으로만 (10/28 01:2x 사장님: 꺾음 · 부딪힘 입력은 뺌 · AI 는 schools.js 속임 길 그대로 — 이 칸을 안 읽음)
      // tapKey = 탭으로 내는 조건 (TAP_TRIG 'lian' — 사장님 10/28 01:2x — config UNIQUE_ASSIST.lianTap · lianWindow): 물러나는(스틱 뒤) 동안 · 놓고 실제 0.6 s 안의 탭 ·
      //  tapFold = 오른 허리로 거뒀다 앞으로 디디며 허리를 가로 베는 운동학 칼(secret_instant.js requestArtFold — 격살 한 칼과 같은 가로 호 · 겨눔 = 상대 배)
      tapKey: 'lian', tapFold: 1, special: true },
    // 요격(腰擊) 강화동작 — 전 표의 자→격(ciji)을 모음: 가로베기가 늘 요격이라 찌른 뒤 가로로 그으면 그대로 자→격. AI 의 자→격 패시브 단계는 aiPassive 로 그대로
    { stage: 4, name: 'yaoji', role: 'enh', replaces: 'zwerch', aiPassive: 'ciji', hint: '강화동작 · 가로베기 대신 · 몸통을 베면 피를 더 흘림', body: [-12, -16, 2, 0.02], on: [{ tech: 'zwerch' }] }, // 요격 ← 가로베기 (늘)
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
    if (e.aiPassive) passive.set(e.aiPassive, e.stage); // 동방 자→격 패시브(yaoji 이음)는 요격 강화동작과 같은 단계
  }
  return { unique, passive, retired: RETIRED_UNIQUE };
}

/** 강화동작 (10/21): 유파 → [{ base 기본 동작, name 강화동작, stage }] — 기본 동작이 TECH 이름인 것만(일본 코테의 '가운데서 짧게 내려베기'는 AI 기술이 아님). sword_art.js 가 AI 꾸러미를 바꿀 때 읽는다 */
/**
 * 지금 이 싸움꾼이 긋는 기술 이름 (10/21 강화동작 이점 — combat.js 가 맞는 순간 읽는다): 플레이어 = 강화 중인 고유 동작(긋기가 끝난 뒤 0.2 s 까지 — 칼은 손가락보다 늦게 멎는다) ·
 *  AI = 공격 중인 기술(강화동작은 기본 동작 자리에서 그 이름으로 나온다 — sword_art.js). 아니면 null
 */
export function strokeTechOf(f) {
  if (f?.artTech) return f.artTech; // 끌고 가는 되돌림 칼 (진 · 츠바메가에시 — secret_instant.js requestArtReturn)
  const u = f?.skill?.uniq;
  if (u) {
    if (f.skill.tap?.uniqTech) return f.skill.tap.uniqTech; // 고유 공격이 낸 탭 찌르기 (위에서 내려 찌르기 닿게 · 칼끝 돌려 빼기 탭 — 10/28)
    if (u.r) return u.r.e.name;
    if (u.cur?.unique) return u.cur.unique;
    if (u.last?.unique && u.last.tEnd != null && u.t - u.last.tEnd <= 0.2) return u.last.unique;
  }
  const ai = f?.aiCtl;
  return ai && ai.mode === 'attack' ? ai.tech?.name ?? null : null;
}

const STACK_BY_NAME = Object.fromEntries(Object.values(PLAYER_UNIQUE).flat().filter((e) => e.stack).map((e) => [e.name, e.stack]));
/** 이어 그을수록 강해짐의 판정 에너지 배율 (10/21): 지금 긋는 기술에 stack 이 있으면 1 + stack × 이어 그은 수(플레이어 PlayerUniqueAssist.stackN · AI ai.stackN — 셋까지) · 아니면 1 */
export function strokeHitK(f) {
  const name = strokeTechOf(f);
  const s = name && !perkOff(f, name) ? STACK_BY_NAME[name] : 0; // 사람은 심화 칸(이베리아 B6 쌓기 — 10/21)을 익혀야
  if (!s) return 1;
  const n = f.skill?.uniq ? f.skill.uniq.stackN ?? 0 : f.aiCtl?.stackN ?? 0;
  return 1 + s * n;
}

export function enhancedMoves(tradition) {
  // ai 칸 = AI 몫이 사람과 다른 기술 (풍차 베기 — 사람은 길게 눌러 내는 특수 공격 · AI 는 전 판 왼 가로베기 강화동작 그대로 · 10/29)
  return (PLAYER_UNIQUE[tradition] ?? []).map((e) => (e.ai ? { ...e, ...e.ai } : e)).filter((e) => e.role === 'enh' && TECH_BY_NAME[e.replaces]).map((e) => ({ base: e.replaces, name: e.path ?? e.name, stage: e.stage }));
}

const D2R = Math.PI / 180;
/** 특수 공격 칼끝 빠르기 몫 (사장님 10/29 02:0x '모든 유파 특수공격을 고노센 곱하기 n으로' — config UNIQUE_ASSIST.specialShare · 확인표 2734): 끌고 가는 칼 칼끝 = 같은 칼 고노센 칼끝 × 이 몫 */
export const specialShare = (name) => UA.specialShare?.[name] ?? 0;
const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
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

/** 표 항목의 고유 동작 (schools.js 그 유파 unique 에서): 이름 · 알림 이름 · 칼 종류 · 길 점 · 걸음 (· 길 덧칸 plan — 있을 때만). 없으면 null */
export function uniqueDef(tradition, e) {
  const list = TRADITIONS[tradition]?.unique ?? [];
  const key = e.path ?? e.name;
  let u = list.find((x) => x.name === key);
  if (!u) return null;
  // 같은 길 (사장님 10/25 18:0x '같은 길 입혀' — config UNIQUE_ASSIST.schielPlayer · 지금은 곁눈 베기만): redraw 칸이 있으면 AI 와 같은 다시 그린 길 점 · 길 덧칸(plan — 아래 planStep)
  if (u.redraw && UA.schielPath && UA.schielPlayer) u = { ...u, ...u.redraw };
  if (u.feint) {
    const fk = TECH_BY_NAME[u.feint.fake];
    if (!fk) return null;
    const a = u.feint.at;
    const p0 = [fk.from[0] + (fk.path[0][0] - fk.from[0]) * a, fk.from[1] + (fk.path[0][1] - fk.from[1]) * a]; // 가짜 기술을 at 만큼 간 자리 (ai.js startStrike 와 같은 점)
    return { name: e.name, nameKo: e.nameKo ?? u.nameKo ?? u.feint.name, orig: e.orig ?? u.orig ?? null, kind: u.feint.open === 'C' ? 'thrust' : 'cut', pts: [p0, ...u.feint.then.map((p) => p.slice())], step: null };
  }
  if (!u.path?.length) return null; // 길 없는 것(맞받아치기 목록 등)은 플레이어 몫이 아니다
  const def = { name: e.name, nameKo: e.nameKo ?? u.nameKo ?? u.name, orig: e.orig ?? u.orig ?? null, kind: u.kind, pts: [u.from.slice(), ...u.path.map((p) => p.slice())], step: e.step ?? u.step ?? null }; // step = 표 칸이 있으면 그것(플레이어만 — 10/21 체보요격)
  if (u.plan) def.plan = u.plan; // [from, ...path] 점마다 [칼끝 들기 °, 손 뻗기 m, 손 돌리기 °] (10/25 18:0x)
  // 사람 제비 베기 올려 긋는 길 (사장님 10/25 21:1x 해법 ③ — config UNIQUE_ASSIST.tsuAim · 표의 aim 칸): 꺾는 자리(chain.at 점)까지는 그대로 · 그 뒤 점을 aim.path 로 · 덧칸 = 앞 몫 0 + aim.plan
  if (e.aim && UA.tsuAim && e.chain) {
    const at = Math.min(e.chain.at, def.pts.length - 1);
    const band = UA.tsuBand && e.aim.band ? (!UA.tsuHook && e.aim.line ? e.aim.line : e.aim.band) : null; // 몸통 띠 판(10/25 23:1x — tsuBand) · 곧은 길(10/31 — tsuHook 0 이면 line)
    const lead = (P) => [...Array.from({ length: at }, () => [0, 0, 0]), ...P.map((p) => p.slice())];
    const A = band ?? e.aim;
    def.pts = [...def.pts.slice(0, at + 1), ...A.path.map((p) => p.slice())];
    //  덧칸: 손가락 몫(planStep)은 21:1x 덧칸 그대로(길이 같을 때 — 끌고 간 칼이 끝난 뒤 손가락 긋기의 손목) · 끌고 가는 칼은 band 덧칸(snapPlan — 몸통 띠 · 굴림 묶음이 맡음)
    const finger = band?.finger ?? (band && band.path.length !== e.aim.path.length ? band.plan : e.aim.plan);
    if (finger) def.plan = lead(finger);
    if (band) {
      def.band = true;
      def.snapPlan = lead(band.plan);
      if (band.shift || band.pathHint || band.arcCut) def.snapOpt = { shift: band.shift ?? null, pathHint: !!band.pathHint, arcCut: !!band.arcCut }; // 곧은 길 (10/31): 띠 높이 옮김 꼴 · 날 쪽 = 길 위 칼끝 · 잔상은 베는 토막만
    }
  }
  return def;
}

// 해금은 이 파일 밖 — 플레이어에게 무엇이 열리는지는 스킬트리 하나(10/21 — skill_tree_store.js playerKit → 칸마다 기술 하나 · 아래 PlayerUniqueAssist 의 names).
//  강화동작 이점(곁눈 베기 무릎 꺾기 · 내려 찌르기 틈 · 돌려 베기 쌓기 · 허리 베기 출혈)은 기술 칸과 따로 심화 칸(skill_kit.js perkOff — combat.js · 아래 strokeHitK).
//  10/13 의 여정 인장(깬 수 → 인장 → 유파 숙련도 · 인장 이름 · 인장 알림)은 10/16 08:1x 사장님 '인장 제도 없애'로 지웠다. 깬 수는 통계로만 journey_save.js 에 남는다

/**
 * 탭으로 내는 특수 공격의 조건 (사장님 10/28 01:2x 결정 — 조건만 따로: 바꾸면 이 표 한 곳만 · 움직임 · 빠르기 · 잔상은 그대로). 표 칸 tapKey 가 이름.
 *  (uq, now) → null(이 탭은 아님 — 보통 탭 찌르기) | { spend() } (이 탭이 그 기술 — 내면 spend 로 그 기회를 씀). 이른 탭이 기회를 없애는 규칙도 여기 안에서.
 */
const TAP_TRIG = {
  // 칼끝 돌려 빼기 (10/31 사장님 '내 칼이 상대 칼과 닿았을 때 박자에 맞춰 찌르면 발동 … 베기에서의 닿음이나 막힘은 빼야' — 감독 '내 긋기 동안의 닿음은 뺌'):
  //  한 닿음(touchTick — 칼끼리 실제 닿음 feel.touching · 떨어졌다 새로 닿으면 새 닿음)의 처음부터 cavFrom 이 지나고 마지막 닿은 때부터 cavTo 안의 탭 ·
  //  cavFrom 전의 탭은 보통 탭이고 그 닿음의 기회를 없앰(연타로는 안 나감 — 10/28 '박자' 규칙 그대로) · 내 긋기 동안 닿은 닿음은 안 엶 · 한 닿음에 한 번 · 시계 = 이 강화 시계(uq.t)
  //  (10/28 ~ 10/30 판 조건 — 상처를 못 낸 막아찌르기 끝 · 그때 특수 공격 — 은 없앰: 기록 docs/strike/cavazione_2026-10-28.md)
  cav(uq) {
    const C = uq.touch;
    if (!C || C.cut || C.cavSpent) return null;
    if (uq.t - C.t0 < UA.cavFrom) return uq.windowed(C, 'cavSpent', uq.t - C.t0, UA.cavFrom, Infinity); // 이른 탭 — 기회를 없앰
    if (uq.t - C.t1 > UA.cavTo) return null;
    return { spend: () => (C.cavSpent = true), touch: C };
  },
  // 비껴서며 찌르기 (10/31 — 특수 공격 · 카드 글 '상대가 공격해 올 때 옆으로 움직이며(←/→) 탭'): 상대 칼이 들어오는 동안(막기 단추가 읽는 위협 — parry_button.js threatNow · 마지막 위협에서 inqThreat 안)
  //  스틱 옆(걸음 명령 'side' 와 같은 문턱)인 채의 탭 · 한 공격(위협 번호)에 한 번
  inq(uq) {
    const G = uq.f.parryGuard;
    if (!G || !(G.noThreat <= UA.inqThreat) || !uq.stickOk('side')) return null;
    if (uq.inqSeen === G.threatId) return null;
    return { spend: () => (uq.inqSeen = G.threatId) };
  },
  // 날개 접기 (10/28 01:2x): 물러남 = 스틱 뒤(뒤 몫 ≥ 0.5 · 옆 몫보다 큼 — 걸음 명령 stickOk 'fwd' 의 거울) — 물러나는 동안의 탭 · 스틱을 놓고(뒤가 풀리고) lianWindow 안의 탭 (상대 칼 닿음 없이 내 명령만)
  lian(uq, now) {
    if (uq.backNow() || (uq.backOff != null && now - uq.backOff <= UA.lianWindow)) return { spend: () => {} };
    return null;
  },
  // 겹치기 (10/28 01:2x 사장님 '지금대로'): 내 긋기(탭 · 찌르기 · 강화 탭 칼 빼고)가 상대 칼에 맞물렸고(track — 칼끼리 0.07 m 안) 지금도 닿아 있는(같은 거리 안) 동안의 탭 · 한 맞물림에 한 번
  dup(uq) {
    if (UA.dupAuto) return null; // 겹치기 자동 (사장님 10/31 18:xx 결정 — 기본 'bind' · dupAutoTick): 탭으로는 안 냄 (탭 = 보통 탭 찌르기) · `?dupAuto=0` 이면 아래 전 판 탭 조건
    const rec = uq.cur && !uq.repos(uq.cur) ? uq.cur : uq.prevAtk();
    if (UA.dupAny || UA.dupGrace > 0) {
      // 시제품 (10/31 — 기본 끔): 닿음 덩이(drive 의 dupC — 칼끼리 닿음이 시작된 때 · 끝난 때)로 · 끝난 뒤 dupGrace 초까지 · dupAny 면 내 베기 맞물림이 아니어도 · 한 닿음에 한 번
      const C = uq.dupC;
      if (!C || C.spent || (C.end != null && uq.t - C.end > (UA.dupGrace ?? 0))) return null;
      const bound = !!(rec && !rec.tap && rec.kind === 'cut' && rec.bound && !rec.dupSpent);
      if (!UA.dupAny && !bound) return null;
      return { spend: () => { C.spent = true; if (bound) rec.dupSpent = true; } };
    }
    if (!rec || rec.tap || rec.kind !== 'cut' || !rec.bound || rec.dupSpent || !uq.bladeTouch()) return null;
    return { spend: () => (rec.dupSpent = true) };
  },
};
const TAP_ON = { cav: 'cavTap', lian: 'lianTap', dup: 'dupTap', inq: 'inqTap' }; // 탭 조건마다 켜는 칸 (config UNIQUE_ASSIST)
/** 칼끝 돌려 빼기 칼끝 빠르기 (m/s — 10/31 '보통 찌르기 빠르기'): UNIQUE_ASSIST.cavSpeed 'tap' = 탭 찌르기가 칼 선을 따라 뻗는 몫 (THRUST.reach + THRUST.chamber) ÷ THRUST.extend · 숫자면 그것 */
export const cavTipSpeed = () => (typeof UA.cavSpeed === 'number' && UA.cavSpeed > 0 ? UA.cavSpeed : (THRUST.reach + THRUST.chamber) / THRUST.extend);

/**
 * 플레이어 한 명의 고유 동작 강화 (10/14 — 궤적은 손가락, 고유 동작은 손가락으로 못 하는 몫만). 붙이면(f.skill.uniq = this) 검술 층이 매 스텝
 *  drive(머리 — 강화 몫 갱신: 몸 덧씌우기 · 끝 힘 · 걸음 다시 부탁) · detect(휘두르기 판단 뒤 — 긋기 읽기·발동·잇는 동작 읽기)를 부른다.
 *  main.js 는 프레임마다 feed(손가락 움직임)를 부르고, 손가락 움직임은 늘 손 목표에 그대로 더한다(손 목표를 쥐지 않는다 — holdsHand 거짓).
 *  열린 동작이 없으면(단계 0 · 표에 없는 유파 · 스위치 끔) 붙지 않는다 → 검술 층은 전과 같다
 */
export class PlayerUniqueAssist {
  constructor(f, { stage = 0, names = null, tradition = f.swordArt?.tradition } = {}) {
    this.f = f;
    this.stage = stage;
    this.names = names; // 스킬트리(10/21): 열린 고유 공격 이름 모음(칸 하나 = 기술 하나 — main.js · skill_tree_data.js kitFromNodes) · 없으면 단계(stage — 시험 · 도구)로 거른다
    this.tradition = tradition;
    // 무기 비검 (10/21 — weapons.js secretBlade): open 이면 그 기술은 책(단계)과 상관없이 열리고, prev 가 있으면 앞 칼 조건을 그 칼들로 넓힌다(진 · 츠바메가에시)
    const SB = f.weapon?.secretBlade;
    const sbOn = (e) => SB?.open && SB.tech === e.name;
    const widen0 = (e) => (sbOn(e) && SB.prev && e.on?.length ? { ...e, on: [...e.on, ...SB.prev.filter((p) => !e.on.some((c) => c.prev === p)).map((p) => ({ ...e.on[0], prev: p }))] } : e);
    // 진 · 츠바메가에시(무기 비검 kin — 모노호시자오)는 그 되돌림 칼 그대로 (10/25 제비 베기 세 해법의 길 · 끌고 감은 보통 제비 베기만)
    const widen = (e) => { const w = widen0(e); return SB?.kin && SB.tech === e.name && w.aim ? { ...w, aim: null, snap: 0 } : w; };
    const opened = (e) => (names ? names.has(e.name) : e.stage <= stage) || sbOn(e);
    this.list = UA.on && !f.weapon?.gun ? (PLAYER_UNIQUE[tradition] ?? []).filter(opened).map(widen).map((e) => ({ ...e, U: uniqueDef(tradition, e) })).filter((e) => e.U) : [];
    this.r = null; // 강화 중인 긋기 { e, U, part(1 앞 긋기 | 2 잇는 뒷몫), t, travel, len, stepAsked, chainable }
    this.t = 0;
    this.cur = null; // 지금 긋기 { tech, kind, pad, t0, dir, landed, bound, tEnd, unique }
    this.last = null; // 바로 앞 긋기 (끝난 것 — 결과는 다음 긋기가 시작될 때까지 계속 적는다)
    this.atk = null; // 바로 앞 공격 (자세로 돌아가는 손을 건너뛴 긋기 · 탭 — 칼끝 돌려 빼기 탭 조건 prevAtk · 10/28)
    this.chainFrom = null; // 뒷몫을 이을 수 있는 앞 긋기 { e, U, tEnd } — 플레이어가 박자 창(chainWait) 안에 이어 그으면 그 긋기가 뒷몫
    this.ready = null; // 이어 긋기 창이 열린 동작 { name, nameKo } (10/21 — 자세 칸 표시)
    this.tapRec = null; // 진행 중인 탭 찌르기 (끝나면 last 로)
    this.wasSwing = false;
    this.quietT = 1;
    this.restPos = [f.handOffset.x, f.handOffset.y];
    this.blocked = false; // main.js: 막기 버튼·미리 받기가 손을 쥐는 중
    this.handHeld = false; // main.js: 손이 정말 쥐여 있나 (막기가 손을 쥠 · 미리 받기 — 막기 단추를 쥐었어도 탭 · 휘두르기로 놓아 준 때는 거짓) · 칼끝 돌려 빼기 탭만 봄 (10/30 — UNIQUE_ASSIST.cavHeld)
    this.painFoe = null;
    this.fv = new THREE.Vector2(); // 손가락 속도 (고른 값, 패드 m/s)
    this.fSpeed = 0;
    this.fIdle = 0;
    this.body = [0, 0, 0, 0]; // 지금 얹은 몸 [골반 돌림 rad, 가슴 돌림 rad, 숙임 rad, 낮춤 m] (덧씌우기 칸 몸 값과 같은 부호 — fighter.js updateBodyPose)
    this.powV = 0; // 내가 둔 끝 힘 배율 (f.powerMul 이 아직 이 값일 때만 되돌린다)
    this.planFade = null; // 길 덧칸 놓기 { tilt, reach, turn, t } (planStep — 10/25 18:0x)
    this.stats = { strokes: 0, techs: {}, fired: {}, ends: {}, steps: 0, power: 0 };
    this.holdE = this.list.find((e) => e.hold) ?? null; // 길게 눌러 내는 특수 공격 (풍차 베기 B4 — 10/29)
    this.dupE = this.list.find((e) => e.tapKey === 'dup') ?? null; // 겹치기 (자동 판 dupAutoTick — 10/31 16:xx 시제품)
    this.dupA = null; // 겹치기 자동 셈 { st 쌓임 · off 끊긴 시간 · since 쌓기 시작 · on 닿는 중 · t0 · prev 닿음 시작 · tEnd 떨어진 때 · pair 짝이 찬 닿음 }
    this.dupCue = null; // 자세 칸 알림 { name, nameKo, sub } (쌓임 절반부터 — main.js updateGuardName)
    // 탭으로 내는 동작 (tapChain): 특수 공격이 먼저 (10/31 이탈리아 — 비껴서며 찌르기 조건과 칼끝 돌려 빼기 닿음 조건이 함께 차면 스틱 옆을 민 비껴서며 찌르기 · 식는 동안은 칼끝 돌려 빼기)
    this.tapList = this.list.filter((e) => e.tapKey).sort((a, b) => (b.special ? 1 : 0) - (a.special ? 1 : 0));
    this.touch = null; // 칼끼리 한 닿음 (칼끝 돌려 빼기 탭 조건 — touchTick · 10/31): { t0 처음 · t1 마지막 닿은 때 · cut 내 긋기 동안 닿음 · n 상대 칼 쪽(월드 — feel.normal 의 반대) · cavSpent }
    this.inqSeen = -1; // 비껴서며 찌르기를 낸 위협 번호 (한 공격에 한 번)
    this.press = { down: false, still: false, secretOpen: false }; // main.js holdInput — 탭 입력을 누르고 있나 · 탭 문턱(끌지 않음) 안인가 · 비기 창이 열렸나
    this.hold = { st: 'idle', t: 0 }; // 누름 셈 · 감기 ('idle' · 'press' · 'spent' 이 누름은 감지 않음 · 'wind' 감는 중)
    this.coolT = {}; // 특수 공격(표 칸 special)마다 식힘을 세기 시작한 때 (사장님 10/28 02:0x 나간 순간 → 10/29 19:5x 끝난 때 — UNIQUE_ASSIST.specialCooldown · specialCoolFrom · 도는 동안 Infinity)
    this.coolRun = {}; // 나갔는데 아직 안 끝난 특수 공격 { t0 나간 때, motion 동작 끝 } (coolTick)
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
  feed(dx, dy, dt, blocked = false, handHeld = blocked) {
    this.blocked = blocked;
    this.handHeld = handHeld;
    if (!(dt > 0)) return;
    const k = 1 - Math.exp(-dt / UA.fingerTau);
    this.fv.x += (dx / dt - this.fv.x) * k;
    this.fv.y += (dy / dt - this.fv.y) * k;
    this.fSpeed = this.fv.length();
    this.fIdle = Math.abs(dx) + Math.abs(dy) > 1e-5 ? 0 : this.fIdle + dt;
  }

  /** 발동하지 않는 때: 다른 플레이어 동작이 돌거나 칼을 못 쓰는 때 · held 참이면 막기 단추를 쥔 것은 보지 않고 손이 정말 쥐였나(handHeld)만 (칼끝 돌려 빼기 탭 — 10/30 UNIQUE_ASSIST.cavHeld) · 'any' 면 막기 단추를 아예 안 봄 (겹치기 자동 dupAutoParry 1 — 10/31) */
  busy(held = false) {
    const f = this.f;
    const sk = f.skill;
    return (held === 'any' ? false : held ? this.handHeld : this.blocked) || !UA.on || !!sk.sec || !!sk.tap || !!sk.pom || !!sk.vitalRange || !f.alive || !f.armed || f.weaponBroken || f.state !== 'stand' || !f.foe || f.finish?.amt > 0.5;
  }

  /** 긋기 결과 적기: 맞힘(상대 아픔 +0.05 — 비기와 같은 눈) · 칼 맞물림(ai.js checkBind 와 같은 기하 0.07 m). 탭 찌르기도 한 긋기로 센다 */
  track() {
    const f = this.f;
    const sk = f.skill;
    if (sk.tap && !this.tapRec) this.tapRec = { tech: 'tap', kind: 'thrust', tap: true, t0: this.t, dir: [0, 0], landed: false, bound: false, tEnd: null };
    if (!sk.tap && this.tapRec) {
      this.tapRec.tEnd = this.t;
      this.last = this.tapRec;
      this.atk = this.tapRec;
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
    if (!this.repos(this.cur)) this.atk = this.cur; // 앞 공격 (자세로 돌아가는 손은 건너뜀 — prevAtk)
    this.last = this.cur;
    this.cur = null;
    if (this.r) this.end('done', tEnd);
  }

  /** 시작 자리·처음 방향 → 기본 동작 (시작 패드가 그 동작의 from 이고 첫 방향이 허용 각 안). { pad, tech, kind } */
  classify(start, dir) { return classifyStroke(start, dir); }

  /** 자세로 돌아가는 손: 어느 기본 동작으로도 안 읽히고 고유 동작도 아니며 아무것도 안 맞히고 칼에도 안 닿은 긋기 (칼끝 돌려 빼기 탭 조건이 건너뜀 — 10/28) */
  repos(rec) {
    return !!rec && !rec.tap && !rec.tech && !rec.unique && !rec.landed && !rec.bound;
  }
  /** 탭 조건(tapOn)이 보는 앞 공격: 바로 앞 긋기 · 탭 — 그것이 자세로 돌아가는 손이면 그 앞 공격 (10/28 — 맞물린 찌르는 긋기 뒤 손을 거두는 동안) */
  prevAtk() {
    const L = this.last;
    return this.repos(L) && this.atk && this.atk !== L ? this.atk : L;
  }

  condOk(c, cur, dir, now) {
    // down (10/31 이탈리아 위에서 내려 찌르기 — UNIQUE_ASSIST.imbroDown): 아래로 가는 긋기 — 손가락 첫 방향이 곧장 아래에서 imbroDown° 안(수평 띠 밖) · tech 가 없으면 베기 꼴(찌르는 긋기 · 탭은 아님)만 · 0 = 끔
    if (c.down) {
      if (!(UA.imbroDown > 0) || angDeg(dir, [0, -1]) > UA.imbroDown) return false;
      if (!c.tech && cur.kind !== 'cut') return false;
    }
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
      if (this.cooling(e, now)) continue; // 특수 공격 식힘 중: 그 조건은 없는 것으로 — 같은 긋기는 보통 긋기 (10/28 02:0x)
      if (!e.on.some((c) => this.condOk(c, cur, dir, now))) continue;
      if (e.stick && !this.stickOk(e.stick)) continue; // 걸음 명령: 긋기 시작 때 스틱이 그 쪽이 아니면 기본 동작 그대로
      const after = e.on.some((c) => c.prev);
      // 10/21 강화동작 · 명령: 기본 동작 · 스틱 · 앞 동작 조건만 본다(길과의 거리 join 은 보지 않음 — 칼 길은 늘 손가락)
      const j = after || e.role ? { o: 0 } : this.join(e.U.pts, hand, dir, Infinity, e.anchor === 'start' ? cur.start : null);
      if (!j) continue;
      const rank = e.role === 'step' ? -1 : after ? 0 : 1; // 명령(걸음) > 이어 긋기 > 강화동작
      if (!best || rank < best.rank || (rank === best.rank && j.o < best.j.o - 1e-6)) best = { e, j, rank };
    }
    return best;
  }

  /**
   * 탭으로 내는 특수 공격 (칼끝 돌려 빼기 · 날개 접기 · 겹치기 — 사장님 10/28 01:2x · config UNIQUE_ASSIST.cavTap · lianTap · dupTap): 사람의 탭 입력마다(skill.js thrust 첫머리 — 다른 탭이 도는 중이라 버려지는 탭까지) 부른다.
   *  열린 동작 가운데 표 칸 tapKey 가 있는 것의 조건(TAP_TRIG — 이른 탭이 기회를 없애는 규칙 포함)이 차면 그 기술 — 몸이 바쁘면(다른 탭 · 비기 · 막기 단추 등) 그 탭은 버려짐 ·
   *  특수 공격 식힘 중(special — 10/28 02:0x)이면 조건을 보지 않음 · 나가면 그 순간 식힘 시작.
   *  냄: tapSnap 이면 운동학 찌름(secret_instant.js requestArtThrust — cavSnap) · tapFold 면 날개 접기(requestArtFold) · tapDup 이면 겹치기(requestArtDup) · 아니면 탭 찌르기 덧씌우기에 이름만. 냈으면 true (보통 탭 찌르기는 없음)
   */
  tapChain() {
    const now = this.t;
    for (const e of this.tapList) {
      const cav = e.tapKey === 'cav';
      const thrustTap = cav || e.tapKey === 'inq'; // 찌르는 탭 칼 (칼끝 돌려 빼기 · 비껴서며 찌르기 — 기력 · 앞 칼 기록 꼴)
      if (!UA[TAP_ON[e.tapKey]] || this.cooling(e, now)) continue; // 식힘 중: 조건을 보지 않음(이른 탭 규칙도) — 이 탭은 보통 탭 찌르기 (10/28 02:0x)
      const ok = TAP_TRIG[e.tapKey]?.(this, now);
      if (!ok) continue;
      const f = this.f;
      // 지금은 못 냄 (다른 탭 · 비기가 도는 중 등 — 그 탭은 버려짐). 칼끝 돌려 빼기는 막기 단추를 쥔 채 친 탭도 받음(10/30 cavHeld — 막기 단추로 낸 막아찌르기 다음 칼이라 쥔 채 치는 게 자연스러움 ·
      //  전 판은 막기 단추를 쥐고 있으면 늘 버려져 '한 번도 안 나감' — 사장님 10/30 00:4x 보고) · 날개 접기 · 겹치기도 같게 (10/30 08:2x 사장님 '날개접기랑 겹치기도 같게해' — UNIQUE_ASSIST.tapHeld)
      if (this.busy(!!(cav ? UA.cavHeld : UA.tapHeld)) || f.foe?.state !== 'stand' || f.stamina.exhausted) return false;
      ok.spend();
      return this.launchTap(e, now, false, ok);
    }
    return false;
  }

  /**
   * 탭 특수 공격을 냄 (tapChain 이 조건을 받아들인 뒤 · 겹치기 자동 dupAutoTick — 10/31): 식힘 시작 · 긋던 것 끝 · 앞 칼 기록 · 알림 · 탭 하나 기력 · 운동학 칼(없으면 탭 찌르기 덧씌우기에 이름만).
   *  auto = 탭 없이 저절로 나감(겹치기 자동 — 재기 stats.autoFired · 탭 찌르기로 바꾸지 않음) · ok = 탭 조건이 돌려준 것(칼끝 돌려 빼기 닿음 ok.touch — 비킨 쪽). 냈으면 true
   */
  launchTap(e, now = this.t, auto = false, ok = null) {
    const f = this.f;
    const cav = e.tapKey === 'cav';
    const thrustTap = cav || e.tapKey === 'inq'; // 찌르는 탭 칼 (칼끝 돌려 빼기 · 비껴서며 찌르기 — 기력 · 앞 칼 기록 꼴)
    this.coolStart(e);
    const U = e.U;
    if (auto) this.stats.autoFired = (this.stats.autoFired ?? 0) + 1;
    if (this.cur) this.closeStroke(now); // 긋던 것은 여기서 끝 (이 탭이 다음 칼)
    const rec = { tech: 'tap', kind: thrustTap ? 'thrust' : 'cut', tap: true, t0: now, dir: [0, 0], start: null, landed: false, bound: false, tEnd: null, unique: U.name };
    this.tapRec = rec; // 앞 칼 기록 (운동학 칼이면 track 이 다음 스텝에 끝냄 — 맞힘 · 맞물림은 그 뒤 last 로 이어 적음 · 이 기록은 다음 기회를 열지 않음)
    this.stats.fired[U.name] = (this.stats.fired[U.name] ?? 0) + 1;
    this.stats.tapFired = (this.stats.tapFired ?? 0) + 1;
    f.uniqueCue = { text: U.nameKo, kind: 'unique', who: 'me', schoolKo: TRADITIONS[this.tradition]?.nameKo ?? '', name: U.name, t: this.t };
    f.stamina.attack(thrustTap ? 'thrust' : 'cut'); // 탭 하나 (끌고 가는 칼은 같은 공격 — same) · 찌르기 10 · 베기 12
    // 칼끝 돌려 빼기 (10/31 — 기본 고유 공격): 같은 돌려 빼기 길 · 보통 찌르기 빠르기(cavTipSpeed) · 잔상 없음 · 비킨 쪽은 닿았을 때 상대 칼 쪽(cavSide 'contact')
    // 칼끝 돌려 빼기 심화 · 헛누름 (I8 — 사장님 10/31 '1로 해. … 1초로 해.' → '1.2초로 할게'): 돌려 빼는 순간(맞힘과 상관없이) 누르거나 닿아 있던 상대 칼이 허공으로 — 상대 두 팔 늦춤 cavArmSlow (흘림 장치)
    if (cav && UA.cavArmSlow > 0 && !perkOff(f, 'cavazione') && f.foe && beginFlowRecovery(f.foe, f, UA.cavArmSlow)) this.stats.armSlow = (this.stats.armSlow ?? 0) + 1;
    if (e.tapSnap && UA.cavSnap && UA.enhance > 0) {
      const side = UA.cavSide === 'contact' ? ok?.touch?.n ?? null : null;
      const tapT = UA.cavSpeed === 'tap'; // 탭 찌르기 박자 — 길 끝(거둠)까지 시간 상한 없음: 상한에서 끊으면 뻗은 칼이 상대 몸 · 칼 안에 든 채 충돌이 돌아와 내 몸이 튕겨 넘어졌음(싸움 판 넘어짐 8 / 9 판 — 낸 뒤 0.25 ~ 0.35 s)
      // 세게 하는 시제품 (10/31 16:xx 사장님 물음 — config UNIQUE_ASSIST cavSpeedMul · cavHitMul · cavParryLock · cavCancel · combat.js cavGap · 기본 모두 끔): A 빠르기 배 · D 판정 배율
      const vMul = UA.cavSpeedMul > 0 ? UA.cavSpeedMul : 1;
      if (requestArtThrust(f, { v: cavTipSpeed() * vMul, trail: false, maxT: tapT ? 0 : UA.cavSnapTime, tech: U.name, under: true, capFromCut: !tapT && !!UA.cavCapCut, side, tapTiming: tapT, selfFree: UA.cavSelfFree, hitMul: UA.cavHitMul > 0 ? UA.cavHitMul : 1 })) {
        this.stats.snap = (this.stats.snap ?? 0) + 1;
        // C 상대 반응 묶음: 누르던 칼이 빠져 이 실제 초 동안 막기 · 피하기 · 맞받아치기를 새로 시작하지 못함 (ai.js respond — I8 헛누름의 팔 늦춤과 따로)
        if (UA.cavParryLock > 0 && f.foe) f.foe.parryLockUntil = (f.foe.fightT ?? 0) + UA.cavParryLock;
        this.cavFire = { threat: f.parryGuard?.threatId ?? null, held: !!f.parryGuard?.held }; // E 거둠 판단의 기준 (낸 때 위협 번호 · 막기 단추)
        return true;
      }
    }
    // 비껴서며 찌르기 (10/31 — 특수 공격): 스틱 쪽으로 몸을 빼며(옆 · 앞 = schools.js inquartata step · 뒷발을 그쪽으로 돌려 디딤) 넷째 자세로 가슴 — 고노센 칼끝 × specialShare.inquartata · 잔상
    if (e.tapVoid && UA.enhance > 0) {
      const st = U.step ?? { lat: 0.3, fwd: 0.15 };
      const sg = Math.sign(f.stickX ?? 0) || 1;
      const B = e.body ? [Math.abs(e.body[0]) * sg * (e.bodyMirror ?? 1), Math.abs(e.body[1]) * sg * (e.bodyMirror ?? 1), e.body[2], e.body[3]] : null;
      if (requestArtThrust(f, { share: specialShare(e.name), maxT: UA.inqSnapTime, tech: U.name, under: false, capFromCut: true, voidStep: { lat: Math.abs(st.lat) * sg, fwd: st.fwd ?? 0 }, bodyPose: B })) {
        this.stats.snap = (this.stats.snap ?? 0) + 1;
        return true;
      }
    }
    // 날개 접기 (사장님 10/28 00:3x): 오른 허리 옆으로 거뒀다 앞으로 반걸음 들며 허리를 오른 → 왼 가로 호로 — 고노센 칼끝 × specialShare.lianchi (10/29 02:0x)
    if (e.tapFold && UA.enhance > 0) {
      if (requestArtFold(f, { share: specialShare(e.name), maxT: UA.lianSnapTime, tech: U.name, step: { kind: 'lunge', fwd: UA.lianStep ?? SECRET.chineseStep } })) { // 앞 걸음 = 날개 접기만의 lianStep 0.45 (10/29 14:3x)
        this.stats.snap = (this.stats.snap ?? 0) + 1;
        return true;
      }
    }
    // 겹치기 (10/28): 맞물린 자리에서 상대 칼 뒤로 밀어 넣어 엇갈린 손으로 얼굴을 사선으로 — 고노센 칼끝 × specialShare.duplieren (10/29 02:0x)
    //  10/31 19:xx 사장님 '가장 효율적이고 단순한 움직임 … 박차기를 앞으로 쓰면서 치는 효과': 길 = 맞닿은 자리 축 한 번 돌림(dupOld 0) · 앞 박차기 dupBurst m(겹치기와 함께만 — 죽음의 일격 거리에서 멈춤 · 기력 pushCost — dupBurstFree 면 안 냄)
    if (e.tapDup && UA.enhance > 0) {
      const old = !!UA.dupOld;
      if (requestArtDup(f, { share: specialShare(e.name), maxT: UA.dupSnapTime, tech: U.name, face: UA.dupFace, follow: UA.dupFollow, plan: UA.dupPlan, body: UA.dupBody, edge: UA.dupEdge, step: UA.dupStep > 0 ? { kind: 'lunge', fwd: UA.dupStep } : null, old, burst: !old && UA.dupBurst > 0 ? { fwd: UA.dupBurst, free: !!UA.dupBurstFree, sync: UA.dupBurstSync ?? 1, T: UA.dupBurstT ?? 0, lag: UA.dupStrikeLag ?? 0 } : null })) {
        this.stats.snap = (this.stats.snap ?? 0) + 1;
        return true;
      }
    }
    if (auto) return false; // 저절로 낸 칼은 탭 찌르기로 바꾸지 않음 (dupAutoTick 이 운동학 칼이 나갈 수 있을 때만 부름)
    // 운동학 칼이 없으면(끔 · 이미 끌고 가는 중) 탭 찌르기 덧씌우기에 이름만
    if (f.skill.thrust({ uniq: false, charged: true })) {
      if (f.skill.tap) f.skill.tap.uniqTech = U.name; // (걸어 맞추기 판 vitalRange 면 탭이 아직 없음)
      return true;
    }
    this.tapRec = null;
    return false;
  }

  /**
   * 특수 공격 식힘 중인가 (사장님 10/28 02:0x 6 s · 나간 순간부터 → 10/29 19:5x '특수공격 3초(발동이 완료된 시점부터 카운트, 경직시간을 포함할지 말지는 너가 판단)' —
   *  UNIQUE_ASSIST.specialCooldown · specialCoolFrom · 표 칸 special 다섯 · 기술마다 따로): 나간 뒤 그 동작이 끝날 때까지(coolT = Infinity — coolTick) + 끝난 때부터 specialCooldown.
   *  끝난 때 = specialCoolFrom 'free'(몸이 다시 자유로울 때 — 운동학 칼 · 탭 찌르기 · 강화 긋기가 끝나고 끝 자세 풀기(iaiFade) · 굳음(iaiHoldT)까지 · 감독 권고) ·
   *  'motion'(동작이 끝난 때 — 풀기 · 굳음 빼고) · 'fire'(나간 순간 — 10/28 판)
   */
  cooling(e, now = this.t) {
    const t0 = e.special ? this.coolT[e.name] : null;
    return t0 != null && UA.specialCooldown > 0 && now - t0 < UA.specialCooldown;
  }

  /** 특수 공격이 나감 — 그 기술 식힘 시작 (조건이 받아들여진 순간 · 'fire' 가 아니면 끝날 때까지 식힘 중 — coolTick 이 끝난 때를 적음) */
  coolStart(e) {
    if (!e.special) return;
    if (UA.specialCoolFrom === 'fire') {
      this.coolT[e.name] = this.t;
      return;
    }
    this.coolT[e.name] = Infinity;
    this.coolRun[e.name] = { t0: this.t, motion: null };
  }

  /**
   * 나간 특수 공격이 끝났나 (drive 스텝마다 — 10/29 19:5x): 동작 = 끌고 가는 운동학 칼(f.iai · iaiReq) · 그 이름의 탭 찌르기 · 그 기술의 강화 긋기(this.r — 제비 베기) ·
   *  풀기 · 굳음 = 끝 자세 붙잡기(iaiHoldT) · 손가락으로 돌려주는 0.2 s(iaiFade). 끝나면 coolT = 끝난 때 (재기: stats.coolRuns — 나간 때부터 동작 끝 · 몸 자유 s)
   */
  coolTick() {
    const f = this.f;
    for (const name in this.coolRun) {
      const R = this.coolRun[name];
      const moving = !!f.iai || !!f.iaiReq || f.skill.tap?.uniqTech === name || this.r?.e?.name === name;
      if (R.motion == null) {
        if (moving) continue;
        R.motion = this.t;
        if (UA.specialCoolFrom === 'motion') this.coolT[name] = R.motion;
      }
      if (moving || f.iaiHoldT > 0 || f.iaiFade > 0) continue;
      if (UA.specialCoolFrom !== 'motion') this.coolT[name] = this.t;
      (this.stats.coolRuns ??= []).push({ name, motion: R.motion - R.t0, free: this.t - R.t0 });
      delete this.coolRun[name];
    }
  }

  /** 식힘 남은 초 (0 = 다 식음 — 읽기만 · 재는 도구 · 앞으로 화면) */
  coolLeft(name, now = this.t) {
    const e = this.list.find((x) => x.name === name);
    const t0 = e?.special ? this.coolT[name] : null;
    return t0 == null ? 0 : Math.max(0, UA.specialCooldown - (now - t0));
  }

  /**
   * 탭 입력 누름 (main.js 프레임마다 · 재는 도구): down = 탭 손가락(PC 왼 단추)이 닿아 있나 · still = 그 누름이 탭 문턱(input.js tapPx · clickPx — 끌지 않음) 안인가 ·
   *  secretOpen = 비기 창이 열렸나(싱지르 무장 — 열린 동안 길게 눌러도 감지 않음: 비기가 먼저)
   */
  holdInput(down, still, secretOpen = false) {
    this.press.down = !!down;
    this.press.still = !!still;
    this.press.secretOpen = !!secretOpen;
  }
  /** 감는 중인가 (main.js — 그동안 손가락 움직임은 손 목표에 안 더함) */
  get winding() {
    return this.hold.st === 'wind';
  }

  /**
   * 풍차 베기 (B4 레돈두 — 사장님 10/29 · config UNIQUE_ASSIST.rdHold): 물리 스텝마다 (drive 머리).
   *  ① 누름: 끌지 않은 누름이 rdHoldTime 을 넘기면 감기 시작 — 그 순간 식힘 중 · 비기 창 · 몸이 바쁨 · 탈진이면 이 누름은 감지 않음(뗄 때까지) · 끌면 이 누름은 보통 긋기.
   *  ② 감는 중: 떼면 내려침 · 기력 rdDrain 초당 · 기력이 바닥(0)이면 저절로 내려침 · 맞음(칼날 상처 · 넘어짐 · 칼을 세게 맞음) · 막기 단추 · 비기 · 탈진 · 칼을 잃음이면 그만둠(식힘 없음) · 감는 칼이 닿기만 하면 그대로 감음.
   *  흐르는 긋기 (IB_FLOW.windmillChain — 사장님 10/29 01:5x '한 바퀴 이상 돌렸을 때 한 번만' · 08:3x 'simple'): 머리 위로 한 바퀴 넘게 돌린 뒤 낸 내려침은 이어 그은 칼 하나로 셈(windFire)
   */
  holdTick(dt) {
    const f = this.f;
    const H = this.hold;
    const P = this.press;
    if (H.ropes) this.ropesBack(); // 감기에 뗀 밧줄 다시 (10/29 20:0x — 아래 ropesBack)
    if (H.fade > 0 && !f.iai && !f.iaiReq && !(f.iaiHoldT > 0) && !(f.iaiFade > 0)) {
      // 그만둔 감기의 덧씌우기 칸을 0.12 s 에 내려놓음 (탭 찌르기 · 길목 한 칼 내려놓기와 같은 빠르기)
      H.fade = Math.max(0, H.fade - dt);
      const th = f.skill.thrustPose;
      th.w = Math.min(th.w, H.fade / 0.12);
    }
    if (H.st === 'wind') {
      const why = this.windStop();
      if (why) return this.windCancel(why);
      if (!P.down) return this.windFire('release');
      const S = f.stamina;
      S.spent.wind ??= 0;
      S.spend('wind', UA.rdDrain * dt); // 회복도 멈춤 (spend — 쉼 시계 0)
      if (STAMINA.on && !S.infinite && S.value <= 0) return this.windFire('empty');
      const hit = windStep(f, dt);
      if (hit) this.stats.windTouch = (this.stats.windTouch ?? 0) + 1; // 감는 칼이 무엇에 닿은 스텝 (재기만 — 닿아도 그대로 감음 · 세게 맞으면 windStop 의 jolt · 상처면 hit)
      return;
    }
    if (!P.down) {
      H.st = 'idle';
      H.t = 0;
      return;
    }
    if (H.st === 'spent') return;
    if (!P.still) {
      H.st = 'spent'; // 끈 누름 = 긋기
      return;
    }
    if (H.st === 'idle') {
      H.st = 'press';
      H.t = 0;
      // 이어 긋기 창 안에서 누르기 시작했나 (흐르는 긋기 windmillChain 'inside' 견줌 판만 읽음 — 마지막 진짜 긋기가 끝나고 afterWindow 안 · 누르고 도는 동안은 창이 닫히지 않는 것으로 셈)
      H.chainN = f.ibFlowChainNow?.() ?? -1;
    }
    H.t += dt;
    if (H.t < UA.rdHoldTime) return;
    const e = this.holdE;
    if (!UA.rdHold || this.cooling(e) || P.secretOpen || this.busy() || iaiBusy(f) || f.stamina.exhausted || !f.sword) {
      H.st = 'spent';
      this.stats.holdRefused = (this.stats.holdRefused ?? 0) + 1;
      return;
    }
    this.windBegin();
  }

  /** 감기에 뗀 손목 원뿔 · 칼 어깨 면 밧줄 (10/29 20:0x 휘청 고침 — iberian_redondo.js windStart): 내려침 운동학 칼이 끝나고 · 그만둔 팔의 덧씌우기 칸을 다 내려놓은 뒤 다시 건다 */
  ropesBack() {
    const f = this.f;
    const H = this.hold;
    if (H.st === 'wind' || f.iai || f.iaiReq || H.fade > 0) return;
    windRopesBack(f, H.ropes);
    H.ropes = null;
  }

  windBegin() {
    const f = this.f;
    const H = this.hold;
    H.st = 'wind';
    H.wounds0 = f.wounds?.length ?? 0;
    H.fade = 0;
    H.windT = 0;
    if (this.cur) this.closeStroke(this.t);
    if (H.ropes) {
      windRopesBack(f, H.ropes); // 앞 감기에 뗀 밧줄이 아직이면 먼저 되걸고 (windStart 가 지금 있는 것을 적어 다시 뗌)
      H.ropes = null;
    }
    windStart(f);
    this.stats.winds = (this.stats.winds ?? 0) + 1;
  }

  /** 감기를 그만둘 까닭 (없으면 null) */
  windStop() {
    const f = this.f;
    const sk = f.skill;
    if (!f.alive || !f.armed || f.weaponBroken || !f.sword) return 'armed';
    if (f.state !== 'stand') return 'down';
    if ((f.wounds?.length ?? 0) > (this.hold.wounds0 ?? 0)) return 'hit';
    if (this.blocked || f.parryGuard?.held) return 'parry';
    if (sk.sec || f.ibSpin) return 'secret';
    if (f.stamina.exhausted) return 'exhausted';
    if (f.jolt > 0.5) return 'jolt'; // 칼을 세게 맞음 (맞아 흔들림 = 끊김 — 막기 연환 secret.js 와 같은 문턱)
    if (sk.tap || sk.pom || f.iai || f.iaiReq || !f.foe) return 'busy';
    if (!UA.rdHold || !UA.on) return 'off';
    return null;
  }

  /** 감기 그만둠 (식힘 없음 · 흐름 셈 없음) — 팔 · 칼은 서보로 (덧씌우기 칸 0.12 s 에 내려놓음) */
  windCancel(why) {
    this.hold.ropes = windEnd(this.f, true) ?? this.hold.ropes; // 뗀 밧줄은 덧씌우기 칸을 다 내려놓은 뒤 (holdTick)
    if (!this.f.alive || !this.f.armed) {
      windRopesBack(this.f, this.hold.ropes); // 죽음 · 칼 잃음: 곧장 (몸이 서보로 돌아오지 않음 — 어깨 면 밧줄만 · 칼이 없으면 손목 원뿔은 안 검)
      this.hold.ropes = null;
    }
    this.hold.st = this.press.down ? 'spent' : 'idle';
    this.hold.fade = 0.12;
    this.stats.windCancel ??= {};
    this.stats.windCancel[why] = (this.stats.windCancel[why] ?? 0) + 1;
  }

  /** 내려침 (떼었거나 기력이 바닥) — 운동학 칼 · 기술 알림 · 칼 하나 기력 · 식힘 시작 · 흐르는 긋기 셈 */
  windFire(why) {
    const f = this.f;
    const e = this.holdE;
    const W = f.rdWind;
    const turns = W?.turns ?? 0;
    this.hold.ropes = windEnd(f, true) ?? this.hold.ropes; // 뗀 밧줄은 내려침 운동학 칼이 끝난 뒤 (holdTick — 머리 위 → 왼 어깨 길도 어깨 면 한도 밖을 지남)
    this.hold.st = this.press.down ? 'spent' : 'idle'; // 기력이 바닥나 낸 칼: 손가락을 뗄 때까지 다시 감지 않음
    this.hold.fade = 0.12;
    const U = e.U;
    // 흐르는 긋기 (IB_FLOW.windmillChain — 사장님 10/29 01:5x '한 바퀴 이상 돌렸을 때 한 번만' · 08:3x 'simple' 결정 · 확인표 2737): 한 바퀴 넘게 돌린 뒤 낸 칼 = 이어 그은 칼 하나 (더 돌려도 하나) ·
    //  'simple' = 늘 첫 수(n 1 — × 1.2 · 앞 사슬과 상관없이 · 새 사슬의 1 번째 칼 — 세 칼 셈) · 'inside'(견줌) = 이어 긋기 창 안에서 누르기 시작했으면 그 사슬의 다음 수(n + 1) · 아니면 n 1 ·
    //  사슬은 이 칼 뒤로 이어짐(다음 긋기 n + 1). 흐르는 긋기(B5)가 없으면 없음 · 한 바퀴 못 돌았으면 없음(앞 사슬도 이 칼로 잇지 않음)
    const mode = IB_FLOW.windmillChain;
    const chain = !!mode && IB_FLOW.a && turns >= 1 && f.swordArt?.tradition === 'iberian' && !kitOff(f, 'ibFlow');
    const n = !chain ? 0 : mode === 'inside' && this.hold.chainN >= 0 ? this.hold.chainN + 1 : 1;
    f.ibStrike = chain ? { n, t0: this.t, newChain: !(mode === 'inside' && this.hold.chainN >= 0) } : null; // fighter.js updateIbFlow 가 칼이 끄는 동안 흐름을 켬 · newChain = 이 칼이 새 사슬의 첫 칼(세 칼 셈 — 10/29 14:2x)
    const ok = UA.enhance > 0 && requestArtRedondo(f, { share: specialShare(e.name), maxT: UA.rdSnapTime, tech: U.name, arc: UA.rdArc, loop: windLoopOf(W?.M), diag: UA.rdRelease === 'chamber' ? null : UA.rdDiag }); // '먼저 머리 위로' 자리 = 이 감기 꼴의 고리 (어깨 꼴은 10/29 판 고리 — 10/29 20:0x) · 길 = 곧장 사선(10/30 rdRelease 'direct' — rdDiag) · 'chamber' 면 10/29 판 왼 어깨 뒤 길
    if (!ok) {
      f.ibStrike = null;
      this.stats.windCancel ??= {};
      this.stats.windCancel.noStrike = (this.stats.windCancel.noStrike ?? 0) + 1;
      return false;
    }
    this.coolStart(e); // 식힘은 내려침이 나간 순간부터 (사장님 10/28 02:0x '스킬이 발동한 순간부터 재')
    if (this.cur) this.closeStroke(this.t);
    this.tapRec = { tech: 'tap', kind: 'cut', tap: true, t0: this.t, dir: [0, 0], start: null, landed: false, bound: false, tEnd: null, unique: U.name }; // 앞 칼 기록 (다음 기회를 열지 않음 — tapChain 과 같음)
    this.stats.fired[U.name] = (this.stats.fired[U.name] ?? 0) + 1;
    this.stats.windFire ??= {};
    this.stats.windFire[why] = (this.stats.windFire[why] ?? 0) + 1;
    this.stats.windTurns = [...(this.stats.windTurns ?? []), +turns.toFixed(2)];
    this.stats.windChain = [...(this.stats.windChain ?? []), n];
    f.uniqueCue = { text: U.nameKo, kind: 'unique', who: 'me', schoolKo: TRADITIONS[this.tradition]?.nameKo ?? '', name: U.name, t: this.t };
    f.stamina.attack('cut'); // 칼 하나 (끌고 가는 칼은 같은 공격 — same) · 풍차 베기 칼은 세 칼마다 기력 0 자리가 아님 (fighter.js ibChainCostK — 이어지는 흐름 B6)
    return true;
  }

  /** 탭 창 (TAP_TRIG): age < from 이면 이른 탭 — 그 기회를 없앰(from > 0 일 때) · from ~ to 면 { spend } · 그 밖 null */
  windowed(rec, key, age, from, to) {
    if (age < from) {
      rec[key] = true;
      this.stats.tapEarly = (this.stats.tapEarly ?? 0) + 1;
      return null;
    }
    if (age > to) return null;
    return { spend: () => (rec[key] = true) };
  }

  /** 지금 내 칼과 상대 칼이 닿아 있나 (겹치기 — 10/28): 몸이 느끼는 맞댐(feel.touching) 또는 칼날 선분 사이 0.07 m 안 (track 의 맞물림과 같은 거리) */
  bladeTouch() {
    const f = this.f;
    const foe = f.foe;
    if (!foe?.armed || !f.armed) return false;
    if (f.feel?.touching) return true;
    return segDist(f.bladePoint(0.1, _a), f.bladePoint(1, _d), foe.bladePoint(0.1, _b), foe.bladePoint(1, _c)) < 0.07;
  }

  /**
   * 겹치기 자동 (사장님 10/31 16:xx '추가 커맨드 없이 일정 조건 충족하면 자동으로' — UNIQUE_ASSIST.dupAuto · 시제품 기본 끔 · 기록 docs/strike/duplieren_auto_2026-10-31.md): drive 가 물리 스텝마다.
   *  띠 = 가슴 사이(fighter.foeDistance — 죽음의 일격 'close' 와 같은 잣대) dupBandMin(null = SECRET.mordCloseN 0.8) 초과 ~ 위 끝 이하 · 닿음 = bladeTouch(몸이 느끼는 맞댐 · 칼날 선분 0.07 m).
   *  'bind'  : 닿아 있고 띠 안인 스텝마다 쌓임 += dt · 끊기면(떨어짐 · 띠 밖) dupStackGap 안엔 쌓임을 쥠(안 셈 — 죽음의 일격 mordGrace 와 같은 틀) · 넘으면 0(dupStackDrain > 0 이면 초당 그만큼 빠짐) ·
   *            쌓임 ≥ dupStackS 이고 지금 닿아 있고 띠 안이고 손가락이 휘두르는 중이 아니면 냄(긋는 중엔 미룸 — 쌓임은 쥠).
   *  'clash2': 닿음 덩이(떨어진 틈이 dupClashGap 이상이어야 새 덩이 — 한 맞댐의 떨림을 둘로 세지 않음)의 시작이 앞 덩이 시작부터 dupClashT 안이고 띠 안이면 그 덩이가 닿아 있는 동안 냄.
   *  셈 0(쌓임 · 짝 버림): 식힘 중 · 끌고 가는 칼(iaiBusy — 겹치기 · 다른 특수 공격 · 고노센) · 비기 · 나 · 상대가 서 있지 않음 · 칼 없음 · 탈진 · 막기 단추(dupAutoParry 0).
   *  냄 막음(쌓임은 쥠 — 풀리면 그때 냄): 몸이 바쁨(busy — 탭 찌르기 · 손잡이 찍기 · 걸어 맞추기 등) · 운동학 칼을 못 냄(상대 칼 없음 · 세기 0).
   *  냄 = 탭 판과 같은 칼(launchTap — 식힘 · 기력 탭 하나 · 알림 · requestArtDup). 자세 칸 알림 dupCue = 'bind' 쌓임 절반부터(dupAutoHint)
   */
  dupAutoTick(dt) {
    const f = this.f;
    const e = this.dupE;
    const mode = UA.dupAuto;
    const A = (this.dupA ??= { st: 0, off: 0, since: null, on: false, t0: null, prev: null, tEnd: null, pair: false });
    const foe = f.foe;
    const touch = this.bladeTouch();
    const d = f.foeDistance();
    const lo = UA.dupBandMin ?? SECRET.mordCloseN ?? 0;
    const hi = mode === 'clash2' ? (UA.dupClashMax > 0 ? UA.dupClashMax : Infinity) : UA.dupBandMax;
    const band = d > lo && d <= hi;
    const parry = !UA.dupAutoParry && this.blocked;
    const dead = !UA.on || this.cooling(e) || iaiBusy(f) || !!f.skill.sec || !f.alive || f.state !== 'stand' || !foe || foe.state !== 'stand' || !f.armed || !foe.armed || f.weaponBroken || f.stamina.exhausted || parry;
    let ready = false;
    if (mode === 'bind') {
      const live = touch && band && !dead;
      if (live) {
        if (!(A.st > 0)) A.since = this.t;
        A.off = 0;
        A.st += dt;
      } else if (A.st > 0 && !dead && (A.off += dt) <= UA.dupStackGap) {
        // 너그러움: 쥔 채 기다림 (안 셈)
      } else if (A.st > 0 && !dead && UA.dupStackDrain > 0) {
        A.st = Math.max(0, A.st - UA.dupStackDrain * dt); // 빠짐 판 (dupStackDrain — 초당 쌓임 몫 · 0 = 곧장 0)
        if (!A.st) A.since = null;
      } else (A.st = 0), (A.off = 0), (A.since = null);
      // 손가락이 휘두르는 동안(긋는 중 — 휘두르기 문턱 SKILL.swingSpeed 위)은 냄만 미룸(쌓임은 쥠): 맞댄 칼을 떼고 다른 데를 치려는 손을 겹치기가 가로채지 않게 · 맞댄 채 멈추거나 느리게 밀면 나감
      ready = A.st >= UA.dupStackS && touch && band && !f.skill.inputSwinging;
      this.dupCue = UA.dupAutoHint && !dead && A.st >= UA.dupStackS * 0.5 ? { name: e.U.name, nameKo: e.U.nameKo, sub: '맞물림' } : null;
    } else if (mode === 'clash2') {
      if (touch && !A.on) {
        A.on = true;
        if (A.tEnd == null || this.t - A.tEnd >= UA.dupClashGap) {
          A.prev = A.t0;
          A.t0 = this.t;
          A.pair = A.prev != null && this.t - A.prev <= UA.dupClashT && band;
        }
      } else if (!touch && A.on) (A.on = false), (A.tEnd = this.t); // 짝은 쥠 — dupClashGap 안에 다시 닿으면 같은 덩이(냄은 닿아 있을 때만)
      if (dead) (A.pair = false), (A.prev = A.t0 = null);
      ready = A.pair && touch && band;
      this.dupCue = null;
    }
    if (!ready || dead) return false;
    if (this.busy(UA.dupAutoParry ? 'any' : false) || f.iai || f.iaiReq || !(specialShare(e.name) > 0) || !(UA.enhance > 0) || !foe.sword || !foe.bodies?.head) return false;
    A.st = 0;
    A.off = 0;
    A.since = null;
    A.pair = false;
    A.prev = A.t0 = null;
    this.dupCue = null;
    return this.launchTap(e, this.t, true);
  }

  /**
   * 내 긋기가 도는 중인가 (칼끝 돌려 빼기 닿음 조건 — 10/31 사장님 '베기에서의 닿음이나 막힘은 빼야' · 감독 '내 긋기 동안의 닿음은 뺌'):
   *  손가락 휘두름이 찌르기 꼴(찌르는 긋기 — 시작 자세 + 첫 방향이 찌르기 기본 동작)이 아닌 긋기로 읽혀 도는 중(this.cur — 끝은 onsetQuiet 쉼) · 또는 끌고 가는 베는 칼(f.iai 의 지금 수가 베기)
   */
  cutting() {
    const c = this.cur;
    if (c && c.kind !== 'thrust') return true;
    const I = this.f.iai;
    const m = I?.moves?.[I.mi];
    return !!m && m.kind === 'cut';
  }

  /**
   * E 칼끝 돌려 빼기 거둠 (10/31 시제품 — UNIQUE_ASSIST.cavCancel · 기본 끔): 끄는 동안 막기 단추를 새로 누르거나(낸 때 떼고 있었으면) · 쥔 채 새 위협이 오면(낸 때 위협 번호와 다름)
   *  그 스텝에서 칼을 거둬 끝냄(끌고 가는 칼의 시간 상한을 지금으로 — secret_instant.js stepCombo 가 이 스텝 자리에서 endCombo) → 막기 단추가 손을 받음
   */
  cavCancelTick() {
    const f = this.f;
    const I = f.iai;
    if (!I && f.iaiReq?.tech === 'cavazione') return; // 걸어 둔 칼이 아직 시작 전 (combat.afterStep 이 시작)
    if (!I || I.tech !== 'cavazione') {
      this.cavFire = null;
      return;
    }
    const G = f.parryGuard;
    if (!G?.held) {
      this.cavFire.held = false;
      return;
    }
    const fresh = !this.cavFire.held || (G.noThreat === 0 && G.threatId !== this.cavFire.threat);
    if (!fresh) return;
    I.maxT = Math.max(1e-6, I.t);
    this.cavFire = null;
    this.stats.cavCancel = (this.stats.cavCancel ?? 0) + 1;
  }

  /**
   * 칼끼리 닿음 (물리 스텝마다 — drive 머리 · 10/31 칼끝 돌려 빼기 탭 조건): 내 칼이 상대 칼에 실제로 닿은 스텝(combat.js bladeClash 의 feel.touching — 가까움만으로는 아님)마다
   *  지금 닿음을 잇고(t1) · 새로 닿은 스텝(feel.time 0 — 떨어져 있다가 새로 부딪힘 · combat.js STEEL.rearmSteps)이면 새 닿음(t0)을 엶. 까닭은 묻지 않음 —
   *  내 찌르기(탭 · 찌르는 긋기)가 상대 칼에 부딪힘 · 막고 서 있다 닿음 · 상대가 내 칼을 누름 · 묶음 · 내 찌르기가 막힘 모두. 다만 내 긋기가 도는 동안 닿은 스텝이 하나라도 있으면
   *  그 닿음은 통째로 셈 밖(cut — 재기 stats.touchCut). 상대 칼 쪽 n = 닿은 스텝 feel.normal(상대 칼이 내 칼을 미는 쪽)의 반대 — 돌려 빼 그 너머 열린 줄로 (cavSide 'contact')
   */
  touchTick() {
    const f = this.f;
    const fe = f.feel;
    if (!fe?.touching || !f.armed || !f.foe?.armed) return;
    let C = this.touch;
    if (!C || fe.time === 0 || this.t - C.t1 > UA.cavTo) {
      C = this.touch = { t0: this.t, t1: this.t, cut: false, cavSpent: false, n: null, steps: 0 };
      this.stats.touches = (this.stats.touches ?? 0) + 1;
    }
    C.t1 = this.t;
    C.steps++;
    if (!C.cut && this.cutting()) {
      C.cut = true;
      this.stats.touchCut = (this.stats.touchCut ?? 0) + 1;
    }
    if (fe.normal && fe.normal.lengthSq() > 1e-8) C.n = (C.n ?? new THREE.Vector3()).copy(fe.normal).negate();
  }

  /** 물러남 (날개 접기 — 10/28 01:2x): 스틱 뒤 몫 ≥ 0.5 이고 옆 몫보다 큼 (stickOk 'fwd' 의 거울) */
  backNow() {
    const x = this.f.stickX ?? 0, y = this.f.stickY ?? 0;
    return -y >= 0.5 && -y > Math.abs(x);
  }

  /** 걸음 명령의 스틱: 'side' = 옆 몫이 0.5 넘고 앞뒤 몫 이상 · 'fwd' = 앞 몫이 0.5 넘고 옆 몫보다 큼 (플레이어 스틱 원값 f.stickX · stickY — 키도 같은 값) */
  stickOk(want) {
    const x = this.f.stickX ?? 0, y = this.f.stickY ?? 0;
    if (want === 'side') return Math.abs(x) >= 0.5 && Math.abs(x) >= Math.abs(y);
    if (want === 'fwd') return y >= 0.5 && y > Math.abs(x);
    return true;
  }

  /** 이어 긋기 창이 열렸나 (자세 칸 표시 — main.js updateGuardName): 잇는 동작의 뒷몫(chainFrom · chainWait) 또는 앞 동작 조건(맞물림 · 빗나감 · 아무거나 — afterWindow)이 찬 이어 긋기. 없으면 null */
  readyChain(now) {
    const C = this.chainFrom;
    if (C && now - C.tEnd <= UA.chainWait) return C.e;
    const L = this.last;
    if (!L || L.tEnd == null || now - L.tEnd > UA.afterWindow || this.busy()) return null;
    for (const e of this.list) {
      if (e.role !== 'chain' || this.cooling(e, now)) continue; // 특수 공격 식힘 중엔 자세 칸에 이름을 띄우지 않음 (10/28 02:0x)
      for (const c of e.on) {
        if (!c.prev || c.when === 'turn') continue;
        if (c.prev === 'cut' || c.prev === 'thrust' ? L.kind !== c.prev : L.tech !== c.prev) continue;
        if (c.when === 'bound' ? L.bound : c.when === 'miss' ? !L.landed : true) return e;
      }
    }
    return null;
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
  detect(dt, swinging, inputVelocity = this.f.skill.vel) {
    const now = this.t;
    this.track();
    const was = this.wasSwing;
    this.wasSwing = swinging;
    const f = this.f;
    const hand = [f.handOffset.x, f.handOffset.y];
    if (this.r) this.r.travel += hyp(inputVelocity.x, inputVelocity.y) * dt; // 이 긋기에서 손 목표가 간 길 (끝 힘 '뒷몫' 판단)
    if (!swinging) {
      const ready = this.readyChain(now); // 이어 긋기 창 (10/21 — 자세 칸에 이름)
      this.ready = ready ? { name: ready.U.name, nameKo: ready.U.nameKo } : null;
      this.quietT += dt;
      if (this.cur && this.quietT >= UA.onsetQuiet) this.closeStroke(now - this.quietT);
      if (this.fSpeed < SKILL.swingSpeed) this.restPos = hand; // 시작 자리 = 손가락이 빨라지기 직전 자리 (검술 층 휘두르기 판단은 손 목표 속도를 고르느라 한두 프레임 늦다)
      return;
    }
    this.quietT = 0;
    this.ready = null;
    const v = inputVelocity;
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
    // 끝 힘 잣대: 앞 긋기 = 길 처음 ~ 잇는 자리 · 뒷몫 = 잇는 자리 ~ 끝. 제비 베기(ruler 'turn' — 사장님 10/25 해법 ① · UNIQUE_ASSIST.tsuRuler)는 강화되는 긋기가 곧 올려 긋기라 꺾은 자리부터
    const fromTurn = part === 2 || (e.ruler === 'turn' && UA.tsuRuler);
    const len = fromTurn ? PlayerUniqueAssist.lenOf(U.pts, at) : PlayerUniqueAssist.lenOf(U.pts, 0, at);
    this.r = { e, U, part, t: 0, travel: 0, len: Math.max(0.05, len), stepAsked: false };
    // 이어 그을수록 강해짐 (강화동작 stack — 이베리아 머리 위 돌려 베기): 같은 동작을 이어짐 창(afterWindow 0.6 s — 10/21 0.45 에서 통일) 안에 다시 그으면 하나씩(셋까지) — 맞는 순간 에너지 × (1 + stack × 그 수) (strokeHitK)
    if (e.stack) { this.stackN = this.stackE === e.name && this.t - (this.stackT ?? -9) <= UA.afterWindow ? Math.min(3, (this.stackN ?? 0) + 1) : 0; this.stackE = e.name; }
    cur.kind = part === 2 ? cur.kind : U.kind;
    cur.unique = U.name;
    if (part === 2) {
      this.stats.ends.chained = (this.stats.ends.chained ?? 0) + 1;
      return;
    }
    this.stats.fired[U.name] = (this.stats.fired[U.name] ?? 0) + 1;
    this.coolStart(e);
    f.uniqueCue = { text: U.nameKo, kind: 'unique', who: 'me', schoolKo: TRADITIONS[this.tradition]?.nameKo ?? '', name: U.name, t: this.t };
    // 걸음 명령의 옆 걸음은 스틱 쪽으로(표의 lat 크기 · 부호는 스틱) — 10/21
    if (U.step && e.stick === 'side' && Math.abs(this.f.stickX ?? 0) > 0.01) this.r.step = { ...U.step, lat: Math.abs(U.step.lat) * Math.sign(this.f.stickX) };
    if (U.step && UA.enhance > 0) this.r.stepAsked = this.askStep(this.r.step ?? U.step);
    // 진 · 츠바메가에시 (10/21 — 무기 비검 kin): 되돌림 칼을 고노센의 kin 몫 빠르기로 끌고 간다 (길 = 이 기술의 되돌림 몫 — 이어 긋기 at 부터)
    const SB = f.weapon?.secretBlade;
    if (SB?.kin && SB.tech === e.name) {
      const at = Math.min(e.chain?.at ?? 2, U.pts.length - 2);
      if (requestArtReturn(f, U.pts[at], U.pts.slice(at + 1), SB)) this.end('yield');
    } else if (e.snap && UA.tsuSnap && UA.enhance > 0) {
      // 제비 베기 되돌림 칼 (사장님 10/25 21:1x 해법 ② — 중력과 관성을 거스름): 꺾은 자리(지금 손 목표)에서 올려 긋는 길을 고노센 칼끝 빠르기 × specialShare.tsubameGaeshi 로 tsuSnapTime 초까지 끌고 간다.
      //  강화(몸 · 끝 힘 · 덧칸)는 그대로 둔다 — 끌고 가는 칼이 끝나면 손가락이 이어 긋는다
      const at = Math.min(e.chain?.at ?? 2, U.pts.length - 2);
      //  길 덧칸(해법 ③ 손 돌리기 등)은 끌고 가는 칼에도 같은 점마다 (U.plan 의 꺾은 자리부터)
      const so = U.snapOpt; // 곧은 길 (10/31): shift 'none' = 띠 높이 옮김 없이 굴림 묶음만
      if (requestArtSnap(f, [f.handOffset.x, f.handOffset.y], U.pts.slice(at + 1), { share: specialShare(e.name), maxT: UA.tsuSnapTime, tech: e.name, plan: U.band ? U.snapPlan.slice(at) : U.plan ? U.plan.slice(at) : null, band: !!U.band && so?.shift !== 'none', roll: !!U.band && so?.shift === 'none', shift: so?.shift && so.shift !== 'none' ? so.shift : null, pathHint: !!so?.pathHint, arcCut: !!so?.arcCut })) this.stats.snap = (this.stats.snap ?? 0) + 1;
    } else if (e.tap && UA.imbroReach) {
      // 위에서 내려 찌르기 닿게 (사장님 10/27 23:5x '찌르기 뻗게 고치고'): 읽힌 순간 탭 찌르기 덧씌우기로 찌른다 — AI 임브로카타(ai.js startStrike → skill.thrust)와 같은 길
      //  (이탈리아 찌르기 THRUST.itLunge — 몸통 겨눔 · 팔만으로 안 닿으면 거리만큼 런지). 그 탭이 도는 동안 강화(몸 · 끝 힘)는 물러남(busy) · 맞은 상처는 이 기술(strokeTechOf — I8 틈 파고들기).
      //  기력: 손가락 긋기가 곧 이 탭 — 긋기 몫은 청구하지 않고(stamina.dropStroke) 탭 하나만
      f.stamina?.dropStroke?.();
      if (f.skill.thrust({ uniq: false }) && f.skill.tap) {
        // (탭이 걸어 맞추기 판 — 무릎 꿇은 상대 약한 자리 vitalRange — 이면 탭은 다음에 나므로 이름을 달지 않음)
        f.skill.tap.uniqTech = e.name;
        this.stats.reach = (this.stats.reach ?? 0) + 1;
      }
    }
  }

  /** 매 스텝, 검술 층 머리 (비기 updateSecret 자리 옆): 강화 몫 갱신 — 손 목표는 건드리지 않는다 */
  drive(dt) {
    this.t += dt;
    const f = this.f;
    if (UA.cavCancel && this.cavFire) this.cavCancelTick();
    if (this.holdE) this.holdTick(dt); // 풍차 베기 (B4 — 길게 눌러 감다 떼면 내려침 · 10/29)
    if ((UA.dupAny || UA.dupGrace > 0) && UA.dupTap && this.list.some((x) => x.tapKey === 'dup')) {
      // 겹치기 시제품 닿음 덩이 (10/31 — 기본 끔이면 셈도 안 함): 칼끼리 닿음이 시작된 때 · 끝난 때
      if (this.bladeTouch()) { if (!this.dupC || this.dupC.end != null) this.dupC = { t0: this.t, end: null, spent: false }; } else if (this.dupC && this.dupC.end == null) this.dupC.end = this.t;
    }
    this.coolTick(); // 나간 특수 공격이 끝났나 (식힘은 끝난 때부터 — 10/29 19:5x)
    this.touchTick(); // 칼끼리 닿음 (칼끝 돌려 빼기 탭 조건 — 10/31)
    if (UA.dupAuto && this.dupE) this.dupAutoTick(dt); // 겹치기 자동 (사장님 10/31 18:xx 'bind' 기본 — 0 이면 셈도 안 함 · 겹치기를 익힌 독일 사람만)
    // 물러남이 풀린 때 (날개 접기 탭 조건 TAP_TRIG 'lian' — 10/28 01:2x): 스틱 뒤가 풀린 스텝
    const back = this.backNow();
    if (this.backOn && !back) this.backOff = this.t;
    this.backOn = back;
    const R = this.r;
    const E = UA.enhance;
    if (R) {
      R.t += dt;
      if (this.busy()) this.end('yield');
      else if (R.U.step && !R.stepAsked && E > 0 && R.t < 0.3) R.stepAsked = this.askStep(R.step ?? R.U.step); // 못 받았으면(뒤로 당긴 스틱 등) 잠깐 다시 부탁 (AI 와 같음)
    }
    const r = this.r;
    // ② 몸: 긋는 동안 표의 몸 꼴(body · 뒷몫은 body2)을 bodyIn 초에 얹고, 긋기가 끝나면 bodyOut 초에 걷는다 (덧씌우기 칸 몸 값 — fighter.js updateBodyPose 가 더한다)
    let B = r && E > 0 ? (r.part === 2 ? r.e.body2 ?? r.e.body : r.e.body) : null;
    // bodyMirror (10/21): 몸 돌림 쪽을 이 긋기의 걸음 쪽에 맞춘다 — 1 = 디딘 쪽 · −1 = 디딘 쪽의 반대 (걸음은 스틱 쪽 · 없으면 표의 걸음)
    if (B && r.e.bodyMirror) { const lat = (r.step ?? r.U.step)?.lat ?? 0; if (lat) { const sg = Math.sign(lat) * r.e.bodyMirror; B = [Math.abs(B[0]) * sg, Math.abs(B[1]) * sg, B[2], B[3]]; } }
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
    // 강화동작(role 'enh')은 끝 힘 enhPower · 이어 그을수록 + stack × 수 (10/21)
    const pw = r ? (r.e.role === 'enh' ? UA.enhPower ?? UA.endPower : UA.endPower) - 1 : 0; // 이어 그을수록(stack)은 끝 힘이 아니라 맞는 순간 에너지 (strokeHitK — 10/21)
    const pv = r && E > 0 && r.travel >= UA.powerAt * r.len && r.t <= UA.powerMax ? 1 + pw * E : 0;
    if (pv) {
      if (f.powerMul === 1 || f.powerMul === this.powV) {
        if (!this.powV) this.stats.power++;
        f.powerMul = pv;
        this.powV = pv;
      }
    } else this.dropPower();
    this.planStep(dt);
  }

  /**
   * ④ 길 덧칸 (사장님 10/25 18:0x '같은 길 입혀' — 지금은 곁눈 베기만 · uniqueDef plan · config UNIQUE_ASSIST.schielPlayer): AI(ai.js techPlanStep)와 같은 덧칸을 사람 강화동작에도.
   *  손 목표는 손가락 그대로 — 손 목표를 다시 그린 길(U.pts)에 비춘 자리(길 처음부터 잰 길이 · 뒤로 가지 않음)로 지금 토막 두 점의 [칼끝 들기 °, 손 뻗기 m, 손 돌리기 °]를 섞어
   *  f.techPlan { tilt rad, reach m, turn rad } 에 둔다(fighter.js driveSword — 손 목표 앞으로 · 칼 겨눔 높이각 · 날 세우기 칼 면). 길 끝을 지나면 끝 점 값 · 크기 × min(1, enhance).
   *  칼끝 들기는 UNIQUE_ASSIST.schielPlayerTip 일 때만(기본 1 — 사장님 10/25 20:2x 결정 · 0 = 시험용 · wrist_audit §15-6).
   *  강화가 끝나면(쉼 · 꺾음 · 다른 동작에 내줌) 그때 값을 UNIQUE_ASSIST.planRelease 초에 걸쳐 0 으로. 덧칸 없는 동작 · 스위치 끔이면 아무것도 안 함(techPlan 그대로 null)
   */
  planStep(dt) {
    const f = this.f;
    const r = this.r;
    const P = r && r.part === 1 && UA.enhance > 0 ? r.U.plan : null;
    if (P) {
      const pts = r.U.pts;
      const hx = f.handOffset.x;
      const hy = f.handOffset.y;
      let best = Infinity;
      let s = 0;
      let acc = 0;
      const cum = [0];
      for (let i = 0; i < pts.length - 1; i++) {
        const J = closest(pts[i], pts[i + 1], [hx, hy]);
        const d = hyp(hx - J[0], hy - J[1]);
        if (d < best - 1e-9) {
          best = d;
          s = acc + hyp(J[0] - pts[i][0], J[1] - pts[i][1]);
        }
        acc += hyp(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
        cum.push(acc);
      }
      r.planS = Math.max(r.planS ?? 0, s);
      let i = 0;
      while (i < pts.length - 2 && r.planS > cum[i + 1]) i++;
      const L = cum[i + 1] - cum[i];
      const u = L > 1e-6 ? THREE.MathUtils.clamp((r.planS - cum[i]) / L, 0, 1) : 1;
      const a = P[i];
      const b = P[i + 1];
      const k = Math.min(1, UA.enhance);
      const mix = (j) => ((a[j] ?? 0) + ((b[j] ?? 0) - (a[j] ?? 0)) * u) * k;
      // 칼끝 들기는 UNIQUE_ASSIST.schielPlayerTip 일 때만 (기본 1 — 사장님 10/25 20:2x '칼끝 들기 빼지 마' · 0 = 시험용: 길 끝을 지나 계속 긋는 손가락에서 칼끝을 채찍처럼 떨구는 몫을 뺌)
      f.techPlan = { tilt: UA.schielPlayerTip ? mix(0) * D2R : 0, reach: mix(1), turn: mix(2) * D2R };
      this.planFade = null;
    } else if (f.techPlan) {
      // 놓음 (ai.js techPlanStep 과 같음): 손 목표가 한 스텝에 손 뻗기만큼 튀지 않게 그때 값을 planRelease 초에 걸쳐 0 으로
      const F = (this.planFade ??= { tilt: f.techPlan.tilt, reach: f.techPlan.reach, turn: f.techPlan.turn, t: 0 });
      F.t += dt;
      const q = 1 - F.t / UA.planRelease;
      if (q <= 0) {
        f.techPlan = null;
        this.planFade = null;
      } else f.techPlan = { tilt: F.tilt * q, reach: F.reach * q, turn: F.turn * q };
    }
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
    if (R?.e.stack) this.stackT = tEnd; // 이어 그을수록 강해짐 — 끝난 때부터 chainWait 를 잰다
    this.dropPower();
    this.stats.ends[why] = (this.stats.ends[why] ?? 0) + 1;
    if (why === 'done' && R?.part === 1 && R.e.chain) this.chainFrom = { e: R.e, U: R.U, tEnd };
  }
}
/** 지금 긋는 기술의 이어 그은 수 (stack 이 있는 기술만 — 이베리아 머리 위 돌려 베기 · 없으면 0) */
export function strokeStackN(f) {
  const name = strokeTechOf(f);
  if (!name || !STACK_BY_NAME[name] || perkOff(f, name)) return 0; // 쌓기 잔상도 심화 칸과 같이 (10/21)
  return f.skill?.uniq ? f.skill.uniq.stackN ?? 0 : f.aiCtl?.stackN ?? 0;
}
setArtTechOf(strokeTechOf, strokeStackN); // 고유 동작 잔상(secret_instant.js artTrailTick · artFlash)이 지금 기술 이름 · 이어 그은 수를 읽게

import { STAMINA } from './config.js';
// ─────────────────────────────────────────────────────────────
//  상대 AI: 사람 검객처럼 싸운다
//
//  AI도 플레이어와 똑같이 "손 목표 위치(패드)"와 "이동 방향"만 조종한다.
//  손은 사람 손 빠르기로만 움직이고, 칼과 몸은 물리가 움직인다 (순간이동 칼질 없음).
//
//  좀비처럼 달려들지 않는다. 리히테나워 검술의 기본을 따른다:
//   1) 간격(Mensur): 상대 칼이 닿지 않는 거리 바로 밖에서 간을 본다. 잔걸음으로 들어갔다 빠졌다,
//      옆으로 돌며 자세를 바꾼다(지붕·황소·쟁기·긴 자세·바보). 서두르지 않는다.
//   2) 빈틈(Blöße): 상대가 헛친 뒤 칼이 길 밖에 있을 때, 간격 안으로 걸어 들어올 때, 비틀거릴 때,
//      자세가 한쪽을 비워 둘 때 → 그 빈틈을 노리는 기술을 골라, 한 걸음 내디디며 친다.
//      친 뒤에는 물러나거나(Abzug), 막혔거나 맞았으면 이어서 친다(Nachschlag).
//   3) 막기: 상대가 치러 오면 난이도에 따라 물러나 헛치게 하거나, 칼을 들어 막거나,
//      같은 순간에 맞받아 베어(Indes) 막으면서 친다. 막은 뒤엔 되받아 친다(Nach).
//   4) 속임수(Fehler), 성격(사람마다 다른 간격·자세·기술 취향), 줄어드는 인내심(판이 늘어지지 않게),
//      다쳤을 때의 판단(피를 더 흘리면 서두르고, 상대가 더 흘리면 기다린다).
//
//  반응 시간: AI는 상대를 reaction초 늦게 본다 (ai_sense.js). 이 물리에서 베기는 시작부터 닿기까지
//  0.3초쯤이라, 보고 나서 막기는 거의 늦다 → 사람처럼 "치려는 낌새"(칼을 들며 간격으로 들어오는 것)를
//  먼저 읽고 물러나거나 먼저 쳐야 한다. 그래서 간격 지키기가 가장 중요한 방어다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { AI_LEVELS, AI_PROFICIENCY, ARENA, BODY, SKILL, CLOSE, GAIT, SECRET, BIND, DRYPATH, UNIQUE_ASSIST as UA, SCHOOL_PASSIVE, realS, realRate, TIME } from './config.js';
import { Senses } from './ai_sense.js';
import { padDist, WATCH_GUARDS } from './ai_techniques.js';
import { TRADITIONS } from './schools.js'; // 패시브 고유 동작 목록 (10/9 — TRADITIONS[유파].passives)
import { resolveSwordArt } from './sword_art.js'; // 검술 풀이: 유파 꾸러미·라이브러리 병합·간격을 한 곳에서 (10/8 ① 구조)
import { spendAweDrain } from './stamina.js'; // 티소나 '위세' (10/21 — 내 공격이 상대 칼에 막히면 막은 쪽 기력 −, afterStrike)
import { schoolPassiveOn } from './school_passive.js'; // 유파 패시브 스위치 (10/21 — 이베리아 손목 힘 · 나머지 넷은 fighter.schoolPassive)
import { beginFlowRecovery } from './nagashi_recovery.js'; // 칼끝 돌려 빼기 심화 · 헛누름 AI 몫 — 상대 두 팔 늦춤 (10/31)
import { aiUniqueStages, PLAYER_UNIQUE, specialShare, rdReleaseOpt } from './unique_assist.js'; // 숙련도 거르기 (10/13): 고유 동작·패시브 단계 표 한 곳
import { installCover } from './frames.js'; // 유파 막기 자리 몸꼴 덧씌우기 (10/11 중국 — schools.js parryCover)
import { MEASURED } from './weapon_measured.js';
import { routeAroundStageObstacle, obstacleSegmentBlocked, OBSTACLE_ROUTE } from './arena_obstacle.js'; // 잠든 습지 가운데 석상: 막힌 길이면 스틱 방향만 둘레로 (석상 없는 무대는 아무 일 없음)
import { avoidEtnaLava } from './terrain_navigation.js'; // 화산섬 용암: 내리막 자발 이동·기술 걸음만 돌리거나 취소 (지형 없는 무대는 아무 일 없음)
import { wetlandWetness, WETLAND_RIM, WETLAND_CORE_SPEED } from './wetland_ground.js'; // 마른 길을 아는 AI (라트나 · 잠든 습지만 — 아래 dry* · config.js DRYPATH): 물리와 같은 젖음 지도
import { Emotions, emoMods } from './emotions.js';
import { gunAI } from './gun.js';
import { FINISH, cleaveFinish } from './finish.js';
import { lowFinishOn, lowFinishPosture, lowFinishContinuing, downLowTarget } from './finish_entry.js'; // 낮은 상대 진입 (10/12, 기본 끔)
import { aiVitalCandidate, aiVitalPrepare, aiVitalAdvance, neckCrossingTechnique } from './vital_target.js'; // 약한 자세 겨눔 (FINISH.vital, 10/12)
import { requestInstant, requestIai, requestSweep, requestCombo, requestArtReturn, requestArtRedondo, iaiReadyPose, startLunge, gilmokCutPose, gilmokSeg, iaiBusy } from './secret_instant.js'; // 일본 비기 순간 베기 (10/10) · iaiBusy 고노센 경계 — 상대 발도에 베였나 (10/25)
import { windStart, windEnd, windRopesBack, windLoopOf, windSpec, windWoundT } from './iberian_redondo.js'; // AI 풍차 베기 감기 (10/31 08:xx — UNIQUE_ASSIST.rdAiWind · 사람과 같은 감기 · 내려침)
import { parrySlotOf, bindGain, gilmokLine, gilmokLowGuard, gilmokWindT, secretVal, threatNow, foeRecentTipE, secretEvent, secretCond, chainRange, firstHitOk, BindCount, bladesTouch, IaiArm, montanteFlowSeq, flowGate, FLOW_GATE_MAX, bindTouch, pressStep, gnsEnterLine, gnsOutside, gnsUser, gnsBlockOf, gnsArmTick, gnsMoving, gnsHumanUnsettled, armHold, secretSpent, useSecret, gnsHumanMoving } from './secret.js'; // 유파 비기 조건 — 플레이어 창과 같은 함수 (10/9 플레이어 비기) · pressStep 모르트슐라크 누르기 셈 (10/24) · gnsEnterLine · gnsOutside 고노센 들어옴 (10/25 — SECRET.gnsEnterAI 일 때만)
import { mordHeadReach } from './mordschlag.js'; // 모르트슐라크 AI (10/24): 창 안에서 상대 머리가 칼자루 길에 닿나

// 공포 떨림의 최대 크기 (m, 공포 세기 1일 때 손 위치 잔떨림). 눈에 더 띄게 하려면 올린다 — moveHand() 참고
const FEAR_TREMOR = 0.03;

const clamp = THREE.MathUtils.clamp;
const rand = (a, b) => a + Math.random() * (b - a);
// 표준 시간 (10/25 22:3x — config.js TIME): AI 판단 박자 · 막기 · 물러남 · 걸쇠 · 눈의 기억은 실제 초로 적고 한 번 게임 초로 바꾼다 (realS).
//  몸 · 칼 움직임 시간(기술 걸음 STEP_T · 따라 지나감 0.3 · 내딛기 늦춤 0.04 · 떨림 박자 · 비기 동작 단계)은 그대로 — 지금 빠르기가 표준.
const DEF_T = realS(0.65); // 막기 한 번의 길이 (parry_button.js 와 같은 수)
const DEF_SEIZE = realS(0.4); // 막는 중 남은 시간이 이 밑이면 붙잡기도 본다
const DEF_MIN = realS(0.35); // 공격이 지나갔으면 남은 시간이 이 밑일 때 되받거나 물러난다 (막기 최소)
const LOCK_T = realS(0.5); // 패시브 걸쇠 · 미룬 패시브 남은 시간
const EV_REARM = realS(0.3); // 낌새 · 상대 사건이 이만큼 그치면 다시 본다 (secret.js 와 같은 수)
const QUIET_T = realS(0.12); // 위협이 이만큼 없고 손이 멎으면 '공격이 지나갔다' (parry_button.js 와 같은 수)
const NEW_THREAT_T = realS(0.25); // 잠깐 조용했다가 다시 오면 새 공격으로 보는 틈 (parry_button.js 와 같은 수)
const CALM_T = realS(2); // 대치: 위협 없이 이만큼 지나야 '조용히 맞섬' (패시브 standoff)
// 특수 공격 AI 몫 (사장님 10/29 19:4x 'AI의 모든 쿨타임은 사람과 맞춰.' — UNIQUE_ASSIST.specialCooldown · specialCoolFrom · 사람 unique_assist.js cooling 과 같은 수 · 같은 셈):
//  사람 표 칸 special 다섯(제비 베기 · 칼끝 돌려 빼기 · 날개 접기 · 겹치기 · 풍차 베기)의 이름 = AI 기술 길 이름(제비 베기 · 겹치기 · 머리 위 돌려 베기 강화동작 — 왼 가로베기 자리) ·
//  속임 꼴 고유 동작(날개 접기 · 칼끝 돌려 빼기 — schools.js *_UNIQUE feint) · 패시브(겹치기 · 빼서 찌르기 cavazione — 같은 이름 · 되받아 치기 kaeshi — 그 기술이 제비 베기)
const SPECIALS = new Set(Object.values(PLAYER_UNIQUE).flat().filter((e) => e.special).map((e) => e.name));
const SPECIAL_FEINT = new Map(Object.values(TRADITIONS).flatMap((T) => (T.unique ?? []).filter((u) => u.feint && SPECIALS.has(u.name)).map((u) => [u.feint.name, u.name])));
/** 패시브 P 가 특수 공격의 AI 몫이면 그 이름 (같은 이름 · 그 기술 · 그 속임) — 아니면 null */
const passiveSpecial = (P) => (SPECIALS.has(P.name) ? P.name : [].concat(P.do?.tech ?? []).find((n) => SPECIALS.has(n)) ?? (P.do?.feint ? SPECIAL_FEINT.get(P.do.feint) ?? null : null));
const STEP_T = 0.3; // 기술 걸음 'strike'(유파 고유 동작 step 칸): 닿는 거리여도 내딛는 시간 (보통 내딛기의 최대와 같다)
// 느긋한 틈 (startAttack why): 빈틈을 보고 골라 든 공격 — 준비 자세를 보통 빠르기로 잡는다. 나머지 why(recover · press · stepin · counter · riposte · shove · stop · windup · follow · finish · 패시브 까닭 …)는
//  빠른 틈(this.quick — 그 순간을 놓치지 않게 빠르게 친다). 풍차 베기 AI 몫(10/31 13:4x — rdSkipWhy)도 같은 셈으로 빠른 틈을 가른다
const SLOW_WHY = new Set(['patience', 'open', 'weak', 'offbalance', 'drill']);
// 무기별 간격 실측표(MEASURED)는 weapon_measured.js 한 곳에 있다 (10/8 ① 구조 — 전엔 이 파일과 schools.js MEASURES 두 벌).
//  간격을 무기에 맞춰 늘이고 줄이는 일은 sword_art.js 가 한다. 옛 이름 MEASURED 는 여기서도 그대로 내보낸다 —
//  도구(proto_weapons·r2p_ai_*·shove_check)가 이 이름으로 읽고 고쳐 쓴다(같은 객체)
export { MEASURED };

// 감정 판정(Emotions)·텀 상수·고유 능력 배율표는 emotions.js 에 (플레이어와 같은 규칙)
const COVER_LINES = ['highL', 'highR', 'highC', 'lowL', 'lowR']; // coverFor 가 돌려주는 막기 줄 (withdraw — coverLine)

export class AI {
  /**
   * persona: 캐릭터마다 다른 개성을 주입한다 (characters.js). 안 주면(undefined) 예전과 똑같은
   * 무작위 성격의 "기본 AI"가 된다 (fights12.mjs 회귀 기준이 그대로 재현되도록, 값을 주지 않은
   * 항목은 전부 예전과 같은 rand() 호출로 채운다).
   *  persona.school: 유파 꾸러미 id (schools.js). 자세·기술·속임수·막기 자세·간격 상수를 여기서 읽는다. 안 주면 롱소드
   *  persona.level:  AI_LEVELS(난이도) 위에 덮어씌우는 값 (reaction·guardChance·counter·feint·read·strength 등)
   *  persona.proficiency: 숙련도 0~5 (10/13 — characters.js 가 { 유파: 숙련도 } 로 채운다, 숫자면 손에 든 무기 유파의 값). 손에 든 유파의 고유 동작 가운데
   *                  단계 ≤ 숙련도인 것만 쓰고, 비기는 5 에서만. 없으면 난이도 이름에서(AI_PROFICIENCY.ofLevel — normal = 2). levelName 은 실력 숫자 이름 그대로(인물은 숙련도에서 고른 것)
   *  persona.pers:   성격(this.pers) 위에 덮어씌우는 값. guardPref/techPref는 자세·기술 이름별로 부분 지정 가능
   */
  constructor(me, foe, levelName = 'normal', persona = null) {
    this.me = me;
    me.stamina.controller = this; // 공통 기력 장부의 방어 상태
    this.foe = foe;
    this.sense = new Senses(me, foe);
    me.aiCtl = this; // 강화동작 이점(10/21 — unique_assist.js strokeTechOf): 맞는 순간 지금 기술 이름을 읽는다 · 읽기만
    me.aiControlled = true; // 유파 걸음(gait.js gaitParams): AI 가 모는 몸은 플레이어 완화 값(gait.player)을 받지 않는다 — 읽기 표시일 뿐
    this.persona = persona || {};
    // 근접 밀치기 (closeQuarters): persona.close 가 있는 인물만 스틱으로 민다. 기본 AI 는 밀지 않는다 (fights12·live_battery 그대로)
    if (this.persona.close) me.canShove = true;
    // 권총 사격 사이 쿨타임 배율을 인물이 따로 줄 때만 (persona.gunCooldownK — 지금 주는 인물 없음). 없으면 AI 권총 핸디캡 GUN.aiHandicapK 1.5(10/30 01:4x — 전 마야 시트 값)
    if (this.persona.gunCooldownK) me.gunCooldownK = this.persona.gunCooldownK;
    if (this.persona.close?.kind === 'kick') me.closeStepKind = 'pass'; // 랴오 발차기 = 뒷발이 지나 딛는 몸 부딪기 (발차기 명령·발 충돌이 없다)
    this.closeWant = false; // 밀기로 정함 (사건마다 한 번 rate 굴림)
    this.closeBind = false; // 칼이 맞물려 있나 (checkBind 와 같은 기하, 읽기만)
    this.closeIn = false; // 지난 스텝에 닿는 거리 안이었나 (E1 들어섬)
    this.closeInside = false; // 이번 스텝 닿는 거리 안 (moveFeet 스틱 덮어쓰기)
    this.closeWasBarge = false;
    this.closeShoves = 0; // 지난 스텝까지 본 me.shoves (같은 스텝에 발사·거절된 것도 끝으로 읽는다)
    this.closeEv = { E1: 0, E2: 0, E4: 0, won: 0, cut: 0 }; // 굴린 사건 수·이긴 수·이어 벤 수 (재기용)
    // 검술 풀이 (sword_art.js resolveSwordArt — 10/8 ① 구조: 전엔 이 자리에서 schoolOf + libSchool + 간격 늘이고 줄이기를 따로 했다. 값은 그대로):
    //  유파 꾸러미 = 인물이 고른 것(persona.school, 없으면 롱소드 = 독일) + 동작 라이브러리(본판 10/8)의 몸 틀·방식 기술 가중치·새 기술·속임수·간 보는 자세(끄면 그대로).
    //  간격 상수 (가슴과 가슴 사이 수평 거리, m): 꾸러미 measure 는 그 꾸러미를 잰 무기(대부분 롱소드)의 값이라, 칼이 그보다 짧거나 길면
    //  실측 비율만큼 줄이거나 늘린다 — 안 그러면 짧은 칼을 쥔 쪽이 롱소드 간격에서 공격을 걸었다가 정작 닿지도 못하고 상대 롱소드에만 맞는다
    //  (무기 밸런스 시뮬로 확인한 근본 원인). 인물 꾸러미(청강검·나뭇가지·복제품)는 measure 가 이미 그 무기 실측이라 같은 무기면 1배 그대로
    //  숙련도 (10/13): 손에 든 유파의 고유 동작은 단계 ≤ 숙련도인 것만 꾸러미에 (sword_art.js applySchoolArt) · 비기는 숙련도 5 에서만 (아래 this.secret)
    const art = resolveSwordArt(me.weapon, this.persona, { proficiency: this.persona.proficiency ?? AI_PROFICIENCY.ofLevel[levelName] ?? AI_PROFICIENCY.ofLevel.normal });
    this.art = art;
    this.proficiency = art.proficiency;
    me.wristK = schoolPassiveOn('iberian') && art.tradition === 'iberian' && this.proficiency >= SCHOOL_PASSIVE.at ? SCHOOL_PASSIVE.iberian.wrist : 1; // 유파 패시브 손목 힘 (10/21 — 4급 책 = 숙련도 at 이상)
    me.schoolPassive?.set(this.proficiency >= SCHOOL_PASSIVE.at ? art.tradition : null, { ai: true }); // 나머지 넷 (10/21 — 이탈리아 · 일본 · 독일 · 동방, school_passive.js · AI 몫 aiK)
    this.school = art.school;
    // 유파 막기 자리 몸꼴 (10/11 — schools.js TRADITIONS[유파].parryCover, 중국 · 독일 왕관 10/12): 막는 동안(mode 'defend', 피하기 아님)만 그 줄의 막기 자세로 손·칼끝·몸을 덮는다.
    //  14 자리 섞기에 넣으면 그 자리를 지나는 베기 길이 휘고 원전 꼴(가로 든 칼)이 섞여 사라져서 덧씌우기로 둔다(frames.js COVERS 와 같은 까닭). 칸 없는 유파는 아무것도 안 붙인다(바이트 그대로)
    const pc = TRADITIONS[art.tradition]?.parryCover;
    if (pc) installCover(me, this, pc);
    const baseM = this.school.measure;
    this.M = art.measure;
    // 10/8 17:00 (c): 이 몸이 R2′ 묶음(몸의 호)을 쓰면 칼이 더 멀리·일찍 지나가 간격을 BODY.r2pAiContact 만큼 당긴다(72 판 'all': contact 1.57 → 1.52 가 E 승 14 → 27, P 28 → 33). 묶음 없는 AI(기본 'player' 범위의 상대)엔 0 — 바이트 동일
    if (BODY.r2pScope === 'all' && BODY.trunkArc > 0 && BODY.r2pAiContact) this.M = { ...this.M, contact: this.M.contact + BODY.r2pAiContact }; // 'player' 범위에선 시뮬의 AI 조종 P 에도 안 걸어 기준 sha 를 지킨다
    // 상대 칼 길이로도 따로 잰다: foeReach(아래)는 "내가 아니라 상대가" 닿는 거리를 어림하는 값이라, 내
    // 무기가 아니라 상대 무기 기준으로 스케일해야 한다 (짧은 칼을 든 쪽이 상대의 롱소드 간격을 실제보다
    // 가깝게 어림해 그대로 걸어 들어가는 일을 막는다)
    this.foeM = art.measureFor(foe.weapon);
    // TECH[].reach(기술마다 다른 "이 기술은 기본 간격보다 얼마나 더/덜 닿는가" 보정)도 롱소드로 잰
    // 값이라, 짧은 칼은 이 보정을 그대로 더하면 실제보다 더 닿는다고 착각한다(무기 PM 인수인계 문서
    // docs/weapons.md §5에 남아 있던 미해결 항목) — M.contact와 같은 비율로 같이 줄인다.
    // 무기 스펙에 techReachScale을 직접 정해 뒀으면 그 값을 그대로 쓴다 — 팔쉬온처럼 이 비율 그대로
    // 줄이면 다가서는 시간 계산이 너무 빡빡해져(공격을 걸다가 자꾸 시간 안에 못 붙어 물러서기만
    // 반복하는) 무기가 있어, 그런 무기만 따로 눅여 줄 수 있게 한다(무기 밸런스 시뮬로 확인).
    this.reachScale = !me.weapon || me.weapon.id === 'longsword' ? 1 : (me.weapon.techReachScale ?? this.M.contact / baseM.contact);
    this.setLevel(levelName);
    // 성격: 사람마다 다르다 (같은 난이도라도 판마다 다른 검객). persona가 정해 둔 값이 있으면 그대로 쓴다
    const P = this.persona.pers || {};
    // 유파 기질 (10/9 — schools.js *_TEMPER, docs/strike/school_temper_2026-10-09.md): 성격 칸의 기본 범위를 유파마다 둔다.
    //  [lo, hi] 면 rand 한 번, 숫자면 그대로. 유파에 없는 칸은 예전 기본값. 인물 값(P)이 늘 먼저 — 그때는 예전처럼 굴리지 않는다.
    //  rand 호출 차례는 예전 그대로(margin → aggr → circleDir → circleRate → rhythm → vor → patienceTime) → 독일·무유파 바이트 동일
    const TP = TRADITIONS[this.art.tradition]?.temper ?? {};
    const draw = (v) => (Array.isArray(v) ? rand(v[0], v[1]) : v);
    const guardPref = {};
    for (const g of this.school.guards) guardPref[g.name] = P.guardPref && g.name in P.guardPref ? P.guardPref[g.name] : rand(0.4, 1.6);
    const techPref = {};
    for (const t of this.school.tech) techPref[t.name] = P.techPref && t.name in P.techPref ? P.techPref[t.name] : rand(0.6, 1.4);
    this.pers = {
      margin: P.margin ?? draw(TP.margin ?? [0.2, 0.5]), // 간격 밖에 얼마나 여유를 두고 서는지 (m)
      aggr: P.aggr ?? draw(TP.aggr ?? [0.85, 1.2]), // 공격 성향
      circleDir: P.circleDir ?? (Math.random() < 0.5 ? -1 : 1), // 즐겨 도는 방향
      circleRate: P.circleRate ?? draw(TP.circleRate ?? [0.15, 0.4]), // 옆걸음 빠르기 (천천히: 빙빙 도는 춤이 되지 않게)
      rhythm: P.rhythm ?? draw(TP.rhythm ?? [2.4, 4.5]), // 자세를 바꾸는 박자 (초). 검객은 한 자세를 차분히 지킨다 (자주 바꾸면 춤추는 것처럼 보인다)
      vor: P.vor ?? draw(TP.vor ?? [0.15, 0.6]), // 달려드는 상대를 맞받아 베는 쪽(1)인가, 물러나 헛치게 하는 쪽(0)인가
      patienceTime: P.patienceTime ?? draw(TP.patienceTime ?? [7, 12]), // 인내심이 바닥나는 데 걸리는 시간 (초)
      // 자세 옮기기 버릇: 새 자세가 지금 자세에서 멀수록 이 값만큼 무겁게 깎인다.
      //  크면(예: 5) 가까운 자세만 고집하는 신중한 검객, 작으면(예: 0.5) 먼 자세로도 서슴없이 뛰는 변덕스러운 검객
      guardStick: P.guardStick ?? draw(TP.guardStick ?? 2.5),
      guardSpeed: P.guardSpeed ?? draw(TP.guardSpeed ?? 0.9), // 간 보는 동안 자세를 잡는 손 빠르기 (m/s): 크면 자세를 휙휙 바꾸는 사람, 작으면 느긋한 사람
      // 베기의 정확도 (0~1): 1이면 기술의 길을 그대로 긋는다(머리·목에 닿는다). 낮을수록 한 번 벨 때마다 손이 옆·위아래로
      //  빗나가(최대 ±0.2·(1−정확도) m) 팔·다리에 걸리거나 칼 면으로 때린다 — "절대 실력" 축
      precision: P.precision ?? 1,
      // 감정 문턱값: 이 인물이 공포에 얼마나 잘 빠지는가 (0 = 전혀, 1 = 한 번 베이면 바로 겁먹는다).
      //  0이면 감정층이 아예 꺼진 것과 같다 (기본 AI는 0 → 예전과 완전히 같이 움직인다)
      fearful: P.fearful ?? 0,
      angry: P.angry ?? 0, // 분노에 얼마나 잘 빠지는가 (연달아 막히면, 이기다 맞으면)
      dogged: P.dogged ?? 0, // 집념 (상대가 피 흘리면, 방금 맞혔으면 물고 늘어진다)
      guardPref,
      techPref,
    };
    // 감정 셋 (공포·분노·집념): 지배 감정 하나 + 세기 0~1 + 시간 감쇠 — 자세히는 emote() 참고.
    //  판정(사건·세기·감쇠·지배·텀·무기 사건 한 번만·막힌 시각)은 emotions.js Emotions 한 곳이 한다 (플레이어와 같은 규칙).
    //  문턱값은 this.pers 를 그대로 읽는다. this.emo(세기)·this.emotion(지배 감정)은 그 판정의 값이다
    this.emoCore = new Emotions();
    this.emoCore.th = this.pers;
    this.emo = this.emoCore.E;
    this.emoEv = { hurt: false, bleeding: false, nearMiss: false, weaponBroken: false, disarmed: false, foeLegendNear: false, foeBroke: false, parried: false, winning: false, foeBleeding: false, landed: false }; // 이번 스텝 사건 (emote 가 채운다)
    this.anger = 0; // 검술에 실제로 걸리는 분노 세기 (분노가 지배 감정일 때만 > 0)
    this.obsession = 0; // 검술에 실제로 걸리는 집념 세기 (집념이 지배 감정일 때만 > 0)
    this.fear = 0; // 검술에 실제로 쓰는 공포 세기 (다른 감정이 지배하면 0)
    // 시작 감정 (캐릭터 시트 persona.startEmotion, 예: { anger: 0.7 }): 서사대로 결투를 그 감정에 잠긴 채 시작한다.
    //  세기는 그대로 emote()의 감쇠·지배 규칙을 따른다(사건이 없으면 사그라든다). 기본 AI에는 없어 예전과 같다
    const SE = this.persona.startEmotion;
    if (SE) {
      const order = ['fear', 'anger', 'obsession'];
      for (const k of order) if (SE[k] > 0) this.emo[k] = Math.min(1, SE[k]);
      const dom = order.find((k) => this.emo[k] > 0.3);
      if (dom) {
        this.emotion = dom;
        this.fear = dom === 'fear' ? this.emo.fear : 0;
        this.anger = dom === 'anger' ? this.emo.anger : 0;
        this.obsession = dom === 'obsession' ? this.emo.obsession : 0;
        this.me.emoMods = emoMods(dom, this.emo[dom]);
        if (dom === 'anger') this.patience = Math.min(this.patience, 0.2); // 발끈한 채 시작: 참을성이 바닥나 있다
      }
    }
    this.evParried = false; // 이번 스텝에 생긴 사건들 (afterStrike가 켜고 emote가 끈다)
    this.evLanded = false;
    this.tremor = new THREE.Vector2(); // 공포 떨림: 손 위치에 얹는 잔떨림 (보이는 신호)
    this.tremorApplied = new THREE.Vector2(); // 지금 손 위치에 실제로 얹혀 있는 떨림 (누적되지 않게 차이만 더한다)
    this.tremorT = 0;
    this.mode = 'watch'; // watch(간 보기) | attack | defend | withdraw(물러나기)
    this.phase = 'ready'; // attack 안의 단계: windup(준비 자세) | approach(다가감) | strike | follow
    this.hand = new THREE.Vector2(0.12, -0.18); // 손 목표 (패드)
    this.handSpeed = 1.2;
    this.path = []; // 베는 동안 손이 지나갈 점들
    this.guard = null; // 간 볼 때의 자세
    this.guardTimer = realS(rand(0.3, 1.0));
    this.patience = rand(0.55, 0.85); // 처음엔 조금 간을 보다가 들어간다
    this.foeReach = this.foeM.reach + 0.05; // 상대 칼이 닿는 거리 추정 (생각보다 멀리서 맞으면 늘린다)
    this.decideTimer = 0;
    this.timer = 0;
    this.attackT = 0;
    this.shuffle = 0;
    this.shuffleTimer = 0;
    this.circle = 0;
    this.circleTimer = realS(rand(0.5, 1.5));
    this.threatId = 0; // 상대 공격 번호 (한 공격에 한 번만 판단)
    this.threatSeen = -1;
    this.readRollId = -1; // '위험을 알아챘나' 판단도 한 공격에 한 번만 굴린다 (매 스텝 다시 굴리면 사실상 항상 알아채게 된다)
    this.readRollOk = false;
    this.preArmed = true; // "치려는 낌새"에 새로 반응할 수 있나 (한 번 몰아칠 때 한 번만 판단)
    this.preOff = 1;
    this.noThreat = 1; // 위험이 없던 시간
    this.prevFoePain = foe.pain;
    this.prevMyPain = me.pain;
    this.hitLanded = false;
    this.bound = false;
    this.feint = null;
    this.feintPts = 0;
    this.feintHold = 0;
    this.chain = 0;
    this.stepT = 0; // 베며 내딛는 남은 시간
    this.stepDelay = 0;
    this.foeParried = 0; // 상대가 내 공격을 칼로 막은 횟수 (많을수록 속임수를 쓴다)
    this.d = 3;
    this.foeClosing = 0;
    this.foeAggro = 0; // 상대가 얼마나 몰아치는 사람인가 (0~1, 최근 몇 초)
    this.seizeT = 0;
    this.myClosing = 0;
    this.foeLat = 0;
    this.cautious = false;
    this.desperate = false;
    this.stats = { attacks: 0, feints: 0, parries: 0, voids: 0, counters: 0, preempts: 0, followUps: 0, landed: 0, aborted: 0 };
    // 패시브 고유 동작 (10/9, docs/strike/school_passive_2026-10-09.md): 이 유파의 passives 가운데 ai:false 아닌 것 (SKILL.schoolArt 1 일 때 — 유파 자료).
    //  독일 셋은 ai:false → 롱소드 AI 는 빈 목록 → 아래 모든 자리에서 난수도 코드 길도 전과 같다. 도구(motion_lab)는 이 목록을 갈아 끼워 잰다
    //  숙련도 (10/13): 단계 표에 이름이 있는 패시브(동방 자→격 ciji — yaoji 이음, 4 단계)는 단계 ≤ 숙련도일 때만. 그 밖의 패시브는 그대로
    const ST = aiUniqueStages(art.tradition);
    const open = (map, name) => !map.has(name) || map.get(name) <= this.proficiency;
    this.passives = SKILL.schoolArt ? (TRADITIONS[art.tradition]?.passives ?? []).filter((x) => x.ai !== false && open(ST.passive, x.name)) : [];
    this.passiveAtk = null; // 지금 공격을 시작한 패시브 이름 (startAttack 이 지운다)
    this.pendingPassive = null; // 물러남 끝에 낼 패시브 (斂翅 꼴 at:'end')
    this.stepinArmed = true; // foeStepIn: 상대가 걸어 드는 한 번에 한 번만 굴린다
    // 기술 알림 (10/9 — 사장님 '패시브가 발동될 때 알아차릴 수 있게 … 화면 중앙에 기술명', docs/strike/tech_cue_2026-10-09.md):
    //  이 유파 고유 동작(길·속임수) 이름 표 — 꾸러미에 실제로 들어간 것(SKILL.schoolArt 켬 · ai:false 아님)만. 읽기만 하고 결정에는 안 쓴다(난수 없음)
    const SBo = me.weapon?.secretBlade?.open ? me.weapon.secretBlade.tech : null; // 무기 비검이 여는 기술 (10/21 — 숙련도와 상관없이)
    const UQ = SKILL.schoolArt ? (TRADITIONS[art.tradition]?.unique ?? []).filter((u) => u.ai !== false && !u.counter && !ST.retired.has(u.name) && (open(ST.unique, u.name) || u.name === SBo)) : []; // 숙련도로 뺀 것 · 통폐합으로 뺀 것(10/21)은 꾸러미에 없다
    this.uniqueByName = new Map(UQ.map((u) => [u.feint ? u.feint.name : u.name, u]));
    this.cavDeep = UQ.some((u) => u.name === 'cavazione'); // 칼끝 돌려 빼기가 꾸러미에 듦 (숙련도 ≥ 단계) — 심화 · 헛누름 AI 몫 (10/31)
    this.standoffArmed = true; // standoff: 대치 한 번에 한 번만 굴린다
    // 유파 비기 (10/9 유파 설계 v3 — schools.js *_SECRET, docs/strike/school_secret_2026-10-09.md): 이 유파의 비기 하나 (SKILL.schoolArt·schoolSecret 일 때).
    //  굴림이 없다 — 조건이 차면 확정. 무유파는 null → 아래 비기 자리들은 난수도 코드 길도 전과 같다
    //  숙련도 (사장님 결정 10/13 23:1x 'AI는 숙련도 5만 비기 씀'): 손에 든 유파의 숙련도가 AI_PROFICIENCY.secretAt(5) 아래면 null — 무유파처럼 비기 자리들이 전 코드 그대로 지나간다
    //  10/24 사장님 12:0x 'ai도 비기 쓰게 해': 유파에 AI 몫(aiSecret — 독일 모르트슐라크, schools.js)이 있으면 그것 · 없으면 secret 그대로
    const TR = TRADITIONS[art.tradition];
    this.secret = SKILL.schoolArt && SKILL.schoolSecret && this.proficiency >= AI_PROFICIENCY.secretAt && SECRET.aiOpenSchools.includes(art.tradition) ? (TR?.aiSecret ?? TR?.secret) ?? null : null; // 10/21 닫힌 유파 비기 없음 · 10/22 AI 는 따로 (config SECRET.aiOpenSchools — 사람 먼저)
    this.secretRun = null; // 지금 내는 비기 { S, stage, t, landed, … } (null = 없음)
    this.specCool = {}; // 특수 공격 AI 몫마다 식힘을 세기 시작한 때 (sense.t · 도는 동안 Infinity — 10/29 19:4x 사람과 같게)
    this.specRun = null; // 나갔는데 아직 안 끝난 특수 공격 { name, seq, t0, motion } (specTick)
    this.atkSeq = 0; // 공격(startAttack)마다 하나씩 — 이어 치기 · 흐름도 새 수 (특수 공격이 끝났나 보는 데만)
    this.secretEv = { armed: true, off: 0 }; // 상대 사건(threat·foeRaise·foeCharge·foeRecover) 한 번에 한 번 — 사건이 0.3 s 그치면 다시 건다
    this.combo = 0; // 끊기지 않은 내 베기 수 (이베리아 옛 비기 조건 — 공격 꼴을 벗어나면 0)
    this.iaiArm = this.secret?.do?.instant ? new IaiArm() : null; // 일본 발도 대기 (10/10 02:4x — 상대 간격 밖 iaiArmTime 초 · 10/25 22:3x 부터 거리와 상관없이 침착하게 iaiArmTime 초 — secret.js gnsArmTick)
    this.gilArm = this.secret?.do?.gilmok ? new IaiArm('gilmokArmTime', 'gilmokArmGrace') : null; // 이베리아 길목 지키기 준비 (10/11 v6 — 내 칼끝 거리 밖 gilmokArmTime 초, 같은 셈)
    this.spinArm = this.secret?.do?.spin ? new IaiArm('armTime', 'armGrace', 'ibSpin') : null; // 싱지르 무장 (10/24 사장님 '싱지르 ai에게도 열어' — 사람 PlayerSecretWatch.spinArm 과 같은 셈 · 내 칼끝 거리 밖 SECRET.ibSpin.armTime 초)
    this.spinW = 0; // 무장 동안 상처 셈 (SECRET.ibSpin.hurtDisarm — 사람과 같은 규칙)
    this.press = this.secret?.when === 'press' ? { win: 0, wins: 0, go: false, goBarge: false, goes: 0, inClinch: false } : null; // 모르트슐라크 누르기 셈 · 창 (10/24 'ai도 비기 쓰게 해' — 사람 PlayerSecretWatch.pressTick 과 같은 셈 secret.js pressStep · win = 창 남은 초 · wins = 연 창 수)
    this.binds = this.secret?.when === 'bindCount' ? new BindCount() : null; // 이베리아 맺힘 셈 (10/10 — secret.js, 플레이어 창과 같은 셈)
    this.lastAtkT = -Infinity; // 마지막으로 공격 꼴이던 때 (중국 chineseRest)
    this.restBefore = Infinity; // 이번 공격을 시작하기 전 내 공격 없이 지난 시간 (s)
    this.defBindSeen = false; // bindDef: 한 번 막는 동안 처음 맞닿음에만
    // 시험: 헛스윙 연습 상대 (src/whiff_drill.js — ?foeWhiff=1 일 때만 main.js 가 판마다 붙인다). null 이면 아래 drill 자리는 아무 일도 안 한다(바이트 그대로)
    this.drill = null;
    this.drillOut = false; // 이번 스텝 헛스윙을 하나 (updateCombat — drill 이 있을 때만 켜짐)
    this.drillAtk = false; // 지금 공격이 헛스윙 공격인가 (startAttack 이 공격마다 정함)
    this.guard = this.pickGuard(null);
  }

  setLevel(name) {
    this.levelName = AI_LEVELS[name] ? name : 'normal';
    const base = AI_LEVELS[this.levelName];
    // persona.level: 반응 시간·막기 확률·읽는 눈·힘 같은 "실력 숫자"를 난이도 기본값 위에 캐릭터별로 덮어쓴다
    const PL = this.persona?.level;
    this.level = PL ? { ...base, ...PL } : base;
    const RX = AI_PROFICIENCY.reaction; // AI 반응 시간은 숙련도로 (10/21 — 인물 시트 · 이름 값보다 이김)
    if (RX) this.level = { ...this.level, reaction: RX[Math.max(0, Math.min(RX.length - 1, Math.round(this.proficiency ?? 2)))] };
    this.me.strength = this.level.strength;
    this.me.skill.level = this.level.skill;
    this.me.skill.corr = SKILL.corrAI; // AI 보정 방식 (사장님 9/30 23:40: 사람이 먼저, AI 는 옛 보정)
    this.me.skill.corrTip = false; // AI 는 끝점 겨눔 ② 없음 (손 뗌 사건이 없고 속임을 망친다, 설계 AI 절)
  }

  /** 상대가 칼을 놓쳤다(또는 붙어 싸울 수 없는 권총을 들었다): 간격을 지킬 까닭이 없다 → 쫓아가 끝낸다 (도망치는 상대를 놓치지 않게) */
  get chasing() {
    return this.foe.alive && (!this.foe.armed || !!this.foe.weapon?.gun) && this.me.armed;
  }

  /** 지금 공격 동작 중인가 (평가·디버그용) */
  get attacking() {
    return this.mode === 'attack';
  }

  /**
   * 마른 길 감각의 세기 (0 = 꺼짐 — config.js DRYPATH, 사장님 10/14 18:3x): 인물 표식 persona.terrainSense 'wetland'(라트나)이고
   *  이 몸이 진흙 감속을 받는 무대(movementSurface 'wetland' — 잠든 습지, main.js 가 판마다 붙인다)일 때만 숙련도별 세기. 둘 중 하나라도 아니면 0 —
   *  그때는 아래 dry* 자리를 하나도 타지 않아 옛 길이 바이트 그대로다. 판 도중 무대를 바꿔도(game.setStage) 매 스텝 다시 읽는다
   */
  get drySense() {
    return this.persona.terrainSense === 'wetland' && this.me.movementSurface === 'wetland' ? DRYPATH.power[this.proficiency] ?? 0 : 0;
  }

  // ───────────────────────── 매 스텝 ─────────────────────────
  /** 매 스텝: 싸움 판단(updateCombat) 뒤에 무대 장애물 돌아가기 · 화산섬 용암 피하기 — 스틱 입력의 방향만 바꾼다 (샛별 저장소 325a5c38 · 0116047c 의 줄을 옮김).
   *  마른 길(drySense > 0 — 라트나 · 잠든 습지만)이면 돌아갈 쪽을 덜 젖은 쪽으로 미리 고르고(dryRouteSide), 돌아가기까지 끝난 스틱을 덜 젖은 쪽으로 튼다(dryFeet).
   *  둘 다 자기 무대에서만 일한다(습지 · 화산섬은 함께 나오지 않음) — 용암 피하기를 마지막에 둬 안전 쪽이 이긴다 */
  update(dt) {
    this.specTick(); // 나간 특수 공격이 끝났나 (식힘은 끝난 때부터 — 10/29 19:4x · 19:5x 사람과 같게)
    if (this.rd || this.me.rdWind) this.rdKeep(dt); // 풍차 베기 AI 몫 (10/31): 감기 지킴 · 덧씌우기 칸 내려놓기 · 뗀 밧줄 다시
    if (this.secret && !this.secretRun && secretSpent(this.me)) this.dropSecret(); // 이 판 비기를 다 씀 (10/29 19:5x 판당 쓸 수 — 비기 없는 AI 와 같은 길)
    // 동방 AI 걸음 박자 (10/15 — GAIT.cnLightAi · docs/strike/cn_light_feet_2026-10-15.md §7): 가벼운 발 몸(유파 걸음 칸 light)의 AI 는 공격 꼴(준비·다가가기·벰·뒤따름)일 때만 가벼운 발 —
    //  간 보기·막기·물러남(비기 꼴 포함)의 발놀림 박자(간격 비례 제어·잔걸음·'관성으로 너무 멀리 가지 않게' 늦추는 물러남)는 옛 가속(3.2 m/s²) 몸에 맞춘 값이라 그 꼴에서는 옛 가속으로 민다
    //  (fighter.js driveBalance 가 읽음 — 지난 스텝의 꼴 · 칸 없는 몸은 어차피 × 1). 끄면(0) 늘 false(사람·AI 같이 — 지금 판, 바이트 같음). 사람은 AI 가 없어 그대로
    this.me.aiLightHold = GAIT.cnLightAi ? this.mode !== 'attack' : false;
    // 기력 탈진 (샛별 저장소 6ac1070d — docs/strike/stamina_import_2026-10-15.md): 2.5 s 제자리 숨 고르기 — 비기·공격·막기·걸음 의도를 모두 거두고 스틱 0 (몸은 물리대로 · 균형 디딤 그대로). 기력 끔이면 늘 거짓
    if (this.me.stamina.exhausted) {
      if (this.secretRun) this.secretAbort();
      this.mode = 'watch'; this.phase = 'ready'; this.path.length = 0;
      this.defLine = this.coverLine = null;
      this.pendingPassive = null;
      this.me.secretStiff = false;
      this.me.move.set(0, 0); this.me.stickX = this.me.stickY = 0;
      this.techPlanStep(dt);
      return;
    }
    this.updateCombat(dt);
    this.techPlanStep(dt); // 기술 길 덧칸 (10/25 곁눈 베기 다시 그린 길 — 덧칸 없는 기술이면 아무것도 안 함)
    const ds = this.drySense;
    if (ds) this.dryRouteSide(ds);
    routeAroundStageObstacle(this);
    if (ds) this.dryFeet(ds);
    avoidEtnaLava(this);
  }

  updateCombat(dt) {
    const me = this.me;
    const foe = this.foe;
    this.sense.record(dt);
    me.secretActing = !!this.secretRun && this.secretRun.stage !== 'stiff' && this.secretRun.stage !== 'spin' && this.secretRun.stage !== 'mord'; // 비기 실행 중(경직 빼고) — fighter.secretReaching: 그동안 칼 팔이 끝까지 펴짐 (SECRET.secretReach, 10/12) · 싱지르 · 모르트슐라크는 사람과 같게(검술 층이 팔을 쥠 — 10/24)
    this.coverLine = null; // 물러나며 가리는 줄 (withdraw 가 그 스텝에 정함 — frames.js installCover 의 watch 덮개가 읽음, 10/12 왕관)
    const L = this.level;
    // 패시브 확정(10/9 13:xx, docs/strike/passive_fire_2026-10-09.md): 패시브가 낸 공격의 걸쇠(0.5 s)와 미룬 패시브의 남은 시간을 줄인다
    if (this.passiveLock && (this.passiveLock.left -= dt) <= 0) this.passiveLock = null;
    if (this.pendingPassive?.left != null && (this.pendingPassive.left -= dt) <= 0) this.pendingPassive = null;
    // 물러남 끝까지 미룬 것(left null)인데 물러남이 끊겼으면(막기·피하기로 꼴이 바뀜) 그때부터 0.5 s 만 남긴다 — 끝없이 남아 한참 뒤 공격 기회를 가로채지 않게
    if (this.pendingPassive && this.pendingPassive.left == null && this.mode !== 'withdraw') this.pendingPassive.left = LOCK_T;

    // 부활하는 동안(revive.js): 싸우지 않고 기다린다. 끝나면 집념으로 다시 싸운다
    if (me.revival) {
      this.closeWant = this.closeBind = false;
      return this.holdForRevive(dt);
    }
    if (this.reviving) this.resumeAfterRevive();
    // 판 시작 정지(ARENA.startHold, 사장님 9/30): 발은 묶인 채 캐릭터마다 서 있는 모습(persona.idle)만 보인다.
    //  시트에 idle이 없는 기본 AI는 이 분기를 타지 않는다 (예전과 같다)
    if (me.feetHeld && this.persona?.idle && me.state === 'stand') {
      this.closeWant = this.closeBind = false;
      return this.holdStart(dt);
    }

    // 완전히 쓰러졌다: 칼을 머리 위로 들어 가리기만 한다 (팔에도 힘이 거의 없다)
    if (me.state === 'down') {
      this.closeWant = this.closeBind = false;
      me.move.set(0, 0);
      this.mode = 'withdraw';
      this.phase = 'ready';
      this.timer = realS(0.9);
      this.path.length = 0;
      this.pendingPassive = null;
      if (this.secretRun) this.secretAbort(); // 쓰러지면 비기도 끝
      this.hand.set(this.school.pose.cover[0], this.school.pose.cover[1]);
      this.handSpeed = 1.4;
      this.prevFoePain = foe.pain;
      this.prevMyPain = me.pain;
      this.moveHand(dt);
      return;
    }
    // 무릎 꿇었거나 일어나는 중: 다리는 못 놀리지만 칼은 쥘 수 있다 → 가만히 가리고만 있지 않고,
    //  사정거리 안까지 다가온 적은 아래에서도 위협하거나 짧게 친다 (발놀림은 아래에서 0으로 막는다)
    const kneeling = me.state !== 'stand';
    if (STAMINA.on) {
      const limit = this.restAt; // 공격적 기질 −10 · 아니면 20 (아래 aggressiveTemper)
      if (me.stamina.value < limit) this.staminaRest = true;
      else if (me.stamina.value >= STAMINA.aiResumeAt) this.staminaRest = false;
      if (this.staminaRest && this.mode === 'watch') this.startWithdraw(0.8, this.school.withdraw.calm[0]);
    } else this.staminaRest = false;

    // 칼을 놓쳤다: 빈손으로는 칠 수 없다 → 하던 공격을 거두고 간격 밖으로 물러난다 (좀비처럼 맨손으로 달려들지 않는다)
    if (!me.armed && this.mode === 'attack') this.startWithdraw(0.8);

    // 무기가 부러졌다(칼날 끝쪽이 떨어져 나감): 잃은 칼 길이만큼 간격을 줄인다 (한 번씩, shrinkM).
    //  내 칼 → 내 간격 M(쓰러진 상대용 원래 간격 Mup 포함)과 기술 닿는 거리 보정, 상대 칼 → 상대 간격 어림 foeM·foeReach.
    //  마무리 간격(finish.js 가 처음 한 번 정하는 me.finish.gap)도 같은 비율로 — 부러진 뒤에 처음 정해질 수도 있어 매번 본다
    if (me.weaponBroken && !this.brokeM) {
      this.brokeM = brokenLoss(me);
      this.M = shrinkM(this.M, this.brokeM);
      if (this.Mup) this.Mup = shrinkM(this.Mup, this.brokeM);
      this.reachScale *= this.M.contact / (this.M.contact + 0.85 * this.brokeM);
    }
    if (this.brokeM && me.finish?.gap && !me.finish.gap.broken) me.finish.gap = { ...shrinkM(me.finish.gap, this.brokeM), broken: true };
    if (foe.weaponBroken && !this.foeBrokeM) {
      this.foeBrokeM = brokenLoss(foe);
      this.foeM = shrinkM(this.foeM, this.foeBrokeM);
      this.foeReach = Math.min(this.foeReach, this.foeM.reach + 0.05);
    }

    // 쓰러진 상대: 서 있는 상대의 간격 대신 누운 몸을 내려칠 간격(finish.js FINISH.ai × 무기 배율, 파이터의 finish.gap)을 쓴다
    //  (낮은 상대 진입 FINISH.entry 'low', 기본 끔: state 이름 대신 실제 몸 높이 — finish_entry.js)
    const downGap = (lowFinishOn(FINISH) ? lowFinishPosture(me, foe, lowFinishContinuing(me, foe)) : downLowTarget(FINISH, me, foe, lowFinishContinuing(me, foe))) && me.finish?.gap;
    if (downGap && !this.Mup) {
      this.Mup = this.M; // 서 있는 상대의 간격 (상대가 일어나면 되돌린다)
      this.M = { ...this.M, ...downGap };
    } else if (!downGap && this.Mup) {
      this.M = this.Mup;
      this.Mup = null;
    }

    // ── 보기 (반응 시간만큼 늦게) ──
    const s = this.sense.seen(L.reaction + realS(0.04) * this.anger); // 화나면 눈이 조금 늦다
    this.lastSeen = s; // 늦게 본 모습 (startStrike 의 crouchLow 가 읽음 — 10/27)
    // 약한 자세 겨눔 (FINISH.vital, 10/12 — vital_target.js): 늦게 본 모습을 기술 고르기·공격 준비가 읽고, 손 높이·칼 기울기 보정을 한 스텝 옮긴다
    if (FINISH.vital) {
      this.vitalS = s;
      aiVitalAdvance(this, dt);
    }
    const c = me.bodies.chest.translation();
    // 몸의 움직임은 사람도 앞질러 내다본다 (걸어오는 사람이 지금 어디쯤인지): 본 위치 + 속도 × 반응 시간.
    //  칼을 휘두르기 시작하는 것처럼 갑자기 바뀌는 움직임은 내다볼 수 없다 → 그건 늦게 본다
    //  (칼 없이 도망치는 사람은 곧게 달아날 뿐이라 누구나 앞질러 본다)
    const ahead = L.reaction * (this.chasing ? 1 : L.predict);
    const dx = s.cx + s.vx * ahead - c.x;
    const dz = s.cz + s.vz * ahead - c.z;
    const d = Math.max(0.01, Math.hypot(dx, dz));
    const ux = dx / d; // 나 → 상대 방향
    const uz = dz / d;
    this.d = d;
    this.foeClosing = -(s.vx * ux + s.vz * uz); // 상대가 나에게 다가오는 빠르기 (m/s)
    const mv = me.bodies.pelvis.linvel();
    this.myClosing = mv.x * ux + mv.z * uz; // 내가 상대에게 다가가는 빠르기
    const r = me.right(_v1);
    this.foeLat = dx * r.x + dz * r.z; // 상대가 내 오른쪽으로 비껴 선 정도
    if (me.weapon?.gun) return gunAI(this, dt); // 권총(??? 등급): 간격을 벌려 도망 다니며 쏜다 (gun.js)
    // 시험: 헛스윙 연습 (whiff_drill.js — 없으면 늘 false). 하는 동안은 드릴이 판단을 맡는다 — 미룬 패시브는 버린다(물러남 끝에 들어가 치지 않게)
    this.drillOut = !!this.drill && this.drill.out(this, d, dt);
    if (this.drillOut) this.pendingPassive = null;
    // 상대가 얼마나 몰아치는가: 다가오며 휘두르는 사람이면 곧장 벨 수 있는 자세(지붕·황소)로 기다린다
    const aggrNow = (this.foeClosing > 0.6 ? 0.6 : 0) + (Math.hypot(s.hvx, s.hvy) > 3 && d < this.foeReach + 0.6 ? 0.6 : 0);
    this.foeAggro += (Math.min(1, aggrNow) - this.foeAggro) * Math.min(1, dt / realS(2.5));

    // 맞혔나 / 맞았나 (움찔하는 것은 눈에 보이고, 맞은 것은 느낀다)
    if (foe.pain > this.prevFoePain + 0.05 && this.mode === 'attack') this.hitLanded = true;
    const hurt = me.pain > this.prevMyPain + 0.05;
    this.prevFoePain = foe.pain;
    this.prevMyPain = me.pain;
    if (hurt) {
      // 생각보다 멀리서 맞았으면 상대 칼이 더 멀리 닿는다고 고쳐 생각한다
      if (this.mode !== 'attack') this.foeReach = clamp(Math.max(this.foeReach, d + 0.1), this.foeM.reach, 2.5);
      if ((this.mode !== 'attack' || this.phase !== 'strike') && this.secretRun?.stage !== 'stiff' && this.secretRun?.stage !== 'instant' && this.secretRun?.stage !== 'spin' && this.secretRun?.stage !== 'mord') this.startWithdraw(0.8); // 순간 베기·발도 도중(instant)도 끊지 않는다 — 그 몇 스텝은 대본 // 비기 경직 동안은 물러나지도 못한다 (핸디캡)
    }
    this.foeReach += (this.foeM.reach + 0.05 - this.foeReach) * dt * realRate(0.03); // 천천히 원래 생각으로
    if (SECRET.gnsWary) this.gnsWatch(dt, d, hurt); // 고노센 경계 (10/25 08:0x 사장님 '⑤'): 상대가 고노센 쓰는 몸이 아니면 아무 일 없음 · 끄면 이 줄을 안 타 옛 판 그대로

    // 인내심: 시간이 지나면 줄어든다 → 판이 늘어지지 않는다
    const hurry = this.hurry();
    this.patience = Math.max(0, this.patience - (dt / realS(this.pers.patienceTime)) * L.aggression * this.pers.aggr * hurry); // 참을성 시간 patienceTime = 실제 초 (유파 기질 · 인물)

    // 상대 칼이 내 몸 쪽으로 오나
    const th = this.threat(s, c, r, d);
    this.noThreat = th ? 0 : this.noThreat + dt;
    this.emote(dt, hurt, !!th && d < this.M.clinch + 0.4);
    // 밀치는 중(me.barge)에도 모드 분기는 그대로 돈다: 베기·찌르기를 시작하면 'swing'·'thrust', 막으며 물러서면(defVoid)
    //  closeWant 가 풀려 스틱 0 → 'release' 로 끝난다 (버틴 상대에게 누르기가 끝없이 남지 않게. 새 숫자 없음)
    this.closeQuarters(s, d);
    // 유파 비기 (10/9): 끊기지 않은 베기 수는 공격 꼴을 벗어나면 0 · 비기가 아니면 서보 힘 창은 1 · 상대 사건 비기는 지금 모습(반응 지연 0)으로 본다 — 패시브보다 먼저
    if (this.mode !== 'attack') this.combo = 0;
    if (this.mode === 'attack') this.lastAtkT = this.sense.t;
    if (this.binds) {
      const bt = bladesTouch(me, foe);
      this.binds.tick(dt, bt);
      if (bt && this.mode === 'attack') this.atkClash = true; // 이 공격 동안 칼끼리 부딪힘 (맺힘 셈 — checkBind 의 기하보다 넓게, 실제 접촉도)
    }
    if (!this.secretRun && me.powerMul !== 1) me.powerMul = 1;
    if (!this.secretRun && me.secretHit !== 1) me.secretHit = 1; // 결정타 판정 배율도 비기 밖에선 1
    if (kneeling && this.secretRun) this.secretAbort();
    if (this.secret && !kneeling && !this.secretRun && !this.drillOut) this.secretScan(dt, c, r); // 헛스윙 연습 동안은 비기 사건을 보지 않는다 (whiff_drill.js)
    if (this.spinArm) this.spinTick(dt, kneeling); // 싱지르 (10/24 AI 열림): 칼끝 거리 밖 무장 → 상대가 들어오면 한 바퀴 (상대 사건 없음 — secretScan 은 건너뜀)
    if (this.press) this.mordTick(dt, kneeling); // 모르트슐라크 (10/24 AI 열림): 밀치기 누르기 1.5 s → 창 0.6 s → 상대 머리가 닿으면 일격 (상대 사건 없음)

    if (kneeling) {
      // 다리를 못 쓰니 물러나거나 파고들 수 없다: 위험이 오면 그래도 막고, 아니면 사정거리 안에 있을 때만
      //  이따금 짧게 찌른다 (watch()의 적극적인 빈틈 찾기는 쓰지 않는다 — 일어나는 중엔 너무 무모하다)
      if (th && this.mode !== 'attack' && this.noticedThreat(th)) this.respond(th, d);
      else if (this.mode === 'attack') this.attack(dt, s, d, th);
      else {
        this.decideTimer -= dt;
        if (this.decideTimer <= 0) {
          this.decideTimer = realS(rand(0.3, 0.6));
          const canPoke = d < this.M.contact + 0.15 && this.foe.alive && this.foe.state === 'stand' && !th;
          if (canPoke && Math.random() < 0.5 * L.read) {
            this.startAttack(this.pickTech(s, 'stepin'), 'stepin', { noFeint: true, fastChamber: true, skipChamber: true });
          } else {
            this.hand.set(this.school.pose.point[0], this.school.pose.point[1]); // 칼끝을 겨눠 위협만 한다
            this.handSpeed = 1.0;
          }
        }
      }
    } else if (this.mode === 'watch') this.watch(dt, s, d, th);
    else if (this.mode === 'attack') this.attack(dt, s, d, th);
    else if (this.mode === 'defend') this.defend(dt, s, d, th);
    else if (this.mode === 'secret') this.secretUpdate(dt, s, d);
    else this.withdraw(dt, s, d, th);

    // 일본 발도 대기 (10/10 02:4x): 상대 간격 밖에 iaiArmTime 초 머물면 웅크린 발도 대기 자세 (간격 안·공격·막기면 풀림). 고노센은 이 자세에서만 (cond.armed)
    //  10/25 22:3x · 22:5x 사장님 '거리와 상관없이 … 아무 행동 없이 2초' · '준비가 활성화되면 걸어도 유지' (SECRET.gnsReady 'idle' — 사람과 같은 셈 secret.js gnsArmTick): 공격 꼴 · 막기 꼴 · 비기 · 맞음 ·
    //   무릎 꿇음 · 헛스윙 연습이면 풀림 · 준비 전엔 걸음 뜻(moveFeet 의 스틱 원값 — 사람 스틱과 같은 칸)도 셈을 0 으로 · 거리는 안 봄. 'dist' 판 = 아래 옛 셈 그대로
    if (this.iaiArm && SECRET.iai) {
      const busy = this.mode === 'attack' || this.mode === 'defend' || (!!this.secretRun && this.secretRun.stage !== 'instant') || this.drillOut; // 헛스윙 연습 동안은 대기하지 않는다
      const outside = SECRET.gnsEnterAI ? gnsOutside(d, { foeReach: this.foeReach, reach: this.M.reach, contact: this.M.contact }, this.iaiArm.armed, SECRET.gnsLong) : d > this.foeReach; // 고노센 들어옴 AI 판(10/25 — 기본 끔)의 긴 칼 상대 규칙 · 끄면 옛 셈
      gnsArmTick(this.iaiArm, dt, busy || kneeling || hurt, gnsMoving(me), { outside: outside && !kneeling, busy }, armHold(me)); // 판 시작 정지 동안 셈 0 (10/27 23:0x — 서 있는 모습 인물은 그동안 여기 안 옴 · 기본 AI 몫)
      iaiReadyPose(me, this.iaiArm.armed && this.mode !== 'attack', dt);
    }
    // 이베리아 길목 지키기 준비 (10/11 v6): 상대가 내 칼끝 거리(reach) 밖에 gilmokArmTime 초 머물면 칼을 몸 옆으로 감아 뒤로 둔 옆 자세(가로 탈류·가로 레베스)로 길목을 지킨다.
    //  쪽 = 준비가 켜질 때 지금 간 보는 자세의 쪽(가운데면 오른쪽 — 피 단Ⅰ 탈류부터). 간 보기·물러남 동안만 손 목표를 덮는다(자세 고르기는 그대로 — 풀리면 그 자세로 돌아감)
    //  10/11 v6 2차 (디렉터 — 사장님이 낮은 자세를 '큰 차별성'으로 보심): 준비 동안 기본은 **낮은 자세**(아래 탈류·아래 레베스·칼끝 땅에 — 지금 자세가 낮지 않으면 손에서 가장
    //   가까운 낮은 자세)로 기다리고, **상대가 다가오는 중일 때만**(foeClosing > SECRET.iberianInsideClosing 0.3 — 재사용) 그 쪽 옆 자세로 감는다. 감은 뒤 최소 gilmokArmGrace 0.5 s
    //   유지(깜빡이지 않게 — 재사용). 감는 모습이 곧 길목의 예고다. 쪽 = 낮은 자세의 쪽(아래 레베스면 왼쪽, 아니면 오른쪽 — 피 단Ⅰ 탈류부터)
    if (this.gilArm) {
      const was = this.gilArm.armed;
      this.gilArm.tick(dt, d > gilmokLine(me, this.M.reach, this.secret.do) && !kneeling, this.mode === 'attack' || this.mode === 'defend' || !!this.secretRun || this.drillOut || armHold(me)); // 판 시작 정지 동안 셈 0 (10/27 23:0x) // 헛스윙 연습 동안은 준비하지 않는다
      const A = this.gilArm.armed && (this.mode === 'watch' || this.mode === 'withdraw');
      if (this.gilArm.armed && !was) {
        this.guard = gilmokLowGuard(this.school.guards, this.guard, [this.me.handOffset.x, this.me.handOffset.y]); // secret.js — 플레이어와 같은 규칙
        this.gilSide = this.guard?.name === 'wechselL' ? -1 : 1;
        this.gilWindT = 0;
      }
      if (A) {
        // 감는 거리: preThreat '가까움'과 같은 꼴(간격 + 다가옴 × 0.4 + 0.3)을 내 칼끝 거리로 — 먼 데서 걸어오는 동안은 낮게 기다린다 (secret.js gilmokWindT)
        this.gilWindT = gilmokWindT(this.gilWindT, this.foeClosing, d, this.M.reach, dt);
        const p = this.gilWindT > 0 ? this.secret.do.side[this.gilSide] : this.guard.pad;
        this.hand.set(p[0], p[1]);
        this.handSpeed = this.gilWindT > 0 ? L.parrySpeed : this.pers.guardSpeed; // 감기는 받아 막기 빠르기, 낮게 기다리기는 간 보기 빠르기
      } else this.gilWindT = 0;
      const g = this.secretRun ? gilmokSeg(this.tech?.name, this.secretRun.stage === 'stiff') : { seg: null, s: 1 };
      gilmokCutPose(me, g.seg, g.s, dt); // 한 칼의 덧씌우기 자세 (secret_instant.js — 팔을 앞으로 뻗어 몸통 높이)
    }
    this.moveHand(dt);
    this.moveFeet(dt, d);
    if (kneeling) me.move.set(0, 0); // 무릎 꿇거나 일어나는 중엔 발을 옮길 수 없다 (칼만 움직인다)
  }

  // ───────────────────────── 부활 (revive.js) ─────────────────────────
  /** 부활하는 동안: 발을 멈추고 칼을 지금 자세로 든 채 기다린다 (공격하지 않는다). 처음 한 번 감정을 비운다 (떨림도 멎는다) */
  /**
   * 판 시작 정지 동안 서 있는 모습 (persona.idle = { guard, gesture }, 캐릭터 PM).
   *  발은 절대 움직이지 않는다(move 0, 기술 걸음 없음). 시간은 ARENA.startHold 하나만 읽는다.
   *  gesture: stomp 칼을 어깨에 걸친 채 들썩 / settle 자세를 한 번 비틀었다 고쳐 잡음 / lowTip·still 가만히 / pointFace 칼끝을 얼굴에 겨눴다가 제 자세로
   */
  holdStart(dt) {
    const me = this.me;
    const I = this.persona.idle;
    const G = this.school.guards;
    const guard = G.find((g) => g.name === I.guard) || this.guard;
    const u = ARENA.startHold > 0 ? clamp(me.fightT / ARENA.startHold, 0, 1) : 1; // 정지 구간 안의 위치 0~1
    let px = guard.pad[0];
    let py = guard.pad[1];
    let speed = this.pers.guardSpeed;
    if (I.gesture === 'stomp') {
      py += 0.035 * Math.sin(u * Math.PI * 6); // 발 대신 어깨가 들썩인다 (세 번)
    } else if (I.gesture === 'settle' && u < 0.45) {
      px += 0.08; // 한 번 비틀어 잡았다가
      py -= 0.06;
    } else if (I.gesture === 'pointFace' && u < 0.5) {
      const point = G.find((g) => g.name === 'langort');
      if (point) (px = point.pad[0]), (py = point.pad[1]); // 칼끝을 상대 얼굴 쪽으로 곧게 (빠르기는 기질의 guardSpeed 그대로 — 하한 없음, 디렉터 9/30)
    }
    me.move.set(0, 0);
    this.mode = 'watch';
    this.phase = 'ready';
    this.path.length = 0;
    this.feint = null;
    this.feintPts = 0;
    this.feintHold = 0;
    this.stepT = 0;
    this.guard = guard; // 정지가 풀리면 이 자세에서 싸움을 시작한다
    this.hand.set(px, py);
    this.handSpeed = speed;
    this.prevFoePain = this.foe.pain;
    this.prevMyPain = me.pain;
    this.moveHand(dt);
  }

  /** 지배 감정 이름 (없으면 null) — 감정 판정(this.emoCore)이 가진 값. 시작 감정·부활이 여기로 정한다 */
  get emotion() {
    return this.emoCore.emotion;
  }

  set emotion(v) {
    this.emoCore.emotion = v;
  }

  holdForRevive(dt) {
    const me = this.me;
    if (!this.reviving) {
      this.reviving = true;
      this.emo.fear = this.emo.anger = this.emo.obsession = 0;
      this.emotion = null;
      this.fear = this.anger = this.obsession = 0;
      me.emoMods = emoMods(null, 0);
    }
    me.move.set(0, 0);
    this.mode = 'watch';
    this.phase = 'ready';
    this.path.length = 0;
    this.feint = null;
    this.feintPts = 0;
    this.feintHold = 0;
    this.stepT = 0;
    this.hand.set(this.guard.pad[0], this.guard.pad[1]);
    this.handSpeed = this.pers.guardSpeed;
    this.prevFoePain = this.foe.pain;
    this.prevMyPain = me.pain;
    this.moveHand(dt);
  }

  /**
   * 부활이 끝났다: 싸움이 끝난 줄 알던 상태를 버리고 집념을 지배 감정으로 다시 싸운다.
   *  감정 규칙(emote)은 그대로 — 세기(revive.obsession)와 텀(revive.obsessionHold 동안 다른 감정이 밀어내지 못함)만 정해 준다
   */
  resumeAfterRevive() {
    this.reviving = false;
    this.closeWant = this.closeBind = false;
    const R = this.me.revive || {};
    this.emo.fear = this.emo.anger = 0;
    this.emo.obsession = Math.min(1, R.obsession ?? 0.8);
    this.emotion = 'obsession';
    this.fear = this.anger = 0;
    this.obsession = this.emo.obsession;
    this.emoCore.restAll = this.emoCore.t + (R.obsessionHold ?? 10);
    this.emoCore.rest.obsession = -1;
    this.me.emoMods = emoMods('obsession', this.emo.obsession);
    // 하던 공격·속임수·이어치기를 버리고 간 보기부터 (물고 늘어지니 참을성은 바닥)
    this.mode = 'watch';
    this.phase = 'ready';
    this.path.length = 0;
    this.chain = 0;
    this.bound = false;
    this.feint = null;
    this.feintPts = 0;
    this.feintHold = 0;
    this.stepT = 0;
    this.hitLanded = false;
    this.cautious = false;
    this.desperate = false;
    this.patience = Math.min(this.patience, 0.2);
    this.guardTimer = 0;
    this.decideTimer = 0;
    this.emoCore.sawDisarmed = false; // 칼을 다시 쥐었다
    this.threatSeen = this.threatId;
    this.noThreat = 1;
    this.emoCore.parryTimes.length = 0;
    this.foeReach = this.foeM.reach + 0.05;
    this.prevFoePain = this.foe.pain;
    this.prevMyPain = this.me.pain;
  }

  // ───────────────────────── 간 보기 ─────────────────────────
  watch(dt, s, d, th) {
    const L = this.level;
    this.phase = 'ready';
    if (th && this.respond(th, d)) return;
    if (this.drillOut) return this.drillWatch(dt, s, d); // 시험: 헛스윙 연습 (whiff_drill.js) — 들어오는 칼 받기만 위에서 평소대로
    if (this.pendingPassive?.left != null && this.passivePending(s, d)) return; // 미룬 패시브 (물러남 끝 斂翅 · 간격 밖에서 굴려 나온 돌려 물러남)
    // 이베리아 길목 지키기 준비 (10/11 v6): 준비된 동안은 먼저 치지도(기회·패시브) 낌새에 앞질러 치거나 물러나지도(preThreat·seize) 않고 칼끝 거리 선을 지킨다 —
    //  48 판 첫 측정: 이 걸쇠 없이는 상대가 칼끝 거리에 들자마자 내가 먼저 공격을 열어 준비가 풀려 창 0 번. 들어오는 칼(위 respond)은 그대로 받는다. 자세 손은 update 끝에서 옆 자세로 덮는다
    if (this.gilArm?.armed) return;
    // 싱지르 무장 (10/24): 같은 걸쇠 — 무장된 동안은 먼저 치지 않고 간을 보며(발은 holdDist 그대로 다가섬) 상대가 칼끝 거리 + aiFire 안에 들면 spinTick 이 한 바퀴.
    //  걸쇠가 없으면 롤랑이 무장한 뒤 상대가 칼끝 거리 + 0.6 m 에 오자마자 보통 공격을 열어 무장이 풀렸다(첫 시험 — 낸 수 0). 들어오는 칼(위 respond)은 그대로 받는다
    if (this.spinArm?.armed) return;
    // 모르트슐라크 몸 붙이기 (10/24): 같은 걸쇠 — 미는 동안은 먼저 치지 않는다(누르기가 베기로 끊기지 않게 — fighter.closeStep 'swing'). 들어오는 칼(위 respond)은 그대로 받는다.
    //  붙으러 걸어 들어가는 동안은 칠 때가 오면 친다(10/24 13:3x 사장님 '걸어가며 치기도 같이 넣어' — SECRET.mordWalkStrike · 0 이면 걸어가는 동안도 걸쇠 — 12:0x 판). 치면 붙이기는 끝(mordTick — 간 보기를 벗어남)
    if (this.press?.go && !(SECRET.mordWalkStrike && this.mordWalking())) return;
    // 치려는 낌새(간격 가까이서 칼을 들며 다가온다) → 들어오는 순간을 먼저 치거나(Vor), 물러난다
    if (this.preThreat(s, d, dt)) return;
    if (this.seize(s, d, dt)) return;

    // 자세 바꾸기 (잠깐씩 멈추며)
    this.guardTimer -= dt;
    if (this.guardTimer <= 0) {
      this.guardTimer = realS(this.pers.rhythm * rand(0.6, 1.4)); // 자세 바꾸는 박자 rhythm = 실제 초
      this.guard = this.pickGuard(s);
    }
    this.hand.set(this.guard.pad[0], this.guard.pad[1]);
    this.handSpeed = this.pers.guardSpeed; // 천천히 차분하게: 휘두르기로 보이지 않게 (검술 층의 자동 내딛기가 걸리지 않는다)

    // 기회를 본다 (사람처럼 가끔씩 판단)
    this.decideTimer -= dt;
    if (this.decideTimer > 0) return;
    this.decideTimer = realS(rand(0.06, 0.14));
    const opp = this.opportunity(s, d);
    let need = 1 - 0.3 * (this.pers.aggr * L.aggression - 0.8);
    if (STAMINA.on && this.foe.stamina.level > 0) need -= this.foe.stamina.exhausted ? 0.45 : 0.2;
    // 겁먹으면 확실한 순간(헛친 뒤·쓰러진 상대)에만 들어간다
    if (opp.kind !== 'recover' && opp.kind !== 'finish') need += this.fear * 0.7;
    const reachOut = this.watchReachOut();
    if (this.passives.length && this.passiveWatch(s, d, opp, reachOut)) return; // 패시브 (standoff·foeStepIn) — 목록이 비면 건너뜀
    if (opp.score >= need && d < this.holdDist() + reachOut) {
      if (this.press && !SECRET.mordNear && this.mordPressGo('watch')) return; // 모르트슐라크 (10/24 12:0x 판 — SECRET.mordNear 0 일 때만): 칠 때를 본 순간 인물 밀치기 확률로 베는 대신 몸을 붙여 민다 · 14:2x 부터는 보통 AI 대로 친다
      if (this.gnsW?.ready && this.gnsAct(s, opp)) return; // 고노센 경계 (10/25): 준비된 고노센 상대 — 결행 또는 속임
      this.startAttack(this.pickTech(s, opp.kind), opp.kind);
    }
  }

  /** 간 보기에서 칠 수 있는 거리의 여유 (holdDist 위로): 빈손 상대는 조금 멀어도 뛰어들며 친다 */
  watchReachOut() {
    return this.chasing ? 1.0 : 0.4;
  }

  /**
   * 시험: 헛스윙 연습의 간 보기 (src/whiff_drill.js — drillOut 일 때만 watch 가 부른다). 자세 바꾸기는 평소 간 보기와 같고,
   *  때가 되고(drill.next) 드릴 거리 근처면 그 자리에서 보통 기술로 친다 — 걸음·다가가기 없음(drillAtk: attack·stepTime·moveFeet). 닿지 않으면 afterStrike 가 헛침을 알린다
   */
  drillWatch(dt, s, d) {
    this.guardTimer -= dt;
    if (this.guardTimer <= 0) {
      this.guardTimer = realS(this.pers.rhythm * rand(0.6, 1.4)); // 자세 바꾸는 박자 rhythm = 실제 초
      this.guard = this.pickGuard(s);
    }
    this.hand.set(this.guard.pad[0], this.guard.pad[1]);
    this.handSpeed = this.pers.guardSpeed;
    if (this.drill.due(this, d) && this.startAttack(this.pickTech(s, 'drill'), 'drill', { noFeint: true, noPending: true, drill: true })) this.drill.fired();
  }

  /** 간을 볼 거리: 상대 칼이 닿는 거리 + 여유. 인내심이 줄수록 여유를 줄여 간격 끝에 선다 */
  holdDist() {
    if (this.drillOut) return this.drill.dist(this); // 시험: 헛스윙 연습 — 드릴 거리 (물러남이 거기서 끝난다)
    const L = this.level;
    let m = this.pers.margin * (0.3 + 0.7 * this.patience) * (0.6 + 0.4 * L.discipline * (1 - 0.3 * this.anger)); // 화나면 규율이 흐트러진다
    if (this.guard?.name === 'alber') m -= 0.12; // 바보 자세: 머리를 비워 두고 조금 더 다가가 유인한다
    if (this.cautious) m += 0.2;
    m += this.fear * 0.35; // 겁먹으면 상대 칼에서 더 멀찍이 선다
    m -= this.obsession * 0.15; // 물고 늘어질 땐 간격 끝보다 조금 더 안쪽에 선다
    m += (1 - this.me.vigor) * 0.3; // 다쳐서 힘이 빠지면 더 조심스럽게 선다
    if (!this.me.armed) m += 0.6; // 칼을 놓쳤으면 상대 칼이 닿지 않게 멀찍이 선다
    // 빈손 상대는 칼이 닿지 않는다: 내 칼이 닿는 거리까지 다가선다
    const W = this.gnsW;
    const wary = !!W && (W.ready || W.cut) && !this.chasing; // 고노센 경계 (10/25): 준비된 고노센 상대(또는 그 발도에 막 베임)면 상대 발도 선 밖에 선다 — 여유는 위와 같은 m (최소 0.08)
    if (this.gilArm?.armed && !this.chasing) {
      const g = Math.max(this.foeReach + Math.max(0.08, m), gilmokLine(this.me, this.M.reach, this.secret.do) + 0.08); // 이베리아 길목 준비 (10/11): 내 칼끝 거리 선 밖에 선다 (여유 0.08 = 위 최소 여유 그대로)
      return wary ? Math.max(g, W.line + Math.max(0.08, m)) : g;
    }
    const h = (this.chasing ? this.M.contact : this.foeReach) + Math.max(0.08, m);
    return wary ? Math.max(h, W.line + Math.max(0.08, m)) : h;
  }

  /**
   * 고노센 경계 (10/25 08:0x 사장님 '⑤ AI 쪽 — 서 있는 사람에게 같은 걸음으로 거듭 걸어 드는 것' · SECRET.gnsWary — docs/strike/school_secret_2026-10-09.md §17):
   *  상대가 고노센을 쓰는 몸(secret.js gnsUser)일 때만 일한다 — 아니면 첫 스텝에 W.user 거짓으로 끝(난수 · 값 그대로).
   *  준비 읽기: AI 상대 = 그 AI 의 발도 대기(iaiArm — 웅크린 자세로 보임) · 사람 상대 = 사람 창(PlayerSecretWatch)과 같은 셈(IaiArm · gnsArmTick — 10/25 22:3x 'idle' 거리와 상관없이
   *   iaiArmTime 이동 입력 · 공격 · 막기 · 맞음 · 비기 없음 · 준비된 뒤엔 걸어도 유지 · 'dist' 옛 판 상대 칼 거리 밖에 서서 휘두르지 않음)을 상대 자리에서 쌓음(d = 내가 본 두 가슴 사이). 선 = 상대 발도가 닿는 거리(gnsEnterLine — 상대의 맞닿기 + iaiStep + iaiMargin).
   *  준비된 동안: ① 기다림 — holdDist 가 선 + 여유(있는 m) · 선 언저리 잔걸음이 선 안으로 들지 않음(moveFeet) ② 칠 때(watch 의 기회 — 참을성 · 빈틈 그대로)면 gnsAct(결행 · 속임) ·
   *  ③ 그 발도에 베이면(hurt · iaiBusy(상대)) 선 밖까지 물러남(W.cut — holdDist) · 참을성 되채움(주고받은 뒤와 같은 셈 — afterStrike). 재기 W.n (판정에는 안 씀)
   *  (첫 꼴 '꾀기' — 기는 빠르기로 선을 넘었다가 곧장 물러남 — 는 뺐다: 걸음 한 디딤이 끝나기 전엔 몸이 돌아서지 못해(스틱 −1 뒤 0.3 s 동안도 0.1 ~ 0.2 m/s 로 다가옴) 발도가 늘 닿았다 — §17)
   */
  gnsWatch(dt, d, hurt) {
    const foe = this.foe;
    const W = (this.gnsW ??= { user: gnsUser(foe), arm: null, line: 0, ready: false, cut: false, plan: null, feinted: false, n: { commit: 0, feint: 0, cut: 0 } });
    if (!W.user) return;
    if (foe.aiControlled) {
      W.line = gnsEnterLine(foe.aiCtl.M);
      W.ready = !!SECRET.iai && !!foe.aiCtl.iaiArm?.armed;
    } else {
      const art = foe.swordArt;
      const V = { reach: art.measure.reach, contact: art.measure.contact, foeReach: art.measureFor(this.me.weapon).reach + 0.05 }; // 사람 창 view() 와 같은 수
      W.line = gnsEnterLine(V);
      const A = (W.arm ??= new IaiArm());
      const down = !foe.alive || !foe.armed || foe.state !== 'stand' || secretSpent(foe); // 10/29 19:5x: 이 판 비기를 다 쓴 사람은 준비가 아님 (사람 창이 무장을 안 거는 것과 같게)
      const foeHurt = foe.pain > (W.pain ?? foe.pain) + 0.05; // 사람이 맞음 (사람 창과 같은 셈 — 10/25 22:3x 'idle')
      W.pain = foe.pain;
      gnsArmTick(A, dt, down || gnsHumanUnsettled(foe, foeHurt), gnsHumanMoving(foe), { outside: gnsOutside(d, V, A.armed, SECRET.gnsEnter && SECRET.gnsLong), busy: down || !!foe.skill?.swinging || !!foe.skill?.sec }, armHold(foe)); // 'idle' — 거리 안 봄 · 'dist' 옛 셈
      W.ready = !!SECRET.iai && A.armed;
    }
    if (hurt && iaiBusy(foe)) {
      W.cut = true;
      W.n.cut++;
      W.plan = null;
      this.patience = Math.max(this.patience, rand(0.45, 0.75) * (1 - 0.7 * this.anger)); // 주고받은 뒤와 같은 셈 (afterStrike)
    }
    if (W.cut && this.mode === 'watch' && d > W.line) W.cut = false;
    if (!W.ready) W.feinted = false; // 속임은 준비 한 번에 한 번 (상대가 준비를 풀면 다시)
    if (W.plan && this.mode !== 'attack') W.plan = null; // 결행 · 속임은 그 공격 꼴 동안만
  }

  /**
   * 고노센 경계 — 칠 때 (watch 의 기회가 찬 순간 · 상대 준비됨): 성격 pers.vor(달려드는 상대를 맞받는 쪽 1 · 물러나 헛치게 하는 쪽 0 — 있는 값)로 한 번 굴림.
   *  결행(Vor): 빠른 준비(fastChamber)로 공격 — 준비 · 다가가는 걸음이 스틱 끝(기어 들지 않음)이고 내 칼끝 거리(M.reach)에서 벤다(attack · moveFeet) — 긴 칼이면 상대 발도 선 밖에서 친다.
   *  속임: 선 밖에 선 채 칼을 준비 자세로 들었다가(보통 준비 빠르기 — 읽히는 들기) 거둔다(attack — 들기가 끝나면 abortAttack). 선 밖이라 상대 창은 안 열린다 —
   *   사람이 그 들기에 먼저 휘두르면 준비가 풀린다. 속임은 준비 한 번에 한 번 — 다음 칠 때는 결행. 돌려줌: 이번 기회를 가져갔나
   */
  gnsAct(s, opp) {
    const W = this.gnsW;
    const commit = W.feinted || Math.random() < this.pers.vor;
    if (!this.startAttack(commit ? this.pickTech(s, opp.kind) : this.gnsFeintTech(), opp.kind, commit ? { fastChamber: true } : { noFeint: true })) return false;
    if (this.mode !== 'attack' || this.secretRun) return true; // 미룬 패시브 · 비기가 이 기회를 가져감 — 그대로
    W.plan = { kind: commit ? 'commit' : 'feint' };
    W.n[W.plan.kind]++;
    W.feinted = !commit;
    return true;
  }

  /** 고노센 경계 속임의 들기: 베기 기술 가운데 준비 자세가 지금 손에서 가장 먼 것 (크게 드는 것이 보이는 위협 — 굴림 없음) */
  gnsFeintTech() {
    const hand = [this.me.handOffset.x, this.me.handOffset.y];
    let best = null;
    let bd = -1;
    for (const t of this.school.tech) {
      if (t.kind === 'thrust') continue;
      const cd = padDist(hand, t.from);
      if (cd > bd) (bd = cd), (best = t);
    }
    return best ?? this.school.tech[0];
  }

  /**
   * 감정층 (공포·분노·집념). 눈에 보이는 사건으로만 켜지고, 시간이 지나면 가라앉는다. 세기(0~1)는 저마다의
   * 문턱값(pers.fearful·angry·dogged: 이 인물이 그 감정에 얼마나 잘 빠지는가)로 곱해진다.
   * 아래 사건·세기·감쇠·지배·텀 규칙은 emotions.js Emotions.update 한 곳에 있다 — 여기서는 사건을 모아 넘기고 AI 몫만 더한다.
   *  공포: 베였다(+0.4), 피가 계속 난다(+0.12/s), 상대 칼이 코앞까지 왔다(+0.3/s). 9초 감쇠
   *  분노: 10초 안에 두 번 이상 막혔다(+0.35), 이기고 있는데 맞았다(+0.3). 12초 감쇠
   *  집념: 상대가 피 흘린다(+0.2/s), 방금 맞혔다(+0.3). 8초 감쇠
   * (자포자기는 공포와 겹치고 교활함은 감정보다 성격·격투 스타일에 가까워 뺐다 — 교활함은 feint·alber 취향으로,
   *  자포자기는 hurry()의 desperate로 이미 표현된다)
   * 지배 감정은 하나: 0.3을 넘은 것 중 생존 우선(공포 > 분노 > 집념). 지배 감정이 바뀌려면 새 감정이 0.15 이상
   * 더 세야 한다(왔다 갔다 하지 않게). 지배 감정이 0.15 아래로 가라앉으면 물러난다. 풀리거나 자리를 뺏긴 감정은 EMO_REST(9초)
   * 동안 다시 지배하지 못하고, 어떤 감정이든 직전 감정이 풀린 뒤 EMO_REST_ALL(6초)은 쉰다 — 연달아 켜지지 않게 하는 텀.
   *
   * 검술에 효과를 내는 것은 공포(this.fear — 다른 감정이 지배하면 0)와 분노(this.anger — 분노가 지배할 때만)다.
   *  공포: holdDist(간격을 더 둔다), pickGuard(칼끝으로 겨누는 자세만 잡는다), watch(헛친 상대·쓰러진 상대 말고는
   *   안 들어간다), respond(막기보다 물러나 피하고, 맞받아치지 않는다), preThreat(달려드는 상대를 맞받지 않고
   *   물러난다), moveFeet(잔걸음이 뒷걸음으로 기운다).
   *  분노: 켜지는 순간 인내심 0.2로 + 주고받은 뒤 인내심이 덜 돌아온다(afterStrike), 속임수 안 씀(startAttack),
   *   무거운 베기 ×1.6(pickTech), 이어치기 +0.2(afterStrike), 규율 ×0.7(holdDist·moveFeet: 덜 물러난다),
   *   반응 +0.04s(step), 지붕 자세 선호(pickGuard).
   *  집념(this.obsession — 집념이 지배할 때만): 이어치기 최대 2→3, 물러남 0.9→0.5s(afterStrike), 접근 포기 문턱
   *   ×1.5(attack), 간격 −0.15m(holdDist). 막기·피하기(respond)는 그대로 — 방어는 유지한다.
   * 문턱값이 전부 0이면 this.fear·this.anger·this.obsession이 늘 0이라 모든 곳이 예전과 똑같이 계산된다.
   */
  emote(dt, hurt, nearMiss) {
    const me = this.me;
    const foe = this.foe;
    const C = this.emoCore;
    const E = this.emo;
    const cur = this.emotion;
    // 사건 (무기 사건 — 무기·검술 담당 추가: 내 무기가 부러졌다·칼을 놓쳤다는 한 번만. 상대가 레전드 무기(진품 엑스칼리버 —
    //  겉으로 빛나 누구나 알아본다)를 들고 사정거리 근처에 있으면 위압. 상대 무기가 부러지면 한숨 돌리고 집념이 오른다)
    const ev = this.emoEv;
    ev.hurt = hurt;
    ev.bleeding = me.bleed > 0.01;
    ev.nearMiss = nearMiss;
    ev.weaponBroken = me.weaponBroken;
    ev.disarmed = !me.armed;
    ev.foeLegendNear = foe.armed && foe.weapon?.tier === 'legend' && this.d < this.M.reach + 0.5;
    ev.foeBroke = foe.weaponBroken;
    ev.parried = this.evParried;
    ev.winning = foe.blood < me.blood;
    ev.foeBleeding = foe.bleed > 0.01;
    ev.landed = this.evLanded;
    if (!C.update(dt / TIME.k, ev)) return; // 감정 시계 = 실제 초 (표준 시간 10/25 — 사람 감정은 main.js 가 화면 dt 로 돌려 원래 실제 초 · emotions.js 의 9 · 12 · 8 초 감쇠 · 10 초 · 텀이 둘 다 실제 초) · 문턱값이 전부 0 (기본 AI): 감정층이 꺼져 있다
    this.evParried = this.evLanded = false;

    // 아래는 AI 에만 있는 것: 지배 감정이 없으면 공포 세기가 그대로 검술에 걸린다, 발끈한 순간 참을성, 관찰 통계
    const order = ['fear', 'anger', 'obsession'];
    this.fear = this.emotion === 'fear' || this.emotion === null ? E.fear : 0;
    this.anger = this.emotion === 'anger' ? E.anger : 0;
    this.obsession = this.emotion === 'obsession' ? E.obsession : 0;
    // 고유 능력(emotions.js 배율표): 상처 판정(combat.js)과 발놀림(moveFeet)이 읽는다. 감정이 없으면 전부 1
    this.me.emoMods = C.mods;
    if (this.emotion === 'anger' && cur !== 'anger') this.patience = Math.min(this.patience, 0.2); // 발끈한 순간: 참을성이 바닥난다

    // 관찰용 통계: 감정별 최고 세기, 지배한 시간, 지배 감정으로 켜진 횟수
    const S = this.stats;
    if (!S.emoPeak) {
      S.emoPeak = { fear: 0, anger: 0, obsession: 0 };
      S.emoTime = { fear: 0, anger: 0, obsession: 0 };
      S.emoCount = { fear: 0, anger: 0, obsession: 0 };
    }
    for (const k of order) if (E[k] > S.emoPeak[k]) S.emoPeak[k] = +E[k].toFixed(2);
    if (this.emotion) S.emoTime[this.emotion] += dt;
    if (this.emotion && this.emotion !== cur) S.emoCount[this.emotion]++;
    S.fearPeak = S.emoPeak.fear;
  }

  /** 급한 정도: 내가 피를 더 흘리면 서두르고(>1), 상대가 더 흘리면 기다린다(<1) */
  hurry() {
    const me = this.me;
    const foe = this.foe;
    const myLoss = 1 - me.blood + me.bleed * 8;
    const foeLoss = 1 - foe.blood + foe.bleed * 8;
    // 기다리면 상대가 쓰러질 만큼 피를 쏟고 있을 때만 기다린다 (피는 곧 굳는다)
    this.cautious = foeLoss > myLoss + 0.12 && foe.bleed > 0.01 && me.blood > 0.7;
    this.desperate = myLoss > foeLoss + 0.12 && me.blood < 0.75;
    if (this.desperate) return 2.2;
    if (this.cautious) return 0.6;
    return 1;
  }

  /** 자세 고르기: 성격 + 상대 자세에 맞서는 자세 */
  pickGuard(s) {
    const L = this.level;
    const cls = s ? this.foeClass(s) : null;
    const guards = this.school.guards;
    let best = guards[0];
    let bestW = -1;
    for (const g of guards) {
      if (g === this.guard) continue;
      let w = this.pers.guardPref[g.name];
      if (g.w != null) w *= g.w; // 유파 자세 가중치 (10/10 이베리아 몬탄테 고증 — schools.js IBERIAN_GUARDS 의 w. 칸 없는 자세는 전과 같음)
      if (cls) {
        // 상대가 칼을 높이 들면 칼끝으로 겨누는 자세(들어오면 찔린다)나 아래 자세, 낮추면 위에서 내려칠 자세
        if (cls.high) w *= 1 + L.read * (g.threat * 0.8 + g.low * 0.4);
        if (cls.low) w *= 1 + L.read * g.high * 0.9;
        if (cls.online) w *= 1 + L.read * g.high * 0.6; // 칼끝이 나를 겨누면 위에서 눌러 벨 준비
      }
      // 인내심이 떨어지면 가장 믿는 기술(분노의 베기)을 준비하는 자세
      const ready = g.name === 'tagR' || g.name === 'ochsR' || g.name === 'tag';
      if (ready) w *= 1 + (1 - this.patience) * 0.8 + this.foeAggro * 2.5 * L.read;
      // 겁먹으면 칼끝으로 겨누는 자세(쟁기·긴 자세·황소)만 잡는다: 들어오지 못하게 막대기를 세워 두는 셈
      w *= 1 + this.fear * 2 * g.threat;
      // 화나면 지붕 자세(내려칠 준비)로 간다
      if (g.name === 'tag' || g.name === 'tagR') w *= 1 + this.anger * 1.5;
      // 가까운 자세로 옮기는 것을 좋아한다 (칼을 크게 휘저으며 자세를 바꾸지 않는다). guardStick이 클수록 이 버릇이 강하다
      if (this.guard) w /= 1 + this.pers.guardStick * Math.hypot(g.pad[0] - this.guard.pad[0], g.pad[1] - this.guard.pad[1]);
      w *= rand(0.5, 1.5);
      if (w > bestW) {
        bestW = w;
        best = g;
      }
    }
    return best;
  }

  /** 상대 자세 읽기 (상대 기준 패드: x + = 상대의 칼 든 쪽 = 내 쪽에서 보면 왼쪽) */
  foeClass(s) {
    const bx = s.tx - s.mx;
    const by = s.ty - s.my;
    const bz = s.tz - s.mz;
    const c = this.me.bodies.chest.translation();
    const qx = c.x - s.mx;
    const qy = c.y - s.my;
    const qz = c.z - s.mz;
    const cos = (bx * qx + by * qy + bz * qz) / (Math.hypot(bx, by, bz) * Math.hypot(qx, qy, qz) + 1e-6);
    return {
      high: s.hy > 0.28, // 칼을 높이 들었다 → 아래가 빈다
      low: s.hy < -0.18, // 칼을 낮췄다 → 위가 빈다
      right: s.hx > 0.22, // 칼이 상대 오른쪽 → 상대 왼쪽이 빈다
      left: s.hx < -0.22,
      online: cos > 0.88, // 칼끝이 나를 겨눈다 (곧장 들어가면 찔린다)
    };
  }

  // ───────────────────────── 빈틈 읽기 ─────────────────────────
  /** 지금 칠 만한가: { score, kind } */
  opportunity(s, d) {
    const L = this.level;
    let score = 0;
    let kind = 'patience';
    let top = 0;
    const cls = this.foeClass(s);
    const handSp = Math.hypot(s.hvx, s.hvy);
    const swungRecently = this.sense.recentHandSpeed(L.reaction, realS(0.7)) > 3.5;
    const add = (v, k) => {
      if (v > top) {
        top = v;
        kind = k;
      }
      score += v;
    };
    // 1) 헛친 뒤: 칼이 길 밖에 있고 손이 멈췄다 (다시 자세를 잡기 전) → 뒤(Nach)
    if (swungRecently && handSp < 1.8 && !cls.online && d < this.M.reach + 0.45) add(0.7 + 0.3 * L.read, 'recover');
    // 2) 간격 안으로 걸어 들어온다 → 들어오는 순간(Vor)
    if (this.foeClosing > 0.45 && d < this.foeReach + 0.3 && !cls.online) add(0.55 + 0.35 * L.read, 'stepin');
    // 3) 비틀거리거나 쓰러져 있다, 칼을 놓쳤다
    if (s.state !== 'stand' || !s.armed) add(1.2, 'finish');
    else if ((s.offBalance > 0.03 && Math.hypot(s.vx, s.vz) < 0.8) || s.balance < 65) add(0.6, 'offbalance');
    // 4) 칼끝이 나를 겨누지 않는다 (들어가도 찔리지 않는다)
    if (!cls.online) add(0.15 + 0.15 * L.read, 'open');
    // 5) 다쳐서 약하다
    add((1 - s.vigor) * 0.5, 'weak');
    // 6) 인내심이 떨어지면 먼저 들어간다 (주도권)
    add((1 - this.patience) * 1.1, 'patience');
    if (this.desperate) add(0.25, 'patience');
    if (this.cautious) score -= 0.2;
    // 내 상태가 나쁘면 참는다
    if (this.me.offBalance > 0.03 || this.me.pain > 0.9) score -= 0.5;
    // 마른 길 (라트나 · 잠든 습지만): 상대가 젖은 자리(진흙 감속 자리)에 서 있으면 발이 묶인 틈 — 작은 가산점 (기회 종류는 그대로)
    const ds = this.drySense;
    if (ds) score += DRYPATH.bonus * ds * this.dryFoeWet(s);
    if (this.foe.state === 'dead') score = -1;
    return { score, kind };
  }

  /**
   * 가까이서 곧장 치는 순간: 상대가 헛치고 다시 자세를 잡기 전(Nach)이거나,
   * 몸을 붙여 밀고 들어오면 물러나기만 하지 않고 짧게 벤다 (붙은 싸움, Krieg)
   */
  seize(s, d, dt) {
    this.seizeT -= dt;
    if (this.seizeT > 0) return false;
    this.seizeT = realS(rand(0.08, 0.16));
    if (d > this.M.reach + 0.2 || d < 0.9 || !this.foe.alive) return false;
    const L = this.level;
    const swung = this.sense.recentHandSpeed(L.reaction, realS(0.6)) > 3.5;
    const recovering = swung && Math.hypot(s.hvx, s.hvy) < 1.8;
    const pressing = d < 1.5 && this.foeClosing > 0.1;
    if (!recovering && !pressing) return false;
    // 패시브 foeRecover (독일 Nachreisen — 10/9 13:xx): 있으면 이 굴림 앞에 한 번
    const P = recovering && this.passives.length ? this.passiveFor('foeRecover') : null;
    if (P && this.passiveRoll(P) && this.passiveGo(P, s, 'recover')) return true;
    if (Math.random() > (recovering ? 0.3 + 0.5 * L.read : 0.1 + 0.35 * L.read)) return false;
    return this.startAttack(this.pickTech(s, 'recover'), recovering ? 'recover' : 'press', { noFeint: true });
  }

  /** 기술 고르기: 노리는 빈틈 × 상대 자세 × 준비 자세까지의 거리 × 성격. prefer(패시브, 이 한 번만): { thrust, fast, presses } 곱 — 없으면 전과 같은 셈.
   *  고유 동작의 fit 칸({ online·high·low·left·right·parried: 곱 }) — parried 는 바로 앞 내 공격이 막혔나(bound, 다음 startAttack 이 지우기 전) */
  // ───────────────────────── 특수 공격 AI 몫 식힘 · 비기 다 씀 (10/29 19:4x · 19:5x) ─────────────────────────
  /** 특수 공격 AI 몫 식힘 중인가 (사람 PlayerUniqueAssist.cooling 과 같은 수 — UNIQUE_ASSIST.specialCooldown · 끝난 때부터 · 도는 동안 Infinity) */
  specCooling(name, now = this.sense.t) {
    const t0 = name ? this.specCool[name] : null;
    return t0 != null && UA.specialCooldown > 0 && now - t0 < UA.specialCooldown;
  }

  /** 고르는 기술 t 를 지금 낼 꼴로: 식는 특수 공격이면 바탕 동작(강화동작의 plain — 머리 위 돌려 베기 → 왼 가로베기 · sword_art.js) 또는 null(고르지 않음 — 사람의 '보통 동작'과 같은 뜻) */
  techNow(t) {
    return t && SPECIALS.has(t.name) && this.specCooling(t.name) ? t.plain ?? null : t;
  }

  /** 지금 칼이 나가는 공격의 특수 공격 이름 (startStrike): 속임(날개 접기 · 칼끝 돌려 빼기) · 패시브(겹치기 · 빼서 찌르기 · 되받아 치기) · 기술 이름(제비 베기 · 겹치기 · 머리 위 돌려 베기) — 비기가 낸 칼은 아님 */
  specialNow() {
    if (this.secretRun) return null;
    if (this.feint) return SPECIAL_FEINT.get(this.feint.name) ?? null;
    const P = this.passiveAtk ? this.passives.find((x) => x.name === this.passiveAtk) : null;
    const ps = P ? passiveSpecial(P) : null;
    if (ps) return ps;
    return SPECIALS.has(this.tech?.name) ? this.tech.name : null;
  }

  /** 특수 공격이 나감 (칼이 실제로 나가는 순간 — startStrike): 'fire' 면 지금부터 · 아니면 끝날 때까지 식힘 중(specTick 이 끝난 때를 적음) */
  specStart(name) {
    const now = this.sense.t;
    (this.stats.specials ??= {})[name] = (this.stats.specials[name] ?? 0) + 1;
    if (this.specRun) this.specEnd(this.specRun, now, now); // (한 유파에 특수 공격 하나 — 오지 않는 길)
    if (UA.specialCoolFrom === 'fire') {
      this.specCool[name] = now;
      return;
    }
    this.specCool[name] = Infinity;
    this.specRun = { name, seq: this.atkSeq, t0: now, motion: null };
  }

  /**
   * 나간 특수 공격이 끝났나 (update 머리 — 사람 coolTick 과 같은 셈): 동작 = 그 공격의 베는 길(attack 꼴의 follow 앞 단계) · 끌고 가는 칼(me.iai · iaiReq — 진 · 츠바메가에시 되돌림 칼) ·
   *  풀기 = 뒤따름(follow — 칼이 다 지나갈 때까지 · afterStrike 앞) · 끝 자세 붙잡기 · 풀기(iaiHoldT · iaiFade). 그 공격이 끝나면(다음 공격 · 이어 치기 · 흐름 · 물러남 · 거둠) 끝
   */
  specTick() {
    const R = this.specRun;
    if (!R) return;
    const me = this.me;
    const now = this.sense.t;
    const live = this.mode === 'attack' && this.atkSeq === R.seq;
    const moving = (live && this.phase !== 'follow') || !!me.iai || !!me.iaiReq;
    if (R.motion == null) {
      if (moving) return;
      R.motion = now;
      if (UA.specialCoolFrom === 'motion') this.specCool[R.name] = now;
    }
    if (live || moving || me.iaiHoldT > 0 || me.iaiFade > 0) return;
    this.specEnd(R, R.motion, now);
  }

  specEnd(R, motion, now) {
    if (UA.specialCoolFrom !== 'fire') this.specCool[R.name] = UA.specialCoolFrom === 'motion' ? motion ?? now : now;
    (this.stats.specRuns ??= []).push({ name: R.name, motion: (motion ?? now) - R.t0, free: now - R.t0 });
    this.specRun = null;
  }

  /**
   * 이 판 비기를 다 씀 (사장님 10/29 19:5x '비기는 … 판당 1회만 쓸 수 있게 하자.(동방 격살은 3회)' · 19:4x 'AI의 모든 쿨타임은 사람과 맞춰.' — UNIQUE_ASSIST.secretUses · secret.js secretSpent):
   *  비기 없는 AI(숙련도 밑 · 닫힌 유파)와 같은 길로 — 상대 사건 · 발도 대기(웅크림) · 길목 · 싱지르 무장 · 모르트슐라크 누르기 · 맺힘 셈 모두 없음. 판마다 새 AI · 새 몸이라 다음 판엔 다시
   */
  dropSecret() {
    if (this.iaiArm) iaiReadyPose(this.me, false, 1); // 발도 대기 웅크림이 남아 있으면 풀기 (덧씌우기 칸을 가졌을 때만 — iaiReadyW > 0)
    this.secret = null;
    this.iaiArm = this.gilArm = this.spinArm = this.binds = null;
    if (this.press && !('tech' in this.press)) this.press = null; // 모르트슐라크 누르기 셈 (자연 바인드 밀기 칸은 10/31 부터 따로 this.natP — 이 칸에 tech 가 있는 꼴은 이제 없음)
    this.stats.secretDropped = (this.stats.secretDropped ?? 0) + 1;
  }

  pickTech(s, why, prefer) {
    const L = this.level;
    const cls = this.foeClass(s);
    const hand = [this.me.handOffset.x, this.me.handOffset.y];
    // 기술 목록(school.tech)은 롱소드(찌르기·베기 모두 배율 1)를 기준으로 짜여 있다. 찌르기 전용에
    // 가까운 무기(에스톡·레이피어 등)는 실제로 찌르기가 훨씬 잘 먹히는데 기술을 고를 때 이걸 몰라
    // 베기만 골라 쓰다 지는 일이 있었다 — 무기의 mThrust/mCut 배율 그대로 찌르기 기술 선호도에 곱한다.
    const cfg = this.me.weaponCfg;
    const thrustBias = cfg ? cfg.mThrust / cfg.mCut : 1;
    // 약한 자세 겨눔 (FINISH.vital, 10/12 — 샛별 저장소 ccea5855 pickTech 의 뜻): 상대가 무릎 꿇음·일어나는 중이고 목이 열려 있으면
    //  이 무기가 노릴 꼴(베기 / 찌르기 무기는 찌르기)만 보고, 베기면 목을 가로지르는 기술(neckCrossingTechnique)만 고른다. 끄면 이 줄을 타지 않는다
    const vt = FINISH.vital ? aiVitalCandidate(this, s) : null;
    const vKind = vt && this.school.tech.some((t) => t.kind === vt.kind) ? vt.kind : null;
    const neckCut = vKind === 'cut' && this.school.tech.some(neckCrossingTechnique);
    let best = null;
    let bestW = -1;
    for (const t0 of this.school.tech) {
      const t = this.techNow(t0); // 식는 특수 공격은 바탕 동작 또는 건너뜀 (10/29 19:4x — 사람과 같게)
      if (!t) continue;
      if (vKind && t.kind !== vKind) continue;
      if (neckCut && !neckCrossingTechnique(t)) continue;
      let w = this.pers.techPref[t0.name] * t.base;
      if (t.kind === 'thrust') w *= thrustBias;
      // 빈틈: 상대 칼이 높으면 아래·찌르기, 낮으면 위, 한쪽으로 치우치면 반대쪽
      const o = t.open;
      const up = o === 'UL' || o === 'UR' || o === 'H';
      const low = o === 'LL' || o === 'LR';
      let fit = 1;
      if (cls.high) fit *= low ? 1.8 : o === 'C' ? 1.6 : up ? 0.7 : 1;
      if (cls.low) fit *= up ? 1.6 : low ? 0.5 : 0.8;
      if (cls.right) fit *= o === 'UL' || o === 'LL' ? 1.5 : 0.8;
      if (cls.left) fit *= o === 'UR' || o === 'LR' ? 1.5 : 0.8;
      // 칼끝이 나를 겨누면: 위에서 그 칼을 눌러 비키며 베는 기술이 낫다. 찌르기는 서로 찔린다
      if (cls.online) fit *= t.presses ? 1.5 : t.kind === 'thrust' ? 0.5 : 0.9;
      if (why === 'finish') fit *= up ? 1.5 : 0.6; // 쓰러진 상대: 위에서 내려친다
      if (why === 'windup' || why === 'stepin') fit *= t.fast ? 1.6 : 1; // 짧은 순간: 빠른 기술
      if (why === 'stop') fit *= t.presses ? 2 : t.kind === 'thrust' ? 0.3 : 1; // 달려드는 몸을 맞받는다: 무거운 베기
      if (t.presses) fit *= 1 + 0.6 * this.anger; // 화나면 무거운 베기(분노의 베기·내려베기)만 찾는다
      // 고유 동작 상황 선호(schools.js unique 의 fit 칸, 10/9 13:xx): 상대 자세가 그 기술이 깨는 꼴이면 곱한다. 칸이 없으면 지나친다(셈 그대로)
      if (t.fit) for (const k in t.fit) if (k === 'parried' ? this.bound && !this.hitLanded : cls[k]) fit *= t.fit[k];
      w *= Math.pow(fit, 0.3 + 0.7 * L.read);
      if (prefer) w *= (t.kind === 'thrust' ? prefer.thrust ?? 1 : 1) * (t.fast ? prefer.fast ?? 1 : 1) * (t.presses ? prefer.presses ?? 1 : 1);
      // 준비 자세가 멀면 크게 들어 올려야 한다 (속내가 드러나고 늦다) → 짧은 기회일수록 지금 자세에서 바로 친다
      const cd = padDist(hand, t.from);
      const quick = why === 'recover' || why === 'stepin' || why === 'windup' || why === 'riposte' || why === 'stop';
      w *= Math.exp(-cd / ((quick ? 0.3 : 0.55) + 0.4 * (1 - L.read)));
      const noise = 0.2 + 0.5 * (1 - L.read);
      w *= rand(1 - noise, 1 + noise);
      if (w > bestW) {
        bestW = w;
        best = t;
      }
    }
    return best;
  }

  // ───────────────────────── 공격 ─────────────────────────
  /** 공격 시작. why: 어떤 기회였나 (recover/stepin/finish/patience/counter/...) */
  startAttack(tech, why, opt = {}) {
    if (!tech || !this.me.armed || this.me.stamina.exhausted || (STAMINA.on && this.staminaRest)) return false; // 칼이 없으면 칠 수 없다
    // 풍차 베기 AI 몫 (사장님 10/31 13:4x 'a는 기본 적용하고 c는 성향마다 달랐음 좋겠어. 싸움을 풀어가는 방식에 따라 자율적으로.' — 확인표 3133 · 3134):
    //  빠른 틈이거나(a) 기력이 이 성향의 감기 몫보다 적으면(c) 머리 위 돌려 베기 대신 바탕 동작(plain — 왼 가로베기 · 식는 동안과 같은 자리)
    if (tech.name === 'redondo') {
      const skip = this.rdSkipWhy(why, opt);
      if (skip) {
        const st = (this.stats.rdWind ??= { begin: 0, fire: 0, cancel: {} });
        (st.skip ??= {})[skip] = (st.skip[skip] ?? 0) + 1;
        tech = tech.plain ?? null;
        if (!tech) return false;
      }
    }
    if (this.secretRun && !opt.secret) this.secretAbort(); // 비기가 아닌 공격이 시작되면 비기는 끝 (보통은 걸쇠로 오지 않는다)
    if (!opt.chain && !opt.secret) this.restBefore = this.sense.t - this.lastAtkT; // 중국 연환삼격: 이번 칼 앞에 쉰 시간
    this.atkClash = false;
    this.atkWounds0 = this.foe.wounds?.length ?? 0; // 이베리아 '피해' = 이 칼이 상대에게 낸 벤 상처 (SECRET.iberianHurt 'wound')
    // 이베리아 (10/10): 맺힘 셋이 차 있으면 다음 공격(이어 치기 아닌 새 공격)이 비기 — 못 내면 원래 공격 그대로
    if (this.binds?.ready && !opt.chain && !opt.secret && !opt.passive && !opt.drill && !this.secretRun && this.mode !== 'secret' && this.me.state === 'stand' && this.secretGo(this.secret)) return true; // 헛스윙 연습 공격(opt.drill)은 비기로 바꾸지 않는다
    // 미룬 패시브(斂翅 물러남 끝 등 — 10/9 13:xx): 그 패시브가 나기 전에 내 공격 기회(되받기·seize·맞받기)가 오면 그 기회를 패시브가 가져간다
    //  (이어 치기·흐름·패시브가 낸 공격은 건드리지 않는다). 못 내면 원래 공격 그대로
    const PP = this.pendingPassive;
    if (PP && !opt.passive && !opt.chain && !opt.noPending) {
      this.pendingPassive = null;
      if (this.passiveGo(PP.P, null, PP.why ?? why)) return true;
    }
    const L = this.level;
    const hand = [this.me.handOffset.x, this.me.handOffset.y];
    // 이어 그을수록 강해짐 (강화동작 stack — 10/21, unique_assist.js strokeHitK): 앞 공격도 같은 기술이고 그 공격 꼴이 끝난 뒤 이어짐 창(afterWindow 0.6 s) 안에 다시 시작하면 하나씩(셋까지) — 플레이어와 같은 셈 · 난수 없음
    this.stackN = tech.name === this.prevAtkName && this.sense.t - this.lastAtkT <= UA.afterWindow ? Math.min(3, (this.stackN ?? 0) + 1) : 0;
    this.prevAtkName = tech.name;
    this.atkSeq++; // 특수 공격이 끝났나 보는 공격 번호 (10/29)
    this.mode = 'attack';
    this.drillAtk = !!opt.drill; // 시험: 헛스윙 연습 공격 — 그 자리에서 친다 (attack 다가가기·stepTime·moveFeet)
    this.tech = tech;
    this.why = why;
    this.hitLanded = false;
    this.bound = false;
    this.chain = opt.chain ?? 0;
    this.attackT = 0;
    this.stepT = 0;
    this.path.length = 0;
    this.pointBlocked = false;
    // 약한 자세 겨눔 (FINISH.vital): 목 가로 베기면 길이 목 앞을 지나는 손 높이·칼 기울기를 준비한다 (찌르기는 목·얼굴·머리 점 — startStrike). 끄면 늘 null
    this.vital = FINISH.vital && !opt.secret ? aiVitalPrepare(this, this.vitalS, tech) : null;
    this.techStepTry = false; // 기술 걸음을 이번 공격에 부탁해 봤나 (재기만)
    this.sideStepT = null; // 기술 걸음 'approach'(비껴 딛고 친다): 걸음을 부탁한 뒤 흐른 시간. null = 아직 (step 칸 없는 기술은 읽지 않는다)
    this.passiveAtk = null; // 패시브가 시작했으면 부른 쪽이 다시 적는다
    this.passiveLock = null; // 패시브가 시작했으면 passiveFired 가 다시 건다
    this.strikeTallied = false; // 이 칼의 맞힘·막힘을 이미 셌나 (비기가 길 끝에서 곧장 이을 때 — afterStrike 가 두 번 세지 않게)
    this.standoffArmed = true;
    if (!opt.chain) this.stats.attacks++;
    // 속임수: 먼저 다른 곳을 치는 척하다가 바꾼다 (상대가 잘 막을수록 자주)
    this.feint = null;
    if (!this.vital && !opt.noFeint && (why === 'patience' || why === 'open' || why === 'weak')) { // 약한 자세 겨눔 중엔 속이지 않는다 (샛별 쪽 그대로)
      const want = L.feint * (1 + Math.min(2, this.foeParried * 0.4));
      if (Math.random() < want * (1 - this.anger)) { // 화나면 속임수를 안 쓴다 (곧장 친다)
        const byName = this.school.techByName;
        const cands = this.school.feints.filter((f) => padDist(hand, byName[f.fake].from) < 0.45 && !this.specCooling(SPECIAL_FEINT.get(f.name))); // 식는 특수 공격 속임(날개 접기 · 칼끝 돌려 빼기)은 빼고 (10/29 19:4x)
        if (cands.length) {
          this.feint = cands[Math.floor(Math.random() * cands.length)];
          this.tech = byName[this.feint.fake];
          this.stats.feints++;
        }
      }
    }
    // 준비 자세가 가까우면 곧바로 친다 (숙련자는 크게 들어 올리지 않는다)
    const cd = padDist(hand, this.tech.from);
    this.phase = cd > 0.06 && !opt.skipChamber ? 'windup' : 'approach';
    this.quick = !SLOW_WHY.has(why); // 헛스윙 연습 공격도 보통 빠르기로 준비 자세를 잡는다 (읽히는 공격) — 셈은 SLOW_WHY (전 이 줄의 같은 다섯 이름)
    // 빈틈을 잡아 순간적으로 치는 공격(recover/stepin/press/counter/stop 등)은 준비 자세로 옮기는 손도
    //  빠르게 움직여야 한다. 느린 chamberSpeed로 챔버하면 정작 순간을 놓친다
    this.fastChamber = !!opt.fastChamber || this.quick;
    this.timer = this.phase === 'approach' && !this.quick ? realS(L.windup * 0.15) : 0; // 준비 자세 멈칫 = 실제 초
    // 풍차 베기 AI 몫 (사장님 10/31 08:xx '누가봐도 레돈두 준비처럼' — UNIQUE_ASSIST.rdAiWind): 머리 위 돌려 베기는 패드 길 대신 사람과 같은 감기로 (아래 rdWindTick)
    if (UA.rdAiWind && this.tech?.name === 'redondo' && !this.feint && !this.secretRun && this.me.sword && this.me.armed && !this.me.weaponBroken && !this.me.rdWind && !this.me.iai && !this.me.iaiReq) this.rdBegin(); // 부러진 칼은 옛 길 (사람도 부러지면 감기를 그만둠 — windStop 'armed')
    // 기술 알림: 고유 동작 이름은 칼이 실제로 나갈 때(startStrike — 10/9 13:xx 옮김). 패시브 이름은 passiveFired 가 여기(결정)에서
    return true;
  }

  /** 패시브가 낸 공격의 걸쇠 (0.5 s): 준비·다가가는 동안 새 위협에 공격을 거두지 않는다 (맞는 것은 물리 그대로 끊는다) */
  /** 공격적 기질 (기력 쉼 문턱과 같은 셈 — 공격 성향 pers.aggr × 실력 aggression > 1.15 면 기력 −10 까지 새 공격 · 아니면 20 에서 쉼) */
  get aggressiveTemper() {
    return this.pers.aggr * this.level.aggression > 1.15;
  }
  /** 이 AI 가 새 공격을 멈추고 물러나는 기력 (STAMINA.aiRestAt · aiAggressiveRestAt) */
  get restAt() {
    return this.aggressiveTemper ? STAMINA.aiAggressiveRestAt : STAMINA.aiRestAt;
  }

  /** 풍차 베기 감기 기력 아낌 0 ~ 1 (사장님 10/31 13:4x 'c는 성향마다 … 싸움을 풀어가는 방식에 따라 자율적으로' — 확인표 3134 · 셈은 사장님 확인 전):
   *  공격적 기질(aggressiveTemper) = 0(아끼지 않음 — 사람처럼 기력 0 까지 감고 저절로 내려침) · 아니면 규율(level.discipline — 간격을 지키는 정도, 1 위는 1) ×
   *  (1 − 지금 분노) × (1 − 지금 집념) — 발끈하거나 피를 보고 물고 늘어지는 동안은 덜 아낌 (감정 문턱 pers.angry · dogged 가 정함 · 감정 없는 바탕 AI 는 0) */
  rdThrift() {
    if (!UA.rdAiThrift || this.aggressiveTemper) return 0;
    return clamp(this.level.discipline ?? 0, 0, 1) * (1 - (this.anger ?? 0)) * (1 - (this.obsession ?? 0));
  }
  /** 감기 한 번 몫 기력: 감는 동안(rdDrain × '감음'까지 게임 초 windWoundT) + 내려침 베기(cutCost) — 츠바이핸더 안 B 12 + 12 = 24 */
  rdWindCost() {
    return UA.rdDrain * windWoundT(windSpec(this.me)) + STAMINA.cutCost;
  }
  /** 머리 위 돌려 베기를 감기 대신 바탕 동작으로 바꿀 까닭 — 'quick'(a) · 'low'(c) · null (감기 길 rdAiWind 일 때만 · 비기 칼 · 속임은 아님)
   *  (a) 빠른 틈 = this.quick 과 같은 셈(SLOW_WHY 밖의 why — 상대 헛친 뒤 recover · 들어옴 stepin · 맞받기 counter · stop · 이어 치기 follow · 패시브 …) 또는 이어 치기(opt.chain) — 감기 1.2 ~ 1.4 s 가 못 끝나는 틈
   *  (c) 기력 < 아낌 × (쉼 기력 restAt + 감기 한 번 몫) — 감고 벤 뒤에도 쉼 줄 위에 남을 만큼 (아낌 1 · 안 B = 44 · 규율 0.85 = 37 · 공격적 · 아낌 0 = 늘 감음) */
  rdSkipWhy(why, opt = {}) {
    if (!UA.rdAiWind || opt.secret) return null;
    if (UA.rdAiQuick && (!SLOW_WHY.has(why) || opt.chain > 0)) return 'quick';
    const S = this.me.stamina;
    if (STAMINA.on && !S.infinite && S.value < this.rdThrift() * (this.restAt + this.rdWindCost())) return 'low';
    return null;
  }

  get passiveLocked() {
    return !!this.passiveLock && this.mode === 'attack';
  }

  /** 걸음 결심: 패시브 걸쇠 또는 비기가 낸 공격 — 준비·다가가는 동안 새 위협에 거두지 않는다 (비기 없으면 passiveLocked 그대로) */
  get actLocked() {
    return this.passiveLocked || (!!this.secretRun && this.mode === 'attack');
  }

  /** 기술 알림을 몸에 적는다 (me.techCue — main.js 가 상대 것만 화면 가운데에 잠깐 보인다). 새 것이 옛 것을 덮는다. 난수·결정과 상관없음 */
  setTechCue(text, kind) {
    const T = TRADITIONS[this.art.tradition];
    this.me.techCue = { text, kind, school: this.art.tradition, schoolKo: T?.nameKo ?? '', t: performance.now() };
  }

  /**
   * 칼이 나가는 순간의 기술 알림 (startStrike): 유파 고유 동작이면 그 이름(kind 'unique' — 속임수면 속임수 이름으로 찾는다, 그때 tech 는 가짜 기술).
   *  패시브가 낸 공격이면 패시브 이름이 이미 떠 있어 덮지 않는다. 그 밖의 기술은 me.techAll 에만 적는다 — 설정 '모든 기술 이름 표시'(디버그, 기본 끔)일 때
   *  main.js 가 흐리게 보인다(공용 동작은 유파 말 이름 TECH_NAMES, 없으면 코드 이름). 난수·결정과 상관없음
   */
  strikeCue(t) {
    if (this.passiveAtk || this.secretRun) return; // 비기 이름은 비기를 낼 때 이미 떠 있다
    const key = this.feint ? this.feint.name : t.name;
    const U = this.uniqueByName.size ? this.uniqueByName.get(key) : null;
    if (U) {
      this.setTechCue(U.nameKo ?? U.feint?.name ?? U.name, 'unique');
      return;
    }
    const T = TRADITIONS[this.art.tradition];
    const text = this.feint ? this.feint.name : T?.techNames?.[t.name]?.name ?? t.name;
    this.me.techAll = { text, kind: 'all', school: this.art.tradition, schoolKo: T?.nameKo ?? '', t: performance.now() };
  }

  attack(dt, s, d, th) {
    const L = this.level;
    const me = this.me;
    const t = this.tech;
    this.attackT += dt;
    if (this.phase === 'rdWind') return this.rdWindTick(dt, d, th); // 풍차 베기 AI 몫 감기 (10/31 — 아래)
    if (this.phase === 'rdStrike') return this.rdStrikeTick();
    // 약한 자세 겨눔: 준비하는 동안 다시 본다 (늦게 본 모습으로). 빈틈이 닫히면 보정만 내려놓고 하던 공격은 그대로 (치기 시작한 뒤엔 고정)
    if (this.vital && !this.vital.started && (this.phase === 'windup' || this.phase === 'approach')) this.vital = aiVitalPrepare(this, s, t);
    if (this.phase === 'windup') {
      // 준비 자세로 (다가가며)
      this.hand.set(t.from[0], t.from[1]);
      this.handSpeed = this.fastChamber ? L.parrySpeed : L.chamberSpeed;
      if (this.secretRun) this.handSpeed *= this.secretVal(this.secretRun.S.do.hand ?? 'handSpeed'); // 비기: 손 속도 최대
      const LP = this.secretRun?.loop;
      if (LP?.length) {
        // 이베리아 휘돌림: 준비 자세(지붕 쪽)로 곧장 가지 않고 고리 점들을 차례로 돌아 들어간다 (베기 빠르기 × loopHand — 칼을 한 바퀴 휘돌림)
        this.hand.set(LP[0][0], LP[0][1]);
        this.handSpeed = L.strikeSpeed * this.secretVal(this.secretRun.S.do.loopHand ?? 'handSpeed');
        if (padDist([me.handOffset.x, me.handOffset.y], LP[0]) < 0.05) LP.shift();
        const LS = this.secretRun.loopStep;
        const g = me.gait;
        if (LS && this.attackT < 0.3 && g?.requestStep && g.active && me.state === 'stand') {
          // 휘돌리는 동안 옆(뒤)으로 비껴 딛는다 — 받을 때까지 0.3 s 안에서 다시 부탁
          const lead = Math.sign(g.legs[g.frontLeg(me.forward(_v2))].side) === Math.sign(LS.lat);
          if (g.requestStep({ kind: LS.kind ?? (lead ? 'lunge' : 'pass'), fwd: LS.fwd, side: LS.lat, duration: 0.35 })) this.secretRun.loopStep = null;
        }
      }
      // 준비하는 동안 상대 칼이 들어오면: 숙련자는 공격을 거두고 막는다 (패시브가 낸 공격은 걸쇠 0.5 s 동안 거두지 않는다 — passiveLock)
      if (th && !this.actLocked && this.noticedThreat(th) && this.respond(th, d)) return;
      // 비기 터뜨림 창 (10/9 3차 — do.release): 고리를 마친 뒤 거리가 창에 들 때까지 고리를 되풀이하며 붙잡고, 들면 그 순간 내려친다
      if (this.secretRun?.S.do.release && !LP?.length && padDist([me.handOffset.x, me.handOffset.y], t.from) < 0.05) {
        if (this.secretRelease(dt)) return;
        this.secretRun.loop = this.secretRun.S.do.loop.map((p) => p.slice()); // 몬탄테는 멈추지 않고 돈다 — 고리 되풀이
        return;
      }
      if (!LP?.length && padDist([me.handOffset.x, me.handOffset.y], t.from) < 0.03) {
        if (this.gnsW?.plan?.kind === 'feint') return this.abortAttack(); // 고노센 경계 속임 (10/25): 들기를 마치면 거둔다 (선 밖 — 상대 창 없음)
        this.phase = 'approach';
        this.timer = this.quick ? 0 : realS(L.windup * 0.25); // 잠깐 자세를 잡는다 (쉬운 상대일수록 길다 = 읽기 쉽다)
      }
      if (this.attackT > realS(1.2 + (this.secretRun?.S.do.release ? 2 : 0))) this.abortAttack(); // 터뜨림 창 비기는 붙잡는 몫만큼 더 (maxHold 가 먼저 끝낸다)
    } else if (this.phase === 'approach') {
      if (this.gnsW?.plan?.kind === 'feint') return this.abortAttack(); // 고노센 경계 속임 (10/25): 이미 준비 자세였으면 들기 없이 거둠
      this.hand.set(t.from[0], t.from[1]);
      this.timer -= dt;
      // 닿을 거리까지 다가간다. 베는 동안(0.3초) 서로 좁혀지는 거리까지 생각해서 미리 친다
      // 달려드는 상대를 맞받을 때는 조금 일찍 친다: 상대가 휘두르기 전에 내 칼이 먼저 앞에 있어야 한다 (Vor)
      this.need = this.M.contact + t.reach * this.reachScale + 0.05 + (this.why === 'stop' ? 0.2 : 0);
      if (this.secretRun?.S.do.lead) this.need += this.secretVal(this.secretRun.S.do.lead); // 비기 앞당김: 긴 길(脇 → 上段 → 真向)이 닿기까지 다가오는 상대를 셈 — 그만큼 일찍 친다
      if (this.gnsW?.plan?.kind === 'commit') this.need = Math.max(this.need, this.M.reach); // 고노센 경계 결행 (10/25): 내 칼끝 거리(간격 끝)에서 벤다 — 긴 칼은 상대 발도 선 밖에서
      // 기술 걸음 'approach'(유파 고유 동작 step 칸): 닿기 조금 전에 먼저 비껴 딛고, 발이 닿으면 곧장 친다 (step 칸 없는 기술은 이 줄을 지나치기만 한다)
      if (t.step?.when === 'approach' && !this.feint && !this.drillAtk && this.approachStep(dt, s, th, d)) return;
      if (this.timer <= 0 && (this.drillAtk || this.contactDist() <= this.need)) { // 헛스윙 연습 공격은 닿는 거리를 기다리지 않는다 (그 자리에서 — 허공)
        // 상대 칼끝이 나를 겨누고 있으면 베며 내딛지 않는다 (칼끝으로 뛰어드는 꼴). 먼저 그 칼을 쳐서 비킨다
        this.pointBlocked = s.state === 'stand' && this.foeClass(s).online;
        this.startStrike();
        return;
      }

      if (th && !this.actLocked && this.noticedThreat(th) && this.respond(th, d)) return;
      // 상대가 물러나 따라잡을 수 없거나 너무 오래 걸리면 그만둔다 (좀비처럼 쫓지 않는다)
      const keep = 1 + 0.5 * this.obsession; // 물고 늘어질 땐 접근을 쉽게 포기하지 않는다
      const hold = this.secretRun?.S.do.loop ? 1 : 0; // 이베리아 비기: 고리를 준비로 도는 몫만큼 1 s 더 버틴다 (다른 공격·비기는 0 — 같은 수)
      if (this.attackT > realS((this.chasing ? 3 : 1.4) * keep + hold) || d > this.holdDist() + (this.chasing ? 1.4 : 0.8) * keep + hold) this.abortAttack();
    } else if (this.phase === 'strike') {
      this.handSpeed = L.strikeSpeed;
      if (this.secretRun) this.secretStrike(dt); // 비기: 손 속도 배율 · 서보 힘 창 · 재기
      this.checkBind();
      // 진 · 츠바메가에시 (10/21 — 무기 비검 kin): 내려 벤 칼이 끝나 되돌림 몫(기술 chain 점부터)에 들면 남은 길을 끌고 가는 되돌림 칼로
      const SBk = me.weapon?.secretBlade;
      if (SBk?.kin && this.tech?.name === SBk.tech && !this.feint && !this.sbFired && this.path.length && this.path.length <= (this.tech.path?.length ?? 0) - (this.tech.chain ?? 0)) {
        this.sbFired = true;
        if (requestArtReturn(me, [me.handOffset.x, me.handOffset.y], this.path.map((p) => p.slice()), SBk)) this.path.length = 0;
      }
      if (BIND.natural && this.natPress(dt)) return; // 자연 바인드 실험 ②③: 막힌 칼을 노리던 자리로 밀고 · 독일은 느낌으로 감거나 밀고 들어감
      if (!this.path.length) {
        // 유파 비기 (10/9): 베기 길이 끝난 순간 — 비기가 이어 칠 수(連環·Duplieren)가 있으면 곧장, 첫 칼이 닿았으면 連環三擊 을 낸다
        if (this.secret && this.secretStrikeEnd(d)) return;
        // 흐름(SKILL.flow, 시제품): 칼이 막히지 않았으면 멈춰 서지 않고 지금 손에서 이어지는 베기로 곧장 흐른다
        if (SKILL.flow && this.flowOn(d)) return;
        // 손은 끝 자세에 닿았지만 무거운 칼은 아직 날아가는 중이다 → 칼이 지나갈 때까지 버틴다
        this.phase = 'follow';
        this.timer = 0.3;
      }
    } else if (this.phase === 'follow') {
      this.timer -= dt;
      if (this.secretRun) {
        me.powerMul = 1; // 서보 힘 창은 베기 길 동안만
        this.secretStrength(1);
        this.secretTrack();
      }
      this.checkBind();
      if (BIND.natural && this.natPress(dt)) return; // 자연 바인드 실험 ②③: 손이 길 끝에 먼저 닿고 무거운 칼이 아직 날아가다 막힌 때 (맞닿음 대부분이 이 단계)
      // 칼이 다 지나가고(칼끝이 느려지고) 나서 다음을 정한다
      if ((this.timer <= 0 && me.tipVel.length() < 6) || this.timer < -0.2) this.afterStrike(d);
    }
  }

  /**
   * 자연 바인드 실험 ②③ (BIND.natural — docs/strike/natural_bind_2026-10-11.md). 베는 중(phase strike) 칼끼리 맞닿으면:
   *  ② 미는 뜻 — 베기 길을 끝까지 따라가 칼을 지나쳐 버리지 않고, 손 빠르기를 BIND.pressSpeed 로 줄여 노리던 자리(길의 가운데 점 = 상대 빈틈)까지 밀고 거기서 멈춰 민다(pressAim — 손이 길 끝에 먼저 닿은 뒤 무거운 칼이 막힌 follow 단계도).
   *   막는 쪽 칼이 버티면 두 서보가 맞서 칼이 붙어 있고, 힘·각이 한쪽으로 기울면 칼이 미끄러져 떨어진다(물리의 결과) → 떨어지면 원래 손 빠르기로 길을 마저 간다.
   *  ③ 느낌 (독일만 — Lichtenauer 「Fühlen」·「Indes」·「Vor/Nach, Schwach/Stark」): 맞닿고 BIND.feelT 뒤 한 번 —
   *   상대가 세다(누르는 힘 feel.force ≥ BIND.strongN 이고 맞닿은 자리가 내 칼 약한 쪽 feel.at ≥ 0.5) → 감아 돌아감(Duplieren — 고유 동작, 없으면 가로베기) ·
   *   상대가 약하다(내 강한 쪽 at < 0.5 로 상대 칼을 쥠) → 밀고 들어감(밀기를 그치고 원래 빠르기로 빈틈까지) · 그 밖 → 계속 민다.
   *  10/31 본판(사장님 19:xx): 밀기 손 빠르기 · 상한은 성향에 따른 미는 뜻 w 를 곱함(pressWill — 바인드마다 처음 한 번).
   *  BIND.holdMax × w 를 넘도록 붙어 있으면 그만 밀고 길을 마저 간다(뗌). 끝난 방식은 me.natEnd = { why: slip|wind|push|release, t } (측정 도구가 읽는다). 비기 베기 동안은 하지 않는다.
   *  돌려줌: 이번 스텝을 다른 공격(감기)이 가져갔으면 true
   */
  natPress(dt) {
    const me = this.me;
    this.pressAim = null;
    if (this.secretRun) return false;
    const touch = !!me.feel?.touching && me.armed && this.foe.armed;
    // 10/31 고침: 밀기 칸은 this.natP — 10/11 판은 this.press 를 썼는데 10/24 부터 모르트슐라크 누르기 셈(mordTick)이 같은 칸이라, 켜면 독일 숙련 5 AI 의 누르기 · 창 셈을 베는 스텝마다 지우고 덮어썼다
    let P = this.natP;
    if (P?.tech !== this.tech || P?.n !== this.stats.attacks) P = this.natP = null; // 새 공격
    if (!touch) {
      if (P && !P.done && (P.gone += dt) > 0.034) {
        P.done = true; // 떨어짐 (4 스텝 — STEEL.rearmSteps 와 같은 틈): 밀어붙이던 중이면 밀어냄, 아니면 칼이 미끄러져 풀림
        this.natEndAs(P.push ? 'push' : 'slip');
      }
      return false;
    }
    if (!P) P = this.natP = { tech: this.tech, n: this.stats.attacks, t: 0, gone: 0, felt: false, done: false, push: false, w: this.pressWill() };
    if (P.done) return false;
    P.gone = 0;
    P.t += dt;
    if (P.t > BIND.holdMax * P.w) {
      P.done = true;
      this.natEndAs('release');
      return false;
    }
    if (this.art?.tradition === 'german' && !P.felt && P.t >= BIND.feelT) {
      P.felt = true;
      const at = me.feel.at ?? 1;
      if (at >= 0.5 && me.feel.force >= BIND.strongN) {
        const t = this.techNow(this.uniqueByName.get('duplieren') ?? null) ?? this.school.techByName?.zwerch; // 식는 동안은 가로베기 (10/29 19:4x)
        P.done = true;
        if (t && this.startAttack(t, 'follow', { chain: this.chain + 1, noFeint: true, skipChamber: true, noPending: true })) {
          this.natEndAs('wind');
          return true;
        }
        this.natEndAs('release');
        return false;
      }
      if (at < 0.5) P.push = true; // 상대가 약하다: 밀고 들어감 — 노리던 자리로 원래 손 빠르기로 (아래)
    }
    // 노리던 자리 = 찌르기는 길 끝(겨눈 곳), 베기는 길의 가운데 점(칼이 상대 몸을 지나는 곳) + 옆으로 비낀 상대 몫 (moveHand 와 같은 셈)
    const T = this.tech?.path;
    if (!T?.length) return false;
    const a = this.tech.kind === 'thrust' ? T[T.length - 1] : T[Math.floor((T.length - 1) / 2)];
    this.pressAim = [clamp(a[0] + clamp(this.foeLat, -0.4, 0.4) * 0.5, -0.6, 0.6), a[1]];
    this.pressAimT = this.sense.t; // 이 스텝에만 (모드가 바뀐 뒤 묵은 목표를 쓰지 않게)
    if (!P.push) this.handSpeed = Math.min(this.handSpeed, BIND.pressSpeed * P.w);
    if (this.phase === 'follow') this.timer = Math.max(this.timer, 0.05); // 미는 동안은 다음을 정하지 않는다
    return false;
  }

  /** 자연 바인드 끝난 방식 적기 (측정용 — 물리·난수 무관) */
  natEndAs(why) {
    this.me.natEnd = { why, t: this.sense.t };
    const N = (this.stats.natBind ??= { slip: 0, wind: 0, push: 0, release: 0, hold: 0 });
    N[why]++;
  }

  /** 자연 바인드 ② 막는 쪽: 이 막기에서 칼이 맞붙어 있는 동안(BIND.holdMax × 미는 뜻 w 까지) 막기를 끝내지 않는다 — 손은 막는 자리 패드(defend 가 둔 그대로)를 지키며 서보가 민다 */
  natHoldDef(dt) {
    const me = this.me;
    if (this.natDef?.id !== this.threatSeen) this.natDef = { id: this.threatSeen, t: 0, w: null };
    if (this.defVoid || !me.feel?.touching || !this.foe.armed) return false;
    this.natDef.w ??= this.pressWill(); // 이 막기에서 처음 붙은 때 한 번
    this.natDef.t += dt;
    if (this.natDef.t > BIND.holdMax * this.natDef.w) return false;
    this.timer = Math.max(this.timer, 0.05);
    return true;
  }

  /**
   * 자연 바인드 ②′ 미는 뜻 w (사장님 10/31 19:xx 'ai가 밀지의 여부는 기본적으로 키되 성향에 따라 그 정도가 조절되면 좋겠네' — config BIND.will · 셈 · 수는 사장님 확인 전 · 확인표 3313 ~ 3315):
   *  공격 성향(pers.aggr × level.aggression — aggressiveTemper 와 같은 곱) × 맞받기 성향(pers.vor) × 지금 감정(분노 · 집념은 더 밀고 · 공포는 덜)을 [lo, hi] 로 자름.
   *  치는 쪽 natPress: 밀기 손 빠르기 · 밀기 상한 × w / 막는 쪽 natHoldDef: 붙어 버팀 상한 × w. 성격 칸 · 감정 세기를 읽기만(난수 없음) · will.on 0 이면 1(10/11 실험 그대로)
   */
  pressWill() {
    const W = BIND.will;
    if (!W?.on) return 1;
    const a = 1 + W.aggrK * (this.pers.aggr * this.level.aggression - W.aggr0);
    const v = 1 + W.vorK * ((this.pers.vor ?? W.vor0) - W.vor0);
    const e = (1 + W.emoK * (this.anger ?? 0)) * (1 + W.emoK * (this.obsession ?? 0)) * (1 - W.emoK * (this.fear ?? 0));
    const w = clamp(a * v * e, W.lo, W.hi);
    const S = (this.stats.natWill ??= { n: 0, sum: 0, min: Infinity, max: -Infinity }); // 재기만 (측정 도구가 읽음)
    S.n++, (S.sum += w), (S.min = Math.min(S.min, w)), (S.max = Math.max(S.max, w));
    return w;
  }

  // ───────────────────────── 풍차 베기 AI 몫 (사장님 10/31 08:xx '풍차 b는 칼을 어깨 위로 올리거나 들지 않던데? 플레이어만 그런 건가? 누가봐도 레돈두 준비처럼 보여야해.') ─────────────────────────
  //  UNIQUE_ASSIST.rdAiWind (확인표 3127 · 기록 docs/strike/redondo_hold_2026-10-29.md §8-12): 머리 위 돌려 베기(redondo — 왼 가로베기 강화동작)를 고르면 사람과 같은 감기(iberian_redondo.js windStart —
  //   rdWindMode 꼴 · 물리 스텝마다 skill.js update 가 windStep 으로 두 팔 · 칼을 놓음)로 다가가며, 감은 셈 ≥ 1(사람 흐름 셈 '감음')이고 닿는 거리면 사람과 같은 내려침(requestArtRedondo — 곧장 사선).
  //   감는 동안: 발은 다가감(approach 와 같은 걸음) · 기력 rdDrain 초당(바닥이면 저절로 내려침 — 사람과 같음) · 위협을 보거나 맞거나 넘어지거나 칼을 세게 맞으면 그만둠(식힘 없음 — 사람 windStop) ·
  //   감음 뒤 rdAiMaxT 넘게 못 닿으면 그만둠. 뗀 밧줄은 내려침 · 덧씌우기 칸 내려놓기가 끝나면 다시 (rdKeep — update 머리)
  rdBegin() {
    const me = this.me;
    if (this.rd?.ropes) { windRopesBack(me, this.rd.ropes); this.rd.ropes = null; } // 앞 감기에 뗀 밧줄이 아직이면 먼저 되걸고
    windStart(me);
    this.rd = { ropes: null, fade: 0, wounds0: me.wounds?.length ?? 0, woundT: null };
    this.phase = 'rdWind';
    if (this.tech?.from) this.hand.set(this.tech.from[0], this.tech.from[1]); // 손 목표 = 오른 어깨 지붕 (그만두면 서보가 그리로 — 놓는 동안은 읽지 않음)
    (this.stats.rdWind ??= { begin: 0, fire: 0, cancel: {} }).begin++;
  }

  /** 감기 그만둠 (식힘 없음) — 팔 · 칼은 서보로 (덧씌우기 칸 0.12 s 에 내려놓음 · 밧줄은 그 뒤) */
  rdCancel(why) {
    const me = this.me;
    const R = windEnd(me, true);
    this.rd = { ...(this.rd ?? {}), ropes: R ?? this.rd?.ropes ?? null, fade: 0.12 };
    if (!me.alive || !me.armed) { windRopesBack(me, this.rd.ropes); this.rd.ropes = null; }
    const C = (this.stats.rdWind ??= { begin: 0, fire: 0, cancel: {} }).cancel;
    C[why] = (C[why] ?? 0) + 1;
  }

  /** update 머리: 감기 지킴(공격 꼴을 벗어났는데 감고 있으면 그만둠) · 덧씌우기 칸 내려놓기 · 뗀 밧줄 다시 걸기 (사람 holdTick 머리 · ropesBack 과 같은 셈) */
  rdKeep(dt) {
    const me = this.me;
    if (me.rdWind && !(this.mode === 'attack' && this.phase === 'rdWind')) this.rdCancel('mode');
    const R = this.rd;
    if (!R) return;
    const busy = !!me.iai || !!me.iaiReq || me.iaiHoldT > 0 || me.iaiFade > 0;
    if (R.fade > 0 && !busy && !me.rdWind) {
      R.fade = Math.max(0, R.fade - dt);
      const th = me.skill.thrustPose;
      th.w = Math.min(th.w, R.fade / 0.12);
    }
    if (R.ropes && !me.rdWind && !busy && !(R.fade > 0)) {
      windRopesBack(me, R.ropes);
      R.ropes = null;
    }
  }

  /** 감는 동안 (attack 꼴 · phase 'rdWind') */
  rdWindTick(dt, d, th) {
    const me = this.me;
    const W = me.rdWind;
    if (!W) return this.abortAttack();
    const stop = !me.alive || !me.armed || !me.sword || me.weaponBroken ? 'armed' : me.state !== 'stand' ? 'down' : (me.wounds?.length ?? 0) > this.rd.wounds0 ? 'hit' : me.jolt > 0.5 ? 'jolt' : null;
    if (stop) {
      this.rdCancel(stop);
      return this.abortAttack();
    }
    if (th && this.noticedThreat(th)) {
      // 상대 칼이 들어옴: 감기를 그만두고 막는다 (사람이 막기 단추로 그만두는 것과 같은 뜻)
      this.rdCancel('parry');
      if (this.respond(th, d)) return;
      return this.abortAttack();
    }
    const S = me.stamina;
    S.spent.wind ??= 0;
    S.spend('wind', UA.rdDrain * dt);
    if (STAMINA.on && !S.infinite && S.value <= 0) return this.rdFire('empty');
    const t = this.tech;
    this.need = this.M.contact + (t?.reach ?? 0) * this.reachScale + 0.05;
    // (c) 아끼는 성향 (10/31 13:4x — 확인표 3134): 기력이 아낌 × 쉼 기력(restAt) 아래로 내려가면 더 감지 않음 — 감았고 닿으면 지금 벰 · 아니면 그만둠 (아낌 0 = 사람처럼 0 까지)
    const keep = this.rdThrift() * this.restAt;
    if (STAMINA.on && !S.infinite && keep > 0 && S.value < keep) {
      if (W.turns >= 1 && this.contactDist() <= this.need) return this.rdFire('low');
      this.rdCancel('low');
      return this.abortAttack();
    }
    if (W.turns >= 1) {
      this.rd.woundT ??= this.attackT;
      if (this.contactDist() <= this.need) return this.rdFire('release');
      if (this.attackT - this.rd.woundT > UA.rdAiMaxT || d > this.holdDist() + 1.4) {
        this.rdCancel('far');
        return this.abortAttack();
      }
    } else if (d > this.holdDist() + 2.0) {
      this.rdCancel('far');
      return this.abortAttack();
    }
  }

  /** 내려침 (사람 windFire 와 같은 칼 — 운동학 · 식힘 · 기술 알림 · 기력) */
  rdFire(why) {
    const me = this.me;
    const W = me.rdWind;
    const R = windEnd(me, true);
    this.rd = { ...(this.rd ?? {}), ropes: R ?? this.rd?.ropes ?? null, fade: 0.12 };
    const ok = UA.enhance > 0 && requestArtRedondo(me, rdReleaseOpt(me, W, { share: specialShare('redondo'), maxT: UA.rdSnapTime, tech: 'redondo' })); // 사람 windFire 와 같은 길 고르기 (10/31 19:xx — 기본 멘 어깨에서 내려침 · rdAiOld 면 곧장 사선)
    if (!ok) {
      const C = (this.stats.rdWind ??= { begin: 0, fire: 0, cancel: {} }).cancel;
      C.noStrike = (C.noStrike ?? 0) + 1;
      return this.abortAttack();
    }
    me.stamina.attack('cut');
    this.phase = 'rdStrike';
    this.path.length = 0;
    // 기술 알림 = 사람 B4 와 같은 이름 (10/31 19:xx 사장님 '정수리 가르기 (알티바슈 포르트)' — 같은 감기 · 내려침이라 사람 표 이름 · 옛 패드 길 rdAiWind 0 은 schools.js 이름 그대로)
    const B4 = PLAYER_UNIQUE.iberian?.find((e) => e.name === 'redondo');
    if (B4?.nameKo && !this.passiveAtk && !this.secretRun) this.setTechCue(B4.nameKo, 'unique');
    else this.strikeCue(this.tech);
    const sp = this.specialNow();
    if (sp) this.specStart(sp);
    const st = (this.stats.rdWind ??= { begin: 0, fire: 0, cancel: {} });
    st.fire++;
    (st.why ??= {})[why] = (st.why[why] ?? 0) + 1;
  }

  /** 내려침이 끝날 때까지 (운동학 칼) → 뒤따름 (follow — 칼이 다 지나가면 afterStrike) */
  rdStrikeTick() {
    const me = this.me;
    if (me.iai || me.iaiReq) return;
    this.phase = 'follow';
    this.timer = 0.05;
  }

  abortAttack() {
    this.stats.aborted++;
    if (this.secretRun) this.secretAbort();
    this.mode = 'watch';
    this.phase = 'ready';
    this.guardTimer = realS(rand(0.2, 0.6));
  }

  startStrike() {
    const t = this.tech;
    this.me.stamina.attack(t.kind === 'thrust' ? 'thrust' : 'cut');
    this.phase = 'strike';
    this.path.length = 0;
    this.sbFired = false; // 진 · 츠바메가에시 되돌림 칼 (한 공격에 한 번)
    this.strikeCue(t); // 기술 알림 (고유 동작 — 칼이 실제로 나가는 순간)
    const sp = this.specialNow(); // 특수 공격 AI 몫이 나감 → 식힘 (10/29 19:4x — 사람과 같게)
    if (sp) this.specStart(sp);
    // 칼끝 돌려 빼기 심화 · 헛누름 (10/31 사장님 '1.2초로 할게' — config UNIQUE_ASSIST.cavArmSlow): 빼서 찌르기 패시브(칼이 맞물린 뒤 — parried · bindDef)가 나가는 순간 상대 두 팔 늦춤 ·
    //  칼끝 돌려 빼기가 숙련도 꾸러미에 든 AI 만(cavDeep — 곁눈 베기 무릎 꺾기 · 허리 베기 출혈처럼 AI 는 그 기술이 있으면 심화 이점도)
    if (this.passiveAtk === 'cavazione' && this.cavDeep && UA.cavArmSlowAi && UA.cavArmSlow > 0 && beginFlowRecovery(this.foe, this.me, UA.cavArmSlow)) this.stats.cavArmSlow = (this.stats.cavArmSlow ?? 0) + 1;
    if (this.feint) {
      // 속임수: 가짜 기술의 앞부분만 가다가(내딛지 않고) 진짜 길로 바꾼다
      const f = this.feint;
      const a = t.from;
      const b = t.path[0];
      this.path.push([a[0] + (b[0] - a[0]) * f.at, a[1] + (b[1] - a[1]) * f.at]);
      for (const p of f.then) this.path.push(p.slice());
      this.feintPts = 1;
      this.stepT = 0;
    } else {
      for (const p of t.path) this.path.push(p.slice());
      this.feintPts = 0;
      this.stepT = this.stepTime();
    }
    // 서툰 검객은 벨 때마다 손이 조금씩 빗나간다 (정확도 1이면 난수도 안 뽑아 예전과 같다)
    const prec = this.secretRun ? 1 : this.pers.precision; // 비기: 정확도 1 (그 한 번만)
    if (prec < 1) {
      const ex = rand(-1, 1) * 0.2 * (1 - prec);
      const ey = rand(-1, 1) * 0.15 * (1 - prec);
      for (const q of this.path) {
        q[0] = clamp(q[0] + ex, -0.6, 0.6);
        q[1] = clamp(q[1] + ey, -0.6, 0.6);
      }
    }
    // 웅크린 사람 (10/27 21:4x 사장님 — SECRET.gnsCrouchAim): 길을 그 몸 높이로 내린다 (난수 없음 · 서 있는 상대면 0 이라 그대로)
    const low = this.crouchLow();
    if (low > 0) for (const q of this.path) q[1] = clamp(q[1] - low, -0.6, 0.6);
    if (this.secretRun) this.secretRun.pathN = this.path.length; // 비기 서보 힘 창의 길 점 세기 (이베리아 powerFrom)
    if (this.secretRun && !this.secretRun.burst) {
      // 결정타 연출 (10/9 23:5x): 비기가 터뜨려지는 순간(그 비기의 첫 칼이 나감) — main.js 가 이 수가 바뀌면 화면 시간을 잠깐 늦춘다. 물리·난수와 상관없음
      this.secretRun.burst = true;
      if (this.secretRun.S.do.stance === 'lunge') startLunge(this.me); // 이탈리아 런지 자세 (10/10 04:2x)
      this.secretBursts = (this.secretBursts ?? 0) + 1;
    }
    // 베기가 끝나면 손은 끝 자세에 머문다 (이어 베기는 칼의 관성과 검술 층이 만든다)
    const end = this.path[this.path.length - 1];
    this.hand.set(end[0], end[1]);
    // 칼과 발: 손이 먼저 나가고 발이 뒤따라 내디뎌, 칼이 닿을 때쯤 발이 땅에 닿는다
    this.stepDelay = 0.04;
    this.requestedStep = false;
    // 찌르기 무기(weapons.js THRUST_STYLE: 에스톡·레이피어)는 찌르기 기술을 플레이어의 탭 찌르기와 같은 칼끝 찌르기로 한다
    //  (칼끝을 상대 가슴·머리로 맞추고 칼 선을 따라 뻗는다 — skill.js thrust). 다른 무기는 예전처럼 자세 지도의 길을 따라간다
    //  내딛기는 AI 가 정한다(stepTime·gaitStep) — 검술 층이 따로 내딛지 않게 step: false
    // 약한 자세 겨눔 (FINISH.vital): 치는 순간 보정·목표를 고정한다 (그 뒤 움직이는 상대를 따라가지 않는다). 찌르기는 탭 찌르기 길로 목·얼굴·머리 점을 찌른다
    const V = this.vital;
    if (V && !this.feint) {
      V.started = true;
      this.stats.vital = (this.stats.vital ?? 0) + 1;
      this.vitalStrike = { t: this.sense.t, kind: V.kind, zone: V.zone, tech: t.name };
    }
    if (t.kind === 'thrust' && !this.feint && (this.me.weaponCfg.thrustStyle || V?.kind === 'thrust')) {
      this.me.skill.thrust({ step: false, vital: V?.kind === 'thrust' ? V : null });
      // 이탈리아 찌르기 ③ (config THRUST.itLunge — 10/25): 팔만으로 안 닿으면(skill.js itMeasure > 0) 팔을 뻗은 뒤 몸 · 발이 따라가는 런지로 딛는다 — stepTime 이 0 이어도 (기술 걸음 'strike' 와 같은 STEP_T · 걸음은 gaitStep)
      if (this.me.skill.tap?.it?.fwd > 0) this.stepT = Math.max(this.stepT, STEP_T);
    }
    // 10/22 대검 마무리 (finish.js FINISH.cleave.ai, 기본 끔 — 끄면 이 줄은 아무것도 하지 않는다): 쓰러진 · 낮은 상대를 마무리하는 칼이면 플레이어 탭과 같은
    //  쪼개 내려치기 (skill.cleavePose). 마무리가 안 열리면(finishOnly) 그대로 기술 길만 간다
    else if (FINISH.cleave.ai && this.why === 'finish' && !this.feint && cleaveFinish(this.me)) this.me.skill.thrust({ step: false, finishOnly: true });
  }

  /**
   * 웅크린 사람을 칠 때 길을 내리는 몫 (패드 y — 손 높이 1 m 당 1 · fighter.js rawHand) (10/27 21:4x 사장님 '다른 건 네 말대로 하고' — SECRET.gnsCrouchAim):
   *  상대가 사람이고 반응 시간만큼 늦게 본 모습(lastSeen)이 고노센 웅크림(crouch = f.iaiReadyW > 0)이면 내 가슴과 그 상대 가슴의 높이 차(m — 낮을 때만).
   *  새 수 없음(실제 몸 높이). 서 있는 상대 · AI 끼리 · 끄면 0 (그대로)
   */
  crouchLow() {
    const s = this.lastSeen;
    if (!SECRET.gnsCrouchAim || !s || !(s.crouch > 0) || this.foe.aiControlled) return 0;
    return Math.max(0, this.me.bodies.chest.translation().y - s.cy);
  }

  /** 베며 내딛는 시간: 이미 닿는 거리면 내딛지 않는다 (다가오던 걸음의 관성으로 충분하다) */
  stepTime() {
    if (this.drillAtk) return 0; // 시험: 헛스윙 연습 공격은 내딛지 않는다 (whiff_drill.js)
    if (this.why === 'stop') return 0; // 상대가 달려오고 있다: 내가 들어갈 필요가 없다 (옆으로 비켜 선다)
    if (this.pointBlocked && !this.secretRun) return 0; // 칼끝부터 쳐서 비킨다. 들어가는 것은 그다음 칼(이어 치기)에서 (비기는 걸음 결심 — 그대로 딛는다)
    // 기술 걸음 'strike'(step 칸): 닿는 거리여도 딛는다 — 거리를 줄이려는 게 아니라 상대 칼끝 줄에서 벗어나려는 걸음
    if (this.tech.step?.when === 'strike') return STEP_T;
    if (this.me.gait?.P?.bow?.tech?.[this.tech.name]?.fwd) return STEP_T; // 중국 표두격: 닿는 거리여도 반걸음 내딛으며 친다(활 자세 — gait P.bow.tech). 칸 없으면 안 탐
    const short = this.contactDist() - this.M.contact - this.tech.reach * this.reachScale;
    return clamp(short * 0.8, 0, 0.3);
  }

  /**
   * 근접 밀치기 (docs/strike/shove_design_2026-09-30.md): 인물(persona.close = { rate, kind, then })만 정한다. 몸은 플레이어와 같은
   *  규칙(fighter.closeStep)이고 AI 는 스틱만 움직인다 (moveFeet). 시간·쿨다운 없이 사건마다 한 번 Math.random() < rate:
   *  E1 닿는 거리 안으로 들어섬, E2 칼이 맞물림(checkBind 와 같은 기하, 읽기만), E4 내 밀치기가 끝났는데 여전히 안쪽.
   *  kind 'kick'(랴오)도 같은 몸 부딪기 (발차기 명령·발 충돌이 없다). 기본 AI 는 첫 줄에서 돌아간다 (난수 없음)
   */
  closeQuarters(s, d) {
    if (!CLOSE.on || !this.persona.close) return;
    const me = this.me;
    const foe = this.foe;
    const C = this.persona.close;
    // 끝난 밀치기: fighter.closeStep 이 barge 를 지우고 까닭을 bargeEnd 에 남긴다 (같은 스텝에 발사·거절된 것은 shoves 로 본다)
    const ended = (this.closeWasBarge || me.shoves !== this.closeShoves) && !me.barge ? me.bargeEnd : null;
    this.closeWasBarge = !!me.barge;
    this.closeShoves = me.shoves;
    const up = me.state === 'stand' && foe.alive && foe.state === 'stand' && s.state === 'stand' && !foe.revival;
    // then 'pommel'(손잡이 찍기 시제품): 인물표에 쓰거나 CLOSE.pommelAll(주소 ?pommel=1)이면 persona.close 가 있는 모두. 기본 = 인물표 그대로
    const then = CLOSE.pommelAll ? 'pommel' : C.then;
    let cut = false;
    if (ended) {
      this.closeWant = false;
      // then 'cut': 밀고 곧장 벤다. 'recover' 는 손에서 가까운 기술, 'shove' 는 느린 이유 목록에 없어 바로 친다
      //  모르트슐라크를 내는 동안(10/24 — secretRun 'mord')은 밀치기가 끝나도 베지 · 찍지 않는다(검술 층이 칼을 쥠 — E4 굴림만)
      cut = ended !== 'refused' && then === 'cut' && up && this.mode !== 'attack' && this.secretRun?.stage !== 'mord' && this.startAttack(this.pickTech(s, 'recover'), 'shove', { noFeint: true, fastChamber: true });
      if (cut) this.closeEv.cut++;
      // then 'pommel': 밀고 곧장 폼멜로 찍는다 (베기 대신). 못 찍었으면(멀어짐·공격 중) 아래 E4 로 다시 굴린다
      else if (ended !== 'refused' && then === 'pommel' && up && this.secretRun?.stage !== 'mord') cut = this.closePommel('shove');
    }
    const inside = me.foeDistance() <= CLOSE.reach(me.armed ? me.weapon : null); // 실제 가슴 거리 (플레이어와 같은 안쪽)
    this.closeInside = inside;
    // 풀림: 안쪽 밖, 누군가 stand 아님, 발 묶임, 쓰러진 상대 간격(downGap) → 다시 되면 들어섬(E1)으로 본다
    if (!inside || !up || me.feetHeld || this.Mup) {
      this.closeWant = this.closeBind = false;
      this.closeIn = false;
      return;
    }
    // 거절, 막으며 물러섬(defVoid): 접는다. 안쪽에 있는 동안은 다시 들어섬으로 보지 않는다
    if (ended === 'refused' || (this.mode === 'defend' && this.defVoid)) {
      this.closeWant = this.closeBind = false;
      this.closeIn = true;
      return;
    }
    const roll = (ev) => {
      if (this.closeWant) return;
      // persona.close.pommel(확률, 시제품 — 인물표엔 아직 없음): 들어섬(E1)·칼 맞물림(E2)에서 밀지 않고 곧장 찍기를 먼저 굴린다
      if (C.pommel > 0 && ev !== 'E4' && Math.random() < C.pommel && this.closePommel(ev)) return;
      this.closeEv[ev]++;
      if (Math.random() < C.rate) {
        this.closeWant = true;
        this.closeEv.won++;
      }
    };
    if (!this.closeIn) roll('E1');
    this.closeIn = true;
    if (this.press?.go && !this.closeWant && !me.barge) {
      // 모르트슐라크 몸 붙이기 (10/24 — mordPressGo 가 이미 굴림): 닿는 거리 안에 들었으면 민다 (사건 굴림 없이)
      this.closeWant = true;
      this.closeEv.won++;
    }
    let bind = false;
    if (me.armed && foe.armed && me.tipPrev && foe.tipPrev) {
      me.bladePoint(0.1, _a0);
      foe.bladePoint(0.1, _b0);
      bind = segDist(_a0, me.tipPrev, _b0, foe.tipPrev) < 0.07; // checkBind 와 같은 기하 (this.bound 는 건드리지 않는다)
    }
    if (bind && !this.closeBind) roll('E2');
    this.closeBind = bind;
    if (ended && ended !== 'refused' && !cut) roll('E4'); // then 'none'(또는 벨 수 없었음): 여전히 안쪽이면 다시 굴린다
  }

  /**
   * 손잡이 찍기 (시제품, skill.pommel · config.js POMMEL): 붙은 거리(CLOSE.pommelDist 안)에서 폼멜로 찍는다. 공격 중이면 하지 않는다.
   *  기술 고르기·공격 상태는 건드리지 않는다 (덧씌우기가 손·칼끝을 맡는 동안 AI 의 손길은 그 아래에 깔린다). 시작했으면 true
   */
  closePommel(ev) {
    const me = this.me;
    if (this.mode === 'attack' || me.foeDistance() > CLOSE.pommelDist || !me.skill.pommel()) return false;
    this.closeEv.pommel = (this.closeEv.pommel ?? 0) + 1;
    this.stats.pommels = (this.stats.pommels ?? 0) + 1;
    this.lastPommel = ev; // 무엇 뒤에 찍었나 ('shove' 밀치기 끝 | 'E1' | 'E2') — 재기용
    return true;
  }

  /** 지금 베기 시작하면 칼이 닿을 때쯤의 거리 (서로 다가오는 빠르기 × 베는 시간, 멈춰 서는 몫은 뺀다) */
  contactDist() {
    // (쫓을 때는 도망치는 상대가 벌리는 거리도 셈에 넣는다: 그래야 닿기 전에 헛베지 않는다)
    const closing = Math.max(0, this.myClosing) * 0.7 + (this.chasing ? this.foeClosing : Math.max(0, this.foeClosing));
    return this.d - closing * this.M.cutTime;
  }

  /** 칼끼리 닿았나 (내 칼날과 상대 칼날 사이 거리) — 손에 느껴진다 */
  checkBind() {
    if (this.bound) return;
    const me = this.me;
    const foe = this.foe;
    if (!me.tipPrev || !foe.tipPrev) return;
    me.bladePoint(0.1, _a0);
    foe.bladePoint(0.1, _b0);
    if (segDist(_a0, me.tipPrev, _b0, foe.tipPrev) < 0.07) this.bound = true;
  }

  /** 친 뒤: 이어 치기(Nachschlag) 또는 물러나기(Abzug) */
  afterStrike(d) {
    const L = this.level;
    // 헛침(아래 패시브 사건 'missed' 와 같은 가름 — 몸에도 칼에도 안 닿음)이면 상대 걸음에 알린다: 독일 유파 몸이면 간격 잡기 받을 창(gait.js foeWhiff — 10/15).
    //  GAIT.deChase 0 이면 걸음 쪽이 아무것도 안 한다. 읽기·알림만(난수·이 AI 상태 그대로)
    if (!this.hitLanded && !this.bound) this.foe.gait?.foeWhiff();
    // 독일 인데스 (10/21 — school_passive.js foeFailed): 내 공격이 상대를 못 벰 — 헛침(위와 같은 가름) · 막힘(칼끼리 닿음) → 상대 몸에 되받아 칠 창. 읽기 · 알림만
    if (!this.hitLanded) this.foe.schoolPassive?.foeFailed(this.bound ? 'blocked' : 'whiff');
    // 티소나 '위세' (10/21 — stamina.js spendAweDrain): 위와 같은 '막힘'(못 벰 · 칼끼리 닿음)이면 막은 쪽 기력 − · 능력 없는 칼은 아무 일 없음
    if (!this.hitLanded && this.bound) spendAweDrain(this.me, this.foe);
    if (this.hitLanded && !this.strikeTallied) {
      this.stats.landed++;
      this.evLanded = true; // 감정층 사건: 맞혔다
    }
    if (this.bound && !this.hitLanded && !this.strikeTallied) {
      this.foeParried++; // 칼로 막혔다 → 다음엔 속임수가 통한다
      this.evParried = true; // 감정층 사건: 막혔다
    }
    // 유파 비기 (10/9): 비기의 베기가 끝났다 → 비기 몫으로 (이어 칠 수가 남았거나 경직). 비기가 아니면 끊기지 않은 베기를 세고, 비기(combo·firstHit)를 패시브보다 먼저 본다
    if (this.secretRun) {
      this.secretAfter(d);
      return;
    }
    if (this.secret) {
      this.combo++;
      if (this.binds) this.binds.strike(SECRET.iberianHurt === 'wound' ? (this.foe.wounds?.length ?? 0) > (this.atkWounds0 ?? 0) : this.hitLanded, this.bound || this.atkClash); // 이베리아 맺힘 셈: 칼끼리 닿고 피해 없음 +1 · 피해 0 · 헛침 그대로
      if (this.secretCombo(d) || this.secretFirstHit(d)) return;
    }
    // 모르트슐라크 몸 붙이기 'after' (10/24 14:2x — SECRET.mordNear): 내 칼이 막혀 맞물린 채(칼끼리 닿음 · 못 벰) 붙은 거리(M.clinch) 안에서 끝났으면 — 둘이 엉킨 채 가까움 — 인물 밀치기 확률로 이어 치기 · 물러남 대신 붙어 민다
    if (this.press && SECRET.mordNear && this.bound && !this.hitLanded && this.foe.alive && d < this.M.clinch && this.mordPressGo('after')) return;
    // 이어 치기(Nachschlag): 막히거나 헛쳤어도 이어 친다. 완전히 붙어 씨름하는 거리(0.75m 아래)만 거른다 —
    //  간격 끝(clinch 근처)에서도 짧게 이어 칠 수 있어야 몰아치는 상대에게 계속 밀리지 않는다
    const maxChain = this.obsession > 0.5 ? 3 : 2; // 물고 늘어질 땐 한 번 더 이어 친다
    const canChain = this.chain < maxChain && d < this.M.reach + 0.1 && d > this.M.clinch - 0.5 && this.foe.alive;
    // 패시브 (landed·parried·missed — 이 한 번의 부름에 한 번 굴린다. 이 유파에 그 사건의 패시브가 없으면 난수 없이 아래 그대로)
    const ev = this.hitLanded ? 'landed' : this.bound ? 'parried' : 'missed';
    const P = this.passives.length ? this.passiveFor(ev) : null;
    if (P && this.passiveRoll(P)) {
      if (P.do.withdraw) {
        // 残心 꼴: 이어 치지 않고 그 자세로 겨누며 길게 물러난다
        this.passiveFired(P);
        this.patience = Math.max(this.patience, rand(0.45, 0.75) * (1 - 0.7 * this.anger));
        this.startWithdraw(P.do.time ?? 0.9, P.do.withdraw);
        return;
      }
      if (canChain && this.passiveGo(P, null, 'follow', this.chain + 1)) {
        this.stats.followUps++;
        return;
      }
    }
    const want = (this.hitLanded || this.bound ? L.followUp : L.followUp * 0.4) + 0.2 * this.anger; // 화나면 더 이어 친다
    if (canChain && Math.random() < want) {
      // 지금 손 위치에서 바로 이어지는 기술 (다시 크게 들지 않는다)
      const hand = [this.me.handOffset.x, this.me.handOffset.y];
      let best = null;
      let bestW = -1;
      for (const t0 of this.school.tech) {
        const t = this.techNow(t0); // 식는 특수 공격 (10/29 19:4x)
        if (!t || t0 === this.tech || t === this.tech) continue;
        const cd = padDist(hand, t.from);
        if (cd > 0.35) continue;
        const w = this.pers.techPref[t0.name] * t.base * Math.exp(-cd / 0.2) * rand(0.6, 1.4);
        if (w > bestW) {
          bestW = w;
          best = t;
        }
      }
      if (best && this.startAttack(best, 'follow', { chain: this.chain + 1, noFeint: true })) {
        this.stats.followUps++;
        return;
      }
    }
    // 한 번 주고받았으니 다시 간을 본다 (인내심이 조금 돌아온다)
    this.patience = Math.max(this.patience, rand(0.45, 0.75) * (1 - 0.7 * this.anger)); // 화나면 간을 볼 참을성이 안 돌아온다
    this.startWithdraw(0.9 - 0.4 * this.obsession); // 물고 늘어질 땐 짧게만 물러난다 (막기는 그대로)
  }

  // ───────────────────────── 흐름 (SKILL.flow 시제품, 디렉터 10라운드 D) ─────────────────────────
  /**
   * 흐름으로 이을 베기 하나: 내려베기(presses: 분노의 베기·정수리 베기)를 먼저 찾는다 — 끝 자세(아래)에서 곧장 올려베면 약하다.
   *  준비 자세가 지금 손에서 멀수록 덜 고른다(flowReach m 을 한 바퀴 돌아가는 거리의 기준으로). 찌르기·방금 친 기술은 빼고
   */
  flowTech() {
    const hand = [this.me.handOffset.x, this.me.handOffset.y];
    let best = null;
    let bestW = 0;
    for (const t0 of this.school.tech) {
      const t = this.techNow(t0); // 식는 특수 공격 (10/29 19:4x)
      if (!t || t0 === this.tech || t === this.tech || t.kind === 'thrust') continue;
      const cd = padDist(hand, t.from);
      const w = this.pers.techPref[t0.name] * t.base * (t.presses ? 3 : 1) * Math.exp(-cd / (2 * SKILL.flowReach));
      if (w > bestW) {
        bestW = w;
        best = t;
      }
    }
    return best;
  }

  /**
   * 기술 t 로 흐른다: 멈춰 서서 자세를 잡지 않고, 손이 옆으로 한 바퀴 돌아(물레) 준비 자세를 지나 그대로 벤다.
   *  칼이 쉬지 않고 돌아 나가니 다음 베기도 제 무게를 싣는다 (8자: 분노의 베기 → 왼쪽 분노의 베기 → …)
   */
  flowInto(t, why, chain, extra) {
    const hand = [this.me.handOffset.x, this.me.handOffset.y];
    if (!this.startAttack(t, why, { chain, noFeint: true, skipChamber: true, noPending: true, ...extra })) return false; // extra: 비기가 잇는 수({ secret: true })
    this.stats.flows = (this.stats.flows ?? 0) + 1;
    this.startStrike();
    const mx = (hand[0] + t.from[0]) / 2;
    if (t.pre) {
      this.path.unshift(...t.pre.map((p) => p.slice()), t.from.slice()); // 연환삼격 이음새 고리 (10/10 04:4x — 물레 점 대신 머리 위 한 바퀴)
      if (this.secretRun) this.secretRun.powerFrom = 0; // 고리 동안은 힘 창 밖 — secretStrike 가 do.loopHand 빠르기로 (베기 길 점부터 힘·판정 배율)
    } else this.path.unshift([clamp(mx + Math.sign(mx || hand[0] || 1) * 0.12, -0.6, 0.6), (hand[1] + t.from[1]) / 2], t.from.slice());
    return true;
  }

  /** 베기가 끝났다: 칼이 막히지 않았고(안전장치) 상대가 간격 안이면 멈추지 않고 다음 베기로 흐른다 */
  flowOn(d) {
    if (this.bound || this.chain >= SKILL.flowChain || !this.foe.alive || d > this.M.reach + 0.1 || d < this.M.clinch - 0.5) return false;
    const t = this.flowTech();
    if (!t) return false;
    if (this.hitLanded) {
      this.stats.landed++; // afterStrike 를 건너뛰니 맞힌 것을 여기서 센다
      this.evLanded = true;
    }
    return this.flowInto(t, 'flow', this.chain + 1);
  }

  /** 막는 중: 칼끼리 지금 맞닿았으면(받아 냄) 받은 칼이 멈추지 않고 곧장 되받아 벤다 (예전엔 공격이 지나가길 기다렸다가 자세에서 다시 쳤다) */
  flowRiposte(d) {
    const me = this.me;
    const foe = this.foe;
    if (!me.tipPrev || !foe.tipPrev || !foe.alive || d > this.M.reach + 0.25 || d < this.M.clinch + 0.1) return false;
    me.bladePoint(0.1, _a0);
    foe.bladePoint(0.1, _b0);
    if (segDist(_a0, me.tipPrev, _b0, foe.tipPrev) > 0.07) return false;
    const t = this.flowTech();
    return !!t && this.flowInto(t, 'riposte', 0);
  }

  // ───────────────────────── 물러나기 ─────────────────────────
  /** 물러나기 시작. guardName(패시브 残心 꼴)을 주면 그 자세로 겨누며 물러난다(자세 고르기 굴림 없음) */
  startWithdraw(time, guardName) {
    if (this.secretRun) this.secretAbort(); // 비기 도중 물러나면(맞음·칼 놓침) 비기는 끝
    const fromPassive = this.mode === 'attack' ? this.passiveAtk : null; // 패시브가 낸 공격 끝의 물러남이면 같은 패시브를 다시 굴리지 않는다
    this.mode = 'withdraw';
    this.phase = 'ready';
    this.timer = realS(time); // 물러남 길이 = 실제 초 (부르는 쪽 0.4 ~ 1.2 · 패시브 do.time)
    this.path.length = 0;
    this.stepT = 0;
    // 물러남 끝 패시브(斂翅)는 지우지 않는다: 몰아치는 상대에게 물러나는 동안 막기·되물러남이 끼어도 끝에 들어간다 (공격을 시작하면 startAttack 이 지운다)
    if (guardName) {
      this.guard = this.passiveGuard(guardName) ?? this.guard;
      return;
    }
    // 물러나면서도 칼끝으로 겨눈다 (쟁기·긴 자세). 몰아치는 상대에겐 곧장 벨 수 있는 황소
    const W = this.school.withdraw;
    const pressed = this.foeAggro > 0.3 && Math.random() < this.foeAggro;
    const name = pressed ? W.pressed : Math.random() < 0.5 ? W.calm[0] : W.calm[1];
    this.guard = this.school.guards.find((g) => g.name === name);
    // 패시브 pressed (몰려 물러남 한 번에 한 번): 곧장 베고 물러나거나(돌려 물러남), 물러남 끝에 들어가 벤다(斂翅 at:'end')
    const P = pressed && this.passives.length && !this.pendingPassive ? this.passiveFor('pressed') : null;
    if (P && P.name !== fromPassive && this.passiveRoll(P)) {
      if (P.do.at === 'end') this.pendingPassive = { P, why: 'press', left: null }; // 물러남 끝까지 (left null = 시간 안 셈)
      else if (P.do.withdraw) {
        this.guard = this.passiveGuard(P.do.withdraw) ?? this.guard;
        if (P.do.time) this.timer = realS(P.do.time); // 패시브 물러남 길이도 실제 초 (startWithdraw 와 같음)
        this.passiveFired(P);
      } else if (!(this.foe.alive && this.d < this.M.reach + 0.2 && this.d > this.M.clinch && this.passiveGo(P, null, 'press'))) {
        this.pendingPassive = { P, why: 'press', left: LOCK_T }; // 간격 밖 → 확정: 0.5 s 안에 낼 수 있으면 낸다 (10/9 13:xx)
      }
    }
  }

  withdraw(dt, s, d, th) {
    const L = this.level;
    this.phase = 'ready';
    this.timer -= dt;
    if (th && this.respond(th, d)) return;
    if (this.pendingPassive?.left != null && this.passivePending(s, d)) return; // 미룬 패시브 (시간이 도는 것만 — 물러남 끝 것은 아래 끝에서)
    if (!this.drillOut && this.seize(s, d, dt)) return; // 헛스윙 연습 동안은 붙잡지 않는다 (whiff_drill.js)
    if (d < this.M.reach + 0.2) {
      // 아직 상대 칼이 닿는 거리: 상대가 칼을 든 쪽에서 올 베기를 가리며 물러난다 (준비 자세를 읽는다)
      const p = this.coverFor(s);
      this.hand.set(p[0], p[1]);
      this.handSpeed = L.parrySpeed * 0.7;
      this.coverLine = p === this.school.pose.point ? null : (COVER_LINES.find((k) => this.school.parry[k] === p) ?? null); // 덮개 watch 칸(독일 왕관)이 이 줄을 같은 꼴로 덮는다 — 읽기만, 손 목표는 그대로
    } else {
      this.hand.set(this.guard.pad[0], this.guard.pad[1]);
      this.handSpeed = 1.4;
    }
    if ((this.timer <= 0 && d > this.M.reach) || d > this.holdDist() - 0.05 || this.timer < -realS(1)) {
      this.mode = 'watch';
      this.guardTimer = realS(rand(0.3, 0.8));
      // 패시브 斂翅 꼴: 물러남 끝에 갑자기 들어가며 벤다 (굴림은 물러남을 시작할 때 이미 했다).
      //  지금 못 내면(상대가 서 있지 않음 등) 0.5 s 동안 간 보기에서 다시 본다 (10/9 13:xx — 막기·물러남이 끼어도 지워지지 않게)
      const PP = this.pendingPassive;
      if (PP) {
        if (PP.left == null) PP.left = LOCK_T;
        this.passivePending(s, d);
      }
    }
  }

  /**
   * 상대 준비 자세를 보고 올 베기를 미리 가리는 손 위치.
   * 상대가 칼을 자기 오른쪽 위에 들고 있으면 내 왼쪽 위로 온다 → 왼쪽에 칼을 세운다. 그 반대도 같다.
   */
  coverFor(s) {
    const PARRY = this.school.parry;
    if (s.hy > 0.15) {
      if (s.hx > 0.15) return PARRY.highL;
      if (s.hx < -0.15) return PARRY.highR;
      return PARRY.highC;
    }
    if (s.hy < -0.2) return s.hx >= 0 ? PARRY.lowL : PARRY.lowR;
    return this.school.pose.point; // 가운데: 칼끝으로 겨누고 있는다
  }

  /**
   * 공격 중에 상대 칼이 들어오는 걸 알아챘나: 같은 공격(threat id) 동안엔 한 번만 굴린다.
   * (매 물리 스텝마다 다시 굴리면 0.3초쯤 되는 베기 동안 수십 번 굴리는 셈이라 사실상 항상 알아채게 된다)
   */
  noticedThreat(th) {
    if (th.id !== this.readRollId) {
      this.readRollId = th.id;
      this.readRollOk = Math.random() < this.level.read;
    }
    return this.readRollOk;
  }

  // ───────────────────────── 막기 ─────────────────────────
  /**
   * 상대 칼이 들어온다 (th = { id, line, thrust }).
   * 한 공격에 한 번만 판단한다: 맞받아 벨지(Indes), 막을지, 물러나 피할지.
   */
  respond(th, d) {
    const L = this.level;
    if (this.me.parryLockUntil != null && this.me.fightT < this.me.parryLockUntil) return false; // 칼끝 돌려 빼기 C (10/31 시제품 — UNIQUE_ASSIST.cavParryLock · 기본 끔): 누르던 칼이 빠진 동안 반응을 새로 시작하지 못함 (이 위협은 묶음이 풀린 뒤 다시 봄)
    if (th.id === this.threatSeen) return false;
    this.threatSeen = th.id;
    if (Math.random() > L.guardChance) return false; // 못 봤거나 늦었다
    this.defLine = th.line;
    // 패시브 threat (이 위협에 한 번 — threatSeen 과 같은 번호): 맞받아치기 목록 바꿈·막기·피하기 강제. 없으면 난수 없이 아래 그대로
    //  맞받아치기 꼴(counter)은 간격(맞받아 벨 거리) 안에서만 굴린다 — 굴려 나오면 확정이라 굴림이 곧 낸 수가 되게 (10/9 13:xx)
    //  시험: 헛스윙 연습 동안(drillOut)은 패시브·맞받아 베기 없이 받기만 (whiff_drill.js — 내 헛스윙이 상대 칼을 쳐 그 칼이 내 쪽으로 튄 것도 위협으로 읽혀 맞받아 들어가 베곤 했다)
    const P = this.passives.length && !this.drillOut ? this.passiveFor('threat', th) : null;
    if (P && (!P.do.counter || this.counterRange(d)) && this.passiveRoll(P) && this.passiveThreat(P, th, d)) return true;
    // 1) 같은 순간에 맞받아 베기 (Indes): 들어오는 칼을 내 칼로 밀어내며 그대로 벤다 (겁먹으면 엄두를 못 낸다)
    if (!this.drillOut && Math.random() < L.counter * (1 - 0.8 * this.fear) && this.counterRange(d)) {
      const t = this.counterTech(th);
      if (t && this.startAttack(t, 'counter', { noFeint: true, skipChamber: true })) {
        this.stats.counters++;
        return true;
      }
    }
    this.mode = 'defend';
    this.phase = 'guard';
    this.path.length = 0;
    this.stepT = 0;
    this.defBindSeen = false;
    this.parryComboReset();
    // 2) 간격 끝에서 오는 공격, 찌르기는 물러나 헛치게 한다 (피하기). 가까우면 칼로 막는다
    const edge = d > this.foeReach - 0.35;
    const pVoid = edge || th.thrust ? 0.8 : 0.3;
    // 칼이 없으면 막을 수 없으니 물러난다. 겁먹었을 때도 칼로 받기보다 물러나 피한다
    this.defVoid = !this.me.armed || Math.random() < pVoid + (1 - pVoid) * this.fear * 0.8;
    if (this.defVoid) this.stats.voids++;
    else this.stats.parries++;
    this.timer = DEF_T;
    return true;
  }

  defend(dt, s, d) {
    const L = this.level;
    this.timer -= dt;
    if (!this.drillOut && this.timer < DEF_SEIZE && this.seize(s, d, dt)) return;
    const p = this.school.parry[this.defLine] || this.school.pose.point;
    this.hand.set(p[0], p[1]);
    this.handSpeed = this.defVoid ? L.parrySpeed * 0.6 : L.parrySpeed;
    this.checkBind();
    if (this.drillOut) {
      // 시험: 헛스윙 연습 동안은 받기만 (whiff_drill.js) — 막기 연환·버릇·되받기 없이, 칼이 지나가면 물러난다 (드릴 거리에서 곧 간 보기로)
      if ((this.noThreat > QUIET_T && Math.hypot(s.hvx, s.hvy) < 2.5 && this.timer < DEF_MIN) || this.timer <= 0) this.startWithdraw(0.6);
      return;
    }
    // 막기 연환 비기 (10/11 — schools.js *_SECRET_PARRY): 정한 자리로 받아 낸 막기 → 독일은 맞붙은 그 순간, 중국은 칼이 갈라진 순간 곧장. 버릇(bindDef)·흐름 되받기보다 먼저
    if (this.secret?.when === 'parry' && !this.defVoid && this.parryCombo(d, dt)) return;
    const pcWait = !!this.pcPend; // 기다리는 동안(중국 갈라짐 · 독일 붙음 이어짐)은 맞닿음에 거는 버릇·흐름 되받기를 걸지 않는다 (막기 연환이 그 자리를 맡음)
    // 패시브 bindDef (이번 막기의 처음 맞닿음에 한 번): 받은 칼로 곧장 (返し·cavazione)
    if (!pcWait && this.passives.length && !this.defBindSeen && this.passiveBindDef(s, d)) return;
    // 흐름(SKILL.flow): 칼로 받아 낸 순간(칼끼리 맞닿음) 받은 칼이 멈추지 않고 그대로 되받아 벤다
    if (!pcWait && SKILL.flow && SKILL.flowParry && !this.defVoid && this.flowRiposte(d)) return;
    if (BIND.natural && this.natHoldDef(dt)) return; // 자연 바인드 실험 ②: 칼이 맞붙어 있는 동안은 막는 자리를 지키며 민다 (BIND.holdMax 까지)
    // 공격이 지나갔다(칼끝이 더는 오지 않고 손이 멈췄다) → 상대가 다시 자세를 잡기 전에 되받아 친다 (Nach)
    const swingOver = this.noThreat > QUIET_T && Math.hypot(s.hvx, s.hvy) < 2.5;
    if ((swingOver && this.timer < DEF_MIN) || this.timer <= 0) {
      const riposte = d < this.M.reach + 0.25 && d > this.M.clinch + 0.1 && this.foe.alive && Math.random() < L.followUp;
      if (!(riposte && this.startAttack(this.pickTech(s, 'recover'), 'riposte', { noFeint: true }))) this.startWithdraw(0.6);
    }
  }

  /** 막기 연환 셈을 새 막기로 (막기에 들어갈 때 — respond·패시브 parry): 이 막기 동안의 내 상처 바탕 · 처음 맞닿음 봄 · 갈라짐 기다림 */
  parryComboReset() {
    this.pcW0 = this.me.wounds?.length ?? 0;
    this.pcDone = false;
    this.pcPend = null;
  }

  /**
   * 막기 연환 (10/11 — schools.js *_SECRET_PARRY, 플레이어 창 secret.js PlayerSecretWatch.parryTick 과 같은 조건): 이 막기에서 칼끼리 처음 맞닿은 스텝에 한 번 —
   *  그 사이 내 몸 상처 없음(막기 성공 · stats.parryOk) → 막은 줄(defLine)이 유파가 정한 자리이고 손이 그 자리 패드 0.15 안(secret.js parrySlotOf · stats.parrySlot) → 기다림(pcPend):
   *   독일(window 'bind'): 칼이 맞붙은 채 cond.min 초(SECRET.deBindMin)가 이어지면 그 순간 곧장 (떨어지면 없던 일) ·
   *   중국(window 'apart'): 칼이 갈라지는 스텝에 곧장. 기다리는 동안 상처면 없던 일. 냈으면 true. 굴림 없음
   */
  parryCombo(d, dt) {
    const S = this.secret;
    const me = this.me;
    const touch = BIND.natural ? bindTouch(me, this.foe) : bladesTouch(me, this.foe); // 자연 바인드 실험이면 넓은 맞부딪힘(2안)도 붙음으로 센다
    const hurt = (me.wounds?.length ?? 0) > this.pcW0;
    const P = this.pcPend;
    if (P) {
      if (hurt) this.pcPend = null;
      else if (S.cond.window === 'apart') {
        if (touch) {
          P.t += dt;
          return false;
        }
        this.pcPend = null;
        (this.stats.pcBinds ??= []).push(P.t); // 맞닿은 때부터 갈라질 때까지 (재기)
        return this.parryComboGo(S, P.slot, d, 0);
      } else if (!touch) {
        this.pcPend = null;
        (this.stats.pcBinds ??= []).push(P.t); // deBindMin 전에 떨어진 붙음의 길이 (재기)
      } else if ((P.t += dt) >= secretVal(S.cond.min)) {
        this.pcPend = null;
        return this.parryComboGo(S, P.slot, d, 0); // AI 는 창이 열린 순간 곧장 — 붙은 채 더 버티는 몫(어드밴티지)은 0
      }
      return false;
    }
    if (this.pcDone || !touch) return false;
    this.pcDone = true;
    if (hurt) return false;
    this.stats.parryOk = (this.stats.parryOk ?? 0) + 1;
    const slot = parrySlotOf(S, this.defLine, [me.handOffset.x, me.handOffset.y], this.school.parry);
    if (!slot) return false;
    this.stats.parrySlot = (this.stats.parrySlot ?? 0) + 1;
    this.pcPend = { slot, t: 0 };
    return false;
  }

  /** 막기 연환을 낸다 — 거리는 흐름 되받기(flowRiposte)와 같은 창. 창(기회) 수 stats.parryWin · held = 창이 열린 뒤 붙어 있던 시간 (독일 어드밴티지 — secret.js bindGain) */
  parryComboGo(S, slot, d, held) {
    this.stats.parryWin = (this.stats.parryWin ?? 0) + 1;
    if (!this.foe.alive || d > this.M.reach + 0.25 || d < this.M.clinch + 0.1) return false;
    return this.secretGo(S, { slot, held });
  }

  /** 맞받아 벨 거리: 간격 끝 + 0.3 m 안이고 붙은 거리(clinch + 0.1)보다 멀다 */
  counterRange(d) {
    return d < this.M.reach + 0.3 && d > this.M.clinch + 0.1;
  }

  /** 맞받아 베기에 쓸 기술: 들어오는 줄에 맞서 가운데를 차지하며 베는 기술 (지금 손에서 가까운 것). list = 패시브가 준 목록(이 꾸러미에 없는 이름은 건너뜀) */
  counterTech(th, list) {
    const hand = [this.me.handOffset.x, this.me.handOffset.y];
    const C = this.school.counter;
    const names = list || C[th.line] || C.default;
    let best = null;
    let bestD = 1e9;
    for (const n of names) {
      const t = this.techNow(this.school.techByName[n]); // 식는 특수 공격 (10/29 19:4x)
      if (!t) continue;
      const cd = padDist(hand, t.from);
      if (cd < bestD) {
        bestD = cd;
        best = t;
      }
    }
    // 준비 자세가 너무 멀면 제때 못 친다 → 그냥 막는다
    return bestD < 0.3 ? best : null;
  }

  // ───────────────────────── 위험 읽기 ─────────────────────────
  /**
   * 상대 칼끝·타격점이 지금 속도 그대로 0.45초 안에 내 몸(가슴 축 주위 0.55m 원통)에 닿는가.
   * 닿으면 { id, line(내 몸 어디로 오나), thrust }
   */
  threat(s, c, r, d) {
    if (d > this.foeReach + 0.9) return null;
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
    if (this.noThreat > NEW_THREAT_T) this.threatId++; // 잠깐 조용했다가 다시 오면 새 공격
    const lat = hit.hx * r.x + hit.hz * r.z; // + = 내 오른쪽
    // 찌르기: 칼끝이 칼날 방향으로 곧게 움직인다
    const bx = s.tx - s.mx;
    const by = s.ty - s.my;
    const bz = s.tz - s.mz;
    const along = (bx * hit.vx + by * hit.vy + bz * hit.vz) / ((Math.hypot(bx, by, bz) || 1) * hit.sp);
    const thrust = along > 0.75;
    let line;
    if (thrust) line = 'thrust';
    else {
      // 베기가 어느 쪽에서 올지는 칼끝을 내다보는 것보다 "어디서 칼을 들었었나"(준비 자세)가 더 확실하다.
      //  상대가 칼을 자기 오른쪽 위에 들었다가 휘두르면 내 왼쪽 위로 온다
      const ch = this.sense.seen(this.level.reaction + 0.15);
      if (ch.hy > 0.15) line = ch.hx > 0.15 ? 'highL' : ch.hx < -0.15 ? 'highR' : 'highC';
      else if (ch.hy < -0.2) line = ch.hx >= 0 ? 'lowL' : 'lowR';
      else if (hit.hy > -0.1) line = lat > 0.12 ? 'highR' : lat < -0.12 ? 'highL' : 'highC';
      else line = lat >= 0 ? 'lowR' : 'lowL';
    }
    return { id: this.threatId, line, thrust };
  }

  /**
   * 치려는 낌새: 간격 가까이에서 손을 빠르게 들어 올리거나(준비), 칼을 든 채 빠르게 다가온다.
   * 먼저 읽은 검객은 그 순간을 친다(Vor: 칼을 드는 순간은 빈틈) — 아니면 한 걸음 물러나 헛치게 한다.
   */
  preThreat(s, d, dt) {
    const L = this.level;
    const closing = Math.max(0, this.foeClosing);
    const raising = s.hvy > 1.6 && s.hy > 0.05; // 칼을 들어 올린다 (준비)
    const charging = closing > 0.9; // 달려든다
    const near = d < this.foeReach + closing * 0.4 + 0.3;
    if (!near || (!raising && !charging)) {
      this.preOff += dt;
      if (this.preOff > EV_REARM) this.preArmed = true;
      return false;
    }
    this.preOff = 0;
    if (!this.preArmed) return false;
    this.preArmed = false; // 한 번 몰아칠 때 한 번만 판단한다
    // 달려드는 것은 누구나 알아본다. 제자리에서 칼을 드는 낌새는 숙련될수록 잘 읽는다
    if (Math.random() > (charging ? Math.max(0.9, L.guardChance) : L.guardChance)) return false;
    // 패시브 foeRaise·foeCharge (이 낌새에 한 번 — preArmed 걸쇠): 치기 가지를 늘 고른다(prefer 는 기술 고르기 곱). 없으면 난수 없이 아래 그대로
    const P = this.passives.length ? this.passiveFor(charging ? 'foeCharge' : 'foeRaise') : null;
    if (P && (charging || d < this.M.reach + 0.3) && this.passiveRoll(P) && this.passiveGo(P, s, charging ? 'stop' : 'windup')) {
      this.stats.preempts++;
      return true;
    }
    // 달려드는 상대: 성격에 따라 들어오는 순간을 맞받아 베거나(Vor), 한 걸음 물러나 헛치게 한 뒤 친다(Nach).
    //  (물리로 재 보면 둘이 비슷하다: 맞받으면 서로 베일 때가 많고, 물러나면 첫 칼은 피하지만 붙은 싸움이 된다)
    // 제자리에서 칼을 드는 상대는 한 걸음 물러나 헛치게 하거나, 드는 순간을 먼저 친다
    // 계속 몰아치는 상대(foeAggro가 쌓여 있을수록)일수록 물러나기보다 맞받아치는 쪽으로 기운다 —
    //  성격은 그대로 두되, 지금 상대가 얼마나 몰아치는지를 보고 판단을 조금 더 얹는다
    const brave = 1 - 0.8 * this.fear; // 겁먹으면 맞받아치지 않고 물러난다
    const stopBias = Math.max(this.pers.vor, this.foeAggro * 0.75) * brave;
    const strike = charging ? Math.random() < stopBias : d < this.M.reach + 0.3 && Math.random() < (L.counter + 0.15) * brave;
    if (strike) {
      const t = this.pickTech(s, charging ? 'stop' : 'windup');
      if (t && this.startAttack(t, charging ? 'stop' : 'windup', { noFeint: true, fastChamber: true })) {
        this.stats.preempts++;
        return true;
      }
    }
    this.stats.voids++;
    this.startWithdraw(0.5);
    return true;
  }

  // ───────────────────────── 유파 비기 (10/9 유파 설계 v3 — schools.js *_SECRET, config.js SECRET, docs/strike/school_secret_2026-10-09.md) ─────────────────────────
  //  유파 = 기질(temper + 버릇 passives) + 비기(secret) + 동작(공용 + 고유). 비기는 조건이 차면 그 유파의 대표 동작을 '완벽 실행'한다 — **굴림이 없다**.
  //  완벽 실행 = 실행만: 반응 지연 0(상대 사건을 지금 모습 sense.seen(0) 으로 본다 — secretScan) · 정확도 1(startStrike) · 손 속도 최대(빠른 준비 + SECRET.handSpeed) ·
  //   걸음 결심(actLocked — 비기 동안 막기로 거두지 않는다) · 서보 힘 창(베기 길 동안만 me.powerMul = SECRET.power). 맞고 안 맞고는 물리가 정한다.
  //  자리: 상대 사건(threat·foeRaise·foeCharge·foeRecover)은 update 의 secretScan(모드 분기 앞 = 패시브 자리들보다 먼저) · 내 베기 사건(combo·firstHit)은
  //   베기 길 끝(secretStrikeEnd)과 afterStrike(패시브 굴림 앞). 끝나면 경직(SECRET.stiff — 공격·응답 없음, 칼은 그 자리에 멈춤, 걸음 없음 — 10/10 20:5x).
  //  재기: stats.secrets[이름] = { fired 낸 수, landed 맞힌 수(그 비기의 칼 가운데 하나라도 맞힘), E 맞힌 비기의 칼끝 추정 에너지 합 ½·m·v²(J), Emax }

  /** 칸 값: 문자열이면 SECRET 의 열쇠 (schools.js 는 수를 갖지 않는다) */
  secretVal(v) {
    return secretVal(v);
  }

  /** 비기 재기 칸 */
  secretStat(S) {
    const T = (this.stats.secrets ??= {});
    return (T[S.name] ??= { fired: 0, landed: 0, E: 0, Emax: 0 });
  }

  /** 상대 사건을 지금 모습으로 본다 (반응 지연 0). 사건 한 번에 한 번 — 조건이 안 찼으면 사건이 이어지는 동안 다시 본다. 냈으면 true */
  secretScan(dt, c, r) {
    const S = this.secret;
    const W = [].concat(S.when);
    const foeEv = W.includes('threat') || W.includes('foeRecover') || W.includes('foeRaise') || W.includes('foeCharge') || W.includes('inside') || W.includes('gilmok'); // inside: 이베리아 호 안쪽 (10/10 04:4x) · gilmok: 길목 경계 넘음 (10/11 v6)
    if (!foeEv) return false;
    const E = this.secretEv;
    const s0 = this.sense.seen(0);
    const dx = s0.cx - c.x;
    const dz = s0.cz - c.z;
    const d0 = Math.max(0.01, Math.hypot(dx, dz));
    const { on, ctx } = secretEvent(S, this.sense, this.foe, s0, c, r, d0, this.foeReach, this.me, { reach: this.gilArm ? gilmokLine(this.me, this.M.reach, S.do) : this.M.reach, dt, st: E, armed: !!this.gilArm?.armed, ...(SECRET.gnsWalkIn && SECRET.gnsEnterAI && SECRET.iai && this.iaiArm ? { enterLine: gnsEnterLine(this.M), iaiArmed: this.iaiArm.armed } : null) }); // 사건 판정은 플레이어 창과 같은 함수 (secret.js) · ex: 이베리아 호 안쪽 · 길목 (준비) · 일본 들어옴 (10/25 — SECRET.gnsEnterAI 일 때만 · 10/25 22:3x 들어옴 창 gnsWalkIn 0 기본이면 안 봄)
    if (!on) {
      E.off += dt;
      if (E.off > EV_REARM) E.armed = true;
      return false;
    }
    E.off = 0;
    if (ctx?.ev === 'gilmok') this.stats.gilWins = (this.stats.gilWins ?? 0) + 1; // 길목 창 (경계 넘음 사건 — 준비된 채) 수 (재기)
    if (!E.armed || !this.secretFree() || !this.foe.alive || s0.state !== 'stand' || !this.me.armed) return false;
    if (!this.secretCond(S, ctx, d0)) return false;
    if (!this.secretGo(S, { th: ctx, s: s0, d: d0 })) return false;
    E.armed = false;
    this.gilArm?.consume(); // 길목: 한 번 준비에 한 번
    return true;
  }

  /** 상대 칼끝 추정 에너지 ½·m·v² 의 최고 (지금부터 span 초 앞까지, 지금 모습 — 반응 지연 0) */
  foeRecentTipE(span) {
    return foeRecentTipE(this.sense, this.foe, span);
  }

  /** 비기를 낼 수 있는 꼴: 간 보기·물러남·막기, 또는 공격 준비·다가가기(패시브 걸쇠가 아닐 때) */
  secretFree() {
    const m = this.mode;
    if (m === 'watch' || m === 'withdraw' || m === 'defend') return true;
    if (m === 'attack' && this.phase === 'follow' && this.secret?.do?.flow && !this.secret.do.gilmok && !this.passiveLocked) return true; // 이베리아 흐름 (10/11): 손은 끝 자세에 닿고 칼이 아직 지나가는 중 — 그 칼을 이어받는다
    return m === 'attack' && (this.phase === 'windup' || this.phase === 'approach') && !this.passiveLocked;
  }

  /** threat() 와 같은 셈을 지금 모습으로 (위협 번호는 건드리지 않는다): { line, thrust, sp, E(칼끝 추정 에너지 ½·m·v²), high(상대 손이 높음) } 또는 null */
  threatNow(s, c, r, d) {
    return threatNow(this.sense, this.foe, s, c, r, d, this.foeReach);
  }

  /** 비기 조건 (cond) — 굴림 없음 */
  secretCond(S, ctx, d) {
    return secretCond(S, ctx, d, { reach: this.M.reach, foeReach: this.foeReach, clinch: this.M.clinch, contact: this.M.contact, armed: !!this.iaiArm?.armed }); // 플레이어 창과 같은 함수 (secret.js) · armed: 발도 대기 (일본)
  }

  /**
   * 싱지르 무장 · 내기 (10/24 사장님 02:5x '싱지르 ai에게도 열어' — SECRET.aiOpenSchools 'iberian' · 숙련도 AI_PROFICIENCY.secretAt 이상 · TRADITIONS.iberian.secret 'spin'):
   *  무장은 사람과 같은 셈(secret.js IaiArm — 상대 가슴이 내 칼끝 거리 M.reach 밖에 SECRET.ibSpin.armTime 초 · 들어와도 armGrace 초 남음 · 무장 동안 상처 나면 풀림 hurtDisarm) —
   *  공격 · 막기 · 비기 중이면 풀림(사람의 '휘두르면 풀림'과 같은 몫 · 발도 대기 iaiArm 과 같은 칸). 무장된 채 상대 가슴이 칼끝 거리 + SECRET.ibSpin.aiFire 안에 들면
   *  (지금 모습 — 반응 지연 0, 다른 비기 secretScan 과 같은 '완벽 실행') 칼 든 쪽으로 한 바퀴. 굴림 없음. 간 보는 거리(holdDist)는 바꾸지 않는다 — 무장은 물러났을 때 · 판 시작처럼 저절로 밖에 선 때 켜진다
   */
  spinTick(dt, kneeling) {
    const me = this.me;
    const s0 = this.sense.seen(0);
    const c = me.bodies.chest.translation();
    const d0 = Math.hypot(s0.cx - c.x, s0.cz - c.z);
    const nw = me.wounds?.length ?? 0;
    const hurt = !!SECRET.ibSpin.hurtDisarm && nw > this.spinW;
    this.spinW = nw;
    const busy = this.mode === 'attack' || this.mode === 'defend' || !!this.secretRun || this.drillOut || kneeling;
    this.spinArm.tick(dt, d0 > this.M.reach && !kneeling, busy || hurt || armHold(me)); // 판 시작 정지 동안 셈 0 (10/27 23:0x 사장님 '실제 공격이 가능해진 때부터')
    if (!this.spinArm.armed || busy || !this.secretFree() || !this.foe.alive || s0.state !== 'stand' || !me.armed || me.state !== 'stand') return false;
    if (d0 > this.M.reach + SECRET.ibSpin.aiFire) return false;
    return this.spinGo();
  }

  /** 기력이 0 이하라 비기를 거절 (사장님 10/30 08:2x · 18:3x — SECRET.secretStamina · 사람 창과 같은 규칙): 재기 stats.secretPoor (0.3 s 안 다시 거절은 한 번) · false */
  secretPoor() {
    const t = this.me.stamina.time ?? 0;
    if (!(t - (this.poorAt ?? -9) <= 0.3)) this.stats.secretPoor = (this.stats.secretPoor ?? 0) + 1;
    this.poorAt = t;
    return false;
  }

  /** 싱지르를 낸다 — 검술 층 skill.secret (사람과 같은 실행부: iberian_spin.js 대본 · 기력 · 굳음). 냈으면 true */
  spinGo() {
    const me = this.me;
    const S = this.secret;
    if (me.stamina.exhausted || (STAMINA.on && this.staminaRest) || secretSpent(me)) return false; // 판당 쓸 수 (10/29 19:5x)
    if (!me.stamina.secretReady) return this.secretPoor(); // 기력이 0 이하 (사장님 10/30 08:2x '기력이 모자라면 못써' · 18:3x '0 이하' — 사람과 같은 규칙 · 판당 쓸 수 안 씀)
    if (!me.skill.secret({ S, ctx: { ev: 'spin', turnDir: me.side >= 0 ? 1 : -1 } })) {
      this.stats.secretSkipped = (this.stats.secretSkipped ?? 0) + 1;
      return false;
    }
    this.spinArm.consume(); // 한 번 무장에 한 번
    this.secretRun = { S, stage: 'spin', t: 0, landed: false, peakE: 0, tr: this.art.tradition };
    this.mode = 'secret';
    this.phase = 'ready';
    this.path.length = 0;
    this.stepT = 0;
    this.hand.set(me.handOffset.x, me.handOffset.y);
    this.secretStat(S).fired++;
    useSecret(this.me); // 판당 쓸 수 셈 (10/29 19:5x — 사람 창과 같은 칸 fighter.secretUsed)
    this.secretBursts = (this.secretBursts ?? 0) + 1; // 결정타 연출 (터뜨림 = 낸 순간)
    this.setTechCue(S.nameKo ?? S.name, 'secret');
    return true;
  }

  /**
   * 모르트슐라크 누르기 · 창 · 내기 (10/24 사장님 12:0x 'ai도 비기 쓰게 해' — SECRET.aiOpenSchools 'german' · 숙련도 AI_PROFICIENCY.secretAt 이상 · TRADITIONS.german.aiSecret):
   *  셈은 사람과 같다(secret.js pressStep — 밀치기 누르기 fighter.barge 'press' 가 끊기지 않고 SECRET.mordPress 초 → 창 SECRET.playerWindow 초 · 창을 열면 셈 0 · 비기 · 굳음 동안 셈 0).
   *  창이 열린 동안 낼 수 있는 꼴이고(secretFree — 다른 비기와 같음) 상대 머리가 칼자루 길에 닿으면(mordschlag.js mordHeadReach) 곧장(반응 지연 0 — 다른 비기와 같은 '완벽 실행') 사람과 같은 실행부로 낸다.
   *  창을 놓치면(머리가 안 닿음 · 낼 수 없는 꼴) 사람처럼 지나간다. 굴림 없음
   */
  mordTick(dt, kneeling) {
    const me = this.me;
    const P = this.press;
    const busy = !!this.secretRun || this.drillOut || kneeling;
    // 몸 붙이기 (mordPressGo): 붙은 거리(clinch — 보통은 물러나는 거리)에 들면 인물 밀치기 확률로 물러나는 대신 붙어 민다
    const inC = this.d < this.M.clinch;
    if (inC && !P.inClinch && !busy && (this.mode === 'watch' || this.mode === 'withdraw')) this.mordPressGo('clinch');
    P.inClinch = inC;
    // 'bind' (10/24 14:2x — SECRET.mordNear): 붙은 거리 안에서 칼끼리 맞닿은 순간(바인드 — 막고 버팀 · 칼 맞대고 버팀) 간 보기 · 물러남 · 막기 중이면 인물 밀치기 확률로 붙어 민다
    if (SECRET.mordNear) {
      const touch = inC && !busy && bladesTouch(me, this.foe);
      if (touch && !P.touch && (this.mode === 'watch' || this.mode === 'withdraw' || this.mode === 'defend')) this.mordPressGo('bind');
      P.touch = touch;
    }
    // 밀치기(닿는 거리 사건 굴림 — closeQuarters)로 민 때도 누르기가 이어지는 동안 먼저 치지 않는다 (몸이 붙으면 계속 민다 — watch 걸쇠)
    if (me.barge && !P.go && !busy) {
      P.go = true;
      P.goWhy = 'barge';
    }
    // 몸 붙이기 끝: 밀치기가 끝났거나(어떤 까닭이든 — 그 뒤는 인물 then 그대로) · 밀기 전에 간 보기를 벗어났거나(막기 · 물러남 · 공격) · 상대가 칠 거리 밖으로 갔으면
    if (P.go) {
      if (me.barge) P.goBarge = true;
      else if (P.goBarge || busy || this.mode !== 'watch' || !this.foe.alive || this.foe.state !== 'stand' || this.d >= (SECRET.mordNear ? this.M.clinch : this.holdDist() + this.watchReachOut())) P.go = P.goBarge = false; // 14:2x: 상대가 붙은 거리 밖으로 떨어지면 끝(쫓지 않음) · 12:0x 판은 칠 거리 밖까지
    }
    if (P.win > 0) P.win -= dt; // 사람 창(PlayerSecretWatch.update)과 같은 차례: 창 시간을 먼저 줄이고 셈
    if (pressStep(P, dt, me.barge?.phase === 'press', busy, P.win > 0, secretVal(this.secret.cond.press), me.barge?.phase === 'step' ? me.barge : null)) { // step: 다시 시작한 밀치기 첫 걸음 동안 너그러움 시계 멈춤 (사람과 같은 셈 · 10/27 23:0x)
      P.win = SECRET.playerWindow;
      P.wins++;
    }
    if (!(P.win > 0) || busy || !this.secretFree() || !this.foe.alive || this.foe.state !== 'stand' || !me.armed || me.state !== 'stand') return false;
    if (!mordHeadReach(me)) return false;
    return this.mordGo();
  }

  /**
   * 모르트슐라크 몸 붙이기 (10/24 — 'ai도 비기 쓰게 해'): 이 인물은 몸이 붙는 때가 없었다(아르토리아 60 판 — 누르기 0 · 가슴 사이 가장 가까이 0.89 m > CLOSE.reach 0.77 ·
   *  상대가 붙은 거리 M.clinch 1.2 안에 들면 물러남). 그래서 인물의 밀치기 확률(persona.close.rate — 아르토리아 0.25, 닿는 거리 사건과 같은 굴림)로 몸을 붙인다.
   *  14:2x 판(SECRET.mordNear 1 — 사장님 '경합하다가 자연스럽게 가까워졌을 때 전략적으로 밀기'): 'clinch' 상대가 붙은 거리에 든 순간(간 보기 · 물러남 — 물러나는 대신) ·
   *   'bind' 붙은 거리 안에서 칼끼리 맞닿은 순간(간 보기 · 물러남 · 막기 — mordTick) · 'after' 내 칼이 막혀 맞물린 채 붙은 거리 안에서 끝난 순간(afterStrike) — 상대가 붙은 거리 밖으로 떨어지면 끝.
   *  12:0x 판(mordNear 0): 'watch' 간 보기에서 칠 때를 본 순간(베는 대신 — 멀리서 걸어 들어감) · 'clinch'.
   *  붙이기 = 닿는 거리 밖이면 그만큼 걸어 들어가(moveFeet — 붙은 거리에서는 반 걸음 안팎) 밀치기(closeQuarters — 굴림 없이 closeWant) → 밀치는 동안 먼저 치지 않음(watch 걸쇠). 새 값 없음. 붙이기로 갔으면 true
   */
  mordPressGo(why) {
    const C = this.persona.close;
    if (!CLOSE.on || !C || this.press.go || this.me.barge || this.me.stamina.exhausted || this.foe.state !== 'stand' || !this.me.armed) return false;
    if (!(Math.random() < C.rate)) return false;
    this.press.go = true;
    this.press.goWhy = why;
    this.press.goes = (this.press.goes ?? 0) + 1;
    const G = (this.stats.mordGo ??= {});
    G[why] = (G[why] ?? 0) + 1; // 재기: 붙이기로 간 사건별 수
    if (this.mode !== 'watch') {
      // 공격 끝(막힘 — afterStrike) · 물러남(붙은 거리)에서 간 보기로 돌아와 붙으러 간다
      this.mode = 'watch';
      this.phase = 'ready';
      this.path.length = 0;
      this.stepT = 0;
    }
    return true;
  }

  /** 몸 붙이기로 걸어 들어가는 중인가 (붙이러 간 뒤 아직 밀치기 전 — 걸어가며 치기 SECRET.mordWalkStrike 가 보는 때). 14:2x 판(mordNear 1)은 멀리서 걸어 들어가는 'watch' 만 —
   *  붙은 거리에서 붙는 반 걸음('clinch' · 'bind' · 'after')은 밀기의 일부(걸쇠). 12:0x 판은 밀치기 걸쇠 'barge' 밖 모두 */
  mordWalking() {
    const P = this.press;
    return !!P?.go && !P.goBarge && !this.me.barge && (P.goWhy === 'watch' || (!SECRET.mordNear && P.goWhy !== 'barge'));
  }

  /** 모르트슐라크를 낸다 — 검술 층 skill.secret (사람과 같은 실행부: 칼날 거꾸로 쥐기 · 운동학 길 · 기력 · 굳음). 냈으면 true */
  mordGo() {
    const me = this.me;
    const S = this.secret;
    if (me.stamina.exhausted || (STAMINA.on && this.staminaRest) || secretSpent(me)) return false; // 판당 쓸 수 (10/29 19:5x)
    if (!me.stamina.secretReady) return this.secretPoor(); // 기력이 0 이하 (사장님 10/30 08:2x '기력이 모자라면 못써' · 18:3x '0 이하' — 사람과 같은 규칙 · 판당 쓸 수 안 씀)
    if (!me.skill.secret({ S, ctx: { ev: 'press', held: this.press.pressHeld } })) {
      this.stats.secretSkipped = (this.stats.secretSkipped ?? 0) + 1;
      return false;
    }
    this.press.win = 0; // 창 하나에 한 번
    this.press.go = this.press.goBarge = false;
    this.secretRun = { S, stage: 'mord', t: 0, landed: false, peakE: 0, tr: this.art.tradition };
    this.mode = 'secret';
    this.phase = 'ready';
    this.path.length = 0;
    this.stepT = 0;
    this.hand.set(me.handOffset.x, me.handOffset.y);
    this.secretStat(S).fired++;
    useSecret(this.me); // 판당 쓸 수 셈 (10/29 19:5x — 사람 창과 같은 칸 fighter.secretUsed)
    this.secretBursts = (this.secretBursts ?? 0) + 1; // 결정타 연출 (터뜨림 = 낸 순간)
    this.setTechCue(S.nameKo ?? S.name, 'secret');
    return true;
  }

  /** 비기를 낸다 (조건은 이미 찼다). 냈으면 true — 기술이 꾸러미에 없거나 공격을 못 열면 false (아무것도 바꾸지 않는다) */
  secretGo(S, ctx = {}) {
    if (this.me.stamina.exhausted || (STAMINA.on && this.staminaRest) || secretSpent(this.me)) return false; // 판당 쓸 수 (10/29 19:5x)
    if (!this.me.stamina.secretReady) return this.secretPoor(); // 기력이 0 이하 (사장님 10/30 08:2x '기력이 모자라면 못써' · 18:3x '0 이하' — 사람과 같은 규칙 · 판당 쓸 수 안 씀)
    const D = S.do;
    const run = { S, stage: 'strike', t: 0, landed: false, peakE: 0, tr: this.art.tradition };
    const opt = { noFeint: true, fastChamber: true, noPending: true, secret: true };
    let ok = false;
    this.secretRun = run;
    if (D.break) {
      // 독일 Versetzen: 들어오는 줄을 깨는 비밀 베기 (찌르기는 상대 손 높이로 황소·쟁기를 가른다)
      const th = ctx.th;
      const key = th.line === 'thrust' ? (th.high ? 'thrustHigh' : 'thrust') : th.line;
      const C = this.school.counter;
      const t = this.passiveTech({ tech: D.break[key] ?? [] }) ?? this.passiveTech({ tech: C[th.line] || C.default });
      run.line = key;
      ok = !!t && this.startAttack(t, 'secret', opt);
    } else if (D.back) {
      // 일본 後の先 ①: 물러서며 칼을 오른 허리 뒤로 끌어 담는다 (공격은 ② 에서 연다)
      this.mode = 'secret';
      this.phase = 'ready';
      this.path.length = 0;
      this.stepT = 0;
      run.stage = 'back';
      // 10/10 순간 베기 (SECRET.instant): 물러남·담기·붙잡기 없이 곧장 — 이번 스텝 끝(combat.afterStep)에 내딛음·끝 자세·쓸린 자리 상처 (secret_instant.js)
      if (SECRET.instant && D.instant) {
        run.stage = 'instant';
        run.instant = true;
        run.t = 0;
        const end = D.tech.path[D.tech.path.length - 1];
        if (SECRET.iai) requestIai(this.me, SECRET.gnsEnterBlock ? { block: gnsBlockOf(ctx.th, this.me) } : undefined); // 10/10 발도: 대기 자세(왼 허리)에서 곧장 가로로 (secret_instant.js) · B(10/25 16:0x 켬): 천천히 걸어 든 들어옴 창 발도는 상대 칼에 막힐 수 있음 (사람과 같은 규칙)
        else requestInstant(this.me, { endPad: end });
        this.hand.set(end[0], end[1]);
        this.secretBursts = (this.secretBursts ?? 0) + 1; // 결정타 연출 (터뜨림 = 낸 순간)
      }
      ok = true;
    } else if (D.flow) {
      // 이베리아 멈추지 않는 흐름 (10/11 — schools.js IBERIAN_SECRET): 지금 손 자리·움직임(걸러진 손 목표 속도)을 이어받아 번갈아 올려베기 → 머리 위 돌려 큰 한 칼.
      //  수마다 flowInto(이음새 없이 — 앞 수 끝에서 곧장). 칼이 지나가던 공격(follow)을 이어받으면 그 칼의 맞힘·막힘을 여기서 센다(afterStrike 를 건너뜀)
      if (this.mode === 'attack' && this.phase === 'follow') this.secretTally();
      const v = this.me.skill.aimVel;
      run.queue = montanteFlowSeq([this.me.handOffset.x, this.me.handOffset.y], [v.x, v.y], D, this.me); // f: 길목 디딤을 그 순간 간격으로 (secret.js gilmokSeq)
      ok = this.secretNext();
    } else if (D.path && SECRET.iberianSweep) {
      // 이베리아 휩쓸기 (10/10 02:5x): 사이드스텝 + 머리 위 큰 고리 + 사선 — 이번 스텝 끝부터 SECRET.iberianSweepTime 동안 (secret_instant.js, 발도와 같은 틀)
      this.mode = 'secret';
      this.phase = 'ready';
      this.path.length = 0;
      this.stepT = 0;
      run.stage = 'instant';
      run.instant = true;
      run.t = 0;
      requestSweep(this.me, { side: this.pers.circleDir });
      this.secretBursts = (this.secretBursts ?? 0) + 1;
      ok = true;
    } else if (D.path) {
      // 이베리아 휘돌려 내려치기: 지금 손 자리에서(준비 자세로 가지 않음) 옆으로 비껴 딛고('approach' 기술 걸음 — 발이 닿으면) 고리 → 지붕 → 내려치기.
      //  옆 방향 = 성격의 즐겨 도는 쪽(circleDir — 굴림 없음). 앞으로 내딛기는 보통 베기와 같다(stepTime)
      const hand = [this.me.handOffset.x, this.me.handOffset.y];
      const lat = this.secretVal(D.side ?? 0) * this.pers.circleDir;
      const back = this.secretVal(D.sideBack ?? 0); // 옆걸음의 앞뒤 (음수 = 뒷발을 비껴 뒤로 — 돌아 빠지며 휘돌릴 틈을 만든다, gait 'retreat')
      // loop 칸이 있으면: 고리는 준비(windup)로 돌고(attack 의 windup 이 loop 점을 차례로), 베기 길은 지붕 쪽 준비 자세(from)에서 내려치기만 — 닿는 거리에서 친다
      const from = D.loop ? D.loop[D.loop.length - 1] : hand;
      //  loop 이면 옆걸음은 고리를 도는 동안(곧장 — 빠지며 휘돌려 틈을 만든다), 아니면 'approach'(먼저 비껴 딛고 친다)
      const t = { name: S.name, nameKo: S.nameKo, from, path: D.path, open: D.open ?? 'H', kind: 'cut', reach: D.reach ?? 0, base: 1, presses: true, ...(lat && !D.loop ? { step: { lat, fwd: back, when: 'approach', ...(back < 0 ? { kind: 'retreat' } : {}) } } : {}) };
      run.powerFrom = D.powerFrom ?? 0;
      if (D.loop) {
        run.loop = D.loop.map((p) => p.slice());
        if (lat) run.loopStep = { lat, fwd: back, kind: back < 0 ? 'retreat' : null };
      }
      ok = this.startAttack(t, 'secret', { ...opt, skipChamber: !D.loop });
    } else if (D.combo) {
      // 막기 연환 (10/11): 막은 자리(ctx.slot)의 두 수를 이음새 고리 없이 곧장 (pre [] — 앞 수 끝에서 다음 수 준비 자세로 바로), 걸음 칸은 SECRET 열쇠를 읽는다
      const C = D.combo[ctx.slot];
      run.queue = (C?.seq ?? []).map((t) => ({ ...t, step: t.step ? { ...t.step, fwd: this.secretVal(t.step.fwd) * (t.step.back ? -1 : 1) } : undefined })); // back = 반걸음 물러남 (10/12 3 연격 마지막 수)
      run.slot = ctx.slot;
      if (S.cond?.window === 'bind') run.gain = bindGain(ctx.held ?? 0); // 독일: 붙어 있던 만큼 판정 배율·힘 창을 키움 (secret.js bindGain)
      if (D.fast && this.secretVal(D.fast) && run.queue.length) {
        // 중국 빠른 연환 (10/12 — SECRET.cnFast): 두 수를 운동학 팔·칼로 길을 따라 (secret_instant.js requestCombo — 플레이어와 같은 실행부). 결과는 순간 베기와 같은 칸(instant)
        this.mode = 'secret';
        this.phase = 'ready';
        this.path.length = 0;
        this.stepT = 0;
        run.stage = 'instant';
        run.instant = true;
        run.t = 0;
        const last = run.queue[run.queue.length - 1].path;
        run.end = last[last.length - 1];
        this.hand.set(run.end[0], run.end[1]);
        requestCombo(this.me, { moves: run.queue.splice(0) });
        this.secretBursts = (this.secretBursts ?? 0) + 1;
        ok = true;
      } else ok = this.secretNext();
    } else if (D.seq) {
      // 중국 連環三擊 (10/9 23:5x '보이는 삼연격'): 첫 칼이 맞은 뒤 큰 호의 세 수(腰擊 → 撩掠 → 坦腹刺)를 이음새 0 으로 — 수마다 반걸음 進步
      run.queue = D.seq.map((t) => ({ ...t, step: t.step ? { ...t.step, fwd: this.secretVal(t.step.fwd) } : undefined }));
      run.first = { tech: this.tech?.name, landed: this.hitLanded };
      ok = this.secretNext();
    } else if (D.next) {
      // 중국 連環三擊: 이미 닿은 첫 칼 뒤에 두 수 — 차례는 첫 수의 무리로
      const g = D.group?.[this.tech?.name] ?? 'default';
      run.queue = (D.next[g] ?? D.next.default).map((x) => x.slice());
      run.first = { tech: this.tech?.name, landed: this.hitLanded }; // 첫 칼(이미 닿음)은 비기 맞힘에 넣지 않는다 — 비기 몫은 잇는 두 수
      ok = this.secretNext();
    } else if (D.tech) {
      // 이탈리아 Passata in contratempo: 고유 passata sotto 길 + 걸음 덧씌움 (뒷발 지나 보내기)
      const base = this.school.techByName[D.tech];
      const st = D.step ? { ...D.step, fwd: this.secretVal(D.step.fwd), push: this.secretVal(D.step.push) } : null;
      ok = !!base && this.startAttack(st ? { ...base, step: st } : base, 'secret', opt);
    }
    if (!ok) {
      this.secretRun = null;
      this.stats.secretSkipped = (this.stats.secretSkipped ?? 0) + 1;
      return false;
    }
    this.me.stamina.secret();
    this.secretStat(S).fired++;
    useSecret(this.me); // 판당 쓸 수 셈 (10/29 19:5x — 사람 창과 같은 칸 fighter.secretUsed)
    this.binds?.reset(); // 이베리아: 비기를 내면 맺힘 셈 0
    this.setTechCue(S.nameKo ?? S.name, 'secret');
    return true;
  }

  /** 내 칼끝 추정 에너지 ½·m·v² (J) — 독일 문턱과 같은 잣대 */
  secretOwnE() {
    const v = this.me.tipVel;
    return 0.5 * (this.me.swordProps?.m ?? 1.5) * (v.x * v.x + v.y * v.y + v.z * v.z);
  }

  /** 비기 베기 길 동안 (attack strike): 손 속도 배율 · 서보 힘 창 · 맞힘·칼끝 에너지 재기 */
  secretStrike(dt) {
    const run = this.secretRun;
    const D = run.S.do;
    run.t += dt;
    const done = (run.pathN ?? this.path.length) - this.path.length; // 지난 길 점 수 (이베리아 — 고리를 지난 뒤부터 힘)
    const powered = run.powerFrom == null || done >= run.powerFrom;
    // 손 속도·힘 배율은 비기마다(do.hand·do.loopHand·do.power — SECRET 열쇠, 없으면 공통 handSpeed·power). 이베리아는 고리 동안 loopHand, 내려치기에 hand·power
    this.handSpeed *= this.secretVal(powered ? D.hand ?? 'handSpeed' : D.loopHand ?? D.hand ?? 'handSpeed');
    this.me.powerMul = powered ? this.secretVal(D.power ?? 'power') * (run.gain ?? 1) : 1; // run.gain: 독일 막기 연환 붙은 시간 어드밴티지 (없으면 1 — 다른 비기는 전과 같음)
    this.me.secretHit = powered ? SECRET.hitMul * (run.gain ?? 1) : 1; // 결정타 판정 어드밴티지: 상처 에너지 배율 (combat.js) — 따라 지나감까지, 경직·끊김에서 1
    // 보조 힘·속도(do.strength — 사장님 '필요하다면 보조 속도와 힘 제공'): 그 베기 구간만 몸의 힘(me.strength)을 올린다 — 손목 힘·손목 빠르기 한계(√힘)·팔 힘이 함께 오른다
    if (D.strength) this.secretStrength(powered ? this.secretVal(D.strength) : 1);
    this.secretTrack();
  }

  /** 보조 힘: 몸의 힘을 난이도 값 × k 로 (k 1 = 되돌림). 비기가 끝나거나 끊기면 늘 1 로 */
  secretStrength(k) {
    this.me.strength = this.level.strength * k;
  }

  /** 비기 칼의 재기 (베기 길·따라 지나감 동안): 맞혔나 · 칼끝 추정 에너지 최고 */
  secretTrack() {
    const run = this.secretRun;
    run.peakE = Math.max(run.peakE, this.secretOwnE());
    if (this.hitLanded) run.landed = true;
  }

  /** 베기 길이 끝난 순간: 비기의 다음 수(連環·Duplieren)로 곧장, 또는 連環三擊 을 낸다. 맡았으면 true */
  secretStrikeEnd(d) {
    const run = this.secretRun;
    if (!run) return this.secretFirstHit(d, true);
    if (this.hitLanded) run.landed = true;
    // 이베리아 흐름 (10/11): 손 목표는 토막 끝에 닿았어도 실제 칼이 그 자리에 갈 때까지(flowGate, 최대 FLOW_GATE_MAX — 맞혔으면 곧장) 다음 토막을 열지 않는다 — 기다리는 동안 손은 끝 자리를 당긴다.
    //  v6 길목 지키기의 한 칼은 마지막 토막에도 문이 있다(칼끝이 반대쪽으로 건너갈 때까지 힘 창을 쥔 채 당김) — v5 의 마지막 토막은 문이 없어 전과 같다
    if (run.queue && this.tech?.gate) {
      run.gateT0 ??= this.sense.t;
      if (!flowGate(this.me, this.tech.gate) && !this.hitLanded && this.sense.t - run.gateT0 < FLOW_GATE_MAX) return true; // 이 토막이 맞혔으면 기다리지 않는다
      run.gateT0 = null;
    }
    if (run.queue?.length) {
      this.secretTally();
      return this.secretNext();
    }
    return this.secretBind(d, true);
  }

  /** 길 끝에서 곧장 이으면 afterStrike 를 건너뛰니 이 칼의 맞힘·막힘을 여기서 센다 (flowOn 과 같은 몫, 한 번만) */
  secretTally() {
    if (this.strikeTallied) return;
    this.strikeTallied = true;
    if (this.hitLanded) {
      this.stats.landed++;
      this.evLanded = true;
    } else if (this.bound) {
      this.foeParried++;
      this.evParried = true;
    }
  }

  /** 독일: 비기 칼이 맞물렸으면(막힘) 물러나지 않고 Duplieren 으로 곧장 (한 번) */
  secretBind(d, tally) {
    const run = this.secretRun;
    const B = run.S.do.bind;
    if (!B || run.bindDone || !this.bound || this.hitLanded || !this.foe.alive || d > this.M.reach + 0.1 || d < this.M.clinch - 0.5) return false;
    const t = this.school.techByName[B];
    if (!t) return false;
    run.bindDone = true;
    if (tally) this.secretTally();
    return this.flowInto(t, 'secret', this.chain + 1, { secret: true });
  }

  /** 連環三擊 의 다음 수: 차례 목록에서 손에서 가까운 기술로 멈추지 않고 흐른다 (flowInto — 이음새 지연 0) */
  secretNext() {
    const run = this.secretRun;
    while (run.queue.length) {
      const q = run.queue.shift();
      const t = Array.isArray(q) ? this.passiveTech({ tech: q }) : q; // 이름 목록이면 꾸러미의 것, 객체면 비기 길 그대로 (連環三擊 세 수)
      if (t && this.flowInto(t, 'secret', this.chain + 1, { secret: true })) return true;
    }
    return false;
  }

  /** 중국 firstHit: 들어가며 친 첫 칼(이어 치기·맞받기·되받기 아님)이 닿았다(맞힘 또는 맞물림) */
  secretFirstHit(d, tally) {
    const S = this.secret;
    if (S.when !== 'firstHit' || this.secretRun || this.chain !== 0 || !firstHitOk(S, this.restBefore, this.hitLanded, this.bound)) return false; // 맞았을 때만(cond.landed) · 그 앞에 내 공격 없이 chineseRest 초 이상 (secret.js — 플레이어 창과 같은 함수)
    const w = this.why;
    if (w === 'counter' || w === 'riposte' || w === 'follow' || w === 'flow' || w === 'secret' || this.passiveAtk) return false;
    if (!this.foe.alive || d > this.M.reach + 0.1 || d < this.M.clinch - 0.5) return false;
    if (tally) this.secretTally();
    return this.secretGo(S);
  }

  /** 이베리아 combo: 끊기지 않은 내 베기가 SECRET.comboN 번 (afterStrike 가 센 뒤) — 이어 치기 거리 안 */
  secretCombo(d) {
    const S = this.secret;
    if (S.when !== 'combo' || this.combo < SECRET.comboN || !this.foe.alive || d > this.M.reach + 0.1 || d < this.M.clinch - 0.5) return false;
    if (S.cond?.touch && !(this.hitLanded || this.bound)) return false; // cond.touch: 마지막 베기가 닿음(맞힘·맞물림) — 10/9 23:5x 발동 줄이기
    if (!this.secretGo(S)) return false;
    this.combo = 0;
    return true;
  }

  /** 비기 칼의 afterStrike: 남은 수가 있으면 잇고, 없으면 경직 */
  secretAfter(d) {
    const run = this.secretRun;
    if (this.hitLanded) run.landed = true;
    if (run.queue?.length && this.secretNext()) return;
    if (this.secretBind(d)) return;
    this.secretStiffen();
  }

  /** 비기 직후 경직: 공격·응답 없음, 칼(손 목표)은 경직이 시작된 자리에 멈춤, 걸음 없음 (mode 'secret' stage 'stiff' — 사장님 10/10 20:5x '손 빠르기 줄이지 말고 잠깐 아예 못 움직이게': moveHand·moveFeet 가 막고 검술 층(skill.js update)이 걸러진 손 목표를 붙든다) */
  secretStiffen() {
    const run = this.secretRun;
    const st = this.secretStat(run.S);
    if (run.landed) {
      st.landed++;
      st.E += run.peakE;
      st.Emax = Math.max(st.Emax, run.peakE);
    }
    this.me.powerMul = 1;
    this.me.secretHit = 1;
    if (run.S.do.strength) this.secretStrength(1);
    this.mode = 'secret';
    this.phase = 'ready';
    this.path.length = 0;
    this.stepT = 0;
    run.stage = 'stiff';
    run.t = SECRET.stiff[run.tr] ?? realS(0.3);
    this.hand.set(this.me.handOffset.x, this.me.handOffset.y); // 경직이 시작된 자리 (끝나면 물러남이 새 목표를 준다)
  }

  /** mode 'secret': 일본 ① 물러서며 끌어 담기 → ② 공격 열기 · 경직 → 残心(일본, 맞혔으면) 또는 물러남 */
  secretUpdate(dt, s, d) {
    const run = this.secretRun;
    const L = this.level;
    if (!run) {
      this.mode = 'watch';
      return;
    }
    if (run.stage === 'spin' || run.stage === 'mord') {
      // 싱지르 (10/24): 실행은 검술 층 skill.sec — 사람과 같은 길(iberian_spin.js 대본 → 따라 지나감 → 굳음 SECRET.stiff.iberian). 손 · 발은 쥐지 않고(moveHand · moveFeet) 끝나기를 기다린다
      //  모르트슐라크 (10/24): 같은 꼴 — 검술 층(mordschlag.js · 운동학 길 → 굳음 SECRET.stiff.german)이 손을 쥐고, 발은 누르기가 이어지면 그대로 민다(굳음 동안만 멈춤 — moveFeet)
      const sec = this.me.skill.sec;
      if (sec?.landed) run.landed = true;
      if (sec) return;
      if (run.landed) this.secretStat(run.S).landed++;
      this.secretRun = null;
      this.me.powerMul = 1;
      this.me.secretHit = 1;
      this.startWithdraw(0.6, this.school.withdraw.calm[0]); // 한 번 주고받았으니 다시 간을 본다 (다른 비기 굳음 끝과 같은 꼴)
      return;
    }
    if (run.stage === 'back') {
      const B = run.S.do.back;
      run.t += dt;
      this.hand.set(B.guard[0], B.guard[1]);
      this.handSpeed = L.parrySpeed * this.secretVal(run.S.do.hand ?? 'handSpeed');
      const g = this.me.gait;
      if (!run.stepAsked && run.t < 0.25 && g?.requestStep && g.active && this.me.state === 'stand') {
        if (g.requestStep({ kind: 'retreat', fwd: this.secretVal(B.fwd), side: 0, duration: 0.3 })) run.stepAsked = true;
      }
      const handIn = padDist([this.me.handOffset.x, this.me.handOffset.y], B.guard) < 0.06;
      const footDone = !g?.req || run.t > 0.6;
      if ((handIn && footDone && run.t > 0.15) || run.t > 0.8) {
        if (run.S.do.release) {
          run.stage = 'hold'; // 脇構え 로 담은 채 거리가 터뜨림 창에 들 때까지 붙잡는다 (10/9 3차)
          run.t = 0;
          run.holdT = 0;
        } else this.secretMen();
      }
      return;
    }
    if (run.stage === 'hold') {
      const B = run.S.do.back;
      this.hand.set(B.guard[0], B.guard[1]);
      this.handSpeed = L.parrySpeed;
      this.secretRelease(dt);
      return;
    }
    if (run.stage === 'instant') {
      // 순간 베기 결과를 기다린다 (요청한 스텝 끝에 실행됨): 맞았으면 맞힘으로 세고 곧장 경직
      const R = this.me.instantResult;
      const end = run.S.do.tech ? run.S.do.tech.path[run.S.do.tech.path.length - 1] : (run.end ?? null); // run.end: 중국 빠른 연환 둘째 수 끝
      if (end) this.hand.set(end[0], end[1]);
      this.handSpeed = L.parrySpeed;
      if (!R) return;
      if (!R.ok) {
        this.secretAbort();
        return;
      }
      run.landed = R.hit;
      run.peakE = R.energy; // (순간 베기는 칼끝 추정 대신 그 상처 에너지 J)
      if (R.blocked) { const T = this.secretStat(run.S); T.blocked = (T.blocked ?? 0) + 1; } // 이베리아 휩쓸기가 막혀 밀어냄 (재기)
      this.secretStiffen();
      return;
    }
    if (run.stage === 'stiff') {
      run.t -= dt; // 칼·발은 moveHand·moveFeet 가 멈춰 둔다 (전: 겨눔 자세 쪽으로 손 빠르기 ×stiffHand — 순간 베기는 칼끝 떨어뜨린 stiffPose 쪽으로. 10/10 20:5x 없앰)
      if (run.t > 0) return;
      const zan = run.landed ? run.S.do.zanshin : null;
      this.secretRun = null;
      this.me.powerMul = 1;
      if (zan) this.startWithdraw(1.2, zan); // 残心: 맞혔으면 중단(中段)으로 칼끝을 겨눈 채 길게 물러난다
      else this.startWithdraw(0.6, this.school.withdraw.calm[0]); // 한 번 주고받았으니 다시 간을 본다 (자세 굴림 없음)
    }
  }

  /** 일본 後の先 ②: 真向 공격을 열고(脇構え 에서 곧장) 곧바로 친다 — release 창에서 부를 때는 그 순간 터뜨린다 */
  secretMen(now) {
    const run = this.secretRun;
    const D = run.S.do;
    const t = { ...D.tech, reach: this.secretVal(D.tech.reach), step: { ...D.step, fwd: this.secretVal(D.step.fwd), push: this.secretVal(D.step.push) } };
    run.stage = 'strike';
    run.t = 0;
    if (!this.startAttack(t, 'secret', { noFeint: true, fastChamber: true, skipChamber: true, noPending: true, secret: true })) {
      this.secretAbort();
      return false;
    }
    if (now) this.startStrike();
    return true;
  }

  /**
   * 터뜨림 창 (do.release = { dist: SECRET 열쇠 [lo, hi] — 내 간격 끝 reach 기준, maxHold: SECRET 열쇠 s }): 준비를 마친 비기가 붙잡고 있다가
   *  닿을 때 거리(지금 모습 거리 − 서로 다가오는 빠르기 × SECRET.releaseT)가 창에 들면 그 순간 터뜨린다. maxHold 가 지나면 창 위 끝보다 가까우면 치고, 멀면 거둔다.
   *  발: 붙잡는 동안 secretHoldFeet 가 잔걸음으로 맞춘다(moveFeet). 터뜨렸으면 true
   */
  secretRelease(dt) {
    const run = this.secretRun;
    const R = run.S.do.release;
    const [lo, hi] = this.secretVal(R.dist);
    run.holdStart ??= this.sense.t; // 붙잡기 시작 (이베리아는 고리 끝마다 보니 시계로 잰다)
    run.holdT = this.sense.t - run.holdStart;
    const dc = this.secretDistAtHit();
    run.holdDc = dc;
    run.holdLo = this.M.reach + lo;
    run.holdHi = this.M.reach + hi;
    const inWin = dc >= run.holdLo && dc <= run.holdHi;
    const timeUp = run.holdT > this.secretVal(R.maxHold);
    if (!inWin && !timeUp) return false;
    if (!inWin && dc > run.holdHi) {
      // 멀다 — 거둔다 (경직 없음)
      this.stats.secretHeld = (this.stats.secretHeld ?? 0) + 1;
      this.secretAbort();
      this.startWithdraw(0.4, this.school.withdraw.calm[0]);
      return true;
    }
    run.releaseD = dc;
    if (run.S.do.back) return this.secretMen(true);
    // 이베리아: 지붕에서 곧장 내려친다 (내딛기는 보통 베기처럼 stepTime)
    this.startStrike();
    return true;
  }

  /** 지금 터뜨리면 닿을 때 거리: 지금 모습(반응 지연 0) 거리 − (상대가 다가오는 빠르기 + 내가 다가가는 빠르기 × 0.7) × SECRET.releaseT */
  secretDistAtHit() {
    const s0 = this.sense.seen(0);
    const c = this.me.bodies.chest.translation();
    const dx = s0.cx - c.x;
    const dz = s0.cz - c.z;
    const d0 = Math.max(0.01, Math.hypot(dx, dz));
    const foeIn = -(s0.vx * dx + s0.vz * dz) / d0;
    return d0 - (Math.max(0, foeIn) + Math.max(0, this.myClosing) * 0.7) * SECRET.releaseT;
  }

  /** 붙잡는 동안의 발 (moveFeet): 창보다 멀면 반걸음 앞으로, 가까우면 이베리아는 맞닿기 거리 밖으로 물러나고(고리가 스치지 않게) 일본은 가만히 */
  secretHoldFeet() {
    const run = this.secretRun;
    if (run.holdDc == null) return run.S.do.back ? 0 : -0.21;
    if (run.holdDc > run.holdHi) return 0.3;
    if (!run.S.do.back && this.d < this.M.contact + 0.1) return -0.6;
    return run.S.do.back ? 0 : -0.21;
  }

  /** 비기를 끊는다 (맞아 물러남·쓰러짐·다른 공격·공격 거둠): 경직 없이 비기만 지운다 */
  secretAbort() {
    const run = this.secretRun;
    this.secretRun = null;
    if ((run?.stage === 'spin' || run?.stage === 'mord') && this.me.skill.sec) this.me.skill.secretEnd(); // 싱지르 · 모르트슐라크 (10/24): 검술 층 대본도 끊는다 (쓰러짐 · 탈진 — 검술 층도 스스로 끊지만 같은 스텝에)
    this.me.powerMul = 1;
    this.me.secretHit = 1;
    if (run?.S.do.strength) this.secretStrength(1);
    if (run && run.landed && run.stage !== 'stiff') {
      const st = this.secretStat(run.S);
      st.landed++;
      st.E += run.peakE;
      st.Emax = Math.max(st.Emax, run.peakE);
    }
    if (this.mode === 'secret') {
      this.mode = 'watch';
      this.phase = 'ready';
    }
  }

  // ───────────────────────── 패시브 고유 동작 (10/9 — schools.js passives, docs/strike/school_passive_2026-10-09.md) ─────────────────────────
  //  발동 자리: afterStrike(landed·parried·missed) · respond(threat) · preThreat(foeRaise·foeCharge) · seize(foeRecover) · defend(bindDef) ·
  //   watch(foeStepIn·standoff) · startWithdraw / withdraw 끝(pressed). 자리마다 this.passives 가 비었거나 그 사건의 패시브가 없으면 난수 없이 전 코드 그대로.
  //  있으면 한 번 굴려(p × (0.5 + 0.5 × 읽는 눈)) do 를 한다. 재기: stats.passives[이름](낸 수) · stats.passiveRolls[이름](굴린 수) · stats.passiveSkipped(기술이 꾸러미에 없음)

  /** 사건 key 의 패시브: 목록에서 when 이 맞고 cond 가 맞는 첫 것, 없으면 null (ctx = 위협 th 등) */
  passiveFor(key, ctx) {
    for (const P of this.passives) {
      if (P.when !== key && !(Array.isArray(P.when) && P.when.includes(key))) continue;
      if (this.specCooling(passiveSpecial(P))) continue; // 특수 공격 AI 몫 패시브(겹치기 · 빼서 찌르기 · 되받아 치기)는 식는 동안 없음 (10/29 19:4x)
      const c = P.cond;
      if (c) {
        if (c.thrust && !ctx?.thrust) continue;
        if (c.cut && (!ctx || ctx.thrust)) continue;
        if (c.line && !c.line.includes(ctx?.line)) continue;
        if (c.myThrust && this.tech?.kind !== 'thrust') continue;
        if (c.low && !(this.mode === 'watch' && c.low.includes(this.guard?.name) && padDist([this.me.handOffset.x, this.me.handOffset.y], this.guard.pad) < 0.15)) continue; // 이베리아 올려 맞받기 (10/11): 지금 낮은 자세로 기다리는 중
      }
      return P;
    }
    return null;
  }

  /** 한 사건에 한 번 굴린다: p × (0.5 + 0.5 × 읽는 눈) */
  passiveRoll(P) {
    const R = (this.stats.passiveRolls ??= {});
    R[P.name] = (R[P.name] ?? 0) + 1;
    // 숙련도가 높을수록 유파 고유 특성을 더 적극적으로 (사장님 10/18 23:4x — config AI_PROFICIENCY.schoolK, 숙련도 2 = 1 · 1 을 넘으면 1)
    const k = AI_PROFICIENCY.schoolK?.[this.proficiency] ?? 1;
    return Math.random() < (k === 1 ? P.p * (0.5 + 0.5 * this.level.read) : Math.min(1, P.p * (0.5 + 0.5 * this.level.read) * k));
  }

  /** 낸 수를 센다 */
  passiveFired(P) {
    const F = (this.stats.passives ??= {});
    F[P.name] = (F[P.name] ?? 0) + 1;
    this.passiveAtk = this.mode === 'attack' ? P.name : null;
    // 확정(10/9 13:xx): 패시브가 낸 공격은 0.5 s 동안 새 위협에 거두지 않는다 (attack 의 respond 확인을 건너뜀 — 맞는 것은 물리 그대로)
    this.passiveLock = this.passiveAtk ? { left: LOCK_T, name: P.name } : null;
    this.setTechCue(P.nameKo ?? P.name, 'passive'); // 기술 알림 (패시브가 낸 공격은 칼이 나갈 때 고유 동작 이름으로 덮지 않는다 — strikeCue)
  }

  /** do.tech·do.chain 의 기술: 이름(들) 가운데 이 꾸러미에 있는 것 — 손에서 가까운 것(far 면 먼 것). 없으면 alt, 그것도 없으면 null */
  passiveTech(D) {
    const names = [].concat(D.tech ?? D.chain ?? []);
    const byName = this.school.techByName;
    const hand = [this.me.handOffset.x, this.me.handOffset.y];
    let best = null;
    let bestD = D.far ? -1 : 1e9;
    for (const n of names) {
      const t = this.techNow(byName[n]); // 식는 특수 공격 (10/29 19:4x)
      if (!t) continue;
      const cd = padDist(hand, t.from);
      if (D.far ? cd > bestD : cd < bestD) {
        bestD = cd;
        best = t;
      }
    }
    return best ?? (D.alt ? this.techNow(byName[D.alt] ?? null) : null);
  }

  /** 이름으로 자세: 이 꾸러미의 간 보는 자세에 없으면 바탕 WATCH_GUARDS 의 것을 빌린다 (일본 높은 자세 목록엔 긴 자세가 없다 — 残心) */
  passiveGuard(name) {
    return this.school.guards.find((g) => g.name === name) ?? WATCH_GUARDS.find((g) => g.name === name) ?? null;
  }

  /**
   * 공격 꼴 패시브를 낸다: prefer = 이 한 번의 기술 고르기 곱(s 가 있어야 한다), tech·chain = 그 기술을 지금 손에서 곧장(skipChamber·fastChamber),
   *  feint = 그 이름의 속임수. why = 자리의 공격 까닭(do.why 가 있으면 그것), chain = 이어 치기 차례. 냈으면 true
   */
  passiveGo(P, s, why, chain = 0) {
    const D = P.do;
    const reason = D.why ?? why;
    if (D.prefer) {
      if (!s) return false;
      // 기술 고르기 셈: 짧은 순간 셈('windup' — 빠른 기술)에 prefer 곱. 'stop' 셈은 찌르기를 0.3 으로 깎아 contratempo 뜻과 어긋나 쓰지 않는다
      const t = this.pickTech(s, why === 'stop' ? 'windup' : why, D.prefer);
      if (!t || !this.startAttack(t, reason, { chain, noFeint: true, fastChamber: true, passive: true })) return false;
      this.passiveFired(P);
      return true;
    }
    let t = null;
    let feint = null;
    if (D.feint) {
      feint = this.school.feints.find((f) => f.name === D.feint) ?? null;
      t = feint ? this.school.techByName[feint.fake] ?? null : null;
    } else if (D.tech || D.chain) t = this.passiveTech(D);
    else return false;
    if (t && (D.step || D.as)) t = { ...t, name: D.as ?? t.name, nameKo: P.nameKo ?? t.nameKo, step: D.step ?? t.step }; // 이베리아 올려 맞받기 (10/11): 꾸러미 길에 걸음을 덧씌우고 이름을 따로 (재기)
    if (!t) {
      this.stats.passiveSkipped = (this.stats.passiveSkipped ?? 0) + 1; // 그 기술이 이 꾸러미에 없다 → 건너뜀
      return false;
    }
    // chamber(독일 Nachreisen): 지금 손에서 곧장이 아니라 준비 자세를 빠르게 거쳐 친다 (보통 'recover' 공격처럼 — 내디딤은 stepTime 그대로)
    if (!this.startAttack(t, reason, { chain, noFeint: true, skipChamber: !D.chamber, fastChamber: true, passive: true })) return false;
    if (feint) {
      this.feint = feint;
      this.stats.feints++;
    }
    this.passiveFired(P);
    return true;
  }

  /**
   * threat 패시브: counter(이 위협의 맞받아치기 목록 — 굴림 없이 곧장) · parry/void(막기·피하기 강제) · tech.
   *  counter 는 확정(10/9 13:xx — 전엔 보통 맞받아치기와 같은 '준비 자세가 손에서 0.3 m 안' 문턱에 걸려 Überlaufen 174 굴림에 7 번만 났다):
   *  목록(줄마다 목록이면 이 위협의 줄 것) 가운데 손에서 가까운 것을 거리 문턱 없이, 준비 자세가 멀면 빠르게 거쳐(fastChamber) 친다. 간격은 respond 가 굴리기 전에 봤다
   */
  passiveThreat(P, th, d) {
    const D = P.do;
    if (D.counter) {
      const list = Array.isArray(D.counter) ? D.counter : D.counter[th.line] ?? D.counter.default;
      if (!list || !list.some((n) => this.school.techByName[n])) {
        this.stats.passiveSkipped = (this.stats.passiveSkipped ?? 0) + 1;
        return false;
      }
      const t = this.passiveTech({ tech: list });
      if (!t || !this.startAttack(t, 'counter', { noFeint: true, fastChamber: true, passive: true })) return false;
      this.stats.counters++;
      this.passiveFired(P);
      return true;
    }
    if (D.parry || D.void) {
      this.mode = 'defend';
      this.phase = 'guard';
      this.path.length = 0;
      this.stepT = 0;
      this.defBindSeen = false;
      this.parryComboReset();
      this.defVoid = !!D.void || !this.me.armed;
      if (this.defVoid) this.stats.voids++;
      else this.stats.parries++;
      this.timer = DEF_T;
      this.passiveFired(P);
      return true;
    }
    return this.passiveGo(P, null, 'counter');
  }

  /**
   * 미룬 패시브(pendingPassive = { P, why, left }): 물러남 끝 斂翅, 간격 밖에서 굴려 나온 돌려 물러남. left 가 도는 동안(0.5 s) 간 보기·물러남에서
   *  상대가 서 있고 간 보는 거리 + 0.4 m 안이면 낸다. 냈으면 true (그 사이 내 공격 기회가 먼저 오면 startAttack 이 이 패시브로 바꾼다)
   */
  passivePending(s, d) {
    const PP = this.pendingPassive;
    if (!PP || !this.foe.alive || s.state !== 'stand' || d > this.holdDist() + 0.4 || d < this.M.clinch) return false;
    this.pendingPassive = null;
    return this.passiveGo(PP.P, s, PP.why);
  }

  /** watch 의 판단 박자: standoff(위협 없음 2 s 넘게 · 상대 손 1 m/s 아래 · 간격 끝 가까이)와 foeStepIn(기회 종류 'stepin') — 사건마다 한 번 */
  passiveWatch(s, d, opp, reachOut) {
    if (!this.foe.alive || s.state !== 'stand') return false;
    const calm = this.noThreat > CALM_T && Math.hypot(s.hvx, s.hvy) < 1 && d < this.holdDist() + 0.3;
    if (!calm) this.standoffArmed = true;
    else if (this.standoffArmed) {
      const P = this.passiveFor('standoff');
      if (P) {
        this.standoffArmed = false;
        if (this.passiveRoll(P) && this.passiveGo(P, s, 'open')) return true;
      }
    }
    if (opp.kind !== 'stepin') this.stepinArmed = true;
    else if (this.stepinArmed && d < this.holdDist() + reachOut) {
      const P = this.passiveFor('foeStepIn');
      if (P) {
        this.stepinArmed = false;
        if (this.passiveRoll(P) && this.passiveGo(P, s, 'stepin')) return true;
      }
    }
    return false;
  }

  /** defend 의 bindDef: 이번 막기에서 칼끼리 처음 맞닿은 스텝에 한 번 굴려 받은 칼로 곧장 (checkBind 와 같은 기하) */
  passiveBindDef(s, d) {
    const P = this.passiveFor('bindDef');
    if (!P) return false;
    const me = this.me;
    const foe = this.foe;
    if (!me.tipPrev || !foe.tipPrev) return false;
    me.bladePoint(0.1, _a0);
    foe.bladePoint(0.1, _b0);
    if (segDist(_a0, me.tipPrev, _b0, foe.tipPrev) > 0.07) return false;
    this.defBindSeen = true;
    if (!this.passiveRoll(P)) return false;
    if (!foe.alive || d > this.M.reach + 0.25 || d < this.M.clinch + 0.1) return false;
    return this.passiveGo(P, s, 'riposte');
  }

  // ───────────────────────── 손과 발 ─────────────────────────
  /** 손을 목표 쪽으로 제한 속도로 옮긴다 (AI가 순간적으로 칼을 옮기지 못하게) */
  moveHand(dt) {
    const off = this.me.handOffset;
    // 비기 경직 (사장님 10/10 20:5x '잠깐 아예 못 움직이게'): 손 목표를 그대로 둔다 — 떨림도 없음. 검술 층(skill.js update)이 secretStiff 를 보고 걸러진 목표까지 붙든다
    this.me.secretStiff = this.secretRun?.stage === 'stiff';
    if (this.me.secretStiff) return;
    if (this.secretRun?.stage === 'spin' || this.secretRun?.stage === 'mord') return; // 싱지르 · 모르트슐라크 (10/24): 대본 · 따라 지나감 · 굳음 동안 손 목표는 검술 층(skill.sec — 덧씌우기 · holdStiff)이 쥔다
    if (this.feintHold > 0) {
      this.feintHold -= dt;
      if (this.feintHold <= 0) this.stepT = this.stepTime(); // 이제 진짜로 내디디며 친다
      return;
    }
    const striking = this.mode === 'attack' && this.phase === 'strike' && this.path.length > 0;
    let tx = this.hand.x;
    let ty = this.hand.y;
    if (this.pressAim && this.pressAimT === this.sense.t && this.mode === 'attack') {
      tx = this.pressAim[0]; // 자연 바인드 실험 ②: 칼이 막혀 있는 동안 손 목표 = 노리던 자리(상대 빈틈) — 길 끝까지 지나가지 않고 거기로 민다
      ty = this.pressAim[1];
    } else if (striking) {
      tx = this.path[0][0];
      ty = this.path[0][1];
      // 상대가 옆으로 비껴 있으면 그만큼 손을 옮겨 겨눈다
      tx = clamp(tx + clamp(this.foeLat, -0.4, 0.4) * 0.5, -0.6, 0.6);
    }
    const dx = tx - off.x;
    const dy = ty - off.y;
    const dd = Math.hypot(dx, dy);
    const step = this.handSpeed * dt * (this.mode === 'attack' || this.mode === 'secret' ? this.me.stamina.attackSpeed : 1);
    if (dd > step) {
      off.x += (dx / dd) * step;
      off.y += (dy / dd) * step;
    } else {
      off.set(tx, ty);
      if (striking) {
        this.path.shift();
        // 속임수의 가짜 부분이 끝났다 → 칼이 가짜 쪽으로 움직이는 것이 보이도록 잠깐 두었다가 진짜 길로 간다.
        //  너무 오래 멈추면 진짜 칼이 나가기까지 전체 시간이 늘어져 오히려 읽히기 쉽다. 숙련될수록 더 빨리 다시 챔버한다
        if (this.feintPts > 0 && --this.feintPts === 0) this.feintHold = realS(clamp(0.16 - 0.08 * this.level.read, 0.06, 0.16)); // 속임 멈칫 = 실제 초
      }
    }
    // 공포 떨림 (플레이어 눈에 보이는 신호, 무기·검술 담당 추가): 겁먹으면 간 보는 동안 칼끝이 잔잔히 떨린다 —
    //  손 속도 제한과 무관하게 손 위치에 직접 얹는다(0.06~0.1초마다 새 방향, 크기는 공포 세기 × 최대 3cm).
    //  누적되지 않도록 "지금 얹혀 있는 떨림"과의 차이만 더한다. 베는 중엔 안 떨고, 공포가 없으면 난수도 안 굴려 예전과 같다.
    if (this.fear > 0.15 && !striking) {
      this.tremorT -= dt;
      if (this.tremorT <= 0) {
        this.tremorT = 0.06 + Math.random() * 0.04;
        const a = Math.random() * Math.PI * 2;
        const r = this.fear * FEAR_TREMOR * (0.5 + Math.random() * 0.5);
        this.tremor.set(Math.cos(a) * r, Math.sin(a) * r);
      }
    } else this.tremor.set(0, 0);
    off.x += this.tremor.x - this.tremorApplied.x;
    off.y += this.tremor.y - this.tremorApplied.y;
    this.tremorApplied.copy(this.tremor);
    if (off.length() > 0.62) off.setLength(0.62);
  }

  /**
   * 기술 길 덧칸 (10/25 08:0x 사장님 '셸하우 3번 — 길 다시 그림' · 지금은 곁눈 베기만 — schools.js schielhau redraw.plan · config UNIQUE_ASSIST.schielPath):
   *  패드 길 점은 손 자리와 칼 겨눔(guardDir)을 함께 정해 '손은 높고 칼은 앞' · '손이 먼저 뻗고 칼은 늦게' 같은 꼴을 못 그린다 → 기술이 점마다 덧칸을 갖는다:
   *  [칼끝 들기 °, 손 뻗기 m, 손 돌리기 °] (plan 칸 = [from, ...path] 점마다). 베기 · 따라 베기 동안 지금 가는 토막(앞 점 → 다음 점)에서 손이 간 몫(남은 거리 ÷ 토막 길이)만큼
   *  두 점 값을 섞어 me.techPlan { tilt rad, reach m, turn rad } 에 둔다(fighter.js driveSword 가 읽음 — 손 목표 앞으로 · 칼 겨눔 높이각 · 날 세우기 칼 면을 칼 축 둘레로).
   *  따라 베기 동안은 끝 점 값 그대로. 공격 꼴이 끝나면(또는 덧칸 없는 기술 · 속임수 · 비기) 그때 값을 UNIQUE_ASSIST.planRelease 초에 걸쳐 0 으로. 덧칸 없는 기술만 쓰면 늘 null — 난수 · 다른 길 그대로
   */
  techPlanStep(dt) {
    const me = this.me;
    const t = this.tech;
    const P = this.mode === 'attack' && (this.phase === 'strike' || this.phase === 'follow') && !this.feint && !this.secretRun && t?.plan ? t.plan : null;
    if (P) {
      const n = t.path.length;
      const done = this.phase === 'follow' ? n : n - this.path.length; // 지나온 길 점 수 (0 = from → path[0] 토막)
      const a = P[Math.min(done, n)];
      let tilt = a[0];
      let reach = a[1];
      let turn = a[2] ?? 0;
      if (done < n) {
        const A = done === 0 ? t.from : t.path[done - 1];
        const B = this.path[0] ?? t.path[done]; // 지금 가는 점 (서툰 손 빗나감 · 옆 비낌을 받은 그 점)
        const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
        const r = Math.hypot(B[0] - me.handOffset.x, B[1] - me.handOffset.y);
        const u = L > 1e-6 ? clamp(1 - r / L, 0, 1) : 1; // 이 토막에서 손이 간 몫
        const b = P[done + 1];
        tilt += (b[0] - tilt) * u;
        reach += (b[1] - reach) * u;
        turn += ((b[2] ?? 0) - turn) * u;
      }
      me.techPlan = { tilt: (tilt * Math.PI) / 180, reach, turn: (turn * Math.PI) / 180 };
      this.planFade = null;
    } else if (me.techPlan) {
      // 놓음: 손 목표가 한 스텝에 손 뻗기만큼 튀지 않게 그때 값을 planRelease 초에 걸쳐 0 으로
      const F = (this.planFade ??= { tilt: me.techPlan.tilt, reach: me.techPlan.reach, turn: me.techPlan.turn, t: 0 });
      F.t += dt;
      const k = 1 - F.t / UA.planRelease;
      if (k <= 0) {
        me.techPlan = null;
        this.planFade = null;
      } else me.techPlan = { tilt: F.tilt * k, reach: F.reach * k, turn: F.turn * k };
    }
  }

  /** 발놀림: 간격 조절, 옆으로 돌기, 베며 내딛기, 물러나기 */
  moveFeet(dt, d) {
    const me = this.me;
    const L = this.level;
    let fwd = 0;
    let side = 0;
    const speed = BODY.moveSpeed;
    // 원하는 "다가가는 빠르기"(m/s, + = 다가감) → 조이스틱 값 (뒤로는 75% 빠르기)
    const toStick = (v) => (v >= 0 ? v / speed : v / (speed * 0.75));
    if (this.mode === 'attack') {
      if (this.phase === 'windup') {
        // 준비하는 동안 간격 끝까지 다가간다 (이미 가까우면 제자리).
        //  제자리일 때는 뒤로 살짝 당긴다: 칼을 빠르게 드는 것을 검술 층(skill.js)이 휘두르기로 보고
        //  저절로 앞으로 내딛지 않게 (AI는 발을 스스로 정한다)
        const want = this.chasing ? this.M.contact : this.M.reach + 0.2;
        fwd = d > want && this.foeClosing < 0.5 ? clamp((d - want) * 1.5, 0.25, this.chasing ? 1 : 0.8) : -0.21;
        const GP = this.gnsW?.plan?.kind;
        if (GP === 'commit' && d > want) fwd = 1; // 고노센 경계 결행 (10/25): 선 사이를 기어 들지 않고 스틱 끝으로
        else if (GP === 'feint') fwd = -0.21; // 고노센 경계 속임: 선 밖 제자리에서 든다 (위 '제자리'와 같은 당김)
        if (this.secretRun?.S.do.release) fwd = this.secretHoldFeet(); // 비기 터뜨림 창: 고리를 돌며 간격을 맞춘다
      } else if (this.phase === 'approach' || this.phase === 'rdWind') { // rdWind = 풍차 베기 AI 몫 감기 (10/31) — 감으며 다가감
        // 성큼성큼이 아니라 미끄러지듯 (빨리 달려들면 베는 동안 멈추지 못하고 상대 몸에 부딪친다).
        //  상대가 다가오고 있으면 제자리에서 기다린다 (뒤로 살짝 당겨 검술 층의 자동 내딛기도 막는다)
        const gap = this.contactDist() - (this.need ?? this.M.contact);
        fwd = this.foeClosing > 0.5 || gap <= 0 ? -0.21 : clamp(gap * 3, 0.25, 0.45);
        if (this.chasing) fwd = d > this.M.contact ? 1 : -0.21; // 도망치는 빈손 상대는 뛰어서 쫓는다
        else if (this.gnsW?.plan?.kind === 'commit' && gap > 0) fwd = 1; // 고노센 경계 결행 (10/25): 스틱 끝으로 들어가 칼끝 거리에서 벤다
        if (this.sideStepT != null) {
          // 비껴 딛는 중: 스틱도 그쪽으로 (gait 의 몸 목표가 옆으로도 가게), 뒤로는 당기지 않는다
          side = Math.sign(this.tech.step.lat);
          fwd = Math.max(fwd, 0);
        }
      } else {
        // 손이 먼저, 발이 뒤따른다. 이미 가까우면 내딛지 않는다 (몸이 부딪친다)
        let stepping = false;
        if (this.stepDelay > 0) this.stepDelay -= dt;
        else if (this.stepT > 0) {
          this.stepT -= dt;
          stepping = d > this.M.contact - 0.1;
          // 중국 활 자세가 기술마다 정해진 수(P.bow.tech — 표두격)는 가까워도(붙기 전까지) 반걸음 내딛으며 친다 (그 칸의 fwd). 칸 없으면 전과 같다
          const bt = this.me.gait?.P?.bow?.tech?.[this.tech?.name];
          if (!stepping && bt?.fwd && d > this.M.clinch) stepping = true;
        }
        if (stepping) {
          fwd = 1;
          if (this.tech.step?.when === 'strike') side = Math.sign(this.tech.step.lat); // 기술 걸음: 스틱도 비껴 딛는 쪽으로
          this.gaitStep();
        } else {
          // 내디디지 않을 때는 발을 멈춰 세운다 (다가오던 관성으로 상대 몸에 부딪치지 않게).
          //  뒤로 살짝 당기면 검술 층의 자동 내딛기(skill.js)도 걸리지 않는다
          fwd = d < this.M.contact ? -0.5 : -0.21;
        }
        if (d < this.M.clinch) fwd = -0.7; // 너무 붙으면 베며 물러난다
        // 달려드는 상대를 맞받아 벨 때는 옆으로 비켜 선다 (상대 칼이 지나가는 줄에서 벗어난다)
        if (this.why === 'stop') side = this.pers.circleDir * 0.6;
      }
      if (this.drillAtk && d >= this.M.clinch) fwd = this.drill.atkFeet(this); // 시험: 헛스윙 연습 공격은 그 자리에서 — 다가가기·내딛기 없음 (whiff_drill.js)
    } else if (this.mode === 'withdraw') {
      // 간격 밖까지 물러난다. 가까워질수록 천천히 (관성으로 너무 멀리 가지 않게)
      //  (-0.2보다 더 당겨야 검술 층이 손 움직임을 휘두르기로 보고 앞으로 내딛지 않는다)
      fwd = Math.min(-0.25, toStick(clamp((d - this.holdDist() - 0.05) * 3, -1.9, -0.3)));
    } else if (this.mode === 'defend') {
      fwd = this.defVoid ? -1 : -0.3; // 막을 때도 살짝 물러선다 (앞으로 쏠리지 않게)
    } else if (this.mode === 'secret') {
      // 비기 꼴 (일본 後の先): ① 물러서며 끌어 담기 — 뒤로 (뒷발 걸음은 gait 'retreat' 가 딛는다) · 경직 — 걸음 없음
      fwd = this.secretRun?.stage === 'back' ? -0.3 : this.secretRun?.stage === 'hold' ? this.secretHoldFeet() : 0;
    } else if (this.drillOut) {
      // 시험: 헛스윙 연습의 간 보기 (whiff_drill.js) — 드릴 거리까지만 다가가고, 플레이어가 다가와도 물러나지 않는다(옆으로 돌지도 않음 — 제 걸음이 지나쳐 안쪽에 섰을 때만 물러남). 그 거리 안으로 들어오면 평소대로
      fwd = this.drill.feet(this, d);
    } else {
      // 간 보기: 상대 칼이 닿는 거리 바로 밖을 지킨다
      const hold = this.holdDist();
      const err = d - hold;
      // 멀면 걸어서 다가가고, 간격 가까이에선 발끝으로 조금씩 파고든다 (성큼 들어가면 상대 칼에 걸린다)
      let v = clamp(err * 1.6, -1.9, d > hold + 0.5 ? 1.2 : 0.18);
      if (this.chasing && err > 0) v = speed; // 빈손 상대는 뛰어서 쫓는다
      v -= Math.max(0, this.foeClosing) * L.discipline * (1 - 0.3 * this.anger); // 상대가 다가오면 그만큼 물러난다 (화나면 덜 물러난다)
      if (Math.abs(err) < 0.12 && Math.abs(this.foeClosing) < 0.3) {
        // 제자리: 잔걸음으로 들어갔다 빠졌다 (리듬)
        this.shuffleTimer -= dt;
        if (this.shuffleTimer <= 0) {
          this.shuffleTimer = realS(rand(0.5, 1.2));
          this.shuffle = Math.random() < 0.5 ? 0 : rand(-0.3 - 0.3 * this.fear, 0.18 * (1 - this.fear)); // 겁먹으면 잔걸음이 뒷걸음으로 기운다
        }
        v = this.shuffle;
      }
      const GW = this.gnsW;
      if (GW && (GW.ready || GW.cut) && !this.chasing && d <= GW.line + 0.08) v = Math.min(v, 0); // 고노센 경계 (10/25): 준비된 고노센 상대의 선 언저리(최소 여유 0.08 안)에선 앞으로 안 감 — 잔걸음이 선 안으로 기어 들지 않게
      fwd = toStick(v);
      // 옆으로 돌기 (가끔 방향을 바꾸고 가끔 멈춘다)
      this.circleTimer -= dt;
      if (this.circleTimer <= 0) {
        this.circleTimer = realS(rand(0.8, 2.2));
        const x = Math.random();
        const ds = this.drySense; // 마른 길 (라트나 · 잠든 습지만): 같은 굴림 x 로 멈춤·도는 쪽을 땅에 맞춰 고른다 — 0 이면 아래 옛 줄 그대로
        this.circle = ds ? this.dryCircle(x, ds) : x < 0.45 ? 0 : (x < 0.85 ? this.pers.circleDir : -this.pers.circleDir) * this.pers.circleRate;
      }
      if (d < hold + 0.6) side = this.circle;
      // 고노센 준비 쌓기 (10/25 22:5x 사장님 '아무 행동 없이 2초' — SECRET.gnsReady 'idle' · 감독 'AI 도 같은 생각 — AI 의 걸음 뜻으로' · SECRET.gnsAiSettle):
      //  고노센 AI 가 준비 전이면 간 보기 동안 다가가기 · 잔걸음 · 옆 돌기 없이 제자리에 선다(스틱 0 — 사람이 스틱을 놓고 기다리는 것과 같은 셈 · 새 수 없음) ·
      //  준비가 켜지면 다시 간 보기 걸음(걸어도 유지). 너무 붙음 · 울타리 · 밀치기 걸음(아래)은 그대로. 빈손 상대를 쫓을 때 · 'dist' 판 · 끄면 이 줄을 안 탐
      if (SECRET.gnsAiSettle && this.iaiArm && SECRET.iai && SECRET.gnsReady === 'idle' && !this.iaiArm.armed && !this.chasing) fwd = side = 0;
    }
    // 너무 붙음 → 떨어진다 (밀쳐내기는 fighter.shove가 뒤로 물러날 때 자동으로)
    if (d < this.M.clinch && this.mode !== 'attack' && this.mode !== 'secret') {
      fwd = -1;
      side = side || this.pers.circleDir * 0.5;
    }
    // 울타리에 몰리면 옆으로 빠져 가운데로 (구석에 갇히지 않게)
    const a = me.bodies.pelvis.translation();
    const rA = Math.hypot(a.x, a.z);
    if (rA > 4.6 && !(this.mode === 'attack' && this.phase === 'strike')) {
      const f = me.forward(_v2);
      const r = me.right(_v1);
      const outBack = -(a.x * f.x + a.z * f.z) / rA; // 등이 울타리 쪽이면 +
      const toCenter = -(a.x * r.x + a.z * r.z) / rA; // 가운데가 내 오른쪽이면 +
      const k = clamp((rA - 4.6) * 1.2, 0, 1);
      if (fwd < 0 && outBack > 0.3) fwd *= 1 - k * 0.8; // 뒤로는 더 못 간다
      side = side * (1 - k) + Math.sign(toCenter || 1) * k;
      if (this.mode === 'watch') this.patience = Math.max(0, this.patience - dt * realRate(0.15) * k); // 몰렸으면 먼저 친다
    }
    // 모르트슐라크 몸 붙이기 (10/24 — mordPressGo): 닿는 거리(CLOSE.reach) 밖이면 곧장 걸어 들어간다 (너무 붙음 · 간 보기 걸음 대신 · 닿으면 아래 밀치기가 스틱을 쥔다)
    if (this.press?.go && !this.closeInside && this.mode === 'watch' && !me.barge) {
      fwd = 1;
      side = 0;
    }
    // 근접 밀치기: 닿는 거리 안에서 스틱만 (벽 처리 뒤라 side 를 ±k 로 바꾸지 못한다). 걸쇠가 꺼져 있으면 한 스텝 0 으로 장전,
    //  켜져 있으면 1 로 발사, 밀치는 동안 closeWant 면 1 유지(누르기). 휘두르는 중·베는 중(strike·follow, 팔이 묶임)은 미룬다
    const armsBusy = this.mode === 'attack' && (this.phase === 'strike' || this.phase === 'follow' || this.phase === 'rdWind' || this.phase === 'rdStrike'); // 풍차 베기 감기 · 내려침도 팔이 묶임 (10/31)
    if (CLOSE.on && this.closeInside && !me.skill.swinging && (me.barge || (this.closeWant && !armsBusy))) {
      fwd = me.barge ? (this.closeWant ? 1 : 0) : me.closeArmed ? 1 : 0; // 밀치는 중엔 closeWant 동안만 누른다 (풀리면 release)
      side = 0;
    }
    if (!this.foe.alive) fwd = side = 0;
    if (this.secretRun?.stage === 'stiff' || this.secretRun?.stage === 'spin' || (this.secretRun?.stage === 'mord' && me.skill.sec?.stage === 'stiff')) fwd = side = 0; // 비기 경직: 걸음 없음 — 울타리 빠짐·근접 밀치기 스틱도 (10/10 20:5x) · 싱지르(10/24 — 검술 층 skill.sec 이 대본 · 굳음까지 몸을 쥔다) · 모르트슐라크(10/24 — 사람과 같게 굳음 동안만)
    me.stickX = side; // 스틱 원값 (감정 배수 전): 근접 밀치기 걸쇠가 읽는다 (fighter.closeStep)
    me.stickY = fwd;
    const mv = me.emoMods?.move ?? 1; // 감정 고유 능력: 집념이면 발이 묶이고, 공포면 발이 빨라진다 (1이면 예전 그대로 ±1 안)
    const lim = Math.max(1, mv);
    me.move.set(clamp(side * mv, -lim, lim), clamp(fwd * mv, -lim, lim));
  }

  /** 새 다리(gait.js)가 있으면 베는 걸음을 부탁한다 (없으면 조이스틱 내딛기로 충분) */
  gaitStep() {
    const g = this.me.gait;
    if (this.requestedStep || !g?.requestStep || !g.active || this.me.state !== 'stand') return;
    // 이번 프레임의 조이스틱(me.move)은 아직 지난 프레임 값(발을 멈추려고 뒤로 살짝 당긴 값)일 수 있어서 거절될 수 있다
    //  → 받아 줄 때까지 다음 프레임에 다시 부탁한다
    let leg = null;
    if (GAIT.cutStep > 0 && BODY.chain === 'legs' && this.tech?.kind !== 'thrust' && this.tech?.path?.length) {
      // R2′ 채널 B(확인표 182): 기술 길의 가로 변위 부호로 획 반대쪽 발을 고른다 (플레이어의 skill.js 와 같은 규칙; |변위| ≤ 0.2 패드면 안 고름)
      const dx = this.tech.path[this.tech.path.length - 1][0] - this.tech.from[0];
      leg = dx < -0.2 ? 'left' : dx > 0.2 ? 'right' : null;
    }
    const st = this.tech?.step;
    if (st?.when === 'strike') {
      if (this.techStepRequest(st)) this.requestedStep = true;
      return;
    }
    // 유파 걸음 베기 걸음(10/10, gait.P.cutStep — 일본 후미코미·중국 진보 = 앞발 lunge + 뒷발 끌어붙임, 이베리아 큰 pass): 찌르기·칸 없는 유파는 전과 같다
    const cs = this.tech?.kind !== 'thrust' ? g.P?.cutStep : null;
    if (cs) {
      const bt = g.P.bow?.tech?.[this.tech?.name]; // 중국 표두격: 가까우면 반걸음(bt.fwd), 멀면 보통 베기 걸음
      const fw = bt?.fwd && this.foe && this.me.foeDistance() < this.M.contact - 0.1 ? bt.fwd : cs.fwd;
      if (g.requestStep({ kind: cs.kind, fwd: fw, hold: 0.3, leg, draw: !!cs.draw, tech: this.tech?.name })) this.requestedStep = true; // tech: 기술 이름(중국 활 자세가 표두격 oberhau 에서 더 오래 버팀 — gait P.bow.tech)
      return;
    }
    const itl = this.tech?.kind === 'thrust' ? this.me.skill.tap?.it : null; // 이탈리아 찌르기 ③: 거리만큼(0.6 m 까지) · 몸이 앞발을 따라 실리는 런지 (skill.js 탭 찌르기와 같은 걸음 장치)
    if (g.requestStep({ kind: this.tech?.kind === 'thrust' ? 'lunge' : 'pass', fwd: itl?.fwd > 0 ? Math.min(0.6, itl.fwd) : 0.6, hold: 0.3, leg, ...(itl?.fwd > 0 ? { push: SECRET.stepPush, accel: true } : {}) })) this.requestedStep = true;
  }

  // ───────────────────────── 기술 걸음 (10/9 — 사장님 '비껴 들어가 베기', docs/strike/school_step_2026-10-09.md) ─────────────────────────
  //  유파 고유 동작(TECH 꼴)의 step 칸 { lat, fwd, when, dur? }: lat = 몸 기준 오른쪽 +(m, 왼쪽은 −) · fwd = 앞(m) · when 'strike'(베기 시작 0.04 s 뒤 —
  //   지금 내딛기 자리) | 'approach'(닿기 전에 먼저 비껴 딛고, 발이 닿으면 친다) · dur = 발이 떠 있는 시간(기본 0.35 s).
  //  딛는 발: 비껴 가는 쪽 발. 그 발이 앞발이면 그대로 내딛고(lunge), 뒷발이면 앞발을 지나 그쪽 앞으로(pass).
  //  step 칸이 없는 기술은 이 자리들을 읽지 않는다(난수·부름 모두 전과 같다). 재기: stats.techStep[이름] = { req(부탁한 공격 수), ok(받은 걸음 수) } — 결과·자리는 도구(motion_lab duel)가 잰다

  /** 기술 걸음 하나를 다리에 부탁한다 (받으면 true) */
  techStepRequest(st) {
    const g = this.me.gait;
    if (!g?.requestStep || !g.active || this.me.state !== 'stand') return false;
    const front = g.frontLeg(this.me.forward(_v2));
    const lead = Math.sign(g.legs[front].side) === Math.sign(st.lat); // 비껴 가는 쪽 발이 앞발인가
    const S = this.techStepStat();
    if (!this.techStepTry) S.req++; // 공격 한 번에 한 번 센다 (못 받으면 다음 프레임에 다시 부탁한다)
    this.techStepTry = true;
    // kind·push: 비기가 덧씌운 걸음(일본 앞발 lunge·강하게, 이탈리아 뒷발 pass) — 칸이 없으면 전과 같다
    if (!g.requestStep({ kind: st.kind ?? (lead ? 'lunge' : 'pass'), fwd: st.fwd, side: st.lat, duration: st.dur ?? 0.35, ...(st.push ? { push: st.push } : {}) })) return false;
    S.ok++;
    this.techStepN = (this.techStepN ?? 0) + 1; // 받은 기술 걸음 수 — 도구가 바뀐 때를 보고 걸음 뒤 넘어짐을 잰다
    return true;
  }

  techStepStat() {
    const T = (this.stats.techStep ??= {});
    return (T[this.tech.name] ??= { req: 0, ok: 0 });
  }

  /** 'approach' 기술 걸음: 닿기 fwd 만큼 전에 비껴 딛기를 부탁하고, 발이 닿을 때까지(최대 0.7 s) 손을 준비 자세에 둔 채 기다렸다 친다. 이 프레임을 맡았으면 true */
  approachStep(dt, s, th, d) {
    const st = this.tech.step;
    if (this.sideStepT == null) {
      if (this.timer > 0 || this.contactDist() > this.need + Math.max(0, st.fwd)) return false; // (뒤로 딛는 걸음은 앞당겨 딛지 않는다 — 전 기술은 fwd ≥ 0 이라 같음)
      if (!this.techStepRequest(st)) return false; // 못 받았다(뒤로 당긴 스틱 등) → 보통 다가가기 (닿으면 보통대로 친다)
      this.sideStepT = 0;
      return true;
    }
    this.sideStepT += dt;
    if (th && !this.actLocked && this.noticedThreat(th) && this.respond(th, d)) return true;
    if (this.me.gait?.req && this.sideStepT < 0.7) return true; // 아직 발이 떠 있다
    this.pointBlocked = s.state === 'stand' && this.foeClass(s).online;
    this.startStrike();
    return true;
  }

  // ───────────────────────── 마른 길 (사장님 10/14 18:3x '라트나 마른길 AI 넣어' — config.js DRYPATH · docs/import/ratna_drypath_2026-10-14.md) ─────────────────────────
  //  drySense > 0 일 때만 부른다(라트나 · 잠든 습지). 땅은 물리와 같은 젖음 지도(wetlandWetness — 진흙 감속이 읽는 그 값)로만 읽고, 디딤돌 그림은 보지 않는다.
  //  내 발 자리 = 골반 수평 자리(감속 판정과 같은 점) · 상대 자리 = 반응 시간만큼 늦게 본 가슴 + 골반 속도 × 앞질러 봄(updateCombat 의 거리 셈과 같은 꼴).
  //  난수를 새로 굴리지 않는다(돌기 고르기는 옛 굴림 x 를 그대로 쓴다). 새 상한·문턱·쿨다운 없음 — 젖음을 이어지는 무게로만 쓴다

  /** 상대가 선 자리 어림 [x, z] (updateCombat 의 거리 셈과 같은 꼴) */
  dryFoeAt(s) {
    const L = this.level;
    const ahead = L.reaction * (this.chasing ? 1 : L.predict);
    return [s.cx + s.vx * ahead, s.cz + s.vz * ahead];
  }

  /** 상대가 선 자리의 젖음 0~1 (공격 결심 가산점 — opportunity) */
  dryFoeWet(s) {
    const [x, z] = this.dryFoeAt(s);
    return wetlandWetness(x, z);
  }

  /**
   * 내 발을 둘 자리의 값 0~1: 젖음 — 그리고 디딜 수 없는 곳(석상 길잡이 반지름(석상 + OBSTACLE_ROUTE.clear) 안 · 결투장 울타리 ARENA.radius 밖)은 다 젖은 땅처럼 본다
   *  (가장자리는 웅덩이와 같은 폭 WETLAND_RIM 으로 녹임 — 걸음을 석상·울타리 쪽으로 틀거나 그쪽으로 나오지 않는다)
   */
  dryCost(x, z) {
    let w = wetlandWetness(x, z);
    const edge = clamp((Math.hypot(x, z) - ARENA.radius + WETLAND_RIM) / WETLAND_RIM, 0, 1);
    if (edge > 0) w = Math.max(w, edge * edge * (3 - 2 * edge));
    const ob = this.me.arenaObstacle;
    if (!ob) return w;
    const t = clamp((ob.radius + OBSTACLE_ROUTE.clear - Math.hypot(x - ob.x, z - ob.z)) / WETLAND_RIM, 0, 1);
    return Math.max(w, t * t * (3 - 2 * t));
  }

  /**
   * 마른 길 (발): 간 보기·물러나기·막으며 물러서기·다가가기(칼을 들며·닿기 전) 동안, 석상 돌아가기까지 끝난 이번 스텝 스틱을 땅에 맞춘다. 셋 모두 이어지는 값이라 떨지 않는다:
   *  ① 누르기 (간 보며 옆으로 도는 거리 안 — moveFeet 와 같은 조건): 지금 자리에서 상대 등 뒤가 젖었으면(dryOrbit 의 등 뒤 젖음 b) 스틱을 앞으로 세기 × b × DRYPATH.press 만큼 더 민다
   *     — 상대가 물러나면 웅덩이로 물러난다
   *  ② 나오기: 지금 발 자리가 젖었으면(값 w > 0) 둘레 여덟 쪽 DRYPATH.look m 땅의 마른 정도로 가리킨 쪽(마른 몫 × 그쪽 단위 벡터의 합 ÷ 2)으로 걸음을 섞는다 — 섞는 몫 = 세기 × w.
   *     웅덩이 한가운데서도 가장자리 쪽을 가리킨다(웅덩이 짧은 반지름이 look 남짓)
   *  ③ 틀기: 가는 쪽에서 좌우로 DRYPATH.fan 돌린 두 자리(look m 앞) 가운데 덜 젖은 쪽으로 튼다 — 트는 각 = fan × 세기 × (한쪽 값 − 다른 쪽 값), 가장 크게 fan × 세기
   *  땅 위 빠르기는 스틱 × 옆·뒤 걸음 몫(fighter.driveBalance 와 같은 몫)으로 셈하고 ③ 은 빠르기를 그대로 둔다. 발밑·둘레가 다 마르고 등 뒤도 마르면 스틱 그대로.
   *  베는 걸음·비껴 딛는 기술 걸음·쓰러짐·발 묶임 동안은 손대지 않는다
   */
  dryFeet(ds) {
    const me = this.me;
    const closing = this.mode === 'attack' && (this.phase === 'windup' || this.phase === 'approach' || this.phase === 'rdWind') && this.sideStepT == null;
    if ((this.mode !== 'watch' && this.mode !== 'withdraw' && this.mode !== 'defend' && !closing) || me.state !== 'stand' || me.feetHeld || me.revival || !this.foe.alive || me.weapon?.gun) return;
    const D = DRYPATH;
    let sy = me.move.y;
    if (this.mode === 'watch' && this.d < this.holdDist() + 0.6) sy += ds * this.dryOrbit([0])[0][1] * D.press; // ① 누르기
    const f = me.forward(_v2);
    const r = me.right(_v1);
    const vs = me.move.x * GAIT.sideFactor;
    const vf = sy * (sy < 0 ? GAIT.backFactor : 1);
    let vx = vs * r.x + vf * f.x; // 땅 위 빠르기 몫 (앞 걸음 스틱 1 = 1)
    let vz = vs * r.z + vf * f.z;
    const p = me.bodies.pelvis.translation();
    const here = this.dryCost(p.x, p.z);
    if (here > 0) {
      // ② 나오기
      let ex = 0;
      let ez = 0;
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        const dry = 1 - this.dryCost(p.x + Math.cos(a) * D.look, p.z + Math.sin(a) * D.look);
        ex += dry * Math.cos(a);
        ez += dry * Math.sin(a);
      }
      const b = ds * here;
      vx += (ex / 2 - vx) * b;
      vz += (ez / 2 - vz) * b;
    }
    const v = Math.hypot(vx, vz);
    let turn = 0;
    if (v > 1e-6) {
      // ③ 틀기
      const wx = vx / v;
      const wz = vz / v;
      const at = (a) => this.dryCost(p.x + (wx * Math.cos(a) - wz * Math.sin(a)) * D.look, p.z + (wx * Math.sin(a) + wz * Math.cos(a)) * D.look);
      turn = D.fan * ds * (at(-D.fan) - at(D.fan)); // + 면 +fan 쪽이 덜 젖었다
      const c = Math.cos(turn);
      const s = Math.sin(turn);
      vx = v * (wx * c - wz * s);
      vz = v * (wx * s + wz * c);
    }
    if (!turn && !(here > 0) && sy === me.move.y) return; // 다 마른 땅: 스틱 그대로
    const ns = vx * r.x + vz * r.z; // 옆 · 앞 몫으로 되돌림
    const nf = vx * f.x + vz * f.z;
    const lim = Math.max(1, me.emoMods?.move ?? 1); // moveFeet 의 스틱 자르기와 같은 폭
    me.move.set(clamp(ns / GAIT.sideFactor, -lim, lim), clamp(nf / (nf < 0 ? GAIT.backFactor : 1), -lim, lim));
    me.stickX = me.move.x; // 석상 돌아가기(routeAroundStageObstacle)와 같은 꼴
    me.stickY = me.move.y;
  }

  /**
   * 마른 길 자리 값: 상대 둘레를 DRYPATH.orbit 만큼 오른쪽(+1 — 스틱 옆 +) · 제자리(0) · 왼쪽(−1)으로 돌아간 자리(거리 그대로)마다 [값, 등 뒤 젖음].
   *  등 뒤 젖음 = 나 → 상대 줄 너머 DRYPATH.back m 를 셋으로 나눈 자리(⅓ · ⅔ · 끝)의 젖음 평균 — 상대가 밀려 물러날 길.
   *  값 = herd × 등 뒤 젖음 − self × 내 발 자리 값(dryCost). 돌아간 자리에서 석상이 상대를 가리면 가장 나쁜 값(−self). sides 를 주면 그 쪽만
   */
  dryOrbit(sides = [1, 0, -1]) {
    const D = DRYPATH;
    const me = this.me;
    const ob = me.arenaObstacle;
    const p = me.bodies.pelvis.translation();
    const [fx, fz] = this.dryFoeAt(this.sense.seen(this.level.reaction + realS(0.04) * this.anger));
    const ox = p.x - fx;
    const oz = p.z - fz;
    const R = Math.hypot(ox, oz) || 1e-6;
    const r = me.right(_v1);
    return sides.map((sg) => {
      let qx = ox;
      let qz = oz;
      if (sg) {
        const ex = ox + sg * r.x * R * D.orbit;
        const ez = oz + sg * r.z * R * D.orbit;
        const k = R / (Math.hypot(ex, ez) || 1e-6);
        qx = ex * k;
        qz = ez * k;
      }
      const behind = (k) => wetlandWetness(fx - (qx / R) * D.back * k, fz - (qz / R) * D.back * k);
      const back = (behind(1 / 3) + behind(2 / 3) + behind(1)) / 3;
      const mx = fx + qx;
      const mz = fz + qz;
      if (sg && ob && obstacleSegmentBlocked({ x: mx, z: mz }, { x: fx, z: fz }, ob.radius + OBSTACLE_ROUTE.clear, ob)) return [-D.self, back];
      return [D.herd * back - D.self * this.dryCost(mx, mz), back];
    });
  }

  /**
   * 마른 길 (돌기 고르기 — 옛 돌기 박자 circleTimer 에서 한 번): dryOrbit 의 오른쪽 · 제자리 · 왼쪽 값으로, 옛 굴림 x 를 그대로 써서 고른다.
   *  옛 몫(멈춤 0.45 · 즐겨 도는 쪽 0.40 · 반대쪽 0.15)에서 시작해, 도는 편이 제자리보다 나은 만큼 멈춤 몫을 줄이고(못하면 늘리고)
   *  한쪽이 나은 만큼 그쪽 몫을 늘린다 — 둘 다 × 세기, 값 차를 (herd + self)로 나눠 몫이 0~1 을 넘지 않는다. 땅이 다 같으면 옛 줄과 같은 x 에서 같은 값(도는 빠르기 circleRate 그대로)
   */
  dryCircle(x, ds) {
    const D = DRYPATH;
    const [[vR], [v0], [vL]] = this.dryOrbit();
    const span = D.herd + D.self;
    const h = this.pers.circleDir; // 즐겨 도는 쪽
    const lean = (ds * (vR - vL) * h) / span; // + 면 땅이 즐겨 도는 쪽을 민다
    const pStop = 0.45 * (1 - (ds * (Math.max(vR, vL) - v0)) / span);
    const p0 = 0.4 / 0.55; // 돌 때 즐겨 도는 쪽 몫 (옛 0.40 : 0.15)
    const pHabit = lean > 0 ? p0 + lean * (1 - p0) : p0 + lean * p0;
    if (x < pStop) return 0;
    return ((x - pStop) / (1 - pStop) < pHabit ? h : -h) * this.pers.circleRate;
  }

  /**
   * 마른 길 (석상 돌아갈 쪽): 아직 쪽을 안 정했으면(obstacleSide null) 석상 둘레 두 길을 길잡이 고리(석상 + clear + ring) 위에서 돌기 걸음(OBSTACLE_ROUTE.step) 간격으로 견주어
   *  덜 걸리는 쪽을 미리 적어 둔다 — 걸리는 시간 = 길이 ÷ (1 − (1 − WETLAND_CORE_SPEED) × 세기 × 젖음): 진흙 감속을 세기만큼만 알고 셈한다(마른 땅뿐이면 옛 고르기처럼 짧은 쪽).
   *  routeAroundStageObstacle 은 길이 막혔을 때만 이 값을 쓰고(??=) 막히지 않았으면 null 로 되돌린다 — 그래서 한 번 막힌 동안은 쪽이 바뀌지 않는다(석상 앞에서 떨지 않음)
   */
  dryRouteSide(ds) {
    const me = this.me;
    const ob = me.arenaObstacle;
    if (!ob || this.obstacleSide != null || !this.foe.alive || me.state !== 'stand' || me.feetHeld || me.revival) return; // 돌아가기가 길을 보지 않는 동안은 적어 두지 않는다
    const p = me.bodies.pelvis.translation();
    const t = this.foe.bodies.pelvis.translation();
    const a0 = Math.atan2(p.z - ob.z, p.x - ob.x);
    const a1 = Math.atan2(t.z - ob.z, t.x - ob.x);
    const R = ob.radius + OBSTACLE_ROUTE.clear + OBSTACLE_ROUTE.ring;
    const TAU = Math.PI * 2;
    const time = (side) => {
      const span = (((side * (a1 - a0)) % TAU) + TAU) % TAU; // 이 쪽으로 돌아 닿는 각
      const n = Math.max(1, Math.ceil(span / OBSTACLE_ROUTE.step));
      let T = 0;
      for (let k = 1; k <= n; k++) {
        const a = a0 + (side * span * k) / n;
        T += (span * R) / n / (1 - (1 - WETLAND_CORE_SPEED) * ds * wetlandWetness(ob.x + Math.cos(a) * R, ob.z + Math.sin(a) * R));
      }
      return T;
    };
    this.obstacleSide = time(1) <= time(-1) ? 1 : -1;
  }
}

// ── 도우미 ──
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _a0 = new THREE.Vector3();
const _b0 = new THREE.Vector3();
const _d1 = new THREE.Vector3();
const _d2 = new THREE.Vector3();
const _r = new THREE.Vector3();

/** 두 선분(p1-q1, p2-q2) 사이 가장 가까운 거리 */
/** (파손) 부러져 잃은 칼날 길이 (m). 무기 제원(spec)은 그대로이고 싸움꾼의 weaponCfg.bladeLength 만 줄어든다 */
function brokenLoss(f) {
  return Math.max(0, (f.weapon?.bladeLength ?? 0) - f.weaponCfg.bladeLength);
}
/**
 * (파손) 간격 표(가슴~가슴, m)를 잃은 칼 길이 dL 만큼 줄인다. 칼끝이 통째로 없어져 닿는 끝(reach)은 dL 그대로,
 *  베어 닿는 거리(contact)는 칼날 치는 자리가 끝에서 조금 안쪽이라 0.85·dL (실측 표에서 칼 길이 차와 contact 차의 비 ≈ 0.85).
 *  붙어 싸우는 거리(clinch)는 contact 보다 멀면 안 되니 그 밑으로 누른다.
 */
function shrinkM(M, dL) {
  const contact = Math.max(0.6, M.contact - 0.85 * dL);
  return { ...M, contact, reach: Math.max(contact + 0.1, M.reach - dL), clinch: Math.min(M.clinch, contact - 0.12) };
}

function segDist(p1, q1, p2, q2) {
  _d1.subVectors(q1, p1);
  _d2.subVectors(q2, p2);
  _r.subVectors(p1, p2);
  const a = _d1.dot(_d1);
  const e = _d2.dot(_d2);
  const f = _d2.dot(_r);
  if (a < 1e-9 || e < 1e-9) return _r.length();
  const b = _d1.dot(_d2);
  const c = _d1.dot(_r);
  const den = a * e - b * b;
  let sN = den > 1e-9 ? clamp((b * f - c * e) / den, 0, 1) : 0;
  let tN = (b * sN + f) / e;
  if (tN < 0) {
    tN = 0;
    sN = clamp(-c / a, 0, 1);
  } else if (tN > 1) {
    tN = 1;
    sN = clamp((b - c) / a, 0, 1);
  }
  return Math.hypot(p1.x + _d1.x * sN - p2.x - _d2.x * tN, p1.y + _d1.y * sN - p2.y - _d2.y * tN, p1.z + _d1.z * sN - p2.z - _d2.z * tN);
}

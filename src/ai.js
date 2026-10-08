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
import { lowFinishEnabled, lowFinishPosture } from './finish_entry.js';
import { AI_LEVELS, ARENA, BODY, SKILL, CLOSE } from './config.js';
import { Senses } from './ai_sense.js';
import { padDist } from './ai_techniques.js';
import { schoolOf } from './schools.js';
import { getWeapon } from './weapons.js';
import { Emotions, emoMods } from './emotions.js';
import { gunAI } from './gun.js';
import { enabled as opportunityEnabled } from './opportunity_target.js';
import { distanceEnabled, measureThrustDistance } from './combat_distance.js';
import { createOpportunityAI, updateOpportunityEpisode, opportunityCandidate,
  prepareOpportunityAttack, refreshOpportunityAttack, commitOpportunityAttack,
  opportunityPad, neckCrossingTechnique, advanceOpportunityAICommand,
  opportunityRangeAttack, prepareOpportunityRange, clearOpportunityRange } from './opportunity_ai.js';

// 공포 떨림의 최대 크기 (m, 공포 세기 1일 때 손 위치 잔떨림). 눈에 더 띄게 하려면 올린다 — moveHand() 참고
const FEAR_TREMOR = 0.03;

const clamp = THREE.MathUtils.clamp;
const rand = (a, b) => a + Math.random() * (b - a);
// school.measure의 간격 상수를 잴 때 쓴 롱소드 칼 길이(칼자루+칼날, m) — measured 표에 없는
// 무기(미래에 추가될 무기)에 대한 안전장치 비율 계산에만 쓴다.
const WEAPON_BASELINE = 0.13 + 1.05;
// 무기 PM의 실측(tools/sim/weapon_measure.mjs, docs/weapons.md §2 — 혼자 zornhau 한 번을 휘두르며
// 칼날 70% 지점이 머리 높이를 지나는 순간의 실제 간격을 잰 값)을 롱소드 기준(같은 표의 롱소드 raw
// 값)으로 나눈 비율. 칼날+자루 길이만 단순 비례하는 것보다 훨씬 정확하다 — 실제 팔·몸 뻗음까지
// 담겨 있어서, 짧은 칼(환두대도 등)이 순수 길이비보다 실제로는 덜 불리하다는 게 이 표로 드러났다.
// excalibur_replica는 엑스칼리버와 칼날·자루 치수가 완전히 같아 같은 비율을 쓴다.
export const MEASURED = {
  // id: [contact, reach, clinch, cutTime] raw — tools/sim/weapon_measures.mjs 와 같은 값 (감독 확정 14종 로스터).
  //  10라운드 B: 한손 뻗기(guards.js) 뒤 hybrid(게임 기본)로 다시 잰 값 (tools/sim/hybrid.mjs weapon_measure.mjs). 에스톡은 유효 간격(× 0.914)
  //  (finish.js 도 읽는다: 쓰러진 상대까지 닿는 거리 배율 downReachK)
  //  cutTime 은 보정 없는 raw(롱소드 0.41)라 비율로만 쓴다.
  longsword: [1.62, 1.9, 1.25, 0.41],
  zweihander: [1.71, 2.08, 1.32, 0.48],
  estoc: [1.57, 1.99, 1.22, 0.42],
  sabre: [1.39, 1.58, 1.07, 0.36],
  rapier: [1.54, 1.68, 1.19, 0.29],
  falchion: [1.37, 1.56, 1.06, 0.33],
  monohoshizao: [1.58, 1.87, 1.22, 0.47],
  qinggang: [1.35, 1.52, 1.04, 0.33],
  excalibur: [1.55, 1.83, 1.2, 0.4],
  excalibur_replica: [1.55, 1.83, 1.2, 0.4],
  lightsaber: [1.46, 1.65, 1.13, 0.24], // 한손 자세표를 쓰지 않는다 (weapons.js oneHandStance)
  tree_branch: [1.41, 1.55, 1.09, 0.27], // 10/08 길이 -10%: 같은 입력의 도달 거리 차이·시간 비율만 반영.
  rubber_chicken: [0.88, 1.24, 0.68, 0.18],
  frozen_tuna: [1.36, 1.63, 1.05, 0.44],
};
const LS_MEASURED = MEASURED.longsword;

// 감정 판정(Emotions)·텀 상수·고유 능력 배율표는 emotions.js 에 (플레이어와 같은 규칙)
export class AI {
  /**
   * persona: 캐릭터마다 다른 개성을 주입한다 (characters.js). 안 주면(undefined) 예전과 똑같은
   * 무작위 성격의 "기본 AI"가 된다 (fights12.mjs 회귀 기준이 그대로 재현되도록, 값을 주지 않은
   * 항목은 전부 예전과 같은 rand() 호출로 채운다).
   *  persona.school: 유파 꾸러미 id (schools.js). 자세·기술·속임수·막기 자세·간격 상수를 여기서 읽는다. 안 주면 롱소드
   *  persona.level:  AI_LEVELS(난이도) 위에 덮어씌우는 값 (reaction·guardChance·counter·feint·read·strength 등)
   *  persona.pers:   성격(this.pers) 위에 덮어씌우는 값. guardPref/techPref는 자세·기술 이름별로 부분 지정 가능
   */
  constructor(me, foe, levelName = 'normal', persona = null) {
    this.me = me;
    this.foe = foe;
    this.sense = new Senses(me, foe);
    this.persona = persona || {};
    // 근접 밀치기 (closeQuarters): persona.close 가 있는 인물만 스틱으로 민다. 기본 AI 는 밀지 않는다 (fights12·live_battery 그대로)
    if (this.persona.close) me.canShove = true;
    if (this.persona.close?.kind === 'kick') me.closeStepKind = 'pass'; // 랴오 발차기 = 뒷발이 지나 딛는 몸 부딪기 (발차기 명령·발 충돌이 없다)
    this.closeWant = false; // 밀기로 정함 (사건마다 한 번 rate 굴림)
    this.closeBind = false; // 칼이 맞물려 있나 (checkBind 와 같은 기하, 읽기만)
    this.closeIn = false; // 지난 스텝에 닿는 거리 안이었나 (E1 들어섬)
    this.closeInside = false; // 이번 스텝 닿는 거리 안 (moveFeet 스틱 덮어쓰기)
    this.closeWasBarge = false;
    this.closeShoves = 0; // 지난 스텝까지 본 me.shoves (같은 스텝에 발사·거절된 것도 끝으로 읽는다)
    this.closeEv = { E1: 0, E2: 0, E4: 0, won: 0, cut: 0 }; // 굴린 사건 수·이긴 수·이어 벤 수 (재기용)
    this.school = schoolOf(this.persona.school);
    // 간격 상수 (가슴과 가슴 사이 수평 거리, m). school.measure는 롱소드로 잰 값이라, 칼이 그보다 짧거나
    // 길면 그 비율만큼 줄이거나 늘린다 — 안 그러면 짧은 칼을 쥔 쪽이 롱소드 간격에서 공격을 걸었다가
    // 정작 닿지도 못하고 상대 롱소드에만 맞는다 (무기 밸런스 시뮬로 확인한 근본 원인).
    const baseM = this.school.measure;
    // 실측 표에 있으면 축마다 다른 실측 비율을, 없으면(미래에 무기가 늘어날 때 대비) 칼 길이 비율로
    // 대충이라도 스케일한다. 기준은 "이 유파 measure를 잰 무기"(school.weapon, 대부분 롱소드) — 캐릭터
    // 유파 꾸러미(청강검·나뭇가지·복제품)는 measure가 이미 그 무기 실측이라, 롱소드 기준으로 또 줄이면
    // 두 번 줄어든다(병합 때 확인한 회귀). 같은 무기면 정확히 1배(그대로)가 되게 한다.
    const schoolWid = getWeapon(this.school.weapon ?? 'longsword').id; // 옛 id(jian 등)는 별칭으로 정식 id 로
    const schoolM = MEASURED[schoolWid] ?? LS_MEASURED;
    const scaledM = (w) => {
      if (!w || w.id === schoolWid) return baseM;
      const m = MEASURED[w.id];
      if (m) {
        return { ...baseM, contact: baseM.contact * (m[0] / schoolM[0]), reach: baseM.reach * (m[1] / schoolM[1]), clinch: baseM.clinch * (m[2] / schoolM[2]), cutTime: baseM.cutTime * (m[3] / schoolM[3]) }; // 베는 시간도 같은 비율로 (전엔 모든 무기가 롱소드 0.3 그대로)
      }
      const s = (w.bladeLength + w.hiltLength) / WEAPON_BASELINE;
      return { ...baseM, contact: baseM.contact * s, reach: baseM.reach * s, clinch: baseM.clinch * s };
    };
    this.M = scaledM(me.weapon);
    // 상대 칼 길이로도 따로 잰다: foeReach(아래)는 "내가 아니라 상대가" 닿는 거리를 어림하는 값이라, 내
    // 무기가 아니라 상대 무기 기준으로 스케일해야 한다 (짧은 칼을 든 쪽이 상대의 롱소드 간격을 실제보다
    // 가깝게 어림해 그대로 걸어 들어가는 일을 막는다)
    this.foeM = scaledM(foe.weapon);
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
    const guardPref = {};
    for (const g of this.school.guards) guardPref[g.name] = P.guardPref && g.name in P.guardPref ? P.guardPref[g.name] : rand(0.4, 1.6);
    const techPref = {};
    for (const t of this.school.tech) techPref[t.name] = P.techPref && t.name in P.techPref ? P.techPref[t.name] : rand(0.6, 1.4);
    this.pers = {
      margin: P.margin ?? rand(0.2, 0.5), // 간격 밖에 얼마나 여유를 두고 서는지 (m)
      aggr: P.aggr ?? rand(0.85, 1.2), // 공격 성향
      circleDir: P.circleDir ?? (Math.random() < 0.5 ? -1 : 1), // 즐겨 도는 방향
      circleRate: P.circleRate ?? rand(0.15, 0.4), // 옆걸음 빠르기 (천천히: 빙빙 도는 춤이 되지 않게)
      rhythm: P.rhythm ?? rand(2.4, 4.5), // 자세를 바꾸는 박자 (초). 검객은 한 자세를 차분히 지킨다 (자주 바꾸면 춤추는 것처럼 보인다)
      vor: P.vor ?? rand(0.15, 0.6), // 달려드는 상대를 맞받아 베는 쪽(1)인가, 물러나 헛치게 하는 쪽(0)인가
      patienceTime: P.patienceTime ?? rand(7, 12), // 인내심이 바닥나는 데 걸리는 시간 (초)
      // 자세 옮기기 버릇: 새 자세가 지금 자세에서 멀수록 이 값만큼 무겁게 깎인다.
      //  크면(예: 5) 가까운 자세만 고집하는 신중한 검객, 작으면(예: 0.5) 먼 자세로도 서슴없이 뛰는 변덕스러운 검객
      guardStick: P.guardStick ?? 2.5,
      guardSpeed: P.guardSpeed ?? 0.9, // 간 보는 동안 자세를 잡는 손 빠르기 (m/s): 크면 자세를 휙휙 바꾸는 사람, 작으면 느긋한 사람
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
    this.guardTimer = rand(0.3, 1.0);
    this.patience = rand(0.55, 0.85); // 처음엔 조금 간을 보다가 들어간다
    // 기존 난수 순서는 유지하되, 시작 분노의 성급함을 초기화 뒤에 적용한다.
    if (this.emotion === 'anger') this.patience = Math.min(this.patience, 0.2);
    this.foeReach = this.foeM.reach + 0.05; // 상대 칼이 닿는 거리 추정 (생각보다 멀리서 맞으면 늘린다)
    this.decideTimer = 0;
    this.timer = 0;
    this.attackT = 0;
    this.shuffle = 0;
    this.shuffleTimer = 0;
    this.circle = 0;
    this.circleTimer = rand(0.5, 1.5);
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
    this.opportunityState = createOpportunityAI();
    this.opportunitySeen = null;
    this.opportunityAttack = null;
    this.opportunityCommand = { handY: 0, pitch: 0 };
    if (opportunityEnabled(me)) me.opportunityAI = this;
    this.guard = this.pickGuard(null);
  }

  setLevel(name) {
    this.levelName = AI_LEVELS[name] ? name : 'normal';
    const base = AI_LEVELS[this.levelName];
    // persona.level: 반응 시간·막기 확률·읽는 눈·힘 같은 "실력 숫자"를 난이도 기본값 위에 캐릭터별로 덮어쓴다
    const PL = this.persona?.level;
    this.level = PL ? { ...base, ...PL } : base;
    this.me.strength = this.level.strength;
    this.me.skill.level = this.level.skill;
  }

  /** 상대가 칼을 놓쳤다(또는 붙어 싸울 수 없는 권총을 들었다): 간격을 지킬 까닭이 없다 → 쫓아가 끝낸다 (도망치는 상대를 놓치지 않게) */
  get chasing() {
    return this.foe.alive && (!this.foe.armed || !!this.foe.weapon?.gun) && this.me.armed;
  }

  /** 지금 공격 동작 중인가 (평가·디버그용) */
  get attacking() {
    return this.mode === 'attack';
  }

  // ───────────────────────── 매 스텝 ─────────────────────────
  update(dt) {
    const me = this.me;
    const foe = this.foe;
    // Early-return states must not leave a pending approach command alive.
    if (!me.alive || !me.armed || !['stand', 'kneel'].includes(me.state) || me.revival || me.feetHeld) clearOpportunityRange(this);
    this.sense.record(dt);
    const L = this.level;
    if (opportunityEnabled(me)) {
      me.opportunityAI = this;
      updateOpportunityEpisode(this, this.sense.seen(L.reaction + 0.04 * this.anger), dt);
      advanceOpportunityAICommand(this, dt);
    }

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
      this.opportunityAttack = null;
      this.closeWant = this.closeBind = false;
      me.move.set(0, 0);
      this.mode = 'withdraw';
      this.phase = 'ready';
      this.timer = 0.9;
      this.path.length = 0;
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
    const downGap = (lowFinishEnabled(me) ? lowFinishPosture(me, foe, !!(me.skill?.tap?.down && me.skill.tap.foe === foe && !me.skill.tap.abort && !me.skill.tap.ended)) : foe.state === 'down') && me.finish?.gap;
    if (downGap && !this.Mup) {
      this.Mup = this.M; // 서 있는 상대의 간격 (상대가 일어나면 되돌린다)
      this.M = { ...this.M, ...downGap };
    } else if (!downGap && this.Mup) {
      this.M = this.Mup;
      this.Mup = null;
    }

    // ── 보기 (반응 시간만큼 늦게) ──
    const s = this.sense.seen(L.reaction + 0.04 * this.anger); // 화나면 눈이 조금 늦다
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
    // 상대가 얼마나 몰아치는가: 다가오며 휘두르는 사람이면 곧장 벨 수 있는 자세(지붕·황소)로 기다린다
    const aggrNow = (this.foeClosing > 0.6 ? 0.6 : 0) + (Math.hypot(s.hvx, s.hvy) > 3 && d < this.foeReach + 0.6 ? 0.6 : 0);
    this.foeAggro += (Math.min(1, aggrNow) - this.foeAggro) * Math.min(1, dt / 2.5);

    // 맞혔나 / 맞았나 (움찔하는 것은 눈에 보이고, 맞은 것은 느낀다)
    if (foe.pain > this.prevFoePain + 0.05 && this.mode === 'attack') this.hitLanded = true;
    const hurt = me.pain > this.prevMyPain + 0.05;
    this.prevFoePain = foe.pain;
    this.prevMyPain = me.pain;
    if (hurt) {
      // 생각보다 멀리서 맞았으면 상대 칼이 더 멀리 닿는다고 고쳐 생각한다
      if (this.mode !== 'attack') this.foeReach = clamp(Math.max(this.foeReach, d + 0.1), this.foeM.reach, 2.5);
      if (this.mode !== 'attack' || this.phase !== 'strike') this.startWithdraw(0.8);
    }
    this.foeReach += (this.foeM.reach + 0.05 - this.foeReach) * dt * 0.03; // 천천히 원래 생각으로

    // 인내심: 시간이 지나면 줄어든다 → 판이 늘어지지 않는다
    const hurry = this.hurry();
    this.patience = Math.max(0, this.patience - (dt / this.pers.patienceTime) * L.aggression * this.pers.aggr * hurry);

    // 상대 칼이 내 몸 쪽으로 오나
    const th = this.threat(s, c, r, d);
    this.noThreat = th ? 0 : this.noThreat + dt;
    this.emote(dt, hurt, !!th && d < this.M.clinch + 0.4);
    // 밀치는 중(me.barge)에도 모드 분기는 그대로 돈다: 베기·찌르기를 시작하면 'swing'·'thrust', 막으며 물러서면(defVoid)
    //  closeWant 가 풀려 스틱 0 → 'release' 로 끝난다 (버틴 상대에게 누르기가 끝없이 남지 않게. 새 숫자 없음)
    this.closeQuarters(s, d);

    if (kneeling) {
      // 다리를 못 쓰니 물러나거나 파고들 수 없다: 위험이 오면 그래도 막고, 아니면 사정거리 안에 있을 때만
      //  이따금 짧게 찌른다 (watch()의 적극적인 빈틈 찾기는 쓰지 않는다 — 일어나는 중엔 너무 무모하다)
      if (th && this.mode !== 'attack' && this.noticedThreat(th)) this.respond(th, d);
      else if (this.mode === 'attack') this.attack(dt, s, d, th);
      else {
        this.decideTimer -= dt;
        if (this.decideTimer <= 0) {
          this.decideTimer = rand(0.3, 0.6);
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
    else this.withdraw(dt, s, d, th);

    prepareOpportunityRange(this);
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
    this.opportunityAttack = null;
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
    // 치려는 낌새(간격 가까이서 칼을 들며 다가온다) → 들어오는 순간을 먼저 치거나(Vor), 물러난다
    if (this.preThreat(s, d, dt)) return;
    if (this.seize(s, d, dt)) return;

    // 자세 바꾸기 (잠깐씩 멈추며)
    this.guardTimer -= dt;
    if (this.guardTimer <= 0) {
      this.guardTimer = this.pers.rhythm * rand(0.6, 1.4);
      this.guard = this.pickGuard(s);
    }
    this.hand.set(this.guard.pad[0], this.guard.pad[1]);
    this.handSpeed = this.pers.guardSpeed; // 천천히 차분하게: 휘두르기로 보이지 않게 (검술 층의 자동 내딛기가 걸리지 않는다)

    // 기회를 본다 (사람처럼 가끔씩 판단)
    this.decideTimer -= dt;
    if (this.decideTimer > 0) return;
    this.decideTimer = rand(0.06, 0.14);
    const opp = this.opportunity(s, d);
    let need = 1 - 0.3 * (this.pers.aggr * L.aggression - 0.8);
    // 겁먹으면 확실한 순간(헛친 뒤·쓰러진 상대)에만 들어간다
    if (opp.kind !== 'recover' && opp.kind !== 'finish') need += this.fear * 0.7;
    const reachOut = this.chasing ? 1.0 : 0.4; // 빈손 상대는 조금 멀어도 뛰어들며 친다
    if (opp.score >= need && d < this.holdDist() + reachOut) this.startAttack(this.pickTech(s, opp.kind), opp.kind);
  }

  /** 간을 볼 거리: 상대 칼이 닿는 거리 + 여유. 인내심이 줄수록 여유를 줄여 간격 끝에 선다 */
  holdDist() {
    const L = this.level;
    let m = this.pers.margin * (0.3 + 0.7 * this.patience) * (0.6 + 0.4 * L.discipline * (1 - 0.3 * this.anger)); // 화나면 규율이 흐트러진다
    if (this.guard?.name === 'alber') m -= 0.12; // 바보 자세: 머리를 비워 두고 조금 더 다가가 유인한다
    if (this.cautious) m += 0.2;
    m += this.fear * 0.35; // 겁먹으면 상대 칼에서 더 멀찍이 선다
    m -= this.obsession * 0.15; // 물고 늘어질 땐 간격 끝보다 조금 더 안쪽에 선다
    m += (1 - this.me.vigor) * 0.3; // 다쳐서 힘이 빠지면 더 조심스럽게 선다
    if (!this.me.armed) m += 0.6; // 칼을 놓쳤으면 상대 칼이 닿지 않게 멀찍이 선다
    // 빈손 상대는 칼이 닿지 않는다: 내 칼이 닿는 거리까지 다가선다
    // The optional distance trial retains the opponent's safety distance, but
    // also gives our own weapon's measured reach a modest vote. This is an AI
    // preference, not a damage-optimal historical distance or a new reach cap.
    const reach = distanceEnabled(this.me) && this.me.armed && !this.chasing
      ? this.foeReach * 0.75 + this.M.reach * 0.25 : this.foeReach;
    return (this.chasing ? this.M.contact : reach) + Math.max(0.08, m);
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
    if (!C.update(dt, ev)) return; // 문턱값이 전부 0 (기본 AI): 감정층이 꺼져 있다
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
    const swungRecently = this.sense.recentHandSpeed(L.reaction, 0.7) > 3.5;
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
    this.seizeT = rand(0.08, 0.16);
    if (d > this.M.reach + 0.2 || d < 0.9 || !this.foe.alive) return false;
    const L = this.level;
    const swung = this.sense.recentHandSpeed(L.reaction, 0.6) > 3.5;
    const recovering = swung && Math.hypot(s.hvx, s.hvy) < 1.8;
    const pressing = d < 1.5 && this.foeClosing > 0.1;
    if (!recovering && !pressing) return false;
    if (Math.random() > (recovering ? 0.3 + 0.5 * L.read : 0.1 + 0.35 * L.read)) return false;
    return this.startAttack(this.pickTech(s, 'recover'), recovering ? 'recover' : 'press', { noFeint: true });
  }

  /** 기술 고르기: 노리는 빈틈 × 상대 자세 × 준비 자세까지의 거리 × 성격 */
  pickTech(s, why) {
    const L = this.level;
    const cls = this.foeClass(s);
    const hand = [this.me.handOffset.x, this.me.handOffset.y];
    // 기술 목록(school.tech)은 롱소드(찌르기·베기 모두 배율 1)를 기준으로 짜여 있다. 찌르기 전용에
    // 가까운 무기(에스톡·레이피어 등)는 실제로 찌르기가 훨씬 잘 먹히는데 기술을 고를 때 이걸 몰라
    // 베기만 골라 쓰다 지는 일이 있었다. 날 없는 무기는 휘두름의 둔타 계수와 비교한다:
    // 가시 철퇴의 mCut=0으로 나누면 모든 찌르기 점수가 Infinity가 된다.
    const cfg = this.me.weaponCfg;
    const swingScale = cfg?.edged ? cfg.mCut : cfg?.mBlunt;
    const thrustBias = !cfg ? 1 : Number.isFinite(swingScale) && swingScale > 0 && Number.isFinite(cfg.mThrust) ? cfg.mThrust / swingScale : 0;
    const target = opportunityEnabled(this.me) ? opportunityCandidate(this) : null;
    const neckCut = target?.kind === 'cut' && this.school.tech.some(neckCrossingTechnique);
    const focusKind = target?.kind === 'thrust' ? 'thrust' : target ? 'cut' : null;
    const focusedKind = this.school.tech.some(t => t.kind === focusKind) ? focusKind : null;
    let best = null;
    let bestW = -1;
    for (const t of this.school.tech) {
      if (focusedKind && t.kind !== focusedKind) continue;
      if (neckCut && !neckCrossingTechnique(t)) continue;
      let w = this.pers.techPref[t.name] * t.base;
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
      if (why === 'finish' && !neckCut) fit *= up ? 1.5 : 0.6; // 낮은 몸/둔기 머리: 위에서 내려친다. 목베기는 가로 경로를 쓴다.
      if (why === 'windup' || why === 'stepin') fit *= t.fast ? 1.6 : 1; // 짧은 순간: 빠른 기술
      if (why === 'stop') fit *= t.presses ? 2 : t.kind === 'thrust' ? 0.3 : 1; // 달려드는 몸을 맞받는다: 무거운 베기
      if (t.presses) fit *= 1 + 0.6 * this.anger; // 화나면 무거운 베기(분노의 베기·내려베기)만 찾는다
      w *= Math.pow(fit, 0.3 + 0.7 * L.read);
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
    if (!tech || !this.me.armed) return false; // 칼이 없으면 칠 수 없다
    const L = this.level;
    const hand = [this.me.handOffset.x, this.me.handOffset.y];
    this.mode = 'attack';
    this.tech = tech;
    this.why = why;
    this.hitLanded = false;
    this.bound = false;
    this.chain = opt.chain ?? 0;
    this.attackT = 0;
    this.stepT = 0;
    this.path.length = 0;
    this.pointBlocked = false;
    this.opportunityAttack = null;
    if (opportunityEnabled(this.me)) prepareOpportunityAttack(this, tech);
    if (!opt.chain) this.stats.attacks++;
    // 속임수: 먼저 다른 곳을 치는 척하다가 바꾼다 (상대가 잘 막을수록 자주)
    this.feint = null;
    if (!this.opportunityAttack && !opt.noFeint && (why === 'patience' || why === 'open' || why === 'weak')) {
      const want = L.feint * (1 + Math.min(2, this.foeParried * 0.4));
      if (Math.random() < want * (1 - this.anger)) { // 화나면 속임수를 안 쓴다 (곧장 친다)
        const byName = this.school.techByName;
        const cands = this.school.feints.filter((f) => padDist(hand, byName[f.fake].from) < 0.45);
        if (cands.length) {
          this.feint = cands[Math.floor(Math.random() * cands.length)];
          this.tech = byName[this.feint.fake];
          this.stats.feints++;
        }
      }
    }
    // 준비 자세가 가까우면 곧바로 친다 (숙련자는 크게 들어 올리지 않는다)
    const cd = padDist(hand, opportunityPad(this, this.tech.from));
    this.phase = cd > 0.06 && !opt.skipChamber ? 'windup' : 'approach';
    this.quick = why !== 'patience' && why !== 'open' && why !== 'weak' && why !== 'offbalance';
    // 빈틈을 잡아 순간적으로 치는 공격(recover/stepin/press/counter/stop 등)은 준비 자세로 옮기는 손도
    //  빠르게 움직여야 한다. 느린 chamberSpeed로 챔버하면 정작 순간을 놓친다
    this.fastChamber = !!opt.fastChamber || this.quick;
    this.timer = this.phase === 'approach' && !this.quick ? L.windup * 0.15 : 0;
    return true;
  }

  attack(dt, s, d, th) {
    const L = this.level;
    const me = this.me;
    const t = this.tech;
    this.attackT += dt;
    if ((this.phase === 'windup' || this.phase === 'approach') && !refreshOpportunityAttack(this)) {
      this.abortAttack();
      return;
    }
    const from = opportunityPad(this, t.from);
    const range = prepareOpportunityRange(this);
    if (this.phase === 'windup') {
      // 준비 자세로 (다가가며)
      this.hand.set(from[0], from[1]);
      this.handSpeed = this.fastChamber ? L.parrySpeed : L.chamberSpeed;
      // 준비하는 동안 상대 칼이 들어오면: 숙련자는 공격을 거두고 막는다
      if (th && this.noticedThreat(th) && this.respond(th, d)) return;
      if (padDist([me.handOffset.x, me.handOffset.y], from) < 0.03) {
        this.phase = 'approach';
        this.timer = this.quick ? 0 : L.windup * 0.25; // 잠깐 자세를 잡는다 (쉬운 상대일수록 길다 = 읽기 쉽다)
      }
      if (this.attackT > 1.2) this.abortAttack();
    } else if (this.phase === 'approach') {
      this.hand.set(from[0], from[1]);
      this.timer -= dt;
      // 닿을 거리까지 다가간다. 베는 동안(0.3초) 서로 좁혀지는 거리까지 생각해서 미리 친다
      // 달려드는 상대를 맞받을 때는 조금 일찍 친다: 상대가 휘두르기 전에 내 칼이 먼저 앞에 있어야 한다 (Vor)
      this.need = this.M.contact + t.reach * this.reachScale + 0.05 + (this.why === 'stop' ? 0.2 : 0);
      const inRange = range ? range.valid && range.ready && range.aligned : this.contactDist() <= this.need;
      if (this.timer <= 0 && inRange) {
        // 상대 칼끝이 나를 겨누고 있으면 베며 내딛지 않는다 (칼끝으로 뛰어드는 꼴). 먼저 그 칼을 쳐서 비킨다
        this.pointBlocked = (s.state === 'stand' || !!this.opportunityAttack) && this.foeClass(s).online;
        this.startStrike();
        return;
      }

      if (th && this.noticedThreat(th) && this.respond(th, d)) return;
      // 상대가 물러나 따라잡을 수 없거나 너무 오래 걸리면 그만둔다 (좀비처럼 쫓지 않는다)
      const keep = 1 + 0.5 * this.obsession; // 물고 늘어질 땐 접근을 쉽게 포기하지 않는다
      if (this.attackT > (this.chasing ? 3 : 1.4) * keep || d > this.holdDist() + (this.chasing ? 1.4 : 0.8) * keep) this.abortAttack();
    } else if (this.phase === 'strike') {
      this.handSpeed = L.strikeSpeed;
      this.checkBind();
      if (!this.path.length) {
        // 흐름(SKILL.flow, 시제품): 칼이 막히지 않았으면 멈춰 서지 않고 지금 손에서 이어지는 베기로 곧장 흐른다
        if (SKILL.flow && this.flowOn(d)) return;
        // 손은 끝 자세에 닿았지만 무거운 칼은 아직 날아가는 중이다 → 칼이 지나갈 때까지 버틴다
        this.phase = 'follow';
        this.timer = 0.3;
      }
    } else if (this.phase === 'follow') {
      this.timer -= dt;
      this.checkBind();
      // 칼이 다 지나가고(칼끝이 느려지고) 나서 다음을 정한다
      if ((this.timer <= 0 && me.tipVel.length() < 6) || this.timer < -0.2) this.afterStrike(d);
    }
  }

  abortAttack() {
    clearOpportunityRange(this);
    this.opportunityAttack = null;
    this.stats.aborted++;
    this.mode = 'watch';
    this.phase = 'ready';
    this.guardTimer = rand(0.2, 0.6);
  }

  startStrike() {
    // All entry paths (including counters) must finish distance preparation
    // before spending one of the two special attempts.
    if (opportunityRangeAttack(this)) {
      const range = measureThrustDistance(this.me, this.opportunityAttack.target);
      if (!range.valid || !range.ready || !range.aligned) return false;
    }
    if (!commitOpportunityAttack(this)) {
      this.abortAttack();
      return false;
    }
    const t = this.tech;
    this.phase = 'strike';
    this.path.length = 0;
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
      for (const p of t.path) this.path.push(opportunityPad(this, p).slice());
      this.feintPts = 0;
      this.stepT = opportunityRangeAttack(this) ? 0 : this.stepTime();
    }
    // 서툰 검객은 벨 때마다 손이 조금씩 빗나간다 (정확도 1이면 난수도 안 뽑아 예전과 같다)
    const prec = this.pers.precision;
    if (prec < 1) {
      const ex = rand(-1, 1) * 0.2 * (1 - prec);
      const ey = rand(-1, 1) * 0.15 * (1 - prec);
      for (const q of this.path) {
        q[0] = clamp(q[0] + ex, -0.6, 0.6);
        q[1] = clamp(q[1] + ey, -0.6, 0.6);
      }
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
    if (t.kind === 'thrust' && !this.feint && (this.me.weaponCfg.thrustStyle || this.opportunityAttack?.kind === 'thrust')) {
      this.me.skill.thrust({ step: false, opportunityTarget: this.opportunityAttack ?? null });
    }
    return true;
  }

  /** 베며 내딛는 시간: 이미 닿는 거리면 내딛지 않는다 (다가오던 걸음의 관성으로 충분하다) */
  stepTime() {
    if (this.why === 'stop') return 0; // 상대가 달려오고 있다: 내가 들어갈 필요가 없다 (옆으로 비켜 선다)
    if (this.pointBlocked) return 0; // 칼끝부터 쳐서 비킨다. 들어가는 것은 그다음 칼(이어 치기)에서
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
    let cut = false;
    if (ended) {
      this.closeWant = false;
      // then 'cut': 밀고 곧장 벤다. 'recover' 는 손에서 가까운 기술, 'shove' 는 느린 이유 목록에 없어 바로 친다
      cut = ended !== 'refused' && C.then === 'cut' && up && this.mode !== 'attack' && this.startAttack(this.pickTech(s, 'recover'), 'shove', { noFeint: true, fastChamber: true });
      if (cut) this.closeEv.cut++;
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
      this.closeEv[ev]++;
      if (Math.random() < C.rate) {
        this.closeWant = true;
        this.closeEv.won++;
      }
    };
    if (!this.closeIn) roll('E1');
    this.closeIn = true;
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
    if (this.hitLanded) {
      this.stats.landed++;
      this.evLanded = true; // 감정층 사건: 맞혔다
    }
    if (this.bound && !this.hitLanded) {
      this.foeParried++; // 칼로 막혔다 → 다음엔 속임수가 통한다
      this.evParried = true; // 감정층 사건: 막혔다
    }
    // 이어 치기(Nachschlag): 막히거나 헛쳤어도 이어 친다. 완전히 붙어 씨름하는 거리(0.75m 아래)만 거른다 —
    //  간격 끝(clinch 근처)에서도 짧게 이어 칠 수 있어야 몰아치는 상대에게 계속 밀리지 않는다
    const maxChain = this.obsession > 0.5 ? 3 : 2; // 물고 늘어질 땐 한 번 더 이어 친다
    const canChain = this.chain < maxChain && d < this.M.reach + 0.1 && d > this.M.clinch - 0.5 && this.foe.alive;
    const want = (this.hitLanded || this.bound ? L.followUp : L.followUp * 0.4) + 0.2 * this.anger; // 화나면 더 이어 친다
    if (canChain && Math.random() < want) {
      // 지금 손 위치에서 바로 이어지는 기술 (다시 크게 들지 않는다)
      const hand = [this.me.handOffset.x, this.me.handOffset.y];
      let best = null;
      let bestW = -1;
      for (const t of this.school.tech) {
        if (t === this.tech) continue;
        const cd = padDist(hand, t.from);
        if (cd > 0.35) continue;
        const w = this.pers.techPref[t.name] * t.base * Math.exp(-cd / 0.2) * rand(0.6, 1.4);
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
    for (const t of this.school.tech) {
      if (t === this.tech || t.kind === 'thrust') continue;
      const cd = padDist(hand, t.from);
      const w = this.pers.techPref[t.name] * t.base * (t.presses ? 3 : 1) * Math.exp(-cd / (2 * SKILL.flowReach));
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
  flowInto(t, why, chain) {
    const hand = [this.me.handOffset.x, this.me.handOffset.y];
    if (!this.startAttack(t, why, { chain, noFeint: true, skipChamber: true })) return false;
    this.stats.flows = (this.stats.flows ?? 0) + 1;
    if (!this.startStrike()) return false;
    const mx = (hand[0] + t.from[0]) / 2;
    const from = opportunityPad(this, t.from);
    this.path.unshift([clamp(mx + Math.sign(mx || hand[0] || 1) * 0.12, -0.6, 0.6), (hand[1] + from[1]) / 2], from.slice());
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
  startWithdraw(time) {
    clearOpportunityRange(this);
    this.opportunityAttack = null;
    this.mode = 'withdraw';
    this.phase = 'ready';
    this.timer = time;
    this.path.length = 0;
    this.stepT = 0;
    // 물러나면서도 칼끝으로 겨눈다 (쟁기·긴 자세). 몰아치는 상대에겐 곧장 벨 수 있는 황소
    const W = this.school.withdraw;
    const name = this.foeAggro > 0.3 && Math.random() < this.foeAggro ? W.pressed : Math.random() < 0.5 ? W.calm[0] : W.calm[1];
    this.guard = this.school.guards.find((g) => g.name === name);
  }

  withdraw(dt, s, d, th) {
    const L = this.level;
    this.phase = 'ready';
    this.timer -= dt;
    if (th && this.respond(th, d)) return;
    if (this.seize(s, d, dt)) return;
    if (d < this.M.reach + 0.2) {
      // 아직 상대 칼이 닿는 거리: 상대가 칼을 든 쪽에서 올 베기를 가리며 물러난다 (준비 자세를 읽는다)
      const p = this.coverFor(s);
      this.hand.set(p[0], p[1]);
      this.handSpeed = L.parrySpeed * 0.7;
    } else {
      this.hand.set(this.guard.pad[0], this.guard.pad[1]);
      this.handSpeed = 1.4;
    }
    if ((this.timer <= 0 && d > this.M.reach) || d > this.holdDist() - 0.05 || this.timer < -1) {
      this.mode = 'watch';
      this.guardTimer = rand(0.3, 0.8);
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
    if (th.id === this.threatSeen) return false;
    this.threatSeen = th.id;
    if (Math.random() > L.guardChance) return false; // 못 봤거나 늦었다
    this.defLine = th.line;
    // 1) 같은 순간에 맞받아 베기 (Indes): 들어오는 칼을 내 칼로 밀어내며 그대로 벤다 (겁먹으면 엄두를 못 낸다)
    if (Math.random() < L.counter * (1 - 0.8 * this.fear) && d < this.M.reach + 0.3 && d > this.M.clinch + 0.1) {
      const t = this.counterTech(th);
      if (t && this.startAttack(t, 'counter', { noFeint: true, skipChamber: true })) {
        this.stats.counters++;
        return true;
      }
    }
    this.mode = 'defend';
    this.opportunityAttack = null;
    this.phase = 'guard';
    this.path.length = 0;
    this.stepT = 0;
    // 2) 간격 끝에서 오는 공격, 찌르기는 물러나 헛치게 한다 (피하기). 가까우면 칼로 막는다
    const edge = d > this.foeReach - 0.35;
    const pVoid = edge || th.thrust ? 0.8 : 0.3;
    // 칼이 없으면 막을 수 없으니 물러난다. 겁먹었을 때도 칼로 받기보다 물러나 피한다
    this.defVoid = !this.me.armed || Math.random() < pVoid + (1 - pVoid) * this.fear * 0.8;
    if (this.defVoid) this.stats.voids++;
    else this.stats.parries++;
    this.timer = 0.65;
    return true;
  }

  defend(dt, s, d) {
    const L = this.level;
    this.timer -= dt;
    if (this.timer < 0.4 && this.seize(s, d, dt)) return;
    const p = this.school.parry[this.defLine] || this.school.pose.point;
    this.hand.set(p[0], p[1]);
    this.handSpeed = this.defVoid ? L.parrySpeed * 0.6 : L.parrySpeed;
    this.checkBind();
    // 흐름(SKILL.flow): 칼로 받아 낸 순간(칼끼리 맞닿음) 받은 칼이 멈추지 않고 그대로 되받아 벤다
    if (SKILL.flow && SKILL.flowParry && !this.defVoid && this.flowRiposte(d)) return;
    // 공격이 지나갔다(칼끝이 더는 오지 않고 손이 멈췄다) → 상대가 다시 자세를 잡기 전에 되받아 친다 (Nach)
    const swingOver = this.noThreat > 0.12 && Math.hypot(s.hvx, s.hvy) < 2.5;
    if ((swingOver && this.timer < 0.35) || this.timer <= 0) {
      const riposte = d < this.M.reach + 0.25 && d > this.M.clinch + 0.1 && this.foe.alive && Math.random() < L.followUp;
      if (!(riposte && this.startAttack(this.pickTech(s, 'recover'), 'riposte', { noFeint: true }))) this.startWithdraw(0.6);
    }
  }

  /** 맞받아 베기에 쓸 기술: 들어오는 줄에 맞서 가운데를 차지하며 베는 기술 (지금 손에서 가까운 것) */
  counterTech(th) {
    const hand = [this.me.handOffset.x, this.me.handOffset.y];
    const C = this.school.counter;
    const names = C[th.line] || C.default;
    let best = null;
    let bestD = 1e9;
    for (const n of names) {
      const t = this.school.techByName[n];
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
    if (this.noThreat > 0.25) this.threatId++; // 잠깐 조용했다가 다시 오면 새 공격
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
      if (this.preOff > 0.3) this.preArmed = true;
      return false;
    }
    this.preOff = 0;
    if (!this.preArmed) return false;
    this.preArmed = false; // 한 번 몰아칠 때 한 번만 판단한다
    // 달려드는 것은 누구나 알아본다. 제자리에서 칼을 드는 낌새는 숙련될수록 잘 읽는다
    if (Math.random() > (charging ? Math.max(0.9, L.guardChance) : L.guardChance)) return false;
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

  // ───────────────────────── 손과 발 ─────────────────────────
  /** 손을 목표 쪽으로 제한 속도로 옮긴다 (AI가 순간적으로 칼을 옮기지 못하게) */
  moveHand(dt) {
    const off = this.me.handOffset;
    if (this.feintHold > 0) {
      this.feintHold -= dt;
      if (this.feintHold <= 0) this.stepT = this.stepTime(); // 이제 진짜로 내디디며 친다
      return;
    }
    const striking = this.mode === 'attack' && this.phase === 'strike' && this.path.length > 0;
    let tx = this.hand.x;
    let ty = this.hand.y;
    if (striking) {
      tx = this.path[0][0];
      ty = this.path[0][1];
      // 상대가 옆으로 비껴 있으면 그만큼 손을 옮겨 겨눈다
      const lateral = this.opportunityAttack?.started ? this.opportunityAttack.lateral : this.foeLat;
      tx = clamp(tx + clamp(lateral, -0.4, 0.4) * 0.5, -0.6, 0.6);
      // 옆 보정 뒤에도 실제 손의 이동 범위 안에 목표를 둔다. 바깥 목표는
      // 손이 경계에서 멈춰 path를 끝내지 못하고 strike에 머물 수 있다.
      const targetLength = Math.hypot(tx, ty);
      if (targetLength > 0.62) {
        tx *= 0.62 / targetLength;
        ty *= 0.62 / targetLength;
      }
    }
    const dx = tx - off.x;
    const dy = ty - off.y;
    const dd = Math.hypot(dx, dy);
    const step = this.handSpeed * dt;
    if (dd > step) {
      off.x += (dx / dd) * step;
      off.y += (dy / dd) * step;
    } else {
      off.set(tx, ty);
      if (striking) {
        this.path.shift();
        // 속임수의 가짜 부분이 끝났다 → 칼이 가짜 쪽으로 움직이는 것이 보이도록 잠깐 두었다가 진짜 길로 간다.
        //  너무 오래 멈추면 진짜 칼이 나가기까지 전체 시간이 늘어져 오히려 읽히기 쉽다. 숙련될수록 더 빨리 다시 챔버한다
        if (this.feintPts > 0 && --this.feintPts === 0) this.feintHold = clamp(0.16 - 0.08 * this.level.read, 0.06, 0.16);
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

  /** 발놀림: 간격 조절, 옆으로 돌기, 베며 내딛기, 물러나기 */
  moveFeet(dt, d) {
    const me = this.me;
    const L = this.level;
    let fwd = 0;
    let side = 0;
    const speed = BODY.moveSpeed;
    // 원하는 "다가가는 빠르기"(m/s, + = 다가감) → 조이스틱 값 (뒤로는 75% 빠르기)
    const toStick = (v) => (v >= 0 ? v / speed : v / (speed * 0.75));
    const rangeAttack = this.mode === 'attack' && opportunityRangeAttack(this);
    if (this.mode === 'attack') {
      if (rangeAttack) {
        // Settle too-close as well as too-far spacing before the thrust. Once
        // committed, do not undo that spacing with ordinary retreat/lunge.
        const range = this.opportunityAttack.started ? null : measureThrustDistance(me, this.opportunityAttack.target);
        fwd = me.state === 'stand' && range?.valid ? range.move : 0;
      } else if (this.phase === 'windup') {
        // 준비하는 동안 간격 끝까지 다가간다 (이미 가까우면 제자리).
        //  제자리일 때는 뒤로 살짝 당긴다: 칼을 빠르게 드는 것을 검술 층(skill.js)이 휘두르기로 보고
        //  저절로 앞으로 내딛지 않게 (AI는 발을 스스로 정한다)
        const want = this.chasing ? this.M.contact : this.M.reach + 0.2;
        fwd = d > want && this.foeClosing < 0.5 ? clamp((d - want) * 1.5, 0.25, this.chasing ? 1 : 0.8) : -0.21;
      } else if (this.phase === 'approach') {
        // 성큼성큼이 아니라 미끄러지듯 (빨리 달려들면 베는 동안 멈추지 못하고 상대 몸에 부딪친다).
        //  상대가 다가오고 있으면 제자리에서 기다린다 (뒤로 살짝 당겨 검술 층의 자동 내딛기도 막는다)
        const gap = this.contactDist() - (this.need ?? this.M.contact);
        fwd = this.foeClosing > 0.5 || gap <= 0 ? -0.21 : clamp(gap * 3, 0.25, 0.45);
        if (this.chasing) fwd = d > this.M.contact ? 1 : -0.21; // 도망치는 빈손 상대는 뛰어서 쫓는다
      } else {
        // 손이 먼저, 발이 뒤따른다. 이미 가까우면 내딛지 않는다 (몸이 부딪친다)
        let stepping = false;
        if (this.stepDelay > 0) this.stepDelay -= dt;
        else if (this.stepT > 0) {
          this.stepT -= dt;
          stepping = d > this.M.contact - 0.1;
        }
        if (stepping) {
          fwd = 1;
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
    } else if (this.mode === 'withdraw') {
      // 간격 밖까지 물러난다. 가까워질수록 천천히 (관성으로 너무 멀리 가지 않게)
      //  (-0.2보다 더 당겨야 검술 층이 손 움직임을 휘두르기로 보고 앞으로 내딛지 않는다)
      fwd = Math.min(-0.25, toStick(clamp((d - this.holdDist() - 0.05) * 3, -1.9, -0.3)));
    } else if (this.mode === 'defend') {
      fwd = this.defVoid ? -1 : -0.3; // 막을 때도 살짝 물러선다 (앞으로 쏠리지 않게)
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
          this.shuffleTimer = rand(0.5, 1.2);
          this.shuffle = Math.random() < 0.5 ? 0 : rand(-0.3 - 0.3 * this.fear, 0.18 * (1 - this.fear)); // 겁먹으면 잔걸음이 뒷걸음으로 기운다
        }
        v = this.shuffle;
      }
      fwd = toStick(v);
      // 옆으로 돌기 (가끔 방향을 바꾸고 가끔 멈춘다)
      this.circleTimer -= dt;
      if (this.circleTimer <= 0) {
        this.circleTimer = rand(0.8, 2.2);
        const x = Math.random();
        this.circle = x < 0.45 ? 0 : (x < 0.85 ? this.pers.circleDir : -this.pers.circleDir) * this.pers.circleRate;
      }
      if (d < hold + 0.6) side = this.circle;
    }
    // 너무 붙음 → 떨어진다 (밀쳐내기는 fighter.shove가 뒤로 물러날 때 자동으로)
    if (d < this.M.clinch && this.mode !== 'attack') {
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
      if (this.mode === 'watch') this.patience = Math.max(0, this.patience - dt * 0.15 * k); // 몰렸으면 먼저 친다
    }
    // 근접 밀치기: 닿는 거리 안에서 스틱만 (벽 처리 뒤라 side 를 ±k 로 바꾸지 못한다). 걸쇠가 꺼져 있으면 한 스텝 0 으로 장전,
    //  켜져 있으면 1 로 발사, 밀치는 동안 closeWant 면 1 유지(누르기). 휘두르는 중·베는 중(strike·follow, 팔이 묶임)은 미룬다
    const armsBusy = this.mode === 'attack' && (this.phase === 'strike' || this.phase === 'follow');
    if (!rangeAttack && CLOSE.on && this.closeInside && !me.skill.swinging && (me.barge || (this.closeWant && !armsBusy))) {
      fwd = me.barge ? (this.closeWant ? 1 : 0) : me.closeArmed ? 1 : 0; // 밀치는 중엔 closeWant 동안만 누른다 (풀리면 release)
      side = 0;
    }
    if (!this.foe.alive) fwd = side = 0;
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
    if (g.requestStep({ kind: this.tech?.kind === 'thrust' ? 'lunge' : 'pass', fwd: 0.6, hold: 0.3 })) this.requestedStep = true;
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

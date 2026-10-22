import {WANDER_EXCLUSIVE} from './wander_rules.js';
import {createReturnedKing} from './character_returned_king.js';
import {createWhiteScaleWarrior} from './character_white_scale.js';
import {createRoyalConceptGuests} from './character_royal_concepts.js';
import { alterLook } from './outfit_alter.js';
// ─────────────────────────────────────────────────────────────
//  상대 캐릭터 12인(다섯 + 샛별 저장소에서 가져온 셋 6~8 · 넷 9~12): 저마다 다른 유파·성격·자세 전환 습관을 가진 검객들.
//
//  ai.persona가 ai.js의 AI 클래스에 그대로 전달된다:
//   - ai.proficiency: 숙련도 (사장님 결정 10/13 — 자기 유파 = 시트 값, 다른 유파 = 0). 실력 숫자 이름 ai.level 과 persona.proficiency 는 finishAI 가 채운다
//   - level: AI_LEVELS(실력 숫자 — 숙련도가 고른 이름) 위에 캐릭터별로 덮어쓰는 값 (막기 확률·읽는 눈·힘 등 — 반응 시간 reaction 은 10/21 부터 숙련도 표 AI_PROFICIENCY.reaction 이 이김: 여기 적힌 reaction 은 쓰지 않음)
//   - pers:  성격(자세 취향·간격·박자·속임수) 위에 덮어쓰는 값. guardStick이 이번에 새로 생긴 핵심 손잡이:
//            크면(예: 6) 가까운 자세만 고집하는 신중한 검객, 작으면(예: 0.6) 먼 자세로도 서슴없이
//            건너뛰는 변덕스러운 검객이 된다. guardPref는 자세 이름별 선호도를 부분적으로 못박아 둔다.
//
//  weapon: 무기 목록(다른 담당이 작업 중)의 id만 적어 둔다. 실제 무기 모델·능력치는 여기서 정하지 않는다.
//  look: looks.js의 LOOKS 항목이 지원하는 값만 쓴다 (옷·가죽끈·투구·머리카락 색 등). 몸매·나이 같은
//        생김새는 글로 묘사만 하고(문서 참고), fighter.js의 몸 크기 자체는 아직 캐릭터마다 다르게 만들 수 없다.
// ─────────────────────────────────────────────────────────────

import { WEAPONS, WEAPON_LIST } from './weapons.js';
import { getLook, CHARACTER_LOOK_VERSION } from './looks.js';
import { AI_LEVELS, AI_PROFICIENCY } from './config.js'; // 변형의 실력 숫자를 원본 실효값에서 계산 · 숙련도 → 실력 숫자 이름 (config.js는 아무것도 import하지 않아 순환이 없다)
import { traditionOf } from './schools.js'; // 인물의 유파 = 시트 무기의 유파 (숙련도 표 열쇠 — 10/13)

export const CHARACTERS = [
  // ───────────────────────────────────────────── 1. 쉬움 : 촌뜨기 난동꾼 ─────────────────────────────────────────────
  {
    id: 'bran',
    name: '브론 오소리', // 10/11 이름 순서 변경(당시 브란), 10/16 원본·얼터 모두 브론으로 개명. ID/음성은 bran 유지.
    epithet: '가장', // 사장님 10/11 01:1x (전 '나무꾼')
    age: 34,
    origin: '검은숲 변두리 화전민 마을',
    backstory:
      '장작 패는 도끼질 말고는 배운 게 없다. 술집에서 시비가 붙을 때마다 몽둥이(사실은 잘 마른 참나무 가지)를 ' +
      '휘둘러 이겼다는 소문이 마을 밖까지 퍼졌고, 어느 날 흥행사가 찾아와 "진짜 검객"과 싸우면 은화를 준다고 꼬드겼다.',
    want: '은화. 그리고 이번엔 아무도 자기를 "그냥 힘센 촌놈"이라 부르지 못하게 만들고 싶다.',
    school: '유파 없음(자기 흐름). 정식으로 검을 배운 적이 없어 리히테나워식 자세 이름도 모른다. ' +
      '큰 동작으로 내리찍거나 옆으로 후려치는 것만 반복하지만, 타고난 힘과 대담함으로 어설프게나마 맞아떨어질 때가 있다.',
    signatureMoves: '머리 위로 크게 들어 올렸다가 내리찍는 정수리 베기, 옆에서 크게 감아 치는 가로베기. 준비 동작이 매우 크고 느려서 훈련된 눈에는 다 보인다.',
    favoriteGuards: '지붕(막 들어 올린 자세)과 바보(칼끝을 아예 땅에 늘어뜨린 자세) 사이를 정신없이 오간다. "자세"라는 개념이 없어 아무 자세로나 불쑥 넘어간다.',
    temperament:
      '단순하고 다혈질. 이기고 있으면 더 크게 휘두르며 웃어젖히고, 맞아서 피가 나면 당황해 마구잡이로 달려든다(참을성이 매우 빨리 바닥난다). ' +
      '진짜로 위험해지면(많이 다치면) 그제서야 주춤주춤 물러난다.',
    movementNotes:
      '간격 개념이 없어 상대에게 바짝 붙어 서고, 자세도 박자 없이 아무 때나(약 1.6초마다) 바꾼다 — 가까운 자세 고집이 거의 없어(guardStick 낮음) ' +
      '지붕에서 곧장 바보 자세로 건너뛰는 식의 "먼 자세 점프"가 잦다. 속임수는 쓸 줄 모른다(feint 0). 달려드는 것을 두려워하지 않는다(vor 높음).',
    weaknesses: '준비 동작이 크고 느려 낌새를 미리 읽기 쉽다. 막기 판단이 늦고 부정확하며, 자세 전환이 무작위라 다음 수를 읽긴 어렵지만 정작 방어는 허술하다. 속임수에 매우 잘 속는다.',
    weapon: 'tree_branch', // 쓰레기 등급: 날이 없어 찌르기 불가, 세게 부딪히면 부러진다
    // 감독 지시: 10% 확률로 커먼 등급 중 가장 짧은 칼을 들고 나온다 (어디서 주워 온 진짜 칼). 그때는 유파도 그 칼의 꾸러미를 쓴다
    weaponAlt: { chance: 0.1, pick: 'shortest_common' },
    ai: {
      proficiency: 1, // 숙련도 (사장님 결정 10/13) — 실력 숫자 이름 ai.level · persona.proficiency 는 아래 finishAI 가 채운다
      persona: {
        school: 'tree_branch',
        startEmotion: { anger: 0.7 }, // 사장 지시: 서사대로 '분노' 상태로 결투를 시작한다 (은화 걸고 막대기 하나 들고 선 촌놈의 발끈)
        level: { reaction: 0.42, guardChance: 0.22, counter: 0, feint: 0, followUp: 0.12, read: 0.2, discipline: 0.35, strength: 1.3, aggression: 0.9, windup: 1.6, chamberSpeed: 1.8, strikeSpeed: 7, skill: 0.28 }, // 힘은 장사 — 가벼운 나뭇가지라도 머리를 때리면 기절시킨다. 대신 정확도가 낮다
        pers: {
          precision: 0.4, // 아무 데나 후려친다 — 팔·다리에 걸리고 칼 면으로 때린다
          guardStick: 0.6,
          fearful: 0.45, // 베이면 당황한다 — 많이 다치면 주춤주춤 물러나는 성격
          angry: 0.7, // 막히면 발끈한다
          dogged: 0.3,
          guardSpeed: 1.6,
          rhythm: 1.6,
          margin: 0.22,
          aggr: 0.95,
          vor: 0.55,
          patienceTime: 8,
          circleRate: 0.1,
          guardPref: { tag: 1.6, tagR: 1.7, alber: 1.5, wechselR: 1.3 },
          // 크게 감아 치는 가로베기·올려베기를 좋아한다 (힘이 안 실리는 기술). 찌르기는 나뭇가지로는 못 한다
          techPref: { zwerch: 1.6, zwerchL: 1.4, unterhau: 1.3, oberhau: 1.2, zornhau: 0.8, stichPflug: 0.1, stichPflugL: 0.1, stichOchs: 0.1, stichOchsL: 0.1, stichAlber: 0.1 },
        },
        // 온몸 타격 기질 (persona.whole, 초안 — 게임은 아직 읽지 않는다. 디렉터가 R5에서 ai.js planStrike/opportunity에 연결)
        //  sPref/sSpread: 결심 베기에 몸을 싣는 정도 S(0~1)의 중심과 폭 / windRate: 베기 중 감기를 눈에 띄게 하는 비율
        //  windLen: 감기 길이 초 [짧게, 길게] (사장님 결정: 난이도별 최소 감기 제한은 두지 않는다 — 이 값이 곧 감기 길이)
        //  punish: 상대의 틈(windup 감기 / overrun 지나가기 / thrown 튕김)에 뛰어드는 확률 / evade: 큰 베기를 볼 때 비켜서기(1) 대 막기(0)
        //  근거·범위는 docs/character_whole_body.md
        // idle (값만, 9/30): 시작 정지(ARENA.startHold) 동안 서 있는 모습 — guard 자세 이름, gesture 몸짓(stomp·settle·lowTip·pointFace·still). 발은 절대 안 움직인다
        // close (값만, 9/30): 근접 밀치기 — rate 붙었을 때 고를 확률, kind 'barge' 몸통 부딪기 | 'kick' 발차기, then 'cut' 곧바로 벰 | 'none'. 동작이 생긴 뒤 연결
        whole: { sPref: 0.9, sSpread: 0.1, windRate: 0.85, windLen: [0.45, 0.9], punish: { windup: 0.1, overrun: 0.35, thrown: 0.15 }, evade: 0.15 }, // 다 싣는다. 감기가 크고 길어 다 보인다. 틈은 못 읽고, 큰 베기는 막지도 피하지도 않고 맞바꾼다
        idle: { guard: 'tagR', gesture: 'stomp' }, // 시작 2초: 칼을 어깨에 걸치고 발을 구른다 (발은 제자리, 몸짓만)
        close: { rate: 0.8, kind: 'barge', then: 'none' }, // 근접 밀치기: 가장 자주, 떼어 내기보다 넘어뜨리려고. 뒤에 베기 없음
      },
    },
    look: getLook('bran'),
    lookVersion: CHARACTER_LOOK_VERSION.bran,
    taunt: '젠장! 이런 막대기뿐이라니.',
    // 상황별 대사 (docs/character_lore.md). 화면에 어떻게 띄울지는 UI 설계 몫
    lines: {
      // 10/10 19:4x 사장님 '브란 대사 바꿔' — 작가 제안 3 줄 + 디렉터가 되풀이·칭얼거림을 걷어 냄(나무꾼·은화·막대기·성마름은 살림)
      intro: ['젠장! 이런 막대기뿐이라니.', '은화 열 닢. 약속은 지켜라.', '자세? 힘이 최고야.'], // '자세? 힘이 최고야.' 사장님 19:5x '이게 나아'
      introStray: ['오늘은 운이 좋군.'], // 칼을 주워 든 판의 시작 대사 — 사장님 10/10 20:3x '오늘은 운이 좋군. 이거 칼 들었을 때의 대사' // 칼을 주워 든 판(weaponAlt 10 %) — 막대기 대사를 뺀 시작 대사 (main.js showFoeIntro)
      attack: ['받아라!', '이거나 먹어라.', '장작 패듯이.'],
      hurt: ['윽… 이거 진짜 칼이잖아!', '…피가 나는군.', '숨 좀 돌리자.'],
      winning: ['봤냐. 나무꾼 팔이다.', '검객이라더니, 그게 다냐.'],
      losing: ['…은화는 됐다.', '오지 마라.', '…이럴 줄 몰랐어.'],
      win: ['은화는 어디 있지.', '…내가 이겼나? 내가 이겼다!', '장작 패기보다 쉽구나, 널 패는 게.'], // 10/10 19:5x 사장님 '…내가 이겼나? 내가 이겼다!' 되살림 ('오늘은 운이 좋군.'은 칼 든 판 시작 대사로 — 20:3x)
      lose: ['…장작이나 팰걸.', '회초리… 부러졌나…'],
    },
  },

  // ───────────────────────────────────────────── 2. 쉬움~보통 : 성실한 신입 검사 ─────────────────────────────────────────────
  {
    id: 'isolde',
    name: '이졸데 반 아커러',
    epithet: '브루게의 견습생',
    age: 21,
    origin: '브루게 검술 길드',
    backstory:
      '길드에서 가장 어린 정식 단원. 피오레 데이 리베리 계보를 잇는다는 늙은 사범 밑에서 3년째 매일 자세 교정을 받고 있다. ' +
      '사범은 아직 "실전에 내보내기엔 이르다"고 하지만, 몰래 이 경기장에 이름을 올렸다.',
    want: '사범에게 인정받는 것. 그리고 "여자는 체력이 부족해 검을 오래 못 쓴다"는 선배들의 말이 틀렸음을 보여주는 것.',
    school: '피오레 데이 리베리(이탈리아식)의 기본기를 독일식 자세 이름으로 옮겨 배웠다. 교본을 그대로 따르는 정직한 검술 — 창의적이진 않지만 빈틈이 없다.',
    signatureMoves: '쟁기·긴 자세를 오가며 칼끝으로 거리와 각도를 재는 정석적인 응대. 상대가 헛치면 정직하게 받아친다(Nach)기보다 일단 한 번 더 확인하고 들어가는 조심스러운 스타일.',
    favoriteGuards: '쟁기(오른쪽)와 긴 자세를 거의 벗어나지 않는다. 교본에 없는 자세(바꿈·옆 지킴)는 거의 쓰지 않는다.',
    temperament:
      '침착하고 신중하다. 맞아도 동요하지 않고 배운 대로 물러나 다시 거리를 잰다(패닉하지 않음). 다만 상대가 교본에 없는 방식으로 나오면 판단이 한 박자 늦다. ' +
      '이기고 있어도 서두르지 않는다 — 사범의 가르침("승부를 서두르는 자가 먼저 베인다") 때문에 오히려 과할 만큼 참는다.',
    movementNotes:
      '자세를 거의 안 바꾼다(guardStick 매우 높음, 박자도 5초쯤으로 느긋함) — 늘 같은 두세 자세 사이만 오가는 예측 가능한 검객. ' +
      '간격을 넉넉히 두고(margin 큼) 먼저 잘 붙지 않는다. 속임수는 거의 배우지 않았다(feint 거의 0).',
    weaknesses: '패턴이 매우 일정해 몇 합만 겪으면 다음 자세를 짐작할 수 있다. 달려드는 상대를 맞받아치기보다 무조건 물러나려 해서(vor 낮음), 집요하게 몰아붙이면 구석으로 밀린다. 이어 치기가 약하다(followUp 낮음) — 한 번 맞히면 그걸로 끝인 경우가 많다.',
    weapon: 'longsword',
    ai: {
      proficiency: 1, // 숙련도 (사장님 결정 10/13) — 실력 숫자 이름 ai.level · persona.proficiency 는 아래 finishAI 가 채운다
      persona: {
        school: 'longsword',
        level: { reaction: 0.31, guardChance: 0.6, counter: 0.12, feint: 0.05, followUp: 0.28, read: 0.62, discipline: 0.95, strength: 0.85, aggression: 0.68, windup: 0.82, skill: 0.56 },
        pers: {
          precision: 0.7, // 교본대로 정확하지만 힘이 실리지 않는다
          guardStick: 4.2,
          fearful: 0.35, // 침착하지만 실전 경험이 없다 — 베이면 교본대로 물러나 거리를 다시 잰다 (감독 지시: 0.3 → 0.35, 설정상 랴오보다 세면 안 된다)
          angry: 0.2,
          dogged: 0.25, // 감독 지시: 0.2 → 0.3은 너무 잦아(판당 38%) 중간 0.25로
          guardSpeed: 0.58,
          rhythm: 5.2,
          margin: 0.4,
          aggr: 0.78,
          vor: 0.36,
          patienceTime: 10,
          circleRate: 0.2,
          guardPref: { pflugR: 1.6, langort: 1.55, ochsR: 1.2, alber: 0.3, nebenR: 0.3 },
        },
        whole: { sPref: 0.35, sSpread: 0.15, windRate: 0.45, windLen: [0.3, 0.5], punish: { windup: 0.3, overrun: 0.5, thrown: 0.35 }, evade: 0.55 }, // 교본대로 중간 크기. 배운 대로 비켜서고, 지나간 상대는 벌한다. 집념이 켜져도 S가 아니라 정확도로 간다
        idle: { guard: 'pflugR', gesture: 'settle' }, // 시작 2초: 배운 자세를 천천히 고쳐 잡는다
        close: { rate: 0.35, kind: 'barge', then: 'cut' }, // 피오레 근접술: 막힌 뒤 밀어서 떼고 곧바로 벤다
      },
    },
    // 부활 (오너 결정 2026-09-28: "이졸데는 좀 약한 대신 부활하게 하려고. 투지를 보여서 한 번 더 싸우는 거지.")
    //  처음 죽으면 쓰러졌다가 하늘에서 내린 빛 속에서 한 번 다시 일어선다. 두 번째 죽음이 진짜 끝. 규칙·시간은 src/revive.js,
    //  연출은 src/revive_fx.js, 문서는 docs/characters.md "부활". 되찾는 몸: 피 0.7(여전히 다친 몸) · 칼 든 팔 0.6 · 다리 0.7,
    //  다시 싸울 때 집념 0.8 (10초 동안 다른 감정이 밀어내지 못함). 일어설 때의 대사는 lines.revive (캐릭터 PM 몫, 비어 있으면 알림만)
    revive: { count: 1, blood: 0.7, limbs: { armS: 0.6, armO: 0.4, legF: 0.7, legB: 0.7 }, obsession: 0.8, obsessionHold: 10 },
    look: getLook('isolde'),
    lookVersion: CHARACTER_LOOK_VERSION.isolde,
    taunt: '사범님… 보고 계신가요. 정확하게 갈게요.',
    lines: {
      intro: ['사범님… 보고 계신가요. 정확하게 갈게요.', '브루게 검술 길드, 이졸데 반 아커러입니다.', '잘 부탁드립니다. …정말로요.'],
      attack: ['하압!', '여기!', '지금—'],
      hurt: ['…거리를 잘못 쟀어.', '괜찮아. 배운 대로.', '한 번 더.'],
      winning: ['서두르지 말자. 서두르지 말자.', '…보고 계셨으면.'],
      losing: ['물러나… 물러나서 다시.', '교본엔 이런 게 없었는데.', '선배들 말이… 아니야, 아직.'],
      win: ['…감사합니다.', '사범님, 이제 이르지 않죠?', '교본대로였어요. 그것뿐이에요.'],
      lose: ['아직… 이르네요.', '다음엔 정확하게.'],
      revive: ['한 번만 더. 정확하게.'], // 처음 쓰러졌다 투지로 다시 일어설 때 (사장 확정 1종. 부활 구현·revive 필드는 디렉터)
    },
  },

  // ───────────────────────────────────────────── 3. 보통 : 떠돌이 이류검객 ─────────────────────────────────────────────
  {
    id: 'liao',
    name: '랴오 쓰위엔',
    epithet: '떠도는 검',
    age: 40,
    origin: '동방에서 흘러온 방랑 검객',
    backstory:
      '고향의 문파에서 파문당했다는 소문도, 스스로 뛰쳐나왔다는 소문도 있다. 본인은 아무 말도 하지 않는다. ' +
      '수년째 이 나라 저 나라를 떠돌며 현상금이 걸린 결투장에 나타났다 사라지길 반복한다. 검(도·검) 다루는 법이 이 지역 유파와는 확연히 다르다.',
    want: '다음 여비. 그 이상도 이하도 아닌 척하지만, 사실 자신의 검이 "이 서양식 철검"에도 통하는지 시험해 보고 싶어한다.',
    school: '동방 도검술(도·검)을 독학으로 서양 롱소드에 옮겨 쓴다. 정해진 자세 순서를 따르지 않고 몸이 기억하는 대로 움직여, 리히테나워식 눈으로 보면 "격식이 없다".',
    signatureMoves: '가짜 동작으로 유인한 뒤 손목만 틀어 반대쪽을 치는 잔기술이 특기. 한 번 맞부딪히면 곧장 두세 번을 이어 붙인다.',
    favoriteGuards: '정해진 애용 자세가 없다 — 낮은 자세(바꿈·옆 지킴처럼 칼을 숨기는 자세)와 높은 자세를 가리지 않고 넘나든다.',
    temperament:
      '심드렁하고 여유롭다. 맞아도 표정 하나 안 바꾸고, 이기고 있어도 딱히 서두르지 않는다 — 다만 상대가 자신의 잔기술에 두 번 연달아 당하면 그제야 흥미를 보이며 몰아붙인다.',
    movementNotes:
      '자세를 아주 자주(1.5~2초마다), 그것도 먼 자세로 거리낌 없이 건너뛴다(guardStick 낮음) — 다음 자세를 종잡을 수 없는 것이 이 사람의 정체성이다. ' +
      '속임수를 즐겨 쓰고(feint 높음), 맞히거나 막히면 반드시 이어 붙인다(followUp 높음).',
    weaknesses: '정석 간격 관리를 안 배워 규율(discipline)이 낮다 — 덤벼들 때 살짝 과하게 들어오는 버릇이 있어, 그 순간을 미리 알고 맞받아치면(Vor) 잡을 수 있다. 힘 자체는 평범해 묵직한 반격 한 방에 균형이 잘 무너진다.',
    weapon: 'qinggang', // 청강검 (에픽 등급): 물리는 지안, 이름값대로 잘 벤다. 진품이냐 물으면 대답하지 않는다
    ai: {
      proficiency: 3, // 숙련도 (사장님 결정 10/13) — 실력 숫자 이름 ai.level · persona.proficiency 는 아래 finishAI 가 채운다
      persona: {
        school: 'qinggang',
        level: { reaction: 0.25, guardChance: 0.55, counter: 0.15, feint: 0.36, followUp: 0.62, read: 0.6, discipline: 0.55, strength: 1.1, aggression: 1.05, windup: 0.5, strikeSpeed: 13, skill: 0.75 },
        pers: {
          precision: 0.85, // 가벼운 검이라 정확해야 통한다
          guardStick: 0.9,
          fearful: 0.15, // 맞아도 표정 하나 안 바꾼다
          angry: 0.3,
          dogged: 0.5,
          guardSpeed: 1.3,
          rhythm: 1.8,
          margin: 0.28,
          aggr: 1.1,
          vor: 0.5,
          patienceTime: 8,
          circleRate: 0.3,
          guardPref: { wechselR: 1.6, wechselL: 1.5, nebenR: 1.4, alber: 1.3, ochsL: 1.2 },
          // 검(劍)의 장기는 찌르기: 얼굴·가슴을 찌르는 기술을 즐겨 쓴다
          techPref: { stichPflug: 1.6, stichOchs: 1.5, stichAlber: 1.4, stichPflugL: 1.3, stichOchsL: 1.2, zornhau: 1.0 },
        },
        whole: { sPref: 0.3, sSpread: 0.3, windRate: 0.3, windLen: [0.2, 0.45], punish: { windup: 0.6, overrun: 0.55, thrown: 0.5 }, evade: 0.75 }, // 대개 작고 빠른 찌르기, 가끔 느닷없이 크게. 감기를 보면 먼저 찌른다. 가벼운 칼이라 큰 베기는 막지 않고 비켜선다
        idle: { guard: 'alber', gesture: 'lowTip' }, // 시작 2초: 칼끝을 내린 채 가만히
        close: { rate: 0.25, kind: 'kick', then: 'cut' }, // 발차기로 떼어 찌르기 거리를 만든다. 빠르고 드물게
      },
    },
    look: getLook('liao'),
    lookVersion: CHARACTER_LOOK_VERSION.liao,
    taunt: '검이 다 똑같지, 뭘 그리 재나.',
    lines: {
      intro: ['검이 다 똑같지, 뭘 그리 재나.', '여비만 벌면 간다.', '…시작하지.'],
      attack: ['—핫.', '거기.', '느려.'],
      hurt: ['…음.', '괜찮은 칼이군.', '한 번은 봐준다.'],
      winning: ['두 번 걸렸어. 이제 재미있어졌네.', '서두르지 마. 나도 안 서두르니까.'],
      losing: ['…이 철검, 생각보다 무겁군.', '거리. 거리를 다시.', '오늘은 여기까지인가.'],
      win: ['…검이 다 똑같지.', '여비는 됐다. 다음 마을.', '…참 잘 드는군.'],
      lose: ['…통하긴 하는군. 반쯤.', '다음엔 더 가는 검을 가져오지.'],
    },
  },

  // ───────────────────────────────────────────── 4. 보통~어려움 : 왕의 검을 믿는 위험한 광인 ─────────────────────────────────────────────
  {
    id: 'heinrich',
    name: '하인리히 도른',
    epithet: '미치광이',
    age: 46, // 중년 (사장 정정: 29세는 틀림)
    origin: '마이어 검술관의 옛 사범. 학관에서 쫓겨난 뒤 "왕의 검"을 들고 결투장을 떠돈다',
    backstory:
      '요아힘 마이어의 검술관에서 스무 해 가까이 사범으로 검을 가르쳤다. 훈련 중에 제자 하나를 베어 죽이고도 칼을 멈추지 않아 학관에서 쫓겨났다. ' +
      '그 무렵 강 하구에서 건져 올렸다는 "엑스칼리버" 소문이 돌자 장터 대장장이 우테에게 똑같은 칼을 만들게 했고 — 그 뒤로 그는 그것이 복제품이라는 사실을 믿지 않는다. ' +
      '지금 그에게 그 칼은 진짜 왕의 검이고, 자신은 그 검이 고른 사람이다. 결투장에 서는 이유는 돈도 박수도 아니다. 왕의 검 앞에 무릎 꿇지 않는 자를 베기 위해서다.',
    want: '왕의 검이 진짜임을 세상이 인정하는 것. 인정하지 않는 자는 벤다 — 그게 그의 논리 전부다.',
    school: '마이어식 롱소드 — 크고 리듬감 있는 자세 전환 자체가 하나의 기술이다. 큰 동작으로 상대의 눈을 자세에 묶어 두고 그 틈에 진짜 공격을 꽂는다. 예전엔 가르치던 기술이고, 지금은 사람을 죽이는 기술이다.',
    signatureMoves: '속임수를 겹겹이 쌓는 연속 페인트, 상대가 달려들면 물러나지 않고 마주 걸어 들어가며 맞받아치는 강단 있는 카운터.',
    favoriteGuards: '지붕·어깨 지붕·옆 자세 같은 크고 무거운 자세. 자세를 자주 바꾸는 건 과시가 아니라 상대를 흔들어 놓기 위해서다.',
    temperament:
      '조용히 확신에 차 있고, 상대를 사람으로 보지 않는다("버러지"). 이기고 있으면 더 깊이 들어가 확실히 끝내려 하다가 빈틈을 보이기도 한다. ' +
      '맞으면 웃는다 — 왕의 검을 든 자가 흘리는 피가 아니라고 믿기 때문이다. 물러나지 않는다.',
    movementNotes:
      '자세를 매우 자주(1.3초 안팎) 바꾸고, 먼 자세로도 서슴없이 건너뛴다(guardStick 낮음) — 그런데 브론이나 랴오와 달리 이건 계산된 눈속임이다(feint·followUp이 모두 높다). ' +
      '간격을 바짝 좁혀 상대를 압박하고(margin 작음), 달려드는 상대를 물러나지 않고 맞받는다(vor 높음).',
    weaknesses: '인내심이 짧아(patienceTime 짧음) 판이 길어지면 먼저 무리하게 들어온다. 확신이 너무 강해 같은 유인책(가짜 공격)에 두 번 걸리면 오히려 더 큰 동작으로 반응해 큰 빈틈을 남긴다.',
    // 진짜 엑스칼리버는 이 세계에 있고 플레이어 몫이다. AI 하인리히에겐 겉모습만 같은 복제품(제원 = 롱소드)을
    //  준다 — 밸런스 때문. 로스터에 'excalibur_replica'(외형 excalibur, 제원 longsword)를 부탁해 둔다
    //  (10/10: 샛별 저장소에서 가져온 아르토리아도 진품을 든다 — 그쪽 설정 '진품은 플레이어와 아르토리아', 하인리히는 복제품 그대로)
    weapon: 'excalibur_replica',
    ai: {
      proficiency: 2, // 숙련도 (사장님 결정 10/13) — 실력 숫자 이름 ai.level · persona.proficiency 는 아래 finishAI 가 채운다
      persona: {
        school: 'excalibur_replica',
        level: { reaction: 0.21, guardChance: 0.66, counter: 0.32, feint: 0.46, followUp: 0.72, read: 0.72, discipline: 0.75, strength: 1.15, aggression: 1.15, windup: 0.45, strikeSpeed: 13, skill: 0.82 },
        pers: {
          precision: 0.9,
          guardStick: 0.8,
          fearful: 0.08, // 아프면 오히려 웃으며 더 달려든다
          angry: 0.6,
          dogged: 0.7, // 주 감정: 피 냄새를 맡으면 물고 늘어진다
          guardSpeed: 1.7,
          rhythm: 1.3,
          margin: 0.2,
          aggr: 1.3,
          vor: 0.72,
          patienceTime: 6,
          circleRate: 0.35,
          guardPref: { tag: 1.6, tagR: 1.6, sideR: 1.5, sideL: 1.4, ochsR: 1.2 },
          // 크고 무거운 베기(분노의 베기·정수리 베기)로 확실히 끝내려 한다 — 마이어식 큰 동작
          techPref: { zornhau: 1.5, zornhauL: 1.4, oberhau: 1.3, zwerch: 1.2, unterhau: 0.7, unterhauL: 0.7 },
        },
        whole: { sPref: 0.75, sSpread: 0.2, windRate: 0.7, windLen: [0.3, 0.6], punish: { windup: 0.45, overrun: 0.6, thrown: 0.55 }, evade: 0.3 }, // 마이어식 큰 감기, 다만 계산된 것 — 감기를 들고 있다 거두는 속임수. 물러나지 않고 마주 걸어 들어가 되받는다
        idle: { guard: 'tag', gesture: 'pointFace' }, // 시작 2초: 칼끝을 상대 얼굴에 한 번 겨눈 뒤 지붕 자세로 (설정집 버릇)
        close: { rate: 0.6, kind: 'barge', then: 'pommel' }, // 물러나지 않고 몸으로 밀고 들어가 칼자루로 누른다 → 밀고 나서 손잡이로 찍는다(skill.pommel 시제품 — 사장님 10/9 12:xx '우선 다 켜봐'; 전엔 'cut', 폼멜은 얼굴에 2~3 J 라 넘어뜨리는 것은 돌리는 칼 면)
      },
    },
    look: getLook('heinrich'),
    lookVersion: CHARACTER_LOOK_VERSION.heinrich,
    taunt: '무릎 꿇어라. 왕의 검 앞이다.', // 안하무인의 광인
    // 10/10 19:4x 사장님 '하인리히도 너무 유치해 바꿔' — 디렉터 다시 씀: 고함·웃음·되풀이 대신 차갑고 과장된 확신(복제품을 왕의 검이라 믿는 광인), 느낌표 없음.
    //  죽을 때 '검이… 가볍다'로 처음 복제품을 느낀다(설정 §: 우테의 복제품). 광기의 하인리히(heinrich_mad) 대사는 그대로
    lines: {
      intro: ['무릎 꿇어라. 왕의 검 앞이다.', '이 검이 너를 골랐다. 영광으로 알아라.', '이름 따위 필요 없다. 넌 곧 잊힌다.'],
      attack: ['엎드려라.', '왕 앞에서 고개를 드는가.', '어디로 가느냐.'],
      hurt: ['…감히.', '이 피는 내 것이 아니다.', '흠집 하나로 왕이 쓰러지나.'],
      winning: ['보아라. 이것이 왕의 검이다.', '기어 와라. 왕은 기다려 준다.'],
      losing: ['…검이 나를 버릴 리 없다.', '가짜라 한 놈은 모두 묻었다.', '아직이다. 나는 아직 서 있다.'],
      win: ['검이 아깝구나.', '이제야 꿇는군.', '이름 없는 자는 이름 없이 묻힌다.'], // 10/10 19:5x 사장님 손질 ('검이 아깝구나.' · '이제야 꿇는군.')
      lose: ['…'], // 10/10 19:5x 사장님: 죽을 때 대사 없이 말줄임표 — 침묵만
    },
  },

  // ───────────────────────────────────────────── 5. 어려움 : 진짜 고수 ─────────────────────────────────────────────
  {
    id: 'margarethe',
    name: '마르그레테 슈바르츠',
    epithet: '침묵의 벽',
    age: 58,
    origin: '리히테나워 계보를 40년째 가르치는 노장',
    backstory:
      '이름이 알려진 검술 사범들 중 실제로 결투장에 서는 몇 안 되는 사람. 젊을 때 남편을 결투로 잃은 뒤 검술관을 열어 40년째 제자를 길러 왔다. ' +
      '가끔 "가르치는 것과 베는 것은 다른 근육"이라며 직접 검을 들고 낯선 상대와 겨룬다 — 이번이 그런 날이다.',
    want: '가르침이 아직 녹슬지 않았음을 스스로 확인하는 것. 이기고 지는 것보다 "한 순간도 서두르지 않고 이겼는가"가 그에게는 더 중요하다.',
    school: '요하네스 리히테나워 전통의 정수. 자세를 거의 바꾸지 않고 한 자리를 지키다가, 상대가 스스로 무너뜨린 빈틈 딱 한 번만 정확히 친다.',
    signatureMoves: '들어오는 칼을 그대로 맞받아 베어 버리는 인데스(Indes), 한 번 맞부딪히면 반드시 되받아 치는 나흐(Nach). 헛손질이 거의 없다.',
    favoriteGuards: '황소(오른쪽)와 쟁기(왼쪽)에서 거의 움직이지 않는다 — 두 자세만으로도 위·아래 모든 빈틈을 겨눌 수 있다는 것을 안다.',
    temperament:
      '한없이 차분하다. 맞아도 흔들리지 않고(패닉 없음), 이기고 있어도 전혀 서두르지 않는다 — 오히려 상대가 조급해질 때까지 몇 초고 기다린다. ' +
      '그 침묵과 미동 없음 자체가 상대를 조급하게 만드는 무기다.',
    movementNotes:
      '자세를 거의 바꾸지 않고(guardStick 매우 높음, 박자 6초) 손도 느긋하게 움직인다 — 그런데 위협도(threat)가 가장 높은 자세만 골라 지키므로 얕보고 들어오면 바로 베인다. ' +
      '무리해서 먼저 뛰어들지 않고(vor 낮은 편) 상대의 실수를 기다리는 정통 나흐(Nach) 검객.',
    weaknesses: '스스로 먼저 판을 깨지 않는다 — 상대가 절대 먼저 들어오지 않고 완벽하게 간격만 지키면 좀처럼 기회를 만들지 못한다(물론 그러면 판이 길어진다). 화려한 잔기술은 거의 안 쓴다(feint 낮음). 쉬지 않고 밀어붙이는 저돌형 앞에서는 "물러나 되받기" 성격이 맞받기로 덮어씌워져 서로 베이기 쉽다.',
    weapon: 'longsword',
    ai: {
      proficiency: 3, // 숙련도 (사장님 결정 10/13) — 실력 숫자 이름 ai.level · persona.proficiency 는 아래 finishAI 가 채운다
      persona: {
        school: 'longsword',
        level: { reaction: 0.11, guardChance: 0.96, counter: 0.68, feint: 0.1, followUp: 0.88, read: 0.98, discipline: 1.05, strength: 1.1, aggression: 1.0, windup: 0.28, strikeSpeed: 14, skill: 0.97 },
        pers: {
          precision: 1, // 머리·목을 정확히 벤다
          guardStick: 6.2,
          fearful: 0, // 공포 면역 (사장 확정): 문턱값 0이라 베여도·무기가 부러져도·진품 엑스칼리버 앞에서도 공포가 1도 쌓이지 않는다
          angry: 0.1,
          dogged: 0.4,
          guardSpeed: 0.5,
          rhythm: 6,
          margin: 0.34,
          aggr: 1.05,
          vor: 0.45,
          patienceTime: 8,
          circleRate: 0.18,
          guardPref: { ochsR: 1.7, pflugL: 1.65, langort: 1.2, alber: 0.2, tag: 0.4 },
          // 머리·목을 노리는 무거운 베기(분노의 베기·정수리 베기)만 쓴다. 올려베기·가로베기처럼 힘이 안 실리는 기술은 안 쓴다
          techPref: { zornhau: 1.6, oberhau: 1.4, zornhauL: 1.3, unterhau: 0.4, unterhauL: 0.4, zwerch: 0.5, zwerchL: 0.5 },
        },
        whole: { sPref: 0.55, sSpread: 0.1, windRate: 0.25, windLen: [0.2, 0.3], punish: { windup: 0.8, overrun: 0.8, thrown: 0.75 }, evade: 0.45 }, // 감기 없이 자세에서 곧장 벤다. 온몸을 싣되 딱 필요한 만큼. 상대의 모든 틈을 벌한다(Nachreisen). 큰 베기는 받아치며 막는다(Absetzen)
        idle: { guard: 'ochsR', gesture: 'still' }, // 시작 2초: 미동 없음
        close: { rate: 0.15, kind: 'barge', then: 'cut' }, // 거의 안 쓴다. 쓰면 밀자마자 따라 들어가 벤다(Nachreisen)
      },
    },
    look: getLook('margarethe'),
    lookVersion: CHARACTER_LOOK_VERSION.margarethe,
    taunt: '서두르는 쪽이 먼저 베인다.',
    lines: {
      intro: ['서두르는 쪽이 먼저 베인다.', '너에게도 회한이 있는가?', '…아직도 벨 수 있을까? 확인해 보지.'],
      attack: ['지금.', '거기서 서둘렀다.'],
      hurt: ['…좋은 칼.', '내가 서둘렀군.', '다시.'],
      winning: ['기다려. 올 거다.', '…아직.'],
      losing: ['…망설이지 않는군. 그건 가르칠 수 없지.', '그래. 이것도 다른 근육이야.'],
      win: ['거기서 서둘렀다. 그게 전부야.', '…콘라트, 오늘은 서두르지 않았어.', '가르치는 근육도 아직 벨 줄 아는군.'],
      lose: ['…서둘렀나. 제자들에게 말해야겠군.', '좋은 검객이었다. 서두르지 마라.'],
    },
  },

  // ───────────────────────────────────────────── 6~8. 샛별 저장소에서 가져온 세 사람 (사장님 지시 10/9 23:4x·10/10 새벽) ─────────────────────────────────────────────
  //  외형(looks.js·outfits.js)과 소리(목소리 voice — 처음엔 샛별 쪽 짝 그대로, 10/12 그쪽 새 배정으로 갱신)만 가져왔다. 무기는 사장님 지시대로
  //  (토메 비달 = 레이피어 · 미나미('영만'에서 이름 바꿈) = 모노호시자오 · 오마리 = 츠바이핸더 — 샛별 설정은 펄션).
  //  플레이 기질(persona.level·pers·idle·close·whole)과 설정 문구(별명·나이·출신·이야기·대사)는 가져오지 않았다(디렉터 판단).
  //  pers 가 비어 있어 유파 기질(schools.js TRADITIONS[유파].temper)이 쓰인다. 실력 묶음은 기본 'normal'.
  //  기록: docs/characters/import_saetbyeol_2026-10-09.md
  {
    id: 'tome',
    name: '토메 비달',
    epithet: '아르키진나시오의 사서', // 사장님 10/10 08:0x: 아르키진나시오 도서관의 고문서 사서 — 시간을 넘는 설정(실제 도서관은 1801~)
    weapon: 'rapier', // 이탈리아 유파 (traditionOf: 한손 찌르기)
    voice: 'tome', // 목소리: 토메 묶음(기본 상대 녹음을 빌림, 김씨와 같이) — 10/12 사장님 지시로 샛별 저장소 77db8c5 배정을 가져옴 (전 'liao')
    ai: { proficiency: 2, persona: { school: 'rapier', pers: {} } },
    look: getLook('tome'),
    lookVersion: CHARACTER_LOOK_VERSION.tome,
    // 대사 (10/10 19:4x 사장님 — 작가 제안 docs/ui/character_voice_proposal_2026-10-10.md §4-1 그대로: 정중한 합쇼체, 책·기록·서가·여백 낱말, 서두르지 않음)
    taunt: '이름은 묻지 않겠습니다. 기록은 하겠지만.',
    lines: {
      intro: ['이름은 묻지 않겠습니다. 기록은 하겠지만.', '칼끝을 보십시오. 답은 거기 있습니다.', '서가를 오래 비울 수는 없습니다.'],
      attack: ['실례.', '열렸습니다.', '안쪽으로.'],
      hurt: ['잘못 읽었습니다.', '…제 계산이 틀렸군요.', '잉크보다 진하군요.'],
      winning: ['천천히 읽으셔도 됩니다.', '이미 아는 대목입니다.'],
      losing: ['한 걸음 비키겠습니다.', '…이 수는 적어 둬야겠군요.'],
      win: ['한 줄이 모자랐습니다.', '여백에 적어 두겠습니다.', '칼끝을 보셨어야 했습니다.'],
      lose: ['…마지막 쪽이군요.', '서가 불은… 꺼 주십시오.'],
    },
  },
  {
    id: 'omari',
    name: '오마리',
    epithet: '빚 없는 선장', // 사장님 10/10 19:4x (샛별 저장소 칭호)
    weapon: 'zweihander', // 이베리아 유파 (사장님: 이베리아 비기를 볼 수 있게. 샛별 설정은 펄션)
    voice: 'omari', // 목소리: 오마리 전용 녹음(CC0) — 10/12 사장님 지시로 샛별 저장소 1ea73c5·200269d 를 가져옴 (전 'bran')
    ai: { proficiency: 1, persona: { school: 'zweihander', pers: {} } },
    look: getLook('omari'),
    lookVersion: CHARACTER_LOOK_VERSION.omari,
    // 대사 (10/10 19:4x 사장님 — 작가 제안 §4-2 그대로: 느낌표 없는 짧은 반말, 물때·닻·뭍·셈 같은 뱃사람 낱말)
    taunt: '물때 전에 끝내자.',
    lines: {
      intro: ['물때 전에 끝내자.', '배는 기다려 주지 않는다.', '뭍은 넓다. 칼도 그만큼 크지.'],
      attack: ['비켜라.', '크게 돈다.', '한 바퀴 더.'],
      hurt: ['얕다.', '…바닷물보다 짜다.', '…돛은 멀쩡해.'],
      winning: ['물이 차오른다. 네 쪽으로.', '키는 내가 잡았다.'],
      losing: ['…닻을 내릴 때인가.', '뱃길을 놓쳤다.', '뭍은 아직 낯설다.'],
      win: ['이걸로 셈은 끝났다.', '바람이 바뀌었다. 닻 올린다.', '살아 있으면 배로 와. 자리는 있다.'],
      lose: ['빚은… 다 갚았나.', '…배는 혼자서도 뜬다.'],
    },
  },
  {
    id: 'minami',
    name: '미나미',
    epithet: '수호자', // 사장님 10/11 01:1x (전 '금줄의 무녀' 10/10 19:4x)
    weapon: 'monohoshizao', // 일본 유파
    voice: 'isolde', // 목소리: 이졸데의 녹음 (이졸데와 같이. 10/13 기절2·출혈2 보충 — 마야는 10/13 에 따로 나감)
    ai: { proficiency: 5, persona: { school: 'monohoshizao', pers: {} } }, // 숙련도 5 = 일본 유파 신 — 고유 동작 넷 + 비기(고노센) (사장님 10/14 03:5x '미나미 숙련도 5로 해줘', 전 3)
    look: getLook('minami'),
    lookVersion: CHARACTER_LOOK_VERSION.minami,
    // 대사 (10/10 19:4x 사장님 — 작가 제안 §4-3 그대로: 짧고 단단한 해요체, 금줄·안개·피가 흙에 닿는 일, 겁 고백 없음)
    taunt: '금줄 안쪽은 내줄 수 없어요.',
    lines: {
      intro: ['금줄 안쪽은 내줄 수 없어요.', '여기서부터는 신목의 땅이에요.', '물러서진 않아요. 베고 싶지도 않고요.'],
      attack: ['거기까지예요.', '한 번에.'],
      hurt: ['피가 흙에 닿으면 안 되는데.', '한 박자 늦었어요.', '…견딜 수 있어요.'],
      winning: ['지금이라도 돌아가세요.', '더 다치기 전에 그만해요.'],
      losing: ['…금줄은 지켜야 해요.', '칼이 길어서가 아니에요. 제가 서툴러서예요.', '신목님, 조금만 더.'],
      win: ['…이제 안개가 걷혀요.', '숲이 조용해졌어요.', '당신 몫까지 빌어 둘게요.'],
      lose: ['숲을… 부탁해요.', '…안개가 짙어져요.'],
    },
  },

  // ───────────────────────────────────────────── 9~12. 샛별 저장소에서 가져온 네 사람 (사장님 지시 10/10 19:2x, 기준 5a4e96c) ─────────────────────────────────────────────
  //  이번엔 '정보'까지 가져온다: 외형(looks.js·outfits.js) · 목소리 짝(voice — 그쪽도 새 녹음 없이 기존 녹음을 빌림) · 설정 문구 · 대사 · 플레이 기질(persona).
  //  리뷰(docs/import/saetbyeol_new_2026-10-10.md)와 사장님 답(10/10 20:0x)대로 맞춘 것만 바꿨다 — 칸마다 주석. 무대 짝: 처음엔 그쪽 무대가 범위 밖이라
  //  우리 무대의 '검객 후보'로 더했고(stages.js STAGE_FOE_EXTRA: 10/10 23:3x 대성당 아르토리아 · 붉은 회랑 사미라, 본디 짝과 반반), 10/10 20:4x 그쪽 무대 둘을 가져와 김씨 = 청람잔도(qinglan) ·
  //  투야나(eira) = 얼어붙은 만(frozen_bay) 의 정식 짝(STAGE_FOE)이 됐다(산사·성 안뜰 후보에서는 뺌). 왕관의 성소는 안 가져옴. 기본 회전(무작위 상대)에도 든다.
  {
    // 샛별 6e71ba2(처음) · 5277832(외형 v2) · c21bd19(눈) — 엑스칼리버 진품의 주인이라는 그쪽 설정. 이름은 그쪽 사용자 확정
    id: 'artoria',
    name: '아르토리아',
    epithet: '왕', // 사장님 10/11 01:1x (전 '돌아온 맹세')
    age: 24,
    origin: '브리튼 · 바다 너머의 잃어버린 왕국',
    backstory: '금빛 검을 지녔다는 소문을 따라 바다를 건넌 기사. 왕관도 군대도 없이 돌아왔지만, 엑스칼리버는 여전히 그녀의 손에서 빛난다. 이름을 빌린 이들을 벌하기보다, 그 이름이 지켜야 했던 사람들을 찾는다.',
    want: '검에 걸었던 맹세를 끝까지 지키고, 흩어진 사람들을 고향으로 돌려보내는 것.',
    school: '엑스칼리버의 실제 소유자라는 게임 속 창작 설정. 기존 양손검 자세와 엑스칼리버 유파(독일)를 사용한다.',
    signatureMoves: '몸 가까이 검을 되찾고, 짧은 준비에서 크게 비스듬히 벤다.',
    favoriteGuards: '오른쪽 어깨와 쟁기. 칼끝으로 길을 닫고 다음 베기를 준비한다.',
    temperament: '말은 적지만 상대를 얕보지 않는다. 잃어버린 것보다 지켜야 할 것을 먼저 본다.',
    movementNotes: '절제된 양손검 동작과 안정된 준비 자세. 외형을 이유로 별도 힘 보너스를 주지 않는다.',
    weaknesses: '큰 베기가 빗나간 뒤 몸 가까이 파고드는 연속 압박에는 빈틈이 생긴다.',
    weapon: 'excalibur', // 진품(레전드, 금빛 기운) — 사장님 10/10 20:3x '진품 그대로 들게 해'. 하인리히는 복제품 그대로, 플레이어도 카드로 진품을 뽑을 수 있다
    voice: 'soft_female', // 목소리: 조용한 들숨·한숨 묶음(Reitanna, CC0 — 에이라와 같이) — 10/12 사장님 지시로 샛별 저장소 04311ff 배정을 가져옴 (전 'isolde')
    ai: { proficiency: 4, persona: {
      school: 'excalibur',
      level: { reaction: 0.26, guardChance: 0.7, counter: 0.35, feint: 0.2, followUp: 0.42, read: 0.75, discipline: 0.88, strength: 1, aggression: 0.8, windup: 0.7, skill: 0.82 },
      pers: { precision: 0.85, guardStick: 2.5, fearful: 0.2, angry: 0.2, dogged: 0.45, guardSpeed: 0.85, rhythm: 2.6, margin: 0.22, aggr: 0.85, vor: 0.45, patienceTime: 4.5, circleRate: 0.22,
        guardPref: { tagR: 1.6, pflugR: 1.5, ochsR: 1.1, langort: 1.2 },
        techPref: { zornhau: 1.5, oberhau: 1.25, zornhauL: 1.2, stichPflug: 1.1 } },
      idle: { guard: 'pflugR', gesture: 'still' }, close: { rate: 0.25, kind: 'barge', then: 'cut' },
    } },
    look: getLook('artoria'),
    lookVersion: CHARACTER_LOOK_VERSION.artoria,
    taunt: '이 검에 걸었던 맹세는, 아직 끝나지 않았습니다.',
    lines: { intro: ['이 검에 걸었던 맹세는, 아직 끝나지 않았습니다.', '왕관은 잃었어도, 지킬 것은 남았습니다.', '당신의 검으로 답해 주십시오.'], win: ['검을 거두세요. 여기서 끝냅시다.', '이름보다 무거운 것은, 그 이름의 약속입니다.', '나는 아직 돌아갈 곳이 있습니다.'] },
  },
  {
    // 샛별 id 'crown_boss'(4ac5909 왕관 기사 → 59680c9 푸른 제복 → 37b9f54 리볼버 → b8b1344 장밋빛). 우리엔 왕관도 마지막 보스 자리도 없어 id 를 이름으로 바꿈
    id: 'samira',
    name: '마야 라토르', // 사장님 10/11 00:4x '이름 마야로 바꾸자. 인도인 컨셉은 유지' + 01:0x 성 라토르(라자스탄 라지푸트 가문 성 — 앙가르카가 라자스탄·무굴 궁정 옷이라 옷과 한 지역) — 전 이름 '사미라 미르자'. id 'samira' 그대로(투야나 id 'eira' 와 같은 방식). 칭호·설정·대사 그대로
    epithet: '붉은 봉인의 전령',
    age: 28,
    origin: '인도 · 라자스탄', // 10/11 01:2x 성 라토르(라자스탄 라지푸트)와 지역을 맞춤 (전 '인도 · 서해안의 항구 도시')
    // 설정 (10/21 샛별 저장소 — 밤의 봉인의 중정 이야기에 맞춤, 사장님 승인. 전: 폭풍으로 철수 명령을 제때 전하지 못한 전령 · 먼 성소의 마지막 문을 지킴)
    backstory: '라자스탄 라지푸트 가문 출신의 군 전령. 봉인된 중정에서 열린 평화 사절단의 비밀회담에 관한 명령서를 제때 전달하지 못했다. 잘못된 교전은 큰 전쟁으로 번졌고, 중정은 포격으로 무너졌다. 돌아오지 못한 동료들의 이름과 봉인된 명령서를 품고, 남은 이들에게 전할 마지막 소식을 지킨다.',
    want: '끝내 전하지 못한 마지막 소식을 남은 가족에게 돌려주고, 자신의 임무를 마치는 것.',
    school: '기존 리볼버의 조준·사격·장전을 사용하는 창작 인물(무유파).',
    signatureMoves: '간격을 벌리고 조준이 맞는 순간 사격한 뒤, 여섯 발을 소진하면 장전한다.',
    favoriteGuards: '한손으로 총구를 겨누며 다음 발을 준비한다.',
    temperament: '말과 움직임이 적고, 다가오는 상대를 차분히 기다린다.',
    movementNotes: '기존 총기 제어와 몸 규격을 그대로 사용한다.',
    weaknesses: '장전 중의 빈틈과 총구 안쪽으로 파고드는 근거리 압박.',
    weapon: 'pistol', // 건슬링어의 리볼버(??? 등급) — 그쪽 '전용 리볼버'는 새 무기가 아니라 이 권총이다. AI 는 gun.js(간격 벌려 쏘기)
    voice: 'maya', // 목소리: 마야 전용 녹음(AuraVoice, CC0) — 10/13 사장님 지시로 샛별 저장소 3f330f7·b75013b·9d1b56a 배정을 가져옴 (전 'isolde')
    ai: { proficiency: 3, persona: { // 숙련도 3 (사장님 10/20 00:4x '마야 숙련도 3을 적용해' — 전 1 · 10/13)
      gunCooldownK: 1.5, // 핸디캡: 사격 사이 쿨타임 1.5 배 (GUN.cooldown 0.8 → 1.2 s, AI 가 몰면 GUN.aiCooldownK 1.8 을 더 곱해 2.16 s — 확인표 2022) — 사장님 지시 10/10 20:0x (기본 무작위 상대에서 빼는 대신, 확인표 750)
      level: { reaction: 0.16, guardChance: 0.88, counter: 0.55, feint: 0.15, followUp: 0.65, read: 0.9, discipline: 0.95, strength: 1.1, aggression: 0.9, windup: 0.36, strikeSpeed: 13, skill: 0.95 },
      pers: { precision: 0.95, guardStick: 4, fearful: 0.08, angry: 0.12, dogged: 0.4, guardSpeed: 0.7, rhythm: 4, margin: 0.3, aggr: 0.95, vor: 0.45, patienceTime: 6, circleRate: 0.18 },
      idle: { guard: 'langort', gesture: 'still' },
    } },
    look: getLook('samira'),
    lookVersion: CHARACTER_LOOK_VERSION.samira,
    taunt: '이 문을 넘을 이유는 있겠지요.',
    lines: { intro: ['이 문을 넘을 이유는 있겠지요.', '이번엔 아무도 헛되이 보내지 않겠습니다.'], win: ['서두르지 마세요. 돌아갈 길은 남아 있습니다.', '무기를 거두세요. 전할 말이 아직 있잖아요.'] },
  },
  {
    // 샛별 27888f2(처음) · 4c5ce4d(여행자 옷·머리) · dcad882(짚신). id 는 그쪽 처음 이름의 흔적(복식 모듈 이름과 같게 둠)
    id: 'renji',
    name: '김씨',
    epithet: '용문객잔 주인', // 사장님 10/14 12:1x (전 '걷는 남자' 10/11 01:1x · 그 전 '칼을 뽑지 않는 낭인')
    age: 32,
    origin: '변방 사막 길목의 객잔', // 10/14 칭호 '용문객잔 주인'에 맞춰 설정·대사를 다듬음 (사장님 12:2x '다듬어') — 전 '북쪽 항구와 산길'
    backstory: '변방 사막 길목에서 객잔을 지키는 주인. 형이 남긴 검은 계산대 뒤 벽에 걸어 두었다. 그 검으로 사람을 베지 않겠다는 약속 때문에, 손님과 객잔을 지킬 때는 항구 시절에 얻은 낯선 철퇴를 든다. 문을 들어서는 길손에게는 누구든 먼저 차를 권한다.',
    want: '객잔을 지나는 길손 가운데 형의 마지막을 아는 이를 만나, 걸어 둔 검을 바다 건너 남은 가족에게 돌려주는 것.',
    school: '기존 둔기 동작을 사용하는 창작 객잔 주인(무유파). 형의 검은 객잔 벽에 걸어 두고 실제 전투에는 모르겐슈테른만 사용한다.',
    signatureMoves: '철퇴를 몸 가까이 거두었다가 짧게 내려친다.',
    favoriteGuards: '오른쪽 어깨와 옆 지킴.',
    temperament: '무뚝뚝하지만 손님은 끝까지 챙기고 약속한 일은 끝까지 한다. 벽에 걸린 검을 이야기할 때만 말이 짧아진다.',
    movementNotes: '둔기 꾸러미가 철퇴 길이(weapon_measured.js 실측)에 맞춰 간격을 잡는다.',
    weaknesses: '짧은 철퇴가 닿기 전의 거리와 빗나간 뒤의 빈틈.',
    weapon: 'morgenstern', // 레어 둔기 → 무유파
    voice: 'tome', // 목소리: 토메 묶음(토메와 같이) — 10/12 사장님 지시로 샛별 저장소 04311ff 배정을 가져옴 (전 'liao')
    ai: { proficiency: 2, persona: {
      school: 'morgenstern', // 그쪽은 옛 꾸러미 이름 'tree_branch'(나뭇가지 간격) — 우리는 무기 id 꾸러미(무유파 + 철퇴 실측 간격)
      level: { skill: 0.76, discipline: 0.84, strength: 1, aggression: 0.8 },
      pers: { precision: 0.8, guardStick: 2.7, fearful: 0.22, angry: 0.2, dogged: 0.4, rhythm: 2.8, aggr: 0.84, vor: 0.45,
        guardPref: { tagR: 1.7, wechselR: 1.3 }, techPref: { oberhau: 1.4, zornhau: 1.4 } },
      idle: { guard: 'tagR', gesture: 'still' },
    } },
    look: getLook('renji'),
    lookVersion: CHARACTER_LOOK_VERSION.renji,
    taunt: '객잔에선 칼을 뽑지 않네. 이걸로 하지.',
    lines: { intro: ['객잔에선 칼을 뽑지 않네. 이걸로 하지.', '차가 식기 전에 끝내세.'], win: ['검을 뽑을 일은 없었군.', '방값은 받지 않겠네. 몸조리나 하게.'] }, // 하게체 그대로 (10/14 다듬음)
  },
  {
    // 샛별 27888f2
    id: 'eira',
    name: '투야나 니콜라예바', // 사장님 10/10 21:0x '투야나에 러시아 성 붙여' — 투야나(부랴트 '빛줄기', 바이칼 둘레) + 니콜라예바(정교회 교구 세례 성 — 길손의 수호성인 니콜라오에서, '눈길의 사제'와 이어짐). 전 이름 '에이라 린드'(샛별 저장소). 설정·대사는 샛별 것 그대로(사장님)
    epithet: '빙판의 사제', // 사장님 10/11 00:1x '빙판의 사제로 칭호 바꾸자' (전 '눈길의 사제')
    age: 26,
    origin: '동시베리아 내륙 · 얼어붙은 호수 교구', // 샛별 설정 그대로 (사장님 10/10 20:3x '설정과 대사는 샛별 안 그대로')
    backstory: '긴 겨울이면 마을 사이를 걸어 약과 편지를 나르는 순회 사제. 돌아오지 못한 사람들의 이름을 작은 종 안쪽에 새긴다. 얼어붙은 길에서 자신과 짐을 지키려 레이피어를 배웠다. 봄을 믿지만, 봄이 모든 사람에게 제때 오지 않는다는 것도 안다.',
    want: '올겨울에도 가장 먼 마을의 등불이 꺼지지 않게 하는 것.',
    school: '기존 레이피어 유파(이탈리아)를 사용하는 창작 사제. 특정 종교의 실제 전투 전통을 재현한 것은 아니다.',
    signatureMoves: '칼끝으로 길을 막고 상대가 다가오면 짧게 찌른다.',
    favoriteGuards: '쟁기와 긴 자세.',
    temperament: '차분하고 실용적이다. 위로할 말을 고르기 전에 젖은 장갑부터 벗겨 준다.',
    movementNotes: '기존 레이피어의 간격과 찌르기 동작을 사용한다.',
    weaknesses: '칼끝 안쪽으로 깊게 붙는 압박.',
    weapon: 'rapier', // 이탈리아 유파
    voice: 'soft_female', // 목소리: 조용한 들숨·한숨 묶음(Reitanna, CC0 — 아르토리아와 같이) — 10/12 사장님 지시로 샛별 저장소 77db8c5 배정을 가져옴 (전 'isolde')
    ai: { proficiency: 2, persona: {
      school: 'rapier',
      level: { skill: 0.78, discipline: 0.88, strength: 1, aggression: 0.75 },
      pers: { precision: 0.85, guardStick: 3.2, fearful: 0.25, angry: 0.1, dogged: 0.3, rhythm: 3.2, aggr: 0.78, vor: 0.35,
        guardPref: { pflugR: 1.8, langort: 1.8 }, techPref: { stichPflug: 2, stichOchs: 1.5 } },
      idle: { guard: 'pflugR', gesture: 'still' },
    } },
    look: getLook('eira'),
    lookVersion: CHARACTER_LOOK_VERSION.eira,
    taunt: '눈이 더 쌓이기 전에 지나가야 해요.',
    lines: { intro: ['눈이 더 쌓이기 전에 지나가야 해요.', '칼을 거두면, 불가에 자리가 있어요.'], win: ['숨을 고르세요. 아직 따뜻해질 수 있어요.', '여기서 잠들면 안 돼요.'] },
  },
];

// ───────────────────────────────────────────── 변형 캐릭터 — 여정의 한 자리에만 나온다 ─────────────────────────────────────────────
//  CHARACTERS(다섯) 밖에 둔다: 기본 회전(randomCharacter)·시뮬 라운드로빈에는 들어가지 않고, id로만 불린다
//  (stages.js STAGE_FOE 짝·?foe=id). 원본 시트를 복사해 만들며, 원본은 건드리지 않는다.
const HEINRICH = CHARACTERS.find((c) => c.id === 'heinrich');

// ── 숙련도 (사장님 결정 10/13 22:4x~23:0x — docs/strike/ai_proficiency_2026-10-13.md) ──
//  "AI 상대는 숙련도 수치에 따라 쓸지 말지를 결정하게 하자. 지금 '난이도'를 그렇게 개편 … 각 검술의 숙련도가 있고 캐릭터마다 숙련도가 달라."
//  시트 ai.proficiency = 자기 유파(시트 무기 weapon 의 유파 — schools.js traditionOf)의 숙련도. 다른 유파 = 0 (브론이 주워 온 칼처럼 다른 유파 무기를 들면 고유 동작 없음).
//  무유파 무기(나뭇가지·권총·모르겐슈테른)는 고유 동작이 없어 숙련도는 실력 숫자에만 쓰인다.
//  aiAtProficiency 가 ai.level(실력 숫자 이름 = config.js AI_PROFICIENCY.levels[숙련도])과 persona.proficiency({ 유파: 숙련도 } — ai.js·sword_art.js 가 고유 동작을 거르고, 5 에서만 비기)를 만든다.
//  시트 기본값(finishAI — 도구는 지금처럼 ai.level·ai.persona 를 읽는다)과 시험 주소 ?foeProficiency=N(main.js)이 같은 함수를 쓴다.
//  변형(mad: true — 사장님 10/13 "'광기의'는 궁극적으로 모든 캐릭터들에게 … 기본 캐릭터+1 의 숙련도와 추가 파워" · 10/14 "얼터 에고 컨셉 — 칭호는 본캐랑 같음": 이름 앞에 '광기의', 칭호는 본캐 그대로): 변형 표시 하나 → 숙련도 +1(VARIANT_PLUS, 상한 AI_PROFICIENCY.max) ·
//   기존 하인리히 실력 숫자 = 그 숙련도에서 원본이 받을 실효값 × MAD_SCALE(+20%).
//   10/16 새 투야나·랴오는 외양만: appearanceOnly는 원본 AI를 그대로 쓰고 이 강화 규칙을 적용하지 않는다.
//   10/16 22:3x 사장님 "모든 얼터에 숙련도+1을 잊지 말고 적용해 두도록 해" → appearanceOnly 도 숙련도 +1(madVariantAI)은 받는다 — 빼는 것은 실력 숫자 +20% 뿐.
//    새 얼터가 들어와도 아래 '얼터 숙련도 맞춤'이 원본 +1(상한 5)로 맞춘다. 미나미(5)는 얼터도 5 — 낮의 미나미도 고노센(사장님 '마음에 든다')
const VARIANT_PLUS = 1;
export function aiAtProficiency(c, p) {
  const level = AI_PROFICIENCY.levels[p] ?? 'normal';
  const persona = { ...c.ai.persona, proficiency: { [traditionOf(WEAPONS[c.weapon])]: p } };
  if (c.mad && !c.appearanceOnly && !c.retainBaseStats) {
    const base = CHARACTERS.find((x) => x.id === c.variantOf);
    persona.level = scaledLevel({ level, persona: base.ai.persona }, MAD_SCALE);
  }
  return { level, persona };
}
/** 시트의 숙련도로 ai.level·ai.persona 를 채운다 (모듈을 읽을 때 한 번) */
function finishAI(c) {
  const { level, persona } = aiAtProficiency(c, c.ai.proficiency);
  c.ai.level = level;
  c.ai.persona = persona;
}
for (const c of CHARACTERS) finishAI(c);
/** 변형의 ai: 원본 ai 깊은 복사 + 숙련도 +1 (실력 숫자·유파 표는 finishAI 가 변형 시트에서 채운다) */
function madVariantAI(base) {
  const ai = JSON.parse(JSON.stringify(base.ai));
  ai.proficiency = Math.min(AI_PROFICIENCY.max, base.ai.proficiency + VARIANT_PLUS);
  return ai;
}

// 광기의 하인리히 실력 숫자 (사장 확정 2026-09-28: "능력치는 원래의 하인리히 +20%" · 10/13 숙련도 개편 뒤: 원본 숙련도 +1 에서 받을 값 +20%).
//  출발점은 낮의 하인리히가 그 숙련도에서 받을 값 = AI_LEVELS[숙련도의 이름] 위에 persona.level을 덮은 것 (ai.js setLevel과 같은 병합).
//  그래서 하인리히 시트에 없는 chamberSpeed·parrySpeed·predict도 그 이름(지금 hard)의 기본값에서 같이 올리고, 결과는 열다섯 키를 모두 적는다.
//  원본에서 그때그때 계산하므로 낮의 하인리히를 고치면 +20% 관계도 따라간다. 원본 시트·AI_LEVELS는 읽기만 한다.
//  [방향, 상한]: +1 = 클수록 세다(×1.2), -1 = 작을수록 세다(시간이라 ÷1.2), 0 = 그대로. 상한 1 = 확률·0~1 값이라 1에서 자른다
const MAD_SCALE = 1.2;
const MAD_LEVEL_RULES = {
  reaction: [-1], // 반응 시간(초)
  windup: [-1], // 준비 동작에서 멈추는 시간
  chamberSpeed: [+1],
  strikeSpeed: [+1],
  parrySpeed: [+1],
  guardChance: [+1, 1],
  predict: [+1, 1], // 1을 넘으면 몸을 너무 앞질러 봐서 오히려 틀린다
  counter: [+1, 1],
  feint: [+1, 1],
  followUp: [+1, 1],
  read: [+1, 1], // (1−read)가 난수 폭이라 1을 넘으면 뜻이 뒤집힌다
  discipline: [+1], // 1을 넘는 값도 쓴다 (마르그레테 1.05)
  strength: [+1],
  aggression: [0], // 실력이 아니라 기질(조급함)이다 — 올리면 낮의 약점 "먼저 무리하게 들어온다"만 커진다
  skill: [+1, 1], // 0~1 척도
};
function scaledLevel(ai, scale) {
  const base = { ...(AI_LEVELS[ai.level] || AI_LEVELS.normal), ...ai.persona?.level };
  const out = {};
  for (const [key, v] of Object.entries(base)) {
    const [dir, cap = Infinity] = MAD_LEVEL_RULES[key] || [0]; // 표에 없는 새 키는 그대로 둔다 (새 실력 숫자가 생기면 여기에 방향을 적는다)
    const x = dir > 0 ? v * scale : dir < 0 ? v / scale : v;
    out[key] = Math.round(Math.min(cap, x) * 1e4) / 1e4;
  }
  return out;
}
// 성격(pers)·유파(school)는 하인리히 그대로 깊은 복사하고(madVariantAI — 숙련도 2 → 3), persona.level 은 변형 시트를 읽을 때 finishAI 가 바꿔 끼운다.
//  지금 값 (숙련도 3 = hard 위에 하인리히 persona.level, ×1.2 — 10/13 전엔 normal 위): docs/strike/ai_proficiency_2026-10-13.md 표.
//  strikeSpeed·chamberSpeed·parrySpeed·strength는 손 목표 필터·관절 속도 한계에 막혀 체감은 +20%보다 작다 (docs/characters.md)
const HEINRICH_MAD_AI = madVariantAI(HEINRICH);
// 온몸 타격 기질(초안, 캐릭터 PM): 낮보다 더 싣고 더 자주 감고, 물러날 줄을 모른다 — 비켜서기 대신 맞받는다
HEINRICH_MAD_AI.persona.whole = { sPref: 0.9, sSpread: 0.1, windRate: 0.8, windLen: [0.25, 0.5], punish: { windup: 0.5, overrun: 0.65, thrown: 0.6 }, evade: 0.15 };
HEINRICH_MAD_AI.persona.idle = { guard: 'langort', gesture: 'still' }; // 시작 2초: 칼끝을 겨눈 채 흔들림 없음
HEINRICH_MAD_AI.persona.close = { rate: 0.9, kind: 'barge', then: 'cut' }; // 밀고 들어가는 것만 한다
export const CHARACTER_VARIANTS = [
  // 4b. 광기의 하인리히 도른 — 밤의 포세이돈 신전에 다시 나타나는 하인리히 (사장 요청, 디렉터 14:08).
  //  붉은 눈·안광 아우라는 외형 담당 몫이고, 여기서는 eyes 표식만 둔다.
  //  사장 확정(2026-09-28): 대사는 우선 등장·승리 1종씩, 실력 숫자는 낮의 하인리히 +20% (HEINRICH_MAD_AI). 별칭은 10/14 부터 본캐와 같은 '미치광이'(얼터 에고 규칙 — 전 '밤의 왕').
  //  성격(pers)·유파·감정 문턱·외형·무기·목소리(variantOf)는 낮의 하인리히 그대로다. 설정은 docs/character_lore.md §4b
  {
    ...HEINRICH,
    id: 'heinrich_mad',
    variantOf: 'heinrich',
    mad: true, // 변형 표시 (10/13 일반 규칙): 숙련도 +1 · 실력 숫자 +20% — aiAtProficiency
    name: '광기의 하인리히 도른',
    // 칭호는 본캐와 같다 — '미치광이'(...HEINRICH 그대로). 사장님 10/14 12:4x "'광기의'는 모든 캐릭터에게 붙일 거고 얼터 에고 컨셉이야. 칭호는 본캐랑 같음" (전 '밤의 왕' 9/28)
    origin: '포세이돈 신전에서 쓰러진 뒤 그 자리를 떠나지 않았다. 밤이 되면 같은 자리에 다시 선다',
    backstory:
      '신전에서 베였다. 죽지는 않았다. 바닷물이 밀려와 피를 씻어 가는 동안 그는 칼을 놓지 않았고, 그날 밤부터 신전 기둥 사이에 앉아 칼과 이야기했다. ' +
      '패배는 그의 믿음을 깨지 못했다 — 안으로 파고들었을 뿐이다. 왕의 검이 졌을 리 없으니 진 것은 자기 손이고, 그러니 손을 검에 내주면 된다. ' +
      '며칠째 밤이 오면 그의 눈에 붉은 빛이 돈다. 칼이 그렇게 만든 건지 그가 그렇게 된 건지, 본 사람마다 말이 다르다.',
    want: '검이 원하는 것. 그것이 무엇인지는 그도 모른다 — 다만 상대의 목을 내놓으면 검이 잠잠해진다고 믿는다.',
    temperament:
      '웃지 않는다. 소리치지 않는다. 낮의 하인리히에게 남아 있던 사람의 확신은 없고, 검의 방향만 남았다. 맞아도 반응이 늦고, 물러날 줄을 모른다. ' +
      '느리게 다가와 한 번 물면 놓지 않는다.',
    // 시작 감정은 없다 (사장: "분노나 집념으로 시작하는 건 싫어"). 감정은 하인리히와 같은 보통 규칙을 따른다
    ai: HEINRICH_MAD_AI,
    // 대사는 우선 1종씩 (사장 확정). 게임이 읽는 intro·win만 둔다 — 나머지 키를 비워 두어야 낮의 하인리히 대사가 새지 않는다.
    //  taunt도 덮어쓴다: 대사를 못 찾을 때 쓰는 값이라 그대로 두면 낮의 '무릎 꿇어라…'가 물려 나온다
    taunt: '무릎은 필요 없다. 목만.',
    lines: {
      intro: ['무릎은 필요 없다. 목만.'],
      win: ['…이제 파도 소리가 들리는군.'],
    },
    look: alterLook(HEINRICH.look, 'heinrich'),
    lookVersion: HEINRICH.lookVersion,
    eyes: 'madGlow', // 외형 담당과 맞춘 표식: 붉은 눈 + 안광 아우라
  },
  // Visual previews: the original proficiency, persona and combat stats are unchanged.
  ...['eira', 'liao', 'margarethe', 'isolde', 'tome', 'omari', 'bran', 'minami'].map((id) => {
    const base = CHARACTERS.find((c) => c.id === id);
    return { ...base, ...(id === 'bran' ? { weapon: 'falchion', weaponAlt: null } : {}), // 얼터 브론은 늘 팔쉬온 (사장님 10/20 00:4x)
      id: `${id}_mad`, variantOf: id, mad: true, appearanceOnly: true,
      name: `광기의 ${base.name}`, ai: madVariantAI(base), // 숙련도 +1 (사장님 10/16 22:3x — 모든 얼터)
      look: alterLook(base.look, id), lookVersion: `${base.lookVersion}-alter${id==='isolde'?3:['margarethe','tome','bran'].includes(id)?2:1}`,
      eyes: id === 'liao' ? 'clothGlow' : 'madGlow',
    };
  }),
];

for (const c of CHARACTER_VARIANTS) finishAI(c);

// ───────────────────────────────────────────── 손님 인물 (처음엔 여정 밖) — 테스트 경로의 상대 고르기(test.html)·?foe=id, 그리고 여정의 제 무대 ─────────────────────────────────────────────
//  CHARACTERS(기본 회전·무작위 상대·시뮬 라운드로빈) 밖에 둔다. 무대와 함께 들어올 인물이 무대보다 먼저 왔을 때의 자리.
//  10/14 19:4x 사장님 결정으로 제 무대가 여정 정식 경로에 들어가 여정에서도 나온다: 라트나 = 잠든 습지 · 다라이시(silver_wanderer) = 소금 사막 (stages.js STAGE_FOE — CHARACTERS_BY_ID 로 풀림)
//  라트나 위라세타쿤 — 샛별 저장소 ed736cf5(라트나 v3 — 처음 d5b3151a · bf202a00, 기준 origin/main 325a5c38)에서 가져옴 (사장님 10/14 02:3x·03:0x 결정):
//   · 무기는 츠바이핸더(zweihander — 10/21 사장님 결정으로 북부 대공의 검(ice)을 지우며 바꿈 · 샛별 쪽은 레이피어, 앞서 팔쉬온) → 유파 이베리아, 쥠·자세·기술은 우리 이베리아 대검 것 그대로.
//     샛별 기질에서 유파에 묶인 자세·기술 취향(레이피어의 쟁기·찌르기 guardPref·techPref)은 뺐다 — 이베리아 자세 고르기 가중치 그대로. 실력·성격 숫자(level·pers 나머지)는 샛별 값 그대로(세 판 모두 같음)
//   · 판 시작 자세 'wechselR'(아래 탈류 — 칼끝을 오른쪽 아래로 떨굼)는 샛별 팔쉬온 판(af089dbb)의 idle 그대로 — 이베리아 간 보는 자세 목록에 있는 자리
//   · 습지 감속 면제 신발(샛별 terrainTraits.wetlandImmunity)은 옮기지 않는다 — 신발은 옷차림만. '마른 길을 아는 AI'는 넣음(사장님 10/14 18:3x — persona.terrainSense,
//     docs/import/ratna_drypath_2026-10-14.md): 잠든 습지에서만 켜지고 감속 면제는 여전히 없다(라트나도 웅덩이에 들면 똑같이 느려진다)
//   · 칭호·대사: 칭호 '습지 안내인' · 대사는 우리가 하오체로 다시 씀(토메 합쇼체·김씨 하게체와 겹치지 않게 — docs/import/ratna_port_2026-10-14.md §말투). 대검을 든 까닭을 말하는 줄은 넣지 않는다
//   · 목소리: 토메 묶음 그대로(새 소리 파일 없음 — 토메·김씨와 같은 녹음)
//   · 유파·장기·약점 글은 이베리아 대검 기준으로 다시 씀 (샛별 글은 레이피어·팔쉬온 기준 · 10/21 무기 이름만 츠바이핸더로). 원숭이가 어깨에서 등짐 위로 옮겨 가(겹침 검사 — looks.js v4) 그 두 줄도 맞춤
export const CHARACTER_GUESTS = [
  {
    id: 'ratna',
    name: '라트나 위라세타쿤',
    epithet: '습지 안내인',
    age: 52,
    origin: '동남아시아 · 담수 침수림에 잠긴 옛 마을',
    backstory: '물에 잠긴 마을들을 오가며 길을 안내하는 쉰두 살 습지 안내인. 떠난 사람들의 집에서 편지와 유품을 찾아 남은 가족에게 돌려준다. 작은 원숭이가 등짐 위에 앉아 어깨 너머로 길을 함께 본다. 물이 깊어진 곳은 황동 추로 더듬고, 돌아갈 길은 접힌 지도에 고쳐 그린다.',
    want: '마지막 집에 남은 소식까지 제 주인에게 돌려주고, 마을 사이의 뱃길을 잇는 것.',
    school: '기존 츠바이핸더와 이베리아 유파(몬탄테 — 두 손 대검)의 쥠·자세·기술을 그대로 쓰는 창작 습지 안내인. 동남아 습지의 실제 무술을 재현한 것은 아니다.',
    signatureMoves: '칼을 얼굴 앞에 세워 길을 막고 있다가, 오른쪽 앞으로 둥글게 돌아 디디며 사선으로 내려벤다(둥근 걸음 탈류). 곧게 내려벤 칼을 같은 줄로 되올리기도 한다(위아래 사슬). 막히거나 헛쳐도 칼을 멈추지 않고 반대 어깨로 흘려 다시 벤다.',
    favoriteGuards: '긴 자세(얼굴 앞에 멈춘 칼)와 아래로 떨군 칼(아래 탈류·아래 레베스). 판 시작에는 칼끝을 오른쪽 아래로 떨군 채 선다.',
    temperament: '목소리가 낮고 서두르지 않는다. 잃어버린 물건보다 그것을 기다리는 사람을 먼저 생각한다.',
    movementNotes: '이베리아 유파의 몬탄테 걸음을 그대로 쓴다. 넓은 갈대·나무 밑창 신발은 옷차림일 뿐 걸음에 주는 특혜가 없다. 등짐과 그 위의 원숭이는 몸통에 붙은 장식이라 맞지도, 따로 움직이지도 않는다.',
    weaknesses: '닿는 거리가 긴 대검인 만큼 칼끝 안쪽으로 깊이 붙는 압박에 약하고, 크게 휘두른 뒤 칼을 다시 세우기까지 빈틈이 길다.',
    weapon: 'zweihander', // 츠바이핸더 (커먼 · 두 손) — 이베리아 유파 (traditionOf: 앞무게 · 베기). 10/21 사장님 결정: 북부 대공의 검(ice, 레어)을 지우며 바꿈
    voice: 'tome', // 목소리: 토메 묶음 (토메·김씨와 같이 — 샛별 쪽 배정 그대로, 사장님 10/14 '당분간')
    ai: {
      proficiency: 2, // 숙련도 (사장님 결정 10/14) — 실력 숫자 normal · 이베리아 고유 동작 둘(둥근 걸음 탈류 · 위아래 사슬), 비기는 5 에서만
      persona: {
        school: 'zweihander', // 유파 꾸러미 id = 무기 id (schools.js SCHOOLS — 그 무기의 유파 + 그 무기 간격 실측). 전 'ice'(같은 이베리아 꾸러미 · 북부 대공의 검 간격) — 무기와 함께 바꿈
        level: { skill: 0.76, discipline: 0.84, strength: 1, aggression: 0.76 }, // 샛별 값 그대로
        pers: { precision: 0.78, guardStick: 2.8, fearful: 0.24, angry: 0.12, dogged: 0.4, rhythm: 2.9, aggr: 0.78, vor: 0.4 }, // 샛별 값 그대로 (자세·기술 취향은 뺌 — 위 머리말)
        idle: { guard: 'wechselR', gesture: 'still' }, // 시작 2초: 칼끝을 오른쪽 아래로 떨군 채 가만히
        // 마른 길을 아는 AI (사장님 10/14 18:3x '라트나 마른길 AI 넣어'): 진흙 감속을 받는 무대(잠든 습지 — movementSurface 'wetland')에서만 켜진다.
        //  마른 땅을 골라 디디고 웅덩이에 들면 빠져나오며(걸음 틀기 · 나오기 · 석상 돌아갈 쪽), 상대 등 뒤가 웅덩이가 되게 돌고 누르며, 상대가 젖은 자리에 서면 조금 더 먼저 들어간다
        //  — ai.js dry* · 값 config.js DRYPATH (확인표 1340~). 감속 면제는 없다
        terrainSense: 'wetland',
      },
    },
    look: getLook('ratna'),
    lookVersion: CHARACTER_LOOK_VERSION.ratna,
    // 대사 (하오체 — 52세 안내인이 낯선 길손에게: 낮추지도 올려 세우지도 않는 말. 길·물·물자국·편지·발밑 낱말, 느낌표 없음)
    taunt: '길은 잠겼을 뿐, 사라지지 않았소.',
    lines: {
      intro: ['길은 잠겼을 뿐, 사라지지 않았소.', '이 편지를 기다리는 사람이 있소. 길을 비켜 주시오.', '발밑을 보시오. 물이 깊은 데가 있소.'],
      win: ['물은 길을 바꿔도, 돌아갈 곳은 남아 있소.', '물자국은 거짓말을 하지 않소.', '편지는 내가 마저 전하겠소.'],
    },
  },
  // 다라이시 — 샛별 저장소 origin/main db729604(일몰판 9cf69988)의 silver_wanderer 에서 가져옴 (사장님 10/14 03:5x '숙련도 4' · 08:1x 결정, docs/import/salt_desert_port_2026-10-14.md):
  //  · id 는 샛별 쪽 그대로 silver_wanderer (겉모습·복식 열쇠와 같게 — 화면에는 안 나온다). 소금 사막 무대와 짝짓지 않았다(STAGE_FOE 없음 — 습지·라트나와 같이)
  //  · 칭호 '예니체리'(사장님 결정) — 설정 글은 특정 나라 이름 없이 '술탄의 근위대' 꼴로 맞춤(예니체리는 술탄의 근위 보병이라 샛별 글의 '왕실'과 어긋남 — 감독 판단, 사장님 확인 전).
  //    '이란'은 쓰지 않는다(사장님). 카드 글의 모노호시자오 = 사사키 코지로의 칼 연상은 그대로 열어 둔다(사장님)
  //  · 무기 모노호시자오 → 유파 자동 판정 일본, 숙련도 4(사장님 결정) = 실력 숫자 hard · 일본 고유 동작 넷 · 비기 없음
  //  · 기질: 같은 무기·유파인 미나미(기질 값 비움 → 일본 유파 기본 범위에서 판마다 굴림, 숙련도 5)와 갈리게 '과묵하고 참을성 있는 쪽'으로 못박음 —
  //    속임 적게·달려드는 상대를 맞받아 베기(반격 위주)·자세를 오래 지킴·덜 돎·조급하지 않음 (리뷰 4차 §2-5 안 — '간격 넓게'는 시뮬에서 너무 약해져 뺌, 값은 사장님 확인 전 — 확인표 1218)
  //  · 대사: 궁중 경어체('-옵-·-사옵-·-소서') — 토메 합쇼체·김씨 하게체·라트나 하오체·미나미 해요체·하인리히 해라체 명령 어느 것과도 안 겹친다 (확인표 1223)
  //  · 목소리: 하인리히 묶음(voice 'heinrich' — 한 줄로 바꿀 수 있게, 감독이 랴오 묶음과 비교해 사장님께 여쭘)
  {
    id: 'silver_wanderer',
    name: '다라이시',
    epithet: '예니체리', // 사장님 결정 10/14 08:1x (샛별 쪽 '기억을 잃은 왕실 근위검사')
    origin: '출신 불명 · 술탄의 근위대',
    backstory: '옛 이름과 출신을 잃었지만, 검을 다루는 몸의 기억은 남아 있었다. 낯선 긴 칼로 보여 준 실력을 인정받아 술탄의 근위대 예니체리가 되었고, 지금은 다라이시라 불린다. 어깨와 허리의 팔각 꽃무늬는 이제 몸담은 근위대의 표식이다. 소금 사막의 역참에서는 술탄의 호송대를 호위한다. 과거를 묻는 말에는 답하지 못해도, 맡은 사람을 지키는 일에는 망설임이 없다.',
    want: '잃어버린 이름을 찾는 동안에도, 자신을 받아 준 근위대와 맡겨진 사람들을 지키는 것.',
    school: '기존 모노호시자오와 일본 유파의 쥠·자세·기술을 그대로 쓰는 창작 검객. 의상의 문양으로 실제 출신이나 역사적 유파를 확정하지 않는다.',
    temperament: '과묵하다. 기억을 잃은 이방인이라 이곳 말이 서툴러, 대개 "음." 한마디로 답한다. 기억나지 않는 일을 아는 척하지 않는다. 서두르지 않고, 상대가 먼저 들어오기를 기다린다.', // 말투: 사장님 10/14 13:4x~13:5x '엄청 짧고 무뚝뚝한 말투 — 기억을 잃은 외국인이라 말을 잘 못해 · 으음. 음. 이런 말 위주로' (전 궁중 경어체)
    weapon: 'monohoshizao', // 모노호시자오 (에픽) — 일본 유파 (traditionOf)
    voice: 'heinrich', // 목소리: 하인리히 묶음 (하인리히·광기의 하인리히와 같이 — 감독 지시 10/14, 사장님 확인 전. 랴오 묶음은 'liao')
    ai: {
      proficiency: 4, // 숙련도 (사장님 결정 10/14) — 실력 숫자 hard · 일본 고유 동작 넷(히라키기리 · 코테 · 츠바메가에시 · 코코 연타), 비기는 5 에서만
      persona: {
        school: 'monohoshizao',
        level: { feint: 0.12, counter: 0.45, aggression: 0.85 }, // hard(0.3 · 0.35 · 1.0) 위에: 속임 적게 · 맞받아 베기 많이 · 조급하지 않게
        // 일본 유파 기본 범위(박자 4~7 s · 인내 9~14 s · 맞받기 0.2~0.5 · 돌기 0.1~0.25 · 자세 고집 4 · 손 0.7)의 참을성 있는 끝. 간격(margin)·자세 취향(guardPref)은 유파 기본 그대로 —
        //  간격 0.5 · 추단/핫소 취향까지 못박으면 기본 AI(롱소드 normal)와 30 판 4 승으로 떨어져(숙련도 4 기본 기질 16 승) 뺐다 (docs/import/salt_desert_port_2026-10-14.md §2-4)
        pers: { aggr: 0.8, vor: 0.6, rhythm: 7.5, guardStick: 5, guardSpeed: 0.6, circleRate: 0.08, patienceTime: 16, fearful: 0.1, angry: 0.05, dogged: 0.25 },
        idle: { guard: 'tagR', gesture: 'still' }, // 시작 2초: 오른 어깨 지붕(핫소)에 칼을 세우고 가만히 (샛별 값 그대로)
      },
    },
    look: getLook('silver_wanderer'),
    lookVersion: CHARACTER_LOOK_VERSION.silver_wanderer,
    // 대사 (궁중 경어체 — 술탄의 근위대에서 몸에 밴 예법: 상대가 누구든 낮추지 않고, 이긴 뒤에도 공손하다. 짧게, 느낌표 없음)
    taunt: '…음.',
    lines: { // 소리 위주, 낱말은 드물게 (사장님 10/14 13:5x '으음. 음. 이런 말 위주로')
      intro: ['으음.', '…음.', '……비켜.'],
      win: ['음.', '…으음.', '…끝.'],
    },
  },
  // 찬다 — 샛별 저장소 origin/main 7684c732 의 찬다 항목(첫 시안 675233e2 → 막야 5a242fa3)에서 가져옴 (사장님 10/14 18:3x · 19:4x 결정, docs/import/chanda_terra_port_2026-10-14.md):
  //  · 무기 막야(moye — 우리에게 있음, 레전드) → 유파 자동 판정 동방 · 숙련도 2(사장님 결정) = 실력 숫자 normal · 동방 고유 동작 둘(체보요격 · 좌익격), 비기는 5 에서만
  //  · 칭호 '수문지기'(사장님 결정 — 샛별 '마지막 수문지기'를 짧게) · 목소리 슈바르츠 묶음 = sound.js 의 margarethe 묶음(마르그레테와 같이 — 사장님 결정)
  //  · 기질: 샛별 값이 라트나(샛별 값 그대로 옮김)와 칸마다 0~0.1 차이라 찬다 쪽만 손봄(사장님 결정 — 라트나 값은 그대로).
  //    '수문 앞 한 줄 위에서, 들어오는 칼을 받아 막고 짧게 되받는 문지기' 쪽으로: 덜 돎 · 가까운 자세 고집 · 속임 거의 없음 · 받아 막은 뒤 되받기 · 다가오는 상대에 덜 물러남 ·
  //    쫓지 않음 · 겁·화 적음. 샛별 자세·기술 취향(wechselR·zornhau 등)은 뺐다 — 동방 자세 요격세·직부송서 취향만 (근거·잰 값 문서 §1-4 — tools/sim/guest_temper.mjs, 확인표 1402)
  //  · 대사: 샛별 넷(해요체)에 하나씩 더해 셋씩. '칼을 거두세요'(아르토리아 '검을 거두세요'·마야 '무기를 거두세요'와 겹침)는 '이제 돌아가세요'로 (확인표 1404)
  //  · 무대 짝 없음 — STAGE_FOE 는 건드리지 않았다(전용 무대 화산섬은 나중에 옮김 · 짝은 감독)
  {
    id: 'chanda',
    name: '찬다',
    epithet: '식물학자', // 사장님 10/16 (샛별 쪽 결정 — 전 '수문지기' 사장님 결정 10/14). 얼터도 같은 칭호
    age: 38,
    origin: '동남아시아 · 우림에 남은 옛 물길',
    backstory: '마을이 옮겨 간 뒤에도 옛 수문에 남은 관리인. 빗물이 길을 넘으면 돌을 고르고, 아래쪽 밭이 마르면 막힌 홈을 뚫는다. 오래전 물길을 따라 건너온 흰 검 막야를 수문의 열쇠처럼 물려받았다. 숲을 통과하는 사람에게는 길을 내주지만 물길을 해치는 사람에게는 칼을 든다.',
    want: '다음 우기에도 아래쪽 마을까지 물이 닿게 하는 것.',
    school: '기존 막야와 동방 유파의 쥠·자세·기술을 그대로 쓰는 창작 수문 관리인. 동남아 물가의 실제 무술을 재현한 것은 아니다.',
    signatureMoves: '칼끝을 곧게 뻗고 기다리다, 들어오는 칼을 받고 치켜 올렸다 눌러 손을 짧게 친다(좌익격). 앞발을 비껴 디디며 허리를 가로 베기도 한다(체보요격). 벤 칼은 곧 몸 가까이 거둔다.',
    favoriteGuards: '허리 옆에 칼을 눕힌 요격세와 칼끝을 곧게 뻗은 직부송서(긴 자세). 판 시작에는 칼을 오른 허리 옆에 눕혀 든다.',
    temperament: '차분하고 실용적이다. 누가 왔는지보다 무엇을 하려는지 먼저 묻는다. 지나가는 사람은 쫓지 않는다.',
    movementNotes: '동방 유파의 걸음을 그대로 쓴다. 수문 앞 한 줄 위에서 앞뒤로만 오가고 옆으로 덜 돈다.',
    weaknesses: '칼이 짧아 칼끝 밖에서 이어지는 긴 무기의 압박에 약하다. 속임을 거의 쓰지 않아 칼끝이 읽히기 쉽다.',
    weapon: 'moye', // 막야 (레전드 · 한손 劍) — 동방 유파 (traditionOf: school 'chinese')
    voice: 'margarethe', // 목소리: 슈바르츠 묶음 = margarethe 묶음 (마르그레테와 같이 — 사장님 결정 10/14)
    ai: {
      proficiency: 2, // 숙련도 (사장님 결정 10/14) — 실력 숫자 normal · 동방 고유 동작 둘(체보요격 · 좌익격), 비기는 5 에서만
      persona: {
        school: 'moye',
        // normal(맞받기 0.2 · 속임 0.15 · 잇기 0.5 · 절제 0.85 · 조급 0.9 · 실력 0.7) 위에. 실력·힘·조급은 샛별 값 그대로(0.78 · 1 · 0.78).
        //  속임 0.05(실용적 — 라트나 0.15) · 잇기 0.65(막은 뒤 되받기 확률 — 같은 값이 맞힌 뒤 잇기도 정한다) · 맞받기 0.3(상대가 칼을 드는 순간 먼저 치기) · 절제 0.7(다가오는 상대에 덜 물러남 — 라트나 0.84)
        level: { skill: 0.78, strength: 1, discipline: 0.7, aggression: 0.78, counter: 0.3, feint: 0.05, followUp: 0.65 },
        // 라트나(이베리아 기본 범위에서 굴린 간격 0.28~0.55·돌기 0.25~0.5 + 샛별 값)와 칸마다 갈리게 — 문서 §1-4 표:
        //  돌기 0.07(수문 앞 한 줄) · 간격 0.12(짧은 한손 칼 — 가까이) · 자세 고집 4.0 · 박자 4.2 s · 손 1.15 m/s(벤 칼을 곧 거둠) · 정확 0.86 · 맞받아 베기 0.45 · 겁 0.12 · 화 0.06 · 집념 0.18(쫓지 않음)
        pers: { precision: 0.86, guardStick: 4.0, guardSpeed: 1.15, rhythm: 4.2, margin: 0.12, circleRate: 0.07, vor: 0.45, aggr: 0.8, patienceTime: 10, fearful: 0.12, angry: 0.06, dogged: 0.18, guardPref: { sideR: 1.7, langort: 1.5 } },
        idle: { guard: 'sideR', gesture: 'still' }, // 시작 2초: 칼을 오른 허리 옆에 눕혀 든 채(요격세) 가만히 — 샛별·라트나의 '아래 탈류'와 갈림
      },
    },
    look: getLook('chanda'),
    lookVersion: CHARACTER_LOOK_VERSION.chanda,
    // 대사 (해요체 — 샛별 넷 + 하나씩. 수문지기가 길손에게: 길은 내주되 물길은 지킨다, 누구인지보다 무엇을 하려는지. 느낌표 없음)
    taunt: '지나가도 좋아요. 물길은 건드리지 마세요.',
    lines: {
      intro: ['지나가도 좋아요. 물길은 건드리지 마세요.', '비는 그쳤어도, 물은 아직 내려오고 있어요.', '누구인지는 묻지 않아요. 무엇을 하러 왔나요?'],
      win: ['이제 돌아가세요. 아래쪽에는 사람이 살아요.', '돌 하나에도 물이 가는 길이 달라져요.', '수문은 오늘도 제자리예요.'],
    },
  },
  // 병마용 — 샛별 저장소 origin/main 7684c732 의 characters_terracotta.js(b090ccc5 → 901b1f39 피 없음 → 5a242fa3 월의 혼 → 1890fdf1 대사 출처)에서 가져옴
  //  (사장님 10/14 18:3x · 19:4x 결정, docs/import/chanda_terra_port_2026-10-14.md):
  //  · 칭호 '구천의 혼'(사장님 결정 — 샛별 '돌아가지 못한 월의 혼') · 숙련도 2(사장님 결정) = 실력 숫자 normal · 동방 고유 동작 둘, 비기 없음 · 기질 값 없음(샛별 그대로 — 동방 기본 범위)
  //  · 몸 규칙 physiology(샛별 그대로 — 사장님 결정): 출혈 0 · 목 관절이 떨어져야만 죽음 · body 'clay' = 흙 알갱이·잔금·마른 타격음·흙 단면 갈래 표식
  //    (fighter.js · main.js onWound · effects.js · decap_fx.js · limb_fx.js · sound.js BodySounds — 이 표식이 없는 사람은 한 줄도 다르게 돌지 않는다)
  //  · 목소리 없음(VOICES.silent — 기합·신음·죽음 소리 없음). 머리·팔다리가 떨어질 때 흙이 부서지는 소리만(사장님 10/14 19:4x '머리나 팔 잘릴 때 부서지는 소리만')
  //  · 대사: 샛별이 만든 것 전부(시작 셋 · 이김 셋 — 「월인가」 두 줄 포함) + 추가 대사 문서 후보 넷(『사기』 「월왕구천세가」 — 구천·범려·오자서의 말)을 모두 (사장님 결정).
  //    샛별 데이터의 ASCII 큰따옴표는 뺐다 — 우리 화면이 둥근 따옴표를 붙인다. 출처(lineSources)는 대사 아래 줄에 작게(main.js · index.html #foeIntro small)
  {
    id: 'terracotta',
    name: '병마용',
    epithet: '구천의 혼', // 사장님 결정 10/14 (샛별 쪽 '돌아가지 못한 월의 혼')
    age: null,
    origin: '월의 유민이 깃든 진나라 토우 (창작)',
    backstory: '몸은 진의 무덤을 위해 빚었으나, 안에서 깨어난 것은 고향을 잃은 월의 유민들의 기억이다. 서쪽으로 실려 오던 행렬이 철불 절벽 아래 멈춘 뒤, 흙병사는 부서진 수레에서 월왕구천검을 거두었다. 돌아갈 월나라는 없고 원한을 물을 이름도 남지 않았다. 그는 낯선 발소리마다 회계의 치욕을 묻다가, 문득 한 배를 탔던 밤의 노래를 되뇐다. 월의 기억·진의 토우·후대의 사막 석굴을 엮은 창작이며, 진이 월을 멸했다는 뜻은 아니다.',
    want: '월왕의 검을 고향으로 돌려보내고, 지워진 월의 이름을 누군가에게 기억시키는 것.',
    school: '월왕구천검(들어오기 전까지는 간장)과 동방 유파의 쥠·자세·기술을 그대로 쓴다. 흙 갑옷 조각은 장식이라 강철 판금의 방어력이 없다.',
    temperament: '자기 말 대신 오래된 기록과 노래를 되풀이한다. 원한 사이로 고향을 향한 그리움이 새어 나온다.',
    movementNotes: '기존 성인 체격과 한손 칼의 걸음·팔다리 부상·래그돌 동작을 쓴다. 피를 흘리지 않고, 머리가 몸에서 떨어져야 쓰러진다. 목소리가 없어 머리나 팔다리가 떨어질 때 흙이 부서지는 소리만 난다.',
    weaknesses: '피를 흘리지 않아 오래 버티지만, 목을 지나가는 한 번의 베기나 머리를 꿰는 찌르기에는 그대로 무너진다. 잘린 팔다리는 돌아오지 않는다.',
    weapon: 'goujian', // 월왕구천검 (에픽 · 동방 · 능력 '와신상담: 다칠수록 공격력 증폭' — 사장님 10/14). 흙 몸이라 피는 안 줄지만 상처·팔다리 손상으로 와신상담이 오른다. 이식 때는 임시로 간장이었다
    voice: 'silent', // 목소리 없음 (sound.js VOICES.silent — mute)
    physiology: { body: 'clay', bleeds: false, deathRequiresHeadDetachment: true }, // 몸 규칙 (샛별 901b1f39 그대로 + 흙 몸 표식 — fighter.js HUMAN_BODY 위에 덮음)
    ai: {
      proficiency: 2, // 숙련도 (사장님 결정 10/14) — 실력 숫자 normal · 동방 고유 동작 둘(체보요격 · 좌익격), 비기는 5 에서만
      persona: {
        school: 'goujian', // 무기와 같이 (월왕구천검 — 동방 꾸러미)
        idle: { guard: 'pflugR', gesture: 'still' }, // 시작 2초: 칼자루를 오른 허리에, 칼끝은 배 높이로(탄복세) 가만히 (샛별 값 그대로)
      },
    },
    look: getLook('terracotta'),
    lookVersion: CHARACTER_LOOK_VERSION.terracotta,
    // 대사 — 『사기』 권41 「월왕구천세가」 · 『설원』 권11 「선설」(월인가)의 샛별 직역(고전 원문은 저작권 밖). 이긴 뒤 「월인가」 두 줄은 연가(그리움)이지 복수 군가가 아니다
    taunt: '너는 회계의 치욕을 잊었느냐?',
    lines: {
      intro: [
        '너는 회계의 치욕을 잊었느냐?', // 구천이 쓸개를 맛보며 스스로에게 (샛별)
        '오늘 밤은 무슨 밤인가.', // 「월인가」 첫 줄 (샛별)
        '오늘은 무슨 날이기에, 왕자와 한 배를 타는가.', // 「월인가」 (샛별)
        '나는 여기서 끝나는가?', // 추가 대사 후보 1 — 회계에서 곤경에 빠진 구천의 탄식
        '임금께서는 명을 행하시고, 신은 뜻을 행하겠습니다.', // 추가 대사 후보 2 — 떠나려는 범려가 구천에게
        '반드시 내 눈을 가져다 오나라 동문에 놓아, 월나라 군대가 들어오는 것을 보게 하라!', // 추가 대사 후보 3 — 오나라 신하 오자서의 마지막 말
      ],
      win: [
        '산에는 나무가 있고 나무에는 가지가 있건만.', // 「월인가」 끝 줄 앞 (샛별 — 이긴 뒤 부르는 옛 노래)
        '그대를 좋아하는 내 마음을 그대는 모르네.', // 「월인가」 끝 줄 뒤 (샛별 — 이긴 뒤 부르는 옛 노래)
        '너는 회계의 치욕을 잊었느냐?', // (샛별)
        '날아다니는 새가 없어지면 좋은 활을 감추고, 교활한 토끼가 죽으면 사냥개를 삶는다.', // 추가 대사 후보 4 — 범려가 대부 종에게 보낸 편지
      ],
    },
    // 대사 → 출처 (화면에 대사 아래 줄로 — 사장님 10/14 '출처까지 다 나오게 해'. lineSourceOf)
    lineSources: {
      '너는 회계의 치욕을 잊었느냐?': '『사기』',
      '오늘 밤은 무슨 밤인가.': '『설원』',
      '오늘은 무슨 날이기에, 왕자와 한 배를 타는가.': '『설원』',
      '산에는 나무가 있고 나무에는 가지가 있건만.': '『설원』',
      '그대를 좋아하는 내 마음을 그대는 모르네.': '『설원』',
      '나는 여기서 끝나는가?': '『사기』',
      '임금께서는 명을 행하시고, 신은 뜻을 행하겠습니다.': '『사기』',
      '반드시 내 눈을 가져다 오나라 동문에 놓아, 월나라 군대가 들어오는 것을 보게 하라!': '『사기』',
      '날아다니는 새가 없어지면 좋은 활을 감추고, 교활한 토끼가 죽으면 사냥개를 삶는다.': '『사기』',
    },
  },
];
CHARACTER_GUESTS.push(createReturnedKing(CHARACTERS.find(c=>c.id==='artoria')),createWhiteScaleWarrior(),...createRoyalConceptGuests(CHARACTERS.find(c=>c.id==='artoria')));
for (const c of CHARACTER_GUESTS) finishAI(c);

// Guests are declared after the base rotation. Register Ratna's visual variant
// here so no guest has to enter the random combat roster or change its AI.
const ratnaBase = CHARACTER_GUESTS.find(c => c.id === 'ratna');
const ratnaAlter = { ...ratnaBase, id: 'ratna_mad', variantOf: 'ratna', mad: true, appearanceOnly: true,
  name: `광기의 ${ratnaBase.name}`, ai: madVariantAI(ratnaBase), // 숙련도 +1 (사장님 10/16 22:3x — 모든 얼터)
  look: alterLook(ratnaBase.look, 'ratna'), lookVersion: `${ratnaBase.lookVersion}-alter4`, eyes: 'madGlow' };
finishAI(ratnaAlter);
CHARACTER_VARIANTS.push(ratnaAlter);

// ── 샛별 저장소에서 가져온 얼터 여섯 (사장님 10/16~17 결정 — 샛별 쪽 · docs/import/saetbyeol_round3_2026-10-17.md). 원본 시트를 복사해 겉모습만 바꾼다.
//  retainBaseStats: 실력 숫자 +20%(MAD_SCALE)를 받지 않는다 (aiAtProficiency) — 외양만이 아닌 김씨 · 아르토리아도 원본 실력 그대로.
//  숙련도 +1 은 아래 '얼터 숙련도 맞춤'이 채운다 (사장님 10/16 22:3x '모든 얼터' — 그쪽 판은 원본 숙련도 그대로였다)
// 밤 다섯째: 찬다는 외양만 · 김씨는 형의 칼(brothers_sword — 화면 이름 '황약사의 검')을 꺼내 든다 (무기만 바뀌고 성향 · 몸놀림 그대로)
for(const id of ['chanda','renji']){
 const base=[...CHARACTERS,...CHARACTER_GUESTS].find(c=>c.id===id);
 const alter={...base,id:id+'_mad',variantOf:id,mad:true,appearanceOnly:id==='chanda',retainBaseStats:true,
  name:`광기의 ${base.name}`,ai:JSON.parse(JSON.stringify(base.ai)),look:alterLook(base.look,id),lookVersion:base.lookVersion+'-alter1',eyes:'madGlow'};
 if(id==='renji'){
  alter.weapon='brothers_sword';alter.ai.persona.school='brothers_sword';
  alter.school='흰 천에 감싼 형의 칼을 한 손 둔기로 쓴다. 기존 김씨의 무유파 몸놀림과 성향을 유지한다.';
  alter.backstory='습격의 흔적이 남은 산길에 혼자 서 있다. 형의 칼을 꺼냈지만 불살을 지키려 흰 천을 풀지 않았다. 날 대신 천으로 감싼 긴 몸으로 길을 지킨다.';
  alter.movementNotes='기존 한손 둔기 동작에 새 무기의 길이·무게·실측 간격을 적용한다. 적극성과 보법은 강화하지 않는다.';
  alter.weaknesses='가시 찌르기와 갑옷 무시 효과가 없는 둔기. 길게 휘두른 뒤의 빈틈을 조심해야 한다.';
  alter.signatureMoves='형의 칼을 한 손으로 휘둘러 밀어낸다. 천에 싸인 날은 베거나 찌르지 않는다.';
  alter.taunt='오늘은 이 칼을 쓰겠네.';
  alter.lines={intro:['오늘은 이 칼을 쓰겠네.','차를 권할 때는 지났네.'],win:['…형에게 돌려줄 말이 늘었군.']};
 }
 finishAI(alter);CHARACTER_VARIANTS.push(alter);
}

// 밤 여섯째 (철불 절벽 — 오·월 망령): 채색 갑옷 · 창백한 사람 얼굴 · 흰 망토. 외양만 — 원래 몸 · 전투 그대로
const terracottaBase=CHARACTER_GUESTS.find(c=>c.id==='terracotta');
const terracottaAlter={...terracottaBase,id:'terracotta_mad',variantOf:'terracotta',mad:true,appearanceOnly:true,
 name:`광기의 ${terracottaBase.name}`,ai:JSON.parse(JSON.stringify(terracottaBase.ai)),
 look:alterLook(terracottaBase.look,'terracotta'),lookVersion:terracottaBase.lookVersion+'-alter2',eyes:'madGlow'};
finishAI(terracottaAlter);CHARACTER_VARIANTS.push(terracottaAlter);

// 다라이시 흑의 얼터 (사장님 10/16 승인 — 샛별 쪽). 잃어버린 이름은 설정에만 둔다 (화면에 안 나옴)
const daraishiBase=CHARACTER_GUESTS.find(c=>c.id==='silver_wanderer');
const daraishiAlter={...daraishiBase,id:'silver_wanderer_mad',variantOf:'silver_wanderer',mad:true,appearanceOnly:true,
 name:`광기의 ${daraishiBase.name}`,ai:JSON.parse(JSON.stringify(daraishiBase.ai)),
 look:alterLook({...getLook('silver_wanderer','v7-silver-c'),daraishiBlack:1},'silver_wanderer'),lookVersion:'v7-alter2',eyes:'madGlow',
 backstory:'흑의에 애쉬 실버 머리의 검사. 머리 뒤에는 짧고 해진 붉은 끈이 묶여 있다. 무엇을 기억하려는 매듭인지 자신도 알지 못한다. 이름을 잃어도, 검을 쥐는 손은 망설이지 않는다.'};
finishAI(daraishiAlter);CHARACTER_VARIANTS.push(daraishiAlter);

// 마야 · 아르토리아: 원본 무기 · AI 그대로. 아르토리아는 갑옷 없는 궁정 예복이라 실제 판금도 벗는다
//  (사장님 10/16 승인 예외 — 샛별 쪽: 방어 11 → 0 · 갑옷 감속 없음, outfit_alter.js alterLook). 실력 숫자 덧셈 없음
for(const id of ['samira','artoria']){
 const base=[...CHARACTERS,...CHARACTER_GUESTS].find(c=>c.id===id);
 // 얼터 마야는 늘 세이버(사장님 10/20 00:4x '얼터 마야는 항상 세이버를 들고 나오도록') — 빼 둔 무기(RETIRED)라도 인물은 든다
 const alter={...base,...(id==='samira'?{weapon:'sabre',weaponAlt:null}:{}),id:id+'_mad',variantOf:id,mad:true,appearanceOnly:id==='samira',retainBaseStats:true,
  name:`광기의 ${base.name}`,ai:JSON.parse(JSON.stringify(base.ai)),
  look:alterLook(base.look,id),lookVersion:base.lookVersion+(id==='artoria'?'-alter13':'-alter1'),eyes:'madGlow'};
 finishAI(alter);CHARACTER_VARIANTS.push(alter);
}

// 얼터 숙련도 맞춤 (사장님 10/16 22:3x "모든 얼터에 숙련도+1을 잊지 말고 적용해 두도록 해"): 변형(variantOf)은 모두 원본 숙련도 +1(상한 AI_PROFICIENCY.max).
//  시트를 복사해 만든 새 얼터가 +1 을 빠뜨려도 여기서 맞추고 실력 숫자·유파 표를 다시 채운다 (이미 맞으면 손대지 않음 — 광기의 하인리히 등)
for (const c of CHARACTER_VARIANTS) {
  const base = [...CHARACTERS, ...CHARACTER_GUESTS].find((x) => x.id === c.variantOf);
  const want = base ? Math.min(AI_PROFICIENCY.max, base.ai.proficiency + VARIANT_PLUS) : c.ai.proficiency;
  if (c.ai.proficiency !== want) {
    c.ai.proficiency = want;
    finishAI(c);
  }
}

/** id → 시트. 기본 회전·변형·손님 인물까지 (변형은 여정의 정해진 자리·?foe=id, 손님 인물은 여정의 제 무대(STAGE_FOE)·테스트 경로의 상대 고르기·?foe=id) */
export const CHARACTERS_BY_ID = Object.fromEntries([...CHARACTERS, ...CHARACTER_VARIANTS, ...CHARACTER_GUESTS].map((c) => [c.id, c]));

/**
 * 이번 판에 캐릭터가 실제로 드는 무기 id. weaponAlt 가 있으면 그 확률로 대체 무기를 고른다.
 *  pick 'shortest_common': 커먼 등급·날 있는 무기 중 칼날이 가장 짧은 것 (무기 로스터가 바뀌어도 그때그때 고른다)
 */
export function pickCharacterWeapon(char, rnd = Math.random) {
  const alt = char.weaponAlt;
  if (!alt || rnd() >= alt.chance) return char.weapon;
  if (alt.pick === 'shortest_common') {
    const pool = WEAPON_LIST.filter((w) => w.tier === 'common' && w.edged && w.strayPick !== false); // strayPick false = 주울 칼 후보에서 뺌 (打刀 제안 가지)
    if (pool.length) return pool.reduce((a, b) => (b.bladeLength < a.bladeLength ? b : a)).id;
  }
  return alt.pick in WEAPONS ? alt.pick : char.weapon;
}

/**
 * 캐릭터 대사 한 줄을 무작위로 (감독 지시: 시작할 때와 이길 때 3종씩 랜덤, 죽으면 말이 없다. 광기의 하인리히는 사장 지시로 우선 1종씩).
 *  key: 'intro' | 'win' (그 밖의 키도 lines에 있으면 쓴다). 없으면 taunt, 그것도 없으면 ''
 */
export function randomLine(char, key) {
  const arr = char?.lines?.[key];
  if (Array.isArray(arr) && arr.length) return arr[Math.floor(Math.random() * arr.length)];
  return char?.taunt || '';
}

/** 대사 한 줄의 출처 (시트 lineSources — 지금은 병마용의 고전 인용 『사기』·『설원』뿐). 없으면 '' — 화면이 대사 아래 줄에 작게 적는다 (main.js) */
export function lineSourceOf(char, line) {
  return (line && char?.lineSources?.[line]) || '';
}

/** id가 없거나 목록에 없으면 무작위 캐릭터 (excludeId가 있으면 그 캐릭터는 뺀다) */
export function randomCharacter(excludeId) {
  const pool = CHARACTERS.filter(c=>c.id!==excludeId && !WANDER_EXCLUSIVE.includes(c.id));
  return pool[Math.floor(Math.random() * pool.length)];
}

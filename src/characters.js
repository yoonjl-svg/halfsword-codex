// ─────────────────────────────────────────────────────────────
//  상대 캐릭터 5인: 저마다 다른 유파·성격·자세 전환 습관을 가진 검객들.
//
//  ai.persona가 ai.js의 AI 클래스에 그대로 전달된다:
//   - level: AI_LEVELS(난이도) 숫자 위에 캐릭터별로 덮어쓰는 값 (반응 시간·막기 확률·읽는 눈·힘 등)
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
import { AI_LEVELS } from './config.js'; // 변형의 실력 숫자를 원본 실효값에서 계산할 때만 읽는다 (config.js는 아무것도 import하지 않아 순환이 없다)
import { EXPANSION_CHARACTERS } from './characters_expansion.js';

export const CHARACTERS = [
  // ───────────────────────────────────────────── 1. 쉬움 : 촌뜨기 난동꾼 ─────────────────────────────────────────────
  {
    id: 'bran',
    name: '오소리 브란',
    epithet: '나무꾼',
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
      level: 'easy',
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
    taunt: '젠장! 이런 막대기 뿐이라니.',
    // 상황별 대사 (docs/character_lore.md). 화면에 어떻게 띄울지는 UI 설계 몫
    lines: {
      intro: ['젠장! 이런 막대기 뿐이라니.', '은화 열 닢! 열 닢이라고 했지?', '자세? 힘이 최고야.'],
      attack: ['받아라아!', '이거나 먹어!', '장작이다, 장작!'],
      hurt: ['아야… 아야! 이거 진짜 칼이잖아!', '피… 피 난다…', '야, 야, 잠깐만—'],
      winning: ['하하! 봤지? 봤냐고!', '검객이라며! 검객이라며!'],
      losing: ['그, 그만… 은화는 됐어…', '오지 마. 오지 말라고.', '엄마…'],
      win: ['은화! 은화 어딨어!', '…내가 이겼나? 내가 이겼다!', '장작패기보다 쉽구나, 널 패는 게.'],
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
      level: 'easy',
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
      level: 'normal',
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
      '자세를 매우 자주(1.3초 안팎) 바꾸고, 먼 자세로도 서슴없이 건너뛴다(guardStick 낮음) — 그런데 브란이나 랴오와 달리 이건 계산된 눈속임이다(feint·followUp이 모두 높다). ' +
      '간격을 바짝 좁혀 상대를 압박하고(margin 작음), 달려드는 상대를 물러나지 않고 맞받는다(vor 높음).',
    weaknesses: '인내심이 짧아(patienceTime 짧음) 판이 길어지면 먼저 무리하게 들어온다. 확신이 너무 강해 같은 유인책(가짜 공격)에 두 번 걸리면 오히려 더 큰 동작으로 반응해 큰 빈틈을 남긴다.',
    // 하인리히는 복제품을 유지한다. 진품은 플레이어와 새 소유자 아르토리아가 사용한다.
    weapon: 'excalibur_replica',
    ai: {
      level: 'normal',
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
        close: { rate: 0.6, kind: 'barge', then: 'cut' }, // 물러나지 않고 몸으로 밀고 들어가 칼자루로 누른다
      },
    },
    look: getLook('heinrich'),
    lookVersion: CHARACTER_LOOK_VERSION.heinrich,
    taunt: '무릎 꿇어라. 왕의 검 앞이다.', // 안하무인의 광인 (감독 지시로 대사 전부 교체)
    lines: {
      intro: ['무릎 꿇어라. 왕의 검 앞이다.', '베인다! 베인다! 하하하!', '이름 따위 필요 없다. 넌 곧 잊힌다.'],
      attack: ['죽어라!', '더! 더 피를 내놔라!', '하하하! 도망쳐 봐라!'],
      hurt: ['감히… 감히 나를?!', '이 피는 내 것이 아니다. 아니야!', '하찮은 것이…!'],
      winning: ['봐라! 이게 나다!', '기어라. 기어서 살려 달라 해라!'],
      losing: ['말도 안 돼… 내가?', '가짜? 가짜라고?! 닥쳐!', '아직이다. 나는 아직 서 있다.'],
      win: ['흔한 버러지였구나.', '기어서 살려 달라 하랬지. …아, 이제 못 기는군.', '너 같은 놈들을 수도 없이 봐 왔지.'], // 감독 확정
      lose: ['…거짓말이야. 내가…', '나는… 쓰러지지 않아…'],
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
      level: 'hard',
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
];

// ───────────────────────────────────────────── 변형 캐릭터 — 여정의 한 자리에만 나온다 ─────────────────────────────────────────────
//  CHARACTERS(다섯) 밖에 둔다: 기본 회전(randomCharacter)·시뮬 라운드로빈에는 들어가지 않고, id로만 불린다
//  (stages.js STAGE_FOE 짝·?foe=id). 원본 시트를 복사해 만들며, 원본은 건드리지 않는다.
const HEINRICH = CHARACTERS.find((c) => c.id === 'heinrich');

// 광기의 하인리히 실력 숫자 (사장 확정 2026-09-28: "능력치는 원래의 하인리히 +20%").
//  출발점은 낮의 하인리히가 게임에서 실제로 받는 값 = AI_LEVELS[ai.level] 위에 persona.level을 덮은 것 (ai.js setLevel과 같은 병합).
//  그래서 하인리히 시트에 없는 chamberSpeed·parrySpeed·predict도 normal 기본값에서 같이 올리고, 결과는 열다섯 키를 모두 적는다.
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
// 성격(pers)·유파(school)·난이도 이름('normal')은 하인리히 그대로 깊은 복사하고, persona.level만 바꿔 끼운다.
//  지금 값: reaction .175 · windup .375 · chamberSpeed 3.6 · strikeSpeed 15.6 · parrySpeed 5.4 · guardChance .792 · predict .9 · counter .384 ·
//   feint .552 · followUp .864 · read .864 · discipline .9 · strength 1.38 · aggression 1.15(그대로) · skill .984
//  strikeSpeed·chamberSpeed·parrySpeed·strength는 손 목표 필터·관절 속도 한계에 막혀 체감은 +20%보다 작다 (docs/characters.md)
const HEINRICH_MAD_AI = JSON.parse(JSON.stringify(HEINRICH.ai));
HEINRICH_MAD_AI.persona.level = scaledLevel(HEINRICH.ai, MAD_SCALE);
// 온몸 타격 기질(초안, 캐릭터 PM): 낮보다 더 싣고 더 자주 감고, 물러날 줄을 모른다 — 비켜서기 대신 맞받는다
HEINRICH_MAD_AI.persona.whole = { sPref: 0.9, sSpread: 0.1, windRate: 0.8, windLen: [0.25, 0.5], punish: { windup: 0.5, overrun: 0.65, thrown: 0.6 }, evade: 0.15 };
HEINRICH_MAD_AI.persona.idle = { guard: 'langort', gesture: 'still' }; // 시작 2초: 칼끝을 겨눈 채 흔들림 없음
HEINRICH_MAD_AI.persona.close = { rate: 0.9, kind: 'barge', then: 'cut' }; // 밀고 들어가는 것만 한다
export const CHARACTER_VARIANTS = [
  // 4b. 광기의 하인리히 도른 — 밤의 포세이돈 신전에 다시 나타나는 하인리히 (사장 요청, 디렉터 14:08).
  //  붉은 눈·안광 아우라는 외형 담당 몫이고, 여기서는 eyes 표식만 둔다.
  //  사장 확정(2026-09-28): 별칭 '밤의 왕', 대사는 우선 등장·승리 1종씩, 실력 숫자는 낮의 하인리히 +20% (HEINRICH_MAD_AI).
  //  성격(pers)·유파·감정 문턱·외형·무기·목소리(variantOf)는 낮의 하인리히 그대로다. 설정은 docs/character_lore.md §4b
  {
    ...HEINRICH,
    id: 'heinrich_mad',
    variantOf: 'heinrich',
    name: '광기의 하인리히 도른',
    epithet: '밤의 왕', // 사장 확정 (원본 별칭 '미치광이'와 겹치지 않는다)
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
    look: HEINRICH.look,
    lookVersion: HEINRICH.lookVersion,
    eyes: 'madGlow', // 외형 담당과 맞춘 표식: 붉은 눈 + 안광 아우라
  },
];

/** id → 시트. 다섯 명과 변형까지 (변형은 여정의 정해진 자리·?foe=id 로만 나온다) */
export const CHARACTERS_BY_ID = Object.fromEntries([...CHARACTERS, ...CHARACTER_VARIANTS, ...EXPANSION_CHARACTERS].map((c) => [c.id, c]));

/**
 * 이번 판에 캐릭터가 실제로 드는 무기 id. weaponAlt 가 있으면 그 확률로 대체 무기를 고른다.
 *  pick 'shortest_common': 커먼 등급·날 있는 무기 중 칼날이 가장 짧은 것 (무기 로스터가 바뀌어도 그때그때 고른다)
 */
export function pickCharacterWeapon(char, rnd = Math.random) {
  const alt = char.weaponAlt;
  if (!alt || rnd() >= alt.chance) return char.weapon;
  if (alt.pick === 'shortest_common') {
    const pool = WEAPON_LIST.filter((w) => w.tier === 'common' && w.edged);
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

/** id가 없거나 목록에 없으면 무작위 캐릭터 (excludeId가 있으면 그 캐릭터는 뺀다) */
export function randomCharacter(excludeId) {
  const pool = excludeId ? CHARACTERS.filter((c) => c.id !== excludeId) : CHARACTERS;
  return pool[Math.floor(Math.random() * pool.length)];
}

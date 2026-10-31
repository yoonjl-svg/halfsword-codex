// 롤랑 — 돌아온 왕 (샛별 저장소 전달본 977c2a43 — 그쪽 id 'sebastian' · 들여오며 id 를 이름에 맞춤, docs/import/wander_heroes_import_2026-10-23.md)
//  손님 인물(characters.js CHARACTER_GUESTS — 무작위 회전 밖) · 방랑 전용(wander_rules.js WANDER_EXCLUSIVE — 일반 여정 무대에는 나오지 않는다).
//  겉모습 · 이야기는 샛별 쪽 승인 판. 숙련도는 6(사장님 10/24 01:1x '롤랑과 베르나르도는 6' — 전 4 · config AI_PROFICIENCY 6 칸).
//  기질은 제 것 (사장님 10/29 15:5x '롤랑과 베르나르도의 성향과 캐릭터를 분화해서 싸움 스타일도 바꾸도록 해' — 전: 아르토리아의 실력 숫자 · 성격을 빌림 · 자세 · 기술 취향만 지움.
//   근거 · 잰 것: docs/characters/temperament_2026-10-29.md §7-3 · 확인표 2806). 아르토리아 시트는 그대로다.
//  무기 = 뒤랑달 (사장님 10/24 — 샛별 저장소 c039bcc7 에서 들여온 이베리아 레전드 · docs/import/durandal_import_2026-10-24.md): AI 꾸러미도 뒤랑달(schools.js — 스펙 school 'iberian'
//   · 무거운 틀이라 츠바이핸더와 같은 이베리아 몬탄테 동작 · 간격은 weapon_measured.js 뒤랑달 줄). 10/23 저녁 ~ 10/24 는 츠바이핸더(임시), 방랑 전달본은 티소나였다
import { getLook, CHARACTER_LOOK_VERSION } from './looks.js';

export function createRoland() {
  // 론세스바예스의 마지막 싸움 (롤랑의 노래 — 뿔나팔 올리판을 끝까지 불지 않은 자존심 · 뒤랑달 · 후위의 마지막 버팀):
  //  물러나지 않는다(공포 0.05 · 달려드는 상대를 맞받음 vor 0.65) · 도움을 청하지 않는 자존심 — 속임을 거의 쓰지 않고(feint 0.08) 막히면 발끈한다(분노 0.45) · 끝까지 버틴다(집념 0.6).
  //  몬탄테의 넓은 자리에서(간격 0.4 · 돌기 0.3 — 이베리아 범위) 아래 탈류로 칼을 되찾아 양쪽 가로베기 · 올려베기를 잇고(favoriteGuards '아래 탈류에서 칼을 되찾고, 양쪽 베기를 잇는다'),
  //  맞받은 칼을 바깥으로 쳐내 되받는다(signatureMoves — 이어 치기 0.7). 행군처럼 서두르지 않는다(인내 9 s · 박자 3.6 s). 큰 칼과 판금이라 준비가 크다(windup 0.8 — weaknesses '무거운 판금과 큰 검의 회수')
  const ai = {
    proficiency: 6, // 사장님 10/24 01:1x — 이베리아 숙련도 6 (실력 이름 hard · 반응 0.05 s · 고유 특성 적극성 1.6 — 6 칸 수는 사장님 확인 전 · AI 이베리아 비기 싱지르는 10/24 부터 열림 — aiOpenSchools 'iberian' · 숙련도 5 이상)
    persona: {
      school: 'durandal', // 유파 꾸러미 id = 무기 id (10/24 — 전 'zweihander')
      level: { guardChance: 0.75, counter: 0.3, feint: 0.08, followUp: 0.7, read: 0.75, discipline: 0.95, strength: 1.1, aggression: 0.85, windup: 0.8, skill: 0.85 },
      pers: {
        precision: 0.85, guardStick: 3.2, fearful: 0.05, angry: 0.45, dogged: 0.6, guardSpeed: 0.8, rhythm: 3.6, margin: 0.4, aggr: 0.95, vor: 0.65, patienceTime: 9, circleRate: 0.3,
        spinHold: true, // 싱지르를 무장하면 칼끝 거리에서 기다려 상대가 들어오게 한다(기본값 그대로 — 골짜기를 지킨 후위) · 베르나르도는 false
        guardPref: { wechselR: 1.8, wechselL: 1.6, langort: 1.1 }, // 아래 탈류 · 아래 레베스에서 칼을 되찾는다 · 곧은 자세
        techPref: { zwerch: 1.4, zwerchL: 1.4, unterhau: 1.3, unterhauL: 1.3, stichOchs: 0.6, stichOchsL: 0.6 }, // 넓은 가로베기 · 올려베기로 앞길을 닫는다 · 높이 찌르기는 덜
      },
      idle: { guard: 'wechselR', gesture: 'still' },
      close: { rate: 0.3, kind: 'barge', then: 'cut' }, // 판금 어깨로 밀어 떼고 벤다 (전: 아르토리아 0.25 그대로)
    },
  };
  return {
    id: 'roland',
    name: '롤랑',
    epithet: '왕', // 사장님 10/24 02:4x '셋 다 칭호는 왕으로 해' (아르토리아 · 롤랑 · 베르나르도 — 전 '돌아온 왕')
    age: null,
    origin: '이베리아 서쪽 · 바다 너머에서 사라진 왕국',
    // 설정 맞춤 (사장님 10/29 15:5x '설정 어긋나는 부분은 신화와 전설을 풍성하게 해석하되 서로 모순되지 않도록 해. 어쨌든 셋 다 왕은 왕인 걸로.'):
    //  베르나르도 시트('론세스바예스 골짜기에서 … 롤랑을 쓰러뜨렸다고 전해진다')와 이 시트의 '바다 너머에서 사라진 왕국'을 잇는 앞 세 문장 · 끝 한 문장을 더함 — 있던 네 문장은 그대로.
    //  롤랑의 노래(뿔나팔 올리판 — 겉모습 v2 허리의 상아 뿔피리) · '돌아올 왕' · 일곱 도시의 섬(안틸리아). 전 → 후 표: docs/characters/temperament_2026-10-29.md §7-4
    backstory: '론세스바예스 골짜기에서 그는 뿔나팔을 너무 늦게 불었다. 도움을 청하는 것을 수치로 여긴 탓이었다. 안개 속에서 온 배가 쓰러진 그와 후위의 기사들을 서쪽 바다로 실어 갔고, 그 배 위에서 기사들은 그를 왕이라 불렀다. 왕이 군대를 이끌고 바다를 건넌 뒤, 누구도 돌아오지 않았다. 오랜 세월이 지나 안개가 성문을 덮은 밤, 왕의 문장을 새긴 기사가 홀로 돌아왔다. 상아빛 갑옷과 포도주색 망토는 출정하던 날 그대로였으나, 얼굴을 가린 투구는 끝내 열리지 않았다. 그를 뒤따르던 군대가 어디에 있는지, 귀환한 것이 정말 왕인지 아는 이는 없다. 뱃사람들은 바다 너머 그 왕국을 해도에서 사라진 일곱 도시의 섬이라 부른다.',
    want: '돌아오지 못한 군대의 길을 다시 여는 것. 그 길이 고향으로 이어지는지는 말하지 않는다.',
    school: '큰 양손검을 든 이베리아 몬탄테 검객. 기존 유파 몸꼴·보법·탈류와 레베스 쳐내기를 사용한다.',
    signatureMoves: '넓은 베기로 앞길을 닫고, 맞받은 칼을 바깥으로 쳐낸다.',
    favoriteGuards: '아래 탈류에서 칼을 되찾고, 양쪽 베기를 잇는다.',
    temperament: '승리한 왕의 위엄을 잃지 않았으나, 상대를 보는지 그 너머의 행군을 보는지 알 수 없다.',
    movementNotes: '새 전용 기술 없이 기존 이베리아 동작과 판금 감속을 적용한다. 전투 수치는 검토용 시작값이다.',
    weaknesses: '무거운 판금과 큰 검의 회수. 목은 기존 판금 규칙대로 보호하지 않는다.',
    weapon: 'durandal', // 롤랑의 성검 (사장님 10/24 — 전 츠바이핸더 임시)
    voice: 'bran', // 목소리: 브론 오소리 묶음(브론과 같이 — 사장님 10/24 13:0x '롤랑 사운드셋은 브론의 것을 같이 쓸게' · 전 'tome')
    // 버티는 힘 +10 % (사장님 10/24 01:5x '롤랑과 베르나르도는 체력도 +10%') — 10/29 22:4x 부터 시트에 적지 않고 숙련도 6 규칙이 준다(characters.js · config PROF6_VITALITY 1.1)
    ai,
    look: getLook('roland'),
    lookVersion: CHARACTER_LOOK_VERSION.roland, // v2 (10/23 줄이면서 다듬은 판) — 옛 판 ?look=roland:v1
    taunt: '성문을 열어라. 아직 돌아올 자들이 있다.',
    lines: {
      intro: ['성문을 열어라. 아직 돌아올 자들이 있다.', '…너도 저 발소리가 들리느냐.'],
      attack: ['길을 비켜라.'],
      hurt: ['…아직이다.'],
      win: ['행군을 멈출 수는 없다.'],
      lose: ['그들은… 어디에…'],
    },
  };
}

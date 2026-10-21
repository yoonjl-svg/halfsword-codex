import {getLook} from './looks.js';

// Review guest only. Approved appearance/story; strength and final journey slot
// are not tuned here. Reuse the existing proficiency-4 boss's numeric profile,
// but let the native Iberian school choose its own guards and techniques.
export function createReturnedKing(baseline) {
  const ai=JSON.parse(JSON.stringify(baseline.ai));
  ai.persona.school='tizona';
  delete ai.persona.pers.guardPref;
  delete ai.persona.pers.techPref;
  ai.persona.idle={guard:'wechselR',gesture:'still'};
  return {
    id:'sebastian',name:'세바스티앙',epithet:'돌아온 왕',age:null,
    origin:'이베리아 서쪽 · 바다 너머에서 사라진 왕국',
    backstory:'왕이 군대를 이끌고 바다를 건넌 뒤, 누구도 돌아오지 않았다. 오랜 세월이 지나 안개가 성문을 덮은 밤, 왕의 문장을 새긴 기사가 홀로 돌아왔다. 상아빛 갑옷과 포도주색 망토는 출정하던 날 그대로였으나, 얼굴을 가린 투구는 끝내 열리지 않았다. 그를 뒤따르던 군대가 어디에 있는지, 귀환한 것이 정말 왕인지 아는 이는 없다.',
    want:'돌아오지 못한 군대의 길을 다시 여는 것. 그 길이 고향으로 이어지는지는 말하지 않는다.',
    school:'티소나를 든 이베리아 몬탄테 검객. 기존 유파 몸꼴·보법·탈류와 레베스 쳐내기를 사용한다.',
    signatureMoves:'넓은 베기로 앞길을 닫고, 맞받은 칼을 바깥으로 쳐낸다.',
    favoriteGuards:'아래 탈류에서 칼을 되찾고, 양쪽 베기를 잇는다.',
    temperament:'승리한 왕의 위엄을 잃지 않았으나, 상대를 보는지 그 너머의 행군을 보는지 알 수 없다.',
    movementNotes:'새 전용 기술 없이 기존 이베리아 동작과 판금 감속을 적용한다. 전투 수치는 검토용 시작값이다.',
    weaknesses:'무거운 판금과 큰 검의 회수. 목은 기존 판금 규칙대로 보호하지 않는다.',
    weapon:'tizona',voice:'tome',ai,look:getLook('sebastian'),lookVersion:'v2',
    taunt:'성문을 열어라. 아직 돌아올 자들이 있다.',
    lines:{
      intro:['성문을 열어라. 아직 돌아올 자들이 있다.','…너도 저 발소리가 들리느냐.'],
      attack:['길을 비켜라.'],hurt:['…아직이다.'],
      win:['행군을 멈출 수는 없다.'],lose:['그들은… 어디에…'],
    },
  };
}

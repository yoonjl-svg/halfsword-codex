import {getLook} from './looks.js';
import {createReturnedKing} from './character_returned_king.js';
// Model review guests. The third costume was the original Sebastian concept;
// keep it separately identifiable, without replacing the approved ivory king.
export function createRoyalConceptGuests(baseline){
 const base=createReturnedKing(baseline);
 return [
  {...structuredClone(base),id:'bernardo',name:'베르나르도',epithet:'사슬의 영웅 · 2번 시안',origin:'이베리아 · 베르나르도 델 카르피오 전승을 바탕으로 한 시안',look:getLook('bernardo'),lookVersion:'v1',backstory:'아버지를 풀어 주겠다는 왕의 약속을 믿고 싸운 영웅. 돌아온 것은 이미 식어 버린 몸이었다. 왼팔에는 끊어진 족쇄 한쪽을 매달았다. 전승에서 출발한 외형·서사 시안이다.',want:'끝내 이행되지 않은 약속의 대가를 묻는 것.',temperament:'말수가 적고 엄격한 중년의 전사.',taunt:'약속은 아직 끝나지 않았다.',lines:{intro:['약속은 아직 끝나지 않았다.'],attack:['물러서라.'],hurt:['…아직이다.'],win:['문을 열어라.'],lose:['너무… 늦었나.']}},
  {...structuredClone(base),id:'black_king',name:'올리비에',epithet:'롤랑의 오른팔',origin:'남부 이베리아',look:getLook('black_king'),lookVersion:'v4',backstory:'롤랑의 오랜 벗이자 오른팔. 볕에 그을린 얼굴과 풍성한 검은 수염을 감추지 않는다. 먹빛 갑옷과 짙은 노란 어깨 망토에는 함께 지나온 전장의 흔적이 남아 있다.',want:'벗이 돌아갈 길을 지키는 것.',temperament:'말보다 행동이 먼저인 침착하고 강인한 전사.',weaknesses:'투구를 쓰지 않아 머리가 드러난다. 목은 기존 판금 규칙대로 보호하지 않는다.',taunt:'그의 곁은 내가 지킨다.',lines:{intro:['그의 곁은 내가 지킨다.'],attack:['물러서라.'],hurt:['…아직이다.'],win:['길은 열려 있다.'],lose:['롤랑…']}},
 ];
}

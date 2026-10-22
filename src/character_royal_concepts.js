import {getLook} from './looks.js';
import {createReturnedKing} from './character_returned_king.js';
// Model review guests. The third costume was the original Sebastian concept;
// keep it separately identifiable, without replacing the approved ivory king.
export function createRoyalConceptGuests(baseline){
 const base=createReturnedKing(baseline);
 return [
  {...structuredClone(base),id:'black_king',name:'올리비에',epithet:'롤랑의 오른팔',origin:'남부 이베리아',look:getLook('black_king'),lookVersion:'v4',backstory:'롤랑의 오랜 벗이자 오른팔. 볕에 그을린 얼굴과 풍성한 검은 수염을 감추지 않는다. 먹빛 갑옷과 짙은 노란 어깨 망토에는 함께 지나온 전장의 흔적이 남아 있다.',want:'벗이 돌아갈 길을 지키는 것.',temperament:'말보다 행동이 먼저인 침착하고 강인한 전사.',weaknesses:'투구를 쓰지 않아 머리가 드러난다. 목은 기존 판금 규칙대로 보호하지 않는다.',taunt:'그의 곁은 내가 지킨다.',lines:{intro:['그의 곁은 내가 지킨다.'],attack:['물러서라.'],hurt:['…아직이다.'],win:['길은 열려 있다.'],lose:['롤랑…']}},
 ];
}

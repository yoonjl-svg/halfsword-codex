import {getLook} from './looks.js';
import {createReturnedKing} from './character_returned_king.js';
// Model review guests. The third costume was the original Sebastian concept;
// keep it separately identifiable, without replacing the approved ivory king.
export function createRoyalConceptGuests(baseline){
 const base=createReturnedKing(baseline);
 return [
  {...structuredClone(base),id:'bernardo',name:'베르나르도',epithet:'사슬의 영웅 · 2번 시안',origin:'이베리아 · 베르나르도 델 카르피오 전승을 바탕으로 한 시안',look:getLook('bernardo'),lookVersion:'v1',backstory:'아버지를 풀어 주겠다는 왕의 약속을 믿고 싸운 영웅. 돌아온 것은 이미 식어 버린 몸이었다. 왼팔에는 끊어진 족쇄 한쪽을 매달았다. 전승에서 출발한 외형·서사 시안이다.',want:'끝내 이행되지 않은 약속의 대가를 묻는 것.',temperament:'말수가 적고 엄격한 중년의 전사.',taunt:'약속은 아직 끝나지 않았다.',lines:{intro:['약속은 아직 끝나지 않았다.'],attack:['물러서라.'],hurt:['…아직이다.'],win:['문을 열어라.'],lose:['너무… 늦었나.']}},
  {...structuredClone(base),id:'black_king',name:'검은 왕',epithet:'왕실 갑주 · 3번 시안',origin:'이베리아 · 앞서 제시한 세 번째 외형 시안',look:getLook('black_king'),lookVersion:'v3',backstory:'먹빛 금장 갑옷과 광택 없는 노란 의장 망토를 두른 젊은 왕. 기존 세바스티앙에 채택했던 서사의 원래 외형 시안을 따로 모델링한 비교용 인물이다. 독립 인물의 정식 이름·서사는 아직 정하지 않았다.',want:'외형 검토 중.',temperament:'화려한 왕실 갑주와 대조되는 침착한 젊은 얼굴.',taunt:'성문을 열어라.'},
 ];
}

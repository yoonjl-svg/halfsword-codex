import {JULIA_LOOK} from './outfit_julia.js';

export function createJulia() {
  return {
    id:'julia',name:'쥘리아 크리스테바',epithet:'상인',age:null,
    school:'이탈리아 유파',weapon:'rapier', // Common rapier for the native appearance review.
    look:{...JULIA_LOOK},lookVersion:'v1-native',voice:'silent',
    ai:{proficiency:4,persona:{school:'rapier',pers:{}}},
    reviewOnly:true,
    backstory:'붉은 머릿수건과 녹색 조끼를 입은 활달한 상인. 상세 서사는 미정.',
    movementNotes:'기존 이탈리아 유파 몸꼴·보법과 숙련도4를 사용한다.',
    taunt:'',lines:{intro:[],win:[]},
  };
}

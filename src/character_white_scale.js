import {getLook} from './looks.js';

// Review guest. Name and full story remain provisional; owner chose a Mongol
// warrior trained in the Japanese school. No new school moves or strength buff.
export function createWhiteScaleWarrior() {
  return {
    id:'white_scale',name:'백린의 전사',epithet:'초원의 검객',age:null,
    origin:'몽골의 초원 · 일본에서 검술을 배운 전사',
    backstory:'몽골에서 태어나 동쪽 바다를 건너 일본 검술을 배운 전사. 큰 검은 뿔과 은빛 갑찰, 붉은 끈으로 장식된 갑옷을 입는다. 이름과 자세한 사연은 아직 정하지 않은 시안이다.',
    want:'미정. 현재는 외형과 일본 검술을 사용하는 설정을 검토한다.',
    school:'일본 유파. 기존 몸꼴·보법·막기와 흘림을 사용한다.',
    signatureMoves:'일본 유파의 기본 베기와 찌르기, 기존 흘림.',
    favoriteGuards:'기존 일본 유파의 자세 선택을 따른다.',
    temperament:'가면 아래 표정을 드러내지 않는 침착한 전사.',
    movementNotes:'갑찰은 기존 판금 규칙으로 처리하며 몸체·질량·관절과 학교 동작은 그대로다.',
    weaknesses:'갑옷의 무게와 기존 목 약점. 가죽 신발은 판금으로 보호하지 않는다.',
    weapon:'muramasa',voice:'renji',look:getLook('white_scale'),lookVersion:'v1',
    ai:{proficiency:3,persona:{school:'muramasa',pers:{}}},
    taunt:'…검으로 이야기하자.',
    lines:{intro:['…검으로 이야기하자.'],attack:['흣.'],hurt:['…아직.'],win:['길을 열어라.'],lose:['…여기까지인가.']},
  };
}

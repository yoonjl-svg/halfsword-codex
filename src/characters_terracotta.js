// Fictional encounter; the Qin statue and its western journey are not a claim
// that historical terracotta soldiers stood guard at the Mogao caves.
import { getLook, CHARACTER_LOOK_VERSION } from './looks.js';

export const TERRACOTTA_CHARACTERS = [{
  id: 'terracotta', name: '병마용', epithet: '돌아가지 못한 월의 혼', age: null,
  origin: '월의 유민이 깃든 진나라 토우 (창작)', weapon: 'goujian', voice: 'silent',
  physiology: { bleeds: false, deathRequiresHeadDetachment: true },
  backstory: '몸은 진의 무덤을 위해 빚었으나, 안에서 깨어난 것은 고향을 잃은 월의 유민들의 기억이다. 서쪽으로 실려 오던 행렬이 천불의 절벽 아래 멈춘 뒤, 흙병사는 부서진 수레에서 월왕구천검을 거두었다. 돌아갈 월나라는 없고 원한을 물을 이름도 남지 않았다. 그는 낯선 발소리마다 회계의 치욕을 묻다가, 문득 한 배를 탔던 밤의 노래를 되뇐다. 월의 기억·진의 토우·후대 둔황을 연결한 창작이며, 진이 월을 멸했다는 뜻은 아니다.',
  want: '월왕의 검을 고향으로 돌려보내고, 지워진 월의 이름을 누군가에게 기억시키는 것.',
  school: '월왕구천검의 공통 중국 한손검 제어와 검술 보정 v2를 사용한다. 토우 갑옷은 강철 판금이 아니다.',
  temperament: '자기 말 대신 오래된 기록과 노래를 되풀이한다. 원한 사이로 고향을 향한 그리움이 새어 나온다.',
  movementNotes: '기존 성인 체격과 한손검의 전투·팔다리 부상·래그돌 동작을 사용한다. 피를 흘리지 않으며 머리가 몸에서 떨어져야 쓰러진다.',
  ai: { level: 'normal', persona: { school: 'goujian', idle: { guard: 'pflugR', gesture: 'still' } } },
  look: getLook('terracotta'), lookVersion: CHARACTER_LOOK_VERSION.terracotta,
  // Own Korean translations: Shiji 41 and Shuo Yuan 11.13. The Yue song is
  // affection/longing, not a historical revenge anthem. See the source note.
  taunt: '"너는 회계의 치욕을 잊었느냐?"',
  lines: {
    intro: ['"너는 회계의 치욕을 잊었느냐?"', '"오늘 밤은 무슨 밤인가."', '"오늘은 무슨 날이기에, 왕자와 한 배를 타는가."'],
    win: ['"산에는 나무가 있고 나무에는 가지가 있건만."', '"그대를 좋아하는 내 마음을 그대는 모르네."', '"너는 회계의 치욕을 잊었느냐?"'],
  },
}];

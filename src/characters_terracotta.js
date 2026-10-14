// Fictional encounter; the Qin statue and its western journey are not a claim
// that historical terracotta soldiers stood guard at the Mogao caves.
import { getLook, CHARACTER_LOOK_VERSION } from './looks.js';

export const TERRACOTTA_CHARACTERS = [{
  id: 'terracotta', name: '병마용', epithet: '돌아오지 않은 근위병', age: null,
  origin: '진나라 · 시안에서 서쪽으로 옮겨진 토우 (창작)', weapon: 'ganjiang', voice: 'silent',
  physiology: { bleeds: false, deathRequiresHeadDetachment: true },
  backstory: '진나라의 무덤을 지키도록 빚어진 병사가 어느 때인가 시안을 떠나 서쪽으로 옮겨졌다. 누가 그를 실어 왔는지, 왜 천불의 절벽 아래 남겨졌는지는 알려지지 않았다. 빛바랜 채색과 흙으로 새긴 갑옷 아래에 사람의 이름은 없다. 모래가 발등에 쌓여도, 손에 쥔 간장은 문을 향한다. 실제 병마용과 둔황을 연결한 창작 이야기다.',
  want: '돌아오지 않는 행렬을 기다리며, 맡겨진 문을 지키는 것.',
  school: '기존 간장 검술을 사용한다. 토우의 갑옷 조각은 외형이며 강철 판금의 방어력을 갖지 않는다.',
  temperament: '말없이 선다. 눈길보다 먼저 칼끝이 움직인다.',
  movementNotes: '기존 성인 체격과 간장의 전투·팔다리 부상·래그돌 동작을 사용한다. 피를 흘리지 않으며 머리가 몸에서 떨어져야 쓰러진다.',
  ai: { level: 'normal', persona: { school: 'ganjiang', idle: { guard: 'pflugR', gesture: 'still' } } },
  look: getLook('terracotta'), lookVersion: CHARACTER_LOOK_VERSION.terracotta,
  taunt: '…', lines: { intro: ['…'], win: ['…'] },
}];

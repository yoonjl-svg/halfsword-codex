import { royalAlterLook } from './outfit_royal_alters.js';

// Appearance review characters. Their current v2 base combat data is copied
// exactly; no generic madness stat multiplier or new encounter pool is applied.
export function createRoyalAlter(base) {
  const c=structuredClone(base), roland=base.id==='roland';
  return {...c,id:base.id+'_mad',variantOf:base.id,mad:true,appearanceOnly:true,
    retainBaseStats:true,proficiencyFixed:base.ai.proficiency,reviewOnly:true,
    name:'광기의 '+base.name,look:royalAlterLook(base.look,base.id),
    lookVersion:base.lookVersion+'-alter1',eyes:'madGlow',
    backstory:roland
      ? '군대 없이 돌아온 왕이 마침내 투구를 벗었다. 검게 그을린 갑옷 위로 황금빛 머리가 흘렀고, 얼굴만은 수십 년 전 출정하던 날 그대로였다. 성문 밖에서는 여전히 돌아오지 못한 군대의 발소리가 들린다.'
      : '레온을 지킨 영웅은 자신의 얼굴을 사자의 철가면 안에 봉인했다. 적포도주색 겉옷과 은회색 망토 위에서 금빛 사자만 빛난다. 이제 그가 자신의 뜻으로 싸우는지, 왕국의 이름이 그를 움직이는지 알 수 없다.',
    weaknesses:roland
      ? '투구를 벗어 머리가 드러난다. 몸의 판금과 큰 검의 회수는 원래 롤랑과 같다.'
      : '기존 폐쇄형 투구와 몸 판금 규칙을 쓴다. 목은 기존 판금 규칙대로 보호하지 않는다.',
  };
}

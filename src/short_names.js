// ─────────────────────────────────────────────────────────────
//  짧은 이름 — 동시 대전 · 생사전 체력 목록 (사장님 10/30 01:0x '생사전 체력 표기할 때 캐릭터 이름은 최소로 써. 이름만 표기되게. 무명 검객도 마찬가지')
//  인물 시트에 짧은 이름 칸이 없어 여기 한 표로 (이름 · 부르는 이름만 — 성 · 칭호 뺌). 얼터(광기의 …)는 'A.' + 본캐 짧은 이름 (사장님 10/30 01:0x 'A.미나미 이런 식으로 써. 얼터란 뜻으로.' — 본캐와 한 대회에 같이 나와도 갈림).
//  표에 없는 인물은 이름의 첫 낱말. 무명 검객은 붙인 이름(tag)만 — main.js teamShort.
// ─────────────────────────────────────────────────────────────

export const SHORT_NAMES = Object.freeze({
  bran: '브론', // 브론 오소리
  isolde: '이졸데', // 이졸데 반 아커러
  liao: '랴오', // 랴오 쓰위엔
  heinrich: '하인리히', // 하인리히 도른
  margarethe: '마르그레테', // 마르그레테 슈바르츠
  tome: '토메', // 토메 비달
  omari: '오마리',
  minami: '미나미',
  artoria: '아르토리아',
  samira: '마야', // 마야 라토르
  renji: '김씨',
  eira: '투야나', // 투야나 니콜라예바
  ratna: '라트나', // 라트나 위라세타쿤
  silver_wanderer: '다라이시',
  chanda: '찬다',
  terracotta: '병마용',
  roland: '롤랑',
  white_scale: '백귀', // 백린의 전사 — 짧은 이름 백귀 (사장님 10/30 18:3x '체력바 색 그대로 두고 짧은 이름 백귀로.')
  bernardo: '베르나르도', // 베르나르도 델 카르피오
});

/** 얼터 표시: 'A.' + 본캐 짧은 이름 (예 'A.미나미' — 사장님 10/30 01:0x 'A.미나미 이런 식으로 써. 얼터란 뜻으로.') */
export const ALTER_MARK = 'A.';

/** 인물 시트 → 짧은 이름 (표 · 얼터 · 없으면 이름의 첫 낱말) */
export function shortNameOf(c) {
  if (!c) return '';
  if (c.mad && c.variantOf) return ALTER_MARK + (SHORT_NAMES[c.variantOf] ?? String(c.name ?? '').replace(/^광기의\s*/, '').split(/\s+/)[0]);
  return SHORT_NAMES[c.id] ?? String(c.name ?? '').split(/\s+/)[0];
}

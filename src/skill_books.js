// 스킬북 — 유파마다 다섯 권 (docs/import/lobby_fix_2026-10-16.md §6 · docs/strike/school_kit_map.md §2·§3)
//  사장님 10/16: 03:5x '월드오브워크래프트나 디아블로의 스킬트리처럼 유파별 문서가 박힌 스킬트리 … 다 들어 있는데 해금되면 색이 밝아지고 누르면 설명과 함께 장착 해제'
//   · 04:0x '나중에 바꿔도 되니까 일단 지금꺼 토대로 만들어놔. 디자인 보려는 거야' · 04:1x '순서대로 해금이 아니라, 금화나 머리를 얻으면 교환해서 개방 … 자기가 알아서 고르도록.
//   등급별 가격이 다를거야. 100부터 500까지' · 04:2x '이미 받은 인장은 인장마다 금화 *100으로 바꿔줘'(seal_coins.js) ·
//   04:3x '책은 책이지만 별자리나 스킬트리처럼 룬 문자처럼 연결돼 있어. 구입하면 밝아지고 사용 봉인 선택 가능. 사용하면 섬네일 자리를 둥근 빛이 감쌈'.
//  급 차례·책 이름 갈래는 샛별 저장소 기획(1급 보법 → 2급 막기 → 3급 고유자세 → 4급 패시브 → 5급 비기, 커먼~레전드) — 출처 줄은 우리 조사 문서(docs/motion/)에서 새로 씀.
//  책 내용 = 지금 게임에 있는 것 (사장님 04:0x): 1 보법 = 지금 유파 걸음 · 2 막기 = 지금 유파 막기 자리 · 3 고유자세 = 지금 고유 공격 넷(한꺼번에 — 임시) ·
//   4 패시브 = 개발 예정(사람 몫이 아직 없다 — 지금 패시브는 모두 AI 몫) · 5 비기 = 지금 비기.
//  산 책만 열린다(가진 것 = lobby_progress.js 얻은 것 'skillbook:<유파>:<급>') · 순서·조건 없음(별자리 줄은 꾸밈) · 산 책은 '사용'으로 시작, '봉인'하면 판에서 꺼진다(봉인 목록 = 아래 BOOK_STATE_KEY).
//  판에 미치는 곳 (사람만 — AI·시뮬은 그대로): 모든 판이 playerKit 을 읽는다(main.js newRound — 첫 화면·대기실 여정 · 옛 메뉴 판 · 주소 판, 10/16 08:1x 인장 없앰부터).
//   테스트 경로는 모두 열림 · 개발 인자 `?uniqueStage=N` 은 그 유파의 N 급까지 '사용'(0 = 책 없음 · 5 = 모두 — bookTierParam).
import { TRADITIONS } from './schools.js';
import { PLAYER_UNIQUE, uniqueDef } from './unique_assist.js';
import { readProgress, purchase } from './lobby_progress.js';
import { UNIQUE_ASSIST } from './config.js';

/** 탭 차례 (감독 10/16: 독일 · 이탈리아 · 이베리아 · 일본 · 동방) */
export const BOOK_SCHOOLS = Object.freeze(['german', 'italian', 'iberian', 'japanese', 'chinese']);

/** 급 다섯 — kind = 판에서 켜고 끄는 몫 · rarity = 등급(색 = 등급 색 --tier-* — entrance_type.css [data-tier]) · price = 금화 (사장님 결정 10/16 04:1x '100부터 500까지') */
export const BOOK_TIERS = Object.freeze([
  { tier: 1, kind: 'footwork', label: '보법', rarity: 'common', price: 100 },
  { tier: 2, kind: 'parry', label: '막기', rarity: 'uncommon', price: 200 },
  { tier: 3, kind: 'unique', label: '고유자세', rarity: 'rare', price: 300 },
  { tier: 4, kind: 'passive', label: '패시브', rarity: 'epic', price: 400 },
  { tier: 5, kind: 'secret', label: '비기', rarity: 'legend', price: 500 },
]);
/** 등급 글 (무기 등급 표 weapons.js TIER_LABEL 과 같은 말 + 스킬북에만 '언커먼' — 샛별 저장소 기획의 이름) */
export const BOOK_RARITY_LABEL = Object.freeze({ common: '커먼', uncommon: '언커먼', rare: '레어', epic: '에픽', legend: '레전드' });
export const ROMAN = Object.freeze(['', 'I', 'II', 'III', 'IV', 'V']);

/**
 * 머리(heads)로 사기 — 사장님 04:1x '금화나 머리를 얻으면 교환' 의 두 번째 돈. 얻는 곳 = 여정 싸움에서 상대 목 베기(사장님 04:3x — main.js · lobby_progress.js awardHead) · 책과 바꾸는 값은 아직 없다(사장님 확인 전).
 *  값이 정해지면 이 한 줄에 급마다 머리 수를 넣는다(예: { 1: 1, … }) — 그때 대기실 상세에 '머리로 구입' 단추가 생긴다. null = 머리로는 못 산다
 */
export const BOOK_HEAD_PRICE = null;
export const headPriceOf = (tier) => BOOK_HEAD_PRICE?.[tier] ?? null;

// 책 이름(급 갈래 + 이름 — 표시 '보법: 리히테나워')과 짧은 출처 줄. 5급 이름은 지금 게임의 비기 이름을 읽는다(비기 판을 바꾸면 같이 바뀜)
const BOOK_TEXT = {
  german: [
    ['리히테나워', '리히테나워 전승(14세기) · 요아힘 마이어(1570)'],
    ['마이어', '요아힘 마이어 『Gründtliche Beschreibung』(1570) — 막기·자세'],
    ['링게크', '지그문트 링게크의 리히테나워 주해(15세기)'],
    ['인데스', '리히테나워 운문의 Indes · 링게크 주해'],
    [null, '링게크 주해 · 마이어(1570)'],
  ],
  italian: [
    ['카포 페로', '리돌포 카포 페로 『Gran Simulacro』(1610) — 거리·내딛기'],
    ['기간티', '니콜레토 기간티 『Scola, overo Teatro』(1606) — 자세와 맞자세'],
    ['파브리스', '살바토르 파브리스 『Lo Schermo』(1606) — 자세 도판'],
    ['카바치오네', '카포 페로(1610)의 cavazione'],
    [null, '카포 페로(1610)의 박자와 낮은 찌르기'],
  ],
  iberian: [
    ['피게이레두', '디오구 고메스 드 피게이레두 『Memorial da Prattica do Montante』(1651)'],
    ['고디뉴', '도밍구 루이스 고디뉴 『Arte de Esgrima』(1599) 몬탄테 장'],
    ['몬탄테', '몬탄테 규칙 — 피게이레두(1651) · 고디뉴(1599)'],
    ['이어 돌기', '두 문헌의 이어 베기'],
    [null, '피게이레두(1651) 규칙 7 · 11'],
  ],
  japanese: [
    ['일본검도형', '『일본검도형』(1912) — 현대 교본'],
    ['오륜서', '미야모토 무사시 『오륜서』(1645) — 세 가지 받기'],
    ['왜검', '『무예도보통지』(1790) 권2 왜검·교전'],
    ['잔신', '야규 무네노리 『병법가전서』(1632)'],
    [null, '받아서 먼저 치는 박자의 전승'],
  ],
  chinese: [
    ['조선세법', '모원의 『무비지』(1621) 권86 조선세법 — 체보'],
    ['무예도보통지', '『무예도보통지』(1790) 권2 예도 — 거정·요략'],
    ['예도', '『무예도보통지』(1790) 권2 예도 · 권3 본국검'],
    ['검결가', '『무비지』(1621) 검결가'],
    [null, '조선세법의 이어 치기'],
  ],
};
const short = (t) => String(t ?? '').replace(/\s*[(·].*$/, '');
// 원어 (사장님 10/19 02:0x '대기실 스킬북에서만 원어 병기') — 책 이름의 원어. 기술 이름은 '뜻 (독음 · 원어)' (bookLabel)
const BOOK_ORIG = {
  german: ['Liechtenauer', 'Meyer', 'Ringeck', 'Indes'],
  italian: ['Capo Ferro', 'Giganti', 'Fabris', 'cavazione'],
  iberian: ['Figueiredo', 'Godinho', 'montante', null],
  japanese: ['日本剣道形', '五輪書', '倭劍', '残心'],
  chinese: ['朝鮮勢法', '武藝圖譜通志', '銳刀', '劍訣歌'],
};
/** 스킬북 기술 이름: '뜻 (독음)' + 원어 → '뜻 (독음 · 원어)'. 원어가 없으면 그대로 */
export function bookLabel(nameKo, orig) {
  const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(nameKo ?? '');
  if (!orig) return nameKo ?? '';
  return m ? `${m[1]} (${m[2]} · ${orig})` : `${nameKo} (${orig})`;
}
// 효과 한 줄 — 지금 게임에 있는 그 유파 몫 (docs/strike/school_kit_map.md §2 · 공지 글과 같은 말)
const FOOTWORK_TEXT = {
  german: '뒤로 박차 빠지고, 헛친 상대와 거리를 잰다',
  italian: '짧게 둘, 길게 둘 — 박자를 타는 걸음',
  iberian: '넓은 보폭으로 옆으로 박차 돈다',
  japanese: '낮게 깔려 흔들려도 버티는 몸',
  chinese: '가볍게 떼고 멈추는 발',
};
const PARRY_TEXT = {
  german: '머리 위로 오는 칼을 칼자루로 받는다 (왕관)',
  italian: '곧게 뻗은 칼로 치며 막는다',
  iberian: '높이 오는 칼을 베어 쳐낸다 · 막는 동안 피해 20% 감소',
  japanese: '머리 위로 오는 칼을 흘려 받아 상대 기력을 깎는다 · 막는 동안 피해 20% 감소',
  chinese: '위 · 가운데 · 아래를 세 자세로 받는다 · 막는 동안 피해 절반',
};

// 비기 책 한 줄 — 언제 공격하면 무엇이 나가는지 (비기 판 이름 열쇠 — 주소 스위치로 판을 바꿔도 맞는 글. 10/19 글 방침 2판)
const SECRET_TEXT = {
  versetzen: '치명적인 칼이 들어올 때 공격하면, 받아내며 동시에 벤다',
  indesWinden: '높이 막아 칼이 맞붙은 동안 공격하면, 감아 들어 친다 — 오래 붙을수록 세다',
  passataContratempo: '상대가 칼을 들거나 달려들 때 공격하면, 밑으로 들어가 찌른다',
  gilmok: '칼끝 거리 밖에서 기다리다 상대가 넘어올 때 공격하면, 크게 둘러 벤다',
  montanteFlow: '상대가 칼 호 안으로 밀고 들 때 공격하면, 끊임없이 이어 벤다',
  molineteTalho: '상대가 칼 호 안으로 밀고 들 때 공격하면, 비켜 서며 크게 가로 벤다',
  goNoSen: '간격 밖에서 기다리다 상대가 치려 할 때 공격하면, 먼저 벤다',
  lianhuanParry: '높이 막아 낸 직후 공격하면, 세 번 이어 친다',
  lianhuanSanji: '쉬었다 들어가며 친 첫 칼이 맞으면, 세 번 이어 친다',
};

export const bookId = (school, tier) => `${school}:${tier}`;
export const bookReceipt = (school, tier) => `skillbook:${bookId(school, tier)}`;

/** 한 권 { id, school, schoolKo, tier, kind, label, rarity, rarityKo, price, name, title, source, effect, list?, provisional?, planned? } */
export function bookOf(school, tier) {
  const T = TRADITIONS[school], B = BOOK_TIERS[tier - 1], text = BOOK_TEXT[school]?.[tier - 1];
  if (!T || !B || !text) return null;
  const name = text[0] ?? short(T.secret?.nameKo);
  const book = { id: bookId(school, tier), school, schoolKo: T.nameKo, tier, kind: B.kind, label: B.label, rarity: B.rarity, rarityKo: BOOK_RARITY_LABEL[B.rarity], price: B.price, name, title: `${B.label}: ${name}`, source: text[1] };
  const reading = /\(([^()]*)\)/.exec(T.secret?.nameKo ?? '')?.[1];
  book.orig = B.kind === 'secret' ? [reading, T.secret?.orig].filter(Boolean).join(' · ') || null : BOOK_ORIG[school]?.[tier - 1] ?? null; // 스킬북에서만 원어
  if (B.kind === 'footwork') book.effect = FOOTWORK_TEXT[school];
  else if (B.kind === 'parry') book.effect = PARRY_TEXT[school];
  else if (B.kind === 'unique') {
    book.effect = '고유 공격 넷을 쓸 수 있다';
    book.list = (PLAYER_UNIQUE[school] ?? []).map((e) => { const u = uniqueDef(school, e); return u?.nameKo ? bookLabel(u.nameKo, u.orig) : null; }).filter(Boolean); // '뜻 (독음 · 원어)'
    book.provisional = true; // 사장님 04:0x '나중에 바꿔도 되니까' — 고유자세 한 가지로 바꿀 때까지 임시
  } else if (B.kind === 'passive') {
    book.effect = '준비 중';
    book.planned = true;
  } else book.effect = SECRET_TEXT[T.secret?.name] ?? '';
  return book;
}
export const booksOf = (school) => BOOK_TIERS.map((B) => bookOf(school, B.tier)).filter(Boolean);

// ── 사용 · 봉인 (산 책은 '사용'으로 시작 — 봉인한 책만 적는다) ──
export const BOOK_STATE_KEY = 'stillness.lobby.skillbooks.v1';
let sealedSession = new Set();
const validId = (id) => typeof id === 'string' && /^[a-z]+:[1-5]$/.test(id) && BOOK_SCHOOLS.includes(id.split(':')[0]);
/** { owned: Set<id>, sealed: Set<id> } — owned 는 금화로 산 책(lobby_progress 얻은 것) · sealed 는 봉인한 책 */
export function readBooks() {
  try {
    const value = JSON.parse(localStorage.getItem(BOOK_STATE_KEY));
    if (value?.version === 1 && Array.isArray(value.sealed)) sealedSession = new Set(value.sealed.filter(validId));
  } catch { /* 저장이 막혔으면 이번 실행 동안만 */ }
  const owned = new Set(readProgress().acquisitions.filter((a) => a.kind === 'skillbook' && a.receipt.startsWith('skillbook:')).map((a) => a.receipt.slice(10)).filter(validId));
  return { owned, sealed: new Set(sealedSession) };
}
/** 책 하나의 상태: 'unowned'(안 삼 — 어둡게, 값) · 'use'(사용 — 둥근 빛) · 'sealed'(봉인 — 밝게, 빛 없음 · 판에서 꺼짐) */
export const bookState = (books, id) => (!books.owned.has(id) ? 'unowned' : books.sealed.has(id) ? 'sealed' : 'use');
/** 사용(true) · 봉인(false) — 가진 책만 뜻이 있다. 돌려줌: 저장했나 */
export function setBookInUse(id, use) {
  if (!validId(id)) return false;
  readBooks();
  if (use) sealedSession.delete(id);
  else sealedSession.add(id);
  try { localStorage.setItem(BOOK_STATE_KEY, JSON.stringify({ version: 1, sealed: [...sealedSession].sort() })); return true; }
  catch { return false; }
}
/** 금화로 사기 — { ok, saved, why } (lobby_progress.purchase: 'owned' · 'coins' · 'bad'). 산 책은 '사용'으로 시작 (전에 봉인해 둔 기록이 있어도 지운다) */
export function buyBook(school, tier) {
  const b = bookOf(school, tier);
  if (!b) return { ok: false, saved: false, why: 'bad' };
  const result = purchase({ receipt: bookReceipt(school, tier), kind: 'skillbook', price: b.price });
  if (result.ok) setBookInUse(b.id, true);
  return result;
}

/**
 * 플레이어가 이 판에 가진 유파 몫 — 해금 규칙의 오직 한 자리 (사장님 10/16 04:1x: 산 책만 · 순서 없음 / 04:3x: 봉인한 책은 꺼짐 / 08:1x: 인장 없음 — 모든 판).
 *  tradition = 손에 든 무기 유파(swordArt.tradition) · books = readBooks() · test = 테스트 경로(모두 열림 — 사장님 '지금처럼').
 *  upTo = 개발 인자 `?uniqueStage=N`(bookTierParam): 산 책과 상관없이 N 급까지 켬 — 테스트 경로보다 먼저(10/13 ?uniqueStage 가 테스트 경로를 덮던 차례 그대로).
 *  책이 없는 유파(무유파 등)는 null — 유파 몫이 원래 없다(지금 그대로).
 *  돌려줌 { footwork, parry, unique, passive, secret } — 그 책이 '사용'(샀고 봉인 안 함)이면 켬
 */
export function playerKit(tradition, books, { test = false, upTo = null } = {}) {
  if (!BOOK_SCHOOLS.includes(tradition)) return null;
  const on = (tier) => (upTo != null ? tier <= upTo : test || bookState(books, bookId(tradition, tier)) === 'use');
  return { footwork: on(1), parry: on(2), unique: on(3), passive: on(4), secret: on(5) };
}
/** 개발 인자 `?uniqueStage=N` → 켤 급 N (0~5 정수 — 0 = 책 없음 · 2 = 보법·막기 · 5 = 모두) · 없거나 범위 밖이면 null (산 책대로) */
export function bookTierParam(raw) {
  const n = raw == null || raw === '' ? NaN : Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= BOOK_TIERS.length ? n : null;
}
/** 책 몫 → 고유 공격 단계 (main.js PlayerUniqueAssist): 고유자세 책을 쓰면 넷 모두(4단계) · 아니면 0 (감독 10/16 04:0x 전달 — 지금 고유 공격 넷을 한꺼번에 · 임시. 사장님 04:0x '일단 지금꺼 토대로') */
export const kitUniqueStage = (kit) => (kit?.unique ? UNIQUE_ASSIST.secretStage - 1 : 0);

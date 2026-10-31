// 스킬트리 자료 · 규칙 (10/21 사장님 확정 — docs/design/skill_tree_2026-10-21/README.md · data.mjs 가 원본 · 이 파일 = 게임이 읽는 판)
//  유파마다 11 칸 · 뿌리 = 보법 I · pre = 먼저 익힐 칸 '모두'(독일 2단계 관문 · 이탈리아 보법 II 줄기 · 이베리아 패시브 → 비기 · 독일 보법 II → 패시브 → 비기가 이미 여기 들어 있다).
//  값(사장님 10/21 19:0x): 편지 금화 100 · 패시브 머리 5(금화 없음 · 10/25 01:5x 사장님 10 → 5) · 보법 II 금화 100 · 비기 금화 400 + 머리 10(10/25 01:5x 사장님 20 → 10) · 나머지는 깊이마다 금화 — data.mjs 그대로.
//  닫힌 칸: 비기는 SECRET.openSchools(config — 10/22 사람 쪽 다섯 유파 모두: 일본 · 독일 · 이탈리아 · 이베리아 · 동방)에 없으면 '준비 중'(사람 · 살 수 없음 — 10/21 20:xx) · closed 칸(지금 없음 — 일본 J8 손목 치기 심화는 10/24 칼 떨구기로 열림).
//  칸 → 판 몫(아래 f · u · perk): 칸 하나가 제 몫 하나만 켠다 — 몫 열쇠는 skill_kit.js kitOff 가 싸움 코드에서 읽는다(사람만 · AI 는 숙련도 그대로).
//   표 · 근거: IMPLEMENTATION.md §2 · docs/strike/school_kit_map.md §2 '스킬트리'. 글(l1 · l2 · eff)은 화면 글 지침(docs/text/editing_guide.md) — data.mjs eff 는 설계 메모라 고쳐 씀.
//  이 파일은 저장 · 화면을 모른다(시험이 바로 읽음) — 저장은 skill_tree_store.js · 화면은 skill_tree.js.
import { SECRET, LETTER, UNIQUE_ASSIST } from './config.js';

/** 탭 차례 (감독 10/16: 독일 · 이탈리아 · 이베리아 · 일본 · 동방) */
export const TREE_SCHOOLS = Object.freeze(['german', 'italian', 'iberian', 'japanese', 'chinese']);

/** 칸 갈래 — label = 상세 카드 갈래 글 · tier = 색(등급 색 --tier-* — entrance_type.css [data-tier], 옛 책 급 색 그대로) · stage = 개발 인자 ?uniqueStage=N 의 옛 급(1 보법 … 5 비기) */
export const NODE_CAT = Object.freeze({
  foot: { label: '보법', tier: 'common', stage: 1 },
  parry: { label: '막기', tier: 'uncommon', stage: 2 },
  atk: { label: '고유 공격', tier: 'rare', stage: 3 },
  deep: { label: '심화', tier: 'rare', stage: 3 },
  passive: { label: '패시브', tier: 'epic', stage: 4 },
  secret: { label: '비기', tier: 'legend', stage: 5 },
  letter: { label: '편지', tier: 'mystery', stage: null },
});

/** 판 몫 열쇠 (skillKit 칸 — 칸이 없으면 false). unique · perk 는 이름 모음 */
export const KIT_KEYS = Object.freeze(['footwork', 'chase', 'backFlat', 'burstSide', 'stepCost', 'parry', 'parryCover', 'parryCut', 'opposition', 'flow', 'flowShield', 'ibFlow', 'ibChain', 'passive', 'secret']); // ibChain = 이베리아 B6 이어지는 흐름 (10/29)

export const RESET_HEADS = 1; // 유파 초기화 값 — 머리 1 (사장님 10/21)

// 칸 하나: id · cat · pre(모두) · price(금화) · heads(머리) · opt(곁가지 — 점선) · closed(늘 닫힘) · d(줄) · cx(가로 0~1000 — data.mjs 그대로)
//  편지 다섯은 뿌리(보법 I)와 같은 줄 왼쪽 — d 0 · cx 250 (사장님 10/22 02:1x '어디 어디에서 온 편지 아이콘은 가장 처음에 배우게 되는 보법 아이콘 왼쪽으로 수평으로 점선을 뺀 다음에 똑같은 높이에') · 앞 칸은 그대로 뿌리
//  name = 트리 판 칸에 보이는 기술 이름 (사장님 10/22 '보법1 보법2 이런 건 우리가 보려고 만든 범주 구분 … 아이콘만 보이거나 기술 이름이 보이는 게' — 갈래(보법 I · 막기 II · 패시브 …)는 상세 카드에만)
//  l1 · l2 = 옛 판 칸의 두 줄(갈래 · 이름 — 알림 · 읽기 이름에 남음) · title · orig = 상세 카드 제목(없으면 두 줄 · 원어는 대기실 스킬에서만 — 화면 글 지침 §1) · eff = 상세 카드 효과 한 줄 · lore · src = 오의 한 줄 · 출처(아래 NODE_LORE — 10/22) · cmd = 상세 카드 맨 아래 입력 줄(아래 NODE_CMD — 10/24 · 10/25 도식 · 정해진 입력으로 내는 칸만) · f = 켜는 몫 열쇠 · u = 켜는 고유 공격(unique_assist.js PLAYER_UNIQUE name) · perk = 켜는 강화동작 이점 · letter = 편지
const N = (o) => Object.freeze({ pre: [], heads: 0, ...o, pre: Object.freeze(o.pre ?? []), f: Object.freeze(o.f ?? []) });
const TREE_SRC = {
  german: {
    gate: { from: ['G5', 'G8', 'G3'], to: ['G6', 'G4'] }, // 2단계 셋을 모두 익히면 3단계가 열림 (사장님 18:5x — 그림의 금색 띠) · 10/28 00:5x 겹치기는 왕관 아래로 빠짐(아래 G7)
    nodes: [
      N({ id: 'G1', name: '뒤 박차기', cat: 'foot', l1: '보법 I', l2: '뒤 박차기', eff: '서 있다가 뒤로 밀면 첫 걸음을 박찬다', price: 100, d: 0, cx: 500, f: ['footwork'] }),
      N({ id: 'G2', name: '간격 잡기', cat: 'foot', l1: '보법 II', l2: '간격 잡기', eff: '상대가 헛치면 두 걸음 빠르게 들어가 선다', pre: ['G1'], price: 100, d: 1, cx: 100, f: ['chase'] }),
      N({ id: 'G5', name: '곁눈 베기', cat: 'atk', l1: '곁눈 베기', l2: '강화동작', eff: '분노의 베기를 그으면 더 힘 있는 곁눈 베기가 나간다', pre: ['G1'], price: 200, d: 1, cx: 310, u: 'schielhau' }),
      N({ id: 'G8', name: '비껴 딛는 가로베기', cat: 'atk', l1: '비껴 딛는', l2: '가로베기', eff: '옆으로 걸으며 가로로 긋는다', pre: ['G1'], price: 200, d: 1, cx: 500, u: 'zwerchAbtritt' }),
      N({ id: 'G3', name: '세워 받기', cat: 'parry', l1: '막기 I', l2: '막기 자리', eff: '오는 칼 쪽에 칼을 세워 받는다', pre: ['G1'], price: 200, d: 1, cx: 690, f: ['parry'] }),
      N({ id: 'G11', name: '뉘른베르크에서 온 편지', cat: 'letter', l1: '뉘른베르크', l2: '온 편지', title: '뉘른베르크에서 온 편지', pre: ['G1'], price: 100, opt: true, d: 0, cx: 250, letter: true }),
      N({ id: 'G7', name: '겹치기', cat: 'atk', l1: '겹치기', l2: '이어 긋기', eff: '칼이 맞물리면 상대 칼 뒤로 들어가 얼굴을 벤다', pre: ['G4'], price: 300, d: 3, cx: 690, u: 'duplieren' }), // 10/28 00:5x 사장님 '겹치기는 왕관 아래로' — 특수공격(이어 긋기)이 된 뒤 자리 (전 2단계 관문 뒤 · cx 310) // 10/29 14:1x · 14:2x 사장님 글 (효과)
      N({ id: 'G6', name: '무릎 꺾기', cat: 'deep', l1: '심화', l2: '무릎 꺾기', title: '곁눈 베기 심화 · 무릎 꺾기', eff: '곁눈 베기에 맞은 상대가 무릎을 꿇기도 한다', pre: ['G5', 'G8', 'G3'], price: 300, d: 2, cx: 310, perk: 'schielhau' }), // 10/28 00:5x 사장님 '무릎 꺾기가 곁눈 베기 아래로' (전 cx 500)
      N({ id: 'G4', name: '왕관', cat: 'parry', l1: '막기 II', l2: '왕관', title: '막기 II · 왕관 (크론)', orig: 'Kron', eff: '머리 위로 오는 칼을 칼자루로 받는다', pre: ['G5', 'G8', 'G3'], price: 300, d: 2, cx: 690, f: ['parryCover'] }),
      N({ id: 'G9', name: '그 순간', cat: 'passive', l1: '패시브', l2: '그 순간', eff: '칼이 맞부딪히거나 상대가 헛친 직후에 친 칼은 피해가 증가한다', pre: ['G2'], price: 0, heads: 5, d: 2, cx: 100, f: ['passive'] }), // 10/29 01:5x 사장님 '인데스만 독일어더라 그것도 바꿔' → '그 순간' (뜻 이름 — 대기실 스킬 '그 순간 (인데스)') · 10/28 23:4x 사장님 '그래 그 안으로 바꿔' — 칼끼리 닿음에도 창(10/28 01:4x · school_passive.js) · 전 '상대가 헛치거나 막힌 직후에 친 칼은 피해가 증가한다'
      N({ id: 'G10', name: '모르트슐라크', cat: 'secret', l1: '비기', l2: '모르트슐라크', eff: '초근접 상황에서 경합하면, 칼자루 끝을 망치처럼 정수리에 내리꽂는다', pre: ['G9', 'G6', 'G7'], price: 400, heads: 10, d: 4, cx: 420, f: ['secret'] }), // 10/28 00:5x 사장님 '무릎 꺾기와 겹치기를 다 배워야 죽음의 일격' · 인데스도 남김 (전 인데스 + 겹치기 + 왕관 · 3줄) // 10/22 사장님 '독일은 죽음의 일격으로 하자' (옛 받아 베기 — `?deMord=0` · 10/24 AI 도 같은 비기 — 사장님 'ai도 비기 쓰게 해')
    ],
  },
  italian: {
    nodes: [
      N({ id: 'I1', name: '박자 걸음', cat: 'foot', l1: '보법 I', l2: '박자 걸음', eff: '짧게 두 번, 길게 두 번 박자를 타며 걷는다', price: 100, d: 0, cx: 500, f: ['footwork'] }),
      N({ id: 'I11', name: '시에나에서 온 편지', cat: 'letter', l1: '시에나에서', l2: '온 편지', title: '시에나에서 온 편지', pre: ['I1'], price: 100, opt: true, d: 0, cx: 250, letter: true }),
      N({ id: 'I3', name: '물러서기', cat: 'foot', l1: '보법 II', l2: '물러서기', eff: '뒤로 걸어도 느려지지 않는다', pre: ['I1'], price: 100, d: 1, cx: 500, f: ['backFlat'] }),
      N({ id: 'I7', name: '내려 찌르기', cat: 'atk', l1: '내려', l2: '찌르기', eff: '내려 긋는 칼이 내려 찌르기로 나간다', pre: ['I3'], price: 200, d: 2, cx: 330, u: 'imbroccata' }), // 10/31 12:xx 사장님 '임브로카타를 먼저 배우고 카바치오네를 배우고 틈 파고들기는 카바치오네 강화로 바꿔.' — 왼 줄 첫 칸(d 2 · 금화 200 — 전 d 3 · 300 · I2 뒤) · 칸 id 는 기술을 따라 I7 그대로(사장님 · 감독이 부르는 이름) — 옛 저장의 d 2 자리(I2)는 skill_tree_store.js migrateItalianSlots 가 I7 로 옮김 · 10/31 12:xx 사장님 'I7은 어떤 방향이나 높이에서든 다른 유파의 내려 긋는 베기에 해당하는 커맨드를 내려찌르기로 전환해 주도록 하자' — 10/31 13:xx 사장님 '내려 긋는 칼이 내려 찌르기로 나간다 - 스킬 이름도 내려 찌르기로 바꿔' — 이름 '위에서 내려 찌르기' → '내려 찌르기' · 효과 글 사장님 확정 · 전 '황소 찌르기를 하면 위에서 내려 찌르기가 나간다'
      N({ id: 'I5', name: '뻗어 받기', cat: 'parry', l1: '막기 I', l2: '막기 자리', eff: '팔을 뻗고 칼끝을 곧게 둔 채 받는다', pre: ['I3'], price: 200, d: 2, cx: 670, f: ['parry', 'parryCover'] }),
      N({ id: 'I2', name: '칼끝 돌려 빼기', cat: 'atk', l1: '칼끝', l2: '돌려 빼기', eff: '맞닿은 상대 칼 밑으로 칼끝을 돌려 빼 반대쪽을 찌른다', pre: ['I7'], price: 300, d: 3, cx: 330, u: 'cavazione' }), // 10/31 12:xx 사장님 '카바치오네가 발전해서 리솔루토가 되는 게 더 멋지고' · '임브로카타를 먼저 배우고 카바치오네를 배우고' — 기본 고유 공격(d 3 · 금화 300 · 전 I9 특수 공격) · 칸 id I2(10/31 첫 안 — 전 비껴서며 찌르기 d 2 · 옛 저장의 d 3 자리(I7)는 migrateItalianSlots 가 I2 로) · 효과 글 = 감독 안(사장님 검수 전)
      N({ id: 'I6', name: '막아찌르기', cat: 'parry', l1: '막기 II', l2: '막아찌르기', eff: '막기를 누르면 바로 짧게 찌르고, 그동안 받는 피해가 줄어든다', pre: ['I5'], price: 300, d: 3, cx: 670, f: ['opposition'] }),
      N({ id: 'I8', name: '헛누름', cat: 'deep', l1: '심화', l2: '헛누름', title: '칼끝 돌려 빼기 심화 · 헛누름', eff: '칼끝을 빼면 상대가 누르던 칼이 허공으로 쏠려 잠시 흐트러진다', pre: ['I2'], price: 400, d: 4, cx: 330, perk: 'cavazione' }), // 10/31 12:xx 사장님 '임브로카타를 먼저 배우고 카바치오네를 배우고 틈 파고들기는 카바치오네 강화로 바꿔.' · 효과 '1로 해. 단 효과가 체감되려면 1초로 해.' → '1.2초로 할게' — 칼끝 돌려 빼기가 나가는 순간 상대 두 팔 1.2 s 늦춤(config UNIQUE_ASSIST.cavArmSlow · unique_assist.js tapChain · perk 'cavazione') · 자리 · 값 그대로 · 이름 '헛누름' = 사장님 결정(10/31 16:xx '헛누름으로 둬') · 효과 글 = 감독 안(사장님 검수 전) · 전 '틈 파고들기'(내려 찌르기 심화 — 옷 · 갑옷 틈 0.6 · combat.js perkOff 'imbroccata' — 사람 몫은 이 칸과 함께 없어짐 · AI 이점은 그대로)
      N({ id: 'I9', name: '비껴서며 찌르기', cat: 'atk', l1: '비껴서며', l2: '찌르기', eff: '상대 칼 줄에서 몸을 빼며 넷째 자세로 맞받아 찌른다', pre: ['I6'], price: 300, d: 4, cx: 670, u: 'inquartata' }), // 10/31 12:xx 사장님 — 이탈리아 특수 공격 = 비껴서며 찌르기(I2 와 자리 바꿈 · 효과 글 = 감독 안 · 사장님 검수 전) · 전 '칼끝 돌려 빼기' · '빗나간 막아찌르기 뒤 칼끝을 돌려 빼 가슴을 찌른다'(10/29 14:1x · 14:2x 사장님 글 · u cavazione)
      N({ id: 'I4', name: '안다레 리솔루토', cat: 'secret', l1: '비기', l2: '안다레 리솔루토', eff: '칼을 붙인 채 상대 걸음에 맞춰 오가다 공격하면, 번개 같은 런지로 찔러 든다', pre: ['I8'], price: 400, heads: 10, d: 5, cx: 330, f: ['secret'] }), // 10/22 사람 먼저 — 거침없이 나아가 찌르기 (옛 엇박 찌르기는 ?itSecret=contratempo · 그때 칸 글은 이것 그대로) · 10/23 넓은 판정에 맞춰 '덮은 채' → '칼을 붙인 채' · 10/24 런지(사장님 '런지로 진행해 … 고노센처럼 빠르게') '묶인 칼을 누르고 곧게 찌른다' → '번개 같은 런지로 찔러 든다' · 10/25 22:3x 사장님 확정 글 '걸어 들어가 찌르면' → '오가다 공격하면'(21:0x 조건 — 스틱 앞이나 뒤 · 공격하면) · 10/28 01:4x 사장님 확정 글 '상대 칼에 칼을 붙인 채' → '칼을 붙인 채 상대 걸음에 맞춰'(상대가 물러서면 들고 · 들어오면 빠짐 — SECRET.risolutoMirror)
      N({ id: 'I10', name: '곧은 선', cat: 'passive', l1: '패시브', l2: '곧은 선', eff: '찌르는 동안 칼끝이 상대를 조금 따라간다', pre: ['I9'], price: 0, heads: 5, d: 5, cx: 670, f: ['passive'] }),
    ],
  },
  iberian: {
    nodes: [
      N({ id: 'B1', name: '넓은 옆걸음', cat: 'foot', l1: '보법 I', l2: '넓은 옆걸음', eff: '넓은 보폭으로 옆으로 빠르게 돈다', price: 100, d: 0, cx: 500, f: ['footwork'] }),
      N({ id: 'B2', name: '옆 박차기', cat: 'foot', l1: '보법 II', l2: '옆 박차기', eff: '옆으로 누르면 첫 걸음을 박찬다', pre: ['B1'], price: 100, opt: true, d: 1, cx: 84, f: ['burstSide'] }),
      N({ id: 'B10', name: '손목 힘', cat: 'passive', l1: '패시브', l2: '손목 힘', eff: '큰 칼을 돌리는 손목 힘이 세진다', pre: ['B1'], price: 0, heads: 5, d: 1, cx: 252, f: ['passive'] }),
      N({ id: 'B3', name: '나선\u00a0걸음 베기', cat: 'atk', l1: '나선 걸음 베기', l2: '걸음 기술', eff: '옆으로 걸으며 사선으로 내려 긋는다', pre: ['B1'], price: 200, d: 1, cx: 420, u: 'talhoRodeado' }), // 10/29 01:1x 사장님 '나선 걸음 베기로 해' — 머리 위 돌려 베기 · 거듭 돌려 베기와 헷갈려서 이름만(전 '돌며 베기') · 10/29 01:4x '나선 걸음 / 베기 - 이렇게 줄을 바꿔' — 나선과 걸음 사이는 줄 안 바꿈 빈칸(\u00a0 — skill_tree.js nameOptions 는 보통 빈칸에서만 줄을 나눔)
      N({ id: 'B4', name: '정수리 가르기', cat: 'atk', l1: '정수리', l2: '가르기', eff: '칼을 어깨에 메었다가 온 몸으로 비스듬히 내려 가른다', pre: ['B5'], price: 300, d: 2, cx: 560, u: 'redondo' }), // 10/31 19:xx 사장님 결정 이름 '정수리 가르기'(전 '풍차 베기' · 확인표 3290) · 효과 글 = 사장님 글 '칼을 어깨에 메었다가 온 몸으로 비스듬히 내려 가른다'(19:xx — 전 10/29 14:xx '칼을 머리 위로 돌려서 강하게 내려 벤다' · 확인표 3297) // // 10/29 01:3x 사장님 '흐르는 긋기와 머리 위 돌려 베기 스킬 위치를 바꿔 · 레돈두를 특수공격으로 · 이름을 특수공격 답게' · 01:5x '레돈두는 풍차 베기로' · 확인표 2726 · 2727 (전: 머리 위 돌려 베기 — 왼 가로베기 강화동작 · d 1 · cx 588 · B1 뒤 · 금화 200 — 값은 자리의 깊이를 따름) // 10/29 14:1x · 14:2x 사장님 글 (효과)
      N({ id: 'B8', name: '쳐내기', cat: 'parry', l1: '막기 I', l2: '쳐내기', title: '막기 I · 쳐내기 (탈류 · 레베스)', eff: '높이 오는 칼을 베어 쳐낸다', pre: ['B1'], price: 200, d: 1, cx: 756, f: ['parry', 'parryCover'] }),
      N({ id: 'B11', name: '리스본에서 온 편지', cat: 'letter', l1: '리스본에서', l2: '온 편지', title: '리스본에서 온 편지', pre: ['B1'], price: 100, opt: true, d: 0, cx: 250, letter: true }),
      N({ id: 'B5', name: '흐르는 긋기', cat: 'atk', l1: '이어 긋기', l2: '흐름', eff: '이어 그을 때 칼이 멈추지 않고 다음 긋기로 흐른다', pre: ['B1'], price: 200, d: 1, cx: 588, f: ['ibFlow'] }), // 10/29 01:3x 머리 위 돌려 베기와 자리 바꿈 (전 d 2 · cx 560 · B4 뒤 · 금화 300)
      N({ id: 'B9', name: '굳은 받기', cat: 'parry', l1: '막기 II', l2: '굳은 받기', eff: '막는 동안 받는 피해가 줄어든다', pre: ['B8'], price: 300, d: 2, cx: 800, f: ['parryCut'] }),
      N({ id: 'B7', name: '싱지르', cat: 'secret', l1: '비기', l2: '싱지르', eff: '칼끝 거리 밖에서 버티다 공격을 원을 그리듯 한 바퀴 돌리면, 몸을 한 바퀴 돌려 가로로 벤다', pre: ['B10', 'B3', 'B5'], price: 400, heads: 10, d: 3, cx: 420, f: ['secret'] }), // 10/22 이베리아 새 비기 (사장님 '빙글 한바퀴 돌면서 … 일격' — schools.js IBERIAN_SECRET_SPIN · 전 '길목 지키기')
      N({ id: 'B6', name: '이어지는 흐름', cat: 'deep', l1: '이어지는', l2: '흐름', title: '이어지는 흐름', eff: '이어 그을수록 세지고, 세 번째 긋기마다 기력을 쓰지 않는다', pre: ['B4'], price: 400, d: 3, cx: 680, f: ['ibChain'] }), // 10/29 01:4x · 01:5x 사장님 결정 · 확인표 2735 ~ 2738 — 이어 그은 수마다 흐르는 긋기 위력 더하기 · 상한 없음 · 14:1x · 14:2x 사슬 세 칼마다 기력 0 (config IB_FLOW.chainStack · freeEvery — 전 01:5x 기력 × 0.9ⁿ · 그 전: 거듭 돌려 베기 · 돌려 베기 쌓기 perk redondo) · 효과 글 14:1x · 14:2x 사장님 글
    ],
  },
  japanese: {
    nodes: [
      N({ id: 'J1', name: '낮은 걸음', cat: 'foot', l1: '보법', l2: '낮은 걸음', eff: '낮게 걸어 흔들려도 잘 버티지만, 걸을 때 기력이 더 든다', price: 100, d: 0, cx: 500, f: ['footwork', 'stepCost'] }),
      N({ id: 'J6', name: '비껴 베기', cat: 'atk', l1: '비껴 베기', l2: '걸음 기술', eff: '옆으로 걸으며 왼 사선으로 내려 긋는다', pre: ['J1'], price: 200, d: 1, cx: 120, u: 'hirakiGiri' }),
      N({ id: 'J7', name: '손목 치기', cat: 'atk', l1: '손목 치기', l2: '강화동작', eff: '가운데서 짧게 내려베면 더 힘 있는 손목 치기가 나간다', pre: ['J1'], price: 200, d: 1, cx: 360, u: 'kote' }),
      N({ id: 'J2', name: '머리 위 받기', cat: 'parry', l1: '막기 I', l2: '머리 위 받기', eff: '머리 위로 오는 칼을 받고, 막는 동안 받는 피해가 줄어든다', pre: ['J1'], price: 200, d: 1, cx: 650, f: ['parry', 'parryCover', 'parryCut'] }),
      N({ id: 'J11', name: '에도에서 온 편지', cat: 'letter', l1: '에도에서', l2: '온 편지', title: '에도에서 온 편지', pre: ['J1'], price: 100, opt: true, d: 0, cx: 250, letter: true }),
      N({ id: 'J9', name: '제비 베기', cat: 'atk', l1: '제비 베기', l2: '이어 긋기', eff: '내려벤 칼이 빗나가거나 막힌 뒤 위로 긋는다', pre: ['J6', 'J7'], price: 300, d: 2, cx: 200, u: 'tsubameGaeshi' }),
      N({ id: 'J8', name: '칼 떨구기', cat: 'deep', l1: '심화', l2: '칼 떨구기', title: '손목 치기 심화 · 칼 떨구기', eff: '손목을 맞은 상대가 칼을 놓치기도 한다', pre: ['J7'], price: 300, d: 2, cx: 420, perk: 'kote' }), // 10/24 열림 (사장님 11:4x · 11:5x '너무 강하면 50%로' — 칼 놓침 · config UNIQUE_ASSIST.koteDrop · combat.js koteCheck)
      N({ id: 'J3', name: '흘려 받기', cat: 'parry', l1: '막기 II', l2: '흘려 받기', title: '막기 II · 흘려 받기 (우케나가시)', orig: '受け流し', eff: '흘려 받으면 상대 팔이 늦고 기력이 깎인다', pre: ['J2'], price: 300, d: 2, cx: 650, f: ['flow'] }),
      N({ id: 'J10', name: '기다림과 침', cat: 'passive', l1: '패시브', l2: '기다림과 침', eff: '치지 않고 기다릴수록 다음 칼의 피해가 증가한다', pre: ['J9'], price: 0, heads: 5, d: 3, cx: 200, f: ['passive'] }),
      N({ id: 'J4', name: '흘린 칼', cat: 'parry', l1: '막기 III', l2: '흘린 칼', eff: '흘린 공격의 피해가 크게 줄어든다', pre: ['J3'], price: 400, d: 3, cx: 650, f: ['flowShield'] }),
      N({ id: 'J5', name: '고노센', cat: 'secret', l1: '비기', l2: '고노센', eff: '기다리다 상대가 치려 하거나 빠르게 다가올 때 공격하면, 먼저 벤다', pre: ['J4'], price: 400, heads: 10, d: 4, cx: 650, f: ['secret'] }), // 10/31 01:3x 사장님 "'웅크리며' 빼 설명에서" (사람 웅크림 끈 뒤) · 10/25 22:5x 사장님 확정 글(감독 전달) · 전 '간격 밖에서 기다리다 상대가 치려 할 때 공격하면, 먼저 벤다'
    ],
  },
  chinese: {
    nodes: [
      N({ id: 'C1', name: '가벼운 발', cat: 'foot', l1: '보법 I', l2: '가벼운 발', eff: '발을 가볍게 떼고 바로 멈춘다', price: 100, d: 0, cx: 500, f: ['footwork'] }),
      N({ id: 'C2', name: '덜 지치는 걸음', cat: 'foot', l1: '보법 II', l2: '덜 지치는 걸음', eff: '걸을 때 기력이 덜 든다', pre: ['C1'], price: 100, opt: true, d: 1, cx: 110, f: ['stepCost'] }),
      N({ id: 'C3', name: '허리 베기', cat: 'atk', l1: '허리 베기', l2: '강화동작', eff: '가로베기를 그으면 더 힘 있는 허리 베기가 나간다', pre: ['C1'], price: 200, d: 1, cx: 380, u: 'yaoji' }),
      N({ id: 'C7', name: '세 자세 받기', cat: 'parry', l1: '막기 I', l2: '세 자세 받기', eff: '위 · 가운데 · 아래로 오는 칼을 세 자세로 받는다', pre: ['C1'], price: 200, d: 1, cx: 660, f: ['parry', 'parryCover'] }),
      N({ id: 'C11', name: '한양에서 온 편지', cat: 'letter', l1: '한양에서', l2: '온 편지', title: '한양에서 온 편지', pre: ['C1'], price: 100, opt: true, d: 0, cx: 250, letter: true }),
      N({ id: 'C4', name: '깊은 허리 베기', cat: 'deep', l1: '심화', l2: '출혈', title: '허리 베기 심화 · 출혈', eff: '허리를 베는 칼이 몸통에 들면 피를 더 흘린다', pre: ['C3'], price: 300, d: 2, cx: 130, perk: 'yaoji' }), // 10/28 01:1x 사장님 '체보요격과 염시에도 붙여' — 허리 베기 · 끌어 딛고 허리 베기 · 날개 접기 (전 '허리 베기로 몸통을 베면 …')
      N({ id: 'C5', name: '끌어 딛고 허리 베기', cat: 'atk', l1: '끌어 딛고', l2: '허리 베기', eff: '앞으로 끌어 딛으며 가로로 긋는다', pre: ['C3'], price: 300, d: 2, cx: 490, u: 'chebuYaoji' }), // 10/28 00:5x 사장님 '체보요격과 염시 자리 바꿔' — 선도 자리를 따라 격살로 (전 cx 310)
      N({ id: 'C6', name: '날개 접기', cat: 'atk', l1: '날개 접기', l2: '이어 긋기', eff: '물러나는 척 칼을 거두며 나아가 허리를 벤다', pre: ['C3'], price: 300, d: 2, cx: 310, u: 'lianchi' }), // 10/28 00:5x 체보요격과 자리 바꿈 — 특수공격(이어 긋기)은 비기와 다른 줄 (전 cx 490 · 격살 앞 칸) // 10/29 14:1x · 14:2x 사장님 글 (효과)
      N({ id: 'C8', name: '단단한 받기', cat: 'parry', l1: '막기 II', l2: '단단한 받기', eff: '막는 동안 받는 피해가 크게 줄어든다', pre: ['C7'], price: 300, d: 2, cx: 680, f: ['parryCut'] }),
      N({ id: 'C10', name: '숨 바꾸기', cat: 'passive', l1: '패시브', l2: '숨 바꾸기', eff: '휘두르지 않는 동안 출혈이 빨리 잦아든다', pre: ['C7'], price: 0, heads: 5, d: 2, cx: 880, f: ['passive'] }),
      N({ id: 'C9', name: '격살', cat: 'secret', l1: '비기', l2: '격살', eff: '나서며 때맞춰 막으면, 받은 자세의 급소를 깊게 자른다', pre: ['C5', 'C8'], price: 400, heads: 10, d: 3, cx: 590, f: ['secret'] }), // 10/22 격살 (사람 — schools.js CHINESE_SECRET_GYEOKSAL) · 10/24 받아 내면 저절로(글 '막고 공격하면' → '막으면') · 전 '세 번 이어 치기'
    ],
  },
};
// 칸 오의 (사장님 10/22 00:5x '지금과 같은 설명이 아니라 검술서나 참고 문헌에서의 오의를 밝힌 예전 방식이 더 나았던 거 같아' — 10/21 전 스킬북 출처 줄을 칸마다):
//  lore = 그 칸 뒤의 원전이 밝힌 이치 한 줄(원전 말투 · 한글만 · 숫자 · 놀이 셈 · 개발 말 없음 · 45 자 안) · src = 출처 줄 '저자 『책』(연도) — 갈래나 장'(원어 책 이름은 『』 안에서만).
//  상세 카드는 lore + src 를 위에, eff 를 아래 작은 줄로 그린다(화면은 skill_tree.js). 원문 · 쪽 · 저장소 근거 표 = docs/text/skill_lore_2026-10-22.md · 글 규칙 = docs/text/editing_guide.md §4.
//  편지 칸은 출처를 쓰지 않는다(편지에 한한 예외 — 사장님 10/22 01:1x) · 닫힌 칸(열린 유파 밖 비기)도 글은 미리 둔다(화면은 '준비 중').
const NODE_LORE = {
  // 독일 — 리히테나워 운문 (Wiktenauer 'Johannes Liechtenauer' · Tobler 영역)
  G1: { lore: '걸음을 내딛거든 굼뜨지 마라', src: '리히테나워 『Zettel』(14세기) — 속임 베기' },
  G2: { lore: '따라 들기는 두 겹으로 익혀라, 아니면 칼을 베어 들어라', src: '리히테나워 『Zettel』(14세기) — 따라 들기' },
  G5: { lore: '곁눈 베기는 들소 같은 자가 치고 찌르는 것을 꺾는다', src: '리히테나워 『Zettel』(14세기) — 곁눈 베기' },
  G8: { lore: '가로베기를 잘하는 자는 뛰어 딛으며 머리를 위협한다', src: '리히테나워 『Zettel』(14세기) — 가로베기' },
  G3: { lore: '젖혀 막기를 배워, 치고 찌르는 것을 솜씨 있게 막아라', src: '리히테나워 『Zettel』(14세기) — 젖혀 막기' },
  G11: { lore: '뉘른베르크 장인 조합이 네 칼의 길이와 무게를 적어 갔다' }, // 10/23 사장님 '이탈리아 정도를 빼면 편지 내용이 너무 똑같음' (전 '좋은 칼이 나거든 네게 먼저 보내라고 …')
  G7: { lore: '위에서는 겹쳐 치고, 아래에서는 바르게 바꿔 쳐라', src: '리히테나워 『Zettel』(14세기) — 겹치기와 바꾸기' },
  G6: { lore: '세게 몰아치려거든 온몸으로 싸워라', src: '리히테나워 『Zettel』(14세기) — 긴 칼 첫 가르침' },
  G4: { lore: '그에게서 오는 것은 무엇이든 왕관이 걷어 낸다', src: '리히테나워 『Zettel』(14세기) — 정수리 베기와 왕관' },
  G9: { lore: '앞과 뒤가 모든 기예의 샘이니, 약함과 셈, 그 사이라는 말을 새겨라', src: '리히테나워 『Zettel』(14세기) — 앞과 뒤 · 인데스' },
  G10: { lore: '위 자세에서 때가 맞거든, 칼자루 끝으로 쳐라', src: '지그문트 링엑 『Kampffechten』(15세기) — 갑옷 싸움' }, // 10/22 죽음의 일격 (전: 받아 베기 — 리히테나워 v70)
  // 이탈리아 — 카포 페로 (Wiktenauer 'Ridolfo Capoferro' · Wilson · Swanger 영역 / 저장소 원문 PDF 쪽) · 비기 I4 = 파브리스 (Wiktenauer 'Salvator Fabris' 전사 · A. F. Johnson 영역 — 10/22)
  I1: { lore: '박자란 고요와 움직임을 재는 것일 뿐이다', src: '리돌포 카포 페로 『Gran Simulacro』(1610) — 박자' },
  I11: { lore: '시에나의 칼 장인들이 이제 네 이름을 안다' },
  I3: { lore: '왼 다리로 물러서고 오른 다리가 따르면, 상대에게서 안전하다', src: '리돌포 카포 페로 『Gran Simulacro』(1610) — 물러서기' },
  I2: { lore: '그 순간 칼끝을 빼 돌리고 조이며 나아가, 가슴을 찔러라', src: '리돌포 카포 페로 『Gran Simulacro』(1610) — 칼 빼기' }, // 10/31 칼끝 돌려 빼기와 함께 I9 에서 옮김
  I5: { lore: '팔을 잘 뻗어 두면, 상대의 칼을 모두 몸에서 멀리 쳐낸다', src: '리돌포 카포 페로 『Gran Simulacro』(1610) — 막기' },
  I7: { lore: '첫째 자세에서 떠나 상대의 왼 어깨에서 오른 무릎으로, 던지듯 찔러라', src: '리돌포 카포 페로 『Gran Simulacro』(1610) — 찌르기 이름' },
  I6: { lore: '좋은 검객은 막고서 되받아 치지 않는 일이 결코 없다', src: '리돌포 카포 페로 『Gran Simulacro』(1610) — 막고 치기' },
  // I8 헛누름 (10/31 칼끝 돌려 빼기 심화): 오의 비움 — 저장소 원전 읽기표(docs/text/skill_lore_2026-10-22.md · docs/motion/rapier_guards_2026-10-10.md · cavazione 기록)에 '상대가 누를 때 칼을 빼라'는 카포 페로 · 파브리스 줄이 없음 ·
  //  지어내지 않음(감독 10/31) — 원문을 찾으면 넣는다. 화면은 오의 상자를 숨기고 효과만(skill_tree.js). 전 오의 '언제나 찌르기로 쳐라, 찌르기가 더 치명적이다'(카포 페로 — 찌르기 · 틈 파고들기)
  I9: { lore: '몸을 비켜 빼며, 넷째 자세로 돌려 찌른다', src: '리돌포 카포 페로 『Gran Simulacro』(1610) — 그림 풀이' }, // 10/31 비껴서며 찌르기와 함께 I2 에서 옮김
  I4: { lore: '팔을 굳게 두고 상대 칼날을 놓지 말고, 따라 미끄러져 몸까지 가라', src: '살바토르 파브리스 『Lo Schermo』(1606) — 결연히 나아가기' }, // 10/22 거침없이 나아가 찌르기 (전 엇박 찌르기 — 카포 페로)
  I10: { lore: '곧은 선은 하나이니, 기예를 아는 자만이 그것을 긋는다', src: '리돌포 카포 페로 『Gran Simulacro』(1610) — 곧은 선' },
  // 이베리아 — 피게이레두 몬탄테 (Wiktenauer 'Diogo Gomes de Figueyredo' · Myers · Hick 영역) · 고디뉴 몬탄테 장 (저장소 독일어 역 인용)
  B1: { lore: '박자 맞고 무게 실린 잰 걸음으로 가되, 춤추듯 걷지 마라', src: '고디뉴 『Arte de Esgrima』(1599) — 몬탄테 장' },
  B2: { lore: '오른발을 오른쪽 끝없는 선으로 옮기고, 왼발이 따르게 하라', src: '피게이레두 『Memorial da Prattica do Montante』(1651) — 복합 규칙 12' },
  B10: { lore: '왼손을 낮춰 몸에 붙여 굳게 하면, 칼이 더 큰 힘으로 나간다', src: '피게이레두 『Memorial da Prattica do Montante』(1651) — 복합 규칙 13' },
  B3: { lore: '같은 오른발을 다시 들이며, 왼발 위로 나사처럼 돌아 걸어라', src: '피게이레두 『Memorial da Prattica do Montante』(1651) — 단순 규칙 13' },
  B4: { lore: '칼을 어깨에 감아 두었다가, 위에서 아래로 내려 베어라', src: '피게이레두 『Memorial da Prattica do Montante』(1651) — 복합 규칙 15' }, // 10/31 19:xx B4 다시 짬 — 피 복ⅩⅤ 「altibaxo pella mesma parte esquerda cingindo o montante ao hombro esquerdo」 · 「altibaxo para vir a cingir o montante com o braço dereyto」(docs/motion/iberian_montante_2026-10-10.md 원문 표)를 줄여 옮김 [풀이] · 'altibaxo forte' 는 이 낱말로 지은 이름(검술서 말 아님) · 전 복합 규칙 2 머리 위로 넘겨 둘러 벰
  B8: { lore: '맞선 무기가 오는 쪽에 따라, 탈류로 아니면 레베스로 쳐내라', src: '피게이레두 『Memorial da Prattica do Montante』(1651) — 단순 규칙 14' },
  B11: { lore: '부두에 큰 칼이 내릴 때마다, 선원들이 네게 먼저 보이자고 한다' }, // 10/23 (전 '리스본 항구에 큰 칼이 들거든, …')
  B5: { lore: '탈류에서 다른 탈류가 나고, 레베스에서 다른 레베스가 난다', src: '피게이레두 『Memorial da Prattica do Montante』(1651) — 맺음말' },
  B9: { lore: '큰 칼의 쳐내기와 막기와 치기는 모두 몸놀림이 거들어야 한다', src: '피게이레두 『Memorial da Prattica do Montante』(1651) — 복합 규칙 6' },
  B7: { lore: '큰 칼로 갈비를 온통 휘감고, 온몸을 돌려라', src: '고디뉴 『Arte de Esgrima』(1599) — 몬탄테 장 규칙 8' }, // 10/22 휘감아 돌기 (전 길목 지키기 — 피게이레두 단순 규칙 7)
  B6: { lore: '걸음마다 한 칼씩, 늘 아래에서 위로, 사람들이 멈출 때까지 번갈아 쳐라', src: '피게이레두 『Memorial da Prattica do Montante』(1651) — 복합 규칙 7' },
  // 일본 — 오륜서 · 병법가전서 · 일본검도형 (사장님이 주신 원본 읽기표 — docs/motion/schools/)
  J1: { lore: '발끝을 조금 띄우고 뒤꿈치를 세게 디뎌, 늘 걷듯이 걸어라', src: '미야모토 무사시 『오륜서』(1645) — 물의 권 발 쓰기' },
  J6: { lore: '벨 때도 물러설 때도 받을 때도, 좌우를 번갈아 디뎌라', src: '미야모토 무사시 『오륜서』(1645) — 물의 권 음양의 발' },
  J7: { lore: '적이 치고 들 때, 아래에서 그 손을 쳐라', src: '미야모토 무사시 『오륜서』(1645) — 물의 권 다섯 겉' },
  J2: { lore: '받는 것도 쳐내는 것도 붙는 것도, 모두 적을 베는 계기로 여겨라', src: '미야모토 무사시 『오륜서』(1645) — 물의 권 자세 있고 자세 없음' },
  J11: { lore: '도공이 새 칼을 벼리다 말고, 이 칼의 주인은 너라 하였다' }, // 10/23 (전 '좋은 칼은 좋은 손을 찾아간다고, …')
  J9: { lore: '빗나간 칼을 그대로 두었다가, 적이 칠 때 아래에서 퍼 올려 쳐라', src: '미야모토 무사시 『오륜서』(1645) — 물의 권 다섯 겉' },
  J8: { lore: '적의 칼을 세게 치고 그대로 붙어 칼끝을 내려 치면, 칼은 반드시 떨어진다', src: '미야모토 무사시 『오륜서』(1645) — 물의 권 단풍 치기' }, // 10/24 칼 떨구기로 열며 (전: 다섯 겉 셋째 '손을 친 칼을 적이 쳐 떨구려 하면, …' — 다른 기술)
  J3: { lore: '적의 눈을 찌르듯 하며, 그 칼을 오른 어깨로 끌어 흘려 받아라', src: '미야모토 무사시 『오륜서』(1645) — 세 가지 받기' },
  J10: { lore: '몸과 발은 걸어 들고, 칼은 기다린다', src: '야규 무네노리 『병법가전서』(1632) — 걸기와 기다림' },
  J4: { lore: '몸을 왼쪽으로 열며, 칼 옆면으로 흘려 받는다', src: '『일본검도형』(1912) — 소태도 둘째 본' },
  J5: { lore: '적이 내게 걸어올 때의 앞섬, 이를 기다림의 앞섬이라 한다', src: '미야모토 무사시 『오륜서』(1645) — 불의 권 세 가지 앞섬' },
  // 동방 — 조선세법(무비지) · 무예도보통지 예도 · 장자 (사장님이 주신 원본 읽기표 — docs/motion/schools/)
  C1: { lore: '한 걸음 한 걸음, 잰걸음으로 파고든다', src: '모원의 『무비지』(1621) 권86 조선세법 — 게격세' },
  C2: { lore: '열 걸음에 한 사람을 베고, 천 리를 가도 걸음을 멈추지 않는다', src: '『장자』 설검편' },
  C3: { lore: '몸과 걸음과 손과 칼이 빠른 우레 같으니, 이 한 칼이 칼의 으뜸이다', src: '모원의 『무비지』(1621) 권86 조선세법 — 요격세' },
  C7: { lore: '손을 굴려 이어 가며 위아래를 막는다', src: '모원의 『무비지』(1621) 권86 — 검결가' },
  C11: { lore: '훈련도감 군기 장부 끝에 네 이름을 올려 두었으니 기다려라' }, // 10/23 (전 '훈련도감에 쓸 만한 칼이 들면, …')
  C4: { lore: '가로로 내질러 가운데를 죽이는 것이 그 법이다', src: '『무예도보통지』(1790) 권2 예도 — 요격세' },
  C5: { lore: '앞발을 내딛고 뒷발을 끌어 붙이며, 나아가 허리를 친다', src: '모원의 『무비지』(1621) 권86 조선세법 — 체보' },
  C6: { lore: '거짓으로 지는 척 적을 꾀어, 물러나다 문득 나아가 허리를 친다', src: '모원의 『무비지』(1621) 권86 조선세법 — 염시세' },
  C8: { lore: '솥을 들 듯 막아 위로 죽이는 것이 그 법이다', src: '『무예도보통지』(1790) 권2 예도 — 거정세' },
  C10: { lore: '숨을 불고 내쉬어, 묵은 것을 뱉고 새것을 들인다', src: '『장자』 각의편 — 토고납신' },
  C9: { lore: '수레를 몰 듯 막아, 가운데를 죽이고 두 손을 깎아 죽인다', src: '모원의 『무비지』(1621) 권86 조선세법 — 어거세' }, // 10/22 격살 (전 봉두세 「洗刺剪殺」 — 세 번 이어 치기)
};
// 칸 입력 줄 (사장님 10/24 14:1x '커맨드가 있는 공격은 스킬 설명 최하단에 커맨드 적어. 최대한 단순하고 이해하기 쉽게 적어봐' →
//  10/25 17:3x '스킬창에서 모든 커맨드 설명은 도식으로 단순화 해. 이런 구조로 써. - 커맨드: 우측 이동(→)과 동시에 베기' · ''커맨드'는 '입력'으로 바꾸자' ·
//  17:4x '베기는 사선 베기 수직 베기 수평 베기 이렇게 구분해. 찌르기는 그냥 찌르기' · 17:5x ''아무 베기'가 찌르기까지 포함하는 아무 공격인 것이면 베기 대신 공격이라고 써' ·
//  18:3x '그럼 입력 설명에서는 베기와 찌르기라는 말 대신 긋기와 탭이라고 하자'):
//  정해진 입력으로 내는 칸만 — 고유 공격 · 비기 · 막아찌르기(I6) · 박차기 걸음(G1 · B2) · 간격 잡기(G2). 저절로 붙는 칸(패시브 · 심화 · 편지 · 걷기 맛 · 막기 자리 · 막는 동안 피해 감소 · 흘림)은 없음.
//  상세 카드 맨 아래 한 줄 '입력: …'(이름표 '입력:' 은 화면 skill_tree.js — 닫힌 칸은 안 보임). 도식 낱말 = 손이 하는 것만(베기 · 찌르기 같은 칼 동작 말은 쓰지 않음):
//   이동 스틱 = 앞으로 이동(↑) · 뒤로 이동(↓) · 좌우 이동(←/→) · 끌기 = 긋기 — 길이 정해진 것은 길 꼴 + 끄는 쪽: 사선 긋기(↙) · 수평 긋기(←) · 수직 긋기(↓)
//   (화살표 = 화면(손가락) 쪽 = 손 목표 x · y — main.js handOffset · 자세 패드 G 와 같은 축 · 꼴은 기본 동작 길(ai_techniques.js TECH)의 방향이 축에서 22.5° 안이면 수평 · 수직, 아니면 사선) ·
//   톡 = 탭 · 막기 단추 = 막기 · 비기 창의 금빛 '!' = 느낌표(!) · 탭도 긋기도 되는 자리 = 공격(긋기만 되면 긋기 · 탭만 되면 탭).
//  잇는 말은 '…과 동시에 …' · '…하면 …' · '…다 …'. 숫자 · 원어 글자 없음. 길이 · 기호 · 낱말은 시험이 본다.
//  10/25 22:3x · 23:1x 비기 칸 다섯(I4 · B7 · J5 · C9 · G10)은 사장님 확정 글 그대로: 창이 열리는 것 = '비기 활성화'(사장님 4] '활성화 앞에 '비기'를 붙여줘') · 기다리는 시간 숫자(2초) ·
//   '움직이면(↑/↓)' · '움직이며(↑)' · 원 긋기(↻/↺) · '·' 나눔 · 33 자를 넘으면 카드에서 두 줄 — 시험은 이 다섯을 글 그대로 + 코드 조건(시간 · 스틱 · 받는 입력)과 맞는지로 본다.
//  근거(코드 자리)와 표 = docs/text/skill_cmd_2026-10-24.md · 시험 tools/sim/skill_cmd.test.mjs(입력 조건 · 기본값 · 길 꼴 · 받는 입력과 글이 맞는지). eff · lore 는 건드리지 않는다.
const NODE_CMD = {
  // 독일
  G1: '멈춘 상태에서 뒤로 이동(↓)', // gait.js 첫 걸음 박차기 — 서 있던 몸 · 스틱 뒤(뒤 몫 ≥ 옆 몫) · 독일 보법
  G2: '상대가 헛치면 앞으로 이동(↑)', // gait.js foeWhiff → 받을 창 안의 첫 앞 걸음이 빠른 디딤 둘
  G5: '사선 긋기(↙)', // 곁눈 베기 ← 분노의 베기(어깨 지붕 → 왼 아래 — ai_techniques.js zornhau)
  G8: '좌우 이동(←/→)과 동시에 수평 긋기(←)', // 걸음 명령 stick 'side'(옆 몫 ≥ 0.5 · 어느 쪽이든) + 가로베기(zwerch — 옆 자세 → 왼 옆)
  G7: '가까이서 칼을 맞댄 채 버티면 자동 발동', // 겹치기 자동 (사장님 10/31 18:xx '… 초안 ok.' — 확인표 3272 · 3227): unique_assist.js dupAutoTick 'bind' — 가슴 사이 0.8 m 넘고 1.6 m 이하에서 칼끼리 맞댄 채 0.6 s 쌓이면 저절로 · C9 '… 자동 발동' 꼴 (전 '긋기가 상대 칼에 닿은 채 탭' — 아래 G7_CMD_TAP)
  G10: '상대와 몸이 붙은 채 2초 이상 밀치면(↑) 비기 활성화', // 10/25 23:1x 사장님 확정 글(감독 전달 — 글 속 시간 = SECRET.mordPress 2 · 걸쇠 없앰 CLOSE.latch 0) — secret.js pressTick 밀치기 누르기(fighter.js closeStep — 닿는 거리 안에서 스틱 앞 · 끊겨도 mordGrace 0.4 s(10/27 21:4x — 전 0.2) 안에 다시 누르면 이어 셈) mordPress 초 → 창(비기 활성화) → 탭 · 긋기 둘 다(main.js) · 전 '붙은 채 멈췄다 앞으로 이동(↑), 느낌표(!)가 뜨면 공격'
  // 이탈리아
  I7: '아래로 내려 긋기(↓/↙/↘)', // 10/31 12:xx 사장님 'I7은 어떤 방향이나 높이에서든 다른 유파의 내려 긋는 베기에 해당하는 커맨드를 내려찌르기로 전환' (글 = 감독 안 · 사장님 검수 전) — unique_assist.js PLAYER_UNIQUE imbroccata on { down } · 아래로 가는 긋기(곧장 아래 ↓ · 사선 아래 ↙/↘ — 아래 축에서 67.5° 안: 수평 22.5° 띠 밖) 모두 · 어느 자세 · 높이에서든 · 전 '머리 높이에서 사선 긋기(↙)'(황소 찌르기 긋기 stichOchs 만)
  I2: '칼이 상대 칼에 닿은 채 박자를 맞추어 탭', // 10/31 칼끝 돌려 빼기 (감독 안 · 사장님 검수 전) — unique_assist.js TAP_TRIG.cav: 칼끼리 실제로 닿은 한 닿음(touchTick — feel.touching)의 처음부터 cavFrom(실제 0.2 s) · 마지막 닿음에서 cavTo(1.2 s) 안의 탭 · 이른 탭은 그 기회를 없앰('박자') · 내 긋기 동안의 닿음은 셈 밖 · 10/31 I2 → I7 (사장님 '임브로카타를 먼저') · 칸 처음 판 I9 '막기로 찌른 칼이 빗나가면 박자를 맞추어 탭'
  I6: '막기', // italian_opposition.js — 막기 단추 새 누름 한 번에 곧장
  I9: '상대가 공격해 올 때 옆으로 움직이며(←/→) 탭', // 10/31 탭으로 내는 특수 공격 비껴서며 찌르기 (감독 안 · 사장님 검수 전) — unique_assist.js TAP_TRIG.inq: 상대 칼이 들어오는 동안(막기 단추가 읽는 위협 — 마지막 위협에서 inqThreat 안) 스틱 옆(옆 몫 ≥ 0.5 · 앞뒤 몫 이상)인 채의 탭 · 전 '막기로 찌른 칼이 빗나가면 박자를 맞추어 탭'(10/29 14:1x · 14:2x 사장님 글 — 칼끝 돌려 빼기)
  I4: '칼을 맞대고 상대 걸음 따라 움직이면(↑/↓) 비기 활성화', // 10/28 18:3x 사장님 '라솔루토 설명은 1' — 상대 걸음에 맞춰(italian_risoluto.js risolutoMirror) · 전 '칼 길이 바깥에서 칼을 맞대고 움직이면(↑/↓) 비기 활성화'(10/25 22:3x 사장님 확정 글(4] '활성화 앞에 '비기'') — italian_risoluto.js 덮인 채 나아가기(칼끼리 risolutoCover 안 · 스틱 앞이나 뒤 risolutoStick 'both') · 가슴 사이 ≥ 맞닿기 거리(lungeGapOk — '칼 길이 바깥') → 창(비기 활성화) → 공격(탭 · 긋기 — risolutoTap 0) · 전 '칼을 맞댄 채 앞으로 이동(↑), 느낌표(!)가 뜨면 탭'
  // 이베리아
  B2: '좌우 이동(←/→)', // gait.js 옆 누르면 첫 걸음에 늘 옆 박차기(burstWalkSide · sideDash)
  B3: '좌우 이동(←/→)과 동시에 사선 긋기(↙)', // 걸음 명령 stick 'side' + 분노의 베기(zornhau)
  B4: '탭을 길게 누르다 떼기', // 풍차 베기 — unique_assist.js holdTick: 탭(PC 왼 단추)을 끌지 않고 rdHoldTime 넘게 누르면 머리 위로 감기 · 그동안 걸음 그대로 · 떼면 내려침 · 10/29 14:1x · 14:2x 사장님 글 (전 '탭을 길게 누른 채 이동하다 떼기' · 그 전 '수평 긋기(→)' — 머리 위 돌려 베기 ← 왼 가로베기 · AI 몫)
  B5: '긋기를 쉬지 않고 이어 가기', // fighter.js updateIbFlow — 앞 휘두르기(긋기) 뒤 이어짐 창 안에 다시 휘두름 · 휘두르며 둥글게 꺾음(탭은 휘두르기가 아님)
  B7: '칼 길이 바깥에서 2초 기다리면 비기 활성화 · 원을 그리며 긋기(↻/↺)로 발동', // 10/25 22:3x 사장님 확정 글(4] '비기' · 5] 2초) — secret.js spinTick 무장(칼끝 거리 밖 SECRET.ibSpin.armTime 2 초 — 금빛 '!' = 비기 활성화) → spinCircle 긋기로 원 한 바퀴(어느 쪽이든 — SECRET.ibSpin.input 'attackCircle' · 탭은 보통 공격) · 전 '거리 밖에서 버티다 느낌표(!)가 뜨면 원을 그리며 긋기'
  // 일본
  J6: '좌우 이동(←/→)과 동시에 사선 긋기(↘)', // 걸음 명령 stick 'side' + 왼 분노의 베기(zornhauL)
  J7: '가운데서 짧게 수직 긋기(↓)', // 손목 치기 ← 긴 자세(가운데) 자리에서 아래로(pad langort · dir down)
  J9: '내려 긋기가 안 맞으면 바로 수직 긋기(↑)', // 이어 긋기 — 정수리 · 좌우 분노의 베기(내려 긋기)가 못 맞힘(막힘 포함) 뒤 afterWindow 안의 위로 긋기
  J5: '아무 행동 없이 2초 기다리면 준비 활성화, 상대가 내 간격에서 공격을 시도하거나 빠르게 움직이면 비기 활성화', // 10/25 22:3x 사장님 글 그대로 — secret.js 발도 대기(gnsArmTick 'idle' — 이동 입력 · 공격 · 막기 · 맞음 · 비기 없이 iaiArmTime 2 초 — '고노센 준비' · 22:5x 준비된 뒤엔 걸어도 유지) → 상대가 칼을 듦 · 헛침 · 빠르게 움직임(foeCharge) + 내 발도가 닿는 거리 안 → 창(비기 활성화) → 탭 · 긋기 둘 다(main.js) · 전 '거리 밖에서 기다리다 느낌표(!)가 뜨면 공격'
  // 동방
  C3: '수평 긋기(←)', // 허리 베기 ← 가로베기(zwerch)
  C5: '앞으로 이동(↑)과 동시에 수평 긋기(←)', // 걸음 명령 stick 'fwd'(앞 몫 ≥ 0.5) + 가로베기(zwerch)
  C6: '뒤로 움직이며(↓) 탭', // 탭으로 내는 특수 공격 — unique_assist.js TAP_TRIG.lian: 물러나는 동안(스틱 뒤) · 놓고 실제 0.6 s 안의 탭 (10/28 01:2x) · 10/29 14:1x · 14:2x 사장님 글 (전 '사선 긋기(↖) 도중 바로 방향 꺾기')
  C9: '앞으로 움직이며(↑) 상대 공격을 정확한 타이밍에 막으면 자동 발동', // 10/25 22:3x 사장님 확정 글(감독 전달) · 전 '앞으로 이동(↑)과 동시에, 칼이 닿기 직전 막기' — secret.js gyeoksalTick — 막기 새 누름 뒤 gyeoksal.press 초 안에 칼이 닿음 · 그때 스틱 앞 · 받아 내면 저절로(gyeoksal.auto — 공격 입력 없음)
};
// G7 다른 판 입력 줄 (UNIQUE_ASSIST.dupAuto 를 기본 'bind' 에서 바꿨을 때만 카드에 나옴 — nodeCmd): 0 = 전 판 맞물린 채 탭(10/29 14:1x · 14:2x 사장님 글) · 'clash2' = 두 번 맞부딪힘 시제품 초안(검수 전) · 효과 글(eff — 사장님 글)은 그대로
export const G7_CMD_TAP = '긋기가 상대 칼에 닿은 채 탭';
export const G7_CMD_AUTO = { bind: NODE_CMD.G7, clash2: '칼끼리 연달아 부딪히면 자동 발동' /* [검수 전] */ };
/** 상세 카드 입력 줄 (skill_tree.js — 얼린 칸의 cmd · 겹치기 자동 판을 바꿨으면 G7 은 그 판 글) */
export const nodeCmd = (n) => (n?.id !== 'G7' ? n?.cmd : !UNIQUE_ASSIST.dupAuto ? G7_CMD_TAP : G7_CMD_AUTO[UNIQUE_ASSIST.dupAuto] ?? n.cmd);
/** 칸 + 오의 (lore · src — 편지는 lore 만) + 입력 줄 (cmd — 정해진 입력으로 내는 칸만) */
const withLore =(n) => Object.freeze({ ...n, ...NODE_LORE[n.id], ...(NODE_CMD[n.id] ? { cmd: NODE_CMD[n.id] } : {}) });
/** 유파 → { gate?, nodes } (얼림) */
export const TREE = Object.freeze(Object.fromEntries(Object.entries(TREE_SRC).map(([s, t]) => [s, Object.freeze({ ...t, nodes: Object.freeze(t.nodes.map(withLore)) })])));

export const nodesOf = (school) => TREE[school]?.nodes ?? [];
export const nodeOf = (school, id) => nodesOf(school).find((n) => n.id === id) ?? null;
/** 칸 id → 유파 (G1 → german …) */
export function schoolOfNode(id) {
  for (const s of TREE_SCHOOLS) if (nodeOf(s, id)) return s;
  return null;
}
/** 닫힌 칸('준비 중' — 살 수 없음 · 판 몫 없음): 비기 = SECRET.openSchools 에 없는 유파 · 그 밖 = closed 칸(지금 없음 — 일본 J8 은 10/24 열림) */
export const isClosed = (school, node) => (node?.cat === 'secret' ? !SECRET.openSchools.includes(school) : !!node?.closed);
/** 먼저 익힐 칸을 모두 익혔나 (뿌리는 늘 참) */
export const prereqsMet = (node, learned) => node.pre.every((id) => learned.has(id));

/**
 * 칸 상태: 'learned'(익힘) · 'closed'(준비 중) · 'open'(배울 수 있음 — 앞 칸을 모두 익힘) · 'locked'(앞 칸이 모자람)
 *  learned = 이 유파의 익힌 칸 id 모음
 */
export function nodeState(school, node, learned) {
  if (learned.has(node.id)) return 'learned';
  if (isClosed(school, node)) return 'closed';
  return prereqsMet(node, learned) ? 'open' : 'locked';
}
/** 배울 수 있나 — { ok, why }: why = 'learned' · 'closed' · 'pre'(앞 칸) · 'coins' · 'heads' · 'bad' */
export function canLearn(school, node, learned, { coins = 0, heads = 0 } = {}) {
  if (!node) return { ok: false, why: 'bad' };
  const st = nodeState(school, node, learned);
  if (st === 'learned') return { ok: false, why: 'learned' };
  if (st === 'closed') return { ok: false, why: 'closed' };
  if (st === 'locked') return { ok: false, why: 'pre' };
  if (coins < node.price) return { ok: false, why: 'coins' };
  if (heads < node.heads) return { ok: false, why: 'heads' };
  return { ok: true, why: null };
}

/**
 * 익힌 칸 → 판 몫 (사람만 — main.js newRound 가 몸에 skillKit 으로 넣는다 · skill_kit.js kitOff 가 읽는다).
 *  school = 손에 든 무기 유파 · ids = 이 유파의 켤 칸 id 모음(닫힌 칸은 늘 뺀다). 유파 칸이 없는 무기(무유파)는 null — 유파 몫이 원래 없다(지금 그대로).
 *  돌려줌 { school, footwork … secret: bool, unique: Set<고유 공격 이름>, perk: Set<강화동작 이름> } — 칸 하나가 제 몫만 켠다(IMPLEMENTATION.md §2 표)
 */
export function kitFromNodes(school, ids) {
  if (!TREE_SCHOOLS.includes(school)) return null;
  const kit = { school, unique: new Set(), perk: new Set() };
  for (const k of KIT_KEYS) kit[k] = false;
  for (const n of nodesOf(school)) {
    if (!ids.has(n.id) || isClosed(school, n)) continue;
    for (const k of n.f) kit[k] = true;
    if (n.u) kit.unique.add(n.u);
    if (n.perk) kit.perk.add(n.perk);
  }
  return kit;
}
/** 이 유파의 칸 id 모두 (테스트 경로 = 모두 익힘) */
export const allNodeIds = (school) => new Set(nodesOf(school).map((n) => n.id));
/** 개발 인자 `?uniqueStage=N` → 옛 급 N 까지의 칸(보법 1 · 막기 2 · 고유 공격 · 심화 3 · 패시브 4 · 비기 5 — 편지는 판 몫이 없어 뺌). 0 = 칸 없음 */
export const nodesUpToStage = (school, n) => new Set(nodesOf(school).filter((x) => NODE_CAT[x.cat].stage != null && NODE_CAT[x.cat].stage <= n).map((x) => x.id));
/** 개발 인자 `?skillNodes=G1,G5` → 그 무기 유파의 칸만 (모르는 id · 다른 유파 칸은 버림) · 'all' = 모두 · 없으면 null */
export function nodesParam(raw, school) {
  if (raw == null) return null;
  if (raw === 'all') return allNodeIds(school);
  return new Set(String(raw).split(',').map((s) => s.trim()).filter((id) => nodeOf(school, id)));
}

// ── 편지 (사장님 결정 '칸마다 무게' — 뽑기 칸마다 무게 = 그 등급 TIER_DRAW ÷ 그 등급 칸 수 · 편지 유파 칸 × config LETTER.mult · 모든 등급에서 한 번에 — weapons.js drawWeaponCards) ──
/** 익힌 칸 모음(유파 → Set) → 편지를 가진 유파 모음 */
export function letterSchools(learnedBySchool) {
  const out = new Set();
  for (const s of TREE_SCHOOLS) for (const n of nodesOf(s)) if (n.letter && learnedBySchool[s]?.has(n.id)) out.add(s);
  return out;
}
/** 무기 유파 → 뽑기 칸 무게 배율 (편지가 있으면 config LETTER.mult · 아니면 1 — 무유파 무기도 1) */
export const letterMul = (school, letters) => (letters?.has(school) ? LETTER.mult : 1);
/** 칸 효과 한 줄 — 편지는 배율(config LETTER.mult)을 읽어 쓴다 (값이 바뀌어도 글이 맞게) */
export const nodeEff = (school, n) => (n.letter ? `${SCHOOL_KO[school]} 무기 카드가 더 자주 나온다` : n.eff);
export const SCHOOL_KO = Object.freeze({ german: '독일', italian: '이탈리아', iberian: '이베리아', japanese: '일본', chinese: '동방' }); // schools.js TRADITIONS.*.nameKo 와 같은 말 (이 파일은 schools.js 를 들여오지 않는다) · 호칭 알림 글도 씀(title_rules.js)

// 스킬트리 자료 · 규칙 (10/21 사장님 확정 — docs/design/skill_tree_2026-10-21/README.md · data.mjs 가 원본 · 이 파일 = 게임이 읽는 판)
//  유파마다 11 칸 · 뿌리 = 보법 I · pre = 먼저 익힐 칸 '모두'(독일 2단계 관문 · 이탈리아 보법 II 줄기 · 이베리아 패시브 → 비기 · 독일 보법 II → 패시브 → 비기가 이미 여기 들어 있다).
//  값(사장님 10/21 19:0x): 편지 금화 100 · 패시브 머리 10(금화 없음) · 보법 II 금화 100 · 비기 금화 400 + 머리 20 · 나머지는 깊이마다 금화 — data.mjs 그대로.
//  닫힌 칸: 비기는 SECRET.openSchools(config — 10/22 사람 쪽 다섯 유파 모두: 일본 · 독일 · 이탈리아 · 이베리아 · 동방)에 없으면 '준비 중'(사람 · 살 수 없음 — 10/21 20:xx) · 일본 J8 손목 치기 심화는 이점이 아직 없어 '준비 중'(확인표 2107).
//  칸 → 판 몫(아래 f · u · perk): 칸 하나가 제 몫 하나만 켠다 — 몫 열쇠는 skill_kit.js kitOff 가 싸움 코드에서 읽는다(사람만 · AI 는 숙련도 그대로).
//   표 · 근거: IMPLEMENTATION.md §2 · docs/strike/school_kit_map.md §2 '스킬트리'. 글(l1 · l2 · eff)은 화면 글 지침(docs/text/editing_guide.md) — data.mjs eff 는 설계 메모라 고쳐 씀.
//  이 파일은 저장 · 화면을 모른다(시험이 바로 읽음) — 저장은 skill_tree_store.js · 화면은 skill_tree.js.
import { SECRET, LETTER } from './config.js';

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
export const KIT_KEYS = Object.freeze(['footwork', 'chase', 'backFlat', 'burstSide', 'stepCost', 'parry', 'parryCover', 'parryCut', 'opposition', 'flow', 'flowShield', 'ibFlow', 'passive', 'secret']);

export const RESET_HEADS = 1; // 유파 초기화 값 — 머리 1 (사장님 10/21)

// 칸 하나: id · cat · pre(모두) · price(금화) · heads(머리) · opt(곁가지 — 점선) · closed(늘 닫힘) · d(줄) · cx(가로 0~1000 — data.mjs 그대로)
//  편지 다섯은 뿌리(보법 I)와 같은 줄 왼쪽 — d 0 · cx 250 (사장님 10/22 02:1x '어디 어디에서 온 편지 아이콘은 가장 처음에 배우게 되는 보법 아이콘 왼쪽으로 수평으로 점선을 뺀 다음에 똑같은 높이에') · 앞 칸은 그대로 뿌리
//  name = 트리 판 칸에 보이는 기술 이름 (사장님 10/22 '보법1 보법2 이런 건 우리가 보려고 만든 범주 구분 … 아이콘만 보이거나 기술 이름이 보이는 게' — 갈래(보법 I · 막기 II · 패시브 …)는 상세 카드에만)
//  l1 · l2 = 옛 판 칸의 두 줄(갈래 · 이름 — 알림 · 읽기 이름에 남음) · title · orig = 상세 카드 제목(없으면 두 줄 · 원어는 대기실 스킬에서만 — 화면 글 지침 §1) · eff = 상세 카드 효과 한 줄 · lore · src = 오의 한 줄 · 출처(아래 NODE_LORE — 10/22) · f = 켜는 몫 열쇠 · u = 켜는 고유 공격(unique_assist.js PLAYER_UNIQUE name) · perk = 켜는 강화동작 이점 · letter = 편지
const N = (o) => Object.freeze({ pre: [], heads: 0, ...o, pre: Object.freeze(o.pre ?? []), f: Object.freeze(o.f ?? []) });
const TREE_SRC = {
  german: {
    gate: { from: ['G5', 'G8', 'G3'], to: ['G7', 'G6', 'G4'] }, // 2단계 셋을 모두 익히면 3단계가 열림 (사장님 18:5x — 그림의 금색 띠)
    nodes: [
      N({ id: 'G1', name: '뒤 박차기', cat: 'foot', l1: '보법 I', l2: '뒤 박차기', eff: '서 있다가 뒤로 밀면 첫 걸음을 박찬다', price: 100, d: 0, cx: 500, f: ['footwork'] }),
      N({ id: 'G2', name: '간격 잡기', cat: 'foot', l1: '보법 II', l2: '간격 잡기', eff: '상대가 헛치면 두 걸음 빠르게 들어가 선다', pre: ['G1'], price: 100, d: 1, cx: 100, f: ['chase'] }),
      N({ id: 'G5', name: '곁눈 베기', cat: 'atk', l1: '곁눈 베기', l2: '강화동작', eff: '분노의 베기를 그으면 더 힘 있는 곁눈 베기가 나간다', pre: ['G1'], price: 200, d: 1, cx: 310, u: 'schielhau' }),
      N({ id: 'G8', name: '비껴 딛는 가로베기', cat: 'atk', l1: '비껴 딛는', l2: '가로베기', eff: '옆으로 걸으며 가로로 긋는다', pre: ['G1'], price: 200, d: 1, cx: 500, u: 'zwerchAbtritt' }),
      N({ id: 'G3', name: '세워 받기', cat: 'parry', l1: '막기 I', l2: '막기 자리', eff: '오는 칼 쪽에 칼을 세워 받는다', pre: ['G1'], price: 200, d: 1, cx: 690, f: ['parry'] }),
      N({ id: 'G11', name: '뉘른베르크에서 온 편지', cat: 'letter', l1: '뉘른베르크', l2: '온 편지', title: '뉘른베르크에서 온 편지', pre: ['G1'], price: 100, opt: true, d: 0, cx: 250, letter: true }),
      N({ id: 'G7', name: '겹치기', cat: 'atk', l1: '겹치기', l2: '이어 긋기', eff: '칼이 맞물리면 곧바로 다시 그어 들어간다', pre: ['G5', 'G8', 'G3'], price: 300, d: 2, cx: 310, u: 'duplieren' }),
      N({ id: 'G6', name: '무릎 꺾기', cat: 'deep', l1: '심화', l2: '무릎 꺾기', title: '곁눈 베기 심화 · 무릎 꺾기', eff: '곁눈 베기에 맞은 상대가 무릎을 꿇기도 한다', pre: ['G5', 'G8', 'G3'], price: 300, d: 2, cx: 500, perk: 'schielhau' }),
      N({ id: 'G4', name: '왕관', cat: 'parry', l1: '막기 II', l2: '왕관', title: '막기 II · 왕관 (크론)', orig: 'Kron', eff: '머리 위로 오는 칼을 칼자루로 받는다', pre: ['G5', 'G8', 'G3'], price: 300, d: 2, cx: 690, f: ['parryCover'] }),
      N({ id: 'G9', name: '인데스', cat: 'passive', l1: '패시브', l2: '인데스', eff: '상대가 헛치거나 막힌 직후에 친 칼은 피해가 증가한다', pre: ['G2'], price: 0, heads: 10, d: 2, cx: 100, f: ['passive'] }),
      N({ id: 'G10', name: '모르트슐라크', cat: 'secret', l1: '비기', l2: '모르트슐라크', eff: '붙어서 밀다가 공격하면, 거꾸로 쥔 칼자루로 머리를 내리친다', pre: ['G9', 'G7', 'G4'], price: 400, heads: 20, d: 3, cx: 420, f: ['secret'] }), // 10/22 사장님 '독일은 죽음의 일격으로 하자' (옛 받아 베기 — AI 몫 · `?deMord=0`)
    ],
  },
  italian: {
    nodes: [
      N({ id: 'I1', name: '박자 걸음', cat: 'foot', l1: '보법 I', l2: '박자 걸음', eff: '짧게 두 번, 길게 두 번 박자를 타며 걷는다', price: 100, d: 0, cx: 500, f: ['footwork'] }),
      N({ id: 'I11', name: '시에나에서 온 편지', cat: 'letter', l1: '시에나에서', l2: '온 편지', title: '시에나에서 온 편지', pre: ['I1'], price: 100, opt: true, d: 0, cx: 250, letter: true }),
      N({ id: 'I3', name: '물러서기', cat: 'foot', l1: '보법 II', l2: '물러서기', eff: '뒤로 걸어도 느려지지 않는다', pre: ['I1'], price: 100, d: 1, cx: 500, f: ['backFlat'] }),
      N({ id: 'I2', name: '비껴서며 찌르기', cat: 'atk', l1: '비껴서며', l2: '찌르기', eff: '옆으로 걸으며 찌른다', pre: ['I3'], price: 200, d: 2, cx: 330, u: 'inquartata' }),
      N({ id: 'I5', name: '뻗어 받기', cat: 'parry', l1: '막기 I', l2: '막기 자리', eff: '팔을 뻗고 칼끝을 곧게 둔 채 받는다', pre: ['I3'], price: 200, d: 2, cx: 670, f: ['parry', 'parryCover'] }),
      N({ id: 'I7', name: '위에서 내려 찌르기', cat: 'atk', l1: '위에서', l2: '내려 찌르기', eff: '황소 찌르기를 하면 위에서 내려 찌르기가 나간다', pre: ['I2'], price: 300, d: 3, cx: 330, u: 'imbroccata' }),
      N({ id: 'I6', name: '막아찌르기', cat: 'parry', l1: '막기 II', l2: '막아찌르기', eff: '막기를 누르면 바로 짧게 찌르고, 그동안 받는 피해가 줄어든다', pre: ['I5'], price: 300, d: 3, cx: 670, f: ['opposition'] }),
      N({ id: 'I8', name: '틈 파고들기', cat: 'deep', l1: '심화', l2: '틈 파고들기', title: '내려 찌르기 심화 · 틈 파고들기', eff: '내려 찌르기가 옷과 갑옷 틈을 더 파고든다', pre: ['I7'], price: 400, d: 4, cx: 330, perk: 'imbroccata' }),
      N({ id: 'I9', name: '칼끝 돌려 빼기', cat: 'atk', l1: '칼끝', l2: '돌려 빼기', eff: '찌르기가 맞물리거나 꺾인 뒤 다시 찌른다', pre: ['I6'], price: 300, d: 4, cx: 670, u: 'cavazione' }),
      N({ id: 'I4', name: '안다레 리솔루토', cat: 'secret', l1: '비기', l2: '안다레 리솔루토', eff: '상대 칼에 칼을 붙인 채 걸어 들어가 찌르면, 묶인 칼을 누르고 곧게 찌른다', pre: ['I8'], price: 400, heads: 20, d: 5, cx: 330, f: ['secret'] }), // 10/22 사람 먼저 — 거침없이 나아가 찌르기 (옛 엇박 찌르기는 ?itSecret=contratempo · 그때 칸 글은 이것 그대로) · 10/23 넓은 판정에 맞춰 '덮은 채' → '칼을 붙인 채'
      N({ id: 'I10', name: '곧은 선', cat: 'passive', l1: '패시브', l2: '곧은 선', eff: '찌르는 동안 칼끝이 상대를 조금 따라간다', pre: ['I9'], price: 0, heads: 10, d: 5, cx: 670, f: ['passive'] }),
    ],
  },
  iberian: {
    nodes: [
      N({ id: 'B1', name: '넓은 옆걸음', cat: 'foot', l1: '보법 I', l2: '넓은 옆걸음', eff: '넓은 보폭으로 옆으로 빠르게 돈다', price: 100, d: 0, cx: 500, f: ['footwork'] }),
      N({ id: 'B2', name: '옆 박차기', cat: 'foot', l1: '보법 II', l2: '옆 박차기', eff: '옆으로 누르면 첫 걸음을 박찬다', pre: ['B1'], price: 100, opt: true, d: 1, cx: 84, f: ['burstSide'] }),
      N({ id: 'B10', name: '손목 힘', cat: 'passive', l1: '패시브', l2: '손목 힘', eff: '큰 칼을 돌리는 손목 힘이 세진다', pre: ['B1'], price: 0, heads: 10, d: 1, cx: 252, f: ['passive'] }),
      N({ id: 'B3', name: '돌며 베기', cat: 'atk', l1: '돌며 베기', l2: '걸음 기술', eff: '옆으로 걸으며 사선으로 내려 긋는다', pre: ['B1'], price: 200, d: 1, cx: 420, u: 'talhoRodeado' }),
      N({ id: 'B4', name: '머리 위 돌려 베기', cat: 'atk', l1: '머리 위', l2: '돌려 베기', eff: '왼 가로베기를 그으면 머리 위로 돌려 베기가 나간다', pre: ['B1'], price: 200, d: 1, cx: 588, u: 'redondo' }),
      N({ id: 'B8', name: '쳐내기', cat: 'parry', l1: '막기 I', l2: '쳐내기', title: '막기 I · 쳐내기 (탈류 · 레베스)', eff: '높이 오는 칼을 베어 쳐낸다', pre: ['B1'], price: 200, d: 1, cx: 756, f: ['parry', 'parryCover'] }),
      N({ id: 'B11', name: '리스본에서 온 편지', cat: 'letter', l1: '리스본에서', l2: '온 편지', title: '리스본에서 온 편지', pre: ['B1'], price: 100, opt: true, d: 0, cx: 250, letter: true }),
      N({ id: 'B5', name: '흐르는 긋기', cat: 'atk', l1: '이어 긋기', l2: '흐름', eff: '이어 그을 때 칼이 멈추지 않고 다음 긋기로 흐른다', pre: ['B4'], price: 300, d: 2, cx: 560, f: ['ibFlow'] }),
      N({ id: 'B9', name: '굳은 받기', cat: 'parry', l1: '막기 II', l2: '굳은 받기', eff: '막는 동안 받는 피해가 줄어든다', pre: ['B8'], price: 300, d: 2, cx: 800, f: ['parryCut'] }),
      N({ id: 'B7', name: '싱지르', cat: 'secret', l1: '비기', l2: '싱지르', eff: '칼끝 거리 밖에서 버티다 공격하면, 몸을 한 바퀴 돌려 가로로 벤다', pre: ['B10', 'B3', 'B5'], price: 400, heads: 20, d: 3, cx: 420, f: ['secret'] }), // 10/22 이베리아 새 비기 (사장님 '빙글 한바퀴 돌면서 … 일격' — schools.js IBERIAN_SECRET_SPIN · 전 '길목 지키기')
      N({ id: 'B6', name: '거듭 돌려 베기', cat: 'deep', l1: '심화', l2: '쌓기', title: '돌려 베기 심화 · 쌓기', eff: '돌려 베기를 이어 그을수록 피해가 증가한다', pre: ['B5'], price: 400, d: 3, cx: 680, perk: 'redondo' }),
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
      N({ id: 'J8', name: '손목 치기 심화', cat: 'deep', closed: true, l1: '심화', l2: '손목 치기', title: '손목 치기 심화', eff: '준비 중입니다', pre: ['J7'], price: 300, d: 2, cx: 420 }), // 이점 미정(확인표 2107) — 닫힘 · 몫 없음
      N({ id: 'J3', name: '흘려 받기', cat: 'parry', l1: '막기 II', l2: '흘려 받기', title: '막기 II · 흘려 받기 (우케나가시)', orig: '受け流し', eff: '흘려 받으면 상대 팔이 늦고 기력이 깎인다', pre: ['J2'], price: 300, d: 2, cx: 650, f: ['flow'] }),
      N({ id: 'J10', name: '기다림과 침', cat: 'passive', l1: '패시브', l2: '기다림과 침', eff: '치지 않고 기다릴수록 다음 칼의 피해가 증가한다', pre: ['J9'], price: 0, heads: 10, d: 3, cx: 200, f: ['passive'] }),
      N({ id: 'J4', name: '흘린 칼', cat: 'parry', l1: '막기 III', l2: '흘린 칼', eff: '흘린 공격의 피해가 크게 줄어든다', pre: ['J3'], price: 400, d: 3, cx: 650, f: ['flowShield'] }),
      N({ id: 'J5', name: '고노센', cat: 'secret', l1: '비기', l2: '고노센', eff: '간격 밖에서 기다리다 상대가 치려 할 때 공격하면, 먼저 벤다', pre: ['J4'], price: 400, heads: 20, d: 4, cx: 650, f: ['secret'] }),
    ],
  },
  chinese: {
    nodes: [
      N({ id: 'C1', name: '가벼운 발', cat: 'foot', l1: '보법 I', l2: '가벼운 발', eff: '발을 가볍게 떼고 바로 멈춘다', price: 100, d: 0, cx: 500, f: ['footwork'] }),
      N({ id: 'C2', name: '덜 지치는 걸음', cat: 'foot', l1: '보법 II', l2: '덜 지치는 걸음', eff: '걸을 때 기력이 덜 든다', pre: ['C1'], price: 100, opt: true, d: 1, cx: 110, f: ['stepCost'] }),
      N({ id: 'C3', name: '허리 베기', cat: 'atk', l1: '허리 베기', l2: '강화동작', eff: '가로베기를 그으면 더 힘 있는 허리 베기가 나간다', pre: ['C1'], price: 200, d: 1, cx: 380, u: 'yaoji' }),
      N({ id: 'C7', name: '세 자세 받기', cat: 'parry', l1: '막기 I', l2: '세 자세 받기', eff: '위 · 가운데 · 아래로 오는 칼을 세 자세로 받는다', pre: ['C1'], price: 200, d: 1, cx: 660, f: ['parry', 'parryCover'] }),
      N({ id: 'C11', name: '한양에서 온 편지', cat: 'letter', l1: '한양에서', l2: '온 편지', title: '한양에서 온 편지', pre: ['C1'], price: 100, opt: true, d: 0, cx: 250, letter: true }),
      N({ id: 'C4', name: '깊은 허리 베기', cat: 'deep', l1: '심화', l2: '출혈', title: '허리 베기 심화 · 출혈', eff: '허리 베기로 몸통을 베면 피를 더 흘린다', pre: ['C3'], price: 300, d: 2, cx: 130, perk: 'yaoji' }),
      N({ id: 'C5', name: '끌어 딛고 허리 베기', cat: 'atk', l1: '끌어 딛고', l2: '허리 베기', eff: '앞으로 끌어 딛으며 가로로 긋는다', pre: ['C3'], price: 300, d: 2, cx: 310, u: 'chebuYaoji' }),
      N({ id: 'C6', name: '날개 접기', cat: 'atk', l1: '날개 접기', l2: '이어 긋기', eff: '찌르다가 칼을 거두며 벤다', pre: ['C3'], price: 300, d: 2, cx: 490, u: 'lianchi' }),
      N({ id: 'C8', name: '단단한 받기', cat: 'parry', l1: '막기 II', l2: '단단한 받기', eff: '막는 동안 받는 피해가 크게 줄어든다', pre: ['C7'], price: 300, d: 2, cx: 680, f: ['parryCut'] }),
      N({ id: 'C10', name: '숨 바꾸기', cat: 'passive', l1: '패시브', l2: '숨 바꾸기', eff: '휘두르지 않는 동안 출혈이 빨리 잦아든다', pre: ['C7'], price: 0, heads: 10, d: 2, cx: 880, f: ['passive'] }),
      N({ id: 'C9', name: '격살', cat: 'secret', l1: '비기', l2: '격살', eff: '나서며 때맞춰 막고 공격하면, 받은 자세의 급소를 깊게 친다', pre: ['C6', 'C8'], price: 400, heads: 20, d: 3, cx: 590, f: ['secret'] }), // 10/22 격살 (사람 — schools.js CHINESE_SECRET_GYEOKSAL) · 전 '세 번 이어 치기'
    ],
  },
};
// 칸 오의 (사장님 10/22 00:5x '지금과 같은 설명이 아니라 검술서나 참고 문헌에서의 오의를 밝힌 예전 방식이 더 나았던 거 같아' — 10/21 전 스킬북 출처 줄을 칸마다):
//  lore = 그 칸 뒤의 원전이 밝힌 이치 한 줄(원전 말투 · 한글만 · 숫자 · 놀이 셈 · 개발 말 없음 · 45 자 안) · src = 출처 줄 '저자 『책』(연도) — 갈래나 장'(원어 책 이름은 『』 안에서만).
//  상세 카드는 lore + src 를 위에, eff 를 아래 작은 줄로 그린다(화면은 skill_tree.js). 원문 · 쪽 · 저장소 근거 표 = docs/text/skill_lore_2026-10-22.md · 글 규칙 = docs/text/editing_guide.md §4.
//  편지 칸은 출처를 쓰지 않는다(편지에 한한 예외 — 사장님 10/22 01:1x) · 닫힌 칸(일본 밖 비기 · J8)도 글은 미리 둔다(화면은 '준비 중').
const NODE_LORE = {
  // 독일 — 리히테나워 운문 (Wiktenauer 'Johannes Liechtenauer' · Tobler 영역)
  G1: { lore: '걸음을 내딛거든 굼뜨지 마라', src: '리히테나워 『Zettel』(14세기) — 속임 베기' },
  G2: { lore: '따라 들기는 두 겹으로 익혀라, 아니면 칼을 베어 들어라', src: '리히테나워 『Zettel』(14세기) — 따라 들기' },
  G5: { lore: '곁눈 베기는 들소 같은 자가 치고 찌르는 것을 꺾는다', src: '리히테나워 『Zettel』(14세기) — 곁눈 베기' },
  G8: { lore: '가로베기를 잘하는 자는 뛰어 딛으며 머리를 위협한다', src: '리히테나워 『Zettel』(14세기) — 가로베기' },
  G3: { lore: '젖혀 막기를 배워, 치고 찌르는 것을 솜씨 있게 막아라', src: '리히테나워 『Zettel』(14세기) — 젖혀 막기' },
  G11: { lore: '좋은 칼이 나거든 네게 먼저 보내라고 대장장이들에게 일러 두었다' },
  G7: { lore: '위에서는 겹쳐 치고, 아래에서는 바르게 바꿔 쳐라', src: '리히테나워 『Zettel』(14세기) — 겹치기와 바꾸기' },
  G6: { lore: '세게 몰아치려거든 온몸으로 싸워라', src: '리히테나워 『Zettel』(14세기) — 긴 칼 첫 가르침' },
  G4: { lore: '그에게서 오는 것은 무엇이든 왕관이 걷어 낸다', src: '리히테나워 『Zettel』(14세기) — 정수리 베기와 왕관' },
  G9: { lore: '앞과 뒤가 모든 기예의 샘이니, 약함과 셈, 그 사이라는 말을 새겨라', src: '리히테나워 『Zettel』(14세기) — 앞과 뒤 · 인데스' },
  G10: { lore: '위 자세에서 때가 맞거든, 칼자루 끝으로 쳐라', src: '지그문트 링엑 『Kampffechten』(15세기) — 갑옷 싸움' }, // 10/22 죽음의 일격 (전: 받아 베기 — 리히테나워 v70)
  // 이탈리아 — 카포 페로 (Wiktenauer 'Ridolfo Capoferro' · Wilson · Swanger 영역 / 저장소 원문 PDF 쪽) · 비기 I4 = 파브리스 (Wiktenauer 'Salvator Fabris' 전사 · A. F. Johnson 영역 — 10/22)
  I1: { lore: '박자란 고요와 움직임을 재는 것일 뿐이다', src: '리돌포 카포 페로 『Gran Simulacro』(1610) — 박자' },
  I11: { lore: '시에나의 칼 장인들이 이제 네 이름을 안다' },
  I3: { lore: '왼 다리로 물러서고 오른 다리가 따르면, 상대에게서 안전하다', src: '리돌포 카포 페로 『Gran Simulacro』(1610) — 물러서기' },
  I2: { lore: '몸을 비켜 빼며, 넷째 자세로 돌려 찌른다', src: '리돌포 카포 페로 『Gran Simulacro』(1610) — 그림 풀이' },
  I5: { lore: '팔을 잘 뻗어 두면, 상대의 칼을 모두 몸에서 멀리 쳐낸다', src: '리돌포 카포 페로 『Gran Simulacro』(1610) — 막기' },
  I7: { lore: '첫째 자세에서 떠나 상대의 왼 어깨에서 오른 무릎으로, 던지듯 찔러라', src: '리돌포 카포 페로 『Gran Simulacro』(1610) — 찌르기 이름' },
  I6: { lore: '좋은 검객은 막고서 되받아 치지 않는 일이 결코 없다', src: '리돌포 카포 페로 『Gran Simulacro』(1610) — 막고 치기' },
  I8: { lore: '언제나 찌르기로 쳐라, 찌르기가 더 치명적이다', src: '리돌포 카포 페로 『Gran Simulacro』(1610) — 찌르기' },
  I9: { lore: '그 순간 칼끝을 빼 돌리고 조이며 나아가, 가슴을 찔러라', src: '리돌포 카포 페로 『Gran Simulacro』(1610) — 칼 빼기' },
  I4: { lore: '팔을 굳게 두고 상대 칼날을 놓지 말고, 따라 미끄러져 몸까지 가라', src: '살바토르 파브리스 『Lo Schermo』(1606) — 결연히 나아가기' }, // 10/22 거침없이 나아가 찌르기 (전 엇박 찌르기 — 카포 페로)
  I10: { lore: '곧은 선은 하나이니, 기예를 아는 자만이 그것을 긋는다', src: '리돌포 카포 페로 『Gran Simulacro』(1610) — 곧은 선' },
  // 이베리아 — 피게이레두 몬탄테 (Wiktenauer 'Diogo Gomes de Figueyredo' · Myers · Hick 영역) · 고디뉴 몬탄테 장 (저장소 독일어 역 인용)
  B1: { lore: '박자 맞고 무게 실린 잰 걸음으로 가되, 춤추듯 걷지 마라', src: '고디뉴 『Arte de Esgrima』(1599) — 몬탄테 장' },
  B2: { lore: '오른발을 오른쪽 끝없는 선으로 옮기고, 왼발이 따르게 하라', src: '피게이레두 『Memorial da Prattica do Montante』(1651) — 복합 규칙 12' },
  B10: { lore: '왼손을 낮춰 몸에 붙여 굳게 하면, 칼이 더 큰 힘으로 나간다', src: '피게이레두 『Memorial da Prattica do Montante』(1651) — 복합 규칙 13' },
  B3: { lore: '같은 오른발을 다시 들이며, 왼발 위로 나사처럼 돌아 걸어라', src: '피게이레두 『Memorial da Prattica do Montante』(1651) — 단순 규칙 13' },
  B4: { lore: '칼을 머리 위로 넘겨 어깨 뒤로 보내, 왼팔 위로 떨어뜨리며 둘러 벤다', src: '피게이레두 『Memorial da Prattica do Montante』(1651) — 복합 규칙 2' },
  B8: { lore: '맞선 무기가 오는 쪽에 따라, 탈류로 아니면 레베스로 쳐내라', src: '피게이레두 『Memorial da Prattica do Montante』(1651) — 단순 규칙 14' },
  B11: { lore: '리스본 항구에 큰 칼이 들거든, 가장 먼저 네게 실어 보내마' },
  B5: { lore: '탈류에서 다른 탈류가 나고, 레베스에서 다른 레베스가 난다', src: '피게이레두 『Memorial da Prattica do Montante』(1651) — 맺음말' },
  B9: { lore: '큰 칼의 쳐내기와 막기와 치기는 모두 몸놀림이 거들어야 한다', src: '피게이레두 『Memorial da Prattica do Montante』(1651) — 복합 규칙 6' },
  B7: { lore: '큰 칼로 갈비를 온통 휘감고, 온몸을 돌려라', src: '고디뉴 『Arte de Esgrima』(1599) — 몬탄테 장 규칙 8' }, // 10/22 휘감아 돌기 (전 길목 지키기 — 피게이레두 단순 규칙 7)
  B6: { lore: '걸음마다 한 칼씩, 늘 아래에서 위로, 사람들이 멈출 때까지 번갈아 쳐라', src: '피게이레두 『Memorial da Prattica do Montante』(1651) — 복합 규칙 7' },
  // 일본 — 오륜서 · 병법가전서 · 일본검도형 (사장님이 주신 원본 읽기표 — docs/motion/schools/)
  J1: { lore: '발끝을 조금 띄우고 뒤꿈치를 세게 디뎌, 늘 걷듯이 걸어라', src: '미야모토 무사시 『오륜서』(1645) — 물의 권 발 쓰기' },
  J6: { lore: '벨 때도 물러설 때도 받을 때도, 좌우를 번갈아 디뎌라', src: '미야모토 무사시 『오륜서』(1645) — 물의 권 음양의 발' },
  J7: { lore: '적이 치고 들 때, 아래에서 그 손을 쳐라', src: '미야모토 무사시 『오륜서』(1645) — 물의 권 다섯 겉' },
  J2: { lore: '받는 것도 쳐내는 것도 붙는 것도, 모두 적을 베는 계기로 여겨라', src: '미야모토 무사시 『오륜서』(1645) — 물의 권 자세 있고 자세 없음' },
  J11: { lore: '좋은 칼은 좋은 손을 찾아간다고, 에도의 스승이 적어 보냈다' },
  J9: { lore: '빗나간 칼을 그대로 두었다가, 적이 칠 때 아래에서 퍼 올려 쳐라', src: '미야모토 무사시 『오륜서』(1645) — 물의 권 다섯 겉' },
  J8: { lore: '손을 친 칼을 적이 쳐 떨구려 하면, 넘기는 박자로 팔을 가로 베라', src: '미야모토 무사시 『오륜서』(1645) — 물의 권 다섯 겉' },
  J3: { lore: '적의 눈을 찌르듯 하며, 그 칼을 오른 어깨로 끌어 흘려 받아라', src: '미야모토 무사시 『오륜서』(1645) — 세 가지 받기' },
  J10: { lore: '몸과 발은 걸어 들고, 칼은 기다린다', src: '야규 무네노리 『병법가전서』(1632) — 걸기와 기다림' },
  J4: { lore: '몸을 왼쪽으로 열며, 칼 옆면으로 흘려 받는다', src: '『일본검도형』(1912) — 소태도 둘째 본' },
  J5: { lore: '적이 내게 걸어올 때의 앞섬, 이를 기다림의 앞섬이라 한다', src: '미야모토 무사시 『오륜서』(1645) — 불의 권 세 가지 앞섬' },
  // 동방 — 조선세법(무비지) · 무예도보통지 예도 · 장자 (사장님이 주신 원본 읽기표 — docs/motion/schools/)
  C1: { lore: '한 걸음 한 걸음, 잰걸음으로 파고든다', src: '모원의 『무비지』(1621) 권86 조선세법 — 게격세' },
  C2: { lore: '열 걸음에 한 사람을 베고, 천 리를 가도 걸음을 멈추지 않는다', src: '『장자』 설검편' },
  C3: { lore: '몸과 걸음과 손과 칼이 빠른 우레 같으니, 이 한 칼이 칼의 으뜸이다', src: '모원의 『무비지』(1621) 권86 조선세법 — 요격세' },
  C7: { lore: '손을 굴려 이어 가며 위아래를 막는다', src: '모원의 『무비지』(1621) 권86 — 검결가' },
  C11: { lore: '훈련도감에 쓸 만한 칼이 들면, 네 쪽으로 먼저 돌려 두마' },
  C4: { lore: '가로로 내질러 가운데를 죽이는 것이 그 법이다', src: '『무예도보통지』(1790) 권2 예도 — 요격세' },
  C5: { lore: '앞발을 내딛고 뒷발을 끌어 붙이며, 나아가 허리를 친다', src: '모원의 『무비지』(1621) 권86 조선세법 — 체보' },
  C6: { lore: '거짓으로 지는 척 적을 꾀어, 물러나다 문득 나아가 허리를 친다', src: '모원의 『무비지』(1621) 권86 조선세법 — 염시세' },
  C8: { lore: '솥을 들 듯 막아 위로 죽이는 것이 그 법이다', src: '『무예도보통지』(1790) 권2 예도 — 거정세' },
  C10: { lore: '숨을 불고 내쉬어, 묵은 것을 뱉고 새것을 들인다', src: '『장자』 각의편 — 토고납신' },
  C9: { lore: '수레를 몰 듯 막아, 가운데를 죽이고 두 손을 깎아 죽인다', src: '모원의 『무비지』(1621) 권86 조선세법 — 어거세' }, // 10/22 격살 (전 봉두세 「洗刺剪殺」 — 세 번 이어 치기)
};
/** 칸 + 오의 (lore · src — 편지는 lore 만) */
const withLore = (n) => Object.freeze({ ...n, ...NODE_LORE[n.id] });
/** 유파 → { gate?, nodes } (얼림) */
export const TREE = Object.freeze(Object.fromEntries(Object.entries(TREE_SRC).map(([s, t]) => [s, Object.freeze({ ...t, nodes: Object.freeze(t.nodes.map(withLore)) })])));

export const nodesOf = (school) => TREE[school]?.nodes ?? [];
export const nodeOf = (school, id) => nodesOf(school).find((n) => n.id === id) ?? null;
/** 칸 id → 유파 (G1 → german …) */
export function schoolOfNode(id) {
  for (const s of TREE_SCHOOLS) if (nodeOf(s, id)) return s;
  return null;
}
/** 닫힌 칸('준비 중' — 살 수 없음 · 판 몫 없음): 비기 = SECRET.openSchools 에 없는 유파 · 그 밖 = closed 칸(일본 J8) */
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
const SCHOOL_KO = { german: '독일', italian: '이탈리아', iberian: '이베리아', japanese: '일본', chinese: '동방' }; // schools.js TRADITIONS.*.nameKo 와 같은 말 (이 파일은 schools.js 를 들여오지 않는다)

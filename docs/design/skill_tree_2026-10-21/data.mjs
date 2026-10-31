// 스킬트리 가안 v2 (10/21 사장님 '시작은 무조건 보법부터 · 보법 심화는 선택적인 곁가지') — 유파마다 11 칸 · 뿌리 = 보법 I
// 값 (사장님 10/21 19:0x): 편지 금화 100 · 패시브 목 10(금화 없음) · 보법 심화 금화 100 · 비기 금화 400 + 목 20 · 나머지는 깊이마다 금화
// cat: foot 보법 · parry 막기 · atk 고유 공격 · deep 심화 · secret 비기 · passive 패시브 · letter 편지 / st: now 지금 그대로 · split 지금 묶음에서 나눔 · new 새로 / opt: 곁가지(다음을 막지 않음)
// 편지는 뿌리 왼쪽 같은 줄 — 사장님 10/22 02:1x (d 0 · cx 250 · 뿌리 원 왼쪽에서 수평 점선 · 전: d 1 · 1단 오른쪽 끝)
export const SCHOOLS = [
  { id: 'german', ko: '독일', title: '독일 — 부채꼴 + 관문', gapAfter: 1, gate: { from: ['G5', 'G8', 'G3'], to: ['G6', 'G4'], label: '2단계 셋을 모두 익히면 열림' },
    shape: '기본기가 먼저 — 2단계 기술 셋을 모두 익혀야 3단계가 열리고, 몸의 길(보법 II → 패시브)까지 마쳐야 비기. 비기는 공격 · 막기 · 몸 세 길이 만나는 곳.', nodes: [
    { id: 'G1', cat: 'foot', name: '보법 I', sub: '뒤 박차기', eff: '서 있다가 뒤로 밀면 첫 걸음이 빠르다', pre: [], price: 100, st: 'split', d: 0, cx: 500 },
    { id: 'G2', cat: 'foot', name: '보법 II', sub: '간격 잡기', eff: '상대가 헛치면 두 걸음 빠르게 들어간다 — 독일은 패시브 앞 칸', pre: ['G1'], price: 100, st: 'split', d: 1, cx: 100 },
    { id: 'G5', cat: 'atk', name: '곁눈 베기', sub: '강화동작', eff: '분노의 베기가 곁눈 베기로 바뀐다', pre: ['G1'], price: 200, st: 'split', d: 1, cx: 310 },
    { id: 'G8', cat: 'atk', name: '비껴 딛는', sub: '가로베기', eff: '옆으로 걸으며 가로베기 (걸음 명령)', pre: ['G1'], price: 200, st: 'split', d: 1, cx: 500 },
    { id: 'G3', cat: 'parry', name: '막기 I', sub: '막기 자리', eff: '막기 단추로 독일 막기 자리를 잡는다', pre: ['G1'], price: 200, st: 'split', d: 1, cx: 690 },
    { id: 'G11', cat: 'letter', name: '뉘른베르크에서', sub: '온 편지', eff: '독일 무기가 나올 확률 ×2', pre: ['G1'], price: 100, st: 'new', opt: true, d: 0, cx: 250 },
    { id: 'G7', cat: 'atk', name: '겹치기', sub: '이어 긋기', eff: '칼이 맞물리면 상대 칼 뒤로 들어가 얼굴을 벤다', pre: ['G4'], price: 300, st: 'split', d: 3, cx: 690 }, // 10/28 00:5x 사장님 '겹치기는 왕관 아래로'
    { id: 'G6', cat: 'deep', name: '곁눈 베기 심화', sub: '무릎 꺾기', eff: '머리 · 어깨 · 가슴에 들면 50% 무릎을 꿇린다', pre: ['G5', 'G8', 'G3'], price: 300, st: 'split', d: 2, cx: 310 }, // 10/28 00:5x 사장님 '무릎 꺾기가 곁눈 베기 아래로'
    { id: 'G4', cat: 'parry', name: '막기 II', sub: '왕관', eff: '머리 위 칼을 칼자루로 받는다', pre: ['G5', 'G8', 'G3'], price: 300, st: 'split', d: 2, cx: 690 },
    { id: 'G9', cat: 'passive', name: '패시브', sub: '인데스', eff: '그 순간 (인데스) — 상대 칼이 헛치거나 막힌 뒤 0.6초 안에 친 칼 피해 +30% · 간격 잡기 중엔 시간이 멈춤 · 비기엔 안 실림', pre: ['G2'], price: 0, heads: 10, st: 'new', d: 2, cx: 100 },
    { id: 'G10', cat: 'secret', name: '비기', sub: '죽음의 일격', eff: '붙어서 밀어붙이며 버티면 칼을 뒤집어 코등이로 내리친다', pre: ['G9', 'G6', 'G7'], price: 400, heads: 20, st: 'now', d: 4, cx: 420 }, // 10/28 00:5x 사장님 '무릎 꺾기와 겹치기를 다 배워야' · 인데스도 남김 // 10/22 사장님 '독일은 죽음의 일격으로 하자' — 사람 먼저 열림 (전: 받아 베기 · 준비 중)
  ] },
  { id: 'italian', ko: '이탈리아', title: '이탈리아 — 긴 줄기', shape: '거리가 생명이라 보법 II(물러서기)를 반드시 거친다. 찌르기 줄기는 내려 찌르기 → 칼끝 돌려 빼기 → 심화(헛누름) → 비기로 한 줄(10/31), 막기 줄기가 나란히 뻗는다.', nodes: [
    { id: 'I1', cat: 'foot', name: '보법 I', sub: '박자 걸음', eff: '짧게 둘 · 길게 둘, 잦은 걸음', pre: [], price: 100, st: 'split', d: 0, cx: 500 },
    { id: 'I11', cat: 'letter', name: '시에나에서', sub: '온 편지', eff: '이탈리아 무기가 나올 확률 ×2', pre: ['I1'], price: 100, st: 'new', opt: true, d: 0, cx: 250 },
    { id: 'I3', cat: 'foot', name: '보법 II', sub: '물러서기', eff: '뒤로 걸어도 느려지지 않는다 — 이탈리아는 반드시 거친다', pre: ['I1'], price: 100, st: 'split', d: 1, cx: 500 },
    { id: 'I7', cat: 'atk', name: '내려', sub: '찌르기', eff: '내려 긋는 칼이 내려 찌르기로 나간다', pre: ['I3'], price: 200, st: 'split', d: 2, cx: 330 }, // 10/31 12:xx 사장님 '임브로카타를 먼저 배우고 카바치오네를 배우고 틈 파고들기는 카바치오네 강화로 바꿔.' · 'I7은 어떤 방향이나 높이에서든 … 내려찌르기로' · 13:xx '스킬 이름도 내려 찌르기로' — 왼 줄 첫 칸 (전 이 자리 I2 비껴서며 찌르기 · I7 은 d 3 '높은 찌르기가 내려 찌르기로 (강화동작)')
    { id: 'I5', cat: 'parry', name: '막기 I', sub: '막기 자리', eff: '막기 단추로 이탈리아 막기 자리를 잡는다', pre: ['I3'], price: 200, st: 'split', d: 2, cx: 670 },
    { id: 'I2', cat: 'atk', name: '칼끝', sub: '돌려 빼기', eff: '맞닿은 상대 칼 밑으로 칼끝을 돌려 빼 반대쪽을 찌른다', pre: ['I7'], price: 300, st: 'split', d: 3, cx: 330 }, // 10/31 사장님 '카바치오네가 발전해서 리솔루토가 되는 게 더 멋지고' — 기본 고유 공격 (전 I9 특수 공격)
    { id: 'I6', cat: 'parry', name: '막기 II', sub: '막아찌르기', eff: '누르면 바로 짧게 찌름 · 피해 50% 감소', pre: ['I5'], price: 300, st: 'split', d: 3, cx: 670 },
    { id: 'I8', cat: 'deep', name: '돌려 빼기 심화', sub: '헛누름', eff: '칼끝을 빼면 상대가 누르던 칼이 허공으로 쏠려 잠시 흐트러진다', pre: ['I2'], price: 400, st: 'split', d: 4, cx: 330 }, // 10/31 사장님 '틈 파고들기는 카바치오네 강화로 바꿔.' · '1.2초로 할게' (전 '내려 찌르기 심화 · 틈 파고들기')
    { id: 'I9', cat: 'atk', name: '비껴서며', sub: '찌르기', eff: '상대 칼 줄에서 몸을 빼며 넷째 자세로 맞받아 찌른다', pre: ['I6'], price: 300, st: 'split', d: 4, cx: 670 }, // 10/31 사장님 — 이탈리아 특수 공격 (전 칼끝 돌려 빼기 '빗나간 막아찌르기 뒤 칼끝을 돌려 빼 가슴을 찌른다')
    { id: 'I4', cat: 'secret', name: '비기', sub: '거침없이 나아가 찌르기', eff: '상대 칼을 덮은 채 걸어 들어가다 찌른다 — 10/22 사람 먼저 열림(전: 밑으로 들어가 찌르기 · 닫힘)', pre: ['I8'], price: 400, heads: 20, st: 'new', d: 5, cx: 330 },
    { id: 'I10', cat: 'passive', name: '패시브', sub: '리네아 레타', eff: '곧은 선 (리네아 레타) — 찌르는 동안 칼끝이 상대를 따라간다 (최대 12° · 초당 60° · AI 는 절반)', pre: ['I9'], price: 0, heads: 10, st: 'new', d: 5, cx: 670 },
  ] },
  { id: 'iberian', ko: '이베리아', title: '이베리아 — 고리', bw: 158, shape: '손목 힘 패시브를 보법 바로 아래에서 먼저 익힌다(큰 칼을 돌리는 바탕) — 비기에도 필요. 둥근 걸음 길과 돌려 베기 길이 비기에서 닫혀 원을 이룬다.', nodes: [
    { id: 'B1', cat: 'foot', name: '보법 I', sub: '넓은 옆걸음', eff: '옆으로 1.3배 빠르게 돈다', pre: [], price: 100, st: 'split', d: 0, cx: 500 },
    { id: 'B2', cat: 'foot', name: '보법 II', sub: '옆 박차기', eff: '옆으로 첫 걸음을 박찬다', pre: ['B1'], price: 100, st: 'split', opt: true, d: 1, cx: 84 },
    { id: 'B10', cat: 'passive', name: '패시브', sub: '손목 힘', eff: '손목 힘 30% — 큰 칼을 빨리 돌린다 (보법 바로 아래)', pre: ['B1'], price: 0, heads: 10, st: 'now', d: 1, cx: 252 },
    { id: 'B3', cat: 'atk', name: '둥근 걸음', sub: '탈류', eff: '옆으로 돌며 내려베기 (걸음 명령)', pre: ['B1'], price: 200, st: 'split', d: 1, cx: 420 },
    { id: 'B4', cat: 'atk', name: '정수리', sub: '가르기', eff: '칼을 어깨에 메었다가 온 몸으로 비스듬히 내려 가른다', pre: ['B5'], price: 300, st: 'split', d: 2, cx: 560 }, // 10/31 19:xx 사장님 이름 '정수리 가르기' · 효과 글 사장님 글 · 흐름과 무관 (전 '풍차 베기') // 10/29 01:3x 사장님 '흐르는 긋기와 머리 위 돌려 베기 스킬 위치를 바꿔' · 레돈두 = 특수 공격 · 01:5x '풍차 베기' · 한 바퀴 넘게 돌리면 이어 그은 칼 하나(× 1.2)
    { id: 'B8', cat: 'parry', name: '막기 I', sub: '쳐내기', eff: '높이 오는 칼을 베어 쳐낸다', pre: ['B1'], price: 200, st: 'split', d: 1, cx: 756 },
    { id: 'B11', cat: 'letter', name: '리스본에서', sub: '온 편지', eff: '이베리아 무기가 나올 확률 ×2', pre: ['B1'], price: 100, st: 'new', opt: true, d: 0, cx: 250 },
    { id: 'B5', cat: 'atk', name: '이어 긋기', sub: '흐름', eff: '이어 그을 때 칼을 덜 세워 흐르듯', pre: ['B1'], price: 200, st: 'split', d: 1, cx: 588 }, // 10/29 01:3x 머리 위 돌려 베기와 자리 바꿈
    { id: 'B9', cat: 'parry', name: '막기 II', sub: '굳은 받기', eff: '막는 동안 피해 20% 감소', pre: ['B8'], price: 300, st: 'split', d: 2, cx: 800 },
    { id: 'B7', closed: true, cat: 'secret', name: '비기', sub: '몰리네테 탈류', eff: '칼 호 안으로 들면 비켜 서며 가로 벤다', pre: ['B10', 'B3', 'B5'], price: 400, heads: 20, st: 'now', d: 3, cx: 420 },
    { id: 'B6', cat: 'deep', name: '이어지는', sub: '흐름', eff: '이어 그을수록 세지고, 세 번째 긋기마다 기력을 쓰지 않는다', pre: ['B4'], price: 400, st: 'split', d: 3, cx: 680 }, // 10/29 01:4x · 01:5x 사장님 결정 (전: 돌려 베기 심화 · 쌓기)
  ] },
  { id: 'japanese', ko: '일본', title: '일본 — 막기 줄기', shape: '받기를 세 번 깊이 익혀야 고노센(받아서 먼저 친다). 보법은 나누기 어려워 하나로 두고, 대신 막기를 셋으로 나눴다.', nodes: [
    { id: 'J1', cat: 'foot', name: '보법', sub: '낮게 깔린 걸음', eff: '흔들려도 버틴다 · 걷기 기력 1.5배', pre: [], price: 100, st: 'now', d: 0, cx: 500 },
    { id: 'J6', cat: 'atk', name: '히라키기리', sub: '걸음 명령', eff: '옆으로 몸을 열며 베기', pre: ['J1'], price: 200, st: 'split', d: 1, cx: 120 },
    { id: 'J7', cat: 'atk', name: '코테', sub: '강화동작', eff: '짧게 내려베기가 코테로 바뀐다', pre: ['J1'], price: 200, st: 'split', d: 1, cx: 360 },
    { id: 'J2', cat: 'parry', name: '막기 I', sub: '우케나가시', eff: '머리 위 칼을 받는다 · 피해 20% 감소', pre: ['J1'], price: 200, st: 'split', d: 1, cx: 650 },
    { id: 'J11', cat: 'letter', name: '에도에서', sub: '온 편지', eff: '일본 무기가 나올 확률 ×2', pre: ['J1'], price: 100, st: 'new', opt: true, d: 0, cx: 250 },
    { id: 'J9', cat: 'atk', name: '츠바메가에시', sub: '이어 긋기', eff: '내려벤 칼이 빗나간 뒤 위로', pre: ['J6', 'J7'], price: 300, st: 'split', d: 2, cx: 200 },
    { id: 'J8', cat: 'deep', name: '코테 심화', sub: '칼 떨구기', eff: '손목 치기가 칼 쥔 아래팔에 들면 50 % 로 상대가 칼을 떨굼 (10/24 열림 — 확인표 2396)', pre: ['J7'], price: 300, st: 'new', d: 2, cx: 420 },
    { id: 'J3', cat: 'parry', name: '막기 II', sub: '흘려 받기', eff: '흘리면 상대 팔 늦춤 · 기력 −40', pre: ['J2'], price: 300, st: 'split', d: 2, cx: 650 },
    { id: 'J10', cat: 'passive', name: '패시브', sub: '켄타이', eff: '기다림과 침 (켄타이) — 공격 없이 기다린 만큼 다음 칼이 세다 (2초에 +30% — 10/25 23:1x · 전 1.5초) · 빗나가면 츠바메가에시로 이어짐 · 비기엔 안 실림', pre: ['J9'], price: 0, heads: 10, st: 'new', d: 3, cx: 200 },
    { id: 'J4', cat: 'parry', name: '막기 III', sub: '흘린 칼', eff: '흘린 공격의 피해 80% 감소', pre: ['J3'], price: 400, st: 'split', d: 3, cx: 650 },
    { id: 'J5', cat: 'secret', name: '비기', sub: '뒤에서 앞서기', eff: '상대가 치려 할 때 먼저 벤다 (고노센)', pre: ['J4'], price: 400, heads: 20, st: 'now', d: 4, cx: 650 },
  ] },
  { id: 'chinese', ko: '동방', title: '동방 — 부채꼴', shape: '가벼운 발에서 공격(요격)과 막기(세 자세) 두 갈래가 활짝 펴지고, 둘이 비기 연환에서 만난다.', nodes: [
    { id: 'C1', cat: 'foot', name: '보법 I', sub: '가벼운 발', eff: '가볍게 떼고 멈추는 발', pre: [], price: 100, st: 'split', d: 0, cx: 500 },
    { id: 'C2', cat: 'foot', name: '보법 II', sub: '덜 지치는 걸음', eff: '걷기 기력 절반', pre: ['C1'], price: 100, st: 'split', opt: true, d: 1, cx: 110 },
    { id: 'C3', cat: 'atk', name: '요격', sub: '강화동작', eff: '가로베기가 요격으로 바뀐다', pre: ['C1'], price: 200, st: 'split', d: 1, cx: 380 },
    { id: 'C7', cat: 'parry', name: '막기 I', sub: '세 자세 받기', eff: '위 · 가운데 · 아래를 세 자세로 받는다', pre: ['C1'], price: 200, st: 'split', d: 1, cx: 660 },
    { id: 'C11', cat: 'letter', name: '한양에서', sub: '온 편지', eff: '동방 무기가 나올 확률 ×2', pre: ['C1'], price: 100, st: 'new', opt: true, d: 0, cx: 250 },
    { id: 'C4', cat: 'deep', name: '요격 심화', sub: '출혈', eff: '몸통을 베면 출혈 1.5배', pre: ['C3'], price: 300, st: 'split', d: 2, cx: 130 },
    { id: 'C5', cat: 'atk', name: '체보요격', sub: '걸음 명령', eff: '앞으로 끌어 딛으며 요격', pre: ['C3'], price: 300, st: 'split', d: 2, cx: 490 }, // 10/28 00:5x 사장님 '체보요격과 염시 자리 바꿔' — 선도 따라
    { id: 'C6', cat: 'atk', name: '날개 접기', sub: '이어 긋기', eff: '물러나는 척 칼을 거두며 나아가 허리를 벤다', pre: ['C3'], price: 300, st: 'split', d: 2, cx: 310 }, // 10/28 00:5x 체보요격과 자리 바꿈
    { id: 'C8', cat: 'parry', name: '막기 II', sub: '단단한 받기', eff: '막는 동안 피해 50% 감소', pre: ['C7'], price: 300, st: 'split', d: 2, cx: 680 },
    { id: 'C10', cat: 'passive', name: '패시브', sub: '토납', eff: '숨 바꾸기 (토납) — 칼을 휘두르지 않는 동안 피가 2배 빨리 멎는다', pre: ['C7'], price: 0, heads: 10, st: 'new', d: 2, cx: 880 },
    { id: 'C9', cat: 'secret', name: '비기', sub: '막아 죽이기', eff: '앞으로 나서며 때맞춰 막아 낸 직후 받은 자세가 노리는 급소를 깊게 친다', pre: ['C5', 'C8'], price: 400, heads: 20, st: 'now', d: 3, cx: 590 }, // 10/22 격살로 열림 (전 '연환' · 준비 중)
  ] },
];

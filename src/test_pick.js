// 테스트 고르기 화면 (test.html) — 사장님 10/10 16:5x "무기와 캐릭터 고르도록 해. 상대와 스테이지는 랜덤"
//  무기: weapons.js WEAPON_LIST 전부 (오늘 바뀐 무기 묶음을 위에) · 캐릭터: characters.js CHARACTERS 전부 + 기본 주인공(LOOKS.player)
//  상대: '무작위'(본판 회전 CHARACTERS — 판마다) 또는 손님 인물(characters.js CHARACTER_GUESTS — 10/14 라트나·다라이시: 무작위 회전에 없어 여기서 고른다. 10/14 19:4x 부터 여정에서는 제 무대의 검객)
//  '시작' → index.html?test=1&weapon=<id>&hero=<id|player>&foe=<random|인물 id>&stage=<random|무대 id> (그쪽 인자 뜻은 src/test_route.js)
//  무대(10/14): 기본은 무작위(여정 무대 — 지금 그대로). 새 무대(잠든 습지 · 철불 절벽 · 소금 사막 — 10/14 19:4x 여정에 들어감)를 고르면 stage=<id> 로 그 무대에 고정된다 (기억하지 않는다)
//  마지막 고른 무기·캐릭터·상대는 localStorage 에 기억한다 (읽기·쓰기 실패해도 그냥 동작).
//  비기 판(이베리아·중국·독일)은 기억하지 않는다 — 10/13 사장님 'test 경로로는 아직 끊기지 않는 흐름이 발동' = 예전에 고른 v5 가 기억돼 있던 것. 열 때마다 본판 기본값에서 시작
//  상대 헛스윙(10/15 사장님 '테스트 경로에 헛스윙 넣어' — src/whiff_drill.js): 켜면 시작 주소에 foeWhiff=1. 기본 끔이고 기억하지 않는다(비기 판·무대와 같음)
import { WEAPON_LIST, TIER_LABEL, RETIRED_WEAPONS, WEAPONS } from './weapons.js';
import { CHARACTERS, CHARACTER_GUESTS } from './characters.js';
import { TRADITIONS, traditionOf } from './schools.js';
import { SECRET } from './config.js'; // 비기 판 기본값 = 본판(main) 기본값 (10/13 — 고른 판을 기억하지 않는다)

const STORE_KEY = 'stillness.testRoute.v1';
// 오늘(10/10) 사장님이 해 볼 무기: 츠바이핸더(이베리아 몬탄테 고증) · 우치가타나(일본 고증) · 10/14 플랑베르주(샛별 가져오기 3차 — 셋째에 두어 처음 고름은 그대로)
const NEW_WEAPONS = ['zweihander', 'uchigatana', 'flamberge'];
const NEW_NOTE = { zweihander: '몬탄테 자세표·기술 (10/10)', uchigatana: '일본 자세 고증 (10/10)', flamberge: '샛별 가져오기 3차 · 이베리아 (10/14)' };

const $ = (id) => document.getElementById(id);

function loadPick() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
function savePick(p) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(p));
  } catch {
    /* 저장 못 해도 이동은 한다 */
  }
}

/** 무기의 유파 이름 한 줄 (가지가 있으면 가지 이름) */
function schoolLine(w) {
  const t = TRADITIONS[traditionOf(w)];
  if (!t) return '';
  const br = t.branches?.[`${w.frame}:${w.style}`];
  return br ? `${t.nameKo} · ${br.nameKo}` : t.id === 'none' ? '무유파' : `${t.nameKo} 유파`;
}

/** 겉모습에 딸린 방어구 (fighter.js: look.helmet = 투구, look.armor 'plate' = 판금) */
function armourLine(look) {
  const a = [];
  if (look?.armor === 'plate') a.push('판금');
  if (look?.helmet) a.push('투구');
  return a.length ? a.join('·') : '방어구 없음';
}

const weapons = WEAPON_LIST.filter((w) => !RETIRED_WEAPONS.has(w.id)).map((w) => ({ id: w.id, name: w.nameKo, tier: w.tier, school: schoolLine(w) })); // 빼 둔 무기(사장님 10/13 23:2x)는 고르기 화면에서도 뺀다
const heroes = [
  { id: 'player', name: '기본 주인공', sub: '지금 플레이어 겉모습', armour: '투구' },
  ...CHARACTERS.map((c) => ({ id: c.id, name: c.name, sub: c.epithet || '—', armour: armourLine(c.look) })),
];
// 상대 (10/14 — 사장님 '라트나는 테스트 경로의 상대 고르기와 ?foe=ratna 로'): 무작위(본판 회전) + 손님 인물. 손님 인물은 본판 무작위 상대 목록에 없다
//  (10/14 19:4x 사장님 결정으로 여정에서는 제 무대 — 잠든 습지 · 소금 사막 — 의 검객으로 나온다. 그래서 '여정 밖' 대신 '무작위 밖')
const foes = [
  { id: 'random', name: '무작위', sub: `본판 인물 ${CHARACTERS.length}명 · 판마다`, armour: '고른 캐릭터는 빼고' },
  ...CHARACTER_GUESTS.map((c) => ({ id: c.id, name: c.name, sub: `${c.epithet} · 무작위 밖`, armour: WEAPONS[c.weapon]?.nameKo ?? c.weapon })),
];

// 이베리아 비기 판 (10/11 · 10/22 — docs/strike/iberian_spin_2026-10-22.md): 새 '휘감아 돌기'(기본) · v6 '길목 지키기' · v5 '멈추지 않는 흐름' · 옛 v4 '비켜 서며 크게 가로베기' — 시작 주소의 ibSecret 로 (main.js)
const IB_SECRETS = [
  { id: 'spin', name: '새 · 싱지르', sub: '칼끝 거리 밖에서 무장 → 금색 표시 동안 공격하면 한 바퀴 돌며 가로로 벤다 (10/22)' },
  { id: 'gilmok', name: 'v6 · 길목 지키기', sub: '칼끝 거리 밖에서 준비 → 상대가 경계를 넘어 드는 순간 둘러 베는 한 칼 (10/11)' },
  { id: 'flow', name: 'v5 · 멈추지 않는 흐름', sub: '번갈아 올려베기 둘 → 머리 위로 넘겨 둘러 베는 큰 한 칼 (10/11)' },
  { id: 'v4', name: '옛 · 비켜 서며 가로베기', sub: '휩쓸기 v4 (10/10) — 견주어 보기' },
];

// 중국·독일 비기 판 (10/11 — docs/strike/parry_combo_secret_2026-10-11.md): 새 '막기 연환'(기본) · 옛 v1 — 시작 주소의 cnSecret·deSecret 로 (main.js)
const CN_SECRETS = [
  { id: 'parry', name: '새 · 연환삼격 (막기 연환)', sub: '거정세·표두세·봉두세로 막아 칼이 떨어진 직후 입력 → 찌름·두 벰, 셋째 수 반걸음 물러남 (10/12)' },
  { id: 'v1', name: '옛 · 연환삼격', sub: '쉬었다 친 첫 칼이 맞으면 세 수 (10/10) — 견주어 보기' },
];
const DE_SECRETS = [
  { id: 'v1', name: '기본 · 받아 베기 (페어제첸)', sub: '머리·목을 노리는 칼을 맞받아 벰 — 지금 본판 기본' },
  { id: 'parry', name: '시험 · 감아 들기 (인데스)', sub: '황소·왕관으로 받아 칼이 붙은 동안 입력 → 받은 칼을 타고 한 수 (붙음이 짧아 잘 안 열림)' },
];
// 무대 (10/14 — 새 무대 잠든 습지·소금 사막·철불 절벽을 여는 곳, docs/import/sluice_port_2026-10-14.md · 확인표 1119 / docs/import/salt_desert_port_2026-10-14.md · 확인표 1214 /
//  docs/import/ironcliff_port_2026-10-14.md · 확인표 1386). 기본은 무작위(지금 그대로). 10/14 19:4x 사장님 결정으로 셋 다 여정 정식 경로(12 · 13 · 14 번째)에 들어갔고,
//  무작위(여정 무대)에도 나온다 — 여기서 고르면 그 무대에 고정. 괄호 안 번호는 stages.js STAGE_ORDER 자리(왼쪽 위 '스테이지 N')와 같게 — 화산섬(docs/import/volcano_port_2026-10-14.md · 확인표 1463 · 1479)이
//  철불 절벽 뒤 14 번째로 들어와 소금 사막은 15. 10/17: 스물아홉 판 여정(봉인의 중정이 산호 항구 뒤 12 번째로 — 사장님 15:4x '다 고쳐서 올려')에 맞춰 번호를 다시 적고 중정 줄을 더함.
//  10/21: 서른 판 여정(밤의 봉인의 중정이 밤의 산호 항구 뒤 17 번째로)에 맞춰 번호를 다시 적고 밤의 중정 줄을 더함
//  stages.js 를 부르면 무대 짓는 코드가 이 화면에 다 딸려 오므로 이름만 여기 적는다 (stages.js STAGE_NAME_KO 와 같은 이름)
const STAGE_PICKS = [
  { id: 'random', name: '무작위 (여정 무대)', sub: '판마다 여정 무대 가운데 하나 — 지금 그대로' },
  { id: 'courtyard', name: '봉인의 중정 (여정 12)', sub: '새 무대 (10/17) — 장마 앞 늦은 오후 모래바람 · 마야 뒤 계단 우물과 붉은 봉인의 문 · 가운데 급수정 엄폐물. 판이 바뀌어도 이 무대' },
  { id: 'courtyard_night', name: '밤의 봉인의 중정 (여정 17)', sub: '새 무대 (10/21) — 새벽 3 시 포격에 무너진 중정 · 검은 연기 · 깨진 급수정에서 새는 물 · 상대는 광기의 마야. 판이 바뀌어도 이 무대' },
  { id: 'sluice', name: '잠든 습지 (여정 13)', sub: '새 무대 (10/14) — 가운데 말레이곰 석상 · 진흙 웅덩이 감속. 판이 바뀌어도 이 무대' },
  { id: 'dunhuang', name: '철불 절벽 (여정 24)', sub: '새 무대 (10/14) — 석굴 절벽 앞뜰의 초가을 아침 · 6 층 누각과 벽화. 판이 바뀌어도 이 무대' },
  { id: 'etna', name: '화산섬 (여정 14)', sub: '새 무대 (10/14) — 결투장 전체가 산비탈 · 낮은 쪽 용암에 닿으면 화상(다리 → 무릎). 판이 바뀌어도 이 무대' },
  { id: 'dayr', name: '소금 사막 (여정 25)', sub: '새 무대 (10/14) — 소금 벌판 역참의 해 질 녘 · 낮은 해와 긴 그림자. 판이 바뀌어도 이 무대' },
];
// 상대 헛스윙 (10/15 — 독일 보법 '간격 잡기'는 상대가 헛쳐야 켜져 AI 와는 시험이 어려웠다 · docs/strike/german_hold_2026-10-15.md §7): 켜면 상대가 제 칼이 닿지 않는 거리에서
//  2~3 s 마다 허공을 벤다(main.js → whiff_drill.js). 다가가면 평소대로 싸운다. 기억하지 않는다 — 켜 둔 것이 남아 '왜 상대가 허공을 베나' 헷갈리지 않게
const WHIFF_PICKS = [
  { id: 'off', name: '끔', sub: '평소 상대' },
  { id: 'on', name: '켬', sub: '닿지 않는 거리에서 2~3초마다 허공을 벰 · 다가가면 평소대로' },
];
// 이베리아 시험 (10/21 — config IB_FLOW · SCHOOL_PASSIVE): 둘 다 본판 기본 켬 — 하나씩 꺼서 견줘 본다. 이베리아 유파(나와 상대 모두). 기억하지 않는다(열 때마다 기본)
const IBFLOW_PICKS = [
  { id: 'off', name: '기본', sub: '이어 긋기 흐름 켬 · 손목 힘 패시브 켬 (지금 게임)' },
  { id: 'noflow', name: '흐름 끔', sub: '이어 그을 때도 칼을 보통대로 세움' },
  { id: 'nowrist', name: '손목 힘 끔', sub: '패시브 없이 손목 힘 그대로' },
  { id: 'none', name: '둘 다 끔', sub: '오늘 아침 손맛' },
];
// 이탈리아 걸음 시험 (10/21 사장님 '뒤로 물러설 때 느려짐 보정을 없애 … 롱소드보다 빠르다면 R0' — docs/strike/italian_gait_speed_2026-10-21.md)
const ITWALK_PICKS = [
  { id: 'cur', name: '지금', sub: '뒤 느려짐 없음 · 보폭 줄이고 빠르게 (지금 게임)' },
  { id: 'old', name: '이전', sub: '오늘 오후까지 — 뒤는 앞의 70% · 보폭 넓게' },
];
// 유파 패시브 시험 (10/21 — config SCHOOL_PASSIVE · school_passive.js): 4급 책의 다섯 유파 패시브(이베리아 손목 힘 · 이탈리아 곧은 선 · 일본 기다림과 침 · 독일 인데스 · 동방 숨 바꾸기)를
//  모두 끄고 견줘 본다. 손에 든 무기의 유파로 고른다(테스트 경로는 책 모두 '사용' · 상대 AI 는 숙련도 4 이상일 때). 나와 상대 모두 · 기억하지 않는다
const PASSIVE_PICKS = [
  { id: 'on', name: '켬', sub: '4급 패시브 책 효과 (지금 게임)' },
  { id: 'off', name: '끔', sub: '다섯 유파 패시브 모두 없이' },
];
// 칠 때 알림 (10/21 사장님 — 오른쪽 위 글은 사람이 못 알아챈다 · 붉은 화면 테두리나 머리 위 느낌표처럼, src/strike_cue.js): 시작 주소의 strikeCue 로 (main.js)
//  기본은 느낌표 — 기본이 아니면 주소에 적는다. 기억하지 않는다
const STRIKE_CUE_PICKS = [
  { id: 'mark', name: '느낌표', sub: '상대 머리 위에 작은 ! (지금 게임)' },
  { id: 'edge', name: '테두리', sub: '화면 가장자리가 옅은 금빛으로' },
  { id: 'both', name: '둘 다', sub: '느낌표와 테두리를 함께' },
  { id: 'off', name: '끔', sub: '자세 칸 글만 (전과 같음)' },
];
const saved = loadPick();
const pick = {
  weapon: weapons.some((w) => w.id === saved.weapon) ? saved.weapon : NEW_WEAPONS[0],
  hero: heroes.some((h) => h.id === saved.hero) ? saved.hero : 'player',
  foe: foes.some((f) => f.id === saved.foe) ? saved.foe : 'random',
  ibSecret: SECRET.iberianSecret, // 비기 판은 기억하지 않고 본판 기본값에서 (10/13)
  cnSecret: SECRET.cnSecret,
  deSecret: SECRET.deSecret,
  stage: 'random', // 무대도 기억하지 않는다 (열 때마다 무작위에서 — 고른 무대가 남아 '왜 늘 습지인가' 헷갈리지 않게)
  whiff: 'off', // 상대 헛스윙도 기억하지 않는다 (열 때마다 끔)
  ibFlow: 'off', // 이베리아 시험도 기억하지 않는다 (열 때마다 기본)
  itWalk: 'cur', // 이탈리아 걸음 시험도 기억하지 않는다
  passive: 'on', // 유파 패시브 시험도 기억하지 않는다
  strikeCue: 'mark', // 칠 때 알림도 기억하지 않는다 (열 때마다 기본 느낌표)
};

function weaponButton(w, big) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pick';
  b.dataset.tier = w.tier;
  b.dataset.id = w.id;
  const thumb = document.createElement('span');
  thumb.className = 'thumb';
  const img = document.createElement('img');
  img.alt = '';
  img.loading = 'lazy';
  img.src = `ui/weapons/${w.id}.webp`;
  img.onerror = () => img.remove();
  thumb.append(img);
  const txt = document.createElement('span');
  txt.className = 'txt';
  const name = document.createElement('b');
  const m = /^(.*?)\s*\((.*)\)$/.exec(w.name); // '에스톡 (찌르기검)' → 이름 + 작은 풀이
  name.textContent = m ? m[1] : w.name;
  if (m) {
    const alias = document.createElement('small');
    alias.textContent = m[2];
    name.append(alias);
  }
  const line = document.createElement('span');
  const tier = document.createElement('span');
  tier.className = 'tier';
  tier.textContent = TIER_LABEL[w.tier] ?? w.tier;
  line.append(tier, ` · ${w.school}`);
  txt.append(name, line);
  if (big && NEW_NOTE[w.id]) {
    const n = document.createElement('span');
    n.textContent = NEW_NOTE[w.id];
    txt.append(n);
  }
  b.append(thumb, txt);
  b.addEventListener('click', () => select('weapon', w.id));
  return b;
}

function heroButton(h, kind = 'hero') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pick';
  b.dataset.id = h.id;
  const mark = document.createElement('span');
  mark.className = 'mark';
  mark.textContent = h.id === 'player' ? '나' : h.id === 'random' ? '?' : h.name.slice(0, 1);
  const txt = document.createElement('span');
  txt.className = 'txt';
  const name = document.createElement('b');
  name.textContent = h.name;
  const sub = document.createElement('span');
  sub.textContent = h.sub;
  const arm = document.createElement('span');
  arm.textContent = h.armour;
  txt.append(name, sub, arm);
  b.append(mark, txt);
  b.addEventListener('click', () => select(kind, h.id));
  return b;
}

function ibSecretButton(x, kind = 'ibSecret') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pick';
  b.dataset.id = x.id;
  const txt = document.createElement('span');
  txt.className = 'txt';
  const name = document.createElement('b');
  name.textContent = x.name;
  const sub = document.createElement('span');
  sub.textContent = x.sub;
  txt.append(name, sub);
  b.append(txt);
  b.addEventListener('click', () => select(kind, x.id));
  return b;
}

function select(kind, id) {
  pick[kind] = id;
  savePick(pick);
  render();
}

function render() {
  for (const el of document.querySelectorAll('#weaponsNew .pick, #weaponsRest .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.weapon));
  for (const el of document.querySelectorAll('#heroes .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.hero));
  for (const el of document.querySelectorAll('#foes .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.foe));
  for (const el of document.querySelectorAll('#ibSecret .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.ibSecret));
  for (const el of document.querySelectorAll('#cnSecret .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.cnSecret));
  for (const el of document.querySelectorAll('#deSecret .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.deSecret));
  for (const el of document.querySelectorAll('#stagePick .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.stage));
  for (const el of document.querySelectorAll('#whiffPick .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.whiff));
  for (const el of document.querySelectorAll('#ibFlowPick .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.ibFlow));
  for (const el of document.querySelectorAll('#itWalkPick .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.itWalk));
  for (const el of document.querySelectorAll('#passivePick .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.passive));
  for (const el of document.querySelectorAll('#strikeCuePick .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.strikeCue));
  const w = weapons.find((x) => x.id === pick.weapon);
  const h = heroes.find((x) => x.id === pick.hero);
  const s = $('summary');
  s.textContent = '';
  const bw = document.createElement('b');
  bw.textContent = w.name;
  const bh = document.createElement('b');
  bh.textContent = h.name;
  const st = STAGE_PICKS.find((x) => x.id === pick.stage);
  const f = foes.find((x) => x.id === pick.foe);
  const foeTxt = f && f.id !== 'random' ? `상대 ${f.name}` : '';
  const stageTxt = pick.stage !== 'random' && st ? `무대 ${st.name}` : '';
  s.append(bw, ' · ', bh, document.createElement('br'), `${foeTxt || stageTxt ? `${foeTxt || '상대 무작위'} · ${stageTxt || '무대 무작위'}` : '상대·무대 무작위'}${pick.whiff === 'on' ? ' · 상대 헛스윙' : ''}${pick.ibFlow !== 'off' ? ` · 이베리아 ${IBFLOW_PICKS.find((x) => x.id === pick.ibFlow)?.name ?? ''}` : ''}${pick.itWalk !== 'cur' ? ` · 이탈리아 걸음 ${ITWALK_PICKS.find((x) => x.id === pick.itWalk)?.name ?? ''}` : ''}${pick.passive === 'off' ? ' · 유파 패시브 끔' : ''}${pick.strikeCue !== 'mark' ? ` · 칠 때 알림 ${STRIKE_CUE_PICKS.find((x) => x.id === pick.strikeCue)?.name ?? ''}` : ''}`);
}

function startUrl() {
  const q = new URLSearchParams({ test: '1', weapon: pick.weapon, hero: pick.hero, foe: pick.foe, stage: pick.stage }); // stage=<id> 면 main.js STAGE_PIN 으로 그 무대 고정 · foe=<id> 면 그 상대 (main.js pickFoe)
  if (pick.ibSecret !== SECRET.iberianSecret) q.set('ibSecret', pick.ibSecret); // 본판 기본값이 아니면 판을 주소에 (10/13 — 전엔 독일 기본을 'parry' 로 잘못 알아 감아 들기를 고를 수 없었다)
  if (pick.cnSecret !== SECRET.cnSecret) q.set('cnSecret', pick.cnSecret);
  if (pick.deSecret !== SECRET.deSecret) q.set('deSecret', pick.deSecret);
  if (pick.ibFlow === 'noflow' || pick.ibFlow === 'none') q.set('ibFlow', '0'); // 이베리아 이어 긋기 흐름 끔 (main.js → config IB_FLOW)
  if (pick.ibFlow === 'nowrist' || pick.ibFlow === 'none') q.set('ibWrist', '0'); // 유파 패시브 끔 (main.js → config SCHOOL_PASSIVE)
  if (pick.itWalk === 'old') q.set('itStride', '0.8,1.1,1.3,0.44'), q.set('itWalk', '1'); // 이탈리아 걸음 이전 판 (main.js → schools.js setItalianStride · setItalianWalk '1' = 뒤 느려짐 되살림 · 짧은 디딤 가속 없앰)
  if (pick.passive === 'off') q.set('schoolPassive', '0'); // 유파 패시브 모두 끔 (main.js → config SCHOOL_PASSIVE.on)
  if (pick.strikeCue !== 'mark') q.set('strikeCue', pick.strikeCue === 'off' ? '0' : pick.strikeCue); // 칠 때 알림 꼴 (main.js → strike_cue.js) — 기본 느낌표면 안 적는다
  if (pick.whiff === 'on') q.set('foeWhiff', '1'); // 상대 헛스윙 (main.js → whiff_drill.js) — 끄면 주소에 안 적는다
  return `./index.html?${q.toString()}`;
}

for (const id of NEW_WEAPONS) {
  const w = weapons.find((x) => x.id === id);
  if (w) $('weaponsNew').append(weaponButton(w, true));
}
for (const w of weapons) if (!NEW_WEAPONS.includes(w.id)) $('weaponsRest').append(weaponButton(w, false));
for (const h of heroes) $('heroes').append(heroButton(h));
for (const f of foes) $('foes').append(heroButton(f, 'foe'));
for (const x of IB_SECRETS) $('ibSecret').append(ibSecretButton(x));
for (const x of CN_SECRETS) $('cnSecret').append(ibSecretButton(x, 'cnSecret'));
for (const x of DE_SECRETS) $('deSecret').append(ibSecretButton(x, 'deSecret'));
for (const x of STAGE_PICKS) $('stagePick').append(ibSecretButton(x, 'stage'));
for (const x of WHIFF_PICKS) $('whiffPick').append(ibSecretButton(x, 'whiff'));
for (const x of IBFLOW_PICKS) $('ibFlowPick').append(ibSecretButton(x, 'ibFlow'));
for (const x of ITWALK_PICKS) $('itWalkPick').append(ibSecretButton(x, 'itWalk'));
for (const x of PASSIVE_PICKS) $('passivePick').append(ibSecretButton(x, 'passive'));
for (const x of STRIKE_CUE_PICKS) $('strikeCuePick').append(ibSecretButton(x, 'strikeCue'));
$('weaponCount').textContent = `${weapons.length}종`;
$('heroNote').textContent =
  '고른 캐릭터는 겉모습과 이름만 가져옵니다. 투구·판금은 겉모습에 딸려 있어 실제로 막아 줍니다(기본 주인공은 투구). ' +
  '인물의 성격·부활(이졸데) 같은 고유 능력은 받지 않습니다. 광기의 하인리히는 겉모습이 하인리히와 같아 뺐습니다.';
$('btnGo').addEventListener('click', () => {
  savePick(pick);
  location.href = startUrl();
});
render();

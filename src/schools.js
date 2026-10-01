// ─────────────────────────────────────────────────────────────
//  유파 꾸러미: 무기 하나에 묶인 "검술 교본" 한 벌
//
//  AI(ai.js)는 자세·기술·속임수·막기 자세·간격 상수를 직접 들고 있지 않고, 여기서 고른 꾸러미를
//  읽기만 한다. 캐릭터 시트(characters.js)의 persona.school 이 어느 꾸러미를 쓸지 정한다.
//  무기 로스터(다른 담당)가 자리를 잡으면 무기마다 꾸러미를 하나씩 붙이면 된다 — 지금은 롱소드 하나뿐이고,
//  이 롱소드 꾸러미 값은 예전에 ai.js 안에 박혀 있던 값 그대로다 (기본 AI 회귀 기준을 지키기 위해).
//
//  꾸러미 모양 (계약):
//   weapon   무기 로스터 id (참고용. 실제 무기 물리는 여기서 정하지 않는다)
//   measure  간격 상수 (m·s). 이 물리 모델에서 롱소드로 직접 재 본 값 — 무기가 바뀌면 여기부터 다시 재야 한다
//     contact  베기가 머리·목에 제대로 닿는 거리 (칼날 70% 지점)
//     reach    서 있다가 휘두르며 한 걸음 내디디면 닿는 거리 = 이 안은 위험하다 (상대도 같다)
//     clinch   너무 붙음: 칼을 제대로 못 쓴다 → 떨어진다
//     cutTime  베기를 시작해서 닿기까지 걸리는 시간
//   guards   간 볼 때 쓰는 자세 목록 (ai_techniques.js WATCH_GUARDS 모양)
//   tech     기술 목록 (TECH 모양), techByName 은 그 이름 색인
//   feints   속임수 목록 (FEINTS 모양)
//   parry    상대 칼이 들어오는 줄(highL·highR·highC·lowL·lowR·thrust) → 그 칼을 가로막는 손 위치
//   counter  맞받아 베기(Indes)에 쓸 기술 이름들 — 들어오는 줄별로, 지금 손에서 가까운 것을 고른다
//   withdraw 물러날 때 겨누는 자세 이름: pressed(몰아치는 상대에게), calm(그 밖에, 둘 중 하나를 무작위로)
//   pose     그 밖의 고정 손 위치: cover(쓰러졌을 때 머리 위로 가리기), point(칼끝으로 겨누기)
// ─────────────────────────────────────────────────────────────
import { G, WATCH_GUARDS, TECH, TECH_BY_NAME, FEINTS } from './ai_techniques.js';
import { HIGH_GUARDS } from './ai_techniques.js'; // 10라운드 6-7 덧붙이기 (아래 끝)

export const SCHOOLS = {
  // 독일식 롱소드 (리히테나워 전통). 값은 모두 예전 ai.js 의 MEASURE·PARRY·counterTech()·startWithdraw() 그대로
  longsword: {
    id: 'longsword',
    weapon: 'longsword',
    measure: { contact: 1.62, reach: 2.0, clinch: 1.25, cutTime: 0.3 },
    guards: WATCH_GUARDS,
    tech: TECH,
    techByName: TECH_BY_NAME,
    feints: FEINTS,
    // (공격 5가지 × 자세 13가지를 물리로 부딪쳐 보고 가장 잘 막은 자세)
    parry: {
      highL: [-0.3, 0.1], // 내 왼쪽 위 (상대 오른쪽 어깨에서 내려오는 분노의 베기): 칼을 왼쪽에 세워 받는다
      highR: G.ochsR, // 내 오른쪽 위: 오른쪽 황소
      highC: G.langort, // 머리 위에서 곧게: 뻗은 칼 위로 떨어지게
      lowL: G.pflugL,
      lowR: G.pflugR,
      thrust: G.pflugL, // 찌르기: 왼쪽으로 비껴 누른다 (Absetzen)
    },
    // 들어오는 줄에 맞서 가운데를 차지하며 베는 기술 (앞에 있는 것부터 우선)
    counter: { highR: ['zornhauL', 'oberhau', 'zornhau'], default: ['zornhau', 'oberhau', 'zornhauL'] },
    withdraw: { pressed: 'ochsR', calm: ['pflugR', 'langort'] },
    pose: { cover: G.kron, point: G.langort },
  },
};

// 무기별 measure는 무기 담당의 실측(docs/weapons.md, tools/sim/weapon_measure.mjs: 혼자 분노의 베기를 휘둘러
//  칼날 70% 지점이 머리 높이를 지나는 거리, 롱소드 1.62 기준 보정). 자세·기술은 자세 지도(guards.js)가 롱소드
//  기준이라 그대로 쓰고, 무기 성질에 맞지 않는 기술만 뺀다.
const L = SCHOOLS.longsword;
/** 기술 목록을 복사하면서 기술별 reach(닿는 거리 보정, m)를 무기에 맞게 바꾼다 (표에 없는 기술은 롱소드 값 그대로) */
const withReach = (tech, reach) => tech.map((t) => (t.name in reach ? { ...t, reach: reach[t.name] } : t));
const byName = (tech) => Object.fromEntries(tech.map((t) => [t.name, t]));
const noThrust = TECH.filter((t) => t.kind !== 'thrust');
const noThrustFeints = FEINTS.filter((f) => TECH_BY_NAME[f.fake].kind !== 'thrust');

// 나뭇가지 (쓰레기 등급): 날이 없어 찌르기가 안 된다 → 찌르기 기술·찌르기 속임수 제거. 가볍고 짧아 간격이 좁다
const branchTech = withReach(noThrust, { zornhau: 0, unterhau: -0.06, zornhauL: 0.01, unterhauL: 0.09 });
SCHOOLS.tree_branch = {
  ...L,
  id: 'tree_branch',
  weapon: 'tree_branch',
  measure: { contact: 1.46, reach: 1.61, clinch: 1.13, cutTime: 0.21 }, // 10라운드 hybrid 재실측, 베는 시간은 롱소드 0.30 기준 비율 (전 1.44/1.64/1.11/0.33)
  tech: branchTech,
  techByName: byName(branchTech),
  feints: noThrustFeints,
};

// 검(劍, 한손 양날검): 가볍고 짧아 간격이 좁고, 찌르기가 강하다(무기 스펙 mThrust 1.15) → 찌르기 기술을 더 믿는다.
//  아래에서 올려 베는 unterhauL이 롱소드보다 0.2m 더 멀리 닿는다 (한손·가벼운 칼이 낮은 궤적에서 더 뻗는다)
const jianTech = withReach(TECH, { zornhau: 0, unterhau: 0.01, zornhauL: -0.04, unterhauL: 0.19, stichPflug: 0.04, stichPflugL: 0.02, stichOchs: 0.04, stichOchsL: 0, stichAlber: -0.01 })
  .map((t) => (t.kind === 'thrust' ? { ...t, base: t.base * 1.5 } : t));
SCHOOLS.jian = {
  ...L,
  id: 'jian',
  weapon: 'jian',
  measure: { contact: 1.35, reach: 1.52, clinch: 1.04, cutTime: 0.24 }, // 청강검과 같은 칼 — 10라운드 hybrid 재실측 (전 1.32/1.55/1.02/0.38)
  tech: jianTech,
  techByName: byName(jianTech),
};

// 청강검(에픽): 물리는 지안이지만 양손 가정(토크 22) 뒤 무기 담당이 다시 잰 measure (전 1.32/1.55/1.02/0.38)
SCHOOLS.qinggang = { ...SCHOOLS.jian, id: 'qinggang', weapon: 'qinggang', measure: { contact: 1.35, reach: 1.52, clinch: 1.04, cutTime: 0.24 } }; // 10라운드 hybrid 재실측 (전 1.37/1.61/1.06/0.36)

// 엑스칼리버 복제품: 황동 장식에 칼날이 두껍고 무거워(1.50kg·1.00m) 롱소드보다 간격이 아주 조금 좁다. 자세·기술은 롱소드 그대로
const replicaTech = withReach(TECH, { zornhau: 0, unterhau: -0.04, zornhauL: -0.03, unterhauL: -0.07, stichPflug: 0.08, stichPflugL: 0.08, stichOchs: 0.08, stichOchsL: 0.08, stichAlber: 0.03 });
SCHOOLS.excalibur_replica = {
  ...L,
  id: 'excalibur_replica',
  weapon: 'excalibur_replica',
  measure: { contact: 1.55, reach: 1.83, clinch: 1.2, cutTime: 0.29 }, // 10라운드 hybrid 재실측 (전 1.59/1.86/1.23/0.42)
  tech: replicaTech,
  techByName: byName(replicaTech),
};

// 그 밖의 무기: 자세·기술은 롱소드 그대로, 간격(measure)만 무기 담당 실측(양손 가정 뒤, docs/weapons.md §2)으로 바꾼 꾸러미.
//  브란이 주워 온 커먼 단검(10%, 지금은 팔쉬온), ?foeWeapon= 으로 들려 준 무기가 롱소드 간격으로 헛베지 않게 한다. (암소드는 감독 확정으로 삭제) 기술별 reach 보정은 자료가 없어 롱소드 값.
//  찌르기가 약한 무기(팔쉬온·세이버)는 찌르기 기술의 기본 가중치를 낮춘다
//  10라운드: 게임 기본(hybrid)으로 다시 잰 값(ai.js MEASURED 와 같은 거리). 베는 시간은 raw 가 아니라 롱소드 0.30 기준 비율
//  (0.30 × 무기 raw ÷ 롱소드 raw 0.41 — ai.js scaledM 이 롱소드 유파에 다른 무기를 쥐여 줄 때와 같은 기준)
const MEASURES = {
  zweihander: [1.71, 2.08, 1.32, 0.35],
  estoc: [1.57, 1.99, 1.22, 0.31],
  sabre: [1.39, 1.58, 1.07, 0.26],
  rapier: [1.54, 1.68, 1.19, 0.21],
  falchion: [1.37, 1.56, 1.06, 0.24],
  monohoshizao: [1.58, 1.87, 1.22, 0.34],
  excalibur: [1.55, 1.83, 1.2, 0.29],
  lightsaber: [1.46, 1.65, 1.13, 0.18],
  rubber_chicken: [0.88, 1.24, 0.68, 0.13],
  frozen_tuna: [1.36, 1.63, 1.05, 0.32],
};
const weakThrust = (tech, k) => tech.map((t) => (t.kind === 'thrust' ? { ...t, base: t.base * k } : t));
for (const [id, [contact, reach, clinch, cutTime]] of Object.entries(MEASURES)) {
  SCHOOLS[id] = { ...L, id, weapon: id, measure: { contact, reach, clinch, cutTime } };
}
// 날이 없는 것(고무 닭·참치)은 찌르기 없음. 곡도·반달칼은 찌르기를 덜 믿는다
for (const id of ['rubber_chicken', 'frozen_tuna']) SCHOOLS[id] = { ...SCHOOLS[id], tech: noThrust, techByName: byName(noThrust), feints: noThrustFeints };
for (const id of ['sabre', 'falchion']) { const t = weakThrust(TECH, 0.5); SCHOOLS[id] = { ...SCHOOLS[id], tech: t, techByName: byName(t) }; }

// 10라운드 6-7 (무기 PM, 디렉터 승인 — 덧붙이기만, 위 값은 그대로): 모노호시자오 한 칼 자세 —
//  높은 자세(HIGH_GUARDS: 지붕·어깨 지붕·황소)에서 칼을 미리 들고 기다렸다가 들어오는 순간 벤다. 물러날 때도 높은 자세로
SCHOOLS.monohoshizao = { ...SCHOOLS.monohoshizao, guards: HIGH_GUARDS, withdraw: { pressed: 'tagR', calm: ['tagR', 'tag'] } };

export const DEFAULT_SCHOOL = 'longsword';

/** id가 없거나 모르는 유파면 기본(롱소드) 꾸러미 */
export const schoolOf = (id) => SCHOOLS[id] || SCHOOLS[DEFAULT_SCHOOL];

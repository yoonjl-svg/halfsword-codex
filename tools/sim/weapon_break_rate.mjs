// 무기 파손률 표준 측정: "승패가 나지 않는 60초 경합".
//  승패까지 돌리면 판이 평균 17초에 끝나 노출 시간이 판마다 달라지고 파손률이 낮게 잡힌다(감독 지적). 그래서 두 파이터가
//  상처를 입지 않게 하고(applyWound 무력화 → 죽지도 넘어지지도 않음) 60초 내내 칼을 섞게 한 뒤, 그 한 판 동안 무기 W가
//  부러진 판의 비율을 잰다. 상대는 항상 롱소드(커먼), 양쪽 자리 25판씩 = 50판. AI 는 제 무기 간격(weapon_measures.mjs)으로 싸운다.
//  등급별 목표(감독): 쓰레기·참치 60% / 커먼 강철 15% / 레어 9% / 에픽 3% / 레전드·라이트세이버 0.
// 사용법:
//   node tools/sim/weapon_break_rate.mjs [무기id...]            → 무기별 60초 파손률 (기본: 나뭇가지·롱소드·참치·청강검)
//   TIER=rare node tools/sim/weapon_break_rate.mjs longsword    → 그 무기의 등급을 강제로 바꿔 잰다 (레어처럼 실물이 없는 등급 보정용)
//   DUMP=1 node ...                                             → 판마다 충돌 충격량 J 목록을 JSON 으로 찍는다 (확률 상수 맞추기용)
//   SECONDS=60 ROUNDS=25                                        → 판 길이·자리당 판 수
import { newRound, DT, AI } from './harness_m.mjs';
import { getWeapon, TIER_DEFAULTS, TIER_FRAGILITY, breakChance } from '../../src/weapons.js';
import { applyWeaponMeasure } from './weapon_measures.mjs';

const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['tree_branch', 'longsword', 'frozen_tuna', 'qinggang'];
const SECONDS = +(process.env.SECONDS || 60);
const ROUNDS = +(process.env.ROUNDS || 25);
const FORCE_TIER = process.env.TIER || null;
const DUMP = !!process.env.DUMP;

function forceTier(f) {
  // 이 파이터의 무기 등급을 강제로 바꾼다 (파손 확률·power 만 — 물리는 그대로)
  if (!FORCE_TIER) return;
  const t = TIER_DEFAULTS[FORCE_TIER];
  f.weapon = { ...f.weapon, tier: FORCE_TIER, durability: t.durability, fragility: TIER_FRAGILITY[FORCE_TIER], fragile: TIER_FRAGILITY[FORCE_TIER] > 0 };
  f.weapon.breakChance = function (J) { return breakChance(J, this.fragility, this.material); };
}

const out = {};
for (const w of ids) {
  const wid = getWeapon(w).id;
  let broke = 0, total = 0, foeBroke = 0; const rounds = [];
  for (const [a, b, base] of [[wid, 'longsword', 9000], ['longsword', wid, 9500]]) {
    for (let s = 1; s <= ROUNDS; s++) {
      const G = newRound({ walls: true, weapon: a, weapon2: b, seed: base + s, AI2Class: AI });
      applyWeaponMeasure(G.ai2, a); applyWeaponMeasure(G.ai, b);
      const me = a === wid ? G.player : G.enemy, foe = a === wid ? G.enemy : G.player;
      // 상처 없음: 죽지도, 넘어지지도, 칼을 놓치지도 않고 60초 내내 경합한다
      for (const f of [G.player, G.enemy]) f.applyWound = () => {};
      if (FORCE_TIER) forceTier(me);
      const hits = [];
      if (DUMP) { const orig = me.absorbWeaponImpact.bind(me); me.absorbWeaponImpact = (J) => { hits.push(+J.toFixed(2)); orig(J); }; }
      for (let i = 0; i < SECONDS / DT; i++) G.step();
      total++; if (me.weaponBroken) broke++; if (foe.weaponBroken) foeBroke++;
      rounds.push(hits);
    }
  }
  const tag = FORCE_TIER ? `${wid}(${FORCE_TIER} 강제)` : wid;
  console.log(`${tag.padEnd(24)} ${SECONDS}초 경합 ${total}판: 자기 파손 ${broke} (${(100 * broke / total).toFixed(0)}%)  상대 롱소드(커먼) 파손 ${foeBroke} (${(100 * foeBroke / total).toFixed(0)}%)`);
  if (DUMP) out[wid] = rounds;
}
if (DUMP) console.log('DUMP ' + JSON.stringify(out));

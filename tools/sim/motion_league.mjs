// 동작 라이브러리 리그전 (docs/weapon_motions.md §5-3): 라이브러리를 두 쪽 다 켜고 무기끼리 다 붙여, 사장님 밸런스 기준
//  (0% 없음·상성·의외성·등급 평균 순서)이 켜도 지켜지는지 본다. 판은 weapon_league.mjs 와 같다(40초, 벽, hybrid, 주인공 대리).
//  권총은 뺀다(칼 동작 라이브러리와 무관, 디렉터 작업 중).
//   node tools/sim/motion_league.mjs run [판 수(자리마다)] [조각 번호] [조각 수] [on|off] > 조각.jsonl
//   node tools/sim/motion_league.mjs report 조각1.jsonl …        (weapon_league 의 표를 그대로 쓴다)
//  켬 설정은 motion_lab duel on 과 같다: 자세표 + 기술 목록 + 덧씌우기(런지·흐름), 막기 자리 표·막기 자세 덧씌우기는 끔
import { readFileSync } from 'node:fs';
import * as CONFIG from '../../src/config.js';
import { newRound, DT } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { WEAPONS } from '../../src/weapons.js';
import { SCHOOLS } from '../../src/schools.js';
import { applyMotionLibrary, motionFor } from '../../src/motion_library.js';
import { report } from './weapon_league.mjs';
import { registerPoleWeapons } from './pole_specs.mjs';

// EXTRA=pole: 자루 무기 시제품(봉·창, pole_specs.mjs)도 리그에 넣는다 (보통 ONLY=proto_staff 와 함께)
if (process.env.EXTRA === 'pole') registerPoleWeapons(WEAPONS);
const IDS = Object.keys(WEAPONS).filter((id) => !WEAPONS[id].gun);
const ROUND_SECONDS = 40;

/** 라이브러리 유파 꾸러미: 그 무기 꾸러미(없으면 롱소드)에 라이브러리 기술·속임수를 끼운다 (schools.js 는 건드리지 않는다) */
function libSchool(id) {
  const key = `${id}__lib`;
  if (!SCHOOLS[key]) {
    const m = motionFor(WEAPONS[id]);
    const base = SCHOOLS[id] ?? SCHOOLS.longsword;
    SCHOOLS[key] = { ...base, id: key, tech: m.tech, techByName: Object.fromEntries(m.tech.map((t) => [t.name, t])), feints: m.feints, ...(m.counter ? { counter: m.counter } : {}) };
  }
  return key;
}

function playOne(a, b, seed, aFirst, on) {
  const lib = (w) => on || WEAPONS[w].frame === 'pole'; // 자루 시제품은 늘 라이브러리(칼 동작으로는 싸우지 못한다)
  const school = (w) => (lib(w) ? libSchool(w) : SCHOOLS[w] ? w : 'longsword');
  const P = aFirst ? a : b;
  const E = aFirst ? b : a;
  const G = newRound({ walls: true, seed, weapon: P, weapon2: E, difficulty: 'normal', persona: { school: school(E) }, AI2Class: AI, difficulty2: 'normal', persona2: { school: school(P) } });
  if (lib(P)) applyMotionLibrary(G.player, { ai: G.ai2, cover: false });
  if (lib(E)) applyMotionLibrary(G.enemy, { ai: G.ai, cover: false });
  for (let i = 0; i < ROUND_SECONDS / DT; i++) {
    G.step();
    const pd = G.player.state === 'dead';
    const ed = G.enemy.state === 'dead';
    if (pd || ed) return pd && ed ? 'D' : ed === aFirst ? 'W' : 'L';
  }
  return 'D';
}

const args = process.argv.slice(2);
if (args[0] === 'report') {
  const rows = args.slice(1).flatMap((f) => readFileSync(f, 'utf8').split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l)));
  console.log(report(rows));
} else {
  const N = +(args[1] || 24);
  const k = +(args[2] || 0);
  const K = +(args[3] || 1);
  const on = args[4] !== 'off';
  CONFIG.BODY.weightMode = 'hybrid';
  const all = [];
  for (let i = 0; i < IDS.length; i++) for (let j = i + 1; j < IDS.length; j++) all.push([IDS[i], IDS[j]]);
  const only = process.env.ONLY; // 점검: 이 무기가 낀 짝만 (예: ONLY=rubber_chicken)
  for (const [a, b] of all.filter((p) => !only || p.includes(only)).filter((_, n) => n % K === k)) {
    let W = 0, L = 0, D = 0;
    for (let s = 1; s <= N; s++)
      for (const aFirst of [true, false]) {
        const r = playOne(a, b, (aFirst ? 1000 : 2000) + s, aFirst, on);
        if (r === 'W') W++;
        else if (r === 'L') L++;
        else D++;
      }
    console.log(JSON.stringify({ a, b, W, L, D, n: W + L + D, lib: on }));
  }
}

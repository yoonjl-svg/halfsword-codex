// 흐름(SKILL.flow) 판정 도구 (디렉터 10라운드 D): AI 대 AI(주인공 대리 둘 — ref_duel.mjs 와 같은 판), 기본 hybrid
//  찍는 것: 승·패·무, 첫 상처(베기·찌르기로 처음 상처를 낸 쪽) × 결과 교차표 — "첫 상처를 낸 쪽이 몇 % 이기나",
//           평균 종료 시간, 판당 공격·이어 치기·흐름 수, 간격 안(가슴 사이 2.0m 안)에 머문 시간 비율
//  시드: 1000+s 는 무기 X 가 player 자리, 2000+s 는 enemy 자리 (자리마다 판 수만큼). 판마다 40초, 벽 있음
// 사용법: node tools/sim/flow_eval.mjs [판 수(자리마다)] [무기 X] [무기 Y] [--flow] [--levitate] [--seed=첫 번호] [--json]
//   예: node tools/sim/flow_eval.mjs 48 longsword longsword --flow   (96판, 흐름 켬)
import * as CONFIG from '../../src/config.js';
import { newRound, DT } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { isMain } from './is_main.mjs';

const ROUND_SECONDS = 40;
const REACH = 2.0; // 간격 안 (가슴 사이 수평 거리, 롱소드 유파 reach)

/** 한 판: X 쪽 결과와 첫 상처 */
export function flowRound(wX, wY, seed, xFirst) {
  const P = xFirst ? wX : wY;
  const E = xFirst ? wY : wX;
  const G = newRound({ walls: true, seed, weapon: P, weapon2: E, difficulty: 'normal', persona: { school: E }, AI2Class: AI, difficulty2: 'normal', persona2: { school: P } });
  const X = xFirst ? G.player : G.enemy;
  let first = null; // 'X' | 'Y'
  let tFirst = null;
  const sev = []; // 상처 깊이 (베기·찌르기, severity > 0)
  G.onWound = (att, vic, r) => {
    if ((r.type === 'cut' || r.type === 'stab') && r.severity > 0) {
      sev.push(r.severity);
      if (!first) {
        first = att === X ? 'X' : 'Y';
        tFirst = G.t;
      }
    }
  };
  let clashes = 0; // 칼끼리 새로 부딪힌 횟수
  const oc = G.combat.hooks.onClash;
  G.combat.hooks.onClash = (point, sp, info) => {
    if (info?.fresh) clashes++;
    return oc?.(point, sp, info);
  };
  let res = 'D';
  let tEnd = null;
  let inReach = 0;
  let steps = 0;
  for (let i = 0; i < ROUND_SECONDS / DT; i++) {
    G.step();
    steps++;
    if (G.player.foeDistance() < REACH) inReach++;
    const pd = G.player.state === 'dead';
    const ed = G.enemy.state === 'dead';
    if (pd || ed) {
      tEnd = G.t;
      const xd = xFirst ? pd : ed;
      res = pd && ed ? 'D' : xd ? 'L' : 'W';
      break;
    }
  }
  const st = [G.ai.stats, G.ai2.stats];
  const sum = (k) => st.reduce((a, s) => a + (s[k] ?? 0), 0);
  return { res, first, tFirst, tEnd, inReach: inReach / steps, attacks: sum('attacks'), followUps: sum('followUps'), flows: sum('flows'), landed: sum('landed'), wounds: sev.length, sevMean: sev.length ? sev.reduce((a, b) => a + b, 0) / sev.length : 0, heavy: sev.filter((v) => v >= 0.5).length, clashes };
}

export function flowEval(wX, wY, N, S0) {
  const rows = [];
  for (let s = S0; s < S0 + N; s++) for (const xFirst of [true, false]) rows.push(flowRound(wX, wY, (xFirst ? 1000 : 2000) + s, xFirst));
  return rows;
}

export function report(rows) {
  const n = rows.length;
  const c = (f) => rows.filter(f).length;
  const W = c((r) => r.res === 'W');
  const L = c((r) => r.res === 'L');
  const D = n - W - L;
  const firsts = rows.filter((r) => r.first);
  const firstWins = c((r) => (r.first === 'X' && r.res === 'W') || (r.first === 'Y' && r.res === 'L'));
  const firstLoses = c((r) => (r.first === 'X' && r.res === 'L') || (r.first === 'Y' && r.res === 'W'));
  const ends = rows.filter((r) => r.tEnd != null).map((r) => r.tEnd);
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
  const pc = (k, m) => `${Math.round((100 * k) / Math.max(1, m))}%`;
  const lines = [];
  lines.push(`판 ${n} · X 승 ${W} 패 ${L} 무 ${D} · 죽음 ${W + L}판(둘 다 죽음 포함 ${c((r) => r.tEnd != null)}) · 평균 종료 ${mean(ends).toFixed(1)}s`);
  lines.push(`첫 상처가 난 판 ${firsts.length} · 첫 상처를 낸 쪽이 이김 ${firstWins} (${pc(firstWins, firsts.length)}) · 짐 ${firstLoses} (${pc(firstLoses, firsts.length)}) · 무 ${firsts.length - firstWins - firstLoses}`);
  lines.push('교차표 (행 = 첫 상처, 열 = 결과):  X 이김 / Y 이김 / 무');
  for (const [lab, f] of [['X 가 먼저', (r) => r.first === 'X'], ['Y 가 먼저', (r) => r.first === 'Y'], ['상처 없음', (r) => !r.first]]) {
    const g = rows.filter(f);
    lines.push(`  ${lab.padEnd(6)} ${String(g.filter((r) => r.res === 'W').length).padStart(3)} / ${String(g.filter((r) => r.res === 'L').length).padStart(3)} / ${String(g.filter((r) => r.res === 'D').length).padStart(3)}`);
  }
  lines.push(`판당 (둘 합): 공격 ${mean(rows.map((r) => r.attacks)).toFixed(1)} · 이어 치기 ${mean(rows.map((r) => r.followUps)).toFixed(1)} · 흐름 ${mean(rows.map((r) => r.flows)).toFixed(1)} · 닿음 ${mean(rows.map((r) => r.landed)).toFixed(1)} · 간격 안 ${pc(mean(rows.map((r) => r.inReach)), 1)}`);
  const ws = rows.filter((r) => r.wounds);
  lines.push(`판당 (둘 합): 상처 ${mean(rows.map((r) => r.wounds)).toFixed(1)} · 깊은 상처(깊이 0.5 이상) ${mean(rows.map((r) => r.heavy)).toFixed(2)} · 상처 깊이 평균 ${mean(ws.map((r) => r.sevMean)).toFixed(2)} · 칼끼리 부딪힘 ${mean(rows.map((r) => r.clashes)).toFixed(1)} · 첫 상처까지 ${mean(rows.filter((r) => r.tFirst != null).map((r) => r.tFirst)).toFixed(1)}s`);
  return lines.join('\n');
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const pos = args.filter((a) => !a.startsWith('--'));
  const N = +(pos[0] || 48);
  const wX = pos[1] || 'longsword';
  const wY = pos[2] || 'longsword';
  const S0 = +(args.find((a) => a.startsWith('--seed='))?.split('=')[1] ?? 1);
  CONFIG.BODY.weightMode = args.includes('--levitate') ? 'levitate' : 'hybrid';
  CONFIG.SKILL.flow = args.includes('--flow');
  console.log(`흐름 판정 · ${wX} 대 ${wY} · ${CONFIG.BODY.weightMode} · 흐름 ${CONFIG.SKILL.flow ? '켬' : '끔'} · 자리마다 ${N}판(시드 ${S0}부터) × 2`);
  const rows = flowEval(wX, wY, N, S0);
  console.log(report(rows));
  if (args.includes('--json')) console.log(JSON.stringify(rows));
}

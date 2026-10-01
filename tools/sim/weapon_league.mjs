// 무기 리그전 (사장님 밸런스 기준, 10라운드): 무기 14종을 서로 다 붙여 등급 평균·상성·의외성을 한 표에서 본다. 기본 hybrid
//  - 두 쪽 다 '주인공 대리'(기본 AI normal + 그 무기의 유파 꾸러미)가 쥔다 — 캐릭터 성격을 빼고 무기끼리만 비교한다
//  - 판은 ref_duel.mjs 와 같다(40초, 벽, 시드 1000+s 는 행 무기가 player 자리, 2000+s 는 enemy 자리)
//  - 승률 = 이긴 판 ÷ 판 (무는 승이 아님)
//  사장님 기준 (밸런스 평가의 기준점):
//   1) 승률 0%가 없다 — 어느 짝이든 약한 쪽도 이기는 판이 있다
//   2) 상성이 있다 — 무기마다 이기는 상대와 지는 상대가 있다 (이 도구: 행 승률이 열 승률보다 20%p 넘게 높으면 '이김')
//   3) 의외성이 있다 — 불리한 짝에서도 약한 쪽이 이긴다 (짝마다 약한 쪽 승률)
//   4) 개별 무기보다 등급 평균이 순서대로다 — 쓰레기 < 커먼 < 레어 < 에픽 < 레전드 (간격은 자유)
// 사용법:
//   node tools/sim/weapon_league.mjs run [판 수(자리마다)] [조각 번호] [조각 수] [--levitate] [--seed=첫 번호] > 조각.jsonl   (짝마다 한 줄 JSON)
//   node tools/sim/weapon_league.mjs report 조각1.jsonl 조각2.jsonl ...   (표·등급 평균·상성·의외성)
//   예: 4개로 나눠 돌린 뒤 모은다 — run 48 0 4 > a.jsonl & run 48 1 4 > b.jsonl & … ; report a.jsonl b.jsonl …
import { readFileSync } from 'node:fs';
import * as CONFIG from '../../src/config.js';
import { WEAPONS } from '../../src/weapons.js';
import { playOne, wilson } from './ref_duel.mjs';
import { isMain } from './is_main.mjs';

const TIER_ORDER = ['trash', 'common', 'rare', 'epic', 'legend'];
const TIER_KO = { trash: '쓰레기', common: '커먼', rare: '레어', epic: '에픽', legend: '레전드' };
const IDS = Object.keys(WEAPONS);
const side = (w) => ({ weapon: w, level: 'normal', persona: { school: w } });

/** 모든 짝 (i < j) — 조각 k/K 만 */
export function pairs(k = 0, K = 1) {
  const out = [];
  for (let i = 0; i < IDS.length; i++) for (let j = i + 1; j < IDS.length; j++) out.push([IDS[i], IDS[j]]);
  return out.filter((_, n) => n % K === k);
}

/** 한 짝: a 가 이긴 판·진 판·무 (자리마다 N판) */
export function playPair(a, b, N, S0) {
  let W = 0;
  let L = 0;
  let D = 0;
  for (let s = S0; s < S0 + N; s++) {
    for (const aFirst of [true, false]) {
      const r = playOne(side(a), side(b), (aFirst ? 1000 : 2000) + s, aFirst);
      if (r.res === 'W') W++;
      else if (r.res === 'L') L++;
      else D++;
    }
  }
  return { a, b, W, L, D, n: W + L + D };
}

export function report(rows) {
  const cell = {}; // cell[x][y] = x 가 y 를 이긴 비율
  const cnt = {};
  for (const r of rows) {
    (cell[r.a] ||= {})[r.b] = r.W / r.n;
    (cell[r.b] ||= {})[r.a] = r.L / r.n;
    (cnt[r.a] ||= {})[r.b] = r;
    (cnt[r.b] ||= {})[r.a] = { W: r.L, L: r.W, D: r.D, n: r.n };
  }
  const ids = IDS.filter((id) => cell[id]);
  const pc = (v) => `${Math.round(100 * v)}`.padStart(3);
  const lines = [];
  lines.push(`승률 표 (행이 열을 이긴 %, 짝마다 ${rows[0]?.n ?? 0}판)`);
  lines.push('            ' + ids.map((id) => id.slice(0, 5).padStart(6)).join(''));
  const avg = {};
  for (const x of ids) {
    const vs = ids.filter((y) => y !== x && cell[x][y] != null);
    avg[x] = vs.reduce((s, y) => s + cell[x][y], 0) / vs.length;
    lines.push(`${x.slice(0, 11).padEnd(12)}${ids.map((y) => (y === x ? '     -' : `   ${pc(cell[x][y])}`)).join('')}   | 평균 ${pc(avg[x])}%`);
  }
  // 등급 평균 (무기 평균의 평균)
  lines.push('');
  lines.push('등급 평균 (그 등급 무기들의 리그 평균 승률의 평균) — 사장님 기준: 쓰레기 < 커먼 < 레어 < 에픽 < 레전드');
  let prev = -1;
  let ordered = true;
  for (const t of TIER_ORDER) {
    const ws = ids.filter((id) => WEAPONS[id].tier === t);
    if (!ws.length) continue;
    const m = ws.reduce((s, id) => s + avg[id], 0) / ws.length;
    if (m <= prev) ordered = false;
    prev = m;
    lines.push(`  ${TIER_KO[t].padEnd(4)} ${pc(m)}%  (${ws.map((id) => `${id} ${Math.round(100 * avg[id])}`).join(', ')})`);
  }
  lines.push(`  → 순서 ${ordered ? '맞음' : '어긋남'}`);
  // 상성: 행이 열보다 20%p 넘게 이기면 이김, 20%p 넘게 지면 짐
  lines.push('');
  lines.push('상성 (상대보다 20%p 넘게 이기면 "이김", 20%p 넘게 지면 "짐")');
  for (const x of ids) {
    const win = ids.filter((y) => y !== x && cell[x][y] - cell[y][x] > 0.2);
    const lose = ids.filter((y) => y !== x && cell[y][x] - cell[x][y] > 0.2);
    const flag = !win.length ? '  ← 이기는 상대 없음' : !lose.length ? '  ← 지는 상대 없음' : '';
    lines.push(`  ${x.padEnd(18)} 이김 ${win.length} · 짐 ${lose.length}${flag}`);
  }
  // 의외성: 짝마다 약한 쪽 승률. 0판(0%)인 짝과 가장 낮은 짝들
  lines.push('');
  const under = rows.map((r) => ({ r, lo: Math.min(r.W, r.L) / r.n, weak: r.W < r.L ? r.a : r.b, strong: r.W < r.L ? r.b : r.a }));
  const zeros = under.filter((u) => Math.min(u.r.W, u.r.L) === 0);
  lines.push(`의외성 (짝마다 약한 쪽 승률): 0%인 짝 ${zeros.length}개${zeros.length ? ' — ' + zeros.map((u) => `${u.weak}→${u.strong}`).join(', ') : ''}`);
  const low = [...under].sort((p, q) => p.lo - q.lo).slice(0, 8);
  lines.push('  가장 낮은 짝: ' + low.map((u) => `${u.weak} 대 ${u.strong} ${Math.round(100 * u.lo)}% [${wilson(Math.min(u.r.W, u.r.L), u.r.n).map((v) => Math.round(100 * v)).join('~')}]`).join(' · '));
  const med = under.map((u) => u.lo).sort((p, q) => p - q)[Math.floor(under.length / 2)];
  lines.push(`  약한 쪽 승률 중앙값 ${Math.round(100 * med)}%`);
  return lines.join('\n');
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const pos = args.filter((a) => !a.startsWith('--'));
  if (pos[0] === 'report') {
    const rows = pos.slice(1).flatMap((f) => readFileSync(f, 'utf8').split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l)));
    console.log(report(rows));
  } else {
    const N = +(pos[1] || 48);
    const k = +(pos[2] || 0);
    const K = +(pos[3] || 1);
    const S0 = +(args.find((a) => a.startsWith('--seed='))?.split('=')[1] ?? 1);
    CONFIG.BODY.weightMode = args.includes('--levitate') ? 'levitate' : 'hybrid';
    for (const [a, b] of pairs(k, K)) console.log(JSON.stringify(playPair(a, b, N, S0)));
  }
}

// 2:1 숙련도 판 (10/29 20:3x 사장님 '숙련도 높은 AI 가 낮은 AI 둘을 1:2 로 뒤집을 수 있어야' — docs/strike/team_fight_2026-10-29.md §13):
//  칸마다 혼자(자리 1) 숙련도 · 둘(자리 0 · 2) 숙련도 — AI 는 aiAtProficiency(무기만 가진 시트, 숙련도) = 그 무기 유파 숙련도 p · 실력 이름 levels[p] (무명 검객과 같은 꼴)
//  섞인 무기(team_fights.mjs 와 같은 loadout) · 겉모습 모두 같음(투구 없음) · 벽 있음 · 한 편 전멸 또는 maxSecs.
//  재는 것: 혼자 이김 % · 판 길이 가운데 · 혼자가 쓰러뜨린 수 평균 · 혼자 쪽 바꿈 / 분.
//  쓰임: node tools/sim/team_balance.mjs [씨앗 24] [maxSecs 120] [--cells=3:3,4:2,6:1] [--jobs=4] [--lever=lineUp,evade | --lever=none] [--set=lineUp.side=1] [--atkHold=초] [--json]
//   --lever = config TEAM_FIGHT.lever 의 스위치를 켠 판 (게임 기본은 모두 끔 — 사장님께 여쭐 판)
//  판마다 따로 시드(fights12 의 LCG)와 파손 씨앗이라 jobs 수와 상관없이 같은 판은 같다 (게임 값이 아닌 재기 도구)
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const pos = args.filter((a) => !a.startsWith('--'));
const flag = (k, d) => { const a = args.find((x) => x === `--${k}` || x.startsWith(`--${k}=`)); return a == null ? d : a.includes('=') ? a.slice(k.length + 3) : true; };
const SEEDS = +(pos[0] ?? 24);
const MAX = +(pos[1] ?? 120);
const CELLS = String(flag('cells', '6:2,5:2,3:2,5:1,3:3')).split(',').map((c) => c.split(':').map(Number));
const JOBS = +flag('jobs', 4);
const LEVERS = String(flag('lever', '')).split(',').filter(Boolean);
const ATK_HOLD = flag('atkHold', null);
const SETS = String(flag('set', '')).split(',').filter(Boolean).map((kv) => kv.split('=')); // --set=lineUp.side=1,evade.k=1.2 (TEAM_FIGHT.lever 값 시험)
const WORKER = flag('worker', null);
const WEAPONS = ['longsword', 'zweihander', 'rapier', 'sabre', 'uchigatana', 'estoc'];
const loadout = (seed, count) => Array.from({ length: count }, (_, i) => WEAPONS[(seed * 7 + i * 5) % WEAPONS.length]);

async function fight(lone, pair, seed) {
  const { newMatch, DT, CONFIG } = await import('./jelly_harness.mjs');
  const { aiAtProficiency } = await import('../../src/characters.js');
  const { LOOKS } = await import('../../src/looks.js');
  for (const k of LEVERS) {
    if (k === 'none') {
      for (const v of Object.values(CONFIG.TEAM_FIGHT.lever)) if (v && typeof v === 'object' && 'on' in v) v.on = false; // 모두 끔 (예전 판)
      continue;
    }
    if (!(k in CONFIG.TEAM_FIGHT.lever)) throw new Error(`모르는 스위치 ${k}`);
    CONFIG.TEAM_FIGHT.lever[k].on = true;
  }
  if (ATK_HOLD != null) CONFIG.TEAM_FIGHT.target.attackHold = CONFIG.realS(+ATK_HOLD);
  for (const [path, v] of SETS) {
    const [a, b] = path.split('.');
    CONFIG.TEAM_FIGHT.lever[a][b] = +v;
  }
  let s = seed * 9301 + 49297;
  Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const weapons = loadout(seed, 3);
  const prof = [pair, lone, pair];
  const G = newMatch({ count: 3, ai: 'all', seed, walls: true, weapons, looks: Array(3).fill(LOOKS.enemy), aiOf: (i) => aiAtProficiency({ ai: { persona: {} }, weapon: weapons[i] }, prof[i]) });
  const F = G.fighters;
  const L = F[1];
  let aliveT = 0, error = null;
  const n = Math.round(MAX / DT);
  for (let i = 0; i < n && !G.over; i++) {
    try { G.step(); } catch (e) { error = `${G.t.toFixed(2)} s: ${e.message}`; break; }
    if (L.alive) aliveT += DT;
  }
  return {
    lone, pair, seed, weapons: weapons.join(','), over: G.over, winner: G.winner ?? null, t: +G.t.toFixed(2), error,
    loneKills: [0, 2].filter((i) => !F[i].alive).length, loneSw: G.targeting?.get(L)?.switches ?? 0, loneMin: +(aliveT / 60).toFixed(4),
  };
}

if (WORKER) {
  for (const job of String(WORKER).split(';')) {
    const [lone, pair, seed] = job.split(':').map(Number);
    process.stdout.write(JSON.stringify(await fight(lone, pair, seed)) + '\n');
  }
  process.exit(0);
}

const jobs = CELLS.flatMap(([l, p]) => Array.from({ length: SEEDS }, (_, i) => `${l}:${p}:${i + 1}`));
const buckets = Array.from({ length: Math.max(1, JOBS) }, () => []);
jobs.forEach((j, i) => buckets[i % buckets.length].push(j));
const self = fileURLToPath(import.meta.url);
const rows = [];
await Promise.all(buckets.filter((b) => b.length).map((b) => new Promise((res, rej) => {
  const pass = args.filter((a) => /^--(lever|atkHold|set)\b/.test(a));
  const p = spawn(process.execPath, [self, `--worker=${b.join(';')}`, ...pass, String(SEEDS), String(MAX)], { stdio: ['ignore', 'pipe', 'inherit'] });
  let buf = '';
  p.stdout.on('data', (d) => {
    buf += d;
    let k;
    while ((k = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, k);
      buf = buf.slice(k + 1);
      if (line.trim()) rows.push(JSON.parse(line));
    }
  });
  p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`worker ${c}`))));
})));
if (flag('json', false)) for (const r of rows) console.log(JSON.stringify(r));
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };
console.log(`2:1 숙련도 판 — 씨앗 ${SEEDS} · 최대 ${MAX} s · 스위치 ${LEVERS.join(',') || '없음'}${SETS.length ? ` · 값 ${SETS.map((x) => x.join('=')).join(',')}` : ''}${ATK_HOLD != null ? ` · attackHold ${ATK_HOLD}` : ''} · 무기 ${WEAPONS.join(' ')} · 겉모습 같음`);
for (const [l, p] of CELLS) {
  const R = rows.filter((r) => r.lone === l && r.pair === p);
  const done = R.filter((r) => r.over);
  const wins = R.filter((r) => r.winner === 1).length;
  const mins = R.reduce((a, r) => a + r.loneMin, 0);
  console.log(JSON.stringify({
    cell: `혼자 ${l} 대 ${p}·${p}`, fights: R.length, loneWinPct: +((100 * wins) / Math.max(1, R.length)).toFixed(1), loneWins: wins,
    medianSec: med(done.map((r) => r.t)), unfinished: R.length - done.length, loneKillsAvg: +(R.reduce((a, r) => a + r.loneKills, 0) / Math.max(1, R.length)).toFixed(2),
    loneSwPerMin: +(R.reduce((a, r) => a + r.loneSw, 0) / Math.max(1e-9, mins)).toFixed(2), errors: R.filter((r) => r.error).length,
  }));
}

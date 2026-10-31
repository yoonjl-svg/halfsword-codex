// 동시 대전 2:2 · 2:1 판 묶음 (10/29 2단계 — docs/strike/team_fight_2026-10-29.md §9 · src/targeting.js · src/match.js):
//  AI 모두 보통 · 섞인 무기(롱소드 · 몬탄테 = zweihander · 레이피어 · 세이버 · 우치가타나 · 에스톡) · 벽 있음 · 한 편 전멸(M.over) 또는 maxSecs 까지.
//  재는 것: NaN · 예외 · 같은 편 상처 · 산 싸움꾼의 상대가 늘 겨눌 수 있는 몸인가(살아 있음 · 부활 중 아님) · 상대 바꿈 / 분 · 120 s 안 끝남 · 판 길이 ·
//   2:1 에서 혼자인 쪽(자리 1)이 이긴 판 · 같은 편 몸 겹친 표본(12 스텝마다 몸 콜라이더 모양 거리 < 0 — 판이 살아 있는 동안 · 둘 다 산 동안)
//  쓰임: node tools/sim/team_fights.mjs [씨앗 24] [maxSecs 120] [--modes=2v2,2v1] [--jobs=4] [--sep=0](같은 편 비킴 끔 — 전후 비교) [--flank=0](둘러싸임 비켜 서기 끔) [--mirror](두 편 무기 맞바꿈) [--looks=team](0 편 케틀 투구 · 1 편 없음 — newRound 겉모습, 기본은 모두 투구 없음) [--atkHold=0.4](나를 침 바꿈 문턱 — 실제 초) [--json](판마다 줄)
//  판마다 따로 시드(fights12 의 LCG)와 파손 씨앗이라 jobs 수와 상관없이 같은 판은 같다 (게임 값이 아닌 재기 도구)
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const pos = args.filter((a) => !a.startsWith('--'));
const flag = (k, d) => { const a = args.find((x) => x === `--${k}` || x.startsWith(`--${k}=`)); return a == null ? d : a.includes('=') ? a.slice(k.length + 3) : true; };
const SEEDS = +(pos[0] ?? 24);
const MAX = +(pos[1] ?? 120);
const MODES = String(flag('modes', '2v2,2v1')).split(',');
const JOBS = +flag('jobs', 4);
const SEP = flag('sep', '1') !== '0';
const MIRROR = !!flag('mirror', false); // 시험: 두 편 무기를 맞바꿈 (자리 0 ↔ 1 · 2 ↔ 3 — 편 쏠림이 무기 탓인지 보기)
const FLANK = flag('flank', '1') !== '0'; // 시험: --flank=0 = 둘러싸임 비켜 서기 끔 (전후 비교)
const LOOKS_TEAM = flag('looks', 'same') === 'team'; // 겉모습: same(기본) = 모두 LOOKS.enemy(투구 없음 — 편 쏠림 없게) · team = newRound 처럼 0 편 케틀 투구 · 1 편 없음
const ATK_HOLD = flag('atkHold', null); // 시험: --atkHold=0.4 = '나를 침' 바꿈은 그 상대가 실제 초 0.4 동안 내리 쳐야 (TEAM_FIGHT.target.attackHold — 3단계 2877)
const FFA = flag('ffa', '1') !== '0'; // 시험: --ffa=0 = 같은 편 지나감 (사장님 10/29 22:3x 전 판 — 전후 비교)
const WORKER = flag('worker', null);
const WEAPONS = ['longsword', 'zweihander', 'rapier', 'sabre', 'uchigatana', 'estoc'];
export const loadout = (seed, count) => Array.from({ length: count }, (_, i) => WEAPONS[(seed * 7 + i * 5) % WEAPONS.length]);

async function fight(mode, seed) {
  const { newMatch, DT, CONFIG } = await import('./jelly_harness.mjs');
  const { matchResult, matesOf } = await import('../../src/match.js');
  const { targetable } = await import('../../src/targeting.js');
  if (!SEP) CONFIG.TEAM_FIGHT.mateSep.k = 0;
  let s = seed * 9301 + 49297;
  Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const count = mode === '2v1' ? 3 : 4;
  if (!FLANK) CONFIG.TEAM_FIGHT.flank.side = 0;
  if (ATK_HOLD != null) CONFIG.TEAM_FIGHT.target.attackHold = CONFIG.realS(+ATK_HOLD);
  const base = loadout(seed, count);
  const weapons = MIRROR ? base.map((w, i) => base[i ^ 1] ?? w) : base;
  const { LOOKS } = await import('../../src/looks.js');
  const G = newMatch({ count, ai: 'all', seed, walls: true, weapons, ffa: FFA, ...(LOOKS_TEAM ? {} : { looks: Array(count).fill(LOOKS.enemy) }) });
  const F = G.fighters;
  let mateWounds = 0, mateSevere = 0, mateKills = 0, wounds = 0, deadTarget = 0, nan = null, error = null, overlap = 0, samples = 0, flanked = 0, flankN = 0;
  const wasAlive = new Map(); // 지난 스텝에 살아 있었나 (같은 편 상처는 산 몸만 셈 — 죽은 몸 베기는 빼고)
  G.combat.hooks.onWound = (att, vic, r) => {
    wounds++;
    if (att.team !== vic.team || !wasAlive.get(vic)) return;
    mateWounds++; // 같은 편 상처 (ffa — 사장님 10/29 22:3x '의외성')
    if ((r?.severity ?? 0) >= 0.5) mateSevere++;
    if (!vic.alive) mateKills++; // 그 칼에 바로 죽음
  };
  const aliveT = new Array(count).fill(0);
  G.before = () => {
    for (const f of F) wasAlive.set(f, f.alive);
    for (const f of F) {
      if (!f.alive) continue;
      aliveT[f.index] += DT;
      if (!targetable(f.foe) && F.some((g) => g.team !== f.team && targetable(g))) deadTarget++;
    }
  };
  const bodyCols = (f) => Object.values(f.bodies).map((rb) => rb.collider(0)).filter((c) => !f.colliderInfo.get(c.handle)?.detached);
  const overlapNow = (a, b) => { for (const ca of bodyCols(a)) for (const cb of bodyCols(b)) { const c = ca.contactCollider(cb, 0); if (c && c.distance < 0) return true; } return false; };
  const mates = F.flatMap((a) => matesOf(G, a).filter((b) => b.index > a.index).map((b) => [a, b]));
  const n = Math.round(MAX / DT);
  for (let i = 0; i < n && !G.over; i++) {
    try { G.step(); } catch (e) { error = `${G.t.toFixed(2)} s: ${e.message}`; break; }
    for (const f of F) { const t = f.bodies.chest.translation(), w = f.sword.translation(); if (![t.x, t.y, t.z, w.x, w.y, w.z].every(Number.isFinite)) { nan ??= `${f.name} @ ${G.t.toFixed(2)}`; } }
    if (nan) break;
    if (i % 12 === 0 && !G.over) {
      for (const [a, b] of mates) if (a.alive && b.alive) { samples++; if (overlapNow(a, b)) overlap++; }
      // 둘러싸임: 산 상대가 둘인 싸움꾼 — 다른 상대가 flank.range 안에서 지금 상대와 flank.angle 넘게 벌어져 있나
      const FL = CONFIG.TEAM_FIGHT.flank;
      for (const f of F) {
        const L = f.foes?.filter((g) => targetable(g));
        if (!f.alive || !L || L.length < 2 || !targetable(f.foe)) continue;
        flankN++;
        const c = f.bodies.chest.translation(), t = f.foe.bodies.chest.translation();
        const tx = t.x - c.x, tz = t.z - c.z, tl = Math.hypot(tx, tz) || 1;
        if (L.some((g) => { if (g === f.foe) return false; const q = g.bodies.chest.translation(); const x = q.x - c.x, z = q.z - c.z, d = Math.hypot(x, z); return d <= FL.range && d > 1e-6 && Math.acos(Math.max(-1, Math.min(1, (x * tx + z * tz) / (d * tl)))) > (FL.angle * Math.PI) / 180; })) flanked++;
      }
    }
  }
  const R = matchResult(G);
  const sw = F.map((f) => G.targeting?.get(f)?.switches ?? 0);
  const why = { gone: 0, attacked: 0, held: 0 };
  for (const f of F) for (const k in why) why[k] += G.targeting?.get(f)?.why[k] ?? 0;
  return {
    mode, seed, weapons: weapons.join(','), over: R.over, winner: R.winner, t: +R.t.toFixed(2), wounds, mateWounds, mateSevere, mateKills, deadTarget, nan, error,
    switches: sw, why, aliveMin: aliveT.map((x) => +(x / 60).toFixed(4)), overlap, samples, flanked, flankN,
    end: R.fighters.map((r) => `${r.name}:${r.alive ? 'alive' : r.causeOfDeath ?? 'dead'}:${r.blood.toFixed(2)}:${r.wounds.length}`).join(' '),
  };
}

if (WORKER) {
  for (const job of String(WORKER).split(';')) {
    const [mode, seed] = job.split(':');
    const r = await fight(mode, +seed);
    process.stdout.write(JSON.stringify(r) + '\n');
  }
  process.exit(0);
}

// ── 부모: 판을 jobs 개 자식 과정에 나눠 돌리고 모은다 ──
const jobs = MODES.flatMap((m) => Array.from({ length: SEEDS }, (_, i) => `${m}:${i + 1}`));
const buckets = Array.from({ length: Math.max(1, JOBS) }, () => []);
jobs.forEach((j, i) => buckets[i % buckets.length].push(j));
const self = fileURLToPath(import.meta.url);
const rows = [];
await Promise.all(buckets.filter((b) => b.length).map((b) => new Promise((res, rej) => {
  const pass = args.filter((a) => /^--(sep|mirror|flank|looks|atkHold|ffa)\b/.test(a));
  const p = spawn(process.execPath, [self, `--worker=${b.join(';')}`, ...pass, String(SEEDS), String(MAX)], { stdio: ['ignore', 'pipe', 'ignore'] });
  let buf = '';
  p.stdout.on('data', (d) => { buf += d; let k; while ((k = buf.indexOf('\n')) >= 0) { rows.push(JSON.parse(buf.slice(0, k))); buf = buf.slice(k + 1); } });
  p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`worker exit ${c}`))));
})));
rows.sort((a, b) => a.mode.localeCompare(b.mode) || a.seed - b.seed);
if (flag('json', false)) for (const r of rows) console.log(JSON.stringify(r));
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? (b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : NaN; };
let bad = false;
console.log(`동시 대전 판 묶음 — 씨앗 ${SEEDS} · 최대 ${MAX} s · 같은 편 비킴 ${SEP ? "켬" : "끔"}${MIRROR ? " · 무기 맞바꿈" : ""}${FLANK ? "" : " · 둘러싸임 비켜 서기 끔"} · 겉모습 ${LOOKS_TEAM ? "편마다(0 편 케틀 투구)" : "모두 같음(투구 없음)"} · 무기 ${WEAPONS.join(" ")}`);
for (const m of MODES) {
  const R = rows.filter((r) => r.mode === m);
  const sw = R.reduce((s, r) => s + r.switches.reduce((a, b) => a + b, 0), 0);
  const am = R.reduce((s, r) => s + r.aliveMin.reduce((a, b) => a + b, 0), 0);
  const perF = R.flatMap((r) => r.switches.map((n, i) => (r.aliveMin[i] > 0.05 ? n / r.aliveMin[i] : 0)));
  const fin = R.filter((r) => r.over && r.t <= 120);
  const ov = R.reduce((s, r) => s + r.overlap, 0), sa = R.reduce((s, r) => s + r.samples, 0);
  const sum = {
    mode: m, fights: R.length,
    nan: R.filter((r) => r.nan).length, errors: R.filter((r) => r.error).length, mateWounds: R.reduce((s, r) => s + r.mateWounds, 0), mateWoundsPerFight: +(R.reduce((s, r) => s + r.mateWounds, 0) / Math.max(1, R.length)).toFixed(2), mateSevere: R.reduce((s, r) => s + (r.mateSevere ?? 0), 0), mateKills: R.reduce((s, r) => s + (r.mateKills ?? 0), 0), deadTargetSteps: R.reduce((s, r) => s + r.deadTarget, 0),
    switchesPerMin: +(sw / Math.max(1e-9, am)).toFixed(2), switchesPerMinMaxFighter: +Math.max(0, ...perF).toFixed(2),
    switchWhy: ['gone', 'attacked', 'held'].map((k) => `${k} ${R.reduce((s, r) => s + r.why[k], 0)}`).join(' · '),
    finished120: `${fin.length}/${R.length} (${Math.round((100 * fin.length) / Math.max(1, R.length))} %)`,
    medianSec: +med(R.map((r) => (r.over ? r.t : MAX))).toFixed(1), medianSecFinished: +med(fin.map((r) => r.t)).toFixed(1),
    wins: `0 편 ${R.filter((r) => r.winner === 0).length} · 1 편 ${R.filter((r) => r.winner === 1).length} · 무 ${R.filter((r) => r.over && r.winner == null).length} · 안 끝남 ${R.filter((r) => !r.over).length}`,
    mateOverlapPct: sa ? +((100 * ov) / sa).toFixed(2) : null,
    flankedPct: (() => { const a = R.reduce((x, r) => x + r.flanked, 0), b = R.reduce((x, r) => x + r.flankN, 0); return b ? +((100 * a) / b).toFixed(1) : null; })(), // 산 상대 둘인 싸움꾼 표본 가운데 둘러싸인 몫
    woundsPerFight: +(R.reduce((s, r) => s + r.wounds, 0) / Math.max(1, R.length)).toFixed(1),
  };
  if (sum.nan || sum.errors || (!FFA && sum.mateWounds) || sum.deadTargetSteps) bad = true; // ffa: 같은 편 상처는 셈만 (일부러 — 사장님 10/29 22:3x)
  console.log(JSON.stringify(sum));
}
for (const r of rows) if (r.error || r.nan) console.log('문제', JSON.stringify(r));
console.log(bad ? '실패 (NaN · 예외 · 죽은 상대를 겨눈 스텝 · ffa 끔이면 같은 편 상처)' : `OK (NaN · 예외 · 죽은 상대 겨눔 0${FFA ? ' · 같은 편 상처는 셈만 — ffa' : ' · 같은 편 상처 0'})`);
process.exit(bad ? 1 : 0);

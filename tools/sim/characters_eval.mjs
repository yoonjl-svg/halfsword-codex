// characters.js에 담긴 5인의 캐릭터를 검증한다 (헤드리스, 결정적):
//  1) 구분성: 가만히 있는 상대(더미) 앞에서 자세 전환 거리·빈도, 평균 간격, 분당 공격·속임수, 붙음(clinch) 비율을 잰다
//  2) 균형: 캐릭터끼리 맞대결(라운드로빈) + 더미 상대 처치 시간(TTK)
//
// 실행: node tools/sim/characters_eval.mjs [passive|rr|both] [seeds]
//  기본은 예전처럼 모두 기본 겉모습(적 자리 = 파란 옷, 플레이어 자리 = 케틀햇)을 입는다 — 지난 표들과 그대로 견줄 수 있게.
//  LOOKS=1 이면 캐릭터가 자기 겉모습(look)을 입는다 — 투구·판금이 판정에 들어간다(config.js ARMOR). 더미는 게임의 플레이어처럼 케틀햇.
//   방어구 균형을 잴 때: LOOKS=1 node tools/sim/hybrid.mjs characters_eval.mjs rr 16  (ARMOR 끔과 견주려면 with_config.mjs ARMOR.on=false)
//  SEED0=501 이면 시드 501~ (기본 1~)
import { newRound, DT, THREE } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { padDist } from '../../src/ai_techniques.js';
import { CHARACTERS } from '../../src/characters.js';

const [mode = 'both', seedsArg = '5'] = process.argv.slice(2);
const SEEDS = +seedsArg;
const SEED0 = +(process.env.SEED0 ?? 1); // SEED0=501 이면 시드 501~ (튜닝에 쓴 시드와 다른 시드로 확인할 때)
const DRESS = process.env.LOOKS === '1';
const lookOf = (ch) => (DRESS ? ch.look : undefined);
/** 방어구가 완전히 부서진 수 (투구 1 + 판금 부위 수) — 보는 사람에게 "부서지는 장면"이 나왔나 */
const armorBroken = (f) => (f.helmetType && !f.hasHelmet ? 1 : 0) + (f.platesBroken ?? 0);
/** 파손(곁 조각이 떨어져 나감) 횟수 — 투구 뿔·볏·깃털 술, 판금 금띠·이음매 판·자락 끝단 (config.js ARMOR shed) */
const armorShed = (f) => f.armorShed ?? 0;
const hasArmor = (f) => !!f.helmetType || Object.keys(f.plate).length > 0;
const CLINCH_D = 1.3; // eval_m.mjs와 같은 기준
const GUARDS_READY = [0.12, -0.18];

const flat = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
const slow = (off, q, sp) => {
  const dx = q[0] - off.x, dy = q[1] - off.y, dd = Math.hypot(dx, dy), s = sp * DT;
  if (dd > s) { off.x += (dx / dd) * s; off.y += (dy / dd) * s; } else off.set(q[0], q[1]);
};
const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);

/** 캐릭터 하나를 가만히 서 있는 더미 앞에 세우고 재는 시나리오 */
function runPassive(ch, seed, durS = 60) {
  const opts = { seed, difficulty: ch.ai.level, persona: ch.ai.persona, weapon2: ch.weapon, look2: lookOf(ch), revive: ch.revive };
  const G = newRound(opts);
  const { player: dummy, enemy: fighter, ai } = G;
  G.before = () => { dummy.move.set(0, 0); slow(dummy.handOffset, GUARDS_READY, 1.0); };

  let prevGuard = ai.guard;
  const switchAt = []; // 자세를 바꾼 순간의 간격(d)
  let switches = 0;
  let dSum = 0, dN = 0;
  let clinchT = 0, standT = 0;
  let tDead = null;

  const steps = Math.round(durS / DT);
  for (let i = 0; i < steps; i++) {
    G.step();
    if (!dummy.alive || !fighter.alive) { if (tDead == null) tDead = +G.t.toFixed(1); break; }
    if (ai.guard !== prevGuard) {
      switches++;
      switchAt.push(padDist(ai.guard.pad, prevGuard.pad)); // 자세 공간에서 얼마나 먼 자세로 건너뛰었나 (가까운 자세 고집 vs 먼 자세로 점프)
      prevGuard = ai.guard;
    }
    if (fighter.state === 'stand') {
      standT += DT;
      dSum += ai.d;
      dN++;
      if (ai.d < CLINCH_D) clinchT += DT;
    }
  }
  const dur = tDead ?? durS;
  return {
    id: ch.id,
    switchDist: mean(switchAt),
    switchesPerSec: switches / dur,
    meanDist: dN ? dSum / dN : 0,
    apm: (ai.stats.attacks / dur) * 60,
    feintsPerMin: (ai.stats.feints / dur) * 60,
    clinchPct: standT ? (clinchT / standT) * 100 : 0,
    ttk: tDead,
  };
}

/** 캐릭터 대 캐릭터 맞대결 (혹은 캐릭터 대 기본 AI) 한 판. a=enemy(index1), b=player(index0) */
function runDuel(chA, chB, seed, durS = 45) {
  const opts = {
    seed,
    difficulty: chA.ai.level,
    persona: chA.ai.persona,
    weapon2: chA.weapon,
    AI2Class: AI,
    difficulty2: chB.ai.level,
    persona2: chB.ai.persona,
    weapon: chB.weapon,
    look2: lookOf(chA),
    look: lookOf(chB),
    revive: chA.revive, // 부활(이졸데): 처음 죽으면 한 번 다시 일어선다
    revive2: chB.revive,
  };
  const G = newRound(opts);
  const { player: B, enemy: A, ai, ai2 } = G;
  const steps = Math.round(durS / DT);
  let fearA = 0, fearB = 0, n = 0; // 감정층 관찰: 판 동안의 평균 공포 세기
  for (let i = 0; i < steps; i++) {
    G.step();
    fearA += ai.fear; fearB += ai2.fear; n++;
    if (!A.alive || !B.alive) break;
  }
  const dur = n * DT;
  const emoOf = (x) => ({ peak: x.stats.emoPeak ?? {}, time: x.stats.emoTime ?? {}, count: x.stats.emoCount ?? {}, dur });
  const fear = { A: fearA / n, B: fearB / n, peakA: ai.stats.fearPeak ?? 0, peakB: ai2.stats.fearPeak ?? 0, emoA: emoOf(ai), emoB: emoOf(ai2) };
  fear.armor = { A: hasArmor(A) ? armorBroken(A) : null, B: hasArmor(B) ? armorBroken(B) : null };
  fear.shed = { A: hasArmor(A) ? armorShed(A) : null, B: hasArmor(B) ? armorShed(B) : null };
  if (!A.alive && !B.alive) return { r: 'draw', fear };
  if (!A.alive) return { r: 'B', fear }; // B(플레이어 자리) 승
  if (!B.alive) return { r: 'A', fear }; // A(적 자리) 승
  return { r: A.blood === B.blood ? 'draw' : A.blood > B.blood ? 'A' : 'B', fear };
}

function fmt(x) { return (Math.round(x * 100) / 100).toFixed(2); }

async function main() {
  if (mode === 'passive' || mode === 'both') {
    console.log('\n=== 구분성 (더미 상대, 60초, 시드 ' + SEED0 + '~' + (SEED0 + SEEDS - 1) + ' 평균) ===');
    console.log('id, 자세전환거리(m), 전환/초, 평균간격(m), 분당공격, 분당속임수, 붙음%, 평균TTK(s)');
    for (const ch of CHARACTERS) {
      const runs = [];
      for (let s = SEED0; s < SEED0 + SEEDS; s++) runs.push(runPassive(ch, s));
      const r = {
        switchDist: mean(runs.map((x) => x.switchDist)),
        switchesPerSec: mean(runs.map((x) => x.switchesPerSec)),
        meanDist: mean(runs.map((x) => x.meanDist)),
        apm: mean(runs.map((x) => x.apm)),
        feintsPerMin: mean(runs.map((x) => x.feintsPerMin)),
        clinchPct: mean(runs.map((x) => x.clinchPct)),
        ttks: runs.map((x) => x.ttk).filter((x) => x != null),
      };
      const ttkMean = r.ttks.length ? mean(r.ttks) : null;
      console.log(`${ch.id}, ${fmt(r.switchDist)}, ${fmt(r.switchesPerSec)}, ${fmt(r.meanDist)}, ${fmt(r.apm)}, ${fmt(r.feintsPerMin)}, ${fmt(r.clinchPct)}, ${ttkMean ? fmt(ttkMean) + ` (${r.ttks.length}/${SEEDS}판 처치)` : '처치 못함'}`);
    }
  }

  if (mode === 'rr' || mode === 'both') {
    console.log('\n=== 균형: 캐릭터 라운드로빈 (시드 ' + SEED0 + '~' + (SEED0 + SEEDS - 1) + ') ===');
    // 주의: 이 물리 시뮬레이션은 자리(A=index1/enemy, B=index0/player)에 따라 작지만 실재하는 유불리가
    //  있다(같은 성격끼리 붙여도 자리를 바꾸면 승률이 달라진다 — ai*.js가 아니라 물리/자리 배치 쪽 문제로
    //  보인다). 그래서 각 조합을 두 자리 배치 모두 돌려 평균 낸 "대칭 승률"을 진짜 실력 비교로 쓴다.
    const ids = CHARACTERS.map((c) => c.id);
    const raw = {}; // raw[A][B] = A가 자리 A(enemy)일 때 B를 이긴 비율(%)
    const fearOf = {}; // 캐릭터별 공포: 판 평균 세기들, 판 최고 세기들
    const EMOS = ['fear', 'anger', 'obsession'];
    const emoOf = {}; // 캐릭터별 감정: 판마다 {peak, time, dur}
    const armorOf = {}; // 캐릭터별: 판마다 완전히 부서진 방어구 수 (방어구가 있는 캐릭터만)
    const shedOf = {}; // 캐릭터별: 판마다 파손(곁 조각 떨어짐) 횟수
    for (const id of ids) { fearOf[id] = { mean: [], peak: [] }; emoOf[id] = []; armorOf[id] = []; shedOf[id] = []; }
    for (const chA of CHARACTERS) {
      raw[chA.id] = {};
      for (const chB of CHARACTERS) {
        if (chA.id === chB.id) continue;
        let aWins = 0, bWins = 0, draws = 0;
        for (let s = SEED0; s < SEED0 + SEEDS; s++) {
          const { r, fear } = runDuel(chA, chB, s);
          if (r === 'A') aWins++; else if (r === 'B') bWins++; else draws++;
          fearOf[chA.id].mean.push(fear.A); fearOf[chA.id].peak.push(fear.peakA);
          fearOf[chB.id].mean.push(fear.B); fearOf[chB.id].peak.push(fear.peakB);
          emoOf[chA.id].push(fear.emoA); emoOf[chB.id].push(fear.emoB);
          if (fear.armor.A != null) armorOf[chA.id].push(fear.armor.A), shedOf[chA.id].push(fear.shed.A);
          if (fear.armor.B != null) armorOf[chB.id].push(fear.armor.B), shedOf[chB.id].push(fear.shed.B);
        }
        raw[chA.id][chB.id] = (aWins / SEEDS) * 100;
      }
    }
    console.log('[감정층] 캐릭터별 공포: 판 평균 세기 / 판 최고 세기의 평균 / 공포가 0.3을 넘은 판 비율');
    for (const id of ids) {
      const f = fearOf[id];
      console.log(`${id}: fearful=${CHARACTERS.find((c) => c.id === id).ai.persona.pers.fearful ?? 0}, mean ${fmt(mean(f.mean))}, peak ${fmt(mean(f.peak))}, 겁먹은 판 ${fmt((100 * f.peak.filter((p) => p > 0.3).length) / f.peak.length)}%`);
    }
    console.log('');
    console.log('[감정층·세 감정] 캐릭터별: 판% = 그 감정이 0.3을 넘은 판 비율 / 지배% = 지배한 시간 비율 / 횟수 = 한 판에 지배 감정으로 켜진 평균 횟수 / 초 = 한 번 켜지면 평균 지속(초) — 세 감정 모두 효과가 붙어 있음(지배 감정만)');
    console.log('id,' + EMOS.map((e) => `${e}:판%/지배%/횟수/초`).join(','));
    for (const id of ids) {
      const runs = emoOf[id];
      const cells = EMOS.map((e) => {
        const fired = (100 * runs.filter((r) => (r.peak[e] ?? 0) > 0.3).length) / runs.length;
        const totalT = runs.reduce((s, r) => s + r.dur, 0);
        const onT = runs.reduce((s, r) => s + (r.time[e] ?? 0), 0);
        const cnt = runs.reduce((s, r) => s + (r.count[e] ?? 0), 0);
        return `${fired.toFixed(0)}/${((100 * onT) / totalT).toFixed(0)}/${(cnt / runs.length).toFixed(1)}/${cnt ? (onT / cnt).toFixed(1) : '-'}`;
      });
      console.log(`${id},${cells.join(',')}`);
    }
    console.log('');
    console.log('[방어구] 투구·판금을 입은 캐릭터: 완전히 부서진 판 비율 / 판마다 부서진 수 평균 (투구 1 + 판금 부위 수) · 조각이라도 떨어져 나간 판 비율(파손 또는 완전 파손)');
    for (const id of ids) {
      const a = armorOf[id];
      const sh = shedOf[id];
      if (a.length) console.log(`${id}: ${fmt((100 * a.filter((x) => x > 0).length) / a.length)}% / ${fmt(mean(a))} · ${fmt((100 * a.filter((x, i) => x > 0 || sh[i] > 0).length) / a.length)}%`);
    }
    console.log('');
    console.log('[참고] 자리 그대로: 행 = A(enemy 자리), 열 = B(player 자리). 셀 = A가 B를 이긴 비율(%)');
    console.log('A\\B,' + ids.join(','));
    for (const a of ids) console.log(a + ',' + ids.map((b) => (a === b ? '-' : fmt(raw[a][b]))).join(','));

    // 대칭 승률: X가 A자리일 때 이긴 비율과, X가 B자리일 때(=Y가 A자리일 때 Y가 진 비율) 이긴 비율의 평균
    const sym = {};
    for (const x of ids) { sym[x] = {}; for (const y of ids) if (x !== y) sym[x][y] = (raw[x][y] + (100 - raw[y][x])) / 2; }
    console.log('\n[진짜 밸런스] 대칭 승률: 행 X가 열 Y를 이긴 비율(%) — 자리 유불리를 상쇄한 값');
    console.log('X\\Y,' + ids.join(','));
    for (const x of ids) console.log(x + ',' + ids.map((y) => (x === y ? '-' : fmt(sym[x][y]))).join(','));
  }
}

main();

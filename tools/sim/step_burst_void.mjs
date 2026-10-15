// 첫 걸음 박차기 빼기 계기 (10/15 — docs/strike/step_burst_2026-10-15.md): AI 롱소드가 제 간격에서 치는 첫 공격을, 그 자리에 서 있던 대본 플레이어가 발로 빼는가 — 박차기 켬·끔.
//  판: 벽 있음 · AI(상대 자리, 롱소드 유파 normal)가 판 시작 정지 뒤 다가와 제 판단으로 친다 · 플레이어(AI 아님)는 스틱 0 으로 서 있다가
//   AI 공격 시작(ai.js startStrike — 칼이 베는 길을 떠나는 순간) + 늦음(0 · 0.1 · 0.2 s)에 스틱을 민다(뒤 끝 · 옆 끝) — hold s 동안 밀고 놓는다.
//  가름(첫 공격 하나 — startStrike 부터 그 공격의 afterStrike 까지): 맞음(플레이어 상처 · AI hitLanded) · 막힘(칼끼리 — AI bound, 맞음 없이) · 빠짐(둘 다 아님 = 헛침 → afterStrike 가 플레이어 걸음에 foeWhiff)
//  칸: 판 수 · 맞음/막힘/빠짐 · 칼날(코등이 쪽 끝~칼끝 선분) ↔ 플레이어 머리·가슴 중심 가장 가까운 거리 평균 · 그때 플레이어 가슴이 상대 반대쪽으로 간 거리 평균 ·
//   가슴이 0.2 m 물러난 때(스틱 민 뒤) 평균 · 간격 잡기(플레이어 무기가 독일이면 — 10/15 18:0x 부터 잡기도 켜짐, GAIT.deHold): 빠짐 뒤 받을 창 열림 · 열린 뒤 앞 끝으로 밀어 빠른 걸음 난 판
//  기술: 기본 = AI 가 고른 대로(속임수만 끔 — 공격 시작이 가짜면 늦음이 뜻이 없다) · VOID_TECH=stichPflug|oberhau … → 그 기술만(pickTech 덮음)
//  재기만 — 물리·난수·AI 는 게임 그대로(startStrike·afterStrike·foeWhiff·begin 을 감싸 읽기 · 속임수 끔·기술 고르기 덮음만 대본), 판 하나는 결정적. 켬·끔은 같은 씨앗 — 스틱을 밀기 전까지 바이트 같다
//  VOID_LOCK=1 → 가정 갈래: AI 가 치는 동안 몸(heading)을 돌리지 못함(게임은 늘 플레이어 골반 쪽으로 초속 2.4 rad 까지 돎 — 옆 빼기를 따라옴)
//  실행: node tools/sim/step_burst_void.mjs [플레이어 무기 longsword] [쪽 back|right|left] [씨앗 수 24] [늦음들 0,0.1,0.2] [hold 0.5]
import { newRound, DT, THREE } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { GAIT } from '../../src/config.js';
import { Gait } from '../../src/gait.js';
import { Fighter } from '../../src/fighter.js';

const [pw = 'longsword', dirArg = 'back', nSeedArg = '24', delayArg = '0,0.1,0.2', holdArg = '0.5'] = process.argv.slice(2);
const N = +nSeedArg;
const DELAYS = delayArg.split(',').map(Number);
const HOLD = +holdArg;
const FORCE = process.env.VOID_TECH || null;
const LOCK = process.env.VOID_LOCK === '1'; // 가정: AI 가 치는 동안(startStrike ~ 그 공격 끝) 몸을 돌리지 못한다 — 옆 빼기가 AI 몸 돌림 없이 얼마나 되는지 보려는 시험 갈래(게임 아님)
const STICK = { back: [0, -1], right: [1, 0], left: [-1, 0] }[dirArg];
const SB0 = GAIT.stepBurst;

// 대본: 속임수 끔 · (VOID_TECH) 기술 고정
const SA = AI.prototype.startAttack;
AI.prototype.startAttack = function (tech, why, opt = {}) {
  return SA.call(this, tech, why, { ...opt, noFeint: true });
};
if (FORCE) {
  const PT = AI.prototype.pickTech;
  AI.prototype.pickTech = function (s, why, prefer) {
    return this.school.techByName[FORCE] ?? PT.call(this, s, why, prefer);
  };
}
let rec = null;
const SS = AI.prototype.startStrike;
AI.prototype.startStrike = function () {
  SS.call(this);
  if (rec && this === rec.ai && rec.tStrike == null) {
    rec.tStrike = rec.t;
    rec.tech = this.tech?.name;
  }
};
const UH = Fighter.prototype.updateHeading;
const _up = new THREE.Vector3(0, 1, 0);
Fighter.prototype.updateHeading = function (dt) {
  if (LOCK && rec && this === rec.E && rec.tStrike != null && rec.tEnd == null && this.state === 'stand') {
    this.yaw.setFromAxisAngle(_up, this.heading);
    return;
  }
  return UH.call(this, dt);
};
const AS = AI.prototype.afterStrike;
AI.prototype.afterStrike = function (d) {
  if (rec && this === rec.ai && rec.tStrike != null && rec.tEnd == null) {
    rec.tEnd = rec.t;
    rec.landed = this.hitLanded;
    rec.bound = this.bound;
  }
  return AS.call(this, d);
};
const AB = AI.prototype.abortAttack;
AI.prototype.abortAttack = function () {
  if (rec && this === rec.ai && rec.tStrike != null && rec.tEnd == null) {
    rec.tEnd = rec.t;
    rec.aborted = true;
  }
  return AB.call(this);
};
const FW = Gait.prototype.foeWhiff;
Gait.prototype.foeWhiff = function () {
  FW.call(this);
  if (rec && this.f === rec.P && rec.tEnd != null && rec.whiffT == null) {
    rec.whiffT = rec.t;
    rec.chaseOpened = !!this.chase;
  }
};
const BG = Gait.prototype.begin;
Gait.prototype.begin = function (l, kind, T) {
  BG.call(this, l, kind, T);
  if (rec && this.f === rec.P && rec.goT != null && this.fastK > 1 && (kind === 'walk' || kind === 'catch')) rec.chaseFast++;
};

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
function segPointDist(a, b, p) {
  _c.subVectors(b, a);
  const L2 = _c.lengthSq();
  const u = L2 > 1e-9 ? THREE.MathUtils.clamp(_c.dot(_b.copy(p).sub(a)) / L2, 0, 1) : 0;
  return _b.copy(a).addScaledVector(_c, u).distanceTo(p);
}

function trial(seed, delay, on) {
  GAIT.stepBurst = on;
  const G = newRound({ walls: true, seed, weapon: pw, weapon2: 'longsword', difficulty: 'normal', persona: { school: 'longsword' } });
  const P = G.player;
  const E = G.enemy;
  rec = { ai: G.ai, P, E, t: 0, tStrike: null, tEnd: null, landed: false, bound: false, whiffT: null, chaseOpened: false, goT: null, chaseFast: 0, wounds0: 0 };
  let t = 0;
  const step = (mx, my) => {
    P.move.set(mx, my);
    G.step();
    t += DT;
    rec.t = t;
  };
  // 공격 시작까지: 서 있다 (늦어도 25 s)
  while (rec.tStrike == null && t < 25 && P.alive && E.alive) step(0, 0);
  if (rec.tStrike == null) return { none: true };
  const wounds0 = G.wounds.filter((w) => w.vic === P).length;
  const t0 = rec.tStrike;
  const pc = P.bodies.chest.translation();
  const ec = E.bodies.chest.translation();
  const away = new THREE.Vector3(pc.x - ec.x, 0, pc.z - ec.z).normalize(); // 상대 반대쪽
  const C0 = { x: pc.x, z: pc.z };
  const d0 = Math.hypot(pc.x - ec.x, pc.z - ec.z);
  const fwd = P.forward(new THREE.Vector3());
  let minD = Infinity;
  let atMin = 0;
  let tMin = NaN;
  let atMinAll = 0;
  let back20 = NaN;
  let pushT = null;
  const L = { head: P.bodies.head, chest: P.bodies.chest };
  const until = t0 + 3;
  while (t < until && P.alive) {
    const tt = t - t0;
    let mx = 0;
    let my = 0;
    if (tt >= delay - 1e-9 && tt < delay + HOLD) {
      [mx, my] = STICK;
      if (pushT == null) pushT = t;
    }
    // 간격 잡기 확인: 헛침 알림이 오면 스틱을 놓은 뒤 앞 끝으로 민다(알림 뒤 1.2 s 까지 — 받을 창 0.6 s 안에 앞 걸음을 떼야 받음)
    if (rec.whiffT != null && tt >= delay + HOLD && t - rec.whiffT < 1.2) {
      mx = 0;
      my = 1;
      if (rec.goT == null) rec.goT = t;
    }
    step(mx, my);
    const c = P.bodies.chest.translation();
    const moved = (c.x - C0.x) * away.x + (c.z - C0.z) * away.z;
    if (pushT != null && Number.isNaN(back20) && Math.hypot(c.x - C0.x, c.z - C0.z) >= 0.2) back20 = t - pushT;
    if (rec.tEnd == null) {
      E.bladePoint(0, _a);
      E.bladePoint(1, _b.set(0, 0, 0));
      const tip = _b.clone();
      for (const k of ['head', 'chest']) {
        const q = L[k].translation();
        const d = segPointDist(_a, tip, _c.set(q.x, q.y, q.z).clone());
        if (d < minD) {
          minD = d;
          atMin = moved;
          atMinAll = Math.hypot(c.x - C0.x, c.z - C0.z);
          tMin = t - t0;
        }
      }
    }
    // 그 공격이 끝나기 전에 AI 가 공격 꼴을 벗어남(막기·물러남으로 바꿈 — afterStrike 없이) = 거둠
    if (rec.tEnd == null && G.ai.mode !== 'attack') {
      rec.tEnd = t;
      rec.aborted = true;
    }
  }
  const W = G.wounds.filter((w) => w.vic === P).slice(wounds0).filter((w) => w.t <= (rec.tEnd ?? Infinity) + 0.05);
  const wounded = W.length > 0;
  const hit = rec.landed || wounded;
  const out = { tech: rec.tech, d0, hit, bound: !hit && rec.bound, miss: !hit && !rec.bound && rec.tEnd != null, aborted: !!rec.aborted && !hit, open: rec.tEnd == null, minD, atMin, atMinAll, tMin, back20, whiff: rec.whiffT != null, chaseOpened: rec.chaseOpened, chaseFast: rec.chaseFast, zone: W[0]?.zone ?? null };
  rec = null;
  GAIT.stepBurst = SB0;
  return out;
}

const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '-');
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
console.log(`박차기 빼기 계기 · 플레이어 ${pw} · 쪽 ${dirArg} · 롱소드 AI 첫 공격${FORCE ? ` (기술 ${FORCE})` : ' (AI 가 고른 기술 · 속임수 끔)'}${LOCK ? ' · 가정: AI 가 치는 동안 몸을 돌리지 못함' : ''} · 씨앗 ${N} · 스틱 ${HOLD} s 밀고 놓기 · 켬 = GAIT.stepBurst 1 · 끔 = 0`);
console.log('| 늦음 s | 박차기 | 판 | 맞음 · 막힘 · 빠짐 | 칼날 ↔ 머리·가슴 가장 가까이 m | 그때 물러난 거리 m (상대 반대쪽 · 모든 쪽) | 0.2 m 간 때 s | 시작 거리 m | 빠짐 → 받을 창 열림 · 빠른 걸음 난 판 |');
console.log('|---|---|---|---|---|---|---|---|---|');
const rows = [];
for (const delay of DELAYS) {
  for (const on of [0, 1]) {
    const R = [];
    for (let s = 1; s <= N; s++) {
      const r = trial(1000 + s, delay, on);
      if (!r.none) R.push({ seed: 1000 + s, ...r });
    }
    rows.push({ delay, on, R });
    const n = R.length;
    const c = (k) => R.filter((r) => r[k]).length;
    const miss = R.filter((r) => r.miss);
    console.log(`| ${delay.toFixed(1)} | ${on ? '켬' : '끔'} | ${n} | ${c('hit')} · ${c('bound')} · ${c('miss')}${c('open') ? ` (끝 안 남 ${c('open')})` : ''} | ${f2(mean(R.map((r) => r.minD)))} | ${f2(mean(R.map((r) => r.atMin)))} · ${f2(mean(R.map((r) => r.atMinAll)))} | ${f2(mean(R.filter((r) => Number.isFinite(r.back20)).map((r) => r.back20)))} | ${f2(mean(R.map((r) => r.d0)))} | ${miss.filter((r) => r.chaseOpened).length}/${miss.length} · ${miss.filter((r) => r.chaseFast > 0).length} |`);
  }
}
if (process.env.VOID_ROWS === '1') {
  for (const { delay, on, R } of rows) console.log(`\n${delay} ${on ? '켬' : '끔'}: ` + R.map((r) => `${r.seed}:${r.tech}:${r.hit ? 'H' + (r.zone ? '(' + r.zone + ')' : '') : r.bound ? 'B' : r.aborted ? 'A' : r.miss ? 'M' : '?'}:${f2(r.minD)}@${f2(r.tMin)}${r.chaseOpened ? 'c' : ''}${r.chaseFast ? 'f' + r.chaseFast : ''}`).join(' '));
}

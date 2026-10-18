// 청강검 AI 바닥 진단 (10/9) — motion_lab 'duel <무기> 24 main' 과 같은 판(같은 시드·같은 차림: 무기 쪽 X = 그 무기 꾸러미, 상대 Y = 롱소드 AI)에
//  쪽마다 계기를 단다. 승패는 motion_lab 과 바이트까지 같아야 한다(난수를 쓰지 않는 훅만 건다 — 기준 판 2/38/8 로 확인).
//  쪽(X/Y)마다: 휘두름·그만둔 공격·맞힘(벤/둔)·휘두름당 맞힘·막힘(칼이 맞물리고 못 맞힘)·머리+목·베기 E 중앙·상처 깊이 합·
//  휘두름 시작 거리(d, contactDist)와 간격(contact·reach)의 차·내 clinch 안에 있던 시간 몫·상대 reach 안에 있던 시간 몫·
//  휘두르는 동안 상대에게 맞은 휘두름 몫(맞받아 맞음)·먼저 맞힌 판·넘어짐·죽음(원인)·무기 부러짐. X 는 기술별 휘두름/맞힘도.
//
//  node tools/sim/qinggang_diag.mjs [무기=qinggang] [자리마다 판 수=24]
//  조건(환경 변수, 하나씩 켜서 같은 시드로 비교 — src 는 바꾸지 않고 이 프로세스 안에서만 덮는다):
//   QG_LIB=off              동작 라이브러리 끔 (motion_lab duel … off 와 같은 길이 아님: 무기 꾸러미는 그대로, MOTION.lib 만 끔)
//   QG_SCHOOLART=0          유파 자료 끔 (SKILL.schoolArt 0 — 중국 가중치·맞받아치기 빼기)
//   QG_CONTACT=±m QG_REACH=±m QG_CLINCH=±m   X AI 간격에 더하기 (생성 뒤 a.M 덮어쓰기)
//   QG_CUTTIME=s            X AI 베는 시간 바꾸기
//   QG_TABLE=sabre|hybrid|thrust   X 자세표 바탕을 바꿔 다시 짓는다 (hybrid = 찌르기 표 + 베기 감는 자세 8 곳만 세이버 표) (라이브러리 켬이면 몸 틀 표를 그 바탕 위에)
//   QG_TECH=german|jian     X 꾸러미 기술 목록을 독일(롱소드) 그대로 / 지안(찌르기 ×1.5 + reach 보정)로
//   QG_THRUSTK=k            X 꾸러미 찌르기 기술 base 곱 (기술 목록 위에)
//   QG_NOWRIST=1            손목 베기(wristCut, 라이브러리 새 기술) 빼기
//   QG_BODY=<무기id>        X 가 쥐는 칼만 바꾼다 (꾸러미는 그대로 qinggang) — 몸(물리) 대 꾸러미 가르기
//   QG_SCHOOL=<꾸러미id>    X 꾸러미만 바꾼다 (칼은 그대로)
//   QG_MCUT=x QG_MTHRUST=x  X 칼 스펙 배율 덮기 (상처 깊이·기술 고르기 thrustBias 에 닿는다)
//   QG_STYLE=cut            X 칼 스펙의 싸움 방식을 바꾼다 (versatile → cut: 세이버 표 바탕·라이브러리 cut 표)
//   QG_THRUSTSTYLE=rapier   X 칼에 찌르기 장점(THRUST_STYLE) 주기 — AI 찌르기 기술이 탭 찌르기로 나간다
//   QG_WRIST=v              X 손목 최고 빠르기(wristVmax) 덮기
//   QG_SEEDS=from-to        자리마다 시드 범위 (기본 1-N)
//  출력: 한 줄 JSON(요약) + 표. QG_JSON=파일 이면 요약을 파일로도 쓴다.
import { newRound, DT } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { WEAPONS, THRUST_STYLE } from '../../src/weapons.js';
import { SCHOOLS } from '../../src/schools.js';
import { SKILL } from '../../src/config.js';
import { MOTION, NEW_TECH, buildFrameTable } from '../../src/frames.js';
import { GUARD_BASE_ONE_SABRE, GUARD_BASE_ONE_THRUST } from '../../src/guards.js';
import { TECH } from '../../src/ai_techniques.js';
import { wilson } from './ref_duel.mjs';
import { writeFileSync } from 'node:fs';

const [id = 'qinggang', nArg = '24'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const N = +nArg;
const env = process.env;
MOTION.lib = env.QG_LIB !== 'off'; // motion_lab duel 'main' = 본판 길(스위치 켬)
if (env.QG_SCHOOLART != null) SKILL.schoolArt = +env.QG_SCHOOLART;
if (env.QG_NOWRIST === '1') for (const k of Object.keys(NEW_TECH)) for (const t of NEW_TECH[k]) if (t.name === 'wristCut') t.ai = false;
const bodyId = env.QG_BODY || id;
const schoolId = env.QG_SCHOOL || (SCHOOLS[id] ? id : 'longsword');
// 꾸러미 손보기 (라이브러리 병합·유파 자료 전, 꾸러미 객체를 바꿔 끼운다 — 이 프로세스 안에서만)
if (env.QG_TECH || env.QG_THRUSTK) {
  const S = SCHOOLS[schoolId];
  let tech = S.tech;
  if (env.QG_TECH === 'german') tech = TECH;
  if (env.QG_TECH === 'jian') tech = SCHOOLS.jian.tech;
  if (env.QG_THRUSTK) tech = tech.map((t) => (t.kind === 'thrust' ? { ...t, base: t.base * +env.QG_THRUSTK } : t));
  SCHOOLS[schoolId] = { ...S, tech, techByName: Object.fromEntries(tech.map((t) => [t.name, t])) };
}
// 섞은 표: 찌르기 표에서 베기를 감는 자세(칼이 어깨·머리·허리 옆으로 돌아가는 자리)만 세이버 표로
const CHAMBER = ['지붕 (폼 타크)', '어깨 지붕 (폼 타크)', '옆 자세', '바꿈 (베크셀)', '옆 지킴 (네벤후트)', '왼 어깨 지붕 (폼 타크)', '왼 옆 자세', '왼 바꿈 (베크셀)'];
const HYBRID = GUARD_BASE_ONE_THRUST.map((g, i) => (CHAMBER.includes(g.name) ? GUARD_BASE_ONE_SABRE[i] : g));
const spec = WEAPONS[bodyId];
if (env.QG_MCUT) spec.mCut = +env.QG_MCUT;
if (env.QG_MTHRUST) spec.mThrust = +env.QG_MTHRUST;
if (env.QG_STYLE) spec.style = env.QG_STYLE; // 싸움 방식 통째로 (자세표 바탕·라이브러리 몸 틀 표·덧씌우기가 따라 바뀐다)
if (env.QG_THRUSTSTYLE) spec.thrustStyle = THRUST_STYLE[env.QG_THRUSTSTYLE]; // AI 찌르기를 탭 찌르기로 (레이피어·에스톡의 찌르기 장점)
if (env.QG_WRIST) spec.controlOverrides = { ...(spec.controlOverrides ?? {}), wristVmax: +env.QG_WRIST };
const [s0, s1] = env.QG_SEEDS ? env.QG_SEEDS.split('-').map(Number) : [1, N];

const med = (a) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const r2 = (x) => (Number.isFinite(x) ? +x.toFixed(2) : null);
const pct = (a, b) => (b ? Math.round((100 * a) / b) : null);

// 쪽 기록 (X = 무기 쪽, Y = 롱소드)
const fresh = () => ({ swings: 0, aborted: 0, hits: 0, cut: 0, blunt: 0, headNeck: 0, cutE: [], sev: 0, landedSwings: 0, parried: 0, hitWhileSwing: 0, dStart: [], cdStart: [], needGap: [], tStand: 0, tInClinch: 0, tInFoeReach: 0, tInOwnContact: 0, modeT: {}, firstHit: 0, falls: 0, deaths: 0, causes: {}, broke: 0, byTech: {}, byKind: { cut: [0, 0], thrust: [0, 0] }, tFirst: [] });
const side = { X: fresh(), Y: fresh() };
const tag = new Map(); // AI → 'X' | 'Y'
let cur = { X: null, Y: null };
const origStart = AI.prototype.startStrike, origAbort = AI.prototype.abortAttack, origAfter = AI.prototype.afterStrike;
AI.prototype.startStrike = function () {
  const k = tag.get(this);
  if (k) {
    const S = side[k];
    if (cur[k]) closeSwing(k);
    S.swings++;
    const t = this.tech;
    cur[k] = { hits: 0, hitBy: 0, tech: t?.name, kind: t?.kind };
    S.dStart.push(this.d);
    S.cdStart.push(this.contactDist());
    S.needGap.push(this.contactDist() - (this.M.contact + (t?.reach ?? 0) * this.reachScale)); // < 0 이면 기술 닿는 거리 안쪽에서 시작
    const bt = (S.byTech[t?.name] ||= [0, 0]); bt[0]++;
    if (S.byKind[t?.kind]) S.byKind[t.kind][0]++;
  }
  return origStart.apply(this, arguments);
};
AI.prototype.abortAttack = function () { const k = tag.get(this); if (k) side[k].aborted++; return origAbort.apply(this, arguments); };
AI.prototype.afterStrike = function () { const k = tag.get(this); if (k && this.bound && !this.hitLanded) side[k].parried++; return origAfter.apply(this, arguments); };
function closeSwing(k) {
  const c = cur[k]; if (!c) return; const S = side[k];
  if (c.hits > 0) { S.landedSwings++; if (S.byTech[c.tech]) S.byTech[c.tech][1]++; if (S.byKind[c.kind]) S.byKind[c.kind][1]++; }
  if (c.hitBy > 0) S.hitWhileSwing++;
  cur[k] = null;
}

let Wn = 0, L = 0, D = 0, tSum = 0, tN = 0;
const ends = [];
for (let s = s0; s <= s1; s++) {
  for (const xFirst of [true, false]) {
    const seed = (xFirst ? 1000 : 2000) + s;
    const x = { weapon: bodyId, persona: { school: schoolId } };
    const y = { weapon: 'longsword', persona: { school: 'longsword' } };
    const P = xFirst ? x : y, E = xFirst ? y : x;
    const G = newRound({ walls: true, seed, weapon: P.weapon, weapon2: E.weapon, difficulty: 'normal', persona: E.persona, AI2Class: AI, difficulty2: 'normal', persona2: P.persona });
    const F = { X: xFirst ? G.player : G.enemy, Y: xFirst ? G.enemy : G.player };
    const A = { X: xFirst ? G.ai2 : G.ai, Y: xFirst ? G.ai : G.ai2 };
    tag.clear(); tag.set(A.X, 'X'); tag.set(A.Y, 'Y');
    cur = { X: null, Y: null };
    const a = A.X;
    if (env.QG_CONTACT) a.M = { ...a.M, contact: a.M.contact + +env.QG_CONTACT };
    if (env.QG_REACH) a.M = { ...a.M, reach: a.M.reach + +env.QG_REACH };
    if (env.QG_CLINCH) a.M = { ...a.M, clinch: a.M.clinch + +env.QG_CLINCH };
    if (env.QG_CUTTIME) a.M = { ...a.M, cutTime: +env.QG_CUTTIME };
    if (env.QG_TABLE) {
      const base = env.QG_TABLE === 'sabre' ? GUARD_BASE_ONE_SABRE : env.QG_TABLE === 'hybrid' ? HYBRID : GUARD_BASE_ONE_THRUST;
      const fx = F.X;
      const tbl = MOTION.lib ? buildFrameTable(fx.swordArt?.frame ?? spec.frame, fx.swordArt?.style ?? spec.style, spec.motionSkip ?? [], base) : base;
      fx.guardPose.table = fx.bodyGuard.table = tbl;
    }
    const prev = { X: 'stand', Y: 'stand' };
    let first = null;
    let seen = G.wounds.length;
    let res = 'D';
    for (let i = 0; i < 40 / DT; i++) {
      G.step();
      for (const k of ['X', 'Y']) {
        const f = F[k], ai = A[k], o = k === 'X' ? 'Y' : 'X';
        if (prev[k] === 'stand' && (f.state === 'down' || f.state === 'getup')) side[k].falls++;
        prev[k] = f.state;
        const striking = ai.mode === 'attack' && (ai.phase === 'strike' || ai.phase === 'follow');
        if (cur[k] && !striking) closeSwing(k);
        if (f.state === 'stand' && F[o].state === 'stand') {
          const S = side[k];
          S.tStand += DT;
          if (ai.d < ai.M.clinch) S.tInClinch += DT;
          if (ai.d < ai.M.contact) S.tInOwnContact += DT;
          if (ai.d < A[o].M.reach) S.tInFoeReach += DT;
          S.modeT[ai.mode] = (S.modeT[ai.mode] ?? 0) + DT;
        }
      }
      for (; seen < G.wounds.length; seen++) {
        const w = G.wounds[seen];
        const k = w.att === F.X ? 'X' : 'Y', o = k === 'X' ? 'Y' : 'X';
        const S = side[k];
        S.hits++;
        if (w.type === 'blunt') S.blunt++; else { S.cut++; S.cutE.push(w.energy); }
        if (w.zone === 'head' || w.zone === 'neck') S.headNeck++;
        S.sev += w.severity ?? 0;
        if (cur[k]) cur[k].hits++;
        if (cur[o]) cur[o].hitBy++;
        if (!first) { first = k; S.firstHit++; S.tFirst.push(w.t); }
      }
      const xd = F.X.state === 'dead', yd = F.Y.state === 'dead';
      if (xd || yd) { res = xd && yd ? 'D' : yd ? 'W' : 'L'; tSum += G.t; tN++; break; }
    }
    for (const k of ['X', 'Y']) closeSwing(k);
    for (const k of ['X', 'Y']) {
      const f = F[k];
      if (f.weaponBroken) side[k].broke++;
      if (f.state === 'dead') { side[k].deaths++; const c = f.causeOfDeath || '?'; side[k].causes[c] = (side[k].causes[c] || 0) + 1; }
    }
    if (res === 'W') Wn++; else if (res === 'L') L++; else D++;
    ends.push(res);
  }
}
const n = ends.length;
const row = (k) => {
  const S = side[k];
  return {
    swings: S.swings, aborted: S.aborted, hits: S.hits, cut: S.cut, blunt: S.blunt,
    landedPct: pct(S.landedSwings, S.swings), parriedPct: pct(S.parried, S.swings), hitWhileSwingPct: pct(S.hitWhileSwing, S.swings),
    headNeck: S.headNeck, cutE_med: r2(med(S.cutE)), sevPerFight: r2(S.sev / n),
    dStart_med: r2(med(S.dStart)), cdStart_med: r2(med(S.cdStart)), needGap_med: r2(med(S.needGap)),
    inClinchPct: pct(S.tInClinch, S.tStand), inOwnContactPct: pct(S.tInOwnContact, S.tStand), inFoeReachPct: pct(S.tInFoeReach, S.tStand),
    mode: Object.fromEntries(Object.entries(S.modeT).map(([m, t]) => [m, pct(t, S.tStand)])),
    firstHit: S.firstHit, tFirst_med: r2(med(S.tFirst)), falls: S.falls, deaths: S.deaths, causes: S.causes, broke: S.broke,
    byKind: S.byKind,
  };
};
const [lo, hi] = wilson(Wn, n);
const label = Object.entries(env).filter(([k]) => k.startsWith('QG_') && k !== 'QG_JSON').map(([k, v]) => `${k.slice(3)}=${v}`).join(' ') || '기준';
const out = { id, label, W: Wn, L, D, n, winPct: Math.round((100 * Wn) / n), ci: [Math.round(100 * lo), Math.round(100 * hi)], endT: r2(tSum / Math.max(1, tN)), ends: ends.join(''), X: row('X'), Y: row('Y'), xTech: side.X.byTech, M: null };
console.log(JSON.stringify(out));
if (env.QG_JSON) writeFileSync(env.QG_JSON, JSON.stringify(out, null, 1));
const cols = ['swings', 'aborted', 'hits', 'cut', 'blunt', 'landedPct', 'parriedPct', 'hitWhileSwingPct', 'headNeck', 'cutE_med', 'sevPerFight', 'dStart_med', 'cdStart_med', 'needGap_med', 'inClinchPct', 'inOwnContactPct', 'inFoeReachPct', 'firstHit', 'tFirst_med', 'falls', 'deaths', 'broke'];
console.log(`${id} [${label}] 승 ${Wn} 패 ${L} 무 ${D} / ${n} (${out.winPct}%, 95% ${out.ci[0]}~${out.ci[1]}%) · 평균 종료 ${out.endT}s`);
console.log('쪽\t' + cols.join('\t'));
for (const k of ['X', 'Y']) console.log(k + '\t' + cols.map((c) => out[k][c]).join('\t') + '\t' + JSON.stringify(out[k].causes) + ' ' + JSON.stringify(out[k].mode));
console.log('X 기술 [휘두름, 맞힌 휘두름]: ' + Object.entries(side.X.byTech).sort((a, b) => b[1][0] - a[1][0]).map(([t, [s, h]]) => `${t} ${s}/${h}`).join(', '));

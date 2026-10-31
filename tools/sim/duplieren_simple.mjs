// ─────────────────────────────────────────────────────────────
//  duplieren_simple.mjs — 겹치기 단순 길 · 앞 박차기 재기 (사장님 10/31 19:xx '겹치기의 발동 경로가 좀 어색하더라 … 가장 효율적이고 단순한 움직임 … 박차기를 앞으로 쓰면서 치는 효과' ·
//   19:xx 둘째 말씀 '손 동작과 발 동작이 어우러져야 하니까. 그게 최우선.' — 기록 docs/strike/duplieren_simple_2026-10-31.md) · 재기만 (게임 값은 갈래에서만 덮어씀)
//   판: duplieren_auto.mjs fight 그대로 — 사람 몸(독일 무기 셋) 손가락 봇 press(띠 가운데를 지키며 상대 칼을 가로지르는 긋기 → 닿으면 느리게 밀고 쥠) 대 치고 막는 AI(숙련 3) ·
//   겹치기 자동(기본 'bind' — 0.6 s)이 냄. 낸 뒤 1.2 게임 초 동안 스텝마다 적음(probe — recorder):
//    칼끝 · 손(칼자루) · 골반 · 가슴(세계 — 낸 때 몸 틀: x 상대 쪽 · y 위 · z 칼 든 쪽 옆) · 발(딛음 · 디딘 자리 · 걸음 갈래) · 운동학 칼(끄는 중 · 베는 토막) · 손목(wrist_audit) · 날 앞장 cos ·
//    상대 칼 지나감(duplieren_check sample far) · 넘어짐 · 기울기 · 맞음(때 · 곳 · 에너지 · 심각도)
//   잼: 휨(tsubame_trace bendOf — 칼끝 길의 곧은 줄 대비 몫 · 꺾임 · 몸 틀(가슴 따라)과 세계 둘) · 때 맞춤(칼 시작 · 첫 맞음 · 칼 끝 ↔ 앞발 뜸 · 디딤) · 손 ↔ 골반 빠르기(앞 몫 상관 · 늦음)
//  갈래: old = 10/28 길 · 몫 0.5 · 박차기 없음 (`?dupOld=1`) · new:<몫>:<박차기 m>[:<손발 순서 1|2|0>[:<박차기 시간 실제 초 — 0 = GAIT.burstT>[:<몸 꼴 dupBurstMatch 0|1|2>]]] (예 new:0.3:0.45 · new:0.5:0 = 단순 길만 · new:0.3:0.45:0 = 칼은 몫 빠르기 그대로 · new:0.3:0.45:1:0:1 = 첫 걸음 박차기 물리)
//  node tools/sim/duplieren_simple.mjs [--variants=old,new:0.1:0.45] [--weapons=longsword,sabre,kriegsmesser] [--opps=longsword,uchigatana,zweihander,rapier] [--seeds=901,902,903,904] [--dur=30] [--json=파일] [--v]
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { DT, CONFIG, THREE } from './harness_m.mjs';
import { fight, closedTable } from './duplieren_auto.mjs';
import { PlayerUniqueAssist, strokeTechOf } from '../../src/unique_assist.js';
import { bendOf } from './tsubame_trace.mjs';
import { wristSample, outOfRange, OOR_EPS, ROLL_AT } from './wrist_audit.mjs';
import { sample as dupSample } from './duplieren_check.mjs';
import { isMain } from './is_main.mjs';

const UA = CONFIG.UNIQUE_ASSIST;
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const KEYS = ['dupOld', 'dupBurst', 'dupBurstFree', 'dupBurstT', 'dupBurstSync', 'dupBurstMatch'];

/** 갈래 → 게임 값 (old · new:몫:박차기) */
export function parseVariant(v) {
  if (typeof v === 'object') return v;
  if (v === 'old') return { key: v, dupOld: 1, share: UA.dupOldShare ?? 0.5, dupBurst: 0 };
  const [, s, b, sy, bt, mt] = String(v).split(':');
  return { key: v, dupOld: 0, share: s != null && s !== '' ? +s : UA.specialShare.duplieren, dupBurst: b != null && b !== '' ? +b : UA.dupBurst, ...(sy != null && sy !== '' ? { dupBurstSync: +sy } : {}), ...(bt && +bt > 0 ? { dupBurstT: CONFIG.realS(+bt) } : {}), ...(mt != null && mt !== '' ? { dupBurstMatch: +mt } : {}) };
}
function apply(v) {
  const save = { ...Object.fromEntries(KEYS.map((k) => [k, UA[k]])), share: UA.specialShare.duplieren };
  const p = parseVariant(v);
  UA.dupOld = p.dupOld;
  UA.dupBurst = p.dupBurst;
  if (p.dupBurstFree != null) UA.dupBurstFree = p.dupBurstFree;
  if (p.dupBurstT != null) UA.dupBurstT = p.dupBurstT;
  if (p.dupBurstMatch != null) UA.dupBurstMatch = p.dupBurstMatch;
  if (p.dupBurstSync != null) UA.dupBurstSync = p.dupBurstSync;
  UA.specialShare.duplieren = p.share;
  return () => {
    for (const k of KEYS) UA[k] = save[k];
    UA.specialShare.duplieren = save.share;
  };
}
/**
 * 낸 겹치기마다 스텝 기록 (duplieren_auto.mjs fight 의 probe — 사람 손가락 봇 press(맞대고 미는 손) 대 치고 막는 AI · 판은 그 도구 그대로):
 *  운동학 칼이 시작한 스텝부터 after 게임 초 — 칼끝 · 손 · 골반 · 가슴(낸 때 몸 틀: x 상대 쪽 · y 위 · z 칼 든 쪽 옆) · 발 · 손목 · 날 · 상대 칼 지나감 · 넘어짐 · 기울기 · 맞음
 */
export function recorder({ after = 1.2 } = {}) {
  const out = [];
  let tr = null;
  let G, P, A;
  const lastRecv = { t: -1, E: 0 };
  let c0 = null;
  let yaw = 0;
  let p7 = null;
  const v = new THREE.Vector3();
  const h = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const loc = (p) => {
    const dx = p.x - c0.x, dz = p.z - c0.z;
    return [r3(dx * Math.cos(yaw) - dz * Math.sin(yaw)), r3(p.y), r3(dx * Math.sin(yaw) + dz * Math.cos(yaw))];
  };
  const probe = {
    out,
    init(g, p, a) {
      G = g;
      P = p;
      A = a;
      const pw = G.combat.hooks.onWound;
      G.combat.hooks.onWound = (att, vic, r, ...rest) => {
        pw?.(att, vic, r, ...rest);
        if (vic === P) (lastRecv.t = G.t), (lastRecv.E = r.energy);
        if (tr && !tr.closed && att === P && vic === A && strokeTechOf(P) === 'duplieren') tr.hits.push({ t: r3(G.t - tr.tF), zone: r.zone, part: rest[1]?.v?.part ?? null, type: r.type, E: r3(r.energy), sev: r3(r.type === 'blunt' ? 0 : r.severity ?? 0) });
      };
      const kd = P.knockDown.bind(P);
      P.knockDown = (heavy = true) => {
        // 넘어짐 까닭 (special_balance.mjs 와 같은 칸): 기울기 · 휘청 게이지 · 발 밖 시간 · 칼에 맞음(이 스텝 받은 에너지)
        if (tr) tr.knock.push({ t: G.t, rel: r3(G.t - tr.tF), heavy, tilt: r3(P.tiltDeg()), balance: r3(P.balance), off: r3(P.offBalanceTime), recvE: r3(lastRecv.t === G.t ? lastRecv.E : 0) });
        return kd(heavy);
      };
    },
    step() {
      const on = P.iai?.kind === 'combo' && P.iai.tech === 'duplieren';
      if (on && (!tr || tr.closed)) {
        tr = { fired: true, tF: G.t - DT, d0: r3(P.foeDistance()), steps: [], hits: [], knock: [], res: null, closed: false, share: UA.specialShare.duplieren };
        const c = P.bodies.chest.translation();
        c0 = { x: c.x, y: c.y, z: c.z };
        yaw = P.heading ?? 0;
        tr.plan = P.iai.segs?.length ? { segs: P.iai.segs.length, T: r3(P.iai.segs.reduce((x, sg) => x + sg.T, 0)), maxT: r3(P.iai.maxT) } : null;
        tr.dup = P.iai.dup ?? null;
        tr.slide = P.iai.slide ? { slide: r3(P.iai.slide.slide), span: r3(P.iai.slide.span), ease: P.iai.slide.ease ?? null } : null;
        tr.burst = P.iai.burst ?? null;
        p7 = null;
        out.push(tr);
      }
      if (!tr || tr.closed) return;
      const t = G.t - tr.tF;
      if (t > after || !P.alive) {
        tr.closed = true;
        return;
      }
      const b7 = P.bladePoint(0.7, new THREE.Vector3());
      let ec = null;
      if (p7 && P.sword) {
        const r = P.sword.rotation();
        q.set(r.x, r.y, r.z, r.w);
        const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
        const ed = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
        const mv = b7.clone().sub(p7);
        mv.addScaledVector(ax, -mv.dot(ax));
        if (mv.length() > 1e-3) ec = mv.dot(ed) / mv.length();
      }
      p7 = b7;
      const pel = P.bodies.pelvis;
      const L = P.gait?.legs;
      const leg = (l) => (l ? { st: l.stance ? 1 : 0, k: l.kind ?? null, p: loc(l.plant) } : null);
      const w = wristSample(P);
      const sm = A.armed && A.sword ? dupSample(P, A, { cross: 0 }) : {};
      const head = A.bodies.head.translation();
      const tip = P.bladePoint(1, v);
      tr.steps.push({
        t: r3(t), kin: on ? 1 : 0, cut: on && P.iai.cutting ? 1 : 0,
        tip: loc(tip), hand: loc(P.bladePoint(0, h)), pel: loc(pel.translation()), ch: loc(P.bodies.chest.translation()),
        F: leg(L?.F), B: leg(L?.B),
        tipHead: r3(Math.hypot(tip.x - head.x, tip.y - head.y, tip.z - head.z)),
        roll: w ? +w.roll.toFixed(1) : null, oor: w ? +outOfRange(w).toFixed(1) : null, edge: ec == null ? null : r3(ec),
        far: sm.far != null && Number.isFinite(sm.far) ? r3(sm.far) : null,
        state: P.state, tilt: r3(P.tiltDeg()), d: r3(P.foeDistance()),
        // 길 위 칼끝 · 손 (운동학 칼이 이 스텝에 놓으려던 자리 — 몸 틀 I.cur: 가슴 원점 · I.yaw) → 세계 → 낸 때 틀 · 손목 교정 각 (재기)
        ...(on && P.iai.cur ? (() => {
          const c = P.bodies.chest.translation();
          const Hw = P.iai.cur.H.clone().applyQuaternion(P.iai.yaw).add(new THREE.Vector3(c.x, c.y, c.z));
          const Dw = P.iai.cur.D.clone().normalize().applyQuaternion(P.iai.yaw);
          return { pTip: loc(Hw.clone().addScaledVector(Dw, P.weaponCfg.hiltLength + P.weaponCfg.bladeLength)), pHand: loc(Hw), fix: +(P.wristFixDeg ?? 0).toFixed(1) };
        })() : {}),
      });
      if (!on && !tr.res && P.instantResult?.combo && P.instantResult.tech === 'duplieren') tr.res = { hits: P.instantResult.hits, zone: P.instantResult.zone, blocked: P.instantResult.blocked, E: r3(P.instantResult.energy), T: r3(P.instantResult.T), burst: P.instantResult.burst ?? null, dup: P.instantResult.dup ?? null };
    },
  };
  return probe;
}

/** 한 판 (press 봇) + 낸 겹치기 기록 */
export function fightTraces(variant, { weapon = 'longsword', opp = 'longsword', seed = 901, dur = 30, bot = 'press', after = 1.2 } = {}) {
  const restore = apply(variant);
  try {
    const rec = recorder({ after });
    const band = [UA.dupBandMin ?? CONFIG.SECRET.mordCloseN ?? 0.8, UA.dupBandMax];
    const r = fight({ bot, weapon, opp, seed, dur, band, probe: rec });
    return { fight: r, traces: rec.out };
  } finally {
    restore();
  }
}

/** 한 번의 잼 (낸 칼 · 발 · 몸) */
export function measure(tr) {
  if (!tr.fired) return { fired: false };
  const S = tr.steps;
  const K = S.filter((s) => s.kin);
  const kinEnd = K.length ? K[K.length - 1].t : null;
  const firstHit = tr.hits[0] ?? null;
  const touched = !!(tr.res?.hits > 0); // 운동학 칼이 상대 몸에 닿음 (상처 갈래와 상관없이 — instantResult)
  // 얼굴에 가장 가까이 간 때 (끄는 동안)
  let near = null;
  for (const s of K) if (s.tipHead != null && (!near || s.tipHead < near.tipHead)) near = s;
  // 앞발: 낸 뒤 처음 뜬 발 → 디딘 때 · 디딘 자리 옮김(앞 몫)
  let foot = null;
  for (const k of ['F', 'B']) {
    let lift = null;
    let plant = null;
    let p0 = null;
    let p1 = null;
    let kind = null;
    for (let i = 0; i < S.length; i++) {
      const l = S[i][k];
      if (!l) continue;
      if (i === 0) p0 = l.p;
      if (lift == null && !l.st) (lift = S[i].t), (kind = l.k);
      if (lift != null && plant == null && l.st) (plant = S[i].t), (p1 = l.p);
    }
    if (lift != null && (!foot || lift < foot.lift)) foot = { leg: k, lift, plant, kind, len: p0 && p1 ? r3(p1[0] - p0[0]) : null };
  }
  // 손 ↔ 골반: 끄는 동안 앞(x) 몫 빠르기 (손 = 칼자루 자리 차분 · 골반 = 차분) — 상관 · 늦음(손 빠르기 봉우리 − 골반 봉우리) · 앞 옮김 몫
  const vx = (arr, key) => arr.map((s, i) => (i ? (s[key][0] - arr[i - 1][key][0]) / Math.max(1e-6, s.t - arr[i - 1].t) : null)).slice(1);
  const W = S.filter((s) => s.t <= (kinEnd ?? 0) + 1e-9);
  const hv = vx(W, 'hand');
  const pvx = vx(W, 'pel');
  const corr = (a, b) => {
    const n = Math.min(a.length, b.length);
    if (n < 3) return null;
    const ma = a.slice(0, n).reduce((x, y) => x + y, 0) / n;
    const mb = b.slice(0, n).reduce((x, y) => x + y, 0) / n;
    let sab = 0, saa = 0, sbb = 0;
    for (let i = 0; i < n; i++) (sab += (a[i] - ma) * (b[i] - mb)), (saa += (a[i] - ma) ** 2), (sbb += (b[i] - mb) ** 2);
    return saa > 1e-12 && sbb > 1e-12 ? r3(sab / Math.sqrt(saa * sbb)) : null;
  };
  const peakT = (arr, sub) => {
    let bi = -1;
    for (let i = 0; i < arr.length; i++) if (bi < 0 || Math.abs(arr[i]) > Math.abs(arr[bi])) bi = i;
    return bi >= 0 ? sub[bi + 1].t : null;
  };
  const tHit = firstHit ? firstHit.t : near ? near.t : null;
  const atHit = W.filter((s) => tHit == null || s.t <= tHit + 1e-9);
  const dx = (arr, key) => (arr.length > 1 ? r3(arr[arr.length - 1][key][0] - arr[0][key][0]) : null);
  // 휨: 끄는 동안 칼끝 — 세계(낸 때 틀) · 몸 틀(가슴 따라 — tsubame_trace 와 같은 잣대)
  const tipW = K.map((s) => [s.t, ...s.tip]);
  const tipR = K.map((s) => [s.t, s.tip[0] - s.ch[0], s.tip[1] - s.ch[1], s.tip[2] - s.ch[2]]);
  const handR = K.map((s) => [s.t, s.hand[0] - s.ch[0], s.hand[1] - s.ch[1], s.hand[2] - s.ch[2]]);
  const k = CONFIG.STRIKE.edgeAlign;
  const E = K.map((s) => s.edge).filter((x) => x != null);
  const one = S.filter((s) => s.t <= 1.0 * CONFIG.TIME.k);
  // 몸 빠르기 (골반 앞 몫 — 낸 때 몸 틀 x · 4 스텝 창) · 칼끝 빠르기 (몸 틀 — 가슴 따라) · 멈칫(둘 다 거의 서 있는 가장 긴 틈 — 끄는 동안)
  const bu = tr.res?.burst ?? tr.burst ?? null;
  const vPel = S.map((s2, i) => (i >= 2 && i + 2 < S.length ? (S[i + 2].pel[0] - S[i - 2].pel[0]) / Math.max(1e-6, S[i + 2].t - S[i - 2].t) : null));
  const at = (t) => S.reduce((b2, s2) => (Math.abs(s2.t - t) < Math.abs(b2.t - t) ? s2 : b2), S[0]);
  const ix = (t) => S.indexOf(at(t));
  const pelD = (t) => (S.length ? at(t).pel[0] - S[0].pel[0] : null);
  const Tb = bu?.T ?? null;
  const curve = [];
  for (let b2 = 0; b2 <= 15; b2++) curve.push(S.length ? r3(vPel[ix(b2 / 30)]) : null);
  const vTip = K.map((s2, i) => (i ? Math.hypot(tipR[i][1] - tipR[i - 1][1], tipR[i][2] - tipR[i - 1][2], tipR[i][3] - tipR[i - 1][3]) / Math.max(1e-6, tipR[i][0] - tipR[i - 1][0]) : null));
  let still = 0;
  let run = 0;
  const tW = bu?.launchT != null ? bu.launchT + 0.02 : Infinity; // 멈칫은 칼이 출발할 때까지 (디딤 ↔ 칼 출발 사이)
  K.forEach((s2, i) => {
    if (s2.t > tW) return;
    const vp = vPel[S.indexOf(s2)];
    const ok = i > 0 && vp != null && Math.abs(vp) < 0.3 && vTip[i] != null && vTip[i] < 1.0;
    run = ok ? run + (s2.t - K[i - 1].t) : 0;
    still = Math.max(still, run);
  });
  return {
    fired: true,
    d0: tr.d0,
    dEnd: S.length ? S[S.length - 1].d : null,
    slide: tr.res?.burst?.slide ?? 0,
    kinEnd: r3(kinEnd),
    hit: firstHit ? 1 : 0,
    touched: touched ? 1 : 0,
    resZone: tr.res?.zone ?? null,
    resE: tr.res?.E ?? null,
    hitT: firstHit ? firstHit.t : null,
    nearT: near?.t ?? null,
    nearD: near?.tipHead ?? null,
    zone: firstHit?.zone ?? null,
    E: firstHit?.E ?? null,
    sev: firstHit?.sev ?? null,
    blocked: tr.res?.blocked ? 1 : 0,
    foot,
    syncPlantMinusHit: foot?.plant != null && tHit != null ? r3(foot.plant - tHit) : null,
    syncPlantMinusKinEnd: foot?.plant != null && kinEnd != null ? r3(foot.plant - kinEnd) : null,
    vCorr: corr(hv, pvx),
    peakHand: peakT(hv, W),
    peakPel: peakT(pvx, W),
    pelDx: dx(atHit, 'pel'),
    handDx: dx(atHit, 'hand'),
    tipDx: dx(atHit, 'tip'),
    bendW: bendOf(tipW),
    bendR: bendOf(tipR),
    bendR2: bendOf(tipR.slice(2)), // 첫 두 스텝(놓인 칼 → 길 첫 자리 이음) 뺀 길
    bendHand: bendOf(handR),
    sweep: tr.dup?.sweep ?? null,
    oorStep: K.length ? r3(K.filter((s) => s.oor > OOR_EPS).length / K.length) : null,
    roll78: K.length ? r3(K.filter((s) => s.roll >= ROLL_AT).length / K.length) : null,
    rollMax: K.length ? Math.max(...K.map((s) => s.roll ?? 0)) : null,
    edgeLead: E.length ? r3(E.filter((x) => x > k).length / E.length) : null,
    backLead: E.length ? r3(E.filter((x) => x < -k).length / E.length) : null,
    farTouch: K.filter((s) => s.far != null && s.far < 0.01).length,
    fall: one.some((s) => s.state !== 'stand') ? 1 : 0,
    knock: tr.knock.filter((x) => x.t >= tr.tF && x.t <= tr.tF + 1.0 * CONFIG.TIME.k).length,
    zoneAll: tr.hits.map((x) => x.zone),
    tiltMax: one.length ? Math.max(...one.map((s) => s.tilt ?? 0)) : null,
    v0: bu?.v0 ?? null, match: bu?.match ?? null, Tb, Tf: bu?.Tf ?? null, plantT: bu?.plantT ?? null, launchT: bu?.launchT ?? null,
    pelPeak: r3(Math.max(...vPel.filter((x, i) => x != null && S[i].t <= 0.6))), pelMean: Tb ? r3(pelD(Tb) / Tb) : null, pel22: r3(pelD(0.22)), pel30: r3(pelD(0.3)), pelAtTb: Tb ? r3(pelD(Tb)) : null, pelCurve: curve,
    still: r3(still), tipPeak: r3(Math.max(0, ...vTip.filter((x) => x != null))),
    travel: tr.dup?.t0 ?? null, faceAfterLaunch: near && bu?.launchT != null ? r3(near.t - bu.launchT) : null, stopToLaunch: Tb != null && bu?.launchT != null ? r3(bu.launchT - Tb) : null,
  };
}

const p50 = (a) => { const s = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); return s.length ? r3(s[Math.floor((s.length - 1) / 2)]) : null; };
const mx = (a) => { const s = a.filter((x) => x != null && Number.isFinite(x)); return s.length ? r3(Math.max(...s)) : null; };
const mn = (a) => { const s = a.filter((x) => x != null && Number.isFinite(x)); return s.length ? r3(Math.min(...s)) : null; };
/** 갈래 묶음 */
export function summary(ms) {
  const F = ms.filter((m) => m.fired);
  const H = F.filter((m) => m.hit);
  const zones = {};
  for (const m of H) zones[m.zone] = (zones[m.zone] ?? 0) + 1;
  return {
    runs: ms.length, fired: F.length, hit: H.length, touched: F.filter((m) => m.touched).length, blocked: F.filter((m) => m.blocked).length, zones,
    resZones: F.filter((m) => m.touched).reduce((o, m) => ((o[m.resZone] = (o[m.resZone] ?? 0) + 1), o), {}), resE: p50(F.filter((m) => m.touched).map((m) => m.resE)),
    E: p50(H.map((m) => m.E)), sev: p50(H.map((m) => m.sev)),
    d0: p50(F.map((m) => m.d0)), dEnd: p50(F.map((m) => m.dEnd)), dEndMax: mx(F.map((m) => m.dEnd)), slide: p50(F.map((m) => m.slide)),
    kinEnd: p50(F.map((m) => m.kinEnd)), hitT: p50(H.map((m) => m.hitT)), nearT: p50(F.map((m) => m.nearT)),
    footLift: p50(F.map((m) => m.foot?.lift)), footPlant: p50(F.map((m) => m.foot?.plant)), footLen: p50(F.map((m) => m.foot?.len)), footKind: [...new Set(F.map((m) => m.foot?.kind))].join('/'),
    plantMinusHit: p50(F.map((m) => m.syncPlantMinusHit)), plantMinusHitMin: mn(F.map((m) => m.syncPlantMinusHit)), plantMinusHitMax: mx(F.map((m) => m.syncPlantMinusHit)),
    plantMinusKinEnd: p50(F.map((m) => m.syncPlantMinusKinEnd)),
    vCorr: p50(F.map((m) => m.vCorr)), peakHand: p50(F.map((m) => m.peakHand)), peakPel: p50(F.map((m) => m.peakPel)),
    pelDx: p50(F.map((m) => m.pelDx)), handDx: p50(F.map((m) => m.handDx)), tipDx: p50(F.map((m) => m.tipDx)),
    devW: p50(F.map((m) => m.bendW?.devShare)), kinkW: p50(F.map((m) => m.bendW?.kinkDeg)), kinkWMax: mx(F.map((m) => m.bendW?.kinkDeg)),
    devR: p50(F.map((m) => m.bendR?.devShare)), devRMax: mx(F.map((m) => m.bendR?.devShare)), kinkR: p50(F.map((m) => m.bendR?.kinkDeg)), kinkRMax: mx(F.map((m) => m.bendR?.kinkDeg)),
    devR2: p50(F.map((m) => m.bendR2?.devShare)), kinkR2: p50(F.map((m) => m.bendR2?.kinkDeg)), kinkR2Max: mx(F.map((m) => m.bendR2?.kinkDeg)),
    kink30: F.filter((m) => m.bendR?.kinkDeg > 30).length,
    pathLenR: p50(F.map((m) => m.bendR?.pathLen)), chordR: p50(F.map((m) => m.bendR?.chord)),
    handDevR: p50(F.map((m) => m.bendHand?.devShare)), handKinkR: p50(F.map((m) => m.bendHand?.kinkDeg)),
    sweep: p50(F.map((m) => m.sweep)), sweepMax: mx(F.map((m) => m.sweep)),
    oorStep: p50(F.map((m) => m.oorStep)), roll78: p50(F.map((m) => m.roll78)), rollMax: mx(F.map((m) => m.rollMax)),
    edgeLead: p50(F.map((m) => m.edgeLead)), backLead: p50(F.map((m) => m.backLead)), farTouch: F.reduce((a, m) => a + m.farTouch, 0),
    falls: F.reduce((a, m) => a + m.fall, 0), knock: F.reduce((a, m) => a + m.knock, 0), tiltMax: mx(F.map((m) => m.tiltMax)),
    v0: p50(F.map((m) => m.v0)), v0Max: mx(F.map((m) => m.v0)), Tb: p50(F.map((m) => m.Tb)), plantT: p50(F.map((m) => m.plantT)), launchT: p50(F.map((m) => m.launchT)),
    launchMinusPlant: p50(F.map((m) => (m.launchT != null && m.foot?.plant != null ? m.launchT - m.foot.plant : null))),
    pelPeak: p50(F.map((m) => m.pelPeak)), pelPeakMax: mx(F.map((m) => m.pelPeak)), pelMean: p50(F.map((m) => m.pelMean)), pel22: p50(F.map((m) => m.pel22)), pel30: p50(F.map((m) => m.pel30)), pelAtTb: p50(F.map((m) => m.pelAtTb)),
    pelCurve: Array.from({ length: 16 }, (_, b) => p50(F.map((m) => m.pelCurve?.[b]))),
    still: p50(F.map((m) => m.still)), stillMax: mx(F.map((m) => m.still)), still50: F.filter((m) => m.still >= 0.05).length,
    travel: p50(F.map((m) => m.travel)), faceAfterLaunch: p50(F.map((m) => m.faceAfterLaunch)), stopToLaunch: p50(F.map((m) => m.stopToLaunch)), stopToLaunchMax: mx(F.map((m) => m.stopToLaunch)),
  };
}

if (isMain(import.meta.url)) {
  const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  const names = arg('variants', 'old,new:0.1:0.45').split(',');
  const weapons = arg('weapons', 'longsword,sabre,kriegsmesser').split(',');
  const opps = arg('opps', 'longsword,uchigatana,zweihander,rapier').split(',');
  const seeds = arg('seeds', '901,902,903,904').split(',').map(Number);
  const dur = +arg('dur', 30);
  const out = { sum: {}, fights: {}, traces: {} };
  for (const vn of names) {
    const ms = [];
    const fights = [];
    const traces = [];
    for (const weapon of weapons) for (const opp of opps) for (const seed of seeds) {
      const { fight: r, traces: T } = fightTraces(vn, { weapon, opp, seed, dur });
      fights.push(r);
      for (const tr of T) {
        const m = measure(tr);
        ms.push(m);
        traces.push({ weapon, opp, seed, ...tr, m });
        if (process.argv.includes('--v')) console.error(vn, weapon, opp, seed, JSON.stringify({ d0: m.d0, dEnd: m.dEnd, slide: m.slide, kinEnd: m.kinEnd, hit: m.hit ? `${m.zone}@${m.hitT} E${m.E} s${m.sev}` : '-', foot: m.foot, plantMinusHit: m.syncPlantMinusHit, devR: m.bendR?.devShare, kinkR: m.bendR?.kinkDeg, vCorr: m.vCorr, far: m.farTouch, fall: m.fall, edge: m.edgeLead }));
      }
    }
    out.sum[vn] = { trace: summary(ms), closed: closedTable(fights) };
    out.fights[vn] = fights.map(({ log, recv, ...r }) => r);
    out.traces[vn] = traces;
    console.log('SUM', vn, JSON.stringify(out.sum[vn]));
  }
  if (arg('json')) writeFileSync(arg('json'), JSON.stringify(out));
}

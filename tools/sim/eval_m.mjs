// AI 평가: node eval.mjs <scenario> <ai:old|new> <difficulty> <seedFrom> <seedTo> [dur]
//  scenario: passive | aggro | aiai
import { newRound, DT, THREE } from './harness_m.mjs';
import { AI as OldAI } from './ai_old.mjs';
import { AI as NewAI } from '../../src/ai.js';

const [scen = 'passive', which = 'new', diff = 'normal', s0 = '1', s1 = '4', durS = '60'] = process.argv.slice(2);
const AIC = which === 'old' ? OldAI : NewAI;
const DUR = +durS;
// 실험용: 난이도 값 덮어쓰기 (예: HARDX='{"counter":0}')
import * as CFG from '../../src/config.js';
if (process.env.HARDX) Object.assign(CFG.AI_LEVELS.hard, JSON.parse(process.env.HARDX));
if (process.env.STOPEARLY) globalThis.__stopEarly = +process.env.STOPEARLY;
if (process.env.FOLLOW) globalThis.__follow = +process.env.FOLLOW;
if (process.env.STOPCUT) globalThis.__stopCut = +process.env.STOPCUT;
const GUARDS = { langort: [0, 0.03], pflug: [0.18, -0.28], ochs: [0.22, 0.26], tag: [0.02, 0.52], alber: [0, -0.5], ready: [0.12, -0.18] };
const GNAMES = Object.keys(GUARDS);

const slow = (off, q, sp) => { const dx = q[0] - off.x, dy = q[1] - off.y, dd = Math.hypot(dx, dy), s = sp * DT; if (dd > s) { off.x += (dx / dd) * s; off.y += (dy / dd) * s; } else off.set(q[0], q[1]); };
const isAtk = (ai) => (ai.attacking !== undefined ? ai.attacking : ai.phase === 'windup' || ai.phase === 'strike');
const flat = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);

// 막무가내로 달려들어 휘두르는 플레이어 (초보 사용자 흉내)
function aggroCtl(G, rnd) {
  const p = G.player;
  const e = G.enemy;
  const CUTS = [
    [[0.42, 0.42], [-0.4, -0.42]],
    [[0.02, 0.52], [0.0, -0.45]],
    [[0.38, -0.44], [-0.3, 0.26]],
    [[-0.4, 0.42], [0.38, -0.44]],
  ];
  const st = { phase: 'wait', t: rnd() * 0.8, cut: CUTS[Math.floor(rnd() * CUTS.length)], swings: 0, sp: 8 + rnd() * 4 };
  return () => {
    if (!p.alive || p.state !== 'stand') { p.move.set(0, 0); return; }
    const d = flat(p.bodies.chest.translation(), e.bodies.chest.translation());
    st.t -= DT;
    const off = p.handOffset;
    let tgt, sp;
    if (st.phase === 'wait') {
      tgt = st.cut[0]; sp = 2;
      p.move.set(0, 0);
      if (st.t <= 0) st.phase = 'rush';
    } else if (st.phase === 'rush') {
      tgt = st.cut[0]; sp = 3;
      p.move.set(0, d > 1.6 ? 1 : 0.4);
      if (d < 2.3 && Math.hypot(off.x - tgt[0], off.y - tgt[1]) < 0.05) { st.phase = 'swing'; st.t = 0.3; }
    } else if (st.phase === 'swing') {
      tgt = st.cut[1]; sp = st.sp;
      p.move.set(0, 0.7);
      if (st.t <= 0) { st.phase = 'pause'; st.t = 0.15 + rnd() * 0.3; st.swings++; }
    } else if (st.phase === 'pause') {
      tgt = st.cut[1]; sp = 2;
      p.move.set(0, d > 1.4 ? 0.6 : 0);
      if (st.t <= 0) { st.cut = CUTS[Math.floor(rnd() * CUTS.length)]; st.phase = 'rush'; }
    }
    const dx = tgt[0] - off.x, dy = tgt[1] - off.y, dd = Math.hypot(dx, dy), stp = sp * DT;
    if (dd > stp) { off.x += (dx / dd) * stp; off.y += (dy / dd) * stp; } else off.set(tgt[0], tgt[1]);
  };
}

function runOne(seed) {
  const opts = { seed, AIClass: AIC, difficulty: diff };
  if (process.env.SAME) opts.sameLook = true;
  if (scen === 'aiai') { opts.AI2Class = process.env.AI2 === 'old' ? OldAI : AIC; if (process.env.D2) opts.difficulty2 = process.env.D2; }
  const G = newRound(opts);
  // 결정적 보조 난수 (시나리오용, AI의 Math.random과 따로)
  let a = (seed * 7919 + 17) >>> 0;
  const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  let ctl = null;
  let gname = null;
  if (scen === 'passive') {
    gname = GNAMES[seed % GNAMES.length];
    G.player.skill.level = 0.7;
    ctl = () => { G.player.move.set(0, 0); slow(G.player.handOffset, GUARDS[gname], 1.0); };
  } else if (scen === 'aggro') ctl = aggroCtl(G, rnd);
  if (ctl) G.before = ctl;
  const P = G.player, E = G.enemy, ai = G.ai;
  const m = { seed, guard: gname, tCond: 0, tZombie: 0, tStand: 0, tMid: 0, tClinch: 0, tFar: 0, attacks: 0, atkHits: 0, kd: { P: 0, E: 0 }, end: null, tEnd: null, eHitsOnP: 0, pHitsOnE: 0 };
  let prevAtk = false;
  let atkStart = -1;
  let atkHit = false;
  const prevState = { P: P.state, E: E.state };
  m.woundBy = {};
  G.onWound = (att, vic, r) => {
    if (att === P && (r.severity > 0 || r.energy >= 25)) { const k = `${ai.mode || ai.phase}/${ai.phase}${ai.why ? ':' + ai.why : ''}`; m.woundBy[k] = +((m.woundBy[k] || 0) + r.energy).toFixed(0); }
    if (process.env.TRACE) console.log(G.t.toFixed(2), 'WOUND', att.name, '->', vic.name, r.zone, r.type, r.energy.toFixed(0), 'sev', r.severity.toFixed(2));
    if (att === E && (r.severity > 0 || r.energy >= 25) && atkStart >= 0 && G.t - atkStart < 1.2) atkHit = true;
  };
  const steps = Math.round(DUR / DT);
  for (let i = 0; i < steps; i++) {
    G.step();
    const t = G.t;
    // 넘어짐 셈
    for (const [k, f] of [['P', P], ['E', E]]) {
      if (prevState[k] === 'stand' && (f.state === 'down' || f.state === 'getup')) m.kd[k]++;
      prevState[k] = f.state;
    }
    if (!P.alive || !E.alive) {
      m.end = !P.alive && !E.alive ? 'both' : !P.alive ? 'E_wins' : 'P_wins';
      m.tEnd = +t.toFixed(1);
      break;
    }
    const atk = isAtk(ai);
    if (process.env.TRACE && ((process.env.TRACE !== '2' && i % 6 === 0) || (ai.mode !== G._pm || ai.phase !== G._pp))) {
      G._pm = ai.mode; G._pp = ai.phase;
      const dd = flat(E.bodies.chest.translation(), P.bodies.chest.translation());
      console.log(t.toFixed(2), (ai.mode || '') + '/' + ai.phase, 'd', dd.toFixed(2), 'hold', ai.holdDist ? ai.holdDist().toFixed(2) : '', 'mv', E.move.x.toFixed(2), E.move.y.toFixed(2), 'hand', E.handOffset.x.toFixed(2), E.handOffset.y.toFixed(2), 'pat', (ai.patience ?? 0).toFixed(2), ai.tech ? ai.tech.name : '', ai.why || '', 'Pmv', P.move.y.toFixed(2), 'Ph', P.handOffset.x.toFixed(2), P.handOffset.y.toFixed(2), 'st', E.state, P.state);
    }
    if (atk && !prevAtk) {
      m.attacks++;
      if (atkStart >= 0 && atkHit) m.atkHits++;
      atkStart = t;
      atkHit = false;
    }
    prevAtk = atk;
    // 골반 속도는 걸음마다 출렁이므로 0.15초로 부드럽게 한 몸 속도로 잰다 (두 AI 모두 같은 방식)
    { const v = E.bodies.pelvis.linvel(); const k = DT / 0.15; G._vx = (G._vx ?? 0) + (v.x - (G._vx ?? 0)) * k; G._vz = (G._vz ?? 0) + (v.z - (G._vz ?? 0)) * k; }
    if (E.state !== 'stand') continue;
    m.tStand += DT;
    const a0 = E.bodies.chest.translation(), b0 = P.bodies.chest.translation();
    const d = flat(a0, b0);
    if (d >= 2.0 && d <= 2.8) m.tMid += DT;
    if (d < 1.3) m.tClinch += DT;
    if (d > 2.8) m.tFar += DT;
    if (d < 2.6 && !atk) {
      m.tCond += DT;
      const v = { x: G._vx, z: G._vz };
      const ux = (b0.x - a0.x) / d, uz = (b0.z - a0.z) / d;
      if (v.x * ux + v.z * uz > 0.25) {
        m.tZombie += DT;
        if (E.move.y > 0.05) m.tZombieCmd = (m.tZombieCmd || 0) + DT; // 스스로 다가가려 한 시간 (관성·밀림 제외)
        const k = `${ai.mode || ai.phase}/${ai.phase}/${E.move.y > 0.05 ? 'cmdFwd' : E.move.y < -0.05 ? 'cmdBack' : 'cmd0'}${d < 1.5 ? '/close' : ''}`;
        m.zb = m.zb || {};
        m.zb[k] = +((m.zb[k] || 0) + DT).toFixed(2);
      }
    }
  }
  if (atkStart >= 0 && atkHit) m.atkHits++;
  // 공격 적중: 공격 시작 뒤 1초 안에 상대에게 입힌 유효 타격 (벤 상처 또는 25J 이상 둔타)
  const eff = (w) => w.severity > 0 || w.energy >= 25;
  m.eHitsOnP = G.wounds.filter((w) => w.att === E && eff(w)).length;
  m.pHitsOnE = G.wounds.filter((w) => w.att === P && eff(w)).length;
  // 공격 적중률 다시 셈: 공격 시작 시각 목록이 필요 → ai.log 가 있으면 쓴다
  m.dur = +(m.tEnd ?? DUR).toFixed(1);
  m.zombie = +(m.tZombie / Math.max(1e-6, m.tCond)).toFixed(3);
  m.mid = +(m.tMid / Math.max(1e-6, m.tStand)).toFixed(3);
  m.clinch = +(m.tClinch / Math.max(1e-6, m.tStand)).toFixed(3);
  m.far = +(m.tFar / Math.max(1e-6, m.tStand)).toFixed(3);
  m.apm = +((m.attacks / m.dur) * 60).toFixed(1);
  m.clashes = G.clashes;
  m.Pblood = +P.blood.toFixed(2);
  m.Eblood = +E.blood.toFixed(2);
  m.causeP = P.causeOfDeath;
  m.causeE = E.causeOfDeath;
  m.aiStats = ai.stats ? JSON.stringify(ai.stats) : undefined;
  m.tZombieCmd = m.tZombieCmd || 0;
  for (const k of ['tCond', 'tZombie', 'tZombieCmd', 'tStand', 'tMid', 'tClinch', 'tFar']) m[k] = +m[k].toFixed(2);
  return m;
}

// 공격-적중 짝짓기를 위해 wounds 시각을 쓴다: AI 공격 시작 뒤 0~1.0초 안의 유효 타격
const out = [];
for (let s = +s0; s <= +s1; s++) {
  const r = runOne(s);
  out.push(r);
  console.log(JSON.stringify(r));
}

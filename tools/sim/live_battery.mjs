// heft_design/live_battery.mjs — acceptance battery that runs the LIVE project code (../../src) with NO replicas.
// Use after implementing the heavy-sword plan:   node live_battery.mjs cuts,steps,kata,walk,jitter,hits,fights,jam
// Optional instrumentation read if the implementation exposes it: fighter.debug = { aim: Vector3 (world commanded blade dir), wristTorque: Vector3, wristCap: number }
import { newRound, THREE, DT, AI, CONFIG } from './jelly_harness.mjs';
import { guardAt } from '../../src/guards.js';

const V = (v) => new THREE.Vector3(v.x, v.y, v.z);
const Q = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / Math.max(1, a.length));
const pct = (a, p) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(p * b.length))] : NaN; };
const r1 = (x) => (x == null || Number.isNaN(x) ? x : +x.toFixed(1));
const r2 = (x) => (x == null || Number.isNaN(x) ? x : +x.toFixed(2));
const ang = (a, b) => Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)) * 57.2958;
const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
const bladeDir = (f) => new THREE.Vector3(0, 1, 0).applyQuaternion(Q(f.sword.rotation()));
const wristPos = (f) => new THREE.Vector3(0.13, 0, 0).applyQuaternion(Q(f.bodies.farmS.rotation())).add(V(f.bodies.farmS.translation()));
function guardDir(x, y) {
  const el = y <= 0.1 ? Math.max(-0.6, (y - 0.1) * 1.1) : Math.min(1.75, ((y - 0.1) / 0.5) * 1.65);
  const az = THREE.MathUtils.clamp((x - 0.05) * 1.7, -1.1, 1.3);
  const c = Math.cos(el); return [c * Math.cos(az), Math.sin(el), c * Math.sin(az)];
}
/** commanded blade direction (world) exactly as driveSword builds it from the filtered aim; prefers fighter.debug.aim */
function aimOf(f, x = f.skill.aim.x, y = f.skill.aim.y) {
  if (f.debug?.aim && x === f.skill.aim.x && y === f.skill.aim.y) return f.debug.aim.clone();
  const gw = f.guardWeight(); const G = guardAt(x, y, f.guardPose || {});
  const a = new THREE.Vector3(...guardDir(x, y));
  if (gw > 0) { a.lerp(new THREE.Vector3(...G.dir), gw); if (a.lengthSq() < 0.04) a.set(...G.dir); a.normalize(); }
  return a.applyQuaternion(f.yaw);
}
function wristIK(f) {
  const cq = Q(f.bodies.chest.rotation()); const c = V(f.bodies.chest.translation());
  const T = f.handTarget.clone().sub(c).applyQuaternion(cq.clone().invert());
  const S = new THREE.Vector3(0, 0.1, f.side * 0.2); const D = T.sub(S);
  const d = THREE.MathUtils.clamp(D.length(), 0.08, 0.565);
  return S.add(D.normalize().multiplyScalar(d)).applyQuaternion(cq).add(c);
}
function mk({ park = true, gap } = {}) {
  const G = newRound({ walls: false, gap });
  if (park) G.park();
  G.ai.update = () => {};
  G.player.skill.level = 0.7;
  return G;
}
function settleAt(G, f, xy, secs = 1.5) {
  f.handOffset.set(xy[0], xy[1]); f.skill.prev.set(xy[0], xy[1]); f.skill.aim.set(xy[0], xy[1]); f.skill.aimRaw.set(xy[0], xy[1]);
  f.skill.aimVel.set(0, 0); f.skill.vel.set(0, 0); f.skill.follow.set(0, 0);
  for (let i = 0; i < secs / DT; i++) G.step();
}
export const CUTS = { oberhau: [[0.02, 0.52], [0.0, -0.45]], zornhau: [[0.42, 0.42], [-0.4, -0.42]], zwerch: [[0.52, 0.06], [-0.5, 0.06]], unterhau: [[0.38, -0.44], [-0.3, 0.26]] };

// ───────── one cut: tip, phase of peak, impact-zone speed, onset, 10–90 %, overshoot past final guard, settle ─────────
export function cut(name, sp = 13) {
  const [a, b] = CUTS[name];
  const G = mk(); const f = G.player;
  settleAt(G, f, a, 1.5);
  const rows = []; let tArr = null; const yawInv = f.yaw.clone().invert();
  let prevW = null;
  for (let i = 0; i < (0.6 + 1.4) / DT; i++) {
    const off = f.handOffset; const dx = b[0] - off.x, dy = b[1] - off.y, d = Math.hypot(dx, dy), st = sp * DT;
    if (tArr == null) { if (d > st) { off.x += (dx / d) * st; off.y += (dy / d) * st; } else { off.set(b[0], b[1]); tArr = (i + 1) * DT; } }
    G.step();
    const bd = bladeDir(f); const w = V(f.sword.angvel()); w.addScaledVector(bd, -w.dot(bd));
    const fa = (() => { const x = f.handOffset.x, y = f.handOffset.y; const gw = f.guardWeight(); const Gd = guardAt(x, y, {}); const a0 = new THREE.Vector3(...guardDir(x, y)); if (gw > 0) { a0.lerp(new THREE.Vector3(...Gd.dir), gw); if (a0.lengthSq() < 0.04) a0.set(...Gd.dir); a0.normalize(); } return a0.applyQuaternion(f.yaw); })();
    rows.push({ t: (i + 1) * DT, blade: bd, w, tip: f.tipVel.length(), mid: f.hitPointVel.length(), hand: wristPos(f), fa, wt: f.debug?.wristTorque?.clone(), cap: f.debug?.wristCap });
    prevW = w;
  }
  // swing axis & signed blade angle about it
  const n = new THREE.Vector3(); for (const r of rows) if (r.t <= tArr + 0.35) n.addScaledVector(r.w, DT); n.normalize();
  let B = 0; const th = [0];
  for (let i = 1; i < rows.length; i++) { const c = new THREE.Vector3().crossVectors(rows[i - 1].blade, rows[i].blade); B += Math.atan2(c.length(), rows[i - 1].blade.dot(rows[i].blade)) * Math.sign(c.dot(n) || 1); th.push(B); }
  const Bfin = mean(th.slice(-30)); const final = rows[rows.length - 1].blade;
  let F = 0; const thF = [0]; for (let i = 1; i < rows.length; i++) { const c = new THREE.Vector3().crossVectors(rows[i - 1].fa, rows[i].fa); F += Math.atan2(c.length(), rows[i - 1].fa.dot(rows[i].fa)) * Math.sign(c.dot(n) || 1); thF.push(F); }
  const Ffin = F;
  let peak = -1e9; for (let i = 0; i < rows.length; i++) if (rows[i].t < tArr + 0.8) peak = Math.max(peak, th[i]);
  let iPk = 0; for (let i = 0; i < rows.length; i++) if (rows[i].w.length() > rows[iPk].w.length()) iPk = i;
  const tAt = (fr) => { const k = th.findIndex((x) => x >= fr * Ffin); return k >= 0 ? rows[k].t : null; }; // fractions of the FINGER-target rotation (same as heft_diag analyseCut)
  let tSet = tArr; for (const r of rows) if (r.t >= tArr && ang(r.blade, final) > 6) tSet = r.t;
  const on = rows.find((r) => ang(r.blade, rows[0].blade) > 5);
  let vz = null, prev = null; for (const r of rows) { const bl = r.blade.clone().applyQuaternion(yawInv); const val = name === 'oberhau' ? bl.y : bl.z; if (prev != null && Math.sign(val) !== Math.sign(prev) && bl.x > 0.3 && vz == null) vz = r.mid; prev = val; }
  let a33 = 0; for (let i = 4; i < rows.length; i++) a33 = Math.max(a33, rows[i].w.clone().sub(rows[i - 4].w).length() / (4 * DT));
  let ha = 0; const hp = rows.map((r) => r.hand); for (let i = 12; i < hp.length; i++) { const v1 = hp[i].clone().sub(hp[i - 6]).divideScalar(6 * DT); const v0 = hp[i - 6].clone().sub(hp[i - 12]).divideScalar(6 * DT); ha = Math.max(ha, v1.sub(v0).length() / (6 * DT)); }
  const out = { tip: r1(Math.max(...rows.map((r) => r.tip))), phasePk: r2(th[iPk] / Bfin), vZone: r1(vz), onset_ms: on ? Math.round(on.t * 1000) : null,
    b10_90: tAt(0.1) != null && tAt(0.9) != null ? Math.round((tAt(0.9) - tAt(0.1)) * 1000) : null, over: r1((peak - Bfin) * 57.3), settle_ms: Math.round((tSet - tArr) * 1000), a33: Math.round(a33), handA50: Math.round(ha) };
  if (rows[0].wt) { // wrist instrumentation available
    const sw = rows.filter((r) => r.t >= (tAt(0.1) ?? 0) && r.t <= (tAt(0.9) ?? 0));
    out.satW = r2(sw.filter((r) => r.wt.length() >= 0.999 * r.cap).length / Math.max(1, sw.length));
    let acc = 0, brk = 0; for (let i = 0; i < rows.length; i++) { const x = rows[i].wt.dot(n) * DT; if (i <= iPk) acc += x; else if (rows[i].t <= tArr + 0.8) brk += Math.min(0, x); }
    out.impDrive = r2(acc); out.impBrake = r2(brk);
  }
  return out;
}
export function cuts(sp = 13) {
  const per = Object.fromEntries(Object.keys(CUTS).map((k) => [k, cut(k, sp)]));
  const main = ['oberhau', 'zornhau', 'zwerch'];
  const av = (k) => r1(mean(main.map((m) => per[m][k])));
  return { avg3: { tip: av('tip'), tipMin: Math.min(...main.map((m) => per[m].tip)), tipMax: Math.max(...main.map((m) => per[m].tip)), phasePk: r2(mean(main.map((m) => per[m].phasePk))), vZone: av('vZone'), onset: av('onset_ms'), b10_90: av('b10_90'), over: av('over'), settle: av('settle_ms'), a33: av('a33'), handA50: av('handA50'), satW: per.oberhau.satW != null ? av('satW') : undefined, impDrive: per.oberhau.impDrive != null ? av('impDrive') : undefined, impBrake: per.oberhau.impBrake != null ? av('impBrake') : undefined }, per };
}

// ───────── anti-wobble: hand steps at skill 0 ─────────
export function steps() {
  const tests = [[[0.15, -0.1], [0.1, 0.5]], [[0.1, 0.5], [0.0, -0.25]], [[0.55, 0.1], [-0.45, 0.05]], [[0.15, -0.1], [0.15, 0.2]]];
  const o = { over: [], settle: [], bs: [], cp: [] };
  for (const [a, b] of tests) {
    seedRand(3); const G = mk(); const P = G.player; P.skill.level = 0;
    settleAt(G, P, a, 3.0);
    const w0 = wristPos(P); const cq0 = Q(P.bodies.chest.rotation()); const wr = [], be = [], cp = [];
    P.handOffset.set(b[0], b[1]);
    for (let i = 0; i < 2.0 / DT; i++) {
      G.step(); wr.push(wristPos(P)); be.push(ang(bladeDir(P), aimOf(P)));
      cp.push(new THREE.Euler().setFromQuaternion(cq0.clone().invert().multiply(Q(P.bodies.chest.rotation())), 'YXZ').z * 57.3);
    }
    const fin = wr[wr.length - 1]; const u = fin.clone().sub(w0); const L = u.length(); u.normalize();
    o.over.push((Math.max(...wr.map((p) => p.clone().sub(w0).dot(u) / L)) - 1) * 100);
    const band = Math.max(0.02, 0.05 * L); let tS = 0; wr.forEach((p, i) => { if (p.distanceTo(fin) > band) tS = (i + 1) * DT; }); o.settle.push(tS);
    let bs = 0; be.forEach((x, i) => { if (x > 5) bs = (i + 1) * DT; }); o.bs.push(bs);
    o.cp.push(Math.max(...cp) - Math.min(...cp));
  }
  return { wristOver_pct: r1(mean(o.over)), wristSettle_s: r2(mean(o.settle)), bladeSettle_s: r2(mean(o.bs)), bladeSettleMax_s: r2(Math.max(...o.bs)), chestPitch_deg: r1(mean(o.cp)) };
}

// ───────── anti-wobble: kata (AI-style attacks, skill 0.7) ─────────
const ATTACKS = [[[0.1, 0.6], [0.0, -0.25]], [[0.5, 0.45], [-0.35, -0.2]], [[-0.35, 0.45], [0.45, -0.15]], [[0.6, 0.1], [-0.5, 0.05]], [[0.45, -0.25], [0.0, 0.05]]];
const READY = [0.15, -0.1];
export function kata(strikeSpeed = 13) {
  const G = mk(); const P = G.player;
  settleAt(G, P, READY, 2.0);
  const plan = []; for (let rep = 0; rep < 2; rep++) for (const [w, s] of ATTACKS) plan.push([READY, 2.2, 0.8, rep ? 0.3 : 0], [w, 2.2, 0.6, 0], [s, strikeSpeed, 0.45, 0.6], [READY, 2.2, 0.6, -0.4]);
  const r = { cw: [], we: [], be: [], tv: [], still: [], ring: [] };
  for (const [tgt, sp, dur, mv] of plan) for (let i = 0; i < Math.round(dur / DT); i++) {
    const off = P.handOffset; const dx = tgt[0] - off.x, dy = tgt[1] - off.y, d = Math.hypot(dx, dy), st = sp * DT;
    if (d > st) { off.x += dx / d * st; off.y += dy / d * st; } else off.set(tgt[0], tgt[1]);
    P.move.set(0, mv); G.step();
    const c = P.bodies.chest.angvel(); const cw = Math.hypot(c.x, c.y, c.z); r.cw.push(cw);
    r.we.push(wristPos(P).distanceTo(wristIK(P))); r.be.push(ang(bladeDir(P), aimOf(P))); r.tv.push(P.tipVel.length());
    if (sp < 5 && tgt === READY && i * DT > 0.35 && mv === 0) r.still.push(cw);
    if (d <= st && i * DT > 0.25 && sp < 5) r.ring.push(P.hitPointVel.length());
  }
  return { chestW_rms: r2(rms(r.cw)), guardHoldChestW_rms: r2(rms(r.still)), wristErr_mean: +mean(r.we).toFixed(3), wristErr_p95: +pct(r.we, 0.95).toFixed(3), bladeErr_mean: r1(mean(r.be)), holdBladeSpeed_rms: r2(rms(r.ring)), tipV_p95: r1(pct(r.tv, 0.95)), state: P.state };
}
export function walk() {
  const G = mk(); const P = G.player; settleAt(G, P, [0.15, -0.1], 2.0);
  const tip = []; for (let i = 0; i < 4 / DT; i++) { P.move.set(0, 1); G.step(); if (i * DT < 1.5) continue; const c = V(P.bodies.chest.translation()), cq = Q(P.bodies.chest.rotation()).invert(); tip.push(P.bladePoint(1, new THREE.Vector3()).sub(c).applyQuaternion(cq)); }
  const p2p = (a) => Math.max(...a) - Math.min(...a);
  return { walkTipBob_mm: Math.round(Math.max(...['x', 'y', 'z'].map((k) => p2p(tip.map((v) => v[k])))) * 1000) };
}
export function jitter() {
  const out = [];
  for (const g of [[0.15, -0.1], [0.05, 0.5], [0.5, 0.1], [0.0, -0.35]]) {
    const G = mk(); const P = G.player; settleAt(G, P, g, 2.5); const dw = []; let prev = null;
    for (let i = 0; i < 1.0 / DT; i++) { G.step(); const w = V(P.sword.angvel()); const bd = bladeDir(P); w.addScaledVector(bd, -w.dot(bd)); if (prev) dw.push(w.distanceTo(prev)); prev = w; }
    out.push(rms(dw));
  }
  return { bladeStepDelta_rms: +mean(out).toFixed(3), worst: +Math.max(...out).toFixed(3) };
}
// ───────── body hits (enemy sword off): blade must not dead-stop ─────────
export function hit(name, gap, sp = 13) {
  const [a, b] = CUTS[name]; const G = mk({ park: false, gap }); const P = G.player, E = G.enemy;
  for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
  const ev = []; G.combat.hooks.onWound = (att, vic, r) => { if (att === P) ev.push(r); };
  E.handOffset.set(0.15, 0); settleAt(G, P, a, 1.5);
  const tips = []; let tHit = null;
  for (let i = 0; i < 0.8 / DT; i++) { const off = P.handOffset; const dx = b[0] - off.x, dy = b[1] - off.y, d = Math.hypot(dx, dy), st = sp * DT; if (d > st) { off.x += dx / d * st; off.y += dy / d * st; } else off.set(b[0], b[1]); const k = ev.length; G.step(); if (tHit == null && ev.length > k) tHit = tips.length; tips.push(P.tipVel.length()); }
  if (tHit == null) return { note: 'no hit' };
  const e = ev[0]; const s = (k) => r1(tips[Math.min(tips.length - 1, tHit + k)]);
  return { first: `${e.zone}:${e.type}${e.pass ? '/PASS' : ''}`, E_J: Math.round(e.energy), mEff: r2(e.mEff), tipPre: r1(tips[tHit - 1]), tip1: s(1), tip3: s(3), tip6: s(6), maxAfter: r1(Math.max(...tips.slice(tHit, tHit + 30))) };
}
// ───────── AI vs AI fights + CCD-jam / explosion detector ─────────
export function fight(secs = 30, seed = 1) {
  seedRand(seed);
  const G = newRound({ walls: true, seed }); const P = G.player, E = G.enemy; P.skill.level = 0.7; // seed = 무기 파손 굴림 씨앗
  G.ai2 = new AI(P, E, 'normal');
  const hits = []; G.combat.hooks.onWound = (att, vic, r) => hits.push(r);
  let jam = 0, tipMax = 0, wMax = 0, nan = false; const be = [];
  for (let i = 0; i < secs / DT; i++) {
    G.step(); if (G.t < 2) continue;
    for (const f of [P, E]) { const t = f.bodies.chest.translation(); if (!Number.isFinite(t.x)) nan = true; const w = V(f.sword.angvel()).length(); wMax = Math.max(wMax, w); tipMax = Math.max(tipMax, f.tipVel.length()); if (w > 40 && f.tipVel.length() < 2) jam++; if (f.state === 'stand') be.push(ang(bladeDir(f), aimOf(f))); }
  }
  return { nan, jamSteps: jam, tipMax: r1(tipMax), wMax: Math.round(wMax), bladeErr: r1(mean(be)), hits: hits.length, opened: hits.filter((h) => h.type !== 'blunt' && h.severity > 0).length, passes: hits.filter((h) => h.pass).length, end: `${P.state}/${E.state}` };
}

const parts = (process.argv[2] || 'cuts,steps,kata,walk,jitter,hits').split(',');
const res = { commit: 'live ../../src' };
if (parts.includes('cuts')) res.cuts = cuts(13).avg3;
if (parts.includes('percut')) res.percut = cuts(13).per;
if (parts.includes('steps')) res.steps = steps();
if (parts.includes('kata')) res.kata = kata();
if (parts.includes('walk')) res.walk = walk();
if (parts.includes('jitter')) res.jitter = jitter();
if (parts.includes('hits')) res.hits = [['oberhau', 1.2], ['zwerch', 1.2], ['oberhau', 1.4], ['zornhau', 1.3]].map(([n, g]) => `${n}@${g} ` + JSON.stringify(hit(n, g)));
if (parts.includes('fights')) res.fights = [1, 2, 3, 4, 5, 6].map((s) => fight(30, s));
console.log(JSON.stringify(res, null, 1));

// 독일 간격 잡기 빠른 디딤 계기 (10/15 — docs/strike/german_chase_2026-10-15.md · 그때 이름 '따라 들어가기' — 잡기는 tools/sim/hold_gap_feel.mjs): 상대 헛침 뒤 앞으로 걷는 걸음마다 시각·시간·거리·빠르기를 켬(GAIT.deChase 1)·끔(0)으로 견준다.
//  ① 롱소드 플레이어(혼자 — 상대를 멀리 치움, 벽 없음): 판 시작 정지·쉼 뒤 '상대 헛침'을 알리고(gait.foeWhiff — ai.js afterStrike·skill.js whiffTrack 가 부르는 자리를 대본이 부름)
//   대본대로 스틱을 민다. 걸음 = 걷는 동안 walk·catch 한 디딤(gait.js fastBegin 과 같은 가름) · 시간·거리 = 그 걸음을 뗀 때부터 다음 걸음을 뗄 때까지 · 빠르기 = 거리 ÷ 시간
//   대본: A 0.2 s 뒤 앞 끝 2.5 s · B 0.2 s 뒤 앞 0.5 2.5 s · C 0.8 s 뒤 앞 끝(창 0.6 s 넘음 — 못 받음) · D 뒤 끝 0.4 s → 앞 끝 2.1 s(뒤 걸음은 안 받음 · 몸이 아직 뒤로 가는 첫 앞 걸음은 받기만)
//        E 옆 끝 0.3 s → 앞 끝 2.2 s(옆 걸음은 안 받음)
//  ② 사람 휘두르기 헛침 → 독일 AI 몸: 레이피어 플레이어(AI 아님)가 손 목표를 허공에서 긋고(handOffset 8 패드 m/s) 상대(롱소드, AI 판단은 끄고 스틱만 대본)가
//   그 뒤 앞 끝으로 걷는다 — 상대가 멀면(4 m) 헛침 → 상대 앞 두 걸음 빠름 / 가까우면(1.2 m) 맞힘·맞물림이면 알리지 않음
//  안정: 넘어짐 · 붙잡기 반사 s(levC > 0.3) · catch · 일찍 디딤(walk 걸음이 정한 시간 85 % 전) — 대본 동안
//  재기만 — 물리·난수는 게임 그대로(begin·touchdown·foeWhiff 을 감싸 읽기만), 판 하나는 결정적.  실행: node tools/sim/chase_step_feel.mjs [무기 longsword] (CSF_ROWS=1 → 걸음마다 줄)
import { newRound, DT } from './harness_m.mjs';
import { GAIT } from '../../src/config.js';
import { Gait } from '../../src/gait.js';

const id = process.argv[2] || 'longsword';
const ROWS = process.env.CSF_ROWS === '1';
const DC0 = GAIT.deChase;
let rec = null;
const B0 = Gait.prototype.begin;
Gait.prototype.begin = function (l, kind, T) {
  B0.call(this, l, kind, T);
  if (!rec || this.f !== rec.who) return;
  const p = this.f.bodies.pelvis.translation();
  rec.begins.push({ t: rec.t, kind, walking: !!this.walking, fastK: this.fastK, x: p.x, z: p.z, mx: this.f.move.x, my: this.f.move.y });
};
const TD0 = Gait.prototype.touchdown;
Gait.prototype.touchdown = function (l, speed) {
  const kind = l.kind;
  const early = kind === 'walk' && l.t < 0.85 * l.T;
  TD0.call(this, l, speed);
  if (rec && this.f === rec.who) rec.tds.push({ t: rec.t, kind, early });
};
const FW0 = Gait.prototype.foeWhiff;
Gait.prototype.foeWhiff = function () {
  FW0.call(this);
  if (rec && this.f === rec.who) rec.whiffs.push({ t: rec.t, opened: !!this.chase });
};

function steps(r, t0) {
  const counted = r.begins.filter((b) => b.t >= t0 && b.walking && (b.kind === 'walk' || b.kind === 'catch'));
  const rows = [];
  for (let i = 0; i + 1 < counted.length; i++) {
    const a = counted[i];
    const b = counted[i + 1];
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    const dur = b.t - a.t;
    rows.push({ i: i + 1, t: a.t - t0, dur, dist, v: dist / dur, fast: a.fastK > 1, dir: Math.abs(a.mx) > Math.abs(a.my) ? '옆' : a.my > 0 ? '앞' : '뒤', kind: a.kind });
  }
  return rows;
}
function stab(G, P, r) {
  return { early: r.tds.filter((d) => d.early).length, walkTD: r.tds.filter((d) => d.kind === 'walk').length, catches: r.tds.filter((d) => d.kind === 'catch').length };
}

// ① 롱소드 플레이어 대본
const SCR = {
  A: { name: '0.2 s 뒤 앞 끝 2.5 s', seq: [[0, 0, 0.2], [0, 1, 2.5]] },
  B: { name: '0.2 s 뒤 앞 0.5 · 2.5 s', seq: [[0, 0, 0.2], [0, 0.5, 2.5]] },
  C: { name: '0.8 s 뒤 앞 끝 (창 넘음)', seq: [[0, 0, 0.8], [0, 1, 1.9]] },
  D: { name: '뒤 끝 0.4 s → 앞 끝 2.1 s', seq: [[0, -1, 0.4], [0, 1, 2.1]] },
  E: { name: '옆 끝 0.3 s → 앞 끝 2.2 s', seq: [[1, 0, 0.3], [0, 1, 2.2]] },
};
function runP(scn, on) {
  GAIT.deChase = on;
  const G = newRound({ walls: false, seed: 7, weapon: id, weapon2: 'longsword' });
  G.park();
  const P = G.player;
  const g = P.gait;
  let t = 0;
  let falls = 0;
  let lev = 0;
  let prev = P.state;
  const step = (mx, my, live) => {
    P.move.set(mx, my);
    G.step();
    t += DT;
    if (rec) rec.t = t;
    if (!live) return;
    if (prev === 'stand' && P.state === 'down') falls++;
    prev = P.state;
    if (g.active && g.levC > 0.3) lev += DT;
  };
  while (t < 3.3) step(0, 0, false);
  rec = { who: P, t, begins: [], tds: [], whiffs: [] };
  const t0 = t;
  g.foeWhiff(); // 상대 헛침 (대본)
  let push = null; // 앞으로 밀기 시작한 때의 골반 자리
  const prog = { d05: NaN, d10: NaN, t1m: NaN };
  for (const [mx, my, d] of SCR[scn].seq) {
    for (let i = 0, n = Math.round(d / DT); i < n; i++) {
      step(mx, my, true);
      if (my > 0 && !push) {
        const p = P.bodies.pelvis.translation();
        push = { t, x: p.x, z: p.z };
      }
      if (push) {
        const p = P.bodies.pelvis.translation();
        const dd = Math.hypot(p.x - push.x, p.z - push.z);
        const dt0 = t - push.t;
        if (Number.isNaN(prog.d05) && dt0 >= 0.5) prog.d05 = dd;
        if (Number.isNaN(prog.d10) && dt0 >= 1.0) prog.d10 = dd;
        if (Number.isNaN(prog.t1m) && dd >= 1.0) prog.t1m = dt0;
      }
    }
  }
  const r = rec;
  rec = null;
  GAIT.deChase = DC0;
  return { rows: steps(r, t0), opened: r.whiffs[0]?.opened ?? false, falls, lev, prog, ...stab(G, P, r) };
}

const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '-');
const f3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : '-');
console.log(`간격 잡기 빠른 디딤 계기 · ${id} 플레이어 · 헛침 알림 뒤 대본 · 켬 = GAIT.deChase 1 · 끔 = 0`);
console.log('| 대본 | 받을 창 열림 | 빠른 걸음 차례 (켬) | 앞 걸음 1·2 시간 s 끔 → 켬 | 앞 걸음 1·2 거리 m 끔 → 켬 | 앞 걸음 1·2 빠르기 m/s 끔 → 켬 | 3·4째 빠르기 끔 → 켬 | 앞으로 민 뒤 0.5 · 1.0 s 간 거리 m 끔 → 켬 | 1 m 까지 s 끔 → 켬 | 넘어짐 · 붙잡기 반사 s · catch · 일찍 디딤 (끔 → 켬) |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
const detail = [];
for (const scn of Object.keys(SCR)) {
  const off = runP(scn, 0);
  const on = runP(scn, 1);
  const fwd = (rows) => rows.filter((r) => r.dir === '앞');
  const a = fwd(off.rows);
  const b = fwd(on.rows);
  const pair = (k, i, fmt) => `${fmt(a[i]?.[k])} → ${fmt(b[i]?.[k])}`;
  const order = on.rows.filter((r) => r.fast).map((r) => `${r.i}(${r.dir})`).join('·') || '-';
  console.log(`| ${scn} ${SCR[scn].name} | ${on.opened ? '예' : '아니오'} | ${order} | ${pair('dur', 0, f3)} · ${pair('dur', 1, f3)} | ${pair('dist', 0, f3)} · ${pair('dist', 1, f3)} | ${pair('v', 0, f2)} · ${pair('v', 1, f2)} | ${pair('v', 2, f2)} · ${pair('v', 3, f2)} | ${f2(off.prog.d05)} → ${f2(on.prog.d05)} · ${f2(off.prog.d10)} → ${f2(on.prog.d10)} | ${f2(off.prog.t1m)} → ${f2(on.prog.t1m)} | ${off.falls}·${f2(off.lev)}·${off.catches}·${off.early}/${off.walkTD} → ${on.falls}·${f2(on.lev)}·${on.catches}·${on.early}/${on.walkTD} |`);
  if (ROWS) {
    for (const [nm, R] of [['끔', off], ['켬', on]]) {
      detail.push(`\n#### ${scn} ${SCR[scn].name} · ${nm}\n\n| 걸음 | 시각 s | 쪽 | 디딤 | 시간 s | 거리 m | 빠르기 m/s | 빠른 걸음 |\n|---|---|---|---|---|---|---|---|`);
      for (const r of R.rows.slice(0, 6)) detail.push(`| ${r.i} | ${f2(r.t)} | ${r.dir} | ${r.kind} | ${f3(r.dur)} | ${f3(r.dist)} | ${f2(r.v)} | ${r.fast ? '**빠름**' : ''} |`);
    }
  }
}

// ② 사람 휘두르기 헛침 → 독일 AI 몸
function runH(near, from = [0.42, 0.42], to = [-0.4, -0.42]) {
  GAIT.deChase = 1;
  const G = newRound({ walls: true, seed: 7, weapon: 'rapier', weapon2: id });
  const P = G.player;
  const E = G.enemy;
  let eMove = [0, 0];
  G.ai.update = () => E.move.set(eMove[0], eMove[1]); // 상대 AI 판단은 끄고 스틱만 대본
  let t = 0;
  const step = () => {
    G.step();
    t += DT;
    if (rec) rec.t = t;
  };
  while (t < 2.3) step();
  if (near < 3) {
    while (P.foeDistance() > near + 0.4 && t < 9) {
      P.move.set(0, 1);
      step();
    }
    P.move.set(0, 0);
  }
  for (let i = 0; i < 0.8 / DT; i++) step();
  rec = { who: E, t, begins: [], tds: [], whiffs: [] };
  // 긋기: from → to (8 패드 m/s), 손 댄 채
  P.handHeld = true;
  {
    const h0 = [P.handOffset.x, P.handOffset.y];
    const m = Math.max(1, Math.round(Math.hypot(from[0] - h0[0], from[1] - h0[1]) / 1.0 / DT)); // 1 패드 m/s — 휘두르기 문턱(SKILL.swingSpeed 1.5) 아래
    for (let i = 1; i <= m; i++) {
      P.inputActive = true;
      P.handOffset.set(h0[0] + ((from[0] - h0[0]) * i) / m, h0[1] + ((from[1] - h0[1]) * i) / m);
      step();
    }
    P.inputActive = false;
  }
  rec.whiffs.length = 0; // 손을 옮기는 동안의 알림은 버림(없어야 함 — 아래 표의 '옮기는 동안' 칸)
  for (let i = 0; i < 0.6 / DT; i++) step();
  const pre = rec.whiffs.length;
  const L = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const n = Math.max(1, Math.round(L / 8 / DT));
  for (let i = 1; i <= n; i++) {
    P.inputActive = true;
    P.handOffset.set(from[0] + ((to[0] - from[0]) * i) / n, from[1] + ((to[1] - from[1]) * i) / n);
    step();
  }
  P.inputActive = false;
  const tSwing = t;
  // 헛침 알림을 기다렸다가(늦어도 1 s) 상대가 앞으로 걷는다
  while (!rec.whiffs.length && t - tSwing < 1) step();
  const tW = rec.whiffs[0]?.t ?? null;
  const tGo = t;
  eMove = [0, 1];
  for (let i = 0; i < 1.6 / DT; i++) step();
  const r = rec;
  rec = null;
  GAIT.deChase = DC0;
  const rows = steps(r, tGo);
  return { pre, tW: tW == null ? null : tW - tSwing, opened: r.whiffs[0]?.opened ?? false, landed: P.skill.whiff?.landed, bound: P.skill.whiff?.bound, fast: rows.filter((x) => x.fast).map((x) => x.i), d: near };
}
console.log('');
console.log('| 사람 긋기 → 독일 AI | 긋기 | 상대 거리 | 헛침 알림 (긋기 끝 뒤 s) | 받을 창 | 맞힘 · 맞물림 | 상대 빠른 걸음 차례 |');
console.log('|---|---|---|---|---|---|---|');
const CUTS = { '사선 (오른 위 → 왼 아래)': [[0.42, 0.42], [-0.4, -0.42]], '가로 (오른 → 왼)': [[0.52, 0.06], [-0.5, 0.06]] };
for (const [near, cut] of [[4, '사선 (오른 위 → 왼 아래)'], [1.2, '사선 (오른 위 → 왼 아래)'], [0.9, '가로 (오른 → 왼)'], [0.7, '가로 (오른 → 왼)']]) {
  const h = runH(near, ...CUTS[cut]);
  console.log(`| 레이피어 사람 → ${id} AI | ${cut} | ${near < 3 ? `${near} m 까지 다가감` : '판 시작 거리'} | ${h.tW == null ? '없음' : f2(h.tW)}${h.pre ? ` (쉬는 동안 ${h.pre})` : ''} | ${h.opened ? '열림' : '-'} | ${h.landed ? '맞힘' : '-'} · ${h.bound ? '맞물림' : '-'} | ${h.fast.join('·') || '-'} |`);
}
if (detail.length) console.log(detail.join('\n'));

// 독일 간격 잡기 계기 (10/15 — docs/strike/german_hold_2026-10-15.md): 상대 헛침 → 앞 끝으로 밀기 → 늦게 베기에서 칼이 닿는 거리·맞힘·클린치를
//  세 갈래로 견준다 — off = 빠른 디딤 끔(GAIT.deChase 0) · chase = 지금(빠른 디딤만, GAIT.deHold 0) · hold = 간격 잡기(기본 — 빠른 디딤 + 잡기).
//  판: 독일 무기 플레이어(AI 아님 — 사람 대본) 대 롱소드 AI(판단 끔 — 겨눔 자세로 제자리, 상처는 받음) · 벽 없음 · 판 하나는 결정적(씨앗 7).
//   시작 거리 = 가슴-가슴 수평(fighter.foeDistance — 간격 잡기·AI 간격과 같은 잣대) · 판 시작 정지·쉼(3.3 s) 뒤 '상대 헛침'을 알린다
//   (gait.foeWhiff — ai.js afterStrike·skill.js whiffTrack 이 부르는 자리를 대본이 부름, german_chase §3-1 과 같음) · 헛침 0.2 s 뒤 스틱 앞 끝 · 베는 동안에도 민 채.
//   베기 = 사람 대본 긋기: 사선 내려베기(corr_lib FAM.diagR — 오른 위 PAD.ShR → 왼 아래 PAD.WechselL, 손가락 12 m/s · 게임과 같은 입력 길 inputPump 60 Hz).
//    칼은 판 시작부터 감기 자리(오른 위)에 둔다(setPad) — 베기 시작 = 긋기 손가락이 움직이기 시작한 때 · 민 뒤 delay s.
//   main.js 처럼 스틱 원값(stickX·stickY)도 적는다(근접 밀치기 걸쇠·잡기 풀림이 읽는 값).
//  잰다: 베기 시작 거리 · 칼이 상대 몸에 처음 닿은 때 거리(combat.strike — 내 칼 → 상대 몸, 베기 시작 뒤) · 맞힘(상대 상처 — 심각도 > 0) ·
//   클린치(닿은 때 거리 < measure.clinch, 또는 근접 밀치기 barge·누르기 closeW > 0.05 가 켜짐 — 민 뒤부터 끝까지) · 끝 = 베기 시작 + 1 s ·
//   잡기 걸림(민 뒤 시각·그때 거리·걸러진 빠르기) · 선 자리(걸린 뒤 골반의 상대 쪽 빠르기가 처음 0.1 m/s 아래가 된 때의 거리) · 잡는 동안 가장 가까운 거리 · 풀린 때·까닭 ·
//   안정(넘어짐 · 붙잡기 반사 s(levC > 0.3) · catch · 일찍 디딤(walk 디딤이 정한 시간 85 % 전) — german_chase 표와 같은 셈, 헛침부터 끝까지).
//  재기만 — 물리·난수는 게임 그대로(strike·touchdown·begin 을 감싸 읽기만).
//  실행: node tools/sim/hold_gap_feel.mjs [무기 longsword] [부분 main,grid,push,side,release,stop,walkstop,tail — 기본 전부] (롱소드 전부 ≈ 3 분)
//   부분: main = 시작 거리 2.0·2.2·2.4 × 베기 0.2·0.4·0.6 s × 세 갈래 판마다 · grid = 2.0~2.4 m 0.05 m 간격(9) 모아 비율(HGF_ROWS=1 → 판마다 줄) ·
//    push = 베지 않고 2 s 밀기 거리 시간표 · side = 잡기 중 옆·비스듬히 밀기 · release = 잡기 중 스틱 0.1 s 놓기 ·
//    stop = 선 자리 분포(보통·판금·무거운 몸 [가정]) · walkstop = 앞 끝 걷다 스틱 놓기(보통 걸음) ·
//    tail = [시험 갈래 — 게임 코드에 없음] 잡기를 거는 때를 빠른 디딤 뒤 0.6 s 까지 넓힌 판(holdTick 을 이 도구 안에서만 감쌈 — 열린 질문용)
//   스위치 갈래는 이 도구가 판마다 GAIT.deChase·deHold 를 바꿔 돈다(with_config 로 준 값은 판 뒤 되돌림)
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { Input } from '../../src/input.js';
import { inputPump, feedTrace, stroke, setPad, PAD, FAM, wilson } from './corr_lib.mjs';
import { Gait } from '../../src/gait.js';
import { Combat } from '../../src/combat.js';
import { CHARACTERS } from '../../src/characters.js';
import { TRADITIONS } from '../../src/schools.js';

const { GAIT } = CONFIG;
const ALL = ['main', 'grid', 'push', 'side', 'release', 'stop', 'walkstop', 'tail'];
const args = process.argv.slice(2);
const WEAPON = args.find((a) => !a.includes(',') && !ALL.includes(a)) ?? 'longsword';
const PARTS = new Set((args.find((a) => a.includes(',') || ALL.includes(a)) ?? ALL.join(',')).split(','));
const G0 = { deChase: GAIT.deChase, deHold: GAIT.deHold };
const ARMS = { off: { deChase: 0, deHold: G0.deHold }, chase: { deChase: 1, deHold: 0 }, hold: { deChase: 1, deHold: 1 }, tail: { deChase: 1, deHold: 1 } };
const ARM_KO = { off: '① 빠른 디딤 끔', chase: '② 지금(빠른 디딤만)', hold: '③ 간격 잡기', tail: '[시험] 잡기 + 빠른 디딤 뒤 0.6 s' };
const PLATE = CHARACTERS.find((c) => c.id === 'heinrich').look; // 판금 겉모습 (finish_thrust.mjs 와 같은 자리)
const deps = { Input, CONFIG, DT };
const T_WAIT = 3.3; // 판 시작 정지(2 s)·쉼 뒤 헛침
const T_PUSH = 0.2; // 헛침 뒤 스틱 앞 끝
const CUT = FAM.diagR; // 사선 내려베기 (오른 위 → 왼 아래, 12 m/s)
const DELAYS = [0.2, 0.4, 0.6];

// ── 읽기만 하는 감싸개 ──
let rec = null;
const S0 = Combat.prototype.strike;
Combat.prototype.strike = function (pr, point, passing) {
  if (rec && !rec.contact && rec.cutT != null && rec.t >= rec.cutT && pr.w.fighter === rec.P && pr.v.fighter === rec.E) rec.contact = { t: rec.t, d: rec.P.foeDistance(), part: pr.v.part };
  return S0.call(this, pr, point, passing);
};
const TD0 = Gait.prototype.touchdown;
Gait.prototype.touchdown = function (l, speed) {
  const kind = l.kind;
  const early = kind === 'walk' && l.t < 0.85 * l.T;
  TD0.call(this, l, speed);
  if (rec && this.f === rec.P) rec.tds.push({ t: rec.t, kind, early });
};
const B0 = Gait.prototype.begin;
Gait.prototype.begin = function (l, kind, T) {
  B0.call(this, l, kind, T);
  if (rec && this.f === rec.P && rec.t >= rec.tW && this.fastK > 1) rec.fast++;
};
// [시험 갈래 tail — 게임 코드에 없음, 열린 질문용] 잡기를 거는 때를 '받을 창 · 빠른 디딤 중'에 더해 빠른 디딤이 끝난 뒤 받을 창 길이(window 0.6 s)까지 넓히면:
//  holdTick 을 감싸 그동안만 끝난 창 자리에 빈 창(left 0)을 두고 부른다 — 걸면 holdTick 이 창을 닫는다. 이 도구의 tail 갈래 판에서만 켬
let TAIL = false;
const HT0 = Gait.prototype.holdTick;
Gait.prototype.holdTick = function (dt) {
  if (!TAIL) return HT0.call(this, dt);
  if (this.hold) {
    this._tailT = Infinity;
    return HT0.call(this, dt);
  }
  if (this.chase || (this.fastK > 1 && this.chaseStep)) {
    if ((this.fastK > 1 && this.chaseStep) || this.chase?.got) this._tailT = 0; // 받은 뒤(빠른 디딤을 쓰기 시작한 뒤)만 — 못 받고 닫힌 창은 늘이지 않음
    return HT0.call(this, dt);
  }
  if (this._tailT == null || (this._tailT += dt) > TRADITIONS.german.chase.window) return HT0.call(this, dt);
  const fake = { def: TRADITIONS.german.chase, t: 0, left: 0, got: true };
  this.chase = fake;
  HT0.call(this, dt);
  if (this.chase === fake) this.chase = null;
  if (this.hold) this._tailT = Infinity;
};

/**
 * 판 하나. plan(tr 민 뒤 시각, o, gait) → 스틱 {x, y}(민 뒤 시각 < 0 이면 0 · 없으면 앞 끝) · cutDelay = 민 뒤 베기 시작(null 이면 안 벰) · end = 민 뒤 끝 시각(베면 베기 시작 + 1 s)
 *  look = 플레이어 겉모습(판금 — 하인리히) · heavy = [가정] 몸 부위 질량 덧배율 · sample = 이 민 뒤 시각의 가슴 자리(옆 대본) · whiff false = 헛침 알림 없음(거리 맞추기)
 */
function episode({ weapon = WEAPON, D = 2.0, arm = 'hold', cutDelay = null, end = 1.8, plan = null, look = null, heavy = 0, gapOff = 0, timeline = false, whiff = true, sample = null }) {
  Object.assign(GAIT, ARMS[arm]);
  TAIL = arm === 'tail';
  const G = newRound({ walls: false, seed: 7, weapon, weapon2: 'longsword', gap: D + gapOff, ...(look ? { look } : {}) });
  const P = G.player;
  const E = G.enemy;
  G.ai.update = () => E.move.set(0, 0); // 상대 AI 판단 끔 — 겨눔 자세로 제자리
  let massK = 1;
  if (heavy) {
    // [가정] 무거운 몸: 몸 부위 질량 × (1 + heavy) — 걷는 힘·받침 셈(totalMass)은 그대로라 같은 다리 힘으로 더 무거운 몸을 세운다(세게 멈춤이 덜 듣는 쪽 시험)
    let m0 = 0;
    let m1 = 0;
    for (const rb of Object.values(P.bodies)) {
      const c = rb.collider(0);
      m0 += c.mass();
      c.setMass(c.mass() * (1 + heavy));
      m1 += c.mass();
    }
    massK = m1 / m0;
  }
  setPad(P, PAD.ShR); // 칼은 감기 자리(오른 위)에서 기다림
  const pump = inputPump(G, deps, { pace: () => 60 });
  pump.stick = { x: 0, y: 0 };
  const fr = pump.frame;
  pump.frame = () => {
    fr();
    P.stickX = pump.stick.x; // main.js 처럼 스틱 원값
    P.stickY = pump.stick.y;
  };
  const g = P.gait;
  const meas = P.swordArt.measure;
  let t = 0;
  rec = { P, E, t: 0, tW: Infinity, cutT: null, contact: null, tds: [], fast: 0 };
  const step = () => {
    G.step();
    t += DT;
    rec.t = t;
  };
  while (t < T_WAIT) step();
  const tW = t;
  rec.tW = tW;
  const dW = P.foeDistance();
  if (whiff) g.foeWhiff(); // 상대 헛침 (대본)
  const opened = !!g.chase;
  const tP = tW + T_PUSH;
  const tEnd = tP + (cutDelay != null ? cutDelay + 1.0 : end);
  const o = { D, dW, opened, falls: 0, lev: 0, holdOn: null, holdOff: null, stop: null, holdMin: Infinity, minD: Infinity, cut: null, clinchState: false, barge: false, line: [], dPush: null };
  let prev = P.state;
  let lastHold = null;
  let nextLine = 0;
  let cutQ = null;
  while (t < tEnd - 1e-9) {
    const tr = t - tP; // 민 뒤 시각
    const s = tr < -1e-9 ? { x: 0, y: 0 } : plan ? plan(tr, o, g) : { x: 0, y: 1 };
    if (o.dPush == null && tr >= -1e-9) o.dPush = P.foeDistance();
    pump.stick.x = s.x;
    pump.stick.y = s.y;
    if (cutDelay != null && !cutQ && tr >= cutDelay - 1e-9) {
      const off = [P.handOffset.x, P.handOffset.y];
      cutQ = feedTrace(G, stroke(CUT.end[0] - off[0], CUT.end[1] - off[1], CUT.v, { down: true, lift: true }));
      rec.cutT = t;
      o.cut = { d: P.foeDistance(), tr, hold: !!g.hold };
    }
    step();
    const tr1 = t - tP;
    const d = P.foeDistance();
    if (prev === 'stand' && P.state === 'down') o.falls++;
    prev = P.state;
    if (g.active && g.levC > 0.3) o.lev += DT;
    if (tr1 >= 0) o.minD = Math.min(o.minD, d);
    if (P.barge) o.barge = true;
    if (tr1 >= 0 && (P.barge || P.closeW > 0.05)) o.clinchState = true;
    // 잡기 걸림·풀림 · 선 자리
    if (g.hold && !lastHold) {
      const a = P.bodies.chest.translation();
      const b = E.bodies.chest.translation();
      const u = { x: (b.x - a.x) / d, z: (b.z - a.z) / d };
      const p = P.bodies.pelvis.translation();
      o.holdOn = { tr: tr1, d, v: g.vf.x * u.x + g.vf.z * u.z, u, x: p.x, z: p.z };
    }
    if (!g.hold && lastHold) o.holdOff = { tr: tr1, d, why: g.holdEnd };
    lastHold = g.hold;
    if (o.holdOn && !o.holdOff) o.holdMin = Math.min(o.holdMin, d);
    if (o.holdOn && !o.stop) {
      const v = P.bodies.pelvis.linvel();
      const vt = v.x * o.holdOn.u.x + v.z * o.holdOn.u.z;
      if (vt <= 0.1) o.stop = { tr: tr1, d };
    }
    if (sample != null && !o.at && tr1 >= sample - 1e-9) {
      const p = P.bodies.chest.translation();
      o.at = { tr: tr1, d, x: p.x, z: p.z };
    }
    if (timeline && tr1 >= nextLine - 1e-9) {
      const p = P.bodies.chest.translation();
      o.line.push({ tr: tr1, d, x: p.x, z: p.z, hold: !!g.hold, fastK: g.fastK });
      nextLine += 0.1;
    }
  }
  {
    const p = P.bodies.chest.translation();
    o.atEnd = { d: P.foeDistance(), x: p.x, z: p.z };
  }
  const w = G.wounds.filter((x) => x.att === P && x.vic === E && rec.cutT != null && x.t >= rec.cutT - 1e-9);
  o.hit = w.some((x) => x.severity > 0);
  o.contact = rec.contact;
  o.clinch = !!((o.contact && o.contact.d < meas.clinch) || o.clinchState);
  o.catches = rec.tds.filter((x) => x.kind === 'catch' && x.t >= tW).length;
  o.early = rec.tds.filter((x) => x.early && x.t >= tW).length;
  o.walkTD = rec.tds.filter((x) => x.kind === 'walk' && x.t >= tW).length;
  o.fast = rec.fast;
  o.massK = massK;
  o.meas = meas;
  rec = null;
  TAIL = false;
  Object.assign(GAIT, G0);
  return o;
}

const f2 = (v) => (v == null || !Number.isFinite(v) ? '-' : v.toFixed(2));
const f3 = (v) => (v == null || !Number.isFinite(v) ? '-' : v.toFixed(3));
const pct = (k, n) => {
  if (!n) return '-';
  const [lo, hi] = wilson(k, n);
  return `${k}/${n} (${Math.round((100 * k) / n)} % · ${Math.round(100 * lo)}~${Math.round(100 * hi)})`;
};
const fin = (a) => a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y);
const medOf = (a) => {
  const b = fin(a);
  if (!b.length) return null;
  const m = (b.length - 1) / 2;
  return (b[Math.floor(m)] + b[Math.ceil(m)]) / 2;
};
const span = (a) => {
  const b = fin(a);
  return b.length ? `${f2(b[0])}~${f2(b[b.length - 1])}` : '-';
};
const stab = (o) => `${o.falls}·${f2(o.lev)}·${o.catches}·${o.early}/${o.walkTD}`;
const holdTxt = (o) => (o.holdOn ? `${f2(o.holdOn.tr)} s · ${f2(o.holdOn.d)} m · ${f2(o.holdOn.v)} m/s` : '-');
const offTxt = (o) => (o.holdOff ? `${f2(o.holdOff.tr)} s ${{ time: '시간', stick: '스틱 놓음', state: '상태' }[o.holdOff.why] ?? o.holdOff.why}` : o.holdOn ? '끝까지' : '-');

// 시작 거리 맞추기: 골반 간격 − 서 있는 가슴 거리 (같은 판 차림으로 한 번 — 결정적. 무기·겉모습마다)
const calibC = new Map();
function gapOf(weapon = WEAPON, look = null) {
  const k = `${weapon}|${look ? 'look' : ''}`;
  if (!calibC.has(k)) {
    const o = episode({ weapon, D: 2.2, arm: 'off', end: 0.01, look, whiff: false });
    calibC.set(k, 2.2 - o.dW);
  }
  return calibC.get(k);
}
const meas0 = episode({ D: 2.2, arm: 'off', end: 0.01, whiff: false }).meas;
console.log(`# 간격 잡기 계기 · ${WEAPON} 플레이어(사람 대본) 대 롱소드 AI(판단 끔) · measure contact ${f2(meas0.contact)} m · clinch ${f2(meas0.clinch)} m · 골반 간격 − 가슴 거리 ${f3(gapOf())} m`);
console.log('갈래: ① off = `GAIT.deChase=0` · ② chase = `GAIT.deHold=0`(지금 — 빠른 디딤만) · ③ hold = 기본(간격 잡기). 헛침 → 0.2 s 뒤 스틱 앞 끝(끝까지 민 채) → 민 뒤 delay s 에 사선 내려베기(12 m/s) · 끝 = 베기 시작 + 1 s');

// ── main: 시작 거리 × 베기 늦음 × 갈래 ──
const mainRows = [];
if (PARTS.has('main')) {
  console.log('\n## main — 판마다 (안정 = 넘어짐·붙잡기 반사 s·catch·일찍 디딤/walk 디딤)\n');
  console.log('| 시작 m | 베기 (민 뒤 s) | 갈래 | 잡기 걸림 (민 뒤 · 거리 · 빠르기) | 선 자리 m | 풀림 | 베기 시작 거리 m | 닿은 때 거리 m (부위) | 맞힘 | 클린치 | 가장 가까움 m | 빠른 디딤 | 안정 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const D of [2.0, 2.2, 2.4]) {
    for (const delay of DELAYS) {
      for (const arm of ['off', 'chase', 'hold']) {
        const o = episode({ D, arm, cutDelay: delay, gapOff: gapOf() });
        mainRows.push({ D, delay, arm, o });
        console.log(`| ${f2(o.dW)} | ${delay} | ${ARM_KO[arm]} | ${holdTxt(o)} | ${o.stop ? f2(o.stop.d) : '-'} | ${offTxt(o)} | ${f2(o.cut?.d)}${o.cut?.hold ? ' (잡는 중)' : ''} | ${o.contact ? `${f2(o.contact.d)} (${o.contact.part})` : '안 닿음'} | ${o.hit ? '맞힘' : '-'} | ${o.clinch ? '클린치' : '-'} | ${f2(o.minD)} | ${o.fast} | ${stab(o)} |`);
      }
    }
  }
}

// ── grid: 2.0~2.4 m 0.05 간격 — 비율 ──
function summary(rows, title) {
  console.log(`\n${title}\n`);
  console.log('| 갈래 | 베기 (민 뒤 s) | 판 | 잡기 걸림 | 맞힘 (95 % 띠) | 클린치 (95 % 띠) | 닿은 때 거리 중앙 m [범위] (닿은 판) | 베기 시작 거리 중앙 m | 선 자리 중앙 m [범위] | 넘어짐 · 붙잡기 반사 s · catch · 일찍 디딤 (합) |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const arm of ['off', 'chase', 'hold']) {
    for (const delay of DELAYS) {
      const R = rows.filter((r) => r.arm === arm && r.delay === delay).map((r) => r.o);
      if (!R.length) continue;
      const n = R.length;
      const cd = R.filter((o) => o.contact).map((o) => o.contact.d);
      const st = R.reduce((a, o) => ({ falls: a.falls + o.falls, lev: a.lev + o.lev, c: a.c + o.catches, e: a.e + o.early, w: a.w + o.walkTD }), { falls: 0, lev: 0, c: 0, e: 0, w: 0 });
      console.log(`| ${ARM_KO[arm]} | ${delay} | ${n} | ${R.filter((o) => o.holdOn).length}/${n} | ${pct(R.filter((o) => o.hit).length, n)} | ${pct(R.filter((o) => o.clinch).length, n)} | ${f2(medOf(cd))} [${span(cd)}] (${cd.length}) | ${f2(medOf(R.map((o) => o.cut?.d)))} | ${f2(medOf(R.map((o) => o.stop?.d)))} [${span(R.map((o) => o.stop?.d))}] | ${st.falls} · ${f2(st.lev)} · ${st.c} · ${st.e}/${st.w} |`);
    }
  }
}
if (PARTS.has('main') && mainRows.length) summary(mainRows, '### main 모음 (시작 2.0·2.2·2.4 m — 칸마다 3 판)');
if (PARTS.has('grid')) {
  const rows = [];
  for (let i = 0; i <= 8; i++) {
    const D = 2.0 + 0.05 * i;
    for (const delay of DELAYS) for (const arm of ['off', 'chase', 'hold']) rows.push({ D, delay, arm, o: episode({ D, arm, cutDelay: delay, gapOff: gapOf() }) });
  }
  summary(rows, '## grid — 시작 2.0~2.4 m 0.05 m 간격(9 판) × 베기 늦음 × 갈래 (결정적 — 띠는 시작 거리 퍼짐)');
  if (process.env.HGF_ROWS === '1') {
    console.log('\n| 시작 m | 베기 | 갈래 | 잡기 | 선 자리 | 베기 시작 | 닿은 때 | 맞힘 | 클린치 |\n|---|---|---|---|---|---|---|---|---|');
    for (const r of rows) console.log(`| ${f2(r.o.dW)} | ${r.delay} | ${r.arm} | ${holdTxt(r.o)} | ${f2(r.o.stop?.d)} | ${f2(r.o.cut?.d)} | ${f2(r.o.contact?.d)} | ${r.o.hit ? 'O' : '-'} | ${r.o.clinch ? 'O' : '-'} |`);
  }
}

// ── push: 베지 않고 2 s 앞으로 — 거리 시간표 ──
if (PARTS.has('push')) {
  console.log('\n## push — 베지 않고 민 뒤 2 s 동안 앞 끝 (거리 m, 0.1 s 마다 · H = 잡는 중 · F = 빠른 디딤 중)\n');
  for (const D of [2.0, 2.2, 2.4]) {
    for (const arm of ['off', 'chase', 'hold']) {
      const o = episode({ D, arm, end: 2.0, gapOff: gapOf(), timeline: true });
      console.log(`- 시작 ${f2(o.dW)} m · ${ARM_KO[arm]} · 잡기 ${holdTxt(o)} · 선 자리 ${f2(o.stop?.d)} · 잡는 동안 가장 가까움 ${f2(o.holdMin)} · 풀림 ${offTxt(o)} · 안정 ${stab(o)}`);
      console.log(`  ${o.line.map((x) => `${f2(x.d)}${x.hold ? 'H' : ''}${x.fastK > 1 ? 'F' : ''}`).join(' ')}`);
    }
  }
}

// ── side: 잡기 중 옆·비스듬히 ──
if (PARTS.has('side')) {
  console.log('\n## side — 잡기가 걸린 뒤(간격 잡기) / 같은 민 뒤 시각(지금)에 스틱을 바꿈 · 바꾼 뒤 0.6 s 동안 옆으로 간 거리(바꿀 때 상대 쪽에 수직) · 가까워진 거리\n');
  console.log('| 시작 m | 스틱 (바꾼 뒤) | 갈래 | 바꾼 때 (민 뒤 s) | 옆 m | 가까워짐 m | 잡기 풀림 | 안정 |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const D of [2.0, 2.2]) {
    const ref = episode({ D, arm: 'hold', end: 2.0, gapOff: gapOf() });
    const tSw = ref.holdOn ? ref.holdOn.tr + 0.02 : 0.55;
    for (const [nm, s] of [['오른 끝 (1, 0)', { x: 1, y: 0 }], ['비스듬히 앞 오른 (0.71, 0.71)', { x: 0.71, y: 0.71 }]]) {
      for (const arm of ['chase', 'hold']) {
        const o = episode({ D, arm, end: tSw + 0.6, gapOff: gapOf(), plan: (tr) => (tr < tSw - 1e-9 ? { x: 0, y: 1 } : s), sample: tSw });
        // 판 차림이 x 축 위(상대가 +x)라 상대 쪽에 수직 = z — 바꾼 때와 끝의 가슴 자리
        const lat = o.at && o.atEnd ? Math.abs(o.atEnd.z - o.at.z) : null;
        const close = o.at && o.atEnd ? o.at.d - o.atEnd.d : null;
        console.log(`| ${f2(o.dW)} | ${nm} | ${ARM_KO[arm]} | ${f2(tSw)} | ${f2(lat)} | ${f2(close)} | ${offTxt(o)} | ${stab(o)} |`);
      }
    }
  }
}

// ── release: 잡기 중 스틱 0.1 s 놓았다 다시 앞 끝 ──
if (PARTS.has('release')) {
  console.log('\n## release — 잡기가 걸리고 0.15 s 뒤 스틱을 0.1 s 놓았다 다시 앞 끝 (거리 m, 0.1 s 마다)\n');
  for (const D of [2.0, 2.2]) {
    const ref = episode({ D, arm: 'hold', end: 2.0, gapOff: gapOf() });
    const t0 = ref.holdOn ? ref.holdOn.tr + 0.15 : 0.7;
    const o = episode({ D, arm: 'hold', end: 2.0, gapOff: gapOf(), timeline: true, plan: (tr) => (tr >= t0 - 1e-9 && tr < t0 + 0.1 - 1e-9 ? { x: 0, y: 0 } : { x: 0, y: 1 }) });
    console.log(`- 시작 ${f2(o.dW)} m · 놓은 때 민 뒤 ${f2(t0)} s · 잡기 ${holdTxt(o)} · 풀림 ${offTxt(o)} · 안정 ${stab(o)}`);
    console.log(`  놓기: ${o.line.map((x) => `${f2(x.d)}${x.hold ? 'H' : ''}${x.fastK > 1 ? 'F' : ''}`).join(' ')}`);
    const r2 = episode({ D, arm: 'hold', end: 2.0, gapOff: gapOf(), timeline: true });
    console.log(`  안 놓기: ${r2.line.map((x) => `${f2(x.d)}${x.hold ? 'H' : ''}${x.fastK > 1 ? 'F' : ''}`).join(' ')}`);
  }
}

// ── stop: 선 자리 분포 ──
/** 시작 거리 목록을 이어진 구간 글로 (0.025 간격) */
const ranges = (xs, stepM = 0.025) => {
  const out = [];
  for (const x of xs) {
    const last = out[out.length - 1];
    if (last && x - last[1] <= stepM * 1.5) last[1] = x;
    else out.push([x, x]);
  }
  return out.map(([a, b]) => (a === b ? f2(a) : `${f2(a)}~${f2(b)}`)).join(' · ') || '-';
};
function stopTable(title, bodies, arm = 'hold') {
  console.log(`\n${title}\n`);
  console.log('| 몸 | 판 | 잡기 걸림 (안 걸린 시작 m) | 걸릴 때 빠르기 m/s 중앙 [범위] | 걸린 때 거리 − contact m 중앙 [범위] | 선 자리 − contact m 중앙 [범위] | 잡는 동안 가장 가까움 − contact m 중앙 [범위] | 걸린 뒤 미끄러짐 m 중앙 [범위] | 안정 (합) |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const [nm, opt] of bodies) {
    const R = [];
    for (let i = 0; i <= 28; i++) {
      const D = 1.7 + 0.025 * i;
      R.push(episode({ D, arm, end: 1.4, gapOff: gapOf(opt.weapon ?? WEAPON, opt.look ?? null), ...opt }));
    }
    const H = R.filter((o) => o.holdOn);
    const c = R[0].meas.contact;
    const st = R.reduce((a, o) => ({ falls: a.falls + o.falls, lev: a.lev + o.lev, c: a.c + o.catches, e: a.e + o.early, w: a.w + o.walkTD }), { falls: 0, lev: 0, c: 0, e: 0, w: 0 });
    const on = H.map((o) => o.holdOn.d - c);
    const sd = H.map((o) => (o.stop ? o.stop.d - c : null));
    const mn = H.map((o) => o.holdMin - c);
    const sl = H.map((o) => (o.stop ? o.holdOn.d - o.stop.d : null));
    const vs = H.map((o) => o.holdOn.v);
    const noTrig = R.filter((o) => !o.holdOn).map((o) => +o.dW.toFixed(3));
    const mk = R[0].massK !== 1 ? ` (질량 × ${R[0].massK.toFixed(2)})` : '';
    console.log(`| ${nm}${mk} | ${R.length} | ${H.length}/${R.length} (${ranges(noTrig)}) | ${f2(medOf(vs))} [${span(vs)}] | ${f2(medOf(on))} [${span(on)}] | ${f2(medOf(sd))} [${span(sd)}] | ${f2(medOf(mn))} [${span(mn)}] | ${f2(medOf(sl))} [${span(sl)}] | ${st.falls} · ${f2(st.lev)} · ${st.c} · ${st.e}/${st.w} |`);
  }
}
if (PARTS.has('stop')) {
  stopTable('## stop — 선 자리 분포: 베지 않고 앞 끝 · 시작 1.70~2.40 m 0.025 m 간격(29 판) · 간격 잡기(기본)', [
    ['보통', {}],
    ['판금 (하인리히 겉모습 — 걷기 × 0.8)', { look: PLATE }],
    ['[가정] 무거운 몸 (몸 부위 질량 × 1.3 · 다리 힘·받침 셈 그대로)', { heavy: 0.3 }],
    ['[가정] 무거운 몸 + 판금', { heavy: 0.3, look: PLATE }],
  ]);
}

// ── tail: [시험 갈래] 빠른 디딤 뒤 0.6 s 까지 잡기를 걸 수 있으면 ──
if (PARTS.has('tail')) {
  const rows = [];
  for (let i = 0; i <= 8; i++) {
    const D = 2.0 + 0.05 * i;
    for (const delay of DELAYS) for (const arm of ['hold', 'tail']) rows.push({ D, delay, arm, o: episode({ D, arm, cutDelay: delay, gapOff: gapOf() }) });
  }
  console.log('\n## tail — [시험 갈래, 게임 코드에 없음] 잡기를 거는 때를 빠른 디딤이 끝난 뒤 0.6 s 까지 넓히면 (grid 와 같은 판)\n');
  console.log('| 갈래 | 베기 (민 뒤 s) | 판 | 잡기 걸림 | 맞힘 (95 % 띠) | 클린치 (95 % 띠) | 닿은 때 거리 중앙 m [범위] (닿은 판) | 선 자리 중앙 m [범위] | 안정 (합) |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const arm of ['hold', 'tail']) {
    for (const delay of DELAYS) {
      const R = rows.filter((r) => r.arm === arm && r.delay === delay).map((r) => r.o);
      const n = R.length;
      const cd = R.filter((o) => o.contact).map((o) => o.contact.d);
      const st = R.reduce((a, o) => ({ falls: a.falls + o.falls, lev: a.lev + o.lev, c: a.c + o.catches, e: a.e + o.early, w: a.w + o.walkTD }), { falls: 0, lev: 0, c: 0, e: 0, w: 0 });
      console.log(`| ${ARM_KO[arm]} | ${delay} | ${n} | ${R.filter((o) => o.holdOn).length}/${n} | ${pct(R.filter((o) => o.hit).length, n)} | ${pct(R.filter((o) => o.clinch).length, n)} | ${f2(medOf(cd))} [${span(cd)}] (${cd.length}) | ${f2(medOf(R.map((o) => o.stop?.d)))} [${span(R.map((o) => o.stop?.d))}] | ${st.falls} · ${f2(st.lev)} · ${st.c} · ${st.e}/${st.w} |`);
    }
  }
  stopTable('### tail — 선 자리 (베지 않고 앞 끝 · 1.70~2.40 m)', [['보통 · [시험] 빠른 디딤 뒤 0.6 s', {}]], 'tail');
}

// ── walkstop: 앞 끝으로 걷다 스틱을 놓으면 (보통 걸음 — 빠른 디딤·잡기 없음) ──
if (PARTS.has('walkstop')) {
  console.log('\n## walkstop — 혼자(상대 치움) 서 있다 앞 끝으로 걷다 스틱을 놓음 (보통 걸음 · 헛침 없음 · 놓는 때 걷기 시작 1.50~1.95 s 0.05 s 간격 10 판 — 걸음 박자 위상 퍼짐)\n');
  const R = [];
  for (let k = 0; k < 10; k++) {
    const tRel = 1.5 + 0.05 * k;
    const G = newRound({ walls: false, seed: 7, weapon: WEAPON, weapon2: 'longsword' });
    G.park();
    const P = G.player;
    let t = 0;
    const step = () => {
      G.step();
      t += DT;
    };
    while (t < T_WAIT) {
      P.move.set(0, 0);
      step();
    }
    const t0 = t;
    const vs = [];
    while (t < t0 + tRel - 1e-9) {
      P.move.set(0, 1);
      step();
      if (t > t0 + tRel - 0.3) {
        const v = P.bodies.pelvis.linvel();
        vs.push(Math.hypot(v.x, v.z));
      }
    }
    const p0 = P.bodies.pelvis.translation();
    const c0 = P.bodies.chest.translation();
    const tr = t;
    let stop = null;
    while (t < tr + 2.0) {
      P.move.set(0, 0);
      step();
      const v = P.bodies.pelvis.linvel();
      if (!stop && Math.hypot(v.x, v.z) <= 0.1) {
        const p = P.bodies.pelvis.translation();
        const c = P.bodies.chest.translation();
        stop = { t: t - tr, d: Math.hypot(p.x - p0.x, p.z - p0.z), dc: Math.hypot(c.x - c0.x, c.z - c0.z) };
      }
    }
    const p1 = P.bodies.pelvis.translation();
    R.push({ v: vs.reduce((a, b) => a + b, 0) / vs.length, stop, end: Math.hypot(p1.x - p0.x, p1.z - p0.z) });
  }
  const vv = R.map((r) => r.v);
  const st = R.map((r) => r.stop?.t);
  const sd = R.map((r) => r.stop?.d);
  const sc = R.map((r) => r.stop?.dc);
  const en = R.map((r) => r.end);
  console.log(`- ${WEAPON}: 놓기 전 0.3 s 골반 빠르기 평균 ${f2(medOf(vv))} m/s [${span(vv)}] → 놓은 뒤 0.1 m/s 아래까지 ${f2(medOf(st))} s [${span(st)}] · 그동안 골반 ${f2(medOf(sd))} m [${span(sd)}] · 가슴 ${f2(medOf(sc))} m [${span(sc)}] · 놓은 뒤 2 s 골반 ${f2(medOf(en))} m [${span(en)}] (10 판 중앙 [범위])`);
}

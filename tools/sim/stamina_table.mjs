// 기력 설계안 §4 표를 실제 판으로 (10/15 기력 들여옴 — docs/strike/stamina_import_2026-10-15.md · 설계 docs/design/stamina_2026-10-15.md §4)
//  사람 대본 플레이어(손가락 대신 손 목표를 대본대로 옮김 · 탭 찌르기 · 막기 단추 · 스틱)로 실제 Skill·Fighter·물리를 돌려 0 도달 · −30(심한 지침) · 첫 탈진 시각을 잰다.
//  쓰기: node tools/sim/stamina_table.mjs [줄 이름,…]      (줄: cuts · burst · thrust · trade · hold · timed · walk · speed — 없으면 speed 빼고 모두)
//        설계안 회복 15/s 로 견주기: node tools/sim/with_config.mjs STAMINA.playerRecoverPerSecond=15 stamina_table.mjs
//  대본 (판마다 2 s 자세 잡기 뒤 새 장부 — 판 시작 정지 2 s 가 지난 뒤부터 잼):
//   cuts   — 상대 AI 멈춤 · 8 m 떨어짐. 좌우 번갈아 가로 긋기(손 ±0.45 · 높이 0.12 · 0.18 s)를 정한 박자로 (샛별 저장소 stamina_scenarios 와 같은 손길). 탈진 동안은 입력 없음(main.js 처럼)
//   burst  — 롱소드 0.5 s 마다 세 번 + 1.5 s 쉼
//   thrust — 레이피어 탭 찌르기를 0.5 s 마다 누름(앞 찌르기가 끝나기 전 누름은 게임이 안 받음 — 받은 수를 적음)
//   trade · hold · timed — 상대 AI(롱소드)가 1.2 s 마다 정한 베기(zornhau)를 친다(그 밖의 AI 공격·비기는 막음 · 상대 기력은 100 에 묶어 박자를 지킴) · 둘 다 상처 끔(몸·칼 물리 그대로):
//     (1.2 s 마다 — 앞 공격이 지나감(follow) 중이면 끊고 새로 · 상대 공격마다 막아 받기가 청구됐나 · 상처 판정만 났나를 센다)
//     trade = 상대가 공격을 결심하면(손을 듦) 막기 단추를 누르고 칼이 나간 뒤 0.35 s 에 놓으며 반대쪽으로 받아 베기 한 번 · hold = 줄곧 누름 · timed = 결심부터 칼이 나간 뒤 0.6 s 까지만 누름
//   walk   — 상대 치움(멀리) · 벽 없음. 기력 0(정상 단계 — 설계안 셈과 같은 바탕) · 회복 대기 0 에서 80 까지: 서 있기 · 스틱 끝 앞 · 뒤 · 옆 × 롱소드(보통) · 우치가타나(일본) · 청강검(동방).
//     + 탈진 끝(0 · 지침 단계 × 0.7 — 게임에서 0 이 되는 흔한 길)에서 80 까지
//  시각은 게임 시간 초(템포 1.1 이면 실제 초 × 1.1 이 게임 초). '—' = 그 판 안에 안 옴
import { newRound, DT } from './harness_m.mjs';
import { Stamina } from '../../src/stamina.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { STAMINA } from '../../src/config.js';

const want = (process.argv[2] ?? 'cuts,burst,thrust,trade,hold,timed,walk').split(',');
const r3 = (x) => (x == null ? null : +x.toFixed(3));
const rows = [];

/** 새 장부 (2 s 자세 잡기 뒤 — 판 시작 정지가 지난 뒤) */
function fresh(f, controller = null) {
  f.stamina = new Stamina(f);
  f.stamina.controller = controller;
  return f.stamina;
}
/** 0 · −30 · 탈진 첫 시각과 그때까지 낸 공격 수 */
function marks() {
  return { zero: null, zeroAttacks: null, severe: null, exhaust: null, t80: null };
}
function mark(m, s, t) {
  if (m.zero == null && s.value <= 0) (m.zero = r3(t)), (m.zeroAttacks = s.counts.cut + s.counts.thrust);
  if (m.severe == null && s.level >= 2) m.severe = r3(t);
  if (m.exhaust == null && s.exhausted) m.exhaust = r3(t);
}

// ── 혼자 베기·찌르기 (상대 멈춤 8 m) ──
function solo(name, weapon, schedule, seconds, kind = 'cut') {
  const g = newRound({ weapon, seed: 23, gap: 8 });
  try {
    g.ai.update = () => {};
    const f = g.player;
    f.handOffset.set(0.45, 0.12);
    for (let i = 0; i < 240; i++) g.step();
    const s = fresh(f);
    const t0 = g.t;
    const m = marks();
    let n = -1;
    let tapsTried = 0;
    let tapsTaken = 0;
    for (let i = 0; i < seconds / DT; i++) {
      const t = g.t - t0;
      const k = schedule(t); // 지금 긋기 번호와 그 긋기 시작 시각 (null = 쉼)
      if (kind === 'thrust') {
        if (k && k.n !== n && !s.exhausted) {
          tapsTried++;
          if (f.skill.thrust({ step: false })) tapsTaken++;
        }
      } else if (k && !s.exhausted) {
        const u = Math.min(1, (t - k.t) / 0.18);
        const dir = k.n % 2 ? 1 : -1;
        f.handOffset.set(dir * (-0.45 + 0.9 * u), 0.12);
        f.inputActive = u < 1;
        f.handHeld = true;
      } else f.inputActive = false;
      if (k) n = k.n;
      f.move.set(0, 0); // 스틱 0 — main.js 가 화면마다 스틱 값으로 다시 쓰는 것과 같게 (내딛기가 남긴 move 가 굳지 않게)
      g.step();
      mark(m, s, g.t - t0);
    }
    rows.push({ row: name, weapon, weight: r3(s.weight), ...m, exhaustions: s.counts.exhaustion, cuts: s.counts.cut, thrusts: s.counts.thrust, ...(kind === 'thrust' ? { tapsTried, tapsTaken } : {}), end: r3(s.value), seconds, state: f.state });
  } finally {
    g.world.free();
  }
}
const every = (P) => (t) => ({ n: Math.floor(t / P), t: Math.floor(t / P) * P });
const burst3 = (t) => {
  const c = Math.floor(t / 3); // 0.5 s 마다 셋(0 · 0.5 · 1.0) + 1.5 s 쉼 = 3 s 마디
  const u = t - c * 3;
  if (u >= 1.5) return null;
  const j = Math.floor(u / 0.5);
  return { n: c * 3 + j, t: c * 3 + j * 0.5 };
};

// ── 상대가 1.2 s 마다 침 ──
function versus(name, mode, seconds) {
  const g = newRound({ weapon: 'longsword', weapon2: 'longsword', seed: 31, gap: 2.4 });
  try {
    const P = g.player;
    const E = g.enemy;
    P.applyWound = E.applyWound = () => {}; // 시험만: 상처 끔(몸·칼 물리 그대로) — 막지 못한 칼에 쓰러져 판이 끝나지 않게
    const a = g.ai;
    a.secret = null;
    const startAttack = a.startAttack.bind(a);
    let allow = false;
    a.startAttack = (tech, why, opt = {}) => (allow ? startAttack(tech, why, opt) : false); // 대본 공격만
    const tech = a.school.techByName.zornhau;
    const guard = new PlayerParryGuard(P, E);
    P.stamina.controller = guard;
    g.before = () => guard.step(DT);
    for (let i = 0; i < 240; i++) g.step();
    const s = fresh(P, guard);
    const t0 = g.t;
    const m = marks();
    let next = 0.5;
    const atk = []; // 상대 공격마다 { start(결심), strike(칼이 나감), block(이 공격에 막아 받기 청구), hit(이 공격 동안 내 몸에 상처 판정) }
    let lastPhase = a.phase;
    let swing = null; // 받아 베기 손길 { t, from, to }
    let release = null; // 이번 공격에서 막기를 놓은 때 (trade · timed)
    let wSeen = g.wounds.length;
    for (let i = 0; i < seconds / DT; i++) {
      const t = g.t - t0;
      E.stamina.value = 100; // 상대 기력은 100 에 묶음 (박자 유지 — 이 줄은 사람 장부를 잰다)
      E.stamina.level = 0;
      // 1.2 s 마다 정한 베기 — 앞 공격의 지나감(follow) 중이면 끊고 새로 (공격 한 번이 1.2 s 보다 길어 박자가 늘어지지 않게)
      if (t >= next && (a.mode !== 'attack' || a.phase === 'follow') && E.state === 'stand') {
        allow = true;
        if (a.startAttack(tech, 'test', { noFeint: true })) {
          next += 1.2;
          atk.push({ start: t, strike: null, block: false, hit: false });
          release = null;
        }
        allow = false;
      }
      const cur = atk[atk.length - 1];
      if (mode === 'hold') guard.held = !s.exhausted;
      else if (cur) {
        // 공격 결심(손을 드는 때)부터 누르고 · 칼이 나간 뒤 0.35 s(trade) / 0.6 s(timed) 에 놓는다 — 사람이 들어 올리는 칼을 보고 누르는 꼴
        const until = mode === 'trade' ? 0.35 : 0.6;
        const held = release == null && !(cur.strike != null && t - cur.strike >= until);
        if (!held && release == null) release = t;
        guard.held = held && !s.exhausted;
        if (mode === 'trade' && release === t && !s.exhausted) {
          const h = P.handOffset;
          swing = { t, from: [h.x, h.y], to: [h.x >= 0 ? -0.45 : 0.45, 0] }; // 놓자마자 반대쪽으로 받아 베기 한 번
        }
      } else guard.held = false;
      if (swing && !s.exhausted) {
        const u = Math.min(1, (t - swing.t) / 0.18);
        P.handOffset.set(swing.from[0] + (swing.to[0] - swing.from[0]) * u, swing.from[1] + (swing.to[1] - swing.from[1]) * u);
        P.inputActive = u < 1;
        P.handHeld = true;
        if (u >= 1) swing = null;
      } else P.inputActive = false;
      const b0 = s.counts.block;
      P.move.set(0, 0); // 스틱 0 — main.js 가 화면마다 스틱 값으로 다시 쓰는 것과 같게 (베기 내딛기가 남긴 move 가 굳어 앞으로 걷지 않게)
      g.step();
      if (cur) {
        if (a.phase === 'strike' && lastPhase !== 'strike' && cur.strike == null) cur.strike = g.t - t0;
        if (s.counts.block > b0) cur.block = true;
        for (; wSeen < g.wounds.length; wSeen++) if (g.wounds[wSeen].vic === P) cur.hit = true;
      } else wSeen = g.wounds.length;
      lastPhase = a.phase;
      mark(m, s, g.t - t0);
    }
    const starts = atk.map((x) => x.start);
    const gaps = starts.slice(1).map((x, i) => x - starts[i]);
    rows.push({ row: name, mode, ...m, exhaustions: s.counts.exhaustion, foeAttacks: atk.length, meanGap: r3(gaps.reduce((x, y) => x + y, 0) / Math.max(1, gaps.length)), struck: atk.filter((x) => x.strike != null).length, blocked: atk.filter((x) => x.block).length, hitOnly: atk.filter((x) => x.hit && !x.block).length, blocks: s.counts.block, cuts: s.counts.cut, thrusts: s.counts.thrust, spent: Object.fromEntries(Object.entries(s.spent).map(([k, v]) => [k, r3(v)])), end: r3(s.value), seconds });
  } finally {
    g.world.free();
  }
}

// ── 걸으며 회복 (0 → 80) ──
function walk(weapon, stick, start) {
  const g = newRound({ weapon, seed: 41, walls: false });
  try {
    g.park();
    const f = g.player;
    for (let i = 0; i < 240; i++) g.step();
    const s = fresh(f);
    if (start === 'exhaust') {
      s.spend('attack', 150); // −50 → 탈진 2.5 s → 0 · 지침 단계로 풀림 (그때부터 잰다)
      for (let i = 0; i < 400 && s.exhausted; i++) g.step();
    } else {
      s.value = 0;
      s.rest = 0;
    }
    const t0 = g.t;
    const p0 = f.bodies.pelvis.translation();
    let t80 = null;
    let tired = 0;
    for (let i = 0; i < 20 / DT && t80 == null; i++) {
      f.move.set(stick[0], stick[1]);
      g.step();
      if (s.level > 0) tired += DT;
      if (s.value >= 80) t80 = g.t - t0;
    }
    const p1 = f.bodies.pelvis.translation();
    const dist = Math.hypot(p1.x - p0.x, p1.z - p0.z);
    return { t80: r3(t80), dist: r3(dist), move: r3(s.spent.move), push: r3(s.spent.push), tired: r3(tired), tradition: f.swordArt?.tradition, state: f.state };
  } finally {
    g.world.free();
  }
}

// ── 지침 단계별 걷는 빠르기 · 박차기 (이동 × 0.7 · × 0.5 가 우리 걸음 빠르기·빠른 걸음 위에 곱해지나) ──
//  기력을 단계 값(정상 100 · 지침 −10 · 심한 지침 −35)에 묶고 서 있다가 스틱 끝으로 3 s: 마지막 1 s 평균 골반 빠르기 · 처음 0.3 s 에 간 거리(뒤 = 독일 첫 걸음 박차기 · 옆 = 이베리아)
function speedAt(weapon, stick, level) {
  const g = newRound({ weapon, seed: 51, walls: false });
  try {
    g.park();
    const f = g.player;
    for (let i = 0; i < 300; i++) g.step();
    const s = fresh(f);
    const pin = () => {
      s.value = level === 2 ? STAMINA.severeAt - 15 : level === 1 ? -10 : 100; // 심한 지침 −55(10/16 문턱 −40 · 탈진 −80 — 전 −35): 박차기 12 를 내도 탈진에 안 닿게
      s.level = level;
    };
    const p0 = { ...f.bodies.pelvis.translation() };
    let p03 = null;
    let p2 = null;
    let bursts = 0;
    for (let i = 0; i < 3 / DT; i++) {
      pin();
      f.move.set(stick[0], stick[1]);
      g.step();
      if (f.gait?.fastK > 1) bursts = Math.max(bursts, f.gait.fastK);
      if (i === Math.round(0.3 / DT) - 1) p03 = { ...f.bodies.pelvis.translation() };
      if (i === Math.round(2 / DT) - 1) p2 = { ...f.bodies.pelvis.translation() };
    }
    const p3 = f.bodies.pelvis.translation();
    return { v: r3(Math.hypot(p3.x - p2.x, p3.z - p2.z)), d03: r3(Math.hypot(p03.x - p0.x, p03.z - p0.z)), fastK: r3(bursts), speedMul: s.speed };
  } finally {
    g.world.free();
  }
}

if (want.includes('cuts')) {
  solo('롱소드 0.5 s 마다 베기', 'longsword', every(0.5), 30);
  solo('츠바이핸더 0.7 s 마다 베기', 'zweihander', every(0.7), 30);
  solo('청강검(한손 칼) 0.5 s 마다 베기', 'qinggang', every(0.5), 30);
  solo('롱소드 1 s 마다 베기', 'longsword', every(1), 60);
}
if (want.includes('burst')) solo('롱소드 몰아치기 3 번 + 1.5 s 쉼', 'longsword', burst3, 60);
if (want.includes('thrust')) solo('레이피어 0.5 s 마다 탭 찌르기', 'rapier', every(0.5), 70, 'thrust');
if (want.includes('trade')) versus('주고받기 (상대 1.2 s 마다 · 막고 받아 베기)', 'trade', 40);
if (want.includes('hold')) versus('막기 단추 계속 누름 (상대 1.2 s 마다)', 'hold', 180);
if (want.includes('timed')) versus('칠 때만 맞춰 막기 (상대 1.2 s 마다)', 'timed', 60);
for (const r of rows) console.log(JSON.stringify(r));
if (want.includes('walk')) {
  const sticks = { 서기: [0, 0], 앞: [0, 1], 뒤: [0, -1], 옆: [1, 0] };
  for (const start of ['normal', 'exhaust']) {
    for (const weapon of ['longsword', 'uchigatana', 'qinggang']) {
      const out = {};
      for (const [k, st] of Object.entries(sticks)) out[k] = walk(weapon, st, start);
      console.log(JSON.stringify({ row: start === 'normal' ? '걸으며 회복 0 → 80 (정상 단계에서)' : '걸으며 회복 0 → 80 (탈진 끝 — 지침 단계에서)', weapon, tradition: out.서기.tradition, ...Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { t80: v.t80, dist: v.dist, move: v.move, push: v.push, tired: v.tired }])) }));
    }
  }
}
if (want.includes('speed')) {
  for (const [weapon, sticks] of [['longsword', { 앞: [0, 1], 뒤: [0, -1], 옆: [1, 0] }], ['zweihander', { 옆: [1, 0] }], ['rapier', { 앞: [0, 1] }]]) {
    for (const [k, st] of Object.entries(sticks)) {
      const r = {};
      for (const level of [0, 1, 2]) r[['정상', '지침', '심한 지침'][level]] = speedAt(weapon, st, level);
      console.log(JSON.stringify({ row: '단계별 걷기 빠르기 (마지막 1 s m/s · 처음 0.3 s m · 빠른 걸음 fastK)', weapon, stick: k, ...r }));
    }
  }
}
console.log(`(기력 회복 사람 ${STAMINA.playerRecoverPerSecond}/s · AI ${STAMINA.recoverPerSecond}/s — ${STAMINA.on ? '켬' : '끔'})`);

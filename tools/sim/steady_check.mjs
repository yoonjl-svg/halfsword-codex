// steady_check.mjs — 일본 보법 '버티기' 시험 (사장님 결정 10/15 '휘청·넘어짐 저항', 흔들림 × 0.75 — fighter.js swayScale · docs/strike/japanese_steady_2026-10-15.md)
//  읽기만 한다: 켬·끔은 CONFIG.BALANCE.schoolSteady 만 바꾸고, 넘어짐 까닭은 Fighter 의 knockDown·applyWound·updateState 를 감싸 적기만 한다(값·호출 순서·난수 그대로).
//
//  node tools/sim/steady_check.mjs shake [--who=jp,jpoff,de] [--kinds=push-chest,push-shoulder,hit-chest,hit-shoulder,hit2-chest] [--push=160,200,…] [--hit=120,160,…] [--hit2=100,120,…] [--json]
//   흔들기: 가만히 선 사람(플레이어 자리 — 사람 걸음 값, 상대는 멀리 치움)이 1.5 s 선 뒤 같은 크기의 밀침·맞음을 받는다.
//    jp = 우치가타나(일본, 켬) · jpoff = 우치가타나(일본, ?jpSteady=0) · de = 롱소드(독일 — 유파 걸음 칸 없음)
//    밀침(push-*) = 수평 충격 J N·s 를 0.2 s 동안 고르게 · 맞음(hit-*) = 한 스텝 충격 E/12 N·s + 같은 판정 에너지 E J 의 둔타 상처(applyWound — 휘청임 게이지가 깎인다)
//    · 두 번 맞음(hit2-*) = 같은 맞음을 0.4 s 사이로 두 번 (실제 판의 연타 꼴 — 게이지가 그 사이 22/s 로 차오름)
//    자리: *-chest = 가슴 몸체 한가운데 · *-shoulder = 칼 쪽 어깨 자리(가슴 몸체 기준 위 0.1 · 옆 0.2 m — config ARM.shoulder)에 비틀림까지
//    방향 여덟(앞에서 · 앞오른쪽 … 45° 마다 — '앞에서' = 앞에서 밀려 뒤로) = 세기마다 8 번. 밀친 뒤 6 s 지켜봄(다시 서면 일찍 끝)
//   잰 것: offBalance 최고(게임이 보는 값 · 몸 그대로 = ÷ swayScale) · 휘청 시간(offBalance > GAIT.hurryFrom — gait_metrics 와 같은 정의) ·
//    붙잡기 반사 시간(gait.levC > 0.3) · 다시 선 때(서 있고 offBalance 0 · levC ≤ 0.3 이 0.5 s 이어진 첫 때, 밀기 시작부터 — 넘어졌으면 일어선 뒤) ·
//    넘어짐(서 있다 → down·getup)과 그 까닭(gauge = 휘청임 게이지 ≤ 0 · footing = 발 디딤 잃음 · tilt = 기울기 · head = 머리 맞아 주저앉음 · legs · sever)
//
//  node tools/sim/steady_check.mjs fights [--seeds=1,2,3] [--secs=40] [--sides=1|2] [--json]
//   AI 판: 우치가타나 AI(인물 꾸러미 = uchigatana) 대 롱소드 AI — gait_metrics.mjs 와 같은 판 꼴(벽, 보통 난이도, 씨앗 1000+s · 자리 바꾸면 2000+s). 켬·끔 같은 씨앗.
//   잰 것(양쪽): 선 시간 · 휘청 시간 비율 · 붙잡기 반사 비율 · 넘어짐 수와 까닭 · 머리 맞아 주저앉음 수(대상 밖 — 길은 그대로, 판이 갈라져 수만 흔들림) · 받은 상처 · 승패
import { newRound, DT, THREE, CONFIG, AI } from './harness_m.mjs';
import { Fighter } from '../../src/fighter.js';

const { GAIT, BALANCE, BODY, ARM } = CONFIG;
const argv = process.argv.slice(2);
const mode = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'shake';
const opt = (k, d) => {
  const a = argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const list = (k, d) => opt(k, d).split(',').filter(Boolean);
const JSON_OUT = argv.includes('--json');
const r2 = (x) => (x == null || Number.isNaN(x) ? x : +x.toFixed(2));
const r3 = (x) => (x == null || Number.isNaN(x) ? x : +x.toFixed(3));

// ── 넘어짐 까닭 적기 (감싸기만 — 원래 함수를 같은 인자로 부른다) ──
const _q = new THREE.Quaternion();
const _u = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
/** updateState 의 fallTilt 와 같은 식(가슴 기울기 − 일부러 숙인 몫) — fighter 의 임시 벡터를 쓰지 않는다 */
function fallTiltOf(f) {
  const r = f.bodies.chest.rotation();
  _u.set(0, 1, 0).applyQuaternion(_q.set(r.x, r.y, r.z, r.w));
  return THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(_u.dot(f.anchorUp || UP), -1, 1))) - THREE.MathUtils.radToDeg(f.hunch || 0);
}
const P0 = Fighter.prototype;
const origKD = P0.knockDown;
const origUS = P0.updateState;
const origAW = P0.applyWound;
P0.updateState = function (dt) {
  this._kdCtx = 'state';
  try { return origUS.call(this, dt); } finally { this._kdCtx = null; }
};
P0.applyWound = function (h) {
  const c = this._kdCtx;
  this._kdCtx = 'wound';
  // 머리 맞아 주저앉음 문턱을 넘는 서 있을 때의 머리·목 둔타 수 (applyWound 의 그 줄과 같은 조건: 살을 못 가름 · 에너지 × 투구 몫 > 45) — 길이 그대로인지 보려고
  if (this._headLog && this.state === 'stand' && !this.revival && (h.zone === 'head' || h.zone === 'neck') && !(h.type !== 'blunt' && h.severity > 0) && h.energy * (h.helmet ? h.helmetBlunt : 1) > 45) this._headLog.push(G_T());
  try { return origAW.call(this, h); } finally { this._kdCtx = c; }
};
let G_T = () => 0;
P0.knockDown = function (heavy = true) {
  const before = this.state;
  let cause = null;
  if (this._kdLog && (before === 'stand' || (heavy && (before === 'getup' || before === 'kneel')))) {
    const ctx = this._kdCtx;
    if (ctx === 'state') {
      const fl = [];
      if (this.balance <= 0) fl.push('gauge');
      if (this.offBalanceTime > BALANCE.fallDelay) fl.push('footing');
      if (fallTiltOf(this) > BODY.fallTiltDeg) fl.push('tilt');
      if (!fl.length && this.legsCannotSupport) fl.push('legs');
      cause = fl.join('+') || 'state?';
    } else if (ctx === 'wound') cause = this.missingLeg ? 'sever' : 'head';
    else cause = this.legsCannotSupport ? 'legs' : 'other';
  }
  const r = origKD.call(this, heavy);
  if (cause && this.state !== before) this._kdLog.push({ t: this._kdClock ? this._kdClock() : 0, cause, from: before, heavy });
  return r;
};

// ── 흔들기 ──
const WHO = {
  jp: { weapon: 'uchigatana', steady: 1, name: '일본 켬(우치가타나)' },
  jpoff: { weapon: 'uchigatana', steady: 0, name: '일본 끔(우치가타나)' },
  de: { weapon: 'longsword', steady: 1, name: '독일(롱소드)' },
};
const SETTLE = 1.5; // 밀기 전에 서 있는 시간(s, 판 시작부터)
const PUSH_T = 0.2; // 밀침이 이어지는 시간(s)
const HIT2_GAP = 0.4; // hit2-*: 두 맞음 사이(s)
const WATCH = 6; // 밀기 시작부터 지켜보는 시간(s)
const CALM = 0.5; // '다시 섬' = 이만큼(s) 이어서 서 있고 흔들림 없음
const DIRS = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4); // 0 = 앞에서(뒤로 밀림), π/2 = 오른쪽에서 …

function shakeTrial(who, kind, level, dirIdx) {
  const W = WHO[who];
  BALANCE.schoolSteady = W.steady;
  const G = newRound({ seed: 1, walls: false, gap: 4, weapon: W.weapon, weapon2: 'longsword' });
  G.park();
  const P = G.player;
  P._kdLog = [];
  P._kdClock = () => G.t;
  const hit = kind.startsWith('hit');
  const hitAt = kind.startsWith('hit2') ? [0, HIT2_GAP] : [0]; // hit2-* = 같은 맞음 두 번(HIT2_GAP s 사이 — 게이지가 그동안 차오름)
  const atShoulder = kind.endsWith('shoulder');
  const J = hit ? level / 12 : level; // 맞음: 한 스텝 충격 = E/12 N·s (판정 에너지 E 의 칼 한 번 — 가늠값), 밀침: J N·s
  const fwd = new THREE.Vector3();
  const rgt = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const pt = new THREE.Vector3();
  let t0 = null;
  const rec = { who, kind, level, dir: dirIdx, offMax: 0, rawMax: 0, wobT: 0, catchT: 0, fell: false, cause: null, heavy: null, settleT: null, standAgainT: null, swayScale: null };
  G.before = (t) => {
    if (t0 == null) {
      if (t < SETTLE - 1e-9) return;
      t0 = t;
      P.forward(fwd);
      P.right(rgt);
      const a = DIRS[dirIdx];
      // 앞에서 미는 힘은 뒤쪽(−앞)으로: 방향 a 에서 오는 힘 = −(앞·cos a + 오른쪽·sin a)
      dir.copy(fwd).multiplyScalar(-Math.cos(a)).addScaledVector(rgt, -Math.sin(a)).setY(0).normalize();
      rec.swayScale = P.swayScale ?? 1;
    }
    let dtIn = t - t0;
    if (hit) {
      const k = hitAt.findIndex((h) => Math.abs(dtIn - h) < DT * 0.5);
      if (k < 0) return;
      dtIn = 0;
    }
    const steps = hit ? 1 : Math.round(PUSH_T / DT);
    if (dtIn > (steps - 0.5) * DT) return;
    const j = J / steps;
    const chest = P.bodies.chest;
    if (atShoulder) {
      const c = chest.translation();
      const r = chest.rotation();
      pt.set(ARM.shoulder[0], ARM.shoulder[1], ARM.shoulder[2] * P.side).applyQuaternion(_q.set(r.x, r.y, r.z, r.w)).add(_u.set(c.x, c.y, c.z));
      chest.applyImpulseAtPoint({ x: dir.x * j, y: 0, z: dir.z * j }, { x: pt.x, y: pt.y, z: pt.z }, true);
    } else chest.applyImpulse({ x: dir.x * j, y: 0, z: dir.z * j }, true);
    if (hit && dtIn < DT * 0.5) {
      // 같은 판정 에너지의 둔타 상처: 아픔·휘청임 게이지·옷만 (가슴 = 가슴 · 어깨 = 칼 팔 위팔). 판금·투구 없음
      const part = atShoulder ? 'uarmS' : 'chest';
      P.applyWound({ part, zone: atShoulder ? 'arm' : 'chest', type: 'blunt', severity: 0, energy: level, local: new THREE.Vector3(), dir: dir.clone(), helmet: false, plate: false });
    }
  };
  let calm = 0;
  let prev = P.state;
  while (true) {
    G.step();
    if (t0 == null) { prev = P.state; continue; }
    const dtIn = G.t - t0;
    const sc = P.swayScale ?? 1;
    const off = P.offBalance;
    rec.offMax = Math.max(rec.offMax, off);
    rec.rawMax = Math.max(rec.rawMax, off / sc);
    const g = P.gait;
    if (P.state === 'stand' && off > GAIT.hurryFrom) rec.wobT += DT;
    if (g?.active && P.state === 'stand' && g.levC > 0.3) rec.catchT += DT;
    if (prev === 'stand' && (P.state === 'down' || P.state === 'getup') && !rec.fell) {
      rec.fell = true;
      const k = P._kdLog[P._kdLog.length - 1];
      rec.cause = k?.cause ?? '?';
      rec.heavy = P.state === 'down';
    }
    if (rec.fell && rec.standAgainT == null && P.state === 'stand') rec.standAgainT = dtIn;
    const quiet = P.state === 'stand' && off === 0 && !(g?.levC > 0.3);
    calm = quiet ? calm + DT : 0;
    if (rec.settleT == null && calm >= CALM - 1e-9 && dtIn > (hit ? hitAt[hitAt.length - 1] + 0.1 : PUSH_T)) rec.settleT = dtIn - calm;
    prev = P.state;
    if (rec.settleT != null || dtIn >= WATCH) break;
  }
  BALANCE.schoolSteady = 1;
  return rec;
}

function runShake() {
  const whos = list('who', 'jp,jpoff,de');
  const kinds = list('kinds', 'push-chest,push-shoulder,hit-chest,hit-shoulder,hit2-chest');
  const pushL = list('push', '60,80,100,120,140,160,180').map(Number);
  const hitL = list('hit', '120,160,200,240,280,320').map(Number);
  const hit2L = list('hit2', '100,120,140,160,180').map(Number);
  const rows = [];
  for (const kind of kinds) {
    const levels = kind.startsWith('hit2') ? hit2L : kind.startsWith('hit') ? hitL : pushL;
    for (const level of levels) {
      for (const who of whos) {
        const rs = DIRS.map((_, i) => shakeTrial(who, kind, level, i));
        if (JSON_OUT) for (const r of rs) console.log(JSON.stringify(r));
        const n = rs.length;
        const mean = (f) => rs.reduce((s, r) => s + f(r), 0) / n;
        const settled = rs.filter((r) => r.settleT != null);
        const fallsBy = {};
        for (const r of rs) if (r.fell) fallsBy[r.cause] = (fallsBy[r.cause] || 0) + 1;
        const row = {
          kind, level, who, n,
          falls: rs.filter((r) => r.fell).length,
          heavy: rs.filter((r) => r.fell && r.heavy).length,
          causes: Object.entries(fallsBy).map(([k, v]) => `${k}${v}`).join(' ') || '-',
          offMax: r3(mean((r) => r.offMax)),
          rawMax: r3(mean((r) => r.rawMax)),
          wobT: r2(mean((r) => r.wobT)),
          catchT: r2(mean((r) => r.catchT)),
          settleT: settled.length ? r2(settled.reduce((s, r) => s + r.settleT, 0) / settled.length) : null,
          unsettled: n - settled.length,
          standAgainT: rs.some((r) => r.standAgainT != null) ? r2(rs.filter((r) => r.standAgainT != null).reduce((s, r) => s + r.standAgainT, 0) / rs.filter((r) => r.standAgainT != null).length) : null,
          sway: rs[0].swayScale,
        };
        rows.push(row);
        if (!JSON_OUT) console.log(`${kind.padEnd(13)} ${String(level).padStart(4)} ${who.padEnd(5)} 넘어짐 ${row.falls}/${n} (크게 ${row.heavy}, ${row.causes}) · offBalance 최고 ${row.offMax} (몸 ${row.rawMax}) · 휘청 ${row.wobT} s · 붙잡기 ${row.catchT} s · 다시 섬 ${row.settleT ?? '-'} s${row.unsettled ? ` (6 s 안에 못 섬 ${row.unsettled})` : ''}${row.standAgainT != null ? ` · 넘어진 뒤 일어섬 ${row.standAgainT} s` : ''} · 배율 ${row.sway}`);
      }
    }
  }
  if (JSON_OUT) console.log(JSON.stringify({ summary: rows }));
}

// ── AI 판 ──
function fight(seed, xFirst, on, secs) {
  BALANCE.schoolSteady = on ? 1 : 0;
  const x = { weapon: 'uchigatana', persona: { school: 'uchigatana' } };
  const y = { weapon: 'longsword', persona: { school: 'longsword' } };
  const Pp = xFirst ? x : y;
  const Ep = xFirst ? y : x;
  const G = newRound({ walls: true, seed, weapon: Pp.weapon, weapon2: Ep.weapon, difficulty: 'normal', persona: Ep.persona, AI2Class: AI, difficulty2: 'normal', persona2: Pp.persona });
  const X = xFirst ? G.player : G.enemy;
  const Y = xFirst ? G.enemy : G.player;
  const side = (f) => ({ f, standT: 0, wobT: 0, catchT: 0, falls: [], hits: 0, hitE: 0, maxE: 0 });
  const S = { X: side(X), Y: side(Y) };
  for (const k of ['X', 'Y']) {
    S[k].f._kdLog = [];
    S[k].f._headLog = [];
    S[k].f._kdClock = () => G.t;
  }
  G_T = () => G.t;
  G.onWound = (att, vic, r) => {
    const s = vic === X ? S.X : vic === Y ? S.Y : null;
    if (!s) return;
    s.hits++;
    s.hitE += r.energy;
    s.maxE = Math.max(s.maxE, r.energy);
  };
  let tDead = null;
  for (let i = 0; i < secs / DT; i++) {
    G.step();
    for (const k of ['X', 'Y']) {
      const s = S[k];
      const f = s.f;
      if (f.state !== 'stand' || !f.gait?.active) continue;
      s.standT += DT;
      if (f.offBalance > GAIT.hurryFrom) s.wobT += DT;
      if (f.gait.levC > 0.3) s.catchT += DT;
    }
    if (tDead == null && (X.state === 'dead' || Y.state === 'dead')) tDead = G.t;
  }
  const res = X.state === 'dead' && Y.state !== 'dead' ? 'L' : Y.state === 'dead' && X.state !== 'dead' ? 'W' : 'D';
  const out = { seed, xFirst, on, res, tDead: tDead == null ? null : r2(tDead), xSway: X.swayScale, xTrad: X.swordArt.tradition };
  for (const k of ['X', 'Y']) {
    const s = S[k];
    out[k] = { standT: r2(s.standT), wobT: r2(s.wobT), catchT: r2(s.catchT), falls: s.f._kdLog.map((e) => e.cause), headStand: s.f._kdLog.filter((e) => e.cause === 'head' && e.from === 'stand').length, headElig: s.f._headLog.length, hits: s.hits, maxE: Math.round(s.maxE) };
  }
  BALANCE.schoolSteady = 1;
  return out;
}

function runFights() {
  const seeds = list('seeds', '1,2,3').map(Number);
  const secs = +opt('secs', '40');
  const sides = +opt('sides', '1');
  const all = [];
  for (const on of [true, false]) {
    for (const s of seeds) {
      for (const xFirst of sides === 2 ? [true, false] : [true]) {
        const r = fight((xFirst ? 1000 : 2000) + s, xFirst, on, secs);
        all.push(r);
        if (JSON_OUT) console.log(JSON.stringify(r));
        else console.log(`${on ? '켬' : '끔'} 씨앗 ${(xFirst ? 1000 : 2000) + s} 일본 ${xFirst ? 'P' : 'E'} 자리(${r.xTrad} 배율 ${r.xSway}) ${r.res}${r.tDead != null ? '@' + r.tDead : ''} · 일본 선 ${r.X.standT} s 휘청 ${r.X.wobT} 붙잡기 ${r.X.catchT} 넘어짐 [${r.X.falls.join(',')}] 맞음 ${r.X.hits}(최고 ${r.X.maxE} J) · 독일 선 ${r.Y.standT} s 휘청 ${r.Y.wobT} 붙잡기 ${r.Y.catchT} 넘어짐 [${r.Y.falls.join(',')}] 맞음 ${r.Y.hits}(최고 ${r.Y.maxE} J)`);
      }
    }
  }
  for (const on of [true, false]) {
    const rs = all.filter((r) => r.on === on);
    for (const k of ['X', 'Y']) {
      const sum = (f) => rs.reduce((s, r) => s + f(r[k]), 0);
      const st = sum((x) => x.standT);
      const falls = rs.flatMap((r) => r[k].falls);
      const by = {};
      for (const c of falls) by[c] = (by[c] || 0) + 1;
      const balance = falls.filter((c) => /gauge|footing|tilt/.test(c)).length;
      console.log(`합 ${on ? '켬' : '끔'} ${k === 'X' ? '일본' : '독일'} ${rs.length} 판: 선 ${st.toFixed(1)} s · 휘청 ${(100 * sum((x) => x.wobT) / st).toFixed(2)} % · 붙잡기 ${(100 * sum((x) => x.catchT) / st).toFixed(2)} % · 넘어짐 ${falls.length} (균형 ${balance} · 머리 ${by.head || 0} — 서서 머리 맞아 주저앉음 ${sum((x) => x.headStand)} / 그 문턱을 넘은 서서 머리 둔타 ${sum((x) => x.headElig)}) · 맞음 ${sum((x) => x.hits)} [${Object.entries(by).map(([c, v]) => `${c} ${v}`).join(' · ')}] · 승패 ${rs.filter((r) => r.res === (k === 'X' ? 'W' : 'L')).length}승 ${rs.filter((r) => r.res === (k === 'X' ? 'L' : 'W')).length}패 ${rs.filter((r) => r.res === 'D').length}무`);
    }
  }
}

if (mode === 'shake') runShake();
else if (mode === 'fights') runFights();
else console.log('모드: shake | fights');

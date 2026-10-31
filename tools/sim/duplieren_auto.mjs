// ─────────────────────────────────────────────────────────────
//  duplieren_auto.mjs — 겹치기 자동 재기 (사장님 10/31 16:xx '겹치기는 추가 커맨드 없이 일정 조건 충족하면 자동으로 나가게 하자 …' — 기록 docs/strike/duplieren_auto_2026-10-31.md) · 재기만
//   사람 몸(독일 무기 — 스킬트리 독일 고유 공격 셋 다 익힘) 손가락 봇 대 치고 막는 AI(숙련 3 · 반응 0.22 s). 봇 셋:
//    normal  = 안 노리는 손 (special_balance.mjs fight 'german' 줄 손 그대로 — 칠 때 반은 분노의 베기 · 15 % 탭 · 나머지 다른 긋기 · 상대가 치면 반은 맞받아 긋기 · 반은 막기 단추)
//    press   = 노리는 손 (띠 가운데 거리를 지키며 상대 칼을 가로지르는 긋기 → 닿으면 그 긋기 쪽으로 느리게(0.6 패드 m/s — 휘두르기 문턱 아래) 0.25 m 밀고 쥠 · 떨어지면 0.15 ~ 0.35 s 뒤 다시)
//    clash   = 노리는 손 (같은 거리 · 닿으면 곧 반대쪽 긋기로 한 번 더 부딪침 — 'clash2' 용)
//   겹치기 자동 판(UNIQUE_ASSIST.dupAuto)은 --set='{"dupAuto":"bind","dupStackS":…}' (초는 실제 초 — 여기서 realS 로 바꿈).
//  node tools/sim/duplieren_auto.mjs run [--bot=normal|press|clash] [--weapons=longsword,sabre,kriegsmesser] [--opps=longsword,uchigatana,zweihander,rapier] [--seeds=901,902,903]
//        [--dur=30] [--set=JSON] [--band=0.8,1.4] [--log=파일(스텝 기록 — sweep 용)] [--json=파일]
//  node tools/sim/duplieren_auto.mjs sweep <log…>   (열린 고리 — 기록된 판에서 조건 값 묶음마다 '냈을' 수 · 그때 상태 · 겹치기가 판을 안 바꾼다고 침)
//  node tools/sim/duplieren_auto.mjs agg <json…>    (닫힌 고리 결과 표)
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { applyWeaponMeasure } from './weapon_measures.mjs';
import { PlayerUniqueAssist, PLAYER_UNIQUE, strokeTechOf } from '../../src/unique_assist.js';
import { TECH, TECH_BY_NAME } from '../../src/ai_techniques.js';
import { MEASURED } from '../../src/weapon_measured.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { iaiBusy } from '../../src/secret_instant.js';
import { fingerBot, rng, stepIn, freshOutcome } from './special_balance.mjs';
import { isMain } from './is_main.mjs';

const UA = CONFIG.UNIQUE_ASSIST;
const STD = CONFIG.TIME.k; // 실제 초 → 게임 초
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const q = (a, p) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? r3(s[Math.min(s.length - 1, Math.floor(p * s.length))]) : null; };
const T = (n) => ({ from: TECH_BY_NAME[n].from, path: TECH_BY_NAME[n].path });
const MORD_N = CONFIG.SECRET.mordCloseN ?? 0.8;
const MORD_NEED = CONFIG.SECRET.mordPress; // 게임 초 (realS 2.0)
const MORD_GRACE = CONFIG.SECRET.mordGrace; // 게임 초 (realS 0.4)
// 상태 비트 (스텝 기록)
export const B = { cool: 1, iai: 2, sec: 4, notStand: 8, notArmed: 16, parry: 32, hand: 64, swing: 128, tapBusy: 256, back: 512, foeAtk: 1024, newStroke: 2048, exhausted: 4096 };
const ENG = ['zornhau', 'zornhauL', 'zwerch', 'zwerchL', 'oberhau'].map(T); // 노리는 손이 상대 칼을 가로지르는 긋기
const MIRROR = { 0: 1, 1: 0, 2: 3, 3: 2, 4: 0 };

/** 실제 초로 적은 --set 을 게임 값으로 (초 칸만) */
export function applySet(set) {
  const sec = new Set(['dupStackS', 'dupStackGap', 'dupClashT', 'dupClashGap', 'specialCooldown']);
  for (const [k, v] of Object.entries(set ?? {})) UA[k] = sec.has(k) && typeof v === 'number' ? v * STD : v;
}

/** 한 판 */
export function fight({ bot: botKind = 'normal', weapon = 'longsword', opp = 'longsword', seed = 901, dur = 30, prof = 3, delay = 0.22, band = [MORD_N, 1.4], log = false, probe = null } = {}) {
  const G = newRound({ walls: true, seed, weapon, weapon2: opp, persona: { proficiency: prof } });
  applyWeaponMeasure(G.ai, opp);
  const P = G.player;
  const A = G.enemy;
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  const guard = new PlayerParryGuard(P, A);
  P.stamina.controller = guard;
  const uq = new PlayerUniqueAssist(P, { names: new Set(PLAYER_UNIQUE.german.map((e) => e.name)) });
  if (!uq.dupE) throw new Error(`${weapon}: 겹치기가 안 열림 (독일 무기가 아님?)`);
  const rnd = rng(seed * 7919 + 220 + weapon.length * 31 + opp.length);
  const bot = fingerBot(G, P, rnd, { sjit: 0.06, jit: 0.04, spd: [3, 5.5] });
  const [CONTACT, REACH] = MEASURED[weapon] ?? MEASURED.longsword;
  const OTHER = TECH.filter((t) => t.name !== 'zornhau').map((t) => ({ from: t.from, path: t.path }));
  const dT = (band[0] + band[1]) / 2; // 노리는 손이 지키는 가슴 사이
  let nextAtk = 2.6;
  let due = Infinity;
  let heldUntil = 0;
  let lastMotion = -1;
  let notice = false;
  // 노리는 손 상태
  const D = { st: 'free', strokeI: 0, lastTouch: -9, dir: [0, 0], pressT: 0 };
  const startEngage = (t) => {
    const i = botKind === 'clash' && D.st === 'again' ? MIRROR[D.strokeI] : Math.floor(rnd() * ENG.length);
    D.strokeI = i;
    bot.queue = bot.make([ENG[i]], { v: 3.5 + rnd() * 1.5 });
    const p = ENG[i].path;
    const a = p.length > 1 ? p[p.length - 2] : ENG[i].from;
    const b = p[p.length - 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    D.dir = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    D.st = 'engage';
    D.t0 = t;
  };
  const pressFrames = () => {
    const FR = 2 * DT;
    const v = 0.6;
    const n = Math.round(0.25 / (v * FR));
    return [...Array(n).fill([D.dir[0] * v * FR, D.dir[1] * v * FR, true]), ...Array(Math.round(3 / FR)).fill([0, 0, true])];
  };
  // 재기
  const S = { steps: 0, touchSteps: 0, fires: [], log: log ? { t: [], d: [], touch: [], bits: [] } : null, recv: [], mordWin: 0, mordT: 0, mordHeld: 0, mordOff: 0, prevCur: null };
  const fireRec = { cur: null };
  let firedSeen = 0;
  G.before = () => {
    const t = G.t;
    const dist = P.foeDistance();
    const touch = uq.bladeTouch();
    const motion = A.armed && dist < 2.2 && Math.hypot(A.hitPointVel.x, A.hitPointVel.y, A.hitPointVel.z) > 2.5;
    if (botKind === 'normal') {
      if (motion) {
        lastMotion = t;
        if (!notice && !guard.held && due === Infinity && !bot.queue.length) {
          due = t + delay + rnd() * 0.1;
          notice = true;
        }
      } else if (t - lastMotion > 0.3) notice = false;
      if (t >= due) {
        due = Infinity;
        if (P.armed && !P.stamina.exhausted && rnd() < 0.5) {
          bot.queue = bot.make([T('zornhau')]);
          nextAtk = t + 1.0 + rnd() * 0.6;
        } else heldUntil = t + 0.6 + rnd() * 0.4;
      }
      guard.held = t < heldUntil && !bot.queue.length && !P.skill.tap;
      guard.broken = !!(P.skill.tap || P.skill.pom || bot.queue.length);
      if (!guard.held && !bot.queue.length && t >= nextAtk && dist < REACH && P.alive && P.armed && !P.stamina.exhausted) {
        if (rnd() < 0.5) bot.queue = bot.make([T('zornhau')]);
        else if (rnd() < 0.15) P.skill.thrust();
        else bot.queue = bot.make([OTHER[Math.floor(rnd() * OTHER.length)]], { back: rnd() < 0.3 });
        nextAtk = t + 1.0 + rnd() * 0.6;
      }
      guard.step(DT);
      P.inputActive = guard.active;
      bot.feed();
      const fwd = stepIn(P, dist, bot.queue.length, t >= nextAtk && !guard.held, CONTACT, REACH, REACH);
      P.move.set(0.18 * Math.sin(t * 0.65 + seed), fwd);
    } else if (botKind === 'mord') {
      // 죽음의 일격을 노리는 손 (붙어 미는 봇 꼴): 칼은 긴 자세에 둔 채 가슴 사이 0.55 m 까지 걸어 들어가 계속 밂 · 치지 · 막지 않음 — 들어가는 길에 띠(0.8 ~ 위 끝)를 지나며 겹치기가 끼어드나
      guard.held = false;
      guard.broken = false;
      guard.step(DT);
      P.inputActive = guard.active;
      bot.feed();
      P.move.set(0, P.stamina.exhausted || !P.alive ? 0 : dist > 0.55 ? 0.6 : 0.3);
    } else {
      // 노리는 손 (press · clash)
      if (touch) D.lastTouch = t;
      if (D.st === 'engage' && touch) {
        if (botKind === 'press') {
          bot.queue = pressFrames();
          D.st = 'press';
        } else {
          D.st = 'hit'; // 긋기는 끝까지 · 끝나면 곧 반대쪽
        }
      }
      if (D.st === 'engage' && !bot.queue.length) (D.st = 'free'), (nextAtk = t + 0.1 + rnd() * 0.2);
      if (D.st === 'hit' && !bot.queue.length) (D.st = 'again'), (nextAtk = t + 0.05 + rnd() * 0.15);
      if (D.st === 'press' && t - D.lastTouch > 0.3 * STD) (D.st = 'free'), (bot.queue = []), (nextAtk = t + (0.15 + rnd() * 0.2) * STD);
      if (motion && D.st !== 'press') {
        lastMotion = t;
        if (!notice && !guard.held && due === Infinity) {
          due = t + delay + rnd() * 0.1;
          notice = true;
        }
      } else if (t - lastMotion > 0.3) notice = false;
      if (t >= due) {
        due = Infinity;
        if (P.armed && !P.stamina.exhausted && rnd() < 0.5 && D.st !== 'press') startEngage(t); // 맞받아 상대 칼로
        else if (D.st !== 'press') heldUntil = t + 0.6 + rnd() * 0.4;
      }
      guard.held = t < heldUntil && !bot.queue.length && !P.skill.tap;
      guard.broken = !!(P.skill.tap || P.skill.pom || bot.queue.length);
      if ((D.st === 'free' || D.st === 'again') && !guard.held && t >= nextAtk && dist < REACH + 0.2 && P.alive && P.armed && !P.stamina.exhausted) startEngage(t);
      guard.step(DT);
      P.inputActive = guard.active;
      bot.feed();
      const lo = Math.max(band[0] + 0.08, dT - 0.15);
      const fwd = P.stamina.exhausted || !P.alive ? 0 : dist > dT + 0.12 ? 0.55 : dist < lo ? -0.55 : 0;
      P.move.set(0, fwd);
    }
    P.stickX = P.move.x;
    P.stickY = P.move.y;
    // main.js 와 같은 막기 단추 알림 (feed 의 blocked · handHeld — 봇 feed 는 늘 거짓으로 부름)
    uq.blocked = !!guard.held;
    uq.handHeld = !!(guard.held && !guard.broken);
    // ── 재기 ──
    S.steps++;
    if (touch) S.touchSteps++;
    const both = P.state === 'stand' && A.state === 'stand' && A.alive && P.alive;
    // 죽음의 일격 셈 (사람 'close' 판 secret.js pressTick 과 같은 틀 — 창은 실제로 안 엶 · 셈만)
    const close = both && dist <= MORD_N;
    if (close) (S.mordOff = 0), (S.mordT += DT), (S.mordHeld += DT);
    else if (S.mordHeld > 0 && (S.mordOff += DT) <= MORD_GRACE) {
      /* 너그러움 */
    } else S.mordT = S.mordHeld = S.mordOff = 0;
    if (S.mordT >= MORD_NEED) (S.mordWin++), (S.mordT = 0);
    let bits = 0;
    if (uq.cooling(uq.dupE)) bits |= B.cool;
    if (iaiBusy(P)) bits |= B.iai;
    if (P.skill.sec) bits |= B.sec;
    if (!both) bits |= B.notStand;
    if (!P.armed || !A.armed || P.weaponBroken) bits |= B.notArmed;
    if (P.stamina.exhausted) bits |= B.exhausted;
    if (guard.held) bits |= B.parry;
    if (guard.held && !guard.broken) bits |= B.hand;
    if (P.skill.inputSwinging) bits |= B.swing;
    if (P.skill.tap || P.skill.pom || P.skill.vitalRange) bits |= B.tapBusy;
    if (-(P.stickY ?? 0) >= 0.5) bits |= B.back;
    if (G.ai?.mode === 'attack') bits |= B.foeAtk;
    if (uq.cur && uq.cur !== S.prevCur) bits |= B.newStroke;
    S.prevCur = uq.cur;
    if (S.log) {
      S.log.t.push(+t.toFixed(4));
      S.log.d.push(+dist.toFixed(3));
      S.log.touch.push(touch ? 1 : 0);
      S.log.bits.push(bits);
    }
    // 낸 겹치기
    const fNow = uq.stats.fired?.duplieren ?? 0;
    if (fNow > firedSeen) {
      firedSeen = fNow;
      fireRec.cur = { t, d0: r3(dist), bits, mordT: r3(S.mordT), auto: (uq.stats.autoFired ?? 0), hits: [], res: null, snap: false, done: false, minD: dist };
      S.fires.push(fireRec.cur);
    }
    const F = fireRec.cur;
    if (F && !F.done) {
      if (P.iai && P.iai.tech === 'duplieren') (F.snap = true), (F.minD = Math.min(F.minD, dist));
      else if (F.snap || t - F.t > 1.5) {
        F.done = true;
        const r = P.instantResult;
        if (F.snap && r?.combo && r.tech === 'duplieren') F.res = { blocked: !!r.blocked, zone: r.zone ?? null, ...(r.burst ? { burst: r.burst } : {}), ...(r.dup ? { sweep: r.dup.sweep } : {}) };
        F.minD = r3(F.minD);
      }
    }
  };
  let spSev = 0, spHits = 0, dealt = 0, recvSev = 0;
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    const sv = r.type === 'blunt' ? 0 : r.severity ?? 0;
    if (att === A && vic === P) {
      recvSev += sv;
      if (sv > 0) S.recv.push({ t: G.t, sv: r3(sv) });
    }
    if (att !== P || vic !== A) return;
    dealt += sv;
    if (strokeTechOf(P) === 'duplieren') {
      spSev += sv;
      if (sv > 0) spHits++;
      const F = fireRec.cur;
      if (F && !F.done) F.hits.push({ zone: r.zone, type: r.type, sev: r3(sv), E: r3(r.energy), out: freshOutcome(r, rest[1]?.v?.part ?? null) });
    }
  };
  // 넘어짐 · 휘청 (10/31 19:xx 겹치기 앞 박차기 재기 — 낸 뒤 1 실제 초): 내 몸이 서 있지 않게 된 때 · knockDown 부른 때
  const falls = [];
  const kd = P.knockDown.bind(P);
  P.knockDown = (heavy = true) => {
    falls.push({ t: G.t, kind: heavy ? 'knockHeavy' : 'knock' });
    return kd(heavy);
  };
  let stPrev = P.state;
  probe?.init?.(G, P, A, uq);
  let end = dur;
  try {
    for (let i = 0; i < Math.round(dur / DT); i++) {
      G.step();
      if (P.state !== stPrev) {
        if (stPrev === 'stand' && P.state !== 'dead') falls.push({ t: G.t, kind: P.state });
        stPrev = P.state;
      }
      probe?.step?.(G, P, A, uq);
      if ((!P.alive || !A.alive) && end === dur) end = G.t + 0.5;
      if (G.t >= end) break;
    }
    // 1 실제 초 안에 받은 상처 (낸 뒤)
    for (const F of S.fires) F.recv1 = r3(S.recv.filter((x) => x.t >= F.t && x.t <= F.t + 1 * STD).reduce((a, x) => a + x.sv, 0));
    for (const F of S.fires) F.fall1 = falls.filter((x) => x.t >= F.t && x.t <= F.t + 1 * STD).map((x) => x.kind);
    return {
      bot: botKind, weapon, opp, seed, t: r3(G.t), steps: S.steps, touchSteps: S.touchSteps,
      win: !A.alive && P.alive, lose: !P.alive && A.alive,
      dealt: r3(dealt), recvSev: r3(recvSev), spSev: r3(spSev), spHits, recv: S.recv,
      fired: uq.stats.fired?.duplieren ?? 0, autoFired: uq.stats.autoFired ?? 0, dupReset: uq.stats.dupReset ?? 0,
      fires: S.fires.map((F) => ({ t: r3(F.t), d0: F.d0, minD: F.minD, bits: F.bits, mordT: F.mordT, hits: F.hits, res: F.res, snap: F.snap, recv1: F.recv1, fall1: F.fall1 })), falls: falls.map((x) => ({ t: r3(x.t), kind: x.kind })),
      mordWin: S.mordWin, log: S.log,
    };
  } finally {
    G.world.free();
  }
}

// ── 닿음 덩이 (스텝 기록에서): 떨어진 틈이 gap 초(게임) 이하면 한 덩이 ──
export function episodes(L, gap = 0) {
  const out = [];
  let cur = null;
  let offT = 0;
  for (let i = 0; i < L.t.length; i++) {
    const dt = i ? L.t[i] - L.t[i - 1] : DT;
    if (L.touch[i]) {
      if (!cur) cur = { i0: i, t0: L.t[i], d0: L.d[i], ds: [], on: 0 };
      cur.ds.push(L.d[i]);
      cur.on += dt;
      cur.t1 = L.t[i];
      offT = 0;
    } else if (cur) {
      offT += dt;
      if (offT > gap) {
        out.push(cur);
        cur = null;
      }
    }
  }
  if (cur) out.push(cur);
  return out.map((e) => ({ t0: e.t0, len: e.t1 - e.t0 + DT, on: e.on, d0: e.d0, dMean: e.ds.reduce((a, x) => a + x, 0) / e.ds.length, dMin: Math.min(...e.ds), dMax: Math.max(...e.ds) }));
}

// ── 열린 고리: 기록된 스텝에서 조건 값 묶음마다 '냈을' 때 (낸 뒤 칼 0.5 s + 식힘 3 s 동안은 안 셈 — 게임 초) ──
export function replay(L, c) {
  const refr = (0.5 + 3) * STD;
  const fires = [];
  let block = -1;
  const A = { st: 0, off: 0, since: null, on: false, t0: null, prev: null, tEnd: null, pair: false };
  const hard = B.iai | B.sec | B.notStand | B.notArmed | B.exhausted | (c.parry ? 0 : B.parry);
  for (let i = 0; i < L.t.length; i++) {
    const t = L.t[i];
    const dt = i ? t - L.t[i - 1] : DT;
    const bits = L.bits[i];
    const touch = !!L.touch[i];
    const d = L.d[i];
    const band = d > c.lo && d <= c.hi;
    const dead = t < block || !!(bits & hard);
    let ready = false;
    if (c.mode === 'bind') {
      const live = touch && band && !dead;
      if (live) {
        if (!(A.st > 0)) A.since = t;
        A.off = 0;
        A.st += dt;
      } else if (A.st > 0 && !dead && (A.off += dt) <= c.gap) {
        /* 쥠 */
      } else if (A.st > 0 && !dead && c.drain > 0) {
        A.st = Math.max(0, A.st - c.drain * dt); // 빠짐 (초당 쌓임 몫)
        if (!A.st) A.since = null;
      } else (A.st = 0), (A.off = 0), (A.since = null);
      if (c.newStroke && A.st > 0 && A.since != null && bits & B.newStroke && bits & B.swing && t > A.since) (A.st = 0), (A.off = 0), (A.since = null);
      ready = A.st >= c.S && touch && band && !(c.quiet && bits & B.swing);
    } else {
      if (touch && !A.on) {
        A.on = true;
        if (A.tEnd == null || t - A.tEnd >= c.gap) {
          A.prev = A.t0;
          A.t0 = t;
          A.pair = A.prev != null && t - A.prev <= c.T && band;
        }
      } else if (!touch && A.on) (A.on = false), (A.tEnd = t);
      if (dead) (A.pair = false), (A.prev = A.t0 = null);
      ready = A.pair && touch && band;
    }
    if (!ready || dead || bits & B.tapBusy) continue;
    fires.push({ t, d, bits });
    block = t + refr;
    A.st = 0;
    A.off = 0;
    A.since = null;
    A.pair = false;
    A.prev = A.t0 = null;
  }
  return fires;
}

const minutes = (runs) => runs.reduce((a, r) => a + r.t, 0) / STD / 60;
const share = (n, d) => (d ? r3(n / d) : null);

/** 닿음 분포 (닫힌 · 열린 고리 공통 — 기록이 있는 판만) */
export function contactTable(runs, bands = [0, 0.8, 1.1, 1.25, 1.4, 1.7, 9]) {
  const L = runs.filter((r) => r.log);
  const M = minutes(L);
  const out = {};
  for (const gap of [0, 0.2 * STD]) {
    const E = L.flatMap((r) => episodes(r.log, gap));
    const row = { perMin: r3(E.length / M), lenP50: q(E.map((e) => e.len / STD), 0.5), lenP75: q(E.map((e) => e.len / STD), 0.75), lenP90: q(E.map((e) => e.len / STD), 0.9), lenP99: q(E.map((e) => e.len / STD), 0.99), d0P10: q(E.map((e) => e.d0), 0.1), d0P50: q(E.map((e) => e.d0), 0.5), d0P90: q(E.map((e) => e.d0), 0.9) };
    // 덩이 길이 넘음 (실제 초 사다리)
    for (const s of [0.2, 0.4, 0.6, 1.2, 1.5, 2.0]) row[`over${s}`] = r3(E.filter((e) => e.len / STD >= s).length / M);
    // 띠마다 (덩이 시작 거리)
    row.byBand = {};
    for (let k = 0; k < bands.length - 1; k++) {
      const Eb = E.filter((e) => e.dMean > bands[k] && e.dMean <= bands[k + 1]);
      row.byBand[`${bands[k]}-${bands[k + 1]}`] = { perMin: r3(Eb.length / M), lenP50: q(Eb.map((e) => e.len / STD), 0.5), lenP90: q(Eb.map((e) => e.len / STD), 0.9), over0_4: r3(Eb.filter((e) => e.len / STD >= 0.4).length / M), over0_6: r3(Eb.filter((e) => e.len / STD >= 0.6).length / M), over1_2: r3(Eb.filter((e) => e.len / STD >= 1.2).length / M) };
    }
    out[gap ? 'gap0.2' : 'raw'] = row;
  }
  // 닿은 스텝 가슴 사이 분포 · 띠마다 닿은 시간 (분당 실제 초)
  const ds = [];
  const tb = {};
  let parryTouch = 0, touchN = 0, swingTouch = 0, backTouch = 0;
  for (const r of L) for (let i = 0; i < r.log.t.length; i++) {
    if (!r.log.touch[i]) continue;
    const d = r.log.d[i];
    ds.push(d);
    touchN++;
    if (r.log.bits[i] & B.parry) parryTouch++;
    if (r.log.bits[i] & B.swing) swingTouch++;
    if (r.log.bits[i] & B.back) backTouch++;
    for (let k = 0; k < bands.length - 1; k++) if (d > bands[k] && d <= bands[k + 1]) tb[`${bands[k]}-${bands[k + 1]}`] = (tb[`${bands[k]}-${bands[k + 1]}`] ?? 0) + DT / STD;
  }
  for (const k in tb) tb[k] = r3(tb[k] / M);
  out.touchD = { p10: q(ds, 0.1), p25: q(ds, 0.25), p50: q(ds, 0.5), p75: q(ds, 0.75), p90: q(ds, 0.9), secPerMinByBand: tb, parryShare: share(parryTouch, touchN), swingShare: share(swingTouch, touchN), backShare: share(backTouch, touchN), touchSecPerMin: r3((touchN * DT) / STD / M) };
  // 가슴 사이 전체 분포 (싸움 시간)
  const all = L.flatMap((r) => r.log.d.filter((_, i) => !(r.log.bits[i] & B.notStand)));
  out.distAll = { p10: q(all, 0.1), p50: q(all, 0.5), p90: q(all, 0.9), inMord: share(all.filter((d) => d <= MORD_N).length, all.length) };
  out.minutes = r3(M);
  return out;
}

/** 열린 고리 표 */
export function sweepTable(runs, cands) {
  const L = runs.filter((r) => r.log);
  const M = minutes(L);
  return cands.map((c) => {
    const F = L.flatMap((r) => replay(r.log, c).map((f) => ({ ...f, run: r })));
    const st = (b) => share(F.filter((f) => f.bits & b).length, F.length);
    return { ...c, perMin: r3(F.length / M), n: F.length, dP50: q(F.map((f) => f.d), 0.5), parry: st(B.parry), hand: st(B.hand), swing: st(B.swing), back: st(B.back), foeAtk: st(B.foeAtk), runsWith: L.filter((r) => replay(r.log, c).length).length + '/' + L.length };
  });
}

/** 닫힌 고리 표 */
export function closedTable(runs) {
  const M = minutes(runs);
  const F = runs.flatMap((r) => r.fires);
  const hit = F.filter((f) => f.hits.some((h) => h.sev > 0));
  const zones = {};
  for (const f of hit) { const z = f.hits.find((h) => h.sev > 0).zone; zones[z] = (zones[z] ?? 0) + 1; }
  const kills = F.filter((f) => f.hits.some((h) => h.out === 'kill')).length;
  const st = (b) => share(F.filter((f) => f.bits & b).length, F.length);
  const recvAll = runs.reduce((a, r) => a + r.recvSev, 0) / M; // 받은 심각도 / 실제 분
  const recv1 = F.length ? F.reduce((a, f) => a + (f.recv1 ?? 0), 0) / F.length : null; // 낸 뒤 1 실제 초 받은 심각도 (낸 것당)
  return {
    runs: runs.length, minutes: r3(M), firedPerMin: r3(F.length / M), fired: F.length, autoFired: runs.reduce((a, r) => a + r.autoFired, 0),
    hit: hit.length, hitShare: share(hit.length, F.length), blocked: F.filter((f) => f.res?.blocked).length, zones, kills,
    spSevPerMin: r3(runs.reduce((a, r) => a + r.spSev, 0) / M), sevPerFire: share(runs.reduce((a, r) => a + r.spSev, 0), F.length),
    d0P10: q(F.map((f) => f.d0), 0.1), d0P50: q(F.map((f) => f.d0), 0.5), d0P90: q(F.map((f) => f.d0), 0.9), atMord: F.filter((f) => f.d0 <= MORD_N).length, minDP50: q(F.map((f) => f.minD), 0.5), duringMordCount: F.filter((f) => f.mordT > 0).length,
    parry: st(B.parry), hand: st(B.hand), swing: st(B.swing), back: st(B.back), foeAtk: st(B.foeAtk),
    recv1PerFire: r3(recv1), recvPerSec: r3(recvAll / 60), mordWinPerMin: r3(runs.reduce((a, r) => a + r.mordWin, 0) / M),
    win: runs.filter((r) => r.win).length, lose: runs.filter((r) => r.lose).length, dealtPerMin: r3(runs.reduce((a, r) => a + r.dealt, 0) / M), recvPerMin: r3(recvAll), dupReset: runs.reduce((a, r) => a + (r.dupReset ?? 0), 0),
  };
}

function parseArgs() {
  const args = { _: [] };
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] ?? true;
    else args._.push(a);
  }
  return args;
}

if (isMain(import.meta.url)) {
  const args = parseArgs();
  const mode = args._[0] ?? 'run';
  const list = (k, d) => String(args[k] ?? d).split(',').filter(Boolean);
  if (mode === 'run') {
    const set = args.set ? JSON.parse(args.set) : {};
    applySet(set);
    const band = list('band', `${UA.dupBandMin ?? MORD_N},${UA.dupBandMax}`).map(Number);
    const runs = [];
    for (const weapon of list('weapons', 'longsword,sabre,kriegsmesser')) for (const opp of list('opps', 'longsword,uchigatana,zweihander,rapier')) for (const seed of list('seeds', '901,902,903').map(Number)) {
      const r = fight({ bot: args.bot ?? 'normal', weapon, opp, seed, dur: +(args.dur ?? 30), band, log: !!args.log });
      runs.push(r);
      console.error(weapon, opp, seed, JSON.stringify({ t: r.t, fired: r.fired, hits: r.spHits, touch: r3((r.touchSteps * DT) / STD) }));
    }
    const out = { set, bot: args.bot ?? 'normal', band, closed: closedTable(runs), contact: args.log ? contactTable(runs) : null, runs: runs.map(({ log, recv, ...r }) => r) };
    console.log(JSON.stringify(out.closed));
    if (args.json) writeFileSync(String(args.json), JSON.stringify(out));
    if (args.log) writeFileSync(String(args.log), JSON.stringify(runs.map((r) => ({ weapon: r.weapon, opp: r.opp, seed: r.seed, bot: r.bot, t: r.t, log: r.log }))));
  } else if (mode === 'sweep') {
    const runs = args._.slice(1).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')));
    const lo = MORD_N;
    const cands = [];
    // 쌓임 꼴: reset(끊김 g 넘으면 0 — 죽음의 일격 틀) · drain r(g 넘으면 초당 r 씩 빠짐) × 냄 막음: ns(쌓은 뒤 새로 휘두르는 긋기면 0) · quiet(손가락이 휘두르는 동안은 냄만 미룸)
    const kinds = String(args.kinds ?? 'reset-ns,reset-quiet,drain0.5-quiet,drain1-quiet').split(',');
    for (const kind of kinds) {
      const [dk, rule] = kind.split('-');
      const drain = dk.startsWith('drain') ? +dk.slice(5) : 0;
      for (const hi of [1.1, 1.25, 1.4, 1.7]) for (const S of [0.2, 0.4, 0.6, 1.2, 1.5, 2.0]) for (const gap of [0.2, 0.4]) cands.push({ mode: 'bind', lo, hi, S: S * STD, gap: gap * STD, parry: 0, newStroke: rule === 'ns' ? 1 : 0, quiet: rule === 'quiet' ? 1 : 0, drain, key: `bind ${kind} hi${hi} S${S} g${gap}` });
    }
    for (const hi of [1.4, 1.7, 9]) for (const T of [0.6, 1.2, 2.0]) for (const gap of [0.2, 0.4]) cands.push({ mode: 'clash2', lo, hi, T: T * STD, gap: gap * STD, parry: 0, key: `clash2 hi${hi} T${T} g${gap}` });
    // 막기 단추 · 새 긋기 규칙 견줌
    for (const S of [0.4, 0.6]) {
      cands.push({ mode: 'bind', lo, hi: 1.4, S: S * STD, gap: 0.2 * STD, parry: 1, newStroke: 0, quiet: 1, key: `bind reset-quiet hi1.4 S${S} g0.2 parry1` });
      cands.push({ mode: 'bind', lo, hi: 1.4, S: S * STD, gap: 0.2 * STD, parry: 0, newStroke: 0, quiet: 0, key: `bind reset-none hi1.4 S${S} g0.2` });
      cands.push({ mode: 'bind', lo, hi: 1.4, S: S * STD, gap: 0.2 * STD, parry: 1, newStroke: 0, quiet: 1, drain: 0.5, key: `bind drain0.5-quiet hi1.4 S${S} g0.2 parry1` });
    }
    cands.push({ mode: 'clash2', lo, hi: 9, T: 1.2 * STD, gap: 0.2 * STD, parry: 1, key: 'clash2 hi9 T1.2 g0.2 parry1' });
    const byBot = {};
    for (const r of runs) (byBot[r.bot] ??= []).push(r);
    const out = {};
    for (const [b, R] of Object.entries(byBot)) {
      out[b] = { contact: contactTable(R), sweep: sweepTable(R, cands) };
      console.log(`== ${b} · 판 ${R.length} · 실제 분 ${out[b].contact.minutes}`);
      console.log(JSON.stringify(out[b].contact));
      for (const s of out[b].sweep) console.log(s.key.padEnd(34), String(s.perMin).padStart(6), s.runsWith.padStart(6), 'd', s.dP50, 'parry', s.parry, 'swing', s.swing, 'back', s.back, 'foeAtk', s.foeAtk);
    }
    if (args.json) writeFileSync(String(args.json), JSON.stringify(out));
  } else if (mode === 'agg') {
    // 표 한 줄씩 (닫힌 고리) + 낸 때 가슴 사이마다 맞음 (모든 파일)
    const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)} %`);
    const allF = [];
    console.log('| 파일 | 봇 | 판 | 실제 분 | 낸 수 /분 | 맞음 | 부위 | 즉사 | 낸 것당 심각도 | 특수 심각도 /분 | 가슴 사이 p50 (p10 ~ p90) | 낸 뒤 가장 가까이 p50 · 0.8 밑 | 막기 단추 · 긋는 중 · 스틱 뒤 · 상대 공격 중 | 낸 뒤 1 s 받은 심각도 (평소 1 s) | 죽음의 일격 셈 창 /분 | 승 · 패 |');
    for (const p of args._.slice(1)) {
      const o = JSON.parse(readFileSync(p, 'utf8'));
      const c = o.closed;
      if (!c) continue; // 건너뛴 판 자리
      for (const r of o.runs) for (const f of r.fires) allF.push({ ...f, file: p });
      const minLow = o.runs.flatMap((r) => r.fires).filter((f) => f.minD != null && f.minD <= MORD_N).length;
      console.log(`| ${p.replace(/^.*\//, '')} | ${o.bot} | ${c.runs} | ${c.minutes} | ${c.firedPerMin} (${c.fired}) | ${c.hit} / ${c.fired} (${pct(c.hitShare)}) · 막힘 ${c.blocked} | ${Object.entries(c.zones).map(([z, n]) => `${z} ${n}`).join(' · ')} | ${c.kills} | ${c.sevPerFire ?? '—'} | ${c.spSevPerMin} | ${c.d0P50} (${c.d0P10} ~ ${c.d0P90}) | ${c.minDP50} · ${minLow} | ${pct(c.parry)} · ${pct(c.swing)} · ${pct(c.back)} · ${pct(c.foeAtk)} | ${c.recv1PerFire ?? '—'} (${c.recvPerSec}) | ${c.mordWinPerMin} | ${c.win} · ${c.lose} |`);
    }
    const bins = [0.8, 1.1, 1.25, 1.4, 1.7, 9];
    console.log('\n낸 때 가슴 사이 → 맞음 (모든 파일)');
    for (let k = 0; k < bins.length - 1; k++) {
      const F = allF.filter((f) => f.d0 > bins[k] && f.d0 <= bins[k + 1]);
      const h = F.filter((f) => f.hits.some((x) => x.sev > 0));
      const sev = F.reduce((a, f) => a + f.hits.reduce((b, x) => b + (x.sev ?? 0), 0), 0);
      console.log(`${bins[k]}-${bins[k + 1]}: 낸 ${F.length} · 맞음 ${h.length} (${F.length ? Math.round((100 * h.length) / F.length) : '—'} %) · 낸 것당 심각도 ${F.length ? r3(sev / F.length) : '—'} · 머리 ${h.filter((f) => f.hits.find((x) => x.sev > 0).zone === 'head').length}`);
    }
  } else throw new Error(`판 ${mode}?`);
}

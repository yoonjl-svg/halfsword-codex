// 동작 라이브러리 점검 (src/motion_library.js, docs/weapon_motions.md)
//   node tools/sim/hybrid.mjs motion_lab.mjs poses <무기id>          자세표: 자세마다 손·칼끝이 목표에 얼마나 붙나 (지금 표 vs 라이브러리 표)
//   node tools/sim/hybrid.mjs motion_lab.mjs swings <무기id> [기술…]   기술마다 혼자 휘둘러: 걸린 시간, 칼날 70% 최고 속도, 베기 지표(J), 날 세움
//   node tools/sim/hybrid.mjs motion_lab.mjs duel <무기id> <자리마다 판 수> [off|on]   롱소드 상대 실제 승패 (ability_test 와 같은 판)
//  라이브러리를 켜는 곳은 이 도구뿐이다(게임 기본은 꺼짐).
import { newRound, DT, THREE } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { WEAPONS } from '../../src/weapons.js';
import { SCHOOLS } from '../../src/schools.js';
import { STRIKE, GAIT } from '../../src/config.js';
if (process.env.HEIGHT_RATE) GAIT.heightRate = +process.env.HEIGHT_RATE; // 점검: 골반 높이를 바꾸는 최고 빠르기 (런지 몸 낮춤)
import { GUARD_BASE } from '../../src/guards.js';
import { applyMotionLibrary, motionFor, MOTION } from '../../src/motion_library.js';
for (const k of (process.env.MOTION_SKIP ?? '').split(',').filter(Boolean)) MOTION.skip.add(k);
if (process.env.USE_PARRY === '1') MOTION.useParry = true;
if (process.env.COVER_IN) MOTION.coverIn = +process.env.COVER_IN;
if (process.env.COVER_OUT) MOTION.coverOut = +process.env.COVER_OUT;
import { TECH } from '../../src/ai_techniques.js';
import { wilson } from './ref_duel.mjs';
import { registerPoleWeapons } from './pole_specs.mjs';
if (process.env.EXTRA === 'pole') registerPoleWeapons(WEAPONS); // 자루 무기 시제품(proto_staff·proto_spear)도 잰다

const [mode, id = 'longsword', ...rest] = process.argv.slice(2);
const W = WEAPONS[id];
if (!W) throw new Error(`무기 없음: ${id}`);
const q4 = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
const deg = (a) => (a * 180) / Math.PI;

/** 칼날 t 지점 속도와 날 세움 (weapon_tempo.mjs pointState 와 같은 식) */
function pointState(f, t) {
  const c = f.weaponCfg;
  const p = f.sword.translation();
  const q = q4(f.sword.rotation());
  const pt = new THREE.Vector3(0, c.hiltLength + t * c.bladeLength, 0).applyQuaternion(q).add(new THREE.Vector3(p.x, p.y, p.z));
  const u = f.sword.velocityAtPoint(pt);
  const v = new THREE.Vector3(u.x, u.y, u.z);
  const s = v.length();
  if (!c.edged) return { s, q: 1 };
  const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const edge = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const perp = v.clone().addScaledVector(axis, -v.dot(axis));
  const pl = perp.length();
  const align = pl > 1e-3 ? Math.abs(perp.dot(edge)) / pl : 0;
  return { s, q: align > STRIKE.edgeAlign ? 0.4 + 0.6 * ((align - STRIKE.edgeAlign) / (1 - STRIKE.edgeAlign)) : 0 };
}
/** 칼날 t 지점에서 날 방향으로 민 유효 질량 (weapon_tempo.mjs mFreeAt 과 같은 식) */
function mFreeAt(f, t) {
  const c = f.weaponCfg;
  const { m, I, frame } = f.swordProps;
  const d = c.hiltLength + t * c.bladeLength - f.swordCom;
  const rn = new THREE.Vector3(0, d, 0).cross(new THREE.Vector3(1, 0, 0)).applyQuaternion(frame.clone().invert());
  return 1 / (1 / m + (rn.x * rn.x) / I.x + (rn.y * rn.y) / Math.max(I.y, 1e-6) + (rn.z * rn.z) / I.z);
}
function soloRound(lib) {
  const G = newRound({ walls: false, weapon: id, weapon2: 'longsword', seed: 7 });
  G.park();
  const P = G.player;
  if (lib && process.env.LIB !== '0') applyMotionLibrary(P, { overlay: process.env.NO_OVERLAY !== '1' });
  if (process.env.TWIST_MUL) P.twistScale *= +process.env.TWIST_MUL; // 점검: 날 세우기 힘 배율
  return { G, P };
}
function setPad(P, x, y) {
  P.handOffset.set(x, y);
  P.skill.aimRaw?.set?.(x, y);
}

if (mode === 'poses') {
  // 자세마다 1.2초 들고 있게 한 뒤: 손(칼 원점)이 손 목표에서 몇 cm, 칼 축이 칼끝 목표 방향에서 몇 도 벗어났나
  const rows = [];
  for (const lib of [false, true]) {
    const { G, P } = soloRound(lib);
    const n = GUARD_BASE.length;
    for (let i = 0; i < n; i++) {
      const pd = GUARD_BASE[i].pad;
      setPad(P, pd[0], pd[1]);
      let hErr = 0;
      let aErr = 0;
      let k = 0;
      for (let t = 0; t < 1.4; t += DT) {
        G.step();
        if (t > 1.0) {
          const s = P.sword.translation();
          hErr += P.handTarget.distanceTo(new THREE.Vector3(s.x, s.y, s.z));
          const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(q4(P.sword.rotation()));
          const gp = P.guardPose;
          const want = new THREE.Vector3(gp.dir[0], gp.dir[1], gp.dir[2]).applyQuaternion(P.yaw);
          aErr += deg(ax.angleTo(want));
          k++;
        }
      }
      rows.push({ lib, i, name: P.guardPose.table?.[i]?.name ?? '(바탕 표)', near: P.guardPose.nearest, hand: ((100 * hErr) / k).toFixed(1), ang: (aErr / k).toFixed(1) });
    }
  }
  const byI = {};
  for (const r of rows) (byI[r.i] ||= {})[r.lib ? 'on' : 'off'] = r;
  console.log(`${id} (${motionFor(W).frame}·${motionFor(W).style}) — 자세마다 손 오차 cm / 칼끝 방향 오차 ° (1.0~1.4초 평균)`);
  console.log('| 패드 | 지금 표 | 손 | 칼끝 | 라이브러리 표 | 손 | 칼끝 |');
  console.log('|---|---|---|---|---|---|---|');
  for (const i of Object.keys(byI)) {
    const a = byI[i].off;
    const b = byI[i].on;
    console.log(`| ${i} | ${a.name} | ${a.hand} | ${a.ang} | ${b.name} | ${b.hand} | ${b.ang} |`);
  }
} else if (mode === 'swings') {
  // 기술 길을 AI 손 빠르기(패드 m/s)로 따라간다: 시작 자세에서 0.8초 기다린 뒤 길을 따라가고 0.6초 더 본다
  const SP = +(process.env.PAD_SPEED ?? 11); // 패드 m/s — AI 보통 난이도 strikeSpeed (config.js AI_LEVELS.normal)
  const only = rest.filter((x) => !x.startsWith('-'));
  const m = motionFor(W);
  const list = (only.length ? m.tech.filter((t) => only.includes(t.name)) : m.tech).concat();
  console.log(`${id} (${m.frame}·${m.style}) — 기술별: 걸린 시간 · 칼날 70% 최고 속도 · 베기 지표 J(날 세움 곱) · 쳐낸 베기 수(칼날 속도 봉우리 ≥ 6 m/s)`);
  console.log('| 기술 | 종류 | 길이(패드 m) | 시간 s | 최고 속도 m/s | 지표 J | ×날 세움 J | 봉우리 (속도×날 세움) |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const tech of list) {
    for (const lib of [true]) {
      const { G, P } = soloRound(lib);
      setPad(P, tech.from[0], tech.from[1]);
      for (let t = 0; t < 0.8; t += DT) G.step();
      const pts = tech.path.map((p) => p.slice());
      let cur = [tech.from[0], tech.from[1]];
      let len = 0;
      let prev = cur;
      for (const p of pts) (len += Math.hypot(p[0] - prev[0], p[1] - prev[1])), (prev = p);
      let t = 0;
      let peak = 0;
      let peakQ = 0;
      let peaks = 0;
      const peakList = [];
      let rising = false;
      let last = 0;
      let done = null;
      const mEff = mFreeAt(P, 0.7) + 0.3;
      while (t < 3) {
        if (pts.length) {
          const [tx, ty] = pts[0];
          const dx = tx - cur[0];
          const dy = ty - cur[1];
          const dd = Math.hypot(dx, dy);
          const st = SP * DT;
          if (dd > st) cur = [cur[0] + (dx / dd) * st, cur[1] + (dy / dd) * st];
          else (cur = [tx, ty]), pts.shift();
          if (!pts.length) done = t;
        }
        setPad(P, cur[0], cur[1]);
        G.step();
        t += DT;
        const s = pointState(P, 0.7);
        if (s.s > peak) (peak = s.s), (peakQ = s.q);
        if (s.s > last) rising = true;
        else if (rising && last >= 6) (peaks++, peakList.push(`${last.toFixed(1)}×${s.q.toFixed(1)}`), (rising = false));
        last = s.s;
        if (done != null && t > done + 0.6) break;
      }
      const e = 0.5 * mEff * peak * peak * 2 * (W.power ?? 1) * (W.edged ? W.mCut : W.mBlunt);
      console.log(`| ${tech.name} | ${tech.kind} | ${len.toFixed(2)} | ${done?.toFixed(2) ?? '-'} | ${peak.toFixed(1)} | ${e.toFixed(0)} | ${(e * peakQ).toFixed(0)} | ${peaks} (${peakList.join(' ')}) |`);
    }
  }
} else if (mode === 'duel') {
  const N = +rest[0] || 6;
  const on = rest[1] === 'on' || rest[1] === 'tech' || rest[1] === 'table'; // on = 둘 다, tech = 기술 목록만, table = 자세표만
  const useTech = rest[1] === 'on' || rest[1] === 'tech';
  const useTable = rest[1] === 'on' || rest[1] === 'table';
  const m = motionFor(W);
  const skipTech = (process.env.SKIP_TECH ?? '').split(',').filter(Boolean);
  if (skipTech.length) m.tech = m.tech.filter((t) => !skipTech.includes(t.name));
  // AI 유파: 무기 꾸러미(없으면 롱소드)에 라이브러리 기술·속임수를 끼운다 — schools.js 는 건드리지 않는다
  const key = `${id}__lib`;
  const base = SCHOOLS[id] ?? SCHOOLS.longsword;
  SCHOOLS[key] = { ...base, id: key, tech: m.tech, techByName: Object.fromEntries(m.tech.map((t) => [t.name, t])), feints: m.feints, ...(m.counter ? { counter: m.counter } : {}), ...(useTable && m.parry && process.env.NO_PARRY !== '1' ? { parry: { ...base.parry, ...m.parry } } : {}) };
  const school0 = useTech || !useTable ? null : key; void school0;
  // 기술만: 라이브러리 기술 목록 · 자세표만: 자세표 + 그 표의 막기 자리 · 켬: 둘 다
  if (!useTech && useTable) SCHOOLS[key] = { ...base, id: key, ...(m.parry && process.env.NO_PARRY !== '1' ? { parry: { ...base.parry, ...m.parry } } : {}) };
  const school = useTech || useTable ? key : SCHOOLS[id] ? id : 'longsword';
  let Wn = 0, L = 0, D = 0, nan = 0, tSum = 0, tN = 0;
  const used = {};
  for (let s = 1; s <= N; s++) {
    for (const xFirst of [true, false]) {
      const seed = (xFirst ? 1000 : 2000) + s;
      const x = { weapon: id, persona: { school } };
      const y = { weapon: 'longsword', persona: { school: 'longsword' } };
      const P = xFirst ? x : y;
      const E = xFirst ? y : x;
      const G = newRound({ walls: true, seed, weapon: P.weapon, weapon2: E.weapon, difficulty: 'normal', persona: E.persona, AI2Class: AI, difficulty2: 'normal', persona2: P.persona });
      const X = xFirst ? G.player : G.enemy;
      const Y = xFirst ? G.enemy : G.player;
      const XA = xFirst ? G.ai2 : G.ai;
      if (process.env.TWIST_MUL) X.twistScale *= +process.env.TWIST_MUL; // 점검: 날 세우기 힘 배율 (라이브러리와 별개)
      if (useTable) applyMotionLibrary(X, { overlay: process.env.NO_OVERLAY !== '1', flow: process.env.NO_FLOW !== '1', noTwist: process.env.NOTWIST === '1', ai: XA, cover: process.env.COVER === '1' });
      let res = 'D';
      let lastTech = null;
      for (let i = 0; i < 40 / DT; i++) {
        G.step();
        const tn = XA?.tech?.name;
        if (tn && tn !== lastTech && XA.phase === 'strike') used[tn] = (used[tn] ?? 0) + 1;
        lastTech = XA?.phase === 'strike' ? tn : null;
        const v = X.sword.linvel();
        if (![v.x, v.y, v.z].every(Number.isFinite)) { nan++; break; }
        const xd = X.state === 'dead';
        const yd = Y.state === 'dead';
        if (xd || yd) {
          res = xd && yd ? 'D' : yd ? 'W' : 'L';
          tSum += G.t;
          tN++;
          break;
        }
      }
      if (res === 'W') Wn++;
      else if (res === 'L') L++;
      else D++;
    }
  }
  const n = 2 * N;
  const [lo, hi] = wilson(Wn, n);
  const pc = (v) => `${Math.round(100 * v)}%`;
  const top = Object.entries(used).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(', ');
  console.log(`${id} 라이브러리 ${on ? (useTech && useTable ? '켬' : useTech ? '기술만' : '자세표만') : '끔'} (${m.frame}·${m.style}) 승 ${Wn} 패 ${L} 무 ${D} / ${n} · 승률 ${pc(Wn / n)} (95% ${pc(lo)}~${pc(hi)}) · 평균 종료 ${tN ? (tSum / tN).toFixed(1) : '-'}s · NaN ${nan} · 쓴 기술: ${top}`);
} else if (mode === 'tap') {
  // 탭 찌르기 한 번 (상대는 치움): 칼끝이 내 가슴에서 앞으로 가장 멀리 간 거리, 그때까지 걸린 시간, 칼끝 최고 속도, 몸 낮춤.
  //  자세(패드)마다 한 번씩: 쟁기·긴 자세·황소. 라이브러리 끔/켬(켬이면 무기 방식의 덧씌우기 — 찌르기 방식은 런지)
  console.log(`${id} (${motionFor(W).frame}·${motionFor(W).style}) — 탭 찌르기: 칼끝 최대 앞 거리 m · 걸린 초 · 칼끝 최고 속도 m/s · 가슴 최대 낮춤 cm · 왕복 초(뻗은 거리의 80%를 되돌아오기까지)`);
  console.log('| 자세 | 끔: 거리 | 초 | 속도 | 낮춤 | 왕복 | 켬: 거리 | 초 | 속도 | 낮춤 | 왕복 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [nm, pad] of [['쟁기', [0.18, -0.28]], ['긴 자세', [0.0, 0.03]], ['황소', [0.22, 0.26]]]) {
    const cells = [];
    for (const lib of [false, true]) {
      // 상대를 치우면 찌를 대상(foe)이 없어 탭이 안 나간다 → 가만히 세워 둔다(AI 끔). 시작 간격이 칼끝 거리보다 멀다
      const G = newRound({ walls: false, weapon: id, weapon2: 'longsword', seed: 7 });
      G.ai.update = () => {};
      const P = G.player;
      if (lib) applyMotionLibrary(P);
      setPad(P, pad[0], pad[1]);
      for (let t = 0; t < 1.0; t += DT) G.step();
      const gap = P.bodies.chest.translation();
      const fc = P.foe.bodies.chest.translation();
      if (nm === '쟁기' && !lib) console.log(`(가슴 사이 거리 ${Math.hypot(gap.x - fc.x, gap.z - fc.z).toFixed(2)} m)`);
      const c0 = P.bodies.chest.translation();
      const fwd = P.forward(new THREE.Vector3());
      const y0 = c0.y;
      P.skill.thrust();
      let best = 0, tBest = 0, vmax = 0, low = 0, d0 = null, tBack = null;
      for (let t = 0; t < 1.5; t += DT) {
        G.step();
        const tip = P.bladePoint(1, new THREE.Vector3());
        const d = tip.clone().sub(new THREE.Vector3(c0.x, c0.y, c0.z)).dot(fwd);
        if (d0 === null) d0 = d;
        if (t <= 0.9 && d > best) (best = d), (tBest = t);
        if (tBack === null && t > tBest && best > d0 + 0.05 && d < best - 0.8 * (best - d0)) tBack = t;
        if (t > 0.9) continue; // 거리·속도·낮춤은 예전처럼 0.9초 안에서만 (왕복만 1.5초까지 본다)
        const pt = P.bladePoint(1, new THREE.Vector3());
        const u = P.sword.velocityAtPoint(pt);
        vmax = Math.max(vmax, Math.hypot(u.x, u.y, u.z));
        low = Math.max(low, y0 - P.bodies.chest.translation().y);
      }
      cells.push(`${best.toFixed(2)} | ${tBest.toFixed(2)} | ${vmax.toFixed(1)} | ${(low * 100).toFixed(0)} | ${tBack === null ? '-' : tBack.toFixed(2)}`);
    }
    console.log(`| ${nm} | ${cells[0]} | ${cells[1]} |`);
  }
} else if (mode === 'parry') {
  // 막기 자리 찾기 (롱소드 유파 parry 표를 고른 방법과 같다: 공격 줄 × 자세를 물리로 부딪쳐 본다).
  //  자세표가 바뀌면 "어느 패드가 어느 줄을 막나"도 바뀐다 → 몸 틀 표마다 다시 찾아야 한다(10라운드 규칙 발견, docs/weapon_motions.md).
  //  막는 쪽 = 이 무기(라이브러리 켬/끔), 치는 쪽 = 롱소드(스크립트로 기술 길을 11 m/s 로). 간격 1.45·1.6 m, 패드 14 곳
  const lib = rest[0] !== 'off';
  const LINES = [['highL', 'zornhau'], ['highR', 'zornhauL'], ['highC', 'oberhau'], ['lowL', 'unterhau'], ['lowR', 'unterhauL'], ['thrust', 'stichPflug']];
  const SPD = 11;
  const res = {};
  for (const [line, tn] of LINES) {
    const tech = TECH.find((t) => t.name === tn);
    const rows = [];
    for (let i = 0; i < GUARD_BASE.length; i++) {
      let hit = 0, eSum = 0, clash = 0;
      const GAPS = process.env.PARRY_WIDE === '1' ? [1.3, 1.45, 1.6, 1.75] : [1.45, 1.6];
      const SEEDS = process.env.PARRY_WIDE === '1' ? [7, 8, 9] : [7];
      for (const [gap, seed] of GAPS.flatMap((g) => SEEDS.map((sd) => [g, sd]))) {
        const G = newRound({ walls: false, weapon: 'longsword', weapon2: id, seed, gap });
        G.ai.update = () => {};
        const A = G.player;
        const D = G.enemy;
        if (lib) applyMotionLibrary(D);
        const pd = GUARD_BASE[i].pad;
        setPad(D, pd[0], pd[1]);
        setPad(A, tech.from[0], tech.from[1]);
        for (let t = 0; t < 0.8; t += DT) G.step();
        const pts = tech.path.map((q) => q.slice());
        let cur = tech.from.slice();
        const w0 = G.wounds.length;
        const c0 = G.clashes ?? 0;
        for (let t = 0; t < 1.0; t += DT) {
          if (pts.length) {
            const [tx, ty] = pts[0];
            const dx = tx - cur[0], dy = ty - cur[1], dd = Math.hypot(dx, dy), st = SPD * DT;
            if (dd > st) cur = [cur[0] + (dx / dd) * st, cur[1] + (dy / dd) * st];
            else (cur = [tx, ty]), pts.shift();
          }
          setPad(A, cur[0], cur[1]);
          if (tech.kind === 'thrust' && t < DT) A.skill.thrust({ step: false });
          G.step();
        }
        const ws = G.wounds.slice(w0).filter((w) => w.att === A);
        if (ws.length) hit++;
        eSum += ws.reduce((a, w) => a + (w.energy ?? w.E ?? 0), 0);
        clash += (G.clashes ?? 0) - c0;
      }
      rows.push({ i, hit, eSum, clash });
    }
    rows.sort((a, b) => a.hit - b.hit || b.clash - a.clash || a.eSum - b.eSum);
    res[line] = rows;
    const nm = (i) => {
      const { G: g2, P } = soloRound(lib);
      void g2;
      return P.guardPose.table?.[i]?.name ?? GUARD_BASE[i].name;
    };
    console.log(`${line} (${tn}): 가장 잘 막은 자세 ${rows.slice(0, 3).map((r) => `${nm(r.i)}[패드 ${GUARD_BASE[r.i].pad}] 맞음 ${r.hit} 칼부딪침 ${r.clash}`).join(' · ')}`);
  }
  const pick = Object.fromEntries(Object.entries(res).map(([k, rows]) => [k, GUARD_BASE[rows[0].i].pad]));
  console.log(`parry 표 제안 (${id}, 라이브러리 ${lib ? '켬' : '끔'}): ${JSON.stringify(pick)}`);
} else {
  console.log('모드: poses | swings | duel | tap | parry');
}
void TECH;

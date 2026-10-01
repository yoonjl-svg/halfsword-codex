// 쓰러진 상대에게 탭 찌르기(skill.thrust) → 마무리 찌르기(내려찍기)가 들어가는가 — 측정 도구
//  상대를 쓰러뜨려(일어나지 못하게) 여러 거리에 두고, 플레이어 칼을 교본 자세 하나(쟁기·황소·지붕·바보)에 둔 채
//  화면을 톡 친 것처럼 skill.thrust() 를 부른다. 탭 뒤 WIN 초 안의 첫 접촉·몸통 접촉·상처·즉사를 센다.
//   거리 = 내 가슴에서 상대 몸통(가슴·배·골반) 가장 가까운 곳까지 수평 거리 (down_hits.mjs torsoDist)
//   즉사: WIN 안에 상대가 죽었나(또는 부활을 시작했나), 원인(causeOfDeath), 탭→죽음 초. 못 죽인 판은 까닭:
//    안닿음 · 몸통 못 닿음(팔다리만) · 찍기 찌르기가 쿨다운에 가림 · minEnergy 아래 · 판에 미끄러짐(판금 위 베기·둔기) ·
//    찌르기 아님(베기·둔기) · 찌르기인데 즉사 아님(찍는 중이 아니었거나 즉사 규칙 없음)
//   겨눔(찍기 시작 = tap.go 첫 스텝, 가슴 기준 yaw 좌표): 손 높이 명령(FINISH.hands) 대 칼자루 도달, 머리 꼭대기,
//    칼이 수평 아래로 누운 각, 칼 축 ↔ 몸 점 선 각, 몸 점이 칼 선에서 벗어난 거리(miss), 닿는 곳 안/밖, 걷기 끝, 도착 까닭,
//    찍는 동안 칼끝 최고 속도
//   걸음: 탭이 다리 걸음(gait.requestStep)을 부탁했나·거절됐나·그 발이 디뎠나(탭→디딤), 탭 뒤 첫 디딤(어느 발이든), 골반이 앞으로 간 거리
//   손 각도: 칼자루가 탭 → 몸통 접촉까지 움직인 방향(수평 아래 각도), 뻗기 시작(thrustPush) → 접촉 방향
//   판금(하인리히 겉모습): 찍기 몸통 접촉의 판정 에너지(eff)와 문턱(thr), 판이 칼을 막고도(pass false) 죽은 판, 판에 미끄러진 판
//  사용법: node tools/sim/finish_thrust.mjs [판 수(칸마다)=3] [무기 id] [--armour=none|plate|both] [--guards=쟁기,황소,지붕,바보]
//          [--dists=0.5,0.8,1.1,1.4,1.6] [--falls=toward,away,left,right] [--seed=첫 번호] [--stand] [--rows]
//   --stand : 서 있는 상대 대조 (마무리 경로가 걸리지 않아야 한다 — 바꾸기 전·후 바이트 같음). 상대가 죽었나·원인도 찍는다
//   --rows  : 판마다 한 줄씩 더 찍는다
//   시드: 500 + 17s + 거리×100 + 방향 번호×1000 (자세마다 같은 판). 결정적(같은 입력 → 같은 출력)
//   바꾸기 전 소스(src 에 FINISH.hands·plunge.T·tap.walkEnd 가 없는 v1)에서도 돈다: 없는 값은 '-' 로 찍는다
import { newRound, DT, THREE, V, Q } from './harness_m.mjs';
import { torsoDist, FALLS } from './down_hits.mjs';
import { CHARACTERS } from '../../src/characters.js';
import { isMain } from './is_main.mjs';
import { FINISH } from '../../src/finish.js';
import { STRIKE } from '../../src/config.js';

export const PADS = { 쟁기: [0.18, -0.28], 황소: [0.22, 0.26], 지붕: [0.02, 0.52], 바보: [0.0, -0.5] };
const TORSO = new Set(['chest', 'abdomen', 'pelvis']);
const FIN_PARTS = new Set(['chest', 'abdomen', 'pelvis', 'head']); // 내려찍기 즉사 부위 (combat.js FINISH_PARTS 와 같은 이름)
const R2D = 180 / Math.PI;
// 탭 뒤 재는 시간 (초) — 걸어 들어가 찍는 찌르기도 들어가도록 넉넉히. 1.5초는 1.4·1.6m 에서 걸어 들어간 찍기를 잘랐다
//  (찍기 v2 시제품: 탭→접촉 최대 2.27초, 1.5초면 80판 중 7판이 잘림). 바꾸기 전·후 같은 값으로 잰다
const WIN = 3;
const HEAD_R = 0.1; // 머리 공 반지름 (fighter.js partDefs head) — 바꾸기 전 소스에는 fighter.headR 가 없어 여기서 읽는다
const PLATE = CHARACTERS.find((c) => c.id === 'heinrich').look;

function setHand(f, xy) {
  f.handOffset.set(xy[0], xy[1]);
  for (const k of ['prev', 'aim', 'aimRaw']) f.skill[k].set(xy[0], xy[1]);
  f.skill.anchor?.set(xy[0], xy[1]);
  f.skill.aimVel.set(0, 0);
  f.skill.vel.set(0, 0);
  f.skill.follow.set(0, 0);
}

/** 패드를 휘두르기가 아니게 천천히(1m/s) 자세로 옮긴다 */
function padTo(G, P, pad, secs) {
  for (let i = 0; i < secs / DT; i++) {
    const off = P.handOffset;
    const dx = pad[0] - off.x;
    const dy = pad[1] - off.y;
    const d = Math.hypot(dx, dy);
    const st = 1.0 * DT;
    if (d > st) (off.x += (dx / d) * st), (off.y += (dy / d) * st);
    else off.set(pad[0], pad[1]);
    P.move.set(0, 0);
    G.step();
  }
}

/** 탭 한 번을 WIN 초 동안 지켜본다 */
function watchTap(G, t0, fwd) {
  const P = G.player;
  const E = G.enemy;
  const log = [];
  const C = G.combat;
  const orig = C.strike.bind(C);
  // shadow: 찍는 중 몸통·머리 찌르기가 같은 부위 쿨다운(hitCooldowns)에 가려 상처 판정을 받지 못함
  //  lowE: 찍는 중 몸통·머리 찌르기가 STRIKE.minEnergy 아래라 버려짐. viol: 즉사 표시(r.finish)가 조건 밖에서 켜짐 (0이어야)
  const st = { req: [], plant: null, td: null, push: null, pushGrip: null, shadow: 0, lowE: 0, viol: 0, drops: [] };
  C.strike = (pr, point, passing) => {
    const ps = P.state;
    const sk = P.skill;
    const mine = pr.w.fighter === P && pr.v?.fighter === E && G.t >= t0;
    // 찍는 중(tap.down·go·thrustPush)에 즉사 부위에 닿음: 문턱으로 낮추기 전 판정을 한 번 더 본다 (analyze 는 부작용 없음·난수 없음)
    const plunging = mine && !!sk.tap?.down && !!sk.tap.go && !!sk.thrustPush && FIN_PARTS.has(pr.v.part) && E.state === 'down';
    const cool = mine && E.hitCooldowns.has(`${P.index}:${pr.v.part}`);
    // 즉사 부위 접촉의 칼 움직임 판정 (문턱으로 멍으로 낮추기 전 — 판에 막힌 찌르기와 판에 미끄러진 칼을 가른다)
    let r0 = null;
    if (mine && FIN_PARTS.has(pr.v.part)) {
      const S = P.cache?.sword;
      const Pp = E.cache?.parts[pr.v.part];
      r0 = S && Pp ? C.analyze(pr, point, S, Pp, true) : null;
    }
    if (plunging) {
      if (r0?.type === 'stab') {
        if (cool) (st.shadow++, st.drops.push(`cool:${pr.v.part}:${r0.energy.toFixed(0)}J`));
        else if (r0.energy < STRIKE.minEnergy) (st.lowE++, st.drops.push(`lowE:${pr.v.part}:${r0.energy.toFixed(1)}J`));
      }
    }
    const r = orig(pr, point, passing);
    // viol: 즉사 표시가 combat.js analyze 의 finish 조건 밖에서 켜졌나 — 조건 전부를 부르기 전 상태로 다시 본다
    //  (내 칼·내 상대·쓰러짐·즉사 부위·tap.down·go·thrustPush 는 plunging, 찌르기, 나는 서거나 무릎). 누가 누구를 쳤든 센다
    if (r?.finish && !(plunging && r.type === 'stab' && (ps === 'stand' || ps === 'kneel') && P.foe === E)) st.viol++;
    if (mine && pr.v && r) {
      const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(Q(P.sword.rotation()));
      const along = r.dir && r.bladeAxis ? r.dir.dot(r.bladeAxis) : null;
      log.push({ t: G.t, part: pr.v.part, type: r.type, kin: r0?.type ?? r.type, energy: r.energy, eff: r.eff, thr: r.thr, plate: r.plate, helmet: r.helmet, pass: r.pass, finish: !!r.finish, plunging, cool, along, axisEl: Math.asin(THREE.MathUtils.clamp(axis.y, -1, 1)) * R2D, grip: V(P.sword.translation()), pel: V(P.bodies.pelvis.translation()), push: P.skill.thrustPush });
    }
    return r;
  };
  // 걸음 부탁·디딤 (gait 가 켜져 있을 때)
  const g = P.gait;
  if (g) {
    const rq = g.requestStep.bind(g);
    g.requestStep = (o) => {
      const ok = rq(o);
      st.req.push({ t: G.t, fwd: o?.fwd, ok });
      return ok;
    };
    const td = g.touchdown.bind(g);
    g.touchdown = (l, s) => {
      if (l.kind === 'req' && st.plant == null && G.t >= t0) st.plant = G.t;
      if (st.td == null && G.t >= t0) st.td = G.t; // 탭 뒤 첫 디딤 (어느 발·어느 걸음이든)
      return td(l, s);
    };
  }
  return { log, st, E, fwd };
}

export function finishTrial({ guard, dist, fall, seed, weapon = 'longsword', plate = false, before }) {
  const G = newRound({ walls: false, gap: 2.4, seed, weapon, weapon2: 'longsword', ...(plate ? { look2: PLATE } : {}) });
  G.ai.update = () => {};
  before?.(G);
  const P = G.player;
  const E = G.enemy;
  const step = (mv = 0) => {
    P.move.set(0, mv);
    G.step();
  };
  setHand(P, PADS.쟁기);
  const j1 = Math.random() - 0.5;
  const j2 = Math.random() - 0.5;
  E.knockDown(true);
  E.downTime = 1e9;
  const a = FALLS[fall] + j1 * 0.5;
  const J = 40 * (1 + j2 * 0.4);
  for (let i = 0; i < 2.5 / DT; i++) {
    if (i * DT < 0.25) for (const k of ['chest', 'head']) E.bodies[k].applyImpulse({ x: Math.cos(a) * J * DT * 4, y: 0, z: Math.sin(a) * J * DT * 4 }, true);
    step();
  }
  for (const [tol, mx] of [[0.12, 0.5], [0.03, 0.22]]) {
    for (let i = 0; i < 5 / DT; i++) {
      const d = torsoDist(P, E);
      if (Math.abs(d - dist) < tol) break;
      step(THREE.MathUtils.clamp((d - dist) * 2.5, -mx, mx));
    }
    for (let i = 0; i < 0.6 / DT; i++) step();
  }
  padTo(G, P, PADS[guard], 1.2);
  for (let i = 0; i < 0.4 / DT; i++) step();
  const d0 = torsoDist(P, E);
  const finOn = P.finish.on;
  const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(P.yaw);
  fwd.y = 0;
  fwd.normalize();
  const g0 = V(P.sword.translation());
  const pel0 = V(P.bodies.pelvis.translation());
  const t0 = G.t;
  const W = watchTap(G, t0, fwd);
  const w0 = G.wounds.length;
  const ok = P.skill.thrust();
  const tp = P.skill.tap; // 이 탭 (끝나서 skill.tap 이 비어도 읽는다)
  const down = !!tp?.down;
  let pelMax = 0;
  let tDeath = null;
  let arm = null; // 찍기 시작 때 겨눔
  let tipPrev = null;
  let tipV = 0;
  const L = P.weaponCfg.hiltLength + P.weaponCfg.bladeLength;
  for (let i = 0; i < WIN / DT; i++) {
    step();
    if (W.st.push == null && P.skill.thrustPush) (W.st.push = G.t), (W.st.pushGrip = V(P.sword.translation()));
    pelMax = Math.max(pelMax, V(P.bodies.pelvis.translation()).sub(pel0).dot(fwd));
    if (tDeath == null && (E.state === 'dead' || E.revival)) tDeath = G.t - t0;
    if (!arm && tp?.down && tp.go) arm = armAtGo(P, tp, G.t - t0);
    // 찍는 동안 칼끝 속도 (칼끝 위치의 한 스텝 차이)
    const tip = V(P.sword.translation()).addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(Q(P.sword.rotation())), L);
    if (tp?.down && tp.go && P.skill.thrustPush && P.skill.tap === tp) {
      if (tipPrev) tipV = Math.max(tipV, tip.distanceTo(tipPrev) / DT);
      tipPrev = tip;
    } else tipPrev = null;
  }
  const kill = tDeath != null;
  const cause = E.causeOfDeath ?? E.revival?.cause ?? null;
  const first = W.log[0] ?? null;
  const tor = W.log.find((l) => TORSO.has(l.part)) ?? null;
  const fin = W.log.find((l) => FIN_PARTS.has(l.part) && l.plunging) ?? W.log.find((l) => FIN_PARTS.has(l.part)) ?? null; // 찍는 중 즉사 부위 첫 접촉
  const ws = G.wounds.slice(w0).filter((w) => w.att === P && (w.type === 'cut' || w.type === 'stab') && w.severity > 0);
  // 못 죽인 까닭
  let why = null;
  if (!kill) {
    const drop = W.st.drops[0];
    if (!W.log.length && !drop) why = '안닿음';
    else if (!fin && !drop) why = '몸통못닿음';
    else if (!W.log.some((l) => FIN_PARTS.has(l.part) && l.kin === 'stab') && drop) why = drop.startsWith('cool') ? '쿨다운' : 'minEnergy';
    else if (fin.kin !== 'stab') why = fin.plate || fin.helmet ? '판에미끄러짐' : '찌르기아님';
    else why = fin.finish ? '즉사표시뒤살아있음' : '찌르기인데즉사아님';
  }
  const ang = (from, to) => {
    const d = to.clone().sub(from);
    return Math.atan2(-d.y, d.dot(fwd)) * R2D;
  };
  const req = W.st.req[0] ?? null;
  return {
    guard, dist, fall, seed, plate, d0, finOn, ok, down,
    reqd: !!req, refused: !!req && !req.ok, reqFwd: req?.fwd ?? null,
    tPlant: W.st.plant != null ? W.st.plant - t0 : null, tPush: W.st.push != null ? W.st.push - t0 : null,
    pelAtHit: tor ? tor.pel.clone().sub(pel0).dot(fwd) : null, pelMax,
    first: first ? { part: first.part, type: first.type } : null,
    tor: tor ? { type: tor.type, energy: tor.energy, eff: tor.eff, thr: tor.thr, plate: tor.plate, axisEl: tor.axisEl, push: tor.push } : null,
    tTor: tor ? tor.t - t0 : null,
    handTap: tor ? ang(g0, tor.grip) : null,
    handPush: tor && W.st.pushGrip && W.st.push <= tor.t ? ang(W.st.pushGrip, tor.grip) : null,
    wound: ws.length > 0, stab: ws.some((w) => w.type === 'stab'), sev: ws.reduce((m, w) => Math.max(m, w.severity), 0),
    kill, cause, tDeath, why,
    fin: fin ? { part: fin.part, type: fin.type, kin: fin.kin, along: fin.along, energy: fin.energy, eff: fin.eff, thr: fin.thr, plate: fin.plate, helmet: fin.helmet, pass: fin.pass, finish: fin.finish, plunging: fin.plunging } : null,
    shadow: W.st.shadow, lowE: W.st.lowE, viol: W.st.viol, drops: W.st.drops,
    go: !!tp?.go, tapLeft: !!P.skill.tap, ended: tp?.ended ?? null, tEnd: tp?.tEnd ?? null,
    tTD: W.st.td != null ? W.st.td - t0 : null, tipV: tp?.go ? tipV : null,
    arm,
  };
}

/** 찍기 시작(tap.go 첫 스텝)의 겨눔: 가슴 기준 yaw 좌표 (finish.js 와 같은 몸 기준) */
function armAtGo(P, tp, tGo) {
  const c = V(P.bodies.chest.translation());
  const yi = P.yaw.clone().invert();
  const G = V(P.sword.translation()).sub(c).applyQuaternion(yi);
  const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(Q(P.sword.rotation())).applyQuaternion(yi);
  const pl = P.finish.plunge;
  const Ta = pl.T ?? P.finish.target; // 바꾸기 전(v1)엔 몸 점이 겨눌 점(target)
  const T = new THREE.Vector3(Ta[0], Ta[1], Ta[2]);
  const d = T.clone().sub(G);
  const dn = d.length();
  const along = d.dot(ax);
  const miss = d.clone().addScaledVector(ax, -along).length();
  const headTop = V(P.bodies.head.translation()).y + (P.headR ?? HEAD_R) - c.y;
  return {
    cmdY: FINISH.hands?.[1] ?? null,
    x: G.x, y: G.y, z: G.z, headTop,
    bladeEl: Math.asin(THREE.MathUtils.clamp(-ax.y, -1, 1)) * R2D,
    lineAng: Math.acos(THREE.MathUtils.clamp(along / dn, -1, 1)) * R2D,
    miss, Tx: T.x, Ty: T.y,
    inside: pl.inside ?? null, D: pl.D ?? null, Dmax: pl.Dmax ?? null, short: pl.short ?? null,
    walkEnd: tp.walkEnd ?? null, plants: tp.plants ?? null, walked: !!tp.walked, upWhy: tp.upWhy ?? null, lineWhy: tp.lineWhy ?? null, tGo,
  };
}

/** 대조: 서 있는 상대 (칼을 바보 자세로 내림), 탭 한 번 */
export function standTrial({ guard, gap, seed, weapon = 'longsword' }) {
  const G = newRound({ walls: false, gap, seed, weapon, weapon2: 'longsword' });
  G.ai.update = () => {};
  const P = G.player;
  const E = G.enemy;
  setHand(P, PADS.쟁기);
  setHand(E, PADS.바보);
  padTo(G, P, PADS[guard], 1.2);
  for (let i = 0; i < 0.8 / DT; i++) (P.move.set(0, 0), G.step());
  const t0 = G.t;
  const W = watchTap(G, t0, null);
  const w0 = G.wounds.length;
  const ok = P.skill.thrust();
  const down = !!P.skill.tap?.down;
  for (let i = 0; i < 0.8 / DT; i++) (P.move.set(0, 0), G.step());
  const first = W.log[0] ?? null;
  const ws = G.wounds.slice(w0).filter((w) => w.att === P && (w.type === 'cut' || w.type === 'stab') && w.severity > 0);
  return { guard, gap, ok, down, first: first ? `${first.part}/${first.type}/${first.energy.toFixed(3)}` : '-', wound: ws.length > 0, sev: ws.reduce((m, w) => m + w.severity, 0), reqd: W.st.req.length, pel: V(P.bodies.pelvis.translation()).toArray().map((x) => x.toFixed(5)).join(','), dead: E.state === 'dead', cause: E.causeOfDeath ?? '-' };
}

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const pc = (k, n) => (n ? `${Math.round((100 * k) / n)}%` : '-');

function line(label, rs) {
  const n = rs.length;
  if (!n) return;
  const c = rs.filter((r) => r.first);
  const t = rs.filter((r) => r.tor);
  const w = rs.filter((r) => r.wound);
  const rq = rs.filter((r) => r.reqd);
  const acc = rq.filter((r) => !r.refused);
  const pl = acc.filter((r) => r.tPlant != null);
  console.log(
    `${label.padEnd(12)} n=${String(n).padStart(3)} 닿음 ${pc(c.length, n).padStart(4)} 몸통 ${pc(t.length, n).padStart(4)} 상처 ${pc(w.length, n).padStart(4)} (찌르기 ${pc(rs.filter((r) => r.stab).length, n)}) 즉사 ${pc(rs.filter((r) => r.kill).length, n).padStart(4)} 깊이 ${f(avg(w.map((r) => r.sev)))}` +
      ` | 몸통 E ${f(avg(t.map((r) => r.tor.energy)), 0)}J 탭→몸통 ${f(avg(t.map((r) => r.tTor)))}s 탭→뻗기 ${f(avg(rs.filter((r) => r.tPush != null).map((r) => r.tPush)))}s 손 ${f(avg(t.map((r) => r.handTap)), 0)}°/${f(avg(t.filter((r) => r.handPush != null).map((r) => r.handPush)), 0)}° 칼 ${f(avg(t.map((r) => r.tor.axisEl)), 0)}°` +
      ` | 걸음 부탁 ${pc(rq.length, n)} 거절 ${rq.length - acc.length} 디딤 ${pl.length}/${acc.length} 길이 ${f(avg(rq.map((r) => r.reqFwd)))}m 탭→디딤 ${f(avg(pl.map((r) => r.tPlant)))}s 탭→첫 디딤 ${f(avg(rs.filter((r) => r.tTD != null).map((r) => r.tTD)))}s 골반 ${f(avg(rs.map((r) => r.pelMax)))}m | 겨눔 ${pc(rs.filter((r) => r.finOn).length, n)} d0 ${f(avg(rs.map((r) => r.d0)))}`,
  );
}

const count = (a) => a.reduce((m, k) => ((m[k] = (m[k] || 0) + 1), m), {});
const mx = (a) => (a.length ? Math.max(...a) : NaN);
const mn = (a) => (a.length ? Math.min(...a) : NaN);

/** 찍기 시작 때 겨눔 (손 높이 명령 대 도달, 칼 각도, 칼 선) */
function armLine(label, rs) {
  const g = rs.filter((r) => r.arm);
  if (!g.length) return console.log(`겨눔 ${label.padEnd(4)} go 0/${rs.length}`);
  const a = g.map((r) => r.arm);
  const top = FINISH.top;
  console.log(
    `겨눔 ${label.padEnd(4)} go ${g.length}/${rs.length} · 손 높이 명령 ${f(a[0].cmdY)} → 도달 ${f(avg(a.map((x) => x.y)))}/${f(mn(a.map((x) => x.y)))}m (평균/최소, 머리 꼭대기 ${f(avg(a.map((x) => x.headTop)))}) · 앞 ${f(avg(a.map((x) => x.x)))}m 옆 ${f(avg(a.map((x) => x.z)))}m` +
      ` · 칼 수평 아래 ${f(avg(a.map((x) => x.bladeEl)), 0)}/${f(mn(a.map((x) => x.bladeEl)), 0)}° · 칼 축↔몸 점 선 ${f(avg(a.map((x) => x.lineAng)), 1)}/${f(mx(a.map((x) => x.lineAng)), 1)}° · miss ${f(avg(a.map((x) => x.miss)))}/${f(mx(a.map((x) => x.miss)))}m (> top ${a.filter((x) => x.miss > top).length})` +
      ` · 탭→go ${f(avg(a.map((x) => x.tGo)))}/${f(mx(a.map((x) => x.tGo)))}s · 칼끝 최고 ${f(avg(g.map((r) => r.tipV)), 1)}m/s`,
  );
}

function killBlock(rows, guards, dists, falls, N) {
  const n = rows.length;
  const k = rows.filter((r) => r.kill);
  const down = rows.filter((r) => r.down);
  console.log(
    `즉사 ${k.length}/${n} (${pc(k.length, n)}) · 원인 ${JSON.stringify(count(k.map((r) => r.cause)))} · 탭→죽음 평균/최대 ${f(avg(k.map((r) => r.tDeath)))}/${f(mx(k.map((r) => r.tDeath)))}s` +
      ` · 쿨다운에 가린 찍기 찌르기 ${rows.reduce((m, r) => m + r.shadow, 0)} (판 ${rows.filter((r) => r.shadow).length}) · minEnergy 아래 ${rows.reduce((m, r) => m + r.lowE, 0)} (판 ${rows.filter((r) => r.lowE).length})` +
      ` · 즉사 조건 위반 ${rows.reduce((m, r) => m + r.viol, 0)} (0이어야) · 탭 마무리 ${down.length}/${n} · go 없음 ${down.filter((r) => !r.go).length} · 탭 안 끝남 ${rows.filter((r) => r.tapLeft).length}`,
  );
  const nk = rows.filter((r) => !r.kill);
  console.log(`못 죽인 까닭 ${JSON.stringify(count(nk.map((r) => r.why)))}`);
  armLine('전체', rows);
  for (const g of guards) armLine(g, rows.filter((r) => r.guard === g));
  const a = rows.filter((r) => r.arm).map((r) => r.arm);
  if (a.length)
    console.log(
      `겨눔 도착 up ${JSON.stringify(count(a.map((x) => x.upWhy ?? '-')))} line ${JSON.stringify(count(a.map((x) => x.lineWhy ?? '-')))} · 걷기 끝 ${JSON.stringify(count(a.map((x) => x.walkEnd ?? '없음')))} · 걸음 ${a.filter((x) => x.walked).length} · 디딤 평균 ${f(avg(a.map((x) => x.plants ?? 0)), 1)} · 닿는 곳 밖 go ${a.filter((x) => x.inside === false).length} · short 평균 ${f(avg(a.filter((x) => x.short != null).map((x) => x.short)))}m`,
    );
  // 즉사 칸: 자세 × 거리 (줄) × 방향 (칸)
  console.log(`즉사 칸 (k/n): ${'자세 거리'.padEnd(9)} ${falls.map((x) => x.padStart(8)).join('')}`);
  const low = [];
  for (const g of guards)
    for (const d of dists) {
      const cells = falls.map((fl) => {
        const rs = rows.filter((r) => r.guard === g && r.dist === d && r.fall === fl);
        const kk = rs.filter((r) => r.kill).length;
        if (rs.length && kk < 0.8 * rs.length) low.push({ g, d, fl, kk, rs });
        return `${kk}/${rs.length}`.padStart(8);
      });
      console.log(`               ${`${g} ${d}m`.padEnd(9)} ${cells.join('')}`);
    }
  console.log(`80% 아래 칸 ${low.length}${low.length ? ':' : ''}`);
  for (const c of low)
    console.log(
      `  ${c.g} ${c.d}m ${c.fl} ${c.kk}/${c.rs.length}: ` +
        c.rs
          .filter((r) => !r.kill)
          .map((r) => `s${r.seed}[${r.why} ${r.fin ? `${r.fin.part}/${r.fin.kin}${r.fin.kin !== r.fin.type ? `→${r.fin.type}` : ''}/${f(r.fin.along)}/${f(r.fin.energy, 0)}J` : r.first ? `${r.first.part}/${r.first.type}` : '-'} line ${f(r.arm?.lineAng, 1)}° miss ${f(r.arm?.miss)} achY ${f(r.arm?.y)} walk ${r.arm?.walkEnd ?? '-'}${r.drops.length ? ` ${r.drops.join(',')}` : ''}]`)
          .join(' '),
    );
  const byG = guards.map((g) => { const rs = rows.filter((r) => r.guard === g); return `${g} ${pc(rs.filter((r) => r.kill).length, rs.length)}`; });
  const byD = dists.map((d) => { const rs = rows.filter((r) => r.dist === d); return `${d}m ${pc(rs.filter((r) => r.kill).length, rs.length)}`; });
  const byF = falls.map((fl) => { const rs = rows.filter((r) => r.fall === fl); return `${fl} ${pc(rs.filter((r) => r.kill).length, rs.length)}`; });
  console.log(`즉사 자세별 ${byG.join(' · ')} | 거리별 ${byD.join(' · ')} | 방향별 ${byF.join(' · ')}`);
}

/** 판금·투구: 찍기 즉사 부위 접촉 (첫 찍는 중 접촉) */
function armourBlock(rows) {
  const k = rows.filter((r) => r.kill);
  const pf = rows.filter((r) => r.fin?.plunging && r.fin.plate);
  const ps = pf.filter((r) => r.fin.kin === 'stab'); // 칼 움직임으로 찌르기 (문턱에 막혀 멍으로 낮춰진 것 포함)
  console.log(
    `판금: 즉사 ${k.length}/${rows.length} · 찍기 몸통 접촉 판금 위 ${pf.length}: 찌르기 ${ps.length} eff 평균 ${f(avg(ps.map((r) => r.fin.eff)), 0)}J / 문턱 평균 ${f(avg(ps.map((r) => r.fin.thr)), 0)}J · eff>thr ${ps.filter((r) => r.fin.eff > r.fin.thr).length}` +
      ` · 판이 칼을 막고도(pass false) 죽음 ${ps.filter((r) => !r.fin.pass && r.kill).length} · 판을 뚫고(pass) 죽음 ${ps.filter((r) => r.fin.pass && r.kill).length} · 판에 미끄러져 찌르기 아님(베기·둔기) ${pf.filter((r) => r.fin.kin !== 'stab').length} · 몸통 못 닿음 ${rows.filter((r) => r.why === '몸통못닿음' || r.why === '안닿음').length}`,
  );
  const hf = rows.filter((r) => r.fin?.helmet);
  if (hf.length) {
    const hs = hf.filter((r) => r.fin.kin === 'stab');
    console.log(`투구: 찍기 머리 접촉 ${hf.length}: 찌르기 ${hs.length} eff ${f(avg(hs.map((r) => r.fin.eff)), 0)}J / 문턱 ${f(avg(hs.map((r) => r.fin.thr)), 0)}J · 막고도 죽음 ${hs.filter((r) => !r.fin.pass && r.kill).length} · 미끄러짐 ${hf.length - hs.length}`);
  }
}

function report(rows, guards, dists, falls, tag) {
  console.log(`── ${tag} ──`);
  for (const g of guards) line(g, rows.filter((r) => r.guard === g));
  for (const d of dists) line(`${d}m`, rows.filter((r) => r.dist === d));
  for (const fl of falls) line(fl, rows.filter((r) => r.fall === fl));
  line('전체', rows);
  // 칸: 자세 × 거리 상처율 (닿음)
  console.log(`칸 (상처% / 닿음%): ${'자세'.padEnd(4)} ${dists.map((d) => `${d}m`.padStart(11)).join('')}`);
  for (const g of guards) {
    const cells = dists.map((d) => {
      const rs = rows.filter((r) => r.guard === g && r.dist === d);
      return `${pc(rs.filter((r) => r.wound).length, rs.length)}/${pc(rs.filter((r) => r.first).length, rs.length)}`.padStart(11);
    });
    console.log(`                   ${g.padEnd(4)} ${cells.join('')}`);
  }
  const t = rows.filter((r) => r.tor);
  const types = {};
  for (const r of t) types[r.tor.type] = (types[r.tor.type] || 0) + 1;
  console.log(`몸통 첫 접촉 판정 ${JSON.stringify(types)} · 뻗는 중(thrustPush) ${pc(t.filter((r) => r.tor.push).length, t.length)} · 판금 위 ${t.filter((r) => r.tor.plate).length}`);
  const pl = t.filter((r) => r.tor.plate && r.tor.thr != null);
  if (pl.length) console.log(`판금 위 몸통 접촉 ${pl.length}: eff ${f(avg(pl.map((r) => r.tor.eff)), 0)}J 문턱 ${f(avg(pl.map((r) => r.tor.thr)), 0)}J · 문턱 넘음 ${pl.filter((r) => r.tor.eff > r.tor.thr).length}`);
  const miss = rows.filter((r) => !r.wound);
  if (miss.length) console.log(`상처 없음 ${miss.length}: ${miss.map((r) => `${r.guard}${r.dist}${r.fall[0]}:${r.tor ? `${r.tor.type}${f(r.tor.eff ?? r.tor.energy, 0)}/${f(r.tor.thr, 0)}J` : r.first ? `${r.first.part}` : '안닿음'}`).join(' ')}`);
  killBlock(rows, guards, dists, falls);
  if (rows.some((r) => r.plate)) armourBlock(rows);
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const pos = args.filter((a) => !a.startsWith('--'));
  const opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
  const N = +(pos[0] || 3);
  const weapon = pos[1] || 'longsword';
  const S0 = +(opt('seed') ?? 1);
  const guards = opt('guards')?.split(',') ?? Object.keys(PADS);
  const dists = opt('dists')?.split(',').map(Number) ?? [0.5, 0.8, 1.1, 1.4, 1.6];
  const falls = opt('falls')?.split(',') ?? Object.keys(FALLS);
  const armour = opt('armour') ?? 'both';
  const fallNo = Object.fromEntries(Object.keys(FALLS).map((k, i) => [k, i]));
  if (args.includes('--stand')) {
    console.log(`탭 찌르기 대조: 서 있는 상대 · ${weapon} · 자세마다 간격 1.2/1.5/1.8m × ${N}판`);
    for (const guard of guards)
      for (const gap of [1.2, 1.5, 1.8])
        for (let s = S0; s < S0 + N; s++) {
          const r = standTrial({ guard, gap, seed: 300 + 11 * s + Math.round(gap * 10), weapon });
          console.log(`${guard} ${gap} s${s} ok ${r.ok} down ${r.down} 걸음 ${r.reqd} 첫 ${r.first} 상처 ${r.wound} ${r.sev.toFixed(4)} 골반 ${r.pel} 죽음 ${r.dead} ${r.cause}`);
        }
  } else {
    console.log(`마무리 찌르기 (쓰러진 상대에게 탭) · ${weapon} · 칸마다 ${N}판 · 자세 ${guards} · 거리 ${dists} · 방향 ${falls} · 재는 시간 ${WIN}s`);
    for (const plate of armour === 'both' ? [false, true] : [armour === 'plate']) {
      const rows = [];
      for (const guard of guards)
        for (const dist of dists)
          for (const fall of falls)
            for (let s = S0; s < S0 + N; s++) rows.push(finishTrial({ guard, dist, fall, seed: 500 + 17 * s + Math.round(dist * 100) + fallNo[fall] * 1000, weapon, plate }));
      report(rows, guards, dists, falls, plate ? '판금 (하인리히 겉모습)' : '맨몸 (기본 적 겉모습)');
      if (args.includes('--rows')) for (const r of rows) console.log(JSON.stringify(r));
    }
  }
}

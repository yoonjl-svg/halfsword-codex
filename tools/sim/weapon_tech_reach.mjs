// 무기 × 기술별 "닿는 거리 보정"(TECH[].reach) 실측 도구.
// 캐릭터 PM의 유파 계약(schools.js)에서 AI는 기술 t를 쓸 때 need = measure.contact + t.reach (+0.05) 거리까지
// 들어가서 친다(ai.js). 그러니 무기가 바뀌면 기술마다 t.reach 도 다시 재야 한다 — 이 도구는
// weapon_measure.mjs 와 같은 방법(상대를 치우고 혼자 스크립트 스윙, 칼날 타격점이 표적 높이 띠를 지날 때의
// 최대 전방 거리)을 기술 전부에 돌려서, 무기별로
//   techContact  = 그 기술로 닿는 거리(롱소드 zornhau 가 1.62 가 되는 배율로 보정)
//   reachCorr    = techContact − 그 무기의 measure.contact(zornhau)  ← schools.js 의 TECH[].reach 자리에 넣을 값
// 을 찍는다. 표적 높이 띠는 기술이 노리는 빈틈(open)에 따라: 머리(H/UL/UR) 1.45~1.75, 가슴(C) 1.15~1.45,
// 다리·아랫배(LL/LR) 0.75~1.15. 베기는 칼날 70% 지점, 찌르기는 칼끝(97%)을 타격점으로 본다.
// 롱소드로 돌린 결과를 ai_techniques.js 의 원래 TECH[].reach(개발자가 실제 충돌로 정한 값)와 견주면
// 이 kinematic 방법이 얼마나 믿을 만한지 알 수 있다 — 결론부터 말하면 절대값은 안 맞는다(횡베기·찌르기는
// 실제 충돌 판정과 수십 cm 차이). 그래서 schools.js 에 넣을 값은 절대값이 아니라
//   reachDelta = reachCorr(무기, 기술) − reachCorr(롱소드, 기술)      (무기가 바뀌어 생긴 차이만)
//   suggested  = 원래 TECH.reach + reachDelta
// 로 낸다. 롱소드 기술 보정은 개발자 실측을 그대로 믿고, 무기 차이만 kinematic 으로 얹는 셈이다.
// 타격점 추적은 스윙 시작 후 WINDOW 초 안으로 제한한다(그 뒤는 팔이 다 뻗은 채 몸이 기우는 값이라 무의미).
// 자기 검증: 롱소드에서 이 방법의 reachCorr 가 원래 TECH.reach 와 VALID_TOL(m) 넘게 어긋나는 기술은
// 방법 자체가 그 기술을 못 재는 것이므로(횡베기 zwerch·머리 위 oberhau 가 그렇다 — 높이 띠 하나로는
// 궤적의 어느 점이 "닿는" 점인지 못 정한다) 모든 무기에서 '(불안정)' 으로 표시하고 값을 내지 않는다.
//
// 사용법: node tools/sim/weapon_tech_reach.mjs [무기id...] (생략 시 롱소드만)
import { newRound, DT } from './harness_m.mjs';
import { WEAPONS } from '../../src/weapons.js';
import { TECH, TECH_BY_NAME } from '../../src/ai_techniques.js';

const CHAMBER_TIME = 0.5;
const SWING_TIME = 0.35;
const WINDOW = 0.8; // 스윙 시작 후 이 시간 안의 타격점만 본다
// 찌르기 다섯은 롱소드에서 한결같이 +0.28~0.34 만큼 원래 값보다 크게 나온다(칼끝이 다 뻗은 순간을 세는
// kinematic 편향, 다섯 기술 모두 같은 부호·크기) — 이런 균일한 편향은 무기 간 차이(delta)에는 남지 않으므로
// 허용하고, 부호·크기가 제멋대로인 oberhau(−0.48)·zwerch(−1.06)·zwerchL(−0.57)만 걸러지도록 0.35 로 둔다.
const VALID_TOL = 0.35; // 롱소드 자기 검증 허용 오차 (m)
const BANDS = { H: [1.45, 1.75], UL: [1.45, 1.75], UR: [1.45, 1.75], C: [1.15, 1.45], LL: [0.75, 1.15], LR: [0.75, 1.15] };

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function measureTech(weaponId, tech) {
  const G = newRound({ weapon: weaponId, weapon2: weaponId, seed: 1 });
  G.park();
  const att = G.player;
  const path = [tech.from, ...tech.path];
  const band = BANDS[tech.open] || BANDS.H;
  const pt = tech.kind === 'thrust' ? 0.97 : 0.7;
  let phase = 'chamber';
  let phaseT = 0;
  let maxFwd = -Infinity;
  let atT = 0;
  let startChest = null;
  let startFwd = null;
  for (let i = 0; i < 3 / DT; i++) {
    phaseT += DT;
    if (phase === 'chamber') {
      att.handOffset.set(tech.from[0], tech.from[1]);
      att.move.set(0, 0);
      if (phaseT > CHAMBER_TIME) {
        phase = 'swing';
        phaseT = 0;
        const c = att.bodies.chest.translation();
        startChest = { x: c.x, y: c.y, z: c.z };
        const f = att.forward();
        startFwd = { x: f.x, y: f.y, z: f.z };
      }
    } else if (phase === 'swing') {
      const u = Math.min(1, phaseT / SWING_TIME);
      const seg = u < 0.5 ? [path[0], path[1], u * 2] : [path[1], path[2], (u - 0.5) * 2];
      const [x, y] = lerp(seg[0], seg[1], seg[2]);
      att.handOffset.set(x, y);
      att.move.set(0, 0);
    }
    G.step();
    if (phase === 'swing' && phaseT <= WINDOW) {
      const p = att.bladePoint(pt);
      if (p.y > band[0] && p.y < band[1]) {
        const fwd = (p.x - startChest.x) * startFwd.x + (p.z - startChest.z) * startFwd.z;
        if (fwd > maxFwd) { maxFwd = fwd; atT = phaseT; }
      }
    }
  }
  return { raw: maxFwd, t: atT };
}

const longswordRaw = measureTech('longsword', TECH_BY_NAME.zornhau).raw;
const CAL = 1.62 / longswordRaw;
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['longsword'];
console.log(`보정 배율(롱소드 zornhau raw ${longswordRaw.toFixed(3)}m → 1.62m): ${CAL.toFixed(4)}\n`);

/** 무기 하나의 기술별 techContact(보정 후)·reachCorr 표 */
function tableFor(id) {
  const base = measureTech(id, TECH_BY_NAME.zornhau).raw * CAL;
  const rows = {};
  for (const t of TECH) {
    const m = measureTech(id, t);
    const tc = m.raw * CAL;
    rows[t.name] = { techContact: tc, corr: Number.isFinite(tc) ? tc - base : NaN, t: m.t };
  }
  return { base, rows };
}
const LS = tableFor('longsword');
// 자기 검증: 롱소드 reachCorr 와 원래 TECH.reach 의 차이가 크면 그 기술은 이 방법으로 못 잰다
const unstable = new Set(TECH.filter((t) => !Number.isFinite(LS.rows[t.name].corr) || Math.abs(LS.rows[t.name].corr - t.reach) > VALID_TOL).map((t) => t.name));
console.log(`이 방법으로 못 재는 기술(롱소드 자기 검증 실패, |오차|>${VALID_TOL}m): ${[...unstable].join(', ') || '없음'}\n`);
const fmt = (x, sign = false) => (Number.isFinite(x) ? (sign && x >= 0 ? '+' : '') + x.toFixed(2) : '  —');
const out = {};
for (const id of ids) {
  if (!WEAPONS[id]) { console.log(`(모르는 무기 id: ${id})`); continue; }
  const W = id === 'longsword' ? LS : tableFor(id);
  console.log(`## ${id}  (measure.contact = zornhau ${W.base.toFixed(2)}m, 롱소드 ${LS.base.toFixed(2)}m)`);
  console.log('기술            open  kind    techContact  reachCorr | 롱소드 reachCorr  원래 TECH.reach | reachDelta  suggested');
  out[id] = {};
  for (const t of TECH) {
    const r = W.rows[t.name], l = LS.rows[t.name];
    const delta = unstable.has(t.name) ? NaN : r.corr - l.corr;
    const suggested = Number.isFinite(delta) ? t.reach + delta : NaN;
    out[id][t.name] = Number.isFinite(suggested) ? +suggested.toFixed(2) : null;
    console.log(`${t.name.padEnd(15)} ${String(t.open).padEnd(5)} ${t.kind.padEnd(7)} ${fmt(r.techContact).padStart(7)}     ${fmt(r.corr, true).padStart(6)} |    ${fmt(l.corr, true).padStart(6)}          ${fmt(t.reach, true).padStart(6)}    |   ${fmt(delta, true).padStart(6)}     ${fmt(suggested, true).padStart(6)}${unstable.has(t.name) ? '  (불안정: 방법 한계)' : ''}`);
  }
  console.log('');
}
console.log('// schools.js 용: 무기별 기술 reach 제안값 (원래 TECH.reach + 무기 차이)');
console.log(JSON.stringify(out, null, 1));

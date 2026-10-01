// 자루 무기(몸 틀 E) 물리 가능성 실험 (docs/pole_frame_design.md §1): 지금 물리 그대로 2.4 m 봉을 쥘 수 있나.
//  무기 목록에는 넣지 않는다 — 이 도구 안에서만 롱소드 스펙을 베껴 "staff_proto" 를 만든다.
//   앞손 = 칼 원점, 봉은 앞손 앞으로 1.2 m · 뒤로 1.2 m, 빈손(뒷손)은 gripAlong 만큼 뒤를 쥔다(스프링). 날 없음(둔기).
//   node tools/sim/hybrid.mjs staff_proto.mjs [gripAlong=-0.6] [AI 유파=longsword]
//  잰다: ① 자세 14곳을 들고 있을 때 손 오차·칼끝 오차·뒷손이 쥐고 있나(gripping) ② NaN ③ 혼자 휘둘러 봉끝 속도 ④ 롱소드 상대 2N판
import { newRound, DT, THREE } from './harness_m.mjs';
import { WEAPONS } from '../../src/weapons.js';
import { AI } from '../../src/ai.js';
import { GUARD_BASE } from '../../src/guards.js';
import { wilson } from './ref_duel.mjs';
import { applyMotionLibrary, motionFor, MOTION } from '../../src/motion_library.js';
for (const k of (process.env.POLE_STRIKES ?? '').split(',').filter(Boolean)) MOTION.poleStrikes.add(k); // 봉에 더 줄 칼 기술 (예: oberhau)
import { SCHOOLS } from '../../src/schools.js';
import { zoneEffects, zoneTick } from './blunt_zones.mjs';
const LIB = process.env.LIB === '1'; // 자루 무기 자세표(POLE_GUARDS)·찌르기 방식 기술을 입힌다
// 둔기 부위 효과표 시제품 (ZONES=1): tools/sim/blunt_zones.mjs
const ZONES = process.env.ZONES === '1';
const zoneLog = {};

const along = +(process.argv[2] ?? -0.6);
const L = 1.2; // 앞손 앞 길이
const R = 1.2; // 앞손 뒤 길이
const base = WEAPONS.longsword;
// 봉 관성 (균일 막대 한 토막): 가로 관성 m·L²/12, 축 관성은 작게
const rod = (m, len) => ({ Ie: (m * len * len) / 12, It: 0.00006 * (m / 0.9) });
const front = rod(0.9, L);
const rear = rod(0.9, R);
WEAPONS.staff_proto = {
  ...base,
  id: 'staff_proto',
  nameKo: '봉 (시제품)',
  grip: 'two-hand',
  twoHand: true,
  material: 'wood',
  edged: !!process.env.STAFF_EDGED && process.env.STAFF_EDGED !== '0', // 창(STAFF_EDGED=1): 앞끝에 날 — 찌르기는 stab 판정(출혈·치명상 규칙 그대로). 창날 질량은 봉과 같게 둔다(모양만 시험)
  mThrust: +(process.env.STAFF_MTHRUST ?? 1),
  mCut: +(process.env.STAFF_MCUT ?? 0.5),
  mBlunt: +(process.env.STAFF_MBLUNT ?? 1.2),
  // 창날만 날(STAFF_EDGED=2): 판정에서 '칼날' 은 앞끝 0.25 m 뿐, 자루는 둔기 (combat.js isBlade: local.y > hiltLength). 길이 합은 그대로
  hiltLength: process.env.STAFF_EDGED === '2' ? L - 0.25 : 0.0,
  bladeLength: process.env.STAFF_EDGED === '2' ? 0.25 : L,
  gripAlong: along,
  frame: 'pole',
  style: process.env.STAFF_STYLE ?? 'thrust', // 봉끝 찌르기(dart)가 주 공격 [원전 2차] — 날이 없어 판정은 둔기 찌름
  partMesh: null,
  buildParts() {
    return [
      [['box', 0.015, L / 2, 0.015], L / 2, [0.9, 0, front.Ie, front.It], 0x8a6d3b, true],
      [['box', 0.015, R / 2, 0.015], -R / 2, [0.9, 0, rear.Ie, rear.It], 0x8a6d3b, false],
    ];
  },
};
const W = WEAPONS.staff_proto;
// 봉끝 찌르기 (STAFF_THRUST=estoc|rapier): 찌르기 기술을 탭 찌르기(칼 선을 따라 칼끝을 상대 가슴으로 뻗기, skill.js thrust)로 한다.
//  뒷손 지렛대(Ruck)는 아직 없다 — 지금 있는 칼끝 찌르기로 봉 축 찌름이 나오는지 먼저 본다
if (process.env.STAFF_THRUST) W.thrustStyle = WEAPONS[process.env.STAFF_THRUST].thrustStyle;
console.log(`봉 시제품: 길이 ${(L + R).toFixed(1)} m, 앞손 앞 ${L} m · 뒤 ${R} m, 뒷손 gripAlong ${along} m, 질량 1.8 kg`);

// ① 자세
{
  const G = newRound({ walls: false, weapon: 'staff_proto', weapon2: 'longsword', seed: 7 });
  G.park();
  const P = G.player;
  let nan = false;
  const rows = [];
  for (let i = 0; i < GUARD_BASE.length; i++) {
    const pd = GUARD_BASE[i].pad;
    P.handOffset.set(pd[0], pd[1]);
    P.skill.aimRaw?.set?.(pd[0], pd[1]);
    let hErr = 0, aErr = 0, grip = 0, k = 0;
    for (let t = 0; t < 1.4; t += DT) {
      G.step();
      const v = P.sword.linvel();
      if (![v.x, v.y, v.z].every(Number.isFinite)) nan = true;
      if (t > 1.0) {
        const s = P.sword.translation();
        hErr += P.handTarget.distanceTo(new THREE.Vector3(s.x, s.y, s.z));
        const r = P.sword.rotation();
        const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w));
        const gp = P.guardPose;
        aErr += (ax.angleTo(new THREE.Vector3(gp.dir[0], gp.dir[1], gp.dir[2]).applyQuaternion(P.yaw)) * 180) / Math.PI;
        grip += P.gripping ? 1 : 0;
        k++;
      }
    }
    rows.push(`${GUARD_BASE[i].name} 손 ${((100 * hErr) / k).toFixed(0)}cm 칼끝 ${(aErr / k).toFixed(0)}° 뒷손 ${Math.round((100 * grip) / k)}%`);
  }
  console.log('① 자세 (롱소드 자세표 그대로, 1.0~1.4초 평균):\n  ' + rows.join('\n  '));
  console.log(`  NaN: ${nan}`);
}
// ③ 혼자 휘두르기: 지붕 ↔ 바보 왕복, 봉끝·뒷끝 속도
{
  const G = newRound({ walls: false, weapon: 'staff_proto', weapon2: 'longsword', seed: 7 });
  G.park();
  const P = G.player;
  let vTip = 0, vButt = 0;
  for (let n = 0; n < 4; n++) {
    const pd = n % 2 ? [0.0, -0.5] : [0.02, 0.52];
    P.handOffset.set(pd[0], pd[1]);
    P.skill.aimRaw?.set?.(pd[0], pd[1]);
    for (let t = 0; t < 0.7; t += DT) {
      G.step();
      const r = P.sword.rotation();
      const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
      const p = P.sword.translation();
      const at = (y) => new THREE.Vector3(0, y, 0).applyQuaternion(q).add(new THREE.Vector3(p.x, p.y, p.z));
      const u1 = P.sword.velocityAtPoint(at(L));
      const u2 = P.sword.velocityAtPoint(at(-R));
      vTip = Math.max(vTip, Math.hypot(u1.x, u1.y, u1.z));
      vButt = Math.max(vButt, Math.hypot(u2.x, u2.y, u2.z));
    }
  }
  console.log(`③ 지붕↔바보 왕복: 봉끝 최고 ${vTip.toFixed(1)} m/s · 뒷끝 최고 ${vButt.toFixed(1)} m/s`);
}
// ④ 롱소드 상대 (봉 쪽 AI 는 롱소드 유파·롱소드 간격 그대로 — 자루 무기 유파가 없다)
{
  const N = +(process.env.STAFF_N ?? 12); // 자리마다 판 수
  const school = process.argv[3] ?? 'longsword';
  if (LIB) {
    const m = motionFor(WEAPONS.staff_proto);
    SCHOOLS.staff_lib = { ...SCHOOLS[school], id: 'staff_lib', tech: m.tech, techByName: Object.fromEntries(m.tech.map((t) => [t.name, t])), feints: m.feints, ...(m.counter ? { counter: m.counter } : {}) };
    // 기다림 전술(STAFF_WAIT=배율): 창·봉은 먼 간격에 서서 들어오는 상대를 맞찌른다 (pole_motion_research.md [원전 2차])
    //  간격을 배율만큼 늘리고, 기술은 찌르기만, 맞받아치기도 찌르기로
    const k = +(process.env.STAFF_WAIT ?? 0);
    if (k) {
      const S = SCHOOLS.staff_lib;
      const th = S.tech.filter((t) => t.kind === 'thrust');
      const M0 = S.measure;
      Object.assign(S, {
        measure: { ...M0, contact: M0.contact * k, reach: M0.reach * k },
        tech: th,
        techByName: Object.fromEntries(th.map((t) => [t.name, t])),
        feints: S.feints.filter((f) => th.some((t) => t.name === f.fake)),
        counter: { default: th.map((t) => t.name) },
      });
    }
  }
  let Wn = 0, Ln = 0, D = 0, nan = 0, dealt = 0, taken = 0, clashes = 0, bandN = 0;
  for (let s = 1; s <= N; s++) {
    for (const xFirst of [true, false]) {
      const seed = (xFirst ? 1000 : 2000) + s;
      const x = { weapon: 'staff_proto', persona: { school: LIB ? 'staff_lib' : school, ...(process.env.STAFF_VOR ? { pers: { vor: +process.env.STAFF_VOR }, level: { guardChance: 0.95 } } : {}) } }; // STAFF_VOR: 달려드는 상대를 맞받아 찌르는 성향(Vor)·기다림
      const y = { weapon: 'longsword', persona: { school: 'longsword' } };
      const Pp = xFirst ? x : y;
      const Ee = xFirst ? y : x;
      const G = newRound({ walls: true, seed, weapon: Pp.weapon, weapon2: Ee.weapon, difficulty: 'normal', persona: Ee.persona, AI2Class: AI, difficulty2: 'normal', persona2: Pp.persona });
      const X = xFirst ? G.player : G.enemy;
      const Y = xFirst ? G.enemy : G.player;
      if (LIB && process.env.STAFF_TABLE !== '0') applyMotionLibrary(X); // STAFF_TABLE=0: 유파(기술)만 라이브러리, 자세표는 롱소드 그대로
      if (ZONES) zoneEffects(Y, zoneLog);
      // 거리 띠(STAFF_BANDS=배율): 상대가 봉끝 안(칼잡이 간격 × 배율)으로 들어오면, 간 보는 중일 때 물러난다 (pole_strike_effects.md ③ B띠 "물러나며 찌르기")
      const XA = xFirst ? G.ai2 : G.ai;
      if (process.env.STAFF_BANDS && XA) {
        const k = +process.env.STAFF_BANDS;
        const up = XA.update.bind(XA);
        XA.update = (dt) => {
          const a = X.bodies.chest.translation(), b = Y.bodies.chest.translation();
          const d = Math.hypot(a.x - b.x, a.z - b.z);
          if ((XA.mode === 'watch' || (process.env.STAFF_BANDS_ANY && XA.mode === 'defend')) && d < XA.M.contact * k) {
            // STAFF_BANDS_ACT=thrust: 물러나지 않고 곧장 찌른다(맞찌르기, stop-thrust) — 손에서 가장 가까운 찌르기 기술
            if (process.env.STAFF_BANDS_ACT === 'thrust') {
              const hand = [X.handOffset.x, X.handOffset.y];
              const th = XA.school.tech.filter((t) => t.kind === 'thrust').sort((p, q) => Math.hypot(p.from[0] - hand[0], p.from[1] - hand[1]) - Math.hypot(q.from[0] - hand[0], q.from[1] - hand[1]))[0];
              if (th && XA.startAttack(th, 'stop', { noFeint: true, fastChamber: true })) bandN++;
            } else { XA.startWithdraw(0.5); bandN++; }
          }
          up(dt);
        };
      }
      let res = 'D';
      for (let i = 0; i < 40 / DT; i++) {
        G.step();
        if (ZONES) zoneTick(Y, DT);
        const v = X.sword.linvel();
        if (![v.x, v.y, v.z].every(Number.isFinite)) { nan++; break; }
        if (X.state === 'dead' || Y.state === 'dead') {
          res = X.state === 'dead' && Y.state === 'dead' ? 'D' : Y.state === 'dead' ? 'W' : 'L';
          break;
        }
      }
      dealt += G.wounds.filter((w) => w.att === X).length;
      taken += G.wounds.filter((w) => w.att === Y).length;
      clashes += G.clashes;
      if (res === 'W') Wn++;
      else if (res === 'L') Ln++;
      else D++;
    }
  }
  if (ZONES) console.log('  부위 효과: ' + (Object.entries(zoneLog).map(([k, v]) => `${k} ${JSON.stringify(v)}`).join(' · ') || '없음'));
  if (process.env.STAFF_BANDS) console.log(`  거리 띠 물러나기 ${bandN}번`);
  console.log(`  봉이 낸 상처 ${dealt} · 받은 상처 ${taken} · 칼 부딪침 ${clashes} (${2 * N}판 합)`);
  const [lo, hi] = wilson(Wn, 2 * N);
  console.log(`④ 롱소드 상대 ${2 * N}판: 승 ${Wn} 패 ${Ln} 무 ${D} · 승률 ${Math.round((100 * Wn) / (2 * N))}% (95% ${Math.round(100 * lo)}~${Math.round(100 * hi)}%) · NaN ${nan}`);
}
void W;

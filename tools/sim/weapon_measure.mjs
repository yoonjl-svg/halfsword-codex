// 무기별 간격 상수(measure: contact/reach/clinch/cutTime) 실측 도구, 2차 버전.
// 캐릭터 PM의 유파 꾸러미 계약(docs/school_contract.md, claude/pm-characters)에 맞춰 잰다.
//
// 1차 시도(상대에게 실제로 맞혀서 이분 탐색)는 몸이 손 목표를 따라가며 흔들리는 탓에 거리에
// 비례해 깔끔히 명중/불명중이 갈리지 않아 버렸다(같은 파일의 git 기록 참고). 이번엔 상대를
// 아예 치우고(park()) 혼자 휘두르는 궤적만 본다:
//   - 정수리를 노리는 분노의 베기(zornhau — 코드 주석에 "가장 잘 통함"이라고 되어 있다)를
//     스크립트로 한 번 휘두르면서, 칼날 70% 지점이 "머리 높이"(y 1.45~1.75m)를 지나는 순간의
//     내 가슴 기준 앞쪽 거리를 매 스텝 기록한다. 그 최댓값이 "이 무기+이 몸이 닿을 수 있는
//     최대 거리"의 kinematic 대응치다 — 상대 몸과의 충돌 판정이 전혀 없어 거리를 몰라도 한 번만
//     돌리면 되고(이분 탐색 불필요), 노이즈도 없다.
//   - 다만 이 값 자체가 원래 개발자가 롱소드를 재서 얻은 contact(1.62m)와 그대로 맞아떨어지진
//     않는다(측정한 롱소드 raw 값은 ~1.41m) — 정확히 같은 기술·타이밍으로 쟀다는 보장이 없어서
//     생기는 체계적 오차로 보고, 롱소드 raw 값이 1.62가 되도록 하는 배율(CALIBRATION)을 모든
//     무기에 똑같이 곱해 보정한다. (상대적인 무기별 차이는 그대로 살아 있다고 본다.)
//   - reach는 같은 스윙에 한 걸음 내딛기(move.y=1)를 더해서 잰다. clinch는 이번에도 실측하지
//     않고 롱소드 비율(0.7716 = clinch/contact)로 유도한다.
//   - cutTime은 그 최대 도달 순간까지 걸린 시간을 그대로 쓴다(거리 보정과 무관하니 배율 없음).
//
// 사용법: node tools/sim/weapon_measure.mjs [무기id...] (생략 시 전체)
import { newRound, DT } from './harness_m.mjs';
import { WEAPONS } from '../../src/weapons.js';
import { TECH_BY_NAME } from '../../src/ai_techniques.js';

const TECH = TECH_BY_NAME.zornhau;
const CHAMBER_TIME = 0.5;
const SWING_TIME = 0.35; // 이 값에서 롱소드 raw contact가 가장 크게(가장 "제대로 휘두른") 나왔다
const HEAD_Y_LO = 1.45;
const HEAD_Y_HI = 1.75;
const CLINCH_RATIO = 1.25 / 1.62; // 롱소드 기준값의 비율을 그대로 물려받는다 (clinch는 따로 안 잰다)

function lerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** weaponId로 혼자 zornhau를 한 번 휘두르며 칼날 70% 지점이 머리 높이를 지나는 순간의
 * 최대 전방 거리(가슴 기준)와 그때까지 걸린 시간을 잰다. lunge=true면 내딛기를 더한다. */
function measureSwing(weaponId, { lunge = false } = {}) {
  const G = newRound({ weapon: weaponId, weapon2: weaponId, seed: 1 });
  G.park();
  const att = G.player;
  const path = [TECH.from, ...TECH.path];
  let phase = 'chamber';
  let phaseT = 0;
  let maxFwd = -Infinity;
  let atT = 0;
  let startChest = null;
  let startFwd = null;
  for (let i = 0; i < 3 / DT; i++) {
    phaseT += DT;
    if (phase === 'chamber') {
      att.handOffset.set(TECH.from[0], TECH.from[1]);
      att.move.set(0, 0);
      if (phaseT > CHAMBER_TIME) {
        phase = 'swing';
        phaseT = 0;
        // "닿는 거리"는 스윙을 시작하는 순간의 가슴 위치·방향 기준이다 — 내딛기(lunge)로
        // 몸이 앞으로 나가는 동안 계속 기준을 다시 잡으면(현재 가슴 기준) 그 전진분이
        // 사라져 버려서, 스윙 시작 시점에 고정해 둔다.
        startChest = att.bodies.chest.translation();
        startChest = { x: startChest.x, y: startChest.y, z: startChest.z };
        startFwd = att.forward();
        startFwd = { x: startFwd.x, y: startFwd.y, z: startFwd.z };
      }
    } else if (phase === 'swing') {
      const u = Math.min(1, phaseT / SWING_TIME);
      const seg = u < 0.5 ? [path[0], path[1], u * 2] : [path[1], path[2], (u - 0.5) * 2];
      const [x, y] = lerp(seg[0], seg[1], seg[2]);
      att.handOffset.set(x, y);
      att.move.set(0, lunge ? 1 : 0);
    }
    G.step();
    if (phase === 'swing') {
      const p = att.bladePoint(0.7);
      if (p.y > HEAD_Y_LO && p.y < HEAD_Y_HI) {
        const forwardDist = (p.x - startChest.x) * startFwd.x + (p.z - startChest.z) * startFwd.z;
        if (forwardDist > maxFwd) {
          maxFwd = forwardDist;
          atT = phaseT;
        }
      }
    }
  }
  return { raw: maxFwd, cutTime: atT };
}

// 보정 배율: 롱소드의 raw contact가 정확히 1.62가 되도록 맞춘다
const longswordRaw = measureSwing('longsword', { lunge: false }).raw;
const CALIBRATION = 1.62 / longswordRaw;

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(WEAPONS);
const rows = [];
console.log(`보정 배율(롱소드 raw ${longswordRaw.toFixed(3)}m → 1.62m 기준): ${CALIBRATION.toFixed(4)}\n`);
for (const id of ids) {
  const c = measureSwing(id, { lunge: false });
  const r = measureSwing(id, { lunge: true });
  const contact = +(c.raw * CALIBRATION).toFixed(2);
  const reach = +(r.raw * CALIBRATION).toFixed(2);
  const clinch = +(contact * CLINCH_RATIO).toFixed(2);
  const cutTime = +c.cutTime.toFixed(2);
  rows.push({ id, contact, reach, clinch, cutTime });
  console.log(`${id.padEnd(16)} contact=${contact}  reach=${reach}  clinch=${clinch}  cutTime=${cutTime}`);
}
console.log('\n' + JSON.stringify(rows, null, 1));

// 온몸 휘두르기 — 칼끝 속도 중 몸통이 만든 몫은 얼마인가
//  상대를 치우고(park) 손 목표를 두 자세 사이로 왕복시키며(weapon_tempo.mjs 와 같은 입력) 휘두를 때마다
//  칼날 70% 지점 최고 속도 v 와, 그 순간 그 점을 가슴에 단단히 붙어 있다고 봤을 때의 속도(몸통 회전·이동이 만든 몫)를 잰다.
//   몸통 몫 = (가슴 강체가 그 점에서 갖는 속도) · (칼 점의 운동 방향) / v
//  세 가지 몸:
//   기본    : 지금 그대로 (자세 지도가 정한 골반·가슴 비틀기를 부드럽게 따라간다, 골반은 교본 값의 절반)
//   몸통 고정: 자세 지도의 골반·가슴 비틀기를 끈다 (팔과 손목만으로 휘두름)
//   온몸    : 골반을 교본 값만큼 다 틀고, 몸통이 더 빨리 따라간다 (골반 34 → 50, 가슴 26 → 40 rad/s)
// 사용법: node tools/sim/body_share.mjs [무기id...]
import { newRound, DT, THREE } from './harness_m.mjs';
import { Fighter } from '../../src/fighter.js';
import { SKILL_BODY } from '../../src/config.js';
import { guardAt } from '../../src/guards.js';
import { STRIKE } from '../../src/config.js';
import { isMain } from './is_main.mjs';

const PAIRS = {
  '어깨↔왼바꿈': [[0.42, 0.42], [-0.4, -0.42]],
  '지붕↔바보': [[0.02, 0.52], [0.0, -0.5]],
};
const SP = 13;

// 몸 모드 — Fighter.prototype.updateBodyPose 를 실험용으로 바꿔 끼운다 (저장소 코드는 그대로)
const origPose = Fighter.prototype.updateBodyPose;
let MODE = '기본';
Fighter.prototype.updateBodyPose = function (dt) {
  if (MODE === '기본') return origPose.call(this, dt);
  const sk = this.skill;
  const gw = this.guardWeight();
  const G = guardAt(sk.aimRaw.x, sk.aimRaw.y, this.bodyGuard, this.finish, sk.thrustPose);
  const bp = this.bodyPose;
  const bv = this.bodyPoseVel;
  const follow = (key, target, w) => {
    bv[key] += (w * w * (target - bp[key]) - 2 * w * bv[key]) * dt;
    bp[key] += bv[key] * dt;
  };
  if (MODE === '몸통 고정') {
    follow('pelvisYaw', 0, SKILL_BODY.pelvis);
    follow('chestYaw', 0, SKILL_BODY.chest);
    follow('pitch', G.pitch * gw, SKILL_BODY.chest);
  } else {
    follow('pelvisYaw', -G.pelvisYaw * 1.0 * gw, 50);
    follow('chestYaw', -G.chestYaw * gw, 40);
    follow('pitch', G.pitch * gw, 40);
  }
  follow('drop', (G.drop - 0.06) * gw, SKILL_BODY.pelvis);
  this.pelvisYawOffset = bp.pelvisYaw;
  this.pelvisDropOffset = bp.drop;
};

function pointAt(f, t) {
  const c = f.weaponCfg;
  const p = f.sword.translation();
  const q = f.sword.rotation();
  return new THREE.Vector3(0, c.hiltLength + t * c.bladeLength, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w)).add(new THREE.Vector3(p.x, p.y, p.z));
}
const vel = (body, p) => {
  const v = body.velocityAtPoint(p);
  return new THREE.Vector3(v.x, v.y, v.z);
};

function run(id, pair, T) {
  const G = newRound({ walls: false, weapon: id, weapon2: 'longsword', seed: 7 });
  G.park();
  const P = G.player;
  const [A, B] = PAIRS[pair];
  P.handOffset.set(A[0], A[1]);
  for (let i = 0; i < 1.5 / DT; i++) {
    P.move.set(0, 0);
    G.step();
  }
  const halfSteps = Math.round(T / DT);
  const rows = [];
  let tgt = B;
  for (let k = 0; k < 10; k++) {
    let best = { v: 0, share: 0, pelvis: 0 };
    for (let i = 0; i < halfSteps; i++) {
      const off = P.handOffset;
      const dx = tgt[0] - off.x;
      const dy = tgt[1] - off.y;
      const d = Math.hypot(dx, dy);
      const st = SP * DT;
      if (d > st) {
        off.x += (dx / d) * st;
        off.y += (dy / d) * st;
      } else off.set(tgt[0], tgt[1]);
      P.move.set(0, 0);
      G.step();
      const p = pointAt(P, 0.7);
      const vp = vel(P.sword, p);
      const v = vp.length();
      if (v > best.v) {
        const dir = vp.clone().divideScalar(Math.max(v, 1e-6));
        best = { v, share: vel(P.bodies.chest, p).dot(dir) / v, pelvis: vel(P.bodies.pelvis, p).dot(dir) / v };
      }
    }
    rows.push(best);
    tgt = tgt === B ? A : B;
  }
  const use = rows.slice(2);
  const m = (k) => use.reduce((a, r) => a + r[k], 0) / use.length;
  return { v: m('v'), share: m('share'), pelvis: m('pelvis') };
}

if (isMain(import.meta.url)) {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['longsword', 'qinggang', 'zweihander'];
  console.log('칸 = 칼날 70% 최고 속도 m/s (그 순간 가슴이 만든 몫 %, 골반이 만든 몫 %) · 판정 에너지 비 = (v / 기본 v)²');
  for (const id of ids) {
    for (const pair of Object.keys(PAIRS)) {
      for (const T of [0.9, 0.45]) {
        const out = {};
        for (const mode of ['기본', '몸통 고정', '온몸']) {
          MODE = mode;
          out[mode] = run(id, pair, T);
        }
        MODE = '기본';
        const base = out['기본'].v;
        const cell = (r) => `${r.v.toFixed(1)} (가슴 ${Math.round(100 * r.share)}%, 골반 ${Math.round(100 * r.pelvis)}%) E×${((r.v / base) ** 2).toFixed(2)}`;
        console.log(`${id.padEnd(11)} ${pair.padEnd(7)} T=${T}s | 기본 ${cell(out['기본'])} | 몸통 고정 ${cell(out['몸통 고정'])} | 온몸 ${cell(out['온몸'])}`);
      }
    }
  }
  console.log(`(참고: 베기 판정의 "칼 뒤 팔·몸 유효 질량"은 STRIKE.armAssist = ${STRIKE.armAssist}kg 고정 — 근력·몸무게·몸통과 무관)`);
}

// ─────────────────────────────────────────────────────────────
//  게임 랙돌 → 막대 인형 관절 (동작 연구 PM). record_game.mjs·record_wbs.mjs 가 같이 쓴다.
//  관절 자리 = 그 관절이 붙은 몸체의 자세 × (관절 기준점 − 몸체 처음 자리). fighter.js partDefs·jointDefs(s = +1 오른손) 값.
//  좌표는 클립과 같다: 기록 시작 때 골반 밑 땅이 원점, x 앞 · y 위 · z 칼 든 쪽.
// ─────────────────────────────────────────────────────────────
import { JOINTS } from './body.mjs';

export const PARTS = {
  pelvis: [0, 0.97, 0], abdomen: [0, 1.13, 0], chest: [0, 1.33, 0], head: [0, 1.62, 0],
  uarmS: [0.15, 1.43, 0.2], farmS: [0.435, 1.43, 0.2], uarmO: [0, 1.28, -0.2], farmO: [0, 0.99, -0.2],
  thighF: [0, 0.715, 0.095], shinF: [0, 0.29, 0.095], footF: [0.05, 0.045, 0.095],
  thighB: [0, 0.715, -0.095], shinB: [0, 0.29, -0.095], footB: [0.05, 0.045, -0.095],
};
// 게임은 칼 든 쪽 발(z+)이 F, 반대 발이 B. 오른손잡이면 F = 오른발
export const ANCHORS = {
  hipC: ['pelvis', [0, 0.93, 0]], waist: ['abdomen', [0, 1.06, 0]], chest: ['chest', [0, 1.33, 0]], neck: ['head', [0, 1.5, 0]], head: ['head', [0, 1.62, 0]],
  shS: ['uarmS', [0, 1.43, 0.2]], elS: ['farmS', [0.3, 1.43, 0.2]], hS: ['farmS', [0.565, 1.43, 0.2]],
  shO: ['uarmO', [0, 1.43, -0.2]], elO: ['farmO', [0, 1.13, -0.2]], hO: ['farmO', [0, 0.87, -0.2]],
  hipL: ['thighB', [0, 0.93, -0.095]], kneeL: ['shinB', [0, 0.5, -0.095]], ankleL: ['footB', [0, 0.08, -0.095]], heelL: ['footB', [-0.07, 0.02, -0.095]], toeL: ['footB', [0.17, 0.02, -0.095]],
  hipR: ['thighF', [0, 0.93, 0.095]], kneeR: ['shinF', [0, 0.5, 0.095]], ankleR: ['footF', [0, 0.08, 0.095]], heelR: ['footF', [-0.07, 0.02, 0.095]], toeR: ['footF', [0.17, 0.02, 0.095]],
};

/** 지금 자세의 원점·방향 (기록 시작 때 한 번) */
export function frameOf(f, THREE) {
  const p = f.bodies.pelvis.translation();
  const fw = f.forward();
  return { origin: new THREE.Vector3(p.x, 0, p.z), yaw0: Math.atan2(fw.z, fw.x) };
}

/** 한 스텝의 관절 평면 배열 (JOINTS 순서, mm 반올림) */
export function jointsOf(f, THREE, fr) {
  const c = Math.cos(-fr.yaw0), s = Math.sin(-fr.yaw0);
  const toLocal = (v) => {
    const d = v.clone().sub(fr.origin);
    return [d.x * c - d.z * s, d.y, d.x * s + d.z * c];
  };
  const J = [];
  for (const name of JOINTS) {
    let w;
    if (name === 'tip') w = f.bladePoint(1, new THREE.Vector3());
    else if (name === 'pommel') {
      const tip = f.bladePoint(1, new THREE.Vector3());
      const hilt = f.bladePoint(0, new THREE.Vector3());
      w = hilt.clone().add(hilt.clone().sub(tip).normalize().multiplyScalar(0.25));
    } else {
      const [part, at] = ANCHORS[name];
      const b = f.bodies[part];
      const r = b.rotation();
      const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
      const home = PARTS[part];
      const tr = b.translation();
      w = new THREE.Vector3(at[0] - home[0], at[1] - home[1], at[2] - home[2]).applyQuaternion(q).add(new THREE.Vector3(tr.x, tr.y, tr.z));
    }
    const l = toLocal(w);
    J.push(+l[0].toFixed(3), +l[1].toFixed(3), +l[2].toFixed(3));
  }
  return J;
}

/** 관절 기록 → 칼끝·손 빠르기 (가운데 차분) */
export function speeds(frames, dt, name) {
  const n = frames.length;
  const k = JOINTS.indexOf(name) * 3;
  return frames.map((_, i) => {
    const a = frames[Math.max(0, i - 1)].J, b = frames[Math.min(n - 1, i + 1)].J;
    const span = (Math.min(n - 1, i + 1) - Math.max(0, i - 1)) * dt;
    return +(Math.hypot(b[k] - a[k], b[k + 1] - a[k + 1], b[k + 2] - a[k + 2]) / span).toFixed(2);
  });
}

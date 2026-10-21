import * as THREE from 'three';
// Exact gripMass formula copied from pinned combat.js 9a8f4bcc for isolated research; no production changes.
const _fq=new THREE.Quaternion(),_Ic=new THREE.Matrix3(),_Im=new THREE.Matrix3(),_R=new THREE.Matrix3(),_M4=new THREE.Matrix4(),_gc=new THREE.Vector3(),_gd=new THREE.Vector3();
export function gripMass(props, S, point, n, handMass) {
  if (!props) return 0.5;
  const { m, I, frame } = props;
  const M = m + handMass;
  // 합친 무게중심 (손 = 칼 원점)
  const c = _gc.copy(S.com).multiplyScalar(m).addScaledVector(S.p, handMass).divideScalar(M);
  // 칼의 관성(주축) → 월드: R·diag(I)·Rᵀ
  _M4.makeRotationFromQuaternion(_fq.copy(S.q).multiply(frame));
  _R.setFromMatrix4(_M4);
  _Ic.set(I.x, 0, 0, 0, Math.max(I.y, 1e-6), 0, 0, 0, I.z);
  _Ic.premultiply(_R).multiply(_Im.copy(_R).transpose());
  // 평행축 정리: 칼 무게중심·손을 합친 무게중심 기준으로 옮긴다  m(|d|²E − d dᵀ)
  const shift = (d, mass) => {
    const e = _Ic.elements;
    const dd = d.x * d.x + d.y * d.y + d.z * d.z;
    const a = [d.x, d.y, d.z];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) e[j * 3 + i] += mass * ((i === j ? dd : 0) - a[i] * a[j]);
  };
  shift(_gd.copy(S.com).sub(c), m);
  shift(_gd.copy(S.p).sub(c), handMass);
  _Ic.invert();
  const rn = _gd.copy(point).sub(c).cross(n);
  const k = rn.x * rn.x * _Ic.elements[0] + rn.y * rn.y * _Ic.elements[4] + rn.z * rn.z * _Ic.elements[8] + 2 * (rn.x * rn.y * _Ic.elements[3] + rn.x * rn.z * _Ic.elements[6] + rn.y * rn.z * _Ic.elements[7]);
  return 1 / (1 / M + k);
}

import {THREE} from '../../../tools/sim/harness_m.mjs';
const _st = (b) => {
  const t = b.translation(), r = b.rotation(), c = b.worldCom(), v = b.linvel(), w = b.angvel();
  return { p: new THREE.Vector3(t.x, t.y, t.z), q: new THREE.Quaternion(r.x, r.y, r.z, r.w), com: new THREE.Vector3(c.x, c.y, c.z), v: new THREE.Vector3(v.x, v.y, v.z), w: new THREE.Vector3(w.x, w.y, w.z) };
};

/**
 * 공격자 att 의 칼로 vic 의 part 를 local(부위 몸 좌표) 점에서 친다. type 'cut' = 칼날 60% 지점, 날을 세워 겉면 안쪽으로 /
 * 'stab' = 칼끝으로 겉면 안쪽으로. 판정 에너지가 E(J)가 되게 빠르기를 맞춘다. combat.strike 를 그대로 부른다 (상처·방어구 닳기·onWound)
 */
export function probeStrike(G, att, vic, part, local, nLocal, E, type) {
  const info = [...G.combat.info.values()];
  const vInfo = info.find((i) => i.fighter === vic && i.part === part);
  const wInfo = info.find((i) => i.fighter === att && i.part === 'blade');
  const P = _st(vInfo.body);
  P.v.set(0, 0, 0); P.w.set(0, 0, 0);
  const point = local.clone().applyQuaternion(P.q).add(P.p);
  const n = nLocal.clone().applyQuaternion(P.q).normalize(); // 겉면 바깥쪽 (월드)
  const sw = _st(wInfo.body);
  const comL = sw.com.clone().sub(sw.p).applyQuaternion(sw.q.clone().invert());
  const HL = att.weaponCfg.hiltLength, BL = att.weaponCfg.bladeLength;
  const up = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const tan = new THREE.Vector3().crossVectors(n, up).normalize();
  let x, y, at;
  if (type === 'stab') { y = n.clone().negate(); x = tan; at = HL + BL; }
  else { x = n.clone().negate(); y = tan; at = HL + 0.6 * BL; }
  const z = new THREE.Vector3().crossVectors(x, y);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  const S = { p: point.clone().addScaledVector(y, -at), q, v: new THREE.Vector3(), w: new THREE.Vector3() };
  S.com = S.p.clone().add(comL.clone().applyQuaternion(q));
  const pr = { w: wInfo, v: vInfo };
  S.v.copy(n).multiplyScalar(-10);
  const r0 = G.combat.analyze(pr, point, S, P, true);
  S.v.copy(n).multiplyScalar(-10 * Math.sqrt(E / r0.energy));
  const ac = att.cache, vc = vic.cache;
  att.cache = { sword: S };
  vic.cache = { parts: { [part]: P } };
  vic.hitCooldowns.clear();
  const r = G.combat.strike(pr, point, false);
  att.cache = ac;
  vic.cache = vc;
  return r;
}


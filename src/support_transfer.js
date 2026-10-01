import * as THREE from 'three';

const point = (body, local, out) => {
  const r = body.rotation(), p = body.translation();
  return out.set(local.x, local.y, local.z).applyQuaternion(q.set(r.x, r.y, r.z, r.w)).add(v.set(p.x, p.y, p.z));
};

/**
 * A bounded, axial virtual leg actuator. This is an internal pelvis–foot force
 * pair, not a measurement of human muscle strength or of native joint work.
 * Fresh joint anchors define the line of action; endpoint forces are central.
 * Only confirmed supporting feet receive a share. Unmet demand is not replaced
 * by another external pelvis force. maxForceN is the muscle-scaled actuator
 * ceiling. Vertical effort is projected onto the extension axis, never divided
 * by its vertical component. This stays continuous as a prone leg crosses level.
 */
export function applyAxialLegSupport(fighter, requestedUpN, contacts, load, maxForceN) {
  const result = { requestedUpN, appliedUpN: 0, unmetUpN: Math.max(0, requestedUpN),
    netForceN: { x: 0, y: 0, z: 0 }, instantaneousPowerW: 0, legs: [],
    blockedByState: fighter.state === 'down' || fighter.state === 'dead' };
  if (result.blockedByState) return result;
  if (!(requestedUpN > 0) || !Number.isFinite(requestedUpN) || !(maxForceN > 0) || !Number.isFinite(maxForceN)) return result;
  const eligible = [];
  let total = 0, rawTotal = 0;
  for (const k of ['F', 'B']) {
    if (!contacts.groups['foot' + k]?.hasSupport || fighter.detachedParts?.has('foot' + k)) continue;
    const health = Math.max(0, Math.min(1, fighter.limbs['leg' + k]));
    const rawWeight = Math.max(0, load[k]);
    const weight = rawWeight * health;
    rawTotal += rawWeight;
    if (weight > 0) { eligible.push({ k, weight, rawWeight, health }); total += weight; }
  }
  for (const { k, weight, rawWeight, health } of eligible) {
    const hip = fighter.jointByName['thigh' + k], ankle = fighter.jointByName['foot' + k];
    if (!hip?.joint || !ankle?.joint) continue;
    point(hip.parent, hip.joint.anchor1(), h);
    point(ankle.child, ankle.joint.anchor2(), a);
    n.subVectors(h, a);
    const length = n.length();
    if (!(length > 1e-6)) continue;
    n.multiplyScalar(1 / length);
    if (!(n.y > 0)) continue;
    const share = weight / total;
    const desired = requestedUpN * share;
    // Health must reduce capacity, not disappear when allocation is normalized.
    const capacityShare = rawWeight / rawTotal * health;
    const cap = maxForceN * capacityShare;
    // The old inverse mapping saturated at full axial force as ny approached 0+,
    // then switched off at 0. Projection fades continuously to zero instead.
    // Before saturation the delivered vertical component is desired * ny^2;
    // the unmet effort is intentional, not an excuse for external rescue force.
    const axial = Math.min(cap, desired * n.y);
    F.copy(n).multiplyScalar(axial);
    const positive = { x: F.x, y: F.y, z: F.z }, negative = { x: -F.x, y: -F.y, z: -F.z };
    const hipPoint = { x: h.x, y: h.y, z: h.z }, anklePoint = { x: a.x, y: a.y, z: a.z };
    const vh = hip.parent.velocityAtPoint(hipPoint), va = ankle.child.velocityAtPoint(anklePoint);
    const power = F.x * (vh.x - va.x) + F.y * (vh.y - va.y) + F.z * (vh.z - va.z);
    hip.parent.addForceAtPoint(positive, hipPoint, true);
    ankle.child.addForceAtPoint(negative, anklePoint, true);
    result.appliedUpN += F.y; result.instantaneousPowerW += power;
    result.legs.push({ side: k, share, capacityShare, health, requestedUpN: desired, appliedUpN: F.y,
      axialForceN: axial, capN: cap, directionY: n.y, lengthM: length,
      instantaneousPowerW: power, hipPoint, anklePoint });
  }
  result.unmetUpN = Math.max(0, requestedUpN - result.appliedUpN);
  return result;
}

const q = new THREE.Quaternion(), v = new THREE.Vector3();
const h = new THREE.Vector3(), a = new THREE.Vector3(), n = new THREE.Vector3(), F = new THREE.Vector3();

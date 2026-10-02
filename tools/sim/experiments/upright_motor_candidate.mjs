// Research helper only: zero ForceBased motor coefficients are not a disabled motor.
// The caller owns world/body lifetimes and assigns the returned joint (possibly null).
const AXES = [3, 4, 5];
const bit = axis => 1 << axis;
const FULL_MASK = AXES.reduce((mask, axis) => mask | bit(axis), 0);

export function createUprightMotorState({ world, createJoint, joint = null, activeAxes = [] }) {
  if (!world || typeof world.removeImpulseJoint !== 'function' || typeof createJoint !== 'function')
    throw new TypeError('Provide the native world and a createJoint function');
  if (!Array.isArray(activeAxes) || activeAxes.some(axis => !AXES.includes(axis)))
    throw new TypeError('activeAxes must contain native angular axes 3/4/5');
  const activeAxisMask = activeAxes.reduce((mask, axis) => mask | bit(axis), 0);
  if (!joint && activeAxisMask) throw new Error('An active-axis mask requires an existing joint');
  // For an existing joint, activeAxes must describe every previously configured motor,
  // including any configured with zero coefficients. Existing active motors are ForceBased.
  return { world, createJoint, joint, activeAxisMask };
}

/** Complete request for all three angular axes; no zero-coefficient calls reach WASM. */
export function configureUprightMotor(state, requests) {
  if (!Array.isArray(requests) || requests.length !== AXES.length)
    throw new TypeError('Provide one request for each native angular axis 3/4/5');
  let nextMask = 0, requestMask = 0;
  for (const request of requests) {
    if (!request || !AXES.includes(request.axis) || requestMask & bit(request.axis))
      throw new TypeError('Angular motor axes must be unique 3/4/5');
    requestMask |= bit(request.axis);
    if (![request.target, request.stiffness, request.damping].every(Number.isFinite)
      || request.stiffness < 0 || request.damping < 0)
      throw new TypeError('Motor targets must be finite; stiffness/damping must be finite and nonnegative');
    if (request.stiffness > 0 || request.damping > 0) nextMask |= bit(request.axis);
  }
  if (requestMask !== FULL_MASK) throw new Error('Incomplete angular request');
  if (state.joint && !state.joint.isValid()) throw new Error('Upright joint was removed outside its controller');

  // Rapier JS has no exposed motor-disable operation. Rebuild the free generic joint
  // whenever a configured motor disappears; preserve body state and the other joints.
  const disabledAxes = state.activeAxisMask & ~nextMask;
  if (state.joint && (!nextMask || disabledAxes)) {
    state.world.removeImpulseJoint(state.joint, true);
    state.joint = null;
    state.activeAxisMask = 0;
  }
  if (!nextMask) return null;
  if (!state.joint) {
    state.joint = state.createJoint();
    if (!state.joint || !state.joint.isValid()) throw new Error('createJoint must return a valid native generic joint');
    state.activeAxisMask = 0;
  }
  for (const request of requests) {
    if (!(nextMask & bit(request.axis))) continue;
    const raw = state.joint.rawSet, handle = state.joint.handle;
    if (!(state.activeAxisMask & bit(request.axis))) raw.jointConfigureMotorModel(handle, request.axis, 1);
    raw.jointConfigureMotorPosition(handle, request.axis, request.target, request.stiffness, request.damping);
  }
  state.activeAxisMask = nextMask;
  return state.joint;
}

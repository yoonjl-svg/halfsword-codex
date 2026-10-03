/** Research-only removal of the sword's uncalibrated global rotational drag.
 * Joint muscles, body damping, gravity, contacts, mass and inertia are unchanged.
 * Zero drag is a short-motion limiting comparison, not calibrated aerodynamics.
 */
export function setSwordDrag(f, mode) {
  if (!['original', 'free'].includes(mode)) throw Error('Unknown sword drag mode');
  const before = f.sword.angularDamping();
  if (Math.abs(before - .3) > 1e-6) throw Error('Unexpected original sword drag');
  if (mode === 'free') f.sword.setAngularDamping(0);
  const after = f.sword.angularDamping();
  if (mode === 'free' ? after !== 0 : after !== before) throw Error('Sword drag selection failed');
  return { mode, beforePerS: before, afterPerS: after };
}

/** Research-only braking at the existing constant-acceleration stopping estimate.
 * The original1.4 anticipatory margin becomes1.0; all physical properties and
 * actuator limits stay intact. This is a planning hypothesis, not human data.
 */
export function setInertiaCandidate(f, mode, trial='drag') {
  if(trial==='drag')return setSwordDrag(f,mode);
  if(trial==='available'){
    if(!['original','candidate'].includes(mode)||f.wristBrakingModel!==undefined||f.armTorqueModel==='sharedCap')
      throw Error('Unexpected wrist forecasting scope');
    if(mode==='candidate')f.wristBrakingModel='available';
    return {trial,mode,model:f.wristBrakingModel??'legacy',margin:f.weaponCfg.releaseMargin};
  }
  if(trial!=='brake'||!['original','candidate'].includes(mode))throw Error('Unknown inertia candidate');
  const before=f.weaponCfg.releaseMargin;
  if(before!==1.4)throw Error('Unexpected original braking margin');
  if(mode==='candidate')f.weaponCfg={...f.weaponCfg,releaseMargin:1};
  return {trial,mode,beforeMargin:before,afterMargin:f.weaponCfg.releaseMargin};
}

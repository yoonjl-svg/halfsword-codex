// Opt-in, one-handed main-arm activation experiment. This changes the getup
// activation target, not wound health, strength, joint gains or other limbs.
// Fighter.step calls update before filtering the ordinary whole-body muscle.
const mainArmRecovery = new WeakMap();

const eligible = (f) => f.armRecoveryModel === 'independent' && !f.weaponCfg.twoHand;

export function updateMainArmRecovery(f, dt, ordinaryTargetMuscle) {
  if (!eligible(f)) {
    mainArmRecovery.delete(f);
    return;
  }
  let activation = mainArmRecovery.get(f);
  if (!activation) {
    activation = { value: f.muscle, target: ordinaryTargetMuscle };
    mainArmRecovery.set(f, activation);
  }
  activation.target = f.state === 'getup' ? f.vigor : ordinaryTargetMuscle;
  activation.value += (activation.target - activation.value) *
    Math.min(1, dt * (activation.target > activation.value ? 4 : 12));
}

export function mainArmMuscle(f) {
  return eligible(f) ? (mainArmRecovery.get(f)?.value ?? f.muscle) : f.muscle;
}

export function readMainArmRecovery(f) {
  const activation = eligible(f) ? mainArmRecovery.get(f) : undefined;
  return {
    enabled: !!activation,
    value: activation?.value ?? f.muscle,
    target: activation?.target ?? null,
  };
}

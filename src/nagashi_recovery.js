// Opt-in research: a brief loss of arm control after an actual Japanese flow.
// Values are game-design candidates, not measured physiological constants.
export const FLOW_RECOVERY = { seconds: 0, floor: 0.25, release: false };

export function beginFlowRecovery(f, defender) {
  const duration = FLOW_RECOVERY.seconds;
  if (!(duration > 0) || !f.alive || !f.armed || f.state !== 'stand') return false;
  const now = f.stamina.time, id = f.stamina.attackId;
  const old = f.flowRecovery;
  // One penalty per attack; recontacts cannot extend an active recovery either.
  if (old && (now < old.until + 0.12 || (id > 0 && id === old.attackId))) return false;
  f.flowRecovery = { start: now, until: now + duration, duration, attackId: id,
    defender: defender.index, floor: FLOW_RECOVERY.floor };
  return true;
}

export function flowRecoveryScale(f) {
  const s = f.flowRecovery;
  if (!s || !f.alive || !f.armed || f.state !== 'stand') return 1;
  const t = f.stamina.time - s.start;
  if (t >= s.duration) return 1;
  // First third: yield to the blade's momentum. Last two thirds: smoothly regain
  // control. No velocity reset, hand teleport, input deletion or movement lock.
  const x = Math.max(0, Math.min(1, (t / s.duration - 1 / 3) * 1.5));
  return s.floor + (1 - s.floor) * x * x * (3 - 2 * x);
}

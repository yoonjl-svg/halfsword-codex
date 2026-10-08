// The selected trial uses today's player controls. It remains outside card draws;
// explicit historical/research entries retain their own controller settings.
export function morgensternTrialSupports(entry, weapon) {
  return !!entry?.active && weapon?.id === 'morgenstern';
}

// Call before initializeOnehandReadyPose(), then applySwordsmanship() after the
// usual skill setup, exactly as for today's ordinary melee player.
export function prepareMorgensternTrial(f) {
  if (f.index !== 0 || f.weapon?.id !== 'morgenstern') return false;
  f.onehandArmModel = 'manual';
  f.stanceMemoryModel = 'fresh';
  f.rollTargetModel = 'bounded';
  return true;
}

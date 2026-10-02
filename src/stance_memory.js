/** A new stance must not inherit the friction-load peak from a prior stance. */
export function clearStanceFrictionMemory(gait) {
  for (const leg of Object.values(gait.legs)) leg.Nf = 0;
}

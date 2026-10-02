// Isolated lifecycle fix: a new stance cannot reuse the friction-load peak
// from the stance before a knockdown. Current-step contact load is still read
// normally by pinFeet. N/Nsum/targets/mass/motor parameters are unchanged.
export function clearStanceFrictionMemory(gait){
  for(const leg of Object.values(gait.legs))leg.Nf=0;
}

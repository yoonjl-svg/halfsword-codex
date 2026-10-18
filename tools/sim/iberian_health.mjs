// Reused actual wound observer from Chinese/Japanese research. No scoring surrogate.
export function vitals(f){return {alive:f.alive,blood:f.blood,bleed:f.bleed,consciousness:f.consciousness,pain:f.pain,balance:f.balance,limbs:{...f.limbs},armed:f.armed,state:f.state,stamina:f.stamina.value};}
export function observeHealth(f,time){
 const r={applied:[],death:null,concussion:0,painAdded:0,balanceLost:0,bleedAdded:0,limbLost:0,downTime:0,exhaustedTime:0,negativeStaminaTime:0,heldTime:0,minBlood:1,minConsciousness:1,minStamina:f.stamina.value};
 const original=f.applyWound.bind(f),die=f.die.bind(f);
 f.die=(cause,...args)=>{const alive=f.alive;const out=die(cause,...args);if(alive&&!f.alive&&!r.death)r.death={t:time(),cause};return out;};
 f.applyWound=h=>{
  if(!f.alive||f.revival)return original(h);
  const a=vitals(f);const out=original(h),b=vitals(f);
  const delta={bleed:Math.max(0,b.bleed-a.bleed),concussion:Math.max(0,a.consciousness-b.consciousness),pain:Math.max(0,b.pain-a.pain),balance:Math.max(0,a.balance-b.balance),limb:Object.keys(a.limbs).reduce((s,k)=>s+Math.max(0,a.limbs[k]-b.limbs[k]),0)};
  r.applied.push({t:time(),zone:h.zone,part:h.part,type:h.type,severity:h.severity,energy:h.energy,delta});
  r.bleedAdded+=delta.bleed;r.concussion+=delta.concussion;r.painAdded+=delta.pain;r.balanceLost+=delta.balance;r.limbLost+=delta.limb;
  return out;
 };
 return {r,step(dt,guard){if(f.alive){if(['down','kneel','getup'].includes(f.state))r.downTime+=dt;if(f.stamina.exhausted)r.exhaustedTime+=dt;if(f.stamina.value<0)r.negativeStaminaTime+=dt;if(guard?.active)r.heldTime+=dt;}r.minBlood=Math.min(r.minBlood,f.blood);r.minConsciousness=Math.min(r.minConsciousness,f.consciousness);r.minStamina=Math.min(r.minStamina,f.stamina.value);},finish(){return {...r,end:vitals(f),bloodLost:1-f.blood,stamina:{spent:{...f.stamina.spent},recovered:f.stamina.recovered,counts:{...f.stamina.counts}},cutHits:r.applied.filter(h=>h.type!=='blunt'&&h.severity>0).length,hits:r.applied.length};}};
}

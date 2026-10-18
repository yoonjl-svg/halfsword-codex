// Same .12 s floor + .24 s smooth recovery as historical Japanese trial.
// Research-only adapters use the existing arm/wrist multiplier, no RB writes.
export function installControlRecovery(f,{floor=.25,seconds=.36,holdSeconds=null}={}){
 const events=[];let state=null;
 const scale=()=>{
  if(!state||!f.alive||!f.armed||f.state!=='stand')return 1;
  const t=f.stamina.time-state.start;if(t>=seconds)return 1;
  const x=Math.max(0,Math.min(1,holdSeconds===null?(t/seconds-1/3)*1.5:(t-holdSeconds)/(seconds-holdSeconds)));return floor+(1-floor)*x*x*(3-2*x);
 };
 const begin=defender=>{
  if(!(floor<1)||!f.alive||!f.armed||f.state!=='stand')return false;
  const now=f.stamina.time,id=f.stamina.attackId;
  if(state&&(now<state.until+.12||(id>0&&id===state.attackId)))return false;
  state={start:now,until:now+seconds,duration:seconds,attackId:id,defender:defender.index,floor};events.push({...state});return true;
 };
 for(const method of ['driveSword','driveJoints']){
  const original=f[method].bind(f);
  f[method]=(...args)=>{const previous=f.flowArmScale;f._studyControlScale=scale();f.flowArmScale=(previous??1)*f._studyControlScale;try{return original(...args);}finally{f.flowArmScale=previous;}};
 }
 return {begin,scale,events};
}
export function linkSweepRecovery(owner,state,defender,recovery,observer,time){
 if(!state)return; // No school book / no Iberian motion means no effect hook.
 const original=owner.step.bind(owner);let seen=0;
 owner.step=dt=>{
  const result=original(dt);
  while(seen<state.events.length){const event=state.events[seen++];if(event.trigger!=='contact')continue;
   const applied=recovery.begin(defender);observer.trigger(time(),{line:event.line,outward:event.outward,applied});
  }
  return result;
 };
}

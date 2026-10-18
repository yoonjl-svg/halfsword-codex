// Research-only: reduce existing native effort ceilings, NOT tracking gains.
// Joint max clips elastic target error; existing damping/gravity/grip routes remain.
// This is NOT a new hard cap on every force applied to an entire arm.
export function installForceCap(f,{floor=1,hold=.24,recovery=.24}={}){
 const events=[];let state=null;const seconds=hold+recovery;
 const scale=()=>{
  if(!state||!f.alive||!f.armed||f.state!=='stand')return 1;
  const t=f.stamina.time-state.start;if(t>=seconds)return 1;
  const x=Math.max(0,Math.min(1,(t-hold)/recovery));return floor+(1-floor)*x*x*(3-2*x);
 };
 const begin=defender=>{
  if(!(floor<1)||!f.alive||!f.armed||f.state!=='stand')return false;
  const now=f.stamina.time,id=f.stamina.attackId;
  if(state&&(now<state.until+.12||(id>0&&id===state.attackId)))return false;
  state={start:now,until:now+seconds,duration:seconds,attackId:id,defender:defender.index,floor};events.push({...state});return true;
 };
 const joints=f.driveJoints.bind(f);
 f.driveJoints=(...args)=>{
  const s=scale();f._studyForceCapScale=s;
  if(s===1)return joints(...args);
  const arms=f.joints.filter(j=>['uarmS','farmS','uarmO','farmO'].includes(j.name));
  const old=arms.map(j=>j.max);arms.forEach((j,i)=>j.max=old[i]*s);
  try{return joints(...args);}finally{arms.forEach((j,i)=>j.max=old[i]);}
 };
 const sword=f.driveSword.bind(f);
 f.driveSword=(...args)=>{
  const s=scale();f._studyForceCapScale=s;
  if(s===1)return sword(...args);
  const cfg=f.weaponCfg,old=cfg.maxAimTorque;cfg.maxAimTorque=old*s;
  try{return sword(...args);}finally{cfg.maxAimTorque=old;}
 };
 return {begin,scale,events};
}

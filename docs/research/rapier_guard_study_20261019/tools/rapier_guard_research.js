// Isolated candidate; only observed current/past blade poses, never future inputs.
import * as THREE from 'three';
import {installCover} from './frames.js';
export function installRapierCandidate(me,foe,guard,variant='base'){
 const stats={riskFrames:0,overrides:0,changes:0,first:null};guard.rapierResearch=stats;
 if(variant==='base')return stats;
 const useRead=variant==='read'||variant==='combined',useShape=variant==='shape'||variant==='combined';
 if(useShape){
  const T={pelvisYaw:-35,chestYaw:-45,pitch:10,drop:.12};
  // A short forward shield: reduced extension and point slightly inward.
  installCover(me,guard,{highR:{...T,hand:[.48,.16,.16],blade:[-4,-9]},highC:{...T,hand:[.50,.09,.04],blade:[5,-6]}});
 }
 if(!useRead)return stats;
 let prev=null, chosen=null, until=0;const a=new THREE.Vector3(),b=new THREE.Vector3(),right=new THREE.Vector3();
 guard.researchHook=({dt})=>{
  const now=guard.clock??0,base=foe.bladePoint(0,a).clone(),tip=foe.bladePoint(1,b).clone();
  const old=prev;prev={base,tip};if(!old)return;
  const chest=me.bodies.chest.translation();me.right(right);
  const targets=[me.bodies.uarmS.translation(),me.bodies.farmS.translation(),me.bladePoint(0,new THREE.Vector3())];let best=null;
  for(let i=0;i<=4;i++){
   const f=i/4,p=base.clone().lerp(tip,f),p0=old.base.clone().lerp(old.tip,f),v=p.clone().sub(p0).divideScalar(dt),v2=v.lengthSq();if(v2<12.25)continue;
   for(const target of targets){const to=new THREE.Vector3(target.x,target.y,target.z).sub(p),dot=to.dot(v);if(dot<=0)continue;const tc=Math.min(.16,dot/v2);const q=p.clone().addScaledVector(v,tc);const dist=q.distanceTo(target);if(dist>.20)continue;if(!best||tc<best.tc)best={tc,q,dist};}
  }
  if(best){stats.riskFrames++;const q=best.q;const lat=(q.x-chest.x)*right.x+(q.z-chest.z)*right.z;
   const line=q.y-chest.y<-.25?(lat>=0?'lowR':'lowL'):(lat>=0?'highR':'highL');
   if(now>=until||chosen===line){if(chosen!==line)stats.changes++;chosen=line;until=now+.12;}
  }
  if(chosen&&now<until){if(guard.defLine!==chosen)stats.overrides++;stats.first??=now;guard.defLine=chosen;guard.timer=Math.max(.1,guard.timer);}
 };return stats;
}

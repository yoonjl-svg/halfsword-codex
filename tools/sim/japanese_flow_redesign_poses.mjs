import * as THREE from 'three';
// Narrow research candidates; not historical reconstructions or normal-game
// poses. Hands stay near the chest and each side is defined separately.
import {TRADITIONS} from '../../src/schools.js';
export const FLOW_POSES={
 rising:{
  highL:{hand:[.30,.22,-.02],blade:[50,-55],pelvisYaw:-5,chestYaw:-10,pitch:2,drop:.03},
  highR:{hand:[.30,.20,.04],blade:[50,65],pelvisYaw:0,chestYaw:10,pitch:2,drop:.03},
 },
 hanging:{
  highL:{hand:[.28,.32,-.08],blade:[-25,-65],pelvisYaw:-5,chestYaw:-10,pitch:2,drop:.03},
  highR:{hand:[.28,.32,.08],blade:[-25,65],pelvisYaw:0,chestYaw:10,pitch:2,drop:.03},
 }
};
FLOW_POSES.mixed={highL:FLOW_POSES.rising.highL,highR:FLOW_POSES.hanging.highR};
export function installFlowPoses(kind){
 const tr=TRADITIONS.japanese,old=tr.parryCover;
 if(!FLOW_POSES[kind])return()=>{};
 tr.parryCover={...old,...Object.fromEntries(Object.entries(FLOW_POSES[kind]).map(([line,p])=>[line,{...p,name:`비껴받기 ${line} (연구)`,pad:tr.parry[line],nagashi:true}]))};
 return()=>{tr.parryCover=old;};
}

// Horizontal interception only. Changing all left/right guards harmed diagonal
// protection in the narrow rehearsal, so this version reads visible blade
// motion and leaves the ordinary guards in charge outside an upper side cut.
export function installAdaptiveFlowPoses(G){
 for(const f of [G.player,G.enemy]){
  if(f.swordArt?.tradition!=='japanese'||f.schoolParry===false)continue;
  const definitions=Object.fromEntries(Object.entries(FLOW_POSES.mixed).map(([line,p])=>{
   const el=p.blade[0]*Math.PI/180,az=p.blade[1]*Math.PI/180;
   return [line,{...p,dir:[Math.cos(el)*Math.cos(az),Math.sin(el),Math.cos(el)*Math.sin(az)]}];
  }));
  let lock=null, usedAttack=-1;
  f.flowPoseSelector=(want,dt)=>{
   const g=f.parryGuard??f.skill._cover?.ai;
   const active=f.parryGuard?g.active&&!g.broken:g?.mode==='defend'&&!g.defVoid;
   if(!active||!f.alive||!f.armed||f.stamina.exhausted||f.skill.tap||f.skill.pom){lock=null;return want;}
   const o=f.foe,s=o?.cache?.sword;if(!s){lock=null;return want;}
   if(o.stamina.flowAttackKind!=='cut'||o.stamina.time-o.stamina.flowAttackStart>.8){lock=null;return want;}
   const p=o.bladePoint(.7,new THREE.Vector3()),ch=new THREE.Vector3().copy(f.bodies.chest.translation());
   const rel=p.clone().sub(ch),v=p.clone().sub(s.com).cross(s.w).negate().add(s.v).sub(new THREE.Vector3().copy(f.bodies.chest.linvel()));
   const side=rel.dot(f.right(new THREE.Vector3())),sv=v.dot(f.right(new THREE.Vector3()));
   const horizontal=Math.abs(sv)>2&&Math.abs(v.y)<Math.abs(sv)*.65;
   const tv=Math.max(0,Math.min(.28,-(rel.x*v.x+rel.z*v.z)/Math.max(.01,v.x*v.x+v.z*v.z)));
   const next=rel.clone().addScaledVector(v,tv);
   const approaching=tv>.01&&side*sv<-.15&&Math.abs(side)<1.2&&rel.y>-.15&&rel.y<.65&&
     Math.hypot(next.x,next.z)<.55&&next.y>-.15&&next.y<.65;
   if(horizontal&&approaching){if(!lock&&usedAttack!==o.stamina.attackId){lock={line:side<0?'highL':'highR',age:0,clear:0};usedAttack=o.stamina.attackId;}if(lock)lock.clear=0;}
   if(lock){lock.age+=dt;if(!horizontal||!approaching)lock.clear+=dt;
    if(lock.age>.40||lock.clear>.10){lock=null;return want;}
    f.flowPoseDebug={line:lock.line,age:lock.age,side,sv,vy:v.y};
    return definitions[lock.line];
   }
   f.flowPoseDebug=null;return want;
  };
 }
}

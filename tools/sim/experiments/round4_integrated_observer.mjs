// Reused P5 read-only pair observation and state projection for round4 integration.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {THREE} from '../harness_m.mjs';
import {snapshotWorld} from '../force_ledger.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
export async function observedCutStep(){
const combatURL=new URL('../../../src/combat.js',import.meta.url),original=fs.readFileSync(combatURL,'utf8');
let cloned=original;
function replaceExactly(a,b){assert.equal(cloned.split(a).length-1,1,'Exact unchanged legacy anchor');cloned=cloned.replace(a,b);}
replaceExactly('      let J = 0;\n      if (c.Eleft > 0) {','      const p5BudgetBefore = c.Eleft, p5StuckBefore = c.stuckT;\n      let J = 0;\n      if (c.Eleft > 0) {');
replaceExactly('        if (centerlineCutEnabled(this, c.pr.w.fighter)) {',
`        const p5Token = this.p5ContactObserver?.('before', {sw,vb,point:vp(point),pointA:vp(pA),legacyPointV:vp(onBone(c.pr.v,point)),dir:vp(dir),s,J,key,cut:c,budgetBefore:p5BudgetBefore,stuckBefore:p5StuckBefore,attacker:c.pr.w.fighter.index,victim:c.pr.v.fighter.index,part:c.pr.v.part});
        if (centerlineCutEnabled(this, c.pr.w.fighter)) {`);
replaceExactly('          vb.applyImpulseAtPoint({ x: dir.x * J * 0.8, y: dir.y * J * 0.8, z: dir.z * J * 0.8 }, vp(pv), true);\n        }',
`          vb.applyImpulseAtPoint({ x: dir.x * J * 0.8, y: dir.y * J * 0.8, z: dir.z * J * 0.8 }, vp(pv), true);
        }
        this.p5ContactObserver?.('after', {token:p5Token});`);
const transformed=cloned.replace(/from (['"])([^'"]+)\1/g,(_,q,s)=>`from ${JSON.stringify(s.startsWith('.')?new URL(s,combatURL).href:import.meta.resolve(s))}`);
const observed=await import('data:text/javascript;base64,'+Buffer.from(transformed).toString('base64'));

return {afterStep:observed.Combat.prototype.afterStep,originalSHA256:sha(original),transformedSHA256:sha(transformed)};
}
const V=v=>({x:v.x,y:v.y,z:v.z}),add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z}),sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),scale=(a,k)=>({x:a.x*k,y:a.y*k,z:a.z*k}),dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z,cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x}),norm=v=>Math.hypot(v.x,v.y,v.z);
function plain(v,depth=0,seen=new WeakSet()){
 if(v==null||['string','number','boolean'].includes(typeof v))return v;
 if(typeof v!=='object'||depth>7)return undefined;
 if(v.isVector2||v.isVector3||v.isQuaternion||v.isEuler)return v.toArray();
 if(seen.has(v))return {$shared:true};seen.add(v);
 if(Array.isArray(v))return v.map(x=>plain(x,depth+1,seen));
 return Object.fromEntries(Object.entries(v).filter(([k,x])=>!['me','f','fighter','foe','world','scene','R','raw','rawSet','profile','table'].includes(k)&&typeof x!=='function').map(([k,x])=>[k,plain(x,depth+1,seen)]).filter(([,x])=>x!==undefined));
}
const controls=f=>({state:f.state,stateTime:f.stateTime,alive:f.alive,armed:f.armed,handOffset:f.handOffset.toArray(),handHeld:f.handHeld,inputActive:f.inputActive,move:f.move.toArray(),heading:f.heading,blood:f.blood,pain:f.pain,limbs:{...f.limbs},bodyPose:{...f.bodyPose},bodyPoseVel:{...f.bodyPoseVel},skill:plain(f.skill),gait:plain(f.gait),assist:plain(f.swordsmanshipState),joints:f.joints.map(j=>({name:j.name,target:j.target.toArray(),k:j.k,d:j.d,max:j.max,gain:j.gain??1}))});
function selectedState(G){return {timeS:G.t,fighters:[G.player,G.enemy].map(f=>{
 const q=new THREE.Quaternion().copy(f.bodies.chest.rotation()),up=new THREE.Vector3(0,1,0).applyQuaternion(q);
 const gaps=[...f.joints.map(j=>({name:j.name,joint:j.joint})),{name:'grip',joint:f.gripJoint}].filter(x=>x.joint?.isValid()).map(({name,joint:j})=>{
  const a=new THREE.Vector3().copy(j.anchor1()).applyQuaternion(new THREE.Quaternion().copy(j.body1().rotation())).add(new THREE.Vector3().copy(j.body1().translation()));
  const b=new THREE.Vector3().copy(j.anchor2()).applyQuaternion(new THREE.Quaternion().copy(j.body2().rotation())).add(new THREE.Vector3().copy(j.body2().translation()));return {name,gapM:a.distanceTo(b)};
 });
 const spin=Object.entries({...f.bodies,sword:f.sword}).filter(([,b])=>b?.isValid()).map(([part,b])=>{const axis=new THREE.Vector3(...(['uarmS','farmS'].includes(part)?[1,0,0]:[0,1,0])).applyQuaternion(new THREE.Quaternion().copy(b.rotation()));return {part,heightM:b.translation().y,detached:f.detachedParts?.has(part)??false,speedMps:norm(b.linvel()),omegaRadps:norm(b.angvel()),axialRadps:axis.dot(new THREE.Vector3().copy(b.angvel()))};});
 return {index:f.index,control:{armHealth:f.armHealth,pain:f.pain,handOffset:f.handOffset.toArray(),inputActive:!!f.inputActive,handHeld:!!f.handHeld,assist:{phase:f.swordsmanshipState?.phase,owner:f.swordsmanshipState?.owner,eligible:f.swordsmanshipState?.eligible,availability:f.swordsmanshipState?.availability},wristTorque:f.debug.wristTorque?.toArray(),wristCap:f.debug.wristCap},state:f.state,alive:f.alive,armed:f.armed,gripping:!!f.gripping,gripValid:!!f.gripJoint?.isValid(),blood:f.blood,consciousness:f.consciousness,limbs:{...f.limbs},chestTiltRad:Math.acos(Math.max(-1,Math.min(1,up.y))),pelvisHeightM:f.bodies.pelvis.translation().y,gaps,spin};
})};}
function deltaK(body,point,J){const r=sub(point,body.com),tau=cross(r,J),I=new THREE.Matrix3().fromArray(body.inertia.world).invert(),v=new THREE.Vector3(tau.x,tau.y,tau.z).applyMatrix3(I);return dot(body.velocity,J)+dot(body.omega,tau)+.5*(dot(J,J)/body.mass+tau.x*v.x+tau.y*v.y+tau.z*v.z);}
function pairAnalysis(event){
 const [a,b]=event.before.bodies,[aa,bb]=event.after.bodies,Jw=scale(event.reaction?.direction??event.dir,-(event.reaction?.J??event.J)),Jv=scale(event.reaction?.direction??event.dir,(event.reaction?.J??event.J)*(event.reaction?1:.8)),predP=add(Jw,Jv),predL=add(cross(event.pointA,Jw),cross(event.pointV,Jv));
 const dP=sub(event.after.total.P,event.before.total.P),dL=sub(event.after.total.L,event.before.total.L),dK=event.after.total.K-event.before.total.K,predK=deltaK(a,event.pointA,Jw)+deltaK(b,event.pointV,Jv);
 return {deltaP:dP,predictedDeltaP:predP,deltaPResidualNs:norm(sub(dP,predP)),deltaL:dL,predictedDeltaL:predL,deltaLResidualNms:norm(sub(dL,predL)),deltaKJ:dK,predictedDeltaKJ:predK,deltaKResidualJ:dK-predK,requestedBudgetDebitJ:event.budgetBefore-event.budgetAfter,pointSeparationM:norm(sub(event.pointA,event.pointV))};
}

export {plain,controls,selectedState,pairAnalysis,snapshotWorld,V,norm};

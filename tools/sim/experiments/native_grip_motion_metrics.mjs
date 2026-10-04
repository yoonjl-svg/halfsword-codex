// Compact derivation from the recorded native grip runs; no physics execution.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
const o=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(free|live|out)=(.+)$/.exec(s);assert(m);return[m[1],m[2]];}));
for(const k of ['free','live','out'])assert(o[k]&&path.isAbsolute(o[k]));assert(!fs.existsSync(o.out));
const sha=b=>createHash('sha256').update(b).digest('hex');
const angle=(a,b)=>Math.acos(T.MathUtils.clamp(a.dot(b),-1,1));
const axis=(s,v)=>new T.Vector3(...v).applyQuaternion(new T.Quaternion(...s.q)).normalize();
const aim=s=>angle(axis(s,[0,1,0]),new T.Vector3(...s.aim).normalize());
function summarize(frames){const states=frames.map(f=>f.postPhysics),motors=frames.filter(f=>f.nativeGrip?.applied).flatMap(f=>f.nativeGrip.rows);
 assert(states.every(s=>['p','q','w','v','aim'].every(k=>s[k].every(v=>typeof v==='number'&&Number.isFinite(v)))&&[s.tipVelocityMps,s.handErrorM,s.maxJointGapM].every(Number.isFinite)));
 return {frames:frames.length,peakTipVelocityMps:Math.max(...states.map(s=>s.tipVelocityMps)),peakWorldBladeAxisRadS:Math.max(...states.map(s=>Math.abs(s.axial))),meanAimErrorRad:states.reduce((n,s)=>n+aim(s),0)/states.length,maxHandErrorM:Math.max(...states.map(s=>s.handErrorM)),maxJointGapM:Math.max(...states.map(s=>s.maxJointGapM)),missingJointFrames:states.filter(s=>s.missingJoints.length).length,
  contactFrames:frames.filter(f=>f.contactsAfterPhysics.length).length,firstWeaponContactTick:frames.find(f=>f.contactsAfterPhysics.length)?.tick??null,
  appliedMotorFrames:frames.filter(f=>f.nativeGrip?.applied).length,noBudgetFrames:frames.filter(f=>f.nativeGrip?.applied===false).length,
  maxLastSubstepScalarCapRatio:motors.length?Math.max(...motors.map(m=>Math.abs(m.lastSubstepImpulseNms)/m.lastSubstepCapNms)):null,
  tapAttempts:frames.filter(f=>f.input.tapAccepted!==null).map(f=>({tick:f.tick,accepted:f.input.tapAccepted})),finalHealth:frames.at(-1).afterCombat.health,finalEvents:frames.at(-1).events};
}
const out={schema:1,toolSHA256:sha(fs.readFileSync(new URL(import.meta.url))),rows:[]};
for(const scenario of ['free','live']){
 const bytes=fs.readFileSync(o[scenario]),d=JSON.parse(bytes);assert(d.pass&&d.sourceStable);const [a,b]=d.rows;assert(a.mode==='observe'&&b.mode==='nativeContinuous'&&a.frames.length===b.frames.length);assert.deepEqual(a.creation,b.creation);
 const requested=(f)=>{const {tapAccepted,...rest}=f.input;return rest;};
 const phases=[...new Set(a.frames.map(f=>f.input.request.phase))];
 out.rows.push({scenario,path:o[scenario],bytes:bytes.length,sha256:sha(bytes),sourceStable:d.sourceStable,sourceCommitLabel:d.sourceCommit,wallSeconds:d.wallSeconds,creationExact:true,
  directionalInputExact:a.frames.every((f,i)=>JSON.stringify(requested(f))===JSON.stringify(requested(b.frames[i]))),
  fullInputExact:a.frames.every((f,i)=>JSON.stringify(f.input)===JSON.stringify(b.frames[i].input)),
  baseline:summarize(a.frames),candidate:summarize(b.frames),phases:phases.map(p=>{
   const ix=a.frames.map((f,i)=>f.input.request.phase===p?i:null).filter(i=>i!==null);
   return {phase:p,baseline:summarize(ix.map(i=>a.frames[i])),candidate:summarize(ix.map(i=>b.frames[i])),maxBladeDirectionDifferenceRad:Math.max(...ix.map(i=>angle(axis(a.frames[i].postPhysics,[0,1,0]),axis(b.frames[i].postPhysics,[0,1,0])))),maxFlatNormalDifferenceRad:Math.max(...ix.map(i=>angle(axis(a.frames[i].postPhysics,[0,0,1]),axis(b.frames[i].postPhysics,[0,0,1]))))};
  })});
}
out.scope='Same creation and scheduled directional deltas. Live reactive AI and actual tap acceptance may branch; lower peak with different accepted tap/contact is not equal-condition contact reception efficacy. Quaternion directions and tip/gap metrics are not anatomical motion or human naturalness.';
fs.writeFileSync(o.out,JSON.stringify(out,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({rows:out.rows.map(r=>({scenario:r.scenario,directionalInputExact:r.directionalInputExact,fullInputExact:r.fullInputExact,baseline:r.baseline,candidate:r.candidate}))}));

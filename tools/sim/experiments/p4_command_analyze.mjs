// Interpret the single matched pair. These are observations, not an automatic
// naturalness or acceptance score. No simulation or runtime source mutation.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
const opts=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(raw|out)=(.+)$/.exec(s);assert(m);return[m[1],m[2]];}));
assert(opts.raw&&opts.out&&!fs.existsSync(opts.out));
const bytes=fs.readFileSync(opts.raw),data=JSON.parse(bytes),sha=b=>createHash('sha256').update(b).digest('hex');assert(data.pass&&data.sourceStable);
const [baseline,candidate]=data.rows;assert(baseline.mode==='legacy'&&candidate.mode==='commandDirection');
const V=a=>new THREE.Vector3(...a),deg=x=>x*180/Math.PI,clamp=x=>Math.max(-1,Math.min(1,x));
const signed=(a,b,axis)=>Math.atan2(new THREE.Vector3().crossVectors(a,b).dot(axis),a.dot(b));
function commandError(frame,velocity){
  const axis=V(frame.actual.axis).normalize(),flat=V(frame.actual.flat).normalize();
  const motion=velocity.clone().addScaledVector(axis,-velocity.dot(axis)),speed=motion.length();
  if(speed<1e-8)return null;
  const normal=new THREE.Vector3().crossVectors(axis,motion).normalize();if(normal.dot(flat)<0)normal.negate();
  return{signedDeg:deg(signed(flat,normal,axis)),unsignedDeg:deg(Math.asin(clamp(Math.abs(flat.dot(motion.normalize())))))};
}
function lobes(frames){
  const result=[];
  for(const f of frames){const sign=Math.sign(f.axialOmega),last=result.at(-1);if(!last||last.sign!==sign)result.push({start:f.tick,end:f.tick,sign,travelRad:Math.abs(f.axialOmega)*data.dt,peakRadps:Math.abs(f.axialOmega)});
    else{last.end=f.tick;last.travelRad+=Math.abs(f.axialOmega)*data.dt;last.peakRadps=Math.max(last.peakRadps,Math.abs(f.axialOmega));}}
  return result;
}
function errorsCrossings(frames,key){const crossings=[];for(let i=1;i<frames.length;i++){const a=frames[i-1][key],b=frames[i][key];if(a===null||b===null)continue;if(a*b<0)crossings.push({tick:frames[i].tick,beforeDeg:a,afterDeg:b,representationBoundary:Math.abs(a-b)>90});}return crossings;}
function summarize(frames){
  const sum=fn=>frames.reduce((s,f)=>s+fn(f),0),mean=fn=>sum(fn)/frames.length;
  const ownWeight=sum(f=>f.commandSpeed),physicalWeight=sum(f=>f.transverseSpeed);
  return{steps:frames.length,commandSignedProgressM:sum(f=>f.baselineProgressMps)*data.dt,commandPositiveProgressM:sum(f=>Math.max(0,f.baselineProgressMps))*data.dt,
    ownCommandSignedProgressM:sum(f=>f.ownProgressMps)*data.dt,meanOwnCommandErrorDeg:mean(f=>Math.abs(f.ownCommandErrorDeg??0)),
    commandSpeedWeightedOwnErrorDeg:sum(f=>Math.abs(f.ownCommandErrorDeg??0)*f.commandSpeed)/Math.max(ownWeight,1e-12),
    meanBaselineCommandErrorDeg:mean(f=>Math.abs(f.baselineCommandErrorDeg??0)),physicalSpeedWeightedEdgeErrorDeg:sum(f=>f.physicalErrorDeg*f.transverseSpeed)/Math.max(physicalWeight,1e-12),
    tipPeakMps:Math.max(...frames.map(f=>f.tipSpeed)),tipMeanMps:mean(f=>f.tipSpeed),kineticPeakJ:Math.max(...frames.map(f=>f.kineticJ)),kineticMeanJ:mean(f=>f.kineticJ),
    axialTravelRad:sum(f=>Math.abs(f.axialOmega))*data.dt,axialNetIntegralRad:sum(f=>f.axialOmega)*data.dt,axialLobes:lobes(frames),
    ownCommandErrorZeroCrossings:errorsCrossings(frames,'ownCommandErrorDeg'),baselineCommandErrorZeroCrossings:errorsCrossings(frames,'baselineCommandErrorDeg'),
    maxTargetSlewDeg:Math.max(...frames.map(f=>Math.abs(f.targetSlewDeg))),maxPositionTorqueStepNm:Math.max(...frames.map(f=>Math.abs(f.positionTorqueDeltaNm))),
    maxFinalAxialTorqueStepNm:Math.max(...frames.map(f=>Math.abs(f.finalAxialTorqueDeltaNm??0))),maxGapM:Math.max(...frames.map(f=>f.maxGapM)),
    maxChestTiltRad:Math.max(...frames.map(f=>f.chestTiltRad))};
}
const rows=data.rows.map(row=>{
  let previousTorque=null;
  const frames=row.frames.map((f,i)=>{
    const b=baseline.frames[i],velocity=V(f.plane.command.velocity),baseVelocity=V(b.plane.command.velocity),axis=V(f.actual.axis).normalize();
    const own=velocity.clone().addScaledVector(axis,-velocity.dot(axis)),baseAxis=V(b.plane.blade).normalize();
    const common=baseVelocity.clone().addScaledVector(baseAxis,-baseVelocity.dot(baseAxis));
    const actual=V(f.actual.midVelocity),torque=V(f.torque.final).dot(V(f.plane.blade).normalize());
    const result={tick:f.tick,phase:f.phase,eligible:f.plane.command.eligible,active:f.request.active,commandSpeed:own.length(),
      ownProgressMps:own.lengthSq()>1e-16?actual.dot(own.normalize()):0,baselineProgressMps:common.lengthSq()>1e-16?actual.dot(common.normalize()):0,
      ownCommandErrorDeg:commandError(f,velocity)?.signedDeg??null,baselineCommandErrorDeg:commandError(f,baseVelocity)?.signedDeg??null,
      physicalErrorDeg:deg(f.actual.actualEdgeErrorRad),transverseSpeed:f.actual.transverseSpeed,axialOmega:f.actual.axialOmega,
      targetSlewDeg:deg(f.plane.targetSlewRad),positionTorqueNm:f.torque.positionTorque,positionTorqueDeltaNm:f.torque.positionTorqueDelta,
      finalAxialTorqueNm:torque,finalAxialTorqueDeltaNm:previousTorque===null?null:torque-previousTorque,
      tipSpeed:f.actual.tipSpeed,kineticJ:f.actual.kineticJ,maxGapM:f.actual.maxGapM,chestTiltRad:f.actual.chestTiltRad};previousTorque=torque;return result;
  });
  const windows={recut:[318,348],recutEarly:[318,325],recutLater:[325,348],recutHold:[348,384],release:[384,444],recutThroughRelease:[318,444]};
  return{mode:row.mode,firstEligibleActiveTick:frames.find(f=>f.tick>=318&&f.eligible)?.tick,
    summary:Object.fromEntries(Object.entries(windows).map(([name,[start,end]])=>[name,summarize(frames.slice(start,end))])),
    frames:frames.filter(f=>f.tick>=314)};
});
const result={schemaVersion:1,status:'hold_for_director_interpretation',effectAccepted:false,raw:{path:opts.raw,bytes:bytes.length,sha256:sha(bytes)},
  producerSHA256:sha(fs.readFileSync(new URL(import.meta.url))),command:process.argv,dt:data.dt,newPhysicsExecutions:0,rows,
  definitions:{commandPoint:'World final handTarget + final aimDirW*(hiltLength+.7bladeLength). Includes actual moving chest/yaw.',
    commandError:'Post-integration actual blade-flat angle to same-step command velocity projected perpendicular to post-integration actual blade axis; unsigned plane with nearest equivalent normal. Signed errors wrap at±90deg.',
    commonProgress:'Actual post-integration .7blade world velocity dotted with baseline same-step command velocity, projected perpendicular to baseline pre-drive blade axis. Sum*dt is a directional velocity integral, not total path length.',
    lobes:'Consecutive signs of world axial omega; report all, with travel and peaks, without a fitted threshold. This is not forearm-relative wrist rotation.',
    errorCrossing:'Nearest-plane signed error crossing0 can mark tracking overshoot. >90deg differences are flagged as representation boundaries, not physical overshoots.'},
  limitations:['Command targets need not be reachable; this does not certify intended human technique.','Own-command references differ after native divergence. Baseline-command references are included to expose this comparison limit.',
    'Hold/release command motion includes autonomous return and physical body movement; its direction is not a new active cutting command.',
    'A lower peak, lower angle or fewer reversals alone is not gameplay acceptance. No additional physics or human video judgment occurred.']};
fs.writeFileSync(opts.out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({out:opts.out,rows:rows.map(r=>({mode:r.mode,recut:r.summary.recut,hold:r.summary.recutHold}))}));

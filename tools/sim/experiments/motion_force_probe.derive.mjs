/** Read-only derivation of a completed motion_force_probe raw. No physics import. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const [input,out]=process.argv.slice(2);
assert(input&&out&&path.isAbsolute(input)&&path.isAbsolute(out)&&!fs.existsSync(out),'Use raw path and fresh absolute derived output');
const raw=fs.readFileSync(input),data=JSON.parse(raw),sha=x=>createHash('sha256').update(x).digest('hex');
const norm=v=>Math.hypot(v.x,v.y,v.z);
const stats=xs=>{const v=xs.filter(Number.isFinite);return v.length?{count:v.length,mean:v.reduce((a,b)=>a+b,0)/v.length,minimum:Math.min(...v),maximum:Math.max(...v)}:{count:0};};
function phase(frames){
  const calls=frames.flatMap(f=>f.ledger.explicitShoulderWristTorqueCalls),byRecipient={};
  for(const c of calls){
    const x=byRecipient[c.label]??={calls:0,torqueMagnitudeIntegralNms:0,signedInstantPowerTimeApproxJ:0,positiveInstantPowerTimeApproxJ:0,peakTorqueNm:0};
    const magnitude=norm(c.input),work=c.instantPowerAtCallW*data.dt;x.calls++;x.torqueMagnitudeIntegralNms+=magnitude*data.dt;
    x.signedInstantPowerTimeApproxJ+=work;x.positiveInstantPowerTimeApproxJ+=Math.max(0,work);x.peakTorqueNm=Math.max(x.peakTorqueNm,magnitude);
  }
  const contacts=frames.flatMap(f=>f.ledger.physics.flatMap(s=>s.contactsRaw));
  const pointSpeeds=contacts.flatMap(c=>c.solverPoints.map(p=>{const v={x:p.velocityA.x-p.velocityB.x,y:p.velocityA.y-p.velocityB.y,z:p.velocityA.z-p.velocityB.z},n=c.normal,d=v.x*n.x+v.y*n.y+v.z*n.z;return norm({x:v.x-d*n.x,y:v.y-d*n.y,z:v.z-d*n.z});}));
  return {steps:frames.length,seconds:frames.length*data.dt,playerHealthyFrames:frames.filter(f=>f.playerHealthy??(f.health.state==='stand'&&f.health.wounds.length===0&&f.health.pain<=1e-12&&Object.values(f.health.limbs).every(x=>x>=1-1e-12))).length,
    timingPhaseFrames:Object.fromEntries([...new Set(frames.map(f=>f.postControl.timing.state?.phase??'no_state'))].map(p=>[p,frames.filter(f=>(f.postControl.timing.state?.phase??'no_state')===p).length])),
    extraChestYawRad:stats(frames.map(f=>f.postControl.timing.refs?.extraChestYaw)),requestedExtraChestYawRad:stats(frames.map(f=>f.postControl.timing.refs?.requestedExtraChestYaw)),
    actualBodyOmegaRadps:Object.fromEntries(['pelvis','chest','uarmS','farmS'].map(n=>[n,stats(frames.map(f=>Math.hypot(...f.actual.actualBodies[n].omega)))])),
    tipSpeedMps:stats(frames.map(f=>f.actual.sword.tipSpeedMps)),signedIntentTipSpeedMps:stats(frames.map(f=>f.actual.sword.signedIntentDirectionTipSpeedMps)),
    swordOmegaRadps:stats(frames.map(f=>f.actual.sword.omegaMagnitudeRadps)),swordAxialOmegaRadps:stats(frames.map(f=>f.actual.sword.axialOmegaRadps)),swordAxisAngularSpeedRadps:stats(frames.map(f=>f.actual.sword.axisAngularSpeedRadps)),
    handErrorM:stats(frames.map(f=>f.actual.handErrorM)),aimErrorRad:stats(frames.map(f=>f.actual.aimErrorRad)),maxJointGapM:stats(frames.map(f=>Math.max(...Object.values(f.actual.gaps)))),
    explicitTorqueByRecipient:byRecipient,ledgerSignedWorkApproxJ:frames.reduce((s,f)=>s+f.ledger.balance.forceWorkApproxJ,0),
    nativeMotorRequestCount:frames.reduce((s,f)=>s+f.nativeMotorRequests.length,0),contactManifoldRecords:contacts.length,solverPointRelativeTangentialSpeedMps:stats(pointSpeeds),
    rawManifoldNormalImpulseSumNs:contacts.reduce((s,c)=>s+c.rawNormalImpulseNs,0),maximumBodyOmegaRadps:stats(frames.map(f=>Math.max(...Object.values(f.actual.actualBodies).map(b=>Math.hypot(...b.omega))))) };
}
const rows=data.rows.map(r=>({scene:r.scene??data.protocol.scene,weapon:r.weapon,model:r.model,fixtureChecks:r.fixtureChecks,observations:r.observations??null,observerMode:r.observerMode,
  totalSelectedSignedExplicitWorkApproxJ:r.ledgerSummary.totals.forceWorkApproxJ,totalSelectedKStartJ:r.ledgerSummary.initial.K,totalSelectedKEndJ:r.ledgerSummary.final.K,
  phases:Object.fromEntries([...new Set(r.frames.map(f=>f.phase))].map(p=>[p,phase(r.frames.filter(f=>f.phase===p))]))}));
const report={schemaVersion:1,rawPath:input,rawBytes:raw.length,rawSHA256:sha(raw),sourceCommit:data.sourceCommit,sourceStable:data.sourceStable,headStable:data.headStable,fixturePass:data.fixturePass,
  exactCLI:data.command,derivedCLI:process.argv,definitions:{recipientWork:'Sum of actual explicit call torque dot at-call recipient omega times DT, a left-endpoint approximation. Native motor/contact/upright work excluded.',
    magnitudeImpulse:'Integral of each explicit torque-call magnitude, not net angular impulse or strength setting. Reactions remain separate recipients.',
    contact:'Relative tangential velocity at stored solver points; manifold impulses summed separately. No point/impulse index correspondence or loaded-slip claim.',
    comparison:'Distant is healthy screening; optional live preserves finite/completeness while health/contact are observations. Reactive trajectories diverge after contact. No human maximum force, equal total work, naturalness, victory or injury-prevention acceptance.'},
  comparisons:data.comparisons,rows};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output:out,rows:rows.length,rawSHA256:report.rawSHA256,fixturePass:report.fixturePass}));

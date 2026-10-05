/** Read-only derivation of a completed sword_assist_v2_probe raw. No physics import. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const [input,out]=process.argv.slice(2);
assert(input&&out&&path.isAbsolute(input)&&path.isAbsolute(out)&&!fs.existsSync(out),'Use raw path and fresh absolute derived output');
const raw=fs.readFileSync(input),data=JSON.parse(raw),sha=x=>createHash('sha256').update(x).digest('hex');
const norm=v=>Math.hypot(v.x,v.y,v.z);
const stats=xs=>{const v=xs.filter(Number.isFinite);return v.length?{count:v.length,mean:v.reduce((a,b)=>a+b,0)/v.length,minimum:Math.min(...v),maximum:Math.max(...v)}:{count:0};};
const budgets=data.protocol.swordAssistBudgets;
const counts=xs=>Object.fromEntries([...new Set(xs)].map(v=>[v,xs.filter(x=>x===v).length]));
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,a.reduce((s,v,i)=>s+v*b[i],0)/(Math.hypot(...a)*Math.hypot(...b)))));
function goals(frames){
  const movements=frames.slice(1).map((f,i)=>({handBaseStepM:distance(f.postControl.handBase,frames[i].postControl.handBase),
    worldHandTargetStepM:distance(f.actual.handTargetWorld,frames[i].actual.handTargetWorld),worldAimStepRad:angle(f.actual.aimWorld,frames[i].actual.aimWorld)}));
  const motors=frames.flatMap(f=>f.nativeMotorRequests.filter(x=>x.method==='jointConfigureMotor').map(x=>Math.abs(x.arguments[3])));
  return {handBaseStepM:stats(movements.map(x=>x.handBaseStepM)),worldHandTargetStepM:stats(movements.map(x=>x.worldHandTargetStepM)),worldRequestedAimStepRad:stats(movements.map(x=>x.worldAimStepRad)),maximumAbsNativeTargetVelocityRequestRadps:motors.length?Math.max(...motors):null};
}
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
    assistPhaseFrames:counts(frames.map(f=>f.postControl.assistV2.state?.phase??'no_state')),
    livePadDistanceToDeclaredHomeM:stats(frames.map(f=>distance(f.postControl.pad,budgets.homePad))),homeBlend:stats(frames.map(f=>f.postControl.assistV2.state?.homeBlend)),
    declaredHomePhysicalHandErrorM:stats(frames.map(f=>f.actual.declaredHomeHandErrorM)),declaredHomePhysicalAimErrorRad:stats(frames.map(f=>f.actual.declaredHomeAimErrorRad)),
    helperTotalHandDeltaM:stats(frames.map(f=>f.postControl.assistV2.state?.handDeltaM)),helperTotalAimDeltaRad:stats(frames.map(f=>f.postControl.assistV2.state?.aimDeltaRad)),
    generatedReturnSteps:frames.filter(f=>f.generatedReturnAccounting.generatedStepM>1e-12).length,generatedReturnGoalSpeedMps:stats(frames.map(f=>f.generatedReturnAccounting.generatedSpeedMps)),
    inputVelocityAccountingErrorMps:stats(frames.map(f=>f.generatedReturnAccounting.inputVelocityErrorMps)),generatedPadAccountingErrorM:stats(frames.map(f=>f.generatedReturnAccounting.padAccountingErrorM)),
    generatedReturnAndNewSwings:frames.filter(f=>f.generatedReturnAccounting.generatedAndSwingCountIncreased).length,generatedReturnAndNewLunge:frames.filter(f=>f.generatedReturnAccounting.generatedAndLungeIncreased).length,
    goalMovement:goals(frames),swordForearmDot:stats(frames.map(f=>f.actual.swordAxisDotForearm)),elbowTargetZRad:stats(frames.map(f=>f.actual.elbowTargetZRad)),
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
  generatedReturnAccounting:r.observations,nativeTraceSHA256:r.nativeTraceSHA256,suppliedInputSHA256:r.inputSHA256,appliedInputSHA256:r.appliedInputSHA256,taps:r.taps,
  totalSelectedSignedExplicitWorkApproxJ:r.ledgerSummary.totals.forceWorkApproxJ,totalSelectedKStartJ:r.ledgerSummary.initial.K,totalSelectedKEndJ:r.ledgerSummary.final.K,
  allAdjacentGoalMovement:goals(r.frames),
  phases:Object.fromEntries([...new Set(r.frames.map(f=>f.phase))].map(p=>[p,phase(r.frames.filter(f=>f.phase===p))])),
  zeroMovementReholdTransitions:r.frames.filter((f,i)=>['reholdSideNoMove','reholdHighNoMove'].includes(f.phase)&&(i===0||r.frames[i-1].phase!==f.phase)).map(f=>{
    const i=r.frames.indexOf(f),window=r.frames.slice(Math.max(0,i-1),i+3);
    return {phase:f.phase,requestedAtTick:f.tick,requestedAtTimeS:f.timeS,window:window.map(x=>({tick:x.tick,timeS:x.timeS,delta:x.request.delta,held:x.postControl.held,active:x.postControl.active,
      handBase:x.postControl.handBase,handTargetWorld:x.actual.handTargetWorld,aimWorld:x.actual.aimWorld,assist:x.postControl.assistV2,skillInput:x.postControl.skillInput,
      generatedAccounting:x.generatedReturnAccounting,state:x.health.state,homeHandErrorM:x.actual.declaredHomeHandErrorM})),goalMovement:goals(window)};
  }),
  returnTapTransitions:r.frames.filter(f=>f.request.tap).map(f=>{const i=r.frames.indexOf(f),window=r.frames.slice(Math.max(0,i-1),i+3);return {requestedAtTick:f.tick,requestedAtTimeS:f.timeS,phase:f.phase,window:window.map(x=>({tick:x.tick,timeS:x.timeS,handBase:x.postControl.handBase,handTargetWorld:x.actual.handTargetWorld,aimWorld:x.actual.aimWorld,thrustWeight:x.postControl.thrustWeight,assist:x.postControl.assistV2,state:x.health.state,homeHandErrorM:x.actual.declaredHomeHandErrorM})),goalMovement:goals(window)};})}));
const report={schemaVersion:1,rawPath:input,rawBytes:raw.length,rawSHA256:sha(raw),sourceCommit:data.sourceCommit,sourceStable:data.sourceStable,headStable:data.headStable,fixturePass:data.fixturePass,
  exactCLI:data.command,derivedCLI:process.argv,definitions:{recipientWork:'Sum of actual explicit call torque dot at-call recipient omega times DT, a left-endpoint approximation. Native motor/contact/upright work excluded.',
    magnitudeImpulse:'Integral of each explicit torque-call magnitude, not net angular impulse or strength setting. Reactions remain separate recipients.',
    contact:'Relative tangential velocity at stored solver points; manifold impulses summed separately. No point/impulse index correspondence or loaded-slip claim.',
    comparison:'Same current B timing and supplied user deltas. V2 intentionally changes returned pad and guided hand/aim goals. Distant is healthy screening; live health/contact divergence is observational. No human naturalness, victory or injury-prevention acceptance.',
    goalMovement:'Hand-base and world goal differences, not achieved body velocity or solved impulse. Home return can exceed the small regular-guidance budget; report separately.',
    generated:'Generated pad goal speed, separately accounted from measured user velocity and swings/lunge. Runtime reach clamp is distinct. Sword/forearm dot does not certify grip style.'},
  swordAssistBudgets:budgets,comparisons:data.comparisons,contractComparisons:data.contractComparisons,rows};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output:out,rows:rows.length,rawSHA256:report.rawSHA256,fixturePass:report.fixturePass}));

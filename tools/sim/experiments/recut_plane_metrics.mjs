// Pure derivation from the saved read-only observer. Never starts a physics world.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const opts=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(observed|out)=(.+)$/.exec(s);assert(m);return[m[1],m[2]];}));
assert(opts.observed&&opts.out&&!fs.existsSync(opts.out));
const bytes=fs.readFileSync(opts.observed),d=JSON.parse(bytes);
assert(d.pass&&d.sourceStable&&d.validatedNativeSteps===1211);
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.sqrt(dot(a,a)),unit=a=>a.map(x=>x/norm(a));
const qrot=(v,q)=>{const t=cross(q,v).map(x=>2*x),u=cross(q,t);return v.map((x,i)=>x+q[3]*t[i]+u[i]);};
const carry=(v,a,b)=>qrot(v,unit([...cross(a,b),1+dot(a,b)]));
const signed=(a,b,axis)=>Math.atan2(dot(axis,cross(a,b)),dot(a,b))*180/Math.PI;
let previous=null;
const rows=d.frames.map(frame=>{
  const s=Object.fromEntries(frame.stages.map(x=>[x.stage,x]));
  const a=s.afterTransport.values,b=s.beforeMotion.values,c=s.beforeTransport.values,t=s.finalTorque.values;
  const mfRaw=unit(cross(a.blade,b.edgeDir)),mfRawDotFlat=dot(mfRaw,a.flat),mfChosen=mfRaw.map(x=>x*(mfRawDotFlat<0?-1:1));
  const inverseYaw=a.yaw.map((x,i)=>i<3?-x:x),localBlade=qrot(a.blade,inverseYaw),localTarget=qrot(a.flatTarget,inverseYaw);
  const row={tick:frame.tick,timeS:frame.timeS,phase:frame.phase,weight:s.afterTransport.weight,tap:s.afterTransport.tap,
    moving:c.moving,transverseSpeedMps:c.ev,mfRawDotFlat,mfWasNegated:mfRawDotFlat<0,
    targetSignedErrorDeg:signed(a.flat,a.flatTarget,a.blade),localYawBlade:localBlade,localYawTarget:localTarget,
    targetSlewDeg:previous?signed(carry(previous.target,previous.blade,a.blade),a.flatTarget,a.blade):null,
    localYawTargetSlewDeg:previous?signed(carry(previous.localTarget,previous.localBlade,localBlade),localTarget,localBlade):null,
    restTargetSlewDeg:previous?signed(carry(previous.rest,previous.blade,a.blade),b.flatTarget,a.blade):null,
    rawMovementPlaneSlewDeg:previous?signed(carry(previous.mfRaw,previous.blade,a.blade),mfRaw,a.blade):null,
    chosenMovementPlaneSlewDeg:previous?signed(carry(previous.mfChosen,previous.blade,a.blade),mfChosen,a.blade):null,
    actualFlatSlewDeg:previous?signed(carry(previous.flat,previous.blade,a.blade),a.flat,a.blade):null,
    axialPreNativeRadS:frame.preNative.axialRadS,axialPostNativeRadS:frame.postNative.axialRadS,axialPostCombatRadS:frame.postCombat.axialRadS,
    finalSwordTorqueNm:t.torque,finalTorqueNormNm:norm(t.torque),preTwistCapNm:t.cap,axialFinalTorqueNm:dot(t.torque,a.blade),axialTwistTorqueNm:dot(t.twist,a.blade),
    swordInstantPowerW:frame.torqueCalls[0].powerW,allThreeInstantPowerW:frame.torqueCalls.reduce((sum,x)=>sum+x.powerW,0),
    explicitThreeTorqueVectorResidualNm:norm([0,1,2].map(i=>frame.torqueCalls.reduce((sum,x)=>sum+x.torque[i],0))),
    postNativeCombatOmegaDifferenceRadS:norm(frame.postNative.bodies.sword.w.map((x,i)=>x-frame.postCombat.bodies.sword.w[i])),
    handErrorM:frame.preNative.handErrorM,ikShoulderTargetDistanceM:frame.preNative.shoulderToTargetM,ikReachLimitM:frame.preNative.ikReachLimitM,armFull:frame.preNative.armFull,
    swordContactManifolds:frame.postCombat.contacts.length};
  previous={blade:a.blade,target:a.flatTarget,rest:b.flatTarget,flat:a.flat,mfRaw,mfChosen,localBlade,localTarget};
  return row;
});
fs.writeFileSync(opts.out,JSON.stringify({schemaVersion:1,pureDerivation:true,observed:{path:opts.observed,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},
  producerSHA256:createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex'),nativePrefixExactSteps:d.validatedNativeSteps,sourceStable:d.sourceStable,
  angleDefinition:'Signed target/flat angles about current blade; inter-frame vectors transported by minimum blade-axis rotation. localYaw variant first transforms by each recorded yaw inverse. Degrees. Positive chosen-target orientation is not a directed blade-edge/anatomy claim.',
  limits:'Explicit final torque calls and instantaneous T dot omega are requests before native solve; their three-vector residual is not full angular-momentum or work closure. Large axial speed alone is not a naturalness failure. Sword contacts exclude enemy weapon/body contacts.',
  firstSelectedMovementSignChangeTick:rows.find((r,i)=>i&&r.mfWasNegated!==rows[i-1].mfWasNegated)?.tick??null,
  maxExplicitThreeTorqueVectorResidualNm:Math.max(...rows.map(r=>r.explicitThreeTorqueVectorResidualNm)),maxPostNativeCombatOmegaDifferenceRadS:Math.max(...rows.map(r=>r.postNativeCombatOmegaDifferenceRadS)),rows},null,2)+'\n',{flag:'wx'});

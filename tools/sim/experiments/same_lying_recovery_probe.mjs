// Research only: same naturally fallen original state; gates are evidence validity, not human acceptance.
// Actual harness support-transfer observations; no force/model replica or pose freezing.
import {newRound, CONFIG, DT, THREE} from '../harness_m.mjs';
import {installForceLedger, snapshotWorld} from '../force_ledger.mjs';
import {collectSupportContacts} from '../../../src/support_contacts.js';
let OldFighter, OLD_CONFIG;
import {isMain} from '../is_main.mjs';
import {createHash} from 'node:crypto';
import {readFile, writeFile, readdir, mkdtemp, symlink, rm} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';

const SCENARIOS=['healthy_getup','hurt_getup'];
const ROOT=new URL('../../../',import.meta.url), ROOT_PATH=fileURLToPath(ROOT);
const REFERENCE=new URL('docs/strike/same_lying_recovery_summary.json',ROOT);
const V=v=>new THREE.Vector3(v.x,v.y,v.z), Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
const vec=v=>({x:v.x,y:v.y,z:v.z}), norm=v=>Math.hypot(v.x,v.y,v.z);
const hash=x=>createHash('sha256').update(x).digest('hex');
class Passive {update(){}}
const stat=()=>({count:0,sum:0,min:Infinity,max:-Infinity});
function add(s,x){if(x==null)return;if(!Number.isFinite(x))throw new Error('Nonfinite metric');s.count++;s.sum+=x;s.min=Math.min(s.min,x);s.max=Math.max(s.max,x);}
const done=s=>s.count?{count:s.count,min:s.min,mean:s.sum/s.count,max:s.max}:null;
function finite(x){if(typeof x==='number'&&!Number.isFinite(x))throw new Error('Nonfinite observed state');if(x&&typeof x==='object')for(const v of Object.values(x))finite(v);}
function bodies(f){return [...new Map([...Object.values(f.bodies),f.sword,...f.meshes.map(m=>m.rb)].filter(b=>b?.isValid()&&b.isDynamic()).map(b=>[b.handle,b])).values()];}
function physicalControl(f){
  return {bodies:bodies(f).map(b=>({handle:String(b.handle),p:vec(b.translation()),q:{...b.rotation()},v:vec(b.linvel()),w:vec(b.angvel()),m:b.mass()})),anchor:{p:vec(f.anchor.translation()),q:{...f.anchor.rotation()},v:vec(f.anchor.linvel()),w:vec(f.anchor.angvel())},state:f.state,stateTime:f.stateTime,muscle:f.muscle,balance:f.balance,
    limbs:{...f.limbs},handOffset:f.handOffset.toArray(),handHeld:f.handHeld,heading:f.heading,
    skill:{aim:f.skill.aim.toArray(),aimRaw:f.skill.aimRaw.toArray(),aimVel:f.skill.aimVel.toArray(),activity:f.skill.activity,recovering:f.skill.recovering},
    bodyPose:{...f.bodyPose},bodyPoseVel:{...f.bodyPoseVel},joints:f.joints.map(j=>({name:j.name,target:j.target?.toArray(),prevTarget:j.prevTarget?.toArray(),prevRV:j.prevRV?.toArray(),gain:j.gain??1})),gait:{active:f.gait.active,started:f.gait.started,levH:f.gait.levH,levC:f.gait.levC,handU:f.gait.handU,h:f.gait.h,hv:f.gait.hv,legs:Object.fromEntries(['F','B'].map(k=>[k,{stance:f.gait.legs[k].stance,pinC:vec(f.gait.legs[k].pinC),N:f.gait.legs[k].N??null}]))}};
}
function contactObservation(world,body){
  const out={solverPointCount:0,rawNormalImpulseNs:0,rawVerticalImpulseMagnitudeNs:0,maxHorizontalPointSpeedMps:null,contacts:[]};
  for(let ci=0;ci<body.numColliders();ci++)world.contactPairsWith(body.collider(ci),other=>{
    const ground=other.parent();if(!ground?.isFixed())return;
    world.contactPair(body.collider(ci),other,(m,flipped)=>{
      const normal=m.normal();let impulse=0;for(let i=0;i<m.numContacts();i++)impulse+=m.contactImpulse(i);
      out.rawNormalImpulseNs+=impulse;out.rawVerticalImpulseMagnitudeNs+=impulse*Math.abs(normal.y);
      const row={normalWorld:vec(normal),flipped,rawNormalImpulseNs:impulse,impulseContactCount:m.numContacts(),solverPoints:[]};
      for(let i=0;i<m.numSolverContacts();i++){
        const point=m.solverContactPoint(i),velocity=V(body.velocityAtPoint(point)).sub(V(ground.velocityAtPoint(point))),speed=Math.hypot(velocity.x,velocity.z);
        out.solverPointCount++;out.maxHorizontalPointSpeedMps=Math.max(out.maxHorizontalPointSpeedMps??0,speed);
        row.solverPoints.push({worldPointM:vec(point),relativePointVelocityMps:vec(velocity),horizontalSpeedMps:speed,distanceM:m.solverContactDist(i)});
      }out.contacts.push(row);
    });
  });
  out.rawVerticalForceMagnitudeN=out.rawVerticalImpulseMagnitudeNs/DT;return out;
}
function observe(G,timeS,total){
  const f=G.player,feet=Object.fromEntries(['F','B'].map(k=>[k,contactObservation(G.world,f.bodies['foot'+k])])),gaps={};
  const contacts=collectSupportContacts(f,{detail:false});
  const support={anySupport:contacts.anySupport,groups:Object.fromEntries(Object.entries(contacts.groups).map(([name,g])=>[name,{hasSupport:g.hasSupport,touchingEnvironment:g.touchingEnvironment,rawNormalImpulseNs:g.rawNormalImpulseNs,rawNormalForceN:g.rawNormalForceN,solverPointCount:g.contacts.reduce((a,c)=>a+c.solverPointCount,0)}]))};
  for(const j of f.joints){const a=V(j.joint.anchor1()).applyQuaternion(Q(j.parent.rotation())).add(V(j.parent.translation())),b=V(j.joint.anchor2()).applyQuaternion(Q(j.child.rotation())).add(V(j.child.translation()));gaps[j.name]={parentWorldM:vec(a),childWorldM:vec(b),parentPelvisFrameM:vec(a.clone().sub(V(f.bodies.pelvis.translation())).applyQuaternion(Q(f.bodies.pelvis.rotation()).invert())),gapM:a.distanceTo(b)};}
  const p=f.bodies.pelvis.translation(),correctedTilt=f.tiltDeg()-THREE.MathUtils.radToDeg(f.hunch);
  return {timeS,state:f.state,stateTimeS:f.stateTime,pelvisHeightM:p.y,pelvisVelocityMps:vec(f.bodies.pelvis.linvel()),pelvisAngularVelocityRadps:vec(f.bodies.pelvis.angvel()),chestAngularVelocityRadps:vec(f.bodies.chest.angvel()),chestTiltDeg:f.tiltDeg(),correctedChestTiltDeg:correctedTilt,
    actualMassKg:total.mass,actualCOMWorldM:total.COM,actualLinearMomentumKgMps:total.P,actualKineticJ:total.K,
    levH:f.gait.levH,levC:f.gait.levC,handU:f.gait.handU,gaitActive:f.gait.active,legF:f.limbs.legF,legB:f.limbs.legB,
    balanceProbe:f.balanceProbe?{...f.balanceProbe}:null,postStepActualSupport:support,controllerPreStepSupport:{available:!!f.supportContacts,anySupport:f.supportContacts?.anySupport??null,footSupport:f.balanceProbe?.actualFootSupport??null},feet,jointAnchors:gaps,maxJointAnchorGapM:Math.max(...Object.values(gaps).map(g=>g.gapM)),
    physicallyUprightGameGeometry:f.state==='stand'&&p.y>=f.gait.hNom-CONFIG.GAIT.catchSag&&correctedTilt<=CONFIG.BODY.fallTiltDeg&&Object.values(feet).some(c=>c.solverPointCount>0)};
}
const METRICS=['pelvisHeightM','pelvisSpeedMps','pelvisAngularSpeedRadps','chestAngularSpeedRadps','frontKneePelvisFrameLateralM','backKneePelvisFrameLateralM','correctedChestTiltDeg','actualMassKg','linearMomentumMagnitudeKgMps','maxJointAnchorGapM','footPointSlipMaxMps','footRawVerticalN','directAppliedUpN','internalAxialAppliedUpN','axialUnmetUpN'];
function bucket(){return {samples:0,physicallyUprightSamples:0,bothFeetNoContactS:0,noConfirmedEnvironmentSupportS:0,metrics:Object.fromEntries(METRICS.map(k=>[k,stat()]))};}
function record(b,s){
  b.samples++;b.physicallyUprightSamples+=+s.physicallyUprightGameGeometry;b.bothFeetNoContactS+=Object.values(s.feet).every(c=>c.solverPointCount===0)?DT:0;b.noConfirmedEnvironmentSupportS+=s.postStepActualSupport.anySupport?0:DT;
  const values={...s,pelvisSpeedMps:norm(s.pelvisVelocityMps),linearMomentumMagnitudeKgMps:norm(s.actualLinearMomentumKgMps),footPointSlipMaxMps:Math.max(...Object.values(s.feet).map(c=>c.maxHorizontalPointSpeedMps??-1)),footRawVerticalN:Object.values(s.feet).reduce((a,c)=>a+c.rawVerticalForceMagnitudeN,0),directAppliedUpN:s.balanceProbe?.appliedUpN??null,internalAxialAppliedUpN:s.balanceProbe?.supportTransfer?.appliedUpN??null,axialUnmetUpN:s.balanceProbe?.supportTransfer?.unmetUpN??null};
  Object.assign(values,{pelvisAngularSpeedRadps:norm(s.pelvisAngularVelocityRadps),chestAngularSpeedRadps:norm(s.chestAngularVelocityRadps),frontKneePelvisFrameLateralM:s.jointAnchors.shinF?.parentPelvisFrameM.z??null,backKneePelvisFrameLateralM:s.jointAnchors.shinB?.parentPelvisFrameM.z??null});
  if(values.footPointSlipMaxMps<0)values.footPointSlipMaxMps=null;for(const k of METRICS)add(b.metrics[k],values[k]);
}
const finishBucket=b=>({...b,metrics:Object.fromEntries(Object.entries(b.metrics).map(([k,s])=>[k,done(s)]))});
function floor(G){const fixed=[];G.world.forEachRigidBody(b=>{if(b.isFixed())fixed.push(b);});if(fixed.length!==1||fixed[0].numColliders()!==1)throw new Error('Expected one native fixed floor collider');const c=fixed[0].collider(0),e=c.halfExtents(),p=c.translation();if(!e||e.x!==30||e.y!==.5||e.z!==30||Math.abs(p.y+.5)>1e-6)throw new Error('Native harness floor mismatch');return c;}
function ledgerPaths(latest,book){
  for(const frame of latest.physics??[])for(const [path,p]of Object.entries(frame.balance.byPath))if(path.includes('driveBalance')){
    const b=book[path]??={frames:0,signedWorkApproxJ:0,netForceN:stat(),netTorqueAboutOriginNm:stat(),netTorqueAboutPreStepCOMNm:stat(),applicationBodies:{}};b.frames++;b.signedWorkApproxJ+=p.workApproxJ;add(b.netForceN,norm(p.netForceN));add(b.netTorqueAboutOriginNm,norm(p.netTorqueAboutOriginNm));
    // Reference translation only: T_COM = T_origin - (COM-origin) cross F.
    const r=V(frame.pre.total.COM).sub(V(frame.pre.origin));add(b.netTorqueAboutPreStepCOMNm,V(p.netTorqueAboutOriginNm).sub(r.cross(V(p.netForceN))).length());
    for(const [label,x]of Object.entries(p.bodies)){const a=b.applicationBodies[label]??={signedWorkApproxJ:0,forceImpulseNs:{x:0,y:0,z:0},angularImpulseAboutOriginNms:{x:0,y:0,z:0}};a.signedWorkApproxJ+=x.workApproxJ;for(const k of ['x','y','z']){a.forceImpulseNs[k]+=x.forceImpulse[k];a.angularImpulseAboutOriginNms[k]+=x.angularImpulse[k];}}
  }
}

const FILTERS=['allSolverPoints','confirmedSupportPoints','nonPredictiveSupportPoints','rawPositiveManifoldSupportPoints','stanceFlagSupportPoints','activeStanceSupportPoints','rawPositiveActiveStancePoints'];
function slipBucket(){return Object.fromEntries(FILTERS.map(k=>[k,{values:[],peak:null,frames:new Set()}]));}
function slipAdd(bucket,category,speed,peak,frame){const b=bucket[category];b.values.push(speed);b.frames.add(frame);if(!b.peak||speed>b.peak.speedMps)b.peak={...peak,speedMps:speed};}
function detailedSlip(f,timeS,frame,buckets){
 const support=collectSupportContacts(f,{detail:true});
 for(const side of ['F','B']){
  const leg=f.gait.legs[side],body=f.bodies['foot'+side];
  for(const c of support.groups['foot'+side].contacts){
   if(!c.isEnvironment||!c.fixed)continue;
   for(const point of c.solverPoints){
    const speed=Math.hypot(point.relativeVelocity.x,point.relativeVelocity.z);
    const confirmed=c.hasSupport&&point.withinSlop;
    const nonPredictive=confirmed&&point.distanceM<=0&&c.geometryContacts.some(g=>g.reportedDistanceM<=0&&g.freshNormalGapM<=0);
    const peak={timeS,state:f.state,stateTimeS:f.stateTime,foot:side,stance:leg.stance,gaitActive:f.gait.active,levH:f.gait.levH,levC:f.gait.levC,pelvisPosition:vec(f.bodies.pelvis.translation()),pelvisVelocity:vec(f.bodies.pelvis.linvel()),point:point.point,relativeVelocity:point.relativeVelocity,solverDistanceM:point.distanceM,predictionPoint:point.predictionContact,hasSupport:c.hasSupport,freshNormalGapM:c.minimumFreshGapM,minimumReportedGeometryDistanceM:Math.min(...c.geometryContacts.map(g=>g.reportedDistanceM)),rawNormalImpulseNs:c.rawNormalImpulseNs,rawPositiveManifold:c.rawNormalImpulseNs>0,cachedGaitN:leg.N,geometryContactCount:c.geometryContactCount,solverPointCount:c.solverPointCount};
    const categories=['allSolverPoints'];if(confirmed)categories.push('confirmedSupportPoints');if(nonPredictive)categories.push('nonPredictiveSupportPoints');if(confirmed&&c.rawNormalImpulseNs>0)categories.push('rawPositiveManifoldSupportPoints');if(confirmed&&leg.stance)categories.push('stanceFlagSupportPoints');if(confirmed&&leg.stance&&f.gait.active)categories.push('activeStanceSupportPoints');if(confirmed&&leg.stance&&f.gait.active&&c.rawNormalImpulseNs>0)categories.push('rawPositiveActiveStancePoints');
    for(const b of buckets)for(const category of categories)slipAdd(b,category,speed,peak,frame);
   }
  }
 }
}
function finalizeSlip(bucket){return Object.fromEntries(Object.entries(bucket).map(([name,b])=>{const xs=b.values.sort((a,b)=>a-b),n=xs.length;return[name,{pointSamples:n,frames:b.frames.size,meanMps:n?xs.reduce((a,b)=>a+b,0)/n:null,p95Mps:n?xs[Math.ceil(.95*n)-1]:null,maxMps:n?xs[n-1]:null,peak:b.peak}];}));}



function controllerOwnState(f){
 const encode=(x,depth=0)=>{
  if(x==null||typeof x==='string'||typeof x==='boolean'||typeof x==='number')return x;
  if(typeof x==='function'||depth>5)return undefined;
  if(x.isVector2||x.isVector3||x.isQuaternion||x.isEuler)return x.toArray();
  if(Array.isArray(x))return x.map(y=>encode(y,depth+1));
  if(x instanceof Map)return [...x].map(([k,v])=>[encode(k,depth+1),encode(v,depth+1)]);
  if(x instanceof Set)return [...x].map(y=>encode(y,depth+1));
  const out={};for(const [k,v]of Object.entries(x))if(!['f','fighter','foe','world','scene','rb','body','parent','child','joint','rawSet','col','colliderSet','raw','__wbg_ptr','info','mesh','group','grip','sword','supportContacts','balanceProbe'].includes(k)){const q=encode(v,depth+1);if(q!==undefined)out[k]=q;}return out;
 };
 const scalarAndVector={};for(const [k,v]of Object.entries(f))if(v==null||['number','string','boolean'].includes(typeof v)||v?.isVector2||v?.isVector3||v?.isQuaternion)scalarAndVector[k]=encode(v);
 return {scalarAndVector,gait:encode(f.gait),skill:encode(f.skill),footLoad:encode(f.footLoad),prevU:encode(f.prevU),bodyPose:encode(f.bodyPose),bodyPoseVel:encode(f.bodyPoseVel)};
}

function launchFrame(G,f,s,ledger){
 const q=ledger.latest.physics[0],byPath={};
 for(const [path,x]of Object.entries(q.balance.byPath))byPath[path]={netForceN:x.netForceN,netTorqueOriginNm:x.netTorqueAboutOriginNm,workApproxJ:x.workApproxJ};
 let rawGroundImpulseNs=0,nonPredictiveSolverPoints=0;const groundByBody=[];
 for(const [label,body]of [...Object.entries(f.bodies),['sword',f.sword]]){
  if(!body?.isValid())continue;const c=contactObservation(G.world,body);rawGroundImpulseNs+=c.rawNormalImpulseNs;
  const actual=c.contacts.reduce((n,c)=>n+c.solverPoints.filter(p=>p.distanceM<=0).length,0);nonPredictiveSolverPoints+=actual;
  if(c.solverPointCount)groundByBody.push({label,rawNormalImpulseNs:c.rawNormalImpulseNs,solverPoints:c.solverPointCount,nonPredictiveSolverPoints:actual});
 }
 const t=ledger.latest.postGame.total;
 return {timeS:s.timeS,state:s.state,stateTimeS:s.stateTime,physicallyUprightGameGeometry:s.physicallyUprightGameGeometry,correctedChestTiltDeg:s.correctedChestTiltDeg,pelvisHeightM:s.pelvisHeightM,pelvisPositionM:vec(f.bodies.pelvis.translation()),pelvisVelocityMps:vec(f.bodies.pelvis.linvel()),pelvisOmegaRadps:vec(f.bodies.pelvis.angvel()),chestHeightM:f.bodies.chest.translation().y,chestTiltDeg:s.chestTiltDeg,COM:t.COM,COMVelocityMps:{x:t.P.x/t.mass,y:t.P.y/t.mass,z:t.P.z/t.mass},KJ:t.K,massKg:t.mass,massChanges:q.balance.massPropertyChanges,explicitNetForceN:{x:q.balance.explicitForceImpulse.x/DT,y:q.balance.explicitForceImpulse.y/DT,z:q.balance.explicitForceImpulse.z/DT},explicitWorkApproxJ:q.balance.forceWorkApproxJ,byPath,nativeResidualImpulseNs:q.balance.residualP,rawGroundImpulseNs,nonPredictiveSolverPoints,groundByBody,support:s.postStepActualSupport,controllerSupport:s.controllerPreStepSupport,balanceProbe:s.balanceProbe,muscle:f.muscle,kneelAmount:f.kneelAmount,kneelTime:f.kneelTime,riseTime:f.riseTime,downTime:f.downTime,gaitActive:f.gait.active,levH:f.gait.levH,levC:f.gait.levC,feetHeld:f.feetHeld,handHeld:f.handHeld,anchor:{p:vec(f.anchor.translation()),q:{...f.anchor.rotation()}},maxJointAnchorGapM:s.maxJointAnchorGapM,jointTargets:f.joints.map(j=>({name:j.name,gain:j.gain??1,target:j.target?.toArray(),manual:j.manual??false,type:j.type}))};
}
function finalizeLaunch(frames){
 const peak=key=>frames.reduce((a,b)=>key(b)>key(a)?b:a,frames[0]);
 const peaks={pelvisHeight:peak(x=>x.pelvisHeightM),pelvisVy:peak(x=>x.pelvisVelocityMps.y),COMHeight:peak(x=>x.COM.y),COMVy:peak(x=>x.COMVelocityMps.y),jointGap:peak(x=>x.maxJointAnchorGapM)};
 const indexes=new Set();for(const p of Object.values(peaks)){const i=frames.indexOf(p);for(let k=Math.max(0,i-90);k<=Math.min(frames.length-1,i+90);k++)indexes.add(k);}
 for(let i=0;i<frames.length;i++)if(i===0||frames[i].state!==frames[i-1].state)for(let k=Math.max(0,i-30);k<=Math.min(frames.length-1,i+30);k++)indexes.add(k);
 let run=0,maxNoGroundSolverS=0,maxUnsupportedGroupsS=0,grouprun=0;
 for(const x of frames){run=x.nonPredictiveSolverPoints===0?run+DT:0;grouprun=x.support.anySupport?0:grouprun+DT;maxNoGroundSolverS=Math.max(maxNoGroundSolverS,run);maxUnsupportedGroupsS=Math.max(maxUnsupportedGroupsS,grouprun);}
 const down=frames.filter(f=>f.state==='down');
 return {peaks,downGeometry:{samples:down.length,minPelvisHeightM:down.length?Math.min(...down.map(f=>f.pelvisHeightM)):null,minChestHeightM:down.length?Math.min(...down.map(f=>f.chestHeightM)):null,maxChestTiltDeg:down.length?Math.max(...down.map(f=>f.chestTiltDeg)):null,diagnosticLowPelvisUnder045Samples:down.filter(f=>f.pelvisHeightM<.45).length},noNonPredictiveNativeGroundSolverTimeS:frames.filter(f=>f.nonPredictiveSolverPoints===0).length*DT,maxNoNonPredictiveNativeGroundSolverIntervalS:maxNoGroundSolverS,maxNoConfirmedMeasuredGroupSupportIntervalS:maxUnsupportedGroupsS,explicitWorkApproxJ:frames.reduce((n,f)=>n+f.explicitWorkApproxJ,0),denseFrames:[...indexes].sort((a,b)=>a-b).map(i=>frames[i]),compactPerStep:frames.map(({jointTargets,byPath,groundByBody,anchor,support,balanceProbe,...x})=>x),definition:'Peaks/dense are actual per-step observations. No-ground-native solver excludes positive-distance predicted contacts but is not fresh whole-body geometric contact certification. Group-support has current shape checks. Native motor/upright/contact residual is unmeasured, not numerical error. Diagnostic thresholds locate events only.'};
}

export function runSameLyingRecovery({scenario='healthy_getup',model='axial',seed=7,ledgerOn=true,sampleStride=120,expectedSwitch=null,intervention=null}={}){
  if(!SCENARIOS.includes(scenario)||!['legacy','axial','projected'].includes(model))throw new Error('Unknown scenario/model');
  if(model==='axial'&&!Object.hasOwn(CONFIG.BODY,'supportModel'))throw new Error('Axial core API not installed');
  const saved={assist:CONFIG.GAIT.assist,catchMode:CONFIG.GAIT.catchMode,catchScale:CONFIG.GAIT.catchScale,reaction:CONFIG.GRIP.reactionModel,support:CONFIG.BODY.supportModel,weightMode:CONFIG.BODY.weightMode,hasSupport:Object.hasOwn(CONFIG.BODY,'supportModel')},random=Math.random;
  let G,ledger;const row={scenario,model,seed,status:'observed',transitions:[],samples:[]};
  try{
    Object.assign(CONFIG.GAIT,{assist:.1,catchMode:'on',catchScale:1});CONFIG.GRIP.reactionModel='paired';CONFIG.BODY.supportModel='legacy';CONFIG.BODY.weightMode='hybrid';
    G=newRound({seed,walls:false,weapon:'longsword',AIClass:Passive});G.park();const f=G.player;f.skill.autoGuard=true;f.balanceProbe={};f.handHeld=false;
    for(const key of ['GAIT','BODY','GRIP'])Object.assign(OLD_CONFIG[key],CONFIG[key]);
    const currentDrive=f.driveBalance;let useProjected=false;
    f.driveBalance=function(...args){OLD_CONFIG.BODY.supportModel=CONFIG.BODY.supportModel;return (useProjected?currentDrive:OldFighter.prototype.driveBalance).apply(this,args);};
    const advance=seconds=>{for(let i=0;i<Math.round(seconds/DT);i++){G.step();finite(physicalControl(f));}};
    advance(3);if(f.state!=='stand')throw new Error('Legacy preparation did not reach stand');
    if(['hurt_getup'].includes(scenario))f.limbs.legF=.45;
    if(['disabled_getup','floorless_kneel'].includes(scenario))f.limbs.legF=f.limbs.legB=.2;
    if(scenario.endsWith('_getup')||scenario==='floorless_kneel'){f.knockDown(true);if(f.state!=='down')throw new Error('Native knockDown(true) did not enter down');}
    if(scenario==='floorless_getup'){advance(1.2);if(f.state!=='getup')throw new Error('Legacy floor-removal preparation did not retain getup');}
    if(scenario==='floorless_kneel'){for(let i=0;i<Math.ceil(6/DT)&&f.state!=='kneel';i++){G.step();finite(physicalControl(f));}advance(.5);if(f.state!=='kneel')throw new Error('Actual damaged-leg transition did not reach kneel');}
    if(scenario==='floorless_down'){f.knockDown(true);advance(.4);if(f.state!=='down')throw new Error('Native heavy knockDown did not retain down');}
    row.prepareSeconds=G.t;row.startSha256=hash(JSON.stringify(physicalControl(f)));CONFIG.BODY.supportModel=model==='projected'?'axial':model;
    row.floorRemoved=scenario.startsWith('floorless_');if(row.floorRemoved){const c=floor(G);row.removal={colliderHandle:String(c.handle),translationM:vec(c.translation()),halfExtentsM:vec(c.halfExtents())};G.world.removeCollider(c,true);}
    if(ledgerOn)ledger=installForceLedger(G,{fighters:[f],maxSamples:0,contacts:false});
    const total=()=>ledger?ledger.snapshot().total:snapshotWorld(G.world,{bodies:bodies(f)}).total;
    row.initial=observe(G,0,total());row.samples.push(row.initial);const trace=createHash('sha256'),input=createHash('sha256'),all=bucket(),phases={},pathBook={};
    const compactFrames=[];const switchFrame=scenario==='healthy_getup'?264:scenario==='hurt_getup'?336:null;
    row.switchAtS=switchFrame==null?null:switchFrame*DT;row.nativeStateDefinition='Rapier takeSnapshot SHA includes full native world; physicalControl SHA includes body transforms/velocities/masses, anchor, joint targets/prevRV, main skill/gait controller state. Additional numeric/vector controller fields and gait properties captured below; collider/raw WASM allocation pointers are excluded, native data is covered by world snapshot.';
    const slipStartPelvis=V(f.bodies.pelvis.translation()),slipForward=f.forward().clone(),slipAll=slipBucket(),slipAfterStand=slipBucket(),slipAfterLevH=slipBucket();
    const seconds=row.floorRemoved?1:scenario.startsWith('walk_')?6:scenario.endsWith('_getup')?25:3;row.observationSeconds=seconds;
    let previous=row.initial,hadHandover=f.gait.levH>0,firstStandS=f.state==='stand'?0:null,handoverEndS=null,firstGameGeometryUprightS=row.initial.physicallyUprightGameGeometry?0:null;
    for(let i=0;i<Math.round(seconds/DT);i++){
      if(i===switchFrame){
       const pc=physicalControl(f),native=G.world.takeSnapshot();
       const additional=controllerOwnState(f);
       row.switchSnapshot={timeS:i*DT,nativeWorldSha256:hash(native),physicalControlSha256:hash(JSON.stringify(pc)),additionalControllerSha256:hash(JSON.stringify(additional)),physicalControl:pc,additionalController:additional,geometry:{pelvisHeightM:f.bodies.pelvis.translation().y,chestHeightM:f.bodies.chest.translation().y,chestTiltDeg:f.tiltDeg(),state:f.state,stateTimeS:f.stateTime},beforeStepObservation:compactFrames.at(-1)};
       if(model==='projected'){
        if(!expectedSwitch||['nativeWorldSha256','physicalControlSha256','additionalControllerSha256'].some(k=>row.switchSnapshot[k]!==expectedSwitch[k]))throw new Error('STOP: native/controller switch hashes differ');
        row.switchGuardPassed=true;useProjected=true;
        intervention?.activate?.({G,f,row,DT});
       }
      }
      f.move.set(scenario==='walk_side'?1:0,scenario==='walk_front'?1:0);input.update(JSON.stringify(f.move.toArray()));G.step();
      const currentTotal=ledger?ledger.latest.postGame.total:total(),s=observe(G,(i+1)*DT,currentTotal);finite(s);finite(physicalControl(f));
      if(row.floorRemoved&&Object.values(s.feet).some(c=>c.solverPointCount>0))throw new Error('Removed floor retains foot solver contact');
      if(s.state!==previous.state){row.transitions.push({timeS:s.timeS,from:previous.state,to:s.state,pelvisHeightM:s.pelvisHeightM,chestTiltDeg:s.chestTiltDeg,feetSolverPointCount:Object.values(s.feet).reduce((a,c)=>a+c.solverPointCount,0)});if(s.state==='stand'&&firstStandS==null)firstStandS=s.timeS;}
      if(s.levH>0)hadHandover=true;if(hadHandover&&s.levH===0&&handoverEndS==null)handoverEndS=s.timeS;
      if(s.physicallyUprightGameGeometry&&firstGameGeometryUprightS==null)firstGameGeometryUprightS=s.timeS;
      compactFrames.push(launchFrame(G,f,s,ledger));
      const slipBuckets=[slipAll];if(firstStandS!=null)slipBuckets.push(slipAfterStand);if(handoverEndS!=null)slipBuckets.push(slipAfterLevH);
      detailedSlip(f,s.timeS,i,slipBuckets);
      intervention?.afterStep?.({G,f,row,DT,observation:s,iteration:i});
      record(all,s);record(phases[s.state]??=bucket(),s);if(firstStandS!=null)record(phases.afterFirstStand??=bucket(),s);if(handoverEndS!=null)record(phases.afterLevHEnd??=bucket(),s);
      if(ledger)ledgerPaths(ledger.latest,pathBook);trace.update(JSON.stringify(physicalControl(f)));if(i%sampleStride===0||s.state!==previous.state||i===Math.round(seconds/DT)-1)row.samples.push(s);previous=s;
    }
    const slipDelta=V(f.bodies.pelvis.translation()).sub(slipStartPelvis);row.filteredSlip={all:finalizeSlip(slipAll),afterFirstStand:finalizeSlip(slipAfterStand),afterLevHEnd:finalizeSlip(slipAfterLevH),pelvisDisplacementM:vec(slipDelta),pelvisForwardTravelM:slipDelta.dot(slipForward),pelvisHorizontalTravelM:Math.hypot(slipDelta.x,slipDelta.z),forwardReferenceAtStart:vec(slipForward),definition:'Point sample distributions of relative velocityAtPoint horizontal speed. Confirmed=c.hasSupport and native solverPoint.withinSlop. NonPredictive also requires solver distance<=0 and an actual/fresh geometry gap<=0. rawPositive is manifold sum>0; individual impulse entries cannot be paired to solver points. stanceFlag is separate from activeStance.'};
    row.launchObservation=finalizeLaunch(compactFrames);row.final=previous;row.traceSha256=trace.digest('hex');row.inputSha256=input.digest('hex');row.firstStandS=firstStandS;row.firstGameGeometryUprightS=firstGameGeometryUprightS;row.handover={positiveObserved:hadHandover,endS:handoverEndS,postEndObservedSeconds:handoverEndS==null?0:Math.max(0,seconds-handoverEndS),threeSecondsAfterEndObserved:handoverEndS!=null&&seconds-handoverEndS>=3};
    row.postStandRefallTransitions=row.transitions.filter(t=>firstStandS!=null&&t.timeS>firstStandS&&['getup','down'].includes(t.to));row.statistics=finishBucket(all);row.phaseStatistics=Object.fromEntries(Object.entries(phases).map(([k,b])=>[k,finishBucket(b)]));
    row.directBalancePaths=Object.fromEntries(Object.entries(pathBook).map(([path,b])=>[path,{...b,netForceN:done(b.netForceN),netTorqueAboutOriginNm:done(b.netTorqueAboutOriginNm),netTorqueAboutPreStepCOMNm:done(b.netTorqueAboutPreStepCOMNm),statisticDefinition:'Magnitude min/mean/max over frames where this path exists; ledger.summary additionally gives all-physics-step means/RMS with absent paths zero. Torque references fixed origin or pre-step selected-body COM as named.'}]));row.ledger=ledger?{available:true,summary:ledger.summary()}:{available:false};row.finite=true;
  }catch(e){row.status='error';row.error=e.stack;}
  finally{intervention?.restore?.();ledger?.restore();G?.eventQueue.free();G?.world.free();Math.random=random;Object.assign(CONFIG.GAIT,{assist:saved.assist,catchMode:saved.catchMode,catchScale:saved.catchScale});CONFIG.GRIP.reactionModel=saved.reaction;CONFIG.BODY.weightMode=saved.weightMode;if(saved.hasSupport)CONFIG.BODY.supportModel=saved.support;else delete CONFIG.BODY.supportModel;}
  return row;
}

export async function withOriginalRecovery(callback) {
 const reference=JSON.parse(await readFile(REFERENCE,'utf8')),oldRef=reference.originalReference;
 if(oldRef!=='b6483ea65f6ff4097b2386493ee9487f711527d4')throw new Error('Unexpected original reference');
 const archiveDir=await mkdtemp(join(tmpdir(),'halfsword-own-recovery-control-'));
 try {
  const archive=execFileSync('git',['archive',oldRef,'src','package.json'],{cwd:ROOT_PATH,maxBuffer:64*1024*1024});
  execFileSync('tar',['-xf','-','-C',archiveDir],{input:archive});
  await symlink(join(ROOT_PATH,'node_modules'),join(archiveDir,'node_modules'),'dir');
  for(const [p,expected] of Object.entries(reference.originalSourceSha256))if(hash(await readFile(join(archiveDir,p)))!==expected)throw new Error('Original archive mismatch: '+p);
  OLD_CONFIG=await import(pathToFileURL(join(archiveDir,'src/config.js')).href);
  ({Fighter:OldFighter}=await import(pathToFileURL(join(archiveDir,'src/fighter.js')).href));
  return await callback(reference);
 } finally { await rm(archiveDir,{recursive:true,force:true}); }
}

async function main(){
 if(process.argv.includes('--help')){console.log('node tools/sim/experiments/same_lying_recovery_probe.mjs [--out=/tmp/same-lying-recovery.json]\nFixed seed7 B/paired, original b648 own archive, healthy/hurt25s. Original trace and native/controller switch equality are mandatory gates. Research only.');return;}
 const args=process.argv.slice(2);if(args.some(a=>!/^--out=.+$/.test(a))||args.length>1)throw new Error('Only --out=PATH is supported; protocol is fixed by compact reference.');
 const output=args[0]?.slice(6)||'/tmp/same-lying-recovery.json';
 const reference=JSON.parse(await readFile(REFERENCE,'utf8')),oldRef=reference.originalReference;
 if(oldRef!=='b6483ea65f6ff4097b2386493ee9487f711527d4')throw new Error('Only the verified original own-repository reference is allowed.');
 let archiveDir;const rows=[],guards=[];
 async function sourceFiles(dir){const entries=await readdir(new URL(dir,ROOT),{withFileTypes:true});const out=[];for(const e of entries){const p=dir+'/'+e.name;if(e.isDirectory())out.push(...await sourceFiles(p));else if(e.name.endsWith('.js'))out.push(p);}return out;}
 const manifest=async()=>{const files=[...await sourceFiles('src'),'tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs','tools/sim/experiments/same_lying_recovery_probe.mjs','docs/strike/same_lying_recovery_summary.json'].sort();return Object.fromEntries(await Promise.all(files.map(async p=>[p,hash(await readFile(new URL(p,ROOT)))])));};
 const before=await manifest(),begin=performance.now();let error=null;
 try{
  archiveDir=await mkdtemp(join(tmpdir(),'halfsword-own-same-lying-'));
  const archive=execFileSync('git',['archive',oldRef,'src','package.json'],{cwd:ROOT_PATH,maxBuffer:64*1024*1024});
  execFileSync('tar',['-xf','-','-C',archiveDir],{input:archive});
  await symlink(join(ROOT_PATH,'node_modules'),join(archiveDir,'node_modules'),'dir');
  for(const [p,expected]of Object.entries(reference.originalSourceSha256))if(hash(await readFile(join(archiveDir,p)))!==expected)throw new Error('Archived original source mismatch: '+p);
  OLD_CONFIG=await import(pathToFileURL(join(archiveDir,'src/config.js')).href);
  ({Fighter:OldFighter}=await import(pathToFileURL(join(archiveDir,'src/fighter.js')).href));
  for(const scenario of SCENARIOS){
   const original=runSameLyingRecovery({scenario,model:'axial'});rows.push(original);
   if(original.status!=='observed'||original.traceSha256!==reference.expectedOriginalTraceSha256[scenario])throw new Error('STOP: original full-trace guard failed for '+scenario);
   if(original.switchSnapshot.geometry.state!=='down'||original.switchSnapshot.geometry.pelvisHeightM>=.45)throw new Error('STOP: original switch is not the recorded low-down geometry.');
   const projected=runSameLyingRecovery({scenario,model:'projected',expectedSwitch:original.switchSnapshot});rows.push(projected);
   const g={scenario,originalTraceMatchesExpected:true,sameStart:original.startSha256===projected.startSha256,sameInput:original.inputSha256===projected.inputSha256,sameSwitchNative:original.switchSnapshot.nativeWorldSha256===projected.switchSnapshot?.nativeWorldSha256,sameSwitchPhysicalController:original.switchSnapshot.physicalControlSha256===projected.switchSnapshot?.physicalControlSha256,sameSwitchAdditionalController:original.switchSnapshot.additionalControllerSha256===projected.switchSnapshot?.additionalControllerSha256};guards.push(g);
   if(projected.status!=='observed'||Object.entries(g).some(([k,v])=>k!=='scenario'&&!v))throw new Error('STOP: matched-state recovery guard failed for '+scenario);
  }
 }catch(e){error=e.stack;}finally{if(archiveDir)await rm(archiveDir,{recursive:true,force:true});}
 const after=await manifest();
 const result={schemaVersion:1,probe:'same_lying_recovery_diagnosis',command:'node tools/sim/experiments/same_lying_recovery_probe.mjs --out='+output,originalReference:oldRef,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT_PATH,encoding:'utf8'}).trim(),sourceSha256:before,sourceSha256After:after,sourceStableDuringRun:JSON.stringify(before)===JSON.stringify(after),wallSeconds:(performance.now()-begin)/1000,protocol:reference.protocol,guards,error,rows};
 await writeFile(output,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({out:output,rows:rows.length,wallSeconds:result.wallSeconds,sourceStableDuringRun:result.sourceStableDuringRun,guards,error,summary:rows.map(r=>({scenario:r.scenario,model:r.model,finite:r.finite,traceSha256:r.traceSha256,refalls:r.postStandRefallTransitions?.length,peakPelvisHeightM:r.launchObservation?.peaks.pelvisHeight.pelvisHeightM,maxGroundSolverAbsentS:r.launchObservation?.maxNoNonPredictiveNativeGroundSolverIntervalS}))}));
 if(error||!result.sourceStableDuringRun||rows.length!==4)process.exitCode=1;
}
if(isMain(import.meta.url))main().catch(e=>{console.error(e.stack);process.exitCode=1;});

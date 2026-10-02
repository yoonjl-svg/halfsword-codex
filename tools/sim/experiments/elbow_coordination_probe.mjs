// Read-only coordination observations on the actual game/native solver.
import { readFile, writeFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { runStroke as unmodifiedRunStroke } from '../whole_body_strike_probe.mjs';
import { installForceLedger } from '../force_ledger.mjs';
import { THREE, CONFIG } from '../harness_m.mjs';
import { isMain } from '../is_main.mjs';

const root=new URL('../../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
const rot=b=>Q(b.rotation()),omega=b=>V(b.angvel());
const point=(b,p)=>V(p).applyQuaternion(rot(b)).add(V(b.translation()));
const rv=q=>{q=q.clone().normalize();if(q.w<0)q.set(-q.x,-q.y,-q.z,-q.w);const s=Math.hypot(q.x,q.y,q.z);return s<1e-10?new THREE.Vector3():new THREE.Vector3(q.x,q.y,q.z).multiplyScalar(2*Math.atan2(s,q.w)/s);};
const opts=Object.fromEntries(process.argv.slice(2).map(s=>{const m=s.match(/^--([^=]+)=(.*)$/);if(!m)throw Error('Use --name=value');return[m[1],m[2]];}));
const out=opts.out??'/tmp/elbow-coordination-round1.json';
const skillLevel=Number(opts.level??.7);if(!Number.isFinite(skillLevel)||skillLevel<0||skillLevel>1)throw Error('Invalid skill level');
let runStroke=unmodifiedRunStroke,temporary=null,inputHelperSHA256=null;
if(skillLevel!==.7){
  // Existing helper has no skill argument. Change only newRound's actual input setting in a temporary test helper.
  const url=new URL('tools/sim/whole_body_strike_probe.mjs',root),original=await readFile(url,'utf8');
  const marker="newRound({seed,walls:false,weapon,weapon2:'longsword'})";
  if(original.split(marker).length!==2)throw Error('Expected one preparation input constructor');
  let source=original.replace(marker,`newRound({seed,walls:false,weapon,weapon2:'longsword',skill:${skillLevel}})`);
  source=source.replace(/from (['"])([^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(p.startsWith('.')?new URL(p,url).href:import.meta.resolve(p)));
  temporary=await mkdtemp(join(tmpdir(),'elbow-coordination-input-'));const file=join(temporary,'stroke.mjs');
  await writeFile(file,source);inputHelperSHA256=sha(source);({runStroke}=await import(pathToFileURL(file).href));
}
const sourceNames=await readdir(new URL('src/',root));
const files=[...sourceNames.filter(n=>n.endsWith('.js')).sort().map(n=>'src/'+n),
  'tools/sim/harness_m.mjs','tools/sim/whole_body_strike_probe.mjs','tools/sim/force_ledger.mjs',
  'tools/sim/experiments/elbow_coordination_probe.mjs','node_modules/@dimforge/rapier3d-compat/rapier.mjs'];
const manifest=async()=>Object.fromEntries(await Promise.all(files.map(async p=>[p,sha(await readFile(new URL(p,root)))])));

export function observer(){
  let f,ledger,undoRaw,undoIK,initialNative,initialControl,configuredNative,motor=null,requestDistance=null;
  const frames=[],counts={configure:0},phaseWork={stroke:{},after_input:{}};
  return {frames,counts,phaseWork,
    activate(c){f=c.f;ledger=c.ledger;initialNative=sha(c.G.world.takeSnapshot());initialControl=c.startState;
      const raw=f.jointByName.farmS.joint.rawSet,original=raw.jointConfigureMotor;
      raw.jointConfigureMotor=function(...a){if(a[0]===f.jointByName.farmS.joint.handle){counts.configure++;motor={axis:a[1],targetPositionRad:a[2],targetVelocityRadps:a[3],stiffness:a[4],damping:a[5]};}return original.apply(this,a);};
      undoRaw=()=>{raw.jointConfigureMotor=original;};
      const originalIK=f.constructor.prototype.armIK;
      undoIK=ledger.replaceObservedMethod(f,'armIK',function(target){
        const chest=this.bodies.chest;
        requestDistance=V(target).sub(V(chest.translation())).applyQuaternion(rot(chest).invert())
          .sub(new THREE.Vector3(CONFIG.ARM.shoulder[0],CONFIG.ARM.shoulder[1],this.side*CONFIG.ARM.shoulder[2])).length();
        return originalIK.call(this,target);
      });configuredNative=sha(c.G.world.takeSnapshot());
    },
    afterStep({sample:s,iteration,DT}){
      const chest=f.bodies.chest,up=f.bodies.uarmS,fore=f.bodies.farmS,sword=f.sword;
      const shoulderJ=f.jointByName.uarmS,elbowJ=f.jointByName.farmS;
      const shoulder=point(up,shoulderJ.joint.anchor2()),elbow=point(up,elbowJ.joint.anchor1()),grip=point(fore,f.gripJoint.anchor1()),tip=V(s.tipWorldM);
      const axis=new THREE.Vector3(0,0,1).applyQuaternion(rot(up));
      const elbowFlex=rv(elbowJ.restInv.clone().multiply(rot(up).invert().multiply(rot(fore)))).z;
      const targetFlex=rv(elbowJ.restInv.clone().multiply(elbowJ.target)).z;
      const upperRel=omega(up).sub(omega(chest)),elbowRel=omega(fore).sub(omega(up)),wristRel=omega(sword).sub(omega(fore));
      const upperAxis=new THREE.Vector3(1,0,0).applyQuaternion(rot(up));
      const components={base:V(chest.velocityAtPoint(shoulder)).add(omega(chest).cross(tip.clone().sub(shoulder))),
        shoulder:upperRel.clone().cross(tip.clone().sub(shoulder)),
        elbow:elbowRel.clone().cross(tip.clone().sub(elbow)),
        wrist:wristRel.clone().cross(tip.clone().sub(grip))};
      const tipV=V(s.tipVelocityMps),pred=Object.values(components).reduce((v,c)=>v.add(c),new THREE.Vector3()),unit=tipV.clone().normalize();
      const work={};
      for(const seg of ledger.latest.physics)for(const [path,p]of Object.entries(seg.balance.byPath))if(/\.(manualMuscle|driveSword|elbowGravity)$/.test(path)){
        const name=path.split('.').at(-1);work[name]=(work[name]??0)+p.workApproxJ;
        phaseWork[s.phase][name]=(phaseWork[s.phase][name]??0)+p.workApproxJ;
      }
      const gap=(j)=>point(j.body1(),j.anchor1()).distanceTo(point(j.body2(),j.anchor2()));
      frames.push({iteration,timeS:s.timeS,phase:s.phase,tipMps:s.tipSpeedMps,handErrorM:s.handTargetErrorM,bladeAimErrorRad:s.bladeAimErrorRad,
        skillLevel:f.skill.level,guardWeight:f.guardWeight(),armFull:f.armFull,requestShoulderDistanceM:requestDistance,targetElbowFlexRad:targetFlex,actualElbowFlexRad:elbowFlex,
        elbowRateRadps:elbowRel.dot(axis),elbowOffAxisRateRadps:elbowRel.clone().addScaledVector(axis,-elbowRel.dot(axis)).length(),
        upperRelativeSwingRadps:upperRel.clone().addScaledVector(upperAxis,-upperRel.dot(upperAxis)).length(),
        upperAbsoluteAngularRadps:omega(up).length(),forearmAbsoluteAngularRadps:omega(fore).length(),wristRelativeAngularRadps:wristRel.length(),
        motor:{...motor},swordKJ:s.swordEnergy.translationJ+s.swordEnergy.rotationJ,
        tipVelocityComponentsMps:Object.fromEntries(Object.entries(components).map(([n,v])=>[n,v.toArray()])),
        tipVelocitySignedProjectionMps:Object.fromEntries(Object.entries(components).map(([n,v])=>[n,v.dot(unit)])),
        tipVelocityClosureResidualMps:tipV.sub(pred).length(),
        shoulderGapM:gap(shoulderJ.joint),elbowGapM:gap(elbowJ.joint),gripGapM:gap(f.gripJoint),explicitWorkApproxJ:work});
      if(!motor||counts.configure!==iteration+1)throw Error('Expected one actual farmS motor configure per game step');
    },
    restore(){undoRaw?.();undoIK?.();},
    evidence(){return{installationNativeUnchanged:initialNative===configuredNative,initialControl,counts,phaseWork,frames};}
  };
}
export function summarize(frames){
  const active=frames.filter(f=>f.phase==='stroke'),after=frames.filter(f=>f.phase==='after_input');
  const peak=(xs,k)=>xs.reduce((a,b)=>b[k]>a[k]?b:a,xs[0]);
  const range=(xs,k)=>[Math.min(...xs.map(f=>f[k])),Math.max(...xs.map(f=>f[k]))];
  const tip=peak(active,'tipMps'),up=peak(active,'upperRelativeSwingRadps'),fore=peak(active,'forearmAbsoluteAngularRadps');
  const extension=active.reduce((a,b)=>b.elbowRateRadps<a.elbowRateRadps?b:a,active[0]);
  return{strokeFrames:active.length,reachSaturatedFrames:active.filter(f=>f.armFull).length,
    actualFlexRangeRad:range(active,'actualElbowFlexRad'),targetFlexRangeRad:range(active,'targetElbowFlexRad'),
    requestedShoulderDistanceRangeM:range(active,'requestShoulderDistanceM'),
    peakUpperRelativeSwing:{timeS:up.timeS,radps:up.upperRelativeSwingRadps},
    peakForearmAbsoluteAngular:{timeS:fore.timeS,radps:fore.forearmAbsoluteAngularRadps},
    peakElbowExtension:{timeS:extension.timeS,radps:extension.elbowRateRadps},
    peakTip:{timeS:tip.timeS,mps:tip.tipMps,elbowFlexRad:tip.actualElbowFlexRad,elbowRateRadps:tip.elbowRateRadps,
      velocityProjectionMps:tip.tipVelocitySignedProjectionMps,closureResidualMps:tip.tipVelocityClosureResidualMps},
    peakUpperToTipLagS:tip.timeS-up.timeS,peakExtensionToTipLagS:tip.timeS-extension.timeS,
    maxVelocityClosureResidualMps:Math.max(...frames.map(f=>f.tipVelocityClosureResidualMps)),
    maxJointGapM:Math.max(...frames.flatMap(f=>[f.shoulderGapM,f.elbowGapM,f.gripGapM])),
    afterInputActualFlexRangeRad:range(after,'actualElbowFlexRad')};
}
export { runStroke, inputHelperSHA256 };
export async function cleanupInputHelper(){if(temporary)await rm(temporary,{recursive:true,force:true});}
async function main(){
const before=await manifest(),begin=performance.now(),rows=[],checks=[];
for(const weapon of (opts.weapons??'sabre,zweihander').split(','))for(const direction of (opts.directions??'down,up,cross').split(','))for(const ending of (opts.endings??'target_hold,release').split(',')){
  const c={weapon,direction,ending,reaction:'paired',seed:7,prepareS:3,durationS:.55,afterS:1.2,sampleHz:30,skillLevel};
  const baseline=runStroke(c),o=observer(),observed=runStroke({...c,ledgerFactory:G=>installForceLedger(G,{fighters:[G.player],maxSamples:0}),intervention:o});
  const e=o.evidence(),check={weapon,direction,ending,samePreparedNative:baseline.startNativeSha256===observed.startNativeSha256,
    samePreparedControl:baseline.startSha256===observed.startSha256,sameRequestedInput:baseline.inputSha256===observed.inputSha256,
    observerTraceExact:baseline.traceSha256===observed.traceSha256,installationNativeUnchanged:e.installationNativeUnchanged,
    actualMotorCalls:e.counts.configure,expectedMotorCalls:e.frames.length};
  if(Object.values(check).some(v=>v===false)||check.actualMotorCalls!==check.expectedMotorCalls)throw Error('Observation gate failed');
  checks.push(check);const summary=summarize(e.frames);rows.push({condition:c,baselineTraceSha256:baseline.traceSha256,observedTraceSha256:observed.traceSha256,summary,phaseExplicitWorkApproxJ:e.phaseWork,frames:e.frames});
  console.log(JSON.stringify({weapon,direction,ending,summary}));
}
let sourceCommit;try{sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();}catch(e){if(e.status!==0||!e.stdout)throw e;sourceCommit=e.stdout.trim();}
const after=await manifest(),report={schemaVersion:1,createdUTC:new Date().toISOString(),sourceCommit,
  command:process.argv.join(' '),sourceBefore:before,sourceAfter:after,sourceStable:JSON.stringify(before)===JSON.stringify(after),wallSeconds:(performance.now()-begin)/1000,
  protocol:{skillLevel,guardWeight:Math.min(1,skillLevel*1.6),inputHelperSHA256,
    skillPreparation:'Skill level passed to actual newRound before 3s preparation. For non-default levels only the existing test helper constructor gains a literal skill option in a temporary module; all actual game classes/step/native solver remain unchanged.',
    engine:'Unmodified installed npm Rapier; no engine rebuild, native motor replacement, or candidate',
    measurements:'Actual hinge rotation vector relative to rest, angular velocity projections, native configure inputs, actual rigid body energies and tip velocity',
    velocityDecomposition:'base at shoulder + chest rotation at tip; shoulder relative rotation at tip; elbow relative rotation at tip; wrist relative rotation at tip. Closure residual reports anchor/solver velocity differences. Signed projections are kinematic contributions, never work or energy.',
    work:'Existing force ledger signed midpoint work for explicit shoulder manualMuscle, sword driveSword with reactions, and elbowGravity. Native motor/constraint/contact work unmeasured.',
    timing:'Targets/configure precede native integration; angle/velocity/energy follow it. Peak times are descriptions, not proof of anatomical or causal transfer.',
    samples:'12 conditions, 24 actual game runs by default. Same drag hold/release branches are not independent strokes; single deterministic seed; no opponent or mobile claims.'},
  checks,rows};
report.pass=report.sourceStable&&checks.every(c=>c.observerTraceExact);
await writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});if(temporary)await rm(temporary,{recursive:true,force:true});console.log(JSON.stringify({out,pass:report.pass,rows:rows.length,wallSeconds:report.wallSeconds}));if(!report.pass)process.exitCode=1;
}
if(isMain(import.meta.url))await main();

// Read-only derivation and compact source/evidence map; no physics execution.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
const options=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(evidence|out|velocity)=(.+)$/.exec(s);assert(m);return[m[1],m[2]];}));
assert(options.evidence&&options.out&&!fs.existsSync(options.out));
const root=fileURLToPath(new URL('../../../',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const artifact=name=>{const p=path.join(options.evidence,name),b=fs.readFileSync(p);return{path:p,bytes:b.length,sha256:sha(b)};};
const load=name=>JSON.parse(fs.readFileSync(path.join(options.evidence,name)));
const native=load('native01.json'),geometry=load('geometry01.json'),tensor=load('tensor-geometry01.json');
const V=a=>new THREE.Vector3(...a),deg=x=>x*180/Math.PI,dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const signed=(a,b,n)=>Math.atan2(new THREE.Vector3().crossVectors(a,b).dot(n),a.dot(b));
const carry=(a,from,to)=>a.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(from,to));
const boundary=native.rows.filter(r=>r.weapon==='longsword').map(row=>{
  const frames=row.frames.filter(f=>f.tick>=323&&f.tick<=328);let previous=null;
  return{mode:row.mode,frames:frames.map(f=>{
    const p=f.plane,blade=V(p.blade),flat=V(p.flat),raw=new THREE.Vector3().crossVectors(blade,V(p.edgeVelocity)).normalize();
    const chosen=raw.clone();if(chosen.dot(flat)<0)chosen.negate();
    const result={tick:f.tick,moving:p.moving,rawMotionDotFlat:raw.dot(flat),restDotRawMotion:dot(p.rest,raw.toArray()),
      rawMotionSlewDeg:previous?deg(signed(carry(previous.raw,previous.blade,blade),raw,blade)):null,
      chosenMotionSlewDeg:previous?deg(signed(carry(previous.chosen,previous.blade,blade),chosen,blade)):null,
      targetSlewDeg:deg(p.targetSlewRad),signedTargetErrorDeg:deg(p.signedErrorRad),
      positionTorqueNm:f.torque.positionTorque,positionTorqueDeltaNm:f.torque.positionTorqueDelta,
      finalRequestedAxialTorqueNm:dot(f.torque.final,p.blade),finalRequestedTorqueNm:f.torque.final,
      postCombatAxialOmegaRadps:f.actual.axialOmega,actualUnsignedEdgeErrorRad:f.actual.actualEdgeErrorRad,tipSpeedMps:f.actual.tipSpeed};
    previous={raw,chosen,blade};return result;
  })};
});
const comparisons=native.comparisons.map(c=>{const rows=native.rows.filter(r=>r.weapon===c.weapon),[a,b]=rows;
  return{...c,appliedPadExact:a.frames.every((f,i)=>JSON.stringify(f.actual.pad)===JSON.stringify(b.frames[i].actual.pad)),
    legacy: {recut:a.summary.recut,recutHold:a.summary.recutHold,release:a.summary.release},
    continuedNormal:{recut:b.summary.recut,recutHold:b.summary.recutHold,release:b.summary.release}};
});
const frozenVerify=Object.entries(native.frozenBefore).map(([name,expected])=>({name,expected,actual:sha(fs.readFileSync(path.join(native.directory,name)))}));
assert(frozenVerify.every(f=>f.expected===f.actual),'Frozen runtime changed after run');
const toolNames=['p4_continued_plane_candidate.mjs','p4_recut_geometry.mjs','p4_recut_probe.mjs','p4_tensor_geometry.mjs','p4_recut_summary.mjs'];
if(options.velocity)toolNames.push('p4_velocity_origin.mjs');
const tools=Object.fromEntries(toolNames.map(name=>{const p='tools/sim/experiments/'+name,b=fs.readFileSync(path.join(root,p));return[p,{bytes:b.length,sha256:sha(b)}];}));
const result={schemaVersion:1,updatedUTC:new Date().toISOString(),sourceCommit:native.sourceCommit,
  decision:'Both candidates rejected; research tools and evidence retained. Runtime/defaults/public delivery unchanged.',
  measurementValid:native.pass,effectAccepted:false,newPhysicsExecutions:4,newPhysicsSteps:native.physicsSteps,physicsWallSeconds:native.wallSeconds,
  conditions:{weapons:['qinggang','longsword'],modes:['legacy','continuedNormal'],seed:7,skill:'ordinary unified-20261005-r2; old skill0 internally',playerArm:'manual',
    qinggangPhysics:'ordinary legacy shape/thrust plane/finish',gapM:14,dt:native.dt,stepsPerRun:native.stepsPerRun,interventionTick:native.interventionTick,
    input:'accumulated supplied deltas: prepare, first cut, reverse, native tap, recut, held follow-through, release .5s; original AI',
    unchanged:'mass/COM/inertia, gains, force caps, swing/twist torque laws, damage, native poses/velocities/health'},
  geometry:{source:geometry.source,physicsSteps:0,rows:geometry.rows.map(({frames,...summary})=>summary),
    conclusion:'Removing final actual-flat sign prevents the archived target reversal but leaves a directed127.66deg target risk.'},
  native:{sourceStable:native.sourceStable,originalSourceStable:native.originalSourceStable,allFrozenFilesReverified:true,
    runtimeArtifact:native.directory,runtimeArtifactIsGitWorktree:false,frozenFileCount:frozenVerify.length,
    checks:native.rows.map(r=>({weapon:r.weapon,mode:r.mode,checks:r.checks})),comparisons,firstCounterexample:boundary,
    rejection:'Longsword recut: edge error0.17553->0.57507rad, axial travel1.19610->3.39484rad, tip peak7.85875->6.91968m/s. Release axial travel0.88327->1.06077rad. Qinggang does not meaningfully expose a beneficial branch.'},
  tensor:{physicsSteps:0,rows:tensor.rows.map(({frames,...summary})=>summary),unitFixtures:tensor.unitFixtures,intrinsicSeams:tensor.intrinsicSeams,
    rejection:'Sign-invariant tensor goal keeps original torque law, distinct from rejected plane-potential torque sum. Archived Qinggang target jump worsens94.76->125.68deg; normalized torque step1.504->1.860 at1206. No candidate physics warranted.'},
  evidence:['geometry01.json','native01.json','tensor-geometry01.json'].map(artifact),tools,
  historicalToolArchive:{path:path.join(native.directory,'tools/sim/experiments/p4_continued_plane_candidate.mjs'),
    note:'Frozen pre-rejection helper matches the candidate SHA in native/tensor artifacts. Current helper adds rejection comments only.'},
  commands:{geometry:['node','tools/sim/experiments/p4_recut_geometry.mjs','--observed='+geometry.source.path,'--out=<fresh-geometry.json>'],
    native:native.command,tensor:['node','tools/sim/experiments/p4_tensor_geometry.mjs','--old='+geometry.source.path,'--native='+path.join(options.evidence,'native01.json'),'--out=<fresh-tensor.json>'],summary:process.argv},
  limits:['pass=true is measurement validity, not gameplay improvement.','No candidate from-spawn, injury, contact, browser or human acceptance was run after rejection.',
    'Frozen geometry does not integrate candidate feedback; no active transported-thrust replay is claimed.',
    'All four physics runs contain the same read-only instrumentation. No extra observer-off physics duplicate was run; inserted reads were statically audited.',
    'Explicit requested torque and left-endpoint torque*omega work do not close the coupled native motor/contact energy ledger.',
    'P4 as a whole remains open. Whole development wall time was not separately metered; reported4.106s is native probe only.'],
  next:{timeboxMinutes:30,scope:'Read existing ordinary-r2 tick323-326 and archived Q tick1205-1208 to separate cached finite-difference blade motion from instantaneous pre-drive native point velocity; only then choose a controller intervention.',
    reason:'trackBlade computes a finite-difference hitPointVel and driveSword later chooses movement plane from it. Lag is observable but is not yet proven the unique cause. No gain sweep, memory reactivation, or force compensation.',
    source:['src/fighter.js:2091','src/fighter.js:2324']}};
if(options.velocity){
  const bytes=fs.readFileSync(options.velocity),v=JSON.parse(bytes);
  assert(v.pass&&v.sourceStable&&v.nativeAndAppliedInputExact&&v.physicsSteps===333);
  assert.equal(v.reference.sha256,artifact('native01.json').sha256);
  result.velocityOrigin={measurementValid:v.pass,effectAccepted:false,sourceStable:v.sourceStable,sourceCommit:v.sourceCommit,
    frozenRuntimeArtifact:v.frozenRuntimeArtifact,sourceBefore:v.sourceBefore,sourceAfter:v.sourceAfter,
    newPhysicsExecutions:1,physicsSteps:v.physicsSteps,wallSeconds:v.wallSeconds,nativeAndAppliedInputExact:v.nativeAndAppliedInputExact,
    observedFrames:v.frames.length,observeTicks:[v.observeStart,v.observeEnd],
    definitions:{cached:'At driveSword tick n, trackBlade has only stored the secant from n-2 to n-1.',
      currentSecant:'At the same pre-drive boundary, current point minus hitPointPrev divided bydt; trackBlade writes this after driveSword.',
      native:'sword.velocityAtPoint(bladePoint(.7)) at the same pre-drive boundary; independent vCOM + omega cross(point-worldCOM).'},
    checks:{maximumNativeFormulaDifferenceMps:Math.max(...v.frames.map(f=>f.pre.nativeCheckErrorMps)),
      maximumCachedVsPriorCurrentSecantDifferenceMps:Math.max(...v.frames.map(f=>f.pre.cachedVsPreviousCurrentSecantMps??0)),
      maximumNativeVsPriorPostCombatDifferenceMps:Math.max(...v.frames.map(f=>f.pre.nativeVsPriorPostCombatMps))},
    frozenStateAlternatives:v.derived,
    decision:'The sample-order delay is real, but neither current secant nor instantaneous native velocity removes this target sign boundary. Native substitution increases frozen-state target and normalized torque jumps. No velocity-substitution candidate physics or runtime promotion.',
    limits:v.limits,evidence:{path:options.velocity,bytes:bytes.length,sha256:sha(bytes)},command:v.command,producerSHA256:v.producerSHA256};
  result.newPhysicsExecutions+=1;result.newPhysicsSteps+=v.physicsSteps;result.physicsWallSeconds+=v.wallSeconds;
  result.executionBreakdown=[{kind:'candidate screen',executions:4,steps:native.physicsSteps},{kind:'read-only baseline replay, not an independent efficacy sample',executions:1,steps:v.physicsSteps}];
  result.evidence.push(result.velocityOrigin.evidence);result.commands.velocity=v.command;
  result.next={timeboxMinutes:30,scope:'On the retained current-r2 boundary, separate whether preserving the existing pre-seam physical turn or selecting the new shorter unsigned plane best preserves the intended recut; specify that route contract before another controller candidate.',
    constraints:'Do not repeat velocity substitution, continued-normal, tensor, hemisphere, plane-potential/gain or delay-filter variants merely to reduce a trace peak. Runtime remains unchanged; contact and gameplay priorities can take the next slot.'};
}
fs.writeFileSync(options.out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({measurementValid:result.measurementValid,effectAccepted:false,physicsExecutions:result.newPhysicsExecutions,
  physicsSteps:result.newPhysicsSteps,sourceStable:native.sourceStable,velocityOrigin:!!result.velocityOrigin,output:options.out}));

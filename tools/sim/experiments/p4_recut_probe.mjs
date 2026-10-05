// Four narrowly matched native runs on an explicit frozen-source artifact copy.
// No pose/velocity/health injection, no force changes and no enemy AI replacement.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import * as THREE from 'three';

const opts = Object.fromEntries(process.argv.slice(2).map(value => {
  const match = /^--(out|weapons|activate)=(.+)$/.exec(value); assert(match); return [match[1], match[2]];
}));
assert(opts.out && path.isAbsolute(opts.out) && !fs.existsSync(opts.out));
const weapons = (opts.weapons ?? 'qinggang,longsword').split(',');
assert(weapons.length && weapons.every(w => ['qinggang','longsword'].includes(w)));
const activate = opts.activate ?? 'firstCut'; assert(['firstCut','spawn'].includes(activate));
const root = fileURLToPath(new URL('../../../', import.meta.url));
const sha = value => createHash('sha256').update(value).digest('hex');
const read = name => fs.readFileSync(path.join(root, name));
const scan = (directory, prefix = '') => fs.readdirSync(directory, {withFileTypes:true}).sort((a,b) => a.name.localeCompare(b.name))
  .flatMap(entry => entry.isDirectory() ? scan(path.join(directory, entry.name), prefix + entry.name + '/') : [prefix + entry.name]);
const srcNames = scan(path.join(root, 'src')).filter(name => name.endsWith('.js')).map(name => 'src/' + name);
const tools = ['tools/sim/harness_m.mjs', 'tools/sim/experiments/p4_continued_plane_candidate.mjs', 'tools/sim/experiments/p4_recut_probe.mjs'];
const dependencies = ['package.json','package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier.mjs',
  'node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm','node_modules/three/build/three.module.js','node_modules/three/build/three.core.js'];
const sourceCommit = execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const dirtyBefore = execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim();
const originalManifest = Object.fromEntries([...srcNames,...tools,...dependencies].map(name => [name,sha(read(name))]));
const directory = path.join(path.dirname(opts.out), path.basename(opts.out, '.json') + '-runtime');
assert(!fs.existsSync(directory), 'Fresh runtime artifact'); fs.mkdirSync(directory, {recursive:true});
for (const name of [...srcNames,...tools,'package.json','package-lock.json']) {
  fs.mkdirSync(path.dirname(path.join(directory,name)), {recursive:true});
  fs.copyFileSync(path.join(root,name),path.join(directory,name),fs.constants.COPYFILE_EXCL);
}
fs.symlinkSync(path.join(root,'node_modules'),path.join(directory,'node_modules'),'dir');
const fighterPath = path.join(directory,'src/fighter.js');
let fighterSource = fs.readFileSync(fighterPath,'utf8');
const injectedMarkers = [];
function replace(marker,replacement) {
  assert.equal(fighterSource.split(marker).length,2,'Unique marker: '+marker);
  fighterSource = fighterSource.replace(marker,replacement); injectedMarkers.push(marker);
}
fighterSource = `import {continueCutPlane} from '../tools/sim/experiments/p4_continued_plane_candidate.mjs';\n` + fighterSource;
replace('    const ev = edgeDir.length();', '    const p4Rest = flatTarget.clone(), p4EdgeVelocity = edgeDir.clone();\n    const ev = edgeDir.length();');
const beforeResearch = '    // Isolated research mode; ordinary games keep their existing edge alignment.';
replace(beforeResearch, `    const p4LegacyTarget = flatTarget.clone();
    if (this.edgePlaneModel === 'continuedNormal') continueCutPlane(this, flatTarget, p4Rest, p4EdgeVelocity, blade, moving);
    this.p4Read?.('plane', {blade, flat, rest:p4Rest, edgeVelocity:p4EdgeVelocity, legacyTarget:p4LegacyTarget, target:flatTarget, moving});
` + beforeResearch);
replace('    torque.add(twist);', `    this.p4Read?.('torque', {blade, flat, target:flatTarget, positionTorque:4*this.twistScale*new THREE.Vector3().crossVectors(flat,flatTarget).dot(blade), twist, wrist:torque, wTwist, cap});
    torque.add(twist);`);
replace('    sword.addTorque(vecArg(torque), true);', `    this.p4Read?.('finalTorque', {blade, torque, omega:sword.angvel()});
    sword.addTorque(vecArg(torque), true);`);
fs.writeFileSync(fighterPath,fighterSource);
const frozenNames = [...srcNames,...tools,...dependencies];
const frozenManifest = () => Object.fromEntries(frozenNames.map(name => [name,sha(fs.readFileSync(path.join(directory,name)))]));
const frozenBefore = frozenManifest();
const {newRound,DT} = await import(pathToFileURL(path.join(directory,'tools/sim/harness_m.mjs')).href);
const {applySwordsmanship,recordSwordsmanshipInput,SWORDSMANSHIP} = await import(pathToFileURL(path.join(directory,'src/swordsmanship.js')).href);
const {CHARACTERS_BY_ID} = await import(pathToFileURL(path.join(directory,'src/characters.js')).href);
assert.equal(SWORDSMANSHIP.version,'unified-20261005-r2');
const V = value => new THREE.Vector3(value.x,value.y,value.z);
const Q = value => new THREE.Quaternion(value.x,value.y,value.z,value.w);
const clamp = value => Math.max(-1,Math.min(1,value));
const signed = (a,b,axis) => Math.atan2(new THREE.Vector3().crossVectors(a,b).dot(axis),a.dot(b));
const plain = (value, seen = new WeakSet(), depth = 0) => {
  if (value == null || ['number','boolean','string'].includes(typeof value)) return value;
  if (typeof value !== 'object' || depth > 7) return undefined;
  if (value.isVector2 || value.isVector3 || value.isQuaternion || value.isEuler) return value.toArray();
  if (seen.has(value)) return {$shared:true}; seen.add(value);
  if (Array.isArray(value)) return value.map(x => plain(x,seen,depth+1));
  return Object.fromEntries(Object.entries(value).filter(([key,v]) => !['me','f','fighter','foe','world','scene','R','raw','rawSet','profile','table'].includes(key) && typeof v !== 'function')
    .map(([key,v]) => [key,plain(v,seen,depth+1)]).filter(([,v]) => v !== undefined));
};
function control(f) {return {pad:f.handOffset.toArray(),held:f.handHeld,active:f.inputActive,
  skill:plain(f.skill),assist:plain(f.swordsmanshipState),bodyPose:plain(f.bodyPose),bodyPoseVel:plain(f.bodyPoseVel),gait:plain(f.gait),
  joints:f.joints.map(j => ({name:j.name,target:j.target.toArray(),k:j.k,d:j.d,max:j.max})),
  state:f.state,health:f.armHealth,pain:f.pain,limbs:plain(f.limbs)};}
function schedule() {
  const phases = [
    ['ready',60,[0,0],true],['raise',48,[-.28,.38],true],['raisedHold',24,[0,0],true],
    ['firstCut',30,[.56,-.76],true],['followHold',36,[0,0],true],
    ['reverse',36,[-.38,.66],true],['reverseHold',24,[0,0],true],
    ['tap',60,[0,0],true],['recut',30,[.40,-.70],true],['recutHold',36,[0,0],true],['release',60,[0,0],false]
  ];
  return phases.flatMap(([phase,steps,delta,held]) => Array.from({length:steps},(_,i) =>
    ({phase,delta:delta.map(v => v/steps),held,active:Math.hypot(...delta)>1e-5,tap:phase==='tap'&&i===0})))
    .map((request,tick) => ({...request,tick}));
}
const requests = schedule(), interventionTick = activate === 'spawn' ? 0 : requests.findIndex(r => r.phase === 'firstCut');
function scalar(f) {
  const q=Q(f.sword.rotation()),axis=new THREE.Vector3(0,1,0).applyQuaternion(q),flat=new THREE.Vector3(0,0,1).applyQuaternion(q);
  const omega=V(f.sword.angvel()),v=V(f.sword.linvel()),tip=f.bladePoint(1,new THREE.Vector3()),mid=f.bladePoint(.7,new THREE.Vector3());
  const midV=V(f.sword.velocityAtPoint(mid)),tipV=V(f.sword.velocityAtPoint(tip));
  const transverse=midV.clone().addScaledVector(axis,-midV.dot(axis));
  const motion=new THREE.Vector3().crossVectors(axis,transverse).normalize();
  const localW=omega.clone().applyQuaternion(q.clone().multiply(Q(f.sword.principalInertiaLocalFrame())).invert()),I=f.sword.principalInertia();
  const kinetic=.5*f.sword.mass()*v.lengthSq()+.5*(I.x*localW.x**2+I.y*localW.y**2+I.z*localW.z**2);
  const worldPoint=(body,local)=>V(local).applyQuaternion(Q(body.rotation())).add(V(body.translation()));
  const gaps=f.joints.filter(j=>j.joint?.isValid()).map(j=>worldPoint(j.parent,j.joint.anchor1()).distanceTo(worldPoint(j.child,j.joint.anchor2())));
  for (const j of [f.gripJoint,f.offGripJoint]) if(j?.isValid()) gaps.push(worldPoint(j.body1(),j.anchor1()).distanceTo(worldPoint(j.body2(),j.anchor2())));
  const chestUp=new THREE.Vector3(0,1,0).applyQuaternion(Q(f.bodies.chest.rotation()));
  return {axis:axis.toArray(),flat:flat.toArray(),tipVelocity:tipV.toArray(),midVelocity:midV.toArray(),tipSpeed:tipV.length(),midSpeed:midV.length(),
    transverseSpeed:transverse.length(),actualEdgeErrorRad:Math.acos(clamp(Math.abs(flat.dot(motion)))),axialOmega:omega.dot(axis),kineticJ:kinetic,
    maxGapM:Math.max(...gaps),chestTiltRad:Math.acos(clamp(chestUp.y)),state:f.state,armed:f.armed,alive:f.alive,armHealth:f.armHealth,
    aimErrorRad:Math.acos(clamp(axis.dot(f.debug.aim))),pad:f.handOffset.toArray(),tap:!!f.skill.tap,thrustWeight:f.skill.thrustPose.w,
    finite:[kinetic,tipV.length(),midV.length(),...omega.toArray()].every(Number.isFinite)};
}
function swordContacts(G) {
  let count=0;
  for(const c of G.player.swordColliders) G.world.contactPairsWith(c,other => G.world.contactPair(c,other,m=>{count+=m.numSolverContacts();}));
  return count;
}
const stats = frames => {
  const sum = key => frames.reduce((v,f)=>v+f.actual[key],0), maximum=key=>Math.max(...frames.map(f=>f.actual[key]));
  const speedWeight=frames.reduce((v,f)=>v+f.actual.transverseSpeed,0);
  return {steps:frames.length,tipPeakMps:maximum('tipSpeed'),tipMeanMps:sum('tipSpeed')/frames.length,
    midPeakMps:maximum('midSpeed'),midMeanMps:sum('midSpeed')/frames.length,kineticPeakJ:maximum('kineticJ'),kineticMeanJ:sum('kineticJ')/frames.length,
    axialPeakRadps:Math.max(...frames.map(f=>Math.abs(f.actual.axialOmega))),axialTravelRad:frames.reduce((v,f)=>v+Math.abs(f.actual.axialOmega)*DT,0),
    actualEdgeErrorWeightedRad:frames.reduce((v,f)=>v+f.actual.actualEdgeErrorRad*f.actual.transverseSpeed,0)/Math.max(speedWeight,1e-12),
    aimErrorMeanRad:sum('aimErrorRad')/frames.length,maxGapM:maximum('maxGapM'),maxChestTiltRad:maximum('chestTiltRad'),
    maximumTargetSlewRad:Math.max(...frames.map(f=>Math.abs(f.plane?.targetSlewRad??0))),
    maximumSignedTargetErrorRad:Math.max(...frames.map(f=>Math.abs(f.plane?.signedErrorRad??0))),
    maxPositionTorqueDeltaNm:Math.max(...frames.map(f=>Math.abs(f.torque?.positionTorqueDelta??0))),
    explicitSwordWorkApproxJ:frames.reduce((v,f)=>v+(f.torque?.powerW??0)*DT,0),
    swordContactFrames:frames.filter(f=>f.swordContacts>0).length};
};
const rows=[],comparisons=[],started=performance.now(),startedUTC=new Date().toISOString(),random=Math.random;
let error=null,pass=false;
try {
  for(const weapon of weapons) for(const mode of ['legacy','continuedNormal']) {
    const c=CHARACTERS_BY_ID.heinrich;
    const G=newRound({seed:7,weapon,weapon2:'longsword',skill:.7,gap:14,walls:false,look2:c.look,difficulty:c.ai.level,persona:{...c.ai.persona,school:'longsword'},
      onFighter:f=>{if(f.index===0)f.onehandArmModel='manual';}}),f=G.player;
    try {
      assert(applySwordsmanship(f));
      const prefixNative=createHash('sha256'),prefixControl=createHash('sha256'),input=createHash('sha256');
      let tick=0,stages={},previousPlane=null,previousTorque=null;
      f.p4Read=(stage,values)=>{stages[stage]=plain(values);};
      const row={weapon,mode,creationNative:sha(G.world.takeSnapshot()),interventionTick,frames:[],checks:{healthy:true,finite:true,noSwordContact:true,tapAccepted:false,inputAccepted:true}};rows.push(row);
      for(const request of requests) {
        tick=request.tick; stages={};
        if(tick===interventionTick && mode==='continuedNormal')f.edgePlaneModel='continuedNormal';
        f.handOffset.x+=request.delta[0];f.handOffset.y+=request.delta[1];f.handHeld=request.held;f.inputActive=request.active;f.move.set(0,0);f.stickX=f.stickY=0;
        const event={id:tick,timeS:tick*DT,dx:request.delta[0],dy:request.delta[1],held:request.held,active:request.active};
        row.checks.inputAccepted&&=recordSwordsmanshipInput(f,event);input.update(JSON.stringify({request,event}));
        if(request.tap)row.checks.tapAccepted=f.skill.thrust();
        G.step();
        const actual=scalar(f),native=sha(G.world.takeSnapshot());
        row.checks.finite&&=actual.finite;row.checks.healthy&&=f.alive&&f.armed&&f.state==='stand'&&f.wounds.length===0&&f.armHealth===1;
        if(tick<interventionTick){prefixNative.update(native+'\n');prefixControl.update(JSON.stringify({player:control(f),enemy:control(G.enemy),ai:plain(G.ai)})+'\n');}
        const plane=stages.plane,torque=stages.torque;
        if(plane){
          const blade=new THREE.Vector3(...plane.blade),target=new THREE.Vector3(...plane.target),flat=new THREE.Vector3(...plane.flat);
          plane.signedErrorRad=signed(flat,target,blade);
          plane.targetSlewRad=previousPlane?signed(new THREE.Vector3(...previousPlane.target).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...previousPlane.blade),blade)),target,blade):0;
          plane.legacyDifferenceRad=Math.acos(clamp(target.dot(new THREE.Vector3(...plane.legacyTarget))));previousPlane=plane;
        }
        if(torque){torque.positionTorqueDelta=previousTorque===null?0:torque.positionTorque-previousTorque;previousTorque=torque.positionTorque;
          torque.final=stages.finalTorque?.torque;const omega=V(stages.finalTorque.omega);torque.powerW=torque.final?.reduce((v,x,i)=>v+x*omega.toArray()[i],0)??0;}
        const contacts=swordContacts(G);row.checks.noSwordContact&&=contacts===0;
        row.frames.push({tick,phase:request.phase,request,native,actual,plane,torque,swordContacts:contacts});
        if(!actual.finite)break;
      }
      row.prefixNative=prefixNative.digest('hex');row.prefixControl=prefixControl.digest('hex');row.inputSHA256=input.digest('hex');
      row.checks.complete=row.frames.length===requests.length;
      row.summary=Object.fromEntries([...new Set(requests.map(r=>r.phase))].map(phase=>[phase,stats(row.frames.filter(f=>f.phase===phase))]));
      row.summary.afterIntervention=stats(row.frames.filter(f=>f.tick>=interventionTick));
      console.log(JSON.stringify({weapon,mode,checks:row.checks,recut:row.summary.recut,release:row.summary.release}));
    }finally{G.eventQueue.free();G.world.free();}
  }
  for(const weapon of weapons){const [a,b]=rows.filter(r=>r.weapon===weapon);comparisons.push({weapon,creationExact:a.creationNative===b.creationNative,prefixNativeExact:a.prefixNative===b.prefixNative,
    prefixControlExact:a.prefixControl===b.prefixControl,inputExact:a.inputSHA256===b.inputSHA256,firstNativeDifference:a.frames.findIndex((f,i)=>f.native!==b.frames[i]?.native),
    firstGoalDifference:b.frames.find(f=>f.plane?.legacyDifferenceRad>1e-5)?.tick??null});}
  pass=rows.every(r=>Object.values(r.checks).every(Boolean))&&comparisons.every(c=>c.creationExact&&c.prefixNativeExact&&c.prefixControlExact&&c.inputExact);
}catch(e){error={name:e.name,message:e.message,stack:e.stack};}
finally{
  Math.random=random;const frozenAfter=frozenManifest(),sourceStable=JSON.stringify(frozenBefore)===JSON.stringify(frozenAfter);
  const originalAfter=Object.fromEntries(Object.keys(originalManifest).map(name=>[name,sha(read(name))]));
  const result={schemaVersion:1,pass:pass&&sourceStable,effectAccepted:false,error,sourceCommit,dirtyBefore,directory,originalManifest,originalAfter,
    originalSourceStable:JSON.stringify(originalManifest)===JSON.stringify(originalAfter),frozenBefore,frozenAfter,sourceStable,injectedMarkers,
    contract:'Ordinary unified-r2 + manual player, Qinggang legacy shape/thrust/finish, paired grip, original AI at14m. Equal creation and native/controller prefix before firstCut intervention. Four actual game runs. Oriented target continuation only; existing gains, twist torque law, damping, forces, damage and native body state unchanged.',
    limitations:['No contact or impact-power acceptance; health/contact checks validate this fixture only.','Directed continuation may keep a long turn; lower target slew or axial peak alone is not a success.','Physical dt input is accumulated onto current pad; no browser cadence, hitstop or rendering.','Explicit torque work is an endpoint approximation, excluding other forces, native motors and contacts.'],
    command:process.argv,activate,interventionTick,dt:DT,stepsPerRun:requests.length,physicsSteps:rows.reduce((v,r)=>v+r.frames.length,0),startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,rows,comparisons};
  fs.writeFileSync(opts.out,JSON.stringify(result)+'\n',{flag:'wx'});
  console.log(JSON.stringify({pass:result.pass,effectAccepted:false,physicsSteps:result.physicsSteps,wallSeconds:result.wallSeconds,comparisons,error}));
  if(!result.pass)process.exitCode=1;
}

// Native runtime: lateral stick movement, guard-pad transitions and release/reinput.
// No body/velocity/yaw teleport; optional delayed torque switch is causal diagnosis only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {newRound,THREE,CONFIG,DT} from '../harness_m.mjs';
import {loadEdgeTransition} from './edge_transition_candidate.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const opts=Object.fromEntries(process.argv.slice(2).map(v=>{const m=v.match(/^--([^=]+)=(.*)$/);if(!m)throw Error('Use --name=value');return [m[1],m[2]];}));
const output=opts.out;if(!output||fs.existsSync(output))throw Error('Fresh --out=path required');
const weapons=(opts.weapons??'sabre,zweihander').split(','),scenarios=(opts.scenarios??'guard,yawHold,yawGuard').split(','),levels=(opts.levels??'0,0.4').split(',').map(Number),modes=(opts.modes??'legacy,planePotential').split(',');
const startS=Number(opts.start??0),duration=9,base=opts.base??'legacy';
const runtimeModes=['legacy','planePotential'];
if(!runtimeModes.includes(base)||!Number.isFinite(startS)||startS<0||startS>=duration||levels.some(v=>![0,.4].includes(v))||scenarios.some(v=>!['guard','yawHold','yawGuard'].includes(v))||modes.some(v=>![...runtimeModes,'noPosition','reactionDamping'].includes(v)))throw Error('Unsupported conditions');
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
const originalRandom=Math.random,originalGrip=CONFIG.GRIP.reactionModel;
const helperURL=new URL('./skill_from_start_probe.mjs',import.meta.url),original=fs.readFileSync(helperURL,'utf8');
const marker='function run(weapon,motion,ending,mode,observed){';if(original.split(marker).length!==2)throw Error('Helper boundary changed');
let helper=original.split(marker)[0];
const target="const root=fileURLToPath(new URL('../../../',import.meta.url));";if(helper.split(target).length!==2)throw Error('Helper root changed');
helper=helper.replace(target,'const root='+JSON.stringify(root)+';');
helper=helper.replace("const rawPath=process.argv[2]??'/workspace/halfsword-hybrid-evidence/skill-from-start-round3.json';",'const rawPath='+JSON.stringify(output)+';');
helper=helper.replace(/^(import .*? from )(['"])([^'"]+)\2/gm,(_,p,q,v)=>p+JSON.stringify(v.startsWith('.')?new URL(v,helperURL).href:import.meta.resolve(v)));
helper+='\nexport {control,nativeBodies,gaps,kinetic,rawDirection};';
function head(){const h=fs.readFileSync(root+'.git/HEAD','utf8').trim();return h.startsWith('ref: ')?fs.readFileSync(root+'.git/'+h.slice(5),'utf8').trim():h;}
const files=[...fs.readdirSync(root+'src').filter(n=>n.endsWith('.js')).map(n=>'src/'+n),'tools/sim/harness_m.mjs','tools/sim/experiments/skill_from_start_probe.mjs','tools/sim/experiments/edge_transition_candidate.mjs','tools/sim/experiments/edge_turn_guard_probe.mjs','package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const manifest=()=>Object.fromEntries(files.sort().map(p=>[p,sha(fs.readFileSync(root+p))]));
const sourceBefore=manifest(),sourceCommit=head(),begin=performance.now(),rows=[],checks=[],observers=[];
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'edge-turn-guard-'));let instrument;
const high=[.42,.42],low=[-.4,-.42],ochs=[-.22,.26],side=[.52,.03],center=[0,.03];
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*Math.min(1,Math.max(0,t)));
function request(t,scenario){
  if(t<3)return {phase:'prepare',offset:high,write:false,held:true,active:false,move:[0,0]};
  const s=t-3,move=scenario==='guard'?[0,0]:s<1.5?[.7,0]:s<3?[-.7,0]:[0,0];
  if(scenario==='yawHold')return {phase:s<3?'turn':'settle',offset:high,write:false,held:true,active:false,move};
  if(s<.6)return {phase:'cut',offset:lerp(high,low,(s+DT)/.6),write:true,held:true,active:true,move};
  if(s<1.5)return {phase:'release',offset:low,write:false,held:false,active:false,move};
  if(s<2.1)return {phase:'reinput',offset:lerp(low,ochs,(s+DT-1.5)/.6),write:true,held:true,active:true,move};
  if(s<2.7)return {phase:'guardHold',offset:ochs,write:false,held:true,active:false,move};
  if(s<3.25)return {phase:'sideGuard',offset:lerp(ochs,side,(s+DT-2.7)/.55),write:true,held:true,active:true,move};
  if(s<4)return {phase:'release2',offset:side,write:false,held:false,active:false,move};
  if(s<4.6)return {phase:'return',offset:lerp(side,center,(s+DT-4)/.6),write:true,held:true,active:true,move};
  return {phase:'settle',offset:center,write:false,held:true,active:false,move};
}
try{
  const file=path.join(temp,'helper.mjs');fs.writeFileSync(file,helper);const {control,nativeBodies,gaps,kinetic,rawDirection}=await import(pathToFileURL(file).href);
  instrument=await loadEdgeTransition();
  function run(weapon,scenario,level,mode,observed){
    let G;const frames=[],trace=crypto.createHash('sha256'),nativeTrace=crypto.createHash('sha256'),inputTrace=crypto.createHash('sha256'),prefix=crypto.createHash('sha256');
    const summary={finite:true,peakTwistRadps:0,peakSwordOmegaRadps:0,twistTravelRad:0,maxJointGapM:0,maxPelvisHeightM:0,minPelvisHeightM:Infinity,recoverySteps:0,falls:0,clashes:0,wounds:0,contacts:0};
    let first=null,atSwitch=null,prepared=null,oldState=null,firstHeading=null,previousHeading=null,yawTravel=0,rawErrorIntegral=0,ownErrorIntegral=0,externalGoal=[...high];
    try{
      CONFIG.GRIP.reactionModel='paired';G=newRound({seed:7,walls:false,gap:6,weapon,weapon2:'longsword',skill:level});G.ai.update=()=>{};
      const f=G.player;f.armTorqueModel=G.enemy.armTorqueModel='legacy';G.combat.cutReactionModel='legacy';f.skill.autoGuard=level>0;
      f.handOffset.set(...high);for(const key of ['prev','aim','aimRaw','anchor'])f.skill[key].set(...high);f.skill.aimVel.set(0,0);f.skill.vel.set(0,0);f.skill.follow.set(0,0);
      f.handHeld=true;f.inputActive=false;if(base==='planePotential')f.edgeTorqueModel=base;
      const research=!runtimeModes.includes(mode);
      if(observed||research){Object.defineProperty(f,'driveSword',{value:instrument.module.Fighter.prototype.driveSword,configurable:true});instrument.module.setTransition(f,{mode:research?mode:'observe',base:'legacy',startS:research?startS:Infinity,now:()=>G.t});}
      first={native:sha(G.world.takeSnapshot()),controller:sha(JSON.stringify(control(G)))};
      for(let tick=0;tick<Math.round(duration/DT);tick++){
        const t=tick*DT,r=request(t,scenario);
        if(t+1e-12>=startS&&!atSwitch){atSwitch={timeS:t,native:sha(G.world.takeSnapshot()),controller:sha(JSON.stringify(control(G))),prefix:prefix.digest('hex')};if(runtimeModes.includes(mode))f.edgeTorqueModel=mode;}
        const previousRequest=tick?request((tick-1)*DT,scenario):{offset:high};
        // Main accumulates touch deltas. Do not jump to an old absolute endpoint after auto-return.
        const delta=r.write?r.offset.map((v,i)=>v-previousRequest.offset[i]):[0,0];
        if(r.write){f.handOffset.x+=delta[0];f.handOffset.y+=delta[1];externalGoal=f.handOffset.toArray();}
        f.handHeld=r.held;f.inputActive=r.active;f.move.set(...r.move);f.stickX=r.move[0];f.stickY=r.move[1];G.enemy.move.set(0,0);
        inputTrace.update(JSON.stringify({tick,...r,delta}));G.step();
        const native=sha(G.world.takeSnapshot()),ctrl=control(G);nativeTrace.update(native);trace.update(JSON.stringify({native,ctrl}));if(!atSwitch)prefix.update(JSON.stringify({native,ctrl}));
        for(const b of nativeBodies(G))for(const key of ['p','q','v','w'])if(!Object.values(b[key]).every(Number.isFinite))throw Error('Nonfinite native state');
        if(tick===Math.round(3/DT)-1)prepared={native,controller:sha(JSON.stringify(ctrl))};
        if(!observed)continue;
        const u=new THREE.Vector3(0,1,0).applyQuaternion(Q(f.sword.rotation())),omega=V(f.sword.angvel()),raw=rawDirection(...externalGoal).applyQuaternion(f.yaw),angle=(a,b)=>Math.acos(THREE.MathUtils.clamp(a.dot(b),-1,1));
        const twist=Math.abs(omega.dot(u)),gap=Math.max(...gaps(f).map(j=>j.m),...gaps(G.enemy).map(j=>j.m)),pelvis=f.bodies.pelvis.translation();
        const row={timeS:(tick+1)*DT,phase:r.phase,request:r,inputDeltaM:delta,externalGoalM:[...externalGoal],heading:f.heading,actualChestRotation:Q(f.bodies.chest.rotation()).toArray(),actualPelvisRotation:Q(f.bodies.pelvis.rotation()).toArray(),pelvisM:[pelvis.x,pelvis.y,pelvis.z],bodyPose:{...f.bodyPose},guardNearest:f.guardPose.nearest,guardWeight:f.guardWeight(),recovering:f.skill.recovering,handOffsetM:f.handOffset.toArray(),followM:f.skill.follow.toArray(),swordTwistRadps:twist,swordOmegaRadps:omega.length(),rawAimErrorRad:angle(u,raw),ownAimErrorRad:angle(u,f.debug.aim.clone().normalize()),swordKJ:kinetic(f.sword),maxJointGapM:gap,state:f.state,transition:instrument.module.readTransition(f)};
        frames.push(row);
        if(t<3)continue;
        if(firstHeading===null)firstHeading=f.heading;
        if(previousHeading!==null)yawTravel+=Math.abs(Math.atan2(Math.sin(f.heading-previousHeading),Math.cos(f.heading-previousHeading)));previousHeading=f.heading;
        summary.peakTwistRadps=Math.max(summary.peakTwistRadps,twist);summary.peakSwordOmegaRadps=Math.max(summary.peakSwordOmegaRadps,omega.length());summary.twistTravelRad+=twist*DT;summary.maxJointGapM=Math.max(summary.maxJointGapM,gap);
        summary.maxPelvisHeightM=Math.max(summary.maxPelvisHeightM,pelvis.y);summary.minPelvisHeightM=Math.min(summary.minPelvisHeightM,pelvis.y);summary.recoverySteps+=Number(f.skill.recovering);summary.contacts=Math.max(summary.contacts,G.combat.cutting.size);
        if(oldState&&f.state==='down'&&oldState!=='down')summary.falls++;oldState=f.state;rawErrorIntegral+=row.rawAimErrorRad*DT;ownErrorIntegral+=row.ownAimErrorRad*DT;
      }
      Object.assign(summary,{yawTravelRad:yawTravel,rawAimMeanErrorRad:rawErrorIntegral/6,ownAimMeanErrorRad:ownErrorIntegral/6,clashes:G.clashes,wounds:G.wounds.length});
      return {weapon,scenario,level,mode,observed,first,atSwitch,prepared,summary:observed?summary:null,nativeTraceSha256:nativeTrace.digest('hex'),controllerTraceSha256:trace.digest('hex'),inputSha256:inputTrace.digest('hex'),frames};
    }finally{G?.eventQueue.free();G?.world.free();CONFIG.GRIP.reactionModel=originalGrip;Math.random=originalRandom;}
  }
  for(const weapon of weapons)for(const scenario of scenarios)for(const level of levels){
    const group=modes.map(mode=>run(weapon,scenario,level,mode,true));rows.push(...group);const ref=group[0];
    const check={weapon,scenario,level,firstNativeExact:group.every(r=>r.first.native===ref.first.native),firstControllerExact:group.every(r=>r.first.controller===ref.first.controller),samePrefix:group.every(r=>r.atSwitch.prefix===ref.atSwitch.prefix&&r.atSwitch.native===ref.atSwitch.native&&r.atSwitch.controller===ref.atSwitch.controller),externalInputExact:group.every(r=>r.inputSha256===ref.inputSha256),finite:group.every(r=>r.summary.finite),noContacts:group.every(r=>r.summary.contacts===0&&r.summary.clashes===0&&r.summary.wounds===0)};checks.push(check);console.log(JSON.stringify({...check,values:group.map(r=>({mode:r.mode,...r.summary}))}));
  }
  for(const mode of modes){const a=rows.find(r=>r.weapon===weapons[0]&&r.scenario===scenarios.at(-1)&&r.level===levels.at(-1)&&r.mode===mode),b=run(a.weapon,a.scenario,a.level,mode,false);observers.push({mode,scope:runtimeModes.includes(mode)?'full instrumentation versus original runtime':'frame observer only; intervention instrumentation shared',initialNativeExact:a.first.native===b.first.native,preparedNativeExact:a.prepared.native===b.prepared.native,preparedControllerExact:a.prepared.controller===b.prepared.controller,nativeExact:a.nativeTraceSha256===b.nativeTraceSha256,controllerExact:a.controllerTraceSha256===b.controllerTraceSha256,inputExact:a.inputSha256===b.inputSha256});}
  const sourceAfter=manifest(),sourceStable=JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter)&&head()===sourceCommit,executionPass=sourceStable&&[...checks,...observers].every(c=>Object.values(c).every(v=>v!==false));
  const report={schemaVersion:1,sourceCommit,sourceBefore,sourceAfter,sourceStable,command:process.argv,helperSHA256:sha(helper),instrumentSHA256:instrument.generatedSHA256,createdUTC:new Date().toISOString(),wallSeconds:(performance.now()-begin)/1000,executionPass,checks,observers,rows,protocol:{base,startS,durationS:duration,prepareS:3,gapM:6,seed:7,modes,levels,scenarios,weapons,input:'Actual handOffset/handHeld/inputActive and lateral movement-stick requests; original heading/guard/recovery controllers. Enemy AI disabled but bodies dynamic, facing each other from pelvis positions. No body/velocity/yaw overrides or G.park.',guard:'Same pads high/right shoulder → low left cut → release → left ochs → hold → right side → release → center/hold. Off is raw mapping, weak is actual .64 guard-table blend. Release retains live handOffset for actual autoGuard; reinput accumulates the predetermined touch delta on the current handOffset, including auto-return displacement. Raw input benchmark retains the last external requested endpoint through release; it is not an absolute reset.',scope:'9s at120Hz. Main summary only3–9s; frames include3s preparation. From-start models may change prepared pose; start>0 instead preserves full native/controller prefix then changes torque law for causal diagnosis only. Not a live toggle UI or full browser timing contract.',metrics:'World blade-axis omega, current-yaw raw-input/own-goal error, body/yaw/guard/auto-return, actual native gaps/kinetic. Transition diagnostics are pre-solver while other frame fields are post-solver. Cached hitPointVel is delayed difference, not instantaneous contact velocity. No full solver work/passivity or human acceptance.'}};
  fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({executionPass,executions:rows.length+observers.length,observers,wallSeconds:report.wallSeconds}));if(!executionPass)process.exitCode=1;
}finally{await instrument?.cleanup();fs.rmSync(temp,{recursive:true,force:true});CONFIG.GRIP.reactionModel=originalGrip;Math.random=originalRandom;}

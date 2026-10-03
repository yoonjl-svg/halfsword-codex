/** Actual Combat contact -> main-arm wound -> release/reinput. Research only. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {newRound,THREE,CONFIG,DT,handPos} from '../harness_m.mjs';
import {clearStanceFrictionMemory} from '../../../src/stance_memory.js';
import {loadArmCapacityCandidates} from './arm_capacity_candidate.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const opts=Object.fromEntries(process.argv.slice(2).map(x=>{const m=/^--([^=]+)=(.+)$/.exec(x);if(!m)throw Error('Use --name=value');return [m[1],m[2]];}));
const output=opts.out,weapons=(opts.weapons??'sabre,zweihander').split(','),seeds=(opts.seeds??'7,19').split(',').map(Number),modes=(opts.modes??'legacy,plane,cap,planeCap').split(','),level=Number(opts.level??0),inputMode=opts.input??'delta',observer=opts.observer!=='false';
if(!output||fs.existsSync(output)||modes.some(m=>!['legacy','plane','cap','planeCap'].includes(m))||![0,.4].includes(level)||!['delta','legacyReplay'].includes(inputMode))throw Error('Invalid options or existing output');
const windowS=Number(opts.window??2),stance=opts.stance??'legacy',detail=opts.detail==='true';
if(!Number.isFinite(windowS)||windowS<2||windowS>12||!['legacy','fresh'].includes(stance)||CONFIG.GAIT.stanceMemory!=='legacy'||CONFIG.BODY.supportModel!=='legacy')throw Error('Unsupported recovery configuration');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex'),hash=()=>crypto.createHash('sha256');
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w),angle=(a,b)=>Math.acos(THREE.MathUtils.clamp(a.dot(b),-1,1));
function head(){const h=fs.readFileSync(root+'.git/HEAD','utf8').trim();if(!h.startsWith('ref: '))return h;const ref=h.slice(5),p=root+'.git/'+ref;return fs.existsSync(p)?fs.readFileSync(p,'utf8').trim():fs.readFileSync(root+'.git/packed-refs','utf8').split('\n').find(x=>x.endsWith(' '+ref)).split(' ')[0];}
function scan(d){return fs.readdirSync(root+d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(d+'/'+e.name):e.name.endsWith('.js')?[d+'/'+e.name]:[]);}
const files=[...scan('src'),'tools/sim/harness_m.mjs','tools/sim/experiments/skill_from_start_probe.mjs','tools/sim/experiments/arm_capacity_candidate.mjs','tools/sim/experiments/arm_hit_reinput_probe.mjs','package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const manifest=()=>Object.fromEntries(files.sort().map(p=>[p,sha(fs.readFileSync(root+p))]));
const sourceBefore=manifest(),sourceCommit=head(),started=performance.now(),saved={random:Math.random,grip:CONFIG.GRIP.reactionModel};
const helperURL=new URL('./skill_from_start_probe.mjs',import.meta.url),marker='function run(weapon,motion,ending,mode,observed){',helperSource=fs.readFileSync(helperURL,'utf8');
if(helperSource.split(marker).length!==2)throw Error('Helper boundary changed');
let helper=helperSource.split(marker)[0].replace("const root=fileURLToPath(new URL('../../../',import.meta.url));",'const root='+JSON.stringify(root)+';').replace("const rawPath=process.argv[2]??'/workspace/halfsword-hybrid-evidence/skill-from-start-round3.json';",'const rawPath='+JSON.stringify(output)+';');
helper=helper.replace(/^(import .*? from )(['"])([^'"]+)\2/gm,(_,p,q,v)=>p+JSON.stringify(v.startsWith('.')?new URL(v,helperURL).href:import.meta.resolve(v)))+'\nexport {ownState,control,nativeBodies,kinetic,rawDirection};';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'arm-hit-reinput-'));let modules;
const high=[.02,.52],low=[.02,-.45],left=[-.42,.03],right=[.42,.03],mix=(a,b,u)=>a.map((x,i)=>x+(b[i]-x)*u);
function script(time){const t=time%4.4;
  if(t<.6)return {offset:high,write:true,held:true,active:false,phase:'guard'};
  if(t<1.15)return {offset:mix(high,low,(t-.6)/.55),write:true,held:true,active:true,phase:'down'};
  if(t<1.55)return {offset:low,write:false,held:false,active:false,phase:'release'};
  if(t<2.1)return {offset:mix(low,high,(t-1.55)/.55),write:true,held:true,active:true,phase:'up'};
  if(t<2.45)return {offset:mix(high,left,(t-2.1)/.35),write:true,held:true,active:true,phase:'prepare_cross'};
  if(t<3)return {offset:mix(left,right,(t-2.45)/.55),write:true,held:true,active:true,phase:'cross'};
  if(t<3.6)return {offset:right,write:false,held:true,active:false,phase:'hold'};
  return {offset:mix(right,high,(t-3.6)/.8),write:true,held:true,active:true,phase:'reinput'};
}
function validGaps(f){const point=(b,p)=>V(p).applyQuaternion(Q(b.rotation())).add(V(b.translation())),a=[];
  for(const j of f.joints)if(j.joint?.isValid()&&j.parent.isValid()&&j.child.isValid())a.push({name:j.name,m:point(j.parent,j.joint.anchor1()).distanceTo(point(j.child,j.joint.anchor2()))});
  if(f.gripJoint?.isValid()){const j=f.gripJoint;a.push({name:'grip',m:point(j.body1(),j.anchor1()).distanceTo(point(j.body2(),j.anchor2()))});}return a;
}
const health=f=>({state:f.state,alive:f.alive,armed:f.armed,gripping:!!f.gripping,gripValid:!!f.gripJoint?.isValid(),armHealth:f.armHealth,limbs:{...f.limbs},muscle:f.muscle,pain:f.pain,blood:f.blood,consciousness:f.consciousness,detached:[...(f.detachedParts??[])],woundCount:f.wounds.length});
try{
  fs.writeFileSync(path.join(dir,'helper.mjs'),helper);const {ownState,control,nativeBodies,kinetic,rawDirection}=await import(pathToFileURL(path.join(dir,'helper.mjs')).href);modules=await loadArmCapacityCandidates();
  function run(weapon,seed,mode,observed){
    let G,undoDiagnostic;const frames=[],events=[],clashes=[],diagnostics=[],taps=[],nativeTrace=hash(),controlTrace=hash(),inputTrace=hash(),prefix=hash();
    let hit=null,branch=null,first=null,request=null,previousOffset=[...high],externalGoal=[...high],context=null,firstDeath=null,firstDrop=null,nextHit=null,nextContact=null,stopReason='search_limit',previousState=null,falls=0;
    const maxS=30;const entries=[];
    try{
      CONFIG.GRIP.reactionModel='paired';G=newRound({seed,walls:false,weapon,weapon2:'longsword',gap:1.85,skill:level,difficulty:'normal'});const f=G.player;
      f.skill.autoGuard=level>0;f.armTorqueModel=G.enemy.armTorqueModel='legacy';f.edgeTorqueModel='legacy';G.combat.cutReactionModel='legacy';
      f.handOffset.set(...high);for(const k of ['prev','aim','aimRaw','anchor'])f.skill[k].set(...high);f.skill.aimVel.set(0,0);f.skill.vel.set(0,0);f.skill.follow.set(0,0);f.handHeld=true;f.inputActive=false;
      if(observed){for(const method of ['driveSword','manualMuscle'])Object.defineProperty(f,method,{value:modules.clone[method],configurable:true});undoDiagnostic=modules.clone.setDiagnostics(f,s=>diagnostics.push({timeS:G.t,...s}));}
      const originalEnter=f.gait.enter;
      f.gait.enter=function(...args){
        if(!branch)return originalEnter.apply(this,args);
        const nf=()=>Object.fromEntries(Object.entries(this.legs).map(([k,l])=>[k,{Nf:l.Nf??null,N:l.N??null}]));
        const withoutNf=()=>Object.fromEntries(Object.entries(ownState(this.legs)).map(([k,l])=>[k,Object.fromEntries(Object.entries(l).filter(([n])=>n!=='Nf'))]));
        const beforeNative=sha(G.world.takeSnapshot()),beforeOther=sha(JSON.stringify(withoutNf()));
        const entry={timeS:G.t,beforeNative,beforeControl:sha(JSON.stringify(control(G))),inputPrefix:inputTrace.copy().digest('hex'),before:nf(),health:health(f)};
        if(stance==='fresh')clearStanceFrictionMemory(this);
        entry.afterClear=nf();entry.onlyNf=sha(G.world.takeSnapshot())===beforeNative&&sha(JSON.stringify(withoutNf()))===beforeOther;
        const result=originalEnter.apply(this,args);entry.afterEnter=nf();entries.push(entry);return result;
      };
      const wound=G.combat.hooks.onWound;
      G.combat.hooks.onWound=function(att,vic,r,point,pr){wound?.(att,vic,r,point,pr);const e={id:events.length,timeS:G.t,afterStepTimeS:G.t+DT,attacker:att.index,victim:vic.index,part:pr.v.part,passing:context?.passing??null,result:ownState(r),pointM:[point.x,point.y,point.z],before:context?.before??null,after:health(vic)};events.push(e);
        if(!hit&&vic.index===0&&['farmS','uarmS'].includes(pr.v.part)&&e.before.armHealth>vic.armHealth+1e-9){hit=e;}
        else if(branch&&vic.index===0&&r.severity>0&&!nextHit)nextHit=e;
        if(branch&&!nextContact)nextContact={kind:'strike',timeS:G.t,eventId:e.id};
      };
      const strike=G.combat.strike;G.combat.strike=function(pr,p,passing){const previous=context;context={passing,before:health(pr.v.fighter)};try{return strike.call(this,pr,p,passing);}finally{context=previous;}};
      const clash=G.combat.hooks.onClash;G.combat.hooks.onClash=(p,s,info)=>{clash?.(p,s,info);clashes.push({timeS:G.t,speedMps:s,info:ownState(info)});if(branch&&!nextContact)nextContact={kind:'clash',timeS:G.t};};
      first={native:sha(G.world.takeSnapshot()),control:sha(JSON.stringify(control(G)))};
      G.before=time=>{
        let delta=[0,0],tap=false;
        if(branch){const tick=Math.round((time-branch.timeS)/DT),u0=THREE.MathUtils.clamp((tick*DT-.75)/.45,0,1),u1=THREE.MathUtils.clamp(((tick+1)*DT-.75)/.45,0,1);
          delta=[.35*(u1-u0),.35*(u1-u0)];request={phase:tick<90?'injury_release':tick<144?'injury_reinput':'injury_hold',held:tick>=90,active:Math.abs(delta[0])+Math.abs(delta[1])>1e-5,deltaM:delta};
          if(f.alive){f.handOffset.x+=delta[0];f.handOffset.y+=delta[1];}f.move.set(0,0);
        }else{request=script(time);delta=request.write?request.offset.map((v,i)=>v-previousOffset[i]):[0,0];previousOffset=[...request.offset];
          if(request.write&&f.alive){if(inputMode==='legacyReplay')f.handOffset.set(...request.offset);else{f.handOffset.x+=delta[0];f.handOffset.y+=delta[1];}}
          if(inputMode==='delta')request.active=Math.abs(delta[0])+Math.abs(delta[1])>1e-5;
          request={...request,deltaM:delta};f.move.set(0,f.alive?(time<2?.25:time%4.4<.6?.08:0):0);
          tap=[2.2,6.6,11,15.4].some(t=>Math.abs(time-t)<DT/2);if(tap)taps.push({timeS:time,accepted:f.skill.thrust(),health:health(f)});
        }
        if(Math.abs(delta[0])+Math.abs(delta[1])>1e-5)externalGoal=f.handOffset.toArray();
        f.handHeld=request.held;f.inputActive=request.active;f.stickX=f.move.x;f.stickY=f.move.y;
        inputTrace.update(JSON.stringify({timeS:time,request,move:f.move.toArray(),tap}));
      };
      for(let tick=0;tick<Math.round(maxS/DT);tick++){
        if(hit&&!branch){branch={timeS:G.t,native:sha(G.world.takeSnapshot()),control:sha(JSON.stringify(control(G))),prefix:prefix.digest('hex'),eventId:hit.id,health:health(f),allEvents:structuredClone(events),inputPrefix:inputTrace.copy().digest('hex'),eligible:f.alive&&f.armed};
          f.edgeTorqueModel=['plane','planeCap'].includes(mode)?'planePotential':'legacy';f.armTorqueModel=['cap','planeCap'].includes(mode)?'sharedCap':'legacy';}
        if(branch&&G.t-branch.timeS>=windowS-1e-10){stopReason='completed_injury_window';break;}
        if(!f.alive||!G.enemy.alive){stopReason='first_death';break;}
        if(!branch&&G.t>=18-1e-10){stopReason='search_limit';break;}
        const di=diagnostics.length;G.step();
        for(const b of nativeBodies(G))for(const k of ['p','q','v','w'])if(!Object.values(b[k]).every(Number.isFinite))throw Error('Nonfinite native state');
        const n=sha(G.world.takeSnapshot()),c=JSON.stringify({native:n,control:control(G),events});nativeTrace.update(n);controlTrace.update(c);if(!branch)prefix.update(c);
        if(!f.alive||!G.enemy.alive)firstDeath={timeS:G.t,health:[health(f),health(G.enemy)]};if(!f.armed&&!firstDrop)firstDrop={timeS:G.t,health:health(f)};
        if(previousState&&f.state==='down'&&previousState!=='down')falls++;previousState=f.state;
        if(observed){const axis=new THREE.Vector3(0,1,0).applyQuaternion(Q(f.sword.rotation())),omega=V(f.sword.angvel()),ds=diagnostics.slice(di),gaps=validGaps(f),actualHand=handPos(f),raw=rawDirection(...externalGoal).applyQuaternion(f.yaw),own=f.debug.aim.clone().normalize();
          const row={timeS:G.t,relativeS:branch?G.t-branch.timeS:null,phase:request.phase,request,health:health(f),enemyHealth:health(G.enemy),actualHandM:f.handOffset.toArray(),externalGoalM:[...externalGoal],handErrorM:actualHand.distanceTo(f.handTarget),ownAimErrorRad:angle(axis,own),rawAimErrorRad:angle(axis,raw),actualAxis:axis.toArray(),ownAim:own.toArray(),swordOmegaRadps:omega.length(),swordTwistRadps:Math.abs(omega.dot(axis)),swordKJ:kinetic(f.sword),bodyAndSwordKJ:kinetic(f.sword)+Object.values(f.bodies).reduce((a,b)=>a+kinetic(b),0),pelvisM:V(f.bodies.pelvis.translation()).toArray(),gaps,bodyMotion:Object.fromEntries(['pelvis','chest','uarmS','farmS'].map(k=>[k,{q:Q(f.bodies[k].rotation()).toArray(),w:V(f.bodies[k].angvel()).toArray()}])),elbowTarget:f.jointByName.farmS.target.toArray(),gripping:!!f.gripping,cutContacts:G.combat.cutting.size,actuators:ds};
          if(detail){
            const chest=f.bodies.chest,shoulder=new THREE.Vector3(0,.1,f.side*.2).applyQuaternion(Q(chest.rotation())).add(V(chest.translation()));
            const support=[];
            for(const k of ['F','B']){const body=f.bodies['foot'+k];for(let i=0;i<body.numColliders();i++){const col=body.collider(i);G.world.contactPairsWith(col,other=>{
              const rb=other.parent();if(!rb?.isFixed())return;
              G.world.contactPair(col,other,m=>{const impulses=[];for(let j=0;j<m.numContacts();j++)impulses.push(m.contactImpulse(j));
                const points=[];for(let j=0;j<m.numSolverContacts();j++){const p=m.solverContactPoint(j),v=body.velocityAtPoint(p);points.push({pointM:[p.x,p.y,p.z],distanceM:m.solverContactDist(j),horizontalMps:Math.hypot(v.x,v.z)});}
                support.push({foot:k,normalImpulseNs:impulses.reduce((a,b)=>a+b,0),points});});
            });}}
            row.detail={stateTimeS:f.stateTime,kneelAmount:f.kneelAmount,balance:f.balance,offBalanceTime:f.offBalanceTime,tiltDeg:f.tiltDeg(),gaitActive:f.gait.active,pelvisVelocity:V(f.bodies.pelvis.linvel()).toArray(),actualHandWorldM:actualHand.toArray(),handTargetWorldM:f.handTarget.toArray(),shoulderWorldM:shoulder.toArray(),requestedArmReachM:shoulder.distanceTo(f.handTarget),actualArmReachM:shoulder.distanceTo(actualHand),ikMaximumM:.595,
              footMemory:Object.fromEntries(Object.entries(f.gait.legs).map(([k,l])=>[k,{N:l.N??null,Nf:l.Nf??null,pinF:l.pinF??null,pinLim:l.pinLim??null,stance:l.stance}])),support};
          }
          frames.push(row);}
      }
      const diagnosticInfo=observed?modules.clone.diagnosticInfo(f):null;if(diagnosticInfo?.errors.length)throw Error('Observer error');
      return {weapon,seed,level,inputMode,mode,observed,stance,windowS,detail,entries,first,hit,branch,firstDeath,firstDrop,nextHit,nextContact,stopReason,durationS:G.t,falls,final:[health(f),health(G.enemy)],finite:true,diagnosticInfo,nativeTraceSha256:nativeTrace.digest('hex'),controlTraceSha256:controlTrace.digest('hex'),inputSha256:inputTrace.digest('hex'),events,clashes,taps,frames};
    }finally{undoDiagnostic?.();G?.eventQueue.free();G?.world.free();Math.random=saved.random;CONFIG.GRIP.reactionModel=saved.grip;}
  }
  const rows=[],checks=[],observers=[];
  for(const weapon of weapons)for(const seed of seeds){const group=modes.map(m=>run(weapon,seed,m,true));rows.push(...group);const a=group[0];checks.push({weapon,seed,firstNativeExact:group.every(r=>r.first.native===a.first.native),firstControllerExact:group.every(r=>r.first.control===a.first.control),branchPresenceExact:group.every(r=>!!r.branch===!!a.branch),samePrefix:group.every(r=>JSON.stringify(r.branch)===JSON.stringify(a.branch)),inputExact:group.every(r=>r.inputSha256===a.inputSha256),sameDuration:group.every(r=>r.durationS===a.durationS)});console.log(JSON.stringify({weapon,seed,results:group.map(r=>({mode:r.mode,hit:r.hit?{t:r.hit.timeS,part:r.hit.part,severity:r.hit.result.severity,before:r.hit.before.armHealth,after:r.hit.after.armHealth}:null,branchEligible:r.branch?.eligible,stop:r.stopReason,duration:r.durationS,final:r.final[0]}))}));}
  if(observer)for(const mode of modes){const a=rows.find(r=>r.mode===mode&&r.branch?.eligible)??rows.find(r=>r.mode===mode),b=run(a.weapon,a.seed,mode,false);observers.push({weapon:a.weapon,seed:a.seed,mode,nativeExact:a.nativeTraceSha256===b.nativeTraceSha256,controlExact:a.controlTraceSha256===b.controlTraceSha256,inputExact:a.inputSha256===b.inputSha256,eventsExact:JSON.stringify(a.events)===JSON.stringify(b.events),branchExact:JSON.stringify(a.branch)===JSON.stringify(b.branch)});}
  const sourceAfter=manifest(),sourceStable=JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter)&&head()===sourceCommit;
  const executionPass=sourceStable&&checks.every(c=>c.firstNativeExact&&c.firstControllerExact&&c.branchPresenceExact&&c.samePrefix)&&observers.every(c=>Object.values(c).every(v=>v!==false));
  const report={schemaVersion:1,sourceCommit,sourceBefore,sourceAfter,sourceStable,command:process.argv,helperSHA256:sha(helper),cloneSHA256:modules.sourceHashes.clone,createdUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,executionPass,executionCount:rows.length+observers.length,checks,observers,rows,protocol:{weapons,seeds,modes,level,inputMode,windowS,stance,detail,support:{model:CONFIG.BODY.supportModel,assist:CONFIG.GAIT.assist,catch:CONFIG.GAIT.catch,catchScale:CONFIG.GAIT.catchScale},stanceContract:'Only player Gait.enter after injury clears Nf through existing runtime helper when stance=fresh. Other leg fields/native state unchanged at reset; enemy option unchanged. Before first effective entry must match legacy. No runtime default changes.',selection:'First actual Combat callback on player farmS/uarmS that decreases main-arm health. All same-step events retained. Next complete physics boundary is branch. A hook calls originals exactly once. No injected wound, body transform, AI freeze or health edits.',input:'Original18s combat trajectory until actual arm injury; legacyReplay reproduces old absolute-pad requests while delta adds consecutive scripted changes onto live pad. Post-hit release .75s, diagonal +(.35,.35)m over .45s, held stop for remainder (default .8s); movement0, no new taps. Existing thrust may still be active. Correction0 or .4 chosen from spawn; all branches share pre-hit legacy.',branch:'Existing runtime edge torque/arm final-cap options switched after identical native/controller/event/input prefix. Research causal branch only, not proposed automatic injury-triggered product switch. Enemy remains reactive. Next contacts and wounds are confound boundaries, not controlled identical hits.',lifecycle:'Stops at first fighter death or configured window after injury or18s search bound, whichever first. No post-death controllability metrics. Physics-clock120Hz; no browser hit-stop/time dilation or variable render cadence.',observations:'Observed clone driveSword/manualMuscle versus original runtime. Extra observers do not control motion. Valid native joints only; explicit actuator torque/power excludes native muscles/constraint/contact work. Candidate power includes actual sword/forearm/chest reaction split; totalK is not work.'}};
  fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output,executionPass,executionCount:report.executionCount,observers,wallSeconds:report.wallSeconds}));if(!executionPass)process.exitCode=1;
}finally{await modules?.cleanup();fs.rmSync(dir,{recursive:true,force:true});Math.random=saved.random;CONFIG.GRIP.reactionModel=saved.grip;}

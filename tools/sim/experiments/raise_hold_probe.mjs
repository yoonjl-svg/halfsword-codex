// P1/P3 observation only. One raise→hold sequence per weapon gives four
// analysis rows without repeating identical preparation or existing down cuts.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const opts=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(out|run|prepareOnly)=(.+)$/.exec(s);assert(m);return[m[1],m[2]];}));
assert(opts.out&&path.isAbsolute(opts.out)&&!fs.existsSync(opts.out));
const root=fileURLToPath(new URL('../../../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const scan=(d,p='')=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(path.join(d,e.name),p+e.name+'/'):[p+e.name]);
const sourceNames=[...scan(path.join(root,'src')).filter(n=>n.endsWith('.js')).map(n=>'src/'+n),'tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs','tools/sim/experiments/raise_hold_probe.mjs','package.json','package-lock.json'];
const dependencies=['node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm','node_modules/three/build/three.module.js','node_modules/three/build/three.core.js'];
const manifest=()=>Object.fromEntries([...sourceNames,...dependencies].map(n=>[n,sha(fs.readFileSync(path.join(root,n)))]));
if(!opts.run){
  const directory=opts.out.replace(/\.json$/,'')+'-runtime';assert(!fs.existsSync(directory));
  for(const n of sourceNames){fs.mkdirSync(path.dirname(path.join(directory,n)),{recursive:true});fs.copyFileSync(path.join(root,n),path.join(directory,n));}
  fs.symlinkSync(path.join(root,'node_modules'),path.join(directory,'node_modules'),'dir');
  const baseCommit='c37220e520bc145719967406e15364646e769798';
  const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  const gameChanges=execFileSync('git',['diff','--name-only',baseCommit,head,'--','src','tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs','package.json','package-lock.json'],{cwd:root,encoding:'utf8'}).trim();assert.equal(gameChanges,'','Game must match approved baseline');
  const proof={baseCommit,head,directory,sourceManifest:manifest(),noGameChangesFromBase:true,preparedUTC:new Date().toISOString(),command:[process.execPath,path.join(directory,'tools/sim/experiments/raise_hold_probe.mjs'),'--out='+opts.out,'--run=true']};
  fs.writeFileSync(opts.out.replace(/\.json$/,'')+'-preparation.json',JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({prepared:true,directory,command:proof.command}));
  if(!opts.prepareOnly)execFileSync(process.execPath,proof.command.slice(1),{stdio:'inherit'});
}else{
  const sourceBefore=manifest(),proof=JSON.parse(fs.readFileSync(opts.out.replace(/\.json$/,'')+'-preparation.json'));assert.deepEqual(sourceBefore,proof.sourceManifest);
  const {newRound,THREE,DT}=await import(pathToFileURL(path.join(root,'tools/sim/harness_m.mjs')).href);
  const {installForceLedger}=await import(pathToFileURL(path.join(root,'tools/sim/force_ledger.mjs')).href);
  const {applySwordsmanship,recordSwordsmanshipInput,SWORDSMANSHIP}=await import(pathToFileURL(path.join(root,'src/swordsmanship.js')).href);
  assert.equal(SWORDSMANSHIP.version,'unified-20261005-r2');
  const V=v=>({x:v.x,y:v.y,z:v.z}),z=()=>({x:0,y:0,z:0}),dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z,norm=v=>Math.hypot(v.x,v.y,v.z),add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z}),scale=(a,k)=>({x:a.x*k,y:a.y*k,z:a.z*k});
  const role=p=>['manualMuscle','elbowGravity','driveSword','offHand'].find(n=>p.endsWith('.'+n))??null;
  const phases=t=>t<60?'ready':t<150?'raise':t<210?'hold_settle':'hold_late';
  const rows=[],savedRandom=Math.random,started=performance.now(),startedUTC=new Date().toISOString();let error=null;
  function state(f){const q=new THREE.Quaternion().copy(f.sword.rotation()),axis=new THREE.Vector3(0,1,0).applyQuaternion(q),tip=f.bladePoint(1,new THREE.Vector3());
    const hand=new THREE.Vector3(.13,0,0).applyQuaternion(new THREE.Quaternion().copy(f.bodies.farmS.rotation())).add(new THREE.Vector3().copy(f.bodies.farmS.translation()));
    return{handTarget:f.handTarget.toArray(),aimTarget:f.aimDirW.toArray(),handErrorM:hand.distanceTo(f.handTarget),aimErrorRad:Math.acos(THREE.MathUtils.clamp(axis.dot(f.aimDirW),-1,1)),
      tipSpeedMps:norm(f.sword.velocityAtPoint(tip)),swordAxis:axis.toArray(),axialOmegaRadps:axis.dot(new THREE.Vector3().copy(f.sword.angvel())),pad:f.handOffset.toArray(),
      inputActive:f.inputActive,handHeld:f.handHeld,owner:f.swordsmanshipState.owner,phase:f.swordsmanshipState.phase,swinging:f.skill.swinging,state:f.state,alive:f.alive,armed:f.armed,armHealth:f.armHealth,gripping:f.gripping};}
  try{
    for(const weapon of ['longsword','zweihander']){
      const row={weapon,frames:[],checks:{inputAccepted:true,healthy:true,noSwordContact:true,fixedMass:true,finite:true,observerInstallNativeExact:false},initial:null};rows.push(row);
      let G,ledger,undoGravity;
      try{
        G=newRound({seed:7,weapon,weapon2:'longsword',gap:14,walls:false,onFighter:f=>{if(f.index===0)f.onehandArmModel='manual';}});
        const f=G.player;assert(applySwordsmanship(f));assert.equal(f.skill.level,0);assert.equal(f.skill.autoGuard,false);
        const initialNative=sha(G.world.takeSnapshot());
        const observedParts=['sword','uarmS','farmS','uarmO','farmO','chest'];
        ledger=installForceLedger(G,{fighters:[f],bodies:observedParts.map(p=>p==='sword'?f.sword:f.bodies[p]),maxSamples:0,contacts:false});
        let gravityCalls=[];
        const gravity=f.constructor.prototype.gravityTorque;
        undoGravity=ledger.replaceObservedMethod(f,'gravityTorque',function(bodies,pivot,localX,out){const result=gravity.call(this,bodies,pivot,localX,out);
          const label=b=>b===this.sword?'sword':Object.entries(this.bodies).find(([,body])=>body===b)?.[0]??'unknown';
          gravityCalls.push({bodies:bodies.filter(Boolean).map(label),pivot:label(pivot),localX,rawGravityMomentNm:V(result)});return result;});
        row.checks.observerInstallNativeExact=sha(G.world.takeSnapshot())===initialNative;assert(row.checks.observerInstallNativeExact);
        row.creationNative=initialNative;row.initial=ledger.snapshot().bodies.map(b=>({part:b.part,mass:b.mass,com:b.com,K:b.K}));
        for(let tick=0;tick<330;tick++){
          gravityCalls=[];const phase=phases(tick),dx=0,dy=phase==='raise'?.40/90:0;
          f.handOffset.x+=dx;f.handOffset.y+=dy;f.handHeld=true;f.inputActive=Math.abs(dx)+Math.abs(dy)>1e-5;f.move.set(0,0);f.stickX=f.stickY=0;
          const input={id:tick,timeS:tick*DT,dx,dy,held:true,active:f.inputActive};row.checks.inputAccepted&&=recordSwordsmanshipInput(f,input);
          G.step();assert.equal(ledger.latest.physics.length,1);
          const segment=ledger.latest.physics[0],paths={};
          for(const [name,p]of Object.entries(segment.balance.byPath)){
            const kind=role(name);if(!kind||!name.includes('fighter[0]'))continue;
            paths[kind]={midpointWorkApproxJ:p.workApproxJ,netForceN:p.netForceN,netTorqueAboutOriginNm:p.netTorqueAboutOriginNm,
              bodies:Object.fromEntries(Object.entries(p.bodies).map(([label,b])=>[label.split(':').slice(1).join(':'),{midpointWorkApproxJ:b.workApproxJ,forceN:scale(b.forceImpulse,1/DT),torqueCOMNm:scale(b.torqueCOMImpulse,1/DT),torqueAboutOriginNm:scale(b.angularImpulse,1/DT)}]))};
          }
          const calls=ledger.latest.operations.filter(e=>e.owner===0&&role(e.path)&&['addTorque','addForceAtPoint','addForce'].includes(e.method)).map(e=>({role:role(e.path),body:e.label.split(':').slice(1).join(':'),method:e.method,vector:e.input,point:e.point,powerAtCallW:e.instantPowerAtCallW}));
          const selected=segment.pre.bodies.map(a=>{const b=segment.post.bodies.find(b=>b.handle===a.handle);return{part:a.part,mass:a.mass,massAfter:b.mass,comBefore:a.com,comAfter:b.com,velocityAfter:b.velocity,KBefore:a.K,KAfter:b.K,gravityWorkJ:a.mass*a.gravityScale*dot(segment.pre.gravity,{x:b.com.x-a.com.x,y:b.com.y-a.com.y,z:b.com.z-a.com.z})};});
          let swordContacts=0;for(const c of f.swordColliders)G.world.contactPairsWith(c,o=>G.world.contactPair(c,o,m=>{swordContacts+=m.numSolverContacts();}));
          const actual=state(f);row.checks.healthy&&=f.alive&&f.armed&&f.state==='stand'&&f.wounds.length===0&&f.armHealth===1;
          row.checks.noSwordContact&&=swordContacts===0;if(phase!=='ready')row.checks.fixedMass&&=segment.balance.fixedMassBoundary;
          row.checks.finite&&=selected.every(b=>[b.KBefore,b.KAfter,...Object.values(b.comAfter)].every(Number.isFinite));
          const mismatches=segment.forceBook.map(b=>Math.max(norm(b.mismatchF),norm(b.mismatchT)));
          row.frames.push({tick,phase,input,nativeSHA256:sha(G.world.takeSnapshot()),actual,selected,paths,calls,gravityCalls,swordContacts,
            massPropertyChanges:segment.balance.massPropertyChanges,fixedMassBoundary:segment.balance.fixedMassBoundary,maxForceBookRounding:Math.max(...mismatches),directNativeMotorWorkMeasured:false});
          assert(Object.values(row.checks).every(Boolean),'Observation fixture state/contact failure at '+tick);
        }
        row.steps=row.frames.length;row.ledgerWarnings=ledger.summary().warnings;
      }finally{undoGravity?.();ledger?.restore();G?.eventQueue.free();G?.world.free();}
      console.log(JSON.stringify({weapon,steps:row.frames.length,checks:row.checks}));
    }
  }catch(e){error={name:e.name,message:e.message,stack:e.stack};}
  finally{
    Math.random=savedRandom;const sourceAfter=manifest(),sourceStable=JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter);
    const result={schemaVersion:1,measurementValid:!error&&sourceStable&&rows.length===2&&rows.every(r=>r.frames.length===330&&Object.values(r.checks).every(Boolean)),effectAccepted:false,error,
      baseCommit:proof.baseCommit,artifactHead:proof.head,sourceBefore,sourceAfter,sourceStable,command:process.argv,dt:DT,
      protocol:{seed:7,weapons:['longsword','zweihander'],opponent:'Original reactive AI at initial14m, no park or pose/velocity injection.',controller:'Ordinary unified-r2 + manual, paired grip, legacy cut, no candidate flags.',
        input:'Ready60steps held, raise90steps total dy+.40m with real input events, then held180steps with zero delta. Two actual executions; raise and final120step hold windows give four analysis rows.',
        native:'Normal npm Rapier6solver iterations/120Hz; native motor/constraint work is unmeasured. No force/gain/gravity/target policy changes.',
        bodyBoundary:'Sword, chest and both upper/forearms only. Gait foot mass changes are outside this explicit-work boundary. Initialization property changes are saved; fixed properties are required throughout measured raise/hold, after ready60.'},
      definitions:{midpointWork:'Existing force ledger dt*(F·midpointCOMvelocity+torqueCOM·midpointOmega), per path/body. Approximate explicit work, not total motor/constraint work.',
        atCallWork:'Recorded addForce/addTorque instantPowerAtCallW*dt. Keep separate from midpoint quadrature and from actual energy changes.',
        gravityWork:'m*gravityScale*g·(COM_after-COM_before), exact uniform-gravity potential difference for fixed mass.',
        reactions:'Explicit vector sums across the recorded application bodies only. Zero resultant does not imply zero internal work or full native force closure.',
        gravityMoment:'gravityTorque return before caller scaling/clamp. Diagnostic requested gravity moment; not isolated actual applied compensation after caps.'},
      limitations:['Holding consumes mechanical support torque even if mechanical work is near zero; metabolic effort/fatigue is unmeasured.','Two weapons differ in geometry, initial state and control profiles, so differences are not caused by mass alone.',
        'Shoulder manual torque and elbow gravity feedforward are explicit. Native elbow tracking, off-arm/spine motors, grips/constraints, damping and ground support work are not measured.',
        'No residual of sword energy is interpreted as body contribution or engine error. No contact damage or human-feel acceptance.','Existing force-ledger observer has prior native-equivalence tests; this run checks unchanged installation but does not duplicate a full observer-off trajectory.'],
      startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,newPhysicsExecutions:rows.length,physicsSteps:rows.reduce((n,r)=>n+r.frames.length,0),rows};
    fs.writeFileSync(opts.out,JSON.stringify(result)+'\n',{flag:'wx'});console.log(JSON.stringify({measurementValid:result.measurementValid,runs:result.newPhysicsExecutions,steps:result.physicsSteps,wallSeconds:result.wallSeconds,error}));if(!result.measurementValid)process.exitCode=1;
  }
}

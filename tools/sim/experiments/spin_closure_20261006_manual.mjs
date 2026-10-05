// Two narrow actual manual-input legacy-controller flows with the existing
// axial force point enabled from spawn. No implicit candidate or v2 controller.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {newRound,DT,THREE} from '../harness_m.mjs';
const out=process.argv[2];assert.ok(out&&!fs.existsSync(out));
const sha=x=>createHash('sha256').update(x).digest('hex'),scan=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(`${d}/${e.name}`):e.name.endsWith('.js')?[`${d}/${e.name}`]:[]);
const files=[...scan('src'),'tools/sim/harness_m.mjs','tools/sim/experiments/spin_closure_20261006_manual.mjs','package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const manifest=()=>Object.fromEntries(files.map(p=>[p,sha(fs.readFileSync(p))]));
const before=manifest(),startedUTC=new Date().toISOString(),begin=performance.now(),random=Math.random,rows=[];
const schedule=[['startup',228,[0,0],false],['prepare',48,[-.28,.38],true],['held',24,[0,0],true],['cut',30,[.56,-.76],true],['release',90,[0,0],false],['recutPrepare',48,[-.38,.66],true],['recut',30,[.40,-.70],true],['releaseAfterRecut',120,[0,0],false]].flatMap(([phase,n,delta,held])=>Array.from({length:n},()=>({phase,delta:delta.map(x=>x/n),held,active:Math.hypot(...delta)>1e-5})));
const V=x=>new THREE.Vector3(x.x,x.y,x.z),Q=x=>new THREE.Quaternion(x.x,x.y,x.z,x.w),P=(b,v)=>V(v).applyQuaternion(Q(b.rotation())).add(V(b.translation()));
try{for(const weapon of ['monohoshizao','lightsaber']){
 const G=newRound({seed:7,weapon,weapon2:'longsword',skill:.7,walls:false,gap:14}),f=G.player,s=f.sword;
 try{
  f.skill.autoGuard=true;f.gripPointModel='axial';
  const row={weapon,model:'existing-axial-force/legacy-swordsmanship',initialNativeSHA:sha(G.world.takeSnapshot()),frames:[]};rows.push(row);
  const input=createHash('sha256'),trace=createHash('sha256');
  for(let tick=0;tick<schedule.length;tick++){
   const r=schedule[tick];f.handOffset.x+=r.delta[0];f.handOffset.y+=r.delta[1];f.handHeld=r.held;f.inputActive=r.active;f.move.set(0,0);f.stickX=f.stickY=0;input.update(JSON.stringify({tick,...r}));G.step();
   const axis=new THREE.Vector3(0,1,0).applyQuaternion(Q(s.rotation())),w=V(s.angvel()),tip=f.bladePoint(1,new THREE.Vector3()),hand=P(f.bodies.farmS,{x:.13,y:0,z:0}),grip=P(s,{x:0,y:0,z:0}),off=P(f.bodies.farmO,{x:0,y:-.135,z:0}),pommel=P(s,{x:0,y:f.weaponCfg.gripAlong,z:0});
   const frame={tick,timeS:G.t,phase:r.phase,request:r,pad:f.handOffset.toArray(),skillAim:f.skill.aim.toArray(),held:f.handHeld,active:f.inputActive,swinging:f.skill.swinging,swings:f.skill.swings,recovering:f.skill.recovering,omega:w.length(),axial:w.dot(axis),swing:w.clone().addScaledVector(axis,-w.dot(axis)).length(),tipSpeed:V(s.velocityAtPoint(tip)).length(),aimErrorRad:axis.angleTo(f.aimDirW),handErrorM:hand.distanceTo(f.handTarget),mainGripGapM:hand.distanceTo(grip),offGripDistanceM:off.distanceTo(pommel),gripping:f.gripping,tiltDeg:f.tiltDeg(),state:f.state,armed:f.armed,wounds:f.wounds.length};
   assert.ok([frame.omega,frame.tipSpeed,frame.aimErrorRad,frame.handErrorM,frame.tiltDeg].every(Number.isFinite));assert.equal(f.swordsmanshipModel,undefined);row.frames.push(frame);trace.update(JSON.stringify([Object.values(f.bodies).map(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()]),s.translation(),s.rotation()]));
  }
  const stats=frames=>({steps:frames.length,maxOmega:Math.max(...frames.map(x=>x.omega)),maxAxial:Math.max(...frames.map(x=>Math.abs(x.axial))),maxSwing:Math.max(...frames.map(x=>x.swing)),maxTipSpeed:Math.max(...frames.map(x=>x.tipSpeed)),maxAimErrorRad:Math.max(...frames.map(x=>x.aimErrorRad)),maxHandErrorM:Math.max(...frames.map(x=>x.handErrorM)),maxMainGripGapM:Math.max(...frames.map(x=>x.mainGripGapM)),grippingFrames:frames.filter(x=>x.gripping).length,swingingFrames:frames.filter(x=>x.swinging).length,recoveringFrames:frames.filter(x=>x.recovering).length,maxTiltDeg:Math.max(...frames.map(x=>x.tiltDeg)),states:[...new Set(frames.map(x=>x.state))]});
  row.inputTraceSHA=input.digest('hex');row.nativeTraceSHA=trace.digest('hex');row.summary=stats(row.frames);row.phases=Object.fromEntries([...new Set(schedule.map(x=>x.phase))].map(phase=>[phase,stats(row.frames.filter(x=>x.phase===phase))]));row.wounds=G.wounds.map(w=>({timeS:w.t,att:w.att.name,vic:w.vic.name,zone:w.zone,severity:w.severity}));row.final={state:f.state,armed:f.armed,swings:f.skill.swings};
  assert.ok(row.phases.cut.swingingFrames>0&&row.phases.recut.swingingFrames>0,'Both manual cuts must activate existing strike detection');assert.equal(row.wounds.length,0);assert.ok(row.frames.every(x=>x.armed&&x.state==='stand'));
  console.log(JSON.stringify({weapon,summary:row.summary,phases:row.phases,final:row.final}));
 }finally{G.eventQueue.free();G.world.free();}
}}finally{Math.random=random;const after=manifest();fs.writeFileSync(out,JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceBefore:before,sourceAfter:after,sourceStable:JSON.stringify(before)===JSON.stringify(after),startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-begin)/1000,stepsPerRow:schedule.length,settings:{seed:7,dt:DT,skill:.7,gap:14,playerOnlyAxial:true,implicit:false,controller:'legacy',input:'real handOffset deltas/handHeld/inputActive; autoGuard on; reactive enemy kept'},scope:'Actual game free-air manual cut/release/recut from spawn. Purpose is bounded startup axial-point bugfix, not efficacy versus original midpoint, combat/contact/injury recovery, v2 inclusion or human naturalness.',rows},null,2)+'\n',{flag:'wx'});}

/** Actual Fighter control-contract diagnostic; knockDown API is not a collision. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {newRound,THREE,DT,CONFIG} from '../harness_m.mjs';
import {applySwordsmanship,recordSwordsmanshipInput} from '../../../src/swordsmanship.js';
import {mainArmMuscle} from '../../../src/arm_recovery_activation.js';
import {plain,controls,V,norm} from './round4_integrated_observer.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const m=/^--(out|label)=(.+)$/.exec(a);assert(m);return[m[1],m[2]];}));
assert(args.out&&path.isAbsolute(args.out)&&!fs.existsSync(args.out));assert(['before','fixed'].includes(args.label));
const sha=b=>createHash('sha256').update(b).digest('hex'),source=JSON.parse(fs.readFileSync(path.join(root,'SOURCE.json')));
const manifest=()=>Object.fromEntries(Object.keys(source.files).sort().map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
const sourceBefore=manifest();assert.deepEqual(sourceBefore,source.files);assert.equal(CONFIG.PHYSICS.gravity,-9.81);
const startedUTC=new Date().toISOString(),start=performance.now(),random=Math.random;
const row={label:args.label,frames:[],drive:[],requests:[],transition:null,firstDisabled:null,firstResumed:null,checks:{inputAccepted:true,finite:true,nativeTransitionUnchanged:true,firstResumeZeroAimRate:true}};
let G,tick=0,active=null,lastAimTick=null,error=null,signal=null;const stop=()=>{signal='interrupt';};process.on('SIGINT',stop);process.on('SIGTERM',stop);
class IdleOpponent {update(){}}
const context=f=>({state:f.state,stateTime:f.stateTime,armed:f.armed,alive:f.alive,muscle:f.muscle,armMuscle:mainArmMuscle(f),pain:f.pain,limbs:{...f.limbs},gripValid:!!f.gripJoint?.isValid(),prevAim:f.prevAim?.toArray()??null,hand:f.handOffset.toArray(),aim:f.skill.aim.toArray()});
try{
 G=newRound({seed:7,weapon:'qinggang',weapon2:'longsword',walls:false,gap:5.6,AIClass:IdleOpponent,onFighter:f=>{
  if(f.index!==0)return;f.onehandArmModel='manual';f.canShove=true;
  const drive=f.driveSword;f.driveSword=function(...a){
   const previous=this.prevAim?.clone();active={tick,before:context(this),lastAimTick,historyAgeSteps:lastAimTick===null?null:tick-lastAimTick,calls:[]};
   try{return drive.apply(this,a);}finally{
    const called=active.calls.length>0,raw=called&&previous?new THREE.Vector3().crossVectors(previous,this.debug.aim).divideScalar(DT):new THREE.Vector3();
    const blade=new THREE.Vector3(0,1,0).applyQuaternion(new THREE.Quaternion().copy(this.sword.rotation()));
    const actual=raw.clone().clampLength(0,25);actual.addScaledVector(blade,-actual.dot(blade));
    active.after={...context(this),called,rawAimRateRadps:raw.length(),actualAimRateVector:actual.toArray(),actualAimRateRadps:actual.length(),wristCap:this.debug.wristCap,torque:this.debug.wristTorque.toArray(),swordOmega:V(this.sword.angvel())};
    if(!called&&active.before.armMuscle<.12&&row.firstDisabled===null)row.firstDisabled=tick;
    if(called&&row.firstDisabled!==null&&row.firstResumed===null){row.firstResumed=tick;if(args.label==='fixed')row.checks.firstResumeZeroAimRate=raw.length()===0;}
    if(called)lastAimTick=tick;row.drive.push(active);active=null;
   }
  };
  const add=f.sword.addTorque;f.sword.addTorque=function(...a){if(active)active.calls.push({torque:V(a[0]),magnitude:norm(a[0])});return add.apply(this,a);};
 }});
 assert(applySwordsmanship(G.player));G.combat.cutReactionModel='legacy';G.combat.cutReactionFighter=null;
 let supplied=null;
 G.before=()=>{const f=G.player,moving=tick>=360&&tick<420,dx=moving?-.50/60:0,dy=moving?.65/60:0,held=tick<420;f.handOffset.x+=dx;f.handOffset.y+=dy;f.handHeld=held;f.inputActive=moving;f.move.set(0,0);f.stickX=f.stickY=0;supplied={id:tick,timeS:G.t,dx,dy,held,active:moving};row.checks.inputAccepted&&=recordSwordsmanshipInput(f,supplied);row.requests.push({...supplied});};
 for(tick=0;tick<720;tick++){
  if(tick%120===0)await new Promise(r=>setImmediate(r));if(signal)throw Error('Interrupted; partial retained');
  G.step();
  if(tick===300){const before=context(G.player),nativeBefore=sha(G.world.takeSnapshot());G.player.knockDown(true);const nativeAfter=sha(G.world.takeSnapshot());row.transition={tick,before,after:context(G.player),nativeBefore,nativeAfter,kind:'Controlled knockDown(true) API, no simulated collision/impulse; normal muscle decay and getup follow.'};row.checks.nativeTransitionUnchanged=nativeBefore===nativeAfter;}
  row.frames.push([tick,sha(G.world.takeSnapshot()),sha(JSON.stringify([controls(G.player),controls(G.enemy)])),sha(JSON.stringify(supplied))]);
  row.checks.finite&&=G.world.bodies.getAll().every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)));assert(row.checks.finite);
 }
 assert(row.firstDisabled!==null&&row.firstResumed!==null,'Disabled/reactivated drive must be exposed');
}catch(e){error={message:e.message,stack:e.stack};}
finally{
 if(G)row.final=context(G.player);G?.eventQueue.free();G?.world.free();Math.random=random;process.off('SIGINT',stop);process.off('SIGTERM',stop);
 const sourceAfter=manifest(),sourceStable=JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),measurementValid=!error&&sourceStable&&row.frames.length===720&&Object.values(row.checks).every(Boolean);
 fs.mkdirSync(args.out,{recursive:true});const report={head:source.head,source,sourceBefore,sourceAfter,sourceStable,measurementValid,error,command:process.argv,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-start)/1000,scope:'Actual current Fighter with controlled knockDown API, normal muscle/state updates and fixed input. Isolates derivative-history contract; not natural injury, falling/standing realism or collision efficacy.',row};
 const p=path.join(args.out,'report.json');fs.writeFileSync(p,JSON.stringify(report)+'\n');const b=fs.readFileSync(p);fs.writeFileSync(path.join(args.out,'receipt.json'),JSON.stringify({path:p,bytes:b.length,sha256:sha(b),measurementValid,error,firstDisabled:row.firstDisabled,firstResumed:row.firstResumed},null,2)+'\n');console.log(JSON.stringify({label:args.label,measurementValid,error,firstDisabled:row.firstDisabled,firstResumed:row.firstResumed,firstResume:row.firstResumed===null?null:row.drive[row.firstResumed]}));if(!measurementValid)process.exitCode=1;
}

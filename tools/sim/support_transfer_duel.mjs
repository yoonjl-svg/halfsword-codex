// Small actual AI collision regression; model is selected BEFORE newRound (cold start).
import {newRound,AI,CONFIG,DT,THREE} from './harness_m.mjs';
import {collectSupportContacts} from '../../src/support_contacts.js';
import {isMain} from './is_main.mjs';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';

const sha=x=>createHash('sha256').update(x).digest('hex'),V=x=>new THREE.Vector3(x.x,x.y,x.z),Q=x=>new THREE.Quaternion(x.x,x.y,x.z,x.w);
function finite(x){if(typeof x==='number'&&!Number.isFinite(x))throw new Error('Nonfinite native state/observation');if(x&&typeof x==='object')for(const y of Object.values(x))finite(y);}
function pose(f){return {state:f.state,stateTime:f.stateTime,blood:f.blood,limbs:{...f.limbs},armed:f.armed,heading:f.heading,handOffset:f.handOffset.toArray(),anchor:[f.anchor.translation(),f.anchor.rotation()],bodies:[...Object.values(f.bodies),f.sword].filter(b=>b.isValid()).map(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel(),b.mass()])};}
function gap(j){const a=V(j.anchor1()).applyQuaternion(Q(j.body1().rotation())).add(V(j.body1().translation())),b=V(j.anchor2()).applyQuaternion(Q(j.body2().rotation())).add(V(j.body2().translation()));return a.distanceTo(b);}
function actorWitness(f){const contacts=collectSupportContacts(f,{detail:false});return {name:f.name,state:f.state,blood:f.blood,limbs:{...f.limbs},armed:f.armed,gripping:!!f.gripping,pelvisHeightM:f.bodies.pelvis.translation().y,pelvisVelocityMps:{...f.bodies.pelvis.linvel()},chestTiltDeg:f.tiltDeg(),confirmedEnvironmentSupport:contacts.anySupport,footSupport:contacts.groups.footF.hasSupport||contacts.groups.footB.hasSupport,levH:f.gait.levH,balanceProbe:f.balanceProbe?{...f.balanceProbe}:null,actualWoundCount:f.wounds.length};}
export function runSupportDuel(model,seed=17){
  if(!['legacy','axial'].includes(model))throw new Error('Unsupported support model');
  const saved={assist:CONFIG.GAIT.assist,catchMode:CONFIG.GAIT.catchMode,catchScale:CONFIG.GAIT.catchScale,grip:CONFIG.GRIP.reactionModel,support:CONFIG.BODY.supportModel},random=Math.random;let G;
  const row={model,seed,status:'observed',coldStart:true,seconds:30,frames:0,transitions:[],samples:[],maxJointAnchorGapByActor:{P:{},E:{}},grippingFrames:{P:0,E:0},missingNativeJoints:[]},begin=performance.now();
  try{
    Object.assign(CONFIG.GAIT,{assist:.1,catchMode:'on',catchScale:1});CONFIG.GRIP.reactionModel='paired';CONFIG.BODY.supportModel=model;
    G=newRound({seed,walls:false,weapon:'longsword',weapon2:'zweihander',AIClass:AI,AI2Class:AI});const fighters=[G.player,G.enemy];for(const f of fighters)f.balanceProbe={};
    row.bothActualAI=G.ai instanceof AI&&G.ai2 instanceof AI;row.startSha256=sha(JSON.stringify(fighters.map(pose)));row.initial=fighters.map(actorWitness);
    let previous=fighters.map(f=>f.state);const trace=createHash('sha256');
    for(let i=0;i<Math.round(30/DT);i++){
      G.step();row.frames++;
      G.world.forEachRigidBody(b=>{if(b.isDynamic())finite([b.translation(),b.rotation(),b.linvel(),b.angvel(),b.worldCom(),b.mass(),b.principalInertia()]);});
      for(let a=0;a<fighters.length;a++){
        const f=fighters[a];if(f.gripping)row.grippingFrames[f.name]++;
        for(const j of f.joints){if(!j.joint)continue;const native=G.world.getImpulseJoint(j.joint.handle);if(!native){if(!row.missingNativeJoints.some(x=>x.actor===f.name&&x.name===j.name))row.missingNativeJoints.push({timeS:G.t,actor:f.name,name:j.name,detachedParts:[...(f.detachedParts??[])]});continue;}const d=gap(native);finite(d);row.maxJointAnchorGapByActor[f.name][j.name]=Math.max(row.maxJointAnchorGapByActor[f.name][j.name]??0,d);}
        if(f.armed&&f.gripJoint){const j=G.world.getImpulseJoint(f.gripJoint.handle);if(j){const d=gap(j);finite(d);row.maxJointAnchorGapByActor[f.name].swordGrip=Math.max(row.maxJointAnchorGapByActor[f.name].swordGrip??0,d);}}
        if(f.state!==previous[a])row.transitions.push({timeS:G.t,actor:f.name,from:previous[a],to:f.state,pelvisHeightM:f.bodies.pelvis.translation().y,actualWoundCount:f.wounds.length});
      }
      previous=fighters.map(f=>f.state);trace.update(JSON.stringify(fighters.map(pose)));if(i%120===0||i===Math.round(30/DT)-1)row.samples.push({timeS:G.t,actors:fighters.map(actorWitness),hits:G.hits.length,clashes:G.clashes});
    }
    row.traceSha256=trace.digest('hex');row.wounds=G.wounds.map(w=>({timeS:w.t,attacker:w.att.name,victim:w.vic.name,zone:w.zone,type:w.type,energyJ:w.energy,severity:w.severity}));row.hits=G.hits.length;row.clashes=G.clashes;row.final=fighters.map(actorWitness);finite(row.wounds);row.finite=true;
  }catch(e){row.status='error';row.error=e.stack;}
  finally{row.wallSeconds=(performance.now()-begin)/1000;G?.eventQueue.free();G?.world.free();Math.random=random;Object.assign(CONFIG.GAIT,{assist:saved.assist,catchMode:saved.catchMode,catchScale:saved.catchScale});CONFIG.GRIP.reactionModel=saved.grip;CONFIG.BODY.supportModel=saved.support;}
  return row;
}
async function main(){
  const o=Object.fromEntries(process.argv.slice(2).map(x=>{const m=/^--(models|seed|out)=(.+)$/.exec(x);if(!m)throw new Error('Use --models/--seed/--out=value');return[m[1],m[2]];})),models=(o.models??'legacy,axial').split(','),seed=Number(o.seed??17);
  if(models.some(x=>!['legacy','axial'].includes(x))||new Set(models).size!==models.length||!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new Error('Invalid models/seed');
  async function sources(dir){const out=[];for(const e of await readdir(new URL('../../'+dir,import.meta.url),{withFileTypes:true})){if(e.isDirectory())out.push(...await sources(dir+'/'+e.name));else if(e.name.endsWith('.js'))out.push(dir+'/'+e.name);}return out;}
  const manifest=async()=>Object.fromEntries(await Promise.all([...await sources('src'),'tools/sim/harness_m.mjs','tools/sim/support_transfer_duel.mjs'].sort().map(async p=>[p,sha(await readFile(new URL('../../'+p,import.meta.url)))])));
  const sourceSha256=await manifest(),begin=performance.now(),rows=models.map(m=>runSupportDuel(m,seed)),after=await manifest(),result={schemaVersion:1,probe:'support_transfer_duel',createdUTC:new Date().toISOString(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',cwd:new URL('../..',import.meta.url)}).trim(),sourceSha256,sourceSha256After:after,sourceStableDuringRun:JSON.stringify(sourceSha256)===JSON.stringify(after),wallSeconds:(performance.now()-begin)/1000,simulatedSeconds:rows.reduce((a,r)=>a+r.frames*DT,0),sameInitialStateSha:rows.every(r=>r.startSha256===rows[0].startSha256),protocol:{seed,assist:.1,catchMode:'on',catchScale:1,grip:'paired',coldStart:'supportModel set before newRound; no legacy warmup/park/reposition/injury injection',duel:'Actual normal AI on both actors, longsword vs zweihander, 30s fixed including after death. AI decisions may diverge: not an identical scripted hand-input comparison.',ledgerInstalled:false,scope:'Finite all dynamic bodies, actual wounds/clashes/state transitions and live world-transformed joint anchor gaps. Contact/support flags are witnesses, not human acceptance or clinical injury thresholds; native motor force/work is not measured.'},rows};
  if(o.out)await writeFile(o.out,JSON.stringify(result,null,2)+'\n');else process.stdout.write(JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({out:o.out??null,sourceStableDuringRun:result.sourceStableDuringRun,sameInitialStateSha:result.sameInitialStateSha,wallSeconds:result.wallSeconds,summary:rows.map(r=>({model:r.model,status:r.status,frames:r.frames,hits:r.hits,clashes:r.clashes,woundEvents:r.wounds?.length,final:r.final?.map(f=>({name:f.name,state:f.state,actualWoundCount:f.actualWoundCount})),error:r.error??null}))}));if(rows.some(r=>r.status==='error'||!r.bothActualAI||r.finite!==true||r.missingNativeJoints.length>0)||!result.sourceStableDuringRun||!result.sameInitialStateSha)process.exitCode=1;
}
if(isMain(import.meta.url))main().catch(e=>{console.error(e.stack);process.exitCode=1;});

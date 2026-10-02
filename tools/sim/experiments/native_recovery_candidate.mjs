// Research only. Preserve the existing native upright joint; alter only motor-enabled bits.
import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(x).digest('hex');
export function installZeroUprightEnabledProbe({world,f,mode,isInWindow,onFirstZero,onFirstRequest}) {
 if(!['observe','enabledOff','allOff42','zeroAfterStand'].includes(mode))throw Error('Invalid zero-motor mode');
 const joint=f.uprightJoint,raw=joint.rawSet,handle=joint.handle,position=raw.jointConfigureMotorPosition,configure=raw.jointConfigureMotor;
 for(const name of ['jointSetMotorEnabled','jointMotorEnabled','jointMotorImpulse'])if(typeof raw[name]!=='function')throw Error('Missing calibrated raw API '+name);
 const info={handle:String(handle),requests:0,batches:0,zeroBatches:0,disableCalls:0,setterBodyPreserved:true,setterStructurePreserved:true,configureReenabled:true,positiveEnabled:true,windowBitsCorrect:true,firstZero:null,firstRequest:null,lastConfigured:{},requestApis:{position:0,general:0}};
 let pending=[],first=true,firstRequest=true;
 const bodies=()=>{const rows=[];world.forEachRigidBody(b=>rows.push([String(b.handle),b.translation(),b.rotation(),b.linvel(),b.angvel(),b.mass(),b.principalInertia(),b.userForce(),b.userTorque(),b.isSleeping(),b.nextTranslation(),b.nextRotation()]));return hash(JSON.stringify(rows));};
 const structure=()=>{const handles=[];world.impulseJoints.forEach(j=>handles.push(String(j.handle)));return JSON.stringify({handles,handle:String(joint.handle),valid:joint.isValid(),a:joint.anchor1(),b:joint.anchor2(),frame1:joint.frameX1(),frame2:joint.frameX2()});};
 const originalStructure=structure();info.originalStructure=JSON.parse(originalStructure);
 function observed(h,axis,target,velocity,k,d,api,out){
  if(h!==handle)return out;
  info.requestApis[api]++;info.lastConfigured[axis]={axis,target,velocity,k,d,api};
  info.requests++;pending.push({axis,target,velocity,k,d,api,enabledAfterConfigure:raw.jointMotorEnabled(handle,axis)});
  info.configureReenabled&&=raw.jointMotorEnabled(handle,axis)===true;
  if(axis===5){
   if(pending.length!==3||pending.map(x=>x.axis).join(',')!=='3,4,5')throw Error('Unexpected upright native request batch');
   info.batches++;const requests=pending;pending=[];
   if(isInWindow()){
    if(firstRequest){firstRequest=false;info.firstRequest=onFirstRequest?.({requests,nativeBeforeSha256:hash(world.takeSnapshot())})??null;}
    const zeros=requests.filter(x=>x.k===0&&x.d===0);
    if(zeros.length){info.zeroBatches++;if(first){first=false;info.firstZero=onFirstZero?.({requests,nativeBeforeSha256:hash(world.takeSnapshot())})??null;}
    }
    if(mode!=='observe')for(const x of mode==='allOff42'?requests:zeros){const beforeBody=bodies(),beforeStructure=structure();raw.jointSetMotorEnabled(handle,x.axis,false);info.disableCalls++;info.setterBodyPreserved&&=beforeBody===bodies();info.setterStructurePreserved&&=beforeStructure===structure();}
    for(const x of requests){const enabled=raw.jointMotorEnabled(handle,x.axis),expected=!(mode==='allOff42'||(mode!=='observe'&&x.k===0&&x.d===0));info.windowBitsCorrect&&=enabled===expected;if(mode!=='allOff42'&&(x.k>0||x.d>0))info.positiveEnabled&&=enabled===true;}
   }
   info.setterStructurePreserved&&=structure()===originalStructure;
  }
  return out;
 }
 raw.jointConfigureMotorPosition=function(h,axis,target,k,d){return observed(h,axis,target,0,k,d,'position',position.call(this,h,axis,target,k,d));};
 raw.jointConfigureMotor=function(h,axis,target,velocity,k,d){return observed(h,axis,target,velocity,k,d,'general',configure.call(this,h,axis,target,velocity,k,d));};
 return {info,readout(){return [3,4,5].map(axis=>({axis,enabled:raw.jointMotorEnabled(handle,axis),lastConfigured:info.lastConfigured[axis]??null,lastSubstepSignedImpulseNms:raw.jointMotorImpulse(handle,axis),interpretation:'Last solver-substep signed readout only; disabled values may be stale. No full-step work or energy conversion.'}));},restore(){raw.jointConfigureMotorPosition=position;raw.jointConfigureMotor=configure;}};
}

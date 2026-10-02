// Q02 isolated velocity-aware recovery hypothesis; no production imports.
import {GAIT, PHYSICS} from '../../../src/config.js';
import {observeRecoverySupport, nearestSupportPoint} from './recovery_com_transfer_candidate.mjs';

const contexts=new WeakMap();
export function bindRecoveryCapture(f,context){contexts.set(f,context);return()=>contexts.delete(f);}
export function observeRecoveryCapture(f){
  const support=observeRecoverySupport(f);
  const bodies=[...new Map([...Object.values(f.bodies),f.sword,...f.meshes.map(m=>m.rb)]
    .filter(b=>b?.isValid()&&b.isDynamic()).map(b=>[b.handle,b])).values()];
  const velocity={x:0,y:0,z:0};
  for(const b of bodies){const m=b.mass(),v=b.linvel();for(const k of ['x','y','z'])velocity[k]+=m*v[k]/support.massKg;}
  // Same flat-ground height floor as Fighter.updateFooting. This is a LIP
  // look-ahead heuristic, not proof of balance for an articulated crouching body.
  const omega=Math.sqrt(-PHYSICS.gravity/Math.max(.5,support.com.y));
  const capture={x:support.com.x+velocity.x/omega,z:support.com.z+velocity.z/omega};
  const captureNearest=nearestSupportPoint(capture,support.hull);
  return {...support,velocity,omega,capture,captureNearest,
    captureOutsideM:captureNearest?Math.hypot(captureNearest.x-capture.x,captureNearest.z-capture.z):null};
}
export function recoveryCaptureShift(f,want){
  const context=contexts.get(f);if(!context)return;
  context.calls++;
  if(f.state==='getup')context.sawGetup=true;
  const carry=context.sawGetup&&f.state==='stand'?(f.gait?.levH??0):0;
  if(f.state!=='getup'&&carry<=0)return;
  const observation=observeRecoveryCapture(f),before={x:want.x,z:want.z};
  const captureMode=context.mode==='capture';
  const origin=captureMode?observation.capture:observation.com;
  const target=captureMode?observation.captureNearest:observation.nearest;
  const correction={x:0,z:0};
  if(target){
    correction.x=(target.x-origin.x)*GAIT.holdGain;
    correction.z=(target.z-origin.z)*GAIT.holdGain;
    const speed=Math.hypot(correction.x,correction.z);
    if(speed>.3){correction.x*=.3/speed;correction.z*=.3/speed;}
    if(f.state==='stand'){correction.x*=carry;correction.z*=carry;}
  }
  const eligible=Math.hypot(correction.x,correction.z)>1e-12;
  context.record?.({observation,before,correction,eligible,mode:context.mode});
  if(context.enabled&&eligible){want.x+=correction.x;want.z+=correction.z;context.applications++;}
}
export function transformRecoveryCaptureFighter(source){
  const marker='    const dvx = want.x - v.x;';
  if(source.split(marker).length!==2)throw Error('Expected one driveBalance velocity marker');
  return 'import {recoveryCaptureShift} from '+JSON.stringify(import.meta.url)+';\n'+
    source.replace(marker,'    recoveryCaptureShift(this, want);\n'+marker);
}

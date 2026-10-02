// Isolated Q02 hypothesis. Never imported by the game or a public trial.
import {collectSupportContacts} from '../../../src/support_contacts.js';
import {GAIT} from '../../../src/config.js';

const contexts = new WeakMap();
export function bindRecoveryTransfer(fighter, context) {
  contexts.set(fighter, context);
  return () => contexts.delete(fighter);
}
const cross = (a, b, c) => (b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
export function supportHull(points) {
  const p=[...new Map(points.map(p=>[`${p.x},${p.z}`,{x:p.x,z:p.z}])).values()]
    .sort((a,b)=>a.x-b.x||a.z-b.z);
  if(p.length<=2)return p;
  const half=xs=>{const out=[];for(const x of xs){while(out.length>1&&cross(out.at(-2),out.at(-1),x)<=0)out.pop();out.push(x);}return out;};
  const a=half(p),b=half([...p].reverse());return [...a.slice(0,-1),...b.slice(0,-1)];
}
export function nearestSupportPoint(p,hull) {
  if(!hull.length)return null;
  if(hull.length===1)return {...hull[0]};
  if(hull.length>=3&&hull.every((a,i)=>cross(a,hull[(i+1)%hull.length],p)>=-1e-12))return {x:p.x,z:p.z};
  let best=null,d=Infinity;
  for(let i=0;i<hull.length;i++){
    const a=hull[i],b=hull[(i+1)%hull.length],dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz;
    const t=den?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/den)):0;
    const q={x:a.x+t*dx,z:a.z+t*dz},ds=(q.x-p.x)**2+(q.z-p.z)**2;
    if(ds<d){d=ds;best=q;}
  }return best;
}
export function observeRecoverySupport(f) {
  const contacts=collectSupportContacts(f,{detail:true}),points=[],groups={};
  for(const [name,g]of Object.entries(contacts.groups)){
    const supported=g.contacts.filter(c=>c.hasSupport&&c.rawNormalImpulseNs>0);
    const ps=supported.flatMap(c=>c.solverPoints.filter(p=>p.withinSlop).map(p=>p.point));
    points.push(...ps);
    groups[name]={hasSupport:g.hasSupport,positiveSupportPoints:ps.length,
      rawUpImpulseNs:supported.reduce((s,c)=>s+c.rawNormalImpulseNs*c.normalAlignmentWithUp,0),
      points:ps.map(p=>({x:p.x,y:p.y,z:p.z}))};
  }
  const bodies=[...new Map([...Object.values(f.bodies),f.sword,...f.meshes.map(m=>m.rb)]
    .filter(b=>b?.isValid()&&b.isDynamic()).map(b=>[b.handle,b])).values()];
  let mass=0;const com={x:0,y:0,z:0};
  for(const b of bodies){const m=b.mass(),p=b.worldCom();mass+=m;for(const k of ['x','y','z'])com[k]+=m*p[k];}
  for(const k of ['x','y','z'])com[k]/=mass;
  const hull=supportHull(points),nearest=nearestSupportPoint(com,hull);
  return {massKg:mass,com,hull,nearest,groups,outsideM:nearest?Math.hypot(nearest.x-com.x,nearest.z-com.z):null};
}
export function recoverySupportShift(f,want) {
  const context=contexts.get(f);if(!context)return;
  context.calls++;
  if(f.state==='getup')context.sawGetup=true;
  const carry=context.carry&&context.sawGetup&&f.state==='stand'?(f.gait?.levH??0):0;
  if(f.state!=='getup'&&carry<=0)return;
  const observation=observeRecoverySupport(f),before={x:want.x,z:want.z};
  const correction={x:0,z:0};
  if(observation.nearest){
    correction.x=(observation.nearest.x-observation.com.x)*GAIT.holdGain;
    correction.z=(observation.nearest.z-observation.com.z)*GAIT.holdGain;
    // Existing Gait stationary hold correction ceiling, not a new total force cap.
    const speed=Math.hypot(correction.x,correction.z);
    if(speed>.3){correction.x*=.3/speed;correction.z*=.3/speed;}
    if(f.state==='stand'){correction.x*=carry;correction.z*=carry;}
  }
  const eligible=Math.hypot(correction.x,correction.z)>1e-12;
  context.record?.({observation,before,correction,eligible});
  if(context.enabled&&eligible){want.x+=correction.x;want.z+=correction.z;context.applications++;}
}

export function transformRecoveryTransferFighter(source) {
  const marker='    const dvx = want.x - v.x;';
  if(source.split(marker).length!==2)throw Error('Expected one driveBalance velocity marker');
  return 'import {recoverySupportShift} from '+JSON.stringify(import.meta.url)+';\n'+
    source.replace(marker,'    recoverySupportShift(this, want);\n'+marker);
}

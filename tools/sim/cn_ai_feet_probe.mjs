// Deterministic isolated AI stick decisions; virtual opponent distance/closing signal,
// actual Rapier body and gait. No collision or attack decisions. No game formula copied.
// node tools/sim/cn_ai_feet_probe.mjs OUT [qinggang,goujian]
import {newRound,DT,AI,CONFIG,THREE} from './harness_m.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const {GAIT,BODY}=CONFIG;
const [out='/tmp/cn-feet',weaponArg='qinggang,goujian']=process.argv.slice(2);
const cases=[...[.6,-.4].map(err=>({kind:'hold',err,T:4})),
  ...[.18,-.3].flatMap(v=>[.5,.8,1.2].map(T=>({kind:'shuffle',v,T}))),
  ...[.6,1].map(closing=>({kind:'flee',closing,T:2})),
  {kind:'withdraw',T:4},...[-.3,-1].map(stick=>({kind:'defend',stick,T:.4}))];
const rows=[];
for(const weapon of weaponArg.split(','))for(const arm of ['off','on','tune'])for(const C of cases){
 GAIT.cnLight=arm==='off'?0:1;GAIT.cnLightAi=0;GAIT.cnAiTune=arm==='tune'?1:0;
 const g=newRound({weapon,weapon2:'longsword',AI2Class:AI,gap:3,seed:7});
 try{
  const f=g.player,a=g.ai2;g.ai.update=()=>{};a.update=()=>{};
  for(const F of [f,g.enemy])for(let i=0;i<F.sword.numColliders();i++)F.sword.collider(i).setCollisionGroups(0);
  for(let i=0;i<396;i++)g.step();
  const start=f.bodies.chest.translation(),forward=f.forward(new THREE.Vector3()),hold=a.holdDist();
  const d0=C.kind==='withdraw'?a.M.reach-.3:hold+(C.err??0);
  let maxPass=0,settle=null,crossings=0,lastSign=Math.sign(d0-hold),outside=0,exposed=0,endAt=null,previousError=d0-hold;
  let displacement=0,d=d0,finite=true;
  const samples=[];
  for(let i=0;i<Math.ceil((C.T+.6)/DT);i++){
   const t=i*DT;
   a.mode=C.kind==='withdraw'?'withdraw':C.kind==='defend'?'defend':'watch';
   a.defVoid=C.stick===-1;a.foeClosing=C.closing??0;a.circleTimer=999;a.circle=0;
   a.shuffleTimer=999;a.shuffle=C.kind==='shuffle'&&t<C.T?C.v:0;
   if(t<C.T){
    if(C.kind==='shuffle')a.moveFeet(DT,hold);else a.moveFeet(DT,d);
   }else f.move.set(0,0);
   g.step();
   const p=f.bodies.chest.translation();displacement=(p.x-start.x)*forward.x+(p.z-start.z)*forward.z;
   d=d0-displacement-(C.closing??0)*Math.min(t,C.T);
   const err=d-hold;
   if(t<C.T){
    if(d>a.M.reach)outside+=DT;if(d<g.enemy.swordArt.measure.reach)exposed+=DT;
    if(Math.abs(err)>.02&&Math.sign(err)!==lastSign){crossings++;lastSign=Math.sign(err);}
    maxPass=Math.max(maxPass,C.err>0?-err:C.err<0?err:0);
    if(Math.abs(err)<.05&&Math.abs((err-previousError)/DT)<.1){if(settle===null)settle=t;}else settle=null;
    if(C.kind==='withdraw'&&endAt===null&&d>hold-.05)endAt=t;
   }
   previousError=err;finite&&=[d,p.x,p.y,p.z].every(Number.isFinite);
   if(i%6===0)samples.push({t,d,displacement,stick:f.move.y});
  }
  rows.push({weapon,arm,...C,hold,d0,displacement,finalError:d-hold,overshoot:maxPass,settle,crossings,outside,exposed,endAt,finite,state:f.state,samples});
 }finally{g.world.free();}
}
mkdirSync(out,{recursive:true});writeFileSync(out+'/rows.json',JSON.stringify(rows,null,2)+'\n');
console.log(JSON.stringify({rows:rows.length,nonfinite:rows.filter(r=>!r.finite).length,falls:rows.filter(r=>r.state!=='stand').length}));

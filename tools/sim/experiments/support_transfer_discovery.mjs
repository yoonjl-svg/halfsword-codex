// Rejected/director exploration retained for reproducibility; never imported by the game.
import {newRound,CONFIG,THREE,DT} from '../harness_m.mjs';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
class Passive{update(){}}
const mode=process.argv[2]||'vmc', portion=Number(process.argv[3]||1), out=process.argv[4];
if(!['vmc','axial','legacy','off'].includes(mode)||!(portion>=0&&portion<=1)||!out)throw new Error('Use: node tools/sim/experiments/support_transfer_discovery.mjs vmc|axial|legacy|off 0..1 /tmp/result.json');
const files=['src/fighter.js','src/config.js','src/gait.js','tools/sim/harness_m.mjs','tools/sim/experiments/support_transfer_discovery.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await readFile(new URL('../../../'+p,import.meta.url))).digest('hex')])));
const before=await hashes();
Object.assign(CONFIG.GAIT,{assist:.1,catchMode:'on',catchScale:1});CONFIG.GRIP.reactionModel='paired';CONFIG.BODY.supportModel='legacy';
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
const point=(b,p)=>V(p).applyQuaternion(Q(b.rotation())).add(V(b.translation()));
const rows=[];
for(const scene of ['stand','walk','getup']){
const rnd=Math.random,G=newRound({seed:7,walls:false,weapon:'longsword',AIClass:Passive});G.park();const f=G.player;
for(let i=0;i<3/DT;i++)G.step();
let sumDemand=0,sumApplied=0,maxTorque=0,frames=0,minY=10,states={},noFoot=0;
const old=f.driveBalance;
f.driveBalance=function(dt){
 const pel=this.bodies.pelvis,orig=pel.addForce,forces=[];
 pel.addForce=function(force,wake){const copy={...force};if(copy.y>0){forces.push(copy.y);copy.y*=1-portion;}return orig.call(this,copy,wake);};
 try{old.call(this,dt);}finally{pel.addForce=orig;}
 const demand=forces.reduce((a,b)=>a+b,0)*portion;sumDemand+=demand;
 if(!demand||mode==='off')return;
 if(mode==='legacy'){pel.addForce({x:0,y:demand,z:0},true);sumApplied+=demand;return;}
 const eligible=['F','B'].map(k=>({k,w:Math.max(0,this.gait.groundForce(this.gait.legs[k]))*(this.gait.active&&!this.gait.legs[k].stance?.05:1)})).filter(x=>x.w>0);
 const total=eligible.reduce((a,b)=>a+b.w,0); if(!total){noFoot++;return;}
 for(const {k,w} of eligible){const Fy=demand*w/total;
  const hip=this.jointByName['thigh'+k],ank=this.jointByName['foot'+k],foot=this.bodies['foot'+k];
  const hipPt=point(hip.parent,hip.joint.anchor1()),ankPt=point(ank.child,ank.joint.anchor2());
  if(mode==='axial'){
   const n=hipPt.clone().sub(ankPt).normalize();if(n.y<=0)continue;const T=Math.min(Fy/Math.max(.05,n.y),this.totalMass*9.81*2);const F=n.multiplyScalar(T);
   pel.addForceAtPoint(F,hipPt,true);foot.addForceAtPoint(F.clone().negate(),ankPt,true);sumApplied+=F.y;
  }else{
   const target=V(pel.worldCom()),F=new THREE.Vector3(0,Fy,0);
   for(const name of ['foot','shin','thigh']){const j=this.jointByName[name+k],p=point(j.parent,j.joint.anchor1());let t=target.clone().sub(p).cross(F);
    if(j.type==='hinge'){const a=new THREE.Vector3(0,0,1).applyQuaternion(Q(j.parent.rotation()));t=a.multiplyScalar(a.dot(t));}
    maxTorque=Math.max(maxTorque,t.length());j.parent.addTorque(t,true);j.child.addTorque(t.clone().negate(),true);
   }
  }
 }
};
if(scene==='getup')f.knockDown(false);
const sec=scene==='getup'?8:6;
for(let i=0;i<sec/DT;i++){if(scene==='walk')f.move.set(0,.5);G.step();frames++;minY=Math.min(minY,f.bodies.pelvis.translation().y);states[f.state]=(states[f.state]||0)+1;}
rows.push({scene,mode,portion,frames,states,minY,finalY:f.bodies.pelvis.translation().y,meanDemand:sumDemand/frames,meanAxialFy:sumApplied/frames,maxTorque,noFoot,legs:f.limbs});
G.eventQueue.free();G.world.free();Math.random=rnd;
}
const after=await hashes();
const result={basisCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:new URL('../../..',import.meta.url),encoding:'utf8'}).trim(),mode,portion,sourceBefore:before,sourceAfter:after,sourceStable:JSON.stringify(before)===JSON.stringify(after),limitations:'Exploratory force-path interception on real legacy controller, not production axial algorithm. VMC J-transpose-F has no aggregate joint torque cap and retains native PD. Ground-force allocation uses legacy flat-floor contact evidence. No human muscle or naturalness validation.',rows};
await writeFile(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(rows));if(!result.sourceStable)process.exitCode=1;

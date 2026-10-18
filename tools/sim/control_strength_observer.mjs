// Read-only physical observation shared byte-for-byte by both school studies.
import {createHash} from 'node:crypto';
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const pos=b=>{const p=b.translation();return [p.x,p.y,p.z];};
function clearance(a,b,p){const ab=b.map((v,i)=>v-a[i]),ap=p.map((v,i)=>v-a[i]);const t=Math.max(0,Math.min(1,ab.reduce((s,v,i)=>s+v*ap[i],0)/ab.reduce((s,v)=>s+v*v,0)));return distance(a.map((v,i)=>v+ab[i]*t),p);}
export function controlObserver(defenderIndex=0,{capture=false}={}){
 const prefix=createHash('sha256'),frames=[],triggers=[];let first=null,next=0;
 const trigger=(t,detail={})=>{triggers.push({t,...detail});first??=t;};
 const step=G=>{
  const fs=[G.player,G.enemy],D=fs[defenderIndex],A=fs[1-defenderIndex];
  const tip=A.bladePoint(1).toArray(),root=A.bladePoint(0).toArray(),chest=pos(D.bodies.chest),head=pos(D.bodies.head);
  const ac=pos(A.bodies.chest),dc=chest.map((v,i)=>v-ac[i]);dc[1]=0;const len=Math.hypot(...dc)||1;const forward=dc.map(v=>v/len),off=tip.map((v,i)=>v-ac[i]);
  const row={t:G.t,tip,root,defTip:D.bladePoint(1).toArray(),defRoot:D.bladePoint(0).toArray(),chest,head,
   chestClearance:clearance(root,tip,chest),headClearance:clearance(root,tip,head),
   front:off.reduce((s,v,i)=>s+v*forward[i],0)>.35&&Math.abs(off[0]*-forward[2]+off[2]*forward[0])<.45&&off[1]>-.6&&off[1]<.7,
   scale:A._studyControlScale??A.flowArmScale??1,attackerState:A.state,defenderState:D.state,
   hand:A.handOffset.toArray(),move:A.move.toArray(),velocity:A.sword.linvel(),angularVelocity:A.sword.angvel()};
  if(first==null)prefix.update(JSON.stringify(row));
  else if(G.t-first<1.25&&G.t+1e-9>=next){frames.push(row);next=G.t+1/120;
   if(capture)row.fighters=fs.map(f=>({meshes:f.meshes.map(({rb})=>({p:rb.translation(),q:rb.rotation()})),blood:f.blood,broken:!!f.weaponBroken}));
  }
 };
 return {trigger,step,finish:()=>({prefixHash:prefix.digest('hex'),triggers,frames,first})};
}

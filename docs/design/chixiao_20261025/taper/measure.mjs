import fs from 'node:fs';
import assert from 'node:assert/strict';
import{WEAPONS}from'../../../../src/weapons.js';
import{chixiaoPartMesh as before}from'./before/chixiao_details.js';
const w=WEAPONS.chixiao,part=w.buildParts({}).find(p=>p[4]);
const [shape,,,color]=part;const old=before(3,true,shape,color,{}),now=w.partMesh(3,true,shape,color,{});
function widthAt(root,t){const a=root.geometry.attributes.position.array,Y=-.4+.8*t,x=[];for(let i=0;i<a.length;i+=9){for(let k=0;k<3;k++){const p=i+k*3,q=i+((k+1)%3)*3,dy=a[q+1]-a[p+1];if(Math.abs(a[p+1]-Y)<1e-7)x.push(a[p]);if(Math.abs(dy)>1e-8&&(Y-a[p+1])*(Y-a[q+1])<=0){const u=(Y-a[p+1])/dy;x.push(a[p]+u*(a[q]-a[p]));}}}assert(x.length);return Math.max(...x)-Math.min(...x);}
const samples=[0,.25,.5,.75,.8,.9,1].map(t=>({fromBladeBaseCm:t*80,beforeWidthCm:widthAt(old,t)*100,afterWidthCm:widthAt(now,t)*100}));
const whole=Array.from({length:101},(_,i)=>({t:i/100,width:widthAt(now,i/100)}));
for(let i=1;i<whole.length;i++)assert(whole[i].width<=whole[i-1].width+1e-7);
const body=whole.filter(p=>p.t<=.8),colliderHalf=shape[1];
const result={samples,monotoneTaper:true,collisionWidthCm:colliderHalf*200,rootVisibleBeyondColliderMm:(samples[0].afterWidthCm/200-colliderHalf)*1000,maximumPerSideVisualCollisionOffsetBeforeLast20PercentMm:Math.max(...body.map(p=>Math.abs(p.width/2-colliderHalf)))*1000,bladeLengthCm:80,unchangedPhysics:true};
fs.writeFileSync(new URL('./measurements.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));

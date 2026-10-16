import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4193',out=process.argv[3]||'/tmp/yue-geometry.json';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try {const p=await b.newPage();await p.goto(base+'/night-encounters-6.html');
const report=await p.evaluate(async()=>{
const T=await import('/node_modules/three/build/three.module.js');const {addYueApparitions}=await import('/src/stage_yue_apparitions.js');const r=new T.Group(),update=addYueApparitions(r),g=r.children[0],s=g.getObjectByName('yue-ghost-sword'),enemySword=g.getObjectByName('wu-ghost-sword');
// Closest distance between sampled blade segments: enough precision to expose a staged miss.
let min=100,best=null,radius=100,finite=true;const m=new T.Matrix4(),n=new T.Matrix4();
for(let t=0;t<3.5;t+=1/60){update(t);s.getMatrixAt(0,m);enemySword.getMatrixAt(0,n);for(let a=0;a<=20;a++)for(let b=0;b<=20;b++){
const x=new T.Vector3(0,.03+.67*a/20,0).applyMatrix4(m),y=new T.Vector3(0,.03+.67*b/20,0).applyMatrix4(n),d=x.distanceTo(y);if(d<min){min=d;best={t,a,b,x:x.toArray(),y:y.toArray()}}
}}
for(let t=0;t<=85;t+=.25){update(t);for(const mesh of g.children){mesh.geometry.computeBoundingBox();for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);finite&&=m.elements.every(Number.isFinite);const box=mesh.geometry.boundingBox.clone().applyMatrix4(m);const d=Math.hypot(Math.max(box.min.x,Math.min(0,box.max.x)),Math.max(box.min.z,Math.min(0,box.max.z)));radius=Math.min(radius,d)}}}
const snapshot=t=>{update(t);return ['yue','wu'].flatMap(f=>[...g.getObjectByName(f+'-ghost-chest').instanceMatrix.array])};
const t0=snapshot(0),t1=snapshot(1);let actorsMoved=0;
for(let i=0;i<g.userData.count;i++)if(t0.slice(i*16,i*16+16).some((x,j)=>Math.abs(x-t1[i*16+j])>1e-5))actorsMoved++;
const shapesDiffer=['head','chest','uarmS'].every(id=>JSON.stringify([...g.getObjectByName('yue-ghost-'+id).geometry.attributes.position.array])!==JSON.stringify([...g.getObjectByName('wu-ghost-'+id).geometry.attributes.position.array]));
const quadrants=new Set(g.userData.actors.filter(a=>a.kind==='duel').map(a=>`${Math.sign(a.position[0])}/${Math.sign(a.position[2])}`));
return {quadrants:quadrants.size,shapesDiffer,minBladeDistance:min,best,radius,finite,actorsMoved,details:g.userData};
});
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
assert.equal(report.quadrants,4);assert.ok(report.shapesDiffer);assert.ok(report.finite);assert.ok(report.radius>10.5);assert.ok(report.minBladeDistance<.06);assert.equal(report.actorsMoved,20);
report.pass=true;fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:true,minBladeDistance:report.minBladeDistance,radius:report.radius,actorsMoved:report.actorsMoved}));
}finally{await b.close()}

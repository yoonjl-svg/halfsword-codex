// 수도 근교 여울 — shared terrain, wetness, props and navigation for the isolated stage trial.
import * as THREE from 'three';
import { setSupportFloor } from '../gait.js';
export const FORD = Object.freeze({ id:'capital_ford', name:'수도 근교 여울', speed:.6, waterY:-.075, deckY:.10, bridgeZ:-.6, bridgeHalf:1.5, bridgeEnd:3.5 });
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export const riverX=z=>.17*z+.47*Math.sin(z*.25)+.18*Math.sin(z*.65);
export const riverWidth=z=>1.65+.14*Math.sin(z*.43+.7);
export const onBridge=(x,z)=>Math.abs(z-FORD.bridgeZ)<=FORD.bridgeHalf && Math.abs(x)<=FORD.bridgeEnd;
const ramp=x=>FORD.deckY*Math.max(0,Math.min(1,(3.5-Math.abs(x))/.7));
const raw=(x,z)=>{
 const w=1-smooth(.85,riverWidth(z)+.85,Math.abs(x-riverX(z)));
 const bank=.023*Math.sin(x*.55)*Math.cos(z*.44);
 const outer=smooth(12,25,Math.hypot(x,z));
 return -.30*w+bank*(1-w)+outer*(.45+.35*Math.sin(z*.15+x*.1))*(1-w);
};
const N=81,MIN=-40,STEP=1;
const heights=Float32Array.from({length:N*N},(_,i)=>raw(MIN+(i%N)*STEP,MIN+Math.floor(i/N)*STEP));
export function bedFacet(x,z){
 const i=Math.max(0,Math.min(N-2,Math.floor((x-MIN)/STEP))),j=Math.max(0,Math.min(N-2,Math.floor((z-MIN)/STEP)));
 const u=(x-(MIN+i*STEP))/STEP,v=(z-(MIN+j*STEP))/STEP,a=j*N+i;
 const ha=heights[a],hb=heights[a+1],hc=heights[a+N],hd=heights[a+N+1];
 return u+v<=1?{y:ha+u*(hb-ha)+v*(hc-ha),dx:(hb-ha)/STEP,dz:(hc-ha)/STEP}:{y:hd+(1-u)*(hc-hd)+(1-v)*(hb-hd),dx:(hd-hc)/STEP,dz:(hd-hb)/STEP};
}
export function heightAt(x,z){return onBridge(x,z)?ramp(x):bedFacet(x,z).y;}
export function normalAt(x,z){
 let dx,dz;
 if(onBridge(x,z)){dx=(ramp(x+.001)-ramp(x-.001))/.002;dz=0;}else({dx,dz}=bedFacet(x,z));
 const n=Math.hypot(dx,1,dz);return {x:-dx/n,y:1/n,z:-dz/n};
}
export function moveScaleAt(x,z){
 if(onBridge(x,z))return 1;
 const wet=1-smooth(.75,riverWidth(z)+.25,Math.abs(x-riverX(z)));
 return 1-(1-FORD.speed)*wet;
}
export const TERRAIN=Object.freeze({id:FORD.id,heightAt,normalAt,moveScaleAt});
// Irregular but gentle enclosing bank; reference area scaled to 408 m² before prop footprints.
const outlineRaw=Array.from({length:32},(_,i)=>{const a=i/32*Math.PI*2,r=1+.045*Math.sin(3*a+.5)+.025*Math.cos(5*a);return [12.2*r*Math.cos(a),10.5*r*Math.sin(a)];});
export const polygonArea=pts=>Math.abs(pts.reduce((s,p,i)=>{const q=pts[(i+1)%pts.length];return s+p[0]*q[1]-q[0]*p[1];},0))/2;
const scale=Math.sqrt(408/polygonArea(outlineRaw));
export const BOUNDARY=outlineRaw.map(([x,z])=>[x*scale,z*scale]);
export const ROCKS=[{x:-3.3,z:4.6,s:[1.35,1.7,1.05],rot:.4},{x:4.65,z:-4.3,s:[1.45,.8,1.05],rot:-.7},{x:5.6,z:-4.9,s:[.65,.46,.6],rot:1.2}];
export const BARRELS=[{x:-5.4,z:-3.1,r:.43,h:1.02},{x:-6.2,z:-3.42,r:.39,h:.9},{x:-5.7,z:-4.1,r:.34,h:.78}];
export const FENCES=[{x:-8.1,z:-3.4,len:3.7,rot:.24},{x:-8.7,z:1.2,len:2.4,rot:-.12},{x:7.6,z:4.2,len:3.1,rot:-.5}];
// Posts and rails have matching visible gaps; bullets are not stopped by an invisible solid fence panel.
export function fenceShapes(){const a=[];for(const f of FENCES){const count=Math.ceil(f.len/.9);for(let i=0;i<=count;i++){const t=-f.len/2+f.len*i/count;const x=f.x+Math.sin(f.rot)*t,z=f.z+Math.cos(f.rot)*t;a.push({x,z,y:heightAt(x,z)+.62,hx:.075,hy:.62,hz:.085,rot:f.rot});}for(const y of [.48,.94])a.push({x:f.x,z:f.z,y:heightAt(f.x,f.z)+y,hx:.055,hy:.065,hz:f.len/2,rot:f.rot});}return a;}
export function groundMesh(extent=40,withBridge=false){
 const v=[],idx=[];const axis=extent>17?[-40,-34,-28,-23,-20,-18,...Array.from({length:35},(_,i)=>i-17),18,20,23,28,34,40]:Array.from({length:extent*2+1},(_,i)=>i-extent);const m=axis.length;
 for(const z of axis)for(const x of axis)v.push(x,bedFacet(x,z).y,z);
 for(let j=0;j<m-1;j++)for(let i=0;i<m-1;i++){const a=j*m+i,c=a+m;idx.push(a,c,a+1,a+1,c,c+1);}
 if(withBridge){const xs=[-3.5,-3.15,-2.8,2.8,3.15,3.5],zs=[FORD.bridgeZ-FORD.bridgeHalf,FORD.bridgeZ+FORD.bridgeHalf];const base=v.length/3;for(const z of zs)for(const x of xs)v.push(x,ramp(x),z);for(let i=0;i<xs.length-1;i++){let a=base+i,c=a+xs.length;idx.push(a,c,a+1,a+1,c,c+1);}}
 return {vertices:new Float32Array(v),indices:new Uint32Array(idx)};
}
export function rockGeometry(r){const g=new THREE.DodecahedronGeometry(1,0);g.scale(...r.s);g.rotateY(r.rot);g.translate(r.x,heightAt(r.x,r.z)+r.s[1]*.32,r.z);return g;}
export function createFordGround(R,world,groups){
 const body=world.createRigidBody(R.RigidBodyDesc.fixed());const mesh=groundMesh(17,true);
 const floor=world.createCollider(R.ColliderDesc.trimesh(mesh.vertices,mesh.indices).setFriction(.9).setCollisionGroups(groups),body);setSupportFloor(world,floor);
 const obstacles=[];
 const add=d=>{const c=world.createCollider(d.setCollisionGroups(groups).setFriction(.8).setRestitution(.02),body);obstacles.push(c);return c;};
 for(let i=0;i<BOUNDARY.length;i++){const a=BOUNDARY[i],b=BOUNDARY[(i+1)%BOUNDARY.length],x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,ang=Math.atan2(b[0]-a[0],b[1]-a[1]);add(R.ColliderDesc.cuboid(.13,.7,Math.hypot(b[0]-a[0],b[1]-a[1])/2+.03).setTranslation(x,heightAt(x,z)+.6,z).setRotation({x:0,y:Math.sin(ang/2),z:0,w:Math.cos(ang/2)}));}
 for(const r of ROCKS){const g=rockGeometry(r);add(R.ColliderDesc.convexHull(g.attributes.position.array));g.dispose();}
 for(const b of BARRELS)add(R.ColliderDesc.cylinder(b.h/2,b.r).setTranslation(b.x,heightAt(b.x,b.z)+b.h/2,b.z));
 for(const s of fenceShapes())add(R.ColliderDesc.cuboid(s.hx,s.hy,s.hz).setTranslation(s.x,s.y,s.z).setRotation({x:0,y:Math.sin(s.rot/2),z:0,w:Math.cos(s.rot/2)}));
 return {body,floor,obstacles,terrain:TERRAIN};
}
// A small fixed visibility graph. Cost samples the same surface as feet. Replan at 4Hz, not per physics tick.
const navBlocked=(x,z)=>ROCKS.some(r=>Math.hypot((x-r.x)/(r.s[0]+.55),(z-r.z)/(r.s[2]+.55))<1)||BARRELS.some(b=>Math.hypot(x-b.x,z-b.z)<b.r+.5)||FENCES.some(f=>{const dx=x-f.x,dz=z-f.z;return Math.abs(dx*Math.cos(f.rot)-dz*Math.sin(f.rot))<.5&&Math.abs(dx*Math.sin(f.rot)+dz*Math.cos(f.rot))<f.len/2+.5;});
function edge(a,b){let cost=0;const l=Math.hypot(b.x-a.x,b.z-a.z),n=Math.ceil(l/.35);for(let i=0;i<=n;i++){let t=i/Math.max(1,n),x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;if(navBlocked(x,z))return Infinity;cost+=1/moveScaleAt(x,z);}return l*cost/(n+1);}
const NODES=[[-4.2,-.6],[4.2,-.6],[-2.9,2.5],[2.9,2.5],[-2.5,-4],[2.5,-4],[-5.5,5.3],[-.8,5.5],[4.8,1.2],[6.8,-2.2],[-7.2,-1],[-4.4,-5.4],[0,8],[0,-7]].map(([x,z])=>({x,z}));
const FIXED_EDGES=NODES.map(a=>NODES.map(b=>edge(a,b)));
export function routePoint(start,target){const ps=[start,target,...NODES],dist=ps.map(()=>Infinity),prev=[],seen=new Set();dist[0]=0;for(let k=0;k<ps.length;k++){let u=-1;for(let i=0;i<ps.length;i++)if(!seen.has(i)&&(u<0||dist[i]<dist[u]))u=i;if(u===1||!Number.isFinite(dist[u]))break;seen.add(u);for(let v=0;v<ps.length;v++){if(v===u)continue;let nd=dist[u]+(u>=2&&v>=2?FIXED_EDGES[u-2][v-2]:edge(ps[u],ps[v]));if(nd<dist[v]){dist[v]=nd;prev[v]=u;}}}if(!Number.isFinite(dist[1]))return target;let v=1;while(prev[v]>0)v=prev[v];return ps[v];}
export function steerFord(ai,dt){const f=ai.me;if(!f.alive||!ai.foe?.alive||f.state!=='stand')return;const p=f.bodies.pelvis.translation(),q=ai.foe.bodies.pelvis.translation(),speed=Math.hypot(f.move.x,f.move.y);if(speed<.1||Math.hypot(q.x-p.x,q.z-p.z)<2.6)return;
 const c=Math.cos(f.heading),s=Math.sin(f.heading),vx=f.move.x*s+f.move.y*c,vz=f.move.x*c-f.move.y*s;if(vx*(q.x-p.x)+vz*(q.z-p.z)<=0)return;
 ai.fordTick=(ai.fordTick||0)-dt;if(ai.fordTick<=0){ai.fordRoute=routePoint(p,q);ai.fordTick=.25;}let t=ai.fordRoute,dx=t.x-p.x,dz=t.z-p.z,l=Math.hypot(dx,dz);if(l<.3){ai.fordTick=0;return;}f.move.set((dx*s+dz*c)/l*speed,(dx*c-dz*s)/l*speed);f.stickX=f.move.x;f.stickY=f.move.y;}

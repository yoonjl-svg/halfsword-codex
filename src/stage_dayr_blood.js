// Static aftermath, projected onto the actual paving and brick faces.
import * as T from 'three';
import {DecalGeometry} from 'three/addons/geometries/DecalGeometry.js';
import {canvasTex,rng} from './stage_kit.js';

function poolMap(seed){
 const r=rng(seed);
 return canvasTex(256,256,c=>{
  const outline=[];
  for(let i=0;i<64;i++){const a=i*Math.PI/32,q=1+.13*Math.sin(a*5)+.10*Math.sin(a*9+1)+r()*.08;outline.push([126+Math.cos(a)*81*q,129+Math.sin(a)*59*q]);}
  c.fillStyle='#701b1c';c.beginPath();outline.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();
  // Dark central pooling and irregular small beads at the edge, not a red disc.
  const g=c.createRadialGradient(119,133,8,126,129,86);g.addColorStop(0,'#300d10');g.addColorStop(.6,'#4e1115');g.addColorStop(1,'#701b1c');c.fillStyle=g;c.fill();
  for(let i=0;i<34;i++){const a=r()*Math.PI*2,d=.85+r()*.35;c.fillStyle=i%3?'#681719':'#7c2121';c.beginPath();c.ellipse(126+Math.cos(a)*90*d,129+Math.sin(a)*65*d,1+r()*5,1+r()*3,r()*Math.PI,0,Math.PI*2);c.fill();}
 });
}
// A thin run from the existing pool; its original outline and size stay intact.
function runMap(){
 return canvasTex(512,256,c=>{
  const r=rng(172240),upper=[],lower=[];
  for(let i=0;i<=64;i++){
   const t=i/64,x=22+t*479,y=195-120*t+15*Math.sin(t*6)-5*Math.sin(t*16);
   const half=Math.max(2,2+19*t*t+2*Math.sin(t*34)+r()*3);
   upper.push([x,y-half]);lower.push([x,y+half*(.72+r()*.40)]);
  }
  c.beginPath();[...upper,...lower.reverse()].forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
  const g=c.createLinearGradient(20,190,500,75);
  g.addColorStop(0,'#701b1c');g.addColorStop(.6,'#4e1115');g.addColorStop(1,'#300d10');
  c.fillStyle=g;c.fill();
  // Small breaks in the last beads keep the tapered end from looking drawn.
  for(const [x,y,rx,ry] of [[14,201,4,1.6],[49,195,6,2],[121,180,4,1.8],[228,150,7,2.2]]){
   c.fillStyle='#681719';c.beginPath();c.ellipse(x,y,rx,ry,-.24,0,Math.PI*2);c.fill();
  }
 });
}
function sprayMap(seed,wall=false){
 const r=rng(seed);
 return canvasTex(256,256,c=>{
  for(let i=0;i<94;i++){
   const t=r(),x=35+t*184,y=145-(t*.50+r()*.48)*112+(r()-.5)*(25+55*t);
   const radius=.6+r()*(wall?3.1:2.6)*(1-t*.45);
   c.fillStyle=i%4?'#792021':'#501116';c.beginPath();c.ellipse(x,y,radius*(1+1.4*t),radius,-.42,0,Math.PI*2);c.fill();
   if(wall&&i%15===0){c.strokeStyle='#68191b';c.lineWidth=Math.max(.8,radius*.65);c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+1,y+9,x-1,y+18,x+1,y+23+r()*20);c.stroke();}
  }
 });
}
export function addDayrBlood(scene,root){
 const group=new T.Group();group.name='dayr-blood-aftermath';group.userData={visualOnly:true,pools:2,poolRuns:1,floorSprays:2,wallSprays:2};root.add(group);
 const floor=scene.getObjectByName('dayr-floor'),wall=scene.getObjectByName('dayr-brick');scene.updateMatrixWorld(true);
 const groundSpray=sprayMap(172230),wallSpray=sprayMap(172231,true);
 function decal(surface,name,p,rot,size,map,roughness){
  const geo=new DecalGeometry(surface,new T.Vector3(...p),new T.Euler(...rot),new T.Vector3(...size));
  const mat=new T.MeshStandardMaterial({map,transparent:true,depthWrite:false,roughness,metalness:0,polygonOffset:true,polygonOffsetFactor:-3});
  const m=new T.Mesh(geo,mat);m.name=name;m.renderOrder=2;group.add(m);
 }
 decal(floor,'dayr-blood-pool-run',[6.65,.01,-14.65],[-Math.PI/2,0,0],[3.2,1.1,.10],runMap(),.52);
 for(const [i,x,z,yaw] of [[0,8.0,-14.95,.68],[1,11.6,-8.75,-1.4]]){
  const local=new T.Vector3(.12,0,-.23).applyAxisAngle(new T.Vector3(0,1,0),yaw);
  decal(floor,`dayr-blood-pool-${i}`,[x+local.x,.01,z+local.z],[-Math.PI/2,0,yaw],[1.65,1.42,.10],poolMap(172210+i),.52);
  decal(floor,`dayr-floor-blood-spray-${i}`,[x+.48,.01,z-.53],[-Math.PI/2,0,yaw-.35],[2.25,1.6,.10],groundSpray,.70);
 }
 // Solid piers beside the meeting bay. Geometry projection clips stains to
 // the real bricks, so they cannot hang across the arch openings or float.
 decal(wall,'dayr-wall-blood-spray-0',[6.27,1.04,-17.97],[0,0,-.12],[.82,1.16,.18],wallSpray,.85);
 decal(wall,'dayr-wall-blood-spray-1',[10.35,.78,-17.97],[0,0,.24],[.72,.92,.18],wallSpray,.85);
 return group;
}

// Static aftermath, projected onto the actual paving and brick faces.
import * as T from 'three';
import {DecalGeometry} from 'three/addons/geometries/DecalGeometry.js';
import {canvasTex,rng} from './stage_kit.js';
import {DAYR_FAR_SIDE} from './stage_dayr_far_side.js';

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
  for(let i=0;i<(wall?136:94);i++){
   const t=r(),x=35+t*184,y=145-(t*.50+r()*.48)*112+(r()-.5)*(25+55*t);
   const radius=.6+r()*(wall?4.7:2.6)*(1-t*.45);
   c.fillStyle=wall?(i%4?'#98262b':'#61151b'):(i%4?'#792021':'#501116');c.beginPath();c.ellipse(x,y,radius*(1+1.4*t),radius,-.42,0,Math.PI*2);c.fill();
   if(wall&&i%18===0){c.strokeStyle='#7b1b22';c.lineWidth=Math.max(1,radius*.70);c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+1,y+9,x-1,y+18,x+1,y+27+r()*24);c.stroke();}
  }
  if(wall){
   // Uneven impact patches anchor the finer spray; still lit by the real lamps.
   for(const [x,y,rx,ry] of [[83,122,18,12],[125,102,14,9],[159,83,10,7]]){
    c.fillStyle='#851d24';c.beginPath();
    for(let i=0;i<20;i++){const a=i*Math.PI/10,k=.65+r()*.65,px=x+Math.cos(a)*rx*k,py=y+Math.sin(a)*ry*k;i?c.lineTo(px,py):c.moveTo(px,py);}
    c.closePath();c.fill();
   }
  }
 });
}
function crawlMap(){
 const r=rng(172310);
 return canvasTex(256,768,c=>{
  c.lineCap='round';
  // Broken parallel smears, with paler gaps between pulls across the paving.
  for(let lane=0;lane<15;lane++)for(let y=72;y<744;y+=22+r()*22){
   if(r()<.20)continue;
   const x=128+(lane-7)*4+12*Math.sin(y*.015)+r()*6;
   c.globalAlpha=.36+r()*.5;c.strokeStyle=lane%3?'#681a1f':'#481115';c.lineWidth=2+r()*6;
   c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+3,y+13,x-2+r()*6,y+18+r()*26);c.stroke();
  }
  c.globalAlpha=.72;
  for(const [x,y,side] of [[51,308,-1],[201,474,1],[61,648,-1]]){
   c.fillStyle='#67191e';c.beginPath();c.ellipse(x,y,12,18,side*.23,0,Math.PI*2);c.fill();
   c.strokeStyle='#67191e';c.lineWidth=3;
   for(let finger=0;finger<4;finger++){c.beginPath();c.moveTo(x-9+finger*6,y-8);c.lineTo(x-7+finger*6+side*4,y-31-finger%2*5);c.stroke();}
   c.globalAlpha=.43;c.lineWidth=8;c.beginPath();c.moveTo(x,y+10);c.lineTo(x+side*6,y+46);c.stroke();c.globalAlpha=.72;
  }
 });
}
export function addDayrBlood(scene,root){
 const group=new T.Group();group.name='dayr-blood-aftermath';group.userData={visualOnly:true,pools:3,poolRuns:1,crawlTrails:1,floorSprays:2,wallSprays:2};root.add(group);
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
 decal(wall,'dayr-wall-blood-spray-0',[6.27,1.10,-17.97],[0,0,-.12],[1.22,1.58,.18],wallSpray,.85);
 decal(wall,'dayr-wall-blood-spray-1',[10.35,.95,-17.97],[0,0,.24],[1.04,1.32,.18],wallSpray,.85);
 const {prone}=DAYR_FAR_SIDE;
 decal(floor,'dayr-blood-pool-3',[prone.position[0],.012,prone.position[2]],[-Math.PI/2,0,prone.yaw],[1.10,1.25,.12],poolMap(172213),.52);
 const drag=new T.Vector3(0,0,1.8).applyAxisAngle(new T.Vector3(0,1,0),prone.yaw).add(new T.Vector3(...prone.position));
 decal(floor,'dayr-blood-crawl-trail',[drag.x,.012,drag.z],[-Math.PI/2,0,prone.yaw],[1.05,4.2,.12],crawlMap(),.64);
 return group;
}

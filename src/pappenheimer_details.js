// Cleveland Museum of Art 1916.697 (CC0): blued/gilt steel, paired pierced plates,
// recurved 21.3 cm quillons, wire grip, fluted pommel. Small dimensions estimated
// from the museum's front/detail photographs; not a 3D scan. See research notes.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {swordKit,metalMat} from './weapon_looks.js';

export const PAPPENHEIMER_COLORS={grip:0x96938a,hilt:0x35414a,blade:0xc5ccce};
export const PAPPENHEIMER_DIM={length:1.111,blade:.892,cross:.213,bladeBase:.108,guardY:.075,pommelY:-.0855};
const V=a=>new THREE.Vector3(...a);
const kit=swordKit({blade:{edge:'double',width:t=>1-.64*t,thick:.0042,bevel:.0016,tip:'needle',tipLen:.085,overshoot:0}});
const mat={steel:()=>metalMat(0x35414a,{rough:.40}),edge:()=>metalMat(0x89969c,{rough:.36}),gold:()=>metalMat(0xb49756,{rough:.43}),wire:()=>metalMat(0xa6a497,{rough:.48})};
function add(g,geo,m,pos=[0,0,0]){const o=new THREE.Mesh(geo,m);o.position.set(...pos);o.castShadow=true;g.add(o);return o;}
function tube(g,p,r,m,n=28,radial=4){return add(g,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p.map(V)),n,r,radial,false),m);}
function compact(g){
 const bins=new Map();g.updateMatrixWorld(true);g.traverse(o=>{if(!o.isMesh)return;let a=o.geometry.clone();a.applyMatrix4(o.matrixWorld);a.deleteAttribute('uv');if(a.index){const b=a;a=a.toNonIndexed();b.dispose();}const arr=bins.get(o.material)||[];arr.push(a);bins.set(o.material,arr);});
 const result=new THREE.Group();for(const[m,gs]of bins){add(result,mergeGeometries(gs),m);gs.forEach(x=>x.dispose());}g.traverse(o=>{if(o.isMesh)o.geometry.dispose()});return result;
}
function grip(){
 const g=new THREE.Group(),dark=mat.steel(),wire=mat.wire(),gold=mat.gold();
 add(g,new THREE.CylinderGeometry(.0123,.0132,.096,12),dark);
 add(g,new THREE.CylinderGeometry(.010,.007,.016,12),dark,[0,-.054,0]); // continuous neck into the pommel
 for(const phase of[0,Math.PI]){
  const p=[];for(let i=0;i<=384;i++){const t=i/384,a=t*24*Math.PI*2+phase,r=.0134-.0009*t;p.push([Math.cos(a)*r,-.046+t*.092,Math.sin(a)*r]);}tube(g,p,.00052,wire,384,5);
 }
 // Woven collars at the ends of the wire wrap, not decorative gems.
 for(const y of[-.047,.047])for(const phase of[0,Math.PI]){
  const p=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2,r=.0138;p.push([Math.cos(a)*r,y+Math.sin(a*6+phase)*.0012,Math.sin(a)*r]);}tube(g,p,.00075,gold,48);
 }
 g.position.y=.006; // Part collider is centred 6 mm below the hand; keep visible grip on hand.
 return compact(g);
}
function pommel(){
 const g=new THREE.Group(),steel=mat.steel(),edge=mat.edge(),gold=mat.gold();
 const profile=[[-.0255,0],[-.023,.004],[-.019,.005],[-.017,.012],[-.010,.022],[0,.024],[.010,.020],[.016,.010],[.020,.007],[.025,.006]];
 const geo=new THREE.LatheGeometry(profile.map(([y,r])=>new THREE.Vector2(r,y)),36);const a=geo.attributes.position;
 for(let i=0;i<a.count;i++){const x=a.getX(i),z=a.getZ(i),theta=Math.atan2(z,x),f=1+.055*Math.cos(theta*6);a.setX(i,x*f);a.setZ(i,z*f);}geo.computeVertexNormals();add(g,geo,steel);
 for(let k=0;k<6;k++){const theta=k/6*Math.PI*2;const p=profile.slice(3,-2).map(([y,r])=>[Math.cos(theta)*r*1.055,y,Math.sin(theta)*r*1.055]);tube(g,p,.00065,edge,22);}
 for(const y of[.018,.023])add(g,new THREE.CylinderGeometry(.007,.007,.0015,12),gold,[0,y,0]);
 return compact(g);
}
function perforatedPlate(){
 const rx=.049,ry=.0255,s=new THREE.Shape();s.absellipse(0,0,rx,ry,0,Math.PI*2,false,0);
 // Actual holes, including side walls: no opaque dot texture or alpha sorting.
 for(let row=-3;row<=3;row++)for(let col=-7;col<=7;col++){
  const x=col*.0064+(row%2?.0032:0),y=row*.0063;
  if((x/(rx-.0045))**2+(y/(ry-.0045))**2>1)continue;
  const h=new THREE.Path(),r=.00235;
  h.moveTo(x,y+r);h.lineTo(x+r,y);h.lineTo(x,y-r);h.lineTo(x-r,y);h.closePath();s.holes.push(h);
 }
 const geo=new THREE.ExtrudeGeometry(s,{depth:.0014,bevelEnabled:false,curveSegments:36});
 const a=geo.attributes.position;for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i);a.setZ(i,a.getZ(i)+.006*((x/rx)**2+(y/ry)**2));}geo.computeVertexNormals();geo.userData.holes=s.holes.length;return geo;
}
function guard(){
 const g=new THREE.Group(),steel=mat.steel(),edge=mat.edge(),gold=mat.gold();const offset=p=>[p[0],p[1]-PAPPENHEIMER_DIM.guardY,p[2]];
 const line=(p,r,m,n)=>tube(g,p.map(offset),r,m,n);
 // Quillons end at exactly +/-10.65 cm, with modest turned tips.
 const cross=line([[-.103,.039,0],[-.1035,.049,0],[-.075,.052,0],[0,.050,0],[.070,.049,0],[.1035,.053,0],[.103,.064,0]],.003,steel,40);
 cross.geometry.computeBoundingBox();const box=cross.geometry.boundingBox;
 cross.geometry.translate(-(box.max.x+box.min.x)/2,0,0);cross.geometry.scale(.213/(box.max.x-box.min.x),1,1);
 for(const sign of[-1,1])add(g,new THREE.SphereGeometry(.003,8,6),gold,offset([sign*.103,.0515+sign*.0125,0]));
 line([[0,-.070,0],[-.048,-.059,0],[-.073,-.025,0],[-.072,.018,0],[-.045,.044,0],[0,.050,0]],.0033,steel,38);
 line([[-.007,-.068,.001],[-.047,-.057,.001],[-.070,-.024,.001]],.0006,edge,20);
 for(const side of[-1,1]){
  const panel=add(g,perforatedPlate(),steel,[0,.007,side*.030]);if(side<0)panel.rotation.y=Math.PI;
  panel.userData.piercedPlate=true;
  const rim=[];for(let i=0;i<=64;i++){const t=i/64*2*Math.PI;rim.push([Math.cos(t)*.051,.082+Math.sin(t)*.027,side*.0375]);}line(rim,.0023,edge,64);
  line([[-.051,.082,side*.036],[-.055,.055,side*.022],[-.036,.044,side*.010],[0,.050,0],[.037,.044,side*.010],[.055,.055,side*.022],[.051,.082,side*.036]],.0028,steel,40);
  // Side rings brace each perforated shell to the cross and lower ricasso.
  line([[-.049,.086,side*.037],[-.027,.107,side*.020],[0,.108,0],[.028,.107,side*.020],[.049,.086,side*.037]],.0025,steel,32);
  line([[-.032,.052,side*.009],[-.025,.071,side*.014],[0,.077,side*.018],[.025,.071,side*.014],[.032,.052,side*.009]],.0021,steel,32);
 }
 add(g,new THREE.CylinderGeometry(.011,.013,.035,10),steel,[0,-.010,0]);
 for(const y of[.043,.052])add(g,new THREE.CylinderGeometry(.012,.012,.0015,12),gold,offset([0,y,0]));
 // Gilding is restrained and concentrated around the blade inscription below.
 return compact(g);
}
let inscriptionTexture;
function inscription(){
 if(typeof document==='undefined')return null;
 if(inscriptionTexture)return inscriptionTexture;
 const c=document.createElement('canvas');c.width=256;c.height=2048;const x=c.getContext('2d');x.fillStyle='#263139';x.fillRect(0,0,256,2048);
 x.strokeStyle='#aa8c4a';x.lineWidth=5;x.strokeRect(7,8,242,2032);x.strokeRect(20,20,216,2008);
 x.lineWidth=2;
 for(let y=40;y<2000;y+=40)for(const side of[0,1]){const a=side?232:24;x.beginPath();x.moveTo(a,y);x.bezierCurveTo(a+(side?-10:10),y+8,a+(side?-10:10),y+28,a,y+40);x.stroke();}
 x.fillStyle='#bea365';x.font='56px serif';x.textAlign='center';
 // Museum transcription, kept as an inscription rather than invented runes.
 const lines=['NEC TEMPARE NEC TIMIDE','INTER ARMA SILENT LEGE','VERITATEM DILIGE ET PUGNA PRO PATRIA'];
 for(let k=0;k<3;k++){x.save();x.translate(54+k*74,1900);x.rotate(-Math.PI/2);x.fillText(lines[k],820,0,1650);x.restore();}
 for(const y of[85,1960]){x.beginPath();x.moveTo(128,y-40);x.lineTo(170,y);x.lineTo(128,y+40);x.lineTo(86,y);x.closePath();x.stroke();}
 inscriptionTexture=new THREE.CanvasTexture(c);inscriptionTexture.colorSpace=THREE.SRGBColorSpace;return inscriptionTexture;
}
function blade(args){
 const m=kit(...args),g=new THREE.Group(),half=args[2][2],gold=mat.gold(),base=-half;
 // Long gilded forte panel on both faces, observed in the museum detail view.
 for(const side of[-1,1]){
  const tex=inscription();if(tex){const o=add(g,new THREE.PlaneGeometry(.020,.216),new THREE.MeshStandardMaterial({map:tex,roughness:.50,metalness:.55}),[0,base+.117,side*.0044]);if(side<0)o.rotation.y=Math.PI;}
  for(const x of[-.0108,.0108])tube(g,[[x,base+.014,side*.0046],[x*.96,base+.119,side*.0046],[x*.90,base+.224,side*.0046]],.00045,gold,16);
 }
 m.add(g);return m; // Keep the root blade Mesh for blood and breakage.
}
export function pappenheimerPartMesh(...args){const[i,isBlade]=args;if(isBlade)return blade(args);if(i===0)return grip();if(i===1)return pommel();if(i===2)return guard();}

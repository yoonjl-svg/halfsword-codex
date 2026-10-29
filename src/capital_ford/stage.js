import * as THREE from 'three';
import { Kit, box, cyl, limb, canvasTex, rng } from '../stage_kit.js';
import { FORD, BOUNDARY, ROCKS, BARRELS, FENCES, fenceShapes, groundMesh, bedFacet, heightAt, riverX, riverWidth, rockGeometry } from './ground.js';
export function buildCapitalFord(scene){
 const group=new THREE.Group();group.name='수도 근교 여울';scene.add(group);const k=new Kit(291029),r=rng(829),textures=[];
 const tex=(w,h,draw)=>{const t=canvasTex(w,h,draw);textures.push(t);return t;};
 const dirt=tex(512,512,(g,w,h)=>{g.fillStyle='#b5ae94';g.fillRect(0,0,w,h);for(let i=0;i<10000;i++){const c=100+Math.floor(r()*105);g.fillStyle=`rgba(${c},${c-6},${c-21},${.06+r()*.17})`;const x=r()*w,y=r()*h;g.fillRect(x,y,r()*2+1,r()*2+1);}for(let i=0;i<190;i++){g.strokeStyle='rgba(73,67,49,.07)';g.beginPath();let x=r()*w,y=r()*h;g.moveTo(x,y);g.lineTo(x+r()*12-6,y+r()*17);g.stroke();}});dirt.repeat.set(18,18);
 const stone=tex(128,128,(g,w,h)=>{g.fillStyle='#aaa898';g.fillRect(0,0,w,h);for(let i=0;i<1000;i++){g.fillStyle=`rgba(55,60,51,${r()*.2})`;g.fillRect(r()*w,r()*h,1+r()*5,1+r()*3);}g.strokeStyle='#777b6d';for(let i=0;i<5;i++){g.beginPath();let y=22+i*25;g.moveTo(0,y);g.lineTo(w,y+r()*3);g.stroke();}});stone.repeat.set(1,1);
 const rockTex=tex(128,128,(g,w,h)=>{g.fillStyle='#b2b6a9';g.fillRect(0,0,w,h);for(let i=0;i<1600;i++){g.fillStyle=`rgba(42,51,43,${r()*.16})`;g.fillRect(r()*w,r()*h,1+r()*3,1+r()*3);}for(let i=0;i<12;i++){g.strokeStyle='rgba(52,60,52,.12)';g.beginPath();let x=r()*w,y=r()*h;g.moveTo(x,y);g.lineTo(x+12+r()*24,y+8);g.stroke();}});
 const wood=tex(128,256,(g,w,h)=>{g.fillStyle='#78664d';g.fillRect(0,0,w,h);for(let i=0;i<190;i++){g.strokeStyle=`rgba(${r()>.5?'35,29,20':'177,160,119'},${.08+r()*.17})`;g.beginPath();let x=r()*w;g.moveTo(x,0);g.bezierCurveTo(x+6,80,x-5,160,x+2,h);g.stroke();}});
 const mat=(map=null)=>new THREE.MeshStandardMaterial({map,vertexColors:true,roughness:1,metalness:0});
 const mats={earth:mat(dirt),stone:mat(stone),rock:mat(rockTex),wood:mat(wood),iron:mat(),leaf:mat(),detail:mat()};
 const mesh=groundMesh(40),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(mesh.vertices,3));geo.setIndex(new THREE.BufferAttribute(mesh.indices,1));geo.computeVertexNormals();const uv=[],colors=[],C=new THREE.Color();
 for(let i=0;i<mesh.vertices.length;i+=3){const x=mesh.vertices[i],y=mesh.vertices[i+1],z=mesh.vertices[i+2],river=Math.abs(x-riverX(z)),road=Math.abs(z-FORD.bridgeZ-.008*Math.max(0,x)**2);
 let c=river<2.1?0x6b7160:road<1.8?0xb1a78d:0x92977c;C.set(c);const v=.96+.05*Math.sin(x*.8+z*.6);C.multiplyScalar(v);colors.push(C.r,C.g,C.b);uv.push((x+40)/80,(z+40)/80);}
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));const floor=new THREE.Mesh(geo,mats.earth);floor.receiveShadow=true;group.add(floor);
 // Low bridge. Exact top facets are the same as the support collider; timber grain supplies the small detail.
 for(let x=-3.5;x<3.5;x+=.25){let xx=x+.125,y=heightAt(xx,FORD.bridgeZ);k.put('wood',box(.244,.12,3),0x978164,[xx,y-.06,FORD.bridgeZ],[0,0,0],1,{vary:.18,uv:'box',uvScale:.4});}
 // Narrow abutments touch the banks; no central obstacle under the shallow crossing.
 for(const x of [-2.72,2.72]){k.put('stone',box(.65,.3,3.22),0x989c8d,[x,-.11,FORD.bridgeZ],[0,0,0],1,{rough:.035,uv:'box'});for(const z of [-2.17,.97]){k.put('wood',box(.13,.68,.13),0x756249,[x,.34,z],[0,0,.025],1);}}
 for(const z of [-2.10,.90])k.put('wood',box(5.45,.13,.14),0x69583e,[0,-.08,z]);
 for(const rr of ROCKS){const g=rockGeometry(rr);k.put('rock',g,0x92998b,[0,0,0],[0,0,0],1,{uv:'box',uvScale:.48});g.dispose();}
 for(const b of BARRELS){const y=heightAt(b.x,b.z);k.put('wood',cyl(b.r*.88,b.r*.88,b.h,12),0x958060,[b.x,y+b.h/2,b.z],[0,0,0],1,{uv:'box',uvScale:1});k.put('wood',cyl(b.r,b.r,b.h*.62,12),0x8a7353,[b.x,y+b.h/2,b.z],[0,0,0],1,{uv:'box',uvScale:1});for(const a of [.17,.78])k.put('iron',cyl(b.r*1.02,b.r*1.02,.055,12,true),0x45463f,[b.x,y+b.h*a,b.z]);k.put('wood',cyl(b.r*.87,b.r*.87,.018,12),0x9e8d68,[b.x,y+b.h+.009,b.z]);}
 for(const s of fenceShapes())k.put('wood',box(s.hx*2,s.hy*2,s.hz*2),0x8f8061,[s.x,s.y,s.z],[0,s.rot,0],1,{uv:'box',uvScale:.9});
 // A few weathered posts lean beside the working fence, outside the walkable edge.
 for(const p of [[-9.3,-5.9],[8.8,6.2]])k.put('wood',box(.12,1.1,.12),0x776950,[p[0],heightAt(...p)+.5,p[1]],[.15,.2,.18]);
 // Castle wall follows the old road, far beyond the duel ground. Static silhouette, three materials.
 const wallX=23;
 for(const [z,len] of [[-12,19],[12,19]]){k.put('stone',box(1.6,5.7,len),0x8e9489,[wallX,2.65,z],[0,0,0],1,{uv:'box',uvScale:.42});for(let zz=z-len/2+.7;zz<z+len/2;zz+=1.55)k.put('stone',box(1.7,.7,.85),0x92998e,[wallX,5.72,zz],[0,0,0],1,{uv:'box'});}
 for(const z of [-4.1,3.6]){k.put('stone',cyl(1.6,1.85,7.4,10),0x989e94,[wallX-1,3.6,z],[0,0,0],1,{uv:'box',uvScale:.42});for(let a=0;a<10;a++){const ang=a*Math.PI/5;k.put('stone',box(.6,.75,.65),0x969d92,[wallX-1+Math.cos(ang)*1.4,7.55,z+Math.sin(ang)*1.4],[0,-ang,0]);}}
 k.put('stone',box(1.7,1.3,6.2),0x8c9387,[wallX-1,5.65,-.25],[0,0,0],1,{uv:'box'});
 k.put('wood',box(.25,4.8,5.5),0x514f40,[wallX-.9,2.25,-.25],[0,0,0],1,{uv:'box'});
 for(const z of [-1.7,1.2])k.put('iron',box(.28,.12,2.4),0x43473f,[wallX-1.08,2.3,z]);
 // A quiet keep behind the wall and sloping distant ground anchor the scene.
 k.put('stone',box(7,8,8),0x92998e,[32,4,-6],[0,0,0],1,{uv:'box',uvScale:.4});
 const roof=new THREE.ConeGeometry(6,3,4);roof.rotateY(Math.PI/4);k.put('detail',roof,0x5d6661,[32,9.4,-6]);
 // Trees outside the arena, batched; no leaves or cloth are simulated.
 for(let i=0;i<17;i++){const a=1.8+r()*3.3,rad=17+r()*14,x=Math.cos(a)*rad,z=Math.sin(a)*rad,h=3+r()*3,base=bedFacet(x,z).y;limb(k,'wood',[x,base,z],[x+.2,base+h,z],.16,.065,0x665c47);for(let n=0;n<3;n++)k.put('leaf',new THREE.IcosahedronGeometry(1,0),n%2?0x6d7863:0x79816a,[x+(r()-.5)*1.2,base+h-.4+n*.6,z+(r()-.5)*1.2],[0,0,0],[1.8,1.1,1.6],{vary:.16});}
 // River-bank stones and reeds follow the flow instead of filling the arena uniformly.
 for(let i=0;i<65;i++){let z=-25+r()*50,sgn=r()<.5?-1:1,x=riverX(z)+sgn*(riverWidth(z)+.8+r()*.8);if(Math.abs(z-FORD.bridgeZ)<2)continue;const y=bedFacet(x,z).y;if(i%4===0)k.put('stone',new THREE.DodecahedronGeometry(1,0),0x93968a,[x,y+.025,z],[0,0,0],[.13+r()*.13,.07,.17],{vary:.1});else for(let j=0;j<3;j++)limb(k,'leaf',[x,y,z],[x+.08*(j-1),y+.22+r()*.13,z+.08],.015,.005,0x8b8d6a,{},3);}
 for(const [bin,m]of Object.entries(mats)){if(bin==='earth')continue;const o=k.mesh(bin,m,{cast:bin==='wood'||bin==='stone',receive:true});if(o)group.add(o);}
 const flow=tex(256,256,(g,w,h)=>{g.fillStyle='#7b9891';g.fillRect(0,0,w,h);for(let i=0;i<110;i++){g.fillStyle=`rgba(208,217,188,${.03+r()*.11})`;g.fillRect(r()*w,r()*h,.7+r()*2,4+r()*19);}});flow.repeat.set(1,14);
 const wv=[],wi=[],wu=[];for(let j=0;j<=100;j++){const z=-45+j*.9;for(const s of [-1,1]){wv.push(riverX(z)+s*(riverWidth(z)+.28),FORD.waterY,z);wu.push((s+1)/2,j/100);}}for(let j=0;j<100;j++){let a=j*2;wi.push(a,a+1,a+2,a+1,a+3,a+2);}const wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.Float32BufferAttribute(wv,3));wg.setAttribute('uv',new THREE.Float32BufferAttribute(wu,2));wg.setIndex(wi);wg.computeVertexNormals();
 const water=new THREE.Mesh(wg,new THREE.MeshStandardMaterial({map:flow,color:0x9fb9b2,transparent:true,opacity:.48,roughness:.74,metalness:.03,depthWrite:false,side:THREE.DoubleSide}));water.name='얕은 흐르는 강';water.renderOrder=1;group.add(water);
 return {group,update(dt){flow.offset.y-=dt*.026;},stats(){let triangles=0,meshes=0;group.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});return {meshes,triangles};},dispose(){group.traverse(o=>{o.geometry?.dispose();if(o.isMesh)o.material?.dispose();});textures.forEach(t=>t.dispose());scene.remove(group);}};
}

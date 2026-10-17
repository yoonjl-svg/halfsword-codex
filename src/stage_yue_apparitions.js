// Wu / Yue war memories, never Fighters: 20 apparitions; plain marching spears.
// Native 1.75m proportions / clay-guard silhouette, simplified armor at distance.
import * as T from 'three';
import {Kit} from './stage_kit.js';
const COUNT=20,DUEL_COUNT=16,UP=new T.Vector3(0,1,0),V=(...p)=>new T.Vector3(...p);
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const mix=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t);

function templates(wu=false){
 const kit=new Kit(wu?16622:16621),cloth=wu?0x7e8b9c:0x91a4a1,plate=wu?0xb4bcc7:0xb3c2b9,edge=wu?0x556773:0x5c7779,skin=0xcbd5c8;
 let bone='';
 const put=(g,c,p=[0,0,0],rot=[0,0,0],scale=1)=>{kit.put(bone,g,c,p,rot,scale,{vary:.03});g.dispose()};
 const box=(s,c,p,rot)=>put(new T.BoxGeometry(...s),c,p,rot);
 const ball=(r,c,p,scale)=>put(new T.SphereGeometry(r,10,7),c,p,undefined,scale);
 const capsule=(r,h,c)=>put(new T.CapsuleGeometry(r,h,3,8),c);
 for(const [id,size,rows,cols] of [['chest',[.24,.28,.37],wu?3:4,wu?4:6],['abdomen',[.22,.155,.32],2,wu?4:6],['pelvis',[.21,.18,.33],wu?2:3,wu?4:6]]){
  bone=id;box(size,cloth,[0,0,0]);
  for(const sign of [-1,1])for(let y=0;y<rows;y++)for(let z=0;z<cols;z++)box([.014,wu?.058:.039,wu?.070:.045],(y+z)%3?plate:cloth,[sign*(size[0]/2+.008),size[1]/2-.030-y*(wu?.068:.047),(z-(cols-1)/2)*(wu?.078:.051)]);
  if(id==='chest')for(const s of [-1,1]){box([.26,.025,.07],edge,[0,.15,s*.15]);box([.018,.29,.024],edge,[.135,0,s*.10],[s*.3,0,0])}
  if(id==='abdomen')box([.245,.035,.35],edge,[0,-.055,0]);
 }
 bone='head';ball(.1,skin,[0,0,0]);
 if(wu){
  // Broader helmet, cheek pieces and large armor plates distinguish Wu.
  put(new T.SphereGeometry(.115,12,8,0,Math.PI*2,0,Math.PI*.57),plate,[-.009,.02,0]);
  box([.17,.025,.025],edge,[-.01,.137,0]);
  for(const sign of [-1,1])box([.055,.078,.016],plate,[-.027,-.049,sign*.103]);
 }else{
  put(new T.SphereGeometry(.107,12,8,0,Math.PI*2,Math.PI*.04,Math.PI*.58),edge,[-.01,.006,0],[0,0,.25]);
  box([.10,.035,.078],edge,[-.03,.117,0]);
  for(const sign of [-1,1])box([.086,.043,.025],edge,[-.032,.151,sign*.035],[sign*-.13,0,sign*-.12]);
 }
 for(const sign of [-1,1]){box([.008,.009,.016],0x617a7c,[.094,.016,sign*.035]);ball(.021,skin,[-.008,-.023,sign*.095],[.6,1.2,.45])}
 box([.024,.027,.019],skin,[.102,-.01,0]);
 for(const id of ['uarmS','uarmO']){bone=id;capsule(.053,.21,cloth);put(new T.CylinderGeometry(wu?.087:.065,wu?.08:.06,wu?.12:.08,10),plate,[0,.10,0]);}
 for(const id of ['farmS','farmO']){bone=id;capsule(.044,.19,cloth);ball(.042,skin,[0,-.135,0]);put(new T.CylinderGeometry(.049,.05,.022,10),edge,[0,-.075,0]);}
 for(const id of ['thighF','thighB']){bone=id;capsule(.065,.30,cloth);put(new T.CylinderGeometry(.08,.094,.235,10,1,true),plate,[0,.069,0]);}
 for(const id of ['shinF','shinB']){bone=id;capsule(.05,.32,cloth);for(let j=0;j<5;j++)put(new T.CylinderGeometry(.054,.054,.023,8),plate,[0,-.11+j*.047,0]);}
 for(const id of ['footF','footB']){bone=id;box([.25,.075,.11],edge,[.05,0,0]);}
 bone='sword';
 // Straight bronze sword silhouette; no weapon effects, collision or sound.
 const shape=new T.Shape();shape.moveTo(-.029,.03);shape.lineTo(-.024,.58);shape.lineTo(0,.70);shape.lineTo(.024,.58);shape.lineTo(.029,.03);shape.closePath();
 const blade=new T.ExtrudeGeometry(shape,{depth:.012,bevelEnabled:false});blade.translate(0,0,-.006);put(blade,0xcbd7c0);
 box([.12,.026,.04],edge,[0,.025,0]);put(new T.CylinderGeometry(.017,.019,.14,8),cloth,[0,-.065,0]);
 put(new T.CylinderGeometry(.036,.036,.022,10),plate,[0,-.145,0]);
 bone='spear';
 // Marchers carry real silhouettes: slender shaft, long bronze spear point.
 put(new T.CylinderGeometry(.013,.016,2.18,8),edge,[0,.24,0]);
 const spearPoint=new T.Shape();spearPoint.moveTo(-.04,1.30);spearPoint.lineTo(-.035,1.48);spearPoint.lineTo(0,1.66);spearPoint.lineTo(.035,1.48);spearPoint.lineTo(.04,1.30);spearPoint.closePath();
 const spearGeo=new T.ExtrudeGeometry(spearPoint,{depth:.012,bevelEnabled:false});spearGeo.translate(0,0,-.006);put(spearGeo,plate);
 put(new T.CylinderGeometry(.023,.023,.09,8),plate,[0,1.30,0]);
 const result={};
 for(const id of Object.keys(kit.bins)){
  const unused=new T.MeshBasicMaterial(),mesh=kit.mesh(id,unused);unused.dispose();
  const g=mesh.geometry,n=g.attributes.normal,c=g.attributes.color;
  for(let i=0;i<c.count;i++){const light=.72+.18*n.getY(i)+.08*n.getX(i);c.setXYZ(i,c.getX(i)*light,c.getY(i)*light,c.getZ(i)*light)}
  for(const part of kit.bins[id])part.dispose();result[id]=g;
 }return result;
}

// Two-link geometry only; background movements never enter the school system.
function joint(a,b,upper,lower,bend){
 const delta=b.clone().sub(a),d=clamp(delta.length(),.001,upper+lower-.002),axis=delta.normalize();
 const along=(upper*upper-lower*lower+d*d)/(2*d),height=Math.sqrt(Math.max(0,upper*upper-along*along));
 const normal=bend.clone().addScaledVector(axis,-bend.dot(axis));if(normal.lengthSq()<.001)normal.set(0,0,1);normal.normalize();
 return a.clone().addScaledVector(axis,along).addScaledVector(normal,height);
}

export function addYueApparitions(root){
 const group=new T.Group();group.name='yue-apparitions';root.add(group);
 const alphas=Array.from({length:2},()=>new T.InstancedBufferAttribute(new Float32Array(COUNT/2).fill(1),1));
 for(const a of alphas)a.setUsage(T.DynamicDrawUsage);
 const mat=new T.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.43,depthWrite:false,fog:true});
 const time={value:0};
 mat.onBeforeCompile=s=>{
  s.uniforms.ghostTime=time;
  s.vertexShader='attribute float ghostAlpha; varying float vGhostAlpha; varying vec3 vGhostWorld;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGhostAlpha=ghostAlpha; vGhostWorld=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;');
  s.fragmentShader='uniform float ghostTime; varying float vGhostAlpha; varying vec3 vGhostWorld;\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vGhostAlpha*smoothstep(0.025,0.30,vGhostWorld.y)*(0.94+0.06*sin(vGhostWorld.y*17.0+ghostTime*1.3));');
 };
 mat.customProgramCacheKey=()=> 'yue-memory-v1';
 const meshes=[{},{}];let triangles=0;
 for(let camp=0;camp<2;camp++)for(const [id,g] of Object.entries(templates(camp===1))){
  g.setAttribute('ghostAlpha',alphas[camp]);triangles+=(g.index?.count??g.attributes.position.count)/3*COUNT/2;
  const m=new T.InstancedMesh(g,mat,COUNT/2);m.name=(camp?'wu':'yue')+'-ghost-'+id;m.frustumCulled=false;m.castShadow=false;m.receiveShadow=false;
  m.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(m);meshes[camp][id]=m;
 }
 const actors=Array.from({length:COUNT},(_,i)=>({id:i,faction:i%2?'wu':'yue',kind:i<DUEL_COUNT?'duel':'walk',equipment:i<DUEL_COUNT?'sword':i<19?'spear':'sword',position:[0,0,0],opacity:1}));
 group.userData={actors,count:COUNT,duelPairs:8,walkers:4,factions:['yue','wu'],marchingSpears:3,marchingBanners:0,draws:group.children.length,triangles,colliders:0,clock:'stage time; pause-aware',visualOnly:true};
 const world=new T.Matrix4(),part=new T.Matrix4(),q=new T.Quaternion(),identity=new T.Quaternion(),scale=V(1,1,1),rot=new T.Euler();
 const hidden=new T.Matrix4().makeScale(0,0,0);
 const hide=(id,i)=>meshes[i%2][id]?.setMatrixAt(Math.floor(i/2),hidden);
 const place=(id,i,p,rotation)=>{part.compose(p,rotation??identity,scale);part.premultiply(world);meshes[i%2][id].setMatrixAt(Math.floor(i/2),part)};
 const segment=(id,i,a,b)=>{q.setFromUnitVectors(UP,a.clone().sub(b).normalize());place(id,i,a.clone().add(b).multiplyScalar(.5),q)};
 const poses=(i,t,walking,phase)=>{
  const u=(phase%1+1)%1;
  let hand=[.36,1.22,.22],tip=[.76,1.77,-.10],step=0,lean=0;
  if(walking){
   // Keep the 2.51m weapon; a lower hand and slight rearward lean prevent
   // the marching spear from reading as an elevated flagpole.
   hand=[.08+Math.sin(t*2.7+i)*.035,i<19?.90:1.06,.25];
   tip=i<19?[-.47,2.41,.25]:[.31,.48,.25];
  }
  else{
   const ready=[.06,1.65,.23],raised=[-.23,2.27,.16],hit=[.54,1.24,-.04],end=[1.24,1.16,-.08];
   const cross=[.38,1.22,.30],crossTip=[.95,1.42,.48];
   if(u<.12){const k=smooth(u/.12);hand=mix(hand,ready,k);tip=mix(tip,raised,k)}
   else if(u<.22){const k=smooth((u-.12)/.10);hand=mix(ready,hit,k);tip=mix(raised,end,k);step=.17*k;lean=.07*k}
   else if(u<.30){const k=smooth((u-.22)/.08);hand=mix(hit,cross,k);tip=mix(end,crossTip,k);step=.17;lean=.05}
   else if(u<.37){const k=smooth((u-.30)/.07);hand=mix(cross,[.52,1.32,-.18],k);tip=mix(crossTip,[1.14,1.58,-.36],k);step=.18;lean=.05}
   else if(u<.50){const k=smooth((u-.37)/.13);hand=mix([.52,1.32,-.18],hand,k);tip=mix([1.14,1.58,-.36],tip,k);step=.18*(1-k);lean=.05*(1-k)}
   else if(u<.90){
    const k=smooth((u-.50)/.09)*(1-smooth((u-.84)/.06));
    hand=mix(hand,[.49,1.30,.10],k);tip=mix(tip,[.49,1.94,-.40],k);lean=-.055*k;step=-.08*k;
   }

  }
  const gait=walking?t*2.7+i:0,bob=walking?.014*Math.cos(gait*2):-.055*smooth(Math.abs(step)/.18);
  for(const [id,y] of [['pelvis',.97],['abdomen',1.13],['chest',1.33],['head',1.62]]){
   q.setFromEuler(rot.set(0,walking?.025*Math.sin(gait):.035*Math.sin(u*6.28),-lean));place(id,i,V(lean*(y-.97),y+bob,0),q);
  }
  for(const [side,upper,lower,foot] of [[1,'thighF','shinF','footF'],[-1,'thighB','shinB','footB']]){
   const swing=Math.sin(gait+(side<0?Math.PI:0));
   const ankle=V(walking?.20*swing:(side>0?.15+step:-.14),.08+(walking?Math.max(0,swing)*.075:0),side*.105);
   const hip=V(0,.94+bob,side*.095),knee=joint(hip,ankle,.43,.44,V(1,0,0));
   segment(upper,i,hip,knee);segment(lower,i,knee,ankle);place(foot,i,ankle.clone().add(V(0,-.035,0)));
  }
  for(const [side,upper,lower] of [[1,'uarmS','farmS'],[-1,'uarmO','farmO']]){
   const shoulder=V(lean*.4,1.43+bob,side*.205);
   const wrist=side>0?V(...hand):V(.17+(walking?Math.sin(gait)*.12:0),walking?1.00:1.13,-.25);
   wrist.y+=bob;const elbow=joint(shoulder,wrist,.30,.28,V(0,-1,side*.5));
   segment(upper,i,shoulder,elbow);segment(lower,i,elbow,wrist);
  }
  q.setFromUnitVectors(UP,V(...tip).sub(V(...hand)).normalize());
  const held=V(...hand).add(V(0,bob,0));
  if(walking&&i<19){hide('sword',i);place('spear',i,held,q)}
  else{place('sword',i,held,q);hide('spear',i)}
 };
 // Surround the whole duel field, leaving the 10.5m camera/combat buffer clear.
 const centers=[
  [13.2,-4.3,Math.PI/2],[13.0,9.0,2.5],[4.2,13.6,.35],[-7.6,12.4,-.65],
  [-13.2,3.0,Math.PI/2],[-12.4,-7.2,.10],[-2.8,-13.7,-.30],[7.4,-12.1,.75]
 ];
 let previous=-Infinity;
 const update=t=>{
  if(t>=previous&&t-previous<1/30)return;previous=t;
  time.value=t;
  for(let i=0;i<COUNT;i++){
   let x,z,angle,phase,fade;
   if(i<DUEL_COUNT){
    const pair=Math.floor(i/2),side=i%2?1:-1,[cx,cz,a]=centers[pair];phase=t/(3.5+(pair%4)*.18)+pair*.21+(i%2)*.5;
    const u=(phase%1+1)%1;
    const forward=.17*smooth((u-.10)/.12)*(1-smooth((u-.37)/.13));
    const retreat=.10*smooth((u-.54)/.13)*(1-smooth((u-.84)/.12));
    const distance=.845-forward+retreat;
    x=cx+Math.cos(a)*distance*side;z=cz+Math.sin(a)*distance*side;angle=-a+(side>0?Math.PI:0);
    fade=.80+.16*Math.sin(t*.30+pair*1.8);
   }else{
    const wu=i%2===1,lane=Math.floor((i-DUEL_COUNT)/2),p=((t*.018+(wu?.5:0)+lane*.23)%1+1)%1;
    const along=(wu?1:-1)*(20-p*40);
    if(lane===0){x=14.9+.15*Math.sin(p*6.28+i);z=along;angle=wu?Math.PI/2:-Math.PI/2;}
    else{x=along;z=-15.2+.15*Math.sin(p*6.28+i);angle=wu?Math.PI:0;}
    phase=t;fade=smooth(p/.07)*smooth((1-p)/.07)*(.72+.12*Math.sin(t*.7+i));
   }
   world.makeRotationY(angle);world.setPosition(x,0,z);poses(i,t,i>=DUEL_COUNT,phase);
   alphas[i%2].setX(Math.floor(i/2),fade);actors[i].position=[x,0,z];actors[i].opacity=fade*.43;
  }
  for(const camp of meshes)for(const m of Object.values(camp))m.instanceMatrix.needsUpdate=true;for(const a of alphas)a.needsUpdate=true;
  group.userData.time=t;
 };
 update(0);return update;
}

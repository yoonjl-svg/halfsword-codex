import * as T from 'three';
import { smooth, clamp } from './rules.js';
import { mergeStaticPieces } from './merge.js';

const Y=new T.Vector3(0,1,0);
const sphere=new T.SphereGeometry(1,16,10);
const eyeGeo=new T.SphereGeometry(1,8,6);
const mats={
  scale:new T.MeshStandardMaterial({color:0x3e494d,roughness:.87}),
  ridge:new T.MeshStandardMaterial({color:0x747269,roughness:.72,metalness:.13}),
  belly:new T.MeshStandardMaterial({color:0x938b78,roughness:.9}),
  horn:new T.MeshStandardMaterial({color:0xc3b79a,roughness:.63}),
  dark:new T.MeshStandardMaterial({color:0x172421,roughness:.88}),
  wing:new T.MeshStandardMaterial({color:0x434348,roughness:.95,side:T.DoubleSide}),
  eye:new T.MeshStandardMaterial({color:0xd59a45,emissive:0x8c4a16,emissiveIntensity:.38}),
  mouth:new T.MeshStandardMaterial({color:0x442e29,roughness:.95}),
  iron:new T.MeshStandardMaterial({color:0x70634d,roughness:.58,metalness:.55}),
};
function mesh(g,geo,mat,p,s) { const m=new T.Mesh(geo,mat); if(p)m.position.set(...p); if(s)m.scale.set(...s); m.castShadow=true; m.receiveShadow=true; g.add(m); return m; }
function ell(g,p,s,mat=mats.scale) {return mesh(g,sphere,mat,p,s);}
function beam(g,a,b,r1,r2,mat=mats.scale,n=8) {
  const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av);
  const m=mesh(g,new T.CylinderGeometry(r2,r1,d.length(),n),mat);
  m.position.copy(av).add(bv).multiplyScalar(.5);m.quaternion.setFromUnitVectors(Y,d.normalize());return m;
}
function horn(g,points,r=.1,mat=mats.horn) {
  for(let i=0;i<points.length-1;i++)beam(g,points[i],points[i+1],r*(1-i/(points.length-1)),r*(1-(i+1)/(points.length-1))+.003,mat,6);
}
function membrane(g,points) {
  const vertices=[];for(let i=1;i<points.length-1;i++)vertices.push(...points[0],...points[i],...points[i+1]);
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();return mesh(g,geo,mats.wing);
}

export function createDragonModel(scene) {
  const root=new T.Group(); scene.add(root); root.name='수호룡';
  const torso=new T.Group();root.add(torso);
  ell(torso,[-.22,1.62,0],[1.48,.73,.73]);
  ell(torso,[.68,1.75,0],[.75,.8,.76]);
  ell(torso,[-1.15,1.35,0],[.68,.62,.64]);
  ell(torso,[.35,1.2,0],[1.1,.37,.56],mats.belly);
  for(let i=0;i<10;i++) {
    const x=-1.55+i*.255;
    const sc=mesh(torso,new T.ConeGeometry(.15,.34,4),mats.ridge,[x,2.19+.24*Math.sin(i/10*Math.PI),0]);sc.rotation.z=.24;
    for(const s of[-1,1]) {const plate=ell(torso,[x,1.93,s*.56],[.21,.075,.19],mats.ridge);plate.rotation.x=s*.6;}
  }
  // 접힌 날개: 뼈가 막을 받치고 세 갈래 손가락이 뒤로 접힌다.
  const wings=[];
  for(const s of[-1,1]) {
    const w=new T.Group();w.position.set(.45,2.04,s*.57);torso.add(w);wings.push(w);
    const a=[0,0,0],b=[-.43,.72,s*.86],c=[-2.02,.48,s*1.03],d=[-1.66,-.55,s*.22];
    beam(w,a,b,.12,.095);beam(w,b,c,.095,.025,mats.ridge);beam(w,b,d,.065,.015);
    const tips=[c,[-1.93,-.02,s*.76],d];
    for(const p of tips)beam(w,b,p,.05,.012,mats.ridge);
    membrane(w,[a,b,c,[-1.9,.12,s*.93],tips[1],[-1.55,-.08,s*.32],d]);
    horn(w,[b,[-.35,1.08,s*.58],[-.24,1.19,s*.58]],.055);
    // 얇은 날개막의 낡은 상처.
    ell(w,[-1.4,.22,s*.5],[.15,.09,.01],mats.dark);
  }
  const legs=[];
  for(const x of[-1.0,.72]) for(const s of[-1,1]) {
    const g=new T.Group();g.position.set(x,1.35,s*.57);root.add(g);
    ell(g,[0,0,0],[.39,.55,.33]);
    const knee=[x>0?.18:-.28,-.6,s*.2],ankle=[x>0?.62:.18,-1.12,s*.32];
    beam(g,[0,-.12,0],knee,.26,.19);ell(g,knee,[.21,.23,.22],mats.ridge);beam(g,knee,ankle,.17,.105);
    const foot=ell(g,[ankle[0]+.12,-1.22,ankle[2]],[.34,.12,.23],mats.dark);
    for(let k=0;k<3;k++)horn(g,[[ankle[0]+.19,-1.2,ankle[2]+(k-1)*.14],[ankle[0]+.48,-1.23,ankle[2]+(k-1)*.15],[ankle[0]+.55,-1.31,ankle[2]+(k-1)*.15]],.046);
    legs.push({g,x,s,foot});
  }
  // 목은 겹친 구슬 여섯 개 대신 이어진 한 표면. 한 번 할당하고 꼭짓점만 갱신한다.
  const rings=12,sides=12,neckPos=new Float32Array((rings+1)*(sides+1)*3),neckNorm=new Float32Array(neckPos.length),indices=[];
  for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,a+1,b,a+1,b+1,b);}
  const neckGeo=new T.BufferGeometry();neckGeo.setAttribute('position',new T.BufferAttribute(neckPos,3).setUsage(T.DynamicDrawUsage));neckGeo.setAttribute('normal',new T.BufferAttribute(neckNorm,3).setUsage(T.DynamicDrawUsage));neckGeo.setIndex(indices);
  const neckMesh=mesh(root,neckGeo,mats.scale);neckMesh.frustumCulled=false;
  const head=new T.Group();root.add(head);
  ell(head,[-.04,.02,0],[.57,.30,.32]);
  ell(head,[.58,-.07,0],[.55,.15,.255]);
  ell(head,[.63,-.18,0],[.45,.045,.22],mats.mouth);
  for(const s of[-1,1]) {
    const brow=ell(head,[.07,.17,s*.28],[.26,.1,.1],mats.ridge);brow.rotation.z=.18;
    ell(head,[.17,.10,s*.319],[.09,.045,.017],mats.dark);
    mesh(head,eyeGeo,mats.eye,[.19,.105,s*.332],[.041,.031,.012]);
    ell(head,[.2,.104,s*.345],[.008,.026,.004],mats.dark);
    ell(head,[.93,-.02,s*.145],[.06,.035,.025],mats.dark);
    horn(head,[[-.23,.23,s*.26],[-.55,.51,s*.43],[-.91,.7,s*.53],[-1.15,.73,s*.6]],.135);
    horn(head,[[-.32,-.08,s*.29],[-.57,-.02,s*.5],[-.78,.12,s*.62]],.075,mats.ridge);
    for(let i=0;i<4;i++) {const t=mesh(head,new T.ConeGeometry(.027,.1,5),mats.horn,[.25+i*.19,-.20,s*(.21-i*.015)]);t.rotation.z=Math.PI;}
  }
  const jaw=new T.Group();jaw.position.set(-.15,-.16,0);head.add(jaw);
  ell(jaw,[.62,-.08,0],[.58,.075,.22],mats.belly);
  for(const s of[-1,1])for(let i=0;i<3;i++)mesh(jaw,new T.ConeGeometry(.025,.09,5),mats.horn,[.4+i*.21,-.01,s*.19]);
  const collar=mesh(root,new T.TorusGeometry(.40,.045,5,12),mats.iron,[1.02,1.84,0]);collar.rotation.y=Math.PI/2;
  const seal=mesh(root,new T.BoxGeometry(.08,.22,.18),mats.iron,[1.1,1.49,0]);seal.rotation.z=.1;
  for(const s of[-1,1])beam(root,[1,1.62,s*.35],[.74,1.27,s*.43],.025,.025,mats.iron,5);
  const tailCurve=new T.CatmullRomCurve3([new T.Vector3(-1.25,1.1,0),new T.Vector3(-2,.65,.4),new T.Vector3(-2.8,.3,1.1),new T.Vector3(-3.65,.15,1.8)]);
  const tailGeo=new T.TubeGeometry(tailCurve,18,.23,8,false),tv=tailGeo.attributes.position;
  for(let i=0;i<tv.count;i++){const u=Math.floor(i/9)/18,c=tailCurve.getPointAt(u);tv.setXYZ(i,c.x+(tv.getX(i)-c.x)*(1-u*.9),c.y+(tv.getY(i)-c.y)*(1-u*.9),c.z+(tv.getZ(i)-c.z)*(1-u*.9));}tailGeo.computeVertexNormals();mesh(torso,tailGeo,mats.scale);
  // 움직이지 않는 날개와 뒷다리는 몸통 재질별로 합친다.
  for(const w of wings){w.updateMatrix();for(const c of [...w.children]){c.applyMatrix4(w.matrix);torso.add(c);}torso.remove(w);}
  for(const l of legs.filter(l=>l.x<0)){l.g.updateMatrix();for(const c of [...l.g.children]){c.applyMatrix4(l.g.matrix);torso.add(c);}root.remove(l.g);}
  const zones=[
    {id:'chest',r:.78,damage:.38,anchor:new T.Vector3(.65,1.65,0)},
    {id:'body',r:.87,damage:.3,anchor:new T.Vector3(-.55,1.55,0)},
    {id:'head',r:.40,damage:1,anchor:new T.Vector3()},
    {id:'snout',r:.34,damage:.85,anchor:new T.Vector3()},
    {id:'throat',r:.34,damage:1.4,anchor:new T.Vector3()},
    ...[-1,1].map(s=>({id:s>0?'legR':'legL',r:.36,damage:.7,anchor:new T.Vector3(.96,.75,s*.78)})),

  ].map(z=>({...z,p:new T.Vector3(),prev:new T.Vector3(),velocity:new T.Vector3()}));
  const pose={head:new T.Vector3(),mouth:new T.Vector3(),claw:new T.Vector3(),tail:new T.Vector3()};
  function update(d,dt=0) {
    root.position.copy(d.position);root.rotation.y=-d.heading;root.scale.setScalar(2.1);
    const t=d.time,phase=d.phase,u=d.phaseU,attack=d.attack;
    let hx=2.24,hy=.93,hz=d.aimZ||0,jawOpen=.09,tilt=-.03;
    const walk=0;
    torso.position.y=Math.sin(t*1.6)*.012;
    if(phase==='tell') {
      const k=smooth(u);hx-=.48*k;hy+=.56*k;jawOpen=.1+.48*k;
      if(attack==='claw') {hy=1.15;hx=2.1;}
      if(attack==='fire') {hx=2.24+.16*k;hy=.93+k*.32;tilt=-.05*k;jawOpen=.09+.49*k;}
      if(attack==='tail')hz=Math.sin(t*2)*.3*k;
    } else if(phase==='active') {
      if(attack==='nip'||attack==='bite') {const peak=d.reach||3.2;if(u<.6){const k=smooth(u/.6);hx=1.76+(peak-1.76)*k;hy=1.49-.82*k;}else{const k=smooth((u-.6)/.4);hx=peak+(2.54-peak)*k;hy=.67+.02*k;}jawOpen=.58*(1-smooth(u));tilt=-.14;}
      if(attack==='claw') {hy=1.15-.42*smooth(u);hx=2.1+.44*smooth(u);jawOpen=.12;}
      if(attack==='fire') {hx=2.4;hy=1.25;hz+=(u-.5)*.3;jawOpen=.58;tilt=-.05;}
    } else if(phase==='recover') {const k=1-smooth(u);hx+=.3*k;hy-=.28*k;jawOpen=.12*k;}
    if(phase==='stagger') {hy=.57;hx=2.5;tilt=.1;torso.position.y=-.25;}
    if(!d.alive) {const fall=smooth(d.deadTime/1.8);hy=.93-fall*.58;hx=2.4;torso.position.y=-fall*.85;torso.rotation.x=-fall*.18;tilt=-.1;jawOpen=.2;}
    head.position.lerp(new T.Vector3(hx,hy,hz),dt>0?1-Math.exp(-dt*22):1);hx=head.position.x;hy=head.position.y;hz=head.position.z;head.rotation.z=tilt;head.rotation.y=-hz*.2;jaw.rotation.z=-jawOpen;
    for(let i=0;i<=rings;i++){
      const a=i/rings,cx=.8+(hx-.8)*a,cy=1.89+(hy-1.89)*a+Math.sin(a*Math.PI)*.20,cz=hz*a;
      const dx=hx-.8,dy=hy-1.89+Math.cos(a*Math.PI)*.20*Math.PI,len=Math.hypot(dx,dy)||1;
      for(let j=0;j<=sides;j++){const th=j/sides*Math.PI*2,co=Math.cos(th),si=Math.sin(th),k=(i*(sides+1)+j)*3,r=.48-a*.2;
        neckPos[k]=cx-dy/len*co*r;neckPos[k+1]=cy+dx/len*co*r;neckPos[k+2]=cz+si*r;
        neckNorm[k]=-dy/len*co;neckNorm[k+1]=dx/len*co;neckNorm[k+2]=si;
      }
    }
    neckGeo.attributes.position.needsUpdate=true;neckGeo.attributes.normal.needsUpdate=true;
    for(const {g,x,s} of legs.filter(l=>l.x>0)) {
      g.rotation.z=walk*(x>0?s:-s)*.16;g.rotation.x=0;g.rotation.y=0;
      if(!d.alive)g.rotation.z=-.7*s*s*smooth(d.deadTime/1.8);
      if(attack==='claw'&&x>0&&s===d.side) {
        if(phase==='tell')g.rotation.z=.85*smooth(u);
        if(phase==='active')g.rotation.z=.85-1.0*smooth(Math.max(0,(u-.38)/.62));
        if(phase==='recover')g.rotation.z=-.15*(1-smooth(u));
        g.rotation.x=phase==='active'?s*.12*Math.sin(u*Math.PI):0;
        g.rotation.y=phase==='active'?s*.22*Math.sin(u*Math.PI):0;
      }
    }
    root.updateMatrixWorld(true);
    for(const z of zones) {
      z.prev.copy(z.p);
      if(z.id==='head')z.anchor.copy(head.position).add(new T.Vector3(.15,-.03,0));
      if(z.id==='snout')z.anchor.copy(head.position).add(new T.Vector3(.77,-.08,0));
      if(z.id==='throat')z.anchor.set(hx-.43,hy-.18,hz*.8);
      if(z.id==='legL'||z.id==='legR'){const l=legs.find(l=>l.x>0&&l.s===(z.id==='legR'?1:-1));z.anchor.set(.58,-.9,l.s*.3).applyMatrix4(l.g.matrix);}
      z.p.copy(z.anchor).applyMatrix4(root.matrixWorld);
      z.velocity.copy(z.p).sub(z.prev).multiplyScalar(dt>0?1/dt:0);
    }
    pose.head.copy(head.position).applyMatrix4(root.matrixWorld);
    pose.mouth.set(1.02,-.08,0).applyMatrix4(head.matrixWorld);
    const l=legs.find(l=>l.x>0&&l.s===d.side);pose.claw.set(1.1,-1.25,l.s*.34).applyMatrix4(l.g.matrixWorld);
    pose.tail.set(-2.8,.3,1.1).applyMatrix4(root.matrixWorld);
  }
  for(const z of zones)z.r*=2.1;
  mergeStaticPieces(root);
  return {root,zones,pose,update,head,jaw};
}

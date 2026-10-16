// Visual-only props. Body axes: +X forward, +Y up, +Z right.
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function sculpture(parent,name){
  const parts=[];
  const put=(geo,color,pos=[0,0,0],scale=[1,1,1],rot=[0,0,0])=>{
    geo.scale(...scale);geo.rotateX(rot[0]);geo.rotateY(rot[1]);geo.rotateZ(rot[2]);geo.translate(...pos);
    const g=geo.index?geo.toNonIndexed():geo;if(g!==geo)geo.dispose();
    g.deleteAttribute('uv');const c=new T.Color(color),n=g.attributes.position.count;
    g.setAttribute('color',new T.Float32BufferAttribute(Array.from({length:n},()=>[c.r,c.g,c.b]).flat(),3));parts.push(g);
  };
  const ball=(p,s,c)=>put(new T.SphereGeometry(1,10,6),c,p,s);
  const rod=(a,b,ra,rb,c)=>{
    const start=new T.Vector3(...a),end=new T.Vector3(...b),v=end.clone().sub(start);
    const geo=new T.CylinderGeometry(rb,ra,v.length(),7);
    geo.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));
    put(geo,c,start.add(end).multiplyScalar(.5).toArray());
  };
  const finish=()=>{const geo=mergeGeometries(parts);parts.forEach(p=>p.dispose());
    const m=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:.87,flatShading:true}));
    m.name=name;m.castShadow=true;parent.add(m);return m;};
  return {put,ball,rod,finish};
}

export function addCosmeticKettle(g){
  // Identical three shapes/dimensions to the player's dressPart kettle. This
  // decoration intentionally has no userData.helmet or physical armor spec.
  const h=new T.Group();h.name='alter-player-kettle-hat';g.add(h);
  const steel=new T.MeshStandardMaterial({color:0xb9c0c7,metalness:.75,roughness:.3});
  const add=(geo,mat,p)=>{const m=new T.Mesh(geo,mat);m.position.set(...p);m.castShadow=true;h.add(m)};
  add(new T.SphereGeometry(.117,18,10,0,Math.PI*2,0,Math.PI*.5),steel,[0,.018,0]);
  add(new T.CylinderGeometry(.123,.215,.046,28,1,true),new T.MeshStandardMaterial({color:0xb9c0c7,metalness:.75,roughness:.3,side:T.DoubleSide}),[0,0,0]);
  add(new T.BoxGeometry(.18,.023,.011),steel,[0,.128,0]);
}

export function addGroveBranch(g){
  const w=sculpture(g,'alter-fallen-sacred-branch');
  // A snapped twig tucked behind the ear, sloping into the low hair tie.
  w.rod([-.105,-.11,-.07],[-.045,.035,-.111],.009,.005,0x7c6950);
  w.rod([-.070,-.017,-.098],[-.14,.045,-.105],.005,.0025,0x7c6950);
  w.rod([-.047,.028,-.11],[-.004,.072,-.106],.004,.002,0x7c6950);
  w.ball([-.105,-.111,-.07],[.009,.006,.009],0xd6c7a1);
  for(const [p,s] of [[[-.14,.043,-.107],[.031,.012,.016]],[[-.024,.06,-.108],[.029,.012,.016]],[[-.065,.014,-.11],[.023,.012,.015]]])w.ball(p,s,0x8d9d73);
  w.finish();
}

export function addShoulderIguana(g){
  const w=sculpture(g,'alter-shoulder-iguana'),green=0xa2b969,dark=0x527354,pale=0xd1d49b;
  // Low crouch along the left shoulder, inside the upper-arm line. Head faces
  // forward; the long tail folds down the back rather than into the sword arc.
  w.ball([-.075,.205,-.145],[.104,.043,.037],green);
  w.ball([.042,.224,-.142],[.052,.034,.033],green);
  w.ball([.083,.213,-.143],[.032,.020,.029],pale);
  w.ball([.044,.190,-.141],[.025,.037,.010],pale); // dewlap
  for(const z of [-.174,-.111]){
    w.ball([.059,.237,z],[.009,.009,.004],0xd9bc69);
    w.ball([.063,.237,z+(z<-.14?-.003:.003)],[.004,.007,.002],0x172017);
    w.ball([.025,.214,z],[.013,.014,.004],pale); // subtympanic scale
  }
  const tail=[[-.16,.201,-.145],[-.22,.177,-.14],[-.25,.104,-.12],[-.25,.024,-.09],[-.237,-.052,-.045],[-.22,-.078,.01]];
  for(let i=1;i<tail.length;i++)w.rod(tail[i-1],tail[i],.027*(1-(i-1)/tail.length),.025*(1-i/tail.length),i%2?green:dark);
  for(const x of [-.125,.0])for(const s of [-1,1]){
    const a=[x,.2,-.145+s*.028],b=[x-.023,.169,-.145+s*.052],c=[x+.012,.155,-.145+s*.046];
    w.rod(a,b,.012,.009,green);w.rod(b,c,.009,.005,green);
    for(let i=0;i<3;i++)w.rod(c,[c[0]+.017,c[1]-.002,c[2]+(i-1)*.007],.002,.001,pale);
  }
  for(let i=0;i<10;i++){
    const x=.035-i*.024,y=.252-Math.max(0,i-2)*.006;
    w.put(new T.ConeGeometry(.008,.027-i*.0015,4),pale,[x,y,-.145],[1,1,.43]);
  }
  w.finish().position.set(-.085,.012,-.015);
}

export function addRatnaHeadscarf(g){
  const w=sculpture(g,'alter-ratna-white-headscarf'),cloth=0xc9cbca,fold=0xa9afaf;
  const n=32,rows=12,pos=[],idx=[];
  // The front edge sits above the curls; the cloth descends to the low back knot.
  // Original curls and beard stay intact underneath and around the open edge.
  for(let j=0;j<=rows;j++)for(let i=0;i<=n;i++){
    const a=i/n*Math.PI*2,theta=(1.46-.43*Math.cos(a))*j/rows;
    const ripple=1+.014*Math.sin(a*9+j*.34)*Math.sin(theta);
    pos.push(-.008+.136*Math.sin(theta)*Math.cos(a)*ripple,.006+.135*Math.cos(theta),.132*Math.sin(theta)*Math.sin(a)*ripple);
    if(j<rows&&i<n){const k=j*(n+1)+i;idx.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2)}
  }
  const cap=new T.BufferGeometry();cap.setAttribute('position',new T.Float32BufferAttribute(pos,3));cap.setIndex(idx);cap.computeVertexNormals();w.put(cap,cloth);
  const edge=[];for(let i=0;i<=n;i++){const a=i/n*Math.PI*2,t=1.46-.43*Math.cos(a);edge.push(new T.Vector3(-.008+.136*Math.sin(t)*Math.cos(a),.006+.135*Math.cos(t),.132*Math.sin(t)*Math.sin(a)))}
  w.put(new T.TubeGeometry(new T.CatmullRomCurve3(edge),48,.0035,4,false),fold);
  for(const side of [-1,1])for(const lift of [.10,.24]){
    const crease=[];for(let i=0;i<=12;i++){
      const a=side*(.72+i/12*2.05),theta=1.46-.43*Math.cos(a)-lift*(1-i/12);
      crease.push(new T.Vector3(-.008+.139*Math.sin(theta)*Math.cos(a),.006+.137*Math.cos(theta),.135*Math.sin(theta)*Math.sin(a)));
    }
    w.put(new T.TubeGeometry(new T.CatmullRomCurve3(crease),20,.0016,4,false),0xb1b7b6);
  }
  w.ball([-.143,-.027,.018],[.025,.018,.027],cloth);
  // Two short folded tails, placed centrally/right of the left-shoulder iguana.
  for(const [z,length] of [[.005,.12],[.044,.15]]){
    const v=[-.15,-.025,z-.014,-.15,-.025,z+.014,-.169,-.07,z-.018,-.18,-.07,z+.013,-.17,-.025-length,z-.010,-.18,-.02-length,z+.018];
    const tail=new T.BufferGeometry();tail.setAttribute('position',new T.Float32BufferAttribute(v,3));tail.setIndex([0,2,1,1,2,3,2,4,3,3,4,5]);tail.computeVertexNormals();
    w.put(tail,cloth);w.rod([-.177,-.065,z+.004],[-.18,-.01-length,z+.01],.002,.001,fold);
  }
  const scarf=w.finish();scarf.material.side=T.DoubleSide;
}

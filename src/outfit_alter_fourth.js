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
  const h=new T.Group();h.name='alter-player-kettle-hat';h.position.y=.05;h.rotation.z=.12;g.add(h);
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
  const w=sculpture(g,'alter-shoulder-iguana'),green=0x789453,dark=0x475b36,pale=0xa7b87d;
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

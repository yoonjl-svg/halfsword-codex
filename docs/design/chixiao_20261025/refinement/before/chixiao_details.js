// 적소검 — 사용자 선택 시안(2026-10-25)의 붉은 직검·백옥 코등이.
// 전승의 창작 해석. 겉모습만 담당하며 질량/충돌/유파는 weapons.js에 둔다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { metalMat } from './weapon_looks.js';

export const CHIXIAO_COLORS = { blade: 0x963d35, gold: 0xb59a60, grip: 0x282325 };
const v = p => new THREE.Vector3(...p);
function add(root, geometry, material, at = [0,0,0]) {
  const m = new THREE.Mesh(geometry, material); m.position.set(...at); m.castShadow = true; root.add(m); return m;
}
function relief(points, depth, bevel = .0006, smooth = false) {
  if(smooth){const curve=new THREE.CatmullRomCurve3(points.map(([x,y])=>v([x,y,0])),true,'centripetal');points=curve.getPoints(points.length*4).map(p=>[p.x,p.y]);}
  const s = new THREE.Shape(); points.forEach(([x,y],i) => i ? s.lineTo(x,y) : s.moveTo(x,y)); s.closePath();
  const g = new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,steps:1});
  g.translate(0,0,-depth/2); return g;
}
function line(root, points, radius, material, segments=24) {
  return add(root,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v)),segments,radius,4,false),material);
}
function compact(group) {
  group.updateMatrixWorld(true); const buckets=new Map();
  group.traverse(m=>{if(!m.isMesh)return; let g=m.geometry.clone();g.applyMatrix4(m.matrixWorld);g.deleteAttribute('uv');
    if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}const a=buckets.get(m.material)||[];a.push(g);buckets.set(m.material,a);});
  const root=new THREE.Group();for(const[mat,geos]of buckets){add(root,mergeGeometries(geos,false),mat);geos.forEach(g=>g.dispose());}
  group.traverse(m=>{if(m.isMesh)m.geometry.dispose();});return root;
}
function blade(shape, opts) {
  const [,hx,hy,hz]=shape, pos=[], cols=[];
  const sections=[0,.04,.20,.50,.76,.84,.93,1];
  const xs=[-1,-.76,-.08,0,.08,.76,1], reliefs=[0,.30,.94,1,.94,.30,0];
  const width=t=>t<=.84 ? 1-.06*t : (.94*(1-t)/.16);
  const point=(t,k,side)=>[xs[k]*hx*width(t),-hy+2*hy*t,side*hz*reliefs[k]*(1-.26*t)*(t>.93?(1-t)/.07:1)];
  function tri(a,b,c,shade){pos.push(...a,...b,...c);for(let j=0;j<3;j++)cols.push(shade,shade,shade);}
  for(const side of [-1,1])for(let j=1;j<sections.length;j++)for(let k=0;k<xs.length-1;k++){
    const a=point(sections[j-1],k,side),b=point(sections[j],k,side),c=point(sections[j],k+1,side),d=point(sections[j-1],k+1,side);
    const shade=(k===0||k===5)?1.75:(k===2||k===3)?.86:1.06;
    if(side>0){tri(a,c,b,shade);tri(a,d,c,shade);}else{tri(a,b,c,shade);tri(a,c,d,shade);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));g.computeVertexNormals();
  // Keep the root a Mesh: fighter.js uses it for blade blood and cutting traces.
  const mesh=new THREE.Mesh(g,metalMat(CHIXIAO_COLORS.blade,{...opts,roughness:.30,metalness:.84,vertexColors:true,flatShading:true}));mesh.castShadow=true;
  const gold=metalMat(CHIXIAO_COLORS.gold,{rough:.4});
  const ornaments=new THREE.Group();
  // Narrow gold cloud-scroll inlays lie against the bevel, on both faces.
  const surface=(x,y,side)=>{
    const t=(y+hy)/(2*hy),u=Math.min(.98,Math.abs(x)/(hx*width(t)));
    let h=u<.08?1-(u/.08)*.06:u<.76?.94-(u-.08)/.68*.64:.30*(1-u)/.24;
    return side*(hz*h*(1-.26*t)+.00028);
  };
  for(const side of [-1,1])for(const sign of [-1,1]){
    const pts=[];for(let i=0;i<=35;i++){const t=i/35,y=-hy+.012+t*.135,x=sign*(.009+.0025*Math.sin(t*Math.PI*6));pts.push([x,y,surface(x,y,side)]);}
    line(ornaments,pts,.00032,gold,48);
    for(let j=0;j<3;j++){
      const cy=-hy+.035+j*.037,pts=[];for(let i=0;i<=20;i++){const a=i/20*Math.PI*1.65,r=.0033*(1-i/25),x=sign*(.012+r*Math.cos(a)),y=cy+r*Math.sin(a);pts.push([x,y,surface(x,y,side)]);}line(ornaments,pts,.00036,gold,20);
    }
  }
  mesh.add(compact(ornaments));mesh.name='chixiaoRedBlade';return mesh;
}
function grip(shape) {
  const [,r,h]=shape,g=new THREE.Group();
  const black=new THREE.MeshStandardMaterial({color:0x3b3231,roughness:.82});
  const red=new THREE.MeshStandardMaterial({color:0x77322e,roughness:.85});
  const gold=metalMat(CHIXIAO_COLORS.gold,{rough:.4});
  const body=add(g,new THREE.CylinderGeometry(r*.94,r*.98,h*2,12),black);body.scale.z=.8;
  for(const sign of [-1,1]){
    const pts=[];for(let i=0;i<=120;i++){const t=i/120,a=sign*t*Math.PI*2*5+(sign<0?Math.PI:0);pts.push([Math.cos(a)*r,-h+.009+t*(2*h-.018),Math.sin(a)*r*.81]);}
    line(g,pts,.0012,red,120);
  }
  for(const y of [-h+.005,h-.005]){
    const ring=add(g,new THREE.CylinderGeometry(r*1.05,r*1.05,.010,16),gold,[0,y,0]);ring.scale.z=.84;
    for(const dy of [-.004,.004]){const rim=add(g,new THREE.TorusGeometry(r*1.055,.00055,4,16),gold,[0,y+dy,0]);rim.rotation.x=Math.PI/2;rim.scale.y=.84;}
  }
  return compact(g);
}
function guard() {
  const g=new THREE.Group(),gold=metalMat(CHIXIAO_COLORS.gold,{rough:.37});
  const dark=metalMat(0x564632,{rough:.55});
  const jade=new THREE.MeshStandardMaterial({color:0xe1ddc9,roughness:.32,metalness:.08});
  const outline=[[-.063,-.012],[-.065,.002],[-.054,.009],[-.041,.010],[-.031,.017],[-.018,.014],[-.011,.019],[.011,.019],[.018,.014],[.031,.017],[.041,.010],[.054,.009],[.065,.002],[.063,-.012],[.033,-.008],[.020,-.012],[-.020,-.012],[-.033,-.008]];
  add(g,relief(outline,.018,.0012,true),gold);
  const cloud=[[.016,-.005],[.022,.002],[.021,.008],[.026,.011],[.032,.009],[.033,.004],[.039,.002],[.042,.005],[.049,.004],[.052,.000],[.059,-.003],[.057,-.007],[.044,-.004],[.036,-.005],[.029,-.001],[.024,-.006]];
  for(const side of [-1,1]){
    for(const sign of [-1,1]){
      add(g,relief(cloud.map(([x,y])=>[x*sign,y]),.0028,.0012,true),jade,[0,0,side*.0109]);
      for(const [x,y,r]of [[.027,.005,.0045],[.040,.001,.0035],[.049,-.001,.003]]){
        const bead=add(g,new THREE.SphereGeometry(r,12,8),jade,[x*sign,y,side*.012]);bead.scale.z=.50;
      }
      const scroll=[[.025,.005],[.027,.007],[.030,.005],[.028,.002],[.024,.003]];
      line(g,scroll.map(([x,y])=>[x*sign,y,side*.0132]),.00038,gold,18);
    }
    const lozenge=add(g,new THREE.BoxGeometry(.019,.022,.002),dark,[0,.002,side*.0105]);lozenge.rotation.z=.20;
    const pts=[[-.006,-.003],[-.006,.010],[.006,.010],[.006,-.004],[-.002,-.004],[-.002,.005],[.002,.005],[.002,0]];
    line(g,pts.map(([x,y])=>[x,y,side*.0119]),.00055,gold,32);
  }
  return compact(g);
}
function pommel() {
  const g=new THREE.Group(),gold=metalMat(CHIXIAO_COLORS.gold,{rough:.36});
  const red=metalMat(0x6d302b,{rough:.48});
  const disk=(r,d,mat,z)=>{const m=add(g,new THREE.CylinderGeometry(r,r,d,24),mat,[0,0,z]);m.rotation.x=Math.PI/2;return m;};
  disk(.023,.018,gold,0);
  for(const side of [-1,1]){
    disk(.0192,.0014,red,side*.0095);
    add(g,new THREE.TorusGeometry(.0205,.0008,5,24),gold,[0,0,side*.010]);
    for(let k=0;k<4;k++){
      const pts=[];for(let i=0;i<=16;i++){const a=k*Math.PI/2+i/16*Math.PI*1.6,r=.011*(1-i/22);pts.push([Math.cos(a)*r,Math.sin(a)*r,side*.0106]);}line(g,pts,.00058,gold,20);
    }
  }
  return compact(g);
}
export function chixiaoPartMesh(index,isBlade,shape,color,opts) {
  if(isBlade)return blade(shape,opts);
  return index===0?grip(shape):index===1?pommel():guard();
}

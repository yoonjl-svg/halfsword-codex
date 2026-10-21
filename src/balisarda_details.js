// 발리사르다 — 승인된 10/21 시안의 은·금 덩굴형 코등이와 상아색 감개.
// 문학 속 능력은 설명의 출처이고, 이 르네상스식 외형은 게임을 위한 창작이다.
// 물리는 레이피어와 같다. 바구니 틈을 개별 충돌로 풀지 않는 기존 코등이 근사를 공유한다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { swordKit, metalMat } from './weapon_looks.js';

export const BALISARDA_COLORS = { grip: 0xe1d6b8, hilt: 0xc6b17a, blade: 0xdce1e0 };
const V = (p) => new THREE.Vector3(...p);
const kit = swordKit({
  blade: { edge: 'double', width: t => 1 - .4 * t, thick: .0045, bevel: .0015, tip: 'needle', tipLen: .12 },
});
function add(g, geo, mat, pos = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.castShadow = true; g.add(m); return m;
}
function line(g, points, radius, mat, segments = 24) {
  return add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(V)), segments, radius, 5, false), mat);
}
function band(g, y, radius, height, mat) {
  return add(g, new THREE.CylinderGeometry(radius, radius, height, 12), mat, [0, y, 0]);
}
// Closed, faceted ribbon with real thickness; open spaces stay transparent from both sides.
function ribbon(g, points, width, mat, edgeMat) {
  const curve = new THREE.CatmullRomCurve3(points.map(V)), rings = [], edge = [], verts = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28, p = curve.getPoint(t), tangent = curve.getTangent(t);
    const side = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
    const normal = new THREE.Vector3().crossVectors(tangent, side).normalize();
    const w = width * (.60 + .40 * Math.sin(t * Math.PI));
    rings.push([[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b]) => p.clone().addScaledVector(side,a*w/2).addScaledVector(normal,b*.0012)));
    edge.push(p.clone().addScaledVector(side,w/2));
  }
  const tri=(a,b,c)=>verts.push(...a.toArray(),...b.toArray(),...c.toArray());
  for(let i=1;i<rings.length;i++) for(let k=0;k<4;k++) {
    const a=rings[i-1][k],b=rings[i][k],c=rings[i][(k+1)%4],d=rings[i-1][(k+1)%4]; tri(a,b,c);tri(a,c,d);
  }
  for (const [r,rev] of [[rings[0],true],[rings.at(-1),false]]) {
    if(rev){tri(r[2],r[1],r[0]);tri(r[3],r[2],r[0]);}else{tri(r[0],r[1],r[2]);tri(r[0],r[2],r[3]);}
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.computeVertexNormals();add(g,geo,mat);
  if(edgeMat) line(g,edge.map(p=>p.toArray()),.0007,edgeMat,28);
}
// Merge the decorative pieces by material: the tiny leaves must not cost one draw call each.
function compact(g) {
  const bins = new Map();g.updateMatrixWorld(true);
  g.traverse(m=>{if(!m.isMesh)return;let geo=m.geometry.clone();geo.applyMatrix4(m.matrixWorld);geo.deleteAttribute('uv');if(!m.material.vertexColors)geo.deleteAttribute('color');if(geo.index){const old=geo;geo=geo.toNonIndexed();old.dispose();}const a=bins.get(m.material)||[];a.push(geo);bins.set(m.material,a);});
  const result=new THREE.Group();
  for(const [mat,geos]of bins){add(result,mergeGeometries(geos),mat);for(const geo of geos)geo.dispose();}
  g.traverse(m=>{if(m.isMesh)m.geometry.dispose();});return result;
}
function grip() {
  const g=new THREE.Group(), ivory=new THREE.MeshStandardMaterial({color:BALISARDA_COLORS.grip,roughness:.70,flatShading:true}), seam=new THREE.MeshStandardMaterial({color:0xbcb095,roughness:.78}),gold=metalMat(0xc5a76b,{rough:.30});
  add(g,new THREE.CylinderGeometry(.013,.0145,.106,10),ivory);
  const helix=[];for(let i=0;i<=100;i++){const t=i/100,a=t*Math.PI*2*6.25,r=.0147-.0015*t;helix.push([Math.cos(a)*r,-.050+t*.100,Math.sin(a)*r]);}
  line(g,helix,.00065,seam,100);
  band(g,-.052,.0155,.004,gold);band(g,.052,.015,.004,gold);
  return compact(g);
}
function pommel() {
  const g=new THREE.Group(),silver=metalMat(0xd0d1ca,{rough:.30,flatShading:true}),gold=metalMat(0xc1a366,{rough:.30});
  const profile=[[-.024,.002],[-.019,.008],[-.008,.017],[.004,.018],[.016,.011],[.020,.008]].map(([y,r])=>new THREE.Vector2(r,y));
  add(g,new THREE.LatheGeometry(profile,8),silver);band(g,.016,.0105,.003,gold);band(g,.021,.010,.004,gold);
  const tip=add(g,new THREE.OctahedronGeometry(.0065),gold,[0,-.024,0]);tip.scale.y=1.2;
  return compact(g);
}
function guard() {
  const g=new THREE.Group(),gold=metalMat(0xc6a25c,{rough:.28,flatShading:true}),silver=metalMat(0xd5d7d0,{rough:.27,flatShading:true});
  // Coordinates relative to the guard collider, whose centre is y=.06.
  band(g,.012,.0125,.035,silver); // 연속된 목: 감개 윗끝(.055)과 코등이(.09)를 연결
  band(g,.030,.018,.012,gold);
  line(g,[[-.101,.034,0],[-.045,.032,0],[0,.030,0],[.048,.028,0],[.101,.025,0]],.0038,gold,16);
  for(const [x,y]of[[-.104,.034],[.104,.025]]){const tip=add(g,new THREE.OctahedronGeometry(.009),silver,[x,y,0]);tip.scale.set(1.3,.8,.8);}
  // One long knuckle bow, then two swept ribbons that cross at different depths.
  ribbon(g,[[0,-.118,0],[-.047,-.088,.004],[-.061,-.027,.007],[-.047,.021,.003],[0,.030,0]],.012,gold,silver);
  ribbon(g,[[.002,-.112,.004],[.048,-.075,.025],[.052,-.015,.032],[.026,.044,.018],[-.026,.053,.008],[-.040,.023,-.002]],.011,silver,gold);
  ribbon(g,[[-.041,.021,-.007],[-.011,.048,-.025],[.045,.015,-.033],[.065,-.026,-.015],[.042,-.055,.019],[.009,-.032,.028],[0,.030,0]],.010,gold,silver);
  // Small finger ring beside the ricasso; unlike the old cup it remains an open loop.
  line(g,[[0,.028,0],[.025,.045,0],[.029,.067,0],[.014,.076,0],[0,.049,0]],.0025,silver,22);
  return compact(g);
}
function blade(args) {
  const g=new THREE.Group(),m=kit(...args);
  const half=args[2][2],gold=metalMat(0xb59a61,{rough:.42});
  // Restrained gilt sprig on both faces, placed in the lower fifth of the blade.
  for(const side of[-1,1]) {
    const z=side*.0047,base=-half+.018;
    line(g,[[0,base,z],[-.0008,base+.05,z],[.0005,base+.115,z],[0,base+.18,z]],.00045,gold,24);
    for(let i=0;i<7;i++) {
      const s=i%2?-1:1,y=base+.022+i*.020;
      const leaf=new THREE.BufferGeometry();
      leaf.setAttribute('position',new THREE.Float32BufferAttribute([0,y,z,s*.0034,y+.006,z+.0003*side,s*.0046,y+.014,z, s*.0014,y+.010,z+.0003*side],3));
      leaf.setIndex(side>0?[0,1,2,0,2,3]:[2,1,0,3,2,0]);leaf.computeVertexNormals();add(g,leaf,gold);
    }
  }
  // Keep the blade itself as the root Mesh for bloodyBlade() and attachAura().
  m.add(compact(g));
  return m;
}
export function balisardaPartMesh(...args) {
  const [index,isBlade]=args;
  if(isBlade)return blade(args);
  if(index===0)return grip();
  if(index===1)return pommel();
  if(index===2)return guard();
}

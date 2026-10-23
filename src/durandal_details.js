// 뒤랑달: 붉은 가죽과 금빛 성물함. 전승을 몬탄테 양손 비례로 각색한 게임 모델.
// 기존 네 부품의 콜라이더 안에 그리며, 피 묻음용 칼날 뿌리는 Mesh로 유지한다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { swordKit, metalMat } from './weapon_looks.js';

export const DURANDAL_COLORS = { grip: 0x713e42, hilt: 0xba995b, blade: 0xd1d7dc };
const kit = swordKit({ blade: { edge: 'double', width: t => 1 - .27 * t,
  thick: .0045, overshoot: 0, tip: 'spear', tipLen: .13,
  fuller: { to: .64, width: .23, depth: .5 } } });
const vec = p => new THREE.Vector3(...p);
function add(g, geo, mat, p = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat); m.position.set(...p); m.castShadow = true; g.add(m); return m;
}
function bar(g, a, b, r, mat, sides = 6) {
  const d = vec(b).sub(vec(a)), m = add(g, new THREE.CylinderGeometry(r, r, d.length(), sides), mat);
  m.position.copy(vec(a).add(vec(b)).multiplyScalar(.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m;
}
function slab(points, depth) {
  const s = new THREE.Shape(); points.forEach(([x,y], i) => i ? s.lineTo(x,y) : s.moveTo(x,y)); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); g.translate(0,0,-depth/2); return g;
}
function compact(group) {
  group.updateMatrixWorld(true); const bins = new Map();
  group.traverse(m => {
    if (!m.isMesh) return;
    let g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld); g.deleteAttribute('uv');
    if (g.index) { const prev = g; g = g.toNonIndexed(); prev.dispose(); }
    const list = bins.get(m.material) || []; list.push(g); bins.set(m.material, list);
  });
  const result = new THREE.Group();
  for (const [mat, geos] of bins) { add(result, mergeGeometries(geos), mat); geos.forEach(g => g.dispose()); }
  group.traverse(m => { if (m.isMesh) m.geometry.dispose(); }); return result;
}
function grip(shape) {
  const g = new THREE.Group(), H = shape[2], R = shape[1];
  const red = new THREE.MeshStandardMaterial({ color: DURANDAL_COLORS.grip, roughness: .83, flatShading: true });
  const seam = new THREE.MeshStandardMaterial({ color: 0x482c31, roughness: .95 });
  const gold = metalMat(DURANDAL_COLORS.hilt, { rough: .35 });
  const body = add(g, new THREE.CylinderGeometry(R*.91,R*.95,H*2,12),red); body.scale.z = .88;
  const points = [], turns = H*2/.029;
  for (let i=0;i<=144;i++) { const t=i/144, a=t*Math.PI*2*turns, r=R*(.95-.04*t)+.0002;
    points.push(vec([Math.cos(a)*r,-H+.006+t*(2*H-.012),Math.sin(a)*r*.88])); }
  add(g,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),144,.00065,4,false),seam);
  for (const y of [-H+.006, -H*.08, H-.006]) {
    const ring=add(g,new THREE.CylinderGeometry(R*.98,R*.98,.009,12),gold,[0,y,0]); ring.scale.z=.9;
    for (const z of [-1,1]) for(const dx of [-.008,0,.008])
      add(g,new THREE.BoxGeometry(.002,.002,.0007),seam,[dx,y,z*R*.9]);
  }
  return compact(g);
}
function pommel(shape) {
  const g=new THREE.Group(), r=shape[1]*.91;
  const gold=metalMat(DURANDAL_COLORS.hilt,{rough:.32,flatShading:true});
  const shadow=metalMat(0x66502c,{rough:.48});
  const ivory=new THREE.MeshStandardMaterial({color:0xe1d5b6,roughness:.42,metalness:.18});
  const disk=(radius,depth,mat,z)=>{const m=add(g,new THREE.CylinderGeometry(radius,radius,depth,8),mat,[0,0,z]);m.rotation.x=Math.PI/2;m.rotation.y=Math.PI/8;return m;};
  disk(r,.021,gold,0);
  for(const side of [-1,1]) {
    disk(r*.80,.002,shadow,side*.0113); disk(r*.62,.002,ivory,side*.0128);
    const rim=add(g,new THREE.TorusGeometry(r*.78,.0013,4,8),gold,[0,0,side*.014]);rim.rotation.z=Math.PI/8;
    // 상아색 성물함 창을 금속 십자 격자로 감싼다.
    bar(g,[-r*.48,-r*.48,side*.0145],[r*.48,r*.48,side*.0145],.0016,gold);
    bar(g,[-r*.48,r*.48,side*.0145],[r*.48,-r*.48,side*.0145],.0016,gold);
    for(let i=0;i<8;i++){const a=i*Math.PI/4+Math.PI/8;add(g,new THREE.SphereGeometry(.0011,6,4),shadow,[Math.cos(a)*r*.88,Math.sin(a)*r*.88,side*.011]);}
  }
  return compact(g);
}
function guard(shape) {
  const g=new THREE.Group(), scale=shape[1]/.14;
  const gold=metalMat(DURANDAL_COLORS.hilt,{rough:.33,flatShading:true});
  const pale=metalMat(0xd7bd7c,{rough:.35}), dark=metalMat(0x78603b,{rough:.48});
  const poly=[[-.14,-.016],[-.116,-.014],[-.038,-.010],[0,-.016],[.038,-.010],[.116,-.014],[.14,-.016],[.14,.016],[.116,.014],[.038,.010],[0,.016],[-.038,.010],[-.116,.014],[-.14,.016]];
  add(g,slab(poly.map(([x,y])=>[x*scale,y]),.022),gold);
  for(const side of [-1,1]) {
    for(const sign of [-1,1]) {
      bar(g,[sign*.036*scale,0,side*.0115],[sign*.118*scale,0,side*.0115],.0012,pale);
      add(g,slab([[-.011,0],[0,.011],[.011,0],[0,-.011]],.001),dark,[sign*.126*scale,0,side*.012]);
      add(g,slab([[-.006,0],[0,.006],[.006,0],[0,-.006]],.001),pale,[sign*.126*scale,0,side*.013]);
    }
    add(g,slab([[-.017,-.013],[.017,-.013],[.017,.013],[-.017,.013]],.002),dark,[0,0,side*.012]);
    add(g,slab([[0,.010],[.011,0],[0,-.010],[-.011,0]],.0015),pale,[0,0,side*.0135]);
  }
  return compact(g);
}
export function durandalPartMesh(index,isBlade,shape,color,matOpts,look,tier) {
  if(!isBlade) return index===0?grip(shape):index===1?pommel(shape):index===2?guard(shape):undefined;
  const mesh=kit(index,true,shape,DURANDAL_COLORS.blade,matOpts,look,tier);
  mesh.name='durandal-blade';
  const g=new THREE.Group(), gold=metalMat(DURANDAL_COLORS.hilt,{rough:.42}), y=-shape[2]+.055;
  for(const side of [-1,1]) {
    const z=side*.0048;
    bar(g,[0,y-.014,z],[0,y+.014,z],.00125,gold);
    bar(g,[-.010,y+.003,z],[.010,y+.003,z],.00125,gold);
    for(const sign of [-1,1])add(g,slab([[0,.003],[.003,0],[0,-.003],[-.003,0]],.0008),gold,[sign*.016,y,z]);
  }
  mesh.add(compact(g)); return mesh;
}

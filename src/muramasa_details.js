// 무라마사 — 10/21 승인 시안. 적갈색 감개·검은 각형 츠바·불규칙한 하몬.
// 이 외장은 도공 개인의 고유 장식 복원이 아닌 게임용 코시라에다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { swordKit, metalMat } from './weapon_looks.js';

export const MURAMASA_COLORS = { grip: 0x28272a, hilt: 0x28272b, blade: 0xaeb5bd };
// 사용자 확정: 날 길이는 등 밑동~칼끝의 직선, 소리는 그 직선~등의 최대 수직 거리.
export const MURAMASA_PROFILE = { length: .70, sori: .020, mass: 1.12, colliderHalfWidth: .024 };
const kit = swordKit({
  blade: { edge: 'single', width: t => 1-.28*t, thick: .0035, ridge: .3,
    hamon: true, hamonWave: (_t,y) => .31+.105*Math.sin(y*51)+.045*Math.sin(y*123+.8)+.023*Math.sin(y*89),
    curve: 0, tip: 'kissaki', tipLen: .05, overshoot: 0, segs: 52 },
  grip: { style: 'plain', color: MURAMASA_COLORS.grip },
  pommel: { style: 'cap', color: MURAMASA_COLORS.hilt },
});
function add(g,geo,mat,pos=[0,0,0]){const m=new THREE.Mesh(geo,mat);m.position.set(...pos);m.castShadow=true;g.add(m);return m;}
function tsuba() {
  const g=new THREE.Group(),shape=new THREE.Shape(),x=.039,z=.031,r=.010;
  shape.moveTo(-x+r,-z);shape.lineTo(x-r,-z);shape.quadraticCurveTo(x,-z,x,-z+r);
  shape.lineTo(x,z-r);shape.quadraticCurveTo(x,z,x-r,z);shape.lineTo(-x+r,z);
  shape.quadraticCurveTo(-x,z,-x,z-r);shape.lineTo(-x,-z+r);shape.quadraticCurveTo(-x,-z,-x+r,-z);
  const hole=new THREE.Path();hole.absellipse(0,0,.013,.0045,0,Math.PI*2,true);shape.holes.push(hole);
  const geo=new THREE.ExtrudeGeometry(shape,{depth:.007,bevelEnabled:true,bevelThickness:.001,bevelSize:.001,bevelSegments:1,curveSegments:4});
  geo.rotateX(Math.PI/2);geo.translate(0,.0035,0);
  add(g,geo,metalMat(0x28272b,{rough:.46,metal:.72}));
  return g;
}
export function muramasaPartMesh(...args){
  if(args[0]===2&&!args[1])return tsuba();
  if(args[1])args[2]=[...args[2].slice(0,1),.015,...args[2].slice(2)];
  const m=kit(...args);
  if(args[1]){
    // Warp only this blade. Preserve its cross-sections/hamon; measure sori on
    // the actual back, not a tip-offset setting or the centre line.
    const [,hx,hy]=args[2],L=hy*2,dx=.3*hx,spanY=Math.sqrt(L*L-dx*dx);
    const tTip=1-.05/L,apex=-.7*hx,p=m.geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      const t=Math.max(0,Math.min(1,(p.getY(i)+hy)/L));
      const rawBack=-hx*(1-.28*Math.min(t,tTip));
      const s=Math.max(0,(t-tTip)/(1-tTip));
      const back=rawBack+(apex-rawBack)*s*s*s;
      const target=-hx+dx*t+4*MURAMASA_PROFILE.sori*L/spanY*t*(1-t);
      // The shared hamon seam protrudes 0.5mm past the collapsed tip. Close it
      // here so the actual tip/back, including the seam, obey the dimensions.
      const x=t>1-1e-7?target:Math.max(back,p.getX(i))+target-back;
      p.setXYZ(i,x,-hy+t*spanY,t>1-1e-7?0:p.getZ(i));
    }
    p.needsUpdate=true;m.geometry.computeVertexNormals();
    m.geometry.computeBoundingBox();m.geometry.computeBoundingSphere();
    // Both blade faces have the same boundary, a frequent Muramasa trait.
    // Slightly stronger pale temper band, while the blade stays steel rather than a red glow.
    const colors=m.geometry.attributes.color;
    for(let i=0;i<colors.count;i++)if(colors.getX(i)>1.29)colors.setXYZ(i,1.43,1.45,1.48);
    colors.needsUpdate=true;
  }
  return m;
}
export function muramasaDecorate(group){
  const bronze=metalMat(0x9b7c51,{rough:.38}),iron=metalMat(0x2b292c,{rough:.45});
  add(group,new THREE.BoxGeometry(.034,.030,.011),bronze,[0,this.hiltLength+.012,0]);
  const fuchi=add(group,new THREE.CylinderGeometry(.0148,.0148,.008,14),iron,[0,.061,0]);fuchi.scale.z=1.2;
  for(const y of[.056,-.232]){const band=add(group,new THREE.CylinderGeometry(.015,.015,.0028,14),bronze,[0,y,0]);band.scale.z=1.2;}
  const cloth=new THREE.MeshStandardMaterial({color:0x793c37,roughness:.88,metalness:0});
  const geos=[],start=-.225,end=.045,pitch=.033;
  // Two flat helical tapes conform to the oval tsuka; straight boxes floated at the sides.
  for(const direction of [-1,1]){
    const verts=[],N=144,rings=[];
    for(let i=0;i<=N;i++){
      const y=start+(end-start)*i/N,a=direction*(y-start)/pitch*Math.PI*2+(direction===-1?Math.PI:0);
      const relief=direction===1?.00055:0;
      rings.push([[-1,0],[1,0],[1,1],[-1,1]].map(([side,out])=>[
        Math.cos(a)*(.0141+relief+out*.0008),
        Math.max(start,Math.min(end,y+side*.0055)),
        Math.sin(a)*(.0175+relief+out*.0008)]));
    }
    const tri=(a,b,c)=>direction===1?verts.push(...a,...b,...c):verts.push(...a,...c,...b);
    for(let i=1;i<rings.length;i++)for(let j=0;j<4;j++){
      const a=rings[i-1][j],b=rings[i][j],c=rings[i][(j+1)%4],d=rings[i-1][(j+1)%4];tri(a,b,c);tri(a,c,d);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.computeVertexNormals();geos.push(geo);
  }
  add(group,mergeGeometries(geos),cloth);for(const geo of geos)geo.dispose();
}

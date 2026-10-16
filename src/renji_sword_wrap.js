// Shared geometry from Kim's existing wrapped waist sword. No textures or external assets.
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const bake=(geo,pos,rot)=>{
 if(rot)geo.applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(...rot)));
 if(pos)geo.translate(...pos);return geo;
};
const cyl=(rt,rb,h,seg,open,pos)=>bake(new T.CylinderGeometry(rt,rb,h,seg,1,!!open),pos);
const ball=(r,w,h,pos)=>bake(new T.SphereGeometry(r,w,h),pos);
function taperedTube(pts,radii,tubular,radial){
 const curve=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p)));
 const geo=new T.TubeGeometry(curve,tubular,1,radial,false),pos=geo.attributes.position,last=radii.length-1,v=new T.Vector3(),c=new T.Vector3();
 for(let i=0;i<=tubular;i++){
  const u=i/tubular,f=u*last,k=Math.min(last-1,Math.floor(f)),r=radii[k]+(radii[k+1]-radii[k])*(f-k);
  curve.getPointAt(u,c);
  for(let j=0;j<=radial;j++){const n=i*(radial+1)+j;v.fromBufferAttribute(pos,n).sub(c).multiplyScalar(r).add(c);pos.setXYZ(n,v.x,v.y,v.z)}
 }
 geo.computeVertexNormals();return geo;
}

export function renjiSwordWrapGeometry(){
 const wrap=[cyl(.021,.019,.62,10,false,[0,-.3,0]),ball(.019,8,6,[0,-.61,0]),
  cyl(.037,.037,.03,12,false,[0,.017,0]),cyl(.019,.018,.165,10,false,[0,.1,0])];
 wrap.push(taperedTube([[.006,-.6,.012],[.012,-.64,.016],[.016,-.67,.012]],[.012,.009,.004],8,5));
 const cords=[];
 for(const y of [.165,.075,-.06,-.21,-.36,-.5])cords.push(bake(new T.TorusGeometry(y>.04?.0195:.0215,.0024,4,12),[0,y,0],[Math.PI/2+.3,0,0]));
 for(const y of [.075,-.21,-.5]){
  cords.push(ball(.0075,6,5,[.021,y,0]));
  cords.push(taperedTube([[.024,y,.004],[.03,y-.02,.008],[.032,y-.04,.006]],[.0022,.002,.0016],8,4));
 }
 return {wrap,cords};
}

export function drawBrothersSword(group){
 const {wrap,cords}=renjiSwordWrapGeometry();
 // Old prop points down. Bake the hand origin and 1.30 length scale into vertices,
 // so the existing break/disposal code sees ordinary, untransformed meshes.
 const add=(pieces,color,name,transform=true)=>{
  if(transform)for(const geo of pieces){geo.translate(0,-.1,0);geo.rotateZ(Math.PI);geo.scale(1,1.30,1)}
  const geo=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());
  const m=new T.Mesh(geo,new T.MeshStandardMaterial({color,roughness:.96,metalness:0}));
  m.name=name;m.castShadow=true;group.add(m);
 };
 add(wrap,0xd6cfbf,'renji-sword-wrap');add(cords,0x3f362c,'renji-sword-cords');
 // Shallow cloth overlaps, using the same low-poly rings as the existing ties.
 const folds=[];
 for(let i=0;i<13;i++)folds.push(bake(new T.TorusGeometry(.0207-i*.00010,.0011,3,10),[0,-.02-i*.044,0],[Math.PI/2+.23,0,0]));
 add(folds,0xbab2a2,'wrapped-sword-folds');
 add([cyl(.015,.015,.008,8,false,[0,.193,0])],0x9e8558,'wrapped-sword-pommel');
}

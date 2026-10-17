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

// Held variant: a flattened, closed scabbard under broad overlapping cloth.
// The original waist prop above remains unchanged.
export function drawBrothersSword(group){
 const profile=[[-1,-.65],[-.82,-1],[.82,-1],[1,-.65],[1,.65],[.82,1],[-.82,1],[-1,.65]];
 const section=y=>{
  const t=T.MathUtils.clamp((y-.12)/.81,0,1),end=T.MathUtils.smoothstep(t,.89,1);
  return {x:-.012*t*t,w:.031-.006*t-.005*end,d:.0108-.0015*t};
 };
 const add=(geo,color,name)=>{
  const m=new T.Mesh(geo,new T.MeshStandardMaterial({color,roughness:.97,metalness:0,side:T.DoubleSide}));
  m.name=name;m.castShadow=true;group.add(m);return m;
 };
 const shell=(levels,shape)=>{
  const p=[],ix=[];
  for(const y of levels){const s=shape(y);for(const [x,z]of profile)p.push(s.x+x*s.w,y,z*s.d)}
  for(let j=0;j<levels.length-1;j++)for(let i=0;i<8;i++){
   const a=j*8+i,b=j*8+(i+1)%8;ix.push(a,a+8,b,b,a+8,b+8);
  }
  for(const [j,flip]of [[0,false],[levels.length-1,true]])for(let i=1;i<7;i++){
   const a=j*8,b=a+i,c=b+1;ix.push(...(flip?[a,c,b]:[a,b,c]));
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();return g;
 };
 add(shell([.105,.15,.32,.52,.72,.86,.91,.933],section),0xd6cfbf,'renji-sword-wrap');
 add(shell([-.13,-.115,-.03,.065,.106],y=>({x:0,w:.0185+.001*Math.cos(y*20),d:.012})),0xd1c8b6,'wrapped-sword-grip');
 // A cloth-covered oval guard, not the round tsuba of a bamboo practice sword.
 add(shell([.102,.109,.122],()=>({x:0,w:.042,d:.014})),0xded7c9,'wrapped-sword-collar');
 // Seven broad, diagonal strips overlap the flat faces and turn around the edges.
 // Irregular pitch and soft seam tones avoid the evenly spaced dark bamboo rings.
 const p=[],ix=[],colors=[];
 for(let k=0;k<7;k++){
  const start=.145+k*.105+.006*Math.sin(k*2.7),width=.113+.012*Math.cos(k*1.9),first=p.length/3;
  for(let i=0;i<=8;i++)for(const side of [0,1]){
   const [x,z]=profile[i%8],y=T.MathUtils.clamp(start+i/8*.055+(side-.5)*width,.127,.931),s=section(y);
   p.push(s.x+x*(s.w+.0008),y,z*(s.d+.0011));
   const c=.965+.025*Math.sin(k*1.8)+(side?-.018:.006);colors.push(c,c,c);
  }
  for(let i=0;i<8;i++){const a=first+i*2;ix.push(a,a+1,a+2,a+1,a+3,a+2)}
 }
 const strips=new T.BufferGeometry();strips.setAttribute('position',new T.Float32BufferAttribute(p,3));strips.setAttribute('color',new T.Float32BufferAttribute(colors,3));strips.setIndex(ix);strips.computeVertexNormals();
 add(strips,0xe2dbce,'wrapped-sword-overlapping-cloth').material.vertexColors=true;
 const seams=[],seamIndex=[];
 for(let k=0;k<7;k++)for(const face of [-1,1]){
  const mid=.19+k*.104+.008*Math.sin(k*2.7),first=seams.length/3;
  for(const [edge,offset]of [[-1,-.002],[-1,.002],[1,-.002],[1,.002]]){
   const y=mid+edge*(.022+.005*Math.sin(k))+offset,s=section(y);
   seams.push(s.x+edge*s.w*.86,y,face*(s.d+.0018));
  }
  seamIndex.push(first,first+1,first+2,first+1,first+3,first+2);
 }
 const crease=new T.BufferGeometry();crease.setAttribute('position',new T.Float32BufferAttribute(seams,3));crease.setIndex(seamIndex);crease.computeVertexNormals();
 add(crease,0xa99f8e,'wrapped-sword-soft-creases');
 // A small tucked corner and two uneven grip ties; no repeated shaft hoops.
 const flap=new T.BufferGeometry();flap.setAttribute('position',new T.Float32BufferAttribute([.029,.78,.012,.048,.752,.014,.036,.715,.018,.026,.744,.013],3));flap.setIndex([0,1,2,0,2,3]);flap.computeVertexNormals();
 add(flap,0xdcd4c5,'wrapped-sword-tucked-corner');
 const ties=[];
 for(const y of [-.075,.035]){
  const geo=bake(new T.TorusGeometry(.0195,.0018,4,12),[0,y,0],[Math.PI/2+.16,0,0]);geo.scale(1,1,.67);ties.push(geo);
 }
 const knots=mergeGeometries(ties);ties.forEach(g=>g.dispose());add(knots,0xa49a87,'wrapped-sword-grip-ties');
}

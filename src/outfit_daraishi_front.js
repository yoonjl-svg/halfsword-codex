// V7 tailoring study, initially for the base character only. All geometry is
// cosmetic and part-local: no new body, mass, armor coverage or constraints.
export function createDaraishiFront(h) {
 const {THREE:T,artoriaCloth,addMerged,CLOTH,isoldeLock}=h;
 const ivory=0xe7dfcf,purple=0x433653,gold=0xc4ac78;
 const cloth={...CLOTH,roughness:.9,metalness:0,side:T.DoubleSide};
 const thread={...cloth,roughness:.77,metalness:.12};
 const line=(points,r=.0017)=>new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),Math.max(8,points.length*3),r,5,false);
 function frontSurface(g) {
  const {width:w,height:h,depth:d}=g.children[0].geometry.parameters,r=Math.min(.055,h/3);
  return (z,y,raise=.003)=>{
   const dy=Math.max(0,Math.abs(y)-(h/2-r)),dz=Math.max(0,Math.abs(z)-(d/2-r));
   const x=(w/2-r+Math.sqrt(Math.max(0,r*r-dy*dy-dz*dz)))*T.MathUtils.lerp(.96,1,T.MathUtils.clamp((y+h/2)/h,0,1));
   return [x+raise,y,z];
  };
 }
 function strip(path,width,surface,raise=.003) {
  const p=[],idx=[];
  for(let i=0;i<path.length;i++){
   const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
   const dz=-(b[1]-a[1])/len*width/2,dy=(b[0]-a[0])/len*width/2;
   for(const s of [-1,1])p.push(...surface(path[i][0]+s*dz,path[i][1]+s*dy,raise));
   if(i){const j=i*2;idx.push(j-2,j-1,j,j-1,j+1,j);}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setIndex(idx);geo.computeVertexNormals();return geo;
 }
 function collar(y,a,raise=.003) {
  const rows=[[.254,.072,.082],[.19,.079,.092],[.16,.127,.188],[.119,.14,.208],[.037,.14,.211]];
  let j=0;while(j<rows.length-2&&y<rows[j+1][0])j++;
  const u=T.MathUtils.clamp((rows[j][0]-y)/(rows[j][0]-rows[j+1][0]),0,1),rx=T.MathUtils.lerp(rows[j][1],rows[j+1][1],u),rz=T.MathUtils.lerp(rows[j][2],rows[j+1][2],u);
  const c=Math.cos(a),s=Math.sin(a),r=(Math.abs(c/rx)**4+Math.abs(s/rz)**4)**-.25,f=1+.008*Math.cos(a*8+(j+u)*.25);
  return [(r*f+raise)*c,y,(r*f+raise)*s];
 }
 function torso(g,part,look) {
  g.children[0].material.color.setHex(ivory);
  const layer=artoriaCloth(g,'silver-wanderer-front-tailoring'),surface=frontSurface(g);
  const band=[],stems=[],knots=[],folds=[];
  const chest=part==='chest',top=chest ? .122 : .068,bottom=chest ? -.128 : -.02;
  // A single gentle S follows the vertical center from chest to belt. The
  // abdomen continues the same curve after the 4 mm space between body parts.
  const zAt=y=>look.daraishiFront>=2
   ?.018*Math.sin(2*Math.PI*(chest ? .122-y : .254+.068-y)/.342)
   :chest?-.047+(.122-y)/.25*.11:.063+(.068-y)*.12;
  const path=Array.from({length:25},(_,i)=>{const y=T.MathUtils.lerp(top,bottom,i/24);return [zAt(y),y]});
  band.push(strip(path,.022,surface,.0045));
  // Slightly raised woven edge and its shadow give a real overlap at the seam.
  addMerged(layer,[strip(path.map(([z,y])=>[z+.013,y]),.004,surface,.0025)],0xb7ad99,cloth);
  stems.push(line(path.map(([z,y])=>surface(z-.008,y,.006)),.0013));
  if(chest) {
   for(const side of [-1,1])stems.push(line(Array.from({length:18},(_,i)=>collar(.245-i/17*.174,side*.61)),.0017));
   // Three small cord-and-knot closures lie on the upper front, above the hands.
   for(const y of [.077,.018,-.041]){
    const z=zAt(y);
    knots.push(line([[z-.028,y],[z-.018,y+.006],[z+.017,y+.005],[z+.025,y],[z+.016,y-.005],[z-.017,y-.005],[z-.028,y]].map(([u,v])=>surface(u,v,.007)),.0028));
    const knot=new T.SphereGeometry(.0057,8,5);knot.scale(.65,1,1.3);knot.translate(...surface(z-.028,y,.008));knots.push(knot);
   }
   // A few paired leaves echo the existing eight-petal badges without adding
   // another heraldic plate. The large plum seam reads at combat distance.
   for(const y of [.102,.048,-.010,-.071])for(const side of [-1,1]){
    const stem=Array.from({length:7},(_,i)=>{const t=i/6,v=y+t*.018,z=zAt(look.daraishiFront>=2?v:y);return surface(z+side*(.001+.007*Math.sin(t*Math.PI)),v,.0068)});
    stems.push(line(stem,.00125));
   }
   // Shallow fabric ridges converge toward the belt, staying on the shirt.
   for(const [z0,z1,y0] of [[-.098,-.052,.025],[-.14,-.075,-.03],[.125,.103,-.015]]){
    const points=Array.from({length:17},(_,i)=>{const t=i/16;return [T.MathUtils.lerp(z0,z1,t),T.MathUtils.lerp(y0,-.116,t)]});
    folds.push(strip(points,.013,(z,y,raise)=>surface(z,y,.002+raise*Math.sin(Math.PI*(y-y0)/(-.116-y0))),.003));
   }
  }
  addMerged(layer,band,purple,cloth);addMerged(layer,stems,gold,thread);addMerged(layer,knots,0x88745d,cloth);addMerged(layer,folds,0xeee7d9,cloth);
  layer.userData={cosmetic:true,frontStudy:1,closures:chest?3:0,folds:chest?3:0};
 }
 function hair(g,look) {
  const layer=artoriaCloth(g,'silver-wanderer-front-lock');
  const points=[[.032,.104,-.026],[.077,.079,-.031],[.105,.040,-.052],[.109,-.004,-.066],[.103,-.049,-.060],[.095,-.081,-.044]];
  addMerged(layer,[isoldeLock(points,[.019,.022,.018,.014,.007,.001],.0038)],look.hair,{...cloth,roughness:.63});
  const glint=points.slice(1,5).map(([x,y,z])=>[x+.0035,y,z-.003]);
  addMerged(layer,[isoldeLock(glint,[.002,.003,.002,.0003],.001)],look.hairPalette?.glint??0x9994a0,{...cloth,roughness:.68});
  layer.userData={cosmetic:true,frontStudy:1,locks:1};
 }
 function closeNeck(g,look) {
  // The open mantle previously exposed the rear hair through an empty neck.
  // A closed shirt yoke overlaps both the chest and a real skin-coloured neck.
  // Attach only to the cosmetic chest layer, with no collision/armor changes.
  const layer=artoriaCloth(g,'silver-wanderer-neck'),p=[],idx=[],n=20;
  const rows=[[.108,.106,.165],[.135,.095,.133],[.169,.056,.061],[.169,.046,.046]];
  for(let j=0;j<rows.length;j++)for(let i=0;i<=n;i++){
   const a=i/n*Math.PI*2,[y,rx,rz]=rows[j];p.push(rx*Math.cos(a),y,rz*Math.sin(a));
   if(j&&i){const k=j*(n+1)+i;idx.push(k-n-2,k-1,k-n-1,k-n-1,k-1,k);}
  }
  const yoke=new T.BufferGeometry();yoke.setAttribute('position',new T.Float32BufferAttribute(p,3));yoke.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(p.length/3*2),2));yoke.setIndex(idx);yoke.computeVertexNormals();
  addMerged(layer,[yoke],ivory,cloth);
  const neck=new T.CylinderGeometry(.043,.052,.10,16);neck.translate(0,.177,0);
  addMerged(layer,[neck],look.skin,{...cloth,roughness:.82});
  layer.userData={cosmetic:true,neckClosure:true};
 }
 function slimSides(g) {
  // Compress only the lateral bulge of the existing head-attached hair.
  // Crown, face, central rear braid and approved new fringe stay untouched.
  const layer=g.getObjectByName('silver-wanderer-hair');if(!layer)return;
  for(const mesh of layer.children){
   const geo=mesh.geometry,p=geo?.attributes.position;if(!p)continue;
   for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.abs(z);
    const weight=T.MathUtils.smoothstep(.075-y,0,.12)
      *(1-T.MathUtils.smoothstep(-y,.24,.38))*T.MathUtils.smoothstep(x,-.23,-.08);
    p.setZ(i,z-Math.sign(z)*Math.max(0,a-.075)*.4*weight);
   }
   geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();
  }
 }
 return (g,look,part)=>{
  if(![1,2].includes(look?.daraishiFront)||look.alter)return;
  if(part==='head'){if(look.daraishiFront>=2)slimSides(g);hair(g,look);}
  else if(part==='chest'||part==='abdomen'){torso(g,part,look);if(part==='chest'&&look.daraishiNeck)closeNeck(g,look);}
 };
}

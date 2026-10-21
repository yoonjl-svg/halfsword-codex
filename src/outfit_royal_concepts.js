// Native articulated models of the owner's second and third concept sheets.
// Armor and cloth attach to the existing body parts; no motor/body scaling.
import {createReturnedKingOutfitV2} from './outfit_returned_king_v2.js';
export function createRoyalConceptOutfit(h,kind){
 const {THREE,bake,box,cyl,ball,addMerged,artoriaCloth,taperedTube,quietFace,clothNeck}=h;
 const black=kind==='black',STEEL=black?0x303b3e:0x697b8b,GOLD=0xad8849,LIGHT=0xd4b373,DARK=0x242725,TEXTILE=black?0x164653:0x6b2933;
 const metal={metalness:.72,roughness:.38,steel:.82},cloth={roughness:.95,metalness:0,side:THREE.DoubleSide};
 const palette=new Map([[0xd7cfba,STEEL],[0x541f2a,TEXTILE],[0x443a2a,DARK]]);
 const foundation=createReturnedKingOutfitV2({...h,addMerged:(g,p,c,m)=>addMerged(g,p,palette.get(c)??c,m)});
 const add=(g,p,c=STEEL,m=metal)=>addMerged(g,p,c,m),v=p=>new THREE.Vector3(...p);
 const curve=(p,r=.002,n=16)=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p.map(v)),n,r,4,false);
 function mesh(p,uv,ix){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(ix);geo.computeVertexNormals();return geo;}
 function sample(rows,y){let i=0;while(i<rows.length-2&&y>rows[i+1][0])i++;const a=rows[i],b=rows[i+1],t=THREE.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1);return a.map((x,j)=>x+(b[j]-x)*t);}
 function at(rows,y,a,lift=0){const[,d,w,x=0]=sample(rows,y),c=Math.cos(a);return[x+(d+lift)*Math.sign(c)*Math.pow(Math.abs(c),.8),y,(w+lift)*Math.sin(a)];}
 function surface(rows,y,z,lift=.003){const[,d,w,x=0]=sample(rows,y);return[x+d*Math.pow(Math.max(0,1-(z/w)**2),.4)+lift,y,z];}
 function shell(rows,a0=-Math.PI,a1=Math.PI,N=32){const p=[],uv=[],ix=[];for(let j=0;j<rows.length;j++)for(let i=0;i<=N;i++){p.push(...at(rows,rows[j][0],a0+(a1-a0)*i/N));uv.push(i/N,j/(rows.length-1));if(j<rows.length-1&&i<N){const k=j*(N+1)+i;ix.push(k,k+N+1,k+1,k+1,k+N+1,k+N+2);}}return mesh(p,uv,ix);}
 const ring=(rows,y,a0=-Math.PI,a1=Math.PI,r=.0022,lift=0)=>curve(Array.from({length:33},(_,i)=>at(rows,y,a0+(a1-a0)*i/32,lift)),r,32);
 function patch(yz,fn){const cy=yz.reduce((s,p)=>s+p[0],0)/yz.length,cz=yz.reduce((s,p)=>s+p[1],0)/yz.length,p=[],uv=[],ix=[],N=5;for(let k=0;k<yz.length;k++){const a=yz[k],b=yz[(k+1)%yz.length],ids=[];for(let i=0;i<=N;i++){ids[i]=[];for(let j=0;j<=N-i;j++){const u=i/N,t=j/N,y=cy+(a[0]-cy)*u+(b[0]-cy)*t,z=cz+(a[1]-cz)*u+(b[1]-cz)*t;ids[i][j]=p.length/3;p.push(...fn(y,z));uv.push(z,y);}}for(let i=0;i<N;i++)for(let j=0;j<N-i;j++){ix.push(ids[i][j],ids[i+1][j],ids[i][j+1]);if(j<N-i-1)ix.push(ids[i+1][j],ids[i+1][j+1],ids[i][j+1]);}}return mesh(p,uv,ix);}
 const edge=(yz,fn,r=.002)=>curve([...yz,yz[0]].map(([y,z])=>fn(y,z)),r,yz.length*4);
 function base(g,rows){for(const child of g.children.slice(1))child.visible=false;const m=g.children[0];m.geometry.dispose();m.geometry=shell(rows);}
 function rosette(g,p,r=.025){const rim=add(g,[cyl(r,r,.007,16,false,p,[0,0,Math.PI/2])],GOLD);const f=(y,z)=>[p[0]+.006,y,z];star(rim,f,p[1],p[2],r*.78);add(rim,[ball(.004,8,5,[p[0]+.010,p[1],p[2]])],LIGHT);}
 function star(g,fn,y,z,r=.029){const yz=[];for(let i=0;i<16;i++){const a=i*Math.PI/8,rr=i%2?r*.32:r*(i%4===0?1:.67);yz.push([y+Math.cos(a)*rr,z+Math.sin(a)*rr]);}add(g,[patch(yz,fn)],GOLD,{...metal,side:THREE.DoubleSide});}
 function flourish(g,fn,y,z,H,sign=1){const lines=[],leaves=[];const stem=[];for(let i=0;i<=18;i++){const t=i/18;stem.push(fn(y+H*t,z+sign*.009*Math.sin(t*Math.PI*2)));}lines.push(curve(stem,.0011,18));for(let k=0;k<5;k++){const Y=y+H*(k+.4)/5,Z=z+sign*.009*Math.sin((k+.4)/5*Math.PI*2),s=k%2?sign:-sign;const yz=[[Y,Z],[Y+.005,Z+s*.017],[Y+.020,Z+s*.022],[Y+.012,Z+s*.005]];leaves.push(patch(yz,fn));lines.push(curve([fn(Y,Z),fn(Y+.009,Z-s*.014),fn(Y+.019,Z-s*.011),fn(Y+.014,Z-s*.006)],.001,12));}add(g,[...leaves,...lines],GOLD,{...metal,side:THREE.DoubleSide});}
 function ribs(g,rows,angles){const lines=[];for(const a of angles)lines.push(curve(rows.map(([y])=>at(rows,y,a,.0035)),.0018,20));add(g,lines,GOLD);}
 function mantle(g){
  const layer=artoriaCloth(g,black?'black-king-teal-cape':'chain-hero-short-mantle');
  const length=black?1.20:.62,R=22,C=28,p=[],uv=[],ix=[],colors=[];
  const point=(t,u)=>{const width=black?.17+.18*Math.sin(Math.min(1,t*1.7)*Math.PI/2):.19+.10*Math.sin(t*Math.PI*.75);return[-.140-(black?.17:.10)*t-.019*Math.cos(u*14)*(.2+.8*t),.132-length*t+(black?.016:.006)*Math.cos(u*9)*t*t,u*width];};
  for(let j=0;j<=R;j++)for(let i=0;i<=C;i++){const t=j/R,u=i/C*2-1;p.push(...point(t,u));uv.push(i/C,t);const col=new THREE.Color(TEXTILE).multiplyScalar(.72+.22*(1+Math.cos(u*14))/2);colors.push(col.r,col.g,col.b);if(j<R&&i<C){const n=j*(C+1)+i;ix.push(n,n+1,n+C+1,n+1,n+C+2,n+C+1);}}
  const geo=mesh(p,uv,ix);geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));add(layer,[geo],0xffffff,{...cloth,vertexColors:true});
  const hems=[];for(const t of [.91,.965])hems.push(curve(Array.from({length:29},(_,i)=>{const p=point(t,i/14-1);p[0]-=.002;return p;}),.002,28));for(const u of [-.96,.96])hems.push(curve(Array.from({length:25},(_,i)=>{const p=point(i/24,u);p[0]-=.002;return p;}),.002,24));add(layer,hems,0xa58b52,cloth);
  if(black)for(let i=-3;i<=3;i++){const fn=(y,z)=>{const p=point(y,z);p[0]-=.003;return p;};const Y=.93,u=i*.24;add(layer,[curve([fn(Y-.025,u),fn(Y,u-.03),fn(Y+.015,u),fn(Y,u+.03),fn(Y-.025,u)],.0018,8)],GOLD,cloth);}

 }
 function face(g,look){
  quietFace(g,look,black?'minami':'omari');
  // Keep the game's eyes and face scale; cheek planes and locks make the ages distinct.
  const face=g.children[0],p=face.geometry.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i);if(y<-.025)p.setZ(i,p.getZ(i)*(black?.91:.97));}face.geometry.computeVertexNormals();
  const hair=[],shade=[];
  for(const sign of [-1,1]){
   const count=black?4:6;for(let i=0;i<count;i++){
    const z=sign*(.048+i*.008),Y=black?.074:.046;
    hair.push(taperedTube([[.047,Y,z],[.074,Y-.015,z*.88],[.066,Y-.037,z*.85],[.042,Y-.055,z]],[.010,.012,.009,.001],12,6));
   }
   if(!black)for(let i=0;i<6;i++){const z=sign*(.012+i*.010);hair.push(taperedTube([[.085,-.034,z],[.091,-.063,z*.9],[.068,-.109,z*.65]],[.009,.013,.002],14,6));}
  }
  if(!black){for(const sign of [-1,1])hair.push(taperedTube([[.115,-.034,0],[.113,-.042,sign*.025],[.096,-.049,sign*.042]],[.008,.008,.002],14,6));for(let i=-3;i<=3;i++)shade.push(curve([[.092,-.059,i*.009],[.083,-.084,i*.008],[.067,-.103,i*.006]],.0015,8));}
  else for(const sign of [-1,1])hair.push(curve([[.111,-.040,0],[.108,-.042,sign*.012],[.101,-.044,sign*.023]],.0018,10));
  add(g,hair,look.hair,cloth);add(g,shade,0x68665d,cloth);
 }
 function helmet(g,look){
  face(g,look);const helm=new THREE.Group();helm.name=black?'black-king-open-helmet':'chain-hero-open-helmet';helm.userData.pieces={};g.add(helm);g.userData.helmet=helm;
  const piece=(id,geos,c=STEEL,m=metal)=>{const group=new THREE.Group();group.name='concept-helm-'+id;helm.add(group);helm.userData.pieces[id]=group;const obj=add(group,geos,c,m);if(obj)obj.userData.base={color:c,roughness:m.roughness};return group;};
  const bowl=[[.043,.111,.115,-.012],[.087,.102,.109,-.014],[.126,.077,.081,-.017],[black?.172:.151,.006,.010,-.025]];
  piece('bowl',[shell(bowl,-Math.PI,Math.PI,32)]);piece('rim',[ring(bowl,.045,-Math.PI,Math.PI,.003)],GOLD);
  const tail=[[-.083,.095,.108,-.022],[-.035,.109,.121,-.023],[.049,.113,.117,-.014]];piece('nape',[shell(tail,.94,Math.PI*2-.94,32)]);
  const lines=[];for(const a of [-2.5,-1.7,-.85,0,.85,1.7,2.5])lines.push(curve(bowl.map(([y])=>at(bowl,y,a,.003)),.002,16));piece('ribs',lines,GOLD);
  // Raised visor with actual deep dark slots, leaving eyes, nose and cheeks open.
  const visor=[[.050,.127,.100,.002],[.094,.143,.099,-.002],[.131,.108,.086,-.009]];
  const vv=piece('visor',[shell(visor,-1.12,1.12,32)],black?STEEL:0x85919a);
  const vents=[];for(let i=-4;i<=4;i++){const z=i*.018,y=.070+.008*(1-Math.abs(i)/4);vents.push(curve([surface(visor,y,z,.003),surface(visor,.112,z*.91,.003)],.0031,2));}add(vv,vents,0x141c20,cloth);add(vv,[ring(visor,.051,-1.12,1.12,.003),ring(visor,.129,-1.12,1.12,.0022)],GOLD);
  for(const sign of [-1,1]){const h=piece('hinge'+sign,[cyl(.014,.014,.008,12,false,[.006,.048,sign*.119],[Math.PI/2,0,0])],GOLD);add(h,[ball(.004,8,5,[.006,.048,sign*.125])],LIGHT);}
  if(black){
   const shape=new THREE.Shape();shape.moveTo(-.025,.13);shape.lineTo(-.022,.220);shape.quadraticCurveTo(-.046,.255,-.026,.255);shape.lineTo(-.010,.243);shape.lineTo(0,.294);shape.lineTo(.010,.243);shape.lineTo(.026,.255);shape.quadraticCurveTo(.046,.255,.022,.220);shape.lineTo(.025,.13);shape.closePath();
   const crest=new THREE.ExtrudeGeometry(shape,{depth:.008,bevelEnabled:true,bevelSize:.0015,bevelThickness:.0015,bevelSegments:2,steps:1,curveSegments:10}),p=crest.attributes.position;for(let i=0;i<p.count;i++)p.setXYZ(i,.077+p.getZ(i)-.13*(p.getY(i)-.13),p.getY(i),p.getX(i));crest.computeVertexNormals();const plume=piece('crest',[crest],GOLD);
   // Broad feather vanes instead of thin horsehair strands used by Sebastian.
   const featherPiles=[[],[],[]],shafts=[];
   for(let i=0;i<18;i++){
    const t=(i+.5)/18,z=(t-.5)*.17,path=[[.006-i*.001,.166,z*.22],[-.055-i*.002,.255+.065*Math.sin(t*Math.PI)+.012*Math.sin(i*1.7),z],[-.173-i*.004,.220+.050*Math.sin(t*Math.PI),z*1.20],[-.265-.070*Math.sin(t*Math.PI),-.015+.095*Math.sin(t*Math.PI)+.012*Math.cos(i*1.4),z]];
    const spline=new THREE.CatmullRomCurve3(path.map(v)),p=[],uv=[],ix=[];
    // Closed, shallow diamond section: individual feather vanes have thickness
    // and a raised quill. This avoids overlapping coplanar sheets flickering.
    for(let j=0;j<=20;j++){
     const u=j/20,c=spline.getPoint(u),w=.019*Math.sin(Math.PI*u)**.65+.0001,depth=.0035*Math.sin(Math.PI*u)+.0002;
     for(const [y,z]of [[depth,0],[0,w],[-depth,0],[0,-w]]){p.push(c.x,c.y+y,c.z+z);uv.push(z/(w*2)+.5,u);}
     if(j<20)for(let k=0;k<4;k++){const a=j*4+k,b=j*4+(k+1)%4;ix.push(a,b,a+4,b,b+4,a+4);}
    }
    featherPiles[i%3].push(mesh(p,uv,ix));
   }for(let i=0;i<3;i++)add(plume,featherPiles[i],[0xe2ddd0,0xcac5b6,0xf0e9db][i],cloth);
  }else{
   piece('crest',[bake(new THREE.ConeGeometry(.027,.045,4),[-.024,.159,0],[0,Math.PI/4,0])],GOLD);
  }
 }
 function chest(g,look){
  const rows=[[-.146,.105,.142,0],[-.080,.128,.162,-.005],[.015,black?.140:.150,black?.177:.191,-.005],[.090,.126,black?.173:.185,-.006],[.144,.075,.112,0]];
  base(g,rows.map(([y,d,w,x])=>[y,d-.010,w-.010,x]));const lining=artoriaCloth(g,'concept-neck-lining');clothNeck(lining,look);mantle(g);add(g,[shell(rows,-Math.PI,Math.PI,40)]);
  const f=(y,z)=>surface(rows,y,z,.005),gorget=[[.113,.097,.105,0],[.155,.067,.074,0],[.179,.065,.071,0]];add(g,[shell(gorget)]);add(g,[ring(gorget,.119),ring(gorget,.174),ring(rows,-.144)],GOLD);
  for(const sign of [-1,1])rosette(g,f(.105,sign*.128),.026);
  if(black){
   // Five blue escutcheons, inspired by the concept's royal heraldry.
   for(const[y,z]of [[.054,0],[.001,-.048],[.001,0],[.001,.048],[-.055,0]]){
    const yz=[[y+.020,z-.018],[y+.021,z+.018],[y-.012,z+.016],[y-.027,z],[y-.012,z-.016]],shield=add(g,[patch(yz,f)],0x244a70,{...metal,side:THREE.DoubleSide});add(shield,[edge(yz,(y,z)=>surface(rows,y,z,.006),.0015)],GOLD);
    const studs=[];for(const[dy,dz]of [[.007,0],[-.005,-.006],[-.005,.006]])studs.push(ball(.0025,6,4,surface(rows,y+dy,z+dz,.009)));add(shield,studs,LIGHT);
   }
   for(const sign of [-1,1])flourish(g,f,-.118,sign*.105,.195,sign);
  }else{
   ribs(g,rows,[-2.8,-2.2,-1.5,-.9,-.52,-.25,0,.25,.52,.9,1.5,2.2,2.8]);star(g,f,.054,0,.039);
   const chain=[];for(let i=0;i<9;i++){const z=-.10+i*.025;chain.push(bake(new THREE.TorusGeometry(.007,.0015,4,8),surface(rows,.095-.025*(1-(z/.1)**2),z,.009),[0,Math.PI/2,i%2?.65:0]));}add(g,chain,GOLD);
  }
 }
 function shoulder(g,sign){
  const rows=[[-.030,.097,black?.100:.113,0],[.028,.102,black?.112:.127,0],[.099,.093,black?.108:.120,0],[.157,.046,.058,0],[.177,.007,.009,0]];
  const plate=add(g,[shell(rows,-Math.PI,Math.PI,32)]);add(plate,[ring(rows,-.029),ring(rows,.030,-Math.PI,Math.PI,.0015)],GOLD);
  const f=(y,z)=>surface(rows,y,z,.004);
  if(black){for(const s of [-1,1])flourish(plate,f,-.005,s*.039,.111,s);star(plate,f,.072,0,.027);
   const tip=taperedTube([[-.035,.091,sign*.052],[-.045,.166,sign*.062],[-.064,.208,sign*.050]],[.018,.016,.001],18,6);add(plate,[tip],GOLD);
  }else{
   ribs(plate,rows,[-2.6,-1.8,-.95,-.40,0,.40,.95,1.8,2.6]);
   // The short pale mantle follows the shoulder, including the game's lowered
   // resting arms; a fixed chest-space arch would float above those arms.
   const drape=[[.076,.104,.130,0],[.105,.098,.123,0],[.163,.050,.061,0],[.184,.008,.011,0]];
   add(plate,[shell(drape,-Math.PI,Math.PI,32)],0xbab8a6,cloth);
   add(plate,[ring(drape,.077,-Math.PI,Math.PI,.0025)],GOLD,cloth);
  }
  for(let i=0;i<2;i++){const y=-.042-i*.036,r=.085-i*.009,rows=[[y-.038,r-.008,r-.004,0],[y,r,r+.004,0]];const m=add(g,[shell(rows)]);add(m,[ring(rows,y-.037)],GOLD);}
  add(g,[shell([[-.158,.048,.049,0],[-.112,.060,.062,0],[-.086,.071,.074,0]])]);
 }
 function thigh(g){
  const fabric=artoriaCloth(g,'concept-tasset-lining');const clothRows=[[-.205,.078,.075,0],[.195,.086,.085,0]];add(fabric,[shell(clothRows)],TEXTILE,cloth);
  const count=black?4:5;for(let i=0;i<count;i++){
   const y=.193-i*.072,d=.103-i*.003,w=.088-i*.004,rows=[[y-.087,d-.007,w-.005,.002],[y,d,w,0]];
   const geo=shell(rows,-1.68,1.68,24),p=geo.attributes.position;for(let j=0;j<p.count;j++)p.setY(j,p.getY(j)-.020*(1-Math.min(1,Math.abs(p.getZ(j))/w)));geo.computeVertexNormals();const plate=add(g,[geo]);
   const fn=(Y,z)=>{const point=surface(rows,Y,z,.004);point[1]-=.020*(1-Math.min(1,Math.abs(z)/w));return point;};
   const edgePts=[];for(let j=0;j<=24;j++){const a=-1.68+j/24*3.36,q=at(rows,y-.086,a,.001);q[1]-=.02*(1-Math.min(1,Math.abs(q[2])/w));edgePts.push(q);}add(plate,[curve(edgePts,.0022,24)],GOLD);
   if(black){for(const s of [-1,1])flourish(plate,fn,y-.066,s*.036,.048,s);}else ribs(plate,rows,[-1.40,-.7,0,.7,1.40]);
  }
 }
 function frontTab(g){
  const layer=artoriaCloth(g,'concept-front-tabard'),p=[],uv=[],ix=[],R=18;
  for(let j=0;j<=R;j++)for(let k=0;k<2;k++){const t=j/R,w=black?.052:.071;let y=.0-.38*t;p.push(.132+.018*t+.004*Math.sin(t*11),y,(k?1:-1)*w);uv.push(k,t);if(j<R&&k===0){const n=j*2;ix.push(n,n+1,n+2,n+1,n+3,n+2);}}
  add(layer,[mesh(p,uv,ix)],TEXTILE,cloth);for(const sign of [-1,1])add(layer,[curve([[.134,0,sign*(black?.05:.069)],[.148,-.378,sign*(black?.05:.069)]],.002,4)],GOLD,cloth);
  const fn=(y,z)=>[.140-y*.04,y,z];if(black)flourish(layer,fn,-.33,0,.26);else{star(layer,fn,-.130,0,.027);star(layer,fn,-.290,0,.022);}
 }
 function chain(g){
  const layer=artoriaCloth(g,'chain-hero-left-shackle');
  // Open cuff and a short chain fixed to the off-hand forearm, not a new weapon.
  const links=[];for(let i=0;i<7;i++){const y=-.075-i*.025,z=-.068-.009*Math.sin(i*.6);links.push(bake(new THREE.TorusGeometry(.014,.003,6,12),[-.006,y,z],[0,i%2?Math.PI/2:0,.18], [1,1.3,1]));}
  add(layer,[bake(new THREE.TorusGeometry(.052,.006,6,20,Math.PI*1.73),[0,-.065,0],[Math.PI/2,0,0])],0x423e36);add(layer,links,0x4c4942);
 }
 return {
  ...foundation,head:helmet,chest,
  abdomen(g,l){foundation.abdomen(g,l);},
  pelvis(g,l){foundation.pelvis(g,l);frontTab(g);},
  uarmS(g){shoulder(g,1);},uarmO(g){shoulder(g,-1);},
  farmS(g,l){foundation.farmS(g,l);},farmO(g,l){foundation.farmO(g,l);if(!black)chain(g);},
  thighF:thigh,thighB:thigh,
  shinF(g,l){foundation.shinF(g,l);},shinB(g,l){foundation.shinB(g,l);},
 };
}

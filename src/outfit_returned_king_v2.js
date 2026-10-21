// Fitted, curved plate revision. All meshes remain on the native body parts;
// no skeletal scale, collider, motor, mass or school-animation edits.
export function createReturnedKingOutfitV2(h) {
  const {THREE,bake,box,cyl,ball,addMerged,artoriaCloth,taperedTube}=h;
  const IVORY=0xd7cfba,GOLD=0xad8848,LIGHT=0xd0b678,DARK=0x443a2a,WINE=0x541f2a;
  const metal={metalness:.73,roughness:.34,steel:.9},cloth={roughness:.96,metalness:0,side:THREE.DoubleSide};
  const add=(g,p,c=IVORY,m=metal)=>addMerged(g,p,c,m);
  const v=p=>new THREE.Vector3(...p);
  function mesh(pos,uv,idx){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;}
  function curve(points,r=.002,n=18){return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v)),n,r,5,false);}
  function line(a,b,r=.002){return curve([a,b],r,1);}
  // Ring profiles [height, front/back radius, side radius, forward offset].
  function sample(rows,y){let i=0;while(i<rows.length-2&&y>rows[i+1][0])i++;const a=rows[i],b=rows[i+1],t=THREE.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1);return a.map((x,j)=>THREE.MathUtils.lerp(x,b[j],t));}
  function surface(rows,y,z,lift=0){const [,d,w,x=0]=sample(rows,y),u=Math.min(1,Math.abs(z)/w);return [x+d*Math.pow(Math.max(0,1-u*u),.4)+lift,y,z];}
  function shell(rows,start=-Math.PI,end=Math.PI,segs=32){
    const p=[],uv=[],ix=[];
    for(let j=0;j<rows.length;j++)for(let i=0;i<=segs;i++){
      const [y,d,w,x=0]=rows[j],a=start+(end-start)*i/segs,c=Math.cos(a);
      p.push(x+d*Math.sign(c)*Math.pow(Math.abs(c),.8),y,w*Math.sin(a));uv.push(i/segs,j/(rows.length-1));
      if(j<rows.length-1&&i<segs){const n=j*(segs+1)+i;ix.push(n,n+segs+1,n+1,n+1,n+segs+1,n+segs+2);}
    }return mesh(p,uv,ix);
  }
  function ring(rows,y,start=-Math.PI,end=Math.PI,r=.0022){const [,d,w,x=0]=sample(rows,y),p=[];for(let i=0;i<=32;i++){const a=start+(end-start)*i/32,c=Math.cos(a);p.push([x+d*Math.sign(c)*Math.pow(Math.abs(c),.8),y,w*Math.sin(a)]);}return curve(p,r,32);}
  function patch(yz,fn){
    // Project subdivisions onto the curved plate, rather than sinking a flat
    // triangle chord through it. Essential for the shield, castle and engraving.
    const cy=yz.reduce((a,p)=>a+p[0],0)/yz.length,cz=yz.reduce((a,p)=>a+p[1],0)/yz.length,p=[],uv=[],ix=[];
    const span=Math.max(...yz.map(([y,z])=>Math.hypot(y-cy,z-cz))),N=span>.02?7:3;
    for(let k=0;k<yz.length;k++){
      const a=yz[k],b=yz[(k+1)%yz.length],ids=[];
      for(let i=0;i<=N;i++){ids[i]=[];for(let j=0;j<=N-i;j++){
        const u=i/N,w=j/N,y=cy+(a[0]-cy)*u+(b[0]-cy)*w,z=cz+(a[1]-cz)*u+(b[1]-cz)*w;
        ids[i][j]=p.length/3;p.push(...fn(y,z));uv.push(z,y);
      }}
      for(let i=0;i<N;i++)for(let j=0;j<N-i;j++){ix.push(ids[i][j],ids[i+1][j],ids[i][j+1]);if(j<N-i-1)ix.push(ids[i+1][j],ids[i+1][j+1],ids[i][j+1]);}
    }return mesh(p,uv,ix);
  }
  function edge(yz,fn,r=.002){return curve([...yz,yz[0]].map(([y,z])=>fn(y,z)),r,yz.length*4);}
  function leaf(y,z,dy,dz,fn){return patch([[y,z],[y+dy*.35-dz*.20,z+dz*.35+dy*.20],[y+dy,z+dz],[y+dy*.35+dz*.20,z+dz*.35-dy*.20]],fn);}
  function laurel(g,fn,y0,z0,length,side=1,scale=1){
    // Chased acanthus scrolls: a flowing stem, coiled tips and small paired leaves.
    const stem=[],leaves=[],curls=[];
    for(let i=0;i<=24;i++){const t=i/24;stem.push(fn(y0+length*t,z0+side*.016*scale*Math.sin(t*Math.PI*2)));}
    for(let i=0;i<5;i++){
      const t=(i+.3)/5,y=y0+length*t,z=z0+side*.016*scale*Math.sin(t*Math.PI*2),s=(i%2?1:-1)*side;
      const spiral=[];for(let j=0;j<=20;j++){const a=j/20*Math.PI*1.6,r=.012*scale*(1-j/25);spiral.push(fn(y+.008*scale+r*Math.sin(a),z+s*(.013*scale-r*Math.cos(a))));}
      curls.push(curve([fn(y,z),...spiral],.00095*scale,22));
      leaves.push(leaf(y,z,.017*scale,-s*.012*scale,fn),leaf(y+.011*scale,z+s*.004*scale,.011*scale,s*.010*scale,fn));
    }
    add(g,[curve(stem,.0011*scale,24),...curls,...leaves],GOLD,{...metal,side:THREE.DoubleSide});
  }
  // A very shallow pressed ridge: the plane either side remains broad and calm.
  function flute(geo,depth=.004,count=8){const p=geo.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),a=Math.atan2(z,x),r=Math.hypot(x,z);if(r<.001)continue;const d=depth*Math.pow(Math.max(0,Math.cos(count*a)),6);p.setX(i,x+x/r*d);p.setZ(i,z+z/r*d);}geo.computeVertexNormals();return geo;}
  function beading(g,rows,y,count=20){const beads=[];for(let i=0;i<count;i++){const a=-Math.PI+(i+.5)/count*Math.PI*2,[,d,w,x=0]=sample(rows,y);beads.push(ball(.0022,6,4,[x+d*Math.cos(a),y,w*Math.sin(a)]));}add(g,beads,LIGHT);}
  function mail(g,y,radius=.047){const links=[];for(let row=0;row<3;row++)for(let i=0;i<16;i++){const a=(i+(row%2)*.5)/16*Math.PI*2;links.push(bake(new THREE.TorusGeometry(.0045,.0009,3,7),[Math.cos(a)*radius,y-row*.0065,Math.sin(a)*radius],[0,Math.PI/2-a,row%2?.35:-.35]));}add(g,links,0x69675c,{metalness:.65,roughness:.52,steel:.6});}
  function rosette(g,x,y,z,r=.022){
    add(g,[cyl(r,r,.007,20,false,[x,y,z],[0,0,Math.PI/2])],GOLD);
    add(g,[cyl(r*.78,r*.78,.008,20,false,[x+.003,y,z],[0,0,Math.PI/2])],DARK);
    const p=[];for(let i=0;i<8;i++){const a=i*Math.PI/4;p.push(bake(ball(r*.23,6,4),[x+.010,y+Math.cos(a)*r*.48,z+Math.sin(a)*r*.48],null,[.35,1,1]));}p.push(ball(r*.20,8,5,[x+.010,y,z]));add(g,p,LIGHT);
  }
  function castle(g,fn,y,z,s=1){
    const gold=[],dark=[];
    for(const k of [-1,0,1]){
      const w=.012*s,h=(k===0?.040:.030)*s,Y=y+h/2,Z=z+k*.022*s;
      gold.push(patch([[y,Z-w/2],[y,Z+w/2],[y+h,Z+w/2],[y+h,Z-w/2]],fn));
      for(const a of [-1,1])gold.push(patch([[y+h,Z+a*w*.35-.002*s],[y+h+.006*s,Z+a*w*.35-.002*s],[y+h+.006*s,Z+a*w*.35+.002*s],[y+h,Z+a*w*.35+.002*s]],fn));
      const f=(Y,Z)=>{const p=fn(Y,Z);p[0]+=.001;return p;};
      dark.push(patch([[y+.004*s,Z-.003*s],[y+.019*s,Z-.003*s],[y+.023*s,Z],[y+.019*s,Z+.003*s],[y+.004*s,Z+.003*s]],f));
    }
    gold.push(patch([[y,z-.033*s],[y+.010*s,z-.033*s],[y+.010*s,z+.033*s],[y,z+.033*s]],fn));
    add(g,gold,LIGHT,{...metal,side:THREE.DoubleSide});add(g,dark,DARK,{...metal,side:THREE.DoubleSide});
  }
  function base(g,rows){for(const c of g.children.slice(1))c.visible=false;const m=g.children[0],geo=shell(rows);m.geometry.dispose();m.geometry=geo;}
  function cape(g){
    const layer=artoriaCloth(g,'returned-king-cape'),p=[],uv=[],ix=[],colors=[],R=24,C=32;
    const at=(t,u)=>{const w=.165+.132*Math.sin(Math.min(1,t*1.9)*Math.PI/2),fold=Math.cos(u*Math.PI*5+.3*u);return[-.137-.132*t-.023*fold*(.2+.8*t),.14-1.19*t+.017*Math.cos(u*8)*t*t,u*w];};
    for(let j=0;j<=R;j++)for(let i=0;i<=C;i++){
      const t=j/R,u=i/C*2-1;p.push(...at(t,u));uv.push(i/C,t);const c=new THREE.Color(WINE).multiplyScalar(.66+.27*(1+Math.cos(u*Math.PI*5+.3*u))/2);colors.push(c.r,c.g,c.b);
      if(j<R&&i<C){const n=j*(C+1)+i;ix.push(n,n+1,n+C+1,n+1,n+C+2,n+C+1);}
    }
    const geo=mesh(p,uv,ix);geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));add(layer,[geo],0xffffff,{...cloth,vertexColors:true}).name='returned-king-wine-cape';
    const trim=[];for(const t of [.905,.96,.982])trim.push(curve(Array.from({length:33},(_,i)=>{const p=at(t,i/16-1);p[0]-=.002;return p;}),.002,32));
    for(let k=-4;k<=4;k++){
      const u=k*.20,pts=[];for(let i=0;i<=16;i++){const a=i/16*Math.PI*2;const p=at(.932+.016*Math.cos(a),u+.035*Math.sin(a));p[0]-=.002;pts.push(p);}trim.push(curve(pts,.0015,16));
    }add(layer,trim,0x997b49,cloth);
  }
  function helmet(g){
    const helm=new THREE.Group();helm.name='returned-king-closed-helmet';helm.userData.pieces={};g.add(helm);g.userData.helmet=helm;
    const piece=(id,p,c=IVORY,m=metal)=>{const group=new THREE.Group();group.name='royal-helm-'+id;helm.add(group);helm.userData.pieces[id]=group;const o=add(group,p,c,m);if(o)o.userData.base={color:c,roughness:m.roughness};return group;};
    const rows=[[-.117,.079,.058,0],[-.095,.100,.079,-.007],[-.04,.115,.103,-.008],[.025,.119,.111,-.008],[.08,.103,.104,-.012],[.12,.073,.075,-.015],[.147,.010,.013,-.025]];
    piece('bowl',[flute(shell(rows),.0025,6)],IVORY);
    // The visor follows the face in several curved bands, instead of a flat slab.
    const visor=[[-.116,.099,.050,.003],[-.091,.124,.073,.004],[-.035,.151,.099,.004],[.022,.155,.104,.002],[.068,.138,.099,0],[.092,.116,.087,-.003]];
    const f=(y,z)=>surface(visor,y,z,.002);
    piece('visor',[shell(visor,-Math.PI/2,Math.PI/2,48)],IVORY,{...metal,side:THREE.DoubleSide});
    const rim=[curve(visor.map(([y,,w])=>f(y,-w)),.0025),curve(visor.map(([y,,w])=>f(y,w)),.0025),ring(visor,-.116,-Math.PI/2,Math.PI/2,.0025),curve([f(-.108,0),f(-.035,0),f(.024,0),f(.084,0)],.0022)];
    const brow=[];for(let i=0;i<=24;i++){const z=(i/12-1)*.097;brow.push(f(.055+.009*Math.abs(z)/.097,z));}rim.push(curve(brow,.0032,24));
    piece('trim',rim,GOLD);
    const slit=[];for(const s of [-1,1])slit.push(patch([[.043,s*.006],[.045,s*.087],[.025,s*.093],[.018,s*.006]],(y,z)=>{const p=f(y,z);p[0]+=.002;return p;}));piece('slit',slit,0x111210,{...cloth});
    const vents=[];for(const s of [-1,1])for(let i=0;i<4;i++){
      const y=-.019-i*.012,z=s*(.047-i*.005);vents.push(curve([f(y,z),f(y-.007,z+s*.003)],.0016,2));
    }piece('vents',vents,0x332c24,cloth);
    for(const s of [-1,1]){
      const hinge=piece('hinge'+s,[cyl(.016,.016,.007,16,false,[.002,.025,s*.112],[Math.PI/2,0,0])],GOLD);
      const p=[];for(let i=0;i<6;i++)p.push(ball(.0025,6,4,[.002+Math.cos(i*Math.PI/3)*.010,.025+Math.sin(i*Math.PI/3)*.010,s*.117]));add(hinge,p,LIGHT);
    }
    // User revision: no crown or red plume. An unkempt ivory horsehair crest,
    // close to the helmet's tone, with individually tapered, uneven locks.
    // The native 'crest' wear slot now refers to the horsehair, not a crown.
    const mane=[[],[],[]],noise=(i,k)=>(Math.sin(i*k+1.7)+1)/2;
    for(let i=0;i<68;i++){
      const s=i%2?1:-1,r=noise(i,2.399),q=noise(i,1.73),z=s*(.025+.112*r),height=.183+.073*q;
      const tail=.012+.125*noise(i,1.31),back=-.20-.13*noise(i,2.13),rootZ=(noise(i,3.7)-.5)*.105;
      const pts=[[-.035,.124,rootZ],[-.075,height*.87,rootZ*.6+z*.35],[-.146,height,z*.76],[back+.035,tail+.059,z*1.15],[back,tail,z*(.8+.4*q)]];
      mane[i%3].push(taperedTube(pts,[.004,.006+(i%3)*.0015,.006,.003,.0004],24,5));
      if(i%4===0)mane[2].push(taperedTube([pts[1],[-.108,height+.026,z*.65],[-.196,height*.79,z*1.3],[back-.028,tail+.039,z*1.4]],[.0018,.0028,.0015,.0002],22,4));
    }
    const hair=piece('crest',mane[0],0xc9c3b0,cloth);hair.name='royal-helm-ivory-horsehair';
    add(hair,mane[1],0xb7b19e,cloth);add(hair,mane[2],0xd9d3c2,cloth);
    const cheek=piece('engraving',[],GOLD); // populated below; own wear piece
    for(const s of [-1,1])laurel(cheek,(y,z)=>f(y,z),-.082,s*.061,.070,s,.46);
  }
  function shoulder(g){
    const cap=[[-.021,.088,.092,0],[.019,.100,.104,0],[.084,.094,.096,0],[.134,.056,.061,0],[.173,.009,.012,0]];
    const geo=flute(shell(cap),.003,10),p=geo.attributes.position;
    for(let i=0;i<p.count;i++){const y=p.getY(i),a=Math.atan2(p.getZ(i),p.getX(i));p.setY(i,y+(1-THREE.MathUtils.clamp((y+.021)/.155,0,1))*.016*Math.cos(2*a));}geo.computeVertexNormals();add(g,[geo]);
    const edgePts=[];for(let i=0;i<=40;i++){const a=i/40*Math.PI*2;edgePts.push([.089*Math.cos(a),-.021+.016*Math.cos(2*a),.093*Math.sin(a)]);}add(g,[curve(edgePts,.0023,40)],GOLD);
    // Two slim overlapping lames, then a long tapered rerebrace. No tire rings.
    for(let i=0;i<2;i++){const y=-.026-i*.032,r=.084-i*.009,rows=[[y-.038,r-.009,r-.008,0],[y,r,r,0]];add(g,[flute(shell(rows),.002,8)]);add(g,[ring(rows,y-.036,-Math.PI,Math.PI,.0015)],GOLD);}
    const arm=[[-.147,.047,.047,0],[-.101,.055,.055,0],[-.074,.065,.065,0]];add(g,[flute(shell(arm),.002,8)]);mail(g,-.140);
    const f=(y,z)=>surface(cap,y,z,.004);castle(g,f,.025,0,.86);
    for(const s of [-1,1])laurel(g,f,.002,s*.055,.085,s,.52);
    // A shallow chased leaf spray on the formerly bare shoulder crown. Keep
    // it inside the existing cap silhouette and its native armor bounds.
    const crown=(y,z)=>{
      const p=surface(cap,y,z,.003),a=Math.atan2(p[2],p[0]),r=Math.hypot(p[0],p[2]);
      const ridge=.003*Math.pow(Math.max(0,Math.cos(10*a)),6);
      p[0]+=p[0]/r*ridge;p[2]+=p[2]/r*ridge;
      p[1]+=(1-THREE.MathUtils.clamp((y+.021)/.155,0,1))*.016*Math.cos(2*a);
      return p;
    };
    const leaves=[leaf(.124,0,.034,0,crown)],stems=[curve([[.091,0],[.111,.003],[.137,-.002],[.158,0]].map(([y,z])=>crown(y,z)),.0012,22)];
    for(const s of [-1,1]){
      leaves.push(leaf(.112,s*.002,.019,s*.021,crown),leaf(.132,s*.002,.017,s*.012,crown));
      const scroll=[];for(let i=0;i<=22;i++){const t=i/22,a=t*Math.PI*1.65,r=.011*(1-t*.72);scroll.push(crown(.106+r*Math.sin(a),s*(.019-r*Math.cos(a))));}
      stems.push(curve([crown(.095,0),...scroll],.0011,24));
    }
    const ornament=add(g,[...leaves,...stems],GOLD,{...metal,side:THREE.DoubleSide});ornament.name='royal-shoulder-leaf-engraving';
    const rivets=[];for(const z of [-.065,-.036,0,.036,.065])rivets.push(ball(.0025,6,4,surface(cap,-.009,z,.004)));add(g,rivets,LIGHT);
  }
  function forearm(g){
    const rows=[[-.126,.046,.046,0],[-.087,.048,.048,0],[.035,.057,.056,0],[.101,.061,.060,0],[.127,.068,.064,0]];
    add(g,[flute(shell(rows),.0018,10)]);add(g,[ring(rows,-.125),ring(rows,.121),ring(rows,.111)],GOLD);beading(g,rows,.116,16);
    const f=(y,z)=>surface(rows,y,z,.002);add(g,[curve([f(-.115,0),f(-.02,0),f(.104,0)],.002)],GOLD);
    for(const s of [-1,1])laurel(g,f,-.060,s*.022,.125,s,.5);
    const elbow=[[-.005,.052,.054,0],[.020,.065,.068,-.006],[.055,.051,.054,0]];add(g,[bake(flute(shell(elbow),.0025,6),[0,.117,0])]);
  }
  function thigh(g){
    const layer=artoriaCloth(g,'royal-skirt');add(layer,[shell([[-.195,.071,.071,0],[.20,.078,.077,0]])],WINE,cloth);
    const rows=[[-.169,.075,.064,.004],[-.10,.084,.069,.003],[.05,.092,.077,.002],[.185,.090,.080,0]];
    add(g,[flute(shell(rows,-Math.PI*.65,Math.PI*.65),.0025,8)],IVORY,{...metal,side:THREE.DoubleSide});
    const f=(y,z)=>surface(rows,y,z,.003),edgePath=[[-.16,-.052],[-.168,0],[-.16,.052],[.15,.067],[.18,0],[.15,-.067]];
    add(g,[edge(edgePath,f)],GOLD);for(const s of [-1,1])laurel(g,f,-.135,s*.025,.225,s,.58);
    for(let i=0;i<2;i++){
      const y=.155-i*.051,r=.098-i*.004,w=.084-i*.003,short=[[y-.049,r-.003,w-.002,0],[y,r,w,0]];
      const geo=shell(short,-Math.PI*.52,Math.PI*.52),p=geo.attributes.position;
      for(let j=0;j<p.count;j++)p.setY(j,p.getY(j)-.015*(1-Math.min(1,Math.abs(p.getZ(j))/.084)));geo.computeVertexNormals();add(g,[geo],IVORY,{...metal,side:THREE.DoubleSide});
      const edgePts=[];for(let j=0;j<=24;j++){const a=-Math.PI*.52+j/24*Math.PI*1.04;edgePts.push([r*Math.cos(a),y-.047-.015*(1-Math.abs(Math.sin(a))),w*Math.sin(a)]);}add(g,[curve(edgePts,.002,24)],GOLD);
    }
  }
  function shin(g){
    const rows=[[-.185,.048,.044,0],[-.14,.050,.044,0],[-.03,.061,.052,-.002],[.10,.065,.056,-.002],[.15,.057,.052,0]];
    add(g,[flute(shell(rows),.0022,8)]);const f=(y,z)=>surface(rows,y,z,.004);
    for(const s of [-1,1])add(g,[curve([f(-.17,s*.023),f(-.04,s*.033),f(.13,s*.036)],.002)],GOLD);
    add(g,[curve([f(-.177,0),f(-.03,0),f(.14,0)],.003),ring(rows,-.181)],GOLD);
    // Pointed, articulated poleyn instead of a round ball at the knee.
    const knee=[[-.044,.061,.050,.018],[-.015,.079,.067,.014],[.028,.073,.058,.012],[.055,.052,.040,.010]];
    add(g,[bake(flute(shell(knee),.003,8),[0,.165,0])]);
    const kf=(y,z)=>{const p=surface(knee,y-.165,z,.006);p[1]=y;return p;};
    const shield=[[.217,0],[.188,.046],[.143,.044],[.120,0],[.143,-.044],[.188,-.046]];
    add(g,[patch(shield,kf)],IVORY,{...metal,side:THREE.DoubleSide});add(g,[edge(shield,kf,.0018)],GOLD);
    for(const s of [-1,1])laurel(g,kf,.139,s*.017,.060,s,.39);
    add(g,[curve([kf(.125,0),kf(.169,0),kf(.211,0)],.0018)],GOLD);
  }
  function foot(g){
    const base=g.children[0],old=base.geometry;
    base.geometry=bake(new THREE.SphereGeometry(1,20,12),[0,-.009,0],null,[.117,.028,.047]);old.dispose();
    const p=[],uv=[],ix=[],rings=[[-.115,.045,.032],[-.066,.052,.057],[0,.051,.061],[.075,.045,.042],[.137,.029,.023],[.151,.012,.016]],N=16;
    for(let j=0;j<rings.length;j++)for(let i=0;i<=N;i++){
      const[x,w,h]=rings[j],a=i/N*Math.PI;p.push(x,-.017+Math.sin(a)*(h+.014),w*Math.cos(a));uv.push(i/N,j/rings.length);
      if(j<rings.length-1&&i<N){const n=j*(N+1)+i;ix.push(n,n+N+1,n+1,n+1,n+N+1,n+N+2);}
    }
    const toe=[[-.017,-.012]];for(let i=0;i<=16;i++){const a=Math.PI-i/16*Math.PI;toe.push([-.017+Math.sin(a)*.030,.012*Math.cos(a)]);}toe.push([-.017,.012]);
    add(g,[mesh(p,uv,ix),patch(toe,(y,z)=>[.151,y,z])],IVORY,{...metal,side:THREE.DoubleSide});
    const trims=[];for(const x of [-.057,-.017,.023,.063,.102]){const r=rings.findIndex(a=>a[0]>x),a=rings[r-1],b=rings[r],t=(x-a[0])/(b[0]-a[0]),w=a[1]+(b[1]-a[1])*t,h=a[2]+(b[2]-a[2])*t+.014;trims.push(curve(Array.from({length:17},(_,i)=>[x,-.016+Math.sin(i/16*Math.PI)*h,w*Math.cos(i/16*Math.PI)]),.0014,16));}add(g,trims,GOLD);
  }
  return {
    armorParts:new Set(['chest','abdomen','pelvis','uarmS','uarmO','farmS','farmO','thighF','thighB','shinF','shinB','footF','footB']),head:helmet,
    neck(g){add(g,[shell([[-.04,.060,.060,0],[.020,.061,.064,0],[.037,.065,.067,0]])],DARK);},
    chest(g){
      const rows=[[-.148,.102,.140,0],[-.092,.123,.153,-.005],[-.015,.142,.180,-.006],[.065,.134,.184,-.009],[.115,.104,.165,-.010],[.142,.076,.113,-.009]];
      base(g,rows.map(([y,d,w,x])=>[y,d-.009,w-.009,x]));cape(g);
      const geo=shell(rows, -Math.PI, Math.PI,48),pos=geo.attributes.position;
      for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);if(x>0)pos.setX(i,x+.009*Math.exp(-Math.abs(z)*75));}geo.computeVertexNormals();add(g,[geo]);
      const f=(y,z)=>surface(rows,y,z,.004+.009*Math.exp(-Math.abs(z)*75));
      add(g,[curve([f(.107,-.143),f(.070,-.090),f(.060,0),f(.070,.090),f(.107,.143)],.003),ring(rows,-.145)],GOLD);
      const gorget=[[-.006,.104,.104,0],[.016,.090,.091,0],[.057,.066,.066,0]],gorgetGeo=shell(gorget);gorgetGeo.translate(0,.115,0);add(g,[gorgetGeo]);add(g,[bake(ring(gorget,.016),[0,.115,0]),bake(ring(gorget,.055),[0,.115,0])],GOLD);
      const shield=[[.050,-.035],[.054,0],[.050,.035],[-.027,.030],[-.061,0],[-.027,-.030]];
      add(g,[patch(shield,(y,z)=>f(y,z))],WINE,{...metal,side:THREE.DoubleSide});add(g,[edge(shield,(y,z)=>f(y,z),.0024)],GOLD);castle(g,(y,z)=>{const p=f(y,z);p[0]+=.002;return p;},-.016,0,.70);
      for(const s of [-1,1]){
        laurel(g,f,-.106,s*.056,.174,s,.88);
        add(g,[curve([f(-.135,s*.014),f(-.090,s*.094),f(-.014,s*.139),f(.076,s*.141)],.002)],GOLD);
        const p=f(.096,s*.126);rosette(g,...p,.022);
      }
      add(g,[curve([f(-.145,0),f(-.105,0),f(-.072,0)],.002)],GOLD);
    },
    abdomen(g){
      const rows=[[-.082,.101,.136,0],[-.031,.094,.130,0],[.034,.098,.134,0],[.079,.108,.143,0]];base(g,rows.map(([y,d,w,x])=>[y,d-.006,w-.006,x]));
      for(let i=0;i<2;i++){
        const y=.079-i*.078,slice=[sample(rows,y-.085),sample(rows,y)];slice[0][0]=y-.085;slice[1][0]=y;
        const geo=shell(slice),p=geo.attributes.position;for(let j=0;j<p.count;j++){if(p.getX(j)>0)p.setY(j,p.getY(j)-.014*(1-Math.min(1,Math.abs(p.getZ(j))/.14)));}geo.computeVertexNormals();add(g,[geo]);
        const pts=[];for(let j=0;j<=32;j++){const a=-Math.PI+j/32*Math.PI*2,c=Math.cos(a);pts.push([slice[0][1]*Math.sign(c)*Math.pow(Math.abs(c),.8),y-.084-(c>0?.014*(1-Math.abs(Math.sin(a))):0),slice[0][2]*Math.sin(a)]);}add(g,[curve(pts,.0017,32)],GOLD);
      }
    },
    pelvis(g){
      const rows=[[-.10,.111,.159,0],[-.025,.107,.147,0],[.056,.098,.133,0],[.080,.099,.133,0]];base(g,rows.map(([y,d,w,x])=>[y,d-.005,w-.005,x]));add(g,[shell(rows)]);
      const belt=[[-.003,.113,.150,0],[.023,.110,.144,0]];add(g,[shell(belt)],0x463727,cloth);add(g,[ring(belt,-.002),ring(belt,.022)],GOLD);
      add(g,[box(.009,.033,.033,[.117,.011,-.011])],GOLD);add(g,[box(.010,.021,.022,[.122,.011,-.011])],DARK);
      for(const s of [-1,1]){
        const f=(y,z)=>surface(rows,y,z,.003);laurel(g,f,-.078,s*.098,.115,s,.45);
        for(let i=0;i<3;i++)add(g,[ball(.0028,6,4,f(.011,s*(.051+i*.019)))],LIGHT);
      }
    },
    uarmS:shoulder,uarmO:shoulder,farmS:forearm,farmO:forearm,thighF:thigh,thighB:thigh,shinF:shin,shinB:shin,footF:foot,footB:foot,
  };
}

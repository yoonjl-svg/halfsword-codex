// Olivier: an uncovered, sun-weathered companion to Roland. Native articulated
// outfit, intentionally separate from the ivory king's round gilt plates.
// Head has no helmet object or armor. Stock eye geometry is kept at full size.
export function createOlivierOutfit(h){
 const {THREE,bake,box,cyl,ball,addMerged,artoriaCloth,quietFace,taperedTube}=h;
 const IRON=0x484b46,EDGE=0x858575,BRASS=0x887548,CLOTH=0x89763c,LEATHER=0x34352e;
 const metal={metalness:.68,roughness:.52,steel:.75,side:THREE.DoubleSide},cloth={metalness:0,roughness:.97,side:THREE.DoubleSide};
 const add=(g,p,c=IRON,m=metal)=>addMerged(g,p,c,m);
 const curve=(p,r=.0018,n=20)=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p.map(v=>new THREE.Vector3(...v))),n,r,5,false);
 function mesh(p,ix){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(p.flatMap((_,i)=>i%3===0?[p[i+2],p[i+1]]:[]),2));g.setIndex(ix);g.computeVertexNormals();return g;}
 function point(row,a){const[y,d,w,x=0]=row,c=Math.cos(a);return[x+d*Math.sign(c)*Math.pow(Math.abs(c),.78),y,w*Math.sin(a)];}
 function shell(rows,a0=-Math.PI,a1=Math.PI,N=32){const p=[],ix=[];for(let j=0;j<rows.length;j++)for(let i=0;i<=N;i++){p.push(...point(rows[j],a0+(a1-a0)*i/N));if(j<rows.length-1&&i<N){const k=j*(N+1)+i;ix.push(k,k+N+1,k+1,k+1,k+N+1,k+N+2);}}return mesh(p,ix);}
 const rim=(row,a0=-Math.PI,a1=Math.PI,r=.0017)=>curve(Array.from({length:33},(_,i)=>point(row,a0+(a1-a0)*i/32)),r,32);
 function base(g,rows){for(const c of g.children.slice(1))c.visible=false;g.children[0].geometry.dispose();g.children[0].geometry=shell(rows);}
 function dots(g,points,color=EDGE,r=.002){add(g,points.map(p=>ball(r,6,4,p)),color);}
 function head(g,look){
  quietFace(g,look,'omari');
  for(const eye of g.children.slice(1,3)){eye.scale.set(1,1,1);eye.material.color.setHex(0x241c17);}
  const face=g.children[0],p=face.geometry.attributes.position;
  for(let i=0;i<p.count;i++){const y=p.getY(i),x=p.getX(i),z=p.getZ(i);if(y<-.035){p.setZ(i,z*(1+.14*Math.min(1,(-y-.035)/.055)));if(x>0)p.setX(i,x+.005);}}
  p.needsUpdate=true;face.geometry.computeVertexNormals();
  const nose=g.children[3];nose.geometry.dispose();nose.geometry=bake(new THREE.SphereGeometry(1,10,8),null,null,[.016,.021,.013]);nose.position.set(.101,-.012,0);
  const locks=[[],[],[]],beard=[[],[],[]],detail=[];
  // Swept-back waves over the crown. Hairline stays above both eyes.
  for(let i=0;i<22;i++){
   const z=(i-10.5)*.009,a=Math.abs(z)/.105,y=.062-.020*a+.007*Math.sin(i*1.6);
   locks[i%3].push(taperedTube([[.088-.028*a,y,z],[.060,.085-.032*a+.011*Math.sin(i*1.3),z+.009*Math.sin(i)],[-.002,.108-.055*a**1.4,z*1.10+.005*Math.cos(i)],[-.064,.085-.035*a,z*1.10],[-.091,.008,z*1.05]],[.001,.011,.012,.011,.002],26,8));
  }
  // Medium-length curls: tucked behind ears, dense nape, uneven curled tips.
  for(let i=0;i<41;i++){
   const a=.72+i/40*(Math.PI*2-1.44),x=.103*Math.cos(a)-.012,z=.104*Math.sin(a),len=.145+.045*(.5+.5*Math.sin(i*2.3));
   const path=[];for(let j=0;j<9;j++){const t=j/8,w=.010*Math.sin(t*Math.PI*3.3+i*.9);path.push([x-.016*t+w*Math.cos(a),.035-len*t,z*(1+.17*t)+w*Math.sin(a)]);}
   locks[i%3].push(taperedTube(path,[.010,.012,.012,.011,.010,.011,.008,.006,.001],28,6));
  }
  // Contiguous beard foundation around jaw; individual curved locks provide
  // volume and texture without covering the mouth or creating a floating goatee.
  const beardRows=[[-.107,.067,.049,.016],[-.093,.095,.074,.007],[-.065,.101,.087,0],[-.041,.093,.091,0]];
  add(g,[shell(beardRows,-1.72,1.72,32)],look.hair,cloth);
  for(const side of [-1,1]){
   for(let i=0;i<6;i++){
    const t=i/5,z=side*(.081-.059*t),x=.047+.049*t,y=.014-.063*t;
    beard[i%3].push(taperedTube([[x,y,z],[x+.012,y-.034,z*.98],[x+.008,y-.060,z*.86],[x-.008,y-.079,z*.73]],[.008,.013,.012,.001],22,6));
   }
   for(let i=0;i<5;i++){
    const z=side*(.008+i*.014),x=.107-.020*(i/4)**2;
    beard[(i+1)%3].push(taperedTube([[x,-.057,z],[x+.004,-.080,z],[x-.013,-.104,z*.84],[x-.030,-.116+.014*i/4,z*.69]],[.009,.012,.009,.001],18,6));
   }
   beard[0].push(taperedTube([[.119,-.035,side*.003],[.117,-.038,side*.019],[.102,-.046,side*.040]],[.007,.009,.004],18,6));
   detail.push(curve([[.092,.038,side*.020],[.099,.041,side*.036],[.091,.035,side*.053]],.003,12));
  }
  for(let i=0;i<3;i++){const o=add(g,[...locks[i],...beard[i]],[look.hair,0x272622,0x302d26][i],cloth);o.name='olivier-curls-and-beard-'+i;}
  add(g,detail,look.hair,cloth);
  add(g,[curve([[.110,-.048,-.014],[.113,-.049,0],[.110,-.048,.014]],.0017,10)],0x704534,cloth);
 }
 function cape(g){
  const layer=artoriaCloth(g,'olivier-short-ochre-mantle'),p=[],ix=[],cols=[],R=20,C=22;
  const at=(t,u)=>[-.157-.112*t-.014*Math.cos(u*12)*(.3+.7*t),.126-.71*t+.028*Math.sin(u*3)*t,u*(.147+.073*t)+.055];
  for(let j=0;j<=R;j++)for(let i=0;i<=C;i++){const t=j/R,u=i/C*2-1;p.push(...at(t,u));const c=new THREE.Color(CLOTH).multiplyScalar(.77+.20*(1+Math.cos(u*12))/2);cols.push(c.r,c.g,c.b);if(j<R&&i<C){const k=j*(C+1)+i;ix.push(k,k+1,k+C+1,k+1,k+C+2,k+C+1);}}
  const geo=mesh(p,ix);geo.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));add(layer,[geo],0xffffff,{...cloth,vertexColors:true});
  for(const t of [.94,.985])add(layer,[curve(Array.from({length:25},(_,i)=>{const p=at(t,i/12-1);p[0]-=.001;return p;}),.0015,24)],0x5e522e,cloth);
 }
 const chestRows=[[-.146,.103,.138,0],[-.095,.119,.151,0],[.018,.137,.176,-.008],[.091,.125,.170,-.008],[.142,.073,.107,-.005]];
 function chest(g){
  base(g,chestRows.map(([y,d,w,x])=>[y,d-.012,w-.012,x]));cape(g);
  const body=add(g,[shell(chestRows)],LEATHER,{...metal,metalness:.25,roughness:.72});body.name='olivier-riveted-brigandine';
  // Straight overlapping metal bands leave broad quiet areas, unlike Roland's
  // scrollwork. Subtle centre ridge and grouped rivets describe hidden plates.
  for(let j=0;j<4;j++){
   const y=.105-j*.066;
   const sample=Y=>{let k=0;while(k<chestRows.length-2&&Y>chestRows[k+1][0])k++;const a=chestRows[k],b=chestRows[k+1],t=(Y-a[0])/(b[0]-a[0]);return[Y,a[1]+(b[1]-a[1])*t+.006,a[2]+(b[2]-a[2])*t+.006,a[3]+(b[3]-a[3])*t];};
   const row=[sample(y-.065),sample(y-.032),sample(y)],plate=add(g,[shell(row,-1.26,1.26,32)]);
   const edge=Array.from({length:25},(_,i)=>{const a=-1.26+i/24*2.52,p=point(row[0],a);p[1]-=.012*Math.cos(a);return p;});add(plate,[curve(edge,.0014,24)],EDGE);
   dots(plate,[-1,-.5,0,.5,1].flatMap(a=>[-.007,.007].map(dy=>{const p=point(row[2],a);p[0]+=.002;p[1]-=.013+dy;return p;})));
  }
  add(g,[shell([[.126,.082,.105,0],[.177,.059,.066,0]])],IRON);
  add(g,[rim([.177,.060,.067,0])],EDGE);
  // One practical clasp instead of royal shields; ochre shoulder fall at left.
  const clothLayer=artoriaCloth(g,'olivier-shoulder-fall');add(clothLayer,[shell([[.055,.137,.176,-.012],[.137,.091,.117,-.012]],1.0,2.8,24)],CLOTH,cloth);
  add(g,[cyl(.019,.019,.006,16,false,[.121,.088,.112],[0,0,Math.PI/2])],BRASS);
  dots(g,[[.126,.088,.112]],EDGE,.006);
 }
 function shoulder(g,side){
  const rows=[[-.04,.088,.090,0],[.045,.096,.103,0],[.117,.072,.083,0],[.148,.031,.038,0],[.155,.004,.006,0]];
  const cap=add(g,[shell(rows)],IRON);cap.name='olivier-low-pauldron';add(cap,[rim(rows[0])],EDGE);
  for(let i=0;i<3;i++){const y=.003-i*.041,r=.091-i*.008,rows=[[y-.045,r-.009,r-.008,0],[y,r,r,0]],o=add(g,[shell(rows)],IRON);add(o,[rim(rows[0])],EDGE);dots(o,[-1,1].map(s=>[r*.85,y-.015,s*r*.48]));}
  add(g,[shell([[-.151,.047,.048,0],[-.109,.054,.056,0],[-.075,.061,.064,0]])],IRON);
 }
 function abdomen(g){const rows=[[-.082,.100,.135,0],[0,.096,.128,0],[.080,.107,.142,0]];base(g,rows.map(([y,d,w,x])=>[y,d-.008,w-.008,x]));for(let i=0;i<3;i++){const y=.079-i*.053,r=.104-(i===1?.005:0);add(g,[shell([[y-.055,r,.135,0],[y,r+.004,.138,0]])]);add(g,[rim([y-.054,r+.001,.136,0])],EDGE);}}
 function pelvis(g){const rows=[[-.101,.107,.155,0],[.024,.107,.147,0],[.078,.100,.136,0]];base(g,rows.map(([y,d,w,x])=>[y,d-.007,w-.007,x]));add(g,[shell(rows)]);add(g,[shell([[-.014,.113,.151,0],[.025,.113,.150,0]])],0x493a2c,cloth);add(g,[box(.011,.034,.041,[.119,.005,-.021])],BRASS);add(g,[box(.012,.021,.027,[.124,.005,-.021])],LEATHER);}
 function forearm(g){const rows=[[-.127,.046,.046,0],[-.065,.047,.047,0],[.070,.059,.059,0],[.134,.060,.063,0]];add(g,[shell(rows)]);for(const row of [rows[0],rows.at(-1)])add(g,[rim(row)],EDGE);add(g,[curve([[.048,-.12,0],[.051,0,0],[.063,.129,0]],.0017)],EDGE);dots(g,[-.110,-.05,.015,.08,.119].map(y=>[.057,y,.022]));}
 function thigh(g){const layer=artoriaCloth(g,'olivier-ochre-skirt');add(layer,[shell([[-.102,.073,.071,0],[.20,.083,.081,0]])],CLOTH,cloth);for(let i=0;i<3;i++){const y=.195-i*.087,r=.092-i*.003,rows=[[y-.105,r-.008,.077-i*.003,0],[y,r,.083-i*.003,0]],plate=add(g,[shell(rows,-1.45,1.45,28)]);add(plate,[rim(rows[0],-1.45,1.45)],EDGE);dots(plate,[-1,1].map(s=>[r*.85,y-.018,s*.039]));}}
 function shin(g){const rows=[[-.185,.047,.043,0],[-.09,.054,.048,0],[.070,.063,.055,0],[.152,.058,.051,0]];add(g,[shell(rows)]);add(g,[rim(rows[0]),curve([[.048,-.182,0],[.060,-.05,0],[.066,.147,0]],.002)],EDGE);add(g,[shell([[.112,.061,.050,.006],[.160,.078,.060,.009],[.204,.060,.045,.005]])]);}
 function foot(g){const rows=[[-.034,.113,.047,0],[0,.127,.053,0],[.032,.090,.046,-.015]];base(g,rows.map(([y,d,w,x])=>[y,d-.006,w-.006,x]));add(g,[shell(rows)]);for(let i=0;i<3;i++)add(g,[curve([[.070+i*.017,.023,-.037],[.075+i*.017,.030,0],[.070+i*.017,.023,.037]],.0015)],EDGE);}
 return{armorParts:new Set(['chest','abdomen','pelvis','uarmS','uarmO','farmS','farmO','thighF','thighB','shinF','shinB','footF','footB']),head,chest,abdomen,pelvis,uarmS:g=>shoulder(g,1),uarmO:g=>shoulder(g,-1),farmS:forearm,farmO:forearm,thighF:thigh,thighB:thigh,shinF:shin,shinB:shin,footF:foot,footB:foot};
}

// Approved 10/29: current v2 bodies, new head variations and cloth palettes.
// No alternate body rig. Metal body coverage is inherited from each base outfit.
import { createRolandOutfitV2 } from './outfit_roland_v2.js';
import { createBernardoOutfitV2 } from './outfit_bernardo_v2.js';

export function royalAlterLook(base, id) {
  if (id === 'roland') return {...base, outfit:'roland_alter', helmet:null,
    hair:0xb89048, skin:0xc8a47e, metal:0x41494e, accent:0x667782,
    hoseUpper:0x667782, hands:0x717471, stockEyes:true};
  return {...base, outfit:'bernardo_alter', helmet:'royal_close', circlet:false,
    accent:0x8f9290, lion:'gold', stockEyes:true};
}

export function createRolandAlter(h) {
  const {THREE:T,quietFace,addMerged,artoriaCloth,taperedTube,ball,bake,CLOTH}=h;
  const body=createRolandOutfitV2(h,{iron:0x41494e,trim:0xafa27c,cloth:0x667782});
  // Cross-sections turn with the strand. The hanging-hair helper keeps rings
  // horizontal and would pinch at the crest of a swept-back lock.
  function lock(points,widths,depth){
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),p=[],uv=[],ix=[],N=18,S=8;
    const W=new T.Vector3(),B=new T.Vector3();
    for(let i=0;i<=N;i++){
      const t=i/N,P=curve.getPoint(t),D=curve.getTangent(t).normalize(),u=t*(widths.length-1),k=Math.min(widths.length-2,Math.floor(u)),w=T.MathUtils.lerp(widths[k],widths[k+1],u-k)/2;
      W.set(0,0,1).addScaledVector(D,-D.z).normalize();B.crossVectors(D,W).normalize();
      for(let j=0;j<=S;j++){const a=j/S*Math.PI*2,wide=Math.sin(a)*w,thick=Math.cos(a)*depth*Math.min(1,w/.006);p.push(P.x+W.x*wide+B.x*thick,P.y+W.y*wide+B.y*thick,P.z+W.z*wide+B.z*thick);uv.push(j/S,t);if(i<N&&j<S){const n=i*(S+1)+j;ix.push(n,n+S+1,n+1,n+1,n+S+1,n+S+2);}}
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(ix);geo.computeVertexNormals();return geo;
  }

  return {...body, head(g,look) {
    quietFace(g,look,'uniform');
    g.children[4].scale.y=1.12; // continuous swept crown under the surface locks
    const hair=artoriaCloth(g,'roland-golden-halfup'), layers=[[],[],[]];
    // Continuous hair cap is the native cap. Locks flow backwards from an open
    // forehead; their ends reach the shoulders without covering the eye line.
    const scalp=(x,z)=>[x,.004+1.12*Math.sqrt(Math.max(.00008,.107**2-(x+.008)**2-z*z))+.001,z];
    for(let i=0;i<9;i++){
      const z=(i-4)*.02, a=Math.abs(z)/.09;
      layers[i%3].push(lock([
        scalp(.084-.025*a,z),
        scalp(.044,z*1.05),scalp(-.028,z*.94),
        [-.101,.065,z*.74],[-.119,-.028,z*.4]],
        [.008,.03,.03,.026,.005],.005));
    }
    // Shoulder-length back locks, shared nape coverage rather than disconnected
    // ribbons. A small tied upper section rests on top of the loose lower hair.
    for(let i=0;i<11;i++){
      const z=(i-5)*.018, a=Math.abs(z)/.1, wave=.009*Math.sin(i*1.9);
      layers[i%3].push(lock([
        [-.083,.044,z],[-.111,-.047,z*1.07],[-.118,-.137,z*1.08+wave],
        [-.127,-.231+a*.032,z*1.12],[-.104,-.271+a*.04,z*1.13+wave]],
        [.023,.024,.024,.021,.004],.01));
    }
    for(const side of [-1,1]){
      layers[1].push(lock([[.034,.075,side*.086],[.01,.018,side*.109],
        [.028,-.066,side*.108],[.004,-.157,side*.105],[-.035,-.208,side*.104]],
        [.016,.019,.015,.012,.002],.007));
      layers[0].push(lock([[.067,.074,side*.051],[.09,.05,side*.071],
        [.084,-.002,side*.084],[.063,-.042,side*.087]],
        [.013,.014,.01,.0015],.006));
    }
    const gold=[look.hair,0xc4a261,0xa07e40];
    layers.forEach((p,i)=>addMerged(hair,p,gold[i],CLOTH));
    addMerged(hair,[bake(ball(.022,10,8),[-.125,-.027,0],null,[.6,.7,1.1])],0x494c50,CLOTH);
    for(const z of [-.015,0,.015])addMerged(hair,[taperedTube([
      [-.132,-.035,z],[-.15,-.087,z*1.5],[-.146,-.152,z*1.8],[-.123,-.195,z*1.5]],
      [.013,.016,.014,.002],12,5)],gold[z===0?1:0],CLOTH);
  }};
}

export function createBernardoAlter(h) {
  const {THREE:T,addMerged,bake,ball,cyl,taperedTube}=h;
  const body=createBernardoOutfitV2(h,{tabard:0x54242e,cloak:0x9b9e99,lining:0x555b59,lion:0xb39b60});
  const GOLD=0xb69a55,LIGHT=0xd0bb7d,RECESS=0x735c30;
  const metal={metalness:.72,roughness:.39,steel:.65,side:T.DoubleSide};
  const dark={metalness:.1,roughness:.94,side:T.DoubleSide};
  function grid(nu,nv,fn){
    const p=[],uv=[],ix=[];
    for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){
      p.push(...fn(i/nu,j/nv));uv.push(i/nu,j/nv);
      if(i<nu&&j<nv){const n=j*(nu+1)+i;ix.push(n,n+nu+1,n+1,n+1,n+nu+1,n+nu+2);}
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));
    g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
  }
  function surface(y,a,lift=0){
    const t=(y+.115)/.28,cap=Math.sqrt(Math.max(.06,1-Math.pow((y-.012)/.159,2)));
    const z=(.122*cap+lift)*Math.sin(a),x=-.012+(.132*cap+lift)*Math.cos(a);
    return [x+Math.max(0,Math.cos(a))*.014*Math.sin(t*Math.PI),y,z];
  }
  const curve=(pts,r=.002,n=16)=>new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p))),n,r,5,false);
  function helmet(g){
    const helm=new T.Group();helm.name='bernardo-leon-helmet';helm.userData.pieces={};g.add(helm);g.userData.helmet=helm;
    function piece(id,geos,color=GOLD,mat=metal){
      const group=new T.Group();group.name='leon-helm-'+id;helm.add(group);helm.userData.pieces[id]=group;
      const m=addMerged(group,geos,color,mat);if(m)m.userData.base={color,roughness:mat.roughness};return group;
    }
    // Real opening at y .004..034, across the front. The shared eye sprites
    // remain behind that opening; no bright decal painted on an opaque visor.
    const back=grid(28,12,(u,v)=>surface(-.114+v*.275,Math.PI/2+u*Math.PI));
    const brow=grid(28,9,(u,v)=>surface(.034+v*.127,-Math.PI/2+u*Math.PI));
    const chin=grid(28,9,(u,v)=>surface(-.114+v*.118,-Math.PI/2+u*Math.PI,.003));
    piece('bowl',[back,brow]);piece('visor',[chin]);
    const edges=[];
    for(const y of [.004,.034,-.111])edges.push(curve(Array.from({length:19},(_,i)=>surface(y,-Math.PI/2+i/18*Math.PI,.005)),.0026,20));
    piece('trim',edges,LIGHT);
    // A narrow central nasal joins brow and chin, leaving two generous slits.
    piece('nasal',[grid(2,5,(u,v)=>surface(.002+v*.038,(u*2-1)*.034,.006))],LIGHT);
    // Cheek breathing slots and interlaced engraved tendrils follow the shell.
    const vents=[],scrolls=[],studs=[];
    for(const side of [-1,1]){
      for(let i=0;i<4;i++){
        const a=side*(.38+i*.12),y=-.025-i*.009;
        vents.push(curve([surface(y,a-.02*side,.006),surface(y-.022,a+.014*side,.006)],.0019,3));
      }
      for(let row=0;row<3;row++){
        const pts=[];for(let i=0;i<=20;i++){const t=i/20,ang=side*(.62+t*.52),y=-.067+row*.029+.012*Math.sin(t*Math.PI*2);pts.push(surface(y,ang,.006));}
        scrolls.push(curve(pts,.0017,20));
      }
      for(let i=0;i<7;i++){const p=surface(-.097+i*.029,side*1.3,.005);studs.push(ball(.003,6,4,p));}
      studs.push(cyl(.012,.012,.005,12,false,[-.009,.019,side*.124],[Math.PI/2,0,0]));
    }
    piece('vents',vents,0x292822,dark);piece('scrollwork',scrolls,LIGHT);piece('rivets',studs,RECESS);
    // Lion brow relief: low sculpted feline features, framed by swept metal
    // mane ridges. This is a chased heraldic ornament, not an oversized animal head.
    const crest=new T.Group();crest.name='leon-helm-crest';helm.add(crest);helm.userData.pieces.crest=crest;
    const relief=[bake(ball(1,14,10),[.122,.083,0],null,[.019,.033,.036]),
      bake(ball(1,12,8),[.141,.067,-.01],null,[.012,.009,.014]),
      bake(ball(1,12,8),[.141,.067,.01],null,[.012,.009,.014])];
    for(const s of [-1,1])relief.push(bake(ball(1,10,7),[.113,.109,s*.03],null,[.009,.012,.011]));
    addMerged(crest,relief,GOLD,metal);
    addMerged(crest,[bake(ball(1,8,6),[.151,.079,0],null,[.005,.005,.007]),
      ...[-1,1].map(s=>curve([[.139,.094,s*.009],[.137,.097,s*.019],[.129,.092,s*.028]],.0025,6))],RECESS,metal);
    const mane=[];
    for(const s of [-1,1])for(let i=0;i<6;i++){
      const t=i/5;
      mane.push(taperedTube([[.113,.11-t*.045,s*(.025+t*.01)],
        [.091,.139-t*.04,s*(.048+t*.012)], [.026,.148-t*.045,s*(.073+t*.018)],
        [-.054,.121-t*.049,s*(.077+t*.022)],[-.098,.078-t*.046,s*(.055+t*.026)]],
        [.005,.009,.01,.008,.0015],16,5));
    }
    mane.push(taperedTube([[.065,.131,0],[.009,.156,0],[-.055,.15,0],[-.108,.104,0]],
      [.009,.011,.009,.002],18,6));
    addMerged(crest,mane,LIGHT,metal);
    // Thin chased border of the brow relief separates it from the smooth bowl.
    piece('brow-beads',Array.from({length:13},(_,i)=>{
      const a=i/12*Math.PI;return ball(.0025,6,4,[.124,.082+.041*Math.sin(a),.045*Math.cos(a)]);
    }),RECESS);
  }
  return {...body, head(g,look){
    body.head(g,{...look,circlet:false});
    // Tuck the crown hair inside the helmet, preserving the recognizable beard
    // and short curls visible at the nape. Geometry belongs to this fighter only.
    for(const m of g.children.filter(o=>o.name.startsWith('bernardo-curls-and-beard-'))){
      const p=m.geometry.attributes.position;
      for(let i=0;i<p.count;i++)if(p.getX(i)<.025||Math.abs(p.getZ(i))>.08){p.setX(i,p.getX(i)*.86);p.setZ(i,p.getZ(i)*.86);}
      p.needsUpdate=true;m.geometry.computeVertexNormals();
    }
    helmet(g);
  }};
}

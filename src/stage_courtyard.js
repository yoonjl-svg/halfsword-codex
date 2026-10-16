// Maya's preview: a Rajasthan-inspired sandstone waystation and deep baori.
// Original architecture, not a reconstruction. The duel disc stays flat/empty;
// the well and buildings are scenery beyond it. No change to the journey yet.
import * as THREE from 'three';
import { ARENA } from './config.js';
import { Kit, box, cyl, limb, canvasTex, rng } from './stage_kit.js';

const P = { stone:0xc4a37e, pale:0xdbc4a1, rose:0xa47758, dark:0x5d5147,
  recess:0x645f57, wood:0x554137, iron:0x363331, rope:0x988366, cloth:0xbbae8b };
const WELL = { x:-21, z:-1, hx:8, hz:10, depth:6.25 };

function stoneTexture() {
  const r=rng(161017);
  return canvasTex(256,256,(c,w,h)=>{
    c.fillStyle='#ded7c8';c.fillRect(0,0,w,h);
    for(let i=0;i<1400;i++){
      c.fillStyle=`rgba(88,65,42,${.018+r()*.05})`;
      c.fillRect(r()*w,r()*h,1+r()*8,.4+r()*1.4);
    }
    for(let y=0;y<256;y+=64){c.fillStyle='rgba(69,48,28,.1)';c.fillRect(0,y,256,1.5);}
  });
}
function pavingTexture() {
  const r=rng(161018);
  return canvasTex(1024,1024,(c,w,h)=>{
    c.fillStyle='#bfb29a';c.fillRect(0,0,w,h);
    for(let row=0;row<48;row++)for(let col=-1;col<33;col++){
      const x=col*32+(row%2)*16,y=row*22;
      c.fillStyle=`hsl(39,${11+r()*4}%,${69+r()*4}%)`;c.fillRect(x,y,31.5,21.5);
      c.fillStyle='rgba(255,242,210,.07)';c.fillRect(x,y,31.5,.7);
    }
    for(let i=0;i<4500;i++){
      c.fillStyle=`rgba(145,113,70,${.025+r()*.05})`;
      c.fillRect(r()*w,r()*h,1+r()*7,1+r()*2);
    }
    // Broad, quiet shade at the architecture, with clear warm stone centrally.
    const shade=c.createRadialGradient(512,512,150,512,512,600);
    shade.addColorStop(0,'rgba(63,59,60,0)');shade.addColorStop(.7,'rgba(63,59,60,.03)');shade.addColorStop(1,'rgba(63,59,60,.24)');
    c.fillStyle=shade;c.fillRect(0,0,w,h);
  });
}
function arch(K,x,y,z,w,h,depth=.55,color=P.pale) {
  // Corbelled multi-lobed opening: short springers and a gently cusped crown.
  K.put('stone',box(.28,h*.55,depth),color,[x-w/2-.12,y+h*.275,z]);
  K.put('stone',box(.28,h*.55,depth),color,[x+w/2+.12,y+h*.275,z]);
  for(let i=0;i<20;i++){
    const a=Math.PI*i/20,b=Math.PI*(i+1)/20,mid=(a+b)/2;
    const yy=Math.sin(mid)*h*.45+h*.55;
    const scallop=.035*Math.cos(mid*10);
    K.put('stone',box(w*Math.PI/40+.055,.23,depth),color,
      [x+Math.cos(mid)*(w/2+scallop),y+yy,z],[0,0,Math.atan2(h*.45*Math.cos(mid),-w*.5*Math.sin(mid))],1,{vary:.06,noise:.02});
  }
}
function column(K,x,y,z,h=4.4) {
  K.put('stone',box(.84,.27,.84),P.pale,[x,y+.135,z]);
  K.put('stone',cyl(.22,.29,h-.65,8),P.stone,[x,y+h/2,z]);
  K.put('stone',box(.52,.18,.52),P.rose,[x,y+h-.55,z]);
  K.put('stone',box(.92,.25,.92),P.pale,[x,y+h-.27,z]);
  for(const sign of [-1,1])K.put('stone',box(.62,.22,.34),P.stone,[x+sign*.36,y+h-.55,z],[0,0,-sign*.48]);
}
function pavilion(K,x,y,z,scale=1) {
  K.push([x,y,z],0,scale);
  for(const xx of [-1.1,1.1])for(const zz of [-1.1,1.1])column(K,xx,0,zz,2.6);
  K.put('stone',box(3.2,.22,3.2),P.pale,[0,2.65,0]);
  K.put('stone',new THREE.SphereGeometry(1.55,12,6,0,Math.PI*2,0,Math.PI/2),P.rose,[0,2.75,0],[0,0,0],[1,.68,1]);
  K.put('stone',cyl(.08,.24,.45,8),P.pale,[0,3.98,0]);
  K.pop();
}
function architecture(K) {
  // Tall gate, weathered projecting chajja, small lattice above the sealed door.
  K.put('stone',box(8.8,9.3,3.4),P.stone,[0,4.65,-24.4]);
  K.put('shade',box(5.35,6.1,.08),P.recess,[0,3.05,-22.64]);
  for(let i=0;i<16;i++)K.put('wood',box(.292,5.7,.13),P.wood,[-2.34+i*.312,2.85,-22.56],[0,0,0],1,{vary:.13});
  for(const y of [.75,2.6,4.45])K.put('iron',box(4.95,.13,.07),P.iron,[0,y,-22.46]);
  for(const x of [-2.05,-1.05,1.05,2.05])for(const y of [.75,2.6,4.45])K.put('iron',new THREE.SphereGeometry(.045,6,4),0x786750,[x,y,-22.40]);
  arch(K,0,0,-22.30,5.25,6.65,.6);
  for(const y of [.26,6.9,8.8])K.put('stone',box(9.4,.23,4.0),P.pale,[0,y,-24.15]);
  K.put('stone',box(10.2,.24,4.8),P.pale,[0,7.28,-24]);
  for(let x=-4;x<=4;x+=.8)K.put('stone',box(.16,.53,.75),P.rose,[x,6.94,-22.45],[.3,0,0]);
  K.put('shade',box(2.2,1.1,.08),P.recess,[0,8,-22.64]);
  for(let x=-1;x<=1;x+=.28)K.put('stone',box(.065,1.12,.10),P.stone,[x,8,-22.54]);
  for(const y of [7.55,7.9,8.25,8.5])K.put('stone',box(2.2,.07,.10),P.pale,[0,y,-22.51]);
  pavilion(K,0,9.3,-24.4,.88);
  // Two shaded galleries. Low side buildings leave the camera's orbit open.
  for(const side of [-1,1]){
    K.put('stone',box(20,5.05,2.0),P.rose,[side*15,2.525,-25.0]);
    K.put('shade',box(19.2,3.8,.08),P.recess,[side*15,1.9,-23.94]);
    for(let j=0;j<5;j++){
      const x=side*(6.1+j*4.2);column(K,x,0,-21.7,4.5);
      if(j<4)arch(K,x+side*2.1,0,-21.7,3.65,4.35,.5,P.stone);
    }
    K.put('stone',box(21.3,.32,4.2),P.pale,[side*15.3,4.65,-23.1]);
    K.put('stone',box(20.8,.6,.4),P.stone,[side*15.3,5.1,-21.45]);
    for(let j=0;j<24;j++)K.put('stone',box(.32,.35,.48),P.pale,[side*5.3+side*j*.87,5.55,-21.45]);
  }
  K.push([26,0,-1],-Math.PI/2);
  for(let j=0;j<5;j++){
    const x=-10+j*5;
    K.put('stone',box(4.8,4.4,3),j%2?P.stone:P.rose,[x,2.2,-1]);
    K.put('shade',box(2.05,2.8,.1),P.recess,[x,1.4,.56]);arch(K,x,0,.65,2.1,3.1);
    K.put('stone',box(5.1,.2,4),P.pale,[x,4.5,-.5]);
  }
  K.pop();
  // A low south wall, widely spaced open pavilions: no close foreground wall.
  K.put('stone',box(57,1.25,.75),P.rose,[0,.625,26]);
  K.put('stone',box(57,.16,1.05),P.pale,[0,1.33,26]);
  pavilion(K,15,0,26,1.25);pavilion(K,-9,0,26,1.05);
}
function stepwell(K) {
  const {x,z,hx,hz}=WELL;
  // Four square terraces; switching stair flights descend between each landing.
  // Unlike a painted hole, all risers, water and lower galleries are actual mesh.
  for(let level=0;level<4;level++){
    const y=-level*1.55,a=hx-level*1.35,b=hz-level*1.35;
    const stone=level<2?P.stone:0x78877d;
    for(const side of [-1,1]){
      K.put('stone',box(.68,.22,b*2),P.pale,[x+side*a,y-.11,z]);
      K.put('stone',box(a*2,.22,.68),P.pale,[x,y-.11,z+side*b]);
      K.put('stone',box(.4,1.55,b*2),stone,[x+side*(a-.14),y-.9,z]);
      K.put('stone',box(a*2,1.55,.4),stone,[x,y-.9,z+side*(b-.14)]);
      // Parallel switching flights give the characteristic angular baori rhythm.
      for(let flight=0;flight<3;flight++)for(let step=0;step<8;step++){
        const sy=y-(step+1)*1.55/8,sh=1.55-(step+1)*1.55/8+.22,dir=(flight+level)%2?1:-1;
        const zz=z+(flight-1)*(b*.62)+dir*(step-3.5)*.27;
        K.put('stone',box(1.12,sh,.29),step%3?stone:P.pale,[x+side*(a-.78),sy-sh/2,zz]);
      }
      for(let step=0;step<8;step++){
        const sy=y-(step+1)*1.55/8,sh=1.55-(step+1)*1.55/8+.22;
        K.put('stone',box(a*2-2.7,sh,.18),stone,[x,sy-sh/2,z+side*(b-.45-step*.13)]);
      }
      // Mineral watermarks on the exposed deep stone.
      K.put('shade',box(.025,.14,b*2-.4),0x63705f,[x+side*(a-.36),y-1.18,z]);
    }
  }
  // Recessed lower arcade at the far wall. Narrow light at the upper pavilion.
  for(let level=0;level<3;level++)for(let bay=-2;bay<=2;bay++){
    K.push([x-hx-.25,-level*1.65,z+bay*3.5],Math.PI/2);
    K.put('shade',box(2.8,1.5,.08),P.recess,[0,-.75,0]);
    arch(K,0,-1.5,.15,1.8,1.35,.25,0x9d927c);K.pop();
  }
  pavilion(K,x-hx-1.8,0,z,1.25);
  // Broken parapet only on the far edge; entrance side stays visually open.
  for(const zz of [-8,-4,3,7]){
    K.put('stone',box(.55,.9,.55),P.pale,[x-hx,.45,z+zz]);
    K.put('stone',box(.2,.2,2.9),P.stone,[x-hx,.75,z+zz+1.4]);
  }
}
function clayJar(K,x,y,z,s=1,tilt=0) {
  K.push([x,y,z],0,s);
  const points=[[.13,0],[.27,.08],[.36,.32],[.34,.54],[.22,.67],[.17,.7],[.17,.8],[.22,.83]].map(p=>new THREE.Vector2(...p));
  K.put('pot',new THREE.LatheGeometry(points,10),0x957354,[0,0,0],[0,0,tilt]);
  K.put('shade',cyl(.16,.16,.008,10),0x3d332c,[0,.79,0]);K.pop();
}
function traces(K) {
  // A hurried departure into the cooler well, not a populated marketplace.
  clayJar(K,-12.15,.02,5.6,1.15);clayJar(K,-11.8,.02,6.65,.85);
  clayJar(K,-13.25,-.2,7.5,.65,.7);
  for(const [x,z,a] of [[-11.1,7.2,.3],[-10.7,7.65,-.2],[-12.0,8.6,.8]]){
    K.put('wood',new THREE.SphereGeometry(1,8,4),0x534339,[x,.06,z],[0,a,0],[.11,.055,.25]);
    limb(K,'rope',[x-.08,.13,z],[x+.08,.13,z+.07],.025,.025,0x8c7354);
  }
  // A worn messenger bag and two unmistakably red pieces of wax, no text panel.
  K.put('wood',box(.62,.34,.46),0x70443b,[4.9,.19,-20.8],[0,.28,0],1,{rough:.035});
  K.put('wood',box(.64,.045,.28),0x805649,[4.92,.37,-20.72],[.15,.28,0]);
  K.put('iron',box(.08,.09,.035),0x9f875d,[4.88,.25,-20.56]);
  for(let i=0;i<12;i++){
    const a=Math.PI*i/12,b=Math.PI*(i+1)/12;
    limb(K,'rope',[4.9+Math.cos(a)*.38,.18+Math.sin(a)*.28,-21.03],[4.9+Math.cos(b)*.38,.18+Math.sin(b)*.28,-21.03],.02,.02,0x4d3730);
  }
  K.put('cloth',box(.46,.016,.3),0xccc0a0,[4.5,.024,-20.25],[0,-.35,0]);
  for(const [x,z]of [[4.52,-20.22],[4.84,-20.1]])K.put('wax',cyl(.065,.075,.025,6),0x942e31,[x,.05,z]);
  // Broken wax edges and a pressed mark distinguish the seals from loose coins.
  for(const [xx,zz]of [[4.52,-20.22],[4.84,-20.1]]){
    K.put('wax',box(.018,.008,.072),0x652729,[xx,.066,zz],[0,.4,0]);
    K.put('wax',box(.063,.008,.013),0x652729,[xx,.066,zz],[0,.4,0]);
    K.put('wax',cyl(.024,.029,.018,3),0x9d3a35,[xx+.09,.025,zz+.02],[0,.7,0]);
  }
  // Sand has started to cover the circular wear left by the gate's leaves.
  for(let i=0;i<22;i++){
    const a=i/21*Math.PI*.6;
    K.put('shade',box(.2,.007,.035),0x9b886e,[-2.4+Math.cos(a)*2.35,.008,-22.4+Math.sin(a)*2.35],[0,-a,0]);
  }
}
function cloth(scene,x,y,z,width,length,phase) {
  const g=new THREE.PlaneGeometry(width,length,14,10);
  const m=new THREE.MeshStandardMaterial({color:P.cloth,roughness:1,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(g,m);mesh.name='courtyard-wind-cloth';mesh.position.set(x,y,z);mesh.rotation.x=-Math.PI*.27;
  const rest=g.attributes.position.array.slice();scene.add(mesh);return {mesh,rest,phase,length};
}

export function buildCourtyard(scene,{hemi,sun}) {
  const before=new Set(scene.children);
  const sunOffset={x:5,y:7,z:-9};
  scene.background=new THREE.Color(0xc1b6a6);scene.fog=new THREE.Fog(0xc4b5a1,55,195);
  hemi.color.setHex(0xe3e5e2);hemi.groundColor.setHex(0xa59d8c);hemi.intensity=1.85;
  sun.color.setHex(0xffe7c4);sun.intensity=2.0;sun.position.set(sunOffset.x,sunOffset.y,sunOffset.z);
  const K=new Kit(161016),r=rng(161019);
  // Allocate input geometry only long enough for Kit to clone/merge it.
  const raw=K.put.bind(K);K.put=(bin,g,...args)=>{const result=raw(bin,g,...args);g.dispose();return result;};
  const {x,z,hx,hz}=WELL;
  // Four paving rectangles leave a real rectangular opening over the well.
  for(const [cx,cz,w,d]of [[(x-hx-42)/2,0,x-hx+42,84],[(x+hx+42)/2,0,42-x-hx,84],[x,(-42+z-hz)/2,hx*2,z-hz+42],[x,(42+z+hz)/2,hx*2,42-z-hz]])
    K.put('floor',box(w,.28,d),0xffffff,[cx,-.14,cz],[0,0,0],1,{vary:0,noise:0,uv:'box',uvScale:1/84});
  K.put('shade',box(16,.2,20),0x40534a,[x,-6.5,z]);
  for(const [px,pz,w,d]of [[-121,0,158,400],[121,0,158,400],[0,-121,84,158],[0,121,84,158]])
    K.put('earth',box(w,.3,d),0xb6a58b,[px,-.31,pz],[0,0,0],1,{vary:.03,noise:.03});
  architecture(K);stepwell(K);traces(K);
  for(let i=0;i<95;i++){
    const a=r()*Math.PI*2,rad=12+r()*29,px=Math.cos(a)*rad,pz=Math.sin(a)*rad;
    if(px>x-hx&&px<x+hx&&pz>z-hz&&pz<z+hz)continue;
    K.put('sand',new THREE.CircleGeometry(.6+r()*2,7),0xc4ad87,[px,.012,pz],[-Math.PI/2,0,r()*6.28],[1,.5+r()*.4,1],{vary:.1});
  }
  const materials={
    stone:new THREE.MeshStandardMaterial({vertexColors:true,map:stoneTexture(),roughness:1}),
    floor:new THREE.MeshStandardMaterial({vertexColors:true,map:pavingTexture(),roughness:.98}),
  };
  for(const name of ['wood','iron','rope','cloth','pot','wax','sand','shade','earth'])materials[name]=new THREE.MeshStandardMaterial({vertexColors:true,roughness:name==='iron'?.8:1,side:['cloth','pot'].includes(name)?THREE.DoubleSide:THREE.FrontSide});
  materials.sand.transparent=true;materials.sand.opacity=.14;materials.sand.depthWrite=false;
  for(const [bin,mat]of Object.entries(materials)){
    const mesh=K.mesh(bin,mat,{cast:false,receive:bin!=='cloud',light:bin==='stone'?(xx,yy)=>{const d=Math.min(0,yy)*.07;return [d,d,d];}:null});
    if(mesh){mesh.name='courtyard-'+bin;scene.add(mesh);}else mat.dispose();
    for(const g of K.bins[bin]??[])g.dispose();
  }
  // A muted upper sky and soft banks of suspended sand, rather than rock shapes.
  const skyGeo=new THREE.SphereGeometry(230,24,12),skyColors=[];
  const zenith=new THREE.Color(0x9bafb6),horizon=new THREE.Color(0xcdb69a);
  for(let i=0;i<skyGeo.attributes.position.count;i++){
    const f=THREE.MathUtils.smoothstep(skyGeo.attributes.position.getY(i)/230,.02,.7);
    const col=horizon.clone().lerp(zenith,f);skyColors.push(col.r,col.g,col.b);
  }
  skyGeo.setAttribute('color',new THREE.Float32BufferAttribute(skyColors,3));
  const sky=new THREE.Mesh(skyGeo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false}));sky.name='courtyard-sky';scene.add(sky);
  const bankMap=canvasTex(128,128,(c,w,h)=>{const a=c.createRadialGradient(w/2,h/2,2,w/2,h/2,w/2);a.addColorStop(0,'rgba(158,123,78,.65)');a.addColorStop(.42,'rgba(163,129,84,.42)');a.addColorStop(1,'rgba(178,147,105,0)');c.fillStyle=a;c.fillRect(0,0,w,h);});
  bankMap.wrapS=bankMap.wrapT=THREE.ClampToEdgeWrapping;
  const bankMat=new THREE.MeshBasicMaterial({map:bankMap,transparent:true,depthWrite:false,fog:false,side:THREE.DoubleSide});
  for(let i=0;i<15;i++){
    const bank=new THREE.Mesh(new THREE.PlaneGeometry(39+r()*15,22+r()*13),bankMat);
    bank.name='courtyard-distant-sand';bank.position.set(-110+i*16,8+r()*11,-105-r()*9);scene.add(bank);
  }
  const ring=new THREE.Mesh(new THREE.RingGeometry(ARENA.radius-.05,ARENA.radius+.07,96),new THREE.MeshStandardMaterial({color:0xa8997e,roughness:1,side:THREE.DoubleSide}));
  ring.name='courtyard-duel-boundary';ring.rotation.x=-Math.PI/2;ring.position.y=.014;scene.add(ring);
  const water=new THREE.Mesh(new THREE.PlaneGeometry(5.1,9.1,12,12),new THREE.MeshStandardMaterial({color:0x426c65,roughness:.7,metalness:.04}));
  water.name='courtyard-well-water';water.rotation.x=-Math.PI/2;water.position.set(x,-6.23,z);scene.add(water);
  // A frayed shade near the well; the second awning shelters the abandoned bag.
  const cloths=[cloth(scene,-12.5,3.6,5.1,4.3,2.3,0),cloth(scene,9.5,4.0,-20.5,5.5,2.7,1.2)];
  for(const c of cloths){
    const mk=new Kit(5);limb(mk,'rope',[c.mesh.position.x-c.mesh.geometry.parameters.width/2,c.mesh.position.y+.9,c.mesh.position.z-1],[c.mesh.position.x+c.mesh.geometry.parameters.width/2,c.mesh.position.y+.9,c.mesh.position.z-1],.025,.025,P.rope);
    for(const side of [-1,1]){const px=c.mesh.position.x+side*c.mesh.geometry.parameters.width/2;limb(mk,'rope',[px,0,c.mesh.position.z-1],[px,c.mesh.position.y+1,c.mesh.position.z-1],.07,.055,P.wood);}
    const mesh=mk.mesh('rope',new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));scene.add(mesh);for(const g of mk.bins.rope)g.dispose();
  }
  // Wind moves the lowering rope and gate ring as well as the canvas and dust.
  const rope=new THREE.Group();rope.name='courtyard-well-rope';rope.position.set(-14.1,1.3,2.0);
  const cord=new THREE.Mesh(cyl(.018,.018,6.9,6),new THREE.MeshStandardMaterial({color:P.rope,roughness:1}));cord.position.y=-3.45;rope.add(cord);
  const bucket=new THREE.Mesh(cyl(.20,.15,.33,8,true),new THREE.MeshStandardMaterial({color:0x584e3e,side:THREE.DoubleSide,roughness:.9}));bucket.position.y=-6.8;rope.add(bucket);scene.add(rope);
  const gateRing=new THREE.Mesh(new THREE.TorusGeometry(.16,.028,6,16),new THREE.MeshStandardMaterial({color:0x74604d,metalness:.6,roughness:.7}));gateRing.name='courtyard-gate-ring';gateRing.position.set(.4,1.65,-22.32);scene.add(gateRing);
  const dustN=90,dustData=[],dustPos=new Float32Array(dustN*3);
  for(let i=0;i<dustN;i++)dustData.push({x:r()*70-35,z:r()*62-31,y:.04+r()*.20,speed:1+r()*2.5,phase:r()*6.28});
  const dustMap=canvasTex(64,64,(c,w,h)=>{const a=c.createRadialGradient(w/2,h/2,1,w/2,h/2,w/2);a.addColorStop(0,'rgba(222,199,155,.32)');a.addColorStop(.45,'rgba(222,199,155,.14)');a.addColorStop(1,'rgba(222,199,155,0)');c.fillStyle=a;c.fillRect(0,0,w,h);});
  dustMap.wrapS=dustMap.wrapT=THREE.ClampToEdgeWrapping;
  const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPos,3));
  const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({map:dustMap,color:0xd2b88c,size:3.5,opacity:.18,transparent:true,depthWrite:false}));dust.name='courtyard-ground-dust';dust.frustumCulled=false;scene.add(dust);
  const story=new THREE.Group();story.name='courtyard-story';story.userData={preview:true,localTime:'late afternoon before monsoon',well:{...WELL},stories:['abandoned water jars and shoes above the shelter','messenger bag and broken red seals','closed gate with worn threshold'],clearRadius:ARENA.radius};scene.add(story);
  let time=0,nextGust=4,gustStart=-100,gustDuration=4.6,gustCalled=false,ringCalled=false,nextDrip=7;
  const windRng=rng(161020);
  const stage={sunOffset,fighterLight:{color:0xffebd4,rimColor:0xffd19e,rim:.6,level:.5},stats:{wellDepth:6.25,clearRadius:ARENA.radius,dustParticles:dustN},excite(){},
    update(dt){
      if(!Number.isFinite(dt)||dt<=0)return;time+=Math.min(dt,.1);
      if(time>=nextGust){gustStart=nextGust;nextGust+=9+windRng()*8;gustDuration=3.8+windRng()*1.6;gustCalled=false;ringCalled=false;}
      const age=time-gustStart,u=age/gustDuration,gust=u>=0&&u<=1?Math.sin(u*Math.PI)**2:0;
      for(const c of cloths){
        const p=c.mesh.geometry.attributes.position;
        for(let i=0;i<p.count;i++){
          const xx=c.rest[i*3],yy=c.rest[i*3+1],free=(c.length/2-yy)/c.length;
          p.setZ(i,free*(.1+gust*.6)*Math.sin(xx*2.6-time*3.1+c.phase)+free*free*gust*.3);
        }p.needsUpdate=true;c.mesh.geometry.computeVertexNormals();
      }
      rope.rotation.z=.006*Math.sin(time*.6)+gust*.025;gateRing.rotation.y=gust*.18*Math.sin(time*4);
      for(let i=0;i<dustN;i++){
        const d=dustData[i];d.x+=(.18+gust*2.2)*d.speed*dt;if(d.x>35)d.x-=70;
        dustPos[i*3]=d.x;dustPos[i*3+1]=d.y+.06*Math.sin(time+d.phase);dustPos[i*3+2]=d.z+Math.sin(time*.2+d.phase)*.35;
      }
      dustGeo.attributes.position.needsUpdate=true;dust.material.opacity=.10+gust*.3;
      water.position.y=-6.23+Math.sin(time*.8)*.007;
      if(gust>.65&&!gustCalled){gustCalled=true;stage.emit?.('stageDetail',{kind:'courtyardCloth',amp:.45+gust*.25,pos:{x:-12.5,y:3.6,z:5.1},seed:161020,time});}
      if(age>gustDuration*.88&&!ringCalled){ringCalled=true;stage.emit?.('stageDetail',{kind:'courtyardRing',amp:.36,pos:{x:.4,y:1.65,z:-22.32},seed:161022,time});}
      if(time>=nextDrip){stage.emit?.('stageDetail',{kind:'courtyardDrip',amp:.32,pos:{x:WELL.x,y:-6,z:WELL.z},seed:161021,time});nextDrip+=13+windRng()*7;}
      stage.wind={time,gust,nextGust};
    }};
  // Fighters begin along +X. Rotate scenery so the closed gate frames Maya,
  // while retaining all generic spawn, AI and camera rules.
  const root=new THREE.Group();root.name='courtyard-environment';root.rotation.y=-Math.PI/2;
  for(const object of [...scene.children])if(!before.has(object))root.add(object);
  scene.add(root);
  const localEvent=()=>stage.onEvent;
  const emit=(name,data)=>{const p=data.pos;localEvent()?.(name,{...data,pos:p?{x:-p.z,y:p.y,z:p.x}:p});};
  stage.emit=emit;
  stage.update(.001);return stage;
}

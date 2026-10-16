// Maya's preview: a Rajasthan-inspired sandstone waystation and deep baori.
// Original architecture, not a reconstruction. The duel ground stays flat;
// the well/buildings are outside it. The central water kiosk is real cover.
// No change to the journey yet.
import * as THREE from 'three';
import { buildCourtyardCover } from './stage_courtyard_cover.js';
import { ARENA } from './config.js';
import { Kit, box, cyl, limb, canvasTex, rng } from './stage_kit.js';

const P = { stone:0xc4a37e, pale:0xdbc4a1, rose:0xa47758, dark:0x5d5147,
  recess:0x645f57, wood:0x554137, iron:0x363331, rope:0x988366, cloth:0xbbae8b };
const WELL = { x:-21, z:-1, hx:8, hz:10, depth:6.25 };

// All floor detail is laid out in metres, then baked once. Scenery lies outside
// the fighters' small moving shadow map, so its grounded shade is baked here.
function stoneTexture() {
  const r=rng(161017);
  return canvasTex(512,512,(c,w,h)=>{
    c.fillStyle='#e0d6c4';c.fillRect(0,0,w,h);
    for(let row=0;row<8;row++)for(let col=-1;col<5;col++){
      const x=col*128+(row%2)*64,y=row*64;
      c.fillStyle=`rgba(110,81,50,${.025+r()*.055})`;c.fillRect(x+1,y+1,126,62);
      c.fillStyle='rgba(62,44,29,.15)';c.fillRect(x,y,128,1.6);c.fillRect(x,y,1,64);
      c.fillStyle='rgba(255,244,216,.15)';c.fillRect(x+1,y+2,125,1);
    }
    for(let i=0;i<3000;i++){
      c.fillStyle=`rgba(88,65,42,${.025+r()*.07})`;
      c.fillRect(r()*w,r()*h,1+r()*7,.5+r()*1.2);
    }
  });
}
function pavingTexture() {
  const r=rng(161018),N=1536,unit=N/80;
  const tex=canvasTex(N,N,(c,w,h)=>{
    c.fillStyle='#b8a187';c.fillRect(0,0,w,h);
    c.translate(w/2,h/2);c.scale(unit,unit);
    const poly=(pts,color)=>{c.beginPath();pts.forEach(([x,z],i)=>i?c.lineTo(x,z):c.moveTo(x,z));c.closePath();c.fillStyle=color;c.fill();};
    // Human-scale, uneven sandstone flags, not enormous square floor tiles.
    for(let row=-60;row<61;row++){
      const z=row*.66;let x=-41+(row%2)*.5;
      while(x<41){
        const width=.72+r()*.56,ch=.035+r()*.07;
        poly([[x+.025,z+.02],[x+width-.025,z+.02],[x+width-.02,z+.61-ch],[x+width-ch,z+.63],[x+.02,z+.62]],`hsl(${31+r()*7},${23+r()*7}%,${64+r()*9}%)`);
        if(r()<.13){c.strokeStyle='rgba(82,62,43,.2)';c.lineWidth=.014;c.beginPath();c.moveTo(x+width*.22,z);c.lineTo(x+width*.45,z+.2);c.lineTo(x+width*.38,z+.4);c.stroke();}
        x+=width;
      }
    }
    // Narrow courses outline the well and gallery thresholds without a raised
    // collision lip. Wind fills the joints near walls; the middle stays readable.
    for(const [x,z,ww,dd]of [[-12.5,-1,.32,21],[-21,-11.5,17,.32],[-21,9.5,17,.32],[0,-20.6,55,.35],[23.9,0,.35,40]]){
      c.fillStyle='rgba(133,102,73,.3)';c.fillRect(x-ww/2,z-dd/2,ww,dd);
    }
    for(let i=0;i<140;i++){
      const x=-34+r()*66,z=-29+r()*54;
      if(Math.hypot(x,z)<10&&r()<.9)continue;
      const rad=.7+r()*2.4,g=c.createRadialGradient(x,z,0,x,z,rad);
      g.addColorStop(0,'rgba(202,175,132,.43)');g.addColorStop(1,'rgba(202,175,132,0)');c.fillStyle=g;c.fillRect(x-rad,z-rad,rad*2,rad*2);
    }
    // A worn route from the public entrance to the sealed gate and the water.
    c.lineCap='round';c.lineJoin='round';
    for(const [alpha,width]of [[.045,3.6],[.06,1.9]]){
      c.strokeStyle=`rgba(232,216,186,${alpha})`;c.lineWidth=width;
      c.beginPath();c.moveTo(8,26);c.bezierCurveTo(8,9,1,0,0,-22);c.stroke();
      c.beginPath();c.moveTo(6,8);c.quadraticCurveTo(-2,5,-12,6);c.stroke();
    }
    // Sun in local coordinates (-9, 7, -5). Project roof/wall silhouettes onto
    // the floor, matching the real sun after the environment's quarter turn.
    const shadow=(x0,z0,x1,z1,height)=>{
      const dx=height*9/7,dz=height*5/7;
      c.save();c.shadowColor='rgba(48,42,37,.24)';c.shadowBlur=unit*.18;
      poly([[x0,z0],[x1,z0],[x1+dx,z0+dz],[x1+dx,z1+dz],[x0+dx,z1+dz],[x0,z1]],'rgba(51,46,40,.28)');c.restore();
    };
    shadow(-33,-29,30,-21.3,4.8);shadow(-4.7,-26,4.7,-22,9.3);
    shadow(-34,-27,-33,24,3.1);shadow(25,-20,31,23,4.5);
    shadow(-34,23.4,5.1,25,3);shadow(10.9,23.4,31,25,3);
    for(const x of [-22.9,-18.7,-14.5,-10.3,-6.1,6.1,10.3,14.5,18.7,22.9]){
      shadow(x-.23,-21.9,x+.23,-21.5,4.4);
      c.fillStyle='rgba(51,43,35,.19)';c.fillRect(x-.65,-22.15,1.3,1.1);
    }
    // Ground contact for jars and the well pavilion, rather than floating props.
    shadow(-1.34,-1.05,1.34,1.05,2.9);
    shadow(-33,-3,-28.5,1.3,3.7);
    for(const [x,z]of [[-26,17.7],[-23.3,19.5],[-26,16],[-27,20]]){
      c.fillStyle='rgba(58,54,36,.19)';c.beginPath();c.ellipse(x,z,2.2,1.4,.3,0,Math.PI*2);c.fill();
    }
    for(const [x,z,rad]of [[-12.15,5.6,.6],[-11.8,6.65,.48],[4.9,-20.8,.6]]){
      const g=c.createRadialGradient(x,z,0,x,z,rad);g.addColorStop(0,'rgba(40,35,30,.42)');g.addColorStop(1,'rgba(40,35,30,0)');c.fillStyle=g;c.fillRect(x-rad,z-rad,rad*2,rad*2);
    }
  });
  tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;return tex;
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
  // Deep, connected wings: open colonnade, room wall, solid roof and return
  // walls. The old black rectangles immediately behind the arches were flat.
  for(const side of [-1,1]){
    K.put('stone',box(26,5.05,.8),P.rose,[side*17.4,2.525,-28.3]);
    K.put('stone',box(26,.18,7.3),P.stone,[side*17.4,.09,-25.0]);
    for(let j=0;j<5;j++){
      const x=side*(6.1+j*4.2);column(K,x,.18,-21.7,4.35);
      if(j<4)arch(K,x+side*2.1,.18,-21.7,3.65,4.2,.72,P.stone);
      K.put('stone',box(.45,4.25,6.6),P.rose,[x,2.3,-25]);
      if(j<4){
        const xx=x+side*2.1;
        K.put('interior',box(3.7,3.9,.18),0x978572,[xx,2.15,-27.72]);
        for(const dx of [-1.35,1.35])K.put('stone',box(.95,3.9,.5),P.stone,[xx+dx,2.15,-26.2]);
        K.put('stone',box(3.7,.95,.5),P.stone,[xx,3.72,-26.2]);
        K.put('wood',box(1.4,2.6,.14),j%2?0x755d47:0x493e34,[xx,.18+1.3,-27.55]);
        for(let k=0;k<5;k++)K.put('wood',box(.018,2.5,.03),0x392e27,[xx-.56+k*.28,1.48,-27.46]);
        K.put('stone',box(1.85,.16,1.8),P.pale,[xx,.26,-26.5]);
      }
    }
    K.put('stone',box(26.7,.35,8.0),P.pale,[side*17.4,4.66,-25]);
    K.put('interior',box(25.8,.08,6.9),0x71604f,[side*17.4,4.44,-25]);
    K.put('stone',box(26.6,.7,.5),P.stone,[side*17.4,5.18,-21.45]);
    K.put('stone',box(26.6,.14,.72),P.pale,[side*17.4,5.61,-21.45]);
    for(let j=0;j<9;j++){
      const x=side*(6.2+j*2.9);
      K.put('wood',box(.16,.22,6.6),P.wood,[x,4.27,-24.8]);
      K.put('stone',box(.19,.4,.75),P.rose,[x,4.22,-21.45],[.32,0,0]);
    }
  }
  // Lodging and animal stalls form the east return, joining both enclosure walls.
  K.push([30,0,-1],-Math.PI/2);
  K.put('stone',box(43,4.5,.8),P.stone,[0,2.25,-1]);
  for(let j=0;j<8;j++){
    const x=-19+j*5.25;
    K.put('stone',box(.65,4.4,5.1),P.rose,[x,2.2,1.5]);
    column(K,x,0,4.15,4.3);
    if(j<7){
      arch(K,x+2.62,0,4.15,4.55,4.08,.6);
      K.put('wood',box(1.55,2.65,.13),0x66503c,[x+2.6,1.325,-.51]);
      for(const d of [-1.13,1.13])K.put('stone',box(.35,3,.4),P.pale,[x+2.6+d,1.5,-.25]);
      K.put('stone',box(2.6,.25,.55),P.pale,[x+2.6,3.0,-.24]);
    }
  }
  K.put('stone',box(44,.3,6.8),P.pale,[0,4.5,1.5]);
  K.put('interior',box(43,.05,5.4),0x77634f,[0,4.31,1.5]);
  K.put('stone',box(44,.6,.55),P.stone,[0,4.95,4.5]);
  K.put('stone',box(44,.15,.8),P.pale,[0,5.31,4.5]);
  K.pop();
  // Thick boundary walls make this an enclosed yard at ground level. A real
  // open entrance reveals the road outside; there is no platform under the yard.
  K.put('stone',box(1.1,3.1,54),P.rose,[-34,1.55,-2]);
  K.put('stone',box(1.4,.2,54),P.pale,[-34,3.2,-2]);
  for(const [x,w]of [[-14.45,39.1],[21,20.2]]){
    K.put('stone',box(w,3,1.3),P.stone,[x,1.5,24.5]);
    K.put('stone',box(w,.2,1.6),P.pale,[x,3.1,24.5]);
  }
  for(const x of [4.7,11.3]){
    K.put('stone',box(1.2,5.1,2.4),P.rose,[x,2.55,24.5]);
    K.put('stone',box(1.65,.25,2.8),P.pale,[x,5.18,24.5]);
  }
  arch(K,8,0,24.5,5.4,4.8,1.7);
  K.put('stone',box(8.2,.32,3),P.pale,[8,5.5,24.5]);
  for(let z=-25;z<24;z+=6.2){
    K.put('stone',box(1.65,3.25,.9),P.stone,[-33.7,1.625,z]);
    K.put('stone',box(1.8,.22,1.1),P.pale,[-33.7,3.32,z]);
  }
  for(const x of [-30,-23,-9,-2,16,23,30]){
    K.put('stone',box(.85,3.15,1.65),P.rose,[x,1.575,24.25]);
    K.put('stone',box(1.1,.18,1.85),P.pale,[x,3.24,24.25]);
  }
  for(const [x,w]of [[-14.45,39.1],[21,20.2]])K.put('stone',box(w,.28,1.65),0x9b805e,[x,.14,24.4]);
  pavilion(K,-17,0,24.5,1.05);
}
function regionalStonework(K) {
  // Projecting jharokha bays: brackets carry their weight, the pierced stone
  // screens admit air, and broad chajjas shield the wall from sun and rain.
  K.push([0,1.4,-.65]);
  for(const x of [-2.8,2.8]){
    K.put('stone',box(2.3,2.0,.3),P.stone,[x,6.45,-21.92]);
    for(const dx of [-.76,.76]){
      K.put('stone',box(.27,.65,.8),P.rose,[x+dx,4.9,-21.2],[.48,0,0]);
      K.put('stone',box(.34,.22,1.3),P.stone,[x+dx,5.1,-21.25]);
    }
    K.put('stone',box(2.35,.24,1.65),P.pale,[x,5.42,-21.25]);
    K.put('shade',box(1.85,1.75,.05),0x6b5846,[x,6.38,-21.72]);
    for(const dx of [-1.03,1.03])K.put('stone',box(.21,1.9,1.2),P.stone,[x+dx,6.45,-21.2]);
    K.put('stone',box(2.6,.2,1.9),P.pale,[x,7.48,-21.15]);
    // Diamond jaali: holes remain actual openings between slender stone bars.
    for(let row=0;row<5;row++)for(let col=0;col<5;col++){
      const xx=x-.84+col*.42,yy=5.64+row*.34;
      limb(K,'stone',[xx,yy,-20.57],[xx+.21,yy+.17,-20.57],.035,.035,P.pale,{},5);
      limb(K,'stone',[xx+.21,yy+.17,-20.57],[xx+.42,yy,-20.57],.035,.035,P.pale,{},5);
      limb(K,'stone',[xx,yy,-20.57],[xx+.21,yy-.17,-20.57],.035,.035,P.pale,{},5);
      limb(K,'stone',[xx+.21,yy-.17,-20.57],[xx+.42,yy,-20.57],.035,.035,P.pale,{},5);
    }
    K.put('stone',box(2.1,.14,.15),P.rose,[x,5.58,-20.57]);
    K.put('stone',box(2.1,.14,.15),P.rose,[x,7.32,-20.57]);
    // A shallow curved stone canopy, lower than the gate chhatri.
    K.put('stone',new THREE.SphereGeometry(1.2,12,6,0,Math.PI*2,0,Math.PI/2),P.rose,[x,7.6,-21.15],[0,0,0],[1,.47,.7]);
  }
  K.pop();
}
function surroundings(K) {
  const r=rng(161022);
  // Alluvial ground and low rocky shoulders continue beyond the compound.
  for(let i=0;i<36;i++){
    const a=i/36*Math.PI*2,rad=69+r()*85;
    K.put('earth',new THREE.SphereGeometry(1,9,4,0,Math.PI*2,0,Math.PI/2),i%3?0xa28b70:0x978b77,
      [Math.cos(a)*rad,-.12,Math.sin(a)*rad],[0,r()*6.28,0],[11+r()*22,1.3+r()*5,9+r()*18],{rough:.1,vary:.13});
  }
  // A pale, irregular caravan track leaves the open entrance at the same level.
  for(let j=0;j<27;j++){
    const z=26+j*2.7,x=8+Math.sin(j*.14)*7;
    K.put('road',new THREE.CircleGeometry(4.2+r()*.8,9),0xc7b190,[x,-.075,z],[-Math.PI/2,0,r()*6.28],[1,1.55,1],{vary:.035,noise:.02});
    if(j<26)for(const side of [-1,1]){
      const nextX=8+Math.sin((j+1)*.14)*7+side*1.35,xx=x+side*1.35;
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([xx-.055,-.068,z,xx+.055,-.068,z,nextX+.055,-.068,z+2.7,xx-.055,-.068,z,nextX+.055,-.068,z+2.7,nextX-.055,-.068,z+2.7],3));g.setIndex([0,2,1,3,5,4]);g.computeVertexNormals();
      K.put('road',g,0xb19a7d);
    }
  }
  // A few low houses sit on the earth beyond the walls, giving human scale and
  // a reason for a public water courtyard. No floating skyline facade.
  for(const [x,z,w,d,h]of [[-46,-37,9,8,4.6],[-57,-42,12,8,3.7],[-43,37,10,9,3.8],[37,47,8,7,3.1],[47,54,11,9,4.3],[-49,14,8,6,3.2]]){
    K.put('stone',box(w,h,d),0xaa8d6b,[x,h/2-.1,z], [0,0,0],1,{rough:.045});
    K.put('stone',box(w+.5,.3,d+.5),P.pale,[x,h,z]);
    for(const side of [-1,1])K.put('shade',box(.7,1,.06),0x564a3b,[x+side*w*.23,h*.65,z+d/2+.04]);
    K.put('wood',box(1.4,2,.09),0x5e4a37,[x,1,z+d/2+.06]);
  }
  // Rubble and dry scrub accumulate at the outside foot of walls, not on the
  // combat disk. Scatter remains deterministic and static.
  for(let i=0;i<68;i++){
    const side=i%2?-1:1,x=side*(36+r()*18),z=-32+r()*70;
    K.put('earth',new THREE.DodecahedronGeometry(.15+r()*.38,0),0xb69a78,[x,.05,z],[r(),r()*6.28,r()],[1.5,.6,1],{vary:.17});
    if(i%4===0)for(let k=0;k<4;k++)limb(K,'wood',[x,0,z],[x+(r()-.5)*.7,.4+r()*.45,z+(r()-.5)*.7],.025,.007,0x7f7452);
  }
}
function workingYard(K) {
  // One old shade tree beside the water. Its low, irregular crown and roots
  // supply a familiar ground-level scale without crowding the fighters.
  const tree=[-28,0,16];
  limb(K,'wood',tree,[-28.35,2.7,16.1],.38,.26,0x70624b);
  limb(K,'wood',[-28.35,2.7,16.1],[-27.6,5.0,16.3],.26,.12,0x70624b);
  for(const [x,y,z]of [[-31.1,4.3,15.1],[-25.5,4.8,17.4],[-28.2,5.6,13.3],[-30,5.2,18.2]]){
    limb(K,'wood',[-28.3,2.6,16.1],[x,y,z],.18,.055,0x75664d);
    limb(K,'wood',[x,y,z],[x+.6,y+.7,z-.4],.055,.018,0x75664d);
    K.put('foliage',new THREE.IcosahedronGeometry(1,1),0x81835b,[x,y+.35,z],[0,x,0],[1.85,.85,1.6],{rough:.15,vary:.13});
  }
  for(let i=0;i<7;i++){
    const a=i*Math.PI*2/7;limb(K,'wood',[-28,.2,16],[-28+Math.cos(a)*1.2,.03,16+Math.sin(a)*1.2],.13,.025,0x75664d);
  }
  // A drinking trough and tether rings identify the east wing as a waystation.
  K.put('stone',box(1.25,.18,4.3),P.rose,[23.5,.09,10.5]);
  for(const x of [23,24])K.put('stone',box(.2,.6,4.3),P.stone,[x,.4,10.5]);
  for(const z of [8.45,12.55])K.put('stone',box(1.15,.6,.2),P.stone,[23.5,.4,z]);
  K.put('shade',box(.77,.025,3.8),0x5d6d5d,[23.5,.25,10.5]);
  for(const z of [-9,1,12])K.put('iron',new THREE.TorusGeometry(.12,.025,5,12),P.iron,[25.65,1.1,z],[0,Math.PI/2,0]);
  // A parked handcart: empty axle, spokes, pole, worn boards and tied bundles.
  K.push([21,0,-16],.3);
  K.put('wood',box(2,.16,2.8),0x866545,[0,.8,0]);
  for(const x of [-.94,.94]){
    K.put('wood',box(.13,.7,2.8),P.wood,[x,1.15,0]);
    K.put('wood',new THREE.TorusGeometry(.66,.065,5,12),0x6d5139,[x*1.3,.68,.3],[0,Math.PI/2,0]);
    for(let n=0;n<8;n++){const a=n*Math.PI/4;limb(K,'wood',[x*1.3,.68,.3],[x*1.3,.68+Math.cos(a)*.62,.3+Math.sin(a)*.62],.035,.025,P.wood);}
    limb(K,'wood',[x*.6,.8,1.4],[x*.6,.14,4.2],.07,.04,P.wood);
  }
  limb(K,'iron',[-1.35,.68,.3],[1.35,.68,.3],.065,.065,P.iron);
  for(let i=0;i<3;i++)K.put('cloth',box(.75,.42,.85),i%2?0xa29475:0x877658,[-.45+i%2*.9,1.1+Math.floor(i/2)*.42,-.65],[0,.08*i,0],1,{rough:.05});
  K.pop();
  // Drain stone follows the water-side edge; dark seam is shallow and recessed.
  K.put('shade',box(.16,.012,21),0x81705b,[-11.4,.007,-.5]);
  for(let i=0;i<28;i++)for(const dx of [-.2,.2])K.put('stone',box(.19,.035,.68),P.pale,[-11.4+dx,.009,-10.8+i*.76]);
  // Repair patches and old lime plaster catch sidelight on the large wall faces.
  const r=rng(161023);
  for(let i=0;i<38;i++){
    const x=-31+r()*62,y=.35+r()*3.3;
    if(Math.abs(x)<4.9)continue;
    K.put('stone',box(.4+r()*1.2,.18+r()*.65,.035),i%3?0xb59c7d:0xcfbea0,[x,y,-27.86],[0,0,(r()-.5)*.05],1,{rough:.03,vary:.1});
  }
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
  const raw=K.put.bind(K);K.put=(bin,g,color,pos,rot,scale,opt)=>{const result=raw(bin,g,color,pos,rot,scale,bin==='stone'?{uv:'box',uvScale:1/3,...opt}:opt);g.dispose();return result;};
  const {x,z,hx,hz}=WELL;
  // Paving ends under the enclosure. The soil continues beneath it and outside
  // at almost the same elevation, never as the edge of a raised square slab.
  const floorRects=[[-34,x-hx,-29,25],[x+hx,31,-29,25],[x-hx,x+hx,-29,z-hz],[x-hx,x+hx,z+hz,25]];
  // Split long floor triangles: a close oblique view otherwise showed flat
  // clamped-texture wedges in the renderer, despite correct CPU rays/UVs.
  for(const [x0,x1,z0,z1]of floorRects)K.put('floor',box(x1-x0,.16,z1-z0,Math.ceil((x1-x0)/3),1,Math.ceil((z1-z0)/3)),0xffffff,[(x0+x1)/2,-.08,(z0+z1)/2],[0,0,0],1,{vary:0,noise:0});
  for(const g of K.bins.floor){const p=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+40)/80,(40-p.getZ(i))/80);}
  K.put('shade',box(16,.2,20),0x40534a,[x,-6.5,z]);
  for(const [x0,x1,z0,z1]of [[-210,-34,-210,210],[31,210,-210,210],[-34,31,-210,-29],[-34,31,25,210]])
    K.put('earth',box(x1-x0,.5,z1-z0),0xb3a084,[(x0+x1)/2,-.35,(z0+z1)/2],[0,0,0],1,{vary:.025,noise:.015});
  architecture(K);stepwell(K);traces(K);surroundings(K);workingYard(K);regionalStonework(K);buildCourtyardCover(K,P);
  for(let i=0;i<75;i++){
    const a=r()*Math.PI*2,rad=12+r()*22,px=Math.cos(a)*rad,pz=Math.sin(a)*rad;
    if(px<x-hx||px>30||pz<-28||pz>24||(px<x+hx&&pz>z-hz&&pz<z+hz))continue;
    K.put('sand',new THREE.CircleGeometry(.4+r()*1.4,7),0xc4ad87,[px,.012,pz],[-Math.PI/2,0,r()*6.28],[1,.5+r()*.4,1],{vary:.1});
  }
  const stoneMap=stoneTexture();
  const materials={
    cover:new THREE.MeshStandardMaterial({vertexColors:true,map:stoneMap,roughness:1}),
    stone:new THREE.MeshStandardMaterial({vertexColors:true,map:stoneMap,roughness:1}),
    floor:new THREE.MeshStandardMaterial({vertexColors:true,map:pavingTexture(),roughness:.98}),
  };
  for(const name of ['wood','iron','rope','cloth','pot','wax','sand','shade','earth','interior','road','foliage'])materials[name]=new THREE.MeshStandardMaterial({vertexColors:true,roughness:name==='iron'?.8:1,side:['cloth','pot'].includes(name)?THREE.DoubleSide:THREE.FrontSide});
  materials.sand.transparent=true;materials.sand.opacity=.14;materials.sand.depthWrite=false;
  for(const [bin,mat]of Object.entries(materials)){
    const mesh=K.mesh(bin,mat,{cast:false,receive:true,light:bin==='stone'?(xx,yy,zz)=>{
      let d=Math.min(0,yy)*.07;
      if(yy>.2&&yy<4.5&&Math.abs(xx)>5&&zz<-21.7&&zz>-29)d-=.4*THREE.MathUtils.smoothstep(-zz,21.7,26.2);
      if(yy>.2&&yy<4.3&&xx>25.8&&Math.abs(zz)<22)d-=.36*THREE.MathUtils.smoothstep(xx,25.8,29.2);
      return [d,d,d*.92];
    }:null});
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

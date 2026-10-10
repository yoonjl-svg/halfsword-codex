// Clear summer noon above a fictional great-river gorge and granite mountain trail.
// All scenery is visual only. The shared duel plane/physics remain untouched.
import * as THREE from 'three';
import { Kit, rng, canvasTex, box, cyl, limb } from './stage_kit.js';
import { buildQinglanVista } from './stage_qinglan_vista.js';

class OwnedKit extends Kit {
  putM(bin, geo, color, matrix, options = {}) {
    try { return super.putM(bin, geo, color, matrix, options); }
    finally { geo.dispose(); }
  }
}
function geo(points) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(points.flatMap((_,i) => i%3 ? [] : [(points[i]+32)/64,(points[i+2]+32)/64]), 2));
  g.computeVertexNormals(); return g;
}
function terraceMap() {
  const r = rng(801301);
  return canvasTex(1024,1024,(g,w,h)=>{
    g.fillStyle='#b2b9ab';g.fillRect(0,0,w,h);
    for(let i=0;i<250;i++){
      const x=r()*w,y=r()*h,rad=12+r()*100;
      const grad=g.createRadialGradient(x,y,0,x,y,rad);
      grad.addColorStop(0,i%4?'rgba(238,240,230,.13)':'rgba(84,91,82,.15)');grad.addColorStop(1,'rgba(145,145,111,0)');
      g.fillStyle=grad;g.fillRect(x-rad,y-rad,rad*2,rad*2);
    }
    for(let i=0;i<34;i++){
      let x=r()*w,y=r()*h;const angle=r()*Math.PI*2;
      g.beginPath();g.moveTo(x,y);
      for(let j=0;j<7;j++){x+=Math.cos(angle+(r()-.5)*.9)*(8+r()*30);y+=Math.sin(angle+(r()-.5)*.9)*(8+r()*30);g.lineTo(x,y);}
      g.strokeStyle=i%4?'rgba(83,90,70,.46)':'rgba(231,235,220,.45)';g.lineWidth=i%4?1.1:2.6;g.stroke();
    }
    for(let i=0;i<9000;i++){
      g.fillStyle=i%2?'rgba(242,244,231,.14)':'rgba(71,77,56,.10)';g.fillRect(r()*w,r()*h,.7+r()*1.8,.5+r());
    }
    // Worn traffic track: no artificial paving grid across the natural rock.
    g.lineCap='round';g.strokeStyle='rgba(226,223,202,.12)';g.lineWidth=66;
    g.beginPath();g.moveTo(80,130);g.bezierCurveTo(220,460,670,660,900,600);g.stroke();
  });
}
const rim = a => 23.5 - 9*Math.max(0,Math.cos(a))**3 + .55*Math.sin(3*a+.4)+.35*Math.sin(9*a);
function terrace(K) {
  const top=[],sides=[]; const n=72,levels=[0,4,8,11.8,1];
  const point=(i,j)=>{const a=i/n*Math.PI*2;const radius=j===4?rim(a):levels[j];return [Math.cos(a)*radius,j===4?.13*Math.sin(a*7):0,Math.sin(a)*radius*.94];};
  for(let j=0;j<4;j++)for(let i=0;i<n;i++){
    const a=point(i,j),b=point(i+1,j),c=point(i,j+1),d=point(i+1,j+1);
    if(j===0)top.push(...a,...d,...c);else top.push(...a,...b,...c,...b,...d,...c);
  }
  K.put('floor',geo(top),0xffffff);
  for(let j=0;j<4;j++)for(let i=0;i<n;i++){
    const p=(u,l)=>{const a=u/n*Math.PI*2,d=rim(a)+(l===4?8:l*.7)+Math.sin(a*13+l)*.4;return [Math.cos(a)*d,-l*7,Math.sin(a)*d*.94];};
    const a=p(i,j),b=p(i+1,j),c=p(i,j+1),d=p(i+1,j+1);sides.push(...a,...b,...c,...b,...d,...c);
  }
  K.put('rock',geo(sides),0x899582,undefined,undefined,1,{noise:.08});
}
function pine(K,x,y,z,scale,seed){
  const r=rng(seed);K.push([x,y,z],r()*6.28,scale);
  const bends=[[0,0,0],[.18,1.7,.08],[-.25,3.1,.2],[.3,4.2,0]];
  for(let i=0;i<3;i++)limb(K,'wood',bends[i],bends[i+1],.17-i*.04,.12-i*.035,0x645d48,{},7);
  for(let i=0;i<5;i++){
    const a=i*2.4+r()*.3,base=[-.18,1.8+i*.44,.1],end=[Math.cos(a)*(1.2+r()*.4),2.5+i*.42,Math.sin(a)*(1+r()*.6)];
    limb(K,'wood',base,end,.075,.025,0x5b5743,{},6);
    const points=[],rad=1.3+r()*.3;
    for(let j=0;j<12;j++){
      const a=j/12*Math.PI*2,b=(j+1)/12*Math.PI*2;
      points.push(end[0],end[1]+.48,end[2],end[0]+Math.cos(a)*rad,end[1]+.06+Math.sin(a*5)*.1,end[2]+Math.sin(a)*rad*.7,end[0]+Math.cos(b)*rad,end[1]+.06+Math.sin(b*5)*.1,end[2]+Math.sin(b)*rad*.7);
    }
    K.put('leaf',geo(points),i%2?0x34583b:0x466b42,undefined,undefined,1,{vary:.08});
  }K.pop();
}
function graniteBack(K){
  // A continuous broken granite shoulder: broad slabs and ridges, not boulder domes.
  const p=[],n=52,rows=7;
  const at=(i,j)=>{
    const z=-78+i*3,t=j/rows;
    const crest=11+5*Math.sin(i*.32)+4*Math.sin(i*.79+.6)+2*Math.sin(i*1.67);
    const fold=1.8*Math.sin(i*.6)+.6*Math.sin(i*2.6+j*.9);
    return [-22.5-16*t-fold-2*Math.sin(t*8+i*.2),-9+(crest+9)*t,z];
  };
  for(let i=0;i<n;i++)for(let j=0;j<rows;j++){
    const a=at(i,j),b=at(i+1,j),c=at(i,j+1),d=at(i+1,j+1);p.push(...a,...c,...b,...b,...c,...d);
  }
  const wall=K.put('rock',geo(p),0x88978b,undefined,undefined,1,{vary:.04});
  const wp=wall.attributes.position,wn=wall.attributes.normal,wc=wall.attributes.color;
  const rockColor=new THREE.Color(0x89968b),pineFloor=new THREE.Color(0x537044),tone=new THREE.Color();
  for(let i=0;i<wp.count;i++){
    const growth=Math.max(0,Math.sin(wp.getZ(i)*.25+wp.getY(i)*.14))*.5+Math.max(0,wn.getY(i)-.45)*.6;
    tone.copy(rockColor).lerp(pineFloor,Math.min(.8,growth));wc.setXYZ(i,tone.r,tone.g,tone.b);
  }
  for(const i of [8,14,20,28,36,44]){const v=at(i,rows);pine(K,v[0],v[1]-.2,v[2],.9+(i%3)*.12,9111+i);}
  for(let i=0;i<15;i++){
    const z=-64+i*9,x=-28-3*Math.sin(i*.9),y=1.2+Math.max(0,Math.sin(i*.7))*3;
    K.put('rock',box(4.8,3.6,6.1),i%2?0x8e998c:0xa2aaa0,[x,y-.8,z],[.16*Math.sin(i),.12*Math.sin(i*2),.1],1,{rough:.35,noise:.04});

  }
}
function restAndTrail(K) {
  graniteBack(K);
  // Stone stairs hug the rear mountain, with a masonry foundation continuing downward.
  for(const sign of [-1,1])for(let i=0;i<22;i++){
    const z=sign*(17+i*1.35),x=-14-i*.52-Math.sin(i*.25)*1.1,y=i*.33;
    K.put('rock',box(3.7,8+y,1.65),0x949f95,[x,y/2-4,z],[0,sign*-.3,0],1,{rough:.12,vary:.06});
    K.put('stone',box(3.6,.18,1.53),i%3?0xb5bcad:0xa8b4a9,[x,y+.03,z],[0,sign*-.3,0],1,{rough:.04});
    if(i%3===0){
      const px=x+1.75;K.put('stone',box(.23,1,.23),0xa8b1a4,[px,y+.5,z],undefined,1,{rough:.025});
      K.put('stone',cyl(.19,.16,.14,6),0xbbc1b3,[px,y+1.02,z]);
      if(i<20)limb(K,'stone',[px,y+.78,z],[px-1.6,y+1.77,z+sign*4.05],.075,.075,0xa3aea1,{},5);
    }
  }
  // Small roadside shelter: curved dark roof and a plain stone bench.
  K.push([-17,0,12],-.18);
  for(const x of [-1.8,1.8])for(const z of [-1.3,1.3]){
    K.put('stone',cyl(.18,.24,.26,8),0x9bada2,[x,.13,z]);limb(K,'wood',[x,.2,z],[x,3,z],.1,.085,0x716451,{},7);
  }
  for(const z of [-1.35,1.35])limb(K,'wood',[-2,2.75,z],[2,2.75,z],.1,.1,0x766c58,{},6);
  for(const sign of [-1,1])for(let i=0;i<22;i++){
    const x=-2.18+i*.21,strip=[];
    const roof=(xx,t)=>[xx,3.42-.75*Math.sin(t*Math.PI/2)+.23*t**6,sign*t*1.9];
    for(let j=0;j<8;j++){
      const a=roof(x,j/8),b=roof(x+.215,j/8),c=roof(x,(j+1)/8),d=roof(x+.215,(j+1)/8);
      if(sign===1)strip.push(...a,...c,...b,...b,...c,...d);else strip.push(...a,...b,...c,...b,...d,...c);
    }
    K.put('roof',geo(strip),i%3?0x465854:0x55665f);
  }
  limb(K,'roof',[-2.25,3.43,0],[2.25,3.43,0],.10,.10,0x677b72,{},6);
  K.put('stone',box(2.7,.18,.75),0x969f92,[0,.63,.52],undefined,1,{rough:.025});
  for(const x of [-.85,.85])K.put('stone',box(.36,.54,.57),0x88978a,[x,.27,.52]);
  K.put('shade',box(3.8,.012,2.8),0x87947b,[0,.012,0]);K.pop();
  // Keep the accepted visible spring/audio source in exactly the same place.
  K.put('rock',box(2.1,2.1,1.7),0x718776,[-18.1,.8,-8.5],[.08,-.2,-.13],1,{rough:.22});
  K.put('rock',box(2.5,.42,1.2),0x697d6b,[-17.2,1.85,-8],[.05,.14,-.08],1,{rough:.13});
  K.put('stone',cyl(.64,.80,.22,12),0x899681,[-17,.13,-8]);
  K.put('water',cyl(.55,.55,.01,16),0x6c9f9b,[-17,.247,-8]);
  pine(K,-15,0,-15,1.2,81265);pine(K,-15,0,17,1.3,81267);
  // Sparse edge greenery and stone shards frame the water, leaving the duel clear.
  for(const sign of [-1,1])for(let i=0;i<7;i++){
    const x=3+i*1.7,z=sign*(15.2-i*.85);
    K.put('stone',box(.8,.16,.45),i%2?0x9eaa98:0xadb7a7,[x,.05,z],[.06,i*.6,0],1,{rough:.1});
    for(let j=0;j<5;j++){
      const px=x+.23+j*.13,pz=z+.2;
      K.put('leaf',geo([px,.01,pz,px+.19,.23+j*.055,pz+.08,px+.045,.01,pz+.10]),j%2?0x6a8550:0x8c9867);
    }
  }
}
function sky(scene) {
  const tex=canvasTex(8,256,(g,w,h)=>{const grad=g.createLinearGradient(0,0,0,h);
    grad.addColorStop(0,'#4e9bc7');grad.addColorStop(.45,'#9ec9d9');grad.addColorStop(.53,'#c6dddc');grad.addColorStop(1,'#aac8c5');g.fillStyle=grad;g.fillRect(0,0,w,h);});
  tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(360,32,16),new THREE.MeshBasicMaterial({map:tex,side:THREE.BackSide,depthWrite:false,fog:false}));mesh.name='qinglan-sky';scene.add(mesh);
}
function smallBird(scene) {
  const mat=new THREE.MeshBasicMaterial({color:0x263c36,side:THREE.DoubleSide});
  const group=new THREE.Group();group.name='qinglan-cliff-bird';
  const left=new THREE.Mesh(geo([0,0,0,-.55,0,.08,-.22,0,-.12]),mat);
  const right=new THREE.Mesh(geo([0,0,0,.55,0,.08,.22,0,-.12]),mat);
  group.add(left,right);group.visible=false;scene.add(group);return{group,left,right};
}
export function buildQinglan(scene,{hemi,sun}) {
  scene.background=new THREE.Color(0xb9d4d5);scene.fog=new THREE.Fog(0x9bbbc7,130,420);
  hemi.color.setHex(0xd5e9ff);hemi.groundColor.setHex(0x576458);hemi.intensity=1.65;
  sun.color.setHex(0xfff7ed);sun.intensity=2.5;
  sky(scene);const vista=buildQinglanVista(scene),K=new OwnedKit(801311);terrace(K);restAndTrail(K);
  const floorMap=terraceMap();floorMap.repeat.set(2,2);
  const mats={floor:new THREE.MeshStandardMaterial({vertexColors:true,map:floorMap,roughness:.91}),
    rock:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94}),stone:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9}),
    wood:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92}),roof:new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.91}),leaf:new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1}),
    shade:new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),water:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.37,metalness:.02})};
  for(const [name,mat]of Object.entries(mats)){const mesh=K.mesh(name,mat,{cast:name==='wood'||name==='stone'||name==='roof',receive:true});
    if(!mesh){mat.dispose();continue;}mesh.name='qinglan-'+name;scene.add(mesh);for(const g of K.bins[name])g.dispose();}
  const drop=new THREE.Mesh(new THREE.SphereGeometry(.04,6,4),new THREE.MeshBasicMaterial({color:0xc1e0dd}));drop.name='qinglan-spring-drop';drop.visible=false;scene.add(drop);
  const bird=smallBird(scene),r=rng(801319);let time=0,nextDrip=3.2,nextBird=11,birdStart=-100,birdCalled=false;
  const stage={sunOffset:{x:4,y:14,z:-5},fighterLight:{color:0xe4ede7,rimColor:0xc4dfe4,rim:.8,level:.35},stats:vista.stats,excite(){},
    update(dt){
      if(!Number.isFinite(dt)||dt<=0)return;time+=Math.min(dt,.1);
      if(time>=nextBird){birdStart=time;birdCalled=false;nextBird=time+33+r()*13;}
      const pass=time-birdStart;bird.group.visible=pass>=0&&pass<5.2;
      if(bird.group.visible){bird.group.position.set(48+Math.sin(pass*.8)*2,6+Math.sin(pass)*.8,12+pass*3.4);
        bird.group.rotation.y=-Math.PI/2;bird.left.rotation.z=Math.sin(time*8)*.22;bird.right.rotation.z=-Math.sin(time*8)*.22;
        if(pass>=1&&!birdCalled){birdCalled=true;stage.onEvent?.('stageDetail',{kind:'cliffBird',amp:.85,pos:{...bird.group.position},seed:8013,time});}}
      // Position of the actual falling drop at the same simulation time as its plink.
      const until=nextDrip-time;drop.visible=until>0&&until<.42;
      if(drop.visible)drop.position.set(-17,1.55-1.28*(1-until/.42)**2,-8);
      if(time>=nextDrip){
        if(Math.abs(time-(birdStart+1))>2.1&&Math.abs(time-(nextBird+1))>2.1)
          stage.onEvent?.('stageDetail',{kind:'springDrip',amp:.8,pos:{x:-17,y:.25,z:-8},seed:8014,time});
        nextDrip=time+2.8+r()*2.2;
      }
    }};return stage;
}

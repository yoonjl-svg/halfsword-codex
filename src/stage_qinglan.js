// Clear early-summer noon on a broad rest terrace above a fictional karst gorge.
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
    g.fillStyle='#bcbeb2';g.fillRect(0,0,w,h);
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
function restAndTrail(K) {
  // Rear flank keeps the terrace attached to the mainland, rather than a floating island.
  for(let i=0;i<11;i++){
    const z=-45+i*9,x=-29-3*Math.cos(i*.7),height=27+(i%3)*3;
    K.put('rock',new THREE.IcosahedronGeometry(1,1),0x909b85,[x,height/2-23,z],undefined,[10,height/2,8],{noise:.08});
  }
  for(const sign of [-1,1])for(let i=0;i<8;i++){
    const z=sign*(19+i*3.2),x=-15-i*1.35-Math.sin(i*.7)*1.5,y=i*.35;
    // Each path segment is supported by a cliff buttress continuing to the ravine bed.
    K.put('rock',box(4.9,2+i*.9,3.8),0x9c9e84,[x,y-1-i*.45,z],[0,sign*-.35,0],1,{rough:.08,vary:.03});
    K.put('stone',box(4.6,.16,3.7),0xbbbea1,[x,y+.01,z],[0,sign*-.35,0],1,{rough:.035});
    if(i%2===0){const px=x+2.4;limb(K,'wood',[px,y,z],[px,y+1,z],.06,.04,0x71664b,{},6);
      if(i<6)limb(K,'wood',[px,y+.82,z],[px-2.7,y+1.5,z+sign*6.4],.045,.035,0x75664a,{},5);}
  }
  // A few weathered stones and dry grass mark the terrace edge without enclosing the vista.
  for(const sign of [-1,1])for(let i=0;i<5;i++){
    const x=6+i*1.5,z=sign*(14-i*.85);
    K.put('stone',new THREE.IcosahedronGeometry(1,0),i%2?0x999e8c:0xa7ad98,[x,.08,z],undefined,[.36+i*.05,.11,.26],{noise:.05});
    for(let j=0;j<4;j++){
      const px=x+.23+j*.13,pz=z+.2,height=.22+j*.045;
      K.put('leaf',geo([px,.01,pz,px+.12,height,pz+.06,px+.045,.01,pz+.09]),j%2?0x7b905d:0x8d9669);
    }
  }
  // Woven reed shade and a simple stone bench, just outside the camera orbit.
  K.push([-17,0,12],-.18);
  for(const x of [-1.7,1.7])for(const z of [-1.2,1.2])limb(K,'wood',[x,0,z],[x,2.7,z],.095,.075,0x706547,{},7);
  for(const z of [-1.3,1.3])limb(K,'wood',[-1.95,2.55,z],[1.95,2.55,z],.09,.08,0x6a6147,{},6);
  for(let i=0;i<20;i++)K.put('wood',box(.17,.075,3.05),i%3?0x9e9467:0xb1a67b,[-1.9+i*.2,2.64+Math.sin(i*.22)*.04,0],[.035,0,0],1);
  K.put('stone',box(2.7,.18,.75),0x969c85,[0,.63,.52],undefined,1,{rough:.025});
  for(const x of [-.85,.85])K.put('stone',box(.36,.54,.57),0x889480,[x,.27,.52]);
  K.put('shade',box(3.7,.012,2.6),0x87947b,[0,.012,0]);K.pop();
  // Seeping spring in a low shaded rock niche. No rain or large waterfall.
  K.put('rock',new THREE.IcosahedronGeometry(1,1),0x718771,[-18.2,1.1,-8.6],undefined,[1.4,1.5,1.2]);
  K.put('rock',new THREE.IcosahedronGeometry(1,0),0x63765f,[-17,1.85,-8],undefined,[1.2,.4,.6]);
  K.put('stone',cyl(.64,.80,.22,12),0x899681,[-17,.13,-8]);
  K.put('water',cyl(.55,.55,.01,16),0x6c9f9b,[-17,.247,-8]);
  const r=rng(801327);
  for(let i=0;i<34;i++){
    const a=r()*Math.PI*2,d=17.5+r()*5;
    if(Math.cos(a)>.15)continue;
    const x=Math.cos(a)*d,z=Math.sin(a)*d*.94;
    for(let j=0;j<5;j++){
      const b=j/5*Math.PI*2+r()*.3,len=.4+r()*.4;
      const points=[x,.04,z,x+Math.cos(b)*len*.55,.18+r()*.2,z+Math.sin(b)*len*.55,x+Math.cos(b)*len,.1,z+Math.sin(b)*len];
      K.put('leaf',geo(points),j%2?0x628a48:0x487743);
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
  scene.background=new THREE.Color(0xb9d4d5);scene.fog=new THREE.Fog(0xb7d2d2,110,300);
  hemi.color.setHex(0xd5e9ff);hemi.groundColor.setHex(0x576458);hemi.intensity=1.65;
  sun.color.setHex(0xfff7ed);sun.intensity=2.5;
  sky(scene);const vista=buildQinglanVista(scene),K=new OwnedKit(801311);terrace(K);restAndTrail(K);
  const floorMap=terraceMap();floorMap.repeat.set(2,2);
  const mats={floor:new THREE.MeshStandardMaterial({vertexColors:true,map:floorMap,roughness:.91}),
    rock:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94}),stone:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9}),
    wood:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92}),leaf:new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1}),
    shade:new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),water:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.37,metalness:.02})};
  for(const [name,mat]of Object.entries(mats)){const mesh=K.mesh(name,mat,{cast:name==='wood'||name==='stone',receive:true});
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

// Caravan disguise / interrupted conspiracy. Scenery only: no Fighters or combat AI.
import * as T from 'three';
import {workshop} from './stage_night_second.js';
import {canvasTex} from './stage_kit.js';
import {addDayrFarSide,DAYR_FAR_SIDE} from './stage_dayr_far_side.js';

const V=p=>new T.Vector3(...p);
function rope(w,points,r,color){w.put(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(V)),18,r,5,false),color);}
function blob(w,scale,color,p){w.put(new T.SphereGeometry(1,12,8),color,p,undefined,scale);}
function cloth(root,name,color,rows,width){
 const p=[],uv=[],idx=[],n=16;
 for(let j=0;j<rows.length;j++)for(let i=0;i<=n;i++){
  const u=i/n,[x,y,z]=rows[j];p.push(x+(u-.5)*width,y+.014*Math.sin(u*21+j),z+.025*Math.sin(u*13+j*.7));uv.push(u,j/(rows.length-1));
  if(j<rows.length-1&&i<n){const k=j*(n+1)+i;idx.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2);}
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
 const m=new T.Mesh(geo,new T.MeshStandardMaterial({color,roughness:.97,side:T.DoubleSide}));m.name=name;m.castShadow=true;root.add(m);return m;
}
function parcel(w,p,scale=1,color=0x927453){
 const [x,y,z]=p;blob(w,[.39*scale,.24*scale,.31*scale],color,[x,y+.23*scale,z]);
 for(const dz of [-.13,.13])rope(w,[[x-.36*scale,y+.12*scale,z+dz*scale],[x-.23*scale,y+.44*scale,z+dz*scale],[x+.22*scale,y+.44*scale,z+dz*scale],[x+.36*scale,y+.12*scale,z+dz*scale]],.013,0xb2a183);
 blob(w,[.07,.055,.045],0xb2a183,[x,y+.48*scale,z]);
}
function camel(root,index,pos,yaw,{kneeling=false,color=0xa58a63}={}){
 const group=new T.Group();group.name=`dayr-caravan-camel-${index}`;group.position.set(...pos);group.rotation.y=yaw;root.add(group);
 group.userData={visualOnly:true,animal:'dromedary',kneeling};
 const shadowMap=canvasTex(64,64,c=>{const a=c.createRadialGradient(32,32,2,32,32,31);a.addColorStop(0,'rgba(21,24,25,.30)');a.addColorStop(.55,'rgba(21,24,25,.15)');a.addColorStop(1,'rgba(21,24,25,0)');c.fillStyle=a;c.fillRect(0,0,64,64);});
 const shadow=new T.Mesh(new T.PlaneGeometry(3.1,1.7),new T.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.014;shadow.name='dayr-camel-contact-shadow';group.add(shadow);
 const w=workshop(group,172010+index),leather=0x514538,fur=color,low=kneeling?.73:0,bodyY=1.41-low;
 blob(w,[.95,.48,.43],fur,[0,bodyY,0]);blob(w,[.39,.53,.32],fur,[-.12,1.80-low,0]);
 blob(w,[.39,.38,.40],fur,[.62,1.50-low,0]);
 // Tapered bent neck, a long muzzle and divided feet carry the camel silhouette.
 const neck=[[.65,1.45-low,0],[.91,1.62-low,0],[1.03,1.99-low,0],[1.23,2.21-low,0]];
 for(let i=0;i<neck.length-1;i++){w.rod(neck[i],neck[i+1],.16-i*.027,fur);blob(w,[.17-i*.025,.19,.17-i*.025],fur,neck[i]);}
 for(const x of [-.63,.61])for(const side of [-1,1]){
  const z=side*.29;
  const hip=[x,1.27-low,z],knee=kneeling?[x+.21,.22,z+side*.07]:[x+(x<0?-.12:.07),.68,z];
  const ankle=kneeling?[x-.22,.13,z+side*.07]:[x+(x<0?-.05:.02),.15,z];
  w.rod(hip,knee,.075,fur);w.rod(knee,ankle,.052,fur);blob(w,[.085,.095,.077],fur,knee);
  for(const dz of [-.035,.035])blob(w,[.14,.065,.055],0x78694f,[ankle[0]+.065,.065,ankle[2]+dz]);
 }
 rope(w,[[-.85,1.45-low,0],[-1.01,1.08-low,.03],[-1.05,.70-low/2,.06]],.026,fur);
 blob(w,[.055,.13,.045],0x5a4a38,[-1.05,.67-low/2,.06]);
 const blanket=cloth(group,'dayr-camel-saddlecloth',index===1?0x5c7974:0x864f48,[[0,1.45-low,-.51],[0,1.88-low,-.36],[0,2.29-low,-.18],[0,2.35-low,0],[0,2.29-low,.18],[0,1.88-low,.36],[0,1.45-low,.51]],1.10);
 const clothP=blanket.geometry.attributes.position;
 for(let i=0;i<clothP.count;i++){
  const q=1-((clothP.getX(i)+.12)/.39)**2-(clothP.getZ(i)/.32)**2;
  if(q>0)clothP.setY(i,Math.max(clothP.getY(i),1.80-low+.53*Math.sqrt(q)+.07));
 }
 blanket.geometry.computeVertexNormals();
 for(const side of [-1,1]){
  for(let i=0;i<7;i++)w.rod([-.45+i*.15,1.48-low,side*.52],[-.45+i*.15,1.36-low,side*.53],.009,0xc0a477);
  parcel(w,[-.26,1.08-low,side*.60],.91,index===1?0xa59674:0x9c805e);
  rope(w,[[-.65,1.43-low,side*.39],[0,1.01-low,side*.47],[.63,1.43-low,side*.39]],.022,leather);
 }
 w.finish(`dayr-camel-${index}-body`);
 const head=new T.Group();head.name='dayr-camel-head';head.position.set(1.24,2.20-low,0);group.add(head);
 const h=workshop(head,172020+index);
 blob(h,[.23,.17,.15],fur,[.05,0,0]);blob(h,[.24,.105,.13],fur,[.26,-.075,0]);
 blob(h,[.16,.045,.10],0x847052,[.28,-.16,0]);
 for(const s of [-1,1]){
  blob(h,[.065,.11,.035],fur,[-.12,.14,s*.13]);blob(h,[.045,.07,.018],0x81694d,[-.10,.15,s*.15]);
  blob(h,[.026,.023,.014],0x171d23,[.115,.033,s*.143]);
  h.rod([.06,.066,s*.15],[.17,.062,s*.14],.012,0x6b5843);
  h.rod([.33,-.06,s*.13],[.38,-.055,s*.12],.011,0x403a31);
  rope(h,[[-.12,.08,s*.13],[.18,-.02,s*.15],[.37,-.07,s*.12]],.011,leather);
 }
 h.finish(`dayr-camel-${index}-head`);
 const tether=workshop(group,172030+index);
 rope(tether,[[1.5,2.08-low,.09],[1.79,1.29-low*.5,.13],[2.04,.34,.17],[2.12,.18,.17]],.012,0x9d8b67);
 tether.rod([2.12,.02,.17],[2.12,.39,.17],.035,0x66513b);tether.finish(`dayr-camel-${index}-tether`);
 const base=Float32Array.from(blanket.geometry.attributes.position.array);
 return t=>{head.rotation.y=.045*Math.sin(t*.31+index*2);head.rotation.z=.022*Math.sin(t*.43+index);const p=blanket.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,base[i*3+2]+.012*Math.sin(t*1.2+i*.44+index));p.needsUpdate=true;};
}
function dagger(w,p,yaw=0){
 const shape=new T.Shape();shape.moveTo(-.033,0);shape.lineTo(-.025,.24);shape.lineTo(0,.34);shape.lineTo(.025,.24);shape.lineTo(.033,0);shape.closePath();
 const g=new T.ExtrudeGeometry(shape,{depth:.012,bevelEnabled:false});g.rotateX(-Math.PI/2);g.rotateY(yaw);w.put(g,0xb2b6b4,p);
 const dir=[Math.sin(yaw),Math.cos(yaw)];w.rod([p[0]+dir[0]*.02,p[1]+.012,p[2]+dir[1]*.02],[p[0]+dir[0]*.15,p[1]+.012,p[2]+dir[1]*.15],.025,0x51413b);
 w.box([.14,.025,.027],0x9c855b,[p[0],p[1]+.013,p[2]],[0,yaw,0]);
}
function fallen(root,index,pos,yaw,clothColor){
 const g=new T.Group();g.name=`dayr-fallen-conspirator-${index}`;g.position.set(...pos);g.rotation.y=yaw;g.userData={visualOnly:true,pose:'fallen',combatant:false};root.add(g);
 const w=workshop(g,172050+index),skin=0xa68669,wrap=0xc0b49a;
 // Lying on the side; no wounds, dismemberment, colliders or death simulation.
 blob(w,[.23,.16,.40],clothColor,[0,.20,0]);blob(w,[.21,.14,.24],0x5f5345,[0,.18,.40]);
 for(const s of [-1,1]){
  const knee=[s*.14,.13,.88+s*.10],foot=[s*.18+.1,.07,1.29+s*.08];
  w.rod([s*.12,.19,.47],knee,.095,clothColor);w.rod(knee,foot,.065,clothColor);blob(w,[.085,.075,.15],0x493e34,[foot[0],foot[1],foot[2]+.07]);
  const elbow=[s*.35,.13,-.05+s*.12],hand=[s*.43,.06,-.41+s*.14];
  w.rod([s*.19,.23,-.24],elbow,.067,clothColor);w.rod(elbow,hand,.053,clothColor);blob(w,[.055,.04,.075],skin,hand);
 }
 blob(w,[.13,.13,.14],skin,[.01,.16,-.51]);blob(w,[.15,.14,.15],wrap,[.005,.17,-.57]);
 for(let i=0;i<4;i++)rope(w,[[-.12,.18+i*.017,-.62],[0,.29+i*.008,-.59],[.14,.18+i*.017,-.51]],.014,i%2?wrap:0xa39883);
 w.box([.042,.025,.22],skin,[.05,.12,-.43],[0,.1,0]);
 w.box([.40,.03,.08],0x9b7c55,[0,.29,.29]);
 w.finish(`dayr-fallen-${index}`);return g;
}
function conspiracy(root){
 const group=new T.Group();group.name='dayr-interrupted-conspiracy';group.position.set(8.32,0,-17.50);root.add(group);
 const w=workshop(group,172060),wood=0x67513b,brass=0xad8c56;
 w.box([2.45,.015,2.15],0x66534a,[0,.025,.18]);
 for(const side of [-1,1]){w.box([2.28,.008,.065],0xaf936b,[0,.037,.18+side*.92]);w.box([.065,.008,1.86],0xaf936b,[side*1.09,.037,.18]);}
 // A low table in an actual lodging bay; the overturned stool faces the court.
 for(const x of [-.57,.57])for(const z of [-.32,.32])w.box([.07,.40,.07],wood,[x,.23,z]);
 w.box([1.40,.065,.86],wood,[0,.46,0]);
 const tableMap=canvasTex(512,320,(c,W,H)=>{
  c.fillStyle='#b5a17b';c.fillRect(0,0,W,H);c.strokeStyle='#68523e';c.lineWidth=3;
  c.strokeRect(100,48,270,220);c.strokeRect(125,72,220,170);c.strokeRect(195,110,80,80);
  for(const x of [100,370])for(const y of [48,268]){c.beginPath();c.arc(x,y,19,0,Math.PI*2);c.stroke();}
  // A fictional royal sun seal, no real location or actionable route diagram.
  c.fillStyle='#794038';c.beginPath();c.arc(437,72,29,0,Math.PI*2);c.fill();c.strokeStyle='#b69962';c.lineWidth=2;
  for(let i=0;i<12;i++){const a=i*Math.PI/6;c.beginPath();c.moveTo(437+Math.cos(a)*12,72+Math.sin(a)*12);c.lineTo(437+Math.cos(a)*23,72+Math.sin(a)*23);c.stroke();}
  c.beginPath();c.arc(437,72,9,0,Math.PI*2);c.stroke();
  c.strokeStyle='#766048';c.lineWidth=2;for(let i=0;i<6;i++){c.beginPath();c.moveTo(400,142+i*17);c.lineTo(458-i%3*9,142+i*17);c.stroke();}
 });
 const map=new T.Mesh(new T.PlaneGeometry(1.10,.69),new T.MeshStandardMaterial({map:tableMap,roughness:1,side:T.DoubleSide}));map.name='dayr-royal-sealed-plan';map.rotation.x=-Math.PI/2;map.rotation.z=-.07;map.position.set(-.04,.497,0);group.add(map);
 for(const [x,z] of [[-.53,-.30],[.42,.28]])blob(w,[.035,.022,.035],0x776b56,[x,.51,z]);
 dagger(w,[.33,.515,-.13],.8);
 for(const [x,z] of [[-.48,.10],[.49,-.29]]){w.put(new T.CylinderGeometry(.055,.045,.11,10,1,true),brass,[x,.55,z]);w.put(new T.CircleGeometry(.044,10),0x393024,[x,.583,z],[-Math.PI/2,0,0]);}
 const stool=new T.Group();stool.position.set(-.78,.26,1.22);stool.rotation.z=1.38;group.add(stool);const st=workshop(stool,172061);st.box([.42,.06,.40],wood,[0,.23,0]);for(const x of [-.15,.15])for(const z of [-.14,.14])st.box([.045,.42,.045],wood,[x,0,z]);st.finish('dayr-overturned-stool');
 // Ordinary woven merchandise above a tray of matching concealed blades.
 w.box([.72,.30,.52],0x554334,[.96,.18,.58]);w.box([.63,.016,.43],0x282b2c,[.96,.34,.58]);
 for(let i=0;i<3;i++)dagger(w,[.76+i*.18,.36,.70],0);
 w.box([.73,.045,.54],wood,[.96,.67,.27],[1.05,0,0]);
 const fold=cloth(group,'dayr-open-merchandise-cover',0x9c8263,[[.95,.40,.35],[.95,.43,.05],[.95,.29,-.12],[.95,.07,-.25]],.79);
 for(let i=0;i<3;i++)w.put(new T.CylinderGeometry(.08,.08,.54,10),i%2?0x655f71:0x96937e,[-1.0,.10+i*.15,-.56],[0,0,Math.PI/2]);
 w.finish('dayr-conspiracy-table-and-disguise');
 const b=Float32Array.from(fold.geometry.attributes.position.array);
 return t=>{const a=fold.geometry.attributes.position;for(let i=0;i<a.count;i++)a.setY(i,b[i*3+1]+Math.max(0,.16-b[i*3+1])*.06*Math.sin(t*1.6+i*.45));a.needsUpdate=true;};
}
function lantern(root,p,index){
 const g=new T.Group();g.position.set(...p);g.name=`dayr-caravan-lantern-${index}`;root.add(g);const w=workshop(g,172070+index);
 w.put(new T.CylinderGeometry(.17,.19,.055,10),0x5d4c36,[0,.045,0]);w.put(new T.ConeGeometry(.21,.12,8),0x7b6648,[0,.40,0]);
 for(const x of [-.12,.12])for(const z of [-.10,.10])w.rod([x,.07,z],[x,.34,z],.013,0x92754d);
 w.put(new T.TorusGeometry(.07,.012,5,12),0xa18c67,[0,.52,0]);w.finish(`dayr-lantern-${index}-frame`);
 const fire=new T.Mesh(new T.SphereGeometry(1,7,5),new T.MeshBasicMaterial({color:0xffcc8c}));fire.scale.set(.045,.095,.045);fire.position.y=.19;g.add(fire);
 const light=new T.PointLight(0xffc486,index===2?1.5:3.0,8,2);light.position.y=.34;g.add(light);
 return t=>{const k=1+.055*Math.sin(t*7+index)+.03*Math.sin(t*11.4+index*2);fire.scale.y=.095*k;light.intensity=(index===2?1.5:3.0)*k;};
}
export function addDayrCaravan(root){
 const area=new T.Group();area.name='dayr-assassin-caravan';root.add(area);
 const steps=[camel(area,0,[24.8,-.08,-.8],1.18),camel(area,1,[29.7,-.08,1.6],-.93,{color:0x8d7759}),camel(area,2,[13.6,0,-10.6],-.75,{kneeling:true,color:0xb7a184}),conspiracy(area)];
 const w=workshop(area,172080);
 for(const [p,s,c] of [[[15.8,0,-6.3],1.3,0x836952],[[16.4,0,-5.8],.9,0x989078],[[15.6,.49,-6.1],.75,0x765c55],[[24.3,-.055,1.65],1,0x8c7755]])parcel(w,p,s,c);
 // Unloaded saddle and a water trough beside the original well.
 w.box([.65,.08,.64],0x6c4f3c,[12.1,.14,-10.0],[0,.3,.18]);for(const x of [11.85,12.37])w.put(new T.TorusGeometry(.15,.027,5,14,Math.PI),0x7c6344,[x,.25,-10],[0,Math.PI/2,0]);
 for(const z of [-12.70,-12.12])w.box([1.45,.26,.07],0x8c795b,[13.72,.17,z]);for(const x of [13.02,14.42])w.box([.07,.26,.65],0x8c795b,[x,.17,-12.41]);w.box([1.45,.06,.65],0x655b48,[13.72,.055,-12.41]);
 const water=new T.Mesh(new T.PlaneGeometry(1.32,.48),new T.MeshStandardMaterial({color:0x727f7e,roughness:.24,metalness:.16}));water.name='dayr-caravan-trough-water';water.rotation.x=-Math.PI/2;water.position.set(13.72,.20,-12.41);area.add(water);
 const puddleMap=canvasTex(128,128,(c)=>{c.fillStyle='#fff';c.beginPath();for(let i=0;i<32;i++){const a=i*Math.PI/16,r=48+6*Math.sin(i*2.1);const x=64+Math.cos(a)*r,y=64+Math.sin(a)*r*.69;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.fill();});
 const puddle=new T.Mesh(new T.PlaneGeometry(1.9,1.6),new T.MeshStandardMaterial({map:puddleMap,color:0x454a47,transparent:true,opacity:.65,roughness:.25,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));puddle.rotation.x=-Math.PI/2;puddle.position.set(12.73,.018,-11.15);puddle.name='dayr-spilled-well-water';area.add(puddle);
 // Two men struck outside their meeting place. The spilled cup / dropped blade
 // convey the abrupt interruption without adding a combat encounter.
 fallen(area,0,[8.0,0,-14.95],.68,0x635e52);fallen(area,1,[11.6,0,-8.75],-1.4,0x766150);
 dagger(w,[8.91,.026,-14.40],1.2);dagger(w,[11.87,.026,-9.43],-.2);
 w.put(new T.CylinderGeometry(.075,.06,.15,10,1,true),0xa28658,[8.78,.08,-15.57],[0,0,1.5]);
 w.finish('dayr-caravan-unloaded-goods');
 addDayrFarSide(area);
 for(const [i,p] of [[0,[23.7,-.055,2.3]],[1,[13.4,0,-9.05]],[2,[8.0,.50,-17.72]]])steps.push(lantern(area,p,i));
 DAYR_FAR_SIDE.lanterns.forEach((p,i)=>steps.push(lantern(area,p,i+3)));
 area.userData={visualOnly:true,camels:3,fallen:3,unidentified:1,concealedDaggers:3,royalSeal:'fictional-sun'};
 return steps;
}

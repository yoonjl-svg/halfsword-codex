// 03:00. A raised sluice exposes the village path; letters wait at empty doors.
// All additions are scenery beyond the original combat/camera clearing.
import * as T from 'three';
import { buildSluice } from './stage_sluice.js';
import { beginNight } from './stage_night_variants.js';
import { workshop } from './stage_night_second.js';
import { addSluiceWeather } from './stage_sluice_weather.js';

function letterBundle(w,p,angle){
  // Bake all local letters into the same story mesh, without a text texture.
  const point=v=>new T.Vector3(...v).applyAxisAngle(new T.Vector3(0,1,0),angle).add(new T.Vector3(...p)).toArray();
  for(let j=0;j<4;j++)w.box([.45,.025,.29],j%2?0xc6bea3:0xdbd2b8,point([j*.009,j*.027,0]),[0,angle+(j-2)*.025,0]);
  w.box([.035,.12,.30],0x6b6453,point([-.05,.045,0]),[0,angle,0]);
  w.box([.46,.12,.026],0x6b6453,point([0,.045,.025]),[0,angle,0]);
  // A folded triangular flap and muted red wax; a river stone holds the pile.
  w.rod(point([-.20,.109,-.12]),point([0,.109,.02]),.004,0x8f8267);
  w.rod(point([.20,.109,-.12]),point([0,.109,.02]),.004,0x8f8267);
  w.ball([.05,.013,.04],0x824e44,point([.03,.117,.035]));
  w.ball([.13,.065,.09],0x7f8d88,point([-.08,.159,-.035]));
}

export function buildSluiceNight(scene,lights){
  const build=(s,l)=>buildSluice(s,l,{nightOpened:true});
  const {stage,root,original}=beginNight(scene,lights,build,'sluice_night',{boundaryFires:false,nightSky:false});
  const w=workshop(root,16401);
  // Newly exposed mud between the stones, confined to the outer village. The
  // combat puddles and their depth/movement sampling remain byte-identical.
  for(let i=0;i<10;i++){
    const t=i/9,x=12.5+5.1*t,z=-3.8-6.8*t;
    w.put(new T.CylinderGeometry(1,1,.07,11),0x596865,[x,.012,z],[0,t,0],[1.55,.8,1.25]);
    for(const s of [-1,1])w.box([1.15,.17,.69],i%3?0xa1aaa4:0x818e89,[x+s*.50,.075,z+s*.29],[0,.43+(i%3-1)*.04,0]);
    // Damp, pale silt outlines the raised edges rather than covering the arena.
    w.box([1.13,.018,.04],0xb5b7a4,[x,.17,z-.38],[0,.43,0]);
  }
  const doors=[[13.7,.11,-5.2],[16.0,.11,-7.8],[19.2,.11,-6.6]];
  for(let i=0;i<doors.length;i++){
    const [x,y,z]=doors[i],a=.44;
    w.box([2.5,.30,1.30],0x77837e,[x,y,z],[0,a,0]);
    w.box([2.2,.10,.75],0xa7afa5,[x,y+.19,z],[0,a,0]);
    // Empty doorjambs, a worn threshold, and low surviving foundations.
    for(const s of [-1,1]){
      const px=x+s*1.04*Math.cos(a),pz=z-s*1.04*Math.sin(a);
      w.box([.19,1.42-i*.19,.20],0x6d7563,[px,y+.78-i*.095,pz],[.05*s,a,.035*s]);
      w.box([.34,.32,1.9],0x7a8880,[px+.5,y,pz+1.1],[0,a,0]);
    }
    letterBundle(w,[x,y+.245,z-.05],a);
  }
  // Rope hoist beside the existing tilted gate: the old crossbar is raised in
  // buildSluice's night-only geometry branch, not a new obstruction over it.
  const turn=.52,c=Math.cos(turn),s=Math.sin(turn),hx=21.2*c-1.6*s,hz=-21.2*s-1.6*c,rot=-Math.PI/2+turn;
  const gp=([x,y,z])=>new T.Vector3(x,y+.2,z).applyAxisAngle(new T.Vector3(0,0,1),.105).applyAxisAngle(new T.Vector3(0,1,0),rot).add(new T.Vector3(hx,0,hz)).toArray();
  for(const x of [-2.1,2.1]){
    w.rod(gp([x,5.25,.6]),gp([x,7.1,.6]),.035,0xb9b393);
    w.rod(gp([x,7.1,.6]),gp([x,1.8,1.65]),.027,0xa5a18a);
  }
  w.finish('sluice-exposed-village-and-delivered-letters');
  root.userData.stories=['새벽 세 시, 옛 수문의 빗장이 위로 당겨져 있다. 전투장 밖의 물길에서 돌길과 빈집의 문턱이 드러났다.','문은 사라졌지만 편지는 도착했다. 젖지 않도록 쌓고 돌로 눌러 둔 꾸러미가 세 문턱에 남았다.'];
  root.userData.details={path:[14.5,.1,-6.5],letters:doors,gate:[hx,3,hz],combatTerrainUnchanged:true};
  addSluiceWeather(scene,lights,root,stage,original);
  return stage;
}

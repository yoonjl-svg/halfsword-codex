import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {trial} from './parry_reading_trials.mjs';
import {PathResearchGuard} from './chinese_path_guard.mjs';
import {ARM} from '../../src/config.js';
import * as THREE from 'three';
export const dir=process.env.OUT_DIR??'/workspace/chinese-parry-path-20261017';mkdirSync(dir,{recursive:true});
export function previous(name){return JSON.parse(gunzipSync(readFileSync(new URL(`../../docs/research/chinese_player_parry_20261017/raw/${name}.json.gz`,import.meta.url))));}
export const dangers=previous('risk-unguarded').filter(r=>r.injured);
export const key=r=>[r.atk,r.name,r.gap,r.press].join('|');
export function cases(leads=[.3,.2,.1]){return dangers.flatMap(x=>leads.map(lead=>({cfg:'qinggang',atk:x.atk,name:x.name,gap:x.gap,lead,press:Math.round((x.wounds.find(w=>w.type!=='blunt').t-lead)*120)/120})));}
export function runCase(x,kind='base',trace=false){
 process.env.PATH_KIND=kind;process.env.PATH_LINE=kind.startsWith('force:')?kind.slice(6):'';
 const {press,...opts}=x;
 const measures=[];let installed=false;
 const r=trial({...opts,playerModel:true,heldAt:t=>press>=0&&t+1e-9>=press&&!(x.releaseAt!=null&&t+1e-9>=x.releaseAt&&t+1e-9<(x.repressAt??Infinity)),trace,Guard:kind==='base'?undefined:PathResearchGuard,
  onFrame:(G,guard)=>{
   if(!installed&&process.env.PATH_MOTOR==='no-attack-lead'){
    installed=true;const f=G.player,drive=f.driveSword.bind(f);
    f.driveSword=(...args)=>{const keep=ARM.servoLead;if(guard.active)ARM.servoLead=0;try{return drive(...args);}finally{ARM.servoLead=keep;}};
   }
   if(!trace)return;
   const f=G.player;const hand=f.bodies.farmS;const t=f.handTarget;const p=hand.translation(),q=hand.rotation();
   // Forearm local +.13 is the actual wrist, as in the engine grip joint.
   const ux=.13*(1-2*(q.y*q.y+q.z*q.z)),uy=.26*(q.x*q.y+q.w*q.z),uz=.26*(q.x*q.z-q.w*q.y);
   const base=f.bladePoint(0),tip=f.bladePoint(1),aim=f.aimDirW;
   const cp=f.bodies.chest.translation(),cq=f.bodies.chest.rotation(),shoulder=new THREE.Vector3(ARM.shoulder[0],ARM.shoulder[1],f.side*ARM.shoulder[2]).applyQuaternion(cq).add(cp);
   const bx=tip.x-base.x,by=tip.y-base.y,bz=tip.z-base.z,bl=Math.hypot(bx,by,bz);
   measures.push({t:G.t,handError:Math.hypot(p.x+ux-t.x,p.y+uy-t.y,p.z+uz-t.z),target:{x:t.x,y:t.y,z:t.z},shoulder:{x:shoulder.x,y:shoulder.y,z:shoulder.z},targetReach:shoulder.distanceTo(t),physicalArmLength:ARM.upper+ARM.fore,wrist:{x:p.x+ux,y:p.y+uy,z:p.z+uz},angleError:aim?Math.acos(Math.max(-1,Math.min(1,(bx*aim.x+by*aim.y+bz*aim.z)/bl)))*180/Math.PI:null,armFull:f.armFull,state:f.state,balance:f.balance,mode:guard.mode,line:guard.line,cover:f.skill._cover?.w??0,path:guard.pathDebug??null});
  }});
 if(!trace)delete r.touches;
 return {...r,...x,kind,motor:process.env.PATH_MOTOR??'normal',critical:r.wounds.some(w=>w.type!=='blunt'&&['head','neck','chest'].includes(w.zone)),...(trace?{measures}:{})};
}
export function save(name,rows){writeFileSync(`${dir}/${name}.json`,JSON.stringify(rows));}
export function summarize(a){return{n:a.length,injured:a.filter(r=>r.injured).length,critical:a.filter(r=>r.critical).length,paidAndInjured:a.filter(r=>r.injured&&r.stamina.spent.block>0).length,blockCost:a.reduce((s,r)=>s+r.stamina.spent.block,0),attackCost:a.reduce((s,r)=>s+r.stamina.spent.attack,0)};}

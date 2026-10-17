import {trial} from './parry_reading_trials.mjs';
import {guardClass,observeHealth} from './chinese_benefit_model.mjs';
import {DT} from './harness_m.mjs';
import {ARM} from '../../src/config.js';
import * as THREE from 'three';
import {writeFileSync} from 'node:fs';
const rows=[];
for(const gap of [1.1,1.5])for(let i=0;i<11;i++)for(const kind of ['base','compact-native']){
 const lead=.1+i*.025,press=Math.round(((gap===1.1?.825:1.2416666666666667)-lead)*120)/120;
 let h,t=0,final;const metrics={activeLowFrames:0,outsideReach:0,maxReach:0,maxError:0};
 const Parent=guardClass(kind);class Guard extends Parent{constructor(d,a){super(d,a);h=observeHealth(d,()=>t);}}
 const r=trial({cfg:'qinggang',atk:'longsword',name:'unterhau',gap,playerModel:true,Guard,heldAt:t=>t+1e-9>=press,onFrame(G,g){
  t=G.t;h.step(DT,g);final=h.finish();const f=G.player;
  if(g.active&&g.line==='lowL'&&f.skill._cover?.w>=.99){
   const shoulder=new THREE.Vector3(...ARM.shoulder).applyQuaternion(f.bodies.chest.rotation()).add(f.bodies.chest.translation());
   const wrist=new THREE.Vector3(.13,0,0).applyQuaternion(f.bodies.farmS.rotation()).add(f.bodies.farmS.translation());
   const reach=shoulder.distanceTo(f.handTarget);metrics.activeLowFrames++;if(reach>ARM.upper+ARM.fore)metrics.outsideReach++;metrics.maxReach=Math.max(metrics.maxReach,reach);metrics.maxError=Math.max(metrics.maxError,wrist.distanceTo(f.handTarget));
  }
 }});
 rows.push({kind,gap,lead,press,injured:r.injured,health:final,metrics});
}
writeFileSync(`${process.env.BENEFIT_OUT??'/workspace/chinese-parry-benefit-20261017'}/window.json`,JSON.stringify(rows));console.log(JSON.stringify(rows.map(({kind,gap,lead,injured,health,metrics})=>({kind,gap,lead,injured,hits:health.hits,limbLost:health.limbLost,...metrics}))));

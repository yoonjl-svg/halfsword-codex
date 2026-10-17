import {trial} from './parry_reading_trials.mjs';
import {gapGuard} from './chinese_gap_model.mjs';
import {observeHealth} from './chinese_benefit_model.mjs';
import {DT} from './harness_m.mjs';
import {dangers} from './chinese_path_trials.mjs';
import {ARM} from '../../src/config.js';
import * as THREE from 'three';
import {writeFileSync} from 'node:fs';
const rows=[];
for(const gap of [1.1,1.5])for(let i=0;i<9;i++)for(const kind of ['base','inside']){
 const first=dangers.find(r=>r.atk==='qinggang'&&r.name==='zornhau'&&r.gap===gap).wounds.find(w=>w.type!=='blunt').t;
 const lead=.1+i*.025,press=Math.round((first-lead)*120)/120;let h,t=0,health;
 const metrics={frames:0,outside:0,maxReach:0};const Parent=gapGuard(kind);class Guard extends Parent{constructor(d,a){super(d,a);h=observeHealth(d,()=>t);}}
 const r=trial({cfg:'qinggang',atk:'qinggang',name:'zornhau',gap,playerModel:true,Guard,heldAt:t=>t+1e-9>=press,onFrame(G,g){t=G.t;h.step(DT,g);health=h.finish();const f=G.player;if(g.active&&g.line==='highL'&&f.skill._cover?.w>=.99){const shoulder=new THREE.Vector3(...ARM.shoulder).applyQuaternion(f.bodies.chest.rotation()).add(f.bodies.chest.translation());const reach=shoulder.distanceTo(f.handTarget);metrics.frames++;metrics.outside+=reach>ARM.upper+ARM.fore?1:0;metrics.maxReach=Math.max(metrics.maxReach,reach);}}});
 rows.push({kind,gap,lead,press,duration:r.duration,injured:r.injured,health,metrics});
}
writeFileSync(`${process.env.GAP_OUT??'/workspace/chinese-parry-gap-20261017'}/window.json`,JSON.stringify(rows));console.log(JSON.stringify(rows.map(({kind,gap,lead,health,metrics})=>({kind,gap,lead,alive:health.end.alive,hits:health.hits,cuts:health.cutHits,limb:health.limbLost,...metrics}))));

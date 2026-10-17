import {dangers,runCase,save} from './chinese_path_trials.mjs';
const x=dangers.find(r=>r.atk==='longsword'&&r.name==='unterhau'&&r.gap===1.5),hit=x.wounds.find(w=>w.type!=='blunt').t;
const traces=[];
for(const lead of [.2,.225,.3]){
 const press=Math.round((hit-lead)*120)/120;
 traces.push(runCase({cfg:'qinggang',atk:x.atk,name:x.name,gap:x.gap,press,lead},'force:lowL',true));
}
save('arrival-traces',traces);
for(const r of traces){const m=r.measures.filter(m=>m.t>r.press+.08&&m.t<hit);console.log(JSON.stringify({lead:r.lead,hurt:r.injured,frames:m.length,outsideReach:m.filter(x=>x.targetReach>x.physicalArmLength).length,maxExcess:Math.max(...m.map(x=>x.targetReach-x.physicalArmLength)),firstClash:r.clashes.find(c=>c.fresh)?.t,peakHandError:Math.max(...m.map(x=>x.handError)),peakAngleError:Math.max(...m.map(x=>x.angleError))}));}
for(const motor of ['normal','no-attack-lead']) {
const fixed=[];if(motor==='normal')delete process.env.PATH_MOTOR;else process.env.PATH_MOTOR=motor;
for(let i=0;i<=10;i++){const lead=.1+i*.025;fixed.push(runCase({cfg:'qinggang',atk:x.atk,name:x.name,gap:x.gap,lead,press:Math.round((hit-lead)*120)/120},'force:lowL'));}
save(motor==='normal'?'fixed-window':'fixed-window-no-attack-lead',fixed);console.log(JSON.stringify(fixed.map(r=>({lead:r.lead,injured:r.injured}))));
delete process.env.PATH_MOTOR;
}

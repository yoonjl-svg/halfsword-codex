import {trial} from './parry_reading_trials.mjs';
import {ExtendedGuard} from './parry_extended_guard.mjs';
import {writeFileSync} from 'node:fs';
process.env.READ_KIND='rise-jp-lowL';
const rows=[];
const schedules=[{label:'release-before-rise',off:[.99,1.10]},{label:'release-during-rise',off:[1.10,1.20]}];
for(const schedule of schedules)for(const gap of [1.4,1.8])for(const name of ['unterhau','unterhauL','위→다리','zornhau'])for(const candidate of [false,true]) {
 const heldAt=t=>t<schedule.off[0]||t>=schedule.off[1];
 const r=trial({cfg:'uchigatana',gap,name,trace:true,heldAt,Guard:candidate?ExtendedGuard:undefined});
 const illegal=r.frames.filter(f=>!heldAt(f.t)&&(f.line!==null||f.read!==null));
 if(illegal.length)throw Error('Guard did not release');
 const {frames,touches,...keep}=r;rows.push({...keep,candidate,schedule:schedule.label,illegal:illegal.length,activations:frames.filter(f=>f.read).length});
}
for(const cfg of ['uchigatana','longsword:basic','uchigatana:nocover','qinggang'])for(const gap of [1.4,2.4])for(const name of ['unterhau','oberhau','위→다리'])for(const candidate of [false,true]){
 const r=trial({cfg,gap,name,trace:true,prepareOnly:true,Guard:candidate?ExtendedGuard:undefined});
 const {frames,touches,...keep}=r;const readFrames=frames.filter(f=>f.read).length;
 if(readFrames)throw Error('Read lock during preparation only');
 rows.push({...keep,candidate,schedule:'prepare-only',activations:readFrames});
}
for(const cfg of ['longsword:basic','uchigatana:nocover','qinggang','rapier','zweihander']){
 const r=trial({cfg,gap:1.6,name:'unterhau',trace:true,Guard:ExtendedGuard});
 if(r.frames.some(f=>f.read))throw Error('Out of scope activation');
 const {frames,touches,...keep}=r;rows.push({...keep,candidate:true,schedule:'out-of-scope',activations:0});
}
writeFileSync('/workspace/parry-extended-20261017/edges.json',JSON.stringify(rows));
console.log(JSON.stringify({n:rows.length,releaseIllegal:0,preparationActivations:0,outOfScopeActivations:0}));

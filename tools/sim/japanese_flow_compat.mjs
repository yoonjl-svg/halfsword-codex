import {live} from './japanese_flow_live.mjs';
import {Combat} from '../../src/combat.js';
import {PlayerParryGuard} from '../../src/parry_button.js';
import {NAGASHI} from '../../src/config.js';
import {writeFileSync} from 'node:fs';
const initial=JSON.stringify(NAGASHI),rows=[];
const select=r=>({health:r.health,enemy:r.enemy,commands:r.commands,timeline:r.timeline,flows:r.flows,guard:r.guard});
for(const opts of [
 {seed:511,atk:'longsword',policy:'reactive'},
 {seed:512,atk:'qinggang',policy:'riposte'},
 {seed:502,atk:'qinggang',policy:'slash'},
]){
 const wrapped=live({...opts,seconds:12,kind:'base'});
 const original=live({...opts,seconds:12,GuardOverride:PlayerParryGuard,onStart(G){G.combat.nagashi=Combat.prototype.nagashi.bind(G.combat);}});
 rows.push({type:'instrumentation',...opts,equal:JSON.stringify(select(wrapped))===JSON.stringify(select(original))});
}
for(const opts of [{weapon:'longsword',book:true},{weapon:'uchigatana',book:false}]){
 const a=live({...opts,seed:512,atk:'qinggang',policy:'riposte',seconds:12,kind:'base'}),b=live({...opts,seed:512,atk:'qinggang',policy:'riposte',seconds:12,kind:'free-cut'});
 rows.push({type:'scope',...opts,equal:JSON.stringify(select(a))===JSON.stringify(select(b)),flows:b.flows.length});
}
rows.push({type:'config-restored',equal:JSON.stringify(NAGASHI)===initial});
writeFileSync(`${process.env.FLOW_OUT??'/workspace/japanese-flow-20261017'}/compat.json`,JSON.stringify(rows,null,2));
console.log(JSON.stringify(rows));if(rows.some(r=>!r.equal))process.exitCode=1;

import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {contactGuard} from './chinese_contact_guard.mjs';
import {single} from './chinese_contact_trials.mjs';
import {trial} from './parry_reading_trials.mjs';
const out=process.env.CONTACT_OUT??'/workspace/chinese-parry-contact-20261017',checks=[];
const read=n=>JSON.parse(existsSync(`${out}/${n}.json`)?readFileSync(`${out}/${n}.json`):gunzipSync(readFileSync(`${out}/raw/${n}.json.gz`)));
const old=JSON.parse(gunzipSync(readFileSync(new URL('../../docs/research/chinese_parry_benefit_20261017/raw/screen-base.json.gz',import.meta.url))));
const rows=read('screen-base');
rows.forEach((r,i)=>{for(const k of ['health','wounds','stamina'])assert.deepEqual(r[k],old[i][k]);});checks.push({name:'baseline-57-exact',passed:57});
for(const cfg of ['qinggang:basic','longsword','uchigatana'])for(const kind of ['path','fit-only','path-fit']){
 const x={cfg,atk:'longsword',name:'zornhau',gap:1.5,press:.8},a=single(x,'base'),b=single(x,kind);
 for(const k of ['health','wounds','stamina'])assert.deepEqual(a[k],b[k]);
 assert.equal(b.contactStats.detected,0);assert.equal(b.contactStats.adjusted,0);
}checks.push({name:'school-scope-pairs',passed:9});
for(const kind of ['path','path-fit'])for(const action of ['release','attack','exhausted','disarmed','range']){
 let acquired=false,inject=false,validated=false,release=false;const Guard=contactGuard(kind);
 trial({cfg:'qinggang',atk:'qinggang',name:'talhoReves',gap:1.1,playerModel:true,Guard,heldAt:t=>t+1e-9>=113/120&&!release,onFrame(G,g){
  if(inject&&!validated){assert.equal(g.lock,null);if(action!=='range'){assert.equal(g.active,false);assert.equal(g.handShift.length(),0);assert.equal(g.turn.length(),0);}validated=true;}
  if(!acquired&&g.lock){acquired=true;inject=true;
   if(action==='release')release=true;
   if(action==='attack'){g.broken=true;G.player.skill.thrust();}
   if(action==='exhausted'){G.player.stamina.value=-80;G.player.stamina.stages();assert(G.player.stamina.exhausted);}
   if(action==='disarmed')G.player.dropSword();
   if(action==='range')G.park();
  }
 }});assert(acquired&&validated,`${kind}/${action} did not run`);
}checks.push({name:'actual-lock-stop-on-input-state-range',passed:10});
const v=read('visual');assert.deepEqual(v.errors,[]);
for(const k of ['base','path']){const a=v.result.find(r=>r.kind===k&&r.health),b=read(`screen-${k}`).find(x=>x.atk==='qinggang'&&x.name==='talhoReves'&&x.gap===1.1&&x.lead===.2);for(const key of ['health','stamina','transitions'])assert.deepEqual(a[key],b[key]);}
checks.push({name:'browser-node-damage-input-exact',passed:2});
for(const r of read('browser-input')){assert.deepEqual(r.errors,[]);assert(Object.values(r.checks).every(Boolean));}checks.push({name:'actual-game-button-checks',passed:18});
writeFileSync(`${out}/verification.json`,JSON.stringify(checks,null,2));console.log(JSON.stringify(checks));

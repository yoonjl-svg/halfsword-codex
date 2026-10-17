// 여정 이어하기 지점 저장 · 첫 화면 건너뛰기 규칙 (샛별 저장소 journey_save.test.mjs 를 우리 열쇠·규칙에 맞춤 — docs/import/lobby_port_2026-10-16.md §5)
//  node --test tools/sim/journey_save.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { JOURNEY_SAVE_KEY, readJourney, writeJourney, skipsTitle, CLEAR_KEY, journeyClears, addJourneyClear } from '../../src/journey_save.js';
const memory=()=>{const data=new Map([['stillness.journeyClears.v1','37'],['gladiator-settings','keep']]);return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
test('our key names: no clash with existing keys, no other-build names',()=>{
 assert.equal(JOURNEY_SAVE_KEY,'stillness.journey.checkpoint.v1');
 for(const k of ['stillness.journeyClears.v1','stillness.testRoute.v1','gladiator-settings'])assert.notEqual(JOURNEY_SAVE_KEY,k);
 assert.ok(!/fork/i.test(JOURNEY_SAVE_KEY));
});
test('draw and armed checkpoints round-trip without changing other saved data',()=>{
 const s=memory(),round={stage:'castle',foe:'isolde',foeWeapon:'longsword',weapon:null,lastWeapon:'rapier',cards:['longsword','ganjiang']};
 assert.equal(writeJourney(round,s),true);assert.deepEqual(readJourney(s),round);
 const armed={...round,weapon:'longsword',cards:null};writeJourney(armed,s);assert.deepEqual(readJourney(s),armed);
 assert.equal(s.getItem('stillness.journeyClears.v1'),'37');assert.equal(s.getItem('gladiator-settings'),'keep');
});
test('next-stage checkpoint does not retain old opponent or weapon choice',()=>{
 const s=memory();writeJourney({stage:'clearing',lastWeapon:'longsword'},s);
 assert.deepEqual(readJourney(s),{stage:'clearing',lastWeapon:'longsword',foe:null,foeWeapon:null,weapon:null,cards:null});
});
test('missing, malformed, future-version and incomplete checkpoint are ignored',()=>{
 const s=memory();assert.equal(readJourney(s),null);
 for(const value of ['{bad','null','[]',JSON.stringify({version:2,stage:'castle'}),JSON.stringify({version:1,stage:12}),JSON.stringify({version:1,stage:'castle',cards:['longsword']}),JSON.stringify({version:1,stage:'castle',weapon:'longsword'}),JSON.stringify({version:1,stage:'castle',foe:{id:'heinrich'}})]){
  s.setItem(JOURNEY_SAVE_KEY,value);assert.equal(readJourney(s),null);assert.equal(s.getItem(JOURNEY_SAVE_KEY),value);
 }
});
test('blocked storage and blocked storage property do not stop a new game',()=>{
 const denied={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
 assert.equal(readJourney(denied),null);assert.equal(writeJourney({stage:'castle'},denied),false);
 const old=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 try{Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('blocked property')}});assert.equal(readJourney(),null);assert.equal(writeJourney({stage:'castle'}),false);}
 finally{if(old)Object.defineProperty(globalThis,'localStorage',old);else delete globalThis.localStorage;}
});
test('blocked storage keeps the checkpoint in memory for this run only (10/17: lobby \'Stage 입장\' always continues)',()=>{
 const denied={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
 const round={stage:'castle',foe:'isolde',foeWeapon:'longsword',weapon:null,lastWeapon:null,cards:['longsword','rapier']};
 assert.equal(writeJourney(round,denied),false);assert.deepEqual(readJourney(denied),round); // 같은 실행 안에서는 이어하기
 assert.equal(readJourney(memory()),null); // 다른 저장소에는 새지 않음
 const flaky={data:new Map(),ok:false,getItem(k){return this.data.get(k)??null},setItem(k,v){if(!this.ok)throw Error('full');this.data.set(k,v)}};
 assert.equal(writeJourney(round,flaky),false);assert.deepEqual(readJourney(flaky),round);
 flaky.ok=true;const next={stage:'clearing',lastWeapon:'longsword'};assert.equal(writeJourney(next,flaky),true); // 쓰기가 되면 메모리 쪽은 지우고 저장소를 읽는다
 assert.deepEqual(readJourney(flaky),{...next,foe:null,foeWeapon:null,weapon:null,cards:null});
 const old=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 try{Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('blocked property')}});assert.equal(writeJourney(round),false);assert.deepEqual(readJourney(),round);}
 finally{if(old)Object.defineProperty(globalThis,'localStorage',old);else delete globalThis.localStorage;}
});
test('any game argument keeps the old direct entry; plain address shows the title',()=>{
 const p=q=>new URLSearchParams(q);
 for(const query of ['test=1','stage=castle','weapon=longsword','hero=heinrich','foe=random','look=heinrich:v0','lookv=0','foeWeapon=rapier','stamina=0','foeWhiff=1','tempo=1','itRhythm=4','camFollow=old','cards=longsword,rapier','fps=1','offline=1','title=0','title=0&stage=castle'])assert.equal(skipsTitle(p(query)),true,query);
 for(const query of ['','title=1','nosw=1','title=1&stage=castle','title=1&cards=longsword,rapier','utm_source=x','fbclid=abc','gclid=abc'])assert.equal(skipsTitle(p(query)),false,query);
});
test('clear count (statistic since seals were removed 10/16): same key, +1 per clear, blocked or bad storage reads 0 without throwing',()=>{
 const s=memory();assert.equal(CLEAR_KEY,'stillness.journeyClears.v1');assert.equal(journeyClears(s),37);
 assert.equal(addJourneyClear(s),38);assert.equal(s.getItem(CLEAR_KEY),'38');assert.equal(s.getItem('gladiator-settings'),'keep');
 const denied={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
 assert.equal(journeyClears(denied),0);assert.equal(addJourneyClear(denied),1);
 for(const bad of [null,'x','-3'])s.setItem(CLEAR_KEY,bad),assert.equal(journeyClears(s),0);
});

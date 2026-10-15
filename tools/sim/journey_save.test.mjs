import test from 'node:test';
import assert from 'node:assert/strict';
import { JOURNEY_SAVE_KEY, readJourney, writeJourney, isDirectGameLink } from '../../src/journey_save.js';
const memory=()=>{const data=new Map([['stillness.journeyClears.v1','37'],['gladiator-settings','keep']]);return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
test('draw and armed checkpoints round-trip without changing other saved data',()=>{
 const s=memory(),round={stage:'castle',foe:'heinrich',foeWeapon:'excalibur_replica',weapon:null,lastWeapon:'rapier',cards:['longsword','ganjiang']};
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
test('direct test and encounter links keep their existing entry',()=>{
 for(const query of ['test=1','stage=castle','weapon=longsword','hero=heinrich','foe=random','look=heinrich:v0'])assert.equal(isDirectGameLink(new URLSearchParams(query)),true);
 for(const query of ['','nosw=1','cards=longsword,rapier'])assert.equal(isDirectGameLink(new URLSearchParams(query)),false);
});

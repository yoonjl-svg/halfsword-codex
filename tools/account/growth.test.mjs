import test from 'node:test';
import assert from 'node:assert/strict';
import { GrowthController } from '../../src/account/growth-controller.js';
import { createLocalGrowth } from '../../src/account/growth-local.js';
import { emptyGrowth, growthEntry, GROWTH_APP } from '../../src/account/growth-model.js';
const store=()=>{const m=new Map();return {get length(){return m.size;},key:i=>[...m.keys()][i]??null,getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),m};};
const locks={request:async(_key,fn)=>fn()};
const fixture=()=>{const storage=store();let time=100000;let id=0;const rpc=createLocalGrowth(storage,locks,()=>time);const controller=new GrowthController({rpc,storage,uuid:()=>`id-${++id}`});return {storage,rpc,controller,tick:()=>time+=4000};};
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:(x)=>resolve(x)};};
const waitTurn=()=>new Promise(r=>setTimeout(r,0));
const win=async(f)=>{await f.controller.begin();f.tick();await f.controller.finish(true);};
test('strict game entry rejects debug/forced weapons/duplicates/invalid compounds',()=>{
 assert(growthEntry(new URLSearchParams('account=1&growth=1')));
 for(const s of ['growth=1','account=1&growth=1&weapon=rapier','account=1&growth=1&opportunityTrial=bad','account=1&growth=1&account=1','account=1&growth=1&autoplay=1'])assert.equal(growthEntry(new URLSearchParams(s)),false,s);
});
test('three wins -> coins +point -> atomic buy/equip/strength -> reload',async()=>{
 const f=fixture();await f.controller.identify('practice');for(let i=0;i<3;i++)await win(f);
 assert.equal(f.controller.state.coins,30);assert.equal(f.controller.state.points,1);
 await f.controller.enqueue('purchase',{p_item_id:'wayfarer_seal'});assert.equal(f.controller.state.coins,0);
 await f.controller.enqueue('equip',{p_item_id:'wayfarer_seal'});await f.controller.enqueue('allocate',{p_character_id:'player',p_stat:'strength'});
 const c=new GrowthController({rpc:f.rpc,storage:f.storage});await c.identify('practice');assert.equal(c.state.characters.player.strength,1);assert.equal(c.state.equipped,'wayfarer_seal');assert.equal(c.state.wins,3);
});
test('duplicate finish and purchase UUID never double charge/grant; mismatch rejected',async()=>{
 const f=fixture();await f.controller.identify('practice');await f.controller.begin();const round=f.controller.round;f.tick();await f.controller.finish(true);
 await f.rpc('finish_round',{p_app_id:GROWTH_APP,p_round_id:round.id,p_win:true});assert.equal((await f.rpc('snapshot',{})).coins,10);
 await assert.rejects(()=>f.rpc('finish_round',{p_app_id:GROWTH_APP,p_round_id:round.id,p_win:false}),{code:'PT409'});
 for(let i=0;i<2;i++)await win(f);const args={p_app_id:GROWTH_APP,p_request_id:'buy',p_item_id:'wayfarer_seal'};
 await f.rpc('purchase',args);await f.rpc('purchase',args);assert.equal((await f.rpc('snapshot',{})).coins,0);
 await assert.rejects(()=>f.rpc('equip',args),{code:'PT409'});
});
test('loss/restart/card preview cannot grant wins; insufficient funds rolls back',async()=>{
 const f=fixture();await f.controller.identify('practice');assert.equal(f.controller.state.wins,0);
 await f.controller.begin();f.tick();await f.controller.finish(false);assert.equal(f.controller.state.wins,0);
 await f.controller.begin();f.controller.cancel();f.tick();await f.controller.finish(true);assert.equal(f.controller.state.wins,0);
 const before=await f.rpc('snapshot',{});await assert.rejects(()=>f.rpc('purchase',{p_request_id:'poor',p_item_id:'wayfarer_seal'}));assert.deepEqual(await f.rpc('snapshot',{}),before);
});
test('lost response after committed reward is retried with same ID after reload',async()=>{
 const f=fixture();let fail=true;const rpc=async(m,a,u)=>{const value=await f.rpc(m,a,u);if(m==='finish_round'&&fail){fail=false;throw Error('connection lost after commit');}return value;};
 const c=new GrowthController({rpc,storage:f.storage,uuid:()=> 'stable-round'});await c.identify('practice');await c.begin();f.tick();await c.finish(true);assert.equal(c.pending().length,1);
 const next=new GrowthController({rpc,storage:f.storage});await next.identify('practice');assert.equal(next.state.wins,1);assert.equal(next.state.coins,10);assert.equal(next.pending().length,0);
});
test('stale response and pending rewards remain bound to original identity',async()=>{
 const wait=deferred();const storage=store();let delayed=false;
 const rpc=async(method,args,user)=>{if(method==='snapshot')return {...emptyGrowth(),coins:user==='B'?20:0};if(delayed)return wait.promise;return {round_id:'A-round'};};
 const c=new GrowthController({rpc,storage});await c.identify('A');await c.begin();delayed=true;const finish=c.finish(true);await waitTurn();await c.identify('B');wait.resolve({...emptyGrowth(),coins:10,revision:1});await finish;
 assert.equal(c.state.coins,20);assert.equal(c.identity,'B');assert([...storage.m.keys()].some(k=>k.includes(':A:pending:')));assert.equal(c.pending().length,0);
});
test('new op queued during pending RPC is also flushed',async()=>{
 const storage=store(),wait=deferred();let calls=0;
 const c=new GrowthController({storage,rpc:async m=>{if(m==='snapshot')return emptyGrowth();if(++calls===1)await wait.promise;return {...emptyGrowth(),revision:calls};}});await c.identify('A');const first=c.enqueue('equip',{p_item_id:null});await waitTurn();void c.enqueue('equip',{p_item_id:null});wait.resolve();await first;assert.equal(calls,2);assert.equal(c.pending().length,0);
});
test('failed durable write prevents a mutation request',async()=>{
 const storage=store();let mutations=0;const c=new GrowthController({storage,rpc:async m=>{if(m!=='snapshot')mutations++;return emptyGrowth();}});await c.identify('A');storage.setItem=()=>{throw Error('full');};await c.enqueue('purchase',{p_item_id:'wayfarer_seal'});assert.equal(mutations,0);
});
test('local practice wallet is never imported into remote account',async()=>{
 const f=fixture();await f.controller.identify('practice');await win(f);const c=new GrowthController({storage:f.storage,rpc:async()=>emptyGrowth()});await c.identify('real-user');assert.equal(c.state.wins,0);assert.equal(c.state.coins,0);
});
test('immediate finish waits for registration instead of cancelling its ticket',async()=>{
 const f=fixture();await f.controller.identify('practice');
 const start=f.controller.begin();f.tick();const finish=f.controller.finish(true);await Promise.all([start,finish]);
 // Registration may occur after the result: the too-young result remains durable for retry.
 f.tick();await f.controller.flush();assert.equal(f.controller.state.wins,1);assert.equal(f.controller.pending().length,0);clearTimeout(f.controller.retryTimer);
});
test('next registration waits for a completed round whose begin response was delayed',async()=>{
 const f=fixture(),delayed=deferred();let begins=0;
 const rpc=async(m,a)=>{const result=await f.rpc(m,a);if(m==='begin_round'&&++begins===1)await delayed.promise;return result;};
 const c=new GrowthController({rpc,storage:f.storage});await c.identify('practice');const first=c.begin();await waitTurn();f.tick();const finish=c.finish(true);const next=c.begin();await waitTurn();assert.equal(begins,1);delayed.resolve();await Promise.all([first,finish,next]);
 assert.equal(begins,2);assert.equal(c.state.wins,1);assert.equal(c.pending().length,0);
});
test('cancelled in-flight registration cannot arrive after its replacement',async()=>{
 const f=fixture(),delayed=deferred();let begins=0;
 const rpc=async(m,a)=>{if(m==='begin_round'&&++begins===1)await delayed.promise;return f.rpc(m,a);};
 const c=new GrowthController({rpc,storage:f.storage});await c.identify('practice');const first=c.begin();await waitTurn();c.cancel();const next=c.begin();await waitTurn();assert.equal(begins,1);delayed.resolve();await Promise.all([first,next]);f.tick();await c.finish(true);assert.equal(c.state.wins,1);
});
test('settlement UI events only follow committed operations, never cache refresh; throwing UI cannot replay a purchase',async()=>{
 const f=fixture(),events=[];const c=new GrowthController({rpc:f.rpc,storage:f.storage,onSettled:e=>{events.push(e);throw Error('UI handler failed');}});
 await c.identify('practice');await c.refresh();assert.equal(events.length,0);
 for(let i=0;i<3;i++){await c.begin();f.tick();await c.finish(true);}
 assert.equal(events.length,3);assert.equal(events[0].state.coins-events[0].previous.coins,10);
 await c.enqueue('purchase',{p_item_id:'wayfarer_seal'});await c.flush();await c.refresh();
 assert.equal(events.length,4);assert.equal(c.pending().length,0);assert.equal(c.state.coins,0);assert.equal(c.state.inventory.length,1);
});
test('lost reward response shows no award until recovery and no duplicate delta after snapshot',async()=>{
 const f=fixture(),events=[];let fail=true;
 const rpc=async(m,a,u)=>{const value=await f.rpc(m,a,u);if(m==='finish_round'&&fail){fail=false;throw Error('lost response');}return value;};
 const c=new GrowthController({rpc,storage:f.storage,onSettled:e=>events.push(e)});await c.identify('practice');await c.begin();f.tick();await c.finish(true);assert.equal(events.length,0);assert.equal(c.pendingCount(),1);
 await c.refresh();assert.equal(events.length,1);assert.equal(events[0].state.coins-events[0].previous.coins,0);assert.equal(c.state.coins,10);assert.equal(c.pendingCount(),0);
});

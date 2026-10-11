import test from 'node:test';
import assert from 'node:assert/strict';
import { AccountController } from '../../src/account/controller.js';
import { cleanName, cleanSettings } from '../../src/account/profile.js';
const store = () => { const m = new Map(); return { getItem: (k) => m.get(k) || null, setItem: (k,v) => m.set(k,v), m }; };
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a;reject=b; }); return {promise,resolve,reject}; };
const make = (extra={}) => new AccountController({ appId:'test', storage:store(), ...extra });
const A = { id:'A',is_anonymous:true }, B = { id:'B',is_anonymous:false };
const profile = (name, revision=1) => ({ display_name:name,settings:{sound:false},revision });
test('no service: save and reload, separate app namespace', async () => {
 const storage=store();const c=make({storage});await c.start();c.change({display_name:'김씨',settings:{sound:false}});
 assert.equal(make({storage}).profile.display_name,'김씨');assert.equal(make({storage,appId:'other'}).profile.display_name,'여행자');
});
test('validation drops foreign keys, checks enum and Unicode name length', () => {
 assert.equal(cleanSettings({difficulty:'admin',token:'secret',sound:false}).difficulty,'normal');
 assert.equal('token' in cleanSettings({token:'secret'}),false);assert.equal(cleanName('😀'.repeat(24)).length,48);assert.throws(()=>cleanName('😀'.repeat(25)));
});
test('malformed/blocked storage does not prevent playing', async () => {
 const storage=store();storage.setItem('stillness-account:v1:test:device','{"profile":{"display_name":"\u0001"}}');
 const c=make({storage});await c.start();assert.equal(c.profile.display_name,'여행자');
 const d=make({storage:{getItem(){throw Error();},setItem(){throw Error();}}});await d.start();d.change({display_name:'still works'});assert.equal(d.storageOK,false);
});
test('automatic guest created once; own save loaded on reconnect', async()=>{
 let user=null, row=null, creates=0;
 const transport={session:async()=>user,guest:async()=>{creates++;return user=A;},load:async()=>row,save:async(r,p)=>row={...p,revision:r+1}};
 const storage=store();const c=make({storage,transport});await c.start();assert.equal(c.status,'saved');await make({storage,transport}).start();assert.equal(creates,1);
});
test('first offline visit still saves locally',async()=>{
 const c=make({transport:{session:async()=>{throw Error('offline');}}});await c.start();c.change({display_name:'offline'});assert.equal(c.profile.display_name,'offline');assert.equal(c.ready,true);
});
test('lost credential never silently creates replacement guest',async()=>{
 const storage=store();storage.setItem('stillness-account:v1:test:last-user','"A"');let calls=0;
 const c=make({storage,transport:{session:async()=>null,guest:async()=>{calls++;return A;}}});await c.start();assert.equal(c.status,'expired');assert.equal(calls,0);
});
test('slow save serializes newer edits; dirty cleared only for matching edit', async()=>{
 const wait=deferred();let calls=0;const c=make({transport:{load:async()=>profile('old'),save:async(r,p)=>{calls++;if(calls===1)await wait.promise;return {...p,revision:r+1};}}});await c.adopt(A);
 c.change({display_name:'first'});const saving=c.flush();c.change({display_name:'second'});wait.resolve();await saving;
 assert.equal(c.profile.display_name,'second');assert.equal(calls,2);assert.equal(c.revision,3);assert.equal(c.dirty,false);
});
test('switch account while old save in flight never contaminates target account',async()=>{
 const wait=deferred();const calls=[];const c=make({transport:{load:async(id)=>profile(id),save:async(r,p,id)=>{calls.push(id);await wait.promise;return {...p,revision:r+1};}}});await c.adopt(A);c.change({display_name:'A edit'});const saving=c.flush();await c.adopt(B);wait.resolve();await saving;
 assert.equal(c.profile.display_name,'B');assert.equal(c.revision,1);assert.deepEqual(calls,['A']);
});
test('stale load is ignored after switching account',async()=>{
 const wait=deferred();const c=make({transport:{load:async(id)=>id==='A'?wait.promise:profile('B')}});const old=c.adopt(A);await c.adopt(B);wait.resolve(profile('A'));await old;assert.equal(c.profile.display_name,'B');
});
test('CAS conflict preserves local edit; explicit reload saves backup',async()=>{
 const storage=store();const c=make({storage,transport:{load:async()=>profile('remote',3),save:async()=>{throw {code:'PT409'};}}});await c.adopt(A);c.change({display_name:'mine'});await c.flush();assert.equal(c.status,'conflict');assert.equal(c.profile.display_name,'mine');await c.reloadRemote();assert.equal(c.profile.display_name,'remote');assert.equal(JSON.parse(storage.getItem(c.prefix+'backup:A')).profile.display_name,'mine');
});
test('offline pending edits survive reload and conflict with newer server revision',async()=>{
 const storage=store();const transport={load:async()=>profile('remote'),save:async()=>{throw Error('offline');}};
 const c=make({storage,transport});await c.adopt(A);c.change({display_name:'pending'});await c.flush();
 const d=make({storage,transport:{load:async()=>profile('other-device',2)}});await d.adopt(A);assert.equal(d.status,'conflict');assert.equal(d.profile.display_name,'pending');
});
test('expired session clears visible previous user; link same UID keeps profile',async()=>{
 const c=make({transport:{load:async()=>profile('mine')}});await c.adopt(A);await c.adopt({...A,is_anonymous:false});assert.equal(c.profile.display_name,'mine');c.sessionEnded();assert.equal(c.profile.display_name,'여행자');assert.equal(c.status,'expired');
});
test('repeated startup shares exactly one guest request',async()=>{
 const wait=deferred();let creates=0;const c=make({transport:{session:async()=>{await wait.promise;return null;},guest:async()=>{creates++;return A;},load:async()=>profile('one')}});
 const first=c.start(),second=c.start();wait.resolve();await Promise.all([first,second]);assert.equal(creates,1);
});
test('new guest retains imported local profile across first failed fetch and reload',async()=>{
 const storage=store();const local=make({storage});local.change({display_name:'retained'});
 const transport={session:async()=>null,guest:async()=>A,load:async()=>{throw Error('offline');}};
 const c=make({storage,transport});await c.start();const d=make({storage,transport:{...transport,session:async()=>A}});await d.start();assert.equal(d.profile.display_name,'retained');assert.equal(d.dirty,true);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readProgress, recordAcquisition, unlockEventTitle, PROGRESS_KEY } from '../../src/lobby_progress.js';
const storage = new Map();
globalThis.localStorage = { getItem:k=>storage.get(k)??null, setItem:(k,v)=>storage.set(k,v) };
test('starter grants excluded; acquisition receipts count both kinds once, independently of titles',()=>{
 assert.equal(readProgress().level,1); assert.equal(readProgress().coins,100); assert.equal(readProgress().title,'여행자');
 for(const id of ['tree_branch','longsword','kettle'])assert.equal(recordAcquisition({receipt:id,kind:'item',source:'starter'}),false);
 assert.equal(readProgress().level,1);
 assert.equal(recordAcquisition({receipt:'drop-1',kind:'item',source:'loot'}),true);
 assert.equal(recordAcquisition({receipt:'book-1',kind:'skillbook',source:'reward'}),true);
 assert.equal(recordAcquisition({receipt:'drop-1',kind:'item',source:'loot'}),false);
 assert.equal(readProgress().level,3);
 assert.equal(unlockEventTitle('test-event','검증용 호칭'),true);
 assert.equal(unlockEventTitle('test-event','중복'),false);
 assert.equal(readProgress().level,3);assert.equal(readProgress().title,'여행자');
 assert.equal(JSON.parse(storage.get(PROGRESS_KEY)).acquisitions.length,2);
});
test('malformed and duplicated saved receipts cannot inflate level; invalid currency/title fall back',()=>{
 storage.set(PROGRESS_KEY,JSON.stringify({version:1,acquisitions:[null,{receipt:'x',kind:'item'},{receipt:'x',kind:'skillbook'},{receipt:'bad',kind:'unknown'}],coins:-20,title:'unearned',titles:[]}));
 assert.equal(readProgress().level,2);assert.equal(readProgress().coins,100);assert.equal(readProgress().title,'여행자');
});
test('blocked storage keeps new acquisitions for the session',()=>{
 globalThis.localStorage={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}};
 assert.equal(recordAcquisition({receipt:'session-book',kind:'skillbook',source:'reward'}),true);
 assert.equal(readProgress().level,3);assert.equal(recordAcquisition({receipt:'session-book',kind:'skillbook'}),false);
});

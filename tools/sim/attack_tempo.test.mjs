import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector2} from 'three';
import {tempoHand} from '../../src/attack_tempo.js';
import {STAMINA} from '../../src/config.js';
const before={...STAMINA};
function setup(speed=.6){
  STAMINA.attackTempo=true;STAMINA.tempoInput=true;
  const f={handOffset:new Vector2(),stamina:{attackSpeed:speed,guarding:false},state:'stand'};
  return {f,prev:new Vector2()};
}
test.after(()=>Object.assign(STAMINA,before));
test('fatigued input keeps ordered corners and reaches the final point after release',()=>{
  const s=setup();let crossed=false;
  for(let i=1;i<=72;i++){
    const t=i/120;s.f.handOffset.set(Math.min(1,t/.2),Math.max(0,Math.min(1,(t-.2)/.2)));
    const out=tempoHand(s,1/120);s.prev.copy(out);
    if(out.y>0){assert.ok(out.x>.999999);crossed=true;}
  }
  assert.ok(crossed);assert.equal(s.tempoInput.pending,true);
  for(let i=0;i<180;i++){s.prev.copy(tempoHand(s,1/120));}
  assert.ok(s.prev.distanceTo(new Vector2(1,1))<1e-7);assert.equal(s.tempoInput.pending,false);
});
test('guard interrupts queued attacks immediately and recovery starts from the rendered hand',()=>{
  const s=setup();s.f.handOffset.set(1,0);const out=tempoHand(s,1/120).clone();
  s.recovering=true;assert.deepEqual(tempoHand(s,1/120).toArray(),out.toArray());assert.equal(s.tempoInput,null);
  s.recovering=false;s.f.handOffset.set(0,1);tempoHand(s,1/120);s.f.stamina.guarding=true;
  assert.equal(tempoHand(s,1/120),s.f.handOffset);assert.equal(s.tempoInput,null);
  s.f.stamina.guarding=false;s.recovering=false;tempoHand(s,1/120);
  s.recovering=true;s.f.inputActive=true;s.f.handOffset.set(-.4,.2);
  assert.deepEqual(tempoHand(s,1/120).toArray(),[-.4,.2]);
});
test('fresh, tempo disabled, and AI input bypass the queue without changing the input object',()=>{
  for(const kind of ['fresh','off','ai']){
    const s=setup(kind==='fresh'?1:.6);if(kind==='off'){STAMINA.attackTempo=false;}if(kind==='ai')s.f.aiControlled=true;
    s.f.handOffset.set(.3,.4);assert.equal(tempoHand(s,1/120),s.f.handOffset);assert.deepEqual(s.f.handOffset.toArray(),[.3,.4]);assert.equal(s.tempoInput,null);
  }
});

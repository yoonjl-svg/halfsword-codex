import test from 'node:test';
import assert from 'node:assert/strict';
import {probe} from './iberian_beat_probe.mjs';
const common={attack:'zornhau',atk:'longsword',gap:1.4,track:true};
const payload=r=>({health:r.health,enemy:r.enemy,frames:r.frames,clashes:r.clashes});
test('zero gain matches an absent hook in the actual contact fixture',()=>{
 assert.deepEqual(payload(probe({...common,gain:0})),payload(probe({...common,gain:0,installed:false})));
});
test('unequipped school parry cannot receive the special beat',()=>{
 const a=probe({...common,book:false,gain:1.4,impulseCap:6,speedCap:8}),b=probe({...common,book:false,gain:0});
 assert.equal(a.beats.length,0);assert.deepEqual(payload(a),payload(b));
});
test('contact recoil is finite, bounded and issued once for this attack',()=>{
 const r=probe({...common,gain:1.4,impulseCap:6,speedCap:8});assert.equal(r.beats.length,1);
 assert.ok(r.beats[0].impulse>0&&r.beats[0].impulse<=6);
 for(const f of r.frames)for(const k of ['tip','root','defRoot','defTip'])assert.ok(f[k].every(Number.isFinite));
 assert.equal(r.beats[0].line,'highR');
});

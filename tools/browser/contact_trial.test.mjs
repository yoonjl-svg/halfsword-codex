import assert from 'node:assert/strict';
import {configureContactTrial} from '../../src/contact_trial.js';
import {configureSwordsmanshipDefault} from '../../src/swordsmanship_default.js';
let checks=0;
for(const weapon of ['longsword','zweihander']) for(const model of ['legacy','centerline']) {
  const params=new URLSearchParams({contactV2:model,weapon}),before=params.toString(),c=configureContactTrial(params);
  assert(c.active);assert.equal(c.model,model);assert.equal(c.weapon,weapon);
  assert.equal(c.foeWeapon,weapon==='longsword'?'zweihander':'longsword');
  assert.deepEqual(c.settings,{skill:'0.7',difficulty:'normal'});assert.equal(params.toString(),before);
  // main installs the same r2 explicitly; the ordinary route must not silently
  // attach a second policy to a comparison query before strict parsing.
  assert.equal(configureSwordsmanshipDefault(params).active,false);checks++;
}
for(const query of ['contactV2=nope','contactV2=','contactV2=centerline&contactV2=legacy',
  'contactV2=centerline&weapon=qinggang','contactV2=centerline&weapon=',
  'contactV2=centerline&weapon=longsword&weapon=zweihander',
  'contactV2=centerline&cutTrial=budgeted','contactV2=legacy&swordsmanshipTrial=unified',
  'contactV2=centerline&combatTrial=integrated','contactV2=centerline&edgeTrial=continuous']) {
  const c=configureContactTrial(new URLSearchParams(query));assert(c.requested&&!c.active);assert.equal(c.model,'legacy');checks++;
}
assert(!configureContactTrial(new URLSearchParams()).requested);
assert(configureContactTrial(new URLSearchParams('contactV2=centerline')).active);
assert(configureSwordsmanshipDefault(new URLSearchParams()).active);checks+=3;
console.log(JSON.stringify({pass:true,checks}));

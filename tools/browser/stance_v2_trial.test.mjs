import assert from 'node:assert/strict';
import {configureStanceV2Trial} from '../../src/stance_v2_trial.js';
import {configureContactTrial} from '../../src/contact_trial.js';
import {configureSwordsmanshipDefault} from '../../src/swordsmanship_default.js';
let checks = 0;
for (const model of ['legacy', 'fresh']) {
  const params = new URLSearchParams({stanceV2: model, weapon: 'zweihander'}), before = params.toString();
  const result = configureStanceV2Trial(params);
  assert(result.active && result.requested && result.playerOnly);
  assert.equal(result.model, model); assert.equal(result.weapon, 'zweihander'); assert.equal(result.foeWeapon, 'longsword');
  assert.deepEqual(result.settings, {skill: '0.7', difficulty: 'normal'});
  assert.equal(params.toString(), before); assert.equal(configureSwordsmanshipDefault(params).active, false);
  assert.equal(configureContactTrial(params).active, false); checks++;
}
for (const query of ['stanceV2=', 'stanceV2=unknown', 'stanceV2=fresh&stanceV2=legacy',
  'stanceV2=fresh&weapon=', 'stanceV2=fresh&weapon=longsword', 'stanceV2=fresh&weapon=pistol',
  'stanceV2=fresh&weapon=zweihander&weapon=zweihander', 'stanceV2=fresh&stanceTrial=fresh',
  'stanceV2=fresh&contactV2=centerline', 'stanceV2=fresh&physicsTrial=support',
  'stanceV2=fresh&cutTrial=budgeted', 'stanceV2=fresh&swordsmanshipTrial=unified']) {
  const result = configureStanceV2Trial(new URLSearchParams(query));
  assert(result.requested && !result.active); assert.equal(result.model, 'legacy');
  assert.equal(result.weapon, null); assert.deepEqual(result.settings, {}); checks++;
}
assert(configureStanceV2Trial(new URLSearchParams('stanceV2=fresh')).active);
assert(!configureStanceV2Trial(new URLSearchParams()).requested);
assert(configureSwordsmanshipDefault(new URLSearchParams()).active);
assert(configureContactTrial(new URLSearchParams('contactV2=centerline&weapon=longsword')).active); checks += 4;
console.log(JSON.stringify({pass: true, checks}));

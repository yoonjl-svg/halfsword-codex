import test from 'node:test';
import assert from 'node:assert/strict';
import {configureRecutV2Trial} from '../../src/roll_target_trial.js';
import {configureContactTrial} from '../../src/contact_trial.js';
import {configureStanceV2Trial} from '../../src/stance_v2_trial.js';
import {configureGravityV2Trial} from '../../src/gravity_v2_trial.js';
import {configureRecoveryContactV2Trial} from '../../src/recovery_contact_v2_trial.js';
import {configureSwordsmanshipDefault, SWORDSMANSHIP_DEFAULT_RESEARCH_MARKERS} from '../../src/swordsmanship_default.js';

test('Matched recut entries select only their weapon and player roll policy without changing the query', () => {
  for (const model of ['baseline', 'bounded']) for (const weapon of [null, 'longsword', 'qinggang']) {
    const query = new URLSearchParams({recutV2: model}); if (weapon) query.set('weapon', weapon);
    const before = query.toString(), value = configureRecutV2Trial(query);
    assert.equal(value.active, true); assert.equal(value.model, model);
    assert.equal(value.weapon, weapon || 'longsword'); assert.equal(value.foeWeapon, 'longsword');
    assert.equal(value.rollModel, model === 'bounded' ? 'bounded' : 'legacy'); assert.equal(value.playerOnly, true);
    assert.deepEqual(value.settings, {skill: '0.7', difficulty: 'normal'}); assert.equal(query.toString(), before);
    assert.equal(configureSwordsmanshipDefault(query).active, false);
  }
});

test('Malformed, duplicate and mixed requests cannot select bounded or another trial', () => {
  const invalid = ['', 'weapon=qinggang', 'recutV2=', 'recutV2=other', 'recutV2=__proto__',
    'recutV2=bounded&recutV2=bounded', 'recutV2=baseline&recutV2=bounded',
    'recutV2=bounded&weapon=', 'recutV2=bounded&weapon=zweihander',
    'recutV2=bounded&weapon=longsword&weapon=qinggang', 'recutV2=bounded&foeWeapon=longsword',
    'recutV2=bounded&unknown=1',
    ...SWORDSMANSHIP_DEFAULT_RESEARCH_MARKERS.filter(k => k !== 'recutV2').map(k => `recutV2=bounded&${k}=1`)];
  for (const raw of invalid) {
    const value = configureRecutV2Trial(new URLSearchParams(raw));
    assert.equal(value.active, false, raw); assert.equal(value.rollModel, 'legacy', raw);
    assert.deepEqual(value.settings, {}, raw);
  }
  const entries = [['contactV2=centerline', configureContactTrial], ['stanceV2=fresh', configureStanceV2Trial],
    ['gravityV2=plus25', configureGravityV2Trial], ['recoveryContactV2=combined', configureRecoveryContactV2Trial]];
  for (const [raw, parse] of entries) {
    assert.equal(parse(new URLSearchParams(raw)).active, true, raw);
    const mixed = new URLSearchParams(`${raw}&recutV2=bounded`);
    assert.equal(parse(mixed).active, false, raw); assert.equal(configureRecutV2Trial(mixed).active, false, raw);
  }
  // main quarantines every requested malformed compound entry to this ordinary policy.
  assert.equal(configureSwordsmanshipDefault(new URLSearchParams()).active, true);
});

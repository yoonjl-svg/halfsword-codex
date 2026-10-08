// URL policy and real pose getters only; no native physics or render claims.
import assert from 'node:assert/strict';
import { Fighter } from '../../../src/fighter.js';
import { configureRecoveryFinishTrial } from '../../../src/recovery_finish_trial.js';

const checks = [];
for (const query of ['', 'weapon=rapier', 'movementFix=unknown',
  'movementFix=getup-base&movementFix=getup-lead',
  'movementFix=getup-base&weapon=unknown', 'movementFix=getup-base&extra=1']) {
  const trial = configureRecoveryFinishTrial(new URLSearchParams(query));
  assert(!trial.active);
  assert.equal(trial.getupLeadDelay, true);
  checks.push(`Inactive or invalid URL preserves ordinary default: ${query}`);
}
for (const weapon of ['longsword', 'qinggang', 'zweihander', 'rapier']) {
  for (const model of ['baseline', 'finish', 'getup-base', 'getup-lead']) {
    const trial = configureRecoveryFinishTrial(new URLSearchParams({ movementFix: model, weapon }));
    assert(trial.active);
    assert.equal(trial.getupLeadDelay, model !== 'getup-base');
    const f = Object.assign(Object.create(Fighter.prototype), {
      getupLeadDelay: trial.getupLeadDelay, state: 'getup', stateTime: 1.55,
      kneelTime: 1.1, riseTime: .9,
    });
    assert(Math.abs(f.kneelAmount - .5) < 1e-12);
    assert(model === 'getup-base' ? Math.abs(f.kneelAmountB - f.kneelAmount) < 1e-12 : f.kneelAmountB > f.kneelAmount);
    f.stateTime = 2;
    assert(Math.abs(f.kneelAmountB) < 1e-12);
    f.state = 'stand'; assert.equal(f.kneelAmountB, 0);
    f.state = 'kneel'; assert.equal(f.kneelAmountB, 1);
    checks.push(`URL model and actual kneel getters: ${weapon}/${model}`);
  }
}
console.log(JSON.stringify({ pass: true, nativeSteps: 0, checks }));

import assert from 'node:assert/strict';
import { configureSupportProbe } from '../../src/support_probe.js';

const defaults = () => ({ assist: 0.3, catchMode: 'on', catchScale: 1 });
const parse = (query, gait = defaults()) => ({
  gait,
  info: configureSupportProbe(new URLSearchParams(query), gait),
});

const inactive = parse('assist=0&catch=off&catchScale=0');
assert.deepEqual(inactive.gait, defaults());
assert.equal(inactive.info.active, false);
assert.equal(parse('supportProbe=0&assist=0').info.active, false);

for (const value of ['', ' ', 'Infinity', 'NaN', '-0.1', '1.1', '0x1', '1e999', 'wrong']) {
  const query = new URLSearchParams({ supportProbe: '1', assist: value, catchScale: value, catch: value });
  assert.deepEqual(parse(query).gait, defaults(), `invalid value: ${JSON.stringify(value)}`);
}
assert.deepEqual(parse('supportProbe=1').gait, defaults());
assert.deepEqual(parse('supportProbe=1&assist=0.1&catch=on&catchScale=0.5').gait,
  { assist: 0.1, catchMode: 'on', catchScale: 0.5 });
assert.deepEqual(parse('supportProbe=1&assist=0&catch=off&catchScale=0').gait,
  { assist: 0, catchMode: 'off', catchScale: 0 });
assert.deepEqual(parse('supportProbe=1&assist=1&catch=fall&catchScale=1').gait,
  { assist: 1, catchMode: 'fall', catchScale: 1 });
const custom = { assist: 0.2, catchMode: 'fall', catchScale: 0.4 };
assert.deepEqual(parse('supportProbe=1&assist=&catch=wrong&catchScale=Infinity', custom).gait,
  { assist: 0.2, catchMode: 'fall', catchScale: 0.4 });
assert.equal(parse('supportProbe=1').info.sourceBase, '14bcf1f+혼합수정');
console.log('Support probe options: PASS');

/** Pure URL entry contracts. No Rapier, world construction or physics step.
 * Browser routing, saved preferences, restart and live contact are separate gates.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {configureRecoveryContactV2Trial} from '../../../src/recovery_contact_v2_trial.js';
import {configureGravityV2Trial} from '../../../src/gravity_v2_trial.js';
import {configureStanceV2Trial} from '../../../src/stance_v2_trial.js';
import {configureContactTrial} from '../../../src/contact_trial.js';
import {configureSwordsmanshipDefault, SWORDSMANSHIP_DEFAULT_RESEARCH_MARKERS} from '../../../src/swordsmanship_default.js';
import * as CONFIG from '../../../src/config.js';

const args = process.argv.slice(2);
assert(args.length <= 1 && (!args.length || args[0].startsWith('--out=')), 'Use optional --out=/absolute/fresh.json');
const out = args.length ? args[0].slice(6) : null;
if (out) assert(path.isAbsolute(out) && !fs.existsSync(out) && fs.existsSync(path.dirname(out)), 'Output must be a fresh absolute file in an existing directory');
const root = fileURLToPath(new URL('../../../', import.meta.url));
const sha = x => createHash('sha256').update(x).digest('hex');
const files = ['src/recovery_contact_v2_trial.js', 'src/gravity_v2_trial.js', 'src/stance_v2_trial.js',
  'src/contact_trial.js', 'src/swordsmanship_default.js', 'src/config.js', 'src/weapons.js',
  'tools/sim/experiments/round5_entry_contracts.mjs'];
const manifest = () => Object.fromEntries(files.map(f => [f, sha(fs.readFileSync(path.join(root, f)))]));
const sourceBefore = manifest(), configBefore = JSON.stringify(CONFIG), checks = [];
const parsers = {recovery: configureRecoveryContactV2Trial, gravity: configureGravityV2Trial,
  stance: configureStanceV2Trial, contact: configureContactTrial};
const settings = {skill: '0.7', difficulty: 'normal'};
function check(id, fn) {fn(); checks.push({id, pass: true});}
function parse(name, query) {
  const params = new URLSearchParams(query), before = params.toString();
  const info = parsers[name](params);
  assert.equal(params.toString(), before, 'Parser must preserve the supplied query');
  return info;
}
function inactive(name, query, requested) {
  const info = parse(name, query);
  assert.equal(info.active, false); assert.equal(info.requested, requested);
  assert.equal(info.weapon, null); assert.equal(info.foeWeapon, null);
  assert.deepEqual(info.settings, {});
}
function active(name, query, expected) {
  const info = parse(name, query);
  assert.equal(info.active, true); assert.equal(info.requested, true);
  assert.deepEqual(info.settings, settings);
  assert.equal(info.ordinaryHref, './');
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(info[key], value, key);
  for (const other of Object.keys(parsers).filter(k => k !== name)) {
    assert.equal(parse(other, query).active, false, 'One strict entry must not activate another');
  }
}

check('global baseline before pure parsing', () => {
  assert.equal(CONFIG.PHYSICS.gravity, -9.81); assert.equal(CONFIG.PHYSICS.timestep, 1 / 120);
  assert.equal(CONFIG.GAIT.stanceMemory, 'legacy'); assert.equal(CONFIG.BODY.supportModel, 'legacy');
});
for (const model of ['baseline', 'combined']) for (const suffix of ['', '&weapon=zweihander']) {
  const query = `recoveryContactV2=${model}${suffix}`;
  check(`recovery valid ${query}`, () => active('recovery', query, {model,
    cutModel: model === 'baseline' ? 'legacy' : 'centerline', stanceModel: 'fresh',
    weapon: 'zweihander', foeWeapon: 'longsword', playerOnly: true,
    labHref: './feature-lab.html#recovery-contact-v2-comparison'}));
}
const recoveryInvalid = ['', 'weapon=zweihander', 'recoveryContactV2=',
  'recoveryContactV2=unknown', 'recoveryContactV2=BASELINE', 'recoveryContactV2=__proto__',
  'recoveryContactV2=baseline&recoveryContactV2=baseline',
  'recoveryContactV2=baseline&recoveryContactV2=combined',
  'recoveryContactV2=combined&weapon=', 'recoveryContactV2=combined&weapon=longsword',
  'recoveryContactV2=combined&weapon=zweihander&weapon=zweihander',
  'recoveryContactV2=combined&foeWeapon=longsword',
  'recoveryContactV2=combined&skill=0.7', 'recoveryContactV2=combined&unknown=1'];
for (const query of recoveryInvalid) check(`recovery inactive ${query || '(empty)'}`, () =>
  inactive('recovery', query, new URLSearchParams(query).has('recoveryContactV2')));
for (const marker of SWORDSMANSHIP_DEFAULT_RESEARCH_MARKERS.filter(k => k !== 'recoveryContactV2')) {
  const query = `recoveryContactV2=combined&${marker}=1`;
  check(`recovery rejects mixed ${marker}`, () => {
    inactive('recovery', query, true);
    for (const name of ['gravity', 'stance', 'contact']) assert.equal(parse(name, query).active, false);
  });
}

for (const [level, gravity] of Object.entries({base: -9.81, plus15: -11.2815, plus25: -12.2625})) {
  for (const suffix of ['', '&weapon=zweihander']) {
    const query = `gravityV2=${level}${suffix}`;
    check(`prior gravity valid ${query}`, () => active('gravity', query, {level, gravity,
      stanceModel: 'fresh', weapon: 'zweihander', foeWeapon: 'longsword',
      labHref: './feature-lab.html#gravity-v2-comparison'}));
  }
}
for (const query of ['', 'gravityV2=', 'gravityV2=1.25', 'gravityV2=toString',
  'gravityV2=base&gravityV2=base', 'gravityV2=base&weapon=', 'gravityV2=base&weapon=longsword',
  'gravityV2=base&weapon=zweihander&weapon=zweihander', 'gravityV2=base&stanceV2=fresh',
  'gravityV2=base&recoveryContactV2=combined']) {
  check(`prior gravity inactive ${query || '(empty)'}`, () => {
    inactive('gravity', query, new URLSearchParams(query).has('gravityV2'));
    assert.equal(parse('gravity', query).gravity, null);
  });
}
for (const model of ['legacy', 'fresh']) for (const suffix of ['', '&weapon=zweihander']) {
  const query = `stanceV2=${model}${suffix}`;
  check(`prior stance valid ${query}`, () => active('stance', query, {model,
    weapon: 'zweihander', foeWeapon: 'longsword', playerOnly: true,
    labHref: './feature-lab.html#stance-v2-comparison'}));
}
for (const query of ['stanceV2=', 'stanceV2=unknown', 'stanceV2=fresh&stanceV2=fresh',
  'stanceV2=fresh&weapon=', 'stanceV2=fresh&weapon=longsword',
  'stanceV2=fresh&gravityV2=base', 'stanceV2=fresh&recoveryContactV2=combined']) {
  check(`prior stance inactive ${query}`, () => inactive('stance', query, true));
}
for (const model of ['legacy', 'centerline']) for (const weapon of [null, 'longsword', 'zweihander']) {
  const query = `contactV2=${model}${weapon ? '&weapon=' + weapon : ''}`, chosen = weapon ?? 'longsword';
  check(`prior contact valid ${query}`, () => active('contact', query, {model, weapon: chosen,
    foeWeapon: chosen === 'longsword' ? 'zweihander' : 'longsword', playerOnly: true,
    labHref: './feature-lab.html#contact-v2-comparison'}));
}
for (const query of ['contactV2=', 'contactV2=unknown', 'contactV2=centerline&contactV2=centerline',
  'contactV2=centerline&weapon=', 'contactV2=centerline&weapon=qinggang',
  'contactV2=centerline&gravityV2=base', 'contactV2=centerline&recoveryContactV2=combined']) {
  check(`prior contact inactive ${query}`, () => inactive('contact', query, true));
}
check('ordinary default policy remains unified', () => {
  for (const query of ['', 'weapon=zweihander', 'weapon=longsword&foe=default']) {
    const info = configureSwordsmanshipDefault(new URLSearchParams(query));
    assert.equal(info.active, true); assert.equal(info.model, 'unified');
    assert.equal(info.reason, 'ordinary_entry');
  }
});
check('new explicit marker is comparison intent before quarantine', () => {
  assert(SWORDSMANSHIP_DEFAULT_RESEARCH_MARKERS.includes('recoveryContactV2'));
  for (const value of ['baseline', 'combined', '', 'unknown']) {
    const info = configureSwordsmanshipDefault(new URLSearchParams(`recoveryContactV2=${value}`));
    assert.equal(info.active, false); assert(info.blockedBy.includes('recoveryContactV2'));
  }
  // The ordinary policy of an empty quarantined query; actual main routing is
  // independently reviewed and tested in the compiled browser, not emulated.
  assert.equal(configureSwordsmanshipDefault(new URLSearchParams()).active, true);
});
check('all pure parsers leave global physics/support configuration unchanged', () => {
  assert.equal(JSON.stringify(CONFIG), configBefore);
});
const sourceAfter = manifest();
assert.deepEqual(sourceAfter, sourceBefore, 'Entry source changed during pure contracts');
const result = {pass: true, physicsExecutions: 0, contractRows: checks.length, sourceStable: true,
  sourceBefore, sourceAfter, command: process.argv, checks,
  limits: 'Pure entry/config contracts only. Main query quarantine, saved storage, actual controller/world, touch, restart, combat and public delivery have separate audits.'};
if (out) fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify(result));

// URL dispatch and supported-roster contracts. No physics or browser fixture.
import assert from 'node:assert/strict';
import { WEAPONS } from '../../../src/weapons.js';
import { configureSwordsmanshipDefault, swordsmanshipDefaultSupportsWeapon,
  SWORDSMANSHIP_DEFAULT_WEAPONS, SWORDSMANSHIP_DEFAULT_RESEARCH_MARKERS,
} from '../../../src/swordsmanship_default.js';
import { configureSwordsmanshipTrial } from '../../../src/swordsmanship_trial.js';
import { configureIntegratedCombatTrial } from '../../../src/integrated_combat_trial.js';

const cases = [];
function test(name, run) { run(); cases.push({ name, pass: true }); }
const policy = query => configureSwordsmanshipDefault(new URLSearchParams(query));

test('ordinary selection fixes one base skill without overriding other preferences', () => {
  for (const query of ['', 'weapon=qinggang', 'weapon=longsword&foe=heinrich&foeWeapon=rapier',
    'stage=forest&cards=sabre,excalibur&back=classic',
    'look=heinrich&lookv=2&madEyes=1&render=webgl&fps=1&utm_source=bookmark']) {
    const params = new URLSearchParams(query), before = params.toString();
    const info = configureSwordsmanshipDefault(params);
    assert.equal(info.active, true, query);
    assert.equal(info.model, 'unified');
    assert.equal(info.reason, 'ordinary_entry');
    assert.deepEqual(info.settings, { skill: '0.7' });
    assert.equal(info.playerOnly, true);
    assert.equal(params.toString(), before, 'dispatch must not sanitize or rewrite the requested URL');
  }
});

test('every known research marker opts out even if empty, invalid, or duplicated', () => {
  assert.equal(new Set(SWORDSMANSHIP_DEFAULT_RESEARCH_MARKERS).size,
    SWORDSMANSHIP_DEFAULT_RESEARCH_MARKERS.length);
  for (const key of SWORDSMANSHIP_DEFAULT_RESEARCH_MARKERS) {
    for (const suffix of [`${key}=`, `${key}=not-a-model`, `${key}=legacy&${key}=candidate`]) {
      const info = policy(`weapon=qinggang&fps=1&${suffix}`);
      assert.equal(info.active, false, suffix);
      assert.equal(info.reason, 'research_entry');
      assert.deepEqual(info.blockedBy, [key]);
      assert.deepEqual(info.settings, {});
    }
  }
});

test('valid old comparisons retain their own dispatch and incomplete compounds stay legacy', () => {
  const unified = new URLSearchParams('swordsmanshipTrial=unified&weapon=qinggang');
  assert.equal(configureSwordsmanshipTrial(unified).active, true);
  assert.equal(configureSwordsmanshipDefault(unified).active, false);
  const integrated = new URLSearchParams('combatTrial=integrated&weapon=qinggang&foeWeapon=longsword&foe=heinrich&targetCorrection=none&onehandArm=manual&bladeShape=profile&thrustPlane=transported&finishRule=armorCausal');
  assert.equal(configureIntegratedCombatTrial(integrated).active, true);
  assert.equal(configureSwordsmanshipDefault(integrated).active, false);
  for (const query of ['swordsmanshipTrial=unified&weapon=monohoshizao',
    'swordsmanshipTrial=unified&weapon=morgenstern', 'combatTrial=integrated',
    'swordsmanshipTrial=unified&combatTrial=integrated']) {
    const requested = new URLSearchParams(query);
    assert.equal(configureSwordsmanshipDefault(requested).active, false, query);
  }
});

test('explicit legacy fallback is exact and malformed overrides cannot opt in', () => {
  const legacy = policy('swordsmanship=legacy&weapon=qinggang&stage=forest');
  assert.equal(legacy.active, false);
  assert.equal(legacy.reason, 'explicit_legacy');
  assert.deepEqual(legacy.settings, {});
  for (const query of ['swordsmanship=', 'swordsmanship=unified', 'swordsmanship=LEGACY',
    'swordsmanship=%20legacy', 'swordsmanship=legacy&swordsmanship=legacy',
    'swordsmanship=legacy&swordsmanship=unified']) {
    const info = policy(query);
    assert.equal(info.active, false, query);
    assert.equal(info.reason, 'malformed_default_override', query);
  }
  const combined = policy('swordsmanship=legacy&onehandArm=manual');
  assert.equal(combined.active, false);
  assert.equal(combined.reason, 'explicit_legacy');
  assert.deepEqual(combined.blockedBy, ['onehandArm']);
});

test('thirteen accepted melee weapons install; gun and withheld/internal specs stay out', () => {
  const expected = ['longsword', 'zweihander', 'estoc', 'sabre', 'rapier', 'falchion', 'qinggang',
    'excalibur', 'excalibur_replica', 'tree_branch', 'rubber_chicken', 'frozen_tuna', 'monohoshizao'];
  assert.deepEqual([...SWORDSMANSHIP_DEFAULT_WEAPONS].sort(), expected.slice().sort());
  for (const weapon of Object.values(WEAPONS)) {
    assert.equal(swordsmanshipDefaultSupportsWeapon(weapon), expected.includes(weapon.id), weapon.id);
  }
  for (const weapon of [null, undefined, {}, 'qinggang', { id: 'unknown' },
    { ...WEAPONS.qinggang, gun: true }, { ...WEAPONS.qinggang, trialOnly: true }]) {
    assert.equal(swordsmanshipDefaultSupportsWeapon(weapon), false);
  }
  // Entry policy and per-weapon installation are deliberately separate so
  // random cards can be resolved after entry without promoting excluded arms.
  for (const id of ['pistol', 'lightsaber', 'morgenstern']) {
    assert.equal(policy(`weapon=${id}`).active, true);
    assert.equal(swordsmanshipDefaultSupportsWeapon(WEAPONS[id]), false);
  }
});

test('lightsaber preview keeps ordinary physics entry and only opts its player weapon in', () => {
  const a = policy('weapon=lightsaber');
  const b = policy('weapon=lightsaber&swordsmanshipPreview=v2');
  assert.equal(a.previewWeapon, null); assert.equal(b.previewWeapon, 'lightsaber');
  assert.equal(a.active, true); assert.equal(b.active, true);
  assert.deepEqual(a.settings, b.settings); assert.deepEqual(a.blockedBy, b.blockedBy);
  assert.equal(swordsmanshipDefaultSupportsWeapon(WEAPONS.lightsaber, a), false);
  assert.equal(swordsmanshipDefaultSupportsWeapon(WEAPONS.lightsaber, b), true);
  assert.equal(swordsmanshipDefaultSupportsWeapon(WEAPONS.pistol, b), false);
  assert.equal(swordsmanshipDefaultSupportsWeapon(WEAPONS.morgenstern, b), false);
  for (const query of ['swordsmanshipPreview=v2', 'weapon=longsword&swordsmanshipPreview=v2',
    'weapon=lightsaber&swordsmanshipPreview=', 'weapon=lightsaber&swordsmanshipPreview=unknown',
    'weapon=lightsaber&weapon=lightsaber&swordsmanshipPreview=v2',
    'weapon=lightsaber&swordsmanshipPreview=v2&swordsmanshipPreview=v2',
    'weapon=lightsaber&swordsmanshipPreview=v2&swordsmanship=legacy']) {
    const info = policy(query);
    assert.equal(info.active, false, query); assert.equal(info.previewWeapon, null, query);
  }
  for (const marker of SWORDSMANSHIP_DEFAULT_RESEARCH_MARKERS) {
    const info = policy(`weapon=lightsaber&swordsmanshipPreview=v2&${marker}=anything`);
    assert.equal(info.active, false, marker); assert.equal(info.previewWeapon, null, marker);
  }
});

test('returned policy objects do not share mutable preference or exclusion state', () => {
  const a = policy(''), b = policy('');
  a.settings.skill = '0'; a.blockedBy.push('injected');
  assert.deepEqual(b.settings, { skill: '0.7' });
  assert.deepEqual(b.blockedBy, []);
  assert.deepEqual(policy('').settings, { skill: '0.7' });
});

console.log(JSON.stringify({ pass: true, cases: cases.length,
  researchMarkers: SWORDSMANSHIP_DEFAULT_RESEARCH_MARKERS.length,
  supportedMelee: SWORDSMANSHIP_DEFAULT_WEAPONS.length, physicsExecuted: false, results: cases }, null, 2));

// Session-only entry contract; no game, physics, browser or network execution.
// Usage: node tools/browser/integrated_combat_trial.test.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { configureIntegratedCombatTrial, mountIntegratedCombatTrial } from '../../src/integrated_combat_trial.js';

assert.equal(process.argv.length, 2, 'This contract test accepts no CLI arguments');
const html = await readFile(new URL('../../public/feature-lab.html', import.meta.url), 'utf8');
const common = { combatTrial: 'integrated', weapon: 'qinggang', foe: 'heinrich', foeWeapon: 'longsword',
  targetCorrection: 'none', onehandArm: 'manual', bladeShape: 'profile' };
const modes = { thrustPlane: 'transported', finishRule: 'armorCausal' };
const params = values => new URLSearchParams(values);
const copy = value => new URLSearchParams(value);
const entries = [];
let storageCalls = 0;
const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem() { storageCalls++; throw new Error('The entry helper must not read saved preferences'); },
  setItem() { storageCalls++; throw new Error('The entry helper must not rewrite saved preferences'); },
  removeItem() { storageCalls++; throw new Error('The entry helper must not remove saved preferences'); },
  clear() { storageCalls++; throw new Error('The entry helper must not clear saved preferences'); },
} });
function test(name, run) { run(); entries.push({ name, pass: true }); }
function cta(id) {
  const tag = html.match(new RegExp(`<a\\b[^>]*\\bid="${id}"[^>]*>`))?.[0];
  assert.ok(tag, `Missing actual product CTA ${id}`);
  const href = tag.match(/\bhref="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
  assert.ok(href);
  const url = new URL(href, 'https://yoonjl-svg.github.io/halfsword-codex/');
  assert.equal(url.origin, 'https://yoonjl-svg.github.io');
  assert.equal(url.pathname, '/halfsword-codex/'); assert.equal(url.hash, '');
  return url.searchParams;
}
function inactive(query, requested = true) {
  const result = configureIntegratedCombatTrial(query);
  assert.equal(result.requested, requested); assert.equal(result.active, false);
  assert.equal(result.variant, null); assert.equal(result.model, 'legacy');
  assert.equal(result.motionAssist, 'none'); assert.equal(result.finishRule, 'legacy');
  assert.equal(result.thrustPlane, 'legacy'); assert.equal(result.foe, null);
  assert.deepEqual(result.settings, {});
  assert.equal(result.reason, requested ? 'unsupported_or_incomplete_tuple' : 'not_requested');
  return result;
}
function active(query, expected) {
  const result = configureIntegratedCombatTrial(query);
  assert.equal(result.requested, true); assert.equal(result.active, true);
  for (const [key, value] of Object.entries(expected)) assert.equal(result[key], value, key);
  assert.equal(result.playerOnly, true); assert.equal(result.foe, 'heinrich');
  assert.deepEqual(result.settings, { skill: '0', difficulty: 'normal' });
  assert.equal(result.compareHref, './feature-lab.html#integrated-combat-comparison');
  assert.equal(result.ordinaryHref, './');
  return result;
}

try {
  const a = cta('playIntegratedLegacy'), b = cta('playIntegratedCombined');
  test('actual mobile A is motion-none with the fixed combined tuple', () => {
    assert.equal([...a].length, 10);
    assert.deepEqual(Object.fromEntries(a), { ...common, ...modes, motionAssist: 'none' });
    active(a, { variant: 'A', comparison: 'motion', model: 'motion-none', motionAssist: 'none',
      ...modes, reason: 'exact_motion_tuple' });
  });
  test('actual mobile B is motion-weak with the same fixed combined tuple', () => {
    assert.equal([...b].length, 10);
    assert.deepEqual(Object.fromEntries(b), { ...common, ...modes, motionAssist: 'weak' });
    active(b, { variant: 'B', comparison: 'motion', model: 'motion-weak', motionAssist: 'weak',
      ...modes, reason: 'exact_motion_tuple' });
  });
  test('actual A/B links differ only in motion assistance', () => {
    const left = copy(a), right = copy(b); left.delete('motionAssist'); right.delete('motionAssist');
    assert.deepEqual(Object.fromEntries(left), Object.fromEntries(right));
  });
  test('old nine-key baseline remains active without movement assistance', () => active(params({
    ...common, thrustPlane: 'legacy', finishRule: 'legacy' }), { variant: 'A', comparison: 'compound',
    model: 'baseline', motionAssist: 'none', thrustPlane: 'legacy', finishRule: 'legacy', reason: 'exact_compound_tuple' }));
  test('old nine-key combined remains active without movement assistance', () => active(params({
    ...common, ...modes }), { variant: 'B', comparison: 'compound', model: 'combined', motionAssist: 'none',
    ...modes, reason: 'exact_compound_tuple' }));
  test('query-free ordinary play remains inactive', () => inactive(params(), false));
  test('unmarked leaf query does not activate the integrated entry', () => inactive(params({ onehandArm: 'manual' }), false));

  for (const [name, mutate, requested = true] of [
    ['unknown movement value', query => query.set('motionAssist', 'strong')],
    ['empty movement value', query => query.set('motionAssist', '')],
    ['duplicate movement value', query => query.append('motionAssist', 'weak')],
    ['duplicate combat marker', query => query.append('combatTrial', 'integrated')],
    ['duplicate finish mode', query => query.append('finishRule', 'armorCausal')],
    ['wrong weapon', query => query.set('weapon', 'sabre')],
    ['wrong opponent', query => query.set('foe', 'unknown')],
    ['wrong collision profile', query => query.set('bladeShape', 'box')],
    ['wrong target correction', query => query.set('targetCorrection', 'weak')],
    ['missing manual arm mode', query => query.delete('onehandArm')],
    ['missing collision profile', query => query.delete('bladeShape')],
    ['extra mobile gain override', query => query.set('mobileVerticalGain', '1.8')],
    ['withdrawn cut-plane override', query => query.set('cutPlane', 'coherent')],
    ['wrong combat marker', query => query.set('combatTrial', 'other')],
    ['missing combat marker', query => query.delete('combatTrial'), false],
    ['mixed legacy finish with transported thrust', query => query.set('finishRule', 'legacy')],
    ['movement none with historical legacy modes', query => { query.set('motionAssist', 'none'); query.set('thrustPlane', 'legacy'); query.set('finishRule', 'legacy'); }],
    ['movement weak with historical legacy modes', query => { query.set('thrustPlane', 'legacy'); query.set('finishRule', 'legacy'); }],
  ]) test(`reject ${name}`, () => { const query = copy(b); mutate(query); inactive(query, requested); });

  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  try {
    const nodes = new Map(), skillRow = { style: { display: '' } };
    const element = () => ({ style: {}, children: [], append(...children) { this.children.push(...children);
      for (const child of children) if (child.id) nodes.set(child.id, child); } });
    const menuSub = { after(panel) { nodes.set(panel.id, panel); } }; nodes.set('menuSub', menuSub);
    const fixture = { getElementById: id => nodes.get(id) ?? null, createElement: element,
      createTextNode: text => ({ textContent: text }), querySelector: selector => {
        assert.equal(selector, '[data-setting="skill"]'); return { closest: name => { assert.equal(name, '.row'); return skillRow; } };
      } };
    Object.defineProperty(globalThis, 'document', { configurable: true, value: fixture });
    test('inactive UI creates no comparison panel', () => {
      mountIntegratedCombatTrial(inactive(params(), false)); assert.equal(nodes.has('integratedCombatTrialInfo'), false);
      assert.equal(skillRow.style.display, '');
    });
    test('active weak UI names the optional amount and preserves navigation', () => {
      mountIntegratedCombatTrial(configureIntegratedCombatTrial(b));
      const panel = nodes.get('integratedCombatTrialInfo'); assert.ok(panel);
      assert.match(panel.children[0].textContent, /통합 동작 비교 B.*약 \(15%\)/);
      assert.equal(nodes.get('integratedCombatCompare').href, './feature-lab.html#integrated-combat-comparison');
      assert.equal(nodes.get('integratedCombatExit').href, './');
      assert.equal(nodes.get('integratedCombatCompare').style.minHeight, '44px');
      assert.equal(nodes.get('integratedCombatExit').style.minHeight, '44px');
      assert.equal(skillRow.style.display, 'none');
      assert.match(panel.children.at(-1).textContent, /드래그 방향·높이 유지/);
    });
    test('mounting twice retains a single optional panel', () => {
      const original = nodes.get('integratedCombatTrialInfo');
      mountIntegratedCombatTrial(configureIntegratedCombatTrial(b));
      assert.equal(nodes.get('integratedCombatTrialInfo'), original);
    });
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete globalThis.document;
  }
  test('configuration and UI never read or rewrite saved preferences', () => assert.equal(storageCalls, 0));
  console.log(JSON.stringify({ pass: true, cases: entries.length, entries,
    scope: 'Actual product CTA query contract, backward-compatible nine-key tuples, malformed tuple rejection and session-only navigation DOM fixture. No physics, browser, native touch, actual storage persistence or movement efficacy test.' }));
} finally {
  if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
  else delete globalThis.localStorage;
}

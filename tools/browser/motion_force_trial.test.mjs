// Exact public force-comparison entry and UI contract; no physics or browser run.
// Usage: node tools/browser/motion_force_trial.test.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { configureIntegratedCombatTrial, mountIntegratedCombatTrial } from '../../src/integrated_combat_trial.js';

assert.equal(process.argv.length, 2, 'This contract test accepts no CLI arguments');
const html = await readFile(new URL('../../public/feature-lab.html', import.meta.url), 'utf8');
const common = { combatTrial: 'integrated', weapon: 'qinggang', foe: 'heinrich', foeWeapon: 'longsword',
  targetCorrection: 'none', onehandArm: 'manual', bladeShape: 'profile' };
const combined = { thrustPlane: 'transported', finishRule: 'armorCausal' };
const fixed = { ...common, ...combined, motionAssist: 'weak' };
const parameters = values => new URLSearchParams(values), copy = values => new URLSearchParams(values);
const entries = [];
function test(name, run) { run(); entries.push({ name, pass: true }); }
function link(id) {
  const tag = html.match(new RegExp(`<a\\b[^>]*\\bid="${id}"[^>]*>`))?.[0];
  assert.ok(tag, `Missing actual product CTA ${id}`);
  const href = tag.match(/\bhref="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&'); assert.ok(href);
  const url = new URL(href, 'https://yoonjl-svg.github.io/halfsword-codex/');
  assert.equal(url.origin, 'https://yoonjl-svg.github.io');
  assert.equal(url.pathname, '/halfsword-codex/'); assert.equal(url.hash, '');
  return { query: url.searchParams, text: html.match(new RegExp(`<a\\b[^>]*\\bid="${id}"[^>]*>([^<]+)</a>`))?.[1] };
}
function active(query, expected, compareHref = './feature-lab.html#motion-force-comparison') {
  const value = configureIntegratedCombatTrial(query);
  assert.equal(value.requested, true); assert.equal(value.active, true);
  for (const [key, expectedValue] of Object.entries(expected)) assert.equal(value[key], expectedValue, key);
  assert.equal(value.playerOnly, true); assert.equal(value.foe, 'heinrich');
  assert.deepEqual(value.settings, { skill: '0', difficulty: 'normal' });
  assert.equal(value.compareHref, compareHref); assert.equal(value.ordinaryHref, './');
  return value;
}
function inactive(query, requested = true) {
  const value = configureIntegratedCombatTrial(query);
  assert.equal(value.requested, requested); assert.equal(value.active, false);
  assert.equal(value.variant, null); assert.equal(value.model, 'legacy');
  assert.equal(value.motionTiming, null, 'Rejected timing must not survive in the ordinary policy');
  assert.equal(value.motionAssist, 'none'); assert.equal(value.finishRule, 'legacy');
  assert.equal(value.thrustPlane, 'legacy'); assert.equal(value.foe, null);
  assert.deepEqual(value.settings, {});
  assert.equal(value.reason, requested ? 'unsupported_or_incomplete_tuple' : 'not_requested');
  return value;
}
const restore = (key, descriptor) => descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key];
const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let storageCalls = 0;
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: Object.fromEntries(
  ['getItem', 'setItem', 'removeItem', 'clear'].map(method => [method, () => {
    storageCalls++; throw new Error('Force entry configuration/UI must not access saved preferences');
  }])) });

try {
  const a = link('playMotionForceBaseline'), b = link('playMotionForceSequenced');
  test('actual public baseline CTA is the exact eleven-key force A', () => {
    assert.equal([...a.query].length, 11); assert.deepEqual(Object.fromEntries(a.query), { ...fixed, motionTiming: 'baseline' });
    assert.equal(a.text, '▶ A · 기존 몸 협조');
    active(a.query, { comparison: 'force', variant: 'A', model: 'force-baseline', motionAssist: 'weak',
      motionTiming: 'baseline', ...combined, reason: 'exact_force_tuple' });
  });
  test('actual public body-lead CTA is the exact eleven-key force B', () => {
    assert.equal([...b.query].length, 11); assert.deepEqual(Object.fromEntries(b.query), { ...fixed, motionTiming: 'sequenced' });
    assert.equal(b.text, '▶ B · 몸 선행 협조');
    active(b.query, { comparison: 'force', variant: 'B', model: 'force-sequenced', motionAssist: 'weak',
      motionTiming: 'sequenced', ...combined, reason: 'exact_force_tuple' });
  });
  test('the new A/B pair differs only in body coordination policy', () => {
    const left = copy(a.query), right = copy(b.query); left.delete('motionTiming'); right.delete('motionTiming');
    assert.deepEqual(Object.fromEntries(left), Object.fromEntries(right));
  });
  test('public instructions distinguish held stop, reversal and release', () => {
    const section = html.match(/<section id="motion-force-comparison"[^>]*>([\s\S]*?)<\/section>/)?.[1]; assert.ok(section);
    assert.match(section, /좌우나 사선/); assert.match(section, /손을 댄 채 잠깐 멈춘 뒤 반대로/);
    assert.match(section, /손을 떼고 다시 베는/); assert.match(section, /보정에 끌려가는 느낌/);
    assert.match(section, /현재 손 요청을 몸통이 조금 먼저/);
    assert.match(section, /근력과 손 방향·높이는 유지/); assert.match(section, /최대 힘이나 타격 효과는 아직 검증 중/);
  });
  for (const [id, motionAssist, variant] of [['playIntegratedLegacy', 'none', 'A'], ['playIntegratedCombined', 'weak', 'B']])
    test(`existing ten-key ${id} remains a separate motion comparison`, () => {
      const query = link(id).query; assert.equal([...query].length, 10); assert.equal(query.has('motionTiming'), false);
      active(query, { comparison: 'motion', variant, model: `motion-${motionAssist}`, motionAssist,
        motionTiming: null, ...combined, reason: 'exact_motion_tuple' }, './feature-lab.html#integrated-combat-comparison');
    });
  test('existing nine-key baseline keeps its old contract', () => active(parameters({ ...common, thrustPlane: 'legacy', finishRule: 'legacy' }), {
    comparison: 'compound', variant: 'A', model: 'baseline', motionAssist: 'none', motionTiming: null, thrustPlane: 'legacy', finishRule: 'legacy',
    reason: 'exact_compound_tuple' }, './feature-lab.html#integrated-combat-comparison'));
  test('existing nine-key combined keeps its old contract', () => active(parameters({ ...common, ...combined }), {
    comparison: 'compound', variant: 'B', model: 'combined', motionAssist: 'none', motionTiming: null, ...combined,
    reason: 'exact_compound_tuple' }, './feature-lab.html#integrated-combat-comparison'));
  test('ordinary query-free entry remains inactive', () => inactive(parameters(), false));

  for (const [name, mutate, requested = true] of [
    ['unknown timing value', query => query.set('motionTiming', 'unknown')],
    ['empty timing value', query => query.set('motionTiming', '')],
    ['duplicate timing value', query => query.append('motionTiming', 'baseline')],
    ['duplicate identical timing value', query => query.append('motionTiming', 'sequenced')],
    ['baseline without weak movement', query => { query.set('motionTiming', 'baseline'); query.set('motionAssist', 'none'); }],
    ['sequenced without weak movement', query => query.set('motionAssist', 'none')],
    ['missing movement value', query => query.delete('motionAssist')],
    ['mixed legacy finish mode', query => query.set('finishRule', 'legacy')],
    ['wrong weapon', query => query.set('weapon', 'sabre')],
    ['wrong opponent', query => query.set('foe', 'default')],
    ['duplicate common marker', query => query.append('combatTrial', 'integrated')],
    ['extra mobile gain override', query => query.set('mobileVerticalGain', '1.8')],
    ['withdrawn cut override', query => query.set('cutPlane', 'coherent')],
    ['withdrawn support override', query => query.set('supportModel', 'projected')],
    ['unapproved recovery override', query => query.set('armRecovery', 'independent')],
    ['missing collision profile', query => query.delete('bladeShape')],
    ['missing combat marker', query => query.delete('combatTrial'), false],
  ]) test(`reject ${name}`, () => { const query = copy(b.query); mutate(query); inactive(query, requested); });

  function fixture() {
    const nodes = new Map(), row = { style: { display: '' } };
    const element = () => ({ style: {}, children: [], append(...children) { this.children.push(...children);
      for (const child of children) if (child.id) nodes.set(child.id, child); } });
    nodes.set('menuSub', { after(panel) { nodes.set(panel.id, panel); } });
    return { nodes, row, document: { getElementById: id => nodes.get(id) ?? null, createElement: element,
      createTextNode: text => ({ textContent: text }), querySelector: selector => {
        assert.equal(selector, '[data-setting="skill"]'); return { closest: name => { assert.equal(name, '.row'); return row; } };
      } } };
  }
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  try {
    for (const [query, variant, label] of [[a.query, 'A', '기존 몸 협조'], [b.query, 'B', '몸 선행 협조']])
      test(`force ${variant} UI names the comparison and preserves real navigation`, () => {
        const dom = fixture(); Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.document });
        mountIntegratedCombatTrial(configureIntegratedCombatTrial(query));
        const panel = dom.nodes.get('integratedCombatTrialInfo'); assert.ok(panel);
        assert.ok(panel.children[0].textContent.includes(label), 'The label must describe the actual body coordination comparison');
        const compare = dom.nodes.get('integratedCombatCompare'), exit = dom.nodes.get('integratedCombatExit');
        assert.equal(compare.href, './feature-lab.html#motion-force-comparison'); assert.equal(exit.href, './');
        assert.equal(compare.style.minHeight, '44px'); assert.equal(exit.style.minHeight, '44px'); assert.equal(dom.row.style.display, 'none');
        mountIntegratedCombatTrial(configureIntegratedCombatTrial(query)); assert.equal(dom.nodes.get('integratedCombatTrialInfo'), panel);
      });
    test('rejected force entry mounts no experimental navigation', () => {
      const dom = fixture(); Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.document });
      const query = copy(b.query); query.set('motionTiming', 'unknown'); mountIntegratedCombatTrial(inactive(query));
      assert.equal(dom.nodes.has('integratedCombatTrialInfo'), false); assert.equal(dom.row.style.display, '');
    });
  } finally { restore('document', previousDocument); }
  test('entry configuration and UI never read or overwrite saved preferences', () => assert.equal(storageCalls, 0));
  console.log(JSON.stringify({ pass: true, cases: entries.length, entries,
    scope: 'Actual force CTA eleven-key contract and mobile instructions, unchanged old nine/ten-key contracts, malformed tuple rejection and session-only navigation fixture. No physics, browser, trusted touch, actual persistence or maximum force/movement efficacy claim.' }));
} finally { restore('localStorage', previousStorage); }

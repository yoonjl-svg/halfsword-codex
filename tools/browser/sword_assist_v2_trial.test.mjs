// Exact public sword-assistance entry and UI contract; no physics or browser run.
// Usage: node tools/browser/sword_assist_v2_trial.test.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { configureIntegratedCombatTrial, mountIntegratedCombatTrial } from '../../src/integrated_combat_trial.js';

assert.equal(process.argv.length, 2, 'This contract test accepts no CLI arguments');
const html = await readFile(new URL('../../public/feature-lab.html', import.meta.url), 'utf8');
const common = { combatTrial: 'integrated', weapon: 'qinggang', foe: 'heinrich', foeWeapon: 'longsword',
  targetCorrection: 'none', onehandArm: 'manual', bladeShape: 'profile' };
const combined = { thrustPlane: 'transported', finishRule: 'armorCausal' };
const fixed = { ...common, ...combined, motionAssist: 'weak', motionTiming: 'sequenced' };
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
  return { query: url.searchParams, rawHref: tag.match(/\bhref="([^"]+)"/)?.[1],
    text: html.match(new RegExp(`<a\\b[^>]*\\bid="${id}"[^>]*>([^<]+)</a>`))?.[1] };
}
function active(query, expected, compareHref = './feature-lab.html#sword-assist-v2-comparison') {
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
  assert.equal(value.swordAssist, null, 'Rejected sword mode must not survive in the ordinary policy');
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
    storageCalls++; throw new Error('Sword entry configuration/UI must not access saved preferences');
  }])) });

try {
  const a = link('playSwordAssistNone'), b = link('playSwordAssistV2');
  test('actual public existing-body-lead CTA is the exact twelve-key sword A', () => {
    assert.equal([...a.query].length, 12); assert.deepEqual(Object.fromEntries(a.query), { ...fixed, swordAssist: 'none' });
    assert.equal(a.text, '▶ A · 기존 몸 선행');
    active(a.query, { comparison: 'sword', variant: 'A', model: 'sword-none', swordAssist: 'none', motionAssist: 'weak',
      motionTiming: 'sequenced', ...combined, reason: 'exact_sword_tuple' });
  });
  test('actual public pose-guidance/ready-return CTA is the exact twelve-key sword B', () => {
    assert.equal([...b.query].length, 12); assert.deepEqual(Object.fromEntries(b.query), { ...fixed, swordAssist: 'v2' });
    assert.equal(b.text, '▶ B · 자세 안내·복귀');
    active(b.query, { comparison: 'sword', variant: 'B', model: 'sword-v2', swordAssist: 'v2', motionAssist: 'weak',
      motionTiming: 'sequenced', ...combined, reason: 'exact_sword_tuple' });
  });
  test('the new A/B pair differs only in the sword assistance policy', () => {
    const left = copy(a.query), right = copy(b.query); left.delete('swordAssist'); right.delete('swordAssist');
    assert.deepEqual(Object.fromEntries(left), Object.fromEntries(right));
  });
  test('public instructions explain released-idle return and interruption', () => {
    const section = html.match(/<section id="sword-assist-v2-comparison"[^>]*>([\s\S]*?)<\/section>/)?.[1]; assert.ok(section);
    assert.match(section, /좌우·사선/); assert.match(section, /손을 뗀 뒤 기본 자세로 돌아오는 동안 다시 끌어/);
    assert.match(section, /다시 손을 대면 새 입력을 우선/); assert.match(section, /근력·검의 관성/);
    assert.match(section, /복귀가 조작을 방해/);
  });
  const rawCommon = './?combatTrial=integrated&amp;weapon=qinggang&amp;foeWeapon=longsword&amp;foe=heinrich&amp;targetCorrection=none&amp;onehandArm=manual&amp;bladeShape=profile';
  for (const [id, timing, variant, label] of [['playMotionForceBaseline', 'baseline', 'A', '▶ A · 기존 몸 협조'], ['playMotionForceSequenced', 'sequenced', 'B', '▶ B · 몸 선행 협조']])
    test(`existing eleven-key ${id} keeps its exact href and force contract`, () => {
      const old = link(id); assert.equal([...old.query].length, 11); assert.equal(old.query.has('swordAssist'), false);
      assert.equal(old.rawHref, rawCommon + '&amp;thrustPlane=transported&amp;finishRule=armorCausal&amp;motionAssist=weak&amp;motionTiming=' + timing);
      assert.equal(old.text, label);
      active(old.query, { comparison: 'force', variant, model: `force-${timing}`, motionAssist: 'weak', motionTiming: timing,
        swordAssist: null, ...combined, reason: 'exact_force_tuple' }, './feature-lab.html#motion-force-comparison');
    });
  for (const [id, motionAssist, variant] of [['playIntegratedLegacy', 'none', 'A'], ['playIntegratedCombined', 'weak', 'B']])
    test(`existing ten-key ${id} remains a separate motion comparison`, () => {
      const old = link(id), query = old.query; assert.equal([...query].length, 10); assert.equal(query.has('motionTiming'), false);
      assert.equal(old.rawHref, rawCommon + '&amp;thrustPlane=transported&amp;finishRule=armorCausal&amp;motionAssist=' + motionAssist);
      active(query, { comparison: 'motion', variant, model: `motion-${motionAssist}`, motionAssist,
        swordAssist: null, motionTiming: null, ...combined, reason: 'exact_motion_tuple' }, './feature-lab.html#integrated-combat-comparison');
    });
  test('existing nine-key baseline keeps its old contract', () => active(parameters({ ...common, thrustPlane: 'legacy', finishRule: 'legacy' }), {
    comparison: 'compound', variant: 'A', model: 'baseline', swordAssist: null, motionAssist: 'none', motionTiming: null, thrustPlane: 'legacy', finishRule: 'legacy',
    reason: 'exact_compound_tuple' }, './feature-lab.html#integrated-combat-comparison'));
  test('existing nine-key combined keeps its old contract', () => active(parameters({ ...common, ...combined }), {
    comparison: 'compound', variant: 'B', model: 'combined', swordAssist: null, motionAssist: 'none', motionTiming: null, ...combined,
    reason: 'exact_compound_tuple' }, './feature-lab.html#integrated-combat-comparison'));
  test('ordinary query-free entry remains inactive', () => inactive(parameters(), false));

  for (const [name, mutate, requested = true] of [
    ['unknown sword assistance', query => query.set('swordAssist', 'unknown')],
    ['empty sword assistance', query => query.set('swordAssist', '')],
    ['duplicate sword assistance', query => query.append('swordAssist', 'none')],
    ['duplicate identical sword assistance', query => query.append('swordAssist', 'v2')],
    ['v2 with baseline body timing', query => query.set('motionTiming', 'baseline')],
    ['none with baseline body timing', query => { query.set('swordAssist', 'none'); query.set('motionTiming', 'baseline'); }],
    ['missing body timing', query => query.delete('motionTiming')],
    ['sword assistance without weak movement', query => query.set('motionAssist', 'none')],
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
    for (const [query, variant, label] of [[a.query, 'A', '기존 몸 선행'], [b.query, 'B', '자세 안내·복귀']])
      test(`sword ${variant} UI names the comparison and preserves real navigation`, () => {
        const dom = fixture(); Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.document });
        mountIntegratedCombatTrial(configureIntegratedCombatTrial(query));
        const panel = dom.nodes.get('integratedCombatTrialInfo'); assert.ok(panel);
        assert.ok(panel.children[0].textContent.includes(label), 'The label must describe the actual sword assistance comparison');
        const compare = dom.nodes.get('integratedCombatCompare'), exit = dom.nodes.get('integratedCombatExit');
        assert.equal(compare.href, './feature-lab.html#sword-assist-v2-comparison'); assert.equal(exit.href, './');
        assert.equal(compare.style.minHeight, '44px'); assert.equal(exit.style.minHeight, '44px'); assert.equal(dom.row.style.display, 'none');
        mountIntegratedCombatTrial(configureIntegratedCombatTrial(query)); assert.equal(dom.nodes.get('integratedCombatTrialInfo'), panel);
      });
    test('rejected sword entry mounts no experimental navigation', () => {
      const dom = fixture(); Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.document });
      const query = copy(b.query); query.set('swordAssist', 'unknown'); mountIntegratedCombatTrial(inactive(query));
      assert.equal(dom.nodes.has('integratedCombatTrialInfo'), false); assert.equal(dom.row.style.display, '');
    });
  } finally { restore('document', previousDocument); }
  test('entry configuration and UI never read or overwrite saved preferences', () => assert.equal(storageCalls, 0));
  console.log(JSON.stringify({ pass: true, cases: entries.length, entries,
    scope: 'Actual sword CTA twelve-key contract and mobile instructions, byte-identical existing ten/eleven-key hrefs and unchanged nine/ten/eleven-key parser contracts, malformed tuple rejection and session-only navigation fixture. No physics, browser, trusted touch, actual persistence, historical authenticity, optimal strength or maximum force/movement efficacy claim.' }));
} finally { restore('localStorage', previousStorage); }

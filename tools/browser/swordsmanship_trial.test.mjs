// Entry/UI contract only; no simulation or browser execution.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { configureSwordsmanshipTrial, mountSwordsmanshipTrial, SWORDSMANSHIP_WEAPONS } from '../../src/swordsmanship_trial.js';
import { configureIntegratedCombatTrial } from '../../src/integrated_combat_trial.js';
import { WEAPON_LIST, TRIAL_WEAPON_LIST } from '../../src/weapons.js';

assert.equal(process.argv.length, 2, 'No CLI options are supported');
const html = await readFile(new URL('../../public/feature-lab.html', import.meta.url), 'utf8');
const rows = [];
const withheld = ['monohoshizao', 'lightsaber'];
const published = WEAPON_LIST.filter(w => !withheld.includes(w.id));
const test = (name, run) => { run(); rows.push({ name, pass: true }); };
const query = weapon => new URLSearchParams({ swordsmanshipTrial: 'unified', ...(weapon === undefined ? {} : { weapon }) });
function active(params, weapon) {
  const info = configureSwordsmanshipTrial(params);
  assert.equal(info.requested, true); assert.equal(info.active, true); assert.equal(info.model, 'unified');
  assert.equal(info.weapon, weapon); assert.equal(info.reason, 'exact_unified_entry');
  assert.deepEqual(info.settings, { skill: '0.7', difficulty: 'normal' });
  assert.equal(info.foe, 'heinrich'); assert.equal(info.foeWeapon, 'longsword'); assert.equal(info.playerOnly, true);
  assert.equal(info.labHref, './feature-lab.html#swordsmanship-trial'); assert.equal(info.ordinaryHref, './');
  return info;
}
function inactive(params, requested = true) {
  const info = configureSwordsmanshipTrial(params);
  assert.equal(info.requested, requested); assert.equal(info.active, false); assert.equal(info.model, 'legacy');
  assert.equal(info.weapon, null); assert.equal(info.foe, null); assert.equal(info.foeWeapon, null);
  assert.deepEqual(info.settings, {});
  assert.equal(info.reason, requested ? 'unsupported_or_incomplete_entry' : 'not_requested');
  return info;
}
const storageBefore = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let storageCalls = 0;
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: Object.fromEntries(
  ['getItem', 'setItem', 'removeItem', 'clear'].map(name => [name, () => { storageCalls++; throw new Error('Entry must not access saved preferences'); }])) });
const restore = (key, descriptor) => descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key];
try {
  test('one marker selects the default Qinggang trial', () => active(query(), 'qinggang'));
  test('published weapon list excludes the two unresolved high-spin weapons', () => {
    assert.equal(SWORDSMANSHIP_WEAPONS.length, 13);
    assert.deepEqual(SWORDSMANSHIP_WEAPONS.map(w => w.id), published.map(w => w.id));
    assert.ok(Object.isFrozen(SWORDSMANSHIP_WEAPONS) && SWORDSMANSHIP_WEAPONS.every(Object.isFrozen));
  });
  for (const weapon of published) test(`published weapon entry: ${weapon.id}`, () => active(query(weapon.id), weapon.id));
  for (const weapon of withheld) test(`withheld high-spin weapon is rejected: ${weapon}`, () => inactive(query(weapon)));
  for (const weapon of TRIAL_WEAPON_LIST) test(`internal-only weapon is rejected: ${weapon.id}`, () => inactive(query(weapon.id)));
  test('ordinary entry is inactive', () => inactive(new URLSearchParams(), false));
  test('old weapon-only URL does not activate the new trial', () => inactive(new URLSearchParams({ weapon: 'qinggang' }), false));
  for (const [name, mutate] of [
    ['unknown marker', p => p.set('swordsmanshipTrial', 'v2')],
    ['empty marker', p => p.set('swordsmanshipTrial', '')],
    ['duplicate marker', p => p.append('swordsmanshipTrial', 'unified')],
    ['duplicate weapon', p => p.append('weapon', 'qinggang')],
    ['different duplicate weapon', p => p.append('weapon', 'longsword')],
    ['unknown weapon', p => p.set('weapon', 'missing')],
    ['old weapon alias', p => p.set('weapon', 'jian')],
    ['empty weapon', p => p.set('weapon', '')],
    ['manual strength', p => p.set('skill', '0')],
    ['old compound marker', p => p.set('combatTrial', 'integrated')],
    ['old sword policy', p => p.set('swordAssist', 'v2')],
    ['old target policy', p => p.set('targetCorrection', 'none')],
    ['opponent override', p => p.set('foe', 'default')],
    ['opponent weapon override', p => p.set('foeWeapon', 'pistol')],
    ['vertical gain override', p => p.set('mobileVerticalGain', '1.8')],
    ['withdrawn cut override', p => p.set('cutTrial', 'budgeted')],
    ['withdrawn support override', p => p.set('supportModel', 'projected')],
  ]) test(`reject complete marked entry: ${name}`, () => { const p = query('qinggang'); mutate(p); inactive(p); });
  test('old sword comparison contract remains unchanged', () => {
    const p = new URLSearchParams({ combatTrial: 'integrated', weapon: 'qinggang', foe: 'heinrich', foeWeapon: 'longsword',
      targetCorrection: 'none', onehandArm: 'manual', bladeShape: 'profile', thrustPlane: 'transported', finishRule: 'armorCausal',
      motionAssist: 'weak', motionTiming: 'sequenced', swordAssist: 'v2' });
    inactive(p, false);
    const old = configureIntegratedCombatTrial(p); assert.equal(old.active, true); assert.equal(old.model, 'sword-v2');
    p.set('swordsmanshipTrial', 'unified'); inactive(p); assert.equal(configureIntegratedCombatTrial(p).active, false);
  });
  test('product offers one GET form without a strength/version switch', () => {
    const section = html.match(/<section id="swordsmanship-trial"[^>]*>([\s\S]*?)<\/section>/)?.[1]; assert.ok(section);
    assert.match(section, /<form[^>]+action="\.\/"[^>]+method="get"/);
    assert.match(section, /<input type="hidden" name="swordsmanshipTrial" value="unified">/);
    assert.match(section, /<select id="swordsmanshipWeapon" name="weapon">/);
    const options = [...section.matchAll(/<option value="([^"]+)"([^>]*)>/g)];
    assert.deepEqual(options.map(row => row[1]).sort(), published.map(w => w.id).sort());
    assert.deepEqual(options.filter(row => row[2].includes('selected')).map(row => row[1]), ['qinggang']);
    assert.equal((section.match(/<button\b/g) || []).length, 1);
    assert.match(section, /id="playUnifiedSwordsmanship"[^>]*>▶ 통합 시험판 플레이<\/button>/);
    assert.deepEqual([...section.matchAll(/\bname="([^"]+)"/g)].map(row => row[1]).sort(), ['swordsmanshipTrial', 'weapon']);
    assert.ok(html.indexOf('id="swordsmanship-trial"') < html.indexOf('id="previous-comparisons"'));
    assert.ok(html.indexOf('id="previous-comparisons"') < html.indexOf('id="sword-assist-v2-comparison"'));
    assert.match(section, /모노호시자오·라이트세이버는 회전 문제를 더 확인한 뒤 추가합니다/);
    assert.match(section, /리볼버는 기존 사격 조작을 사용합니다/);
  });
  const documentBefore = Object.getOwnPropertyDescriptor(globalThis, 'document');
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
  try {
    test('active menu hides old levels and offers working weapon/ordinary navigation once', () => {
      const dom = fixture(); Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.document });
      const info = active(query('longsword'), 'longsword'); mountSwordsmanshipTrial(info);
      const panel = dom.nodes.get('swordsmanshipTrialInfo'); assert.ok(panel); assert.match(panel.children[0].textContent, /롱소드/);
      assert.equal(dom.nodes.get('swordsmanshipLab').href, './feature-lab.html#swordsmanship-trial');
      assert.equal(dom.nodes.get('swordsmanshipExit').href, './');
      assert.equal(dom.nodes.get('swordsmanshipLab').style.minHeight, '44px'); assert.equal(dom.row.style.display, 'none');
      mountSwordsmanshipTrial(info); assert.equal(dom.nodes.get('swordsmanshipTrialInfo'), panel);
    });
    test('rejected entry does not mount experimental UI or hide ordinary levels', () => {
      const dom = fixture(); Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.document });
      mountSwordsmanshipTrial(inactive(query('morgenstern')));
      assert.equal(dom.nodes.has('swordsmanshipTrialInfo'), false); assert.equal(dom.row.style.display, '');
    });
  } finally { restore('document', documentBefore); }
  test('entry parsing and UI do not read or write saved preference bytes', () => assert.equal(storageCalls, 0));
  console.log(JSON.stringify({ pass: true, cases: rows.length, rows,
    scope: 'Strict two-key session-only entry, thirteen published weapons, exclusion of two unresolved high-spin weapons and internal-only weapon, unchanged legacy parser, actual product GET form and menu fixture. Does not assert main.js sanitization, physical correctness, browser input, persistence, efficacy or historical authenticity.' }));
} finally { restore('localStorage', storageBefore); }

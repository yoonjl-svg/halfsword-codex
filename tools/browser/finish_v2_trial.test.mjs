// Entry/UI contracts only; current-physics integration and real play are checked separately.
// Usage: node --test tools/browser/finish_v2_trial.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {configureFinishV2Trial, mountFinishV2Trial} from '../../src/finish_v2_trial.js';
import {configureSwordsmanshipDefault, SWORDSMANSHIP_DEFAULT_RESEARCH_MARKERS} from '../../src/swordsmanship_default.js';
import {configureCombatDefaults} from '../../src/combat_defaults.js';
import {configureContactTrial} from '../../src/contact_trial.js';
import {configureStanceV2Trial} from '../../src/stance_v2_trial.js';
import {configureGravityV2Trial} from '../../src/gravity_v2_trial.js';
import {configureRecoveryContactV2Trial} from '../../src/recovery_contact_v2_trial.js';
import {configureRecutV2Trial} from '../../src/roll_target_trial.js';

const params = values => new URLSearchParams(values);
const restore = (key, descriptor) => descriptor
  ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key];

test('A/B entries match except for the optional finish rule, with longsword as default', () => {
  for (const weapon of [null, 'longsword', 'rapier']) {
    const variants = [];
    for (const model of ['baseline', 'armor']) {
      const query = params({finishV2: model}); if (weapon) query.set('weapon', weapon);
      const before = query.toString(), value = configureFinishV2Trial(query);
      assert.deepEqual(value, {requested: true, active: true, model,
        finishModel: model === 'armor' ? 'armorGuard' : 'legacy', weapon: weapon || 'longsword',
        foe: 'heinrich', foeWeapon: 'longsword', settings: {skill: '0.7', difficulty: 'normal'},
        playerOnly: true, labHref: './feature-lab.html#finish-v2-comparison', ordinaryHref: './'});
      assert.equal(query.toString(), before, 'The original URL remains intact');
      const {model: selected, finishModel, ...common} = value; variants.push(common);
    }
    assert.deepEqual(...variants);
  }
});

test('Missing, malformed, duplicate, unsupported and mixed queries cannot enable armor finishing', () => {
  const invalid = ['', 'weapon=rapier', 'finishRule=armorCausal', 'finishV2=', 'finishV2=other',
    'finishV2=armorCausal', 'finishV2=armorGuard', 'finishV2=ARMOR', 'finishV2=__proto__',
    'finishV2=armor&finishV2=armor', 'finishV2=baseline&finishV2=armor',
    ...['', 'qinggang', 'zweihander', 'pistol', 'constructor', '__proto__', 'Longsword', 'rapier ']
      .map(weapon => `finishV2=armor&weapon=${encodeURIComponent(weapon)}`),
    'finishV2=armor&weapon=longsword&weapon=longsword', 'finishV2=armor&weapon=longsword&weapon=rapier',
    'finishV2=armor&foe=heinrich', 'finishV2=armor&foeWeapon=longsword', 'finishV2=armor&skill=0.7',
    'finishV2=armor&difficulty=normal', 'finishV2=armor&swordsmanship=legacy',
    'finishV2=armor&unknown=1', 'finishV2=armor&=1',
    ...SWORDSMANSHIP_DEFAULT_RESEARCH_MARKERS.filter(key => key !== 'finishV2')
      .map(key => `finishV2=armor&${key}=1`)];
  for (const raw of invalid) {
    const query = params(raw), before = query.toString(), value = configureFinishV2Trial(query);
    assert.equal(value.requested, query.has('finishV2'), raw);
    assert.equal(value.active, false, raw); assert.equal(value.model, null, raw);
    assert.equal(value.finishModel, 'legacy', raw); assert.equal(value.weapon, null, raw);
    assert.equal(value.foe, null, raw); assert.equal(value.foeWeapon, null, raw);
    assert.deepEqual(value.settings, {}, raw); assert.equal(query.toString(), before, raw);
  }
});

test('Other optional comparisons retain their entry and reject a mixed finish request', () => {
  const entries = [['contactV2=centerline', configureContactTrial], ['stanceV2=fresh', configureStanceV2Trial],
    ['gravityV2=plus25', configureGravityV2Trial], ['recoveryContactV2=combined', configureRecoveryContactV2Trial],
    ['recutV2=bounded', configureRecutV2Trial]];
  for (const [raw, configure] of entries) {
    assert.equal(configure(params(raw)).active, true, raw);
    const mixed = params(`${raw}&finishV2=armor`);
    assert.equal(configure(mixed).active, false, raw);
    assert.equal(configureFinishV2Trial(mixed).active, false, raw);
  }
});

function fixture({anchor = true, skill = true} = {}) {
  const nodes = new Map(), row = {style: {display: ''}}, mounts = [];
  const element = () => ({style: {}, children: [], append(...children) {
    this.children.push(...children);
    for (const child of children) if (child.id) nodes.set(child.id, child);
  }});
  if (anchor) nodes.set('menuSub', {after(panel) {mounts.push(panel); nodes.set(panel.id, panel);}});
  return {nodes, row, mounts, document: {
    getElementById: id => nodes.get(id) ?? null, createElement: element,
    createTextNode: text => ({textContent: text}), querySelector: selector => {
      assert.equal(selector, '[data-setting="skill"]');
      return skill ? {closest: name => {assert.equal(name, '.row'); return row;}} : null;
    },
  }};
}
function withDocument(document, run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {configurable: true, value: document});
  try {run();} finally {restore('document', previous);}
}

test('Both weapons get readable A/B instructions, navigation and one idempotent panel', () => {
  for (const [weapon, label] of [['longsword', '롱소드'], ['rapier', '레이피어']]) {
    for (const [model, title] of [['baseline', '마무리 A · 기존 규칙'], ['armor', '마무리 B · 갑옷 보호']]) {
      const dom = fixture(), info = configureFinishV2Trial(params({finishV2: model, weapon}));
      withDocument(dom.document, () => {
        mountFinishV2Trial(info);
        const panel = dom.nodes.get('finishV2TrialInfo'); assert.ok(panel);
        assert.equal(panel.className, 'sub'); assert.equal(panel.children[0].textContent, `${title} · ${label}`);
        assert.match(panel.children[1].textContent, /넘어진 상대의 갑옷 부위를 톡 눌러 마무리/);
        assert.match(panel.children[1].textContent, /검술 보정 v2와 중력 9\.81은 두 판이 같습니다/);
        assert.match(panel.children[2].textContent, /A는 기존 마무리/);
        assert.match(panel.children[2].textContent, /갑옷이 보호하는 부위에서 상처 문턱을 넘지 못한 마무리의 특례 즉사를 막습니다/);
        assert.match(panel.children[2].textContent, /일반 상처·기절·죽음은 생길 수 있습니다/);
        const lab = dom.nodes.get('finishV2TrialLab'), exit = dom.nodes.get('finishV2TrialExit');
        assert.equal(lab.href, './feature-lab.html#finish-v2-comparison'); assert.equal(exit.href, './');
        for (const link of [lab, exit]) {assert.equal(link.style.minHeight, '44px'); assert.ok(link.textContent);}
        assert.equal(dom.row.style.display, 'none');
        mountFinishV2Trial(info);
        assert.equal(dom.nodes.get('finishV2TrialInfo'), panel); assert.equal(dom.mounts.length, 1);
      });
    }
  }
});

test('Ordinary and rejected entries leave the menu alone; absent DOM anchors are safe', () => {
  for (const raw of ['', 'finishV2=invalid', 'finishV2=armor&unknown=1']) {
    const dom = fixture();
    withDocument(dom.document, () => mountFinishV2Trial(configureFinishV2Trial(params(raw))));
    assert.equal(dom.mounts.length, 0); assert.equal(dom.row.style.display, ''); assert.equal(dom.nodes.size, 1);
  }
  const active = configureFinishV2Trial(params('finishV2=armor'));
  const missingAnchor = fixture({anchor: false});
  withDocument(missingAnchor.document, () => mountFinishV2Trial(active));
  assert.equal(missingAnchor.mounts.length, 0); assert.equal(missingAnchor.row.style.display, '');
  const missingSkill = fixture({skill: false});
  withDocument(missingSkill.document, () => mountFinishV2Trial(active));
  assert.equal(missingSkill.mounts.length, 1);
  withDocument(undefined, () => assert.doesNotThrow(() => mountFinishV2Trial(active)));
});

test('Entry and panel never access saved preferences or change ordinary policy', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let accesses = 0;
  Object.defineProperty(globalThis, 'localStorage', {configurable: true, get() {
    accesses++; throw new Error('Optional finish entries must not access saved preferences');
  }});
  try {
    const ordinary = params(), before = configureSwordsmanshipDefault(ordinary);
    assert.equal(before.active, true); assert.equal(before.model, 'unified');
    const adoptedBefore = configureCombatDefaults(before, {id: 'longsword', edged: true});
    assert.deepEqual(adoptedBefore, {stance: 'fresh', cut: 'centerline', roll: 'bounded'});
    for (const raw of ['', 'finishV2=baseline', 'finishV2=armor&weapon=rapier', 'finishV2=armor&weapon=pistol']) {
      const dom = fixture();
      withDocument(dom.document, () => mountFinishV2Trial(configureFinishV2Trial(params(raw))));
    }
    assert.deepEqual(configureSwordsmanshipDefault(ordinary), before);
    assert.deepEqual(configureCombatDefaults(configureSwordsmanshipDefault(ordinary), {id: 'longsword', edged: true}), adoptedBefore);
    assert.equal(ordinary.toString(), ''); assert.equal(accesses, 0);
  } finally {restore('localStorage', previous);}
});

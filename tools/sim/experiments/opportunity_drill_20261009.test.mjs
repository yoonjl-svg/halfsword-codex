// Practice setup/query/HUD contract, with no native steps or browser claim.
import assert from 'node:assert/strict';
import { configureOpportunityTrial } from '../../../src/opportunity_trial.js';
import { initializeOpportunityDrill, advanceOpportunityDrill, mountOpportunityDrill, updateOpportunityDrill } from '../../../src/opportunity_drill.js';
import { ARENA } from '../../../src/config.js';

const checks = [], check = (name, test) => { test(); checks.push(name); };
const parse = q => configureOpportunityTrial(new URLSearchParams(q));
for (const model of ['distance', 'flow']) for (const weapon of ['rapier', 'estoc']) for (const drill of ['near', 'far']) {
  check(`${model}/${weapon}/${drill} preserves explicit range and tempo`, () => {
    const info = parse({ opportunity: model, weapon, drill });
    assert(info.active); assert.equal(info.opportunity, 'v4');
    assert.equal(info.tempo, model === 'flow' ? 1.2 : 1);
    assert.equal(info.drill, drill); assert.equal(info.drillGap, drill === 'near' ? 1.25 : 2.15);
  });
}
check('ordinary and non-drill comparisons never initialize practice', () => {
  for (const q of ['', 'weapon=rapier', 'opportunity=distance&weapon=rapier', 'opportunity=flow&weapon=estoc',
    'opportunity=baseline', 'opportunity=assisted', 'opportunity=precision', 'opportunity=head-region']) {
    const info = parse(q);
    assert.equal(info.drill, null); assert.equal(info.drillGap, null);
    const untouched = new Proxy({}, {get(){ throw Error('Should not touch opponent'); }});
    assert.equal(initializeOpportunityDrill(info, untouched), false);
    assert.equal(advanceOpportunityDrill(info, untouched, 1/120), false);
  }
});
check('duplicate, foreign and unknown drill parameters deactivate the whole comparison', () => {
  for (const q of [
    'opportunity=flow&weapon=rapier&drill=near&drill=near',
    'opportunity=flow&opportunity=distance&weapon=rapier&drill=near',
    'opportunity=flow&weapon=rapier&weapon=estoc&drill=near',
    'opportunity=flow&weapon=rapier&drill=near&x=1',
    'opportunity=flow&weapon=rapier&drill=', 'opportunity=flow&weapon=rapier&drill=middle',
    'opportunity=head-region&weapon=rapier&drill=near', 'opportunity=baseline&weapon=estoc&drill=far',
    'opportunity=flow&weapon=longsword&drill=near', 'opportunity=distance&weapon=branch&drill=near',
    'opportunity=flow&weapon=unknown&drill=near', 'weapon=rapier&drill=near',
  ]) {
    const info = parse(q); assert(!info.active, q); assert.equal(info.drill, null);
    assert.equal(info.drillGap, null); assert.equal(info.tempo, 1); assert.equal(info.opportunity, 'off');
  }
});
const info = parse({ opportunity: 'flow', weapon: 'rapier', drill: 'near' });
check('practice waits two seconds, keeps its weapon and uses only controller requests plus one ordinary fall', () => {
  const calls = [], command = name => ({ set(...values) { calls.push([name, ...values]); } });
  const enemy = { limbs: { legF: 1, legB: 1, armS: .8, armO: 1 }, blood: .8, pain: .3,
    move: command('move'), handOffset: command('hand'), armed: true,
    knockDown(heavy) { calls.push(['knockDown', heavy, this.limbs.legF, this.limbs.legB]); },
    dropSword() { throw Error('Practice must keep the ordinary armed guard'); },
    bodies: new Proxy({}, { get(){ throw Error('No physical body injection'); } }) };
  assert(initializeOpportunityDrill(info, enemy));
  assert.deepEqual(enemy.opportunityDrillState, { elapsed: 0, prepared: false });
  assert.deepEqual(enemy.limbs, { legF: 1, legB: 1, armS: .8, armO: 1 });
  for(let tick=0;tick<240;tick++) assert(advanceOpportunityDrill(info, enemy, 1/120));
  assert.equal(enemy.opportunityDrillState.prepared, false);
  assert.deepEqual(enemy.limbs, { legF: 1, legB: 1, armS: .8, armO: 1 });
  const before = { ...enemy.opportunityDrillState };
  initializeOpportunityDrill(info, enemy); assert.deepEqual(enemy.opportunityDrillState, before);
  assert(advanceOpportunityDrill(info, enemy, 1/120));
  assert.deepEqual(enemy.limbs, { legF: .2, legB: .2, armS: .8, armO: 1 });
  for(let tick=0;tick<240;tick++) assert(advanceOpportunityDrill(info, enemy, 1/120));
  assert.deepEqual(calls.filter(c => c[0] === 'knockDown'), [['knockDown', false, .2, .2]]);
  assert(calls.some(c => JSON.stringify(c) === JSON.stringify(['hand', .02, .4])));
  assert.equal(enemy.armed, true); assert.equal(enemy.inputActive, false); assert.equal(enemy.handHeld, true);
  assert.equal(enemy.blood, .8); assert.equal(enemy.pain, .3);
  const elapsed = enemy.opportunityDrillState.elapsed;
  for(const dt of [0, -1, NaN, Infinity]) assert.equal(advanceOpportunityDrill(info, enemy, dt), false);
  assert.equal(enemy.opportunityDrillState.elapsed, elapsed);
});

const elements = new Map();
class Element {
  constructor(tag) { this.tagName = tag; this.style = {}; this.hidden = false; this.children = []; this.events = {}; this.textWrites = 0; }
  set id(v) { this._id = v; elements.set(v, this); } get id() { return this._id; }
  set textContent(v) { this._text = v; this.textWrites++; } get textContent() { return this._text; }
  append(...children) { this.children.push(...children); }
  addEventListener(type, fn) { this.events[type] = fn; }
}
globalThis.document = { createElement: tag => new Element(tag), getElementById: id => elements.get(id) ?? null, body: new Element('body') };
let restarts = 0, finishRestart;
const panel = mountOpportunityDrill(info, () => { restarts++; return new Promise(resolve => { finishRestart = resolve; }); });
const status = elements.get('opportunityDrillStatus');
const player = extra => Object.freeze({ alive: true, armed: true, state: 'stand', fightT: Math.max(6, ARENA.startHold) + 1, skill: Object.freeze({}), ...extra });
const enemy = Object.freeze({ alive: true, state: 'kneel' });
check('labelled HUD mounts once, starts hidden and does not autoplay', () => {
  assert(panel.hidden); assert.equal(restarts, 0);
  assert.equal(mountOpportunityDrill(info, () => { throw Error('duplicate handler'); }), panel);
  assert.equal(document.body.children.length, 1);
  assert.equal(panel.children[0].textContent, '반격 없는 무릎 연습 상대');
});
check('HUD is hidden outside fight and unchanged states cause no text writes', () => {
  for (const state of ['menu', 'paused', 'draw']) { updateOpportunityDrill(info, player(), enemy, state); assert(panel.hidden); }
  const p = player(); updateOpportunityDrill(info, p, enemy, 'fight'); assert(!panel.hidden);
  assert(status.textContent.startsWith('스틱을 놓고 톡'));
  const writes = status.textWrites; updateOpportunityDrill(info, p, enemy, 'fight'); assert.equal(status.textWrites, writes);
});
check('HUD describes readiness, real preparation, actual attack and cancellation read-only', () => {
  const rows = [
    [player({ fightT: 0 }), enemy, '연습 준비'],
    [player({ fightT: 5 }), enemy, '연습 준비'],
    [player(), Object.freeze({ alive: true, state: 'getup' }), '연습 준비'],
    [player({ skill: Object.freeze({ thrustRange: Object.freeze({ phase: 'position', measure: Object.freeze({ move: -.5 }) }) }) }), enemy, '물러서며'],
    [player({ skill: Object.freeze({ thrustRange: Object.freeze({ phase: 'position', measure: Object.freeze({ move: .5 }) }) }) }), enemy, '다가서며'],
    [player({ skill: Object.freeze({ thrustRange: Object.freeze({ phase: 'align' }) }) }), enemy, '칼끝을'],
    [player({ skill: Object.freeze({ tap: Object.freeze({ down: false }) }) }), enemy, '찌르는 중'],
    [player({ skill: Object.freeze({ lastThrustRange: Object.freeze({ reason: 'manual-input' }) }) }), enemy, '수동 입력'],
    [player({ skill: Object.freeze({ lastThrustRange: Object.freeze({ reason: 'preparation-limit' }) }) }), enemy, '준비 중단'],
    [player({ skill: Object.freeze({ lastThrustRange: Object.freeze({ reason: 'committed' }) }) }), enemy, '공격 끝'],
    [player(), Object.freeze({ alive: false, state: 'dead' }), '상대가 쓰러졌습니다'],
  ];
  for (const [p, e, prefix] of rows) { updateOpportunityDrill(info, p, e, 'fight'); assert(status.textContent.startsWith(prefix), status.textContent); }
});
{
  assert.equal(restarts, 0); let stopped = false;
  const repeat = elements.get('opportunityDrillRepeat');
  const pending = repeat.events.click({ stopPropagation() { stopped = true; } });
  assert(stopped); assert.equal(restarts, 1);
  assert(repeat.disabled);
  await repeat.events.click({ stopPropagation() {} });
  assert.equal(restarts, 1);
  finishRestart(); await pending; assert(!repeat.disabled);
  checks.push('repeat requires an explicit click and blocks overlapping asynchronous round resets');
}
delete globalThis.document;
console.log(JSON.stringify({ pass: true, nativeSteps: 0, checks }));

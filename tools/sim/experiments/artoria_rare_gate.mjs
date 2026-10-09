// Approved rare weapons and Artoria: native input/contact/content gate, not balance tuning.
// node tools/sim/experiments/artoria_rare_gate.mjs /tmp/fresh-native.json
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { newRound, DT, THREE } from '../harness_m.mjs';
import { getWeapon, WEAPON_LIST, drawWeaponCards, TIER_DRAW } from '../../../src/weapons.js';
import { weaponPhysics } from '../../../src/weapon_class.js';
import { attachAura } from '../../../src/aura.js';
import { applySwordsmanship, recordSwordsmanshipInput } from '../../../src/swordsmanship.js';
import { configureSwordsmanshipDefault, swordsmanshipDefaultSupportsWeapon } from '../../../src/swordsmanship_default.js';
import { configureCombatDefaults } from '../../../src/combat_defaults.js';
import { schoolOf } from '../../../src/schools.js';
import { CHARACTERS_BY_ID } from '../../../src/characters.js';
import { getLook, CHARACTER_LOOK_VERSION } from '../../../src/looks.js';
import { strikeArmSupportScale } from '../../../src/arm_support.js';

const out = process.argv[2];
assert(out && path.isAbsolute(out) && !fs.existsSync(out), 'Fresh absolute output required');
fs.mkdirSync(path.dirname(out), { recursive: true });
const hash = x => createHash('sha256').update(x).digest('hex');
const sources = [...fs.readdirSync('src').filter(p => p.endsWith('.js')).map(p => `src/${p}`),
  'tools/sim/harness_m.mjs', 'tools/sim/experiments/artoria_rare_gate.mjs',
  'docs/content/sain_ice_plan_calculation_20261010.json'];
const hashes = () => Object.fromEntries(sources.map(p => [p, hash(fs.readFileSync(p))]));
const started = performance.now(), ordinary = configureSwordsmanshipDefault(new URLSearchParams());
const result = { createdUTC: new Date().toISOString(), head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceBefore: hashes(), dt: DT, physicsSteps: 0, assertions: [], rows: [],
  limits: ['Actual Rapier/Fighter/Combat with scripted native input, not browser touch or win-rate/naturalness validation.',
    'The offhand injury, knockDown and Artoria appearance wound use declared synthetic APIs, not natural acquired wounds.',
    'The separate contact fixture sets initial whole-attacker position/orientation/velocity, then uses real Rapier contact and Combat.',
    'Recovery stand transitions and accepted input do not prove humanlike recovery or foot-load transfer.',
    'Reported maxima are observations, not gameplay caps or acceptance of large spin.'] };
const check = (name, ok, details) => { result.assertions.push({ name, ok: !!ok, ...(details ? { details } : {}) }); };
const near = (a, b, tolerance = 1e-6) => Math.abs(a - b) < tolerance;
class Passive { update() {} }
const point = (body, p) => new THREE.Vector3().copy(p).applyQuaternion(new THREE.Quaternion().copy(body.rotation())).add(new THREE.Vector3().copy(body.translation()));
const gap = j => point(j.body1(), j.anchor1()).distanceTo(point(j.body2(), j.anchor2()));
function dispose(g) { g.player.clearLoose(); g.enemy.clearLoose(); g.eventQueue.free(); g.world.free(); }
function round(id, extra = {}) {
  const g = newRound({ seed: 17, weapon: id, weapon2: 'qinggang', gap: 12, walls: false, AIClass: Passive, ...extra,
    onFighter: f => {
      f.armSupportModel = 'linked'; f.armTorqueModel = 'legacy'; f.finishEntryModel = 'low'; f.onehandArmModel = 'legacy';
      if (f.index === 0) { const d = configureCombatDefaults(ordinary, f.weapon); f.onehandArmModel = 'manual'; f.stanceMemoryModel = d.stance; f.rollTargetModel = d.roll; }
    } });
  const f = g.player; f.skill.autoGuard = true;
  assert(applySwordsmanship(f), `v2 install: ${id}`);
  const d = configureCombatDefaults(ordinary, f.weapon); g.combat.cutReactionModel = d.cut; g.combat.cutReactionFighter = f;
  return g;
}
function observer(g, row) {
  row.steps = 0; row.maxTipSpeedMps = 0; row.maxOmegaRadps = 0; row.maxJointGapM = 0; row.maxGripGapM = 0;
  row.nonFinite = false; row.invalidJoints = false; row.unexplainedDisarm = false; row.states = {};
  return () => {
    result.physicsSteps++; row.steps++; const f = g.player;
    for (const body of g.world.bodies.getAll()) for (const v of [body.translation(), body.rotation(), body.linvel(), body.angvel()])
      row.nonFinite ||= !Object.values(v).every(Number.isFinite);
    for (const fighter of [f, g.enemy]) {
      for (const j of fighter.joints) { row.invalidJoints ||= !j.joint?.isValid(); if (j.joint?.isValid()) row.maxJointGapM = Math.max(row.maxJointGapM, gap(j.joint)); }
      row.unexplainedDisarm ||= fighter.armed && !fighter.gripJoint?.isValid();
      if (fighter.armed && fighter.gripJoint?.isValid()) row.maxGripGapM = Math.max(row.maxGripGapM, gap(fighter.gripJoint));
    }
    const v = f.sword.velocityAtPoint(f.bladePoint(1, new THREE.Vector3())), w = f.sword.angvel();
    row.maxTipSpeedMps = Math.max(row.maxTipSpeedMps, Math.hypot(v.x, v.y, v.z));
    row.maxOmegaRadps = Math.max(row.maxOmegaRadps, Math.hypot(w.x, w.y, w.z));
    row.states[f.state] = (row.states[f.state] || 0) + 1;
  };
}
function closeRow(g, row) {
  const f = g.player;
  Object.assign(row, { alive: f.alive, armed: f.armed, broken: f.weaponBroken, endState: f.state,
    limbs: { ...f.limbs }, clashes: g.clashes, wounds: g.wounds.map(w => ({ t: w.t, attacker: w.att.index, victim: w.vic.index, zone: w.zone, type: w.type, energy: w.energy })) });
  check(`${row.id}/${row.scenario}/finite-connected`, !row.nonFinite && !row.invalidJoints && !row.unexplainedDisarm);
  result.rows.push(row);
}
const tape = [ ['raise', 60, -.24, .35, true], ['cut', 30, .48, -.68, true], ['release', 90, 0, 0, false],
  ['recut', 36, -.46, .62, true], ['release2', 90, 0, 0, false], ['tap', 180, 0, 0, true], ['release3', 114, 0, 0, false] ]
  .flatMap(([phase, n, dx, dy, held]) => Array.from({ length: n }, (_, k) => ({ phase, dx: dx / n, dy: dy / n, held, tap: phase === 'tap' && k === 0 })));
function input(f, command, tick, timeS) {
  f.handOffset.x += command.dx; f.handOffset.y += command.dy; f.handHeld = command.held;
  const active = Math.abs(command.dx) + Math.abs(command.dy) > 1e-8; f.inputActive = active;
  const request = { id: tick, timeS, dx: command.dx, dy: command.dy, held: command.held, active };
  assert(recordSwordsmanshipInput(f, request), 'Input request rejected'); return request;
}
function runTape(g, row, observe) {
  const f = g.player, inputHash = createHash('sha256'); row.phases = {}; row.tapAccepted = false; row.inputConsumed = true;
  for (let i = 0; i < tape.length; i++) {
    const c = tape[i], request = input(f, c, i, g.t); inputHash.update(JSON.stringify(request) + '\n');
    if (c.tap) row.tapAccepted = f.skill.thrust({ step: false });
    g.step(); observe(); row.inputConsumed &&= JSON.stringify(f.swordsmanshipState.input) === JSON.stringify(request);
    row.phases[c.phase] = (row.phases[c.phase] || 0) + 1;
  }
  row.inputSHA256 = inputHash.digest('hex');
  check(`${row.id}/${row.scenario}/input-and-thrust`, row.inputConsumed && row.tapAccepted);
}
try {
  const plan = JSON.parse(fs.readFileSync('docs/content/sain_ice_plan_calculation_20261010.json'));
  let seed = 321; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const pool = WEAPON_LIST.map(w => w.id).filter(id => id !== 'excalibur_replica'), counts = {};
  for (let k = 0; k < 20000; k++) { const [id] = drawWeaponCards(pool, 1, { rnd }); counts[id] = (counts[id] || 0) + 1; }
  const rareCount = Object.entries(counts).filter(([id]) => getWeapon(id).tier === 'rare').reduce((a, [, n]) => a + n, 0);
  result.draw = { samples: 20000, counts, rareFraction: rareCount / 20000 };
  check('ordinary-pool-natural-rare-draw', counts.sain > 0 && counts.ice > 0 && Math.abs(rareCount / 20000 - TIER_DRAW.rare / 100) < .015, result.draw);
  for (const expected of plan.values) {
    const { id } = expected, spec = getWeapon(id), phys = weaponPhysics(spec), recipe = plan.recipes.find(r => r.id === id);
    const parts = spec.buildParts({}), lo = Math.min(...parts.map(([s, y]) => y - (s[0] === 'box' ? s[2] : s[1]))), hi = Math.max(...parts.map(([s, y]) => y + (s[0] === 'box' ? s[2] : s[1])));
    check(`${id}/approved-spec`, near((hi - lo) * 100, expected.fullCm) && near(phys.mass, expected.massKg) && near(phys.com * 100, expected.comFromHandCm)
      && near(phys.I, expected.inertiaKgM2) && spec.frame === expected.frame && spec.style === expected.style && spec.grip === recipe.grip
      && near(spec.controlOverrides.maxAimTorque, expected.torqueNm) && expected.coefficients.every((x, i) => near(x, [spec.mCut, spec.mThrust, spec.mBlunt][i]))
      && near(spec.power, plan.rare.power) && near(spec.durability, plan.rare.durability) && near(spec.fragility, plan.rare.fragility), { phys, fullCm: (hi - lo) * 100 });
    check(`${id}/ordinary-school`, swordsmanshipDefaultSupportsWeapon(spec, ordinary) && schoolOf(id).weapon === id && schoolOf(id).tech.length > 0);
    const g = round(id), f = g.player, row = { id, scenario: 'v2-cut-release-recut-thrust' }, observe = observer(g, row);
    try {
      check(`${id}/native-mass-frame`, near(f.sword.mass(), expected.massKg) && near(f.swordIhand, phys.I) && f.swordsmanshipState.profile.frame === expected.frame);
      check(`${id}/no-aura-or-legend-bonus`, attachAura(f) === null && !f.swordGroup.getObjectByName('legendaryAura') && !spec.ignoreArmor && !spec.ability && spec.fragility > 0);
      for (let i = 0; i < 240; i++) { g.step(); observe(); }
      runTape(g, row, observe); check(`${id}/free-input-armed`, f.alive && f.armed && !f.weaponBroken); closeRow(g, row);
    } finally { dispose(g); }

    // Position a whole attacker consistently, then permit real native contacts.
    const contact = round(id, { gap: 2.4, sameLook: true }), a = contact.player, v = contact.enemy;
    const cr = { id, scenario: 'controlled-native-contact', prescribedEdgeSpeedMps: 12, artificialInitialPlacement: true }, observeContact = observer(contact, cr);
    try {
      contact.step(); observeContact();
      const target = new THREE.Vector3().copy(v.bodies.farmO.translation());
      const desired = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
      const rotation = desired.clone().multiply(new THREE.Quaternion().copy(a.sword.rotation()).invert()), origin = new THREE.Vector3().copy(a.sword.translation());
      for (const b of [...a.meshes.map(m => m.rb), a.anchor]) {
        b.setTranslation(new THREE.Vector3().copy(b.translation()).sub(origin).applyQuaternion(rotation).add(origin), true);
        b.setRotation(rotation.clone().multiply(new THREE.Quaternion().copy(b.rotation())), true);
      }
      const edge = new THREE.Vector3(1, 0, 0).applyQuaternion(desired), shift = target.sub(a.bladePoint(.35)).addScaledVector(edge, -.22);
      for (const b of [...a.meshes.map(m => m.rb), a.anchor]) {
        b.setTranslation(new THREE.Vector3().copy(b.translation()).add(shift), true);
        if (b !== a.anchor) { b.setLinvel(edge.clone().multiplyScalar(12), true); b.setAngvel({ x: 0, y: 0, z: 0 }, true); }
      }
      for (let i = 0; i < 24; i++) { a.cacheState(); v.cacheState(); contact.world.step(contact.eventQueue, contact.combat.physicsHooks); contact.combat.afterStep(contact.world, contact.eventQueue); contact.t += DT; observeContact(); }
      check(`${id}/actual-contact`, contact.wounds.some(w => w.att === a), { wounds: contact.wounds.length, clashes: contact.clashes }); closeRow(contact, cr);
    } finally { dispose(contact); }
  }

  const g = round('ice'), f = g.player, row = { id: 'ice', scenario: 'synthetic-offhand-injury-knockdown-recovery-input' }, observe = observer(g, row);
  try {
    for (let i = 0; i < 300; i++) { g.step(); observe(); }
    const wound = { part: 'farmO', zone: 'arm', type: 'cut', severity: 1.02, energy: 18, bleedPerSev: .005,
      local: new THREE.Vector3(), dir: new THREE.Vector3(1, 0, 0), pass: true, passing: false, stuck: false };
    f.applyWound(wound); f.knockDown(true); row.injected = { source: 'synthetic applyWound + knockDown(true)', severity: wound.severity, armO: f.limbs.armO };
    let gotGetup = false, recovered = false;
    for (let i = 0; i < 1440; i++) { g.step(); observe(); gotGetup ||= f.state === 'getup'; if (gotGetup && f.state === 'stand') { recovered = true; row.recoveredAtS = g.t; break; } }
    row.sawGetup = gotGetup; row.recoveredStand = recovered; row.supportScale = strikeArmSupportScale(f);
    check('ice/injured-offhand-released', f.limbs.armO <= .3 && !f.gripping && row.supportScale === .5 && f.armed);
    check('ice/getup-followup-observed', gotGetup && recovered, { state: f.state, states: row.states });
    runTape(g, row, observe); closeRow(g, row);
  } finally { dispose(g); }

  const character = CHARACTERS_BY_ID.artoria, look = getLook('artoria');
  check('artoria/character-registered', !!character && character.weapon === 'excalibur' && character.look === look && !!look && character.lookVersion === CHARACTER_LOOK_VERSION.artoria);
  assert(look, 'Artoria appearance must be frozen before this gate runs');
  const ag = round('sain', { weapon2: character.weapon, look2: look, gap: 12, persona: character.ai.persona, difficulty: character.ai.level });
  const ar = { id: 'artoria', scenario: 'synthetic-wound-appearance-retention', lookVersion: character.lookVersion }, observeArtoria = observer(ag, ar);
  let aura;
  try {
    const enemy = ag.enemy; aura = attachAura(enemy); const head = enemy.groups.head, originalChildren = [...head.children];
    const beforeNames = [], outfitNodes = [];
    for (const group of Object.values(enemy.groups)) group.traverse(n => {
      if (/artoria/i.test(n.name)) beforeNames.push({ name: n.name, uuid: n.uuid });
      if (n.userData.outfit === look.outfit) outfitNodes.push({ node: n, parent: n.parent, part: n.userData.outfitPart });
    });
    check('artoria/native-outfit-parts', look.outfit === character.look.outfit && outfitNodes.some(n => n.part === 'head') && outfitNodes.some(n => n.part === 'chest')
      && Object.keys(enemy.groups).every(part => outfitNodes.some(n => n.part === part)), { parts: outfitNodes.map(n => n.part) });
    check('artoria/real-excalibur-aura', enemy.weapon.id === 'excalibur' && !!aura && enemy.swordGroup.getObjectByName('legendaryAura')?.userData.legendaryAura.tone === 'gold');
    enemy.applyWound({ part: 'chest', zone: 'chest', type: 'cut', severity: .2, energy: 5, bleedPerSev: .005,
      local: new THREE.Vector3(.1, 0, 0), dir: new THREE.Vector3(1, 0, 0), pass: true, passing: false, plate: false });
    for (let i = 0; i < 300; i++) { ag.step(); enemy.syncMeshes(); aura.update(ag.t); observeArtoria(); }
    ar.namedAppearanceNodes = beforeNames; ar.outfitParts = outfitNodes.map(n => n.part); ar.syntheticWounds = enemy.wounds.length;
    check('artoria/appearance-retained-after-synthetic-wound', enemy.wounds.length > 0 && originalChildren.length > 0 && originalChildren.every(n => n.parent === head)
      && outfitNodes.length > 0 && outfitNodes.every(({ node, parent }) => node.parent === parent && node.userData.outfit === look.outfit)
      && beforeNames.every(({ uuid }) => Object.values(enemy.groups).some(group => !!group.getObjectByProperty('uuid', uuid))));
    // Synthetic destruction through the production armor-wear path. Cloth and
    // hair must survive the metal list being removed, not merely a flesh wound.
    const chest = enemy.groups.chest, cloth = chest.getObjectByName('artoria-cloth'), cape = chest.getObjectByName('artoria-cape');
    const chestHair = chest.getObjectByName('artoria-hair'), chestArmor = enemy.plateGroups.chest;
    const plateMeshes = enemy.plateBoxes.chest.list.map(b => b.mesh), protectedNodes = new Set();
    for (const root of [head, cloth, chestHair]) root?.traverse(node => protectedNodes.add(node));
    const retained = [...protectedNodes].map(node => ({ node, parent: node.parent, visible: node.visible }));
    const resources = new Set(); let protectedDisposals = 0;
    for (const { node } of retained) {
      if (node.geometry) resources.add(node.geometry);
      if (node.material) for (const material of [].concat(node.material)) resources.add(material);
    }
    for (const resource of resources) resource.addEventListener('dispose', () => protectedDisposals++);
    const armorBefore = enemy.plate.chest;
    enemy.wearPlate('chest', 10000, new THREE.Vector3(1, 0, 0), 'chest');
    for (let i = 0; i < 60; i++) { ag.step(); enemy.syncMeshes(); aura.update(ag.t); observeArtoria(); }
    ar.syntheticArmorDestruction = { source: "wearPlate('chest',10000,dir,'chest')", armorBefore, armorAfter: enemy.plate.chest,
      removedPlateMeshes: plateMeshes.length, protectedNodes: retained.length, protectedDisposals, followupSteps: 60,
      clothVisible: cloth?.visible, capeVisible: cape?.visible, headVisible: head.visible };
    check('artoria/synthetic-chest-armor-only-destroyed', armorBefore > 0 && enemy.plate.chest === 0 && plateMeshes.length > 0
      && enemy.plateBoxes.chest.list.length === 0 && chestArmor.userData.armor.length === 0
      && plateMeshes.every(mesh => !chest.getObjectByProperty('uuid', mesh.uuid))
      && cloth?.visible && cape?.visible && head.visible && protectedDisposals === 0
      && retained.every(({ node, parent, visible }) => node.parent === parent && node.visible === visible), ar.syntheticArmorDestruction);
    closeRow(ag, ar);
  } finally { aura?.dispose(); dispose(ag); }
  const original = getWeapon('excalibur'), replica = getWeapon('excalibur_replica');
  check('excalibur-replica-distinct-and-preserved', original !== replica && original.id === 'excalibur' && replica.id === 'excalibur_replica'
    && original.tier === 'legend' && replica.tier === 'common' && original.fragility === 0 && replica.fragility > 0 && original.power === 1.2 && replica.power === 1
    && original.buildParts === replica.buildParts && original.partMesh === replica.partMesh && original.decorate === replica.decorate
    && CHARACTERS_BY_ID.heinrich.weapon === 'excalibur_replica' && near(original.bladeLength, 1) && near(replica.bladeLength, 1));
  const rg = round('excalibur_replica'); try { check('replica/no-aura', attachAura(rg.player) === null && !rg.player.swordGroup.getObjectByName('legendaryAura')); } finally { dispose(rg); }
} catch (error) { result.exception = { message: error.message, stack: error.stack }; }
finally {
  result.sourceAfter = hashes(); result.sourceStable = JSON.stringify(result.sourceBefore) === JSON.stringify(result.sourceAfter);
  result.failed = result.assertions.filter(a => !a.ok).map(a => a.name);
  result.pass = !result.exception && result.sourceStable && result.failed.length === 0;
  result.wallSeconds = (performance.now() - started) / 1000; result.completedUTC = new Date().toISOString();
  fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' }); process.exitCode = result.pass ? 0 : 1;
  console.log(JSON.stringify({ out, pass: result.pass, assertions: result.assertions.length, failed: result.failed, exception: result.exception?.message,
    sourceStable: result.sourceStable, rows: result.rows.length, physicsSteps: result.physicsSteps, wallSeconds: result.wallSeconds }));
}

// Native observation of the three approved optional opponents, not a win-rate test.
// node tools/sim/content_expansion_20261009.mjs --out=/tmp/halfsword-content-RUN
// Optional: --ids=tome,omari,yeongman --seeds=307,911 --seconds=25 --constructors-only
// Uses a frozen copy of the actual game. No synthetic wounds, forced strikes,
// body placement/velocity changes, healing, or gameplay source modifications.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const own = 'tools/sim/content_expansion_20261009.mjs';
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('node tools/sim/content_expansion_20261009.mjs --out=NEW_EXTERNAL_DIRECTORY [--ids=tome,omari,yeongman] [--seeds=307,911] [--seconds=25] [--constructors-only]');
  process.exit(0);
}
assert(args.every(a => /^--(?:out|ids|seeds|seconds)=/.test(a) || a === '--constructors-only'), 'Unknown argument');
assert.equal(new Set(args.map(a => a.split('=')[0])).size, args.length, 'Duplicate argument');
const option = (key, fallback) => args.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const out = option('out', '');
assert(path.isAbsolute(out) && path.resolve(out) === out && !fs.existsSync(out), 'Use a new absolute output directory');
assert((out.startsWith('/tmp/') || out.startsWith('/workspace/halfsword-handoff/')) && !out.startsWith(root), 'Output must be outside the game checkout');
const expected = { tome: { weapon: 'rapier', twoHand: false, age: 64 }, omari: { weapon: 'falchion', twoHand: false, age: 51 }, yeongman: { weapon: 'monohoshizao', twoHand: true, age: 19 } };
const ids = option('ids', Object.keys(expected).join(',')).split(',');
const seeds = option('seeds', '307,911').split(',').map(Number);
const seconds = Number(option('seconds', '25'));
const constructorsOnly = args.includes('--constructors-only');
assert(ids.length && new Set(ids).size === ids.length && ids.every(id => expected[id]), 'Unknown or duplicate character ID');
assert(seeds.length && new Set(seeds).size === seeds.length && seeds.every(n => Number.isInteger(n) && n > 0 && n <= 0xffffffff), 'Invalid seeds');
assert(Number.isFinite(seconds) && seconds >= 20 && seconds <= 30, 'Observe 20–30 seconds per natural duel');

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const scan = relative => fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? scan(`${relative}/${e.name}`) : e.name.endsWith('.js') ? [`${relative}/${e.name}`] : []);
const names = [...scan('src'), own, 'tools/sim/harness_m.mjs', 'package.json', 'package-lock.json'].sort();
const sourceHashes = directory => Object.fromEntries(names.map(n => [n, fs.existsSync(path.join(directory, n)) ? hash(fs.readFileSync(path.join(directory, n))) : null]));
const head = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const sourceBefore = sourceHashes(root), headBefore = head();
fs.mkdirSync(out, { recursive: true });
const frozen = path.join(out, 'source');
const sourceFrozen = {};
for (const n of names) {
  const bytes = fs.readFileSync(path.join(root, n)), target = path.join(frozen, n);
  sourceFrozen[n] = hash(bytes);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes, { flag: 'wx' });
}
fs.symlinkSync(path.join(root, 'node_modules'), path.join(frozen, 'node_modules'), 'dir');
assert.deepEqual(sourceHashes(frozen), sourceFrozen, 'Frozen files must match recorded bytes');
const write = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const load = relative => import(pathToFileURL(path.join(frozen, relative)).href);
const engineNames = ['node_modules/@dimforge/rapier3d-compat/rapier.mjs', 'node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const engineHashes = () => Object.fromEntries(engineNames.filter(n => fs.existsSync(path.join(root, n))).map(n => [n, hash(fs.readFileSync(path.join(root, n)))]));
const engineBefore = engineHashes();
const protocol = {
  startedUTC: new Date().toISOString(), headBefore, argv: process.argv, command: ['node', own, ...args],
  sourceBefore, sourceFrozen, sourceManifestSHA256: hash(JSON.stringify(sourceFrozen)), frozen, engineBefore,
  ids, seeds, seconds, constructorsOnly,
  fixture: 'Native harness_m.newRound/step, ordinary 5.6m spawn and circular walls. New character in enemy index1, normal longsword AI driving player index0. No synthetic injury, teleport, scripted strike, healing, or forced contact.',
  policy: 'main.js ordinary creation: both legacy arm torque, linked offhand support, low finish entry, Fighter getupLeadDelay default, severing ON. Player only manual arm, current swordsmanship v2, fresh stance, bounded recut and centerline cut resistance; power finish applies to both. Enemy keeps its ordinary AI controller.',
  observations: 'AI startStrike accepted is an attack command, Combat.strike is a collision-processing call, onWound is an accepted combat callback, applyWound before/after is actual state change. These are counted separately. Combat energies are game-model outputs.',
  limitations: [
    'Two predetermined seeds are encounter observations, not win rates, balance certification, historical technique validation, or human playability evidence.',
    'AI input substitutes for a human on the player slot; it does not establish mobile input equivalence.',
    'Constructor recreation checks the same native configuration, not browser restart buttons, rendering, camera visibility, audio, stage geometry, or GPU disposal.',
    'Appearance comparison measures initial native body mass/inertia/geometry. Different armor metadata can change damage protection even when native body mass matches.',
    'No observed wound/contact is not manufactured into a success. Missing engagement or intended attack type is reported explicitly.',
  ],
};
write('protocol.json', protocol);
process.on('uncaughtException', error => {
  // Preserve setup/constructor failures as evidence too; do not turn them into
  // zero-fixture success or discard the already-frozen source manifest.
  write('fatal.json', { failedUTC: new Date().toISOString(), error: error.stack, sourceManifestSHA256: protocol.sourceManifestSHA256, status: 'failed-before-complete-summary' });
  console.error(error.stack);
  process.exit(1);
});

const [{ newRound, AI, CONFIG, DT }, { CHARACTERS, CHARACTERS_BY_ID }, { LOOKS },
  { configureSwordsmanshipDefault, swordsmanshipDefaultSupportsWeapon }, { configureCombatDefaults },
  { applySwordsmanship }, { configureArmTrial }] = await Promise.all([
  load('tools/sim/harness_m.mjs'), load('src/characters.js'), load('src/looks.js'),
  load('src/swordsmanship_default.js'), load('src/combat_defaults.js'), load('src/swordsmanship.js'), load('src/arm_trial.js'),
]);
const entry = configureSwordsmanshipDefault(new URLSearchParams());
assert(entry.active, 'Ordinary swordsmanship entry must be active');
assert(CONFIG.COMBAT.limbSeverTrial, 'Do not silently test a reduced severing default');
assert.equal(CONFIG.PHYSICS.gravity, -9.81);
assert.equal(CONFIG.ARENA.startGap, 5.6);
const roundOptions = (character, seed, look = character.look) => ({
  seed, weapon: 'longsword', weapon2: character.weapon, look2: look, revive: character.revive,
  difficulty: character.ai.level, persona: character.ai.persona,
  AI2Class: AI, difficulty2: 'normal', persona2: { school: 'longsword' },
  onFighter: f => {
    f.armTorqueModel = configureArmTrial(new URLSearchParams()).model;
    f.armSupportModel = 'linked'; f.finishEntryModel = 'low'; f.onehandArmModel = 'legacy';
    if (f.index === 0) {
      const policy = configureCombatDefaults(entry, f.weapon);
      if (swordsmanshipDefaultSupportsWeapon(f.weapon, entry)) f.onehandArmModel = 'manual';
      f.stanceMemoryModel = policy.stance; f.rollTargetModel = policy.roll;
    }
  },
});
function create(character, seed, look) {
  const G = newRound(roundOptions(character, seed, look));
  assert(applySwordsmanship(G.player), 'Current player v2 installation');
  G.player.canShove = true;
  // AI controls guard recovery in this fixture; ordinary player autoGuard is
  // nevertheless enabled as in main.js. No human pointer input is claimed.
  G.player.skill.autoGuard = true;
  G.combat.cutReactionModel = configureCombatDefaults(entry, G.player.weapon).cut;
  G.combat.cutReactionFighter = G.player;
  G.combat.finishRuleModel = 'power'; G.combat.finishRuleFighter = null;
  for (const f of [G.player, G.enemy]) assert.equal(f.getupLeadDelay, true, 'Keep adopted getup default');
  return G;
}
function profileBinding(character, ai) {
  const persona = character.ai.persona;
  const guards = ai.school.guards.map(g => g.name), techniques = ai.school.tech.map(t => t.name);
  const unknownGuards = Object.keys(persona.pers.guardPref ?? {}).filter(name => !guards.includes(name));
  const unknownTechniques = Object.keys(persona.pers.techPref ?? {}).filter(name => !techniques.includes(name));
  assert.deepEqual(unknownGuards, [], `${character.id}: ignored guard preference outside this weapon school's actual guard list`);
  assert.deepEqual(unknownTechniques, [], `${character.id}: ignored technique preference`);
  if (persona.idle) assert(guards.includes(persona.idle.guard), `${character.id}: idle guard silently falls back`);
  for (const [key, value] of Object.entries(persona.pers)) {
    if (key === 'guardPref' || key === 'techPref') {
      for (const [name, preference] of Object.entries(value)) assert.equal(ai.pers[key][name], preference, `${character.id}: ${key}.${name}`);
    } else assert.deepEqual(ai.pers[key], value, `${character.id}: ignored scalar persona.pers.${key}`);
  }
  for (const [key, value] of Object.entries(persona.level)) {
    assert(key in CONFIG.AI_LEVELS[character.ai.level], `${character.id}: unknown persona.level.${key}`);
    assert.equal(ai.level[key], value, `${character.id}: unapplied persona.level.${key}`);
  }
  return { guards, techniques, specifiedPreferencesApplied: true, idleGuard: persona.idle?.guard ?? null,
    unusedMetadata: persona.whole ? ['persona.whole is currently narrative/research data, not a runtime behavior control'] : [] };
}
const vector = v => [v.x, v.y, v.z];
const quaternion = q => [q.x, q.y, q.z, q.w];
const bodyRecord = b => ({ mass: b.mass(), inertia: vector(b.principalInertia()), com: vector(b.localCom()), position: vector(b.translation()), rotation: quaternion(b.rotation()), colliders: b.numColliders() });
const bodyConfiguration = f => ({ parts: Object.fromEntries(Object.entries(f.bodies).map(([name, b]) => [name, bodyRecord(b)])), sword: bodyRecord(f.sword) });
const armor = f => ({ helmet: f.helmetType ?? null, plates: Object.keys(f.plate).sort(), plateGait: [...f.plateGait].sort() });
const policyRecord = f => ({
  weapon: f.weapon.id, twoHand: f.weaponCfg.twoHand, gripAlong: f.weaponCfg.gripAlong, oneHandStance: f.guardPose.oneHand,
  armTorque: f.armTorqueModel, support: f.armSupportModel, onehandArm: f.onehandArmModel,
  stance: f.stanceMemoryModel ?? 'legacy', recut: f.rollTargetModel ?? 'legacy',
  swordsmanship: f.swordsmanshipModel ?? 'legacy', getupLeadDelay: f.getupLeadDelay,
  finishEntry: f.finishEntryModel, opportunity: f.opportunityModel ?? null,
});
const constructorRecord = G => ({
  player: policyRecord(G.player), enemy: policyRecord(G.enemy), aiSchool: G.ai.school.id, aiWeapon: G.ai.school.weapon,
  enemyLevel: G.ai.levelName, enemyStrength: G.enemy.strength, enemyMeasure: { ...G.ai.M },
  playerLevel: G.ai2.levelName, playerSchool: G.ai2.school.id,
  cut: G.combat.cutReactionModel, cutPlayerOnly: G.combat.cutReactionFighter === G.player,
  finish: G.combat.finishRuleModel, finishBoth: G.combat.finishRuleFighter === null,
  armor: armor(G.enemy), physics: bodyConfiguration(G.enemy),
});
const health = f => ({ alive: f.alive, state: f.state, blood: f.blood, consciousness: f.consciousness, pain: f.pain, limbs: { ...f.limbs }, wounds: f.wounds.length, armed: f.armed, broken: !!f.weaponBroken, helmetIntegrity: f.helmetIntegrity, plate: { ...f.plate } });
const briefResult = r => r ? Object.fromEntries(['zone', 'type', 'energy', 'severity', 'speed', 'quality', 'part', 'passing'].filter(k => r[k] !== undefined).map(k => [k, r[k]])) : null;
const tally = (rows, key) => rows.reduce((o, r) => { const k = String(r[key] ?? 'unknown'); o[k] = (o[k] ?? 0) + 1; return o; }, {});
function cleanup(G) {
  G.eventQueue.free(); G.world.free();
  const seen = new Set();
  for (const f of [G.player, G.enemy]) for (const group of Object.values(f.groups)) group.traverse(o => {
    for (const resource of [o.geometry, ...(Array.isArray(o.material) ? o.material : [o.material])]) {
      if (resource && !seen.has(resource)) { seen.add(resource); resource.dispose?.(); }
    }
  });
}
const rows = [], constructors = [], failures = [];
for (const id of ids) {
  const character = CHARACTERS_BY_ID[id], contract = expected[id];
  assert(character, `Missing approved optional opponent ${id}`);
  assert(!CHARACTERS.some(c => c.id === id), `${id} must remain outside the original random roster`);
  assert.equal(character.weapon, contract.weapon); assert.equal(character.age, contract.age);
  assert.equal(character.ai.persona.school, contract.weapon, 'Actual weapon-specific AI school');
  const appearances = [];
  let binding;
  for (const look of [character.look, LOOKS.enemy, character.look]) {
    const G = create(character, seeds[0], look);
    try { binding = profileBinding(character, G.ai); appearances.push(constructorRecord(G)); } finally { cleanup(G); }
  }
  const record = { id, character: { name: character.name, age: character.age, origin: character.origin, weapon: character.weapon }, profileBinding: binding, initial: appearances[0], baseLook: appearances[1], recreated: appearances[2] };
  assert.equal(record.initial.enemy.twoHand, contract.twoHand);
  assert.equal(record.initial.aiSchool, contract.weapon, 'No silent longsword fallback');
  assert.deepEqual(record.initial, record.recreated, 'Same seeded constructor recreation must preserve settings and native initial geometry');
  assert.deepEqual(record.initial.physics, record.baseLook.physics, 'Appearance must not change native body or weapon mass/inertia/initial geometry');
  record.armorSameAsBase = JSON.stringify(record.initial.armor) === JSON.stringify(record.baseLook.armor);
  record.nativePhysicsMatchesBaseLook = true; record.constructorRecreationMatches = true;
  constructors.push(record); write(`${id}-constructor.json`, record);
  console.log(JSON.stringify({ id, constructorRecreationMatches: true, nativePhysicsMatchesBaseLook: true, armorSameAsBase: record.armorSameAsBase }));
  if (constructorsOnly) continue;

  for (const seed of seeds) {
    const G = create(character, seed), started = performance.now();
    const row = { id, seed, dt: DT, limitSeconds: seconds, steps: 0, elapsedSeconds: 0, finite: true, initial: constructorRecord(G), attacks: [], contacts: [], accepted: [], applied: [], states: [], samples: [], errors: [] };
    const actors = [G.player, G.enemy], ais = [G.ai2, G.ai];
    let tick = 0, activeAttacker = null;
    const contactCounts = [0, 0], gripTicks = [0, 0], aliveGripEligibleTicks = [0, 0];
    const lastState = actors.map(f => f.state);
    for (let index = 0; index < ais.length; index++) {
      const ai = ais[index], startStrike = ai.startStrike;
      ai.startStrike = function (...params) {
        const result = startStrike.apply(this, params);
        if (result === true) row.attacks.push({ tick, seconds: G.t, actor: index, kind: this.tech?.kind, tech: this.tech?.name, feint: !!this.feint, skillTap: !!this.me.skill.tap, distance: this.d });
        return result;
      };
      const f = actors[index], applyWound = f.applyWound;
      f.applyWound = function (...params) {
        const before = health(this), result = applyWound.apply(this, params), after = health(this);
        row.applied.push({ tick, seconds: G.t, attacker: activeAttacker, victim: index, result: briefResult(params[0]), before, after, changed: JSON.stringify(before) !== JSON.stringify(after), addedWounds: after.wounds - before.wounds });
        return result;
      };
    }
    const strike = G.combat.strike;
    G.combat.strike = function (pair, point, passing) {
      const attacker = pair.w.fighter.index;
      contactCounts[attacker]++;
      const previous = activeAttacker; activeAttacker = attacker;
      try {
        const result = strike.call(this, pair, point, passing);
        if (row.contacts.length < 300) row.contacts.push({ tick, attacker, victim: pair.v.fighter.index, part: pair.v.part, point: vector(point), passing: !!passing, result: briefResult(result) });
        return result;
      } finally { activeAttacker = previous; }
    };
    G.onWound = (attacker, victim, result) => row.accepted.push({ tick, seconds: G.t, attacker: attacker.index, victim: victim.index, result: briefResult(result) });
    try {
      for (tick = 0; tick < Math.round(seconds / DT); tick++) {
        G.step(); row.steps++; row.elapsedSeconds = G.t;
        G.world.forEachRigidBody(b => {
          for (const values of [vector(b.translation()), quaternion(b.rotation()), vector(b.linvel()), vector(b.angvel())]) {
            if (!values.every(Number.isFinite)) throw new Error(`Nonfinite native rigid body at tick ${tick}, handle ${b.handle}`);
          }
        });
        for (const f of actors) {
          assert([f.blood, f.consciousness, f.pain, ...Object.values(f.limbs)].every(Number.isFinite), `Nonfinite health index${f.index}`);
          if (f.gripping) gripTicks[f.index]++;
          if (f.alive && f.armed && ['stand', 'kneel', 'getup'].includes(f.state)) aliveGripEligibleTicks[f.index]++;
          if (f.state !== lastState[f.index]) { row.states.push({ tick, actor: f.index, from: lastState[f.index], to: f.state }); lastState[f.index] = f.state; }
        }
        if (tick % Math.round(1 / DT) === 0) row.samples.push({ tick, seconds: G.t, distance: Math.hypot(G.enemy.pelvisPos.x - G.player.pelvisPos.x, G.enemy.pelvisPos.z - G.player.pelvisPos.z), player: health(G.player), enemy: health(G.enemy), enemyMode: G.ai.mode, enemyPhase: G.ai.phase });
        if (!G.player.alive || !G.enemy.alive) { row.stopReason = 'natural-death'; break; }
      }
      row.stopReason ??= 'time-limit';
    } catch (error) {
      row.errors.push(error.stack); row.finite = !/Nonfinite/.test(error.message); row.stopReason = 'error';
      failures.push({ id, seed, reason: error.message });
    } finally {
      row.final = { player: health(G.player), enemy: health(G.enemy), enemyStats: { ...G.ai.stats }, playerStats: { ...G.ai2.stats } };
      row.grip = { playerTicks: gripTicks[0], enemyTicks: gripTicks[1], enemyAliveArmedEligibleTicks: aliveGripEligibleTicks[1], expectedEnemyTwoHand: contract.twoHand };
      row.contactCalls = { player: contactCounts[0], enemy: contactCounts[1], detailedRowsCapped: contactCounts[0] + contactCounts[1] > row.contacts.length };
      row.summary = {
        attacks: tally(row.attacks.filter(a => a.actor === 1), 'kind'),
        techniques: tally(row.attacks.filter(a => a.actor === 1), 'tech'),
        acceptedContacts: row.accepted.filter(a => a.attacker === 1).length,
        acceptedTypes: tally(row.accepted.filter(a => a.attacker === 1).map(a => a.result), 'type'),
        appliedStateChanges: row.applied.filter(a => a.attacker === 1 && a.changed).length,
        addedWounds: row.applied.filter(a => a.attacker === 1).reduce((n, a) => n + a.addedWounds, 0),
      };
      if (!contract.twoHand && gripTicks[1]) failures.push({ id, seed, reason: 'One-handed character unexpectedly used offhand weapon grip' });
      row.wallSeconds = (performance.now() - started) / 1000;
      cleanup(G);
    }
    rows.push(row); write(`${id}-seed${seed}.json`, row);
    console.log(JSON.stringify({ id, seed, finite: row.finite, stopReason: row.stopReason, elapsedSeconds: row.elapsedSeconds, wallSeconds: row.wallSeconds, ...row.summary, enemyGripTicks: row.grip.enemyTicks }));
  }
}
const byCharacter = ids.map(id => {
  const cases = rows.filter(r => r.id === id), attacks = cases.flatMap(r => r.attacks.filter(a => a.actor === 1));
  const intendedKind = id === 'tome' ? 'thrust' : 'cut';
  const accepted = cases.flatMap(r => r.accepted.filter(a => a.attacker === 1).map(a => a.result));
  const intendedContactType = intendedKind === 'thrust' ? 'stab' : 'cut';
  const assessment = { id, observations: cases.length, intendedKind, attackKinds: tally(attacks, 'kind'), acceptedContacts: cases.reduce((n, r) => n + r.summary.acceptedContacts, 0), acceptedTypes: tally(accepted, 'type'), addedWounds: cases.reduce((n, r) => n + r.summary.addedWounds, 0), intendedKindObserved: attacks.some(a => a.kind === intendedKind), intendedContactType, intendedContactObserved: accepted.some(a => a.type === intendedContactType), twoHandGripObserved: cases.some(r => r.grip.enemyTicks > 0) };
  if (!constructorsOnly && !attacks.length) failures.push({ id, reason: 'Design failure: no real attack commands in the selected natural encounters' });
  if (!constructorsOnly && !assessment.intendedKindObserved) failures.push({ id, reason: `Intended ${intendedKind} attack not observed` });
  if (!constructorsOnly && !assessment.acceptedContacts) failures.push({ id, reason: 'No accepted opponent contact observed; engagement is unverified' });
  if (!constructorsOnly && !assessment.addedWounds) failures.push({ id, reason: 'No actual new wound inflicted across the selected encounters; accepted callbacks alone are insufficient' });
  if (!constructorsOnly && expected[id].twoHand && !assessment.twoHandGripObserved) failures.push({ id, reason: 'Two-handed offhand grip was never observed' });
  return assessment;
});
const frozenUnchanged = JSON.stringify(sourceHashes(frozen)) === JSON.stringify(sourceFrozen);
const engineUnchanged = JSON.stringify(engineHashes()) === JSON.stringify(engineBefore);
const liveSourceAfter = sourceHashes(root);
const sourceStable = JSON.stringify(sourceBefore) === JSON.stringify(sourceFrozen) && JSON.stringify(liveSourceAfter) === JSON.stringify(sourceFrozen);
if (!frozenUnchanged || !engineUnchanged) failures.push({ reason: 'Frozen sources or engine changed during observation' });
const summary = {
  completedUTC: new Date().toISOString(), headBefore, headAfter: head(), sourceManifestSHA256: protocol.sourceManifestSHA256,
  sourceStable, frozenUnchanged, engineUnchanged, liveSourceAfter,
  constructorsPassed: constructors.length, duelObservations: rows.length, totalSteps: rows.reduce((n, r) => n + r.steps, 0),
  byCharacter, unobservedIntendedContact: constructorsOnly ? [] : byCharacter.filter(c => !c.intendedContactObserved).map(c => ({ id: c.id, type: c.intendedContactType, meaning: 'Attack command and other contacts do not verify this intended impact type' })), failures, status: failures.length ? 'needs-review' : constructorsOnly ? 'constructors-only-not-combat-validation' : 'observed-with-stated-limits',
  limitations: protocol.limitations,
};
write('summary.json', summary);
console.log(JSON.stringify({ status: summary.status, constructorsPassed: summary.constructorsPassed, duelObservations: summary.duelObservations, totalSteps: summary.totalSteps, failures }));
if (failures.length) process.exitCode = 1;

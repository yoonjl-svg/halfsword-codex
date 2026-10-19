import { installFollowup } from '../../src/italian_followup_research.js';
// Lifecycle gates use synthetic contacts on real physics bodies. They are not efficacy evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, THREE, CONFIG } from './harness_m.mjs';
import { PlayerParryGuard } from '../../src/parry_button.js';
function fixture() {
  const g = newRound({ weapon: 'rapier', weapon2: 'longsword', gap: 1.4, seed: 9 });
  const f = g.player, a = g.enemy; g.ai.update = () => {}; f.foe = a; a.foe = f;
  const guard = new PlayerParryGuard(f, a); f.stamina.controller = guard; installFollowup(f,a,guard,process.env.VARIANT??'gentleNear');
  guard.held = true; guard.step(DT); guard.active = true; a.stamina.attack('cut');
  const c = f.bodies.chest.translation(), tip = a.bladePoint(1, new THREE.Vector3());
  a.tipVel.set(c.x - tip.x, c.y - tip.y, c.z - tip.z).normalize().multiplyScalar(4);
  return { g, f, a, guard, mod: guard.opposition, clash: () => guard.opposition.onClash(a, { vn: 4 }) };
}
for (const mode of ['release', 'exhaustion', 'manual', 'repeat', 'move', 'complete', 'slow', 'down', 'lost', 'enemyDead']) {
  test(`automatic thrust lifecycle: ${mode}`, () => {
    const { g, f, a, guard, mod, clash } = fixture();
    try {
      f.stamina.block(a); clash(); assert.ok(mod.run); assert.equal(mod.starts, 1);
      assert.ok(Math.abs(f.stamina.spent.attack - 4 * f.stamina.weight) < 1e-8);
      assert.ok(Math.abs(f.stamina.spent.block + f.stamina.spent.attack - 7 * f.stamina.weight) < 1e-8);
      if (mode === 'release') guard.held = false;
      if (mode === 'exhaustion') f.stamina.exhaustLeft = 1;
      if (mode === 'manual') { f.skill.thrust(); assert.ok(f.skill.tap); }
      if (mode === 'down') f.state = 'down';
      if (mode === 'lost') f.armed = false;
      if (mode === 'enemyDead') a.state = 'dead';
      if (mode === 'repeat') {
        clash(); mod.cancel('check'); guard.held = false; guard.step(DT); guard.held = true; guard.step(DT); clash();
        assert.equal(mod.starts, 1); assert.equal(mod.run, null); return;
      }
      if (mode === 'move') { f.move.set(.23, -.4); f.stickX = .23; f.stickY = -.4; }
      if (mode === 'slow') { f.stamina.level = 1; const speed = f.stamina.attackSpeed; mod.update(.1); assert.ok(Math.abs(mod.run.t - .1 * speed) < 1e-9); return; }
      if (mode === 'complete') { for (let i = 0; i < 90; i++) mod.update(DT); assert.equal(mod.run, null); assert.equal(mod.lastEnd.reason, 'complete'); return; }
      f.skill.update(DT);
      if (mode === 'move') { assert.equal(f.move.x, .23); assert.equal(f.move.y, -.4); }
      else assert.equal(mod.run, null);
      if (mode === 'manual') assert.ok(f.skill.tap, 'manual attack keeps ownership of pose');
    } finally { g.world.free(); }
  });
}
for (const mode of ['late', 'bookOff', 'otherWeapon', 'noAttack', 'outgoing', 'injured', 'disabled', 'slowContact', 'inactive', 'broken', 'distant']) {
  test(`reject invalid contact: ${mode}`, () => {
    const { g, f, a, guard, mod, clash } = fixture();
    try {
      if (mode === 'late') guard.clock += .33;
      if (mode === 'bookOff') f.schoolParry = false;
      if (mode === 'otherWeapon') f.weapon = { id: 'longsword' };
      if (mode === 'noAttack') a.stamina.attackId = 0;
      if (mode === 'outgoing') a.tipVel.multiplyScalar(-1);
      if (mode === 'injured') f.applyWound({ severity: .01, part: 'farmS', type: 'cut', zone: 'arm', point: new THREE.Vector3(), local: new THREE.Vector3(), bleedPerSev: .1, energy: 1 });
      if (mode === 'disabled') CONFIG.SKILL.itOpposition = 0;
      if (mode === 'inactive') guard.active = false;
      if (mode === 'broken') guard.broken = true;
      if (mode === 'distant') f.foeDistance = () => 2;
      if (mode === 'slowContact') mod.onClash(a, { vn: .59 }); else clash();
      assert.equal(mod.run, null); assert.equal(mod.starts, 0);
    } finally { CONFIG.SKILL.itOpposition = 1; g.world.free(); }
  });
}
test('no unpaid block credit; duplicate contacts cannot bill twice', () => {
  const { g, f, mod, clash } = fixture();
  try { clash(); const spent = f.stamina.spent.attack; assert.ok(Math.abs(spent - 7 * f.stamina.weight) < 1e-8); clash(); assert.equal(f.stamina.spent.attack, spent); assert.equal(mod.starts, 1); }
  finally { g.world.free(); }
});


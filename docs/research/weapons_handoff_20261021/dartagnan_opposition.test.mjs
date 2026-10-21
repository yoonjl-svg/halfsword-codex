// Lifecycle gates use synthetic contacts on real physics bodies. They are not efficacy evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, THREE, CONFIG } from '../../../tools/sim/harness_m.mjs';
import { PlayerParryGuard } from '../../../src/parry_button.js';
function fixture() {
  const g = newRound({ weapon: 'dartagnan', weapon2: 'longsword', gap: 1.4, seed: 9 });
  const f = g.player, a = g.enemy; g.ai.update = () => {}; f.foe = a; a.foe = f;
  const guard = new PlayerParryGuard(f, a); f.stamina.controller = guard;
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
      if (mode === 'late') guard.clock += CONFIG.SKILL.itOppositionVals.window + .01; // 창(10/21 0.4 s) 바로 뒤
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

test('real blade collision starts one paid thrust without synthetic contact callbacks', async () => {
  const { TECH } = await import('../../../src/ai_techniques.js');
  const g = newRound({ weapon: 'dartagnan', weapon2: 'longsword', gap: 1.65, seed: 1 });
  try {
    const p = g.player, a = g.enemy; p.fightT = a.fightT = CONFIG.ARENA.startHold;
    p.skill.corr = CONFIG.SKILL.corr; p.skill.corrTip = CONFIG.SKILL.corrTip; p.skill.autoGuard = true;
    const guard = new PlayerParryGuard(p, a); p.stamina.controller = guard; g.ai.update = () => {};
    const atk = TECH.find(t => t.name === 'zwerchL'); let phase = 0, at = 0, strike = null, points;
    const move = (v, speed) => {
      const o = a.handOffset, d = Math.hypot(v[0] - o.x, v[1] - o.y), k = Math.min(1, speed * DT / d);
      o.set(o.x + (v[0] - o.x) * k, o.y + (v[1] - o.y) * k); a.skill.aimRaw.copy(o); return k === 1;
    };
    g.before = () => {
      if (g.t >= (strike ?? (phase === 2 ? at + .15 : Infinity)) + .02) guard.held = true;
      guard.step(DT); p.inputActive = guard.active; a.move.set(0, 0);
      if (phase === 0 && g.t > .6) phase = 1;
      else if (phase === 1 && move(atk.from, 3)) { phase = 2; at = g.t; }
      else if (phase === 2 && g.t - at > .15) { phase = 3; strike = g.t; points = atk.path.map(x => [...x]); a.stamina.attack('cut'); }
      else if (phase === 3 && move(points[0], 11) && (points.shift(), !points.length)) phase = 4;
    };
    for (let i = 0; i < 480; i++) g.step();
    assert.ok(g.clashes > 0); assert.equal(guard.opposition.starts, 1);
    assert.equal(guard.opposition.lastEnd.reason, 'complete');
    assert.ok(Math.abs(p.stamina.spent.attack + p.stamina.spent.block - 7 * p.stamina.weight) < 1e-8);
  } finally { g.world.free(); }
});

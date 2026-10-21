// 막아찌르기 — 플레이어 레이피어의 실제 칼 접촉에서만 시작한다.
// 연구 slow v3의 물리 궤적. docs/strike/italian_opposition_2026-10-20.md
import * as THREE from 'three';
import { SKILL } from './config.js';
const V = () => new THREE.Vector3();
const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

export class ItalianOpposition {
  constructor(f, foe, guard) {
    this.f = f; this.foe = foe; this.guard = guard;
    this.run = null; this.lastHeld = false; this.pressed = -Infinity;
    this.used = false; this.usedAttacks = new WeakMap(); this.lastInjury = -Infinity;
    this.starts = 0; this.lastStart = null; this.lastEnd = null;
    this.pad = new THREE.Vector2();
  }

  eligible() {
    const f = this.f, sk = f.skill, g = this.guard;
    return SKILL.itOpposition && ['rapier', 'dartagnan'].includes(f.weapon?.id) && f.swordArt?.tradition === 'italian'
      && f.schoolParry !== false && g.held && !g.broken && f.alive && this.foe.alive
      && f.armed && !f.stamina.exhausted && ['stand', 'kneel'].includes(f.state)
      && !sk.tap && !sk.sec && !sk.pom && !f.secretStiff && sk.sec?.stage !== 'stiff';
  }

  beginGuardStep() {
    if (this.guard.held && !this.lastHeld) { this.pressed = this.guard.clock; this.used = false; }
    this.lastHeld = this.guard.held;
    this.pad.copy(this.f.handOffset);
    if (this.run && !this.eligible()) this.cancel('interrupt');
  }

  endGuardStep() {
    // 일반 막기 손 목표가 자동 찌르기와 싸우거나 별도 휘두르기로 청구되지 않도록 한다.
    if (this.run) { this.f.handOffset.copy(this.pad); this.f.skill.prev.copy(this.pad); }
  }

  beforeSkill() {
    if (!this.run) return;
    if (!this.eligible()) this.cancel('interrupt');
    else { this.f.skill.thrustPose.w = 0; this.f.skill.thrustPush = false; }
  }

  cancel(reason) {
    if (!this.run) return;
    this.lastEnd = { t: this.guard.clock, reason };
    this.run = null; this.f.skill.thrustPose.w = 0; this.f.skill.thrustPush = false;
  }

  onWound(hit) { if (hit.severity > 0) this.lastInjury = this.guard.clock; }

  onClash(attacker, hit) {
    const f = this.f, foe = this.foe, g = this.guard, cfg = SKILL.itOppositionVals;
    const age = g.clock - this.pressed, other = foe.stamina;
    if (attacker !== foe || !this.eligible() || !g.active || this.run || this.used
      || age < 0 || age > cfg.window || !other.attackId || other.time > other.attackUntil
      || this.usedAttacks.get(foe) === other.attackId || g.clock - this.lastInjury < cfg.injuryGrace
      || (hit?.vn ?? 0) < cfg.minVn || f.foeDistance() > cfg.maxGap) return;
    const ch = f.bodies.chest.translation(), tip = foe.bladePoint(1, V());
    if (V().copy(ch).sub(tip).dot(foe.tipVel) <= 0) return;
    this.used = true; this.usedAttacks.set(foe, other.attackId);
    const inv = f.yaw.clone().invert(), c = V().copy(ch);
    const hand = V().copy(f.sword.translation()).sub(c).applyQuaternion(inv);
    const dir = f.bladePoint(1, V()).sub(f.bladePoint(0, V())).applyQuaternion(inv).normalize();
    const target = V().copy(foe.bodies.chest.translation()).sub(c).applyQuaternion(inv).sub(hand).normalize();
    const before = f.stamina.value, credit = f.stamina.parryThrust(foe);
    f.skill.thrusts++;
    this.starts++;
    this.lastStart = { t: g.clock, age, line: g.line, foeAttackId: other.attackId, credit, cost: before - f.stamina.value };
    // 비용으로 탈진했다면 새 동작을 시작하지 않는다.
    if (f.stamina.exhausted) return;
    const b = f.guardPose ?? {};
    this.run = { t: 0, hand, dir, target, side: Math.sign(hand.z) || 1,
      body: { pelvisYaw: b.pelvisYaw ?? 0, chestYaw: b.chestYaw ?? 0, pitch: b.pitch ?? 0, drop: b.drop ?? 0 } };
  }

  update(dt) {
    const r = this.run; if (!r) return;
    if (!this.eligible()) { this.cancel('interrupt'); return; }
    const cfg = SKILL.itOppositionVals, sk = this.f.skill;
    r.t += dt * this.f.stamina.attackSpeed;
    const end = cfg.aim + cfg.extend + cfg.hold;
    if (r.t >= end + cfg.recover) { this.cancel('complete'); return; }
    const e = smooth((r.t - cfg.aim) / cfg.extend), a = smooth(r.t / cfg.aim);
    const w = r.t < .04 ? smooth(r.t / .04) : r.t < end ? 1 : 1 - smooth((r.t - end) / cfg.recover);
    const axis = r.dir.clone().lerp(r.target, cfg.turn * a).normalize();
    const h = r.hand.clone().addScaledVector(axis, cfg.reach * e);
    h.z += r.side * cfg.side * a;
    Object.assign(sk.thrustPose, { w, hand: h.toArray(), dir: axis.toArray(), ...r.body });
    sk.thrustPush = r.t >= cfg.aim && r.t < end;
    sk.activity = Math.max(sk.activity, w);
  }
}

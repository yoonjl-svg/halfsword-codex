import { STAMINA } from './config.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** 행동을 관찰하는 기력 층. 입력·AI 판단·유파 동작·보법 목표는 바꾸지 않는다. */
export class Stamina {
  constructor(fighter) {
    this.fighter = fighter;
    this.controller = null; // AI 또는 PlayerParryGuard의 현재 상태를 읽기만 한다
    this.value = STAMINA.max;
    this.exhausted = false;
    this.rest = 0;
    this.spent = { move: 0, attack: 0, block: 0 };
    this.recovered = 0;
    this.lastShots = 0;
    this.action = 'rest';
  }

  get ratio() { return clamp(this.value / STAMINA.max, 0, 1); }
  get power() { return STAMINA.on && this.exhausted ? STAMINA.exhaustedPower : 1; }

  step(dt) {
    if (!(dt > 0)) return;
    const f = this.fighter;
    const shots = f.gun?.shots ?? 0;
    const fired = Math.max(0, shots - this.lastShots);
    this.lastShots = shots;
    if (!STAMINA.on) {
      this.value = STAMINA.max;
      this.exhausted = false;
      this.rest = 0;
      this.action = 'rest';
      return;
    }
    if (!f.alive || f.revival) return;
    const sk = f.skill;
    const c = this.controller;
    // 명시된 막기는 빠른 손 이동도 공격으로 이중 청구하지 않는다.
    let blocking = f.armed && (c?.active === true || (f.aiControlled && c?.mode === 'defend' && !c.defVoid));
    const attack = !blocking && f.armed && (sk.tap || sk.pom || sk.thrustPush ||
      (f.aiControlled && c
        ? (c.mode === 'attack' && c.phase === 'strike') || (c.mode === 'secret' && c.secretRun?.stage !== 'stiff' && sk.swinging)
        : sk.swinging));
    // 버튼 없이 칼을 세워 받은 접촉도 막기다. 공격 중 칼 충돌은 공격 비용에 포함한다.
    if (!attack && f.armed && f.feel?.touching) blocking = true;
    const move = f.state === 'stand' && !f.feetHeld ? clamp(Math.hypot(f.move.x, f.move.y), 0, 1) : 0;
    // 대기 자세는 휴식. 소모는 무기 질량의 제곱근에 비례하며 상한을 둔다.
    const mass = f.armed ? (f.swordMass ?? STAMINA.weaponReferenceMass) : 0;
    const weight = clamp(Math.sqrt(Math.max(0, mass) / STAMINA.weaponReferenceMass), 0.65, 3);
    const costs = {
      move: move > 0.05 ? STAMINA.movePerSecond * move * (0.85 + 0.15 * weight) * dt : 0,
      attack: ((attack ? STAMINA.attackPerSecond * dt : 0) + fired * STAMINA.shotCost) * weight,
      block: blocking ? STAMINA.blockPerSecond * weight * dt : 0,
    };
    const cost = costs.move + costs.attack + costs.block;
    this.action = blocking ? 'block' : attack || fired ? 'attack' : costs.move ? 'move' : 'rest';
    if (cost > 0) {
      this.rest = 0;
      this.value = Math.max(0, this.value - cost);
      for (const key of Object.keys(costs)) this.spent[key] += costs[key];
      if (this.value <= 1e-9) { this.value = 0; this.exhausted = true; }
    } else {
      const before = this.value;
      const recoveryTime = Math.max(0, this.rest + dt - STAMINA.recoverDelay) - Math.max(0, this.rest - STAMINA.recoverDelay);
      this.rest += dt;
      this.value = Math.min(STAMINA.max, this.value + STAMINA.recoverPerSecond * recoveryTime);
      this.recovered += this.value - before;
      if (this.ratio >= STAMINA.exhaustedRecovery) this.exhausted = false;
    }
  }
}

import { classifyStroke } from './attack_stroke.js';
import { STAMINA, UNIQUE_ASSIST } from './config.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** 공통 기력 장부. 유파의 동작/해금과 독립적이며 모든 시간은 물리 시간이다. */
export class Stamina {
  constructor(fighter) {
    this.fighter = fighter;
    this.controller = null;
    this.value = STAMINA.max;
    this.level = 0;
    this.exhaustLeft = 0;
    this.rest = 0;
    this.time = 0;
    this.originalMass = null;
    this.attackId = 0;
    this.attackUntil = -1;
    this.blockedAttack = new WeakMap();
    this.stroke = null;
    this.quiet = Infinity;
    this.strokeStart = null;
    this.distance = 0;
    this.position = null;
    this.lastShots = 0;
    this.pose = 0;
    this.spent = { move: 0, attack: 0, block: 0, secret: 0, push: 0 };
    this.counts = { cut: 0, thrust: 0, block: 0, secret: 0, exhaustion: 0 };
    this.recovered = 0;
    this.action = 'rest';
  }

  captureMass(mass) { if (this.originalMass == null && mass > 0) this.originalMass = mass; }
  get weight() {
    this.captureMass(this.fighter.swordMass);
    return clamp(Math.sqrt((this.originalMass ?? STAMINA.weaponReferenceMass) / STAMINA.weaponReferenceMass), 0.75, 1.5);
  }
  get ratio() { return clamp(this.value / STAMINA.max, 0, 1); }
  get exhausted() { return STAMINA.on && this.exhaustLeft > 0; }
  get speed() { return !STAMINA.on ? 1 : this.exhausted ? 0 : this.level === 2 ? 0.5 : this.level === 1 ? 0.7 : 1; }
  get power() { return !STAMINA.on || this.exhausted ? 1 : this.level === 2 ? STAMINA.severePower : this.level === 1 ? STAMINA.tiredPower : 1; }
  get progress() { return this.exhausted ? 1 - this.exhaustLeft / STAMINA.exhaustSeconds : 0; }
  get guarding() {
    const c = this.controller;
    return !!this.fighter.armed && (this.fighter.aiControlled
      ? c?.mode === 'defend' && !c.defVoid
      : !!c?.held && !c.broken);
  }
  get inSecret() { return !!(this.fighter.skill?.sec || this.controller?.secretRun); }

  stages() {
    if (this.exhausted) return;
    if (this.value <= STAMINA.floor) {
      this.value = STAMINA.floor;
      this.exhaustLeft = STAMINA.exhaustSeconds;
      this.level = 3;
      this.counts.exhaustion++;
      this.stroke = null;
      this.action = 'exhausted';
    } else if (this.value < -30) this.level = 2;
    else if (this.level === 2 && this.value >= -15 - 1e-9) this.level = 1;
    else if (this.level === 0 && this.value < 0) this.level = 1;
    if (this.level === 1 && this.value >= 15 - 1e-9) this.level = 0;
  }

  spend(kind, amount) {
    if (!STAMINA.on || this.exhausted || !this.fighter.alive || this.fighter.revival || !(amount > 0)) return false;
    this.value = Math.max(STAMINA.floor, this.value - amount);
    this.spent[kind] += amount;
    if (kind !== 'move') this.rest = 0;
    this.action = kind;
    this.stages();
    return true;
  }

  attack(kind = 'cut', bundled = this.inSecret) {
    if (!STAMINA.on || this.exhausted || !this.fighter.alive) return;
    this.attackId++;
    this.attackUntil = this.time + 1.5;
    if (bundled) return;
    this.counts[kind] = (this.counts[kind] ?? 0) + 1;
    this.spend('attack', (kind === 'thrust' ? STAMINA.thrustCost : STAMINA.cutCost) * this.weight);
  }

  secret() {
    if (!STAMINA.on || this.exhausted) return;
    this.attackId++;
    this.attackUntil = this.time + 1.5;
    if (this.spend('secret', STAMINA.secretCost)) this.counts.secret++;
  }

  /** 접촉 fresh와 별개로 상대 공격 번호당 한 번만 청구한다. 공격 중 칼 충돌은 공격 비용에 포함. */
  block(attacker) {
    if (!STAMINA.on || this.exhausted || this.inSecret || !this.fighter.armed) return;
    const other = attacker?.stamina;
    if (!other || !other.attackId || other.time > other.attackUntil) return;
    const f = this.fighter;
    const attacking = f.aiControlled ? this.controller?.mode === 'attack' && this.controller.phase === 'strike' : f.skill?.swinging || f.skill?.tap || f.skill?.pom;
    if (attacking && !this.guarding) return;
    if (this.blockedAttack.get(attacker) === other.attackId) return;
    this.blockedAttack.set(attacker, other.attackId);
    if (this.spend('block', STAMINA.blockCost * this.weight)) this.counts.block++;
  }

  /** unique_assist의 0.06초 끊김/90도 방향 규칙. 해금/강화 객체에 연결하지 않는다. */
  observeStroke(dt) {
    const f = this.fighter, sk = f.skill;
    if (f.aiControlled) return;
    if (this.guarding || this.inSecret || sk.tap || sk.pom || sk.recovering || !f.armed || f.weapon?.gun) {
      this.stroke = null;
      this.quiet = Infinity;
      return;
    }
    if (!sk.swinging) {
      if (f.handOffset) this.strokeStart = [f.handOffset.x, f.handOffset.y];
      this.quiet += dt;
      if (this.quiet >= UNIQUE_ASSIST.onsetQuiet) this.stroke = null;
      return;
    }
    const vx = sk.vel.x, vy = sk.vel.y, n = Math.hypot(vx, vy);
    if (n < 1e-6) return;
    const dir = [vx / n, vy / n];
    const turn = this.stroke ? Math.acos(clamp(dir[0] * this.stroke[0] + dir[1] * this.stroke[1], -1, 1)) * 180 / Math.PI : 180;
    if (!this.stroke || turn > UNIQUE_ASSIST.turnDeg) {
      this.stroke = dir;
      const at = this.strokeStart ?? [f.handOffset?.x ?? 0, f.handOffset?.y ?? 0];
      this.attack(classifyStroke(at, dir).kind);
      this.strokeStart = [f.handOffset?.x ?? 0, f.handOffset?.y ?? 0];
    }
    this.quiet = 0;
  }

  step(dt) {
    if (!(dt > 0)) return;
    const f = this.fighter;
    this.time += dt;
    this.captureMass(f.swordMass);
    const p = f.bodies?.pelvis?.translation();
    const old = this.position;
    this.position = p ? { x: p.x, z: p.z } : null;
    if (!STAMINA.on) {
      this.value = STAMINA.max; this.level = 0; this.exhaustLeft = 0; this.pose = 0; this.rest = 0;
      return;
    }
    if (!f.alive || f.revival) return;
    this.stages();
    if (this.exhausted) {
      const slice = Math.min(dt, this.exhaustLeft);
      const before = this.value;
      this.exhaustLeft = Math.max(0, this.exhaustLeft - slice);
      this.value = Math.min(0, this.value + STAMINA.exhaustRecover * slice);
      this.recovered += this.value - before;
      this.pose = Math.min(1, this.pose + dt * 6);
      this.action = 'exhausted';
      this.rest = 0;
      if (this.exhaustLeft < 1e-9) {
        this.exhaustLeft = 0; this.value = 0; this.level = 1;
        this.rest = STAMINA.recoverDelay; // 이미 2.5초 쉼. 다음 스텝부터 정상 회복.
      }
      return;
    }
    this.pose = Math.max(0, this.pose - dt * 6);
    this.action = this.guarding ? 'guard' : 'rest';
    this.observeStroke(dt);
    if ((f.aiControlled && this.controller?.phase === 'strike') || (!f.aiControlled && f.skill?.swinging)) this.attackUntil = this.time + 0.35;
    if (this.exhausted) return;
    const shots = f.gun?.shots ?? 0;
    if (shots > this.lastShots) this.spend('attack', (shots - this.lastShots) * STAMINA.shotCost * this.weight);
    this.lastShots = shots;
    // 걷기 의도가 있는 실제 전진거리만. 정지 흔들림/기술 내딛기/역방향 피격 이동은 제외.
    const mv = f.move;
    if (p && old && f.state === 'stand' && !f.feetHeld && !this.inSecret && !f.gait?.req && !(f.skill?.lunge > 0) && !f.skill?.thrustPush && mv && Math.hypot(mv.x, mv.y) > 0.05) {
      const heading = f.heading ?? 0;
      const dx = p.x - old.x, dz = p.z - old.z;
      const along = dx * (Math.cos(heading) * mv.y + Math.sin(heading) * mv.x) + dz * (-Math.sin(heading) * mv.y + Math.cos(heading) * mv.x);
      if (along > 0) this.distance += Math.min(Math.hypot(dx, dz), STAMINA.maxWalkSpeed * dt);
      const steps = Math.floor((this.distance + 1e-9) / STAMINA.stepDistance);
      if (steps) {
        this.distance -= steps * STAMINA.stepDistance;
        this.spend('move', steps * (f.swordArt?.tradition === 'japanese' ? 1.5 : 1));
      }
    }
    if (this.exhausted) return;
    const active = Math.max(0, this.rest + dt - STAMINA.recoverDelay) - Math.max(0, this.rest - STAMINA.recoverDelay);
    this.rest += dt;
    if (!this.guarding) {
      const before = this.value;
      this.value = Math.min(STAMINA.max, this.value + active * STAMINA.recoverPerSecond);
      this.recovered += this.value - before;
    }
    this.stages();
  }
}

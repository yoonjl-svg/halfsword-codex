import { classifyStroke } from './attack_stroke.js';
import { STAMINA, UNIQUE_ASSIST, CLOSE } from './config.js';
import { entersAttackLine, isPreparation } from './stamina_stroke.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** 공통 기력 장부. 유파의 동작/해금과 독립적이며 모든 시간은 물리 시간이다. */
export class Stamina {
  constructor(fighter) {
    this.fighter = fighter;
    this.controller = null;
    this.maxBonus = 0; // 최대 기력 덧 (대기실 장비 — 케틀 햇 '생존술: 기력 +30', main.js setMaxBonus · 플레이어만). 문턱 0 · −35 · −70 과 그 밖 규칙은 그대로
    this.infinite = false; // 기력 무한 (대기실 장비 — 용사의 눈물 '기력 무한', main.js setInfinite · 플레이어만). 거짓이면 아래 모든 길이 전과 한 글자도 다르지 않다
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
    this.strokeTail = null;
    this.quiet = Infinity;
    this.strokeStart = null;
    this.distance = 0;
    this.position = null;
    this.lastShots = 0;
    this.pose = 0;
    this.spent = { move: 0, attack: 0, block: 0, secret: 0, push: 0, clinch: 0 };
    this.counts = { cut: 0, thrust: 0, block: 0, secret: 0, push: 0, exhaustion: 0 };
    this.recovered = 0;
    this.action = 'rest';
    this.clinching = false;
    this.clinchSeconds = 0;
    this.clinchStep = null;
  }

  /** 최대 기력: 100(STAMINA.max) + 장비 덧. 기력을 끄면(STAMINA.on false) 덧 없이 100 — 지금 판 그대로 */
  get max() { return STAMINA.on ? STAMINA.max + this.maxBonus : STAMINA.max; }
  /** 판을 세울 때(main.js newRound — 첫 스텝 전) 장비 덧을 정하고 그 최대에서 시작한다 */
  setMaxBonus(bonus) {
    this.maxBonus = Math.max(0, +bonus || 0);
    if (STAMINA.on) this.value = this.max;
  }
  /**
   * 기력 무한 (용사의 눈물 — main.js newRound 가 판을 세울 때 · 첫 스텝 전 · 플레이어만, docs/import/hero_tear_2026-10-17.md):
   *  늘 가득(최대 — 케틀 햇 덧까지) · 청구(spend — 걷기 · 공격 · 막아 받기 · 박차기 · 비기 · 권총 · 클린치)가 깎지 않는다 →
   *  지침(× 0.7 · × 0.5 · 힘 배율) · 탈진 · 숨 고르기 자세 · 숨소리 · 회복 쉼이 생기지 않는다. 상대가 읽는 내 기력(ai.js 지친 상대 노림)도 늘 생생.
   *  공격 번호(attackId — 상대의 막아 받기 청구)와 횟수 셈(counts)은 전처럼 남는다 — 상대 장부는 그대로. 기력 끔(STAMINA.on 거짓)이면 원래 100 그대로
   */
  setInfinite(on = true) {
    this.infinite = !!on;
    if (this.infinite) this.refill();
  }
  /** 무한 기력의 '늘 가득': 값 = 최대 · 생생 · 탈진 없음 (setInfinite · 스텝마다 — 시험 도구가 값을 바꿔 놓아도 다음 스텝에 되돌린다) */
  refill() {
    this.value = this.max; this.level = 0; this.exhaustLeft = 0; this.pose = 0;
  }
  captureMass(mass) { if (this.originalMass == null && mass > 0) this.originalMass = mass; }
  get weight() {
    this.captureMass(this.fighter.swordMass);
    return clamp(Math.sqrt((this.originalMass ?? STAMINA.weaponReferenceMass) / STAMINA.weaponReferenceMass), 0.75, 1.5);
  }
  get ratio() { return clamp(this.value / this.max, 0, 1); } // 머리 위 막대 = 최대(덧 포함)의 몫
  get exhausted() { return STAMINA.on && this.exhaustLeft > 0; }
  get speed() { return !STAMINA.on ? 1 : this.exhausted ? 0 : this.level === 2 ? STAMINA.moveSevere : this.level === 1 ? STAMINA.moveTired : 1; }
  get attackSpeed() {
    if (!STAMINA.on) return 1;
    if (this.exhausted) return 0;
    if (!this.level) return 1;
    const severe = this.level === 2;
    if (!STAMINA.attackTempo) return severe ? STAMINA.attackSevere : STAMINA.attackTired;
    const f = this.fighter;
    if (STAMINA.tempoProfiles) {
      if (f.skill?.pom) return severe ? STAMINA.tempoPommelSevere : STAMINA.tempoPommelTired;
      this.captureMass(f.swordMass);
      if (f.skill?.tap && !f.weaponCfg?.thrustStyle && this.originalMass < STAMINA.tempoHeavyMass)
        return severe ? STAMINA.tempoThrustSevere : STAMINA.tempoThrustTired;
    }
    return severe ? STAMINA.tempoRateSevere : STAMINA.tempoRateTired;
  }
  get retimeBody() {
    return STAMINA.on && STAMINA.attackTempo && STAMINA.tempoBody && this.level > 0 && !this.exhausted && !this.guarding
      && !(STAMINA.tempoProfiles && this.fighter.skill?.tap);
  }
  // 막기 자세/신뢰도 보정은 보류한 범위다. 기존 방어 근육의 한도는 유지한다.
  get motorSpeed() { return this.guarding && STAMINA.on && !this.exhausted ? this.level === 2 ? .5 : this.level === 1 ? .7 : 1 : this.attackSpeed; }
  get power() { const tune=STAMINA.attackTempo&&!this.guarding;return !STAMINA.on || this.exhausted ? 1 : this.level === 2 ? (tune ? STAMINA.tempoPowerSevere : STAMINA.severePower) : this.level === 1 ? (tune ? STAMINA.tempoPowerTired : STAMINA.tiredPower) : 1; }
  get progress() { return this.exhausted ? 1 - this.exhaustLeft / STAMINA.exhaustSeconds : 0; }
  get guarding() {
    const c = this.controller;
    return !!this.fighter.armed && (this.fighter.aiControlled
      ? c?.mode === 'defend' && !c.defVoid
      : !!c?.held && !c.broken);
  }
  get inSecret() { return !!(this.fighter.skill?.sec || this.controller?.secretRun); }
  get attacking() {
    const f = this.fighter;
    return f.aiControlled ? this.controller?.mode === 'attack' && this.controller.phase === 'strike'
      : !!(f.skill?.tap || f.skill?.pom || this.stroke?.paid || (this.strokeTail?.paid && this.time <= this.strokeTail.until));
  }

  /** 기존 누르기 단계 + 실제 팔/칼 접촉. 거리만 가깝거나 공격 중인 것은 클린치가 아니다. */
  canClinch(other) {
    if (!STAMINA.on || !CLOSE.on || !(STAMINA.clinchPerSecond > 0) || !other || other === this) return false;
    const a = this.fighter, b = other.fighter;
    if (a.foe !== b || b.foe !== a) return false;
    for (const s of [this, other]) {
      const f = s.fighter, sk = f.skill;
      if (!f.alive || f.revival || f.state !== 'stand' || f.feetHeld || s.exhausted || s.value <= STAMINA.floor || s.inSecret || sk?.swinging || sk?.tap || sk?.pom || (f.gun?.shots ?? 0) > s.lastShots) return false;
    }
    const pressing = (f) => f.canShove && f.barge?.phase === 'press' && f.stickY > 0 && f.foeDistance() <= CLOSE.reach(f.armed ? f.weapon : null) && f.closeTouch();
    return !!(pressing(a) || pressing(b));
  }

  /** 두 Fighter.step 중 먼저 오는 쪽이 양쪽 비용을 확정하고, 뒤쪽은 같은 결과를 소비한다.
   *  양쪽이 밀어도 한 번만 청구하며, 먼저 탈진한 쪽 때문에 뒤쪽 비용이 빠지지 않는다. */
  stepClinch(dt) {
    const other = this.fighter.foe?.stamina;
    let pair = this.clinchStep;
    if (!other) { this.clinching = false; this.clinchStep = null; return false; }
    if (pair?.pending === this && (pair.a === other || pair.b === other)) {
      pair.pending = null;
    } else {
      const active = this.canClinch(other);
      pair = { a: this, b: other, pending: other, active };
      this.clinchStep = other.clinchStep = pair;
      this.clinching = other.clinching = active;
      if (active) {
        // 마지막 스텝도 실제 차감량이 같다. 부동소수점 잔차는 경계에서만 정리한다.
        const amount = Math.min(STAMINA.clinchPerSecond * dt, this.value - STAMINA.floor, other.value - STAMINA.floor);
        for (const s of [this, other]) {
          s.spend('clinch', amount);
          s.clinchSeconds += amount / STAMINA.clinchPerSecond;
          if (s.value < STAMINA.floor + 1e-9) { s.value = STAMINA.floor; s.stages(); }
        }
        if (this.exhausted || other.exhausted) {
          for (const s of [this, other]) {
            s.clinching = false;
            if (s.fighter.barge) { s.fighter.barge = null; s.fighter.bargeEnd = 'exhausted'; }
          }
        }
      }
    }
    if (!pair.active) return false;
    this.rest = 0;
    this.action = this.exhausted ? 'exhausted' : 'clinch';
    this.stroke = null;
    this.quiet = Infinity;
    return true;
  }

  stages() {
    if (this.exhausted) return;
    if (this.value <= STAMINA.floor) {
      this.value = STAMINA.floor;
      this.exhaustLeft = STAMINA.exhaustSeconds;
      this.level = 3;
      this.counts.exhaustion++;
      this.stroke = null;
      this.action = 'exhausted';
    } else if (this.value < STAMINA.severeAt) this.level = 2; // 심한 지침 −35 아래(사장님 10/17 — 그 전 −40 · 처음 −30)
    else if (this.level === 2 && this.value >= STAMINA.severeAt + STAMINA.stageBack - 1e-9) this.level = 1;
    else if (this.level === 0 && this.value < 0) this.level = 1;
    if (this.level === 1 && this.value >= STAMINA.stageBack - 1e-9) this.level = 0;
  }

  spend(kind, amount) {
    if (!STAMINA.on || this.infinite || this.exhausted || !this.fighter.alive || this.fighter.revival || !(amount > 0)) return false; // 기력 무한: 모든 청구가 여기서 멈춘다 (값 · 쉼 시계 · 단계 그대로)
    this.value = Math.max(STAMINA.floor, this.value - amount);
    this.spent[kind] += amount;
    if (kind !== 'move') this.rest = 0;
    this.action = kind;
    this.stages();
    return true;
  }

  attack(kind = 'cut', bundled = this.inSecret) {
    // 탭 같은 명시 입력은 직전 준비를 끝내고 새 동작 한 번만 청구한다.
    this.finishStroke();
    this.chargeAttack(kind, bundled);
  }

  chargeAttack(kind = 'cut', bundled = this.inSecret) {
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

  /** 첫 걸음 박차기 (우리 본판 gait.js fastBegin — 박찬 걸음을 뗄 때 한 번): pushCost 12, 무게 배율 없음 · 회복 0.6 s 시계를 다시 센다(공격·막아 받기·비기와 같이).
   *  박차기가 걸리는 몸만 부른다 — 독일 뒤(비스듬히 뒤) · 이베리아 옆(비스듬히 옆) · 지금은 플레이어만(GAIT.stepBurst · burstDe). 박찬 걸음의 걸은 거리는 걷기 비용으로 따로 센다 */
  burst() {
    if (!STAMINA.on || this.exhausted) return;
    if (this.spend('push', STAMINA.pushCost)) this.counts.push++;
  }

  /** 접촉 fresh와 별개로 상대 공격 번호당 한 번만 청구한다. 공격 중 칼 충돌은 공격 비용에 포함. */
  block(attacker) {
    if (!STAMINA.on || this.exhausted || this.inSecret || this.clinchStep?.active || !this.fighter.armed) return;
    const other = attacker?.stamina;
    if (!other || !other.attackId || other.time > other.attackUntil) return;
    if (this.attacking && !this.guarding) return;
    if (this.blockedAttack.get(attacker) === other.attackId) return;
    this.blockedAttack.set(attacker, other.attackId);
    if (this.spend('block', STAMINA.blockCost * this.weight)) this.counts.block++;
  }

  commitStroke(stroke, kind = stroke?.kind) {
    if (!stroke || stroke.paid || this.exhausted) return;
    stroke.paid = true;
    this.chargeAttack(kind, false);
  }

  finishStroke() {
    const s = this.stroke;
    if (!s) return;
    if (s.travel >= STAMINA.strokeTravel && !isPreparation(s)) this.commitStroke(s);
    s.until = this.time + 0.35;
    this.strokeTail = s;
    this.stroke = null;
  }

  /** 준비로 보류한 손길도 실제로 칼/몸을 치면 공격이다. 정지한 칼은 이 훅을 부르지 않는다. */
  contactAttack(kind) {
    if (this.fighter.aiControlled || this.guarding || this.inSecret || this.exhausted) return;
    const s = this.stroke ?? (this.time <= this.strokeTail?.until ? this.strokeTail : null);
    if (this.strokeTail?.paid && this.time <= this.strokeTail.until && s && !s.enters && !s.matched) return;
    this.commitStroke(s, kind ?? s?.kind);
  }

  /** 기술 감지의 방향 규칙은 재사용하되, 기력은 준비→실행→회수 단위로 확정한다. */
  observeStroke(dt) {
    const f = this.fighter, sk = f.skill;
    if (f.aiControlled) return;
    if (this.guarding || this.inSecret || sk.tap || sk.pom || sk.recovering || !f.armed || f.weapon?.gun) {
      if (!this.inSecret && !sk.tap && !sk.pom) this.finishStroke();
      else this.stroke = null;
      this.quiet = Infinity;
      this.strokeStart = f.handOffset ? [f.handOffset.x, f.handOffset.y] : null;
      return;
    }
    const at = [f.handOffset?.x ?? 0, f.handOffset?.y ?? 0];
    if (!(sk.inputMotion ? sk.inputSwinging : sk.swinging)) {
      if (this.stroke) {
        this.stroke.travel += Math.hypot(at[0] - this.stroke.end[0], at[1] - this.stroke.end[1]);
        this.stroke.end = at;
      }
      this.quiet += dt;
      if (this.quiet >= STAMINA.strokeQuiet) this.finishStroke();
      this.strokeStart = at;
      return;
    }
    const velocity = sk.inputMotion?.vel ?? sk.vel;
    const vx = velocity.x, vy = velocity.y, n = Math.hypot(vx, vy);
    if (n < 1e-6) return;
    const dir = [vx / n, vy / n];
    const turn = this.stroke ? Math.acos(clamp(dir[0] * this.stroke.dir[0] + dir[1] * this.stroke.dir[1], -1, 1)) * 180 / Math.PI : 180;
    if (!this.stroke || turn > UNIQUE_ASSIST.turnDeg) {
      const start = this.stroke?.end ?? this.strokeStart ?? at;
      this.finishStroke();
      const classified = classifyStroke(start, dir);
      this.stroke = { start, end: start, dir, kind: classified.kind, matched: !!classified.tech,
        enters: entersAttackLine(start, dir), travel: 0, paid: false };
    }
    const s = this.stroke;
    s.travel += Math.hypot(at[0] - s.end[0], at[1] - s.end[1]);
    s.end = at;
    if (s.travel >= STAMINA.strokeTravel && (s.matched || s.enters || s.travel >= 0.9)) this.commitStroke(s);
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
      this.clinching = false; this.clinchStep = null;
      return;
    }
    if (this.infinite) this.refill(); // 기력 무한: 늘 가득 — 아래 길(클린치 짝 셈 · 긋기 확정 · 걸음 셈)은 그대로 돌고 청구만 spend 가 받지 않는다
    // 회복·걷기보다 우선. 이번 스텝 비용으로 탈진했으면 강제 회복은 다음 스텝부터.
    if (this.stepClinch(dt)) {
      if (!this.exhausted) this.pose = Math.max(0, this.pose - dt * 6);
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
    if ((f.aiControlled && this.controller?.phase === 'strike') || (!f.aiControlled && f.skill?.swinging && this.stroke?.paid)) this.attackUntil = this.time + 0.35;
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
        const cost = STAMINA.stepCosts[f.schoolFootwork === false ? 'default' : f.swordArt?.tradition] ?? STAMINA.stepCosts.default; // 유파 걷기 기력은 보법 몫 — 대기실 스킬북 '보법'이 없거나 해제한 플레이어는 보통 1.4
        this.spend('move', steps * cost);
      }
    }
    if (this.exhausted) return;
    const active = Math.max(0, this.rest + dt - STAMINA.recoverDelay) - Math.max(0, this.rest - STAMINA.recoverDelay);
    this.rest += dt;
    if (!this.guarding) {
      const before = this.value;
      const rate = f.aiControlled ? STAMINA.recoverPerSecond : STAMINA.playerRecoverPerSecond;
      this.value = Math.min(this.max, this.value + active * rate);
      this.recovered += this.value - before;
    }
    this.stages();
  }
}

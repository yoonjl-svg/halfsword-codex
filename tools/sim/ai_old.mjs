// ─────────────────────────────────────────────────────────────
//  상대 AI
//  플레이어와 똑같이 "손 목표 위치"와 "이동 방향"만 조종한다.
//  즉 AI도 물리 법칙을 따르므로 반칙(순간이동 칼질)을 하지 않는다.
// ─────────────────────────────────────────────────────────────
import * as THREE from '../../node_modules/three/build/three.module.js';
// 원래(c092081) 난이도 값 그대로
const AI_LEVELS = {
  easy: { reaction: 0.55, windup: 0.9, strikeSpeed: 9, guardChance: 0.25, strength: 0.8, aggression: 0.6, skill: 0.4 },
  normal: { reaction: 0.35, windup: 0.6, strikeSpeed: 13, guardChance: 0.5, strength: 1.0, aggression: 0.8, skill: 0.7 },
  hard: { reaction: 0.2, windup: 0.4, strikeSpeed: 18, guardChance: 0.75, strength: 1.15, aggression: 1.0, skill: 1.0 },
};

// 공격 패턴: 패드 위치 [좌우(+칼 든 쪽), 위아래] 미터. guards.js의 검술 자세 지도로 실제 자세가 된다.
//  준비(windup) 자세에서 공격 끝(strike) 자세로 손을 빠르게 옮기면 그 사이 자세들을 지나며 베기가 된다.
const ATTACKS = [
  { name: 'zornhau', windup: [0.42, 0.42], strike: [-0.4, -0.42] }, // 분노의 베기: 오른쪽 위 → 긴 자세 → 왼쪽 아래
  { name: 'oberhau', windup: [0.02, 0.52], strike: [0.0, -0.45] }, // 위에서 내려베기: 지붕 → 긴 자세 → 바보
  { name: 'zwerch', windup: [0.52, 0.06], strike: [-0.5, 0.06] }, // 가로베기: 옆 자세 → 왼쪽 옆
  { name: 'unterhau', windup: [0.38, -0.44], strike: [-0.3, 0.26] }, // 올려베기: 바꿈 → 왼쪽 황소
  { name: 'stich', windup: [0.18, -0.28], strike: [0.0, 0.03] }, // 찌르기: 쟁기 → 긴 자세 (팔을 쭉 뻗는다)
];
const GUARD = [0.05, 0.45]; // 막기: 칼을 들어 머리를 가린다
const READY = [0.12, -0.18]; // 기본: 긴 자세와 쟁기 사이, 칼끝이 상대를 겨눈다

export class AI {
  constructor(me, foe, levelName = 'normal') {
    this.me = me;
    this.foe = foe;
    this.setLevel(levelName);
    this.phase = 'ready'; // ready | windup | strike | recover | guard
    this.timer = 2.2 + Math.random() * 0.8; // 시작하자마자 달려들지 않고 잠깐 간을 본다
    this.attack = ATTACKS[0];
    this.target = new THREE.Vector2(...READY);
    this.shuffle = 0;
    this.shuffleTimer = 0;
    this.guardDecided = false;
  }

  setLevel(name) {
    this.level = AI_LEVELS[name] || AI_LEVELS.normal;
    this.me.strength = this.level.strength;
    this.me.skill.level = this.level.skill;
  }

  // 상대 칼이 높이 있으면 아래를, 낮으면 위를 노린다 (가끔은 무작위)
  chooseAttack() {
    const foe = this.foe;
    const tipY = foe.bladePoint(1).y;
    const headY = foe.bodies.head.translation().y + 0.1;
    const pick = (names) => {
      const name = names[Math.floor(Math.random() * names.length)];
      return ATTACKS.find((a) => a.name === name);
    };
    if (Math.random() < 0.3) return ATTACKS[Math.floor(Math.random() * ATTACKS.length)];
    if (tipY > headY) return pick(['zwerch', 'stich', 'unterhau']);
    return pick(['zornhau', 'oberhau', 'unterhau']);
  }

  update(dt) {
    const me = this.me;
    const foe = this.foe;
    if (me.state !== 'stand') {
      me.move.set(0, 0);
      this.phase = 'ready';
      this.timer = 0.6;
      return;
    }
    const L = this.level;
    const a = me.bodies.pelvis.translation();
    const b = foe.bodies.pelvis.translation();
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    this.timer -= dt;

    // ── 막기: 플레이어 칼이 빠르게 내 머리 쪽으로 오면 ──
    const foeSwinging = foe.tipVel.length() > 5;
    if (!foeSwinging) this.guardDecided = false;
    if (foeSwinging && !this.guardDecided && this.phase !== 'strike' && foe.alive) {
      this.guardDecided = true;
      const head = me.bodies.head.translation();
      const tip = foe.bladePoint(1);
      const close = Math.hypot(tip.x - head.x, tip.y - head.y, tip.z - head.z) < 1.4;
      if (close && Math.random() < L.guardChance) {
        this.phase = 'guard';
        this.timer = 0.35 + L.reaction;
        this.target.set(...GUARD);
      }
    }

    // ── 공격 흐름 ──
    let handSpeed = 2.2;
    switch (this.phase) {
      case 'ready':
        this.target.set(...READY);
        if (this.timer <= 0 && dist < 2.3 && foe.alive) {
          this.attack = this.chooseAttack();
          this.phase = 'windup';
          this.timer = L.windup * (0.8 + Math.random() * 0.4);
        }
        break;
      case 'windup':
        this.target.set(...this.attack.windup);
        if (this.timer <= 0) {
          this.phase = 'strike';
          this.timer = 0.45;
        }
        break;
      case 'strike': {
        this.target.set(...this.attack.strike);
        // 상대가 옆으로 비껴 있으면 그만큼 손을 옮겨 겨눈다
        const h = foe.bodies.head.translation();
        const c = me.bodies.chest.translation();
        const r = me.right(new THREE.Vector3());
        const lat = (h.x - c.x) * r.x + (h.z - c.z) * r.z;
        this.target.x = THREE.MathUtils.clamp(this.target.x + lat * 0.6, -0.6, 0.6);
        handSpeed = L.strikeSpeed;
        if (this.timer <= 0) {
          this.phase = 'recover';
          this.timer = 0.5;
        }
        break;
      }
      case 'recover':
        this.target.set(...READY);
        if (this.timer <= 0) {
          this.phase = 'ready';
          this.timer = (1.4 - L.aggression) * (0.6 + Math.random());
        }
        break;
      case 'guard':
        this.target.set(...GUARD);
        handSpeed = 4;
        if (this.timer <= 0) {
          this.phase = 'ready';
          this.timer = 0.2 + Math.random() * 0.4;
        }
        break;
    }

    // 손을 목표 쪽으로 제한 속도로 이동 (AI가 순간적으로 칼을 옮기지 못하게)
    const off = me.handOffset;
    const dx = this.target.x - off.x;
    const dy = this.target.y - off.y;
    const d = Math.hypot(dx, dy);
    const stepLen = handSpeed * dt;
    if (d > stepLen) {
      off.x += (dx / d) * stepLen;
      off.y += (dy / d) * stepLen;
    } else {
      off.set(this.target.x, this.target.y);
    }

    // ── 거리 조절 + 옆으로 돌기 ──
    this.shuffleTimer -= dt;
    if (this.shuffleTimer <= 0) {
      this.shuffleTimer = 0.6 + Math.random() * 1.2;
      this.shuffle = (Math.random() - 0.5) * 0.6; // 앞뒤 잔걸음
      this.circle = Math.random() < 0.6 ? (Math.random() < 0.5 ? -0.7 : 0.7) : 0; // 옆걸음
    }
    let fwd = 0;
    // 거리에 비례해 다가가고 물러난다 (빨리 달려들다 상대 칼끝에 찔리지 않게)
    // 평소엔 상대 칼끝이 닿지 않는 거리(간격 밖)에서 간을 보고, 칠 때만 크게 한 걸음 들어갔다가 빠진다
    const want = this.phase === 'strike' || this.phase === 'windup' ? 1.35 : this.phase === 'recover' ? 2.3 : 2.05;
    // 멀면 성큼성큼, 3m 안쪽(상대 칼 간격 근처)에선 조심스럽게 조금씩
    const lunge = this.phase === 'windup' || this.phase === 'strike'; // 칠 때는 크게 내딛는다
    if (dist > want + 0.15) fwd = THREE.MathUtils.clamp((dist - want) * 1.5, 0.2, dist > 3 || lunge ? 1 : 0.45);
    else if (dist < want - 0.3) fwd = -THREE.MathUtils.clamp((want - dist) * 1.5, 0.3, dist < 1 ? 1 : 0.8);
    else fwd = this.shuffle;
    let side = dist < 2.5 && this.phase !== 'strike' ? this.circle || 0 : 0;
    // 몸이 붙으면: 뒤로 빠지면서(= 빈손으로 밀쳐내며, fighter.shove) 옆으로 비켜 선다
    if (dist < 0.9 && this.phase !== 'strike') side = this.circle || 0.7;
    // 울타리에 몰리면 경기장 가운데 쪽으로 옆걸음 친다 (구석에 갇혀 밀리지 않게)
    const rA = Math.hypot(a.x, a.z);
    if (rA > 4.8 && this.phase !== 'strike') {
      const r = me.right(new THREE.Vector3());
      const toCenter = -(a.x * r.x + a.z * r.z) / rA; // 가운데가 내 오른쪽(+)인지 왼쪽(-)인지
      side = Math.sign(toCenter || 1) * THREE.MathUtils.clamp((rA - 4.8) * 1.5, 0.5, 1);
    }
    if (!foe.alive) fwd = side = 0;
    me.move.set(THREE.MathUtils.clamp(side, -1, 1), THREE.MathUtils.clamp(fwd, -1, 1));
  }
}

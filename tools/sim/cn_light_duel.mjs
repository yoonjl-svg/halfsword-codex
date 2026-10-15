// 동방 보법 '가벼운 발' — 실제 판 계기 (10/15 — docs/strike/cn_light_feet_2026-10-15.md §3-C · §3-D): 무기 X(AI) 대 롱소드(AI) 판을 motion_lab.mjs duel 의 'main' 인자와 같은 차림
//  (본판 길 — SKILL.motionLib 그대로 켬 · 인물 꾸러미 SCHOOLS[X] · 씨앗 1000+s(X 가 플레이어 자리)·2000+s(X 가 상대 자리) · 벽 · 보통 난이도 · 40 s 시한)으로 돌려
//  끔(GAIT.cnLight 0)·켬(1 — 기본)을 견준다. 판마다 결정적이고, 같은 씨앗·같은 갈래면 motion_lab duel <X> <N> main 과 같은 판이다(이 도구는 읽기만 — 승패를 함께 찍어 맞춰 봄).
//  잰다(판 하나 = 누가 죽을 때까지 또는 40 s):
//   승·패·무 (X 쪽) · 판 길이 · 걸은 거리 — 걷는 동안 골반 수평 이동(스텝마다 골반 수평 자리 차): 서 있고(stand) 걸음이 '걷는 중'(gait.walking — 걸러진 가려는 빠르기가 걷기 문턱 위)이며
//    기술 걸음(requestStep — gait.req · 떠 있는 발이 'req'·'draw')도 자세 고치기('settle')도 아닐 때만 — 서 있는 동안 흔들림·자세 고치기·기술(공격) 걸음은 뺀다(기력 설계안 §1·§5 의 걷기 비용 잣대)
//    → 분당 m (판 길이 합으로 나눔 — 판마다 분당 m 의 중앙 [10~90 %] 도) · 같은 잣대의 롱소드 쪽 · 걷는 시간 비율
//   클린치 시간 비율 — 두 몸 다 살아 있는 동안 가슴-가슴 거리 < X 의 measure.clinch(청강검 1.04 m), 그리고 근접 밀치기(barge)·누르기(closeW > 0.05)가 어느 쪽에든 켜진 시간
//   X 넘어짐 · X 가 받은 상처 수
//  D — 기력 셈(기력 코드는 없다 — 설계안 docs/design/stamina_2026-10-15.md §1 식만): 걷기 = 0.6 m 마다 1 × 유파 배율 · 베기 = 12 × 무게(√(칼 질량 ÷ 1.60) 을 0.75~1.5 로 자름, 칼 질량 = 런타임 fighter.swordMass) ·
//   회복 15/s(0.6 s 쉰 뒤) — 걷기 비용은 회복을 멈추지 않음. 배율 1 · 0.75 · 0.5(동방 후보)와 일본 1.5 를 이 판에서 잰 분당 걸은 거리로 셈 → 1 대비 아낀(더 쓴) 양을 '분당 베기 몇 번'으로.
//   0 → 80 걸으며 회복 시간(설계안 §4 셈 = 0.6 + 80 ÷ (15 − 빠르기 ÷ 0.6 × 배율)) — 앞 끝 1.8 · 뒤 끝 1.26 · 옆 0.72 m/s(설계안 값) 와 CLD_SPEEDS 로 준 잰 빠르기
//  실행: node tools/sim/cn_light_duel.mjs [무기 qinggang] [자리마다 판 수 24] [갈래 off,on,ai — 기본 셋] (CLD_ROWS=1 → 판마다 줄 · CLD_SPEEDS=앞,뒤,옆 m/s · CLD_JP=일본 분당 m — D 표의 일본 줄)
//   칸 없는 유파(롱소드·우치가타나)는 끔·켬이 같은 판이라 갈래 하나만 돌려도 된다(예: node tools/sim/cn_light_duel.mjs uchigatana 24 off)
//   CLD_SEED0=24 → 씨앗 1025~1048 · 2025~2048 (motion_lab duel 의 DUEL_SEED0 과 같은 뜻 — 새 48 판, 기본 0)
//   갈래 (10/15 동방 AI 걸음 박자 — 문서 §7): off = 가벼운 발 끔(GAIT.cnLight 0) · on = 켬 · AI 고침 끔(cnLight 1 · cnLightAi 0 — 고침 전 판) · ai = 켬 + AI 고침(cnLight 1 · cnLightAi 1 — 기본)
//   공격 거리 (문서 §7 — X 의 AI 가 낸 공격마다, 읽기만): 공격 결심(startAttack) · 칼이 나감(startStrike) 때 가슴-가슴 거리(− X measure.contact) · 그때 AI 가 본 거리 d · contactDist · 정한 내딛기 시간 stepT ·
//    칼이 나간 뒤(그 공격의 afterStrike 까지, 0.8 s 안) 가장 가까운 거리 · cutTime 뒤 거리 · X 가 스스로 들어간 거리(가슴이 칼이 나간 때 상대 쪽으로 간 몫의 가장 큰 값 — 상대 움직임 뺌) · 끝(맞힘·막힘·헛침·끊김)
//    · 간 보기(mode 'watch') 동안 거리 분포(시간 가중 — 판 시작 다가감 · 맞붙은 뒤 나눔) · X 공격 결심·거둠·모드 시간 몫 · 롱소드 칼·맞힘 · CLD_ATK=1 → 공격마다 줄 · CLD_JSON=파일 → 판·칼 날값(묶음 모으기)
//   넘어짐 까닭(X): steady_check.mjs 와 같은 셈(knockDown·applyWound·updateState 를 감싸 적기만) — gauge 휘청임 게이지 · footing 발 디딤 잃음 · tilt 기울기 · head 머리 맞아 주저앉음 · legs · sever
import { newRound, DT, CONFIG, THREE } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { Fighter } from '../../src/fighter.js';
import { WEAPONS } from '../../src/weapons.js';
import { SCHOOLS, CN_AI_FEET } from '../../src/schools.js';
import { wilson } from './corr_lib.mjs';
import { feetEpisodes } from './cn_feet_episodes.mjs';

const { GAIT, BALANCE, BODY } = CONFIG;
if(process.env.CLD_FEET) {
 const values=JSON.parse(process.env.CLD_FEET);
 for(const [key,value] of Object.entries(values)){if(!(key in CN_AI_FEET)||!Number.isFinite(value))throw Error('Invalid CN_AI_FEET override: '+key);CN_AI_FEET[key]=value;}
}
const SEED0 = +process.env.CLD_SEED0 || 0;
const jsonOut = []; // CLD_JSON=파일 → 갈래마다 판·칼 날값 (묶음 넷을 모아 192 판 분포를 셈 — 문서 §7)

// ── 넘어짐 까닭 적기 (steady_check.mjs 와 같은 셈 — 원래 함수를 같은 인자로 부르기만) ──
const _q = new THREE.Quaternion();
const _u = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
function fallTiltOf(f) {
  const r = f.bodies.chest.rotation();
  _u.set(0, 1, 0).applyQuaternion(_q.set(r.x, r.y, r.z, r.w));
  return THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(_u.dot(f.anchorUp || UP), -1, 1))) - THREE.MathUtils.radToDeg(f.hunch || 0);
}
const FP = Fighter.prototype;
const origKD = FP.knockDown;
const origUS = FP.updateState;
const origAW = FP.applyWound;
FP.updateState = function (dt) {
  this._kdCtx = 'state';
  try {
    return origUS.call(this, dt);
  } finally {
    this._kdCtx = null;
  }
};
FP.applyWound = function (h) {
  const c = this._kdCtx;
  this._kdCtx = 'wound';
  try {
    return origAW.call(this, h);
  } finally {
    this._kdCtx = c;
  }
};
FP.knockDown = function (heavy = true) {
  const before = this.state;
  let cause = null;
  if (this._kdLog && (before === 'stand' || (heavy && (before === 'getup' || before === 'kneel')))) {
    const ctx = this._kdCtx;
    if (ctx === 'state') {
      const fl = [];
      if (this.balance <= 0) fl.push('gauge');
      if (this.offBalanceTime > BALANCE.fallDelay) fl.push('footing');
      if (fallTiltOf(this) > BODY.fallTiltDeg) fl.push('tilt');
      if (!fl.length && this.legsCannotSupport) fl.push('legs');
      cause = fl.join('+') || 'state?';
    } else if (ctx === 'wound') cause = this.missingLeg ? 'sever' : 'head';
    else cause = this.legsCannotSupport ? 'legs' : 'other';
  }
  const r = origKD.call(this, heavy);
  if (cause && this.state !== before) this._kdLog.push(cause);
  return r;
};
const [id = 'qinggang', nArg = '24', armArg = 'off,on,ai'] = process.argv.slice(2);
if (!WEAPONS[id]) throw new Error(`무기 없음: ${id}`);
const N = +nArg || 24;
// 갈래: 가벼운 발(cnLight) · 동방 AI 걸음 박자 고침(cnLightAi — 10/15 문서 §7)
const ARM_DEF = { off: { name: 'off', cnLight: 0, cnLightAi: 0, label: '끔 (`GAIT.cnLight=0`)' }, on: { name: 'on', cnLight: 1, cnLightAi: 0, label: '켬 · AI 고침 끔 (`GAIT.cnLightAi=0` — 고침 전 판)' }, ai: { name: 'ai', cnLight: 1, cnLightAi: 1, label: '켬 + AI 고침 (기본)' } };
ARM_DEF.tune={name:'tune',cnLight:1,cnLightAi:0,cnAiTune:1,label:'모든 꼴 가벼운 발 + 판단 보정'};
const ARMS = armArg.split(',').map((a) => ARM_DEF[a]);
if (ARMS.some((a) => a == null)) throw new Error(`갈래는 off,on,ai 가운데: ${armArg}`);
const ROWS = process.env.CLD_ROWS === '1';
const ATK_ROWS = process.env.CLD_ATK === '1';
const CN0 = GAIT.cnLight;
const CNAI0 = GAIT.cnLightAi;
const TUNE0 = GAIT.cnAiTune;
// [시험 갈래 — 게임에 없음] 가벼운 발을 X AI 상태에 따라 켰다 껐다 (CLD_ABL — 켬 갈래에서만, 원인 가르기 · 문서 §7):
//  attack = X AI 가 공격 꼴(준비·다가가기·벰·뒤따름)일 때만 · noattack = 공격 꼴이 아닐 때만(간 보기·막기·물러남) · hurt = X 가 상처를 받은 뒤 0.6 s 동안만 끔 ·
//  nowatch · nodefend · nowithdraw = 그 모드에서만 끔
const ABL = process.env.CLD_ABL || null;
const school = SCHOOLS[id] ? id : 'longsword'; // motion_lab duel 'main' 과 같은 꾸러미 고르기

// 공격 수 (읽기만 — 기력 설계안 '공격 한 번' AI 정의: 기술 하나, 이어 치기도 각자 하나 · 비기 하나): X 의 AI 가 낸 베기·찌르기·비기를 센다 → D 표의 견줄 몫(공격 기력 [셈])
let atk = null;
const SA0 = AI.prototype.startAttack;
AI.prototype.startAttack = function (tech, why, opt) {
  const ok = SA0.call(this, tech, why, opt);
  if (ok && atk && atk.ai === this && this.mode === 'attack' && this.tech === tech) atk[tech.kind === 'thrust' ? 'thrust' : 'cut']++;
  if (ok && atk && atk.yai === this) atk.yWhy[why] = (atk.yWhy[why] ?? 0) + 1; // 롱소드(Y) 공격 까닭 — 동방이 다가갈 때 Y 의 stepin(다가오는 상대 맞받기)이 느나 (문서 §7)
  if (ok && atk && atk.ai === this) {
    atk.dDecide = this.me.foeDistance(); // 공격 결심 때 가슴-가슴 거리 (문서 §7)
    atk.tDecide = atk.t;
    atk.decides++;
  }
  return ok;
};
const SG0 = AI.prototype.secretGo;
AI.prototype.secretGo = function (S, ctx) {
  const ok = SG0.call(this, S, ctx);
  if (ok && atk && atk.ai === this) atk.secret++;
  return ok;
};
// 공격 거리 (읽기만 — 문서 §7): X 의 AI 가 공격을 결심한 때(startAttack)·칼이 나간 때(startStrike) 가슴-가슴 거리, 칼이 나간 뒤 가장 가까운 거리 · X 가 스스로 들어간 거리 · 끝
const SS0 = AI.prototype.startStrike;
AI.prototype.startStrike = function () {
  SS0.call(this);
  if (atk && atk.yai === this) atk.yStrikes++;
  if (!atk || atk.ai !== this) return;
  strikeEnd(atk, 'chain'); // 앞 칼이 afterStrike 없이 이어졌으면(흐름·연환) 그 칼은 거기서 끝
  const X = this.me;
  const c = X.bodies.chest.translation();
  const o = this.foe.bodies.chest.translation();
  const dx = o.x - c.x;
  const dz = o.z - c.z;
  const d0 = Math.hypot(dx, dz);
  atk.cur = { t0: atk.t, d0, dDecide: atk.dDecide, dAI: this.d, cd: this.contactDist(), need: this.need ?? null, contact: this.M.contact, clinch: this.M.clinch, cutTime: this.M.cutTime, myC: this.myClosing, foeC: this.foeClosing, stepT: this.stepT, lag: atk.t - (atk.tDecide ?? atk.t), why: this.why, tech: this.tech?.name, kind: this.tech?.kind, dMin: d0, dCut: null, adv: 0, vMax: 0, cx: c.x, cz: c.z, ux: dx / d0, uz: dz / d0, res: null };
};
const AFS0 = AI.prototype.afterStrike;
AI.prototype.afterStrike = function (d) {
  if (atk && atk.ai === this && atk.cur) strikeEnd(atk, this.hitLanded ? 'hit' : this.bound ? 'bound' : 'miss');
  if (atk && atk.yai === this) atk[this.hitLanded ? 'yHit' : this.bound ? 'yBound' : 'yMiss']++;
  return AFS0.call(this, d);
};
const AB0 = AI.prototype.abortAttack;
AI.prototype.abortAttack = function () {
  if (atk && atk.ai === this) atk.aborts++;
  return AB0.call(this);
};
function strikeEnd(A, res) {
  const r = A.cur;
  if (!r) return;
  r.res = res;
  r.dEnd = A.X.foeDistance();
  A.strikes.push(r);
  A.cur = null;
}
/** 칼이 나간 뒤 스텝마다 (0.8 s 까지 · 공격 꼴을 벗어나면 '끊김') */
function strikeTick(A) {
  const r = A.cur;
  if (!r) return;
  const X = A.X;
  const d = X.foeDistance();
  const dt = A.t - r.t0;
  if (dt <= 0.8) {
    r.dMin = Math.min(r.dMin, d);
    if (r.dCut == null && dt >= r.cutTime - 1e-9) r.dCut = d;
    const c = X.bodies.chest.translation();
    r.adv = Math.max(r.adv, (c.x - r.cx) * r.ux + (c.z - r.cz) * r.uz);
    const v = X.bodies.pelvis.linvel();
    r.vMax = Math.max(r.vMax, v.x * r.ux + v.z * r.uz);
  }
  if (A.ai.mode !== 'attack' || X.state !== 'stand') strikeEnd(A, 'cut');
}

/** 이번 스텝에 걸은 거리로 세나: 서 있고 · 걷는 중 · 기술 걸음·끌어붙임·자세 고치기 아님 */
function walkingNow(F) {
  const g = F.gait;
  if (F.state !== 'stand' || !g?.active || !g.walking || g.req) return false;
  for (const k of ['F', 'B']) {
    const l = g.legs[k];
    if (!l.stance && (l.kind === 'req' || l.kind === 'draw' || l.kind === 'settle')) return false;
  }
  return true;
}
function newTrack(F) {
  const p = F.bodies.pelvis.translation();
  return { F, x: p.x, z: p.z, dist: 0, walkT: 0, path: 0 };
}
function track(T) {
  const p = T.F.bodies.pelvis.translation();
  const ds = Math.hypot(p.x - T.x, p.z - T.z);
  T.x = p.x;
  T.z = p.z;
  if (T.F.state === 'stand') T.path += ds;
  if (walkingNow(T.F)) {
    T.dist += ds;
    T.walkT += DT;
  }
}

function fight(arm, s, xFirst) {
  GAIT.cnLight = arm.cnLight;
  GAIT.cnLightAi = arm.cnLightAi;
  GAIT.cnAiTune = arm.cnAiTune??0;
  const seed = (xFirst ? 1000 : 2000) + s + SEED0;
  const x = { weapon: id, persona: { school } };
  const y = { weapon: 'longsword', persona: { school: 'longsword' } };
  const P = xFirst ? x : y;
  const E = xFirst ? y : x;
  const G = newRound({ walls: true, seed, weapon: P.weapon, weapon2: E.weapon, difficulty: 'normal', persona: E.persona, AI2Class: AI, difficulty2: 'normal', persona2: P.persona });
  const X = xFirst ? G.player : G.enemy;
  const Y = xFirst ? G.enemy : G.player;
  atk = { ai: xFirst ? G.ai2 : G.ai, X: xFirst ? G.player : G.enemy, cut: 0, thrust: 0, secret: 0, t: 0, cur: null, strikes: [], dDecide: null, tDecide: null, watch: [], watchIn: [], wN: 0, wX: [], wY: [], yWhy: {}, appV: [], appIn: [], watchN: 0, watchOff: 0, decides: 0, aborts: 0, yai: xFirst ? G.ai : G.ai2, yStrikes: 0, yHit: 0, yBound: 0, yMiss: 0, modeT: {} };
  X._kdLog = [];
  const episodes=process.env.CLD_EPISODES==='1'?feetEpisodes(atk.ai,G,DT):null;
  const clinch = X.swordArt.measure.clinch;
  const tx = newTrack(X);
  const ty = newTrack(Y);
  let clinchT = 0;
  let closeT = 0;
  let falls = 0;
  let prev = X.state;
  let res = 'D';
  let t = 0;
  let nan = false;
  let hurtT = -1;
  for (let i = 0; i < 40 / DT; i++) {
    if (ABL && arm.cnLight) {
      const m = atk.ai.mode === 'attack';
      const watch=atk.ai.mode==='watch',err=X.foeDistance()-atk.ai.holdDist();
      const shuffle=watch&&Math.abs(err)<.12&&Math.abs(atk.ai.foeClosing)<.3;
      const flee=watch&&!shuffle&&atk.ai.foeClosing>0;
      const hold=watch&&!shuffle&&!flee;
      GAIT.cnLight = ABL === 'noshuffle' ? +!shuffle : ABL === 'noflee' ? +!flee : ABL === 'nohold' ? +!hold : ABL === 'attack' ? (m ? 1 : 0) : ABL === 'noattack' ? (m ? 0 : 1) : ABL === 'hurt' ? (hurtT >= 0 && t - hurtT < 0.6 ? 0 : 1) : ABL.startsWith('no') && atk.ai.mode === ABL.slice(2) ? 0 : 1; // no<모드> = 그 모드(watch·defend·withdraw)에서만 끔
    }
    G.step();
    t += DT;
    episodes?.tick(t);
    atk.t = t;
    strikeTick(atk);
    if (atk.ai.mode === 'watch' && X.state === 'stand' && Y.state === 'stand' && X.alive && Y.alive) (atk.decides > 0 || atk.yStrikes > 0 ? atk.watchIn : atk.watch).push(X.foeDistance()); // 첫 칼(어느 쪽이든 공격 결심·칼) 전 = 판 시작 다가감 · 뒤 = 맞붙은 뒤
    if (X.alive && Y.alive) atk.modeT[atk.ai.mode] = (atk.modeT[atk.ai.mode] ?? 0) + DT;
    if (X.alive && Y.alive && X.state === 'stand' && atk.ai.mode === 'watch') {
      // 간 보는 동안 내 몸이 기울어 있나(X.offBalance > 0.03 — ai.js opportunity '내 상태가 나쁘면 참는다' 문턱: 그동안 공격 결심 점수 − 0.5) (문서 §7)
      atk.watchN++;
      if (X.offBalance > 0.03) atk.watchOff++;
    }
    if (X.alive && Y.alive && X.state === 'stand' && atk.ai.mode === 'attack' && (atk.ai.phase === 'windup' || atk.ai.phase === 'approach')) {
      // 공격 준비·다가가기 동안 X 가 상대 쪽으로 가는 실제 빠르기(골반) — 롱소드 AI 의 'stepin'(다가오는 빠르기 > 0.45 m/s · 상대 reach + 0.3 안) 문턱을 넘나 (문서 §7)
      const a = X.bodies.chest.translation();
      const b = Y.bodies.chest.translation();
      const dd = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const vv = X.bodies.pelvis.linvel();
      atk.appV.push((vv.x * (b.x - a.x) + vv.z * (b.z - a.z)) / dd);
      atk.appIn.push(dd < Y.swordArt.measure.reach + 0.3 ? 1 : 0);
    }
    for (; atk.wN < G.wounds.length; atk.wN++) {
      // 상처마다 (읽기만): 그때 거리 · 맞은 쪽이 상대 쪽으로 다가가던 빠르기(골반) · X AI 모드 — 머리 맞아 주저앉음(머리·목 45 J 넘게)이 왜 느는지 (문서 §7)
      const w = G.wounds[atk.wN];
      const vic = w.vic === X ? X : w.vic === Y ? Y : null;
      if (!vic) continue;
      if (vic === X) hurtT = t; // CLD_ABL=hurt — 상처 받은 때
      const att = vic === X ? Y : X;
      const a = vic.bodies.chest.translation();
      const b = att.bodies.chest.translation();
      const dd = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const vv = vic.bodies.pelvis.linvel();
      const va = att.bodies.pelvis.linvel();
      const attAI = vic === X ? atk.yai : atk.ai;
      (vic === X ? atk.wX : atk.wY).push({ zone: w.zone, E: w.energy, sev: w.severity, d: dd, vin: (vv.x * (b.x - a.x) + vv.z * (b.z - a.z)) / dd, ain: -(va.x * (b.x - a.x) + va.z * (b.z - a.z)) / dd, mode: atk.ai.mode, phase: atk.ai.phase, awhy: attAI.mode === 'attack' ? attAI.why : attAI.mode });
    }
    track(tx);
    track(ty);
    if (prev === 'stand' && (X.state === 'down' || X.state === 'getup')) falls++; // motion_lab duel 넘어짐 계기와 같은 셈
    prev = X.state;
    if (X.alive && Y.alive) {
      if (X.foeDistance() < clinch) clinchT += DT;
      if (X.barge || Y.barge || X.closeW > 0.05 || Y.closeW > 0.05) closeT += DT;
    }
    const v = X.sword.linvel();
    if (![v.x, v.y, v.z].every(Number.isFinite)) {
      nan = true;
      break;
    }
    const xd = X.state === 'dead';
    const yd = Y.state === 'dead';
    if (xd || yd) {
      res = xd && yd ? 'D' : yd ? 'W' : 'L';
      break;
    }
  }
  const got = G.wounds.filter((w) => w.vic === X).length;
  strikeEnd(atk, 'cut');
  const A = atk;
  const episodeData=episodes?.finish();
  atk = null;
  GAIT.cnLight = CN0;
  GAIT.cnLightAi = CNAI0;
  GAIT.cnAiTune = TUNE0;
  return { ...(episodeData?{episodes:episodeData}:{}), seed, xFirst, res, t, nan, xDist: tx.dist, xWalkT: tx.walkT, xPath: tx.path, yDist: ty.dist, clinchT, closeT, falls, got, swordMass: X.swordMass, light: X.gait?.P.light ?? null, clinch, cuts: A.cut, thrusts: A.thrust, secrets: A.secret, kd: X._kdLog, strikes: A.strikes, watch: A.watch, watchIn: A.watchIn, contact: X.swordArt.measure.contact, decides: A.decides, aborts: A.aborts, yStrikes: A.yStrikes, yHit: A.yHit, yBound: A.yBound, yMiss: A.yMiss, modeT: A.modeT, headW: G.wounds.filter((w) => w.vic === X && /head|neck|face/.test(w.zone) && w.severity > 0).length, wX: A.wX, wY: A.wY, yWhy: A.yWhy, watchN: A.watchN, watchOff: A.watchOff, appV: A.appV.filter((_, i) => i % 3 === 0), appIn: A.appIn.filter((_, i) => i % 3 === 0) };
}

const f2 = (v) => (v == null || !Number.isFinite(v) ? '-' : v.toFixed(2));
const f1 = (v) => (v == null || !Number.isFinite(v) ? '-' : v.toFixed(1));
const qOf = (a, p) => {
  const b = a.filter(Number.isFinite).sort((u, v) => u - v);
  if (!b.length) return null;
  const i = (b.length - 1) * p;
  return b[Math.floor(i)] + (b[Math.ceil(i)] - b[Math.floor(i)]) * (i - Math.floor(i));
};
const pctW = (k, n) => {
  const [lo, hi] = wilson(k, n);
  return `${Math.round((100 * k) / n)} % (95 % ${Math.round(100 * lo)}~${Math.round(100 * hi)})`;
};

console.log(`# 가벼운 발 실제 판 — ${id} AI 대 롱소드 AI · 꾸러미 ${school} · 자리마다 ${N} 판 (씨앗 ${1001 + SEED0}~${1000 + N + SEED0} X 플레이어 자리 · ${2001 + SEED0}~${2000 + N + SEED0} X 상대 자리) · 40 s 시한 · motion_lab duel main 과 같은 차림`);
const sums = {};
for (const arm of ARMS) {
  const R = [];
  for (let s = 1; s <= N; s++) for (const xFirst of [true, false]) R.push(fight(arm, s, xFirst));
  const n = R.length;
  const W = R.filter((r) => r.res === 'W').length;
  const L = R.filter((r) => r.res === 'L').length;
  const D = n - W - L;
  const T = R.reduce((a, r) => a + r.t, 0);
  const xd = R.reduce((a, r) => a + r.xDist, 0);
  const yd = R.reduce((a, r) => a + r.yDist, 0);
  const xw = R.reduce((a, r) => a + r.xWalkT, 0);
  const xp = R.reduce((a, r) => a + r.xPath, 0);
  const cl = R.reduce((a, r) => a + r.clinchT, 0);
  const cs = R.reduce((a, r) => a + r.closeT, 0);
  const per = R.map((r) => (r.xDist / r.t) * 60);
  const cuts = R.reduce((a, r) => a + r.cuts, 0);
  const thrusts = R.reduce((a, r) => a + r.thrusts, 0);
  const secrets = R.reduce((a, r) => a + r.secrets, 0);
  sums[arm.name] = { n, W, L, D, T, xPerMin: (xd / T) * 60, yPerMin: (yd / T) * 60, swordMass: R[0].swordMass, light: R[0].light, per, cutPerMin: (cuts / T) * 60, thrustPerMin: (thrusts / T) * 60, secretPerMin: (secrets / T) * 60 };
  const key = R.map((r) => `${r.seed}${r.res}${r.t.toFixed(4)}`).join(',');
  console.log(`\n## ${arm.label} — light ${R[0].light ?? '없음'} · ${n} 판 · 판 열쇠 ${key.length > 0 ? hashOf(key) : '-'}${R.some((r) => r.nan) ? ' · NaN 있음' : ''}\n`);
  console.log(`- 승 ${W} · 패 ${L} · 무 ${D} → X 승률 ${pctW(W, n)} · 패 ${pctW(L, n)} · 판 길이 평균 ${f1(T / n)} s (합 ${f1(T / 60)} 분)`);
  console.log(`- X 걸은 거리(걷는 동안 골반 수평 이동 — 기술 걸음·자세 고치기·서 있는 흔들림 뺌): 합 ${f1(xd)} m → **분당 ${f1((xd / T) * 60)} m** (판마다 분당 중앙 ${f1(qOf(per, 0.5))} [10~90 % ${f1(qOf(per, 0.1))}~${f1(qOf(per, 0.9))}]) · 걷는 시간 ${f1((100 * xw) / T)} % · (참고: 서 있는 동안 골반 길이 전부 분당 ${f1((xp / T) * 60)} m)`);
  console.log(`- 롱소드(Y) 걸은 거리 같은 잣대: 분당 ${f1((yd / T) * 60)} m`);
  console.log(`- 클린치 시간 비율(두 몸 살아 있는 동안 가슴-가슴 < ${f2(R[0].clinch)} m): ${f1((100 * cl) / T)} % · 근접 밀치기·누르기 켜진 시간: ${f1((100 * cs) / T)} %`);
  const kd = {};
  for (const r of R) for (const c of r.kd) kd[c] = (kd[c] ?? 0) + 1;
  console.log(`- X 넘어짐 합 ${R.reduce((a, r) => a + r.falls, 0)} (motion_lab 셈 — 서 있다 down·getup) · 까닭 ${Object.entries(kd).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || '-'} · X 받은 상처 합 ${R.reduce((a, r) => a + r.got, 0)}`);
  console.log(`- X 공격(AI 기술 하나 = 한 번 · 이어 치기도 각자): 베기 분당 ${f1((cuts / T) * 60)} · 찌르기 ${f1((thrusts / T) * 60)} · 비기 ${f2((secrets / T) * 60)}`);
  if (ROWS) for (const r of R) console.log(`  씨앗 ${r.seed} ${r.res} ${f1(r.t)} s · X ${f1(r.xDist)} m (${f1((r.xDist / r.t) * 60)} m/분) · Y ${f1(r.yDist)} m · 클린치 ${f1(r.clinchT)} s · 넘어짐 ${r.falls}`);
  atkReport(R, T);
  if (process.env.CLD_JSON) jsonOut.push({ feet: {...CN_AI_FEET}, arm: arm.name, weapon: id, seed0: SEED0, games: R.map((r) => ({ ...r, kd: r.kd, watch: r.watch.filter((_, i) => i % 6 === 0), watchIn: (r.watchIn ?? []).filter((_, i) => i % 6 === 0), strikes: r.strikes.map((x) => ({ t0: x.t0, d0: x.d0, dDecide: x.dDecide, dAI: x.dAI, cd: x.cd, contact: x.contact, clinch: x.clinch, myC: x.myC, foeC: x.foeC, stepT: x.stepT, lag: x.lag, why: x.why, tech: x.tech, kind: x.kind, dMin: x.dMin, dCut: x.dCut, dEnd: x.dEnd, adv: x.adv, vMax: x.vMax, res: x.res })) })) }); // 묶음 모으기용 (CLD_JSON=파일 — 판·칼마다 날값)
}

/** 공격 거리 (문서 §7): X 의 AI 가 낸 칼마다 — 거리는 가슴-가슴 − X measure.contact (+ = 바깥) */
function atkReport(R, T) {
  const S = R.flatMap((r) => r.strikes);
  const ct = R[0].contact;
  const W0 = R.flatMap((r) => r.watch);
  const W = R.flatMap((r) => r.watchIn ?? []);
  const q3 = (a) => `${f2(qOf(a, 0.5))} [${f2(qOf(a, 0.1))}~${f2(qOf(a, 0.9))}]`;
  const rel = (k) => S.map((x) => x[k] - x.contact);
  const res = {};
  for (const x of S) res[x.res] = (res[x.res] ?? 0) + 1;
  const stepOn = S.filter((x) => x.stepT > 0);
  const kinds = { cut: S.filter((x) => x.kind !== 'thrust').length, thrust: S.filter((x) => x.kind === 'thrust').length };
  console.log(`- 공격 거리 (X 칼 ${S.length} 번 — 분당 ${f1((S.length / T) * 60)} · 베기 ${kinds.cut} · 찌르기 ${kinds.thrust} · contact ${f2(ct)} m · 거리는 가슴-가슴 − contact, 중앙 [10~90 %]):`);
  console.log(`  결심 때 ${q3(S.map((x) => (x.dDecide ?? NaN) - x.contact))} · **칼이 나간 때 ${q3(rel('d0'))}** · 그때 AI 가 본 d ${q3(rel('dAI'))} · contactDist ${q3(rel('cd'))} · 나간 뒤 가장 가까움 ${q3(rel('dMin'))} · cutTime 뒤 ${q3(S.filter((x) => x.dCut != null).map((x) => x.dCut - x.contact))}`);
  console.log(`  X 스스로 들어간 거리 m ${q3(S.map((x) => x.adv))} · 가장 빠른 다가감 m/s ${q3(S.map((x) => x.vMax))} · 그때 내 다가감 myClosing ${q3(S.map((x) => x.myC))} · 정한 내딛기 시간 stepT > 0 ${stepOn.length}/${S.length} (중앙 ${f2(qOf(stepOn.map((x) => x.stepT), 0.5))} s · 0.3 s ${S.filter((x) => x.stepT >= 0.299).length})`);
  const bins = [-Infinity, -0.3, -0.1, 0.1, 0.3, Infinity];
  const hist = (a) => bins.slice(0, -1).map((b, i) => a.filter((v) => v >= b && v < bins[i + 1]).length).join(' · ');
  console.log(`  칼이 나간 때 거리 − contact 칸 (< −0.3 · −0.3~−0.1 · −0.1~+0.1 · +0.1~+0.3 · ≥ +0.3): ${hist(rel('d0'))} · 나간 뒤 가장 가까움 칸: ${hist(rel('dMin'))} · 가장 가까움 < clinch ${S.filter((x) => x.dMin < x.clinch).length}`);
  console.log(`  끝: 맞힘 ${res.hit ?? 0} · 막힘 ${res.bound ?? 0} · 헛침 ${res.miss ?? 0} · 끊김(맞거나 막으러) ${res.cut ?? 0} · 이어짐(흐름·연환) ${res.chain ?? 0} · 맞힘 몫 ${S.length ? Math.round((100 * (res.hit ?? 0)) / S.length) : '-'} %`);
  console.log(`  간 보기 동안 거리 (시간 가중 · 맞붙은 뒤 — 어느 쪽이든 첫 공격 결심·칼 뒤 · ${f1(W.length * DT)} s): ${q3(W)} m (contact 빼면 ${f2(qOf(W, 0.5) - ct)}) · 판 시작 다가감 동안 ${f1(W0.length * DT)} s ${q3(W0)} m`);
  const sum = (k) => R.reduce((a, r) => a + r[k], 0);
  const mT = {};
  for (const r of R) for (const [k, v] of Object.entries(r.modeT)) mT[k] = (mT[k] ?? 0) + v;
  const mTot = Object.values(mT).reduce((a, b) => a + b, 0) || 1;
  console.log(`  X 공격 결심 ${sum('decides')} · 칼이 나감 ${S.length} · 거둠 ${sum('aborts')} (${Math.round((100 * sum('aborts')) / Math.max(1, sum('decides')))} %) · 결심 → 칼 s ${q3(S.filter((x) => x.lag > 0).map((x) => x.lag))} · 모드 시간 몫 ${Object.entries(mT).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round((100 * v) / mTot)} %`).join(' · ')}`);
  console.log(`  롱소드(Y) 칼 ${sum('yStrikes')} (분당 ${f1((sum('yStrikes') / T) * 60)}) · 맞힘 ${sum('yHit')} · 막힘 ${sum('yBound')} · 헛침 ${sum('yMiss')} · X 머리·목 상처(심각도 > 0) ${sum('headW')}`);
  const wx = R.flatMap((r) => r.wX ?? []);
  const wy = R.flatMap((r) => r.wY ?? []);
  if (wx.length || wy.length) {
    const hd = (a) => a.filter((w) => w.zone === 'head' || w.zone === 'neck');
    const big = (a) => hd(a).filter((w) => w.E > 45);
    const md = (a) => {
      const m = {};
      for (const w of a) m[w.mode] = (m[w.mode] ?? 0) + 1;
      return Object.entries(m).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
    };
    console.log(`  X 가 받은 상처 ${wx.length} · 머리·목 ${hd(wx).length} (그 가운데 45 J 넘게 ${big(wx).length} — 주저앉음 문턱) · 머리·목 에너지 J ${q3(hd(wx).map((w) => w.E))} · 그때 거리 − contact ${q3(hd(wx).map((w) => w.d - ct))} · X 가 상대 쪽으로 가던 빠르기 ${q3(hd(wx).map((w) => w.vin))} · 롱소드가 다가오던 빠르기 ${q3(hd(wx).map((w) => w.ain))} · X 모드 ${md(hd(wx))}`);
    console.log(`  45 J 넘은 머리·목 (${big(wx).length}): 거리 − contact ${q3(big(wx).map((w) => w.d - ct))} · X 다가감 ${q3(big(wx).map((w) => w.vin))} · X 모드 ${md(big(wx))} / X 가 준 상처 ${wy.length} · 머리·목 ${hd(wy).length} (45 J 넘게 ${big(wy).length}) · 에너지 J ${q3(hd(wy).map((w) => w.E))}`);
  }
  const by = {};
  for (const x of S) (by[x.why] ??= []).push(x);
  console.log(`  까닭마다 (수 · 칼이 나간 때 − contact 중앙 · 가장 가까움 − contact 중앙 · 맞힘): ${Object.entries(by).sort((a, b) => b[1].length - a[1].length).map(([k, a]) => `${k} ${a.length} · ${f2(qOf(a.map((x) => x.d0 - x.contact), 0.5))} · ${f2(qOf(a.map((x) => x.dMin - x.contact), 0.5))} · ${a.filter((x) => x.res === 'hit').length}`).join(' / ')}`);
  if (ATK_ROWS) for (const x of S) console.log(`  ${f2(x.t0)} ${x.why} ${x.tech} d0 ${f2(x.d0)} dAI ${f2(x.dAI)} cd ${f2(x.cd)} myC ${f2(x.myC)} stepT ${f2(x.stepT)} dMin ${f2(x.dMin)} adv ${f2(x.adv)} ${x.res}`);
}

/** 짧은 열쇠 (판 결과 묶음이 같은지 보기 — 결정적 FNV-1a) */
function hashOf(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ── D: 기력 셈 (설계안 §1 · §4 식) ──
const armD = ARMS.find((a) => a.name === 'ai') ?? ARMS.find((a) => a.cnLight) ?? ARMS[0];
const S = sums[armD.name];
const mass = S.swordMass;
const wt = Math.min(1.5, Math.max(0.75, Math.sqrt(mass / 1.6)));
const cut = 12 * wt;
const perStep = 0.6; // m — 걷기 한 걸음
const regen = 15;
const wait = 0.6;
const ks = S.light ? [1, 0.75, 0.5] : [1, 1.5];
console.log(`\n## D — 기력 셈 (설계안 §1 식 · ${armD.name} 판에서 잰 X 분당 ${f1(S.xPerMin)} m · 칼 질량 ${f2(mass)} kg → 무게 ${f2(wt)} · 베기 ${f2(cut)})\n`);
console.log('| 걷기 배율 | 분당 걷기 기력 | 1 대비 아낀 양 /분 (− = 더 씀) | = 베기 몇 번 /분 | 판 평균 길이(' + f1(S.T / S.n) + ' s) 한 판에 | 0 → 80 회복 앞 끝 1.8 m/s | 뒤 끝 1.26 | 옆 0.72 |');
console.log('|---|---|---|---|---|---|---|---|');
const rec80 = (v, k) => {
  const net = regen - (v / perStep) * k;
  return net > 0 ? wait + 80 / net : Infinity;
};
for (const k of ks) {
  const cost = (S.xPerMin / perStep) * k;
  const save = (S.xPerMin / perStep) * (1 - k);
  const perGame = (save * (S.T / S.n)) / 60;
  console.log(`| ${k} | ${f1(cost)} | ${f1(save)} | ${f2(save / cut)} | ${f1(perGame)} (베기 ${f2(perGame / cut)}) | ${f1(rec80(1.8, k))} s | ${f1(rec80(1.26, k))} s | ${f1(rec80(0.72, k))} s |`);
}
console.log(`- 서 있을 때 0 → 80: ${f1(wait + 80 / regen)} s`);
// 견줄 몫: 같은 판 X 의 공격 기력 [셈 — 베기 12 × 무게 · 찌르기 7 × 무게 · 비기 35, 막아 받기 3 × 무게는 안 셈] · 1 대비 베기 한 번/분을 아끼려면(더 쓰려면) 분당 몇 m 걸어야 하나
const atkCost = S.cutPerMin * cut + S.thrustPerMin * 7 * wt + S.secretPerMin * 35;
const walk1 = S.xPerMin / perStep;
console.log(`- 견줄 몫 [셈]: X 공격 기력 분당 ${f1(atkCost)} (베기 ${f1(S.cutPerMin)} · 찌르기 ${f1(S.thrustPerMin)} · 비기 ${f2(S.secretPerMin)} 번/분 — 막아 받기 뺌) · 걷기(배율 1) ${f1(walk1)} → 걷기 몫 ${f1((100 * walk1) / (walk1 + atkCost))} %`);
for (const k of ks) if (k !== 1) console.log(`- 배율 ${k}: 1 대비 베기 한 번/분 = 분당 ${f1((cut * perStep) / Math.abs(1 - k))} m 걸을 때 (이 판 ${f1(S.xPerMin)} m → ${f2(((S.xPerMin / perStep) * Math.abs(1 - k)) / cut)} 번)`);
if (process.env.CLD_SPEEDS) {
  const [vf, vb, vs] = process.env.CLD_SPEEDS.split(',').map(Number);
  console.log(`- 잰 빠르기(CLD_SPEEDS 앞 ${vf} · 뒤 ${vb} · 옆 ${vs} m/s)로 0 → 80: ${ks.map((k) => `배율 ${k} → ${f1(rec80(vf, k))} · ${f1(rec80(vb, k))} · ${f1(rec80(vs, k))} s`).join(' / ')}`);
}
GAIT.cnLight = CN0;
GAIT.cnLightAi = CNAI0;
  GAIT.cnAiTune = TUNE0;
if (process.env.CLD_JSON) (await import('node:fs')).writeFileSync(process.env.CLD_JSON, JSON.stringify(jsonOut));

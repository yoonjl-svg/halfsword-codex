// 탭 찌르기 검토 지적(8라운드) — 고치기 전·후를 같은 판으로 잰다
//  skill : 검술 보정 0 / 0.4 / 0.7 / 1.0 에서 탭 → 칼끝이 앞으로 나간 거리, 칼끝 최고 속도, 골반이 앞으로 간 거리
//          (롱소드, 쟁기, 간격 2.2, 상대는 칼을 내리고 가만히)
//  step  : 찌르기 무기 AI(에스톡) 대 롱소드 AI, 30초 × 4판 (걸음은 --hybrid 에서만 생긴다)
//          AI 찌르기 수, 검술 층의 내딛기 요청이 받아들여진 수, 그중 AI 가 내딛지 않기로 한 때(stepT 0)의 수,
//          받아들여진 뒤 0.1초 안에 AI 의 걸음 요청에 덮어써진 수
//  down  : 탭 0.08초 뒤 찌르는 사람이 넘어진다 → 넘어진 뒤에도 찌르기 자세(w)가 0.5 넘게 남은 시간
//  assist: 에스톡·레이피어 AI 대 롱소드 AI 30초 × 4판 — 팔·어깨 유효 질량(STRIKE.thrustAssist)이 실린 접촉 중
//          뻗는 구간(겨누기 뒤 ~ 뻗고 버티기 끝) 밖에서 실린 수, 멍으로 바뀐 찌르기의 에너지가 팔 몫(armAssist) 기준의 몇 배로 남았나
//  snap  : 쓰러진 상대를 내리찌르는 중(0.12초) 상대가 일어나기 시작한다 → 찌르기 자세(w)가 한 스텝에 가장 크게 바뀐 폭
// 사용법: node tools/sim/thrust_review.mjs [skill|step|down|assist|demote|snap|all] [--hybrid]
import * as CONFIG from '../../src/config.js';
import { newRound, DT, THREE, AI } from './harness_m.mjs';
import { Skill } from '../../src/skill.js';
import { getWeapon } from '../../src/weapons.js';
import { applyWeaponMeasure } from './weapon_measures.mjs';
import { standTrial, downTrial } from './tap_thrust.mjs';
import { isMain } from './is_main.mjs';

const PFLUG = [0.18, -0.28];

function setHand(f, xy) {
  f.handOffset.set(xy[0], xy[1]);
  f.skill.prev.set(xy[0], xy[1]);
  f.skill.aim.set(xy[0], xy[1]);
  f.skill.aimRaw.set(xy[0], xy[1]);
  f.skill.anchor?.set(xy[0], xy[1]);
  f.skill.aimVel.set(0, 0);
  f.skill.vel.set(0, 0);
  f.skill.follow.set(0, 0);
}
const tipOf = (f) => {
  const p = f.sword.translation();
  const q = f.sword.rotation();
  return new THREE.Vector3(0, f.weaponCfg.hiltLength + f.weaponCfg.bladeLength, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w)).add(new THREE.Vector3(p.x, p.y, p.z));
};

/** 1: 검술 보정별 탭 찌르기 */
export function skillTrial(level) {
  const G = newRound({ walls: false, gap: 2.2, seed: 11, weapon: 'longsword', weapon2: 'longsword', skill: level });
  G.ai.update = () => {};
  const P = G.player;
  setHand(P, PFLUG);
  setHand(G.enemy, [0.0, -0.5]);
  for (let i = 0; i < 2 / DT; i++) {
    P.move.set(0, 0);
    G.step();
  }
  const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(P.yaw);
  const tip0 = tipOf(P);
  const pel0 = P.bodies.pelvis.translation();
  let gain = 0;
  let vPeak = 0;
  let pel = 0;
  const ok = P.skill.thrust();
  for (let i = 0; i < 0.6 / DT; i++) {
    P.move.set(0, 0);
    G.step();
    const tip = tipOf(P);
    gain = Math.max(gain, tip.clone().sub(tip0).dot(fwd));
    const v = P.sword.velocityAtPoint(tip);
    vPeak = Math.max(vPeak, Math.hypot(v.x, v.y, v.z));
    const pp = P.bodies.pelvis.translation();
    pel = Math.max(pel, (pp.x - pel0.x) * fwd.x + (pp.z - pel0.z) * fwd.z);
  }
  return { level, ok, gain, vPeak, pel };
}

// 2·4 공용: 스킬 찌르기 호출 표시 (걸음 요청이 검술 층에서 왔는지 AI 에서 왔는지 가른다)
let inThrust = null;
const origThrust = Skill.prototype.thrust;
Skill.prototype.thrust = function (...a) {
  inThrust = this.f;
  try {
    const ok = origThrust.apply(this, a);
    if (ok) this.f.reviewThrusts = (this.f.reviewThrusts || 0) + 1;
    return ok;
  } finally {
    inThrust = null;
  }
};

function aiDuel(weapon, seed, secs, onStep) {
  const G = newRound({ walls: true, weapon, weapon2: 'longsword', seed, AI2Class: AI });
  applyWeaponMeasure(G.ai2, getWeapon(weapon).id);
  applyWeaponMeasure(G.ai, 'longsword');
  onStep?.(G, 'init');
  for (let i = 0; i < secs / DT; i++) {
    G.step();
    onStep?.(G, 'step');
    if (G.player.state === 'dead' || G.enemy.state === 'dead') break;
  }
  return G;
}

/** 2: AI 두 번 내딛기 */
export function stepReview(runs = 4) {
  const r = { thrusts: 0, skillAcc: 0, skillAccNoStep: 0, overwritten: 0, aiAcc: 0 };
  for (let s = 1; s <= runs; s++) {
    let log;
    aiDuel('estoc', 3000 + s, 30, (G, ph) => {
      if (ph !== 'init') return;
      const F = G.player;
      const ai = G.ai2;
      log = [];
      F.reviewThrusts = 0;
      G.onEnd = () => (r.thrusts += F.reviewThrusts);
      const g = F.gait;
      if (!g?.requestStep) return;
      const orig = g.requestStep.bind(g);
      g.requestStep = (o) => {
        const src = inThrust === F ? 'skill' : 'ai';
        const ok = orig(o);
        log.push({ t: G.t, src, ok, noStep: src === 'skill' ? ai.stepT === 0 : null });
        return ok;
      };
    }).onEnd?.();
    for (const e of log) {
      if (!e.ok) continue;
      if (e.src === 'ai') r.aiAcc++;
      else {
        r.skillAcc++;
        if (e.noStep) r.skillAccNoStep++;
        if (log.some((x) => x.src === 'ai' && x.ok && x.t > e.t && x.t <= e.t + 0.1)) r.overwritten++;
      }
    }
  }
  return r;
}

/** 3: 찌르다 넘어짐 */
export function downReview() {
  const out = [];
  for (const gap of [1.7, 1.9, 2.1]) {
    let knocked = false;
    let wAfter = 0;
    let hiW = 0;
    standTrial({
      gap,
      pad: PFLUG,
      foePad: [0.0, -0.5],
      seed: 77,
      weapon: 'longsword',
      before: (G) => {
        const P = G.player;
        G.before = () => {
          const tp = P.skill.tap;
          if (!knocked && tp && tp.t >= 0.08) {
            P.knockDown(true);
            knocked = true;
          }
          if (knocked && P.state !== 'stand') {
            const w = P.skill.thrustPose.w;
            hiW = Math.max(hiW, w);
            if (w > 0.5) wAfter += DT;
          }
        };
      },
    });
    out.push({ gap, knocked, wAfter, hiW });
  }
  return out;
}

/** 4: 팔 유효 질량이 실리는 구간과 멍으로 바뀐 찌르기의 에너지 */
export function assistReview(runs = 4) {
  const r = { assisted: 0, outside: 0, byPhase: {}, demoted: 0, demotedRatio: [] };
  for (const weapon of ['estoc', 'rapier']) {
    for (let s = 1; s <= runs; s++) {
      aiDuel(weapon, 4000 + s, 30, (G, ph) => {
        if (ph !== 'init') return;
        const C = G.combat;
        const orig = C.analyze.bind(C);
        C.analyze = (pr, point, S, P, predicting = false) => {
          const res = orig(pr, point, S, P, predicting);
          if (predicting || !res) return res;
          const att = pr.w.fighter;
          const assisted = res.mEff > res.mFree + CONFIG.STRIKE.armAssist + 1e-6;
          if (!assisted) return res;
          r.assisted++;
          const tp = att.skill?.tap;
          let phase = 'none';
          if (tp) {
            const K = tp.K;
            phase = tp.t < K.aim ? 'aim' : tp.t < K.aim + K.extend + K.hold ? 'push' : 'recover';
          }
          r.byPhase[phase] = (r.byPhase[phase] || 0) + 1;
          if (phase !== 'push') r.outside++;
          if (res.type === 'blunt') {
            r.demoted++;
            const plain = 0.5 * (res.mFree + CONFIG.STRIKE.armAssist) * res.speed * res.speed * CONFIG.STRIKE.energyScale;
            r.demotedRatio.push(res.energy / plain);
          }
          return res;
        };
      });
    }
  }
  return r;
}

/** 4b: 플레이어 탭(롱소드) 대 서 있는 상대 — 팔 질량을 실은 찌르기가 멍으로 바뀔 때 남은 에너지 */
export function demoteReview() {
  const r = { assisted: 0, demoted: 0, ratio: [] };
  for (const gap of [1.5, 1.7, 1.9, 2.1, 2.3]) {
    for (const [pad, foePad] of [[PFLUG, [0.0, -0.5]], [PFLUG, PFLUG], [[0.22, 0.26], [0.0, -0.5]]]) {
      standTrial({
        gap,
        pad,
        foePad,
        seed: 55,
        weapon: 'longsword',
        before: (G) => {
          const C = G.combat;
          const orig = C.analyze.bind(C);
          C.analyze = (pr, point, S, P, predicting = false) => {
            const res = orig(pr, point, S, P, predicting);
            if (predicting || !res || pr.w.fighter !== G.player) return res;
            // 판정 전 모습: 칼끝 찌르기였나 (예측 판정은 멍으로 바꾸지 않는다)
            const raw = orig(pr, point, S, P, true);
            // 뻗는 구간 (고치기 전 코드에는 thrustPush 가 없어 예전 기준 w > 0.5 로 본다)
            const push = G.player.skill.thrustPush ?? G.player.skill.thrustPose.w > 0.5;
            if (!raw || raw.type !== 'stab' || !push) return res;
            r.assisted++;
            if (res.type === 'blunt') {
              r.demoted++;
              const plain = 0.5 * (res.mFree + CONFIG.STRIKE.armAssist) * res.speed * res.speed * CONFIG.STRIKE.energyScale;
              r.ratio.push(res.energy / (plain * G.player.weaponCfg.power * G.player.weaponCfg.mBlunt));
            }
            return res;
          };
        },
      });
    }
  }
  return r;
}

/** 5: 내리찌르는 중 상대가 일어남 */
export function snapReview() {
  const out = [];
  for (const dist of [0.75, 0.95]) {
    let forced = false;
    let prevW = null;
    let maxJump = 0;
    downTrial({
      dist,
      seed: 91,
      weapon: 'longsword',
      before: (G) => {
        const P = G.player;
        const E = G.enemy;
        G.before = () => {
          const tp = P.skill.tap;
          const w = P.skill.thrustPose.w;
          if (forced && prevW != null) maxJump = Math.max(maxJump, Math.abs(w - prevW));
          prevW = forced ? w : null;
          if (!forced && tp?.down && tp.t >= 0.12) {
            E.downTime = 0;
            E.setState('getup');
            forced = true;
            prevW = w;
          }
        };
      },
    });
    out.push({ dist, forced, maxJump });
  }
  return out;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes('--hybrid')) CONFIG.BODY.weightMode = 'hybrid';
  const mode = args.find((a) => !a.startsWith('--')) || 'all';
  const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
  console.log(`몸무게: ${CONFIG.BODY.weightMode}`);
  if (mode === 'skill' || mode === 'all') {
    console.log('\n[1] 검술 보정별 탭 찌르기 (롱소드, 쟁기, 간격 2.2)');
    for (const L of [0, 0.4, 0.7, 1.0]) {
      const r = skillTrial(L);
      console.log(`  보정 ${L.toFixed(1)}: 시작 ${r.ok ? 'O' : 'X'} · 칼끝 앞으로 ${(r.gain * 100).toFixed(1)}cm · 칼끝 최고 ${f2(r.vPeak)}m/s · 골반 앞으로 ${(r.pel * 100).toFixed(1)}cm`);
    }
  }
  if (mode === 'step' || mode === 'all') {
    const r = stepReview();
    console.log(`\n[2] 에스톡 AI 대 롱소드 AI 30초 × 4판: 찌르기 ${r.thrusts} · 검술 층 내딛기 받아들여짐 ${r.skillAcc} (그중 AI 가 안 내딛기로 한 때 ${r.skillAccNoStep}, 0.1초 안에 AI 걸음에 덮어써짐 ${r.overwritten}) · AI 걸음 받아들여짐 ${r.aiAcc}`);
  }
  if (mode === 'down' || mode === 'all') {
    console.log('\n[3] 탭 0.08초 뒤 넘어짐: 넘어진 뒤 찌르기 자세 w > 0.5 로 남은 시간');
    for (const r of downReview()) console.log(`  간격 ${r.gap}: 넘어짐 ${r.knocked ? 'O' : 'X'} · w>0.5 ${(r.wAfter * 1000).toFixed(0)}ms · 넘어진 뒤 최대 w ${f2(r.hiW)}`);
  }
  if (mode === 'assist' || mode === 'all') {
    const r = assistReview();
    const avg = r.demotedRatio.length ? r.demotedRatio.reduce((a, b) => a + b, 0) / r.demotedRatio.length : NaN;
    console.log(`\n[4] 에스톡·레이피어 AI 30초 × 4판씩: 팔 질량이 실린 접촉 ${r.assisted} · 구간별 ${JSON.stringify(r.byPhase)} · 뻗는 구간 밖 ${r.outside}`);
    console.log(`    멍으로 바뀐 찌르기 ${r.demoted}번 · 남은 에너지 = 팔 몫(armAssist) 기준의 평균 ${f2(avg)}배`);
  }
  if (mode === 'demote' || mode === 'all') {
    const r = demoteReview();
    const avg = r.ratio.length ? r.ratio.reduce((a, b) => a + b, 0) / r.ratio.length : NaN;
    console.log(`\n[4b] 플레이어 탭(롱소드) 대 서 있는 상대 15판: 뻗는 구간의 칼끝 찌르기 접촉 ${r.assisted} · 멍으로 바뀜 ${r.demoted} · 남은 에너지 = 팔 몫 기준의 평균 ${f2(avg)}배`);
  }
  if (mode === 'snap' || mode === 'all') {
    console.log('\n[5] 내리찌르는 중(0.12초) 상대가 일어남: 찌르기 자세 w 가 한 스텝에 바뀐 최대 폭');
    for (const r of snapReview()) console.log(`  거리 ${r.dist}: 일어남 ${r.forced ? 'O' : 'X'} · 최대 폭 ${f2(r.maxJump)}`);
  }
}

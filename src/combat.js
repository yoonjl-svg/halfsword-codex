// ─────────────────────────────────────────────────────────────
//  칼이 몸에 닿는 순간의 물리
//
//  1) 닿은 지점에서 "칼의 그 점"과 "몸의 그 점"의 속도 차이를 구한다.
//  2) 칼이 어떤 모양으로 닿았는지 본다.
//       - 칼끝 쪽으로 곧게 들어가면 → 찌르기
//       - 날 선 쪽이 앞장서면       → 베기
//       - 칼 면이나 손잡이로 닿으면 → 둔기(타박)
//  3) 운동 에너지(J) = ½ × 유효질량 × 속도²  를 부위별 문턱값과 비교해서 상처를 만든다.
//  4) 에너지가 충분하면 칼이 살을 가르고 "지나간다". (충돌 훅으로 튕겨내는 힘을 끄고,
//     칼이 몸 속을 지나는 동안 매 순간 저항(끌림)을 받아 몸이 흡수한 만큼 느려진다.) 모자라면 박히거나 튕긴다.
//
//  유효 질량: 칼은 손을 축으로 도는 강체라서, 칼끝에 닿으면 칼 전체 무게가 실리지 않는다.
//   맞은 점에서 칼이 "밀려나는 정도"로 실제 유효 질량을 계산한다 (강체 역학: 1/m + (r×n)·I⁻¹·(r×n)).
//   실제 롱소드의 칼끝 쪽 유효 질량은 0.3kg 안팎이다. 여기에 팔·몸이 함께 밀어주는 몫을 조금 더한다.
//
//  반작용 (작용·반작용, 운동량 보존)
//   - 칼끼리: 강철 재질(반발 계수, 마찰)로 물리 엔진이 부딪힘을 푼다. 두 칼이 주고받는 충격량은 같은 크기
//     반대 방향이고, 손목 관절을 타고 팔 → 가슴으로 전해진다. 떨어져 있다가 새로 부딪힐 때만 튕기고,
//     맞댄 채 누르는 동안(바인드)엔 튕기지 않는다(떨림 방지). 누르는 힘은 fighter.feel로 알린다.
//   - 투구·뼈: 날이 들지 못한 타격은 칼이 되튄다. 접촉점의 반발 계수 식으로 필요한 충격량을 계산해
//     칼과 맞은 부위에 같은 크기, 반대 방향으로 준다.
// ─────────────────────────────────────────────────────────────
import { TRADITIONS } from './schools.js';
import * as THREE from 'three';
import { beginFlowRecovery } from './nagashi_recovery.js';
import { FLOW_REDESIGN, flowCandidate, spendFlowPenalty, flowShieldKeep } from './nagashi_redesign.js';
import { STRIKE, ANATOMY, STEEL, ARMOR, BIND, VITALS, NAGASHI, SKILL , IB_PARRY_ARM, IB_PARRY_BEAT } from './config.js';
import { BREAK } from './weapons.js';
import { updateGun } from './gun.js';
import { runInstants, artFlash } from './secret_instant.js'; // artFlash: 이점이 터진 순간 잔상 (10/21)
import { FINISH } from './finish.js'; // 마무리 스위치 entry·mode·power (10/12, 기본 끔)
import { lowFinishOn, lowFinishPosture, downLowTarget } from './finish_entry.js';
import { UNIQUE_ASSIST as UA } from './config.js';
import { strokeTechOf, strokeHitK } from './unique_assist.js'; // 강화동작 이점 (10/21): 맞는 순간 지금 기술 이름

/** 발도 충돌 끔 쌍: 서로 다른 싸움꾼이고, 충돌을 끄는 중인 쪽의 칼·칼 쪽 팔·빈팔이 낀 쌍 (팔 ↔ 몸, 칼 ↔ 칼) */
const IAI_GHOST_PARTS = new Set(['uarmS', 'farmS', 'uarmO', 'farmO']);
function iaiGhostPair(a, b) {
  if (!a || !b || a.fighter === b.fighter) return false;
  const g = (x) => x.fighter.instantGhost > 0 && (x.kind === 'weapon' || IAI_GHOST_PARTS.has(x.part));
  return g(a) || g(b);
} // 일본 비기 순간 베기 (10/10 — 물리 원칙의 예외)

// 전투 사건 갈고리 (gun.js GUN_HOOKS 와 같은 식): 비어 있으면 아무 일도 없다. 판정·난수와 무관
//  onDecapitate(f, headBody): 참수된 순간 한 번 (fighter.applyWound, die 뒤) — 사운드 PM 이 소리를 건다
export const COMBAT_HOOKS = { onDecapitate: null, onSever: null }; // onSever(f, kind('elbow'|'shoulder'|'knee'|'hip'), bodies[], parentPart): 팔·다리가 떨어진 순간 한 번 (fighter.sever)

const FINISH_PARTS = new Set(['chest', 'abdomen', 'pelvis', 'head']); // 내려찍기 즉사 부위 (몸통·머리). 부위 이름으로 — 가슴·머리 몸체의 목 쪽도 들어간다
const Y = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const _e = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _n1 = new THREE.Vector3(); // 흘려 받기 (Combat.nagashi)
const _n2 = new THREE.Vector3();
const _n3 = new THREE.Vector3();

/** 강체 상태(p, q, com, v, w)에서 한 점의 속도 */
function velAt(st, point, out) {
  return out.copy(point).sub(st.com).cross(st.w).negate().add(st.v); // v + w × r
}

// ── 와신상담 (월왕구천검 에픽 특수 능력 — 사장님 결정 10/14 '다칠 수록 공격력 증폭 … 최대 30%로 하자') ──
//  무기 스펙에 woundRage(0.3)가 있으면 그 칼의 공격력(등급 power — 판정 에너지 배율)이 × (1 + woundRage × d) 가 된다. d = 칼 주인이 다친 정도(0~1).
//  d 는 쌓이는 손상만 본다 — 아픔(pain)처럼 맞는 순간 튀었다 가라앉는 값은 쓰지 않는다 (맞을 때마다 배율이 출렁이지 않게):
//   d = clamp(max(잃은 피 몫, 상처 몫, 팔다리 몫), 0, 1)
//   · 잃은 피 몫 = (1 − blood) / (1 − VITALS.collapseBlood) — 쓰러지는 문턱(피 0.45)까지 잃으면 1. 피가 없는 몸(병마용)은 blood 가 늘 1 이라 0
//   · 상처 몫    = Σ wounds[].severity ÷ WOUND_RAGE.sevRef — 피가 없는 몸도 오른다 (출혈 없이도 상처는 쌓인다). 잘린 단면 상처(stump)도 센다
//   · 팔다리 몫  = 가장 상한 팔다리의 (1 − limbs[k]) — 상처로 망가지거나(limbs −= 심각도 × 0.7) 잘려 나가면(sever → 0) 그 팔다리 하나로 1
//  d 정의는 사장님 확인 전 (확인표 1447). 기준값 sevRef 4 = 정규화 (사장님 확인 전 — 확인표 1448): 사람 12 판(fights12 조건)에서 살아남은 다친 싸움꾼 13 명의
//   '정해진 잃은 피(1 − blood + bleed ÷ clotting) ÷ 상처 심각도 합' 가운데 0.121 → 피 0.55 를 잃을 상처 합 4.5 (합끼리 나눈 비 0.151 → 3.6) ·
//   죽은 순간의 상처 심각도 합 가운데 4.2 (9 명) — 같은 상처면 피 없는 몸도 사람이 그 상처로 잃을 피 몫과 비슷한 d 가 되게.
//  새 상한·문턱·쿨다운은 없다 (0.3 만 사장님 값). 이 능력이 없는 무기는 계산 자체를 안 한다 (analyze 의 배율 1 — 판이 바이트까지 같다)
export const WOUND_RAGE = { sevRef: 4 };
/** 싸움꾼이 다친 정도 d (0 = 멀쩡 · 1 = 중상). 읽기만 한다 */
export function woundDegree(f) {
  if (!f) return 0;
  const blood = (1 - (f.blood ?? 1)) / (1 - VITALS.collapseBlood);
  let sev = 0;
  for (const w of f.wounds ?? []) sev += w.severity > 0 ? w.severity : 0;
  let limb = 0;
  for (const k in f.limbs ?? {}) limb = Math.max(limb, 1 - f.limbs[k]);
  return THREE.MathUtils.clamp(Math.max(blood, sev / WOUND_RAGE.sevRef, limb), 0, 1);
}
/** 와신상담 배율: 칼(spec.woundRage)이 있으면 1 + woundRage × d, 없으면 1 (디버그 game.woundRage · 시험이 읽는다) */
export function woundRageMult(f) {
  const k = f?.weapon?.woundRage;
  return k ? 1 + k * woundDegree(f) : 1;
}

/** 부위 이름 + 부위 기준 위치 → 해부학적 구역 */
function zoneOf(info, local) {
  if (info.kind === 'head') return local.y < -0.05 ? 'neck' : 'head';
  if (info.kind === 'chest') return local.y > 0.11 ? 'neck' : 'chest';
  return info.kind; // pelvis | arm | leg
}

export class Combat {
  /**
   * @param {object} hooks  { onWound(attacker, victim, result, point), onClash(point, speed, info), onBlocked(...) }
   *   onClash의 info = { fresh(떨어져 있다가 새로 부딪힘), vn(부딪히기 직전 맞닿는 방향 속도 m/s), vt(칼날을 따라 스치던 속도),
   *                      force(누르는 힘 N), impulse(이번 스텝 충격량 N·s), normal(앞 싸움꾼 칼 → 뒤 칼) }
   */
  constructor(colliderInfo, hooks) {
    this.info = colliderInfo;
    this.hooks = hooks;
    this.cutting = new Map(); // "칼콜라이더:몸콜라이더" → { seen, applied, until }
    this.stepNo = 0;
    // 칼끼리 닿아 있는 상태 (소리용): 처음 부딪히는 순간 = "쨍", 맞댄 채 미끄러지는 동안 = 긁히는 소리
    //  last/start = 마지막으로·처음으로 닿은 스텝, slide = 미끄러지는 속도(m/s), press = 누르는 힘(N)
    this.bladeContact = { last: -1e9, start: 0, slide: 0, press: 0 };
    // 칼끼리 닿은 마지막 스텝. 떨어진 지 STEEL.rearmSteps가 지나야 다시 튕길 수 있다
    this.bladeLast = -1e9;
    this.steelArmed = true; // 지금 칼 재질에 반발이 켜져 있는가
    this.touching = new Map(); // "칼콜라이더:몸콜라이더" → 마지막으로 닿은 스텝 (투구·뼈 되튐을 한 번만)
    this.fighters = [...new Set([...colliderInfo.values()].map((i) => i.fighter))];
    // Rapier 물리 훅: 칼과 상대 몸이 부딪히려 할 때마다(매 스텝) 불린다.
    // 여기서는 엔진 함수를 부르면 안 되므로, 스텝 직전에 저장해 둔 값(cacheState)만 쓴다.
    this.physicsHooks = {
      filterContactPair: (c1, c2) => this.filterContactPair(c1, c2),
      filterIntersectionPair: () => true,
    };
  }

  pairOf(c1, c2) {
    const a = this.info.get(c1);
    const b = this.info.get(c2);
    if (!a || !b || a.fighter === b.fighter) return null;
    if (a.fighter.revival || b.fighter.revival) return null; // 부활하는 동안엔 상처를 주고받지 않는다 (revive.js)
    if (a.detached || b.detached) return null; // 잘려 떨어진 팔다리(와 그 손의 칼)는 잔해: 상처를 내지도 받지도 않는다 (fighter.sever)
    // 손에서 놓친(땅에 떨어진) 칼은 부딪히기만 하고 상처를 내지 않는다
    if ((a.kind === 'weapon' && !a.fighter.armed) || (b.kind === 'weapon' && !b.fighter.armed)) return null;
    if (a.kind === 'weapon' && b.kind !== 'weapon') return { w: a, v: b, wc: c1, vc: c2 };
    if (b.kind === 'weapon' && a.kind !== 'weapon') return { w: b, v: a, wc: c2, vc: c1 };
    return null;
  }

  filterContactPair(c1, c2) {
    const pr = this.pairOf(c1, c2);
    if (pr && pr.w.fighter.instantGhost > 0) return 0; // 순간 베기 직후(SECRET.instantNoCollide): 몸 안에 놓인 칼이 튀지 않게 내 칼 ↔ 상대 몸 충돌 끔
    if (!pr && (this.fighters[0]?.instantGhost > 0 || this.fighters[1]?.instantGhost > 0) && iaiGhostPair(this.info.get(c1), this.info.get(c2))) return 0; // 발도(운동학 팔·칼) 동안: 내 칼 ↔ 상대 칼, 내 칼 팔 ↔ 상대 몸·칼 충돌도 끔
    if (!pr || pr.w.part !== 'blade') return 1; // 1 = 평소처럼 부딪힘
    const key = `${pr.wc}:${pr.vc}`;
    let cut = this.cutting.get(key);
    if (cut) {
      cut.seen = this.stepNo;
      return 0; // 0 = 부딪히는 힘 없음 → 칼이 살을 가르고 지나감
    }
    // 아직 안 닿았으면: 지금 속도로 닿는다면 가를 수 있는지 예측
    const res = this.predict(pr);
    if (res && res.pass) {
      this.cutting.set(key, { seen: this.stepNo, applied: false, pr, wc: pr.wc, vc: pr.vc });
      if (pr.w.fighter.skill?.corr === 'v2') pr.w.fighter.bladeTouch = true; // 보정 v2 사건: 닿음 (corr.js)
      return 0;
    }
    return 1;
  }

  /** 스텝 전 저장값으로, 칼날 위에서 몸 부위 중심에 가장 가까운 점을 접촉점으로 가정해 분석 */
  predict(pr) {
    const att = pr.w.fighter;
    const vic = pr.v.fighter;
    if (!att.cache || !vic.cache) return null;
    const S = pr.w.state || att.cache.sword;
    const P = vic.cache.parts[pr.v.part];
    const HL = att.weaponCfg.hiltLength;
    const a = _a.set(0, HL, 0).applyQuaternion(S.q).add(S.p);
    const b = _b.set(0, HL + att.weaponCfg.bladeLength, 0).applyQuaternion(S.q).add(S.p);
    const ab = _c.subVectors(b, a);
    const t = THREE.MathUtils.clamp(_d.subVectors(P.com, a).dot(ab) / ab.lengthSq(), 0, 1);
    const point = _e.copy(a).addScaledVector(ab, t);
    return this.analyze(pr, point, S, P, true);
  }

  /**
   * 핵심 분석. S/P = 칼/부위의 상태 { p, q, com, v, w }
   * @returns {{type, zone, energy, severity, pass, absorb, local, dir, t, helmet, speed}}
   */
  analyze(pr, point, S, P, predicting = false) {
    const att = pr.w.fighter;
    const vBlade = velAt(S, point, new THREE.Vector3());
    const vBody = velAt(P, point, new THREE.Vector3());
    const rel = vBlade.sub(vBody);
    const speed = rel.length();
    if (speed < 0.5) return null;
    // 사람이 휘두르는 칼은 칼끝도 초속 20m 남짓. 그보다 훨씬 빠르면 물리 계산이 튄 것이니 무시한다
    if (speed > 30) return null;
    const dir = rel.clone().divideScalar(speed);

    // 칼 기준 축: y = 칼끝 방향, x = 날 방향, z = 칼 면(납작한 쪽)
    const axis = _a.copy(Y).applyQuaternion(S.q);
    const edge = _b.copy(X).applyQuaternion(S.q);
    const HL = att.weaponCfg.hiltLength;
    const local = point.clone().sub(S.p).applyQuaternion(_q.copy(S.q).invert());
    const t = THREE.MathUtils.clamp((local.y - HL) / att.weaponCfg.bladeLength, 0, 1);
    // 날이 없는 무기(나뭇가지·고무 닭 등)나 부러진 무기는 베기·찌르기 판정 없이 늘 둔기로 친다 (BREAK.stubEdge 면 부러진 토막도 날로 — 효율은 fighter.breakWeapon 이 깎는다)
    const isBlade = pr.w.part === 'blade' && local.y > HL - 0.01 && att.weaponCfg.edged && (!att.weaponBroken || BREAK.stubEdge);

    // 유효 질량: 맞은 점에서의 강체 칼의 실제 유효 질량 + 팔·몸의 도움
    const mFree = freeMass(pr.w.props || pr.w.fighter.swordProps, S, point, dir);
    let mEff = mFree + (pr.w.flexible ? .12 : STRIKE.armAssist);
    let ephys = 0.5 * mEff * speed * speed; // 실제 운동 에너지 (J)
    // 게임 속 판정용 에너지: 실제 에너지 × 보정값. 이 모델의 베는 속도가 실제(칼날 치는 부분 약 20m/s)보다
    // 조금 낮아서, 상처 문턱값(ANATOMY)과 기절·비틀거림 같은 효과가 예전과 같은 세기로 나오게 맞춘 값이다
    // 결정타 (10/9 23:5x — 유파 비기, AI·플레이어 공통): 비기 베기 동안 공격자 secretHit(SECRET.hitMul)를 상처 에너지에 곱한다. 물리(속도·질량)는 그대로, 판정만. 1 이면 그대로
    // 이어 그을수록 강해짐 (이베리아 머리 위 돌려 베기 — 10/21 사장님 '너의 제안대로'): 이어 그은 수 × stack 만큼 같은 자리(판정 에너지)에 곱한다 · 물리는 그대로
    const hk = (att.secretHit ?? 1) * strokeHitK(att);
    let energy = ephys * STRIKE.energyScale * hk;
    let assisted = null; // 찌르기 팔 유효 질량을 실었으면 싣기 전 값 (멍으로 바뀌면 되돌린다)

    let type = 'blunt';
    let quality = 1;
    const along = rel.dot(axis) / speed;
    const ts = att.weaponCfg.thrustStyle; // 찌르기 무기의 찌르기 장점 (weapons.js THRUST_STYLE)
    const win = ts ? ts.window : 0; // 칼끝 판정 폭
    // 가시 무기(weapons.js spike — 모르겐슈테른, 확인표 줄 135): 날은 없지만 머리('blade' 부품) 끝(t > 0.8)이 칼 축 방향으로 들어가면 약한 찌르기(mThrust 0.35).
    //  베기는 없다. 문턱은 아래 기존 식 그대로(살·누비옷 stab × guard; 판금·투구 위는 47/0.35 = 134 J 라 사실상 둔기). 부러지면 가시도 없다.
    //  spike 가 없는 무기는 늘 거짓 → 아래 가지는 예전과 바이트까지 같다
    const spike = !isBlade && pr.w.part === 'blade' && att.weaponCfg.spike && !att.weaponBroken;
    if (isBlade || spike) {
      if (along > STRIKE.stabAlign - win && t > 0.8 - win) {
        type = 'stab';
        // 칼끝 찌르기 동작(skill.js thrust: 탭 찌르기, 찌르기 무기 AI 의 찌르기 기술)에서 칼끝을 뻗는 구간(thrustPush:
        //  겨눈 뒤 ~ 뻗고 버티기 끝)에는 팔을 곧게 뻗어 칼 축으로 민다 → 팔·어깨 무게가 칼끝 뒤에 함께 실린다.
        //  겨누며 당기는 동안·자세로 돌아오는 동안·넘어진 뒤는 아니다. 그 밖의 칼 축 방향 접촉(자세 지도를 따라 칼을 돌리다
        //  닿은 것)은 예전 그대로. 칼끝이 들어가지 못해 멍으로 바뀌면 이 몫을 빼고 원래 에너지로 돌린다(아래)
        if (att.skill?.thrustPush && (att.state === 'stand' || att.state === 'kneel')) {
          assisted = { mEff, ephys, energy };
          mEff = mFree + STRIKE.thrustAssist;
          ephys = 0.5 * mEff * speed * speed;
          energy = ephys * STRIKE.energyScale * hk;
        }
      } else if (isBlade) {
        const perp = rel.clone().addScaledVector(axis, -rel.dot(axis));
        const pl = perp.length();
        const edgeAlign = pl > 1e-3 ? Math.abs(perp.dot(edge)) / pl : 0;
        if (edgeAlign > STRIKE.edgeAlign) {
          type = 'cut';
          quality = (edgeAlign - STRIKE.edgeAlign) / (1 - STRIKE.edgeAlign); // 날이 똑바로 설수록 잘 베인다
          quality = 0.4 + 0.6 * quality;
          // 칼날 길이 방향으로 미끄러지며 벨수록(당겨 베기) 잘 들고, 칼날 손잡이 쪽은 덜 든다
        }
      }
    }

    // 맞은 곳
    const vicLocal = point.clone().sub(P.p).applyQuaternion(_q.copy(P.q).invert());
    const zone = zoneOf(pr.v, vicLocal);
    const vic = pr.v.fighter;
    // 사장님 결정 (9/30 "맞으면 즉사로"): 탭 마무리 찌르기가 내리찍는 동안(skill.tap.down·go, thrustPush = 끝나기 전)
    //  칼끝이 칼 축으로(찌르기) 쓰러진 상대의 몸통(가슴·배·골반)·머리에 닿으면 즉사 (fighter.applyWound).
    //  옷·살 문턱은 이것을 막지 못한다 — 아래 문턱은 상처 깊이와 관통(pass: 물리로 튕기나 가르나)만 정한다.
    //  판금·투구는 막는다 (사장님 10/1 21:45, C 를 확률 아닌 물리로): 판·투구 위에 닿아 문턱을 못 넘으면 finish 를 끄고 멍으로 보낸다 — 판금 상대는
    //  finish.js 가 겨눔 점을 목(갑옷 없는 틈)으로 옮기고(10/12 부터 FINISH.plateNeck 일 때만 — 기본은 판금도 몸통 선), 들어가느냐는 물리가 정한다. 갑옷 무시 무기(ignoreArmor)는 예전처럼 막히지 않는다.
    //  걸리지 않는 것: 서 있는·무릎 꿇은·일어나는 상대 (vic.state) · 보통 탭 찌르기 (tap.down) · 겨누는 중·걷는 중 (go) ·
    //  찍기가 끝난 뒤·돌아오는 중 (thrustPush) · 자세 지도로 친 내려찍기·AI 내려베기 (tap 없음) · 베기·둔기·날 없는 무기 (stab) ·
    //  팔다리 (부위) · 내가 넘어졌을 때 (att.state) · 다른 상대 (att.foe). 판단만 한다 — 예측(predicting)·측정 도구가 불러도 부작용 없음
    const tp = att.skill?.tap;
    // 낮은 상대 진입(FINISH.entry 'low', 기본 끔): 'down' 이름 대신 시작한 그 상대의 실제 몸 높이 (예측 중엔 스텝 전 저장값만 — 엔진을 부르지 않는다)
    const finishTarget = lowFinishOn(FINISH) ? tp?.foe === vic && !tp.abort && !tp.ended && lowFinishPosture(att, vic, true, predicting) : downLowTarget(FINISH, att, vic, true, predicting);
    let finish = type === 'stab' && !!tp?.down && !!tp.go && !!att.skill.thrustPush && (att.state === 'stand' || att.state === 'kneel') && vic === att.foe && finishTarget && FINISH_PARTS.has(pr.v.part);
    // 즉사 대신 힘 (FINISH.mode 'power25', 기본 끔 — 샛별 저장소 7fd7f592): 찍기 찌르기는 즉사 표시(finish)를 끄고, 판정 에너지에 FINISH.power 를 곱해
    //  갑옷·옷·살 문턱을 그대로 거친다. 문턱을 못 넘으면 보통처럼 멍(판금·투구가 막음). 치명상(목·머리)으로 죽으면 부활 없음(fighter.applyWound)
    const finishPower = finish && FINISH.mode === 'power25';
    if (finishPower) finish = false;
    // 기본 투구는 눈썹 위, 닫힌 투구는 종류별 coverMinY까지. 기존 종류의 범위는 그대로.
    const helmet = zone === 'head' && vic.hasHelmet && vicLocal.y > (vic.helmetSpec?.coverMinY ?? -0.01);
    const hs = helmet ? vic.helmetSpec || ARMOR.helmets.kettle : null;
    // ignoreArmor 무기(라이트세이버 '고온 플라스마: 갑옷 무시', 사장님 확정)는 모든 투구를 무시한다: 맨머리 판정(투구는 베여 닳기만 한다).
    //  (예전엔 플레이어 케틀햇만 빼서 라이트세이버가 케틀햇 문턱 200 J 를 그대로 받았다 — 주석 의도와 반대였다. 디렉터 12:38)
    const helmOn = helmet && !att.weaponCfg.ignoreArmor && !att.weaponCfg.ignoreArmorDamage; // ignoreArmorDamage(모르겐슈테른): 투구가 판정에서 막아주지 않는다(둔타 k = 1, 문턱 맨머리) — 벗김·닳음·물리는 그대로
    const A = helmOn ? { ...ANATOMY.head, ...hs } : ANATOMY[zone];
    // 판금(ARMOR.on, look.armor === 'plate'): 그 부위 판이 남아 있고 맞은 곳을 판이 덮었으면(팔다리는 판이 붙은 자리만).
    //  목(가슴 윗부분)은 덮지 않는다
    const body = zone !== 'head' && zone !== 'neck';
    const plate = !helmet && body && !!vic.platedAt?.(pr.v.part, vicLocal);
    // 막아주는 정도: 투구·판금은 찌그러질수록, 옷은 찢어질수록 약해진다
    let guard = 1;
    let helmetBlunt = 1;
    let plateBlunt = 1; // 판금 위 둔타가 판을 '통해' 몸에 전해지는 비율 (ARMOR.plate.blunt, 투구 helmet.blunt 와 같은 꼴. 확인표 줄 140 — 부위 효과표(줄 141, R3)만 읽는다)
    let plateGuard = 0; // 판금의 막음 비율 (0 = 판 없음). 문턱은 아래에서 누비옷 문턱과 큰 쪽을 쓴다
    if (helmOn) {
      const hi = vic.helmetIntegrity;
      guard = hs.guardMin + (1 - hs.guardMin) * armorHold(hs, hi);
      helmetBlunt = hs.blunt + (1 - hs.blunt) * (1 - hi);
    } else if (body) {
      guard = 0.55 + 0.45 * (vic.cloth[pr.v.part] ?? 1);
      if (plate) plateGuard = ARMOR.plate.guardMin + (1 - ARMOR.plate.guardMin) * armorHold(ARMOR.plate, vic.plate[pr.v.part]);
      if (plate) plateBlunt = ARMOR.plate.blunt + (1 - ARMOR.plate.blunt) * (1 - vic.plate[pr.v.part]); // 찌그러질수록 더 전해진다 (투구 식과 같음)
      // 팔다리 판(견갑·팔 통판·손목 보호대·허벅지 판·정강이받이·쇠신)은 몸통 판보다 얇다: 문턱 × ARMOR.plate.limb
      if (plate && (zone === 'arm' || zone === 'leg')) plateGuard *= ARMOR.plate.limb;
    }
    let gapV = 0; // 찌르기가 틈을 파고드는 값 (아래 — 무기 THRUST_STYLE gap · 강화동작)
    if (att.weaponCfg.ignoreArmor) (guard = 1), (plateGuard = 0); // 라이트세이버 등: 갑옷·투구가 막아주지 않는다
    else if (att.weaponCfg.ignoreArmorDamage) plateGuard = 0; // 모르겐슈테른: 판금은 막아주지 않되 누비옷(guard)은 그대로
    // 찌르기 무기의 찌르기는 옷·투구의 틈을 파고든다: 옷이 막아주는 몫(0.55 위)의 gap 비율, 투구·판금은 gap 의 절반을 무시한다
    else if (type === 'stab' && (gapV = strokeTechOf(att) === 'imbroccata' ? Math.max(ts?.gap ?? 0, UA.imbroccataGap ?? 0) : ts?.gap)) {
      // 위에서 내려 찌르기(이탈리아 강화동작 — 10/21 사장님 '파고드는 값 0.6'): 이 찌르기만 gap 을 UA.imbroccataGap 으로 (다른 찌르기 · 다른 무기는 그대로)
      if (helmOn) guard *= 1 - 0.5 * gapV;
      else if (body) {
        guard -= gapV * Math.max(0, guard - 0.55);
        plateGuard *= 1 - 0.5 * gapV;
      }
    }

    // 감정 고유 능력(emotions.js 배율표, fighter.emoMods): 주는 쪽의 dealt, 받는 쪽의 taken, 관통 문턱은 둘의 pass 합.
    //  감정이 없으면 전부 1·0 이라 예전과 같다
    const am = att.emoMods;
    const vm = pr.v.fighter?.emoMods;
    const emoDealt = am?.dealt ?? 1;
    const emoTaken = vm?.taken ?? 1;
    const emoPass = (am?.pass ?? 0) + (vm?.pass ?? 0);
    // 와신상담 (월왕구천검 — 위 WOUND_RAGE): 칼 주인이 다칠수록 이 칼의 공격력 × (1 + woundRage × d). 능력 없는 무기는 1 이고 계산도 안 한다
    //  (power × 1 은 power 그대로라 다른 무기·사람 판은 바이트까지 같다). 물리(속도·질량)는 그대로, 판정 에너지에만 — 등급 power 와 같은 자리
    const rage = att.weapon?.woundRage ? woundRageMult(att) : 1;
    const power = att.weaponCfg.power * rage;
    let severity = 0;
    let pass = false;
    let thr = null; // 날이 들기 시작하는 문턱(J) — 측정 도구(weapon_anatomy.mjs, armor_eval.mjs)도 읽는다
    let eff = null; // 문턱과 견주는 실효 에너지(J)
    if (type === 'cut' || type === 'stab') {
      const wMult = power * (type === 'cut' ? att.weaponCfg.mCut : att.weaponCfg.mThrust); // 등급 배율(와신상담이면 그 배율까지) × 무기별 베기/찌르기 배율
      thr = (type === 'cut' ? A.cut : A.stab) * guard;
      // 판금: 강철판 문턱 × 판의 막음. 판 밑 누비옷보다 약해지지는 않는다 (큰 쪽)
      if (plateGuard > 0) thr = Math.max(thr, (type === 'cut' ? ARMOR.plate.cut : ARMOR.plate.stab) * plateGuard);
      // 투구: 찌그러지고 틈을 파고들어도 맨머리보다 약해지지는 않는다 (케틀햇은 가장 약할 때도 맨머리보다 세서 그대로)
      if (helmet) thr = Math.max(thr, type === 'cut' ? ANATOMY.head.cut : ANATOMY.head.stab);
      eff = energy * quality * wMult * emoDealt * emoTaken;
      if (finishPower) eff *= FINISH.power; // 찍기 힘 배율 (상한 없음 — 사장님 확인 전, 확인표 958). 무기 속도·질량은 그대로, 판정 에너지에만 한 번
      if (eff > thr) {
        severity = (eff - thr) / (type === 'cut' ? 90 : 60);
        pass = eff > thr * (1.25 - emoPass); // 확실히 파고들 때만 튕기지 않고 가르고 들어간다 (집념·분노면 더 쉽게 가른다)
        // 동방 막는 동안 피해 감소 (10/17 연구 — SKILL.cnParryDmgCut, 판 값 0 = 끔 · docs/strike/chinese_parry_brace_2026-10-17.md): 받는 쪽이 동방 막기 책을 쥐고
        //  막기 단추로 막는 중(parry_button.js woundKeep)이면 이 칼날 상처의 심각도만 × (1 − cut). 팔다리 기능 · 피 흘림 · 의식 · 목/머리 죽음 문턱 · 절단이 모두
        //  심각도에서 나와(fighter.applyWound) 같이 준다. 에너지 · 가르나 튕기나(pass) · 박힘은 그대로 — 칼과 몸의 물리(충격 · 휘청임 · 투구/판 닳음)는 바뀌지 않는다
        //  일본 · 이베리아도 같은 칸으로 × (1 − 0.2) (사장님 10/18 22:1x — SKILL.jpParryDmgCut · ibParryDmgCut)
        if (vic.parryGuard?.woundKeep) severity *= vic.parryGuard.woundKeep();
      } else {
        const armorBlocks = finish && (plate || helmet) && !att.weaponCfg.ignoreArmor && !att.weaponCfg.ignoreArmorDamage;
        if (armorBlocks) finish = false; // 판금·투구가 내려찍기를 막았다 (사장님 10/1 C): 즉사 없음, 칼은 물리로 튕긴다.
        //  예측 경로(predicting)도 같게 — 10/7 S-016: 예측만 이 분기를 건너뛰어 판금에 막힐 찍기를 즉사로 읽던 결함(마무리 도구 판금 칸 45/45 불일치)
        if (!predicting && (!finish || armorBlocks)) {
          type = 'blunt'; // 날이 들지 못했으면 멍만 든다 (맨몸 내려찍기 즉사 찌르기는 찌르기 그대로 — 옷·살 문턱에 막혀도.
          //  판·옷·소리는 심각도 0 이라 막힌 타격으로 적힌다: fighter.applyWound·main.js onWound)
          // 칼끝이 들어가지 못한 찌르기에는 팔 유효 질량을 싣지 않는다 (아픔·비틀거림·옷·투구·기절이 부풀지 않게)
          if (assisted) ({ mEff, ephys, energy } = assisted);
        }
      }
    }
    if (type === 'blunt') energy *= power * att.weaponCfg.mBlunt * emoDealt * emoTaken;
    // 흘린 공격의 피해 감소 (사장님 10/18 23:4x '흘린 공격의 피해 80% 줄여' — config FLOW_REDESIGN.flowDmgCut): 받는 쪽이 이 칼 주인의 지금 공격(번호)을 흘렸으면
    //  그 공격의 칼날 상처 심각도 · 둔타 에너지 × (1 − flowDmgCut). 새 공격(번호가 바뀜)부터는 그대로 · 물리(충격 · 가르나 튕기나)는 그대로
    const keepFlow = flowShieldKeep(pr.v.fighter, att);
    if (keepFlow !== 1) { if (type === 'blunt') energy *= keepFlow; else severity *= keepFlow; }
    // 이탈리아 막아찌르기(10/21 입력형 — 약한 찌르기): 찌르는 동안 주는 칼날 상처 심각도 · 둔타 에너지 × dealt(0.6). 물리는 그대로
    const oppK = att.parryGuard?.opposition?.dealtK?.() ?? 1;
    if (oppK !== 1) { if (type === 'blunt') energy *= oppK; else severity *= oppK; }
    // 무기 비검 (10/21 — weapons.js secretBlade, 모노호시자오: 츠바메가에시 되돌려 올려 벤 칼 피해 × k): 그 기술을 긋는 중이고 칼이 위로 움직일 때만
    const SB = att.weapon?.secretBlade;
    if (SB && dir.y > SB.upY && strokeTechOf(att) === SB.tech) { if (type === 'blunt') energy *= SB.k; else severity *= SB.k; }
    return {
      type,
      zone,
      energy,
      ephys,
      mFree,
      severity,
      pass,
      absorb: A.absorb ?? 100,
      bleedPerSev: (ANATOMY[zone] || ANATOMY.chest).bleed * (att.weapon?.bleedMult ?? 1) * (UA.yaojiBleed?.k > 0 && UA.yaojiBleed.zones.includes(zone) && strokeTechOf(att) === 'yaoji' ? UA.yaojiBleed.k : 1), // 모노호시자오 '제비 베기': 출혈 배율 · 요격 몸통 깊은 출혈(10/21 UA.yaojiBleed)
      local: vicLocal,
      point: point.clone(),
      dir,
      speed,
      mEff,
      t,
      helmet,
      helmetBlunt,
      plate, // 판금 위를 맞았나 (fighter.applyWound 가 판을 깎고, 겉모습·소리는 강철로)
      plateBlunt, // 판을 통해 몸에 전해지는 둔기 비율 (판 없으면 1). 지금 게임은 읽지 않는다 — 둔타 효과표 시제품(tools/sim/blunt_zones.mjs)·R3 몫
      thr,
      eff,
      bladeAxis: axis.clone(),
      finish, // 내려찍기 즉사 (사장님 결정 9/30, fighter.applyWound)
      ...(finishPower ? { finishPower: FINISH.power } : {}), // 즉사 대신 힘으로 들어간 찍기 (FINISH.mode 'power25' 때만 붙는다)
      ...(att.weapon?.woundRage ? { woundRage: rage } : {}), // 와신상담 배율 (그 능력이 있는 칼만 붙는다 — 시험·디버그가 읽는다)
    };
  }

  /** 매 물리 스텝 직후: 가르고 있는 칼 처리 + 일반 충돌(튕김) 처리 */
  afterStep(world, eventQueue) {
    this.stepNo++;
    // 1) 가르고 지나가는 칼: 몸 속을 지나는 동안 매 순간 저항을 받는다
    const dt = world.timestep;
    this.dt = dt;
    for (const [key, c] of this.cutting) {
      if (this.stepNo - c.seen > 2 && !(c.stuckT > 0)) {
        this.cutting.delete(key); // 더 이상 겹치지 않음
        continue;
      }
      if (c.pr.w.fighter.skill?.corr === 'v2') c.pr.w.fighter.touchStep = this.stepNo; // 보정 v2: 아직 가르는 중 = 닿아 있음
      const col1 = world.getCollider(c.wc);
      const col2 = world.getCollider(c.vc);
      let point = null;
      world.contactPair(col1, col2, (m, flipped) => {
        for (let i = 0; i < m.numContacts() && !point; i++) {
          if (m.contactDist(i) < 0.004) {
            // flipped면 엔진 쪽 순서가 뒤집혀 있어서, col1 기준 점은 두 번째 점이다
            const lp = flipped ? m.localContactPoint2(i) : m.localContactPoint1(i);
            if (lp) point = new THREE.Vector3(lp.x, lp.y, lp.z).applyQuaternion(rotQ(col1)).add(tv(col1.translation()));
          }
        }
      });
      const sw = c.pr.w.body;
      const vb = c.pr.v.body;
      if (!c.applied) {
        if (!point) continue; // 아직 실제로 닿지 않음 (가까이만 옴)
        c.applied = true;
        const r = this.strike(c.pr, point, true); // 상처는 처음 닿는 순간에 한 번
        // 몸이 흡수할 실제 에너지 (판정용 보정 전 값)
        c.Eleft = r ? Math.min(r.energy, r.absorb) / STRIKE.energyScale : 0;
        c.stuck = r ? r.stuck : false;
        c.mFree = r ? r.mFree : 0.3;
        c.stuckT = 0;
        c.localPt = point.clone().sub(tv(sw.translation())).applyQuaternion(rotQ(sw).invert());
      }
      // 박힌 칼은 닿은 자리에 붙잡아 둔다
      if (!point && c.stuckT > 0) point = c.localPt.clone().applyQuaternion(rotQ(sw)).add(tv(sw.translation()));
      if (!point) continue;
      const va = sw.velocityAtPoint(vp(point));
      const vv = vb.velocityAtPoint(vp(point));
      const rel = _e.set(va.x - vv.x, va.y - vv.y, va.z - vv.z);
      const s = rel.length();
      if (s < 1e-3) continue;
      const dir = rel.divideScalar(s);
      let J = 0;
      let inDrag = false;
      if (c.Eleft > 0) {
        inDrag = true;
        // 끌림: 이번 순간에 흡수하는 에너지 = min(남은 에너지, c·속도²·dt). 한 순간에 속도를 크게 꺾지는 않는다
        const Estep = Math.min(c.Eleft, STRIKE.dragC * s * s * dt);
        J = Math.min(Estep / s, STRIKE.dragCap * c.mFree * s);
        c.Eleft -= J * s;
        if (c.Eleft <= 1e-3 && c.stuck) c.stuckT = STRIKE.stuckTime;
      } else if (c.stuckT > 0) {
        // 박힘: 칼과 몸이 함께 움직이도록 붙잡는다 (빼내려면 힘이 든다)
        J = Math.min(Math.min(STRIKE.stuckDamp * s, STRIKE.stuckForce) * dt, 0.8 * (c.mFree + STRIKE.armAssist) * s);
        c.stuckT -= dt;
        c.seen = this.stepNo;
      }
      if (J > 0) {
        // 칼에는 칼날 중심선 위에 건다 (날 끝에 걸면 칼이 길이 방향으로 팽이처럼 돈다)
        const ax = _a.set(0, 1, 0).applyQuaternion(rotQ(sw));
        const o = tv(sw.translation());
        const pA = o.clone().addScaledVector(ax, _b.copy(point).sub(o).dot(ax));
        // 몸 쪽 반작용 (STRIKE.cutReact, 사장님 결정 10/8 02:15 same): legacy = 0.8·J 를 뼈 중심선 점에(9/26 이전부터, 근거 기록 없음) · full = J 를 뼈 점에 · same = J 를 칼과 같은 점에(작용·반작용 그대로)
        const mode = STRIKE.cutReact || 'legacy';
        const kv = mode === 'legacy' ? 0.8 : 1;
        const pv = mode === 'same' ? pA : onBone(c.pr.v, point);
        if (mode === 'same') {
          // 끌림은 미는 힘이지 튕기는 힘이 아니다: 한 스텝의 충격량이 닿은 점의 상대 속도를 뒤집지 못하게 한다 — 두 강체의 그 점·그 방향 유효 질량으로
          //  J ≤ s / (1/m_칼 + 1/m_부위). 얇은 팔(축 둘레 관성이 작다)에 겉면 점으로 주면 이 상한 없이는 팔이 팽이처럼 돈다(10/8 측정: 접촉 뒤 |ω| p90 86 rad/s).
          //  덜 흡수한 에너지는 남겨 다음 스텝에 마저 흡수한다 (총 흡수 에너지는 같다)
          const att = c.pr.w.fighter;
          const mB = att.swordProps ? gripMass(att.swordProps, liveState(sw), pA, dir, STEEL.handMass) : c.mFree + STRIKE.armAssist;
          const mV = bodyMass(vb, pA, dir);
          const Jcap = s / (1 / mB + 1 / mV);
          if (J > Jcap) {
            if (inDrag) c.Eleft += (J - Jcap) * s;
            J = Jcap;
          }
        }
        sw.applyImpulseAtPoint({ x: -dir.x * J, y: -dir.y * J, z: -dir.z * J }, vp(pA), true);
        vb.applyImpulseAtPoint({ x: dir.x * J * kv, y: dir.y * J * kv, z: dir.z * J * kv }, vp(pv), true);
        if (globalThis.__cutLog) { // 측정용(도구만 켠다): 접촉별 몫 — 칼 충격량 합, 몸 부위 속도 변화
          if (!c.log) { const v = vb.linvel(), w = vb.angvel(), vs = sw.linvel(); c.log = { who: c.pr.v.fighter.name, part: c.pr.v.part, v0: [v.x, v.y, v.z], w0: [w.x, w.y, w.z], s0: s, swv0: [vs.x, vs.y, vs.z], Jsum: 0, steps: 0, mode }; globalThis.__cutLog.push(c.log); }
          const v = vb.linvel(), w = vb.angvel(), vs = sw.linvel();
          c.log.v1 = [v.x, v.y, v.z]; c.log.w1 = [w.x, w.y, w.z]; c.log.s1 = s; c.log.swv1 = [vs.x, vs.y, vs.z]; c.log.Jsum += J; c.log.steps++;
        }
      }
    }

    // 2) 튕긴 충돌 (칼끼리, 칼 면/손잡이, 문턱 못 넘은 베기)
    const bladePairs = [];
    eventQueue.drainContactForceEvents((e) => {
      const h1 = e.collider1();
      const h2 = e.collider2();
      const a = this.info.get(h1);
      const b = this.info.get(h2);
      if (!a || !b || a.fighter === b.fighter) return;
      if (a.detached || b.detached) return; // 잔해(잘린 팔다리)는 겨루기·튕김 판정에서 뺀다
      if (a.kind === 'weapon' && b.kind === 'weapon') {
        if (!a.fighter.armed || !b.fighter.armed) return; // 땅에 떨어진 칼은 겨루기(바인드·쨍)가 아니다
        // 칼끼리는 모아서 한 번에 (칼날-칼날, 칼날-코등이… 여러 쌍이 한 스텝에 함께 닿는다)
        bladePairs.push(a.fighter.index < b.fighter.index ? [h1, h2] : [h2, h1]);
        return;
      }
      const pr = this.pairOf(h1, h2);
      if (!pr) return;
      if (this.cutting.has(`${pr.wc}:${pr.vc}`)) return;
      const c = contactOf(world, pr.wc, pr.vc);
      if (!c) return;
      this.strike(pr, c.p, false);
      this.rebound(pr, c.p, c.n);
      if (pr.w.fighter.skill?.corr === 'v2') (pr.w.fighter.bladeTouch = true), (pr.w.fighter.touchStep = this.stepNo); // 보정 v2: 접촉힘 타격 = 닿음
    });
    this.bladeClash(world, bladePairs);
    this.armSteel();
    // 보정 v2 사건: 떨어짐 = 이번 스텝에 가르는 쌍·접촉힘 타격·칼끼리 닿음이 하나도 없음 (v2 공격자만 적는다)
    for (const f of this.fighters) if (f.skill?.corr === 'v2' && f.bladeTouch && f.touchStep !== this.stepNo) f.bladeTouch = false;
    for (const f of this.fighters) if (f.weapon?.gun) updateGun(f, world, this, dt); // 권총(??? 등급): 걸어 둔 한 발 쏘기·장전 (gun.js)
    runInstants(this); // 비기 순간 베기: 걸어 둔 것 실행 (요청이 없으면 아무 일도 없다)
  }

  /**
   * 칼끼리 부딪힘: 이번 스텝에 두 칼이 주고받은 충격량을 모아서 싸움꾼에게 알리고(fighter.feel: 누르는 힘,
   * 새로 부딪힘), 소리·불꽃 훅을 부른다. 튕김 자체는 물리 엔진이 강철 재질(반발 계수)로 계산했다.
   */
  bladeClash(world, pairs) {
    if (!pairs.length) {
      for (const f of this.fighters) if (f.feel) (f.feel.touching = false), (f.feel.force = 0);
      return;
    }
    let J = 0;
    let point = null;
    const n = _c.set(0, 0, 0);
    for (const [h1, h2] of pairs) {
      world.contactPair(world.getCollider(h1), world.getCollider(h2), (m, flipped) => {
        let s = 0;
        for (let i = 0; i < m.numContacts(); i++) s += m.contactImpulse(i);
        if (s <= 0) return;
        // 법선: 앞 칼(번호가 작은 싸움꾼) → 뒤 칼 방향. 엔진 쪽 순서가 뒤집혀 있으면 부호를 바꾼다
        const nn = m.normal();
        const sg = flipped ? -s : s;
        n.x += nn.x * sg;
        n.y += nn.y * sg;
        n.z += nn.z * sg;
        J += s;
        if (!point && m.numSolverContacts() > 0) point = tv(m.solverContactPoint(0));
      });
    }
    const A = this.info.get(pairs[0][0]);
    const B = this.info.get(pairs[0][1]);
    if (!point) point = A.fighter.bladePoint(0.6);
    if (J > 0) n.normalize();
    const nrm = n.clone();
    // 부딪히기 직전 상대 속도 (스텝 전 저장값) — 부딪힌 뒤엔 엔진이 이미 속도를 꺾어 놓았다
    //  vn = 맞닿는 방향으로 다가오던 빠르기(부딪히는 세기), vt = 칼날을 따라 스치던 빠르기
    const SA = A.state || A.fighter.cache?.sword;
    const SB = B.state || B.fighter.cache?.sword;
    let vn = 0;
    let vt = 0;
    if (SA && SB && J > 0) {
      const r = velAt(SA, point, _a).sub(velAt(SB, point, _b));
      vn = Math.max(0, r.dot(nrm));
      vt = Math.sqrt(Math.max(0, r.lengthSq() - r.dot(nrm) ** 2));
      // 접점으로 움직인 자기 칼만 공격 확정. 받는 쪽의 정지한 칼은 공격으로 세지 않는다.
      if (velAt(SA, point, _a).dot(nrm) > 0.5) A.fighter.stamina.contactAttack();
      if (velAt(SB, point, _a).dot(nrm) < -0.5) B.fighter.stamina.contactAttack();
    }
    A.fighter.stamina.block(B.fighter);
    B.fighter.stamina.block(A.fighter);
    const fresh = this.stepNo - this.bladeLast > STEEL.rearmSteps; // 떨어져 있다가 새로 부딪힘
    this.bladeLast = this.stepNo;
    // 우케나가시 흘려 받기 (config NAGASHI): 받은 칼을 칼 지붕을 따라 미끄러뜨리고, 받는 쪽 손 흔들림·무기 닳음을 던다 (아래 feel)
    //  판정 개편(FLOW_REDESIGN.on — 사장님 10/18 22:1x)이면 새로 부딪힌 순간이 아니어도 접촉 창(0.12 s) 안에서 다시 본다 (nagashi_redesign.js)
    const flowD = (fresh || FLOW_REDESIGN.on) && NAGASHI.on && SA && SB && J > 0 ? this.nagashi(A, B, SA, SB, point, nrm, vn) : null;
    if (!flowD && IB_PARRY_ARM.on && fresh && SA && SB && J > 0) this.ibParryArm(A, B, SA, SB, point, nrm); // 이베리아 쳐내기 팔 늦춤 (시험 · 기본 끔)
    if (!flowD && IB_PARRY_BEAT.on && fresh && SA && SB && J > 0) this.ibParryBeat(A, B, SA, SB, point, nrm, vn); // 이베리아 쳐내기 튕김 (시험 · 기본 끔)
    // 새로 부딪혀 튕긴 순간: 칼이 손 안에서 길이 축으로 팽이처럼 도는 몫은 손아귀가 잡는다 (gripTwist)
    if (fresh) for (const f of [A.fighter, B.fighter]) gripTwist(f);
    const va = A.body.velocityAtPoint(point);
    const vb = B.body.velocityAtPoint(point);
    const sp = Math.hypot(va.x - vb.x, va.y - vb.y, va.z - vb.z); // 스텝 뒤 상대 속도 (튕기고 남은 속도)
    const force = J / this.dt;
    // 소리용 접촉 상태 (맞댄 채 미끄러지면 긁히는 소리: binding)
    const bc = this.bladeContact;
    if (this.stepNo - bc.last > 6) bc.start = this.stepNo;
    bc.last = this.stepNo;
    bc.slide = sp;
    bc.press = force;
    // 싸움꾼마다: 상대 칼이 내 칼을 미는 힘(바인드의 "느낌"), 새로 부딪힌 충격
    for (const [f, sgn] of [[A.fighter, -1], [B.fighter, 1]]) {
      const fe = f.feel;
      if (!fe) continue;
      fe.touching = true;
      fe.force = force;
      fe.normal.copy(nrm).multiplyScalar(sgn); // 상대 칼이 내 칼을 미는 방향
      fe.point.copy(point);
      fe.time = fresh ? 0 : fe.time + this.dt;
      if (fresh) {
        const jf = f === flowD ? J * (1 - NAGASHI.joltCut) : J; // 흘려 받은 쪽은 받는 충격을 joltCut 만큼 덜 (config NAGASHI)
        fe.impact = J;
        fe.impactSpeed = vn;
        f.takeJolt?.(jf);
        f.absorbWeaponImpact?.(jf, f === A.fighter ? B.fighter : A.fighter); // 칼끼리 세게 부딪힌 몫만큼 내구도가 있는 무기(나뭇가지 등)를 깎는다 (상대 칼의 breakMult — 청강검 '창천')
      }
    }
    for (const f of [A.fighter, B.fighter]) if (f.skill?.corr === 'v2') (f.bladeTouch = true), (f.touchStep = this.stepNo); // 보정 v2: 칼끼리 닿음
    if (BIND.natural) this.bindFeel(pairs, point, A.fighter, B.fighter, fresh);
    A.fighter.parryGuard?.opposition?.onClash(B.fighter, { vn });
    B.fighter.parryGuard?.opposition?.onClash(A.fighter, { vn });
    this.hooks.onClash?.(point, sp, { fresh, vn, vt, force, impulse: J, normal: nrm, nagashi: !!flowD });
  }

  /**
   * 우케나가시 흘려 받기 (config NAGASHI — docs/strike/ukenagashi_talho_2026-10-17.md §12). 칼끼리 새로 부딪힌 스텝(물리 뒤)에 한 번:
   *  받는 쪽 D = 일본 막기의 흘려 받기 칸(schools.js parryCover 의 nagashi — 우케나가시)을 가지고 막는 중인 싸움꾼
   *   (플레이어 = 막기 단추를 쥐고 손이 막기 자리로 감 — parry_button.js active · AI = 막기 꼴 mode 'defend', 피하기 아님).
   *  상대 칼이 맞닿은 자리에서 아래로 moveDown 넘게 움직이고(내려 베기), 그 자리가 D 가슴 + zoneHy 보다 높고, D 칼끝이 코등이보다 낮으면(칼 지붕.
   *   칼끝이 위인 칼은 받은 칼이 코등이 쪽으로 흘러내려 걸릴 뿐이라 흘리지 못한다) 상대 칼에 D 칼 축의 칼끝 쪽(지붕의 내리막)을 맞닿는 면에 눕힌 방향으로
   *   slideK × vn(맞부딪는 빠르기)의 빠르기를 더한다 — 그 방향으로 민 유효 질량(손 포함 gripMass) × 빠르기. 같은 크기 반대 충격은 D 칼이 받는다(거의 칼 길이 방향 — 손이 축으로 받음).
   *   두 칼 모두 칼날 중심선 위에 건다(rebound 와 같은 까닭 — 날 끝에 걸면 칼이 길이 축으로 팽이처럼 돈다). 그리고 D 의 몸꼴을 poseT 동안 우케나가시로.
   *  돌려줌: 흘려 받은 싸움꾼(D) · 없으면 null
   */
  /** 이베리아 탈류 · 레베스 쳐내기에 흘림과 같은 팔 늦춤 (사장님 10/19 03:5x 시험 — config IB_PARRY_ARM, 기본 끔).
   *  받는 쪽 D = 이베리아 막기 칸(탈류 highL · 레베스 highR 쳐내기 몸꼴)을 잡고 막는 중 · 상대 칼이 들어오던 새 맞닿음 → 공격자 O 에 beginFlowRecovery. 돌려줌: D 또는 null */
  ibParryArm(A, B, SA, SB, point, nrm) {
    const pc = TRADITIONS.iberian?.parryCover;
    if (!pc) return null;
    for (const [D, O, SO, sgn] of [[A.fighter, B.fighter, SB, -1], [B.fighter, A.fighter, SA, 1]]) {
      if (!ibParrying(D, pc)) continue;
      if (sgn * velAt(SO, point, _n1).dot(nrm) < 0.5) continue; // 상대 칼이 들어오던 중일 때만
      if (beginFlowRecovery(O, D)) {
        this.lastIbArm = { step: this.stepNo, d: D.index };
        return D;
      }
    }
    return null;
  }

  /** 이베리아 탈류 · 레베스 쳐내기 튕김 (사장님 10/19 08:4x '튕겨나가는 힘을 인위적으로 추가' 시험 — config IB_PARRY_BEAT, 기본 끔).
   *  ibParryArm 과 같은 때(이베리아 막기 칸 · 막는 중 · 상대 칼이 들어오던 새 맞닿음): 상대 칼을 받는 사람 몸 가운데선에서 바깥쪽으로 민다.
   *   방향 = 받는 사람 가슴 → 상대 가슴(수평)에 직각인 옆 방향 중 맞닿은 자리 쪽(가운데선 가까우면 탈류 = 왼 · 레베스 = 오른) · 상대 칼 축 성분은 뺀다(칼이 길이 축으로 밀리지 않게)
   *   충격량 = 그 방향 유효 질량(손 포함 gripMass) × k × vn(맞부딪는 빠르기) — 흘림(NAGASHI.slideK)과 같은 꼴. 반대 충격은 받는 사람 가슴 0.6 · 골반 0.4(팔을 거쳐 몸이 버팀 — 받는 칼은 흔들지 않음)
   *   k = 0 이면 밀지 않고 알아보기만(측정용). 돌려줌: D 또는 null */
  ibParryBeat(A, B, SA, SB, point, nrm, vn) {
    const pc = TRADITIONS.iberian?.parryCover;
    if (!pc || !(vn > 0)) return null;
    for (const [D, O, SO, sgn] of [[A.fighter, B.fighter, SB, -1], [B.fighter, A.fighter, SA, 1]]) {
      if (!ibParrying(D, pc) || !O.sword || !O.swordProps || !D.bodies?.chest || !O.bodies?.chest) continue;
      if (sgn * velAt(SO, point, _n1).dot(nrm) < 0.5) continue; // 상대 칼이 들어오던 중일 때만
      const c = tv(D.bodies.chest.translation());
      const fwd = tv(O.bodies.chest.translation()).sub(c);
      fwd.y = 0;
      if (fwd.lengthSq() < 1e-6) continue;
      fwd.normalize();
      const left = new THREE.Vector3(0, 1, 0).cross(fwd); // 받는 사람의 왼쪽
      const side = _n2.copy(point).sub(c).dot(left);
      const s = Math.abs(side) > 0.03 ? Math.sign(side) : D.skill._cover.last?.name === pc.highL.name ? 1 : -1;
      const dir = left.multiplyScalar(s);
      const ax = _n3.set(0, 1, 0).applyQuaternion(rotQ(O.sword));
      dir.addScaledVector(ax, -dir.dot(ax));
      if (dir.lengthSq() < 1e-6) continue;
      dir.normalize();
      const o = tv(O.sword.translation());
      const pO = o.addScaledVector(ax, _n2.copy(point).sub(o).dot(ax)); // 맞닿은 자리를 상대 칼 축 위로 (팽이 돌기 없게)
      const Jt = gripMass(O.swordProps, liveState(O.sword), pO, dir, STEEL.handMass) * IB_PARRY_BEAT.k * vn;
      if (Jt > 0) {
        O.sword.applyImpulseAtPoint({ x: dir.x * Jt, y: dir.y * Jt, z: dir.z * Jt }, vp(pO), true);
        for (const [n, k] of [['chest', 0.6], ['pelvis', 0.4]]) D.bodies[n]?.applyImpulse({ x: -dir.x * Jt * k, y: -dir.y * Jt * k, z: -dir.z * Jt * k }, true);
      }
      this.lastIbBeat = { step: this.stepNo, d: D.index, Jt, vn, dir: dir.clone() };
      return D;
    }
    return null;
  }

  nagashi(A, B, SA, SB, point, nrm, vn) {
    if (FLOW_REDESIGN.on) return this.nagashiExpanded(A, B, SA, SB, point, nrm, vn); // 판정 개편 (사장님 10/18 22:1x · 기본) — 아래는 옛 판정(`?flowJudge=0`)
    for (const [D, O, SO] of [[A.fighter, B.fighter, SB], [B.fighter, A.fighter, SA]]) {
      const st = D.skill?._cover;
      if (!st?.nagashi || D.schoolParry === false || !O.swordProps) continue;
      if (!(D.parryGuard ? D.parryGuard.active : st.ai?.mode === 'defend' && !st.ai.defVoid)) continue;
      if (velAt(SO, point, _n1).y > -NAGASHI.moveDown) continue; // 상대 칼이 내려오지 않음
      if (point.y < D.bodies.chest.translation().y + NAGASHI.zoneHy) continue; // 받는 자리가 낮음
      const dir = D.bladePoint(1, _n1).sub(D.bladePoint(0, _n2)); // 코등이 → 칼끝
      if (dir.y >= 0) continue; // 칼끝이 위 — 지붕이 아니다
      dir.addScaledVector(nrm, -dir.dot(nrm)); // 맞닿는 면에 눕힘
      if (dir.lengthSq() < 1e-8) continue;
      dir.normalize();
      const onAxis = (sw) => {
        const ax = _n3.set(0, 1, 0).applyQuaternion(rotQ(sw));
        const o = tv(sw.translation());
        return o.addScaledVector(ax, _n2.copy(point).sub(o).dot(ax));
      };
      const pO = onAxis(O.sword);
      const Jt = gripMass(O.swordProps, liveState(O.sword), pO, dir, STEEL.handMass) * NAGASHI.slideK * vn;
      O.sword.applyImpulseAtPoint({ x: dir.x * Jt, y: dir.y * Jt, z: dir.z * Jt }, vp(pO), true);
      D.sword.applyImpulseAtPoint({ x: -dir.x * Jt, y: -dir.y * Jt, z: -dir.z * Jt }, vp(onAxis(D.sword)), true);
      st.forceT = NAGASHI.poseT;
      // 흘림당한 쪽(O) 팔 늦춤 · 기력 청구 — 판정과 따로 켜고 끈다 (nagashi_recovery.js · nagashi_redesign.js — 끄면 옛 판과 같음)
      const recovery = Jt > 0 && beginFlowRecovery(O, D);
      const penalty = spendFlowPenalty(O, D);
      D.flowShield = { from: O, attackId: O.stamina?.attackId ?? 0 }; // 흘린 공격의 피해 감소 표시 (analyze — FLOW_REDESIGN.flowDmgCut)
      this.lastNagashi = { step: this.stepNo, d: D.index, Jt, vn, dir: dir.clone(), recovery, penalty };
      return D;
    }
    return null;
  }

  /**
   * 우케나가시 판정 개편 (샛별 연구 들여옴 — nagashi_redesign.js · docs/strike/japanese_flow_adopt_2026-10-18.md · 사장님 10/18 22:1x 기본):
   *  흘리는 미끄럼 충격 계수(NAGASHI.slideK)는 같고 · 칼끼리 실제 접촉만 · 받는 몸꼴로 강제로 옮기지 않는다(옛 판정의 poseT 없음 — 공격 입력과 부딪치지 않게).
   *  흘림당한 쪽(O): 팔 늦춤(FLOW_RECOVERY 0.36 s) · 기력 −40(공격 하나에 한 번). 돌려줌: 흘려 받은 싸움꾼(D) · 없으면 null
   */
  nagashiExpanded(A, B, SA, SB, point, nrm, vn) {
    for (const [D, O, SO] of [[A.fighter, B.fighter, SB], [B.fighter, A.fighter, SA]]) {
      const candidate = flowCandidate(D, O, SO, point, nrm, vn, D.stamina.time);
      if (!candidate) continue;
      const dir = candidate.direction;
      const onAxis = (sw) => {
        const ax = _n3.set(0, 1, 0).applyQuaternion(rotQ(sw));
        const o = tv(sw.translation());
        return o.addScaledVector(ax, _n2.copy(point).sub(o).dot(ax));
      };
      const pO = onAxis(O.sword);
      const Jt = gripMass(O.swordProps, liveState(O.sword), pO, dir, STEEL.handMass) * NAGASHI.slideK * candidate.impact;
      if (!(Jt > 0)) continue;
      O.sword.applyImpulseAtPoint({ x: dir.x * Jt, y: dir.y * Jt, z: dir.z * Jt }, vp(pO), true);
      D.sword.applyImpulseAtPoint({ x: -dir.x * Jt, y: -dir.y * Jt, z: -dir.z * Jt }, vp(onAxis(D.sword)), true);
      const recovery = beginFlowRecovery(O, D);
      const penalty = spendFlowPenalty(O, D);
      D.flowShield = { from: O, attackId: O.stamina?.attackId ?? 0 }; // 흘린 공격의 피해 감소 표시 (analyze — FLOW_REDESIGN.flowDmgCut)
      this.lastNagashi = { step: this.stepNo, d: D.index, Jt, vn, dir: dir.clone(),
        recovery, redesign: true, penalty, age: candidate.age,
        entry: candidate.entry, exitGain: candidate.gain };
      return D;
    }
    return null;
  }

  /**
   * 자연 바인드 실험의 '느낌' (BIND.natural — docs/strike/natural_bind_2026-10-11.md ③④, 읽기만 · 물리 무관): 맞닿은 자리가 내 칼날 어디인가
   *  feel.at = 코등이 0 → 칼끝 1 (음수 = 코등이·자루 위 — 강함 Stärke 쪽일수록 작다) · feel.hilt = 이번 스텝 내 코등이·자루 콜라이더가 상대 칼에 닿음(코등이 걸림) ·
   *  feel.bindT = 이어 붙은 시간(s, fe.time 과 같으나 실험 쪽 셈). AI(독일 느낌 결정)와 측정 도구가 읽는다
   */
  bindFeel(pairs, point, A, B, fresh) {
    for (const f of [A, B]) {
      const fe = f.feel;
      if (!fe || !f.sword) continue;
      const o = f.sword.translation();
      const ax = _a.set(0, 1, 0).applyQuaternion(rotQ(f.sword));
      const along = _b.copy(point).sub(_c.set(o.x, o.y, o.z)).dot(ax);
      fe.at = (along - f.weaponCfg.hiltLength) / Math.max(1e-6, f.weaponCfg.bladeLength);
      let hilt = false;
      for (const [h1, h2] of pairs) for (const h of [h1, h2]) { const I = this.info.get(h); if (I?.fighter === f && I.part === 'hilt') hilt = true; }
      fe.hilt = hilt;
      fe.bindT = fresh ? 0 : (fe.bindT ?? 0) + this.dt;
    }
  }

  /** 칼끼리 맞댄 채(바인드)엔 반발을 끈다: 누를 때마다 접촉점이 새로 생기며 튕겨 떨리지 않게 */
  armSteel() {
    const armed = this.stepNo - this.bladeLast > STEEL.rearmSteps;
    // 자연 바인드 실험 (BIND.natural ①): 처음 한 번 칼 반발을 BIND.restitution 으로 다시 건다 (끄면 이 줄을 지나치기만 한다)
    if (BIND.natural && !this.natSurface) (this.natSurface = true), (this.steelArmed = null);
    if (armed === this.steelArmed) return;
    this.steelArmed = armed;
    // 무기마다 재질이 다를 수 있어(강철/나무/고무…) 되돌릴 때도 각자 자기 재질 반발값을 쓴다
    for (const f of this.fighters) {
      const mat = f.restitution ?? STEEL.restitution;
      const e = armed ? (BIND.natural ? Math.min(mat, BIND.restitution) : mat) : 0;
      for (const c of f.swordColliders || []) {
        c.setRestitution(e);
        if (BIND.natural) c.setFriction(armed ? 0.4 : BIND.friction); // 붙어 있는 동안만 칼끼리 더 문다 (0.4 = fighter.js 칼 콜라이더 마찰 그대로)
      }
    }
  }

  /**
   * 딱딱한 곳(투구·두개골·뼈)을 쳤는데 날이 들지 못했으면 칼이 되튄다.
   * 반발 계수 e: 부딪힌 뒤 떨어지는 속도 = e × 부딪히기 전 다가오던 속도 (접촉점, 법선 방향).
   * 엔진은 이 접촉을 반발 0으로 풀었으니(칼과 살), 모자란 만큼의 충격량
   *   ΔJ = (지금 법선 속도 − 목표 속도) ÷ (1/칼 유효질량 + 1/부위 유효질량)
   * 을 칼과 맞은 부위에 같은 크기, 반대 방향으로 준다 → 운동량은 그대로 보존된다.
   */
  rebound(pr, point, n) {
    if (pr.w.flexible) return;
    const key = `${pr.wc}:${pr.vc}`;
    const last = this.touching.get(key);
    this.touching.set(key, this.stepNo);
    if (last !== undefined && this.stepNo - last <= STEEL.rearmSteps) return; // 이어서 닿아 있는 중: 한 번만 튕긴다
    if (this.touching.size > 64) for (const [k, s] of this.touching) if (this.stepNo - s > 120) this.touching.delete(k);
    const att = pr.w.fighter;
    const vic = pr.v.fighter;
    const S = att.cache?.sword;
    const P = vic.cache?.parts[pr.v.part];
    if (!S || !P || !att.swordProps) return;
    // 부위의 단단함
    const vicLocal = _d.copy(point).sub(P.p).applyQuaternion(_q.copy(P.q).invert());
    const zone = zoneOf(pr.v, vicLocal);
    let e = 0;
    const noArmor = att.weaponCfg.ignoreArmor; // 라이트세이버: 투구·판금에 튕기지 않는다 (맨머리·맨몸처럼)
    if (zone === 'head') e = !noArmor && vic.hasHelmet && vicLocal.y > (vic.helmetSpec?.coverMinY ?? -0.01) ? STEEL.steel : STEEL.bone; // 투구 / 맨머리
    else if (!noArmor && zone !== 'neck' && vic.platedAt?.(pr.v.part, vicLocal)) e = STEEL.steel; // 판금 (ARMOR.on 일 때만, 판이 덮은 곳)
    else if (pr.v.kind === 'arm' || pr.v.kind === 'leg') e = STEEL.bone; // 팔다리 뼈
    if (e <= 0) return;
    const vPre = velAt(S, point, _a).sub(velAt(P, point, _b)).dot(n); // + = 다가옴
    if (vPre < STEEL.reboundMinSpeed) return;
    const sw = pr.w.body;
    const vb = pr.v.body;
    const va = sw.velocityAtPoint(point);
    const vv = vb.velocityAtPoint(point);
    const vPost = (va.x - vv.x) * n.x + (va.y - vv.y) * n.y + (va.z - vv.z) * n.z;
    const want = -e * vPre;
    if (vPost <= want) return; // 이미 그만큼 떨어지고 있다
    // 칼에는 칼날 중심선 위에 건다 (날 끝에 걸면 칼이 길이 방향으로 팽이처럼 돈다) → 유효 질량도 그 점에서.
    //  몸은 뼈(중심선)로 받는다
    const ax = _a.set(0, 1, 0).applyQuaternion(rotQ(sw));
    const o = tv(sw.translation());
    const pA = o.clone().addScaledVector(ax, _b.copy(point).sub(o).dot(ax));
    const pV = onBone(pr.v, point);
    const mB = gripMass(att.swordProps, liveState(sw), pA, n, STEEL.handMass);
    const mV = bodyMass(vb, pV, n);
    const J = (vPost - want) / (1 / mB + 1 / mV);
    sw.applyImpulseAtPoint({ x: -n.x * J, y: -n.y * J, z: -n.z * J }, vp(pA), true);
    vb.applyImpulseAtPoint({ x: n.x * J, y: n.y * J, z: n.z * J }, vp(pV), true);
    // 칼을 쥔 팔도 충격을 받는다: 멈추는 충격량(≈ 유효 질량 × 다가오던 속도) + 되튀는 몫
    att.takeJolt?.(mB * vPre + J);
    att.absorbWeaponImpact?.(mB * vPre + J); // 투구·뼈를 세게 쳤다가 되튄 충격도 무기 내구도를 깎는다
    this.lastRebound = { zone, e, vPre, vPost, J, mB, mV, step: this.stepNo };
  }

  /** 소리용: 지금 칼끼리 맞대고 있는가 (처음 닿은 뒤 40ms 넘게 계속 닿아 있음) */
  get binding() {
    const bc = this.bladeContact;
    return this.stepNo - bc.last <= 3 && bc.last - bc.start >= 5;
  }

  /** 실제 접촉점에서 다시 정확히 분석하고 상처/에너지 전달을 적용 */
  strike(pr, point, passing) {
    const att = pr.w.fighter;
    const vic = pr.v.fighter;
    const key = `${att.index}:${pr.v.part}`;
    // 속도는 스텝 "직전" 값을 쓴다. 튕긴 충돌은 스텝 뒤엔 이미 속도가 꺾여 있어서 에너지가 작게 나온다.
    const S = pr.w.state || att.cache?.sword || liveState(pr.w.body);
    const P = vic.cache?.parts[pr.v.part] || liveState(pr.v.body);
    if (vic.hitCooldowns.has(key)) {
      // 같은 부위에 방금 상처가 났으면 새 상처는 없지만, 가르고 지나가는 칼은 여전히 저항을 받는다
      if (!passing) return null;
      const r = this.analyze(pr, point, S, P);
      if (r) r.stuck = r.energy <= r.absorb;
      return r;
    }
    const r = this.analyze(pr, point, S, P);
    if (!r || r.energy < STRIKE.minEnergy) return null;
    att.stamina.contactAttack(r.type === 'stab' ? 'thrust' : 'cut');
    vic.hitCooldowns.set(key, STRIKE.hitCooldown);
    if (passing) r.stuck = r.energy <= r.absorb; // 에너지가 모자라 칼이 박힘
    if (r.type !== 'blunt' || r.severity > 0 || r.energy > 10) {
      vic.applyWound({ ...r, part: pr.v.part, passing }); // passing: 칼이 가르고 지나가는 길(참수는 이 길만)
      if (r.type === 'cut' && r.severity > 0) this.buckleCheck(att, vic, pr.v.part);
      // 이점이 터진 순간 잔상 (10/21): 위에서 내려 찌르기가 틈을 파고들어 상처 · 요격이 몸통을 베어 깊은 출혈
      if (r.severity > 0) { const tn = strokeTechOf(att); if ((tn === 'imbroccata' && r.type === 'stab') || (tn === 'yaoji' && r.type === 'cut' && UA.yaojiBleed?.zones.includes(r.zone))) artFlash(att, this.dt); }
    }
    this.hooks.onWound?.(att, vic, r, point, pr);
    return r;
  }

  /**
   * 곁눈 베기 무릎 꺾기 (독일 강화동작 이점 — 10/21 사장님, config UNIQUE_ASSIST.buckle): 곁눈 베기의 칼날이 들어간 베기가 머리 · 가슴(목) · 위팔(어깨)에 맞으면
   *  p 로 맞은 쪽이 한쪽 무릎을 꿇는다(knockDown(false) — 넘어졌다 일어날 때의 무릎 자세 · 꿇는 시간만 kneel 초 꼴). 그 상대에게는 cool 초 안에 다시 굴리지 않는다.
   *  굴림은 친 쪽 전용 난수(fighter.buckleRandom — Math.random 순서는 그대로). 기록 this.buckleLog { t, att, vic, part, hit }
   */
  buckleCheck(att, vic, part) {
    const B = UA.buckle;
    if (!(B?.p > 0) || !vic?.alive || vic.state !== 'stand' || vic.revival || !B.parts.includes(part)) return;
    if (strokeTechOf(att) !== 'schielhau') return;
    const t = this.stepNo * (this.dt ?? 1 / 60);
    if (vic.buckleAt != null && t - vic.buckleAt < B.cool) return; // cool 은 꿇은 뒤부터 (빗나간 굴림은 세지 않는다)
    // 버티기(일본 steady — fighter.swayScale 0.75)는 휘청 · 넘어짐을 덜 받듯 무릎 꺾기 확률도 그만큼 덜 받는다 (10/21 사장님 '더 강인하게 버티는 거 맞지?' — 일본 50 % → 37.5 %)
    const hit = att.buckleRandom() < B.p * (vic.swayScale ?? 1);
    (this.buckleLog ??= []).push({ t: +t.toFixed(2), att: att.index, vic: vic.index, part, hit });
    if (!hit) return;
    vic.buckleAt = t;
    vic.buckleKneel = B.kneel;
    vic.knockDown(false);
    artFlash(att, this.dt); // 무릎이 꺾인 그 칼에 잔상 (10/21 — 이점이 터진 순간)
  }
}

// ── 도우미 ──
/**
 * 방어구가 막는 몫(0~1): 내구도가 spec.fullUntil 까지는 멀쩡할 때처럼 다 막고, 그 아래로 찌그러지고 금이 가며 줄어든다
 * (outfits.js setHelmetWear 가 0.5 아래부터 찌그러짐을 보인다 — 보이는 대로 약해진다). fullUntil 이 없으면(케틀햇) 예전처럼 내구도 그대로
 */
function armorHold(spec, integrity) {
  return spec.fullUntil ? Math.min(1, integrity / spec.fullUntil) : integrity;
}
const _fq = new THREE.Quaternion();
const _fr = new THREE.Vector3();
/** 강체 칼의 한 점에서 방향 n으로 민 유효 질량: 1 / (1/m + Σ (r×n)ᵢ² / Iᵢ) (주축 좌표) */
function freeMass(props, S, point, n) {
  if (!props) return 0.5;
  const { m, I, frame } = props;
  _fq.copy(S.q).multiply(frame).invert();
  const rn = _fr.copy(point).sub(S.com).cross(n).applyQuaternion(_fq);
  return 1 / (1 / m + (rn.x * rn.x) / I.x + (rn.y * rn.y) / Math.max(I.y, 1e-6) + (rn.z * rn.z) / I.z);
}
const _Ic = new THREE.Matrix3();
const _Im = new THREE.Matrix3();
const _R = new THREE.Matrix3();
const _M4 = new THREE.Matrix4();
const _gc = new THREE.Vector3();
const _gd = new THREE.Vector3();
/**
 * 손에 쥔 칼의 유효 질량: 칼 + 손(칼자루 원점에 붙은 점 질량 handMass). 손목은 공 관절이라 칼은 손을 축으로 자유롭게 돌지만,
 * 순간 충격에는 손(과 팔의 일부)도 함께 밀려야 한다. 칼끝을 치면 칼 혼자일 때(약 0.19kg)보다 조금 무겁고(약 0.27kg),
 * 칼자루 쪽을 칠수록 손의 무게가 많이 실린다.  1/m = 1/(칼+손) + (r×n)·I⁻¹·(r×n)  (합친 무게중심 기준)
 */
function gripMass(props, S, point, n, handMass) {
  if (!props) return 0.5;
  const { m, I, frame } = props;
  const M = m + handMass;
  // 합친 무게중심 (손 = 칼 원점)
  const c = _gc.copy(S.com).multiplyScalar(m).addScaledVector(S.p, handMass).divideScalar(M);
  // 칼의 관성(주축) → 월드: R·diag(I)·Rᵀ
  _M4.makeRotationFromQuaternion(_fq.copy(S.q).multiply(frame));
  _R.setFromMatrix4(_M4);
  _Ic.set(I.x, 0, 0, 0, Math.max(I.y, 1e-6), 0, 0, 0, I.z);
  _Ic.premultiply(_R).multiply(_Im.copy(_R).transpose());
  // 평행축 정리: 칼 무게중심·손을 합친 무게중심 기준으로 옮긴다  m(|d|²E − d dᵀ)
  const shift = (d, mass) => {
    const e = _Ic.elements;
    const dd = d.x * d.x + d.y * d.y + d.z * d.z;
    const a = [d.x, d.y, d.z];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) e[j * 3 + i] += mass * ((i === j ? dd : 0) - a[i] * a[j]);
  };
  shift(_gd.copy(S.com).sub(c), m);
  shift(_gd.copy(S.p).sub(c), handMass);
  _Ic.invert();
  const rn = _gd.copy(point).sub(c).cross(n);
  const k = rn.x * rn.x * _Ic.elements[0] + rn.y * rn.y * _Ic.elements[4] + rn.z * rn.z * _Ic.elements[8] + 2 * (rn.x * rn.y * _Ic.elements[3] + rn.x * rn.z * _Ic.elements[6] + rn.y * rn.z * _Ic.elements[7]);
  return 1 / (1 / M + k);
}
/**
 * 손아귀가 칼자루를 잡는다. 칼 혼자의 길이 축 관성은 아주 작아서(대부분 코등이), 칼끼리 새로 부딪힐 때
 * 코등이 끝이나 날 모서리(칼 축에서 몇 cm)에 걸린 충격이 튕기면서 칼을 길이 축으로 팽이처럼 돌린다
 * (한 스텝에 날이 50~90° 휙 돌아간다). 실제로는 꽉 쥔 손·아래팔이 함께 돌아야 해서 그렇게 빨리 돌지 못한다.
 * 부딪히기 전보다 빨라진 축 회전 중 STEEL.gripTwistMax(rad/s)를 넘는 몫을 손아귀 마찰이 받아 없앤다.
 */
function gripTwist(f) {
  if (!f.armed || !f.cache?.sword) return;
  const sw = f.sword;
  const ax = _gt.set(0, 1, 0).applyQuaternion(rotQ(sw)); // 칼 길이 축 (월드)
  const w = sw.angvel();
  const wAx = w.x * ax.x + w.y * ax.y + w.z * ax.z;
  // 플레이어 칼만 다른 손아귀 한도 (STEEL.gripTwistMaxPlayer, 기본 null = 같음 — docs/motion/player_edge_2026-10-10.md, 사장님 확인 전 실험 스위치)
  const gmax = STEEL.gripTwistMaxPlayer != null && f.skill?.autoGuard === true ? STEEL.gripTwistMaxPlayer : STEEL.gripTwistMax;
  const lim = Math.max(Math.abs(f.cache.sword.w.dot(ax)), gmax);
  if (Math.abs(wAx) <= lim) return;
  const dw = wAx - Math.sign(wAx) * lim; // 손아귀가 받아 없애는 축 각속도
  sw.setAngvel({ x: w.x - ax.x * dw, y: w.y - ax.y * dw, z: w.z - ax.z * dw }, true);
}
const _gt = new THREE.Vector3();
/**
 * 팔다리는 겉(살)이 아니라 뼈(길이 방향 중심선)로 힘을 받는다.
 * 가느다란 팔다리 겉면에 충격을 주면 길이 방향으로 팽이처럼 돌기 때문.
 */
function onBone(info, point) {
  if (info.kind !== 'arm' && info.kind !== 'leg') return point;
  const b = info.body;
  const c = b.worldCom();
  const axis = new THREE.Vector3(info.part === 'uarmS' || info.part === 'farmS' ? 1 : 0, info.part === 'uarmS' || info.part === 'farmS' ? 0 : 1, 0).applyQuaternion(rotQ(b));
  const r = new THREE.Vector3(point.x - c.x, point.y - c.y, point.z - c.z);
  return axis.multiplyScalar(r.dot(axis)).add(new THREE.Vector3(c.x, c.y, c.z));
}

/** 이베리아 쳐내기 칸을 잡고 막는 중인가 (ibParryArm · ibParryBeat): 이베리아 · 막기 켬 · 막는 중 · 막기 칸 무게 > 0.3 · 탈류(highL) 또는 레베스(highR) 쳐내기 칸.
 *  깔린 막기 칸은 사본이라 이름으로 맞춘다 */
function ibParrying(D, pc) {
  const st = D.skill?._cover;
  if (!st || D.schoolParry === false || D.swordArt?.tradition !== 'iberian') return false;
  if (!(D.parryGuard ? D.parryGuard.active : st.ai?.mode === 'defend' && !st.ai.defVoid)) return false;
  const nm = st.last?.name;
  return st.w > 0.3 && (nm === pc.highL.name || nm === pc.highR.name);
}
function tv(v) {
  return new THREE.Vector3(v.x, v.y, v.z);
}
function vp(v) {
  return { x: v.x, y: v.y, z: v.z };
}
function rotQ(col) {
  const r = col.rotation();
  return new THREE.Quaternion(r.x, r.y, r.z, r.w);
}
function liveState(b) {
  const t = b.translation();
  const r = b.rotation();
  const c = b.worldCom();
  const v = b.linvel();
  const w = b.angvel();
  return {
    p: new THREE.Vector3(t.x, t.y, t.z),
    q: new THREE.Quaternion(r.x, r.y, r.z, r.w),
    com: new THREE.Vector3(c.x, c.y, c.z),
    v: new THREE.Vector3(v.x, v.y, v.z),
    w: new THREE.Vector3(w.x, w.y, w.z),
  };
}
/** 몸 부위(강체)의 한 점에서 방향 n으로 민 유효 질량 (freeMass와 같은 식, 부위의 질량·주관성 모멘트로) */
function bodyMass(b, point, n) {
  const I = b.principalInertia();
  const f = b.principalInertiaLocalFrame();
  const r = b.rotation();
  const c = b.worldCom();
  _fq.set(r.x, r.y, r.z, r.w).multiply(_fq2.set(f.x, f.y, f.z, f.w)).invert();
  const rn = _fr.set(point.x - c.x, point.y - c.y, point.z - c.z).cross(n).applyQuaternion(_fq);
  return 1 / (1 / b.mass() + (rn.x * rn.x) / Math.max(I.x, 1e-6) + (rn.y * rn.y) / Math.max(I.y, 1e-6) + (rn.z * rn.z) / Math.max(I.z, 1e-6));
}
const _fq2 = new THREE.Quaternion();
/** 칼(h1)과 몸(h2)의 접촉점과 법선(h1 → h2 방향) */
function contactOf(world, h1, h2) {
  let found = null;
  world.contactPair(world.getCollider(h1), world.getCollider(h2), (m, flipped) => {
    if (!found && m.numSolverContacts() > 0) {
      const p = m.solverContactPoint(0);
      const nn = m.normal();
      const s = flipped ? -1 : 1;
      if (p) found = { p: new THREE.Vector3(p.x, p.y, p.z), n: new THREE.Vector3(nn.x * s, nn.y * s, nn.z * s) };
    }
  });
  return found;
}

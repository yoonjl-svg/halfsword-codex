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
import * as THREE from 'three';
import { STRIKE, ANATOMY, STEEL, ARMOR } from './config.js';
import { BREAK } from './weapons.js';
import { updateGun } from './gun.js';
import { applyBudgetedCutResistance } from './cut_reaction.js';
import { applyCenterlineCutImpulse, centerlineCutEnabled } from './cut_centerline.js';
import { resolveFinishRule } from './finish_rule.js';

// 전투 사건 갈고리 (gun.js GUN_HOOKS 와 같은 식): 비어 있으면 아무 일도 없다. 판정·난수와 무관
//  onDecapitate(f, headBody): 참수된 순간 한 번 (fighter.applyWound, die 뒤) — 사운드 PM 이 소리를 건다
export const COMBAT_HOOKS = { onDecapitate: null };

const FINISH_PARTS = new Set(['chest', 'abdomen', 'pelvis', 'head']); // 내려찍기 즉사 부위 (몸통·머리). 부위 이름으로 — 가슴·머리 몸체의 목 쪽도 들어간다
const Y = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const _e = new THREE.Vector3();
const _q = new THREE.Quaternion();

/** 강체 상태(p, q, com, v, w)에서 한 점의 속도 */
function velAt(st, point, out) {
  return out.copy(point).sub(st.com).cross(st.w).negate().add(st.v); // v + w × r
}

/** 부위 이름 + 부위 기준 위치 → 해부학적 구역 */
function zoneOf(info, local) {
  if (info.kind === 'head') return local.y < -0.05 ? 'neck' : 'head';
  if (info.kind === 'chest') return local.y > 0.11 ? 'neck' : 'chest';
  return info.kind; // pelvis | arm | leg
}

function spikeHead(pr) {
  const att = pr.w.fighter;
  return pr.w.part === 'blade' && !att.weaponCfg.edged && att.weaponCfg.spike === true;
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
    this.cutReactionModel = 'legacy'; // Optional research trial; ordinary combat preserves legacy resistance.
    this.cutReactionFighter = null; // Centerline trial requires the selected player object explicitly.
    this.finishRuleModel = 'legacy';
    this.finishRuleFighter = null; // Optional app trial can restrict the rule to its player.
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
    if (a.detached || b.detached) return null;
    if (a.fighter.revival || b.fighter.revival) return null; // 부활하는 동안엔 상처를 주고받지 않는다 (revive.js)
    // 손에서 놓친(땅에 떨어진) 칼은 부딪히기만 하고 상처를 내지 않는다
    if ((a.kind === 'weapon' && !a.fighter.armed) || (b.kind === 'weapon' && !b.fighter.armed)) return null;
    if (a.kind === 'weapon' && b.kind !== 'weapon') return { w: a, v: b, wc: c1, vc: c2 };
    if (b.kind === 'weapon' && a.kind !== 'weapon') return { w: b, v: a, wc: c2, vc: c1 };
    return null;
  }

  filterContactPair(c1, c2) {
    const pr = this.pairOf(c1, c2);
    if (!pr || pr.w.part !== 'blade') return 1; // 1 = 평소처럼 부딪힘
    const spike = spikeHead(pr);
    const key = `${pr.wc}:${pr.vc}`;
    let cut = this.cutting.get(key);
    if (cut) {
      if (spike) {
        const S = pr.w.fighter.cache?.sword, P = pr.v.fighter.cache?.parts[pr.v.part];
        const point = S && cut.localPt?.clone().applyQuaternion(S.q).add(S.p);
        if (!point || !P || !this.analyze(pr, point, S, P, true)?.pass) {
          this.cutting.delete(key);
          return 1;
        }
      }
      cut.seen = this.stepNo;
      return 0; // 0 = 부딪히는 힘 없음 → 칼이 살을 가르고 지나감
    }
    // 구형 가시 머리는 중심선 예측이 앞끝을 골라도 실제 접촉은 옆면일 수 있다.
    // 첫 접촉은 물리로 풀고, afterStep의 실제 접촉점이 관통할 때만 다음 스텝부터 연다.
    if (spike) return 1;
    // 아직 안 닿았으면: 지금 속도로 닿는다면 가를 수 있는지 예측
    const res = this.predict(pr);
    if (res && res.pass) {
      this.cutting.set(key, { seen: this.stepNo, applied: false, pr, wc: pr.wc, vc: pr.vc });
      return 0;
    }
    return 1;
  }

  /** 스텝 전 저장값으로, 칼날 위에서 몸 부위 중심에 가장 가까운 점을 접촉점으로 가정해 분석 */
  predict(pr) {
    const att = pr.w.fighter;
    const vic = pr.v.fighter;
    if (!att.cache || !vic.cache) return null;
    const S = att.cache.sword;
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
    // 날 없는 무기는 둔기다. 온전한 가시 머리만 아래의 좁은 축방향 찌르기를 허용한다.
    // BREAK.stubEdge 면 부러진 칼 토막도 날로 — 효율은 fighter.breakWeapon 이 깎는다.
    const isBlade = pr.w.part === 'blade' && local.y > HL - 0.01 && att.weaponCfg.edged && (!att.weaponBroken || BREAK.stubEdge);
    const spike = spikeHead(pr) && !att.weaponBroken;

    // 유효 질량: 맞은 점에서의 강체 칼의 실제 유효 질량 + 팔·몸의 도움
    const mFree = freeMass(pr.w.fighter.swordProps, S, point, dir);
    let mEff = mFree + STRIKE.armAssist;
    let ephys = 0.5 * mEff * speed * speed; // 실제 운동 에너지 (J)
    // 게임 속 판정용 에너지: 실제 에너지 × 보정값. 이 모델의 베는 속도가 실제(칼날 치는 부분 약 20m/s)보다
    // 조금 낮아서, 상처 문턱값(ANATOMY)과 기절·비틀거림 같은 효과가 예전과 같은 세기로 나오게 맞춘 값이다
    let energy = ephys * STRIKE.energyScale;
    let assisted = null; // 찌르기 팔 유효 질량을 실었으면 싣기 전 값 (멍으로 바뀌면 되돌린다)

    let type = 'blunt';
    let quality = 1;
    const along = rel.dot(axis) / speed;
    const ts = spike ? null : att.weaponCfg.thrustStyle; // 가시는 찌르기검의 넓은 판정·방어구 틈 보정을 받지 않는다.
    const win = ts ? ts.window : 0; // 칼끝 판정 폭
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
          energy = ephys * STRIKE.energyScale;
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
    //  기존 칼의 예외는 옷·살·판금·투구 문턱과 독립이다. 새 가시 찌르기는 아래 문턱을 넘어야 마무리도 허용한다.
    //  걸리지 않는 것: 서 있는·무릎 꿇은·일어나는 상대 (vic.state) · 보통 탭 찌르기 (tap.down) · 겨누는 중·걷는 중 (go) ·
    //  찍기가 끝난 뒤·돌아오는 중 (thrustPush) · 자세 지도로 친 내려찍기·AI 내려베기 (tap 없음) · 베기·둔기·날 없는 무기 (stab) ·
    //  팔다리 (부위) · 내가 넘어졌을 때 (att.state) · 다른 상대 (att.foe). 판단만 한다 — 예측(predicting)·측정 도구가 불러도 부작용 없음
    const tp = att.skill?.tap;
    let finish = type === 'stab' && !!tp?.down && !!tp.go && !!att.skill.thrustPush && (att.state === 'stand' || att.state === 'kneel') && vic === att.foe && vic.state === 'down' && FINISH_PARTS.has(pr.v.part);
    const finishRuleModel = this.finishRuleFighter && att !== this.finishRuleFighter ? 'legacy' : this.finishRuleModel;
    let finishRuleResult = null;
    let bareThreshold = null;
    // 투구: 머리 윗부분(눈썹 위)만 덮는다. 종류별 값은 ARMOR.helmets (케틀햇 = 예전 ANATOMY.helmet 그대로)
    const helmet = zone === 'head' && vic.hasHelmet && vicLocal.y > -0.01;
    const hs = helmet ? vic.helmetSpec || ARMOR.helmets.kettle : null;
    // ignoreArmor 무기(라이트세이버 '고온 플라스마: 갑옷 무시', 사장님 확정)는 모든 투구를 무시한다: 맨머리 판정(투구는 베여 닳기만 한다).
    //  (예전엔 플레이어 케틀햇만 빼서 라이트세이버가 케틀햇 문턱 200 J 를 그대로 받았다 — 주석 의도와 반대였다. 디렉터 12:38)
    const helmOn = helmet && !att.weaponCfg.ignoreArmor;
    const A = helmOn ? { ...ANATOMY.head, ...hs } : ANATOMY[zone];
    // 판금(ARMOR.on, look.armor === 'plate'): 그 부위 판이 남아 있고 맞은 곳을 판이 덮었으면(팔다리는 판이 붙은 자리만).
    //  목(가슴 윗부분)은 덮지 않는다
    const body = zone !== 'head' && zone !== 'neck';
    const plate = !helmet && body && !!vic.platedAt?.(pr.v.part, vicLocal);
    // 막아주는 정도: 투구·판금은 찌그러질수록, 옷은 찢어질수록 약해진다
    let guard = 1;
    let helmetBlunt = 1;
    let plateGuard = 0; // 판금의 막음 비율 (0 = 판 없음). 문턱은 아래에서 누비옷 문턱과 큰 쪽을 쓴다
    if (helmOn) {
      const hi = vic.helmetIntegrity;
      guard = hs.guardMin + (1 - hs.guardMin) * armorHold(hs, hi);
      helmetBlunt = hs.blunt + (1 - hs.blunt) * (1 - hi);
    } else if (body) {
      guard = 0.55 + 0.45 * (vic.cloth[pr.v.part] ?? 1);
      if (plate) plateGuard = ARMOR.plate.guardMin + (1 - ARMOR.plate.guardMin) * armorHold(ARMOR.plate, vic.plate[pr.v.part]);
      // 팔다리 판(견갑·팔 통판·손목 보호대·허벅지 판·정강이받이·쇠신)은 몸통 판보다 얇다: 문턱 × ARMOR.plate.limb
      if (plate && (zone === 'arm' || zone === 'leg')) plateGuard *= ARMOR.plate.limb;
    }
    if (att.weaponCfg.ignoreArmor) (guard = 1), (plateGuard = 0); // 라이트세이버 등: 갑옷·투구가 막아주지 않는다
    // 찌르기 무기의 찌르기는 옷·투구의 틈을 파고든다: 옷이 막아주는 몫(0.55 위)의 gap 비율, 투구·판금은 gap 의 절반을 무시한다
    else if (type === 'stab' && ts?.gap) {
      if (helmOn) guard *= 1 - 0.5 * ts.gap;
      else if (body) {
        guard -= ts.gap * Math.max(0, guard - 0.55);
        plateGuard *= 1 - 0.5 * ts.gap;
      }
    }

    // 감정 고유 능력(emotions.js 배율표, fighter.emoMods): 주는 쪽의 dealt, 받는 쪽의 taken, 관통 문턱은 둘의 pass 합.
    //  감정이 없으면 전부 1·0 이라 예전과 같다
    const am = att.emoMods;
    const vm = pr.v.fighter?.emoMods;
    const emoDealt = am?.dealt ?? 1;
    const emoTaken = vm?.taken ?? 1;
    const emoPass = (am?.pass ?? 0) + (vm?.pass ?? 0);
    let severity = 0;
    let pass = false;
    let thr = null; // 날이 들기 시작하는 문턱(J) — 측정 도구(weapon_anatomy.mjs, armor_eval.mjs)도 읽는다
    let eff = null; // 문턱과 견주는 실효 에너지(J)
    if (type === 'cut' || type === 'stab') {
      const wMult = att.weaponCfg.power * (type === 'cut' ? att.weaponCfg.mCut : att.weaponCfg.mThrust); // 등급 배율 × 무기별 베기/찌르기 배율
      thr = (type === 'cut' ? A.cut : A.stab) * guard;
      // 판금: 강철판 문턱 × 판의 막음. 판 밑 누비옷보다 약해지지는 않는다 (큰 쪽)
      if (plateGuard > 0) thr = Math.max(thr, (type === 'cut' ? ARMOR.plate.cut : ARMOR.plate.stab) * plateGuard);
      // 투구: 찌그러지고 틈을 파고들어도 맨머리보다 약해지지는 않는다 (케틀햇은 가장 약할 때도 맨머리보다 세서 그대로)
      if (helmet) thr = Math.max(thr, type === 'cut' ? ANATOMY.head.cut : ANATOMY.head.stab);
      eff = energy * quality * wMult * emoDealt * emoTaken;
      if (finishRuleModel === 'armorCausal' || finishRuleModel === 'armorGuard') {
        // Matched bare tissue keeps clothing/gap modifiers, removing only the
        // helmet/plate contribution. pass=false alone does not mean armor blocked.
        bareThreshold = (type === 'cut' ? ANATOMY[zone].cut : ANATOMY[zone].stab) * (helmOn ? 1 : guard);
        if (helmet) bareThreshold = Math.max(bareThreshold, type === 'cut' ? ANATOMY.head.cut : ANATOMY.head.stab);
        finishRuleResult = resolveFinishRule({ model: finishRuleModel, eligible: finish, type, eff, threshold: thr,
          bareThreshold, armorActive: helmOn || plateGuard > 0, ignoreArmor: att.weaponCfg.ignoreArmor });
        finish = finishRuleResult.finish;
      }
      // 가시는 살·옷·판금·투구가 막으면 마무리 즉사도 없다. 예측과 실제 판정에 함께 적용한다.
      if (spike && eff <= thr) finish = false;
      if (eff > thr) {
        severity = (eff - thr) / (type === 'cut' ? 90 : 60);
        pass = eff > thr * (1.25 - emoPass); // 확실히 파고들 때만 튕기지 않고 가르고 들어간다 (집념·분노면 더 쉽게 가른다)
      } else if (!predicting && !finish) {
        type = 'blunt'; // 날이 들지 못했으면 멍만 든다 (내려찍기 즉사 찌르기는 찌르기 그대로 — 판·투구에 막혀도 칼은 물리로 튕긴다.
        //  판·옷·소리는 심각도 0 이라 막힌 타격으로 적힌다: fighter.applyWound·main.js onWound)
        // 칼끝이 들어가지 못한 찌르기에는 팔 유효 질량을 싣지 않는다 (아픔·비틀거림·옷·투구·기절이 부풀지 않게)
        if (assisted) ({ mEff, ephys, energy } = assisted);
      }
    }
    if (type === 'blunt') energy *= att.weaponCfg.power * att.weaponCfg.mBlunt * emoDealt * emoTaken;
    return {
      type,
      zone,
      energy,
      ephys,
      mFree,
      severity,
      pass,
      absorb: A.absorb ?? 100,
      bleedPerSev: (ANATOMY[zone] || ANATOMY.chest).bleed * (att.weapon?.bleedMult ?? 1), // 모노호시자오 '제비 베기': 출혈 배율
      local: vicLocal,
      point: point.clone(),
      dir,
      speed,
      mEff,
      t,
      helmet,
      helmetBlunt,
      plate, // 판금 위를 맞았나 (fighter.applyWound 가 판을 깎고, 겉모습·소리는 강철로)
      thr,
      eff,
      bladeAxis: axis.clone(),
      finish, // 내려찍기 즉사 (사장님 결정 9/30, fighter.applyWound)
      ...(['armorCausal', 'armorGuard'].includes(finishRuleModel) ? { bareThreshold, armorBlocked: finishRuleResult?.armorBlocked ?? false, finishRuleReason: finishRuleResult?.reason ?? 'ineligible' } : {}),
      ...(finishRuleModel === 'armorGuard' ? { armorGuarded: finishRuleResult?.armorGuarded ?? false } : {}),
    };
  }

  /** 매 물리 스텝 직후: 가르고 있는 칼 처리 + 일반 충돌(튕김) 처리 */
  afterStep(world, eventQueue) {
    this.stepNo++;
    // 1) 가르고 지나가는 칼: 몸 속을 지나는 동안 매 순간 저항을 받는다
    const dt = world.timestep;
    this.dt = dt;
    for (const [key, c] of this.cutting) {
      if (c.pr.v.detached || c.pr.w.fighter.detachedParts?.has('farmS')) { this.cutting.delete(key); continue; }
      if (this.stepNo - c.seen > 2 && !(c.stuckT > 0)) {
        this.cutting.delete(key); // 더 이상 겹치지 않음
        continue;
      }
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
      if (point && spikeHead(c.pr)) {
        const S = c.pr.w.fighter.cache?.sword, P = c.pr.v.fighter.cache?.parts[c.pr.v.part];
        if (!S || !P || !this.analyze(c.pr, point, S, P, true)?.pass) {
          this.cutting.delete(key);
          continue;
        }
      }
      if (!c.applied) {
        if (!point) continue; // 아직 실제로 닿지 않음 (가까이만 옴)
        c.applied = true;
        const r = this.strike(c.pr, point, true); // 상처는 처음 닿는 순간에 한 번
        // Finish this contact's resistance before dropping a detached pair.
        // The attached proximal segment still resists subsequent contacts.
        if (c.pr.v.detached) this.cutting.delete(key);
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
      if (this.cutReactionModel === 'budgeted') {
        const cutReaction = applyBudgetedCutResistance({ sw, vb, point, dir, s, dt, cut: c, strike: STRIKE, step: this.stepNo, key });
        if (cutReaction) this.onCutReaction?.(cutReaction);
        continue;
      }
      let J = 0;
      if (c.Eleft > 0) {
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
        if (centerlineCutEnabled(this, c.pr.w.fighter)) {
          const reaction = applyCenterlineCutImpulse(sw, vb, vp(pA), dir, J);
          // Eleft and stuckT above deliberately retain the legacy requested-J policy.
          this.onCutReaction?.({ ...reaction, mode: 'centerline', key, step: this.stepNo });
        } else {
          sw.applyImpulseAtPoint({ x: -dir.x * J, y: -dir.y * J, z: -dir.z * J }, vp(pA), true);
          const pv = onBone(c.pr.v, point);
          vb.applyImpulseAtPoint({ x: dir.x * J * 0.8, y: dir.y * J * 0.8, z: dir.z * J * 0.8 }, vp(pv), true);
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
      if (spikeHead(pr)) {
        const S = pr.w.fighter.cache?.sword || liveState(pr.w.body);
        const P = pr.v.fighter.cache?.parts[pr.v.part] || liveState(pr.v.body);
        const passing = !!this.analyze(pr, c.p, S, P)?.pass;
        const r = this.strike(pr, c.p, passing);
        if (r?.pass) {
          this.cutting.set(`${pr.wc}:${pr.vc}`, {
            seen: this.stepNo, applied: true, pr, wc: pr.wc, vc: pr.vc,
            Eleft: Math.min(r.energy, r.absorb) / STRIKE.energyScale,
            stuck: r.stuck, mFree: r.mFree, stuckT: 0,
            localPt: c.p.clone().sub(tv(pr.w.body.translation())).applyQuaternion(rotQ(pr.w.body).invert()),
          });
          return;
        }
      } else this.strike(pr, c.p, false);
      this.rebound(pr, c.p, c.n);
    });
    this.bladeClash(world, bladePairs);
    this.armSteel();
    for (const f of this.fighters) if (f.weapon?.gun) updateGun(f, world, this, dt); // 권총(??? 등급): 걸어 둔 한 발 쏘기·장전 (gun.js)
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
    const SA = A.fighter.cache?.sword;
    const SB = B.fighter.cache?.sword;
    let vn = 0;
    let vt = 0;
    if (SA && SB && J > 0) {
      const r = velAt(SA, point, _a).sub(velAt(SB, point, _b));
      vn = Math.max(0, r.dot(nrm));
      vt = Math.sqrt(Math.max(0, r.lengthSq() - r.dot(nrm) ** 2));
    }
    const fresh = this.stepNo - this.bladeLast > STEEL.rearmSteps; // 떨어져 있다가 새로 부딪힘
    this.bladeLast = this.stepNo;
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
        fe.impact = J;
        fe.impactSpeed = vn;
        f.takeJolt?.(J);
        f.absorbWeaponImpact?.(J, f === A.fighter ? B.fighter : A.fighter); // 칼끼리 세게 부딪힌 몫만큼 내구도가 있는 무기(나뭇가지 등)를 깎는다 (상대 칼의 breakMult — 청강검 '창천')
      }
    }
    this.hooks.onClash?.(point, sp, { fresh, vn, vt, force, impulse: J, normal: nrm });
  }

  /** 칼끼리 맞댄 채(바인드)엔 반발을 끈다: 누를 때마다 접촉점이 새로 생기며 튕겨 떨리지 않게 */
  armSteel() {
    const armed = this.stepNo - this.bladeLast > STEEL.rearmSteps;
    if (armed === this.steelArmed) return;
    this.steelArmed = armed;
    // 무기마다 재질이 다를 수 있어(강철/나무/고무…) 되돌릴 때도 각자 자기 재질 반발값을 쓴다
    for (const f of this.fighters) {
      const e = armed ? (f.restitution ?? STEEL.restitution) : 0;
      for (const c of f.swordColliders || []) c.setRestitution(e);
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
    if (zone === 'head') e = !noArmor && vic.hasHelmet && vicLocal.y > -0.01 ? STEEL.steel : STEEL.bone; // 투구 / 맨머리
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
    if (pr.v.detached || pr.w.fighter.detachedParts?.has('farmS')) return null;
    const att = pr.w.fighter;
    const vic = pr.v.fighter;
    const key = `${att.index}:${pr.v.part}`;
    // 속도는 스텝 "직전" 값을 쓴다. 튕긴 충돌은 스텝 뒤엔 이미 속도가 꺾여 있어서 에너지가 작게 나온다.
    const S = att.cache?.sword || liveState(pr.w.body);
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
    vic.hitCooldowns.set(key, STRIKE.hitCooldown);
    if (passing) r.stuck = r.energy <= r.absorb; // 에너지가 모자라 칼이 박힘
    if (r.type !== 'blunt' || r.severity > 0 || r.energy > 10) {
      vic.applyWound({ ...r, part: pr.v.part, passing }); // passing: 칼이 가르고 지나가는 길(참수는 이 길만)
    }
    this.hooks.onWound?.(att, vic, r, point, pr);
    return r;
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
  const lim = Math.max(Math.abs(f.cache.sword.w.dot(ax)), STEEL.gripTwistMax);
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

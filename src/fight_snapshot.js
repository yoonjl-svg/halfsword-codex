// 싸움 몸 상태 사본 — 방랑 '이어하면 그 상황 그대로'의 (b) 몸 상태 이어받기 (사장님 10/30 01:1x · 감독 안 — wander_rules.js WANDER.resumeState 스위치)
//  셈 칸만 읽고 쓴다 (그림 · 물리 · 난수 없음 — 자리 · 속도 · 휘두르던 칼 · AI 기억은 옮기지 않는다 = 새 판의 시작 자리에서 그 몸으로 다시 시작):
//   피 · 출혈 · 의식 · 아픔 · 팔다리 기능 · 상처 목록 · 무기 부러짐 · 기력 · 쓴 비기 수 · 남은 부활 수
//  동시 대전 가지(wk/team-fight)의 fighter.snapshot · applySnapshot 과 같은 꼴(v 1 — 몸 칸만) + 기력 · 비기 · 부활. fighter.js 는 고치지 않는다(바깥에서 같은 칸을 씀).
//  상처 자국(그림)은 다시 그리지 않는다 — 상처 셈(팔다리 기능 · 출혈)만.
//  생사전 (사장님 10/30 08:2x "몸 상태 이어받기 방랑 · 생사전 둘 다 켜."): 넷의 몸을 같은 꼴로 · 들고 온 상처 표시(carried — 경기 전 부상: 판 끝 결과에서 다시 세지 않음) · 죽은 몸은 죽은 채(dead)
import * as THREE from 'three';
import { VITALS } from './config.js';

/** 몸 → 사본 (JSON 으로 저장 가능) */
export function snapshotFighter(f) {
  if (!f) return null;
  return {
    v: 1,
    weapon: f.weapon?.id ?? null,
    blood: f.blood,
    bleed: f.bleed,
    consciousness: f.consciousness,
    pain: f.pain,
    limbs: { ...f.limbs },
    wounds: (f.wounds ?? []).map((w) => ({
      part: w.part, type: w.type, severity: w.severity, bleed: w.bleed, local: w.local ? [w.local.x, w.local.y, w.local.z] : [0, 0, 0],
      ...(w.stump ? { stump: true } : {}), ...(w.limb ? { limb: w.limb } : {}), ...(w.carried ? { carried: true } : {}),
    })),
    weaponBroken: !!f.weaponBroken,
    ...(f.alive === false ? { dead: true, cause: f.causeOfDeath ?? null } : {}),
    stamina: Number.isFinite(f.stamina?.value) ? f.stamina.value : null,
    secretUsed: f.secretUsed ?? 0,
    reviveLeft: f.revive?.left ?? null,
  };
}

const num = (x, lo, hi) => Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : null;
/**
 * 새 판 몸에 사본을 입힌다 (판을 세운 뒤 · 첫 스텝 전). 무기가 사본과 다르면(대기실에서 장착을 바꿈) 부러짐은 옮기지 않는다.
 *  칼 쥔 팔 기능이 칼을 놓치는 문턱 밑이면 처음부터 칼을 놓친다(싸움 상처와 같은 규칙). 돌려줌: 입혔나
 */
export function applyFighterSnapshot(f, s) {
  if (!f || !s || s.v !== 1) return false;
  const blood = num(s.blood, 0, 1);
  if (blood != null) f.blood = blood;
  const bleed = num(s.bleed, 0, 10);
  if (bleed != null) f.bleed = bleed;
  const cons = num(s.consciousness, 0, 1);
  if (cons != null) f.consciousness = cons;
  const pain = num(s.pain, 0, 10);
  if (pain != null) f.pain = pain;
  if (s.limbs && typeof s.limbs === 'object') for (const k of Object.keys(f.limbs ?? {})) { const v = num(s.limbs[k], 0, 1); if (v != null) f.limbs[k] = v; }
  if (Array.isArray(s.wounds)) {
    f.wounds = s.wounds.filter((w) => w && typeof w.part === 'string').map((w) => ({
      part: w.part, type: w.type, severity: Number(w.severity) || 0, bleed: Number(w.bleed) || 0,
      local: new THREE.Vector3(...(Array.isArray(w.local) ? w.local.map((x) => Number(x) || 0) : [0, 0, 0])),
      ...(w.stump ? { stump: true } : {}), ...(w.limb ? { limb: w.limb } : {}), ...(w.carried ? { carried: true } : {}),
    }));
  }
  if (s.weaponBroken && s.weapon === f.weapon?.id && !f.weaponBroken && f.weapon?.fragile && typeof f.breakWeapon === 'function') f.breakWeapon(true); // 조용히(판을 세울 때 — 조각을 날리지 않음 · 인자를 모르는 판은 그냥 부러짐)
  const st = num(s.stamina, 0, 1e4);
  if (st != null && f.stamina) f.stamina.value = Math.min(st, f.stamina.max ?? st);
  if (Number.isSafeInteger(s.secretUsed) && s.secretUsed > 0) f.secretUsed = s.secretUsed;
  if (Number.isSafeInteger(s.reviveLeft) && f.revive) f.revive.left = Math.min(f.revive.left, Math.max(0, s.reviveLeft));
  if ((f.limbs?.armS ?? 1) < VITALS.dropSwordArm && f.armed && typeof f.dropSword === 'function') f.dropSword();
  if (s.dead && f.alive !== false && typeof f.setState === 'function') { // 죽은 몸은 죽은 채 (부활 · 흙 몸 규칙을 다시 타지 않음 — 이미 셈이 끝난 죽음)
    f.causeOfDeath = s.cause ?? f.causeOfDeath ?? null;
    f.setState('dead');
    if (f.alive !== false) f.state = 'dead'; // 흙 몸(canDie 거짓)도 — 머리가 떨어져 죽은 몸이었다
  }
  return true;
}

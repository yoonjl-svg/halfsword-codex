// ─────────────────────────────────────────────────────────────
//  약한 자세 겨눔 (스위치 FINISH.vital — 낮은 상대 진입 FINISH.entry 'low' 와 한 묶음, 10/12)
//   사장님 10/12 02:3x 지시로 샛별 저장소 ccea5855 · fdc6a4ed · 07206655 · 8bbee803 의 뜻을 우리 코드에 옮겼다.
//   기록: docs/import/saetbyeol_vital_2026-10-12.md · 확인표 1001~1008 (사장님 확인 전). 추천 기본: 묶음 켬 · 찌르기 켬 · AI 목 가로 베기 끔 · 플레이어 베기 보정 끔 (측정 §4)
//
//  뜻: 상대가 무릎 꿇음·일어나는 중·넘어지는 중(kneel·getup·down)이고 실제로 몸이 낮거나 기울었으면
//   · 베기는 목을 가로지르는 기술로 (AI: 기술 고르기를 목 가로 기술로 좁히고, 손 높이·칼 기울기를 목 높이로 준비)
//   · 찌르기는 목·얼굴·머리로 (못 겨누면 보통처럼 가슴)
//   · 완전히 낮은 몸(누움)은 내려찍기(finish.js)가 맡는다 — 같은 높이 문턱(LOW_FINISH)
//  힘·빠르기·피해 배율·즉사·확률은 하나도 바꾸지 않는다. 겨눌 곳과 준비만 바꾼다. 맞느냐·뚫느냐는 충돌·갑옷·상처 문턱 그대로.
//  아래 길이·각 예산은 게임 설계값이다 (사람 실측 한계가 아니다 — 샛별 쪽 값 그대로).
//  끄면(FINISH.vital false) 어느 줄도 타지 않는다 — 난수·명령 그대로.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { ARM, THRUST } from './config.js';
import { guardAt } from './guards.js';
import { FINISH } from './finish.js';
import { LOW_FINISH, lowFinishOn } from './finish_entry.js';

export const VITAL = {
  // 묶음 안 갈래 스위치 (FINISH.vital 이 켜져 있을 때만 읽는다 — 무엇이 얼마나 바꿨는지 나눠 재려고). 주소 ?vitalAi=0|1 · ?vitalThrust=0|1 · ?vitalCut=0|1
  aiCut: false, // AI: 기술 고르기를 목 가로 베기로 좁히고 손 높이·칼 기울기를 목 높이로 준비 — 추천 끔 (자연 결투 48 판 참수 26 → 21~22, 무 3 → 5~8 · 첫 몸 접촉 목·머리 2/9). ?vitalAi=1
  thrust: true, // 찌르기(AI·플레이어 탭): 목·얼굴·머리 점 + 플레이어 간격 맞추기 — 추천 켬. ?vitalThrust=0
  playerCut: false, // 플레이어: 느린 준비 동안 베기 길을 목 높이로 (겨눔 보정) — 추천 끔 (장면 9 판 목·머리 2 → 2, 손 느낌만 바뀜). ?vitalCut=1
  faceLocalX: 0.075, // 얼굴 점: 머리 몸체 기준 앞 (m)
  faceLocalY: -0.025, // 얼굴 점: 머리 몸체 기준 아래 (m)
  guardRadius: 0.14, // 상대 칼이 목표 앞 마지막 길을 이만큼 안에서 가리면 겨누지 않는다 (m)
  guardNearTarget: 0.34, // 상대 칼이 목표에서 이만큼 안에 있을 때만 가림을 본다 (m)
  minForward: 0.2, // 목표가 내 가슴 앞 이만큼은 있어야 (m)
  maxSideRatio: 0.85, // 옆 / 앞 비율 한도
  reachSlack: 0.04, // 닿는 거리 여유 (m)
  minimumChestDrop: 0.12, // 상대 가슴이 내 가슴보다 이만큼 낮거나 (m)
  maximumUprightCos: Math.cos(Math.PI / 6), // 상체가 30° 넘게 기울었어야 (똑바로 선 채 낮추기만 한 상대는 아니다)
  handHeightBudget: 0.24, // 준비 손 높이 보정 최대 (m)
  pitchBudget: 0.28, // 준비 칼 기울기 보정 최대 (rad)
  prepareSpeed: 0.75, // 손 높이 보정 빠르기 (m/s)
  prepareTurn: 1.6, // 칼 기울기 보정 빠르기 (rad/s)
  fastInput: 2, // 플레이어: 손 목표가 이보다 빠르면 준비를 기다리지 않고 곧장 친다 (m/s)
  commitAngularSpeed: 1.5, // 플레이어: 칼이 이만큼 돌기 시작하면 친 것 (rad/s)
  prepareWindow: 0.4, // 플레이어: 느린 준비 시간 (s) — 0.24 m ÷ 0.75 m/s = 0.32 s + 여유
  quietReset: 0.12, // 플레이어: 친 뒤 손이 이만큼 쉬면 보정을 푼다 (s)
  readyHeightChange: 0.06, // 플레이어: 준비 뒤 손 높이를 이만큼 바꾸면 새 뜻 — 보정을 푼다 (패드 m)
  // 물리 길 (샛별 fdc6a4ed): 지금 칼이 명령보다 처진·들린 몫의 절반을 더 보정한다 (예산 안)
  trackingShare: 0.5,
  heightTrim: 0.24 * 0.25,
  pitchTrim: 0.28 * 0.25,
  // 무기별 간격 (샛별 8bbee803, 플레이어 탭 찌르기): 칼끝이 목표 바로 앞에 오도록 걸어 맞춘 뒤 찌른다
  rangeTravel: 1, // 목표가 닿는 거리보다 이만큼(m) 멀어도 겨눈다 (걸어 들어간다)
  rangeTimeout: 2, // 간격 맞추기 최대 (s)
  rangeAlignCos: Math.cos((20 * Math.PI) / 180), // 칼 축이 목표 쪽 20° 안
  rangeLineMiss: 0.07, // 칼 선이 목표를 비껴가는 거리 한도 (m)
  manualDead: 0.15, // 조이스틱을 이만큼 넘게 밀면 간격 맞추기를 거둔다
  // 찌르기 점: 겨누는 동안(THRUST.aim)은 상대 머리에 붙은 점을 따라가다 뻗기 시작할 때 세계 점으로 고정 (우리 보통 찌르기가 가슴을 따라가는 것과 같은 몫).
  //  false = 탭 때 세계 점 고정 (샛별 쪽 그대로). 측정: 크게 넘어뜨림 12 판 헛침 12/37 (따라감) · 18/44 (고정)
  track: true,
};

export const vitalOn = () => !!FINISH.vital;
const clamp = THREE.MathUtils.clamp;
const xyz = (v) => ({ x: v.x, y: v.y, z: v.z });
const vec = (v) => new THREE.Vector3(v.x, v.y, v.z);
const finite = (v) => !!v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
const quat = (q) => new THREE.Quaternion(q.x, q.y, q.z, q.w);
const elevation = (v) => Math.atan2(v.y, Math.hypot(v.x, v.z));

function localPoint(p, q, x, y, z) {
  return xyz(new THREE.Vector3(x, y, z).applyQuaternion(quat(q)).add(vec(p)));
}

/** 상대 모습 사본 (AI 는 반응 지연 기록에 넣어 늦게 본다 — ai_sense.js). 살아 있는 몸 참조를 담지 않는다 */
export function captureVitalPose(f) {
  if (!f?.bodies?.head || !f.bodies.chest || !f.bodies.pelvis) return null;
  const head = xyz(f.bodies.head.translation());
  const headQ = (({ x, y, z, w }) => ({ x, y, z, w }))(f.bodies.head.rotation());
  const chestQ = (({ x, y, z, w }) => ({ x, y, z, w }))(f.bodies.chest.rotation());
  return {
    targetId: f.index, state: f.state, alive: !!f.alive, armed: !!f.armed, headOff: !!f.decapitated,
    head, chest: xyz(f.bodies.chest.translation()), pelvis: xyz(f.bodies.pelvis.translation()), headQ, chestQ,
    headRadius: f.headR, hasHelmet: !!f.hasHelmet, helmetMinY: f.helmetSpec?.coverMinY ?? -0.01,
    // 목 점: 우리 목 구역 가운데 (finish.js FINISH.neckAt — 머리 몸체 아래 −0.10 ~ 투구 끝 −0.01 의 가운데)
    neck: localPoint(head, headQ, 0, FINISH.neckAt, 0),
    face: localPoint(head, headQ, VITAL.faceLocalX, VITAL.faceLocalY, 0),
    bladeBase: f.armed ? xyz(f.bladePoint(0, new THREE.Vector3())) : null,
    bladeTip: f.armed ? xyz(f.bladePoint(1, new THREE.Vector3())) : null,
  };
}

function pointSegmentDistance(p, a, b) {
  const d = vec(b).sub(vec(a));
  const t = clamp(vec(p).sub(vec(a)).dot(d) / Math.max(d.lengthSq(), 1e-12), 0, 1);
  return vec(a).addScaledVector(d, t).distanceTo(vec(p));
}

/** 상대 칼이 목표 바로 앞 길을 가리나 (겨누지 않을 뿐 — 충돌을 대신하지 않는다) */
function vitalBlocked(origin, target, snap) {
  const a = snap?.bladeBase;
  const b = snap?.bladeTip;
  if (!snap?.armed || !finite(a) || !finite(b)) return false;
  if (pointSegmentDistance(target, a, b) > VITAL.guardNearTarget) return false;
  const T = vec(target);
  const start = T.clone().lerp(vec(origin), Math.min(1, 0.45 / Math.max(1e-6, T.distanceTo(vec(origin)))));
  for (let i = 0; i <= 8; i++) if (pointSegmentDistance(start.clone().lerp(T, i / 8), a, b) <= VITAL.guardRadius) return true;
  return false;
}

/** 찌르기 겨눔 후보 (샛별 07206655): 머리 공 안쪽 점들 + 목. 투구가 덮지 않은 길 → 가운데 → 지금 칼 축과 가까운 순 */
function thrustCandidates(snap, origin, axis) {
  const radius = snap.headRadius;
  if (!Number.isFinite(radius) || radius <= 0 || axis.lengthSq() < 0.5) return [];
  const center = vec(snap.head);
  const from = vec(origin);
  const dir = axis.clone().normalize();
  const rotation = quat(snap.headQ);
  const inset = radius * 0.65;
  const projected = from.clone().addScaledVector(dir, Math.max(0, center.clone().sub(from).dot(dir)));
  const offset = projected.sub(center);
  const points = [
    ['head', center.clone(), 0],
    ...[[0.45, -0.35, 0], [-0.45, -0.35, 0], [0, -0.35, 0.45], [0, -0.35, -0.45]].map((a) => ['head', center.clone().add(new THREE.Vector3(...a).multiplyScalar(radius).applyQuaternion(rotation)), 0]),
    ...[[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((a) => ['head', center.clone().addScaledVector(new THREE.Vector3(...a), inset), 1]),
  ];
  if (offset.length() <= radius * 0.35) points.unshift(['head', center.clone().add(offset), 0]);
  points.push(['neck', vec(snap.neck), 0]);
  const inv = rotation.clone().invert();
  return points
    .map(([zone, point, fallback]) => {
      const ray = point.clone().sub(from);
      if (ray.lengthSq() <= 1e-12) return null;
      ray.normalize();
      const toCenter = center.clone().sub(from);
      const along = toCenter.dot(ray);
      const disc = along * along - (toCenter.lengthSq() - radius * radius);
      const entry = disc >= 0 ? along - Math.sqrt(disc) : -1;
      const covered = snap.hasHelmet && entry >= 0 && from.clone().addScaledVector(ray, entry).sub(center).applyQuaternion(inv).y > (snap.helmetMinY ?? -0.01);
      return { zone, point, fallback, covered: !!covered, alignment: ray.dot(dir) };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.covered) - Number(b.covered) || a.fallback - b.fallback || b.alignment - a.alignment);
}

/**
 * 약한 자세 빈틈 찾기. 상대는 snap 만 읽는다 (AI 는 늦게 본 기록). 내 몸은 지금 것.
 * @param kind 'cut' | 'thrust'
 * @param extra 찌르기에서 닿는 거리 밖으로 더 볼 거리 (플레이어 간격 맞추기 VITAL.rangeTravel)
 * @returns { target: Vector3(세계), zone, kind, targetId } | null
 */
export function findVital(att, snap, kind, extra = 0) {
  if (!vitalOn() || !att.alive || !att.armed || att.weapon?.gun || att.weaponBroken || (att.state !== 'stand' && att.state !== 'kneel')) return null;
  if (!snap?.alive || snap.headOff || !['kneel', 'down', 'getup'].includes(snap.state)) return null;
  const cfg = att.weaponCfg;
  if (kind === 'cut' && (!cfg.edged || !(cfg.mCut > 0))) return null;
  if (kind === 'thrust' && (!(cfg.edged || cfg.spike) || !(cfg.mThrust > 0))) return null;
  if (kind !== 'cut' && kind !== 'thrust') return null;
  if (![snap.head, snap.chest, snap.pelvis, snap.neck].every(finite)) return null;
  const chest = att.bodies.chest.translation();
  // 이름만 바뀐 넘어짐은 아니다: 가슴이 실제로 낮거나 상체가 30° 넘게 기울었어야
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat(snap.chestQ));
  if (snap.chest.y > chest.y - VITAL.minimumChestDrop && up.y > VITAL.maximumUprightCos) return null;
  // 내려찍기가 맡는 몸은 건드리지 않는다 (낮은 상대 진입 'low' 의 같은 문턱 · 'down' 판이면 쓰러짐 이름)
  const top = Math.max(snap.chest.y, snap.pelvis.y);
  const ground = att.terrain ? att.terrain.heightAt(snap.pelvis.x, snap.pelvis.z) : 0; // 지형 무대(화산섬): 상대 골반 밑 땅 위 높이로 (finish_entry 와 같은 문턱)
  const lowBody = (att.terrain ? top - ground : top) <= LOW_FINISH.enterHeight && top + LOW_FINISH.minimumDrop < chest.y;
  const finishOwns = lowFinishOn(FINISH)
    ? (snap.state === 'down' || snap.state === 'getup') && lowBody
    : snap.state === 'down' || (FINISH.entry === 'downlow' && snap.state === 'getup' && lowBody);
  if (finishOwns) return null;
  const yaw = att.yaw;
  const cq = att.bodies.chest.rotation();
  const shoulder = new THREE.Vector3(ARM.shoulder[0], ARM.shoulder[1], ARM.shoulder[2] * (att.side ?? 1)).applyQuaternion(quat(cq)).add(vec(chest));
  const reach = ARM.upper + ARM.fore - ARM.slack + cfg.hiltLength + cfg.bladeLength + VITAL.reachSlack + (kind === 'thrust' ? extra : 0);
  const origin = xyz(att.sword.translation());
  const inv = yaw.clone().invert();
  let cands;
  if (kind === 'thrust') {
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(quat(att.sword.rotation()));
    cands = thrustCandidates(snap, origin, axis).map((p) => [p.zone, p.point]);
  } else cands = [['neck', vec(snap.neck)]];
  for (const [zone, point] of cands) {
    if (!finite(point)) continue;
    const local = point.clone().sub(vec(chest)).applyQuaternion(inv);
    if (local.x < VITAL.minForward || Math.abs(local.z) > local.x * VITAL.maxSideRatio) continue;
    if (shoulder.distanceTo(point) > reach || vitalBlocked(origin, point, snap)) continue;
    return { target: point.clone(), zone, kind, targetId: snap.targetId };
  }
  return null;
}

// ── 명령 기하 (손 목표·칼끝 방향 — 몸 틀) ──────────────────────

/** 높이만 바꾸고 수평 방향은 그대로 두는 칼 기울기 보정 */
export function applyElevation(aim, pitch) {
  if (!pitch) return aim;
  const h = Math.hypot(aim.x, aim.z);
  if (h < 1e-8) return aim;
  const el = clamp(Math.atan2(aim.y, h) + pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
  const s = Math.cos(el) / h;
  aim.x *= s;
  aim.z *= s;
  aim.y = Math.sin(el);
  return aim;
}

/** 목을 가로지르는 베기인가 (기술 길 꼴만 본다 — 무기·기술 이름이 아니라): 좌우를 건너고(0.3 넘게) 높이 변화가 가로의 65 % 안 */
export function neckCrossingTechnique(tech) {
  if (tech?.kind !== 'cut' || !tech.from || !tech.path?.length) return false;
  const first = tech.from;
  const last = tech.path[tech.path.length - 1];
  const dx = Math.abs(last[0] - first[0]);
  if (first[0] * last[0] >= 0 || dx < 0.3) return false;
  const ys = [first, ...tech.path].map((p) => p[1]);
  return Math.max(...ys) - Math.min(...ys) <= dx * 0.65;
}

/** 이 무기로 노릴 것: 찌르기 기술이면 찌르기, 아니면 베기 (찌르기 배율이 더 큰 무기는 찌르기) */
export function vitalWeaponKind(me, tech = null) {
  if (me.weapon?.gun || me.weaponBroken) return null;
  const cfg = me.weaponCfg;
  if (!cfg) return null;
  if (tech?.kind === 'thrust') return (cfg.edged || cfg.spike) && cfg.mThrust > 0 ? 'thrust' : null;
  if (!cfg.edged || !(cfg.mCut > 0)) return null;
  if (!tech && cfg.mThrust > cfg.mCut) return 'thrust';
  return 'cut';
}

function targetLocal(f, world) {
  const c = f.bodies.chest.translation();
  return world.clone().sub(new THREE.Vector3(c.x, c.y, c.z)).applyQuaternion(f.yaw.clone().invert());
}

/**
 * 베기 길이 목 앞(좌우 0)을 지나는 곳의 명령 높이 (샛별 opportunityAICrossing — 우리 손 지도 fighter.strokeCommand 로).
 *  points: 패드 길 [[x, y], …], lateral: 손을 옆으로 옮기는 몫 (AI moveHand 와 같은 식). 칼 몸체 위에 있어야 한다. 접촉 예측이 아니다
 */
export function strokeCrossing(f, points, target, lateral = 0) {
  const local = targetLocal(f, target);
  const cfg = f.weaponCfg;
  const H = new THREE.Vector3();
  const D = new THREE.Vector3();
  const pathY = (x) => {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      if (x < Math.min(a[0], b[0]) || x > Math.max(a[0], b[0]) || a[0] === b[0]) continue;
      return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
    }
    return points[0][1];
  };
  const sample = (pathX) => {
    let x = clamp(pathX + lateral, -0.6, 0.6);
    let y = pathY(pathX);
    const n = Math.hypot(x, y);
    if (n > 0.62) (x *= 0.62 / n), (y *= 0.62 / n);
    f.strokeCommand(x, y, H, D);
    if (D.x <= 0.05 || local.x <= H.x) return null;
    const along = (local.x - H.x) / D.x;
    if (along < cfg.hiltLength || along > cfg.hiltLength + cfg.bladeLength) return null;
    return { pathX, hand: H.toArray(), aim: D.toArray(), height: H.y + D.y * along, sideError: H.z + D.z * along - local.z, along };
  };
  const minX = Math.min(...points.map((p) => p[0]));
  const maxX = Math.max(...points.map((p) => p[0]));
  const line = Array.from({ length: 17 }, (_, i) => sample(minX + ((maxX - minX) * i) / 16));
  let br = null;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    if (a && b && a.sideError * b.sideError <= 0 && (!br || Math.abs(a.pathX + b.pathX) < Math.abs(br[0].pathX + br[1].pathX))) br = [a, b];
  }
  if (!br) return null;
  let [a] = br;
  let lo = br[0].pathX;
  let hi = br[1].pathX;
  let c = null;
  for (let i = 0; i < 10; i++) {
    c = sample((lo + hi) / 2);
    if (!c) return null;
    if (a.sideError * c.sideError <= 0) hi = c.pathX;
    else (lo = c.pathX), (a = c);
  }
  return Math.abs(c.sideError) <= 0.04 ? c : null;
}

/**
 * 준비 보정 목표 (샛별 fdc6a4ed '물리 길'): 명령 길이 목 높이를 지나게 손 높이·칼 기울기를 정하고,
 *  지금 칼이 명령보다 처지거나 들린 몫의 절반을 더한다(예산 안). 내 몸만 읽는다
 */
export function pathGoal(f, target, ref) {
  if (!ref) return null;
  const hand = new THREE.Vector3(...ref.hand);
  const aim = new THREE.Vector3(...ref.aim).normalize();
  const local = targetLocal(f, target);
  let heightTrim = 0;
  let pitchTrim = 0;
  const o = f.sword.translation();
  if (finite(f.handTarget)) heightTrim = clamp(-(o.y - f.handTarget.y) * VITAL.trackingShare, -VITAL.heightTrim, VITAL.heightTrim);
  if (finite(f.aimDirW)) {
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(quat(f.sword.rotation()));
    const cmd = f.aimDirW;
    const ah = Math.hypot(axis.x, axis.z);
    const ch = Math.hypot(cmd.x, cmd.z);
    if (ah > 0.2 && ch > 0.2 && (axis.x * cmd.x + axis.z * cmd.z) / (ah * ch) >= Math.SQRT1_2) {
      pitchTrim = clamp(-(elevation(axis) - elevation(cmd)) * VITAL.trackingShare, -VITAL.pitchTrim, VITAL.pitchTrim);
    }
  }
  const handY = clamp((local.y - ref.height) * 0.55 + heightTrim, -VITAL.handHeightBudget, VITAL.handHeightBudget);
  const wanted = Math.atan2(local.y - hand.y - handY, Math.max(0.2, Math.hypot(local.x - hand.x, local.z - hand.z)));
  const pitch = clamp(wanted - elevation(aim) + pitchTrim, -VITAL.pitchBudget, VITAL.pitchBudget);
  return { handY, pitch };
}

/** 보정 명령을 목표 쪽으로 빠르기 한도 안에서 옮긴다 */
function ramp(cmd, y, p, dt) {
  cmd.handY += clamp(y - cmd.handY, -VITAL.prepareSpeed * dt, VITAL.prepareSpeed * dt);
  cmd.pitch += clamp(p - cmd.pitch, -VITAL.prepareTurn * dt, VITAL.prepareTurn * dt);
}

/** driveSword 가 부르는 덧씌우기 (손 높이 · 칼 기울기). 탭 찌르기·마무리 자세 동안은 걸지 않는다. 0 이면 손대지 않는다 */
function liveCmd(f) {
  const c = f.vitalCmd;
  return c && (c.handY || c.pitch) && f.alive && f.armed && (f.state === 'stand' || f.state === 'kneel') && !f.skill.tap && !(f.finish?.amt > 0) ? c : null;
}
export function vitalHand(f, hand) {
  const c = liveCmd(f);
  if (c) hand.y += c.handY;
}
export function vitalAim(f, aim) {
  const c = liveCmd(f);
  if (c) applyElevation(aim, c.pitch);
}

// ── AI (ai.js 가 부른다 — 상대는 반응 지연 기록 s.vital 만 본다) ─────────

/** 지금 노릴 빈틈 (AI). 상대 칼끝이 나를 겨누면(online) 들어가지 않는다 — 보통 공격 규칙 그대로 */
export function aiVitalCandidate(ai, s, tech = null) {
  const snap = s?.vital;
  if (!vitalOn() || !snap || ai.me.skill?.tap || ai.me.finish?.amt > 0 || (snap.armed && ai.foeClass(s).online)) return null;
  const kind = vitalWeaponKind(ai.me, tech);
  if (!kind || (tech && kind === 'cut' && !neckCrossingTechnique(tech))) return null;
  if ((kind === 'cut' && !VITAL.aiCut) || (kind === 'thrust' && !VITAL.thrust)) return null;
  return findVital(ai.me, snap, kind);
}

/** 공격 준비: 목 가로 베기면 길이 목 앞을 지나는 높이를 재고 손·칼 보정 목표를 정한다 */
export function aiVitalPrepare(ai, s, tech) {
  const found = aiVitalCandidate(ai, s, tech);
  if (!found) return null;
  if (found.kind === 'thrust') return { ...found, started: false };
  const cross = strokeCrossing(ai.me, [tech.from, ...tech.path], found.target, clamp(ai.foeLat, -0.4, 0.4) * 0.5);
  const goal = cross && pathGoal(ai.me, found.target, cross);
  return goal ? { ...found, cross, goal, started: false } : null;
}

/** 매 AI 스텝: 준비 중엔 목표 쪽으로, 친 뒤엔 고정, 풀리면 0 으로 */
export function aiVitalAdvance(ai, dt) {
  const me = ai.me;
  const cmd = (me.vitalCmd ||= { handY: 0, pitch: 0 });
  const lock = ai.vital;
  const usable = lock?.kind === 'cut' && ai.mode === 'attack' && me.alive && me.armed && (me.state === 'stand' || me.state === 'kneel') && !me.skill.tap && !(me.finish?.amt > 0);
  if (usable && lock.started) return;
  if (usable) {
    const g = pathGoal(me, lock.target, lock.cross) ?? lock.goal;
    ramp(cmd, g.handY, g.pitch, dt);
  } else ramp(cmd, 0, 0, dt);
}

// ── 플레이어 (fighter.driveSword 가 매 스텝 부른다 — 무엇을 돕나: 느린 준비 동안의 겨눔 보정) ─────────
//  돕는 것: 상대가 약한 자세일 때 손가락으로 칼을 천천히 옮겨(준비) 가로로 베려 하면, 그 베기 길이 상대 목 앞을 지나도록
//   손 높이(최대 0.24 m)·칼 기울기(최대 0.28 rad)를 준비 0.4 s 동안 천천히 옮겨 준다. 좌우 길·빠르기·방향 바꾸기는 손가락 그대로.
//   빠르게 그으면 기다리지 않는다(보정 없이 곧장). 친 뒤엔 상대를 따라가지 않는다(목표는 준비 시작 때 몸 기준으로 고정).
//  돕지 않는 것: 힘·빠르기·맞음 판정. 탭 찌르기는 skill.js 가 목·얼굴·머리 점을 겨눈다 (아래 playerVitalThrust)

export function playerVitalUpdate(f, dt) {
  if (!vitalOn() || !VITAL.playerCut || f.index !== 0 || !(dt > 0)) return;
  const sk = f.skill;
  const st = (f.vitalPlayer ||= { phase: 'idle', age: 0, quiet: 0, captures: 0 });
  const cmd = (f.vitalCmd ||= { handY: 0, pitch: 0 });
  const speed = sk.vel.length();
  const moving = speed > 0.05;
  const av = f.sword.angvel();
  const angular = Math.hypot(av.x, av.y, av.z);
  st.quiet = moving ? 0 : st.quiet + dt;
  const eligible = f.alive && f.armed && !f.weapon?.gun && !f.weaponBroken && !sk.tap && !sk.sec && (f.state === 'stand' || f.state === 'kneel') && !(f.finish?.amt > 0);
  const foe = f.foe;
  if (st.phase !== 'idle' && (!eligible || st.foe !== foe || !foe?.alive || foe.decapitated)) st.phase = 'releasing';
  if (st.phase === 'committed' && st.quiet >= VITAL.quietReset && !sk.swinging && angular < VITAL.commitAngularSpeed) st.phase = 'releasing';
  if ((st.phase === 'preparing' || st.phase === 'ready') && (!f.handHeld || foe?.state === 'stand')) st.phase = sk.swinging ? 'committed' : 'releasing';
  if (st.phase === 'ready' && moving && Math.abs(sk.aim.y - st.padY) > VITAL.readyHeightChange) st.phase = 'releasing';
  if (st.phase === 'ready' && sk.swinging) st.phase = 'committed';
  if (st.phase === 'idle' && eligible && f.handHeld && moving && speed < VITAL.fastInput) {
    const found = findVital(f, captureVitalPose(foe), 'cut');
    if (found && aimGoal(f, st, found.target)) {
      st.phase = 'preparing';
      st.foe = foe;
      st.zone = found.zone;
      st.age = 0;
      st.captures++;
    }
  }
  if (st.phase === 'preparing') {
    st.age += dt;
    if (speed >= VITAL.fastInput || (sk.swinging && angular >= VITAL.commitAngularSpeed)) st.phase = 'committed';
    else if (st.age >= VITAL.prepareWindow) st.phase = 'ready';
    else if (Math.abs(sk.aim.y - st.padY) > 1e-6 && !aimGoal(f, st, null)) st.phase = 'releasing';
    else {
      const g = pathGoal(f, st.world(), st.cross) ?? st.goal;
      const dy = clamp(g.handY - cmd.handY, -VITAL.prepareSpeed * dt, VITAL.prepareSpeed * dt);
      // 손가락이 일부러 위아래로 긋는 것을 거스르지 않는다
      if (dy * sk.vel.y >= 0 || Math.abs(sk.vel.y) < 0.05) cmd.handY += dy;
      cmd.pitch += clamp(g.pitch - cmd.pitch, -VITAL.prepareTurn * dt, VITAL.prepareTurn * dt);
    }
  }
  if (st.phase === 'releasing' || (st.phase === 'idle' && (cmd.handY || cmd.pitch))) {
    ramp(cmd, 0, 0, dt);
    if (Math.abs(cmd.handY) + Math.abs(cmd.pitch) < 1e-9) (cmd.handY = 0), (cmd.pitch = 0), (st.phase = 'idle'), (st.foe = null);
  }
}

/** 플레이어 준비 목표: 지금 손가락 높이로 좌우를 그었을 때 목 앞을 지나는 높이 (목표는 처음 잡을 때 내 몸 기준으로 고정) */
function aimGoal(f, st, world) {
  if (world) {
    st.local = targetLocal(f, world);
    st.yaw0 = f.yaw.clone();
  }
  // 고정한 몸 기준 목표 → 지금 몸의 세계 좌표 (상대를 따라가지 않는다)
  st.world = () => {
    const c = f.bodies.chest.translation();
    return st.local.clone().applyQuaternion(f.yaw).add(new THREE.Vector3(c.x, c.y, c.z));
  };
  const y = f.skill.aim.y;
  const cross = strokeCrossing(f, [[-0.25, y], [0.25, y]], st.world());
  if (!cross) return false;
  st.cross = cross;
  st.padY = y;
  st.goal = pathGoal(f, st.world(), cross);
  return !!st.goal;
}

// ── 탭 찌르기 (skill.js) ─────────

/** 탭 찌르기가 겨눌 급소 (플레이어: 지금 모습, extra = 걸어 맞출 거리) */
export function playerVitalThrust(f, extra = 0) {
  if (!vitalOn() || !VITAL.thrust || !f.foe) return null;
  return findVital(f, captureVitalPose(f.foe), 'thrust', extra);
}

/** 무기별 간격 (샛별 8bbee803 measureThrustDistance): 칼끝이 목표 바로 앞에 오는 거리인가 · 칼 축이 목표 쪽인가 · 앞뒤로 얼마나 */
export function measureThrustRange(f, target) {
  const bad = { valid: false, ready: false, aligned: false, move: 0 };
  if (!target || !f?.sword || !finite(target)) return bad;
  const grip = vec(f.sword.translation());
  const ray = vec(target).sub(grip);
  const distance = ray.length();
  if (!(distance > 0.01)) return bad;
  ray.divideScalar(distance);
  const c = f.bodies.chest.translation();
  const shoulder = new THREE.Vector3(ARM.shoulder[0], ARM.shoulder[1], ARM.shoulder[2] * (f.side ?? 1)).applyQuaternion(quat(f.bodies.chest.rotation())).add(vec(c));
  const off = grip.clone().sub(shoulder);
  const dot = off.dot(ray);
  const R = ARM.upper + ARM.fore - ARM.slack;
  const disc = dot * dot + R * R - off.lengthSq();
  const armTravel = disc < 0 ? 0 : Math.max(0, -dot + Math.sqrt(disc));
  const reach = Math.min(THRUST.reach + (f.weaponCfg.thrustStyle?.reach ?? 0), armTravel);
  const L = f.weaponCfg.hiltLength + f.weaponCfg.bladeLength;
  const min = L - Math.min(0.06, THRUST.chamber * 0.5);
  const max = L + Math.max(0.035, reach * 0.65);
  const error = distance - (min + max) * 0.5;
  const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(quat(f.sword.rotation()));
  const alignment = axis.dot(ray);
  const lineMiss = distance * Math.sqrt(Math.max(0, 1 - alignment * alignment));
  const forward = f.forward(new THREE.Vector3());
  const proj = ray.dot(forward);
  const valid = proj > 0.25;
  const ready = valid && distance >= min && distance <= max;
  const move = !valid || ready ? 0 : Math.sign(error) * clamp((Math.abs(error) * 2) / Math.max(0.5, proj), 0.18, 0.65);
  // 샛별 조건 그대로 (각 20° + 표적 선 7 cm). 우리 칼은 버티는 동안 약 6° 처져(선 12 cm) 가만히 무릎 꿇은 상대에선 2 s 를 넘기기 쉽다 → 보통 찌르기로 넘어감.
  //  선 조건을 뺀 판을 재 봤다: 판금 크게 넘어뜨림 24 판 탭 마무리 8 → 4 · 급소 찌르기 헛침 31 → 36 % (맨몸 36 → 43 %) — 그래서 그대로 둠 (문서 §3)
  return { valid, ready, aligned: alignment >= VITAL.rangeAlignCos && lineMiss <= VITAL.rangeLineMiss, move, distance, min, max, alignment, lineMiss };
}

// ─────────────────────────────────────────────────────────────
//  벙어리장갑 손 (외형 PM, 사장님 10/2 "손가락을 다 그리진 않더라도 최소한 벙어리 장갑처럼 엄지가 보이게.
//  그렇지 않으면 무기를 쥔 모습이 계속 어색하겠다"). 겉모습만 — 물리 몸체·관절·판정은 그대로.
//   · 쥔 손(주먹): 손바닥 덩이(납작한 타원체)가 칼자루를 감싸고 엄지 하나가 자루를 둘러 감는다. 칼 그룹의 자식이라
//     칼자루 축(실제 물리 칼 몸체 +y)을 따르고, 손목 쪽은 매 프레임 아래팔이 들어오는 방향으로 돌린다(자루 축 둘레 회전만).
//     칼 든 손은 칼 원점(손목 공 관절 자리, y=0), 두 손 무기의 빈손은 잡고 있을 때(fighter.gripping) 폼멜 자리(gripAlong)에.
//   · 편 손(벙어리장갑): 아래팔 끝(dressPart 의 손 구체 자리)에 납작한 손 + 옆으로 벌린 엄지. 칼을 놓쳤을 때·빈손·한손 무기의 빈손.
//   · 쥠 방식: 동작 PM 쥠 규칙(docs/motion/grip_rules_2026-10-02.md, 가지 …/pm-motion-research)의 무기별 α·β·θ.
//     자루 틀: y = 자루 축(칼끝 +), z = 앞날, x = 칼 면. α = 주먹 마디 줄이 향하는 쪽(0 = 앞날), β = 비스듬(0 망치 쥠, + 악수 쥠),
//     θ = 엄지(0 감음, 90 자루를 따라 칼끝 쪽으로 폄 — 세이버 60·레이피어 70). 쥠은 손에 고정이라 주먹은 자루에 붙어 같이 돈다
//     (아래팔은 손목 공 관절이 이어 준다). 레이피어의 자세별 α 돌림(프리마·세콘다·테르차·콰르타)은 guardPose.nearest 로 읽어 넣었다(10/8, 아래 rapierPostureA).
//     h(코등이에서 손까지)는 물리 손목 자리(칼 원점)에 손을 두는 것으로 대신한다 — 손을 옮기면 아래팔과 떨어져 보인다.
//   · 색·재질은 원래 손 구체의 재질을 그대로 쓴다(맨손 살색·하인리히 쇠장갑 등 outfits 가 정한 그대로).
//   · 손 하나 삼각형 약 200, 그리기 호출 손마다 1(손바닥+엄지를 한 지오메트리로 합침).
//  main.js: const hands = attachHands(fighter) 를 판마다 두 검객에, 프레임마다 hands.update() — auras 와 같이.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { resolveSwordArt } from './sword_art.js';

// 레이피어 자세별 손 돌림 α (동작 PM 쥠 규칙 ① 끝 줄, 10/8 디렉터): 프리마(지붕) +180 · 세콘다(어깨 지붕·황소) +90 · 테르차(쟁기·긴 자세·옆·…) 0 · 콰르타(왼쪽 자세) −90.
//  자세는 fighter.guardPose.nearest(guards.js guardAt 이 매 스텝 고른 가장 가까운 자세 번호, 표 순서 = GUARDS 순서)로 읽고, 표 이름에 교본 이름(Prima·Seconda·Terza·Quarta)이 있으면 그것이 우선.
//  겉모습만: 주먹을 자루 축 둘레로 돌린다(물리·판정 그대로). 자세가 바뀔 때 540°/s 로 돌아가 튀지 않는다
const RAPIER_A_BY_INDEX = [180, 90, 90, 0, 0, 0, 0, 0, 0, -90, -90, -90, -90, -90];
function rapierPostureA(f) {
  const i = f.guardPose?.nearest;
  if (!(i >= 0) || i >= RAPIER_A_BY_INDEX.length) return 0;
  const name = f.guardPose?.table?.[i]?.name ?? '';
  if (name.includes('프리마')) return 180;
  if (name.includes('세콘다')) return 90;
  if (name.includes('테르차')) return 0;
  if (name.includes('콰르타')) return -90;
  return RAPIER_A_BY_INDEX[i];
}

/** 지오메트리를 변환해서 돌려준다 (scale → rotate → translate) */
function bake(geo, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.applyMatrix4(m);
  g.deleteAttribute('uv');
  return g;
}

// 쥔 주먹 (자루 틀): +y = 자루 축(칼끝 쪽), +z = 주먹 마디 줄(α=0 이면 앞날 쪽), +x = 엄지 쪽. θ 마다 엄지만 다르다
const _fists = new Map();
function fistGeometry(thetaDeg = 0) {
  const key = Math.round(thetaDeg);
  if (_fists.has(key)) return _fists.get(key);
  const palm = bake(new THREE.SphereGeometry(1, 12, 8), [0, -0.002, -0.004], [0, 0, 0], [0.04, 0.05, 0.046]);
  // 말아 쥔 손가락 덩이 — 마디 줄 쪽(+z)
  const knuckles = bake(new THREE.SphereGeometry(1, 10, 6), [0, 0.002, 0.026], [0, 0, 0], [0.036, 0.046, 0.022]);
  // 엄지: θ 0 = 엄지 쪽(+x)에서 자루를 감아 마디 쪽(+z)으로, θ 90 = 칼등 쪽(−z) 자루 위에 칼끝(+y) 방향으로 펴서 얹음
  const t = THREE.MathUtils.clamp(thetaDeg / 90, 0, 1);
  const p0 = new THREE.Vector3(0.036, 0.03, 0.012), p1 = new THREE.Vector3(0.006, 0.05, -0.03);
  const d0 = new THREE.Vector3(-0.35, 0.45, 1).normalize(), d1 = new THREE.Vector3(0, 1, -0.15).normalize();
  const pos = p0.clone().lerp(p1, t);
  const dir = d0.clone().lerp(d1, t).normalize();
  const tg = new THREE.CapsuleGeometry(0.0165, 0.046, 3, 8).toNonIndexed();
  tg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
  tg.translate(pos.x, pos.y, pos.z);
  tg.deleteAttribute('uv');
  // 엄지 뿌리 두툼한 살
  const base = bake(new THREE.SphereGeometry(1, 8, 6), [0.03, 0.006, -0.02], [0, 0, 0], [0.018, 0.03, 0.022]);
  const g = mergeGeometries([palm, knuckles, tg, base]);
  g.computeVertexNormals();
  _fists.set(key, g);
  return g;
}

// 무기별 앞손 쥠 (동작 PM 쥠 규칙 ①: α·β·θ, 빈손 grip·fist·open)의 표는 frames.js HAND_GRIPS 로 옮겼고, 무기마다 고르는 일은
//  검술 풀이(sword_art.js resolveSwordArt → fighter.swordArt.grip)가 한다 (10/8 ① 구조 — 값 그대로)

// 편 손 (아래팔 그룹 기준: +y = 어깨 쪽, −y = 손목 쪽, +x = 앞): 손목 끝에서 이어지는 납작한 손 + 앞쪽으로 벌린 엄지
let _open = null;
function openGeometry() {
  if (_open) return _open;
  const palm = bake(new THREE.SphereGeometry(1, 12, 8), [0, -0.15, 0], [0, 0, 0], [0.024, 0.055, 0.044]);
  const thumb = bake(new THREE.CapsuleGeometry(0.015, 0.04, 3, 8), [0.026, -0.135, 0.022], [0.3, 0, 0.75]);
  _open = mergeGeometries([palm, thumb]);
  _open.computeVertexNormals();
  return _open;
}

/** 원래 손 구체(dressPart: SphereGeometry r≈0.042, y −0.135)를 찾는다. 칼 든 팔은 겉모습이 눕힌 하위 그룹(dressTo) 안에 있다 */
function findHandSphere(group) {
  let found = null;
  group?.traverse((c) => {
    if (!found && c.isMesh && c.geometry?.type === 'SphereGeometry' && Math.abs((c.geometry.parameters?.radius ?? 0) - 0.042) < 0.002 && c.position.y < -0.1) found = c;
  });
  return found;
}

const D2R = Math.PI / 180;

/**
 * 검객 하나에 벙어리장갑 손을 단다. 반환 { update(), dispose() } — main.js 가 auras 처럼 부른다.
 */
export function attachHands(f) {
  const gS = f.groups?.farmS;
  const gO = f.groups?.farmO;
  const sphS = findHandSphere(gS);
  const sphO = findHandSphere(gO);
  if (!sphS || !sphO || !f.swordGroup) return null;
  const matS = sphS.material;
  const matO = sphO.material;
  // 편 손 (아래팔 끝)
  const openS = new THREE.Mesh(openGeometry(), matS);
  const openO = new THREE.Mesh(openGeometry(), matO);
  openO.scale.z = -1; // 빈손은 반대쪽 손 — 엄지를 몸 쪽 반대로 거울
  for (const m of [openS, openO]) m.castShadow = true;
  sphS.parent.add(openS); // 원래 손 구체와 같은 좌표계(+y 어깨, −y 손목, +x 앞)
  sphO.parent.add(openO);
  sphS.visible = sphO.visible = false;
  // 쥔 주먹 (칼 그룹, 자루 틀에 고정 — 쥠 규칙의 α 돌림·β 비스듬)
  const G = (f.swordArt ?? resolveSwordArt(f.weapon)).grip; // 쥠 모양: 검술 풀이가 고른 것 (무기 예외 또는 쥠 종류 기본값)
  const fistS = new THREE.Mesh(fistGeometry(G.t), matS);
  fistS.rotation.set(G.b * D2R, G.a * D2R, 0, 'YXZ');
  const fistO = new THREE.Mesh(fistGeometry(0), matO); // 빈손: 같은 α, 엄지 감음, 덜 비스듬
  fistO.rotation.set(Math.min(G.b, 10) * D2R, G.a * D2R, 0, 'YXZ');
  fistO.scale.x = -1; // 반대쪽 손
  fistO.position.y = f.weaponCfg?.gripAlong ?? -0.14;
  for (const m of [fistS, fistO]) m.castShadow = true;
  f.swordGroup.add(fistS, fistO);
  fistO.visible = false;
  // Optional cosmetic plates follow the real open/closed hand; no grip or physics changes.
  const decorateHand = sphS.userData.decorateNativeHand;
  const handDetails = decorateHand ? [decorateHand(openS, false), decorateHand(fistS, true)] : [];
  // 한손 무기의 빈손이 '가볍게 쥔 주먹'이면: 아래팔 끝에 주먹 (구멍이 아래팔과 직각)
  const armFistO = new THREE.Mesh(fistGeometry(0), matO);
  armFistO.position.set(0, -0.145, 0);
  armFistO.rotation.set(0, 0, Math.PI / 2);
  armFistO.scale.x = -1;
  armFistO.castShadow = true;
  sphO.parent.add(armFistO);
  armFistO.visible = false;
  const offFist = G.off === 'fist';
  const rapier = G.turn === 'posture'; // 자세별 손 돌림 (레이피어 — frames.js HAND_GRIPS turn)
  let aCur = G.a; // 지금 손 돌림(도) — 레이피어만 자세에 따라 움직인다
  let mordSeen = null; // 마지막으로 맞춘 거꾸로 쥠 (f.mordGrip — 죽음의 일격)
  let tPrev = 0;

  const api = {
    update() {
      const armed = !!f.armed && !!f.sword;
      fistS.visible = armed;
      openS.visible = !armed;
      if (rapier && armed) {
        const now = typeof performance !== 'undefined' ? performance.now() : 0;
        const dt = tPrev ? Math.min(0.1, (now - tPrev) / 1000) : 0;
        tPrev = now;
        const want = G.a + rapierPostureA(f);
        let d = want - aCur;
        d -= Math.round(d / 360) * 360; // 가까운 쪽으로
        const step = 540 * dt;
        aCur += Math.abs(d) <= step ? d : Math.sign(d) * step;
        fistS.rotation.y = aCur * D2R;
      }
      // 칼날을 거꾸로 쥔 동안 (독일 비기 죽음의 일격 — fighter.reverseGrip · f.mordGrip { g, gOff }): 주먹을 칼날 위 쥔 자리로 옮기고 칼 축 둘레가 아닌 칼 면 축으로 뒤집는다(엄지가 칼자루 쪽)
      const rg = f.mordGrip;
      if (rg !== mordSeen) {
        mordSeen = rg;
        fistS.position.y = rg ? rg.g : 0;
        fistO.position.y = rg ? rg.gOff : f.weaponCfg?.gripAlong ?? -0.14;
        fistS.rotation.z = fistO.rotation.z = rg ? Math.PI : 0;
      }
      const twoHold = armed && !!f.gripping;
      fistO.visible = twoHold;
      armFistO.visible = !twoHold && armed && offFist;
      openO.visible = !twoHold && !armFistO.visible;
    },
    dispose() {
      for (const detail of handDetails) {
        detail.traverse(o => { if (o.isMesh) { o.geometry.dispose(); for (const m of [o.material].flat()) m.dispose(); } });
        detail.removeFromParent();
      }
      openS.removeFromParent();
      openO.removeFromParent();
      armFistO.removeFromParent();
      f.swordGroup?.remove(fistS, fistO);
      sphS.visible = sphO.visible = true;
    },
  };
  api.update(); // 싸움 전(메뉴·무기 뽑기) 화면에서도 바로 맞는 손
  return api;
}

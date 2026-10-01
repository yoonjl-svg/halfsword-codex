// ─────────────────────────────────────────────────────────────
//  참수 겉모습 (외형 PM, 사장님 9/30 "머리를 베게 되면 머리가 떨어지면 좋겠는데" — 물리·판정은 디렉터 fighter.decapitate).
//   · 목 단면: 몸통 쪽(가슴 그룹, 목 단면 상처 stump 의 local 자리)과 머리 쪽(머리 그룹 밑)에 어둡고 단순한 원판 —
//     검붉은 살 + 가운데 작은 뼈 단면. 과하지 않게. '피 표현'을 끄면 핏빛 대신 어두운 회색.
//   · 피 분출: 몸통 단면에서 처음 1.5초 동안 목 방향으로 뿜는다(심장 박동처럼 세졌다 약해지며 줄어든다). 그 뒤는 기존 상처 출혈
//     (stump 상처의 bleed → main.js updateDrips 의 핏방울)이 이어받는다. 머리 쪽은 처음 0.8초 몇 방울. '피 표현'을 끄면 분출도 없다.
//   · 판정·물리 무관(겉모습만). 난수는 이 모듈 전용(시간·순번 해시) — Math.random 을 쓰지 않는다.
//  main.js: const decapFx = createDecapFx(particles); 프레임마다 decapFx.update([player, enemy], dt * scale)
//   판이 바뀌면 검객(과 그 그룹에 붙인 원판)이 통째로 바뀌므로 따로 치울 것이 없다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

const SPRAY_T = 1.5; // 초: 몸통 단면의 강한 분출
const HEAD_T = 0.8; // 초: 머리 쪽 핏방울
const NECK_R = 0.046; // m: 목 단면 반지름
const FLESH = 0x4a0a0c; // 검붉은 살
const FLESH_OFF = 0x3a3634; // 피 끄기: 어두운 회색
const BONE = 0xcfc4b2; // 목뼈 단면
const RED = 0x8a0000;

const geoFlesh = new THREE.CircleGeometry(NECK_R, 16);
const geoRing = new THREE.RingGeometry(NECK_R * 0.82, NECK_R, 16); // 가장자리를 조금 밝게 — 단면이 둥근 목으로 읽히게
const geoBone = new THREE.CircleGeometry(NECK_R * 0.28, 10);
const matFlesh = new THREE.MeshStandardMaterial({ color: FLESH, roughness: 0.55, side: THREE.DoubleSide });
const matRing = new THREE.MeshStandardMaterial({ color: 0x6a1a18, roughness: 0.6, side: THREE.DoubleSide });
const matBone = new THREE.MeshStandardMaterial({ color: BONE, roughness: 0.8, side: THREE.DoubleSide });

/** 단면 원판 하나 (그룹 기준 pos 에, 법선 n 쪽을 보게) */
function stumpDisc(group, pos, n) {
  const g = new THREE.Group();
  const flesh = new THREE.Mesh(geoFlesh, matFlesh);
  const ring = new THREE.Mesh(geoRing, matRing);
  const bone = new THREE.Mesh(geoBone, matBone);
  ring.position.z = 0.0005;
  bone.position.set(-NECK_R * 0.3, 0, 0.001); // 목뼈는 목 뒤쪽(몸 기준 −x)에 치우친다
  g.add(flesh, ring, bone);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  g.position.copy(pos);
  g.name = 'decapStump';
  group.add(g);
  return g;
}

// 이 모듈 전용 난수 (0~1): 순번 해시
let seed = 0x9e3779b9;
function rnd() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}

const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
const _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

export function createDecapFx(particles) {
  const done = new WeakMap(); // 검객 → { t, body, head, local, acc, hacc }

  const attach = (f) => {
    const w = f.wounds.find((x) => x.stump && !x.limbStump);
    const local = w ? w.local.clone() : new THREE.Vector3(0, 0.17, 0);
    local.y = Math.max(local.y, 0.176); // 옷깃(원기둥) 위에 얹는다
    const body = f.groups.chest ? stumpDisc(f.groups.chest, local, UP) : null;
    const head = f.groups.head ? stumpDisc(f.groups.head, new THREE.Vector3(0, -0.072, 0), DOWN) : null;
    const st = { t: 0, body, head, local, acc: 0, hacc: 0 };
    done.set(f, st);
    return st;
  };

  const update = (fighters, dt) => {
    for (const f of fighters) {
      if (!f?.decapitated) continue;
      const st = done.get(f) ?? attach(f);
      st.t += dt;
      const blood = particles.bloodOn;
      const col = blood ? FLESH : FLESH_OFF;
      if (matFlesh.color.getHex() !== col) {
        matFlesh.color.setHex(col);
        matRing.color.setHex(blood ? 0x6a1a18 : 0x4a4644);
      }
      if (!blood || dt <= 0) continue;
      // 몸통 단면: 박동하며 뿜는 피 (초당 70 → 10 방울, 2.2 Hz 박동)
      if (st.t < SPRAY_T && f.groups.chest) {
        const k = 1 - st.t / SPRAY_T;
        const beat = 0.45 + 0.55 * Math.max(0, Math.sin(st.t * Math.PI * 2 * 2.2));
        st.acc += dt * (10 + 60 * k) * beat;
        const g = f.groups.chest;
        g.localToWorld(_p.copy(st.local));
        g.getWorldQuaternion(_q);
        _n.copy(UP).applyQuaternion(_q); // 목 방향(세계)
        while (st.acc >= 1) {
          st.acc -= 1;
          const sp = (1.4 + 2.6 * k) * (0.7 + 0.5 * rnd());
          const v = new THREE.Vector3(_n.x * sp + (rnd() - 0.5) * 0.9, _n.y * sp + (rnd() - 0.5) * 0.6, _n.z * sp + (rnd() - 0.5) * 0.9);
          particles.add(_p, v, RED, 0.012 + rnd() * 0.02, 3 + rnd() * 2, true);
        }
      }
      // 머리 쪽: 떨어지는 머리에서 몇 방울
      if (st.t < HEAD_T && f.groups.head) {
        st.hacc += dt * 18 * (1 - st.t / HEAD_T);
        const g = f.groups.head;
        while (st.hacc >= 1) {
          st.hacc -= 1;
          g.localToWorld(_p.set(0, -0.075, 0));
          particles.add(_p, new THREE.Vector3((rnd() - 0.5) * 0.6, -0.3 - rnd() * 0.4, (rnd() - 0.5) * 0.6), RED, 0.01 + rnd() * 0.012, 3, true);
        }
      }
    }
  };

  return { update };
}

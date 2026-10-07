// 사지 절단의 시각 효과만: 양쪽 끝면과 짧은 초기 분출.
// 이후 출혈은 stump 상처와 main의 updateDrips가 담당한다.
// 새 판에서 fighter 그룹의 기존 geometry 정리가 끝면도 함께 정리한다.
import * as THREE from 'three';
import { retainVisualResources } from './visual_resources.js';

const FLESH = 0x4a0a0c;
const GRAY = 0x3a3634;
const RED = 0x8a0000;
const PARENT_T = 0.6;
const CHILD_T = 0.35;
const Z = new THREE.Vector3(0, 0, 1);

export function createLimbSeverFx(particles) {
  const progress = new WeakMap();
  let seed = 0x41c6ce57;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // THREE의 UUID 생성도 전역 난수를 소비한다. 시각 객체 생성 동안만
  // 전용 난수를 쓰고 복원하여 전투 시드의 난수 흐름을 유지한다.
  const visual = (build) => {
    const original = Math.random;
    Math.random = rnd;
    try { return build(); } finally { Math.random = original; }
  };
  const materials = visual(() => ({
    flesh: new THREE.MeshStandardMaterial({ color: FLESH, roughness: 0.65, side: THREE.DoubleSide }),
    bone: new THREE.MeshStandardMaterial({ color: 0xcfc4b2, roughness: 0.8, side: THREE.DoubleSide }),
  }));
  retainVisualResources(...Object.values(materials));
  const point = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const rotation = new THREE.Quaternion();

  const disc = (group, local, normal, radius) => {
    if (!group) return null;
    return visual(() => {
      const end = new THREE.Group();
      end.name = 'limbSeverStump';
      end.position.copy(local);
      end.quaternion.setFromUnitVectors(Z, normal);
      const flesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 14), materials.flesh);
      const bone = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.2, 8), materials.bone);
      bone.position.z = 0.0006;
      end.add(flesh, bone);
      group.add(end);
      return end;
    });
  };

  const attach = (f, event) => {
    const parent = f.groups?.[event.parent];
    const child = f.groups?.[event.root];
    const normalParent = event.normalParent.clone().normalize();
    const normalChild = event.normalChild.clone().normalize();
    disc(parent, event.localParent, normalParent, event.radius);
    disc(child, event.localChild, normalChild, event.radius);
    return {
      parent, child, normalParent, normalChild,
      localParent: event.localParent.clone(), localChild: event.localChild.clone(),
      t: 0, parentAcc: 0, childAcc: 0,
    };
  };

  const spray = (group, local, normal, amount, fade) => {
    if (!group) return;
    group.localToWorld(point.copy(local));
    group.getWorldQuaternion(rotation);
    direction.copy(normal).applyQuaternion(rotation);
    for (let i = 0; i < amount; i++) {
      const speed = (0.45 + 0.75 * fade) * (0.8 + 0.3 * rnd());
      const velocity = new THREE.Vector3(
        direction.x * speed + (rnd() - 0.5) * 0.35,
        direction.y * speed + (rnd() - 0.5) * 0.25,
        direction.z * speed + (rnd() - 0.5) * 0.35,
      );
      particles.add(point, velocity, RED, 0.007 + 0.005 * rnd(), 0.9 + 0.4 * rnd(), true);
    }
  };

  const update = (fighters, dt) => {
    const blood = !!particles.bloodOn;
    materials.flesh.color.setHex(blood ? FLESH : GRAY);
    const elapsed = Number.isFinite(dt) && dt > 0 ? dt : 0;
    for (const f of fighters) {
      if (!f?.severedLimbs?.length) continue;
      let states = progress.get(f);
      if (!states) { states = []; progress.set(f, states); }
      while (states.length < f.severedLimbs.length) states.push(attach(f, f.severedLimbs[states.length]));
      for (const st of states) {
        const before = st.t;
        st.t += elapsed;
        if (!blood || !elapsed) continue;
        // 양쪽 모두 목 분출보다 적고 짧다. bloodOff 중에도 시각 시계는
        // 진행하여 나중에 켰을 때 지난 분출을 몰아서 내지 않는다.
        for (const [side, duration, rate] of [['parent', PARENT_T, 18], ['child', CHILD_T, 8]]) {
          const active = Math.max(0, Math.min(st.t, duration) - before);
          if (!active) continue;
          const fade = Math.max(0, 1 - (before + active / 2) / duration);
          const key = `${side}Acc`;
          st[key] += active * rate * fade;
          const count = Math.floor(st[key]);
          st[key] -= count;
          spray(st[side], st[side === 'parent' ? 'localParent' : 'localChild'], st[side === 'parent' ? 'normalParent' : 'normalChild'], count, fade);
        }
      }
    }
  };
  return { update };
}

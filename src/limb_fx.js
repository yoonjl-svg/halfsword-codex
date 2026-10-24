// ─────────────────────────────────────────────────────────────
//  팔·다리 절단 겉모습 (설계 docs/strike/limb_sever_design_2026-10-07.md §4 — 물리·판정은 fighter.sever).
//   · 단면: 몸 쪽 부위(단면 상처 stump·limb 의 local 자리)와 떨어진 부위(관절 앵커 자리)에 참수와 같은 어두운 원판(살 + 테 + 뼈 단면).
//     반지름은 몸체 캡슐 반지름(위팔 0.045·아래팔 0.04·허벅지 0.065·정강이 0.05, 어깨·엉덩이 단면은 그 팔·다리 굵기) — 새 수 없음.
//   · 피: 몸 쪽 단면에서 참수(1.5 s)보다 짧게 0.6 s, 떨어진 쪽은 0.35 s 몇 방울. 그 뒤는 단면 상처의 bleed(main.js updateDrips)가 이어받는다.
//   · 판정·물리 무관(겉모습만). 난수는 이 모듈 전용 — Math.random 을 쓰지 않는다. '피 표현'을 끄면 회색 단면·분출 없음.
//  main.js: const limbFx = createLimbFx(particles); 프레임마다 limbFx.update([player, enemy], dt * scale)
//   · 흙 몸(병마용 — fighter.physiology.body 'clay', 샛별 901b1f39): 회갈색 흙 단면 · 뼈 단면 없음 · 분출 없음. 재질은 사람 것과 따로 —
//     사람 단면 재질은 '피 표현' 켬/끔에 따라 프레임마다 색이 바뀌므로, 같이 쓰면 같은 판에서 두 몸의 단면 색이 서로 섞인다 (decap_fx 와 같은 까닭)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { bloodPalette } from './blood_palette.js';

const PARENT_T = 0.6; // 초: 몸 쪽 단면의 분출
const CHILD_T = 0.35; // 초: 떨어진 부위 쪽 몇 방울
const FLESH = 0x4a0a0c;
const FLESH_OFF = 0x3a3634;
const BONE = 0xcfc4b2;
const WHITE = bloodPalette({ physiology: { blood: 'white' } });
const RADIUS = { uarmS: 0.045, uarmO: 0.045, farmS: 0.04, farmO: 0.04, thighF: 0.065, thighB: 0.065, shinF: 0.05, shinB: 0.05 }; // fighter.js 몸체 캡슐 반지름
const STUMP_R = { elbow: ['farmS', 'farmS'], shoulder: ['uarmS', 'uarmS'], knee: ['shinF', 'shinF'], hip: ['thighF', 'thighF'] }; // [몸 쪽 단면, 떨어진 쪽 단면]의 굵기 기준 부위

const matFlesh = new THREE.MeshStandardMaterial({ color: FLESH, roughness: 0.55, side: THREE.DoubleSide });
const matRing = new THREE.MeshStandardMaterial({ color: 0x6a1a18, roughness: 0.6, side: THREE.DoubleSide });
const matWhiteFlesh = matFlesh.clone(); matWhiteFlesh.color.setHex(WHITE.flesh);
const matWhiteRing = matRing.clone(); matWhiteRing.color.setHex(WHITE.rim);
const matBone = new THREE.MeshStandardMaterial({ color: BONE, roughness: 0.8, side: THREE.DoubleSide });
const matClay = new THREE.MeshStandardMaterial({ color: 0x8b887a, roughness: 1, side: THREE.DoubleSide }); // 흙 몸 전용 단면 (샛별 값 — decap_fx 와 같은 색), 피 표현과 상관없이 늘 이 색
const matClayRim = new THREE.MeshStandardMaterial({ color: 0xaaa697, roughness: 1, side: THREE.DoubleSide });
const geos = new Map();
const geo = (r) => { if (!geos.has(r)) geos.set(r, { flesh: new THREE.CircleGeometry(r, 14), ring: new THREE.RingGeometry(r * 0.8, r, 14), bone: new THREE.CircleGeometry(r * 0.3, 8) }); return geos.get(r); };

function stumpDisc(group, pos, n, r, clay = false, white = false) {
  const g = new THREE.Group();
  const G = geo(r);
  const flesh = new THREE.Mesh(G.flesh, clay ? matClay : white ? matWhiteFlesh : matFlesh);
  const ring = new THREE.Mesh(G.ring, clay ? matClayRim : white ? matWhiteRing : matRing);
  ring.position.z = 0.0005;
  g.add(flesh, ring);
  if (!clay) { // 흙 몸: 뼈 단면 없음
    const bone = new THREE.Mesh(G.bone, matBone);
    bone.position.z = 0.001;
    g.add(bone);
  }
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  g.position.copy(pos);
  g.name = 'limbStump';
  group.add(g);
  return g;
}

let seed = 0x7f4a7c15;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _n = new THREE.Vector3();

export function createLimbFx(particles) {
  const seen = new WeakMap(); // fighter → 꾸민 절단 수
  const live = []; // 분출 중인 단면 { f, t, parentGroup, parentLocal, parentN, childGroup, childLocal, acc, cacc }
  const dress = (f, s) => {
    const pg = f.groups?.[s.parent];
    const cg = f.groups?.[s.parts[0]];
    const [rp, rc] = STUMP_R[s.kind] || ['farmS', 'farmS'];
    const pLocal = new THREE.Vector3(s.parentLocal.x, s.parentLocal.y, s.parentLocal.z);
    const pN = pLocal.lengthSq() > 1e-6 ? pLocal.clone().normalize() : new THREE.Vector3(0, -1, 0); // 단면은 부위 중심에서 관절 쪽을 본다
    const cLocal = new THREE.Vector3(s.childLocal.x, s.childLocal.y, s.childLocal.z);
    const cN = cLocal.lengthSq() > 1e-6 ? cLocal.clone().normalize() : new THREE.Vector3(0, 1, 0);
    const clay = f.physiology?.body === 'clay';
    const palette = bloodPalette(f), white = palette.key === 'white';
    if (pg) stumpDisc(pg, pLocal, pN, RADIUS[rp] ?? 0.045, clay, white);
    if (cg) stumpDisc(cg, cLocal, cN, RADIUS[rc] ?? 0.04, clay, white);
    if (!clay) live.push({ f, t: 0, pg, pLocal, pN, cg, cLocal, acc: 0, cacc: 0, palette }); // 흙 몸은 분출이 없어 분출 목록에 넣지 않는다
  };
  const update = (fighters, dt) => {
    for (const f of fighters) {
      const n = f?.severed?.length || 0;
      if (!n) continue;
      const k = seen.get(f) || 0;
      for (let i = k; i < n; i++) dress(f, f.severed[i]);
      if (k !== n) seen.set(f, n);
    }
    const blood = particles.bloodOn;
    matWhiteFlesh.color.setHex(blood ? WHITE.flesh : FLESH_OFF);
    matWhiteRing.color.setHex(blood ? WHITE.rim : 0x4a4644);
    const col = blood ? FLESH : FLESH_OFF;
    if (matFlesh.color.getHex() !== col) { matFlesh.color.setHex(col); matRing.color.setHex(blood ? 0x6a1a18 : 0x4a4644); }
    if (dt <= 0) return;
    for (let i = live.length - 1; i >= 0; i--) {
      const st = live[i];
      st.t += dt;
      if (st.t > PARENT_T || !fighters.includes(st.f)) { live.splice(i, 1); continue; } // 지난 판의 검객이면 버린다 (10/8 검토 7)
      if (!blood) continue;
      if (st.pg) {
        const kk = 1 - st.t / PARENT_T;
        st.acc += dt * (8 + 40 * kk);
        st.pg.localToWorld(_p.copy(st.pLocal));
        st.pg.getWorldQuaternion(_q);
        _n.copy(st.pN).applyQuaternion(_q);
        while (st.acc >= 1) {
          st.acc -= 1;
          const sp = (1.0 + 2.0 * kk) * (0.7 + 0.5 * rnd());
          particles.add(_p, new THREE.Vector3(_n.x * sp + (rnd() - 0.5) * 0.8, _n.y * sp + (rnd() - 0.5) * 0.6, _n.z * sp + (rnd() - 0.5) * 0.8), st.palette.splash, 0.01 + rnd() * 0.016, 3 + rnd() * 2, true);
        }
      }
      if (st.cg && st.t < CHILD_T) {
        st.cacc += dt * 14 * (1 - st.t / CHILD_T);
        while (st.cacc >= 1) {
          st.cacc -= 1;
          st.cg.localToWorld(_p.copy(st.cLocal));
          particles.add(_p, new THREE.Vector3((rnd() - 0.5) * 0.6, -0.2 - rnd() * 0.4, (rnd() - 0.5) * 0.6), st.palette.splash, 0.01 + rnd() * 0.012, 3, true);
        }
      }
    }
  };
  return { update };
}

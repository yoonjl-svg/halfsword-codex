// ─────────────────────────────────────────────────────────────
//  칼 잔상 띠 (외형 PM, 디렉터 R0 화면 신호): 최근 물리 자세 2~4개의 칼 선분(칼자루→칼끝)을 이어 만든 삼각형 띠.
//   · 약 60 ms 에 사라지고, 칼끝이 빠를수록 짙다 (CONFIG SWORD_TRAIL: vMin 8 m/s 부터 보이기 시작해 vMax 25 m/s 에서 최대).
//   · v2 (사장님 9/30 "너무 반짝여서 칼보다 돋보인다, 나뭇가지·낮은 계급 칼엔 어울리지도 않는다"):
//     보통 섞기의 반투명 띠, 색은 그 칼날 재질 색 × dim(0.55) — 늘 칼보다 어둡고 밤에 흰 부채꼴이 되지 않는다(안개도 받는다).
//     청강검처럼 칼날 색이 있으면 그 색조. 잔상은 금속 칼날(weapon.material 'steel')이면서 trash 등급이 아닐 때만 —
//     나뭇가지·고무닭·냉동참치(비금속), 광선검(자체 빛), 리볼버에는 없다.
//   · 두 검객 띠를 한 BufferGeometry 에 담아 그리기 호출 1번. 물리 스텝마다 sample() (칼자루·칼끝 두 점만 읽는다, 0.1 ms 미만),
//     프레임마다 update() 가 꼭짓점을 다시 쓴다. 물리·판정에는 손대지 않는다(읽기만).
//   · 무기가 부러지면 bladePoint 가 남은 토막 길이를 쓰므로 띠도 토막만큼만. 리볼버(weapon.gun)·손에서 놓친 칼에는 안 붙는다.
//   · setTone('normal'|'gold'|'grey'): 금색 = "멈출 수 없는 구간", 회색 = "복귀 중" (디렉터가 R4 에서 부른다). 지금은 normal 만.
//   · "적막" 컨셉: 은은한 찬 강철빛, 요란하지 않게.
//  main.js: const swordTrails = createSwordTrails(scene); 판마다 swordTrails.attach([player, enemy]);
//           물리 스텝 뒤 swordTrails.sample(PHYSICS.timestep); 프레임마다 swordTrails.update();
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { SWORD_TRAIL } from './config.js';

const TONES = {
  normal: null, // 칼날 재질 색 × dim
  gold: new THREE.Color(0xc89a4a), // 멈출 수 없는 구간 (짧고 은은하게 — R5 에서 다른 자리로 옮긴다)
  grey: new THREE.Color(0x6e7278), // 복귀 중
};
const STEEL = new THREE.Color(0xc4cad2); // 칼날 색을 못 읽을 때의 강철
/** 이 무기에 잔상을 붙이나: 금속 칼날이면서 trash 등급이 아닐 때만 (비금속·광선검·총 없음) */
export function trailFor(weapon) {
  return !!weapon && weapon.material === 'steel' && !weapon.gun && weapon.tier !== 'trash';
}
const MAX_FIGHTERS = 2;
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/** 검객 하나의 최근 자세 고리 (칼자루 h·칼끝 p·게임 시간 t·칼끝 속도 v) */
function makeSlot() {
  const K = SWORD_TRAIL.samples;
  return { f: null, on: false, base: new THREE.Color(), tone: null, n: 0, head: 0, hx: new Float32Array(K), hy: new Float32Array(K), hz: new Float32Array(K), px: new Float32Array(K), py: new Float32Array(K), pz: new Float32Array(K), t: new Float32Array(K), v: new Float32Array(K) };
}

export function createSwordTrails(scene) {
  const K = SWORD_TRAIL.samples;
  const maxVerts = MAX_FIGHTERS * (K - 1) * 6; // 자세 사이마다 사각형 하나 = 삼각형 둘
  const pos = new Float32Array(maxVerts * 3);
  const col = new Float32Array(maxVerts * 4); // RGBA — 보통 섞기에서 꼭짓점마다 불투명도
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  );
  mesh.name = 'swordTrail';
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  scene.add(mesh);

  const slots = Array.from({ length: MAX_FIGHTERS }, makeSlot);
  let now = 0; // 게임 시간 (스텝 합)

  /** 물리 스텝 뒤에 한 번: 두 검객의 칼자루·칼끝을 기록한다 */
  const sample = (dt) => {
    now += dt;
    for (const s of slots) {
      const f = s.f;
      if (!s.on || !f || !f.sword || !f.armed) {
        s.n = 0;
        continue;
      }
      f.bladePoint(0, _a);
      f.bladePoint(1, _b);
      let v = 0;
      if (s.n > 0) {
        const j = s.head; // 직전 자세
        const dx = _b.x - s.px[j];
        const dy = _b.y - s.py[j];
        const dz = _b.z - s.pz[j];
        v = Math.sqrt(dx * dx + dy * dy + dz * dz) / dt;
      }
      const i = s.n > 0 ? (s.head + 1) % K : 0;
      s.head = i;
      s.n = Math.min(K, s.n + 1);
      s.hx[i] = _a.x;
      s.hy[i] = _a.y;
      s.hz[i] = _a.z;
      s.px[i] = _b.x;
      s.py[i] = _b.y;
      s.pz[i] = _b.z;
      s.t[i] = now;
      s.v[i] = v;
    }
  };

  /** 프레임마다: 자세 사이를 사각형으로 잇고 나이·속도로 색을 정한다 (검은색 = 더하기 섞기에서 안 보임) */
  const update = () => {
    let n = 0;
    const { life, vMin, vMax, strength, hiltFade: hf } = SWORD_TRAIL;
    let cr = 0, cg = 0, cb = 0;
    const put = (x, y, z, a) => {
      const o = n * 3;
      pos[o] = x;
      pos[o + 1] = y;
      pos[o + 2] = z;
      const c = n * 4;
      col[c] = cr;
      col[c + 1] = cg;
      col[c + 2] = cb;
      col[c + 3] = a;
      n++;
    };
    for (const s of slots) {
      if (s.n < 2) continue;
      const tone = s.tone ?? s.base;
      cr = tone.r;
      cg = tone.g;
      cb = tone.b;
      // 자세 세기(불투명도): 나이로 옅어지고 속도로 짙어진다
      const w = (i) => {
        const age = now - s.t[i];
        const k = Math.min(1, Math.max(0, (s.v[i] - vMin) / (vMax - vMin)));
        return Math.max(0, 1 - age / life) * k * strength;
      };
      for (let q = 0; q < s.n - 1; q++) {
        const i0 = (s.head - q + K) % K; // 새 것
        const i1 = (s.head - q - 1 + K) % K; // 그 전 것
        const w0 = w(i0);
        const w1 = w(i1);
        if (w0 <= 0.002 && w1 <= 0.002) continue;
        // 사각형 (h0, p0, p1, h1) → 삼각형 (h0,p0,p1) (h0,p1,h1). 칼자루 쪽은 옅게
        put(s.hx[i0], s.hy[i0], s.hz[i0], w0 * hf);
        put(s.px[i0], s.py[i0], s.pz[i0], w0);
        put(s.px[i1], s.py[i1], s.pz[i1], w1);
        put(s.hx[i0], s.hy[i0], s.hz[i0], w0 * hf);
        put(s.px[i1], s.py[i1], s.pz[i1], w1);
        put(s.hx[i1], s.hy[i1], s.hz[i1], w1 * hf);
      }
    }
    geo.setDrawRange(0, n);
    mesh.visible = n > 0;
    if (n > 0) {
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    }
  };

  /** 판마다: 이번 판 검객들을 붙이고 지난 띠는 지운다. 검객마다 { setTone } 손잡이를 돌려준다 */
  const attach = (fighters) => {
    const handles = [];
    for (let i = 0; i < MAX_FIGHTERS; i++) {
      const s = slots[i];
      const f = fighters[i] ?? null;
      s.f = f;
      s.n = 0;
      s.head = 0;
      s.tone = null;
      s.on = trailFor(f?.weapon);
      // 띠 색: 그 칼날 재질 색 × dim (청강검이면 그 색조) — 늘 칼보다 어둡다
      const bc = f?.bladeMesh?.material?.color;
      s.base.copy(bc ?? STEEL).multiplyScalar(SWORD_TRAIL.dim);
      handles.push({ setTone: (name) => void (s.tone = TONES[name] ?? null) });
    }
    geo.setDrawRange(0, 0);
    mesh.visible = false;
    return handles;
  };
  const clear = () => {
    for (const s of slots) s.n = 0;
    geo.setDrawRange(0, 0);
    mesh.visible = false;
  };

  return { sample, update, attach, clear, mesh };
}

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
//   · "Stillness" 컨셉: 은은한 찬 강철빛, 요란하지 않게.
//  main.js: const swordTrails = createSwordTrails(scene); 판마다 swordTrails.attach([player, enemy]);
//           물리 스텝 뒤 swordTrails.sample(PHYSICS.timestep); 프레임마다 swordTrails.update();
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { SWORD_TRAIL, SECRET } from './config.js';

const TONES = {
  normal: null, // 칼날 재질 색 × dim
  gold: new THREE.Color(0xc89a4a), // 멈출 수 없는 구간 (짧고 은은하게 — R5 에서 다른 자리로 옮긴다)
  grey: new THREE.Color(0x6e7278), // 복귀 중
};
const STEEL = new THREE.Color(0xc4cad2); // 칼날 색을 못 읽을 때의 강철
/** 이 무기에 잔상을 붙이나: 금속 칼날이면서 trash 등급이 아닐 때만 (비금속·광선검·총 없음). 날 없는 둔기(모르겐슈테른)도 없음 — 사장님 9/30 "둔기는 거의 없음", 확인표 줄 145 */
export function trailFor(weapon) {
  return !!weapon && weapon.material === 'steel' && !weapon.gun && weapon.tier !== 'trash' && weapon.edged !== false;
}
const MAX_FIGHTERS = 4; // 동시 대전 2:2 넷까지 (10/29 — 1:1 은 둘째 뒤 칸이 비어 그리는 것이 그대로)
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

  // 비기 잔상 (10/10 — secret_instant.js 가 f.instantArc 에 쓸린 호의 조각마다 칼자루·칼끝 점: 순간 베기·발도·이베리아 휩쓸기): 호 전체를 한 번에, SECRET.instantArcLife 초(실시간) 동안 옅어지며.
  //  10/10 03:0x 사장님 '잔상 색은 통일해' → 색 값은 **보통 띠와 같다**(그 칼의 base = 칼날 재질 색 × dim, 같은 보통 섞기). 비기는 더 짙고(불투명) 오래 남고, 칼끝 쪽으로 8 % 넓혀 굵다.
  //  베는 순간 0.08 s 흰 섬광 선(칼끝 길, 더하기 섞기)만 흰색. 물리·판정 무관(읽기만)
  //  10/23 마주 보는 띠 (SECRET.secretStreak — 사장님 확인 전 · 확인표 2265 · docs/decisions.md 10/23 · 그림 docs/handoff/secret_trails): 비기 잔상에 face 가 있으면(정수리 내리치기 · 찌르기 —
  //  칼이 쓴 면이 뒤 카메라에서 옆으로 보여 호가 선 하나로 줄어드는 비기) 호에 더해 카메라 쪽으로 펼친 띠로도 그린다 — face 'path' = 치는 끝(호의 바깥 끝과 같은 점)의 길
  //  (정수리 내리치기) · 'line' = 칼이 지나간 곧은 줄(처음 칼자루 → 가장 멀리 간 칼끝 — 찌르기는 칼끝이 제 축을 따라 20 cm 안팎만 나가 끝 길이 점에 가깝다).
  //  반 폭 = 칼자루 → 끝 길이의 8 %(호를 칼끝 쪽으로 넓히는 몫과 같은 수) · 가운데 짙고 가장자리 0 · 밝기 · 남는 시간 · 색 · 섬광은 호와 같다. 카메라는 그리기 직전 콜백(onBeforeRender)에서 받아 둔다
  const ARC_MAX = MAX_FIGHTERS * 480 * 6; // 조각 480 개 몫 (10/23 — 마주 보는 띠는 조각마다 사각형 둘을 더 쓴다)
  const apos = new Float32Array(ARC_MAX * 3);
  const acol = new Float32Array(ARC_MAX * 4);
  const ageo = new THREE.BufferGeometry();
  ageo.setAttribute('position', new THREE.BufferAttribute(apos, 3).setUsage(THREE.DynamicDrawUsage));
  ageo.setAttribute('color', new THREE.BufferAttribute(acol, 4).setUsage(THREE.DynamicDrawUsage));
  ageo.setDrawRange(0, 0);
  const amesh = new THREE.Mesh(ageo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  amesh.name = 'secretArc';
  amesh.frustumCulled = false;
  amesh.renderOrder = 4;
  amesh.visible = false;
  scene.add(amesh);
  // 섬광 선 (흰색, 더하기 섞기, 0.08 s)
  const FL_MAX = MAX_FIGHTERS * 480 * 6;
  const fpos = new Float32Array(FL_MAX * 3);
  const fcol = new Float32Array(FL_MAX * 4);
  const fgeo = new THREE.BufferGeometry();
  fgeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3).setUsage(THREE.DynamicDrawUsage));
  fgeo.setAttribute('color', new THREE.BufferAttribute(fcol, 4).setUsage(THREE.DynamicDrawUsage));
  fgeo.setDrawRange(0, 0);
  const fmesh = new THREE.Mesh(fgeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  fmesh.name = 'secretFlash';
  fmesh.frustumCulled = false;
  fmesh.renderOrder = 5;
  fmesh.visible = false;
  scene.add(fmesh);
  const FLASH_MS = 80;
  const LUNGE_SEG = 8; // 런지 빛줄기 토막 수 (창끝 꼴 폭을 부드럽게)
  // 런지 빛줄기 끝 반짝임 (10/25 — 아래 lunges 머리말): 흰 별(가로 · 세로 팔 + 가운데 빛) · 더하기 섞기 · 깊이 안 봄(끝 E 는 상대 몸 안 — 몸 겉에 가리지 않게) · 런지당 한 번 SECRET.risoGlintLife 초
  const GL_MAX = MAX_FIGHTERS * 48;
  const gpos = new Float32Array(GL_MAX * 3);
  const gcol = new Float32Array(GL_MAX * 4);
  const ggeo = new THREE.BufferGeometry();
  ggeo.setAttribute('position', new THREE.BufferAttribute(gpos, 3).setUsage(THREE.DynamicDrawUsage));
  ggeo.setAttribute('color', new THREE.BufferAttribute(gcol, 4).setUsage(THREE.DynamicDrawUsage));
  ggeo.setDrawRange(0, 0);
  const gmesh = new THREE.Mesh(ggeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  gmesh.name = 'secretGlint';
  gmesh.frustumCulled = false;
  gmesh.renderOrder = 6;
  gmesh.visible = false;
  scene.add(gmesh);
  const arcs = Array.from({ length: MAX_FIGHTERS }, () => ({ id: 0, pts: null, t0: 0 }));
  // 런지 빛줄기 (사장님 10/25 14:0x '리솔루토 쓰는 순간 비기인 줄 모르겠더라' → 안 1 결정 · SECRET.risoStreak · docs/strike/italian_risoluto_2026-10-22.md §15):
  //  안다레 리솔루토 런지는 칼이 제 축을 따라 나가 뒤 카메라에서 호 · 마주 보는 띠('line')가 선 하나로 줄었다(그림 docs/handoff/risoluto_fx_2026-10-25 before) →
  //  런지 잔상(f.instantArc 에 lunge = 런지를 시작한 스텝의 칼날 밑동 — secret_instant.js startCombo)이 오면 그 점 S → 가장 멀리 간 칼끝 E 곧은 줄을 화면 쪽으로 펼친 띠로 그린다:
  //  반 폭 SECRET.risoStreakWidth(칼끝 쪽으로 굵어지다 E 에서 모임 — 창끝 꼴) · 몸 = 비기 잔상과 같은 칼날 색 · 같은 밝기(0.95 × max(빠르기 몫, secretArcMin)) · 보통 섞기 ·
  //  심 = 가운데 흰 빛(더하기 섞기 — 섬광과 같은 흰빛 · 처음 FLASH_MS 동안 더 밝게) · 다 그린 때부터 SECRET.risoStreakLife 동안 옅어짐. 이 줄을 그리는 런지는 'line' 띠를 그리지 않는다(겹침).
  //  뒤 카메라에서 찌르는 줄은 카메라에서 멀어지는 쪽이라 화면에 짧다(폰 가로 36 ~ 39 px · 상대 몸통 안 — 그림) → 끝 E 에 화면 가로 · 세로로 펼친 흰 반짝임 별(SECRET.risoGlintLife · risoGlintK)을 더한다
  const lunges = Array.from({ length: MAX_FIGHTERS }, () => ({ A: null, S: null, E: null, d: -1, n: 0, t0: 0, tf: 0, share: 1 }));
  let cam = null; // 마주 보는 띠가 바라볼 카메라 (그려질 때 받아 둔 같은 물체 — 자리는 그때그때 읽는다)
  const grab = (r, sc, c) => void (cam = c);
  mesh.onBeforeRender = grab;
  amesh.onBeforeRender = grab;
  fmesh.onBeforeRender = grab;
  gmesh.onBeforeRender = grab;

  const slots = Array.from({ length: MAX_FIGHTERS }, makeSlot);
  let now = 0; // 게임 시간 (스텝 합)

  /** 물리 스텝 뒤에 한 번: 두 검객의 칼자루·칼끝을 기록한다 */
  const sample = (dt) => {
    now += dt;
    for (let k = 0; k < slots.length; k++) {
      const A = slots[k].f?.instantArc;
      if (A && A.id !== arcs[k].id) {
        arcs[k].id = A.id;
        arcs[k].pts = A.pts;
        arcs[k].share = Math.max(A.share ?? 1, A.min ?? 0); // 잔상 세기 몫 (중국 빠른 연환 — SECRET.cnFastShare: 빠르기와 같은 비율, 사장님 10/12 01:2x). 그 밖 비기는 1 · min = 결정타 잔상 바닥 (10/23 SECRET.secretArcMin — 사람 비기)
        arcs[k].width = A.width ?? 1; // 잔상 굵기 몫 (격살 시험 스위치 SECRET.gyeoksal.trailWidth — 칼끝에서 칼날 쪽으로 덮는 몫 · 기본 1 = 칼날 전부, 그대로)
        const L = lunges[k];
        L.A = A.lunge && SECRET.risoStreak ? A : null; // 런지 빛줄기 (10/25 — 위)
        if (L.A) Object.assign(L, { S: A.lunge, E: null, d: -1, n: 0, t0: performance.now(), tf: performance.now(), share: arcs[k].share });
        arcs[k].face = (!L.A && A.face) || null; // 마주 보는 띠 'path' | 'line' (10/23 — 위 머리말) · 빛줄기를 그리는 런지는 빼고
        arcs[k].t0 = arcs[k].tf = performance.now();
        arcs[k].n = A.pts.length;
      } else if (A && A.kind === 'combo' && arcs[k].pts === A.pts && A.pts.length !== arcs[k].n) {
        // 중국 빠른 연환: 두 수 길이(0.3~0.4 s)가 남는 시간(instantArcLife)에 가까워 — 그리는 동안은 옅어지지 않고 다 그린 때부터 같은 시간에 옅어진다 (섬광은 처음 그대로)
        arcs[k].t0 = performance.now();
        arcs[k].n = A.pts.length;
        arcs[k].share = Math.max(A.share ?? arcs[k].share, A.min ?? 0); // 고유 동작 잔상은 그리는 동안 세기(빠르기 몫)가 바뀐다 (10/21 — secret_instant.js artTrailTick)
      }
    }
    for (const s of slots) {
      const f = s.f;
      if (!s.on || !f || !f.sword || !f.armed || f.settled) { // settled: 쉬는 죽은 몸 (2:2 — match.js settleDead)
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
    // 비기 순간 베기 호
    let an = 0;
    const arcLife = (SECRET.instantArcLife ?? 0.5) * 1000;
    const nowMs = performance.now();
    let fn = 0;
    let ac = null; // 이 호의 색 = 그 칼의 보통 띠 색
    const aput = (x, y, z, a) => {
      const o = an * 3;
      apos[o] = x;
      apos[o + 1] = y;
      apos[o + 2] = z;
      const c = an * 4;
      acol[c] = ac.r;
      acol[c + 1] = ac.g;
      acol[c + 2] = ac.b;
      acol[c + 3] = a;
      an++;
    };
    const fput = (x, y, z, a) => {
      const o = fn * 3;
      fpos[o] = x;
      fpos[o + 1] = y;
      fpos[o + 2] = z;
      const c = fn * 4;
      fcol[c] = a;
      fcol[c + 1] = a;
      fcol[c + 2] = a;
      fcol[c + 3] = a;
      fn++;
    };
    const tipOf = (q) => {
      // 칼끝 쪽으로 8 % 더 (굵게)
      return [q[3] + (q[3] - q[0]) * 0.08, q[4] + (q[4] - q[1]) * 0.08, q[5] + (q[5] - q[2]) * 0.08];
    };
    // 마주 보는 띠: 치는 끝 E(호의 바깥 끝) 길 · 옆 방향 n = (길 방향 × 카메라 쪽) · 반 폭 hw — 가운데 a · 가장자리 0 인 사각형 둘씩 (put = aput | fput)
    const streak = (P, put, a, max, count, mode) => {
      const N = P.length;
      if (N < 2) return;
      if (mode === 'line') {
        // 찌르는 줄: 처음 칼자루 H → 처음 칼날 방향으로 가장 멀리 간 끝 E 한 띠 (칼자루 쪽은 호처럼 0.35 배)
        const h = P[0];
        const e0 = tipOf(h);
        const dx = e0[0] - h[0], dy = e0[1] - h[1], dz = e0[2] - h[2];
        let E = e0, best = -Infinity;
        for (const q of P) {
          const e = tipOf(q);
          const d = (e[0] - h[0]) * dx + (e[1] - h[1]) * dy + (e[2] - h[2]) * dz;
          if (d > best) [best, E] = [d, e];
        }
        const tx = E[0] - h[0], ty = E[1] - h[1], tz = E[2] - h[2];
        let vx = 0, vy = 1, vz = 0;
        if (cam) [vx, vy, vz] = [cam.position.x - (h[0] + E[0]) / 2, cam.position.y - (h[1] + E[1]) / 2, cam.position.z - (h[2] + E[2]) / 2];
        let nx = ty * vz - tz * vy, ny = tz * vx - tx * vz, nz = tx * vy - ty * vx;
        const nl = Math.hypot(nx, ny, nz);
        if (nl < 1e-9 || count() + 12 > max) return;
        const hw = (0.08 * Math.hypot(P[0][3] - h[0], P[0][4] - h[1], P[0][5] - h[2])) / nl;
        [nx, ny, nz] = [nx * hw, ny * hw, nz * hw];
        for (const sgn of [-1, 1]) {
          put(h[0] + nx * sgn, h[1] + ny * sgn, h[2] + nz * sgn, 0);
          put(h[0], h[1], h[2], a * 0.35);
          put(E[0], E[1], E[2], a);
          put(h[0] + nx * sgn, h[1] + ny * sgn, h[2] + nz * sgn, 0);
          put(E[0], E[1], E[2], a);
          put(E[0] + nx * sgn, E[1] + ny * sgn, E[2] + nz * sgn, 0);
        }
        return;
      }
      const E = P.map(tipOf);
      let px = 0, py = 0, pz = 0, pw = 0, qx = 0, qy = 0, qz = 0; // 앞 점 E · 반 폭 · 옆 방향
      for (let q = 0; q < N; q++) {
        const e = E[q];
        const ea = E[Math.max(0, q - 1)];
        const eb = E[Math.min(N - 1, q + 1)];
        const tx = eb[0] - ea[0], ty = eb[1] - ea[1], tz = eb[2] - ea[2];
        let vx = 0, vy = 1, vz = 0;
        if (cam) {
          vx = cam.position.x - e[0];
          vy = cam.position.y - e[1];
          vz = cam.position.z - e[2];
        }
        let nx = ty * vz - tz * vy, ny = tz * vx - tx * vz, nz = tx * vy - ty * vx;
        let nl = Math.hypot(nx, ny, nz);
        if (nl < 1e-9) {
          // 길이 멈췄거나 카메라 쪽으로 곧장 — 앞 옆 방향 그대로 (처음이면 카메라 쪽 × 위)
          if (q > 0) [nx, ny, nz, nl] = [qx, qy, qz, 1];
          else [nx, ny, nz] = [-vz, 0, vx];
          nl = Math.hypot(nx, ny, nz) || 1;
        }
        nx /= nl;
        ny /= nl;
        nz /= nl;
        if (q > 0 && nx * qx + ny * qy + nz * qz < 0) {
          nx = -nx;
          ny = -ny;
          nz = -nz;
        }
        const p = P[q];
        const hw = 0.08 * Math.hypot(p[3] - p[0], p[4] - p[1], p[5] - p[2]);
        if (q > 0 && count() + 12 <= max) {
          for (const sgn of [-1, 1]) {
            put(px + qx * pw * sgn, py + qy * pw * sgn, pz + qz * pw * sgn, 0);
            put(px, py, pz, a);
            put(e[0], e[1], e[2], a);
            put(px + qx * pw * sgn, py + qy * pw * sgn, pz + qz * pw * sgn, 0);
            put(e[0], e[1], e[2], a);
            put(e[0] + nx * hw * sgn, e[1] + ny * hw * sgn, e[2] + nz * hw * sgn, 0);
          }
        }
        [px, py, pz, pw, qx, qy, qz] = [e[0], e[1], e[2], hw, nx, ny, nz];
      }
    };
    for (let k = 0; k < arcs.length; k++) {
      const A = arcs[k];
      if (!A.pts) continue;
      const age = nowMs - A.t0;
      if (age >= arcLife) {
        A.pts = null;
        continue;
      }
      ac = slots[k].tone ?? slots[k].base;
      const sh = A.share ?? 1; // 잔상 세기 몫: 불투명도·섬광 밝기에 곱한다 (색·남는 시간·굵기는 그대로 — 고노센 잔상과 같은 체계)
      const w = 0.95 * sh * (1 - age / arcLife);
      // 섬광 선: 칼끝 길(칼날 0.9 → 1.05) 흰색, 처음 FLASH_MS 동안
      const ageF = nowMs - (A.tf ?? A.t0);
      if (ageF < FLASH_MS) {
        const fw = sh * (1 - ageF / FLASH_MS);
        const Q = A.pts;
        const at = (q, t) => [q[0] + (q[3] - q[0]) * t, q[1] + (q[4] - q[1]) * t, q[2] + (q[5] - q[2]) * t];
        for (let q = 0; q < Q.length - 1 && fn + 6 <= FL_MAX; q++) {
          const a0 = at(Q[q], 0.9);
          const a1 = at(Q[q], 1.05);
          const b0 = at(Q[q + 1], 0.9);
          const b1 = at(Q[q + 1], 1.05);
          fput(a0[0], a0[1], a0[2], fw * 0.3);
          fput(a1[0], a1[1], a1[2], fw);
          fput(b1[0], b1[1], b1[2], fw);
          fput(a0[0], a0[1], a0[2], fw * 0.3);
          fput(b1[0], b1[1], b1[2], fw);
          fput(b0[0], b0[1], b0[2], fw * 0.3);
        }
        if (A.face) streak(Q, fput, fw, FL_MAX, () => fn, A.face);
      }
      const P = A.pts;
      if (A.face) streak(P, aput, w, ARC_MAX, () => an, A.face);
      for (let q = 0; q < P.length - 1 && an + 6 <= ARC_MAX; q++) {
        let a = P[q];
        let b = P[q + 1];
        const ta = tipOf(a);
        const tb = tipOf(b);
        if (A.width < 1) {
          // 굵기 몫 (격살 시험): 안쪽 끝을 칼끝 쪽으로 — 칼자루 쪽 (1 − width) 를 비움
          const k = 1 - A.width;
          a = [a[0] + (a[3] - a[0]) * k, a[1] + (a[4] - a[1]) * k, a[2] + (a[5] - a[2]) * k];
          b = [b[0] + (b[3] - b[0]) * k, b[1] + (b[4] - b[1]) * k, b[2] + (b[5] - b[2]) * k];
        }
        const h = w * 0.35;
        aput(a[0], a[1], a[2], h);
        aput(ta[0], ta[1], ta[2], w);
        aput(tb[0], tb[1], tb[2], w);
        aput(a[0], a[1], a[2], h);
        aput(tb[0], tb[1], tb[2], w);
        aput(b[0], b[1], b[2], h);
      }
    }
    // 런지 빛줄기 (10/25 — 위 lunges 머리말): S → E 를 LUNGE_SEG 토막으로 · 옆 방향 = 줄 방향 × 카메라 쪽 (토막마다) · 가운데 짙고 가장자리 0
    const sLife = (SECRET.risoStreakLife ?? 0.6) * 1000;
    let gn = 0;
    const sHw = SECRET.risoStreakWidth ?? 0.12;
    const ribbon = (S, E, put, a, hw, max, count) => {
      const tx = E[0] - S[0], ty = E[1] - S[1], tz = E[2] - S[2];
      if (Math.hypot(tx, ty, tz) < 1e-4) return;
      let px = 0, py = 0, pz = 0, pw = 0, pa = 0, qx = 0, qy = 0, qz = 0;
      for (let i = 0; i <= LUNGE_SEG; i++) {
        const u = i / LUNGE_SEG;
        const x = S[0] + tx * u, y = S[1] + ty * u, z = S[2] + tz * u;
        let vx = 0, vy = 1, vz = 0;
        if (cam) [vx, vy, vz] = [cam.position.x - x, cam.position.y - y, cam.position.z - z];
        let nx = ty * vz - tz * vy, ny = tz * vx - tx * vz, nz = tx * vy - ty * vx;
        let nl = Math.hypot(nx, ny, nz);
        if (nl < 1e-9) [nx, ny, nz, nl] = i > 0 ? [qx, qy, qz, 1] : [-tz, 0, tx, Math.hypot(tx, tz) || 1]; // 카메라 쪽으로 곧장 — 앞 옆 방향 그대로 (처음이면 수평 옆)
        [nx, ny, nz] = [nx / nl, ny / nl, nz / nl];
        const w = hw * (u < 0.8 ? 0.3 + 0.7 * (u / 0.8) : 1 - 0.85 * ((u - 0.8) / 0.2)); // 창끝 꼴: S 0.3 → 0.8 에서 1 → E 0.15
        const al = a * (0.35 + 0.65 * u); // S 쪽은 호의 칼자루 쪽처럼 0.35 배
        if (i > 0 && count() + 12 <= max) {
          for (const sgn of [-1, 1]) {
            put(px + qx * pw * sgn, py + qy * pw * sgn, pz + qz * pw * sgn, 0);
            put(px, py, pz, pa);
            put(x, y, z, al);
            put(px + qx * pw * sgn, py + qy * pw * sgn, pz + qz * pw * sgn, 0);
            put(x, y, z, al);
            put(x + nx * w * sgn, y + ny * w * sgn, z + nz * w * sgn, 0);
          }
        }
        [px, py, pz, pw, pa, qx, qy, qz] = [x, y, z, w, al, nx, ny, nz];
      }
    };
    for (let k = 0; k < lunges.length; k++) {
      const L = lunges[k];
      if (!L.A) continue;
      const P = L.A.pts;
      if (P.length !== L.n) {
        // 새 조각: 가장 멀리 간 칼끝 (S 에서) · 다 그린 때부터 옅어지게 시계를 다시
        for (let i = L.n; i < P.length; i++) {
          const q = P[i];
          const d = (q[3] - L.S[0]) ** 2 + (q[4] - L.S[1]) ** 2 + (q[5] - L.S[2]) ** 2;
          if (d > L.d) [L.d, L.E] = [d, [q[3], q[4], q[5]]];
        }
        L.n = P.length;
        L.t0 = nowMs;
        L.share = Math.max(L.A.share ?? 1, L.A.min ?? 0);
      }
      const age = nowMs - L.t0;
      if (age >= sLife) {
        L.A = null;
        continue;
      }
      if (!L.E) continue;
      ac = slots[k].tone ?? slots[k].base;
      const fade = 1 - age / sLife;
      const ageF = nowMs - L.tf;
      ribbon(L.S, L.E, aput, 0.95 * L.share * fade, sHw, ARC_MAX, () => an); // 몸: 칼날 색 (비기 잔상과 같은 밝기)
      ribbon(L.S, L.E, fput, L.share * (fade + (ageF < FLASH_MS ? 0.5 * (1 - ageF / FLASH_MS) : 0)), sHw * 0.45, FL_MAX, () => fn); // 심: 흰 빛 (더하기)
      // 끝 반짝임: E 에 화면 가로 · 세로로 펼친 흰 별 (가로 팔 = 반 폭 × risoGlintK · 세로 0.6 배) — 처음 risoGlintLife 초 동안 옅어짐
      const gk = SECRET.risoGlintLife > 0 ? 1 - ageF / (SECRET.risoGlintLife * 1000) : 0;
      if (gk > 0 && cam && gn + 48 <= GL_MAX) {
        const e = cam.matrixWorld.elements;
        const g = L.share * gk ** 1.5;
        const Lg = sHw * (SECRET.risoGlintK ?? 4);
        const c = L.E;
        const gput = (x, y, z, a) => {
          const o = gn * 3;
          gpos[o] = x;
          gpos[o + 1] = y;
          gpos[o + 2] = z;
          const q = gn * 4;
          gcol[q] = gcol[q + 1] = gcol[q + 2] = gcol[q + 3] = a;
          gn++;
        };
        // 팔: 축 ax(길이 len) · 옆 px(가운데 두께 th) — 가운데 g · 끝 0 인 마름모 (삼각형 넷)
        const arm = (ax, ay, az, len, px, py, pz, th) => {
          for (const s1 of [-1, 1])
            for (const s2 of [-1, 1]) {
              gput(c[0], c[1], c[2], g);
              gput(c[0] + px * th * s2, c[1] + py * th * s2, c[2] + pz * th * s2, 0);
              gput(c[0] + ax * len * s1, c[1] + ay * len * s1, c[2] + az * len * s1, 0);
            }
        };
        arm(e[0], e[1], e[2], Lg, e[4], e[5], e[6], Lg * 0.08); // 가로 (카메라 오른쪽)
        arm(e[4], e[5], e[6], Lg * 0.6, e[0], e[1], e[2], Lg * 0.08); // 세로 (카메라 위)
        // 가운데 빛: 팔각 부채 (반지름 = 가로 팔의 0.25)
        const r = Lg * 0.25;
        for (let j = 0; j < 8; j++) {
          const a0 = (j / 8) * Math.PI * 2, a1 = ((j + 1) / 8) * Math.PI * 2;
          gput(c[0], c[1], c[2], g);
          gput(c[0] + (e[0] * Math.cos(a0) + e[4] * Math.sin(a0)) * r, c[1] + (e[1] * Math.cos(a0) + e[5] * Math.sin(a0)) * r, c[2] + (e[2] * Math.cos(a0) + e[6] * Math.sin(a0)) * r, 0);
          gput(c[0] + (e[0] * Math.cos(a1) + e[4] * Math.sin(a1)) * r, c[1] + (e[1] * Math.cos(a1) + e[5] * Math.sin(a1)) * r, c[2] + (e[2] * Math.cos(a1) + e[6] * Math.sin(a1)) * r, 0);
        }
      }
    }
    ggeo.setDrawRange(0, gn);
    gmesh.visible = gn > 0;
    if (gn > 0) {
      ggeo.attributes.position.needsUpdate = true;
      ggeo.attributes.color.needsUpdate = true;
    }
    fgeo.setDrawRange(0, fn);
    fmesh.visible = fn > 0;
    if (fn > 0) {
      fgeo.attributes.position.needsUpdate = true;
      fgeo.attributes.color.needsUpdate = true;
    }
    ageo.setDrawRange(0, an);
    amesh.visible = an > 0;
    if (an > 0) {
      ageo.attributes.position.needsUpdate = true;
      ageo.attributes.color.needsUpdate = true;
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
      arcs[i].pts = null;
      lunges[i].A = null;
      arcs[i].id = f?.instantArc?.id ?? 0;
      // 띠 색: 그 칼날 재질 색 × dim (청강검이면 그 색조) — 늘 칼보다 어둡다
      const bc = f?.bladeMesh?.material?.color;
      s.base.copy(bc ?? STEEL).multiplyScalar(SWORD_TRAIL.dim);
      handles.push({ setTone: (name) => void (s.tone = TONES[name] ?? null) });
    }
    geo.setDrawRange(0, 0);
    mesh.visible = false;
    ggeo.setDrawRange(0, 0);
    gmesh.visible = false;
    return handles;
  };
  const clear = () => {
    for (const s of slots) s.n = 0;
    for (const A of arcs) A.pts = null;
    for (const L of lunges) L.A = null;
    geo.setDrawRange(0, 0);
    mesh.visible = false;
  };

  return { sample, update, attach, clear, mesh };
}

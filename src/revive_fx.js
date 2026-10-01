// ─────────────────────────────────────────────────────────────
//  부활 연출: 하늘에서 성스러운 빛이 내려와 쓰러진 검객을 비추고, 그 빛 속에서 다시 일어선다
//   오너 요청 (2026-09-28): "부활 이펙트는 하늘에서 성스러운 빛이 홀리한 효과음과 함께 이졸데를 비추고 이졸데가 대사 혹은
//   상태 메시지와 함께 다시 일어서면 좋겠어. 온라인 게임의 부활이나 힐 스킬 이펙트를 참고해봐 wow 등."
//   참고: WoW 의 부활(Resurrection)·성스러운 빛(Holy Light)·사제 치유 — 하늘에서 대상에게 떨어지는 따뜻한 흰금빛 기둥,
//   그 안에 떠다니는 빛 알갱이, 땅에 번지는 부드러운 빛 고리, 일어서는 몸이 잠깐 빛난다.
//
//  규칙·시간은 src/revive.js (fighter.revival: phase·t·standT, 시간 값은 fighter.revive). 여기는 그것을 읽어 그리기만 한다
//   (물리·판정에 아무 영향 없음). 순서 (쓰러진 순간 t = 0, 물리 시간 — 멈춤·슬로모션을 그대로 따른다):
//    0      쓰러짐 (신호 'fall': main 이 신음을 낸다)
//    lightAt 가는 빛줄기가 하늘에서 땅까지 내려온다 (신호 'light': sound.revive) → descend 동안 다 펼쳐진다
//    +descend 땅에 빛 고리가 번지고 알림 (신호 'notice')
//    lie    빛 속에서 일어서기 시작 — 몸이 차츰 빛난다
//    standT 다 섰다: 몸이 한 번 번쩍, 빛 고리 한 번 더 → linger 동안 머물고 → fade 동안 사라진다 → 부활 끝, 싸움이 이어진다
//
//  그림 (디자인 언어 docs/design_language.md: 로우폴리·평면, 후처리 없음): 전부 더하기 섞기(additive)라 무엇 위에서도 밝게 읽힌다
//   · 빛기둥 둘 (바깥 금빛 · 안쪽 흰 심지): 뚜껑 없는 원기둥 20면. 가장자리가 부드럽고(보는 방향과 면의 각), 위로 갈수록 하늘에
//     녹으며, 땅 가까이 빛이 고인다. 가로 띠가 천천히 흘러내린다
//   · 빛 알갱이 120개: 점 하나씩(Points), 움직임은 전부 셰이더가 시간으로 계산한다 (매 프레임 CPU 일 없음)
//   · 땅의 빛: 판 한 장 — 빛이 고인 둥근 웅덩이 + 번져 나가는 고리 두 개 (땅에 닿을 때, 다 섰을 때)
//   · 진짜 빛 하나 (PointLight, #fff1c8, 그림자 없음): 그녀와 둘레 땅을 실제로 밝힌다
//   · 몸의 빛: 그녀 옷·살 재질의 스스로 빛남(emissive)을 잠깐 올렸다 되돌린다 (그녀만의 재질이라 상대는 그대로)
//  낮·밤: 캐릭터 조명(fighter_light.js)이 잰 스테이지 밝기로 세기를 고른다 — 밝은 낮엔 빛기둥·땅의 빛을 조금 짙게(밝은 벽·눈에 묻히지
//   않게), 밤엔 캐릭터 채움 빛이 이미 세므로 진짜 빛을 낮춘다. 흰 심지는 몸통보다 가늘고 몸의 빛은 옅게 고정 — 낮에 그녀가 하얗게 타
//   빛 속에 묻히지 않게 (성 안뜰·픽셀 모드 사진으로 맞췄다)
//  비용: 그리기 4번(빛기둥 2 · 땅 1 · 알갱이 1), 삼각형 82개 + 점 120개. 모양·재질은 처음 한 번 만들어 계속 다시 쓰고, 매 프레임
//   새로 만드는 것이 없다. 부활하는 동안만 장면에 붙는다 (판·배경이 바뀌거나 결과 화면이 뜨면 reset 으로 뗀다).
//   빛 하나가 붙고 떨어질 때 모든 재질의 셰이더가 바뀌므로, 부활하는 상대가 나오는 판을 세울 때 warm() 으로 미리 만들어 둔다
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

const TOP = 18; // 빛기둥 높이 (m): 경기장 훨씬 위, 카메라에 윗끝이 보이지 않는다
const R_OUT = 0.95; // 바깥 빛기둥 반지름 (m)
const R_CORE = 0.22; // 흰 심지 반지름 (몸통보다 가늘게: 그녀 몸이 흰빛에 묻히지 않게)
const MOTES = 120;
const MOTE_H = 3.2; // 알갱이가 떠다니는 높이 (m)
const HALO = 2.2; // 땅 빛 판의 반 너비 (m)
const LIGHT_COLOR = 0xfff1c8;
const GOLD = new THREE.Color(1.0, 0.84, 0.52);
const WHITE_GOLD = new THREE.Color(1.0, 0.96, 0.84);
const GLOW = new THREE.Color(1.0, 0.86, 0.58); // 몸의 빛 색

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const BEAM_VS = /* glsl */ `
varying vec3 vWP;
varying vec2 vN;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vN = position.xz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const BEAM_FS = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uTime;
uniform float uBottom;
uniform float uEdge;
varying vec3 vWP;
varying vec2 vN;
void main() {
  vec2 n = normalize(vN);
  vec2 v = cameraPosition.xz - vWP.xz;
  float e = abs(dot(n, v / max(length(v), 1e-4))); // 1 = 기둥 가운데, 0 = 가장자리
  float soft = pow(e, uEdge);
  float y = vWP.y;
  float bottom = smoothstep(uBottom, uBottom + 0.7, y); // 내려오는 빛줄기의 끝
  float top = 1.0 - smoothstep(2.5, ${TOP.toFixed(1)}, y); // 위로 갈수록 하늘에 녹는다
  float pool = 1.0 + 0.6 * exp(-y * 1.4); // 땅 가까이 빛이 고인다
  float ang = atan(n.y, n.x);
  float bands = 0.74 + 0.26 * sin(y * 2.4 + uTime * 2.1) * (0.6 + 0.4 * sin(ang * 3.0 + y * 0.7 - uTime * 0.8)); // 흘러내리는 띠
  gl_FragColor = vec4(uColor, uAlpha * soft * bottom * top * pool * bands);
}`;

const HALO_VS = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const HALO_FS = /* glsl */ `
uniform vec3 uColor;
uniform float uPool;
uniform float uPoolR;
uniform vec4 uRings; // (반지름1, 세기1, 반지름2, 세기2)
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * ${(2 * HALO).toFixed(2)};
  float a = uPool * exp(-(r * r) / (uPoolR * uPoolR));
  float d1 = (r - uRings.x) / 0.13;
  float d2 = (r - uRings.z) / 0.13;
  a += uRings.y * exp(-d1 * d1) + uRings.w * exp(-d2 * d2);
  a *= 1.0 - smoothstep(${(HALO * 0.8).toFixed(2)}, ${HALO.toFixed(2)}, r);
  gl_FragColor = vec4(uColor, a);
}`;

const MOTE_VS = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform float uR;
uniform float uSize;
uniform float uScale;
uniform float uBottom;
uniform float uAlpha;
varying float vA;
void main() {
  float sp = 0.3 + aSeed.z * 0.8;
  float dir = aSeed.w < 0.3 ? -1.0 : 1.0; // 열에 셋은 내려오고 나머지는 떠오른다
  float y = mod(aSeed.w * 37.0 + uTime * sp * dir, ${MOTE_H.toFixed(1)});
  float ang = aSeed.x * 6.2832 + uTime * (0.35 + aSeed.z * 0.9) * (aSeed.y < 0.5 ? 1.0 : -1.0);
  float r = uR * (0.12 + 0.88 * sqrt(aSeed.y));
  vec4 mv = modelViewMatrix * vec4(cos(ang) * r, y, sin(ang) * r, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.5, uSize * (0.6 + 0.8 * aSeed.z) * uScale / max(0.1, -mv.z));
  float fy = smoothstep(0.0, 0.25, y) * (1.0 - smoothstep(${(MOTE_H * 0.55).toFixed(2)}, ${MOTE_H.toFixed(1)}, y));
  float tw = 0.55 + 0.45 * sin(uTime * (3.0 + aSeed.x * 5.0) + aSeed.y * 31.0); // 반짝임
  vA = uAlpha * fy * tw * step(uBottom, y);
}`;
const MOTE_FS = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(uColor, vA * (1.0 - smoothstep(0.15, 0.5, d)));
}`;

function additive(vs, fs, uniforms, side = THREE.FrontSide) {
  return new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side, fog: false });
}

export class ReviveFx {
  /**
   * @param scene
   * @param o { renderer, camera, fighterLight } — fighterLight(fighter_light.js)의 stageLight 로 낮·밤 세기를 고른다
   */
  constructor(scene, { renderer, camera, fighterLight } = {}) {
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;
    this.fighterLight = fighterLight;
    this.onCue = null; // (cue: 'fall' | 'light' | 'notice', fighter) → main 이 소리·알림을 낸다
    this.f = null;
    this.V = null;
    this.time = 0;
    this.cued = { light: false, notice: false };
    this.mats = []; // 몸의 빛: { m, e(원래 emissive), i(원래 emissiveIntensity) }
    this.pos = new THREE.Vector3();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector2();

    const g = (this.group = new THREE.Group());
    g.name = 'reviveFx';
    // 빛기둥: 뚜껑 없는 원기둥 (밑이 0, 높이 1 → scale 로 늘린다)
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true).translate(0, 0.5, 0);
    const beamU = (color, edge) => ({ uColor: { value: color.clone() }, uAlpha: { value: 0 }, uTime: { value: 0 }, uBottom: { value: TOP }, uEdge: { value: edge } });
    this.outer = new THREE.Mesh(cyl, additive(BEAM_VS, BEAM_FS, beamU(GOLD, 1.6), THREE.DoubleSide));
    this.core = new THREE.Mesh(cyl, additive(BEAM_VS, BEAM_FS, beamU(WHITE_GOLD, 2.2), THREE.DoubleSide));
    // 땅의 빛 (땅보다 살짝 위, 겹쳐 깜박이지 않게 깊이를 조금 당긴다)
    const halo = new THREE.PlaneGeometry(2 * HALO, 2 * HALO).rotateX(-Math.PI / 2);
    this.halo = new THREE.Mesh(halo, additive(HALO_VS, HALO_FS, { uColor: { value: GOLD.clone() }, uPool: { value: 0 }, uPoolR: { value: 0.9 }, uRings: { value: new THREE.Vector4() } }));
    Object.assign(this.halo.material, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.halo.position.y = 0.02;
    // 빛 알갱이: 자리·움직임은 셰이더가 씨앗(aSeed)과 시간으로 계산한다. 씨앗은 고정 난수 (게임 난수를 건드리지 않는다)
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MOTES * 3), 3));
    const seed = new Float32Array(MOTES * 4);
    let s = 0x2f6b1d;
    for (let i = 0; i < seed.length; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      seed[i] = s / 4294967296;
    }
    mg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    this.motes = new THREE.Points(
      mg,
      additive(MOTE_VS, MOTE_FS, { uColor: { value: WHITE_GOLD.clone() }, uTime: { value: 0 }, uR: { value: R_OUT * 0.8 }, uSize: { value: 0.05 }, uScale: { value: 400 }, uBottom: { value: TOP }, uAlpha: { value: 0 } }),
    );
    // 진짜 빛: 그녀와 둘레 땅을 밝힌다 (그림자 없음)
    this.light = new THREE.PointLight(LIGHT_COLOR, 0, 7, 2);
    this.light.castShadow = false;
    for (const m of [this.outer, this.core, this.halo, this.motes]) {
      m.frustumCulled = false; // 크기를 매 프레임 바꾸고, 알갱이는 셰이더가 옮긴다
      m.renderOrder = 20;
      g.add(m);
    }
    g.add(this.light);
  }

  get active() {
    return !!this.V;
  }

  /**
   * 부활하는 상대가 나오는 판을 세울 때 (main.js newRound): 빛 하나가 더해진 셰이더를 지금 만들어 둔다.
   *  안 하면 빛이 처음 내려오는 순간 장면의 모든 재질이 셰이더를 새로 만들어 화면이 멈칫한다. 재질마다 두 가지(빛 있음·없음)를
   *  기억해 두므로 그 뒤로는 빛을 붙였다 떼도 새로 만들지 않는다
   */
  warm() {
    if (!this.renderer || !this.camera || this.group.parent) return;
    this.scene.add(this.group);
    this.renderer.compile(this.scene, this.camera);
    this.scene.remove(this.group);
  }

  /** 매 프레임 (싸움 중): f = 부활할 수 있는 싸움꾼 (지금은 상대), dt = 게임 시간 (슬로모션 반영) */
  update(f, dt) {
    const V = f?.revival;
    if (!V) {
      if (this.V) this.reset();
      return;
    }
    if (V !== this.V || f !== this.f) this.start(f, V);
    const R = f.revive;
    this.time += dt;
    const T = V.t;
    const L = R.lightAt;
    const D = R.descend;
    if (!this.cued.light && T >= L) {
      this.cued.light = true;
      this.onCue?.('light', f);
    }
    if (!this.cued.notice && T >= L + D) {
      this.cued.notice = true;
      this.onCue?.('notice', f);
    }
    // 낮(1) · 밤(0): 캐릭터 세로 면에 닿는 스테이지 빛 (포세이돈 약 0.78, 대성당 0.40, 어두운 홀 0.03)
    const day = clamp01(((this.fighterLight?.stageLight ?? 0.6) - 0.1) / 0.6);

    // 빛기둥: 가늘게 땅까지 내려오고(u 0~0.8) 다 내려오면 넓게 펼쳐진다(u 0.6~1). 내려오는 끝은 처음엔 빠르고(하늘 높이, 화면 밖)
    //  땅 가까이에서 느려진다 (세제곱 감속) — 카메라에 보이는 5m 아래를 지나는 동안이 눈에 들어오게
    const u = clamp01((T - L) / D);
    const fall = 1 - clamp01(u / 0.8);
    const bottom = u <= 0 ? TOP : TOP * fall * fall * fall;
    const width = 0.1 + 0.9 * smooth(0.6, 1, u);
    const touch = smooth(0.7, 0.95, u); // 빛이 땅에 닿은 정도
    const standT = V.standT >= 0 ? V.standT : Infinity;
    const out = 1 - clamp01((T - standT - R.linger) / R.fade); // 사라짐
    const breathe = 1 + 0.07 * Math.sin(this.time * 2.6);
    const I = (u > 0 ? 1 : 0) * out * breathe;

    // 그녀를 따라간다 (쓰러진 자리에서 거의 안 움직이지만, 떨림 없이 부드럽게)
    const p = f.bodies.pelvis.translation();
    this.pos.x += (p.x - this.pos.x) * Math.min(1, dt * 6);
    this.pos.z += (p.z - this.pos.z) * Math.min(1, dt * 6);
    this.group.position.set(this.pos.x, 0, this.pos.z);

    const ou = this.outer.material.uniforms;
    const cu = this.core.material.uniforms;
    this.outer.scale.set(R_OUT * width, TOP, R_OUT * width);
    this.core.scale.set(R_CORE * (0.5 + 0.5 * width), TOP, R_CORE * (0.5 + 0.5 * width));
    // 그녀가 빛 속에서 보이게 옅게 (심지까지 하얗게 타면 몸이 묻힌다). 밝은 낮엔 조금 짙게
    ou.uAlpha.value = I * (0.15 + 0.1 * day);
    cu.uAlpha.value = I * (0.18 + 0.06 * day) * (1.6 - 0.6 * width); // 가늘게 내려올 땐 심지가 더 밝다
    ou.uBottom.value = cu.uBottom.value = bottom;
    ou.uTime.value = cu.uTime.value = this.time;

    // 땅: 빛 웅덩이 + 고리 (땅에 닿는 순간, 다 섰을 때)
    const hu = this.halo.material.uniforms;
    hu.uPool.value = I * touch * (0.3 + 0.2 * day);
    hu.uPoolR.value = 0.55 + 0.45 * width;
    // 고리: 0.9초 동안 반지름 0.3 → 1.9m 로 번지며 옅어진다
    const k1 = (T - (L + 0.8 * D)) / 0.9;
    const k2 = (T - standT) / 0.9; // (아직 안 섰으면 -Infinity → 세기 0)
    const c1 = clamp01(k1);
    const c2 = clamp01(k2);
    const ringA = 0.8 + 0.4 * day;
    hu.uRings.value.set(0.3 + 1.6 * (1 - (1 - c1) * (1 - c1)), k1 < 0 || k1 > 1 ? 0 : (1 - k1) * ringA, 0.3 + 1.6 * (1 - (1 - c2) * (1 - c2)), k2 < 0 || k2 > 1 ? 0 : (1 - k2) * ringA);

    // 알갱이
    const mu = this.motes.material.uniforms;
    mu.uTime.value = this.time;
    mu.uBottom.value = bottom;
    mu.uR.value = R_OUT * 0.8 * width;
    mu.uAlpha.value = I * touch * (0.75 + 0.25 * day);
    if (this.renderer && this.camera) {
      const h = this.renderer.getDrawingBufferSize(this._s).y;
      mu.uScale.value = h / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    }

    // 진짜 빛: 그녀 위, 카메라 쪽으로 조금 (얼굴·앞면과 둘레 땅이 밝아진다)
    this.light.intensity = I * touch * (3 + 3 * day);
    const cam = this.camera?.position;
    const toCam = cam ? this._v.set(cam.x - this.pos.x, 0, cam.z - this.pos.z) : this._v.set(0, 0, 0);
    const lc = toCam.length();
    if (lc > 1e-3) toCam.multiplyScalar(0.7 / lc);
    this.light.position.set(toCam.x, 2.1, toCam.z);

    // 몸의 빛: 일어서며 차츰 밝아지다 다 서는 순간 한 번 번쩍, 빛과 함께 사라진다
    const rise = smooth(R.lie - 0.2, R.lie + R.kneel + R.rise, T);
    const flash = T >= standT ? Math.exp(-(T - standT) / 0.35) : 0;
    const glow = (0.2 * touch + 0.5 * rise + 0.5 * flash) * out * 0.3; // 빛기둥·진짜 빛이 이미 밝히므로 옅게 (낮엔 하얗게 탄다)
    for (const { m, e, i } of this.mats) m.emissive.setRGB(e.r * i + GLOW.r * glow, e.g * i + GLOW.g * glow, e.b * i + GLOW.b * glow);
  }

  start(f, V) {
    this.reset();
    this.f = f;
    this.V = V;
    this.time = 0;
    // (도중에 다시 붙는 경우 — 배경을 바꿔 치웠다가: 이미 지난 신호는 다시 내지 않는다)
    const R = f.revive;
    this.cued.light = V.t >= R.lightAt;
    this.cued.notice = V.t >= R.lightAt + R.descend;
    const p = f.bodies.pelvis.translation();
    this.pos.set(p.x, 0, p.z);
    // 그녀의 몸 재질만 (칼은 무기 재질을 다른 싸움꾼과 나눠 쓸 수 있어 뺀다). 원래 값을 적어 두었다가 되돌린다
    const seen = new Set();
    for (const k in f.groups)
      f.groups[k].traverse((o) => {
        if (!o.isMesh) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (!m?.emissive || seen.has(m)) continue;
          seen.add(m);
          this.mats.push({ m, e: m.emissive.clone(), i: m.emissiveIntensity });
          m.emissiveIntensity = 1;
        }
      });
    this.light.intensity = 0;
    this.scene.add(this.group);
    if (V.t < 0.3) this.onCue?.('fall', f);
  }

  /** 치우기: 장면에서 떼고 몸 재질을 되돌린다 (부활 끝 · 새 판 · 배경 바뀜 · 결과 화면) */
  reset() {
    for (const { m, e, i } of this.mats) {
      m.emissive.copy(e);
      m.emissiveIntensity = i;
    }
    this.mats.length = 0;
    if (this.group.parent) this.group.parent.remove(this.group);
    this.light.intensity = 0;
    this.f = null;
    this.V = null;
  }
}

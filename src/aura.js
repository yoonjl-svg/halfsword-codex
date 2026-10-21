// ─────────────────────────────────────────────────────────────
//  레전드 무기의 기운 (보여 주기만 한다. 물리·판정에는 영향이 없다) — 사장님 10/10 20:0x "빛 나는 건 레전드 등급 특성이지 엑스칼리버 특성이 아니다".
//  처음엔 진짜 엑스칼리버 하나뿐이었다(아래 설명은 그때 글 — 지금은 간장·막야도 색만 바꿔 같은 꼴).
//
//  가짜(복제품)와 생김새는 거의 같다. 진짜만 칼날 둘레가 아지랑이처럼 일렁이고,
//  은은한 빛이 주변(손·몸·땅)을 비춘다. 멀리서는 잘 모르고, 가까이서 보면 "뭔가 다르다" 정도로.
//
//  - 일렁임: 칼날보다 넓은 투명한 판 두 장(직각으로 교차). 셰이더가 시간에 따라 흐르는 무늬로
//    투명도를 바꿔, 칼날 가장자리에서 옅은 금빛이 피어오르는 것처럼 보이게 한다.
//  - 칼날 자체도 숨 쉬듯 은은하게 빛난다 (자체 발광).
//  - 빛: 칼날 가운데에 작은 점 조명 하나. 세기가 숨 쉬듯 천천히 오르내린다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

// 무기별 기운 (샛별 저장소에서 가져옴 b4464ef·3f1af8c — 간장·막야): 셋 다 엑스칼리버와 같은 판·세기(0.5)를 쓴다(10/21 쿠사나기도 같은 판 — 아래 줄). 간장·막야는 프로필 칸·입자로 은은하게 (10/10 리뷰 1차 → 10/11 사장님 2차 되돌림, 아래).
//  막야의 먹빛은 음수 빛이 아니라 옅은 검은 아지랑이(점 조명·칼날 발광 없음). 복제품·보통 무기는 기운이 없다.
//  기운 = 레전드 등급의 표식 (사장님 10/10 20:0x). 9/29 의 "진짜 엑스칼리버의 유일한 표식"을 고쳐 적음. 기운은 무기 id 표(이 표)로 붙는다 — 등급만 보고 저절로 붙지는 않는다.
//  복제품(excalibur_replica)은 등급이 커먼이라 기운이 없다(겉면 마감 finishTier 만 레전드) — 동작 그대로
//  간장·막야 (10/10 에셋 리뷰 §1 — 막야 먹빛이 화면에서 거의 안 보이고, 간장 흰빛은 폰 경기 화면에서 약했다 → 1차로 넓히고 테·입자를 더함)
//   → 사장님 10/11 00:1x "간장막야 후광 너무 과해졌어… 스카이세이버처럼 보이면 안돼. 액스칼리버도 처음에 너무 만화같이 튀어서 은은하게 바꿨던거야":
//   2차로 되돌림. 목표는 '보인다'가 아니라 '은은하게 있다'(엑스칼리버 0.5 와 같은 결). 판 폭·옅어지는 거리는 엑스칼리버 값, 바깥 테 없앰(광선검 띠의 주된 원인),
//   입자는 가끔 스치는 먹 연기·불티 몇 개만. 밤 무대에서 막야가 거의 안 보이는 것은 받아들인다(사장님은 과한 쪽을 더 싫어한다).
//   AURA_STRENGTH 0.5 와 엑스칼리버 줄은 그대로. 빈 칸 = 엑스칼리버와 같은 값(같은 식).
//   gain = 아지랑이 투명도 배율(기본 1) · fall = 칼날 가장자리에서 옅어지는 거리(m, 기본 0.022) · halfW = 판 절반 폭(m, 기본 0.11)
//   rim = 아지랑이 바깥 테 색(기본 없음 — 지금 아무도 안 씀) · rimA = 테 투명도 · rimAt = 칼날 가장자리에서 테 한가운데까지(m) · rimW = 테 두께(m)
//   간장: 흰 아지랑이 1.1 배 + 흰 불티 6 개. 점 조명 그대로, 칼날 발광 없음(어두운 칼몸 그대로).
//   막야: 먹 아지랑이 1.2 배(보통 섞기라 밝은 바닥 위에서 옅은 먹 그림자) + 먹 연기 8 개. 점 조명·칼날 발광 없음 — 먹은 빛을 내지 않는다.
export const AURA_PROFILES = Object.freeze({
  // 은금 덩굴의 발리사르다: 기존 레전드와 같은 세기의 옅은 샴페인빛.
  balisarda: { tone: 'champagne', color: [1.0, 0.91, 0.70], light: 0xffedc2, emissive: 0xffebbc, gain: 0.8 },
  excalibur: { tone: 'gold', color: [1.0, 0.82, 0.45], light: 0xffd98a, emissive: 0xffe2a0 },
  ganjiang: { tone: 'white', color: [0.92, 0.96, 1.0], light: 0xf3f7ff, emissive: null,
    gain: 1.1,
    motes: { n: 6, size: 0.016, alpha: 0.5, color: [0.95, 0.97, 1.0], rim: [0.80, 0.88, 1.0], far: 0.0 } },
  moye: { tone: 'ink', color: [0.035, 0.029, 0.045], light: null, emissive: null,
    gain: 1.2,
    motes: { n: 8, size: 0.028, alpha: 0.55, color: [0.035, 0.029, 0.045], rim: [0.56, 0.66, 0.76], far: 0.25 } },
  // 쿠사나기 (10/21 사장님 '칼 그래픽과 비슷한 녹색 어때? 아니면 칼의 전설과 더 어울리는 색상이 있나?'): 옥빛 풀색 아지랑이 + 구름빛 흰 입자.
  //  풀색 = 草薙(풀을 베어 불길 속의 길을 연 칼) · 칼몸(0xc0d7d3)과 곡옥(0x559784)의 옥빛에 맞춤, 흰 입자 = 天叢雲剣(큰 뱀 위에 늘 구름이 모여 있던 칼).
  //  같은 세기 0.5 에 아지랑이만 0.8 배 — 녹색은 눈밭 · 돌벽 위에서 금빛보다 더 도드라져 보여, 엑스칼리버와 같은 '은은하게 있다' 결에 맞춤.
  //  입자는 간장 불티 수(6)에 조금 크고 옅게(구름 결). 견줌 후보: 먹구름 회청빛(확인 기록 사진만, 표에 넣지 않음)
  kusanagi: { tone: 'jade', color: [0.64, 0.88, 0.75], light: 0xa6eec4, emissive: 0xb4f0cf,
    gain: 0.8,
    motes: { n: 6, size: 0.022, alpha: 0.42, color: [0.95, 0.97, 0.96], rim: [0.78, 0.88, 0.86], far: 0.0 } },
});
//   motes = 칼날 둘레에서 피어올라 옅어지는 작은 입자(간장 흰 불티 · 막야 먹 연기). 판 두 장은 플레이어 등 뒤 카메라(칼끝이 화면 안쪽을 향함)에서
//    옆으로 누워 거의 안 보여서, 어느 쪽에서 봐도 보이는 점 입자를 더한다. n 개수 · size 지름(m) · alpha 투명도(AURA_STRENGTH 곱하기 전) ·
//    color 가운데 색 · rim 가장자리 색 · far = 화면에서 몇 픽셀로 작아졌을 때 가장자리 색을 섞는 몫(막야: 먹 + 회청 → 어두운 무대·눈밭 둘 다에서 읽히는 먹회색 점)
const AURA_DEFAULTS = { gain: 1, fall: 0.022, halfW: 0.11, rim: null, rimA: 0, rimAt: 0.05, rimW: 0.02, motes: null };

const MOTE_VERT = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uStrength;
  uniform float uLen;   // 칼날 길이 (m)
  uniform float uSize;  // 입자 지름 (m)
  uniform float uViewH; // 그리는 화면 높이 (px)
  uniform float uAlpha;
  varying float vA;
  varying float vFar;
  void main() {
    float sp = 0.22 + 0.16 * fract(aSeed * 7.13);
    float ph = fract(uTime * sp + aSeed);                    // 한 입자의 한살이 0 → 1
    float ang = aSeed * 43.7 + uTime * (fract(aSeed * 3.7) - 0.5) * 0.8;
    float rad = 0.012 + ph * 0.05;                            // 칼날 곁에서 나와 바깥으로 번진다
    float y = (fract(aSeed * 12.9898) - 0.5) * uLen * 0.9 + ph * 0.07; // 칼끝 쪽으로 조금 흐른다
    vec3 p = vec3(cos(ang) * rad, y, sin(ang) * rad);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float px = uSize * projectionMatrix[1][1] * 0.5 * uViewH / max(-mv.z, 0.05);
    gl_PointSize = max(px, 2.5);                              // 멀리서도 2.5 px 아래로는 안 작아진다 (폰 경기 화면)
    vFar = clamp((9.0 - px) / 6.0, 0.0, 1.0);
    vA = sin(ph * 3.14159) * uAlpha * uStrength;
  }
`;
const MOTE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uRim;
  uniform float uFarMix;
  varying float vA;
  varying float vFar;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float soft = exp(-d * d * 3.5);                           // 가장자리가 흐린 둥근 점 (먹이 번진 듯)
    vec3 near = mix(uColor, uRim, smoothstep(0.4, 1.0, d) * 0.8);
    vec3 far = mix(uColor, uRim, uFarMix);
    gl_FragColor = vec4(mix(near, far, vFar), min(soft * vA, 0.95));
  }
`;
// 기운 세기 (사장님 9/29 "너무 세, 지금의 절반으로": 1 → 0.5) — 아지랑이 투명도·점 조명·칼날 발광에 모두 곱한다
const AURA_STRENGTH = 0.5;
// 점 조명만 따로 한 번 더 줄이는 몫 (사장님 10/13 23:0x '아르토리아 얼굴이 종종 아주 어둡게 변한다' — docs/character_looks_status.md round 19).
//  점 조명은 칼날 가운데에 있고 거리 제곱으로 옅어져서, 0.55~0.8 m 떨어진 든 사람의 얼굴에 무대 빛(대성당 얼굴 앞 조도 ≈ 0.45)의 1.2~2 배를 비췄다
//  → 칼을 머리 위·뒤로 들면(칼날이 얼굴 면 뒤로 가면) 그 빛이 통째로 꺼져 얼굴이 밝기 115~127 → 72~85 로 떨어졌다(얼굴만 '어둡게 변함').
//  1 → 0.15: 얼굴에 닿는 몫이 무대 빛의 ⅓ 안쪽이 되어 칼이 어디 있든 얼굴 밝기가 크게 출렁이지 않는다. 손·코등이처럼 칼날 가까운 곳(0.3~0.5 m)엔 여전히 은은하게 닿는다.
//  아지랑이·칼날 발광·입자는 그대로 (빛을 받지 않고 스스로 그린다)
const AURA_LIGHT = 0.15;

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uStrength; // AURA_STRENGTH
  uniform vec3 uColor;
  uniform float uHalfW; // 판 절반 폭 (m)
  uniform float uEdge;  // 칼날 절반 폭 (m): 빛은 칼날 가장자리에서 가장 밝고 바깥으로 옅어진다
  uniform float uGain;  // 프로필 투명도 배율 (엑스칼리버 1)
  uniform float uFall;  // 옅어지는 거리 (m, 엑스칼리버 0.022)
  uniform vec3 uRim;    // 바깥 테 색 (간장·막야)
  uniform float uRimA;  // 테 투명도 (0 = 테 없음 — 엑스칼리버)
  uniform float uRimAt; // 칼날 가장자리에서 테 한가운데까지 (m)
  uniform float uRimW;  // 테 두께 (m)
  varying vec2 vUv;
  float wave(vec2 p) {
    return sin(p.y * 38.0 - uTime * 3.1 + sin(p.x * 9.0 + uTime * 1.7) * 1.6) * 0.5 + 0.5;
  }
  void main() {
    float d = abs(vUv.x - 0.5) * 2.0 * uHalfW;           // 칼날 중심에서 떨어진 거리 (m)
    float out_ = max(d - uEdge, 0.0);                     // 칼날 가장자리 바깥으로 나간 거리
    float across = exp(-out_ / uFall);
    float along = smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
    // 위로 흐르는 아지랑이: 세로 무늬가 칼끝 쪽으로 천천히 흘러가며 흔들린다
    float flick = mix(0.45, 1.0, wave(vUv)) * mix(0.75, 1.0, sin(uTime * 0.9) * 0.5 + 0.5);
    float a = min(across * along * flick * 0.55 * uStrength * uGain, 0.9);
    // 바깥 테: 아지랑이 둘레의 옅은 띠 (같은 흐름 무늬를 조금 어긋나게 — 테가 띠처럼 굳어 보이지 않게). 아지랑이 아래에 깔고 겹쳐 섞는다
    float rb = (out_ - uRimAt) / uRimW;
    float r = exp(-rb * rb) * along * mix(0.55, 1.0, wave(vUv + vec2(0.31, 0.17))) * uRimA * uStrength;
    float ao = a + r * (1.0 - a);
    gl_FragColor = vec4((uColor * a + uRim * r * (1.0 - a)) / max(ao, 1e-4), ao);
  }
`;

/** 무기를 든 파이터에게 기운을 붙인다 (해당 무기가 아니면 null) */
export function attachAura(fighter) {
  const profile = AURA_PROFILES[fighter.weapon?.id];
  if (!profile) return null;
  const entry = fighter.meshes.find((m) => m.kind === 'weapon');
  if (!entry) return null;
  const hilt = fighter.weaponCfg.hiltLength;
  const L = fighter.weaponCfg.bladeLength;
  const midY = hilt + L / 2;

  const look = { ...AURA_DEFAULTS, ...profile };
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uStrength: { value: AURA_STRENGTH },
      uColor: { value: new THREE.Color(...profile.color) },
      uHalfW: { value: look.halfW },
      uEdge: { value: 0.026 },
      uGain: { value: look.gain },
      uFall: { value: look.fall },
      uRim: { value: new THREE.Color(...(look.rim || [0, 0, 0])) },
      uRimA: { value: look.rim ? look.rimA : 0 },
      uRimAt: { value: look.rimAt },
      uRimW: { value: look.rimW },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending, // 더하기 섞기는 밝은 모래·하늘 위에서 사라져 보여서, 보통 섞기로 옅은 금빛 막을 씌운다
    side: THREE.DoubleSide,
  });
  const geo = new THREE.PlaneGeometry(2 * look.halfW, L * 1.05);
  const group = new THREE.Group();
  group.name = 'legendaryAura';
  group.userData.legendaryAura = { weapon: fighter.weapon.id, tone: profile.tone, strength: AURA_STRENGTH };
  group.position.y = midY;
  for (const rot of [0, Math.PI / 2]) {
    const m = new THREE.Mesh(geo, mat);
    m.rotation.y = rot;
    m.renderOrder = 2;
    group.add(m);
  }
  const light = profile.light === null ? null : new THREE.PointLight(profile.light, 1.2 * AURA_STRENGTH * AURA_LIGHT, 2.0, 2);
  if (light) group.add(light);
  let moteGeo = null, moteMat = null;
  if (look.motes) {
    const mo = look.motes;
    moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(mo.n * 3), 3));
    moteGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(Float32Array.from({ length: mo.n }, (_, i) => (i * 0.6180339887) % 1), 1));
    moteMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uStrength: { value: AURA_STRENGTH }, uLen: { value: L }, uSize: { value: mo.size }, uViewH: { value: 720 },
        uAlpha: { value: mo.alpha }, uColor: { value: new THREE.Color(...mo.color) }, uRim: { value: new THREE.Color(...mo.rim) }, uFarMix: { value: mo.far },
      },
      vertexShader: MOTE_VERT,
      fragmentShader: MOTE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const motes = new THREE.Points(moteGeo, moteMat);
    motes.frustumCulled = false; // 자리는 셰이더가 정한다 (위치 버퍼는 0)
    motes.renderOrder = 3;
    const view = new THREE.Vector2();
    motes.onBeforeRender = (renderer) => { moteMat.uniforms.uViewH.value = renderer.getDrawingBufferSize(view).y; };
    group.add(motes);
  }
  entry.group.add(group);
  // 칼날 자체도 은은하게 빛난다 (밝은 낮에도 보이도록 자체 발광)
  const bladeMat = fighter.bladeMesh?.material;
  const previousEmissive = bladeMat?.emissive?.clone();
  const previousIntensity = bladeMat?.emissiveIntensity;
  if (bladeMat && profile.emissive !== null) bladeMat.emissive = new THREE.Color(profile.emissive);

  return {
    update(t) {
      mat.uniforms.uTime.value = t;
      if (moteMat) moteMat.uniforms.uTime.value = t;
      const breath = Math.sin(t * 1.3) * 0.5 + 0.5;
      if (light) light.intensity = (0.8 + 0.5 * breath + 0.12 * Math.sin(t * 4.7)) * AURA_STRENGTH * AURA_LIGHT;
      if (bladeMat && profile.emissive !== null) bladeMat.emissiveIntensity = (0.18 + 0.22 * breath) * AURA_STRENGTH;
    },
    dispose() {
      entry.group.remove(group);
      if (bladeMat && previousEmissive) {
        bladeMat.emissive.copy(previousEmissive);
        bladeMat.emissiveIntensity = previousIntensity;
      }
      geo.dispose();
      mat.dispose();
      moteGeo?.dispose();
      moteMat?.dispose();
    },
  };
}

// ─────────────────────────────────────────────────────────────
//  진짜 엑스칼리버의 기운 (보여 주기만 한다. 물리·판정에는 영향이 없다)
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

// Black is a translucent ink haze, never negative light. All three use the
// existing Excalibur envelope; replicas and ordinary weapons have no aura.
export const AURA_PROFILES = Object.freeze({
  excalibur: { tone: 'gold', color: [1.0, 0.82, 0.45], light: 0xffd98a, emissive: 0xffe2a0 },
  ganjiang: { tone: 'ink', color: [0.035, 0.029, 0.045], light: null, emissive: null },
  moye: { tone: 'white', color: [0.92, 0.96, 1.0], light: 0xf3f7ff, emissive: 0xeaf2ff },
});
// 기운 세기 (사장님 9/29 "너무 세, 지금의 절반으로": 1 → 0.5) — 아지랑이 투명도·점 조명·칼날 발광에 모두 곱한다
const AURA_STRENGTH = 0.5;

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
  varying vec2 vUv;
  float wave(vec2 p) {
    return sin(p.y * 38.0 - uTime * 3.1 + sin(p.x * 9.0 + uTime * 1.7) * 1.6) * 0.5 + 0.5;
  }
  void main() {
    float d = abs(vUv.x - 0.5) * 2.0 * uHalfW;           // 칼날 중심에서 떨어진 거리 (m)
    float out_ = max(d - uEdge, 0.0);                     // 칼날 가장자리 바깥으로 나간 거리
    float across = exp(-out_ / 0.022);
    float along = smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
    // 위로 흐르는 아지랑이: 세로 무늬가 칼끝 쪽으로 천천히 흘러가며 흔들린다
    float flick = mix(0.45, 1.0, wave(vUv)) * mix(0.75, 1.0, sin(uTime * 0.9) * 0.5 + 0.5);
    float a = across * along * flick * 0.55 * uStrength;
    gl_FragColor = vec4(uColor, a);
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

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uStrength: { value: AURA_STRENGTH },
      uColor: { value: new THREE.Color(...profile.color) },
      uHalfW: { value: 0.11 },
      uEdge: { value: 0.026 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending, // 더하기 섞기는 밝은 모래·하늘 위에서 사라져 보여서, 보통 섞기로 옅은 금빛 막을 씌운다
    side: THREE.DoubleSide,
  });
  const geo = new THREE.PlaneGeometry(0.22, L * 1.05);
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
  const light = profile.light === null ? null : new THREE.PointLight(profile.light, 1.2 * AURA_STRENGTH, 2.0, 2);
  if (light) group.add(light);
  entry.group.add(group);
  // 칼날 자체도 은은하게 빛난다 (밝은 낮에도 보이도록 자체 발광)
  const bladeMat = fighter.bladeMesh?.material;
  const previousEmissive = bladeMat?.emissive?.clone();
  const previousIntensity = bladeMat?.emissiveIntensity;
  if (bladeMat && profile.emissive !== null) bladeMat.emissive = new THREE.Color(profile.emissive);

  return {
    update(t) {
      mat.uniforms.uTime.value = t;
      const breath = Math.sin(t * 1.3) * 0.5 + 0.5;
      if (light) light.intensity = (0.8 + 0.5 * breath + 0.12 * Math.sin(t * 4.7)) * AURA_STRENGTH;
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
    },
  };
}

// ─────────────────────────────────────────────────────────────
//  캐릭터 전용 조명 (모든 스테이지 공통, main.js 가 가진다)
//   스테이지는 반구광(hemi)·해(sun)를 마음대로 바꾼다. 밤 스테이지는 불빛을 꼭짓점 색·빛나는 재질에 구워
//   방은 밝아 보이는데, 진짜 조명(hemi·sun)만 받는 캐릭터는 카메라 쪽 면이 거의 검게 나왔다
//   (어두운 홀: 어두운 보랏빛 반구광 0.55 + 거의 바로 위에서 내리는 샹들리에 → 세로 면은 N·L≈0).
//   그래서 캐릭터 재질에만 빛 네 가지를 셰이더로 더한다. 진짜 THREE 조명이 아니라서 바닥·벽은 전혀
//   밝아지지 않고(스테이지 분위기 그대로), 그림자 계산도 없다.
//    · 보조광(key): 카메라 왼쪽 위에서 비추는 방향광 → 카메라가 보는 면(주인공 등, 상대 앞)이 밝아진다
//    · 바탕빛(ambient): 그늘진 곳(팔 밑·다리 안쪽)이 새까매지지 않게 고르게 조금
//    · 테두리광(rim): 캐릭터 뒤 위쪽에서 → 어깨·머리 윤곽이 어두운 배경에서 떨어져 보인다
//    · 윤곽 빛(glow): 테두리광 쪽 윤곽(카메라에 비스듬한 면)에 옷 색과 상관없이 옅게 더하는 빛.
//      검은 옷(마르그레테)은 빛을 받아도 검어서 테두리광만으로는 어두운 바닥에 묻힌다 → 실루엣만 살짝 떠오르게
//   세기는 자동이다: 스테이지 빛이 캐릭터 세로 면에 주는 밝기를 어림해서, 기준(level)에 모자라는 만큼에 비례해
//   채운다. 낮 스테이지(포세이돈·산사·성 안뜰·대성당)는 이미 넘으므로 0 — 예전과 똑같이 그려진다.
//   금속(갑옷·칼)이 비추는 반사 환경(weapon_looks.js weaponEnv, 낮 하늘)도 어두운 스테이지에서는 줄인다
//   (밤에 갑옷이 낮 하늘을 비춰 하얗게 빛나던 것).
//   어림에는 main.js 의 hemi·sun 만 들어간다. 스테이지가 따로 단 진짜 조명(PointLight 등)은 세지 않는다 → 그 빛은 채움 위에 더해진다
//
//  스테이지가 할 수 있는 것: 반환 객체에 fighterLight 를 넣어 색을 물들이고 더 밝게 할 수 있다 (없어도 된다)
//    fighterLight: { color, level, rim, rimColor, env }
//      color    보조광·바탕빛 색 (밝기는 무시하고 색만 쓴다). 기본: 해 색과 흰색의 반반
//      level    "어둡다"의 기준. 올리면 캐릭터가 더 밝아진다. 기본 LEVEL, LEVEL_MIN 아래로는 못 내린다
//      rim      테두리광·윤곽 빛 세기 배율 (기본 1 = 모자란 만큼에 비례, RIM_MIN~3)
//      rimColor 테두리광·윤곽 빛 색. 기본: 반구광 하늘색과 흰색의 반반
//      env      금속 반사 세기 배율 (ENV_MIN~1). 기본: 스테이지 밝기에서 자동
//   색은 짙게 적어도 한 채널이 밝기의 CHROMA_MAX 배를 넘지 않게 흰색 쪽으로 옅어진다 (새파랑 0x0000ff → 푸르스름한 흰빛)
//  끌 수는 없다. 자세한 약속은 docs/stages.md 의 "조명 약속".
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export const LEVEL = 0.38; // 캐릭터 세로 면에 닿는 스테이지 빛이 이보다 적으면 "어둡다"고 보고 채운다 (선형 조도. 포세이돈 ≈ 0.78, 대성당 ≈ 0.40, 어두운 홀 ≈ 0.03)
export const LEVEL_MIN = 0.3; // 스테이지가 level 을 이보다 낮게 적어도 여기까지는 본다
export const ENV_MIN = 0.4; // 금속 반사를 이보다 더 줄이지는 않는다 (완전히 죽으면 금속이 검은 플라스틱처럼 보인다)
export const RIM_MIN = 0.5; // 테두리광·윤곽 빛 배율을 이보다 낮게 적어도 여기까지는 준다 (어두운 배경에서 실루엣이 사라지지 않게)
const ENV_REF = 0.35; // 스테이지 빛이 이만큼 이상이면 금속 반사는 그대로
const CHROMA_MAX = 2; // 빛 색의 한 채널이 밝기(1)의 이 배를 넘으면 흰색 쪽으로 옅게 (짙은 순색은 한 채널만 타 버려 오히려 어둡고 납작해진다)
// 모자란 만큼(level − 스테이지 빛)에 곱하는 세기. 보조광은 카메라가 보는 면에 곧장 닿아 반구광보다 효율이 좋지만,
//  그늘·모서리까지 읽히려면 모자란 양보다 넉넉히 줘야 한다 (어두운 홀에서 재 보고 정했다: 캐릭터 평균 밝기 약 2.6배)
const KEY = 1.8; // 보조광
const AMB = 0.8; // 바탕빛
const RIM = 2.0; // 테두리광 (rim 배율 1일 때)
const GLOW = 0.6; // 윤곽 빛 (rim 배율 1일 때)
// 빛 방향은 카메라 기준(뷰 공간, 표면 → 빛): 카메라가 돌면 같이 돈다 → 늘 카메라가 보는 면을 비춘다
const KEY_DIR = new THREE.Vector3(-0.45, 0.5, 0.75).normalize(); // 카메라 왼쪽 위 앞
const RIM_DIR = new THREE.Vector3(0.35, 0.55, -0.75).normalize(); // 캐릭터 뒤 오른쪽 위
const RESCAN = 60; // 캐릭터 물체 목록을 이 프레임마다 한 번은 새로 훑는다 (보통은 붙고 떨어질 때만 — 아래 update)

const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; // 선형 색의 밝기
const WHITE = new THREE.Color(1, 1, 1);
/** 색만 남긴다 (밝기 1, out 에 담는다). 흰색 쪽으로 mixWhite 만큼 섞는다 — 스테이지 색을 따르되 너무 짙게 물들지 않게.
 *  한 채널이 CHROMA_MAX 를 넘으면 그만큼 더 섞는다 (밝기 1 인 색끼리 섞으니 밝기는 그대로 1).
 *  검은색이면 흰색으로 본다 (색을 검게 적어 빛을 끄는 일이 없게) */
function hue(c, mixWhite, out) {
  const l = lum(c);
  if (!(l >= 1e-4)) return out.copy(WHITE);
  out.copy(c).multiplyScalar(1 / l);
  const mx = Math.max(out.r, out.g, out.b);
  const t = Math.max(mixWhite, mx > CHROMA_MAX ? (mx - CHROMA_MAX) / (mx - 1) : 0);
  return out.lerp(WHITE, t);
}
const lit = (l) => l && l.visible && l.parent; // 장면에 붙어 켜져 있는 조명만 센다

// 모든 캐릭터 재질이 함께 쓰는 uniform (한 번 바꾸면 모두 바뀐다)
const U = {
  flKeyDir: { value: KEY_DIR.clone() },
  flKey: { value: new THREE.Color(0, 0, 0) },
  flRimDir: { value: RIM_DIR.clone() },
  flRim: { value: new THREE.Color(0, 0, 0) },
  flAmb: { value: new THREE.Color(0, 0, 0) },
  flGlow: { value: new THREE.Color(0, 0, 0) },
};
const DECL = 'uniform vec3 flKeyDir;\nuniform vec3 flKey;\nuniform vec3 flRimDir;\nuniform vec3 flRim;\nuniform vec3 flAmb;\nuniform vec3 flGlow;\n';
// three 의 빛 계산(RE_Direct)을 그대로 불러 방향광 두 개를 더 받는다 → 거칠기·금속성에 맞는 반사광까지 나온다.
//  윤곽 빛은 옷 색을 곱하지 않고 스스로 빛나는 몫(totalEmissiveRadiance)에 더한다: 카메라에 비스듬할수록(1 − N·V)²,
//  테두리광 쪽(뒤 오른쪽 위)을 향할수록 세다 → 카메라를 마주 보는 면과 왼쪽 아래 윤곽은 거의 그대로
const CODE = `
{
  IncidentLight flL;
  flL.visible = true;
  flL.direction = flKeyDir;
  flL.color = flKey;
  RE_Direct( flL, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
  flL.direction = flRimDir;
  flL.color = flRim;
  RE_Direct( flL, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
  #if defined( RE_IndirectDiffuse )
    irradiance += flAmb;
  #endif
  float flF = 1.0 - saturate( dot( geometryNormal, geometryViewDir ) );
  totalEmissiveRadiance += flGlow * ( flF * flF ) * saturate( 0.8 + dot( geometryNormal, flRimDir ) );
}
#include <lights_fragment_end>`;

const patched = new WeakSet(); // 이미 캐릭터 조명을 받게 한 재질 (복제된 재질이 표시를 물려받지 않게 userData 대신)
const env0 = new WeakMap(); // 재질 → 원래 금속 반사 세기
function patch(mat) {
  if (patched.has(mat)) return;
  patched.add(mat);
  if (!(mat.isMeshStandardMaterial || mat.isMeshLambertMaterial || mat.isMeshPhongMaterial)) return;
  const prevCompile = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey();
  mat.onBeforeCompile = function (shader, renderer) {
    prevCompile.call(this, shader, renderer);
    Object.assign(shader.uniforms, U);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + DECL)
      .replace('#include <lights_fragment_end>', CODE);
  };
  mat.customProgramCacheKey = () => 'fighterLight|' + prevKey;
  mat.fog = false; // 캐릭터는 안개에 묻지 않는다 (지금 스테이지들은 안개가 18m 밖에서 시작해 달라지는 것 없음)
  if (mat.envMap) env0.set(mat, mat.envMapIntensity);
  mat.needsUpdate = true;
}

/**
 * @param lights main.js 의 { hemi, sun } (스테이지가 바꾼 뒤의 값을 매 프레임 읽는다)
 * @param stage  스테이지 build 가 돌려준 객체 (fighterLight 가 있으면 색·세기를 물들인다)
 */
export function createFighterLight(lights, stage = {}) {
  const num = (v, d) => (Number.isFinite(v) ? v : d);
  // 스테이지가 준 설정 (배경이 바뀌면 setStage 로 바꿔 끼운다)
  let cfg, cfgKey, cfgRim, rimMul;
  function configure(st) {
    cfg = st?.fighterLight || {};
    cfgKey = cfg.color != null ? hue(new THREE.Color(cfg.color), 0, new THREE.Color()) : null;
    cfgRim = cfg.rimColor != null ? hue(new THREE.Color(cfg.rimColor), 0, new THREE.Color()) : null;
    rimMul = THREE.MathUtils.clamp(num(cfg.rim, 1), RIM_MIN, 3);
  }
  configure(stage);
  const keyHue = new THREE.Color();
  const rimHue = new THREE.Color();
  const _d = new THREE.Vector3();
  const state = {
    enabled: true, // 디버그: false 면 예전과 똑같이 그린다 (tools/browser/stage_light_check.mjs 가 전·후 비교에 쓴다)
    stageLight: 0, // 스테이지 빛이 캐릭터 세로 면에 주는 밝기 어림
    level: THREE.MathUtils.clamp(num(cfg.level, LEVEL), LEVEL_MIN, 1),
    deficit: 0,
    env: 1,
    key: 0,
    rim: 0,
    amb: 0,
    glow: 0,
  };
  /** 스테이지 빛이 캐릭터 세로 면(카메라가 보는 옆·앞·등)에 주는 조도 어림 (선형). 반구광은 하늘·땅 반반,
   *  해는 높이각의 cos 만큼 옆으로 닿고 사방 평균을 내면 1/π */
  function stageLight() {
    const { hemi, sun } = lights;
    let e = 0;
    if (lit(hemi)) e += hemi.intensity * 0.5 * (lum(hemi.color) + lum(hemi.groundColor));
    if (lit(sun)) {
      _d.subVectors(sun.position, sun.target.position).normalize();
      e += (sun.intensity * lum(sun.color) * Math.sqrt(Math.max(0, 1 - _d.y * _d.y))) / Math.PI;
    }
    return num(e, 0);
  }
  function updateUniforms() {
    const e = (state.stageLight = stageLight());
    const deficit = (state.deficit = state.enabled ? Math.max(0, state.level - e) : 0);
    if (cfgKey) keyHue.copy(cfgKey);
    else hue(lights.sun?.color ?? WHITE, 0.5, keyHue);
    if (cfgRim) rimHue.copy(cfgRim);
    else hue(lights.hemi?.color ?? WHITE, 0.5, rimHue);
    state.key = deficit * KEY;
    state.amb = deficit * AMB;
    state.rim = deficit * RIM * rimMul;
    state.glow = deficit * GLOW * rimMul;
    U.flKey.value.copy(keyHue).multiplyScalar(state.key);
    U.flAmb.value.copy(keyHue).multiplyScalar(state.amb);
    U.flRim.value.copy(rimHue).multiplyScalar(state.rim);
    U.flGlow.value.copy(rimHue).multiplyScalar(state.glow);
    const autoEnv = THREE.MathUtils.clamp(e / ENV_REF, ENV_MIN, 1);
    state.env = state.enabled ? THREE.MathUtils.clamp(num(cfg.env, autoEnv), ENV_MIN, 1) : 1;
  }

  // 캐릭터 물체 목록. 매 프레임 나무 전체를 훑지 않고 메시와 그 재질을 기억해 두었다가, 재질이 바뀐 메시만 다시 본다.
  //  물체가 붙거나 떨어지면(상처 자국, 떨어진 투구, 새 판) 그 다음 프레임에 다시 훑는다 (RESCAN 프레임마다 한 번은 그냥 훑는다)
  const watched = new WeakSet(); // childadded·childremoved 를 듣고 있는 노드
  const meshes = [];
  const mats = []; // meshes[i] 에서 마지막으로 본 재질
  let roots0 = [];
  let dirty = true;
  let lastEnv = -1;
  let frames = 0;
  const onTree = () => (dirty = true);
  function rescan(roots) {
    meshes.length = 0;
    mats.length = 0;
    for (const root of roots)
      root.traverse((o) => {
        if (!watched.has(o)) {
          watched.add(o);
          o.addEventListener('childadded', onTree);
          o.addEventListener('childremoved', onTree);
        }
        if (o.isMesh) {
          meshes.push(o);
          mats.push(null);
        }
      });
    roots0 = roots.slice();
    dirty = false;
  }
  function sameRoots(roots) {
    if (roots.length !== roots0.length) return false;
    for (let i = 0; i < roots.length; i++) if (roots[i] !== roots0[i]) return false;
    return true;
  }
  function apply(m) {
    patch(m);
    const e0 = env0.get(m);
    if (e0 != null) m.envMapIntensity = e0 * state.env;
  }
  return Object.assign(state, {
    /** 배경이 바뀌었다: 그 배경의 fighterLight 설정으로 바꿔 끼운다 (세기는 다음 update 에서 새 빛으로 다시 잰다) */
    setStage(st) {
      configure(st);
      state.level = THREE.MathUtils.clamp(num(cfg.level, LEVEL), LEVEL_MIN, 1);
    },
    /** 매 프레임(그리기 직전): 세기를 다시 계산하고, 캐릭터에 새로 붙은 재질(상처 자국 등)도 받게 한다 */
    update(roots) {
      updateUniforms();
      if (dirty || ++frames % RESCAN === 0 || !sameRoots(roots)) rescan(roots);
      const envChanged = state.env !== lastEnv;
      lastEnv = state.env;
      for (let i = 0; i < meshes.length; i++) {
        const m = meshes[i].material;
        if (m === mats[i] && !envChanged) continue;
        mats[i] = m;
        if (Array.isArray(m)) for (const mm of m) apply(mm);
        else if (m) apply(m);
      }
    },
  });
}

// ─────────────────────────────────────────────────────────────
//  권총 겉모습 효과 (외형 PM, 사장님 결정 "총구 섬광·연기 필요"): 쏠 때 총구에 섬광 두 장(별 모양 큰 것 + 뜨거운 심)이
//  두어 프레임 번쩍이고, 회색 연기 점 24개가 총신 방향으로 뿜어져 나가 위로 흩어지며 1초 안에 사라진다.
//   · gun.js 의 GUN_HOOKS.onShot 을 감싼다: 원래 걸린 것(소리)은 그대로 부르고, 없으면 gun.js 의 총소리를 직접 낸다 — 판정·난수 무관.
//   · 총신 방향은 gun.js fire 와 같은 계산(칼 축 +y 를 총 몸체 회전으로). 연기의 퍼짐은 정해진 표(난수 없음).
//   · 스스로 돈다(requestAnimationFrame): main.js 는 installGunFx({ scene, sound }) 한 줄만 부른다. 일시정지 중에는 멈춘다.
//   · 판이 바뀔 때는 clearGunFx() (main.js 가 clearDebris() 를 부르는 자리에 한 줄) — 흔적이 쌓이지 않는다.
//   · 폰에서 가볍게: 효과 두 벌(두 검객이 거의 동시에 쏠 때)만 미리 만들어 돌려쓴다.
//   · v2 (사장님 9/29 "발사 이펙트가 좀 약한 거 같애" → 디렉터 지시): 섬광을 더 크고 밝게 + 총구 앞 짧은 화염(원뿔 두 겹: 보통 섞기 속불 + 더하기 겉불 —
//     눈밭·밝은 낮에도 보이게), 2~3프레임 세게 뒤 빠르게 감쇠. 화약 불티(밝은 주황 점, 중력, 0.35초). 연기 더 많고 짙게. 궤적 줄 더 굵고 또렷하게.
//     발사 순간 짧은 화면 흔들림(main.js kickCamera 를 shake 로 받아 작게: 자기 총 0.45, 상대 총 0.15).
//   · 주변 비춤은 조명 없이 흉내 낸다(디렉터 폰 성능 후속): 총구 둘레 큰 더하기 섞기 빛무리(지름 약 3 m, 0.1초). 점광은 쓰지 않는다 —
//     늘 장면에 두면 꺼져 있어도 빛을 받는 모든 재질이 매 픽셀 빛 하나를 더 계산하고, 쏠 때만 넣었다 빼면 빛 개수가 바뀌어
//     모든 재질의 셰이더가 다시 만들어진다(측정: 프로그램 19 → 33, 성 안뜰).
//   · 첫 발 멈칫 방지: warmGunFx(renderer, camera) 가 효과 재질을 지금 무대의 빛·안개로 미리 컴파일한다(main.js 가 권총이 있는 판을 세울 때 부른다).
//   · 총알 궤적 (사장님 결정 "방식 B"): 총구에서 총알이 닿은 곳까지 옅은 담황색 줄 하나가 0.1초쯤 보였다 사라진다 — 빗나갔는지 한눈에 읽힌다.
//     실제 총알 방향(gun.js 의 퍼짐·AI 보정이 든 것)과 닿은 거리는 무기 PM 이 onShot(f, p, dir, dist) 로 넘긴다.
//     안 넘어오면 총신 방향으로 그리고, 거리는 gun.js 와 같은 광선으로 재고 아니면 GUN.range 다.
//     무기 PM 의 GUN_HOOKS.onImpact(f, point, dir, what) 가 오면(닿았을 때만, onShot 바로 뒤) 그 발의 줄을 실제 방향·닿은 점으로 바로잡는다.
//   · 총구: onShot 의 pos 가 총구다(리볼버는 총신이 주먹 위 8 cm — 칼 축이 아니다). 레이저 시작점도 같은 자리(칼 몸체 (weapon.muzzleX, 손잡이+총신 길이, 0)).
//   · 조준 레이저 (사장님: "아주 미세해야 해 … 희미하게"): 총을 든 검객마다 총구에서 총신 방향으로 처음 닿는 곳까지 아주 옅은 붉은 선과
//     닿은 자리의 작은 점. 매 프레임 gun.js 와 같은 광선으로 잰다(world·combat 필요, 판정과 무관한 읽기뿐). 장전 중에도 같은 밝기 —
//     장전 표시는 하지 않는다(사장님). 겉모습은 여기서만 정한다: gun.js 의 GUN.laser 는 무기 PM 이 끈다 (두 겹으로 그리지 않게).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { GUN, GUN_HOOKS, gunshotSound } from './gun.js';
import { canvasTex } from './stage_kit.js';

const FLASH_T = 0.11; // 초: 섬광·화염이 보이는 시간 — 처음 FLASH_HOLD 는 최대 밝기(2~3프레임), 그 뒤 빠르게 감쇠
const FLASH_HOLD = 0.04; // 초: 최대 밝기 유지
const SPARK_T = 0.35; // 초: 화약 불티
const GLOW_T = 0.1; // 초: 총구 둘레 빛무리 (조명 대신)
const NS = 14; // 불티 점 수
const SMOKE_T = 1.2; // 초: 연기가 사라지기까지
const TRACE_T = 0.16; // 초: 총알 궤적 줄이 사라지기까지 (v2: 0.11 → 0.16, 더 또렷하게)
const NP = 36; // 연기 점 수 (v2: 24 → 36)
const LASER_A = 0.3; // 조준 레이저 선의 불투명도 (사장님 '조준선 지금보다 밝게': 0.13 → 0.3)
const RETICLE_A = 1.0; // 조준쇠(레이저 끝 표식)의 불투명도 — 겨누는 데 쓰는 건 이 표식이라 선보다 훨씬 또렷하게
const RETICLE_DIM_A = 0.45; // 빗나가는 동안·장전 중의 흐린 조준쇠
const RETICLE_SIZE = 0.07; // 조준쇠 크기 — 화면 기준(sizeAttenuation 없음): 멀어도 가까워도 같은 크기 (FPS 조준쇠처럼)

/** 조준쇠: FPS 게임 조준쇠 꼴 — 고리 + 네 눈금(가운데는 비워 겨눈 자리가 가리지 않게) + 가운데 점. 선명한 빨강에 어두운 테두리(밝은 하늘·모래 위에서도 보이게)
 *  (사장님 9/29: "조준점이 잘 안 보이더라. 더 선명한 붉은 색으로. 점 모양이 아니라 fps 게임 느낌의 조준쇠 같은 표식으로") */
function reticleTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    const c = w / 2;
    g.lineCap = 'butt';
    const draw = (color, lw) => {
      g.strokeStyle = g.fillStyle = color;
      g.lineWidth = lw;
      g.beginPath();
      g.arc(c, c, 22, 0, Math.PI * 2);
      g.stroke();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        g.beginPath();
        g.moveTo(c + dx * 8, c + dy * 8);
        g.lineTo(c + dx * 18, c + dy * 18);
        g.stroke();
      }
      g.beginPath();
      g.arc(c, c, lw * 0.75, 0, Math.PI * 2);
      g.fill();
    };
    draw('rgba(0,0,0,0.55)', 6); // 테두리
    draw('rgb(255,20,20)', 3); // 선명한 빨강
  });
}

/** 섬광: 네 갈래 별 + 둥근 심 (가운데 흰빛 → 주황 → 투명) */
function flashTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    const c = w / 2;
    let rg = g.createRadialGradient(c, c, 0, c, c, c);
    rg.addColorStop(0, 'rgba(255,250,225,1)');
    rg.addColorStop(0.18, 'rgba(255,210,120,0.9)');
    rg.addColorStop(0.45, 'rgba(255,140,50,0.35)');
    rg.addColorStop(1, 'rgba(255,90,20,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, w, h);
    // 네 갈래 (가로·세로 길게, 대각선 짧게)
    g.fillStyle = 'rgba(255,235,180,0.85)';
    for (const [len, wd, rot] of [
      [c, 3, 0],
      [c, 3, Math.PI / 2],
      [c * 0.55, 2, Math.PI / 4],
      [c * 0.55, 2, -Math.PI / 4],
    ]) {
      g.save();
      g.translate(c, c);
      g.rotate(rot);
      const lg = g.createLinearGradient(-len, 0, len, 0);
      lg.addColorStop(0, 'rgba(255,235,180,0)');
      lg.addColorStop(0.5, 'rgba(255,245,215,0.95)');
      lg.addColorStop(1, 'rgba(255,235,180,0)');
      g.fillStyle = lg;
      g.fillRect(-len, -wd / 2, len * 2, wd);
      g.restore();
    }
  });
}
/** 화염 원뿔에 입힐 세로 그라데이션: 총구 쪽(밑면)은 진하고 꼭짓점 쪽은 투명 — 딱딱한 삼각형이 아니라 불꽃 혀처럼 보이게 */
function flameTexture() {
  return canvasTex(8, 64, (g, w, h) => {
    const lg = g.createLinearGradient(0, 0, 0, h); // ConeGeometry 의 v: 0 = 꼭짓점, 1 = 밑면
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    lg.addColorStop(0.75, 'rgba(255,255,255,0.9)');
    lg.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = lg;
    g.fillRect(0, 0, w, h);
  });
}
function puffTexture() {
  return canvasTex(32, 32, (g, w, h) => {
    const rg = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    rg.addColorStop(0, 'rgba(255,255,255,0.9)');
    rg.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, w, h);
  });
}

// 연기 점마다 정해진 흩어짐 (난수 없음): [옆 u, 옆 v, 앞 속도 배, 위로]
const SPREAD = Array.from({ length: NP }, (_, i) => {
  const a = i * 2.399963; // 황금각으로 고르게
  const rr = 0.25 + ((i * 7) % NP) / NP;
  return [Math.cos(a) * rr, Math.sin(a) * rr, 0.6 + ((i * 5) % NP) / NP, 0.4 + ((i * 3) % NP) / NP / 2];
});

// 불티마다 정해진 방향·속도 (난수 없음): [옆 u, 옆 v, 앞 속도 m/s]
const SPARKS = Array.from({ length: NS }, (_, i) => {
  const a = i * 2.399963 + 0.7;
  const rr = 0.15 + ((i * 5) % NS) / NS * 0.55;
  return [Math.cos(a) * rr, Math.sin(a) * rr, 4 + ((i * 7) % NS) / NS * 6];
});

const _q = new THREE.Quaternion();
const _d = new THREE.Vector3();
const _Y = new THREE.Vector3(0, 1, 0);
const _u = new THREE.Vector3();
const _v = new THREE.Vector3();

let _clear = null;
let _warm = null;
/** 첫 발 멈칫 방지 (디렉터): 권총이 있는 판을 세울 때 main.js 가 부른다. 효과 재질을 지금 무대의 빛·안개로 미리 컴파일한다 */
export function warmGunFx(renderer, camera) {
  _warm?.(renderer, camera);
}
/** 판이 바뀔 때(main.js 가 clearDebris() 를 부르는 자리) 남은 섬광·연기를 바로 거둔다. 효과는 1.2초 안에 스스로 사라지지만 쌓임 없이 깨끗이 (디렉터 조건) */
export function clearGunFx() {
  _clear?.();
}

/**
 * 권총 효과를 설치한다. scene: 장면, sound: main.js 의 Sound (GUN_HOOKS.onShot 이 비어 있을 때 총소리를 내는 데 쓴다).
 *  world·combat 은 안 넘겨도 된다: 검객의 world(f.world)와 window.game.combat 을 그때그때 읽는다 (main.js 는 combat 을 나중에 만든다).
 *  레이저·궤적 끝을 재는 광선에만 쓴다 (gun.js 와 같은 광선, 판정과 무관한 읽기뿐).
 *  반환 { fire(pos, dir, dist), clear() } — 점검 도구가 직접 터뜨려 볼 때 / 판 바뀜에 치울 때
 */
export function installGunFx({ scene, sound, world = null, combat = null, shake = null }) {
  const flashMat = new THREE.SpriteMaterial({ map: flashTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const puffMap = puffTexture();
  const flameMap = flameTexture();
  const pool = [];
  for (let k = 0; k < 2; k++) {
    const flash = new THREE.Sprite(flashMat.clone());
    const core = new THREE.Sprite(flashMat.clone());
    core.material.color.set(0xfff4d0);
    flash.visible = core.visible = false;
    flash.renderOrder = core.renderOrder = 5;
    const pos = new Float32Array(NP * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const smoke = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.24, map: puffMap, transparent: true, opacity: 0, depthWrite: false, color: 0x6e6a66 })); // 흰 눈밭·밝은 하늘 앞에서도 보이게 조금 짙은 회색
    smoke.frustumCulled = false;
    smoke.visible = false;
    // 화염: 총구 앞 짧은 원뿔 두 겹 — 속불(보통 섞기, 눈밭에서도 보인다) + 겉불(더하기, 밤에 번진다). 원뿔 꼭짓점이 +y 라 총신 방향으로 돌린다
    const coneGeo = new THREE.ConeGeometry(0.045, 1, 10, 1, true);
    const flameIn = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xffd08a, map: flameMap, transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    const flameOut = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xff7a28, map: flameMap, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    flameIn.visible = flameOut.visible = false;
    flameIn.renderOrder = flameOut.renderOrder = 5;
    // 화약 불티: 밝은 주황 점 (보통 섞기라 눈밭에서도 보인다), 중력으로 떨어진다
    const spos = new Float32Array(NS * 3);
    const sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
    const sparks = new THREE.Points(sgeo, new THREE.PointsMaterial({ size: 0.045, map: puffMap, transparent: true, opacity: 0, depthWrite: false, color: 0xffb040 }));
    sparks.frustumCulled = false;
    sparks.visible = false;
    // 궤적: 가는 네모 기둥 (+y 로 1 m, 길이는 scale.y). 보통 섞기·호박색 — 더하기 섞기는 눈밭·밝은 하늘 앞에서 아예 안 보였다
    const trace = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, 1, 0.016).translate(0, 0.5, 0),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false, fog: false }),
    );
    trace.visible = false;
    trace.renderOrder = 4;
    // 빛무리: 총구 둘레 큰 더하기 섞기 원 — 조명 없이 "잠깐 주변이 밝아진" 느낌 (깊이 판정은 켜서 몸·기둥 뒤로는 가려진다)
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffMap, color: 0xffa050, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    glow.visible = false;
    glow.renderOrder = 4;
    scene.add(flash, core, smoke, trace, flameIn, flameOut, sparks, glow);
    pool.push({ flash, core, smoke, trace, flameIn, flameOut, sparks, glow, spos, svel: new Float32Array(NS * 3), pos, vel: new Float32Array(NP * 3), t: -1, o: new THREE.Vector3(), d: new THREE.Vector3(), origin: new THREE.Vector3() });
  }
  let next = 0;
  // 총구 점광 하나 (두 벌이 같이 쓴다 — 마지막 발이 가져간다). 처음부터 장면에 두고 세기만 바꾼다

  const aimTrace = (e, origin, dir, dist) => {
    e.trace.position.copy(origin);
    e.trace.quaternion.setFromUnitVectors(_Y, dir);
    e.trace.scale.set(1, Math.max(0.01, dist), 1);
    e.trace.visible = true;
  };
  const fire = (origin, dir, dist = GUN.range) => {
    const e = pool[next];
    next = (next + 1) % pool.length;
    e.t = 0;
    e.o.copy(origin).addScaledVector(dir, 0.03);
    e.d.copy(dir).normalize();
    // 궤적 줄: 총구에서 닿은 곳까지 (onImpact 가 오면 실제 방향·점으로 바로잡는다)
    e.origin.copy(origin);
    aimTrace(e, origin, e.d, dist);
    // 총신에 수직인 두 축
    _u.set(0, 1, 0);
    if (Math.abs(e.d.y) > 0.9) _u.set(1, 0, 0);
    _u.cross(e.d).normalize();
    _v.crossVectors(e.d, _u);
    for (let i = 0; i < NP; i++) {
      const [su, sv, fw, up] = SPREAD[i];
      e.pos[i * 3] = e.o.x;
      e.pos[i * 3 + 1] = e.o.y;
      e.pos[i * 3 + 2] = e.o.z;
      e.vel[i * 3] = e.d.x * 1.3 * fw + _u.x * su * 0.6 + _v.x * sv * 0.6;
      e.vel[i * 3 + 1] = e.d.y * 1.3 * fw + _u.y * su * 0.6 + _v.y * sv * 0.6 + up * 0.3;
      e.vel[i * 3 + 2] = e.d.z * 1.3 * fw + _u.z * su * 0.6 + _v.z * sv * 0.6;
    }
    e.flash.position.copy(e.o).addScaledVector(e.d, 0.06);
    e.core.position.copy(e.o).addScaledVector(e.d, 0.02);
    // 화염 원뿔: 밑면이 총구, 꼭짓점이 앞
    for (const c of [e.flameIn, e.flameOut]) {
      c.quaternion.setFromUnitVectors(_Y, e.d);
      c.position.copy(e.o);
    }
    // 불티: 총구에서 앞·옆으로 튄다
    for (let i = 0; i < NS; i++) {
      const [su, sv, fw] = SPARKS[i];
      e.spos[i * 3] = e.o.x;
      e.spos[i * 3 + 1] = e.o.y;
      e.spos[i * 3 + 2] = e.o.z;
      e.svel[i * 3] = e.d.x * fw + _u.x * su * fw * 0.5 + _v.x * sv * fw * 0.5;
      e.svel[i * 3 + 1] = e.d.y * fw + _u.y * su * fw * 0.5 + _v.y * sv * fw * 0.5;
      e.svel[i * 3 + 2] = e.d.z * fw + _u.z * su * fw * 0.5 + _v.z * sv * fw * 0.5;
    }
    e.glow.position.copy(e.o).addScaledVector(e.d, 0.1);
    e.glow.visible = true;
    e.flash.visible = e.core.visible = e.smoke.visible = e.flameIn.visible = e.flameOut.visible = e.sparks.visible = true;
    step(e, 0);
    return e;
  };

  const step = (e, dt) => {
    e.t += dt;
    const t = e.t;
    if (t < FLASH_T) {
      const k = t / FLASH_T;
      const a = t < FLASH_HOLD ? 1 : 1 - (t - FLASH_HOLD) / (FLASH_T - FLASH_HOLD); // 2~3프레임 최대, 그 뒤 빠르게 감쇠
      e.flash.scale.setScalar(0.6 + 0.5 * k);
      e.flash.material.opacity = a;
      e.flash.material.rotation = k * 0.8;
      e.core.scale.setScalar(0.22 + 0.1 * k);
      e.core.material.opacity = a;
      // 화염: 길이 0.28 → 0.45 m, 속불은 빨리, 겉불은 조금 늦게 사그라진다
      const len = 0.24 + 0.16 * k;
      e.flameIn.scale.set(1 + 0.6 * k, len, 1 + 0.6 * k);
      e.flameOut.scale.set(1.6 + 1.2 * k, len * 1.25, 1.6 + 1.2 * k);
      e.flameIn.position.copy(e.o).addScaledVector(e.d, len / 2);
      e.flameOut.position.copy(e.o).addScaledVector(e.d, (len * 1.25) / 2);
      e.flameIn.material.opacity = 0.85 * a * a;
      e.flameOut.material.opacity = 0.8 * a;
    } else e.flash.visible = e.core.visible = e.flameIn.visible = e.flameOut.visible = false;
    if (t < GLOW_T) {
      const k = t / GLOW_T;
      e.glow.scale.setScalar(2.4 + 1.2 * k);
      e.glow.material.opacity = 0.42 * (1 - k) * (1 - k);
    } else e.glow.visible = false;
    if (t < SPARK_T) {
      for (let i = 0; i < NS; i++) {
        const j = i * 3;
        e.spos[j] += e.svel[j] * dt;
        e.spos[j + 1] += e.svel[j + 1] * dt;
        e.spos[j + 2] += e.svel[j + 2] * dt;
        e.svel[j + 1] -= 9.8 * dt; // 중력
        const damp = Math.max(0, 1 - dt * 2.5);
        e.svel[j] *= damp;
        e.svel[j + 2] *= damp;
      }
      e.sparks.geometry.attributes.position.needsUpdate = true;
      const k = t / SPARK_T;
      e.sparks.material.opacity = 1 - k * k;
      e.sparks.material.size = 0.045 * (1 - 0.5 * k);
    } else e.sparks.visible = false;
    if (t < TRACE_T) {
      const k = t / TRACE_T;
      e.trace.material.opacity = 0.75 * (1 - k * k); // v2: 더 또렷하게 (0.42 → 0.75)
    } else e.trace.visible = false;
    if (t < SMOKE_T) {
      const damp = Math.max(0, 1 - dt * 3);
      for (let i = 0; i < NP; i++) {
        const j = i * 3;
        e.pos[j] += e.vel[j] * dt;
        e.pos[j + 1] += e.vel[j + 1] * dt;
        e.pos[j + 2] += e.vel[j + 2] * dt;
        e.vel[j] *= damp;
        e.vel[j + 1] = e.vel[j + 1] * damp + 0.25 * dt; // 연기는 느려지며 떠오른다
        e.vel[j + 2] *= damp;
      }
      e.smoke.geometry.attributes.position.needsUpdate = true;
      const k = t / SMOKE_T;
      e.smoke.material.opacity = 0.9 * (1 - k) * (1 - k * 0.6);
      e.smoke.material.size = 0.24 + 0.4 * k; // 퍼지며 커진다 (v2: 조금 더 크게)
    } else {
      e.smoke.visible = false;
      e.t = -1;
    }
  };

  // 궤적 끝 거리 재기 (onShot 이 dist 를 안 넘길 때): gun.js castRay 와 같은 광선 — 쏜 사람 자신의 콜라이더는 건너뛴다
  const getCombat = () => combat ?? globalThis.window?.game?.combat ?? null;
  const measure = (f, o, d) => {
    const w = world ?? f.world;
    if (!w?.castRay) return GUN.range;
    const info = getCombat()?.info;
    const ray = { origin: { x: o.x, y: o.y, z: o.z }, dir: { x: d.x, y: d.y, z: d.z } };
    const hit = w.castRay(ray, GUN.range, true, undefined, undefined, undefined, undefined, (c) => info?.get(c.handle)?.fighter !== f);
    return hit ? (hit.timeOfImpact ?? hit.toi) : GUN.range;
  };

  // 조준 레이저: 총을 든 검객 수만큼 (판마다 검객이 바뀌므로 자리로 돌려쓴다)
  const laserMat = new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: LASER_A, depthWrite: false });
  // 빗나가는 동안의 흐린 선 (사장님 9/29: "레이저 조준선이 상대방 머리 위 하늘로 치솟아 있어" — 몸에 안 걸린 동안 선이 25 m 지평선까지 뻗어
  //  카메라에서는 상대 머리 위로 솟아 보였다. 이제 선은 상대 깊이에서 끊고, 조준쇠는 거기에 흐리게 남겨 흔들리는 겨눔이 몸 둘레 어디를 지나는지 보인다)
  const laserDimMat = laserMat.clone();
  laserDimMat.opacity = LASER_A * 0.5;
  // 레이저 끝 조준쇠: 스프라이트(늘 카메라를 본다) · 화면 기준 크기 · 깊이 검사 없음(상대 몸 표면에 닿은 자리라 몸에 반쯤 묻히지 않게 늘 위에 그린다)
  const reticleMap = reticleTexture();
  const reticleMat = new THREE.SpriteMaterial({ map: reticleMap, transparent: true, opacity: RETICLE_A, depthTest: false, depthWrite: false, sizeAttenuation: false, fog: false });
  const reticleDimMat = reticleMat.clone();
  reticleDimMat.opacity = RETICLE_DIM_A;
  const beamGeo = new THREE.BoxGeometry(0.005, 1, 0.005).translate(0, 0.5, 0);
  const lasers = [];
  const laserSlot = (i) => {
    while (lasers.length <= i) {
      const beam = new THREE.Mesh(beamGeo, laserMat);
      const dot = new THREE.Sprite(reticleMat);
      dot.scale.set(RETICLE_SIZE, RETICLE_SIZE, 1);
      beam.renderOrder = 2;
      dot.renderOrder = 3;
      beam.visible = dot.visible = false;
      scene.add(beam, dot);
      lasers.push({ beam, dot });
    }
    return lasers[i];
  };
  const updateLasers = () => {
    let n = 0;
    for (const f of getCombat()?.fighters ?? []) {
      if (!f.weapon?.gun || !f.alive || !f.armed) continue;
      const r = f.sword?.rotation?.();
      if (!r) continue;
      const L = laserSlot(n++);
      _q.set(r.x, r.y, r.z, r.w);
      _d.set(0, 1, 0).applyQuaternion(_q); // 총신 방향 (gun.js 와 같다)
      f.bladePoint(1, _u); // 칼 축 끝
      const mx = f.weapon.muzzleX ?? 0; // 총신이 칼 축에서 비켜 있으면(리볼버, 주먹 위) 그만큼 옮긴다 — gun.js muzzle() 과 같다
      if (mx) _u.add(_v.set(mx, 0, 0).applyQuaternion(_q));
      const dist = measure(f, _u, _d);
      // 선의 끝: 무엇에 닿으면 거기, 빗나가면 상대 가슴 깊이 + 0.4 m 에서 끊는다 (지평선까지 늘이지 않는다)
      let end = dist;
      let onTarget = dist < GUN.range;
      const fc = f.foe?.bodies?.chest?.translation?.();
      if (fc) {
        const along = (fc.x - _u.x) * _d.x + (fc.y - _u.y) * _d.y + (fc.z - _u.z) * _d.z; // 총신을 따라 잰 상대 가슴까지의 거리
        const stop = Math.max(0.3, along + 0.4);
        if (dist > stop) { end = stop; onTarget = false; } // 상대 깊이를 지나서야 닿거나 아예 안 닿음 = 빗나감
      }
      const reloading = (f.gun?.cool ?? 0) > 0; // 쏜 직후·장전 중(총구가 위로 선다)에는 흐리게
      L.beam.material = reloading ? laserDimMat : laserMat;
      L.dot.material = onTarget && !reloading ? reticleMat : reticleDimMat;
      L.beam.position.copy(_u);
      L.beam.quaternion.setFromUnitVectors(_Y, _d);
      L.beam.scale.set(1, Math.max(0.01, end), 1);
      L.dot.position.copy(_u).addScaledVector(_d, end);
      L.beam.visible = true;
      L.dot.visible = true; // 빗나가도 상대 깊이에 흐린 조준쇠 — 겨눔이 몸 둘레 어디를 지나는지 보인다
    }
    for (let i = n; i < lasers.length; i++) lasers[i].beam.visible = lasers[i].dot.visible = false;
  };

  const lastFire = new WeakMap(); // 검객 → 방금 쏜 효과 (onImpact 가 줄을 바로잡을 때)
  // gun.js 의 onShot 을 감싼다 (소리는 그대로). dir·dist 는 무기 PM 이 넘기는 실제 총알 방향·닿은 거리 (없으면 총신 방향으로 잰다)
  const prev = GUN_HOOKS.onShot;
  GUN_HOOKS.onShot = (f, p, dir, dist) => {
    if (prev) prev(f, p, dir, dist);
    else if (sound?.ctx && sound._on) gunshotSound(sound, p);
    if (dir) _d.set(dir.x, dir.y, dir.z).normalize();
    else {
      const r = f.sword?.rotation?.();
      if (!r) return;
      _q.set(r.x, r.y, r.z, r.w);
      _d.set(0, 1, 0).applyQuaternion(_q); // 총신 방향 (gun.js fire 와 같다)
    }
    lastFire.set(f, fire(p, _d, typeof dist === 'number' && dist > 0 ? dist : measure(f, p, _d)));
    // 발사 순간 짧은 화면 흔들림 (main.js kickCamera 체계, 작게): 자기 총은 반동 방향(총신 반대)으로, 상대 총은 아주 조금
    if (shake) {
      const mine = f === globalThis.window?.game?.player || f.index === 0;
      _v.copy(_d).multiplyScalar(-1);
      _v.y += 0.35;
      _v.normalize();
      shake(_v, mine ? 0.45 : 0.15);
    }
  };
  // 무기 PM 의 onImpact (닿았을 때만, 같은 fire() 안에서 onShot 바로 뒤): 방금 쏜 줄을 실제 총알 방향·닿은 점으로 바로잡는다
  const prevImpact = GUN_HOOKS.onImpact;
  GUN_HOOKS.onImpact = (f, point, dir, what) => {
    if (prevImpact) prevImpact(f, point, dir, what);
    const e = lastFire.get(f);
    if (!e || e.t < 0 || e.t > 0.05 || !point) return;
    _d.set(point.x, point.y, point.z).sub(e.origin);
    const dist = _d.length();
    if (dist < 0.01) return;
    aimTrace(e, e.origin, _d.divideScalar(dist), dist);
  };

  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (warmFrames > 0 && --warmFrames === 0) {
      for (const e of pool) if (e.t < 0) for (const o of [e.flash, e.core, e.smoke, e.trace, e.flameIn, e.flameOut, e.sparks, e.glow]) o.visible = false;
    }
    if (globalThis.window?.game?.state !== 'paused') {
      for (const e of pool) if (e.t >= 0) step(e, dt);
      updateLasers();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  // 첫 발 멈칫 방지: 효과 물체를 잠깐 임시 장면으로 옮겨(보이게) 지금 무대의 빛·안개로 컴파일하고 되돌린다 — 본 장면 전체를 다시 훑지 않는다
  let warmFrames = 0;
  _warm = (renderer, camera) => {
    const tmp = new THREE.Scene();
    const objs = [];
    for (const e of pool) for (const o of [e.flash, e.core, e.smoke, e.trace, e.flameIn, e.flameOut, e.sparks, e.glow]) objs.push([o, o.visible]);
    for (const [o] of objs) {
      tmp.add(o); // add 는 원래 부모(scene)에서 떼어 온다
      o.visible = true;
    }
    renderer.compile(tmp, camera, scene);
    for (const [o] of objs) scene.add(o);
    for (const m of [flashMat.map, puffMap, flameMap]) if (m) renderer.initTexture(m);
    // 모양(꼭짓점 버퍼)도 올려 둔다: 다음 두 프레임 동안 투명(불투명도 0)으로 그리고 숨긴다 — 쏘는 중인 효과는 건드리지 않는다
    if (pool.every((e) => e.t < 0)) {
      for (const [o] of objs) {
        o.visible = true;
        o.material.opacity = 0;
      }
      warmFrames = 2;
    } else for (const [o, v] of objs) o.visible = v;
  };
  _clear = () => {
    for (const e of pool) {
      e.t = -1;
      e.flash.visible = e.core.visible = e.smoke.visible = e.trace.visible = e.flameIn.visible = e.flameOut.visible = e.sparks.visible = e.glow.visible = false;
    }
    for (const L of lasers) L.beam.visible = L.dot.visible = false;
  };
  return { fire, clear: _clear };
}

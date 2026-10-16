// ─────────────────────────────────────────────────────────────
//  광기의 붉은 안광 (외형 PM, 사장님: "밤의 포세이돈 신전에 등장하는 하인리히 앞에 '광기의'를 붙여 다른 캐릭터로 —
//  모델링은 그대로 쓰되 광기를 표현. 눈을 붉게, 안광이 아우라처럼 흔들리게"). 디렉터 나눔: 캐릭터 항목의 eyes: 'madGlow' 가 표식.
//   · 두 눈 자리(dressPart 의 검은 눈 상자 바로 앞)에 눈보다 조금 큰 붉은 빛무리를 머리 그룹에 붙인다 — 머리와 같이 움직인다.
//     빛무리는 두 겹: 보통 섞기의 심(낮 무대·픽셀 모드에서도 붉은 점으로 읽힌다) + 더하기 섞기의 무리(밤에 번진다).
//   · 흔들림: 규칙적 깜빡임이 아니라 촛불처럼 — 서로 안 맞는 진동 둘과 해시 잡음을 섞어 밝기·크기가 함께 조금씩 일렁인다. 난수 없음(시간 함수).
//   · 빛꼬리: 머리가 빠르게 움직이면(고개 돌림·휘두름) 눈이 지나온 자리에 짧은 붉은 잔상이 0.20초 남는다 —
//     장면에 둔 작은 스프라이트 여섯 장을 눈의 속도 벡터를 따라 뒤로(0.20초 전까지) 늘어놓고 뒤로 갈수록 옅고 작게.
//     프레임 속도와 무관하게 같은 길이가 나온다(지난 위치 기록이 아니라 속도로 늘어놓는다). 느리게 움직일 때는 안 보인다.
//   · 얼굴 둘레의 옅은 붉은 빛 한 장(선택 사항, 몸 전체 오라는 없음 — "적막하고 고독한 대결").
//   · 쓰러져 죽으면(state 'dead') 2.5초에 걸쳐 서서히 꺼진다. 판이 바뀌면 main.js 가 dispose() 로 치운다(auras 목록과 같이).
//   · 판정·물리·시뮬 무관(보여 주기만). 폰에서 가볍게: 스프라이트 2×(2+6)+1 = 17장, 조명 없음.
//  main.js: attachMadEyes(enemy, currentFoe?.eyes === 'madGlow' || params.has('madEyes')) → auras 에 넣어 update(t)/dispose() 를 같이 부른다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { canvasTex } from './stage_kit.js';

const EYE_X = 0.113; // 머리 기준: 눈 상자(x 0.093)보다 조금 앞
const EYE_Y = 0.016;
const EYE_Z = 0.035;
const CORE_S = 0.044; // smaller, softer center: avoid the round lamp appearance
const HALO_S = 0.135; // 무리 크기 (사장님 '전구 같다 · 밝기 조금 줄이자': 0.16 → 0.135)
const TRAIL_N = 6; // 눈 하나의 잔상 스프라이트 수
const TRAIL_T = 0.20; // slightly longer but dimmer trace
const TRAIL_V0 = 0.55; // m/s: subtle traces appear with smaller head movements
const TRAIL_V1 = 2.4; // m/s: 이 속도면 잔상이 가장 진하다 (휘두를 때 머리는 1.5~3 m/s)
export const MAD_EYE_INTENSITY = 0.9; // Initial shared -10% multiplier; later softening is also applied below.
const DIE_T = 2.5; // 초: 죽은 뒤 꺼지는 시간

/** 심: 작은 밝은 점 → 진홍 → 검붉은 가장자리 (보통 섞기라 살색 위에서도 붉은 점으로 보인다). 사장님: "더 진한 핏빛으로" — 흰빛·노랑을 뺐다 */
function coreTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    const c = w / 2;
    const rg = g.createRadialGradient(c, c, 0, c, c, c);
    rg.addColorStop(0, 'rgba(180,20,32,0.65)');
    rg.addColorStop(0.22, 'rgba(176,12,24,0.60)');
    rg.addColorStop(0.5, 'rgba(160,0,20,0.92)');
    rg.addColorStop(1, 'rgba(100,0,12,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, w, h);
  });
}
/** 무리·잔상: 부드러운 붉은 원 (더하기 섞기) */
function haloTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    const c = w / 2;
    const rg = g.createRadialGradient(c, c, 0, c, c, c);
    rg.addColorStop(0, 'rgba(235,15,30,0.9)');
    rg.addColorStop(0.35, 'rgba(210,0,25,0.4)');
    rg.addColorStop(1, 'rgba(180,0,20,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, w, h);
  });
}

let _core = null;
let _halo = null;

/** 해시 잡음(0~1): 정수 t 마다 다른 값, 사이는 부드럽게 — 난수 없이 촛불의 불규칙함을 낸다 */
function noise(t) {
  const i = Math.floor(t);
  const f = t - i;
  const h = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const s = f * f * (3 - 2 * f);
  return h(i) * (1 - s) + h(i + 1) * s;
}
/** 촛불 같은 일렁임 (0.48~0.96): 서로 안 맞는 진동 둘 + 잡음 */
function flicker(t, ph) {
  return 0.72 + 0.13 * Math.sin(t * 3.7 + ph) + 0.06 * Math.sin(t * 7.1 + ph * 2.1) + 0.10 * (noise(t * 3.3 + ph) - 0.5);
}

const _p = new THREE.Vector3();
const _v = new THREE.Vector3();

/**
 * 검객의 두 눈에 붉은 안광을 붙인다. on 이 아니면 null (main.js 가 auras 처럼 update(t)/dispose() 를 부른다).
 */
export function attachMadEyes(fighter, on, { veiled = false, sheltered = false } = {}) {
  if (!on) return null;
  const head = fighter.groups?.head;
  const scene = fighter.scene;
  if (!head || !scene) return null;
  const intensity=MAD_EYE_INTENSITY*(head.userData.spectralHumanFace ? .35 : 1);
  _core ??= coreTexture();
  _halo ??= haloTexture();

  if (veiled) {
    // Soft transmitted color sits on the cloth plane, so its folds remain visible.
    // No clear pupils, billboard halo or trails shining through the back of the head.
    const patches=[];
    for(const z of [-EYE_Z,EYE_Z]){
      const m=new THREE.Mesh(new THREE.PlaneGeometry(.052,.031),new THREE.MeshBasicMaterial({map:_halo,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
      m.name='veiled-eye-glow';m.position.set(.124,.016,z);m.rotation.y=Math.PI/2;m.renderOrder=3;head.add(m);patches.push(m);
    }
    let died=-1;
    return {update(t){if(fighter.state==='dead'&&died<0)died=t;const life=died<0?1:Math.max(0,1-(t-died)/DIE_T);patches.forEach((m,i)=>{m.material.opacity=.44*flicker(t,i*1.7)*life})},
      dispose(){for(const m of patches){head.remove(m);m.geometry.dispose();m.material.dispose()}}};
  }

  const eyes = [];
  for (const z of [-EYE_Z, EYE_Z]) {
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: _core, transparent: true, depthWrite: false, fog: false }));
    core.position.set(EYE_X, EYE_Y, z);
    core.renderOrder = 3;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: _halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    // A low kettle brim hides the eye itself. A narrow, dim spill sits below
    // its lip; normal depth testing keeps the solid helmet opaque.
    halo.position.set(sheltered ? .147 : EYE_X + 0.004, sheltered ? -.029 : EYE_Y, z);
    halo.renderOrder = 3;
    head.add(core, halo);
    const trail = [];
    for (let i = 0; i < TRAIL_N; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: _halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
      s.visible = false;
      s.renderOrder = 3;
      scene.add(s);
      trail.push(s);
    }
    eyes.push({ core, halo, trail, prev: null, vel: new THREE.Vector3(), ph: z > 0 ? 0 : 1.7 });
  }
  // 얼굴 둘레의 옅은 붉은 빛 (더하기 섞기라 밤에만 은근히 번진다)
  const face = new THREE.Sprite(new THREE.SpriteMaterial({ map: _halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  face.position.set(0.09, 0.0, 0);
  face.scale.setScalar(0.3);
  face.renderOrder = 2;
  head.add(face);

  let last = -1;
  let dieT = -1;
  let life = 1;

  return {
    update(t) {
      const rdt = last < 0 ? 0 : Math.min(0.25, Math.max(1e-3, t - last)); // 실제 프레임 시간 (속도 재기용) — last 를 갱신하기 전에 잰다
      last = t;
      // 죽으면 서서히 꺼진다
      if (fighter.state === 'dead') {
        if (dieT < 0) dieT = t;
        life = Math.max(0, 1 - (t - dieT) / DIE_T);
      }
      for (const e of eyes) {
        const fl = flicker(t, e.ph);
        const k = fl * life;
        e.core.material.opacity = (0.28 + 0.44 * fl) * life * intensity * (sheltered ? .12 : 1);
        e.core.scale.setScalar(CORE_S * (0.85 + 0.3 * k));
        e.halo.material.opacity = 0.30 * k * intensity * (sheltered ? .65 : 1);
        e.halo.scale.setScalar(HALO_S * (0.8 + 0.4 * k));
        if(sheltered)e.halo.scale.y *= .40;
        // 잔상: 눈 자리의 속도(세계 좌표 변화 — 고개 돌림도 잡힌다, 물리 상태는 읽지 않는다)를 따라 뒤로 늘어놓고, 빠를 때만 보여 준다
        (sheltered ? e.halo : e.core).getWorldPosition(_p);
        if (e.prev && rdt > 0) e.vel.copy(_p).sub(e.prev).divideScalar(rdt);
        else e.vel.set(0, 0, 0);
        (e.prev ??= new THREE.Vector3()).copy(_p);
        const v = e.vel.length();
        const threshold = sheltered ? .32 : TRAIL_V0;
        const trailK = Math.min(1, Math.max(0, (v - threshold) / (TRAIL_V1 - threshold))) * life;
        for (let i = 0; i < TRAIL_N; i++) {
          const s = e.trail[i];
          if (trailK <= 0.01) {
            s.visible = false;
            continue;
          }
          const age = ((i + 1) / TRAIL_N) * TRAIL_T;
          const fade = 1 - age / TRAIL_T + 0.1;
          s.visible = true;
          s.position.copy(_p).addScaledVector(e.vel, -age * Math.min(1, 1.1 / Math.max(v, 1e-3)));
          s.material.opacity = 0.55 * trailK * fade * k * intensity * (sheltered ? .65 : 1);
          s.scale.setScalar(HALO_S * (0.6 + 0.6 * fade));
          if(sheltered)s.scale.y *= .48;
        }
      }
      face.material.opacity = 0.035 * flicker(t * 0.6, 3.1) * life * intensity * (sheltered ? .5 : 1);
    },
    dispose() {
      for (const e of eyes) {
        head.remove(e.core, e.halo);
        e.core.material.dispose();
        e.halo.material.dispose();
        for (const s of e.trail) {
          scene.remove(s);
          s.material.dispose();
        }
      }
      head.remove(face);
      face.material.dispose();
    },
  };
}

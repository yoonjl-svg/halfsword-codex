import { buildFrozenBayNight, buildTempleNight } from './stage_night_variants.js';
// ─────────────────────────────────────────────────────────────
//  스테이지(배경) 관리: 다섯 배경 중 하나를 짓고, 바꿀 때는 먼저 지은 배경을 깨끗이 치운다
//   오너 결정: 스테이지는 고르는 화면 없이 판마다 늘 같은 순서 — 포세이돈 신전 → 화전 터 → 산사 → 성 안뜰 → 대성당 (STAGE_ORDER).
//   무대마다 그곳이 고향인 검객이 상대로 나온다 (STAGE_FOE, 오너 결정).
//   어두운 홀은 쓰지 않는다(오너 결정, 순서에서 뺐다. ?stage=darkhall 로만 볼 수 있다). 언제 바꿀지·고정은 main.js
//   배경을 짓는 함수(arena.js · stage_*.js)는 scene 에 메쉬·입자를 더하고, 같이 쓰는 빛(hemi·sun)의 색·세기·자리와
//   scene.fog·background 를 바꾼다. 그래서 바꿀 때는
//    ① 먼저 지은 배경이 더한 것을 떼어 내고 GPU 자원(모양·재질·질감)을 풀고
//    ② 빛·안개·하늘색을 처음 값(main.js 가 만든 포세이돈 값)으로 되돌린 뒤
//    ③ 새로 짓는다.
//   물리와는 상관없다 (바닥·경계 벽은 main.js 가 판마다 따로 만든다. 시뮬은 이 파일을 읽지 않는다)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { buildArena } from './arena.js';
import { buildTemple } from './stage_temple.js';
import { buildCastle } from './stage_castle.js';
import { buildCathedral } from './stage_cathedral.js';
import { buildDarkHall } from './stage_darkhall.js';
import { buildClearing } from './stage_clearing.js';
import { buildClearingB } from './stage_clearing_b.js';
import { buildPoseidonNight } from './stage_poseidon_night.js';
import { weaponEnv } from './weapon_looks.js';
import { buildLoggia } from './stage_loggia.js';
import { buildCorsair } from './stage_corsair.js';
import { buildSacredGrove } from './stage_sacred_grove.js';
import { buildFrozenBay } from './stage_frozen_bay.js';
import { buildQinglan } from './stage_qinglan.js';
import { buildSluice } from './stage_sluice.js';
import { buildDayr } from './stage_dayr.js';
import { buildDunhuang } from './stage_dunhuang.js';
import { buildEtna } from './stage_etna.js';

// 배경 id → 짓는 함수. 짓는 함수는 { update(dt), excite(amount), sunOffset? } 를 돌려준다
const BUILDERS = {
  frozen_bay_night: buildFrozenBayNight,
  temple_night: buildTempleNight,
  poseidon:(scene) => buildArena(scene), // 바닷가 절벽 위 무너진 포세이돈 신전 (arena.js). 빛·안개는 main.js 처음 값을 그대로 쓴다
  temple: buildTemple, // 한국의 산 속 절 (stage_temple.js)
  castle: buildCastle, // 눈 내리는 중세 성의 안뜰, 해 질 녘 (stage_castle.js)
  cathedral: buildCathedral, // 무너진 고딕 대성당의 안 (stage_cathedral.js)
  clearing: buildClearingB, // 검은숲 변두리의 화전 터, 봄비 내리는 새벽 (stage_clearing_b.js, 오너가 고른 2안) — 브란의 고향
  clearing_a: buildClearing, // 1안 (stage_clearing.js: 오두막·염소·숯가마·밭돌 결투 자리). 보관용, ?stage=clearing_a 로만 본다
  clearing_a_dry: (scene, lights) => buildClearing(scene, lights, { rain: false }), // 1안의 비 없는 처음 모습 (보관용: ?stage=clearing_a_dry)
  poseidon_night: buildPoseidonNight, // 밤의 포세이돈 신전 — 하인리히 재등장·흑화 (stage_poseidon_night.js). 오너 결정으로 성 안뜰 뒤, 대성당 앞
  darkhall: buildDarkHall, // 어두운 성의 큰 홀, 밤 (stage_darkhall.js) — 쓰지 않는다(오너 결정): 순서에 없고 ?stage=darkhall 로만 본다
  // 샛별 저장소에서 가져온 세 무대 (사장님 지시 10/10 — 지오메트리·재질·조명·소리 그대로, docs/characters/import_saetbyeol_2026-10-09.md)
  loggia: buildLoggia, // 붉은 회랑: 쌍기둥 아치·붉은 천·사이프러스·석재 상감 바닥 (stage_loggia.js) — 토메 비달의 무대
  corsair: buildCorsair, // 산호 항구: 산호석 성문·삼각 돛배·푸른 바다 (stage_corsair.js) — 오마리의 무대
  sacred_grove: buildSacredGrove, // 신목의 숲: 거대한 신목·금줄과 흰 종이·이끼 (stage_sacred_grove.js) — 미나미의 무대
  // 샛별 저장소에서 가져온 두 무대 더 (사장님 10/10 20:4x '얼어붙은 만이 린드, 청람잔도가 김씨 전용 스테이지' — 지오메트리·재질·조명·소리 그대로, docs/stages.md)
  frozen_bay: buildFrozenBay, // 얼어붙은 만: 동시베리아 내륙 호수의 겨울 새벽, 먹청색 얼음·눈 덮인 물가·낙엽송·선착장 (stage_frozen_bay.js) — 투야나 니콜라예바(id eira, 전 이름 에이라 린드)의 무대
  qinglan: buildQinglan, // 청람잔도: 화강암 쉼터·강 협곡·돌계단·정자·샘과 뒤 바위 면의 옛 판자 잔도 (우화 c46f6fb7 이식, 포크 전투 면적 2배) — 김씨의 무대
  // 샛별 저장소에서 가져온 무대 (사장님 10/14 02:3x — 진흙 감속 켬 · 가운데 말레이곰 석상 충돌, docs/import/sluice_port_2026-10-14.md). 10/14 19:4x 여정 정식 경로로
  sluice: buildSluice, // 잠든 습지: 비 그친 한낮의 열대 담수 침수림, 진흙 섬·얕은 물·옛 돌 수문, 가운데 말레이곰 석상 (stage_sluice.js) — 라트나의 무대
  // 샛별 저장소에서 가져온 무대 (사장님 10/14 08:1x — 화면 이름 '소금 사막' · 해는 그림자가 나오는 가장 낮은 각, docs/import/salt_desert_port_2026-10-14.md). 10/14 19:4x 여정 정식 경로로
  dayr: buildDayr, // 소금 사막: 소금 벌판 가 벽돌 역참 안뜰의 해 질 녘, 문루 안의 낮은 해와 긴 그림자 (stage_dayr.js) — 다라이시의 무대. 코드 id 는 샛별 쪽 그대로
  // 샛별 저장소에서 가져온 무대 (사장님 10/14 19:4x — 화면 이름 '철불 절벽' · 벽화 그대로 · 결투장 띠 · 여정 정식 경로, docs/import/ironcliff_port_2026-10-14.md)
  dunhuang: buildDunhuang, // 철불 절벽: 침식된 절벽 앞 석굴 앞뜰의 초가을 아침, 6 층 누각과 창작 벽화 (stage_dunhuang.js). 코드 id 는 샛별 쪽 그대로 — 화면 이름에 '둔황'은 넣지 않는다
  // 샛별 저장소에서 가져온 무대 (사장님 10/14 19:4x — 화면 이름 '화산섬' · 결투장 전체 비탈 · 용암 규칙 약하게 · 결투장 띠 없음 · 여정 정식 경로, docs/import/volcano_port_2026-10-14.md)
  etna: buildEtna, // 화산섬: 해 뜨기 전 화산 능선, 결투장 전체가 불규칙 산비탈(평균 약 10°) · 낮은 쪽 용암(화상 — 다리·팔 기능 감소, 사망 없음) (stage_etna.js · 땅 etna_ground.js). 코드 id 는 샛별 쪽 그대로
};
export const STAGE_IDS = Object.keys(BUILDERS);
const DEFAULT_SUN_OFFSET = { x: 4, y: 9, z: 3 }; // sunOffset 을 안 주는 배경(포세이돈)의 해 방향

// 판마다 나오는 순서 (오너 결정: 하인리히 → 브란 → 랴오 → 이졸데 → 밤의 포세이돈(하인리히 재등장·흑화) → 마르그레테 의 고향 순).
//  이졸데는 한 번 쓰러져도 젊은 수련생의 투지로 다시 일어선다(오너 결정: 약한 게 아니다). 대성당 다음 판은 다시 포세이돈부터
//  10/10 사장님 지시로 샛별 저장소의 세 무대를 대성당 뒤에 이었다(기존 여섯 순서는 그대로): 붉은 회랑(토메 비달) → 산호 항구(오마리) → 신목의 숲(미나미)
//  10/10 20:4x 두 무대를 그 뒤에 더 이었다(앞 아홉 순서·자리는 그대로): 얼어붙은 만(투야나) → 청람잔도(김씨). 까닭: 이미 있는 판 순서를 하나도 안 밀고,
//   눈 내리는 성 안뜰(4번째)과 겨울 얼음만이 붙지 않게 멀리 두고, 숲(신목) → 겨울 새벽(얼음만) → 여름 한낮(잔도) → 다시 바닷가(포세이돈)로 계절·빛이 번갈아 바뀐다
//  10/14 19:4x 사장님 '습지, 소금 사막과 함께 정식 경로 포함' — 청람잔도 뒤에 잠든 습지 → 철불 절벽 → 화산섬 → 소금 사막 (감독 안,
//   확인표 1119 · 1214 · 1386 · 1463). 앞 열한 판의 순서·자리는 그대로이고, 끝은 숙련도 4 다라이시(소금 사막). 소금 사막 다음 판은 다시 포세이돈부터.
//   화산섬(etna, docs/import/volcano_port_2026-10-14.md)은 철불 절벽과 소금 사막 사이 — 소금 사막은 열다섯째로 밀렸다
// 10/14 23:0x 사장님 "스테이지 순서를 '밤의 포세이돈'을 맨 마지막으로 둬" → 밤의 포세이돈(광기의 하인리히)이 여정의 끝
export const STAGE_ORDER = ['poseidon', 'clearing', 'temple', 'castle', 'cathedral', 'loggia', 'corsair', 'sacred_grove', 'frozen_bay', 'qinglan', 'sluice', 'dunhuang', 'etna', 'dayr', 'poseidon_night'];
// 무대 → 그 무대에서 나오는 상대 (캐릭터 id). 여기 없는 무대(어두운 홀)는 무작위 상대
//  10/14 19:4x: 잠든 습지 = 라트나 · 소금 사막 = 다라이시 (손님 인물 CHARACTER_GUESTS — CHARACTERS_BY_ID 로 풀린다, 무작위 회전에는 그대로 없음).
//   철불 절벽(dunhuang) = 병마용(terracotta, 손님 인물 — 10/14 감독 짝, 사장님 19:4x 정식 경로 결정에 따름)
//   화산섬(etna) = 찬다(사장님 10/14 19:4x '찬다는 화산섬이 전용 스테이지' — 10/14 감독이 병합 때 짝 지음)
export const STAGE_FOE = { frozen_bay_night: 'eira_mad', temple_night: 'liao_mad', poseidon: 'heinrich', clearing: 'bran', clearing_a: 'bran', clearing_a_dry: 'bran', temple: 'liao', castle: 'isolde', poseidon_night: 'heinrich_mad', cathedral: 'margarethe', loggia: 'tome', corsair: 'omari', sacred_grove: 'minami', frozen_bay: 'eira', qinglan: 'renji', sluice: 'ratna', dayr: 'silver_wanderer', dunhuang: 'terracotta', etna: 'chanda' };
// 그 무대 검객 후보 (사장님 10/10 20:0x — 샛별 저장소에서 가져온 넷의 무대 짝. 무대마다 한 명뿐인 STAGE_FOE 짝을 밀어내지 않고 후보로 더한다, 확인표 752).
//  여정(foe=stage)에서 그 무대를 열 때 [본디 짝, ...후보] 가운데 하나를 고르게 고른다 → 본디 짝은 그 무대에서 절반만 나온다.
//  졌을 때 같은 무대를 다시 열면 같은 상대(아래 stageFoeId 의 prevId). STAGE_FOE 자체는 그대로다
//  10/10 20:4x: 김씨·투야나(eira)는 전용 무대(청람잔도·얼어붙은 만, 위 STAGE_FOE 정식 짝)가 생겨 산사·성 안뜰 후보에서 뺐다 → 랴오·이졸데는 다시 늘 나온다.
//   아르토리아·사미라는 후보 — 본디 짝과 반반(사장님 '무대 후보 비율은 반반')
//  10/10 23:3x 사장님 '아르토리아는 대성당으로 반반, 사미라는 볼로냐 도서관으로 반반' → 짝을 바꿨다(대성당 = 마르그레테·아르토리아, 붉은 회랑 = 토메·사미라)
export const STAGE_FOE_EXTRA = { cathedral: ['artoria'], loggia: ['samira'] };
/** 이번 판 무대의 검객 id: 후보가 없으면 STAGE_FOE 그대로(난수 안 씀). 지난 상대(prevId)가 이 무대 후보면 그 사람 그대로(진 뒤 다시 싸우기) */
export function stageFoeId(stageId, prevId = null, rnd = Math.random) {
  const base = STAGE_FOE[stageId];
  const extra = STAGE_FOE_EXTRA[stageId];
  if (!extra?.length) return base;
  const pool = base ? [base, ...extra] : [...extra];
  if (prevId && pool.includes(prevId)) return prevId;
  return pool[Math.floor(rnd() * pool.length)];
}

// 무대의 화면 이름 (10/14 왼쪽 위 '스테이지 3 · 산사' — docs/ui/hud_intro_2026-10-14.md). 이름은 docs/stages.md 의 무대 이름 그대로
//  (보관용 1안 두 무대는 같은 화전 터). 번호는 STAGE_ORDER 의 자리 + 1, 순서표에 없는 무대(어두운 홀 등)는 이름만 (stageLabel)
export const STAGE_NAME_KO = {
  frozen_bay_night: '밤의 얼어붙은 만', temple_night: '밤의 산사',
  poseidon: '포세이돈 신전', clearing: '화전 터', clearing_a: '화전 터', clearing_a_dry: '화전 터', temple: '산사', castle: '성 안뜰',
  poseidon_night: '밤의 포세이돈 신전', cathedral: '대성당', darkhall: '어두운 홀', loggia: '붉은 회랑', corsair: '산호 항구',
  sacred_grove: '신목의 숲', frozen_bay: '얼어붙은 만', qinglan: '청람잔도', sluice: '잠든 습지',
  dayr: '소금 사막', // 사장님 10/14 08:1x (샛별 쪽 '소금길의 (마지막) 역참') — 코드 id 는 그대로
  dunhuang: '철불 절벽', // 사장님 10/14 19:4x (샛별 쪽 '천불의 절벽') — '둔황'은 화면 이름에 넣지 않는다. 코드 id 는 그대로
  etna: '화산섬', // 사장님 10/14 19:4x — 실제 지명은 화면에 쓰지 않는다 (코드 id 는 샛별 쪽 그대로)
};
/** 왼쪽 위 첫 줄: '스테이지 N · 이름' (순서표 밖이면 이름만) */
export function stageLabel(id) {
  const name = STAGE_NAME_KO[id] ?? id ?? '';
  const i = STAGE_ORDER.indexOf(id);
  return i >= 0 ? `스테이지 ${i + 1} · ${name}` : name;
}

/** prev 다음 판의 배경. prev 가 순서에 없으면(처음, 또는 순서 밖 배경) 맨 앞(포세이돈)부터 */
export function nextStage(prev = null) {
  return STAGE_ORDER[(STAGE_ORDER.indexOf(prev) + 1) % STAGE_ORDER.length];
}

const materialsOf = (o) => (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []);
/** o 가 쓰는 모양·재질·질감을 set 에 모은다 */
function collect(o, set) {
  if (o.geometry) set.add(o.geometry);
  for (const m of materialsOf(o)) {
    set.add(m);
    for (const v of Object.values(m)) if (v && v.isTexture) set.add(v);
  }
}

export class Stages {
  /** scene 과 같이 쓰는 빛 { hemi, sun }. 만들 때의 빛·안개·하늘색을 처음 값으로 적어 둔다 (배경을 짓기 전에 만들 것) */
  constructor(scene, { hemi, sun }) {
    this.scene = scene;
    this.hemi = hemi;
    this.sun = sun;
    this.base = {
      background: scene.background?.clone?.() ?? null,
      fog: scene.fog ? scene.fog.clone() : null,
      hemiColor: hemi.color.clone(),
      hemiGround: hemi.groundColor.clone(),
      hemiIntensity: hemi.intensity,
      hemiPos: hemi.position.clone(),
      sunColor: sun.color.clone(),
      sunIntensity: sun.intensity,
      sunPos: sun.position.clone(),
      shadow: shadowOf(sun), // 그림자 카메라 처음 값 (main.js: 1024² · ±4 m · 1~25 m) — 무대가 shadow 를 주면 바꿨다가 치울 때 되돌린다
    };
    this.snap = null; // 그림자 화소 맞춤 (무대 shadow.snap — 소금 사막): { right, up, du, dv } · 없으면 null
    this.id = null; // 지금 배경 id
    this.arena = null; // 지금 배경 { update, excite }
    this.sunOffset = DEFAULT_SUN_OFFSET; // 해가 싸우는 자리를 따라다닐 때의 방향
    this.objects = []; // 지금 배경이 scene 에 더한 것 (치울 때 쓴다)
    this.buildMs = 0; // 방금 짓는 데 걸린 시간 (ms) — ?fps=1 표시와 시험용
    this.clearMs = 0; // 먼저 지은 배경을 치우는 데 걸린 시간 (ms)
    this.warmMs = 0; // 새 배경을 GPU 에 미리 올리는 데 걸린 시간 (ms, warm)
  }

  /** id 배경을 짓는다 (먼저 지은 배경은 치우고, 빛·안개·하늘색은 처음 값으로 되돌린 뒤). 반환: { update, excite, sunOffset } */
  build(id) {
    const make = BUILDERS[id];
    if (!make) throw new Error(`모르는 배경: ${id}`);
    const t0 = performance.now();
    this.clear();
    this.restore();
    const t1 = performance.now();
    const before = new Set(this.scene.children);
    this.arena = make(this.scene, { hemi: this.hemi, sun: this.sun });
    this.objects = this.scene.children.filter((o) => !before.has(o));
    this.sunOffset = this.arena.sunOffset ?? DEFAULT_SUN_OFFSET;
    if (this.arena.shadow) this.useShadow(this.arena.shadow);
    this.id = id;
    this.clearMs = t1 - t0;
    this.buildMs = performance.now() - t1;
    return this.arena;
  }

  /**
   * 새 배경을 GPU 에 미리 올린다: 셰이더(compile, 화면 밖 것까지) · 질감(initTexture) · 모양(한 번 그려 보기).
   *  안 하면 이 일이 싸움 첫 프레임에 몰려 멈칫한다. 짓자마자 불러서 그 멈칫도 메뉴가 떠 있는 동안 지나가게 한다.
   *  그래픽 칩은 명령을 나중에 몰아서 처리하므로 끝까지 기다린다(finish). 안 기다리면 그 몫이 결국 첫 프레임에 온다.
   *  (한 번 그린 그림은 화면에 안 나간다: 같은 프레임 안에서 게임 루프가 다시 그린 뒤에 화면에 나간다)
   */
  warm(renderer, camera) {
    const t0 = performance.now();
    renderer.compile(this.scene, camera);
    const res = new Set();
    for (const o of this.objects) o.traverse((c) => collect(c, res));
    for (const r of res) if (r.isTexture) renderer.initTexture(r);
    renderer.render(this.scene, camera);
    renderer.getContext().finish();
    this.warmMs = performance.now() - t0;
  }

  /**
   * 지금 배경이 더한 것을 scene 에서 떼고 GPU 자원을 푼다.
   *  남는 것(캐릭터·핏방울·빛 …)이 같이 쓰는 모양·재질·질감과 무기 반사 환경(weaponEnv: 성의 종·대성당의 꽂힌 칼도 쓴다,
   *  모듈에 한 번 만들어 두고 무기마다 다시 쓴다)은 풀지 않는다
   */
  clear() {
    if (!this.objects.length) return;
    const mine = new Set(this.objects);
    const keep = new Set([weaponEnv()]);
    for (const o of this.scene.children) if (!mine.has(o)) o.traverse((c) => collect(c, keep));
    const res = new Set();
    const objs = [];
    for (const o of this.objects) {
      this.scene.remove(o);
      o.traverse((c) => {
        objs.push(c);
        collect(c, res);
      });
    }
    for (const r of res) if (!keep.has(r)) r.dispose();
    for (const c of objs) c.dispose?.(); // 인스턴스 메쉬의 자리·색 버퍼 (그 밖의 물체는 할 일이 없다)
    this.objects = [];
    this.arena = null;
  }

  /** 빛·안개·하늘색을 처음 값으로 */
  restore() {
    const b = this.base;
    this.scene.background = b.background?.clone?.() ?? null;
    this.scene.fog = b.fog ? b.fog.clone() : null;
    this.hemi.color.copy(b.hemiColor);
    this.hemi.groundColor.copy(b.hemiGround);
    this.hemi.intensity = b.hemiIntensity;
    this.hemi.position.copy(b.hemiPos);
    this.sun.color.copy(b.sunColor);
    this.sun.intensity = b.sunIntensity;
    this.sun.position.copy(b.sunPos);
    this.useShadow(b.shadow);
    this.snap = null;
  }

  /**
   * 무대 전용 그림자 카메라 (10/14 소금 사막 — 낮은 해의 긴 그림자): { left, right, top, bottom, near, far, mapSize, bias, normalBias, snap }.
   *  주지 않은 칸은 처음 값. 지도 크기가 바뀌면 지금 지도를 풀어 three 가 다음 그림에서 새 크기로 만들게 한다.
   *  snap 이면 해 방향에서 본 가로·세로 축과 화소 한 칸 크기를 적어 두고 snapSun 이 쓴다 (해 방향은 무대마다 고정)
   */
  useShadow(s) {
    const b = this.base.shadow, sh = this.sun.shadow, cam = sh.camera;
    for (const k of ['left', 'right', 'top', 'bottom', 'near', 'far']) cam[k] = s[k] ?? b[k];
    cam.updateProjectionMatrix();
    const size = s.mapSize ?? b.mapSize;
    if (sh.mapSize.x !== size || sh.mapSize.y !== size) {
      sh.mapSize.set(size, size);
      sh.map?.dispose();
      sh.map = null;
    }
    sh.bias = s.bias ?? b.bias;
    sh.normalBias = s.normalBias ?? b.normalBias;
    this.snap = null;
    if (s.snap) {
      // three 의 그림자 카메라는 해 자리에서 과녁을 본다(위 = +Y): 앞 L = 해 쪽, 가로 = Y × L, 세로 = L × 가로 (Matrix4.lookAt 과 같은 축)
      const L = new THREE.Vector3(this.sunOffset.x, this.sunOffset.y, this.sunOffset.z).normalize();
      const right = new THREE.Vector3(0, 1, 0).cross(L).normalize();
      const up = new THREE.Vector3().crossVectors(L, right);
      this.snap = { right, up, du: (cam.right - cam.left) / size, dv: (cam.top - cam.bottom) / size };
    }
  }

  /**
   * 그림자 화소 맞춤 (main.js updateCamera 가 해를 싸우는 자리로 옮긴 뒤 매 프레임): 해와 과녁을 같이 조금 옮겨 과녁이 그림자 지도 격자의
   *  화소 모서리에 오게 한다 → 카메라가 움직여도 그림자 화소 격자는 땅에 고정돼 긴 그림자 가장자리가 기어다니지 않는다. 옮기는 양은 화소 반 칸 안.
   *  snap 을 켜지 않은 무대는 아무 일도 없다 (해 자리 그대로)
   */
  snapSun() {
    const s = this.snap;
    if (!s) return;
    const t = this.sun.target.position;
    const pu = t.dot(s.right), pv = t.dot(s.up);
    _snap.copy(s.right).multiplyScalar(Math.round(pu / s.du) * s.du - pu).addScaledVector(s.up, Math.round(pv / s.dv) * s.dv - pv);
    t.add(_snap);
    this.sun.position.add(_snap);
  }
}

const _snap = new THREE.Vector3();
/** 해 그림자 설정의 지금 값 (처음 값을 적어 둘 때) */
function shadowOf(sun) {
  const c = sun.shadow.camera;
  return { left: c.left, right: c.right, top: c.top, bottom: c.bottom, near: c.near, far: c.far, mapSize: sun.shadow.mapSize.x, bias: sun.shadow.bias, normalBias: sun.shadow.normalBias };
}

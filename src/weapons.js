// ─────────────────────────────────────────────────────────────
//  무기고: 실제 자료 기반(+부족한 곳은 물리적으로 추정) 데이터 중심 무기 목록.
//
//  칼(자루+폼멜+코등이+칼날)은 그대로 fighter.js의 강체 모델을 쓴다: 네 부분(칼날 없는
//  무기는 코등이를 뺀 세 부분)의 질량·무게중심·관성을 정하면 나머지(균형점, 손 느낌,
//  휘두르는 관성)는 물리 엔진이 알아서 계산한다. fighter.js는 spec.buildParts(look)이
//  돌려주는 배열을 그대로 칼 콜라이더로 만들 뿐이다 (원래 하드코딩돼 있던 롱소드 계산과
//  똑같은 모양).
//
//  자료 출처와 신뢰도는 scratchpad 연구 노트(weapon_research.md, 이 브랜치의 PM 보고서에도
//  요약)를 따른다: [M]=박물관·제작사 실측, [D]=그 실측값에서 계산으로 뽑아냄, [I]=참고할
//  실측이 없어 물리적으로 그럴듯하게 추정/창작한 값. 아래 각 무기 설명에 표기해 둔다.
// ─────────────────────────────────────────────────────────────
import { classifyWeapon } from './weapon_class.js';
import { drawBrothersSword } from './renji_sword_wrap.js';
import { MONTANTE } from './config.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { swordKit, metalMat, weaponEnv, hiddenParts, drawTreeBranch, drawRubberChicken, drawFrozenTuna, drawPistol, drawMorgenstern, PISTOL_GRIP, PISTOL_BORE_X } from './weapon_looks.js';
import { SAIN_COLORS, ICE_COLORS, sainPartMesh, sainDecorate, icePartMesh, iceDecorate } from './rare_sword_details.js'; // 사인검·아이스 겉모습 (샛별 저장소에서 가져옴 6e71ba2·4a425f9)
import { FLAMBERGE_MUSEUM, FLAMBERGE_HILT, FLAMBERGE_COLORS, flambergePartMesh, flambergeDecorate } from './flamberge_look.js'; // 플랑베르주 겉모습 (샛별 저장소 325a5c38 의 생김새를 옮겨 고침)
import { GOUJIAN_COLORS, goujianPartMesh, goujianDecorate } from './goujian_details.js'; // 월왕구천검 겉모습 (샛별 저장소 7684c732 에서 가져옴 — 바이트 그대로)

// 재질별 되튐(반발 계수). 칼끼리 부딪히면 곱해진다(Multiply 규칙) → 강철끼리 0.7² 정도,
//  고무 대 강철처럼 하나가 낮으면 거의 튕기지 않는다(고무 닭이 칼에 그냥 맞고 만다).
export const MATERIALS = {
  steel: { restitution: 0.7 },
  plasma: { restitution: 0.85 }, // 빛의 칼날이라도 코등이·자루는 부딪히면 튕긴다
  wood: { restitution: 0.35 },
  rubber: { restitution: 0.55 },
  frozen: { restitution: 0.2 }, // 얼린 생선: 물컹하지 않고 딱딱하지만 다시 튕기진 않는다
};

// 소리 담당의 재질 쌍 API(sound.impact({a,b,energy})) 가 아는 이름은 sound.js MATERIALS =
// ['steel','armor','flesh','wood','plasma','rubber'] 뿐이다. 물리 재질(위 표)과 소리 재질이
// 다른 것은 여기서 옮긴다 — 얼린 참치는 딱딱한 통나무 소리(wood)가 제일 가깝다.
export const SOUND_MATERIAL = { steel: 'steel', plasma: 'plasma', wood: 'wood', rubber: 'rubber', frozen: 'wood' };

// 감독이 정한 무기 등급 (docs/characters.md, 캐릭터 PM 계약) — 다섯 단계:
//   쓰레기(trash) < 커먼(common) < 레어(rare) < 에픽(epic) < 레전드(legend)
// 등급마다 power(타격 에너지 배율, 감독 확정: 0.7/1.0/1.05/1.1/1.2)와 durability(내구 0~1, docs/characters.md 53da1bb:
// 0.4/0.8/0.85/0.95/1.0)가 다르다. 무기 스펙에 직접 적으면 그 값이 이기고, 안 적으면 등급 기본값을 받는다.
// power는 combat.js가 실제로 에너지에 곱한다. durability는 계약 수치이고 실제 파손 확률은 아래 TIER_FRAGILITY 표가 정한다.
// 부서지는 연출·그 뒤 흐름(맨손·주운 무기)은 감독이 붙인다.
export const TIERS = ['trash', 'common', 'rare', 'epic', 'legend', 'mystery'];
export const TIER_DEFAULTS = {
  trash: { power: 0.7, durability: 0.4 },
  common: { power: 1.0, durability: 0.8 },
  rare: { power: 1.05, durability: 0.85 },
  epic: { power: 1.1, durability: 0.95 },
  legend: { power: 1.2, durability: 1.0 },
  // ??? (사장님 결정): 엉뚱한 무기를 모아 등장만 드물게 한다. 계수·파손·겉면 마감은 모두 커먼과 똑같다 (싸움 판정은 커먼 그대로)
  mystery: { power: 1.0, durability: 0.8 },
};
/** 카드에 쓰는 등급 이름 (main.js TIER_KO 대신 이것을 쓰면 ??? 도 나온다) */
export const TIER_LABEL = { trash: '쓰레기', common: '커먼', rare: '레어', epic: '에픽', legend: '레전드', mystery: '???' };

// ── 무기 카드 뽑기 확률 (사장님 결정): 등급을 먼저 뽑고, 그 등급 안에서 무기를 고르게 뽑는다 ──
//  카드 한 장마다의 등급 확률(%). 무기가 늘거나 줄어도 등급 확률은 그대로다. ??? 는 등급 전체가 5%.
export const TIER_DRAW = { common: 40, rare: 27, epic: 16, legend: 5, trash: 7, mystery: 5 };
/**
 * 서로 다른 무기 n장을 뽑는다. pool: 뽑을 수 있는 무기 id 목록, exclude: 되도록 빼는 id(지난 판 무기).
 *  빈 등급(뽑을 무기가 없는 등급)은 건너뛰고 남은 등급끼리 비율을 다시 맞춘다. rnd: 0~1 난수 (기본 Math.random)
 */
//  묶음 (drawGroup, 샛별 저장소에서 가져옴 b4464ef weapon_draw.js — 간장·막야): 같은 drawGroup 무기는 등급 안에서 한 칸으로 센다.
//   그 칸이 뽑히면 묶음 안에서 하나를 고르고(난수 한 번 더), 같은 판에 묶음의 다른 무기는 나오지 않는다. 지난 판 무기를 뺄 때도 묶음째 뺀다.
//   묶음 없는 무기(지금 간장·막야 말고 전부)는 전과 같은 난수 수·같은 결과다.
export function drawWeaponCards(pool, n = 2, { exclude = null, rnd = Math.random } = {}) {
  pool = pool.filter(id => !getWeapon(id).characterOnly);
  const groupOf = (id) => getWeapon(id).drawGroup || id;
  const exGroup = exclude == null ? null : groupOf(exclude);
  let left = pool.filter((id) => groupOf(id) !== exGroup);
  if (new Set(left.map(groupOf)).size < n) left = [...pool];
  const out = [];
  while (out.length < n && left.length) {
    const byTier = {};
    for (const id of left) {
      const slots = (byTier[getWeapon(id).tier] ||= new Map());
      const g = groupOf(id);
      if (!slots.has(g)) slots.set(g, []);
      slots.get(g).push(id);
    }
    const tiers = Object.keys(byTier).filter((t) => (TIER_DRAW[t] ?? 0) > 0);
    const total = tiers.reduce((a, t) => a + TIER_DRAW[t], 0);
    let r = rnd() * total;
    let t = tiers[tiers.length - 1];
    for (const k of tiers) if ((r -= TIER_DRAW[k]) < 0) { t = k; break; }
    const slots = byTier[t] ? [...byTier[t].entries()] : left.map((id) => [groupOf(id), [id]]);
    const [g, members] = slots[Math.floor(rnd() * slots.length)];
    const id = members.length === 1 ? members[0] : members[Math.floor(rnd() * members.length)];
    out.push(id);
    left = left.filter((x) => groupOf(x) !== g);
  }
  return out;
}

// ── 파손 판정 규칙: 확률식 (감독 지시 — "예산을 넘으면 부러진다"는 너무 필연적이라 버렸다) ──
//  무기가 "칼끼리 세게 부딪힌 충격"이나 "투구·뼈를 치고 되튄 충격"(combat.js → fighter.absorbWeaponImpact, 충격량 J N·s)을
//  받을 때마다, 그 충돌 하나가 무기를 부러뜨릴 확률을 굴린다:
//      p(J) = fragility(등급) × min(1, J / BREAK.jRef)^BREAK.k        (재질이 고무·플라스마면 0)
//  · min(1, J/6)^2 : 얼마나 무게가 실린 충돌인가. 6 N·s(한 판 상위 1% 충돌쯤)면 온전히, 가벼운 스침(중앙값 0.5~0.8)은 그 제곱
//    비율만큼만 센다 — 살짝 닿아서는 사실상 안 부러지고 크게 맞부딪힌 한 방이 위험하다.
//  · fragility 는 등급표 TIER_FRAGILITY 로 정한다. 내구 d 로 식을 세우는 대신 표를 쓰는 이유: 감독이 등급별 파손률 목표를
//    직접 주셨고(아래), (1−d)^k 한 식으로는 네 등급 목표를 동시에 못 맞춘다(등급 간 비가 7.2 : 1.7 : 3.1 로 고르지 않다).
//    표는 tools/sim/weapon_break_rate.mjs 의 표준 측정 — "죽지 않는 60초 경합, 롱소드 상대, 양쪽 자리 25판씩" — 에서
//    충돌 하나하나의 J 분포로 맞춘 값이다(승패까지 돌리면 판이 평균 17초에 끝나 노출이 판마다 달라진다 — 감독 지적).
//      감독 1차 목표(60초 경합 한 판 파손률): 쓰레기 60% / 커먼 강철 15% / 레어 9% / 에픽 3% / 레전드·라이트세이버 0 → 그 뒤 2배
//    레어·에픽은 실물이 롱소드 물리라고 보고 맞췄다(청강검처럼 가벼운 칼은 충돌이 적어 같은 표로 조금 덜 부러진다: 에픽 2.2%).
//  · 참치는 감독 지시로 안 부러진다(fragility 0). 실제 승패까지 가는 판(평균 17초)에서는 모든 값이 60초 경합보다 낮다.
//  굴리는 난수는 fighter.js의 파이터별 전용 난수(Math.random 과 분리)라, 부러지지 않는 한 기존 시뮬 결과가 바뀌지 않는다.
export const BREAK = {
  jRef: 6,
  k: 2,
  // 부러지는 자리: 칼날 길이의 이 비율(자루 쪽=0)에서 끊기고 칼끝 쪽이 떨어져 나간다 (무기마다 spec.breakAt 로 바꿀 수 있다)
  at: 0.5,
  // 남은 토막에 날이 남는가. true = 토막 날로 베기·찌르기를 하되 효율을 깎는다(stubCut·stubThrust 를 mCut·mThrust 에 곱한다).
  //  false = 부러진 칼은 둔기. 사장님 결정: 켠다 — 반으로 부러진 칼도 남은 쪽엔 날이 서 있다.
  stubEdge: true,
  stubCut: 0.6,
  stubThrust: 0.4,
};
// 감독 지시(2차): 실제 승패 판(평균 17초)에서는 60초 경합보다 훨씬 덜 부러지니 표 전체를 2배로 올린다.
//  (60초 경합 기준 맞춤값의 2배: trash 0.20→0.40, common 0.028→0.056, rare 0.016→0.032, epic 0.0052→0.0104)
export const TIER_FRAGILITY = { trash: 0.4, common: 0.056, rare: 0.032, epic: 0.0104, legend: 0, mystery: 0.056 }; // ??? = 커먼과 같다
// 재질: 플라스마 칼날만 부러질 것이 없다. 고무 닭은 감독 지시로 쓰레기와 똑같이 부서지고(등급표 그대로), 참치는 안 부서진다(fragility 0).
export const MATERIAL_TOUGHNESS = { steel: 1, wood: 1, frozen: 1, rubber: 1, plasma: Infinity };
/** fragility·재질의 무기가 충격량 J(N·s)짜리 충돌 한 번에 부러질 확률 (0~1) */
export function breakChance(J, fragility, material) {
  const t = MATERIAL_TOUGHNESS[material] ?? 1;
  if (!(fragility > 0) || !Number.isFinite(t) || !(J > 0)) return 0;
  return Math.min(1, (fragility / t) * Math.min(1, J / BREAK.jRef) ** BREAK.k);
}


// ── 관성 계산 도우미 (fighter.js 원래 롱소드 계산과 같은 식) ──
// 상자 모양 부품의 휘두르는 축(Ie, x·z 성분에 함께 쓴다)·비트는 축(It, y=칼 길이 방향) 관성.
function boxInertia(m, hx, hy, hz) {
  return { Ie: (m * ((2 * hx) ** 2 + (2 * hy) ** 2)) / 12, It: (m * ((2 * hx) ** 2 + (2 * hz) ** 2)) / 12 };
}
// 공 모양(폼멜) 관성: 어느 축이나 같다.
function sphereInertia(m, r) {
  const I = 0.4 * m * r * r;
  return { Ie: I, It: I };
}
/**
 * 칼날 자체의 무게중심·관성. comFrac = 무게중심이 칼날 길이의 몇 %인지(자루 쪽=0),
 * gyrationFrac = 그 무게중심을 축으로 한 회전 반경(칼날 길이의 비율, 실측 자료가 있으면
 * 그 conjugate-point 계산값을 그대로 쓴다). 비트는 축 관성은 롱소드의 실측값
 * (0.842kg·폭4.8cm·두께1.6cm → 0.0000736)을 질량·단면적 비로 옮겨 쓴 추정값 [D].
 */
function bladeInertia(mass, L, comFrac, gyrationFrac, width, thickness) {
  const comY = (comFrac - 0.5) * L;
  const Ie = mass * (gyrationFrac * L) ** 2;
  // width/thickness는 칼날 단면의 전체 폭·두께(m). 기준값 0.0000736은 롱소드 실측
  // (질량 0.842kg, 폭 4.8cm, 두께 1.6cm)이므로 그 전체 치수(0.048×0.016)에 대한 비로 옮긴다.
  // fighter.js driveSword()의 "날 세우기(손목 비틀기)" 힘은 이 비틀림 관성이 롱소드와 비슷하다고
  // 가정한 고정 세기(4, 25 등)를 쓴다 → 너무 얇은 칼날(라이트세이버 등)은 그 힘 그대로면 축이
  // 팽이처럼 돌아 발산한다. 0.45배 밑으로는 내려가지 않게 바닥을 둔다 (안정성 안전장치, 창작 [I]).
  const ratio = Math.max(0.45, (width * thickness) / (0.048 * 0.016));
  const It = 0.0000736 * (mass / 0.842) * ratio;
  return { comY, Ie, It };
}
// pose(선택): 칼 축에서 비켜 놓거나 기울인 부품 { x, rotZ, I } — fighter.js 가 그대로 콜라이더·겉모습에 쓴다 (권총 손잡이만)
const partTuple = (shape, y, mass, comY, Ie, It, color, isBlade = false, pose) => (pose ? [shape, y, [mass, comY, Ie, It], color, !!isBlade, pose] : [shape, y, [mass, comY, Ie, It], color, !!isBlade]);

// 물리에는 영향 없는 장식용 메쉬. fighter.js가 칼 콜라이더를 다 만든 뒤
// spec.decorate?.(group, look)를 한 번 불러 준다 (group에 자유롭게 덧붙이면 된다).
function addMesh(group, geo, mat, pos) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(...pos);
  group.add(m);
  return m;
}

// 같은 재질의 작은 장식 조각을 메쉬 하나로 그린다 (그림자를 드리우는 조각이 메쉬마다 따로면 그림자 그리기까지 두 번씩 그려진다).
//  pieces: [지오메트리, 자리 [x, y, z], z 축 기울기(rad)] — 조각마다 메쉬로 그릴 때와 같은 행렬(position·rotation.z)로 구운 복제본을 합친다.
//  조각은 모두 같은 꼴이어야 한다(색인 있음 · 위치·법선·uv — 상자·원기둥 같은 기본 지오메트리끼리). 합친 메쉬는 그림자를 드리운다.
//  넘겨준 지오메트리는 부르는 쪽 것이라 풀지 않는다.
const _mergeM = new THREE.Matrix4();
const _mergeQ = new THREE.Quaternion();
const _mergeE = new THREE.Euler();
const _mergeP = new THREE.Vector3();
const _mergeS = new THREE.Vector3(1, 1, 1);
function addMerged(group, pieces, mat) {
  const baked = pieces.map(([geo, pos, rotZ = 0]) => geo.clone().applyMatrix4(_mergeM.compose(_mergeP.set(...pos), _mergeQ.setFromEuler(_mergeE.set(0, 0, rotZ)), _mergeS)));
  const m = addMesh(group, mergeGeometries(baked), mat);
  for (const g of baked) g.dispose();
  m.castShadow = true;
  return m;
}

// 츠카이토 (모노호시자오·우치가타나): 납작한 비단 끈이 앞뒤 면에서 X 자로 엇갈려 감기고 옆면에서 꺾여 넘어가는 매듭 —
//  y0(카시라 쪽 첫 줄)부터 0.034 m 마다 0.205 까지. 끈·매듭 상자는 자리·기울기째 구워 메쉬 하나('tsukaIto')로 그린다 — 상자마다
//  메쉬였을 땐 그림자 그리기까지 그리기 호출이 상자 수 × 2 들었다(성 안뜰 폰 가로: 미나미 + 모노호시자오 404 → 262, 같은 미나미 + 롱소드 266 ·
//  이졸데 + 우치가타나 343 → 225, 롱소드 230). 자리·각도·색·그림자 드리우기는 상자마다 그리던 때와 같다.
function addTsukaIto(group, silk, y0) {
  const step = 0.034;
  const strip = new THREE.BoxGeometry(0.0062, step * 0.78, 0.0022);
  const knot = new THREE.BoxGeometry(0.0026, 0.007, 0.022);
  const ito = [];
  for (let y = y0; y <= 0.205; y += step) {
    for (const sz of [-1, 1]) {
      for (const lean of [-1, 1]) ito.push([strip, [0, y, sz * 0.0162], lean * 0.72]);
    }
    for (const sx of [-1, 1]) ito.push([knot, [sx * 0.0133, y + step / 2, 0]]);
  }
  const m = addMerged(group, ito, silk);
  m.name = 'tsukaIto';
  strip.dispose();
  knot.dispose();
  return m;
}

// 재질(빛깔) 결정: 기본은 강철(칼끝 은색, 날 제외 부분은 캐릭터 옷과 맞춘 손잡이/코등이 색).
function steelMatOpts(isBlade) {
  // 이 장면엔 환경 맵(envMap)이 없다 — metalness를 실제 강철만큼(0.9) 올리면 직접광 하이라이트
  // 말고는 다 새까맣게 나온다(반사할 "환경"이 없어서), 그래서 칼날이 "가늘고 어두운 막대"로
  // 보였다. metalness를 적당히 낮추고 그만큼 난반사(roughness는 살짝만)로 받쳐서, 환경 맵 없이도
  // "강철"로 밝게 읽히게 한다. 물리에는 영향 없다(장식용 메쉬 재질일 뿐).
  return isBlade ? { metalness: 0.35, roughness: 0.3 } : null;
}

// ── 곡도·외날 등 곡면 칼날/몸통 메쉬 (물리 콜라이더는 그대로 상자꼴 — 겉보기만 다르다) ──
// fighter.js가 spec.partMesh(idx, isBlade, shape, color, matOpts, look, tier)를 부를 수 있으면 그걸 쓴다 — 칼은 대부분
//  weapon_looks.js swordKit() 으로 조합하고, 날 없는 무기(나뭇가지·고무 닭·참치)는 weapon_looks.js 가 통째로 그린다.
//  여기 남은 것은 라이트세이버 플라스마 막대용이다.

/**
 * 단면이 다각형인 막대 지오메트리 (라이트세이버 플라스마 칼날). bend(t)는 [x,z] 오프셋
 * (t=0 자루 쪽 ~ t=1 끝), taper(t)는 그 위치의 단면 배율(1이면 hx/hz 그대로).
 */
function rodGeometry(hx, hy, hz, { bend, taper, sides = 10, segs = 14 } = {}) {
  const ringAt = (t) => {
    const y = -hy + 2 * hy * t;
    const s = taper ? taper(t) : 1;
    const [bx, bz] = bend ? bend(t) : [0, 0];
    const pts = [];
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      pts.push([Math.cos(a) * hx * s + bx, y, Math.sin(a) * hz * s + bz]);
    }
    return pts;
  };
  const verts = [];
  const quad = (p0, p1, p2, p3) => verts.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
  let prev = ringAt(0);
  for (let i = 1; i <= segs; i++) {
    const cur = ringAt(i / segs);
    for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides;
      quad(prev[k], cur[k], cur[k2], prev[k2]);
    }
    prev = cur;
  }
  const center = (ring, y) => {
    let cx = 0, cz = 0;
    for (const [x, , z] of ring) { cx += x; cz += z; }
    return [cx / ring.length, y, cz / ring.length];
  };
  const base = ringAt(0);
  const bc = center(base, -hy);
  for (let k = 0; k < sides; k++) { const k2 = (k + 1) % sides; verts.push(...bc, ...base[k2], ...base[k]); }
  const tip = ringAt(1);
  const tc = center(tip, hy);
  for (let k = 0; k < sides; k++) { const k2 = (k + 1) % sides; verts.push(...tc, ...tip[k], ...tip[k2]); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * 칼날 부품(isBlade)에만 곡면 지오메트리를 입히는 partMesh 팩토리 (그 밖의 부품은 예전처럼
 * 상자·공 그대로). shape=['box',hx,hy,hz]를 그대로 물려받는다 — 물리 콜라이더는 안 바뀐다.
 */
function curvedBlade(build) {
  return (idx, isBlade, shape, color, matOpts, look) => {
    if (!isBlade || shape[0] !== 'box') return undefined;
    const [, hx, hy, hz] = shape;
    const geo = build(hx, hy, hz, look);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, side: THREE.DoubleSide, ...(matOpts || {}) }));
    m.castShadow = true;
    return m;
  };
}

/**
 * 등급 마감: 같은 재질이라도 등급이 겉면에서 한눈에 읽히게 한다 (감독 지시 — 물리에는 영향 없음).
 *  쓰레기 = 더 칙칙하고 거칠게(광 없음), 커먼 = 있는 그대로(회귀 기준이라 절대 안 바꾼다),
 *  레어 = 손질된 마감(광이 돌기 시작), 에픽 = 고운 세공 + 은은한 광택(sheen), 레전드 = 최상급 연마.
 *  레전드에 자체 발광은 안 준다 — 레전드 등급의 표식은 aura.js 기운 하나여야 해서 (사장님 10/10 20:0x "빛 나는 건 레전드 등급 특성" — 전엔 "진짜 엑스칼리버의 표식")
 *  (복제품이 finishTier 'legend'로 같은 마감을 받아도 눈으로 구분이 안 되게).
 *  이미 자체 발광이 있는 재질(플라스마 칼날)의 emissive는 건드리지 않는다.
 */
function tierFinish(base, tier, isBlade) {
  if (!tier || tier === 'common') return base;
  const o = { ...(base || {}) };
  const r = o.roughness ?? (isBlade ? 0.3 : 0.85);
  const m = o.metalness ?? (isBlade ? 0.35 : 0.05);
  if (tier === 'trash') {
    o.roughness = Math.min(1, r + 0.25);
    o.metalness = m * 0.4;
  } else if (tier === 'rare') {
    o.roughness = r * 0.7;
    o.metalness = Math.min(0.7, m + 0.1);
  } else if (tier === 'epic') {
    o.roughness = r * 0.5;
    o.metalness = Math.min(0.7, m + 0.18);
    if (isBlade && o.emissive == null) {
      o.emissive = 0x9fd8e8; // 은은한 광택: 강한 빛이 아니라 "결이 고운 강철"의 푸른 윤
      o.emissiveIntensity = 0.1;
    }
  } else if (tier === 'legend') {
    o.roughness = r * 0.45;
    o.metalness = Math.min(0.72, m + 0.22);
  }
  return o;
}

/** 무기 재질·등급에 따라 칼 부품 겉면 재질을 다르게 (fighter.js가 그대로 shapeMesh에 넘긴다) */
export function weaponMatOpts(material, isBlade, tier) {
  const base = (() => {
    switch (material) {
      case 'plasma':
        return isBlade ? { emissive: 0x2f8fe0, emissiveIntensity: 2.4, color: 0xbfe6ff, metalness: 0, roughness: 0.2, toneMapped: false } : { metalness: 0.6, roughness: 0.35 };
      case 'rubber':
        return { metalness: 0, roughness: 0.95 };
      case 'wood':
        return { metalness: 0, roughness: 1 };
      case 'frozen':
        return { metalness: 0.15, roughness: 0.45 };
      default:
        return steelMatOpts(isBlade);
    }
  })();
  return tierFinish(base, tier, isBlade);
}

// ── 무기마다 손을 잡는 방식에 따른 손목 힘 한계 (config.js WEAPON.maxAimTorque=22의 기본값은
//  "두 손목"을 가정한 값. 한 손이면 그 절반 남짓, 한 손 반이면 그 중간) ──
// 감독 확정: 한손 무기도 "양손으로 잡고 휘두른다"고 가정한다(현실의 한손검 이점 — 가벼운 몸놀림·빠른 자세 전환 — 을 지금 다
//  구현할 수 없으니 그 대신). 그래픽·grip 표시는 그대로 두고 손목·팔 힘 한계만 두손 값(22 N·m)으로 통일. 한손 값 12 는
//  Delp 1996 손목 굴곡 토크 실측(평균 12.2 N·m)이었고, 22 는 양손·팔 전체 기여 추정치 [D].
const GRIP_TORQUE = { 'one-hand': 22, 'hand-and-half': 22, 'two-hand': 26 }; // two-hand 22 → 26: 사장님 10/8 16:20 '그렇게 해'(확인표 191) — 두 손 짝힘은 한 손 손목보다 세다(츠바이핸더 28 선례). 세로 베기(서보 포화 91 %) 14.4 → 14.8 m/s, 자리 에너지 86 → 116 J. 무기별 명시값(참치 16)은 그대로 — 츠바이핸더 28 은 10/10 쥠 넓힘에서 뺌(확인표 682). `?twoHandCap=22` = 전 값(setGripTorque)

// ── 찌르기 무기의 찌르기 장점 (감독 확정 수치 mCut·mThrust·power 와 별개의 장치) ──
//  베기가 약한(mThrust > mCut) 에스톡·레이피어는 "톡 쳐서 찌르기"가 자연스러운 싸움법이 되도록 찌를 때만 이점을 준다.
//   recover: 탭 찌르기 뒤 자세로 돌아오는 시간 배율 (skill.js). 겨누기·뻗기는 팔 힘의 한계라 빠르게 하지 않는다
//   reach  : 탭 찌르기에서 손을 더 뻗는 거리 (m, skill.js)
//   gap    : 찌르기가 옷·투구의 틈을 파고드는 정도 — 막아주는 몫의 이 비율을 무시한다 (combat.js)
//   window : 칼끝 판정 폭 — 찌르기로 치는 칼날 위치(t > 0.8)와 칼축 방향(> 0.75) 기준을 이만큼 낮춘다 (combat.js)
//  에스톡: 판금 틈을 노리던 찌르기검 → 틈 파고들기가 가장 크다. 레이피어: 가볍고 빠른 결투검 → 가장 빠르고 판정 폭이 넓다
export const THRUST_STYLE = {
  estoc: { recover: 0.7, reach: 0.12, gap: 0.5, window: 0.1 },
  rapier: { recover: 0.6, reach: 0.1, gap: 0.3, window: 0.12 },
};

function finalizeSpec(id, s) {
  // ...s를 먼저 펼치고 계산된 필드를 뒤에 둔다 (뒤에 적은 값이 이긴다) →
  //  controlOverrides처럼 "기본값과 병합"해야 하는 필드가 s의 원본 값에 덮어써지지 않는다.
  const spec = {
    ...s,
    id,
    // 특수 능력(에픽, 사장님): 카드 설명 끝에 한 칸 띄고 "(별칭: 효과)"를 붙인다. 능력은 늘 켜져 있다 (스위치 없음)
    desc: s.ability ? `${s.desc} (${s.ability})` : s.desc,
    edged: s.edged !== false,
    mCut: s.mCut ?? 1,
    mThrust: s.mThrust ?? 1,
    mBlunt: s.mBlunt ?? 1,
    tier: s.tier ?? 'common', // 등급 안 적으면 커먼
    power: s.power ?? TIER_DEFAULTS[s.tier ?? 'common'].power, // 등급 공격력 배율 (mCut/mThrust/mBlunt 위에 한 번 더 곱한다)
    durability: s.durability ?? TIER_DEFAULTS[s.tier ?? 'common'].durability, // 등급 내구 (0~1, 감독이 쓸 계약 수치)
    // 충돌 한 번(충격량 J)에 부러질 확률. 재질상 안 부러지는 무기(고무·플라스마)와 레전드는 늘 0.
    fragility: s.fragility ?? TIER_FRAGILITY[s.tier ?? 'common'], // 등급표 값 (무기가 직접 적으면 그 값)
    breakChance(J) { return breakChance(J, this.fragility, this.material); },
    breakAt: s.breakAt ?? BREAK.at, // 부러지는 자리 (칼날 길이 비율, 자루 쪽=0) — fighter.breakWeapon()
    fragile: breakChance(BREAK.jRef, s.fragility ?? TIER_FRAGILITY[s.tier ?? 'common'], s.material) > 0, // 부러질 수 있는 무기인가
    ignoreArmor: !!s.ignoreArmor,
    thrustStyle: s.thrustStyle ?? null, // 찌르기 무기의 찌르기 장점 (아래 THRUST_STYLE). 없으면 null
    // 가시 무기(모르겐슈테른): 날은 없지만(edged:false → 늘 둔기) 'blade' 부품 끝(t > 0.8)이 칼 축 방향으로 들어가면 약한 찌르기 (combat.js analyze, 확인표 줄 135).
    //  없는 무기는 거짓 — combat.js 의 그 가지는 spike 로만 열린다
    spike: !!s.spike,
    // 부러지는 절대 높이(손 기준 m): 적으면 breakAt(칼날 비율) 대신 이 높이에서 끊고, 그 위에 통째로 있는 부품(쇠 공 머리)은 떨어져 나간다 (fighter.breakWeapon, 줄 139)
    breakY: s.breakY ?? null,
    gripAlong: s.gripAlong ?? -0.14,
    twoHand: s.grip !== 'one-hand',
    // 한손 자세표(guards.js ONE_HAND: 칼 든 어깨를 앞으로, 손을 더 뻗는다)를 쓰나. 한손 무기는 기본으로 쓴다
    oneHandStance: s.oneHandStance ?? s.grip === 'one-hand',
    soundMaterial: s.soundMaterial ?? SOUND_MATERIAL[s.material] ?? 'steel', // 소리 담당 API에 넘길 재질 이름
    controlOverrides: { maxAimTorque: GRIP_TORQUE[s.grip] ?? 22, ...s.controlOverrides },
    capFromGrip: !(s.controlOverrides && 'maxAimTorque' in s.controlOverrides), // 서보 상한이 쥠 기본값에서 왔나(setGripTorque 가 바꿀 대상)
  };
  // 무기 유형 (weapon_class.js, docs/weapon_types.md): 몸 틀 × 싸움 방식. 스펙에 적으면 그 값, 아니면 질량 분포·배율로 자동.
  //  지금은 이름표일 뿐 게임 동작은 읽지 않는다 (다음 버전 동작 라이브러리가 읽는다)
  const cls = classifyWeapon(spec);
  spec.frame = cls.frame;
  spec.style = cls.style;
  return spec;
}

// ═════════════════════════════════════════════════════════════
//  1) 롱소드 (기본값, 절대 바뀌면 안 된다 — 기존 시뮬 결과와 그대로 맞아야 한다)
//     Albion Liechtenauer 훈련용 롱소드 실측치 그대로 (fighter.js에 있던 원래 계산과 동일)
// ═════════════════════════════════════════════════════════════
const longsword = finalizeSpec('longsword', {
  nameKo: '롱소드', nameEn: 'Longsword',
  desc: '두 손으로 쥐는 균형 잡힌 장검.\n베기도 찌르기도 두루 잘한다.',
  grip: 'two-hand', material: 'steel',
  hiltLength: 0.13, bladeLength: 1.05, gripAlong: -0.14,
  // 겉모습만 (물리·질량은 위 실측 그대로, 한 글자도 안 바뀐다): 양날 마름모 단면 + 날 세움 면, 칼몸 절반까지 피홈,
  //  끝으로 좁아져 창끝처럼 뾰족한 칼끝. 끈 감은 가죽 자루, 바퀴형 폼멜, 끝 장식 곧은 코등이.
  partMesh: swordKit({
    blade: { edge: 'double', width: (t) => 1 - 0.42 * t, thick: 0.0036, tip: 'spear', tipLen: 0.1, fuller: { to: 0.5, width: 0.22, depth: 0.5 } },
    grip: { style: 'cord' },
    pommel: { style: 'wheel' },
    guard: { style: 'bar' },
  }),
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.16, 0.018, 0.1, 0.018);
    const pommel = sphereInertia(0.418, 0.03);
    const cross = boxInertia(0.18, 0.11, 0.015, 0.022);
    const blade = bladeInertia(0.842, L, 0.344, 0.253, 0.048, 0.016);
    return [
      partTuple(['box', 0.018, 0.1, 0.018], 0, 0.16, 0, grip.Ie, grip.It, look.grip),
      partTuple(['ball', 0.03], -0.12, 0.418, 0, pommel.Ie, pommel.It, look.hilt),
      partTuple(['box', 0.11, 0.015, 0.022], 0.115, 0.18, 0, cross.Ie, cross.It, look.hilt),
      partTuple(['box', 0.024, L / 2, 0.008], 0.13 + L / 2, 0.842, blade.comY, blade.Ie, blade.It, 0xd8dde3, true),
    ];
  },
});

// (옛 1b '롱소드(실전용)' — Albion Crécy 1.39kg·칼날 0.90m — 는 감독 결정으로 기본 롱소드와 하나로 합쳤다. 제원은
//  docs/weapons_research.md §1 에 남아 있고, 'longsword_sharp'·'sharp' 는 별칭으로 롱소드를 가리킨다.)

// (옛 2 '암소드' 는 감독 결정으로 삭제 — 버클러 없이는 짧은 롱소드일 뿐이었다. 'arming_sword'·'arming' 은 별칭으로 롱소드를 가리킨다.)
// (옛 3 '메서' 는 감독 결정으로 삭제 — 암소드·팔쉬온과 변별성이 없었다. 'messer' 는 별칭으로 팔쉬온을 가리킨다.)

// ═════════════════════════════════════════════════════════════
//  4) 츠바이핸더 (Great Sword / Montante) — 전체 무게 2.4~4kg대, Albion "The Wallace"
//     2.892kg·칼날 117cm [M]. 균형점 실측 자료를 못 찾아(연구 노트 §14) 롱소드 가문의
//     비율로 크기만 올려서 추정 [I]
// ═════════════════════════════════════════════════════════════
// 쥠 세 꼴 (MONTANTE.hand, config.js — docs/motion/iberian_montante_2026-10-10.md §10·§12·§15). 칼 원점 = 오른손 주먹 가운데, 손~칼끝 1.36 m 는 모두 같다.
//  'mid'(기본 — 사장님 10/10 20:4x '초기 그립과 지금의 중간', 확인표 760~): 손 사이 0.24 m(gripAlong −0.24) · 오른손 주먹 가운데 ~ 날밑 아랫면 0.11 m ·
//    hiltLength(손 → 칼날 밑동) 0.145 · 칼날 1.215 · 날밑 가운데 0.13 · 폼멜 가운데 −0.25(왼손 폼멜 목, 폼멜 끝 −0.288) · 자루 상자 날밑 밑 0.115 ~ −0.25.
//    날밑 아랫면 ~ 폼멜 끝 0.398 m (톨레도 몬탄테 Cleveland 1916.1509 · 1916.1507 자루 41.3 · 40.0 cm 안).
//  'guard'(10/10 14:5x '넣어' — 고디뉴 1599 규칙 3 '오른손 날밑 가까이', §12): 손 사이 0.30 · 날밑 0.065 m · hiltLength 0.10 · 칼날 1.26 · 폼멜 −0.31 — `?montanteHand=guard`
//  'old'(10/10 아침 꼴 — §10 넓힘 전): 손 사이 0.18 · 날밑 0.155 m · hiltLength 0.19 · 칼날 1.17 · 자루 ±0.16(0.32 m) · 폼멜 −0.16 · 서보 덮개 28 — `?montanteHand=old`
//  'wide'(§10~§11 꼴 — 자루만 넓힘, 오른손은 아직 날밑에서 0.155 m): 손 사이 0.30 · hiltLength 0.19 · 칼날 1.17 · 폼멜 −0.31 — `?montanteHand=wide` (§12 의 옛 꼴 'old')
//  칼날 1.7 kg 의 질량 분포는 네 꼴이 같다(손에서 칼날 무게중심 0.588 m · 그 둘레 관성 같음 — 칼날이 길어진 몫은 전에도 쇠(슴베)였던 자리, 실측 없이 무게를 옮기지 않는다).
//  자루 상자는 날밑 아랫면 0.005 위 ~ 폼멜 가운데, 부품 질량 그대로(자루 0.26 · 폼멜 0.62 · 날밑 0.32 · 칼날 1.7 = 2.9 kg)
const ZW_BLADE_COM = 0.19 + 0.34 * 1.17; // 손에서 칼날 무게중심 (아침 꼴 값 — 모든 꼴이 지킨다)
const zwShift = (hilt) => ({ com: (ZW_BLADE_COM - hilt) / (1.36 - hilt), gyr: (0.253 * 1.17) / (1.36 - hilt) });
const ZW_FORMS = {
  old: { hilt: 0.19, blade: 1.17, crossY: 0.175, gripY: 0, gripH: 0.16, pommelY: -0.16, gripAlong: -0.18, com: 0.34, gyr: 0.253, cap: 28 },
  wide: { hilt: 0.19, blade: 1.17, crossY: 0.175, gripY: -0.075, gripH: 0.235, pommelY: -0.31, gripAlong: -0.3, com: 0.34, gyr: 0.253 },
  guard: { hilt: 0.1, blade: 1.26, crossY: 0.085, gripY: -0.12, gripH: 0.19, pommelY: -0.31, gripAlong: -0.3, com: (0.19 + 0.34 * 1.17 - 0.1) / 1.26, gyr: (0.253 * 1.17) / 1.26 },
  mid: { hilt: 0.145, blade: 1.215, crossY: 0.13, gripY: -0.0675, gripH: 0.1825, pommelY: -0.25, gripAlong: -0.24, ...zwShift(0.145) },
};
const ZW = ZW_FORMS[MONTANTE.hand] ?? ZW_FORMS.mid; // 모르는 이름은 기본(중간)
const zweihander = finalizeSpec('zweihander', {
  nameKo: '츠바이핸더 (대형 양손검)', nameEn: 'Zweihänder',
  desc: '정예 용병이 쓰던 거대한 양손검.\n느리지만 맞으면 묵직하게 부순다.',
  grip: 'two-hand', material: 'steel',
  tier: 'common', // 사장님 10/11 01:4x '츠바이핸더는 커먼으로' (전: 레어 — 도펠죌트너만 다루던 특수 대검, power 1.05) → power 1.0
  // 쥠 (사장님 10/10 '쥠은 고증대로 넓혀', 확인표 680~): 고디뉴 몬탄테 규칙 3 '오른손 날밑 가까이, 왼손 폼멜 가까이'.
  //  자루 길이는 같은 시대 톨레도 몬탄테 두 자루 실측(Cleveland 1916.1509 · 1916.1507: 날밑~폼멜 끝 0.40~0.42 m)으로 —
  //  오른손(칼 원점)에서 폼멜 끝까지 0.41 − 0.065(날밑 쥔 주먹 반 폭 + 날밑 두께) ≈ 0.35 m. 왼손은 폼멜 목(−0.30, 손 사이 0.30 m).
  //  그때(10/10 14:1x)는 hiltLength(손~칼날 밑동)·칼날·코등이를 그대로 두었고, 오른손을 날밑으로 올린 것은 10/10 14:5x '넣어'(§12).
  //  10/10 20:4x '초기 그립과 지금의 중간' → 기본 'mid'(손 사이 0.24 · 날밑 0.11 m, 위 ZW, §15)
  hiltLength: ZW.hilt, bladeLength: ZW.blade, gripAlong: ZW.gripAlong,
  ...(ZW.cap ? { controlOverrides: { maxAimTorque: ZW.cap } } : {}), // 아침 꼴('old')만 서보 덮개 28 (§10 에서 뺌 — 확인표 682)
  mCut: 1.1, mThrust: 0.85, mBlunt: 1.15,
  // 손목 서보 상한: 두 손 쥠 기본값(26)을 쓴다. 예전 28 덮개는 '자루가 길어 손 사이 지렛대가 커서'를 대신 넣은 값이었는데,
  //  쥠을 넓혀(손 사이 0.18 → 0.30 m) 그 지렛대가 빈손 스프링으로 물리에 직접 들어가서 뺐다 (48 판 28: 46 %·넘어짐 45 / 26: 48 %·33, 확인표 680~)
  // 양날 대검: 넓은 칼몸, 긴 피홈, 창끝 칼끝. 배 모양 폼멜, 긴 곧은 코등이 (리카소·갈고리는 decorate)
  partMesh: swordKit({
    blade: { edge: 'double', width: (t) => 1 - 0.3 * t, thick: 0.0045, tip: 'spear', tipLen: 0.12, fuller: { to: 0.45, width: 0.2, depth: 0.5 } },
    grip: { style: 'cord' },
    pommel: { style: 'pear' },
    guard: { style: 'bar' },
  }),
  buildParts(look) {
    const L = this.bladeLength;
    // 자루: 코등이 밑에서 폼멜(ZW.pommelY)까지 — 중간(기본) 0.115 → −0.25 (0.365 m) · 날밑 꼴 0.07 → −0.31 · 아침 꼴 ±0.16. 부품 질량은 그대로(합 2.9 kg)
    //  날밑: 가운데 ZW.crossY · 칼날: 손 위 ZW.hilt 부터 — 칼날 질량 분포(무게중심 자리·그 둘레 관성)는 모든 꼴이 같다 (위 ZW 머리말)
    const grip = boxInertia(0.26, 0.02, ZW.gripH, 0.02);
    const pommel = sphereInertia(0.62, 0.038);
    const cross = boxInertia(0.32, 0.14, 0.02, 0.026);
    const blade = bladeInertia(1.7, L, ZW.com, ZW.gyr, 0.056, 0.018);
    return [
      partTuple(['box', 0.02, ZW.gripH, 0.02], ZW.gripY, 0.26, 0, grip.Ie, grip.It, look.grip),
      partTuple(['ball', 0.038], ZW.pommelY, 0.62, 0, pommel.Ie, pommel.It, look.hilt),
      partTuple(['box', 0.14, 0.02, 0.026], ZW.crossY, 0.32, 0, cross.Ie, cross.It, look.hilt),
      partTuple(['box', 0.028, L / 2, 0.009], this.hiltLength + L / 2, 1.7, blade.comY, blade.Ie, blade.It, 0xd8dde3, true),
    ];
  },
  // 레어 등급 마감 (전부 물리 무관, 콜라이더에서 ~1cm 안):
  //  - 파리어하켄(parrying hook): 칼날 밑동(리카소)에서 코등이와 같은 평면(x축)으로 뻗은 작은 갈고리.
  //    예전엔 z축(칼날 면 방향)으로 뻗어 칼날 면을 보는 시점에서 카메라를 향해 숨어 버렸다.
  //  - 리카소 가죽 감개: 갈고리 아래 칼날 밑동을 감싸 두 번째 손잡이로 쓰던 자리
  //  (풀러(피홈)는 칼날 지오메트리에 새겨져 있다 — weapon_looks.js)
  decorate(group, look) {
    const mat = metalMat(look.hilt, { rough: 0.34 });
    const base = this.hiltLength;
    const ricY = base + 0.02;
    const leather = new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.9 });
    const wrap = addMesh(group, new THREE.BoxGeometry(0.06, 0.1, 0.022), leather, [0, ricY + 0.06, 0]);
    wrap.castShadow = true;
    for (const s of [-1, 1]) {
      const hook = addMesh(group, new THREE.ConeGeometry(0.008, 0.04, 8), mat, [s * 0.045, ricY + 0.13, 0]);
      hook.rotation.z = -s * 0.9; // 코등이 평면(x) 바깥으로, 칼끝 쪽으로 비스듬히
      hook.castShadow = true;
    }
  },
});

// ═════════════════════════════════════════════════════════════
//  5) 에스톡 (튜크, 갑옷 찌르기 전용) — Cleveland Museum 1.6kg·칼날 125.3cm,
//     Met 1.616kg·칼날 106.9cm [M]. 균형점 자료 없음(연구 노트 §14) → 뻣뻣하고
//     테이퍼가 적은 각진 칼날이라 무게중심이 롱소드보다 앞쪽이라고 추정 [I]
// ═════════════════════════════════════════════════════════════
const estoc = finalizeSpec('estoc', {
  nameKo: '에스톡 (찌르기검)', nameEn: 'Estoc',
  desc: '갑옷 틈을 파고드는 찌르기검.\n찌르기로 싸워야 제값을 한다.',
  grip: 'hand-and-half', material: 'steel',
  hiltLength: 0.14, bladeLength: 1.15, gripAlong: -0.15,
  mCut: 0.55, mThrust: 1.35, mBlunt: 0.9, // 날이 거의 없어 베기는 약하고, 갑옷 틈을 노리는 찌르기는 뛰어나다
  thrustStyle: THRUST_STYLE.estoc,
  // 각진(사각/육각) 뻣뻣한 단면 — 실제 에스톡처럼 날이 아니라 뻣뻣한 각진 봉 느낌으로.
  partMesh: swordKit({
    blade: { edge: 'double', width: (t) => 1 - 0.4 * t, thick: 0.0085, bevel: 0, tip: 'needle', tipLen: 0.14 },
    grip: { style: 'cord' },
    pommel: { style: 'scent' },
    guard: { style: 'bar' },
  }),
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.14, 0.019, 0.12, 0.019);
    // 균형 재분배: 무승부투성이(13/24)의 근본 원인이 굼뜬 칼끝(칼날 0.84kg, 손 기준 관성 ~0.40)이라,
    // 총중량(1.6kg)은 지키고 칼날을 가볍게 해 그 몫을 폼멜로 옮긴다 — 실물 에스톡도 좁은 단면
    // 칼날에 유난히 큰 폼멜로 손 쪽에 균형을 모은 물건이다.
    const pommel = sphereInertia(0.6, 0.032);
    const cross = boxInertia(0.14, 0.1, 0.015, 0.02);
    const blade = bladeInertia(0.72, L, 0.42, 0.27, 0.022, 0.022); // 각진(사각/육각) 단면: 폭≈두께
    return [
      partTuple(['box', 0.019, 0.12, 0.019], 0, 0.14, 0, grip.Ie, grip.It, look.grip),
      partTuple(['ball', 0.032], -0.13, 0.6, 0, pommel.Ie, pommel.It, look.hilt),
      partTuple(['box', 0.1, 0.015, 0.02], 0.125, 0.14, 0, cross.Ie, cross.It, look.hilt),
      partTuple(['box', 0.011, L / 2, 0.011], 0.14 + L / 2, 0.72, blade.comY, blade.Ie, blade.It, 0xc7ccd2, true),
    ];
  },
});

// ═════════════════════════════════════════════════════════════
//  6) 세이버 (1796년 영국 경기병도) — 실전 원본 0.9~1.08kg, 칼날 82.6~84cm,
//     균형점 18.4~22cm(코등이에서, 곡도라 앞쪽으로 쏠림) [M]
// ═════════════════════════════════════════════════════════════
const sabre = finalizeSpec('sabre', {
  nameKo: '세이버 (기병도)', nameEn: 'Cavalry Sabre',
  desc: '가볍게 휘어진 기병의 한손 칼.\n빠르게 베고 빠지기 좋다.',
  grip: 'one-hand', material: 'steel',
  enterParry: true, // 들어가며 막기 (10라운드 R3, skill.js): 상대 칼을 받아 낸 순간 한 걸음 안쪽으로 — 짧은 한손 칼
  hiltLength: 0.11, bladeLength: 0.83,
  // 감독 확정 컨셉: 가장 가볍고 빠른 곡도, 베기 전용 — 찌르기는 약하고(0.7) 손목이 조금 더 빨리 돈다(34).
  //  굽은 날의 베기 효율은 물리 모델이 다 담지 못해 mCut 으로 보정. 팔쉬온(무거운 반달칼)과 확실히 갈린다.
  mCut: 1.25, mThrust: 0.7, mBlunt: 0.9,
  controlOverrides: { wristVmax: 34 },
  // 기병도 특유의 곡도 + 외날 쐐기 단면 — 연구 세션의 튜브 곡날(끝이 콜라이더보다 8cm 앞으로 휘고,
  // metalness 0.9 라 envMap 없는 이 장면에서 새까만 막대로 보이는 문제)을 화면 확인 후 "콜라이더 ~1cm 안"
  // 약속에 맞는 곡날 메쉬로 되돌렸다. 손등 가리개(나크본) 고리는 연구 세션 디자인 그대로 유지.
  partMesh: swordKit({
    blade: { edge: 'single', width: (t) => 1 - 0.18 * t, thick: 0.0038, curve: 0.012, tip: 'clip', tipLen: 0.12, overshoot: 0.008 },
    grip: { style: 'wire' },
    pommel: { style: 'cap' },
    guard: { style: 'block' },
  }),
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.11, 0.017, 0.06, 0.017);
    const pommel = sphereInertia(0.16, 0.02);
    const cross = boxInertia(0.05, 0.04, 0.01, 0.013);
    const blade = bladeInertia(0.63, L, 0.46, 0.24, 0.032, 0.009);
    return [
      partTuple(['box', 0.017, 0.06, 0.017], 0, 0.11, 0, grip.Ie, grip.It, look.grip),
      partTuple(['ball', 0.02], -0.08, 0.16, 0, pommel.Ie, pommel.It, look.hilt),
      partTuple(['box', 0.04, 0.01, 0.013], 0.09, 0.05, 0, cross.Ie, cross.It, look.hilt),
      partTuple(['box', 0.016, L / 2, 0.0045], 0.11 + L / 2, 0.63, blade.comY, blade.Ie, blade.It, 0xd2d8dd, true),
    ];
  },
  decorate(group, look) {
    // 손등 가리개(나크본) 고리 (연구 세션 디자인, 물리 무관)
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.005, 8, 20, Math.PI), metalMat(look?.hilt ?? 0x8a7a5a, { rough: 0.4 }));
    guard.position.set(0, 0.035, 0.02);
    guard.rotation.set(0, Math.PI / 2, Math.PI / 2);
    guard.castShadow = true;
    group.add(guard);
  },
});

// ═════════════════════════════════════════════════════════════
//  7) 레이피어 — Albion "Munich" rapier 1.56kg·칼날 83.5cm·균형점 6cm(코등이 바로 앞,
//     화려한 컵 힐트가 무게추 역할) [M]. 좀 더 가벼운 버전(1.1kg급)으로 잡는다 [I]
// ═════════════════════════════════════════════════════════════
const rapier = finalizeSpec('rapier', {
  nameKo: '레이피어', nameEn: 'Rapier',
  desc: '길고 가는 르네상스 결투검.\n가장 빨리 찌르지만 베기는 약하다.',
  grip: 'one-hand', material: 'steel',
  tier: 'rare', // 감독 확정: 레어 — 르네상스 결투검, 로스터 유일의 찌르기 전용. power 1.05, 파손 계수 0.032
  hiltLength: 0.1, bladeLength: 0.95,
  mCut: 0.5, mThrust: 1.3, mBlunt: 0.7,
  thrustStyle: THRUST_STYLE.rapier,
  // 가늘고 뻣뻣한 다이아몬드(마름모) 단면 — 찌르기 전용 칼답게 폭이 좁고 끝으로 갈수록 더 가늘어진다.
  partMesh: swordKit({
    blade: { edge: 'double', width: (t) => 1 - 0.4 * t, thick: 0.0045, bevel: 0.0015, tip: 'needle', tipLen: 0.12 },
    grip: { style: 'wire' },
    pommel: { style: 'pear' },
    guard: { style: 'cup' },
  }),
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.08, 0.014, 0.055, 0.014);
    const pommel = sphereInertia(0.09, 0.018);
    const cup = sphereInertia(0.55, 0.05); // 컵 힐트: 손을 덮는 둥근 방패
    const blade = bladeInertia(0.38, L, 0.3, 0.24, 0.018, 0.012); // 가늘고 뻣뻣한(다이아몬드 단면) 찌르기 전용
    return [
      partTuple(['box', 0.014, 0.055, 0.014], 0, 0.08, 0, grip.Ie, grip.It, look.grip),
      partTuple(['ball', 0.018], -0.07, 0.09, 0, pommel.Ie, pommel.It, look.hilt),
      partTuple(['ball', 0.05], 0.06, 0.55, 0, cup.Ie, cup.It, look.hilt),
      partTuple(['box', 0.009, L / 2, 0.006], 0.1 + L / 2, 0.38, blade.comY, blade.Ie, blade.It, 0xdfe4e8, true),
    ];
  },
  // 컵 힐트 위에 스웹트 힐트(swept-hilt) 느낌의 가는 고리들을 더해 손을 감싸는 바구니 모양으로.
  decorate(group, look) {
    const mat = metalMat(look.hilt, { rough: 0.34 });
    for (const a of [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2]) {
      const bar = addMesh(group, new THREE.TorusGeometry(0.05, 0.0035, 6, 12, Math.PI * 0.6), mat, [0, -0.02, 0]);
      bar.rotation.y = a;
      bar.rotation.z = Math.PI / 2.3;
      bar.castShadow = true;
    }
  },
});

// ═════════════════════════════════════════════════════════════
//  8) 팔쉬온 — Thorpe falchion(13세기 원본) 0.904kg·칼날 80.3cm [M]. 균형점 자료 없음
//     → 넓고 앞이 무거운 외날 반달칼 형태라 무게중심이 앞쪽이라고 추정 [I]
// ═════════════════════════════════════════════════════════════
const falchion = finalizeSpec('falchion', {
  nameKo: '팔쉬온 (반달칼)', nameEn: 'Falchion',
  desc: '끝이 넓고 무거운 외날 칼.\n내려찍듯 베면 도끼처럼 들어간다.',
  grip: 'one-hand', material: 'steel',
  enterParry: true, // 들어가며 막기 (10라운드 R3, skill.js): 상대 칼을 받아 낸 순간 한 걸음 안쪽으로 — 짧은 한손 칼
  hiltLength: 0.1, bladeLength: 0.8,
  // 감독 확정 컨셉: 앞이 무거운 반달칼, "도끼 같은 칼" — 횟수는 적어도 한 방이 무겁고 투구 위로도 충격(mBlunt 1.4),
  //  베기 효율은 세이버보다 낮게(1.15), 찌르기는 거의 없다(0.6). 세이버(빠른 곡도)와 확실히 갈린다.
  mCut: 1.15, mThrust: 0.6, mBlunt: 1.4,
  // 기술 간격(TECH[].reach) 자동 보정을 이 무기만 끈다 — 다가서는 시간 계산이 빡빡해져 공격을 걸다
  // 물러서기를 반복하는 회귀(2라운드에서 확인, src/ai.js reachScale 주석).
  techReachScale: 1,
  // 넓은 앞날 반달칼: 등은 곧고, 날은 자루 쪽 3.7cm 폭에서 칼끝 쪽 7cm 폭까지 불룩하게 넓어지다가 반달 호를
  //  그리며 등 쪽 꼭짓점으로 올라간다(연구 세션 decorate 윤곽을 따름). 두께가 있는 쐐기 단면 + 날 세움 면이라
  //  예전 압출 평판보다 칼답게 빛난다. 날 쪽이 콜라이더(±3cm)를 최대 ~1cm 넘는다.
  partMesh: swordKit({
    blade: {
      edge: 'single',
      backX: () => -0.022,
      edgeX: (t) => -0.022 + 0.037 + 0.035 * t ** 1.4,
      thick: 0.0036,
      tip: 'kissaki',
      apex: -0.8,
      tipLen: 0.17,
    },
    grip: { style: 'leather' },
    pommel: { style: 'disc' },
    guard: { style: 'bar' },
  }),
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.08, 0.018, 0.06, 0.018);
    const pommel = sphereInertia(0.16, 0.022);
    const cross = boxInertia(0.05, 0.06, 0.012, 0.016);
    const blade = bladeInertia(0.614, L, 0.4, 0.26, 0.05, 0.007); // 끝으로 갈수록 넓어지는 칼날
    return [
      partTuple(['box', 0.018, 0.06, 0.018], 0, 0.08, 0, grip.Ie, grip.It, look.grip),
      partTuple(['ball', 0.022], -0.08, 0.16, 0, pommel.Ie, pommel.It, look.hilt),
      partTuple(['box', 0.06, 0.012, 0.016], 0.09, 0.05, 0, cross.Ie, cross.It, look.hilt),
      partTuple(['box', 0.03, L / 2, 0.005], 0.1 + L / 2, 0.614, blade.comY, blade.Ie, blade.It, 0xd4dae0, true),
    ];
  },
});

// ═════════════════════════════════════════════════════════════
//  9) 모노호시자오 (物干し竿, '빨랫줄 장대', 옛 id 'katana') — 사사키 코지로의 칼. 감독 결정으로 카타나를 에픽 등급의
//     긴 노다치로 바꿨다: 칼날 3척(약 90cm) 넘는 장검이라는 전승 [I]-leaning. 제원은 카타나 자료(나가사 70~74cm,
//     1.0~1.3kg)에서 칼날을 0.90m 로 늘리고 총질량 1.15kg(칼날 0.85)으로 잡았다 [D] — 0.95kg 칼날로는 롱소드 상대 4~8%라
//     가볍게 잡고 손목 속도 34 를 줬다(18%). 두손·긴 자루(츠카 25cm).
//     에픽(power 1.1)이 곱해지므로 mCut 은 1.85 → 1.5 로 내려 실효 베기 배율 ≈ 1.65 (옛 카타나 1.85 보다 조금 낮다).
//     코지로의 '츠바메가에시'는 칼 이름이 아니라 기술 이름.
// ═════════════════════════════════════════════════════════════
const monohoshizao = finalizeSpec('monohoshizao', {
  nameKo: '모노호시자오', nameEn: 'Monohoshizao',
  desc: '사사키 코지로의 노다치.\n빨랫줄 장대라 불린 칼, 매섭게 벤다.',
  grip: 'two-hand', material: 'steel',
  school: 'japanese', // 유파(schools.js TRADITIONS): 틀은 앞무게(이베리아가 기본)지만 일본 도검술 — 10/8 ① 구조 (일본 유파는 아직 이베리아와 같은 내용의 자리만)
  tier: 'epic',
  ability: '제비 베기: 출혈',
  // 동작 라이브러리(motion_library.js, 기본 꺼짐)의 앞무게 자세표에서 상단(上段)은 쓰지 않는다: 긴 자루·앞무게 칼이 칼끝을 뒤로 눕힌
  //  상단에서 빠르게 내리면 날이 서지 않는다(날 세움 0~0.7) → 실제 싸움 48판 31% (상단 빼면 46%, 라이브러리 끔 50%). 지붕 자세 그대로
  motionSkip: ['지붕 (Vom Tag)'],
  bleedMult: 2, // 에픽 특수 능력 '제비 베기: 출혈' (사장님 b안): 이 칼에 베이고 찔린 상처의 출혈 ×2 (롱소드 상대 ×1 38% · ×1.5 44% · ×2 50%, 48판씩 — 에픽 폭 45~65% 안)
  hiltLength: 0.25, bladeLength: 0.9, gripAlong: -0.22,
  mCut: 1.7, mThrust: 0.85, mBlunt: 0.95, // 1.5 로는 롱소드 상대 4% (긴 칼이라 간격에서 이기지 못한다) → 1.7 (실효 1.87)
  controlOverrides: { aimStiffness: 70, wristVmax: 34 },
  // 노다치: 살짝 휜 긴 곡도, 등마루(시노기)가 등 쪽에 선 단면, 날 쪽의 흰 물결 담금질 무늬(하몬), 둥글게 올라가는
  //  키사키 칼끝. 흰 상어가죽 츠카(비단 끈은 decorate), 쇠 츠바, 카시라.
  partMesh: swordKit({
    blade: { edge: 'single', width: (t) => 1 - 0.28 * t, thick: 0.0035, ridge: 0.3, hamon: true, curve: 0.008, tip: 'kissaki', tipLen: 0.055, overshoot: 0.008 },
    grip: { style: 'plain', color: 0xe8e2d0 },
    pommel: { style: 'cap', color: 0x2b2e33 },
    guard: { style: 'disc', color: 0x2b2e33 },
  }),
  buildParts(look) {
    const L = this.bladeLength;
    // 균형 재분배 (밸런스 시뮬로 확인한 근본 원인 — 3라운드 카타나와 같은 처방): 칼날 0.85kg(총중량의 74%)이
    //  0.9m 끝까지 실려 손 기준 휘두름 관성이 커서, 긴 칼인데 늦게 돌아 간격 싸움에서 진다(13%).
    //  총중량(1.15kg)은 그대로 두고 칼날 0.72kg, 긴 츠카(목심+상어가죽+비단 끈, 실물 0.3kg대) 0.3kg,
    //  카시라 0.09kg 로 손 쪽에 무게를 옮긴다.
    const grip = boxInertia(0.3, 0.014, 0.14, 0.017); // 츠카: 길고 타원 단면
    const pommel = sphereInertia(0.09, 0.014); // 카시라(자루끝 마개)
    const cross = boxInertia(0.04, 0.04, 0.005, 0.04); // 츠바: 얇고 넓은 원반
    const blade = bladeInertia(0.72, L, 0.42, 0.25, 0.03, 0.007);
    return [
      partTuple(['box', 0.014, 0.14, 0.017], 0, 0.3, 0, grip.Ie, grip.It, look.grip),
      partTuple(['ball', 0.014], -0.2, 0.09, 0, pommel.Ie, pommel.It, look.hilt),
      partTuple(['box', 0.04, 0.005, 0.04], 0.24, 0.04, 0, cross.Ie, cross.It, look.hilt),
      partTuple(['box', 0.015, L / 2, 0.0035], 0.25 + L / 2, 0.72, blade.comY, blade.Ie, blade.It, 0xc1d3db, true), // 같은 에픽 청강검과 광도를 맞춘 강철색 (하몬은 꼭짓점 색으로 더 밝다)
    ];
  },
  // 에픽 명검의 세공 (전부 물리 무관, 콜라이더에서 ~1cm 안):
  //  - 둥근 츠바(철) + 가는 금 테두리, 칼날 밑동의 금빛 하바키(목띠)
  //  - 츠카: 검은 비단 끈(츠카이토)을 X 자로 엇갈려 감고 그 사이로 흰 상어가죽(사메) 마름모 — 긴 츠카가 노다치답게 읽힌다
  //  - 츠카는 콜라이더(±0.14m)보다 츠바 쪽 9cm·카시라 쪽 5cm 더 길게 그린다: 콜라이더대로만 그리면 자루와
  //    츠바·카시라 사이가 비어 부품이 공중에 떠 보였다(자루 부분이라 판정 영향 없음). 츠바 쪽 끝에 쇠 테(후치).
  decorate(group) {
    const iron = metalMat(0x2b2e33, { rough: 0.45 });
    const gold = metalMat(0xc9a14a, { rough: 0.22 });
    const rim = addMesh(group, new THREE.TorusGeometry(0.0455, 0.0026, 8, 32), gold, [0, 0.24, 0]);
    rim.rotation.x = Math.PI / 2;
    const habaki = addMesh(group, new THREE.BoxGeometry(0.034, 0.03, 0.011), gold, [0, 0.262, 0]); // 칼날 밑동을 감싼다
    habaki.castShadow = true;
    const silk = new THREE.MeshStandardMaterial({ color: 0x1b1d2e, roughness: 0.85 });
    const same = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.7 });
    for (const [yc, h] of [[0.186, 0.092], [-0.168, 0.056]]) {
      const ext = addMesh(group, new THREE.CylinderGeometry(0.0132, 0.0132, h, 14), same, [0, yc, 0]); // 츠카 연장 (츠바 쪽·카시라 쪽)
      ext.scale.z = 1.2;
      ext.castShadow = true;
    }
    const fuchi = addMesh(group, new THREE.CylinderGeometry(0.0148, 0.0148, 0.008, 14), iron, [0, 0.231, 0]);
    fuchi.scale.z = 1.2;
    // 츠카이토: 납작한 비단 끈이 앞뒤 면에서 X 자로 엇갈려 감기고, 엇갈린 사이사이로 흰 사메가 마름모꼴로 드러난다
    //  (고리 모양으로 감으면 장난감처럼 보였다). 옆면에서는 끈이 꺾여 넘어가는 매듭이 보인다. 끈 48 · 매듭 24 상자가 메쉬 하나
    addTsukaIto(group, silk, -0.178);
  },
});

// ═════════════════════════════════════════════════════════════
//  9b) 우치가타나 (打刀, uchigatana) — 보통 크기 카타나 (커먼). 10/9 카타나·劍 로스터 제안서
//      (docs/weapons/katana_jian_roster_proposal_2026-10-09.md §2-2) 의 스펙 초안 그대로 넣은 **제안 가지** 무기다
//      (사장님 확인 전 — docs/weapons/uchigatana_proposal_2026-10-09.md).
//      허리띠에 날을 위로 꽂는 칼. 에도 정치수 약 70 cm, 흔한 실물 칼날 68~73 cm·휨 1.5~2 cm·츠카 단 채 1.1~1.4 kg [원전 2차 요약].
//      칼날 0.71 m·총 1.10 kg (츠카 0.26 · 카시라 0.06 · 츠바 0.12 · 칼날 0.66, 칼날 무게중심 0.40) [추정 — 위 범위 안에서]
//      → 무게중심 손에서 0.338 m, 관성 0.221 (롱소드 0.272 보다 가볍게 돈다) = 자동으로도 두손 보통(two)이지만,
//      80 cm 명도가 앞무게 경계(관성 0.3)에 걸리므로 카타나 가족은 frame 'two' 를 직접 적어 고정한다(제안서 §0-3).
//      방식은 두루(찌르기 0.9 > 0.85) — 일본 가중치(two:* 真向 ×1.3 · 袈裟 ×1.2 · 胴 ×0.8 · 突き ×0.8)가 처음 일하는 무기.
//      겉모습은 모노호시자오의 칼 꼴(외날·시노기·하몬·키사키)을 칼날 0.71 m 로 그대로 쓰고, 금 장식을 뺀 커먼 마감.
// ═════════════════════════════════════════════════════════════
const uchigatana = finalizeSpec('uchigatana', {
  nameKo: '우치가타나', nameEn: 'Uchigatana',
  desc: '무사가 허리에 꽂던 보통 크기의 카타나.\n한 칼에 내려벤다.',
  grip: 'two-hand', material: 'steel',
  school: 'japanese', // 일본 유파: 이름표·가중치(two:*)·고유 동작·패시브를 traditionOf 로 받는다
  frame: 'two', // 경계 고정 (제안서 §0-3: 카타나 가족이 무게 몇십 g 차이로 앞무게로 넘어가지 않게)
  style: 'versatile', // 두루 (제안서 §7-2 권고) — 자동 판정도 두루지만 가족 안에서 묶으려고 적는다
  tier: 'common',
  strayPick: false, // 브란이 '주워 온 커먼 칼'(characters.js shortest_common) 후보에서 뺀다 — 칼날 0.71 m 로 가장 짧아 팔쉬온 자리를 빼앗기 때문 (사장님 확인 전)
  hiltLength: 0.25, bladeLength: 0.71, gripAlong: -0.2,
  mCut: 1.2, mThrust: 0.9, mBlunt: 0.95,
  partMesh: swordKit({
    blade: { edge: 'single', width: (t) => 1 - 0.28 * t, thick: 0.0035, ridge: 0.3, hamon: true, curve: 0.008, tip: 'kissaki', tipLen: 0.05, overshoot: 0.008 },
    grip: { style: 'plain', color: 0xe8e2d0 },
    pommel: { style: 'cap', color: 0x2b2e33 },
    guard: { style: 'disc', color: 0x2b2e33 },
  }),
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.26, 0.014, 0.13, 0.017); // 츠카
    const pommel = sphereInertia(0.06, 0.014); // 카시라
    const cross = boxInertia(0.12, 0.04, 0.005, 0.04); // 츠바 (커먼 철 츠바라 모노호시자오보다 무겁다)
    const blade = bladeInertia(0.66, L, 0.4, 0.26, 0.03, 0.007);
    return [
      partTuple(['box', 0.014, 0.13, 0.017], 0, 0.26, 0, grip.Ie, grip.It, look.grip),
      partTuple(['ball', 0.014], -0.15, 0.06, 0, pommel.Ie, pommel.It, look.hilt),
      partTuple(['box', 0.04, 0.005, 0.04], 0.24, 0.12, 0, cross.Ie, cross.It, look.hilt),
      partTuple(['box', 0.015, L / 2, 0.0035], 0.25 + L / 2, 0.66, blade.comY, blade.Ie, blade.It, 0xc9d1d6, true),
    ];
  },
  // 커먼 마감 (물리 무관, 콜라이더에서 ~1cm 안): 모노호시자오의 츠카 꼴(검은 비단 끈 X 감기 + 흰 사메)·츠카 연장·후치를 같은 식으로,
  //  금 테두리는 없고 하바키는 구리. 츠카 연장 = 콜라이더(±0.13)와 츠바(0.24)·카시라(-0.15) 사이
  decorate(group) {
    const iron = metalMat(0x2b2e33, { rough: 0.45 });
    const copper = metalMat(0xa0623a, { rough: 0.35 });
    const habaki = addMesh(group, new THREE.BoxGeometry(0.034, 0.03, 0.011), copper, [0, 0.262, 0]);
    habaki.castShadow = true;
    const silk = new THREE.MeshStandardMaterial({ color: 0x1b1d2e, roughness: 0.85 });
    const same = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.7 });
    for (const [yc, h] of [[0.181, 0.102], [-0.135, 0.012]]) {
      const ext = addMesh(group, new THREE.CylinderGeometry(0.0132, 0.0132, h, 14), same, [0, yc, 0]);
      ext.scale.z = 1.2;
      ext.castShadow = true;
    }
    const fuchi = addMesh(group, new THREE.CylinderGeometry(0.0148, 0.0148, 0.008, 14), iron, [0, 0.231, 0]);
    fuchi.scale.z = 1.2;
    addTsukaIto(group, silk, -0.12); // 모노호시자오와 같은 끈 — 츠카가 짧아 카시라 쪽 첫 줄이 위다 (끈 40 · 매듭 20 상자가 메쉬 하나)
  },
});

// ═════════════════════════════════════════════════════════════
//  10) 청강검 (靑鋼劍, qinggang, 옛 id 'jian') — 랴오의 검. 감독 결정으로 지안(중국 검)을 에픽 등급 "청강검"으로
//      바꿨다(삼국지 조조의 보검 — "쇠도 진흙처럼 벤다"). 물리는 지안 자료 그대로: 0.8~0.9kg, 칼날 대개 70~80cm,
//      균형점 자료가 서로 어긋나(~10cm vs ~20cm) 절충 [I]-leaning. 한손이라 누르는 힘이 약하다(12N·m).
//      캐릭터 PM 계약: 가볍고 빠름·찌르기 강함(mThrust 1.15)·전설대로 잘 벰(전 mCut 1.35, 세이버·팔쉬온급 → 10/10 사장님 1.25 — 아래 칸 주석).
//      등급 epic(power 1.1·내구 0.95)이라 실제 베기 배율은 1.25×1.1 ≈ 1.38 (전 1.35×1.1 ≈ 1.49).
//      mCut 은 상처 깊이(severity)에만 곱하고 표시되는 타격 J(물리값, 롱소드의 2/3쯤)는 안 바꾼다.
//      겉모습은 푸른 강철 칼날에 검은 자루 [I] 창작. 'jian' 은 별칭으로 남긴다.
// ═════════════════════════════════════════════════════════════
// 옻칠한 검은 자루 + 차분한 청동(과하지 않은 금빛) 장식 — "전설의 명검"이되 요란하지 않게.
const QINGGANG_LOOK = { grip: 0x17171f, hilt: 0x8a6d3b };
const qinggang = finalizeSpec('qinggang', {
  nameKo: '청강검', nameEn: 'Qinggang Sword',
  desc: '쇠도 진흙처럼 벤다던 전설의 검.\n가볍고 빠른 한손 양날검.',
  grip: 'one-hand', material: 'steel',
  school: 'chinese', // 유파(schools.js TRADITIONS): 틀은 한손 두루(독일이 기본)지만 劍 — 10/8 ① 구조 (중국 유파 = 전 지안 꾸러미 그대로)
  enterParry: true, // 들어가며 막기 (10라운드 R3, skill.js): 상대 칼을 받아 낸 순간 한 걸음 안쪽으로 — 짧은 한손 칼
  tier: 'epic',
  ability: '창천: 무기 절단',
  fragility: TIER_FRAGILITY.epic * 0.5, // 특수 능력 (사장님, 카드 표기 없음): 자기가 부러질 확률 50% 감소 (에픽 0.0104 → 0.0052)
  breakMult: 3, // 에픽 특수 능력 '창천: 무기 절단' (사장님): 칼끼리 부딪힐 때 상대 무기가 부러질 확률 ×3 (안 부러지는 무기는 그대로 0)
  hiltLength: 0.12, bladeLength: 0.74,
  // mCut 1.35 → 1.25 (사장님 10/10 20:4x '청강검 베기 배율 너무 높네 … 조금만 낮추자. 롱소드보단 높게'): 무기 절단(breakMult — 칼끼리 닿을 때 상대 칼이 부러질 확률)과
  //  베기 배율(mCut — 상처 깊이 배율)은 별개라 능력은 그대로 두고 배율만. 등급을 곱하면 1.1 × 1.25 ≈ 1.38 (롱소드 1.0 위 · 레전드 간장·막야 1.2 × 1.25 = 1.5 아래 — 등급 순서). 확인표 770
  mCut: 1.25, mThrust: 1.15, mBlunt: 0.95,
  // 곧은 양날에 가운데 등마루(지안 특유의 검등 능선), 칼몸은 거의 평행하다가 짧은 창끝으로 모인다.
  //  옻칠 자루(끈 감기), 청동 원반 폼멜. 코등이는 decorate 의 마름모 호심.
  partMesh: swordKit({
    blade: { edge: 'double', width: (t) => 1 - 0.25 * t, thick: 0.0034, tip: 'spear', tipLen: 0.075 },
    grip: { style: 'cord' },
    pommel: { style: 'disc' },
    guard: { style: 'none' },
  }),
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.1, 0.015, 0.09, 0.015);
    const pommel = sphereInertia(0.1, 0.02);
    const cross = boxInertia(0.04, 0.035, 0.008, 0.012);
    const blade = bladeInertia(0.61, L, 0.36, 0.25, 0.028, 0.009);
    return [
      partTuple(['box', 0.015, 0.09, 0.015], 0, 0.1, 0, grip.Ie, grip.It, QINGGANG_LOOK.grip),
      partTuple(['ball', 0.02], -0.09, 0.1, 0, pommel.Ie, pommel.It, QINGGANG_LOOK.hilt),
      partTuple(['box', 0.035, 0.008, 0.012], 0.11, 0.04, 0, cross.Ie, cross.It, QINGGANG_LOOK.hilt),
      partTuple(['box', 0.014, L / 2, 0.0045], 0.12 + L / 2, 0.61, blade.comY, blade.Ie, blade.It, 0xc4dbe1, true), // 푸른 강철(청강) — 같은 에픽 모노호시자오와 광도를 맞춤
    ];
  },
  // 청강검 장식 (전부 물리 무관, 콜라이더에서 ~1cm 안): 중국 명검의 어법으로 "곱되 요란하지 않게".
  //  - 마름모꼴 호심(護心) 코등이 + 칼날 밑동을 감싸는 청동 목띠(吞口)
  //  - 옻칠 자루에 가는 청동 선(꼰 줄) 두 가닥
  //  - 폼멜 원반 + 붉은 검수(劍穗)는 그대로 (지안의 상징)
  decorate(group, look) {
    const bronze = metalMat(QINGGANG_LOOK.hilt, { rough: 0.28 });
    // 호심 코등이: 납작 마름모 (물리 콜라이더는 그대로 상자)
    const flourish = addMesh(group, new THREE.OctahedronGeometry(0.03, 0), bronze, [0, 0.11, 0]);
    flourish.scale.set(1, 0.32, 0.55);
    flourish.castShadow = true;
    // 탄커우(吞口): 칼날 밑동을 한 뼘 감싸는 청동 목띠 — 명검의 "세공" 포인트
    const collar = addMesh(group, new THREE.CylinderGeometry(0.012, 0.014, 0.035, 8), bronze, [0, 0.145, 0]);
    collar.scale.set(1.15, 1, 0.55); // 칼날 단면(넓고 얇음)에 맞춰 눌러 준다
    collar.castShadow = true;
    // 자루의 가는 청동 선 두 가닥 (옻칠 위 상감 느낌)
    for (const y of [0.035, 0.075]) {
      const ring = addMesh(group, new THREE.TorusGeometry(0.0165, 0.0022, 6, 14), bronze, [0, y, 0]);
      ring.rotation.x = Math.PI / 2;
    }
    // 붉은 검수(劍穗): 검 끝이 아니라 자루 끝에 매다는 술
    const cordMat = new THREE.MeshStandardMaterial({ color: 0x7a1414, roughness: 0.9 });
    const tuftMat = new THREE.MeshStandardMaterial({ color: 0xb01818, roughness: 0.95 });
    const cord = addMesh(group, new THREE.CylinderGeometry(0.004, 0.004, 0.09, 6), cordMat, [0, -0.14, 0]);
    cord.castShadow = true;
    addMesh(group, new THREE.SphereGeometry(0.018, 8, 6), tuftMat, [0, -0.185, 0]);
  },
});

// (옛 11 '환두대도' 는 감독 결정으로 삭제 — 세이버·팔쉬온과 겹쳤다. 'hwandudaedo' 는 별칭으로 롱소드를 가리킨다.)

// ═════════════════════════════════════════════════════════════
//  12) 엑스칼리버 — 전설의 검. 롱소드 가문의 비율을 그대로 쓰되(완벽한 균형이라는
//      설정), 실전 성능은 확실히 세지만 절대적이지 않게(밸런스 시뮬로 검증) [I] 창작
// ═════════════════════════════════════════════════════════════
// 엑스칼리버 진품·복제품은 겉모습이 완전히 같아야 한다(플레이어가 눈으로 구분할 수 없게) — 모양·
// 치수·색을 하나의 buildParts/decorate로 공유하고, 진품에만 칼날 오라를 덧붙인다. 성능(배율·질량)
// 차이는 buildParts를 부르는 쪽(mCut 등)에서만 갈라 눈에는 안 보이게 한다.
function excaliburParts(look) {
  const L = this.bladeLength;
  const grip = boxInertia(0.14, 0.019, 0.1, 0.019);
  const pommel = sphereInertia(0.36, 0.032); // 보석 박힌 폼멜
  const cross = boxInertia(0.15, 0.115, 0.016, 0.024);
  const blade = bladeInertia(0.7, L, 0.34, 0.253, 0.05, 0.016);
  return [
    partTuple(['box', 0.019, 0.1, 0.019], 0, 0.14, 0, grip.Ie, grip.It, 0x2a2440),
    partTuple(['ball', 0.032], -0.13, 0.36, 0, pommel.Ie, pommel.It, 0xf2c94c),
    partTuple(['box', 0.115, 0.016, 0.024], 0.115, 0.15, 0, cross.Ie, cross.It, 0xf2c94c),
    partTuple(['box', 0.025, L / 2, 0.008], 0.13 + L / 2, 0.7, blade.comY, blade.Ie, blade.It, 0xeef3f8, true),
  ];
}
// 넓은 양날에 긴 피홈, 창끝 칼끝. 보랏빛 가죽 자루, 금 바퀴형 폼멜, 끝이 칼날 쪽으로 굽은 금 코등이.
const excaliburPartMesh = swordKit({
  blade: { edge: 'double', width: (t) => 1 - 0.38 * t, thick: 0.0045, tip: 'spear', tipLen: 0.11, fuller: { to: 0.62, width: 0.2, depth: 0.5 } },
  grip: { style: 'cord' },
  pommel: { style: 'wheel' },
  guard: { style: 'curved' },
  metal: 0xf2c94c,
});
// 보석 박힌 황금 코등이·폼멜 — 작은 보석 알을 몇 개 박아 "전설의 검"답게 (둘 다 똑같이 박혀 있다).
//  보석은 바퀴형 폼멜의 두 면·코등이 두 팔의 앞뒤 면에 반쯤 박힌다 (예전 위치는 새 폼멜·코등이 속에 묻히거나 떠 있었다).
function excaliburGems(group) {
  const gems = [
    { color: 0xd63b3b, pos: [0, -0.13, 0.0165], r: 0.011 }, // 폼멜 앞면
    { color: 0xd63b3b, pos: [0, -0.13, -0.0165], r: 0.011 }, // 폼멜 뒷면
    { color: 0x2f6fd6, pos: [0.055, 0.115, 0.019], r: 0.008 }, // 코등이 오른팔 앞
    { color: 0x2fa85a, pos: [-0.055, 0.115, 0.019], r: 0.008 }, // 코등이 왼팔 앞
    { color: 0x2f6fd6, pos: [0.055, 0.115, -0.019], r: 0.008 }, // 뒷면
    { color: 0x2fa85a, pos: [-0.055, 0.115, -0.019], r: 0.008 },
  ];
  for (const { color, pos, r } of gems) {
    const gem = addMesh(group, new THREE.OctahedronGeometry(r, 0), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.08, metalness: 0.1, envMap: weaponEnv(), envMapIntensity: 1.2 }), pos);
    gem.scale.z = 0.55;
    gem.castShadow = true;
  }
}

const excalibur = finalizeSpec('excalibur', {
  nameKo: '엑스칼리버', nameEn: 'Excalibur',
  desc: '금빛 기운이 감도는 진짜 왕의 검.',
  grip: 'two-hand', material: 'steel',
  tier: 'legend', // 감독 등급: 레전드 → power 1.2·durability 1.0. 진품은 플레이어 카드와 아르토리아(사장님 10/10 20:3x '진품 그대로') — 하인리히는 복제품
  hiltLength: 0.13, bladeLength: 1.0, gripAlong: -0.15,
  mCut: 1.2, mThrust: 1.2, mBlunt: 1.1,
  partMesh: excaliburPartMesh,
  buildParts: excaliburParts,
  decorate: excaliburGems, // 진품·복제품 겉모습은 완전히 같다 — 진품의 오라는 aura.js(attachAura)가 main.js에서 붙인다
});

// ═════════════════════════════════════════════════════════════
//  12b) 엑스칼리버 복제품 — 하인리히(characters.js)가 "진품"이라 우기며 드는 가짜. 겉모습은
//      진품과 완전히 똑같다(플레이어가 눈으로 구분할 수 없어야 한다는 요청) — 오직 전설의
//      힘(power 배율 없음)과 aura.js 오라가 없다는 점만 다르다. 등급은 커먼.
// ═════════════════════════════════════════════════════════════
const excaliburReplica = finalizeSpec('excalibur_replica', {
  nameKo: '엑스칼리버', nameEn: 'Excalibur', // 감독 지시: 화면에는 진품과 같은 이름 — 플레이어는 외관(빛나는 아우라 유무)만 보고 추측한다
  desc: '일단은 왕의 검 엑스칼리버, 라고 쓰여 있다.',
  grip: 'two-hand', material: 'steel',
  tier: 'common', // 제원·등급은 커먼 (power 1.0)
  finishTier: 'legend', // 겉면 마감만 진품과 동일 (등급 마감으로도 구분되면 안 된다 — 기운이 표식: 기운 = 레전드 등급의 표식, 이 복제품은 커먼이라 없다)
  hiltLength: 0.13, bladeLength: 1.0, gripAlong: -0.15,
  partMesh: excaliburPartMesh,
  buildParts: excaliburParts,
  decorate: excaliburGems,
});

// ═════════════════════════════════════════════════════════════
//  13) 라이트세이버 — 칼날은 거의 질량이 없는 플라스마(자루·이미터에 무게가 실린다).
//      쥐는 힘은 한 손 기준(gripType='one-hand')이라 물리 자체가 "가볍게 잘 돌지만
//      맞대면 무거운 칼에 밀린다"를 자연스럽게 만든다 — 별도 '이기는 판정' 없이
//      질량·관성만으로 밸런스를 만든다는 것이 설계 의도 [I] 창작
// ═════════════════════════════════════════════════════════════
const lightsaber = finalizeSpec('lightsaber', {
  nameKo: '라이트세이버', nameEn: 'Lightsaber', // 감독 최종: 고유 이름 없이 '라이트세이버' (에픽)
  desc: '먼 은하에서 온 빛의 칼.\n무게가 없어 맞대면 밀린다.', // 사장님 확정 문구
  // 두 손으로 쥔다 (무기 PM 결정, 사장님 "찾아보고 정해"): 영화의 기본 칼놀림(밥 앤더슨 안무 — 에페·검도 바탕)이 긴 자루를 두 손으로 쥐고
  //  크게 내려치는 쪽이다. 한 손 펜싱(마카시)은 휜 자루를 쓰는 특수한 유파. 자루(폼멜~이미터 0.27 m)도 두 손이 들어간다.
  //  바꿔도 롱소드 상대 승률은 그대로였다(ability_test 48판: 한 손 63% → 두 손 65%, 95% 구간 48~75 / 50~77)
  grip: 'two-hand', material: 'plasma',
  // 한손 자세표(칼 든 어깨를 앞으로)는 쓰지 않는다: 길고 가벼운 칼날이라 닿는 거리가 짧은 칼의 5배(+11cm 대 +2cm) 늘어
  //  롱소드 상대 승률이 55 → 75%로 에픽 목표(45~65%)를 넘었다 (10라운드 B, ref_duel). 영화처럼 두 손 자세로 겨눈다
  oneHandStance: false,
  tier: 'epic', // power 1.1 · 내구 0.95 (플라스마 칼날이라 어차피 안 부러진다)
  hiltLength: 0.15, bladeLength: 0.9,
  ability: '고온 플라스마: 갑옷 무시', // 에픽 특수 능력 (사장님) — ignoreArmor
  edged: true, ignoreArmor: true, mCut: 1.35, mThrust: 1.3,
  controlOverrides: { wristVmax: 36, aimDamping: 9 }, // 가볍고 매끄러운 이미터: 손목이 더 빨리 돌아간다
  // 플라스마 칼날은 각진 막대가 아니라 매끄러운 원기둥이어야 "에너지 칼날"답다. 자루는 홈이 파인 금속 원통,
  //  끝마개·이미터(칼날이 나오는 쇠 머리)는 어두운 금속.
  partMesh: swordKit({
    bladeMesh: (shape, color, matOpts) => curvedBlade((hx, hy, hz) => rodGeometry(hx, hy, hz, { sides: 18 }))(3, true, shape, color, matOpts),
    grip: { style: 'metal' },
    pommel: { style: 'cap' },
    guard: { style: 'block' },
  }),
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.25, 0.016, 0.11, 0.016);
    const pommel = sphereInertia(0.35, 0.018); // 배터리·이미터 쪽에 무게가 쏠린다
    const cross = boxInertia(0.05, 0.017, 0.01, 0.017);
    // 플라스마 기둥: 테이퍼가 없는 균일한 막대라 무게중심은 정확히 가운데(50%),
    //  회전반경은 균일봉 이론값(1/√12 ≈ 0.289)에 가깝다
    const blade = bladeInertia(0.12, L, 0.5, 0.289, 0.024, 0.024);
    return [
      partTuple(['box', 0.016, 0.11, 0.016], 0, 0.25, 0, grip.Ie, grip.It, look.metal ?? 0x9aa3ad),
      partTuple(['ball', 0.018], -0.12, 0.35, 0, pommel.Ie, pommel.It, 0x4a4f57),
      partTuple(['box', 0.017, 0.01, 0.017], 0.13, 0.05, 0, cross.Ie, cross.It, 0x2b2e33),
      partTuple(['box', 0.012, L / 2, 0.012], 0.15 + L / 2, 0.12, blade.comY, blade.Ie, blade.It, 0x3fa9f5, true),
    ];
  },
  // 칼날 바깥에 반투명한 빛기둥을 하나 더 둘러 "빛나는 칼날" 느낌을 낸다 (물리에는 영향 없음)
  decorate(group) {
    const L = this.bladeLength;
    const glow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, L, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x8fd4ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }),
    );
    glow.position.y = 0.15 + L / 2;
    group.add(glow);
  },
});

// ═════════════════════════════════════════════════════════════
//  14) 나뭇가지 — 아무 자료도 없다. 주워 든 막대기라는 설정대로 대충 만든 값 [I] 창작.
//      날이 없고(edged:false → 항상 둔기 판정), 세게 부딪히면 부러진다(breakChance 확률)
// ═════════════════════════════════════════════════════════════
const treeBranch = finalizeSpec('tree_branch', {
  nameKo: '나뭇가지', nameEn: 'Tree Branch',
  desc: '길에서 주운 나뭇가지. 날이 없다.\n세게 부딪히면 부러진다. 행운을 빈다.',
  grip: 'one-hand', material: 'wood',
  hiltLength: 0.15, bladeLength: 0.71, // 사장님 10/8 15:00 '지금보다 10 % 정도 짧게': 0.8 → 0.71 (전체 0.95 → 0.86 m, 질량 0.25 → 0.22 같은 굵기). 겉모습 yT(weapon_looks drawTreeBranch) 도 같이
  tier: 'trash', // 감독 등급: 쓰레기 → power 0.7·durability 0.4·fragility 0.2 (60초 경합에 60% 부러진다)
  edged: false, // 날이 없어 항상 둔기 판정 (총 타격 배율은 power 0.7)
  // 겉모습은 부품(자루·밑동·몸통 상자)마다 따로 그리지 않고 decorate 가 한 줄기로 통째로 그린다 — 따로 그리면
  //  사이가 떠서 세 토막으로 보였다. 껍질 골·이끼·옹이·꺾인 밑동·헝겊 손잡이·잔가지·잎 (weapon_looks.js drawTreeBranch)
  partMesh: hiddenParts,
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.05, 0.02, 0.08, 0.018);
    const pommel = sphereInertia(0.02, 0.015); // 뭉툭한 밑동
    const blade = bladeInertia(0.22, L, 0.55, 0.29, 0.036, 0.03); // 울퉁불퉁, 거의 균일한 막대 (0.25 → 0.22: 10/8 10 % 단축)
    return [
      partTuple(['box', 0.02, 0.08, 0.018], 0, 0.05, 0, grip.Ie, grip.It, 0x5a4530),
      partTuple(['ball', 0.015], -0.1, 0.02, 0, pommel.Ie, pommel.It, 0x5a4530),
      partTuple(['box', 0.018, L / 2, 0.015], 0.15 + L / 2, 0.22, blade.comY, blade.Ie, blade.It, 0x6b4423, false),
    ];
  },
  decorate(group) {
    drawTreeBranch(group);
  },
});

// ═════════════════════════════════════════════════════════════
//  15) 고무 치킨 — 장난 무기. 거의 무해하지만 부딪히는 느낌은 확실히 다르게(물렁하고
//      되튐이 낮다). 날이 없다 [I] 창작
// ═════════════════════════════════════════════════════════════
const rubberChicken = finalizeSpec('rubber_chicken', {
  nameKo: '고무 닭', nameEn: 'Rubber Chicken',
  desc: '누르면 삑 소리 나는 고무 닭.',
  grip: 'one-hand', material: 'rubber',
  tier: 'trash', fragility: 0.95, // 감독 확정: 장난 무기는 쓰레기 등급(power 0.7), 파손도 나뭇가지와 똑같이 — 충돌이 가벼워 계수는 더 높다 (60초 경합 76%)
  hiltLength: 0.1, bladeLength: 0.35,
  // 날이 없는 무기는 몸통·팔다리를 때려도 판정상 아무 효과가 없다(fighter.applyWound: 머리·목만
  // 기절 효과가 있다) → 고무 닭이 이길 수 있는 유일한 길은 머리를 맞히는 것뿐이라, mBlunt를
  // 크게 올려도 몸통 타격은 여전히 무해하고 "머리에 제대로 맞으면 그래도 어질하다"만 세진다.
  edged: false, mBlunt: 1.6, // 2.6 → 1.6: 사장님 10/8 14:50(둔타 계수 정리 — 참치 2.6 · 모르겐슈테른 1.6 · 고무 닭 1.6 · 나뭇가지 1)
  controlOverrides: { aimStiffness: 34 }, // 물렁해서 정확히 겨누기 어렵다 (토크는 양손 가정으로 22)
  // 겉모습: 두 다리를 쥐고 휘두르는 고무 닭 — 주먹 아래 발가락, 위로 오동통한 몸통·주름진 긴 목·벌린 부리의
  //  머리(칼끝 쪽). 부품마다 따로 그리지 않고 decorate 가 한 덩어리로 그린다 (weapon_looks.js drawRubberChicken)
  partMesh: hiddenParts,
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.05, 0.02, 0.05, 0.02); // 목 부분을 쥔다
    const pommel = sphereInertia(0.03, 0.02); // 다리 쪽
    const blade = bladeInertia(0.12, L, 0.5, 0.3, 0.06, 0.05); // 몸통+머리
    return [
      partTuple(['box', 0.02, 0.05, 0.02], 0, 0.05, 0, grip.Ie, grip.It, 0xf5d020),
      partTuple(['ball', 0.02], -0.08, 0.03, 0, pommel.Ie, pommel.It, 0xe8b830),
      partTuple(['box', 0.035, L / 2, 0.03], 0.1 + L / 2, 0.12, blade.comY, blade.Ie, blade.It, 0xf7d84a, false),
    ];
  },
  decorate(group) {
    drawRubberChicken(group);
  },
});

// ═════════════════════════════════════════════════════════════
//  16) 냉동 참치 — 두 번째 장난 무기. 얼린 통생선이라 은근히 묵직해서 맞으면 진짜
//      아프지만(mBlunt 높음), 쥐는 곳이 미끄러운 꼬리라 다루기 서투르다 [I] 창작
// ═════════════════════════════════════════════════════════════
const frozenTuna = finalizeSpec('frozen_tuna', {
  nameKo: '냉동 참치', nameEn: 'Frozen Tuna',
  desc: '얼어붙은 참치.\n절대 부서지지 않는다.',
  grip: 'two-hand', material: 'frozen',
  hiltLength: 0.15, bladeLength: 0.75, gripAlong: -0.17,
  // 날이 없어 몸통 타격은 무해하다(§고무 닭 주석) → 머리에 맞았을 때만 확실히 세게 만든다
  // mBlunt 2.2 → 2.8 (10라운드: hybrid 롱소드 상대 192판 12% → 17%, 모든 무기 목표 15~85%. 스펙 조정은 최소로)
  tier: 'mystery', // 사장님 결정: ??? 등급 (계수는 커먼 그대로, 카드에 드물게 나온다 — 등급 전체 5%)
  edged: false, mBlunt: 2.6, fragility: 0, // 감독 지시: 참치는 부러지지 않는다 (통째로 얼린 덩어리). mBlunt 2.8 → 2.6: 사장님 10/8 14:50(모르겐슈테른 1.6 과 함께 둔타 계수 정리)
  techReachScale: 1, // 짧고 둔한 무기의 다가서기 계산 완화 (메서·팔쉬온과 같은 근본 원인)
  controlOverrides: { aimStiffness: 46, maxAimTorque: 16 }, // 미끄러운 꼬리를 쥐고 있어 손아귀 힘이 잘 안 실린다 (한손·양손과 무관한 참치 고유 성질 — 연구 세션 스펙 그대로)
  // 겉모습: 꼬리자루를 쥔 참치 — 주먹 아래 초승달 꼬리, 칼끝 쪽 머리. 역그늘 색·노란 토막지느러미·서리와 얼음막.
  //  부품마다 따로 그리지 않고 decorate 가 한 덩어리로 그린다 (weapon_looks.js drawFrozenTuna)
  partMesh: hiddenParts,
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.15, 0.025, 0.12, 0.025); // 꼬리 쪽을 쥔다
    const pommel = sphereInertia(0.1, 0.03); // 꼬리지느러미
    const blade = bladeInertia(1.25, L, 0.45, 0.3, 0.1, 0.09); // 얼어붙은 몸통
    return [
      partTuple(['box', 0.025, 0.12, 0.025], 0, 0.15, 0, grip.Ie, grip.It, 0x8fa5b0),
      partTuple(['ball', 0.03], -0.15, 0.1, 0, pommel.Ie, pommel.It, 0x7d94a0),
      partTuple(['box', 0.05, L / 2, 0.045], 0.15 + L / 2, 1.25, blade.comY, blade.Ie, blade.It, 0xc3d8de, false),
    ];
  },
  decorate(group) {
    drawFrozenTuna(group);
  },
});

// ═════════════════════════════════════════════════════════════
//  17) 권총 — ??? 등급 (사장님, "재미 삼아 최소 비용으로"). 찌르기(탭)로 쏜다: 탄은 무한, 한 발 사이 2.5초. 쏘면 팔 동작으로 총구가 튄다.
//      총은 저절로 상대를 겨누며 몸 둘레를 느리게 흔들린다 — 총신 방향 레이저(탄 길)가 몸에 걸린 순간에 쏘는 것이 실력 (gun.js gunPose).
//      맞으면 늘 같은 세기(gun.js GUN.energy)의 찌르기 상처. 투구·판금은 막는 대신 그 자리에서 부서진다. 근접전 불가(날 없음·둔기 배율 0), 대신 발이 빠르다(moveMul).
//      부서지지 않는다. 칼처럼 쥐어 총신이 칼 축을 따라 앞으로 뻗는다 (겉모습 weapon_looks.js drawPistol)
// ═════════════════════════════════════════════════════════════
const pistol = finalizeSpec('pistol', {
  nameKo: '건슬링어의 리볼버', nameEn: "The Gunslinger's Revolver", // 사장님 확정 (스티븐 킹 《다크 타워》의 총잡이 롤랜드 — 총신을 엑스칼리버로 만들었다는 설정)
  desc: '어느 왕의 검을 녹여 총신을 만들었다.\n“검은 옷의 사내는 사막을 가로질러 달아났고, 총잡이는 그 뒤를 쫓았다.”', // 사장님 확정 문구
  grip: 'one-hand', material: 'steel', soundMaterial: 'steel',
  tier: 'mystery',
  gun: true, // gun.js: 찌르기 = 발사, 장전, AI 는 도망 다니며 쏜다
  // 손잡이가 칼 축에서 비켜 있으면 물리 엔진의 주관성축 순서가 바뀌어 fighter.js 가 칼날 축 관성(pI.y)으로 잡는 값이 25배 커지고
  //  날 세우기 힘이 과해져 몸체가 발산했다(잰 값: 비트는 배율 10.7). 직접 준다 (twistScale).
  // 손목 조준 감쇠 (사장님 '손이 수전증처럼 떨려'): 롱소드에 맞춘 aimDamping 11 은 이 가벼운 몸체(손 기준 휘두름 관성 0.009 kg·m²,
  //  롱소드 0.27)에 너무 세서 매 물리 스텝 감쇠 토크가 넘쳐 상한에 붙은 채 방향이 뒤집혔다 — 60 Hz 떨림 + 겨눔이 18° 비켜 섰다.
  //  0.8 부터 다시 떨고 0.35 아래는 12 Hz 울림이 남아 0.45. 놓아주기 감쇠(releaseDamping 1.5)도 같은 까닭으로 맞춘다
  controlOverrides: { twistScale: 0.25, aimDamping: 0.45, releaseDamping: 0.45 },
  moveMul: 1.2, // 걷는 최고 속도 ×1.2 (도망 다니며 쏘라고 — 사장님 '칼 들었을 때보다 30% 빠르게' → 9/29 '1.3배에서 1.4배로 상향' → 10/15 '지금 속도 조정 때문에 리볼버가 너무 강해짐. 이동속도 보너스를 +20%로' · 확인표 1636)
  fragility: 0, // 부서지지 않는다
  edged: false, mBlunt: 0, // 근접전 불가: 몸을 쳐도 상처·멍이 없다
  hiltLength: 0.05, bladeLength: 0.15, // 칼 원점(손)~총구 0.20 m (사장님: 머스킷처럼 길어 보여 짧은 권총으로 — 예전 0.32 m)
  partMesh: hiddenParts,
  buildParts(look) {
    // 손잡이: 총신에서 PISTOL_GRIP.deg(105°) 꺾여 아래(칼 몸체 +x)·뒤로 내려온다 — 그림(weapon_looks.js drawPistol)과 같은 치수.
    //  사장님: "손잡이를 그려야지 무게중심을 잘 맞추고" → 손잡이도 실제 콜라이더·무게를 가진다 (전엔 칼 축 위 일자 상자였다)
    const G = PISTOL_GRIP;
    const a = (G.deg * Math.PI) / 180;
    const dx = Math.sin(a), dy = Math.cos(a);
    const hx = G.len / 2, hy = 0.014, hz = 0.012; // 손잡이 상자: 긴 쪽이 부품 x 축
    const gm = 0.35;
    // 무게도 제자리에: 손잡이는 주먹(원점) 둘레, 몸통은 주먹 위 총신 축 — 총 무게중심이 주먹 조금 위·앞
    //  손잡이 자체 관성은 방향 없이(가장 큰 축 값으로 고르게) 준다 — 상자 그대로의 관성(긴 축만 작다)이면 가만히 있을 때 떨림이
    //  평균 2.4° → 4.6° 로 커졌다(잰 값). 무게·무게중심 자리는 그대로다
    const gIso = (gm * ((2 * hx) ** 2 + (2 * hy) ** 2)) / 12;
    const gI = { x: gIso, y: gIso, z: gIso };
    const cap = sphereInertia(0.05, 0.015); // 손잡이 끝 마개
    // 몸통(틀·약실·총신): 총신 축(PISTOL_BORE_X, 주먹 위)을 따라 공이치기 뒤(y −0.03)부터 총구(y 0.20)까지
    const L = this.hiltLength + this.bladeLength + 0.03;
    const yMid = (this.hiltLength + this.bladeLength - 0.03) / 2;
    // 몸통 콜라이더는 보이는 길이 그대로. 다만 짧고 가벼운 몸체는 손목 제어가 못 잡아 가만히 있어도 총구가 떨렸다
    //  → 회전 관성·무게중심만 inertiaLength 몸체 값을 준다 (무게 0.55 kg 는 그대로). 손잡이 무게가 축에서 비켜 있으면 더 떨려서
    //  (손잡이 제자리 무게: 0.2 → 평균 5.4°, 0.25 → 2.4°) 0.25 로 둔다
    const IL = Math.max(L, this.inertiaLength ?? 0.25);
    const frame = boxInertia(0.55, 0.016, IL / 2, 0.013);
    const comY = (IL - L) / 2;
    return [
      partTuple(['box', hx, hy, hz], G.from[1] + dy * hx, gm, 0, 0, 0, 0x6b4226, false, { x: G.from[0] + dx * hx, rotZ: Math.atan2(dy, dx), I: gI }),
      partTuple(['ball', 0.015], G.from[1] + dy * G.len, 0.05, 0, cap.Ie, cap.It, 0xb08d3c, false, { x: G.from[0] + dx * G.len }),
      partTuple(['box', 0.022, L / 2, 0.012], yMid, 0.55, comY, frame.Ie, frame.It, 0x2c2f35, false, { x: PISTOL_BORE_X + 0.006 }),
    ];
  },

  muzzleX: PISTOL_BORE_X, // 총구가 칼 축에서 이만큼 위(−x) — gun.js 가 발사·레이저를 여기서 낸다 (총신이 주먹 위로 올라와 있다)
  thumbScale: 0.6, // 카드 그림: 권총은 실제로 짧으니 칸을 가득 채우지 않는다 (weapon_thumbs 가 이 비율로 작게 둔다)
  decorate(group) {
    drawPistol(group);
  },
});

// ═════════════════════════════════════════════════════════════
//  18) 모르겐슈테른 — 레어 둔기 (사장님 10/2 00:50 "모르겐슈테른을 구현해", 9/30 "둔기 … 레어 정도로?").
//      14~16세기 독일·스위스의 짧은(한손) 고정 철구 모르겐슈테른: 물푸레 자루 끝에 가시 박은 연철 공. 설계 docs/strike/morgenstern_design_2026-10-02.md,
//      수치는 모두 docs/strike/owner_defaults_table.md 줄 130~150 ('사장님 확인 전').
//      [M] 사료 범위: 짧은 것 전체 0.6~0.9 m · 1.2~2.5 kg(쇠 공), 공 Ø 5~8 cm, 가시 2~5 cm × 8~16개. [D] 밀도 계산(물푸레 0.68 · 연철 7.85 g/cm³)으로 질량을 세웠다.
//      날이 없어(edged:false) 늘 둔기 판정 — 멍·균형·의식(머리)·넘어짐·투구 벗김(200 J)·판금 닳음(wearPlate)은 모두 기존 식 그대로(새 문턱 없음).
//      가시만 살·누비옷에 약한 찌르기(spike + mThrust 0.35; 판금·투구 위에서는 기존 문턱 47/0.35 = 134 J 가 막아 둔기 그대로).
//      파손: 나무 자루가 보강띠 밑(breakY 0.40)에서 부러지고 쇠 공 머리가 통째로 떨어져 날아간다 — 남는 자루 토막(≈0.4 kg)이 둔기.
// ═════════════════════════════════════════════════════════════
const morgenstern = finalizeSpec('morgenstern', {
  nameKo: '모르겐슈테른 (가시 철퇴)', nameEn: 'Morgenstern', // 카드 글 초안 — 줄 148 (문구는 사장님 확인 전)
  desc: '가시 박은 쇠 공을 자루 끝에 단 둔기.\n갑옷 위로도 충격이 들어가고 투구를 벗긴다.',
  grip: 'one-hand', material: 'steel', // 틀 C 한손 → 세이버 자세표 guardBaseOne('blunt'); 대안 'hand-and-half'(B 앞무게) — 줄 133. 재질 steel: 자루에 쇠 보강띠·소리는 쇠 (줄 146)
  tier: 'rare', // 등급표 기본값 power 1.05 · durability 0.85 · fragility 0.032 — 줄 136 (확인만)
  edged: false, // 날 없음 → 늘 둔기 (classifyStyle 'blunt')
  mBlunt: 1.6, // 둔타 E 배율 — 줄 134. **사장님 10/8 14:50: 1.3 → 1.6**(값별 48 판: 1.3 6 % · 1.6 15 % · 1.8/2.2 13 % — 1.6 위로는 사정이 상한). 같은 날 참치 2.8 → 2.6, 고무 닭 2.6 → 1.6, 나뭇가지 1(기본) 그대로
  spike: true, mThrust: 0.35, mCut: 0, // 가시 = 약한 찌르기 — 줄 135 (mCut 은 베기 길이 없어 안 읽힌다, 0 으로 적어 둔다)
  ignoreArmorDamage: true, // 사장님 10/8 00:10 '갑옷 방어력 완전 무시' — 판정만(투구 둔타 k = 1, 가시 찌르기·마무리에 판금·투구 문턱 안 씀); 쇠에 튕기는 물리·투구 벗김·판 닳음은 그대로 (확인표 168). 라이트세이버 ignoreArmor(물리까지)와 다름
  controlOverrides: { maxAimTorque: 28 }, // 사장님 10/8 12:05 '그렇게 해'(한손 무거운 머리의 손실 — 어느 길을 열어도 됨) → 길 (a) 손목 서보 상한 22 → 28 (츠바이핸더와 같은 값; 확인표 169 재개, '사장님 확인 전'). 서보가 포화해 머리가 손목 지시를 못 따라가는 손실(docs/strike/r2p_arm_arc_2026-10-08.md §2i)을 메우는 조정값 — 물리 근거는 약하다(한손 손아귀 22 를 넘긴다). 33 은 더 세지만 사선이 1.05 m 밖에서 빗나가 보류
  // 길이 — 줄 131: hiltLength 0.54 = 머리 밑, bladeLength 0.14 = 머리('blade' 부품) 구간 → 손~가시 끝 0.68 m, 밑마개까지 전체 0.82 m
  hiltLength: 0.54, bladeLength: 0.14,
  breakY: 0.4, // 파손 — 줄 139: 자루 위쪽 보강띠 밑에서 끊긴다 (쇠 공 안에서 끊기는 breakAt 대신). fragility 는 레어 표 그대로
  // 겉모습: 부품(자루·마개·철구)마다 따로 그리지 않고 decorate 가 통째로 그린다 (weapon_looks.js drawMorgenstern — 밑마개·가죽 감개·물푸레 자루·쇠 보강띠·목 띠·철구·가시 12개)
  partMesh: hiddenParts,
  buildParts(look) {
    // 질량 분포 — 줄 130 (후보 M-B): 자루 0.60 kg(물푸레 Ø 3.2 cm × 0.67 m 0.37 + 쇠 보강띠 2줄 0.2 + 끈 [D]) + 밑마개 0.08 [I] + 연철 공 Ø 6.5 cm 1.13 + 가시 12개 0.13 ≈ 1.20 [D]
    //  = 1.88 kg, 무게중심 손에서 0.45 m, 손 기준 휘두름 관성 0.50 kg·m² (롱소드 0.27 · 세이버 0.18 · 츠바이핸더 0.77), 가시 끝 유효질량 1.0 kg (롱소드 칼끝 0.18)
    //  대안 M-A 1.73 / M-C 2.05 / M-D 2.20 kg (설계 1-1 표). 손 기준 관성의 89 % 가 머리의 m·r² 라 공 모양 자체는 거의 안 중요하다
    // 10/8 14:30 사장님 '외형은 그대로 두고 무게 10 % 만 줄이자' → 세 부품 모두 ×0.9 (자루 0.60 → 0.54 · 마개 0.08 → 0.072 · 철구 1.9 → 1.71, 전체 2.58 → 2.32 kg, 무게중심 0.49 m 그대로, 손 기준 관성 0.76 → 0.68).
    //  계측(docs/decisions.md 10/8 14:30): 대본 사선 8.2 → 9.3 m/s(묶음 9.1 → 9.6), 세로 머리 164 → 170 J, AI 승률 6 → 4 %(소음 폭 안). 겉모습(drawMorgenstern)은 질량과 무관해 그대로
    // 10/14 03:5x 사장님 '모르겐슈테른 좀 가볍게 해야겠더라' → 세 부품 모두 ×0.85 (자루 0.54 → 0.46 · 마개 0.072 → 0.061 · 철구 1.71 → 1.45, 전체 2.32 → 1.97 kg — 사료 범위 1.2~2.5 kg 안).
    //  무게중심·길이·겉모습 그대로(관성도 ×0.85). 길이(손~가시 끝 0.68 · 전체 0.82 m)는 사료 범위 0.6~0.9 m 안이라 그대로 — 확인표 1085
    const haft = boxInertia(0.46, 0.016, 0.335, 0.016); // 자루 한 상자: y −0.13 ~ 0.54 (쥐는 곳 0.16 m 포함)
    const cap = sphereInertia(0.061, 0.02); // 밑마개 (쇠 캡)
    // 10/8 사장님 '지금보다 확실히 육중하고 공포스럽게' → 한손 대안(확인표 167): 몸체 Ø 6.5 → 9 cm(r 0.045), 머리 1.2 → 1.9 kg, 전체 ≈ 2.58 kg, 무게중심 ≈ 0.49 m, 손 기준 관성 ≈ 0.76 kg·m²(츠바이핸더 0.77)
    const head = sphereInertia(1.45, 0.045); // 연철 공 (가시 질량 포함; 10/8 14:30 ×0.9 · 10/14 ×0.85)
    return [
      partTuple(['box', 0.016, 0.335, 0.016], 0.205, 0.46, 0, haft.Ie, haft.It, null),
      partTuple(['ball', 0.02], -0.135, 0.061, 0, cap.Ie, cap.It, null),
      // 철구 = 'blade' 부품 (isBlade 참 → colliderInfo.part 'blade': 가시 찌르기 t·가르기 예측 훅이 머리에서 돈다. 날 없음이라 예측은 늘 "부딪힘").
      //  콜라이더 공 r 0.05 — 줄 132: 몸체 r 0.0325 보다 1.75 cm 밖, 가시 끝(0.0625) 보다 1.25 cm 안 ('가시 사이로 미끄러진다'. 겉모습 약속 ~1 cm 의 예외)
      //  콜라이더 공 r 0.06(10/8): 몸체 r 0.045 보다 1.5 cm 밖, 가시 끝(0.075) 보다 1.5 cm 안 — 줄 132 와 같은 규칙
      partTuple(['ball', 0.06], 0.61, 1.45, 0, head.Ie, head.It, null, true),
    ];
  },
  decorate(group, look) {
    drawMorgenstern(group, look, 'rare');
  },
});

// ═════════════════════════════════════════════════════════════
//  18) 간장·막야 (레전드 한 쌍) — 샛별 저장소에서 가져옴 (b4464ef 처음 · 3f1af8c 오라 색 · 5b021f5 5 cm 단축, 기준 5a4e96c).
//      춘추 시대 전설의 부부 검(간장이 만들고 막야가 몸을 던졌다는 이야기). 유물 실측이 아니라 전설 각색 제원이다 — 전부 [I].
//      제원(샛별 쪽 사용자 승인값 그대로): 간장 전체 95 cm(칼날 72)·0.95 kg / 막야 전체 91 cm(칼날 68)·1.12 kg (짧은 막야가 더 무겁다).
//       참고: 지안은 0.8~0.9 kg · 칼날 70~80 cm (docs/weapons_research.md 표, 제작사 자료 [I]-leaning — 청강검 0.85 kg 이 이 값) —
//       간장 칼날은 그 띠 안이고 무게는 조금 위, 막야는 칼날이 짧은데 1.12 kg 이라 띠 위쪽 끝을 25 % 넘는다(전설 각색).
//      부품 배치·무게중심 비율(0.36)·회전 반경(0.25)은 청강검 [I] 을 그대로 물려받는다 (손 원점·자루·호심 코등이·원반 폼멜 같은 자리).
//      레전드 → power 1.2 · 파손 0 (불괴). 특수 능력 없음. mThrust 1.15, mBlunt 0.95 (샛별 값 그대로) · mCut 1.15 → 1.25 (10/10 사장님 — 청강검과 같게, 아래 칸 주석).
//      유파: 중국 (청강검과 같은 劍 — school 'chinese'). 뽑기: 두 자루가 한 묶음(drawGroup) — 레전드가 나오면 엑스칼리버 한 칸 · 간장/막야 한 칸
//       으로 나누고, 묶음이 뽑히면 둘 중 하나를 고른다(drawWeaponCards). 같은 판 두 장에 둘이 함께 나오지 않는다.
//      오라: aura.js AURA_PROFILES — 간장(어두운 칼몸)에 흰 아지랑이, 막야(밝은 칼몸)에 먹빛 아지랑이 (엑스칼리버와 같은 세기 0.5. 10/10 1차로 키웠다가 10/11 사장님 "후광 너무 과해" → 은은하게 되돌림, 몇 개의 입자만 남김).
//      우리 쪽에서 바꾼 것: school 'chinese' 를 적음 · 카드 설명의 길이를 단축 뒤 값(100/96 → 95/91 cm)으로 바로잡음 (샛별 쪽은 단축 전 글자가 남아 있었다).
// ═════════════════════════════════════════════════════════════
const LEGENDARY_JIAN = {
  ganjiang: { blade: 0.72, bladeMass: 0.64, gripMass: 0.11, pommelMass: 0.14, guardMass: 0.06,
    halfWidth: 0.015, thick: 0.0034, steel: 0x62625d, grip: 0x201e1b, metal: 0x9a8255, pattern: 0xa48d64 },
  moye: { blade: 0.68, bladeMass: 0.745, gripMass: 0.12, pommelMass: 0.18, guardMass: 0.075,
    halfWidth: 0.016, thick: 0.0038, steel: 0xe3eaed, grip: 0xc9c9be, metal: 0xb9c5c7, pattern: 0x849fa8 },
};

function legendaryJianParts() {
  const d = LEGENDARY_JIAN[this.id], L = this.bladeLength;
  const grip = boxInertia(d.gripMass, 0.015, 0.09, 0.015);
  const pommel = sphereInertia(d.pommelMass, 0.02);
  const guard = boxInertia(d.guardMass, 0.035, 0.008, 0.012);
  const blade = bladeInertia(d.bladeMass, L, 0.36, 0.25, 2 * d.halfWidth, 0.009);
  return [
    partTuple(['box', 0.015, 0.09, 0.015], 0, d.gripMass, 0, grip.Ie, grip.It, d.grip),
    partTuple(['ball', 0.02], -0.09, d.pommelMass, 0, pommel.Ie, pommel.It, d.metal),
    partTuple(['box', 0.035, 0.008, 0.012], 0.11, d.guardMass, 0, guard.Ie, guard.It, d.metal),
    partTuple(['box', d.halfWidth, L / 2, 0.0045], 0.12 + L / 2, d.bladeMass,
      blade.comY, blade.Ie, blade.It, d.steel, true),
  ];
}

// 紋은 칼면 위 얇은 삼각형 선 한 벌로 그린다. 텍스처·발광·충돌·새 강체는 없다.
function legendaryJianDecorate(group) {
  const d = LEGENDARY_JIAN[this.id], L = this.bladeLength;
  const metal = metalMat(d.metal, { rough: 0.23 });
  const dark = this.id === 'ganjiang';
  const guard = addMesh(group, new THREE.OctahedronGeometry(0.034, 0), metal, [0, 0.11, 0]);
  guard.scale.set(1.06, 0.35, 0.52);
  guard.castShadow = true;
  const collar = addMesh(group, new THREE.CylinderGeometry(0.012, 0.014, 0.036, 8), metal, [0, 0.144, 0]);
  collar.scale.set(1.2, 1, 0.55);
  collar.castShadow = true;
  // 자루 목띠와 이중 원반 상감.
  for (const y of [-0.065, 0.073]) {
    const ring = addMesh(group, new THREE.TorusGeometry(0.016, 0.0014, 5, 16), metal, [0, y, 0]);
    ring.rotation.x = Math.PI / 2;
  }
  for (const side of [-1, 1]) {
    addMesh(group, new THREE.TorusGeometry(0.014, 0.0008, 5, 20), metal, [0, -0.09, side * 0.008]);
    const seal = addMesh(group, new THREE.OctahedronGeometry(0.006, 0), metal, [0, -0.09, side * 0.008]);
    seal.scale.set(1, 1, 0.3);
    const heart = addMesh(group, new THREE.TorusGeometry(0.007, 0.0007, 5, 16), metal, [0, 0.11, side * 0.017]);
    heart.scale.y = 0.62;
  }
  const vertices = [];
  const surface = (x, y, side) => {
    const t = (y - 0.12) / L;
    return [x, y, side * (d.thick * (1 - 0.35 * t) + 0.00012)];
  };
  const stroke = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    const nx = -dy / len * 0.00014, ny = dx / len * 0.00014;
    for (const side of [-1, 1]) {
      const p = surface(a[0] + nx, a[1] + ny, side);
      const q = surface(a[0] - nx, a[1] - ny, side);
      const r = surface(b[0] - nx, b[1] - ny, side);
      const s = surface(b[0] + nx, b[1] + ny, side);
      vertices.push(...p, ...q, ...r, ...p, ...r, ...s);
    }
  };
  if (dark) {
    // 귀갑문: 두 줄의 육각 세공이 칼끝 방향으로 가늘어진다.
    for (let y = 0.195; y < 0.12 + L - 0.105; y += 0.023) {
      const taper = 1 - 0.25 * (y - 0.12) / L;
      for (const x of [-0.0046, 0.0046]) {
        const points = Array.from({ length: 7 }, (_, k) => {
          const a = k * Math.PI / 3;
          return [(x + Math.cos(a) * 0.0045) * taper, y + Math.sin(a) * 0.0115];
        });
        for (let k = 0; k < 6; k++) stroke(points[k], points[k + 1]);
      }
    }
  } else {
    // 흐르는 담금질 결: 날선을 가리지 않는 다섯 줄의 은은한 물결.
    for (let line = -2; line <= 2; line++) {
      let prev;
      for (let k = 0; k <= 80; k++) {
        const t = k / 80, y = 0.185 + t * (L - 0.165);
        const x = (line * 0.0032 + Math.sin(t * 5 * Math.PI + line * 0.65) * 0.0012) * (1 - 0.3 * t);
        const point = [x, y];
        if (prev) stroke(prev, point);
        prev = point;
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.computeVertexNormals();
  addMesh(group, geo, metalMat(d.pattern, { rough: 0.42, metal: 0.6, side: THREE.DoubleSide }));
}

function legendaryJianSpec(id, nameKo, nameEn, desc) {
  const d = LEGENDARY_JIAN[id];
  return finalizeSpec(id, {
    nameKo, nameEn, desc, grip: 'one-hand', material: 'steel', tier: 'legend',
    school: 'chinese', // 중국 유파 (청강검과 같은 劍)
    enterParry: true, // 들어가며 막기 (10라운드 R3, skill.js) — 우리 관례: 짧은 한손 칼(세이버·팔쉬온·청강검)은 다 켠다. 샛별 쪽엔 빠져 있었다(청강검엔 있음)
    drawGroup: 'ganjiang_moye', hiltLength: 0.12, bladeLength: d.blade,
    // mCut 1.15 → 1.25 (사장님 10/10 20:4x '간장막야도 동일한 베기 배율 주고 나머진 유파 개선으로'): 청강검과 같은 배율 — 레전드 power 1.2 를 곱하면 1.5 로
    //  에픽 청강검(1.1 × 1.25 ≈ 1.38) 위가 되어 전의 등급 역전(1.2 × 1.15 = 1.38 < 청강검 1.1 × 1.35 = 1.49)이 풀린다. 확인표 771
    mCut: 1.25, mThrust: 1.15, mBlunt: 0.95,
    partMesh: swordKit({
      blade: { edge: 'double', width: (t) => 1 - 0.25 * t, thick: d.thick,
        tip: 'spear', tipLen: 0.075, overshoot: 0 },
      grip: { style: 'cord' }, pommel: { style: 'disc' }, guard: { style: 'none' }, metal: d.metal,
    }),
    buildParts: legendaryJianParts, decorate: legendaryJianDecorate,
  });
}

// 카드 문구 (10/10 에셋 리뷰 §1-3): 카드 한 칸에 둘 중 하나가 뜨는 한 쌍이라 첫 줄에 짝 이름을 넣고, 길이 표기는 사인검·아이스와 같은 '전체 N cm'
//  (화면 문구 규칙 docs/ui/hud_copy_rules_2026-10-10.md §4-7 숫자와 단위 사이 한 칸 · §4-6 카드 설명 두 문장 40 자 안 — 36.5)
const ganjiang = legendaryJianSpec('ganjiang', '간장', 'Ganjiang',
  '막야와 한 쌍인 회금빛 귀갑문 명검.\n전체 95 cm, 질량 0.95 kg의 한손 양날검.');
const moye = legendaryJianSpec('moye', '막야', 'Moye',
  '간장과 한 쌍인 은빛 물결무늬 명검.\n전체 91 cm, 질량 1.12 kg의 한손 양날검.');

// ═════════════════════════════════════════════════════════════
//  19) 사인검 (레어) — 샛별 저장소에서 가져옴 (6e71ba2, 기준 5a4e96c). 조선 왕실의 벽사 의례검(네 寅이 겹친 때 만든다).
//      [M] 국립중앙박물관 덕수1968 철제 금은입사 사인참사검 전체 100 cm (칼날 길이·질량·단면은 공개 실측 없음) ·
//      국립고궁박물관 창덕26673-1 현존 71 cm·폭 3.5 cm(자루 결실). 그래서 전체 100 cm 만 [M], 나머지는 게임 각색 [I]:
//      칼날 0.75 m · 질량 1.0 kg(자루 .10 · 폼멜 .16 · 코등이 .09 · 칼날 .65) · 한손 쥠 · 무게중심 비율 0.36·회전 반경 0.25(청강검과 같은 [I]).
//      의례검이라 실전 성능 근거는 없다 — mCut 1.10 · mThrust 1.0 · mBlunt 0.95 는 샛별 쪽 시작값.
//      겉모습(rare_sword_details.js): 꽃잎 폼멜·판형 코등이·북두칠성 금입사와 전서 리듬의 기하(유물 27 자 복제 아님)·은입사 선.
//      유파: 중국 (school 'chinese') — 우리 중국 유파의 바탕 글이 《무비지》의 조선세법·본국검이라(schools.js 중국 절) 조선 검에 그대로 맞는다.
//  20) 아이스 (레어) — 샛별 저장소에서 가져옴 (6e71ba2 · 4a425f9 겉모습, 기준 5a4e96c). 소설 속 북부 영주 가문의 대검(창작물의 검).
//      [I] 전부 게임 설계: 전체 168 cm(소설 6 ft = 183 cm 에서 샛별 쪽 사용자 지시로 15 cm 줄임) · 칼날 1.25 m · 폭 9 cm · 3.5 kg.
//       비교 [M]: Met 14.25.935 양손검 전체 168.9 cm · 2.78 kg / Cleveland 1919.68 전체 191.5 cm · 3.95 kg — 같은 길이 실물보다 약 0.7 kg(26 %) 무겁다.
//       부품 질량 자루 .30 · 폼멜 .70 · 코등이 .35 · 칼날 2.15 kg, 칼날 무게중심 비율 0.33·회전 반경 0.25 [I].
//      mCut 1.10 · mThrust 0.85 · mBlunt 1.15 = 츠바이핸더 배율 그대로(샛별 쪽 결정). 유파는 앞무게 틀 자동 → 이베리아.
//      우리 쪽에서 바꾼 것: 손목 서보 상한 28 덮개를 뺐다 → 두 손 쥠 기본값 26 (우리 츠바이핸더도 10/10 쥠 넓힘 때 28 을 뺐다, 확인표 682.
//       샛별 쪽 근거가 '지금 대검과 같은 28' 이었으니 우리 대검 값 26 이 같은 뜻). 쥠 자리(손 사이 0.20 m, 오른손은 날밑 0.185 m 아래)는 샛별 그대로 —
//       우리 츠바이핸더의 고디뉴 쥠(오른손 날밑·손 사이 0.30 m)으로 바꿀지는 사장님 확인 전(docs/import/saetbyeol_new_2026-10-10.md).
// ═════════════════════════════════════════════════════════════
const sain = finalizeSpec('sain', {
  nameKo: '사인검', nameEn: 'Sain Sword',
  desc: '별자리와 금은 명문을 새긴 의례검.\n전체 100 cm, 질량 1 kg의 한손 양날검.',
  grip: 'one-hand', material: 'steel', tier: 'rare',
  school: 'chinese', // 중국 유파 — 바탕 글이 조선세법·본국검 (위 머리말)
  enterParry: true, // 들어가며 막기 (짧은 한손 칼 관례 — 간장·막야와 같은 까닭)
  hiltLength: 0.125, bladeLength: 0.75, gripAlong: -0.12,
  mCut: 1.10, mThrust: 1.0, mBlunt: 0.95,
  partMesh: sainPartMesh, decorate: sainDecorate,
  buildParts() {
    const L = this.bladeLength;
    const grip = boxInertia(0.10, 0.016, 0.1, 0.014);
    const pommel = sphereInertia(0.16, 0.025);
    const guard = boxInertia(0.09, 0.04, 0.01, 0.013);
    const blade = bladeInertia(0.65, L, 0.36, 0.25, 0.035, 0.009);
    return [
      partTuple(['box', 0.016, 0.1, 0.014], 0, 0.10, 0, grip.Ie, grip.It, SAIN_COLORS.grip),
      partTuple(['ball', 0.025], -0.1, 0.16, 0, pommel.Ie, pommel.It, SAIN_COLORS.metal),
      partTuple(['box', 0.04, 0.01, 0.013], 0.11, 0.09, 0, guard.Ie, guard.It, SAIN_COLORS.metal),
      partTuple(['box', 0.0175, L / 2, 0.0045], this.hiltLength + L / 2, 0.65,
        blade.comY, blade.Ie, blade.It, SAIN_COLORS.blade, true),
    ];
  },
});

const ice = finalizeSpec('ice', {
  nameKo: '북부 대공의 검', nameEn: 'Sword of the Northern Grand Duke', // 사장님 10/11 01:4x 이름 바꿈(전 '아이스' — 설명에 '북부 가문의 검')
  desc: '세 줄의 홈과 황동 장식을 지닌 대검.\n전체 168 cm, 질량 3.5 kg의 양손검.', // 사장님 10/10 20:0x: '스타크의 대검' → '북부 가문의 검' (이름 '아이스'는 일반명사로 그대로)
  grip: 'two-hand', material: 'steel', tier: 'rare',
  hiltLength: 0.20, bladeLength: 1.21, gripAlong: -0.22, // 칼날 1.25 → 1.21 (사장님 10/11 01:5x '4cm 줄여' — 쥠을 넓히며 172 cm 가 된 전체를 처음 정한 168 cm 로, 칼날 무게중심·관성은 칼날 길이 비율 그대로)
  // 쥠 (10/10 23:5x 사장님 지시 '이베리아 유파는 츠바이핸더처럼 쥐는 걸 기본으로 해서 아이스도 그렇게 — 0.22~0.24 사이', 확인표 825·826 — 몬탄테 문서 §17):
  //  손 사이 0.20 → 0.22 m. 왼손은 폼멜 목(츠바이핸더 §15 규칙: 폼멜 끝 = 왼손 − 0.048 → 폼멜 가운데 −0.238, 공 반지름 0.030),
  //  자루 상자는 위 끝(0.185, 날밑 바로 밑) 그대로 아래로만 늘림(아래 끝 = 폼멜 가운데 + 0.015 — 전 꼴과 같은 겹침) → 가운데 −0.019 · 반 길이 0.204.
  //  0.22 를 고른 까닭: 오른손이 날밑 아랫면에서 0.17 m 아래로 이미 멀어(츠바이핸더 0.11) 날밑 밑 자루가 길다 — 0.22 면 날밑 아랫면~폼멜 끝 0.438 m 로
  //  같은 시대 톨레도 몬탄테 자루(0.413·0.400 — 문서 §10-2)에 가장 가깝다(0.24 면 0.458). 오른손을 날밑 가까이 옮기려면 칼 원점이 칼날 쪽으로 가야 하는데,
  //  손~칼끝 1.45 m 를 지키면 칼날을 늘려야 하고(겉모양 바뀜) 칼날을 지키면 손~칼끝이 준다 — 둘 다 지킬 것이라 오른손은 그대로 두었다.
  //  칼날·날밑·홈 겉모양·부품 질량(자루 .30 · 폼멜 .70 · 날밑 .35 · 칼날 2.15)·칼날 무게중심·관성·서보 26 그대로. 전체 길이 168 → 172 cm(자루가 3.8 cm 늘어남)
  mCut: 1.10, mThrust: 0.85, mBlunt: 1.15,
  // 손목 서보 상한: 두 손 쥠 기본값 26 (샛별 쪽 28 덮개는 뺐다 — 위 머리말 · 우리 츠바이핸더와 같은 값)
  partMesh: icePartMesh, decorate: iceDecorate,
  buildParts() {
    const L = this.bladeLength;
    const grip = boxInertia(0.30, 0.022, 0.204, 0.020);
    const pommel = sphereInertia(0.70, 0.030);
    const guard = boxInertia(0.35, 0.14, 0.015, 0.022);
    const blade = bladeInertia(2.15, L, 0.33, 0.25, 0.09, 0.009);
    return [
      partTuple(['box', 0.022, 0.204, 0.020], -0.019, 0.30, 0, grip.Ie, grip.It, ICE_COLORS.grip),
      partTuple(['ball', 0.030], -0.238, 0.70, 0, pommel.Ie, pommel.It, ICE_COLORS.metal),
      partTuple(['box', 0.14, 0.015, 0.022], 0.185, 0.35, 0, guard.Ie, guard.It, ICE_COLORS.metal),
      partTuple(['box', 0.045, L / 2, 0.0045], this.hiltLength + L / 2, 2.15,
        blade.comY, blade.Ie, blade.It, ICE_COLORS.blade, true),
    ];
  },
});

// ═════════════════════════════════════════════════════════════
//  21) 플랑베르주 (에픽) — 샛별 저장소 origin/main 325a5c38 의 flamberge_design.js 생김새를 옮겨 고침 (겉모습 src/flamberge_look.js).
//      원형: 클리블랜드 미술관 1919.71 「Two-Handed Sword with Flamboyant Blade」, 독일 1550–1600 (박물관 열린 자료 CC0).
//       실측 [M]: 전체 168.9 · 날 118.7(리카소 26.7 포함) · 코등이 50.5 · 손잡이(폼멜 포함) 49.2 cm. 무게는 자료에 없다 → 3.0 kg 은 우리 안 [I].
//      그쪽 모델은 겉모습 시안뿐이라(질량·쥠·충돌체·등급·카드 없음) 아래 값은 모두 우리가 새로 정했다 — 확인표 1140~, docs/import/flamberge_port_2026-10-14.md.
//      쥠 (이베리아 몬탄테 쥠 규칙 — 츠바이핸더 §15·북부 대공의 검 §17): 두 손. 오른손 주먹 가운데가 날밑 덩이 아랫면 0.065 m 밑
//       (츠바이핸더 날밑 쥠과 같은 몫 = 주먹 반 폭 0.045 + 0.02) → hiltLength 0.085, 손 ~ 칼끝 1.272 m. 손 사이 0.24 m(츠바이핸더 중간 쥠과 같음).
//       손잡이가 49.2 cm 로 길어 왼손은 폼멜 목이 아니라 아래 마디 위쪽(폼멜 끝에서 0.177 m — 두 마디 사이 잘록한 곳 바로 밑)에 온다.
//      질량 3.0 kg [I]: 츠바이핸더 부품의 길이당 질량(자루 0.26/0.365 · 날밑 0.32/0.28 · 칼날 1.7/1.215 kg/m)을 이 칼 치수에 대고,
//       폼멜은 그 청동 덩이 부피(49 cm³ × 8.8 g/cm³ = 0.43 kg) [D] → 자루 0.325 · 폼멜 0.43 · 날밑 0.58 · 칼날 1.665 kg (합 3.000).
//       칼날 무게중심 비율 0.353 · 회전 반경 비 0.272 = 모델의 리카소 + 물결 날 부피 분포에서 셈 [D] (츠바이핸더 0.365·0.244 · 북부 대공의 검 0.33·0.25).
//       (모델 겉부피 × 강철 밀도로 그대로 재면 3.5 kg 에 날밑이 1.3 kg 이고 칼날이 1.2 kg 이라 무게중심이 날밑 앞 6 cm 에 그친다 —
//        코등이 판 두께 1.1 cm·칼날 단면 6.4 mm 가 사진 어림이라 질량 근거로 쓰지 않았다)
//      배율은 츠바이핸더 그대로(베기 1.1 · 찌르기 0.85 · 둔타 1.15) → 자동 판정 앞무게·베기 → 이베리아 (독일로 지정하지 않는다 — 독일 유파엔 대검 가지가 없다).
//      리카소(날 안 세운 26.7 cm)는 칼날 콜라이더 안에 겉모습으로만 둔다(츠바이핸더와 같은 방식 — 날 판정 그대로). 보조 갈고리(축에서 8.9 cm)는 콜라이더 밖 장식.
//      코등이 콜라이더는 박물관 폭 그대로 50.5 cm(겉모습 약속 ~1 cm — 휜 끝 판만 1.2 cm 위로 나온다). 물결 날에 출혈·파손 특례 없음 · 특수 능력 없음.
// ═════════════════════════════════════════════════════════════
const FL = {
  // 부품 자리 (칼 원점 = 오른손 주먹 가운데, y): 자루 상자 0.070(날밑 덩이 안) ~ −0.385(폼멜 가운데) · 폼멜 · 코등이 상자 0.067~0.127 · 칼날 밑동 0.085 부터 1.187 m
  y: [-0.1575, -0.385, 0.097, FLAMBERGE_HILT + FLAMBERGE_MUSEUM.blade / 2],
  mass: { grip: 0.325, pommel: 0.43, guard: 0.58, blade: 1.665 },
};
const flamberge = finalizeSpec('flamberge', {
  nameKo: '플랑베르주 (물결 날 양손검)', nameEn: 'Flamberge',
  desc: '불꽃처럼 물결치는 날을 지닌 대검.\n전체 169 cm, 질량 3.0 kg의 양손검.',
  grip: 'two-hand', material: 'steel', tier: 'epic',
  hiltLength: FLAMBERGE_HILT, bladeLength: FLAMBERGE_MUSEUM.blade, gripAlong: -0.24,
  mCut: 1.1, mThrust: 0.85, mBlunt: 1.15,
  // 손목 서보 상한: 두 손 쥠 기본값 26 (츠바이핸더·북부 대공의 검과 같다)
  partMesh: flambergePartMesh(FL.y), decorate: flambergeDecorate,
  buildParts() {
    const L = this.bladeLength;
    const M = FL.mass;
    const grip = boxInertia(M.grip, 0.019, 0.2275, 0.0165);
    const pommel = sphereInertia(M.pommel, 0.03);
    const guard = boxInertia(M.guard, 0.2525, 0.03, 0.0155);
    const blade = bladeInertia(M.blade, L, 0.353, 0.272, 0.04, 0.009);
    return [
      partTuple(['box', 0.019, 0.2275, 0.0165], FL.y[0], M.grip, 0, grip.Ie, grip.It, FLAMBERGE_COLORS.leather),
      partTuple(['ball', 0.03], FL.y[1], M.pommel, 0, pommel.Ie, pommel.It, FLAMBERGE_COLORS.bronze),
      partTuple(['box', 0.2525, 0.03, 0.0155], FL.y[2], M.guard, 0, guard.Ie, guard.It, FLAMBERGE_COLORS.steel),
      partTuple(['box', 0.02, L / 2, 0.0045], FL.y[3], M.blade, blade.comY, blade.Ie, blade.It, FLAMBERGE_COLORS.blade, true),
    ];
  },
});

// ═════════════════════════════════════════════════════════════
//  22) 월왕구천검 (에픽) — 샛별 저장소에서 가져옴 (origin/main 7684c732 — 그쪽 c9719902 처음 80 cm · e7eb2f5c 85 cm). 겉모습 src/goujian_details.js.
//      원형: 춘추 말기 월나라 왕 구천의 청동 직선 양날검 (1965 호북 강릉 망산 1호묘 출토) — [M] 소장 기관 기록 길이 55.7 cm · 폭 4.6 cm, 참고 사전 875 g.
//      게임판은 실물의 복제가 아니라 늘린 각색 [I] (샛별 쪽 사용자 요청 '모르겐슈테른 69 cm 이상'): 전체 85 cm(손 기준 −0.09 ~ +0.76 m) · 날 67 cm ·
//       질량 1.213 kg = 날 0.843(80 cm 판 날 0.78 kg 을 같은 단면으로 날 길이 비 0.67/0.62 만큼) + 자루 0.13 + 폼멜 0.14 + 코등이 0.10 ·
//       칼날 무게중심 비율 0.38 · 회전 반경 비 0.26 [I] · 폭 4.6 cm · 한손 · 배율 베기·찌르기 1.05 · 둔타 1.0 — 제원은 모두 샛별 값 그대로.
//      재질 steel (샛별 그대로): 우리 재질표(MATERIALS · SOUND_MATERIAL · MATERIAL_TOUGHNESS)와 소리 재질(sound.js)에 청동이 없다. 칼끼리 닿는 소리는 쇳소리
//       (종도 청동이다), 반발은 쇠끼리(0.7), 부러짐은 등급표대로(재질 몫 1) — 청동이 강철보다 잘 부러지는 몫을 따로 두려면 새 재질·새 수가 들어 하지 않았다.
//      우리 쪽에서 바꾼 것 (docs/import/goujian_port_2026-10-14.md · 확인표 1440~): 등급 레어 → 에픽 · 카드 뽑기에 넣음 · 특수 능력 '와신상담'(사장님 결정 10/14) ·
//       school 'chinese'(동방 — 샛별 스펙엔 유파가 없어 그대로면 자동 판정 독일) · enterParry(짧은 한손 칼 관례 — 간장·막야·사인검과 같은 까닭) · 카드 글을 우리 글 규칙으로.
// ═════════════════════════════════════════════════════════════
const goujian = finalizeSpec('goujian', {
  nameKo: '월왕구천검', nameEn: 'Sword of Goujian',
  // 카드 글 (우리 글 규칙 — 숫자와 단위 띄움 · 두 문장 40 자 안). 감독 예 '월나라 왕 구천의 청동검. / 전체 85 cm, 질량 1.21 kg의 한손검.' 은 작은 가로 폰(568×320 · 844×340)
  //  카드 폭 150 px 에서 설명 세 줄 + 능력 줄 두 줄이 되어, 고른 카드('내 무기' 꼬리표가 붙음)의 글이 앞면 아래로 3.6 px 넘쳤다 → 설명을 두 줄로 줄임
  desc: '월왕 구천의 청동검.\n전체 85 cm, 1.21 kg의 한손검.',
  grip: 'one-hand', material: 'steel', tier: 'epic', // 에픽 (사장님 결정 10/14) → power 1.1 · 내구 0.95 · 파손 0.0104 (등급표 그대로)
  school: 'chinese', // 동방 유파 (사장님 결정 10/14 — 청강검·간장·막야·사인검과 같은 劍)
  enterParry: true, // 들어가며 막기 (짧은 한손 칼 관례 — 간장·막야·사인검과 같은 까닭, 샛별 쪽엔 없음)
  ability: '와신상담: 다칠수록 공격력 증폭', // 에픽 특수 능력 (사장님 결정 10/14 — 카드 능력 줄 문구 그대로)
  woundRage: 0.3, // '와신상담': 칼 주인이 다친 정도 d(0~1)만큼 이 칼의 공격력(power)이 × (1 + 0.3·d) — 최대 +30 % 는 사장님 결정. d 정의는 combat.js woundDegree
  hiltLength: 0.09, bladeLength: 0.67, gripAlong: -0.10,
  mCut: 1.05, mThrust: 1.05, mBlunt: 1.0,
  partMesh: goujianPartMesh, decorate: goujianDecorate,
  buildParts() {
    const L = this.bladeLength;
    const bladeMass = 0.78 * L / 0.62; // 같은 단면·재질: 80 cm 판 날 0.78 kg 을 날 길이 비로 늘림 (샛별 식 그대로 — 0.843 kg)
    const grip = boxInertia(0.13, 0.016, 0.079, 0.014);
    const pommel = boxInertia(0.14, 0.026, 0.004, 0.026); // 원반 폼멜 (상자 콜라이더 — 샛별 그대로)
    const guard = boxInertia(0.10, 0.034, 0.007, 0.016);
    const blade = bladeInertia(bladeMass, L, 0.38, 0.26, 0.046, 0.009);
    return [
      partTuple(['box', 0.016, 0.079, 0.014], -0.001, 0.13, 0, grip.Ie, grip.It, GOUJIAN_COLORS.grip),
      partTuple(['box', 0.026, 0.004, 0.026], -0.086, 0.14, 0, pommel.Ie, pommel.It, GOUJIAN_COLORS.metal),
      partTuple(['box', 0.034, 0.007, 0.016], 0.083, 0.10, 0, guard.Ie, guard.It, GOUJIAN_COLORS.metal),
      partTuple(['box', 0.023, L / 2, 0.0045], this.hiltLength + L / 2, bladeMass,
        blade.comY, blade.Ie, blade.It, GOUJIAN_COLORS.blade, true),
    ];
  },
});

// Kim keeps his brother's sword wrapped: a single-hand blunt weapon, never an edge
// or spike, including after breakage. Dimensions/mass are game estimates [I].
const brothersSword = finalizeSpec('brothers_sword', {
  nameKo: '형의 칼', nameEn: "Brother's Sword",
  desc: '불살을 지키려 흰 천에 감싼 형의 칼.\n날을 드러내지 않고 한 손 둔기로 쓴다.',
  grip: 'one-hand', material: 'wood', soundMaterial: 'wood', tier: 'rare',
  characterOnly: true, // Kim's personal weapon; do not change the ordinary card pool.
  edged: false, spike: false, mCut: 0, mThrust: 0, mBlunt: 1,
  hiltLength: .12, bladeLength: .81,
  partMesh: hiddenParts,
  buildParts() {
    const grip = boxInertia(.22, .019, .12, .019);
    const cap = sphereInertia(.08, .015);
    const body = boxInertia(.95, .021, .405, .021);
    return [
      partTuple(['box', .019, .12, .019], -.012, .22, 0, grip.Ie, grip.It, null),
      partTuple(['ball', .015], -.121, .08, 0, cap.Ie, cap.It, null),
      partTuple(['box', .021, .405, .021], .525, .95, 0, body.Ie, body.It, null, true),
    ];
  },
  decorate: drawBrothersSword,
});

// 무기마다 적은 desc 는 무기 뽑기 카드(main.js)의 앞면에 쓰는 한두 줄 설명이다 (\n 으로 줄을 나눈다).
//  글자 데이터일 뿐 물리·밸런스와는 상관없다. 카드 앞면의 작은 그림은 public/ui/weapons/<id>.webp
//  (tools/browser/weapon_thumbs.mjs 로 이 무기 모델을 그대로 찍어 만든다 — 겉모습을 바꾸면 다시 돌린다).
export const WEAPONS = {
  longsword, zweihander, estoc, sabre, rapier, falchion,
  monohoshizao, qinggang, excalibur, excalibur_replica: excaliburReplica, lightsaber, tree_branch: treeBranch,
  rubber_chicken: rubberChicken, frozen_tuna: frozenTuna, pistol, morgenstern,
  uchigatana, // 제안 가지 (10/9, 사장님 확인 전) — 끝에 둬서 다른 무기의 목록 순서를 바꾸지 않는다
  ganjiang, moye, sain, ice, // 샛별 저장소에서 가져옴 (10/10, 사장님 확인 전) — 같은 까닭으로 끝에 둔다
  flamberge, // 샛별 저장소 생김새를 옮겨 고침 (10/14, 사장님 확인 전) — 같은 까닭으로 끝에 둔다
  goujian, // 샛별 저장소에서 가져옴 (10/14 — 에픽·뽑기에 넣음·와신상담은 사장님 결정) — 같은 까닭으로 끝에 둔다
  brothers_sword: brothersSword,
};

// 다른 담당이 쓰는 짧은 이름 → 정식 id (characters.js의 'branch', URL 파라미터의 'chicken' 등)
export const WEAPON_ALIASES = {
  branch: 'tree_branch', stick: 'tree_branch',
  jian: 'qinggang', // 옛 id (지안 → 청강검, 감독 결정)
  chicken: 'rubber_chicken', tuna: 'frozen_tuna',
  katana: 'monohoshizao', // 옛 id (카타나 → 모노호시자오 에픽, 감독 결정)
  longsword_sharp: 'longsword', sharp: 'longsword', // 실전용 롱소드는 기본 롱소드와 합침 (감독 결정)
  messer: 'falchion', hwandudaedo: 'longsword', // 삭제된 무기 (감독 결정) — 옛 id 로 죽지 않게
  arming_sword: 'longsword', arming: 'longsword', // 삭제된 무기 (감독 결정)
  replica: 'excalibur_replica', saber: 'lightsaber',
  morningstar: 'morgenstern', mace: 'morgenstern', // 모르겐슈테른 (영어 이름·둔기 통칭)
};

// 아무 무기도 지정하지 않았을 때(o.weapon 없음) 쓰는 기본 무기.
export const DEFAULT_WEAPON = 'longsword';

export const WEAPON_LIST = Object.values(WEAPONS);
// 빼 둔 무기 (사장님 10/13 23:2x '독일 무기가 너무 많으니까 쓸데없는 걸 빼자 — 롱소드가 기본 양손 무기인데 에스톡·세이버·팔쉬온은 애매하고 별 특색도 없다'):
//  주인공 무기 카드(main.js PLAYER_WEAPON_POOL)와 테스트 고르기 화면(test_pick.js)에서만 뺀다. 정의·코드는 남겨 되살리기 쉽게 — 시뮬·무기 점검(weapon_smoke)·브란의 '주워 온 칼'(characters.js shortest_common)은 그대로
export const RETIRED_WEAPONS = new Set(['estoc', 'sabre', 'falchion']);

/** id(또는 별칭)로 무기 사양을 찾는다. 모르는 id면 기본 무기(경고 한 번). */
const warned = new Set();
export function getWeapon(id) {
  const key = WEAPON_ALIASES[id] ?? id;
  const spec = WEAPONS[key];
  if (spec) return spec;
  if (id != null && !warned.has(id)) {
    warned.add(id);
    console.warn(`[weapons] 모르는 무기 id '${id}' → ${DEFAULT_WEAPON} 로 대신합니다`);
  }
  return WEAPONS[DEFAULT_WEAPON];
}

/** 쥠 종류 기본 서보 상한을 바꾼다(명시 상한이 없는 무기만) — 10/8 비교용 `?twoHandCap=` */
export function setGripTorque(grip, value) {
  GRIP_TORQUE[grip] = value;
  for (const spec of Object.values(WEAPONS)) if (spec.grip === grip && spec.capFromGrip) spec.controlOverrides.maxAimTorque = value;
}

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
import { drawGroupedWeaponCards } from './weapon_draw.js';
import { MORGENSTERN_DESIGN as MACE } from './morgenstern_design.js';
import * as THREE from 'three';
import { swordKit, metalMat, weaponEnv, hiddenParts, drawTreeBranch, drawRubberChicken, drawFrozenTuna, drawPistol, morgensternKit, PISTOL_GRIP, PISTOL_BORE_X } from './weapon_looks.js';

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
export function drawWeaponCards(pool, n = 2, options = {}) {
  return drawGroupedWeaponCards(pool, n, { ...options, getWeapon, tierWeights: TIER_DRAW });
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
 *  레전드에 자체 발광은 안 준다 — 진짜 엑스칼리버의 표식은 aura.js 오라 하나뿐이어야 해서
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
const GRIP_TORQUE = { 'one-hand': 22, 'hand-and-half': 22, 'two-hand': 22 };

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
    gripAlong: s.gripAlong ?? -0.14,
    twoHand: s.grip !== 'one-hand',
    // 한손 자세표(guards.js ONE_HAND: 칼 든 어깨를 앞으로, 손을 더 뻗는다)를 쓰나. 한손 무기는 기본으로 쓴다
    oneHandStance: s.oneHandStance ?? s.grip === 'one-hand',
    soundMaterial: s.soundMaterial ?? SOUND_MATERIAL[s.material] ?? 'steel', // 소리 담당 API에 넘길 재질 이름
    controlOverrides: { maxAimTorque: GRIP_TORQUE[s.grip] ?? 22, ...s.controlOverrides },
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
const zweihander = finalizeSpec('zweihander', {
  nameKo: '츠바이핸더 (대형 양손검)', nameEn: 'Zweihänder',
  desc: '정예 용병이 쓰던 거대한 양손검.\n느리지만 맞으면 묵직하게 부순다.',
  grip: 'two-hand', material: 'steel',
  tier: 'rare', // 감독 확정: 레어 — 도펠죌트너(정예 용병)만 다루던 특수 대검. power 1.05, 파손 계수 0.032
  hiltLength: 0.19, bladeLength: 1.17, gripAlong: -0.18,
  mCut: 1.1, mThrust: 0.85, mBlunt: 1.15,
  // 자루가 길어(0.16m 반경) 손 사이 지렛대가 롱소드보다 커서, 같은 손 힘으로도 더 큰 돌림힘을
  // 낼 수 있다 (안 그러면 2.9kg 칼이 22N·m 한도 그대로라 너무 굼떠서 전혀 못 이긴다 — 시뮬로 확인)
  controlOverrides: { maxAimTorque: 28 },
  // 양날 대검: 넓은 칼몸, 긴 피홈, 창끝 칼끝. 배 모양 폼멜, 긴 곧은 코등이 (리카소·갈고리는 decorate)
  partMesh: swordKit({
    blade: { edge: 'double', width: (t) => 1 - 0.3 * t, thick: 0.0045, tip: 'spear', tipLen: 0.12, fuller: { to: 0.45, width: 0.2, depth: 0.5 } },
    grip: { style: 'cord' },
    pommel: { style: 'pear' },
    guard: { style: 'bar' },
  }),
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.26, 0.02, 0.16, 0.02);
    const pommel = sphereInertia(0.62, 0.038);
    const cross = boxInertia(0.32, 0.14, 0.02, 0.026);
    const blade = bladeInertia(1.7, L, 0.34, 0.253, 0.056, 0.018);
    return [
      partTuple(['box', 0.02, 0.16, 0.02], 0, 0.26, 0, grip.Ie, grip.It, look.grip),
      partTuple(['ball', 0.038], -0.16, 0.62, 0, pommel.Ie, pommel.It, look.hilt),
      partTuple(['box', 0.14, 0.02, 0.026], 0.175, 0.32, 0, cross.Ie, cross.It, look.hilt),
      partTuple(['box', 0.028, L / 2, 0.009], 0.19 + L / 2, 1.7, blade.comY, blade.Ie, blade.It, 0xd8dde3, true),
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
    //  (고리 모양으로 감으면 장난감처럼 보였다). 옆면에서는 끈이 꺾여 넘어가는 매듭이 보인다.
    const step = 0.034;
    const strip = new THREE.BoxGeometry(0.0062, step * 0.78, 0.0022);
    for (let y = -0.178; y <= 0.205; y += step) {
      for (const sz of [-1, 1]) {
        for (const lean of [-1, 1]) {
          const st = addMesh(group, strip, silk, [0, y, sz * 0.0162]);
          st.rotation.z = lean * 0.72;
          st.castShadow = true;
        }
      }
      for (const sx of [-1, 1]) {
        const knot = addMesh(group, new THREE.BoxGeometry(0.0026, 0.007, 0.022), silk, [sx * 0.0133, y + step / 2, 0]);
        knot.castShadow = true;
      }
    }
  },
});

// ═════════════════════════════════════════════════════════════
//  10) 청강검 (靑鋼劍, qinggang, 옛 id 'jian') — 랴오의 검. 감독 결정으로 지안(중국 검)을 에픽 등급 "청강검"으로
//      바꿨다(삼국지 조조의 보검 — "쇠도 진흙처럼 벤다"). 물리는 지안 자료 그대로: 0.8~0.9kg, 칼날 대개 70~80cm,
//      균형점 자료가 서로 어긋나(~10cm vs ~20cm) 절충 [I]-leaning. 한손이라 누르는 힘이 약하다(12N·m).
//      캐릭터 PM 계약: 가볍고 빠름·찌르기 강함(mThrust 1.15)·전설대로 잘 벰(mCut 1.35, 세이버·팔쉬온급).
//      등급 epic(power 1.1·내구 0.95)이라 실제 베기 배율은 1.35×1.1 ≈ 1.49 —
//      mCut 1.5로 잰 결과(롱소드 상대 승률 22%, 판당 severity 롱소드의 87%)와 같은 급이다.
//      mCut 은 상처 깊이(severity)에만 곱하고 표시되는 타격 J(물리값, 롱소드의 2/3쯤)는 안 바꾼다.
//      겉모습은 푸른 강철 칼날에 검은 자루 [I] 창작. 'jian' 은 별칭으로 남긴다.
// ═════════════════════════════════════════════════════════════
// 옻칠한 검은 자루 + 차분한 청동(과하지 않은 금빛) 장식 — "전설의 명검"이되 요란하지 않게.
const QINGGANG_LOOK = { grip: 0x17171f, hilt: 0x8a6d3b };
const qinggang = finalizeSpec('qinggang', {
  nameKo: '청강검', nameEn: 'Qinggang Sword',
  desc: '쇠도 진흙처럼 벤다던 전설의 검.\n가볍고 빠른 한손 양날검.',
  grip: 'one-hand', material: 'steel',
  enterParry: true, // 들어가며 막기 (10라운드 R3, skill.js): 상대 칼을 받아 낸 순간 한 걸음 안쪽으로 — 짧은 한손 칼
  tier: 'epic',
  ability: '창천: 무기 절단',
  fragility: TIER_FRAGILITY.epic * 0.5, // 특수 능력 (사장님, 카드 표기 없음): 자기가 부러질 확률 50% 감소 (에픽 0.0104 → 0.0052)
  breakMult: 3, // 에픽 특수 능력 '창천: 무기 절단' (사장님): 칼끼리 부딪힐 때 상대 무기가 부러질 확률 ×3 (안 부러지는 무기는 그대로 0)
  hiltLength: 0.12, bladeLength: 0.74,
  mCut: 1.35, mThrust: 1.15, mBlunt: 0.95, // 감독 확정치 (mCut 1.35)
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

// 간장·막야 [I] 창작 제원. 전체 물리 길이는 폼멜끝(-.11)부터 칼끝까지 1.00/.96m.
// 청강검의 네 부품·손 원점을 재사용한다. 후광은 aura.js, 같은 묶음 추첨은 drawGroup 담당.
const LEGENDARY_JIAN = {
  ganjiang: { blade: 0.77, bladeMass: 0.64, gripMass: 0.11, pommelMass: 0.14, guardMass: 0.06,
    halfWidth: 0.015, thick: 0.0034, steel: 0x62625d, grip: 0x201e1b, metal: 0x9a8255, pattern: 0xa48d64 },
  moye: { blade: 0.73, bladeMass: 0.745, gripMass: 0.12, pommelMass: 0.18, guardMass: 0.075,
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
    drawGroup: 'ganjiang_moye', hiltLength: 0.12, bladeLength: d.blade,
    mCut: 1.15, mThrust: 1.15, mBlunt: 0.95,
    partMesh: swordKit({
      blade: { edge: 'double', width: (t) => 1 - 0.25 * t, thick: d.thick,
        tip: 'spear', tipLen: 0.075, overshoot: 0 },
      grip: { style: 'cord' }, pommel: { style: 'disc' }, guard: { style: 'none' }, metal: d.metal,
    }),
    buildParts: legendaryJianParts, decorate: legendaryJianDecorate,
  });
}

const ganjiang = legendaryJianSpec('ganjiang', '간장', 'Ganjiang',
  '어두운 회금빛 칼몸에 귀갑문을 새긴 명검.\n길이 100cm, 질량 0.95kg의 한손 양날검.');
const moye = legendaryJianSpec('moye', '막야', 'Moye',
  '밝은 은강철에 물결 같은 결이 흐르는 명검.\n길이 96cm, 질량 1.12kg의 한손 양날검.');

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
  tier: 'legend', // 감독 등급: 레전드 → power 1.2·durability 1.0. 진품은 플레이어 전용(docs/characters.md)
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
  finishTier: 'legend', // 겉면 마감만 진품과 동일 (등급 마감으로도 구분되면 안 된다 — 오라가 유일한 표식)
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
  hiltLength: 0.135, bladeLength: 0.72, // 10/08: 손 기준 세로 길이만 10% 단축, 질량·굵기 유지.
  tier: 'trash', // 감독 등급: 쓰레기 → power 0.7·durability 0.4·fragility 0.2 (60초 경합에 60% 부러진다)
  edged: false, // 날이 없어 항상 둔기 판정 (총 타격 배율은 power 0.7)
  // 겉모습은 부품(자루·밑동·몸통 상자)마다 따로 그리지 않고 decorate 가 한 줄기로 통째로 그린다 — 따로 그리면
  //  사이가 떠서 세 토막으로 보였다. 껍질 골·이끼·옹이·꺾인 밑동·헝겊 손잡이·잔가지·잎 (weapon_looks.js drawTreeBranch)
  partMesh: hiddenParts,
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.05, 0.02, 0.072, 0.018);
    const pommel = sphereInertia(0.02, 0.015); // 뭉툭한 밑동
    const blade = bladeInertia(0.25, L, 0.55, 0.29, 0.036, 0.03); // 울퉁불퉁, 거의 균일한 막대
    return [
      partTuple(['box', 0.02, 0.072, 0.018], 0, 0.05, 0, grip.Ie, grip.It, 0x5a4530),
      partTuple(['ball', 0.015], -0.09, 0.02, 0, pommel.Ie, pommel.It, 0x5a4530),
      partTuple(['box', 0.018, L / 2, 0.015], this.hiltLength + L / 2, 0.25, blade.comY, blade.Ie, blade.It, 0x6b4423, false),
    ];
  },
  decorate(group) {
    const branch = new THREE.Group();
    drawTreeBranch(branch);
    branch.scale.y = 0.9; // 잔가지·잎도 같은 축척, 손 위치와 가로 굵기는 그대로.
    group.add(branch);
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
  edged: false, mBlunt: 1.6, // 사용자 지정: 기존 2.6에서 낮춤 (2026-10-08).
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
  desc: '얼어 붙은 참치.\n절대 부서지지 않는다.',
  grip: 'two-hand', material: 'frozen',
  hiltLength: 0.15, bladeLength: 0.75, gripAlong: -0.17,
  // 날이 없어 몸통 타격은 무해하다(§고무 닭 주석) → 머리에 맞았을 때만 확실히 세게 만든다
  // 과거 보상 2.8에서 사용자 지정 2.6으로 조정(10/08). 새 승률을 근거로 한 값은 아니다.
  tier: 'mystery', // 사장님 결정: ??? 등급 (계수는 커먼 그대로, 카드에 드물게 나온다 — 등급 전체 5%)
  edged: false, mBlunt: 2.6, fragility: 0, // 감독 지시: 참치는 부러지지 않는다 (통째로 얼린 덩어리)
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
  moveMul: 1.4, // 걷는 최고 속도 ×1.4 (도망 다니며 쏘라고 — 사장님 '칼 들었을 때보다 30% 빠르게' → 9/29 '1.3배에서 1.4배로 상향')
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

// 무기마다 적은 desc 는 무기 뽑기 카드(main.js)의 앞면에 쓰는 한두 줄 설명이다 (\n 으로 줄을 나눈다).
//  글자 데이터일 뿐 물리·밸런스와는 상관없다. 카드 앞면의 작은 그림은 public/ui/weapons/<id>.webp
//  (tools/browser/weapon_thumbs.mjs 로 이 무기 모델을 그대로 찍어 만든다 — 겉모습을 바꾸면 다시 돌린다).
// [I] 무거운 한손 철퇴. RA VIII.70(64.8cm/2.1kg)·Met14.25.171(73.2cm/822g)
// 두 실물을 참고한 재구성이며 사용자 후속 지정으로 전체69cm/2.2kg, 손 쪽 무게중심으로 수정했다.
// 8cm 강철 구의 소켓(r21.404mm, 깊이70mm)과 손잡이 보강추로 질량을 실제 재배치한다.
// docs/strike/weapon_compact_20261008.md, tools/sim/morgenstern_design.mjs: 계산과 한계.
// 머리는 'blade' 접촉 이름을 쓰지만 날은 없다. 앞쪽 축방향 접촉만 가시 찌르기.
const morgenstern = finalizeSpec('morgenstern', {
  nameKo: '모르겐슈테른', nameEn: 'Morgenstern',
  desc: '2.2kg의 무거운 한손 가시 철퇴.\n앞쪽 가시로 찌르며, 갑옷을 무시하지 않는다.',
  grip: 'one-hand', material: 'steel',
  hiltLength: 0.4535, bladeLength: 0.135,
  breakAt: 0.05, // y=.46025: 철구·고정대 아래 나무 자루에서 부러진다.
  edged: false, spike: true, mCut: 0, mThrust: 0.35, mBlunt: 2.1,
  partMesh: morgensternKit({ headRadius: 0.04, spikeLength: 0.025, spikeRadius: 0.007,
    rings: { 2: MACE.parts.collar, 4: MACE.parts.sleeve } }),
  buildParts() {
    // 재료 체적으로 계산한 COM·관성. 머리는 index3, 나무 바깥의 강철 보강 고리는 index4.
    const keys = ['shaft', 'butt', 'collar', 'head', 'sleeve'];
    const colors = [0x64432b, 0x676769, 0x73757a, 0x727780, 0x676769];
    return keys.map((key, i) => {
      const p = MACE.parts[key];
      return partTuple([...p.shape], p.y, p.mass, p.comY, p.Ie, p.It, colors[i], key === 'head');
    });
  },
});

export const WEAPONS = {
  longsword, zweihander, estoc, sabre, rapier, falchion,
  monohoshizao, qinggang, ganjiang, moye, excalibur, excalibur_replica: excaliburReplica, lightsaber, tree_branch: treeBranch,
  rubber_chicken: rubberChicken, frozen_tuna: frozenTuna, pistol, morgenstern,
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
};

// 아무 무기도 지정하지 않았을 때(o.weapon 없음) 쓰는 기본 무기.
export const DEFAULT_WEAPON = 'longsword';

export const WEAPON_LIST = Object.values(WEAPONS).filter((w) => !w.trialOnly);
export const TRIAL_WEAPON_LIST = Object.values(WEAPONS).filter((w) => w.trialOnly);

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

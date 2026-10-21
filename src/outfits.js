import { decorateAlter } from './outfit_alter.js';
// ─────────────────────────────────────────────────────────────
//  겉모습 장식 레이어. fighter.js의 dressPart가 만든 기본 몸통(상자·캡슐) 위에
//  갑옷판·머리모양·수염·안대 같은 장식 메쉬를 "얹기만" 한다 — 콜라이더·질량·관절은
//  전혀 건드리지 않는다(완전히 시각 전용). 각 부위(pelvis, chest, uarmS...)는 몸의
//  래그돌 부위 그룹에 직접 자식으로 붙으므로, 그 부위가 넘어지든 흔들리든 항상 같이 따라간다.
//
//  좌표 규칙: dressPart와 같은 "그 부위 몸체 기준" 좌표를 쓴다(+x 앞, +y 위, +z 오른쪽).
//  칼 든 팔(uarmS·farmS)은 뼈가 앞으로 누워 있어 자세히 보면 그 부위에 넘겨준 그룹(dressTo)이
//  이미 알맞게 돌아가 있다 — dressPart가 이 그룹에 손 구체를 y=-0.135(먼 쪽=손목)에 놓은 것과
//  똑같이, 이 파일에서도 "+y = 몸통에 가까운 쪽(어깨), -y = 먼 쪽(손목)"로 다룬다.
//
//  삼각형·드로우콜을 아끼려고, 부위 하나에 여러 조각을 붙일 때는 지오메트리를 하나로 합쳐서
//  (mergeGeometries) 재질 하나당 메쉬 하나만 만든다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { weaponEnv } from './weapon_looks.js';
import { createRenjiOutfit } from './outfit_renji.js'; // 김씨 복식 (샛별 저장소에서 가져옴)
import { createEiraOutfit } from './outfit_eira.js'; // 에이라 린드(지금 투야나 니콜라예바) 복식 v1 (샛별 저장소에서 가져옴)
import { createSamiraOutfit } from './outfit_samira.js'; // 사미라 v2 앙가르카 (디자인 리뷰 10/10)
import { createArtoriaBallroomOutfit } from './outfit_artoria_ballroom.js'; // 광기의 아르토리아 궁정 예복 v4-alter13 (샛별 저장소에서 가져옴 10/17 — 사장님 10/16~17 결정, 샛별 쪽)
import { createTuyanaOutfit } from './outfit_tuyana.js'; // 투야나 v2 겨울 사제복 (디자인 리뷰 10/10)
import { createRenjiBajiOutfit } from './outfit_renji_baji.js'; // 김씨 v2 하카마 → 바지·행전 (외형 다듬기 2차 10/10)
import { createRatnaOutfit } from './outfit_ratna.js'; // 라트나 위라세타쿤 복식 (샛별 저장소에서 가져옴 10/14 — 샛별 v1~v3 + 우리 v4)
import { createSilverWandererOutfit } from './outfit_silver_wanderer.js'; // 다라이시 복식 v1 (샛별 저장소에서 가져옴 10/14)
import { createSilverWandererDetail } from './outfit_silver_wanderer_detail.js'; // 다라이시 v2~ (장식 · 긴 머리 · 반묶음 · 땋음 — 샛별 v2·v4~v6 + 우리 v7~v10)
import { createChandaOutfit } from './outfit_chanda.js'; // 찬다 복식 (샛별 저장소에서 가져옴 10/14 — 샛별 v1 + 우리 v2 무릎)
import { createTerracottaOutfit } from './outfit_terracotta.js'; // 병마용 복식 (샛별 저장소에서 가져옴 10/14 — 샛별 v1 + 우리 v2 잔선 덜기)
import { createReturnedKingOutfit } from './outfit_returned_king.js';
import { createReturnedKingOutfitV2 } from './outfit_returned_king_v2.js';

const _m4 = new THREE.Matrix4();
const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3(1, 1, 1);

/** geo를 제자리에서 옮기고/돌리고/늘려서 돌려준다 (합치기 전에 각 조각을 부위 좌표로 "굽는다") */
function bake(geo, pos, rotEuler, scale) {
  _pos.set(pos ? pos[0] : 0, pos ? pos[1] : 0, pos ? pos[2] : 0);
  if (rotEuler) {
    _euler.set(rotEuler[0] || 0, rotEuler[1] || 0, rotEuler[2] || 0);
    _quat.setFromEuler(_euler);
  } else {
    _quat.identity();
  }
  _scale.set(scale ? scale[0] : 1, scale ? scale[1] : 1, scale ? scale[2] : 1);
  _m4.compose(_pos, _quat, _scale);
  geo.applyMatrix4(_m4);
  return geo;
}

const box = (w, h, d, pos, rot, scale) => bake(new THREE.BoxGeometry(w, h, d), pos, rot, scale);
const cyl = (rt, rb, h, segs, open, pos, rot) => bake(new THREE.CylinderGeometry(rt, rb, h, segs, 1, !!open), pos, rot);
const ball = (r, wSeg, hSeg, pos, rot, arcs) =>
  bake(new THREE.SphereGeometry(r, wSeg, hSeg, arcs?.[0] ?? 0, arcs?.[1] ?? Math.PI * 2, arcs?.[2] ?? 0, arcs?.[3] ?? Math.PI), pos, rot);
const cone = (r, h, segs, pos, rot) => bake(new THREE.ConeGeometry(r, h, segs), pos, rot);

/** 조각 목록을 하나로 합쳐 재질 하나짜리 메쉬로 붙인다. 곡면(투구·안대 등)은 double-side가 필요할 때만 켠다 */
function addMerged(parent, pieces, color, matOpts) {
  if (!pieces.length) return null;
  const geo = mergeGeometries(pieces, false);
  // mergeGeometries copies the attributes; temporary construction pieces never
  // become scene objects and must not outlive the merged geometry.
  for (const piece of pieces) piece.dispose();
  // 금속판은 무기와 같은 반사 환경(하늘·바다·모래)을 비춘다 — 장면에 반사 환경이 없어서, 금속성이 높은
  // 판은 비출 게 없어 거의 검게 보였다(하인리히 은빛 갑옷이 짙은 회색으로 나오던 원인).
  // 환경 텍스처는 여기서(isolatedVisual 안) 처음 만들어져 전역 난수를 건드리지 않는다
  const { steel, ...opts } = matOpts || {};
  if (steel) Object.assign(opts, { envMap: weaponEnv(), envMapIntensity: steel });
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.06, ...opts });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

const STEEL_OPTS = { metalness: 0.7, roughness: 0.35, steel: 1 };

// ═══════════════════════════════════ 오소리 브란: 화전민 농부 ═══════════════════════════════════
const APRON = 0xcdbb92;
const APRON_DARK = 0xa89468;
const CUFF_BRAN = 0x6b5637;
const BRAN_FARMER = {
  head() {}, // The visual-only alter kettle is attached by decorateAlter.
  abdomen(g) {
    // 앞치마 위쪽 (가슴받이)
    addMerged(g, [box(0.16, 0.14, 0.02, [0.16, 0.03, 0])], APRON);
  },
  pelvis(g) {
    // 앞치마 아래쪽 (허리부터 허벅지 위까지, 기존 옷자락 겉에 한 겹 더)
    addMerged(g, [cone(0.13, 0.22, 10, [0.15, -0.16, 0])], APRON);
    // 허리에 묶은 끈 자락 두 개 (앞으로 늘어짐)
    addMerged(g, [cyl(0.006, 0.006, 0.16, 4, false, [0.15, -0.28, -0.03], [0, 0, 0.15]), cyl(0.006, 0.006, 0.14, 4, false, [0.15, -0.3, 0.03], [0, 0, -0.1])], APRON_DARK);
  },
  // 소매를 걷어붙인 자국: 팔뚝 먼 쪽(손목 방향)에 두른 어두운 띠
  farmS(g) {
    addMerged(g, [cyl(0.05, 0.05, 0.03, 10, true, [0, -0.09, 0])], CUFF_BRAN);
  },
  farmO(g) {
    addMerged(g, [cyl(0.05, 0.05, 0.03, 10, true, [0, -0.09, 0])], CUFF_BRAN);
  },
};

// ═══════════════════════════════════ 이졸데 반 아커러: 평상복 ═══════════════════════════════════
const ISOLDE_SKIRT = 0x2b2e36;
const ISOLDE_TRIM = 0x4a4d57;
const ISOLDE_SABER = {
  // 옷깃 (목 둘레 얇은 테)
  chest(g) {
    addMerged(g, [cyl(0.078, 0.09, 0.03, 12, true, [0, 0.17, 0])], ISOLDE_TRIM);
  },
  // 허리 리본 (얇은 띠 하나, 화려하지 않게)
  abdomen(g) {
    addMerged(g, [box(0.006, 0.04, 0.05, [0.118, -0.02, 0])], ISOLDE_TRIM);
  },
  // 긴 치마 자락: 다리마다 따로 붙여서(래그돌이 벌어져도) 겹치지 않게, 넓적다리를 반쯘 덮는다
  thighF(g) {
    addMerged(g, [cyl(0.075, 0.15, 0.32, 12, true, [0, 0.02, 0])], ISOLDE_SKIRT, { side: THREE.DoubleSide });
  },
  thighB(g) {
    addMerged(g, [cyl(0.075, 0.15, 0.32, 12, true, [0, 0.02, 0])], ISOLDE_SKIRT, { side: THREE.DoubleSide });
  },
};

// 이졸데 v2(오너 요청): 허리까지 오는 긴 생머리. 머리 하나에 긴 머리를 통째로 붙이면 고개를 돌릴 때마다
// 허리까지 오는 판이 몸을 뚫고 휘둘려서, 세 도막으로 나눠 따라가는 부위에 붙인다 —
// 머리(뒤통수~목덜미, 얼굴 옆 머리) / 가슴(등을 덮는 머리) / 배(허리까지 내려와 끝이 둥글게 모이는 머리).
// 가만히 선 자세에서 세 도막이 이어져 보이게 위치를 맞췄다(목덜미 ≈ 가슴 위쪽, 등 아래 ≈ 배 위쪽).
const ISOLDE_LONGHAIR = {
  ...ISOLDE_SABER,
  head(g, look) {
    addMerged(
      g,
      [
        box(0.04, 0.17, 0.17, [-0.092, -0.075, 0]), // 뒤통수에서 목덜미까지
        box(0.022, 0.15, 0.018, [0.025, -0.06, 0.1]), // 얼굴 옆으로 흘러내린 머리
        box(0.022, 0.15, 0.018, [0.025, -0.06, -0.1]),
      ],
      look.hair,
      { roughness: 1 },
    );
  },
  chest(g, look) {
    ISOLDE_SABER.chest(g, look);
    // 등을 덮는 머리 (어깨 너비보다 조금 좁게)
    const bob=look.alter==='isolde';
    addMerged(g, [box(0.03, bob?0.09:0.3, 0.2, [-0.137, bob?0.105:0, 0])], look.hair, { roughness: 1 });
  },
  abdomen(g, look) {
    ISOLDE_SABER.abdomen(g, look);
    if(look.alter==='isolde')return; // shoulder-length cut keeps the original head/side shapes
    // 허리까지: 아래로 갈수록 좁아지고 끝이 둥글게 모인다
    addMerged(
      g,
      [
        box(0.028, 0.1, 0.18, [-0.128, 0.03, 0]),
        bake(new THREE.CylinderGeometry(0.09, 0.03, 0.09, 8, 1, false), [-0.128, -0.065, 0], null, [0.16, 1, 1]),
      ],
      look.hair,
      { roughness: 1 },
    );
  },
};

// ═══════════════════════════════════ 랴오 쓰위엔: 방랑 낭인 ═══════════════════════════════════
const LIAO_RONIN = {
  head(g) {
    // 장발: 뒤로 묶어 아래로 늘어뜨린 머리 (목~등 뒤까지)
    const hairPieces = [
      cyl(0.045, 0.03, 0.05, 10, false, [-0.09, -0.03, 0]), // 묶은 자리
      cone(0.035, 0.22, 8, [-0.1, -0.16, 0], [0.08, 0, 0]),
    ];
    addMerged(g, hairPieces, 0x111111, { roughness: 1 });
    // 안대: 한쪽 눈(기본 얼굴의 왼쪽 눈 상자와 같은 자리)만 작게 가리는 판 + 관자놀이로 짧게 이어지는 끈
    const patch = [
      ball(0.02, 10, 8, [0.096, 0.016, -0.035], [0, 0.3, 0]),
      cyl(0.004, 0.004, 0.05, 4, false, [0.07, 0.04, -0.06], [0, 0, 1.0]),
      cyl(0.004, 0.004, 0.05, 4, false, [0.07, -0.01, -0.06], [0, 0, -1.0]),
    ];
    addMerged(g, patch, 0x1a1a1a, { roughness: 0.9 });
  },
};

// 랴오 v2(오너 요청): "동양 무도가 같은 푸른색 도복, 하오마루 같이 생긴 옷". 사무라이 쇼다운 계열의
// 떠돌이 무도가 실루엣만 참고한 새 디자인 — 가슴에서 V자로 여미는 푸른 도복 윗도리(속에 흰 속옷이
// 보인다), 팔꿈치 쪽으로 넓어지는 소매, 흰 새끼줄 허리띠 매듭, 발목까지 내려오는 넓은 남색 통바지(하카마).
// 장발·안대(머리)는 v1 그대로. 넓은 소매·바지는 팔·다리 부위마다 따로 붙어 래그돌을 따라간다.
const GI_BLUE = 0x3a5f9e;
const GI_LAPEL = 0x27447a;
const GI_WHITE = 0xe8e2d0;
const HAKAMA = 0x1e2a44;
const giSleeve = (g) => addMerged(g, [cyl(0.062, 0.1, 0.2, 12, true, [0, -0.02, 0])], GI_BLUE, { side: THREE.DoubleSide });
const hakamaLeg = (g, rt, rb, h, y) => addMerged(g, [cyl(rt, rb, h, 12, true, [0, y, 0])], HAKAMA, { side: THREE.DoubleSide });
const LIAO_GI = {
  ...LIAO_RONIN,
  chest(g) {
    // 흰 속옷 + V자로 여민 깃(짙은 파랑)
    addMerged(g, [box(0.004, 0.1, 0.07, [0.121, 0.075, 0])], GI_WHITE);
    addMerged(
      g,
      [box(0.007, 0.24, 0.04, [0.124, 0.03, 0.045], [0.42, 0, 0]), box(0.007, 0.24, 0.04, [0.124, 0.03, -0.045], [-0.42, 0, 0])],
      GI_LAPEL,
    );
  },
  abdomen(g) {
    // 새끼줄 허리띠 매듭과 늘어진 두 끝자락
    addMerged(
      g,
      [box(0.03, 0.045, 0.05, [0.125, -0.05, 0.06]), box(0.01, 0.1, 0.018, [0.127, -0.11, 0.05], [0.15, 0, 0]), box(0.01, 0.085, 0.018, [0.127, -0.105, 0.075], [-0.2, 0, 0])],
      GI_WHITE,
    );
  },
  uarmS: giSleeve,
  uarmO: giSleeve,
  // 넓은 소매가 아래팔 위쪽까지 덮는다
  farmS(g) {
    addMerged(g, [cyl(0.1, 0.09, 0.09, 12, true, [0, 0.06, 0])], GI_BLUE, { side: THREE.DoubleSide });
  },
  farmO(g) {
    addMerged(g, [cyl(0.1, 0.09, 0.09, 12, true, [0, 0.06, 0])], GI_BLUE, { side: THREE.DoubleSide });
  },
  // 하카마: 허벅지부터 발목까지 통이 넓다 (다리마다 따로라 걸음이 읽힌다)
  thighF: (g) => hakamaLeg(g, 0.09, 0.12, 0.34, 0),
  thighB: (g) => hakamaLeg(g, 0.09, 0.12, 0.34, 0),
  shinF: (g) => hakamaLeg(g, 0.115, 0.125, 0.3, 0.03),
  shinB: (g) => hakamaLeg(g, 0.115, 0.125, 0.3, 0.03),
};

// 랴오 v3(오너 요청): "좀 더 풍성한 꽁지머리 산발, V넥 위로 살색이 보여 V넥 강조".
//  · 머리: 뒤통수 높이 묶은 굵은 꽁지머리가 여러 가닥으로 부채처럼 뻗고, 정수리·옆·앞머리에 삐친
//    가닥을 달아 산발로. 안대·머리띠는 그대로.
//  · 가슴: 흰 속옷을 빼고 V자 깃 사이로 맨살(피부색 삼각형)이 보이게.
const LIAO_TUFTS = [
  // [위치, 회전] — 머리 둘레에서 바깥으로 삐친 짧은 가닥
  [[-0.02, 0.1, 0.05], [0.5, 0, 0.3]],
  [[-0.02, 0.1, -0.05], [-0.5, 0, 0.3]],
  [[-0.06, 0.08, 0.0], [0, 0, 0.9]],
  [[0.02, 0.11, 0.0], [0, 0, -0.2]],
  [[-0.04, 0.03, 0.095], [1.3, 0, 0.4]],
  [[-0.04, 0.03, -0.095], [-1.3, 0, 0.4]],
  [[0.03, 0.07, 0.08], [0.9, 0, -0.3]],
  [[0.03, 0.07, -0.08], [-0.9, 0, -0.3]],
];
const LIAO_TAIL = [
  // 묶은 자리에서 뒤·아래로 부채처럼 퍼지는 꽁지머리 가닥들 (굵기는 끝으로 갈수록 가늘게)
  [[-0.1, 0.07, 0], [-0.17, 0.05, 0], [-0.22, -0.04, 0], [-0.24, -0.16, 0]],
  [[-0.1, 0.07, 0.01], [-0.16, 0.06, 0.04], [-0.21, -0.02, 0.07], [-0.23, -0.12, 0.09]],
  [[-0.1, 0.07, -0.01], [-0.16, 0.06, -0.04], [-0.21, -0.02, -0.07], [-0.23, -0.12, -0.09]],
  [[-0.1, 0.075, 0], [-0.18, 0.1, 0.02], [-0.25, 0.06, 0.03], [-0.29, -0.02, 0.02]],
  [[-0.1, 0.07, 0], [-0.15, 0.03, 0.02], [-0.17, -0.08, 0.03], [-0.17, -0.19, 0.04]],
];
const LIAO_GI_WILD = {
  ...LIAO_GI,
  head(g, look) {
    const hair = [
      new THREE.SphereGeometry(0.035, 8, 6).translate(-0.095, 0.07, 0), // 묶은 자리 (굵은 뭉치)
      ...LIAO_TUFTS.map(([p, r]) => bake(new THREE.ConeGeometry(0.028, 0.075, 5), p, r)),
      // 앞머리: 이마 위로 흩어진 짧은 가닥 셋 (눈·안대는 가리지 않게 머리띠 위쪽)
      bake(new THREE.ConeGeometry(0.018, 0.05, 4), [0.085, 0.075, 0.03], [0.4, 0, -1.0]),
      bake(new THREE.ConeGeometry(0.018, 0.05, 4), [0.088, 0.075, -0.015], [-0.3, 0, -1.1]),
      bake(new THREE.ConeGeometry(0.016, 0.045, 4), [0.075, 0.09, 0.055], [0.6, 0, -0.8]),
      ...LIAO_TAIL.map((pts, i) => taperedTube(pts, [0.03 - i * 0.002, 0.026, 0.016, 0.003], 10, 6)),
    ];
    addMerged(g, hair, look.hair, { roughness: 1 });
    // 안대: v1과 같은 자리·크기
    const patch = [
      ball(0.02, 10, 8, [0.096, 0.016, -0.035], [0, 0.3, 0]),
      cyl(0.004, 0.004, 0.05, 4, false, [0.07, 0.04, -0.06], [0, 0, 1.0]),
      cyl(0.004, 0.004, 0.05, 4, false, [0.07, -0.01, -0.06], [0, 0, -1.0]),
    ];
    addMerged(g, patch, 0x1a1a1a, { roughness: 0.9 });
  },
  chest(g, look) {
    // V자로 파인 깃 사이의 맨살 (삼각형, 가슴판 앞면에 붙인다)
    const tri = new THREE.Shape([new THREE.Vector2(-0.085, 0.145), new THREE.Vector2(0.085, 0.145), new THREE.Vector2(0, -0.035)]);
    addMerged(g, [new THREE.ShapeGeometry(tri).rotateY(Math.PI / 2).translate(0.1235, 0, 0)], look.skin, { roughness: 0.8 });
    addMerged(
      g,
      [box(0.008, 0.24, 0.04, [0.125, 0.03, 0.045], [0.42, 0, 0]), box(0.008, 0.24, 0.04, [0.125, 0.03, -0.045], [-0.42, 0, 0])],
      GI_LAPEL,
    );
  },
};

// 랴오 v4(오너 피드백 "너무 뾰족해, 컬과 볼륨이 있는 머리"): v3의 뾰족한 원뿔 대신 둥근 곱슬 뭉치로
// 머리 전체를 부풀리고, 꽁지머리도 좌우로 굽이치는 곱슬 덩어리로 흘러내리게 한다. 가슴은 V자 깃 안쪽에
// 흰 속깃이 살짝 겹쳐 보이고 그 안으로 맨살. 난수 없이 황금각 나선으로 곱슬 자리를 골고루 정한다.
const LIAO_CURLS = (() => {
  const out = [];
  const n = 70;
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) / n) * 2;
    const r = Math.sqrt(1 - y * y);
    const a = i * 2.39996;
    const d = [Math.cos(a) * r, y, Math.sin(a) * r]; // 머리 중심에서 본 방향
    if (d[1] < -0.15) continue; // 턱 아래는 없다
    if (d[0] > 0.45 && d[1] < 0.6) continue; // 얼굴은 비운다
    if (d[1] < 0.15 && d[0] > -0.2) continue; // 귀 아래 옆얼굴도 비운다
    const size = 0.03 + (i % 3) * 0.005;
    out.push([[-0.01 + d[0] * 0.1, 0.01 + d[1] * 0.1, d[2] * 0.1], size]);
  }
  return out;
})();
// 꽁지머리: 묶은 자리에서 뒤·아래로, 좌우로 번갈아 굽이치며 점점 작아지는 곱슬 덩어리
const LIAO_CURLY_TAIL = Array.from({ length: 10 }, (_, i) => {
  const t = i / 9;
  return [[-0.11 - t * 0.12, 0.07 - t * 0.28, (i % 2 ? 1 : -1) * 0.025 * (1 - t * 0.5)], 0.042 - t * 0.02];
});
const LIAO_GI_CURLY = {
  ...LIAO_GI_WILD,
  head(g, look) {
    const lump = ([p, r]) => bake(new THREE.SphereGeometry(r, 7, 5), p, null, [1, 0.9, 1]);
    const hair = [
      ...LIAO_CURLS.map(lump),
      new THREE.SphereGeometry(0.04, 8, 6).translate(-0.1, 0.07, 0), // 묶은 자리
      ...LIAO_CURLY_TAIL.map(lump),
      // 곁가지로 한 줄 더 — 꽁지머리에 볼륨
      ...LIAO_CURLY_TAIL.slice(1, 7).map(([[x, y, z], r]) => lump([[x + 0.015, y + 0.01, -z * 1.6], r * 0.8])),
      // 앞머리: 머리띠 위로 둥글게 넘친 곱슬 셋 (눈·안대는 가리지 않는다)
      lump([[0.075, 0.068, 0.035], 0.026]),
      lump([[0.08, 0.072, -0.005], 0.026]),
      lump([[0.07, 0.078, -0.045], 0.024]),
    ];
    addMerged(g, hair, look.hair, { roughness: 1 });
    const patch = [
      ball(0.02, 10, 8, [0.096, 0.016, -0.035], [0, 0.3, 0]),
      cyl(0.004, 0.004, 0.05, 4, false, [0.07, 0.04, -0.06], [0, 0, 1.0]),
      cyl(0.004, 0.004, 0.05, 4, false, [0.07, -0.01, -0.06], [0, 0, -1.0]),
    ];
    addMerged(g, patch, 0x1a1a1a, { roughness: 0.9 });
  },
  chest(g, look) {
    LIAO_GI_WILD.chest(g, look);
    // 흰 속깃: 파란 깃 바로 안쪽에 나란히, 살짝 겹쳐 보이게 (파란 깃보다 한 겹 뒤, 맨살보다 한 겹 앞)
    addMerged(
      g,
      [box(0.003, 0.22, 0.02, [0.1245, 0.035, 0.022], [0.42, 0, 0]), box(0.003, 0.22, 0.02, [0.1245, 0.035, -0.022], [-0.42, 0, 0])],
      GI_WHITE,
    );
  },
};

// 랴오 v5(오너 피드백: "v3 꽁지머리는 그대로, 스파이크 같은 뾰족한 부분을 양옆으로 자연스럽게 흘러내리는
// 중단발 컬로"): v3의 부채꼴 꽁지머리·묶은 자리는 그대로 두고, 삐친 원뿔 가닥을 모두 빼는 대신 관자놀이에서
// 얼굴 옆을 따라 물결치며 턱~어깨 길이로 내려와 끝이 안으로 말리는 가닥(한쪽 셋)을 단다. 앞머리는 이마 양옆으로
// 넘어가는 부드러운 가닥 하나씩(눈·안대는 가리지 않는다). 가슴은 v4(흰 속깃 + 맨살) 그대로.
const LIAO_SIDE_LOCKS = [
  // 오른쪽(+z) 기준 — 왼쪽은 z를 뒤집어 쓴다. 굵기는 LIAO_LOCK_R
  [[0.04, 0.07, 0.085], [0.05, 0.02, 0.113], [0.045, -0.04, 0.113], [0.03, -0.09, 0.12], [0.042, -0.125, 0.1]],
  [[-0.01, 0.085, 0.09], [-0.01, 0.02, 0.12], [-0.015, -0.05, 0.124], [-0.03, -0.1, 0.127], [-0.015, -0.135, 0.108]],
  [[-0.06, 0.075, 0.075], [-0.072, 0.01, 0.1], [-0.078, -0.05, 0.106], [-0.085, -0.1, 0.112], [-0.068, -0.135, 0.096]],
];
const LIAO_LOCK_R = [0.02, 0.024, 0.021, 0.015, 0.005];
const LIAO_BANG = [[0.05, 0.095, 0.0], [0.085, 0.075, 0.035], [0.1, 0.05, 0.065], [0.095, 0.035, 0.085]];
const LIAO_GI_WAVY = {
  ...LIAO_GI_CURLY,
  head(g, look) {
    const flip = (pts) => pts.map(([x, y, z]) => [x, y, -z]);
    const hair = [
      new THREE.SphereGeometry(0.035, 8, 6).translate(-0.095, 0.07, 0), // 묶은 자리 (v3와 같다)
      ...LIAO_TAIL.map((pts, i) => taperedTube(pts, [0.03 - i * 0.002, 0.026, 0.016, 0.003], 10, 6)), // v3 꽁지머리
      ...LIAO_SIDE_LOCKS.flatMap((pts) => [taperedTube(pts, LIAO_LOCK_R, 12, 6), taperedTube(flip(pts), LIAO_LOCK_R, 12, 6)]),
      taperedTube(LIAO_BANG, [0.016, 0.018, 0.013, 0.004], 8, 5),
      taperedTube(flip(LIAO_BANG), [0.016, 0.018, 0.013, 0.004], 8, 5),
    ];
    addMerged(g, hair, look.hair, { roughness: 1 });
    const patch = [
      ball(0.02, 10, 8, [0.096, 0.016, -0.035], [0, 0.3, 0]),
      cyl(0.004, 0.004, 0.05, 4, false, [0.07, 0.04, -0.06], [0, 0, 1.0]),
      cyl(0.004, 0.004, 0.05, 4, false, [0.07, -0.01, -0.06], [0, 0, -1.0]),
    ];
    addMerged(g, patch, 0x1a1a1a, { roughness: 0.9 });
  },
};

// 랴오 v6~v8(오너 요청: "양옆으로 내려오는 느낌 말고 다른 중단발 컬도 보여줘, 입에 풀을 물고"):
// 비교용 세 가지. 모두 v3 부채꼴 꽁지머리·안대·머리띠·v4 V넥(흰 속깃+맨살)을 유지하고, 입가에 풀 한 줄기를 문다.
//  v6 뒤로 넘긴 웨이브 — 이마에서 정수리를 넘어 목덜미까지 물결치며 뒤로 흐르는 가닥
//  v7 반묶음 — 윗머리는 꽁지로 묶고, 나머지 곱슬이 뒤통수에서 목덜미로 늘어진다(얼굴 옆은 비움)
//  v8 헝클어진 바람머리 — 곱슬 가닥이 머리 둘레에서 한쪽 뒤로 쓸려 흩어지고, 앞머리가 이마를 비스듬히 가로지른다
const LIAO_GRASS = [[0.093, -0.045, 0.02], [0.13, -0.042, 0.045], [0.168, -0.028, 0.072], [0.2, -0.008, 0.092]];
function liaoWavyHead(locks) {
  return function head(g, look) {
    const hair = [
      new THREE.SphereGeometry(0.035, 8, 6).translate(-0.095, 0.07, 0),
      ...LIAO_TAIL.map((pts, i) => taperedTube(pts, [0.03 - i * 0.002, 0.026, 0.016, 0.003], 10, 6)),
      ...locks.map(([pts, radii]) => taperedTube(pts, radii, 12, 6)),
    ];
    addMerged(g, hair, look.hair, { roughness: 1 });
    const patch = [
      ball(0.02, 10, 8, [0.096, 0.016, -0.035], [0, 0.3, 0]),
      cyl(0.004, 0.004, 0.05, 4, false, [0.07, 0.04, -0.06], [0, 0, 1.0]),
      cyl(0.004, 0.004, 0.05, 4, false, [0.07, -0.01, -0.06], [0, 0, -1.0]),
    ];
    if (!look.blindfold) addMerged(g, patch, 0x1a1a1a, { roughness: 0.9 });
    else for (const geo of patch) geo.dispose();
    // 입가에 문 풀 한 줄기 (입꼬리에서 앞·옆으로, 끝이 살짝 들린다) + 끝의 이삭
    addMerged(
      g,
      [taperedTube(LIAO_GRASS, [0.0035, 0.003, 0.0022, 0.001], 8, 4), new THREE.SphereGeometry(0.006, 5, 4).scale(1.8, 0.8, 0.8).translate(0.197, -0.01, 0.09)],
      0x6f8f3a,
      { roughness: 0.9 },
    );
  };
}
const mz = (pts, k = 1) => pts.map(([x, y, z]) => [x, y, z * k]);
// v6: 뒤로 넘긴 웨이브 — z 자리 다섯 곳에서 앞이마 → 정수리 → 뒤통수 → 목덜미, 높낮이가 물결친다
const LIAO_SWEPT = [-0.06, -0.03, 0, 0.03, 0.06].map((zc, i) => [
  [
    [0.07, 0.08 + (i % 2) * 0.01, zc * 0.8],
    [0.03, 0.118, zc],
    [-0.03, 0.112, zc * 1.15],
    [-0.085, 0.075, zc * 1.3],
    [-0.118, 0.0, zc * 1.3],
    [-0.108, -0.07, zc * 1.15],
    [-0.09, -0.115, zc * 0.9],
  ],
  [0.018, 0.024, 0.026, 0.025, 0.02, 0.013, 0.004],
]);
// v7: 반묶음 — 뒤통수 아래쪽에서 목덜미로 늘어지는 곱슬(끝이 안으로 말림), 귀 뒤 짧은 가닥 둘
const LIAO_HALFUP = [
  ...[-0.07, -0.035, 0, 0.035, 0.07].map((zc) => [
    [
      [-0.095, 0.02, zc],
      [-0.118, -0.04, zc * 1.12],
      [-0.108, -0.1, zc * 1.08],
      [-0.09, -0.14, zc * 0.95],
      [-0.07, -0.145, zc * 0.8],
    ],
    [0.022, 0.025, 0.02, 0.012, 0.004],
  ]),
  ...[1, -1].map((s) => [
    [
      [-0.04, 0.02, s * 0.1],
      [-0.06, -0.04, s * 0.115],
      [-0.055, -0.09, s * 0.108],
      [-0.04, -0.105, s * 0.095],
    ],
    [0.018, 0.02, 0.012, 0.004],
  ]),
];
// v8: 헝클어진 바람머리 — 머리 둘레 여덟 곳에서 가닥이 밖·아래로 뻗다가 모두 뒤(-x)와 한쪽(-z)으로 쓸린다
const LIAO_TOUSLED = [
  ...Array.from({ length: 8 }, (_, i) => {
    const a = Math.PI * 0.35 + (i / 8) * Math.PI * 1.3; // 앞얼굴을 뺀 둘레 (옆~뒤~옆)
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const r0 = 0.1;
    return [
      [
        [dx * r0 * 0.6, 0.085, dz * r0 * 0.6],
        [dx * 0.118, 0.04, dz * 0.118],
        [dx * 0.12 - 0.03, -0.02, dz * 0.12 - 0.025],
        [dx * 0.11 - 0.06, -0.075, dz * 0.11 - 0.045],
        [dx * 0.1 - 0.07, -0.1, dz * 0.1 - 0.03],
      ],
      [0.02, 0.024, 0.02, 0.012, 0.004],
    ];
  }),
  // 이마를 비스듬히 가로지르는 앞머리 (오른쪽 위 → 왼쪽, 안대 위를 지나 눈썹 위에서 멈춘다)
  [
    [
      [0.06, 0.1, 0.05],
      [0.095, 0.075, 0.02],
      [0.105, 0.058, -0.02],
      [0.097, 0.05, -0.06],
      [0.08, 0.035, -0.085],
    ],
    [0.016, 0.02, 0.018, 0.012, 0.004],
  ],
];
const LIAO_GI_SWEPT = { ...LIAO_GI_CURLY, head: liaoWavyHead(LIAO_SWEPT) };
const LIAO_GI_HALFUP = { ...LIAO_GI_CURLY, head: liaoWavyHead(LIAO_HALFUP) };
const LIAO_GI_TOUSLED = { ...LIAO_GI_CURLY, head: liaoWavyHead(LIAO_TOUSLED) };

// ═══════════════════════════════════ 하인리히 도른: 은빛 중갑 기사 ═══════════════════════════════════
// 설정집: "화려한 배색"의 자칭 왕의 기사 — 은빛 판금이라도 수수하게 죽이지 않는다. 실전 갑옷보다
// 훨씬 반들반들하게 닦아(금속성↑·거칠기↓) 과시욕을 드러내고, 예전 금빛 복제 엑스칼리버·금장 취향을
// 잇는 금색 트림을 얇게 둘러 "자칭 왕"다운 허영을 남긴다
const HEINRICH_STEEL = { metalness: 0.85, roughness: 0.16, steel: 1.2 };
const HEINRICH_GOLD = 0xd8b23a;

// ── 판금 밑의 누비 속옷 (오너: "갑옷 파괴 시 갑옷 안에 덧대입는 흰색 천 옷이 보여야 해. 너덜너덜하게") ──
//  판금이 완전히 부서져 사라지면 그 자리에 드러나는 흰 누비 천. 멀쩡할 때는 숨겨 두어 겉모습이 전과 같다(setPlateWear 가 켠다).
//  가슴: 판보다 조금 작은 흰 조끼(가로 누빔 줄)에 아랫단이 찢겨 늘어진 조각들과 앞가슴의 찢긴 자국(밑의 검은 옷이 보인다).
//  배: 흰 띠와 찢긴 자락. 난수 없이 정해진 자리라 시드 시뮬은 그대로다. 캐릭터를 만들 때 미리 만든다(싸우는 중에 메쉬를 새로 만들지 않는다)
const UNDER = 0xf1ece0; // 누비 천 (흰 무명)
const UNDER_Q = 0xcbc2ae; // 누빔 줄
const UNDER_STAIN = 0xb4aa97; // 땀·때가 밴 조각
const UNDER_TEAR = 0x2a2724; // 찢긴 틈으로 보이는 속
function underCloth(g, part) {
  const out = [];
  const add = (pieces, color) => {
    // 그늘진 앞면도 흰 천으로 읽히게 살짝 스스로 빛난다 (성 안뜰 해 질 녘에 검은 판처럼 보였다)
    const m = addMerged(g, pieces, color, { roughness: 0.9, emissive: 0x2b2824 });
    m.visible = false;
    out.push(m);
  };
  if (part === 'chest') {
    // 조끼: 앞뒤(x)는 판 안쪽, 위아래·양옆은 기본 몸(0.24×0.28×0.37)보다 살짝 작아 몸의 짙은 테가 남는다
    add([box(0.25, 0.27, 0.365, [0, 0.01, 0])], UNDER);
    add([-0.09, -0.045, 0, 0.045, 0.09].map((y) => box(0.252, 0.005, 0.367, [0, 0.01 + y, 0])), UNDER_Q); // 가로 누빔 줄
    add([box(0.253, 0.006, 0.05, [0, 0.01, 0.06]), box(0.253, 0.006, 0.05, [0, 0.01, -0.07])], UNDER_Q);
    // 앞가슴 찢긴 자국: 비스듬한 어두운 틈 둘
    add([box(0.006, 0.11, 0.014, [0.126, 0.02, 0.05], [0, 0, 0.18]), box(0.006, 0.07, 0.012, [0.126, -0.06, -0.08], [0, 0, -0.35])], UNDER_TEAR);
    // 찢겨 늘어진 아랫단 조각 (앞·양옆): 길이가 다 다르고 조금씩 비뚤다
    const flaps = [
      [0.128, 0.12, 0.13, 0.22, 0],
      [0.128, -0.02, 0.1, -0.15, 0],
      [0.128, -0.14, 0.15, 0.3, 0],
      [0.06, 0.183, 0.09, 0, 0.25],
      [-0.05, 0.183, 0.14, 0, -0.2],
      [0.02, -0.183, 0.11, 0, 0.3],
      [-0.09, -0.183, 0.08, 0, -0.15],
    ];
    add(flaps.filter((_, i) => i % 3 !== 2).map(([x, z, len, rz, rx]) => box(0.045, len, 0.01, [x, -0.125 - len / 2, z], [rx, Math.abs(x) > 0.1 ? 0 : Math.PI / 2, rz])), UNDER);
    add(flaps.filter((_, i) => i % 3 === 2).map(([x, z, len, rz, rx]) => box(0.045, len, 0.01, [x, -0.125 - len / 2, z], [rx, Math.abs(x) > 0.1 ? 0 : Math.PI / 2, rz])), UNDER_STAIN);
  } else if (part === 'abdomen') {
    add([cyl(0.128, 0.131, 0.14, 14, true, [0, 0.005, 0])], UNDER);
    add([cyl(0.1295, 0.1305, 0.005, 14, true, [0, 0.03, 0]), cyl(0.1305, 0.1315, 0.005, 14, true, [0, -0.02, 0])], UNDER_Q);
    add([box(0.006, 0.08, 0.012, [0.128, -0.01, -0.03], [0, 0, 0.3])], UNDER_TEAR);
    const flaps = [
      [0.3, 0.11, 0.2],
      [1.1, 0.07, -0.25],
      [2.4, 0.13, 0.15],
      [4.0, 0.09, -0.3],
      [5.2, 0.12, 0.1],
    ];
    add(flaps.filter((_, i) => i !== 3).map(([a, len, rz]) => box(0.05, len, 0.01, [Math.cos(a) * 0.13, -0.065 - len / 2, Math.sin(a) * 0.13], [0, -a + Math.PI / 2, rz])), UNDER);
    add(flaps.filter((_, i) => i === 3).map(([a, len, rz]) => box(0.05, len, 0.01, [Math.cos(a) * 0.13, -0.065 - len / 2, Math.sin(a) * 0.13], [0, -a + Math.PI / 2, rz])), UNDER_STAIN);
  }
  return out;
}

const HEINRICH_KNIGHT = {
  underCloth,
  // 판금 방어구가 붙는 부위 (수염이 붙는 head는 빠진다)
  armorParts: new Set(['chest', 'abdomen', 'pelvis', 'uarmS', 'uarmO', 'farmS', 'farmO', 'shinF', 'shinB']),
  chest(g) {
    // 가슴 판금 (기존 누빔 상의 겉에 한 겹) + 과시용 금테
    addMerged(g, [box(0.255, 0.24, 0.32, [0.005, 0.02, 0])], 0xc7cdd3, HEINRICH_STEEL);
    addMerged(g, [box(0.01, 0.22, 0.01, [0.135, 0.02, 0])], HEINRICH_GOLD, { metalness: 0.9, roughness: 0.2, steel: 1.2 });
    // 어깨 견갑(팔 없는 쪽, uarmO는 몸통에서 늘어져 있어 어깨 캡을 chest에서 겹쳐 그린다)
  },
  abdomen(g) {
    // 배쪽 판금 벨트(fauld)
    addMerged(g, [cyl(0.135, 0.14, 0.09, 14, true, [0, 0, 0])], 0xc7cdd3, HEINRICH_STEEL);
  },
  pelvis(g) {
    // 허벅지 위쪽을 덮는 짧은 판금 자락(tasset) 두 장
    addMerged(g, [box(0.08, 0.16, 0.02, [0.13, -0.18, 0.09]), box(0.08, 0.16, 0.02, [0.13, -0.18, -0.09])], 0xc7cdd3, HEINRICH_STEEL);
  },
  // 어깨 견갑: +y(몸통 쪽) 끝을 둥글게 감싼다 — uarmS(칼 든 팔)는 dressTo가 이미 돌아가 있어도
  //  "+y = 몸통 쪽"인 규칙이 같이 적용된다(위 주석 참고). 테두리에 금띠를 둘러 과시욕을 더한다
  uarmS(g) {
    addMerged(g, [ball(0.075, 12, 8, [0, 0.09, 0], null, [0, Math.PI * 2, 0, Math.PI * 0.55])], 0xc7cdd3, HEINRICH_STEEL);
    addMerged(g, [cyl(0.076, 0.076, 0.012, 12, true, [0, 0.05, 0])], HEINRICH_GOLD, { metalness: 0.9, roughness: 0.2, steel: 1.2 });
  },
  uarmO(g) {
    addMerged(g, [ball(0.075, 12, 8, [0, 0.09, 0], null, [0, Math.PI * 2, 0, Math.PI * 0.55])], 0xc7cdd3, HEINRICH_STEEL);
    addMerged(g, [cyl(0.076, 0.076, 0.012, 12, true, [0, 0.05, 0])], HEINRICH_GOLD, { metalness: 0.9, roughness: 0.2, steel: 1.2 });
  },
  // 손목 보호대(가운틀릿 커프): -y(손 쪽) 끝
  farmS(g) {
    addMerged(g, [cyl(0.055, 0.05, 0.05, 10, true, [0, -0.08, 0])], 0xc7cdd3, HEINRICH_STEEL);
  },
  farmO(g) {
    addMerged(g, [cyl(0.055, 0.05, 0.05, 10, true, [0, -0.08, 0])], 0xc7cdd3, HEINRICH_STEEL);
  },
  // 정강이받이(그리브)
  shinF(g) {
    addMerged(g, [cyl(0.058, 0.053, 0.24, 12, true, [0.006, 0, 0])], 0xc7cdd3, HEINRICH_STEEL);
  },
  shinB(g) {
    addMerged(g, [cyl(0.058, 0.053, 0.24, 12, true, [0.006, 0, 0])], 0xc7cdd3, HEINRICH_STEEL);
  },
  // 짧은 은수염
  head(g) {
    addMerged(g, [cone(0.045, 0.075, 10, [0.075, -0.075, 0], [0, 0, Math.PI])], 0xcfd3d6, { roughness: 0.95 });
  },
};

// 하인리히 v2: v1은 가슴·어깨·손목·정강이에만 판이 있어서, 대결 거리에서는 짙은 옷(팔·허벅지·허리
// 치마·발)이 대부분을 차지해 "은빛 중갑 기사"가 아니라 검은 옷을 입은 사람으로 보였다. 팔 전체(위팔·
// 아래팔 통판), 허벅지(퀴스)와 무릎 덮개, 쇠신, 허리 쇠치마를 더해 몸 대부분을 은빛 판으로 덮는다.
const HEINRICH_FULL_PLATE = {
  ...HEINRICH_KNIGHT,
  armorParts: new Set([...HEINRICH_KNIGHT.armorParts, 'thighF', 'thighB', 'footF', 'footB']),
  pelvis(g) {
    // 허리 쇠치마 (기본 천 치마를 겉에서 덮는다) + v1의 앞 자락 두 장
    addMerged(
      g,
      [
        cyl(0.178, 0.224, 0.26, 16, true, [0, -0.12, 0]),
        box(0.08, 0.16, 0.02, [0.2, -0.2, 0.09], [0, 0, 0.2]),
        box(0.08, 0.16, 0.02, [0.2, -0.2, -0.09], [0, 0, 0.2]),
      ],
      0xc7cdd3,
      { ...HEINRICH_STEEL, side: THREE.DoubleSide },
    );
  },
  uarmS(g) {
    HEINRICH_KNIGHT.uarmS(g);
    addMerged(g, [cyl(0.059, 0.057, 0.17, 12, true, [0, -0.01, 0])], 0xc7cdd3, HEINRICH_STEEL);
  },
  uarmO(g) {
    HEINRICH_KNIGHT.uarmO(g);
    addMerged(g, [cyl(0.059, 0.057, 0.17, 12, true, [0, -0.01, 0])], 0xc7cdd3, HEINRICH_STEEL);
  },
  // 아래팔 통판 + 손목 보호대. 둘을 따로 둔다: 방어구가 파손되면(첫 제대로 된 타격) 손목 보호대가 먼저 떨어져 나가고
  //  통판은 완전 파손 때까지 남는다 (fighter.js wearPlate, config.js ARMOR.plate.trim)
  farmS(g) {
    addMerged(g, [cyl(0.053, 0.049, 0.15, 12, true, [0, 0, 0])], 0xc7cdd3, HEINRICH_STEEL);
    addMerged(g, [cyl(0.056, 0.051, 0.05, 10, true, [0, -0.08, 0])], 0xc7cdd3, HEINRICH_STEEL);
  },
  farmO(g) {
    addMerged(g, [cyl(0.053, 0.049, 0.15, 12, true, [0, 0, 0])], 0xc7cdd3, HEINRICH_STEEL);
    addMerged(g, [cyl(0.056, 0.051, 0.05, 10, true, [0, -0.08, 0])], 0xc7cdd3, HEINRICH_STEEL);
  },
  // 허벅지 판(퀴스) + 무릎 덮개
  thighF(g) {
    addMerged(g, [cyl(0.073, 0.067, 0.24, 12, true, [0.004, 0.01, 0]), ball(0.045, 10, 6, [0.03, -0.155, 0])], 0xc7cdd3, HEINRICH_STEEL);
  },
  thighB(g) {
    addMerged(g, [cyl(0.073, 0.067, 0.24, 12, true, [0.004, 0.01, 0]), ball(0.045, 10, 6, [0.03, -0.155, 0])], 0xc7cdd3, HEINRICH_STEEL);
  },
  // 쇠신(사바톤): 신발 상자를 한 겹 덮는다
  footF(g) {
    addMerged(g, [box(0.262, 0.05, 0.12, [0, 0.016, 0])], 0xc7cdd3, HEINRICH_STEEL);
  },
  footB(g) {
    addMerged(g, [box(0.262, 0.05, 0.12, [0, 0.016, 0])], 0xc7cdd3, HEINRICH_STEEL);
  },
};

// ═══════════════════════════════════ 마르그레테 슈바르츠: 먹색 판금 · 용기사 ═══════════════════════════════════
// 설정집: "수수하고 차분한 배색", 칼자루에도 장식이 없는 인물 — 판금으로 바뀌어도 그 절제는 그대로
// 지킨다. 화려한 색 포인트(원래 있던 와인레드 트림)는 빼고, 무채색 안에서 짙고 옅은 판(2톤)만으로
// 깎아 만든 듯한 "빈틈없음"을 낸다. 견갑도 뾰족한 장식보다 낮고 두꺼운 쐐기꼴로 낮춰 과시보다
// 방어처럼 보이게 했다
const MG_PLATE = 0x2c2c32;
const MG_PLATE_DARK = 0x1c1c20;
const MARGARETHE_DRAGON = {
  underCloth,
  // 판금 방어구가 붙는 부위 (오너 결정: 몸통 판금도 막고, 닳고, 완전히 부서지면 사라진다).
  // v2·v3 세트도 이 세트를 펼쳐 쓰므로 같이 적용된다
  armorParts: new Set(['chest', 'abdomen', 'pelvis', 'uarmS', 'uarmO']),
  chest(g) {
    addMerged(g, [box(0.26, 0.25, 0.34, [0, 0.01, 0])], MG_PLATE, STEEL_OPTS);
    // 이음매 자국(세로줄) — 색 대신 같은 계열의 더 짙은 판이라 눈에 안 띄고 만듦새만 드러낸다
    addMerged(g, [box(0.008, 0.24, 0.01, [0.132, 0.01, 0])], MG_PLATE_DARK, STEEL_OPTS);
  },
  abdomen(g) {
    addMerged(g, [cyl(0.13, 0.135, 0.1, 14, true, [0, 0, 0])], MG_PLATE, STEEL_OPTS);
  },
  // 골반: 기존 천 치마(기본 dressPart) 겉에 세로 판을 두른 갑주 치마 — "아래는 치마" 느낌의 핵심.
  // 자락 끝단도 같은 먹색 계열로 통일(원래 와인레드 포인트는 뺐다)
  pelvis(g) {
    const plates = [];
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      plates.push(box(0.05, 0.3, 0.014, [Math.cos(a) * 0.185, -0.24, Math.sin(a) * 0.185], [0, a, 0]));
    }
    addMerged(g, plates, MG_PLATE, STEEL_OPTS);
    addMerged(g, [cyl(0.2, 0.235, 0.025, 20, true, [0, -0.39, 0])], MG_PLATE_DARK, STEEL_OPTS);
  },
  // 견갑: 낮고 두꺼운 쐐기꼴 — 각은 남기되 뾰족한 장식이 아니라 두꺼운 방어판처럼
  uarmS(g) {
    addMerged(g, [cone(0.085, 0.06, 6, [0, 0.075, 0])], MG_PLATE, STEEL_OPTS);
  },
  uarmO(g) {
    addMerged(g, [cone(0.085, 0.06, 6, [0, 0.075, 0])], MG_PLATE, STEEL_OPTS);
  },
};

// 마르그레테 v2: v1 갑옷 그대로 + 투구(오너 요청). 얼굴이 읽혀야 해서 얼굴을 막지 않는 코가리개
// 투구로 했다 — 돔을 앞쪽은 들고 뒤쪽은 내리게 기울여(이마 테가 눈 위에 걸린다) 뒤통수·목덜미를
// 덮는다. 볏이나 문장 대신 정수리에 낮은 능선 하나만(짙은 판) 둘러 절제를 지킨다.
// 붉은 머리는 투구 밑으로 삐져나온 옆머리(정면에서 보임)와 뒷머리(뒤에서 보임)로 드러난다.
// 순수 장식이라 세게 맞아도 벗겨지지 않는다(케틀햇과 달리 hasHelmet과 무관).
const MG_HELM_C = [-0.005, 0.015, 0];
const MG_HELM_TILT = [0, 0, 0.3];
const MG_HELM_DOME = [1, 1.12, 1]; // 살짝 뾰족하게
function mgHelmPiece(geo, dy) {
  if (dy) geo.translate(0, dy, 0); // 투구 자체 좌표에서 먼저 옮긴 뒤 같이 기울인다
  return bake(geo, MG_HELM_C, MG_HELM_TILT);
}
const MARGARETHE_DRAGON_HELM = {
  ...MARGARETHE_DRAGON,
  head(g, look) {
    addMerged(
      g,
      [
        bake(new THREE.SphereGeometry(0.118, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), MG_HELM_C, MG_HELM_TILT, MG_HELM_DOME), // 돔
        mgHelmPiece(new THREE.CylinderGeometry(0.121, 0.121, 0.022, 18, 1, true)), // 이마 테
        mgHelmPiece(new THREE.CylinderGeometry(0.12, 0.136, 0.045, 10, 1, true, Math.PI, Math.PI), -0.03), // 목가리개(뒤쪽 절반)
        box(0.01, 0.075, 0.018, [0.122, 0.012, 0]), // 코가리개
      ],
      MG_PLATE,
      STEEL_OPTS,
    );
    // 정수리 능선: 돔을 따라 앞에서 뒤로 휘는 낮은 둥근 띠
    addMerged(g, [bake(new THREE.TorusGeometry(0.119, 0.008, 4, 14, Math.PI), MG_HELM_C, MG_HELM_TILT, MG_HELM_DOME)], MG_PLATE_DARK, STEEL_OPTS);
    // 투구 밑으로 나온 붉은 머리: 얼굴 양옆으로 늘어진 옆머리 + 목가리개 밑으로 땋아 내린 머리 한 가닥
    // (흐트러진 머리보다 단정하게 땋은 머리가 "침묵의 벽"에 맞는다)
    const hair = [box(0.03, 0.13, 0.016, [0.03, -0.045, 0.099]), box(0.03, 0.13, 0.016, [0.03, -0.045, -0.099])];
    for (let i = 0; i < 5; i++) {
      const r = 0.03 - i * 0.0025;
      hair.push(bake(new THREE.SphereGeometry(r, 8, 6), [-0.118 - i * 0.008, -0.06 - i * 0.034, 0], null, [1, 1.35, 1]));
    }
    addMerged(g, hair, look.hair, { roughness: 1 });
  },
};

// ── 뿔·깃털 술처럼 휘는 것: 점 여러 개를 지나는 매끈한 곡선을 따라 굵기가 변하는 관을 만든다 ──
//  (원기둥 조각을 이어 붙이면 이음매마다 꺾이고 틈이 보여서 뿔은 막대기, 술은 발톱처럼 보였다)
const _tc = new THREE.Vector3();
const _tv = new THREE.Vector3();
function taperedTube(pts, radii, tubular = 12, radial = 6) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
  const pos = geo.attributes.position;
  const last = radii.length - 1;
  for (let i = 0; i <= tubular; i++) {
    const u = i / tubular;
    const f = u * last;
    const k0 = Math.min(last - 1, Math.floor(f));
    const r = radii[k0] + (radii[k0 + 1] - radii[k0]) * (f - k0);
    curve.getPointAt(u, _tc); // TubeGeometry도 같은 점을 중심으로 반지름 1짜리 고리를 만든다
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      _tv.fromBufferAttribute(pos, k).sub(_tc).multiplyScalar(r).add(_tc);
      pos.setXYZ(k, _tv.x, _tv.y, _tv.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}
const mirrorZ = (pts) => pts.map(([x, y, z]) => [x, y, -z]);

// 마르그레테 v3: 오너 요청 "동그랗지 않게 더 장식적인 투구, 삼국지 마초나 용기사처럼".
// 둥근 돔 대신 팔각으로 각진 사발 위에 높은 첨탑을 세우고(면을 평평하게 칠해 각이 보인다),
// 마초 계열의 긴 붉은 깃털 술과 이마의 세 갈래 볏, 용기사 계열의 뒤로 휘는 두 뿔을 달았다.
// 특정 게임·작품의 투구를 그대로 베끼지 않고 실루엣 요소만 가져왔다. 얼굴은 여전히 열어 둔다
// (v2의 코가리개는 빼고 이마 테 가운데에 작은 뾰족 장식만). 색은 먹색 판 + 붉은 술 하나로 절제.
// 좌표는 "투구 자체 좌표"(y = 투구 축, 테 = y 0)로 잡은 뒤 한꺼번에 머리 위로 옮기고 기울인다.
const MG3_C = [-0.005, 0.015, 0];
const MG3_TILT = [0, 0, 0.22];
const onHelm = (geo) => bake(geo, MG3_C, MG3_TILT);
const oct = (geo) => geo.rotateY(Math.PI / 8); // 팔각의 평평한 면이 정면을 보게
const MG3_PLATE = { ...STEEL_OPTS, flatShading: true, side: THREE.DoubleSide };
// 뿔: 관자놀이 위에서 먼저 위로 솟았다가 뒤로 젖혀진다(옆으로 뻗으면 정면에서 귀처럼 보였다)
const MG3_HORN_R = [
  [0.02, 0.06, 0.095],
  [0.0, 0.115, 0.13],
  [-0.05, 0.16, 0.14],
  [-0.125, 0.185, 0.12],
];
const MG3_HORN_RADII = [0.025, 0.018, 0.011, 0.002];
// 깃털 술: 가는 가닥 여러 개는 붉은 발톱처럼 보여서, 굵게 한 덩어리로 부풀었다가 뒤로 흘러내리게
const MG3_PLUME = [
  [0, 0.175, 0],
  [-0.05, 0.215, 0],
  [-0.13, 0.2, 0],
  [-0.2, 0.12, 0],
  [-0.23, 0.04, 0],
];
const MG3_PLUME_RADII = [0.03, 0.042, 0.037, 0.025, 0.008];
// 투구 자체 좌표 → 머리 좌표 변환 (onHelm과 같은 것). 조각마다 회전 중심(피벗)을 머리 좌표로 옮길 때 쓴다
const MG3_M = new THREE.Matrix4().compose(
  new THREE.Vector3(...MG3_C),
  new THREE.Quaternion().setFromEuler(new THREE.Euler(...MG3_TILT)),
  new THREE.Vector3(1, 1, 1),
);
/**
 * 투구 조각 하나: 피벗 그룹(조각이 꺾이고 흩어지는 중심) 안에 합친 메쉬 하나.
 * geos는 투구 자체 좌표, pivot도 투구 자체 좌표로 준다.
 */
function helmPiece(helm, name, geos, color, opts, pivot) {
  const pv = new THREE.Vector3(...pivot).applyMatrix4(MG3_M);
  const pg = new THREE.Group();
  pg.name = name;
  pg.position.copy(pv);
  helm.add(pg);
  const mesh = addMerged(pg, geos.map((geo) => onHelm(geo).translate(-pv.x, -pv.y, -pv.z)), color, opts);
  mesh.userData.base = { color: mesh.material.color.getHex(), roughness: mesh.material.roughness };
  helm.userData.pieces[name] = pg;
  return pg;
}
/** 금(균열): 조각 표면을 따라 지그재그로 가는 짙은 선. 처음엔 숨겨 두고 많이 부서지면 보인다 */
function helmCrack(pg, pts) {
  const pv = pg.position;
  const geo = onHelm(taperedTube(pts, [0.0035, 0.003, 0.0025], 8, 4)).translate(-pv.x, -pv.y, -pv.z);
  const m = addMerged(pg, [geo], crackColor(pg.children[0].material.color), { roughness: 1 });
  m.visible = false;
  return m;
}
// 표면 위의 점: 투구 축 둘레 각도 a(정면 +x에서 +z 쪽으로), 높이 y, 반지름 r(+ 표면에서 살짝 띄움)
const onSurf = (a, y, r) => [Math.cos(a) * (r + 0.003), y, Math.sin(a) * (r + 0.003)];
const bowlR = (y) => (y < 0.016 ? 0.124 : 0.124 - ((y - 0.016) / 0.05) * 0.02);
const spireR = (y) => 0.104 * (1 - (y - 0.066) / 0.105);

// 마르그레테 v3 곁 판(디렉터 지시, 사장님 승인): 1단계 파손(내구 0.9 아래)에 떨어지는 조각이 가슴 이음매 줄(24×1×0.8cm,
//  먹색 위 먹색)뿐이라 대결 거리에서 깨지는 게 안 보였다. 막는 힘·판정은 그대로 두고(config.js ARMOR, fighter.js 안 건드림)
//  본판보다 한참 작은(ARMOR.plate.trim 0.4 배 아래) 밝은 강철 테를 덧대, 떨어지는 순간이 보이게 한다. 조각은 3cm 넘게(armor_eval 의
//  "보이는 조각" 규칙). 튀는 색 없이 밝은 강철(2톤 안에서 셋째 톤)만 쓴다 — 절제는 그대로.
const MG3_TRIM = 0x8d939b; // 밝은 강철 테 (먹색 판 0x2c2c32 위에서 또렷이 갈린다)
const MARGARETHE_DRAGON_HORNED = {
  ...MARGARETHE_DRAGON,
  chest(g) {
    addMerged(g, [box(0.26, 0.25, 0.34, [0, 0.01, 0])], MG_PLATE, STEEL_OPTS); // 본판 (v1 그대로)
    // 곁 판 (1단계에 떨어진다): 가슴판 위·아래 가장자리를 두른 밝은 강철 테 — 위 27×2×35cm, 아래 27×2.4×35cm
    addMerged(g, [box(0.272, 0.02, 0.352, [0, 0.128, 0])], MG3_TRIM, STEEL_OPTS);
    addMerged(g, [box(0.272, 0.024, 0.352, [0, -0.108, 0])], MG3_TRIM, STEEL_OPTS);
    // 이음매 자국(세로줄)은 남긴다 — 같이 떨어지지만 눈에 띄는 조각으로 세지 않는다
    addMerged(g, [box(0.008, 0.24, 0.01, [0.132, 0.01, 0])], MG_PLATE_DARK, STEEL_OPTS);
  },
  abdomen(g) {
    addMerged(g, [cyl(0.13, 0.135, 0.1, 14, true, [0, 0, 0])], MG_PLATE, STEEL_OPTS); // 본판 (v1 그대로)
    // 곁 판: 배 판 아래에 겹친 밝은 강철 겹판 한 장(28×3.4×28cm) — 본판의 0.32 배라 1단계에 떨어진다
    addMerged(g, [cyl(0.138, 0.144, 0.034, 14, true, [0, -0.052, 0])], MG3_TRIM, STEEL_OPTS);
  },
  head(g, look) {
    // 투구는 한 그룹(group.userData.helmet)으로 넘긴다. 오너 결정("실제로 막고, 닳고, 완전히 부서지면
    // 사라진다")에 따라 전투 쪽이 fighter.js에서 이 그룹을 떼어 내거나 조각내 흩뜨린다. 흩뜨릴 수 있게
    // 전부 하나로 합치지 않고 큰 조각 7개(사발·목가리개·첨탑·볏·뿔 둘·깃털 술)로 나눠 둔다 —
    // helm.userData.pieces[이름] = 피벗 그룹. 붉은 옆머리·땋은 머리는 그룹 밖(머리에 직접)이라 남는다.
    const helm = new THREE.Group();
    helm.name = 'helmet';
    helm.userData.pieces = {};
    g.add(helm);
    g.userData.helmet = helm;
    const bowl = helmPiece(
      helm,
      'bowl',
      [
        oct(new THREE.CylinderGeometry(0.124, 0.124, 0.032, 8, 1, true)), // 이마 테
        oct(new THREE.CylinderGeometry(0.104, 0.124, 0.05, 8, 1, true)).translate(0, 0.041, 0), // 사발
        bake(new THREE.ConeGeometry(0.02, 0.034, 3), [0.124, -0.026, 0], [Math.PI, 0, 0], [0.4, 1, 1]), // 이마 가운데 뾰족 장식
      ],
      MG_PLATE,
      MG3_PLATE,
      [0, 0, 0],
    );
    helmPiece(
      helm,
      'nape',
      [
        new THREE.CylinderGeometry(0.124, 0.142, 0.034, 8, 1, true, Math.PI, Math.PI).translate(0, -0.032, 0), // 목가리개 1
        new THREE.CylinderGeometry(0.14, 0.16, 0.034, 8, 1, true, Math.PI, Math.PI).translate(0, -0.062, 0), // 목가리개 2
      ],
      MG_PLATE,
      MG3_PLATE,
      [-0.124, -0.016, 0],
    );
    const spire = helmPiece(
      helm,
      'spire',
      [oct(new THREE.ConeGeometry(0.104, 0.105, 8)).translate(0, 0.1185, 0), new THREE.SphereGeometry(0.016, 6, 4).translate(0, 0.172, 0)],
      MG_PLATE,
      MG3_PLATE,
      [0, 0.066, 0],
    );
    // 이마의 세 갈래 볏 (가운데가 높고 양옆은 벌어진다) — 짙은 판으로 도드라지게
    helmPiece(
      helm,
      'crest',
      [
        bake(new THREE.ConeGeometry(0.03, 0.12, 4), [0.118, 0.075, 0], [0, 0, 0.18], [0.35, 1, 1]),
        bake(new THREE.ConeGeometry(0.022, 0.08, 4), [0.112, 0.055, 0.035], [0.35, 0, 0.18], [0.35, 1, 1]),
        bake(new THREE.ConeGeometry(0.022, 0.08, 4), [0.112, 0.055, -0.035], [-0.35, 0, 0.18], [0.35, 1, 1]),
      ],
      MG_PLATE_DARK,
      MG3_PLATE,
      [0.118, 0.016, 0],
    );
    helmPiece(helm, 'hornR', [taperedTube(MG3_HORN_R, MG3_HORN_RADII, 10, 6)], MG_PLATE, MG3_PLATE, MG3_HORN_R[0]);
    const leftHorn = mirrorZ(MG3_HORN_R);
    helmPiece(helm, 'hornL', [taperedTube(leftHorn, MG3_HORN_RADII, 10, 6)], MG_PLATE, MG3_PLATE, leftHorn[0]);
    // 첨탑 끝의 술 뭉치 + 뒤로 흘러내리는 굵은 술. 양옆 두 가닥이 폭을 더해 뒤에서 봐도 갈고리가
    // 아니라 술 다발로 읽히고, 끝으로 갈수록 가운데로 모인다
    const side = (s) => MG3_PLUME.map(([x, y], i) => [x * 0.94, y - 0.01, s * 0.03 * (1 - 0.6 * (i / (MG3_PLUME.length - 1)))]);
    helmPiece(
      helm,
      'plume',
      [
        new THREE.SphereGeometry(0.032, 8, 6).translate(0, 0.178, 0),
        taperedTube(MG3_PLUME, MG3_PLUME_RADII, 14, 7),
        taperedTube(side(1), MG3_PLUME_RADII.map((r) => r * 0.8), 12, 6),
        taperedTube(side(-1), MG3_PLUME_RADII.map((r) => r * 0.8), 12, 6),
      ],
      look.plume ?? look.hair,
      { roughness: 0.95 },
      [0, 0.172, 0],
    );
    // 금: 사발 오른쪽 앞과 첨탑 왼쪽에 하나씩 (setHelmetWear가 많이 부서졌을 때만 켠다)
    helm.userData.cracks = [
      helmCrack(bowl, [0.062, 0.045, 0.03, 0.012, -0.004].map((y, i) => onSurf(0.6 + (i % 2 ? 0.07 : -0.02), y, bowlR(y)))),
      helmCrack(spire, [0.07, 0.085, 0.1, 0.115, 0.128].map((y, i) => onSurf(-0.5 + (i % 2 ? 0.08 : -0.03), y, spireR(y)))),
    ];
    // 붉은 머리는 v2와 같다: 얼굴 양옆 옆머리 + 목가리개 밑으로 땋아 내린 머리 (투구 그룹 밖)
    const hair = [box(0.03, 0.13, 0.016, [0.03, -0.045, 0.099]), box(0.03, 0.13, 0.016, [0.03, -0.045, -0.099])];
    for (let i = 0; i < 5; i++) {
      const r = 0.03 - i * 0.0025;
      hair.push(bake(new THREE.SphereGeometry(r, 8, 6), [-0.118 - i * 0.008, -0.075 - i * 0.034, 0], null, [1, 1.35, 1]));
    }
    addMerged(g, hair, look.hair, { roughness: 1 });
  },
};

// 투구가 닳은 정도를 겉모습에 반영한다 (전투 쪽이 helmetIntegrity가 바뀔 때마다 부른다).
//  wear01: 1 = 멀쩡, 0 = 완전 파손 직전. 난수 없이 결정적이고, 같은 값을 여러 번 불러도 같은 모습이다.
//  · 0.5 아래: 찌그러짐·긁힘 — 첨탑이 기울고 사발이 눌리고 뿔·볏이 틀어지며, 판이 긁혀 거칠고 희끗해진다
//  · 0.2 아래: 금이 보이고 깃털 술이 꺾여 늘어진다
//  pieces가 없는 투구(플레이어 케틀햇 등)에는 아무 일도 하지 않는다.
const _scratch = new THREE.Color(0x6a6a72);
export function setHelmetWear(helm, wear01) {
  const P = helm?.userData?.pieces;
  if (!P) return;
  const w = Math.min(1, Math.max(0, wear01));
  const dent = w < 0.5 ? (0.5 - w) / 0.5 : 0; // 0.5에서 0 → 0에서 1
  const broken = w < 0.2;
  const set = (pg, rx, ry, rz, sx = 1, sy = 1, sz = 1) => {
    if (!pg) return;
    pg.rotation.set(rx, ry, rz);
    pg.scale.set(sx, sy, sz);
  };
  set(P.bowl, 0, 0, 0, 1 + 0.04 * dent, 1 - 0.07 * dent, 1 + 0.03 * dent);
  set(P.spire, 0.12 * dent, 0, -0.22 * dent - (broken ? 0.12 : 0));
  set(P.crest, 0.18 * dent, 0, -0.1 * dent);
  set(P.hornR, 0.28 * dent, 0, 0);
  set(P.hornL, -0.12 * dent, 0, -0.2 * dent);
  set(P.nape, 0, 0, 0.1 * dent);
  set(P.plume, 0, broken ? 0.35 : 0, broken ? 0.95 : 0.2 * dent);
  for (const name in P) {
    const m = P[name].children[0];
    const b = m?.userData?.base;
    if (!b || name === 'plume') continue;
    m.material.color.setHex(b.color).lerp(_scratch, 0.35 * dent);
    m.material.roughness = Math.min(1, b.roughness + 0.45 * dent);
  }
  for (const c of helm.userData.cracks || []) c.visible = broken;
}

// ═════════════════════ Native newcomers: tailored cloth, never armor ═════════════════════
// Keep dressPart's representative mesh alive: wounds, pallor and severing continue
// to use it. Only the stock quilt/collar/skirt decorations are replaced. No body,
// collider, joint or hand geometry is changed by these outfits.
const LINEN = 0xe9e2ce;
const LINEN_SHADE = 0xcac4af;
const BRASS = 0xb99b62;
const CLOTH = { roughness: 0.95, metalness: 0 };
const BRASS_OPTS = { roughness: 0.48, metalness: 0.45, steel: 0.6 };

function clothBase(g, color, frontColor) {
  const main = g.children[0];
  // Torso extras each own their materials/geometries; the representative first
  // child stays in place so fighter.partMesh and later decal children stay valid.
  for (const child of g.children.slice(1)) {
    g.remove(child);
    child.geometry?.dispose();
    if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
    else child.material?.dispose();
  }
  main.material.color.setHex(color);
  main.material.roughness = 0.96;
  main.material.metalness = 0;
  if (frontColor) {
    // Cloth panels are colors on the actual wound surface, not a second opaque
    // torso. Keep BoxGeometry type/parameters for effects.js's surface normals.
    const { width, height, depth } = main.geometry.parameters;
    const geo = new THREE.BoxGeometry(width, height, depth, 1, 14, 18);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      c.setHex(pos.getX(i) > width * 0.49 ? frontColor(pos.getY(i), pos.getZ(i)) : color);
      c.toArray(colors, i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    main.geometry.dispose();
    main.geometry = geo;
    main.material.color.setHex(0xffffff);
    main.material.vertexColors = true;
    main.material.needsUpdate = true;
  }
  return main;
}

// Shape only the existing cloth capsule; the native hand sphere is untouched.
function sleeveVolume(g, proximal, distal) {
  const geo = g.children[0].geometry;
  const pos = geo.attributes.position;
  geo.computeBoundingBox();
  const min = geo.boundingBox.min.y, max = geo.boundingBox.max.y;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, Math.min(1, (max - pos.getY(i)) / (max - min)));
    const s = proximal + (distal - proximal) * t;
    pos.setXYZ(i, pos.getX(i) * s, pos.getY(i), pos.getZ(i) * s);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
}

// A thin sewn panel, authored as a polygon in Y/Z at a constant forward X.
// Indexed position/normal/uv attributes share the existing primitive merge path.
function clothPanel(x, yz, thickness = 0.006) {
  const vertices = [];
  const uv = [];
  const indices = [];
  for (const dx of [-thickness / 2, thickness / 2]) for (const [y, z] of yz) {
    vertices.push(x + dx, y, z);
    uv.push(z, y);
  }
  const n = yz.length;
  for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(yz.map(([y, z]) => new THREE.Vector2(y, z)), []))
    indices.push(a, c, b, n + a, n + b, n + c);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    indices.push(i, j, n + j, i, n + j, n + i);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function clothBand(rx, rz, y, h, color, g) {
  // Torso shells are rectangular: an elliptical belt would disappear into their
  // corners. The small neck collar stays round; waist bands enclose the box.
  if (rx > 0.1) return addMerged(g, [box(rx * 2, h, rz * 2, [0, y, 0])], color, CLOTH);
  return addMerged(g, [bake(new THREE.CylinderGeometry(1, 1, h, 16, 1, true), [0, y, 0], null, [rx, 1, rz])], color, { ...CLOTH, side: THREE.DoubleSide });
}

function clothNeck(g, look) {
  addMerged(g, [cyl(0.041, 0.049, 0.065, 12, false, [0, 0.174, 0])], look.skin, CLOTH);
}

function quietFace(g, look, kind) {
  // The stock spherical cap cuts through the eye line. A shaped hairline keeps
  // the forehead open while the sides and nape remain covered.
  const cap = g.children[4];
  if (cap?.isMesh && cap.geometry.type === 'SphereGeometry') {
    const geo = new THREE.SphereGeometry(0.107, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.64);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const t = Math.floor(i / 21) / 12;
      const theta = t * Math.PI * (0.64 - 0.23 * Math.max(0, Math.cos(a)));
      p.setXYZ(i, 0.107 * Math.sin(theta) * Math.cos(a), 0.107 * Math.cos(theta), 0.107 * Math.sin(theta) * Math.sin(a));
    }
    geo.computeVertexNormals();
    cap.geometry.dispose();
    cap.geometry = geo;
    cap.position.set(-0.008, 0.004, 0);
    cap.rotation.set(0, 0, 0);
  }
  // Smaller brow/eye detail gives each adult a distinct expression while leaving
  // the original face sphere, nose volume and hand/body proportions unchanged.
  const eyes = g.children.slice(1, 3);
  for (const eye of eyes) {
    eye.scale.y = kind === 'tome' ? 0.48 : kind === 'omari' ? 0.68 : 0.57;
    eye.scale.z = kind === 'minami' ? 0.88 : 1;
  }
  const brow = [-1, 1].map((s) => box(0.007, kind === 'tome' ? 0.009 : 0.005, 0.034, [0.094, 0.035, s * 0.035], [s * (kind === 'tome' ? 0.12 : 0.05), 0, 0]));
  addMerged(g, brow, kind === 'tome' ? 0x90968f : look.hair, CLOTH);
  // Ears and a restrained lower lip help three-quarter/profile reading.
  addMerged(g, [-1, 1].map((s) => bake(new THREE.SphereGeometry(0.016, 8, 6), [-0.008, -0.004, s * 0.094], null, [0.7, 1.35, 0.5])), look.skin, CLOTH);
  addMerged(g, [box(0.004, 0.004, kind === 'omari' ? 0.038 : 0.029, [0.092, -0.049, 0])], kind === 'omari' ? 0x4d2c25 : kind === 'tome' ? 0x906956 : 0xac786a, CLOTH);
}

const TOME_WINE = 0x632b3c;
const TOME_SEAM = 0x8b4d58;
const TOME_RAPIER = {
  chest(g, look) {
    clothBase(g, TOME_WINE);
    clothNeck(g, look);
    // A small standing linen collar with two tapered falls; no ruff hiding the face.
    clothBand(0.078, 0.083, 0.151, 0.044, LINEN, g);
    addMerged(g, [
      clothPanel(0.127, [[0.14, -0.008], [0.11, -0.076], [0.022, -0.026]]),
      clothPanel(0.128, [[0.14, 0.008], [0.11, 0.076], [0.035, 0.026]]),
      clothPanel(0.125, [[0.089, -0.023], [0.089, 0.023], [-0.063, 0.014], [-0.063, -0.014]]),
    ], LINEN, CLOTH);
    addMerged(g, [
      box(0.005, 0.26, 0.007, [0.124, -0.006, -0.086]),
      box(0.005, 0.26, 0.007, [0.124, -0.006, 0.086]),
      box(0.006, 0.011, 0.074, [0.125, 0.016, 0.121], [0.06, 0, 0]),
      box(0.006, 0.011, 0.26, [-0.122, -0.105, 0]),
    ], TOME_SEAM, CLOTH);
    addMerged(g, [-0.096, -0.045, 0.006].map((y) => ball(0.007, 6, 4, [0.127, y, -0.047])), BRASS, BRASS_OPTS);
  },
  abdomen(g) {
    clothBase(g, TOME_WINE);
    clothBand(0.118, 0.166, -0.043, 0.036, 0x36292b, g);
    addMerged(g, [box(0.012, 0.025, 0.035, [0.12, -0.043, -0.028])], BRASS, BRASS_OPTS);
    addMerged(g, [box(0.005, 0.09, 0.006, [0.114, 0.031, -0.062]), box(0.005, 0.09, 0.006, [0.114, 0.031, 0.062])], TOME_SEAM, CLOTH);
  },
  pelvis(g) {
    clothBase(g, TOME_WINE);
    // Split short doublet skirts: restrained flare, clear legs, no rigid long cape.
    addMerged(g, [
      clothPanel(0.11, [[0.016, -0.158], [0.016, -0.023], [-0.171, -0.034], [-0.153, -0.177]]),
      clothPanel(0.11, [[0.016, 0.023], [0.016, 0.158], [-0.153, 0.177], [-0.171, 0.034]]),
      clothPanel(-0.108, [[0.013, -0.157], [0.013, 0.157], [-0.15, 0.168], [-0.182, 0.027], [-0.12, 0], [-0.182, -0.027], [-0.15, -0.168]]),
    ], TOME_WINE, { ...CLOTH, side: THREE.DoubleSide });
    addMerged(g, [-1, 1].map((s) => box(0.007, 0.013, 0.142, [0.115, -0.151, s * 0.102], [s * -0.09, 0, 0])), TOME_SEAM, CLOTH);
  },
  head(g, look) {
    quietFace(g, look, 'tome');
    const swept = [];
    for (let i = 0; i < 5; i++) {
      const z = (i - 2) * 0.035;
      swept.push(taperedTube([[0.065, 0.076, z], [0.009, 0.106, z + 0.01], [-0.061, 0.084, z + 0.006], [-0.09, 0.023, z]], [0.018, 0.023, 0.015, 0.006], 7, 5));
    }
    swept.push(bake(new THREE.SphereGeometry(0.034, 10, 7), [0.085, -0.07, 0], null, [0.6, 0.95, 0.7]));
    swept.push(taperedTube([[0.101, -0.038, -0.034], [0.113, -0.035, -0.012], [0.113, -0.035, 0.012], [0.101, -0.038, 0.034]], [0.004, 0.007, 0.007, 0.003], 8, 5));
    for (const s of [-1, 1]) swept.push(box(0.016, 0.048, 0.014, [0.011, -0.015, s * 0.093], [0, 0, -0.14]));
    addMerged(g, swept, look.hair, CLOTH);
    addMerged(g, [-1, 1].map((s) => taperedTube([[0.091, 0.004, s * 0.055], [0.088, -0.004, s * 0.063], [0.08, -0.008, s * 0.069]], [0.0015, 0.0015, 0.001], 4, 3)), 0xad816a, CLOTH);
  },
  uarmS(g) { sleeveVolume(g, 1.12, 1.03); },
  uarmO(g) { sleeveVolume(g, 1.12, 1.03); },
  farmS(g) { tomeCuff(g); },
  farmO(g) { tomeCuff(g); },
  shinF: tomeBoot,
  shinB: tomeBoot,
  footF: tomeShoe,
  footB: tomeShoe,
};
function tomeCuff(g) {
  addMerged(g, [cyl(0.05, 0.054, 0.045, 12, true, [0, -0.09, 0])], LINEN, { ...CLOTH, side: THREE.DoubleSide });
  addMerged(g, [cyl(0.051, 0.05, 0.008, 12, true, [0, -0.067, 0])], TOME_SEAM, CLOTH);
}
function tomeBoot(g) {
  g.children[0].material.color.setHex(0x302627);
  addMerged(g, [cyl(0.056, 0.052, 0.029, 12, true, [0, 0.092, 0])], 0x4c3935, CLOTH);
}
function tomeShoe(g) {
  addMerged(g, [box(0.044, 0.006, 0.084, [0.021, 0.04, 0]), box(0.018, 0.011, 0.028, [0.021, 0.045, 0])], BRASS, BRASS_OPTS);
}

const OMARI_BLUE = 0x193b4b;
const OMARI_EDGE = 0x47616a;
const OMARI_SASH = 0x813848;
const OMARI_SEAFARER = {
  chest(g, look) {
    clothBase(g, OMARI_BLUE, (y, z) => Math.abs(z) > 0.088 ? OMARI_BLUE : y > 0.005 && Math.abs(z) < (y - 0.005) * 0.54 ? look.skin : look.tunic);
    clothNeck(g, look);
    // Folded ivory shirt opening inside a sleeveless, ocean-blue coat.
    addMerged(g, [-1, 1].map((s) => clothPanel(0.126, [[0.136, s * 0.07], [0.104, s * 0.095], [-0.012, s * 0.025], [0.018, s * 0.01]])), LINEN, CLOTH);
    addMerged(g, [-1, 1].map((s) => box(0.006, 0.28, 0.013, [0.124, 0, s * 0.094])), OMARI_EDGE, CLOTH);
    addMerged(g, [-1, 1].flatMap((s) => [ball(0.007, 6, 4, [0.13, -0.074, s * 0.117]), ball(0.007, 6, 4, [0.13, 0.036, s * 0.117])]), BRASS, BRASS_OPTS);
    // One small diagonal seam carries the coat silhouette around the shoulders.
    addMerged(g, [-1, 1].map((s) => box(0.21, 0.011, 0.024, [-0.001, 0.142, s * 0.146])), OMARI_EDGE, CLOTH);
  },
  abdomen(g, look) {
    clothBase(g, OMARI_BLUE, (_, z) => Math.abs(z) < 0.078 ? look.tunic : OMARI_BLUE);
    clothBand(0.121, 0.17, -0.024, 0.087, OMARI_SASH, g);
    addMerged(g, [box(0.007, 0.008, 0.302, [0.121, -0.011, 0]), box(0.007, 0.007, 0.288, [0.122, -0.045, 0])], 0xa55c60, CLOTH);
  },
  pelvis(g) {
    clothBase(g, 0x665a4b);
    addMerged(g, [
      clothPanel(0.11, [[0.087, -0.169], [0.073, -0.104], [-0.184, -0.081], [-0.228, -0.165]]),
      clothPanel(0.11, [[0.073, 0.104], [0.087, 0.169], [-0.228, 0.165], [-0.184, 0.081]]),
      clothPanel(-0.112, [[0.088, -0.165], [0.088, 0.165], [-0.208, 0.175], [-0.25, 0.024], [-0.155, 0], [-0.25, -0.024], [-0.208, -0.175]]),
    ], OMARI_BLUE, { ...CLOTH, side: THREE.DoubleSide });
    addMerged(g, [
      clothPanel(0.124, [[0.086, 0.112], [0.077, 0.157], [-0.212, 0.181], [-0.183, 0.129]]),
      clothPanel(0.131, [[0.07, 0.1], [0.057, 0.142], [-0.14, 0.098], [-0.133, 0.071]]),
    ], OMARI_SASH, CLOTH);
    addMerged(g, [box(0.028, 0.035, 0.05, [0.128, 0.075, 0.131])], 0xa15a5c, CLOTH);
  },
  head(g, look) {
    quietFace(g, look, 'omari');
    const hair = [];
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
      const z = s * (0.072 + i * 0.015);
      hair.push(taperedTube([[-0.021 - i * 0.026, 0.045, z], [-0.037 - i * 0.026, -0.041, z * 1.1], [-0.039 - i * 0.026, -0.125 + i * 0.016, z * 0.91]], [0.014, 0.013, 0.008], 9, 6));
      for (let j = 0; j < 4; j++) hair.push(bake(new THREE.SphereGeometry(0.012, 6, 4), [-0.034 - i * 0.026, -0.016 - j * 0.025, z * 1.04], null, [0.9, 1.1, 1]));
    }
    hair.push(bake(new THREE.SphereGeometry(0.048, 10, 7), [0.064, -0.067, 0], null, [0.56, 0.71, 1]));
    hair.push(taperedTube([[0.098, -0.036, -0.029], [0.109, -0.033, 0], [0.098, -0.036, 0.029]], [0.005, 0.009, 0.005], 6, 5));
    addMerged(g, hair, look.hair, CLOTH);
    // A low, folded three-corner seafarer's hat, sewn cloth/leather, no helmet tag.
    // The shallow crown and raised rim leave the eyes and face fully visible.
    const brim = new THREE.RingGeometry(0.103, 0.198, 24, 2).rotateX(-Math.PI / 2);
    const p = brim.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const r = 0.79 + 0.21 * Math.cos(3 * a);
      const radial = (Math.hypot(p.getX(i), p.getZ(i)) - 0.103) / 0.095;
      const lift = 0.023 + 0.044 * (0.5 - 0.5 * Math.cos(3 * a)) * radial;
      p.setXYZ(i, p.getX(i) * r, p.getY(i) + lift, p.getZ(i) * r);
    }
    brim.computeVertexNormals();
    // Seat the entire soft hat 3.5cm lower on the hairline; the earlier raised
    // crown left a visible strip of sky between the side hair and hat band.
    addMerged(g, [bake(brim, [-0.012, 0.042, 0], [0.03, 0.12, -0.04]), bake(new THREE.SphereGeometry(0.108, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), [-0.016, 0.056, 0], null, [1.1, 0.62, 1.07])], 0x302e2c, { ...CLOTH, side: THREE.DoubleSide });
    addMerged(g, [bake(new THREE.CylinderGeometry(0.113, 0.116, 0.018, 18, 1, true), [-0.016, 0.064, 0], null, [1, 1, 1.02])], OMARI_SASH, CLOTH);
    const rim = [];
    for (let j = 0; j < 3; j++) {
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const a = j * Math.PI * 2 / 3 + k * Math.PI * 2 / 24;
        const r = 0.198 * (0.79 + 0.21 * Math.cos(3 * a));
        pts.push([Math.cos(a) * r, 0.03 + 0.044 * (0.5 - 0.5 * Math.cos(3 * a)), Math.sin(a) * r]);
      }
      rim.push(bake(taperedTube(pts, [0.003, 0.003], 12, 4), [-0.012, 0.042, 0], [0.03, 0.12, -0.04]));
    }
    addMerged(g, rim, 0x8d7653, CLOTH);
    addMerged(g, [bake(new THREE.TorusGeometry(0.015, 0.0032, 5, 12), [0.003, -0.027, 0.106]), ball(0.006, 6, 4, [0.004, -0.013, 0.107])], BRASS, BRASS_OPTS);
  },
  uarmS: omariSleeve,
  uarmO: omariSleeve,
  farmS: omariForearm,
  farmO: omariForearm,
  thighF(g) { sleeveVolume(g, 1.21, 1.03); },
  thighB(g) { sleeveVolume(g, 1.21, 1.03); },
  shinF: omariBoot,
  shinB: omariBoot,
};
function omariSleeve(g) {
  sleeveVolume(g, 1.2, 1.15);
  addMerged(g, [cyl(0.061, 0.061, 0.037, 12, true, [0, -0.096, 0])], LINEN_SHADE, CLOTH);
}
function omariForearm(g, look) {
  g.children[0].material.color.setHex(look.skin);
  addMerged(g, [cyl(0.051, 0.053, 0.039, 12, true, [0, 0.081, 0])], look.sleeve, CLOTH);
  addMerged(g, [cyl(0.046, 0.046, 0.029, 12, true, [0, -0.087, 0])], 0x514139, CLOTH);
}
function omariBoot(g) {
  addMerged(g, [cyl(0.059, 0.056, 0.06, 12, true, [0, 0.124, 0])], 0x5b4c3e, CLOTH);
  addMerged(g, [box(0.005, 0.16, 0.007, [0.053, -0.003, 0])], 0x67594a, CLOTH);
}

const SHRINE_MOSS = 0x3b5344;
const SHRINE_SAGE = 0x627b5c;
const SHRINE_RED = 0x9a4234;
const MINAMI_SHRINE = {
  chest(g, look) {
    clothBase(g, LINEN);
    clothNeck(g, look);
    // Crossed collar, narrow sage inner edge and an unadorned ivory shoulder.
    addMerged(g, [box(0.006, 0.292, 0.037, [0.124, 0.006, 0.017], [0.52, 0, 0]), box(0.006, 0.169, 0.029, [0.125, 0.065, -0.038], [-0.5, 0, 0])], LINEN_SHADE, CLOTH);
    addMerged(g, [box(0.007, 0.286, 0.019, [0.128, 0.006, 0.018], [0.52, 0, 0]), box(0.007, 0.162, 0.017, [0.129, 0.065, -0.038], [-0.5, 0, 0])], LINEN, CLOTH);
    addMerged(g, [box(0.004, 0.22, 0.006, [0.133, 0.034, 0.041], [0.52, 0, 0])], SHRINE_SAGE, CLOTH);
  },
  abdomen(g) {
    clothBase(g, LINEN);
    clothBand(0.12, 0.17, -0.027, 0.088, SHRINE_RED, g);
    clothBand(0.122, 0.172, -0.024, 0.009, 0xcbac83, g);
    addMerged(g, [box(0.007, 0.064, 0.058, [0.124, -0.027, 0.006]), box(0.027, 0.05, 0.11, [-0.121, -0.026, 0])], 0xb25948, CLOTH);
    addMerged(g, [taperedTube([[0.128, -0.023, -0.031], [0.145, -0.044, -0.064], [0.135, -0.054, -0.014]], [0.003, 0.003, 0.003], 7, 4)], 0xdbc9a6, CLOTH);
  },
  pelvis(g) {
    clothBase(g, SHRINE_MOSS);
    addMerged(g, [
      clothPanel(0.112, [[0.079, -0.16], [0.079, -0.018], [-0.185, -0.04], [-0.159, -0.177]]),
      clothPanel(0.112, [[0.079, 0.018], [0.079, 0.16], [-0.159, 0.177], [-0.185, 0.04]]),
    ], SHRINE_SAGE, CLOTH);
    addMerged(g, [
      clothPanel(0.117, [[0.079, -0.154], [0.079, -0.091], [-0.147, -0.108], [-0.171, -0.172]]),
      clothPanel(0.117, [[0.079, 0.091], [0.079, 0.154], [-0.171, 0.172], [-0.147, 0.108]]),
    ], SHRINE_MOSS, CLOTH);
    // A short doubled cord and two folded paper offerings; no long rigid charms.
    addMerged(g, [taperedTube([[0.123, 0.078, -0.093], [0.126, 0.01, -0.117], [0.132, -0.07, -0.112]], [0.004, 0.004, 0.003], 8, 4)], 0xc4b68c, CLOTH);
    addMerged(g, [
      clothPanel(0.133, [[0.021, -0.116], [-0.01, -0.096], [-0.029, -0.116], [-0.055, -0.099], [-0.062, -0.111], [-0.027, -0.133], [-0.01, -0.115], [0.015, -0.131]], 0.003),
      clothPanel(0.133, [[-0.054, -0.109], [-0.077, -0.089], [-0.093, -0.106], [-0.12, -0.09], [-0.126, -0.103], [-0.094, -0.121], [-0.077, -0.106], [-0.059, -0.122]], 0.003),
    ], LINEN, { ...CLOTH, side: THREE.DoubleSide });
  },
  head(g, look) {
    quietFace(g, look, 'minami');
    addMerged(g, [
      taperedTube([[0.06, 0.078, -0.066], [0.018, 0.105, -0.079], [-0.061, 0.069, -0.074], [-0.093, 0.029, -0.035]], [0.017, 0.022, 0.024, 0.021], 9, 6),
      taperedTube([[0.064, 0.078, 0.069], [0.031, 0.079, 0.093], [0.009, -0.008, 0.097], [0.026, -0.084, 0.079]], [0.02, 0.021, 0.014, 0.003], 9, 5),
      taperedTube([[0.03, 0.079, -0.09], [0.006, 0.001, -0.1], [0.019, -0.075, -0.086]], [0.017, 0.015, 0.003], 8, 5),
      bake(new THREE.SphereGeometry(0.04, 10, 7), [-0.113, 0.044, 0], null, [0.8, 0.91, 1.06]),
      taperedTube([[-0.119, 0.042, 0], [-0.135, -0.028, 0.009], [-0.131, -0.13, 0.014], [-0.156, -0.203, 0.005]], [0.025, 0.03, 0.025, 0.005], 12, 7),
    ], look.hair, CLOTH);
    addMerged(g, [box(0.044, 0.014, 0.063, [-0.12, 0.044, 0]), clothPanel(-0.133, [[0.043, 0.017], [-0.044, 0.03], [-0.054, 0.014], [0.043, 0.003]])], SHRINE_RED, CLOTH);
    // A single branch pin with two leaves: modest natural detail, no antlers.
    addMerged(g, [taperedTube([[-0.055, 0.077, -0.061], [-0.078, 0.113, -0.089], [-0.071, 0.139, -0.114]], [0.003, 0.003, 0.0015], 7, 4)], 0x8c7751, CLOTH);
    addMerged(g, [
      bake(new THREE.SphereGeometry(0.018, 6, 4), [-0.081, 0.118, -0.111], [0.45, 0.3, 0.3], [0.27, 1.2, 0.56]),
      bake(new THREE.SphereGeometry(0.017, 6, 4), [-0.069, 0.137, -0.113], [-0.4, 0.3, -0.3], [0.28, 0.95, 0.56]),
    ], SHRINE_SAGE, CLOTH);
  },
  uarmS: shrineSleeve,
  uarmO: shrineSleeve,
  farmS: shrineForearm,
  farmO: shrineForearm,
  thighF: shrineThigh,
  thighB: shrineThigh,
  shinF: shrineShin,
  shinB: shrineShin,
  footF: shrineSandal,
  footB: shrineSandal,
};
function shrineSleeve(g) {
  sleeveVolume(g, 1.1, 1.4);
  addMerged(g, [cyl(0.073, 0.074, 0.015, 12, true, [0, -0.092, 0])], LINEN_SHADE, CLOTH);
}
function shrineForearm(g) {
  sleeveVolume(g, 1.42, 1.08);
  addMerged(g, [cyl(0.05, 0.05, 0.032, 12, true, [0, -0.094, 0])], SHRINE_SAGE, CLOTH);
  addMerged(g, [cyl(0.051, 0.051, 0.008, 12, true, [0, -0.094, 0])], LINEN, CLOTH);
}
function shrineThigh(g) {
  // The divided lower garment stays on each thigh/shin. Straight cloth hems and
  // shallow pleats replace the capsule silhouette without spanning a joint.
  shrinePleats(g, 0.091, 0.104, 0.42);
}
function shrineShin(g) {
  shrinePleats(g, 0.104, 0.084, 0.41);
  addMerged(g, [cyl(0.092, 0.089, 0.017, 20, true, [0, -0.146, 0])], LINEN, CLOTH);
}
function shrinePleats(g, rt, rb, h) {
  const geo = new THREE.CylinderGeometry(rt, rb, h, 20, 1, false);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i));
    const fold = 1 + 0.046 * Math.cos(a * 10);
    p.setXYZ(i, p.getX(i) * fold, p.getY(i), p.getZ(i) * fold);
  }
  geo.computeVertexNormals();
  // Retain the original CapsuleGeometry identity/parameters used for radial
  // wound normals. The representative mesh itself and its material stay alive.
  g.children[0].geometry.copy(geo);
  geo.dispose();
}
function shrineSandal(g) {
  // Native shoe dimensions retained; ivory tabi upper and a quiet woven strap.
  g.children[0].material.color.setHex(LINEN);
  addMerged(g, [box(0.252, 0.012, 0.113, [0, -0.033, 0]), box(0.023, 0.009, 0.101, [0.022, 0.041, 0]), box(0.076, 0.009, 0.013, [0.065, 0.041, 0])], 0x6a5940, CLOTH);
}

// Minami v2 keeps the shrine outfit's native body/wound surfaces. The longer
// half-up hair is split at the nape: only short locks follow the head, while the
// loose lower hair follows the upper torso. Nothing changes mass or collision.
function shrineHairLock(points, widths, depth = 0.011) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const vertices = [], indices = [], rings = 10, sides = 8;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, at = curve.getPoint(t), u = t * (widths.length - 1);
    const j = Math.min(widths.length - 2, Math.floor(u));
    const width = THREE.MathUtils.lerp(widths[j], widths[j + 1], u - j);
    for (let k = 0; k < sides; k++) {
      const a = k / sides * Math.PI * 2;
      vertices.push(at.x + Math.cos(a) * depth * Math.min(1, width / 0.015), at.y, at.z + Math.sin(a) * width / 2);
      if (i < rings) {
        const n = i * sides + k, next = i * sides + (k + 1) % sides;
        indices.push(n, next, n + sides, next, next + sides, n + sides);
      }
    }
  }
  for (let k = 1; k < sides - 1; k++) {
    indices.push(0, k + 1, k);
    const end = rings * sides;
    indices.push(end, end + k, end + k + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(vertices.length / 3 * 2), 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function shrineLeafSprig(g, x, y, z, scale, color) {
  const p = (dy, dz) => [x, y + dy * scale, z + dz * scale];
  const shapes = [taperedTube([p(-0.048, 0), p(0, 0.01), p(0.05, 0.004)], [0.002 * scale, 0.002 * scale, 0.001 * scale], 7, 4)];
  for (let i = 0; i < 4; i++) {
    const yy = -0.031 + i * 0.022, s = i % 2 ? -1 : 1;
    shapes.push(clothPanel(x + 0.001, [[y + yy * scale, z + 0.007 * scale], [y + (yy + 0.01) * scale, z + s * 0.032 * scale], [y + (yy + 0.025) * scale, z + s * 0.017 * scale]], 0.002));
  }
  addMerged(g, shapes, color, CLOTH);
}

function groveHakama(g, top, bottom, height) {
  // Deep, broad folds read as cloth at phone distance; the two trouser legs
  // still follow their own ragdoll parts and do not bridge the knees.
  const geo = new THREE.CylinderGeometry(top, bottom, height, 24, 4, false);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i));
    const fold = 1 + 0.063 * Math.cos(a * 6);
    p.setXYZ(i, p.getX(i) * fold * 0.96, p.getY(i), p.getZ(i) * fold);
  }
  geo.computeVertexNormals();
  g.children[0].geometry.copy(geo);
  geo.dispose();
}

// User-selected v3: two low, long bunches tied with red ribbon. The upper
// gather follows the head; overlapping lower lengths follow the chest instead
// of swinging a rigid waist-long sheet through the body when the head turns.
// This is a visual layer, with no hair simulation, collider or body scaling.
function shrineTwinTailHead(g, look) {
  quietFace(g, look, 'minami');
  const hair = [], ribbons = [];
  for (const side of [-1, 1]) {
    // Preserve the open fringe and short face-framing locks from v2.
    hair.push(shrineHairLock([[0.024, 0.104, side * 0.02], [0.073, 0.076, side * 0.047], [0.075, 0.02, side * 0.079], [0.043, -0.046, side * 0.094]], [0.035, 0.039, 0.026, 0.003]));
    hair.push(shrineHairLock([[0.011, 0.052, side * 0.092], [0.001, -0.017, side * 0.113], [0.012, -0.109, side * 0.113], [0.037, -0.154, side * 0.09]], [0.029, 0.035, 0.026, 0.003], 0.012));
    // Sweep each half of the nape into its own knot, behind the ear.
    for (let i = 0; i < 3; i++) {
      hair.push(shrineHairLock([[-0.07 - i * 0.013, 0.072 - i * 0.015, side * 0.022], [-0.097, 0.013, side * 0.075], [-0.089, -0.05, side * 0.123]], [0.038, 0.048, 0.044], 0.012));
    }
    hair.push(shrineHairLock([[-0.087, -0.043, side * 0.127], [-0.116, -0.116, side * 0.16], [-0.152, -0.202, side * 0.172]], [0.045, 0.072, 0.07], 0.023));
    // A broad small bow with two tapered ribbon ends at each side, not one
    // central half-up bow. Both front and rear cameras can read the red ties.
    const x = -0.101, y = -0.04, z = side * 0.138;
    const panel = (points) => clothPanel(x, points.map(([dy, dz]) => [y + dy, z + side * dz]), 0.009);
    ribbons.push(
      panel([[0.004, 0], [0.035, 0.054], [0.002, 0.063], [-0.008, 0.008]]),
      panel([[0.004, 0], [0.026, -0.027], [-0.003, -0.036], [-0.008, -0.005]]),
      panel([[-0.005, -0.003], [-0.078, 0.007], [-0.069, 0.024], [-0.079, 0.035], [0.002, 0.011]]),
      panel([[-0.003, 0.003], [-0.052, 0.054], [-0.037, 0.058], [-0.038, 0.073], [0.004, 0.016]]),
      box(0.036, 0.024, 0.026, [x, y, z]),
    );
  }
  addMerged(g, hair, look.hair, { ...CLOTH, roughness: 1, metalness: 0 });
  addMerged(g, ribbons, SHRINE_RED, CLOTH);
}

function shrineTwinTailLengths(g, look) {
  const hair = [], sheen = [];
  for (const side of [-1, 1]) {
    // Leave the middle of the back open: the pair remains identifiable below
    // the red ties and hangs toward the waist, with individual tapered ends.
    for (let i = 0; i < 3; i++) {
      const offset = (i - 1) * 0.019;
      hair.push(shrineHairLock([
        [-0.151 + i * 0.004, 0.201, side * (0.169 + offset)],
        [-0.168 + i * 0.004, 0.062, side * (0.191 + offset)],
        [-0.18 + i * 0.004, -0.123, side * (0.21 + offset)],
        [-0.165 + i * 0.004, -0.316 + Math.abs(i - 1) * 0.033, side * (0.194 + offset * 0.7)],
      ], [0.035, 0.045, 0.042, 0.003], 0.016));
    }
    sheen.push(shrineHairLock([[-0.196, 0.103, side * 0.188], [-0.198, -0.071, side * 0.214], [-0.185, -0.228, side * 0.2]], [0.004, 0.006, 0.002], 0.001));
  }
  addMerged(g, hair, look.hair, { ...CLOTH, roughness: 1, metalness: 0 });
  addMerged(g, sheen, 0x383d32, { ...CLOTH, roughness: 1, metalness: 0 });
}

const MINAMI_GROVE = {
  ...MINAMI_SHRINE,
  head(g, look) {
    if (look.hairStyle === 'long-twintails') return shrineTwinTailHead(g, look);
    quietFace(g, look, 'minami');
    const hair = [];
    // An open centre fringe and tapered cheek locks keep the youthful face
    // visible. The swept upper locks gather at one small red half-up knot.
    for (const s of [-1, 1]) {
      hair.push(shrineHairLock([[0.024, 0.104, s * 0.02], [0.073, 0.076, s * 0.047], [0.075, 0.02, s * 0.079], [0.043, -0.046, s * 0.094]], [0.035, 0.039, 0.026, 0.003]));
      hair.push(shrineHairLock([[0.011, 0.052, s * 0.092], [0.001, -0.017, s * 0.113], [0.012, -0.109, s * 0.113], [0.037, -0.154, s * 0.09]], [0.029, 0.035, 0.026, 0.003], 0.012));
      hair.push(taperedTube([[-0.017, 0.075, s * 0.073], [-0.075, 0.06, s * 0.063], [-0.117, 0.018, s * 0.025]], [0.009, 0.01, 0.009], 10, 6));
    }
    for (let i = 0; i < 5; i++) {
      const z = (i - 2) * 0.035;
      hair.push(shrineHairLock([[-0.075, 0.071, z * 0.8], [-0.111, -0.005, z], [-0.142, -0.119, z * 1.06], [-0.154, -0.192 + Math.abs(i - 2) * 0.008, z * 1.07]], [0.04, 0.046, 0.045, 0.035], 0.008));
    }
    addMerged(g, hair, look.hair, { ...CLOTH, roughness: 1, metalness: 0 });
    addMerged(g, [
      clothPanel(-0.13, [[0.025, -0.005], [0.042, -0.043], [0.011, -0.04], [0.016, 0]]),
      clothPanel(-0.13, [[0.025, 0.005], [0.038, 0.039], [0.008, 0.043], [0.016, 0]]),
      clothPanel(-0.137, [[0.021, -0.008], [-0.049, -0.033], [-0.059, -0.019], [0.016, 0.008]]),
      box(0.02, 0.016, 0.021, [-0.134, 0.021, 0]),
    ], SHRINE_RED, CLOTH);
    // A small pale-green leaf pin, rather than a crown or projecting antlers.
    addMerged(g, [taperedTube([[0, 0.073, -0.108], [-0.018, 0.114, -0.112], [-0.041, 0.137, -0.099]], [0.0025, 0.0025, 0.001], 7, 4)], 0x8c7751, CLOTH);
    addMerged(g, [
      bake(new THREE.SphereGeometry(0.017, 6, 4), [-0.011, 0.108, -0.119], [0.4, 0.2, 0.4], [0.25, 1.1, 0.58]),
      bake(new THREE.SphereGeometry(0.016, 6, 4), [-0.031, 0.129, -0.108], [-0.35, 0.3, -0.3], [0.25, 1.1, 0.58]),
    ], 0x7e9469, CLOTH);
  },
  chest(g, look) {
    MINAMI_SHRINE.chest(g, look);
    // A sewn inner lapel and underarm seams give the light robe a clear fold.
    addMerged(g, [
      box(0.005, 0.253, 0.012, [0.135, 0.013, 0.037], [0.52, 0, 0]),
      ...[-1, 1].map((s) => box(0.004, 0.204, 0.006, [0.122, -0.025, s * 0.142], [s * 0.04, 0, 0])),
    ], 0xafa991, CLOTH);
    if (look.hairStyle === 'long-twintails') {
      shrineTwinTailLengths(g, look);
    } else {
      const hair = [];
      for (let i = 0; i < 5; i++) {
        const z = (i - 2) * 0.036;
        hair.push(shrineHairLock([[-0.147, 0.182, z], [-0.151, 0.094, z * 1.05], [-0.142, -0.032, z * 1.13], [-0.144, -0.135 + Math.abs(i - 2) * 0.018, z * 0.94]], [0.047, 0.05, 0.046, 0.009], 0.008));
      }
      addMerged(g, hair, look.hair, { ...CLOTH, roughness: 1, metalness: 0 });
    }
    shrineLeafSprig(g, 0.127, -0.052, -0.084, 0.58, 0xa3ac8b);
  },
  abdomen(g) {
    MINAMI_SHRINE.abdomen(g);
    // Fine doubled rope follows the belt rather than hovering across the body.
    addMerged(g, [-1, 1].map((s) => taperedTube([[0.126, -0.017 + s * 0.003, -0.155], [0.133, -0.032 + s * 0.003, -0.07], [0.134, -0.023 + s * 0.003, 0.075], [0.126, -0.017 + s * 0.003, 0.154]], [0.0024, 0.0024, 0.0024, 0.0024], 12, 4)), 0xd6c49d, CLOTH);
  },
  pelvis(g) {
    MINAMI_SHRINE.pelvis(g);
    addMerged(g, [-1, 1].map((s) => clothPanel(0.122, [[0.073, s * 0.076], [0.073, s * 0.083], [-0.16, s * 0.109], [-0.164, s * 0.103]], 0.003)), 0x718363, CLOTH);
  },
  uarmS: groveShrineSleeve, uarmO: groveShrineSleeve,
  farmS: groveShrineForearm, farmO: groveShrineForearm,
  thighF: groveShrineThigh, thighB: groveShrineThigh,
  shinF: groveShrineShin, shinB: groveShrineShin,
};
function groveShrineSleeve(g) {
  sleeveVolume(g, 1.12, 1.55);
  addMerged(g, [cyl(0.078, 0.079, 0.014, 12, true, [0, -0.089, 0])], LINEN_SHADE, CLOTH);
}
function groveShrineForearm(g) {
  sleeveVolume(g, 1.52, 1.07);
  addMerged(g, [cyl(0.06, 0.05, 0.046, 12, true, [0, -0.091, 0])], 0x9baa8c, CLOTH);
  addMerged(g, [cyl(0.061, 0.06, 0.006, 12, true, [0, -0.071, 0]), cyl(0.0518, 0.0508, 0.006, 12, true, [0, -0.111, 0])], LINEN, CLOTH);
}
function groveShrineThigh(g) {
  groveHakama(g, 0.092, 0.115, 0.42);
}
function groveShrineShin(g) {
  groveHakama(g, 0.114, 0.088, 0.41);
  // The hem repeats the trouser's six-fold section, avoiding a floating ring.
  const hem = new THREE.CylinderGeometry(0.091, 0.09, 0.018, 24, 1, true);
  const p = hem.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i)), fold = 1 + 0.063 * Math.cos(a * 6);
    p.setXYZ(i, p.getX(i) * fold * 0.96, p.getY(i) - 0.183, p.getZ(i) * fold);
  }
  hem.computeVertexNormals();
  addMerged(g, [hem], 0x9baa8c, CLOTH);
}

// ═════════════════════ 겉모습 다듬기 (10/10): 미나미 v4 · 오마리 v2 ═════════════════════
// 둘 다 부위의 대표 메쉬(상처 자국이 붙는 겉면)의 꼴만 바꾼다. 대표 메쉬의 종류(Capsule/Box)와 치수 값
// (geometry.parameters — effects.js surfaceNormal 이 읽는다)은 원래 그대로 되돌려 두고, 손 구체·몸·질량·
// 관절·충돌체는 건드리지 않는다. 다른 인물의 팔다리에는 쓰이지 않는다.

/** 대표 메쉬의 꼴을 geo 로 바꾸되 종류·치수 값은 원래 것을 남긴다 */
function reshapeMain(main, geo) {
  const keep = { ...main.geometry.parameters };
  main.geometry.copy(geo);
  main.geometry.parameters = keep;
  main.geometry.computeBoundingBox();
  main.geometry.computeBoundingSphere();
  geo.dispose();
}

/**
 * 둥글게 깎은 팔다리: 같은 치수의 캡슐을 둘레를 더 잘게 다시 만든 뒤, 길이 방향 자리 t(0 = 위·몸 쪽, 1 = 아래·먼 쪽)마다
 * 앞뒤(x)·옆(z) 굵기 배율과 앞쪽 내밂을 준다. 네모 막대처럼 보이던 10각 굵기 일정한 캡슐을 끝으로 갈수록 가는 꼴로.
 */
function roundLimb(g, profile, capTop = 1, capBottom = 1) {
  const main = g.children[0];
  const { radius, height } = main.geometry.parameters;
  const geo = new THREE.CapsuleGeometry(radius, height, 6, 20);
  const pos = geo.attributes.position;
  geo.computeBoundingBox();
  const min = geo.boundingBox.min.y, max = geo.boundingBox.max.y;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, Math.min(1, (max - pos.getY(i)) / (max - min)));
    // 끝 반구를 길게 늘이면(cap > 1) 관절 너머 이웃 도막과 겹쳐 무릎·팔꿈치가 구슬처럼 잘록해 보이지 않는다
    const y = pos.getY(i), h = height / 2;
    if (y > h) pos.setY(i, h + (y - h) * capTop);
    else if (y < -h) pos.setY(i, -h + (y + h) * capBottom);
    const v = profile(t); // 배율 하나(둥근 단면) 또는 [앞뒤, 옆, 앞쪽 내밂]
    const [sx, sz, dx = 0] = typeof v === 'number' ? [v, v, 0] : v;
    pos.setXYZ(i, pos.getX(i) * sx + dx * radius, pos.getY(i), pos.getZ(i) * sz);
  }
  geo.computeVertexNormals();
  reshapeMain(main, geo);
  return main;
}
const smooth01 = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
/** 세 점(위·가운데·아래)을 지나는 부드러운 배율 곡선 */
const curve3 = (top, mid, bottom, at = 0.4) => (t) => (t < at ? top + (mid - top) * smooth01(0, at, t) : mid + (bottom - mid) * smooth01(at, 1, t));

/**
 * 고리(row)마다 단면을 잇는 천 통. section(a, k, row) → [x, z]. 위·아래는 열어 두고 양면으로 칠한다.
 * 이음매(첫 점)는 뒤쪽(a = π)에 둔다 — 앞쪽 주름에 법선 끊김이 생기지 않게.
 */
function clothLoft(ys, sides, section) {
  const vertices = [], uv = [], indices = [];
  ys.forEach((y, row) => {
    for (let k = 0; k < sides; k++) {
      const a = Math.PI + (k / sides) * Math.PI * 2;
      const [x, z] = section(a, k, row);
      vertices.push(x, y, z);
      uv.push(k / sides, row / (ys.length - 1));
    }
  });
  for (let r = 0; r < ys.length - 1; r++) for (let k = 0; k < sides; k++) {
    const n = r * sides + k, m = r * sides + ((k + 1) % sides);
    indices.push(n, n + sides, m, m, n + sides, m + sides);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ── 미나미 v4: 아래로 퍼지는 하카마 · 네모난 일본 소매 · 다스키 ──
const HAKAMA_MOSS = 0x3f5747;
const HAKAMA_SIDES = 48;
// 서 있는 자세 세계 높이로 적은 하카마 바깥선(사다리꼴): 허리 1.05 m 에서 옷단 0.09 m 로 갈수록 넓다.
//  out = 다리 축에서 바깥 가장자리까지(옆), rx = 앞뒤 반폭. 안쪽 가장자리는 두 다리가 가운데서 살짝 겹치게(축에서 0.09)
const HAKAMA_LINE = (y) => {
  const t = Math.max(0, Math.min(1, (0.95 - y) / 0.86)); // 0 = 허벅지 위 0.95 m, 1 = 옷단 0.09 m
  return { out: 0.098 + 0.067 * t, rx: 0.128 + 0.03 * t };
};
/**
 * 늘어진 천 음영: 법선의 위아래 성분을 줄여, 허벅지·정강이 도막이 앞뒤로 기울어도 밝기가 거의 같게 한다.
 * (무릎을 굽힌 자세에서 위 도막은 하늘을, 아래 도막은 땅을 향해 무릎에 가로 띠처럼 밝기가 끊겨 보였다.)
 * 좌우로 꺾인 칼주름 음영은 그대로 남는다. 셰이더 한 줄, 그리는 데만 쓰인다.
 */
function hangingClothShading(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <normal_vertex>', `{
      vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
      transformedNormal = normalize(transformedNormal - dot(transformedNormal, upV) * upV * 0.8);
    }
    #include <normal_vertex>`);
  };
  mat.customProgramCacheKey = () => 'hanging-cloth';
  return mat;
}
/** 다리 한 도막의 하카마: 부위 좌표 y(위→아래) 고리마다 사다리꼴 바깥선을 따르고, 앞쪽엔 칼주름(톱니) 세 줄 */
function flaredHakamaLeg(g, d, yTop, yBottom, grow, pleatAt) {
  const side = Math.sign(d?.pos?.[2] || 1); // 다리 바깥쪽(+z/−z)
  const cy = d?.pos?.[1] ?? 0.5; // 부위 가운데의 서 있는 높이
  const rows = 7, ys = [];
  for (let i = 0; i < rows; i++) ys.push(yTop + ((yBottom - yTop) * i) / (rows - 1));
  const geo = clothLoft(ys, HAKAMA_SIDES, (a, k, row) => {
    const { out, rx } = HAKAMA_LINE(cy + ys[row]);
    const rz = (out + 0.09) / 2, off = (out - 0.09) / 2;
    const c = Math.cos(a), s = Math.sin(a);
    // 앞쪽 ±50° 안: 4칸마다 한 번 꺾이는 칼주름. 바깥쪽을 향해 접힌다
    const w = smooth01(0.55, 0.75, c);
    const step = (k % 4) / 3;
    const fold = (1 + w * 0.12 * (step - 0.5) * pleatAt(row / (rows - 1))) * grow(row / (rows - 1));
    return [c * rx * fold, (s * rz + off) * fold];
  });
  // 위 식은 단면을 +z 쪽 다리 기준으로 만든다 → 반대쪽 다리는 z 를 뒤집는다
  if (side < 0) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, -p.getZ(i));
    geo.index.array.reverse();
  }
  // 칼주름의 꺾인 면이 폰 거리에서도 읽히게 면마다 따로 칠한다(각진 음영)
  const flat = geo.toNonIndexed();
  geo.dispose();
  flat.computeVertexNormals();
  const main = g.children[0];
  main.material.color.setHex(HAKAMA_MOSS);
  main.material.side = THREE.DoubleSide;
  main.material.roughness = 0.95;
  main.material.metalness = 0;
  hangingClothShading(main.material);
  reshapeMain(main, flat);
}
function hakamaThigh(g, look, d) {
  // 엉덩이 위(골반 통 안)부터 무릎 아래까지 겹쳐 내려온다. 무릎 쪽 끝은 정강이 도막보다 3% 크고, 겹치는 자리에선
  // 주름 깊이를 줄여(톱니 옷단이 무릎에 가로줄로 읽히지 않게) 두 도막 겉선이 거의 맞물린다
  flaredHakamaLeg(g, d, 0.235, -0.245, (u) => 1 + 0.03 * smooth01(0.6, 1, u), (u) => 1 - 0.65 * smooth01(0.75, 1, u));
}
function hakamaShin(g, look, d) {
  // 무릎 위부터 발목(버선이 보이게)까지. 위쪽 끝은 허벅지 도막 안으로 3% 들어간다. 가로 옷단 띠 없음
  flaredHakamaLeg(g, d, 0.24, -0.2, (u) => 1 - 0.03 * (1 - smooth01(0, 0.3, u)), (u) => 0.35 + 0.65 * smooth01(0, 0.25, u));
}
/** 골반: 허리띠 밑에서 다리 도막으로 이어지는 하카마 윗단(둥근 네모 단면, 앞쪽 칼주름 다섯 줄) */
function hakamaWaist(g) {
  const ys = [0.07, 0.02, -0.04, -0.09, -0.13];
  const sides = 64;
  const geo = clothLoft(ys, sides, (a, k, row) => {
    const t = row / (ys.length - 1);
    const rx = 0.12 + 0.012 * t, rz = 0.185 + 0.015 * t, n = 6 - 2 * t;
    const c = Math.cos(a), s = Math.sin(a);
    const se = (v, r) => Math.sign(v) * Math.pow(Math.abs(v), 2 / n) * r;
    let x = se(c, rx), z = se(s, rz);
    if (c > 0.3 && Math.abs(z) < 0.15) {
      const step = ((k + 2) % 4) / 3;
      x += 0.008 * (step - 0.5) * smooth01(0.3, 0.6, c);
    }
    return [x, z];
  });
  hangingClothShading(addMerged(g, [geo], HAKAMA_MOSS, { ...CLOTH, side: THREE.DoubleSide }).material);
}

const TASUKI = SHRINE_RED;
/** 위팔 소매 단면: 어깨 쪽은 둥글고, 팔꿈치 쪽으로 갈수록 팔 뒤쪽(−x, 팔을 들면 아래쪽)으로 길게 늘어진 네모가 된다 */
function sleeveSection(t, a, inset = 1) {
  const cx = -0.047 * t, rx = (0.06 + 0.052 * t) * inset, rz = (0.057 + 0.015 * t) * inset;
  const n = 2 + 5 * smooth01(0, 0.6, t);
  const c = Math.cos(a), s = Math.sin(a);
  const bunch = 1 + 0.05 * Math.max(0, Math.sin(t * Math.PI * 3)) * (1 - t); // 다스키로 걷어 올려 어깨 쪽에 생긴 가로 주름
  return [cx + Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * rx * bunch, Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * rz * bunch];
}
/** 위팔: 둥글게 부푼 서양식 소매 대신 네모나게 늘어지는 일본 소매를 다스키로 걷어 올린 꼴 — 옆에서 보면 사다리꼴, 팔꿈치에서 끝난다 */
function japaneseSleeve(g) {
  japaneseSleeveTied(g, TASUKI);
}
function japaneseSleeveTied(g, cordColor) {
  const ys = [0.15, 0.11, 0.06, 0.0, -0.06, -0.12, -0.165];
  const t = (y) => (0.15 - y) / 0.315;
  const main = g.children[0];
  main.material.side = THREE.DoubleSide;
  reshapeMain(main, clothLoft(ys, 36, (a, k, row) => sleeveSection(t(ys[row]), a)));
  // 네모난 소맷부리 안쪽의 엷은 단(속옷 깃 색)과 겨드랑이 쪽 다스키 고리
  addMerged(g, [clothLoft([-0.148, -0.168], 36, (a, k, row) => sleeveSection(t([-0.148, -0.168][row]), a, 1.025))], LINEN_SHADE, { ...CLOTH, side: THREE.DoubleSide });
  addMerged(g, [bake(new THREE.TorusGeometry(0.066, 0.0065, 5, 20), [-0.008, 0.1, 0], [Math.PI / 2, 0, 0.12], [1.08, 1, 1.0])], cordColor, CLOTH);
}
/** 아래팔: 소매를 걷어 맨팔 — 팔꿈치 쪽이 굵고 손목으로 가늘어진다. 팔꿈치 위에 걷어 접힌 흰 속소매 한 겹 */
function tiedForearm(g, look) {
  roundLimb(g, curve3(1.08, 1.04, 0.8, 0.35)).material.color.setHex(look.skin);
  addMerged(g, [cyl(0.05, 0.047, 0.03, 16, true, [0, 0.085, 0])], LINEN, { ...CLOTH, side: THREE.DoubleSide });
}
/** 가슴: 다스키 — 어깨를 넘어 겨드랑이를 돌고 등에서 X 자로 엇갈린다. 엇갈린 자리에 작은 매듭 */
function tasukiCords(g, color = TASUKI, r = 0.0068) {
  const cords = [];
  for (const s of [-1, 1]) {
    // 어깨 고리: 등 위 → 어깨 너머 → 앞 어깨 → 겨드랑이 밑 → 등 아래 (같은 쪽)
    cords.push(taperedTube([[-0.126, 0.132, s * 0.148], [-0.06, 0.147, s * 0.163], [0.05, 0.147, s * 0.165], [0.126, 0.118, s * 0.163], [0.128, 0.02, s * 0.172], [0.07, -0.035, s * 0.191], [-0.07, -0.04, s * 0.191], [-0.127, -0.03, s * 0.168]], [r, r, r, r, r, r, r, r], 28, 5));
    // 등의 X: 이쪽 어깨 위에서 반대쪽 겨드랑이 밑으로
    cords.push(taperedTube([[-0.126, 0.132, s * 0.148], [-0.131, 0.05, 0], [-0.127, -0.03, -s * 0.168]], [r, r, r], 14, 5));
  }
  addMerged(g, cords, color, CLOTH);
  addMerged(g, [
    bake(new THREE.SphereGeometry(0.016, 8, 6), [-0.134, 0.05, 0], null, [0.6, 1, 1.2]),
    taperedTube([[-0.136, 0.045, 0.008], [-0.14, 0.0, 0.022], [-0.138, -0.035, 0.03]], [0.006, 0.006, 0.004], 8, 4),
    taperedTube([[-0.136, 0.045, -0.006], [-0.141, 0.005, -0.016], [-0.139, -0.025, -0.026]], [0.006, 0.006, 0.004], 8, 4),
  ], color, CLOTH);
}
const MINAMI_HAKAMA = {
  ...MINAMI_GROVE,
  chest(g, look) {
    MINAMI_GROVE.chest(g, look);
    tasukiCords(g, TASUKI, 0.0068);
  },
  pelvis(g) {
    // 옛 앞치마 같은 앞판(세이지·이끼색 조각)은 빼고, 허리 밑 하카마 윗단 + 그대로의 끈·종이 장식
    clothBase(g, HAKAMA_MOSS);
    hakamaWaist(g);
    addMerged(g, [taperedTube([[0.13, 0.078, -0.093], [0.136, 0.01, -0.117], [0.142, -0.07, -0.112]], [0.004, 0.004, 0.003], 8, 4)], 0xc4b68c, CLOTH);
    addMerged(g, [
      clothPanel(0.143, [[0.021, -0.116], [-0.01, -0.096], [-0.029, -0.116], [-0.055, -0.099], [-0.062, -0.111], [-0.027, -0.133], [-0.01, -0.115], [0.015, -0.131]], 0.003),
      clothPanel(0.143, [[-0.054, -0.109], [-0.077, -0.089], [-0.093, -0.106], [-0.12, -0.09], [-0.126, -0.103], [-0.094, -0.121], [-0.077, -0.106], [-0.059, -0.122]], 0.003),
    ], LINEN, { ...CLOTH, side: THREE.DoubleSide });
  },
  uarmS: japaneseSleeve, uarmO: japaneseSleeve,
  farmS: tiedForearm, farmO: tiedForearm,
  thighF: hakamaThigh, thighB: hakamaThigh,
  shinF: hakamaShin, shinB: hakamaShin,
};

// ── 미나미 v5 (10/10 사장님 "검객이 아니라 신녀·무녀"): 흰 다스키 · 뒤로 낮게 하나로 묶은 머리(흰 종이 감싸기 + 붉고 흰 끈) ·
//    걷은 소매 끝의 붉은 꿰맴 끈(소데쿠쿠리). 하카마(이끼색·사다리꼴·주름)·얼굴·깃·허리띠는 v4 그대로 ──
const MIKO_WHITE = 0xf4f1e8;
const MIKO_PAPER = 0xfbfaf4;
const MIKO_RED = 0xb8352b;
/** 머리: 앞머리·뺨 옆 머리는 v2·v3 그대로, 나머지는 모두 뒤로 쓸어 목덜미 아래 한 점으로 모은다 */
function mikoLowTailHead(g, look) {
  quietFace(g, look, 'minami');
  const hair = [];
  for (const side of [-1, 1]) {
    hair.push(shrineHairLock([[0.024, 0.104, side * 0.02], [0.073, 0.076, side * 0.047], [0.075, 0.02, side * 0.079], [0.043, -0.046, side * 0.094]], [0.035, 0.039, 0.026, 0.003]));
    hair.push(shrineHairLock([[0.011, 0.052, side * 0.092], [0.001, -0.017, side * 0.113], [0.012, -0.109, side * 0.113], [0.037, -0.154, side * 0.09]], [0.029, 0.035, 0.026, 0.003], 0.012));
    // 옆머리를 귀 위로 넘겨 뒤통수 아래 묶은 자리로 — 머리 겉면에 바짝 붙인 가는 가닥 하나
    hair.push(shrineHairLock([[0.01, 0.07, side * 0.088], [-0.05, 0.035, side * 0.093], [-0.092, -0.045, side * 0.058], [-0.103, -0.112, side * 0.012]], [0.03, 0.034, 0.026, 0.012], 0.006));
  }
  // 뒤통수~목덜미를 덮는 머리 덩어리: 아래로 갈수록 좁아져 묶은 자리로 모인다 (사이로 살이 비치지 않게)
  const back = new THREE.SphereGeometry(0.106, 18, 12);
  const p = back.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), narrow = 1 - 0.55 * smooth01(0.0, -0.106, y);
    p.setXYZ(i, Math.min(p.getX(i), 0.02) * 0.95, y * 1.08, p.getZ(i) * narrow);
  }
  back.computeVertexNormals();
  hair.push(bake(back, [-0.012, -0.012, 0]));
  addMerged(g, hair, look.hair, { ...CLOTH, roughness: 1, metalness: 0 });
}
/** 가슴(등): 목덜미 아래 묶은 자리 → 흰 종이(다케나가) 감싸기 · 붉고 흰 끈(미즈히키) · 등 가운데까지 늘어진 한 줄기 */
function mikoLowTailLengths(g, look) {
  const hair = [];
  for (let i = 0; i < 4; i++) {
    const z = (i - 1.5) * 0.012;
    hair.push(shrineHairLock([[-0.135, 0.19, z * 0.6], [-0.15, 0.1, z], [-0.155, -0.02, z * 1.15], [-0.15, -0.13 + Math.abs(i - 1.5) * 0.012, z * 0.8]], [0.034, 0.044, 0.04, 0.006], 0.014));
  }
  addMerged(g, hair, look.hair, { ...CLOTH, roughness: 1, metalness: 0 });
  // 흰 종이: 묶은 다발을 감싼 접힌 종이 띠(아래로 조금 넓어진다)와 접힌 금 한 줄
  if(look.alter==='minami')return; // Her fallen branch replaces the paper hair ornament.
  addMerged(g, [bake(new THREE.CylinderGeometry(0.024, 0.028, 0.075, 12, 1, false), [-0.15, 0.125, 0], [0, 0, 0.1], [1, 1, 1.15])], MIKO_PAPER, CLOTH);
  addMerged(g, [box(0.002, 0.07, 0.004, [-0.177, 0.124, 0], [0, 0, 0.1])], LINEN_SHADE, CLOTH);
  // 붉고 흰 끈: 종이 위아래를 감는 가는 고리 넷(붉·흰 번갈아)과 작은 나비 매듭
  const ring = (y, r) => bake(new THREE.TorusGeometry(r, 0.0032, 4, 16), [-0.15 + (0.125 - y) * 0.1, y, 0], [Math.PI / 2, 0, 0.1], [1, 1, 1.15]);
  addMerged(g, [ring(0.159, 0.0255), ring(0.093, 0.0292)], MIKO_RED, CLOTH);
  addMerged(g, [ring(0.152, 0.026), ring(0.1, 0.0288)], MIKO_WHITE, CLOTH);
  addMerged(g, [
    taperedTube([[-0.172, 0.157, 0], [-0.183, 0.17, 0.018], [-0.178, 0.157, 0.03], [-0.172, 0.157, 0]], [0.003, 0.004, 0.003, 0.003], 10, 4),
    taperedTube([[-0.172, 0.157, 0], [-0.183, 0.17, -0.018], [-0.178, 0.157, -0.03], [-0.172, 0.157, 0]], [0.003, 0.004, 0.003, 0.003], 10, 4),
  ], MIKO_RED, CLOTH);
}
/** 위팔: v4 의 네모 소매(흰 다스키 고리) + 걷은 소맷부리를 꿰맨 붉은 끈 띠와 늘어진 끈 끝 두 가닥(소데쿠쿠리) */
function mikoSleeve(g) {
  japaneseSleeveTied(g, MIKO_WHITE);
  const t = (y) => (0.15 - y) / 0.315;
  addMerged(g, [clothLoft([-0.152, -0.16], 36, (a, k, row) => sleeveSection(t([-0.152, -0.16][row]), a, 1.045))], MIKO_RED, { ...CLOTH, side: THREE.DoubleSide });
  // 끈 끝: 소매 자락 아래 모서리(팔을 들면 아래쪽)에서 늘어진다
  addMerged(g, [-1, 1].map((s) => taperedTube([[-0.152, -0.157, s * 0.012], [-0.162, -0.172, s * 0.017], [-0.168, -0.19, s * 0.02], [-0.172, -0.206, s * 0.018]], [0.0035, 0.0035, 0.003, 0.0025], 10, 4)), MIKO_RED, CLOTH);
  addMerged(g, [-1, 1].map((s) => ball(0.0062, 6, 4, [-0.173, -0.209, s * 0.018])), MIKO_RED, CLOTH);
}
const MINAMI_MIKO = {
  ...MINAMI_HAKAMA,
  head: mikoLowTailHead,
  chest(g, look) {
    MINAMI_SHRINE.chest(g, look);
    // v2~v4 와 같은 안깃 줄·겨드랑이 솔기·잎 장식 (MINAMI_GROVE.chest 에서 머리만 뺀 것)
    addMerged(g, [
      box(0.005, 0.253, 0.012, [0.135, 0.013, 0.037], [0.52, 0, 0]),
      ...[-1, 1].map((s) => box(0.004, 0.204, 0.006, [0.122, -0.025, s * 0.142], [s * 0.04, 0, 0])),
    ], 0xafa991, CLOTH);
    shrineLeafSprig(g, 0.127, -0.052, -0.084, 0.58, 0xa3ac8b);
    mikoLowTailLengths(g, look);
    tasukiCords(g, MIKO_WHITE, 0.0075);
  },
  uarmS: mikoSleeve, uarmO: mikoSleeve,
};

// ── 오마리 v2: 팔다리만 둥글고 끝으로 갈수록 가늘게 (옷 디자인·색은 v1 그대로) ──
function omariSleeveRound(g) {
  // 셔츠 소매: 어깨에서 살짝 부풀었다가 팔꿈치로 모인다
  roundLimb(g, curve3(1.16, 1.24, 0.94, 0.4), 1, 1.5);
  addMerged(g, [cyl(0.0505, 0.0485, 0.037, 16, true, [0, -0.096, 0])], LINEN_SHADE, CLOTH);
}
function omariForearmRound(g, look) {
  // 맨팔: 팔꿈치 아래 근육이 조금 불룩하고 손목으로 가늘어진다
  roundLimb(g, curve3(1.08, 1.14, 0.8, 0.3), 1.3, 1).material.color.setHex(look.skin);
  addMerged(g, [cyl(0.0505, 0.05, 0.039, 16, true, [0, 0.081, 0])], look.sleeve, CLOTH);
  addMerged(g, [cyl(0.0385, 0.037, 0.029, 16, true, [0, -0.087, 0])], 0x514139, CLOTH);
}
function omariThighRound(g) {
  // 바지: 엉덩이 쪽이 넓고 무릎으로 가늘다. 앞쪽 허벅지가 조금 둥글게 나온다
  roundLimb(g, (t) => [curve3(1.24, 1.16, 0.84, 0.35)(t), curve3(1.2, 1.1, 0.84, 0.35)(t), 0.06 * Math.sin(t * Math.PI)], 1, 1.7);
}
function omariBootRound(g) {
  // 장화: 무릎 아래 종아리가 불룩하고 발목으로 가늘어지는 통. 위 접단은 종아리 위로 살짝 벌어지고, 앞 솔기는 앞면 곡선을 따른다
  const prof = (t) => [curve3(1.08, 1.2, 0.76, 0.3)(t), curve3(1.06, 1.16, 0.78, 0.3)(t), -0.04 * Math.sin(t * Math.PI)];
  roundLimb(g, prof, 1.2, 1);
  const R = 0.05, H = 0.42; // 정강이 캡슐 겉 반지름·전체 길이 (partDefs shinF capsule 0.16/0.05)
  const at = (y) => { const t = (H / 2 - y) / H; const [sx, , dx] = prof(t); return { x: R * sx + dx * R, t }; };
  const cuff = clothLoft([0.152, 0.13, 0.095], 24, (a, k, row) => {
    const y = [0.152, 0.13, 0.095][row];
    const { t } = at(y);
    const [sx, sz, dx] = prof(t);
    const flare = 1.12 - 0.05 * row;
    return [Math.cos(a) * R * sx * flare + dx * R, Math.sin(a) * R * sz * flare];
  });
  addMerged(g, [cuff], 0x5b4c3e, { ...CLOTH, side: THREE.DoubleSide });
  const seam = [0.08, 0.02, -0.04, -0.1, -0.15].map((y) => [at(y).x + 0.002, y, 0]);
  addMerged(g, [taperedTube(seam, [0.0035, 0.0035, 0.0035, 0.0035, 0.003], 12, 4)], 0x67594a, CLOTH);
}
/** 발: 상자 신발 대신 둥근 코의 장화 발. 대표 메쉬는 같은 치수의 상자(면 수만 늘림)를 깎아 만든다 */
function omariFootRound(g) {
  const main = g.children[0];
  const { width, height, depth } = main.geometry.parameters; // 0.25 × 0.075 × 0.11
  const geo = new THREE.BoxGeometry(width, height, depth, 12, 4, 6);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (width / 2), y = p.getY(i) / (height / 2), z = p.getZ(i) / (depth / 2); // -1..1
    // 옆에서 본 꼴: 발목 쪽은 높고 발끝으로 갈수록 발등이 낮아진다(발끝 높이 = 원래의 55%)
    const yTop = 1 - 0.9 * smooth01(-0.15, 1, x);
    const yr = -1 + ((y + 1) / 2) * (yTop + 1);
    // 위에서 본 꼴: 발끝은 반원으로, 뒤꿈치는 모서리를 굴린다
    const toe = x > 0.4 ? Math.sqrt(Math.max(0.12, 1 - ((x - 0.4) / 0.6) ** 2)) : 1;
    const heel = x < -0.65 ? Math.sqrt(Math.max(0.36, 1 - ((x + 0.65) / 0.35) ** 2)) : 1;
    // 단면: 윗모서리를 둥글게
    const top = smooth01(-0.2, 1, y);
    const zr = z * toe * heel * (1 - 0.3 * top * Math.abs(z) ** 3);
    p.setXYZ(i, p.getX(i), yr * (height / 2), zr * (depth / 2));
  }
  // 면끼리 꼭짓점을 이어 매끈하게 칠한다(상자 모서리 음영이 남지 않게)
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  const smoothGeo = mergeVertices(geo, 1e-5);
  geo.dispose();
  smoothGeo.computeVertexNormals();
  reshapeMain(main, smoothGeo);
}
const OMARI_ROUND = {
  ...OMARI_SEAFARER,
  uarmS: omariSleeveRound, uarmO: omariSleeveRound,
  farmS: omariForearmRound, farmO: omariForearmRound,
  thighF: omariThighRound, thighB: omariThighRound,
  shinF: omariBootRound, shinB: omariBootRound,
  footF: omariFootRound, footB: omariFootRound,
};

// ── 토메 비달 v2 (10/10 사장님 "사서 좋고 칭호도 써. 안경도 넣어"): 볼로냐 아르키진나시오 도서관의 고문서 사서(시간을 넘는 설정 — 사장님 10/10 08:0x) ──
//  v1(포도주색 더블릿·리넨 깃·놋 단추·은발·수염·장화)을 그대로 입고, 그 위에
//   · 소매 없는 앞트임 학자 겉옷(ropa): 따뜻한 먹색. 가운데가 트여 더블릿·깃·단추가 보인다. 가슴·배·골반은 둥근 네모 단면의 통을
//     가운데만 비우고 두르며, 허벅지는 다리마다 따라가는 판(바깥·뒤만 덮고 안쪽·앞 가운데는 열림 — 미나미 v4 하카마처럼 부위마다 나눔)으로
//     무릎 바로 위까지. 트인 자리 가장자리에 어두운 포도주색 안단. 위팔 꼭대기에 둥근 어깨 둘레(brahones)
//   · 다리 없는 끈 안경(안경다리는 1720~30 년대에야 생긴다): 둥근 뿔빛 테 둘 + 코 위 다리, 테 바깥에서 검은 비단 끈이 귀 위로 둘러 뒤통수로
//   · 겉옷 위 허리띠 왼쪽(빈손 쪽)에 쇠 열쇠 꾸러미, 그 뒤에 뿔 잉크통(놋 뚜껑)과 가죽 펜 통 · 오른 소맷부리에 잉크 얼룩 하나
//  몸·질량·관절·충돌체·무기는 그대로(겉모습만). 겉옷 판은 단단한 조각이라 부위를 따라 움직일 뿐 늘어지지 않는다.
const ROPA = 0x1c191b; // 따뜻한 먹색 겉옷
const ROPA_FACING = 0x4a2230; // 트인 자리 안단 · 어깨 둘레 테 (어두운 포도주)
const SPECS_HORN = 0x2b2420; // 안경테 (어두운 뿔)
const SPECS_CORD = 0x151314; // 검은 비단 끈
const KEY_IRON = 0x5d5a55;
const INK_HORN = 0x6b5a45;
const PEN_LEATHER = 0x3b2a22;
const KEY_IRON_OPTS = { metalness: 0.55, roughness: 0.5, steel: 0.5 };
/** 둥근 네모(초타원 |x/rx|^n + |z/rz|^n = 1) 위에서 방향 a(0 = 앞, π/2 = +z)의 점까지 거리 — 각을 고르게 나누면 평평한 면에도 꼭짓점이 고르게 간다 */
const seRadius = (a, rx, rz, n) => 1 / Math.pow(Math.pow(Math.abs(Math.cos(a)) / rx, n) + Math.pow(Math.abs(Math.sin(a)) / rz, n), 1 / n);
/**
 * 열린 천 띠: 고리(row)마다 각 a 를 range(row) = [a0, a1] 사이로 segs 칸 나누고 section(a, row) → [x, z] 를 잇는다.
 * 양 끝을 잇지 않아 앞이 트인 겉옷·한쪽만 덮는 다리 판을 만든다. 양면으로 칠한다. hem(y, a) 를 주면 고리 높이를 각마다 바꾼다(옷단 기울이기)
 */
function arcLoft(ys, segs, range, section, hem) {
  const vertices = [], uv = [], indices = [];
  ys.forEach((y, row) => {
    const [a0, a1] = range(row);
    for (let k = 0; k <= segs; k++) {
      const a = a0 + ((a1 - a0) * k) / segs;
      const [x, z] = section(a, row);
      vertices.push(x, hem ? hem(y, a) : y, z);
      uv.push(k / segs, row / (ys.length - 1));
    }
  });
  const w = segs + 1;
  for (let r = 0; r < ys.length - 1; r++) for (let k = 0; k < segs; k++) {
    const n = r * w + k;
    indices.push(n, n + w, n + 1, n + 1, n + w, n + w + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
const ROPA_N = 8; // 몸통 상자 모서리가 뚫고 나오지 않을 만큼 네모진 단면
/**
 * 몸통 한 부위의 겉옷 통 + 트인 자리 안단. rows = [[y, rx, rz, w, fold], ...] (w = 앞 트임 반폭, fold = 등 쪽 세로 주름 깊이 비율).
 * 아래 부위의 통은 위 부위 통 안으로 들어가 겹친다(기와처럼) — 허리를 굽혀도 틈이 덜 보이게
 */
function ropaTorso(g, rows, hem) {
  const ys = rows.map((r) => r[0]);
  const at = (a, row, k = 1) => {
    const [, rx, rz, , fold = 0] = rows[row];
    // 등(뒤 ±60° 안)에만 부드러운 세로 주름: 판판한 판이 아니라 늘어진 천으로 읽히게
    const r = seRadius(a, rx, rz, ROPA_N) * k * (1 + fold * smooth01(-0.35, -0.75, Math.cos(a)) * Math.sin(a * 11));
    return [Math.cos(a) * r, Math.sin(a) * r];
  };
  const open = (row, extra = 0) => Math.atan2(rows[row][3] + extra, rows[row][1]);
  addMerged(g, [arcLoft(ys, 56, (row) => [open(row), Math.PI * 2 - open(row)], at, hem)], ROPA, { ...CLOTH, side: THREE.DoubleSide });
  // 안단: 트인 가장자리에서 1.6 cm, 겉옷보다 살짝 바깥
  const facing = [];
  for (const s of [-1, 1]) {
    facing.push(arcLoft(ys, 2, (row) => (s > 0 ? [open(row), open(row, 0.016)] : [-open(row, 0.016), -open(row)]), (a, row) => at(a, row, 1.012), hem));
  }
  addMerged(g, facing, ROPA_FACING, { ...CLOTH, side: THREE.DoubleSide });
}
/** 허벅지 겉옷 판: 다리 바깥·뒤만 덮고(앞 가장자리 = 다리 축 바로 앞, 안쪽은 열림) 무릎 바로 위에서 끝난다. 아래로 조금 퍼지고 부드러운 주름 */
function ropaThigh(g, look, d) {
  const side = Math.sign(d?.pos?.[2] || 1); // 다리 바깥쪽(+z/−z)
  const ys = [0.2, 0.12, 0.03, -0.06, -0.13, -0.172];
  const u = (row) => row / (ys.length - 1);
  const section = (a, row, k = 1) => {
    const t = u(row);
    const fold = 1 + 0.05 * Math.sin(a * 5 + 0.6) * smooth01(0.1, 1, t);
    const rx = (0.086 + 0.03 * t) * fold * k, rz = (0.088 + 0.032 * t) * fold * k;
    return [Math.cos(a) * rx, side * (Math.sin(a) * rz + 0.008 * t)];
  };
  // 뒤쪽 끝(약 250°)은 다리 사이 가운데까지 와서 뒤에서 보면 두 판이 맞닿는다(반바지처럼 갈라져 보이지 않게)
  const shell = arcLoft(ys, 28, () => [-0.04, 4.38], section);
  hangingClothShading(addMerged(g, [shell], ROPA, { ...CLOTH, side: THREE.DoubleSide }).material);
  // 앞 가장자리 안단 (몸통 안단과 이어진다)
  addMerged(g, [arcLoft(ys, 2, () => [-0.04, 0.16], (a, row) => section(a, row, 1.012))], ROPA_FACING, { ...CLOTH, side: THREE.DoubleSide });
}
/** 위팔: v1 소매 그대로 + 꼭대기에 둥근 어깨 둘레(겉옷 진동에 단 brahones) */
function ropaUpperArm(g) {
  sleeveVolume(g, 1.12, 1.03);
  addMerged(g, [
    bake(new THREE.TorusGeometry(0.053, 0.017, 6, 18), [0, 0.09, 0], [Math.PI / 2, 0, 0]),
    bake(new THREE.TorusGeometry(0.06, 0.012, 5, 18), [0, 0.068, 0], [Math.PI / 2, 0, 0]),
  ], ROPA, CLOTH);
}
/** 머리: v1 얼굴·은발·수염 + 끈 안경 */
function librarianHead(g, look) {
  TOME_RAPIER.head(g, look);
  const RY = 0.01, RZ = 0.036, RX = 0.104, R = 0.019;
  if(look.alter==='tome'){
    const frame=addMerged(g,[
      bake(new THREE.TorusGeometry(.022,.0031,6,24),[RX+.005,RY,-RZ],[0,Math.PI/2,0]),
      ball(.004,6,4,[RX+.005,RY-.015,-RZ-.016]),
      taperedTube([[RX+.005,RY-.015,-RZ-.016],[.11,-.05,-.081],[.05,-.12,-.108],[-.01,-.16,-.102]], [.0016,.0016,.0016,.0016],18,4),
    ],0xc3a66b,{roughness:.43,metalness:.5,steel:.45});
    frame.name='alter-monocle';
    return;
  }

  // 둥근 테 둘(눈을 감싸고 눈썹 아래에서 멈춘다) + 코 위를 넘는 다리 + 끈을 맨 작은 귀
  addMerged(g, [
    ...[-1, 1].map((s) => bake(new THREE.TorusGeometry(R, 0.0034, 6, 22), [RX, RY, s * RZ], [0, Math.PI / 2, 0])),
    taperedTube([[RX, RY + 0.004, -(RZ - R)], [RX + 0.007, RY + 0.01, 0], [RX, RY + 0.004, RZ - R]], [0.003, 0.0032, 0.003], 8, 4),
    ...[-1, 1].map((s) => ball(0.0042, 6, 4, [RX - 0.002, RY + 0.002, s * (RZ + R + 0.002)])),
  ], SPECS_HORN, { roughness: 0.45, metalness: 0.1 });
  // 검은 비단 끈: 테 바깥에서 관자놀이를 지나 귀 위로 둘러 뒤통수에서 만난다 (머리카락 겉에서 2~4 mm)
  addMerged(g, [-1, 1].map((s) => taperedTube([
    [RX - 0.003, RY + 0.002, s * (RZ + R + 0.003)], [0.085, 0.02, s * 0.081], [0.05, 0.028, s * 0.101], [0.0, 0.031, s * 0.108],
    [-0.05, 0.026, s * 0.105], [-0.09, 0.014, s * 0.079], [-0.116, 0.006, s * 0.031], [-0.119, 0.005, 0],
  ], [0.0021, 0.0021, 0.0021, 0.0021, 0.0021, 0.0021, 0.0021, 0.0021], 26, 4)), SPECS_CORD, CLOTH);
  // 알은 넣지 않는다: 옅은 투명 원판은 대결 거리에서 보이지 않고 그리기 수만 는다 (테만)
}
/** 배: v1 더블릿 겉면·앞 솔기 + 겉옷 + 겉옷 위 허리띠(놋 고리) + 왼쪽 허리 열쇠 꾸러미 · 잉크통 · 펜 통 */
function librarianAbdomen(g,look={}) {
  clothBase(g, TOME_WINE);
  addMerged(g, [box(0.005, 0.09, 0.006, [0.114, 0.031, -0.062]), box(0.005, 0.09, 0.006, [0.114, 0.031, 0.062])], TOME_SEAM, CLOTH);
  ropaTorso(g, [[0.095, 0.124, 0.182, 0.078, 0.02], [0.0, 0.125, 0.184, 0.08, 0.022], [-0.09, 0.126, 0.186, 0.082, 0.025]]);
  // 허리띠: 겉옷 바깥을 두르고 트인 앞을 가로지른다
  const belt = clothLoft([-0.026, -0.06], 48, (a) => { const r = seRadius(a, 0.131, 0.19, ROPA_N); return [Math.cos(a) * r, Math.sin(a) * r]; });
  const L = -1; // 왼쪽(빈손 쪽) = −z
  // 열쇠 꾸러미: 띠 아래 고리 하나에 큰 쇠 열쇠 셋이 부채처럼 늘어진다 (손잡이 고리 · 자루 · 이빨)
  const gold=look.alter==='tome';
  const ring = gold?[.145,-.071,L*.19]:[0.085, -0.071, L * 0.2];
  const iron = [bake(new THREE.TorusGeometry(0.016, 0.0032, 5, 16), ring,gold?[0,Math.PI/2,0]:undefined)];
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1);
  (gold?[-.28,.28]:[-0.32,0.02,0.36]).forEach((ang, i) => {
    const len = gold?[.105,.12][i]:[0.085, 0.1, 0.09][i];
    const key = [
      bake(new THREE.TorusGeometry(0.012, 0.0036, 5, 12), [0, -0.014, 0]),
      cyl(0.0043, 0.0043, len, 6, false, [0, -0.026 - len / 2, 0]),
      box(0.016, 0.019, 0.005, [0.009, -0.021 - len, 0]),
      box(0.008, 0.007, 0.0055, [0.007, -0.011 - len, 0]),
    ];
    Q.setFromEuler(new THREE.Euler(0,gold?Math.PI/2:0,ang,'YXZ'));
    P.set(ring[0]+(gold?i*.004:0), ring[1] - 0.013, ring[2] + L * 0.005 * (i - 1));
    M.compose(P, Q, S);
    for (const k of key) iron.push(k.applyMatrix4(M));
  });
  const keys=addMerged(g,iron,gold?0xd1a447:KEY_IRON,gold?{roughness:.42,metalness:.55,steel:.65}:KEY_IRON_OPTS);
  if(gold){keys.name='alter-two-gold-keys';keys.userData.keyCount=2}
  // 잉크통(뿔) + 펜 통(가죽): 열쇠 뒤, 띠에서 짧은 끈으로
  const horn = [-0.064, -0.112, L * 0.205];
  addMerged(g, [cyl(0.0105, 0.0145, 0.05, 10, false, horn, [0, 0, -0.12])], INK_HORN, { roughness: 0.55, metalness: 0.05 });
  const pen = [-0.1, -0.118, L * 0.203];
  // 펜 통 · 매단 끈 · 허리띠는 같은 가죽 (한 메쉬)
  addMerged(g, [
    belt,
    cyl(0.0098, 0.0098, 0.115, 8, false, pen, [0, 0, 0.22]),
    cyl(0.011, 0.011, 0.018, 8, false, [pen[0] + 0.0115, pen[1] + 0.05, pen[2]], [0, 0, 0.22]),
    taperedTube([[-0.064, -0.058, L * 0.195], [-0.066, -0.075, L * 0.204], [-0.064, -0.084, L * 0.205]], [0.0022, 0.0022, 0.0022], 6, 4),
    taperedTube([[-0.092, -0.058, L * 0.195], [-0.089, -0.052, L * 0.2], [-0.087, -0.062, L * 0.203]], [0.0022, 0.0022, 0.0022], 6, 4),
  ], PEN_LEATHER, { ...CLOTH, side: THREE.DoubleSide });
  addMerged(g, [
    box(0.008, 0.03, 0.04, [0.133, -0.043, -0.028]),
    cyl(0.0155, 0.0155, 0.008, 10, false, [horn[0] + 0.003, horn[1] + 0.028, horn[2]], [0, 0, -0.12]),
  ], BRASS, BRASS_OPTS);
}
const TOME_LIBRARIAN = {
  ...TOME_RAPIER,
  chest(g, look) {
    TOME_RAPIER.chest(g, look);
    // 목 둘레는 깃이 보이게 좁게 여미고, 어깨 위로 비스듬히 내려와 가슴·등을 덮는다
    ropaTorso(g, [
      [0.163, 0.084, 0.102, 0.058],
      [0.152, 0.116, 0.162, 0.074],
      [0.13, 0.134, 0.2, 0.082],
      [0.0, 0.135, 0.201, 0.082, 0.012],
      [-0.16, 0.136, 0.203, 0.08, 0.025],
    ]);
  },
  abdomen: librarianAbdomen,
  pelvis(g, look) {
    TOME_RAPIER.pelvis(g, look);
    // 옷단: 앞은 −0.13(다리를 들어도 덜 걸리게), 옆·뒤로 갈수록 −0.19 까지 내려와 더블릿 자락 뒤판을 덮는다
    ropaTorso(g, [[0.1, 0.12, 0.18, 0.082, 0.02], [0.0, 0.126, 0.19, 0.088, 0.03], [-0.1, 0.133, 0.2, 0.093, 0.04], [-0.13, 0.136, 0.205, 0.095, 0.045]],
      (y, a) => (y < -0.11 ? y - 0.06 * (0.5 - 0.5 * Math.cos(a)) : y));
  },
  head: librarianHead,
  uarmS: ropaUpperArm,
  uarmO: ropaUpperArm,
  farmS(g) {
    tomeCuff(g);
    // 오른 소맷부리 바깥에 잉크 얼룩 하나
    addMerged(g, [bake(new THREE.SphereGeometry(0.0075, 8, 5), [0.006, -0.099, 0.0535], [0.3, 0, 0], [1.5, 1, 0.28])], 0x1b1a26, CLOTH);
  },
  thighF: ropaThigh,
  thighB: ropaThigh,
};

// ───────────────────────────────────────────── 샛별 저장소에서 가져온 인물 넷의 복식 (10/10, 기준 5a4e96c) ─────────────────────────────────────────────
//  아르토리아(artoria_silver_v2 — 6e71ba2 처음 · 5277832 다듬기) · 사미라 미르자(crown_rose_uniform — 59680c9 푸른 제복 · b8b1344 장밋빛) ·
//  김씨(renji_wanderer — outfit_renji.js, 27888f2·4c5ce4d·dcad882) · 에이라 린드(eira_winter_priest — outfit_eira.js, 27888f2).
//  모두 강체 부위에 붙는 장식뿐이다(몸·질량·관절·손·충돌체·상처 면 그대로). 바이트 그대로 옮기고 아래 두 가지만 우리 쪽에 맞췄다:
//   · 납작한 머리 다발 isoldeLock — 샛별 쪽 이졸데 v3(우리는 안 가져옴) 칸에 있던 도우미라 여기에 따로 둔다(이름은 그쪽과 같게)
//   · 쓰지 않는 옛 판(왕관 기사 v1·v2·푸른 제복 등록, 아르토리아 v1 등록)은 등록하지 않는다 — 아르토리아 v1·푸른 제복 정의는 v2·장밋빛이 물려 써서 둔다
//  표면 다듬기 polishOutfit(아래, fighter.js 가 판금 경계를 잡은 뒤 부른다)은 look.stockEyes·tailoring 표시가 있는 인물만 건드린다 — 기존 인물은 표시가 없어 그대로.
function isoldeLock(points, widths, depth = 0.007) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const rings = 14, sides = 8, vertices = [], indices = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, at = curve.getPoint(t), u = t * (widths.length - 1);
    const j = Math.min(widths.length - 2, Math.floor(u));
    const width = THREE.MathUtils.lerp(widths[j], widths[j + 1], u - j);
    const thickness = depth * Math.min(1, width / 0.012);
    for (let k = 0; k < sides; k++) {
      const a = k / sides * Math.PI * 2;
      vertices.push(at.x + Math.cos(a) * thickness, at.y, at.z + Math.sin(a) * width / 2);
      if (i < rings) {
        const n = i * sides + k, next = i * sides + (k + 1) % sides;
        indices.push(n, next, n + sides, next, next + sides, n + sides);
      }
    }
  }
  for (let k = 1; k < sides - 1; k++) {
    indices.push(0, k + 1, k);
    const end = rings * sides;
    indices.push(end, end + k, end + k + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(vertices.length / 3 * 2), 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Artoria uses the native adult body and hands. Cloth is attached beneath the
// representative part mesh so the existing armor-wear list contains metal only.
const ARTORIA_SILVER = 0xc5d2da;
const ARTORIA_EDGE = 0x829aa8;
const ARTORIA_TEAL = 0x28797b;
const ARTORIA_INK = 0x19242c;
const ARTORIA_GOLD = 0xbba475;
const ARTORIA_METAL = { metalness: 0.68, roughness: 0.32, steel: 0.9 };
function artoriaCloth(g, name = 'artoria-cloth') {
  const holder = g.children[0];
  let layer = holder.children.find((o) => o.name === name);
  if (!layer) { layer = new THREE.Group(); layer.name = name; holder.add(layer); }
  return layer;
}
function artoriaPanel(x, yz, ridge = 0) {
  const geo = clothPanel(x, yz, 0.012);
  const p = geo.attributes.position;
  const w = Math.max(...yz.map((v) => Math.abs(v[1])));
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + ridge * Math.max(0, 1 - Math.abs(p.getZ(i)) / w));
  geo.computeVertexNormals();
  return geo;
}
function artoriaRobe(g, lower = false) {
  const layer = artoriaCloth(g), h = lower ? 0.38 : 0.46;
  const top = lower ? 0.134 : 0.106, bottom = lower ? 0.15 : 0.14;
  const start = 2.12, sweep = Math.PI * 2 - 1.08;
  // Open toward +X. Two independently attached skirt halves expose the greaves
  // and preserve knee articulation instead of hiding both legs in one rigid cone.
  const skirt = new THREE.CylinderGeometry(top, bottom, h, 20, 4, true, start, sweep);
  skirt.scale(0.91, 1, 1);
  addMerged(layer, [skirt], ARTORIA_INK, { ...CLOTH, side: THREE.DoubleSide });
  const lining = new THREE.CylinderGeometry(top * 0.976, bottom * 0.976, h * 0.99, 20, 2, true, start, sweep);
  lining.scale(0.91, 1, 1);
  addMerged(layer, [lining], ARTORIA_TEAL, { ...CLOTH, side: THREE.DoubleSide });
  const seams = [], bands = [];
  for (const a of [start, start + sweep]) {
    const p = [[Math.sin(a) * top * 0.91, h / 2, Math.cos(a) * top],
      [Math.sin(a) * (top + bottom) * 0.455, 0, Math.cos(a) * (top + bottom) / 2],
      [Math.sin(a) * bottom * 0.91, -h / 2, Math.cos(a) * bottom]];
    seams.push(taperedTube(p, [0.0027, 0.0027, 0.0027], 7, 4));
    const inward = a === start ? 0.08 : -0.08;
    bands.push(bake(new THREE.CylinderGeometry(top * 1.01, bottom * 1.01, h, 8, 1, true, a + inward, inward > 0 ? 0.16 : -0.16), null, null, [0.91, 1, 1]));
  }
  addMerged(layer, seams, ARTORIA_GOLD, CLOTH);
  addMerged(layer, bands, 0x3b8684, { ...CLOTH, side: THREE.DoubleSide });
}
function artoriaShoulder(g, large) {
  const r = large ? 0.106 : 0.085, plates = [];
  for (let i = 0; i < 3; i++) plates.push(bake(new THREE.SphereGeometry(r - i * 0.009, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.65), [0, 0.074 - i * 0.048, 0], null, [1.13, 0.71, large ? 1.22 : 1.05]));
  addMerged(g, plates, ARTORIA_SILVER, ARTORIA_METAL);
  addMerged(g, [cyl(r * 0.98, r * 1.03, 0.012, 10, true, [0, 0.015, 0])], ARTORIA_EDGE, ARTORIA_METAL);
  addMerged(g, [cyl(r * 1.02, r * 1.025, 0.005, 10, true, [0, 0.023, 0])], ARTORIA_GOLD, ARTORIA_METAL);
  addMerged(g, [cyl(0.053, 0.05, 0.155, 10, false, [0, -0.035, 0])], ARTORIA_SILVER, ARTORIA_METAL);
}
function artoriaForearm(g) {
  addMerged(g, [cyl(0.056, 0.047, 0.205, 10, false, [0, 0.005, 0]),
    cyl(0.061, 0.049, 0.049, 10, true, [0, -0.089, 0])], ARTORIA_SILVER, ARTORIA_METAL);
  addMerged(g, [artoriaPanel(0.05, [[0.091, -0.027], [0.117, 0], [0.091, 0.027], [-0.08, 0.032], [-0.1, 0], [-0.08, -0.032]], 0.016)], 0xdce3e5, ARTORIA_METAL);
  addMerged(g, [cyl(0.0615, 0.0605, 0.008, 10, true, [0, -0.07, 0])], ARTORIA_EDGE, ARTORIA_METAL);
}
function artoriaShin(g) {
  artoriaRobe(g, true);
  addMerged(g, [cyl(0.06, 0.052, 0.29, 10, false, [0, 0, 0])], ARTORIA_SILVER, ARTORIA_METAL);
  addMerged(g, [artoriaPanel(0.056, [[0.205, 0], [0.16, 0.052], [0.09, 0.051], [-0.165, 0.031], [-0.196, 0], [-0.165, -0.031], [0.09, -0.051], [0.16, -0.052]], 0.025)], 0xd8e1e4, ARTORIA_METAL);
  addMerged(g, [cyl(0.062, 0.061, 0.012, 10, true, [0, 0.115, 0])], ARTORIA_EDGE, ARTORIA_METAL);
}
function artoriaFoot(g) {
  addMerged(g, [box(0.265, 0.067, 0.12, [0.009, 0.009, 0])], ARTORIA_SILVER, ARTORIA_METAL);
  addMerged(g, [-0.062, -0.011, 0.042, 0.092].map((x) => box(0.012, 0.006, 0.123, [x, 0.046, 0])), ARTORIA_EDGE, ARTORIA_METAL);
}
const ARTORIA_OUTFIT = {
  armorParts: new Set(['chest', 'abdomen', 'pelvis', 'uarmS', 'uarmO', 'farmS', 'farmO', 'shinF', 'shinB', 'footF', 'footB']),
  head(g, look) {
    quietFace(g, look, 'artoria');
    const hair = [];
    for (const s of [-1, 1]) {
      hair.push(isoldeLock([[0.015, 0.085, s * 0.055], [0.087, 0.071, s * 0.06], [0.106, 0.025, s * 0.082], [0.081, -0.023, s * 0.09]], [0.052, 0.052, 0.035, 0.002], 0.015));
      hair.push(isoldeLock([[0.006, 0.067, s * 0.09], [0.028, -0.01, s * 0.112], [0.07, -0.14, s * 0.131], [0.12, -0.224, s * 0.145]], [0.036, 0.043, 0.04, 0.022], 0.014));
    }
    hair.push(isoldeLock([[0.002, 0.099, -0.01], [0.084, 0.074, -0.012], [0.104, 0.037, 0.009]], [0.045, 0.034, 0.003], 0.012));
    hair.push(bake(new THREE.SphereGeometry(0.055, 10, 7), [-0.11, -0.002, 0], null, [0.7, 1.1, 1]));
    for (let i = -1; i <= 1; i++) hair.push(isoldeLock([[-0.121, -0.016, i * 0.024], [-0.14, -0.095, i * 0.031], [-0.131, -0.216, i * 0.037]], [0.038, 0.043, 0.004], 0.012));
    const hairMesh = addMerged(g, hair, look.hair, { ...CLOTH, roughness: 0.84 }); hairMesh.name = 'artoria-hair';
    addMerged(g, [box(0.02, 0.016, 0.09, [-0.126, -0.026, 0])], ARTORIA_TEAL, CLOTH);
    if (look.eyeColor == null) {
      // Retain the old layered eyes only in the archived appearances.
      addMerged(g, [-1, 1].map((s) => box(0.007, 0.016, 0.025, [0.101, 0.012, s * 0.035])), 0x418f87, CLOTH);
      addMerged(g, [-1, 1].map((s) => box(0.006, 0.013, 0.008, [0.107, 0.012, s * 0.035])), 0x162d30, CLOTH);
      addMerged(g, [-1, 1].map((s) => box(0.003, 0.004, 0.004, [0.111, 0.016, s * 0.033])), 0xeaf3e9, CLOTH);
    }
  },
  chest(g, look) {
    const fabric = artoriaCloth(g); clothNeck(fabric, look);
    const cape = addMerged(fabric, [clothPanel(-0.153, [[0.151, -0.1], [0.167, -0.234], [0.075, -0.31], [-0.192, -0.285], [-0.184, -0.063]])], ARTORIA_TEAL, { ...CLOTH, side: THREE.DoubleSide }); cape.name = 'artoria-cape';
    addMerged(fabric, [clothPanel(-0.158, [[0.135, -0.225], [0.125, -0.237], [-0.19, -0.271], [-0.185, -0.259]])], ARTORIA_GOLD, CLOTH);
    const hairLayer = artoriaCloth(g, 'artoria-hair');
    addMerged(hairLayer, [-1, 1].map((s) => isoldeLock([[0.13, 0.15, s * 0.145], [0.175, 0.06, s * 0.15], [0.164, -0.067, s * 0.17]], [0.03, 0.032, 0.002], 0.012)), look.hair, CLOTH);
    addMerged(g, [box(0.025, 0.235, 0.374, [-0.121, 0.006, 0]), ...[-1, 1].map((s) => box(0.255, 0.224, 0.024, [0, 0, s * 0.187]))], ARTORIA_EDGE, ARTORIA_METAL);
    addMerged(g, [artoriaPanel(0.137, [[0.146, -0.17], [0.17, -0.072], [0.126, 0], [0.17, 0.072], [0.146, 0.17], [-0.079, 0.151], [-0.153, 0], [-0.079, -0.151]], 0.038)], ARTORIA_SILVER, ARTORIA_METAL);
    addMerged(g, [artoriaPanel(0.159, [[0.091, -0.139], [0.112, 0], [0.091, 0.139], [0.014, 0.128], [-0.071, 0], [0.014, -0.128]], 0.03)], 0xe0e7e9, ARTORIA_METAL);
    addMerged(g, [artoriaPanel(0.192, [[0.079, 0], [0.04, 0.017], [0.015, 0], [0.04, -0.017]], 0.005)], ARTORIA_TEAL, ARTORIA_METAL);
    addMerged(g, [cyl(0.065, 0.08, 0.034, 10, true, [0, 0.164, 0])], ARTORIA_SILVER, ARTORIA_METAL);
  },
  abdomen(g) {
    const fabric = artoriaCloth(g);
    addMerged(fabric, [clothPanel(-0.136, [[0.094, -0.064], [0.095, -0.281], [-0.124, -0.257], [-0.1, -0.05]])], ARTORIA_TEAL, CLOTH);
    for (let i = 0; i < 3; i++) addMerged(g, [artoriaPanel(0.123 + i * 0.005, [[0.096 - i * 0.051, -0.16], [0.096 - i * 0.051, 0.16], [0.036 - i * 0.051, 0.163], [0.021 - i * 0.051, 0], [0.036 - i * 0.051, -0.163]], 0.02)], i % 2 ? ARTORIA_EDGE : ARTORIA_SILVER, ARTORIA_METAL);
  },
  pelvis(g) {
    const fabric = artoriaCloth(g);
    addMerged(fabric, [clothPanel(-0.131, [[0.088, -0.051], [0.092, -0.255], [-0.19, -0.228], [-0.169, -0.075]])], ARTORIA_TEAL, CLOTH);
    addMerged(g, [-1, 1].map((s) => artoriaPanel(0.12, [[0.072, s * 0.036], [0.088, s * 0.159], [-0.051, s * 0.203], [-0.134, s * 0.153], [-0.096, s * 0.063]], 0.015)), ARTORIA_SILVER, ARTORIA_METAL);
    addMerged(g, [box(0.25, 0.022, 0.34, [0, 0.06, 0])], ARTORIA_GOLD, ARTORIA_METAL);
  },
  uarmS(g) { artoriaShoulder(g, false); },
  uarmO(g) { artoriaShoulder(g, true); },
  farmS: artoriaForearm, farmO: artoriaForearm,
  thighF(g) { artoriaRobe(g); }, thighB(g) { artoriaRobe(g); },
  shinF: artoriaShin, shinB: artoriaShin,
  footF: artoriaFoot, footB: artoriaFoot,
};

// 아르토리아 전용 보완. 물리 부위와 손은 유지하고, 옷의 외곽만 다듬는다.
function artoriaRoundedBox(w, h, d, radius, taper = 1) {
  const geo = new THREE.BoxGeometry(w, h, d, 4, 4, 4), p = geo.attributes.position;
  const core = new THREE.Vector3(w / 2 - radius, h / 2 - radius, d / 2 - radius);
  const v = new THREE.Vector3(), near = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    near.set(THREE.MathUtils.clamp(v.x, -core.x, core.x), THREE.MathUtils.clamp(v.y, -core.y, core.y), THREE.MathUtils.clamp(v.z, -core.z, core.z));
    v.sub(near).normalize().multiplyScalar(radius).add(near);
    const scale = THREE.MathUtils.lerp(taper, 1, (v.y + h / 2) / h);
    p.setXYZ(i, v.x * scale, v.y, v.z * scale);
  }
  geo.computeVertexNormals();
  return geo;
}
function artoriaSoftBase(g, radius = 0.018, taper = 1) {
  const main = g.children[0], { width, height, depth } = main.geometry.parameters;
  if (width && height && depth) {
    const geo = artoriaRoundedBox(width, height, depth, radius, taper);
    main.geometry.dispose(); main.geometry = geo;
  }
  // 기존 갑옷 수집 인덱스를 지키기 위해 기본 장식은 삭제하지 않고 숨긴다.
  for (const extra of g.children.slice(1)) extra.visible = false;
}
function artoriaCapeV2(g) {
  const layer = artoriaCloth(g);
  const rows = 8, columns = 18, vertices = [], uv = [], indices = [];
  const at = (t, u) => [-0.15 - 0.075 * t - 0.035 * (1 - u * u)
    + Math.sin((u + 0.1) * Math.PI * 3) * (0.008 + t * 0.02),
    0.151 - t * 0.795 - 0.025 * (1 - u * u) * t,
    -0.117 + u * (0.147 + t * 0.066)];
  for (let r = 0; r <= rows; r++) for (let c = 0; c <= columns; c++) {
    vertices.push(...at(r / rows, c / columns * 2 - 1)); uv.push(c / columns, r / rows);
    if (r < rows && c < columns) {
      const i = r * (columns + 1) + c;
      indices.push(i, i + columns + 1, i + 1, i + 1, i + columns + 1, i + columns + 2);
    }
  }
  const cape = new THREE.BufferGeometry();
  cape.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  cape.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  cape.setIndex(indices); cape.computeVertexNormals();
  addMerged(layer, [cape], ARTORIA_TEAL, { ...CLOTH, side: THREE.DoubleSide }).name = 'artoria-cape';
  const borders = [-1, 1].map((u) => taperedTube([0, 0.33, 0.67, 1].map((t) => at(t, u)), [0.0022, 0.0022, 0.0022, 0.0022], 12, 4));
  borders.push(taperedTube([-1, -0.66, -0.33, 0, 0.33, 0.66, 1].map((u) => at(1, u)), Array(7).fill(0.0022), 24, 4));
  addMerged(layer, borders, ARTORIA_GOLD, CLOTH);
}
function artoriaSkirtV2(g, side) {
  const layer = artoriaCloth(g), rings = 8, arcs = 16, vertices = [], uv = [], indices = [];
  // 허벅지에 붙은 좌우 자락은 무릎에서 끊기지 않고 아래로 넓어진다.
  // 정면 중앙을 비워 은빛 정강이와 발의 위치가 경기 거리에서도 읽히게 한다.
  const at = (t, a) => {
    const fold = 1 + 0.035 * Math.cos(a * 6), spread = Math.pow(t, 0.8);
    return [Math.cos(a) * (0.103 + spread * 0.103) * fold - t * 0.02,
      0.205 - t * 0.755 + Math.sin(a) * t * 0.015,
      side * Math.sin(a) * (0.092 + spread * 0.115) * fold];
  };
  for (let y = 0; y <= rings; y++) for (let a = 0; a <= arcs; a++) {
    vertices.push(...at(y / rings, a / arcs * Math.PI)); uv.push(a / arcs, y / rings);
    if (y < rings && a < arcs) {
      const i = y * (arcs + 1) + a;
      indices.push(i, i + 1, i + arcs + 1, i + 1, i + arcs + 2, i + arcs + 1);
    }
  }
  const shell = new THREE.BufferGeometry();
  shell.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  shell.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  shell.setIndex(side > 0 ? indices : indices.toReversed()); shell.computeVertexNormals();
  addMerged(layer, [shell], ARTORIA_INK, { ...CLOTH, side: THREE.DoubleSide });
  const strips = [], hems = [];
  for (const a of [0.025, Math.PI - 0.025]) {
    const points = [0, 0.35, 0.7, 1].map((t) => at(t, a));
    strips.push(isoldeLock(points, [0.022, 0.03, 0.04, 0.04], 0.004));
    hems.push(taperedTube(points.map((p) => [p[0] + 0.004, p[1], p[2] + side * 0.017]), [0.0022, 0.0022, 0.0022, 0.0022], 10, 4));
  }
  addMerged(layer, strips, ARTORIA_TEAL, CLOTH);
  addMerged(layer, hems, ARTORIA_GOLD, CLOTH);
}
function artoriaShoulderV2(g, large) {
  const r = large ? 0.107 : 0.087;
  const plates = [0, 1, 2].map((i) => bake(new THREE.SphereGeometry(r - i * 0.014, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.66), [0, 0.075 - i * 0.04, 0], null, [1.08, 0.77, large ? 1.2 : 1.04]));
  plates.push(cyl(0.055, 0.045, 0.153, 12, false, [0, -0.034, 0]));
  addMerged(g, plates, ARTORIA_SILVER, ARTORIA_METAL);
  addMerged(g, [cyl(r * 0.91, r * 0.96, 0.006, 12, true, [0, 0.023, 0])], ARTORIA_GOLD, ARTORIA_METAL);
}
function artoriaForearmV2(g) {
  addMerged(g, [cyl(0.055, 0.045, 0.207, 12, false, [0, 0.005, 0]),
    bake(new THREE.SphereGeometry(0.052, 12, 8), [0.005, 0.009, 0], null, [1.04, 1.95, 0.93]),
    cyl(0.049, 0.045, 0.026, 12, true, [0, -0.09, 0])], 0xd8e1e4, ARTORIA_METAL);
  addMerged(g, [cyl(0.0495, 0.0485, 0.006, 12, true, [0, -0.08, 0])], ARTORIA_EDGE, ARTORIA_METAL);
}
function artoriaShinV2(g) {
  addMerged(g, [cyl(0.063, 0.0555, 0.356, 12, false, [0, 0, 0]),
    bake(new THREE.SphereGeometry(0.0555, 12, 8), [0, -0.158, 0], null, [1, 0.92, 1]),
    bake(new THREE.SphereGeometry(0.057, 12, 8), [0.024, 0.132, 0], null, [0.9, 1.17, 1.08]),
    artoriaPanel(0.059, [[0.174, 0], [0.119, 0.042], [-0.16, 0.027], [-0.186, 0], [-0.16, -0.027], [0.119, -0.042]], 0.012)], 0xd8e1e4, ARTORIA_METAL);
  addMerged(g, [cyl(0.059, 0.0585, 0.008, 12, true, [0, -0.1, 0])], ARTORIA_EDGE, ARTORIA_METAL);
}
function artoriaFootV2(g) {
  artoriaSoftBase(g, 0.018);
  const shell = artoriaRoundedBox(0.269, 0.067, 0.119, 0.025);
  const p = shell.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const toe = THREE.MathUtils.clamp((p.getX(i) + 0.02) / 0.15, 0, 1);
    p.setXYZ(i, p.getX(i), p.getY(i) * (1 - toe * 0.17), p.getZ(i) * (1 - toe * 0.22));
  }
  shell.computeVertexNormals();
  addMerged(g, [bake(shell, [0.01, 0.009, 0])], ARTORIA_SILVER, ARTORIA_METAL);
  addMerged(g, [0.0, 0.052, 0.098].map((x) => taperedTube([[x, 0.026, -0.043], [x, 0.042, 0], [x, 0.026, 0.043]], [0.0025, 0.0025, 0.0025], 6, 4)), ARTORIA_EDGE, ARTORIA_METAL);
}
const ARTORIA_OUTFIT_V2 = {
  armorParts: new Set(ARTORIA_OUTFIT.armorParts),
  head: ARTORIA_OUTFIT.head,
  chest(g, look) {
    artoriaSoftBase(g, 0.028, 0.96);
    const fabric = artoriaCloth(g); clothNeck(fabric, look); artoriaCapeV2(g);
    const hairLayer = artoriaCloth(g, 'artoria-hair');
    addMerged(hairLayer, [-1, 1].map((s) => isoldeLock([[0.13, 0.15, s * 0.145], [0.175, 0.06, s * 0.15], [0.164, -0.067, s * 0.17]], [0.03, 0.032, 0.002], 0.012)), look.hair, CLOTH);
    addMerged(g, [bake(artoriaRoundedBox(0.256, 0.249, 0.39, 0.043, 0.91), [-0.005, 0.008, 0]),
      artoriaPanel(0.13, [[0.129, -0.151], [0.157, -0.069], [0.128, 0], [0.157, 0.069], [0.129, 0.151], [-0.065, 0.137], [-0.144, 0], [-0.065, -0.137]], 0.039),
      cyl(0.065, 0.078, 0.028, 12, true, [0, 0.155, 0])], ARTORIA_SILVER, ARTORIA_METAL);
    addMerged(g, [artoriaPanel(0.165, [[0.08, -0.118], [0.099, 0], [0.08, 0.118], [0.014, 0.105], [-0.065, 0], [0.014, -0.105]], 0.027)], 0xe0e7e9, ARTORIA_METAL);
    addMerged(g, [artoriaPanel(0.192, [[0.074, 0], [0.038, 0.015], [0.016, 0], [0.038, -0.015]], 0.005)], ARTORIA_TEAL, ARTORIA_METAL);
  },
  abdomen(g) {
    artoriaSoftBase(g, 0.027, 0.93);
    addMerged(g, [0, 1, 2].map((i) => bake(artoriaRoundedBox(0.24, 0.063, 0.328 - i * 0.009, 0.02), [0, 0.068 - i * 0.058, 0])), ARTORIA_SILVER, ARTORIA_METAL);
  },
  pelvis(g) {
    artoriaSoftBase(g, 0.024);
    addMerged(g, [-1, 1].map((s) => artoriaPanel(0.123, [[0.071, s * 0.039], [0.079, s * 0.147], [-0.04, s * 0.185], [-0.129, s * 0.148], [-0.098, s * 0.067]], 0.012)), ARTORIA_SILVER, ARTORIA_METAL);
    addMerged(g, [bake(artoriaRoundedBox(0.254, 0.022, 0.338, 0.01), [0, 0.059, 0])], ARTORIA_GOLD, ARTORIA_METAL);
  },
  uarmS(g) { artoriaShoulderV2(g, false); }, uarmO(g) { artoriaShoulderV2(g, true); },
  farmS: artoriaForearmV2, farmO: artoriaForearmV2,
  thighF(g) { artoriaSkirtV2(g, 1); }, thighB(g) { artoriaSkirtV2(g, -1); },
  shinF: artoriaShinV2, shinB: artoriaShinV2,
  footF: artoriaFootV2, footB: artoriaFootV2,
};

// ── 아르토리아 v2 (외형 다듬기 2차 10/10, 사장님 '망토 다듬어'): v1(artoria_silver_v2) 위에서 망토와 앞자락만 바꾼다 — 판금·판금 판정 부위(armorParts)·머리 그대로.
//  망토: 등 뒤에 납작한 판으로 비스듬히 뻗던 것을 → 목둘레에서 시작해 어깨 뒤를 둥글게 감싸고(어깨 끝을 넘어 옆까지) 아래로 퍼지며 떨어지게. 굵은 주름 일곱.
//  앞자락: 다리마다 반 원통(앞 → 옆 → 뒤)이라 정면에서 두 장이 떨어진 띠로 보이던 것을 → 안쪽 앞뒤로 35° 씩 더 둘러 가운데서 겹치게(앞 가운데 좁은 트임 하나로 읽힘).
// folds(아르토리아 v3, 사장님 10/11 00:4x '바뀐 망토 좋은데 주름 넣어'): 같은 망토 꼴에 세로 주름을 또렷하게 — 주름 일곱 → 아홉, 깊이 3.5 % → 어깨 아래 2.5 % · 옷단 14.5 %,
//  골은 뾰족하게·마루는 둥글게(천이 접힌 꼴), 골마다 정점 색으로 그늘(마루 1.0 → 골 0.5). 세로 칸 28 → 72 로 늘려 굴곡이 각지지 않게.
function artoriaCapeV3(g, folds = false) {
  const layer = artoriaCloth(g);
  const rows = folds ? 16 : 12, columns = folds ? 72 : 28, vertices = [], uv = [], indices = [], colors = [];
  const foldWave = (u) => { const w = Math.cos(u * Math.PI * 4.5); return Math.sign(w) * Math.pow(Math.abs(w), w < 0 ? 0.55 : 1.6); }; // 골(−1) 뾰족, 마루(+1) 둥글
  const sm = (x) => { const u = THREE.MathUtils.clamp(x, 0, 1); return u * u * (3 - 2 * u); };
  // t: 0 목둘레 → 1 옷단, u: −1 ~ 1 (왼 앞 끝 → 등 가운데 → 오른 앞 끝)
  const at = (t, u) => {
    const wrap = sm(t / 0.16); // 위 16 % 에서 어깨를 넘어가며 넓어진다
    const rx = 0.085 + 0.075 * wrap + 0.07 * t, rz = 0.1 + 0.2 * wrap + 0.03 * t;
    const reach = Math.PI * (0.62 - 0.08 * wrap); // 등 가운데에서 양옆으로 감싸는 각
    const phi = Math.PI + u * reach;
    const fold = folds ? 1 + (0.025 + 0.12 * t) * sm((t - 0.06) / 0.2) * foldWave(u) + 0.015 * t : 1 + t * (0.035 * Math.cos(u * Math.PI * 3.5) + 0.01);
    const y = 0.165 - wrap * 0.04 - t * 0.76 - 0.03 * u * u * wrap + (1 - wrap) * 0.0;
    return [Math.cos(phi) * rx * fold - 0.02 * t, y, Math.sin(phi) * rz * fold];
  };
  const teal = new THREE.Color(ARTORIA_TEAL);
  for (let r = 0; r <= rows; r++) for (let c = 0; c <= columns; c++) {
    const t = r / rows, u = c / columns * 2 - 1;
    vertices.push(...at(t, u)); uv.push(c / columns, r / rows);
    const shade = folds ? 1 - 0.5 * sm((t - 0.06) / 0.2) * Math.max(0, -foldWave(u)) - 0.06 * sm((t - 0.06) / 0.2) * (1 - Math.abs(foldWave(u))) : 1;
    colors.push(teal.r * shade, teal.g * shade, teal.b * shade);
    if (r < rows && c < columns) {
      const i = r * (columns + 1) + c;
      indices.push(i, i + columns + 1, i + 1, i + 1, i + columns + 1, i + columns + 2);
    }
  }
  const cape = new THREE.BufferGeometry();
  cape.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  cape.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (folds) cape.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  cape.setIndex(indices); cape.computeVertexNormals();
  addMerged(layer, [cape], folds ? 0xffffff : ARTORIA_TEAL, { ...CLOTH, side: THREE.DoubleSide, ...(folds ? { vertexColors: true } : {}) }).name = 'artoria-cape';
  const borders = [-1, 1].map((u) => taperedTube([0, 0.1, 0.25, 0.5, 0.75, 1].map((t) => at(t, u)), Array(6).fill(0.0022), 24, 4));
  const hemN = folds ? 73 : 15;
  borders.push(taperedTube(Array.from({ length: hemN }, (_, i) => at(1, i / ((hemN - 1) / 2) - 1)), Array(hemN).fill(0.0022), folds ? 220 : 56, 4));
  // 목둘레 금빛 테 + 앞 여밈 고리 둘(어깨 앞 끝)
  borders.push(taperedTube(Array.from({ length: 9 }, (_, i) => at(0, i / 4 - 1)), Array(9).fill(0.003), 32, 4));
  addMerged(layer, borders, ARTORIA_GOLD, CLOTH);
}
function artoriaSkirtV3(g, side) {
  const layer = artoriaCloth(g), rings = 8, arcs = 22, vertices = [], uv = [], indices = [];
  const A0 = -0.6, A1 = Math.PI + 0.6; // 안쪽 앞·뒤로 0.6 rad 씩 더 둘러 반대쪽 자락과 겹친다
  const at = (t, a) => {
    const fold = 1 + 0.035 * Math.cos(a * 6), spread = Math.pow(t, 0.8);
    return [Math.cos(a) * (0.103 + spread * 0.103) * fold - t * 0.02,
      0.205 - t * 0.755 + Math.sin(a) * t * 0.015,
      side * Math.sin(a) * (0.092 + spread * 0.115) * fold];
  };
  for (let y = 0; y <= rings; y++) for (let k = 0; k <= arcs; k++) {
    vertices.push(...at(y / rings, A0 + (A1 - A0) * (k / arcs))); uv.push(k / arcs, y / rings);
    if (y < rings && k < arcs) {
      const i = y * (arcs + 1) + k;
      indices.push(i, i + 1, i + arcs + 1, i + 1, i + arcs + 2, i + arcs + 1);
    }
  }
  const shell = new THREE.BufferGeometry();
  shell.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  shell.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  shell.setIndex(side > 0 ? indices : indices.toReversed()); shell.computeVertexNormals();
  addMerged(layer, [shell], ARTORIA_INK, { ...CLOTH, side: THREE.DoubleSide });
  // 앞 가장자리에만 청록 단 + 금선 (뒤 가장자리는 반대 자락 밑으로 들어가 단을 뺌)
  const points = [0, 0.35, 0.7, 1].map((t) => at(t, A0 + 0.02));
  addMerged(layer, [isoldeLock(points, [0.018, 0.024, 0.03, 0.03], 0.004)], ARTORIA_TEAL, CLOTH);
  addMerged(layer, [taperedTube(points.map((p) => [p[0] + 0.004, p[1], p[2] - side * 0.014]), [0.0022, 0.0022, 0.0022, 0.0022], 10, 4)], ARTORIA_GOLD, CLOTH);
}
const ARTORIA_OUTFIT_V3 = {
  ...ARTORIA_OUTFIT_V2,
  armorParts: new Set(ARTORIA_OUTFIT_V2.armorParts),
  chest(g, look) {
    // ARTORIA_OUTFIT_V2.chest 와 같은 순서·같은 판금 메쉬 — 망토만 artoriaCapeV3 (망토는 대표 메쉬 밑 천 층이라 판금 목록에 안 든다)
    artoriaSoftBase(g, 0.028, 0.96);
    const fabric = artoriaCloth(g); clothNeck(fabric, look); artoriaCapeV3(g);
    const hairLayer = artoriaCloth(g, 'artoria-hair');
    addMerged(hairLayer, [-1, 1].map((s) => isoldeLock([[0.13, 0.15, s * 0.145], [0.175, 0.06, s * 0.15], [0.164, -0.067, s * 0.17]], [0.03, 0.032, 0.002], 0.012)), look.hair, CLOTH);
    addMerged(g, [bake(artoriaRoundedBox(0.256, 0.249, 0.39, 0.043, 0.91), [-0.005, 0.008, 0]),
      artoriaPanel(0.13, [[0.129, -0.151], [0.157, -0.069], [0.128, 0], [0.157, 0.069], [0.129, 0.151], [-0.065, 0.137], [-0.144, 0], [-0.065, -0.137]], 0.039),
      cyl(0.065, 0.078, 0.028, 12, true, [0, 0.155, 0])], ARTORIA_SILVER, ARTORIA_METAL);
    addMerged(g, [artoriaPanel(0.165, [[0.08, -0.118], [0.099, 0], [0.08, 0.118], [0.014, 0.105], [-0.065, 0], [0.014, -0.105]], 0.027)], 0xe0e7e9, ARTORIA_METAL);
    addMerged(g, [artoriaPanel(0.192, [[0.074, 0], [0.038, 0.015], [0.016, 0], [0.038, -0.015]], 0.005)], ARTORIA_TEAL, ARTORIA_METAL);
  },
  thighF(g) { artoriaSkirtV3(g, 1); }, thighB(g) { artoriaSkirtV3(g, -1); },
};
// 아르토리아 v3 (외형 3차 10/11): v2 세트 그대로 + 망토 세로 주름만 또렷하게 (artoriaCapeV3 folds)
//  가슴 장식 순서(천 층 → 망토 → 머리 다발 → 판금)는 v4 와 같아 artoriaChestWith 하나로 묶었다 — 판금 메쉬·순서 그대로(판금 판정 armorParts 그대로)
function artoriaChestWith(g, look, cape) {
  artoriaSoftBase(g, 0.028, 0.96);
  const fabric = artoriaCloth(g); clothNeck(fabric, look); cape(g);
  const hairLayer = artoriaCloth(g, 'artoria-hair');
  addMerged(hairLayer, [-1, 1].map((s) => isoldeLock([[0.13, 0.15, s * 0.145], [0.175, 0.06, s * 0.15], [0.164, -0.067, s * 0.17]], [0.03, 0.032, 0.002], 0.012)), look.hair, CLOTH);
  addMerged(g, [bake(artoriaRoundedBox(0.256, 0.249, 0.39, 0.043, 0.91), [-0.005, 0.008, 0]),
    artoriaPanel(0.13, [[0.129, -0.151], [0.157, -0.069], [0.128, 0], [0.157, 0.069], [0.129, 0.151], [-0.065, 0.137], [-0.144, 0], [-0.065, -0.137]], 0.039),
    cyl(0.065, 0.078, 0.028, 12, true, [0, 0.155, 0])], ARTORIA_SILVER, ARTORIA_METAL);
  addMerged(g, [artoriaPanel(0.165, [[0.08, -0.118], [0.099, 0], [0.08, 0.118], [0.014, 0.105], [-0.065, 0], [0.014, -0.105]], 0.027)], 0xe0e7e9, ARTORIA_METAL);
  addMerged(g, [artoriaPanel(0.192, [[0.074, 0], [0.038, 0.015], [0.016, 0], [0.038, -0.015]], 0.005)], ARTORIA_TEAL, ARTORIA_METAL);
}
const ARTORIA_OUTFIT_V4 = {
  ...ARTORIA_OUTFIT_V3,
  armorParts: new Set(ARTORIA_OUTFIT_V3.armorParts),
  chest(g, look) { artoriaChestWith(g, look, (h) => artoriaCapeV3(h, true)); },
};

// ── 아르토리아 v4 (외형 4차 10/13, 사장님 23:0x '아르토리아 망토 주름 좀 더 넣을 수 있어?'): v3 망토 꼴(목둘레 → 어깨를 감싸고 → 아래로 퍼짐) 그대로, 주름만 더 많이·더 또렷하게.
//  v3 은 cos 한 줄 물결(골 4 · 마루 5, 모두 같은 폭·깊이·길이)이라 고르게 반복되는 주름으로 읽혔다 → 골을 하나씩 적은 표(ARTORIA_CAPE_FOLDS)로:
//   · 큰 골 8 + 잔 골 4 = 12 (어깨 아래에서 시작하는 높이·폭·깊이가 골마다 다름 — 잔 골은 마루 한가운데에 허리 아래에서 늦게 생겨 짧다)
//   · 골은 뾰족(가우스 골), 마루는 둥글게(골 사이 바탕). 아래로 갈수록 골이 넓어지고(폭 × 0.75 → × 1.35) 깊어지며(가장 깊은 골: 옷단 반지름의 −20 % ~ 마루 +17 %), 등 가운데에서 바깥으로 조금씩 벌어진다
//   · 골 줄이 곧은 선이 아니라 골마다 다른 위상으로 살짝 굽는다
//   · 옷단: 골 자리는 1.4 cm 까지 말려 올라가고 마루는 처져 주름을 따라 물결친다 + 옷단 길이도 자리마다 ±1 cm
//   · 골 그늘 정점 색(골 바닥 0.45 · 마루 1.0)
//  세로 칸 72 → 128 · 가로 줄 16 → 22 (좁은 위쪽 골이 각지지 않게). 정점 1241 → 2967 · 삼각형 2304 → 5632 (옷단 금선 관 220 → 320 마디).
//  몸·충돌체·판금·판정 그대로 — 망토는 대표 메쉬 밑 천 층이라 판금 목록(armorParts)에 들지 않는다.
//  [u 자리(−1 왼 앞 끝 ~ 1 오른 앞 끝), 폭(u), 깊이 몫, 시작 t(0 목 → 1 옷단), 굽음 위상]
const ARTORIA_CAPE_FOLDS = [
  [-0.84, 0.044, 0.70, 0.18, 0.3],
  [-0.70, 0.024, 0.42, 0.50, 4.1], // 잔 골
  [-0.58, 0.054, 0.95, 0.09, 1.9],
  [-0.35, 0.046, 0.80, 0.14, 2.6],
  [-0.22, 0.022, 0.40, 0.55, 0.9], // 잔 골
  [-0.11, 0.058, 1.00, 0.07, 5.2],
  [0.10, 0.050, 0.88, 0.11, 3.4],
  [0.23, 0.024, 0.45, 0.47, 5.9], // 잔 골
  [0.35, 0.060, 1.00, 0.06, 1.2],
  [0.61, 0.048, 0.85, 0.12, 2.2],
  [0.73, 0.022, 0.40, 0.52, 0.4], // 잔 골
  [0.85, 0.042, 0.66, 0.22, 3.0],
];
function artoriaCapeV4(g) {
  const layer = artoriaCloth(g);
  const rows = 22, columns = 128, vertices = [], uv = [], indices = [], colors = [];
  const sm = (x) => { const u = THREE.MathUtils.clamp(x, 0, 1); return u * u * (3 - 2 * u); };
  // 골 깊이 합(0 마루 ~ 1 깊은 골 바닥) — 바깥 테두리·옷단이 같은 값을 따라가게 at 과 그늘이 같이 쓴다
  const valley = (t, u) => {
    let v = 0;
    for (const [u0, w0, d, t0, ph] of ARTORIA_CAPE_FOLDS) {
      const c = u0 * (1 + 0.09 * t) + 0.018 * Math.sin(3.1 * t + ph), w = w0 * (0.75 + 0.6 * t);
      v += d * sm((t - t0) / 0.28) * Math.exp(-(((u - c) / w) ** 2));
    }
    return Math.min(1, v);
  };
  const at = (t, u) => {
    const wrap = sm(t / 0.16); // v3 과 같은 꼴: 위 16 % 에서 어깨를 넘어가며 넓어진다
    const rx = 0.085 + 0.075 * wrap + 0.07 * t, rz = 0.1 + 0.2 * wrap + 0.03 * t;
    const reach = Math.PI * (0.62 - 0.08 * wrap);
    const phi = Math.PI + u * reach;
    const v = valley(t, u), depth = (0.025 + 0.36 * t) * sm((t - 0.05) / 0.2);
    const fold = 1 + depth * (0.45 - v) + 0.015 * t; // 골 사이 바탕(0.45)이 둥근 마루, 골은 안으로
    const hem = t * t * t * (0.014 * v - 0.005 + 0.01 * Math.sin(u * 5.3 + 1.1)); // 옷단: 골은 말려 올라가고 마루는 처짐 + 길이 들쭉날쭉
    const y = 0.165 - wrap * 0.04 - t * 0.76 - 0.03 * u * u * wrap + hem;
    return [Math.cos(phi) * rx * fold - 0.02 * t, y, Math.sin(phi) * rz * fold];
  };
  const teal = new THREE.Color(ARTORIA_TEAL);
  for (let r = 0; r <= rows; r++) for (let c = 0; c <= columns; c++) {
    const t = r / rows, u = c / columns * 2 - 1;
    vertices.push(...at(t, u)); uv.push(c / columns, r / rows);
    const shade = 1 - 0.55 * valley(t, u) * sm((t - 0.05) / 0.2);
    colors.push(teal.r * shade, teal.g * shade, teal.b * shade);
    if (r < rows && c < columns) {
      const i = r * (columns + 1) + c;
      indices.push(i, i + columns + 1, i + 1, i + 1, i + columns + 1, i + columns + 2);
    }
  }
  const cape = new THREE.BufferGeometry();
  cape.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  cape.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  cape.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  cape.setIndex(indices); cape.computeVertexNormals();
  addMerged(layer, [cape], 0xffffff, { ...CLOTH, side: THREE.DoubleSide, vertexColors: true }).name = 'artoria-cape';
  const edgeN = 12, hemN = columns + 1;
  const borders = [-1, 1].map((u) => taperedTube(Array.from({ length: edgeN }, (_, i) => at(i / (edgeN - 1), u)), Array(edgeN).fill(0.0022), 32, 4));
  borders.push(taperedTube(Array.from({ length: hemN }, (_, i) => at(1, i / ((hemN - 1) / 2) - 1)), Array(hemN).fill(0.0022), 320, 4));
  borders.push(taperedTube(Array.from({ length: 9 }, (_, i) => at(0, i / 4 - 1)), Array(9).fill(0.003), 32, 4));
  addMerged(layer, borders, ARTORIA_GOLD, CLOTH);
}
const ARTORIA_OUTFIT_V5 = {
  ...ARTORIA_OUTFIT_V4,
  armorParts: new Set(ARTORIA_OUTFIT_V4.armorParts),
  chest(g, look) { artoriaChestWith(g, look, artoriaCapeV4); },
};

// Blue uniform: tailoring, a pleated skirt and equipment give the clothing a
// silhouette of its own. No invisible crown/plate protection beneath this suit.
const UNIFORM_BLUE = 0x285f8e, UNIFORM_NAVY = 0x192d49, UNIFORM_LIGHT = 0xe4e6df;
function uniformTorso(g, taper = 1) {
  artoriaSoftBase(g, 0.05, taper);
  g.children[0].material.roughness = 0.9;
  g.children[0].material.metalness = 0;
}
function uniformLine(g, points, color, width = 0.0018) {
  return addMerged(g, [taperedTube(points, points.map(() => width), points.length * 5, 4)], color, CLOTH);
}
function uniformHair(g, look) {
  const layer = artoriaCloth(g, 'uniform-hair'), locks = [];
  // Parted fringe ends above the game's original small black eyes.
  for (let i = -3; i <= 3; i++) {
    const z = i * 0.023;
    locks.push(isoldeLock([[0.034, 0.103, z * 0.65], [0.087, 0.079, z], [0.104, 0.041, z * 1.03], [0.102, 0.023 + ((i + 3) % 3) * 0.004, z * 1.05 + 0.013]], [0.034, 0.035, 0.027, 0.003], 0.009));
  }
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) locks.push(isoldeLock([
      [0.003 - i * 0.035, 0.071, s * 0.094], [0.005 - i * 0.047, -0.01, s * 0.114],
      [0.016 - i * 0.039, -0.105, s * 0.119], [0.045 - i * 0.036, -0.157 + i * 0.018, s * 0.096],
    ], [0.032, 0.048, 0.038, 0.005], 0.01));
  }
  // A continuous nape, not separate long locks meeting across a moving neck.
  for (let i = -2; i <= 2; i++) locks.push(isoldeLock([
    [-0.07, 0.071, i * 0.036], [-0.111, -0.024, i * 0.043], [-0.103, -0.117, i * 0.043],
  ], [0.041, 0.05, 0.011], 0.012));
  addMerged(layer, locks, look.hair, { ...CLOTH, roughness: 0.87 });
  const braids = [];
  for (let strand = 0; strand < 3; strand++) {
    const pts = Array.from({ length: 25 }, (_, i) => {
      const t = i / 24, a = t * Math.PI * 7 + strand * Math.PI * 2 / 3;
      return [-0.025 + 0.012 * Math.cos(a), 0.029 - t * 0.294, -0.124 - t * 0.015 + 0.014 * Math.sin(a)];
    });
    braids.push(taperedTube(pts, pts.map((_, i) => 0.012 - i / 24 * 0.003), 48, 6));
  }
  addMerged(layer, braids, look.hair, CLOTH);
  addMerged(layer, [cyl(0.018, 0.017, 0.012, 10, false, [-0.025, -0.238, -0.137]),
    box(0.023, 0.012, 0.036, [-0.012, 0.034, -0.13], [0.2, 0, -0.15])], UNIFORM_NAVY, CLOTH);
  addMerged(layer, [ball(0.006, 8, 6, [0.004, 0.035, -0.13])], 0xbbad89, CLOTH);
}
function uniformSkirt(g) {
  // Each half follows its own thigh, so a lunge does not leave a rigid skirt
  // standing in front of the legs. Overlap at the centre hides the rest seam.
  const geo = new THREE.CylinderGeometry(0.087, 0.139, 0.266, 40, 5, true);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i)), t = (0.133 - p.getY(i)) / 0.266;
    const fold = 1 + (0.027 + t * 0.055) * Math.cos(a * 10);
    p.setXYZ(i, p.getX(i) * fold * 1.04, p.getY(i) + 0.045, p.getZ(i) * fold);
  }
  geo.computeVertexNormals();
  addMerged(g, [geo], UNIFORM_NAVY, { ...CLOTH, side: THREE.DoubleSide }).name = 'uniform-pleats';
  const hem = new THREE.CylinderGeometry(0.1385, 0.1395, 0.01, 40, 1, true), h = hem.attributes.position;
  for (let i = 0; i < h.count; i++) {
    const a = Math.atan2(h.getZ(i), h.getX(i)), fold = 1 + 0.082 * Math.cos(a * 10);
    h.setXYZ(i, h.getX(i) * fold * 1.04, h.getY(i) - 0.08, h.getZ(i) * fold);
  }
  hem.computeVertexNormals(); addMerged(g, [hem], 0x4b6989, { ...CLOTH, side: THREE.DoubleSide });
}
function uniformCuff(g) {
  sleeveVolume(g, 1.04, 1);
  addMerged(g, [cyl(0.048, 0.046, 0.052, 16, true, [0, -0.083, 0])], UNIFORM_NAVY, { ...CLOTH, side: THREE.DoubleSide });
  addMerged(g, [cyl(0.049, 0.049, 0.004, 16, true, [0, -0.058, 0]), cyl(0.047, 0.047, 0.004, 16, true, [0, -0.109, 0])], UNIFORM_LIGHT, CLOTH);
  addMerged(g, [-0.071, -0.091].map(y => ball(0.004, 8, 6, [0.05, y, 0])), 0xb9a67b, CLOTH);
}
function uniformBoot(g) {
  g.children[0].material.color.setHex(UNIFORM_LIGHT);
  addMerged(g, [cyl(0.054, 0.056, 0.071, 16, true, [0, 0.118, 0])], UNIFORM_NAVY, { ...CLOTH, side: THREE.DoubleSide });
  addMerged(g, [cyl(0.057, 0.057, 0.007, 16, true, [0, 0.084, 0])], 0x536375, CLOTH);
  addMerged(g, [cyl(0.053, 0.053, 0.015, 16, true, [0, 0.05, 0]), cyl(0.052, 0.052, 0.015, 16, true, [0, 0.008, 0])], 0xbec4c4, CLOTH);
  addMerged(g, [box(0.008, 0.02, 0.022, [0.055, 0.05, 0]), box(0.008, 0.02, 0.022, [0.054, 0.008, 0])], 0xc1b38b, { metalness: 0.25, roughness: 0.6 });
  uniformLine(g, [[0.048, 0.071, -0.026], [0.054, -0.04, -0.021], [0.037, -0.142, -0.012]], 0xa6b1b7, 0.0012);
}
function uniformShoe(g) {
  artoriaSoftBase(g, 0.03);
  const body = g.children[0]; body.material.color.setHex(UNIFORM_LIGHT);
  const sole = artoriaRoundedBox(0.245, 0.017, 0.107, 0.008);
  addMerged(g, [bake(sole, [0, -0.028, 0])], UNIFORM_NAVY, CLOTH);
  uniformLine(g, [[0.113, 0.003, -0.04], [0.12, 0.017, 0], [0.113, 0.003, 0.04]], 0xb9c1c6, 0.0014);
}
const CROWN_BLUE_UNIFORM = {
  head(g, look) { quietFace(g, look, 'uniform'); uniformHair(g, look); },
  chest(g, look) {
    uniformTorso(g, 0.87);
    const base = g.children[0].geometry, p = base.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getX(i) > 0.01) {
      const fullness = Math.exp(-Math.pow((p.getY(i) - 0.018) / 0.075, 2) - Math.pow((Math.abs(p.getZ(i)) - 0.074) / 0.064, 2));
      p.setX(i, p.getX(i) + fullness * 0.012);
    }
    base.computeVertexNormals(); clothNeck(g, look);
    addMerged(g, [cyl(0.072, 0.08, 0.046, 18, true, [0, 0.157, 0])], UNIFORM_NAVY, { ...CLOTH, side: THREE.DoubleSide });
    addMerged(g, [cyl(0.073, 0.073, 0.003, 18, true, [0, 0.18, 0])], UNIFORM_LIGHT, CLOTH);
    const shoulder = [];
    for (const s of [-1, 1]) shoulder.push(bake(artoriaRoundedBox(0.142, 0.018, 0.061, 0.008), [-0.002, 0.135, s * 0.142]));
    addMerged(g, shoulder, UNIFORM_NAVY, CLOTH);
    for (const s of [-1, 1]) uniformLine(g, [[0.071, 0.143, s * 0.121], [0.071, 0.141, s * 0.17], [-0.06, 0.141, s * 0.171]], UNIFORM_LIGHT, 0.0021);
    // Flat cross belt: a ribbon resting on the tunic, not a cylindrical rope.
    addMerged(g, [clothPanel(0.14, [[0.13, -0.143], [0.13, -0.119], [-0.134, 0.11], [-0.134, 0.086]], 0.003)], UNIFORM_LIGHT, CLOTH);
    uniformLine(g, [[0.124, 0.128, 0.011], [0.142, 0.029, 0.011], [0.113, -0.133, 0.011]], 0x183b61, 0.002);
    addMerged(g, [0.103, 0.047, -0.011, -0.075, -0.122].map(y => ball(0.0045, 8, 6, [y < -0.05 ? 0.125 : 0.143, y, 0.012])), 0xc0ab78, CLOTH);
    addMerged(g, [box(0.008, 0.009, 0.025, [0.081, 0.158, 0]), ball(0.005, 8, 6, [0.085, 0.169, 0])], 0xc0ab78, CLOTH);
    for (const s of [-1, 1]) uniformLine(g, [[0.105, 0.097, s * 0.135], [0.129, 0.004, s * 0.101], [0.103, -0.125, s * 0.095]], 0x416c99, 0.0014);
  },
  abdomen(g, look) {
    uniformTorso(g, 0.94);
    // Overlapping tailored waist joins the independently moving chest/hips.
    // The visual overlap does not add a collider or constrain the spine.
    const waist = new THREE.CylinderGeometry(1, 1, 0.245, 32, 8, false), wp = waist.attributes.position;
    for (let i = 0; i < wp.count; i++) {
      const t = Math.abs(wp.getY(i) / 0.1225);
      wp.setXYZ(i, wp.getX(i) * (0.107 + 0.015 * t), wp.getY(i), wp.getZ(i) * (0.151 + 0.012 * t));
    }
    waist.computeVertexNormals(); g.children[0].geometry.copy(waist); waist.dispose();
    // Samira v8 raises the belt assembly by 7 cm; archived cuts retain it.
    const beltRise = look.highWaist ? 0.07 : 0, beltY = -0.039 + beltRise;
    const strap = clothPanel(0.119, look.highWaist
      ? [[0.082, 0.088], [0.082, 0.112], [beltY, 0.124], [beltY, 0.1]]
      : [[0.082, 0.088], [0.082, 0.112], [-0.069, 0.15], [-0.069, 0.125]], 0.003);
    if (look.highWaist) {
      // Tuck the shortened lower end under the curved belt, keeping the
      // upper overlap with the chest strap at its existing position.
      const p = strap.attributes.position;
      for (let i = 0; i < p.count; i++) if (p.getY(i) < 0.04) {
        p.setX(i, 0.121 * Math.sqrt(1 - Math.pow(p.getZ(i) / 0.166, 2)) - 0.002 + p.getX(i) - 0.119);
      }
      strap.computeVertexNormals();
    }
    addMerged(g, [strap], UNIFORM_LIGHT, CLOTH);
    const belt = new THREE.CylinderGeometry(1, 1, 0.036, 32, 1, true); belt.scale(0.121, 1, 0.166); belt.translate(0, beltY, 0);
    addMerged(g, [belt], 0x40372f, { ...CLOTH, side: THREE.DoubleSide });
    addMerged(g, [box(0.012, 0.03, 0.043, [0.124, beltY, -0.012])], 0xb6b8af, { metalness: 0.35, roughness: 0.5 });
    addMerged(g, [box(0.014, 0.018, 0.026, [0.129, beltY, -0.012])], 0x514838, CLOTH);
    const pouches = [-0.092, -0.139].map(z => bake(artoriaRoundedBox(0.036, 0.057, 0.035, 0.009), [0.12, -0.047 + beltRise, z]));
    addMerged(g, pouches, 0x635545, CLOTH);
    addMerged(g, [-0.092, -0.139].map(z => box(0.038, 0.012, 0.038, [0.12, -0.023 + beltRise, z])), 0x817057, CLOTH);
  },
  pelvis(g, look) {
    uniformTorso(g, 1);
    // Jacket skirt ends above the distinct dark pleats, flared slightly at hips.
    const skirt = new THREE.CylinderGeometry(1, 1.12, 0.135, 32, 4, true), p = skirt.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i));
      p.setXYZ(i, p.getX(i) * 0.117, p.getY(i) - 0.054 + 0.014 * Math.cos(a * 2), p.getZ(i) * 0.17);
    }
    skirt.computeVertexNormals(); addMerged(g, [skirt], UNIFORM_BLUE, { ...CLOTH, side: THREE.DoubleSide });
    uniformLine(g, [[0.119, 0.055, 0.012], [0.126, -0.036, 0.012], [0.129, -0.105, 0.012]], 0x193c60);
    addMerged(g, [ball(0.0045, 8, 6, [0.133, -0.055, 0.012])], 0xc0ab78, CLOTH);
    const beltRise = look.highWaist ? 0.07 : 0;
    addMerged(g, [bake(artoriaRoundedBox(0.04, 0.118, 0.079, 0.012), [0.03, -0.02 + beltRise, 0.189])], 0x494437, CLOTH);
    addMerged(g, [box(0.048, 0.023, 0.082, [0.03, 0.032 + beltRise, 0.189])], 0x786b50, CLOTH);
    if (look.highWaist) addMerged(g, [0.012, 0.048].map(x =>
      box(0.014, 0.094, 0.009, [x, 0.146, 0.169], [-0.3, 0, 0])), 0x40372f, CLOTH);
  },
  uarmS(g) { sleeveVolume(g, 1.055, 1.01); }, uarmO(g) { sleeveVolume(g, 1.055, 1.01); },
  farmS: uniformCuff, farmO: uniformCuff,
  thighF: uniformSkirt, thighB: uniformSkirt,
  shinF: uniformBoot, shinB: uniformBoot, footF: uniformShoe, footB: uniformShoe,
};

// Rose/red revision keeps the blue uniform available in the look archive.
function roseUniformHead(g, look) {
  quietFace(g, look, 'uniform');
  // Keep the old tapered face only in archived appearances.
  if (!look.stockFace) {
    // Shape only the visible face. The head body/collider and wound mesh identity remain.
    const face = g.children[0].geometry, p = face.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), jaw = Math.max(0, Math.min(1, -y / 0.1));
      p.setXYZ(i, p.getX(i) * (0.97 - jaw * 0.07), y * 1.08, p.getZ(i) * (0.88 - jaw * 0.16));
    }
    face.computeVertexNormals();
    for (const eye of g.children.slice(1, 3)) {
      eye.position.set(0.091, 0.020, Math.sign(eye.position.z) * 0.030);
      eye.scale.z = 0.90;
    }
    g.children[3].scale.set(0.72, 0.72, 0.70);
    g.children[3].position.set(0.095, -0.010, 0);
  }
  const cap = g.children[4], shell = new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.64);
  const hp = shell.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const a = Math.atan2(hp.getZ(i), hp.getX(i));
    const t = Math.floor(i / 25) / 14, theta = t * Math.PI * (0.64 - 0.31 * Math.max(0, Math.cos(a)));
    hp.setXYZ(i, (look.stockFace ? 0.107 : 0.104) * Math.sin(theta) * Math.cos(a), 0.115 * Math.cos(theta), (look.stockFace ? 0.107 : 0.094) * Math.sin(theta) * Math.sin(a));
  }
  shell.computeVertexNormals(); cap.geometry.dispose(); cap.geometry = shell;
  cap.position.set(0, 0, 0); cap.scale.set(1, 1, 1);
  if (!look.stockFace) g.children[5].scale.set(0.96, 1.08, 0.86);
  g.children[5].material.color.setHex(0x79515a);
  if (!look.stockFace) {
    // The old ears intersected the cap at its rim; give each ear a clean lower edge.
    g.children[6].visible = false;
    addMerged(g, [-1, 1].map(s => bake(new THREE.SphereGeometry(0.013, 10, 7),
      [-0.006, -0.026, s * 0.088], null, [0.65, 1.1, 0.45])), look.skin, CLOTH);
    g.children[7].scale.set(0.91, 1.08, 0.80);
  }
  const layer = artoriaCloth(g, 'uniform-hair'), locks = [];
  // A broken, higher fringe leaves the existing small eyes unobscured.
  for (let i = -2; i <= 2; i++) {
    const z = i * 0.026;
    locks.push(isoldeLock([[0.015, 0.108, z * 0.65], [0.074, 0.086, z],
      [0.095, 0.060, z + 0.008], [0.097, 0.039 + Math.abs(i) * 0.006, z + 0.013]],
    [0.022, 0.027, 0.020, 0.002], 0.006));
  }
  for (const s of [-1, 1]) {
    locks.push(isoldeLock([[0.018, 0.025, s * 0.085], [-0.025, 0.074, s * 0.081],
      [-0.049, 0.100, s * 0.043], [-0.060, 0.103, -0.025]], [0.025, 0.029, 0.024, 0.012], 0.008));
    locks.push(isoldeLock([[0.042, 0.065, s * 0.076], [0.050, 0.012, s * 0.081],
      [0.049, -0.052, s * 0.077], [0.041, -0.078, s * 0.064]], [0.016, 0.018, 0.012, 0.0015], 0.005));
  }
  locks.push(bake(new THREE.SphereGeometry(0.026, 12, 8), [-0.058, 0.097, -0.025], null, [1, 0.65, 1]));
  addMerged(layer, locks, look.hair, CLOTH);
  const curve = new THREE.CatmullRomCurve3([
    [-0.060, 0.100, -0.025], [-0.108, 0.117, -0.034], [-0.151, 0.045, -0.043],
    [-0.179, -0.105, -0.055], [-0.186, -0.280, -0.072], [-0.187, -0.422, -0.090],
  ].map(v => new THREE.Vector3(...v)));
  const braids = [];
  for (let strand = 0; strand < 3; strand++) {
    const pts = Array.from({ length: 49 }, (_, i) => {
      const t = i / 48, a = t * Math.PI * 13 + strand * Math.PI * 2 / 3;
      const c = curve.getPoint(t), radius = 0.015 * (1 - 0.64 * t);
      return [c.x + radius * Math.cos(a), c.y, c.z + radius * Math.sin(a)];
    });
    braids.push(taperedTube(pts, pts.map((_, i) => 0.012 - i / 48 * 0.007), 72, 6));
  }
  addMerged(layer, braids, look.hair, CLOTH);
  // Visible high tie, two ribbon loops and narrow hanging tails.
  addMerged(layer, [ball(0.017, 10, 6, [-0.078, 0.108, -0.027]),
    bake(new THREE.SphereGeometry(0.031, 10, 6), [-0.086, 0.113, 0.002], [0.25, 0, 0], [0.25, 0.45, 1]),
    bake(new THREE.SphereGeometry(0.031, 10, 6), [-0.086, 0.113, -0.057], [-0.25, 0, 0], [0.25, 0.45, 1]),
    clothPanel(-0.119, [[0.104, -0.013], [0.106, 0.001], [-0.002, 0.037], [0.011, 0.014]], 0.002),
    clothPanel(-0.119, [[0.102, -0.042], [0.106, -0.056], [-0.001, -0.086], [0.010, -0.063]], 0.002),
    cyl(0.012, 0.011, 0.018, 10, false, [-0.187, -0.391, -0.085])], 0x592736, CLOTH);
}
const roseUniformColors = new Map([
  [UNIFORM_BLUE, 0x922e40], [UNIFORM_NAVY, 0x24232a], [0x4b6989, 0x91374a],
  [0x183b61, 0x541c28], [0x193c60, 0x541c28], [0x416c99, 0xb04c5a], [0x536375, 0x5c5258],
]);
const CROWN_ROSE_UNIFORM = Object.fromEntries(Object.entries(CROWN_BLUE_UNIFORM).map(([part, decorate]) => [part,
  part === 'head' ? roseUniformHead : (g, look) => {
    decorate(g, look);
    g.traverse(node => { if (node.isMesh) for (const material of [node.material].flat()) {
      const color = roseUniformColors.get(material.color?.getHex());
      if (color !== undefined) material.color.setHex(color);
    } });
  },
]));

// 김씨·에이라 복식 모듈(outfit_renji.js·outfit_eira.js)이 쓰는 도우미 묶음 — 샛별 쪽과 같은 이름·같은 열쇠
export const newOutfitHelpers = { THREE, bake, box, cyl, ball, cone, addMerged, CLOTH, quietFace, isoldeLock, artoriaCloth, sleeveVolume, clothNeck,
  // 디자인 리뷰 10/10 (사미라 v2·투야나 v2 복식 모듈)이 더 쓰는 것 — 열쇠만 늘림, 기존 모듈은 그대로
  taperedTube, clothPanel, reshapeMain, hangingClothShading, roseUniformHead,
  artoriaRoundedBox }; // 라트나 복식 모듈(outfit_ratna.js, 10/14)이 더 쓰는 것 — 샛별 쪽 묶음과 같은 열쇠

const RENJI_V1 = createRenjiOutfit(newOutfitHelpers); // 김씨 v1 (v2 가 하카마 밖 전부를 이어 받는다)

export const OUTFITS = {
  returned_king: createReturnedKingOutfit(newOutfitHelpers),
  returned_king_v2: createReturnedKingOutfitV2(newOutfitHelpers),
  artoria_ballroom: createArtoriaBallroomOutfit(newOutfitHelpers, ARTORIA_OUTFIT.head), // 광기의 아르토리아 (outfit_alter.js alterLook) — 머리는 원래 아르토리아 머리 위에 땋은 올림머리 · 백합 금관
  // 샛별 저장소에서 가져온 인물 넷 (10/10) — 위 머리말
  artoria_silver_v2: ARTORIA_OUTFIT_V2,
  artoria_silver_v3: ARTORIA_OUTFIT_V3, // 아르토리아 v2 — 망토·앞자락 (외형 다듬기 2차 10/10)
  artoria_silver_v4: ARTORIA_OUTFIT_V4, // 아르토리아 v3 — 망토 주름 (외형 3차 10/11)
  artoria_silver_v5: ARTORIA_OUTFIT_V5, // 아르토리아 v4 — 망토 주름 더 많이·고르지 않게 (외형 4차 10/13)
  crown_rose_uniform: CROWN_ROSE_UNIFORM,
  renji_wanderer: RENJI_V1,
  renji_baji: createRenjiBajiOutfit(newOutfitHelpers, RENJI_V1), // 김씨 v2 하카마 → 바지·행전 (외형 다듬기 2차 10/10)
  renji_wrapped_sword: createRenjiBajiOutfit(newOutfitHelpers, RENJI_V1, { hakama: true }), // 김씨 v3 = v1 옷 + 밝힌 먹빛 + 흰 천 칼 (외형 3차 10/11)
  samira_angarkha_v4: createSamiraOutfit(newOutfitHelpers, { v4: true }), // 마야(id samira) v4 어깨 틈 메움 (외형 3차 10/11)
  eira_winter_priest: createEiraOutfit(newOutfitHelpers),
  samira_angarkha: createSamiraOutfit(newOutfitHelpers), // 사미라 v2 (디자인 리뷰 10/10)
  samira_angarkha_v3: createSamiraOutfit(newOutfitHelpers, { v3: true }), // 사미라 v3 흰 포인트·짧은 자락 (외형 다듬기 2차 10/10)
  tuyana_winter_priest: createTuyanaOutfit(newOutfitHelpers), // 투야나 v2 (디자인 리뷰 10/10)
  tuyana_winter_priest_chotki: createTuyanaOutfit(newOutfitHelpers, { chotki: true }), // 투야나 v3 왼손목 추트키 (외형 다듬기 2차 10/10)
  tuyana_winter_priest_dangle: createTuyanaOutfit(newOutfitHelpers, { dangle: true }), // 투야나 v4 늘어져 흔들리는 긴 추트키 (외형 3차 10/11)
  tuyana_winter_priest_thick: createTuyanaOutfit(newOutfitHelpers, { dangle: true, thick: true }), // 투야나 v5 추트키 매듭 굵게 (10/11 01:4x)
  ratna_ferryman: createRatnaOutfit(newOutfitHelpers), // 라트나 (여정 밖 인물, 10/14) — 모듈 하나가 look.ratnaRevision 으로 샛별 v1~v3 · 우리 v4 를 가른다. 이름은 샛별 쪽 열쇠 그대로
  silver_wanderer: createSilverWandererOutfit(newOutfitHelpers), // 다라이시 v1 (여정 밖 인물, 10/14) — 이름은 샛별 쪽 열쇠 그대로
  silver_wanderer_detail: createSilverWandererDetail(newOutfitHelpers), // 다라이시 v2·v4~v6 (look.hairStyle 로 가름) + 우리 v7~v9 (look.daraishiRevision) · v10 (v7 + look.daraishiLower 10)
  chanda_watergate: createChandaOutfit(newOutfitHelpers), // 찬다 (여정 밖 인물, 10/14) — 모듈 하나가 look.chandaRevision 으로 샛별 v1 · 우리 v2(무릎)를 가른다. 이름은 샛별 쪽 열쇠 그대로
  terracotta_guard: createTerracottaOutfit(newOutfitHelpers), // 병마용 (여정 밖 인물, 10/14) — look.terracottaRevision 으로 샛별 v1 · 우리 v2(잔선 덜기)를 가른다. 이름은 샛별 쪽 열쇠 그대로
  bran_farmer: BRAN_FARMER,
  isolde_saber: ISOLDE_SABER,
  isolde_longhair: ISOLDE_LONGHAIR,
  liao_ronin: LIAO_RONIN,
  liao_gi: LIAO_GI,
  liao_gi_wild: LIAO_GI_WILD,
  liao_gi_curly: LIAO_GI_CURLY,
  liao_gi_wavy: LIAO_GI_WAVY,
  liao_gi_swept: LIAO_GI_SWEPT,
  liao_gi_halfup: LIAO_GI_HALFUP,
  liao_gi_tousled: LIAO_GI_TOUSLED,
  heinrich_knight: HEINRICH_KNIGHT,
  heinrich_full_plate: HEINRICH_FULL_PLATE,
  margarethe_dragon: MARGARETHE_DRAGON,
  margarethe_dragon_helm: MARGARETHE_DRAGON_HELM,
  margarethe_dragon_horned: MARGARETHE_DRAGON_HORNED,
  tome_rapier: TOME_RAPIER,
  tome_librarian: TOME_LIBRARIAN,
  omari_seafarer: OMARI_SEAFARER,
  minami_shrine: MINAMI_SHRINE,
  minami_grove: MINAMI_GROVE,
  minami_hakama: MINAMI_HAKAMA,
  minami_miko: MINAMI_MIKO,
  omari_seafarer_round: OMARI_ROUND,
};

/** dressPart가 부위 하나를 다 그린 뒤 불린다. look.outfit이 가리키는 세트에 그 부위용 함수가 있으면 얹는다.
 *  groups(fighter.js 부위 묶음)는 넷째 인자로 넘긴다 — 지금 읽는 곳은 궁정 예복의 허리끈(골반을 따라 그림만 휨) 하나, 다른 세트는 안 읽는다 */
export function decorateOutfit(dressTo, d, look, groups) {
  const set = look?.outfit && OUTFITS[look.outfit];
  const fn = set && set[d.name];
  if (!fn) return;
  const before = dressTo.children.length;
  dressTo.userData.outfit = look.outfit;
  dressTo.userData.outfitPart = d.name;
  fn(dressTo, look, d, groups);
  decorateAlter(dressTo, look, d.name);
  // 방어구 부위: 이 부위에 얹은 판금 메쉬들을 userData.armor로 알려 둔다. 오너 결정("판금도 피해를
  // 줄여 주고, 닳고, 완전히 부서지면 사라진다"): look.armor === 'plate'이고 ARMOR.on이면 fighter.js가 이
  // 표시가 있는 부위에 판금 내구도를 주고, 파손되면 곁 판을, 0이 되면 남은 메쉬(금 포함)를 떼어 흩뜨린 뒤 없앤다
  if (set.armorParts?.has(d.name)) {
    const armor = dressTo.children.slice(before);
    for (const m of armor) m.userData.base = { color: m.material.color.getHex(), roughness: m.material.roughness };
    const crack = plateCrack(dressTo, armor[0]);
    // 금 메쉬도 armor 목록에 넣어, 판금이 완전히 부서져 숨길 때 같이 숨겨지게 한다
    dressTo.userData.armor = [...armor, crack];
    dressTo.userData.armorCracks = [crack];
    // 판금 밑의 누비 속옷: armor 목록 밖(판이 아니다). 완전 파손 때 setPlateWear 가 보이게 한다
    const under = set.underCloth?.(dressTo, d.name);
    if (under?.length) dressTo.userData.underCloth = under;
  }
}

/** 표면만 다듬기 (샛별 저장소에서 가져옴 fe29ce4·c21bd19·df0a9d6·b8b1344): fighter.js 가 판금 경계(armorBoxes)를 잡은 뒤 부른다 — 몸·충돌체·판금 판정 범위는 그대로.
 *  stockEyes = quietFace 가 눌러 둔 눈을 기본 크기로(eyeColor 가 있으면 눈 색) · tailoring 'soft-shoulders' = 몸통 모서리 둥글리기·견장 눌러 펴기·위팔 판 6 % 좁히기.
 *  표시 없는 인물은 아무 일도 없다. 샛별 쪽의 마르그레테 가슴판 다듬기 가지는 우리 마르그레테가 그 표시를 안 써서 뺐다. */
export function polishOutfit(g, d, look) {
  if (look.stockEyes && d.name === 'head') {
    for (const eye of g.children.slice(1, 3)) {
      eye.scale.set(1, 1, 1);
      if (look.eyeColor != null) eye.material.color.setHex(look.eyeColor);
    }
  }
  if (look.tailoring !== 'soft-shoulders') return;
  const replace = (mesh, geo) => {
    mesh.geometry.dispose(); mesh.geometry = geo;
    geo.computeBoundingBox(); geo.computeBoundingSphere();
  };
  if (d.name === 'chest' || d.name === 'abdomen') {
    const main = g.children[0], p = main.geometry.parameters;
    // Round the garment, keeping its widest ribcage/shoulder span unchanged.
    if (p?.width && p.height && p.depth && !['crown_rose_uniform', 'artoria_silver_v2', 'artoria_silver_v3', 'artoria_silver_v4', 'artoria_silver_v5'].includes(look.outfit)) {
      // The uniform and silver under-armor already have fitted surfaces.
      replace(main, artoriaRoundedBox(p.width, p.height, p.depth,
        d.name === 'chest' ? 0.045 : 0.03));
    }
    if (look.outfit === 'crown_rose_uniform' && d.name === 'chest') {
      // Flatten the two epaulettes about their own centres, not the shoulders.
      for (const mesh of g.children.slice(1)) {
        if (!mesh.geometry || !mesh.visible) continue;
        mesh.geometry.computeBoundingBox(); const b = mesh.geometry.boundingBox;
        if (b.min.y < 0.12 || b.max.y - b.min.y > 0.025 || b.max.z - b.min.z < 0.035 || b.max.x - b.min.x < 0.1) continue;
        const geo = mesh.geometry.clone(), a = geo.attributes.position;
        for (let i = 0; i < a.count; i++) {
          const z = a.getZ(i), centre = Math.sign(z) * 0.142;
          a.setY(i, 0.132 + (a.getY(i) - 0.135) * 0.6);
          a.setZ(i, centre + (z - centre) * 0.82);
        }
        geo.computeVertexNormals(); replace(mesh, geo);
      }
    }
    // Candidate1 still read as broad slabs. User-authorized second step: only
    // the visible ribcage is 8% narrower, blending into a 4% narrower waist.
    // Anchors, capsules, mass and the captured armor coverage stay unchanged.
    if (!look.originalTorsoWidth) g.scale.z *= d.name === 'chest' ? 0.92 : 0.96;
  }
  if (d.name === 'uarmS' || d.name === 'uarmO') {
    for (const mesh of g.userData.armor || []) {
      const geo = mesh.geometry.clone(), p = geo.attributes.position;
      // All overlapping cap layers use the same transform to keep their seams.
      for (let i = 0; i < p.count; i++) {
        // Silver caps must retain their height above the existing upper-arm
        // sleeve; flattening them exposed its rounded tip through the armor.
        const height = ['artoria_silver_v2', 'artoria_silver_v3', 'artoria_silver_v4', 'artoria_silver_v5'].includes(look.outfit) ? 1 : 0.88;
        p.setXYZ(i, p.getX(i) * 0.94, 0.075 + (p.getY(i) - 0.075) * height, p.getZ(i) * 0.94);
      }
      geo.computeVertexNormals(); replace(mesh, geo);
    }
  }
}

/**
 * 판금 부위 하나의 금: 첫 판금 메쉬의 앞면(+x)을 세로로 가로지르는 짙은 지그재그 선.
 * 캐릭터를 만들 때(isolatedVisual 안) 미리 만들어 숨겨 둔다 — 싸우는 도중에 메쉬를 새로 만들면
 * three.js가 전역 난수를 써서 시드 시뮬 결과가 바뀌기 때문이다.
 */
function plateCrack(parent, mesh) {
  const geo = mesh.geometry;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const b = geo.boundingBox;
  const x = b.max.x + 0.002;
  const yc = (b.max.y + b.min.y) / 2;
  const h = (b.max.y - b.min.y) * 0.35;
  const zc = (b.max.z + b.min.z) / 2;
  const pts = [-1, -0.5, 0, 0.5, 1].map((t, i) => [x, yc + t * h, zc + (i % 2 ? 0.012 : -0.006)]);
  const m = addMerged(parent, [taperedTube(pts, [0.003, 0.0026, 0.002], 8, 4)], crackColor(mesh.material.color), { roughness: 1 });
  m.visible = false;
  return m;
}

// 금 색: 밝은 판(하인리히 은빛)에는 짙은 선, 짙은 판(마르그레테 먹색)에는 안쪽 쇠가 드러난 밝은 선 —
// 먹색 판에 검은 금은 거의 안 보였다
function crackColor(c) {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b < 0.1 ? 0xa4a4ac : 0x050505;
}

// 판금이 닳은 정도를 겉모습에 반영한다 (전투 쪽이 this.plate[part]가 바뀔 때마다 부른다).
//  group: fighter.groups[part] (칼 든 팔은 그 안의 자식 그룹에 표시가 있어도 알아서 찾는다)
//  wear01: 1 = 멀쩡, 0 = 완전 파손 직전. 투구(setHelmetWear)와 같은 단계, 난수 없이 결정적이고 되돌려진다.
//  · 0.5 아래: 찌그러짐·긁힘 — 판이 살짝 눌리고 틀어지며, 거칠고 희끗해진다(금띠도 긁혀 흐려진다)
//  · 0.2 아래: 금이 보인다
//  판금 표시(userData.armor)가 없는 부위에는 아무 일도 하지 않는다. 완전 파손 때 숨기는 것은 전투 쪽 몫.
export function setPlateWear(group, wear01) {
  const holder = group?.userData?.armor ? group : group?.children?.find((c) => c.userData?.armor);
  if (!holder) return;
  const w = Math.min(1, Math.max(0, wear01));
  const dent = w < 0.5 ? (0.5 - w) / 0.5 : 0;
  const broken = w < 0.2;
  const plates = holder.userData.armor.filter((m) => m.userData.base);
  plates.forEach((m, i) => {
    const sgn = i % 2 ? -1 : 1; // 조각마다 반대로 틀어지게 (결정적)
    m.rotation.set(0.05 * dent * sgn, 0, -0.04 * dent * sgn);
    m.scale.set(1 + 0.03 * dent, 1 - 0.05 * dent, 1 + 0.02 * dent);
    m.material.color.setHex(m.userData.base.color).lerp(_scratch, 0.35 * dent);
    m.material.roughness = Math.min(1, m.userData.base.roughness + 0.45 * dent);
  });
  const shown = plates.length && plates[0].visible;
  for (const c of holder.userData.armorCracks || []) {
    c.visible = broken && shown;
    c.rotation.copy(plates[0].rotation);
    c.scale.copy(plates[0].scale);
  }
  // 완전 파손(내구 0): 판이 떨어져 나간 자리에 찢긴 누비 속옷이 드러난다
  for (const m of holder.userData.underCloth || []) m.visible = w <= 0;
}

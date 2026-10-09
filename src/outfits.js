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
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { weaponEnv } from './weapon_looks.js';

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
    addMerged(g, [box(0.03, 0.3, 0.2, [-0.137, 0.0, 0])], look.hair, { roughness: 1 });
  },
  abdomen(g, look) {
    ISOLDE_SABER.abdomen(g, look);
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
    addMerged(g, patch, 0x1a1a1a, { roughness: 0.9 });
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
    helmPiece(helm, 'hornL', [taperedTube(mirrorZ(MG3_HORN_R), MG3_HORN_RADII, 10, 6)], MG_PLATE, MG3_PLATE, mirrorZ(MG3_HORN_R)[0]);
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
    eye.scale.z = kind === 'yeongman' ? 0.88 : 1;
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
const YEONGMAN_SHRINE = {
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
    quietFace(g, look, 'yeongman');
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

// Yeongman v2 keeps the shrine outfit's native body/wound surfaces. The longer
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
  quietFace(g, look, 'yeongman');
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

const YEONGMAN_GROVE = {
  ...YEONGMAN_SHRINE,
  head(g, look) {
    if (look.hairStyle === 'long-twintails') return shrineTwinTailHead(g, look);
    quietFace(g, look, 'yeongman');
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
    YEONGMAN_SHRINE.chest(g, look);
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
    YEONGMAN_SHRINE.abdomen(g);
    // Fine doubled rope follows the belt rather than hovering across the body.
    addMerged(g, [-1, 1].map((s) => taperedTube([[0.126, -0.017 + s * 0.003, -0.155], [0.133, -0.032 + s * 0.003, -0.07], [0.134, -0.023 + s * 0.003, 0.075], [0.126, -0.017 + s * 0.003, 0.154]], [0.0024, 0.0024, 0.0024, 0.0024], 12, 4)), 0xd6c49d, CLOTH);
  },
  pelvis(g) {
    YEONGMAN_SHRINE.pelvis(g);
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

// Isolde v3: costume-only refinement. Each lock/garment remains attached to its
// own native part; v2 stays intact for comparisons. No cloth physics or scaling.
const ISOLDE_INK = 0x30313e;
const ISOLDE_SEAM = 0x595964;
const ISOLDE_LINEN = 0xf0e7d6;

// Broad flattened locks, rather than a single back plate or cylindrical braids.
// Cross sections stay thin in X and broad in Z; staggered tips soften joins.
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

// Keep the original representative mesh and BoxGeometry contract for wounds.
// Small edge rounding shapes the garment only, within its existing bounds.
function isoldeSoftBox(g, radius = 0.012, waist = 1) {
  const main = g.children[0], { width, height, depth } = main.geometry.parameters;
  const geo = new THREE.BoxGeometry(width, height, depth, 6, 8, 8);
  const p = geo.attributes.position;
  const core = new THREE.Vector3(width / 2 - radius, height / 2 - radius, depth / 2 - radius);
  const v = new THREE.Vector3(), near = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    near.set(THREE.MathUtils.clamp(v.x, -core.x, core.x), THREE.MathUtils.clamp(v.y, -core.y, core.y), THREE.MathUtils.clamp(v.z, -core.z, core.z));
    v.sub(near).normalize().multiplyScalar(radius).add(near);
    const taper = THREE.MathUtils.lerp(waist, 1, (v.y + height / 2) / height);
    p.setXYZ(i, v.x * taper, v.y, v.z * taper);
  }
  geo.computeVertexNormals();
  main.geometry.dispose();
  main.geometry = geo;
}

function isoldeBackHair(g, look, part) {
  const locks = [];
  const chest = part === 'chest';
  for (let i = 0; i < 5; i++) {
    const z = (i - 2) * 0.041;
    const pts = chest
      ? [[-0.137, 0.184, z * 0.8], [-0.15, 0.078, z], [-0.147, -0.095, z * 1.07], [-0.141, -0.179 + Math.abs(i - 2) * 0.009, z * 0.91]]
      : [[-0.138, 0.08, z * 1.05], [-0.14, 0.002, z], [-0.141, -0.065, z * 0.89], [-0.155, -0.116 + Math.abs(i - 2) * 0.025, z * 0.76 + (i % 2 ? 0.006 : -0.004)]];
    locks.push(isoldeLock(pts, chest ? [0.053, 0.054, 0.052, 0.034] : [0.054, 0.051, 0.033, 0.002], 0.008));
  }
  addMerged(g, locks, look.hair, { roughness: 0.76 });
}

function isoldeCuff(g) {
  sleeveVolume(g, 1.08, 0.97);
  addMerged(g, [cyl(0.05, 0.05, 0.05, 12, true, [0, -0.088, 0])], ISOLDE_LINEN, CLOTH);
  addMerged(g, [cyl(0.0508, 0.0508, 0.005, 12, true, [0, -0.071, 0]), cyl(0.0508, 0.0508, 0.005, 12, true, [0, -0.105, 0])], ISOLDE_SEAM, CLOTH);
}

function isoldeSkirt(g) {
  // The skirt halves follow each thigh and remain the native wound surface.
  const geo = new THREE.CylinderGeometry(0.091, 0.135, 0.39, 24, 8, false);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i));
    const fold = 1 + 0.06 * Math.cos(a * 8);
    p.setXYZ(i, p.getX(i) * fold * 0.88, p.getY(i), p.getZ(i) * fold);
  }
  geo.computeVertexNormals();
  g.children[0].geometry.copy(geo);
  g.children[0].material.color.setHex(ISOLDE_INK);
  geo.dispose();
  // Match the pleats, so the hem does not alternately sink under their peaks.
  const hem = new THREE.CylinderGeometry(0.135, 0.137, 0.017, 24, 1, true);
  const hp = hem.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const a = Math.atan2(hp.getZ(i), hp.getX(i)), fold = 1 + 0.06 * Math.cos(a * 8);
    hp.setXYZ(i, hp.getX(i) * fold * 0.88, hp.getY(i) - 0.185, hp.getZ(i) * fold);
  }
  hem.computeVertexNormals();
  addMerged(g, [hem], ISOLDE_SEAM, CLOTH);
}

const ISOLDE_TAILORED = {
  head(g, look) {
    quietFace(g, look, 'isolde');
    const hair = [];
    // A side-swept fringe and two curved cheek locks leave the eyes readable.
    hair.push(taperedTube([[0.033, 0.094, -0.067], [0.092, 0.072, -0.01], [0.102, 0.038, 0.062], [0.063, -0.015, 0.09]], [0.019, 0.022, 0.015, 0.002], 12, 7));
    for (const s of [-1, 1]) {
      hair.push(isoldeLock([[0.012, 0.077, s * 0.095], [0.012, -0.002, s * 0.111], [0.023, -0.105, s * 0.112], [0.037, -0.17, s * 0.095]], [0.026, 0.035, 0.026, 0.002], 0.012));
    }
    // A continuous nape curtain overlaps the torso's upper locks. Keep the
    // head-following segment short; the waist-length section follows the torso.
    for (let i = 0; i < 5; i++) {
      const z = (i - 2) * 0.037;
      hair.push(isoldeLock([[-0.069, 0.069, z * 0.72], [-0.123, -0.012, z], [-0.151, -0.118, z * 1.1], [-0.155, -0.22 + Math.abs(i - 2) * 0.014, z * 1.1]], [0.04, 0.05, 0.048, 0.013], 0.01));
    }
    addMerged(g, hair, look.hair, { roughness: 0.76 });
  },
  chest(g, look) {
    clothBase(g, look.tunic);
    isoldeSoftBox(g, 0.02, 0.94);
    clothNeck(g, look);
    const collar = [
      [[0.155, -0.018], [0.136, -0.122], [0.026, -0.067], [0.096, -0.026]],
      [[0.155, 0.018], [0.136, 0.122], [0.026, 0.067], [0.096, 0.026]],
    ];
    addMerged(g, collar.map((pts) => clothPanel(0.127, pts)), 0xc4bbaa, CLOTH);
    addMerged(g, collar.map((pts) => clothPanel(0.131, pts.map(([y, z]) => [y + 0.005, z * 0.91]))), ISOLDE_LINEN, CLOTH);
    addMerged(g, [box(0.005, 0.15, 0.021, [0.12, -0.049, 0]), ...[-1, 1].map((s) => box(0.004, 0.19, 0.007, [0.121, -0.035, s * 0.11], [s * 0.035, 0, 0]))], 0xd3c8b6, CLOTH);
    addMerged(g, [-0.006, -0.052, -0.098].map((y) => ball(0.006, 6, 4, [0.125, y, 0])), 0x938477, CLOTH);
    // Small dark bow under the folded collar, with asymmetric sewn tails.
    addMerged(g, [clothPanel(0.14, [[0.086, -0.006], [0.1, -0.035], [0.063, -0.03]]), clothPanel(0.14, [[0.086, 0.006], [0.098, 0.035], [0.063, 0.03]]), clothPanel(0.138, [[0.078, -0.006], [0.017, -0.018], [0.025, -0.002], [0.078, 0.008]])], ISOLDE_INK, CLOTH);
    isoldeBackHair(g, look, 'chest');
  },
  abdomen(g, look) {
    clothBase(g, look.tunic);
    isoldeSoftBox(g, 0.014, 0.96);
    clothBand(0.115, 0.165, -0.031, 0.074, ISOLDE_INK, g);
    addMerged(g, [box(0.006, 0.006, 0.325, [0.119, 0.0, 0]), box(0.007, 0.04, 0.048, [0.123, -0.029, 0])], ISOLDE_SEAM, CLOTH);
    isoldeBackHair(g, look, 'abdomen');
  },
  pelvis(g) {
    clothBase(g, ISOLDE_INK);
    isoldeSoftBox(g, 0.014);
    // Shallow layered hips overlap the divided skirt without crossing knees.
    addMerged(g, [-1, 1].map((s) => clothPanel(0.111, [[0.075, s * 0.019], [0.075, s * 0.159], [-0.099, s * 0.192], [-0.118, s * 0.04]])), ISOLDE_INK, CLOTH);
    addMerged(g, [-1, 1].map((s) => clothPanel(0.117, [[0.068, s * 0.085], [0.068, s * 0.091], [-0.107, s * 0.114], [-0.109, s * 0.108]])), ISOLDE_SEAM, CLOTH);
  },
  uarmS(g) { sleeveVolume(g, 1.16, 1.07); },
  uarmO(g) { sleeveVolume(g, 1.16, 1.07); },
  farmS: isoldeCuff, farmO: isoldeCuff,
  thighF: isoldeSkirt, thighB: isoldeSkirt,
  footF: isoldeShoe, footB: isoldeShoe,
};
function isoldeShoe(g) {
  isoldeSoftBox(g, 0.009);
  addMerged(g, [box(0.038, 0.006, 0.108, [0.018, 0.039, 0]), box(0.02, 0.009, 0.023, [0.018, 0.042, -0.044])], 0x756458, CLOTH);
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
    addMerged(g, [-1, 1].map((s) => box(0.007, 0.016, 0.025, [0.101, 0.012, s * 0.035])), 0x418f87, CLOTH);
    addMerged(g, [-1, 1].map((s) => box(0.006, 0.013, 0.008, [0.107, 0.012, s * 0.035])), 0x162d30, CLOTH);
    addMerged(g, [-1, 1].map((s) => box(0.003, 0.004, 0.004, [0.111, 0.016, s * 0.033])), 0xeaf3e9, CLOTH);
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

export const OUTFITS = {
  artoria_silver: ARTORIA_OUTFIT,
  artoria_silver_v2: ARTORIA_OUTFIT_V2,
  bran_farmer: BRAN_FARMER,
  isolde_saber: ISOLDE_SABER,
  isolde_longhair: ISOLDE_LONGHAIR,
  isolde_tailored: ISOLDE_TAILORED,
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
  omari_seafarer: OMARI_SEAFARER,
  yeongman_shrine: YEONGMAN_SHRINE,
  yeongman_grove: YEONGMAN_GROVE,
};

/** dressPart가 부위 하나를 다 그린 뒤 불린다. look.outfit이 가리키는 세트에 그 부위용 함수가 있으면 얹는다. */
export function decorateOutfit(dressTo, d, look) {
  const set = look?.outfit && OUTFITS[look.outfit];
  const fn = set && set[d.name];
  if (!fn) return;
  const before = dressTo.children.length;
  dressTo.userData.outfit = look.outfit;
  dressTo.userData.outfitPart = d.name;
  fn(dressTo, look, d);
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

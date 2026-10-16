// ─────────────────────────────────────────────────────────────
//  검투사 겉모습(옷 색, 투구, 머리카락). 물리에는 영향이 없다.
//  색은 16진수 RGB. 새 캐릭터를 만들려면 이 목록에 하나 추가하면 된다.
//
//  모델링 PM 라운드: 캐릭터마다 여러 버전의 외형을 archive에 쌓아 둔다(마음에 안 든 것도 지우지
//  않는다 — 나중에 다시 꺼내 쓸 수 있게). CHARACTER_LOOK_VERSION이 "지금 쓰는 버전"을 가리키고,
//  getLook(id, version)으로 특정 버전을 바로 꺼내 볼 수 있다(주소창 미리보기용, main.js 참고).
//  look.outfit 필드는 outfits.js의 장식 세트 키 — dressPart가 그린 기본 몸 위에 갑옷판·머리모양·
//  수염 등을 덧붙인다. look.accent는 outfits.js에서만 쓰는 보조색(트림 등)이라 dressPart는 무시한다.
// ─────────────────────────────────────────────────────────────
export const LOOK_ARCHIVE = {
  // 누비 상의(갬비슨) + 가죽 끈 + 챙 넓은 투구(케틀햇). 감독 지시: 주인공 외형은 그대로 둔다.
  player: {
    v0: {
      tunic: 0xe6d9bd,
      quilt: 0xcbbd9e,
      sleeve: 0xe6d9bd,
      straps: 0x7a4a26,
      belt: 0x5a3a22,
      hoseUpper: 0x7a2121,
      hoseLower: 0xe8e4da,
      shoes: 0x6b4428,
      skin: 0xe0b08a,
      hands: 0xe0b08a,
      helmet: 'kettle',
      metal: 0xb9c0c7,
      hair: null,
      grip: 0x4a2e1a,
      hilt: 0x9aa3ad,
    },
  },
  // 파란 더블릿 + 겨자색 바지, 투구 없이 머리띠. 캐릭터 미지정 기본 상대.
  enemy: {
    v0: {
      tunic: 0x2f5fc0,
      quilt: 0x24498f,
      sleeve: 0x2f5fc0,
      straps: null,
      belt: 0x3a2618,
      hoseUpper: 0x8a6a2a,
      hoseLower: 0x7a5e25,
      shoes: 0xa0602c,
      skin: 0xd49a78,
      hands: 0x5a3a22,
      helmet: null,
      metal: 0x8f8a82,
      hair: 0x2b1d14,
      headband: 0x2a4aa8,
      grip: 0x2a1a10,
      hilt: 0x7d7870,
    },
  },

  // ── 1. 오소리 브란: v0(예전 어두운 잡색) → v1(화전민 농부 차림, 베이지~갈색, 금발) ──
  bran: {
    v0: {
      tunic: 0x5b4a2f,
      quilt: 0x4a3b24,
      sleeve: 0x5b4a2f,
      straps: 0x2e2013,
      belt: 0x2e2013,
      hoseUpper: 0x3a3a2a,
      hoseLower: 0x6b5a3a,
      shoes: 0x3a2a1a,
      skin: 0xc98f5e,
      hands: 0xc98f5e,
      helmet: null,
      metal: 0x6b6258,
      hair: 0x2a1c10,
      grip: 0x3a2a1a,
      hilt: 0x6b5a3a,
    },
    v1: {
      // 설정집(character_lore.md) "흙빛 튜닉에 낡은 가죽끈" 반영: 베이지~갈색 안에서 좀 더
      // 흙빛으로, 가죽끈은 새것처럼 반짝이지 않게 낡은 색으로 되살렸다
      tunic: 0xa08757,
      quilt: 0x7c6740,
      sleeve: 0xa08757,
      straps: 0x5a4630,
      belt: 0x7a6135,
      hoseUpper: 0x5c4830,
      hoseLower: 0x4a3a26,
      shoes: 0x3a2a1c,
      skin: 0xc98f5e,
      hands: 0xc98f5e,
      helmet: null,
      metal: 0x6b6258,
      hair: 0xd9b558,
      grip: 0x3a2a1a,
      hilt: 0x6b5a3a,
      outfit: 'bran_farmer',
    },
  },

  // ── 2. 이졸데 반 아커러: v0(보랏빛 견습생 복장) → v1(평상복, Saber 사복 분위기, 흑발) ──
  isolde: {
    v0: {
      tunic: 0x8a5fc2,
      quilt: 0x6a45a0,
      sleeve: 0x8a5fc2,
      straps: 0x3a2a3a,
      belt: 0x3a2a3a,
      hoseUpper: 0x3a3548,
      hoseLower: 0xd8d2c0,
      shoes: 0x4a3626,
      skin: 0xe3b98f,
      hands: 0xe3b98f,
      helmet: null,
      metal: 0xb9c0c7,
      hair: 0x3a2416,
      headband: 0x8a5fc2,
      grip: 0x2e1c12,
      hilt: 0x9aa3ad,
    },
    v1: {
      tunic: 0xe6ded0,
      quilt: 0xd8cdb8,
      sleeve: 0xe6ded0,
      straps: null,
      belt: 0x4a3c33,
      hoseUpper: 0x33363f,
      hoseLower: 0x2b2e36,
      shoes: 0x3a2f28,
      skin: 0xe3b98f,
      hands: 0xe3b98f,
      helmet: null,
      metal: 0x9aa3ad,
      hair: 0x14110f,
      headband: null,
      grip: 0x2e1c12,
      hilt: 0x9aa3ad,
      outfit: 'isolde_saber',
    },
    // v2(오너 요청): 허리까지 오는 긴 생머리. 옷·색은 v1 그대로
    v2: {
      tunic: 0xe6ded0,
      quilt: 0xd8cdb8,
      sleeve: 0xe6ded0,
      straps: null,
      belt: 0x4a3c33,
      hoseUpper: 0x33363f,
      hoseLower: 0x2b2e36,
      shoes: 0x3a2f28,
      skin: 0xe3b98f,
      hands: 0xe3b98f,
      helmet: null,
      metal: 0x9aa3ad,
      hair: 0x14110f,
      headband: null,
      grip: 0x2e1c12,
      hilt: 0x9aa3ad,
      outfit: 'isolde_longhair',
    },
  },

  // ── 3. 랴오 쓰위엔: v0(어두운 방랑 검객) → v1(방랑 낭인 — 장발+안대) ──
  liao: {
    v0: {
      tunic: 0x1f2e22,
      quilt: 0x16221a,
      sleeve: 0x1f2e22,
      straps: 0x2a1c10,
      belt: 0x2a1c10,
      hoseUpper: 0x2a2a2a,
      hoseLower: 0x3a3a3a,
      shoes: 0x1a1a1a,
      skin: 0xd8a878,
      hands: 0xd8a878,
      helmet: null,
      metal: 0x8f8a82,
      hair: 0x111111,
      headband: 0x7a1f1f,
      grip: 0x1a1208,
      hilt: 0x5a4630,
    },
    v1: {
      tunic: 0x272a22,
      quilt: 0x1c1e18,
      sleeve: 0x272a22,
      straps: 0x2a1c10,
      belt: 0x2a1c10,
      hoseUpper: 0x2a2a2a,
      hoseLower: 0x34302c,
      shoes: 0x1a1a1a,
      skin: 0xd8a878,
      hands: 0xd8a878,
      helmet: null,
      metal: 0x8f8a82,
      hair: 0x111111,
      headband: 0x3a1414,
      grip: 0x1a1208,
      hilt: 0x5a4630,
      outfit: 'liao_ronin',
    },
    // v2(오너 요청): 푸른 무도가 도복(하오마루 계열 실루엣, 새 디자인). 윗도리 파랑, 남색 하카마,
    // 흰 새끼줄 허리띠, 짚신 색 신. X자 가죽끈은 뺐다. 장발·안대는 v1 그대로
    v2: {
      tunic: 0x3a5f9e,
      quilt: 0x33558f,
      sleeve: 0x3a5f9e,
      straps: null,
      belt: 0xe8e2d0,
      hoseUpper: 0x1e2a44,
      hoseLower: 0x1e2a44,
      shoes: 0xa88f5c,
      skin: 0xd8a878,
      hands: 0xd8a878,
      helmet: null,
      metal: 0x8f8a82,
      hair: 0x111111,
      headband: 0x3a1414,
      grip: 0x1a1208,
      hilt: 0x5a4630,
      outfit: 'liao_gi',
    },
    // v3(오너 요청): 풍성한 꽁지머리 산발 + V넥 사이로 맨살. 옷·색은 v2 그대로
    v3: {
      tunic: 0x3a5f9e,
      quilt: 0x33558f,
      sleeve: 0x3a5f9e,
      straps: null,
      belt: 0xe8e2d0,
      hoseUpper: 0x1e2a44,
      hoseLower: 0x1e2a44,
      shoes: 0xa88f5c,
      skin: 0xd8a878,
      hands: 0xd8a878,
      helmet: null,
      metal: 0x8f8a82,
      hair: 0x111111,
      headband: 0x3a1414,
      grip: 0x1a1208,
      hilt: 0x5a4630,
      outfit: 'liao_gi_wild',
    },
    // v4(오너 피드백 "너무 뾰족해, 컬과 볼륨 있는 머리, V넥 안쪽에 흰 깃이 살짝 겹치게"): 둥근 곱슬 머리
    v4: {
      tunic: 0x3a5f9e,
      quilt: 0x33558f,
      sleeve: 0x3a5f9e,
      straps: null,
      belt: 0xe8e2d0,
      hoseUpper: 0x1e2a44,
      hoseLower: 0x1e2a44,
      shoes: 0xa88f5c,
      skin: 0xd8a878,
      hands: 0xd8a878,
      helmet: null,
      metal: 0x8f8a82,
      hair: 0x111111,
      headband: 0x3a1414,
      grip: 0x1a1208,
      hilt: 0x5a4630,
      outfit: 'liao_gi_curly',
    },
    // v5(오너 피드백 "v3 꽁지머리 유지, 뾰족한 부분을 양옆으로 흘러내리는 중단발 컬로"): v3 꽁지머리 + 옆머리 컬
    v5: {
      tunic: 0x3a5f9e,
      quilt: 0x33558f,
      sleeve: 0x3a5f9e,
      straps: null,
      belt: 0xe8e2d0,
      hoseUpper: 0x1e2a44,
      hoseLower: 0x1e2a44,
      shoes: 0xa88f5c,
      skin: 0xd8a878,
      hands: 0xd8a878,
      helmet: null,
      metal: 0x8f8a82,
      hair: 0x111111,
      headband: 0x3a1414,
      grip: 0x1a1208,
      hilt: 0x5a4630,
      outfit: 'liao_gi_wavy',
    },
    // v6(오너 요청 비교안, 입에 풀): 중단발 컬 — 뒤로 넘긴 웨이브
    v6: {
      tunic: 0x3a5f9e,
      quilt: 0x33558f,
      sleeve: 0x3a5f9e,
      straps: null,
      belt: 0xe8e2d0,
      hoseUpper: 0x1e2a44,
      hoseLower: 0x1e2a44,
      shoes: 0xa88f5c,
      skin: 0xd8a878,
      hands: 0xd8a878,
      helmet: null,
      metal: 0x8f8a82,
      hair: 0x111111,
      headband: 0x3a1414,
      grip: 0x1a1208,
      hilt: 0x5a4630,
      outfit: 'liao_gi_swept',
    },
    // v7(오너 요청 비교안, 입에 풀): 중단발 컬 — 반묶음
    v7: {
      tunic: 0x3a5f9e,
      quilt: 0x33558f,
      sleeve: 0x3a5f9e,
      straps: null,
      belt: 0xe8e2d0,
      hoseUpper: 0x1e2a44,
      hoseLower: 0x1e2a44,
      shoes: 0xa88f5c,
      skin: 0xd8a878,
      hands: 0xd8a878,
      helmet: null,
      metal: 0x8f8a82,
      hair: 0x111111,
      headband: 0x3a1414,
      grip: 0x1a1208,
      hilt: 0x5a4630,
      outfit: 'liao_gi_halfup',
    },
    // v8(오너 요청 비교안, 입에 풀): 중단발 컬 — 헝클어진 바람머리
    v8: {
      tunic: 0x3a5f9e,
      quilt: 0x33558f,
      sleeve: 0x3a5f9e,
      straps: null,
      belt: 0xe8e2d0,
      hoseUpper: 0x1e2a44,
      hoseLower: 0x1e2a44,
      shoes: 0xa88f5c,
      skin: 0xd8a878,
      hands: 0xd8a878,
      helmet: null,
      metal: 0x8f8a82,
      hair: 0x111111,
      headband: 0x3a1414,
      grip: 0x1a1208,
      hilt: 0x5a4630,
      outfit: 'liao_gi_tousled',
    },
  },

  // ── 4. 하인리히 도른: v0(붉은 금장 흥행 복장) → v1(은빛 중갑 기사 — 은발+짧은 은수염) ──
  heinrich: {
    v0: {
      tunic: 0xb3232f,
      quilt: 0x8a1a24,
      sleeve: 0xb3232f,
      straps: 0x2a1a10,
      belt: 0x2a1a10,
      hoseUpper: 0x1c1c1c,
      hoseLower: 0xd9c26a,
      shoes: 0x2a1a10,
      skin: 0xe0b08a,
      hands: 0xe0b08a,
      helmet: null,
      metal: 0xd8c060,
      hair: 0xc9a227,
      headband: 0xb3232f,
      grip: 0x2a1a10,
      hilt: 0xd8c060,
    },
    v1: {
      tunic: 0x2c2e33,
      quilt: 0x232529,
      sleeve: 0x2c2e33,
      straps: 0x1c1c1c,
      belt: 0x1c1c1c,
      hoseUpper: 0x24262a,
      hoseLower: 0x24262a,
      shoes: 0x1c1c1c,
      skin: 0xe0b08a,
      hands: 0xe0b08a,
      helmet: null,
      metal: 0xc7cdd3,
      hair: 0xcfd3d6,
      headband: null,
      grip: 0x2a1a10,
      hilt: 0xd0d3d6,
      outfit: 'heinrich_knight',
      // 판금이 실제로 막는다 (오너 결정 "하인리히의 판금 갑옷에도 적용해", config.js ARMOR). 부위는 outfits.js armorParts
      armor: 'plate',
    },
    // v2: v1은 판이 가슴·어깨·손목·정강이에만 있어 대결 거리에서 짙은 옷이 대부분을 차지해 은빛으로
    // 읽히지 않았다(오너 지적 "은색이 아닌 거 같다"). 팔·허벅지·무릎·발·허리 치마까지 은빛 판으로 덮고,
    // 판 밑 옷도 짙은 남색에서 밝은 강철 회색으로 올렸다
    v2: {
      tunic: 0x6e747b,
      quilt: 0x5c6168,
      sleeve: 0x6e747b,
      straps: 0x1c1c1c,
      belt: 0x1c1c1c,
      hoseUpper: 0x5c6168,
      hoseLower: 0x5c6168,
      shoes: 0x1c1c1c,
      skin: 0xe0b08a,
      hands: 0xe0b08a,
      helmet: null,
      metal: 0xc7cdd3,
      hair: 0xcfd3d6,
      headband: null,
      grip: 0x2a1a10,
      hilt: 0xd0d3d6,
      outfit: 'heinrich_full_plate',
      // 판금이 실제로 막는다 (오너 결정 "하인리히의 판금 갑옷에도 적용해", config.js ARMOR). 부위는 outfits.js armorParts
      armor: 'plate',
    },
  },

  // Native cloth outfits: each garment follows its own ragdoll part. Soft hats,
  // cords and decorative brass do not enable helmet or plate protection.
  tome: {
    v1: {
      tunic: 0x632b3c, quilt: 0x632b3c, sleeve: 0x632b3c,
      straps: null, belt: 0x35272a, hoseUpper: 0x35343b, hoseLower: 0x35343b,
      shoes: 0x302627, skin: 0xd3a484, hands: 0xd3a484,
      helmet: null, metal: 0xb7a37a, hair: 0xbec1bd, headband: null,
      grip: 0x422830, hilt: 0xb6a681, accent: 0xc1a36e,
      outfit: 'tome_rapier',
    },
    // v2 (10/10 사장님 "사서 좋고 칭호도 써. 안경도 넣어"): 볼로냐 아르키진나시오 도서관의 고문서 사서 — 사장님 08:0x '시간 초월한 설정과 칭호'(칭호 '아르키진나시오의 사서').
    //  v1 옷·얼굴 그대로 + 먹색 앞트임 학자 겉옷 · 끈 안경 · 열쇠 꾸러미·잉크통·펜 통 (outfits.js TOME_LIBRARIAN). 색 값은 v1 과 같다
    v2: {
      tunic: 0x632b3c, quilt: 0x632b3c, sleeve: 0x632b3c,
      straps: null, belt: 0x35272a, hoseUpper: 0x35343b, hoseLower: 0x35343b,
      shoes: 0x302627, skin: 0xd3a484, hands: 0xd3a484,
      helmet: null, metal: 0xb7a37a, hair: 0xbec1bd, headband: null,
      grip: 0x422830, hilt: 0xb6a681, accent: 0xc1a36e,
      outfit: 'tome_librarian',
    },
  },
  omari: {
    v1: {
      tunic: 0xe4d4b4, quilt: 0xe4d4b4, sleeve: 0xe4d4b4,
      straps: null, belt: 0x813848, hoseUpper: 0x665a4b, hoseLower: 0x3b3733,
      shoes: 0x302b27, skin: 0x71452f, hands: 0x71452f,
      helmet: null, metal: 0xb9975b, hair: 0x241d1b, headband: null,
      grip: 0x463327, hilt: 0xa88a55, accent: 0x193b4b,
      outfit: 'omari_seafarer',
    },
    // v2 (10/10 디렉터 평가·사장님 승인): 팔다리가 네모 막대처럼 뭉툭한 것만 — 둥글고 끝으로 갈수록 가는 팔다리·둥근 코 장화. 색·옷은 v1 그대로
    v2: {
      tunic: 0xe4d4b4, quilt: 0xe4d4b4, sleeve: 0xe4d4b4,
      straps: null, belt: 0x813848, hoseUpper: 0x665a4b, hoseLower: 0x3b3733,
      shoes: 0x302b27, skin: 0x71452f, hands: 0x71452f,
      helmet: null, metal: 0xb9975b, hair: 0x241d1b, headband: null,
      grip: 0x463327, hilt: 0xa88a55, accent: 0x193b4b,
      outfit: 'omari_seafarer_round',
    },
  },
  // 미나미: 샛별 저장소 인물 외형을 이름만 바꿔 가져옴 (10/10). v1 신사 옷 → v2 숲 옷 → v3 숲 옷 + 긴 양갈래 머리 → v4 하카마·다스키 → v5 무녀(흰 다스키·낮게 묶은 머리)
  minami: {
    v1: {
      tunic: 0xe9e5d5, quilt: 0xe9e5d5, sleeve: 0xe9e5d5,
      straps: null, belt: 0x9a4234, hoseUpper: 0x3b5344, hoseLower: 0x536c56,
      shoes: 0x554837, skin: 0xe2bd9d, hands: 0xe2bd9d,
      helmet: null, metal: 0xb3a07a, hair: 0x242723, headband: null,
      grip: 0x514638, hilt: 0xa39474, accent: 0x627b5c,
      outfit: 'minami_shrine',
    },
    v2: {
      tunic: 0xe9e5d5, quilt: 0xe9e5d5, sleeve: 0xe9e5d5,
      straps: null, belt: 0x9a4234, hoseUpper: 0x3b5344, hoseLower: 0x536c56,
      shoes: 0x554837, skin: 0xe2bd9d, hands: 0xe2bd9d,
      helmet: null, metal: 0xb3a07a, hair: 0x242723, headband: null,
      grip: 0x514638, hilt: 0xa39474, accent: 0x627b5c,
      outfit: 'minami_grove',
    },
    v3: {
      tunic: 0xe9e5d5, quilt: 0xe9e5d5, sleeve: 0xe9e5d5,
      straps: null, belt: 0x9a4234, hoseUpper: 0x3b5344, hoseLower: 0x536c56,
      shoes: 0x554837, skin: 0xe2bd9d, hands: 0xe2bd9d,
      helmet: null, metal: 0xb3a07a, hair: 0x242723, headband: null,
      grip: 0x514638, hilt: 0xa39474, accent: 0x627b5c,
      outfit: 'minami_grove', hairStyle: 'long-twintails',
    },
    // v4 (10/10 디렉터 평가·사장님 승인): 아래로 퍼지는 하카마(앞 칼주름, 무릎 가로줄 없음) · 네모난 일본 소매를 다스키로 걷어 묶음. 머리·얼굴은 v3 그대로
    v4: {
      tunic: 0xe9e5d5, quilt: 0xe9e5d5, sleeve: 0xe9e5d5,
      straps: null, belt: 0x9a4234, hoseUpper: 0x3f5747, hoseLower: 0x3f5747,
      shoes: 0x554837, skin: 0xe2bd9d, hands: 0xe2bd9d,
      helmet: null, metal: 0xb3a07a, hair: 0x242723, headband: null,
      grip: 0x514638, hilt: 0xa39474, accent: 0x627b5c,
      outfit: 'minami_hakama', hairStyle: 'long-twintails',
    },
    // v5 (10/10 사장님 "검객이 아니라 신녀·무녀", "이끼색 하카마는 그대로"): 흰 다스키 · 뒤로 낮게 하나로 묶은 머리(흰 종이 + 붉고 흰 끈) ·
    //  걷은 소매 끝 붉은 꿰맴 끈. 하카마·얼굴·깃·허리띠는 v4 그대로
    v5: {
      tunic: 0xe9e5d5, quilt: 0xe9e5d5, sleeve: 0xe9e5d5,
      straps: null, belt: 0x9a4234, hoseUpper: 0x3f5747, hoseLower: 0x3f5747,
      shoes: 0x554837, skin: 0xe2bd9d, hands: 0xe2bd9d,
      helmet: null, metal: 0xb3a07a, hair: 0x242723, headband: null,
      grip: 0x514638, hilt: 0xa39474, accent: 0x627b5c,
      outfit: 'minami_miko', hairStyle: 'low-tail',
    },
  },

  // ── 5. 마르그레테 슈바르츠: v0(회색 수수한 노장) → v1(먹색 판금 + 갈색 머리, 용기사 실루엣) ──
  margarethe: {
    v0: {
      tunic: 0x3a3a3f,
      quilt: 0x2a2a2f,
      sleeve: 0x3a3a3f,
      straps: 0x1a1a1a,
      belt: 0x1a1a1a,
      hoseUpper: 0x2a2a2a,
      hoseLower: 0x4a4a4a,
      shoes: 0x1a1a1a,
      skin: 0xc9a074,
      hands: 0xc9a074,
      helmet: null,
      metal: 0x9aa3ad,
      hair: 0xd8d8d8,
      grip: 0x1a1a1a,
      hilt: 0x8a8a8a,
    },
    v1: {
      tunic: 0x1b1b20,
      quilt: 0x131316,
      sleeve: 0x1b1b20,
      straps: 0x101012,
      belt: 0x101012,
      hoseUpper: 0x1e1e22,
      hoseLower: 0x24242a,
      shoes: 0x101012,
      skin: 0xc9a074,
      hands: 0xc9a074,
      helmet: null,
      metal: 0x2c2c32,
      hair: 0x4a2e18,
      grip: 0x101012,
      hilt: 0x54545c,
      accent: 0x6a1520,
      outfit: 'margarethe_dragon',
    },
    // v2(오너 요청): v1에 투구를 씌우고 머리를 더 붉게(적갈색). 투구는 outfits.js의 순수 장식이라
    // helmet은 null 그대로 — 'kettle'이 아니므로 hasHelmet(머리 방어)은 켜지지 않는다
    v2: {
      tunic: 0x1b1b20,
      quilt: 0x131316,
      sleeve: 0x1b1b20,
      straps: 0x101012,
      belt: 0x101012,
      hoseUpper: 0x1e1e22,
      hoseLower: 0x24242a,
      shoes: 0x101012,
      skin: 0xc9a074,
      hands: 0xc9a074,
      helmet: null,
      metal: 0x2c2c32,
      hair: 0x8a2e1a,
      grip: 0x101012,
      hilt: 0x54545c,
      outfit: 'margarethe_dragon_helm',
    },
    // v3(오너 요청): "동그랗지 않게 더 장식적인 투구, 삼국지 마초나 용기사처럼" — 팔각 첨탑 투구에
    // 뒤로 휘는 두 뿔·이마의 세 갈래 볏·붉은 깃털 술. 투구 말고는 v2와 같다. plume은 outfits.js에서만
    // 쓰는 깃털 술 색 — 머리보다 한 톤 짙은 진홍.
    // helmet: 'horned' — 오너 결정(투구는 실제로 막고, 닳고, 완전히 부서지면 사라진다)에 따라 투구 종류를
    // 적어 둔다. 플레이어 케틀햇('kettle')과 구분되고, 전투 쪽이 !!look.helmet으로 방어를 켠다
    // (config.js ARMOR.on 이면 fighter.js 가 막는 투구로 쓰고, 끄면 예전처럼 'kettle'만 본다)
    v3: {
      tunic: 0x1b1b20,
      quilt: 0x131316,
      sleeve: 0x1b1b20,
      straps: 0x101012,
      belt: 0x101012,
      hoseUpper: 0x1e1e22,
      hoseLower: 0x24242a,
      shoes: 0x101012,
      skin: 0xc9a074,
      hands: 0xc9a074,
      helmet: 'horned',
      metal: 0x2c2c32,
      hair: 0x8a2e1a,
      plume: 0x8e1a1a,
      grip: 0x101012,
      hilt: 0x54545c,
      outfit: 'margarethe_dragon_horned',
      // 몸통 판금(가슴판·배 판띠·갑주 치마)도 막는다 — 오너: "막았음 좋겠는데 재미 요소이니 너무 과한 어드밴티지는
      //  아니도록" (config.js ARMOR, 부위는 outfits.js armorParts). v1·v2 는 보관본이라 그대로 둔다
      armor: 'plate',
    },
  },

  // ───── 샛별 저장소에서 가져온 인물 넷 (10/10, 기준 5a4e96c) — 그쪽 최종 판을 우리 v1 로 (색 값·표시 그대로) ─────
  //  표시 칸(outfits.js polishOutfit 이 읽는다, 겉모습만): stockEyes = 눈 기본 크기 · eyeColor = 눈 색 · tailoring 'soft-shoulders' = 몸통·어깨 표면 다듬기 ·
  //   originalTorsoWidth = 몸통 폭 줄이기를 하지 않음 · stockFace = 얼굴 기본 꼴 · highWaist = 허리띠를 7 cm 올림
  // 아르토리아 — 샛별 v5 (= v2 색·artoria_silver_v2 + 다듬기·눈 표시, 5277832·c21bd19·27888f2). 판금 11 부위(가슴·배·골반·위팔·아래팔·정강이·발)
  artoria: {
    v1: {
      tunic: 0x222a32, quilt: 0x222a32, sleeve: 0x242c34,
      straps: null, belt: 0x263338, hoseUpper: 0x1a222b, hoseLower: 0x202a33,
      shoes: 0x53626c, skin: 0xe4c7ad, hands: 0xd3dce0,
      helmet: null, metal: 0xc1d0da, hair: 0xe7e9e5, headband: null,
      grip: 0x20343c, hilt: 0xc8b378, accent: 0x2c7778,
      outfit: 'artoria_silver_v2', armor: 'plate',
      tailoring: 'soft-shoulders', stockEyes: true, eyeColor: 0x418f87, originalTorsoWidth: true,
    },
    // v2 (외형 다듬기 2차 10/10, 사장님 '망토 다듬어'): 망토가 어깨를 둥글게 감싸고 아래로 퍼짐 · 앞자락 두 장이 가운데서 겹침. 색·판금·판정(armor 'plate') 그대로
    v2: {
      tunic: 0x222a32, quilt: 0x222a32, sleeve: 0x242c34,
      straps: null, belt: 0x263338, hoseUpper: 0x1a222b, hoseLower: 0x202a33,
      shoes: 0x53626c, skin: 0xe4c7ad, hands: 0xd3dce0,
      helmet: null, metal: 0xc1d0da, hair: 0xe7e9e5, headband: null,
      grip: 0x20343c, hilt: 0xc8b378, accent: 0x2c7778,
      outfit: 'artoria_silver_v3', armor: 'plate',
      tailoring: 'soft-shoulders', stockEyes: true, eyeColor: 0x418f87, originalTorsoWidth: true,
    },
    // v3 (외형 3차 10/11, 사장님 '바뀐 망토 좋은데 주름 넣어'): v2 + 망토 세로 주름 아홉(골 그늘 정점 색). 판금·판정 그대로
    v3: {
      tunic: 0x222a32, quilt: 0x222a32, sleeve: 0x242c34,
      straps: null, belt: 0x263338, hoseUpper: 0x1a222b, hoseLower: 0x202a33,
      shoes: 0x53626c, skin: 0xe4c7ad, hands: 0xd3dce0,
      helmet: null, metal: 0xc1d0da, hair: 0xe7e9e5, headband: null,
      grip: 0x20343c, hilt: 0xc8b378, accent: 0x2c7778,
      outfit: 'artoria_silver_v4', armor: 'plate',
      tailoring: 'soft-shoulders', stockEyes: true, eyeColor: 0x418f87, originalTorsoWidth: true,
    },
    // v4 (외형 4차 10/13, 사장님 '망토 주름 좀 더 넣을 수 있어?'): v3 망토 꼴 그대로 + 주름 12(큰 골 8 · 잔 골 4, 골마다 폭·깊이·길이 다름), 옷단 물결. 판금·판정 그대로
    v4: {
      tunic: 0x222a32, quilt: 0x222a32, sleeve: 0x242c34,
      straps: null, belt: 0x263338, hoseUpper: 0x1a222b, hoseLower: 0x202a33,
      shoes: 0x53626c, skin: 0xe4c7ad, hands: 0xd3dce0,
      helmet: null, metal: 0xc1d0da, hair: 0xe7e9e5, headband: null,
      grip: 0x20343c, hilt: 0xc8b378, accent: 0x2c7778,
      outfit: 'artoria_silver_v5', armor: 'plate',
      tailoring: 'soft-shoulders', stockEyes: true, eyeColor: 0x418f87, originalTorsoWidth: true,
    },
  },
  // 마야 라토르 (id samira, 10/11 00:4x·01:0x 이름 바꿈 — 전 이름 사미라 미르자, 샛별 id crown_boss) — v1 = 샛별 v8 (= v4 장밋빛 제복·높이 묶은 장밋빛 머리 + 다듬기·얼굴·허리 표시, b8b1344·df0a9d6·27888f2·4c5ce4d). 방어구 없음
  samira: {
    v1: {
      tunic: 0x922e40, quilt: 0x922e40, sleeve: 0x922e40,
      straps: null, belt: 0x40372f, hoseUpper: 0xe4e6df, hoseLower: 0xe4e6df,
      shoes: 0xe4e6df, skin: 0xb7754e, hands: 0xe4e6df,
      helmet: null, metal: 0xa7acb1, hair: 0xc78f98, headband: null,
      grip: 0x313b46, hilt: 0xb6a47e, accent: 0xe4e6df,
      outfit: 'crown_rose_uniform', armor: null,
      tailoring: 'soft-shoulders', stockEyes: true, stockFace: true, originalTorsoWidth: true, highWaist: true,
    },
    // v2 (디자인 리뷰 10/10, 사장님 '다리가 짧아 보이고 몸통이 넓적'): 앙가르카(겹여밈 긴 웃옷, 가슴 밑 띠·무릎 위 옆트임 자락) + 추리다르 + 뾰족 장화.
    //  허리선을 가슴 밑(1.20 m)으로 올리고, 무릎 아래는 바지·장화가 거의 한 색. 색: 장밋빛 그대로 + 가라앉은 금빛 단 + 짙은 자두색 띠·다리. 머리·얼굴은 v1 그대로.
    //  손은 흰 장갑 대신 맨손(제복 느낌을 덜고 옷과 맞춤). 방어구 없음(v1 과 같음). 옷 모듈 src/outfit_samira.js
    v2: {
      tunic: 0x922e40, quilt: 0x922e40, sleeve: 0x922e40,
      straps: null, belt: 0x33232c, hoseUpper: 0x2c2530, hoseLower: 0x2c2530,
      shoes: 0x231d25, skin: 0xb7754e, hands: 0xb7754e,
      helmet: null, metal: 0xa7acb1, hair: 0xc78f98, headband: null,
      grip: 0x313b46, hilt: 0xb6a47e, accent: 0xb39a5f,
      outfit: 'samira_angarkha', armor: null,
      stockEyes: true, stockFace: true,
    },
    // v3 (외형 다듬기 2차 10/10, 사장님 '빨강 단일톤 — 흰 악세서리나 디테일로 포인트, 치마는 조금 더 짧게'): 왼어깨 흰 두파타 · 흰 선 깃 · 옷단 위 흰 수 띠 ·
    //  소매 끝 흰 띠 · 흰 팔찌 둘 · 진주 귀걸이 (흰색 0xefece4) · 자락 5 cm 짧게(옷단 0.635 m). 다리·색·머리는 v2 그대로
    v3: {
      tunic: 0x922e40, quilt: 0x922e40, sleeve: 0x922e40,
      straps: null, belt: 0x33232c, hoseUpper: 0x2c2530, hoseLower: 0x2c2530,
      shoes: 0x231d25, skin: 0xb7754e, hands: 0xb7754e,
      helmet: null, metal: 0xa7acb1, hair: 0xc78f98, headband: null,
      grip: 0x313b46, hilt: 0xb6a47e, accent: 0xefece4,
      outfit: 'samira_angarkha_v3', armor: null,
      stockEyes: true, stockFace: true,
    },
    // v4 (외형 3차 10/11, 사장님 '상체를 슬림하게 해선지 종종 팔이 상체와 떨어져 움직여'): v3 + 가슴 위끝 폭 되돌림(허리 가늘기 그대로) · 어깨 관절 자리 둥근 어깨 · 소매 v1 굵기
    v4: {
      tunic: 0x922e40, quilt: 0x922e40, sleeve: 0x922e40,
      straps: null, belt: 0x33232c, hoseUpper: 0x2c2530, hoseLower: 0x2c2530,
      shoes: 0x231d25, skin: 0xb7754e, hands: 0xb7754e,
      helmet: null, metal: 0xa7acb1, hair: 0xc78f98, headband: null,
      grip: 0x313b46, hilt: 0xb6a47e, accent: 0xefece4,
      outfit: 'samira_angarkha_v4', armor: null,
      stockEyes: true, stockFace: true,
    },
  },
  // 김씨 (샛별 id renji) — 샛별 v2 (= v1, 27888f2·4c5ce4d·dcad882): 삿갓·여행자 옷·짚신. 삿갓만 아주 약한 투구
  renji: {
    v1: {
      tunic: 0x242329, quilt: 0x29262d, sleeve: 0x242329, straps: null,
      belt: 0x65408a, hoseUpper: 0x202537, hoseLower: 0x202537, shoes: 0x27222b,
      skin: 0xd7b995, hands: 0xd7b995, helmet: 'kasa', metal: 0x777178, hair: 0x241d16, // helmet 'kasa': 삿갓이 아주 약한 투구 (사장님 지시 10/10 20:0x, config.js ARMOR.helmets.kasa) — 샛별은 null(장식)
      headband: null, grip: 0x33252d, hilt: 0x8b7872, accent: 0x65408a,
      outfit: 'renji_wanderer', armor: null, stockEyes: true,
    },
    // v2 (외형 다듬기 2차 10/10, 사장님 '보라 허리띠와 머플러는 그대로, 가장 왜색이 짙은 곳만 원포인트로 — 고려 방랑 무사 쪽으로 · 먹빛 아주 조금만 밝혀'):
    //  하카마 → 통 넉넉한 바지(0x283044) + 정강이 행전(무명 0xa39a88). 웃옷 먹빛 0x17191e → 0x20232a. 보라 띠·목 천·삿갓(helmet 'kasa' 판정 그대로)·봇짐·짚신·소매·칼 그대로.
    //  옷 모듈 src/outfit_renji_baji.js
    v2: {
      tunic: 0x20232a, quilt: 0x2a2930, sleeve: 0x20232a, straps: null,
      belt: 0x65408a, hoseUpper: 0x283044, hoseLower: 0x283044, shoes: 0x27222b,
      skin: 0xd7b995, hands: 0xd7b995, helmet: 'kasa', metal: 0x777178, hair: 0x241d16,
      headband: null, grip: 0x33252d, hilt: 0x8b7872, accent: 0x65408a,
      outfit: 'renji_baji', armor: null, stockEyes: true,
    },
    // v3 (외형 3차 10/11, 사장님 '김씨 원래가 낫다. 이전 턴의 모습에 칼만 흰 천으로 감싸. 밝힌 먹빛은 유지'): v1 옷(하카마·넓은 소매) + v2 의 밝힌 먹빛(0x20232a) +
    //  허리 칼을 바랜 흰 무명(0xd6cfbf)으로 싸서 끈(0x3f362c)·매듭 셋. 바지·행전 판은 ?look=renji:v2 로만. 삿갓 helmet 'kasa' 판정 그대로
    v3: {
      tunic: 0x20232a, quilt: 0x2a2930, sleeve: 0x20232a, straps: null,
      belt: 0x65408a, hoseUpper: 0x202537, hoseLower: 0x202537, shoes: 0x27222b,
      skin: 0xd7b995, hands: 0xd7b995, helmet: 'kasa', metal: 0x777178, hair: 0x241d16,
      headband: null, grip: 0x33252d, hilt: 0x8b7872, accent: 0x65408a,
      outfit: 'renji_wrapped_sword', armor: null, stockEyes: true,
    },
  },
  // 투야나 니콜라예바 (id eira, 전 이름 에이라 린드) — v1 = 샛별 v1 (27888f2): 남색 겨울 사제복·흰 깃·은빛 머리. 방어구 없음
  eira: {
    v1: {
      tunic: 0x252e44, quilt: 0x293249, sleeve: 0x252e44, straps: null,
      belt: 0x292c35, hoseUpper: 0xc3c4c8, hoseLower: 0x252630, shoes: 0x252630,
      skin: 0xe5cbb9, hands: 0xe5cbb9, helmet: null, metal: 0xa7a7af, hair: 0xc4d6e8,
      headband: null, grip: 0x333342, hilt: 0xa7a7af, accent: 0xe4e5e9,
      outfit: 'eira_winter_priest', armor: null, stockEyes: true,
    },
    // v2 (디자인 리뷰 10/10, 사장님 '사제복에 디테일이 너무 없어서 뭔지 모르겠어' + 사장님 그림(모티브)): 발목까지 A 자 남색 사제복 · 앞 트임 흰 속치마 ·
    //  흰 어깨 망토 + 높은 흰 깃 + 검은 리본 · 접은 흰 소매 끝 · 손목 붕대 · 끈 장화 · 물결치는 긴 은발 · 금빛 눈. 방어구 없음(v1 과 같음). 옷 모듈 src/outfit_tuyana.js
    v2: {
      tunic: 0x222c48, quilt: 0x222c48, sleeve: 0x222c48, straps: null,
      belt: 0x222c48, hoseUpper: 0x222c48, hoseLower: 0x222c48, shoes: 0x1b1c22,
      skin: 0xe9d3c5, hands: 0xe9d3c5, helmet: null, metal: 0xa7a7af, hair: 0xc9cbe0,
      headband: null, grip: 0x333342, hilt: 0xa7a7af, accent: 0xf1f0ec,
      outfit: 'tuyana_winter_priest', armor: null, stockEyes: true, eyeColor: 0x4a3518,
    },
    // v3 (외형 다듬기 2차 10/10, 사장님 '왼손에 묵주 같은 걸'): v2 + 왼손목(빈손)에 정교회 기도 매듭줄(추트키 — 검은 털실 매듭 고리·작은 은빛 십자가·검은 술). 겉모습만
    v3: {
      tunic: 0x222c48, quilt: 0x222c48, sleeve: 0x222c48, straps: null,
      belt: 0x222c48, hoseUpper: 0x222c48, hoseLower: 0x222c48, shoes: 0x1b1c22,
      skin: 0xe9d3c5, hands: 0xe9d3c5, helmet: null, metal: 0xa7a7af, hair: 0xc9cbe0,
      headband: null, grip: 0x333342, hilt: 0xa7a7af, accent: 0xf1f0ec,
      outfit: 'tuyana_winter_priest_chotki', armor: null, stockEyes: true, eyeColor: 0x4a3518,
    },
    // v4 (외형 3차 10/11, 사장님 '묵주가 잘 안보여. 들지 말고 긴 묵주를 손목에 감아 늘어뜨리게, 살짝 달랑거리게'): 손목 두 바퀴 + 늘어진 긴 고리(약 27 cm, 두 마디 진자로 흔들림)
    v4: {
      tunic: 0x222c48, quilt: 0x222c48, sleeve: 0x222c48, straps: null,
      belt: 0x222c48, hoseUpper: 0x222c48, hoseLower: 0x222c48, shoes: 0x1b1c22,
      skin: 0xe9d3c5, hands: 0xe9d3c5, helmet: null, metal: 0xa7a7af, hair: 0xc9cbe0,
      headband: null, grip: 0x333342, hilt: 0xa7a7af, accent: 0xf1f0ec,
      outfit: 'tuyana_winter_priest_dangle', armor: null, stockEyes: true, eyeColor: 0x4a3518,
    },
    // v5 (10/11 01:4x, 사장님 '투야나 매듭 굵기 키워'): v4 + 매듭 지름 2.0 cm · 줄·십자가·술 함께 키움 (흔들림 그대로)
    v5: {
      tunic: 0x222c48, quilt: 0x222c48, sleeve: 0x222c48, straps: null,
      belt: 0x222c48, hoseUpper: 0x222c48, hoseLower: 0x222c48, shoes: 0x1b1c22,
      skin: 0xe9d3c5, hands: 0xe9d3c5, helmet: null, metal: 0xa7a7af, hair: 0xc9cbe0,
      headband: null, grip: 0x333342, hilt: 0xa7a7af, accent: 0xf1f0ec,
      outfit: 'tuyana_winter_priest_thick', armor: null, stockEyes: true, eyeColor: 0x4a3518,
    },
  },
  // 라트나 위라세타쿤 (여정 밖 인물 — characters.js CHARACTER_GUESTS, 10/14) — 샛별 저장소 LOOK_ARCHIVE.ratna v1~v3 (d5b3151a · bf202a00 · ed736cf5, 값 그대로) + 우리 v4.
  //  복식 모듈 하나(outfits.js ratna_ferryman = src/outfit_ratna.js)가 ratnaRevision 으로 판을 가른다. 방어구 없음
  ratna: {
    // v1 (샛별 d5b3151a): 청록 바지 · 회색 덩어리 머리 · 나무 노 · 수심추 · 방수 지도
    v1: {
      tunic: 0xded2b4, quilt: 0xb9a98a, sleeve: 0xa87350, straps: null,
      belt: 0x884936, hoseUpper: 0x264e4d, hoseLower: 0xa87350, shoes: 0x45362b,
      skin: 0xa87350, hands: 0xa87350, helmet: null, metal: 0xa18a53, hair: 0x34342f,
      headband: null, grip: 0x493326, hilt: 0xa18a53, accent: 0x884936,
      outfit: 'ratna_ferryman', armor: null, stockEyes: true, eyeColor: 0x302019,
      originalTorsoWidth: true,
    },
  },
};
// 샛별 v2 (bf202a00): 왼 어깨 원숭이 · 가는 새치 · 밝은 황토 무릎바지 · 갈대·나무 밑창 신발 / v3 (ed736cf5): 솟은 나선 곱슬 · 원숭이를 목 쪽으로 3 cm
LOOK_ARCHIVE.ratna.v2 = {
  ...LOOK_ARCHIVE.ratna.v1,
  hoseUpper: 0xc29b45, trouserSeam: 0x9d7936, shoes: 0xb8a071,
  hair: 0x302e28, ratnaRevision: 2,
};
LOOK_ARCHIVE.ratna.v3 = { ...LOOK_ARCHIVE.ratna.v2, ratnaRevision: 3 };
// v4 (우리 판, 사장님 승인 감독 디자인 수정 10/14 02:3x·03:0x — docs/import/ratna_port_2026-10-14.md): 머리 꼴·새치는 v3 그대로 ·
//  등의 노 뺌 · 수염 잔 곱슬 매듭 · 무릎 다듬음 (모듈 쪽) ·
//  바지 채도 한 단계 낮추고 곰 석상 가슴 무늬 주황금(#D98A3A) 계열로: 0xc29b45(색상 41° · 채도 0.51 · L* 66) → 0xb68854(32° · 0.40 · L* 60), 솔기 0x9d7936 → 0x8d673f ·
//  얼굴만 은은하게: faceSkin 0xb48362(바탕 L* 53 → 59 — 목·팔·다리 살 0xa87350 그대로) + 같은 색 제빛 faceGlow 0.18 ·
//  원숭이 자리 ratnaMonkey 'bag' = 등 가방 위 왼쪽(어깨 위는 칼·팔과 겹침 — outfit_ratna.js MONKEY_SEATS · 가방 BAG) — 값 모두 사장님 확인 전(확인표 1200~)
LOOK_ARCHIVE.ratna.v4 = {
  ...LOOK_ARCHIVE.ratna.v3,
  hoseUpper: 0xb68854, trouserSeam: 0x8d673f, faceSkin: 0xb48362, faceGlow: 0.18, ratnaMonkey: 'bag', ratnaRevision: 4,
};

// 다라이시 (여정 밖 인물 — characters.js CHARACTER_GUESTS, 10/14) — 샛별 저장소 LOOK_ARCHIVE.silver_wanderer v1·v2·v4·v5·v6 (origin/main db729604, 값 그대로).
//  v3(상업 게임 인물을 참고한 머리 — 샛별 쪽에서도 미채택)는 옮기지 않았다(리뷰 4차 §출처). 복식 모듈: outfits.js silver_wanderer(v1) · silver_wanderer_detail(v2~).
//  v1 첫 시안 → v2 장식 → v4 원래 긴 머리 숱 보강 → v5 반묶음 → v6 땋음·자락 다듬기. 방어구·투구 없음
LOOK_ARCHIVE.silver_wanderer = { v1: {
  tunic: 0xe9e9e5, quilt: 0xe9e9e5, sleeve: 0xe9e9e5, straps: null,
  belt: 0x413039, hoseUpper: 0xe9e9e5, hoseLower: 0xe9e9e5, shoes: 0x9b9fa8,
  skin: 0xe0bf9f, hands: 0xe0bf9f, helmet: null, metal: 0xb6bbc3, hair: 0x77737f,
  headband: null, grip: 0x403038, hilt: 0xa88b45, accent: 0x433653,
  outfit: 'silver_wanderer', armor: null, stockEyes: true,
} };
LOOK_ARCHIVE.silver_wanderer.v2 = { ...LOOK_ARCHIVE.silver_wanderer.v1, outfit: 'silver_wanderer_detail' };
LOOK_ARCHIVE.silver_wanderer.v4 = { ...LOOK_ARCHIVE.silver_wanderer.v2, hairStyle: 'full_layered' };
LOOK_ARCHIVE.silver_wanderer.v5 = { ...LOOK_ARCHIVE.silver_wanderer.v4, hairStyle: 'court_half_tie' };
LOOK_ARCHIVE.silver_wanderer.v6 = { ...LOOK_ARCHIVE.silver_wanderer.v5, hairStyle: 'court_braided_layers' };
// v7 (우리 판 — 사장님 10/14 08:1x '폰에서 안 보이는 1~2 mm 문양은 빼고 실루엣은 유지 · 땋은 머리는 마디가 보이게(머리와 명도 차) · 인물 삼각형을 우리 인물 최대 안팎으로',
//  docs/import/salt_desert_port_2026-10-14.md): v6 실루엣(보라 깃·짧은 어깨 망토·흰 셔츠·보라 갈라진 자락·흰 바지·은 각반·긴 은발·땋음) 그대로 ·
//  잔선(덩굴·잎·박음질·가는 테·고리 줄) 뺌 — 어깨 원판의 팔각 꽃·허리 띠의 팔각 꽃만 · 땋음은 마디 땋음(머리보다 밝은 은빛) · 머리 층 칸 줄임 ·
//  빈 검집 0.66 → 0.94 m · 부위마다 같은 재질 합침. 모듈 쪽 '── v7' 줄(daraishiRevision 7). 값 모두 사장님 확인 전(확인표 1219~1221)
// 10/15 (사장님 23:1x 'v7이 제일 예쁜 거 같애. 되돌려.' — 지금 쓰는 판 v10 → v7): 빈 검집만 v8 자리(daraishiScabbard 8 — 입을 바깥으로 1.2 cm · 입을 축으로 0.12 rad).
//  v7 자리면 왼다리 자락 바깥 겉면에 걸쳐 검집 축이 자락을 지나는 표본 14.5 % → v8 자리 1.3 % (5c5ab01 과 같은 셈, 10/14 v10 감독 결정과 같게). 나머지는 v7 그대로 (확인표 1811)
LOOK_ARCHIVE.silver_wanderer.v7 = { ...LOOK_ARCHIVE.silver_wanderer.v6, daraishiRevision: 7, daraishiScabbard: 8 };
// v8 (우리 판 — 사장님 10/14 12:2x '조금만 더 페르시안 귀족의 전통 · 하의 길이나 겹침이 애매'): v7 위에 카바(outfit_silver_wanderer_qaba.js) —
//  흰 긴 겉옷이 가슴부터 종아리 중간(0.30 m)까지 한 벌 · 왼쪽 자락이 오른쪽으로 건너 여미는 앞섶 테 · 캄마르반드(천 띠 + 매듭 + 늘어진 끝) · 양옆 트임 ·
//  보랏빛 회색 바지가 가죽 장화로 · 은 각반과 갈라진 보라 자락은 없앰 · 검집은 자락 밖으로 0.08 rad. 값 모두 사장님 확인 전(확인표 1226~1234)
LOOK_ARCHIVE.silver_wanderer.v8 = { ...LOOK_ARCHIVE.silver_wanderer.v7, daraishiRevision: 8 };
// v9 (우리 판 — 사장님 10/14 13:4x '원래가 더 보랏빛도 많고 장식적이고 아름다운 거 같애 · 현재와 원래의 절충점 · 복식 고증에 집착할 필요 없어'):
//  v8 카바의 한 벌 꼴(앞섶 선 · 종아리 중간 옷단 · 옆트임 · 캄마르반드)은 그대로 두고, 겉감·자락·위 소매를 보라로(흰색은 안옷 — 가슴 V · 아래 소매 · 바지),
//  테는 금빛 선 두 줄 사이 짙은 보라 띠 + 옷단 띠 위 덩굴 물결·팔각 꽃·마름모 · 망토 단·깃 금빛 띠 · 허리 띠 금빛 가장자리 · 장화 목 금빛 고리
//  (outfit_silver_wanderer_v9.js). 값 모두 사장님 확인 전(확인표 1320~)
LOOK_ARCHIVE.silver_wanderer.v9 = { ...LOOK_ARCHIVE.silver_wanderer.v8, daraishiRevision: 9 };
// v10 (우리 판 — 사장님 10/14 18:4x 'v7이 제일 나은 거 같다. v7로 되돌리되, 허리띠 아래로 보라색 천 부분만 v9을 이식해(벌어진 넓이는 그대로 유지하고 v9의 길이와 장식 등의 디테일 적용)'):
//  v7 그대로(daraishiRevision 7 — 머리·얼굴·흰 윗옷·소매·망토·허리띠·흰 바지·은 각반·신 · 빈 검집만 v8 자리, 감독 결정 10/14) + 허리띠 아래 보라 자락만 바꿔 끼우는 표시 daraishiLower 10 —
//  엉덩이 자락과 다리 바깥 자락은 v7 의 자리·벌어짐 그대로, 길이는 v9(옷단 0.30 m, 좌우 같게), 겉감 #66528A · 옷단 테 · 앞섶 테 · 트임 테 · 문양은 v9
//  (outfit_silver_wanderer_v10.js). 값 모두 사장님 확인 전(확인표 1360~)
LOOK_ARCHIVE.silver_wanderer.v10 = { ...LOOK_ARCHIVE.silver_wanderer.v7, daraishiLower: 10 };
// Owner 10/16: tailor the base V7 shirt and add one loose fringe first;
// the alter keeps its previously reviewed V7 appearance until a later step.
LOOK_ARCHIVE.silver_wanderer['v7-front1'] = { ...LOOK_ARCHIVE.silver_wanderer.v7, daraishiFront: 1 };
LOOK_ARCHIVE.silver_wanderer['v7-front2'] = { ...LOOK_ARCHIVE.silver_wanderer['v7-front1'], daraishiFront: 2 };
LOOK_ARCHIVE.silver_wanderer['v7-front3'] = {
  ...LOOK_ARCHIVE.silver_wanderer['v7-front2'], hair: 0x76d1c5,
  hairPalette: {soft:0x8bded1,braid:0xa9ecdf,glint:0xb4eee3}, daraishiScabbardInset:.008,
};
// Emerald was rejected. Keep the approved shape and 8 mm scabbard adjustment;
// the three nearby silver palettes remain explicit previews until selected.
LOOK_ARCHIVE.silver_wanderer['v7-front4'] = {
  ...LOOK_ARCHIVE.silver_wanderer['v7-front2'], daraishiScabbardInset:.008,daraishiNeck:1,
};
LOOK_ARCHIVE.silver_wanderer['v7-silver-a'] = {
  ...LOOK_ARCHIVE.silver_wanderer['v7-front4'],hair:0x94919b,
  hairPalette:{soft:0xaaa7b1,braid:0xcbc8d1,glint:0xbdbac4},
};
LOOK_ARCHIVE.silver_wanderer['v7-silver-b'] = {
  ...LOOK_ARCHIVE.silver_wanderer['v7-front4'],hair:0x7f899b,
  hairPalette:{soft:0x959fb0,braid:0xb8c2d0,glint:0xacb7ca},
};
LOOK_ARCHIVE.silver_wanderer['v7-silver-c'] = {
  ...LOOK_ARCHIVE.silver_wanderer['v7-front4'],hair:0x93877e,
  hairPalette:{soft:0xaa9e93,braid:0xc9c0b3,glint:0xbcb2a6},
};

// 찬다 (여정 밖 인물 — characters.js CHARACTER_GUESTS, 10/14) — 샛별 저장소 LOOK_ARCHIVE.chanda v1 (675233e2 · origin/main 7684c732, 값 그대로) + 우리 v2.
//  복식 모듈 하나(outfits.js chanda_watergate = src/outfit_chanda.js)가 chandaRevision 으로 판을 가른다. 방어구·투구 없음
LOOK_ARCHIVE.chanda = { v1: {
  tunic: 0x252c4b, quilt: 0x414967, sleeve: 0xa96f4e, straps: null,
  belt: 0x978360, hoseUpper: 0x353d50, hoseLower: 0xb0a58a, shoes: 0x43372d,
  skin: 0xa96f4e, hands: 0xa96f4e, helmet: null, metal: 0x93805a, hair: 0x161714,
  headband: null, grip: 0x49392a, hilt: 0x93805a, accent: 0xb49354,
  outfit: 'chanda_watergate', armor: null, stockEyes: true, eyeColor: 0x322019,
  originalTorsoWidth: true,
} };
// v2 (우리 판 — 사장님 결정 10/14 '앞에서 보이는 무릎의 맨다리 틈을 고친다', docs/import/chanda_terra_port_2026-10-14.md §1-2):
//  무릎을 굽히면 넓적다리 바짓단과 정강이 바짓단 사이로 정강이 살(구릿빛 캡슐 윗머리)이 앞으로 드러나던 틈을 바지 천으로 메움 — 모듈 쪽 '── v2' 줄. 색·나머지는 v1 그대로 (값 사장님 확인 전 — 확인표 1406)
LOOK_ARCHIVE.chanda.v2 = { ...LOOK_ARCHIVE.chanda.v1, chandaRevision: 2 };

// 병마용 (여정 밖 인물 — characters.js CHARACTER_GUESTS, 10/14) — 샛별 저장소 LOOK_ARCHIVE.terracotta v1 (b090ccc5 · origin/main 7684c732, 값 그대로) + 우리 v2.
//  복식 모듈 하나(outfits.js terracotta_guard = src/outfit_terracotta.js)가 terracottaRevision 으로 판을 가른다. 흙 갑옷 조각은 장식(판금 판정 없음)
LOOK_ARCHIVE.terracotta = { v1: {
  tunic: 0x929084, quilt: 0x7c7b70, sleeve: 0xa4a094, straps: null,
  belt: 0x929084, hoseUpper: 0xa4a094, hoseLower: 0xa4a094, shoes: 0x7c7b70,
  skin: 0xa4a094, hands: 0xa4a094, helmet: null, metal: 0x929084, hair: 0x73756d,
  headband: null, grip: 0x493829, hilt: 0x9c8554, accent: 0xa6a193,
  outfit: 'terracotta_guard', armor: null, stockEyes: true, eyeColor: 0x4b4741,
  originalTorsoWidth: true,
} };
// v2 (우리 판 — 사장님 결정 10/14 '끈·머리 홈 같은 잔선을 덜어 ≤ 2.7 만 삼각형(칼 포함)'): 폰 1 화소 안의 관(엮은 끈 반지름 1.4 mm · 머리 홈 1.2 mm · 얼굴 잔금 · 소매·옷 솔기)을 뺌 —
//  갑옷 조각·상투·관·눈썹·수염 덩어리·다리 감은 천 같은 큰 꼴은 그대로. 모듈 쪽 '── v2' 줄 (값 사장님 확인 전 — 확인표 1416~1417)
LOOK_ARCHIVE.terracotta.v2 = { ...LOOK_ARCHIVE.terracotta.v1, terracottaRevision: 2 };

// 지금 게임에서 실제로 쓰는 버전 (감독/오너가 확정하면 여기만 바꾸면 됨)
export const CHARACTER_LOOK_VERSION = {
  bran: 'v1',
  isolde: 'v2',
  liao: 'v6',
  heinrich: 'v2',
  margarethe: 'v3',
  tome: 'v2',
  omari: 'v2',
  minami: 'v5',
  artoria: 'v4', // 외형 4차 10/13 망토 주름 — 옛 판 ?look=artoria:v3 · v2 · v1
  samira: 'v4', // 외형 3차 10/11 (이름 마야 라토르) — 옛 판 ?look=samira:v3 · v2 · v1
  renji: 'v3', // 외형 3차 10/11 — 옛 판 ?look=renji:v2(바지·행전) · v1
  eira: 'v5', // 10/11 01:4x 매듭 굵게 — 옛 판 ?look=eira:v4 · v3 · v2 · v1
  ratna: 'v4', // 10/14 여정 밖 인물 (우리 v4) — 샛별 판 ?look=ratna:v3 · v2 · v1
  silver_wanderer: 'v7-front4', // 원래 은회색 복귀/목 틈 수정/칼집8mm 유지. 색 후보 :v7-silver-a/b/c 는 선택 전 미리보기.
  chanda: 'v2', // 10/14 여정 밖 인물 찬다 (우리 v2 — 무릎 틈 메움) — 샛별 판 ?look=chanda:v1
  terracotta: 'v2', // 10/14 여정 밖 인물 병마용 (우리 v2 — 잔선 덜기) — 샛별 판 ?look=terracotta:v1
};

/** id의 특정 버전을 꺼낸다. 버전이 없으면 현재 버전 → v0 순으로 물러난다. (main.js의 ?look=, ?lookv= 미리보기용) */
export function getLook(id, version) {
  const archive = LOOK_ARCHIVE[id];
  if (!archive) return null;
  const fallback = CHARACTER_LOOK_VERSION[id] || 'v0';
  return archive[version] ?? archive[fallback] ?? archive.v0 ?? null;
}

/** id가 가진 버전 이름 목록 (오래된 것부터). docs/character_looks.md, 미리보기 검증용 */
export function lookVersionsOf(id) {
  const archive = LOOK_ARCHIVE[id];
  return archive ? Object.keys(archive).sort() : [];
}

// 예전 코드가 쓰던 자리 그대로 (player·enemy 기본 외형). 캐릭터별 look은 이제 characters.js가
// getLook()으로 직접 가져온다.
export const LOOKS = {
  player: LOOK_ARCHIVE.player.v0,
  enemy: LOOK_ARCHIVE.enemy.v0,
};

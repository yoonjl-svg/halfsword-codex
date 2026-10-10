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
    // v3: the same adult body and waist-length black hair, with shaped locks,
    // a folded blouse collar, gathered cuffs and a divided pleated skirt.
    v3: {
      tunic: 0xe6ded0, quilt: 0xd8cdb8, sleeve: 0xe6ded0,
      straps: null, belt: 0x363844, hoseUpper: 0x33363f, hoseLower: 0x2b2e36,
      shoes: 0x3a2f28, skin: 0xe3b98f, hands: 0xe3b98f,
      helmet: null, metal: 0x9aa3ad, hair: 0x191820, headband: null,
      grip: 0x2e1c12, hilt: 0x9aa3ad, outfit: 'isolde_tailored',
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
  },
  // 영만 is the user-confirmed name; nineteen-year-old adult proportions stay native.
  yeongman: {
    v1: {
      tunic: 0xe9e5d5, quilt: 0xe9e5d5, sleeve: 0xe9e5d5,
      straps: null, belt: 0x9a4234, hoseUpper: 0x3b5344, hoseLower: 0x536c56,
      shoes: 0x554837, skin: 0xe2bd9d, hands: 0xe2bd9d,
      helmet: null, metal: 0xb3a07a, hair: 0x242723, headband: null,
      grip: 0x514638, hilt: 0xa39474, accent: 0x627b5c,
      outfit: 'yeongman_shrine',
    },
    v2: {
      tunic: 0xe9e5d5, quilt: 0xe9e5d5, sleeve: 0xe9e5d5,
      straps: null, belt: 0x9a4234, hoseUpper: 0x3b5344, hoseLower: 0x536c56,
      shoes: 0x554837, skin: 0xe2bd9d, hands: 0xe2bd9d,
      helmet: null, metal: 0xb3a07a, hair: 0x242723, headband: null,
      grip: 0x514638, hilt: 0xa39474, accent: 0x627b5c,
      outfit: 'yeongman_grove',
    },
    v3: {
      tunic: 0xe9e5d5, quilt: 0xe9e5d5, sleeve: 0xe9e5d5,
      straps: null, belt: 0x9a4234, hoseUpper: 0x3b5344, hoseLower: 0x536c56,
      shoes: 0x554837, skin: 0xe2bd9d, hands: 0xe2bd9d,
      helmet: null, metal: 0xb3a07a, hair: 0x242723, headband: null,
      grip: 0x514638, hilt: 0xa39474, accent: 0x627b5c,
      outfit: 'yeongman_grove', hairStyle: 'long-twintails',
    },
  },

  crown_boss: {
    v1: {
      tunic: 0x26262b, quilt: 0x26262b, sleeve: 0x25252c,
      straps: null, belt: 0x34333b, hoseUpper: 0x202129, hoseLower: 0x242630,
      shoes: 0x666a73, skin: 0xe2c5b0, hands: 0x959aa3,
      helmet: 'crown', metal: 0x62646c, hair: 0xd6b96f, headband: null,
      grip: 0x292631, hilt: 0xb89c54, accent: 0xe5dfca,
      outfit: 'crown_sovereign', armor: 'plate',
    },
    v2: {
      tunic: 0x25272d, quilt: 0x25272d, sleeve: 0x24262b,
      straps: null, belt: 0x303238, hoseUpper: 0x22242a, hoseLower: 0x24262c,
      shoes: 0x303238, skin: 0xe2c5b0, hands: 0x888e96,
      helmet: 'crown', metal: 0x41454c, hair: 0xd6b96f, headband: null,
      grip: 0x292631, hilt: 0xb89c54, accent: 0xfaf9f5,
      outfit: 'crown_sovereign_light', armor: 'plate',
    },
    v3: {
      tunic: 0x285f8e, quilt: 0x285f8e, sleeve: 0x285f8e,
      straps: null, belt: 0x40372f, hoseUpper: 0xe4e6df, hoseLower: 0xe4e6df,
      shoes: 0xe4e6df, skin: 0xb7754e, hands: 0xe4e6df,
      helmet: null, metal: 0xa7acb1, hair: 0x2d211d, headband: null,
      grip: 0x313b46, hilt: 0xb6a47e, accent: 0xe4e6df,
      outfit: 'crown_blue_uniform', armor: null,
    },
    v4: {
      tunic: 0x922e40, quilt: 0x922e40, sleeve: 0x922e40,
      straps: null, belt: 0x40372f, hoseUpper: 0xe4e6df, hoseLower: 0xe4e6df,
      shoes: 0xe4e6df, skin: 0xb7754e, hands: 0xe4e6df,
      helmet: null, metal: 0xa7acb1, hair: 0xc78f98, headband: null,
      grip: 0x313b46, hilt: 0xb6a47e, accent: 0xe4e6df,
      outfit: 'crown_rose_uniform', armor: null,
    },
  },
  // 아르토리아: 원본 판금과 경기 카메라용으로 다듬은 외형을 함께 보존한다.
  artoria: {
    v1: {
      tunic: 0x222a32, quilt: 0x222a32, sleeve: 0x242c34,
      straps: null, belt: 0x263338, hoseUpper: 0x1a222b, hoseLower: 0x202a33,
      shoes: 0x53626c, skin: 0xe4c7ad, hands: 0xb9c8d1,
      helmet: null, metal: 0xc1d0da, hair: 0xe7e9e5, headband: null,
      grip: 0x20343c, hilt: 0xc8b378, accent: 0x2c7778,
      outfit: 'artoria_silver', armor: 'plate',
    },
    v2: {
      tunic: 0x222a32, quilt: 0x222a32, sleeve: 0x242c34,
      straps: null, belt: 0x263338, hoseUpper: 0x1a222b, hoseLower: 0x202a33,
      shoes: 0x53626c, skin: 0xe4c7ad, hands: 0xd3dce0,
      helmet: null, metal: 0xc1d0da, hair: 0xe7e9e5, headband: null,
      grip: 0x20343c, hilt: 0xc8b378, accent: 0x2c7778,
      outfit: 'artoria_silver_v2', armor: 'plate',
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
};

// Preserve each accepted outfit and its old preview; tailoring only changes its
// rendered surface. In particular Isolde still derives from v2, not rejected v3.
for (const [id, source, version] of [
  ['isolde', 'v2', 'v4'], ['yeongman', 'v3', 'v4'],
  ['artoria', 'v2', 'v3'], ['margarethe', 'v3', 'v4'], ['crown_boss', 'v4', 'v5'],
]) LOOK_ARCHIVE[id][version] = { ...LOOK_ARCHIVE[id][source], tailoring: 'soft-shoulders', stockEyes: true };
LOOK_ARCHIVE.crown_boss.v6 = { ...LOOK_ARCHIVE.crown_boss.v5, stockFace: true };
LOOK_ARCHIVE.artoria.v4 = { ...LOOK_ARCHIVE.artoria.v3, eyeColor: 0x418f87 };

// 10/10 user rollback: original chest and waist width; keep approved face/eye fixes.
for (const [id, source, version] of [
  ['isolde', 'v4', 'v5'], ['yeongman', 'v4', 'v5'], ['artoria', 'v4', 'v5'],
  ['margarethe', 'v4', 'v5'], ['crown_boss', 'v6', 'v7'],
]) LOOK_ARCHIVE[id][version] = { ...LOOK_ARCHIVE[id][source], originalTorsoWidth: true };
LOOK_ARCHIVE.crown_boss.v8 = { ...LOOK_ARCHIVE.crown_boss.v7, highWaist: true };
LOOK_ARCHIVE.renji = { v1: {
  tunic: 0x242329, quilt: 0x29262d, sleeve: 0x242329, straps: null,
  belt: 0x65408a, hoseUpper: 0x202537, hoseLower: 0x202537, shoes: 0x27222b,
  skin: 0xd7b995, hands: 0xd7b995, helmet: null, metal: 0x777178, hair: 0x241d16,
  headband: null, grip: 0x33252d, hilt: 0x8b7872, accent: 0x65408a,
  outfit: 'renji_wanderer', armor: null, stockEyes: true,
} };
LOOK_ARCHIVE.eira = { v1: {
  tunic: 0x252e44, quilt: 0x293249, sleeve: 0x252e44, straps: null,
  belt: 0x292c35, hoseUpper: 0xc3c4c8, hoseLower: 0x252630, shoes: 0x252630,
  skin: 0xe5cbb9, hands: 0xe5cbb9, helmet: null, metal: 0xa7a7af, hair: 0xc4d6e8,
  headband: null, grip: 0x333342, hilt: 0xa7a7af, accent: 0xe4e5e9,
  outfit: 'eira_winter_priest', armor: null, stockEyes: true,
} };

LOOK_ARCHIVE.renji.v2 = { ...LOOK_ARCHIVE.renji.v1 }; // Reference-led hair, seated hat and loose cloth revision.

// 지금 게임에서 실제로 쓰는 버전 (감독/오너가 확정하면 여기만 바꾸면 됨)
export const CHARACTER_LOOK_VERSION = {
  bran: 'v1',
  isolde: 'v5', // v2 outfit with softened tailoring; rejected v3 remains archived.
  liao: 'v6',
  heinrich: 'v2',
  margarethe: 'v5',
  tome: 'v1',
  omari: 'v1',
  yeongman: 'v5',
  artoria: 'v5',
  crown_boss: 'v8',
  renji: 'v2',
  eira: 'v1',
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

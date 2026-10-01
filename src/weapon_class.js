// ─────────────────────────────────────────────────────────────
//  무기 유형 (무기 PM, 사장님 "길이·무게·전투 방식으로 유형화해야 맞는 동작을 재현할 수 있다" — docs/weapon_types.md)
//
//  두 축으로 나눈다. 길이는 유형으로 가르지 않고 무기별 실측 간격(measure)으로 이어서 보정한다.
//   몸 틀(frame) — 몸이 무기를 어떻게 다루나: 자세표·빈손·되돌리기 속도를 정한다
//     'two'   A 양손 보통   : 두 손(한손반 포함), 가볍거나 무게가 손 가까이 — 롱소드·엑스칼리버·에스톡·라이트세이버
//     'heavy' B 양손 앞무게 : 두 손, 무겁거나 무게가 칼끝 쪽 — 츠바이핸더·모노호시자오·냉동 참치
//     'one'   C 한손       : 한 손 — 세이버·팔쉬온·청강검·레이피어·나뭇가지·고무 닭
//     'gun'   D 사격       : 리볼버
//     'pole'  E 자루 무기   : 두 손이 자루 가운데에 벌어져 쥔다(창·할버드). 아직 로스터에 없다 — 스펙에 pole 을 적으면 여기로
//   싸움 방식(style) — 무엇으로 상처를 내나: 기술 목록·AI 선택·판정 쪽을 정한다
//     'versatile' ① 두루 · 'cut' ② 베기 · 'thrust' ③ 찌르기 · 'blunt' ④ 때리기(동작은 베기와 같고 판정만 둔기) · 'shoot' ⑤ 사격
//
//  스펙에 frame·style 을 직접 적으면 그 값을 쓰고, 안 적으면 아래 기준으로 자동으로 정한다.
//  지금은 이름표일 뿐이다: 게임 동작은 이 값을 읽지 않는다(칼 싸움 결과 바이트 동일). 다음 버전의 동작 라이브러리가 읽는다.
// ─────────────────────────────────────────────────────────────

export const FRAMES = ['two', 'heavy', 'one', 'gun', 'pole'];
export const STYLES = ['versatile', 'cut', 'thrust', 'blunt', 'shoot'];
export const FRAME_KO = { two: 'A 양손 보통', heavy: 'B 양손 앞무게', one: 'C 한손', gun: 'D 사격', pole: 'E 자루 무기' };
export const STYLE_KO = { versatile: '① 두루', cut: '② 베기', thrust: '③ 찌르기', blunt: '④ 때리기', shoot: '⑤ 사격' };

// 판정 기준 (docs/weapon_types.md §2) — 15종 실측에서 자연스럽게 갈리는 자리
export const CLASS_RULE = {
  heavyI: 0.6, // 손 기준 관성(kg·m²) 이 이상이면 무조건 앞무게 (츠바이핸더 0.77)
  heavyIMid: 0.3, // 이 이상이면서
  heavyCom: 0.33, //  무게중심이 손에서 이만큼(m) 넘게 앞이면 앞무게 (모노호시자오 0.33·0.39, 참치 0.36·0.40 / 롱소드 0.27·0.24, 에스톡 0.36·0.24)
  poleGap: 0.4, // 자루 무기: 두 손 간격(m)
  thrustM: 1.25, // 찌르기 배율 이상이면서
  thrustCutMax: 0.6, //  베기 배율 이하 → 찌르기 (에스톡 1.35/0.55, 레이피어 1.3/0.5)
  cutM: 1.1, // 베기 배율 이상이면서
  cutThrustMax: 0.85, //  찌르기 배율 이하 → 베기 (츠바이핸더 1.1/0.85, 모노호시자오 1.7/0.85, 세이버 1.25/0.7, 팔쉬온 1.15/0.6)
};

const GREY = new Proxy({}, { get: () => 0x888888 });

/**
 * 무기 스펙의 질량 분포 (buildParts 부품 합): 질량(kg), 손(칼 원점)에서 무게중심까지(m), 손 기준 휘두름 관성(kg·m²), 길이(m).
 *  부품 한 벌 = [모양, y, [질량, 부품 안 무게중심 y, 가로 관성, 축 관성], 색, 칼날?] (weapons.js partTuple)
 */
export function weaponPhysics(spec) {
  const L = (spec.hiltLength ?? 0) + (spec.bladeLength ?? 0);
  let parts = null;
  try {
    parts = spec.buildParts?.call(spec, GREY);
  } catch {
    parts = null;
  }
  if (!parts?.length) return { mass: 0, com: 0, I: 0, length: L };
  let m = 0;
  let my = 0;
  let I = 0;
  for (const p of parts) {
    const [mass, comY, Ie] = p[2];
    const y = p[1] + comY;
    m += mass;
    my += mass * y;
    I += mass * y * y + Ie;
  }
  return { mass: m, com: m > 0 ? my / m : 0, I, length: L };
}

/** 몸 틀 자동 판정 (스펙에 frame 이 있으면 그대로) */
export function classifyFrame(spec, phys = weaponPhysics(spec)) {
  if (spec.frame) return spec.frame;
  if (spec.gun) return 'gun';
  // 두 손 간격: handGap 이 없으면 두손 무기의 뒷손 자리(gripAlong, 음수)로 — 로스터 칼은 0.14~0.22 m, 봉·창 시제품은 0.6 m
  const gap = spec.handGap ?? (spec.grip !== 'one-hand' ? -(spec.gripAlong ?? 0) : 0);
  if (spec.pole || gap >= CLASS_RULE.poleGap) return 'pole';
  if (spec.grip === 'one-hand') return 'one';
  const R = CLASS_RULE;
  if (phys.I >= R.heavyI || (phys.I >= R.heavyIMid && phys.com >= R.heavyCom)) return 'heavy';
  return 'two';
}

/** 싸움 방식 자동 판정 (스펙에 style 이 있으면 그대로) */
export function classifyStyle(spec) {
  if (spec.style) return spec.style;
  if (spec.gun) return 'shoot';
  if (spec.edged === false) return 'blunt';
  const R = CLASS_RULE;
  const mc = spec.mCut ?? 1;
  const mt = spec.mThrust ?? 1;
  if (mt >= R.thrustM && mc <= R.thrustCutMax) return 'thrust';
  if (mc >= R.cutM && mt <= R.cutThrustMax) return 'cut';
  return 'versatile';
}

/** 한 번에: { frame, style, phys } */
export function classifyWeapon(spec) {
  const phys = weaponPhysics(spec);
  return { frame: classifyFrame(spec, phys), style: classifyStyle(spec), phys };
}

// ── 무기 층 (온몸 타격이 무기마다 읽을 값, docs/weapon_layer.md) ─────────────
//  칸과 첫 값만 둔다. 게임은 아직 읽지 않는다(디렉터가 R2 에서 배선). 값마다 [제안]·근거는 docs/weapon_layer.md
//  T0(베기 위상 기본 시간): 재설계 §2-4 첫 값 셋(롱소드 0.30 · 츠바이핸더 0.38 · 세이버 0.24 s)을 맞추는 한 식으로 나머지를 정한다.
//   T0 = 기준 T0 × √((I + K) / (I기준 + K)) — I 는 손 기준 칼 관성, K 는 칼과 함께 돌리는 팔·몸 관성 몫(0.547 kg·m² 로 츠바이핸더 0.38 이 맞는다).
//   기준은 두손(A·B·E) 롱소드 0.30, 한손(C) 세이버 0.24 — 한손 클립은 몸통 몫이 작아 따로 잰다(재설계 §2-2)
export const WEAPON_LAYER = {
  T0_REF: { two: 0.3, heavy: 0.3, pole: 0.3, one: 0.24 },
  I_REF: { two: 0.272, heavy: 0.272, pole: 0.272, one: 0.179 }, // 롱소드·세이버 weaponPhysics().I
  K_BODY: 0.547,
  // 클립 무리(family): 재설계 atlas 의 무리 모음 이름. 두손은 리히테나워 네 무리(Zornhau·Oberhau·Mittelhau·Unterhau),
  //  한손은 같은 네 무리 + 세이버 원운동(moulinet), 자루는 찌르기 + 정수리 내려치기뿐(봉 시제품 측정)
  FAMILY: { two: 'longsword', heavy: 'longsword', one: 'sabre', pole: 'pole', gun: null },
  WIND: { two: 1, heavy: 1.25, one: 0.85, pole: 1, gun: 0 }, // 감기 시간 배율 [제안]
  FOLLOW: { two: 1, heavy: 1.25, one: 0.85, pole: 0.8, gun: 0 }, // 지나가기 시간 배율 [제안]
  TRUNK: { two: 0.4, heavy: 0.5, one: 0.25, pole: 0.4, gun: 0 }, // 몸통 몫 힌트(재설계 trunkCarry 0.4 가 두손 기준) [제안]
};

/** 무기 하나의 무기 층 값 (게임은 아직 읽지 않는다) */
export function weaponLayer(spec) {
  const { frame, style, phys } = classifyWeapon(spec);
  const L = WEAPON_LAYER;
  const grip = spec.grip === 'one-hand' ? 'one' : 'two';
  const T0 = frame === 'gun' ? null : Math.round(100 * L.T0_REF[frame] * Math.sqrt((phys.I + L.K_BODY) / (L.I_REF[frame] + L.K_BODY))) / 100;
  return {
    frame,
    style,
    grip,
    family: L.FAMILY[frame],
    // 무리 안에서 무엇을 먼저: 찌르기 방식은 찌르기, 때리기는 찌르기 없음(동작은 베기와 같음), 자루는 찌르기 + 정수리만
    families: frame === 'gun' ? [] : frame === 'pole' ? ['thrust', 'Oberhau'] : style === 'blunt' ? ['Zornhau', 'Oberhau', 'Mittelhau', 'Unterhau'] : ['Zornhau', 'Oberhau', 'Mittelhau', 'Unterhau', 'thrust', ...(frame === 'one' ? ['moulinet'] : [])],
    thrustFirst: style === 'thrust' || frame === 'pole',
    T0,
    windMul: L.WIND[frame],
    followMul: L.FOLLOW[frame],
    trunkShare: L.TRUNK[frame],
    // S = 0 자세표: 동작 라이브러리(motion_library.js frameTable)의 몸 틀 표. 두손 보통은 지금 게임 표 그대로
    stanceTable: frame === 'gun' ? null : frame === 'two' ? 'GUARDS' : frame === 'one' ? 'BASE_ONE+one' : frame,
    skipStances: spec.motionSkip ?? [],
  };
}

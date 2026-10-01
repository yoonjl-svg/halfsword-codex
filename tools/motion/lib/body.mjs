// ─────────────────────────────────────────────────────────────
//  기준 동작용 사람 몸 모형 (동작 연구 PM · docs/motion/README.md)
//
//  게임 뼈대(src/fighter.js partDefs·jointDefs)와 같은 치수로 만든 "막대 인형" 운동학 모형이다.
//  물리는 없다. 키프레임(골반·가슴 돌림, 손 위치, 칼 방향, 발 자리)에서 관절 위치를 정하고,
//  팔·다리는 두 마디 IK 로 푼다. 빌드 스크립트(Node)와 비교 화면(브라우저)이 같이 쓴다.
//
//  좌표 (게임과 같다): x = 앞(상대 쪽), y = 위, z = 칼 든 쪽(오른손잡이면 오른쪽). 단위 m, 각도는 도(°)로 적는다.
//  돌림(yaw) 부호도 게임 guards.js 와 같다: + 이면 칼 든 쪽 어깨·골반이 뒤로 빠진다(칼 쪽으로 감는다).
//  숙임(lean·pitch) + = 앞으로 숙임. 옆굽힘(side) + = 칼 든 쪽으로 기움.
// ─────────────────────────────────────────────────────────────

export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;

// 게임 뼈대 치수 (fighter.js: 발목 0.08, 무릎 0.50, 엉덩이 0.93, 허리 1.06, 가슴 가운데 1.33, 어깨 1.43, 목 1.50, 머리 1.62 반지름 0.10)
export const BODY = {
  hipY: 0.93,
  hipZ: 0.095,
  waistUp: 0.13, // 엉덩이 관절 높이 → 허리
  chestUp: 0.27, // 허리 → 가슴 가운데 (게임 guards 원점)
  shoulder: [0, 0.1, 0.2], // 가슴 틀
  neck: [0, 0.17, 0],
  head: [0, 0.29, 0],
  headR: 0.1,
  torsoFront: 0.11, // 가슴 상자 앞면 (가슴 틀 x)
  upper: 0.3, // 위팔
  fore: 0.265, // 아래팔 + 손 (칼자루 잡는 점까지). 어깨→손 최대 0.565
  thigh: 0.43,
  shin: 0.42,
  ankleY: 0.08,
  foot: 0.16, // 발목 → 앞꿈치
  heel: 0.06,
  // 무게 (fighter.js mass, 합 78.6 kg)
  mass: { pelvis: 10.7, abdomen: 10.4, chest: 16.2, head: 6.1, uarm: 2.1, farm: 1.65, thigh: 7.5, shin: 3.5, foot: 1.1 },
};

// 손목 한계 (아래팔과 칼 사이 최대 각, 도). 사람 두손 망치 쥐기 약 90° 에 손목 옆굽힘(약 20~30°)을 더하면 약 135°,
//  손목 폄(AAOS 최대 70°)까지 보태면 약 160° [추정]. 측정 자료는 없다.
//  v0 에서는 끈다(180): 135° 로 막아 보니 팔을 많이 접은 자세(가로 베기 감기, 팔꿈치 130°)에서 아래팔 방향이 조금만 바뀌어도
//  칼이 따라 튀어 칼끝 속도가 순간 37~80 m/s 로 튀었다. 막는 대신 넘은 시간·최대 각을 summary.checks 에 적는다.
//  v1: 한계를 시간으로 부드럽게 걸거나(칼이 끌려오는 속도 제한) 저작 키에서 늦춤을 줄인다
export const WRIST_MAX = 180;
export const WRIST_HUMAN = 135;

// 롱소드 (weapons.js longsword: 칼자루 0.13, 칼날 1.05, 폼멜 −0.12, 빈손 gripAlong −0.14, 무게 1.6 kg, 무게중심 손에서 0.24)
export const SWORD = { tip: 1.18, guard: 0.115, pommel: -0.12, offHand: -0.14, mass: 1.6, com: 0.24 };

// ── 작은 벡터·회전 도구 (three.js 없이 Node 에서도 돈다) ──
export const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
};

// 3×3 행렬 (행 우선 배열 9칸). 열 = 몸 틀의 앞·위·옆 축을 월드로 적은 것
export const m3 = {
  mul: (A, B) => {
    const C = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
    return C;
  },
  apply: (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]],
  applyT: (M, v) => [M[0] * v[0] + M[3] * v[1] + M[6] * v[2], M[1] * v[0] + M[4] * v[1] + M[7] * v[2], M[2] * v[0] + M[5] * v[1] + M[8] * v[2]],
  // 게임 부호의 돌림: yaw + = 칼 쪽(+z) 이 뒤로 → y축 둘레 −yaw 회전
  ry: (deg) => {
    const a = -deg * D2R;
    const c = Math.cos(a), s = Math.sin(a);
    return [c, 0, s, 0, 1, 0, -s, 0, c];
  },
  // 숙임 + = 앞으로 → z축 둘레 −pitch 회전
  rz: (deg) => {
    const a = -deg * D2R;
    const c = Math.cos(a), s = Math.sin(a);
    return [c, -s, 0, s, c, 0, 0, 0, 1];
  },
  // 옆굽힘 + = 칼 쪽(+z)으로 → x축 둘레 +side 회전
  rx: (deg) => {
    const a = deg * D2R;
    const c = Math.cos(a), s = Math.sin(a);
    return [1, 0, 0, 0, c, -s, 0, s, c];
  },
};

/** 몸 틀 회전 = 돌림 · 숙임 · 옆굽힘 순서 (월드 수직축 둘레 돌림을 마지막에) */
export function frame(yaw, pitch, roll) {
  return m3.mul(m3.ry(yaw), m3.mul(m3.rz(pitch), m3.rx(roll)));
}

/** 교본 표기 칼 방향 [올려본 각, 옆 각](도) → 단위 벡터 (guards.js 와 같은 식) */
export function bladeDir(el, az) {
  const e = el * D2R, a = az * D2R;
  return [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)];
}
export function dirAngles(d) {
  const n = v3.norm(d);
  return [Math.asin(Math.max(-1, Math.min(1, n[1]))) * R2D, Math.atan2(n[2], n[0]) * R2D];
}

/**
 * 두 마디 IK: 뿌리 a, 목표 t, 마디 길이 l1·l2, 꺾이는 쪽 pole(월드 방향).
 * 닿지 않으면 뻗은 채 목표 쪽으로 (over = 모자란 길이 m)
 */
export function twoBone(a, t, l1, l2, pole) {
  let d = v3.sub(t, a);
  let L = v3.len(d);
  const maxL = l1 + l2 - 1e-4;
  const minL = Math.abs(l1 - l2) + 1e-3;
  const over = Math.max(0, L - maxL);
  const Lc = Math.min(maxL, Math.max(minL, L));
  const dn = v3.norm(d);
  // pole 에서 d 성분을 빼 꺾이는 평면을 정한다
  let p = v3.sub(pole, v3.mul(dn, v3.dot(pole, dn)));
  if (v3.len(p) < 1e-6) p = Math.abs(dn[1]) < 0.9 ? v3.cross(dn, [0, 1, 0]) : v3.cross(dn, [1, 0, 0]);
  p = v3.norm(p);
  const x = (l1 * l1 - l2 * l2 + Lc * Lc) / (2 * Lc);
  const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const mid = v3.add(a, v3.add(v3.mul(dn, x), v3.mul(p, h)));
  const end = v3.add(a, v3.mul(dn, Lc));
  return { mid, end, over };
}

/**
 * 한 순간의 채널 값 → 관절 위치 (월드 = 클립 시작 때 발 밑 땅 틀)
 * ch: { pelvis:{x,z,drop,yaw,pitch,roll}, chest:{yaw(골반 대비 X-factor), lean, side},
 *       hand:[앞,위,옆] 가슴 틀, dir:[앞,위,옆] 가슴 틀 칼 방향,
 *       feet:{L:{x,z,yaw,lift,up}, R:{...}}, hand2(선택: 빈손 자리) }
 * side: +1 = 오른손잡이 (z+ 가 칼 든 쪽)
 * sword: 칼 치수 (앞손에서 칼 축 m: offHand·pommel·tip, mass·com) — 기본 롱소드. 다른 무기는 lib/weapons.mjs weaponGeom()
 */
export function pose(ch, side = 1, sword = SWORD) {
  const P = ch.pelvis;
  const Rp = frame(P.yaw, P.pitch, P.roll);
  const hipC = [P.x, BODY.hipY - P.drop, P.z];
  const waist = v3.add(hipC, m3.apply(Rp, [0, BODY.waistUp, 0]));
  const Rc = frame(P.yaw + ch.chest.yaw, P.pitch + ch.chest.lean, P.roll + ch.chest.side);
  const C = v3.add(waist, m3.apply(Rc, [0, BODY.chestUp, 0]));
  const toW = (local) => v3.add(C, m3.apply(Rc, local));
  const neck = toW(BODY.neck);
  const head = toW(BODY.head);

  // 칼과 손
  // 칼 방향: 월드로 주면(dirW) 그대로, 가슴 틀로 주면(dir) 가슴과 함께 돈다
  //  (칼 든 팔을 먼저 풀고, 손목이 꺾일 수 있는 만큼만 칼을 늦춘다 → 빈손 자리는 그 칼에서 정한다)
  let dW = ch.dirW ? v3.norm(ch.dirW) : v3.norm(m3.apply(Rc, ch.dir));
  const hS = toW(ch.hand);

  // 어깨띠: 팔을 60° 넘게 들면 날개뼈가 따라 올라간다 (어깨 위팔 리듬 약 2:1 — 팔 들림의 1/3 이 날개뼈 몫)
  const girdle = (s, hand) => {
    const sh0 = toW([BODY.shoulder[0], BODY.shoulder[1], s * BODY.shoulder[2]]);
    const up = m3.apply(Rc, [0, 1, 0]);
    const fw = m3.apply(Rc, [1, 0, 0]);
    const toH = v3.norm(v3.sub(hand, sh0));
    const elev = Math.acos(Math.max(-1, Math.min(1, -v3.dot(toH, up)))) * R2D; // 0 = 팔을 내림, 180 = 머리 위로
    const lift = 0.06 * Math.max(0, Math.min(1, (elev - 60) / 110));
    const reach = Math.max(0, v3.dot(toH, fw));
    const prot = 0.04 * reach * Math.max(0, Math.min(1, (v3.dist(hand, sh0) - 0.4) / 0.16));
    return { sh: v3.add(sh0, v3.add(v3.mul(up, lift), v3.mul(fw, prot))), elev, lift, prot };
  };
  const gS = girdle(side, hS);

  // 팔꿈치 방향: 손이 어깨보다 낮으면 아래·바깥, 머리 위면 바깥·위(지붕 자세의 팔꿈치). 빈팔은 몸 쪽 아래
  const pole = (s, hand, sh) => {
    const rel = m3.applyT(Rc, v3.sub(hand, sh));
    const hi = Math.max(0, Math.min(1, (rel[1] + 0.05) / 0.35));
    // 손이 몸 반대쪽으로 넘어가면(팔이 가슴을 가로지름) 팔꿈치는 아래를 향한다
    const cross = Math.max(0, Math.min(1, (-s * rel[2]) / 0.3));
    // 손이 머리 뒤로 가면(높고 어깨보다 뒤) 팔꿈치는 앞·위를 향한다 — 도끼를 머리 뒤로 넘긴 팔 모양. 아래팔이 뒤로 눕어 칼을 등 뒤로 늘어뜨려도 손목이 버틴다
    const bu = Math.max(0, Math.min(1, (0.2 - rel[0]) / 0.4));
    const back = hi * bu * bu * (3 - 2 * bu); // 손이 어깨 앞 0.2 m → 뒤 0.2 m 로 가는 동안 부드럽게 (팔꿈치가 휙 뒤집히지 않게)
    const out = s * (0.7 - 0.5 * cross);
    const px = (-0.25 - 0.2 * hi) * (1 - back) + 0.6 * back;
    const py = (-1 + 1.5 * hi * (1 - cross)) * (1 - back) + 0.45 * back;
    return v3.norm(m3.apply(Rc, [px, py, out]));
  };
  // 팔이 몸통을 뚫지 않게: 팔꿈치 방향을 어깨→손 축 둘레로 조금씩 돌려 가며, 위팔·아래팔이 몸통(가슴 틀 타원 단면)에
  //  들어가지 않는 가장 가까운 방향을 고른다. 손 자리·칼은 그대로라 빠르기·손목 값은 바뀌지 않는다 (팔꿈치 자리만)
  const TORSO = { front: 0.11 + 0.035, back: 0.1 + 0.035, half: 0.16 + 0.035, top: 0.08 }; // 팔 두께 0.035 를 더함, 높이는 엉덩이 위 ~ 어깨 바로 아래
  const yHip = -(BODY.chestUp + BODY.waistUp) + 0.05;
  const into = (sh, mid, hand) => {
    let worst = 0;
    const test = (p) => {
      const q = m3.applyT(Rc, v3.sub(p, C));
      if (q[1] < yHip || q[1] > TORSO.top) return;
      const ax = q[0] >= 0 ? TORSO.front : TORSO.back;
      const k = (q[0] / ax) ** 2 + (q[2] / TORSO.half) ** 2;
      if (k < 1) worst = Math.max(worst, 1 - Math.sqrt(k));
    };
    for (let u = 0.45; u <= 1.001; u += 0.11) test(v3.lerp(sh, mid, u));
    for (let u = 0.0; u <= 0.901; u += 0.15) test(v3.lerp(mid, hand, u));
    return worst;
  };
  const clearArm = (sh, hand, pole0) => {
    const first = twoBone(sh, hand, BODY.upper, BODY.fore, pole0);
    if (into(sh, first.mid, hand) <= 0) return first;
    const axis = v3.norm(v3.sub(hand, sh));
    let best = first, bestD = into(sh, first.mid, hand);
    for (let step = 1; step <= 36; step++) {
      for (const sgn of [1, -1]) {
        const a = sgn * step * 5 * D2R;
        // 로드리게스: pole0 을 axis 둘레로 a 만큼
        const kxv = v3.cross(axis, pole0);
        const pr = v3.add(v3.add(v3.mul(pole0, Math.cos(a)), v3.mul(kxv, Math.sin(a))), v3.mul(axis, v3.dot(axis, pole0) * (1 - Math.cos(a))));
        const arm = twoBone(sh, hand, BODY.upper, BODY.fore, pr);
        const d = into(sh, arm.mid, hand);
        if (d <= 0) return arm;
        if (d < bestD - 1e-9) (best = arm), (bestD = d);
      }
    }
    return best;
  };
  const armS = clearArm(gS.sh, hS, pole(side, hS, gS.sh));
  // 손목 한계: 아래팔과 칼 사이 각이 WRIST_MAX 를 넘으면 칼을 아래팔 쪽으로 끌어온다 (두손 망치 쥐기 약 90° + 손목 옆굽힘 [추정])
  const fore = v3.norm(v3.sub(hS, armS.mid));
  const cosA = v3.dot(fore, dW);
  let wristClamp = 0;
  if (cosA < Math.cos(WRIST_MAX * D2R)) {
    const ang = Math.acos(Math.max(-1, cosA));
    let k = v3.cross(fore, dW);
    if (v3.len(k) < 1e-6) k = v3.cross(fore, Math.abs(fore[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
    k = v3.norm(k);
    // 아래팔 방향을 k 둘레로 WRIST_MAX 만큼 돌린 방향 (로드리게스 회전)
    const a = WRIST_MAX * D2R;
    const kxv = v3.cross(k, fore);
    dW = v3.norm(v3.add(v3.add(v3.mul(fore, Math.cos(a)), v3.mul(kxv, Math.sin(a))), v3.mul(k, v3.dot(k, fore) * (1 - Math.cos(a)))));
    wristClamp = ang * R2D - WRIST_MAX;
  }
  // 빈손: 두손 무기는 칼자루 끝(앞손에서 칼 축 offHand), 한손 무기는 ch.hand2 (가슴 틀 — 허리·뒤·앞 등 빌드 도구가 정함)
  const hO = sword.twoHand === false && ch.hand2 ? toW(ch.hand2) : v3.add(hS, v3.mul(dW, sword.offHand));
  const tip = v3.add(hS, v3.mul(dW, sword.tip));
  const pommel = v3.add(hS, v3.mul(dW, sword.pommel));
  const gO = girdle(-side, hO);
  const armO = clearArm(gO.sh, hO, pole(-side, hO, gO.sh));

  // 다리: 골반 양쪽 엉덩이 관절 → 발목. 무릎은 발끝 쪽 앞으로
  const legs = {};
  for (const k of ['L', 'R']) {
    const f = ch.feet[k];
    const s = k === 'R' ? 1 : -1; // 오른발 = z+ (오른손잡이 기준)
    const hip = v3.add(hipC, m3.apply(Rp, [0, 0, s * side * BODY.hipZ]));
    const fy = f.yaw ?? 0;
    const fdir = [Math.cos(-fy * D2R), 0, -Math.sin(-fy * D2R)];
    // 뒤꿈치를 들면 앞꿈치를 축으로 발목이 올라간다
    const lift = f.lift ?? 0;
    const up = f.up ?? 0; // 발 전체를 든 높이 (걸음 중)
    const toe = [f.x + fdir[0] * BODY.foot, 0.02 + up, f.z + fdir[2] * BODY.foot];
    const pitchF = Math.asin(Math.min(0.9, lift * 0.5));
    const ankle = [toe[0] - fdir[0] * BODY.foot * Math.cos(pitchF), BODY.ankleY + up + BODY.foot * Math.sin(pitchF), toe[2] - fdir[2] * BODY.foot * Math.cos(pitchF)];
    const heel = v3.add(ankle, [-fdir[0] * BODY.heel, -0.06, -fdir[2] * BODY.heel]);
    const leg = twoBone(hip, ankle, BODY.thigh, BODY.shin, v3.add(fdir, [0, 0.15, 0]));
    legs[k] = { hip, knee: leg.mid, ankle: leg.end, toe, heel, over: leg.over, fdir };
  }

  return {
    Rp, Rc, hipC, waist, C, neck, head,
    shS: gS.sh, shO: gO.sh, elS: armS.mid, elO: armO.mid, hS, hO,
    overS: armS.over, overO: armO.over, elevS: gS.elev, elevO: gO.elev,
    girdleS: { lift: gS.lift, prot: gS.prot }, girdleO: { lift: gO.lift, prot: gO.prot },
    dW, tip, pommel, legs, wristClamp, sword,
  };
}

/** 무게중심 (게임 부위 무게로). 칼 포함 */
export function centerOfMass(J, withSword = true) {
  const M = BODY.mass;
  const parts = [
    [v3.lerp(J.hipC, J.waist, 0.4), M.pelvis],
    [v3.lerp(J.waist, J.C, 0.6), M.abdomen],
    [v3.lerp(J.C, J.neck, 0.2), M.chest],
    [J.head, M.head],
    [v3.lerp(J.shS, J.elS, 0.45), M.uarm],
    [v3.lerp(J.elS, J.hS, 0.45), M.farm],
    [v3.lerp(J.shO, J.elO, 0.45), M.uarm],
    [v3.lerp(J.elO, J.hO, 0.45), M.farm],
  ];
  for (const k of ['L', 'R']) {
    const g = J.legs[k];
    parts.push([v3.lerp(g.hip, g.knee, 0.43), M.thigh], [v3.lerp(g.knee, g.ankle, 0.43), M.shin], [v3.lerp(g.ankle, g.toe, 0.4), M.foot]);
  }
  const S = J.sword ?? SWORD;
  if (withSword) parts.push([v3.add(J.hS, v3.mul(J.dW, S.com)), S.mass]);
  let m = 0;
  let c = [0, 0, 0];
  for (const [p, w] of parts) {
    c = v3.add(c, v3.mul(p, w));
    m += w;
  }
  return v3.mul(c, 1 / m);
}

/** 막대 인형 선분 목록 (비교 화면용) */
export function bones(J) {
  const L = J.legs;
  return [
    ['spine', J.hipC, J.waist], ['spine', J.waist, J.C], ['spine', J.C, J.neck], ['neck', J.neck, J.head],
    ['girdle', J.shS, J.shO],
    ['armS', J.shS, J.elS], ['armS', J.elS, J.hS], ['armO', J.shO, J.elO], ['armO', J.elO, J.hO],
    ['pelvis', L.L.hip, L.R.hip],
    ['legL', L.L.hip, L.L.knee], ['legL', L.L.knee, L.L.ankle], ['legL', L.L.heel, L.L.toe], ['legL', L.L.ankle, L.L.heel],
    ['legR', L.R.hip, L.R.knee], ['legR', L.R.knee, L.R.ankle], ['legR', L.R.heel, L.R.toe], ['legR', L.R.ankle, L.R.heel],
    ['sword', J.pommel, J.tip],
  ];
}

/** 관절 이름 순서 (클립 JSON 의 J 칸, 게임 기록 JSON 의 J 칸이 같은 순서로 [x,y,z,...] 를 담는다) */
export const JOINTS = ['hipC', 'waist', 'chest', 'neck', 'head', 'shS', 'elS', 'hS', 'shO', 'elO', 'hO', 'hipL', 'kneeL', 'ankleL', 'heelL', 'toeL', 'hipR', 'kneeR', 'ankleR', 'heelR', 'toeR', 'pommel', 'tip'];
/** 막대 인형 뼈 (JOINTS 이름끼리) */
export const BONES = [
  ['hipC', 'waist', 'spine'], ['waist', 'chest', 'spine'], ['chest', 'neck', 'spine'], ['neck', 'head', 'neck'],
  ['shS', 'shO', 'girdle'], ['shS', 'elS', 'armS'], ['elS', 'hS', 'armS'], ['shO', 'elO', 'armO'], ['elO', 'hO', 'armO'],
  ['hipL', 'hipR', 'pelvis'], ['hipL', 'kneeL', 'legL'], ['kneeL', 'ankleL', 'legL'], ['heelL', 'toeL', 'legL'], ['ankleL', 'heelL', 'legL'],
  ['hipR', 'kneeR', 'legR'], ['kneeR', 'ankleR', 'legR'], ['heelR', 'toeR', 'legR'], ['ankleR', 'heelR', 'legR'],
  ['pommel', 'tip', 'sword'],
];
/** pose() 결과 → JOINTS 순서 평면 배열 */
export function flatJoints(J) {
  const L = J.legs;
  const pts = [J.hipC, J.waist, J.C, J.neck, J.head, J.shS, J.elS, J.hS, J.shO, J.elO, J.hO, L.L.hip, L.L.knee, L.L.ankle, L.L.heel, L.L.toe, L.R.hip, L.R.knee, L.R.ankle, L.R.heel, L.R.toe, J.pommel, J.tip];
  const out = [];
  for (const p of pts) out.push(Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000, Math.round(p[2] * 1000) / 1000);
  return out;
}

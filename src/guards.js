// ─────────────────────────────────────────────────────────────
//  검술 자세 지도 (독일식 롱소드, 리히테나워 전통)
//
//  손가락이 가리키는 곳(패드 위치, 몸 앞 평면의 좌우 x·위아래 y, 미터) → 실제 검술 자세.
//  자세마다 손(칼자루) 위치, 칼끝 방향, 골반·가슴을 트는 정도, 상체 숙이기, 무릎 굽혀 낮추기가 있다.
//  손가락이 자세와 자세 사이에 있으면 가까운 자세들을 부드럽게 섞는다.
//  → 자세에서 자세로 빠르게 옮기는 것이 곧 베기다.
//     지붕(위) → 긴 자세(가운데) → 바보(아래) = 위에서 내려베기 (마이어: "지붕에서 긴 자세를 지나 바보 자세로")
//     오른쪽 위(어깨 지붕) → 왼쪽 아래 = 사선 베기(분노의 베기)
//     황소·쟁기(칼끝이 상대를 겨눔) → 가운데(긴 자세) = 찌르기
//     오른쪽 옆 → 왼쪽 옆 = 가로베기
//
//  자료: Ringeck·Meyer 교본의 자세 설명 + 현대 HEMA 수련 기준을 몸 크기(키 1.75m)에 맞춰 옮긴 값.
//  각도·높이 숫자는 교본에 적혀 있지 않아 추정한 값이다.
//
//  좌표 (몸 기준, 가슴 한가운데가 원점): hand = [앞, 위, 칼 든 쪽] (m)
//  blade = [올려본 각, 옆으로 돌린 각] (도). 0,0 = 칼끝이 정면. 옆 각은 + 가 칼 든 쪽.
//  yaw = + 이면 칼 든 쪽 어깨·골반이 뒤로 빠진다(몸을 칼 든 쪽으로 튼다). pitch = + 이면 앞으로 숙인다.
// ─────────────────────────────────────────────────────────────

const RAW = [
  // 이름, 패드 [x, y], 손 [앞, 위, 옆], 칼끝 [올려본 각, 옆 각], 골반 yaw, 가슴 yaw, 숙이기, 낮추기(m)
  { name: '지붕 (Vom Tag)', desc: '칼을 머리 위로 세운 자세 · 위에서 내려베기 준비', pad: [0.02, 0.52], hand: [0.18, 0.55, 0.06], blade: [100, 0], pelvisYaw: 25, chestYaw: 30, pitch: 0, drop: 0.05 },
  // 어깨 위 지붕: 칼을 오른쪽 어깨에 얹어 뒤로 눕힌 자세. 사선 베기(분노의 베기)가 여기서 시작한다
  { name: '어깨 지붕 (Vom Tag)', desc: '칼을 오른 어깨에 얹은 자세 · 사선 베기 준비', pad: [0.42, 0.42], hand: [0.12, 0.14, 0.2], blade: [55, 170], pelvisYaw: 35, chestYaw: 45, pitch: 3, drop: 0.06 },
  { name: '황소 (Ochs)', desc: '칼자루는 머리 옆, 칼끝은 상대 얼굴 · 찌르기 준비', pad: [0.22, 0.26], hand: [0.28, 0.29, 0.22], blade: [-15, -12], pelvisYaw: 25, chestYaw: 30, pitch: 3, drop: 0.07 },
  { name: '긴 자세 (Langort)', desc: '팔을 쭉 뻗어 칼끝으로 겨눈 자세', pad: [0.0, 0.03], hand: [0.57, 0.07, 0.03], blade: [-3, 0], pelvisYaw: -20, chestYaw: -20, pitch: 8, drop: 0.07 },
  // 옆 자세: 가로베기(Mittelhau/Zwerchhau)를 준비하려고 칼을 옆으로 눕혀 뒤로 뺀 자세 (추정)
  { name: '옆 자세', desc: '칼을 옆으로 눕혀 뒤로 뺀 자세 · 가로베기 준비', pad: [0.52, 0.03], hand: [0.15, 0.12, 0.28], blade: [5, 110], pelvisYaw: 30, chestYaw: 45, pitch: 2, drop: 0.06 },
  { name: '쟁기 (Pflug)', desc: '칼자루는 허리, 칼끝은 상대 얼굴 · 기본 자세', pad: [0.18, -0.28], hand: [0.28, -0.31, 0.15], blade: [30, -12], pelvisYaw: 25, chestYaw: 25, pitch: 5, drop: 0.07 },
  { name: '바꿈 (Wechsel)', desc: '칼끝을 오른쪽 아래로 · 올려베기 준비', pad: [0.38, -0.44], hand: [0.25, -0.33, 0.2], blade: [-45, 40], pelvisYaw: 10, chestYaw: 15, pitch: 5, drop: 0.07 },
  { name: '옆 지킴 (Nebenhut)', desc: '칼을 오른쪽 뒤 아래로 숨긴 자세', pad: [0.55, -0.26], hand: [0.08, -0.31, 0.24], blade: [-35, 150], pelvisYaw: 40, chestYaw: 45, pitch: 5, drop: 0.08 },
  { name: '바보 (Alber)', desc: '칼끝을 땅으로 내린 자세 · 상대를 끌어들인다', pad: [0.0, -0.5], hand: [0.4, -0.33, 0.02], blade: [-40, 0], pelvisYaw: -15, chestYaw: -10, pitch: 8, drop: 0.07 },
  // 왼쪽 (칼 든 반대쪽): 오른쪽 자세를 거울에 비춘 것 + 사선 베기가 끝나는 왼쪽 바꿈 자세
  { name: '왼쪽 어깨 지붕', desc: '칼을 왼 어깨에 얹은 자세 · 반대쪽 사선 베기 준비', pad: [-0.4, 0.42], hand: [0.16, 0.14, -0.14], blade: [55, -170], pelvisYaw: -30, chestYaw: -40, pitch: 3, drop: 0.06 },
  { name: '왼쪽 황소', desc: '칼자루는 머리 왼쪽, 칼끝은 상대 얼굴', pad: [-0.22, 0.26], hand: [0.28, 0.29, -0.12], blade: [-15, 12], pelvisYaw: -20, chestYaw: -30, pitch: 3, drop: 0.07 },
  { name: '왼쪽 옆 자세', desc: '칼을 왼쪽으로 눕혀 뒤로 뺀 자세 · 반대쪽 가로베기 준비', pad: [-0.52, 0.03], hand: [0.2, 0.12, -0.18], blade: [5, -110], pelvisYaw: -30, chestYaw: -45, pitch: 2, drop: 0.06 },
  { name: '왼쪽 쟁기', desc: '칼자루는 왼 허리, 칼끝은 상대 얼굴', pad: [-0.18, -0.28], hand: [0.28, -0.31, -0.06], blade: [30, 12], pelvisYaw: -20, chestYaw: -20, pitch: 5, drop: 0.07 },
  { name: '왼쪽 바꿈', desc: '칼끝을 왼쪽 아래로 · 사선 베기가 끝나는 자리', pad: [-0.4, -0.42], hand: [0.32, -0.31, -0.1], blade: [-45, -40], pelvisYaw: -30, chestYaw: -40, pitch: 12, drop: 0.08 },
];

const D2R = Math.PI / 180;
const BASE = RAW.map((g) => {
  const el = g.blade[0] * D2R;
  const az = g.blade[1] * D2R;
  return {
    ...g,
    dir: [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)],
    pelvisYaw: g.pelvisYaw * D2R,
    chestYaw: g.chestYaw * D2R,
    pitch: g.pitch * D2R,
    low: g.pad[1] < -0.2, // 아래쪽 자세: 쓰러진 상대 앞에서는 마무리 자세로 바뀐다
  };
});

// 쓰러진 상대 마무리 자세 (finish.js). 손·칼끝·몸 기울기는 누운 몸의 위치에 따라 매 스텝 finish.js 가 정한다
//  (여기 값은 이름 표시용). 아래쪽 자세 자리에 겹쳐 놓여서, 마무리 중엔 그 자리의 교본 자세 대신 쓰인다.
//   겨눔(쟁기·옆 지킴 자리) = 찍기 겨눔 (두 손 머리 위, 칼끝 아래로 누운 몸), 지붕 → 내려찍기(바보·바꿈 자리) = 내려베기
const FINISH_GUARDS = [
  { name: '내려찍기 겨눔', desc: '두 손을 머리 위로 들고 칼날을 아래로 돌려 쥐어 쓰러진 상대를 겨눈다', finish: 'hover', pads: [[0.18, -0.28], [-0.18, -0.28], [0.55, -0.26]] },
  { name: '내려찍기', desc: '쓰러진 상대를 칼끝이 땅에 닿도록 찍는다 · 위에서 오면 내려베기', finish: 'strike', pads: [[0.0, -0.5], [0.38, -0.44], [-0.4, -0.42]] },
];
const NBASE = BASE.length;
// GUARDS 뒤쪽 두 개는 마무리 자세 (자세 이름 표시·nearest 용. 평소 섞기에는 들어가지 않는다)
export const GUARDS = [...BASE, ...FINISH_GUARDS.map((g) => ({ ...g, pad: g.pads[0], hand: [0, 0, 0], dir: [1, 0, 0], pelvisYaw: 0, chestYaw: 0, pitch: 0, drop: 0 }))];

// 한손 무기(weapons.js oneHandStance: 세이버·팔쉬온·청강검·레이피어·나뭇가지·고무 닭. 라이트세이버는 뺀다)의 자세 — 한손 뻗기(디렉터 10라운드 B, R2)
//  한 손으로 쥐면 빈손이 칼자루를 잡지 않으니 팔을 끝까지 뻗고, 칼 든 어깨를 앞으로 내밀어 몸을 옆으로 세운다
//  (세이버의 걸친 막기, 레이피어의 3번 자세, 검의 칼끝 앞세우기). 칼끝으로 겨누는 자세만 손을 앞으로 내고 몸을 튼다.
//  yaw 가 − 이면 칼 든 어깨가 앞으로 나온다(도). 칼끝 방향은 교본 자세 그대로. 손은 팔 길이(어깨에서 0.565m) 안이다
const ONE_HAND = {
  '긴 자세 (Langort)': { hand: [0.68, 0.08, 0.1], pelvisYaw: -35, chestYaw: -45, pitch: 10 },
  '쟁기 (Pflug)': { hand: [0.4, -0.22, 0.13], pelvisYaw: -10, chestYaw: -25 },
  '황소 (Ochs)': { hand: [0.36, 0.26, 0.17], pelvisYaw: 0, chestYaw: -15 },
  '바보 (Alber)': { hand: [0.5, -0.3, 0.05], pelvisYaw: -25, chestYaw: -25 },
};
const BASE_ONE = BASE.map((g) => {
  const o = ONE_HAND[g.name];
  return o ? { ...g, hand: o.hand, pelvisYaw: o.pelvisYaw * D2R, chestYaw: o.chestYaw * D2R, pitch: o.pitch != null ? o.pitch * D2R : g.pitch } : g;
});

/** 동작 라이브러리(motion_library.js)가 몸 틀별 자세표를 만들 때 바탕으로 쓰는 표 (교본 자세 NBASE 개, 같은 패드 자리) */
export const GUARD_BASE = BASE;
export const GUARD_BASE_ONE = BASE_ONE;

const SIGMA2 = 0.15 * 0.15;

/**
 * 패드 위치 (x, y) → 섞인 자세. out을 채워서 돌려준다.
 * out = { hand:[3], dir:[3], pelvisYaw, chestYaw, pitch, drop, nearest }
 * fin: 쓰러진 상대 마무리 (finish.js 의 fighter.finish). fin.amt 가 0 이면 예전 계산 그대로다
 * th: 탭 찌르기 (skill.js 의 thrustPose). 섞은 자세 위에 th.w 만큼 덧씌운다. w 가 0 이면 예전 계산 그대로다
 */
export function guardAt(x, y, out, fin = null, th = null) {
  let wSum = 0;
  let best = -1;
  let bestW = -1;
  const h = (out.hand ||= [0, 0, 0]);
  const d = (out.dir ||= [0, 0, 0]);
  h[0] = h[1] = h[2] = d[0] = d[1] = d[2] = 0;
  out.pelvisYaw = out.chestYaw = out.pitch = out.drop = 0;
  const fa = fin ? fin.amt : 0;
  // 한손 무기면 한손 자세표 (fighter 가 무기의 oneHandStance 로 out.oneHand 를 켠다). out.table 이 있으면 그 표
  //  (동작 라이브러리 motion_library.js — 몸 틀별 자세표. 같은 패드 자리·같은 순서. 없으면 예전 그대로)
  const T = out.table ?? (out.oneHand ? BASE_ONE : GUARDS);
  for (let i = 0; i < NBASE; i++) {
    const g = T[i];
    const dx = x - g.pad[0];
    const dy = y - g.pad[1];
    let w = Math.exp(-(dx * dx + dy * dy) / SIGMA2);
    if (fa > 0 && g.low) w *= 1 - fa;
    if (w > bestW) {
      bestW = w;
      best = i;
    }
    wSum += w;
    for (let k = 0; k < 3; k++) {
      h[k] += g.hand[k] * w;
      d[k] += g.dir[k] * w;
    }
    out.pelvisYaw += g.pelvisYaw * w;
    out.chestYaw += g.chestYaw * w;
    out.pitch += g.pitch * w;
    out.drop += g.drop * w;
  }
  if (fa > 0) {
    for (let j = 0; j < FINISH_GUARDS.length; j++) {
      const F = FINISH_GUARDS[j];
      const p = fin[F.finish];
      for (const pad of F.pads) {
        const dx = x - pad[0];
        const dy = y - pad[1];
        const w = Math.exp(-(dx * dx + dy * dy) / SIGMA2) * fa;
        if (w > bestW) {
          bestW = w;
          best = NBASE + j;
        }
        wSum += w;
        for (let k = 0; k < 3; k++) {
          h[k] += p.hand[k] * w;
          d[k] += p.dir[k] * w;
        }
        out.pelvisYaw += p.pelvisYaw * w;
        out.chestYaw += p.chestYaw * w;
        out.pitch += p.pitch * w;
        out.drop += p.drop * w;
      }
    }
  }
  const inv = 1 / Math.max(1e-9, wSum);
  for (let k = 0; k < 3; k++) h[k] *= inv;
  out.pelvisYaw *= inv;
  out.chestYaw *= inv;
  out.pitch *= inv;
  out.drop *= inv;
  // 칼끝 방향: 가중 평균을 정규화. 거의 반대 방향끼리 섞여 상쇄되면 가장 가까운 자세의 방향을 쓴다
  let len = Math.hypot(d[0], d[1], d[2]) * inv;
  if (len < 0.35) {
    const g = best < NBASE ? T[best] : GUARDS[best];
    const gd = g.finish ? fin[g.finish].dir : g.dir;
    d[0] = gd[0];
    d[1] = gd[1];
    d[2] = gd[2];
    len = 1;
  } else {
    const s = 1 / Math.hypot(d[0], d[1], d[2]);
    d[0] *= s;
    d[1] *= s;
    d[2] *= s;
  }
  out.nearest = best;
  if (th && th.w > 0) overlay(out, th);
  return out;
}

/** 섞은 자세 위에 찌르기 자세를 w 만큼 덧씌운다 (손·몸은 선형으로, 칼끝 방향은 섞은 뒤 다시 단위 벡터로) */
function overlay(out, th) {
  const w = th.w;
  const h = out.hand;
  const d = out.dir;
  for (let k = 0; k < 3; k++) {
    h[k] += (th.hand[k] - h[k]) * w;
    d[k] += (th.dir[k] - d[k]) * w;
  }
  const n = Math.hypot(d[0], d[1], d[2]);
  if (n < 1e-3) for (let k = 0; k < 3; k++) d[k] = th.dir[k];
  else for (let k = 0; k < 3; k++) d[k] /= n;
  out.pelvisYaw += (th.pelvisYaw - out.pelvisYaw) * w;
  out.chestYaw += (th.chestYaw - out.chestYaw) * w;
  out.pitch += (th.pitch - out.pitch) * w;
  out.drop += (th.drop - out.drop) * w;
}

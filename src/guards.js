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

import { SKILL, JOINTS } from './config.js';

const RAW = [
  // 이름, 패드 [x, y], 손 [앞, 위, 옆], 칼끝 [올려본 각, 옆 각], 골반 yaw, 가슴 yaw, 숙이기, 낮추기(m)
  { name: '지붕 (폼 타크)', desc: '머리 위에서 내려벤다', pad: [0.02, 0.52], hand: [0.18, 0.55, 0.06], blade: [100, 0], pelvisYaw: 25, chestYaw: 30, pitch: 0, drop: 0.05 },
  // 어깨 위 지붕: 칼을 오른쪽 어깨에 얹어 뒤로 눕힌 자세. 사선 베기(분노의 베기)가 여기서 시작한다
  { name: '어깨 지붕 (폼 타크)', desc: '어깨에서 비스듬히 내려벤다', pad: [0.42, 0.42], hand: [0.12, 0.14, 0.2], blade: [55, 170], pelvisYaw: 35, chestYaw: 45, pitch: 3, drop: 0.06 },
  { name: '황소 (옥스)', desc: '머리 옆에서 얼굴을 찌른다', pad: [0.22, 0.26], hand: [0.28, 0.29, 0.22], blade: [-15, -12], pelvisYaw: 25, chestYaw: 30, pitch: 3, drop: 0.07 },
  { name: '긴 자세 (랑오르트)', desc: '칼끝을 뻗어 거리를 잰다', pad: [0.0, 0.03], hand: [0.57, 0.07, 0.03], blade: [-3, 0], pelvisYaw: -20, chestYaw: -20, pitch: 8, drop: 0.07 },
  // 옆 자세: 가로베기(Mittelhau/Zwerchhau)를 준비하려고 칼을 옆으로 눕혀 뒤로 뺀 자세 (추정)
  { name: '옆 자세', desc: '옆으로 젖혀 가로로 벤다', pad: [0.52, 0.03], hand: [0.15, 0.12, 0.28], blade: [5, 110], pelvisYaw: 30, chestYaw: 45, pitch: 2, drop: 0.06 },
  { name: '쟁기 (플루크)', desc: '허리에서 겨누는 기본 자세', pad: [0.18, -0.28], hand: [0.28, -0.31, 0.15], blade: [30, -12], pelvisYaw: 25, chestYaw: 25, pitch: 5, drop: 0.07 },
  { name: '바꿈 (베크셀)', desc: '아래에서 올려벤다', pad: [0.38, -0.44], hand: [0.25, -0.33, 0.2], blade: [-45, 40], pelvisYaw: 10, chestYaw: 15, pitch: 5, drop: 0.07 },
  { name: '옆 지킴 (네벤후트)', desc: '칼을 뒤로 숨겨 길이를 감춘다', pad: [0.55, -0.26], hand: [0.08, -0.31, 0.24], blade: [-35, 150], pelvisYaw: 40, chestYaw: 45, pitch: 5, drop: 0.08 },
  { name: '바보 (알버)', desc: '빈틈을 보여 끌어들인다', pad: [0.0, -0.5], hand: [0.4, -0.33, 0.02], blade: [-40, 0], pelvisYaw: -15, chestYaw: -10, pitch: 8, drop: 0.07 },
  // 왼쪽 (칼 든 반대쪽): 오른쪽 자세를 거울에 비춘 것 + 사선 베기가 끝나는 왼쪽 바꿈 자세
  { name: '왼 어깨 지붕 (폼 타크)', desc: '왼 어깨에서 비스듬히 내려벤다', pad: [-0.4, 0.42], hand: [0.16, 0.14, -0.14], blade: [55, -170], pelvisYaw: -30, chestYaw: -40, pitch: 3, drop: 0.06 },
  { name: '왼 황소 (옥스)', desc: '왼쪽 머리 옆에서 찌른다', pad: [-0.22, 0.26], hand: [0.28, 0.29, -0.12], blade: [-15, 12], pelvisYaw: -20, chestYaw: -30, pitch: 3, drop: 0.07 },
  { name: '왼 옆 자세', desc: '왼쪽으로 젖혀 가로로 벤다', pad: [-0.52, 0.03], hand: [0.2, 0.12, -0.18], blade: [5, -110], pelvisYaw: -30, chestYaw: -45, pitch: 2, drop: 0.06 },
  { name: '왼 쟁기 (플루크)', desc: '왼 허리에서 겨눈다', pad: [-0.18, -0.28], hand: [0.28, -0.31, -0.06], blade: [30, 12], pelvisYaw: -20, chestYaw: -20, pitch: 5, drop: 0.07 },
  { name: '왼 바꿈 (베크셀)', desc: '사선 베기가 끝나는 자리', pad: [-0.4, -0.42], hand: [0.32, -0.31, -0.1], blade: [-45, -40], pelvisYaw: -30, chestYaw: -40, pitch: 12, drop: 0.08 },
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
  { name: '내려찍기 겨눔', desc: '쓰러진 상대를 내려 겨눈다', finish: 'hover', pads: [[0.18, -0.28], [-0.18, -0.28], [0.55, -0.26]] },
  { name: '내려찍기', desc: '쓰러진 상대를 찍는다', finish: 'strike', pads: [[0.0, -0.5], [0.38, -0.44], [-0.4, -0.42]] },
];
const NBASE = BASE.length;
// GUARDS 뒤쪽 두 개는 마무리 자세 (자세 이름 표시·nearest 용. 평소 섞기에는 들어가지 않는다)
export const GUARDS = [...BASE, ...FINISH_GUARDS.map((g) => ({ ...g, pad: g.pads[0], hand: [0, 0, 0], dir: [1, 0, 0], pelvisYaw: 0, chestYaw: 0, pitch: 0, drop: 0 }))];

// 한손 무기(weapons.js oneHandStance: 세이버·팔쉬온·청강검·레이피어·나뭇가지·고무 닭. 라이트세이버는 뺀다)의 자세 — 무기 종류별 두 표
//  (동작 연구 PM 10/1, docs/motion/one_hand_guards_2026-10-01.md — 값마다 근거). 패드 자리·자세 수·순서는 두손 표와 같고,
//  손·칼끝·몸 돌림만 다르다. 손은 칼 든 어깨에서 팔 길이(0.565 m) 안, 어깨 들림 면 ≤ 110°(사람 수평 모음 130~140° 안).
//  yaw 가 − 이면 칼 든 어깨가 앞으로 나온다(도). blade 는 [올려본 각, 옆 각] (두손 표와 같은 뜻), 없으면 교본 자세 그대로.
//  · ONE_HAND_THRUST (찌르기 칼: 레이피어·청강검, 한손으로 쥐는 에스톡류): 전방 자세만 — 칼끝은 늘 상대 쪽(테르차·콰르타·프리마·세콘다 류),
//    몸은 옆으로 세운다. 베기는 손목 베기(작은 호). 칼을 옆으로 눕히거나 팔을 수평으로 펴는 자세가 없다.
//  · ONE_HAND_SABRE (세이버·팔쉬온, 날 없는 한손 무기 — 나뭇가지·고무 닭 — 도 이 표): 감는 자세는 팔꿈치를 굽혀
//    칼을 어깨·머리 옆에 둔다(어깨 걸침·걸친 막기 류). 팔을 수평으로 펴지 않는다. 겨누는 자세는 지금(10라운드 B)과 같다.
//  · ONE_HAND_VERSATILE (두루 한손 칼: 청강검 — 10/9 고침, docs/strike/qinggang_floor_2026-10-09.md 안 A): 겨누는 6 곳은 THRUST,
//    베기를 감는 8 곳은 SABRE (아래 VERSATILE_CHAMBER). 劍의 "겨눠 찌르고, 감아 벤다".
//  고르는 규칙: weapon_class.js classifyStyle 이 'thrust' → THRUST, 'versatile'(청강검) → SKILL.oneVersatileTable 손잡이
//   ('mixed' 기본 = VERSATILE · 'thrust' = 10/9 고침 전 THRUST · 'cut' = SABRE 통째, 안 B), 그 밖('cut'·'blunt') → SABRE.
//   guardBaseOne(style) 이 표를 돌려준다. GUARD_BASE_ONE 은 예전 이름 그대로 SABRE 표(뜻이 같은 기본값).
const ONE_HAND_THRUST = {
  '지붕 (폼 타크)': { hand: [0.32, 0.38, 0.1], blade: [-25, -6], pelvisYaw: -20, chestYaw: -35, pitch: 4 },
  '어깨 지붕 (폼 타크)': { hand: [0.38, 0.18, 0.24], blade: [-12, -10], pelvisYaw: -20, chestYaw: -35, pitch: 4 },
  '황소 (옥스)': { hand: [0.4, 0.24, 0.17], blade: [-15, -10], pelvisYaw: -15, chestYaw: -30 },
  '긴 자세 (랑오르트)': { hand: [0.68, 0.08, 0.1], blade: [-3, 0], pelvisYaw: -35, chestYaw: -45, pitch: 10 },
  '옆 자세': { hand: [0.36, -0.04, 0.26], blade: [2, -16], pelvisYaw: -20, chestYaw: -35, pitch: 4 },
  '쟁기 (플루크)': { hand: [0.4, -0.22, 0.13], blade: [30, -12], pelvisYaw: -10, chestYaw: -25, pitch: 5 },
  '바꿈 (베크셀)': { hand: [0.38, -0.3, 0.18], blade: [-10, -10], pelvisYaw: -15, chestYaw: -30, pitch: 6 },
  '옆 지킴 (네벤후트)': { hand: [0.24, -0.24, 0.24], blade: [12, -8], pelvisYaw: -10, chestYaw: -25, pitch: 5 },
  '바보 (알버)': { hand: [0.46, -0.28, 0.07], blade: [-20, 0], pelvisYaw: -25, chestYaw: -25, pitch: 8 },
  '왼 어깨 지붕 (폼 타크)': { hand: [0.42, 0.2, -0.04], blade: [-12, 10], pelvisYaw: -25, chestYaw: -40, pitch: 4 },
  '왼 황소 (옥스)': { hand: [0.44, 0.22, -0.02], blade: [-12, 8], pelvisYaw: -25, chestYaw: -40, pitch: 4 },
  '왼 옆 자세': { hand: [0.44, 0.0, -0.08], blade: [0, 12], pelvisYaw: -25, chestYaw: -40, pitch: 4 },
  '왼 쟁기 (플루크)': { hand: [0.42, -0.2, -0.04], blade: [22, 12], pelvisYaw: -25, chestYaw: -40, pitch: 5 },
  '왼 바꿈 (베크셀)': { hand: [0.42, -0.3, -0.06], blade: [-15, 10], pelvisYaw: -25, chestYaw: -40, pitch: 8 },
};
const ONE_HAND_SABRE = {
  '지붕 (폼 타크)': { hand: [0.2, 0.45, 0.12], blade: [95, 0], pelvisYaw: 5, chestYaw: -10, pitch: 0 },
  '어깨 지붕 (폼 타크)': { hand: [0.2, 0.18, 0.24], blade: [40, 170], pelvisYaw: 10, chestYaw: 0, pitch: 3 },
  '황소 (옥스)': { hand: [0.36, 0.26, 0.17], blade: [-15, -12], pelvisYaw: 0, chestYaw: -15, pitch: 3 },
  '긴 자세 (랑오르트)': { hand: [0.68, 0.08, 0.1], blade: [-3, 0], pelvisYaw: -35, chestYaw: -45, pitch: 10 },
  '옆 자세': { hand: [0.14, 0.24, 0.3], blade: [30, 150], pelvisYaw: 10, chestYaw: 5, pitch: 2 },
  '쟁기 (플루크)': { hand: [0.4, -0.22, 0.13], blade: [30, -12], pelvisYaw: -10, chestYaw: -25, pitch: 5 },
  '바꿈 (베크셀)': { hand: [0.3, -0.25, 0.2], blade: [-40, 30], pelvisYaw: -5, chestYaw: -15, pitch: 5 },
  '옆 지킴 (네벤후트)': { hand: [0.1, -0.2, 0.26], blade: [-35, 150], pelvisYaw: 10, chestYaw: 5, pitch: 5 },
  '바보 (알버)': { hand: [0.46, -0.28, 0.07], blade: [-40, 0], pelvisYaw: -25, chestYaw: -25, pitch: 8 },
  '왼 어깨 지붕 (폼 타크)': { hand: [0.24, 0.2, -0.04], blade: [45, -160], pelvisYaw: -25, chestYaw: -40, pitch: 3 },
  '왼 황소 (옥스)': { hand: [0.34, 0.28, 0.0], blade: [-15, 12], pelvisYaw: -20, chestYaw: -35, pitch: 3 },
  '왼 옆 자세': { hand: [0.24, 0.14, -0.02], blade: [25, -150], pelvisYaw: -25, chestYaw: -40, pitch: 2 },
  '왼 쟁기 (플루크)': { hand: [0.36, -0.22, 0.0], blade: [25, 12], pelvisYaw: -20, chestYaw: -35, pitch: 5 },
  '왼 바꿈 (베크셀)': { hand: [0.36, -0.28, -0.02], blade: [-45, -40], pelvisYaw: -25, chestYaw: -40, pitch: 10 },
};
// 한손 칼끝 고침 (10/9 사장님 '칼끝이 지면으로 누운 채 내 쪽을 향해 칼을 거꾸로 든 것 같다' · 10/10 '칼끝 계속 이상하더라' — docs/motion/onehand_tip_2026-10-10.md, 확인표 524·525).
//  위 세이버 표의 감는 자리 다섯은 두손 롱소드 감기(칼끝 뒤 145~170°)를 옮긴 값이라 칼끝이 누운 채(올림 −36~47°) 몸 뒤쪽을 본다 — 쉼 무게가 이 표로 끌면
//  한손 칼이 거꾸로 쥔 칼처럼 보인다. 한손 교본(마이어 1570 두삭 Wacht·Entrüst·Eber, 카포 페로 1610 테르차, 조선세법 直符送書)에 '칼끝이 누운 채 자기 쪽'인 자세는 없다:
//  어깨에 메는 자세·옆 자세는 칼끝을 분명히 위로 세우고(올림 → 55~60°, 두삭 Wacht·Entrüst — 칼을 세워 어깨 옆에 든다. 옆 자세 방위는 뒤 150 → 120°로 덜 눕혀 가로 베기 호는 지킴),
//  낮은 옆 지킴은 칼끝을 분명히 아래·앞 바깥으로 둔다(올림 −45°, 방위 60° — 두삭 Eber·Nebenhut). 손 자리·몸 돌림은 그대로.
//  (10/9 첫 안의 옆 자세 [30, ±110] 은 칼끝을 옆으로 누인 채라 사장님 10/10 화면의 꼴 그대로여서 버림.)
//  JOINTS.oneTip 'off' (`?onetip=off`·ONETIP=off) = 전 값. 청강검 두루 표(감는 8 곳 = 세이버 값)도 함께 따른다
const ONE_HAND_SABRE_TIP = {
  '어깨 지붕 (폼 타크)': [60, 165], // 전 [40, 170]
  '옆 자세': [60, 120], // 전 [30, 150]
  '옆 지킴 (네벤후트)': [-45, 60], // 전 [-35, 150]
  '왼 어깨 지붕 (폼 타크)': [60, -160], // 전 [45, -160]
  '왼 옆 자세': [55, -120], // 전 [25, -150]
};
if (JOINTS.oneTip !== 'off') for (const [k, b] of Object.entries(ONE_HAND_SABRE_TIP)) ONE_HAND_SABRE[k] = { ...ONE_HAND_SABRE[k], blade: b };
// 두루 한손 표 (10/9 청강검 바닥 고침 안 A): 찌르기 표에서 베기를 감는 8 곳만 세이버 표 값으로 바꾼다.
//  찌르기 표의 이 자리들은 칼끝이 늘 상대 쪽(올려본 각 −25~+12°)이라 자세에서 자세로 가는 베기 길에서 칼이 돌지 않았다
//  (zornhau 7.7 m/s · 45 J → 섞은 표 17.8 m/s · 261 J). 황소·긴 자세·쟁기·바보·왼쪽 황소·왼쪽 쟁기(겨눔 6 곳)는 찌르기 표 그대로.
//  자리 이름(name)은 바탕 그대로라 유파 이름 덮개(schools.js names)·frames.js FRAME_GUARDS 열쇠가 그대로 맞는다
const VERSATILE_CHAMBER = ['지붕 (폼 타크)', '어깨 지붕 (폼 타크)', '옆 자세', '바꿈 (베크셀)', '옆 지킴 (네벤후트)', '왼 어깨 지붕 (폼 타크)', '왼 옆 자세', '왼 바꿈 (베크셀)'];
const ONE_HAND_VERSATILE = { ...ONE_HAND_THRUST };
for (const k of VERSATILE_CHAMBER) ONE_HAND_VERSATILE[k] = ONE_HAND_SABRE[k];
function oneHandTable(over) {
  return BASE.map((g) => {
    const o = over[g.name];
    if (!o) return g;
    const out = { ...g, hand: o.hand, pelvisYaw: o.pelvisYaw * D2R, chestYaw: o.chestYaw * D2R, pitch: o.pitch != null ? o.pitch * D2R : g.pitch, drop: o.drop ?? g.drop };
    if (o.blade) {
      const el = o.blade[0] * D2R, az = o.blade[1] * D2R;
      out.blade = o.blade;
      out.dir = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
    }
    return out;
  });
}
// 두손 찌르기 칼(frame two + style thrust — 지금은 에스톡뿐)의 자세 (동작 연구 PM 10/1, docs/motion/two_hand_thrust_guards_2026-10-01.md).
//  베기를 감는 자세(지붕·어깨 지붕·옆 자세·바꿈·옆 지킴·바보와 왼쪽 짝)를 칼끝이 늘 상대 쪽인 두손 찌르기 자세로 바꾼다
//  (Fiore Posta Longa·Breve·Finestra·Porta di Ferro Mezzana, 독일식 Ochs·Pflug 변형. 하프소딩은 넣지 않음).
//  황소·쟁기·긴 자세·왼쪽 황소·왼쪽 쟁기는 두손 표 값 그대로. 손 = 앞손, 빈손은 칼자루 끝(폼멜)을 잡는다 — 두 손 모두 두손 표의 끝값 안
const TWO_HAND_THRUST = {
  '지붕 (폼 타크)': { hand: [0.24, 0.38, 0.08], blade: [-22, -4], pelvisYaw: 20, chestYaw: 25, pitch: 2, drop: 0.05 },
  '어깨 지붕 (폼 타크)': { hand: [0.22, 0.35, 0.21], blade: [-20, -14], pelvisYaw: 30, chestYaw: 35, pitch: 3, drop: 0.06 },
  '황소 (옥스)': { hand: [0.28, 0.29, 0.22], blade: [-15, -12], pelvisYaw: 25, chestYaw: 30, pitch: 3, drop: 0.07 },
  '긴 자세 (랑오르트)': { hand: [0.57, 0.07, 0.03], blade: [-3, 0], pelvisYaw: -20, chestYaw: -20, pitch: 8, drop: 0.07 },
  '옆 자세': { hand: [0.26, 0.0, 0.18], blade: [5, -14], pelvisYaw: 25, chestYaw: 30, pitch: 4, drop: 0.07 },
  '쟁기 (플루크)': { hand: [0.28, -0.31, 0.15], blade: [30, -12], pelvisYaw: 25, chestYaw: 25, pitch: 5, drop: 0.07 },
  '바꿈 (베크셀)': { hand: [0.26, -0.28, 0.12], blade: [18, -14], pelvisYaw: 20, chestYaw: 20, pitch: 5, drop: 0.07 },
  '옆 지킴 (네벤후트)': { hand: [0.2, -0.22, 0.18], blade: [15, -10], pelvisYaw: 30, chestYaw: 35, pitch: 5, drop: 0.08 },
  '바보 (알버)': { hand: [0.32, -0.28, 0.04], blade: [15, 0], pelvisYaw: -10, chestYaw: -5, pitch: 6, drop: 0.07 },
  '왼 어깨 지붕 (폼 타크)': { hand: [0.22, 0.35, -0.12], blade: [-20, 14], pelvisYaw: -20, chestYaw: -30, pitch: 3, drop: 0.06 },
  '왼 황소 (옥스)': { hand: [0.28, 0.29, -0.12], blade: [-15, 12], pelvisYaw: -20, chestYaw: -30, pitch: 3, drop: 0.07 },
  '왼 옆 자세': { hand: [0.3, 0.0, -0.04], blade: [5, 14], pelvisYaw: -20, chestYaw: -25, pitch: 4, drop: 0.07 },
  '왼 쟁기 (플루크)': { hand: [0.28, -0.31, -0.06], blade: [30, 12], pelvisYaw: -20, chestYaw: -20, pitch: 5, drop: 0.07 },
  '왼 바꿈 (베크셀)': { hand: [0.3, -0.3, -0.05], blade: [15, 14], pelvisYaw: -25, chestYaw: -30, pitch: 8, drop: 0.08 },
};
const BASE_ONE_THRUST = oneHandTable(ONE_HAND_THRUST);
const BASE_ONE_SABRE = oneHandTable(ONE_HAND_SABRE);
const BASE_ONE_VERSATILE = oneHandTable(ONE_HAND_VERSATILE);
const BASE_TWO_THRUST = oneHandTable(TWO_HAND_THRUST);

/** 동작 라이브러리(motion_library.js)가 몸 틀별 자세표를 만들 때 바탕으로 쓰는 표 (교본 자세 NBASE 개, 같은 패드 자리) */
export const GUARD_BASE = BASE;
export const GUARD_BASE_ONE = BASE_ONE_SABRE;
export const GUARD_BASE_ONE_THRUST = BASE_ONE_THRUST;
export const GUARD_BASE_ONE_SABRE = BASE_ONE_SABRE;
export const GUARD_BASE_ONE_VERSATILE = BASE_ONE_VERSATILE;
/** 한손 무기 자세표 고르기 — style = weapon_class.js classifyStyle 값. 'versatile'(청강검)만 SKILL.oneVersatileTable 을 읽는다 */
export function guardBaseOne(style) {
  if (style === 'thrust') return BASE_ONE_THRUST;
  if (style === 'versatile') {
    const t = SKILL.oneVersatileTable;
    return t === 'thrust' ? BASE_ONE_THRUST : t === 'cut' ? BASE_ONE_SABRE : BASE_ONE_VERSATILE;
  }
  return BASE_ONE_SABRE;
}
export const GUARD_BASE_TWO_THRUST = BASE_TWO_THRUST;
/** 두손 무기 자세표 고르기 — style 'thrust'(에스톡) → 두손 찌르기 표, 그 밖은 교본 표 그대로 */
export function guardBaseTwo(style) {
  return style === 'thrust' ? BASE_TWO_THRUST : BASE;
}

// ── 이베리아 몬탄테 자세표 (10/10 사장님 '레이피어 고증하듯이 이베리아도 고증해' — docs/motion/iberian_montante_2026-10-10.md) ──
//  유파 자세표(TRADITIONS.iberian.guardTable)로 앞무게 틀 표(frames.js FRAME_GUARDS.heavy)를 고른 **뒤에** 적힌 자리만 덮는다 — 다른 앞무게(모노호시자오·참치)·두손 무기는 바이트 그대로.
//  열쇠 = 바탕 자리 이름(GUARDS name 글자 그대로), 값 = { hand [앞, 위, 칼 든 쪽] m · blade [올려본 각, 옆 각] ° · pelvisYaw·chestYaw·pitch ° · drop m } (덮는 함수 applySchoolGuardTable).
//  Destreza 말: postura recta = 칼을 얼굴 앞에 곧게 · linha obtusa = 칼끝이 수평 위로 든 비낀 줄(acute = 아래) — 피게이레두는 데스트레자 사범(곤살루 바르보자 문하)
//  피 단Ⅰ = 피게이레두 1651 단순 규칙 Ⅰ, 피 복ⅩⅣ = 복합 규칙 ⅩⅣ (Myers·Hick 영역, Wiktenauer). 손 높이·각 숫자는 원문에 없다 → [해석] [모두 사장님 확인 전 — 확인표 660~]
//  끄기: schools.js SCHOOL_ART.table = false (도구) → 전 값(앞무게 틀 표 그대로). 부르는 곳은 sword_art.js resolveSwordArt (무기 틀 표를 만든 뒤)
export const IBERIAN_TABLE = {
  // 곧은 자세: 베기마다 몬탄테를 얼굴 앞에 멈춘다 — 「stopping with the montante in right angle in front of the face」(단Ⅰ) · 「the point forward and the hands high in front of the eyes」(단Ⅱ)
  //  · 「always you will stop the montante in front of the face」(복Ⅶ) · 몸은 곧게(「place your body straight」 단Ⅰ). 손 = 눈 아래 얼굴 앞, 칼끝 앞으로 조금 들어 [해석]
  //  칼끝 20 → 30° (10/10 14:5x 사장님 '빈손 놓침 ①만 고쳐' — 확인표 684·686~, 문서 §11): 손 뒤 0.30 m 의 폼멜(왼손 쥘 자리)이 가슴 겉면(앞 0.11)에 붙어 있어
  //   자세를 옮길 때 가슴 안으로 들어가 왼손이 놓쳤다. 칼끝을 10° 더 들어 폼멜을 가슴 밖·아래로 — 손 자리는 그대로(「hands high in front of the eyes」), 칼끝은 여전히 앞(「the point forward」) [해석]
  '긴 자세 (랑오르트)': { hand: [0.4, 0.22, 0.04], blade: [30, 0], pelvisYaw: 0, chestYaw: 0, pitch: 0, drop: 0.06, src: '피 단Ⅰ·단Ⅱ·복Ⅰ·복Ⅶ [원문] · 손 높이·칼끝 30° [해석]' },
  // 오른 높이 비낌: 레베스를 아래에서 올려 「ending with the montante high along the right diagonal in an obtuse line」(복ⅩⅤ) · 「raise the montante with the point forward in front of the right ear」(복Ⅱ)
  //  올려본 각 30 → 45° (10/10 14:5x 빈손 ①, 문서 §11): 놓침 ① 의 가장 큰 자리 — 30° 에선 폼멜이 가슴 안(가슴 몸체 앞 0.04 m)으로 들어갔다.
  //   'obtuse line' = 칼끝이 수평 위(0~90°)로 든 줄이라 45° 도 원문 안 — 그 가운데 [해석]. 손 자리·옆 각은 그대로
  '황소 (옥스)': { hand: [0.3, 0.3, 0.18], blade: [45, 15], pelvisYaw: 15, chestYaw: 20, pitch: 2, drop: 0.06, src: '피 복Ⅱ·복ⅩⅤ [원문] · 각 45° [해석]' },
  // 왼 높이 비낌: 탈류를 아래에서 올려 「bringing the montante to stop high in front of the head on the left side, in obtuse line along the diagonal」(복ⅩⅤ)
  //  올려본 각 30 → 45° (10/10 빈손 ①, 문서 §11): 같은 원문 줄(복ⅩⅤ 'obtuse line')의 거울 — 오른쪽과 같게
  '왼 황소 (옥스)': { hand: [0.3, 0.3, -0.08], blade: [45, -15], pelvisYaw: -15, chestYaw: -20, pitch: 2, drop: 0.06, src: '피 복ⅩⅤ [원문] · 각 45° [해석]' },
  // 비낀 자세: 「the montante in obtuse angle along the right diagonal, such that the right hand rests in front of the belt to deflect the thrust」(복ⅩⅣ 첫 자세)
  '쟁기 (플루크)': { hand: [0.3, -0.22, 0.1], blade: [40, 20], pelvisYaw: 10, chestYaw: 10, pitch: 4, drop: 0.07, src: '피 복ⅩⅣ [원문] · 각 [해석]' },
  // 왼 비낀 자세: 「the montante in obtuse angle along the left diagonal to deflect by revez the thrusts aimed at the right side」(복ⅩⅣ 둘째 자세)
  '왼 쟁기 (플루크)': { hand: [0.3, -0.22, -0.04], blade: [40, -20], pelvisYaw: -10, chestYaw: -10, pitch: 4, drop: 0.07, src: '피 복ⅩⅣ [원문] · 각 [해석]' },
  // 칼끝 땅에: 「your body straight with the left foot in front, the montante with the point on the ground」 — 모든 규칙이 여기서 시작해 여기로 끝난다(단Ⅰ)
  '바보 (알버)': { hand: [0.38, -0.33, 0.02], blade: [-55, 0], pelvisYaw: 0, chestYaw: 0, pitch: 4, drop: 0.05, src: '피 단Ⅰ [원문] · 각 [해석]' },
  // ── 지나는 자리 8 (10/10 23:3x 사장님 '빌려온 자세 다 고치고' — 문서 §16, 확인표 820~). 전: 앞무게 틀 값(일본 검도 조단·핫소·왼 핫소·와키가마에) · 교본 표 값(롱소드 옆 자세 둘·바꿈 둘).
  //  원전 바탕: 피게이레두의 베기는 '뒤에서(por detras) 아래에서 위로' 올리고, 머리 위로 넘겨 어깨 뒤로(복Ⅱ 「por sima da cabeça às espaldas」), 몸에 둘러 감고(cingido — 복Ⅱ·복Ⅺ·복ⅩⅢ·복ⅩⅤ),
  //  내려 벤 칼(altabaxo)은 그 쪽에 떨어져 멈췄다가 거기서 다시 올라간다(복Ⅰ 「deyxará cair o Montante pela parte dereyta … e da parte donde veo o Montante a parar se dará hũ talho de baxo para sima」).
  //  고디뉴: 베기가 지나 머리 위로 돌아 칼끝은 땅으로, 날밑이 머리를 덮은 채 다음 베기를 감는다(규칙 4·5) · 칼이 갈비를 휘감고 온몸이 돈다(규칙 8) · 탈류는 높이 감아 위에서 아래로(규칙 3) · 가로는 몸 가운데 높이(규칙 9).
  //  패드 자리는 그대로(기술 길의 열쇠), 손·칼끝·몸만. 손 높이·각 숫자는 원문에 없다 → [해석]
  //  (10/11 00:2x 규칙 — 원전에 꼴 글이 없는 자리: 기존 자료에서 추론 / 유파 일관성으로 직접 개발, 칸마다 어느 쪽인지 적음.) 꼴 글이 있는 자리 = 어깨 둘(고 규칙 4)·머리 위(피 복Ⅱ) ·
  //   원문의 베기 흐름에서 꼴을 추론한 자리 = 바꿈 둘(피 복Ⅰ)·옆 자세·옆 지킴(피 복Ⅺ·고 규칙 8·9) · 유파 일관성(거울)으로 만든 자리 = 왼 옆 자세. 왼 바꿈 옆 각은 직접 판단(아래)
  // 머리 위(altibaxo): 머리 위로 넘기는 자리 — 손은 머리 위(날밑이 머리를 덮음, 고 규칙 4·5), 칼은 어깨 뒤로 넘어가는 중(피 복Ⅱ·복ⅩⅥ). 곧게 내려베기(altabaxo)는 몸을 곧게(피 단Ⅰ)
  //  (처음 안 손 [0.10, 0.50] · 135° 는 손이 21 cm 못 미치고 정수리 베기에서 빈손을 놓쳐(쥔 6 %) 손을 앞으로·칼을 덜 눕힘 — tools/sim/montante_pass.mjs)
  '지붕 (폼 타크)': { hand: [0.16, 0.45, 0.02], blade: [125, 0], pelvisYaw: 5, chestYaw: 5, pitch: 0, drop: 0.05, src: '피 복Ⅱ·복ⅩⅥ 머리 위로 넘김 · 고 규칙 3·4·5 [원문] · 손 높이·각 125° [해석]' },
  // 탈류 준비: 손은 머리 오른쪽 높이, 칼은 오른 어깨 뒤로 늘어뜨려 칼끝은 땅 쪽 — '뒤에서(por detras)' 감는 자리(피 단Ⅰ·단Ⅲ) · 「zum Tajo aufgezogen … Ort zum Boden … Parierstange den Kopf deckt」(고 규칙 4)
  //  · 어깨에서 감음(고 규칙 6 「bei der Schulter aufgezogen」) · 「cingir o montante com o braço dereyto」(피 복ⅩⅤ)
  //  칼끝 −15°: −30°(고디뉴 '땅으로' 끝) 은 분노의 베기 지표 166 → 97 J(날 맞춤 82) 로 휘어 −15° 로 — 여전히 땅 쪽, 어깨 뒤 [해석]
  '어깨 지붕 (폼 타크)': { hand: [0.08, 0.36, 0.18], blade: [-15, 150], pelvisYaw: 30, chestYaw: 40, pitch: 0, drop: 0.06, src: '피 단Ⅰ·단Ⅲ·복ⅩⅤ · 고 규칙 4·6 [원문] · 손·각 [해석]' },
  // 레베스 준비: 머리 위로 넘긴 칼이 어깨 뒤로 「falls over the left arm to give a circling revez」(피 복Ⅱ) · 「cingindo o montante ao hombro esquerdo」(피 복ⅩⅤ) · 「talho para o hombro esquerdo」(피 단Ⅰ 끝)
  //  · 「aufgezogen zu einem Reves … Ort zum Boden … Parierstange deckt deinen Kopf」(고 규칙 4) · 오른팔이 왼팔 위로 엇갈림(피 복Ⅰ 「cruzando o braço direito sobre o esquerdo」)
  '왼 어깨 지붕 (폼 타크)': { hand: [0.06, 0.36, -0.1], blade: [-30, -150], pelvisYaw: -25, chestYaw: -30, pitch: 0, drop: 0.06, src: '피 복Ⅰ·복Ⅱ·복ⅩⅤ·단Ⅰ · 고 규칙 4 [원문] · 손·각 [해석]' },
  // 가로 탈류: 칼을 오른쪽 몸 가운데 높이에 눕혀 뒤로 감아 둔다 — 「talho orizontal」(피 단Ⅺ·복Ⅺ) · 「in mittlerer Höhe」(고 규칙 9) · 가로 베기를 몸에 둘러 감음(피 복Ⅺ 「revez orizontal cingido」)
  '옆 자세': { hand: [0.14, 0.04, 0.26], blade: [10, 130], pelvisYaw: 35, chestYaw: 45, pitch: 2, drop: 0.06, src: '피 단Ⅺ·복Ⅺ · 고 규칙 9 [원문] · 손·각 [해석]' },
  // 가로 레베스: 거울 — 오른팔이 왼팔 위로 엇갈려(피 복Ⅰ) 왼쪽 몸 가운데 높이, 칼은 왼쪽 뒤로 감김(피 복Ⅺ 「revez orizontal cingido」)
  '왼 옆 자세': { hand: [0.18, 0.04, -0.14], blade: [10, -130], pelvisYaw: -30, chestYaw: -40, pitch: 2, drop: 0.06, src: '피 단Ⅺ·복Ⅰ·복Ⅺ · 고 규칙 9 [원문] · 손·각 [해석]' },
  // 아래 탈류: 오른쪽으로 떨어진 칼이 멈춘 자리, 거기서 '뒤에서 아래에서 위로' 탈류를 올린다 — 「deyxará cair o Montante pela parte dereyta … e da parte donde veo o Montante a parar se dará hũ talho de baxo para sima」(피 복Ⅰ)
  //  · 「talho por detras, de baxo para sima」(피 단Ⅰ). 칼끝은 오른쪽 아래 뒤로(뒤에서 올라오는 길의 시작) [해석]
  '바꿈 (베크셀)': { hand: [0.2, -0.3, 0.22], blade: [-50, 130], pelvisYaw: 25, chestYaw: 30, pitch: 4, drop: 0.07, src: '피 단Ⅰ·복Ⅰ [원문] · 손·각 [해석]' },
  // 뒤 탈류: 칼이 오른 갈비를 휘감은 자리 — 「umgürtet das Montante die gesamten Rippen, auch den gesamten Körper herumdrehend」(고 규칙 8) · 「cingir o montante com o braço dereyto」(피 복ⅩⅤ) · 뒤에서 앞으로 탈류(피 단Ⅲ 「talho por detraz」)
  //  갈비 높이(손 위 −0.12)·칼 수평은 몸에 걸려 칼끝 오차 85°·빈손 0 % — 아래 갈비 높이(−0.18)·칼 −15° 로 [해석]
  '옆 지킴 (네벤후트)': { hand: [0.08, -0.18, 0.26], blade: [-15, 160], pelvisYaw: 40, chestYaw: 50, pitch: 3, drop: 0.07, src: '고 규칙 8 · 피 단Ⅲ·복ⅩⅤ [원문] · 손·각 [해석]' },
  // 아래 레베스: 왼쪽으로 떨궈(오른팔이 왼팔 위로 엇갈려) 내려 벤 칼이 멈춘 자리, 거기서 레베스를 아래에서 위로 — 「deyxará cair o montante pella parte esquerda cruzando o braço deryeto sobre o esquerdo, e se dará hũ altabaxo de revez …
  //  e da parte donde ficou o montante se dará hũ revez de baxo para sima」(피 복Ⅰ) · 「altibaxo pella mesma parte esquerda cingindo o montante ao hombro esquerdo」(피 복ⅩⅤ)
  //  옆 각 −110°(오른쪽 130° 보다 덜 뒤): 엇갈린 오른팔이 왼 허리로 오면 칼이 덜 뒤로 돈다 [해석] — −130° 는 왼 올려베기 날 맞춤 101 → 40 J
  '왼 바꿈 (베크셀)': { hand: [0.24, -0.28, -0.1], blade: [-50, -110], pelvisYaw: -25, chestYaw: -35, pitch: 6, drop: 0.07, src: '피 복Ⅰ·복ⅩⅤ [원문] · 손·각 [해석]' },
};

/**
 * 유파 자세표 덮기 (10/10 — 사장님 13:4x '규칙을 풀어': 유파마다 자기 자세표(원전 값)를 가져도 된다). 무기 틀 표를 고른 **뒤에** 적힌 자리만 덮는다.
 *  table: 무기 틀 표(GUARDS 와 같은 차례 — 없으면 교본 표 BASE) · tradition: 유파 칸 객체 TRADITIONS[t] (guards.js 가 schools.js 를 부르면 순환이라 객체를 받는다)
 *  tradition.guardTable 이 없으면 table 을 그대로 돌려준다(전과 같음). 자리 열쇠는 바탕 이름(GUARDS[i].name) — 틀 표가 이름을 바꿔도(상단·추단…) 맞는다.
 *  보이는 이름·설명은 바꾸지 않는다(HUD 이름은 TRADITIONS[t].names). 단 칸에 name·desc 가 적혀 있으면 그 칸 이름도 바꾼다 — 10/10 이탈리아 레이피어 고증:
 *   hands.js 레이피어 손 돌림이 표 칸 이름의 Prima·Seconda·Terza·Quarta 를 읽기 때문(이베리아 칸엔 name 이 없어 그대로)
 */
// 이베리아 자세표 칸 걷기 시험 (10/22 — docs/strike/iberian_flat_hits_2026-10-22.md · 기본 판은 부르지 않음 · 사장님 확인 전): 짧은 이름 → 칸 이름 · 묶음
//  wait = 기다리는 자리 여섯 · pass = 지나는 자리 여덟 (위 머리말). 걷은 칸은 앞무게 틀 표 값으로 돌아간다(frames.js FRAME_GUARDS.heavy · 교본 표)
export const IBERIAN_TABLE_KEYS = { tag: '지붕 (폼 타크)', tagR: '어깨 지붕 (폼 타크)', tagL: '왼 어깨 지붕 (폼 타크)', langort: '긴 자세 (랑오르트)', ochsR: '황소 (옥스)', ochsL: '왼 황소 (옥스)', pflugR: '쟁기 (플루크)', pflugL: '왼 쟁기 (플루크)', alber: '바보 (알버)', sideR: '옆 자세', sideL: '왼 옆 자세', wechselR: '바꿈 (베크셀)', wechselL: '왼 바꿈 (베크셀)', neben: '옆 지킴 (네벤후트)' };
const IBERIAN_TABLE_GROUPS = { wait: ['langort', 'ochsR', 'ochsL', 'pflugR', 'pflugL', 'alber'], pass: ['tag', 'tagR', 'tagL', 'sideR', 'sideL', 'wechselR', 'wechselL', 'neben'] };
/** 시험: 이베리아 자세표에서 고른 칸을 걷는다 (짧은 이름 · 묶음 목록 — 판이 만들어지기 전에 부른다 · 프로세스 동안 남음). 모르는 이름은 던진다 */
export function skipIberianTable(names) {
  const out = [];
  for (const k of names.flatMap((x) => IBERIAN_TABLE_GROUPS[x] ?? [x])) {
    if (!IBERIAN_TABLE_KEYS[k]) throw new Error(`이베리아 자세표 칸 ${k}?`);
    if (delete IBERIAN_TABLE[IBERIAN_TABLE_KEYS[k]]) out.push(k);
  }
  return out;
}

/** 시험: 이베리아 자세표 칸 하나를 고친다 (짧은 이름 · { blade: [올려본 각, 옆 각], hand: [앞, 위, 칼 든 쪽] } 가운데 적은 것만 — 판이 만들어지기 전에 부른다 · 프로세스 동안 남음) */
export function setIberianTable(key, o) {
  const name = IBERIAN_TABLE_KEYS[key];
  if (!name || !IBERIAN_TABLE[name]) throw new Error(`이베리아 자세표 칸 ${key}?`);
  IBERIAN_TABLE[name] = { ...IBERIAN_TABLE[name], ...o };
}

// 이베리아 자세표 v2 (10/22 — 칸별 시험으로 고름 · **사장님 확인 전** · docs/strike/iberian_flat_hits_2026-10-22.md §9 · 확인표 2174~): set = 고친 칸(짧은 이름 → 바꾼 값) · skip = 걷은 칸.
//  판 기본은 부르지 않는다 — `?ibTable=v2`(사람 · AI 모두 — useIberianTableV2) · `?ibTable=v2p`(사람만 — main.js 가 플레이어 몸에 iberianTableV2() 를 넘김)
//  고른 값 (§9 칸별 시험 — 사람식 긋기 서 있는 과녁 · 막는 상대, 츠바이핸더 · 플랑베르주 · 티소나): 어느 칸도 하나만 걷거나 각을 바꿔 칼 면이 뚜렷이 줄지 않았다 —
//   점 추정이 가장 좋은 쪽만 묶음: 옆 자세 둘 옆 각 130 → 100°('몸 가운데 높이에 눕혀 뒤로 감아 둔다' 안 — 옆보다 조금 뒤) · 어깨 지붕(오른) · 왼 바꿈 걷음. 옆 자세 오른 · 옆 지킴은 걷으면 나빠져 그대로
export const IBERIAN_TABLE_V2 = { set: { sideR: { blade: [10, 100] }, sideL: { blade: [10, -100] } }, skip: ['tagR', 'wechselL'] };
/** v2 묶음을 적용한 새 자세표 칸 객체 (IBERIAN_TABLE 은 그대로) */
export function iberianTableV2() {
  const t = { ...IBERIAN_TABLE };
  for (const [k, o] of Object.entries(IBERIAN_TABLE_V2.set)) t[IBERIAN_TABLE_KEYS[k]] = { ...t[IBERIAN_TABLE_KEYS[k]], ...o };
  for (const k of IBERIAN_TABLE_V2.skip) delete t[IBERIAN_TABLE_KEYS[k]];
  return t;
}
/** v2 묶음을 판의 이베리아 자세표(사람 · AI 모두)에 건다 — 판이 만들어지기 전에 한 번 */
export function useIberianTableV2() {
  const t = iberianTableV2();
  for (const k of Object.keys(IBERIAN_TABLE)) delete IBERIAN_TABLE[k];
  Object.assign(IBERIAN_TABLE, t);
}

export function applySchoolGuardTable(table, tradition) {
  const over = tradition?.guardTable;
  if (!over) return table;
  const src = table ?? BASE;
  const res = src.map((g, i) => {
    const o = BASE[i] && over[BASE[i].name];
    if (!o) return g;
    const out = { ...g };
    if (o.hand) out.hand = o.hand;
    if (o.blade) {
      const el = o.blade[0] * D2R, az = o.blade[1] * D2R;
      out.blade = o.blade;
      out.dir = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
    }
    if (o.pelvisYaw != null) out.pelvisYaw = o.pelvisYaw * D2R;
    if (o.chestYaw != null) out.chestYaw = o.chestYaw * D2R;
    if (o.pitch != null) out.pitch = o.pitch * D2R;
    if (o.drop != null) out.drop = o.drop;
    if (o.src) out.src = o.src;
    if (o.name) out.name = o.name; // 10/10 이탈리아: 칸 이름 (hands.js 손 돌림) — name 없는 칸(이베리아)은 그대로
    if (o.desc) out.desc = o.desc;
    return out;
  });
  // 덮기 전 무기 틀 표 (10/31 — fighter.js corrScale 이 읽는다): 유파 자세표가 쉼 자리(SKILL.homeGuard = 쟁기 자리) 칸을 덮어도
  //  보정 v2 날것 매핑 반지름(배수 k)은 무기 틀 표로 잰다 — 10/10 이베리아 · 일본 자세표가 이 칸을 덮으면서 k 가 0.866 → 0.752 · 0.757 로 줄어
  //  손가락을 대거나 휘두르는 동안 손이 어깨 쪽으로 13 % 끌려온 것(docs/motion/guard_arms_2026-10-31.md)을 되돌린다. 보이는 자세 칸은 그대로
  Object.defineProperty(res, 'frameTable', { value: src.frameTable ?? src });
  return res;
}

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
  const T = out.table ?? (out.oneHand ? BASE_ONE_SABRE : GUARDS); // 찌르기 칼은 부르는 쪽이 out.table = guardBaseOne(style) 로 넘긴다
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

/**
 * 보정 v2 마무리 명령 (설계 '마무리 = FINISH_GUARDS 를 s·fin.amt 로 명령'): guardAt 과 같은 무게(SIGMA2·fa·아래 자세 × (1 − fa))로
 *  마무리 패드 몫만 섞는다. 보통 자세표·찌르기 덧씌우기는 넣지 않는다 (v2 에 자세 당김이 되살아나지 않게).
 * out = { hand:[3], dir:[3], pelvisYaw, chestYaw, pitch, drop, share } — share = 마무리 무게 / 전체 무게 (fin.amt 가 이미 들어 있다).
 * src: 표를 고르는 자세 객체 (guardPose·bodyGuard: table·oneHand, guardAt 과 같은 규칙). 새 수 없음
 */
export function finishAt(x, y, out, fin, src = null) {
  const h = (out.hand ||= [0, 0, 0]);
  const d = (out.dir ||= [0, 0, 0]);
  h[0] = h[1] = h[2] = d[0] = d[1] = d[2] = 0;
  out.pelvisYaw = out.chestYaw = out.pitch = out.drop = out.share = 0;
  const fa = fin ? fin.amt : 0;
  if (!(fa > 0)) return out;
  const T = src?.table ?? (src?.oneHand ? BASE_ONE_SABRE : GUARDS);
  let wSum = 0;
  for (let i = 0; i < NBASE; i++) {
    const g = T[i];
    const dx = x - g.pad[0];
    const dy = y - g.pad[1];
    let w = Math.exp(-(dx * dx + dy * dy) / SIGMA2);
    if (g.low) w *= 1 - fa;
    wSum += w;
  }
  let wFin = 0;
  let bestW = -1;
  let bestDir = null;
  for (let j = 0; j < FINISH_GUARDS.length; j++) {
    const F = FINISH_GUARDS[j];
    const p = fin[F.finish];
    for (const pad of F.pads) {
      const dx = x - pad[0];
      const dy = y - pad[1];
      const w = Math.exp(-(dx * dx + dy * dy) / SIGMA2) * fa;
      if (w > bestW) {
        bestW = w;
        bestDir = p.dir;
      }
      wFin += w;
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
  wSum += wFin;
  out.share = wFin / Math.max(1e-9, wSum);
  const inv = 1 / Math.max(1e-9, wFin);
  for (let k = 0; k < 3; k++) h[k] *= inv;
  out.pelvisYaw *= inv;
  out.chestYaw *= inv;
  out.pitch *= inv;
  out.drop *= inv;
  // 칼끝 방향: guardAt 과 같은 규칙 (상쇄되면(길이 < 0.35, guardAt 의 수) 가장 무거운 마무리 패드의 방향)
  const len = Math.hypot(d[0], d[1], d[2]);
  if (len * inv < 0.35 && bestDir) for (let k = 0; k < 3; k++) d[k] = bestDir[k];
  else if (len > 0) for (let k = 0; k < 3; k++) d[k] /= len;
  return out;
}

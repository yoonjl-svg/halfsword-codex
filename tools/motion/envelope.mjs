// ─────────────────────────────────────────────────────────────
//  사람 움직임 봉투 (동작 연구 PM, 디렉터 요청 9/30) — 기준 클립 24벌(8 베기 × 오른쪽 × 작게·보통·크게)의
//  관절 각 범위·최고 각속도·각가속도, 골반 높이 폭, 발 뜬 시간 비율, 힘 전달 순서를 잰다.
//   node tools/motion/envelope.mjs → tools/motion/human_envelope.json + docs/motion/human_envelope_2026-09-30.md
//  클립은 교본 서술 + 생체역학 문헌으로 저작한 것(모캡 실측 아님) — 봉투의 "사람 값" 칸은 문헌에서 따로 적는다.
//  사람 값은 참고이지 한도가 아니다. 측정기가 "벗어남"을 볼 때 쓰는 기준 제안.
// ─────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CL = join(ROOT, 'docs', 'motion', 'clips');
const CUTS = ['zornhau', 'oberhau', 'mittelhau', 'unterhau', 'zwerchhau', 'schielhau', 'krumphau', 'scheitelhau'];
const SIZES = ['small', 'medium', 'large'];
const R2D = 180 / Math.PI;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.sqrt(dot(a, a));
const nrm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(nrm(a), nrm(b))))) * R2D;

/** 관절 각 한 표본. 몸통 틀: up = 허리→목, lat = 칼 반대 어깨→칼 어깨(오른쪽 +), fwd = lat × up 쪽이 앞 */
function anglesAt(p) {
  const up = nrm(sub(p('neck'), p('waist')));
  let lat = sub(p('shS'), p('shO'));
  lat = nrm(sub(lat, up.map((v) => v * dot(lat, up))));
  const fwd = crs(up, lat); // 오른손 틀: up × lat → 앞(+x 쪽인지 아래에서 부호 확인)
  const F = dot(fwd, [1, 0, 0]) >= 0 ? fwd : fwd.map((v) => -v);
  const arm = (sh, el, side) => {
    const u = nrm(sub(p(el), p(sh)));
    const front = dot(u, F), out = dot(u, lat) * side, upc = dot(u, up);
    const elev = ang(u, up.map((v) => -v)); // 팔이 아래에서 들린 각 0~180
    // 들림 면(ISB 식): 0 = 옆으로(벌림 면), +90 = 앞으로(굽힘 면), 90 넘으면 몸 앞을 가로지름, − = 뒤로. 팔이 20° 밑이거나 160° 위(곧게 위)면 정하지 않음
    return { elev, plane: elev > 20 && elev < 160 ? Math.atan2(front, out) * R2D : null, vec: [front, out, upc] };
  };
  const aS = arm('shS', 'elS', 1), aO = arm('shO', 'elO', -1);
  const elbow = (sh, el, h) => 180 - ang(sub(p(sh), p(el)), sub(p(h), p(el)));
  const wrist = ang(sub(p('hS'), p('elS')), sub(p('tip'), p('pommel'))); // 아래팔-칼 각 (0 = 곧게)
  const yawOf = (a, b) => { const v = sub(p(a), p(b)); return Math.atan2(-v[0], v[2]) * R2D; }; // 땅 틀에서 선의 돌림
  let twist = yawOf('shS', 'shO') - yawOf('hipR', 'hipL');
  twist = ((twist + 540) % 360) - 180;
  const trunkDown = up.map((v) => -v);
  const hip = (h, k) => ang(sub(p(k), p(h)), trunkDown); // 넓적다리와 몸통 아래 방향 사이 = 엉덩관절 굽힘(폄 포함 크기)
  const knee = (h, k, a) => 180 - ang(sub(p(h), p(k)), sub(p(a), p(k)));
  return {
    shElevS: aS.elev, shPlaneS: aS.plane, shElevO: aO.elev, shPlaneO: aO.plane, _uS: aS.vec, _uO: aO.vec,
    elbowS: elbow('shS', 'elS', 'hS'), elbowO: elbow('shO', 'elO', 'hO'), wrist,
    spineTwist: twist, hipL: hip('hipL', 'kneeL'), hipR: hip('hipR', 'kneeR'),
    kneeL: knee('hipL', 'kneeL', 'ankleL'), kneeR: knee('hipR', 'kneeR', 'ankleR'),
    pelvisYaw: yawOf('hipR', 'hipL'), chestYaw: yawOf('shS', 'shO'),
  };
}
const unwrap = (a) => { const o = [a[0]]; for (let i = 1; i < a.length; i++) { let d = a[i] - a[i - 1]; d = ((d + 540) % 360) - 180; o.push(o[i - 1] + d); } return o; };
const smooth = (a, w = 2) => a.map((_, i) => { let s = 0, n = 0; for (let k = -w; k <= w; k++) { const j = i + k; if (j >= 0 && j < a.length) { s += a[j]; n++; } } return s / n; });
const deriv = (a, dt) => a.map((_, i) => (a[Math.min(i + 1, a.length - 1)] - a[Math.max(i - 1, 0)]) / (dt * (i === 0 || i === a.length - 1 ? 1 : 2)));

const KEYS = ['shElevS', 'shPlaneS', 'shElevO', 'shPlaneO', 'elbowS', 'elbowO', 'wrist', 'spineTwist', 'hipL', 'hipR', 'kneeL', 'kneeR'];
const per = [];
for (const cut of CUTS) for (const size of SIZES) {
  const c = JSON.parse(readFileSync(join(CL, `${cut}_right_${size}.json`), 'utf8'));
  const n = c.data.n, t = c.data.cols.t, J = c.data.cols.J, nj = c.joints.length, dt = 1 / c.hz;
  const ix = Object.fromEntries(c.joints.map((j, k) => [j, k]));
  const rows = [];
  for (let i = 0; i < n; i++) {
    const p = (name) => { const k = (i * nj + ix[name]) * 3; return [J[k], J[k + 1], J[k + 2]]; };
    rows.push({ a: anglesAt(p), hipY: p('hipC')[1], ankL: Math.min(p('heelL')[1], p('toeL')[1]), ankR: Math.min(p('heelR')[1], p('toeR')[1]), hand: p('hS'), tip: p('tip') });
  }
  const out = { id: c.id, cut, size, dur: +(t[n - 1] - t[0]).toFixed(3), joints: {} };
  for (const k of [...KEYS, 'pelvisYaw', 'chestYaw']) {
    if (k.startsWith('shPlane')) {
      // 들림 면: 범위만(팔이 20° 넘게 들린 표본), 빠르기는 위팔 각속도(몸통 틀)로 따로
      const raw = rows.map((r) => r.a[k]).filter((x) => x != null);
      const vk = k === 'shPlaneS' ? '_uS' : '_uO';
      const u = rows.map((r) => r.a[vk]);
      const w = smooth(u.map((_, i) => { const a = u[Math.max(i - 1, 0)], b = u[Math.min(i + 1, u.length - 1)]; const d = i === 0 || i === u.length - 1 ? 1 : 2; return ang(a, b) / (dt * d); }));
      const acc = smooth(deriv(w, dt));
      let iv = 0; w.forEach((x, i) => { if (x > w[iv]) iv = i; });
      out.joints[k] = { min: Math.min(...raw), max: Math.max(...raw), vMax: w[iv], tVmax: t[iv], aMax: Math.max(...acc.map(Math.abs)) };
      continue;
    }
    const raw = rows.map((r) => r.a[k]);
    const s = smooth(k === 'pelvisYaw' || k === 'chestYaw' || k === 'spineTwist' ? unwrap(raw) : raw);
    const v = smooth(deriv(s, dt)), acc = smooth(deriv(v, dt));
    let iv = 0; v.forEach((x, i) => { if (Math.abs(x) > Math.abs(v[iv])) iv = i; });
    out.joints[k] = { min: Math.min(...raw), max: Math.max(...raw), vMax: Math.abs(v[iv]), tVmax: t[iv], aMax: Math.max(...acc.map(Math.abs)) };
  }
  // 골반 높이 폭 · 발 뜬 시간 비율(뒤꿈치·발끝 둘 다 처음보다 1 cm 넘게 뜬 표본 — 뒤꿈치만 든 것은 뜬 것이 아님)
  const hy = rows.map((r) => r.hipY);
  out.pelvisHeight = { range: Math.max(...hy) - Math.min(...hy), minDrop: hy[0] - Math.min(...hy) };
  const airL = rows.filter((r) => r.ankL > rows[0].ankL + 0.01).length, airR = rows.filter((r) => r.ankR > rows[0].ankR + 0.01).length;
  out.airborne = { L: airL / n, R: airR / n, either: rows.filter((r) => r.ankL > rows[0].ankL + 0.01 || r.ankR > rows[0].ankR + 0.01).length / n };
  // 힘 전달 순서: 칼끝 빠르기 최고 시각 기준, 골반·가슴 돌림 각속도 최고, 손 빠르기 최고, 걸음 디딤(뜬 뒤 다시 닿은 때)
  const spd = (key) => rows.map((r, i) => (i === 0 ? 0 : len(sub(r[key], rows[i - 1][key])) / dt));
  const tipV = smooth(spd('tip')), handV = smooth(spd('hand'));
  const twIdx = t.findIndex((x) => x >= c.marks.tw - 1e-9);
  const argmaxFrom = (a, i0) => { let b = i0; for (let i = i0; i < a.length; i++) if (a[i] > a[b]) b = i; return b; };
  const iTip = argmaxFrom(tipV, twIdx), iHand = argmaxFrom(handV.slice(0, iTip + 1).map((x, i) => (i < twIdx ? 0 : x)), twIdx);
  const ms = (tt) => Math.round((tt - t[iTip]) * 1000);
  const land = c.step && !Array.isArray(c.step) && c.step.landT != null ? ms(c.step.landT) : null;
  const lift = c.step && !Array.isArray(c.step) && c.step.liftT != null ? ms(c.step.liftT) : null;
  out.sequence = { footLift: lift, footLand: land, pelvis: ms(out.joints.pelvisYaw.tVmax), chest: ms(out.joints.chestYaw.tVmax), hand: ms(t[iHand]), tip: 0, tipSpeed: tipV[iTip], handSpeed: handV[iHand] };
  per.push(out);
}

// 모음: 크기별·전체 최대/최소
const agg = (list) => {
  const o = {};
  for (const k of [...KEYS, 'pelvisYaw', 'chestYaw']) {
    const js = list.map((c) => c.joints[k]);
    o[k] = { min: Math.min(...js.map((j) => j.min)), max: Math.max(...js.map((j) => j.max)), vMax: Math.max(...js.map((j) => j.vMax)), aMax: Math.max(...js.map((j) => j.aMax)) };
  }
  o.pelvisHeightRange = Math.max(...list.map((c) => c.pelvisHeight.range));
  o.airborneEither = [Math.min(...list.map((c) => c.airborne.either)), Math.max(...list.map((c) => c.airborne.either))];
  const seqKeys = ['footLift', 'footLand', 'pelvis', 'chest', 'hand'];
  o.sequence = Object.fromEntries(seqKeys.map((k) => { const v = list.map((c) => c.sequence[k]).filter((x) => x != null); return [k, v.length ? [Math.min(...v), Math.max(...v)] : null]; }));
  o.tipSpeed = [Math.min(...list.map((c) => c.sequence.tipSpeed)), Math.max(...list.map((c) => c.sequence.tipSpeed))];
  return o;
};
const bySize = Object.fromEntries(SIZES.map((s) => [s, agg(per.filter((c) => c.size === s))]));
const all = agg(per);

// 문헌 사람 값 (참고, 한도 아님) — 줄마다 출처
const LIT = {
  shElevS: { rom: '굽힘·벌림 180 (들림 0~180), 폄 60', speed: '—', src: 'AAOS ROM (aaos_rom)' },
  shPlaneS: { rom: '수평 모음(몸 앞 가로지름) 약 130 · 수평 벌림 약 45 [기억]', speed: '야구 던지기 위팔 돌림(안쪽 돌림 축) 최고 약 7000 °/s — 위팔 방향 각속도와 다른 축 [기억: Fleisig 외 1995]', src: 'AAOS ROM' },
  elbowS: { rom: '굽힘 150 (0 = 곧게)', speed: '던지기 팔꿈치 폄 최고 약 2200~2500 °/s [기억: Fleisig 외 1995 — 원문 대조 전]', src: 'AAOS ROM' },
  wrist: { rom: '손목 굽힘 80 · 폄 70 (아래팔-칼 각은 쥔 칼이라 손목+손가락 합, 사람 어림 ≈ 135~160° 부터 무리 — clip_format 손목 검사)', speed: '—', src: 'AAOS ROM · 이 저장소 spec_table' },
  spineTwist: { rom: '가슴허리 돌림 45 (한쪽). 골프 X-factor 최고 약 40~60', speed: '—', src: 'AAOS ROM · golf_xfactor' },
  pelvisYaw: { rom: '—', speed: '야구 타격 골반 최고 714 °/s · 골프 480±82 °/s', src: 'baseball_sequence · golf_sequence' },
  chestYaw: { rom: '—', speed: '야구 타격 어깨(윗몸) 937 °/s · 성인 857 °/s · 골프 가슴 605±87 °/s', src: 'baseball_sequence · golf_sequence' },
  hipL: { rom: '엉덩관절 굽힘 120 · 폄 30. 펜싱 런지 숙련 53°', speed: '—', src: 'AAOS ROM · fencing_gholipour' },
  kneeL: { rom: '굽힘 135. 펜싱 런지 앞무릎 폄 51±9°', speed: '런지 뒷발목 폄 564±132 °/s (발목)', src: 'AAOS ROM · fencing_gholipour · fencing_mulloy' },
};
writeFileSync(join(ROOT, 'tools', 'motion', 'human_envelope.json'), JSON.stringify({
  format: 'stillness-human-envelope/1', generated: '2026-09-30', note: '기준 클립(저작, 모캡 아님) 24벌에서 잰 값 + 문헌 사람 값. 참고이지 한도가 아니다. 각도 °, 각속도 °/s, 각가속도 °/s², 시각 ms(칼끝 최고 = 0), 길이 m.',
  frames: { shoulder: 'elev = 몸통 틀(up = 허리→목, lat = 칼 반대 어깨→칼 어깨)에서 위팔이 아래로부터 들린 각; plane = 들림 면 atan2(앞, 바깥) — 0 옆·90 앞·>90 몸 앞 가로지름·− 뒤 (20° < elev < 160° 표본만); shPlane 의 vMax·aMax = 위팔 방향의 몸통 틀 각속도·각가속도', elbow: '180 − 위팔·아래팔 각 (0 = 곧게)', wrist: '아래팔(팔꿈치→손)과 칼(폼멜→칼끝) 사이 각 (0 = 곧게)', spineTwist: '어깨선 돌림 − 엉덩이선 돌림 (땅 틀 yaw)', hip: '넓적다리와 몸통 아래 방향 사이 각 (굽힘·폄 크기)', knee: '180 − 넓적다리·정강이 각 (0 = 곧게)', smoothing: '5 표본(≈ 42 ms) 이동 평균 뒤 가운데 차분' },
  all, bySize, clips: per, literature: LIT,
}, null, 1));

// 문서
const f0 = (x) => Math.round(x), f2 = (x) => x.toFixed(2);
const NAMES = { shElevS: '칼 어깨 들림 (0 = 팔 내림)', shPlaneS: '칼 어깨 들림 면 (0 옆·90 앞·>90 몸 앞 가로지름·− 뒤·±180 곧게 뒤) — 빠르기 칸 = 위팔 각속도(몸통 틀)', shElevO: '빈쪽 어깨 들림', shPlaneO: '빈쪽 어깨 들림 면 — 빠르기 = 위팔 각속도', elbowS: '칼 팔꿈치 굽힘', elbowO: '빈쪽 팔꿈치 굽힘', wrist: '아래팔-칼 각(손목)', spineTwist: '척추 비틀림(어깨선−엉덩이선)', hipL: '왼 엉덩관절 굽힘', hipR: '오른 엉덩관절 굽힘', kneeL: '왼 무릎 굽힘', kneeR: '오른 무릎 굽힘', pelvisYaw: '골반 돌림', chestYaw: '가슴(어깨선) 돌림' };
const L = [];
L.push('# 사람 움직임 봉투 — 기준 클립 24벌 + 문헌 (2026-09-30, 자동 생성)');
L.push('');
L.push('> `node tools/motion/envelope.mjs` 가 만든다(기계용 `tools/motion/human_envelope.json`). 디렉터 요청(9/30 22:00): 측정기의 "관절 범위 이탈·비인간적 가속" 판정 기준.');
L.push('> **클립 값은 교본·생체역학 문헌으로 저작한 기준 동작에서 잰 것이지 모캡 실측이 아니다.** 사람 한계는 "문헌" 칸. 모든 값은 참고이지 한도가 아니다(판정 문턱은 제안 — 디렉터·사장님 몫).');
L.push('> 표본 24벌 = 8 베기 × 오른쪽 × 작게·보통·크게 (왼쪽은 거울이라 같다). 120 Hz, 5 표본 이동 평균 뒤 차분 — 각가속도는 저작 키 사이 곡선에서 나와 튀기 쉽다(참고 정도).');
L.push('');
L.push('## 1. 관절 각 범위·최고 각속도·각가속도');
L.push('');
L.push('| 관절 | 클립 범위 ° (작게 / 크게) | 최고 각속도 °/s (작게 / 보통 / 크게) | 최고 각가속도 °/s² (크게) | 문헌 사람 값 (가동 범위 · 빠르기) | 출처 |');
L.push('|---|---|---|---|---|---|');
for (const k of [...KEYS, 'pelvisYaw', 'chestYaw']) {
  const s = bySize.small[k], m = bySize.medium[k], l = bySize.large[k];
  const lit = LIT[k] ?? LIT[k.replace(/R$|O$/, (x) => (x === 'R' ? 'L' : 'S'))] ?? null;
  if (k.startsWith('shPlane') && !s) continue;
  L.push(`| ${NAMES[k]} | ${f0(s.min)}~${f0(s.max)} / ${f0(l.min)}~${f0(l.max)} | ${f0(s.vMax)} / ${f0(m.vMax)} / ${f0(l.vMax)} | ${f0(l.aMax)} | ${lit ? `${lit.rom} · ${lit.speed}` : '—'} | 클립 24벌${lit ? ` · ${lit.src}` : ''} |`);
}
L.push('');
L.push('## 2. 골반 높이·발');
L.push('');
L.push('| 무엇 | 작게 | 보통 | 크게 | 출처 |');
L.push('|---|---|---|---|---|');
L.push(`| 골반 높이 변화 폭 m (최대) | ${f2(bySize.small.pelvisHeightRange)} | ${f2(bySize.medium.pelvisHeightRange)} | ${f2(bySize.large.pelvisHeightRange)} | 클립. 참고: 펜싱 런지 끝 자세는 걸음 0.5 m 에 골반 약 0.2 m 낮아짐 (lunge_flow.md) |`);
L.push(`| 한 발이라도 뜬 시간 비율 (클립 길이 대비) | ${bySize.small.airborneEither.map(f2).join('~')} | ${bySize.medium.airborneEither.map(f2).join('~')} | ${bySize.large.airborneEither.map(f2).join('~')} | 클립 (뒤꿈치·발끝 둘 다 1 cm 넘게 뜬 표본, 작게는 걸음 없음). 두 발이 함께 뜨는 표본은 없다 |`);
L.push('');
L.push('## 3. 힘 전달 순서 (칼끝 빠르기 최고 = 0 ms)');
L.push('');
L.push('| 무엇 | 작게 | 보통 | 크게 | 문헌 |');
L.push('|---|---|---|---|---|');
const rg = (x) => (x ? (x[0] === x[1] ? `${x[0]}` : `${x[0]} ~ ${x[1]}`) : '—');
L.push(`| 발 뗌 | ${rg(bySize.small.sequence.footLift)} | ${rg(bySize.medium.sequence.footLift)} | ${rg(bySize.large.sequence.footLift)} | Meyer "베기마다 제 걸음, 베기와 함께" (Ⅰ.23v) |`);
L.push(`| 발 디딤 | ${rg(bySize.small.sequence.footLand)} | ${rg(bySize.medium.sequence.footLand)} | ${rg(bySize.large.sequence.footLand)} | 칼이 겨눈 선을 지날 때 딛는다 (Döbringer·Meyer) |`);
L.push('| (작게는 몸통 돌림이 작아 골반·가슴 최고 시각이 뜻이 없다 — 참고 말 것) | | | | |');
L.push(`| 골반 돌림 최고 | ${rg(bySize.small.sequence.pelvis)} | ${rg(bySize.medium.sequence.pelvis)} | ${rg(bySize.large.sequence.pelvis)} | 골프 프로: 골반 → 가슴 → 팔 → 채 (golf_sequence); 야구 골반 714 → 어깨 937 °/s |`);
L.push(`| 가슴 돌림 최고 | ${rg(bySize.small.sequence.chest)} | ${rg(bySize.medium.sequence.chest)} | ${rg(bySize.large.sequence.chest)} | 같음 |`);
L.push(`| 손 빠르기 최고 | ${rg(bySize.small.sequence.hand)} | ${rg(bySize.medium.sequence.hand)} | ${rg(bySize.large.sequence.hand)} | 팔→채 간격이 가장 길다 (golf_sequence) |`);
L.push(`| 칼끝 최고 빠르기 m/s | ${bySize.small.tipSpeed.map((x) => x.toFixed(1)).join('~')} | ${bySize.medium.tipSpeed.map((x) => x.toFixed(1)).join('~')} | ${bySize.large.tipSpeed.map((x) => x.toFixed(1)).join('~')} | 참고: 배트 30 m/s (Escamilla 2009) |`);
L.push('');
L.push('## 4. 읽는 법 (측정기 제안 — 한도 아님)');
L.push('');
L.push('- **범위 이탈**: 문헌 가동 범위(AAOS) 밖이면 사람 몸으로 불가능. 클립 크게 범위 밖이지만 문헌 안이면 "기준 동작보다 큼" — 이상은 아니다.');
L.push('- **비인간적 빠르기**: 골반 > 약 750 °/s, 가슴(윗몸) > 약 1000 °/s 는 야구·골프 엘리트 최고도 넘는다(문헌). 팔 관절은 던지기 값(팔꿈치 약 2500 °/s)이 위 끝. 클립 크게 최고는 표 1.');
L.push('- **순서 어긋남**: 골반 → 가슴 → 손 → 칼끝 최고가 뒤바뀌거나, 몸통 최고가 칼끝보다 한참(수백 ms) 앞서 끝나면 힘이 전달되지 않은 것 (9/29 시험판 소견과 같다).');
L.push('- **하체**: 크게 베기도 무릎 굽힘은 표 1 범위 안(서서 베는 동작). 두 발이 함께 뜨는 일은 없다 — 두 발이 다 뜨거나 무릎이 크게 꺾이면 "무너짐".');
L.push('- 어깨 빠르기는 위팔 방향의 몸통 틀 각속도다(돌림 축 제외). 빈쪽 팔은 칼자루 끝을 쥔 채 팔꿈치를 계산(IK)해 놓은 것이라 팔꿈치 자리가 튀는 순간이 섞일 수 있다.');
L.push('- 각가속도는 저작 곡선의 값이라 사람 한계로 읽지 않는다(문헌 값 없음) — 크게 벌 값의 몇 배를 넘는지 비율로 보는 편이 낫다.');
writeFileSync(join(ROOT, 'docs', 'motion', 'human_envelope_2026-09-30.md'), L.join('\n') + '\n');
console.log(L.slice(8, 30).join('\n'));

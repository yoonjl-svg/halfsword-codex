// ─────────────────────────────────────────────────────────────
//  키프레임 → 120 Hz 기준 동작 클립 (동작 연구 PM)
//
//  1) 채널마다 키프레임을 단조 3차 곡선(Fritsch–Butland)으로 잇는다.
//     방향이 바뀌는 키에서는 속도가 0 이 되고(감기 끝처럼), 같은 쪽으로 지나가는 키에서는 속도를 이어 간다.
//  2) 운동 사슬: 베기 창(감기 끝 앞 ~ 지나가기 끝) 동안 몸 가까운 마디일수록 자기 시간표를 앞당겨 읽는다.
//     골반 > 가슴 > 팔(손) > 칼(손목) 순으로 먼저 움직이고, 칼은 늦게 따라와 채찍처럼 풀린다.
//     (애니메이션의 "겹침·어긋남"과 같은 수법이지만, 앞당기는 시간은 운동 사슬 측정값에 맞춘다 — docs/motion/README.md §3)
//  3) 몸 모형(body.mjs)으로 관절 위치를 풀고, 관절각·속도·사슬 순서·동작 범위를 잰다.
// ─────────────────────────────────────────────────────────────
import { BODY, SWORD, WRIST_HUMAN, v3, m3, frame, bladeDir, dirAngles, pose, centerOfMass, flatJoints, D2R, R2D } from './body.mjs';

export const HZ = 120;

// ── 단조 3차 곡선 ──
function tangents(ts, vs) {
  const n = ts.length;
  const m = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const h0 = ts[i] - ts[i - 1], h1 = ts[i + 1] - ts[i];
    const d0 = (vs[i] - vs[i - 1]) / h0, d1 = (vs[i + 1] - vs[i]) / h1;
    if (d0 * d1 <= 0) m[i] = 0;
    else m[i] = (3 * (h0 + h1)) / ((2 * h1 + h0) / d0 + (h1 + 2 * h0) / d1);
  }
  return m; // 처음과 끝은 멈춤(0)
}
function hermite(ts, vs, ms, t) {
  const n = ts.length;
  if (t <= ts[0]) return vs[0];
  if (t >= ts[n - 1]) return vs[n - 1];
  let i = 0;
  while (i < n - 2 && t > ts[i + 1]) i++;
  const h = ts[i + 1] - ts[i];
  const s = (t - ts[i]) / h;
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * vs[i] + (s3 - 2 * s2 + s) * h * ms[i] + (-2 * s3 + 3 * s2) * vs[i + 1] + (s3 - s2) * h * ms[i + 1];
}
function track(keys) {
  // keys: [[t, value]] (시간 순)
  const ts = keys.map((k) => k[0]);
  const vs = keys.map((k) => k[1]);
  const ms = tangents(ts, vs);
  return (t) => hermite(ts, vs, ms, t);
}

// 채널 이름 → 키프레임에서 값 꺼내기
const SCALARS = {
  'pelvis.x': (k) => k.pelvis?.x, 'pelvis.z': (k) => k.pelvis?.z, 'pelvis.drop': (k) => k.pelvis?.drop,
  'pelvis.yaw': (k) => k.pelvis?.yaw, 'pelvis.pitch': (k) => k.pelvis?.pitch, 'pelvis.roll': (k) => k.pelvis?.roll,
  'chest.yaw': (k) => k.chest?.yaw, 'chest.lean': (k) => k.chest?.lean, 'chest.side': (k) => k.chest?.side,
  'hand.0': (k) => k.hand?.[0], 'hand.1': (k) => k.hand?.[1], 'hand.2': (k) => k.hand?.[2],
  'hand2.0': (k) => k.hand2?.[0], 'hand2.1': (k) => k.hand2?.[1], 'hand2.2': (k) => k.hand2?.[2],
  'dir.0': (k) => k._dir?.[0], 'dir.1': (k) => k._dir?.[1], 'dir.2': (k) => k._dir?.[2],
};
for (const f of ['L', 'R']) for (const c of ['x', 'z', 'yaw', 'lift', 'up']) SCALARS[`feet.${f}.${c}`] = (k) => k.feet?.[f]?.[c];
const GROUP = (name) => (name.startsWith('pelvis') ? 'pelvis' : name.startsWith('chest') ? 'chest' : name.startsWith('hand2') ? 'free' : name.startsWith('hand') ? 'arm' : name.startsWith('dir') ? 'sword' : 'feet');
const DEFAULT = { 'pelvis.x': 0, 'pelvis.z': 0, 'pelvis.drop': 0.05, 'pelvis.yaw': 0, 'pelvis.pitch': 0, 'pelvis.roll': 0, 'chest.yaw': 0, 'chest.lean': 0, 'chest.side': 0, 'feet.L.lift': 0, 'feet.R.lift': 0, 'feet.L.yaw': 0, 'feet.R.yaw': 0, 'feet.L.up': 0, 'feet.R.up': 0 };

/** 게임 자세표(guards.js) 값 → 가슴 틀 채널. 게임은 손 목표를 '바라보는 방향' 틀에 두고, 골반은 표 값의 절반만 튼다(fighter.js 615) */
export function fromGameGuard(g) {
  const pelvisYaw = g.pelvisYaw * 0.5;
  const chestRel = g.chestYaw - pelvisYaw;
  // 게임은 손 목표·칼끝 방향을 "바라보는 틀"(fighter.yaw, 가슴 가운데 원점)에 둔다 (fighter.js 손 목표: handLocal.applyQuaternion(this.yaw)).
  //  몸 모형은 손·칼을 가슴 틀(돌림 + 숙임)로 받으므로, 이 자세의 가슴 틀을 통째로 되돌려야 월드에서 게임과 같은 자리가 된다
  //  (예전엔 돌림만 되돌려 숙임 5~12° 만큼 손이 3~4 cm 어긋났다)
  const R = frame(g.chestYaw, g.pitch, 0);
  const hand = m3.applyT(R, g.hand);
  const dir = m3.applyT(R, bladeDir(g.blade[0], g.blade[1]));
  return { pelvis: { yaw: pelvisYaw, pitch: 0, drop: g.drop }, chest: { yaw: chestRel, lean: g.pitch }, hand, dirV: dir };
}

/** 키프레임 한 벌 → 채널 함수들 */
export function buildTracks(keys) {
  for (const k of keys) {
    if (k.dirV) k._dir = v3.norm(k.dirV);
    else if (k.dir) k._dir = bladeDir(k.dir[0], k.dir[1]);
  }
  const tracks = {};
  // 칼 방향: 성분마다 따로 잇지 않고 큰 원을 따라 돈다 (성분 보간은 방향이 뒤집힐 때 칼이 헛돈다).
  //  키 사이 각도를 누적한 '돈 각도' 를 단조 곡선으로 시간에 잇고, 그 각도에서 이웃 키 사이를 slerp.
  //  칼이 거꾸로 돌아서는 키(들어온 호와 나가는 호가 100° 넘게 꺾임)에서는 멈춘다
  const dk = keys.filter((k) => k._dir);
  if (dk.length) {
    const ts = dk.map((k) => k.t);
    const ds = dk.map((k) => k._dir);
    const th = [0];
    for (let i = 1; i < ds.length; i++) th.push(th[i - 1] + Math.acos(Math.max(-1, Math.min(1, v3.dot(ds[i - 1], ds[i])))));
    const ms = tangents(ts, th);
    for (let i = 1; i < ds.length - 1; i++) {
      const a = v3.sub(ds[i], ds[i - 1]), b = v3.sub(ds[i + 1], ds[i]);
      if (v3.len(a) > 1e-6 && v3.len(b) > 1e-6 && v3.dot(v3.norm(a), v3.norm(b)) < Math.cos(100 * D2R)) ms[i] = 0;
    }
    const slerp = (a, b, u) => {
      const w = Math.acos(Math.max(-1, Math.min(1, v3.dot(a, b))));
      if (w < 1e-6) return a;
      const s = Math.sin(w);
      return v3.add(v3.mul(a, Math.sin((1 - u) * w) / s), v3.mul(b, Math.sin(u * w) / s));
    };
    tracks.dirV = (t) => {
      const x = hermite(ts, th, ms, t);
      let i = 0;
      while (i < th.length - 2 && x > th[i + 1]) i++;
      const span = th[i + 1] - th[i];
      const u = span > 1e-9 ? Math.max(0, Math.min(1, (x - th[i]) / span)) : 0;
      return v3.norm(slerp(ds[i], ds[i + 1], u));
    };
  }
  for (const [name, get] of Object.entries(SCALARS)) {
    if (name.startsWith('dir.')) continue;
    const ks = keys.filter((k) => get(k) != null).map((k) => [k.t, get(k)]);
    if (!ks.length && name.startsWith('hand2')) continue; // 빈손 키가 없으면(두손 무기) 채널 없음
    if (!ks.length) {
      const d = DEFAULT[name];
      if (d == null) throw new Error(`채널 ${name} 에 키가 하나도 없다`);
      tracks[name] = () => d;
    } else tracks[name] = track(ks);
  }
  return tracks;
}

/** 운동 사슬 앞당김: 감기 끝(tw) 앞 ramp 초부터 오르기 시작해 tw 에 다 오르고, 닿는 선(tc)까지 유지, 지나가기 끝(tf)에 0 */
function leadBump(t, m, ramp) {
  const sm = (a, b, x) => {
    const u = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return u * u * (3 - 2 * u);
  };
  if (t < m.tc) return sm(m.tw - ramp, m.tw, t);
  return 1 - sm(m.tc, m.tf, t);
}

/** 최소 저크 곡선 (위치 10u³−15u⁴+6u⁵, 최고 속도 = 1.875·Δ/D 가 가운데에서) */
export function minJerk(u) {
  const x = Math.max(0, Math.min(1, u));
  return x * x * x * (10 - 15 * x + 6 * x * x);
}
function profileAt(p, t) {
  const A = minJerk((t - (p.peak - p.dur / 2)) / p.dur);
  if (p.vc == null) return p.v0 + (p.v1 - p.v0) * A;
  // 두 곡선의 합: 빠른 돌림(감기 끝 → 겨눈 선 무렵, 최고 속도 peak)과 느린 지나가기 돌림(peak2, dur2).
  //  겨눈 선(tc)에서 저작한 자세 값(vc)을 지나도록 빠른 곡선의 끝값을 푼다 — 몸이 겨눈 선에서 이미 다 돌아 버리지 않게
  const B = minJerk((t - (p.peak2 - p.dur2 / 2)) / p.dur2);
  const Ac = minJerk((p.tc - (p.peak - p.dur / 2)) / p.dur);
  const Bc = minJerk((p.tc - (p.peak2 - p.dur2 / 2)) / p.dur2);
  const vA = (p.vc - p.v0 + p.v0 * Ac - p.v1 * Bc) / (Ac - Bc);
  return p.v0 + (vA - p.v0) * A + (p.v1 - vA) * B;
}

/** 한 순간의 채널 값 */
export function channelsAt(tracks, marks, chain, t) {
  const out = { pelvis: {}, chest: {}, hand: [0, 0, 0], dir: [1, 0, 0], feet: { L: {}, R: {} } };
  const b = leadBump(t, marks, chain.ramp ?? 0.12);
  const at = (name) => tracks[name](t + (chain[GROUP(name)] ?? 0) * b);
  out.pelvis = { x: at('pelvis.x'), z: at('pelvis.z'), drop: at('pelvis.drop'), yaw: at('pelvis.yaw'), pitch: at('pelvis.pitch'), roll: at('pelvis.roll') };
  out.chest = { yaw: at('chest.yaw'), lean: at('chest.lean'), side: at('chest.side') };
  // 베기 창(tw~tf)의 골반·가슴 돌림은 운동 사슬 곡선으로 바꾼다 (profiles: 최소 저크 곡선, 최고 속도 시각을 정해 둔다)
  const pr = chain.profiles;
  if (pr && t >= marks.tw && t <= marks.tf) {
    const py = profileAt(pr.pelvis, t);
    const cy = profileAt(pr.chest, t);
    out.pelvis.yaw = py;
    out.chest.yaw = cy - py;
  }
  // 흐름(이어 베기): 베기마다 제 운동 사슬 곡선 — segments: [{ tw, tf, profiles }] (build_flow.mjs)
  for (const sg of chain.segments ?? []) {
    if (t < sg.tw || t > sg.tf) continue;
    const py = profileAt(sg.profiles.pelvis, t);
    const cy = profileAt(sg.profiles.chest, t);
    out.pelvis.yaw = py;
    out.chest.yaw = cy - py;
  }
  out.hand = [at('hand.0'), at('hand.1'), at('hand.2')];
  if (tracks['hand2.0']) out.hand2 = [at('hand2.0'), at('hand2.1'), at('hand2.2')];
  // 칼 방향 키는 월드 틀이다 (베는 면이 월드에 있다). 가슴이 앞당겨 돌아도 칼은 제 시각표대로 — 몸통과 칼 사이의 늦춤이 저절로 생긴다
  out.dirW = tracks.dirV(t + (chain.sword ?? 0) * b);
  for (const f of ['L', 'R']) out.feet[f] = { x: at(`feet.${f}.x`), z: at(`feet.${f}.z`), yaw: at(`feet.${f}.yaw`), lift: at(`feet.${f}.lift`), up: Math.max(0, at(`feet.${f}.up`)) };
  return out;
}

/** 위상 φ: −1 감기 시작, 0 감기 끝(풀기 시작), 0.55 손목 풀림, 0.85 칼이 겨눈 선을 지남, 1.6 지나가기 끝, 2.2 복귀 (docs/whole_body_redesign.md §2-1·2-2) */
export function phaseAt(m, t) {
  const pts = [[m.t0, -1], [m.tw, 0], [m.tr, 0.55], [m.tc, 0.85], [m.tf, 1.6], [m.tg, 2.2]];
  if (t <= pts[0][0]) return -1;
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, pa] = pts[i], [b, pb] = pts[i + 1];
    if (t <= b) return pa + ((pb - pa) * (t - a)) / (b - a);
  }
  return 2.2;
}

// 관절각 (도)
function angleBetween(a, b) {
  return Math.acos(Math.max(-1, Math.min(1, v3.dot(v3.norm(a), v3.norm(b))))) * R2D;
}
function yawOf(R) {
  // 몸 틀 앞축의 수평 방향 → 게임 부호 돌림(+ = 칼 쪽으로 향함)
  const f = [R[0], R[3], R[6]];
  return Math.atan2(f[2], f[0]) * R2D;
}

/** 클립 한 벌을 120 Hz 로 표본화하고 잰다 */
export function sampleClip(def, side = 1) {
  const keys = def.keys.map((k) => ({ ...k }));
  const marks = def.marks;
  const tracks = buildTracks(keys);
  const chain = def.chain ?? {};
  const T = marks.tg;
  const n = Math.round(T * HZ) + 1;
  const frames = [];
  for (let i = 0; i < n; i++) {
    const t = i / HZ;
    const ch = channelsAt(tracks, marks, chain, t);
    const J = pose(ch, side, def.sword);
    frames.push({ t, ch, J });
  }
  // 손목 한계 끌어오기는 v0 에서 끈다(def.wristLimit === true 일 때만): 감기 중 아래팔이 빨리 움직이는 곳에서 칼이 따라 튀었다
  //  (보통 가로 베기 칼끝 순간 52 m/s). 넘는 각은 summary.checks 에 적기만 한다
  if (def.wristLimit === true) wristLimit(frames, side, def.sword);
  // 땅: 칼끝이 땅(y = 0) 위 def.ground m 보다 낮아지면 칼을 덜 숙인다 (긴 칼 — 츠바이핸더 — 만 켠다. 롱소드 클립은 가장 낮아도 0.03 m)
  if (def.ground != null) groundLimit(frames, side, def.sword, def.ground);
  return { frames, marks };
}

/** 가우스로 시간 부드럽게 (σ 초) — 한 값 배열 */
function smooth1(arr, sigma) {
  const n = arr.length;
  const r = Math.ceil(sigma * 3 * HZ);
  return arr.map((_, i) => {
    let acc = 0, ws = 0;
    for (let k = -r; k <= r; k++) {
      const w = Math.exp(-0.5 * ((k / HZ) / sigma) ** 2);
      acc += arr[Math.min(n - 1, Math.max(0, i + k))] * w;
      ws += w;
    }
    return acc / ws;
  });
}

/**
 * 땅 한계 (오프라인): 칼끝 높이 = 손 높이 + 칼끝 길이 × 칼 방향 y. 땅 위 clear m 에 닿으려면 칼을 얼마나 덜 숙여야 하나(올려본 각 더하기)를
 *  표본마다 셈하고, 시간으로 부드럽게(σ 40 ms, 봉우리는 1.3배로 부풀려 깎이지 않게) 한 만큼 칼을 올린다(옆 각은 그대로).
 *  사람이 긴 칼로 하는 일(칼끝을 땅에 박지 않게 덜 숙임)을 흉내 낸 저작 규칙이다 — 게임 한도가 아니다.
 */
function groundLimit(frames, side, sword, clear) {
  const tipLen = (sword ?? { tip: 1.18 }).tip;
  const need = frames.map((f) => {
    const d = f.J.dW;
    const yMin = Math.max(-1, Math.min(1, (clear - f.J.hS[1]) / tipLen));
    const el = Math.asin(Math.max(-1, Math.min(1, d[1])));
    return Math.max(0, Math.asin(yMin) - el);
  });
  const sm = smooth1(need, 0.04).map((x, i) => Math.max(x * 1.3, need[i]));
  for (let i = 0; i < frames.length; i++) {
    if (sm[i] <= 1e-4) continue;
    const f = frames[i];
    const d = f.J.dW;
    const h = Math.hypot(d[0], d[2]);
    const az = h > 1e-6 ? Math.atan2(d[2], d[0]) : 0;
    const el = Math.min(Math.PI / 2 - 1e-3, Math.asin(Math.max(-1, Math.min(1, d[1]))) + sm[i]);
    const dN = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
    f.ch = { ...f.ch, dirW: dN };
    f.J = pose(f.ch, side, sword);
  }
}

/**
 * 손목 한계 (두 번 돌림, 오프라인): 칼 든 아래팔과 칼 사이 각이 WRIST_HUMAN(135°, 사람 두손 쥐기 어림 [추정])을 넘는 만큼
 *  칼을 아래팔 쪽으로 끌어온다. 한 표본씩 막으면 팔을 많이 접은 자세에서 아래팔 방향이 조금만 바뀌어도 칼이 튀므로(v0 시험:
 *  칼끝 순간 37~80 m/s), 아래팔 방향과 넘친 각을 시간으로 부드럽게(가우스 σ 30 ms) 한 뒤 끌어온다. 이것은 기준 동작을
 *  사람답게 만드는 저작 규칙이지 게임의 한도가 아니다.
 */
function wristLimit(frames, side, sword) {
  const n = frames.length;
  const fore = frames.map((f) => v3.norm(v3.sub(f.J.hS, f.J.elS)));
  const gauss = (arr, sigma, pick) => {
    const r = Math.ceil(sigma * 3 * HZ);
    const w = [];
    for (let k = -r; k <= r; k++) w.push(Math.exp(-0.5 * ((k / HZ) / sigma) ** 2));
    return arr.map((_, i) => {
      let acc = null, ws = 0;
      for (let k = -r; k <= r; k++) {
        const j = Math.min(n - 1, Math.max(0, i + k));
        const v = pick(arr[j]);
        acc = acc == null ? (Array.isArray(v) ? v.map((x) => x * w[k + r]) : v * w[k + r]) : Array.isArray(v) ? acc.map((x, q) => x + v[q] * w[k + r]) : acc + v * w[k + r];
        ws += w[k + r];
      }
      return Array.isArray(acc) ? acc.map((x) => x / ws) : acc / ws;
    });
  };
  const foreS = gauss(fore, 0.03, (v) => v).map((v) => v3.norm(v));
  const excess = frames.map((f, i) => Math.max(0, Math.acos(Math.max(-1, Math.min(1, v3.dot(foreS[i], f.J.dW)))) * R2D - WRIST_HUMAN));
  // 넘친 각을 부드럽게 하되 봉우리가 깎이지 않게 조금 부풀린다
  const exS = gauss(excess, 0.03, (v) => v).map((x, i) => Math.max(x * 1.3, excess[i] > 0 ? excess[i] * 0.9 : 0));
  for (let i = 0; i < n; i++) {
    const e = exS[i];
    if (e <= 0.2) continue;
    const f = frames[i];
    const d = f.J.dW;
    let k = v3.cross(d, foreS[i]); // d 를 아래팔 쪽으로 돌리는 축
    if (v3.len(k) < 1e-6) continue;
    k = v3.norm(k);
    const a = e * D2R;
    const kxd = v3.cross(k, d);
    const dN = v3.norm(v3.add(v3.add(v3.mul(d, Math.cos(a)), v3.mul(kxd, Math.sin(a))), v3.mul(k, v3.dot(k, d) * (1 - Math.cos(a)))));
    const ch = { ...f.ch, dirW: dN };
    f.ch = ch;
    f.J = pose(ch, side, sword);
  }
}

/** 표본 → 클립 JSON 한 벌 + 측정값 */
export function measure(frames, marks) {
  const n = frames.length;
  const dt = 1 / HZ;
  const rows = [];
  let prev = null;
  let edgePrev = null;
  for (let i = 0; i < n; i++) {
    const { t, ch, J } = frames[i];
    const nx = frames[Math.min(n - 1, i + 1)].J;
    const pv = frames[Math.max(0, i - 1)].J;
    const span = (Math.min(n - 1, i + 1) - Math.max(0, i - 1)) * dt;
    const vel = (a, b) => v3.mul(v3.sub(a, b), 1 / span);
    const vTip = vel(nx.tip, pv.tip);
    const vHand = vel(nx.hS, pv.hS);
    // 날 방향: 칼끝 속도에서 칼 축 성분을 뺀 쪽이 앞날(긴 날)이 향하는 쪽. 느릴 때는 앞 값 유지
    const dW = J.dW;
    let edge = v3.sub(vTip, v3.mul(dW, v3.dot(vTip, dW)));
    if (v3.len(edge) > 2) edge = v3.norm(edge);
    else edge = edgePrev ?? v3.norm(v3.cross(dW, [0, 1, 0]));
    edgePrev = edge;
    const yawP = yawOf(J.Rp);
    const yawC = yawOf(J.Rc);
    const fore = v3.sub(J.hS, J.elS);
    const upperA = v3.sub(J.elS, J.shS);
    const chestUp = [J.Rc[1], J.Rc[4], J.Rc[7]];
    const com = centerOfMass(J);
    rows.push({
      t, phi: phaseAt(marks, t), ch, J, vTip, vHand, edge, yawP, yawC, com,
      ang: {
        pelvisYaw: yawP,
        chestYaw: yawC,
        xFactor: yawC - yawP,
        lean: ch.pelvis.pitch + ch.chest.lean,
        shoulderElevS: angleBetween(upperA, v3.mul(chestUp, -1)),
        elbowS: 180 - angleBetween(v3.mul(upperA, -1), fore),
        elbowO: 180 - angleBetween(v3.sub(J.shO, J.elO), v3.sub(J.hO, J.elO)),
        wrist: angleBetween(fore, dW), // 아래팔과 칼 사이 (0 = 칼이 아래팔 연장선)
        kneeL: 180 - angleBetween(v3.sub(J.legs.L.hip, J.legs.L.knee), v3.sub(J.legs.L.ankle, J.legs.L.knee)),
        kneeR: 180 - angleBetween(v3.sub(J.legs.R.hip, J.legs.R.knee), v3.sub(J.legs.R.ankle, J.legs.R.knee)),
        footYawL: ch.feet.L.yaw,
        footYawR: ch.feet.R.yaw,
      },
    });
    prev = J;
  }
  // 각속도 (가운데 차분)
  const d = (arr, i) => (arr[Math.min(n - 1, i + 1)] - arr[Math.max(0, i - 1)]) / ((Math.min(n - 1, i + 1) - Math.max(0, i - 1)) * dt);
  const unwrap = (a) => {
    const o = [a[0]];
    for (let i = 1; i < a.length; i++) {
      let x = a[i];
      while (x - o[i - 1] > 180) x -= 360;
      while (x - o[i - 1] < -180) x += 360;
      o.push(x);
    }
    return o;
  };
  const yp = unwrap(rows.map((r) => r.yawP));
  const yc = unwrap(rows.map((r) => r.yawC));
  // 위팔 각속도: 가슴 틀에서 위팔 방향이 도는 빠르기 (rad/s) — 어깨 관절
  const upperDir = rows.map((r) => m3.applyT(r.J.Rc, v3.norm(v3.sub(r.J.elS, r.J.shS))));
  // 손목: 아래팔 틀에서 칼 방향이 도는 빠르기
  const wristDir = rows.map((r) => {
    const f = v3.norm(v3.sub(r.J.hS, r.J.elS));
    return [v3.dot(r.J.dW, f), ...v3.norm(v3.cross(f, r.J.dW))];
  });
  const angRate = (dirs, i) => {
    const a = dirs[Math.max(0, i - 1)], b = dirs[Math.min(n - 1, i + 1)];
    const k = Math.min(3, a.length);
    const aa = a.slice(0, 3), bb = b.slice(0, 3);
    return (angleBetween(aa, bb) * D2R) / ((Math.min(n - 1, i + 1) - Math.max(0, i - 1)) * dt);
  };
  const wristAng = rows.map((r) => r.ang.wrist);
  for (let i = 0; i < n; i++) {
    const r = rows[i];
    r.w = {
      pelvis: d(yp, i) * D2R,
      chest: d(yc, i) * D2R,
      shoulder: angRate(upperDir, i),
      wrist: Math.abs(d(wristAng, i)) * D2R,
    };
    r.sp = { tip: v3.len(r.vTip), hand: v3.len(r.vHand) };
  }

  // 칼끝 속도 나누기: 몸통(가슴이 굳은 채 돌고 옮겨 가는 몫) / 팔 / 손목(칼이 아래팔에 대해 도는 몫)
  for (let i = 0; i < n; i++) {
    const r = rows[i];
    const a = rows[Math.max(0, i - 1)], b = rows[Math.min(n - 1, i + 1)];
    const span = (Math.min(n - 1, i + 1) - Math.max(0, i - 1)) * dt;
    // 가슴 틀에 붙은 점으로서의 칼끝 속도
    const tipLocalA = m3.applyT(a.J.Rc, v3.sub(r.J.tip, r.J.C));
    const pA = v3.add(a.J.C, m3.apply(a.J.Rc, tipLocalA));
    const pB = v3.add(b.J.C, m3.apply(b.J.Rc, tipLocalA));
    const vTrunk = v3.mul(v3.sub(pB, pA), 1 / span);
    // 아래팔에 붙은 점으로서의 칼끝 속도
    const fr = (J) => {
      const x = v3.norm(v3.sub(J.hS, J.elS));
      const y0 = v3.norm(v3.cross(x, J.Rc.length ? [J.Rc[2], J.Rc[5], J.Rc[8]] : [0, 0, 1]));
      const z = v3.cross(x, y0);
      return [x, y0, z];
    };
    const Fa = fr(a.J), Fb = fr(b.J), Fr = fr(r.J);
    const rel = v3.sub(r.J.tip, r.J.hS);
    const loc = [v3.dot(rel, Fr[0]), v3.dot(rel, Fr[1]), v3.dot(rel, Fr[2])];
    const at = (J, F) => v3.add(J.hS, v3.add(v3.mul(F[0], loc[0]), v3.add(v3.mul(F[1], loc[1]), v3.mul(F[2], loc[2]))));
    const vFore = v3.mul(v3.sub(at(b.J, Fb), at(a.J, Fa)), 1 / span);
    const vt = r.vTip;
    const s = v3.len(vt) || 1;
    const u = v3.mul(vt, 1 / s);
    r.share = {
      trunk: v3.dot(vTrunk, u) / s,
      wrist: v3.dot(v3.sub(vt, vFore), u) / s,
    };
    r.share.arm = 1 - r.share.trunk - r.share.wrist;
  }
  return rows;
}

/** 측정 요약 (redesign §2-6 목표표와 같은 항목) */
export function summarize(rows, marks) {
  const pick = (a, b) => rows.filter((r) => r.t >= a - 1e-9 && r.t <= b + 1e-9);
  const strike = pick(marks.tw - 0.04, marks.tf);
  // 최고 시각: 최고값의 95% 이상인 구간의 가운데 (칼끝처럼 평평한 봉우리에서 흔들리지 않게). 값은 최고값
  const peak = (arr, f) => {
    const best = arr.reduce((m, r) => (Math.abs(f(r)) > Math.abs(f(m)) ? r : m), arr[0]);
    const top = Math.abs(f(best));
    let i = arr.indexOf(best), a = i, b = i;
    while (a > 0 && Math.abs(f(arr[a - 1])) >= 0.95 * top) a--;
    while (b < arr.length - 1 && Math.abs(f(arr[b + 1])) >= 0.95 * top) b++;
    return { ...best, t: (arr[a].t + arr[b].t) / 2 };
  };
  const pTip = peak(strike, (r) => r.sp.tip);
  const pHand = peak(strike, (r) => r.sp.hand);
  // 베기 방향의 돌림 부호: 감기 끝 → 지나가기 끝으로 가슴이 도는 쪽
  const sgn = Math.sign(rows.find((r) => r.t >= marks.tf).yawC - rows.find((r) => r.t >= marks.tw).yawC) || -1;
  const pP = peak(strike, (r) => Math.max(0, sgn * r.w.pelvis));
  const pC = peak(strike, (r) => Math.max(0, sgn * r.w.chest));
  const pS = peak(strike, (r) => r.w.shoulder);
  const pW = peak(strike, (r) => r.w.wrist);
  const headTop = (r) => r.J.head[1] + BODY.headR;
  const windRows = pick(marks.t0, marks.tw + 0.08);
  const handAbove = Math.max(...windRows.map((r) => r.J.hS[1] - headTop(r)));
  const behind = Math.min(...windRows.map((r) => m3.applyT(r.J.Rc, v3.sub(r.J.hS, r.J.C))[0] - BODY.torsoFront));
  const elev = Math.max(...windRows.map((r) => r.ang.shoulderElevS));
  // 지나가기: 칼 든 손이 반대쪽으로 얼마나 넘어가나 (칼 쪽 +)
  //  handSideChest = 가슴 가운데 기준, 머리 방향(땅) 틀 옆 좌표 — 디렉터 mx.mjs 의 hand_side_min 과 같은 식이고 재설계 §2-6 목표가 이 값
  //  handSidePelvis = 골반 틀(골반과 같이 돎) 옆 좌표, handSideRoot = 골반 가운데 기준 땅 틀 옆 좌표 (참고)
  const follow = pick(marks.tc, marks.tf);
  // 오른쪽에서 벤 베기(가슴이 − 로 돎)는 −z 쪽으로, 왼쪽에서 벤 베기는 +z 쪽으로 넘어간다 → 늘 '넘어간 쪽 = −' 로 적는다
  const crossSide = (v) => (sgn < 0 ? v : -v);
  const crossChest = Math.min(...follow.map((r) => crossSide(r.J.hS[2] - r.J.C[2])));
  const cross = Math.min(...follow.map((r) => crossSide(m3.applyT(r.J.Rp, v3.sub(r.J.hS, r.J.hipC))[2])));
  const crossRoot = Math.min(...follow.map((r) => crossSide(r.J.hS[2] - r.J.hipC[2])));
  const endRow = rows.find((r) => r.t >= marks.tf);
  const range = (arr) => Math.max(...arr) - Math.min(...arr);
  const main = pick(marks.t0, marks.tf);
  let path = 0, tipPath = 0;
  for (let i = 1; i < main.length; i++) {
    path += v3.dist(main[i].J.hS, main[i - 1].J.hS);
    tipPath += v3.dist(main[i].J.tip, main[i - 1].J.tip);
  }
  // 허점: 칼이 몸 앞(상대와 나 사이, 가슴 앞 0.45 m 의 세로 띠 머리~배 높이)을 0.3 m 넘게 비운 시간, 칼끝이 몸 뒤에 있는 시간
  //  (표시·비교용 어림값. 실제로 막히는지는 게임 물리가 정한다)
  const segDist = (p, a, b) => {
    const ab = v3.sub(b, a);
    const u = Math.max(0, Math.min(1, v3.dot(v3.sub(p, a), ab) / (v3.dot(ab, ab) || 1)));
    return v3.dist(p, v3.add(a, v3.mul(ab, u)));
  };
  const segSeg = (a0, a1, b0, b1) => {
    let best = Infinity;
    for (let i = 0; i <= 12; i++) best = Math.min(best, segDist(v3.lerp(a0, a1, i / 12), b0, b1));
    return best;
  };
  let openTime = 0, behindTime = 0;
  const dtS = 1 / HZ;
  for (const r of pick(marks.tw, marks.tg)) {
    const c = r.J.C;
    const w0 = [c[0] + 0.45, c[1] - 0.25, c[2]], w1 = [c[0] + 0.45, c[1] + 0.4, c[2]];
    if (segSeg(r.J.pommel, r.J.tip, w0, w1) > 0.3) openTime += dtS;
    if (r.J.tip[0] < c[0] - 0.1) behindTime += dtS;
  }
  const ms = (x) => Math.round(x * 1000);
  const tc = marks.tc;
  const seq = [
    ['골반', pP], ['가슴', pC], ['어깨(위팔)', pS], ['손', pHand], ['손목(칼)', pW], ['칼끝', pTip],
  ].map(([k, r]) => ({ part: k, t: ms(r.t - tc), value: null }));
  seq[0].value = +(sgn * pP.w.pelvis).toFixed(1);
  seq[1].value = +(sgn * pC.w.chest).toFixed(1);
  seq[2].value = +pS.w.shoulder.toFixed(1);
  seq[3].value = +pHand.sp.hand.toFixed(1);
  seq[4].value = +pW.w.wrist.toFixed(1);
  seq[5].value = +pTip.sp.tip.toFixed(1);
  // 순서: 골반 → 가슴 → 손 → 칼끝. 120 Hz 표본·평평한 봉우리라 10 ms 안의 차이는 같은 때로 본다
  const TIE = 10;
  const ordered = seq[0].t <= seq[1].t + TIE && seq[1].t <= seq[3].t + TIE && seq[3].t <= seq[5].t + TIE;
  const reachOver = Math.max(...rows.map((r) => Math.max(r.J.overS, r.J.overO)));
  const legOver = Math.max(...rows.map((r) => Math.max(r.J.legs.L.over, r.J.legs.R.over)));
  const tipMin = Math.min(...rows.map((r) => r.J.tip[1])); // 칼끝이 가장 낮았던 높이 (0 = 땅)
  const wristMax = Math.max(...rows.map((r) => r.ang.wrist)); // 아래팔-칼 각 최대 (body.mjs WRIST_MAX 로 막힌다)
  const wristClampTime = rows.filter((r) => r.ang.wrist > WRIST_HUMAN + 0.5).length / HZ; // 아래팔-칼 각이 135° 를 넘은 시간 (손목 옆굽힘만으로 닿는 어림)
  const wristOver160 = rows.filter((r) => r.ang.wrist > 160.5).length / HZ; // 160° 를 넘은 시간 (손목 폄까지 보태도 어려운 어림)
  // 칼끝 최고 때 가슴 각속도가 자기 최고의 몇 %
  const trunkCarry = pC.w.chest ? (sgn * pTip.w.chest) / (sgn * pC.w.chest) : 0;
  // 칼끝이 겨눈 선(φc)을 지날 때
  const atC = rows.find((r) => r.t >= tc);
  // 표시 자세 (감기 끝·손목 풀림·겨눈 선·지나가기 끝): 관절각과 손·칼끝이 몸 둘레 어디에 있나
  const keyPose = (tm) => {
    const r = rows.find((x) => x.t >= tm - 1e-9) ?? rows[rows.length - 1];
    const hc = m3.applyT(r.J.Rc, v3.sub(r.J.hS, r.J.C));
    const [el, az] = dirAngles(r.J.dW);
    const f2 = (x) => +x.toFixed(2);
    return {
      t: f2(r.t),
      pelvisYaw: Math.round(r.yawP), chestYaw: Math.round(r.yawC), xFactor: Math.round(r.ang.xFactor), lean: Math.round(r.ang.lean),
      shoulderElev: Math.round(r.ang.shoulderElevS), elbowS: Math.round(r.ang.elbowS), wrist: Math.round(r.ang.wrist), kneeL: Math.round(r.ang.kneeL), kneeR: Math.round(r.ang.kneeR),
      handChest: hc.map(f2), handWorld: r.J.hS.map(f2), tipWorld: r.J.tip.map(f2), swordElAz: [Math.round(el), Math.round(az)],
      footL: [f2(r.J.legs.L.ankle[0]), f2(r.J.legs.L.ankle[2])], footR: [f2(r.J.legs.R.ankle[0]), f2(r.J.legs.R.ankle[2])],
    };
  };
  const keyPoses = Object.fromEntries(['t0', 'tw', 'tr', 'tc', 'tf'].map((k) => [k, keyPose(marks[k])]));
  // 몸 신호 시간표 (겨눈 선 tc 기준 ms): 상대·AI·플레이어가 몸에서 읽을 수 있는 것이 언제 나타나고 사라지나
  const rel = (r) => (r ? Math.round((r.t - tc) * 1000) : null);
  const firstFrom = (a, b, f) => rows.find((r) => r.t >= a - 1e-9 && r.t <= b + 1e-9 && f(r)) ?? null;
  const lastIn = (a, b, f) => [...rows].reverse().find((r) => r.t >= a - 1e-9 && r.t <= b + 1e-9 && f(r)) ?? null;
  const shoulderY = (r) => r.J.shS[1];
  const pelPeak = Math.max(...pick(marks.tw - 0.04, marks.tf).map((r) => Math.max(0, sgn * r.w.pelvis)));
  const ankle = (r, k) => r.J.legs[k].ankle[1];
  const stepFoot = ['L', 'R'].reduce((best, k) => (Math.max(...rows.map((r) => ankle(r, k))) > Math.max(...rows.map((r) => ankle(r, best))) ? k : best), 'R');
  const lifted = (r) => ankle(r, stepFoot) > BODY.ankleY + 0.025;
  const openAt = (r) => {
    const c = r.J.C;
    return segSeg(r.J.pommel, r.J.tip, [c[0] + 0.45, c[1] - 0.25, c[2]], [c[0] + 0.45, c[1] + 0.4, c[2]]) > 0.3;
  };
  const signals = {
    handsAboveShoulder: rel(firstFrom(marks.t0, marks.tc, (r) => r.J.hS[1] > shoulderY(r) + 0.05)),
    handsAboveHead: rel(firstFrom(marks.t0, marks.tc, (r) => r.J.hS[1] > r.J.head[1] + BODY.headR)),
    bladeBehind: rel(firstFrom(marks.t0, marks.tc, (r) => r.J.tip[0] < r.J.C[0] - 0.1)),
    pelvisTurns: rel(firstFrom(marks.tw - 0.1, marks.tc, (r) => sgn * r.w.pelvis > 0.2 * pelPeak)),
    footLifts: rel(firstFrom(marks.t0, marks.tf, lifted)),
    footLands: rel((() => {
      const up = firstFrom(marks.t0, marks.tf, lifted);
      return up ? firstFrom(up.t, marks.tg, (r) => !lifted(r)) : null;
    })()),
    frontOpens: rel(firstFrom(marks.tw, marks.tg, openAt)),
    frontOpenAfterLine: rel(firstFrom(marks.tc, marks.tg, openAt)),
    frontCloses: rel(lastIn(marks.tw, marks.tg, openAt)),
  };
  return {
    keyPoses,
    signals,
    time: { wind: +(marks.tw - marks.t0).toFixed(3), releaseToLine: +(tc - marks.tw).toFixed(3), follow: +(marks.tf - tc).toFixed(3), recover: +(marks.tg - marks.tf).toFixed(3), total: +marks.tg.toFixed(3) },
    tipPeak: +pTip.sp.tip.toFixed(1),
    tipAtLine: +atC.sp.tip.toFixed(1),
    handPeak: +pHand.sp.hand.toFixed(1),
    sequence: seq,
    ordered,
    trunkCarry: +trunkCarry.toFixed(2),
    shareAtTipPeak: { trunk: +pTip.share.trunk.toFixed(2), arm: +pTip.share.arm.toFixed(2), wrist: +pTip.share.wrist.toFixed(2) },
    wind: { handAboveHeadTop: +handAbove.toFixed(2), handBehindTorsoFront: +(-behind).toFixed(2), shoulderElev: Math.round(elev) },
    followThrough: { handSideChest: +crossChest.toFixed(2), handSidePelvis: +cross.toFixed(2), handSideRoot: +crossRoot.toFixed(2), handHeightOverHip: +(endRow.J.hS[1] - endRow.J.hipC[1]).toFixed(2) },
    range: {
      chestYaw: Math.round(range(main.map((r) => r.yawC))),
      pelvisYaw: Math.round(range(main.map((r) => r.yawP))),
      xFactorMax: Math.round(Math.max(...main.map((r) => Math.abs(r.ang.xFactor)))),
      handPath: +path.toFixed(2),
      tipPath: +tipPath.toFixed(2),
      comShift: +v3.dist(rows[0].com, endRow.com).toFixed(2),
    },
    opening: { openTime: +openTime.toFixed(2), bladeBehindTime: +behindTime.toFixed(2), maxTurn: Math.round(Math.max(...main.map((r) => Math.abs(r.yawC)))) },
    checks: { reachOver: +reachOver.toFixed(3), legOver: +legOver.toFixed(3), tipMin: +tipMin.toFixed(2), wristMax: Math.round(wristMax), wristClampTime: +wristClampTime.toFixed(2), wristOver160: +wristOver160.toFixed(2) },
  };
}

/** 칼이 가슴 앞 0.45 m 세로 띠(가슴 높이 −0.25 ~ +0.4 m)에서 떨어진 거리 m — summarize 의 openAt 과 같은 띠·같은 셈(칼 13점) */
export function guardGapOf(J) {
  const c = J.C;
  const b0 = [c[0] + 0.45, c[1] - 0.25, c[2]], b1 = [c[0] + 0.45, c[1] + 0.4, c[2]];
  const ab = v3.sub(b1, b0);
  let best = Infinity;
  for (let i = 0; i <= 12; i++) {
    const p = v3.lerp(J.pommel, J.tip, i / 12);
    const u = Math.max(0, Math.min(1, v3.dot(v3.sub(p, b0), ab) / v3.dot(ab, ab)));
    best = Math.min(best, v3.dist(p, v3.add(b0, v3.mul(ab, u))));
  }
  return best;
}

/** 걸음: 가장 많이 옮긴 발, 처음·끝 자리(발목, 땅 틀 x·z), 뜨는·딛는 때 (발목이 1 cm 넘게 뜸 · 다시 4 mm 안으로) */
export function stepOf(rows, marks) {
  const ank = (r, f) => r.J.legs[f].ankle;
  const moved = (f) => Math.hypot(ank(rows.at(-1), f)[0] - ank(rows[0], f)[0], ank(rows.at(-1), f)[2] - ank(rows[0], f)[2]);
  const foot = moved('L') >= moved('R') ? 'L' : 'R';
  if (moved(foot) < 0.05) return null;
  const y0 = ank(rows[0], foot)[1];
  const lift = rows.find((r) => ank(r, foot)[1] > y0 + 0.01);
  const land = lift && rows.find((r) => r.t > lift.t && ank(r, foot)[1] <= y0 + 0.004);
  const xz = (p) => [+p[0].toFixed(3), +p[2].toFixed(3)];
  return {
    foot,
    from: xz(ank(rows[0], foot)),
    to: xz(ank(rows.at(-1), foot)),
    liftT: lift ? +lift.t.toFixed(3) : null,
    landT: land ? +land.t.toFixed(3) : null,
    liftPhi: lift ? +phaseAt(marks, lift.t).toFixed(3) : null,
    landPhi: land ? +phaseAt(marks, land.t).toFixed(3) : null,
  };
}

/**
 * 선 자세 (clip/2 v1, 디렉터 9/29): 칼 쪽 발(오른손잡이 = R)이 처음(t0)·끝(tg) 표본에서 앞인가 뒤인가.
 *  앞·뒤 = 두 발목의 땅 틀 x(앞) 차이. R2 는 발 채널을 역할(딛은 발·옮기는 발)로 읽고, 검사기는 이 표시를 J 와 맞춰 본다.
 */
export function stanceOf(rows, swordFoot = 'R') {
  const other = swordFoot === 'R' ? 'L' : 'R';
  const at = (r) => (r.J.legs[swordFoot].ankle[0] >= r.J.legs[other].ankle[0] ? 'front' : 'rear');
  return { swordFoot, start: at(rows[0]), end: at(rows.at(-1)) };
}

/**
 * 끝 자세(복귀 끝)가 게임 자세표(src/guards.js 14개) 중 어느 것과 가장 가까운가 — 앞손 자리 오차 m.
 *  비교 틀 = guards.js 손과 같은 틀: 가슴 가운데 원점, 바라보는 방향(땅 틀 x 앞 · y 위 · z 칼 쪽).
 */
export function nearestGuard(J, guards) {
  const h = v3.sub(J.hS, J.C);
  const list = Object.entries(guards)
    .map(([id, g]) => ({ id, err: +v3.len(v3.sub(h, g.hand)).toFixed(3) }))
    .sort((a, b) => a.err - b.err);
  return { nearest: list[0].id, handError: list[0].err, next: list.slice(1, 3) };
}

const r4 = (x) => Math.round(x * 1e4) / 1e4;
const r1 = (x) => Math.round(x * 10) / 10;
const rv = (a) => a.map(r4);

/** JSON 으로 낼 표본 (redesign atlas 채널 + 관절각 + 속도 + 막대 인형 관절). 팔꿈치·어깨·월드 칼 방향은 J 에서 얻는다 */
export function toJSONFrames(rows) {
  const r3 = (x) => Math.round(x * 1e3) / 1e3;
  const rv3 = (a) => a.map(r3);
  return rows.map((r) => {
    const J = r.J;
    const Rc = J.Rc;
    const inChest = (p) => rv3(m3.applyT(Rc, v3.sub(p, J.C)));
    const inChestDir = (d) => rv3(m3.applyT(Rc, d));
    return {
      t: r4(r.t),
      phi: r3(r.phi),
      pelvis: { yaw: r1(r.yawP), pitch: r1(r.ch.pelvis.pitch), drop: r3(r.ch.pelvis.drop) },
      chest: { yaw: r1(r.yawC), xFactor: r1(r.ang.xFactor), lean: r1(r.ang.lean), side: r1(r.ch.chest.side) },
      handS: inChest(J.hS),
      handO: inChest(J.hO),
      sword: inChestDir(J.dW),
      edge: inChestDir(r.edge),
      elbowPoleS: inChestDir(v3.norm(v3.sub(J.elS, v3.lerp(J.shS, J.hS, 0.5)))),
      elbowPoleO: inChestDir(v3.norm(v3.sub(J.elO, v3.lerp(J.shO, J.hO, 0.5)))),
      // 어깨띠: 들림(위)·내밂(앞) m — 팔을 60° 넘게 들면 최대 0.06 m 오르고, 뻗으면 최대 0.04 m 나간다 (body.mjs girdle)
      girdleS: [r3(J.girdleS.lift), r3(J.girdleS.prot)],
      girdleO: [r3(J.girdleO.lift), r3(J.girdleO.prot)],
      // 틈: 칼(자루 끝 → 칼끝)이 가슴 앞 0.45 m 세로 띠에서 떨어진 거리 m, 0.2 → 0.4 m 를 0 → 1 로 (summarize 의 '앞이 빈 때'와 같은 띠)
      ...(() => {
        const gap = guardGapOf(J);
        return { guardGap: r3(gap), openness: r3(Math.max(0, Math.min(1, (gap - 0.2) / 0.2)) ** 2 * (3 - 2 * Math.max(0, Math.min(1, (gap - 0.2) / 0.2)))) };
      })(),
      feet: { L: { yaw: r1(r.ch.feet.L.yaw), lift: r3(r.ch.feet.L.lift) }, R: { yaw: r1(r.ch.feet.R.yaw), lift: r3(r.ch.feet.R.lift) } },
      com: rv3(r.com),
      ang: Object.fromEntries(Object.entries(r.ang).filter(([k]) => !k.startsWith('footYaw')).map(([k, v]) => [k, r1(v)])),
      w: { pelvis: r1(r.w.pelvis), chest: r1(r.w.chest), shoulder: r1(r.w.shoulder), wrist: r1(r.w.wrist) },
      speed: { tip: r1(r.sp.tip), hand: r1(r.sp.hand) },
      J: flatJoints(J),
    };
  });
}

/**
 * 표본들을 열(채널) 단위로 묶는다 — 같은 이름을 표본마다 되풀이하지 않아 파일이 반쯤으로 준다.
 *  숫자 채널은 [표본 수] 배열, 벡터 채널(3칸)은 [표본 수 × 3] 평면 배열, J 는 [표본 수 × 관절 수 × 3].
 *  채널 이름은 점으로 잇는다: 'pelvis.yaw', 'handS', 'feet.L.lift' …
 */
export function toColumns(frames) {
  const cols = {};
  const walk = (o, pre) => {
    for (const [k, v] of Object.entries(o)) {
      const name = pre ? `${pre}.${k}` : k;
      if (Array.isArray(v)) (cols[name] ??= []).push(...v);
      else if (v && typeof v === 'object') walk(v, name);
      else (cols[name] ??= []).push(v);
    }
  };
  for (const f of frames) walk(f, '');
  const width = Object.fromEntries(Object.entries(cols).map(([k, a]) => [k, a.length / frames.length]));
  return { n: frames.length, width, cols };
}

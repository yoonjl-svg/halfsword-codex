// ─────────────────────────────────────────────────────────────
//  베기 동작 비교 화면 (동작 연구 PM)
//   기준 동작 클립(docs/motion/clips)을 막대 인형으로 재생하고, 우리 캐릭터 기록(docs/motion/records)을 겹쳐 본다.
//   저장소에서: npm run dev → http://localhost:5173/tools/motion/viewer.html
//   데이터 위치는 window.MOTION_DATA_BASE (기본 '../../docs/motion/').
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

const BASE = window.MOTION_DATA_BASE ?? '../../docs/motion/';
const $ = (id) => document.getElementById(id);
const SIZES = ['small', 'medium', 'large'];
const SIZE_KO = { small: '작게 (지금 게임)', medium: '보통', large: '크게' };
const OVERHEAD = new Set(['zornhau', 'oberhau', 'schielhau', 'scheitelhau', 'krumphau']);
const TURNING = new Set(['zornhau', 'zwerchhau', 'mittelhau', 'unterhau']);
const CROSSING = new Set(['zornhau', 'mittelhau']);
// 롱소드 말고 다른 무기 클립은 clips/<무기>/index.json 에 따로 있다 (clip_format.md §1). 화면에서는 '<무기>:<베기>' 로 묶는다
const WEAPON_KO = { zweihander: '츠바이핸더', sabre: '세이버', rapier: '레이피어' };
const REC_FOR = { zornhau: 'game_zornhau', oberhau: 'game_oberhau', zwerchhau: 'game_zwerchhau', mittelhau: 'game_mittelhau', unterhau: 'game_unterhau', schielhau: 'game_zornhau', scheitelhau: 'game_oberhau', krumphau: 'game_zornhau' };

const state = {
  cut: 'zornhau', side: 'right', size: 'large', all: false,
  playing: true, speed: 0.5, t: 0,
  trail: true, ghosts: true, foe: true, cam: 'back',
  rec: '', recAlign: true,
};
try {
  const saved = JSON.parse(localStorage.getItem('motion-viewer') || '{}');
  for (const k of ['cut', 'side', 'size', 'speed', 'cam', 'all', 'trail', 'ghosts', 'foe']) if (saved[k] != null) state[k] = saved[k];
} catch {}
function remember() {
  try {
    const { cut, side, size, speed, cam, all, trail, ghosts, foe } = state;
    localStorage.setItem('motion-viewer', JSON.stringify({ cut, side, size, speed, cam, all, trail, ghosts, foe }));
  } catch {}
}

// ── 색 (테마 토큰) ──
let C = {};
function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const g = (n) => cs.getPropertyValue(n).trim();
  C = {
    ground: g('--ground'), panel: g('--panel'), ink: g('--ink'), muted: g('--muted'), rule: g('--rule'),
    ref: g('--ref'), refSoft: g('--ref-soft'), game: g('--game'), good: g('--good'), warn: g('--warn'), bad: g('--bad'),
    stage: g('--stage'), grid: g('--grid'), foe: g('--foe'),
    s1: g('--s1') || '#7a5c9e', s2: g('--s2') || '#2f7d7a', s3: g('--s3') || '#6b7a2a',
  };
}
readTheme();

// ── 데이터 ──
const cache = new Map();
async function getJSON(path) {
  if (cache.has(path)) return cache.get(path);
  const p = fetch(BASE + path).then(async (r) => {
    if (!r.ok) throw new Error(`${path} 를 읽지 못했다 (${r.status})`);
    const txt = await r.text();
    try {
      return JSON.parse(txt);
    } catch {
      throw new Error(`${path} 가 JSON 이 아니다 — 데이터 위치(MOTION_DATA_BASE)를 확인`);
    }
  });
  cache.set(path, p);
  return p;
}
function showError(e) {
  const el = $('err');
  el.hidden = false;
  el.textContent = `읽기 실패: ${e.message ?? e}`;
}

/** 클립·기록 공통: 시각 t(초)의 관절 평면 배열 (앞뒤 표본 사이 선형 보간) */
function jointsAt(clip, t, out) {
  const cols = clip.data.cols;
  const n = clip.data.n;
  const nj = clip.joints.length * 3;
  const hz = clip.hz;
  const f = Math.max(0, Math.min(n - 1, (t - cols.t[0]) * hz));
  const i = Math.min(n - 2, Math.floor(f));
  const u = Math.max(0, Math.min(1, f - i));
  const J = cols.J;
  const a = i * nj, b = (i + 1) * nj;
  for (let k = 0; k < nj; k++) out[k] = J[a + k] + (J[b + k] - J[a + k]) * u;
  return out;
}
function colAt(clip, name, t) {
  const cols = clip.data.cols;
  const arr = cols[name];
  if (!arr) return null;
  const f = Math.max(0, Math.min(clip.data.n - 1, (t - cols.t[0]) * clip.hz));
  const i = Math.min(clip.data.n - 2, Math.floor(f));
  const u = f - i;
  return arr[i] + (arr[i + 1] - arr[i]) * u;
}
const duration = (clip) => clip.data.cols.t[clip.data.n - 1];

// ── 3D 무대 ──
const stageEl = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
stageEl.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 16 / 10, 0.05, 60);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.12;

const CAMS = {
  back: { pos: [-3.9, 2.35, 2.0], at: [0.55, 1.0, 0] },
  side: { pos: [0.45, 1.3, 5.6], at: [0.45, 1.0, 0] },
  front: { pos: [5.8, 1.6, 0.6], at: [0.2, 1.0, 0] },
  top: { pos: [0.45, 6.4, 0.02], at: [0.45, 0.8, 0] },
};
function setCam(name) {
  const c = CAMS[name] ?? CAMS.back;
  camera.position.set(...c.pos);
  controls.target.set(...c.at);
  controls.update();
}

const grid = new THREE.GridHelper(6, 12);
grid.position.set(0.6, 0, 0);
scene.add(grid);
// 상대: 게임 뼈대 크기의 반투명 몸 (1.9 m 앞)
const foe = new THREE.Group();
const foeMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.22, depthWrite: false });
const foeBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.62, 6, 16), foeMat);
foeBody.position.set(0, 1.12, 0);
const foeHead = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), foeMat);
foeHead.position.set(0, 1.62, 0);
const foeLegs = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.7, 4, 12), foeMat);
foeLegs.position.set(0, 0.47, 0);
foe.add(foeBody, foeHead, foeLegs);
foe.position.set(1.9, 0, 0);
scene.add(foe);

const lineMats = new Set();
function lineMat(opts) {
  const m = new LineMaterial({ linewidth: 3, transparent: true, depthWrite: false, ...opts });
  lineMats.add(m);
  return m;
}

/** 막대 인형 하나 */
class Figure {
  constructor(joints, bones, { width = 3, opacity = 1, sword = 5, dots = true } = {}) {
    this.joints = joints;
    this.idx = Object.fromEntries(joints.map((n, i) => [n, i]));
    this.body = bones.filter((b) => b[2] !== 'sword');
    this.buf = new Float32Array(joints.length * 3);
    this.group = new THREE.Group();
    this.pos = new Float32Array(this.body.length * 6);
    this.geo = new LineSegmentsGeometry();
    this.geo.setPositions(this.pos);
    this.mat = lineMat({ linewidth: width, opacity });
    this.lines = new LineSegments2(this.geo, this.mat);
    this.lines.frustumCulled = false;
    this.sgeo = new LineSegmentsGeometry();
    this.spos = new Float32Array(6);
    this.sgeo.setPositions(this.spos);
    this.smat = lineMat({ linewidth: sword, opacity });
    this.sword = new LineSegments2(this.sgeo, this.smat);
    this.sword.frustumCulled = false;
    this.headMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35 * opacity, depthWrite: false });
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), this.headMat);
    this.dotMat = new THREE.MeshBasicMaterial({ transparent: true, opacity });
    const dotIdx = ['shS', 'elS', 'hS', 'shO', 'elO', 'hO', 'kneeL', 'kneeR', 'hipC', 'chest'].filter((n) => n in this.idx);
    this.dotIdx = dotIdx.map((n) => this.idx[n]);
    this.dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 10, 8), this.dotMat, this.dotIdx.length);
    this.dots.frustumCulled = false;
    this.dots.visible = dots;
    this.tipMat = new THREE.MeshBasicMaterial({ transparent: true, opacity });
    this.tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), this.tipMat);
    this.group.add(this.lines, this.sword, this.head, this.dots, this.tip);
    this._m = new THREE.Matrix4();
  }
  color(c) {
    this.mat.color.set(c);
    this.smat.color.set(c);
    this.headMat.color.set(c);
    this.dotMat.color.set(c);
    this.tipMat.color.set(c);
  }
  opacity(o) {
    this.mat.opacity = o;
    this.smat.opacity = o;
    this.headMat.opacity = 0.35 * o;
    this.dotMat.opacity = o;
    this.tipMat.opacity = o;
  }
  set(J) {
    const I = this.idx;
    let k = 0;
    for (const [a, b] of this.body) {
      const ia = I[a] * 3, ib = I[b] * 3;
      this.pos[k++] = J[ia]; this.pos[k++] = J[ia + 1]; this.pos[k++] = J[ia + 2];
      this.pos[k++] = J[ib]; this.pos[k++] = J[ib + 1]; this.pos[k++] = J[ib + 2];
    }
    const lb = this.geo.attributes.instanceStart.data;
    lb.array.set(this.pos);
    lb.needsUpdate = true;
    const p = I.pommel * 3, t = I.tip * 3;
    this.spos.set([J[p], J[p + 1], J[p + 2], J[t], J[t + 1], J[t + 2]]);
    const sb = this.sgeo.attributes.instanceStart.data;
    sb.array.set(this.spos);
    sb.needsUpdate = true;
    const h = I.head * 3;
    this.head.position.set(J[h], J[h + 1], J[h + 2]);
    this.tip.position.set(J[t], J[t + 1], J[t + 2]);
    this.dotIdx.forEach((j, n) => {
      this._m.makeTranslation(J[j * 3], J[j * 3 + 1], J[j * 3 + 2]);
      this.dots.setMatrixAt(n, this._m);
    });
    this.dots.instanceMatrix.needsUpdate = true;
  }
}

/** 칼끝·손이 지나간 길 (빠를수록 짙게) */
class Trail {
  constructor(width) {
    this.geo = new LineGeometry();
    this.geo.setPositions([0, 0, 0, 0, 0, 0.001]);
    this.geo.setColors([1, 1, 1, 1, 1, 1]);
    this.mat = lineMat({ linewidth: width, vertexColors: true, opacity: 0.95 });
    this.line = new Line2(this.geo, this.mat);
    this.line.frustumCulled = false;
  }
  set(clip, joint, speedCol, color, fade) {
    const ji = clip.joints.indexOf(joint) * 3;
    const nj = clip.joints.length * 3;
    const J = clip.data.cols.J;
    const sp = clip.data.cols[speedCol];
    const pos = [];
    const col = [];
    const top = Math.max(...sp);
    const c = new THREE.Color(color);
    const bg = new THREE.Color(C.stage);
    for (let i = 0; i < clip.data.n; i++) {
      pos.push(J[i * nj + ji], J[i * nj + ji + 1], J[i * nj + ji + 2]);
      const u = Math.pow(Math.min(1, sp[i] / top), 0.8) * fade + (1 - fade) * 0.25;
      const m = bg.clone().lerp(c, 0.18 + 0.82 * u);
      col.push(m.r, m.g, m.b);
    }
    this.geo.dispose();
    this.geo = new LineGeometry();
    this.geo.setPositions(pos);
    this.geo.setColors(col);
    this.line.geometry = this.geo;
  }
}

// 그릴 것들
let main = null; // 지금 클립 인형
const others = {}; // 세 크기 겹쳐 보기
const ghosts = []; // 표시 자세 잔상
let recFig = null;
const tipTrail = new Trail(3);
const handTrail = new Trail(1.5);
scene.add(tipTrail.line, handTrail.line);
const recTrail = new Trail(2);
scene.add(recTrail.line);

function resize() {
  const w = stageEl.clientWidth;
  const h = stageEl.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  for (const m of lineMats) m.resolution.set(w, h);
  drawCharts();
}
new ResizeObserver(resize).observe(stageEl);

function applyTheme() {
  readTheme();
  scene.background = new THREE.Color(C.stage);
  scene.remove(grid);
  grid.geometry.dispose();
  const g2 = new THREE.GridHelper(6, 12, new THREE.Color(C.grid), new THREE.Color(C.grid));
  g2.position.copy(grid.position);
  grid.geometry = g2.geometry;
  grid.material = g2.material;
  scene.add(grid);
  foeMat.color.set(C.foe);
  paintFigures();
  refreshTrails();
  drawCharts();
}
function paintFigures() {
  if (main) main.color(C.ref);
  for (const s of SIZES) if (others[s]) others[s].color(C.refSoft);
  for (const g of ghosts) g.color(C.refSoft);
  if (recFig) recFig.color(C.game);
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// ── 지금 보는 것 ──
let index = null;
let recIndex = null;
let clip = null; // 지금 크기
const sizeClips = {}; // 같은 베기·같은 쪽의 세 크기
let noSmall = false; // 작게 벌도 바탕 베기도 없는 클립(런지): "작게 대비" 숫자를 쓰지 않는다
let rec = null;
let recOffset = 0;

/** 이 베기에 겹쳐 볼 게임 기록 — 다른 무기('<무기>:<베기>')는 같은 베기의 롱소드 게임 기록 */
function recFor(cut) {
  return REC_FOR[cut] ?? REC_FOR[cut.split(':').pop()];
}
function entryFor(cut, side, size) {
  return index.clips.find((c) => c.cut === cut && c.side === side && c.size === size);
}
function pathOf(e) {
  return `clips/${e.dir ?? ''}${e.file}`;
}
async function loadCurrent() {
  // 흐름 클립은 크게 한 벌뿐이다: 없는 크기는 바탕 베기(base) 클립으로 채워 "작게 대비" 숫자만 쓰고, 크기 단추·세 크기 겹쳐 보기는 막는다
  const entries = index.clips.filter((c) => c.cut === state.cut && c.side === state.side);
  const have = new Set(entries.map((c) => c.size));
  const base = entries[0]?.base;
  if (!have.has(state.size)) state.size = SIZES.filter((s) => have.has(s)).pop() ?? 'large';
  // 바탕 베기도 없으면(런지) 있는 한 벌로 채운다 — 이때 "작게 대비" 숫자는 쓰지 않는다(renderSheet 의 noSmall)
  const one = SIZES.find((s) => have.has(s));
  const picks = SIZES.map((s) => (have.has(s) ? entryFor(state.cut, state.side, s) : base ? entryFor(base, state.side, s) : entryFor(state.cut, state.side, one)));
  noSmall = !have.has('small') && !base;
  const clips = await Promise.all(picks.map((e) => getJSON(pathOf(e))));
  SIZES.forEach((s, i) => (sizeClips[s] = clips[i]));
  for (const b of $('size').querySelectorAll('button')) b.disabled = !have.has(b.dataset.v);
  pressed('size', state.size);
  $('allSizes').disabled = have.size < SIZES.length;
  if (have.size < SIZES.length) state.all = $('allSizes').checked = false;
  clip = sizeClips[state.size];
  buildFigures();
  await loadRecord();
  state.t = Math.min(state.t, duration(clip));
  renderSheet();
  renderBands();
  refreshTrails();
  drawCharts();
}
function buildFigures() {
  if (main) scene.remove(main.group);
  main = new Figure(clip.joints, clip.bones, { width: 3.2, sword: 5 });
  scene.add(main.group);
  for (const s of SIZES) {
    if (others[s]) scene.remove(others[s].group);
    others[s] = new Figure(sizeClips[s].joints, sizeClips[s].bones, { width: 1.6, sword: 2.5, opacity: 0.45, dots: false });
    scene.add(others[s].group);
  }
  for (const g of ghosts) scene.remove(g.group);
  ghosts.length = 0;
  for (const m of ['tw', 'tc', 'tf']) {
    const g = new Figure(clip.joints, clip.bones, { width: 1.4, sword: 2.2, opacity: 0.28, dots: false });
    g.set(jointsAt(clip, clip.marks[m], g.buf));
    g.markT = clip.marks[m];
    ghosts.push(g);
    scene.add(g.group);
  }
  paintFigures();
  syncVisibility();
}
function syncVisibility() {
  for (const s of SIZES) if (others[s]) others[s].group.visible = state.all && s !== state.size;
  for (const g of ghosts) g.group.visible = state.ghosts;
  tipTrail.line.visible = handTrail.line.visible = state.trail;
  recTrail.line.visible = state.trail && !!rec;
  foe.visible = state.foe;
  if (recFig) recFig.group.visible = !!rec;
}
function refreshTrails() {
  if (!clip) return;
  tipTrail.set(clip, 'tip', 'speed.tip', C.ref, 1);
  handTrail.set(clip, 'hS', 'speed.hand', C.ref, 0.6);
  if (rec) recTrail.set(rec, 'tip', 'speed.tip', C.game, 1);
  for (const m of lineMats) m.resolution.set(stageEl.clientWidth, stageEl.clientHeight);
}

async function loadRecord() {
  if (recFig) {
    scene.remove(recFig.group);
    recFig = null;
  }
  rec = null;
  if (!state.rec) {
    syncVisibility();
    return;
  }
  try {
    rec = state.rec === '__file' ? fileRecord : await getJSON(`records/${state.rec}.json`);
  } catch (e) {
    showError(e);
    rec = null;
  }
  if (!rec) return syncVisibility();
  recFig = new Figure(rec.joints, rec.bones, { width: 2.6, sword: 4, opacity: 0.9 });
  recFig.color(C.game);
  scene.add(recFig.group);
  alignRecord();
  syncVisibility();
}
function tipPeakT(c) {
  if (c.summary?.tipPeakT != null) return c.summary.tipPeakT;
  const seq = c.summary?.sequence?.find((q) => q.part === '칼끝');
  if (seq) return c.marks.tc + seq.t / 1000;
  const sp = c.data.cols['speed.tip'];
  return c.data.cols.t[sp.indexOf(Math.max(...sp))];
}
function alignRecord() {
  if (!rec || !clip) return;
  recOffset = state.recAlign ? tipPeakT(clip) - tipPeakT(rec) : 0;
}

// ── 기록지 (평가 다섯 기준) ──
const fmt = (x, d = 2) => (x == null || Number.isNaN(x) ? '—' : (+x).toFixed(d));
function chip(state, text) {
  return `<span class="chip ${state}">${text}</span>`;
}
function judge(v, t) {
  if (t.na) return chip('na', '해당 없음');
  if (v == null) return '';
  const lo = t.min ?? -Infinity, hi = t.max ?? Infinity;
  if (v >= lo && v <= hi) return chip('good', '목표 안');
  const near = t.near ?? 0;
  if (v >= lo - near && v <= hi + near) return chip('warn', '가까움');
  return chip('bad', '목표 밖');
}
function renderSheet() {
  const s = clip.summary;
  const small = sizeClips.small.summary;
  const cut = clip.base ?? clip.cut;
  $('sName').innerHTML = `${WEAPON_KO[clip.weapon] ? `${WEAPON_KO[clip.weapon]} · ` : ''}${clip.nameKo}<span class="de">${clip.nameDe}</span>`;
  $('sDesc').textContent = `${clip.desc} · ${SIZE_KO[state.size]} · ${state.side === 'right' ? '오른쪽에서' : '왼쪽에서'}`;
  const seq = s.sequence;
  const P = Object.fromEntries(seq.map((q) => [q.part, q]));
  const gapPC = P['가슴'].t - P['골반'].t;
  const ordered = P['골반'].t <= P['가슴'].t && P['가슴'].t <= P['손'].t && P['손'].t <= P['칼끝'].t;
  const ratio = s.tipPeak / small.tipPeak;
  const groups = [
    {
      h: '사람처럼 보인다',
      rows: [
        { l: '운동 사슬 순서', sub: `골반 ${P['골반'].t} → 가슴 ${P['가슴'].t} → 손 ${P['손'].t} → 칼끝 ${P['칼끝'].t} ms (겨눈 선 기준)`, v: ordered ? '순서대로' : '뒤섞임', c: ordered ? (gapPC >= 20 && gapPC <= 60 ? chip('good', '목표 안') : chip('warn', '간격 좁음')) : chip('bad', '목표 밖') },
        { l: '척추 비틀림 최대 (X-factor)', sub: '목표 40° 이상 · 사람 가슴허리 돌림 약 45° (AAOS, 참고·한도 아님)', v: `${s.range.xFactorMax}°`, c: judge(s.range.xFactorMax, { min: 40, near: 5, na: !TURNING.has(cut) }) },
        { l: '손목 (아래팔-칼) 각 최대', sub: `사람 어림: 옆굽힘 약 135°, 손목 폄까지 약 160° [추정, 참고·한도 아님] · 160° 넘은 시간 ${fmt(s.checks.wristOver160 ?? 0)} s`, v: `${s.checks.wristMax}°`, c: s.checks.wristMax <= 135 ? chip('good', '사람 범위') : s.checks.wristMax <= 160 ? chip('good', '손목을 크게 폄') : chip('warn', '관찰: 사람 범위 밖') },
        { l: '팔이 모자란 길이', sub: '게임 팔(어깨→칼자루 0.565 m)로 닿는가 · 0.03 은 지금 쟁기 자세 자체', v: `${fmt(s.checks.reachOver, 3)} m`, c: s.checks.reachOver <= 0.035 ? chip('good', '닿음') : chip('warn', '조금 모자람') },
        { l: '칼끝 가장 낮은 높이', sub: '0 = 땅 · 작게는 게임 자세표 그대로라 땅까지 내려가는 자세가 있다', v: `${fmt(s.checks.tipMin)} m`, c: s.checks.tipMin >= 0.05 ? chip('good', '땅 위') : s.checks.tipMin >= -0.02 ? chip('warn', '땅 스침') : chip('bad', '땅 아래') },
      ],
    },
    {
      h: '크다',
      rows: [
        { l: '손이 움직인 길이', sub: '감기+베기+지나가기 · 목표 1.8 m 이상', v: `${fmt(s.range.handPath)} m`, c: judge(s.range.handPath, { min: 1.8, near: 0.2 }) },
        { l: '가슴 회전 범위', sub: '목표 130° 이상 (세로 베기는 덜 튼다)', v: `${s.range.chestYaw}°`, c: judge(s.range.chestYaw, { min: 130, near: 15, na: !TURNING.has(cut) }) },
        { l: '골반 회전 범위', sub: '목표 70° 이상', v: `${s.range.pelvisYaw}°`, c: judge(s.range.pelvisYaw, { min: 70, near: 8, na: !TURNING.has(cut) }) },
        { l: '지나가기: 손이 반대쪽으로 넘어감', sub: '가슴 가운데 기준 옆 거리(디렉터 측정과 같은 식) · 재설계 목표 −0.35 m 너머 · 게임 팔 0.565 m', v: `${fmt(s.followThrough.handSideChest ?? s.followThrough.handSidePelvis)} m`, c: judge(-(s.followThrough.handSideChest ?? s.followThrough.handSidePelvis), { min: 0.35, near: 0.08, na: !CROSSING.has(cut) }) },
      ],
    },
    {
      h: '준비 동작이 읽힌다',
      rows: [
        { l: '감기 시간', sub: '준비 자세 → 감기 끝', v: `${fmt(s.time.wind)} s`, c: '' },
        { l: '감기: 손 높이 (머리 꼭대기 위)', sub: '목표 +0.10~0.30 m', v: `${fmt(s.wind.handAboveHeadTop)} m`, c: judge(s.wind.handAboveHeadTop, { min: 0.1, max: 0.3, near: 0.04, na: !OVERHEAD.has(cut) }) },
        { l: '감기: 손이 가슴 앞면보다 뒤', sub: '목표 0.08 m 이상 뒤', v: `${fmt(s.wind.handBehindTorsoFront)} m`, c: judge(s.wind.handBehindTorsoFront, { min: 0.08, near: 0.03 }) },
        { l: '감기: 어깨 들림', sub: '목표 100° 이상', v: `${s.wind.shoulderElev}°`, c: judge(s.wind.shoulderElev, { min: 100, near: 10, na: !OVERHEAD.has(cut) }) },
        { l: '칼끝이 몸 뒤에 있는 시간', sub: '길수록 준비가 잘 보인다', v: `${fmt(s.opening.bladeBehindTime)} s`, c: '' },
        { l: '처음 보이는 준비 신호', sub: '손이 어깨 위로 · 칼끝이 몸 뒤로 가운데 이른 것 (칼이 겨눈 선 기준) · 사람 반응 약 0.2~0.25 s [기억]', v: (() => { const g = s.signals ?? {}; const xs = [g.handsAboveShoulder, g.bladeBehind].filter((x) => x != null); return xs.length ? `${(Math.min(...xs) / 1000).toFixed(2)} s` : '—'; })(), c: '' },
      ],
    },
    {
      h: '빠르고 세다',
      rows: [
        noSmall
          ? { l: '칼끝 최고 빠르기', sub: '작게 벌이 없는 클립 — 비율은 재지 않는다', v: `${s.tipPeak} m/s`, c: '' }
          : { l: '칼끝 최고 빠르기', sub: `작게(지금 게임) ${small.tipPeak} m/s 의 ${fmt(ratio)}배 · 목표 1.45배 이상 · 사람 20~33 m/s (참고, 한도 아님)`, v: `${s.tipPeak} m/s`, c: judge(ratio, { min: 1.45, near: 0.1 }) },
        ...(noSmall ? [] : [{ l: '에너지 비 어림 (빠르기²)', sub: '같은 유효 질량이면 · 목표 2배 이상', v: `${fmt(ratio * ratio)}배`, c: judge(ratio * ratio, { min: 2, near: 0.3 }) }]),
        { l: '칼끝 최고 때 가슴이 도는 빠르기', sub: '자기 최고 대비 · 목표 30% 이상', v: `${Math.round(s.trunkCarry * 100)}%`, c: judge(s.trunkCarry, { min: 0.3, near: 0.05 }) },
        { l: '칼끝 빠르기 중 몸통 몫', sub: '목표 30% 이상', v: `${Math.round(s.shareAtTipPeak.trunk * 100)}%`, c: judge(s.shareAtTipPeak.trunk, { min: 0.3, near: 0.05 }) },
      ],
    },
    {
      h: '반동·허점이 있다',
      rows: [
        { l: '앞이 빈 시간', sub: '칼이 가슴 앞 띠를 0.3 m 넘게 비움 (감기 끝~복귀)', v: `${fmt(s.opening.openTime)} s`, c: '' },
        { l: '앞이 마지막으로 열린 때', sub: '칼이 겨눈 선을 지난 뒤 언제까지 틈이 있나 (− 면 치기 전에 이미 닫힘)', v: s.signals?.frontCloses != null ? `${(s.signals.frontCloses / 1000).toFixed(2)} s` : '—', c: '' },
        { l: '지나가기 + 복귀', sub: '겨눈 선 → 다시 자세', v: `${fmt(s.time.follow + s.time.recover)} s`, c: '' },
        { l: '가장 많이 돌아선 각', sub: '가슴이 앞에서 돌아간 각 (등을 보이는 정도)', v: `${s.opening.maxTurn}°`, c: '' },
        { l: '무게중심이 옮겨 간 거리', sub: '시작 → 지나가기 끝 (걸음 포함)', v: `${fmt(s.range.comShift)} m`, c: '' },
      ],
    },
  ];
  if (clip.lunge) {
    const g = clip.lunge;
    groups.unshift({
      h: '런지 (사람 기준: lunge_flow.md)',
      rows: [
        { l: '손이 먼저', sub: '손이 움직이기 시작 → 앞발이 뜸 · 사람 숙련자 70 ± 50 ms [검색 요약]', v: `${g.handFirst} ms`, c: g.handFirst >= 20 ? chip('good', '손 먼저') : chip('warn', '발과 같이') },
        { l: '칼끝이 닿는 때 → 앞발 딛기', sub: '사람: 칼끝이 앞발 딛기 직전·그때 닿는다 [지도서]', v: `${g.footLand >= 0 ? '+' : ''}${fmt(g.footLand)} s`, c: '' },
        { l: '골반이 가장 낮아진 양', sub: '쟁기 자세에서 · 두 발 사이로 정해진다 (앞 정강이 수직·뒷다리 곧게)', v: `${fmt(g.pelvisDrop)} m`, c: '' },
        { l: '가장 낮은 때', sub: '앞발 딛은 뒤 앞무릎이 받을 때 [추정]', v: `+${fmt(g.lowAfterLand, 3)} s`, c: '' },
        { l: '끝 자세', sub: '두 발 사이 · 앞무릎 · 뒷무릎 (180° = 곧게)', v: `${fmt(g.stanceEnd)} m · ${g.kneeFront}° · ${g.kneeBack}°`, c: '' },
        { l: '몸 숙임', sub: '가장 낮을 때 · 사람 17.5° [검색 요약: ISBS]', v: `${g.lean}°`, c: '' },
      ],
    });
  }
  if (clip.flow) {
    const f = clip.flow;
    groups.unshift({
      h: '흐름 (이어 베기)',
      rows: [
        { l: '겨눈 선 → 다음 겨눈 선', sub: '첫 베기 칼이 겨눈 선을 지난 뒤 둘째 베기가 지나기까지 [추정]', v: `${fmt(f.contactGap)} s`, c: '' },
        { l: '사이에서 칼끝이 가장 느릴 때', sub: `첫 칼끝 최고의 ${Math.round(f.tipMin.ofPeak1 * 100)}% · 첫 겨눈 선 +${fmt(f.tipMin.t)} s (이어 감기 꼭대기)`, v: `${fmt(f.tipMin.v, 1)} m/s`, c: f.tipMin.v >= 2 ? chip('good', '칼이 서지 않음') : chip('warn', '거의 섬') },
        { l: '사이에서 손이 가장 느릴 때', sub: `첫 겨눈 선 +${fmt(f.handMin.t)} s`, v: `${fmt(f.handMin.v)} m/s`, c: '' },
        { l: '칼 돌림이 가장 느릴 때', sub: '손 → 칼끝 방향이 도는 빠르기 (월드)', v: `${fmt(f.bladeRateMin.v, 1)} rad/s`, c: '' },
        { l: '몸통이 되감기를 끝낸 때', sub: '가슴이 반대쪽으로 가장 많이 감긴 때 = 둘째 감기 끝', v: `+${fmt(clip.marks2.tw - clip.marks1.tc)} s`, c: '' },
        { l: '둘째 베기 칼끝 최고', sub: '둘째 베기도 온몸 베기 (첫 베기와 같은 크기)', v: `${clip.summary2.tipPeak} m/s`, c: '' },
        { l: '걸음', sub: '베기마다 한 걸음 (Meyer "모든 베기는 제 걸음")', v: `${fmt(f.pelvisAdvance)} m`, c: '' },
      ],
    });
  }
  // 런지(찌르기)는 베기 기준(사슬·크기·몸통 몫)으로 재지 않는다 — 런지 숫자와 반동·허점만
  if (clip.lunge) groups.splice(0, groups.length, ...groups.filter((g) => g.h.startsWith('런지') || g.h === '반동·허점이 있다'));
  $('crits').innerHTML =
    groups
      .map(
        (g) => `<div class="crit"><h3><span>${g.h}</span></h3><div class="rows">${g.rows
          .map((r) => `<div class="row"><div class="lbl">${r.l}<small>${r.sub}</small></div><div class="v">${r.v}</div><div>${r.c}</div></div>`)
          .join('')}</div></div>`,
      )
      .join('') + `<p class="note">반동(헛쳤을 때 몸이 쏠리는 것)은 게임 물리가 정한다. 기준 동작은 몸이 어디까지 실려 가고 언제 다시 자세로 돌아오는지만 보여 준다.</p>`;
  $('srcs').innerHTML = (clip.sources || [])
    .map((q) => `<div><span class="k">${{ manual: '교본', translation: '번역', mocap: '모캡', dataset: '데이터', biomech: '생체역학', estimate: '추정' }[q.kind] ?? q.kind}</span>${q.url ? `<a href="${q.url}" target="_blank" rel="noopener">${q.cite}</a>` : q.cite}</div>`)
    .join('');
  renderRecRows();
  renderLegend();
}
function renderRecRows() {
  const box = $('recRows');
  if (!rec || !clip) {
    box.innerHTML = '<p class="note">지금 게임의 팔 베기를 헤드리스로 돌린 기록이 있다(tools/motion/record_game.mjs). 고르면 주황 인형으로 겹친다.</p>';
    return;
  }
  // 손 위치 차이 (감기 끝~지나가기 끝, 같은 땅 틀)
  const a = new Float32Array(clip.joints.length * 3);
  const b = new Float32Array(rec.joints.length * 3);
  const hi = clip.joints.indexOf('hS') * 3, hr = rec.joints.indexOf('hS') * 3;
  const headR = rec.joints.indexOf('head') * 3;
  let sum = 0, n = 0, recTop = -Infinity;
  for (let t = clip.marks.tw; t <= clip.marks.tf; t += 1 / 60) {
    jointsAt(clip, t, a);
    jointsAt(rec, t - recOffset, b);
    sum += Math.hypot(a[hi] - b[hr], a[hi + 1] - b[hr + 1], a[hi + 2] - b[hr + 2]);
    n++;
  }
  for (let i = 0; i < rec.data.n; i++) {
    const J = rec.data.cols.J, o = i * rec.joints.length * 3;
    recTop = Math.max(recTop, J[o + hr + 1] - (J[o + headR + 1] + 0.1));
  }
  const pathLen = (c, name) => {
    const ji = c.joints.indexOf(name) * 3, nj = c.joints.length * 3, J = c.data.cols.J;
    let L = 0;
    for (let i = 1; i < c.data.n; i++) L += Math.hypot(J[i * nj + ji] - J[(i - 1) * nj + ji], J[i * nj + ji + 1] - J[(i - 1) * nj + ji + 1], J[i * nj + ji + 2] - J[(i - 1) * nj + ji + 2]);
    return L;
  };
  const rows = [
    ['기록 칼끝 최고', `${fmt(rec.summary.tipPeak, 1)} m/s`, `이 클립 ${clip.summary.tipPeak} m/s`],
    ['손 위치 차이 평균', `${fmt(sum / n)} m`, '감기 끝~지나가기 끝, 같은 땅 틀'],
    ['손이 움직인 길이 (기록 전체)', `${fmt(pathLen(rec, 'hS'))} m`, `이 클립 ${fmt(pathLen(clip, 'hS'))} m`],
    ['칼끝이 지나간 길이', `${fmt(pathLen(rec, 'tip'))} m`, `이 클립 ${fmt(pathLen(clip, 'tip'))} m`],
    ['손 최고 높이 (머리 꼭대기 위)', `${fmt(recTop)} m`, `이 클립 ${fmt(clip.summary.wind.handAboveHeadTop)} m`],
    ['시간 맞춤', `${fmt(recOffset)} s`, state.recAlign ? '칼끝 최고 시각을 맞춤' : '맞추지 않음'],
  ];
  const esc = (x) => String(x).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
  const c = rec.cond;
  const cond = c
    ? `<p class="note">조건: ${esc(c.code)} · 시드 ${esc(c.seed)} · 물리 ${esc(c.physicsHz)} / 기록 ${esc(c.recordHz)} / 입력 ${esc(c.inputHz)} Hz · ${esc(c.weapon)} · 걸음 ${esc(c.gait)} · skill ${esc(c.skill)} · ${c.gap == null ? '상대 치움' : `거리 ${esc(c.gap)} m`}${c.commit ? ` · 결심 ${esc(c.commit)}` : ''}</p>`
    : '';
  box.innerHTML = rows.map(([l, v, sub]) => `<div class="row"><div class="lbl">${l}<small>${sub}</small></div><div class="v">${v}</div><div></div></div>`).join('') + `<p class="note">${esc(rec.source)}</p>` + cond;
}
function renderLegend() {
  const items = [[`기준 · ${SIZE_KO[state.size]}`, C.ref]];
  if (state.all) items.push(['다른 크기', C.refSoft]);
  if (rec) items.push(['우리 캐릭터 기록', C.game]);
  $('legend').innerHTML = items.map(([t, c]) => `<div><b>${t}</b><span class="sw" style="background:${c}"></span></div>`).join('');
}

// ── 시간 띠 ──
const PHASES = [
  ['t0', 'tw', '감기'],
  ['tw', 'tc', '베기'],
  ['tc', 'tf', '지나가기'],
  ['tf', 'tg', '복귀'],
];
// 흐름 클립(marks1·marks2): 첫 베기 → 이어 감기(서지 않음) → 둘째 베기 → 지나가기 → 복귀
function flowBands() {
  const a = clip.marks1, b = clip.marks2;
  return [
    [a.t0, a.tw, '감기', 0],
    [a.tw, a.tc, '베기', 1],
    [a.tc, b.tw, '이어 감기', 0],
    [b.tw, b.tc, '베기', 1],
    [b.tc, b.tf, '지나가기', 2],
    [b.tf, b.tg, '복귀', 3],
  ];
}
const LUNGE_PHASES = ['준비', '찌르기 · 런지', '낮아짐', '복귀'];
function phaseName(t) {
  if (clip.lunge) {
    const m = clip.marks;
    if (t < m.tw) return '준비';
    if (t < m.tr) return '찌르기 · 손 먼저';
    if (t < m.tc) return '찌르기 · 앞발이 남';
    if (t < m.tf) return '앞발 딛음 · 낮아짐';
    if (t < m.tg) return '복귀';
    return '자세';
  }
  if (clip.marks2) {
    const a = clip.marks1, b = clip.marks2;
    if (t < a.tw) return '감기';
    if (t < a.tc) return t < a.tr ? '베기 · 몸이 먼저' : '베기 · 손목 풀림';
    if (t < b.tw) return '이어 감기 · 칼이 서지 않음';
    if (t < b.tc) return t < b.tr ? '둘째 베기 · 몸이 먼저' : '둘째 베기 · 손목 풀림';
    if (t < b.tf) return '지나가기';
    if (t < b.tg) return '복귀';
    return '자세';
  }
  const m = clip.marks;
  if (t < m.tw) return '감기';
  if (t < m.tr) return '베기 · 몸이 먼저';
  if (t < m.tc) return '베기 · 손목 풀림';
  if (t < m.tf) return '지나가기';
  if (t < m.tg) return '복귀';
  return '자세';
}
function bandColors() {
  return [C.refSoft, C.ref, C.game, C.rule];
}
function renderBands() {
  const T = duration(clip);
  const cols = bandColors();
  const list = clip.marks2 ? flowBands() : PHASES.map(([a, b, name], i) => [clip.marks[a], clip.marks[b], clip.lunge ? LUNGE_PHASES[i] : name, i]);
  $('bands').innerHTML = list.map(([a, b, , ci]) => `<span style="width:${((b - a) / T) * 100}%;background:${cols[ci]}"></span>`).join('');
  $('bandlbl').innerHTML = list.map(([a, b, name]) => `<span style="width:${((b - a) / T) * 100}%">${name}</span>`).join('');
}

// ── 곡선 ──
function setupCanvas(cv) {
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(10, Math.round(r.width)), h = Math.max(10, Math.round(r.height));
  if (cv.width !== w * dpr || cv.height !== h * dpr) {
    cv.width = w * dpr;
    cv.height = h * dpr;
  }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  return { g, w, h };
}
function axes(g, box, xr, yr, { xt, yt, xl, yl, xfmt = (x) => x, yfmt = (y) => y }) {
  const { x0, y0, x1, y1 } = box;
  const X = (x) => x0 + ((x - xr[0]) / (xr[1] - xr[0])) * (x1 - x0);
  const Y = (y) => y1 - ((y - yr[0]) / (yr[1] - yr[0])) * (y1 - y0);
  g.font = '10.5px "IBM Plex Mono", ui-monospace, monospace';
  g.fillStyle = C.muted;
  g.strokeStyle = C.rule;
  g.lineWidth = 1;
  g.textAlign = 'right';
  g.textBaseline = 'middle';
  for (let y = Math.ceil(yr[0] / yt) * yt; y <= yr[1] + 1e-9; y += yt) {
    g.beginPath();
    g.moveTo(x0, Y(y) + 0.5);
    g.lineTo(x1, Y(y) + 0.5);
    g.stroke();
    g.fillText(yfmt(y), x0 - 4, Y(y));
  }
  g.textAlign = 'center';
  g.textBaseline = 'top';
  for (let x = Math.ceil(xr[0] / xt - 1e-9) * xt; x <= xr[1] + 1e-9; x += xt) g.fillText(xfmt(+x.toFixed(3)), X(x), y1 + 4);
  if (yl) {
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText(yl, x0 + 2, y0 - 12);
  }
  return { X, Y };
}
function series(g, X, Y, xs, ys, color, width = 1.6, alpha = 1, dash = null) {
  g.save();
  g.strokeStyle = color;
  g.globalAlpha = alpha;
  g.lineWidth = width;
  if (dash) g.setLineDash(dash);
  g.beginPath();
  let started = false;
  for (let i = 0; i < xs.length; i++) {
    if (ys[i] == null || Number.isNaN(ys[i])) continue;
    const px = X(xs[i]), py = Y(ys[i]);
    if (!started) g.moveTo(px, py);
    else g.lineTo(px, py);
    started = true;
  }
  g.stroke();
  g.restore();
}
function phaseBg(g, X, box, marks) {
  const cols = bandColors();
  PHASES.forEach(([a, b], i) => {
    g.save();
    g.globalAlpha = 0.08;
    g.fillStyle = cols[i];
    g.fillRect(X(marks[a]), box.y0, X(marks[b]) - X(marks[a]), box.y1 - box.y0);
    g.restore();
  });
  g.save();
  g.strokeStyle = C.ink;
  g.globalAlpha = 0.35;
  g.setLineDash([3, 3]);
  g.beginPath();
  g.moveTo(X(marks.tc) + 0.5, box.y0);
  g.lineTo(X(marks.tc) + 0.5, box.y1);
  g.stroke();
  g.restore();
}
function playhead(g, X, box, t) {
  g.save();
  g.strokeStyle = C.ink;
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(X(t) + 0.5, box.y0);
  g.lineTo(X(t) + 0.5, box.y1);
  g.stroke();
  g.restore();
}

function drawSpeed() {
  if (!clip) return;
  const { g, w, h } = setupCanvas($('chSpeed'));
  const box = { x0: 34, y0: 16, x1: w - 8, y1: h - 20 };
  const T = duration(clip);
  const cols = clip.data.cols;
  let top = Math.max(...cols['speed.tip']);
  if (state.all) for (const s of SIZES) top = Math.max(top, ...sizeClips[s].data.cols['speed.tip']);
  if (rec) top = Math.max(top, ...rec.data.cols['speed.tip']);
  const yMax = Math.max(20, Math.ceil(top / 10) * 10);
  const { X, Y } = axes(g, box, [0, T], [0, yMax], { xt: 0.2, yt: 10, xfmt: (x) => x.toFixed(1) });
  phaseBg(g, X, box, clip.marks);
  if (state.all) for (const s of SIZES) if (s !== state.size) series(g, X, Y, sizeClips[s].data.cols.t, sizeClips[s].data.cols['speed.tip'], C.refSoft, 1.2, 0.9);
  if (rec) series(g, X, Y, rec.data.cols.t.map((t) => t + recOffset), rec.data.cols['speed.tip'], C.game, 1.8);
  series(g, X, Y, cols.t, cols['speed.hand'], C.ref, 1.2, 0.8, [4, 3]);
  series(g, X, Y, cols.t, cols['speed.tip'], C.ref, 2);
  playhead(g, X, box, state.t);
  g.font = '11px "IBM Plex Sans KR", system-ui, sans-serif';
  g.textAlign = 'right';
  g.textBaseline = 'top';
  g.fillStyle = C.ref;
  g.fillText('칼끝 ─  손 ┄', box.x1, box.y0);
  if (rec) {
    g.fillStyle = C.game;
    g.fillText('게임 기록 칼끝', box.x1, box.y0 + 14);
  }
}
function drawSeq() {
  if (!clip) return;
  const { g, w, h } = setupCanvas($('chSeq'));
  const box = { x0: 34, y0: 16, x1: w - 8, y1: h - 20 };
  const tc = clip.marks.tc;
  const xr = [-300, 150];
  const { X, Y } = axes(g, box, xr, [0, 1.1], { xt: 50, yt: 0.25, xfmt: (x) => (x % 100 === 0 ? `${x}` : ''), yfmt: (y) => (y === 1 ? '최고' : y === 0 ? '0' : '') });
  const cols = clip.data.cols;
  const idx = [];
  for (let i = 0; i < clip.data.n; i++) {
    const ms = (cols.t[i] - tc) * 1000;
    if (ms >= xr[0] && ms <= xr[1]) idx.push(i);
  }
  const xs = idx.map((i) => (cols.t[i] - tc) * 1000);
  const S = [
    ['골반', cols['w.pelvis'], C.s1, true],
    ['가슴', cols['w.chest'], C.s2, true],
    ['손', cols['speed.hand'], C.s3, false],
    ['칼끝', cols['speed.tip'], C.ref, false],
  ];
  // 베기 방향 부호: 겨눈 선에서 가슴이 도는 쪽
  const iC = Math.round((tc - cols.t[0]) * clip.hz);
  const sgn = Math.sign(cols['w.chest'][iC]) || -1;
  g.save();
  g.strokeStyle = C.ink;
  g.globalAlpha = 0.35;
  g.setLineDash([3, 3]);
  g.beginPath();
  g.moveTo(X(0) + 0.5, box.y0);
  g.lineTo(X(0) + 0.5, box.y1);
  g.stroke();
  g.restore();
  const peaks = [];
  for (const [name, arr, color, signed] of S) {
    const ys = idx.map((i) => Math.max(0, signed ? sgn * arr[i] : arr[i]));
    const top = Math.max(...ys) || 1;
    const yn = ys.map((y) => y / top);
    series(g, X, Y, xs, yn, color, 2);
    const q = clip.summary.sequence.find((p) => p.part === name);
    if (q) peaks.push([name, q.t, color]);
  }
  // 최고 점과 이름표 (이름표는 왼쪽 위에 한 줄씩: 이름 · 겨눈 선 기준 ms)
  g.font = '11px "IBM Plex Sans KR", system-ui, sans-serif';
  g.textBaseline = 'top';
  g.textAlign = 'left';
  peaks.forEach(([name, t, color], k) => {
    g.fillStyle = color;
    g.beginPath();
    g.arc(X(t), Y(1), 3.5, 0, Math.PI * 2);
    g.fill();
    g.fillText(`${name} ${t > 0 ? '+' : ''}${t} ms`, box.x0 + 6, box.y0 + 2 + k * 14);
  });
  const now = (state.t - tc) * 1000;
  if (now >= xr[0] && now <= xr[1]) playhead(g, X, box, now);
}
const ANGLES = [
  ['chestYaw', '가슴 돌림 (°)', null],
  ['pelvisYaw', '골반 돌림 (°)', null],
  ['xFactor', '척추 비틀림 X-factor (°)', [45, '사람 약 45°']],
  ['lean', '몸 숙임 (°)', null],
  ['shoulderElevS', '칼 팔 어깨 들림 (°)', [180, '최대 180°']],
  ['elbowS', '칼 팔 팔꿈치 굽힘 (°)', [150, '최대 150°']],
  ['elbowO', '빈팔 팔꿈치 굽힘 (°)', [150, '최대 150°']],
  ['wrist', '칼과 아래팔 사이 각 (°)', null],
  ['kneeL', '왼 무릎 굽힘 (°)', null],
  ['kneeR', '오른 무릎 굽힘 (°)', null],
];
function drawAng() {
  if (!clip) return;
  const sel = $('angSel').value || 'chestYaw';
  const def = ANGLES.find((a) => a[0] === sel);
  const { g, w, h } = setupCanvas($('chAng'));
  const box = { x0: 38, y0: 16, x1: w - 8, y1: h - 20 };
  const T = duration(clip);
  const list = state.all ? SIZES.map((s) => sizeClips[s]) : [clip];
  let lo = Infinity, hi = -Infinity;
  for (const c of list) for (const v of c.data.cols[`ang.${sel}`]) (lo = Math.min(lo, v)), (hi = Math.max(hi, v));
  if (def?.[2]) (lo = Math.min(lo, def[2][0])), (hi = Math.max(hi, def[2][0]));
  const span = Math.max(20, hi - lo);
  const step = span > 150 ? 45 : span > 60 ? 30 : 10;
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const { X, Y } = axes(g, box, [0, T], [lo, hi], { xt: 0.2, yt: step, xfmt: (x) => x.toFixed(1) });
  phaseBg(g, X, box, clip.marks);
  if (def?.[2]) {
    g.save();
    g.strokeStyle = C.bad;
    g.globalAlpha = 0.6;
    g.setLineDash([5, 4]);
    g.beginPath();
    g.moveTo(box.x0, Y(def[2][0]));
    g.lineTo(box.x1, Y(def[2][0]));
    g.stroke();
    g.fillStyle = C.bad;
    g.font = '10.5px "IBM Plex Sans KR", system-ui, sans-serif';
    g.textAlign = 'right';
    g.textBaseline = 'bottom';
    g.fillText(def[2][1], box.x1, Y(def[2][0]) - 2);
    g.restore();
  }
  for (const c of list) if (c !== clip) series(g, X, Y, c.data.cols.t, c.data.cols[`ang.${sel}`], C.refSoft, 1.2);
  series(g, X, Y, clip.data.cols.t, clip.data.cols[`ang.${sel}`], C.ref, 2);
  playhead(g, X, box, state.t);
}
function drawCharts() {
  drawSpeed();
  drawSeq();
  drawAng();
}

// ── 조작 ──
function pressed(groupId, v) {
  for (const b of $(groupId).querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === String(v)));
}
function bindSeg(groupId, key, after) {
  $(groupId).addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    state[key] = key === 'speed' ? +b.dataset.v : b.dataset.v;
    pressed(groupId, state[key]);
    remember();
    after?.();
  });
  pressed(groupId, state[key]);
}
function renderCuts() {
  const seen = new Map();
  for (const c of index.clips) if (!seen.has(c.cut)) seen.set(c.cut, c);
  $('cuts').innerHTML = [...seen.values()]
    .map((c) => `<button type="button" class="cut" data-cut="${c.cut}" aria-pressed="${c.cut === state.cut}"><span class="ko">${c.nameKo}</span><span class="de">${c.nameDe}</span><span class="fam">${c.weaponKo ? `${c.weaponKo} · ` : ''}${c.family ?? ''}</span></button>`)
    .join('');
  $('cuts').addEventListener('click', (e) => {
    const b = e.target.closest('button.cut');
    if (!b) return;
    state.cut = b.dataset.cut;
    for (const x of $('cuts').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x.dataset.cut === state.cut));
    if (state.recAuto !== false) state.rec = recFor(state.cut) ?? state.rec;
    $('rec').value = state.rec;
    remember();
    loadCurrent().catch(showError);
  });
}
function renderRecSelect() {
  const opts = [['', '겹치지 않음']];
  const KIND = { 'game-arm': '지금 게임 · 팔 베기', 'wbs-arm': '시험판(wbs) · 팔 베기', 'wbs-commit': '시험판(wbs) · 결심(온몸) 베기' };
  for (const r of recIndex?.records ?? []) opts.push([r.id, `${KIND[r.kind] ?? r.kind ?? '기록'} · ${r.cut}`]);
  if (fileRecord) opts.push(['__file', `파일: ${fileRecord.id ?? '기록'}`]);
  $('rec').innerHTML = opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
  $('rec').value = state.rec;
}
let fileRecord = null;

function wire() {
  bindSeg('speed', 'speed');
  bindSeg('side', 'side', () => loadCurrent().catch(showError));
  bindSeg('size', 'size', () => {
    clip = sizeClips[state.size];
    buildFigures();
    alignRecord();
    renderSheet();
    renderBands();
    refreshTrails();
    drawCharts();
  });
  bindSeg('cam', 'cam', () => setCam(state.cam));
  $('play').addEventListener('click', () => {
    state.playing = !state.playing;
    $('play').textContent = state.playing ? '멈춤' : '재생';
  });
  $('scrub').addEventListener('input', (e) => {
    state.playing = false;
    $('play').textContent = '재생';
    state.t = (+e.target.value / 1000) * duration(clip);
  });
  for (const [id, key] of [['allSizes', 'all'], ['trail', 'trail'], ['ghosts', 'ghosts'], ['foe', 'foe']]) {
    $(id).checked = state[key];
    $(id).addEventListener('change', (e) => {
      state[key] = e.target.checked;
      remember();
      syncVisibility();
      renderLegend();
      drawCharts();
    });
  }
  $('rec').addEventListener('change', (e) => {
    state.rec = e.target.value;
    state.recAuto = false;
    loadRecord().then(() => {
      refreshTrails();
      renderRecRows();
      renderLegend();
      drawCharts();
    });
  });
  $('recAlign').addEventListener('change', (e) => {
    state.recAlign = e.target.checked;
    alignRecord();
    renderRecRows();
    drawCharts();
  });
  $('recFile').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const j = JSON.parse(await file.text());
      if (!j.data?.cols?.J || !j.joints) throw new Error('J·joints 칸이 없다 (record_game.mjs 형식이 아님)');
      j.bones ??= index.clips.length ? (await getJSON(`clips/${index.clips[0].file}`)).bones : [];
      j.hz ??= 120;
      j.summary ??= { tipPeak: Math.max(...(j.data.cols['speed.tip'] ?? [0])) };
      j.source ??= file.name;
      fileRecord = j;
      state.rec = '__file';
      renderRecSelect();
      await loadRecord();
      refreshTrails();
      renderRecRows();
      renderLegend();
      drawCharts();
    } catch (err) {
      showError(err);
    }
  });
  const sel = $('angSel');
  sel.innerHTML = ANGLES.map(([k, l]) => `<option value="${k}">${l}</option>`).join('');
  sel.addEventListener('change', drawAng);
  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      $('play').click();
    }
  });
}

// ── 돌리기 ──
let last = performance.now();
let lastChart = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (clip) {
    const T = duration(clip);
    if (state.playing) {
      state.t += dt * state.speed;
      if (state.t > T + 0.35) state.t = 0;
    }
    const t = Math.min(state.t, T);
    main.set(jointsAt(clip, t, main.buf));
    if (state.all) for (const s of SIZES) if (s !== state.size && others[s]) others[s].set(jointsAt(sizeClips[s], Math.min(t, duration(sizeClips[s])), others[s].buf));
    if (rec && recFig) recFig.set(jointsAt(rec, t - recOffset, recFig.buf));
    $('scrub').value = String(Math.round((t / T) * 1000));
    $('hudPhase').textContent = phaseName(t);
    $('hudT').textContent = `${t.toFixed(2)} s · φ ${fmt(colAt(clip, 'phi', t))}`;
    $('hudV').textContent = `칼끝 ${fmt(colAt(clip, 'speed.tip', t), 1)} m/s · 손 ${fmt(colAt(clip, 'speed.hand', t), 1)} m/s`;
    if (now - lastChart > 50) {
      drawCharts();
      lastChart = now;
    }
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

async function boot() {
  wire();
  setCam(state.cam);
  applyTheme();
  try {
    index = await getJSON('clips/index.json');
  } catch (e) {
    showError(e);
    return;
  }
  // 다른 무기 클립 (있으면): 같은 베기라도 '<무기>:<베기>' 로 따로 단추를 만든다
  for (const w of Object.keys(WEAPON_KO)) {
    try {
      const wi = await getJSON(`clips/${w}/index.json`);
      index = { ...index, clips: [...index.clips, ...wi.clips.map((c) => ({ ...c, cut: `${w}:${c.cut}`, dir: `${w}/`, weaponKo: WEAPON_KO[w] }))] };
    } catch {}
  }
  try {
    recIndex = await getJSON('records/index.json');
  } catch {
    recIndex = { records: [] };
  }
  if (!index.clips.some((c) => c.cut === state.cut)) state.cut = index.clips[0].cut;
  state.rec = recFor(state.cut) && recIndex.records.some((r) => r.id === recFor(state.cut)) ? recFor(state.cut) : '';
  renderCuts();
  renderRecSelect();
  $('play').textContent = state.playing ? '멈춤' : '재생';
  await loadCurrent().catch(showError);
  resize();
  requestAnimationFrame(frame);
}
boot();

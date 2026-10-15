// ─────────────────────────────────────────────────────────────
//  live_diag.mjs — R2 실전 진단 브라우저 하니스 (하니스 a). 폰 같은 프레임 빠르기로 실제 게임 길을 결정적으로 돌려 잰다
//   출처: hs-diag(가지 wbs-diag 08b864a) tools/browser/live_diag.mjs 를 본판에 이식(R2′ W1a). 바뀐 것: M·C1·C2·C3 칸(src/strike 가 있는 가지의
//   온몸·손짓·드라이브 칸) 제거 → 칸은 k<검술 보정> 하나 (옛 이름 C0-k<s> 도 받는다). R2′ 탐색판은 --url 에 그 빌드(public/r2p/?chain=legs 같은 주소 인자)를 준다.
//   터치·프레임·표본·sha 정의는 그대로 (tools/sim/live_twin.mjs 와 같은 칸 이름·파일 꼴).
//   · 결정적 브라우저 (det.mjs 방식을 옮김): 페이지 난수 씨앗 고정 · 소리 끔 · performance.now·rAF 를 손으로 넘김 · 캔버스 읽기
//   · 프레임 간격 = live_common PACINGS (씨앗 고정). 프레임마다: 그 프레임 끝 시각까지의 터치 표본을 CDP Input.dispatchTouchEvent 로
//     진짜 캔버스에 보낸 뒤 (timestamp = (timeOrigin + 페이지 ms)/1000 → e.timeStamp 가 가짜 시계와 같다) 한 프레임을 넘긴다
//     칼 손가락 id 1 + 왼손 조이스틱 id 2 (두 손가락; 하나만 떼기 = touchEnd 에 그 점만). 손가락 하나일 때 한 프레임 몫은 잇달아 보내고 모두 기다린다 (--serial: 늘 하나씩)
//     결정성: CDP 시각 변환·시각 거칠게 하기가 e.timeStamp 를 ±0.1 ms 흔든다 → 모든 터치를 정수 ms 에 보내고 페이지에서 반올림해 되찾는다.
//     크롬 예측 이벤트 (getPredictedEvents) 는 실제 시계로 내다봐 실행마다 달라서 뺀다 (iOS Safari · 쌍둥이 inputPump 처럼 예측 없음)
//   · 물리 스텝마다 표본: game.combat.afterStep 을 페이지에서 감싼다 (world.step 바로 뒤 · 상처 훅 뒤 — 쌍둥이 G.step 뒤와 같은 자리).
//     판이 새로 서면 (newRound: combat·player 가 바뀜) 다시 감싼다. src 는 건드리지 않는다
//   · 표본기·축약기 = live_common sampleFighter (toString 으로 페이지에) · summarise. 칸(CELLS)·블록(PASSIVE/FIGHT)·빠르기(PACINGS)
//   · 칸 요청과 켜진 상태(설정·CONFIG·ges·drive·skill·guardWeight)가 다르면 잰 값 없이 오류 파일
//   · 가장 나쁜 순간 3 (관절 범위 밖 + 자기 몸 뚫림 + 몸통 건너뛰기 + 두 발 뜸 + 사람 최고 각속도 넘음) 을 그 자리에서 그려 읽는다
//     (그리기 거른 프레임이면 게임의 renderer·scene (game.reviveFx) 로 그 프레임 끝 자세를 한 번 더 그려 읽는다 —
//      그리기는 표본 흐름을 바꾸지 않는다: --render-skip 켬·끔 sha 같음 확인)
//   · 게임 캔버스는 CSS 로 투명하게 둔다 (--disable-gpu-compositing 과 함께: 소프트웨어 합성이 WebGL 을 읽어 오지 않게 → 터치·프레임이 빠르다).
//     누르기 판정·그리기·읽기는 그대로 (opacity 는 hit-test 를 바꾸지 않는다)
//  실행 (vite 를 띄운 뒤):
//   node tools/browser/live_diag.mjs --url=http://127.0.0.1:5210 --cells=k1 --pacings=60,30J [--blocks=passive,fight]
//        [--rounds=2] [--seed=7] [--out=폴더] [--render-skip] [--png] [--quick] [--full] [--max-s=60] [--tree=이름] [--serial] [--pad0-ms=0]
//   node tools/browser/live_diag.mjs --table --out=폴더     (폴더의 <칸>__<빠르기>.json → table.md)
//  칸: k<0|0.4|0.7|1> (본판 그대로, 검술 보정 세기만; --url 이 그 트리·그 주소 인자) · all = k0,k0.4,k1
//  playwright 는 /home/user/halfsword/package.json 기준으로 찾는다 (det.mjs 와 같이). 크롬 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
// ─────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as L from '../sim/live_common.mjs';

const require = createRequire('/home/user/halfsword/package.json');
const SELF = fileURLToPath(import.meta.url);
const COMMON = path.join(path.dirname(SELF), '../sim/live_common.mjs');
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// ───────── 인자 ─────────
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find((x) => x === `--${k}` || x.startsWith(`--${k}=`)); if (!a) return d; const i = a.indexOf('='); return i < 0 ? true : a.slice(i + 1); };
const OUT = path.resolve(opt('out', path.join(os.tmpdir(), 'live_diag_out'))); // 보통 --out 으로 준다
const URL0 = String(opt('url', 'http://127.0.0.1:5210')).replace(/\/$/, '');
const SEED = +opt('seed', 7);
const QUICK = !!opt('quick', false);
const RSKIP = !!opt('render-skip', false);
const PNGON = !!opt('png', false);
const FULL = !!opt('full', false);
const PIPE = !opt('serial', false); // 기본: 손가락 하나일 때 프레임 몫 터치를 잇달아 보냄 (빠름, 하나씩 기다린 것과 sha 같음). --serial 이면 늘 하나씩
const ROUNDS = +opt('rounds', QUICK ? 1 : L.PROGRAMME.fight.rounds);
const MAXS = +opt('max-s', QUICK ? 12 : L.PROGRAMME.fight.maxS);
const PAD0MS = +opt('pad0-ms', 0); // 싸움 시작 뒤 이 ms 에 손 목표를 쟁기에 (PROGRAMME.pad0, 첫 획 전)
const TREE = opt('tree', null);
const BLOCKS = String(opt('blocks', 'passive,fight')).split(',').filter(Boolean);
const PACS = String(opt('pacings', '60')).split(',').filter(Boolean);
const SKILLS = ['0', '0.4', '0.7', '1'];
const CELLS = String(opt('cells', 'k1')).split(',').filter(Boolean).flatMap((c) => (c === 'all' ? ['k0', 'k0.4', 'k1'] : [c]));
const CHROME = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium';
const CHROME_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--disable-gpu-compositing'];
const VIEW = { width: L.MAP_PHONE.innerWidth, height: L.MAP_PHONE.innerHeight };
const MENU_FRAMES = 10; // 싸움 전 메뉴 프레임 (16 ms, 늘 같은 수)
const DECIM = 4; // 저장 표본 솎기 (120 Hz → 30 Hz). 요약은 모든 스텝으로
const WIN_STEPS = 60; // 나쁜 순간 앞뒤 전체 해상도 창 (±0.5 s)
const SWORD = 1, STICK = 2; // CDP 손가락 id

/** 칸 이름 → 요청 */
function parseCell(name) {
  let m;
  const k = (s) => { if (!SKILLS.includes(s)) throw new Error(`칸 ${name}: 검술 보정 값 ${s} (메뉴 값 ${SKILLS.join('/')})`); return s; };
  if ((m = /^(?:C0-)?k([\d.]+)$/.exec(name))) return { name, kind: 'main', input: null, hand: null, skill: k(m[1]), whole: null, gesture: null, drive: null };
  throw new Error(`모르는 칸 ${name} (k<0|0.4|0.7|1>)`);
}

// ───────── 차림표 ─────────
/** 블록의 차림표: 보통 = live_common buildProgramme, --quick = 두 변형 (감기 크게 빠르게 · 긋기 보통 느리게) × clean·cont 4 획 */
function programme(loops) {
  if (!QUICK) return L.buildProgramme({ loops });
  const rand = L.rng(L.PROGRAMME.seed);
  const pick = ['wind-large-fast', 'straight-mid-slow'];
  const vs = L.variants().filter((v) => pick.includes(v.id));
  const t0 = L.PROGRAMME.startHoldMs + L.PROGRAMME.idleMs;
  let t = t0;
  const strokes = [];
  for (let l = 0; l < loops; l++)
    for (const v of vs)
      for (const touch of L.PROGRAMME.touches) {
        const s = L.buildStroke(v, touch, t, rand);
        s.loop = l;
        s.idx = strokes.length;
        strokes.push(s);
        t = s.tEnd;
      }
  return { strokes, t0, tEnd: t, map: L.MAP_PHONE, originPx: L.PROGRAMME.originPx, standWinMs: L.PROGRAMME.standWinMs, quick: true };
}

// ───────── 페이지에 넣는 공용 조각 (live_common 소스에서 그대로 가져온다 — 정의는 한 곳) ─────────
const COMMON_SRC = fs.readFileSync(COMMON, 'utf8');
/** 모듈 안 (내보내지 않은) 도우미의 소스: const 이름 = … ; 또는 function 이름(…) {…} */
function extract(name) {
  let i = COMMON_SRC.search(new RegExp(`^const ${name} = `, 'm'));
  let fn = false;
  if (i < 0) { i = COMMON_SRC.search(new RegExp(`^function ${name}\\(`, 'm')); fn = true; }
  if (i < 0) throw new Error(`live_common 에 ${name} 없음`);
  let d = 0;
  for (let j = i; j < COMMON_SRC.length; j++) {
    const c = COMMON_SRC[j];
    if (c === '{' || c === '(' || c === '[') d++;
    else if (c === '}' || c === ')' || c === ']') { d--; if (fn && d === 0 && c === '}') return COMMON_SRC.slice(i, j + 1); }
    else if (!fn && c === ';' && d === 0) return COMMON_SRC.slice(i, j + 1);
  }
  throw new Error(`${name} 끝 못 찾음`);
}
/** 스텝 하나의 나쁨 (나쁜 순간 고르기): 범위 밖 관절 수 + 뚫린 쌍 수 (빈팔·자루 빼고) + 몸통 건너뛰기 + 두 발 뜸 + 사람 최고 넘은 관절 수. 서 있는 스텝만 */
function severity(s, prev) {
  if (s.st !== 0 || (s.fightT != null && s.fightT < DECL.settleS)) return null;
  const F = rangeFlags(s);
  const joints = Object.keys(F).filter((k) => F[k]);
  const pen = [];
  if (s.pen) for (let j = 0; j < s.pen.length; j++) {
    const pn = PEN_PARTS[Math.floor(j / PEN_VOLS.length)];
    if (pn !== 'farmO' && pn !== 'hilt' && s.pen[j] > DECL.penTolM) pen.push(`${pn}>${PEN_VOLS[j % PEN_VOLS.length]}:${s.pen[j]}`);
  }
  const tele = [];
  for (const [key, rr] of [['hC', DECL.limbR.hand], ['eC', DECL.limbR.elbow]]) {
    const b = s[key];
    if (!b) continue;
    for (let k = 1; k <= DECL.teleportK && k <= prev.length; k++) {
      const a = prev[prev.length - k][key];
      if (!a || inBox(a, DECL.trunkPrism, rr) || inBox(b, DECL.trunkPrism, rr)) continue;
      if (segHitsBox(a, b, DECL.trunkPrism)) { tele.push(key); break; }
    }
  }
  const feet = s.cF === 0 && s.cB === 0;
  const over = Object.keys(PEAKS.joints).filter((k) => s['w_' + k] != null && s['w_' + k] > PEAKS.joints[k].w);
  return { score: joints.length + pen.length + tele.length + (feet ? 1 : 0) + over.length, joints, pen, tele, feet, over };
}
const HELPER_SRC = `(() => {
  const RANGES = ${JSON.stringify(L.RANGES)};
  const DECL = ${JSON.stringify(L.DECL)};
  const PEAKS = ${JSON.stringify(L.PEAKS)};
  const PEN_PARTS = ${JSON.stringify(L.PEN_PARTS)}, PEN_VOLS = ${JSON.stringify(L.PEN_VOLS)};
  const PROGRAMME = { fight: ${JSON.stringify(L.PROGRAMME.fight)} };
  ${extract('lerpTab')}
  ${extract('outR')}
  ${extract('inBox')}
  ${extract('segHitsBox')}
  const rangeFlags = ${L.rangeFlags.toString()};
  const stickCommand = ${L.stickCommand.toString()};
  const severity = ${severity.toString()};
  return { rangeFlags, stickCommand, severity };
})()`;
const LHN = new Function(`return ${HELPER_SRC}`)(); // Node 쪽 같은 조각 (자체 대조용)

// ───────── 결정적 페이지 (det.mjs 방식) ─────────
const INIT = (seed, settings) => `(() => {
  window.AudioContext = undefined; window.webkitAudioContext = undefined; // 소리 끔: 소리 생성이 난수를 실시간으로 먹지 않게
  let s = ${seed} >>> 0;
  window.__rc = 0; Math.random = () => { window.__rc++; s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let now = 0;
  performance.now = () => now;
  const q = [];
  window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
  window.cancelAnimationFrame = () => {};
  window.__frame = (dt) => { now += dt; const cbs = q.splice(0); for (const cb of cbs) cb(now); return now; };
  window.__now = () => now;
  // 터치 시각: CDP timestamp (epoch s) → 페이지 시계 변환과 시각 거칠게 하기 (100 µs, 문서마다 무작위 문턱) 가 ±0.1 ms 를 흔든다 →
  //  하니스는 모든 칼 손가락 표본을 정수 ms 에 보내고 여기서 반올림해 되찾는다 (포인터·터치 이벤트만)
  const tsGet = Object.getOwnPropertyDescriptor(Event.prototype, 'timeStamp').get;
  Object.defineProperty(Event.prototype, 'timeStamp', { configurable: true, enumerable: true, get() { const t = tsGet.call(this); if (!/^(pointer|touch)/.test(this.type)) return t; const r = Math.round(t), d = t - r; const T = window.__tsDev; T.n++; if (Math.abs(d) > T.max) T.max = Math.abs(d); T.sum += d; return r; } });
  window.__tsDev = { n: 0, max: 0, sum: 0 }; // 반올림 전 어긋남 (ms): 0.5 에 가까우면 시계가 샌다
  // 브라우저 예측 이벤트는 뺀다: 크롬 예측기는 흔들린 실제 시각으로 자리를 내다봐 실행마다 달라진다 (0.001 px). 예측 없는 브라우저 (iOS Safari) · 쌍둥이 inputPump 와 같다
  const predOrig = window.PointerEvent && PointerEvent.prototype.getPredictedEvents;
  if (predOrig) PointerEvent.prototype.getPredictedEvents = function () { return []; };
  // 받은 포인터 이벤트 (대상별 수): 보낸 터치와 대조. pred = 크롬이 냈던 (버린) 예측 수
  const pe = (window.__pe = { down: {}, move: {}, up: {}, cancel: {}, pred: 0, coal: 0, coalT: {} });
  for (const k of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) window.addEventListener(k, (e) => {
    const t = (e.target && e.target.id) || (e.target && e.target.tagName) || '?';
    const b = pe[k.slice(7)]; b[t] = (b[t] || 0) + 1;
    if (k === 'pointermove') { if (predOrig) pe.pred += predOrig.call(e).length; const c = e.getCoalescedEvents ? e.getCoalescedEvents().length : 1; pe.coal += c; pe.coalT[t] = (pe.coalT[t] || 0) + c; }
  }, true);
  try { localStorage.setItem('gladiator-settings', ${JSON.stringify(JSON.stringify(settings))}); } catch (e) {}
  // 게임 캔버스는 보이지 않게 (합성만 뺀다: 그리기·누르기 판정·읽기는 그대로)
  document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.id = '__liveDiagCss'; st.textContent = '#game { opacity: 0 !important; }'; document.head.appendChild(st); });
})();`;

// ───────── 페이지 안 하니스 (자기 완결: window 이름만 쓴다) ─────────
function pageHarness(o) {
  const g = window.game;
  const LH = window.__LH;
  const sample = window.__sampleFighter;
  const H = (window.__H = { o, rec: false, rd: -1, S: [], E: [], st: {}, meta: true, ownMeta: null, recent: [], top: [], caps: {}, capWait: [], forceNext: false, directRenders: 0, nId: 0, combat: null, player: null, prevState: null, prevCuts: null, frameNow: 0, synth: [], synthTw: false, steps: 0, frames: 0, paints: 0, forced: 0, capErr: null });
  const ts = () => g.config.PHYSICS.timestep;
  H.ev = (e) => {
    if (!H.rec) return;
    const f = g.player;
    e.tw = f.stepT ?? H.frameNow;
    e.t = f.fightT ?? null;
    e.rd = H.rd;
    H.E.push(e);
  };
  H.install = () => {
    const c = g.combat, p = g.player;
    if (c && c !== H.combat) {
      H.combat = c;
      const orig = c.afterStep.bind(c);
      c.afterStep = (w, q) => { const r = orig(w, q); H.onStep(); return r; };
      const hk = c.hooks;
      const ow = hk.onWound, oc = hk.onClash;
      hk.onWound = (att, vic, r, point, pr) => { H.ev({ type: 'wound', att: att === g.player ? 'player' : 'enemy', vic: vic === g.player ? 'player' : 'enemy', zone: r.zone, kind: r.type, energy: r.energy, severity: r.severity, pass: !!r.pass }); return ow ? ow(att, vic, r, point, pr) : undefined; };
      hk.onClash = (point, speed, info) => { H.ev({ type: 'clash', speed, fresh: !!(info && info.fresh) }); return oc ? oc(point, speed, info) : undefined; };
    }
    if (p && p !== H.player) {
      H.player = p;
      H.st = {};
      H.meta = true;
      H.recent = [];
      H.prevState = p.state;
      H.prevCuts = null;
      const oc = p.onCommit;
      p.onCommit = function (stage, S, fam) { H.ev({ type: 'commit', stage, S: +S, fam }); return oc ? oc.call(this, stage, S, fam) : undefined; };
    }
  };
  H.onStep = () => {
    if (!H.rec) return;
    const f = g.player;
    const s = sample({ f, world: g.world, t: f.fightT, tw: f.stepT ?? null, dt: ts(), st: H.st, meta: H.meta });
    if (H.meta) { H.ownMeta = s.meta || null; delete s.meta; H.meta = false; }
    if (s.tw == null) H.synth.push(H.S.length); // main: 스텝 벽시계 없음 → 프레임 끝에 채운다
    if (f.state !== H.prevState) {
      H.ev({ type: 'pstate', from: H.prevState, to: f.state });
      if (H.prevState === 'stand' && (f.state === 'down' || f.state === 'getup')) H.ev({ type: 'fall', to: f.state });
      H.prevState = f.state;
    }
    if (s.gCuts != null) {
      if (H.prevCuts != null && s.gCuts > H.prevCuts) H.ev({ type: 'cut', mode: ['none', 'wind', 'stroke'][s.gMode] ?? null, fam: s.gFam, S: s.gS });
      H.prevCuts = s.gCuts;
    }
    s.rd = H.rd;
    H.S.push(s);
    H.steps++;
    const sv = LH.severity(s, H.recent);
    H.recent.push(s);
    if (H.recent.length > 3) H.recent.shift();
    if (sv && sv.score > 0) H.consider(s, sv);
  };
  // 나쁜 순간 3 (0.25 s 안의 이웃은 하나로: 더 나쁜 쪽)
  H.consider = (s, sv) => {
    const near = H.top.find((m) => m.rd === H.rd && Math.abs(m.t - s.fightT) < 0.25);
    const ent = { id: ++H.nId, rd: H.rd, t: s.fightT, tw: s.tw, score: sv.score, sv, capNow: null };
    if (near) {
      if (sv.score <= near.score) return;
      H.top[H.top.indexOf(near)] = ent;
    } else if (H.top.length < 3) H.top.push(ent);
    else {
      let lo = 0;
      for (let i = 1; i < H.top.length; i++) if (H.top[i].score < H.top[lo].score) lo = i;
      if (sv.score <= H.top[lo].score) return;
      H.top[lo] = ent;
    }
    if (H.o.png) H.capWait.push(ent);
  };
  // 그 프레임 끝 자세를 읽는다: 그린 프레임이면 그 버퍼, 아니면 게임의 renderer·scene (game.reviveFx 가 들고 있다) 로 지금 자세를 한 번 그려서.
  //  (그리기는 표본 흐름을 바꾸지 않는다 — --render-skip A/B). 둘 다 없으면 다음 프레임을 그리게 한다
  H.capture = (painted) => {
    try {
      if (!painted) {
        const X = g.reviveFx;
        if (!(X && X.renderer && X.scene && g.camera)) return false;
        X.renderer.render(X.scene, g.camera);
        H.directRenders++;
      }
      const c = document.getElementById('game');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (gl.getParameter(gl.FRAMEBUFFER_BINDING) !== null) throw new Error('기본 프레임버퍼가 아님');
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      const buf = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      const cap = { w, h, b64: btoa(bin), now: window.__now() };
      for (const m of H.capWait) if (H.top.includes(m)) (H.caps[m.id] = cap), (m.capNow = cap.now), (m.capHow = painted ? 'paint' : 'direct');
    } catch (e) { H.capErr = String(e); }
    H.capWait = [];
    for (const id in H.caps) if (!H.top.some((m) => m.id === +id)) delete H.caps[id];
    return true;
  };
  const chestDist = () => { const a = g.player.bodies.chest.translation(), b = g.enemy.bodies.chest.translation(); return Math.hypot(b.x - a.x, b.z - a.z); };
  H.status = () => {
    const p = g.player, e = g.enemy;
    return { now: window.__now(), state: g.state, fightT: p ? p.fightT : null, pAlive: p ? p.alive : null, eAlive: e ? e.alive : null, pState: p ? p.state : null, dist: p && e ? chestDist() : null, rc: window.__rc };
  };
  // 한 판 시작: 기록 켬, 손 목표 쟁기 (pad0), PASSIVE 면 AI 멈춤·죽지 않는 과녁·1.3 m
  H.startRound = (a) => {
    H.install();
    H.rd = a.rd;
    H.rec = true;
    H.padDone = false;
    H.padAt = null;
    H.recent = [];
    const out = {};
    if (a.passive) {
      const E = g.enemy;
      g.ai.update = () => E.move.set(0, 0);
      E.die = () => {};
      const aw = E.applyWound.bind(E);
      E.applyWound = (h) => { if (!(E.decapitated && h.zone === 'neck')) aw(h); };
      const d0 = chestDist();
      const pa = g.player.bodies.chest.translation(), pb = E.bodies.chest.translation();
      const ux = (pa.x - pb.x) / d0, uz = (pa.z - pb.z) / d0, m = d0 - a.gapM;
      const mv = (rb) => { const t = rb.translation(); rb.setTranslation({ x: t.x + ux * m, y: t.y, z: t.z + uz * m }, true); };
      for (const { rb } of E.meshes) mv(rb);
      mv(E.anchor);
      if (E.gait) { E.gait.started = false; E.gait.active = false; }
      out.gap0 = d0;
      out.gap1 = chestDist();
    }
    return out;
  };
  H.setPad = (xy) => {
    const P = g.player, k = P.skill;
    P.handOffset.set(xy[0], xy[1]);
    for (const v of [k.prev, k.aim, k.aimRaw, k.anchor]) if (v && v.set) v.set(xy[0], xy[1]);
    for (const v of [k.aimVel, k.vel, k.follow]) if (v && v.set) v.set(0, 0);
  };
  /** 프레임 여럿: 다음 터치가 그 프레임 안에 들면 (nextT ≤ now + dt) 멈춘다 — Node 가 먼저 보낸다. 조이스틱 바꿀 때·판 끝·조각이 차면 멈춘다 */
  H.run = (a) => {
    H.install();
    if (a.expect != null) {
      const pe = window.__pe;
      const got = (pe.down.game || 0) + (pe.coalT.game || 0) + (pe.up.game || 0) + (pe.cancel.game || 0);
      if (got < a.expect) return JSON.stringify({ n: 0, reason: 'wait', got, S: [], E: [], status: H.status() });
    }
    let n = 0, reason = null;
    for (const dt of a.dts) {
      const now = window.__now();
      if (a.nextT <= now + dt) { reason = 'touch'; break; }
      if (a.pad && H.rec && a.pad.at <= now + dt && !H.padDone) { H.setPad(a.pad.xy); H.padDone = true; H.padAt = now; }
      const forced = H.forceNext;
      let saved;
      if (forced) (saved = g.settings.fpsCap), (g.settings.fpsCap = false), (H.forced++);
      const rf0 = g.renderInfo().frame;
      H.frameNow = now + dt;
      const s0 = H.S.length;
      window.__frame(dt);
      if (forced) (g.settings.fpsCap = saved), (H.forceNext = false);
      if (H.synth.length) {
        const m = H.S.length - s0, T = ts() * 1000;
        for (const i of H.synth) H.S[i].tw = H.frameNow - (s0 + m - 1 - i) * T;
        H.synth = [];
        H.synthTw = true;
      }
      const painted = g.renderInfo().frame !== rf0;
      if (painted) H.paints++;
      if (H.capWait.length && !H.capture(painted)) H.forceNext = true;
      n++;
      H.frames++;
      if (H.rec) {
        const p = g.player, e = g.enemy;
        if (!p.alive || !e.alive) reason = 'roundOver';
        else if (a.maxS && p.fightT >= a.maxS) reason = 'maxS';
        else if (a.endT != null && window.__now() >= a.endT) reason = 'end';
        else if (a.stallT != null && window.__now() >= a.stallT) reason = 'stall';
        if (reason) { H.rec = false; break; }
        if (a.stick && p.alive && LH.stickCommand(chestDist(), a.stickOn).on !== a.stickOn) { reason = 'stick'; break; }
      } else if (a.untilPaused && g.state !== 'fight') { reason = 'paused'; break; }
      if (H.S.length >= 600) { reason = 'chunk'; break; }
    }
    const st = H.status();
    if (a.stick && st.dist != null) st.stickWant = LH.stickCommand(st.dist, a.stickOn).on;
    return JSON.stringify({ n, reason, S: H.S.splice(0), E: H.E.splice(0), status: st });
  };
  return true;
}

// ───────── 칸 설정 ─────────
function cellSettings(c) {
  return { skill: c.skill, fpsCap: true }; // 10/10: 픽셀·소리 설정 줄은 없어졌다(픽셀 = 주소 ?pixel=1, 소리 = 늘 켬 → 아래 blockBody 에서 game.sound.on = false)
}
function cellQuery(c) {
  // openSweep=0: 판 시작을 9/30 꼴(정지 2 s — live_common PROGRAMME.startHoldMs 2000)로. 10/15 무대 훑기는 첫 판 3.3 게임 초 발을 묶어 차림표가 어긋난다 (docs/strike/camera_open_2026-10-15.md)
  const q = new URLSearchParams({ weapon: L.PROGRAMME.fight.weapon, foe: L.PROGRAMME.fight.foe, stage: 'poseidon', openSweep: '0' });
  return q.toString();
}
/** 켜진 상태 ↔ 요청: 어긋나면 오류 목록 */
function checkLive(c, live) {
  const bad = [];
  const eq = (k, got, want) => { if (got !== want) bad.push(`${k}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`); };
  eq('innerHeight', live.inner[1], L.MAP_PHONE.innerHeight);
  eq('innerWidth', live.inner[0], L.MAP_PHONE.innerWidth);
  eq('touchSensitivity', live.touchSensitivity, L.MAP_PHONE.touchSensitivity);
  eq('isTouchDevice', live.isTouch, true);
  eq('settings.skill', live.settings.skill, c.skill);
  eq('skill.level', live.skillLevel, +c.skill);
  eq('guardWeight', live.guardWeight == null ? null : +live.guardWeight.toFixed(9), +Math.min(1, +c.skill * 1.6).toFixed(9));
  eq('weapon', live.weapon, L.PROGRAMME.fight.weapon);
  eq('foeWeapon', live.foeWeapon, L.PROGRAMME.fight.weapon);
  eq('foeName', live.foeName, '하인리히 도른');
  // 본판: 온몸 가지(GESTURE·ges·drive)가 없어야 한다
  eq('GESTURE', live.GESTURE, null);
  eq('player.ges', live.ges, 'absent');
  eq('player.drive', live.drive, 'absent');
  return bad;
}
const readLive = (originPx) => {
  const g = window.game, C = g.config, p = g.player, e = g.enemy;
  const tri = (x) => (x === undefined ? 'absent' : x === null ? 'null' : 'on');
  const r = document.getElementById('moveStick').getBoundingClientRect();
  return {
    state: g.state, inner: [innerWidth, innerHeight], isTouch: g.input ? g.input.isTouchDevice : document.body.classList.contains('touch'), touchSensitivity: C.INPUT.touchSensitivity,
    settings: { ...g.settings }, WHOLE: C.WHOLE ? C.WHOLE.on : null, GESTURE: C.GESTURE ? { on: C.GESTURE.on, input: C.GESTURE.input } : null,
    DRIVE: C.DRIVE ? { on: C.DRIVE.on } : null, chain: C.BODY.chain ?? null, legTorque: C.BODY.legTorque ?? null, assist: C.GAIT ? C.GAIT.assist ?? null : null,
    ges: tri(p.ges), drive: tri(p.drive), skillLevel: p.skill.level, guardWeight: p.guardWeight ? p.guardWeight() : null,
    weightMode: C.BODY.weightMode, timestep: C.PHYSICS.timestep, maxSteps: C.PHYSICS.maxStepsPerFrame, renderFpsCap: C.RENDER ? C.RENDER.fpsCap : null,
    weapon: p.weapon?.id, foeWeapon: e.weapon?.id, foeName: e.name, stage: g.stage?.id, stick: [r.left + r.width / 2, r.top + r.height / 2, r.width], stickShown: document.getElementById('moveStick').classList.contains('show'),
    elAtOrigin: document.elementFromPoint(originPx[0], originPx[1])?.id ?? null,
    feetHeldS: C.ARENA?.startHold ?? null, rc: window.__rc,
  };
};

// ───────── 블록 하나 (새 컨텍스트) ─────────
async function runBlock(browser, cell, pacing, block, log) {
  const c = parseCell(cell);
  const T0 = Date.now();
  const settings = cellSettings(c);
  const ctx = await browser.newContext({ viewport: VIEW, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  await ctx.addInitScript(INIT(SEED, settings));
  try {
    return await blockBody(ctx, c, cell, pacing, block, log, T0);
  } finally {
    await ctx.close().catch(() => {});
  }
}
async function blockBody(ctx, c, cell, pacing, block, log, T0) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
  const url = `${URL0}/?${cellQuery(c)}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000, polling: 50 });
  await page.evaluate(() => (window.game.sound.on = false)); // 진단은 소리 없이 (예전 설정 sound:false 와 같게)
  await page.evaluate((n) => { for (let i = 0; i < n; i++) window.__frame(16); }, MENU_FRAMES);
  // 판을 세우기 전: 그리기 거르기는 RENDER.fpsCap 을 아주 작게 (칸 스위치는 없다 — 설정 칸은 --url 의 빌드·주소 인자 몫)
  const toggles = await page.evaluate(([c, rskip]) => {
    const C = window.game.config;
    if (rskip) (window.game.settings.fpsCap = true), (C.RENDER.fpsCap = 0.001);
    return { chain: C.BODY ? C.BODY.chain ?? null : null, legTorque: C.BODY ? C.BODY.legTorque ?? null : null, assist: C.GAIT ? C.GAIT.assist ?? null : null, renderFpsCap: C.RENDER.fpsCap, settingsFpsCap: window.game.settings.fpsCap };
  }, [c, RSKIP]);
  await page.evaluate(`window.__sampleFighter = (${L.sampleFighter.toString()}); window.__LH = ${HELPER_SRC}; true`);
  await page.evaluate(pageHarness, { png: PNGON });
  const origin = await page.evaluate(() => performance.timeOrigin);
  const cdp = await ctx.newCDPSession(page);
  const sent = { start: 0, move: 0, end: 0, swordDown: 0, swordMove: 0, swordUp: 0, stickDown: 0, stickUp: 0 };
  let swordAt = null, stickAt = null, stickPos = null;
  const pts = () => [...(stickAt ? [{ x: stickAt[0], y: stickAt[1], id: STICK }] : []), ...(swordAt ? [{ x: swordAt[0], y: swordAt[1], id: SWORD }] : [])];
  const timing = { nEval: 0, evalMs: 0, nTouch: 0, touchMs: 0, waits: 0 };
  let lateOk = false; // 보낸 터치가 페이지에 다 닿을 때까지 프레임을 넘기지 않는다 (늦게 닿으면 다른 프레임에 들어가 흐름이 바뀐다)
  const touch = async (type, points, tPage) => { sent[type.slice(5).toLowerCase()]++; const a = performance.now(); await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points, timestamp: (origin + tPage) / 1000 }); timing.nTouch++; timing.touchMs += performance.now() - a; };
  const runPage = async (a) => { const t = performance.now(); const r = JSON.parse(await page.evaluate((x) => window.__H.run(x), a)); timing.nEval++; timing.evalMs += performance.now() - t; return r; };
  const swordEv = async (e) => {
    if (e.ph === 0) { swordAt = [e.x, e.y]; sent.swordDown++; await touch('touchStart', pts(), e.t); }
    else if (e.ph === 1) { swordAt = [e.x, e.y]; sent.swordMove++; await touch('touchMove', pts(), e.t); }
    else { sent.swordUp++; swordAt = null; await touch('touchEnd', [{ x: e.x, y: e.y, id: SWORD }], e.t); }
  };
  const stickSet = async (on, tPage) => {
    if (on && !stickAt) { stickAt = [stickPos[0], stickPos[1] - L.PROGRAMME.fight.stickR * L.PROGRAMME.fight.stickDeflect]; sent.stickDown++; await touch('touchStart', pts(), tPage); }
    else if (!on && stickAt) { const a = stickAt; stickAt = null; sent.stickUp++; await touch('touchEnd', [{ x: a[0], y: a[1], id: STICK }], tPage); }
  };
  const allS = [], allE = [], rounds = [], windows = [];
  let setupS = null;
  const hash = crypto.createHash('sha256'), hashE = crypto.createHash('sha256');
  let live = null, frames = 0;
  const nR = block === 'fight' ? ROUNDS : 1;
  for (let rd = 0; rd < nR; rd++) {
    await page.evaluate(() => document.getElementById('btnStart').click());
    await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 60000, polling: 50 });
    if (rd === 0) {
      live = await page.evaluate(readLive, L.PROGRAMME.originPx);
      live.toggles = toggles;
      const bad = checkLive(c, live);
      if (bad.length) { const err = new Error(`칸 ${cell}: 켜진 상태가 요청과 다르다 — ${bad.join('; ')}`); err.live = live; throw err; }
      if (live.elAtOrigin !== 'game') { throw new Error(`칼 손가락 자리 ${L.PROGRAMME.originPx} 의 요소 ${live.elAtOrigin} (캔버스 아님)`); }
      stickPos = live.stick;
      setupS = (Date.now() - T0) / 1000;
    } else {
      // 다음 판도 같은 켜짐인가 (판마다 새 파이터)
      const l2 = await page.evaluate(readLive, L.PROGRAMME.originPx);
      const bad = checkLive(c, l2);
      if (bad.length) { const err = new Error(`칸 ${cell} 판 ${rd}: 켜진 상태가 요청과 다르다 — ${bad.join('; ')}`); err.live = l2; throw err; }
    }
    const now0 = await page.evaluate(() => window.__now());
    const wall0 = Math.ceil(now0); // 프로그램 시계 0 = 싸움이 선 뒤 첫 정수 ms (터치 시각을 정수 ms 로)
    const frames0 = frames;
    const loops = block === 'fight' ? Math.max(1, Math.ceil((MAXS * 1000 * 2.5) / (programme(1).tEnd - programme(1).t0))) : 1;
    const prog = programme(loops);
    const tl = [];
    for (const s of prog.strokes) for (const [t, x, y, ph] of L.strokePx(s, prog.originPx)) tl.push({ t: wall0 + t, x, y, ph });
    const start = await page.evaluate((a) => window.__H.startRound(a), { rd, passive: block === 'passive', gapM: L.PROGRAMME.passive.gapM });
    const pace = L.pacer(pacing, SEED); // 판마다 처음부터 (chain.mjs jitterPump 처럼)
    const dq = [];
    let ti = 0, now = now0, reason = null, stickOn = false, nS = 0, st = null;
    const fill = () => { while (dq.length < 300) dq.push(pace.next()); };
    const endT = block === 'passive' ? wall0 + prog.tEnd + 50 : null; // 마지막 획 창 끝(tEnd)을 스텝 시각이 넘도록 조금 더
    const stallT = wall0 + (block === 'passive' ? prog.tEnd + 20000 : MAXS * 4000 + 20000);
    const rS = [], rE = [];
    for (;;) {
      fill();
      if (PIPE && !stickAt) {
        // 한 프레임 몫의 터치를 기다리지 않고 잇달아 보낸 뒤 모두 기다린다 (순서는 CDP 가 지킨다. 렌더러가 묶으면 getCoalescedEvents 로 — input.js 는 조각마다 제 시각으로 쌓는다).
        //  손가락 하나일 때만: 하나씩 보낸 것과 sha 같음 (PASSIVE 전체 60·30J). 조이스틱을 누른 채 (두 손가락) 묶이면 조각 시각이 달라져 (FIGHT sha 다름) 하나씩 보낸다
        const sends = [];
        while (ti < tl.length && tl[ti].t <= now + dq[0]) sends.push(swordEv(tl[ti++]));
        await Promise.all(sends);
      } else while (ti < tl.length && tl[ti].t <= now + dq[0]) await swordEv(tl[ti++]);
      let res;
      for (let w0 = Date.now(); ;) {
        res = await runPage({ expect: lateOk ? null : sent.swordDown + sent.swordMove + sent.swordUp, dts: dq.slice(0, 300), nextT: ti < tl.length ? tl[ti].t : Infinity, stickOn, stick: block === 'fight', maxS: block === 'fight' ? MAXS : null, endT, stallT, pad: { at: wall0 + PAD0MS, xy: L.PROGRAMME.pad0 } });
        if (res.reason !== 'wait') break;
        timing.waits++;
        if (Date.now() - w0 > 5000) { errors.push(`터치가 5 s 안에 페이지에 다 닿지 않음 (보냄 ${sent.swordDown + sent.swordMove + sent.swordUp}, 받음 ${res.got}) — 이후 기다리지 않음`); lateOk = true; }
        await new Promise((r) => setTimeout(r, 1));
      }
      dq.splice(0, res.n);
      frames += res.n;
      for (const s of res.S) { hash.update(JSON.stringify(s) + '\n'); rS.push(s); }
      for (const e of res.E) { hashE.update(JSON.stringify(e) + '\n'); rE.push(e); }
      nS += res.S.length;
      now = res.status.now;
      st = res.status;
      if (res.reason === 'roundOver' || res.reason === 'maxS' || res.reason === 'end' || res.reason === 'stall') { reason = res.reason; break; }
      if (res.reason === 'stick') { stickOn = res.status.stickWant; await stickSet(stickOn, Math.round(now)); } // 모든 터치를 정수 ms 에 (시각 어긋남 검사가 뜻을 갖게; 조이스틱 시각은 게임이 읽지 않는다)
      if (res.n === 0 && res.reason !== 'touch') throw new Error(`프레임이 안 넘어감 (${res.reason})`);
    }
    // 판 끝: 손가락을 뗀다 (기록은 이미 멈췄다)
    if (swordAt) { sent.swordUp++; const a = swordAt; swordAt = null; await touch('touchEnd', [{ x: a[0], y: a[1], id: SWORD }], Math.round(now)); }
    await stickSet(false, Math.round(now));
    const result = block === 'passive' ? 'end' : reason === 'roundOver' ? (st.eAlive ? 'loss' : 'win') : reason === 'maxS' ? 'timeout' : reason;
    const lastTw = rS.length ? rS[rS.length - 1].tw : wall0;
    const wins = L.strokeWindows(prog, wall0).filter((w) => w.twEnd <= lastTw); // 판 끝에 끊긴 획은 뺀다
    const cut = L.strokeWindows(prog, wall0).filter((w) => w.twDown < lastTw && w.twEnd > lastTw).length;
    rounds.push({ rd, wall0, reason, result, fightT: st.fightT, frames: frames - frames0, steps: rS.length, strokesDone: wins.length, strokeCut: cut, start, padAt: await page.evaluate(() => window.__H.padAt ?? null), standWin: [wall0 + L.PROGRAMME.standWinMs[0], wall0 + L.PROGRAMME.standWinMs[1]], pState: st.pState, dist: st.dist });
    windows.push(...wins);
    for (const s of rS) allS.push(s);
    for (const e of rE) allE.push(e);
    log(`  ${block} 판 ${rd}: ${reason} (${result}) fightT ${st.fightT?.toFixed(2)} s · 스텝 ${rS.length} · 획 ${wins.length} (+끊김 ${cut}) · ${((Date.now() - T0) / 1000).toFixed(0)} s`);
    if (rd + 1 < nR) {
      // 다음 판: 끝난 판은 3.5 s 뒤 멈춤 화면 → 다시 싸우기. 시간 끝이면 멈춤 단추
      if (reason === 'roundOver') {
        let guard = 0;
        for (;;) {
          const dts = Array.from({ length: 120 }, () => 1000 / 60);
          const res = await runPage({ dts, nextT: Infinity, untilPaused: true });
          if (res.reason === 'paused' || ++guard > 20) break;
        }
      } else await page.evaluate(() => document.getElementById('btnPause').click());
      await page.waitForFunction(() => window.game.state === 'paused', null, { timeout: 30000, polling: 50 });
    }
  }
  const H = await page.evaluate(() => { const H = window.__H; return { tsDev: window.__tsDev, top: H.top.map((m) => ({ ...m })), caps: H.caps, ownMeta: H.ownMeta, frames: H.frames, paints: H.paints, forced: H.forced, direct: H.directRenders, capErr: H.capErr, synthTw: H.synthTw, pe: window.__pe, rc: window.__rc }; });
  // 대조: 보낸 칼 손가락 터치 ↔ 캔버스가 받은 포인터 이벤트
  const pe = H.pe;
  const inputCheck = { sent, got: pe, swordDownOk: (pe.down.game || 0) === sent.swordDown, swordUpOk: (pe.up.game || 0) === sent.swordUp, stickDownOk: (pe.down.moveStick || 0) === sent.stickDown, swordMoveDiff: (pe.move.game || 0) - sent.swordMove, swordCoalDiff: pe.coal - sent.swordMove };
  inputCheck.tsDev = { n: H.tsDev.n, maxMs: +H.tsDev.max.toFixed(4), meanMs: H.tsDev.n ? +(H.tsDev.sum / H.tsDev.n).toFixed(4) : null };
  if (!inputCheck.swordDownOk || !inputCheck.swordUpOk || !inputCheck.stickDownOk) errors.push(`터치 전달 어긋남 ${JSON.stringify(inputCheck)}`);
  if (H.tsDev.max > 0.3) errors.push(`터치 시각 어긋남 ${H.tsDev.max.toFixed(3)} ms (반올림으로 못 되찾을 수 있다)`);
  // 요약 (모든 스텝)
  const ginput = null; // 본판에는 손짓 입력이 없다
  const smeta = { dt: live.timestep, who: 'player', ginput, strokes: windows, standWin: rounds[0].standWin, rounds: block === 'fight' ? rounds.map((r) => ({ result: r.result, t: r.fightT })) : [], cell, block };
  const summary = L.summarise(allS, allE, smeta);
  // 나쁜 순간: 앞뒤 창 (전체 해상도)
  const worst = H.top.sort((a, b) => b.score - a.score || a.t - b.t).map((m) => {
    const i = allS.findIndex((s) => s.rd === m.rd && s.fightT === m.t);
    return { block, rd: m.rd, t: m.t, tw: m.tw, score: m.score, sv: m.sv, capNow: m.capNow, capHow: m.capHow ?? null, capLagMs: m.capNow != null ? +(m.capNow - m.tw).toFixed(2) : null, i, cap: H.caps[m.id] || null, win: i >= 0 ? allS.slice(Math.max(0, i - WIN_STEPS), i + WIN_STEPS + 1) : [] };
  });
  return {
    cell, pacing, block, url, live, summary, rounds, errors, inputCheck, ownCollide: H.ownMeta, samples: allS, events: allE, worst,
    sha: hash.digest('hex'), shaEvents: hashE.digest('hex'), timing: { ...timing, evalMs: Math.round(timing.evalMs), touchMs: Math.round(timing.touchMs), setupS: +(setupS ?? 0).toFixed(1) }, frames, pageFrames: H.frames, paints: H.paints, forcedPaints: H.forced, directRenders: H.direct, capErr: H.capErr, synthTw: H.synthTw, rc: H.rc, wallS: (Date.now() - T0) / 1000,
  };
}

// ───────── 저장 ─────────
const rnd = (v) => (typeof v === 'number' ? (Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : null) : Array.isArray(v) ? v.map(rnd) : v);
function pack(rows, every = 1) {
  if (!rows.length) return { every, n: 0, cols: [], enc: 'gzip-base64-json', data: '' };
  const cols = Object.keys(rows[0]);
  const out = [];
  for (let i = 0; i < rows.length; i += every) out.push(cols.map((k) => rnd(rows[i][k])));
  return { every, n: out.length, cols, enc: 'gzip-base64-json (행 = cols 순서 값, 4 자리 반올림)', data: zlib.gzipSync(JSON.stringify(out)).toString('base64') };
}
function savePng(cap, file) {
  const { PNG } = require('playwright-core/lib/utilsBundle');
  const raw = Buffer.from(cap.b64, 'base64');
  const png = new PNG({ width: cap.w, height: cap.h });
  const row = cap.w * 4;
  for (let y = 0; y < cap.h; y++) raw.copy(png.data, y * row, (cap.h - 1 - y) * row, (cap.h - y) * row); // readPixels 는 아래부터
  for (let i = 3; i < png.data.length; i += 4) png.data[i] = 255;
  fs.writeFileSync(file, PNG.sync.write(png));
}

async function runCell(browser, cell, pacing, log) {
  const T0 = Date.now();
  const out = { meta: null, blocks: {}, errors: [] };
  const blocks = [];
  for (const b of BLOCKS) {
    log(` ${cell} @ ${pacing} · ${b}`);
    const r = await runBlock(browser, cell, pacing, b, log);
    blocks.push(r);
  }
  const full = crypto.createHash('sha256');
  for (const r of blocks) full.update(r.sha);
  const worstAll = blocks.flatMap((r) => r.worst).sort((a, b) => b.score - a.score || a.t - b.t).slice(0, 3);
  const pngs = [];
  if (PNGON) {
    fs.mkdirSync(path.join(OUT, 'png'), { recursive: true });
    for (const w of worstAll) if (w.cap) { const f = path.join(OUT, 'png', `${cell}__${pacing}__${w.block[0]}${w.rd}_${w.t.toFixed(3)}.png`); savePng(w.cap, f); pngs.push(f); w.png = f; }
  }
  const b0 = blocks[0];
  out.meta = {
    tool: 'live_diag.mjs', toolSha256: sha(fs.readFileSync(SELF)), commonSha256: sha(COMMON_SRC), tree: TREE, url: b0?.url, cell, request: parseCell(cell), pacing, pacingDef: L.PACINGS[pacing], blocks: BLOCKS,
    seed: SEED, programmeSeed: L.PROGRAMME.seed, quick: QUICK, pipeline: PIPE, rounds: ROUNDS, maxS: MAXS, renderSkip: RSKIP, png: PNGON, pad0: { atMs: PAD0MS, xy: L.PROGRAMME.pad0 },
    browser: { chrome: CHROME, version: browser.version(), args: CHROME_ARGS, viewport: VIEW, isMobile: true, hasTouch: true, deviceScaleFactor: 1, css: '#game { opacity: 0 } (합성만 뺌)', menuFrames: MENU_FRAMES },
    mapping: { pxPerPad: L.pxPerPad(), touchSensitivity: L.MAP_PHONE.touchSensitivity, innerHeight: b0?.live.inner[1], originPx: L.PROGRAMME.originPx, stickCenterPx: b0?.live.stick.slice(0, 2), stickDeflectPx: L.PROGRAMME.fight.stickR * L.PROGRAMME.fight.stickDeflect, rule: 'dx_pad = dx_px / pxPerPad, dy_pad = −dy_px / pxPerPad (input.js scale = touchSensitivity / max(320, innerHeight))' },
    live: b0?.live, sampleSha256: full.digest('hex'), wallS: (Date.now() - T0) / 1000,
    passive: { gapM: L.PROGRAMME.passive.gapM, ai: 'game.ai.update = () => enemy.move.set(0, 0)', undying: 'enemy.die = () => {} · 목 없는 과녁의 목 상처 건너뜀 (chain.mjs 와 같다)', relocate: '적 몸체·칼·anchor 를 가슴 중심선 따라 옮기고 gait.started=false, active=false (다음 update 가 enter 로 두 발을 새 자리에)' },
    hook: 'game.combat.afterStep 감쌈 (world.step 과 상처 훅 바로 뒤, 쌍둥이 G.step 뒤와 같은 자리)',
  };
  for (const r of blocks) {
    out.blocks[r.block] = {
      summary: r.summary, rounds: r.rounds, events: r.events, errors: r.errors, inputCheck: r.inputCheck, ownCollide: r.ownCollide, sha: r.sha, shaEvents: r.shaEvents, steps: r.samples.length, frames: r.frames, paints: r.paints, forcedPaints: r.forcedPaints, directRenders: r.directRenders, capErr: r.capErr, timing: r.timing, synthTw: r.synthTw, randomCalls: r.rc, wallS: r.wallS,
      samples: pack(r.samples, DECIM),
      worst: r.worst.map((w) => ({ block: w.block, rd: w.rd, t: w.t, tw: w.tw, score: w.score, sv: w.sv, capHow: w.capHow, capLagMs: w.capLagMs, png: w.png ?? null, window: pack(w.win, 1) })),
    };
    out.errors.push(...r.errors.map((e) => `${r.block}: ${e}`));
    if (FULL) fs.writeFileSync(path.join(OUT, `${cell}__${pacing}__${r.block}.samples.jsonl.gz`), zlib.gzipSync(r.samples.map((s) => JSON.stringify(s)).join('\n')));
  }
  out.worst = worstAll.map((w) => ({ block: w.block, rd: w.rd, t: w.t, score: w.score, sv: w.sv, png: w.png ?? null, capHow: w.capHow, capLagMs: w.capLagMs }));
  const file = path.join(OUT, `${cell}__${pacing}.json`);
  fs.writeFileSync(file, JSON.stringify(out));
  return { file, sha: out.meta.sampleSha256, blocks: Object.fromEntries(blocks.map((r) => [r.block, { sha: r.sha, steps: r.samples.length, wallS: r.wallS, errors: r.errors.length }])), wallS: out.meta.wallS, errors: out.errors, pngs };
}

// ───────── 표 ─────────
const f3 = (x, d = 3) => (x == null || !Number.isFinite(+x) ? '–' : (+x).toFixed(d));
function cellOrder(name) {
  const c = parseCell(name);
  return [+c.skill];
}
function writeTable() {
  const files = fs.readdirSync(OUT).filter((f) => /__[^_]+\.json$/.test(f) && !f.endsWith('.error.json'));
  const rows = [];
  for (const f of files) {
    const J = JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
    for (const [block, B] of Object.entries(J.blocks)) rows.push({ cell: J.meta.cell, pacing: J.meta.pacing, block, B, meta: J.meta });
  }
  const cmp = (a, b) => { const x = cellOrder(a.cell), y = cellOrder(b.cell); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
  const groups = new Map();
  for (const r of rows) { const k = `${r.block} · ${r.pacing}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
  const pacOrder = (p) => L.PACING_NAMES.indexOf(p);
  const keys = [...groups.keys()].sort((a, b) => { const [ba, pa] = a.split(' · '), [bb, pb] = b.split(' · '); return ba === bb ? pacOrder(pa) - pacOrder(pb) : ba < bb ? 1 : -1; });
  const md = [`# R2 실전 진단 — 브라우저 하니스 표 (${new Date().toISOString()})`, '', `폴더 ${OUT} · 파일 ${files.length} · 칸 = k<검술 보정> (본판; 설정 칸은 --tree 이름으로 구분)`, '', '판정 표 (RANGES · PEAKS · OSC · DECL) = tools/sim/live_common.mjs. 각 값 정의 = summarise.', ''];
  const T = (title, head, fn) => { md.push(`### ${title}`, '', `| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`); return fn; };
  for (const k of keys) {
    const G = groups.get(k).sort(cmp);
    md.push(`## ${k}`, '');
    const topJ = (pj) => Object.entries(pj || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([j, v]) => `${j} ${f3(v, 2)}`).join(', ') || '–';
    const maxBy = (o, f) => { let best = null; for (const [j, v] of Object.entries(o || {})) if (v && (best == null || f(v) > f(best[1]))) best = [j, v]; return best; };
    T('사람 움직임: 뒤틀림 · 자기 몸 뚫림 · 몸통 건너뛰기', ['cell', 'gw', 'steps', 'stand', 'distortion idx', 'top joints (frac)', 'sep p99 m', 'pen ev/stroke', 'pen ev/min', 'arm→torso/stroke', 'top pairs (events, max depth m)', 'teleports/stroke (hand+elbow)', 'pole flips/stroke'], null);
    for (const r of G) {
      const s = r.B.summary, D = s.distortion, P = s.selfPen;
      const pairs = Object.entries(P.byPair).sort((a, b) => b[1].events - a[1].events).slice(0, 3).map(([p, v]) => `${p} ${v.events} (${f3(v.maxDepth, 2)})`).join(', ') || '–';
      md.push(`| ${r.cell} | ${f3(r.meta.live?.guardWeight, 2)} | ${s.n} | ${f3(s.standFrac, 2)} | ${f3(D.index)} | ${topJ(D.perJoint)} | ${f3(D.constraint.sepP99)} | ${f3(P.perStroke)} | ${f3(P.perMin, 1)} | ${f3(P.armThroughTorsoPerStroke)} | ${pairs} | ${f3(P.teleports.perStroke)} (${P.teleports.hand}+${P.teleports.elbow}) | ${f3(P.poleFlipsPerStroke)} |`);
    }
    md.push('');
    T('흐물거림: 각속도·각가속도 (사람 최고 배수) · 떨림 · 골반 · 발 · 다리 몫', ['cell', 'ω p99 ×peak max (joint)', 'ω frac>peak max', 'α p99 ×peak max (joint)', 'osc >8 Hz share', 'dom Hz', 'pelvis std med / p95 (m)', 'dip / dip p5 (m)', 'both-off frac', 'episodes >0.1 s (/min)', 'longest s', 'leg load med / p10', 'load<0.5 frac', 'assist raised frac'], null);
    for (const r of G) {
      const b = r.B.summary.boneless;
      const ws = maxBy(b.speed, (v) => v.xPeak), wf = maxBy(b.speed, (v) => v.fracAbove), as = maxBy(b.accel, (v) => v.xPeak);
      md.push(`| ${r.cell} | ${ws ? `${f3(ws[1].xPeak, 2)} (${ws[0]})` : '–'} | ${wf ? `${f3(wf[1].fracAbove)} (${wf[0]})` : '–'} | ${as ? `${f3(as[1].xPeak, 2)} (${as[0]})` : '–'} | ${f3(b.osc.highShareMean)} | ${b.osc.domHz ?? '–'} | ${f3(b.pelvis.stdMedian, 4)} / ${f3(b.pelvis.stdP95, 4)} | ${f3(b.pelvis.dip)} / ${f3(b.pelvis.dipP5)} | ${f3(b.feet.bothOffFrac)} | ${b.feet.episodes} (${f3(b.feet.episodesPerMin, 1)}) | ${f3(b.feet.longestS, 2)} | ${f3(b.load.median, 2)} / ${f3(b.load.p10, 2)} | ${f3(b.load.fracBelowHalf)} | ${f3(b.load.assistRaisedFrac)} |`);
    }
    md.push('');
    T('과제: 칼끝 · 상처 · 넘어짐 · 판', ['cell', 'tip peak med m/s', 'hits/stroke', 'wounds dealt (J)', 'wounds recv/stroke', 'wounds recv (J)', 'falls (/min)', 'rounds W/L/T', 'round fightT s'], null);
    for (const r of G) {
      const t = r.B.summary.task;
      md.push(`| ${r.cell} | ${f3(t.tipPeakMedian, 2)} | ${f3(t.hitsPerStroke)} | ${t.woundsDealt} (${f3(t.energyDealt, 0)}) | ${f3(t.woundsReceivedPerStroke)} | ${t.woundsReceived} (${f3(t.energyReceived, 0)}) | ${t.falls} (${f3(t.fallsPerMin, 2)}) | ${t.rounds.won}/${t.rounds.lost}/${t.rounds.timeout} | ${t.rounds.timeS.map((x) => f3(x, 1)).join(', ') || '–'} |`);
    }
    md.push('');
    T('조종: 잘못 읽음 · 헛 확정 · 뗀 뒤 드라이브 · 손 되돌아감', ['cell', 'strokes', 'misclass frac (wind/straight)', 'fam mismatch', 'spurious commits/stroke clean / cont', 'drift cuts / commits', 'drive after release ms med / max (censored)', 'gesture after ms med', 'hitch m/s med / max', 'post-lift hand m/s med / max'], null);
    for (const r of G) {
      const C = r.B.summary.control;
      if (!C) { md.push(`| ${r.cell} | – | (손짓 층 없음) | | | | | | | |`); continue; }
      md.push(`| ${r.cell} | ${C.strokes} | ${f3(C.misclass.frac)} (${C.misclass.byKind.wind}/${C.misclass.byKind.straight}) | ${C.misclass.famMismatch} | ${f3(C.spuriousCommits.perStrokeClean)} / ${f3(C.spuriousCommits.perStrokeCont)} | ${C.spuriousCuts.driftCuts} / ${C.spuriousCuts.driftCommits} | ${f3(C.driveAfterReleaseMs.median, 0)} / ${f3(C.driveAfterReleaseMs.max, 0)} (${C.driveAfterReleaseMs.censored}) | ${f3(C.gestureAfterReleaseMs.median, 0)} | ${f3(C.hitch.median, 2)} / ${f3(C.hitch.max, 2)} | ${f3(C.postLiftHandSpeed.median, 2)} / ${f3(C.postLiftHandSpeed.max, 2)} |`);
    }
    md.push('');
  }
  const f = path.join(OUT, 'table.md');
  fs.writeFileSync(f, md.join('\n'));
  console.log(`표 ${f} (행 ${rows.length})`);
}

// ───────── 시작 ─────────
if (opt('table', false)) {
  writeTable();
  process.exit(0);
}
if (opt('help', false)) {
  console.log(fs.readFileSync(SELF, 'utf8').split('\n').filter((l) => l.startsWith('//')).slice(0, 26).join('\n'));
  process.exit(0);
}
// Node 쪽 조각 대조: 페이지에 넣는 rangeFlags 가 모듈 것과 같은 판정인가 (흉내 파이터 표본)
{
  const f = L.mockFighter();
  const s = L.sampleFighter({ f, world: null, t: 3, tw: 3000, dt: 1 / 120, st: {} });
  const s2 = { ...s, elS: -30, spTw: 70, kneeF: 150 };
  for (const x of [s, s2]) if (JSON.stringify(LHN.rangeFlags(x)) !== JSON.stringify(L.rangeFlags(x))) throw new Error('페이지용 rangeFlags 가 모듈과 다르다');
  if (LHN.severity(s2, []).score < 3) throw new Error('나쁨 점수 자체 검사 실패');
}
for (const p of PACS) if (!L.PACINGS[p]) throw new Error(`모르는 pacing ${p} (${L.PACING_NAMES.join(', ')})`);
for (const c of CELLS) parseCell(c);
fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: CHROME, args: CHROME_ARGS });
const log = (s) => console.log(s);
let fail = 0;
const summaryOut = [];
for (const cell of CELLS)
  for (const pacing of PACS) {
    try {
      const r = await runCell(browser, cell, pacing, log);
      summaryOut.push({ cell, pacing, ...r });
      console.log(`${r.errors.length ? 'NG ' : 'OK '} ${cell} @ ${pacing}: sha ${r.sha.slice(0, 16)} · ${JSON.stringify(r.blocks)} · ${r.wallS.toFixed(0)} s${r.pngs.length ? ` · png ${r.pngs.length}` : ''}${r.errors.length ? ' · ' + r.errors.join(' | ') : ''}`);
      if (r.errors.length) fail++;
    } catch (e) {
      fail++;
      const f = path.join(OUT, `${cell}__${pacing}.error.json`);
      fs.writeFileSync(f, JSON.stringify({ cell, pacing, error: String(e.message || e), stack: e.stack, live: e.live ?? null }, null, 1));
      console.log(`ERR ${cell} @ ${pacing}: ${e.message} → ${f}`);
    }
  }
await browser.close();
fs.writeFileSync(path.join(OUT, `runs_${Date.now()}.json`), JSON.stringify(summaryOut, null, 1));
process.exit(fail ? 1 : 0);

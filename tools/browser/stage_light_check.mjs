// 스테이지 조명 점검: 스테이지마다 대결을 시작해 한 장면을 멈춰 세우고, 두 캐릭터만 단색으로 그린 가림막(mask)과 겹쳐
//  캐릭터 픽셀의 밝기(평균·하위 10%·중앙값)와 캐릭터를 둘러싼 배경의 밝기를 잰다. 밤 스테이지에서 캐릭터가 검게 묻히는지 확인용.
//  새 스테이지를 올리기 전에 이걸 돌려 docs/stages.md 의 "조명 약속" 기준을 넘는지 본다.
//
//  실행: vite 개발 서버를 띄운 뒤 (npm run dev) playwright 가 설치된 곳에서
//    node tools/browser/stage_light_check.mjs http://127.0.0.1:5173 [--stages=poseidon,temple,castle,cathedral,darkhall]
//        [--foes=heinrich,bran,margarethe] [--out=폴더] [--base=이전결과.json] [--ref=포세이돈이든결과.json] [--hold=3000]
//  포세이돈(기본 배경, 낮)은 상대 기준을 재려고 --stages 에 없어도 맨 먼저 함께 잰다 (--ref 를 주면 그 파일의 포세이돈 값을 쓴다).
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright, 또는 PLAYWRIGHT=playwright 의 index.mjs 경로).
//  크롬 경로는 PW_CHROMIUM (없으면 playwright 기본)
//
//  재는 방법 (844×390, 폰 가로 화면):
//   1) ?stage=…&foe=…&weapon=longsword&emo=0 으로 열고 "싸움 시작" → AI를 멈춰(가만히 겨눈 자세) 무기 룰렛이 끝나고
//      물리 시간이 1초 넘게 흐르길 기다린다
//   2) P(일시정지)로 물리를 멈추고 카메라도 고정(game.freeCam) → 글자·버튼을 숨기고 한 장 찍는다 (_full.png)
//   3) 캐릭터 조명(game.fighterLight)이 있으면 꺼서 같은 장면을 한 장 더 찍는다 (_off.png, 고치기 전 모습과 같다)
//   4) 배경을 모두 숨기고 주인공은 빨강, 상대는 초록 단색으로 한 장 더 찍는다 (_mask.png)
//   5) 가림막 안쪽(가장자리 1px 깎음)의 밝기 = 캐릭터, 가림막에서 3~24px 떨어진 띠 = 둘레 배경
//  밝기 Y = 0.2126R + 0.7152G + 0.0722B (sRGB 0~255 그대로, 화면에 보이는 밝기에 가깝다)
//  보고 (주인공·상대 따로, 둘을 합친 값도): 평균·하위 10%, 거의 검은 픽셀(Y<24) 비율, 둘레 배경 중앙값,
//        대비(캐릭터 평균 ÷ 배경 중앙값), 분리도(캐릭터 픽셀 중 둘레 배경 중앙값과 16 이상 차이 나는 비율),
//        윤곽(캐릭터 가장자리 2px 안 픽셀 중 바로 옆 배경 13×13 평균과 16 이상 차이 나는 비율 — 실루엣이 보이나),
//        배경 전체 평균(캐릭터 조명이 배경을 바꾸지 않았나)
//  기준 (docs/stages.md 조명 약속, 상대마다 모두):
//   주인공 — 평균 ≥ 60, 하위 10% ≥ 12, 거의 검은 픽셀 ≤ 15%, 윤곽 ≥ 30%
//   상대 — 옷 색이 저마다 달라(마르그레테는 낮에도 검은 옷) 같은 상대의 포세이돈 값에 견준다:
//          평균 ≥ 포세이돈의 0.7배, 하위 10% ≥ min(12, 포세이돈의 0.7배), 거의 검은 픽셀 ≤ 포세이돈 + 10%p, 윤곽 ≥ 30%
import fs from 'node:fs';
import path from 'node:path';

async function loadPlaywright() {
  for (const p of [process.env.PLAYWRIGHT, 'playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    if (!p) continue;
    try {
      return await import(p);
    } catch {
      /* 다음 후보 */
    }
  }
  throw new Error('playwright 를 찾지 못했다 (npm i --no-save playwright 또는 PLAYWRIGHT=경로)');
}

const args = process.argv.slice(2);
const opt = (k, d) => {
  const a = args.find((s) => s.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const base = args.find((s) => !s.startsWith('--')) || 'http://127.0.0.1:5173';
const REF = 'poseidon'; // 상대 기준을 재는 낮 스테이지
const refJson = opt('ref', null); // 전에 잰 results.json 의 포세이돈 값을 상대 기준으로 다시 쓴다 (포세이돈을 또 재지 않는다)
const refOf = {};
if (refJson) for (const r of JSON.parse(fs.readFileSync(refJson, 'utf8'))) if (r.stage === REF) refOf[r.foeId] = r;
const stagesArg = opt('stages', 'poseidon,temple,castle,cathedral,darkhall').split(',');
const STAGES = refJson ? stagesArg : [...new Set([REF, ...stagesArg])];
const FOES = opt('foes', 'heinrich,bran,margarethe').split(',');
const OUT = opt('out', 'stage_light');
const HOLD = +opt('hold', 3000);
const baseJson = opt('base', null);
// 통과 기준
const GATE = {
  player: { mean: 60, p10: 12, dark: 0.15 }, // 주인공 (옷이 늘 같다)
  foe: { mean: 0.7, p10: 0.7, p10Max: 12, dark: 0.1 }, // 상대: 같은 상대의 포세이돈 값에 대한 배율·차이
  edge: 0.3, // 윤곽 (둘 다)
};
fs.mkdirSync(OUT, { recursive: true });

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

// ── 페이지 안에서 도는 부분 ──
/** 배경을 숨기고 두 캐릭터를 단색(주인공 빨강, 상대 초록)으로 바꾼다. 되돌리는 함수를 window 에 걸어 둔다 */
function maskOn() {
  const { THREE } = window.game;
  const roots = [window.game.player, window.game.enemy].map((f) => f.meshes.map((m) => m.group));
  const scene = roots[0][0].parent;
  const keep = new Set(roots.flat());
  const undo = [];
  undo.push(((bg, fog) => () => Object.assign(scene, { background: bg, fog }))(scene.background, scene.fog));
  scene.background = new THREE.Color(0x000000);
  scene.fog = null;
  for (const c of scene.children) {
    if (keep.has(c)) continue;
    const v = c.visible;
    undo.push(() => (c.visible = v));
    c.visible = false;
  }
  roots.forEach((rs, i) => {
    const m = new THREE.MeshBasicMaterial({ color: i ? 0x00ff00 : 0xff0000 });
    for (const r of rs)
      r.traverse((o) => {
        if (o.isMesh) {
          const was = o.material;
          undo.push(() => (o.material = was));
          o.material = m;
        } else if (o.material) {
          const v = o.visible; // 점·선 같은 것은 가림막에서 뺀다
          undo.push(() => (o.visible = v));
          o.visible = false;
        }
      });
  });
  window.__maskOff = () => undo.reverse().forEach((f) => f());
}

/** 가림막 한 장과 화면 여러 장을 받아 장마다 캐릭터·둘레 배경 밝기를 잰다. 상대를 3배로 잘라 낸 그림(첫 장)도 돌려준다 */
async function analyze([maskB64, frameB64s]) {
  const load = async (b64) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const x = c.getContext('2d');
    x.drawImage(bmp, 0, 0);
    return { w: bmp.width, h: bmp.height, d: x.getImageData(0, 0, bmp.width, bmp.height).data, bmp };
  };
  const M = await load(maskB64);
  const { w, h } = M;
  const N = w * h;
  const cls = new Uint8Array(N); // 0 배경, 1 주인공, 2 상대
  const any = new Uint8Array(N); // 가장자리(안티에일리어싱) 포함 캐릭터 자리
  for (let i = 0; i < N; i++) {
    const r = M.d[i * 4];
    const g = M.d[i * 4 + 1];
    if (r > 160 && g < 90) cls[i] = 1;
    else if (g > 160 && r < 90) cls[i] = 2;
    if (r > 24 || g > 24) any[i] = 1;
  }
  // 가장자리 1px 깎기 (배경과 섞인 픽셀을 빼려고)
  const core = new Uint8Array(N);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const c = cls[i];
      if (c && cls[i - 1] === c && cls[i + 1] === c && cls[i - w] === c && cls[i + w] === c) core[i] = c;
    }
  // 사각형(체비쇼프) 부풀리기: 가로 → 세로, 두 방향으로 훑어 가장 가까운 칸까지의 거리를 본다
  const dilate = (src, r) => {
    const tmp = new Uint8Array(N);
    const out = new Uint8Array(N);
    for (let y = 0; y < h; y++) {
      let prev = -1e9;
      for (let x = 0; x < w; x++) {
        if (src[y * w + x]) prev = x;
        if (x - prev <= r) tmp[y * w + x] = 1;
      }
      let next = 1e9;
      for (let x = w - 1; x >= 0; x--) {
        if (src[y * w + x]) next = x;
        if (next - x <= r) tmp[y * w + x] = 1;
      }
    }
    for (let x = 0; x < w; x++) {
      let prev = -1e9;
      for (let y = 0; y < h; y++) {
        if (tmp[y * w + x]) prev = y;
        if (y - prev <= r) out[y * w + x] = 1;
      }
      let next = 1e9;
      for (let y = h - 1; y >= 0; y--) {
        if (tmp[y * w + x]) next = y;
        if (next - y <= r) out[y * w + x] = 1;
      }
    }
    return out;
  };
  const nearAll = dilate(any, 3);
  const regions = [0, 1, 2].map((which) => {
    const inF = (c) => (which === 0 ? c > 0 : c === which);
    const sel = new Uint8Array(N);
    const notSel = new Uint8Array(N);
    const px = [];
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let i = 0; i < N; i++) {
      if (inF(core[i])) px.push(i);
      if (inF(cls[i])) {
        sel[i] = 1;
        const x = i % w, y = (i / w) | 0;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      } else notSel[i] = 1;
    }
    const zone = dilate(sel, 24);
    const ring = [];
    for (let i = 0; i < N; i++) if (zone[i] && !nearAll[i]) ring.push(i);
    // 윤곽: 캐릭터 안쪽 픽셀 중 캐릭터 밖이 2px 안에 있는 것
    const outside = dilate(notSel, 2);
    const edge = px.filter((i) => outside[i]);
    return { px, ring, edge, box: [x0, y0, x1, y1] };
  });
  const scenePx = [];
  for (let i = 0; i < N; i++) if (!nearAll[i]) scenePx.push(i);
  const pct = (arr, p) => {
    if (!arr.length) return NaN;
    const s = Float32Array.from(arr).sort();
    return s[Math.min(s.length - 1, Math.floor(p * s.length))];
  };
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
  const R = 6; // 윤곽 픽셀 옆 배경을 보는 창 반지름 (13×13)
  const W = w + 1;
  const frames = [];
  let crop = null;
  for (const b64 of frameB64s) {
    const F = await load(b64);
    const Yv = new Float32Array(N);
    for (let i = 0; i < N; i++) Yv[i] = 0.2126 * F.d[i * 4] + 0.7152 * F.d[i * 4 + 1] + 0.0722 * F.d[i * 4 + 2];
    // 캐릭터에서 3px 넘게 떨어진 배경 픽셀만의 적분 영상 (합·개수) → 어느 창이든 배경 평균을 바로 낸다
    const SY = new Float64Array(W * (h + 1));
    const SC = new Float64Array(W * (h + 1));
    for (let y = 0; y < h; y++) {
      let ry = 0, rc = 0;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!nearAll[i]) {
          ry += Yv[i];
          rc++;
        }
        SY[(y + 1) * W + x + 1] = SY[y * W + x + 1] + ry;
        SC[(y + 1) * W + x + 1] = SC[y * W + x + 1] + rc;
      }
    }
    const boxSum = (S, x0, y0, x1, y1) => S[y1 * W + x1] - S[y0 * W + x1] - S[y1 * W + x0] + S[y0 * W + x0];
    const stat = ({ px, ring, edge, box }) => {
      const fy = px.map((i) => Yv[i]);
      const by = ring.map((i) => Yv[i]);
      const mean = avg(fy);
      const bgMed = pct(by, 0.5);
      let en = 0, eFar = 0;
      for (const i of edge) {
        const x = i % w, y = (i / w) | 0;
        const x0 = Math.max(0, x - R), y0 = Math.max(0, y - R), x1 = Math.min(w, x + R + 1), y1 = Math.min(h, y + R + 1);
        const c = boxSum(SC, x0, y0, x1, y1);
        if (c < 8) continue; // 옆이 온통 다른 캐릭터면 건너뛴다
        en++;
        if (Math.abs(Yv[i] - boxSum(SY, x0, y0, x1, y1) / c) >= 16) eFar++;
      }
      return {
        px: fy.length,
        mean: +mean.toFixed(1),
        p10: +pct(fy, 0.1).toFixed(1),
        p50: +pct(fy, 0.5).toFixed(1),
        dark: +(fy.filter((v) => v < 24).length / Math.max(1, fy.length)).toFixed(3),
        bgMed: +bgMed.toFixed(1),
        contrast: +(mean / Math.max(1, bgMed)).toFixed(2),
        sep: +(fy.filter((v) => Math.abs(v - bgMed) >= 16).length / Math.max(1, fy.length)).toFixed(3),
        edge: +(eFar / Math.max(1, en)).toFixed(3),
        edgePx: en,
        box,
      };
    };
    frames.push({ all: stat(regions[0]), player: stat(regions[1]), foe: stat(regions[2]), scene: +avg(scenePx.map((i) => Yv[i])).toFixed(2) });
    if (!crop) {
      // 상대(카메라를 마주 보는 쪽)를 3배로 잘라 낸 그림
      const [x0, y0, x1, y1] = regions[2].box;
      const m = 20;
      const cx0 = Math.max(0, x0 - m), cy0 = Math.max(0, y0 - m);
      const cw = Math.min(w, x1 + m) - cx0, ch = Math.min(h, y1 + m) - cy0;
      if (cw > 0 && ch > 0) {
        const c = new OffscreenCanvas(cw * 3, ch * 3);
        const x = c.getContext('2d');
        x.imageSmoothingEnabled = false;
        x.drawImage(F.bmp, cx0, cy0, cw, ch, 0, 0, cw * 3, ch * 3);
        const buf = new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer());
        let s = '';
        for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        crop = btoa(s);
      }
    }
  }
  return { frames, crop };
}

const nextFrames = (page, n = 3) =>
  page.evaluate((n) => new Promise((ok) => { const f = () => (--n <= 0 ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

async function capture(stage, foe) {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const q = `${stage === 'poseidon' ? '' : `stage=${stage}&`}foe=${foe}&weapon=longsword&emo=0`;
  await page.goto(`${base}/?${q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
  await page.getByText('싸움 시작').click();
  await page.evaluate(() => { window.game.ai.update = () => {}; }); // 가만히 겨눈 자세로 세워 둔다 (판마다 같은 장면)
  await page.waitForTimeout(HOLD);
  await page.waitForFunction(() => window.game.stats.simTime > 1.0, null, { timeout: 90000 }); // 느린 기계에서도 자세가 자리 잡게
  await page.keyboard.press('KeyP'); // 물리 멈춤
  await page.evaluate(() => { window.game.freeCam = true; }); // 카메라·해도 멈춤
  await page.addStyleTag({ content: 'body > :not(#game) { display: none !important; }' });
  await nextFrames(page);
  const shots = { full: await page.screenshot({ type: 'png' }) };
  const light = await page.evaluate(() => {
    const L = window.game.fighterLight;
    if (!L) return null;
    const r = (v) => +(v ?? 0).toFixed(3);
    return { stageLight: r(L.stageLight), level: r(L.level), key: r(L.key), amb: r(L.amb), rim: r(L.rim), glow: r(L.glow), env: r(L.env) };
  });
  if (light) {
    await page.evaluate(() => { window.game.fighterLight.enabled = false; });
    await nextFrames(page);
    shots.off = await page.screenshot({ type: 'png' });
    await page.evaluate(() => { window.game.fighterLight.enabled = true; });
  }
  await page.evaluate(maskOn);
  await nextFrames(page);
  shots.mask = await page.screenshot({ type: 'png' });
  await page.evaluate(() => window.__maskOff());
  const frameList = [shots.full, ...(shots.off ? [shots.off] : [])].map((b) => b.toString('base64'));
  const r = await page.evaluate(analyze, [shots.mask.toString('base64'), frameList]);
  await page.close();
  return { shots, r, light, errors };
}

async function measure(stage, foe) {
  let c;
  for (let tries = 0; tries < 3; tries++) {
    c = await capture(stage, foe);
    const [f] = c.r.frames;
    // 카메라가 주인공 뒤에 제대로 서 있는지 (둘이 겹치거나 화면 밖이면 다시)
    if (f.player.px > 1500 && f.foe.px > 300 && f.player.box[3] > f.foe.box[3]) break;
    console.log(`  (${stage}/${foe}: 장면이 이상해 다시 찍는다 — 주인공 ${f.player.px}px, 상대 ${f.foe.px}px)`);
  }
  const tag = `${stage}_${foe}`;
  for (const [k, b] of Object.entries(c.shots)) fs.writeFileSync(path.join(OUT, `${tag}_${k}.png`), b);
  if (c.r.crop) fs.writeFileSync(path.join(OUT, `${tag}_foe.png`), Buffer.from(c.r.crop, 'base64'));
  const [on, off] = c.r.frames;
  return { stage, foeId: foe, ...on, off: off || null, light: c.light, errors: c.errors }; // foe 는 상대 픽셀 값, 상대 이름은 foeId
}

const pctS = (v) => `${(v * 100).toFixed(0)}%`;
/** 기준에 못 미친 항목들 (빈 배열이면 통과). ref 는 같은 상대의 포세이돈 결과 */
function judge(r, ref) {
  const bad = [];
  const P = r.player, G = GATE.player;
  if (P.mean < G.mean) bad.push(`주인공 평균 ${P.mean} < ${G.mean}`);
  if (P.p10 < G.p10) bad.push(`주인공 하위10% ${P.p10} < ${G.p10}`);
  if (P.dark > G.dark) bad.push(`주인공 검은 ${pctS(P.dark)} > ${pctS(G.dark)}`);
  if (P.edge < GATE.edge) bad.push(`주인공 윤곽 ${pctS(P.edge)} < ${pctS(GATE.edge)}`);
  const F = r.foe;
  if (ref) {
    const R = ref.foe, g = GATE.foe;
    const mean = +(R.mean * g.mean).toFixed(1);
    const p10 = +Math.min(g.p10Max, R.p10 * g.p10).toFixed(1);
    const dark = R.dark + g.dark;
    if (F.mean < mean) bad.push(`상대 평균 ${F.mean} < ${mean} (포세이돈 ${R.mean}의 ${g.mean}배)`);
    if (F.p10 < p10) bad.push(`상대 하위10% ${F.p10} < ${p10}`);
    if (F.dark > dark + 1e-9) bad.push(`상대 검은 ${pctS(F.dark)} > ${pctS(dark)} (포세이돈 ${pctS(R.dark)} + ${pctS(g.dark)}p)`);
  } else bad.push('상대 기준(포세이돈) 없음');
  if (F.edge < GATE.edge) bad.push(`상대 윤곽 ${pctS(F.edge)} < ${pctS(GATE.edge)}`);
  return bad;
}
const fmt = (a) =>
  `평균 ${a.mean.toFixed(1).padStart(5)} 하위10% ${a.p10.toFixed(1).padStart(4)} 검은 ${pctS(a.dark).padStart(4)} 둘레 ${a.bgMed.toFixed(1).padStart(5)} 대비 ${a.contrast.toFixed(2).padStart(4)} 분리 ${pctS(a.sep).padStart(4)} 윤곽 ${pctS(a.edge).padStart(4)}`;

const results = [];
for (const s of STAGES)
  for (const f of FOES) {
    const r = await measure(s, f);
    if (s === REF) refOf[f] = r;
    r.fail = judge(r, refOf[f]);
    results.push(r);
    let line = `${s.padEnd(9)} ${f.padEnd(10)} ${r.fail.length ? '미달' : '통과'}  에러 ${r.errors.length}`;
    line += `\n   둘 다   ${fmt(r.all)}\n   주인공  ${fmt(r.player)}\n   상대    ${fmt(r.foe)}`;
    if (r.fail.length) line += `\n   미달: ${r.fail.join(', ')}`;
    if (r.off) line += `\n   같은 장면 조명 끔: 둘 다 평균 ${r.off.all.mean.toFixed(1)} (켬 ×${(r.all.mean / r.off.all.mean).toFixed(3)}), 주인공 ${r.off.player.mean} → ${r.player.mean}, 상대 ${r.off.foe.mean} → ${r.foe.mean}, 배경 전체 ${r.off.scene} → ${r.scene}\n   [스테이지 빛 ${r.light.stageLight}, 보조 ${r.light.key}, 바탕 ${r.light.amb}, 테두리 ${r.light.rim}, 윤곽 빛 ${r.light.glow}, 금속 반사 ×${r.light.env}]`;
    console.log(line);
  }
await browser.close();
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));

// 스테이지별 요약 (상대 여럿의 평균)
const byStage = {};
for (const r of results) {
  const b = (byStage[r.stage] ??= { n: 0, mean: 0, p10: 0, player: 0, pDark: 0, foe: 0, foeRel: 0, foeDark: 0, pEdge: 0, fEdge: 0, errors: 0, offMean: 0, offN: 0, fail: 0 });
  const ref = refOf[r.foeId]?.foe;
  b.n++;
  b.mean += r.all.mean;
  b.p10 += r.all.p10;
  b.player += r.player.mean;
  b.pDark += r.player.dark;
  b.foe += r.foe.mean;
  b.foeRel += ref ? r.foe.mean / ref.mean : NaN;
  b.foeDark += ref ? r.foe.dark - ref.dark : NaN;
  b.pEdge += r.player.edge;
  b.fEdge += r.foe.edge;
  b.errors += r.errors.length;
  b.fail += r.fail.length ? 1 : 0;
  if (r.off) {
    b.offMean += r.off.all.mean;
    b.offN++;
  }
}
for (const b of Object.values(byStage)) for (const k of ['mean', 'p10', 'player', 'pDark', 'foe', 'foeRel', 'foeDark', 'pEdge', 'fEdge']) b[k] /= b.n;
const prev = baseJson ? JSON.parse(fs.readFileSync(baseJson, 'utf8')) : null;
const prevStage = {};
if (prev) for (const r of prev) (prevStage[r.stage] ??= []).push(r.all.mean);
console.log('\n스테이지    둘다평균 하위10% | 주인공 검은 윤곽 | 상대 (포세이돈 대비) 검은(차이) 윤곽 |  판정   에러' + (prev ? '   이전 결과 대비' : '') + '   같은 장면 조명 끔 대비');
for (const [s, b] of Object.entries(byStage)) {
  let cmp = '';
  if (prevStage[s]) {
    const pm = prevStage[s].reduce((a, v) => a + v, 0) / prevStage[s].length;
    cmp = `   ×${(b.mean / pm).toFixed(2)} (${pm.toFixed(1)} → ${b.mean.toFixed(1)})`;
  }
  if (b.offN) cmp += `   ×${(b.mean / (b.offMean / b.offN)).toFixed(3)}`;
  const sgn = (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(0)}%p`;
  console.log(
    `${s.padEnd(10)} ${b.mean.toFixed(1).padStart(7)} ${b.p10.toFixed(1).padStart(6)} | ${b.player.toFixed(1).padStart(6)} ${pctS(b.pDark).padStart(4)} ${pctS(b.pEdge).padStart(4)} | ${b.foe.toFixed(1).padStart(5)} (×${b.foeRel.toFixed(2)}) ${sgn(b.foeDark).padStart(9)} ${pctS(b.fEdge).padStart(4)} | ${b.fail ? `미달 ${b.fail}` : '통과  '} ${String(b.errors).padStart(5)}${cmp}`,
  );
}
console.log(
  `기준 (상대마다 모두): 주인공 평균 ≥ ${GATE.player.mean}, 하위10% ≥ ${GATE.player.p10}, 검은(Y<24) ≤ ${pctS(GATE.player.dark)}; ` +
    `상대는 같은 상대의 포세이돈 값에 견줘 평균 ≥ ${GATE.foe.mean}배, 하위10% ≥ min(${GATE.foe.p10Max}, ${GATE.foe.p10}배), 검은 ≤ +${pctS(GATE.foe.dark)}p; 윤곽 ≥ ${pctS(GATE.edge)} (둘 다)`,
);
const errs = results.flatMap((r) => r.errors.map((e) => `${r.stage}/${r.foeId}: ${e}`));
console.log(errs.length ? '\nERRORS:\n' + errs.join('\n') : '\n콘솔 에러 0');
console.log(`그림·결과: ${OUT}/`);

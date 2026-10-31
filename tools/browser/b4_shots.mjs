// B4 (이베리아 특수 공격 — 길게 눌러 메었다 떼어 내려침) 다시 짠 꼴 그림 (사장님 10/31 19:xx '칼을 더 들어올리거나 아예 어깨에 얹거나. 그리고 칼 끝이 머리 뒤로 넘어와서 땅쪽으로 기울어 있어야 해' —
//  기록 docs/strike/b4_rework_2026-10-31.md). 읽기만 — 게임 값은 주소로만(옛 판 EXTRA='&b4Old=1').
//  실제 빌드(npx vite build → dist/ · 정적 서버)에서 츠바이핸더 · 상대 롱소드(AI 멈춤) · `?skillNodes=B1,B5,B4`(익힌 칸 — 개발 인자) · 길게 누름은 손가락 대신 사람 강화 holdInput 을 눌린 채로(게임 길 그대로 ·
//  손가락 떠돎 없음) → 정한 때마다 화면 시계를 거의 세우고 세 눈으로 찍음: 옆(칼 든 쪽에서 몸에 곧게) · 뒤(등 뒤 조금 칼 든 쪽 위) · 게임 카메라(그대로) →
//  눈마다 띠 그림 한 장(.webp — 브라우저 canvas 로 줄여 저장)과 찍은 값(_shots_<꼬리>.json).
//  실행 (저장소 뿌리): npx vite build && npx http-server dist -p 5391 -s &  ·  node tools/browser/b4_shots.mjs http://127.0.0.1:5391 <그림 폴더> <꼬리 (new | old)>
//   환경: EXTRA(주소 덧붙임 — 예 &b4Old=1 · &rdTajoAngle=60) · WEAPON(기본 zweihander) · PW_CHROMIUM · LOAD_JSON(메기 자리 rdLoad 칸을 덮음 — 예 '{"hand":[0.12,0.16,0.26],"blade":[-32,190]}' · 견줌용)
//   덧붙여 '멘 채 0.9 s' 한 장의 옆 · 뒤를 크게 b4_<꼬리>_loaded.webp 로 (메기 자세 전 · 후 견줌 — 사장님 10/31 19:xx '칼이 어깨를 파고드는 것처럼 보여')
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // 미리 깔린 playwright (전역 — NODE_PATH)

const base = process.argv[2] || 'http://127.0.0.1:5391';
const dir = process.argv[3] || 'docs/handoff/b4_rework_2026-10-31';
const tag = process.argv[4] || 'new';
const EXTRA = process.env.EXTRA || '';
const WEAPON = process.env.WEAPON || 'zweihander';
const W = 844, H = 390;
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const clockInit = () => {
  const raf = window.requestAnimationFrame.bind(window);
  const pn = performance.now.bind(performance);
  let last = pn(), acc = last;
  window.__timeK = 1;
  const clock = () => { const t = pn(); acc += (t - last) * window.__timeK; last = t; return acc; };
  performance.now = clock;
  window.requestAnimationFrame = (cb) => raf(() => cb(clock()));
};
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
await ctx.addInitScript(clockInit);
if (process.env.LOAD_JSON) await ctx.addInitScript((j) => { window.__loadJson = j; }, process.env.LOAD_JSON);
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`${base}/?weapon=${WEAPON}&foeWeapon=longsword&skillNodes=B1,B5,B4&slowMo=0&camOpen=old${EXTRA}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 180000 });
await page.evaluate((gap) => { game.config.ARENA.startGap = gap; game.config.ARENA.startHold = 0; }, +(process.env.GAP || 1.9));
await page.getByText('여정 시작', { exact: true }).click();
await page.waitForFunction(() => window.game?.state === 'fight' && window.game?.playerUnique, null, { timeout: 180000 });
await page.waitForFunction(() => window.game?.stats?.simTime > 4.0, null, { timeout: 300000 }); // 판 처음 상대 소개 글이 지나간 뒤
const kit = await page.evaluate(() => {
  const g = window.game;
  g.ai.update = () => g.enemy.move.set(0, 0);
  if (g.playerSecret) { g.playerSecret.update = () => {}; g.playerSecret.open = null; }
  const uq = g.playerUnique;
  const orig = uq.holdInput.bind(uq);
  window.__hold = null;
  uq.holdInput = (d, s, so) => orig(window.__hold ?? d, window.__hold ? true : s, so); // 길게 누름 = 끌지 않은 손가락 (main.js 가 프레임마다 부름)
  const C = g.config;
  if (window.__loadJson) C.UNIQUE_ASSIST.rdLoad = { ...C.UNIQUE_ASSIST.rdLoad, ...JSON.parse(window.__loadJson) }; // 견줌: 메기 자리 덮음 (감기 시작 때 읽음)
  return { holdE: uq.holdE?.name ?? null, load: C.UNIQUE_ASSIST.rdLoad, mode: C.UNIQUE_ASSIST.rdWindMode, release: C.UNIQUE_ASSIST.rdRelease, tajo: C.UNIQUE_ASSIST.rdTajo, chain: C.IB_FLOW.windmillChain, apart: C.IB_FLOW.windmillApart };
});
console.log('kit', JSON.stringify(kit));
if (kit.holdE !== 'redondo') throw Error('B4 없음');

// 몸 틀 칼끝 · 손 (가슴 원점 · x 앞 · y 위 · z 칼 든 쪽 +)
const poseOf = () => {
  const g = window.game, f = g.player;
  const c = f.bodies.chest.translation();
  const q = f.yaw.clone().invert();
  const s = f.side >= 0 ? 1 : -1;
  const V3 = g.THREE.Vector3;
  const loc = (p) => { const v = new V3(p.x - c.x, p.y - c.y, p.z - c.z).applyQuaternion(q); return [+v.x.toFixed(2), +v.y.toFixed(2), +(s * v.z).toFixed(2)]; };
  const W = f.rdWind, I = f.iai;
  return { tip: loc(f.bladePoint(1, new V3())), hand: loc(f.sword.translation()), wind: W ? { t: +W.t.toFixed(2), k: +W.k.toFixed(2), kind: W.M.name ?? W.M.kind } : null, iai: I ? { seg: I.si, cut: !!I.segs?.[I.si]?.cut } : null, state: f.state, dist: +f.foeDistance().toFixed(2) };
};
// 눈: side = 칼 든 쪽에서 몸에 곧게 · back = 등 뒤 (조금 칼 든 쪽 · 위) · game = 게임 카메라
const VIEWS = ['side', 'back', 'game'];
const setView = (v) => {
  const g = window.game, f = g.player, V3 = g.THREE.Vector3;
  if (v === 'game') { g.freeCam = false; return null; }
  g.freeCam = true;
  const c = f.bodies.chest.translation();
  const C = new V3(c.x, c.y + 0.05, c.z);
  const e = g.enemy.bodies.chest.translation();
  const fw = new V3(e.x - c.x, 0, e.z - c.z).normalize(); // 앞 = 상대 쪽 (몸 방향 yaw 는 브라우저에서 끌고 가는 칼 동안 다른 틀일 수 있어 상대 쪽으로)
  const sd = new V3(-fw.z, 0, fw.x).multiplyScalar(f.side >= 0 ? 1 : -1); // 칼 든 쪽
  const eye = v === 'side' ? C.clone().addScaledVector(sd, 3.4).addScaledVector(fw, 0.25).add(new V3(0, 0.15, 0)) : C.clone().addScaledVector(fw, -3.2).addScaledVector(sd, 0.9).add(new V3(0, 0.55, 0));
  g.camera.position.copy(eye);
  g.camera.lookAt(C.clone().addScaledVector(fw, v === 'side' ? 0.25 : 0.3));
  g.camera.updateMatrixWorld();
  return null;
};
// 그림 속 내 몸 자리 (자를 가운데 — 가슴 화면 x)
const chestPx = () => {
  const g = window.game, f = g.player, V3 = g.THREE.Vector3;
  const c = f.bodies.chest.translation();
  const p = new V3(c.x, c.y, c.z).project(g.camera);
  return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight };
};
const frames = [];
async function shoot(label) {
  await page.evaluate(() => { window.__k0 = window.__timeK; window.__timeK = 0.0005; });
  const pose = await page.evaluate(poseOf);
  const shots = {};
  for (const v of VIEWS) {
    await page.evaluate(setView, v);
    // 화면은 물리 스텝이 돈 프레임에만 다시 그려짐 — 시계를 잠깐 조금 흘려(물리 한두 스텝 · 약 0.01 게임 초) 바꾼 눈으로 두 번 넘게 그릴 때까지 기다림 (renderInfo frame)
    const f0 = await page.evaluate(() => window.game.renderInfo().frame);
    await page.evaluate(() => { window.__timeK = 0.012; });
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(100);
      await page.evaluate(setView, v);
      if ((await page.evaluate(() => window.game.renderInfo().frame)) >= f0 + 3) break;
    }
    await page.evaluate(() => { window.__timeK = 0.0005; });
    const cp = await page.evaluate(chestPx);
    const buf = await page.screenshot({ timeout: 180000 });
    shots[v] = { png: buf.toString('base64'), cx: cp.x, cy: cp.y };
  }
  await page.evaluate(() => { window.game.freeCam = false; window.__timeK = window.__k0; });
  console.log(`  SHOT ${label} ${JSON.stringify(pose)}`);
  frames.push({ label, pose, shots });
}
const simT = () => page.evaluate(() => game.stats.simTime);
const waitSim = (t) => page.waitForFunction((x) => game.stats.simTime >= x, t, { timeout: 180000, polling: 'raf' });
const K = await page.evaluate(() => game.config.TIME.k);
await page.evaluate(() => (window.__timeK = 0.15));
await shoot('자세');
await page.evaluate(() => (window.__hold = true));
const g0 = await simT();
for (const [lab, w] of [['메는 중 0.3 s', 0.6 + 0.3], ['멘 채 0.4 s', 0.6 + 0.6 + 0.4], ['멘 채 0.9 s', 0.6 + 0.6 + 0.9]]) {
  await waitSim(g0 + w * K);
  await shoot(lab);
}
await page.evaluate(() => (window.__hold = false));
const r0 = await simT();
const RELT = (process.env.RELT || '0.05,0.12,0.2,0.3,0.42').split(',').map(Number); // 뗀 뒤 찍는 때 (실제 초 — 드는 몫 × 1 이면 0.06,0.15,0.25,0.36,0.48)
for (const [lab, w] of RELT.map((x, i) => [i ? `${x} s` : `뗀 뒤 ${x} s`, x])) {
  await waitSim(r0 + w * K);
  await shoot(lab);
}
const st = await page.evaluate(() => ({ fired: game.playerUnique.stats.fired?.redondo ?? 0, winds: game.playerUnique.stats.winds ?? 0, refused: game.playerUnique.stats.holdRefused ?? 0, cancel: game.playerUnique.stats.windCancel ?? {}, res: game.player.instantResult ? { hits: game.player.instantResult.hits, zone: game.player.instantResult.zone } : null }));
console.log('result', JSON.stringify(st));

// 띠 그림 (눈마다 · 낱장 가로로 · 몸 둘레를 잘라 줄여 .webp)
const strip = await ctx.newPage();
await strip.setContent('<canvas id="c"></canvas>');
for (const v of VIEWS) {
  const cw = v === 'game' ? 300 : 260, ch = v === 'game' ? 330 : 360, sc = 0.62;
  const tiles = frames.map((f) => ({ src: 'data:image/png;base64,' + f.shots[v].png, cx: f.shots[v].cx, cy: f.shots[v].cy, label: f.label }));
  const data = await strip.evaluate(async ({ tiles, cw, ch, sc, title }) => {
    const imgs = await Promise.all(tiles.map((t) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = t.src; })));
    const tw = Math.round(cw * sc), th = Math.round(ch * sc), head = 18;
    const c = document.getElementById('c');
    c.width = tw * tiles.length; c.height = th + head;
    const g = c.getContext('2d');
    g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
    tiles.forEach((t, i) => {
      const sx = Math.max(0, Math.min(imgs[i].width - cw, t.cx - cw / 2));
      const sy = Math.max(0, Math.min(imgs[i].height - ch, t.cy - ch * 0.55));
      g.drawImage(imgs[i], sx, sy, cw, ch, i * tw, head, tw, th);
      g.fillStyle = '#eee'; g.font = '12px sans-serif'; g.fillText(t.label, i * tw + 4, 13);
      g.strokeStyle = '#444'; g.strokeRect(i * tw + 0.5, head + 0.5, tw - 1, th - 1);
    });
    g.fillStyle = '#ffd36b'; g.font = 'bold 12px sans-serif'; g.fillText(title, c.width - 90, 13);
    return c.toDataURL('image/webp', 0.78);
  }, { tiles, cw, ch, sc, title: `${tag} · ${v}` });
  const file = `${dir}/b4_${tag}_${v}.webp`;
  fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
  console.log('WROTE', file, fs.statSync(file).size);
}
// 메기 자세 한 장 (옆 · 뒤 — 크게)
{
  const f = frames.find((x) => x.label === '멘 채 0.9 s');
  const data = await strip.evaluate(async ({ tiles, title }) => {
    const imgs = await Promise.all(tiles.map((t) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = t.src; })));
    const cw = 300, ch = 360, sc = 0.9, tw = Math.round(cw * sc), th = Math.round(ch * sc), head = 18;
    const c = document.getElementById('c');
    c.width = tw * tiles.length; c.height = th + head;
    const g = c.getContext('2d');
    g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
    tiles.forEach((t, i) => {
      const sx = Math.max(0, Math.min(imgs[i].width - cw, t.cx - cw / 2));
      const sy = Math.max(0, Math.min(imgs[i].height - ch, t.cy - ch * 0.5));
      g.drawImage(imgs[i], sx, sy, cw, ch, i * tw, head, tw, th);
      g.fillStyle = '#eee'; g.font = '12px sans-serif'; g.fillText(t.label, i * tw + 4, 13);
    });
    g.fillStyle = '#ffd36b'; g.font = 'bold 12px sans-serif'; g.fillText(title, c.width - 120, 13);
    return c.toDataURL('image/webp', 0.8);
  }, { tiles: ['side', 'back'].map((v) => ({ src: 'data:image/png;base64,' + f.shots[v].png, cx: f.shots[v].cx, cy: f.shots[v].cy, label: v === 'side' ? '옆 (칼 든 쪽)' : '뒤' })), title: `${tag} · 멘 채` });
  const file = `${dir}/b4_${tag}_loaded.webp`;
  fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
  console.log('WROTE', file, fs.statSync(file).size);
}
fs.writeFileSync(`${dir}/_shots_${tag}.json`, JSON.stringify({ tag, url: `?weapon=${WEAPON}&foeWeapon=longsword&skillNodes=B1,B5,B4${EXTRA}`, kit, st, frames: frames.map((f) => ({ label: f.label, pose: f.pose })), errors }, null, 1));
await browser.close();
if (errors.length) console.log(`콘솔 에러 ${errors.length}:\n${errors.slice(0, 10).join('\n')}`);

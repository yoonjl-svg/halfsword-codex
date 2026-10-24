// 드루이드의 채찍 브라우저 연속 그림 (10/23 — docs/import/druid_whip_2026-10-23.md). 게임 코드는 읽기만.
//  테스트 경로로 채찍을 들고(상대 AI 멈춤 · 상대 칼 충돌 끔 — 그림용 과녁), 쉬는 자세 한 장 → CDP 터치 긋기(내려 긋기 · 가로 긋기)와 톡(찌르기)을
//  화면 시계를 늦춰(requestAnimationFrame 시각을 __timeK 배 — 게임 코드는 그대로) 긋기 시작부터 정한 게임 시각마다 찍는다.
//  낱장은 띠 그림(JPEG — 저장소 크기)으로 묶고(파이썬 PIL) 지운다. 같은 획을 `?whip=src`(샛별 값)와 지금 값으로 한 번씩.
//  실행 (저장소 뿌리에서): npx vite --port 5394 --strictPort &
//        node tools/browser/druid_whip_shots.mjs http://127.0.0.1:5394 [그림 폴더 (기본 docs/handoff/druid_whip)] [판 'src,now' · 'pass' = 상대 칼이 손 쪽 덩굴을 지나가는 모습(맞닿는 간격 · 위에서 · 마디별 칼 닿음 스텝) · 'card' = 카드 앞면 (?cards=druid_whip,longsword — 화면 셋 · 글 넘침 · 등급 글자) · 'sound' = 채찍 녹음이 읽혔나 · 긋기 · 톡에 휙 · 딱 · 맞음 소리가 불렸나 · 무릎 꿇리기 (10/23)]
//  끝 코드 0 = 콘솔 에러 0. 소프트웨어 GL 이라 느리다(판마다 1 ~ 3 분)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const base = (process.argv[2] || 'http://127.0.0.1:5394').replace(/\/$/, '');
const dir = process.argv[3] || 'docs/handoff/druid_whip';
const presets = (process.argv[4] || 'src,now').split(',');
const TIMES = [0, 0.08, 0.16, 0.24, 0.34, 0.5]; // 긋기 시작에서 게임 시각 (s)
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const W = 844, H = 390;
const errors = [];
const report = {};
for (const preset of presets) {
  if (preset === 'sound') {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.addInitScript(() => (window.__gap = 1.55));
    page.on('pageerror', (e) => errors.push(`sound pageerror ${e}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`sound console ${m.text()}`));
    page.on('response', (r) => r.status() >= 400 && errors.push(`sound http ${r.status()} ${r.url()}`));
    await page.goto(`${base}/?test=1&weapon=druid_whip&hero=player&foe=isolde&stage=castle&slowMo=0`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
    const start = page.getByText('여정 시작');
    if (await start.count()) await start.first().click(); else await page.tap('#btnStart');
    await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 120000 });
    await page.waitForFunction(() => window.game.stats.simTime > 2.6, null, { timeout: 400000 });
    await page.evaluate(() => {
      const g = window.game, p = g.player, e = g.enemy;
      g.ai.update = () => e.move.set(0, 0);
      const pc = p.bodies.chest.translation(), ec = e.bodies.chest.translation(), fw0 = p.forward();
      const dx = pc.x + fw0.x * window.__gap - ec.x, dz = pc.z + fw0.z * window.__gap - ec.z;
      for (const { rb } of e.meshes) { const t = rb.translation(); rb.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true); }
      const at = e.anchor.translation(); e.anchor.setTranslation({ x: at.x + dx, y: at.y, z: at.z + dz }, true);
      if (e.gait) for (const k of ['F', 'B']) { const l = e.gait.legs[k]; for (const key of ['plant', 'hip', 'ankle', 'p0', 'p1', 'des', 'fp', 'pinC', 'pinT']) if (l[key]) { l[key].x += dx; l[key].z += dz; } }
      const s = g.sound, calls = (window.__whipCalls = { swish: 0, crack: 0, hit: 0, armor: 0, clash: 0 });
      const w0 = s.whip.bind(s);
      s.whip = (kind, x, armor) => { calls[kind === 'hit' && armor ? 'armor' : kind]++; return w0(kind, x, armor); };
    });
    const cdp = await ctx.newCDPSession(page);
    const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const sim = () => page.evaluate(() => window.game.stats.simTime);
    const waitTo = (t) => page.waitForFunction((x) => window.game.stats.simTime >= x, t, { timeout: 400000, polling: 16 });
    for (let k = 0; k < 6; k++) {
      if (k % 2) { await page.touchscreen.tap(0.72 * W, 0.45 * H); }
      else {
        await touch('touchStart', 0.6 * W, 0.85 * H);
        for (let i = 1; i <= 6; i++) { await touch('touchMove', (0.6 + 0.22 * i / 6) * W, (0.85 - 0.7 * i / 6) * H); await page.waitForTimeout(40); }
        for (let i = 1; i <= 6; i++) { await touch('touchMove', (0.82 - 0.3 * i / 6) * W, (0.15 + 0.65 * i / 6) * H); await page.waitForTimeout(20); }
        await touch('touchEnd');
      }
      await waitTo((await sim()) + 1.4);
    }
    report.sound = await page.evaluate(() => {
      const g = window.game, s = g.sound;
      const loaded = Object.fromEntries(['whipSwish', 'whipCrack', 'whipHit', 'whipArmor', 'whipClash'].map((k) => [k, s.samples?.[k]?.length ?? 0]));
      return { loaded, calls: window.__whipCalls, kneels: (g.combat.whipKneelLog ?? []).map((x) => `${x.part}:${x.hit ? '꿇음' : '버팀'}`), hits: g.enemy.wounds?.length ?? null, strokes: g.player.flexWeapon?.strokes };
    });
    const expectedWhipSamples = { whipSwish: 4, whipCrack: 3, whipHit: 1, whipArmor: 3, whipClash: 3 };
    if (Object.entries(expectedWhipSamples).some(([k, n]) => report.sound.loaded[k] !== n)) errors.push(`채찍 녹음 못 읽음 ${JSON.stringify(report.sound.loaded)}`);
    await ctx.close();
    continue;
  }
  if (preset === 'card') {
    for (const [w, h] of [[844, 390], [568, 320], [1280, 800]]) {
      const touch = w < 1000;
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
      page.on('pageerror', (e) => errors.push(`card pageerror ${e}`));
      page.on('console', (m) => m.type() === 'error' && errors.push(`card console ${m.text()}`));
      await page.goto(`${base}/?stage=castle&foe=isolde&cards=druid_whip,longsword`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
      if (touch) await page.tap('#btnStart'); else await page.click('#btnStart');
      await page.waitForFunction(() => window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6, null, { timeout: 120000 });
      await page.evaluate(() => document.querySelector('#draw .wcard').click());
      await page.waitForFunction(() => window.game.draw.t > 1.35 || window.game.state === 'fight', null, { timeout: 180000, polling: 50 });
      await page.evaluate(() => { window.game.draw.hold = true; });
      const c = await page.evaluate(() => {
        const card = document.querySelector('#draw .wcard'), f = card.querySelector('.wface').getBoundingClientRect(), d = card.querySelector('.wdesc').getBoundingClientRect();
        return { name: card.querySelector('.wname').textContent, tier: card.querySelector('.wtier').textContent, desc: card.querySelector('.wdesc').textContent, overflow: d.bottom > f.bottom + 0.5 || d.right > f.right + 0.5 };
      });
      report[`card_${w}x${h}`] = c;
      if (!c.name.includes('드루이드의 채찍') || c.tier !== '???' || c.overflow) errors.push(`card ${w}x${h} ${JSON.stringify(c)}`);
      if (w === 844) { await page.screenshot({ path: `${dir}/_card.png` }); execFileSync('python3', ['-I', '-c', "import sys\nfrom PIL import Image\nImage.open(sys.argv[1]).convert('RGB').save(sys.argv[2], quality=72)", `${dir}/_card.png`, `${dir}/card_844x390.jpg`]); fs.rmSync(`${dir}/_card.png`); }
      await page.close();
    }
    continue;
  }
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    const pn = performance.now.bind(performance);
    let last = pn(), acc = last;
    window.__timeK = 1;
    const clock = () => { const t = pn(); acc += (t - last) * window.__timeK; last = t; return acc; };
    performance.now = clock;
    window.requestAnimationFrame = (cb) => raf(() => cb(clock()));
  });
  const page = await ctx.newPage();
  const PASS = preset === 'pass'; // 'pass' = 상대 칼이 손 쪽 덩굴을 지나가는 모습 (10/23 넷째 일): 맞닿는 간격 1.25 m · 상대 칼 충돌 켬 · 칼을 앞으로 겨눔 · 위에서 봄 · 가로 긋기 둘
  await page.addInitScript(([gap, pass]) => { window.__gap = gap; window.__pass = pass; }, [PASS ? 1.25 : 1.7, PASS]);
  page.on('pageerror', (e) => errors.push(`${preset} pageerror ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${preset} console ${m.text()}`));
  await page.goto(`${base}/?test=1&weapon=druid_whip&hero=player&foe=isolde&stage=castle&slowMo=0${preset === 'src' ? '&whip=src' : ''}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
  const start = page.getByText('여정 시작');
  if (await start.count()) await start.first().click();
  else await page.tap('#btnStart');
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 120000 });
  await page.addStyleTag({ content: '#toast, #foeIntro, canvas:not(#game) { opacity: 0 !important; }' }); // 판 알림 · 손가락 흔적은 그림에서만 감춤
  await page.waitForFunction(() => window.game.stats.simTime > 2.6, null, { timeout: 400000 });
  await page.evaluate(() => {
    const g = window.game;
    g.settings.fpsCap = false;
    g.ai.update = () => g.enemy.move.set(0, 0);
    if (window.__pass) g.enemy.handOffset.set(0.05, 0.05); // 칼을 가슴 높이로 겨눠 덩굴 길 한가운데에 둔다 (충돌은 그대로)
    else {
      g.enemy.handOffset.set(0, -0.5);
      for (let i = 0; i < g.enemy.sword.numColliders(); i++) g.enemy.sword.collider(i).setCollisionGroups(0);
    }
    const p = g.player, e = g.enemy;
    // 상대를 내 앞 가슴 거리 GAP 자리로 (멈춘 상대 — 몸 · 닻 · 걸음 딛은 자리를 함께 평행 이동, iberian_spin_shots.mjs 와 같은 칸)
    const pc = p.bodies.chest.translation(), ec = e.bodies.chest.translation(), fw0 = p.forward();
    const dx = pc.x + fw0.x * window.__gap - ec.x, dz = pc.z + fw0.z * window.__gap - ec.z;
    for (const { rb } of e.meshes) { const t = rb.translation(); rb.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true); }
    const at = e.anchor.translation();
    e.anchor.setTranslation({ x: at.x + dx, y: at.y, z: at.z + dz }, true);
    if (e.gait) for (const k of ['F', 'B']) { const l = e.gait.legs[k]; for (const key of ['plant', 'hip', 'ankle', 'p0', 'p1', 'des', 'fp', 'pinC', 'pinT']) if (l[key]) { l[key].x += dx; l[key].z += dz; } }
    // 옆 카메라 (고정): 칼 든 쪽 옆 · 조금 앞 · 가슴보다 조금 위에서 나와 상대 사이를 본다
    const rg = p.right();
    g.freeCam = true;
    if (window.__pass) { g.camera.position.set(pc.x + fw0.x * 0.6 + rg.x * 0.45, 2.35, pc.z + fw0.z * 0.6 + rg.z * 0.45); g.camera.lookAt(pc.x + fw0.x * 0.62, 1.05, pc.z + fw0.z * 0.62); }
    else { g.camera.position.set(pc.x + fw0.x * 0.8 + rg.x * 2.5, 1.45, pc.z + fw0.z * 0.8 + rg.z * 2.5); g.camera.lookAt(pc.x + fw0.x * 0.8, 1.0, pc.z + fw0.z * 0.8); }
    const rec = (window.__rec = { tip: 0, n: 0, ground: 0, maxTipFwd: 0, segs: p.flexWeapon?.segments.length ?? 0, segBlade: Array(p.flexWeapon?.segments.length ?? 0).fill(0) });
    const eCols = Array.from({ length: e.sword.numColliders() }, (_, i) => e.sword.collider(i));
    const step0 = p.step.bind(p);
    p.step = (dt) => {
      step0(dt);
      const t = p.bladePoint(1), c = p.bodies.chest.translation(), fw = p.forward();
      rec.n++;
      rec.tip = Math.max(rec.tip, p.tipVel.length());
      rec.maxTipFwd = Math.max(rec.maxTipFwd, (t.x - c.x) * fw.x + (t.z - c.z) * fw.z);
      if (p.flexWeapon?.segments.some((s) => s.body.translation().y < 0.05)) rec.ground++;
      // 마디마다 상대 칼과 실제로 맞닿은 스텝 수 (손 쪽 마디가 지나가는지)
      p.flexWeapon?.segments.forEach((sg, j) => { for (const c of eCols) g.world.contactPair(sg.col, c, (m) => { if (m.numSolverContacts() > 0) rec.segBlade[j]++; }); });
    };
  });
  const sim = () => page.evaluate(() => window.game.stats.simTime);
  const waitTo = (t) => page.waitForFunction((x) => window.game.stats.simTime >= x, t, { timeout: 400000, polling: 16 });
  const cdp = await ctx.newCDPSession(page);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const shots = [];
  const shot = async (name) => { const p = `${dir}/_${preset}_${name}.png`; await page.screenshot({ path: p }); shots.push(p); return p; };
  await waitTo((await sim()) + 0.8);
  report[preset] = { rest: await page.evaluate(() => { const p = window.game.player; return { tipY: +p.bladePoint(1).y.toFixed(2), low: +Math.min(...p.flexWeapon.segments.map((s) => s.body.translation().y)).toFixed(2) }; }) };
  const rest = await shot('rest');
  // 획: [이름, 감기 시작 → 긋기 시작 → 끝 (화면 비율), 긋기 ms]
  const strokes = PASS ? [
    ['across', [0.55, 0.5], [0.9, 0.5], [0.35, 0.5], 150],
    ['across2', [0.55, 0.42], [0.9, 0.4], [0.3, 0.44], 120],
  ] : [
    ['down', [0.6, 0.85], [0.82, 0.15], [0.52, 0.8], 120],
    ['across', [0.55, 0.45], [0.88, 0.42], [0.5, 0.42], 120],
  ];
  const strips = { rest };
  for (const [name, w0, a, b, ms] of strokes) {
    // 감기: 손가락을 대고 긋기 시작 자리로 천천히 (보통 빠르기)
    await touch('touchStart', w0[0] * W, w0[1] * H);
    for (let i = 1; i <= 8; i++) { const u = i / 8; await touch('touchMove', (w0[0] + (a[0] - w0[0]) * u) * W, (w0[1] + (a[1] - w0[1]) * u) * H); await page.waitForTimeout(30); }
    await waitTo((await sim()) + 0.35);
    await page.evaluate(() => (window.__timeK = 0.12));
    const t0 = await sim();
    const n = 6;
    for (let i = 1; i <= n; i++) { const u = i / n; await touch('touchMove', (a[0] + (b[0] - a[0]) * u) * W, (a[1] + (b[1] - a[1]) * u) * H); await page.waitForTimeout(ms / 0.12 / n); }
    await touch('touchEnd');
    const frames = [];
    for (const dt of PASS ? [0, 0.05, 0.1, 0.15, 0.2, 0.3] : TIMES) { await waitTo(t0 + dt); frames.push(await shot(`${name}_${dt}`)); }
    await page.evaluate(() => (window.__timeK = 1));
    strips[name] = frames;
    await waitTo((await sim()) + 1.2);
  }
  // 톡 (찌르기)
  if (!PASS) {
    await page.evaluate(() => (window.__timeK = 0.12));
    const t1 = await sim();
    await page.touchscreen.tap(0.72 * W, 0.45 * H);
    const tf = [];
    for (const dt of TIMES) { await waitTo(t1 + dt); tf.push(await shot(`tap_${dt}`)); }
    await page.evaluate(() => (window.__timeK = 1));
    strips.tap = tf;
  }
  strips.order = PASS ? ['across', 'across2'] : ['down', 'across', 'tap'];
  strips.big = PASS;
  report[preset].rec = await page.evaluate(() => window.__rec);
  // 띠 그림: 획마다 한 줄 (쉬는 자세는 첫 칸 앞에)
  const py = `
import sys, json
from PIL import Image
spec = json.loads(sys.argv[1]); out = sys.argv[2]
rows = [spec[k] for k in spec['order']]
big = spec.get('big')
w, h = (420, 270) if big else (300, 240)
def cut(p):
    im = Image.open(p).convert('RGB')
    W, H = im.size
    box = (int(W * 0.15), int(H * 0.04), int(W * 0.85), int(H * 0.96)) if big else (int(W * 0.22), int(H * 0.08), int(W * 0.78), int(H * 0.98))
    return im.crop(box).resize((w, h))
img = Image.new('RGB', (w * (1 + len(rows[0])), h * len(rows)), (0, 0, 0))
r0 = cut(spec['rest'])
for y, row in enumerate(rows):
    img.paste(r0, (0, y * h))
    for x, p in enumerate(row):
        img.paste(cut(p), ((x + 1) * w, y * h))
img.save(out, quality=70)
`;
  execFileSync('python3', ['-I', '-c', py, JSON.stringify(strips), `${dir}/whip_${preset}.jpg`]);
  for (const p of shots) fs.rmSync(p, { force: true });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(report));
console.log(errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : '콘솔 오류 0');
process.exit(errors.length ? 1 : 0);

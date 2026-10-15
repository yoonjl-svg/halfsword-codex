// 기력 브라우저 확인 — 테스트 경로 (10/15 기력 들여옴, docs/strike/stamina_import_2026-10-15.md §7)
//  실제 게임(테스트 경로 · 롱소드 · 성 안뜰 · 9/30 판 시작 openSweep=0)에서 손가락 끌기(터치 포인터 사건)로 쉬지 않고 베어
//  기력 0 아래(빚) → −30 아래 → 탈진까지 가는 동안 머리 위 막대(가득 · 빚 깜빡임 · 탈진 회복 진행)와 탈진 자세(제자리 숨 고르기 — W 를 눌러도 안 걷고,
//  톡(찌르기)·막기 단추(F)가 안 들음)를 읽고 찍는다. 상대 AI 탈진(머리 위 막대 · 멈춤)도 한 번. 이어서 `&stamina=0` 이면 막대가 없고 기력이 그대로인지.
//  상대는 판단을 멈추고(제자리) 둘 다 상처를 끈다(몸·칼 물리 그대로) — 시험만. 사진은 출력 폴더에만(저장소에 넣지 않음). 콘솔·페이지 오류를 센다.
//  실행: npx vite --config <자기 설정 — 자기 포트(5190 이상)·자기 캐시 폴더> & → node tools/browser/stamina_route_probe.mjs http://127.0.0.1:<포트> <출력 폴더>
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:5193';
const dir = process.argv[3] || '.';
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const out = { on: {}, off: {} };

async function open(extra = '') {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`);
  });
  await page.goto(`${base}/index.html?test=1&weapon=longsword&hero=player&foe=isolde&stage=castle&openSweep=0${extra}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword && document.getElementById('btnStart'), null, { timeout: 180000 });
  await page.evaluate(() => document.getElementById('btnStart').click());
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 180000 });
  await page.waitForFunction(() => window.game.stats.simTime > 2.4 && !window.game.player.feetHeld, null, { timeout: 180000 });
  await page.evaluate(() => {
    const g = window.game;
    g.player.applyWound = () => {};
    g.enemy.applyWound = () => {};
    g._aiUpdate = g.ai.update.bind(g.ai);
    g.ai.update = () => g.enemy.move.set(0, 0); // 상대 제자리 (판단 멈춤)
    document.getElementById('hint')?.classList.remove('show');
  });
  return page;
}
const bars = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.stamina-bar')].map((el) => ({ hidden: el.hidden, full: el.dataset.full, level: el.dataset.level, exhausted: el.dataset.exhausted, value: el.getAttribute('aria-valuenow'), text: el.getAttribute('aria-valuetext'), opacity: +getComputedStyle(el).opacity, fill: el.firstElementChild?.style.transform })),
  );
const st = (page) =>
  page.evaluate(() => {
    const s = window.game.player.stamina;
    const p = window.game.player.bodies.pelvis.translation();
    return { t: +window.game.stats.simTime.toFixed(3), value: +s.value.toFixed(2), level: s.level, exhausted: s.exhausted, left: +s.exhaustLeft.toFixed(3), cuts: s.counts.cut, thrusts: s.counts.thrust, exhaustions: s.counts.exhaustion, move: window.game.player.move.toArray(), x: p.x, z: p.z, guard: !!window.game.playerGuard?.active, tap: !!window.game.player.skill.tap, guardName: document.getElementById('guardName')?.textContent ?? '' };
  });
/** 화면 오른쪽 절반에서 손가락 하나로 좌우 끌기 한 번 (dir +1 = 오른쪽으로) */
async function swipe(page, dir, id) {
  const y = 200;
  const x0 = dir > 0 ? 560 : 800;
  const x1 = dir > 0 ? 800 : 560;
  await page.evaluate(
    ({ x0, x1, y, id }) => {
      const c = document.getElementById('game');
      const ev = (type, x, target) => target.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true, button: 0 }));
      ev('pointerdown', x0, c);
      window._swipe = { x0, x1, y, id, i: 0 };
    },
    { x0, x1, y, id },
  );
  for (let i = 1; i <= 6; i++) {
    await page.evaluate(
      ({ i }) => {
        const s = window._swipe;
        const x = s.x0 + ((s.x1 - s.x0) * i) / 6;
        window.dispatchEvent(new PointerEvent('pointermove', { pointerId: s.id, pointerType: 'touch', clientX: x, clientY: s.y, bubbles: true, isPrimary: true }));
      },
      { i },
    );
    await page.waitForTimeout(16);
  }
  await page.evaluate(() => {
    const s = window._swipe;
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: s.id, pointerType: 'touch', clientX: s.x1, clientY: s.y, bubbles: true, isPrimary: true, button: 0 }));
  });
}
async function tap(page, id) {
  await page.evaluate((id) => {
    const c = document.getElementById('game');
    const o = { pointerId: id, pointerType: 'touch', clientX: 700, clientY: 170, bubbles: true, isPrimary: true, button: 0 };
    c.dispatchEvent(new PointerEvent('pointerdown', o));
    window.dispatchEvent(new PointerEvent('pointerup', o));
  }, id);
}
/** 옆에서 보는 카메라 (그 몸 옆 3 m · 허리 높이) — 탈진 자세 사진용 */
async function sideCam(page, who) {
  await page.evaluate((who) => {
    const g = window.game;
    const me = g[who];
    const foe = who === 'player' ? g.enemy : g.player;
    const a = foe.bodies.chest.translation();
    const b = me.bodies.pelvis.translation();
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const L = Math.hypot(dx, dz) || 1;
    g.freeCam = true;
    g.camera.position.set(b.x - (dz / L) * 2.6, 1.1, b.z + (dx / L) * 2.6);
    g.camera.lookAt(b.x, 0.9, b.z);
  }, who);
}
async function shot(page, name) {
  await page.screenshot({ path: `${dir}/${name}.png` });
}

// ── 1. 기력 켬 (기본) ──
{
  const page = await open();
  const O = out.on;
  O.full = { bars: await bars(page), st: await st(page) };
  await shot(page, 'route-full');
  // 쉬지 않고 베기: 0.3 s(실제)마다 좌우 끌기 — 0 아래 · −30 아래 · 탈진 시각(게임 시간)
  const t0 = (await st(page)).t;
  let id = 40;
  let dirn = 1;
  O.marks = { zero: null, severe: null, exhaust: null };
  for (let k = 0; k < 120; k++) {
    await swipe(page, dirn, id++);
    dirn = -dirn;
    await page.waitForTimeout(190);
    const s = await st(page);
    if (O.marks.zero == null && s.value <= 0) {
      O.marks.zero = { t: +(s.t - t0).toFixed(3), cuts: s.cuts + s.thrusts };
      // 빚(지침) 깜빡임: 막대 불투명도를 1.6 s 동안 읽음 — 들쭉날쭉이면 깜빡임
      const ops = [];
      for (let i = 0; i < 16; i++) {
        ops.push((await bars(page))[0].opacity);
        await page.waitForTimeout(100);
      }
      O.debtBlink = { min: Math.min(...ops), max: Math.max(...ops), bars: await bars(page) };
      await shot(page, 'route-debt');
    }
    if (O.marks.severe == null && s.level >= 2) O.marks.severe = { t: +(s.t - t0).toFixed(3), cuts: s.cuts + s.thrusts };
    if (s.exhausted) {
      O.marks.exhaust = { t: +(s.t - t0).toFixed(3), cuts: s.cuts + s.thrusts };
      break;
    }
  }
  // 탈진 자세: W·F 를 누른 채 톡 — 게임 시간 1.5 s 동안 안 걷고 · 톡(찌르기)이 안 듣고 · 막기가 안 든다 (헤드리스 그리기가 느려 실제 시간보다 게임 시간이 늦게 흐른다 — 게임 시간으로 기다림)
  const e0 = await st(page);
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyF');
  await tap(page, 90);
  await page.waitForFunction((t) => window.game.stats.simTime >= t || !window.game.player.stamina.exhausted, e0.t + 1.5, { timeout: 120000 });
  const e1 = await st(page);
  await page.waitForFunction(() => document.querySelector('.stamina-bar')?.dataset.exhausted === 'true', null, { timeout: 60000 }).catch(() => {});
  O.exhausted = { before: e0, during: e1, walked: +Math.hypot(e1.x - e0.x, e1.z - e0.z).toFixed(3), pose: await page.evaluate(() => +window.game.player.stamina.pose.toFixed(2)), bars: await bars(page) };
  await shot(page, 'route-exhausted');
  await sideCam(page, 'player');
  await page.waitForTimeout(250);
  await shot(page, 'route-exhausted-side');
  await page.evaluate(() => (window.game.freeCam = false));
  await page.keyboard.up('KeyW');
  await page.keyboard.up('KeyF');
  await page.waitForFunction(() => !window.game.player.stamina.exhausted, null, { timeout: 60000 });
  O.after = { st: await st(page), bars: await bars(page) };
  // 상대(AI) 탈진: 판단을 되살리고 −50 으로 → 머리 위 막대 · 멈춤
  await page.evaluate(() => {
    const g = window.game;
    g.ai.update = g._aiUpdate;
    g.enemy.stamina.spend('attack', 200);
  });
  await page.waitForFunction(() => window.game.enemy.stamina.pose > 0.95 && document.querySelectorAll('.stamina-bar')[1]?.dataset.exhausted === 'true', null, { timeout: 60000 }).catch(() => {});
  const foe = await page.evaluate(() => {
    const E = window.game.enemy;
    return { exhausted: E.stamina.exhausted, move: E.move.toArray(), mode: window.game.ai.mode, pose: +E.stamina.pose.toFixed(2) };
  });
  O.foeExhausted = { foe, bars: await bars(page) };
  await shot(page, 'route-foe-exhausted');
  await sideCam(page, 'enemy');
  await page.waitForTimeout(250);
  await shot(page, 'route-foe-exhausted-side');
  await page.evaluate(() => (window.game.freeCam = false));
  await page.context().close();
}

// ── 2. 기력 끔 (`&stamina=0`) ──
{
  const page = await open('&stamina=0');
  const O = out.off;
  const s0 = await st(page);
  let id = 140;
  let dirn = 1;
  for (let k = 0; k < 20; k++) {
    await swipe(page, dirn, id++);
    dirn = -dirn;
    await page.waitForTimeout(190);
  }
  O.after = { st: await st(page), before: s0, bars: await bars(page), on: await page.evaluate(() => window.game.config.STAMINA.on) };
  await shot(page, 'route-off');
  await page.context().close();
}
await browser.close();
fs.writeFileSync(`${dir}/stamina_route.json`, JSON.stringify({ out, errors }, null, 2));
const O = out.on;
console.log(`켬: 막대 ${O.full.bars.length} 개 · 가득 ${O.full.bars.map((b) => b.full).join('/')} · 보임 ${O.full.bars.map((b) => !b.hidden).join('/')}`);
console.log(`켬: 0 아래 ${JSON.stringify(O.marks.zero)} · −30 아래 ${JSON.stringify(O.marks.severe)} · 탈진 ${JSON.stringify(O.marks.exhaust)} (게임 초 · 그때까지 청구된 공격 수)`);
console.log(`켬: 빚 깜빡임 불투명도 ${O.debtBlink?.min?.toFixed(2)} ~ ${O.debtBlink?.max?.toFixed(2)} · 막대 값 ${O.debtBlink?.bars?.[0]?.value} · 단계 ${O.debtBlink?.bars?.[0]?.level}`);
console.log(`켬: 탈진 중 W·F 누름 + 톡, 게임 ${(O.exhausted.during.t - O.exhausted.before.t).toFixed(2)} s → 골반 ${O.exhausted.walked} m · 자세 ${O.exhausted.pose} · move ${JSON.stringify(O.exhausted.during.move)} · 막기 ${O.exhausted.during.guard} · 찌르기 ${O.exhausted.during.tap} (찌르기 수 ${O.exhausted.before.thrusts} → ${O.exhausted.during.thrusts}) · 칸 '${O.exhausted.during.guardName}' · 막대 ${O.exhausted.bars[0].exhausted}/${O.exhausted.bars[0].text}`);
console.log(`켬: 탈진 끝 값 ${O.after.st.value} · 단계 ${O.after.st.level} · 상대 탈진 ${JSON.stringify(O.foeExhausted.foe)} · 상대 막대 ${O.foeExhausted.bars[1]?.exhausted}`);
console.log(`끔: STAMINA.on ${out.off.after.on} · 막대 숨김 ${out.off.after.bars.map((b) => b.hidden).join('/')} · 값 ${out.off.after.st.value} · 벤 수(장부) ${out.off.after.st.cuts}`);
console.log(`오류 ${errors.length}${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`);

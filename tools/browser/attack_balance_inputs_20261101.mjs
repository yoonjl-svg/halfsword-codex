import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

// No game action functions are called by this driver. CDP creates trusted touch
// events which pass through Input, attachStick and the existing parry button.
const playwrightPath = process.env.ATTACK_BALANCE_PLAYWRIGHT || '/workspace/halfsword-encyclopedia-20261031/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(playwrightPath));
const base = process.argv[2] || 'http://127.0.0.1:5298';
const outDir = path.resolve(process.argv[3] || '/tmp/attack-balance-20261101/browser');
const selector = process.argv[4] || 'pilot';
const fastGeometry = process.env.FAST_GEOMETRY === '1';
const jitter = process.env.INPUT_JITTER || 'exact';
const jitterConfig = jitter === 'small' ? { pixels: 3, timeMs: 25, windowDelayMs: 60 } : jitter === 'large' ? { pixels: 12, timeMs: 90, windowDelayMs: 220 } : { pixels: 0, timeMs: 0, windowDelayMs: 0 };
const fingerprints = {};
for (const f of ['src/attack_balance_probe.js', 'tools/attack_balance_page/vite.config.mjs', 'tools/attack_balance_page/storage_bootstrap.mjs', 'tools/browser/attack_balance_inputs_20261101.mjs']) fingerprints[f] = createHash('sha256').update(await fs.readFile(f)).digest('hex');
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pilot = ['schielhau', 'zwerchAbtritt', 'mordschlag', 'duplieren'];
const all = ['mordschlag', 'duplieren', 'schielhau', 'zwerchAbtritt', 'risoluto', 'inquartata', 'imbroccata', 'cavazione', 'cingir', 'redondo', 'talhoRodeado', 'gonosen', 'tsubameGaeshi', 'hirakiGiri', 'kote', 'geoksal', 'lianchi', 'yaoji', 'chebuYaoji'];
const names = selector === 'all' ? all : selector === 'pilot' ? pilot : selector.split(',');
const summaries = [];
const stroke = {
  schielhau: [[.12, .14], [-.4, -.42]], zwerchAbtritt: [[0, .1], [-.52, .06]],
  imbroccata: [[.02, .14], [.02, -.4]], talhoRodeado: [[.12, .14], [-.4, -.42]],
  hirakiGiri: [[-.1, .14], [.38, -.44]], kote: [[.02, -.22]],
  yaoji: [[0, .1], [-.52, .06]], chebuYaoji: [[0, .1], [-.52, .06]],
};
try {
  for (const name of names) {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 500 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    // Stable initial random source. Different seeds must be used for independent samples.
    const seed = +(process.env.INPUT_SEED || 20261101);
    const simSeed = +(process.env.SIM_SEED || 20261101);
    let noiseState = seed >>> 0;
    const noise = magnitude => { noiseState = (Math.imul(noiseState, 1664525) + 1013904223) >>> 0; return (noiseState / 4294967296 * 2 - 1) * magnitude; };
    await ctx.addInitScript(({ seed, fastGeometry }) => {
      let n = seed >>> 0; Math.random = () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
      const nativeGet = Storage.prototype.getItem, nativeSet = Storage.prototype.setItem, nativeKey = Storage.prototype.key, nativeLength = Object.getOwnPropertyDescriptor(Storage.prototype, 'length').get;
      nativeSet.call(localStorage, 'attack-balance-control-sentinel', 'unchanged');
      window.__balanceStorageAudit = () => ({ sentinel: nativeGet.call(localStorage, 'attack-balance-control-sentinel'), rawKeys: Array.from({ length: nativeLength.call(localStorage) }, (_, i) => nativeKey.call(localStorage, i)) });
      if (fastGeometry) {
        let game;
        Object.defineProperty(window, 'game', { configurable: true, get: () => game, set: v => { game = v; v.scene.visible = false; } });
      }
    }, { seed: simSeed, fastGeometry });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    const cdp = await ctx.newCDPSession(page), points = new Map();
    async function touch(type, id, x, y) {
      let touchPoints;
      if (type === 'touchEnd' || type === 'touchCancel') {
        const lifted = points.get(id); points.delete(id); touchPoints = lifted ? [lifted] : [];
      } else { points.set(id, { id, x: x + noise(jitterConfig.pixels), y: y + noise(jitterConfig.pixels), radiusX: 2, radiusY: 2, force: 1 }); touchPoints = [...points.values()]; }
      await cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
    }
    const pause = ms => page.waitForTimeout(ms);
    // Queue physical event times independently of the renderer acknowledgement.
    // Waiting for each CDP reply adds artificial gaps on software GL.
    const tap = async () => { const down = touch('touchStart', 7, 700, 340); await pause(Math.max(10, 45 + noise(jitterConfig.timeMs))); const up = touch('touchEnd', 7); await Promise.all([down, up]); await pause(180); };
    async function stick(x, y) {
      if (x === 0 && y === 0) { if (points.has(9)) await touch('touchEnd', 9); return; }
      const b = await page.locator('#moveStick').boundingBox();
      if (!b) throw new Error('Actual movement stick is unavailable');
      const type = points.has(9) ? 'touchMove' : 'touchStart';
      await touch(type, 9, b.x + b.width / 2 + 40 * x, b.y + b.height / 2 - 40 * y);
      await pause(90);
    }
    async function guard(on) {
      if (!on) { if (points.has(10)) await touch('touchEnd', 10); return; }
      const b = await page.locator('#btnParry').boundingBox();
      if (!b) throw new Error('Actual parry button is unavailable');
      await touch('touchStart', 10, b.x + b.width / 2, b.y + b.height / 2); await pause(90);
    }
    async function dragPad(pts, speed = 4, eventMs = 40) {
      const info = await page.evaluate(() => ({ from: [game.player.handOffset.x, game.player.handOffset.y], scale: game.config.INPUT.touchSensitivity / Math.max(320, innerHeight), gainY: 1.35 }));
      let [fx, fy] = info.from, x = 740, y = 330;
      await touch('touchStart', 7, x, y);
      const pending = [];
      for (const [tx, ty] of pts) {
        const dx = tx - fx, dy = ty - fy, d = Math.hypot(dx, dy), steps = Math.max(1, Math.ceil(d / (speed * eventMs / 1000)));
        for (let k = 0; k < steps; k++) {
          x += dx / steps / info.scale; y -= dy / steps / info.scale / info.gainY;
          pending.push(touch('touchMove', 7, x, y)); await pause(Math.max(8, eventMs + noise(jitterConfig.timeMs)));
        }
        fx = tx; fy = ty;
      }
      await Promise.all(pending);
      await pause(80); await touch('touchEnd', 7); await pause(180);
    }
    let report, fail = null;
    const startedAt = Date.now();
    try {
      const q = new URLSearchParams({ technique: name, trial: 'condition', actor: 'automated', test: '1', skillNodes: 'all', foe: 'heinrich', stage: 'castle' });
      const weapons = { german: 'longsword', italian: 'rapier', iberian: 'zweihander', japanese: 'uchigatana', chinese: 'hwando' };
      const idx = all.indexOf(name), school = idx < 4 ? 'german' : idx < 8 ? 'italian' : idx < 11 ? 'iberian' : idx < 15 ? 'japanese' : 'chinese';
      q.set('weapon', weapons[school]);
      console.log(JSON.stringify({ technique: name, stage: 'loading' }));
      await page.goto(`${base}/?${q}`, { waitUntil: 'networkidle', timeout: 120000 });
      console.log(JSON.stringify({ technique: name, stage: 'loaded', errors }));
      await page.waitForFunction(() => window.game?.player?.sword && window.attackBalance, null, { timeout: 120000 });
      await page.locator('#btnStart').click();
      await page.waitForFunction(() => game.state === 'fight' && game.stats.simTime > 2.4, null, { timeout: 180000 });
      console.log(JSON.stringify({ technique: name, stage: 'fight-ready' }));
      await page.evaluate(() => attackBalance.begin());
      if (name === 'duplieren') await page.evaluate(() => attackBalance.prepareFixture({ distance: 1.4, hand: [.42, .42], enemyHand: [0, .03] }));
      else if (name === 'cingir') await page.evaluate(() => attackBalance.prepareFixture({ distance: game.player.swordArt.measure.reach + .6 }));
      else await page.evaluate(() => attackBalance.prepareFixture());
      await pause(450);
      await page.evaluate(({ name, seed, simSeed, jitter, jitterConfig }) => attackBalance.mark('intended_input', { technique: name, seed, simSeed, jitter, jitterConfig, automation: 'trusted CDP touch; no direct attack invocation' }), { name, seed, simSeed, jitter, jitterConfig });
      if (stroke[name]) {
        if (['zwerchAbtritt', 'talhoRodeado', 'hirakiGiri'].includes(name)) await stick(-1, 0);
        if (name === 'chebuYaoji') await stick(0, 1);
        await dragPad(stroke[name], name === 'kote' ? 1.6 : 4);
        await stick(0, 0);
      } else if (name === 'mordschlag') {
        await stick(0, .7);
        try { await page.waitForFunction(() => game.playerSecret?.open, null, { timeout: 25000 }); } catch { /* unmet condition retained */ }
        await pause(Math.max(0, noise(jitterConfig.windowDelayMs)));
        await tap(); await stick(0, 0);
      } else if (name === 'duplieren') {
        await dragPad([[.12, .14], [-.4, -.42]]); await pause(2500);
      } else if (name === 'redondo') {
        await touch('touchStart', 7, 700, 340);
        try { await page.waitForFunction(() => game.playerUnique?.winding, null, { timeout: 8000 }); } catch { /* unmet hold condition retained */ }
        await pause(500); await touch('touchEnd', 7);
      } else if (name === 'tsubameGaeshi') {
        await dragPad([[0, .14], [0, -.5]]); await dragPad([[0, .25]]);
      } else if (name === 'lianchi') {
        await stick(0, -1); await pause(500); await stick(0, 1); await tap(); await stick(0, 0);
      } else if (name === 'inquartata') {
        await stick(-1, 0); await guard(true); await pause(800); await tap(); await guard(false); await stick(0, 0);
      } else if (name === 'cavazione') {
        await guard(true); await pause(800); await tap(); await guard(false);
      } else if (name === 'risoluto') {
        await stick(0, .8); await pause(2000); await tap(); await stick(0, 0);
      } else if (name === 'geoksal') {
        await stick(0, .8); await guard(true); await pause(7000); await guard(false); await stick(0, 0);
      } else if (name === 'gonosen') {
        await pause(2000); await stick(0, .7); await pause(1500); await stick(0, 0); await tap();
      } else if (name === 'cingir') {
        try { await page.waitForFunction(() => game.playerSecret?.open, null, { timeout: 10000 }); } catch { /* unmet condition retained */ }
        const pts = Array.from({ length: 25 }, (_, i) => { const a = i / 24 * Math.PI * 2; return [Math.cos(a) * .3, .03 + Math.sin(a) * .3]; });
        await dragPad(pts, 5, 16);
      }
      await pause(2400);
      await page.evaluate(() => attackBalance.finish('automated_input_trace_complete'));
      report = await page.evaluate(() => attackBalance.report());
      report.storageAudit = await page.evaluate(() => __balanceStorageAudit());
      if (fastGeometry) await page.evaluate(() => { game.scene.visible = true; });
      await page.screenshot({ path: path.join(outDir, `${name}.png`) });
    } catch (e) {
      fail = String(e); errors.push(fail);
      try { report = await page.evaluate(() => window.attackBalance?.report()); } catch { /* preserve tool error */ }
    }
    const durationMs = Date.now() - startedAt;
    const row = { technique: name, seed, simSeed, jitter, jitterConfig, durationMs, automation: 'trusted CDP touch events; not human success rate', fail, errors,
      inputEvents: report?.inputs?.length ?? 0,
      trustedInputs: report?.inputs?.filter(x => x.trusted).length ?? 0,
      requests: report?.events?.filter(x => x.type === 'request_result'),
      motions: report?.events?.filter(x => ['motion_start', 'secret_burst', 'unique_counter_change', 'technique_display'].includes(x.type)),
      contacts: report?.events?.filter(x => x.type === 'body_contact_result').length ?? 0,
      final: report?.final ? { state: report.final.state, distance: report.final.distance, fired: report.final.unique?.stats?.fired, secret: report.final.secret, player: report.final.player, enemy: report.final.enemy } : null };
    await fs.writeFile(path.join(outDir, `${name}.json`), JSON.stringify({ fingerprints, browser: { executable: process.env.PW_CHROMIUM || '/usr/bin/chromium', viewport: { width: 1000, height: 500 }, fastGeometry, driverVisibility: fastGeometry ? 'true-state upper-bound driver; geometry hidden only during automated input, restored for screenshot' : 'game geometry visible' }, summary: row, report }, null, 2));
    summaries.push(row); console.log(JSON.stringify({ technique: name, durationMs, inputEvents: row.inputEvents, trustedInputs: row.trustedInputs, requests: row.requests?.map(x => ({ technique: x.technique, accepted: x.accepted })), fired: row.final?.fired, contacts: row.contacts, fail, errors }));
    await ctx.close();
  }
} finally { await browser.close(); await fs.writeFile(path.join(outDir, 'summary.json'), JSON.stringify(summaries, null, 2)); }

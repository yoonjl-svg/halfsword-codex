import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.ATTACK_BALANCE_PLAYWRIGHT || '/workspace/halfsword-encyclopedia-20261031/node_modules/playwright/index.mjs'));
const base = process.argv[2] || 'http://127.0.0.1:5299';
const out = path.resolve(process.argv[3] || '/tmp/attack-balance-20261101/clock');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 500 }, hasTouch: true, isMobile: true });
  // Automation only: preserve physics/input while avoiding software-GL drawing.
  await ctx.addInitScript(() => {
    let game;
    Object.defineProperty(window, 'game', { configurable: true, get: () => game, set: v => { game = v; window.__originalRenderTick = v.renderCap.tick; v.renderCap.tick = () => false; } });
  });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${base}/?test=1&skillNodes=all&weapon=longsword&foe=heinrich&stage=castle&technique=schielhau&trial=natural&actor=automated`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword && window.attackBalance, null, { timeout: 120000 });
  await page.locator('#btnStart').click();
  await page.waitForFunction(() => game.state === 'fight' && game.stats.simTime > 2.4, null, { timeout: 120000 });
  await page.locator('#ab-record').click();
  await page.waitForTimeout(1400);
  await page.keyboard.press('KeyP');
  await page.waitForFunction(() => game.state === 'paused');
  const paused = await page.evaluate(() => attackBalance.snapshot());
  await page.waitForTimeout(2200);
  const pausedLater = await page.evaluate(() => attackBalance.snapshot());
  await page.keyboard.press('KeyP');
  await page.waitForFunction(() => game.state === 'fight');
  const fixtureRefusal = await page.evaluate(() => { try { attackBalance.prepareFixture(); return null; } catch (e) { return e.message; } });
  await page.keyboard.down('KeyS');
  if (process.env.CLOCK_GUARD === '1') await page.keyboard.down('KeyF');
  await page.waitForFunction(() => attackBalance.report().session.ended, null, { timeout: 50000 });
  await page.keyboard.up('KeyS');
  if (process.env.CLOCK_GUARD === '1') await page.keyboard.up('KeyF');
  const report = await page.evaluate(() => attackBalance.report());
  await page.evaluate(() => { game.renderCap.tick = __originalRenderTick; });
  await page.screenshot({ path: path.join(out, 'natural-clock.png') });
  const result = { reason: report.session.reason, guardInput: process.env.CLOCK_GUARD === '1', pauseWallMs: pausedLater.wallMs - paused.wallMs, pauseActiveDeltaS: pausedLater.activeWallS - paused.activeWallS, pausePhysicsDeltaS: pausedLater.physicsS - paused.physicsS, activeS: report.session.ended.activeWallS - report.session.started.activeWallS, wallS: (report.session.ended.wallMs - report.session.started.wallMs) / 1000, referenceS: report.session.ended.referenceS - report.session.started.referenceS, fixtureRefusal, renderSuppressedForAutomation: true, noFixtureOrDirectAttackCalls: true, errors };
  await fs.writeFile(path.join(out, 'natural-clock.json'), JSON.stringify({ result, report }, null, 2));
  console.log(JSON.stringify(result));
  if (errors.length || Math.abs(result.pauseActiveDeltaS) > .1 || Math.abs(result.pausePhysicsDeltaS) > .01 || !fixtureRefusal || !['active_wall_30s', 'player_dead', 'enemy_dead'].includes(result.reason)) process.exitCode = 1;
} finally { await browser.close(); }

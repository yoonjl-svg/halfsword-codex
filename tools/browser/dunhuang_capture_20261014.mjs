// Actual game screenshots. Pauses through UI; second image changes camera only.
import { chromium } from '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = process.argv[2];
assert(out?.startsWith('/tmp/'));
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 720 } });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.addInitScript(() => localStorage.setItem('gladiator-settings', JSON.stringify({ pixel: false, sound: false, difficulty: 'normal', skill: '0.3', fpsCap: true })));
  await page.route('**/@vite/client', r => r.fulfill({ contentType: 'application/javascript', body: '// Capture without HMR.' }));
  await page.goto('http://127.0.0.1:4320/?weapon=longsword&foeWeapon=ganjiang&foe=terracotta&stage=dunhuang', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.enemy?.groups?.head);
  await page.locator('#btnStart').click();
  await page.waitForFunction(() => game.state === 'fight' && game.stats.simTime >= 1.2, null, { timeout: 90000 });
  await page.locator('#btnPause').click();
  await page.addStyleTag({ content: 'body > :not(canvas):not(script):not(style){visibility:hidden!important}' });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.locator('canvas').first().screenshot({ path: out + '/dunhuang-combat.png' });
  const facts = await page.evaluate(() => {
    const facts = { stage: game.stage.id, weapon: game.enemy.weapon.id, name: game.enemy.name, render: game.renderInfo(), camera: game.camera.position.toArray() };
    game.freeCam = true;
    game.camera.position.set(0, 4.4, -14); game.camera.lookAt(18.6, 9, 0);
    return facts;
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.locator('canvas').first().screenshot({ path: out + '/dunhuang-vista.png' });
  await page.evaluate(() => {
    game.camera.position.set(11.6, 3.1, -7.2); game.camera.lookAt(20.35, 2.94, -7.2);
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.locator('canvas').first().screenshot({path:out+'/dunhuang-mural.png'});
  await page.evaluate(() => {
    const head=game.enemy.groups.head, target=head.getWorldPosition(head.position.clone());
    const forward=head.position.clone().set(1,0,0).applyQuaternion(head.getWorldQuaternion(head.quaternion.clone()));
    game.camera.position.copy(target).addScaledVector(forward,1.22);game.camera.position.y+=.13;
    target.y-=.14;game.camera.lookAt(target);
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.locator('canvas').first().screenshot({path:out+'/terracotta-detail.png'});
  assert.equal(facts.stage, 'dunhuang'); assert.equal(facts.weapon, 'ganjiang'); assert.deepEqual(errors, []);
  await fs.writeFile(out + '/capture.json', JSON.stringify({ pass: true, facts, errors, method: 'Actual game, UI pause after 1.2s. First camera unchanged; courtyard image changes only camera.' }, null, 2));
  console.log(JSON.stringify({ pass: true, ...facts }));
} finally { await browser.close(); }

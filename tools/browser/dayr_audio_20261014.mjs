// Dayr's production sound path: retained cue seeds, real WebAudio render and gates.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs';
import { STAGE_DETAIL_PROFILES, synthStageDetail } from '../../src/stage_detail_sound.js';
const out = process.argv[2]; assert(out?.startsWith('/tmp/'));
const prior = await import('data:text/javascript;base64,' + Buffer.from(execFileSync('git', ['show', 'd017a96:src/stage_detail_sound.js'])).toString('base64'));
const keys = Object.keys(STAGE_DETAIL_PROFILES), oldKeys = Object.keys(prior.STAGE_DETAIL_PROFILES);
assert.deepEqual(keys.slice(0, oldKeys.length), oldKeys, 'Existing profile indices seed production variations');
const rng = () => { let s = 173; return () => (s = s * 16807 % 2147483647) / 2147483647; };
const hash = pcm => createHash('sha256').update(Buffer.from(pcm.buffer)).digest('hex');
for (const k of oldKeys) assert.equal(hash(synthStageDetail(k, 22050, rng())), hash(prior.synthStageDetail(k, 22050, rng())));
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('**/dayr-audio-audit', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Dayr audio audit</title>' }));
  await page.goto('http://127.0.0.1:4320/dayr-audio-audit');
  const result = await page.evaluate(async () => {
    const { Sound } = await import('/src/sound.js');
    const event = { kind: 'caravanRing', amp: .75, pos: { x: 10.75, y: 1.021, z: -12.091 }, seed: 141001, time: 11.1 };
    const check = (v, m) => { if (!v) throw new Error(m); };
    const rows = [];
    for (const mode of ['ring', 'ambient']) {
      const ctx = new OfflineAudioContext(2, 48000 * 4, 48000), sound = new Sound();
      sound.seed = 173; sound.useSamples = false; sound.unlock(ctx); sound.setStage('dayr');
      if (mode === 'ring') check(sound.stageEvent('stageDetail', event) === true, 'Registered Dayr ring must be accepted');
      else sound.ambience();
      const buffer = await ctx.startRendering(), pcm = buffer.getChannelData(0);
      let peak = 0, power = 0;
      for (const v of pcm) { check(Number.isFinite(v), 'Nonfinite audio'); peak = Math.max(peak, Math.abs(v)); power += v * v; }
      check(peak > 0 && peak < 1, 'Silent or clipped master output');
      rows.push({ mode, peak, rms: Math.sqrt(power / pcm.length), stats: sound._details().stats });
    }
    const ctx = new OfflineAudioContext(2, 48000, 48000), s = new Sound();
    s.useSamples = false; s.unlock(ctx); s.setStage('dayr'); s.on = false;
    check(s.stageEvent('stageDetail', event) !== true && !s._details().voices.size, 'Mute did not reject'); s.on = true; s.setPaused(true);
    check(s.stageEvent('stageDetail', event) === false, 'Pause did not reject'); s.setPaused(false);
    check(s.stageEvent('stageDetail', event) === true, 'Resume did not accept');
    check(s.stageEvent('stageDetail', event) === false, 'Duplicate cue bypassed gap');
    s.setStage('qinglan'); check(s._details().voices.size === 0 && s._details().buffers.size === 0, 'Stage change retained voices');
    check(s._details().event(event) === false, 'Wrong-stage event accepted');
    await ctx.startRendering(); return { rows, controlGates: 6 };
  });
  assert.deepEqual(errors, []);
  await fs.writeFile(out, JSON.stringify({ pass: true, retainedProfileIndices: oldKeys.length, retainedPCM: oldKeys.length, result, errors, limits: 'Master render and control gates; no human listening or physical-phone loudness claim.' }, null, 2));
  console.log(JSON.stringify({ pass: true, retained: oldKeys.length, ...result }));
} finally { await browser.close(); }

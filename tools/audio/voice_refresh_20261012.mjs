// Actual Sound recording routes and partial-download retry, with deterministic take selection.
// node tools/audio/voice_refresh_20261012.mjs http://127.0.0.1:4182 /tmp/voice-refresh-audio
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const base = (process.argv[2] || 'http://127.0.0.1:4182').replace(/\/$/, '');
const out = process.argv[3];
assert(out, 'Provide a report directory or JSON path as the second argument');
const reportPath = out.endsWith('.json') ? out : path.join(out, 'audio-report.json');
await fs.mkdir(path.dirname(reportPath), { recursive: true });
const rows = [], errors = [];
const sourceNames = ['src/sound.js', 'src/config.js', 'src/slash_draw.js', 'src/stage_detail_sound.js'];
const hashSources = async () => Object.fromEntries(await Promise.all(sourceNames.map(async name => [name, createHash('sha256').update(await fs.readFile(path.join(root, name))).digest('hex')])));
const sources = await hashSources();
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
let retry = null, failure = null;
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  await page.route('**/__voice_refresh_probe__', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Voice refresh regression</title>' }));
  await page.goto(`${base}/__voice_refresh_probe__`);
  for (const sr of [44100, 48000]) {
    const rendered = await page.evaluate(async ({ sr }) => {
      const { Sound, VOICES } = await import('/src/sound.js');
      const ensure = (condition, message) => { if (!condition) throw new Error(message); };
      const ids = Object.keys(VOICES), kinds = ['hurt', 'ko', 'bleed'];
      ensure(ids.length === 11 && ids.includes('maya'), 'Expected all 11 profiles including Maya');
      const loader = new Sound();
      loader.ctx = new OfflineAudioContext(1, sr, sr);
      loader.useSamples = true;
      await loader.loadVoiceSamples(ids);
      const results = [];
      for (const id of ids) {
        for (const kind of kinds) {
          const key = `voice:${id}:${kind}`;
          const bank = loader.samples[key];
          const configured = VOICES[id].rec[kind];
          ensure((Array.isArray(configured) ? configured.length : configured) === 2, `${key}: not two configured recordings`);
          ensure(bank?.length === 2, `${key}: not two decoded recordings`);
          ensure(bank[0] !== bank[1], `${key}: same AudioBuffer object in both slots`);
          for (let variant = 0; variant < 2; variant++) {
            const chosen = bank[variant];
            ensure(chosen.sampleRate === sr && chosen.length > 0, `${key}:${variant}: invalid decoded buffer`);
            const duration = Math.max(3, chosen.duration / Math.min(0.9, (VOICES[id].rec.rate ?? 1) * 0.94) + 1.5);
            const off = new OfflineAudioContext(1, Math.ceil(duration * sr), sr);
            const sound = new Sound();
            sound.ctx = off;
            sound.build();
            sound.useSamples = true;
            sound.samples = loader.samples;
            const originalPick = sound.pickSample;
            const requests = [];
            sound.pickSample = function (name) {
              requests.push(name);
              ensure(name === key, `${key}:${variant}: requested unexpected sample ${name}`);
              return this.samples[name][variant];
            };
            try {
              if (kind === 'hurt') sound.hurt(id, 0.7);
              else sound.death(id, kind === 'ko' ? '기절' : '출혈');
            } finally { sound.pickSample = originalPick; }
            ensure(requests.length === 1 && requests[0] === key, `${key}:${variant}: expected one recording selection`);
            const actual = sound.voices.flatMap(event => event.srcs);
            ensure(actual.length === 1 && actual[0].buffer === chosen, `${key}:${variant}: selected recording was not the actual sound source`);
            const playbackRate = actual[0].playbackRate.value;
            const audio = await off.startRendering();
            const samples = audio.getChannelData(0);
            let peak = 0, energy = 0;
            for (const x of samples) {
              ensure(Number.isFinite(x), `${key}:${variant}: non-finite render sample`);
              peak = Math.max(peak, Math.abs(x));
              energy += x * x;
            }
            ensure(peak > 0 && peak < 1 && energy > 0, `${key}:${variant}: silence or clipping (${peak})`);
            results.push({ id, kind, variant, sr, loaded: bank.length, selectedBufferUsed: true, decodedFrames: chosen.length, decodedSeconds: chosen.duration, playbackRate, renderFrames: samples.length, peak, rms: Math.sqrt(energy / samples.length) });
          }
        }
      }
      return results;
    }, { sr });
    rows.push(...rendered);
    console.log(JSON.stringify({ sampleRate: sr, rendered: rendered.length }));
  }

  // Fail one second take at the fetch boundary. Keep the game loader unchanged.
  const target = await page.evaluate(async () => {
    const { VOICES } = await import('/src/sound.js');
    const id = 'maya', kind = 'hurt', recording = VOICES[id].rec[kind];
    const file = Array.isArray(recording) ? recording[1] : `voice/${id}_${kind}2`;
    return { id, kind, file, url: new URL(`sfx/${file}.mp3`, document.baseURI).href };
  });
  let attempts = 0;
  await page.route(target.url, async route => {
    attempts++;
    if (attempts === 1) await route.fulfill({ status: 503, contentType: 'text/plain', body: 'Injected single-attempt voice download failure' });
    else await route.continue();
  });
  const retryResult = await page.evaluate(async ({ id, kind }) => {
    const { Sound } = await import('/src/sound.js');
    const sound = new Sound();
    sound.ctx = new OfflineAudioContext(1, 48000, 48000);
    sound.useSamples = true;
    const key = `voice:${id}:${kind}`;
    await sound.loadVoiceSamples([id]);
    const firstCount = sound.samples[key]?.length || 0;
    if (firstCount !== 1) throw new Error(`Partial-load fixture expected one recording, got ${firstCount}`);
    await sound.loadVoiceSamples([id]);
    const secondCount = sound.samples[key]?.length || 0;
    if (secondCount !== 2) throw new Error(`Partial-set retry did not restore both recordings: ${secondCount}`);
    for (const event of ['hurt', 'ko', 'bleed']) if (sound.samples[`voice:${id}:${event}`]?.length !== 2) throw new Error(`${id}:${event}: incomplete after retry`);
    return { firstCount, secondCount, completeEventSets: 3 };
  }, target);
  await page.unroute(target.url);
  assert.equal(attempts, 2, 'Failed asset should have been fetched again on the second loader call');
  retry = { ...target, ...retryResult, attempts, pass: true };
  assert.equal(rows.length, 132, 'Expected 11 profiles × 3 events × 2 variants × 2 rates');
  assert.deepEqual(errors, [], 'Browser page errors');
  assert.deepEqual(await hashSources(), sources, 'Source files changed while audio regression was running');
} catch (error) {
  failure = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  await browser.close();
  const report = {
    pass: !failure, base, profiles: [...new Set(rows.map(row => row.id))], sampleRates: [44100, 48000], expectedRenders: 132, rendered: rows.length, rows, retry, errors, failure, sources, completedUTC: new Date().toISOString(),
    limits: [
      'Each row is a separate OfflineAudioContext rendering through actual Sound.build/hurt/death, with only pickSample temporarily forced to its requested variant.',
      'Partial-load retry is an actual browser fetch receiving one injected HTTP 503 followed by the real asset response.',
      'Scheduled voice events do not establish natural combat wound frequency, acting suitability, human listening approval, or physical phone loudness.',
      'Player death is rendered through its quiet recording branch; player world fade and tinnitus are separate behavior checks.',
    ],
  };
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ pass: report.pass, profiles: report.profiles.length, rendered: report.rendered, retry: retry?.pass ?? false, errors, failure: failure?.message ?? null }));
}

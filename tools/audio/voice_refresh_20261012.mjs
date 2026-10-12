// Actual Sound recording routes and partial-download retry, with deterministic take selection.
// node tools/audio/voice_refresh_20261012.mjs http://127.0.0.1:4182 /tmp/voice-refresh-audio [--profiles=player,margarethe]
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
const profileOption = process.argv.slice(4).find(arg => arg.startsWith('--profiles='));
const requestedProfiles = profileOption ? profileOption.slice('--profiles='.length).split(',').map(id => id.trim()).filter(Boolean) : [];
assert(!profileOption || requestedProfiles.length > 0, '--profiles must name at least one profile');
assert.equal(new Set(requestedProfiles).size, requestedProfiles.length, '--profiles contains a duplicate');
const approvedTargets = { default: { hurt: 2, ko: 2, bleed: 2 }, player: { hurt: 2, ko: 1, bleed: 1 } };
const reportPath = out.endsWith('.json') ? out : path.join(out, 'audio-report.json');
await fs.mkdir(path.dirname(reportPath), { recursive: true });
const rows = [], errors = [];
const sourceNames = ['src/sound.js', 'src/config.js', 'src/slash_draw.js', 'src/stage_detail_sound.js'];
const hashSources = async () => Object.fromEntries(await Promise.all(sourceNames.map(async name => [name, createHash('sha256').update(await fs.readFile(path.join(root, name))).digest('hex')])));
const sources = await hashSources();
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
let retry = null, failure = null, expectedRenders = null;
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  await page.route('**/__voice_refresh_probe__', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Voice refresh regression</title>' }));
  await page.goto(`${base}/__voice_refresh_probe__`);
  const profileIDs = await page.evaluate(async requested => {
    const { VOICES } = await import('/src/sound.js');
    const all = Object.keys(VOICES);
    if (all.length !== 11 || !all.includes('maya')) throw new Error('Expected all 11 profiles including Maya');
    for (const id of requested) if (!all.includes(id)) throw new Error(`Unknown profile: ${id}`);
    for (const [id, profile] of Object.entries(VOICES)) for (const kind of ['hurt', 'ko', 'bleed']) {
      const rec = profile.rec[kind];
      if (Array.isArray(rec) && rec.includes('voice/player_exhale2')) throw new Error(`${id}:${kind}: rejected player_exhale2 selected`);
    }
    for (const kind of ['ko', 'bleed']) {
      const rec = VOICES.player.rec[kind];
      if (!Array.isArray(rec) || rec.length !== 1 || rec[0] !== 'voice/player_exhale') throw new Error(`player:${kind}: must retain only original player_exhale`);
    }
    return requested.length ? requested : all;
  }, requestedProfiles);
  expectedRenders = profileIDs.reduce((sum, id) => sum + Object.values(approvedTargets[id] || approvedTargets.default).reduce((a, b) => a + b, 0), 0) * 2;
  for (const sr of [44100, 48000]) {
    const rendered = await page.evaluate(async ({ sr, ids, approvedTargets }) => {
      const { Sound, VOICES } = await import('/src/sound.js');
      const ensure = (condition, message) => { if (!condition) throw new Error(message); };
      const kinds = ['hurt', 'ko', 'bleed'];
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
          const required = (approvedTargets[id] || approvedTargets.default)[kind];
          ensure((Array.isArray(configured) ? configured.length : configured) === required, `${key}: expected ${required} configured recording(s)`);
          ensure(bank?.length === required, `${key}: expected ${required} decoded recording(s)`);
          ensure(new Set(bank).size === required, `${key}: repeated AudioBuffer object`);
          for (let variant = 0; variant < required; variant++) {
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
            results.push({ id, kind, variant, sr, required, loaded: bank.length, selectedBufferUsed: true, decodedFrames: chosen.length, decodedSeconds: chosen.duration, playbackRate, renderFrames: samples.length, peak, rms: Math.sqrt(energy / samples.length) });
          }
        }
      }
      return results;
    }, { sr, ids: profileIDs, approvedTargets });
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
  assert.equal(rows.length, expectedRenders, 'Render count must match every selected profile and approved event target at both rates');
  assert.deepEqual(errors, [], 'Browser page errors');
  assert.deepEqual(await hashSources(), sources, 'Source files changed while audio regression was running');
} catch (error) {
  failure = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  await browser.close();
  const report = {
    pass: !failure, base, scope: requestedProfiles.length ? 'selected' : 'all', requestedProfiles, approvedTargets, profiles: [...new Set(rows.map(row => row.id))], sampleRates: [44100, 48000], expectedRenders, rendered: rows.length, rows, retry, errors, failure, sources, completedUTC: new Date().toISOString(),
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

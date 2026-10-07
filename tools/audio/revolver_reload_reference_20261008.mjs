// Actual decoded samples + Sound event routing in Chromium OfflineAudioContext.
// Run against Vite on :4160. This does not claim human listening acceptance.
import { chromium } from '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const out = process.argv[2]; assert(out);
await fs.mkdir(out, { recursive: false });
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage(), errors = [], requests = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('response', r => { if (r.url().includes('/sfx/revolver/')) requests.push({ url: r.url(), status: r.status() }); });
await page.route('**/__reload_reference__', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Reload reference check</title>' }));
try {
  await page.goto('http://127.0.0.1:4160/__reload_reference__');
  const rows = [];
  for (const recorded of [true, false]) {
    const row = await page.evaluate(async ({ recorded }) => {
      const { Sound } = await import('/src/sound.js');
      const { prepareRevolverReload, playRevolverReload } = await import('/src/revolver_reload_audio.js');
      const { GUN, gateOpenSound, loadRoundSound, reloadSound } = await import('/src/gun.js');
      const sr = 48000, ctx = new OfflineAudioContext(1, sr * 10, sr);
      const snd = new Sound(); snd.useSamples = false; snd.unlock(ctx); snd.useSamples = recorded;
      const beforeRandom = Math.random; let randomCalls = 0;
      Math.random = () => { randomCalls++; return beforeRandom(); };
      try {
        const ready = await prepareRevolverReload(snd);
        if (ready !== recorded) throw Error('Sample readiness mismatch');
        const events = [];
        const schedule = [0, ...Array.from({ length: GUN.rounds }, (_, i) => GUN.reloadOpen + (GUN.reload - GUN.reloadOpen - GUN.reloadClose) * (i + .5) / GUN.rounds), GUN.reload];
        let suspended = ctx.suspend(0), done = ctx.startRendering();
        for (let i = 0; i < schedule.length; i++) {
          await suspended;
          const kind = i === 0 ? 'open' : i === 7 ? 'close' : 'insert';
          const ev = recorded
            ? (kind === 'open' ? gateOpenSound(snd, { x: 0 }) : kind === 'close' ? reloadSound(snd, { x: 0 }) : loadRoundSound(snd, { x: 0 }, i))
            : playRevolverReload(snd, { x: 0 }, kind);
          events.push({ kind, start: ev.start, end: ev.end, sources: ev.srcs.length, bufferLength: ev.srcs[0].buffer.length });
          if (i + 1 < schedule.length) suspended = ctx.suspend(schedule[i + 1]);
          await ctx.resume();
        }
        const rendered = await done, x = rendered.getChannelData(0);
        let peak = 0, sum = 0;
        for (const v of x) { if (!Number.isFinite(v)) throw Error('Nonfinite PCM'); peak = Math.max(peak, Math.abs(v)); sum += v * v; }
        for (const ev of events) {
          let sum = 0; const a = Math.floor(ev.start * sr), b = Math.min(x.length, Math.ceil(ev.end * sr));
          for (let i = a; i < b; i++) sum += x[i] * x[i];
          ev.rms = Math.sqrt(sum / (b - a));
        }
        const n = snd.stats.events; snd._on = false;
        const muted = playRevolverReload(snd, null, 'insert') === null && snd.stats.events === n;
        snd._on = true;
        // A new event after all eight ended should prune them from the Sound voice list.
        playRevolverReload(snd, null, 'close');
        const expiredVoicesPruned = snd.voices.length === 1;
        const firstThree = playRevolverReload(snd, null, 'insert', 3).srcs[0].buffer;
        playRevolverReload(snd, null, 'open');
        const otherOne = playRevolverReload(snd, null, 'insert', 1).srcs[0].buffer;
        const sameThree = playRevolverReload(snd, null, 'insert', 3).srcs[0].buffer;
        const interleavedSamplesStable = firstThree === sameThree && firstThree !== otherOne;
        let binary = ''; const bytes = new Uint8Array(x.buffer);
        for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
        return { recorded, ready, path: recorded ? 'integrated-gun-wrappers' : 'module-fallback', sr, events, peak, rms: Math.sqrt(sum / x.length), randomCalls, muted, expiredVoicesPruned, interleavedSamplesStable, pcm: btoa(binary) };
      } finally { Math.random = beforeRandom; }
    }, { recorded });
    const pcm = Buffer.from(row.pcm, 'base64'); delete row.pcm;
    row.pcmSHA256 = sha(pcm);
    const wav = Buffer.alloc(44 + pcm.length / 2);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(row.sr, 24); wav.writeUInt32LE(row.sr * 2, 28);
    wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
    for (let i = 0; i < pcm.length / 4; i++) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, pcm.readFloatLE(i * 4))) * 32767), 44 + i * 2);
    row.wav = recorded ? 'recorded-six.wav' : 'fallback-six.wav'; await fs.writeFile(path.join(out, row.wav), wav);
    assert.equal(row.events.length, 8); assert.equal(row.events.filter(e => e.kind === 'insert').length, 6);
    assert(row.events.every(e => e.rms > 0 && e.sources === 1 && e.end > e.start && e.end - e.start < 1));
    assert(row.peak > 0 && row.peak < 1 && row.muted && row.expiredVoicesPruned && row.interleavedSamplesStable); assert.equal(row.randomCalls, recorded ? 21 : 0);
    rows.push(row);
  }
  assert.deepEqual(errors, []); assert.equal(requests.length, 8); assert(requests.every(r => r.status === 200));
  const files = ['src/gun.js', 'src/sound.js', 'src/revolver_reload_audio.js', 'tools/audio/revolver_reload_reference_20261008.mjs', 'public/sfx/revolver/provenance.json'];
  const hashes = Object.fromEntries(await Promise.all(files.map(async f => [f, sha(await fs.readFile(f))])));
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ pass: true, source: hashes, errors, requests, rows }, null, 2) + '\n');
  console.log(JSON.stringify({ pass: true, out, rows: rows.map(({ recorded, peak, rms, randomCalls }) => ({ recorded, peak, rms, randomCalls })) }));
} finally { await browser.close(); }

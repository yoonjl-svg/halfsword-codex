// Actual Sound routing and unchanged recordings, rendered at 48 kHz in Chromium.
// Requires source Vite on 127.0.0.1:4160 and the native timing probe's fresh report.
// node tools/audio/revolver_tuning_20261008.mjs /fresh/output /native/report.json
import { chromium } from '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const BASE = '541c4cf1e2861b46735b818d66b270c1bf6105df';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const out = process.argv[2], nativePath = process.argv[3];
assert(out && nativePath, 'Supply a fresh output directory and passing native timing report');
await fs.mkdir(out, { recursive: false });
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sourceFiles = ['src/gun.js', 'src/revolver_reload_audio.js', 'src/sound.js', 'tools/audio/revolver_tuning_20261008.mjs'];
const hashes = async () => Object.fromEntries(await Promise.all(sourceFiles.map(async f => [f, sha(await fs.readFile(path.join(root, f)))])));
const native = JSON.parse(await fs.readFile(nativePath, 'utf8'));
assert(native.pass && native.sourceStable, 'Requires passing, stable native timing evidence');
const nativeEvents = native.fixedTickReload.hookEvents;
const report = { baselineCommit: BASE, currentCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  command: `node tools/audio/revolver_tuning_20261008.mjs ${out} ${nativePath}`, sourceBefore: await hashes(), nativeReport: nativePath,
  nativeReportSHA256: sha(await fs.readFile(nativePath)), scope: 'Chromium OfflineAudioContext 48 kHz; real Sound event/layer/master routing, current gun wrappers, native 120 Hz event timing, historical module comparison. Gain is amplitude gain, not perceived loudness; limiter means final PCM need not scale exactly 1.2. No human listening, physical phone, or overlapping combat mix claim.',
  assets: [], rows: [], checks: 0, pageErrors: [], requests: [], pass: false };
const check = (condition, label) => { report.checks++; assert(condition, label); };
for (const f of ['src/gun.js', 'src/revolver_reload_audio.js']) check(report.sourceBefore[f] === native.sourceBefore[f], 'Audio and native probes use the same frozen source');
const baselineAudio = execFileSync('git', ['show', `${BASE}:src/revolver_reload_audio.js`], { cwd: root, encoding: 'utf8' });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', e => report.pageErrors.push(String(e)));
  page.on('response', r => { if (r.url().includes('/sfx/revolver/')) report.requests.push({ url: r.url(), status: r.status() }); });
  await page.route('**/__revolver_tuning__', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Reload tuning verification</title>' }));
  await page.route('**/__baseline_reload_audio__.js', route => route.fulfill({ contentType: 'text/javascript', body: baselineAudio }));
  await page.goto('http://127.0.0.1:4160/__revolver_tuning__');
  for (const recorded of [true, false]) for (const version of ['baseline', 'current']) {
    const row = await page.evaluate(async ({ recorded, version, nativeEvents }) => {
      const { Sound } = await import('/src/sound.js');
      // Vite may attach an HMR query to gun.js's dependency. Preload that exact
      // module identity, otherwise separate WeakMaps spuriously test fallback.
      const servedGun = await (await fetch('/src/gun.js')).text();
      const reloadModuleURL = servedGun.match(/from\s+["']([^"']*revolver_reload_audio\.js[^"']*)["']/)?.[1];
      if (!reloadModuleURL) throw Error('Cannot locate served gun audio dependency');
      const module = await import(version === 'baseline' ? '/__baseline_reload_audio__.js' : reloadModuleURL);
      const gun = await import('/src/gun.js');
      const sr = 48000, ctx = new OfflineAudioContext(1, sr * 10, sr);
      const snd = new Sound(); snd.useSamples = false; snd.unlock(ctx); snd.useSamples = recorded;
      const ready = await module.prepareRevolverReload(snd);
      if (ready !== recorded) throw Error('Sample readiness mismatch');
      const originalRandom = Math.random; let randomCalls = 0;
      Math.random = () => { randomCalls++; return .25; };
      const events = [];
      const hash = async buffer => [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(v => v.toString(16).padStart(2, '0')).join('');
      try {
        let suspended = ctx.suspend(0), done = ctx.startRendering();
        for (let i = 0; i < nativeEvents.length; i++) {
          await suspended;
          const event = nativeEvents[i];
          const ev = version === 'baseline' ? module.playRevolverReload(snd, { x: 0 }, event.kind, event.round)
            : event.kind === 'open' ? gun.gateOpenSound(snd, { x: 0 })
              : event.kind === 'close' ? gun.reloadSound(snd, { x: 0 }) : gun.loadRoundSound(snd, { x: 0 }, event.round);
          const src = ev.srcs[0], buffer = src.buffer, channels = [];
          for (let channel = 0; channel < buffer.numberOfChannels; channel++) channels.push(await hash(buffer.getChannelData(channel).slice().buffer));
          events.push({ kind: event.kind, round: event.round ?? null, requested: event.time, start: ev.start, end: ev.end,
            gain: ev.out.gain.value, sources: ev.srcs.length, playbackRate: src.playbackRate.value,
            bufferLength: buffer.length, sampleRate: buffer.sampleRate, duration: buffer.duration, channels });
          if (i + 1 < nativeEvents.length) suspended = ctx.suspend(nativeEvents[i + 1].time);
          await ctx.resume();
        }
        const rendered = await done, pcm = rendered.getChannelData(0);
        let peak = 0, sum = 0, hardClippedSamples = 0;
        for (const sample of pcm) {
          if (!Number.isFinite(sample)) throw Error('Nonfinite output PCM');
          peak = Math.max(peak, Math.abs(sample)); sum += sample * sample;
          if (Math.abs(sample) >= 1) hardClippedSamples++;
        }
        for (const event of events) {
          let energy = 0; const first = Math.floor(event.start * sr), last = Math.min(pcm.length, Math.ceil(event.end * sr));
          for (let i = first; i < last; i++) energy += pcm[i] * pcm[i];
          event.rms = Math.sqrt(energy / (last - first));
        }
        const count = snd.stats.events; snd._on = false;
        const muteWorks = module.playRevolverReload(snd, null, 'insert', 1) === null && snd.stats.events === count;
        const result = { recorded, version, ready, sr, reloadModuleURL, events, peak, rms: Math.sqrt(sum / pcm.length), hardClippedSamples, randomCalls, muteWorks, pcmSHA256: await hash(pcm.slice().buffer) };
        if (version === 'current') {
          let binary = ''; const bytes = new Uint8Array(pcm.buffer);
          for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
          result.pcm = btoa(binary);
        }
        return result;
      } finally { Math.random = originalRandom; }
    }, { recorded, version, nativeEvents });
    const pcm = row.pcm ? Buffer.from(row.pcm, 'base64') : null; delete row.pcm;
    check(row.events.length === 8 && row.events.filter(e => e.kind === 'insert').length === 6, 'One open, six inserts, one close');
    check(row.events.every(e => e.rms > 0 && e.sources === 1 && e.playbackRate === 1 && e.sampleRate === 48000), 'Every actual voice audible, single source and original playback speed');
    check(row.events.every(e => e.start <= e.requested + 128 / 48000 && e.start >= e.requested - 128 / 48000), 'Offline scheduling quantization within one 128-frame block');
    check(row.peak > 0 && row.peak < 1 && row.hardClippedSamples === 0, 'Rendered samples finite with zero hard clipping');
    check(row.muteWorks, 'Module respects Sound mute');
    check(row.randomCalls === (version === 'current' ? 21 : 0), 'Gun wrappers preserve exactly 21 shared random calls per reload');
    if (pcm) {
      const wav = Buffer.alloc(44 + pcm.length / 2);
      wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
      wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(row.sr, 24); wav.writeUInt32LE(row.sr * 2, 28);
      wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
      for (let i = 0; i < pcm.length / 4; i++) wav.writeInt16LE(Math.round(pcm.readFloatLE(i * 4) * 32767), 44 + i * 2);
      row.wav = recorded ? 'recorded-six.wav' : 'fallback-six.wav'; row.wavSHA256 = sha(wav);
      await fs.writeFile(path.join(out, row.wav), wav, { flag: 'wx' });
    }
    report.rows.push(row);
  }
  for (const recorded of [true, false]) {
    const baseline = report.rows.find(row => row.recorded === recorded && row.version === 'baseline');
    const current = report.rows.find(row => row.recorded === recorded && row.version === 'current');
    for (let i = 0; i < 8; i++) {
      const a = baseline.events[i], b = current.events[i];
      check(Math.abs(b.gain / a.gain - 1.2) < 2e-7, 'Actual GainNode amplitude increases exactly 20% (float32 tolerance)');
      for (const key of ['kind', 'round', 'start', 'end', 'bufferLength', 'sampleRate', 'duration', 'playbackRate', 'channels']) {
        check(JSON.stringify(a[key]) === JSON.stringify(b[key]), `Historical/current emitted buffer and speed unchanged: ${key}`);
      }
    }
  }
  for (const name of ['open', 'insert1', 'insert2', 'insert3', 'insert4', 'insert5', 'insert6', 'close']) {
    const file = `public/sfx/revolver/${name}.wav`, bytes = await fs.readFile(path.join(root, file));
    const oldBytes = execFileSync('git', ['show', `${BASE}:${file}`], { cwd: root, maxBuffer: 2 * 1024 * 1024 });
    check(bytes.equals(oldBytes), 'Recorded WAV byte-for-byte unchanged from baseline');
    report.assets.push({ file, bytes: bytes.length, sha256: sha(bytes), baselineSHA256: sha(oldBytes) });
  }
  check(report.requests.length === 16 && report.requests.every(r => r.status === 200), 'All sixteen recorded asset loads succeeded');
  check(report.pageErrors.length === 0, 'No page errors');
  report.pass = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  await browser.close();
  report.sourceAfter = await hashes(); report.sourceStable = JSON.stringify(report.sourceBefore) === JSON.stringify(report.sourceAfter);
  if (!report.sourceStable) { report.pass = false; report.error = `${report.error ?? ''}\nSources changed during audio execution`; process.exitCode = 1; }
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ pass: report.pass, checks: report.checks, sourceStable: report.sourceStable, reportPath: path.join(out, 'report.json'), rows: report.rows.map(({ version, recorded, peak, rms, randomCalls }) => ({ version, recorded, peak, rms, randomCalls })), error: report.error }));
}

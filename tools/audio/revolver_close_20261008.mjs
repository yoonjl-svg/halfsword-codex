// Compare the completion cue through native Chromium WebAudio and real Sound routing.
// Timing is a controlled audio fixture; gun.js scheduling is verified separately.
// node tools/audio/revolver_close_20261008.mjs /fresh/output
import { chromium } from '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const BASE = 'c5fcf82d3dd77079852b79b57d5158d64f7ac8e2';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const out = process.argv[2];
assert(out, 'Supply a fresh output directory');
await fs.mkdir(out, { recursive: false });
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const files = ['src/revolver_reload_audio.js', 'src/sound.js', 'src/config.js', 'tools/audio/revolver_close_20261008.mjs'];
const hashes = async () => Object.fromEntries(await Promise.all(files.map(async f => [f, sha(await fs.readFile(path.join(root, f)))])));
const baseline = execFileSync('git', ['show', `${BASE}:src/revolver_reload_audio.js`], { cwd: root, encoding: 'utf8' });
const report = {
  baselineCommit: BASE, command: `node tools/audio/revolver_close_20261008.mjs ${out}`,
  scope: 'Native Chromium OfflineAudioContext at 48kHz, real Sound routing. Controlled one-open/six-insert/one-close audio fixture; no physics scheduling, human listening, phone, or mixed-combat loudness claim. Sample peaks are measured after existing limiter/soft-clip routing; no new clipping stage.',
  sourceBefore: await hashes(), rows: [], assets: [], requests: [], pageErrors: [], checks: 0, pass: false,
};
const check = (condition, label) => { report.checks++; assert(condition, label); };
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', e => report.pageErrors.push(String(e)));
  page.on('response', r => { if (r.url().includes('/sfx/revolver/')) report.requests.push({ url: r.url(), status: r.status() }); });
  await page.route('**/__revolver_close__', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Revolver close check</title>' }));
  await page.route('**/__baseline_close__.js', r => r.fulfill({ contentType: 'text/javascript', body: baseline }));
  await page.goto('http://127.0.0.1:4160/__revolver_close__');
  for (const recorded of [true, false]) for (const version of ['baseline', 'current']) {
    const row = await page.evaluate(async ({ recorded, version }) => {
      const { Sound } = await import('/src/sound.js');
      const mod = await import(version === 'baseline' ? '/__baseline_close__.js' : '/src/revolver_reload_audio.js');
      const sr = 48000, ctx = new OfflineAudioContext(1, sr * 10, sr);
      const snd = new Sound(); snd.useSamples = false; snd.unlock(ctx); snd.useSamples = recorded;
      const ready = await mod.prepareRevolverReload(snd);
      if (ready !== recorded) throw Error('Recording readiness mismatch');
      const hash = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
      const interval = (7.3 / 6) * .8 * .8;
      const fixture = [{ kind: 'open', at: 0 }, ...Array.from({ length: 6 }, (_, i) => ({ kind: 'insert', round: i + 1, at: 7.2 - (5 - i) * interval })), { kind: 'close', at: 8 }];
      const events = [];
      const oldRandom = Math.random; let randomCalls = 0;
      Math.random = () => { randomCalls++; return .25; };
      try {
        let suspended = ctx.suspend(0), rendered = ctx.startRendering();
        for (let i = 0; i < fixture.length; i++) {
          await suspended;
          const item = fixture[i], ev = mod.playRevolverReload(snd, { x: 0 }, item.kind, item.round);
          const src = ev.srcs[0], buffer = src.buffer;
          events.push({ ...item, start: ev.start, end: ev.end, gain: ev.out.gain.value, sources: ev.srcs.length,
            rate: src.playbackRate.value, length: buffer.length, duration: buffer.duration,
            bufferSHA256: await hash(buffer.getChannelData(0).slice().buffer) });
          if (i + 1 < fixture.length) suspended = ctx.suspend(fixture[i + 1].at);
          await ctx.resume();
        }
        const pcm = (await rendered).getChannelData(0);
        const measure = (first, last) => {
          let peak = 0, sum = 0, hardClippedSamples = 0;
          for (let i = first; i < last; i++) {
            const v = pcm[i];
            if (!Number.isFinite(v)) throw Error('Nonfinite rendered PCM');
            peak = Math.max(peak, Math.abs(v)); sum += v * v;
            if (Math.abs(v) >= 1) hardClippedSamples++;
          }
          return { peak, rms: Math.sqrt(sum / (last - first)), hardClippedSamples };
        };
        const closeStart = Math.floor(events.at(-1).start * sr);
        const count = snd.stats.events;
        snd._on = false;
        const muted = mod.playRevolverReload(snd, null, 'close') === null && snd.stats.events === count;
        let binary = ''; const bytes = new Uint8Array(pcm.buffer);
        for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
        return { recorded, version, ready, sr, events, count, muted, randomCalls,
          overall: measure(0, pcm.length), close: measure(closeStart, Math.min(pcm.length, closeStart + sr * .6)),
          beforeCloseSHA256: await hash(pcm.slice(0, closeStart).buffer), pcm: btoa(binary) };
      } finally { Math.random = oldRandom; }
    }, { recorded, version });
    const pcm = Buffer.from(row.pcm, 'base64'); delete row.pcm;
    row.pcmSHA256 = sha(pcm);
    check(row.events.length === 8 && row.count === 8 && row.events.filter(e => e.kind === 'close').length === 1, 'Exactly one completion event');
    check(row.events.every(e => e.sources === 1 && e.rate === 1), 'One original-speed source per event');
    check(row.events.every(e => Math.abs(e.start - e.at) <= 128 / row.sr), 'Native audio fixture starts within one render quantum');
    check(row.overall.peak > 0 && row.overall.peak < 1 && row.overall.hardClippedSamples === 0, 'Actual final PCM finite and below full scale');
    check(row.close.rms > 0 && row.muted && row.randomCalls === 0, 'Audible output, respects mute, no gameplay RNG calls');
    const wav = Buffer.alloc(44 + pcm.length / 2);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(row.sr, 24); wav.writeUInt32LE(row.sr * 2, 28);
    wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
    for (let i = 0; i < pcm.length / 4; i++) wav.writeInt16LE(Math.round(pcm.readFloatLE(i * 4) * 32767), 44 + i * 2);
    row.wav = `${recorded ? 'recorded' : 'fallback'}-${version}.wav`;
    row.wavSHA256 = sha(wav);
    await fs.writeFile(path.join(out, row.wav), wav, { flag: 'wx' });
    report.rows.push(row);
  }
  for (const recorded of [true, false]) {
    const a = report.rows.find(r => r.recorded === recorded && r.version === 'baseline');
    const b = report.rows.find(r => r.recorded === recorded && r.version === 'current');
    check(a.beforeCloseSHA256 === b.beforeCloseSHA256, 'All opening/insertion output PCM unchanged');
    for (let i = 0; i < 8; i++) {
      const old = a.events[i], current = b.events[i];
      for (const key of ['kind', 'round', 'at', 'start', 'end', 'rate', 'sources', 'length', 'duration', 'bufferSHA256']) {
        check(old[key] === current[key], `Unchanged source and event structure: ${key}`);
      }
      if (i < 7) check(old.gain === current.gain, 'Preserve opening/insertion gain');
      else check(Math.abs(current.gain / old.gain - 1.2 / .7) < 2e-7, 'Completion-only gain increase');
    }
    b.closeRmsRatio = b.close.rms / a.close.rms;
    check(b.closeRmsRatio > 1.3, 'Completion output RMS increases meaningfully through actual Sound routing');
  }
  for (const name of ['open', 'insert1', 'insert2', 'insert3', 'insert4', 'insert5', 'insert6', 'close']) {
    const file = `public/sfx/revolver/${name}.wav`, bytes = await fs.readFile(path.join(root, file));
    const old = execFileSync('git', ['show', `${BASE}:${file}`], { cwd: root, maxBuffer: 2 * 1024 * 1024 });
    check(bytes.equals(old), 'Licensed recording remains byte-identical');
    report.assets.push({ file, sha256: sha(bytes), bytes: bytes.length });
  }
  check(report.requests.length === 16 && report.requests.every(r => r.status === 200), 'All baseline/current recordings decoded');
  check(report.pageErrors.length === 0, 'No browser errors');
  report.pass = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  await browser.close();
  report.sourceAfter = await hashes(); report.sourceStable = JSON.stringify(report.sourceBefore) === JSON.stringify(report.sourceAfter);
  if (!report.sourceStable) { report.pass = false; report.error = `${report.error ?? ''}\nAudio sources changed during rendering`; process.exitCode = 1; }
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ pass: report.pass, sourceStable: report.sourceStable, checks: report.checks, out,
    rows: report.rows.map(({ version, recorded, overall, close, closeRmsRatio }) => ({ version, recorded, overall, close, closeRmsRatio })), error: report.error }));
}

// Deterministic native PCM/dispatch checks; optional real OfflineAudioContext renders.
// Usage: node tools/audio/stage_dunhuang_checks_20261014.mjs /tmp/dunhuang-audio.json [--browser http://127.0.0.1:4160]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { synthStageDetail, STAGE_DETAIL_PROFILES, StageDetailSound, hasStageDetails } from '../../src/stage_detail_sound.js';
import { Sound, BodySounds, VOICES, makeRng } from '../../src/sound.js';

const root = fileURLToPath(new URL('../..', import.meta.url));
const output = process.argv[2], browserFlag = process.argv.indexOf('--browser');
assert(output?.startsWith('/tmp/'), 'Provide an output JSON under /tmp');
const base = 'dc358ace563d60ea38042ea691b01ee4bba0118f';
const oldText = execFileSync('git', ['show', `${base}:src/stage_detail_sound.js`], { cwd: root, encoding: 'utf8' });
const old = await import('data:text/javascript;base64,' + Buffer.from(oldText).toString('base64'));
const digest = p => createHash('sha256').update(Buffer.from(p.buffer)).digest('hex');
const metrics = p => {
  let peak = 0, power = 0;
  for (const v of p) { assert(Number.isFinite(v), 'finite PCM'); peak = Math.max(peak, Math.abs(v)); power += v * v; }
  return { peak, rms: Math.sqrt(power / p.length) };
};
const rows = [];
for (const kind of Object.keys(STAGE_DETAIL_PROFILES)) for (const sr of [22050, 44100, 48000]) {
  const p = synthStageDetail(kind, sr, makeRng(173)), m = metrics(p);
  assert(m.peak > 0 && m.peak < 1, `${kind} clipping/silence`);
  assert(Math.abs(p[0]) < 0.001 && Math.abs(p.at(-1)) < 0.001, `${kind} edge clicks`);
  assert.equal(p.length, Math.ceil(sr * STAGE_DETAIL_PROFILES[kind].duration));
  const unchanged = old.STAGE_DETAIL_PROFILES[kind] ? digest(p) === digest(old.synthStageDetail(kind, sr, makeRng(173))) : null;
  if (unchanged !== null) assert(unchanged, `${kind} existing PCM changed`);
  rows.push({ kind, sr, duration: p.length / sr, ...m, unchanged, sha256: digest(p) });
}
const wood = STAGE_DETAIL_PROFILES.dunhuangWood;
const variants = [0, 1, 2].map(variant => {
  const seed = 9127 + Object.keys(STAGE_DETAIL_PROFILES).indexOf('dunhuangWood') * 311 + variant * 101;
  const p = synthStageDetail('dunhuangWood', 22050, makeRng(seed)), m = metrics(p);
  assert(m.peak * wood.gain * 1.25 < 0.012, 'detail maximum listener gain stays quiet');
  assert(m.rms * wood.gain * 1.25 < 0.003, 'no loud sustained detail');
  assert.equal(digest(p), digest(synthStageDetail('dunhuangWood', 22050, makeRng(seed))));
  return { variant, ...m, maxListenerPeak: m.peak * wood.gain * 1.25, sha256: digest(p) };
});
assert.equal(new Set(variants.map(v => v.sha256)).size, 3);
assert.equal(synthStageDetail('unknown', 22050, makeRng(1)).length, 0);
assert.equal(synthStageDetail('dunhuangWood', NaN, makeRng(1)).length, 0);

// Minimal graph records native routing and lifecycle, without claiming to render Web Audio.
class Graph {
  constructor() { this.currentTime = 0; this.sampleRate = 22050; this.state = 'running'; this.nodes = []; }
  param(value = 0) { return { value, cancelScheduledValues() {}, setTargetAtTime(v) { this.value = v; } }; }
  node(kind) {
    const n = { kind, links: [], gain: this.param(1), frequency: this.param(), Q: this.param(), pan: this.param(), playbackRate: this.param(1),
      connect(to) { this.links.push(to); return to; }, disconnect() { this.disconnected = true; }, start(t) { this.startTime = t; }, stop(t) { this.stopTime = t; } };
    this.nodes.push(n); return n;
  }
  createGain() { return this.node('gain'); }
  createBufferSource() { return this.node('buffer'); }
  createBiquadFilter() { return this.node('filter'); }
  createStereoPanner() { return this.node('pan'); }
  createOscillator() { return this.node('oscillator'); }
  createConvolver() { return this.node('convolver'); }
  createBuffer(channels, length, sampleRate) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { duration: length / sampleRate, sampleRate, getChannelData: i => data[i] };
  }
  startRendering() {} // Native Sound avoids browser timers for offline contexts.
}
function fixture() {
  const s = new Sound(); s.seed = 73; s.ctx = new Graph();
  s.master = s.ctx.createGain(); s.metalBus = s.ctx.createGain(); s.fleshBus = s.ctx.createGain(); return s;
}
const s = fixture(); s.setStage('dunhuang'); assert.equal(s.stage, 'dunhuang');
assert(hasStageDetails(s.stage)); assert.equal(s._room.conv.buffer.duration, 0.28);
assert.deepEqual(s._room.sends.map(n => n.gain.value), [0.055, 0.018]);
const payload = { kind: 'dunhuangWood', amp: 0.5, pos: { x: 16.45, y: 5.34, z: -7.2 }, seed: 141400, time: 11 };
assert.equal(s.stageEvent('stageDetail', payload), true);
assert.equal(s._details().stats.last.pan, 0.6); assert.equal(s._details().stats.last.visualTime, 11);
assert.equal(s._details().stats.last.gain, wood.gain * 0.5);
assert.equal(s.stageEvent('stageDetail', payload), false, 'duplicate cannot stack');
s.ctx.currentTime = 23.9; assert.equal(s.stageEvent('stageDetail', payload), false, '24s per-kind gap');
s.ctx.currentTime = 25; assert.equal(s.stageEvent('stageDetail', { ...payload, pos: { x: NaN, y: 0, z: 0 } }), false);
assert.equal(s.stageEvent('stageDetail', { ...payload, amp: Infinity }), false);
s.setPaused(true); assert.equal(s.stageEvent('stageDetail', payload), false); assert.equal(s._details().voices.size, 0);
s.setPaused(false); assert.equal(s.stageEvent('stageDetail', payload), true);
s.on = false; s.ctx.currentTime = 60; assert.equal(s.stageEvent('stageDetail', payload), undefined); s.on = true;
const stages = [...new Set(Object.values(old.STAGE_DETAIL_PROFILES).map(p => p.stage))];
for (const stage of stages) {
  s.setStage(stage); assert.equal(s._details().voices.size, 0);
  assert.equal(s.stageEvent('stageDetail', payload), false, `foreign cue rejected in ${stage}`);
}
s.setStage('dunhuang');
for (const kind of Object.keys(old.STAGE_DETAIL_PROFILES)) assert.equal(s.stageEvent('stageDetail', { ...payload, kind }), false);
const ambient = s.ambience();
assert.equal(ambient.nodes.filter(n => n.kind === 'buffer').length, 2);
assert.equal(ambient.nodes.filter(n => n.kind === 'oscillator').length, 2);
for (const n of ambient.nodes.filter(n => n.kind === 'oscillator')) assert(n.frequency.value < 0.1, 'oscillators only subaudible gain modulation');
s.setPaused(true); assert.equal(ambient.out.gain.value, 0); s.setPaused(false); assert.equal(ambient.out.gain.value, 1);
s.setStage('dayr'); assert(ambient.nodes.every(n => Number.isFinite(n.stopTime)), 'stage exit stops all ambient sources');
const selected = [], stepSound = fixture(); stepSound.setStage('dunhuang');
stepSound.pickSample = key => { selected.push(key); return {}; };
stepSound.event = () => ({}); stepSound.layer = () => {}; stepSound.pick = () => ({});
stepSound.footstep(1); stepSound.bodyFall(3); assert(selected.filter(k => k === 'step').length >= 2, 'existing sand samples for steps and body grit');

// Existing stage ambience graphs stay unchanged, including their filter/gain/LFO parameters.
const graphSignature = (Module, stage) => {
  const sound = fixture(); sound.stage = stage;
  const d = new Module.StageDetailSound(sound, makeRng); d.ambience();
  return sound.ctx.nodes.map(n => ({ kind: n.kind, type: n.type, frequency: n.frequency.value, Q: n.Q.value, gain: n.gain.value, pan: n.pan.value, rate: n.playbackRate.value, links: n.links.length }));
};
for (const stage of stages) assert.deepEqual(graphSignature({ StageDetailSound }, stage), graphSignature(old, stage), `${stage} ambient changed`);

assert.equal(VOICES.silent.mute, true);
const oldSound = execFileSync('git', ['show', `${base}:src/sound.js`], { cwd: root, encoding: 'utf8' });
const oldVoicesText = oldSound.slice(oldSound.indexOf('export const VOICES ='), oldSound.indexOf('\n};', oldSound.indexOf('export const VOICES =')) + 3);
const oldVoices = (await import('data:text/javascript;base64,' + Buffer.from(oldVoicesText).toString('base64'))).VOICES;
assert.deepEqual(Object.fromEntries(Object.entries(VOICES).filter(([id]) => id !== 'silent')), oldVoices, 'every human voice profile unchanged');
const muted = fixture(), attempted = [];
muted.pickSample = name => { attempted.push(name); return {}; };
muted.pick = name => { attempted.push(name); return {}; };
muted.event = () => { attempted.push('event'); return {}; }; muted.layer = () => attempted.push('layer');
muted.fadeOutWorld = () => attempted.push('fade');
for (const cause of ['기절', '출혈', '목']) muted.death('silent', cause);
muted.hurt('silent', 1); assert.deepEqual(attempted, []);
muted.death('silent', '목', { me: true }); assert.deepEqual(attempted, ['fade']);
attempted.length = 0; muted.death('player', '출혈', { me: true });
assert.deepEqual(attempted, ['voice:player:bleed', 'event', 'layer', 'fade'], 'ordinary player death exhale/fade retained');
attempted.length = 0; muted.death('generic', '기절');
assert.deepEqual(attempted, ['event', 'voice:generic:ko', 'layer'], 'ordinary opponent death retained');
attempted.length = 0; muted.hurt('generic', 1);
assert.deepEqual(attempted, ['voice:generic:hurt', 'event', 'layer'], 'ordinary opponent hurt retained');
const loaded = [], generated = [], prepare = fixture(); prepare.useSamples = true;
prepare.loadSample = (name, file) => loaded.push({ name, file }); prepare.runJobs = jobs => generated.push(...jobs);
prepare.prepareVoices(['silent']); await prepare.voicesReady;
assert.deepEqual(loaded, []); assert.deepEqual(generated, []);
const body = { translation: () => ({ x: 0, y: 0, z: 0 }), linvel: () => ({ x: 0, y: 0, z: 0 }) };
const fighter = { state: 'stand', blood: 0.4, bleed: 0.01, bodies: { footF: body, footB: body, pelvis: body, chest: body }, wounds: [] };
const bodyCalls = [], adapter = { breath: () => bodyCalls.push('breath'), death: () => bodyCalls.push('death'), bodyFall: () => bodyCalls.push('bodyFall') };
const silentBody = new BodySounds(adapter, fighter, 'silent', true);
silentBody.update(0.1); silentBody.update(2); assert.deepEqual(bodyCalls, [], 'no breath scheduling for silent player preview');
fighter.state = 'dead'; silentBody.update(0.1); silentBody.update(1.3);
assert.deepEqual(bodyCalls, ['death', 'bodyFall'], 'death dispatch and physical landing retained');
fighter.state = 'stand'; bodyCalls.length = 0;
const humanBody = new BodySounds(adapter, fighter, 'player', true); humanBody.update(0.1); humanBody.update(2);
assert.deepEqual(bodyCalls, ['breath'], 'human breathing retained');

const browserRows = [], browserSource = {};
if (browserFlag !== -1) {
  const origin = process.argv[browserFlag + 1]; assert(origin?.startsWith('http://127.0.0.1:'));
  const { chromium } = await import('/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs');
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage(), errors = []; page.on('pageerror', e => errors.push(String(e)));
  try {
    await page.route('**/__dunhuang_audio_probe__', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Offline audio check</title>' }));
    await page.goto(origin + '/__dunhuang_audio_probe__');
    const served = await page.evaluate(async () => ({
      'src/sound.js': (await import('/src/sound.js?raw')).default,
      'src/stage_detail_sound.js': (await import('/src/stage_detail_sound.js?raw')).default,
    }));
    for (const [file, source] of Object.entries(served)) {
      assert.equal(source, fs.readFileSync(new URL('../../' + file, import.meta.url), 'utf8'), `${file} served source differs from checkout`);
      browserSource[file] = createHash('sha256').update(source).digest('hex');
    }
    for (const sr of [44100, 48000]) for (const kind of ['ambient', 'detail']) {
      const result = await page.evaluate(async ({ sr, kind }) => {
        const { Sound } = await import('/src/sound.js');
        const seconds = kind === 'ambient' ? 8 : 3;
        const off = new OfflineAudioContext(2, sr * seconds, sr), s = new Sound(); s.seed = 73;
        s.ctx = off; s.master = off.createGain(); s.master.connect(off.destination);
        s.metalBus = off.createGain(); s.fleshBus = off.createGain(); s.setStage('dunhuang');
        if (s.stage !== 'dunhuang') throw Error('served Sound does not support Dunhuang');
        if (kind === 'ambient') s.ambience();
        else if (!s.stageEvent('stageDetail', { kind: 'dunhuangWood', amp: 1, pos: { x: 0, y: 5, z: -7 }, seed: 141400, time: 11 })) throw Error('detail routing rejected');
        const rendered = await off.startRendering(); let peak = 0, sum = 0, tail = 0;
        for (let ch = 0; ch < 2; ch++) for (let i = 0; i < rendered.length; i++) {
          const v = rendered.getChannelData(ch)[i]; if (!Number.isFinite(v)) throw Error('nonfinite rendered PCM');
          peak = Math.max(peak, Math.abs(v)); sum += v * v; if (i > sr * (seconds - 0.1)) tail = Math.max(tail, Math.abs(v));
        }
        return { sr, kind, duration: seconds, peak, rms: Math.sqrt(sum / (2 * rendered.length)), tail, stats: s._details().stats };
      }, { sr, kind });
      assert(result.peak > 0 && result.peak < (kind === 'ambient' ? 0.005 : 0.012), JSON.stringify(result));
      assert(result.rms > 0 && result.rms < 0.003);
      if (kind === 'detail') { assert.equal(result.tail, 0); assert.equal(result.stats.accepted, 1); assert.equal(result.stats.ended, 1); }
      browserRows.push(result);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
const report = { pass: true, base, method: 'Seeded actual synthesis; existing PCM/ambient graph regression; native Sound dispatch, lifecycle, sample routing and silent voice paths. Graph fixtures do not render audio. Optional browser rows render real OfflineAudioContext. Auditory realism and physical-device loudness remain subjective.', rows, variants, native: { exclusivityStages: stages.length, nativeEventRouting: true, sandSamples: selected, pauseAndRetire: true, silentVoices: true, humanBreathRetained: true, humanProfilesAndDeathHurtRetained: true }, browserSource, browserRows };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ pass: true, renders: rows.length, existingUnchanged: rows.filter(r => r.unchanged).length, woodVariants: variants.length, native: report.native, browserRenders: browserRows.length, output }));

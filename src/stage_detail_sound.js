// These outdoor/detail stages share the game's master bus, noise buffer and
// camera-relative positioning. Detail sounds are driven by visible motion,
// never by wall-clock timers or a second combat-event scheduler.
export const STAGE_DETAIL_PROFILES = Object.freeze({
  clothRustle: { stage: 'loggia', duration: 1.25, gain: 0.024, gap: 5 },
  riggingCreak: { stage: 'corsair', duration: 1.8, gain: 0.025, gap: 6 },
  waterLap: { stage: 'corsair', duration: 1.5, gain: 0.021, gap: 4 },
  groveRustle: { stage: 'sacred_grove', duration: 1.65, gain: 0.020, gap: 5 },
  paperRustle: { stage: 'sacred_grove', duration: 0.9, gain: 0.016, gap: 7 },
  gullCall: { stage: 'corsair', duration: 2.15, gain: 0.085, gap: 24 },
  lakeIceBoom: { stage: 'frozen_bay', duration: 3.5, gain: 0.055, gap: 26 },
  frozenPierCreak: { stage: 'frozen_bay', duration: 1.9, gain: 0.030, gap: 24 },
});

export const hasStageDetails = (stage) => stage === 'loggia' || stage === 'corsair' || stage === 'sacred_grove' || stage === 'frozen_bay';
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const TAU = Math.PI * 2;

/** Deterministic material friction and distant bird call, not impact cues.
 * rng is the existing sound.js makeRng. Returned mono PCM is also used by the
 * offline review renderer; no recordings, network assets or sample imports.
 */
export function synthStageDetail(kind, sr, rng) {
  const profile = STAGE_DETAIL_PROFILES[kind];
  if (!profile || !Number.isFinite(sr) || sr < 8000) return new Float32Array(0);
  const out = new Float32Array(Math.ceil(profile.duration * sr));
  if (kind === 'lakeIceBoom' || kind === 'frozenPierCreak') {
    const variation = rng(), pitch = 0.91 + variation * 0.18;
    let low = 0, body = 0, air = 0, phase = 0, chirp = 0, peak = 0;
    const lowA = 1 - Math.exp(-TAU * 105 / sr), bodyA = 1 - Math.exp(-TAU * 680 / sr);
    const airA = 1 - Math.exp(-TAU * 1900 / sr);
    for (let i = 0; i < out.length; i++) {
      const t = i / sr, u = i / (out.length - 1), white = rng() * 2 - 1;
      low += lowA * (white - low); body += bodyA * (white - body); air += airA * (white - air);
      let sample;
      if (kind === 'lakeIceBoom') {
        // Distant sheet flex: broad, low modes arrive under a small, brief
        // dispersive overtone. No sharp weapon-like attack or long pitch dive.
        const bloom = (1 - Math.exp(-t / 0.07)) * Math.exp(-t / 0.78);
        const modes = 0.18 * Math.sin(TAU * 49 * pitch * t)
          + 0.09 * Math.sin(TAU * 78.3 * pitch * t + 0.16 * Math.sin(t * 8))
          + 0.05 * Math.sin(TAU * 123.7 * pitch * t);
        const ct = Math.max(0, t - 0.035), window = ct < 0.31 ? Math.sin(Math.PI * ct / 0.31) ** 2 : 0;
        phase += TAU * (360 + 420 * Math.exp(-ct / 0.065)) * pitch / sr;
        chirp += TAU * (590 + 490 * Math.exp(-ct / 0.045)) * pitch / sr;
        sample = bloom * (modes + 0.8 * low + 0.09 * body)
          + window * (0.030 * Math.sin(phase) + 0.012 * Math.sin(chirp) + 0.040 * (air - body));
      } else {
        // Short stick/slip of dry timber and taut rope, with an uneven rasp
        // and only weak pitch: no dock water or bell-like sustained note.
        const fold = Math.sin(Math.PI * u) ** 2;
        const strain = 0.32 + 0.68 * Math.sin(t * (8 + variation * 2) + 0.7 * Math.sin(t * 19)) ** 2;
        phase += TAU * (116 + 24 * Math.sin(u * Math.PI) + 5 * Math.sin(t * 21)) * pitch / sr;
        sample = fold * strain * (0.32 * (body - low) + 0.045 * Math.sin(phase)
          + 0.022 * Math.sin(phase * 2.13) + 0.015 * Math.sin(phase * 3.71));
      }
      // Smooth the finite tail, including when rendered at a different rate.
      out[i] = sample * Math.min(1, (1 - u) / 0.12);
      peak = Math.max(peak, Math.abs(out[i]));
    }
    if (peak > 0.45) for (let i = 0; i < out.length; i++) out[i] *= 0.45 / peak;
    return out;
  }
  if (kind === 'gullCall') {
    // Two short, rough calls followed by a falling cry. This is a procedural
    // coastal-bird interpretation, not a recording of a particular species.
    const pitch = 0.94 + rng() * 0.12;
    for (const [start, duration, strength] of [[0.03, 0.24, 0.55], [0.39, 0.29, 0.68], [0.86, 1.12, 1]]) {
      let phase = 0, breath = 0;
      const count = Math.floor(duration * sr), offset = Math.floor(start * sr);
      for (let j = 0; j < count && offset + j < out.length; j++) {
        const u = j / count, t = j / sr;
        const rise = 280 * Math.sin(Math.PI * Math.min(1, u * 4));
        const frequency = (850 + rise - 360 * u + 20 * Math.sin(t * 52)) * pitch;
        phase += TAU * frequency / sr;
        breath += 0.35 * (rng() * 2 - 1 - breath);
        const envelope = Math.min(1, u / 0.07) * (1 - u) ** 0.7 * Math.min(1, (1 - u) / 0.04);
        const roughness = 0.86 + 0.14 * Math.sin(t * 91);
        out[offset + j] += strength * envelope * (roughness * (0.25 * Math.sin(phase) + 0.09 * Math.sin(phase * 2) + 0.035 * Math.sin(phase * 3)) + 0.045 * breath);
      }
    }
    return out;
  }
  const cutoff = { clothRustle: 1600, riggingCreak: 800, waterLap: 950, groveRustle: 2100, paperRustle: 2600 }[kind];
  const a = 1 - Math.exp(-TAU * cutoff / sr);
  const lowA = 1 - Math.exp(-TAU * 170 / sr);
  let filtered = 0, low = 0, phase = 0, peak = 0;
  const variation = rng();
  for (let i = 0; i < out.length; i++) {
    const t = i / sr, u = i / (out.length - 1);
    filtered += a * (rng() * 2 - 1 - filtered);
    low += lowA * (filtered - low);
    const envelope = Math.sin(Math.PI * u) ** 2;
    // Gentle overlapping creases, without a sharp attack that could suggest a hit.
    const folds = 0.52 + 0.48 * Math.sin(t * (19 + variation * 9) + Math.sin(t * 7)) ** 2;
    let sample = (filtered - low) * folds * 0.6;
    if (kind === 'riggingCreak') {
      phase += TAU * (145 + 32 * Math.sin(u * Math.PI) + 6 * Math.sin(t * 17)) / sr;
      sample = sample * 0.36 + (Math.sin(phase) + 0.25 * Math.sin(phase * 2.07)) * 0.12 * folds;
    } else if (kind === 'waterLap') {
      phase += TAU * (410 - 170 * u + 30 * Math.sin(t * 13)) / sr;
      sample = filtered * 0.45 + Math.sin(phase) * 0.028 * folds;
    } else if (kind === 'paperRustle') {
      sample *= 0.5 + 0.5 * Math.sin(t * 43) ** 2;
    }
    out[i] = sample * envelope;
    peak = Math.max(peak, Math.abs(out[i]));
  }
  if (peak > 0.45) for (let i = 0; i < out.length; i++) out[i] *= 0.45 / peak;
  return out;
}

export class StageDetailSound {
  constructor(sound, makeRng) {
    this.sound = sound;
    this.makeRng = makeRng;
    this.stage = sound.stage;
    this.paused = !!sound._stagePaused;
    this.voices = new Set();
    this.buffers = new Map(); // At most three variants for each detail kind.
    this.last = new Map();
    this.lastAny = -Infinity;
    this.ambient = null;
    this.stats = { accepted: 0, rejected: 0, ended: 0, stopped: 0, peakVoices: 0, last: null };
  }

  setStage(stage) {
    this.stopVoices();
    this.stopAmbient();
    this.stage = stage;
    this.buffers.clear();
    this.last.clear();
    this.lastAny = -Infinity;
  }

  setPaused(paused) {
    if (this.paused === !!paused) return;
    this.paused = !!paused;
    if (this.paused) this.stopVoices();
    const c = this.sound.ctx;
    if (this.ambient) {
      const gain = this.ambient.out.gain;
      gain.cancelScheduledValues(c.currentTime);
      gain.setTargetAtTime(this.paused ? 0 : 1, c.currentTime, this.paused ? 0.025 : 0.22);
    }
  }

  stopVoices() {
    const c = this.sound.ctx;
    for (const voice of this.voices) {
      voice.gain.gain.cancelScheduledValues(c.currentTime);
      voice.gain.gain.setTargetAtTime(0, c.currentTime, 0.01);
      voice.source.stop(c.currentTime + 0.055);
      this.stats.stopped++;
    }
    this.voices.clear();
  }

  stopAmbient() {
    const old = this.ambient;
    if (!old) return;
    const t = this.sound.ctx.currentTime;
    old.out.gain.cancelScheduledValues(t);
    old.out.gain.setTargetAtTime(0, t, 0.045);
    for (const source of old.nodes) source.stop(t + 0.3);
    this.ambient = null;
  }

  ambience() {
    if (this.ambient) return this.ambient;
    const sound = this.sound, c = sound.ctx;
    const out = c.createGain();
    out.gain.value = 0;
    if (!this.paused) out.gain.setTargetAtTime(1, c.currentTime + 0.1, 0.8);
    out.connect(sound.master);
    const nodes = [], connections = [out];
    const addNoise = ({ rate = 1, type = 'bandpass', frequency, gain, lfo, depth, pan = 0, ceiling = 1800 }) => {
      const src = c.createBufferSource();
      src.buffer = sound._noiseBuf(); src.loop = true; src.playbackRate.value = rate;
      const filter = c.createBiquadFilter(); filter.type = type; filter.frequency.value = frequency; filter.Q.value = 0.65;
      const top = c.createBiquadFilter(); top.type = 'lowpass'; top.frequency.value = ceiling; top.Q.value = 0.5;
      const volume = c.createGain(); volume.gain.value = gain;
      src.connect(filter).connect(top).connect(volume);
      const panner = c.createStereoPanner?.();
      if (panner) { panner.pan.value = pan; volume.connect(panner).connect(out); connections.push(panner); }
      else volume.connect(out);
      connections.push(src, filter, top, volume); nodes.push(src);
      const mod = c.createOscillator(), amount = c.createGain();
      mod.frequency.value = lfo; amount.gain.value = depth;
      mod.connect(amount).connect(volume.gain);
      nodes.push(mod); connections.push(mod, amount);
    };
    if (this.stage === 'loggia') {
      addNoise({ frequency: 420, gain: 0.003, lfo: 0.041, depth: 0.001, ceiling: 1350 });
      addNoise({ rate: 0.81, type: 'lowpass', frequency: 180, gain: 0.005, lfo: 0.067, depth: 0.002 });
    } else if (this.stage === 'corsair') {
      addNoise({ type: 'lowpass', frequency: 450, gain: 0.016, lfo: 0.083, depth: 0.007, pan: 0.2 });
      addNoise({ rate: 0.83, frequency: 650, gain: 0.004, lfo: 0.047, depth: 0.0015, ceiling: 1500, pan: -0.2 });
    } else if (this.stage === 'sacred_grove') {
      addNoise({ frequency: 650, gain: 0.005, lfo: 0.055, depth: 0.002, ceiling: 1650 });
      // A distant stream, without the temple's invisible bell or scheduled bird.
      addNoise({ rate: 0.79, frequency: 1100, gain: 0.004, lfo: 0.11, depth: 0.001, ceiling: 2000, pan: 0.35 });
    } else if (this.stage === 'frozen_bay') {
      // Open inland ice: sparse dry air, without surf, storm or room echo.
      addNoise({ rate: 0.87, frequency: 520, gain: 0.0026, lfo: 0.037, depth: 0.0009, ceiling: 1500, pan: -0.15 });
      addNoise({ rate: 0.71, type: 'lowpass', frequency: 135, gain: 0.0035, lfo: 0.061, depth: 0.0011, ceiling: 750, pan: 0.12 });
    }
    let remaining = nodes.length;
    for (const source of nodes) {
      source.onended = () => { if (--remaining === 0) for (const node of connections) node.disconnect(); };
      source.start(c.currentTime);
    }
    this.ambient = { out, nodes, detail: true };
    return this.ambient;
  }

  event(data = {}) {
    const sound = this.sound, c = sound.ctx, profile = STAGE_DETAIL_PROFILES[data.kind];
    const reject = () => { this.stats.rejected++; return false; };
    if (!profile || profile.stage !== this.stage || !sound.on || this.paused || (!c.startRendering && c.state !== 'running')) return reject();
    const amp = data.amp ?? 0.5;
    if (!Number.isFinite(amp) || amp <= 0 || (data.pos && !['x', 'y', 'z'].every((k) => Number.isFinite(data.pos[k])))) return reject();
    const t = c.currentTime;
    if (t - this.lastAny < 2 || t - (this.last.get(data.kind) ?? -Infinity) < profile.gap || this.voices.size >= 2) return reject();
    const variant = (Number.isFinite(data.seed) ? Math.abs(data.seed | 0) : 0) % 3;
    const key = data.kind + ':' + variant;
    let buffer = this.buffers.get(key);
    if (!buffer) {
      const sr = 22050;
      const seed = 9127 + Object.keys(STAGE_DETAIL_PROFILES).indexOf(data.kind) * 311 + variant * 101;
      const pcm = synthStageDetail(data.kind, sr, this.makeRng(seed));
      buffer = c.createBuffer(1, pcm.length, sr); buffer.getChannelData(0).set(pcm);
      this.buffers.set(key, buffer);
    }
    const source = c.createBufferSource(), gain = c.createGain();
    source.buffer = buffer;
    const where = sound._where(data.pos);
    const pan = Number.isFinite(where.pan) ? clamp(where.pan, -0.8, 0.8) : 0;
    const near = Number.isFinite(where.near) ? clamp(where.near, 0, 1.25) : 1;
    gain.gain.value = profile.gain * clamp(amp, 0, 1) * near;
    const nodes = [source, gain], panner = c.createStereoPanner?.();
    source.connect(gain);
    if (panner) { panner.pan.value = pan; gain.connect(panner).connect(sound.master); nodes.push(panner); }
    else gain.connect(sound.master);
    const voice = { source, gain, kind: data.kind, end: t + buffer.duration, nodes };
    this.voices.add(voice);
    source.onended = () => { this.voices.delete(voice); for (const node of nodes) node.disconnect(); this.stats.ended++; };
    source.start(t + 0.005);
    this.last.set(data.kind, t); this.lastAny = t;
    this.stats.accepted++;
    this.stats.peakVoices = Math.max(this.stats.peakVoices, this.voices.size);
    this.stats.last = { kind: data.kind, amp: clamp(amp, 0, 1), pan, near, gain: gain.gain.value, seed: variant, visualTime: Number.isFinite(data.time) ? data.time : null, audioTime: t };
    return true;
  }
}

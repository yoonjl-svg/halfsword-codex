// Recorded GP100 manipulation, CC0: public/sfx/revolver/README.md.
// Scheduling belongs to gun.js: this module emits one event at a time, never a
// wall-clock reload timer or an async sound after a fetch finishes.
const FILES = ['open', 'insert1', 'insert2', 'insert3', 'insert4', 'insert5', 'insert6', 'close'];
const banks = new WeakMap();
const rounds = new WeakMap();
const GAIN = { open: 0.65 * 1.2, insert: 0.95 * 1.2, close: 0.7 * 1.2 };

function bankFor(ctx) {
  let bank = banks.get(ctx);
  if (!bank) {
    bank = { recorded: {}, fallback: {}, ready: null };
    banks.set(ctx, bank);
  }
  return bank;
}

/** Call when the first shot unlocks audio, so all recordings arrive before reload. */
export function prepareRevolverReload(snd) {
  if (!snd?.ctx || snd.useSamples === false) return Promise.resolve(false);
  const c = snd.ctx;
  const bank = bankFor(c);
  if (!bank.ready) {
    bank.ready = Promise.all(FILES.map(async (name) => {
      try {
        const res = await fetch(new URL(`sfx/revolver/${name}.wav`, document.baseURI));
        if (!res.ok) return false;
        const bytes = await res.arrayBuffer();
        // Callback + promise support matches Sound.decodeSample (including old Safari).
        const buffer = await new Promise((ok, bad) => c.decodeAudioData(bytes, ok, bad)?.then?.(ok, bad));
        bank.recorded[name] = buffer;
        return true;
      } catch {
        return false;
      }
    })).then((loaded) => loaded.every(Boolean));
  }
  return bank.ready;
}

// Only for missing/disabled recordings: short, damped broadband contacts. This is
// procedural fallback, not a recording. Local PRNG does not consume gameplay RNG.
function fallback(c, bank, key, kind, variant) {
  if (bank.fallback[key]) return bank.fallback[key];
  const duration = kind === 'open' ? 0.4 : kind === 'close' ? 0.23 : 0.18;
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * duration), c.sampleRate);
  const x = buffer.getChannelData(0);
  let seed = (0x6a09e667 ^ (variant + 1) * 0x85ebca6b) >>> 0;
  const random = () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 4294967296 * 2 - 1;
  };
  const contacts = kind === 'open' ? [[0, 0.6, 0.014], [0.1, 0.3, 0.03], [0.24, 0.18, 0.013]]
    : kind === 'close' ? [[0, 0.8, 0.018], [0.075, 0.4, 0.01]]
      : [[0, 0.35, 0.008], [0.055, 0.65, 0.017]];
  for (const [start, amp, decay] of contacts) {
    let low = 0, body = 0;
    const first = Math.round(start * c.sampleRate);
    for (let i = first; i < x.length; i++) {
      const t = (i - first) / c.sampleRate;
      low += (random() - low) * (1 - Math.exp(-2 * Math.PI * 5200 / c.sampleRate));
      body += (low - body) * (1 - Math.exp(-2 * Math.PI * 180 / c.sampleRate));
      x[i] += (low - body) * amp * Math.min(1, t / 0.001) * Math.exp(-t / decay);
    }
  }
  const fade = Math.min(x.length, Math.round(c.sampleRate * 0.02));
  for (let i = 0; i < fade; i++) x[x.length - 1 - i] *= i / fade;
  bank.fallback[key] = buffer;
  return buffer;
}

/** One open/insert/close at the existing simulation tick. Returns its tracked voice. */
export function playRevolverReload(snd, pos, kind, roundNumber) {
  if (!snd?.ctx || !snd._on || !Object.hasOwn(GAIN, kind)) return null;
  const bank = bankFor(snd.ctx);
  if (kind === 'open') rounds.set(snd, 0);
  // The gun scheduler supplies its own 1..6 index. Opponents share one Sound;
  // their interleaved opens/inserts must not reset one another's sample sequence.
  const indexed = Number.isInteger(roundNumber) && roundNumber >= 1 && roundNumber <= 6;
  const variant = indexed ? roundNumber - 1 : rounds.get(snd) || 0;
  const key = kind === 'insert' ? `insert${variant % 6 + 1}` : kind;
  if (kind === 'insert' && !indexed) rounds.set(snd, variant + 1);
  void prepareRevolverReload(snd);
  const recorded = snd.useSamples !== false && bank.recorded[key];
  const buffer = recorded || fallback(snd.ctx, bank, key, kind, variant % 6);
  const ev = snd.event({ bus: snd.metalBus, gain: GAIN[kind], prio: 1, pos });
  snd.layer(ev, buffer);
  return ev;
}

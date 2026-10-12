#!/usr/bin/env node
// Read-only asset audit. Writes only its JSON report; never edits recordings or casting.
// node tools/audio/voice_inventory_20261012.mjs [output.json] [--strict] [--target=2]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { VOICES } from '../../src/sound.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const output = path.resolve(args.find(x => !x.startsWith('--')) || path.join(root, 'docs/sound/voice_inventory_20261012.json'));
const target = Number(args.find(x => x.startsWith('--target='))?.slice(9) || 2);
if (!Number.isInteger(target) || target < 1) throw new Error('target must be a positive integer');
// User-approved exception: player keeps its original single quiet death recording.
const targetOverrides = { player: { hurt: 2, ko: 1, bleed: 1 } };
const eventTarget = (id, kind) => targetOverrides[id]?.[kind] ?? target;
const kinds = ['hurt', 'ko', 'bleed'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const run = (bin, argv) => execFileSync(bin, argv, { maxBuffer: 128 * 1024 * 1024 });
const manifestPath = 'docs/sound/voice_refresh_assets_20261012.json';
const catalogPath = 'public/voice-casting.json';
const manifestExists = fs.existsSync(path.join(root, manifestPath));
const inputs = ['src/sound.js', 'src/characters.js', 'src/characters_expansion.js', 'src/characters_wanderers.js', 'src/main.js', 'public/sfx/LICENSE.txt',
  ...(fs.existsSync(path.join(root, catalogPath)) ? [catalogPath] : []), ...(manifestExists ? [manifestPath] : [])];
const inputHashes = Object.fromEntries(inputs.map(p => [p, sha(fs.readFileSync(path.join(root, p)))]));
const licenseLines = fs.readFileSync(path.join(root, 'public/sfx/LICENSE.txt'), 'utf8').split('\n');
const licenseLine = text => licenseLines.findIndex(x => x.includes(text)) + 1;
const sources = {
  haeldb: { author: 'HaelDB', title: 'Male Grunt/Yelling sounds', license: 'CC0', url: 'https://opengameart.org/content/male-gruntyelling-sounds', licenseLine: licenseLine('CC0 (public domain) — HaelDB'), originalLocated: false },
  baradari: { author: 'Michel Baradari', title: '11 male human pain/death sounds', license: 'CC-BY-3.0', url: 'https://opengameart.org/content/11-male-human-paindeath-sounds', licenseLine: licenseLine('CC-BY 3.0 — Michel'), originalLocated: false },
  kanyonwyvern: { author: 'kanyonwyvern', title: 'Male Groan in Exhaustion', license: 'CC0', url: 'https://freesound.org/people/kanyonwyvern/sounds/736662/', originalLocated: false },
  hisoul_exhale: { author: 'hisoul', title: 'Zisa, Relief, Moan, Tired, Exhale_2.wav', license: 'CC0', url: 'https://freesound.org/people/hisoul/sounds/520276/', originalLocated: false },
  hisoul_hurt: { author: 'hisoul', title: 'Zisa, Pain, Shout Short, Impact_6.wav', license: 'CC0', url: 'https://freesound.org/people/hisoul/sounds/520275/', originalLocated: false },
  mvvoice: { author: 'mvVoiceActing', title: 'girl damage', license: 'CC0', url: 'https://freesound.org/people/mvVoiceActing/sounds/855460/', originalLocated: false },
  reitanna_gasp: { author: 'Reitanna', title: 'gasp.wav', license: 'CC0', url: 'https://freesound.org/people/Reitanna/sounds/241563/', originalLocated: false, retainedProcessedCopy: 'docs/sound_reserve/reitanna_gasp.mp3' },
  reitanna_sigh: { author: 'Reitanna', title: 'long sigh.wav', license: 'CC0', url: 'https://freesound.org/people/Reitanna/sounds/242690/', originalLocated: false, retainedProcessedCopy: 'docs/sound_reserve/reitanna_long_sigh.mp3' },
  breath: { author: 'Sadiquecat', title: 'Catching breath (Genuine)', license: 'CC0', url: 'https://freesound.org/people/Sadiquecat/sounds/792641/', originalLocated: false, retainedProcessedCopy: 'public/sfx/breath/breath1.mp3', originalIntervalSeconds: [0.05, 2.35] },
  thebard: { author: 'thebardofblasphemy', title: 'grunts of male death and pain', license: 'CC0-1.0', url: 'https://opengameart.org/content/grunts-male-death-and-pain', localOriginal: process.env.VOICE_THEBARD_SOURCE || '/tmp/voice-male-candidate-20261011/thebard_death_pain_grunts.wav', expectedSHA256: '3f00fba827f20ff9ccea1bc07d2c21ab8d3a36e81b48a6005cf8459f02779586', licenseLine: licenseLine('2026-10-11 Omari new recording bank') },
};
const provenance = {};
function map(source, files) {
  for (const [asset, original] of Object.entries(files)) provenance[`voice/${asset}`] = { source, ...(Array.isArray(original) ? { intervalSeconds: original } : { originalFile: original }) };
}
map('haeldb', {
  player_ko1: '3grunt3.wav', player_ko2: '3grunt5.wav', player_bleed1: '3yell10.wav', player_bleed2: '3yell13.wav', player_hurt1: '3grunt1.wav', player_hurt2: '3grunt4.wav',
  generic_ko1: 'yell12.wav', generic_ko2: 'yell13.wav', generic_bleed1: 'yell3.wav', generic_bleed2: 'yell8.wav', generic_hurt1: 'yell7.wav', generic_hurt2: 'yell9.wav',
  heinrich_ko1: '2yell1.wav', heinrich_ko2: '2yell10.wav', heinrich_bleed1: '2yell6.wav', heinrich_bleed2: '2yell8.wav', heinrich_hurt1: '2yell7.wav', heinrich_hurt2: '2yell2.wav',
  liao_ko1: '2yell11.wav', liao_bleed1: '2yell3.wav', liao_bleed2: '2yell9.wav', liao_hurt1: '2yell4.wav', liao_hurt2: '2yell5.wav',
});
for (const [p, interval] of Object.entries({ liao_ko1: [0.33, 0.78], liao_hurt1: [0.6, 1.02], liao_hurt2: [0.2, 0.72] })) provenance[`voice/${p}`].intervalSeconds = interval;
map('baradari', { bran_ko1: 'die1.wav', bran_ko2: 'deathh.wav', bran_bleed1: 'die2.wav', bran_hurt1: 'pain1.wav', bran_hurt2: 'pain3.wav' });
map('kanyonwyvern', { bran_bleed2: '736662 preview MP3' });
map('hisoul_exhale', { margarethe_ko1: '520276 preview MP3', margarethe_bleed1: '520276 preview MP3' });
map('hisoul_hurt', { margarethe_hurt1: '520275 preview MP3' });
map('mvvoice', { isolde_hurt1: [0.4, 1.3], isolde_hurt2: [1.9, 2.7], isolde_ko1: [3.3, 4.4], isolde_bleed1: [7.8, 8.9], isolde_revive1: [6.55, 7.02] });
map('reitanna_gasp', { reitanna_gasp: '241563 preview MP3' });
map('reitanna_sigh', { reitanna_long_sigh: '242690 preview MP3' });
map('breath', { player_exhale: [0.88, 1.78] });
provenance['voice/player_exhale'].intervalRelativeTo = 'public/sfx/breath/breath1.mp3 (already trimmed source)';
map('thebard', { omari_hurt1: [6.9, 7.47], omari_hurt2: [8.31, 9.26], omari_ko1: [0.45, 2.02], omari_ko1_short: [0.45, 1.863], omari_bleed1: [3.9, 6.2], omari_bleed1_short: [3.9, 5.74], omari_bleed1_short2: [3.9, 5.556] });

// Optional current-edit provenance augments (and can supersede) the baseline map.
// No local original master is required: portable provenance uses source hashes.
const assetManifest = manifestExists ? JSON.parse(fs.readFileSync(path.join(root, manifestPath), 'utf8')) : null;
if (assetManifest) {
  if (!Array.isArray(assetManifest.sources) || !Array.isArray(assetManifest.files)) throw new Error(`${manifestPath}: expected sources and files arrays`);
  const sourceIDs = new Set(), assetPaths = new Set();
  for (const source of assetManifest.sources) {
    if (typeof source.id !== 'string' || !source.id || sourceIDs.has(source.id)) throw new Error(`${manifestPath}: invalid or duplicate source id`);
    sourceIDs.add(source.id);
    sources[source.id] = { ...sources[source.id], ...source, ...(source.source_sha256 ? { expectedSHA256: source.source_sha256 } : {}) };
  }
  for (const file of assetManifest.files) {
    if (typeof file.path !== 'string' || !/^voice\/[a-zA-Z0-9_-]+$/.test(file.path) || assetPaths.has(file.path)) throw new Error(`${manifestPath}: invalid or duplicate asset path`);
    if (!sources[file.source]) throw new Error(`${manifestPath}: unknown source for ${file.path}`);
    if (!Number.isFinite(file.source_start) || !Number.isFinite(file.source_end) || file.source_start < 0 || file.source_end <= file.source_start) throw new Error(`${manifestPath}: invalid source interval for ${file.path}`);
    if (typeof file.sha256 !== 'string' || !/^[a-fA-F0-9]{64}$/.test(file.sha256)) throw new Error(`${manifestPath}: invalid asset SHA-256 for ${file.path}`);
    assetPaths.add(file.path);
    provenance[file.path] = { source: file.source, intervalSeconds: [file.source_start, file.source_end], ...(file.performance_id ? { performanceId: file.performance_id } : {}), edits: file.edits ?? null, expectedAssetSHA256: file.sha256.toLowerCase(), manifest: manifestPath };
  }
}

function analyze(file) {
  if (!fs.existsSync(file)) return { exists: false };
  const data = fs.readFileSync(file);
  const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,sample_rate,channels', '-of', 'json', file]));
  const pcm = run('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:a:0', '-ac', '1', '-ar', '48000', '-f', 'f32le', '-']);
  let peak = 0, sum = 0, nonFinite = 0;
  for (let i = 0; i < pcm.length; i += 4) {
    const x = pcm.readFloatLE(i);
    if (!Number.isFinite(x)) nonFinite++;
    else { peak = Math.max(peak, Math.abs(x)); sum += x * x; }
  }
  return { exists: true, bytes: data.length, sha256: sha(data), decodedPCM_SHA256: sha(pcm), decodedFrames: pcm.length / 4, decodedSeconds: pcm.length / 4 / 48000, containerSeconds: Number(probe.format.duration), streams: probe.streams, peak, rms: Math.sqrt(sum / (pcm.length / 4)), nonFinite };
}
const expand = (id, rec, kind) => Array.isArray(rec[kind]) ? rec[kind] : Array.from({ length: rec[kind] || 0 }, (_, i) => `voice/${id}_${kind}${i + 1}`);
const selections = Object.fromEntries(Object.entries(VOICES).map(([id, p]) => [id, Object.fromEntries([...kinds, 'revive'].map(k => [k, expand(id, p.rec || {}, k)]))]));
const selected = new Set(Object.values(selections).flatMap(Object.values).flat());
const publicAssets = fs.readdirSync(path.join(root, 'public/sfx/voice')).filter(x => /\.(mp3|ogg|wav)$/i.test(x)).map(x => `voice/${x.replace(/\.[^.]+$/, '')}`);
const files = Object.fromEntries([...new Set([...publicAssets, ...selected])].sort().map(p => [p, {
  path: `public/sfx/${p}.mp3`, selected: selected.has(p), provenance: provenance[p] || null, ...analyze(path.join(root, `public/sfx/${p}.mp3`)),
}]));
const group = (values, key) => Object.values(values.reduce((m, x) => { const k = key(x); if (k) (m[k] ||= []).push(x); return m; }, {})).filter(xs => xs.length > 1);
const fileAliases = group(Object.keys(files), p => files[p].decodedPCM_SHA256).map(paths => ({ paths, decodedPCM_SHA256: files[paths[0]].decodedPCM_SHA256, sameEncodedBytes: new Set(paths.map(p => files[p].sha256)).size === 1 }));
const characters = Object.values(CHARACTERS_BY_ID).map(c => {
  const requestedVoice = c.voice || c.variantOf || c.id || 'generic';
  return { id: c.id, name: c.name, age: c.age ?? null, explicitVoice: c.voice ?? null, variantOf: c.variantOf ?? null, requestedVoice, voice: requestedVoice in VOICES ? requestedVoice : 'generic', fallback: !(requestedVoice in VOICES) };
});
const subjects = [...characters, { id: '@player', name: 'Player', voice: 'player' }, { id: '@generic', name: 'Generic fallback', voice: 'generic' }];
const expectedCatalog = [...characters.map(({ id, name, voice }) => ({ id, name, voice })), { id: 'player', name: '플레이어', voice: 'player' }];
const catalog = { path: catalogPath, expectedIDs: expectedCatalog.map(c => c.id), errors: [] };
try {
  const rows = JSON.parse(fs.readFileSync(path.join(root, catalogPath), 'utf8'));
  if (!Array.isArray(rows)) throw new Error('expected an array');
  catalog.actualIDs = rows.map(c => c?.id);
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row?.id)) catalog.errors.push({ type: 'duplicate', id: row?.id });
    seen.add(row?.id);
    const expected = expectedCatalog.find(c => c.id === row?.id);
    if (!expected) { catalog.errors.push({ type: 'unexpected', id: row?.id }); continue; }
    for (const field of ['name', 'voice']) if (row[field] !== expected[field]) catalog.errors.push({ type: 'mismatch', id: row.id, field, expected: expected[field], actual: row[field] ?? null });
  }
  for (const expected of expectedCatalog) if (!seen.has(expected.id)) catalog.errors.push({ type: 'missing', id: expected.id });
} catch (error) { catalog.errors.push({ type: 'read', message: error.message }); }
catalog.pass = catalog.errors.length === 0;
const profiles = Object.fromEntries(Object.entries(VOICES).map(([id, p]) => {
  const events = Object.fromEntries([...kinds, 'revive'].map(kind => {
    const paths = selections[id][kind];
    const hashes = paths.map(p => files[p].decodedPCM_SHA256).filter(Boolean);
    const distinctCount = new Set(hashes).size;
    const required = eventTarget(id, kind);
    return [kind, { paths, configuredCount: paths.length, decodedCount: hashes.length, distinctCount, ...(kinds.includes(kind) ? { target: required, shortage: Math.max(0, required - distinctCount) } : {}), aliases: group(paths.map((path, index) => ({ path, index })), x => files[x.path].decodedPCM_SHA256) }];
  }));
  const crossEventAliases = [];
  for (let a = 0; a < kinds.length; a++) for (let b = a + 1; b < kinds.length; b++) {
    for (const first of events[kinds[a]].paths) for (const second of events[kinds[b]].paths) if (files[first].decodedPCM_SHA256 && files[first].decodedPCM_SHA256 === files[second].decodedPCM_SHA256) crossEventAliases.push({ kinds: [kinds[a], kinds[b]], files: [first, second], samePath: first === second });
  }
  return [id, { subjects: subjects.filter(c => c.voice === id).map(c => c.id), gain: p.rec?.gain ?? 1, rate: p.rec?.rate ?? 1, mute: !!p.mute, events, crossEventAliases, hurtKODistinct: !crossEventAliases.some(x => x.kinds[0] === 'hurt' && x.kinds[1] === 'ko'), targetCountsMet: kinds.every(k => events[k].configuredCount === eventTarget(id, k) && events[k].distinctCount === eventTarget(id, k)) }];
}));

// Current correction scope only. Other retained cross-event sharing stays visible
// in crossEventAliases; this is not a claim that every KO/bleed bank is disjoint.
const deathSeparationChecks = [], deathSeparationConcerns = [];
for (const id of ['soft_female', 'margarethe']) {
  for (const ko of selections[id]?.ko || []) for (const bleed of selections[id]?.bleed || []) {
    const reasons = [];
    {
      if (files[ko]?.decodedPCM_SHA256 && files[ko].decodedPCM_SHA256 === files[bleed]?.decodedPCM_SHA256) reasons.push('identical decoded recording');
      const a = provenance[ko], b = provenance[bleed];
      const sourceA = sources[a?.source], sourceB = sources[b?.source];
      const sourceHashA = sourceA?.source_sha256 || sourceA?.expectedSHA256;
      const sourceHashB = sourceB?.source_sha256 || sourceB?.expectedSHA256;
      const sameOriginal = !!a && !!b && (a.source === b.source || (sourceHashA && sourceHashA === sourceHashB));
      if (sameOriginal) {
        const overlap = a.intervalSeconds && b.intervalSeconds && Math.max(a.intervalSeconds[0], b.intervalSeconds[0]) < Math.min(a.intervalSeconds[1], b.intervalSeconds[1]);
        if (overlap) reasons.push('overlapping intervals of the same original recording');
        else if (!a.performanceId || !b.performanceId || a.performanceId === b.performanceId) reasons.push('same original recording without documented separate performances');
      }
    }
    const check = { profile: id, ko, bleed, pass: reasons.length === 0, reasons };
    deathSeparationChecks.push(check);
    if (!check.pass) deathSeparationConcerns.push(check);
  }
}

function nonSilentIntervals(file, duration) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'silencedetect=noise=-36dB:d=0.12', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr);
  const intervals = []; let start = 0;
  for (const match of result.stderr.matchAll(/silence_(start|end): ([0-9.]+)/g)) {
    const t = Number(match[2]);
    if (match[1] === 'start') { if (t > start) intervals.push([start, t]); }
    else start = t;
  }
  if (start < duration - 0.001) intervals.push([start, duration]);
  return intervals;
}
const sourceInventory = [];
for (const [id, source] of Object.entries(sources)) {
  const local = source.localOriginal || (source.retainedProcessedCopy && path.join(root, source.retainedProcessedCopy));
  if (!local || !fs.existsSync(local)) continue;
  const analysis = analyze(local);
  const retainedIntervals = Object.entries(provenance).filter(([, p]) => p.source === id && p.intervalSeconds).map(([asset, p]) => ({ asset, selected: selected.has(asset), interval: p.intervalSeconds }));
  const intervals = nonSilentIntervals(local, analysis.decodedSeconds).map(interval => {
    const overlapsRetainedEdit = retainedIntervals.some(x => Math.max(interval[0], x.interval[0]) < Math.min(interval[1], x.interval[1]));
    return { interval, overlapsRetainedEdit, unusedOriginalCandidate: !!source.localOriginal && !overlapsRetainedEdit };
  });
  source.originalLocated = !!source.localOriginal;
  sourceInventory.push({ source: id, path: local, original: !!source.localOriginal, ...analysis, expectedHashMatches: source.expectedSHA256 ? analysis.sha256 === source.expectedSHA256 : null, retainedIntervals, nonSilentIntervals: intervals });
}
const missing = Object.entries(files).filter(([, x]) => !x.exists).map(([p]) => p);
const assetHashMismatches = Object.entries(files).filter(([, x]) => x.provenance?.expectedAssetSHA256 && x.sha256 !== x.provenance.expectedAssetSHA256).map(([p]) => p);
const excludedLiaoBleed2Selected = selected.has('voice/liao_bleed2');
const excludedPlayerExhale2Selected = selected.has('voice/player_exhale2');
const playerDeathOriginalOnly = ['ko', 'bleed'].every(kind => selections.player?.[kind]?.length === 1 && selections.player[kind][0] === 'voice/player_exhale');
const shortages = Object.entries(profiles).flatMap(([voice, p]) => kinds.filter(k => p.events[k].shortage).map(kind => ({ voice, kind, missingDistinctTakes: p.events[kind].shortage, subjects: p.subjects })));
const changedDuringAudit = inputs.filter(p => sha(fs.readFileSync(path.join(root, p))) !== inputHashes[p]);
const report = {
  schemaVersion: 1, generatedUTC: new Date().toISOString(), baselineCommit: run('git', ['-C', root, 'rev-parse', 'HEAD']).toString().trim(), inputHashes, changedDuringAudit,
  command: 'node tools/audio/voice_inventory_20261012.mjs [output.json] [--strict] [--target=2]',
  method: { rosterResolution: "src/main.js: ch?.voice || ch?.variantOf || ch?.id || 'generic'; unknown Sound voice falls back to generic", pcm: 'ffmpeg decode, mono 48000 Hz float32 little-endian; SHA-256 of complete decoded frames', ffmpeg: run('ffmpeg', ['-version']).toString().split('\n')[0], ffprobe: run('ffprobe', ['-version']).toString().split('\n')[0], silenceDetection: '-36 dB, minimum silence 0.12 s; boundaries are signal evidence, not listening approval' },
  summary: { characters: characters.length, subjectsIncludingPlayerAndFallback: subjects.length, profiles: Object.keys(profiles).length, publicVoiceFiles: publicAssets.length, selectedUniqueFiles: selected.size, missingFiles: missing, unknownProvenance: Object.entries(files).filter(([, x]) => !x.provenance).map(([p]) => p), missingDistinctSlots: shortages.reduce((n, x) => n + x.missingDistinctTakes, 0), hurtKOAliasProfiles: Object.keys(profiles).filter(id => !profiles[id].hurtKODistinct), allTargetCountsMet: Object.values(profiles).every(p => p.targetCountsMet), allHurtKODistinct: Object.values(profiles).every(p => p.hurtKODistinct), catalogMatchesRoster: catalog.pass, excludedLiaoBleed2Selected, excludedPlayerExhale2Selected, playerDeathOriginalOnly, requiredDeathSeparationMet: deathSeparationConcerns.length === 0, deathSeparationConcerns, assetHashMismatches },
  target, targetOverrides, subjects, catalog, profiles, deathSeparationChecks, shortages, fileAliases, files, sources, sourceInventory, assetManifest: manifestExists ? { path: manifestPath, sources: assetManifest.sources.length, files: assetManifest.files.length } : null,
  preservedConstraints: [ 'Liao voice/liao_bleed2 is a rejected recording; do not fill the shortage by restoring it.', 'Yeongman keeps the original Isolde actor and existing takes.', 'Explicit player exception: hurt keeps two takes; KO and bleed each select only the original voice/player_exhale. voice/player_exhale2 must stay unselected. Existing tinnitus behavior is outside this inventory.', 'Sharing a complete voice set between characters is permitted, including Sherpa.', 'Maya requires a separate new profile; current crown_boss assignment is recorded exactly as observed.' ],
  limitations: [ 'Exact PCM equality proves aliases; different hashes alone do not prove separate performances. Trims, gain changes or re-encodes of one take are not new recordings.', 'Provenance is transcribed from public/sfx/LICENSE.txt, not freshly verified on source websites.', 'Search of /tmp and /workspace/halfsword-handoff excluded build/mirror asset trees; only the Omari original was located. Missing masters may exist elsewhere.', 'No human audition, actor-age verification, browser playback, gameplay changes, external communication or deployment performed.', 'Non-silent source intervals are technically available candidates and need listening before use.', 'The target concerns hurt, KO and bleed; Isolde revive remains separately inventoried.' ],
};
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output, ...report.summary, shortages }, null, 2));
if (changedDuringAudit.length || missing.length || (args.includes('--strict') && (!report.summary.allTargetCountsMet || !report.summary.allHurtKODistinct || !catalog.pass || excludedLiaoBleed2Selected || excludedPlayerExhale2Selected || !playerDeathOriginalOnly || deathSeparationConcerns.length || assetHashMismatches.length || report.summary.unknownProvenance.length))) process.exitCode = 1;

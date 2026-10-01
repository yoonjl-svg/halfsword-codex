// ─────────────────────────────────────────────────────────────
//  기준 동작 클립 검사기 (동작 연구 PM) — 규칙: docs/motion/clip_format.md §6 "검사 규칙" (코드: lib/clip_rules.mjs)
//   node tools/motion/validate_clip.mjs                       → docs/motion/clips/index.json 과 그 아래 무기 폴더 index.json 모두
//   node tools/motion/validate_clip.mjs <클립.json | index.json> …
//   --quiet  어긋난 것만 찍는다 (빌드 도구 끝에서 쓴다)
//   --json   결과를 JSON 으로 찍는다
//  종료 코드: 0 = 모두 통과, 1 = 하나라도 어긋남 (규칙 번호와 이유를 찍는다)
// ─────────────────────────────────────────────────────────────
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GUARDS, GUARD_BASE_ONE } from '../../src/guards.js';
import { GAME_GUARDS, GAME_GUARDS_ONE } from './lib/cuts.mjs';
import { WEAPONS } from '../../src/weapons.js';
import { bladeDir } from './lib/body.mjs';
import { checkClip, checkIndex, GUARD_NAMES } from './lib/clip_rules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLIPS = join(ROOT, 'docs', 'motion', 'clips');

/** 게임 자세표(src/guards.js GUARDS) → { 자세 id: { hand, dir, pelvisYaw, chestYaw, pitch, drop } } */
export function gameGuards() {
  const out = {};
  for (const [id, name] of Object.entries(GUARD_NAMES)) {
    const g = GUARDS.find((x) => x.name === name);
    if (!g) throw new Error(`src/guards.js 에 자세 '${name}' (${id}) 가 없다 — lib/clip_rules.mjs GUARD_NAMES 를 게임에 맞출 것`);
    out[id] = { hand: g.hand, dir: g.dir, pelvisYaw: g.pelvisYaw, chestYaw: g.chestYaw, pitch: g.pitch, drop: g.drop };
  }
  return out;
}
/** 한손 무기 자세표 — 게임이 내보내는 src/guards.js GUARD_BASE_ONE (GUARDS 에 ONE_HAND 를 덮은 것, main b403696 부터) */
export function gameGuardsOne() {
  const out = {};
  for (const [id, name] of Object.entries(GUARD_NAMES)) {
    const g = GUARD_BASE_ONE.find((x) => x.name === name);
    if (!g) throw new Error(`src/guards.js GUARD_BASE_ONE 에 자세 '${name}' (${id}) 가 없다 — lib/clip_rules.mjs GUARD_NAMES 를 게임에 맞출 것`);
    out[id] = { hand: g.hand, dir: g.dir, pelvisYaw: g.pelvisYaw, chestYaw: g.chestYaw, pitch: g.pitch, drop: g.drop };
  }
  return out;
}
/** 무기 → 게임 자세표. 두손 무기는 guards.js GUARDS, 한손 자세 무기(weapons.js oneHandStance)는 한손 표 */
let cache, cacheOne;
export function guardsFor(weapon) {
  const w = WEAPONS[weapon];
  if (!w) return null;
  return w.oneHandStance ? (cacheOne ??= gameGuardsOne()) : (cache ??= gameGuards());
}

/** X1: 빌드 도구가 쓰는 자세표 사본(lib/cuts.mjs GAME_GUARDS·GAME_GUARDS_ONE)이 게임과 같은가 */
export function checkGuardCopy() {
  return [...copyDiff(GAME_GUARDS, gameGuards(), 'GAME_GUARDS'), ...copyDiff(GAME_GUARDS_ONE, gameGuardsOne(), 'GAME_GUARDS_ONE (한손)')];
}
function copyDiff(copy, g, label) {
  const out = [];
  const D = Math.PI / 180;
  for (const [id, c] of Object.entries(copy)) {
    const w = g[id];
    if (!w) {
      out.push({ rule: 'X1', level: 'error', msg: `사본 자세 ${id} 가 게임에 없다` });
      continue;
    }
    const d = bladeDir(c.blade[0], c.blade[1]);
    const diff =
      c.hand.some((v, k) => Math.abs(v - w.hand[k]) > 1e-9) ||
      d.some((v, k) => Math.abs(v - w.dir[k]) > 1e-9) ||
      Math.abs(c.pelvisYaw * D - w.pelvisYaw) > 1e-9 ||
      Math.abs(c.chestYaw * D - w.chestYaw) > 1e-9 ||
      Math.abs(c.pitch * D - w.pitch) > 1e-9 ||
      Math.abs(c.drop - w.drop) > 1e-9;
    if (diff) out.push({ rule: 'X1', level: 'error', msg: `자세표 사본 ${label} ${id} 가 게임 src/guards.js 와 다르다 — lib/cuts.mjs 를 고치고 클립을 다시 만들 것` });
  }
  return out;
}

function readJSON(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    return e instanceof Error ? e : new Error(String(e));
  }
}

/** 파일 하나(클립 또는 목록) 검사 → { file, kind, items: [{ name, problems }] , top: problems } */
export function validateFile(p) {
  const j = readJSON(p);
  if (j instanceof Error) return { file: p, kind: '?', top: [{ rule: 'F1', level: 'error', msg: `읽지 못함: ${j.message}` }], items: [] };
  if (j.format?.startsWith('stillness-motion-index')) {
    const dir = dirname(p);
    const clips = {};
    for (const e of Array.isArray(j.clips) ? j.clips : []) if (typeof e?.file === 'string') clips[e.file] = existsSync(join(dir, e.file)) ? readJSON(join(dir, e.file)) : new Error('파일 없음');
    const { list, perClip } = checkIndex(j, clips, guardsFor);
    return { file: p, kind: 'index', top: list, items: Object.entries(perClip).map(([f, problems]) => ({ name: f.replace(/\.json$/, ''), problems })) };
  }
  const problems = checkClip(j, { guards: guardsFor(j.weapon), file: p });
  return { file: p, kind: 'clip', top: [], items: [{ name: j.id ?? p, problems }] };
}

/** 기본 대상: docs/motion/clips/index.json + docs/motion/clips/<무기>/index.json */
export function defaultTargets() {
  const out = [join(CLIPS, 'index.json')];
  for (const d of existsSync(CLIPS) ? readdirSync(CLIPS) : []) {
    const p = join(CLIPS, d, 'index.json');
    if (statSync(join(CLIPS, d)).isDirectory() && existsSync(p)) out.push(p);
  }
  return out;
}

/** 결과 찍기 → 모두 통과면 true */
export function report(results, { quiet = false, json = false } = {}) {
  const extra = checkGuardCopy();
  let pass = 0, fail = 0, warns = 0;
  const lines = [];
  if (extra.length) lines.push('게임 자세표', ...extra.map((x) => `  [${x.rule}] ${x.msg}`));
  for (const r of results) {
    const errs = r.top.filter((x) => x.level === 'error');
    const shown = relative(ROOT, r.file);
    if (!quiet || errs.length) lines.push(`${shown && !shown.startsWith('..') ? shown : r.file}${r.kind === 'index' ? ` — 클립 ${r.items.length}개` : ''}`);
    for (const x of r.top) if (!quiet || x.level === 'error') lines.push(`  [${x.rule}] ${x.level === 'warn' ? '(경고) ' : ''}${x.msg}`);
    for (const it of r.items) {
      const e = it.problems.filter((x) => x.level === 'error');
      const w = it.problems.filter((x) => x.level === 'warn');
      warns += w.length;
      if (e.length) fail++;
      else pass++;
      if (quiet && !e.length) continue;
      if (e.length || w.length) {
        lines.push(`  ${e.length ? '실패' : '통과'} ${it.name}`);
        for (const x of quiet ? e : [...e, ...w]) lines.push(`     [${x.rule}] ${x.level === 'warn' ? '(경고) ' : ''}${x.msg}`);
      } else lines.push(`  통과 ${it.name}`);
    }
    if (errs.length) fail += 0; // 목록 자체의 어긋남은 아래 ok 에서 센다
  }
  const topErr = results.some((r) => r.top.some((x) => x.level === 'error')) || extra.length > 0;
  const ok = fail === 0 && !topErr;
  if (json) console.log(JSON.stringify({ ok, pass, fail, warns, guardCopy: extra, results }, null, 1));
  else {
    for (const l of lines) console.log(l);
    console.log(`클립 검사 (clip_format.md §6): 통과 ${pass} · 실패 ${fail}${warns ? ` · 경고 ${warns}` : ''}${topErr ? ' · 목록/자세표 어긋남 있음' : ''} → ${ok ? '통과' : '실패'}`);
  }
  return ok;
}

// 명령줄
if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const files = args.filter((a) => !a.startsWith('--'));
  const targets = files.length ? files.map((f) => resolve(f)) : defaultTargets();
  const ok = report(targets.map(validateFile), { quiet: args.includes('--quiet'), json: args.includes('--json') });
  process.exit(ok ? 0 : 1);
}

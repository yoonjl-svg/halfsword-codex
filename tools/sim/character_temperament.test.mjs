// 인물 다섯 유파 숙련도 · 전투성향 초안 (사장님 10/29 14:5x — src/character_temperament.js · docs/characters/temperament_2026-10-29.md)
//  자료만 본다: 기본 회전 · 손님 인물마다 두 칸 · 값 범위 · 기본 유파 = 시트 숙련도 · 검술을 배우지 못한 인물 · 시트 손잡이와 맞는가
//  node --test tools/sim/character_temperament.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
const { CHARACTERS, CHARACTER_GUESTS, CHARACTER_VARIANTS } = await import('../../src/characters.js');
const { traditionOf } = await import('../../src/schools.js');
const { WEAPONS, getWeapon } = await import('../../src/weapons.js');
const { AI_PROFICIENCY } = await import('../../src/config.js');
const M = await import('../../src/character_temperament.js');

const ROSTER = [...CHARACTERS, ...CHARACTER_GUESTS];
const unit = (v) => typeof v === 'number' && v >= 0 && v <= 1;

test('기본 회전 · 손님 인물마다 숙련도 · 성향 칸이 있고, 남는 칸이 없다', () => {
  const ids = ROSTER.map((c) => c.id).sort();
  assert.deepEqual(Object.keys(M.PROFICIENCY).sort(), ids);
  assert.deepEqual(Object.keys(M.TEMPERAMENT).sort(), ids);
  assert.deepEqual(Object.keys(M.MAIN_SCHOOL).sort(), ids);
  for (const c of CHARACTER_GUESTS) assert.equal(M.TEMPERAMENT[c.id].special, true, c.id);
  for (const c of CHARACTERS) assert.equal(M.TEMPERAMENT[c.id].special, undefined, c.id);
  for (const v of CHARACTER_VARIANTS) assert.equal(M.proficiencyOf(v.id), M.PROFICIENCY[v.variantOf], v.id); // 변형 = 원본 칸
});

test('값 범위: 숙련도 정수 0 ~ 6 · 축 0 ~ 1 · 낱말 칸', () => {
  assert.equal(M.PROF_MAX, AI_PROFICIENCY.levels.length - 1);
  for (const [id, p] of Object.entries(M.PROFICIENCY)) {
    for (const s of M.SCHOOLS) assert.ok(Number.isInteger(p[s]) && p[s] >= M.PROF_MIN && p[s] <= M.PROF_MAX, `${id}.${s}`);
    for (const k of Object.keys(p)) assert.ok(M.SCHOOLS.includes(k) || k === 'none', `${id}.${k}`);
  }
  for (const [id, t] of Object.entries(M.TEMPERAMENT)) {
    for (const a of Object.keys(M.AXES)) assert.ok(unit(t[a]), `${id}.${a} = ${t[a]}`);
    assert.ok(M.WOUNDED.includes(t.wounded), `${id}.wounded`);
    assert.ok(M.TEAM_TARGETS.includes(t.team.target), `${id}.team.target`);
    assert.ok(unit(t.team.guard) && unit(t.team.woundedFight), `${id}.team`);
    for (const [a, d] of Object.entries(t.lean)) assert.ok(a in M.AXES && (d === 1 || d === -1), `${id}.lean.${a}`);
  }
});

test('기본 유파 = 시트 무기 유파 · 그 칸 = 시트 ai.proficiency · 다른 유파는 넘지 않음', () => {
  for (const c of ROSTER) {
    const main = traditionOf(WEAPONS[c.weapon] ?? getWeapon(c.weapon));
    assert.equal(M.MAIN_SCHOOL[c.id], main, c.id);
    const p = M.PROFICIENCY[c.id];
    assert.equal(p[main], c.ai.proficiency, `${c.id} ${main}`);
    if (main !== 'none') assert.equal(p.none, undefined, c.id);
    for (const s of M.SCHOOLS) assert.ok(p[s] <= c.ai.proficiency, `${c.id}.${s}`);
  }
});

test('검술을 배우지 못한 인물(noSwordsmanship)은 다섯 유파 모두 최소', () => {
  const ns = ROSTER.filter((c) => c.noSwordsmanship);
  assert.ok(ns.length >= 1);
  for (const c of ns) for (const s of M.SCHOOLS) assert.equal(M.PROFICIENCY[c.id][s], M.PROF_MIN, `${c.id}.${s}`);
});

test('시트에 적힌 손잡이와 맞는다 (없는 손잡이는 그 범위 어디든 · ±0.05)', () => {
  const get = (persona, path) => path.split('.').reduce((o, k) => o?.[k], persona);
  const bad = [];
  for (const c of ROSTER) {
    for (const [a, ax] of Object.entries(M.AXES)) {
      if (!ax.read) continue;
      const paths = Object.keys(ax.knobs);
      let lo = Infinity, hi = -Infinity;
      for (let m = 0; m < 1 << paths.length; m++) { // 비어 있는 손잡이는 범위 양 끝 (식은 손잡이마다 한쪽으로만 움직인다)
        const k = {};
        paths.forEach((p, i) => { k[p] = get(c.ai.persona, p) ?? ax.knobs[p][(m >> i) & 1]; });
        const r = ax.read(k);
        lo = Math.min(lo, r); hi = Math.max(hi, r);
      }
      const v = M.TEMPERAMENT[c.id][a];
      if (v < lo - 0.05 || v > hi + 0.05) bad.push(`${c.id}.${a} ${v} ∉ [${lo.toFixed(3)}, ${hi.toFixed(3)}]`);
    }
  }
  assert.deepEqual(bad, []);
});

test('성향이 따로 있는 얼터 (ALTER_TEMPERAMENT — 광기의 쥘리아): 있는 얼터 · 값 범위 · temperamentOf 가 먼저 읽음 · 숙련도는 원본 칸', () => {
  const ids = new Set(CHARACTER_VARIANTS.map((v) => v.id));
  for (const [id, t] of Object.entries(M.ALTER_TEMPERAMENT)) {
    assert.ok(ids.has(id), id);
    for (const a of Object.keys(M.AXES)) assert.ok(unit(t[a]), `${id}.${a}`);
    assert.ok(M.WOUNDED.includes(t.wounded) && M.TEAM_TARGETS.includes(t.team.target) && unit(t.team.guard) && unit(t.team.woundedFight), id);
    assert.equal(M.temperamentOf(id), t, id);
    assert.equal(M.proficiencyOf(id), M.PROFICIENCY[CHARACTER_VARIANTS.find((v) => v.id === id).variantOf], id);
  }
});

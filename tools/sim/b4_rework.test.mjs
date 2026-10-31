// B4 다시 짬 시험 (사장님 10/31 19:xx '칼을 더 들어올리거나 아예 어깨에 얹거나. 그리고 칼 끝이 머리 뒤로 넘어와서 땅쪽으로 기울어 있어야 해. 그래야 '그냥 칼을 높이 든 자세'와 구분됨.' ·
//  '수직 말고 45도~90도 사이로 적정 길을 유지해. 살짝 사선이어야 어깨에 얹고 있다가 치는 게 자연스럽고' · 오른 어깨 · 오른 위 → 왼 아래 — 기록 docs/strike/b4_rework_2026-10-31.md ·
//  config UNIQUE_ASSIST.rdWindMode 'load' · rdLoad · rdRelease 'tajo' · rdTajo · IB_FLOW.windmillApart · applyB4Old · 재는 판 tools/sim/b4_probe.mjs)
//  node --test tools/sim/b4_rework.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from './harness_m.mjs';
import { applyB4Old } from '../../src/config.js';
import { b4Run, b4Sum } from './b4_probe.mjs';

const UA = CONFIG.UNIQUE_ASSIST;

test('메기 꼴 — 네 칼 모두 칼 든(오른) 어깨에 메어 칼끝이 머리 뒤로 넘어가 땅 쪽으로 기욺 · 팔 · 칼이 머리 · 목을 안 뚫음 · 칼이 몸통에 안 닿음 · 손목 교정 없음 · 빈손 쥠 · 휘청 · 넘어짐 없음', () => {
  for (const w of ['zweihander', 'flamberge', 'tizona', 'durandal']) {
    const L = b4Sum(b4Run({ w, loadOnly: true, hold: 1.6 })).load;
    assert.ok(L.behind < -0.6, `${w} 칼끝이 머리 가운데보다 뒤 ${L.behind} m`);
    assert.ok(L.below > 0.4, `${w} 칼끝이 손보다 아래 ${L.below} m`);
    assert.ok(L.el <= -20, `${w} 칼 높이각 ${L.el}° (땅 쪽)`);
    assert.ok(L.hand[2] > 0.15, `${w} 손이 칼 든 쪽 ${L.hand[2]} m (오른 어깨)`);
    // 사장님 10/31 19:xx '칼이 어깨를 파고드는 것처럼 보여 … 칼이 어깨 위로 올라와 보이게' — 칼날이 칼 든 어깨 관절 위로 지나고 위팔에 안 닿음
    assert.ok(L.bladeAboveShoulder > 0.05, `${w} 칼날이 어깨 관절 위 ${L.bladeAboveShoulder} m`);
    assert.ok(L.bladeUarm > 0.01, `${w} 칼날 ↔ 위팔 ${L.bladeUarm} m`);
    assert.ok(L.armHead >= 0 && L.armNeck >= 0, `${w} 팔 ↔ 머리 ${L.armHead} · 목 ${L.armNeck} m`);
    assert.ok(L.blend.armHead >= 0 && L.blend.armNeck >= 0, `${w} 메는 길 팔 ↔ 머리 ${L.blend.armHead} · 목 ${L.blend.armNeck} m`);
    assert.ok(L.bladeHead > 0.05 && L.blend.bladeHead > 0.05, `${w} 칼 ↔ 머리 ${L.bladeHead} · 메는 길 ${L.blend.bladeHead} m`);
    assert.ok(L.selfBlade > 0.02 && L.blend.selfBlade > 0.02, `${w} 칼날 ↔ 몸통 ${L.selfBlade} · 메는 길 ${L.blend.selfBlade} m`);
    assert.ok(L.fixMax <= 1, `${w} 손목 교정 ${L.fixMax}°`);
    assert.ok(L.oorShare <= 0.02, `${w} 손목 범위 밖 ${L.oorShare}`);
    assert.ok(L.offGap < 0.07, `${w} 빈손 ↔ 폼멜 ${L.offGap} m`); // 10/31 19:xx 손을 든 메기 — 5 ~ 6.3 cm (그 전 판 3.5)
    assert.ok(L.dTilt < 10 && L.offCm < 6, `${w} 가슴 기울기 ${L.dTilt}° · 발 둘레 밖 ${L.offCm} cm`); // 손을 든 메기 (10/31 19:xx) — 메는 끝 잠깐 0.4 ~ 5.4 cm · 넘어짐 · 휘청 걸음 없음
    assert.equal(L.fell, false, w);
  }
});

test('멘 어깨에서 내려침 — 벰 면이 땅과 60°(사장님 결정) · 오른 위 → 왼 아래 · 정수리부터 · 드는 몫도 벰과 같은 빠르기(사장님 \'2배로 하지 마\') · 팔 · 칼이 내 머리를 안 뚫음 · 안 넘어짐', () => {
  assert.equal(UA.rdTajo.angle, 60);
  assert.equal(UA.rdTajo.liftK, 1);
  for (const w of ['zweihander', 'tizona']) {
    const S = b4Sum(b4Run({ w })).strike;
    assert.ok(Math.abs(S.plane.angle - UA.rdTajo.angle) < 2.5, `${w} 벰 면 ${S.plane.angle}° (목표 ${UA.rdTajo.angle})`);
    assert.ok(S.plane.rms < 0.02, `${w} 면에서 벗어남 RMS ${S.plane.rms} m`);
    assert.ok(S.tip0[2] - S.tip1[2] > 0.3, `${w} 오른 → 왼 — 칼끝 옆 ${S.tip0[2]} → ${S.tip1[2]}`);
    assert.ok(S.tip0[1] - S.tip1[1] > 1.5, `${w} 위 → 아래 — 칼끝 높이 ${S.tip0[1]} → ${S.tip1[1]}`);
    // 11/01 00:xx 빠르기 0.3 → 0.2(사장님 '고노센의 20%로 바꿔') — 츠바이핸더 뗌 → 벰 0.18 → 0.27 s · 첫 상처 0.38 → 0.58 s (드는 몫 · 벰이 같은 빠르기라 함께 늦음)
    assert.ok(S.tLead != null && S.tLead < 0.32, `${w} 뗌 → 벰 ${S.tLead} s`);
    assert.ok(S.tHit != null && S.tHit < 0.66, `${w} 뗌 → 첫 상처 ${S.tHit} s`);
    assert.match(S.first ?? '', /^(head|neck)\//, `${w} 첫 상처 ${S.first}`); // 11/01 빠르기 0.2 — 티소나는 머리에 닿은 힘이 상처 문턱(30 J) 아래라 첫 상처가 목(49 J)
    assert.ok(S.armHead >= 0 && S.armNeck >= 0, `${w} 팔 ↔ 머리 ${S.armHead} · 목 ${S.armNeck} m`);
    assert.ok(S.selfBlade > 0.02, `${w} 칼날 ↔ 몸통 ${S.selfBlade} m`);
    assert.equal(S.fell, false, w);
    assert.ok(S.offCm < 7, `${w} 발 둘레 밖 ${S.offCm} cm`); // 넘어짐 · 휘청 걸음은 없음 — 뗀 뒤 잠깐 2.5 ~ 6.1 cm
  }
});

test('섞는 첫머리(감기 0.3 s)에 떼도 같은 내려침 — 칼이 아직 앞 위면 바로 들고 · 팔이 머리를 안 뚫음 · 안 넘어짐', () => {
  const o = b4Sum(b4Run({ w: 'zweihander', hold: 0.3 }));
  assert.equal(o.fired, true);
  assert.ok(o.strike.armHead >= 0 && o.strike.selfBlade > 0.02, `팔 ↔ 머리 ${o.strike.armHead} · 칼날 ↔ 몸통 ${o.strike.selfBlade}`);
  assert.equal(o.strike.fell, false);
  assert.ok(o.strike.tip0[2] - o.strike.tip1[2] > 0.3, `오른 → 왼 ${o.strike.tip0[2]} → ${o.strike.tip1[2]}`);
});

test('옛 판 스위치 (`?b4Old=1` — applyB4Old): 안 B 어깨(칼끝 위) · 곧장 사선 60° 왼 위 → 오른 아래 · 흐름의 첫 칼 · 다시 끄면 새 판', () => {
  applyB4Old(true);
  try {
    assert.deepEqual([UA.rdWindMode, UA.rdRelease, CONFIG.IB_FLOW.windmillChain, CONFIG.IB_FLOW.windmillApart], ['shoulder', 'direct', 'simple', 0]);
    const o = b4Sum(b4Run({ w: 'zweihander' }));
    assert.ok(o.load.el > 30, `옛 얹은 칼 높이각 ${o.load.el}° (위)`);
    assert.ok(Math.abs(o.strike.plane.angle - 60) < 2.5, `옛 벰 면 ${o.strike.plane.angle}°`);
    assert.ok(o.strike.tip1[2] - o.strike.tip0[2] > 0.3, `왼 → 오른 ${o.strike.tip0[2]} → ${o.strike.tip1[2]}`);
  } finally { applyB4Old(false); }
  assert.deepEqual([UA.rdWindMode, UA.rdRelease, CONFIG.IB_FLOW.windmillChain, CONFIG.IB_FLOW.windmillApart], ['load', 'tajo', 0, 1]);
});

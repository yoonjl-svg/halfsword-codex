// 드루이드의 채찍 소리 시험 (10/24 — docs/import/bernardo_whip_import_2026-10-24.md §3):
//  살 · 옷 맞음 = C2 채찍 녹음(SciFiSounds 'Whip Crack' · CC0 — public/sfx/whip/lash1.mp3) · 주소 ?whipHit=old = 10/23 Thwack ·
//  C2 와 끝 '딱'이 한 맞음에서 두 번 터지지 않게 막음 (src/whip_sound.js whipCrackGate) · 휙 · 딱 걸쇠는 main.js 에서 옮겨 값 그대로
//  node --test tools/sim/whip_sound.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { WHIP_SOUND, whipTipStep, whipHitMode, whipCrackGate } from '../../src/whip_sound.js';
import { SOUND } from '../../src/config.js';
const { Sound } = await import('../../src/sound.js');
const root = (p) => new URL(`../../${p}`, import.meta.url);

/** 소리 카드 없이 Sound.whip 만 돌리는 가짜 — 어떤 녹음을 어느 묶음 · 음량으로 냈나만 적는다 */
function fakeSound(mode = 'c2') {
  SOUND.whipHit = mode; // These legacy comparisons explicitly exercise the retained C2 path.
  const s = Object.create(Sound.prototype), played = [];
  Object.assign(s, { _on: true, ctx: { currentTime: 0 }, useSamples: true, master: 'master', fleshBus: 'flesh', metalBus: 'metal' });
  s.samples = Object.fromEntries(['whipSwish', 'whipCrack', 'whipHit', 'whipLash', 'whipArmor', 'whipClash'].map((k) => [k, [{ name: k }]]));
  s.event = (o) => ({ ...o });
  s.layer = (ev, buf, o) => played.push({ t: s.ctx.currentTime, name: buf.name, bus: ev.bus, layer: o.gain });
  const at = (t, ...a) => { s.ctx.currentTime = t; const n = played.length; s.whip(...a); return played.length > n ? played.at(-1) : null; };
  return { s, played, at };
}

test('휙 · 딱 걸쇠 (main.js whipWhoosh 에서 옮김 — 값 · 셈 그대로 · 확인표 2259)', () => {
  assert.deepEqual(WHIP_SOUND, { swishOn: 9, swishOff: 5, crack: 14 });
  const W = {}, run = (vs) => vs.flatMap((v) => whipTipStep(W, v));
  assert.deepEqual(run([2, 8, 10, 15, 20, 18, 16.9]), [['swish', 10], ['crack', 20]]); // 9 넘어 오를 때 휙 · 최고 20 에서 15 % 꺾일 때 그 최고로 딱
  assert.deepEqual(run([20, 25, 15]), []); // 딱 뒤 잠김: 14 × 0.6 아래로 내려오기 전엔 다시 안 남 · 휙도 5 아래로 내려와야
  assert.deepEqual(run([4, 8, 10, 16, 13]), [['swish', 10], ['crack', 16]]);
});

test('주소 스위치: 기본 = contact · ?whipHit=old = 10/23 Thwack (그 밖의 값은 기본)', () => {
  assert.equal(SOUND.whipHit, 'contact');
  const q = (s) => whipHitMode(new URLSearchParams(s));
  assert.deepEqual(['', 'whipHit=old', 'whipHit=c2', 'whipHit=1', 'weapon=druid_whip&whipHit=old'].map(q), ['contact', 'old', 'c2', 'contact', 'old']);
});

test('맞음 소리 고르기: 살 · 옷 = C2(whipLash · 몸 묶음 · 음량 SOUND.whipLashGain) · 투구 · 판금 = 그대로 · 5 J 아래 소리 없음 · old 판 = Thwack', () => {
  const { at } = fakeSound();
  assert.deepEqual(at(0, 'hit', 40, false), { t: 0, name: 'whipLash', bus: 'flesh', layer: SOUND.whipLashGain });
  assert.deepEqual(at(1, 'hit', 40, true), { t: 1, name: 'whipArmor', bus: 'metal', layer: 0.8 });
  assert.equal(at(2, 'hit', 4, false), null);
  assert.equal(at(3, 'swish', 15)?.name, 'whipSwish');
  assert.equal(at(4, 'clash', 3)?.name, 'whipClash');
  const keep = SOUND.whipHit;
  try {
    SOUND.whipHit = 'old';
    const o = fakeSound('old');
    assert.deepEqual(o.at(0, 'hit', 40, false), { t: 0, name: 'whipHit', bus: 'flesh', layer: 1 });
    assert.equal(o.at(0.01, 'crack', 20)?.name, 'whipCrack'); // old 판은 10/23 그대로 — 겹침 막기 없음
    assert.equal(o.at(0.02, 'hit', 40, false)?.name, 'whipHit');
  } finally { SOUND.whipHit = keep; }
});

test('겹침 막기: C2 뒤 whipLashGap 안의 끝 딱 · C2 는 안 냄 · 끝 딱 뒤 whipFlam 안의 C2 는 안 냄 · 그보다 늦으면 둘 다 · 투구 · 휙 · 칼은 막지 않음', () => {
  assert.deepEqual([SOUND.whipLashGap, SOUND.whipFlam], [0.2, 0.06]);
  const { at } = fakeSound();
  assert.equal(at(0, 'hit', 40, false)?.name, 'whipLash');
  assert.equal(at(0.05, 'crack', 20), null); // 맞아 끝이 꺾여 나는 딱 — 같은 맞음
  assert.equal(at(0.15, 'hit', 60, false), null); // 같은 획의 다른 마디 닿음
  assert.equal(at(0.16, 'hit', 60, true)?.name, 'whipArmor');
  assert.equal(at(0.17, 'swish', 15)?.name, 'whipSwish');
  assert.equal(at(0.25, 'crack', 20)?.name, 'whipCrack'); // 0.2 s 지남
  assert.equal(at(0.28, 'hit', 40, false), null); // 딱 뒤 0.03 s — 거의 같은 때
  assert.equal(at(0.4, 'hit', 40, false)?.name, 'whipLash'); // 딱 뒤 0.15 s — 공중 딱 + 맞음 짝
  assert.equal(at(0.5, 'crack', 20), null);
  const G = {}, o = { whipLashGap: 0.2, whipFlam: 0.06 };
  assert.deepEqual([whipCrackGate(G, 'crack', 0, o), whipCrackGate(G, 'crack', 0.01, o), whipCrackGate(G, 'lash', 0.07, o), whipCrackGate(G, 'crack', 0.2, o), whipCrackGate(G, 'crack', 0.27, o)], [true, true, true, false, true]);
});

test('녹음 파일: lash1.mp3 = provenance 해시 · 모노 44.1 kHz MP3 · 옛 hit1 ~ 3 남음 · 출처 · CC0 기록', () => {
  const prov = JSON.parse(fs.readFileSync(root('public/sfx/whip/provenance.json'), 'utf8'));
  const b = fs.readFileSync(root('public/sfx/whip/lash1.mp3'));
  assert.equal(crypto.createHash('sha256').update(b).digest('hex'), prov.lash1.sha256);
  assert.equal(prov.lash1.srcSha256, '5273b7064ed9da3807f97d48e7d6e806097fef816b797c363567e780a19546e7'); // 받은 HQ 미리듣기
  let i = b.toString('latin1', 0, 3) === 'ID3' ? 10 + ((b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9]) : 0; // ID3v2 꼬리표 건너뜀
  while (!(b[i] === 0xff && (b[i + 1] & 0xe0) === 0xe0)) i++;
  assert.deepEqual([(b[i + 1] >> 3) & 3, (b[i + 2] >> 2) & 3, (b[i + 3] >> 6) & 3], [3, 0, 3]); // MPEG-1 · 44.1 kHz · 모노
  for (const k of [1, 2, 3]) assert.ok(fs.existsSync(root(`public/sfx/whip/hit${k}.mp3`)) && prov[`hit${k}`], `hit${k}`);
  const lic = fs.readFileSync(root('public/sfx/LICENSE.txt'), 'utf8');
  for (const s of ['SciFiSounds', 'sounds/529925', 'publicdomain/zero/1.0', 'whip/lash1.mp3', '?whipHit=old']) assert.ok(lic.includes(s), s);
  assert.match(fs.readFileSync(root('src/sound.js'), 'utf8'), /whipLash: nums\('whip\/lash', 1\)/);
});

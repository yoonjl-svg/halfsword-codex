// 로스터에 없는 무기 시제품 (docs/weapon_types.md §5 가상 무기): 한손 도끼·메이스를 실제 스펙으로 만들어 롱소드와 붙인다.
//  무기 목록에는 넣지 않는다 — 이 도구 안에서만 WEAPONS 에 끼운다. 한손 칼(세이버)의 쥐는 법·손목 보정을 바탕으로
//  자루(가벼운 막대) + 끝에 몰린 머리(도끼날·철퇴 머리)로 바꾼다. 분류(몸 틀·싸움 방식)는 weapon_class.js 가 저절로 정한다.
//  "둔기는 베기와 같은 동작 + 판정만 다르게"(docs/weapon_types.md §4-3) 결정을 숫자로 확인하는 도구.
//   node tools/sim/hybrid.mjs proto_weapons.mjs <proto_axe|proto_mace> [자리마다 판 수=24] [off|on] [zones]
//    on = 동작 라이브러리(그 몸 틀·방식의 자세표·기술), zones = 둔기 부위 효과표(blunt_zones.mjs)를 두 쪽 다
import { newRound, DT } from './harness_m.mjs';
import { WEAPONS } from '../../src/weapons.js';
import { AI, MEASURED } from '../../src/ai.js';
import { SCHOOLS } from '../../src/schools.js';
import { classifyWeapon, weaponPhysics, FRAME_KO, STYLE_KO } from '../../src/weapon_class.js';
import { applyMotionLibrary, motionFor } from '../../src/motion_library.js';
import { zoneEffects, zoneTick } from './blunt_zones.mjs';
import { wilson } from './ref_duel.mjs';

// 부품: [모양, y(칼 원점에서), [질량, 부품 안 무게중심, 가로 관성, 축 관성], 색, 칼날?]
const rodPart = (y0, len, m, color) => [['box', 0.016, len / 2, 0.016], y0 + len / 2, [m, 0, (m * len * len) / 12, 0.00004], color, false];
const headPart = (y, hx, hy, hz, m, color, blade) => [['box', hx, hy, hz], y, [m, 0, (m * (4 * hy * hy + 4 * hx * hx)) / 12, (m * (4 * hx * hx + 4 * hz * hz)) / 12], color, blade];
const base = WEAPONS.sabre;
const EXT = +(process.env.PROTO_EXT ?? 0); // 점검: 자루를 이만큼(m) 늘린다 (길이 0.6 m → 0.6+EXT)
const make = (id, o) => {
  const spec = { ...base, id, partMesh: null, decorate: undefined, thrustStyle: null, techReachScale: undefined, frame: undefined, style: undefined, ...o }; // 몸 틀·방식은 세이버 값을 버리고 새로 정한다
  Object.assign(spec, classifyWeapon(spec));
  WEAPONS[id] = spec;
  return spec;
};
// 한손 도끼 (전투 도끼, 약 0.6 m · 0.95 kg): 자루 0.5 m, 머리 0.6 kg 이 끝에. 날은 머리(도끼날)만
make('proto_axe', {
  nameKo: '한손 도끼 (시제품)', edged: true, mCut: 1.3, mThrust: 0.3, mBlunt: 1.2, material: 'steel',
  hiltLength: 0.5 + EXT, bladeLength: 0.12,
  buildParts: () => [rodPart(-0.08, 0.6 + EXT, 0.35, 0x6b4a2b), headPart(0.56 + EXT, 0.05, 0.06, 0.012, 0.6, 0x9a9a9a, true)],
});
// 메이스 (플랜지 철퇴, 약 0.6 m · 1.2 kg): 자루 0.45 m, 머리 0.9 kg. 날 없음
make('proto_mace', {
  nameKo: '메이스 (시제품)', edged: false, mBlunt: 1.8, material: 'steel',
  hiltLength: 0.45 + EXT, bladeLength: 0.15,
  buildParts: () => [rodPart(-0.08, 0.53 + EXT, 0.3, 0x5a5a5a), headPart(0.52 + EXT, 0.04, 0.075, 0.04, 0.9, 0x8a8a8a, true)],
});

// 간격: ai.js MEASURED 에 없는 무기는 롱소드 칼 길이 비율로 세이버 유파 간격을 한 번 더 줄여 너무 가깝게 선다(0.5배 → 붙은 거리).
//  세이버 실측 줄을 길이 비율(세이버 기준)로 옮겨 적는다 [추정 — 실측은 weapon_measure.mjs 로 다시]
const sabreLen = base.hiltLength + base.bladeLength;
for (const k of ['proto_axe', 'proto_mace']) {
  const r = (WEAPONS[k].hiltLength + WEAPONS[k].bladeLength) / sabreLen;
  const m = MEASURED.sabre;
  MEASURED[k] = [m[0] * (0.6 + 0.4 * r), m[1] * (0.6 + 0.4 * r), m[2], m[3]]; // 팔 길이는 그대로라 몸~칼끝 거리의 칼 몫만 줄인다
}
// 점검: PROTO_TORQUE=손목 토크 한계(기본 세이버 22) — 머리가 무거운 무기가 자세를 버티는가
if (process.env.PROTO_TORQUE) for (const k of ['proto_axe', 'proto_mace']) WEAPONS[k].controlOverrides = { ...WEAPONS[k].controlOverrides, maxAimTorque: +process.env.PROTO_TORQUE };
const [id = 'proto_mace', n = '24', mode = 'off', zones] = process.argv.slice(2);
const W = WEAPONS[id];
const p = weaponPhysics(W);
const on = mode === 'on';
let school = SCHOOLS.sabre ? 'sabre' : 'longsword';
if (on) {
  const m = motionFor(W);
  SCHOOLS[`${id}__lib`] = { ...SCHOOLS[school], id: `${id}__lib`, tech: m.tech, techByName: Object.fromEntries(m.tech.map((t) => [t.name, t])), feints: m.feints, ...(m.counter ? { counter: m.counter } : {}) };
  school = `${id}__lib`;
}
const zOn = zones === 'zones';
const log = {};
let Wn = 0, Ln = 0, D = 0, nan = 0, dealt = 0, taken = 0;
for (let s = 1; s <= +n; s++)
  for (const xFirst of [true, false]) {
    const x = { weapon: id, persona: { school } };
    const y = { weapon: 'longsword', persona: { school: 'longsword' } };
    const P = xFirst ? x : y, E = xFirst ? y : x;
    const G = newRound({ walls: true, seed: (xFirst ? 1000 : 2000) + s, weapon: P.weapon, weapon2: E.weapon, difficulty: 'normal', persona: E.persona, AI2Class: AI, difficulty2: 'normal', persona2: P.persona });
    const X = xFirst ? G.player : G.enemy, Y = xFirst ? G.enemy : G.player;
    if (on) applyMotionLibrary(X, { ai: xFirst ? G.ai2 : G.ai, cover: false });
    if (zOn) (zoneEffects(Y, log), zoneEffects(X, {}));
    let res = 'D';
    for (let i = 0; i < 40 / DT; i++) {
      G.step();
      if (zOn) (zoneTick(Y, DT), zoneTick(X, DT));
      const v = X.sword.linvel();
      if (![v.x, v.y, v.z].every(Number.isFinite)) { nan++; break; }
      if (X.state === 'dead' || Y.state === 'dead') { res = X.state === 'dead' && Y.state === 'dead' ? 'D' : Y.state === 'dead' ? 'W' : 'L'; break; }
    }
    dealt += G.wounds.filter((w) => w.att === X).length;
    taken += G.wounds.filter((w) => w.att === Y).length;
    if (res === 'W') Wn++; else if (res === 'L') Ln++; else D++;
  }
const N = 2 * +n, [lo, hi] = wilson(Wn, N);
console.log(`I ${p.I.toFixed(3)} · ${W.nameKo} (${FRAME_KO[W.frame]}·${STYLE_KO[W.style]}, ${p.mass.toFixed(2)} kg, 무게중심 ${p.com.toFixed(2)} m) 라이브러리 ${on ? '켬' : '끔'}${zOn ? ' + 부위 효과표' : ''}: 승 ${Wn} 패 ${Ln} 무 ${D} / ${N} · 승률 ${Math.round((100 * Wn) / N)}% (95% ${Math.round(100 * lo)}~${Math.round(100 * hi)}%) · NaN ${nan} · 낸 상처 ${dealt} · 받은 상처 ${taken}` + (zOn ? ' · ' + Object.entries(log).map(([k, v]) => `${k} ${v}`).join(' · ') : ''));

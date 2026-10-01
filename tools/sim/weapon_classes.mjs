// 무기 유형표 (docs/weapon_types.md): 무기마다 몸 틀 × 싸움 방식과, 판정에 쓴 질량 분포를 찍는다.
//   node tools/sim/weapon_classes.mjs
import { WEAPON_LIST } from '../../src/weapons.js';
import { weaponPhysics, FRAME_KO, STYLE_KO } from '../../src/weapon_class.js';

console.log('| 무기 | 등급 | 몸 틀 | 싸움 방식 | 길이 m | 질량 kg | 무게중심 m | 관성 kg·m² |');
console.log('|---|---|---|---|---|---|---|---|');
for (const w of WEAPON_LIST) {
  const p = weaponPhysics(w);
  console.log(`| ${w.nameKo.split(' (')[0]}${w.id === 'excalibur_replica' ? ' (복제품)' : ''} | ${w.tier} | ${FRAME_KO[w.frame]} | ${STYLE_KO[w.style]} | ${p.length.toFixed(2)} | ${p.mass.toFixed(2)} | ${p.com.toFixed(2)} | ${p.I.toFixed(3)} |`);
}

// ── 새 무기를 넣으면 칸이 저절로 정해지나 (가상의 무기 — 로스터에 없다) ──
//  부품: [모양, y, [질량, 부품 안 무게중심, 가로 관성, 축 관성], 색, 칼날?] (weapons.js partTuple). 자루는 가벼운 막대, 머리·날은 끝에 몰린 덩어리
import { classifyWeapon } from '../../src/weapon_class.js';
const rod = (y, m, len) => [['box'], y, [m, 0, (m * len * len) / 12, 0.0001], 0, false];
const lump = (y, m) => [['box'], y, [m, 0, 0.002, 0.0005], 0, true];
const HYPO = [
  { nameKo: '한손 도끼', grip: 'one-hand', edged: true, mCut: 1.3, mThrust: 0.3, hiltLength: 0.5, bladeLength: 0.15, parts: () => [rod(0.25, 0.35, 0.5), lump(0.55, 0.6)] },
  { nameKo: '메이스', grip: 'one-hand', edged: false, mBlunt: 1.8, hiltLength: 0.45, bladeLength: 0.15, parts: () => [rod(0.22, 0.3, 0.45), lump(0.52, 0.9)] },
  { nameKo: '대형 도끼 (양손)', grip: 'two-hand', edged: true, mCut: 1.4, mThrust: 0.3, hiltLength: 0.8, bladeLength: 0.2, parts: () => [rod(0.4, 0.8, 0.9), lump(0.85, 1.6)] },
  { nameKo: '창', grip: 'two-hand', handGap: 0.6, edged: true, mCut: 0.5, mThrust: 1.4, hiltLength: 1.5, bladeLength: 0.25, parts: () => [rod(0.3, 1.2, 2.2), lump(1.6, 0.3)] },
  { nameKo: '할버드', grip: 'two-hand', handGap: 0.55, edged: true, mCut: 1.3, mThrust: 1.0, hiltLength: 1.4, bladeLength: 0.3, parts: () => [rod(0.3, 1.4, 2.0), lump(1.5, 1.0)] },
  { nameKo: '카타나', grip: 'two-hand', edged: true, mCut: 1.3, mThrust: 0.9, hiltLength: 0.25, bladeLength: 0.7, parts: () => [rod(0.0, 0.25, 0.25), lump(0.55, 0.85)] },
  { nameKo: '단검', grip: 'one-hand', edged: true, mCut: 0.8, mThrust: 1.3, hiltLength: 0.1, bladeLength: 0.25, parts: () => [rod(0.0, 0.1, 0.1), lump(0.2, 0.2)] },
];
console.log('\n가상의 새 무기 (수치만 넣으면 칸이 정해진다):');
console.log('| 무기 | 몸 틀 | 싸움 방식 | 질량 kg | 무게중심 m | 관성 kg·m² |');
console.log('|---|---|---|---|---|---|');
for (const h of HYPO) {
  const spec = { ...h, buildParts: h.parts };
  const c = classifyWeapon(spec);
  console.log(`| ${h.nameKo} | ${FRAME_KO[c.frame]} | ${STYLE_KO[c.style]} | ${c.phys.mass.toFixed(2)} | ${c.phys.com.toFixed(2)} | ${c.phys.I.toFixed(3)} |`);
}

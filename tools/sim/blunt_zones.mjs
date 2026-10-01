// 둔기 부위 효과표 시제품 — 연구 세션 claude/pm-weapons docs/pole_strike_effects.md ①-3 [추정 문턱]. 게임 코드는 그대로 두고
//  맞는 쪽 파이터의 applyWound 만 감싼다. 찌름(poke) = 둔기 타격 방향이 무기 축과 나란함(|cos| > 0.7). 에너지는 판정 에너지(×2 포함)
//  zoneEffects(맞는 파이터, 기록 객체) — 부르는 쪽은 매 스텝 Y._zoneT 를 줄여 0 이 되면 Y.strength = Y._str0 로 되돌린다 (zoneTick)
//  단독 실행: 무기 X 대 롱소드, 부위 효과표를 두 쪽 다 켠다/끈다 (게임에 넣으면 칼의 둔기 타격 — 날이 못 든 타격·칼 면 — 에도 걸린다)
//   node tools/sim/hybrid.mjs blunt_zones.mjs <무기id> [자리마다 판 수=12] [on|off]
export function zoneEffects(Y, log) {
  const orig = Y.applyWound.bind(Y);
  Y._str0 = Y.strength;
  Y._zoneT = 0;
  const winded = (k, t) => {
    Y.strength = Y._str0 * k;
    Y._zoneT = Math.max(Y._zoneT, t);
  };
  Y.applyWound = (h) => {
    orig(h);
    if (h.type !== 'blunt' || Y.state === 'dead') return;
    const E = h.energy;
    const cos = h.bladeAxis && h.dir ? Math.abs(h.bladeAxis.dot(h.dir)) : 0;
    const poke = cos > 0.7;
    const Z = h.zone;
    if (process.env.ZONE_HIST) { const key = `${Z}${poke ? '·찌름' : ''}`; (log.hist ||= {})[key] = (log.hist[key] ?? 0) + 1; (log.cos ||= [0, 0, 0, 0, 0])[Math.min(4, Math.floor(cos * 5))]++; }
    let tag = null;
    if (poke && Z === 'neck' && E >= 25) { winded(0.5, 2.5); Y.consciousness -= E / 200; tag = '목 숨 막힘'; }
    else if (poke && (Z === 'abdomen' || Z === 'chest') && E >= 30) { winded(0.4, 1.8); Y.balance -= E * 0.02; tag = '명치 숨 멎음'; }
    else if (poke && Z === 'head' && E >= 20) { Y.daze = Math.min(1, (Y.daze || 0) + E / 200); tag = '얼굴 찌름'; }
    else if ((h.part === 'uarmS' || h.part === 'farmS') && E >= 15) {
      Y.limbs.armS = Math.max(0, Y.limbs.armS - 0.15);
      if (Math.random() < Math.min(1, (E - 15) / 60)) { Y.dropSword(); tag = '손 놓침'; } else tag = '손 저림';
    } else if (Z === 'leg' && E >= 40) {
      const L = h.part.endsWith('F') ? 'legF' : 'legB';
      Y.limbs[L] = Math.max(0, Y.limbs[L] - E / 300);
      tag = '다리';
    }
    if (tag) log[tag] = (log[tag] ?? 0) + 1;
  }
}

export const zoneTick = (Y, dt) => {
  if (Y._zoneT > 0 && (Y._zoneT -= dt) <= 0) Y.strength = Y._str0; // 숨이 돌아온다
};

import { isMain } from './is_main.mjs';
if (isMain(import.meta.url)) {
  const { newRound, DT } = await import('./harness_m.mjs');
  const { AI } = await import('../../src/ai.js');
  const { SCHOOLS } = await import('../../src/schools.js');
  const { wilson } = await import('./ref_duel.mjs');
  const [id, n = '12', mode = 'on'] = process.argv.slice(2);
  const on = mode !== 'off';
  const log = {};
  const log2 = {}; // X 가 맞은 효과 (롱소드의 둔기 타격)
  let Wn = 0, Ln = 0, D = 0;
  for (let s = 1; s <= +n; s++)
    for (const xFirst of [true, false]) {
      const x = { weapon: id, persona: { school: SCHOOLS[id] ? id : 'longsword' } };
      const y = { weapon: 'longsword', persona: { school: 'longsword' } };
      const P = xFirst ? x : y, E = xFirst ? y : x;
      const G = newRound({ walls: true, seed: (xFirst ? 1000 : 2000) + s, weapon: P.weapon, weapon2: E.weapon, difficulty: 'normal', persona: E.persona, AI2Class: AI, difficulty2: 'normal', persona2: P.persona });
      const X = xFirst ? G.player : G.enemy, Y = xFirst ? G.enemy : G.player;
      if (on) (zoneEffects(Y, log), zoneEffects(X, log2));
      let res = 'D';
      for (let i = 0; i < 40 / DT; i++) {
        G.step();
        if (on) (zoneTick(Y, DT), zoneTick(X, DT));
        if (X.state === 'dead' || Y.state === 'dead') { res = X.state === 'dead' && Y.state === 'dead' ? 'D' : Y.state === 'dead' ? 'W' : 'L'; break; }
      }
      if (res === 'W') Wn++; else if (res === 'L') Ln++; else D++;
    }
  const N = 2 * +n, [lo, hi] = wilson(Wn, N);
  console.log(`${id} 부위 효과표 ${on ? '켬' : '끔'}: 승 ${Wn} 패 ${Ln} 무 ${D} / ${N} · 승률 ${Math.round((100 * Wn) / N)}% (95% ${Math.round(100 * lo)}~${Math.round(100 * hi)}%)` + (on ? ' · ' + Object.entries(log).filter(([k]) => k !== 'hist' && k !== 'cos').map(([k, v]) => `${k} ${v}`).join(' · ') + ' / 롱소드가 준 효과: ' + (Object.entries(log2).map(([k, v]) => `${k} ${v}`).join(' · ') || '없음') : ''));
}

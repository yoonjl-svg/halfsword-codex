// 권총 점검 (디렉터 12:38 확인할 점 1·2):
//  1) 사람 쪽: 1.2초마다 탭(skill.thrust())을 7초 동안 누르면 몇 발 나가나 — 물리 시간 기준 (장전 GUN.cooldown)
//  2) AI 쪽: 상대 AI(랴오 성격 등)가 권총을 들면 쏘나, 맞히나 — 가만히 선 주인공 / 롱소드 AI 주인공 상대로 12초
//   node tools/sim/hybrid.mjs gun_check.mjs
import { newRound, DT, AI } from './harness_m.mjs';
import { GUN } from '../../src/gun.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

// 1) 사람 탭
{
  const G = newRound({ walls: true, seed: 5, weapon: 'pistol', weapon2: 'longsword' });
  G.ai.update = () => {}; // 상대는 가만히 (쏠 대상만)
  const f = G.player;
  let taps = 0;
  let tNext = 0.5;
  const shotT = [];
  let last = 0;
  for (let t = 0; t < 7.5; t += DT) {
    if (t >= tNext && taps < 6) {
      f.skill.thrust();
      taps++;
      tNext += 1.2;
    }
    G.step();
    if ((f.gun?.shots ?? 0) > last) (shotT.push(t.toFixed(2)), (last = f.gun.shots));
  }
  console.log(`1) 사람 탭 ${taps}번 (0.5초부터 1.2초 간격, 장전 ${GUN.cooldown}초): ${shotT.length}발 — 쏜 시각 ${shotT.join(', ')}초`);
}

// 2) AI 가 권총을 든다 (상대 자리 = enemy, 게임의 ?foe=…&foeWeapon=pistol 과 같다)
for (const [who, playerAI] of [['가만히 선 주인공', false], ['롱소드 AI 주인공', true]]) {
  for (const cid of ['liao', 'isolde', 'bran']) {
    const c = CHARACTERS_BY_ID[cid];
    let shots = 0, hits = 0, hurt = 0, firstShot = [];
    const what = {};
    const zones = [];
    for (const seed of [11, 12, 13, 14]) {
      const G = newRound({ walls: true, seed, weapon: 'longsword', weapon2: 'pistol', look2: c.look, difficulty: c.ai.level, persona: c.ai.persona, ...(playerAI ? { AI2Class: AI } : {}) });
      const E = G.enemy;
      let t0 = null;
      for (let t = 0; t < 12; t += DT) {
        G.step();
        if (t0 == null && (E.gun?.shots ?? 0) > 0) t0 = t;
        if (G.player.state === 'dead') break;
      }
      for (const [k, v] of Object.entries(E.gun?.what ?? {})) what[k] = (what[k] ?? 0) + v;
      shots += E.gun?.shots ?? 0;
      hits += E.gun?.hits ?? 0;
      hurt += G.wounds.filter((w) => w.att === E).length;
      zones.push(G.wounds.filter((w) => w.att === E).map((w) => `${w.zone}:${w.type}${w.severity > 0 ? w.severity.toFixed(1) : ""}`).join("+") + (G.player.state === "dead" ? "→죽음" : ""));
      firstShot.push(t0 == null ? '없음' : t0.toFixed(1));
    }
    console.log(`2) ${cid}(${c.ai.level}) 권총 대 ${who}, 12초 × 4판: ${shots}발 쏨, ${hits}발 명중, 상처 ${hurt} — 첫 발 ${firstShot.join(' / ')}초 · 맞은 곳 ${JSON.stringify(what)} · ${zones.join(" | ")}`);
  }
}

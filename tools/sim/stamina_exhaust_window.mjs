// 탈진 2.5 s 의 세기 (10/15 기력 들여옴 — docs/strike/stamina_import_2026-10-15.md · 설계안 §6-2): AI 끼리(롱소드 대 롱소드 · 2.3 m) 판 시작 정지가 끝난 2 s 에
//  한쪽(P — 막고 피하는 AI)을 −50 으로 만들어 탈진시키고(exhaust) 2.5 s 동안 받은 상처·넘어짐·죽음을 센다. 같은 씨앗을 탈진 없이(control) 돌린 같은 2.5 s 와 견준다.
//  (샛별 저장소 stamina_exhaustion_probe 는 P 가 판단 없는 몸이라 탈진이 있으나 없으나 같은 꼴 — 여기서는 P 도 AI 라 '탈진해서 못 막는 몫'이 보인다)
//  쓰기: node tools/sim/stamina_exhaust_window.mjs [씨앗 수 24]
import { newRound, AI } from './harness_m.mjs';
const N = +(process.argv[2] ?? 24);
const out = { exhaust: [], control: [] };
for (const mode of ['exhaust', 'control']) {
  for (let seed = 1; seed <= N; seed++) {
    const g = newRound({ weapon: 'longsword', weapon2: 'longsword', seed, gap: 2.3, AI2Class: AI });
    try {
      const P = g.player;
      let t0 = null;
      let wounds = 0;
      let falls = 0;
      let dead = false;
      let prev = P.state;
      let atk0 = 0;
      g.onWound = (att, vic, r) => {
        if (vic === P && t0 != null && g.t - t0 <= 2.5 && r.severity > 0) wounds++;
      };
      for (let i = 0; i < 1200 && P.alive; i++) {
        if (t0 == null && g.t >= 2) {
          if (mode === 'exhaust') P.stamina.spend('attack', 150);
          t0 = g.t;
          atk0 = g.ai.stats.attacks;
        }
        g.step();
        if (t0 != null && g.t - t0 <= 2.5) {
          if (prev === 'stand' && (P.state === 'down' || P.state === 'getup')) falls++;
          if (P.state === 'dead') dead = true;
        }
        prev = P.state;
        if (t0 != null && g.t - t0 > 2.5) break;
      }
      out[mode].push({ seed, wounds, falls, dead, foeAttacks: g.ai.stats.attacks - atk0, endState: P.state });
    } finally {
      g.world.free();
    }
  }
}
const sum = (rows, k) => rows.reduce((a, r) => a + (typeof r[k] === 'boolean' ? +r[k] : r[k]), 0);
for (const mode of ['exhaust', 'control']) {
  const R = out[mode];
  console.log(`${mode === 'exhaust' ? '탈진' : '탈진 없음'} ${R.length} 판 (2 s ~ 4.5 s): 상처 받은 판 ${R.filter((r) => r.wounds > 0).length} · 상처 합 ${sum(R, 'wounds')} · 넘어진 판 ${R.filter((r) => r.falls > 0).length} · 죽음 ${sum(R, 'dead')} · 상대 공격 시작 ${sum(R, 'foeAttacks')}`);
}
if (process.env.EXHAUST_ROWS === '1') console.log(JSON.stringify(out));

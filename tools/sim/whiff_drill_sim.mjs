// 상대 헛스윙 연습 시뮬 (10/15 — src/whiff_drill.js · docs/strike/german_hold_2026-10-15.md §7): 롱소드 사람(손 안 댐 — 대본 없음, 시뮬 기본 겨눔) 대
//  롱소드 AI(기본 AI · 드릴 붙임) · 벽 있음 · 씨앗마다 같은 난수 — 판 시작부터 T s. gap(제 M.reach 밖 거리)을 고정해 쓸어 본다.
//  잰 것: 드릴 공격 수 · 공격 끝(afterStrike)의 헛침·맺힘(칼끼리)·맞힘(상대 통증 오름 — ai.js 와 같은 가름) · 드릴 공격이 낸 상처(부위·종류·J) ·
//   플레이어 받을 창(gait.chase) 열림 · 공격 시작·끝 가슴-가슴 거리 · 공격 동안 벌어진 거리(끝 − 시작) · 헛스윙 꼴 몫 · 드릴 아닌 공격 끝
//  실행: node tools/sim/whiff_drill_sim.mjs [gap 들 0.25,0.35,0.45] [씨앗 1,2,3,4] [T 30]
import { newRound, DT } from './jelly_harness.mjs';
import { WhiffDrill } from '../../src/whiff_drill.js';

const gaps = (process.argv[2] || '0.25,0.35,0.45').split(',').map(Number);
const seeds = (process.argv[3] || '1,2,3,4').split(',').map(Number);
const T = +(process.argv[4] || 30);
const seedRand = (seed) => {
  let s = seed * 9301 + 49297;
  Math.random = () => (s = (s * 9301 + 49297) % 233280) / 233280;
};
const med = (a) => {
  const b = a.filter((x) => x != null).sort((x, y) => x - y);
  return b.length ? `${b[Math.floor(b.length / 2)].toFixed(2)} [${b[0].toFixed(2)}~${b[b.length - 1].toFixed(2)}]` : '-';
};
console.log(`| gap m | 드릴 거리 m | 판 | 드릴 공격 | 헛침 | 맺힘 | 맞힘 | 받을 창 열림 | 드릴 공격이 낸 상처 (부위/종류/J) | 공격 시작 거리 m | 공격 끝 거리 m | 공격 동안 벌어짐 m | 헛스윙 꼴 몫 | 드릴 아닌 공격 끝 |`);
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const gap of gaps) {
  const S = { atk: 0, missed: 0, bound: 0, landed: 0, chase: 0, other: 0, out: 0, t: 0, wounds: [], start: [], end: [], drift: [], G: null };
  for (const seed of seeds) {
    seedRand(seed);
    const G = newRound({ walls: true, seed });
    const P = G.player;
    const E = G.enemy;
    const ai = G.ai;
    ai.drill = new WhiffDrill();
    ai.drill.gap = gap;
    S.G = ai.drill.dist(ai);
    const oW = G.combat.hooks.onWound;
    G.combat.hooks.onWound = (att, vic, r, pt, pr) => {
      if (att === E && ai.mode === 'attack' && ai.drillAtk) S.wounds.push(`${pr?.v?.part}/${r.type}/${r.energy.toFixed(0)}`);
      oW?.(att, vic, r, pt, pr);
    };
    let cur = null;
    const oa = ai.afterStrike.bind(ai);
    ai.afterStrike = (d) => {
      if (ai.drillAtk) {
        S[ai.hitLanded ? 'landed' : ai.bound ? 'bound' : 'missed']++;
        S.end.push(P.foeDistance());
        if (cur) S.drift.push(P.foeDistance() - cur);
      } else S.other++;
      return oa(d);
    };
    let prev = null;
    let chase = null;
    for (let i = 0; i < T / DT; i++) {
      G.step();
      const atk = ai.mode === 'attack' && ai.drillAtk;
      if (atk && !prev) {
        cur = P.foeDistance();
        S.start.push(cur);
      }
      prev = atk;
      if (ai.drillOut) S.out += DT;
      S.t += DT;
      const ch = P.gait?.chase;
      if (ch && ch !== chase) S.chase++;
      chase = ch;
    }
    S.atk += ai.drill.attacks;
  }
  console.log(`| ${gap.toFixed(2)} | ${S.G.toFixed(2)} | ${seeds.length} × ${T} s | ${S.atk} | ${S.missed} | ${S.bound} | ${S.landed} | ${S.chase} | ${S.wounds.join(' · ') || '-'} | ${med(S.start)} | ${med(S.end)} | ${med(S.drift)} | ${((100 * S.out) / S.t).toFixed(0)} % | ${S.other} |`);
}

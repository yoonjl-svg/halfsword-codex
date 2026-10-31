// 인물 맞대결 + 싸움 결 재기 (사장님 10/29 15:5x — docs/characters/temperament_2026-10-29.md §7: 반응 = 본 유파 · 광기의 브론 · 롤랑 / 베르나르도 가르기)
//  사용: node tools/sim/temperament_duel.mjs <A[:무기]> <B[:무기]> [판 수 8] [초 45] [--json]
//   A · B = 인물 id (CHARACTERS_BY_ID). ':무기' = 그 판에 드는 무기 — 시트와 다르면 main.js 처럼 유파 꾸러미도 그 무기 것(검술을 배우지 못한 인물은 그대로)
//   판마다 자리를 바꾼다(홀수 판 A = 상대 자리 · 짝수 판 A = 플레이어 자리 — 둘 다 AI). 겉모습(투구 · 판금) · 버티는 힘(vitality)은 시트 그대로
//  찍는 것 (인물마다): 이김 · 반응(s) · AI 숙련도(손에 든 유파) · 분당 공격 · 첫 공격까지(s) · 속임 몫 · 받아치기 몫(맞받기 + 먼저 끊기 ÷ 공격) · 이어 치기 몫 · 맞힘 ·
//   간 볼 때 평균 거리(m — 판 시작 정지 ARENA.startHold + 1 s 뒤만) · 판당 비기 · 판당 밀치기 ·
//   고른 기술 몫(가로 zwerch* · 내려 zornhau* · oberhau · 올려 unterhau* · 찌르기 stich*) · 간 볼 때 낮은 자세 몫(바꿈 wechsel* · 바보 alber) ·
//   들어간 때 몫(startAttack 의 까닭 — 헛친 뒤 recover · 막고 되받기 riposte · 맞받기 counter · 먼저 끊기 stop/windup · 걸어 듦 stepin · 참다못해 patience ·
//    칼끝이 비킴 open · 이어 치기 follow · 쓰러진 상대 finish · 그 밖(패시브 · 비기 · 밀치기 …)) ·
//   간 볼 때 거리 몫(상대 칼 닿는 거리 foeReach 안 · 끝 0.3 m · 밖) ·
//   (10/29 21:0x '롤랑의 상극') 비기 가운데 상대와 함께 낸 몫(0.1 s 안 — 싱지르 맞냄) · 맞힌 몫(낸 뒤 1.5 s 안에 무게 1 이상 상처)
import { newRound, DT } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { getWeapon } from '../../src/weapons.js';
import { ARENA } from '../../src/config.js';
const SETTLE = (ARENA.startHold ?? 2) + 1; // 이 뒤부터 거리를 잰다 (판 시작 거리를 빼려고)

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const JSON_OUT = process.argv.includes('--json');
const [specA, specB, seedsArg = '8', durArg = '45'] = args;
const side = (spec) => {
  const [id, w] = String(spec).split(':');
  const c = CHARACTERS_BY_ID[id];
  if (!c) { console.error('알 수 없는 id:', id); process.exit(1); }
  const weapon = w ? getWeapon(w).id : c.weapon;
  const persona = weapon !== c.weapon && !c.noSwordsmanship ? { ...c.ai.persona, school: weapon } : c.ai.persona; // main.js 와 같은 규칙
  return { id, c, weapon, level: c.ai.level, persona, label: w ? `${id}:${weapon}` : id };
};
const A = side(specA), B = side(specB);
const SEEDS = +seedsArg, DUR = +durArg;

const blank = () => ({ win: 0, attacks: 0, feints: 0, counters: 0, preempts: 0, followUps: 0, landed: 0, firstT: 0, firstN: 0, dSum: 0, dN: 0, t: 0, reaction: 0, prof: 0, secrets: 0, shoves: 0, n: 0, fires: 0, mirror: 0, fireHit: 0,
  tech: { level: 0, down: 0, up: 0, thrust: 0, other: 0 }, lowN: 0, guardN: 0,
  why: { recover: 0, riposte: 0, counter: 0, stop: 0, stepin: 0, patience: 0, open: 0, follow: 0, finish: 0, other: 0 }, band: { in: 0, edge: 0, out: 0 } });
const WHY = ['recover', 'riposte', 'counter', 'stop', 'stepin', 'patience', 'open', 'follow', 'finish'];
const whyKind = (k) => (k === 'windup' ? 'stop' : WHY.includes(k) ? k : 'other');
const techKind = (name = '') => (/^zwerch/.test(name) ? 'level' : /^(zornhau|oberhau)/.test(name) ? 'down' : /^unterhau/.test(name) ? 'up' : /^stich/.test(name) ? 'thrust' : 'other');
const S = { A: blank(), B: blank() };
let draws = 0;
for (let s = 1; s <= SEEDS; s++) {
  const aEnemy = s % 2 === 1;
  const E = aEnemy ? A : B, P = aEnemy ? B : A;
  const G = newRound({ seed: s, difficulty: E.level, persona: E.persona, weapon2: E.weapon, look2: E.c.look, revive: E.c.revive,
    AI2Class: AI, difficulty2: P.level, persona2: P.persona, weapon: P.weapon, look: P.c.look, revive2: P.c.revive });
  G.enemy.vitality = E.c.vitality > 0 ? E.c.vitality : 1;
  G.player.vitality = P.c.vitality > 0 ? P.c.vitality : 1;
  const sides = [[aEnemy ? 'A' : 'B', G.ai, G.enemy], [aEnemy ? 'B' : 'A', G.ai2, G.player]];
  for (const [k, ai] of sides) { // 고른 기술 셈 — startAttack 을 감싸 읽기만 한다 (행동은 그대로)
    const orig = ai.startAttack.bind(ai);
    ai.startAttack = (t, ...rest) => { const ok = orig(t, ...rest); if (ok !== false && t?.name) { S[k].tech[techKind(t.name)]++; S[k].why[whyKind(rest[0])]++; } return ok; };
  }
  const first = { A: null, B: null };
  const fire = { A: [], B: [] }, bursts = { A: 0, B: 0 }; // 비기를 낸 때 (싱지르 맞냄 셈 — 두 사람이 0.1 s 안에 함께 냄)
  const steps = Math.round(DUR / DT);
  for (let i = 0; i < steps; i++) {
    G.step();
    for (const [k, ai] of sides) {
      if (first[k] == null && ai.stats.attacks > 0) first[k] = G.t;
      if ((ai.secretBursts ?? 0) > bursts[k]) { bursts[k] = ai.secretBursts; fire[k].push(G.t); }
      if (ai.mode === 'watch' && G.t > SETTLE) {
        S[k].dSum += ai.d; S[k].dN++;
        if (ai.guard?.name) { S[k].guardN++; if (/^(wechsel|alber)/.test(ai.guard.name)) S[k].lowN++; }
        S[k].band[ai.d < ai.foeReach ? 'in' : ai.d < ai.foeReach + 0.3 ? 'edge' : 'out']++;
      }
    }
    if (!G.enemy.alive || !G.player.alive) break;
  }
  const alive = { [sides[0][0]]: G.enemy.alive, [sides[1][0]]: G.player.alive };
  const blood = { [sides[0][0]]: G.enemy.blood, [sides[1][0]]: G.player.blood };
  const winner = alive.A && !alive.B ? 'A' : alive.B && !alive.A ? 'B' : !alive.A && !alive.B ? null : blood.A > blood.B ? 'A' : blood.B > blood.A ? 'B' : null;
  if (winner) S[winner].win++; else draws++;
  for (const [k, ai, f] of sides) {
    const st = ai.stats, o = S[k];
    const other = fire[k === 'A' ? 'B' : 'A'];
    for (const t of fire[k]) {
      o.fires++;
      if (other.some((u) => Math.abs(u - t) < 0.1)) o.mirror++;
      if (G.wounds.some((w) => w.att === f && w.t >= t && w.t <= t + 1.5 && (w.severity ?? 0) >= 1)) o.fireHit++; // 낸 뒤 1.5 s 안에 무게 1 이상 상처
    }
    o.secrets += ai.secretBursts ?? 0; o.shoves += f.shoves ?? 0; o.n++;
    o.attacks += st.attacks; o.feints += st.feints; o.counters += st.counters; o.preempts += st.preempts; o.followUps += st.followUps; o.landed += st.landed;
    o.t += G.t; o.reaction = ai.level.reaction; o.prof = ai.proficiency;
    if (first[k] != null) { o.firstT += first[k]; o.firstN++; }
  }
}
const r2 = (x) => Math.round(x * 100) / 100;
const sum = (k, o) => ({
  who: k === 'A' ? A.label : B.label, win: o.win, reaction: r2(o.reaction), prof: o.prof,
  attPerMin: r2((o.attacks / o.t) * 60), firstAttack: o.firstN ? r2(o.firstT / o.firstN) : null,
  feintShare: o.attacks ? r2(o.feints / o.attacks) : 0, counterShare: o.attacks ? r2((o.counters + o.preempts) / o.attacks) : 0,
  followShare: o.attacks ? r2(o.followUps / o.attacks) : 0, landed: o.landed, watchDist: o.dN ? r2(o.dSum / o.dN) : null,
  secretsPerRound: o.n ? r2(o.secrets / o.n) : 0, shovesPerRound: o.n ? r2(o.shoves / o.n) : 0,
  mirrorShare: o.fires ? r2(o.mirror / o.fires) : null, fireHitShare: o.fires ? r2(o.fireHit / o.fires) : null, // 비기 가운데 상대와 함께 낸 몫 · 맞힌 몫
  techMix: (() => { const T = o.tech, n = T.level + T.down + T.up + T.thrust + T.other || 1; return { level: r2(T.level / n), down: r2(T.down / n), up: r2(T.up / n), thrust: r2(T.thrust / n), other: r2(T.other / n) }; })(), // other = 라이브러리 · 고유 동작(좌우 이어 베기 · 나선 걸음 베기 …)
  lowGuard: o.guardN ? r2(o.lowN / o.guardN) : null,
  whyMix: (() => { const W = o.why, n = Object.values(W).reduce((a, b) => a + b, 0) || 1; return Object.fromEntries(Object.entries(W).map(([k, v]) => [k, r2(v / n)])); })(),
  distBand: (() => { const B = o.band, n = B.in + B.edge + B.out || 1; return { in: r2(B.in / n), edge: r2(B.edge / n), out: r2(B.out / n) }; })(),
});
const out = { A: sum('A', S.A), B: sum('B', S.B), draws, seeds: SEEDS, dur: DUR };
if (JSON_OUT) console.log(JSON.stringify(out));
else {
  console.log(`${A.label} 대 ${B.label} — ${SEEDS} 판 × ${DUR} s · 무 ${draws}`);
  for (const k of ['A', 'B']) {
    const x = out[k];
    console.log(`  ${x.who}: 이김 ${x.win} · 반응 ${x.reaction} s · 숙련도 ${x.prof} · 분당 공격 ${x.attPerMin} · 첫 공격 ${x.firstAttack} s · 속임 ${x.feintShare} · 받아치기 ${x.counterShare} · 이어 치기 ${x.followShare} · 맞힘 ${x.landed} · 간 볼 때 거리 ${x.watchDist} m · 판당 비기 ${x.secretsPerRound}(함께 냄 ${x.mirrorShare} · 맞힘 ${x.fireHitShare}) · 판당 밀치기 ${x.shovesPerRound} · 기술(가로 ${x.techMix.level} · 내려 ${x.techMix.down} · 올려 ${x.techMix.up} · 찌르기 ${x.techMix.thrust} · 그 밖 ${x.techMix.other}) · 낮은 자세 ${x.lowGuard}`);
    console.log(`    들어간 때: ${Object.entries(x.whyMix).map(([k, v]) => `${k} ${v}`).join(' · ')} · 간 볼 때 거리: 안 ${x.distBand.in} · 끝 ${x.distBand.edge} · 밖 ${x.distBand.out}`);
  }
}

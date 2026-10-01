// AI 가 쓰러진 상대를 마무리하는가 — 측정 도구
//  플레이어를 여러 방향으로 쓰러뜨려(일어나지 못하게) 두고, 적 AI 를 평소대로 움직인다.
//  정해진 시간 안에 AI 가 쓰러진 플레이어에게 상처(베기·찌르기)를 냈는지, 처음 상처까지 걸린 시간, 휘두른 횟수를 센다.
//  사용법: node tools/sim/down_ai.mjs [판 수(방향마다)] [적 무기 id] [초] [--char=isolde] [--emo=off] [--foeStr=1.3] …
//   --char : 적 AI 를 그 캐릭터로 (characters.js 의 난이도·성격·근력·감정 문턱, 무기 id 를 안 주면 그 캐릭터의 무기)
//            기본 AI 는 감정 문턱이 없어 감정이 켜지지 않는다 — 감정 켬/끔 비교는 캐릭터로 한다
//   근력·감정 옵션은 str_emo.mjs 참고 (베는 쪽 = 적 AI — 감정은 AI 가 판 안에서 스스로 정한다, 누운 쪽 = 플레이어)
import { newRound, DT } from './harness_m.mjs';
import { strEmoOpts, applyStrEmo, strEmoLabel } from './str_emo.mjs';
import { CHARACTERS } from '../../src/characters.js';
import { isMain } from './is_main.mjs';

const FALLS = { toward: 0, away: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }; // 플레이어 기준 (적 쪽 = 앞)

export function aiTrial({ fall, seed, weapon2, secs = 8, gap = 2.2, before, ch = null }) {
  const G = newRound({ walls: false, gap, seed, weapon2, ...(ch ? { difficulty: ch.ai.level, persona: ch.ai.persona } : {}) });
  before?.(G);
  const P = G.player;
  const E = G.enemy;
  P.knockDown(true);
  P.downTime = 1e9;
  const a = FALLS[fall] + (Math.random() - 0.5) * 0.5;
  const J = 40 * (1 + (Math.random() - 0.5) * 0.4);
  let first = null;
  let swings = 0;
  let wasAttack = false;
  const t0 = G.t;
  for (let i = 0; i < (secs + 2.5) / DT; i++) {
    if (i * DT < 0.25) for (const k of ['chest', 'head']) P.bodies[k].applyImpulse({ x: Math.cos(a) * J * DT * 4, y: 0, z: Math.sin(a) * J * DT * 4 }, true);
    P.move.set(0, 0);
    G.step();
    const att = G.ai.mode === 'attack' && G.ai.phase === 'strike';
    if (att && !wasAttack) swings++;
    wasAttack = att;
    if (first == null && G.wounds.some((w) => w.att === E && (w.type === 'cut' || w.type === 'stab') && w.severity > 0)) first = G.t - t0;
  }
  const ws = G.wounds.filter((w) => w.att === E);
  const cuts = ws.filter((w) => w.type !== 'blunt' && w.severity > 0);
  const emoT = G.ai.stats.emoTime ?? {};
  return { fall, first, swings, wounds: cuts.length, sev: cuts.reduce((a, w) => a + w.severity, 0), blunt: ws.filter((w) => w.type === 'blunt').length, dead: P.state === 'dead', emoT };
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const pos = args.filter((a) => !a.startsWith('--'));
  const N = +(pos[0] || 4);
  const weapon2 = pos[1] || undefined;
  const secs = +(pos[2] || 8);
  const chId = args.find((a) => a.startsWith('--char='))?.split('=')[1];
  const ch = chId ? CHARACTERS.find((c) => c.id === chId) : null;
  if (chId && !ch) throw new Error(`캐릭터 없음: ${chId}`);
  const w2 = weapon2 ?? ch?.weapon;
  const SE = strEmoOpts(args);
  const before = (G) => applyStrEmo(G, SE);
  const rows = [];
  for (const fall of Object.keys(FALLS)) for (let s = 1; s <= N; s++) rows.push(aiTrial({ fall, seed: 900 + s * 7 + fall.length * 100, weapon2: w2, secs, before, ch }));
  const hit = rows.filter((r) => r.first != null);
  const avg = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : '-');
  console.log(`적 ${ch ? `${ch.id} ` : ''}무기 ${w2 ?? 'longsword'} · 방향마다 ${N}판 · ${secs}초 안 · ${strEmoLabel(SE)}`);
  for (const fall of Object.keys(FALLS)) {
    const rs = rows.filter((r) => r.fall === fall);
    console.log(`${fall.padEnd(7)} 상처 낸 판 ${rs.filter((r) => r.first != null).length}/${rs.length} · 첫 상처 ${avg(rs.filter((r) => r.first != null).map((r) => r.first))}초 · 휘두름 ${avg(rs.map((r) => r.swings))} · 상처 ${avg(rs.map((r) => r.wounds))} · 멍 ${avg(rs.map((r) => r.blunt))} · 죽음 ${rs.filter((r) => r.dead).length}`);
  }
  console.log(`전체: 상처 낸 판 ${hit.length}/${rows.length} (${Math.round((100 * hit.length) / rows.length)}%) · 첫 상처까지 평균 ${avg(hit.map((r) => r.first))}초 · 휘두름당 상처 ${(rows.reduce((a, r) => a + r.wounds, 0) / Math.max(1, rows.reduce((a, r) => a + r.swings, 0))).toFixed(2)} · 상처 깊이 평균 ${(rows.reduce((a, r) => a + r.sev, 0) / Math.max(1, rows.reduce((a, r) => a + r.wounds, 0))).toFixed(2)} · 죽음 ${rows.filter((r) => r.dead).length}/${rows.length}`);
  // 적 AI 가 판 동안 지배 감정으로 지낸 시간 (초, 판 평균)
  const emoSum = {};
  for (const r of rows) for (const [k, v] of Object.entries(r.emoT)) emoSum[k] = (emoSum[k] || 0) + v / rows.length;
  console.log(`적 AI 지배 감정 시간(판 평균 초): ${JSON.stringify(Object.fromEntries(Object.entries(emoSum).map(([k, v]) => [k, +v.toFixed(2)])))}`);
  console.log(JSON.stringify(rows));
}

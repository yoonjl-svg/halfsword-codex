// 근력별 AI 찌르기 — 기본 AI('normal')가 가만히 칼을 겨눈 더미를 상대로 낸 찌르기·베기 상처를 센다
//  AI 근력만 0.85 / 1.0 / 1.3 (이졸데 / 기본 / 브란)으로 바꾸고 나머지 실력은 같다 → 근력이 찌르기에 주는 차이만 본다
//  찌르기 무기(thrustStyle)의 AI 는 찌르기 기술을 탭 찌르기와 같은 칼끝 찌르기로 한다 (ai.js startStrike)
//  사용법: node tools/sim/thrust_strength.mjs [판 수] [무기id...] [--emo=off] [--secs=40]
import { newRound, DT } from './harness_m.mjs';
import { strEmoOpts, strEmoLabel } from './str_emo.mjs';
import { isMain } from './is_main.mjs';

const GUARD = [0.12, -0.18]; // characters_eval.mjs 더미와 같은 자세

function run(weapon, str, seed, secs) {
  const G = newRound({ seed, weapon2: weapon });
  const P = G.player;
  const E = G.enemy;
  E.strength = str;
  G.before = () => {
    P.move.set(0, 0);
    P.handOffset.set(GUARD[0], GUARD[1]);
  };
  let tDead = null;
  for (let i = 0; i < secs / DT; i++) {
    G.step();
    if (!P.alive) {
      tDead = G.t;
      break;
    }
  }
  const ws = G.wounds.filter((w) => w.att === E);
  const of = (type) => ws.filter((w) => w.type === type && w.severity > 0);
  return { stab: of('stab'), cut: of('cut'), blunt: ws.filter((w) => w.type === 'blunt').length, tDead, dur: tDead ?? secs, attacks: G.ai.stats.attacks };
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const pos = args.filter((a) => !a.startsWith('--'));
  const N = +(pos[0] || 4);
  const weapons = pos.slice(1).length ? pos.slice(1) : ['estoc', 'rapier', 'longsword'];
  const secs = +(args.find((a) => a.startsWith('--secs='))?.split('=')[1] ?? 40);
  const SE = strEmoOpts(args);
  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
  const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
  console.log(`AI 근력별 찌르기 · 더미 상대 ${secs}초 · 무기마다 근력마다 ${N}판 · ${strEmoLabel(SE)}`);
  console.log('무기, 근력, 분당 공격, 분당 찌르기 상처, 찌르기 깊이 평균, 찌르기 에너지 평균(J), 분당 베기 상처, 베기 깊이 평균, 처치 판, 처치 시간 평균(초)');
  for (const weapon of weapons) {
    for (const str of [0.85, 1.0, 1.3]) {
      const rs = [];
      for (let s = 1; s <= N; s++) rs.push(run(weapon, str, 60 + s, secs));
      const mins = rs.reduce((a, r) => a + r.dur, 0) / 60;
      const stabs = rs.flatMap((r) => r.stab);
      const cuts = rs.flatMap((r) => r.cut);
      const kills = rs.filter((r) => r.tDead != null);
      console.log(
        `${weapon}, ${str}, ${f2(rs.reduce((a, r) => a + r.attacks, 0) / mins)}, ${f2(stabs.length / mins)}, ${f2(mean(stabs.map((w) => w.severity)))}, ${f2(mean(stabs.map((w) => w.energy)))}, ${f2(cuts.length / mins)}, ${f2(mean(cuts.map((w) => w.severity)))}, ${kills.length}/${N}, ${f2(mean(kills.map((r) => r.tDead)))}`,
      );
    }
  }
}

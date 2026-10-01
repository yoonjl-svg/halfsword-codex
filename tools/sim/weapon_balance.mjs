// 무기 밸런스 검증: 각 무기 vs 롱소드, AI 대 AI, 양쪽 자리를 바꿔가며 여러 판.
// 사용법: node tools/sim/weapon_balance.mjs [라운드당 반복 수] [무기 id...] [--seed=첫 시드 번호]
//  시드: 무기가 player 자리 1000+s, 자리를 바꿔 2000+s (s = 첫 번호부터 반복 수만큼, 기본 1부터). 파손 굴림도 이 시드를 쓴다
import { newRound, DT, AI } from './harness_m.mjs';
import { WEAPONS, getWeapon } from '../../src/weapons.js';
import { applyWeaponMeasure } from './weapon_measures.mjs';

const argv = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const S0 = +(process.argv.find((a) => a.startsWith('--seed='))?.split('=')[1] ?? 1); // --seed=첫 시드 번호 (기본 1: 예전과 같은 판)
const ROUNDS = +(argv[0] || 20);
const ROUND_SECONDS = 40;
const ids = argv.slice(1).length ? argv.slice(1) : Object.keys(WEAPONS).filter((id) => id !== 'longsword');

function playOne(weaponA, weaponB, seed) {
  // AI2Class를 안 주면 player(A)는 AI 없이 가만히 서 있는 인형이 된다 — 반드시 양쪽 다 AI를 준다
  const G = newRound({ walls: true, weapon: weaponA, weapon2: weaponB, seed, AI2Class: AI });
  // AI 가 제 무기 길이에 맞는 간격으로 싸우게 (짧은 칼을 롱소드 간격에서 휘두르면 헛친다)
  applyWeaponMeasure(G.ai2, getWeapon(weaponA).id);
  applyWeaponMeasure(G.ai, getWeapon(weaponB).id);
  let nan = false;
  let tDead = null;
  let deadWho = null; // 'P' | 'E' | null(무승부/시간초과)
  for (let i = 0; i < ROUND_SECONDS / DT; i++) {
    G.step();
    const sv = G.player.sword.linvel();
    if (![sv.x, sv.y, sv.z].every(Number.isFinite)) { nan = true; break; }
    if (G.player.state === 'dead' || G.enemy.state === 'dead') {
      tDead = +G.t.toFixed(1);
      deadWho = G.player.state === 'dead' && G.enemy.state === 'dead' ? 'both' : G.player.state === 'dead' ? 'P' : 'E';
      break;
    }
  }
  return { nan, tDead, deadWho, brokeA: G.player.weaponBroken, brokeB: G.enemy.weaponBroken };
}

function fmtPct(x) {
  return `${(x * 100).toFixed(0)}%`;
}

const report = [];
for (const id of ids) {
  const rowsA = []; // A(무기 id) vs B(롱소드), A가 player 자리
  const rowsB = []; // 자리를 바꿔서
  for (let s = S0; s < S0 + ROUNDS; s++) {
    rowsA.push(playOne(id, 'longsword', 1000 + s));
    rowsB.push(playOne('longsword', id, 2000 + s));
  }
  const winsAsP = rowsA.filter((r) => r.deadWho === 'E').length; // P(무기)가 이김
  const winsAsE = rowsB.filter((r) => r.deadWho === 'P').length; // E(무기)가 이김 (B라운드에서 무기는 자리 E)
  const totalWeaponWins = winsAsP + winsAsE;
  const totalRounds = rowsA.length + rowsB.length;
  const winRate = totalWeaponWins / totalRounds;
  const ttk = [...rowsA, ...rowsB].map((r) => r.tDead).filter((t) => t != null);
  const meanTTK = ttk.length ? ttk.reduce((a, b) => a + b, 0) / ttk.length : NaN;
  const draws = [...rowsA, ...rowsB].filter((r) => r.tDead == null).length;
  const nans = [...rowsA, ...rowsB].filter((r) => r.nan).length;
  const broke = [...rowsA, ...rowsB].filter((r) => r.brokeA || r.brokeB).length;
  report.push({ id, winRate, meanTTK, draws, nans, broke, totalRounds });
  console.log(
    `${id.padEnd(16)} winRate=${fmtPct(winRate).padStart(5)}  meanTTK=${isNaN(meanTTK) ? '-' : meanTTK.toFixed(1) + 's'}  draws=${draws}/${totalRounds}  NaN=${nans}  broke=${broke}`,
  );
}

console.log('\n--- 요약 (95%/5% 밖이면 확인 필요) ---');
for (const r of report) {
  const flag = r.winRate >= 0.95 || r.winRate <= 0.05 ? '  ⚠️ 극단적' : '';
  console.log(`${r.id.padEnd(16)} ${fmtPct(r.winRate)}${flag}`);
}

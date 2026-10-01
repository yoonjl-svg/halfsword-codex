// 부활 점검 (오너 결정 2026-09-28, src/revive.js): 이졸데(적 자리, 캐릭터 시트 그대로) 대 주인공 대리(롱소드 유파, 보통)
//  시드마다 한 판. 게임처럼 다리로 체중 받치기(hybrid)를 켠다.
//   · 부활은 한 판에 한 번만
//   · 처음 죽은 뒤 4초 안에 다시 선다 — 칼을 손에 쥔 채(armed, 칼 손잡이가 손목에 붙어 있음)
//   · 부활하는 동안 상처 0 (받은 것 · 준 것 모두, combat 의 onWound 도 불리지 않는다)
//   · 부활이 끝나면 AI 지배 감정 = 집념
//   · 두 번째 죽음은 진짜 죽음 (다시 일어서지 않는다)
//   · NaN 없음 (두 사람의 몸·칼)
//  갈래 (시드 % 4): 0 = 자연스러운 첫 죽음 (45초까지 안 죽으면 피를 떨어뜨린다), 1 = 칼을 놓친 채 죽음(강제), 2 = 칼이 부러진 채
//   죽음(강제), 3 = 놓치고 부러진 채 죽음(강제). 강제 죽음의 까닭은 출혈·기절·목을 돌아가며. 시드 % 8 = 5 면 부활하는 동안 주인공
//   대리가 죽는다 (게임에선 패배 — 부활은 그대로 끝까지 가야 한다)
// 실행: node tools/sim/revive_check.mjs [판 수=16]
import { newRound, DT, AI, CONFIG } from './harness_m.mjs';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { VITALS } from '../../src/config.js';

CONFIG.BODY.weightMode = 'hybrid'; // 게임은 늘 hybrid (main.js newRound)
const N = +(process.argv[2] || 16);
const ISO = CHARACTERS_BY_ID.isolde;
const LIMIT_STAND = 4.0;

const finite = (f) => {
  for (const { rb } of f.meshes) {
    const p = rb.translation();
    const v = rb.linvel();
    if (![p.x, p.y, p.z, v.x, v.y, v.z].every(Number.isFinite)) return false;
  }
  return true;
};
const wristGap = (f) => {
  const b = f.bodies.farmS;
  const r = b.rotation();
  const t = b.translation();
  // 손목 = 아래팔 앞끝 (0.13, 0, 0) — 칼 원점이 여기에 붙어 있어야 쥔 것이다
  const x = 0.13;
  const qx = r.x, qy = r.y, qz = r.z, qw = r.w;
  const wx = x * (1 - 2 * (qy * qy + qz * qz));
  const wy = x * (2 * (qx * qy + qw * qz));
  const wz = x * (2 * (qx * qz - qw * qy));
  const s = f.sword.translation();
  return Math.hypot(t.x + wx - s.x, t.y + wy - s.y, t.z + wz - s.z);
};

function runOne(seed) {
  const variant = seed % 4;
  const killHero = seed % 8 === 5;
  const G = newRound({
    walls: true,
    seed,
    weapon: 'longsword',
    weapon2: ISO.weapon,
    difficulty: ISO.ai.level,
    persona: ISO.ai.persona,
    revive: ISO.revive,
    AI2Class: AI,
    difficulty2: 'normal',
    persona2: { school: 'longsword' },
  });
  const P = G.player;
  const E = G.enemy;
  const r = { seed, variant, revivals: 0, woundsDuring: 0, hooksDuring: 0, nan: false, standIn: null, armedAtStand: null, gapAtStand: null, emoAfter: null, secondDead: null, secondCause: null, stayedDead: null, disarmedAtDeath: null, brokenAtDeath: null, firstCause: null, forced: false, heroKilled: false, errors: [] };
  // 부활 중 상처 알림 (쓰러뜨린 그 한 방의 알림은 빼고: 그 한 방이 부활을 시작한 스텝엔 revival.t 가 아직 0 이다)
  G.onWound = (att, vic) => {
    if (E.revival && E.revival.t > 0 && (vic === E || att === E)) r.hooksDuring++;
  };
  const forceT = 5 + (seed % 5);
  const causes = ['blood', 'ko', 'neck'];
  const kill = (f, how) => {
    if (how === 'blood') f.blood = VITALS.collapseBlood - 0.1;
    else if (how === 'ko') f.consciousness = -0.1;
    else f.die('목');
  };
  let tStart = null, tEnd = null, woundsAtStart = 0, prevRev = null, deadT = null;
  const maxT = 120;
  for (let i = 0; i < maxT / DT; i++) {
    const t = G.t;
    // 첫 죽음 만들기
    if (r.revivals === 0 && !E.revival) {
      if (variant !== 0 && t >= forceT) {
        if (variant & 1 && E.armed) E.dropSword();
        if (variant & 2 && !E.weaponBroken) E.breakWeapon();
        kill(E, causes[seed % 3]);
        r.forced = true;
      } else if (variant === 0 && t >= 45) {
        kill(E, 'blood');
        r.forced = true;
      }
    }
    G.step();
    if (!finite(E) || !finite(P)) {
      r.nan = true;
      break;
    }
    const V = E.revival;
    if (V && V !== prevRev) {
      r.revivals++;
      tStart = G.t;
      woundsAtStart = E.wounds.length;
      r.disarmedAtDeath = V.disarmed;
      r.brokenAtDeath = V.broken;
      r.firstCause = V.cause;
    }
    if (V) {
      if (E.wounds.length > woundsAtStart) r.woundsDuring = E.wounds.length - woundsAtStart;
      if (killHero && !r.heroKilled && V.t > 1.0 && P.alive) {
        P.die('목');
        r.heroKilled = true;
      }
      if (V.phase === 'stand' && r.standIn == null) {
        r.standIn = +(G.t - tStart).toFixed(3);
        r.armedAtStand = E.armed && E.state === 'stand';
        r.gapAtStand = +wristGap(E).toFixed(4);
      }
    }
    if (!V && prevRev) {
      tEnd = G.t;
      r.emoAfter = null;
    }
    if (tEnd != null && r.emoAfter == null && !V && G.t > tEnd) r.emoAfter = G.ai.emotion;
    prevRev = V;
    // 두 번째 죽음: 자연스럽게, 부활이 끝나고 25초가 지나도 살아 있으면 피를 떨어뜨린다
    if (tEnd != null && r.secondDead == null) {
      if (E.state === 'dead') {
        r.secondDead = +(G.t - tEnd).toFixed(2);
        r.secondCause = E.causeOfDeath;
        deadT = G.t;
      } else if (G.t - tEnd > 25 && !E.revival) kill(E, 'blood');
    }
    if (deadT != null && G.t - deadT > 1.5) {
      r.stayedDead = E.state === 'dead' && !E.revival;
      break;
    }
  }
  if (r.revivals !== 1) r.errors.push(`부활 ${r.revivals}번`);
  if (r.standIn == null || r.standIn > LIMIT_STAND) r.errors.push(`선 때 ${r.standIn}`);
  if (!r.armedAtStand || !(r.gapAtStand < 0.05)) r.errors.push(`칼 ${r.armedAtStand} 틈 ${r.gapAtStand}`);
  if (r.woundsDuring || r.hooksDuring) r.errors.push(`부활 중 상처 ${r.woundsDuring}/${r.hooksDuring}`);
  if (r.emoAfter !== 'obsession') r.errors.push(`감정 ${r.emoAfter}`);
  if (r.secondDead == null || !r.stayedDead) r.errors.push(`두 번째 죽음 ${r.secondDead} 그대로 ${r.stayedDead}`);
  if (r.nan) r.errors.push('NaN');
  return r;
}

const rows = [];
for (let s = 1; s <= N; s++) rows.push(runOne(s));
const V = ['자연', '놓침', '부러짐', '놓침+부러짐'];
for (const r of rows) {
  console.log(
    `시드 ${String(r.seed).padStart(2)} ${V[r.variant].padEnd(6)} 첫 죽음 ${r.firstCause}${r.forced ? '(강제)' : ''} 놓침 ${r.disarmedAtDeath ? 'O' : '-'} 부러짐 ${r.brokenAtDeath ? 'O' : '-'}` +
      ` · 부활 ${r.revivals} · 다시 섬 ${r.standIn}s · 칼 ${r.armedAtStand ? '쥠' : '없음'} (손목 틈 ${r.gapAtStand}m) · 부활 중 상처 ${r.woundsDuring}/${r.hooksDuring}` +
      ` · 다시 싸울 때 ${r.emoAfter} · 두 번째 죽음 +${r.secondDead}s ${r.secondCause}${r.heroKilled ? ' · 부활 중 주인공 대리 죽음' : ''} · ${r.errors.length ? 'FAIL ' + r.errors.join(', ') : 'OK'}`,
  );
}
const fails = rows.filter((r) => r.errors.length);
const stand = rows.map((r) => r.standIn).filter((x) => x != null);
console.log(
  `\n${rows.length}판: 통과 ${rows.length - fails.length} · 다시 서기까지 ${Math.min(...stand).toFixed(2)}~${Math.max(...stand).toFixed(2)}s (한계 ${LIMIT_STAND}s) · 놓친 칼 ${rows.filter((r) => r.disarmedAtDeath).length}판 · 부러진 칼 ${rows.filter((r) => r.brokenAtDeath).length}판 · 자연스러운 첫 죽음 ${rows.filter((r) => !r.forced).length}판 · NaN ${rows.filter((r) => r.nan).length}`,
);
console.log(fails.length ? 'FAIL' : 'PASS');
process.exitCode = fails.length ? 1 : 0;

// 무기별 싸움 해부 — 이 무기가 "왜" 이기고 지는가
//  몸에 닿은 접촉마다 판정 전 모습(날·칼끝으로 닿았나)과 판정 뒤(상처가 났나, 문턱이 모자라 멍이 됐나)를 함께 적고,
//  문턱 대비 비율(eff/thr — combat.analyze 와 같은 식), 칼끝 속도, 유효 질량, 칼날 위치를 모은다.
//  duel  : 무기 X(AI) 대 롱소드(AI), 자리를 바꿔 가며 (weapon_balance.mjs 와 같은 판 구성) — 양쪽을 따로 센다
//  dummy : 기본 AI 가 무기 X 로 가만히 칼을 겨눈 더미를 친다 (막는 상대가 없을 때 이 무기의 공격력)
// 사용법: node tools/sim/weapon_anatomy.mjs [duel|dummy] [판 수] [무기id...] [--seed=첫 시드 번호]
//   시드: duel 1000+s / 2000+s, dummy 60+s (s = 첫 번호부터 판 수만큼, 기본 1)
import { newRound, DT, AI, THREE } from './harness_m.mjs';
import { WEAPONS, getWeapon } from '../../src/weapons.js';
import { applyWeaponMeasure } from './weapon_measures.mjs';
import { STRIKE } from '../../src/config.js';
import { isMain } from './is_main.mjs';

const ROUND_SECONDS = 40;

/** 문턱 대비 비율: combat.analyze 가 판정에 쓴 실효 에너지 ÷ 문턱 (투구·판금·옷·찌르기 틈이 다 들어간 값, 날이 든 접촉만) */
function effRatio(raw) {
  if (raw.type !== 'cut' && raw.type !== 'stab') return null;
  return raw.eff / raw.thr;
}

const newSide = () => ({ contacts: 0, edge: 0, cut: 0, stab: 0, wounds: 0, below: 0, flat: 0, hilt: 0, sev: 0, ratios: [], speeds: [], mEff: [], tBlade: [], zones: {}, firstWound: 0, tip: [], dHit: [], ai: {} });
const AI_KEYS = ['attacks', 'feints', 'parries', 'voids', 'counters', 'landed', 'aborted'];

/** 한 판을 해부한다. sides: Map(fighter → 기록) */
function instrument(G, sides) {
  const C = G.combat;
  const ow = C.hooks.onWound;
  C.hooks.onWound = (att, vic, r, point, pr) => {
    const s = sides.get(att);
    if (s && pr) {
      s.contacts++;
      const S = att.cache?.sword;
      const P = vic.cache?.parts[pr.v.part];
      const raw = S && P ? C.analyze(pr, point, S, P, true) : null; // 판정 전(문턱에서 멍으로 바꾸기 전) 모습
      if (pr.w.part !== 'blade') s.hilt++;
      else if (raw && (raw.type === 'cut' || raw.type === 'stab')) {
        s.edge++;
        s[raw.type]++;
        const q = effRatio(raw);
        if (q != null) s.ratios.push(q);
        s.speeds.push(raw.speed);
        s.mEff.push(raw.mFree + (raw.type === 'stab' && att.skill?.thrustPose.w > 0.5 ? STRIKE.thrustAssist : STRIKE.armAssist));
        s.tBlade.push(raw.t);
        s.dHit.push(att.foeDistance());
        if (r.severity > 0) {
          s.wounds++;
          s.sev += r.severity;
          s.zones[r.zone] = (s.zones[r.zone] || 0) + 1;
          if (!G.firstWoundBy) {
            G.firstWoundBy = att;
            s.firstWound++;
          }
        } else s.below++;
      } else s.flat++;
    }
    return ow?.(att, vic, r, point, pr);
  };
}

/** 칼끝 속도(칼끝 점의 속도, m/s) — 매 스텝 표본 */
function tipSpeed(f) {
  const p = f.sword.translation();
  const q = f.sword.rotation();
  const tip = new THREE.Vector3(0, f.weaponCfg.hiltLength + f.weaponCfg.bladeLength, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w)).add(new THREE.Vector3(p.x, p.y, p.z));
  const v = f.sword.velocityAtPoint(tip);
  return Math.hypot(v.x, v.y, v.z);
}

function duel(weaponA, weaponB, seed, secs) {
  const G = newRound({ walls: true, weapon: weaponA, weapon2: weaponB, seed, AI2Class: AI });
  applyWeaponMeasure(G.ai2, getWeapon(weaponA).id);
  applyWeaponMeasure(G.ai, getWeapon(weaponB).id);
  const sides = new Map([[G.player, newSide()], [G.enemy, newSide()]]);
  instrument(G, sides);
  let clashes = 0;
  const oc = G.combat.hooks.onClash;
  G.combat.hooks.onClash = (point, sp, info) => {
    if (info?.fresh) clashes++;
    return oc?.(point, sp, info);
  };
  // 간격 띠: 두 무기의 실측 contact(AI measure) 기준 — 둘 다 밖 / 긴 쪽만 닿음 / 둘 다 닿음
  const cA = G.ai2.M?.contact ?? 1.62;
  const cB = G.ai.M?.contact ?? 1.62;
  const band = { out: 0, longOnly: 0, both: 0 };
  let t = 0;
  for (let i = 0; i < secs / DT; i++) {
    G.step();
    t += DT;
    if (i % 4 === 0) for (const [f, s] of sides) if (f.state === 'stand') s.tip.push(tipSpeed(f));
    if (G.player.state === 'stand' && G.enemy.state === 'stand') {
      const d = G.player.foeDistance();
      if (d > Math.max(cA, cB)) band.out += DT;
      else if (d > Math.min(cA, cB)) band.longOnly += DT;
      else band.both += DT;
    }
    if (G.player.state === 'dead' || G.enemy.state === 'dead') break;
  }
  for (const k of AI_KEYS) {
    sides.get(G.player).ai[k] = G.ai2.stats[k] ?? 0;
    sides.get(G.enemy).ai[k] = G.ai.stats[k] ?? 0;
  }
  const pDead = G.player.state === 'dead';
  const eDead = G.enemy.state === 'dead';
  return { G, sides, t, pDead, eDead, clashes, band, cA, cB };
}

function dummyRun(weapon, seed, secs) {
  const G = newRound({ seed, weapon2: weapon });
  applyWeaponMeasure(G.ai, getWeapon(weapon).id);
  const P = G.player;
  G.before = () => {
    P.move.set(0, 0);
    P.handOffset.set(0.12, -0.18);
  };
  const sides = new Map([[G.enemy, newSide()]]);
  instrument(G, sides);
  let t = 0;
  for (let i = 0; i < secs / DT; i++) {
    G.step();
    t += DT;
    if (i % 4 === 0 && G.enemy.state === 'stand') sides.get(G.enemy).tip.push(tipSpeed(G.enemy));
    if (!P.alive) break;
  }
  for (const k of AI_KEYS) sides.get(G.enemy).ai[k] = G.ai.stats[k] ?? 0;
  return { G, side: sides.get(G.enemy), t, killed: !P.alive, attacks: G.ai.stats.attacks };
}

// ── 모으기·찍기 ──
const merge = (acc, s) => {
  for (const k of ['contacts', 'edge', 'cut', 'stab', 'wounds', 'below', 'flat', 'hilt', 'sev', 'firstWound']) acc[k] += s[k];
  for (const k of ['ratios', 'speeds', 'mEff', 'tBlade', 'tip', 'dHit']) acc[k].push(...s[k]);
  for (const k of AI_KEYS) acc.ai[k] = (acc.ai[k] || 0) + (s.ai[k] || 0);
  for (const [z, n] of Object.entries(s.zones)) acc.zones[z] = (acc.zones[z] || 0) + n;
  return acc;
};
const med = (a) => {
  if (!a.length) return NaN;
  const b = [...a].sort((x, y) => x - y);
  return b[Math.floor(b.length / 2)];
};
const pct = (a, p) => {
  if (!a.length) return NaN;
  const b = [...a].sort((x, y) => x - y);
  return b[Math.min(b.length - 1, Math.floor(b.length * p))];
};
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-');
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
function line(label, s, mins, extra = '') {
  const pm = (n) => f1(n / mins);
  const over = s.ratios.length ? s.ratios.filter((q) => q >= 1).length / s.ratios.length : NaN;
  return `${label.padEnd(26)} 분당: 몸 접촉 ${pm(s.contacts)} · 날/칼끝 ${pm(s.edge)}(베기 ${pm(s.cut)}·찌르기 ${pm(s.stab)}) · 상처 ${pm(s.wounds)} · 문턱 미달 ${pm(s.below)} · 칼 면 ${pm(s.flat)} · 자루 ${pm(s.hilt)}\n` +
    `${''.padEnd(26)} 상처 전환율 ${s.edge ? f2(s.wounds / s.edge) : '-'} · 문턱 비율 중앙값 ${f2(med(s.ratios))} (1 넘은 몫 ${f2(over)}) · 접촉 칼끝 속도 중앙 ${f1(med(s.speeds))}m/s · 유효 질량 중앙 ${f2(med(s.mEff))}kg · 칼날 위치 중앙 ${f2(med(s.tBlade))} · 상처당 깊이 ${s.wounds ? f2(s.sev / s.wounds) : '-'} · 칼끝 최고 속도(99%) ${f1(pct(s.tip, 0.99))}m/s · 닿은 간격 중앙 ${f2(med(s.dHit))}m${extra}` +
    (Object.keys(s.ai).length ? `\n${''.padEnd(26)} AI 분당: 공격 ${pm(s.ai.attacks)} · 속임 ${pm(s.ai.feints)} · 막기 ${pm(s.ai.parries)} · 피하기 ${pm(s.ai.voids)} · 맞받아치기 ${pm(s.ai.counters)} · 명중 ${pm(s.ai.landed)} · 공격 포기 ${pm(s.ai.aborted)}` : '');
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const S0 = +(process.argv.find((a) => a.startsWith('--seed='))?.split('=')[1] ?? 1); // --seed=첫 시드 번호 (기본 1: 예전과 같은 판)
  const mode = args[0] || 'duel';
  const N = +(args[1] || 6);
  const ids = args.slice(2).length ? args.slice(2) : Object.keys(WEAPONS);
  const rows = [];
  if (mode === 'duel') {
    console.log(`무기 X(AI) 대 롱소드(AI) · 자리 바꿔 ${N}판 × 2 · 판마다 ${ROUND_SECONDS}초`);
    for (const id of ids) {
      if (id === 'longsword') continue;
      const me = newSide();
      const foe = newSide();
      let mins = 0;
      let wins = 0;
      let losses = 0;
      const atk = { me: 0, foe: 0 };
      let clashes = 0;
      const band = { out: 0, longOnly: 0, both: 0 };
      let cMe = 0;
      for (let s = S0; s < S0 + N; s++) {
        for (const swap of [false, true]) {
          const r = swap ? duel('longsword', id, 2000 + s, ROUND_SECONDS) : duel(id, 'longsword', 1000 + s, ROUND_SECONDS);
          const mine = swap ? r.G.enemy : r.G.player;
          const theirs = swap ? r.G.player : r.G.enemy;
          merge(me, r.sides.get(mine));
          merge(foe, r.sides.get(theirs));
          mins += r.t / 60;
          clashes += r.clashes;
          for (const k of Object.keys(band)) band[k] += r.band[k];
          cMe = swap ? r.cB : r.cA;
          atk.me += (swap ? r.G.ai : r.G.ai2).stats.attacks;
          atk.foe += (swap ? r.G.ai2 : r.G.ai).stats.attacks;
          const myDead = mine.state === 'dead';
          const theirDead = theirs.state === 'dead';
          if (theirDead && !myDead) wins++;
          if (myDead && !theirDead) losses++;
        }
      }
      const bt = band.out + band.longOnly + band.both;
      console.log(`\n== ${id} (${getWeapon(id).tier}) · 승 ${wins} 패 ${losses} / ${2 * N}판 · 첫 상처 ${me.firstWound}:${foe.firstWound} · 분당 공격 ${f1(atk.me / mins)} : ${f1(atk.foe / mins)} · 분당 칼끼리 새로 부딪힘 ${f1(clashes / mins)}`);
      console.log(`  간격(둘 다 선 시간): 둘 다 안 닿음 ${f2(band.out / bt)} · 한쪽(긴 칼)만 닿음 ${f2(band.longOnly / bt)} · 둘 다 닿음 ${f2(band.both / bt)} (contact ${f2(cMe)} 대 롱소드 1.62)`);
      console.log(line(`  ${id}`, me, mins));
      console.log(line('  상대 롱소드', foe, mins));
      rows.push({ id, wins, losses, n: 2 * N, me, foe, mins, atk });
    }
  } else {
    console.log(`기본 AI 가 무기 X 로 가만히 겨눈 더미를 친다 · ${N}판 × ${ROUND_SECONDS}초`);
    for (const id of ids) {
      const acc = newSide();
      let mins = 0;
      let kills = 0;
      let attacks = 0;
      const ttk = [];
      for (let s = S0; s < S0 + N; s++) {
        const r = dummyRun(id, 60 + s, ROUND_SECONDS);
        merge(acc, r.side);
        mins += r.t / 60;
        attacks += r.attacks;
        if (r.killed) {
          kills++;
          ttk.push(r.t);
        }
      }
      console.log(line(`${id} (${getWeapon(id).tier})`, acc, mins, ` · 분당 공격 ${f1(attacks / mins)} · 처치 ${kills}/${N} · 처치 시간 ${f1(ttk.reduce((a, b) => a + b, 0) / Math.max(1, ttk.length))}s`));
      rows.push({ id, acc, mins, kills, attacks, ttk });
    }
  }
  const slim = (s) => ({ contacts: s.contacts, edge: s.edge, cut: s.cut, stab: s.stab, wounds: s.wounds, below: s.below, flat: s.flat, hilt: s.hilt, sev: +s.sev.toFixed(2), ratioMed: +f2(med(s.ratios)), speedMed: +f1(med(s.speeds)), mEffMed: +f2(med(s.mEff)), tipP99: +f1(pct(s.tip, 0.99)), zones: s.zones });
  console.log(JSON.stringify(rows.map((r) => (r.me ? { id: r.id, wins: r.wins, losses: r.losses, n: r.n, mins: +r.mins.toFixed(2), atk: r.atk, me: slim(r.me), foe: slim(r.foe) } : { id: r.id, mins: +r.mins.toFixed(2), kills: r.kills, attacks: r.attacks, acc: slim(r.acc) }))));
}

// 30 초 싸움 — 이탈리아 물러서며 받기 연구 (10/17 사장님 15:0x '30초 정도 전투가 이루어진다고 가정할 때 양적으로나 질적으로 종합적인 득이 큰가?' — docs/strike/italian_retreat_2026-10-17.md §6). 읽기만.
//  플레이어 = 레이피어(이탈리아 막기 책) · 막기 단추를 쥔 채 서 있음(main.js 처럼 기력 장부가 막기 단추를 읽음) · 상대 = 여정 상대 AI(그 인물 · 무기 · 난이도 — 총수는 뺌: 막기 단추가 총알을 받지 않음)
//  꼴 낱말('+' 로 잇기): base · retreat(SKILL.itRetreat 1 — 막기 단추가 물러섬) · own(itRetreat 2 + 사람 흉내: 새 공격을 읽은 그 스텝의 거리가 gap 이상이면 HUM_RT s 뒤 스틱을 뒤로 — 그 한 짝이 끝날 때까지)
//   · beat(SKILL.itParryBeat 1) · rip(되찌르기: AI 가 공격을 마쳤다고 볼 때(ai.afterStrike) 그 공격에 안 베였으면 막기를 놓고 앞으로 걸으며 reach 안이면 탭 찌르기 — 맞히거나 탭 0.5 s 뒤 · 1.5 s 면 다시 막기)
//  싸움마다 적음: 공격 수 · 물러섬 · 막기 단추가 스틱을 쥔 시간 · 플레이어 칼날 상처 W [부위 · 자리 · c 베기 / s 찌르기 · 심각도 · J · 때] · 죽음 · 끝 피 · 되찌르기 · 탭 · 맞힘 · 상대 상처 WA ·
//   새 공격을 읽은 때 거리 reads · 끝 반지름 · 가장 먼 반지름
//  VARIANTS=base,retreat,own SEEDS=1-2 DUR=30 HUM_RT=0.25 RETREAT='{"gap":1.35}' FOES=id,… OUT=<json> node tools/sim/italian_retreat_fight.mjs
import { newRound, DT } from './harness_m.mjs';
import { writeFileSync } from 'node:fs';
import { SKILL } from '../../src/config.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { STAGE_ORDER, STAGE_FOE, STAGE_FOE_EXTRA } from '../../src/stages.js';
import { getWeapon } from '../../src/weapons.js';

const VARIANTS = (process.env.VARIANTS ?? 'base,retreat').split(',');
const [s0, s1] = (process.env.SEEDS ?? '1-2').split('-').map(Number);
const DUR = +(process.env.DUR ?? 30);
const HUM_RT = +(process.env.HUM_RT ?? 0.25);
if (process.env.RETREAT) Object.assign(SKILL.itRetreatVals, JSON.parse(process.env.RETREAT));
// 여정 상대 (tech_usage.mjs 와 같은 목록 — 얼터는 원본과 같은 AI 라 빼고 광기의 하인리히만)
const journey = [...new Set(STAGE_ORDER.flatMap((st) => [STAGE_FOE[st], ...(STAGE_FOE_EXTRA[st] ?? [])]))].filter((id) => id && (!id.endsWith('_mad') || id === 'heinrich_mad'));
const FOES = (process.env.FOES ? process.env.FOES.split(',') : journey).filter((id) => {
  const F = CHARACTERS_BY_ID[id];
  return F && !getWeapon(F.weapon)?.gun;
});

function fight(id, seed, variant) {
  const tok = new Set(variant.split('+'));
  const keep = { r: SKILL.itRetreat, b: SKILL.itParryBeat };
  SKILL.itRetreat = tok.has('retreat') ? 1 : tok.has('own') ? 2 : 0;
  SKILL.itParryBeat = tok.has('beat') ? 1 : 0;
  try {
    return fightRun(id, seed, tok);
  } finally {
    SKILL.itRetreat = keep.r;
    SKILL.itParryBeat = keep.b;
  }
}

function fightRun(id, seed, tok) {
  const F = CHARACTERS_BY_ID[id];
  SKILL.parryAssist = 0;
  const Gm = newRound({ seed, difficulty: F.ai.level, persona: F.ai.persona, weapon2: F.weapon, weapon: 'rapier', revive: F.revive });
  const D = Gm.player, A = Gm.enemy, ai = Gm.ai;
  D.skill.corr = SKILL.corr;
  D.skill.corrTip = SKILL.corrTip;
  D.skill.autoGuard = true;
  const guard = new PlayerParryGuard(D, A);
  D.stamina.controller = guard; // main.js 와 같게 (막는 동안 기력 · 근육 빠르기)
  guard.held = true;
  const W = [], WA = [];
  const pw = Gm.combat.hooks.onWound;
  Gm.combat.hooks.onWound = (att, vic, res, point, pr) => {
    pw?.(att, vic, res, point, pr);
    if (res.type === 'blunt' || !(res.severity > 0)) return;
    const w = [pr?.v?.part ?? null, res.zone, res.type === 'stab' ? 's' : 'c', +res.severity.toFixed(3), Math.round(res.energy), +Gm.t.toFixed(2)];
    if (vic === D) W.push(w);
    else if (vic === A && att === D) WA.push(w);
  };
  // 공격 셈 · 그 공격 동안 베였나 (되찌르기는 안 베인 공격 뒤에만)
  let attacks = 0, atkW = 0, pendingRip = false;
  const sc = ai.strikeCue.bind(ai);
  ai.strikeCue = (t) => {
    attacks++;
    atkW = W.length;
    return sc(t);
  };
  const as0 = ai.afterStrike.bind(ai);
  ai.afterStrike = (d) => {
    if (tok.has('rip') && W.length === atkW) pendingRip = true;
    return as0(d);
  };
  const reach = D.swordArt?.measure?.reach ?? 1.6;
  let rip = null, rips = 0, taps = 0, ripHits = 0, overT = 0;
  let hum = null, lastThreats = 0, d1 = null, nReads = 0, maxR = 0;
  const reads = [];
  Gm.before = () => {
    // 사람 흉내 (own): 새 공격을 읽은 다음 스텝에 그 거리를 보고 HUM_RT s 뒤 스틱을 뒤로 (main.js 가 스틱을 정한 뒤 막기 단추가 도는 차례와 같게 막기 단추보다 먼저)
    if (tok.has('own') && !rip) {
      if (guard.stats.threats > lastThreats) {
        lastThreats = guard.stats.threats;
        if (!hum && d1 != null && d1 >= SKILL.itRetreatVals.gap) hum = { at: Gm.t + HUM_RT, on: false, seen: false, t0: 0 };
      }
      if (hum) {
        if (!hum.on && Gm.t >= hum.at) Object.assign(hum, { on: true, t0: Gm.t });
        if (hum.on) {
          if (guard.retreat) hum.seen = true;
          if ((hum.seen && !guard.retreat) || Gm.t - hum.t0 > SKILL.itRetreatVals.maxT) {
            hum = null;
            D.stickX = D.stickY = 0;
            D.move.set(0, 0);
          } else {
            D.stickX = 0;
            D.stickY = -1;
            D.move.set(0, -1);
          }
        }
      }
    }
    // 되찌르기 (rip)
    if (pendingRip && !rip && !guard.retreat && !hum && D.state === 'stand') {
      pendingRip = false;
      rip = { t0: Gm.t, tap: null, w0: WA.length };
      rips++;
      guard.held = false;
    }
    if (rip) {
      const el = Gm.t - rip.t0;
      D.stickX = 0;
      D.stickY = 1;
      D.move.set(0, 1);
      if (rip.tap == null && D.foeDistance() <= reach && D.skill.thrust()) (rip.tap = el), taps++;
      const hit = WA.length > rip.w0;
      if (hit || (rip.tap != null && el - rip.tap > 0.5) || el > 1.5 || D.state !== 'stand') {
        if (hit) ripHits++;
        rip = null;
        guard.held = true;
        D.stickY = 0;
        D.move.set(0, 0);
      }
    }
    guard.step(DT);
    D.inputActive = guard.active;
    if (guard.stats.threats > nReads) (nReads = guard.stats.threats), (d1 = D.foeDistance()), reads.push(+d1.toFixed(2)); // 새 공격을 읽은 그 스텝의 거리
    if (guard.retreat && !guard.retreat.own) overT += DT;
    const p = D.bodies.pelvis.translation();
    maxR = Math.max(maxR, Math.hypot(p.x, p.z));
  };
  const steps = Math.round(DUR / DT);
  for (let i = 0; i < steps; i++) {
    Gm.step();
    if (!D.alive || !A.alive) break;
  }
  const p = D.bodies.pelvis.translation();
  return {
    id, seed, t: +Gm.t.toFixed(2), attacks, threats: guard.stats.threats, retreats: guard.stats.retreats ?? 0, overT: +overT.toFixed(2),
    W, dDead: D.alive ? null : D.causeOfDeath ?? 'dead', blood: +D.blood.toFixed(3),
    rips, taps, ripHits, WA, aDead: A.alive ? null : A.causeOfDeath ?? 'dead', reads,
    r: +Math.hypot(p.x, p.z).toFixed(2), maxR: +maxR.toFixed(2),
  };
}

const out = { dur: DUR, humRt: HUM_RT, gap: SKILL.itRetreatVals.gap, foes: FOES, runs: {} };
for (const v of VARIANTS) {
  const rows = [];
  for (const id of FOES) for (let s = s0; s <= s1; s++) rows.push(fight(id, s, v));
  out.runs[v] = rows;
  const sum = (f) => rows.reduce((a, r) => a + f(r), 0);
  const sev = sum((r) => r.W.reduce((a, w) => a + w[3], 0));
  console.log(`${v.padEnd(20)} 싸움 ${rows.length} · 공격 ${sum((r) => r.attacks)} · 물러섬 ${sum((r) => r.retreats)} · 칼날 상처 ${sum((r) => r.W.length)} (심각도 합 ${sev.toFixed(1)}) · 내가 죽음 ${sum((r) => (r.dDead ? 1 : 0))} · 상대 죽음 ${sum((r) => (r.aDead ? 1 : 0))} · 되찌르기 ${sum((r) => r.rips)} 탭 ${sum((r) => r.taps)} 맞힘 ${sum((r) => r.ripHits)} · 스틱 쥔 시간 ${sum((r) => r.overT).toFixed(1)} s`);
}
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out));

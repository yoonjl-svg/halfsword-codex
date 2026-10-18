// 막기 몸꼴(덧씌우기 parryCover) 자세가 사람 몸으로 되는지 재기 (10/17 02:1x 사장님 '기존 우케나가시 동작에서 … 완전 팔이 비틀린 물리 오류'). 읽기만.
//  AI(그 무기 · 그 유파)가 한 줄을 막는 자세로 1.4 s 서 있게 하고(school_parry_shots.mjs 와 같은 붙잡기 — mode 'defend' · defLine), envelope_check.mjs sample 로
//  관절 각(어깨 들림·벌림 · 팔꿈치 · 손목(아래팔-칼) · 아래팔 돌림 · 척추 비틀림)과 제 몸 뚫림을 잰다. 사람 봉투(human_envelope.json 'all') · 설계 · 문헌 칸 밖이면 적는다.
//  WEAPON=<무기> LINE=<줄> TR=<유파 — 몸꼴을 얹을 꾸러미, 기본 무기의 유파> CANDS=<json [{tag, cover}] — cover null = 지금 판> OUT=<json>
//  node tools/sim/cover_pose_check.mjs
import { newRound, DT } from './harness_m.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { TRADITIONS } from '../../src/schools.js';
import { sample, RANGES } from './envelope_check.mjs';

const WEAPON = process.env.WEAPON ?? 'uchigatana';
const LINE = process.env.LINE ?? 'highC';
const cands = process.env.CANDS ? JSON.parse(readFileSync(process.env.CANDS, 'utf8')) : [{ tag: '지금', cover: null }];

function check(cover) {
  const probe = newRound({ weapon: 'longsword', weapon2: WEAPON, seed: 1, gap: 2.2 });
  const TR = process.env.TR ?? probe.enemy.swordArt?.tradition;
  probe.world.free();
  const T = TRADITIONS[TR];
  const keep = Object.getOwnPropertyDescriptor(T, 'parryCover');
  if (cover) {
    const base = keep ? (keep.get ? keep.get.call(T) : keep.value) ?? {} : {};
    Object.defineProperty(T, 'parryCover', { value: { ...base, [LINE]: { name: '시험', pad: T.parry[LINE], ...cover } }, configurable: true, writable: true });
  }
  const Gm = newRound({ weapon: 'longsword', weapon2: WEAPON, seed: 1, gap: 2.2 }); // AI 생성자가 parryCover 를 읽는다
  if (cover) {
    if (keep) Object.defineProperty(T, 'parryCover', keep);
    else delete T.parryCover;
  }
  const ai = Gm.ai, f = Gm.enemy;
  const pad = ai.school.parry[LINE];
  ai.update = (dt) => {
    ai.sense.record(dt);
    f.move.set(0, 0);
    Object.assign(ai, { mode: 'defend', phase: 'guard', defVoid: false, defLine: LINE });
    ai.hand.set(pad[0], pad[1]);
    ai.handSpeed = 2.5;
    ai.moveHand(dt);
  };
  Gm.player.applyWound = () => {};
  f.applyWound = () => {};
  let worst = null;
  const t0 = Gm.t;
  const acc = {};
  while (Gm.t - t0 < 1.4) {
    Gm.step();
    if (Gm.t - t0 < 0.9) continue; // 몸꼴이 다 얹힌 뒤 0.5 s
    const s = sample(f);
    for (const [k, v] of Object.entries(s)) if (typeof v === 'number') (acc[k] = acc[k] ?? []).push(v);
    if (!worst || s.penMax > worst.penMax) worst = s;
  }
  const mean = Object.fromEntries(Object.entries(acc).map(([k, a]) => [k, a.reduce((x, y) => x + y, 0) / a.length]));
  const out = [];
  for (const [k, [lo, hi]] of Object.entries(RANGES.env)) if (mean[k] != null && (mean[k] < lo - 1 || mean[k] > hi + 1)) out.push(`${k} ${mean[k].toFixed(0)}° (봉투 ${lo.toFixed(0)}~${hi.toFixed(0)})`);
  for (const [name, x] of Object.entries(RANGES.extra)) {
    const v = mean[x.key];
    if (v == null || (x.when && !x.when(mean))) continue;
    if (v < x.lo || v > x.hi) out.push(`${name}: ${v.toFixed(0)}°`);
  }
  if ((worst?.penMax ?? 0) > 0.01) out.push(`제 몸 뚫림 ${(worst.penMax * 100).toFixed(0)} cm (${Object.entries(worst.pen ?? {}).filter(([, d]) => d > 0.01).map(([k]) => k).join(' · ')})`);
  const cw = +(f.skill._cover?.w ?? 0).toFixed(2);
  Gm.world.free();
  return { cw, mean: Object.fromEntries(['shElevS', 'shPlaneS', 'shElevO', 'shPlaneO', 'elbowS', 'elbowO', 'wrist', 'forearmRoll', 'spineTwist'].map((k) => [k, mean[k] != null ? +mean[k].toFixed(0) : null])), out };
}

const res = cands.map((c) => ({ ...c, ...check(c.cover) }));
for (const r of res) console.log(`${String(r.tag).padEnd(8)} 몸꼴 ${r.cw} | ${r.out.length ? '밖: ' + r.out.join(' · ') : '사람 범위 안'} | ${JSON.stringify(r.mean)}`);
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(res, null, 1));

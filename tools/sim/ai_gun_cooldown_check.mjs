// AI 리볼버 발 사이 간격 점검 — 사장님 10/16 지시 (샛별 쪽 메모로 전달, 10/17 들여옴 · 확인표 2022 · docs/import/saetbyeol_requests_2026-10-17.md)
//  GUN.aiCooldownK(1.8)는 AI 가 모는 몸(f.aiControlled — ai.js AI 생성자가 붙이는 표시)의 발 사이 간격에만 곱한다.
//  실제 gun.js updateGun 길을 그대로 돌리고, 한 발이 나간 바로 그 스텝에 정해진 시간(f.gun.cool)을 읽는다:
//   장전이 아닐 때 = 발 사이 간격(GUN.cooldown × 인물 배율 gunCooldownK × AI 배율) · 여섯째 발 뒤 = 장전(GUN.reload).
//  사람 손은 '쏠 수 있으면 바로 탭'(skill.thrust — 게임의 찌르기 단추와 같은 길)으로 흉내 낸다. 이 손에는 AI 표시가 없다.
//  '전' = 같은 판을 GUN.aiCooldownK = 1 로 돌린 것(바꾸기 전 식 GUN.cooldown × gunCooldownK 와 숫자가 같다) · '후' = 지금 값.
//  결정적: harness_m newRound 의 seed 로 Math.random 을 고정한다. 어긋난 줄이 있으면 '실패' 를 찍고 종료 코드 1.
//   node tools/sim/ai_gun_cooldown_check.mjs
import { newRound, DT, AI } from './harness_m.mjs';
import { GUN } from '../../src/gun.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

const K_NOW = GUN.aiCooldownK; // 지금 값 (1.8)
const SAMIRA = CHARACTERS_BY_ID.samira; // 마야(id samira — 메모의 '사미라'): persona.gunCooldownK 1.5
const FOE_SAMIRA = { weapon2: 'pistol', look2: SAMIRA.look, difficulty: SAMIRA.ai.level, persona: SAMIRA.ai.persona };
const near = (a, b) => Math.abs(a - b) < 1e-9;
const allNear = (xs, v) => xs.length > 0 && xs.every((x) => near(x, v));
const fmt = (xs) => (xs.length ? [...new Set(xs.map((x) => +x.toFixed(6)))].join('/') + ' s' : '없음');
let fails = 0;
const check = (ok, msg) => {
  console.log(`  ${ok ? '통과' : '실패'} · ${msg}`);
  if (!ok) fails++;
};

/** 사람 손 흉내: 쏠 수 있으면 바로 탭한다 (AI 가 아니다 — aiControlled 를 붙이지 않는다). harness 의 AIClass / AI2Class 자리에 넣는다 */
class Tapper {
  constructor(me) {
    this.me = me;
  }
  update() {
    if (this.me.weapon?.gun) this.me.skill.thrust();
  }
}
/** 판 하나를 secs 초 돌리며 두 몸의 발사를 적는다 — 쏜 스텝의 { t, cool(정해진 시간), reload(장전으로 넘어갔나) } */
function run(opts, secs, k = K_NOW, before = null) {
  GUN.aiCooldownK = k;
  try {
    const G = newRound({ walls: true, ...opts });
    before?.(G);
    const F = [G.player, G.enemy];
    const shots = [[], []];
    const seen = [0, 0];
    for (let i = 0; i < Math.round(secs / DT); i++) {
      G.step();
      F.forEach((f, j) => {
        const n = f.gun?.shots ?? 0;
        if (n > seen[j]) {
          seen[j] = n;
          shots[j].push({ t: +G.t.toFixed(4), cool: f.gun.cool, reload: f.gun.reloading });
        }
      });
    }
    return { P: G.player, E: G.enemy, sP: shots[0], sE: shots[1] };
  } finally {
    GUN.aiCooldownK = K_NOW;
  }
}
const gapsOf = (s) => s.filter((x) => !x.reload).map((x) => x.cool); // 정해진 발 사이 간격
const reloadsOf = (s) => s.filter((x) => x.reload).map((x) => x.cool); // 정해진 장전 시간
/** 실제로 잰 발 사이 시간 (장전을 낀 사이는 뺀다) — 정해진 간격보다 짧을 수 없다 */
const realGaps = (s) => {
  const out = [];
  for (let i = 1; i < s.length; i++) if (!s[i - 1].reload) out.push(s[i].t - s[i - 1].t);
  return out;
};
const minOf = (xs) => (xs.length ? Math.min(...xs) : NaN);
const line = (name, s) => {
  const m = minOf(realGaps(s));
  return `${name}: ${s.length}발 · 간격 ${fmt(gapsOf(s))} · 장전 ${fmt(reloadsOf(s))} · 첫 발 ${s[0] ? s[0].t + ' s' : '없음'} · 실제 최소 간격 ${Number.isNaN(m) ? '없음' : m.toFixed(3) + ' s'}`;
};

console.log(`GUN.cooldown ${GUN.cooldown} s · GUN.reload ${GUN.reload} s · GUN.aiFirst ${GUN.aiFirst} s · GUN.aiCooldownK ${K_NOW} · 사미라(마야) gunCooldownK ${SAMIRA.ai.persona.gunCooldownK}`);
check(K_NOW === 1.8, 'GUN.aiCooldownK = 1.8 (GUN.cooldown 0.8 · reload 8 은 그대로)');
check(GUN.cooldown === 0.8 && GUN.reload === 8 && GUN.aiFirst === 1.5, 'GUN.cooldown 0.8 · GUN.reload 8 · GUN.aiFirst 1.5 그대로 (플레이어 간격 · 장전 · 첫 발 지연을 건드리지 않음)');

// ① 사람 대 AI (AI 는 롱소드로 실제로 싸운다): 사람 권총의 간격 · 장전 · 쏜 시각이 전과 바이트 같다
console.log('\n① 사람(권총, 탭) 대 롱소드 AI — 20 s · 씨앗 21');
{
  const o = { seed: 21, weapon: 'pistol', weapon2: 'longsword', AI2Class: Tapper };
  const a = run(o, 20, 1);
  const b = run(o, 20);
  console.log(`  전 ${line('사람', a.sP)}\n  후 ${line('사람', b.sP)}`);
  check(!b.P.aiControlled && b.E.aiControlled, '플레이어 자리 = 사람(AI 표시 없음) · 상대 = AI');
  check(allNear(gapsOf(b.sP), 0.8) && allNear(reloadsOf(b.sP), 8), '사람 간격 0.8 s · 장전 8 s');
  check(JSON.stringify(a.sP) === JSON.stringify(b.sP), `사람의 발사 기록(쏜 시각 · 간격 · 장전) ${b.sP.length}발이 전과 같다`);
}

// ② 사람 대 기본 AI 권총(인물 배율 없음): AI 0.8 → 1.44 s · 장전 8 · 첫 발 시각 그대로
console.log('\n② 가만히 선 사람(롱소드) 대 기본 AI(권총, 인물 배율 없음) — 24 s · 씨앗 11');
{
  const o = { seed: 11, weapon: 'longsword', weapon2: 'pistol' };
  const a = run(o, 24, 1);
  const b = run(o, 24);
  console.log(`  전 ${line('AI', a.sE)}\n  후 ${line('AI', b.sE)}`);
  check(b.E.gunCooldownK === undefined, 'AI 몸에 인물 배율 없음 (gunCooldownK 없음 → 1)');
  check(allNear(gapsOf(a.sE), 0.8) && allNear(gapsOf(b.sE), 1.44), 'AI 간격 전 0.8 s → 후 1.44 s');
  check(allNear(reloadsOf(a.sE), 8) && allNear(reloadsOf(b.sE), 8), 'AI 장전 8 s 그대로 (전 · 후)');
  check(a.sE[0] && b.sE[0] && a.sE[0].t === b.sE[0].t, `AI 첫 발 시각 그대로 (${a.sE[0]?.t} s — 첫 발 지연은 간격과 무관)`);
  check(minOf(realGaps(b.sE)) >= 1.44 - 1e-9, `실제로 잰 AI 발 사이 시간도 1.44 s 아래로 내려가지 않음 (최소 ${minOf(realGaps(b.sE)).toFixed(3)} s)`);
}

// ③ 사람 대 AI 사미라(마야): 인물 배율 1.5 는 그대로, AI 배율을 위에 얹어 1.2 → 2.16 s
console.log('\n③ 가만히 선 사람(롱소드) 대 AI 사미라(마야, 권총, 인물 배율 1.5) — 30 s · 씨앗 12');
{
  const o = { seed: 12, weapon: 'longsword', ...FOE_SAMIRA };
  const a = run(o, 30, 1);
  const b = run(o, 30);
  console.log(`  전 ${line('사미라', a.sE)}\n  후 ${line('사미라', b.sE)}`);
  check(b.E.gunCooldownK === 1.5, '사미라 인물 배율 1.5 그대로 몸에 붙음');
  check(allNear(gapsOf(a.sE), 1.2) && allNear(gapsOf(b.sE), 2.16), '사미라 간격 전 1.2 s → 후 2.16 s');
  check(allNear(reloadsOf(b.sE), 8), '사미라 장전 8 s 그대로');
  check(a.sE[0] && b.sE[0] && a.sE[0].t === b.sE[0].t, `사미라 첫 발 시각 그대로 (${a.sE[0]?.t} s)`);
  check(minOf(realGaps(b.sE)) >= 2.16 - 1e-9, `실제로 잰 발 사이 시간 최소 ${minOf(realGaps(b.sE)).toFixed(3)} s ≥ 2.16`);
}

// ④ 사람 대 AI, 둘 다 권총: 같은 판에서 사람 0.8 · AI 1.44
console.log('\n④ 사람(권총, 탭) 대 기본 AI(권총) — 24 s · 씨앗 13');
{
  const o = { seed: 13, weapon: 'pistol', weapon2: 'pistol', AI2Class: Tapper };
  const a = run(o, 24, 1);
  const b = run(o, 24);
  console.log(`  전 ${line('사람', a.sP)}\n      ${line('AI', a.sE)}\n  후 ${line('사람', b.sP)}\n      ${line('AI', b.sE)}`);
  check(allNear(gapsOf(a.sP), 0.8) && allNear(gapsOf(b.sP), 0.8), '사람 간격 전 · 후 모두 0.8 s');
  check(allNear(reloadsOf(b.sP), 8) || reloadsOf(b.sP).length === 0, '사람 장전 8 s (장전까지 갔으면)');
  check(allNear(gapsOf(a.sE), 0.8) && allNear(gapsOf(b.sE), 1.44), 'AI 간격 전 0.8 s → 후 1.44 s');
}

// ⑤ AI 대 AI: 플레이어 자리(index 0)도 AI 가 몰면 곱해진다 — 기본 AI 1.44 · 사미라 2.16
console.log('\n⑤ AI 대 AI — 플레이어 자리 기본 AI(권총) 대 사미라(권총) — 30 s · 씨앗 14');
{
  const o = { seed: 14, weapon: 'pistol', ...FOE_SAMIRA, AI2Class: AI, difficulty2: 'normal' };
  const a = run(o, 30, 1);
  const b = run(o, 30);
  console.log(`  전 ${line('P 기본 AI', a.sP)}\n      ${line('E 사미라', a.sE)}\n  후 ${line('P 기본 AI', b.sP)}\n      ${line('E 사미라', b.sE)}`);
  check(b.P.aiControlled && b.P.index === 0, '플레이어 자리(index 0)를 AI 가 몬다');
  check(allNear(gapsOf(a.sP), 0.8) && allNear(gapsOf(b.sP), 1.44), 'P 기본 AI 간격 전 0.8 → 후 1.44 s');
  check(allNear(gapsOf(a.sE), 1.2) && allNear(gapsOf(b.sE), 2.16), 'E 사미라 간격 전 1.2 → 후 2.16 s');
  check([...reloadsOf(b.sP), ...reloadsOf(b.sE)].every((x) => near(x, 8)), '장전은 둘 다 8 s');
}

// ⑥ 자리와 무관: 상대 자리(index 1)를 사람 손이 몰면 곱해지지 않고, 플레이어 자리 AI 는 곱해진다
console.log('\n⑥ 자리 바꿈 — 플레이어 자리 기본 AI(권총) 대 상대 자리 사람 손(권총, 탭) — 24 s · 씨앗 15');
{
  const b = run({ seed: 15, weapon: 'pistol', weapon2: 'pistol', AIClass: Tapper, AI2Class: AI }, 24);
  console.log(`  후 ${line('P AI', b.sP)}\n      ${line('E 사람', b.sE)}`);
  check(b.P.aiControlled && !b.E.aiControlled && b.E.index === 1, '상대 자리(index 1) = 사람 손 · 플레이어 자리 = AI');
  check(allNear(gapsOf(b.sE), 0.8), '상대 자리 사람 간격 0.8 s (자리로 곱하지 않음)');
  check(allNear(gapsOf(b.sP), 1.44), '플레이어 자리 AI 간격 1.44 s (조종하는 쪽으로 곱함)');
}

// ⑦ 다시 시작 · 새 판: 같은 판을 한 프로세스에서 세 번 — 매번 2.16 s (두 번 곱해 3.888 s 가 되지 않음)
console.log('\n⑦ 다시 시작 · 새 판 — ③ 과 같은 판을 세 번 이어서');
{
  const o = { seed: 12, weapon: 'longsword', ...FOE_SAMIRA };
  const r = [run(o, 30), run(o, 30), run(o, 30)];
  r.forEach((x, i) => console.log(`  ${i + 1}번째 ${line('사미라', x.sE)}`));
  check(r.every((x) => allNear(gapsOf(x.sE), 2.16)), '세 판 모두 사미라 간격 2.16 s');
  check(r.every((x) => JSON.stringify(x.sE) === JSON.stringify(r[0].sE)), '세 판의 발사 기록이 서로 같다 (판 사이에 쌓이는 값 없음)');
}

// ⑧ 무기 바꿈: 새 판마다 상대 무기를 권총 → 롱소드 → 권총 (게임은 무기를 고르면 새 판을 세운다)
console.log('\n⑧ 무기 바꿈 — 기본 AI 상대 무기 권총 → 롱소드 → 권총 (새 판마다) — 24 s · 씨앗 11');
{
  const g1 = run({ seed: 11, weapon: 'longsword', weapon2: 'pistol' }, 24);
  const sw = run({ seed: 11, weapon: 'longsword', weapon2: 'longsword' }, 6);
  const g2 = run({ seed: 11, weapon: 'longsword', weapon2: 'pistol' }, 24);
  console.log(`  권총 ${line('AI', g1.sE)}\n  롱소드 판: 쏜 발 ${sw.sE.length} · 총 상태 ${sw.E.gun ? '있음' : '없음'}\n  권총 ${line('AI', g2.sE)}`);
  check(allNear(gapsOf(g1.sE), 1.44) && allNear(gapsOf(g2.sE), 1.44), '권총으로 돌아와도 AI 간격 1.44 s');
  check(sw.sE.length === 0 && !sw.E.gun, '롱소드 판에는 총 상태가 생기지 않음');
  check(JSON.stringify(g1.sE) === JSON.stringify(g2.sE), '앞뒤 권총 판의 발사 기록이 같다');
}

// ⑨ 같은 몸에 AI 를 다시 붙여도 (AI 생성자를 세 번) 인물 배율은 1.5 로 덮어쓰기만 하고 간격은 2.16 s
//  (생성자가 성격을 무작위로 굴려 판의 난수 차례가 달라지므로 발사 기록은 견주지 않고 정해진 간격만 본다)
console.log('\n⑨ 같은 몸에 AI 다시 붙이기 — 사미라 몸에 AI 생성자를 두 번 더 (몰기는 처음 AI 가 그대로) — 30 s · 씨앗 12');
{
  const o = { seed: 12, weapon: 'longsword', ...FOE_SAMIRA };
  const b = run(o, 30, K_NOW, (G) => {
    const ctl = G.enemy.stamina.controller; // 처음 AI (harness 가 판마다 부른다)
    for (let i = 0; i < 2; i++) new AI(G.enemy, G.player, SAMIRA.ai.level, SAMIRA.ai.persona);
    G.enemy.stamina.controller = ctl; // 기력 장부의 방어 상태는 처음 AI 를 그대로 본다 (몰기와 같게)
  });
  console.log(`  후 ${line('사미라', b.sE)}`);
  check(b.E.gunCooldownK === 1.5, '인물 배율은 1.5 그대로 (곱하지 않고 덮어씀)');
  check(allNear(gapsOf(b.sE), 2.16) && allNear(reloadsOf(b.sE), 8), '간격 2.16 s · 장전 8 s 그대로');
}

console.log(`\n${fails ? `실패 ${fails}줄` : '모두 통과'}`);
process.exitCode = fails ? 1 : 0;

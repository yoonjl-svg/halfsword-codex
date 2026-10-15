// 빠른 걸음 계기 (10/15 — 이탈리아 박자 걸음, docs/strike/italian_rhythm_2026-10-15.md): 플레이어 스틱 대본에서 앞뒤 걸음마다 시각·시간·나간 거리·빠르기를 뽑아
//  every + 1 째 걸음이 mul 배인지, 셈이 앞 ↔ 뒤로 이어지는지 본다. 같은 대본을 주기 끔(every 0)·3 + 1·4 + 1 로 견준다.
//  한 걸음 = gait.js fastBegin 과 같은 가름(짝걸음이면 이끄는 발로 여는 한 짝, 아니면 걷는 동안 walk·catch 한 디딤 · 스틱 앞뒤 몫이 옆 몫보다 큰 걸음만) — 끔에서도 같은 자리를 센다.
//  걸음 시간·거리 = 그 걸음을 뗀 때부터 다음 센 걸음을 뗄 때까지(대본 끝에서 끊긴 마지막 걸음은 뺌) · 거리 = 골반 수평 이동 크기 · 빠르기 = 거리 ÷ 시간 · 최고 = 그 사이 골반 수평 빠르기 최고
//  빠름 ÷ 보통 = 빠른 걸음 평균 ÷ 보통 걸음 평균(출발 가속 걸음 포함) · 빠름 ÷ 이웃 = 빠른 걸음마다 바로 앞·뒤 보통 걸음 평균과 견준 값의 평균(첫 갈래)
//  안정(대본마다 갈래 셋을 더함 — 아래 VAR): 넘어짐(stand → down) · 붙잡기 반사 시간(gait.levC > 0.3) · 옮겨 딛기(catch 디딤) · 일찍 디딤(walk 걸음이 정한 발 뜬 시간 85 % 전에 디딤)
//  틈 = walk 디딤 뒤 다음 걸음을 떼기까지 가장 긴 시간(걷는 동안 — 셈 끊김 시간 idle 을 고르는 잣대)
//  발소리 = sound.js BodySounds 와 같은 판정(발 몸체 높이 0.09 m 위로 떴다가 0.06 m 아래로 — 0.12 s 안 두 번은 하나)을 흉내 내 센 수 · (그중 빠른 걸음 발 — gait leg.fastStep)
//  재기만 — 물리·난수는 게임 그대로(begin·touchdown 을 감싸 읽기만), 판 하나는 결정적. 다가가기·쉼은 주기 끔으로(켬·끔 출발 자리가 같게)
//  대본 (스틱 앞뒤 y): A 앞 끝 3 s · B 뒤 끝 3 s · C 앞 끝 ↔ 뒤 끝 0.75 s 씩 번갈아 3 s — A~C 는 상대를 멀리 치움(혼자, 벽 없음 — 스틱 끝이면 어차피 지나 딛기)
//   D 짝걸음 앞 0.3 6 s · E 짝걸음 뒤 0.6 6 s · F 짝걸음 앞 0.3 ↔ 뒤 0.6 1.2 s 씩 번갈아 6 s — D~F 는 상대가 가슴 거리 2.3 m 를 지킴(follow 안 · 짝걸음)
//   갈래(안정 합): A·B 스틱 1.0·0.9·0.8 · C 번갈아 0.75·0.6·0.9 s · D~F 지키는 거리 2.3·2.0·2.6 m (걸음마다 줄은 첫 갈래만 · RSF_STICK·RSF_PER·RSF_KEEP 로 바꿈,
//   D~F 스틱은 RSF_DSTICK(앞 0.3)·RSF_ESTICK(뒤 0.6))
//  10/15 디딤 셈(docs/strike/italian_rhythm_2026-10-15.md §8): 주기 칸은 setItalianRhythm 글 — '0' 끔 · 'N' 옛 짝 셈 N + 1 · 'N+M' 디딤 셈 N + M.
//   디딤 셈이면 걸음마다 줄·빠름 ÷ 이웃도 디딤 하나씩(짝걸음 따라붙는 발도) · 덧붙인 칸 '디딤 기준'(모든 셈 같은 잣대): 앞뒤 디딤 수 · 그중 빠른 디딤 몫 ·
//   빠른 몫(이어진 빠른 디딤 묶음) 수와 분당 · 빠른 몫 빠르기 ÷ 바로 앞 보통 디딤 둘 빠르기(몫마다 평균 — 첫 갈래)
//  10/15 15:1x 기본 2 + 2 · ×1.3(§9) — 칸 이름에 그 갈래 배율(지난 판 비교 4+2 · 3+2 · 옛 짝 셈 N 은 ×1.5 — setItalianRhythm)
//  실행: node tools/sim/rhythm_step_feel.mjs [무기 rapier] [주기들 0,2+2,4+2,3] [대본들 A,B,C,D,E,F]   (RSF_ROWS=1 → 걸음마다 줄)
import { newRound, DT } from './harness_m.mjs';
import { Gait } from '../../src/gait.js';
import { TRADITIONS, setItalianRhythm } from '../../src/schools.js';

const id = process.argv[2] || 'rapier';
const EVERY = (process.argv[3] || '0,2+2,4+2,3').split(',');
const SCN = (process.argv[4] || 'A,B,C,D,E,F').split(',');
const ROWS = process.env.RSF_ROWS === '1';
const RH = TRADITIONS.italian.gait.rhythm;
const RH0 = { ...RH };
const mulOf = (e) => (setItalianRhythm(e), Object.assign({}, RH).mul); // 그 갈래 배율 (아래 run 이 끝나면 RH0 로 되돌림 — 칸 이름만 읽음)
const label = (e) => { const m = mulOf(e); Object.assign(RH, RH0); return +e === 0 && !/[+ ]/.test(e) ? '끔' : /[+ ]/.test(e) ? `${e.replace(/\s*[+ ]\s*/, ' + ')} (디딤 ×${m})` : `${e} + 1 (짝 ×${m})`; };
const isFoot = (e) => /[+ ]/.test(e);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

let rec = null; // 지금 재는 판
const B0 = Gait.prototype.begin;
Gait.prototype.begin = function (l, kind, T) {
  B0.call(this, l, kind, T);
  if (!rec || this.f !== rec.who) return;
  const p = this.f.bodies.pelvis.translation();
  rec.begins.push({ t: rec.t, kind, pairOn: !!this.pairOn, pairStep: this.pairStep, walking: !!this.walking, fastK: this.fastK, x: p.x, z: p.z, mx: this.f.move.x, my: this.f.move.y });
};
const TD0 = Gait.prototype.touchdown;
Gait.prototype.touchdown = function (l, speed) {
  const kind = l.kind;
  const early = kind === 'walk' && l.t < 0.85 * l.T;
  TD0.call(this, l, speed);
  if (rec && this.f === rec.who) rec.tds.push({ t: rec.t, kind, early });
};

const alt = (a, b, per, total) => Array.from({ length: Math.round(total / per) }, (_, i) => [i % 2 ? b : a, per]);
// 갈래 바꾸기(env, 쉼표): RSF_STICK = A·B 스틱 세기 · RSF_PER = C 번갈아 주기 s · RSF_KEEP = D~F 지키는 거리 m
const list = (e, d) => (process.env[e] ? process.env[e].split(',').map(Number) : d);
const STICK = list('RSF_STICK', [1, 0.9, 0.8]);
const PER = list('RSF_PER', [0.75, 0.6, 0.9]);
const KEEP = list('RSF_KEEP', [2.3, 2.0, 2.6]);
const DS = +process.env.RSF_DSTICK || 0.3; // D·F 앞 스틱 · E·F 뒤 스틱 (RSF_DSTICK · RSF_ESTICK)
const ES = +process.env.RSF_ESTICK || 0.6;
const SCRIPTS = {
  A: { park: true, name: '앞 끝 3 s', vars: STICK.map((k) => [[k, 3]]) },
  B: { park: true, name: '뒤 끝 3 s', vars: STICK.map((k) => [[-k, 3]]) },
  C: { park: true, name: '앞 끝 ↔ 뒤 끝 0.75 s 씩 3 s', vars: PER.map((p) => alt(1, -1, p, 3)) },
  D: { keep: KEEP, name: `짝걸음 앞 ${DS} · 6 s`, vars: KEEP.map(() => [[DS, 6]]) },
  E: { keep: KEEP, name: `짝걸음 뒤 ${ES} · 6 s`, vars: KEEP.map(() => [[-ES, 6]]) },
  F: { keep: KEEP, name: `짝걸음 앞 ${DS} ↔ 뒤 ${ES} 1.2 s 씩 6 s`, vars: KEEP.map(() => alt(DS, -ES, 1.2, 6)) },
};

function run(scn, vi, every) {
  setItalianRhythm('0');
  const S = SCRIPTS[scn];
  const G = newRound({ walls: !S.park, seed: 7, weapon: id, weapon2: 'longsword' });
  const P = G.player;
  const E = G.enemy;
  const keep = S.keep?.[vi];
  if (S.park) G.park();
  else G.ai.update = () => E.move.set(0, clamp(2 * (P.foeDistance() - keep), -1, 1)); // 상대는 가슴 거리 keep 을 지킨다 (다가오거나 물러남만)
  const g = P.gait;
  const st = { falls: 0, levT: 0, levMax: 0, catches: 0, early: 0, walkTD: 0, gapMax: 0, sounds: 0, soundsFast: 0 };
  let prevSt = P.state;
  const feet = { footF: { up: false, t: -9 }, footB: { up: false, t: -9 } };
  let t = 0;
  let on = false;
  const step = (my) => {
    P.move.set(0, my);
    G.step();
    t += DT;
    if (!on) return;
    rec.t = t;
    const v = P.bodies.pelvis.linvel();
    rec.v.push([t, Math.hypot(v.x, v.z)]);
    if (prevSt === 'stand' && P.state === 'down') st.falls++;
    prevSt = P.state;
    if (g?.active) {
      if (g.levC > 0.3) st.levT += DT;
      st.levMax = Math.max(st.levMax, g.levC);
    }
    for (const k of ['footF', 'footB']) {
      const y = P.bodies[k].translation().y;
      const ft = feet[k];
      if (y > 0.09) ft.up = true;
      else if (ft.up && y < 0.06) {
        ft.up = false;
        if (t - ft.t > 0.12) {
          st.sounds++;
          if (g.legs[k === 'footF' ? 'F' : 'B'].fastStep) st.soundsFast++;
        }
        ft.t = t;
      }
    }
  };
  while (t < 2.3) step(0); // 시작 정지 (ARENA.startHold)
  if (!S.park) {
    const t1 = t;
    while (P.foeDistance() > keep + 0.3 && t - t1 < 10) step(0.5);
  }
  for (let i = 0; i < 1.2 / DT; i++) step(0); // 쉼 — 셈이 처음부터 (idle 넘게)
  setItalianRhythm(every);
  rec = { who: P, t, begins: [], tds: [], v: [] };
  on = true;
  const t0 = t;
  for (const [my, dur] of S.vars[vi]) for (let i = 0, n = Math.round(dur / DT); i < n; i++) step(my);
  const r = rec;
  rec = null;
  Object.assign(RH, RH0);
  const footfall = (b) => Math.abs(b.my) > Math.abs(b.mx) && (b.kind === 'walk' || (b.kind === 'catch' && b.walking));
  const counted = r.begins.filter((b) => (isFoot(every) ? footfall(b) : Math.abs(b.my) > Math.abs(b.mx) && (b.pairOn ? b.kind === 'walk' && b.pairStep === 'lead' : b.kind === 'walk' || (b.kind === 'catch' && b.walking))));
  // 디딤 기준(모든 셈 같은 잣대): 앞뒤 디딤 · 빠른 디딤 · 빠른 몫(이어진 빠른 디딤 묶음) · 몫 빠르기 ÷ 바로 앞 보통 디딤 둘
  const ff = r.begins.filter(footfall);
  const foot = { n: Math.max(0, ff.length - 1), fast: 0, seg: 0, gain: [] };
  for (let i = 0; i + 1 < ff.length; i++) {
    if (ff[i].fastK > 1) foot.fast++;
    if (ff[i].fastK > 1 && !(i > 0 && ff[i - 1].fastK > 1)) {
      foot.seg++;
      let j = i;
      while (j + 1 < ff.length && ff[j].fastK > 1) j++; // ff[j] = 몫 뒤 첫 보통 디딤
      const sp = (a, b) => Math.hypot(ff[b].x - ff[a].x, ff[b].z - ff[a].z) / (ff[b].t - ff[a].t);
      if (i >= 2 && ff[i - 2].fastK <= 1 && ff[i - 1].fastK <= 1 && ff[j].fastK <= 1) foot.gain.push(sp(i, j) / sp(i - 2, i));
    }
  }
  foot.T = r.begins.length ? (r.v.length ? r.v[r.v.length - 1][0] - t0 : 0) : 0;
  const rows = [];
  for (let i = 0; i + 1 < counted.length; i++) {
    const a = counted[i];
    const b = counted[i + 1];
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    const dur = b.t - a.t;
    const vm = r.v.filter(([tt]) => tt > a.t && tt <= b.t).reduce((m, [, v]) => Math.max(m, v), 0);
    rows.push({ i: i + 1, t: a.t - t0, dur, dist, v: dist / dur, vm, fast: a.fastK > 1, dir: a.my > 0 ? '앞' : '뒤', pair: a.pairOn, kind: a.kind });
  }
  for (const d of r.tds) {
    if (d.kind === 'catch') st.catches++;
    if (d.kind === 'walk') {
      st.walkTD++;
      if (d.early) st.early++;
      const nb = r.begins.find((b) => b.t > d.t);
      if (nb && nb.walking) st.gapMax = Math.max(st.gapMax, nb.t - d.t);
    }
  }
  return { rows, st, n: counted.length, foot };
}

const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '-');
const f3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : '-');
const mean = (a, k) => (a.length ? a.reduce((s, r) => s + r[k], 0) / a.length : NaN);
console.log(`빠른 걸음 계기 · ${id} 플레이어 · 기본 mul ${RH.mul}(갈래마다 칸 이름에) · idle ${RH.idle} s — 걸음 칸은 첫 갈래, 안정 칸은 갈래 셋 합`);
console.log('| 대본 | 주기 | 센 걸음 | 보통: 시간 s · 빠르기 m/s · 최고 | 빠른: 시간 s · 빠르기 m/s · 최고 | 빠름 ÷ 보통 (빠르기 · 시간 · 거리) | 빠름 ÷ 이웃 (빠르기 · 시간 · 거리 · 최고) | 빠른 걸음 차례 | 넘어짐 · 붙잡기 반사 s (최고 levC) · catch · 일찍 디딤 | 걷는 틈 최대 s | 발소리 (빠른 발) | 디딤 기준: 앞뒤 디딤 · 빠른 디딤 몫 · 빠른 몫 수 (분당) · 몫 빠르기 ÷ 앞 보통 둘 (갈래 셋 합 · 몫 빠르기는 첫 갈래) |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
const detail = [];
for (const scn of SCN) {
  const S = SCRIPTS[scn];
  for (const every of EVERY) {
    const runs = S.vars.map((_, vi) => run(scn, vi, every));
    const { rows, n } = runs[0];
    const sum = (k) => runs.reduce((s, x) => s + x.st[k], 0);
    const nrm = rows.filter((r) => !r.fast);
    const fst = rows.filter((r) => r.fast);
    const order = fst.map((r) => r.i).join('·') || '-';
    // 이웃 = 그 빠른 걸음 바로 앞·뒤 보통 걸음 평균 (출발 가속 걸음이 '보통' 평균을 끌어내리는 몫을 뺀 견줌)
    const nb = fst.map((r) => {
      const a = rows.find((x) => x.i === r.i - 1 && !x.fast);
      const b = rows.find((x) => x.i === r.i + 1 && !x.fast);
      const both = [a, b].filter(Boolean);
      const avg = (k) => both.reduce((sum, x) => sum + x[k], 0) / both.length;
      return both.length ? { v: r.v / avg('v'), dur: r.dur / avg('dur'), dist: r.dist / avg('dist'), vm: r.vm / avg('vm') } : null;
    }).filter(Boolean);
    const gap = Math.max(...runs.map((x) => x.st.gapMax));
    const lev = Math.max(...runs.map((x) => x.st.levMax));
    const F = runs.reduce((a, x) => ({ n: a.n + x.foot.n, fast: a.fast + x.foot.fast, seg: a.seg + x.foot.seg, T: a.T + x.foot.T }), { n: 0, fast: 0, seg: 0, T: 0 });
    const g0 = runs[0].foot.gain;
    const footCol = `${F.n} · ${F.n ? Math.round((100 * F.fast) / F.n) : 0} % · ${F.seg} (${F.T ? ((F.seg * 60) / F.T).toFixed(1) : '-'}) · ${g0.length ? (g0.reduce((a, b) => a + b, 0) / g0.length).toFixed(2) : '-'}`;
    console.log(`| ${scn} ${S.name} | ${label(every)} | ${n} | ${f2(mean(nrm, 'dur'))} · ${f2(mean(nrm, 'v'))} · ${f2(mean(nrm, 'vm'))} | ${f2(mean(fst, 'dur'))} · ${f2(mean(fst, 'v'))} · ${f2(mean(fst, 'vm'))} | ${f2(mean(fst, 'v') / mean(nrm, 'v'))} · ${f2(mean(fst, 'dur') / mean(nrm, 'dur'))} · ${f2(mean(fst, 'dist') / mean(nrm, 'dist'))} | ${f2(mean(nb, 'v'))} · ${f2(mean(nb, 'dur'))} · ${f2(mean(nb, 'dist'))} · ${f2(mean(nb, 'vm'))} | ${order} | ${sum('falls')} · ${f2(sum('levT'))} (${f2(lev)}) · ${sum('catches')} · ${sum('early')}/${sum('walkTD')} | ${f2(gap)} | ${sum('sounds')} (${sum('soundsFast')}) | ${footCol} |`);
    if (ROWS) {
      detail.push(`\n#### ${scn} ${S.name} · ${label(every)}\n\n| 걸음 | 시각 s | 쪽 | 디딤 | 시간 s | 거리 m | 빠르기 m/s | 최고 m/s | 빠른 걸음 |\n|---|---|---|---|---|---|---|---|---|`);
      for (const r of rows) detail.push(`| ${r.i} | ${f2(r.t)} | ${r.dir} | ${r.pair ? '짝' : r.kind} | ${f3(r.dur)} | ${f3(r.dist)} | ${f2(r.v)} | ${f2(r.vm)} | ${r.fast ? '**빠름**' : ''} |`);
    }
  }
}
if (detail.length) console.log(detail.join('\n'));

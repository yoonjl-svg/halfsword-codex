// 기력 지켜보기 (10/15 기력 들여옴 — docs/strike/stamina_import_2026-10-15.md): 다른 시뮬 도구를 그대로 돌리면서 몸마다 기력 장부를 읽어 끝에 요약을 찍는다.
//  읽기만 한다(난수·물리·장부 값에 손대지 않음) — 감싼 도구의 출력은 감싸지 않은 것과 바이트 같고, 요약은 그 뒤에 '기력 지켜보기' 줄로 붙는다.
//  쓰기: node tools/sim/stamina_watch.mjs fights12.mjs
//        node tools/sim/stamina_watch.mjs motion_lab.mjs duel rapier 24 main      (48 판 대결은 늘 main 인자)
//        node tools/sim/with_config.mjs STAMINA.on=false stamina_watch.mjs fights12.mjs   (끔 — 장부가 늘 100 이라 요약은 0)
//  몸 하나 = 판 하나의 검객 하나(Fighter 가 만들어지는 차례 — 판마다 둘). 요약: 0 아래로 내려간 몸 · −30 아래 · 탈진한 몸과 횟수 · 가장 낮은 값 ·
//   0 아래·−30 아래·탈진으로 보낸 시간 몫 · AI 숨 고르기(staminaRest) 시간 몫 · 비용 갈래별 합 · 낸 공격·막아 받기·비기·박차기 수.
//  STAMINA_WATCH_ROWS=1 이면 몸마다 한 줄(JSON)도 찍는다
import { Stamina } from '../../src/stamina.js';
import { simPath } from './is_main.mjs';

const bodies = [];
const step0 = Stamina.prototype.step;
Stamina.prototype.step = function (dt) {
  let w = this._watch;
  if (!w) {
    const f = this.fighter;
    w = this._watch = { i: bodies.length, weapon: f.weapon?.id ?? null, tradition: f.swordArt?.tradition ?? null, t: 0, min: Infinity, below0: 0, severe: 0, exhaustT: 0, restT: 0, firstZero: null, firstSevere: null, firstExhaust: null };
    bodies.push(this);
  }
  step0.call(this, dt);
  if (!(dt > 0)) return;
  w.t += dt;
  if (this.value < w.min) w.min = this.value;
  if (this.value < 0) w.below0 += dt;
  if (this.level === 2) w.severe += dt;
  if (this.exhausted) w.exhaustT += dt;
  if (this.controller?.staminaRest) w.restT += dt;
  if (w.firstZero == null && this.value <= 0) w.firstZero = +w.t.toFixed(3);
  if (w.firstSevere == null && this.level >= 2) w.firstSevere = +w.t.toFixed(3);
  if (w.firstExhaust == null && this.exhausted) w.firstExhaust = +w.t.toFixed(3);
};

function summary() {
  const n = bodies.length;
  const sum = (k) => bodies.reduce((a, s) => a + (s._watch[k] ?? 0), 0);
  const T = sum('t') || 1;
  const spent = {};
  const counts = {};
  for (const s of bodies) {
    for (const [k, v] of Object.entries(s.spent)) spent[k] = (spent[k] ?? 0) + v;
    for (const [k, v] of Object.entries(s.counts)) counts[k] = (counts[k] ?? 0) + v;
  }
  const exhausted = bodies.filter((s) => s.counts.exhaustion > 0);
  const mins = bodies.map((s) => s._watch.min).filter(Number.isFinite).sort((a, b) => a - b);
  const pct = (x) => `${((100 * x) / T).toFixed(2)} %`;
  const r1 = (x) => Math.round(x * 10) / 10;
  console.log(
    `기력 지켜보기: 몸 ${n} · 0 아래 간 몸 ${bodies.filter((s) => s._watch.min < 0).length} · −30 아래 ${bodies.filter((s) => s._watch.firstSevere != null).length} · ` +
      `탈진 몸 ${exhausted.length} (횟수 ${counts.exhaustion ?? 0}) · 가장 낮은 값 중앙 ${mins.length ? r1(mins[Math.floor(mins.length / 2)]) : '-'} · 가장 낮음 ${mins.length ? r1(mins[0]) : '-'} · ` +
      `시간 몫 0 아래 ${pct(sum('below0'))} · −30 아래 ${pct(sum('severe'))} · 탈진 ${pct(sum('exhaustT'))} · AI 숨 고르기 ${pct(sum('restT'))}`,
  );
  console.log(`기력 지켜보기 비용 합: ${Object.entries(spent).map(([k, v]) => `${k} ${r1(v)}`).join(' · ')} · 수: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  if (process.env.STAMINA_WATCH_ROWS === '1') {
    for (const s of bodies) {
      const w = s._watch;
      console.log(JSON.stringify({ i: w.i, weapon: w.weapon, tradition: w.tradition, t: +w.t.toFixed(2), min: r1(w.min), firstZero: w.firstZero, firstSevere: w.firstSevere, firstExhaust: w.firstExhaust, exhaustions: s.counts.exhaustion, below0: +w.below0.toFixed(2), restT: +w.restT.toFixed(2), counts: s.counts, spent: Object.fromEntries(Object.entries(s.spent).map(([k, v]) => [k, r1(v)])) }));
    }
  }
}
process.on('exit', summary);

const [script, ...rest] = process.argv.slice(2);
if (!script) throw new Error('감쌀 도구 이름을 주세요 (예: fights12.mjs)');
process.argv = [process.argv[0], simPath(script), ...rest]; // 절대 경로 (감싼 도구의 직접 실행 확인이 맞게 — with_config.mjs 와 같은 꼴)
await import(new URL('./' + script, import.meta.url));

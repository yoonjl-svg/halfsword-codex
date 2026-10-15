// 빠른 걸음 AI 판 (10/15 — 이탈리아 박자 걸음, docs/strike/italian_rhythm_2026-10-15.md): 시험 무기 AI(X) 대 상대 무기 AI, 씨앗마다 한 판(벽, 40 s — 48 판 아님).
//  X 의 빠른 걸음(gait.fastK > 1 로 뗀 걸음 — 짝걸음은 이끄는 발만 셈) 수 · 그 걸음 동안 X 가 시작한 공격(ai.js startAttack, 이어 치기 포함) 수 ·
//  X 의 넘어짐(stand → down)·붙잡기 반사 시간(gait.levC > 0.3 — 그중 빠른 걸음 동안과 그 뒤 0.5 s 몫, 다리 다침(legHealth < 1) 뒤 몫)·catch 디딤·
//  일찍 디딤(walk 걸음이 정한 시간 85 % 전에 디딤) · 공격 수 · 끝난 판(죽음 — 판마다 싸움이 갈라지므로 씨앗별 값보다 합을 본다)
//  X 가 독일 유파면 간격 잡기 빠른 디딤(10/15 — docs/strike/german_chase_2026-10-15.md · 그때 이름 '따라 들어가기' · AI 끼리라 잡기는 없음)도: 상대 헛침 알림 받음(gait.foeWhiff) · 발동(빠른 걸음을 하나라도 뗀 받을 창) · 그 가운데 발동 뒤 1 s 안에
//  X 가 공격을 시작한 수 — 끄고 견주려면 node tools/sim/with_config.mjs GAIT.deChase=0 fast_step_duel.mjs …
//  재기만 — 물리·난수·AI 는 게임 그대로(begin·touchdown·startAttack·foeWhiff 를 감싸 읽기만), 판 하나는 결정적. 주기는 TRADITIONS.italian.gait.rhythm.every 를 바꿔 견줌
//  10/15 디딤 셈(docs/strike/italian_rhythm_2026-10-15.md §8): 주기 칸은 setItalianRhythm 글 — '0' 끔 · 'N' 옛 짝 셈 N + 1 · 'N+M' 디딤 셈 N + M ·
//   덧붙인 칸 '디딤': X 의 앞뒤 디딤(walk·catch 걸음 — 스틱 앞뒤 몫이 옆 몫 이상) 수 · 그중 빠른 디딤 몫 · 빠른 몫(이어진 빠른 디딤 묶음 = 발동) 수와 분당
//  10/15 15:1x 기본 2 + 2 · ×1.3(§9) — 칸 이름에 그 갈래 배율(지난 판 비교 4+2 · 3+2 · 옛 짝 셈 N 은 ×1.5 — setItalianRhythm)
//  실행: node tools/sim/fast_step_duel.mjs [X 무기 rapier] [상대 무기 longsword] [씨앗 수 3] [초 40] [주기들 0,2+2,4+2]
import { newRound, DT } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { Gait } from '../../src/gait.js';
import { SCHOOLS, TRADITIONS, traditionOf, setItalianRhythm } from '../../src/schools.js';
import { getWeapon } from '../../src/weapons.js';

const [xw = 'rapier', yw = 'longsword', nSeed = '3', secs = '40', everyArg = '0,2+2,4+2'] = process.argv.slice(2);
const EVERY = everyArg.split(',');
const RH = TRADITIONS.italian.gait.rhythm;
const RH0 = { ...RH };
let foot = { n: 0, fast: 0, seg: 0, last: false }; // 앞뒤 디딤 · 빠른 디딤 · 빠른 몫(발동)
let X = null;
let fastSteps = 0;
let fastAtk = 0;
let atk = 0;
let early = 0;
let earlyF = 0;
let walkTD = 0;
let catches = 0;
let whiffs = 0; // 상대 헛침 알림 받은 수 (받을 창이 열린 수)
let chaseOn = []; // 발동한 받을 창마다 첫 빠른 걸음 시각
let atkT = []; // X 공격 시작 시각
let curT = 0;
let lastChase = null;
const B0 = Gait.prototype.begin;
Gait.prototype.begin = function (l, kind, T) {
  B0.call(this, l, kind, T);
  if (this.f === X && (kind === 'walk' || (kind === 'catch' && this.walking)) && Math.abs(this.f.move.y) >= Math.abs(this.f.move.x)) {
    foot.n++;
    if (this.fastK > 1) foot.fast++;
    if (this.fastK > 1 && !foot.last) foot.seg++;
    foot.last = this.fastK > 1;
  }
  if (this.f === X && this.fastK > 1 && (kind === 'walk' || kind === 'catch') && !(this.pairOn && this.pairStep === 'trail')) {
    fastSteps++;
    if (this.chaseOf && this.chaseOf !== lastChase) {
      lastChase = this.chaseOf;
      chaseOn.push(curT);
    }
  }
};
const FW0 = Gait.prototype.foeWhiff;
Gait.prototype.foeWhiff = function () {
  FW0.call(this);
  if (this.f === X && this.chase) {
    whiffs++;
    this.chaseOf = this.chase; // 이 받을 창 (발동을 셀 때 같은 창인지 가림)
  }
};
const TD0 = Gait.prototype.touchdown;
Gait.prototype.touchdown = function (l, speed) {
  if (this.f === X) {
    if (l.kind === 'walk') {
      walkTD++;
      if (l.t < 0.85 * l.T) {
        early++;
        if (l.fastStep) earlyF++;
      }
    }
    if (l.kind === 'catch') catches++;
  }
  TD0.call(this, l, speed);
};
const SA = AI.prototype.startAttack;
AI.prototype.startAttack = function (tech, why, opt) {
  const ok = SA.call(this, tech, why, opt);
  if (ok && this.me === X) {
    atk++;
    atkT.push(curT);
    if (X.gait?.fastK > 1) fastAtk++;
  }
  return ok;
};

const school = (w) => (SCHOOLS[w] ? w : 'longsword');
console.log(`빠른 걸음 AI 판 · ${xw} AI 대 ${yw} AI · 씨앗 ${nSeed} × ${secs} s · 기본 mul ${RH.mul}(갈래마다 칸 이름에) · idle ${RH.idle} s`);
console.log('| 주기 | 씨앗 | 빠른 걸음 (분당) | 그 걸음 중 공격 / 공격 | 넘어짐 | 붙잡기 반사 s (빠른 걸음 +0.5 s 안 · 다리 다친 뒤) | catch 디딤 | 일찍 디딤 (빠른 걸음 발) | 간격 잡기: 헛침 알림 · 발동 (분당) · 발동 뒤 1 s 안 공격 | 끝 (X/상대) | 디딤: 앞뒤 · 빠른 몫 · 발동(분당) |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
const ITX = traditionOf(getWeapon(xw)) === 'italian'; // 주기 칸은 이탈리아 무기만 뜻이 있다 (아니면 '-')
for (const every of EVERY) {
  setItalianRhythm(every);
  const lab = ITX ? (/[+ ]/.test(every) ? `${every.replace(/\s*[+ ]\s*/, ' + ')} (디딤 ×${RH.mul})` : +every ? `${every} + 1 (짝 ×${RH.mul})` : '끔') : '-';
  const tot = { fast: 0, fastAtk: 0, atk: 0, falls: 0, lev: 0, levF: 0, levH: 0, catches: 0, early: 0, walkTD: 0, T: 0, whiffs: 0, chase: 0, chaseAtk: 0, fn: 0, ff: 0, fs: 0 };
  for (let s = 1; s <= +nSeed; s++) {
    const seed = 1000 + s;
    const G = newRound({ walls: true, seed, weapon: xw, weapon2: yw, difficulty: 'normal', persona: { school: school(yw) }, AI2Class: AI, difficulty2: 'normal', persona2: { school: school(xw) } });
    X = G.player;
    foot = { n: 0, fast: 0, seg: 0, last: false };
    fastSteps = fastAtk = atk = early = earlyF = walkTD = catches = whiffs = 0;
    chaseOn = [];
    atkT = [];
    lastChase = null;
    let falls = 0;
    let lev = 0;
    let levF = 0;
    let levH = 0;
    let fastT = -9;
    let hurtLeg = false;
    let prev = X.state;
    let T = 0;
    for (let i = 0; i < +secs / DT; i++) {
      curT = T;
      G.step();
      T += DT;
      if (prev === 'stand' && X.state === 'down') falls++;
      prev = X.state;
      if (X.gait?.fastK > 1) fastT = T;
      if (X.legHealth < 1) hurtLeg = true;
      if (X.state === 'stand' && X.gait?.active && X.gait.levC > 0.3) {
        lev += DT;
        if (T - fastT <= 0.5) levF += DT;
        if (hurtLeg) levH += DT;
      }
      if (X.state === 'dead' || G.enemy.state === 'dead') break;
    }
    const chaseAtk = chaseOn.filter((c) => atkT.some((a) => a > c && a <= c + 1)).length;
    console.log(`| ${lab} | ${seed} | ${fastSteps} (${((fastSteps * 60) / T).toFixed(1)}) | ${fastAtk} / ${atk} | ${falls} | ${lev.toFixed(2)} (${levF.toFixed(2)} · ${levH.toFixed(2)}) | ${catches} | ${early}/${walkTD} (${earlyF}) | ${whiffs} · ${chaseOn.length} (${((chaseOn.length * 60) / T).toFixed(1)}) · ${chaseAtk} | ${X.state}/${G.enemy.state} @${T.toFixed(1)} s | ${foot.n} · ${foot.n ? Math.round((100 * foot.fast) / foot.n) : 0} % · ${foot.seg} (${((foot.seg * 60) / T).toFixed(1)}) |`);
    tot.fn += foot.n;
    tot.ff += foot.fast;
    tot.fs += foot.seg;
    Object.assign(tot, { fast: tot.fast + fastSteps, fastAtk: tot.fastAtk + fastAtk, atk: tot.atk + atk, falls: tot.falls + falls, lev: tot.lev + lev, levF: tot.levF + levF, levH: tot.levH + levH, catches: tot.catches + catches, early: tot.early + early, earlyF: (tot.earlyF ?? 0) + earlyF, walkTD: tot.walkTD + walkTD, T: tot.T + T, whiffs: tot.whiffs + whiffs, chase: tot.chase + chaseOn.length, chaseAtk: tot.chaseAtk + chaseAtk });
  }
  console.log(`| **${lab} 합** | | ${tot.fast} (${((tot.fast * 60) / tot.T).toFixed(1)}) | ${tot.fastAtk} / ${tot.atk} | ${tot.falls} | ${tot.lev.toFixed(2)} (${tot.levF.toFixed(2)} · ${tot.levH.toFixed(2)}) | ${tot.catches} | ${tot.early}/${tot.walkTD} (${tot.earlyF ?? 0}) | ${tot.whiffs} · ${tot.chase} (${((tot.chase * 60) / tot.T).toFixed(1)}) · ${tot.chaseAtk} | ${tot.T.toFixed(1)} s | ${tot.fn} · ${tot.fn ? Math.round((100 * tot.ff) / tot.fn) : 0} % · ${tot.fs} (${((tot.fs * 60) / tot.T).toFixed(1)}) |`);
}
Object.assign(RH, RH0);

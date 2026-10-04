// 방어구(투구·판금) 검증 (헤드리스, 결정적). config.js ARMOR 를 끈 판과 켠 판을 같은 시드로 돌려 견준다.
//  오너 결정: 투구·판금은 실제로 막고, 막을 때마다 닳고, 완전히 부서지면 사라진다 — 단 "재미 요소이니 너무 과한
//  어드밴티지는 아니도록". 그래서 재는 것:
//   1) dummy: 가만히 겨누고 선 더미가 대상 캐릭터(하인리히·마르그레테)의 겉모습(투구·판금)을 입고, 나머지 캐릭터가
//      저마다의 무기·성격으로 벤다 → 처치 시간(TTK, 60초 안에 못 죽이면 60초로 셈)을 ARMOR 끔/켬으로 견준다
//   2) duel: 대상 캐릭터 대 나머지 캐릭터, AI 대 AI (양쪽 자리) → 대칭 승률을 끔/켬으로 견주고, 켰을 때 방어구가
//      한 번이라도 부서진 판 비율
//   둘 다(켰을 때): 방어구 조각(투구, 판금 부위)마다 부서질 때까지 맞은 수 — 전체 / 제대로 된 타격(fighter.js solidHitJ 이상으로 닿은 것,
//   config.js 에서 방어구가 크게 닳는 기준과 같다) — 와, 멀쩡한 조각에 온 첫 번째·두 번째 제대로 된 칼날 타격을 막았나(날이 들지 못해 멍이 됐나).
//   부서짐은 두 단계로 센다: 파손(곁 조각이 떨어져 나감, config.js ARMOR shed) / 완전 파손(다 부서져 사라짐).
//   참고로 "방어구에 제대로 된 타격을 한 번이라도 받은 판%"도 찍는다 — 첫 제대로 된 타격에 부서지게 해도 대략 이만큼이다
//   (가벼운 타격이 여러 번 쌓여 파손되는 판도 있어서 파손 판%가 이보다 조금 클 수는 있다)
//   probe: 싸움 없이 한 부위를 같은 타격으로 거듭 친다(combat.strike 그대로, 칼 자세·빠르기만 맞춰 준다) — 멀쩡한 조각이
//   첫 한두 번의 중간 타격(60J)을 막나, 제대로 된 타격 몇 번에 파손·완전 파손되나, 라이트세이버(ignoreArmor)는 뚫나,
//   찌르기 무기(에스톡)의 찌르기는 판 문턱을 gap 의 절반만큼 깎나, 견갑은 그려진 곳(어깨 쪽 끝)만 막나
//  보이는 부서짐(감독 결정: 관문이 아니라 보고만 한다 — 방어구가 얼마나 자주 맞느냐에 달려 있어서, 올리려면 방어구를 더 잘
//   부서지게 할 수밖에 없고 그건 "너무 과한 어드밴티지는 아니도록"과 상관없이 튜닝을 흔든다): 방어구를 입은 쪽이 진 판,
//   가만히 선 더미 판 가운데 조각이 눈에 띄게 떨어져 나간 판(파손 또는 완전 파손) 비율. 예전 기준은 50% / 60%.
//   눈에 띄는 조각만 센 값(VISIBLE_MIN: 가는 줄 — 마르그레테 가슴 이음매 0.8cm, 하인리히 가슴 금줄 1cm — 만 떨어진 판은 빼고)과
//   줄까지 센 값을 같이 찍는다
// 실행: node tools/sim/armor_eval.mjs [dummy|duel|both|probe] [seeds] [대상 id...]   (기본: both 6 heinrich margarethe)
//  hybrid.mjs 로 감싸면 다리로 체중 받치기에서 잰다: node tools/sim/hybrid.mjs armor_eval.mjs both 6
//  DUEL_S=90 이면 대결을 90초까지 (게임은 판 시간 제한이 없어 한쪽이 쓰러질 때까지 싸운다 — "한 판에 부서지는 것을 보나"를 잴 때)
//  SEED0=101 이면 시드 101~ (튜닝에 쓴 시드와 다른 시드로 확인할 때)
import { newRound, DT, AI, THREE } from './harness_m.mjs';
import * as CONFIG from '../../src/config.js';
import { STRIKE, ARMOR } from '../../src/config.js';
import { Fighter, solidHitJ } from '../../src/fighter.js';
import { CHARACTERS, CHARACTERS_BY_ID } from '../../src/characters.js';
import { BREAK } from '../../src/weapons.js';
import { DEBRIS, tickDebris, clearDebris, debrisCount } from '../../src/debris.js';

const [mode = 'both', seedsArg = '6', ...targetArgs] = process.argv.slice(2);
const SEEDS = +seedsArg;
const TARGETS = targetArgs.length ? targetArgs : ['heinrich', 'margarethe'];
const SOLID = ARMOR.solidJ; // 제대로 된 타격: 판정 에너지(J)가 solidHitJ(구역) 이상으로 닿은 것 (방어구가 크게 닳는 기준과 같다. 가슴 45J, 팔 22J …)
const GUARDS_READY = [0.12, -0.18];
const DUMMY_S = 60;
const DUEL_S = +(process.env.DUEL_S ?? 45); // 기본은 characters_eval.mjs 와 같은 판 길이
const SEED0 = +(process.env.SEED0 ?? 1);

// 눈에 띄는 조각: 떨어져 나간 조각(흩어지는 debris) 자기 좌표 상자의 두 번째로 긴 변이 이만큼(m) 이상.
//  가는 줄(마르그레테 가슴 이음매 0.8cm, 하인리히 가슴 금줄 1cm)은 날아가도 대결 거리에서 선 하나라 세지 않는다.
//  금띠 고리(지름 15cm)·손목 보호대·뿔·볏·자락 끝단 고리와 완전 파손 때 흩어지는 판은 센다
const VISIBLE_MIN = 0.03;
const _bb = new THREE.Box3();
const _bm = new THREE.Matrix4();
/** 조각(메쉬, 또는 메쉬를 담은 투구 조각 그룹)이 눈에 띄는 크기인가 */
function pieceVisible(obj) {
  return pieceDims(obj)[1] >= VISIBLE_MIN;
}
/** 조각 자기 좌표 상자의 세 변(m, 긴 것부터) */
function pieceDims(obj) {
  _bb.makeEmpty();
  obj.traverse((m) => {
    if (!m.isMesh || !m.geometry || (m !== obj && !m.visible)) return;
    _bm.identity();
    for (let o = m; o && o !== obj; o = o.parent) {
      o.updateMatrix();
      _bm.premultiply(o.matrix);
    }
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    _bb.union(m.geometry.boundingBox.clone().applyMatrix4(_bm));
  });
  if (_bb.isEmpty()) return [0, 0, 0];
  const s = _bb.getSize(new THREE.Vector3());
  return [s.x * obj.scale.x, s.y * obj.scale.y, s.z * obj.scale.z].sort((a, b) => b - a);
}
/** 대상 겉모습에서 곁 조각으로 떨어질 수 있지만 눈에 띄는 조각으로 세지 않는 가는 줄 (보고에 무엇을 뺐는지 적는다) */
function thinPieces(target) {
  const G = newRound({ seed: 1, look: target.look, weapon: target.weapon });
  const V = G.player;
  const out = [];
  for (const part in V.plateBoxes) for (const b of V.plateBoxes[part].list) {
    const d = pieceDims(b.mesh);
    if (d[1] < VISIBLE_MIN) out.push(`${part} ${d.map((x) => (100 * x).toFixed(1)).join('×')}cm`);
  }
  return out;
}
// 싸움꾼마다 눈에 띄는 조각이 떨어져 나간 수 (fighter.js flingDebris 를 감싸서 센다 — 게임 코드는 그대로)
const _fling = Fighter.prototype.flingDebris;
Fighter.prototype.flingDebris = function (obj, dir, energy) {
  if (pieceVisible(obj)) this._visShed = (this._visShed ?? 0) + 1;
  return _fling.call(this, obj, dir, energy);
};

const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-');
const pct = (x) => (Number.isFinite(x) ? (100 * x).toFixed(0) + '%' : '-');
const slow = (off, q, sp) => {
  const dx = q[0] - off.x, dy = q[1] - off.y, dd = Math.hypot(dx, dy), s = sp * DT;
  if (dd > s) { off.x += (dx / dd) * s; off.y += (dy / dd) * s; } else off.set(q[0], q[1]);
};

/** 방어구를 입은 싸움꾼 V 의 조각별 기록: 맞은 수·제대로 된 타격 수·막았나, 부서진 순간 */
function watchArmor(G, V) {
  // 조각 이름 → { hits, solid, firstSolid: [막았나...], brokeAt, shedAt(파손 = 곁 조각이 처음 떨어진 때, 가는 줄 포함),
  //  visAt(눈에 띄는 조각이 처음 떨어진 때 — 보이는 부서짐은 이것으로 센다) }
  const piece = () => ({ hits: 0, solid: 0, firstSolid: [], brokeAt: null, shedAt: null, visAt: null });
  const pieces = {};
  if (V.helmetType) pieces.helmet = piece();
  for (const p in V.plate) pieces[p] = piece();
  let shedSeen = V.armorShed ?? 0;
  let visSeen = V._visShed ?? 0;
  const prev = G.onWound;
  G.onWound = (att, vic, r) => {
    prev?.(att, vic, r);
    if (vic !== V || !(r.helmet || r.plate)) return;
    // strike() 가 applyWound 를 부르는 조건과 같게 (방어구는 applyWound 에서 닳는다)
    if (!(r.type !== 'blunt' || r.severity > 0 || r.energy > 10)) return;
    const name = r.helmet ? 'helmet' : lastPart;
    const P = pieces[name];
    if (!P || P.brokeAt != null) return;
    P.hits++;
    const blade = r.thr != null; // 칼날·칼끝으로 닿았다 (날이 들었든 못 들었든)
    if (r.energy >= solidHitJ(r.helmet ? 'head' : r.zone)) {
      P.solid++;
      // Finishing-rule death can retain stab with zero severity below thr.
      // This records failure to wound, independently of rule death or pass.
      if (P.firstSolid.length < 2) P.firstSolid.push(blade ? r.eff <= r.thr : null); // 둔기(나뭇가지)는 막음을 따지지 않는다
    }
    const broken = r.helmet ? !V.hasHelmet : !(V.plate[name] > 0);
    if (broken) P.brokeAt = G.t;
    if ((V.armorShed ?? 0) > shedSeen || broken) P.shedAt ??= G.t;
    if ((V._visShed ?? 0) > visSeen) P.visAt ??= G.t;
    shedSeen = V.armorShed ?? 0;
    visSeen = V._visShed ?? 0;
  };
  // onWound 에는 부위 이름이 없어서 combat 훅에서 먼저 받아 둔다
  let lastPart = null;
  const hook = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, point, pr) => {
    lastPart = pr?.v.part ?? null;
    hook(att, vic, r, point, pr);
  };
  return pieces;
}

/** 대상 캐릭터 겉모습을 입은 더미를 공격자 캐릭터가 벤다 */
function runDummy(target, attacker, seed) {
  const G = newRound({ seed, difficulty: attacker.ai.level, persona: attacker.ai.persona, weapon2: attacker.weapon, look2: attacker.look, look: target.look, weapon: target.weapon });
  const { player: dummy, enemy: A } = G;
  G.before = () => { dummy.move.set(0, 0); slow(dummy.handOffset, GUARDS_READY, 1.0); };
  const pieces = watchArmor(G, dummy);
  let tDead = null;
  for (let i = 0; i < DUMMY_S / DT; i++) {
    G.step();
    if (!dummy.alive || !A.alive) { tDead = dummy.alive ? null : G.t; break; }
  }
  // 더미가 입은 상처 (맨몸 부위까지): 방어구에 한 번도 닿지 않고 맨머리·목 한 방에 죽은 판을 따로 센다 (보이는 부서짐 참고)
  const wounds = G.wounds.filter((w) => w.vic === dummy);
  const oneShotBare = tDead != null && wounds.length === 1 && (wounds[0].zone === 'head' || wounds[0].zone === 'neck') && !Object.values(pieces).some((P) => P.hits > 0);
  return { ttk: tDead ?? DUMMY_S, killed: tDead != null, pieces, oneShotBare };
}

/** 대상 캐릭터 대 상대 캐릭터. targetSeat = 'A'(enemy 자리) | 'B'(player 자리) */
function runDuel(target, other, seed, targetSeat) {
  const chA = targetSeat === 'A' ? target : other;
  const chB = targetSeat === 'A' ? other : target;
  const G = newRound({ seed, difficulty: chA.ai.level, persona: chA.ai.persona, weapon2: chA.weapon, look2: chA.look, AI2Class: AI, difficulty2: chB.ai.level, persona2: chB.ai.persona, weapon: chB.weapon, look: chB.look });
  const T = targetSeat === 'A' ? G.enemy : G.player;
  const O = targetSeat === 'A' ? G.player : G.enemy;
  const pieces = watchArmor(G, T);
  let tEnd = null;
  for (let i = 0; i < DUEL_S / DT; i++) {
    G.step();
    if (!T.alive || !O.alive) { tEnd = G.t; break; }
  }
  // characters_eval.mjs 와 같은 판정: 죽은 쪽이 지고, 둘 다 살면 피를 덜 흘린 쪽이 이긴다
  let win;
  if (!T.alive && !O.alive) win = 0.5;
  else if (!T.alive) win = 0;
  else if (!O.alive) win = 1;
  else win = T.blood === O.blood ? 0.5 : T.blood > O.blood ? 1 : 0;
  return { win, tDied: T.alive ? null : tEnd, pieces };
}

/** 켬/끔 한 바퀴. 무기 파손 굴림 씨앗(Fighter._breakCount)을 되돌려 두 바퀴가 같은 굴림 순서를 쓰게 한다 */
function pass(on, fn) {
  CONFIG.ARMOR.on = on;
  Fighter._breakCount = 0;
  return fn();
}

function pieceSummary(allPieces) {
  // 조각 이름별로 모은다 (판금 부위는 따로, 투구 따로)
  const by = {};
  for (const ps of allPieces) for (const [name, P] of Object.entries(ps)) (by[name] ??= []).push(P);
  const rows = [];
  for (const [name, list] of Object.entries(by)) {
    const broke = list.filter((P) => P.brokeAt != null);
    const hist = {};
    for (const P of broke) hist[P.solid] = (hist[P.solid] ?? 0) + 1;
    const first = list.flatMap((P) => P.firstSolid.slice(0, 1)).filter((x) => x != null);
    const second = list.flatMap((P) => P.firstSolid.slice(1, 2)).filter((x) => x != null);
    rows.push({
      name,
      n: list.length,
      shedRate: list.filter((P) => P.shedAt != null).length / list.length,
      visRate: list.filter((P) => P.visAt != null).length / list.length,
      brokeRate: broke.length / list.length,
      hitsToBreak: mean(broke.map((P) => P.hits)),
      solidToBreak: mean(broke.map((P) => P.solid)),
      hist: Object.keys(hist).sort((a, b) => a - b).map((k) => `${k}:${hist[k]}`).join(' '),
      block1: first.length ? first.filter(Boolean).length / first.length : NaN,
      block2: second.length ? second.filter(Boolean).length / second.length : NaN,
      nFirst: first.length,
      nSecond: second.length,
    });
  }
  return rows;
}

function printPieces(title, allPieces) {
  console.log(title);
  console.log('조각, 판수, 파손된판%(곁 조각 떨어짐·완전 파손 포함, 가는 줄 포함), 눈에 띄는 조각이 떨어진 판%, 완전파손판%, 부서질때까지맞은수(전체), 제대로된타격수(평균), 제대로된타격수 분포(수:판), 첫타격막음%(n), 둘째타격막음%(n)');
  for (const r of pieceSummary(allPieces)) {
    console.log(`${r.name}, ${r.n}, ${pct(r.shedRate)}, ${pct(r.visRate)}, ${pct(r.brokeRate)}, ${f1(r.hitsToBreak)}, ${f1(r.solidToBreak)}, ${r.hist || '-'}, ${pct(r.block1)}(${r.nFirst}), ${pct(r.block2)}(${r.nSecond})`);
  }
  // 모든 조각을 합친 제대로 된 타격 수 분포 (부서진 조각만)
  const all = allPieces.flatMap((ps) => Object.values(ps)).filter((P) => P.brokeAt != null);
  const hist = {};
  for (const P of all) hist[P.solid] = (hist[P.solid] ?? 0) + 1;
  const keys = Object.keys(hist).sort((a, b) => a - b);
  console.log(`[전체] 부서진 조각 ${all.length}개, 부서질 때까지 제대로 된 타격 수 분포: ${keys.map((k) => `${k}번 ${hist[k]}`).join(', ')} · 3~5번 ${pct(all.filter((P) => P.solid >= 3 && P.solid <= 5).length / Math.max(1, all.length))}`);
}


// ───────── probe: 한 부위를 같은 타격으로 거듭 친다 ─────────
const _st = (b) => {
  const t = b.translation(), r = b.rotation(), c = b.worldCom(), v = b.linvel(), w = b.angvel();
  return { p: new THREE.Vector3(t.x, t.y, t.z), q: new THREE.Quaternion(r.x, r.y, r.z, r.w), com: new THREE.Vector3(c.x, c.y, c.z), v: new THREE.Vector3(v.x, v.y, v.z), w: new THREE.Vector3(w.x, w.y, w.z) };
};

/**
 * 공격자 att 의 칼로 vic 의 part 를 local(부위 몸 좌표) 점에서 친다. type 'cut' = 칼날 60% 지점, 날을 세워 겉면 안쪽으로 /
 * 'stab' = 칼끝으로 겉면 안쪽으로. 판정 에너지가 E(J)가 되게 빠르기를 맞춘다. combat.strike 를 그대로 부른다 (상처·방어구 닳기·onWound)
 */
function probeStrike(G, att, vic, part, local, nLocal, E, type) {
  const info = [...G.combat.info.values()];
  const vInfo = info.find((i) => i.fighter === vic && i.part === part);
  const wInfo = info.find((i) => i.fighter === att && i.part === 'blade');
  const P = _st(vInfo.body);
  P.v.set(0, 0, 0); P.w.set(0, 0, 0);
  const point = local.clone().applyQuaternion(P.q).add(P.p);
  const n = nLocal.clone().applyQuaternion(P.q).normalize(); // 겉면 바깥쪽 (월드)
  const sw = _st(wInfo.body);
  const comL = sw.com.clone().sub(sw.p).applyQuaternion(sw.q.clone().invert());
  const HL = att.weaponCfg.hiltLength, BL = att.weaponCfg.bladeLength;
  const up = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const tan = new THREE.Vector3().crossVectors(n, up).normalize();
  let x, y, at;
  if (type === 'stab') { y = n.clone().negate(); x = tan; at = HL + BL; }
  else { x = n.clone().negate(); y = tan; at = HL + 0.6 * BL; }
  const z = new THREE.Vector3().crossVectors(x, y);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  const S = { p: point.clone().addScaledVector(y, -at), q, v: new THREE.Vector3(), w: new THREE.Vector3() };
  S.com = S.p.clone().add(comL.clone().applyQuaternion(q));
  const pr = { w: wInfo, v: vInfo };
  S.v.copy(n).multiplyScalar(-10);
  const r0 = G.combat.analyze(pr, point, S, P, true);
  S.v.copy(n).multiplyScalar(-10 * Math.sqrt(E / r0.energy));
  const ac = att.cache, vc = vic.cache;
  att.cache = { sword: S };
  vic.cache = { parts: { [part]: P } };
  vic.hitCooldowns.clear();
  const r = G.combat.strike(pr, point, false);
  att.cache = ac;
  vic.cache = vc;
  return r;
}

/** 부위별로 칠 점과 겉면 방향 (겉모습 좌표 = outfits.js 가 그리는 좌표: 팔은 +y 가 어깨 쪽). 견갑은 어깨 쪽 끝(+y)과 팔꿈치 쪽 끝(−y)을 따로 */
const PROBE_AT = {
  helmet: ['head', [0.02, 0.08, 0.05], [0.3, 1, 0.4]],
  chest: ['chest', [0.11, 0.0, 0.05], [1, 0, 0]],
  abdomen: ['abdomen', [0.1, 0.0, 0.05], [1, 0, 0]],
  pelvis: ['pelvis', [0.1, -0.07, 0.08], [1, 0, 0]],
  uarmO: ['uarmO', [0.03, 0.09, 0.0], [1, 0, 0]], // 견갑 (어깨 쪽 끝, 그려진 곳)
  uarmO_elbow: ['uarmO', [0.045, -0.12, 0.0], [1, 0, 0]], // 같은 위팔의 팔꿈치 쪽 (마르그레테는 판이 없다)
  uarmS: ['uarmS', [0.03, 0.09, 0.0], [1, 0, 0]], // 칼 든 팔 견갑 (어깨 쪽 끝 — fighter.js DRESS_ALONG_X 로 겉모습도 어깨 쪽에 그려진다)
  uarmS_elbow: ['uarmS', [0.045, -0.12, 0.0], [1, 0, 0]], // 칼 든 팔 위팔의 팔꿈치 쪽
};

function probeSeries(target, key, attWeapon, E, type, n, broken = false) {
  const G = newRound({ seed: 1, look: target.look, weapon: target.weapon, weapon2: attWeapon });
  const vic = G.player, att = G.enemy;
  if (broken) att.breakWeapon(); // 칼날 끝쪽이 떨어져 나간 칼 (weapons.js BREAK — stubEdge 면 토막 날로 벤다)
  const [part, loc, nl] = PROBE_AT[key];
  // 칼 든 팔은 뼈가 앞으로 누워 있어 겉모습 그룹(dressTo)이 돌려져 있다 → 부위 몸 좌표로 바꾼다
  const g = vic.groups[part];
  const rot = g.children.find((c) => c.isGroup && !c.isMesh && c.quaternion.w < 0.9999)?.quaternion ?? new THREE.Quaternion();
  const local = new THREE.Vector3(...loc).applyQuaternion(rot), nLocal = new THREE.Vector3(...nl).normalize().applyQuaternion(rot);
  const plated0 = key === 'helmet' ? vic.hasHelmet : vic.platedAt(part, local);
  const out = [];
  const rs = [];
  for (let i = 0; i < n; i++) {
    const shed0 = vic.armorShed, vis0 = vic._visShed ?? 0, broke0 = key === 'helmet' ? !vic.hasHelmet : !(vic.plate[part] > 0);
    const r = probeStrike(G, att, vic, part, local, nLocal, E, type);
    rs.push(r);
    if (!r) { out.push('-'); continue; }
    const armorHit = r.helmet || r.plate;
    const integ = key === 'helmet' ? vic.helmetIntegrity : vic.plate[part] ?? 0;
    const broke = key === 'helmet' ? !vic.hasHelmet : !(vic.plate[part] > 0);
    const injured = r.type !== 'blunt' && r.severity > 0;
    const mark = (armorHit ? (injured ? `상처 sev${r.severity.toFixed(2)}` : '막음(상처 없음)') : `맨몸 sev${r.severity.toFixed(2)}`) + (r.finish ? ' [마무리 규칙]' : '') + ` thr${r.thr?.toFixed(0) ?? '-'} 내구${integ.toFixed(2)}` + (vic.armorShed > shed0 ? ' [파손]' : '') + (broke && !broke0 ? ' [완전파손]' : '') + ((vic._visShed ?? 0) > vis0 ? ` (눈에 띄는 조각 ${(vic._visShed ?? 0) - vis0})` : '');
    out.push(mark);
  }
  return { plated0, out, vic, part, rs, att };
}

function probe() {
  console.log(`방어구 탐침 — combat.strike 를 그대로 부른다 (싸움 없이, 같은 점을 같은 세기로 거듭). ARMOR.on=${CONFIG.ARMOR.on}`);
  for (const tid of TARGETS) {
    const target = CHARACTERS_BY_ID[tid];
    const keys = Object.keys(PROBE_AT).filter((k) => (k === 'helmet' ? !!target.look.helmet : true));
    console.log(`\n=== ${tid} (${target.look.outfit}) — 롱소드 베기, 같은 점 5번 ===`);
    for (const key of keys) {
      for (const E of [60, 100, 150]) {
        const { plated0, out } = probeSeries(target, key, 'longsword', E, 'cut', 5);
        console.log(`${key} ${E}J (판 밑? ${plated0 ? '예' : '아니오'}): ${out.map((m, i) => `${i + 1}) ${m}`).join(' | ')}`);
      }
    }
    console.log(`--- ${tid}: 라이트세이버(ignoreArmor) 베기 100J, 멀쩡한 조각 — 맨몸처럼 뚫려야 한다 ---`);
    for (const key of keys) {
      const { out } = probeSeries(target, key, 'lightsaber', 100, 'cut', 1);
      console.log(`${key}: ${out[0]}`);
    }
    console.log(`--- ${tid}: 찌르기 60J — 롱소드(틈 없음) 대 에스톡(thrustStyle.gap, 판 문턱 × (1 − gap/2)) ---`);
    for (const key of keys.filter((k) => !k.endsWith('_elbow'))) {
      const a = probeSeries(target, key, 'longsword', 60, 'stab', 1).out[0];
      const b = probeSeries(target, key, 'estoc', 60, 'stab', 1).out[0];
      console.log(`${key}: 롱소드 ${a} · 에스톡 ${b}`);
    }
  }
  // 견갑: 완전 파손 뒤 겉모습 — 판 메쉬가 몸에서 떨어져 조각(debris)으로 날다가 사라지고, 그 자리는 판이 없는 것으로 친다
  const mg = CHARACTERS_BY_ID.margarethe;
  if (mg && TARGETS.includes('margarethe')) {
    console.log('\n=== margarethe 견갑(uarmO) 150J 베기 3번 뒤 ===');
    // 조각은 헤드리스에선 띄우지 않는다(debris.js debrisEnabled) — 여기서만 켜고 직접 움직인다
    DEBRIS.headless = true;
    clearDebris();
    const { vic, part } = probeSeries(mg, 'uarmO', 'longsword', 150, 'cut', 3);
    const g = vic.plateGroups[part];
    const n0 = debrisCount('armor');
    console.log(`내구도 ${vic.plate[part]} · 부위에 남은 판금 메쉬 ${g.userData.armor.length}개 · 흩어지는 조각 ${n0}개 · 어깨 쪽 끝이 아직 판 밑? ${vic.platedAt(part, new THREE.Vector3(0.03, 0.09, 0))}`);
    for (let i = 0; i < 2.0 / DT; i++) tickDebris(DT);
    console.log(`2초 뒤 흩어지는 조각 ${debrisCount('armor')}개 (0 이어야 한다: 작아져 사라지고 GPU 자원도 풀었다)`);
    clearDebris();
    DEBRIS.headless = false;
  }
  probeBroken();
}

/**
 * 무기 파손과 방어구가 함께: 부러진 칼(칼날 끝쪽이 떨어져 나감, BREAK.stubEdge 면 토막 날로 베기 × stubCut·찌르기 × stubThrust)이
 *  판금·투구를 칠 때 — 같은 판정 에너지로 멀쩡한 칼과 견준다(eff = 문턱과 견주는 실효 에너지). 그리고 칼 조각과 방어구 조각이
 *  함께 떠 있다가 debris.js clearDebris 한 번(새 판·배경 바꿈 때 main.js 가 부른다)에 둘 다 치워지나
 */
function probeBroken() {
  console.log(`\n=== 부러진 롱소드 대 방어구 (BREAK.stubEdge ${BREAK.stubEdge}: 베기 × ${BREAK.stubCut}, 찌르기 × ${BREAK.stubThrust}) — 같은 부위를 3번, 멀쩡 // 부러짐 ===`);
  const fmt = (x) => x.rs.map((r) => (r ? `${r.helmet || r.plate ? '' : '맨몸 '}${r.type === 'blunt' ? '막음' : `sev${r.severity.toFixed(2)}`} eff${r.eff?.toFixed(0) ?? '-'}/thr${r.thr?.toFixed(0) ?? '-'}` : '-')).join(' | ');
  for (const tid of TARGETS) {
    const target = CHARACTERS_BY_ID[tid];
    const keys = ['chest', ...(target.look.helmet ? ['helmet'] : [])];
    for (const key of keys)
      for (const [E, type] of [[60, 'cut'], [100, 'cut'], [150, 'cut'], [60, 'stab'], [100, 'stab']]) {
        const a = probeSeries(target, key, 'longsword', E, type, 3);
        const b = probeSeries(target, key, 'longsword', E, type, 3, true);
        console.log(`${tid} ${key} ${type} ${E}J: 멀쩡 ${fmt(a)}  //  부러짐(칼날 ${b.att.weaponCfg.bladeLength.toFixed(2)}m) ${fmt(b)}  · 내구 ${(key === 'helmet' ? a.vic.helmetIntegrity : a.vic.plate[a.part]).toFixed(2)} // ${(key === 'helmet' ? b.vic.helmetIntegrity : b.vic.plate[b.part]).toFixed(2)}`);
      }
  }
  const hz = CHARACTERS_BY_ID.heinrich;
  if (!hz) return;
  DEBRIS.headless = true;
  clearDebris();
  const G = newRound({ seed: 1, look: hz.look, weapon: hz.weapon, weapon2: 'longsword' });
  G.enemy.breakWeapon();
  for (let i = 0; i < 3; i++) G.player.wearPlate('chest', 150, new THREE.Vector3(1, 0, 0));
  const n0 = { weapon: debrisCount('weapon'), armor: debrisCount('armor') };
  for (let i = 0; i < 0.5 / DT; i++) tickDebris(DT);
  const n1 = { weapon: debrisCount('weapon'), armor: debrisCount('armor') };
  clearDebris();
  const n2 = debrisCount();
  const ok = n0.weapon >= 1 && n0.armor >= 1 && n1.weapon >= 1 && n1.armor >= 1 && n2 === 0;
  console.log(`칼 조각과 방어구 조각이 함께: 처음 칼 ${n0.weapon} · 방어구 ${n0.armor} → 0.5초 뒤 칼 ${n1.weapon} · 방어구 ${n1.armor} → clearDebris 뒤 ${n2}  ${ok ? 'OK' : 'BAD'}`);
  DEBRIS.headless = false;
}

function main() {
  console.log(`방어구 검증 — 대상 ${TARGETS.join(', ')} · 시드 ${SEED0}~${SEED0 + SEEDS - 1} · 체중 ${CONFIG.BODY.weightMode} · 대결 ${DUEL_S}초 · 제대로 된 타격 = 방어구가 없었으면 베였을 에너지(가슴 ${SOLID}J·팔 ${solidHitJ('arm')}J·다리 ${solidHitJ('leg')}J·머리 ${solidHitJ('head')}J) 이상 (판정 에너지, STRIKE.energyScale ${STRIKE.energyScale})`);
  if (mode === 'probe') return probe();
  const wasOn = CONFIG.ARMOR.on;
  for (const tid of TARGETS) {
    const target = CHARACTERS_BY_ID[tid];
    if (!target) { console.log(`모르는 캐릭터: ${tid}`); continue; }
    const others = CHARACTERS.filter((c) => c.id !== tid);
    const thin = thinPieces(target);
    console.log(`\n[${tid}] 눈에 띄는 조각으로 세지 않는 가는 줄(떨어지긴 한다): ${thin.length ? thin.join(', ') : '없음'}`);
    if (mode === 'dummy' || mode === 'both') {
      console.log(`\n=== ${tid}: 가만히 선 더미(${tid} 겉모습)를 벨 때 — TTK(초, 60초 안에 못 죽이면 60), 처치 수 ===`);
      const res = {};
      for (const on of [false, true]) {
        res[on] = pass(on, () => {
          const out = {};
          for (const a of others) {
            out[a.id] = [];
            for (let s = SEED0; s < SEED0 + SEEDS; s++) out[a.id].push(runDummy(target, a, s));
          }
          return out;
        });
      }
      console.log('공격자, TTK 끔, TTK 켬, 변화%, 처치 끔, 처치 켬');
      const allOff = [], allOn = [];
      for (const a of others) {
        const off = res[false][a.id], onr = res[true][a.id];
        const tOff = mean(off.map((r) => r.ttk)), tOn = mean(onr.map((r) => r.ttk));
        allOff.push(...off.map((r) => r.ttk)); allOn.push(...onr.map((r) => r.ttk));
        console.log(`${a.id}, ${f1(tOff)}, ${f1(tOn)}, ${f1((100 * (tOn - tOff)) / tOff)}, ${off.filter((r) => r.killed).length}/${SEEDS}, ${onr.filter((r) => r.killed).length}/${SEEDS}`);
      }
      const nb = others.filter((a) => a.weapon !== 'tree_branch');
      const m = (on, list) => mean(list.flatMap((a) => res[on][a.id].map((r) => r.ttk)));
      console.log(`[평균] 전체 ${f1(mean(allOff))} → ${f1(mean(allOn))} (${f1((100 * (mean(allOn) - mean(allOff))) / mean(allOff))}%) · 나뭇가지 브란 빼고 ${f1(m(false, nb))} → ${f1(m(true, nb))} (${f1((100 * (m(true, nb) - m(false, nb))) / m(false, nb))}%)`);
      const dOn = others.flatMap((a) => res[true][a.id]);
      const anyD = (f) => dOn.filter((r) => Object.values(r.pieces).some(f)).length / dOn.length;
      const vis = (P) => P.visAt != null;
      console.log(`[켬] 더미 판(${dOn.length}판): 방어구가 한 번이라도 완전히 부서진 판 ${pct(anyD((P) => P.brokeAt != null))} · 조각이라도 떨어져 나간 판(파손, 가는 줄 포함) ${pct(anyD((P) => P.shedAt != null))} · 참고: 제대로 된 타격을 방어구에 한 번이라도 받은 판 ${pct(anyD((P) => P.solid > 0))}`);
      console.log(`[보이는 부서짐] 가만히 선 더미(${tid}) 판에서 눈에 띄는 조각이 떨어져 나간 판(파손 또는 완전 파손): ${pct(anyD(vis))} (${Math.round(anyD(vis) * dOn.length)}/${dOn.length}, 예전 기준 60%, 보고만) · 가는 줄까지 세면 ${pct(anyD((P) => P.shedAt != null))}`);
      // 보이는 부서짐 참고: 방어구가 부서질 기회가 없던 판 — 방어구에 한 번도 닿지 않은 판, 그 가운데 맨머리·목 한 방에 죽은 판(투구 없는 하인리히)
      const touched = dOn.filter((r) => Object.values(r.pieces).some((P) => P.hits > 0));
      const touchedShed = touched.filter((r) => Object.values(r.pieces).some(vis)).length;
      const byAtt = others.map((a) => `${a.id} ${pct(res[true][a.id].filter((r) => Object.values(r.pieces).some(vis)).length / SEEDS)}`).join(' · ');
      console.log(`[보이는 부서짐 참고] 공격자별 (눈에 띄는) 파손 판: ${byAtt} · 방어구에 한 번도 닿지 않은 판 ${pct(1 - touched.length / dOn.length)} (맨머리·목 한 방에 죽은 판 ${pct(dOn.filter((r) => r.oneShotBare).length / dOn.length)}) · 방어구에 닿은 판(${touched.length}판) 가운데 눈에 띄는 조각이 떨어져 나간 판 ${pct(touchedShed / Math.max(1, touched.length))}`);
      printPieces(`[${tid} 더미, ARMOR 켬] 방어구 조각별`, others.flatMap((a) => res[true][a.id].map((r) => r.pieces)));
    }
    if (mode === 'duel' || mode === 'both') {
      console.log(`\n=== ${tid}: AI 대 AI (양쪽 자리, 시드 ${SEED0}~${SEED0 + SEEDS - 1}, ${DUEL_S}초) — ${tid}의 대칭 승률(%), ${tid}가 죽은 시각 ===`);
      const res = {};
      for (const on of [false, true]) {
        res[on] = pass(on, () => {
          const out = {};
          for (const o of others) {
            out[o.id] = [];
            for (let s = SEED0; s < SEED0 + SEEDS; s++) for (const seat of ['A', 'B']) out[o.id].push(runDuel(target, o, s, seat));
          }
          return out;
        });
      }
      console.log('상대, 승률 끔, 승률 켬, 차이(%p), 죽기까지 끔(초·판), 죽기까지 켬(초·판), 완전 파손 판%(켬), 판마다 완전 파손 수(켬), 파손 판%(켬, 눈에 띄는 조각이라도 떨어짐)');
      const wOff = [], wOn = [];
      for (const o of others) {
        const off = res[false][o.id], onr = res[true][o.id];
        const a = 100 * mean(off.map((r) => r.win)), b = 100 * mean(onr.map((r) => r.win));
        if (o.weapon !== 'tree_branch') wOff.push(a), wOn.push(b);
        const dOff = off.filter((r) => r.tDied != null), dOn = onr.filter((r) => r.tDied != null);
        const brokeAny = onr.filter((r) => Object.values(r.pieces).some((P) => P.brokeAt != null)).length / onr.length;
        const nBroke = mean(onr.map((r) => Object.values(r.pieces).filter((P) => P.brokeAt != null).length));
        const shedAny = onr.filter((r) => Object.values(r.pieces).some((P) => P.visAt != null)).length / onr.length;
        console.log(`${o.id}, ${a.toFixed(0)}, ${b.toFixed(0)}, ${(b - a).toFixed(0)}, ${f1(mean(dOff.map((r) => r.tDied)))}·${dOff.length}, ${f1(mean(dOn.map((r) => r.tDied)))}·${dOn.length}, ${pct(brokeAny)}, ${nBroke.toFixed(2)}, ${pct(shedAny)}`);
      }
      console.log(`[평균, 나뭇가지 브란 빼고] 승률 ${mean(wOff).toFixed(1)} → ${mean(wOn).toFixed(1)} (${(mean(wOn) - mean(wOff)).toFixed(1)}%p)`);
      // 죽기까지 걸린 시간(모든 상대를 합쳐서): 죽은 판만 / 살아남은 판은 대결 길이(DUEL_S)로 쳐서
      const ttd = (on, capped) => {
        const rs = others.flatMap((o) => res[on][o.id]);
        return capped ? mean(rs.map((r) => r.tDied ?? DUEL_S)) : mean(rs.filter((r) => r.tDied != null).map((r) => r.tDied));
      };
      const chg = (a, b) => `${f1(a)} → ${f1(b)} (${(b >= a ? '+' : '') + f1((100 * (b - a)) / a)}%)`;
      console.log(`[죽기까지, 모든 상대] 죽은 판만 ${chg(ttd(false, false), ttd(true, false))} · 살아남은 판은 ${DUEL_S}초로 ${chg(ttd(false, true), ttd(true, true))}`);
      const allOn = others.flatMap((o) => res[true][o.id]);
      const any = (f) => allOn.filter((r) => Object.values(r.pieces).some(f)).length / allOn.length;
      console.log(`[켬] 방어구가 한 번이라도 완전히 부서진 판: ${pct(any((P) => P.brokeAt != null))} · 조각이라도 떨어져 나간 판(파손, 가는 줄 포함): ${pct(any((P) => P.shedAt != null))} · 눈에 띄는 조각: ${pct(any((P) => P.visAt != null))} (${allOn.length}판)`);
      const lost = allOn.filter((r) => r.win === 0);
      const lostShed = lost.filter((r) => Object.values(r.pieces).some((P) => P.visAt != null)).length;
      const lostRaw = lost.filter((r) => Object.values(r.pieces).some((P) => P.shedAt != null)).length;
      const lostTouched = lost.filter((r) => Object.values(r.pieces).some((P) => P.hits > 0)).length;
      console.log(`[보이는 부서짐] ${tid}가 진 판(${lost.length}판) 가운데 눈에 띄는 조각이 떨어져 나간 판(파손 또는 완전 파손): ${pct(lostShed / Math.max(1, lost.length))} (${lostShed}/${lost.length}, 예전 기준 50%, 보고만) · 가는 줄까지 세면 ${pct(lostRaw / Math.max(1, lost.length))} · 참고: 진 판 가운데 방어구에 닿은 판 ${pct(lostTouched / Math.max(1, lost.length))}`);
      console.log(`[켬] 참고 — 방어구에 제대로 된 타격을 한 번이라도 받은 판: ${pct(any((P) => P.solid > 0))} · 조금이라도 닿은 판: ${pct(any((P) => P.hits > 0))}`);
      printPieces(`[${tid} 대결, ARMOR 켬] 방어구 조각별`, allOn.map((r) => r.pieces));
    }
  }
  CONFIG.ARMOR.on = wasOn;
}

main();

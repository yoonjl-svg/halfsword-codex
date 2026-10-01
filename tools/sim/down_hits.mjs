// 쓰러진 상대에게 칼이 들어가는가 — 측정 도구
//  상대를 쓰러뜨려(일어나지 못하게) 여러 방향으로 눕힌 뒤, 플레이어가 걸어가 정해진 거리에 서서
//  손을 live_battery.mjs 처럼 스크립트로 움직여 위에서 내려베기·사선 베기·아래로 찌르기를 한다.
//  칼과 몸이 닿은 순간마다 combat 판정(종류·부위·에너지·속도·칼날 맞춤)을 기록하고, 상처가 났는지 /
//  안 났다면 왜인지(닿지 않음·칼 면·에너지 부족·같은 부위 쿨다운·칼자루)를 센다.
//  칼끝의 가장 낮은 높이와 누운 몸까지의 가장 가까운 거리도 함께 잰다.
//
//  사용법: node tools/sim/down_hits.mjs [판 수(칸마다)] [무기 id] [--stand] [--attacks=a,b] [--falls=a,b] [--dists=0.5,0.9]
//   --stand : 상대를 쓰러뜨리지 않고 서 있는 채로 같은 공격 (서 있을 때 결과가 바뀌지 않았는지 확인용)
//   출력 마지막 줄의 JSON 은 사람이 아니라 비교 스크립트용이다
//   근력·감정: --str=0.85 --emo=off --emoP=anger:1 --emoE=fear:1 (str_emo.mjs — 베는 쪽 = 플레이어, 누운 쪽 = 상대.
//   상대 AI 는 이 도구에서 멈춰 있어 --emoE 가 판 끝까지 유지된다)
//  (main.js 처럼 매 스텝 걷기 입력을 0으로 되돌린다 — 검술 층의 내딛기(lunge)는 그 스텝 안에서만 덮어쓴다)
import { newRound, DT, THREE, V, Q } from './harness_m.mjs';
import { strEmoOpts, applyStrEmo, strEmoLabel } from './str_emo.mjs';
import { isMain } from './is_main.mjs';

// 패드 좌표(몸 앞 평면, m) 출발 → 도착, 손 목표 빠르기(패드 m/s)
export const DOWN_ATTACKS = {
  oberhau: { from: [0.02, 0.52], to: [0.0, -0.5], sp: 13 }, // 지붕 → 바보: 위에서 내려베기
  zornhau: { from: [0.42, 0.42], to: [-0.4, -0.42], sp: 13 }, // 오른 어깨 → 왼쪽 아래 사선 베기
  stichDown: { from: [0.18, -0.28], to: [0.0, -0.6], sp: 5 }, // 쟁기 → 아래로 찌르기
  chop: { from: [0.18, -0.28], to: [0.05, -0.6], sp: 9 }, // 쟁기에서 곧장 아래로 짧게 (자세를 올리지 않고)
};
// 넘어지는 방향 (상대 기준, 월드 x축 각). 앞 = 플레이어 쪽
export const FALLS = { toward: Math.PI, away: 0, left: Math.PI / 2, right: -Math.PI / 2 };
export const DISTS = [0.5, 0.7, 0.9, 1.1, 1.3];

/** 칼날 선분(자루 끝~칼끝) 과 점 p 의 가장 가까운 거리 */
function segDist(a, b, p) {
  const ab = b.clone().sub(a);
  const t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
  return a.clone().addScaledVector(ab, t).distanceTo(p);
}

const TORSO = ['chest', 'abdomen', 'pelvis'];
/** 내 가슴에서 상대 몸통(가슴·배·골반) 중 가장 가까운 곳까지의 수평 거리 */
export function torsoDist(P, E) {
  const c = P.bodies.chest.translation();
  let m = Infinity;
  for (const k of TORSO) {
    const b = E.bodies[k];
    if (!b) continue;
    const p = b.translation();
    m = Math.min(m, Math.hypot(p.x - c.x, p.z - c.z));
  }
  return m;
}

function setHand(f, xy) {
  f.handOffset.set(xy[0], xy[1]);
  f.skill.prev.set(xy[0], xy[1]);
  f.skill.aim.set(xy[0], xy[1]);
  f.skill.aimRaw.set(xy[0], xy[1]);
  f.skill.anchor?.set(xy[0], xy[1]);
  f.skill.aimVel.set(0, 0);
  f.skill.vel.set(0, 0);
  f.skill.follow.set(0, 0);
}

/**
 * 한 판. fall: 넘어지는 방향 이름, dist: 공격을 시작할 때 내 가슴~상대 몸통 거리(m)
 * rnd 로 넘어지는 방향·세기를 조금씩 흔든다 (같은 seed → 같은 판)
 */
export function trial({ dist, fall = 'toward', attack, seed, weapon, stand = false, before }) {
  const G = newRound({ walls: false, gap: 2.4, seed, weapon, weapon2: 'longsword' });
  G.ai.update = () => {}; // 상대는 가만히 (쓰러진 채)
  const P = G.player;
  const E = G.enemy;
  if (before) before(G);
  const step = (mv = 0) => {
    P.move.set(0, mv);
    G.step();
  };
  setHand(P, [0.18, -0.28]);
  const jitter = Math.random() - 0.5;
  const jitter2 = Math.random() - 0.5;
  if (!stand) {
    E.knockDown(true);
    E.downTime = 1e9; // 일어나지 못하게
    const a = FALLS[fall] + jitter * 0.5;
    const J = 40 * (1 + jitter2 * 0.4);
    for (let i = 0; i < 2.5 / DT; i++) {
      // 넘어지기 시작하는 0.25초 동안 윗몸을 그 방향으로 민다
      if (i * DT < 0.25) for (const k of ['chest', 'head']) E.bodies[k].applyImpulse({ x: Math.cos(a) * J * DT * 4, y: 0, z: Math.sin(a) * J * DT * 4 }, true);
      step();
    }
  } else {
    for (let i = 0; i < 2.5 / DT; i++) step();
  }
  // 정해진 거리까지 걸어간다 (서 있는 상대는 가슴끼리 dist + 0.6)
  const want = stand ? dist + 0.6 : dist;
  const cur = () => (stand ? P.foeDistance() : torsoDist(P, E));
  // 두 번에 나눠 다가간다: 걸음에 관성이 있어 한 번에 멈추면 0.2~0.3m 더 들어간다
  for (const [tol, mx] of [[0.12, 0.5], [0.03, 0.22]]) {
    for (let i = 0; i < 5 / DT; i++) {
      const d = cur();
      if (Math.abs(d - want) < tol) break;
      step(THREE.MathUtils.clamp((d - want) * 2.5, -mx, mx));
    }
    for (let i = 0; i < 0.6 / DT; i++) step();
  }
  const A = DOWN_ATTACKS[attack];
  // 준비 자세로 천천히 옮긴다 (휘두르기로 보이지 않게, 검술 층의 휘두르기 기준 속도보다 느리게)
  for (let i = 0; i < 1.2 / DT; i++) {
    const off = P.handOffset;
    const dx = A.from[0] - off.x;
    const dy = A.from[1] - off.y;
    const d = Math.hypot(dx, dy);
    const st = 1.0 * DT;
    if (d > st) {
      off.x += (dx / d) * st;
      off.y += (dy / d) * st;
    } else off.set(A.from[0], A.from[1]);
    step();
  }
  const d0 = cur();
  const pc0 = V(P.bodies.chest.translation());
  const ec0 = V(E.bodies.chest.translation());

  // 접촉 기록: combat.strike 를 감싼다
  const log = [];
  const combat = G.combat;
  const origStrike = combat.strike.bind(combat);
  combat.strike = (pr, point, passing) => {
    const att = pr.w.fighter;
    const key = `${att.index}:${pr.v.part}`;
    const cooldown = pr.v.fighter.hitCooldowns.has(key);
    const r = origStrike(pr, point, passing);
    if (att === P) {
      const S = att.cache?.sword;
      let along = null;
      let edgeAlign = null;
      if (r && S) {
        const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(S.q);
        const edge = new THREE.Vector3(1, 0, 0).applyQuaternion(S.q);
        along = r.dir.dot(axis);
        const perp = r.dir.clone().addScaledVector(axis, -along);
        const pl = perp.length();
        edgeAlign = pl > 1e-3 ? Math.abs(perp.dot(edge)) / pl : 0;
      }
      // 칼날로 닿았고 칼날 방향·칼끝 방향이 맞았는데도 둔기로 끝났다면 = 에너지가 문턱에 못 미친 것
      const blade = pr.w.part === 'blade' && att.weaponCfg.edged && !att.weaponBroken;
      const geomCut = blade && edgeAlign != null && edgeAlign > 0.6;
      const geomStab = blade && along != null && along > 0.75 && r && r.t > 0.8;
      log.push({ t: G.t, part: pr.v.part, wpart: pr.w.part, cooldown, passing, geomCut, geomStab, r: r ? { type: r.type, zone: r.zone, energy: r.energy, severity: r.severity, speed: r.speed, t: r.t, along, edgeAlign, y: point.y } : null });
    }
    return r;
  };
  const wounds0 = G.wounds.length;

  // 휘두르기: 손 목표를 출발 → 도착으로 일정한 빠르기로 옮긴 뒤 조금 더 본다
  let minTipY = Infinity;
  let minGap = Infinity;
  let groundTouch = false;
  let peakTip = 0;
  const off = P.handOffset;
  const [bx, by] = A.to;
  for (let i = 0; i < 1.3 / DT; i++) {
    const dx = bx - off.x;
    const dy = by - off.y;
    const d = Math.hypot(dx, dy);
    const st = A.sp * DT;
    if (d > st) {
      off.x += (dx / d) * st;
      off.y += (dy / d) * st;
    } else off.set(bx, by);
    P.inputActive = d > 1e-4;
    step();
    const S = P.sword;
    const q = Q(S.rotation());
    const o = V(S.translation());
    const H = P.weaponCfg.hiltLength;
    const L = P.weaponCfg.bladeLength;
    const a = new THREE.Vector3(0, H, 0).applyQuaternion(q).add(o);
    const b = new THREE.Vector3(0, H + L, 0).applyQuaternion(q).add(o);
    minTipY = Math.min(minTipY, b.y);
    if (b.y < 0.03) groundTouch = true;
    peakTip = Math.max(peakTip, P.tipVel.length());
    for (const part of ['chest', 'abdomen', 'pelvis', 'thighF', 'thighB', 'head']) {
      const body = E.bodies[part];
      if (!body) continue;
      minGap = Math.min(minGap, segDist(a, b, V(body.worldCom())));
    }
  }
  const pc1 = V(P.bodies.chest.translation());
  const drift = Math.hypot(pc1.x - pc0.x, pc1.z - pc0.z); // 휘두르는 동안 내 몸이 움직인 거리
  const myWounds = G.wounds.slice(wounds0).filter((w) => w.att === P);
  const wound = myWounds.some((w) => (w.type === 'cut' || w.type === 'stab') && w.severity > 0);
  // 상처가 안 났다면 이유
  let why = 'wound';
  if (!wound) {
    const contacts = log.filter((l) => l.r || l.cooldown);
    if (!contacts.length) why = 'noContact';
    else if (contacts.every((l) => !l.r)) why = 'cooldownOrWeak';
    else if (contacts.some((l) => l.r && (l.geomCut || l.geomStab || l.r.type === 'cut' || l.r.type === 'stab'))) why = 'belowThreshold';
    else if (contacts.some((l) => l.r && l.wpart !== 'blade')) why = 'hilt';
    else why = 'flat';
  }
  return {
    fall,
    dist,
    d0,
    attack,
    enemyState: E.state,
    enemyChestY: ec0.y,
    playerChestY: pc0.y,
    minTipY,
    minGap,
    drift,
    groundTouch,
    peakTip,
    wound,
    why,
    contacts: log.filter((l) => l.r).map((l) => ({ part: l.part, wpart: l.wpart, ...l.r })),
    wounds: myWounds.map((w) => ({ zone: w.zone, type: w.type, sev: +w.severity.toFixed(2), E: +w.energy.toFixed(0) })),
  };
}

// ── 실행 ──
if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const stand = args.includes('--stand');
  const opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
  const pos = args.filter((a) => !a.startsWith('--'));
  const N = +(pos[0] || 2);
  const weapon = pos[1] || undefined;
  const attacks = opt('attacks')?.split(',') ?? Object.keys(DOWN_ATTACKS);
  const falls = stand ? ['toward'] : (opt('falls')?.split(',') ?? Object.keys(FALLS));
  const dists = opt('dists')?.split(',').map(Number) ?? DISTS;
  const SE = strEmoOpts(args);
  const before = (G) => applyStrEmo(G, SE);
  const rows = [];
  for (const attack of attacks) {
    for (const fall of falls) {
      for (const dist of dists) {
        for (let s = 1; s <= N; s++) rows.push(trial({ dist, fall, attack, seed: 700 + s * 13 + Math.round(dist * 100) + fall.length * 1000, weapon, stand, before }));
      }
    }
  }
  const f2 = (x) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(2));
  const pct = (rs) => (rs.length ? `${((rs.filter((r) => r.wound).length / rs.length) * 100).toFixed(0).padStart(3)}%` : '  - ');
  const frac = (rs) => `${rs.filter((r) => r.wound).length}/${rs.length}`;
  console.log(`무기 ${weapon ?? 'longsword'} · 상대 ${stand ? '서 있음' : '쓰러짐'} · 칸마다 ${N}판 · ${strEmoLabel(SE)}`);
  // 실제로 공격을 시작한 거리로 나눈다 (내 가슴 ~ 상대 몸통)
  const BINS = [[0, 0.45, '발밑 <0.45'], [0.45, 0.75, '0.45~0.75'], [0.75, 1.05, '0.75~1.05'], [1.05, 1.35, '1.05~1.35'], [1.35, 9, '>1.35']];
  const inBin = (r, b) => r.d0 >= b[0] && r.d0 < b[1];
  console.log(`\n상처율 (행: 공격, 열: 공격 시작 때 내 가슴~상대 몸통 거리) — 닿는 거리 = 0.45~1.35m`);
  console.log(`${'공격'.padEnd(10)} ${BINS.map((b) => b[2].padStart(10)).join(' ')} | 닿는 거리`);
  const reachOf = (rs) => rs.filter((r) => r.d0 >= 0.45 && r.d0 <= 1.35);
  for (const attack of attacks) {
    const rs = rows.filter((r) => r.attack === attack);
    console.log(`${attack.padEnd(10)} ${BINS.map((b) => `${pct(rs.filter((r) => inBin(r, b)))} ${frac(rs.filter((r) => inBin(r, b))).padStart(5)}`.padStart(10)).join(' ')} | ${pct(reachOf(rs))} (${frac(reachOf(rs))})`);
  }
  console.log(`\n상처율 (행: 넘어진 방향, 닿는 거리 안)`);
  for (const fall of falls) {
    const rs = reachOf(rows.filter((r) => r.fall === fall));
    console.log(`${fall.padEnd(10)} ${pct(rs)} (${frac(rs)})`);
  }
  // 이유
  const whys = {};
  for (const r of rows) if (!r.wound) whys[r.why] = (whys[r.why] || 0) + 1;
  console.log(`\n상처가 안 난 이유: ${JSON.stringify(whys)}`);
  const m = (rs, k) => rs.reduce((a, r) => a + r[k], 0) / Math.max(1, rs.length);
  console.log(`실제 시작 거리 평균 ${dists.map((d) => f2(m(rows.filter((r) => r.dist === d), 'd0'))).join(' / ')} · 칼끝 최저 평균 ${f2(m(rows, 'minTipY'))}m · 몸까지 최소 평균 ${f2(m(rows, 'minGap'))}m · 땅에 닿은 판 ${rows.filter((r) => r.groundTouch).length}/${rows.length}`);
  // 접촉 표본
  const sample = rows.flatMap((r) => r.contacts.slice(0, 2).map((c) => ({ attack: r.attack, fall: r.fall, dist: r.dist, ...c }))).filter((_, i) => i % 3 === 0).slice(0, 36);
  console.log('\n접촉 표본 (공격 방향 거리 | 부위 칼부위 판정 에너지 속도 칼날위치t 칼축방향 날맞춤 높이 상처):');
  for (const c of sample) console.log(`  ${c.attack} ${c.fall} ${c.dist} | ${c.part} ${c.wpart} ${c.type} E=${c.energy.toFixed(0)} v=${c.speed.toFixed(1)} t=${c.t.toFixed(2)} along=${f2(c.along)} edge=${f2(c.edgeAlign)} y=${f2(c.y)} sev=${c.severity.toFixed(2)}`);
  const hit = rows.filter((r) => r.wound).length;
  const reach = reachOf(rows);
  console.log(`\n전체 상처율 ${((hit / rows.length) * 100).toFixed(0)}% (${hit}/${rows.length}) · 닿는 거리(시작 거리 0.45~1.35m) ${pct(reach)} (${frac(reach)})`);
  // 상처 깊이(severity): 상처 낸 판의 가장 깊은 상처 평균 (공격별)
  const deep = (rs) => {
    const d = rs.filter((r) => r.wound).map((r) => Math.max(...r.wounds.map((w) => w.sev)));
    return d.length ? d.reduce((a, x) => a + x, 0) / d.length : null;
  };
  console.log(`상처 깊이 평균 (닿는 거리 안, 상처 낸 판): ${attacks.map((a) => `${a} ${f2(deep(reachOf(rows.filter((r) => r.attack === a))))}`).join(' · ')}`);
  console.log(JSON.stringify({ weapon: weapon ?? 'longsword', stand, rate: hit / rows.length, reachRate: reach.filter((r) => r.wound).length / Math.max(1, reach.length), rows: rows.map(({ contacts, ...r }) => r) }));
}

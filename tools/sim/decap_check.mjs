// 참수 점검 (사장님 9/30 "머리를 베게 되면 머리가 떨어지면 좋겠는데", config.js COMBAT.decapitate)
//  probe : 가만히 선 상대(AI 끔, 상대 칼 충돌 끔)의 목을 스크립트로 벤다. 먼저 실제 휘두르기(손 목표를 목 높이로 가로질러)를
//          무기·간격·높이로 찾고, 첫 접촉이 치명 목 베기(neck:cut, pass)가 아니면 칼을 목으로 몰아 지나가게 한다(drive).
//          목 관절이 떨어졌나(관절 수), 머리~목 자리 벌어짐(1초 안에 0.3 m 넘게), 3초 동안 모든 몸의 최고 속도·NaN, 남은 몸은
//          그대로 인형(남은 관절 틈), 죽음·참수·목 단면 상처, 이졸데 시트(부활)면 부활 안 함·남은 횟수 그대로,
//          스위치를 끄면 머리가 붙어 있고 이졸데가 되살아나는지. 둔기 목 타격·지나가지 못한 목 베기·튕긴 길의 목 베기·권총 목 사격 → 참수 없음
//  fights: fights12 와 같은 시드·같은 판 (그대로 베낌) → 시드마다 참수된 쪽(P/E)·끝 상태·죽은 까닭, 합계: 12판 중 참수·죽음·NaN,
//          튕긴 길(strike passing=false)로 들어온 치명 목 베기(pass)의 수 (참수하지 않는다)
// 실행: node tools/sim/decap_check.mjs [probe|fights]
const mode = process.argv[2] || 'probe';

const r2 = (x) => (x == null || Number.isNaN(x) ? x : +x.toFixed(2));
const r3 = (x) => (x == null || Number.isNaN(x) ? x : +x.toFixed(3));

if (mode === 'fights') await fights();
else await probe();

// ─────────────────────────────── fights ───────────────────────────────
async function fights() {
  const { newRound, DT, AI, CONFIG } = await import('./jelly_harness.mjs');
  const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
  const out = [];
  let bounceNeck = 0, nanAll = 0;
  for (let seed = 1; seed <= 12; seed++) {
    seedRand(seed);
    const G = newRound({ walls: true, seed }); const P = G.player, E = G.enemy; P.skill.level = 0.7;
    G.ai2 = new AI(P, E, 'normal');
    const hits = []; G.combat.hooks.onWound = (att, vic, r) => hits.push(r);
    const decap = [];
    const orig = G.combat.strike.bind(G.combat);
    G.combat.strike = (pr, pt, passing) => {
      const vic = pr.v.fighter;
      const wasAlive = vic.alive && !vic.revival;
      const was = !!vic.decapitated;
      const r = orig(pr, pt, passing);
      if (r && !passing && wasAlive && r.type === 'cut' && r.zone === 'neck' && r.pass && r.severity > 0.5) bounceNeck++;
      if (!was && vic.decapitated) decap.push(`${vic === P ? 'P' : 'E'}@${G.t.toFixed(2)}(${pr.v.part} sev${r.severity.toFixed(2)} ${r.energy.toFixed(0)}J)`);
      return r;
    };
    let downs = 0; const prev = { P: 'stand', E: 'stand' }; let tDead = null; let nan = false;
    for (let i = 0; i < 30 / DT; i++) {
      G.step();
      for (const [k, f] of [['P', P], ['E', E]]) { if (prev[k] === 'stand' && (f.state === 'down' || f.state === 'getup')) downs++; prev[k] = f.state; }
      if (tDead == null && (P.state === 'dead' || E.state === 'dead')) tDead = +G.t.toFixed(1);
      G.world.forEachRigidBody((b) => { const t = b.translation(), v = b.linvel(); if (![t.x, t.y, t.z, v.x, v.y, v.z].every(Number.isFinite)) nan = true; });
    }
    if (nan) nanAll++;
    const cause = [P, E].filter((f) => f.state === 'dead').map((f) => `${f === P ? 'P' : 'E'}:${f.causeOfDeath}`).join(',') || '-';
    out.push({ seed, end: `${P.state}/${E.state}`, tDead, downs, opened: hits.filter((h) => h.type !== 'blunt' && h.severity > 0).length, maxE: Math.round(Math.max(0, ...hits.map((h) => h.energy))), decapP: !!P.decapitated, decapE: !!E.decapitated, decap, cause, nan });
  }
  for (const o of out) console.log(`seed ${o.seed}: 참수 P ${o.decapP ? 'Y' : 'n'} E ${o.decapE ? 'Y' : 'n'}  끝 ${o.end}${o.tDead ? '@' + o.tDead : ''}  까닭 ${o.cause}  (fights12 표기 ${o.seed}:${o.end}${o.tDead ? '@' + o.tDead : ''} d${o.downs} o${o.opened} E${o.maxE})${o.decap.length ? '  ' + o.decap.join(' ') : ''}${o.nan ? '  NaN' : ''}`);
  const nDecap = out.filter((o) => o.decapP || o.decapE).length;
  const dead = out.filter((o) => o.end.includes('dead')).length;
  console.log(`COMBAT.decapitate=${CONFIG.COMBAT.decapitate}: 참수 ${nDecap}/12판, 죽음 ${dead}/12, NaN ${nanAll}판, 튕긴 길 치명 목 베기(pass) ${bounceNeck}번(참수 안 함)`);
}

// ─────────────────────────────── probe ───────────────────────────────
async function probe() {
  const { newRound, DT, CONFIG, THREE } = await import('./harness_m.mjs');
  const { bulletHit } = await import('../../src/gun.js');
  const { CHARACTERS_BY_ID } = await import('../../src/characters.js');
  const ISO = CHARACTERS_BY_ID.isolde;
  const errors = [];
  const check = (ok, msg) => { if (!ok) errors.push(msg); return ok; };
  const V = (v) => new THREE.Vector3(v.x, v.y, v.z);
  const Q = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
  const wpt = (b, local) => V(local).applyQuaternion(Q(b.rotation())).add(V(b.translation()));
  const nJoints = (world) => { let n = 0; world.impulseJoints.forEach(() => n++); return n; };

  function settleAt(G, f, xy, secs = 1.5) {
    f.handOffset.set(xy[0], xy[1]); f.skill.prev.set(xy[0], xy[1]); f.skill.aim.set(xy[0], xy[1]); f.skill.aimRaw.set(xy[0], xy[1]);
    f.skill.aimVel.set(0, 0); f.skill.vel.set(0, 0); f.skill.follow.set(0, 0);
    for (let i = 0; i < secs / DT; i++) G.step();
  }
  // live_battery.mjs hit() 와 같은 무대: 상대 칼 충돌 끔, 상대 AI 끔, 상대는 자세를 잡고 선다
  function stage({ weapon = 'longsword', gap = 1.2, revive = null } = {}) {
    const G = newRound({ walls: false, gap, weapon, weapon2: 'longsword', revive, seed: 1 });
    G.ai.update = () => {};
    const P = G.player, E = G.enemy;
    P.skill.level = 0.7;
    for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
    const ev = []; let cur = null;
    const orig = G.combat.strike.bind(G.combat);
    const S = { G, P, E, ev, jLast: 0, jBefore: null };
    // 세계 관절 수: 첫 상처를 낸 strike 바로 앞 (drive 가 뗀 손목 관절은 이미 빠져 있다)
    G.combat.strike = (pr, pt, passing) => { const was = cur; cur = passing; S.jLast = nJoints(G.world); try { return orig(pr, pt, passing); } finally { cur = was; } };
    G.onWound = (att, vic, r) => { if (att === P && vic === E) { if (!ev.length) S.jBefore = S.jLast; ev.push({ ...r, passing: cur, t: G.t }); } };
    E.handOffset.set(0.15, 0);
    return S;
  }
  const lethalNeck = (e) => e && e.zone === 'neck' && e.type === 'cut' && e.pass && e.passing && e.severity > 0.5;

  // 실제 휘두르기: 손 목표를 칼 든 쪽(a)에서 반대쪽(b)으로 sp(/s)로 옮긴다 — 첫 상처까지
  function swing(S, a, b, sp) {
    settleAt(S.G, S.P, a, 1.5);
    for (let i = 0; i < 0.8 / DT && !S.ev.length; i++) {
      const off = S.P.handOffset; const dx = b[0] - off.x, dy = b[1] - off.y, d = Math.hypot(dx, dy), st = sp * DT;
      if (d > st) { off.x += dx / d * st; off.y += dy / d * st; } else off.set(b[0], b[1]);
      S.G.step();
    }
    return S.ev[0] ?? null;
  }
  // 칼을 목으로 몬다: 손목 관절을 떼고(시험 전용 — armed 는 그대로 둬 판정은 칼로 받는다) 칼날을 목 높이에 가로로 눕혀
  //  날이 앞장서게 옆으로 speed(m/s)로 보낸다. 닿기 전까지만 속도를 정하고, 닿은 뒤로는 물리에 맡긴다
  function drive(S, speed, { local = [0, -0.075, 0], flat = false } = {}) {
    const { G, P, E } = S;
    settleAt(G, P, [0.15, -0.1], 1.0);
    G.world.removeImpulseJoint(P.gripJoint, true);
    const neck = wpt(E.bodies.head, { x: local[0], y: local[1], z: local[2] });
    const pp = V(P.bodies.pelvis.translation()), ep = V(E.bodies.pelvis.translation());
    const fwd = ep.sub(pp).setY(0).normalize(); // 칼날 방향 (나 → 상대)
    const m = new THREE.Vector3(0, 1, 0).cross(fwd).normalize(); // 옆으로 가는 방향
    const edge = flat ? new THREE.Vector3(0, 1, 0) : m.clone(); // flat: 칼 면이 앞장선다 (둔기)
    const zl = edge.clone().cross(fwd).normalize();
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(edge, fwd, zl));
    const L = P.weaponCfg.hiltLength + 0.6 * P.weaponCfg.bladeLength;
    const o = neck.clone().addScaledVector(fwd, -L).addScaledVector(m, -0.3);
    const sw = P.sword;
    sw.setTranslation(o, true); sw.setRotation(q, true);
    const cache = P.cacheState.bind(P);
    let on = true;
    P.cacheState = () => {
      if (on && S.ev.length) on = false;
      if (on) { sw.setLinvel({ x: m.x * speed, y: m.y * speed, z: m.z * speed }, true); sw.setAngvel({ x: 0, y: 0, z: 0 }, true); }
      cache();
    };
    P.tipPrev = null; P.hitPointPrev = null;
    for (let i = 0; i < 0.3 / DT && !S.ev.length; i++) G.step();
    return S.ev[0] ?? null;
  }

  // 목 관절 자리(가슴·머리 몸 기준)의 월드 틈 — 붙어 있으면 0 가까이
  const neckGap = (E, a1, a2) => wpt(E.bodies.chest, a1).distanceTo(wpt(E.bodies.head, a2));

  // ── 1. 치명 목 베기 찾기 ──
  const CANDS = [];
  for (const weapon of ['longsword', 'zweihander']) for (const gap of [0.9, 1.0, 1.1, 1.2, 1.3, 1.4]) for (const y of [0.2, 0.21, 0.22, 0.24, 0.27, 0.3]) for (const sp of [13, 18]) CANDS.push({ weapon, gap, y, sp });
  let how = null, found = null;
  const tried = { n: 0, zones: {} };
  for (const c of CANDS) {
    const S = stage(c);
    const e = swing(S, [0.52, c.y], [-0.5, c.y], c.sp);
    tried.n++;
    const k = e ? `${e.zone}:${e.type}${e.pass ? '/pass' : ''}` : 'none';
    tried.zones[k] = (tried.zones[k] ?? 0) + 1;
    if (lethalNeck(e)) { how = { kind: 'swing', ...c }; found = e; break; }
  }
  if (!found) {
    for (const weapon of ['longsword', 'zweihander']) {
      for (const speed of [10, 14, 18]) {
        const S = stage({ weapon });
        const e = drive(S, speed);
        if (lethalNeck(e)) { how = { kind: 'drive', weapon, speed }; found = e; break; }
      }
      if (found) break;
    }
  }
  console.log(`휘두르기 후보 ${tried.n}개 첫 접촉: ${JSON.stringify(tried.zones)}`);
  if (!check(!!found, '치명 목 베기(neck:cut, pass)를 만들지 못했다')) return report();
  console.log(`치명 목 베기: ${JSON.stringify(how)} → ${found.zone}:${found.type} pass=${found.pass} passing=${found.passing} 심각도 ${r2(found.severity)} ${Math.round(found.energy)}J`);

  // 같은 방법으로 다시 (무대마다 결정적) — 옵션: revive·스위치
  function run(opts = {}) {
    const S = stage({ weapon: how.weapon, gap: how.gap ?? 1.2, revive: opts.revive ?? null });
    const { G, E } = S;
    const J = E.jointByName.head.joint;
    const a1 = V(J.anchor1()), a2 = V(J.anchor2());
    const mine0 = E.joints.length;
    const e = how.kind === 'swing' ? swing(S, [0.52, how.y], [-0.5, how.y], how.sp) : drive(S, how.speed);
    const before = { mine: mine0, world: S.jBefore };
    const after = { mine: E.joints.length, world: nJoints(G.world) };
    const st = E.wounds.find((x) => x.stump);
    const neckW = E.wounds.find((x) => !x.stump && x.type === 'cut' && x.severity === e?.severity);
    const res = { e, before, after, stumpBleed: st?.bleed ?? null, neckBleed: neckW?.bleed ?? null, bleedAdded: null, headVmax: 0, gaps: [], vmax: 0, vmaxBody: '', nan: false, restGap: 0, stateAt: E.state, revival: E.revival, left: E.revive?.left ?? null, decap: !!E.decapitated };
    // 남은 관절(몸)의 틈을 재는 목록 — 뗀 목 관절은 빠져 있다
    const rest = E.joints.map((j) => ({ j, a1: V(j.joint.anchor1()), a2: V(j.joint.anchor2()) }));
    const names = new Map();
    for (const [k, b] of Object.entries(E.bodies)) names.set(b.handle, `E.${k}`);
    for (const [k, b] of Object.entries(S.P.bodies)) names.set(b.handle, `P.${k}`);
    names.set(E.sword.handle, 'E.sword'); names.set(S.P.sword.handle, 'P.sword');
    const t0 = G.t;
    for (let i = 0; i < 3 / DT; i++) {
      G.step();
      const t = G.t - t0;
      for (const mark of [0.1, 0.25, 0.5, 0.75, 1.0, 2.0, 3.0]) if (Math.abs(t - mark) < DT / 2) res.gaps.push([mark, r3(neckGap(E, a1, a2)), r3(V(E.bodies.head.translation()).distanceTo(V(E.bodies.chest.translation())))]);
      G.world.forEachRigidBody((b) => {
        const p = b.translation(), v = b.linvel();
        if (![p.x, p.y, p.z, v.x, v.y, v.z].every(Number.isFinite)) res.nan = true;
        const s = Math.hypot(v.x, v.y, v.z);
        if (s > res.vmax) (res.vmax = s), (res.vmaxBody = names.get(b.handle) ?? `#${b.handle}`);
        if (b.handle === E.bodies.head.handle) res.headVmax = Math.max(res.headVmax, s);
      });
      for (const r of rest) res.restGap = Math.max(res.restGap, wpt(r.j.parent, r.a1).distanceTo(wpt(r.j.child, r.a2)));
      if (E.revival) res.revival = E.revival;
    }
    res.end = { state: E.state, cause: E.causeOfDeath, decap: !!E.decapitated, revival: E.revival, left: E.revive?.left ?? null, wounds: E.wounds, bleed: E.bleed };
    return { S, res };
  }

  // ── 2. 스위치 켬: 참수 ──
  {
    const { res } = run();
    const w = res.end.wounds;
    const neckW = w.find((x) => x.part === 'head' || (x.part === 'chest' && !x.stump && x.type === 'cut'));
    const stump = w.find((x) => x.stump);
    console.log(`[켬] 관절: 이 검객 ${res.before.mine}→${res.after.mine}, 세계(상처 직전→직후) ${res.before.world}→${res.after.world}${how.kind === 'drive' ? ' (drive 가 뗀 공격자 손목 관절은 직전 수에서 이미 빠짐)' : ''}`);
    console.log(`[켬] 목 자리 틈·머리~가슴 중심 거리 (s, m, m): ${res.gaps.map((g) => `${g[0]}:${g[1]}/${g[2]}`).join('  ')}`);
    console.log(`[켬] 목 상처 출혈 ${r3(res.neckBleed)} /s, 목 단면 출혈 ${r3(res.stumpBleed)} /s (같아야)`);
    console.log(`[켬] 3초 최고 속도 ${r2(res.vmax)} m/s (${res.vmaxBody}), 머리 몸 최고 ${r2(res.headVmax)} m/s, NaN ${res.nan}, 남은 관절 최대 틈 ${r3(res.restGap)} m`);
    console.log(`[켬] 상태 ${res.end.state} (${res.end.cause}), 참수 ${res.end.decap}, 목 단면 ${stump ? JSON.stringify({ part: stump.part, type: stump.type, severity: r2(stump.severity), bleed0: r3(res.e.severity * res.e.bleedPerSev), local: [r3(stump.local.x), r3(stump.local.y), r3(stump.local.z)] }) : '없음'}${neckW ? `, 목 상처 ${neckW.part}` : ''}`);
    check(res.before.mine === 13 && res.after.mine === 12, `관절 수 ${res.before.mine}→${res.after.mine}`);
    check(res.before.world - res.after.world === 1, `세계 관절 ${res.before.world}→${res.after.world}`);
    const g1 = res.gaps.find((g) => g[0] === 1.0);
    check(g1 && g1[1] > 0.3, `1초에 목 자리 틈 ${g1?.[1]} m (0.3 m 넘어야)`);
    check(!res.nan, 'NaN');
    check(res.restGap < 0.05, `남은 관절 틈 ${res.restGap} m`);
    check(res.end.state === 'dead' && res.end.cause === '목', `상태 ${res.end.state} ${res.end.cause}`);
    check(res.end.decap, '참수 표시 없음');
    check(res.stumpBleed != null && res.stumpBleed === res.neckBleed, `목 단면 출혈 ${res.stumpBleed} ≠ 목 상처 ${res.neckBleed}`);
    check(stump && stump.part === 'chest' && stump.type === 'cut' && Math.abs(stump.severity - res.e.severity) < 1e-9 && Math.abs(stump.local.y - 0.17) < 1e-3, '목 단면 상처');
  }
  // 첫 스텝 관절 수는 run 안에서 읽었다. 머리 겉모습이 머리 몸을 따라가는지: groups.head 가 head 몸과 같은 자리 (syncMeshes)
  {
    const { S } = run();
    S.E.syncMeshes();
    const g = S.E.groups.head.position, h = S.E.bodies.head.translation();
    const d = Math.hypot(g.x - h.x, g.y - h.y, g.z - h.z);
    console.log(`[켬] 머리 그룹~머리 몸 ${r3(d)} m, 머리 그룹 자식 ${S.E.groups.head.children.length}개, 목 관절 ${S.E.jointByName.head.joint === null ? '뗌(null)' : '있음'}`);
    check(d < 1e-6 && S.E.jointByName.head.joint === null, '머리 겉모습·목 관절 기록');
  }
  // ── 3. 이졸데 시트(부활): 참수면 되살아나지 않는다 ──
  {
    const { res } = run({ revive: ISO.revive });
    console.log(`[켬·이졸데] 상태 ${res.end.state} (${res.end.cause}), 참수 ${res.end.decap}, revival ${res.revival ? '있음' : 'null'}, revive.left ${res.end.left} (시트 count ${ISO.revive.count})`);
    check(res.end.state === 'dead' && res.end.decap && !res.revival && res.end.left === ISO.revive.count, '이졸데 참수: 부활 안 함·횟수 그대로');
  }
  // ── 4. 스위치 끔: 머리 붙어 있음, 이졸데 되살아남 ──
  {
    CONFIG.COMBAT.decapitate = false;
    const { res } = run();
    const g1 = res.gaps.find((g) => g[0] === 1.0);
    console.log(`[끔] 관절 ${res.before.mine}→${res.after.mine}, 1초 목 자리 틈 ${g1?.[1]} m, 상태 ${res.end.state} (${res.end.cause}), 참수 ${res.end.decap}`);
    check(res.after.mine === 13 && g1[1] < 0.05 && !res.end.decap && res.end.state === 'dead', '끔: 머리 붙어 있어야');
    const iso = run({ revive: ISO.revive }).res;
    console.log(`[끔·이졸데] revival ${iso.revival ? '있었음' : 'null'}, revive.left ${iso.end.left}, 3초 뒤 상태 ${iso.end.state}`);
    check(!!iso.revival && iso.end.left === ISO.revive.count - 1, '끔: 이졸데가 되살아나야');
    CONFIG.COMBAT.decapitate = true;
  }
  // ── 5. 참수 없어야 하는 타격 ──
  {
    // 둔기: 나뭇가지(날 없음)를 같은 목으로 몬다
    let S = null, e = null;
    for (const y of [-0.075, -0.09, -0.1]) {
      S = stage({ weapon: 'tree_branch' });
      e = drive(S, 14, { local: [0, y, 0] });
      if (e?.zone === 'neck') break;
    }
    for (let i = 0; i < 0.5 / DT; i++) S.G.step();
    console.log(`[둔기 목] 첫 접촉 ${e ? `${e.zone}:${e.type} ${Math.round(e.energy)}J` : '없음'}, 참수 ${!!S.E.decapitated}, 관절 ${S.E.joints.length}`);
    check(e && e.type === 'blunt' && e.zone === 'neck' && !S.E.decapitated && S.E.joints.length === 13, '둔기 목 타격');
  }
  {
    // 칼 면으로 목 (롱소드, flat) → 둔기
    let S = null, e = null;
    for (const y of [-0.075, -0.09, -0.1]) {
      S = stage({ weapon: 'longsword' });
      e = drive(S, 14, { local: [0, y, 0], flat: true });
      if (e?.zone === 'neck') break;
    }
    console.log(`[칼 면 목] 첫 접촉 ${e ? `${e.zone}:${e.type} ${Math.round(e.energy)}J` : '없음'}, 참수 ${!!S.E.decapitated}`);
    check(!S.E.decapitated, '칼 면 목 타격');
  }
  {
    // 지나가지 못한 목 베기: 느리게 몰아 neck:cut, pass=false 가 나오는 빠르기를 찾는다
    let got = null;
    for (const sp of [3, 3.5, 4, 4.5, 5, 5.5, 6, 7, 8]) {
      const S = stage({ weapon: 'longsword' });
      const e = drive(S, sp);
      if (e && e.zone === 'neck' && e.type === 'cut' && !e.pass) { got = { sp, e, S }; break; }
    }
    if (got) console.log(`[못 지나간 목 베기] ${got.sp} m/s: 심각도 ${r2(got.e.severity)} pass=${got.e.pass}, 상태 ${got.S.E.state}, 참수 ${!!got.S.E.decapitated}`);
    else console.log('[못 지나간 목 베기] 만들지 못함 (몰기 3~8 m/s)');
    check(got && !got.S.E.decapitated, '못 지나간 목 베기');
  }
  {
    // 튕긴 길(passing=false)에서 pass 로 보고된 치명 목 베기, 둔기·찌르기·지나가지 못한 베기를 applyWound 로 바로 (판정 가지만 본다)
    const cases = [
      ['튕긴 길 pass 치명 베기', { type: 'cut', pass: true, passing: false }],
      ['지나가지 못한 치명 베기', { type: 'cut', pass: false, passing: true }],
      ['치명 찌르기(pass)', { type: 'stab', pass: true, passing: true }],
      ['둔기', { type: 'blunt', pass: true, passing: true }],
    ];
    for (const [name, h] of cases) {
      const S = stage();
      for (let i = 0; i < 0.5 / DT; i++) S.G.step();
      S.E.applyWound({ zone: 'neck', part: 'head', severity: 1.2, energy: 150, bleedPerSev: 0.2, local: new THREE.Vector3(0, -0.07, 0), dir: new THREE.Vector3(0, 0, 1), ...h });
      console.log(`[바로] ${name}: 상태 ${S.E.state}, 참수 ${!!S.E.decapitated}, 관절 ${S.E.joints.length}`);
      check(!S.E.decapitated && S.E.joints.length === 13, name);
    }
    // 죽은 몸에 다시 치명 목 베기 (passing): 상처 없음·참수 없음
    const S = stage();
    for (let i = 0; i < 0.5 / DT; i++) S.G.step();
    S.E.die('출혈');
    S.E.applyWound({ zone: 'neck', part: 'head', severity: 1.2, energy: 150, bleedPerSev: 0.2, local: new THREE.Vector3(0, -0.07, 0), dir: new THREE.Vector3(0, 0, 1), type: 'cut', pass: true, passing: true });
    console.log(`[바로] 죽은 몸 목 베기: 참수 ${!!S.E.decapitated}`);
    check(!S.E.decapitated, '죽은 몸 참수');
  }
  {
    // 권총: 목에 총알 (gun.js bulletHit, 늘 찌르기)
    const S = stage({ weapon: 'pistol' });
    for (let i = 0; i < 0.5 / DT; i++) S.G.step();
    const info = S.G.combat.info.get(S.E.bodies.head.collider(0).handle);
    const pt = wpt(S.E.bodies.head, { x: 0, y: -0.075, z: 0 });
    const dir = V(S.E.bodies.head.translation()).sub(V(S.P.bodies.chest.translation())).normalize();
    const r = bulletHit(S.P, info, pt, dir, S.G.combat);
    for (let i = 0; i < 0.5 / DT; i++) S.G.step();
    console.log(`[권총 목] ${r ? `${r.zone}:${r.type} 심각도 ${r2(r.severity)}` : '없음'}, 상태 ${S.E.state} (${S.E.causeOfDeath ?? '-'}), 참수 ${!!S.E.decapitated}`);
    check(r && r.zone === 'neck' && !S.E.decapitated && S.E.joints.length === 13, '권총 목 사격');
  }
  return report();

  function report() {
    console.log(errors.length ? `실패 ${errors.length}: ${errors.join(' | ')}` : '통과');
    process.exitCode = errors.length ? 1 : 0;
  }
}

// ─────────────────────────────────────────────────────────────
//  ratna_monkey_clear.mjs — 라트나 어깨 원숭이 겹침 검사 (10/14 사장님 '어깨 원숭이 유지 — 북부 대공의 검을 두 손으로 쥔 이베리아 자세 14 칸과
//   기술 동작 전부에서 칼·팔과 겹치는지 검사, 겹치면 왼쪽 어깨나 등으로' — docs/import/ratna_port_2026-10-14.md §원숭이)
//  원숭이는 가슴에 붙은 장식(충돌체 없음)이라 물리에는 닿지 않는다 — 겉으로 칼·팔이 뚫고 지나가는지를 잰다. 읽기만 한다(물리·난수에 손대지 않음).
//   원숭이 = 라트나 겉모습이 실제로 만든 원숭이 메쉬(outfit_ratna.js)를 이어진 조각마다 볼록 껍질로(꼬리 관은 마디마다) — 원숭이 판 좌표 그대로
//   칼 = 칼 몸체의 실제 충돌체(칼날·코등이·자루·폼멜) + 두 주먹(칼 원점 · 빈손 쥘 자리 gripAlong, 반지름 5.5 cm — hands.js 주먹 크기)
//   팔 = 겉모습 크기 캡슐: 위팔 살 0.053 · 소매 0.067 (outfit_ratna.js 소매 단면) · 아래팔 0.044 · 손 공 0.05 — 칼 든 팔은 뼈가 앞(+x)으로 누운 꼴(DRESS_ALONG_X)
//   머리 = 얼굴·머리털 어림 공 반지름 0.12 m (참고 칸 — 지시 범위 밖)
//   거리는 Rapier 모양끼리의 거리(contactShape — 음수 = 겹친 깊이). 표의 수 = 그 구간의 가장 가까운 거리 cm (음수면 겹침)
//  ① 자세 14 칸: 플레이어 몸(패드로 그 자세 자리에)으로 1.4 s 들고 1.0~1.4 s 의 가장 가까운 거리 (montante_pass.mjs 와 같은 꼴)
//  ② 기술 길: 이베리아 꾸러미 기술 17(공용 13 + 고유 4) · 속임수 4 · 비기(길목 지키기 — 옆 자세 → 몸 가운데 → 반대 옆 자세, 좌우)를 패드 9·11·13 m/s 로 따라가며
//     길 전체 + 끝난 뒤 0.6 s 의 가장 가까운 거리 (패시브 셋은 이 기술들을 쓴다)
//  ③ 실전: 라트나 AI(숙련도 2·5) 대 롱소드 AI, 판마다 30 s — 겹친 스텝 몫 · 가장 가까운 거리 · 겹칠 때의 AI 기술/자세
//  node tools/sim/ratna_monkey_clear.mjs [--seat=as|v3|v2|<이름>] [--all-seats] [--guards=0] [--techs=0] [--live=0] [--seeds=4] [--secs=30] [--json=<파일>]
//   --seat 후보 자리는 아래 SEATS (as = looks.js 에 적힌 지금 자리 그대로)
// ─────────────────────────────────────────────────────────────
import { newRound, DT, THREE, RAPIER, AI } from './harness_m.mjs';
import { writeFileSync } from 'node:fs';
import { getLook } from '../../src/looks.js';
import { CHARACTERS_BY_ID, aiAtProficiency } from '../../src/characters.js';
import { WEAPONS } from '../../src/weapons.js';
import { GUARD_BASE } from '../../src/guards.js';
import { G as PADS } from '../../src/ai_techniques.js';
import { resolveSwordArt } from '../../src/sword_art.js';
import { aiUniqueStages } from '../../src/unique_assist.js';

const args = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) args[m[1]] = m[2] ?? true;
}
// --companion=iguana checks the alter's actual merged shoulder decoration.
const IGUANA = args.companion === 'iguana';
const LOOK = IGUANA ? CHARACTERS_BY_ID.ratna_mad.look : getLook('ratna');
const RATNA = IGUANA ? CHARACTERS_BY_ID.ratna_mad : CHARACTERS_BY_ID.ratna;
const COMPANION_NODE = IGUANA ? 'alter-shoulder-iguana' : 'ratna-monkey';
const W = WEAPONS[RATNA.weapon];
const art = resolveSwordArt(W, null);

// 후보 자리 — outfit_ratna.js placeMonkey 와 같은 셈: 모양 좌표의 앉은 점 MONKEY_SEAT 를 seat(가슴 좌표 [앞, 위, 오른쪽] m)에 놓고 rot(오일러 rad)만큼 그 점을 축으로 돌림
const MONKEY_SEAT = [-0.01, 0.148, -0.225];
const D = Math.PI / 180;
//  as(지금 v4 — 등 가방 위 왼쪽 [−0.20, 0.16, −0.14], outfit_ratna.js MONKEY_SEATS.bag)를 고르기까지 잰 자리들 (문서 §5-3 표)
export const SEATS = {
  v3: { seat: [-0.01, 0.123, -0.195], rot: [0, 0, 0], ko: '샛별 v3 — 왼 어깨 위, 목 쪽 3 cm' },
  v2: { seat: [-0.01, 0.104, -0.225], rot: [0, 0, 0], ko: '샛별 v2 — 왼 어깨 위, 바깥' },
  shoulderBack: { seat: [-0.085, 0.112, -0.17], rot: [0, 30 * D, 0], ko: '왼 어깨 뒤쪽(어깨뼈 위)' },
  backLeft: { seat: [-0.165, 0.07, -0.11], rot: [0, 0, 0], ko: '등 왼쪽 위 — 왼 어깨 너머로 고개' },
  backHigh: { seat: [-0.17, 0.06, -0.02], rot: [0, 0, 0], ko: '등 가운데 위' },
  backMid: { seat: [-0.17, -0.02, -0.04], rot: [0, 0, 0], ko: '등 가운데(어깨뼈 아래)' },
  bagL1: { seat: [-0.165, 0.1, -0.11], rot: [0, 0, 0], ko: '등 가방 위 (왼쪽, 높게) — 왼 어깨 너머로 고개' },
  bagL2: { seat: [-0.165, 0.085, -0.1], rot: [0, 0, 0], ko: '등 가방 위 (왼쪽, 조금 낮게)' },
  bagC1: { seat: [-0.17, 0.09, -0.085], rot: [0, 0, 0], ko: '등 가방 위 (가운데 쪽)' },
  bagC2: { seat: [-0.175, 0.095, -0.07], rot: [0, 0, 0], ko: '등 가방 위 (더 가운데)' },
  bagT1: { seat: [-0.165, 0.1, -0.11], rot: [0, -25 * D, 0], ko: '등 가방 위 (왼쪽, 몸을 가운데로 25° 돌림)' },
  bagT2: { seat: [-0.18, 0.09, -0.09], rot: [0, -20 * D, 0], ko: '등 가방 위 (가운데 쪽, 20° 돌림)' },
  highCenter: { seat: [-0.2, 0.16, -0.1], rot: [0, 0, 0], ko: '높은 등짐 위 가운데 쪽 (원숭이 머리가 라트나 머리 뒤)' },
  highLow: { seat: [-0.21, 0.13, -0.12], rot: [0, 0, 0], ko: '등짐 위 조금 낮고 가운데 쪽' },
};

const V3 = (v) => new THREE.Vector3(v.x, v.y, v.z);
const Q4 = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
const ALONG_X = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2); // 캡슐 y → 몸 +x (fighter.js ALONG_X)

/** 원숭이 판(Group 'ratna-monkey')의 메쉬를 이어진 조각마다 볼록 껍질로 (판 좌표). 꼬리 관(15 고리 × 7)은 이웃 두 고리씩 */
function monkeyHulls(layer) {
  const hulls = [];
  for (const mesh of layer.isMesh ? [layer] : layer.children) {
    if (!mesh.isMesh) continue;
    const pos = mesh.geometry.attributes.position;
    const n = pos.count;
    const parent = Int32Array.from({ length: n }, (_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const join = (a, b) => (parent[find(a)] = find(b));
    const key = new Map();
    for (let i = 0; i < n; i++) {
      const k = `${Math.round(pos.getX(i) * 1e5)},${Math.round(pos.getY(i) * 1e5)},${Math.round(pos.getZ(i) * 1e5)}`;
      if (key.has(k)) join(i, key.get(k));
      else key.set(k, i);
    }
    const idx = mesh.geometry.index;
    if (idx) for (let t = 0; t < idx.count; t += 3) (join(idx.getX(t), idx.getX(t + 1)), join(idx.getX(t), idx.getX(t + 2)));
    if (!idx) for (let t = 0; t < n; t += 3) { join(t, t + 1); join(t, t + 2); }
    const comps = new Map();
    for (let i = 0; i < n; i++) {
      const r = find(i);
      if (!comps.has(r)) comps.set(r, []);
      comps.get(r).push(i);
    }
    for (const list of comps.values()) {
      list.sort((a, b) => a - b);
      const chunks = list.length === 15 * 7 ? Array.from({ length: 14 }, (_, k) => list.slice(k * 7, k * 7 + 14)) : [list];
      for (const ch of chunks) {
        const pts = new Float32Array(ch.length * 3);
        const c = new THREE.Vector3();
        ch.forEach((i, j) => {
          pts.set([pos.getX(i), pos.getY(i), pos.getZ(i)], j * 3);
          c.x += pos.getX(i);
          c.y += pos.getY(i);
          c.z += pos.getZ(i);
        });
        c.multiplyScalar(1 / ch.length);
        const shape = new RAPIER.ConvexPolyhedron(pts, null);
        hulls.push({ shape, part: partOf(c, list.length === 15 * 7) });
      }
    }
  }
  return hulls;
}
// 원숭이 모양 좌표(왼 어깨에 앉은 꼴)의 조각 가운데 점으로 이름: 머리 · 몸 · 팔(원숭이 팔) · 손 · 발(발·정강이) · 엉덩이(엉덩이·넓적다리) · 꼬리
//  발·엉덩이 = 어깨·가슴에 얹혀 앉은 자리(샛별 v3 '발의 어깨 접촉 높이 보정' — 둥근 어깨 소매 속에 1~2 cm 묻혀 있다). 팔과의 거리는 둘로 나눠 적는다:
//  자유 조각(머리·몸·팔·손·꼬리)이 팔에 뚫리면 겹침 · 앉은 자리 조각은 쉴 때(곧은 자세) 묻힌 깊이보다 1 cm 넘게 더 묻히면 겹침
function partOf(c, tail) {
  if (tail) return '꼬리';
  if (c.y > 0.27) return '머리';
  if (c.y < 0.166 && c.x > 0.05) return '손';
  if (c.y < 0.166) return '발';
  if (c.x > 0.04) return '팔';
  if (c.y < 0.18) return '엉덩이';
  if (c.x > 0.02 && c.y < 0.25) return '팔';
  return '몸';
}
const SEAT_PARTS = new Set(['발', '엉덩이']);

/** 원숭이 판 자리 바꾸기 (후보 시험 — outfit_ratna.js placeMonkey 와 같은 셈) */
function placeLayer(layer, { seat, rot }) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot));
  const p = new THREE.Vector3(...MONKEY_SEAT).applyQuaternion(q);
  layer.quaternion.copy(q);
  layer.position.set(seat[0] - p.x, seat[1] - p.y, seat[2] - p.z);
}

// 겉모습 팔 캡슐 (겉모습 좌표 y 구간 [a, b], 반지름) — 칼 든 팔은 겉모습 y → 몸 −x
const ARM_CAPS = {
  upper: [[-0.105, 0.105, 0.053], [-0.075, 0.095, 0.067]],
  fore: [[-0.095, 0.095, 0.044], [-0.135, -0.135, 0.05]],
};
const capsules = new Map();
function capShape(h, r) {
  const k = `${h.toFixed(4)}|${r}`;
  if (!capsules.has(k)) capsules.set(k, h > 1e-6 ? new RAPIER.Capsule(h, r) : new RAPIER.Ball(r));
  return capsules.get(k);
}
const FIST = new RAPIER.Ball(0.055);
const HEAD = new RAPIER.Ball(0.12);

/** 한 스텝: 원숭이 조각 ↔ 칼·팔·머리 가장 가까운 거리 (m, 음수 = 겹침) */
function measure(f, hulls, layer) {
  f.syncMeshes();
  layer.updateWorldMatrix(true, false);
  const lp = new THREE.Vector3(), lq = new THREE.Quaternion(), ls = new THREE.Vector3();
  layer.matrixWorld.decompose(lp, lq, ls);
  const lpos = { x: lp.x, y: lp.y, z: lp.z }, lrot = { x: lq.x, y: lq.y, z: lq.z, w: lq.w };
  const out = blank();
  const PRED = 0.6;
  const near = (key, d, part) => {
    if (key === 'armL' || key === 'armR') key = SEAT_PARTS.has(part) ? key.replace('arm', 'seat') : key; // 앉은 자리 조각은 따로 (위 partOf)
    if (d < out[key]) {
      out[key] = d;
      out[`${key}Part`] = part;
    }
  };
  // 칼: 충돌체 그대로
  if (f.sword && f.armed !== false) {
    for (const col of f.swordColliders) {
      for (const h of hulls) {
        const c = col.contactShape(h.shape, lpos, lrot, PRED);
        if (c) near('sword', c.distance, h.part);
      }
    }
    // 두 주먹: 칼 원점(칼 든 손) · 빈손 쥘 자리(두 손 무기를 쥐고 있을 때)
    const sp = V3(f.sword.translation()), sq = Q4(f.sword.rotation());
    const fists = [sp];
    if (f.gripping) fists.push(new THREE.Vector3(0, f.weaponCfg.gripAlong ?? -0.22, 0).applyQuaternion(sq).add(sp));
    for (const p of fists) {
      for (const h of hulls) {
        const c = FIST.contactShape({ x: p.x, y: p.y, z: p.z }, { x: 0, y: 0, z: 0, w: 1 }, h.shape, lpos, lrot, PRED);
        if (c) near('sword', c.distance, h.part);
      }
    }
  }
  // 팔: 왼팔(빈팔 uarmO·farmO) · 오른팔(칼 든 팔 uarmS·farmS — 뼈가 앞으로 누움)
  for (const [key, up, fo, alongX] of [['armL', 'uarmO', 'farmO', false], ['armR', 'uarmS', 'farmS', true]]) {
    for (const [part, caps] of [[up, ARM_CAPS.upper], [fo, ARM_CAPS.fore]]) {
      const rb = f.bodies[part];
      if (!rb) continue;
      const t = V3(rb.translation()), q = Q4(rb.rotation());
      for (const [a, b, r] of caps) {
        const mid = (a + b) / 2;
        const off = alongX ? new THREE.Vector3(-mid, 0, 0) : new THREE.Vector3(0, mid, 0);
        const p = off.applyQuaternion(q).add(t);
        const rq = alongX ? q.clone().multiply(ALONG_X) : q;
        const sh = capShape((b - a) / 2, r);
        for (const h of hulls) {
          const c = sh.contactShape({ x: p.x, y: p.y, z: p.z }, { x: rq.x, y: rq.y, z: rq.z, w: rq.w }, h.shape, lpos, lrot, PRED);
          if (c) near(key, c.distance, h.part);
        }
      }
    }
  }
  // 머리 (참고)
  {
    const rb = f.bodies.head;
    const p = new THREE.Vector3(-0.008, 0.006, 0).applyQuaternion(Q4(rb.rotation())).add(V3(rb.translation()));
    for (const h of hulls) {
      const c = HEAD.contactShape({ x: p.x, y: p.y, z: p.z }, { x: 0, y: 0, z: 0, w: 1 }, h.shape, lpos, lrot, PRED);
      if (c) near('head', c.distance, h.part);
    }
  }
  return out;
}
const KEYS = ['sword', 'armL', 'armR', 'seatL', 'seatR', 'head'];
/** --debug: 가슴 좌표(가슴 몸체 기준 [앞, 위, 오른쪽] m)로 왼 위팔·아래팔 가운데와 손 자리 */
function bodyAt(f) {
  const c = V3(f.bodies.chest.translation()), q = Q4(f.bodies.chest.rotation()).invert();
  const loc = (p) => V3(p).sub(c).applyQuaternion(q).toArray().map((v) => +v.toFixed(3));
  const fo = f.bodies.farmO, wrist = new THREE.Vector3(0, -0.135, 0).applyQuaternion(Q4(fo.rotation())).add(V3(fo.translation()));
  return { uarmO: loc(f.bodies.uarmO.translation()), farmO: loc(fo.translation()), handO: loc(wrist), sword: loc(f.sword.translation()) };
}
const fold = (acc, m) => {
  for (const k of KEYS) if (m[k] < acc[k]) (acc[k] = m[k]), (acc[`${k}Part`] = m[`${k}Part`] ?? '');
  return acc;
};
const blank = () => Object.fromEntries(KEYS.flatMap((k) => [[k, Infinity], [`${k}Part`, '']]));
const cm = (d) => (Number.isFinite(d) ? (100 * d).toFixed(1) : '≥60');
const mark = (d, part) => (d < 0 ? `**${cm(d)}** (${part})` : cm(d));

function solo(seat) {
  const G = newRound({ walls: false, weapon: RATNA.weapon, weapon2: 'longsword', seed: 7, look: LOOK });
  G.park();
  const P = G.player;
  const layer = P.groups.chest.getObjectByName(COMPANION_NODE);
  if (!layer) throw new Error('원숭이 판이 없다 (look.ratnaRevision ≥ 2 인지)');
  if (seat) placeLayer(layer, seat);
  return { G, P, layer };
}
function setPad(P, x, y) {
  P.handOffset.set(x, y);
  P.skill.aimRaw?.set?.(x, y);
}

// 기술 길 목록: 꾸러미 기술(공용 + 고유) · 속임수(가짜 기술 길을 at 몫까지 → then) · 비기(길목 지키기, 좌우)
function techList() {
  const list = [];
  const ST = aiUniqueStages(art.tradition).unique; // 고유 동작이 열리는 숙련도 (ai.js 와 같은 표 — unique_assist.js PLAYER_UNIQUE 단계)
  const uniqueAt = Object.fromEntries(ST);
  for (const t of art.school.tech) {
    if (!t.path || !t.from) continue;
    list.push({ name: t.nameKo ? t.nameKo : t.name, id: t.name, from: t.from, path: t.path.map((p) => p.slice()), open: uniqueAt[t.name] ?? 0, kind: uniqueAt[t.name] ? '고유' : '공용' });
  }
  for (const fk of art.school.feints ?? []) {
    const fake = art.school.techByName?.[fk.fake] ?? art.school.tech.find((t) => t.name === fk.fake);
    if (!fake?.path) continue;
    const pts = [fake.from, ...fake.path];
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const cut = [];
    let run = 0;
    for (let i = 1; i < pts.length; i++) {
      const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (run + seg >= fk.at * total) {
        const u = (fk.at * total - run) / seg;
        cut.push([pts[i - 1][0] + u * (pts[i][0] - pts[i - 1][0]), pts[i - 1][1] + u * (pts[i][1] - pts[i - 1][1])]);
        break;
      }
      cut.push(pts[i]);
      run += seg;
    }
    list.push({ name: `속임수 ${fk.name}`, id: `feint:${fk.name}`, from: fake.from, path: [...cut, ...fk.then.map((p) => p.slice())], open: 0, kind: '속임수' });
  }
  const mid = [0, -0.1]; // schools.js IBERIAN_SECRET_GILMOK.do.cutMid
  if (art.tradition === 'iberian') {
    list.push({ name: '비기 길목 지키기 (오른 옆 → 왼 옆)', id: 'gilmok:R', from: PADS.sideR, path: [mid, PADS.sideL], open: 5, kind: '비기' });
    list.push({ name: '비기 길목 지키기 (왼 옆 → 오른 옆)', id: 'gilmok:L', from: PADS.sideL, path: [mid, PADS.sideR], open: 5, kind: '비기' });
  }
  return list;
}

function runGuards(seat) {
  const rows = [];
  const only = args.gonly ? new Set(String(args.gonly).split(',').map(Number)) : null; // --gonly=9,10 자세 번호만 (후보 고르기)
  for (let i = 0; i < GUARD_BASE.length; i++) {
    if (only && !only.has(i)) continue;
    const { G, P, layer } = solo(seat);
    const hulls = monkeyHulls(layer);
    const pd = GUARD_BASE[i].pad;
    setPad(P, pd[0], pd[1]);
    const acc = blank();
    for (let t = 0; t < 1.4; t += DT) {
      G.step();
      if (t > 1.0) fold(acc, measure(P, hulls, layer));
    }
    const name = P.guardPose.table?.[i]?.name ?? GUARD_BASE[i].name;
    rows.push({ i, name: art.names?.[i]?.name ?? name, base: GUARD_BASE[i].name, ...acc });
  }
  return rows;
}

function runTechs(seat) {
  const rows = [];
  const SPS = String(args.speeds ?? '9,11,13').split(',').map(Number);
  const only = args.only ? new Set(String(args.only).split(',')) : null; // --only=zornhauL,gilmok:L 기술 id 만 (후보 고르기)
  for (const tech of techList()) {
    if (only && !only.has(tech.id)) continue;
    const acc = blank();
    for (const SP of SPS) {
      const { G, P, layer } = solo(seat);
      const hulls = monkeyHulls(layer);
      setPad(P, tech.from[0], tech.from[1]);
      for (let t = 0; t < 0.8; t += DT) G.step();
      const pts = tech.path.map((p) => p.slice());
      let cur = [tech.from[0], tech.from[1]];
      let t = 0, done = null;
      while (t < 3.5) {
        if (pts.length) {
          const [tx, ty] = pts[0];
          const dx = tx - cur[0], dy = ty - cur[1];
          const dd = Math.hypot(dx, dy);
          const st = SP * DT;
          if (dd > st) cur = [cur[0] + (dx / dd) * st, cur[1] + (dy / dd) * st];
          else (cur = [tx, ty]), pts.shift();
          if (!pts.length) done = t;
        }
        setPad(P, cur[0], cur[1]);
        G.step();
        t += DT;
        const m = measure(P, hulls, layer);
        if (args.debug && m.armL < acc.armL) acc.armLAt = { t: +t.toFixed(3), sp: SP, pad: cur.map((v) => +v.toFixed(3)), ...bodyAt(P) }; // --debug: 왼팔이 가장 가까웠던 때의 몸 좌표
        if (args.debug && m.sword < acc.sword) acc.swordAt = { t: +t.toFixed(3), sp: SP, pad: cur.map((v) => +v.toFixed(3)) }; // --debug: 칼이 가장 가까웠던 때 (그림 장면 고르기)
        fold(acc, m);
        if (done != null && t > done + 0.6) break;
      }
    }
    rows.push({ name: tech.name, id: tech.id, kind: tech.kind, open: tech.open, ...acc });
  }
  return rows;
}

/** 쉴 때(이베리아 쉬는 자세 = 곧은 자세 langort) 앉은 자리 조각이 팔 소매에 묻힌 깊이 — 앉은 자리 겹침의 기준 */
function restSeat(seat) {
  const { G, P, layer } = solo(seat);
  const hulls = monkeyHulls(layer);
  const i = GUARD_BASE.findIndex((g) => g.name.startsWith('긴 자세'));
  setPad(P, GUARD_BASE[i].pad[0], GUARD_BASE[i].pad[1]);
  const acc = blank();
  for (let t = 0; t < 1.4; t += DT) {
    G.step();
    if (t > 1.0) fold(acc, measure(P, hulls, layer));
  }
  return { seatL: acc.seatL, seatR: acc.seatR };
}
/** 겹침 판정: 칼·주먹은 원숭이 어디든 · 팔은 자유 조각(머리·몸·팔·손·꼬리) · 앉은 자리 조각은 쉴 때보다 1 cm 넘게 더 묻힐 때 */
function overlaps(r, base) {
  const lim = (b) => (b < 0 ? b - 0.01 : 0);
  const why = [];
  if (r.sword < 0) why.push('칼');
  if (r.armL < 0) why.push('왼팔');
  if (r.armR < 0) why.push('오른팔');
  if (r.seatL < lim(base.seatL)) why.push('왼팔(앉은 자리)');
  if (r.seatR < lim(base.seatR)) why.push('오른팔(앉은 자리)');
  return why;
}

function runLive(seat, prof, base) {
  const seeds = +(args.seeds ?? 4);
  const secs = +(args.secs ?? 30);
  const res = { prof, steps: 0, sampled: 0, hit: { 칼: 0, 왼팔: 0, 오른팔: 0, '왼팔(앉은 자리)': 0, '오른팔(앉은 자리)': 0, any: 0 }, min: blank(), at: {} };
  for (let s = 1; s <= seeds; s++) {
    const ai = aiAtProficiency(RATNA, prof);
    const G = newRound({ walls: true, weapon: 'longsword', weapon2: RATNA.weapon, seed: 100 + s, look2: LOOK, difficulty: ai.level, persona: ai.persona, AI2Class: AI, difficulty2: 'normal' });
    const E = G.enemy;
    const layer = E.groups.chest.getObjectByName(COMPANION_NODE);
    if (seat) placeLayer(layer, seat);
    const hulls = monkeyHulls(layer);
    for (let t = 0; t < secs; t += DT) {
      G.step();
      res.steps++;
      if (E.state !== 'stand' || (res.steps & 1)) continue; // 서 있을 때만 (넘어져 구르는 몸은 자세·기술이 아니다) · 두 스텝마다
      const m = measure(E, hulls, layer);
      res.sampled++;
      fold(res.min, m);
      const why = overlaps(m, base);
      for (const w of why) res.hit[w]++;
      if (why.length) {
        res.hit.any++;
        const what = G.ai.tech?.nameKo ?? G.ai.tech?.name ?? (G.ai.guard?.name ? `자세 ${G.ai.guard.name}` : G.ai.mode ?? '?');
        res.at[what] = (res.at[what] ?? 0) + 1;
        if (args.debug) { // --debug: 겹친 표본의 원숭이 조각 · 손 패드
          res.dbg ??= {};
          for (const k of ['sword', 'armL']) if (m[k] < 0) { const key = `${k}:${m[`${k}Part`]}`; res.dbg[key] = (res.dbg[key] ?? 0) + 1; }
          res.pads ??= [];
          if (res.pads.length < 12) res.pads.push({ seed: s, t: +t.toFixed(2), what, pad: [+E.handOffset.x.toFixed(2), +E.handOffset.y.toFixed(2)], sword: +(100 * m.sword).toFixed(1), armL: +(100 * m.armL).toFixed(1) });
        }
      }
    }
  }
  return res;
}

// ── 실행 ──
const seatNames = args['all-seats'] ? ['as', ...Object.keys(SEATS)] : String(args.seat ?? 'as').split(',');
const out = { look: { ratnaRevision: LOOK.ratnaRevision, ratnaMonkey: LOOK.ratnaMonkey }, weapon: W.id, tradition: art.tradition, seats: {} };
const row = (r, base) => {
  const why = overlaps(r, base);
  return `${mark(r.sword, r.swordPart)} | ${mark(r.armL, r.armLPart)} | ${cm(r.seatL)} | ${mark(r.armR, r.armRPart)} | ${cm(r.seatR)} | ${cm(r.head)} | ${why.length ? `**${why.join('·')}**` : '없음'}`;
};
const summary = { };
for (const sn of seatNames) {
  const seat = sn === 'as' ? null : SEATS[sn];
  if (sn !== 'as' && !seat) throw new Error(`자리 없음: ${sn}`);
  const label = sn === 'as' ? `as (looks.js ratnaMonkey '${LOOK.ratnaMonkey}')` : `${sn} — ${seat.ko}`;
  const base = restSeat(seat);
  console.log(`\n## ${IGUANA ? '이구아나' : '원숭이'} 자리 ${label} · ${W.nameKo} (${art.tradition}) · 겉모습 v${LOOK.ratnaRevision}`);
  console.log(`쉴 때(곧은 자세) 앉은 자리 조각 깊이: 왼팔 ${cm(base.seatL)} · 오른팔 ${cm(base.seatR)} cm (이보다 1 cm 넘게 더 묻히면 겹침)`);
  const rec = { base, guards: null, techs: null, live: [] };
  const head = '칼·주먹 cm | 왼팔 cm (자유 조각) | 왼팔 cm (앉은 자리) | 오른팔 cm (자유 조각) | 오른팔 cm (앉은 자리) | 머리 cm (참고) | 겹침';
  if (args.guards !== '0') {
    rec.guards = runGuards(seat);
    console.log(`\n| # | 자세 | ${head} |`);
    console.log('|---|---|---|---|---|---|---|---|---|');
    for (const r of rec.guards) console.log(`| ${r.i} | ${r.name} | ${row(r, base)} |`);
    rec.guardsBad = rec.guards.filter((r) => overlaps(r, base).length).length;
    console.log(`\n겹친 자세 ${rec.guardsBad} / ${rec.guards.length}`);
  }
  if (args.techs !== '0') {
    rec.techs = runTechs(seat);
    console.log(`\n| 기술 | 갈래 | 열리는 숙련도 | ${head} |`);
    console.log('|---|---|---|---|---|---|---|---|---|---|');
    for (const r of rec.techs) console.log(`| ${r.name} | ${r.kind} | ${r.open || '—'} | ${row(r, base)} |`);
    if (args.debug) for (const r of rec.techs) console.log(`  debug ${r.id}: 왼팔 가장 가까움 ${cm(r.armL)} cm @ ${JSON.stringify(r.armLAt ?? null)} · 칼 ${cm(r.sword)} cm @ ${JSON.stringify(r.swordAt ?? null)}`);
    rec.techsBad = rec.techs.filter((r) => overlaps(r, base).length).length;
    console.log(`\n겹친 기술 ${rec.techsBad} / ${rec.techs.length}`);
  }
  if (args.live !== '0') {
    for (const prof of String(args.profs ?? '2,5').split(',').map(Number)) {
      const r = runLive(seat, prof, base);
      rec.live.push(r);
      const pct = (n) => ((100 * n) / Math.max(1, r.sampled)).toFixed(2);
      const top = Object.entries(r.at).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v}`).join(' · ') || '—';
      const parts = Object.entries(r.hit).filter(([k]) => k !== 'any').map(([k, v]) => `${k} ${pct(v)}`).join(' · ');
      if (args.debug) console.log('  debug', JSON.stringify(r.dbg ?? {}), JSON.stringify(r.pads ?? []));
      console.log(`\n실전 숙련도 ${prof} (${args.seeds ?? 4} 판 × ${args.secs ?? 30} s, 서 있는 동안 두 스텝마다 ${r.sampled} 표본): 겹친 표본 ${pct(r.hit.any)} % (${parts}) · 가장 가까운 칼 ${cm(r.min.sword)} · 왼팔 ${cm(r.min.armL)} · 오른팔 ${cm(r.min.armR)} cm · 겹칠 때 ${top}`);
    }
  }
  summary[sn] = { guards: rec.guardsBad, techs: rec.techsBad, live: rec.live.map((r) => +((100 * r.hit.any) / Math.max(1, r.sampled)).toFixed(2)) };
  out.seats[sn] = rec;
}
if (seatNames.length > 1) {
  console.log('\n## 자리별 한눈에 (겹친 자세 / 14 · 겹친 기술 / 기술 수 · 실전 겹친 표본 %)');
  for (const [sn, v] of Object.entries(summary)) console.log(`- ${sn}: 자세 ${v.guards ?? '—'} · 기술 ${v.techs ?? '—'} · 실전 ${v.live.join(' / ') || '—'}`);
}
if (args.json) writeFileSync(args.json, JSON.stringify(out, (k, v) => (v === Infinity ? null : v), 1));

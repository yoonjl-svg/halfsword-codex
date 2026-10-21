// 막기 몸꼴이 칼을 '흘리나 · 멈추나' 재기 (10/17 01:0x 사장님 '우케나가시의 핵심은 빗겨서 미끄러트리는 건데 지금 그런 효과가 나진 않지?'). 읽기만.
//  판은 parry_gap_map.mjs 와 같다 — 막는 쪽 = 플레이어(막기 단추 버팀), 치는 쪽 = AI normal 몸이 대본으로 긋기(쉴 0.6 s → 준비 3 m/s → 0.15 s → 11 m/s).
//  처음 칼끼리 부딪힌 순간(combat.js onClash fresh)의 맞닿는 방향 빠르기 vn · 칼날을 따라 스치는 빠르기 vt · 충격량 J,
//  그 뒤 0.35 s 동안 칼끼리 닿아 있던 시간 · 치는 칼끝이 어디로 갔나(막는 쪽 가슴 기준 옆 · 높이)를 센다:
//   흘러내림 = 칼끝이 막는 쪽 어깨 높이 밑으로, 몸 가운데에서 옆으로 0.25 m 넘게 비켜 지나감(받은 칼을 따라 미끄러져 옆으로 빠짐)
//   멈춤 = 칼끝이 머리 높이 위에 머묾(받아 세움 — 왕관처럼) · 그 밖 = 가운데로 내려옴(밀고 들어옴)
//  꼴: <무기>[:nocover] — nocover = 그 유파 몸꼴 덧씌우기만 뺌. ATTACKS=oberhau,zornhau ATKS=longsword,zweihander GAPS=… OUT=<json>
//  node tools/sim/deflect_probe.mjs uchigatana,uchigatana:nocover,longsword
import { newRound, DT } from './harness_m.mjs';
import { writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { SKILL, NAGASHI } from '../../src/config.js';
import { TECH } from '../../src/ai_techniques.js';
import { TRADITIONS } from '../../src/schools.js';
import { PlayerParryGuard } from '../../src/parry_button.js';

if (process.env.NAGASHI != null) NAGASHI.on = +process.env.NAGASHI; // NAGASHI=0: 흘려 받기 규칙 끔 (config NAGASHI)
const CONFIGS = (process.argv[2] ?? 'uchigatana,uchigatana:nocover,longsword').split(',').map((s) => {
  const [weapon, mode = 'school'] = s.split(':');
  return { weapon, mode, key: s };
});
const ATTACKS = (process.env.ATTACKS ?? 'oberhau,zornhau').split(',').map((n) => TECH.find((t) => t.name === n)).filter(Boolean);
const ATKS = (process.env.ATKS ?? 'longsword,zweihander').split(',');
const GAPS = (process.env.GAPS ?? '1.3,1.4,1.5,1.6,1.7').split(',').map(Number);
const _r = new THREE.Vector3(), _t = new THREE.Vector3();

function trial(cfg, attack, atk, gap) {
  SKILL.parryAssist = 0;
  const Gm = newRound({ weapon: cfg.weapon, weapon2: atk, seed: 1, gap });
  const D = Gm.player, A = Gm.enemy;
  D.skill.corr = SKILL.corr;
  D.skill.corrTip = SKILL.corrTip;
  D.skill.autoGuard = true;
  const tr = D.swordArt?.tradition;
  const saved = cfg.mode === 'nocover' ? Object.getOwnPropertyDescriptor(TRADITIONS[tr], 'parryCover') : null;
  if (saved) Object.defineProperty(TRADITIONS[tr], 'parryCover', { value: null, configurable: true, writable: true });
  const guard = new PlayerParryGuard(D, A);
  if (saved) Object.defineProperty(TRADITIONS[tr], 'parryCover', saved);
  // CALM=<m/s> 시험: 따라가기를 상대 칼끝이 이 빠르기 밑일 때만 (parry_gap_map.mjs CALM 과 같음)
  if (process.env.CALM) {
    const CALM = +process.env.CALM, st = guard.step.bind(guard);
    guard.step = (dt) => {
      const s = guard.sense.seen(0), keep = SKILL.parryFollow;
      if (Math.hypot(s.tvx, s.tvy, s.tvz) >= CALM) SKILL.parryFollow = 0;
      const out = st(dt);
      SKILL.parryFollow = keep;
      return out;
    };
  }
  Gm.ai.update = () => {};
  A.move.set(0, 0);
  guard.held = !process.env.NOPARRY; // NOPARRY=1: 막기 단추를 안 누른 판 — 그 간격에서 막지 않으면 실제로 맞는지 보기
  const setPad = (x, y) => (A.handOffset.set(x, y), A.skill.aimRaw?.set?.(x, y));
  let ph = 0, t0 = 0, pts = null, cut = null, first = null, touch = 0, lastTouch = -1, slide = 0, nag = 0;
  const track = [];
  const prev = Gm.combat.hooks.onClash;
  Gm.combat.hooks.onClash = (point, sp, info) => {
    prev?.(point, sp, info);
    if (info.nagashi) nag++; // 흘려 받기가 걸린 부딪힘 (combat.js nagashi — config NAGASHI)
    // 긋기(ph 3~) 동안 처음 부딪힌 것만 — 준비 동작(칼을 들어 올림) 중 스침은 뺀다. 닿은 자리 = 내 칼 위 몇 할(0 코등이 → 1 칼끝, 음수 = 자루 쪽) · 덧씌운 몸꼴 무게
    if (!first && info.fresh && ph >= 3) {
      const a = D.bladePoint(0, new THREE.Vector3()), b = D.bladePoint(1, new THREE.Vector3());
      const ab = b.clone().sub(a), L2 = ab.lengthSq() || 1;
      const at = new THREE.Vector3(point.x, point.y, point.z).sub(a).dot(ab) / L2;
      first = { t: Gm.t, vn: info.vn, vt: info.vt, J: info.impulse, line: guard.defLine, mode: guard.mode, cw: +(D.skill._cover?.w ?? 0).toFixed(2), at: +at.toFixed(2) };
    }
    if (first && Gm.t - first.t <= 0.35 && lastTouch !== Gm.t) (touch += DT), (slide += sp * DT), (lastTouch = Gm.t);
  };
  Gm.before = () => {
    guard.step(DT);
    D.inputActive = guard.active;
    const o = A.handOffset;
    const go = (tx, ty, sp) => {
      const dx = tx - o.x, dy = ty - o.y, dd = Math.hypot(dx, dy), st = sp * DT;
      if (dd > st) setPad(o.x + (dx / dd) * st, o.y + (dy / dd) * st);
      else return setPad(tx, ty), true;
      return false;
    };
    if (ph === 0 && Gm.t > 0.6) ph = 1;
    else if (ph === 1 && go(attack.from[0], attack.from[1], 3)) (ph = 2), (t0 = Gm.t);
    else if (ph === 2 && Gm.t - t0 > 0.15) (ph = 3), (pts = attack.path.map((p) => p.slice()));
    else if (ph === 3 && go(pts[0][0], pts[0][1], 11) && (pts.shift(), !pts.length)) (ph = 4), (t0 = Gm.t);
    if (!cut && Gm.wounds.some((x) => x.vic === D && x.type !== 'blunt')) cut = { t: Gm.t, ph };
    if (first && Gm.t - first.t <= 0.35) {
      const c = D.bodies.chest.translation();
      const tip = A.bladePoint(1, _t);
      const rt = D.right(_r);
      track.push({ t: Gm.t - first.t, lat: (tip.x - c.x) * rt.x + (tip.z - c.z) * rt.z, h: tip.y - c.y });
    }
  };
  while (!(ph === 4 && Gm.t - t0 > 0.6) && Gm.t < 6) Gm.step();
  const why = !cut && !first ? 'clear' : cut ? (cut.ph < 3 ? 'wind' : 'cut') : 'ok';
  if (!first) return { why, nag };
  // 칼끝 길: 어깨(가슴 +0.15) 밑으로 내려간 첫 점의 옆 자리 · 머리(가슴 +0.45) 위에 머문 몫
  const low = track.find((p) => p.h < 0.15);
  const highShare = track.filter((p) => p.h > 0.45).length / Math.max(1, track.length);
  const path = low ? (Math.abs(low.lat) > 0.25 ? 'slide' : 'through') : highShare > 0.6 ? 'stop' : 'hang';
  // 처음 닿은 뒤 0.2 s 의 상대 칼끝 자리 (막는 쪽 가슴 기준 옆 · 높이 — 흘려 받기 켬·끔 비교용)
  const p20 = track.find((p) => p.t >= 0.2) ?? track[track.length - 1];
  return { why, nag, vn: first.vn, vt: first.vt, J: first.J, line: first.line, mode: first.mode, cw: first.cw, at: first.at, touch, slide, path, lowLat: low?.lat ?? null, lat20: p20?.lat ?? null, h20: p20?.h ?? null };
}

const out = {};
for (const cfg of CONFIGS) {
  const rows = [];
  for (const attack of ATTACKS) for (const atk of ATKS) for (const gap of GAPS) rows.push({ attack: attack.name, atk, gap, ...trial(cfg, attack, atk, gap) });
  out[cfg.key] = rows;
  const hit = rows.filter((r) => r.vn != null);
  const avg = (k) => (hit.length ? hit.reduce((s, r) => s + r[k], 0) / hit.length : 0);
  const cnt = (p) => hit.filter((r) => r.path === p).length;
  console.log(`${cfg.key.padEnd(20)} 부딪힘 ${hit.length}/${rows.length} · 처음 닿을 때 맞닿는 빠르기 vn ${avg('vn').toFixed(2)} · 스치는 빠르기 vt ${avg('vt').toFixed(2)} m/s · 충격량 ${avg('J').toFixed(2)} N·s · 0.35 s 안 닿은 시간 ${avg('touch').toFixed(3)} s` +
    ` | 칼끝: 흘러내림 ${cnt('slide')} · 멈춤 ${cnt('stop')} · 가운데로 ${cnt('through')} · 머묾 ${cnt('hang')} | 막음 ${rows.filter((r) => r.why === 'ok').length} 베임 ${rows.filter((r) => r.why === 'cut' || r.why === 'wind').length} | 흘려 받기 걸린 판 ${rows.filter((r) => r.nag > 0).length}`);
}
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));

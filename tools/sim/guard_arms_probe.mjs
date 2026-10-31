// ─────────────────────────────────────────────────────────────
//  guard_arms_probe.mjs — 사람 몸(0 번) 겨눔 팔 재기 (10/31 사장님 '언젠가부터 대검을 이상하게 들더라' — docs/motion/guard_arms_2026-10-31.md). 재기만.
//   판을 세우고(상대 세움 · 패드 (0.15, 0) = 판 시작 자리) t 초 뒤 가슴 틀 [앞, 위, 칼 든 쪽] 으로 두 손 · 두 팔꿈치 · 칼 방향 · 팔꿈치 각 · 손 사이를 한 줄 JSON 으로.
//   --hold=초: 끝에서 그만큼 앞부터 손가락이 닿음(handHeld) — 폰에서 엄지를 얹어 둔 꼴 · --grip=0|1: 그 손가락의 main.js handGrip(0 = 얹기만 · 1 = 끈 손가락 · 안 주면 두지 않음 = 시뮬 대본 몸)
//   --root=<나무>: 다른 체크아웃(옛 커밋을 git archive 로 푼 곳 — node_modules 는 이어 둠)의 src 로 잰다 — 언제부터인지 가를 때
//   --pad=x,y: 판을 세운 뒤 패드를 그 자리에 둠(corr_lib setPad 와 같음 — 자세 자리마다 잴 때)
//  node tools/sim/guard_arms_probe.mjs [무기=zweihander] [--t=4.5] [--hold=2] [--grip=0|1] [--pad=x,y] [--root=.]
// ─────────────────────────────────────────────────────────────
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = {};
const pos = [];
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) args[m[1]] = m[2] ?? true;
  else pos.push(a);
}
const root = path.resolve(args.root ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const weapon = pos[0] || 'zweihander';
const T = +(args.t ?? 4.5);
const HOLD = +(args.hold ?? 0);
const { newRound, DT, THREE } = await import(path.join(root, 'tools/sim/harness_m.mjs'));
const G = newRound({ weapon, weapon2: 'longsword', seed: 1 });
G.parkEnemy = true;
const f = G.player;
if (args.pad) {
  const [px, py] = String(args.pad).split(',').map(Number);
  f.handOffset.set(px, py);
  const k = f.skill;
  for (const v of [k.prev, k.aim, k.aimRaw, k.anchor]) v?.set(px, py);
  k.aimVel?.set(0, 0);
  k.vel?.set(0, 0);
  k.follow?.set(0, 0);
}
const n = Math.round(T / DT);
const nHold = Math.round(HOLD / DT);
for (let i = 0; i < n; i++) {
  if (HOLD && i >= n - nHold) {
    f.handHeld = true;
    if (args.grip != null) f.handGrip = args.grip === '1';
  }
  G.step();
}
const Q = (b) => { const r = b.rotation(); return new THREE.Quaternion(r.x, r.y, r.z, r.w); };
const Wp = (b, l) => { const t = b.translation(); return new THREE.Vector3(...l).applyQuaternion(Q(b)).add(new THREE.Vector3(t.x, t.y, t.z)); };
const ct = f.bodies.chest.translation(), ci = Q(f.bodies.chest).invert();
const L = (p) => { const v = p.clone().sub(new THREE.Vector3(ct.x, ct.y, ct.z)).applyQuaternion(ci); return [v.x, v.y, v.z * f.side]; };
const B = f.bodies;
// 팔 몸체 끝 (fighter.js partDefs · offHand 와 같은 자리): 칼 팔은 뼈가 x 를 따라 · 빈팔은 −y 를 따라
const shS = Wp(B.uarmS, [-0.15, 0, 0]), elS = Wp(B.uarmS, [0.15, 0, 0]), haS = Wp(B.farmS, [0.135, 0, 0]);
const shO = Wp(B.uarmO, [0, 0.15, 0]), elO = Wp(B.uarmO, [0, -0.15, 0]), haO = Wp(B.farmO, [0, -0.135, 0]);
const ang = (a, b, c) => (a.clone().sub(b).angleTo(c.clone().sub(b)) * 180) / Math.PI;
const dL = new THREE.Vector3(0, 1, 0).applyQuaternion(Q(f.sword)).applyQuaternion(ci);
const dir = [dL.x, dL.y, dL.z * f.side];
const r3 = (a) => a.map((x) => +x.toFixed(3));
const gp = f.guardPose;
console.log(JSON.stringify({
  root: path.basename(root), weapon, t: +G.t.toFixed(2), hold: HOLD, grip: args.grip ?? null, state: f.state, tradition: f.swordArt?.tradition ?? null,
  pad: r3([f.handOffset.x, f.handOffset.y]), hud: f.swordArt?.names?.[gp?.nearest ?? -1]?.name ?? null, idleW: +(f.bodyPose?.idle ?? NaN).toFixed(2),
  k: f.corrScale ? +f.corrScale(f.skill.level).k.toFixed(3) : null,
  handS: r3(L(haS)), handO: r3(L(haO)), elbowS: r3(L(elS)), elbowO: r3(L(elO)),
  elbowAngS: +ang(shS, elS, haS).toFixed(1), elbowAngO: +ang(shO, elO, haO).toFixed(1),
  bladeEl: +((Math.asin(Math.max(-1, Math.min(1, dir[1]))) * 180) / Math.PI).toFixed(1), bladeAz: +((Math.atan2(dir[2], dir[0]) * 180) / Math.PI).toFixed(1),
  gripping: f.gripping, handsGap: +haS.distanceTo(haO).toFixed(3),
}));
process.exit(0);

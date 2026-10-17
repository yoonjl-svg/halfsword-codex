// Research only. Actual 120 Hz blade/body contact, paired guard trials and input traces.
import { newRound, DT } from './harness_m.mjs';
import { SKILL } from '../../src/config.js';
import { TECH, FEINTS } from '../../src/ai_techniques.js';
import { TRADITIONS } from '../../src/schools.js';
import { NEW_TECH } from '../../src/frames.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { threatNow } from '../../src/secret.js';
import * as THREE from 'three';

export const ATTACK_NAMES = 'zornhau,zornhauL,stichPflug,unterhau,zuoyi,unterhauL,oberhau,talhoReves,stichOchsL,stichOchs,zwerch,찌르기→베기,talhoRodeado,zwerchL,hirakiGiri,stichPflugL,tsubameGaeshi,inquartata,위→다리'.split(',');
export const CONFIGS = 'uchigatana,zweihander,qinggang,longsword,rapier,longsword:basic,uchigatana:nocover'.split(',');
const byName = Object.fromEntries(TECH.map(t => [t.name, t]));
const lerp = (a, b, f) => a.map((x, i) => x + (b[i] - x) * f);
const feint = f => ({ name: f.name, from: byName[f.fake].from, path: [lerp(byName[f.fake].from, byName[f.fake].path[0], f.at), ...f.then] });
const pool = [...TECH, ...FEINTS.map(feint)];
for (const tr of Object.values(TRADITIONS)) for (const u of tr.unique ?? []) {
  if (u.from && u.path) pool.push(u);
  else if (u.feint) pool.push({ ...feint(u.feint), name: u.name });
}
for (const list of Object.values(NEW_TECH)) for (const t of list) if (t.from && t.path) pool.push(t);
export const attacks = Object.fromEntries(pool.map(t => [t.name, t]));
const v3 = p => ({ x: p.x, y: p.y, z: p.z });

export function trial({ cfg = 'uchigatana', atk = 'longsword', gap = 1.4, name = 'oberhau', held = true, heldAt, trace = false, Guard = PlayerParryGuard, prepareOnly = false, onFrame, strokeSpeed = 11, prepPause = .15, seed = 1, playerModel = false, startingStamina = 100 }) {
  const attack = attacks[name];
  if (!attack) throw new Error(`Unknown attack ${name}`);
  const [weapon, mode = 'school'] = cfg.split(':');
  SKILL.parryAssist = 0;
  const G = newRound({ weapon, weapon2: atk, seed, gap });
  const D = G.player, A = G.enemy;
  D.skill.corr = SKILL.corr;
  D.skill.corrTip = SKILL.corrTip;
  D.skill.autoGuard = true;
  if (mode === 'basic') D.schoolParry = false;
  const tr = D.swordArt?.tradition;
  const saved = mode === 'nocover' ? Object.getOwnPropertyDescriptor(TRADITIONS[tr], 'parryCover') : null;
  if (saved) Object.defineProperty(TRADITIONS[tr], 'parryCover', { value: null, configurable: true, writable: true });
  const guard = new Guard(D, A);
  if (playerModel) {
    D.stamina.controller = guard; // main.js newRound's player connection
    D.stamina.value = startingStamina;
    D.stamina.stages();
  }
  if (saved) Object.defineProperty(TRADITIONS[tr], 'parryCover', saved);
  guard.held = held;
  G.ai.update = () => {};
  A.move.set(0, 0);
  let ph = 0, t0 = 0, pts = null, previousLine = null;
  const r = { instrumentation: 2, cfg, atk, gap, name, held, prepareOnly, touches: [], wounds: [], clashes: [], transitions: [], phases: [], frames: [] };
  const touchLast = new Map();
  const pointVelocity = (state, p) => {
    const x = p.x - state.com.x, y = p.y - state.com.y, z = p.z - state.com.z;
    return { x: state.v.x + state.w.y * z - state.w.z * y, y: state.v.y + state.w.z * x - state.w.x * z, z: state.v.z + state.w.x * y - state.w.y * x };
  };
  const eventState = () => ({ t: G.t, ph, mode: guard.mode, line: guard.line, defLine: guard.defLine, cover: D.skill._cover?.w ?? 0 });
  const strike = G.combat.strike.bind(G.combat);
  G.combat.strike = (pr, p, passing) => {
    if (pr.w.fighter === A && pr.v.fighter === D && pr.w.part === 'blade') {
      const key = `${pr.wc}:${pr.vc}`, previous = touchLast.get(key) ?? -Infinity;
      if (previous !== G.t) {
        const av = pointVelocity(A.cache.sword, p), dv = pointVelocity(D.cache.parts[pr.v.part], p);
        r.touches.push({ ...eventState(), point: v3(p), part: pr.v.part, passing, pair: key, fresh: G.t - previous > 2.5 * DT,
          velocity: { x: av.x - dv.x, y: av.y - dv.y, z: av.z - dv.z }, hitPointVelocity: v3(A.hitPointVel) });
      }
      touchLast.set(key, G.t);
    }
    return strike(pr, p, passing);
  };
  const prevClash = G.combat.hooks.onClash;
  G.combat.hooks.onClash = (p, sp, info) => {
    prevClash?.(p, sp, info);
    if (info.fresh || info.nagashi) r.clashes.push({ ...eventState(), fresh: !!info.fresh, nagashi: !!info.nagashi, point: v3(p), vn: info.vn, vt: info.vt });
  };
  const prevWound = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, result, p, pr) => {
    prevWound?.(att, vic, result, p, pr);
    if (vic === D) r.wounds.push({ ...eventState(), type: result.type, zone: result.zone, energy: result.energy, ...(playerModel ? {severity: result.severity} : {}), point: v3(p) });
  };
  const setPad = (x, y) => (A.handOffset.set(x, y), A.skill.aimRaw?.set?.(x, y));
  const right = new THREE.Vector3();
  G.before = () => {
    if (heldAt) guard.held = heldAt(G.t);
    guard.step(DT);
    D.inputActive = guard.active;
    const state = eventState();
    if (guard.line !== previousLine) {
      r.transitions.push({ ...state, from: previousLine });
      previousLine = guard.line;
    }
    if (trace) {
      const s = { ...guard.sense.seen(0) };
      delete s.vital;
      const c = v3(D.bodies.chest.translation()), rt = v3(D.right(right));
      const d = Math.max(.01, Math.hypot(s.cx - c.x, s.cz - c.z));
      const reach = (D.swordArt.measureFor(A.weapon)?.reach ?? 1) + .05;
      const threat = threatNow(guard.sense, A, s, c, rt, d, reach, 0);
      r.frames.push({ ...state, s, c, right: rt, d, reach, threat, timer: guard.timer, noThreat: guard.noThreat, read: guard.readDebug ?? null,
        own: { aim: v3(D.skill.aim), pad: v3(D.handOffset), base: v3(D.bladePoint(0, new THREE.Vector3())), tip: v3(D.bladePoint(1, new THREE.Vector3())), handGoal: D.skill._cover?.last?.hand ?? null, bladeGoal: D.skill._cover?.last?.blade ?? null },
        foeBase: v3(A.bladePoint(0, new THREE.Vector3())) });
    }
    const o = A.handOffset;
    const go = (tx, ty, sp) => {
      const dx = tx - o.x, dy = ty - o.y, dd = Math.hypot(dx, dy), step = sp * DT;
      if (dd > step) setPad(o.x + dx / dd * step, o.y + dy / dd * step);
      else return setPad(tx, ty), true;
      return false;
    };
    const before = ph;
    if (ph === 0 && G.t > .6) ph = 1;
    else if (ph === 1 && go(attack.from[0], attack.from[1], 3)) (ph = 2), (t0 = G.t);
    else if (ph === 2 && G.t - t0 > (prepareOnly ? .8 : prepPause)) {
      if (prepareOnly) (ph = 4), (t0 = G.t);
      else (ph = 3), (pts = attack.path.map(p => p.slice()));
    } else if (ph === 3 && go(pts[0][0], pts[0][1], strokeSpeed) && (pts.shift(), !pts.length)) (ph = 4), (t0 = G.t);
    if (before !== ph) r.phases.push({ t: G.t, ph });
    if (playerModel) {
      G.ai.mode = ph ? 'attack' : 'idle';
      G.ai.phase = ['idle', 'wind', 'hold', 'strike', 'follow'][ph];
      if (before === 2 && ph === 3) A.stamina.attack(attack.kind === 'thrust' ? 'thrust' : 'cut'); // AI.startStrike
    }
  };
  try {
    while (!(ph === 4 && G.t - t0 > .6) && G.t < 6) {
      G.step();
      onFrame?.(G, guard, ph);
    }
    r.duration = G.t;
    const cut = r.wounds.find(w => w.type !== 'blunt');
    const clash = r.clashes.find(c => c.fresh);
    r.injured = !!cut;
    r.why = cut ? (cut.ph < 3 ? 'wind' : clash && clash.t < cut.t ? 'pushed' : 'cut') : clash ? 'ok' : 'clear';
    r.firstStrokeClash = r.clashes.find(c => c.fresh && c.ph >= 3) ?? null;
    r.nag = r.clashes.some(c => c.nagashi);
    r.switches = r.transitions.filter(x => x.t >= .6 && x.from != null).length;
    r.stats = { ...guard.stats };
    if (playerModel) {
      r.instrumentation = 3;
      r.stamina = {start: startingStamina, end: D.stamina.value, spent: {...D.stamina.spent}, recovered: D.stamina.recovered, counts: {...D.stamina.counts}};
      r.alive = D.alive;
      r.blood = D.blood;
    }
    if (!trace) delete r.frames;
    return r;
  } finally {
    G.eventQueue.free();
    G.world.free();
  }
}

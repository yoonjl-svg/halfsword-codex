// Isolated stage trial. Team wrapper adapted from our 2026-10-25 tournament prototype; not the official Saengsa engine.
import * as THREE from "three";
import { Fighter, GROUND_GROUPS } from "../fighter.js";
import { AI } from "../ai.js";
import { Combat } from "../combat.js";
import {
  PHYSICS,
  ARENA,
  AI_PROFICIENCY,
  STEEL,
  BIND,
  SCHOOL_PASSIVE,
} from "../config.js";
import { LOOKS } from "../looks.js";
import { CHARACTERS_BY_ID } from "../characters.js";
import { setSupportFloor } from "../gait.js";
import { PlayerParryGuard } from "../parry_button.js";
import { resolveSwordArt, applySwordArt } from "../sword_art.js";
import { PlayerSecretWatch } from "../secret.js";
import { PlayerUniqueAssist } from "../unique_assist.js";
import { schoolPassiveOn } from "../school_passive.js";
import { createFordGround, TERRAIN, steerFord } from "./ground.js";
const weaponOf=m=>m.assignedWeapon;
import { shortName, weaponSchool } from "./catalog.js";

// Four bodies share one world. Pair-local blade contacts prevent one duel's
// bind/rearm state from replacing another's. Original duel Combat is unchanged.
export class TeamCombat extends Combat {
  constructor(info, hooks) {
    super(info, hooks);
    this.pairStates = new Map();
    this.byActor = new Map();
  }
  friendly(a, b) {
    return (
      a &&
      b &&
      a.fighter !== b.fighter &&
      a.fighter.eventTeam === b.fighter.eventTeam
    );
  }
  pairOf(a, b) {
    if (this.friendly(this.info.get(a), this.info.get(b))) return null;
    return super.pairOf(a, b);
  }
  filterContactPair(a, b) {
    if (this.friendly(this.info.get(a), this.info.get(b))) return null;
    const all = this.fighters;
    this.fighters = [this.info.get(a)?.fighter, this.info.get(b)?.fighter];
    try {
      return super.filterContactPair(a, b);
    } finally {
      this.fighters = all;
    }
  }
  strike(pr, p, pass) {
    if (pr.w.fighter.eventTeam === pr.v.fighter.eventTeam) return null;
    return super.strike(pr, p, pass);
  }
  afterStep(world, q) {
    super.afterStep(world, {
      drainContactForceEvents: (fn) =>
        q.drainContactForceEvents((e) => {
          if (
            !this.friendly(
              this.info.get(e.collider1()),
              this.info.get(e.collider2()),
            )
          )
            fn(e);
        }),
    });
  }
  bladeClash(world, pairs) {
    const all = this.fighters,
      groups = new Map();
    for (const pair of pairs) {
      const a = this.info.get(pair[0]).fighter,
        b = this.info.get(pair[1]).fighter;
      const key = [a.eventId, b.eventId].sort().join(":");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(pair);
    }
    for (const f of all)
      if (f.feel) {
        f.feel.touching = false;
        f.feel.force = 0;
      }
    for (const [key, ps] of groups) {
      const a = this.info.get(ps[0][0]).fighter,
        b = this.info.get(ps[0][1]).fighter;
      const p = this.pairStates.get(key) || {
        bladeLast: -1e9,
        bladeContact: { last: -1e9, start: 0, slide: 0, press: 0 },
      };
      this.bladeLast = p.bladeLast;
      this.bladeContact = p.bladeContact;
      this.fighters = [a, b];
      super.bladeClash(world, ps);
      this.pairStates.set(key, {
        bladeLast: this.bladeLast,
        bladeContact: this.bladeContact,
        actors: [a, b],
      });
    }
    this.fighters = all;
  }
  armSteel() {
    for (const f of this.fighters) {
      const recent = [...this.pairStates.values()].some(
        (p) =>
          p.actors?.includes(f) &&
          this.stepNo - p.bladeLast <= STEEL.rearmSteps,
      );
      const value = recent
        ? 0
        : BIND.natural
          ? Math.min(f.restitution ?? STEEL.restitution, BIND.restitution)
          : (f.restitution ?? STEEL.restitution);
      for (const c of f.swordColliders || []) {
        c.setRestitution(value);
        if (BIND.natural) c.setFriction(recent ? BIND.friction : 0.4);
      }
    }
  }
}
const partNames = {
  head: "머리",
  chest: "가슴",
  abdomen: "복부",
  pelvis: "몸통",
  uarmS: "팔",
  farmS: "팔",
  uarmO: "팔",
  farmO: "팔",
  thighF: "다리",
  shinF: "다리",
  thighB: "다리",
  shinB: "다리",
  arm: "팔",
  leg: "다리",
};
export function captureMember(f) {
  return {
    id: f.member.id,
    hp: Math.round(Math.max(0, Math.min(1, f.blood)) * 1000) / 10,
    consciousness: Math.max(0, f.consciousness),
    limbs: { ...f.limbs },
    injuries: [
      ...new Set([
        ...f.member.injuries,
        ...f.wounds.map((w) => `${partNames[w.part] || "몸"} 부상`),
      ]),
    ].slice(0, 5),
    status: !f.alive
      ? "dead"
      : f.wounds.length ||
          f.member.injuries.length ||
          f.blood < 0.98 ||
          Object.values(f.limbs).some((x) => x < 0.98)
        ? "injured"
        : "ready",
    pain: f.pain,
    wounds: f.wounds.map((w) => ({
      ...w,
      local: { x: w.local.x, y: w.local.y, z: w.local.z },
    })),
    cause: f.causeOfDeath,
    weaponBroken: !!f.weaponBroken,
    severed: (f.severed || []).map((x) => ({
      joint: x.joint,
      kind: x.kind,
      severity: x.severity,
    })),
  };
}
export function createTeamWorld(
  R,
  scene,
  pending,
  { onWound = () => {}, onClash = () => {}, autoHuman = false } = {},
) {
  const world = new R.World({ x: 0, y: PHYSICS.gravity, z: 0 });
  world.timestep = PHYSICS.timestep;
  world.integrationParameters.numSolverIterations = 6;
  const queue = new R.EventQueue(true),
    info = new Map(),
    terrain = createFordGround(R, world, GROUND_GROUPS);
  const fighters = [],
    controllers = new Map(),
    saved = pending.checkpoint?.members || [];
  for (const [team, members] of [
    [0, pending.allies],
    [1, pending.enemies],
  ])
    members.forEach((m, i) => {
      const c = CHARACTERS_BY_ID[m.id],
        f = new Fighter(R, world, scene, info, {
          index: team,
          name: shortName(m.id),
          x: team === 0 ? (pending.spawn?.x ?? -5.5) : 5.5,
          z: team===0 && i===0 && pending.spawn ? pending.spawn.z : members.length === 1 ? -.6 : i === 0 ? -1.3 : 1.8,
          terrain: TERRAIN,
          human: team===0 && i===0 && !autoHuman,
          heading: team === 0 ? 0 : Math.PI,
          look: m.id === "player" ? LOOKS.player : c.look,
          weapon: weaponOf(m),
          physiology: c?.physiology,
          vitality: c?.vitality,
        });
      f.movementSurface = TERRAIN;
      f.eventTeam = team;
      f.eventId = `${team}-${i}`;
      f.member = structuredClone(m);
      f.skill.level = 0.7;
      const snap = saved.find((x) => x.eventId === f.eventId)?.state || m;
      f.blood = snap.hp / 100;
      f.consciousness = snap.consciousness ?? 1;
      Object.assign(f.limbs, snap.limbs);
      f.member.injuries = snap.injuries || [];
      if (snap.weaponBroken) f.breakWeapon();
      for (const x of snap.severed || [])
        f.sever(
          { joint: x.joint, kind: x.kind, dist: 0 },
          { severity: x.severity || 1, energy: 0, bleedPerSev: 0 },
        );
      f.bleed = 0;
      f.pain = snap.pain || 0;
      if (snap.wounds)
        f.wounds = snap.wounds.map((w) => ({
          ...w,
          bleed: 0,
          local: new THREE.Vector3(w.local.x, w.local.y, w.local.z),
        }));
      if (snap.status === "dead") f.die(snap.cause || "이전 전투");
      // Bandaged between matches: no real-time/offline bleed; limb deficits persist.
      if (pending.checkpoint) {
        const ss = saved.find((x) => x.eventId === f.eventId);
        if (ss) {
          f.bleed = ss.bleed || 0;
          f.stamina.value = ss.stamina ?? f.stamina.value;
        }
      }
      const art = resolveSwordArt(
        f.weapon,
        { proficiency: m.skills },
        { proficiency: m.skills },
      );
      applySwordArt(f, art, { cover: false });
      fighters.push(f);
    });
  for (const [handle, item] of info) {
    world
      .getCollider(handle)
      ?.setActiveHooks(R.ActiveHooks.FILTER_CONTACT_PAIRS);
  }
  let human = fighters[0],
    guard = null,
    secret = null,
    elapsed = pending.checkpoint?.elapsed || 0;
  const active = (f) => f.alive && !f.revival;
  function enemies(f) {
    return fighters.filter((x) => x.eventTeam !== f.eventTeam && active(x));
  }
  function assign(f, target) {
    f.foe = target;
    if (!target) {
      f.move.set(0, 0);
      return;
    }
    if (f === human && !autoHuman) {
      guard = new PlayerParryGuard(f, target);
      f.stamina.controller = guard;
      f.aiControlled = false;
      f.aiCtl = null;
      controllers.delete(f);
      const school = weaponSchool(f.weapon.id),
        p = f.member.skills[school] || 0;
      secret = new PlayerSecretWatch(f, target, {
        locked: p < AI_PROFICIENCY.secretAt,
      });
      new PlayerUniqueAssist(f, { stage: p });
      f.wristK =
        schoolPassiveOn("iberian") &&
        school === "iberian" &&
        p >= SCHOOL_PASSIVE.at
          ? SCHOOL_PASSIVE.iberian.wrist
          : 1;
      f.schoolPassive?.set(p >= SCHOOL_PASSIVE.at ? school : null, {
        ai: false,
      });
    } else {
      const m = f.member,
        c = CHARACTERS_BY_ID[m.id],
        p = m.skills[weaponSchool(weaponOf(m))] || 0,
        persona = {
          ...(c?.ai?.persona || {}),
          school: weaponOf(m),
          proficiency: { ...m.skills },
        };
      controllers.set(
        f,
        new AI(f, target, AI_PROFICIENCY.levels[p] || "normal", persona),
      );
    }
  }
  fighters.forEach((f, i) => {
    const others = enemies(f);
    assign(f, others[i % 2] || others[0]);
  });
  const hits = [];
  const combat = new TeamCombat(info, {
    onWound: (a, v, r, p) => {
      hits.push({
        at: elapsed,
        attacker: a.eventId,
        victim: v.eventId,
        severity: r.severity,
        part: r.part || r.zone,
      });
      onWound(a, v, r, p);
    },
    onClash,
  });
  function step() {
    for (const f of fighters) {
      if (!active(f)) continue;
      if (pending.mode !== "explore" && (!f.foe || !active(f.foe))) {
        const targets = enemies(f).sort(
          (a, b) => distance(f, a) - distance(f, b),
        );
        assign(f, targets[0]);
      }
      if (f.foe) f.faceTarget = f.foe.bodies.pelvis.translation();
      const ctl = controllers.get(f);
      ctl?.update(PHYSICS.timestep);
      if (ctl) steerFord(ctl, PHYSICS.timestep);
    }
    secret?.update(PHYSICS.timestep, !!human.skill.sec);
    if (secret?.queued && !human.skill.sec && human.alive) {
      const o = secret.fire();
      if (o) human.skill.secret(o);
    }
    guard?.step(PHYSICS.timestep);
    for (const f of fighters) f.step(PHYSICS.timestep);
    for (const f of fighters) f.cacheState();
    world.step(queue, combat.physicsHooks);
    combat.afterStep(world, queue);
    elapsed += PHYSICS.timestep;
  }
  function distance(a, b) {
    const p = a.bodies.pelvis.translation(),
      q = b.bodies.pelvis.translation();
    return Math.hypot(p.x - q.x, p.z - q.z);
  }
  function targetNext() {
    const es = enemies(human);
    if (es.length > 1)
      assign(human, es[(es.indexOf(human.foe) + 1) % es.length]);
  }
  function result() {
    if (pending.mode === "explore") return null;
    const mine = fighters.some((f) => f.eventTeam === 0 && active(f)),
      theirs = fighters.some((f) => f.eventTeam === 1 && active(f));
    return !mine || !theirs
      ? {
          id: pending.id,
          win: mine && !theirs,
          source: "combat",
          members: fighters.filter((f) => f.eventTeam === 0).map(captureMember),
        }
      : null;
  }
  function checkpoint() {
    return {
      elapsed,
      members: fighters.map((f) => ({
        eventId: f.eventId,
        state: captureMember(f),
        bleed: f.bleed,
        stamina: f.stamina.value,
      })),
    };
  }
  return {
    world,
    terrain,
    queue,
    info,
    fighters,
    controllers,
    combat,
    hits,
    step,
    result,
    checkpoint,
    targetNext,
    get human() {
      return human;
    },
    get guard() {
      return guard;
    },
    get secret() {
      return secret;
    },
    get elapsed() {
      return elapsed;
    },
    takeControl() {
      const next = fighters.find((f) => f.eventTeam === 0 && active(f));
      if (!next || next === human) return;
      human = next;
      assign(human, enemies(human)[0]);
    },
    dispose() {
      queue.free();
      world.free();
    },
  };
}

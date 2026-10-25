import R from "@dimforge/rapier3d-compat";
import * as T from "three";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createState,
  register,
  startMatch,
  equip,
  seeded,
} from "../../src/tournament/state.js";
import { createTeamWorld } from "../../src/tournament/combat.js";
import { weaponSchool } from "../../src/tournament/catalog.js";
await R.init();
const report = [];
for (const n of [1, 2]) {
  Math.random = seeded(900 + n);
  const s = createState(42 + n);
  register(s, Date.parse("2026-10-25T22:30:00+09:00"));
  s.selected = ["player", "isolde"].slice(0, n);
  equip(s, "player", "tree_branch");
  const p = startMatch(s, s.registration.startsAt),
    g = createTeamWorld(R, new T.Scene(), p, { autoHuman: true });
  assert.equal(g.fighters.length, n + 2);
  assert.equal(g.fighters[0].weapon.id, "tree_branch");
  let maxSpeed = 0;
  for (let i = 0; i < 3600; i++) {
    g.step();
    for (const f of g.fighters) {
      assert(f.foe.eventTeam !== f.eventTeam);
      for (const b of Object.values(f.bodies)) {
        const p = b.translation();
        assert(Object.values(p).every(Number.isFinite));
        const v = b.linvel();
        maxSpeed = Math.max(maxSpeed, Math.hypot(v.x, v.y, v.z));
      }
    }
    if (g.result()) break;
  }
  assert.equal(g.hits.filter((h) => h.attacker[0] === h.victim[0]).length, 0);
  for (const f of g.fighters)
    assert.equal(f.swordArt.tradition, weaponSchool(f.weapon.id));
  const checkpoint = g.checkpoint(),
    stats = {
      n,
      seconds: g.elapsed,
      hits: g.hits.length,
      maxSpeed,
      result: g.result(),
      skills: g.fighters.map((f) => ({
        id: f.eventId,
        weapon: f.weapon.id,
        school: f.swordArt.tradition,
        proficiency:
          g.controllers.get(f)?.art?.proficiency ?? f.swordArt.proficiency,
      })),
    };
  const resumed = createTeamWorld(
    R,
    new T.Scene(),
    { ...p, checkpoint },
    { autoHuman: true },
  );
  assert.equal(resumed.elapsed, g.elapsed);
  for (let i = 0; i < g.fighters.length; i++) {
    assert(Math.abs(resumed.fighters[i].blood - g.fighters[i].blood) < 0.001);
    assert.equal(resumed.fighters[i].alive, g.fighters[i].alive);
    assert.deepEqual(resumed.fighters[i].limbs, g.fighters[i].limbs);
    assert.equal(resumed.fighters[i].weaponBroken, g.fighters[i].weaponBroken);
  }
  resumed.dispose();
  g.dispose();
  report.push(stats);
}
// Collision filtering is actor-based; all four enemy pairings remain eligible.
{
  const s = createState(8);
  register(s, Date.parse("2026-10-25T22:30:00+09:00"));
  s.selected = ["player", "isolde"];
  const g = createTeamWorld(
    R,
    new T.Scene(),
    startMatch(s, s.registration.startsAt),
  );
  const [a, b, c, d] = g.fighters,
    handle = (f, kind) =>
      [...g.info].find(([h, i]) => i.fighter === f && i.kind === kind)?.[0];
  assert.equal(g.combat.pairOf(handle(a, "weapon"), handle(b, "body")), null);
  let enemyPairs = 0;
  for (const ally of [a, b])
    for (const foe of [c, d]) {
      const target = [...g.info].find(
        ([h, i]) => i.fighter === foe && i.kind !== "weapon",
      )[0];
      assert(g.combat.pairOf(handle(ally, "weapon"), target));
      enemyPairs++;
    }
  g.fighters[0].die("test");
  g.takeControl();
  assert.equal(g.human, b);
  assert.equal(b.aiControlled, false);
  assert.equal(g.controllers.has(b), false);
  report.push({ enemyPairs, transfer: true });
  g.dispose();
}
fs.writeFileSync(
  "docs/design/tournament_20261025/physics.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));

import { test } from "node:test";
import assert from "node:assert/strict";
import * as S from "../../src/tournament/state.js";
const at = (s) => Date.parse(`2026-10-${s}+09:00`),
  reg = () => {
    const s = S.createState(42);
    S.register(s, at("25T22:30:00"));
    return s;
  };
const mem = () => {
  const d = new Map();
  return {
    getItem: (k) => d.get(k) ?? null,
    setItem: (k, v) => d.set(k, v),
    removeItem: (k) => d.delete(k),
  };
};
test("KST registration: 22 included, 02 excluded, midnight belongs to same 10am event", () => {
  for (const [time, open] of [
    ["25T21:59:59", false],
    ["25T22:00:00", true],
    ["26T00:00:00", true],
    ["26T01:59:59", true],
    ["26T02:00:00", false],
  ])
    assert.equal(S.schedule(at(time)).open, open, time);
  assert.equal(S.schedule(at("25T22:30:00")).startsAt, at("26T10:00:00"));
  assert.equal(S.schedule(at("26T01:30:00")).startsAt, at("26T10:00:00"));
});
test("cannot register outside window or twice; fixed three distinct members", () => {
  const s = S.createState(2);
  assert.throws(() => S.register(s, at("25T10:00:00")));
  assert.throws(() => S.setCompanion(s, 2, "isolde"));
  S.register(s, at("25T22:00:00"));
  assert.throws(() => S.register(s, at("25T23:00:00")));
  assert.throws(() => S.setCompanion(s, 1, "tome"));
});
test("seeded assignments survive save/reload; actual owned gear is exclusive and forced in pending battle", () => {
  const s = reg(),
    st = mem();
  S.saveState(st, s);
  assert.deepEqual(S.readState(st).roster, s.roster);
  S.equip(s, "player", "tree_branch");
  assert.throws(() => S.equip(s, "isolde", "tree_branch"));
  assert.throws(() => S.equip(s, "player", "excalibur"));
  S.toggleSelect(s, "player");
  const p = S.startMatch(s, s.registration.startsAt);
  assert.equal(S.weaponOf(p.allies[0]), "tree_branch");
  assert.throws(() => S.equip(s, "player", null));
  assert.equal(p.enemies.length, 2);
});
test("one or two selected in order, never zero/three/dead", () => {
  const s = reg(),
    n = s.registration.startsAt;
  assert.throws(() => S.startMatch(s, n));
  S.toggleSelect(s, "isolde");
  S.toggleSelect(s, "player");
  assert.throws(() => S.toggleSelect(s, "liao"));
  assert.deepEqual(S.startMatch(s, n).selected, ["isolde", "player"]);
  const one = reg();
  one.roster[2].status = "dead";
  assert.throws(() => S.toggleSelect(one, "liao"));
  S.toggleSelect(one, "player");
  assert.equal(S.startMatch(one, n).allies.length, 1);
});
test("10am unlock; late start never forfeits; next match is two hours after saved result, including overnight", () => {
  const s = reg();
  S.toggleSelect(s, "player");
  assert.throws(() => S.startMatch(s, at("26T09:59:59")));
  const p = S.startMatch(s, at("27T23:00:00"));
  assert.equal(S.startMatch(s, at("27T23:01:00")).id, p.id);
  const result = {
    id: p.id,
    win: true,
    members: [
      {
        ...p.allies[0],
        hp: 73,
        status: "injured",
        injuries: ["팔 부상"],
        limbs: { armS: 0.5, armO: 1, legF: 1, legB: 1 },
      },
    ],
  };
  assert.equal(S.settle(s, result, at("27T23:40:00")), true);
  assert.equal(S.availableAt(s), at("28T01:40:00"));
  S.toggleSelect(s, "liao");
  assert.throws(() => S.startMatch(s, at("28T01:39:59")));
  assert.equal(S.startMatch(s, at("28T01:40:00")).allies[0].id, "liao");
  assert.equal(s.roster[0].hp, 73);
  assert.equal(s.roster[1].hp, 100);
});
test("invalid, incomplete or repeated results cannot progress bracket twice", () => {
  const s = reg();
  S.toggleSelect(s, "player");
  const p = S.startMatch(s, s.registration.startsAt),
    r = { id: p.id, win: true, members: p.allies };
  assert.throws(() =>
    S.settle(s, { ...r, id: "wrong" }, s.registration.startsAt),
  );
  assert.throws(() =>
    S.settle(s, { ...r, members: [] }, s.registration.startsAt),
  );
  assert.throws(() =>
    S.settle(
      s,
      { ...r, members: [{ ...p.allies[0], hp: NaN }] },
      s.registration.startsAt,
    ),
  );
  S.settle(s, r, s.registration.startsAt);
  const snapshot = structuredClone(s);
  assert.equal(S.settle(s, r, s.registration.startsAt + 99), false);
  assert.deepEqual(s, snapshot);
});
test("three actual wins complete bracket; one loss ends event", () => {
  for (const win of [true, false]) {
    const s = reg();
    for (let r = 0; r < 3; r++) {
      S.toggleSelect(s, "player");
      const p = S.startMatch(s, S.availableAt(s));
      S.settle(
        s,
        { id: p.id, win, members: p.allies },
        S.availableAt(s) + 60000,
      );
      if (!win) break;
    }
    assert.equal(s.phase, win ? "champion" : "eliminated");
    assert.throws(() => S.startMatch(s, at("29T10:00:00")));
    assert.equal(s.history.length, win ? 3 : 1);
  }
});
test("stale revision and quota failure cannot silently commit", () => {
  const st = mem(),
    s = S.createState(42);
  S.saveState(st, s);
  const old = structuredClone(s);
  S.saveState(st, s);
  assert.throws(() => S.saveState(st, old));
  const rev = s.revision;
  assert.throws(() =>
    S.saveState(
      {
        getItem: st.getItem,
        setItem: () => {
          throw Error("quota");
        },
      },
      s,
    ),
  );
  assert.equal(s.revision, rev);
});

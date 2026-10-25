import { chromium } from "playwright";
import fs from "node:fs/promises";
const out = "docs/design/tournament_20261025",
  errors = [],
  bad = [],
  report = { screens: [], checks: [] };
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  headless: true,
});
const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  }),
  page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.stack));
page.on("response", (r) => {
  if (r.status() >= 400) bad.push([r.status(), r.url()]);
});
await page.addInitScript(() => {
  if (!localStorage.getItem("stillness.tournament.preview.v1"))
    localStorage.setItem("campaign-sentinel", "unchanged");
});
await page.goto(
  process.env.TOURNAMENT_URL || "http://localhost:5468/tournament.html",
);
await page.waitForFunction(() => !!window.oathTest);
await page.evaluate(() =>
  window.oathTest.setClock(Date.parse("2026-10-25T22:30:00+09:00")),
);
await page.screenshot({ path: `${out}/lobby.png`, fullPage: true });
await page.locator("#enterTournament").click();
await page.evaluate(() =>
  window.oathTest.setClock(Date.parse("2026-10-26T10:00:01+09:00")),
);
await page.locator("[data-equip=player]").selectOption("tree_branch");
await page.locator("[data-select=player]").click();
await page.locator("[data-select=isolde]").click();
await page.locator("[data-select=liao]").click();
report.checks.push([
  "maxTwo",
  await page.evaluate(() => window.oathTest.state.selected.length === 2),
]);
await page.evaluate(
  () => (document.getElementById("globalStatus").textContent = ""),
);
for (const [w, h] of [
  [1280, 900],
  [844, 390],
  [390, 844],
  [320, 568],
]) {
  await page.setViewportSize({ width: w, height: h });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${out}/bracket-${w}.png`, fullPage: true });
  report.screens.push({
    w,
    h,
    ...(await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
      brokenImages: [...window.oathTest.root.querySelectorAll("img")]
        .filter((i) => !i.complete || !i.naturalWidth)
        .map((i) => i.src),
    }))),
  });
}
await page.setViewportSize({ width: 844, height: 390 });
await page.locator("#battleEnter").click();
await page.waitForFunction(() => !!window.oathTest.battle);
report.checks.push([
  "fourFightersAndForcedWeapon",
  await page.evaluate(() => {
    const g = window.oathTest.battle.G;
    return (
      g.fighters.length === 4 &&
      g.human.weapon.id === "tree_branch" &&
      g.fighters.every((f) => f.foe.eventTeam !== f.eventTeam)
    );
  }),
]);
await page.locator("#battleGo").click();
await page.keyboard.down("KeyW");
await page.waitForTimeout(2000);
await page.keyboard.up("KeyW");
await page
  .locator("#guardButton")
  .dispatchEvent("pointerdown", { pointerId: 17 });
await page.waitForTimeout(2000);
report.checks.push([
  "guardInput",
  await page.evaluate(() => window.oathTest.battle.G.guard.held),
]);
await page
  .locator("#guardButton")
  .dispatchEvent("pointerup", { pointerId: 17 });
await page.mouse.click(550, 180);
await page.mouse.move(650, 170);
await page.mouse.down();
await page.mouse.move(390, 220, { steps: 8 });
await page.mouse.up();
await page.waitForFunction(
  () =>
    window.oathTest.battle.G.elapsed > 9 ||
    window.oathTest.state.history.length > 0,
  {},
  { timeout: 60000 },
);
await page.screenshot({ path: `${out}/battle-844.png` });
report.physics = await page.evaluate(() => {
  const g = window.oathTest.battle.G;
  return {
    seconds: g.elapsed,
    hits: g.hits.length,
    friendlyHits: g.hits.filter((h) => h.attacker[0] === h.victim[0]).length,
    actors: g.fighters.map((f) => ({
      id: f.eventId,
      hp: f.blood,
      weapon: f.weapon.id,
      foe: f.foe?.eventId,
      pos: f.bodies.pelvis.translation(),
    })),
  };
});
await page.locator("#battlePause").click();
await page.locator("#leaveBattle").click();
report.checks.push([
  "checkpointSaved",
  await page.evaluate(
    () => window.oathTest.state.pending.checkpoint.elapsed > 0,
  ),
]);
const pending = await page.evaluate(() => window.oathTest.state.pending.id);
await page.reload();
await page.waitForFunction(() => !!window.oathTest);
await page.locator("#enterTournament").click();
await page.locator("#battleEnter").click();
await page.waitForFunction(() => !!window.oathTest.battle);
report.checks.push([
  "resumeSameMatch",
  await page.evaluate(
    (id) =>
      window.oathTest.state.pending.id === id &&
      window.oathTest.battle.G.elapsed > 0,
    pending,
  ),
]);
await page.locator("#battleGo").click();
await page.evaluate(() =>
  window.oathTest.battle.G.fighters
    .filter((f) => f.eventTeam === 1)
    .forEach((f) => f.die("검사 전용 종료")),
);
await page.waitForFunction(() => window.oathTest.state.history.length === 1);
report.checks.push(["automaticResultSave", true]);
await page.locator("#saveResult").click();
report.checks.push([
  "savedWinLockedTwoHours",
  await page.evaluate(
    () =>
      window.oathTest.state.history.length === 1 &&
      window.oathTest.state.phase === "waiting" &&
      window.oathTest.root.getElementById("battleEnter").disabled,
  ),
]);
await page.evaluate(() =>
  window.oathTest.setClock(
    window.oathTest.state.history.at(-1).completedAt + 7200001,
  ),
);
await page.locator("[data-select=liao]").click();
await page.locator("#battleEnter").click();
await page.waitForFunction(() => !!window.oathTest.battle);
report.checks.push([
  "oneVersusTwo",
  await page.evaluate(() => window.oathTest.battle.G.fighters.length === 3),
]);
await page.evaluate(() => window.oathTest.demoResult(false));
report.checks.push([
  "defeatEndsTournament",
  await page.evaluate(() => window.oathTest.state.phase === "eliminated"),
]);
report.checks.push([
  "campaignUntouched",
  await page.evaluate(
    () => window.__oathStorage.getItem("campaign-sentinel") === "unchanged",
  ),
]);
report.errors = errors;
report.bad = bad;
await fs.writeFile(`${out}/browser.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
await browser.close();

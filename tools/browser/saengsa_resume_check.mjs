// 생사전 몸 상태 이어받기 — 엔진 길 넷 점검 (사장님 10/30 08:2x '몸 상태 이어받기 방랑 · 생사전 둘 다 켜.' — SAENGSA.resumeState · main.js saveTeamBodies · src/fight_snapshot.js)
//  시험 페이지 빌드(/saengsa/)를 띄우고: node tools/browser/saengsa_resume_check.mjs http://127.0.0.1:<port> <사진 폴더> [씨앗 11]
//  넷 다 AI(지켜보기) · 넷 다 레이피어 판을 game.launchSaengsa 로 바로 세워 → 넷 모두 새 상처를 입을 때까지(죽는 사람이 나오면 그만 — 편 전멸 전에) 싸우고 → 정지 → 대기실(그만둠 = null · resumeSave 로 넷의 사본)
//  → 같은 setup + resume 로 다시 세워 첫 모습의 넷(피 · 상처 부위 · 산 몸 · 부러짐)이 떠날 때와 같은가 · 그 판을 몇 초 더 싸워 다시 그만두고 다시 → 또 같은가(두 번 이어받기 — 상처가 쌓임)
//  (생사전 화면 길 — 고르기 · 무기 잠금 · 대회 저장 · 결과 뒤 지움 — 은 saengsa_engine_e2e.mjs ⑥)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { VITALS } from '../../src/config.js'; // 쓰러지는 피 문턱 (이어받기 견줌 — 문턱 바로 위에서 떠난 몸은 다시 선 첫 스텝들에 죽을 수 있음)
const base = process.argv[2] || 'http://127.0.0.1:5392', out = process.argv[3] || 'dist/saengsa_resume', seed = +(process.argv[4] ?? 11);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true });
await ctx.route('https://*.supabase.co/**', (route) => route.abort());
const p = await ctx.newPage();
const errors = [], log = [], saved = [];
const IGNORED = /deprecated parameters for the initialization function/;
p.on('pageerror', (e) => errors.push(String(e.stack || e).split('\n').slice(0, 3).join(' | ')));
p.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(m.text()); });
await p.clock.install({ time: new Date('2026-10-30T15:00:00+09:00') });
const run = (ms) => p.clock.runFor(ms);
const until = async (fn, step = 100, max = 600, arg) => { for (let i = 0; i < max; i++) { if (await p.evaluate(fn, arg)) return true; await run(step); } return false; };
const render = (on) => p.evaluate((v) => { if (window.game?.renderCap) window.game.renderCap.tick = () => v; }, on);
const shot = async (name) => { await render(true); await run(80); const path = `${out}/${name}.png`; try { await p.screenshot({ path, timeout: 20000 }); saved.push(path); } catch (e) { errors.push(`사진 ${name}: ${e.message.split('\n')[0]}`); } await render(false); };
const look = () => p.evaluate(() => ({ over: !!window.game.teamRun?.M.over, sim: +window.game.stats.simTime.toFixed(1),
  hud: [...document.querySelectorAll('#teamHud .tl-n')].map((e) => e.textContent),
  fighters: window.game.fighters.map((f) => ({ name: f.name, blood: +f.blood.toFixed(3), bleed: +(f.bleed ?? 0).toFixed(3), parts: (f.wounds ?? []).map((w) => w.part).join(','), fresh: (f.wounds ?? []).filter((w) => !w.carried).length, carried: (f.wounds ?? []).filter((w) => w.carried).length, broken: !!f.weaponBroken, alive: f.alive })) }));
const W = { matchId: 'resume-check', round: 1, seed, mineSide: 'a', control: 'watch', entrants: { a: ['0-1', '0-2'], b: ['5-0', '5-1'] },
  sides: {
    a: [{ key: '0-1', id: 'nameless', tag: '오토', weapon: 'rapier', school: 'italian', tier: 1, prof: { italian: 2 }, hp: 100, injuries: [], dead: false, cloth: 2 },
      { key: '0-2', id: 'nameless', tag: '한스', weapon: 'rapier', school: 'italian', tier: 1, prof: { italian: 2 }, hp: 80, injuries: [{ part: 'arm', sev: 0.3, rests: 0 }], dead: false, cloth: 4 }],
    b: [{ key: '5-0', id: 'heinrich', weapon: 'rapier', school: 'italian', tier: 1, prof: { italian: 2 }, hp: 100, injuries: [], dead: false },
      { key: '5-1', id: 'margarethe', weapon: 'rapier', school: 'italian', tier: 1, prof: { italian: 2 }, hp: 100, injuries: [], dead: false }] } };
async function launch(resume) {
  await p.evaluate(({ setup, resume }) => { window.__rb = null; window.__rr = 'pending'; window.game.launchSaengsa({ ...setup, ...(resume ? { resume } : {}), resumeSave: (b) => (window.__rb = b) }).then((r) => (window.__rr = r)); }, { setup: W, resume });
  if (!(await until(() => window.game?.state === 'fight' && !!window.game.teamRun, 50, 800))) throw new Error('판이 서지 않음');
  await render(false);
  return look();
}
async function quit() {
  await p.evaluate(() => document.getElementById('btnPause').click());
  const L = await look();
  await run(300);
  await p.evaluate(() => document.getElementById('btnLobby').click());
  await until(() => window.__rr !== 'pending', 100, 100);
  return { L, bodies: await p.evaluate(() => window.__rb), res: await p.evaluate(() => window.__rr) };
}
const compare = (a, b) => a.fighters.map((f, i) => { const g = b.fighters[i]; return { name: f.name, leave: `${f.blood}/${f.parts || '-'}/${f.alive ? '삶' : '죽음'}`, back: `${g.blood}/${g.parts || '-'}/${g.alive ? '삶' : '죽음'}`, ok: g.name === f.name && g.blood <= f.blood + 0.002 && f.blood - g.blood <= 0.02 + (f.bleed ?? 0) * 0.3 && g.parts === f.parts && (g.alive === f.alive || (f.alive && !g.alive && g.blood < VITALS.collapseBlood)) && g.broken === f.broken }; }); // 피: 이어받은 출혈만큼 줄 수 있음
try {
  await p.goto(`${base}/saengsa/`, { waitUntil: 'domcontentloaded' });
  if (!(await until(() => typeof window.game?.launchSaengsa === 'function' && !!window.game?.renderCap, 100, 1500))) throw new Error('게임이 안 섬');
  let L = await launch(null);
  let bodies = null;
  for (let cycle = 1; cycle <= 3; cycle++) {
    // 넷 모두 새 상처를 입을 때까지 (죽은 사람이 나와도 — 편이 다 죽기 전 · 한 편에 산 사람이 하나뿐이면 그만: 한 번 더 죽으면 판이 끝나 이어받을 몸이 없음)
    const lastOne = (L) => [0, 1].some((t) => L.fighters.filter((f, i) => (i % 2 === t) && f.alive).length <= 1) && L.fighters.some((f) => !f.alive);
    for (let i = 0; i < 240 && !L.over && L.fighters.filter((f) => f.fresh > 0).length < 4 && !(lastOne(L) && L.fighters.filter((f) => f.fresh > 0).length >= 3); i++) { await run(250); L = await look(); }
    if (L.over) throw new Error(`판이 끝남 (${cycle} 번째)`);
    await shot(`r${cycle}_leave`);
    const q = await quit();
    bodies = q.bodies;
    const back = await launch(bodies);
    await shot(`r${cycle}_back`);
    const cmp = compare(q.L, back);
    log.push({ cycle, sim: q.L.sim, quitResult: q.res, saved: bodies ? Object.keys(bodies) : null, hurt: q.L.fighters.filter((f) => f.fresh > 0).length, hud: back.hud, bodies: cmp, allSame: cmp.length === 4 && cmp.every((x) => x.ok) });
    L = back;
    if (q.L.fighters.filter((f) => f.fresh > 0).length >= 4 || lastOne(q.L)) break;
  }
  await quit();
} catch (e) {
  errors.push('harness: ' + e.message.split('\n')[0]);
}
await browser.close();
fs.writeFileSync(`${out}/resume_check.json`, JSON.stringify({ saved, log, errors }, null, 1));
for (const l of log) console.log(JSON.stringify(l));
console.log(errors.length ? errors.join('\n') : 'no page errors');

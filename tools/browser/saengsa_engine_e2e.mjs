// 생사전 ↔ 실제 2:2 싸움 끝까지 (docs/design/saengsa_2026-10-29.md §8 · 감독 10/29 — 내 경기는 엔진 · 상대끼리는 빠른 셈)
//  시험 페이지 빌드(/saengsa/ — 저장 가르기 · 시간 제한 없음)를 띄우고 playwright 시계로 빨리 돌린다(싸움 그리기는 사진 때만 — tools/browser/team_smoke.mjs 와 같은 틀)
//  ① 신청(나 · 무명 검객 둘 · 무기 배정) → ② '지켜보기' 경기(동료 둘만 나섬 — 넷 다 AI): 판이 서고 → 끝나고 → 생사전 화면에 결과가 적히고 대진표가 넘어가는지
//  ③ '내가 나섬' 경기: 저장을 고쳐 동료 체력 55 · 다리 부상 · 내 무기 부러짐을 넣고 → 판에 그대로 서는지(피 · 닫힌 상처 · 무기 · 사람 몸 · 부러짐 표시) → 정지 창 '대기실'로 그만두면 결과 없음(아직 하지 않은 경기)
//  ⑤ 체력 목록 짧은 이름 (사장님 10/30 01:0x — wk/team-fight 61f13e9b): 판마다 왼쪽 위 이름이 짧은 이름(나 · 무명 검객은 붙인 이름만 · 얼터 'A.' + 본캐)인가 ·
//    끝에 game.launchSaengsa 를 바로 불러 나 · 무명 검객 '오토' 대 광기의 미나미 · 롤랑 판을 세워 'A.미나미' · '오토' · '나' 를 본다(정지 → 대기실로 그만둠)
//  ⑥ 몸 상태 이어받기 (사장님 10/30 08:2x '몸 상태 이어받기 방랑 · 생사전 둘 다 켜.' — SAENGSA.resumeState): ③ 에서 몇 사람이 다칠 때까지 싸운 뒤 '대기실'로 그만두면 대회 저장에 넷의 몸 사본 ·
//    ④ 다시 들어갈 때 고르기 · 무기 배정이 잠기고(같은 사람 · 같은 무기) 첫 모습의 넷 몸(피 · 상처 부위 · 산 몸 · 부러짐)이 떠날 때와 같은가 · 끝까지 싸우면 결과가 적히고 사본이 지워지는가
//  node tools/browser/saengsa_engine_e2e.mjs http://127.0.0.1:<port> <사진 폴더>   (빌드 · 띄우기는 saengsa_testpage_play.mjs 머리 글)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { VITALS } from '../../src/config.js'; // 쓰러지는 피 문턱 (이어받기 견줌 — 문턱 바로 위에서 떠난 몸은 다시 선 첫 스텝들에 죽을 수 있음)
const base = process.argv[2] || 'http://127.0.0.1:5392', out = process.argv[3] || 'dist/saengsa_engine';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true }); // 그리기가 무거워(swiftshader) 1 배 · 폰 흉내(전체 화면 · 가로 잠금)는 끔
await ctx.route('https://*.supabase.co/**', (route) => route.abort());
const p = await ctx.newPage();
const errors = [], log = [], saved = [];
const IGNORED = /deprecated parameters for the initialization function/;
p.on('pageerror', (e) => errors.push(String(e.stack || e).split('\n').slice(0, 3).join(' | ')));
p.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(m.text()); });
await p.clock.install({ time: new Date('2026-10-30T15:00:00+09:00') });
const run = (ms) => p.clock.runFor(ms);
const until = async (fn, step = 100, max = 600, arg) => { for (let i = 0; i < max; i++) { if (await p.evaluate(fn, arg)) return true; await run(step); } return false; };
const inRoot = (body) => p.evaluate(new Function(`const root=document.querySelector('#gameEntrance').shadowRoot;${body}`));
const tap = async (sel) => { await p.locator(sel).first().waitFor({ state: 'visible', timeout: 20000 }); await p.locator(sel).first().tap(); await run(60); };
const render = (on) => p.evaluate((v) => { if (window.game?.renderCap) window.game.renderCap.tick = () => v; }, on);
const shot = async (name, fight = false) => { if (fight) { await render(true); await run(80); } else await run(250); const path = `${out}/${name}.png`; await p.screenshot({ path }); saved.push(path); if (fight) await render(false); };
const fightLook = () => p.evaluate(() => {
  const R = window.game.teamRun;
  return { state: window.game.state, over: !!R?.M.over, sim: +window.game.stats.simTime.toFixed(1), human: R?.human?.index ?? null,
    hud: [...document.querySelectorAll('#teamHud .tl-n')].map((e) => e.textContent), // 왼쪽 위 이름 · 체력 목록 (wk/team-fight ecacc60b · v3 짧은 이름 61f13e9b)
    rows: [...document.querySelectorAll('#teamList .tl-row')].map((r) => [...r.querySelectorAll('.tl-n')].map((e) => e.textContent)), // 줄마다 (첫 줄 상대 · 둘째 줄 아군)
    bars: [...document.querySelectorAll('#teamList .tl-b > span')].map((e) => getComputedStyle(e).backgroundColor),
    fighters: window.game.fighters.map((f) => ({ name: f.name, team: f.team, weapon: f.weapon.id, broken: !!f.weaponBroken, blood: +f.blood.toFixed(3), bleed: +(f.bleed ?? 0).toFixed(3), carried: (f.wounds ?? []).filter((w) => w.carried).map((w) => `${w.part}:${w.severity}`), parts: (f.wounds ?? []).map((w) => w.part).join(','), fresh: (f.wounds ?? []).filter((w) => !w.carried).length, alive: f.alive })) };
});
/** 판 하나 (전투 입장 → 판 → 끝) — 돌려줌: 시작 · 끝 모습 */
async function playOut(tag, { quit = false, hurt = 0 } = {}) {
  await tap('#sgFight');
  if (!(await until(() => window.game?.state === 'fight' && !!window.game.teamRun, 50, 800))) throw new Error(`${tag}: 판이 서지 않음`);
  await render(false);
  const first = await fightLook(); // 판이 선 첫 모습 (이어받은 몸 견줌 — 첫 스텝 즈음)
  await run(1500);
  const start = await fightLook();
  await shot(`${tag}_start`, true);
  if (quit) {
    let L = start; // hurt 명이 새 상처를 입을 때까지 싸운 뒤 그만둠 (판이 끝나기 전 · 40 게임 초까지)
    const someoneDown = (L) => L.fighters.some((f) => !f.alive); // 누가 죽으면 그만 (편 전멸로 판이 끝나기 전에)
    for (let i = 0; i < 80 && hurt && !L.over && !someoneDown(L) && L.fighters.filter((f) => f.fresh > 0).length < hurt; i++) { await run(500); L = await fightLook(); }
    await p.evaluate(() => document.getElementById('btnPause').click());
    const leave = await fightLook(); // 멈춘 몸 (정지 동안 흐르지 않음)
    await run(300);
    await shot(`${tag}_pause`, true);
    await p.evaluate(() => document.getElementById('btnLobby').click());
    await run(500);
    return { first, start, leave };
  }
  let L = start, mid = false;
  while (!L.over && L.sim < 300) { await run(2000); L = await fightLook(); if (!mid && L.sim > 12) { mid = true; await shot(`${tag}_mid`, true); } }
  if (L.over) await shot(`${tag}_end`, true);
  await until(() => window.game?.state !== 'fight', 250, 80);
  return { first, start, end: L };
}
/** 짧은 이름 점검: 목록 이름 = 몸마다 shortName · '무명 검객' · '광기의' · 띄어쓰기 없음 · 내가 나서면 '나' */
const shortCheck = (L) => ({ hud: L.hud, rows: L.rows, ok: L.hud.length === L.fighters.length && L.hud.every((n) => n && !/무명 검객|광기의|\s/.test(n)) && (L.human == null) === !L.hud.includes('나') });
const saved_ = () => p.evaluate(() => JSON.parse(localStorage.getItem('stillness.saengsa.v1'))); // 시험판 저장(열쇠 앞 stillness.test. — 페이지 안에서는 그대로 읽힘)

try {
  await p.goto(`${base}/saengsa/`, { waitUntil: 'domcontentloaded' });
  if (!(await until(() => !!document.querySelector('#gameEntrance')?.shadowRoot?.getElementById('saengsaHost')?.offsetParent, 100, 1500))) throw new Error('대기실 생사전 칸이 안 뜸');
  for (let i = 0; i < 4; i++) {
    const id = await inRoot(`const d=[...root.querySelectorAll('dialog[open]')][0];return d?d.querySelector('.dialog-actions button')?.id??null:null;`);
    if (!id) break;
    await tap(`#${id}`);
  }
  // ① 신청
  await tap('.sg-slot[data-slot="0"]'); await tap('.sg-chip-btn[data-weapon="longsword"]'); await tap('#sgPickOk');
  await tap('.sg-slot[data-slot="1"]'); await tap('.sg-pick[data-id="nameless"]'); await tap('.sg-chip-btn[data-weapon="rapier"]'); await tap('#sgPickOk');
  await tap('.sg-slot[data-slot="2"]'); await tap('.sg-pick[data-id="nameless"]'); await tap('.sg-chip-btn[data-weapon="uchigatana"]'); await tap('#sgPickOk');
  await tap('#saengsaEnter');
  await until(() => !!document.querySelector('#gameEntrance').shadowRoot.querySelector('.sg-m[data-state="ready"]'), 100, 300);
  await shot('e1_bracket');
  // ② 지켜보기 경기: 동료 둘만
  const m1 = await inRoot(`return root.querySelector('.sg-m[data-state="ready"]').dataset.match;`);
  await tap(`.sg-m[data-match="${m1}"]`);
  await tap('button.sg-card[data-key="0-1"]'); await tap('button.sg-card[data-key="0-2"]');
  await shot('e2_watch_pick');
  const before1 = await saved_();
  const w = await playOut('e3_watch');
  await until(() => !document.querySelector('#gameEntrance').shadowRoot.getElementById('sgDone').hidden, 100, 100);
  await shot('e4_watch_result');
  const after1 = await saved_();
  const r1 = after1.current.matches.find((m) => m.id === m1).result;
  log.push({ step: 'watch', control: w.start.human == null ? 'watch' : 'player', short: shortCheck(w.start), hud: w.start.hud, start: w.start.fighters, end: w.end?.fighters?.map((f) => `${f.name}:${f.alive ? '삶' : '죽음'}`), sim: w.end?.sim,
    recorded: !!r1, by: r1?.by, winner: r1?.winner, fighters: r1 && Object.fromEntries(Object.entries(r1.fighters).map(([k, v]) => [k, `${v.hp}/${v.alive ? '삶' : '죽음'}/${v.injuries.map((i) => `${i.part}${i.sev}`).join(',')}${v.broken ? '/부러짐' : ''}`])),
    resultsBefore: before1.current.matches.filter((m) => m.result).length, resultsAfter: after1.current.matches.filter((m) => m.result).length });
  await tap('#sgDone');
  await shot('e5_bracket_after');
  const out1 = await inRoot(`return { next: root.getElementById('sgNext').textContent, nextCup: !root.getElementById('sgNextCup').hidden, ready: root.querySelector('.sg-m[data-state="ready"]')?.dataset.match ?? null };`);
  log.push({ step: 'bracket', ...out1 });
  if (!out1.ready) { await tap('#sgNextCup'); await until(() => !!document.querySelector('#gameEntrance').shadowRoot.querySelector('.sg-m[data-state="ready"]'), 100, 100); }
  // ③ 내가 나섬: 저장에 동료 체력 55 · 다리 부상 · 내 롱소드 부러짐을 넣고 화면을 새로
  await p.evaluate(() => {
    const k = 'stillness.saengsa.v1', s = JSON.parse(localStorage.getItem(k)), t = s.current, me = t.teams[0].members;
    Object.assign(me[1], { hp: 55, injuries: [{ part: 'leg', sev: 0.3, rests: 0 }], dead: false });
    t.broken = [...new Set([...(t.broken ?? []), me[0].weapon])];
    me[0].broken = true;
    localStorage.setItem(k, JSON.stringify(s));
  });
  await tap('#sgBack'); await until(() => !!document.querySelector('#gameEntrance').shadowRoot.getElementById('saengsaHost')?.offsetParent, 100, 100);
  await tap('#saengsaEnter'); await until(() => !!document.querySelector('#gameEntrance').shadowRoot.querySelector('.sg-m[data-state="ready"]'), 100, 100);
  const m2 = await inRoot(`return root.querySelector('.sg-m[data-state="ready"]').dataset.match;`);
  await tap(`.sg-m[data-match="${m2}"]`);
  await tap('button.sg-card[data-key="0-0"]'); await tap('button.sg-card[data-key="0-1"]');
  await shot('e6_player_pick');
  const pl = await playOut('e7_player', { quit: true, hurt: 4 });
  await until(() => !!document.querySelector('#gameEntrance')?.shadowRoot?.getElementById('sgMatch') && !document.querySelector('#gameEntrance').shadowRoot.getElementById('sgMatch').hidden, 100, 50);
  await shot('e8_player_quit');
  const after2 = await saved_();
  const r2 = after2.current.matches.find((m) => m.id === m2);
  const status = await inRoot(`return root.getElementById('sgStatus').textContent;`);
  log.push({ step: 'player', control: pl.start.human == null ? 'watch' : 'player', short: shortCheck(pl.start), hud: pl.start.hud, start: pl.start.fighters, quitRecorded: !!r2.result, stillReady: await inRoot(`return root.getElementById('sgFight').hidden === false;`), status });
  // ⑥ 몸 상태 이어받기: 그만둔 경기의 넷 몸 사본 · 다시 들어갈 때 잠금
  const resumeSaved = after2.current.resume ?? null;
  const lock = await inRoot(`return { pickButtons: root.querySelectorAll('#sgCardsB button.sg-card').length, entrants: [...root.querySelectorAll('#sgCardsB .sg-card[data-entrant]')].map((c) => c.dataset.key), armBtn: !root.getElementById('sgArmBtn').hidden, hint: root.getElementById('sgHint').textContent };`);
  await shot('e8b_resume_locked');
  // ④ 같은 경기를 다시 끝까지 (내 몸은 서 있기만 — 동료 · 상대 AI 가 판을 끝냄): 결과의 broken 이 적히고 부러진 내 무기가 대회 끝까지 남는가 · 떠날 때 몸으로 서는가
  const pf = await playOut('e9_player_full');
  const same = pl.leave.fighters.map((f, i) => { const g = pf.first.fighters[i]; return { name: f.name, bleed: f.bleed, leave: `${f.blood}/${f.parts || '-'}/${f.alive ? '삶' : '죽음'}${f.broken ? '/부러짐' : ''}`, back: `${g.blood}/${g.parts || '-'}/${g.alive ? '삶' : '죽음'}${g.broken ? '/부러짐' : ''}`, ok: g.name === f.name && g.blood <= f.blood + 0.002 && f.blood - g.blood <= 0.02 + (f.bleed ?? 0) * 0.3 && g.parts === f.parts && (g.alive === f.alive || (f.alive && !g.alive && g.blood < VITALS.collapseBlood)) && g.broken === f.broken }; }); // 피: 이어받은 출혈만큼 줄 수 있음(첫 모습은 판이 선 뒤 몇 스텝 — 죽은 몸도 피를 흘림)
  log.push({ step: 'resume', saved: !!resumeSaved && { picks: resumeSaved.picks, arms: resumeSaved.arms, keys: Object.keys(resumeSaved.bodies ?? {}) }, lock, bodies: same, allSame: same.length === 4 && same.every((x) => x.ok), hurt: pl.leave.fighters.filter((f) => f.fresh > 0).length });
  await until(() => !document.querySelector('#gameEntrance').shadowRoot.getElementById('sgDone').hidden, 100, 100);
  await shot('e10_player_result');
  const after3 = await saved_();
  const r3 = after3.current.matches.find((m) => m.id === m2).result;
  log.push({ step: 'player_full', sim: pf.end?.sim, recorded: !!r3, by: r3?.by, winner: r3?.winner,
    resultBroken: r3 && Object.fromEntries(Object.entries(r3.fighters).map(([k, v]) => [k, !!v.broken])),
    cupBroken: after3.current.broken, mineBroken: after3.current.teams[0].members.map((f) => `${f.weapon}${f.broken ? ':부러짐' : ''}`),
    foePoolBroken: after3.current.teams.filter((x) => !x.mine && x.pool?.some((w) => w.broken)).map((x) => x.pool.filter((w) => w.broken).map((w) => w.weapon)),
    resumeCleared: after3.current.resume === undefined });
  // ⑤ 짧은 이름 — 얼터 · 손님 · 무명 검객 · 나 를 한 판에 (game.launchSaengsa 바로 · 정지 → 대기실로 그만둠 = null)
  await tap('#sgDone');
  const SETUP = { matchId: 'e2e-short', round: 1, seed: 7, mineSide: 'a', control: 'player', entrants: { a: ['0-0', '0-1'], b: ['5-0', '5-1'] },
    sides: {
      a: [{ key: '0-0', id: 'player', weapon: 'longsword', school: 'german', tier: 1, prof: { german: 1 }, hp: 100, injuries: [], dead: false },
        { key: '0-1', id: 'nameless', tag: '오토', weapon: 'rapier', school: 'italian', tier: 1, prof: { italian: 2 }, hp: 100, injuries: [], dead: false, cloth: 2 }],
      b: [{ key: '5-0', id: 'minami_mad', weapon: 'muramasa', school: 'japanese', tier: 2, prof: { japanese: 6 }, hp: 100, injuries: [], dead: false },
        { key: '5-1', id: 'roland', weapon: 'durandal', school: 'iberian', tier: 4, prof: { iberian: 6 }, hp: 100, injuries: [], dead: false }] } };
  await p.evaluate((setup) => { window.__short = 'pending'; window.game.launchSaengsa(setup).then((r) => (window.__short = r)); }, SETUP);
  if (!(await until(() => window.game?.state === 'fight' && !!window.game.teamRun, 50, 800))) throw new Error('short: 판이 서지 않음');
  await render(false);
  await run(1500);
  const sh = await fightLook();
  await shot('e11_short_names', true);
  await p.evaluate(() => document.getElementById('btnPause').click());
  await run(300);
  const pauseMenu = await p.evaluate(() => ({ restart: !document.getElementById('btnStart').hidden, lobby: !document.getElementById('btnLobby').hidden }));
  await p.evaluate(() => document.getElementById('btnLobby').click());
  await until(() => window.__short !== 'pending', 100, 100);
  log.push({ step: 'short_names', short: shortCheck(sh), want: ['나', '오토', 'A.미나미', '롤랑'], same: ['나', '오토', 'A.미나미', '롤랑'].every((n) => sh.hud.includes(n)), bars: sh.bars, pauseMenu, quitResult: await p.evaluate(() => window.__short) });
  // ⑦ 넷 다 AI 판 엔진 길 이어받기(넷 모두 다친 몸)는 tools/browser/saengsa_resume_check.mjs
} catch (e) {
  errors.push('harness: ' + e.message.split('\n')[0]);
}
await browser.close();
fs.writeFileSync(`${out}/engine_e2e.json`, JSON.stringify({ saved, log, errors }, null, 1));
for (const l of log) console.log(JSON.stringify(l));
console.log(errors.length ? errors.join('\n') : 'no page errors');

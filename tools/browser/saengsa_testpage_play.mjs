// 생사전 시험 페이지 한 바퀴 (docs/design/saengsa_2026-10-29.md §12 — 사장님 10/29 17:5x 시험 페이지 · 18:2x 무기 배정 · 내 경기 = 실제 2:2 싸움)
//  빌드: npx vite build --config tools/saengsa_page/vite.config.mjs --base=./ --outDir <site>/saengsa --emptyOutDir
//  띄우기: python3 -m http.server <port> --directory <site>  →  node tools/browser/saengsa_testpage_play.mjs http://127.0.0.1:<port> <사진 폴더>
//  ① 같은 출처에 본 게임 저장(금화 · 생사전 · 장비)을 먼저 적어 둔다 → /saengsa/ 를 열면 첫 화면을 건너 대기실 생사전 칸
//  ② 나 · 동료 둘 고르기 + 세 사람 무기 배정 → 입장(신청) → 경기마다 '무기 배정' · 동료 둘을 내보냄(지켜보기 — 실제 싸움은 playwright 시계로 빨리 · 그리기는 사진 때만)
//     · 지면 '다음 대회'로 다시 (하사품이 나올 때까지 · 상한 있음)
//  ③ 하사품 '열기' → '다음 대회' → 새 대진표 → 대기실 칸
//  ④ 본 게임 저장 열쇠가 그대로인가(바이트까지) · 시험판 열쇠는 모두 'stillness.test.' 앞 · 하위 경로 밖 요청 · 404 · 페이지 오류
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:5392', out = process.argv[3] || 'dist/saengsa_testpage';
const MAX_CUPS = Number(process.argv[4] || 12);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true }); // 싸움 그리기가 무거워(swiftshader) 1 배
await ctx.route('https://*.supabase.co/**', (route) => route.abort());
const p = await ctx.newPage();
const errors = [], bad = [], outside = [], saved = [], log = [];
const IGNORED = /deprecated parameters for the initialization function/;
p.on('pageerror', (e) => errors.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(m.text()); });
p.on('response', (r) => { const u = new URL(r.url()); if (u.origin !== new URL(base).origin) return; if (r.status() >= 400) bad.push(`${r.status()} ${u.pathname}`); if (!u.pathname.startsWith('/saengsa/') && u.pathname !== '/') outside.push(u.pathname); });
const run = (ms) => p.clock.runFor(ms);
const until = async (fn, step = 100, max = 600) => { for (let i = 0; i < max; i++) { if (await p.evaluate(fn)) return true; await run(step); } return false; };
const inRoot = (body) => p.evaluate(new Function(`const root=document.querySelector('#gameEntrance').shadowRoot;${body}`));
const tap = async (sel) => { await p.locator(sel).first().waitFor({ state: 'visible', timeout: 20000 }); await p.locator(sel).first().tap(); await run(60); };
const render = (on) => p.evaluate((v) => { if (window.game?.renderCap) window.game.renderCap.tick = () => v; }, on);
const shot = async (name, fight = false) => { if (fight) { await render(true); await run(80); } else await run(250); const path = `${out}/${name}.png`; await p.screenshot({ path }); saved.push(path); if (fight) await render(false); };
const rawStorage = async () => { const q = await ctx.newPage(); await q.goto(`${base}/`); const all = await q.evaluate(() => Object.fromEntries(Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).map((k) => [k, localStorage.getItem(k)]))); await q.close(); return all; };
/** '전투 입장' 뒤 실제 싸움을 끝까지 (그리기 끔 · 시계 빨리) — 돌려줌 판 게임 시간 */
async function fightOut(shotName = null) {
  if (!(await until(() => window.game?.state === 'fight' && !!window.game.teamRun, 50, 800))) return null;
  await render(false);
  await run(1500);
  if (shotName) await shot(shotName, true);
  let sim = 0;
  for (let i = 0; i < 200; i++) {
    const L = await p.evaluate(() => ({ over: !!window.game.teamRun?.M.over, sim: window.game.stats.simTime }));
    sim = L.sim;
    if (L.over) break;
    await run(2000);
  }
  await until(() => window.game?.state !== 'fight', 250, 80);
  return +sim.toFixed(1);
}

// ① 본 게임 저장 (같은 출처) — 이 값들이 끝까지 그대로여야 한다
const REAL = {
  'stillness.lobby.progress.v1': JSON.stringify({ version: 1, coins: 77, heads: 3, acquisitions: [{ receipt: 'skill:german:G1', kind: 'skill' }], titles: [], title: '' }),
  'stillness.saengsa.v1': JSON.stringify({ version: 1, current: null, draft: { companions: ['minami', null], weapons: ['tree_branch', null, null] } }),
  'stillness.lobby.weapon.v1': JSON.stringify({ version: 1, weapon: 'tree_branch' }),
};
await p.goto(`${base}/`);
await p.evaluate((real) => { for (const [k, v] of Object.entries(real)) localStorage.setItem(k, v); }, REAL);
const before = await rawStorage();

await p.clock.install({ time: new Date('2026-10-30T15:00:00+09:00') });
await p.goto(`${base}/saengsa/`, { waitUntil: 'domcontentloaded' });
if (!(await until(() => !!document.querySelector('#gameEntrance')?.shadowRoot?.getElementById('saengsaHost')?.offsetParent, 100, 1500))) errors.push('대기실 생사전 칸이 안 뜸');
for (let i = 0; i < 4; i++) { // 처음 알림 창이 있으면 닫는다
  const id = await inRoot(`const d=[...root.querySelectorAll('dialog[open]')][0];return d?d.querySelector('.dialog-actions button')?.id??null:null;`);
  if (!id) break;
  await tap(`#${id}`);
}
const fontsOk = await p.evaluate(() => ['Pretendard', 'Cinzel'].map((f) => [f, document.fonts.check(`16px ${f}`)]));
const wallet0 = await p.evaluate(() => JSON.parse(localStorage.getItem('stillness.lobby.progress.v1')));
log.push({ step: 'open', title: await p.title(), fontsOk, testWallet: { coins: wallet0.coins, titles: wallet0.titles.map((t) => t.name), weapons: wallet0.acquisitions.filter((a) => a.kind === 'item').length } });
await shot('tp1_panel');

// ② 팀 · 무기 배정
await tap('.sg-slot[data-slot="0"]');
await tap('.sg-chip-btn[data-weapon="longsword"]');
await tap('#sgPickOk');
// 동료 = 미나미(일본 — 우치가타나) · 랴오(동방 — 환도): 제 유파 칼을 주어 지켜보기 경기를 이길 만하게 (하사품까지 가 보려고)
await tap('.sg-slot[data-slot="1"]');
await tap('.sg-pick[data-id="minami"]');
await tap('.sg-chip-btn[data-weapon="uchigatana"]');
await shot('tp2_picker');
await tap('#sgPickOk');
await tap('.sg-slot[data-slot="2"]');
await tap('.sg-pick[data-id="liao"]');
await tap('.sg-chip-btn[data-weapon="hwando"]');
await tap('#sgPickOk');
await shot('tp3_panel_ready');
await tap('#saengsaEnter');
await until(() => !!document.querySelector('#gameEntrance').shadowRoot.querySelector('.sg-m[data-state="ready"]'), 100, 300);
await shot('tp4_bracket');

let cups = 0, matches = 0, prize = false, firstMatch = true; // prize = 하사품을 받는 자리(우승 · 준우승)
const sims = [];
const readyId = () => inRoot(`const b=root.querySelector('.sg-m[data-state="ready"]');return b?b.dataset.match:null;`);
for (cups = 1; cups <= MAX_CUPS && !prize; cups++) {
  for (;;) {
    const id = await readyId();
    if (!id) break;
    await tap(`.sg-m[data-match="${id}"]`);
    if (firstMatch) { // 경기마다 무기 배정 — 첫 경기에서 나(이번엔 안 나섬)를 크리그스메서로
      await tap('#sgArmBtn');
      await tap('#sgArmRows .sg-chip-btn[data-slot="0"][data-weapon="kriegsmesser"]');
      await shot('tp5_arm');
      await tap('#sgArmOk');
    }
    const alive = await inRoot(`return [...root.querySelectorAll('#sgCardsB button.sg-card:not([disabled])')].map((b) => b.dataset.key);`);
    const picks = alive.filter((k) => k !== '0-0').slice(0, 2);
    for (const k of picks.length ? picks : alive.slice(0, 1)) await tap(`button.sg-card[data-key="${k}"]`);
    if (firstMatch) await shot('tp6_match_pick');
    await tap('#sgFight');
    const sim = await fightOut(firstMatch ? 'tp6b_fight' : null);
    if (sim != null) sims.push(sim);
    await until(() => !document.querySelector('#gameEntrance').shadowRoot.getElementById('sgDone').hidden, 100, 100);
    matches++;
    const won = await inRoot(`return root.getElementById('sgOutcome').dataset.won;`);
    if (firstMatch) { await shot('tp7_result'); firstMatch = false; }
    await tap('#sgDone');
    if (won !== 'true') break;
  }
  const state = await inRoot(`return { prize: !root.getElementById('sgPrize').hidden, next: !root.getElementById('sgNextCup').hidden, text: root.getElementById('sgNext').textContent };`);
  log.push({ cup: cups, matches, ...state });
  if (state.prize) {
    prize = true;
    await shot('tp8_chests');
    await tap('#sgOpen');
    await shot('tp9_after_chests');
  }
  if (!(await inRoot(`return !root.getElementById('sgNextCup').hidden;`))) { log.push({ error: '다음 대회 단추가 없음' }); break; }
  await tap('#sgNextCup');
  await run(300);
  if (prize) await shot('tp10_next_cup');
}
const wallet1 = await p.evaluate(() => JSON.parse(localStorage.getItem('stillness.lobby.progress.v1')));
const page = await inRoot(`return { ready: !!root.querySelector('.sg-m[data-state="ready"]'), times: [...root.querySelectorAll('.sg-m-time')].map((e) => e.textContent).filter(Boolean).length };`);
log.push({ step: 'end', prize, cups: cups - 1, matches, fightSims: sims, testCoins: wallet1.coins, newCupReady: page.ready, timesShown: page.times });

// ③ 대기실로 — 칸이 새 대회 팀을 보임
await tap('#sgBack');
await until(() => !!document.querySelector('#gameEntrance')?.shadowRoot?.getElementById('saengsaHost')?.offsetParent, 100, 100);
await shot('tp11_panel_running');

// ④ 저장 가르기
const after = await rawStorage();
const realSame = Object.keys(REAL).every((k) => after[k] === before[k]);
const realKeys = Object.keys(after).filter((k) => !k.startsWith('stillness.test.'));
const testKeys = Object.keys(after).filter((k) => k.startsWith('stillness.test.'));
const changedReal = realKeys.filter((k) => after[k] !== before[k]);
log.push({ step: 'storage', realSame, realKeys, changedReal, testKeys });
await browser.close();
fs.writeFileSync(`${out}/testpage_report.json`, JSON.stringify({ saved, log, errors, bad, outside: [...new Set(outside)] }, null, 1));
for (const l of log) console.log(JSON.stringify(l));
console.log('404 등:', bad.length ? bad.join(' · ') : '없음');
console.log('하위 경로 밖 요청:', outside.length ? [...new Set(outside)].join(' · ') : '없음');
console.log(errors.length ? errors.join('\n') : 'no page errors');

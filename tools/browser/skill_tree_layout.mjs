// 스킬북 별자리 겹침 점검 (docs/import/lobby_fix_2026-10-16.md §6) — 책을 하나도 안 산 상태(값 표지가 가장 많은 때)에서 유파 다섯 × 화면 여섯
//  (폰 가로 844 · 740 · 680 — 판이 좁을수록 책을 줄인다 · 폰 세로 · PC · 작은 가로):
//  ① 다른 책끼리 섬네일 · 이름 · 값 표지가 겹치는지 ② 판 밖으로 나가는지 ③ 룬 줄이 어느 책 칸(섬네일 · 이름 · 값)도 안 지나는지 · 줄마다 룬 꺾쇠가 들어갔는지
//  ④ 책 그림(유파마다 다섯 — 모두 25 장) · 값 표지 금화 그림이 실제로 읽혔는지 (10/16 매끈한 그림 — docs/import/item_art_2026-10-16.md).
//  별자리 자리(src/skill_tree.js CONSTELLATIONS)를 고치면 돌린다. 하나라도 걸리면 종료 코드 1
//  npm run build && npx vite preview --port 5210 →  node tools/browser/skill_tree_layout.mjs http://127.0.0.1:5210
import { chromium } from 'playwright';
import { titleToLobby } from './to_lobby.mjs'; // 10/17: 첫 화면 → 곧바로 여정 → 정지 → 대기실 (사장님 '첫화면에서 바로 전투로')
const base = process.argv[2] || 'http://127.0.0.1:5210';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
let bad = 0;
for (const [name, w, h] of [['landscape', 844, 390], ['landscape-740', 740, 360], ['landscape-680', 680, 360], ['portrait', 390, 844], ['desktop', 1280, 720], ['small-landscape', 568, 320]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.clear(); } });
  const p = await ctx.newPage();
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
  if (await p.locator('#noticeDialog').evaluate((d) => d.open)) await p.locator('#confirmNotices').click();
  await p.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 20000 });
  await titleToLobby(p);
  await p.locator('#tabSkills').click();
  const report = [];
  for (const school of ['german', 'italian', 'iberian', 'japanese', 'chinese']) {
    await p.locator(`.school-tabs [data-school=${school}]`).click();
    const r = await p.evaluate(() => {
      const root = document.querySelector('#gameEntrance').shadowRoot, board = root.querySelector('.tree-board').getBoundingClientRect();
      const boxes = [];
      for (const n of root.querySelectorAll('.book-node')) {
        const k = n.dataset.book;
        for (const [part, sel] of [['book', '.book-thumb'], ['label', '.book-cat'], ['price', '.book-price']]) {
          const e = n.querySelector(sel); if (!e) continue;
          const b = e.getBoundingClientRect(); boxes.push({ id: `${k}${part}`, node: k, l: b.left, r: b.right, t: b.top, b: b.bottom });
        }
      }
      const hits = [];
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const A = boxes[i], B = boxes[j]; if (A.node === B.node) continue;
        const ox = Math.min(A.r, B.r) - Math.max(A.l, B.l), oy = Math.min(A.b, B.b) - Math.max(A.t, B.t);
        if (ox > 0.5 && oy > 0.5) hits.push(`${A.id}×${B.id} ${ox.toFixed(0)}×${oy.toFixed(0)}`);
      }
      const out = boxes.filter((b) => b.l < board.left - 0.5 || b.r > board.right + 0.5 || b.t < board.top - 0.5 || b.b > board.bottom + 0.5).map((b) => b.id);
      // 룬 줄: 보이는 곧은 줄(path 첫 M … L …)을 화면 좌표로 — 0.5 px 마다 어느 책 칸에도 안 들어가야 한다
      const links = [];
      const vis = [];
      for (const [gi, g] of [...root.querySelectorAll('.rune-link')].entries()) {
        const m = g.querySelector('path').getAttribute('d').match(/^M([\d.-]+) ([\d.-]+) L([\d.-]+) ([\d.-]+)/);
        const id = `#${gi + 1}`; vis.push(+g.dataset.visible); // 줄 번호 = CONSTELLATIONS links 차례
        if (!m) { links.push(`${id}:none`); continue; }
        const [x0, y0, x1, y1] = m.slice(1).map(Number), X = (u) => board.left + (u / 300) * board.width, Y = (v) => board.top + (v / 210) * board.height;
        const ax = X(x0), ay = Y(y0), bx = X(x1), by = Y(y1), L = Math.hypot(bx - ax, by - ay), through = new Set();
        for (let t = 0; t <= L; t += 0.5) {
          const x = ax + ((bx - ax) * t) / L, y = ay + ((by - ay) * t) / L;
          for (const b of boxes) if (x > b.l && x < b.r && y > b.t && y < b.b) through.add(b.id);
        }
        if (through.size) links.push(`${id}:through ${[...through].join('/')}`);
        if (g.dataset.rune !== 'full') links.push(`${id}:${g.dataset.rune} ${g.dataset.visible}`);
      }
      return { board: [Math.round(board.width), Math.round(board.height)], hits, out, links, vis };
    });
    // ④ 책 그림 다섯 · 값 표지 금화 (매끈한 256 px 그림 — docs/import/item_art_2026-10-16.md): 그 유파 그림이 실제로 읽혔나 → 다섯 유파 = 책 25 장 모두
    const pics = await p.evaluate((s) => Promise.all([...document.querySelector('#gameEntrance').shadowRoot.querySelectorAll('.book-node')].flatMap((n) => [...n.querySelectorAll('.book-svg, .price-coin')].map((i) => i.decode().catch(() => {}).then(() => {
      const want = i.classList.contains('book-svg') ? `ui/books/${s}_${n.dataset.book}.webp` : 'ui/wallet/coins.webp';
      return i.complete && i.naturalWidth === 256 && i.getAttribute('src') === want ? '' : `${n.dataset.book}:${i.getAttribute('src')}`;
    })))), school);
    const broken = pics.filter(Boolean);
    bad += r.hits.length + r.out.length + r.links.length + broken.length + (pics.length < 10 ? 1 : 0);
    report.push(`${school}: ${r.hits.length ? r.hits.join(', ') : 'ok'}${r.out.length ? ' | outside ' + r.out.join(',') : ''}${r.links.length ? ' | links ' + r.links.join(', ') : ''}${broken.length || pics.length < 10 ? ` | pictures ${pics.length} ${broken.join(',')}` : ''} (board ${r.board} · 줄 ${r.vis.join(' ')} · 그림 ${pics.length})`);
  }
  console.log(name + '\n  ' + report.join('\n  '));
  await ctx.close();
}
await browser.close();
console.log(bad ? `FAIL ${bad} overlaps/outside/links/pictures` : 'PASS no overlaps · links clear · 25 book pictures + price coins load (5 schools × 6 sizes)');
if (bad) process.exit(1);

// 첫 화면·대기실 ↔ 전투 화면 맞추기 사진 · 잰 값 (사장님 10/16 15:3x ②~⑥ ⑨ · 16:0x — docs/import/ui_unify_2026-10-16.md)
//  폰 가로 844×390 · 화소 비 3 · 터치 (장면 전부) + PC 1280×720 (배치). 잰 값(CSS px)은 844×390 · 932×430 · 1280×720 · 568×320 · 390×844(PC 세로 창 — 세로 폰은 돌려 달라는 안내가 덮는다)
//  장면: notices · title · settings · weapons · armor · skills · shop · titles(호칭 내림 — 있을 때만)
//  잰 것: 세 칸 위아래 줄 · 사슬 틀 두께 · 캐릭터 카드 비 · 재고 틀 / 별자리 틀 바깥 크기 · 틀 안 남는 띠 · 칸 그림(보이는 부분) 몫 ·
//         대기실 UI 색 수 (화면에 그려진 계산값 — 그림은 빼고: 숲 · 캐릭터 · '대기실' 글자 캔버스 · 아이템 그림 · 금화/주머니/책 그림 · 사슬 틀 · 카드 바탕 무늬 · 배경 어둡게 막)
//  저장: <out>/<이름표>_<장면>_<phone|pc>.png · <out>/<이름표>_measure.json — 전(바탕 커밋)/후를 같은 도구로 찍어 tools/ui/uiunify_pair.py 로 붙인다
//  npm run build && npx vite preview --port 5261 →  node tools/browser/uiunify_capture.mjs http://127.0.0.1:5261 /tmp/<빈 폴더> after
import { chromium } from 'playwright';
import { titleToLobby } from './to_lobby.mjs'; // 10/17: 첫 화면 → 곧바로 여정 → 정지 → 대기실 (사장님 '첫화면에서 바로 전투로')
import fs from 'node:fs';
const [base = 'http://127.0.0.1:5261', out = '/tmp/uiunify', label = 'after'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const IGNORED = /deprecated parameters for the initialization function/;
const errors = [], measure = {}, palette = new Set();
const SEED = { version: 1, coins: 1240, heads: 3, titles: [], title: '여행자', acquisitions: ['german:1', 'german:2', 'german:3'].map((b) => ({ receipt: `skillbook:${b}`, kind: 'skillbook' })) };
async function open(width, height, phone) {
  const ctx = await browser.newContext(phone ? { viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: 'reduce' } : { viewport: { width, height }, reducedMotion: 'reduce' });
  await ctx.route('https://*.supabase.co/**', (r) => { errors.push('auth server called'); r.abort(); });
  await ctx.addInitScript((seed) => {
    if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.setItem('stillness.lobby.progress.v1', JSON.stringify(seed));
    localStorage.setItem('stillness.lobby.weapon.v1', JSON.stringify({ version: 1, weapon: 'tree_branch' }));
  }, SEED);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(m.text()); });
  await p.goto(base + '/', { waitUntil: 'networkidle' }); await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
  await p.evaluate(() => document.fonts.ready);
  return { ctx, p };
}
const tap = (p, sel) => p.locator(sel).click();
const ready = (p) => p.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 20000 });
const toLobby = async (p) => { await titleToLobby(p); await p.waitForTimeout(400); };
const shot = (p, scene, size) => p.screenshot({ path: `${out}/${label}_${scene}_${size}.png` });
// 대기실 배치 (CSS px): 세 칸 · 캐릭터 카드 · 재고 틀 · 별자리 틀(유파 탭 + 판 — 바탕 커밋은 판만 틀이라 .tree-frame) · 칸 · 칸 그림(보이는 부분 = 그림 파일의 불투명 상자 × 그린 크기)
const layout = (p) => p.evaluate(async () => {
  const root = document.querySelector('#gameEntrance').shadowRoot, q = (s) => root.querySelector(s);
  const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return r.width ? { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), b: +r.bottom.toFixed(1), r: +r.right.toFixed(1) } : null; };
  const frame = (el) => el && R(el) && { outer: R(el), border: getComputedStyle(el).borderTopWidth };
  const inv = q('.inventory-frame'), grid = q('.inventory-grid'), host = q('.skill-tree-host'), tree = host && getComputedStyle(host).borderImageSource !== 'none' ? host : q('.tree-frame');
  const g = R(grid), f = R(inv), bw = inv ? parseFloat(getComputedStyle(inv).borderTopWidth) : 0;
  const pictures = [];
  for (const img of root.querySelectorAll('.inventory-item img')) {
    await img.decode().catch(() => {});
    const n = 64, c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'); x.drawImage(img, 0, 0, n, n);
    const a = x.getImageData(0, 0, n, n).data; let x0 = n, x1 = -1, y0 = n, y1 = -1;
    for (let y = 0; y < n; y++) for (let i = 0; i < n; i++) if (a[(y * n + i) * 4 + 3] > 24) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const cell = img.closest('.inventory-item').getBoundingClientRect(), box = img.getBoundingClientRect();
    pictures.push({ item: img.closest('[data-item]').dataset.item, box: +(box.width / cell.width).toFixed(3), visible: +((Math.max(x1 - x0 + 1, y1 - y0 + 1) / n) * box.width / cell.width).toFixed(3), rendering: getComputedStyle(img).imageRendering });
  }
  return {
    viewport: [innerWidth, innerHeight],
    character: R(q('.character-panel')), card: frame(q('.portrait-card')), cardRatio: R(q('.portrait-card')) ? +(R(q('.portrait-card')).w / R(q('.portrait-card')).h).toFixed(3) : null,
    view: R(q('#characterView')), depart: R(q('#lobbyDepart')), profile: R(q('.profile-panel')), contents: R(q('.contents-panel')),
    inventory: frame(inv), grid: g, leftover: f && g ? { left: +(g.x - f.x - bw).toFixed(1), right: +(f.r - g.r - bw).toFixed(1), top: +(g.y - f.y - bw).toFixed(1), bottom: +(f.b - g.b - bw).toFixed(1) } : null,
    tree: frame(tree), cell: R(q('.inventory-item')), pictures,
  };
});
// 대기실 UI 색 (보이는 요소의 계산값: 글자 · 바탕 · 바탕 그러데이션 · 테두리(두께 > 0) · 그림자 · SVG 칠 · ::before/::after · ::backdrop) — 그림(겉 · 아이템 그림)은 뺀다
const census = (p) => p.evaluate(() => {
  const root = document.querySelector('#gameEntrance').shadowRoot, found = new Set();
  const art = (el) => el.closest('canvas, img, .book-svg, .coin-icon, .price-coin, .lobby-shade, .lobby-backdrop');
  const add = (v) => { for (const m of String(v || '').matchAll(/rgba?\([^)]*\)/g)) { const c = m[0].replace(/\s+/g, ''); if (!/^rgba\(.*,0\)$/.test(c)) found.add(c); } };
  const take = (el, s, text) => {
    if (text) add(s.color);
    if (!(el.classList?.contains('portrait-card'))) { add(s.backgroundColor); if (s.backgroundImage.includes('gradient')) add(s.backgroundImage); } // 캐릭터 카드 바탕 무늬 = 카드 그림(겉)
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) if (parseFloat(s[`border${side}Width`]) > 0 && s.borderImageSource === 'none') add(s[`border${side}Color`]);
    if (s.boxShadow !== 'none') add(s.boxShadow);
    if (text && s.textShadow !== 'none') add(s.textShadow);
    if (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) add(s.outlineColor);
  };
  for (const el of root.querySelectorAll('*')) {
    if (art(el) || el.tagName === 'STYLE') continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || !el.getClientRects().length) continue;
    const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    take(el, s, text);
    if (el instanceof SVGGeometryElement) { if (s.fill !== 'none') add(s.fill); if (s.stroke !== 'none') add(s.stroke); } // 모양이 있는 SVG 만 (g · svg 의 기본 칠 검정은 그려지지 않는다)
    for (const pseudo of ['::before', '::after']) { if (el.classList?.contains('portrait-card')) continue; const ps = getComputedStyle(el, pseudo); if (ps.content !== 'none' && ps.content !== 'normal') take(el, ps, false); }
    if (el.tagName === 'DIALOG' && el.open) take(el, getComputedStyle(el, '::backdrop'), false);
  }
  return [...found];
});
const keep = async (p) => { for (const c of await census(p)) palette.add(c); };
try {
  // ── 폰 가로 844×390 · 화소 비 3: 장면 전부 + 대기실 색 ──
  {
    const size = 'phone', { ctx, p } = await open(844, 390, true);
    if (await p.locator('#noticeDialog').evaluate((d) => d.open)) { await p.waitForTimeout(500); await shot(p, 'notices', size); await tap(p, '#confirmNotices'); }
    await ready(p); await p.waitForTimeout(400); await shot(p, 'title', size);
    await tap(p, '#openSettings'); await p.waitForFunction(() => !document.querySelector('#gameEntrance').shadowRoot.getElementById('titleFps').disabled); await p.waitForTimeout(200); await shot(p, 'settings', size); await tap(p, '#closeSettings');
    await toLobby(p);
    await tap(p, '[data-weapon=tree_branch]'); await p.waitForTimeout(300); await keep(p); await shot(p, 'weapons', size);
    await tap(p, '#tabArmor'); await p.locator('[data-armor=kettle] img').evaluate((i) => i.decode()); await tap(p, 'button[data-armor=kettle]'); await p.waitForTimeout(300); await keep(p); await shot(p, 'armor', size);
    await tap(p, '#tabSkills'); await p.waitForTimeout(300); await keep(p); await tap(p, '.book-node[data-book="3"]'); await p.waitForTimeout(250); await keep(p); await shot(p, 'skills', size);
    await tap(p, '.detail-close'); await tap(p, '.book-node[data-book="4"]'); await p.waitForTimeout(200); await keep(p); await tap(p, '.detail-close'); // 안 산 책(구입 단추)
    await tap(p, '#tabShop'); await p.waitForTimeout(200); await keep(p); await shot(p, 'shop', size);
    await tap(p, '#editName'); await p.waitForTimeout(200); await keep(p); await tap(p, '#cancelName');
    if (await p.locator('#titleSelect').count()) { await tap(p, '#tabWeapons'); await tap(p, '#titleSelect'); await p.waitForTimeout(250); await keep(p); await shot(p, 'titles', size); await p.keyboard.press('Escape'); }
    await ctx.close();
  }
  // ── 배치 잰 값 (화소 비 1 — CSS px) + PC 사진 ──
  for (const [size, w, h] of [['844x390', 844, 390], ['932x430', 932, 430], ['1280x720', 1280, 720], ['568x320', 568, 320], ['390x844', 390, 844]]) {
    const { ctx, p } = await open(w, h, false);
    if (await p.locator('#noticeDialog').evaluate((d) => d.open)) await tap(p, '#confirmNotices');
    await ready(p);
    if (size === '1280x720') { await p.waitForTimeout(400); await shot(p, 'title', 'pc'); }
    await toLobby(p);
    await p.waitForTimeout(300);
    const weapons = await layout(p);
    if (size === '1280x720') { await tap(p, '[data-weapon=tree_branch]'); await p.waitForTimeout(250); await shot(p, 'weapons', 'pc'); await tap(p, '[data-weapon=tree_branch]'); }
    await tap(p, '#tabArmor'); await p.waitForTimeout(300);
    const armor = await layout(p);
    await tap(p, '#tabSkills'); await p.waitForTimeout(300);
    const skills = await layout(p);
    if (size === '1280x720') await shot(p, 'skills', 'pc');
    measure[size] = { weapons, armor: { pictures: armor.pictures }, skills: { tree: skills.tree, contents: skills.contents } };
    await ctx.close();
  }
} finally {
  const colors = [...palette].sort();
  fs.writeFileSync(`${out}/${label}_measure.json`, JSON.stringify({ measure, lobbyColors: { count: colors.length, colors }, errors }, null, 2));
  await browser.close();
}
console.log(`lobby UI colors: ${palette.size}`);
console.log(`saved to ${out} · errors ${errors.length}`, errors);

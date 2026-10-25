// 파펜하이머 그림 (10/25 — docs/import/chixiao_import_2026-10-25.md · docs/handoff/chixiao_2026-10-25/). 게임 코드는 읽기만.
//  ① 코등이 가까이 — 전 · 후: tools/browser/weapon_look.html?mode=hilt. '전'은 --before=<전달본 겉모습 모듈 — 개발 서버 경로> 로 그 모듈의 chixiaoPartMesh 를 끼워 찍는다
//     (샛별 저장소 e3e1f144 의 src/chixiao_details.js 를 import 경로만 '/src/weapon_looks.js' 로 바꿔 저장소 밖 임시 폴더에 두고 넘김). 없으면 '후'만.
//  ② 게임 크기 견줌 — 레이피어 · 달타냥 · 파펜하이머를 세워 나란히: 1 m = 190 화소(폰 가로 844 × 390 · 화면 배율 2 에서 내 인물 자리) · 75 화소(상대 자리)를 화소 그대로 키워 전 · 후 한 장에(1080 × 420)
//  ③ 게임 속 — 내 인물이 파펜하이머를 쥔 붉은 회랑(토메 · 레이피어): 게임 카메라 그대로 한 장 · 물리를 멈추고 내 인물 앞 3/4 에서 한 장(상대 감춤) (폰 가로 844 × 390 · 화면 배율 2)
//  ④ 카드 앞면: ?cards=chixiao,longsword — 사장님 글 두 줄 · '레어' · 썸네일. 844 × 390 · 568 × 320 · 1280 × 800 에서 글 넘침을 보고 폰 가로만 찍는다
//  ⑤ 썸네일: 이탈리아 넷(레이피어 · 달타냥 · 발리사르다 · 파펜하이머)의 카드 썸네일(public/ui/weapons/<id>.webp 그대로)을 한 장에
//  실행: vite 개발 서버를 띄운 뒤
//    node tools/browser/chixiao_shots.mjs http://127.0.0.1:5585 [출력 폴더(기본 docs/handoff/chixiao_2026-10-25)] [--only=hilt,lineup,game,card,thumbs] [--before=/tmp_x/pap_orig.js]
//  크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium). 끝 코드 0 = 콘솔 오류 0 · 글 넘침 없음
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const base = (pos[0] || 'http://127.0.0.1:5585').replace(/\/$/, '');
const out = pos[1] || 'docs/handoff/chixiao_2026-10-25';
const only = new Set((opt('only') ?? 'hilt,lineup,game,card,thumbs').split(','));
const before = opt('before');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const report = {};
const W = 844, H = 390;
const nextFrames = (page, n = 3) => page.evaluate((n) => new Promise((ok) => { const f = () => (--n <= 0 ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const toWebp = (png, name, q = 82) => { execFileSync('python3', ['-I', '-c', "import sys\nfrom PIL import Image\nImage.open(sys.argv[1]).convert('RGB').save(sys.argv[2], 'WEBP', quality=int(sys.argv[3]), method=6)", png, `${out}/${name}.webp`, String(q)]); fs.rmSync(png); };
const watch = (page, tag) => {
  page.on('pageerror', (e) => errors.push(`${tag} pageerror ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${tag} console ${m.text()}`));
  page.on('response', (r) => r.status() >= 400 && errors.push(`${tag} http ${r.status()} ${r.url()}`));
};
const b64 = (buf) => `data:image/png;base64,${buf.toString('base64')}`;

/** weapon_look.html 한 번 — { name: png Buffer } (alt = 전달본 겉모습 모듈을 끼워 찍음) */
async function look(query, alt) {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  watch(page, `look ${query}`);
  await page.goto(`${base}/tools/browser/weapon_look.html?${query}${alt ? `&alt=${encodeURIComponent(alt)}` : ''}`);
  await page.waitForFunction(() => window.look?.done, null, { timeout: 300000 });
  const list = await page.evaluate(() => window.look.list);
  await page.close();
  return Object.fromEntries(list.map((l) => [l.name, Buffer.from(l.url.split(',')[1], 'base64')]));
}
async function htmlShot(html, name, w = W, h = H) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  watch(page, name);
  await page.setContent(html);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 60000 });
  await page.screenshot({ path: `${out}/_${name}.png` });
  toWebp(`${out}/_${name}.png`, name);
  await page.close();
}

// ① 코등이 가까이
if (only.has('hilt')) {
  const q = 'mode=hilt&ids=chixiao&cy=0.07&dist=0.74';
  const after = await look(q);
  fs.writeFileSync(`${out}/_hilt_after.png`, after.hilt_chixiao);
  toWebp(`${out}/_hilt_after.png`, 'hilt_after', 86);
  if (before) {
    const bef = await look(q, before);
    fs.writeFileSync(`${out}/_hilt_before.png`, bef.hilt_chixiao);
    toWebp(`${out}/_hilt_before.png`, 'hilt_before', 86);
  }
}

// ② 게임 크기 견줌 (전 · 후 · 화소 그대로 키움)
if (only.has('lineup')) {
  const ids = 'rapier,dartagnan,chixiao';
  const sets = [['후 (지금)', null]];
  if (before) sets.unshift(['전 (전달본)', before]);
  const rows = [];
  for (const [label, alt] of sets) {
    const a = await look(`mode=lineup&ids=${ids}&ppm=190`, alt), b = await look(`mode=lineup&ids=${ids}&ppm=75`, alt);
    rows.push({ label, near: b64(a.lineup_190), far: b64(b.lineup_75) });
  }
  const cell = (src, z, cap) => `<figure style="margin:0;text-align:center"><img src="${src}" style="zoom:${z};image-rendering:pixelated;display:block"><figcaption style="font-size:11px;margin-top:2px">${cap}</figcaption></figure>`;
  const html = `<html><body style="margin:0;background:#26232a;color:#eee6d6;font-family:sans-serif;display:flex;gap:28px;justify-content:center;align-items:center;height:420px">${rows.map((r) => `<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><div style="font-size:14px;font-weight:bold">${r.label}</div><div style="display:flex;gap:10px;align-items:flex-end">${cell(r.near, 1.2, '내 인물 자리 (1 m = 190 화소 · ×1.2)')}${cell(r.far, 2.4, '상대 자리 (75 화소 · ×2.4)')}</div><div style="font-size:11px;opacity:.8">왼쪽부터 레이피어 · 달타냥 · 파펜하이머</div></div>`).join('')}</body></html>`;
  await htmlShot(html, 'lineup_game', 1080, 420); // 견줌 판은 넓게 (전 · 후 넷)
}

// ③ 게임 속 — 내 인물이 쥔 파펜하이머 (붉은 회랑 · 토메)
async function openGame() {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  watch(page, 'game');
  await page.goto(`${base}/?test=1&stage=loggia&foe=bran&weapon=chixiao&foeWeapon=tree_branch&foeWhiff=1&emo=0`, { waitUntil: 'networkidle' }); // ?weapon= 은 상대 무기까지 고정하므로 토메 무기(레이피어)를 주소에 적는다
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 600000 });
  await page.tap('#btnStart', { timeout: 300000 });
  return page;
}
if (only.has('game')) {
  const page = await openGame();
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.stats.simTime > 1.0, null, { timeout: 60000 });
  report.game = await page.evaluate(() => { const g = window.game, P = g.player; return { weapon: P.weapon.id, mass: +P.sword.mass().toFixed(3), school: P.swordArt.tradition, foe: g.enemy.weapon.id, t: +g.stats.simTime.toFixed(2) }; });
  if (report.game.weapon !== 'chixiao' || report.game.school !== 'chinese') errors.push(`game ${JSON.stringify(report.game)}`);
  await page.screenshot({ path: `${out}/_equipped_game.png` });
  toWebp(`${out}/_equipped_game.png`, 'equipped_game');
  // 물리를 멈추고 내 인물 앞 3/4 에서 (칼 전체 · 코등이가 보이게) — 화면 글 · 상대는 감춤
  await page.addStyleTag({ content: 'body > :not(#game), #moveStick, #moveKnob { display: none !important; visibility: hidden !important; }' });
  await page.evaluate(() => {
    const g = window.game, T = g.THREE, P = g.player;
    g.world.step = () => {};
    g.freeCam = true;
    const c = P.bodies.pelvis.translation(), r = P.bodies.pelvis.rotation();
    const fw = new T.Vector3(1, 0, 0).applyQuaternion(new T.Quaternion(r.x, r.y, r.z, r.w)).setY(0).normalize();
    const hilt = P.bladePoint(-0.05), tip = P.bladePoint(1);
    const at = new T.Vector3((hilt.x * 2 + tip.x + c.x) / 4, (hilt.y * 2 + tip.y + c.y + 0.3) / 4, (hilt.z * 2 + tip.z + c.z) / 4);
    for (const m of g.enemy.meshes) m.group.visible = false; // 상대(토메)가 카메라를 가리지 않게
    const view = fw.clone().applyAxisAngle(new T.Vector3(0, 1, 0), 0.8);
    g.camera.position.copy(at).addScaledVector(view, 1.5).setY(at.y + 0.18);
    g.camera.lookAt(at);
  });
  await nextFrames(page, 4);
  await page.screenshot({ path: `${out}/_equipped.png` });
  toWebp(`${out}/_equipped.png`, 'equipped');
  await page.close();
}

// ④ 카드 앞면
for (const [w, h] of only.has('card') ? [[844, 390], [568, 320], [1280, 800]] : []) {
  const touch = w < 1000;
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: w === W ? 2 : 1, hasTouch: touch, isMobile: touch });
  watch(page, `card ${w}x${h}`);
  await page.goto(`${base}/?stage=loggia&foe=tome&cards=chixiao,longsword`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 600000 });
  if (touch) await page.tap('#btnStart'); else await page.click('#btnStart');
  await page.waitForFunction(() => window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6, null, { timeout: 600000 });
  await page.evaluate(() => document.querySelector('#draw .wcard').click());
  await page.waitForFunction(() => window.game.draw.t > 1.35 || window.game.state === 'fight', null, { timeout: 600000, polling: 50 });
  await page.evaluate(() => { window.game.draw.hold = true; });
  const c = await page.evaluate(() => {
    const card = document.querySelector('#draw .wcard'), f = card.querySelector('.wface').getBoundingClientRect(), d = card.querySelector('.wdesc').getBoundingClientRect();
    const th = getComputedStyle(card.querySelector('.wthumb')).backgroundImage; // 썸네일은 칸 배경 그림 (main.js — ui/weapons/<id>.webp)
    return { name: card.querySelector('.wname').textContent, tier: card.querySelector('.wtier').textContent, desc: card.querySelector('.wdesc').textContent, thumb: /ui\/weapons\/chixiao\.webp/.test(th), overflow: d.bottom > f.bottom + 0.5 || d.right > f.right + 0.5 };
  });
  report[`card_${w}x${h}`] = c;
  if (!c.name.includes('파펜하이머') || c.tier !== '레어' || c.overflow || !c.thumb || !c.desc.includes('롱소드와 레이피어의 장점을 흡수한 결투용 검.')) errors.push(`card ${w}x${h} ${JSON.stringify(c)}`);
  if (w === W) { await page.screenshot({ path: `${out}/_card.png` }); toWebp(`${out}/_card.png`, 'card'); }
  await page.close();
}

// ⑤ 썸네일 (카드에 쓰는 파일 그대로)
if (only.has('thumbs')) {
  const ids = [['rapier', '레이피어'], ['dartagnan', '달타냥'], ['balisarda', '발리사르다'], ['chixiao', '파펜하이머']];
  const img = (id) => `data:image/webp;base64,${fs.readFileSync(`public/ui/weapons/${id}.webp`).toString('base64')}`;
  await htmlShot(`<html><body style="margin:0;background:#2a2a33;display:flex;gap:6px;justify-content:center;align-items:center;height:${H}px;font-family:sans-serif;color:#e8e2d0">${ids.map(([id, ko]) => `<figure style="margin:0;text-align:center"><img src="${img(id)}" style="width:196px;height:196px;background:radial-gradient(circle at 50% 45%, #3a2c20, #17110d 70%);border-radius:10px"><figcaption style="font-size:17px;margin-top:4px">${ko}</figcaption></figure>`).join('')}</body></html>`, 'thumbs_italian');
}
await browser.close();
fs.writeFileSync(`${out}/shots.json`, JSON.stringify({ report, errors }, null, 1) + '\n');
console.log(JSON.stringify(report));
console.log(errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'ZERO console errors');
process.exit(errors.length ? 1 : 0);

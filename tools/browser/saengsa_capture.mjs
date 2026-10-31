// 생사전 1단계 사진 · 넘침 점검 (docs/design/saengsa_2026-10-29.md §9): 1280×720 · 844×390 · 932×430 마다
//  ⓪ 입장 조건을 못 채운 저장(호칭 · 무기 둘) — 안내 줄 · '생사전 입장' 꺼짐 · '대진표' (사장님 10/29 18:2x)
//  ① 정복자 호칭 + 무기 다섯을 저장에 넣고 신청 창(10/29 23:00 — ?saengsaNow) 대기실 생사전 칸 빈 판 · 동료 고르기 카드(둘째 자리 = 무명 검객 · 무기 배정) · 다 고른 판 → 입장(신청) → 생사전 화면(첫 대진 전)
//  ② 다음 날 10:05 — 대진표(상대끼리 첫 대진 끝 · 내 경기 '입장 가능') · 무기 배정 창 · 경기 화면(나 + 무명 검객 카드 고름) · 결과 · 대기실 칸(대회 진행 중)
//  점검: 화면이 옆 · 아래로 넘치지 않는가(대기실 · 생사전 화면 · 경기 화면) · 입장 단추가 칸 안인가 · 카드 · 경기 칸이 서로 겹치지 않는가 · 글이 잘리는가(말줄임 수)
//  node node_modules/vite/bin/vite.js --port 5391 → node tools/browser/saengsa_capture.mjs http://127.0.0.1:5391 dist/saengsa_shots
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:5391', out = process.argv[3] || 'dist/saengsa_shots';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const SIZES = [['pc', 1280, 720, false], ['phone844', 844, 390, true], ['phone932', 932, 430, true], ['narrow568', 568, 320, true]]; // 568 = 좁은 화면(폭 679 이하) 점검
const IGNORED = /deprecated parameters for the initialization function/;
const report = [], saved = [], errors = [];
const inRoot = (p, body) => p.evaluate(new Function(`const root=document.querySelector('#gameEntrance').shadowRoot;${body}`));
// 넘침 · 겹침 셈 (덮개 Shadow root 안)
const METRICS = `
  const W=innerWidth,H=innerHeight,vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';};
  const out=[];const over=(sel)=>{for(const e of root.querySelectorAll(sel)){if(!vis(e))continue;const r=e.getBoundingClientRect();if(r.right>W+1||r.bottom>H+1||r.left<-1||r.top<-1)out.push(sel+' '+[r.left,r.top,r.right,r.bottom].map(Math.round).join(','));}};
  over('.lobby-columns');over('.contents-panel');over('#saengsaEnter');over('#sgLook');over('.sg-board');over('.sg-mf .primary');over('.sg-mf .secondary');over('#sgArmOk');over('.lobby-header');
  const box=(e)=>e&&vis(e)?e.getBoundingClientRect():null;
  const inside=(a,b)=>!a||!b||(a.left>=b.left-1&&a.right<=b.right+1&&a.top>=b.top-1&&a.bottom<=b.bottom+1);
  const host=root.getElementById('saengsaHost');
  if(host&&vis(host)&&!inside(box(root.getElementById('saengsaEnter')),box(host)))out.push('입장 단추가 칸 밖');
  const pairs=(sel)=>{const l=[...root.querySelectorAll(sel)].filter(vis).map(e=>e.getBoundingClientRect());let n=0;for(let i=0;i<l.length;i++)for(let j=i+1;j<l.length;j++){const a=l[i],b=l[j];if(a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1)n++;}return n;};
  const scroll=(e)=>e&&vis(e)?{h:e.scrollHeight-e.clientHeight,w:e.scrollWidth-e.clientWidth}:null;
  const clipped=[...root.querySelectorAll('.sg-tn,.sg-name,.sg-slot-name,.sg-slot-weapon,.sg-wpn>span,.sg-inj,.sg-m-state,.sg-next,.sg-pick-name')].filter(e=>vis(e)&&(e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1)).map(e=>e.textContent.trim()).slice(0,12);
  return {overflow:out,overlapCards:pairs('.sg-card'),overlapMatches:pairs('.sg-m'),overlapSlots:pairs('.sg-slot'),scrollPage:scroll(root.querySelector('.saengsa')),scrollLobby:scroll(root.querySelector('.lobby')),
    scrollMatch:scroll(root.getElementById('sgMatch')),scrollPanelBody:scroll(root.querySelector('.sg-body')),scrollPicker:scroll(root.getElementById('sgPicker')),scrollArm:scroll(root.getElementById('sgArm')),clipped};`;
for (const [size, width, height, phone] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
  await ctx.route('https://*.supabase.co/**', (route) => route.abort());
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${size}: ${e}`));
  p.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(`${size}: ${m.text()}`); });
  const tap = (sel) => (phone ? p.locator(sel).first().tap() : p.locator(sel).first().click());
  const shot = async (name) => {
    await p.waitForTimeout(250);
    const path = `${out}/saengsa_${name}_${size}.png`;
    await p.screenshot({ path });
    saved.push(path);
    report.push({ size, name, ...(await inRoot(p, METRICS)) });
  };
  const toLobby = async (now, first) => {
    await p.goto(`${base}/?saengsaNow=${now}&coins=600`, { waitUntil: 'networkidle' });
    await p.waitForFunction(() => { const r = document.querySelector('#gameEntrance')?.shadowRoot; return r?.getElementById('noticeDialog')?.open || r?.getElementById('entrance')?.dataset.phase === 'ready'; }, null, { timeout: 60000 });
    if (await inRoot(p, `return root.getElementById('noticeDialog').open;`)) await tap('#confirmNotices'); // 공지는 열 때마다 (안 읽은 소식)
    await p.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot?.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 60000 });
    await p.waitForFunction(() => !document.querySelector('#gameEntrance').shadowRoot.getElementById('enterLobby').disabled, null, { timeout: 90000 });
    await tap('#enterLobby');
    await p.locator('#lobbyPortraitImg').waitFor({ state: 'attached', timeout: 90000 });
    await p.evaluate(() => document.fonts.ready);
    for (let i = 0; i < 4; i++) { // 처음 들어올 때의 알림 창(스킬트리 옮김 · 방랑 · 호칭)을 닫는다
      const open = await inRoot(p, `const d=[...root.querySelectorAll('dialog[open]')][0];return d?d.querySelector('.dialog-actions button')?.id??null:null;`);
      if (!open) break;
      await tap(`#${open}`);
      await p.waitForTimeout(150);
    }
    await tap('#tabEvent');
  };
  // ⓪ 입장 조건을 못 채운 저장
  await toLobby('2026-10-29T23:00', true);
  await shot('panel-blocked');
  // ① 정복자 호칭 + 무기 다섯(시작 무기 둘 + 셋 — 상점이 생기면 그 receipt 꼴 'weapon:<id>')
  await p.evaluate(() => {
    const k = 'stillness.lobby.progress.v1', v = JSON.parse(localStorage.getItem(k) || '{"version":1}');
    v.titles = [...(v.titles || []).filter((t) => t.event !== 'conqueror'), { event: 'conqueror', name: '정복자', seen: true }];
    v.acquisitions = [...(v.acquisitions || []).filter((a) => !String(a.receipt).startsWith('weapon:')), ...['longsword', 'rapier', 'uchigatana'].map((id) => ({ receipt: `weapon:${id}`, kind: 'item' }))];
    localStorage.setItem(k, JSON.stringify(v));
  });
  await toLobby('2026-10-29T23:00', false);
  await shot('panel-signup');
  await tap('.sg-slot[data-slot="1"]');
  await tap('.sg-pick[data-id="minami"]');
  await tap('.sg-chip-btn[data-weapon="rapier"]');
  await tap('#sgPickOk');
  await tap('.sg-slot[data-slot="2"]');
  await tap('.sg-pick[data-id="nameless"]'); // 무명 검객 (사장님 10/29 15:5x — 고용비 20)
  await tap('.sg-chip-btn[data-weapon="uchigatana"]');
  await p.waitForTimeout(300); // 옷 색 얼굴을 칠하는 동안
  await shot('picker');
  await tap('#sgPickOk');
  await tap('.sg-slot[data-slot="0"]');
  await tap('.sg-chip-btn[data-weapon="longsword"]');
  await tap('#sgPickOk');
  await shot('panel-ready');
  await tap('#saengsaEnter');
  await p.locator('.sg-bracket').waitFor({ state: 'visible', timeout: 30000 });
  await shot('page-waiting');
  // ② 다음 날 10:05
  await toLobby('2026-10-30T10:05', false);
  await shot('panel-running');
  await tap('#saengsaEnter');
  await p.locator('.sg-m[data-state="ready"]').waitFor({ state: 'visible', timeout: 30000 });
  await shot('page-ready');
  await tap('.sg-m[data-state="ready"]');
  await tap('#sgArmBtn'); // 경기마다 무기 배정 — 나를 드루이드의 채찍으로
  await tap('#sgArmRows .sg-chip-btn[data-slot="0"][data-weapon="druid_whip"]');
  await shot('arm');
  await tap('#sgArmOk');
  await tap('button.sg-card[data-key="0-0"]');
  await tap('button.sg-card[data-key="0-2"]'); // 무명 검객
  await shot('match-pick');
  await tap('#sgFight');
  await p.locator('#sgDone').waitFor({ state: 'visible', timeout: 10000 });
  await shot('match-result');
  await tap('#sgDone');
  await shot('page-after');
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${out}/saengsa_report.json`, JSON.stringify({ saved, report, errors }, null, 1));
for (const r of report) console.log(r.size, r.name, JSON.stringify({ o: r.overflow, cards: r.overlapCards, m: r.overlapMatches, s: r.overlapSlots, page: r.scrollPage, lobby: r.scrollLobby, match: r.scrollMatch, body: r.scrollPanelBody, pick: r.scrollPicker, arm: r.scrollArm, clip: r.clipped }));
console.log(errors.length ? errors.join('\n') : 'no page errors');

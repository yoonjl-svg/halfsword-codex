// 카드 앞면 점검: 화면 크기마다 무기 14종을 세 장씩 채워 뒤집고, 글자·그림이 테두리 안에 들어가는지 잰다.
//  실행: vite 개발 서버를 띄운 뒤  node tools/cardface/face_check.mjs http://127.0.0.1:5173 [--shots=폴더]
//  --shots 를 주면 844×390·568×320 에서 기본·픽셀 모드의 고르기 전·뒤집힌 뒤를 찍어 둔다.
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로를 바꾸려면 PW_CHROMIUM
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const shots = (process.argv.find((a) => a.startsWith('--shots=')) || '').slice(8);
if (shots) fs.mkdirSync(shots, { recursive: true });
const SIZES = [
  [568, 320],
  [667, 375],
  [844, 390],
  [932, 430],
  [1280, 720],
  [1920, 1080],
];
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [];
let bad = 0;
let checked = 0;
const thumbMin = {};
const pxOf = {};
for (const [w, h] of SIZES.filter(([w]) => !process.env.ONLY || process.env.ONLY.split(',').includes(String(w))))
  for (const mode of shots && (w === 844 || w === 568) ? ['default', 'pixel'] : ['default']) {
    const touch = w < 1000;
    const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    page.on('pageerror', (e) => errors.push(`${w}×${h} pageerror: ${e}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`${w}×${h} console: ${m.text()}`));
    await page.addInitScript((px) => localStorage.setItem('gladiator-settings', JSON.stringify({ pixel: px })), mode === 'pixel');
    await page.goto(`${base}/?stage=poseidon&foe=heinrich`, { waitUntil: 'load' });
    await page.waitForFunction('window.game && window.game.enemy', { timeout: 30000 });
    await page.evaluate(() => document.getElementById('btnStart').click());
    await page.waitForFunction('window.game.draw && window.game.draw.stage === "choose"', { timeout: 15000 });
    await page.waitForTimeout(1600);
    await page.evaluate(() => (window.game.draw.hold = true));
    pxOf[`${w}×${h}`] = await page.evaluate(() => getComputedStyle(document.getElementById('draw')).getPropertyValue('--px'));
    if (shots) {
      await page.waitForTimeout(1500); // 카드가 다 깔린 뒤에 찍는다 (작은 화면은 소개 글이 늦게 걷힌다)
      await page.screenshot({ path: `${shots}/${w}x${h}_${mode}_choose.png` });
    }
    const ids = await page.evaluate(async () => (await import('/src/weapons.js')).WEAPON_LIST.map((x) => x.id));
    // 무기 세 개씩 카드에 채운다 (main.js openDraw 와 같은 방법). 마지막 묶음은 앞에서 채운다
    for (let k = 0; k < ids.length; k += 3) {
      const group = [0, 1, 2].map((j) => ids[(k + j) % ids.length]);
      const res = await page.evaluate(async (group) => {
        const { getWeapon } = await import('/src/weapons.js');
        const TIER_KO = { trash: '쓰레기', common: '커먼', rare: '레어', epic: '에픽', legend: '레전드' };
        const cards = [...document.querySelectorAll('#draw .wcard')];
        cards.forEach((el, i) => {
          const wp = getWeapon(group[i]);
          el.dataset.tier = wp.tier || 'common';
          const [, main, sub] = wp.nameKo.match(/^(.*?)\s*\((.*)\)\s*$/) || [null, wp.nameKo, ''];
          const th = el.querySelector('.wthumb');
          if (getComputedStyle(th).getPropertyValue('--th24') !== undefined) for (const n of [32, 24, 16]) th.style.setProperty(`--th${n}`, `url("ui/weapons_px/${wp.id}_${n}.png")`);
          el.querySelector('.wname').textContent = main;
          el.querySelector('.wsub').textContent = sub;
          el.querySelector('.wtier').textContent = TIER_KO[wp.tier] || TIER_KO.common;
          el.querySelector('.wdesc').textContent = wp.desc || '';
          el.classList.add('flipped');
          el.classList.toggle('picked', i === 0);
          el.classList.toggle('missed', i === 1);
        });
        document.getElementById('draw').classList.replace('choose', 'reveal');
        await new Promise((r) => setTimeout(r, 1300)); // 뒤집기(.45초)·고른 카드 들림이 끝난 뒤에 잰다
        // 잰다: 앞면 안쪽(테두리 세 칸 안)에 이름·부제·등급·설명·"누구" 딱지가 다 들어가는가, 설명이 잘리지 않았는가
        const px = parseFloat(getComputedStyle(document.getElementById('draw')).getPropertyValue('--px')) || 0;
        return cards.map((el, i) => {
          const face = el.querySelector('.wface');
          const fr = face.getBoundingClientRect();
          const inset = 3 * px - 0.5;
          const out = [];
          for (const sel of ['.wwho', '.wname', '.wsub', '.wtier', '.wdesc']) {
            const c = face.querySelector(sel);
            if (!c || getComputedStyle(c).display === 'none') continue;
            const r = c.getBoundingClientRect();
            if (r.top < fr.top + inset || r.bottom > fr.bottom - inset || r.left < fr.left + inset || r.right > fr.right - inset) out.push(sel);
            if (c.scrollWidth > c.clientWidth + 1) out.push(sel + '(가로)');
          }
          const th = face.querySelector('.wthumb').getBoundingClientRect();
          if (th.height < 20) out.push(`.wthumb 높이 ${Math.round(th.height)}px`);
          return { id: group[i], out, thumbH: Math.round(th.height) };
        });
      }, group);
      for (const r of res) {
        (thumbMin[`${w}×${h}`] ??= []).push(r.thumbH);
        checked++;
        if (r.out.length) {
          bad++;
          console.log(`${w}×${h} ${mode} ${r.id}: 넘침 ${r.out.join(', ')}`);
        }
      }
      if (shots && k === 0) await page.screenshot({ path: `${shots}/${w}x${h}_${mode}_flipped.png` });
    }
    await page.close();
  }
for (const [k, v] of Object.entries(thumbMin)) console.log(`${k}: 그림 칸 높이 ${Math.min(...v)}~${Math.max(...v)}px, px ${pxOf[k]}`);
console.log(`확인 ${checked}장, 넘침 ${bad}장, 콘솔 에러 ${errors.length}`, errors.slice(0, 3));
await browser.close();

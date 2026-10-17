import fs from 'node:fs/promises';
import {chromium} from '/workspace/halfsword-codex/node_modules/playwright/index.mjs';
const root='/workspace/portrait-alter-originals-frame1-v2-20261017';
const records=JSON.parse(await fs.readFile(`${root}/completed-records.json`,'utf8'));
const html=`<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:12px;background:#201b17;color:#f1e9d7;font:16px sans-serif}main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0}img{display:block;width:100%;height:auto}figcaption{height:27px;text-align:center;padding-top:4px}</style><main>${records.map(r=>`<figure><img src="${r.id}.png"><figcaption>${r.name}</figcaption></figure>`).join('')}</main>`;
await fs.writeFile(`${root}/review-sheet.html`,html);
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-background-networking']});
try {const p=await browser.newPage({viewport:{width:1440,height:1640},deviceScaleFactor:1});await p.goto(`http://127.0.0.1:4329/review-sheet.html`);await p.locator('img').evaluateAll(xs=>Promise.all(xs.map(x=>x.decode())));await p.screenshot({path:`${root}/review-sheet.png`,fullPage:true});console.log('Captured browser contact sheet; originals unchanged');}finally{await browser.close();}

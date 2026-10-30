import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM??'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
try {
 await page.goto(process.argv[2]??'http://127.0.0.1:4188/');
 await page.locator('#confirmNotices').waitFor({timeout:90000});await page.locator('#confirmNotices').tap();await page.locator('#enterLobby').tap();await page.locator('#tabEncyclopedia').waitFor();
 // First entry may have the existing skill-tree migration notice.
 if(await page.locator('#treeDialog[open]').count())await page.locator('#closeTree').tap();
 if(await page.locator('#titleDialog[open]').count())await page.locator('#closeTitle').tap();
 const before=await page.evaluate(()=>JSON.stringify(Object.entries(localStorage)));
 await page.locator('#tabEncyclopedia').tap();assert.equal(await page.locator('.ec-card').count(),36);
 await page.locator('#ecCharactersTab').tap();assert.equal(await page.locator('.ec-card').count(),38);
 await page.locator('.ec-search input').fill('쥘리아');await page.locator('[data-entry="julia"]').tap();await page.locator('.ec-related').tap();await page.locator('.ec-back').tap();
 assert.equal(await page.evaluate(()=>JSON.stringify(Object.entries(localStorage))),before);
 await page.locator('#tabItems').tap();assert.ok(await page.locator('#panelInventory').isVisible());
 assert.deepEqual(errors,[]);
 await writeFile('docs/design/encyclopedia_20261031/game-integration.json',JSON.stringify({compiledGame:true,titleToLobby:true,catalog:true,items:36,characters:38,touch:true,saveUnchanged:true,errors},null,2));
 console.log('Full game integration passed');
} finally {await browser.close();}

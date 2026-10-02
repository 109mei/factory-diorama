/** Real-browser DOM/interaction QA. No screenshots or recordings are produced. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const baseURL=process.env.BASE_URL||'http://127.0.0.1:4173/',out='docs/qa',key='mine-line.save.v2';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const saved=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
try{
 await page.goto(baseURL);await page.locator('canvas').waitFor({timeout:10000});await page.waitForTimeout(300);await page.clock.install();await page.clock.fastForward(8000);
 assert.equal(await page.locator('.world-label').count(),0);await page.clock.fastForward(43000);const action=page.locator('[data-upgrade]');assert.equal(await action.isEnabled(),true);await action.click();assert.match(await page.locator('[data-detail-level]').textContent(),/02/);await page.reload();await page.waitForTimeout(250);assert.equal((await saved()).state.levels.mine,2);
 for(const station of ['crusher','sorter','smelter','press','packer']){
  await page.locator(`[data-station="${station}"]`).click();for(let tries=0;!await action.isEnabled()&&tries<30;tries++)await page.clock.fastForward(60000);
  assert.equal(await action.isEnabled(),true,`unlock ${station}`);await action.click();assert.match(await page.locator('[data-detail-level]').textContent(),/LEVEL/);if(await action.isEnabled())await action.click();
 }
 await page.clock.fastForward(180000);const expanded=await saved();assert.equal(expanded.state.unlocked,5);assert.equal(expanded.state.mined,expanded.state.shipped+expanded.state.items.length);await page.getByRole('button',{name:'工場全体を表示'}).click();await page.clock.fastForward(1500);
 for(const [width,height] of [[320,568],[844,390],[1280,900]]){await page.setViewportSize({width,height});await page.waitForTimeout(150);const b=await action.boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=width&&b.y+b.height<=height);}
 await page.setViewportSize({width:320,height:568});await page.getByRole('button',{name:'遊び方を開く'}).click();await page.getByRole('button',{name:'遊び方を閉じる'}).click();
 const original=await saved(),offlineContext=await browser.newContext();await offlineContext.addInitScript(({save,key})=>{save.savedAt=Date.now()-7200000;localStorage.setItem(key,JSON.stringify(save));},{save:original,key});const offlinePage=await offlineContext.newPage();await offlinePage.goto(baseURL);await offlinePage.locator('canvas').waitFor();const offline=await offlinePage.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);assert.ok(offline.state.credits>original.state.credits);assert.ok(offline.state.ticks-original.state.ticks<=18020);await offlineContext.close();
 const badContext=await browser.newContext();await badContext.addInitScript(k=>localStorage.setItem(k,'corrupt'),key);const bad=await badContext.newPage();await bad.goto(baseURL);await bad.locator('canvas').waitFor();assert.equal((await bad.evaluate(k=>JSON.parse(localStorage.getItem(k)),key)).state.credits,0);await badContext.close();
 assert.equal(errors.length,0,errors.join('\n'));const result={baseURL,unlocked:expanded.state.unlocked,shipped:expanded.state.shipped,errors,checks:'WebGL boot, first upgrade, five paid unlocks, no labels, camera overview, saved progress, responsive controls, help, offline cap, corrupt recovery'};await writeFile(`${out}/browser-results-v2.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}

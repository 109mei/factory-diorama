/** Browser QA for a working Chromium environment. Screenshots are real captures. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const baseURL=process.env.BASE_URL||'http://127.0.0.1:4173/';
const executablePath=process.env.CHROMIUM_PATH||'/usr/bin/chromium';
const out='docs/qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
const page=await context.newPage();const errors=[];const findings=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
async function capture(name){await page.screenshot({path:`${out}/${name}.png`});}
async function readSave(){return page.evaluate(()=>JSON.parse(localStorage.getItem('mine-line.save.v1')));}
try{
 await page.goto(baseURL);await page.locator('canvas').waitFor();await page.waitForTimeout(1000);
 await page.clock.install();await page.clock.fastForward(8000);
 assert.equal(await page.locator('[data-help-panel]').isVisible(),false);
 await capture('portrait-initial-390x844');
 await page.clock.fastForward(26000);const upgrade=page.locator('[data-upgrade]');assert.equal(await upgrade.isEnabled(),true);
 await upgrade.click();assert.match(await page.locator('[data-detail-level]').textContent(),/02/);
 const firstSave=await readSave();assert.equal(firstSave.state.levels.mine,2);assert.ok(firstSave.state.credits>=0);
 await capture('portrait-first-upgrade-390x844');
 await page.reload();await page.waitForTimeout(300);assert.match(await page.locator('[data-detail-level]').textContent(),/02/);
 await page.clock.fastForward(180000);
 for(const station of ['smelter','press','shipping']){await page.locator(`[data-station="${station}"]`).click();if(await upgrade.isEnabled())await upgrade.click();assert.match(await page.locator('[data-detail-level]').textContent(),/02/);}
 await capture('portrait-expanded-390x844');
 const expanded=await readSave();assert.ok(expanded.state.shipped>20);assert.equal(expanded.state.mined,expanded.state.shipped+expanded.state.items.length);
 for(const [width,height] of [[320,568],[844,390],[1280,900]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(250);
  const bounds=await upgrade.boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width&&bounds.y+bounds.height<=height,`upgrade visible ${width}x${height}`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
  await capture(`responsive-${width}x${height}`);
 }
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'遊び方を開く'}).click();assert.equal(await page.locator('[data-help-panel]').isVisible(),true);await capture('help-390x844');await page.getByRole('button',{name:'遊び方を閉じる'}).click();
 const metrics=await page.evaluate(()=>window.__factory?.metrics()??null);
 const original=await readSave();
 // Seed in a fresh document before the app starts; pagehide cannot overwrite it.
 const offlineContext=await browser.newContext({viewport:{width:390,height:844}});
 await offlineContext.addInitScript(save=>{save.savedAt=Date.now()-7200000;localStorage.setItem('mine-line.save.v1',JSON.stringify(save));},original);
 const offlinePage=await offlineContext.newPage();await offlinePage.goto(baseURL);await offlinePage.locator('canvas').waitFor();
 const offline=await offlinePage.evaluate(()=>JSON.parse(localStorage.getItem('mine-line.save.v1')));
 assert.ok(offline.state.credits>original.state.credits);assert.ok(offline.state.ticks-original.state.ticks<=18020);await offlineContext.close();
 const corruptContext=await browser.newContext({viewport:{width:390,height:844}});
 await corruptContext.addInitScript(()=>localStorage.setItem('mine-line.save.v1','corrupt'));
 const corruptPage=await corruptContext.newPage();await corruptPage.goto(baseURL);await corruptPage.locator('canvas').waitFor();
 const recovered=await corruptPage.evaluate(()=>JSON.parse(localStorage.getItem('mine-line.save.v1')));
 assert.equal(recovered.state.credits,0);await corruptContext.close();
 assert.equal(errors.length,0,errors.join('\n'));
 findings.push({baseURL,viewports:['390×844','320×568','844×390','1280×900'],metrics,firstUpgrade:firstSave.state.levels.mine,expandedLevels:expanded.state.levels,shipped:expanded.state.shipped,errors,checks:'boot, first upgrade, all station upgrades, reload, 3-minute advancement, responsive controls, help, offline cap, corrupt-save recovery'});
 await writeFile(`${out}/browser-results.json`,JSON.stringify(findings,null,2));console.log(JSON.stringify(findings,null,2));
}finally{await browser.close();}

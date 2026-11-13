import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const previewUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:4175';
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH, headless: true, args: ['--no-proxy-server'] });
await mkdir(new URL('../.qa/',import.meta.url),{recursive:true});
const context=await browser.newContext({viewport:{width:1440,height:1100},deviceScaleFactor:1});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const screenshot=async name=>page.screenshot({path:fileURLToPath(new URL(`../.qa/${name}.png`,import.meta.url)),fullPage:true});
try {
 await page.goto(previewUrl);await page.waitForSelector('#record-form');assert.match(await page.textContent('#mode'),/로컬 체험/);await screenshot('record-desktop');
 await page.click('#sample');await page.click('#record-form button[type=submit]');await page.waitForSelector('.fitness-card');assert.match(await page.textContent('.class-name'),/힘형/);await screenshot('card-desktop');
 await page.selectOption('#template','receipt');assert.match(await page.textContent('.card-type'),/영수증/);await page.selectOption('#template','stat');
 const download=page.waitForEvent('download');await page.click('#download-card');assert.match((await download).suggestedFilename(),/fitcard-stat.png/);
 await page.click('#go-battle');await page.waitForSelector('#arena-canvas');await page.click('#attack');await page.waitForFunction(()=>document.querySelector('#attack')?.textContent.includes('HIT'));
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('fitcard-app-v1')).player);await page.click('#attack');await page.waitForTimeout(1600);const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('fitcard-app-v1')).player);assert.ok(after.level>before.level);assert.ok(after.hp<before.hp);await screenshot('battle-desktop');
 await page.click('[data-claim=login]');await page.waitForFunction(()=>document.querySelector('[data-claim=login]')?.textContent==='받음');
 await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('fitcard-app-v1'));s.player.hp=0;s.player.status='dead';s.player.boss_hp=1;localStorage.setItem('fitcard-app-v1',JSON.stringify(s));});await page.reload();await page.waitForFunction(()=>document.querySelector('#attack')?.textContent.includes('부활권 1장'));await page.click('#attack');await page.waitForFunction(()=>document.querySelector('#attack')?.textContent.includes('HIT'));const revived=await page.evaluate(()=>JSON.parse(localStorage.getItem('fitcard-app-v1')).player);assert.equal(revived.boss_hp,1);assert.equal(revived.tickets,0);
 await page.click('a[href="#ranking"]');await page.waitForSelector('.rank-table');assert.match(await page.textContent('.rank-table'),/나의 FitCard/);await page.click('[data-rank=month]');await page.waitForSelector('.rank-table');await page.click('[data-rank=week]');await page.waitForSelector('.rank-table');await screenshot('ranking-desktop');
 await page.setViewportSize({width:390,height:844});await page.click('a[href="#record"]');await page.waitForSelector('#record-form');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await screenshot('record-mobile');
 await page.click('a[href="#battle"]');await page.waitForSelector('#arena-canvas');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await screenshot('battle-mobile');
 assert.deepEqual(errors,[]);console.log('Browser checks passed: record, 6-style selector, download, battle, persistent revival, 3 rankings, mobile layout.');
 if(process.env.FITCARD_LIVE_BROWSER==='1'){
  const live=await browser.newContext(),lp=await live.newPage(),liveErrors=[];lp.on('pageerror',e=>liveErrors.push(e.message));
  await lp.goto(process.env.LIVE_PREVIEW_URL || previewUrl);await lp.waitForSelector('#record-form');
  assert.doesNotMatch(await lp.textContent('#mode'),/로컬 체험/);
  await lp.click('#sample');await lp.click('#record-form button[type=submit]');await lp.waitForSelector('.fitness-card');
  await lp.click('a[href="#ranking"]');await lp.waitForSelector('#ranking-content');await lp.waitForFunction(()=>{const panel=document.querySelector('#ranking-content');return panel && !panel.querySelector('.loading');});assert.match(await lp.textContent('#ranking-content'),/이번 기간의 기록|트레이너/);
  await lp.click('#login-open');await lp.waitForSelector('#login-dialog[open]');assert.equal(await lp.locator('#kakao-login').isDisabled(),true);assert.match(await lp.textContent('#login-note'),/준비 중/);
  assert.deepEqual(liveErrors,[]);await live.close();console.log('Live browser checks passed: real configuration, guest card preview, hosted ranking, pending Kakao setup messaging.');
 }
}finally{await browser.close();}

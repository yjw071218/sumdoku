const assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://api.github.com/**',r=>r.fulfill({json:{tag_name:'v1.0.29'}}));
  await page.goto('file:///'+path.resolve('app/src/main/assets/index.html').replace(/\\/g,'/'));
  await page.waitForFunction(()=>window.app);
  for(const theme of ['theme-light','theme-dark','theme-sepia']){
   await page.evaluate(t=>app.applyTheme(t),theme);
   for(const width of [320,390,768]){
    await page.setViewportSize({width,height:844});
    assert(await page.evaluate(()=>{const el=document.querySelector('.home-container');return el.scrollWidth<=el.clientWidth+1}),'home horizontal overflow');
   }
   await page.setViewportSize({width:390,height:844});
   await page.screenshot({path:path.join(os.tmpdir(),`sumdoku-home-${theme}.png`)});
  }
  await page.evaluate(()=>app.applyTheme('theme-dark'));
  await page.locator('#btn-home-battle').click();
  await page.waitForFunction(()=>document.activeElement.closest('#modal-battle-lobby'));
  assert.equal(await page.locator('#modal-battle-lobby .modal-card').getAttribute('role'),'dialog');
  const score=page.locator('[data-bmode="score"]');await score.focus();await page.keyboard.press('Enter');
  assert.equal(await score.getAttribute('aria-pressed'),'true');
  await page.locator('#tab-battle-join').click();
  assert.equal(await page.locator('#tab-battle-join').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#tab-battle-host').getAttribute('aria-pressed'),'false');
  await page.locator('#battle-input-target').focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#battle-input-target').getAttribute('aria-invalid'),'true');
  assert.match(await page.locator('#battle-connect-error').textContent(),/12자리/);
  await page.locator('#battle-input-target').fill('invalid');
  assert.equal(await page.locator('#battle-connect-error').textContent(),'');
  await page.keyboard.press('Enter');
  assert((await page.locator('#battle-connect-error').textContent()).length>0);
  await page.locator('#btn-battle-connect').focus();await page.keyboard.press('Tab');
  assert(await page.evaluate(()=>document.activeElement.closest('#modal-battle-lobby')!==null),'focus trapped');
  await page.screenshot({path:path.join(os.tmpdir(),'sumdoku-lobby-polish.png')});
  await page.locator('#btn-battle-close').click();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'btn-home-battle');
  await page.evaluate(()=>{
   window.AndroidBridge={startBattleServer:()=>JSON.stringify({ok:true,ip:'192.168.1.2'}),stopBattleServer:()=>{},copyToClipboard:text=>window.copied=text};
   app.openBattleLobby();app.createHostRoom();clearInterval(app.hostPollTimer);
  });
  await page.locator('#battle-my-code').focus();await page.keyboard.press('Enter');
  assert.match(await page.evaluate(()=>window.copied),/^\d{12}$/);
  assert.equal(await page.locator('#toast').getAttribute('role'),'status');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,checks:['three themes','home overflow','keyboard mode selection','inline connection errors','dialog focus trap and restore','keyboard room-code copy','live toast']}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 let cases=0;
 try {
  for(const [width,height,safe] of [[320,568,30],[390,844,44],[740,360,30],[1024,768,32]]) {
   const page=await browser.newPage({viewport:{width,height}});
   await page.route('https://api.github.com/**',r=>r.fulfill({json:{}}));
   await page.route('http://127.0.0.1:8888/**',r=>r.fulfill({json:{ok:true,status:'playing',messages:[],p1:{},p2:{}}}));
   await page.addInitScript(safe=>{window.AndroidBridge={getDeviceStatus:()=>JSON.stringify({safeTop:safe,level:70})};},safe);
   await page.goto('file:///'+path.resolve('app/src/main/assets/index.html').replace(/\\/g,'/'));
   await page.waitForFunction(()=>window.app&&document.getElementById('app-statusbar'));
   const collapsed=await page.evaluate(()=>{
    const results=[];
    for(const [open,id] of [['openDifficultyModal','modal-difficulty'],['openBattleLobby','modal-battle-lobby']]) {
     app[open]();const modal=document.getElementById(id),panel=modal.querySelector('.quick-settings');
     results.push(!panel.open);panel.open=true;app.syncQuickSettings();results.push(panel.open);
     modal.classList.add('hidden');app[open]();results.push(!panel.open);modal.classList.add('hidden');
    }
    return results;
   });
   assert.ok(collapsed.every(Boolean),'initial/reopened panels collapsed; sync keeps manual expansion');
   for(const battle of [false,true]) {
    await page.evaluate(battle=>{
     const solution=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*3+Math.floor(r/3)+c)%9+1));
     const cages=solution.flatMap((row,r)=>row.map((sum,c)=>({sum,cells:[[r,c]]})));
     if(battle){app.battleHostIp='127.0.0.1';app.startBattleMatch(1,{solution,cages,difficulty:'easy'},'turn');clearInterval(app.battlePollInterval);clearInterval(app.modeTimer);}
     else app.startNewGame('easy',null,'standard',{solution,cages});
     app.dom.btnGameSettings.click();
    },battle);
    await page.waitForTimeout(450);
    const bounds=await page.evaluate(()=>{
     const card=document.querySelector('#modal-settings .modal-card'),r=card.getBoundingClientRect(),bar=document.getElementById('app-statusbar').getBoundingClientRect();
     const header=card.querySelector('.modal-settings-header').getBoundingClientRect();
     card.scrollTop=card.scrollHeight;const scrolled=card.scrollTop>0;
     app.dom.btnSettingsClose.click();app.dom.btnGameSettings.click();
     return {top:r.top-bar.bottom,bottom:innerHeight-r.bottom,header:header.top>=r.top,
      radius:parseFloat(getComputedStyle(card).borderTopLeftRadius),reset:card.scrollTop===0,scrolled};
    });
    assert.ok(bounds.top>=11&&bounds.bottom>=11&&bounds.header&&bounds.radius>0&&bounds.reset,JSON.stringify({width,height,battle,bounds}));
    await page.evaluate(()=>app.dom.btnSettingsClose.click());cases++;
   }
   await page.close();
  }
  console.log(`PASS: ${cases} normal/battle settings layouts, collapsed reopening and scroll reset`);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

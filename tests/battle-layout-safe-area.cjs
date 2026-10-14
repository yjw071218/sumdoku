const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
 const browser = await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const results = [], errors = [];
 try {
  for (const [width,height] of [[360,640],[390,844],[768,1024],[1280,800]]) {
   const page = await browser.newPage({viewport:{width,height}});
   page.on('pageerror', e => errors.push(e.message));
   await page.route('https://api.github.com/**', r => r.fulfill({json:{}}));
   await page.route('http://127.0.0.1:8888/**', r => r.fulfill({json:{ok:true,status:'playing',messages:[],p1:{},p2:{}}}));
   await page.addInitScript(() => { window.AndroidBridge = {getDeviceStatus:()=>JSON.stringify({level:54,charging:false,safeTop:32})}; });
   await page.goto('file:///' + path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));
   await page.waitForFunction(() => window.app && document.getElementById('app-statusbar'));
   for (const mode of ['turn','survival','race']) {
    await page.evaluate(mode => {
     const solution=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*3+Math.floor(r/3)+c)%9+1));
     const cages=solution.flatMap((row,r)=>row.map((sum,c)=>({sum,cells:[[r,c]]})));
     app.battleHostIp='127.0.0.1';app.isRematchActive=false;
     app.startBattleMatch(1,{solution,cages,difficulty:'expert'},mode);
     clearInterval(app.battlePollInterval);clearInterval(app.modeTimer);
     if(mode==='turn'){app.turnState.polledAt=performance.now();app.tickBattleMode();}
     if(mode==='survival'){app.survival.left=135;app.tickBattleMode();}
    }, mode);
    for (const expanded of [false,true]) {
     await page.evaluate(expanded => {if(app.isMultiCageMode!==expanded)app.toggleMultiCageMode();},expanded);
     await page.waitForTimeout(350);
     const geometry=await page.evaluate(()=>{
      const rect=s=>document.querySelector(s).getBoundingClientRect();
      const view=rect('#view-game'),board=rect('.board-frame'),keys=rect('.keypad'),sub=rect('.game-sub-bar');
      const main=document.querySelector('.game-main-content');
      const wide=getComputedStyle(main).flexDirection==='row';
      const banner=document.getElementById('multi-cage-banner');
      return {viewBottom:view.bottom,boardGap:innerHeight-board.bottom,keyGap:innerHeight-keys.bottom,
       topGap:board.top-sub.bottom,wide,banner:getComputedStyle(banner).display!=='none',
       square:Math.abs(board.width-board.height)<1,boardWidth:board.width,
       overlap:!wide&&board.bottom>rect('.controls-column').top+1};
     });
     const id=JSON.stringify({width,height,mode,expanded,geometry});
     assert.ok(geometry.viewBottom<=height+1,id);
     assert.ok(geometry.keyGap>=12,id);
     assert.ok(geometry.square&&geometry.boardWidth>100&&!geometry.overlap,id);
     if(geometry.wide) assert.ok(geometry.boardGap>=24,id);
     else if(!geometry.banner) assert.ok(geometry.topGap<=20,id);
     results.push({width,height,mode,expanded,gap:Math.round(geometry.keyGap)});
    }
   }
   await page.close();
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,cases:results.length,results}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

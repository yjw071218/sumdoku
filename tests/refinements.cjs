const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try {
 const page=await browser.newPage({viewport:{width:390,height:844}}); const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://api.github.com/**',r=>r.fulfill({json:{tag_name:'v1.0.24'}}));
 await page.goto('file:///'+path.resolve('app/src/main/assets/index.html').replace(/\\/g,'/'));
 await page.waitForFunction(()=>window.app);
 const start=()=>page.evaluate(async()=>{
   document.querySelectorAll('.modal-backdrop').forEach(x=>x.classList.add('hidden'));
   const solution=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*3+Math.floor(r/3)+c)%9+1));
   const cages=solution.flatMap((row,r)=>row.map((v,c)=>({sum:v,cells:[[r,c]]})));
   app.isBattle=false; app.isPaused=false; app.isDaily=false;
   await app.startNewGame('easy',null,'standard',{solution,cages,anchorCount:81});
 });
 await start();
 await page.evaluate(()=>{app.score=0;app.selectCell(0,0);app.handleNumberInput(2);});
 assert.equal(await page.evaluate(()=>app.score),-50,'wrong answer can make score negative');
 await page.evaluate(()=>{app.board[0][0].val=0;app.useHint();app.useHint();});
 assert.equal(await page.locator('#hint-confirm').count(),1);
 await page.locator('#hint-confirm [data-cancel]').click();
 assert.equal(await page.evaluate(()=>app.score),-50);
 assert.equal(await page.evaluate(()=>app.pendingHint||null),null);
 await page.evaluate(()=>app.useHint());
 await page.locator('#hint-confirm [data-confirm]').click();
 assert.equal(await page.evaluate(()=>app.score),-80,'charge upon viewing');
 const remaining=await page.evaluate(()=>app.hintsRemaining);
 await page.locator('#btn-hint-card-apply').click();
 assert.equal(await page.evaluate(()=>app.hintsRemaining),remaining,'no second charge on apply');
 assert.equal(await page.evaluate(()=>app.score),-80);
 await start();
 assert.equal(await page.locator('#setting-dark-theme').count(),0);
 assert.equal(await page.locator('#btn-assistant-multi-toggle').count(),0);
 assert.equal(await page.locator('#btn-home-theme').count(),1);
 await page.evaluate(()=>app.applyTheme('theme-light'));
 for(const expected of ['theme-dark','theme-sepia','theme-light']) {
   await page.evaluate(()=>document.getElementById('btn-home-theme').click());
   assert.equal(await page.evaluate(()=>app.themes[app.currentThemeIndex]),expected);
 }
 const solverCheck=await page.evaluate(async()=>{
   const puzzle=await app.generator.generateAsync('easy');
   const plain=app.generator.solveDeductivelyAdvanced(null,puzzle.cages,true);
   const traced=app.generator.solveDeductivelyAdvanced(null,puzzle.cages,true,true);
   return {count:traced.solvedCount,same:JSON.stringify(plain.candidates)===JSON.stringify(traced.candidates),correct:traced.trace.filter(t=>t.after.length===1).every(t=>t.after[0]===puzzle.solution[t.r][t.c])};
 });
 assert.equal(solverCheck.count,81);assert(solverCheck.same);assert(solverCheck.correct);
 const proof=await page.evaluate(()=>{
   app.selectCell(8,8);
   const saved=app.solution;app.solution=null;
   const hint=app.findImmediateHint();app.solution=saved;
   return hint;
 });
 assert.equal(proof.r,0);assert.equal(proof.c,0);assert.equal(proof.answer,1);
 assert(proof.explanation.includes('합 1'));
 await page.evaluate(()=>{app.useHint();});
 await page.locator('#hint-confirm [data-confirm]').click();
 const charged=await page.evaluate(()=>({count:app.hintsRemaining,score:app.score}));
 await page.locator('#btn-hint-card-dismiss').click();
 assert.deepEqual(await page.evaluate(()=>({count:app.hintsRemaining,score:app.score})),charged);
 for(const width of [320,390,680]) {
   await page.setViewportSize({width,height:844});
   const fits=await page.evaluate(()=>{
     app.board[7][4].notes=new Set([1,2,3,4,5,6,7,8,9]);app.updateBoardDisplay();
     const cell=document.querySelector('#sudoku-board .cell[data-r="7"][data-c="4"]');
     const box=cell.getBoundingClientRect();
     return [...cell.querySelectorAll('.note-num')].every(n=>{const r=n.getBoundingClientRect();return r.bottom<=box.bottom&&r.right<=box.right&&r.top>=box.top;});
   });
   assert(fits,`notes contained at ${width}px`);
 }
 await page.setViewportSize({width:390,height:844});
 const lobby=await page.evaluate(async()=>{
   let calls=0;
   window.AndroidBridge={startBattleServer:()=>{calls++;return JSON.stringify({ok:true,ip:'192.168.1.2'});},stopBattleServer:()=>{}};
   app.setupHostRoom();
   const before={calls,hidden:document.getElementById('host-room-stage').classList.contains('hidden')};
   document.getElementById('btn-create-room').click();
   clearInterval(app.hostPollTimer);
   const created={calls,visible:!document.getElementById('host-room-stage').classList.contains('hidden'),disabled:app.dom.btnBattleStartMatch.disabled};
   app.guestJoined=true;app.hostP2Ready=true;app.updateHostLobbyUI();
   const ready={disabled:app.dom.btnBattleStartMatch.disabled,text:app.dom.btnBattleStartMatch.textContent};
   app.hostP2Ready=false;app.updateHostLobbyUI();
   const canceled=app.dom.btnBattleStartMatch.disabled;
   delete window.AndroidBridge;
   return {before,created,ready,canceled};
 });
 assert.equal(lobby.before.calls,0);assert(lobby.before.hidden);
 assert.equal(lobby.created.calls,1);assert(lobby.created.visible);assert(lobby.created.disabled);
 assert.equal(lobby.ready.disabled,false);assert(lobby.ready.text.includes('2/2'));assert(lobby.canceled);
 await start();
 const geometry=await page.evaluate(()=>{
   const before=document.getElementById('board-frame').getBoundingClientRect();
   app.toggleMultiCageMode();app.selectedCages.add(0);app.selectedCages.add(1);app.updateMultiCageCalculation();
   const board=document.getElementById('board-frame').getBoundingClientRect(),banner=app.dom.multiCageBanner.getBoundingClientRect();
   const center=document.elementFromPoint(banner.x+banner.width/2,banner.y+banner.height/2);
   return {beforeY:before.y,boardY:board.y,boardWidth:board.width,bannerTop:banner.top,bannerBottom:banner.bottom,text:app.dom.mcBannerText.textContent,visible:!!center?.closest('#multi-cage-banner')};
 });
 assert.equal(geometry.beforeY,geometry.boardY);assert(geometry.boardWidth>250);
 assert(geometry.bannerBottom<=geometry.boardY);assert(geometry.visible,JSON.stringify(geometry));
 assert.match(geometry.text,/합계: 3/);
 await page.screenshot({path:path.join(require('os').tmpdir(),'sumdoku-mobile-refinements.png')});
 await page.evaluate(()=>{app.score=-10;app.timerSeconds=1;app.board.forEach((row,r)=>row.forEach((cell,c)=>cell.val=app.solution[r][c]));app.checkWinCondition();});
 assert.equal(await page.evaluate(()=>app.score),-10,'completion bonus cannot rescue negative score');
 assert.equal(await page.evaluate(()=>app.currentGameReplay.result),'fail');
 assert(await page.locator('#result-icon svg').count());
 await start();
 const forfeit=await page.evaluate(()=>{
   app.score=99999;app.resultReason='forfeit';const before=app.stats.byDiff.easy.bestScore;
   app.recordGameEnd(true);return {before,after:app.stats.byDiff.easy.bestScore,eligible:app.currentGameReplay.recordEligible,saved:app.loadReplays().some(r=>r.id===app.currentGameReplay.id)};
 });
 assert.equal(forfeit.after,forfeit.before);assert.equal(forfeit.eligible,false);assert(forfeit.saved,'zero-move result saved');
 await page.evaluate(()=>app.switchView('stats'));
 await page.locator('[data-stats-diff="easy"]').click();
 assert.equal(await page.locator('[data-stats-diff="easy"]').getAttribute('aria-pressed'),'true');
 await page.setViewportSize({width:1024,height:768});
 await page.evaluate(()=>app.openHubPanel('panel-settings','다른 제목'));
 assert.equal(await page.locator('#hub-header-title').textContent(),'설정');
 await page.locator('#btn-hub-detail-back').click();
 assert.equal(await page.evaluate(()=>app.currentView),'home');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,checks:['negative penalties','hint confirm/cancel','sum visibility and no layout shift','negative completion','forfeit excluded','zero move replay','difficulty filter','tablet navigation','dynamic SVG','no page errors'],geometry}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});


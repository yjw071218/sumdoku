const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try {
  const page=await browser.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://api.github.com/**',r=>r.fulfill({json:{tag_name:'v1.0.28'}}));
  await page.goto('file:///'+path.resolve('app/src/main/assets/index.html').replace(/\\/g,'/'));
  await page.waitForFunction(()=>window.app);
  const begin=async(role=1)=>page.evaluate(role=>{
   document.querySelectorAll('.modal-backdrop').forEach(e=>e.classList.add('hidden'));
   clearInterval(app.rematchCheckTimer);
   const solution=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*3+Math.floor(r/3)+c)%9+1));
   const cages=solution.flatMap((row,r)=>row.map((sum,c)=>({sum,cells:[[r,c]]})));
   app.battleHostIp='127.0.0.1';app.battleHostUrl='http://127.0.0.1:8888';
   app.startBattleMatch(role,{solution,cages,difficulty:'easy'},'race');
   clearInterval(app.battlePollInterval);
  },role);
  const layouts=[];
  for(const [width,height] of [[320,568],[360,640],[390,844],[412,915],[600,960],[768,1024],[820,1180],[1024,768],[1366,820],[844,390],[740,360]]){
   await page.setViewportSize({width,height});await begin();
   await page.evaluate(()=>{if(!app.isMultiCageMode)app.toggleMultiCageMode();app.selectedCages.add(0);app.selectedCages.add(1);app.updateMultiCageCalculation();});
   await page.waitForTimeout(80);
   const geometry=await page.evaluate(()=>{
    const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    const selectors=['.game-header','#battle-hud','.game-sub-bar','#board-frame','.action-toolbar','.keypad'];
    const boxes=Object.fromEntries(selectors.map(s=>[s,rect(document.querySelector(s))]));
    const overflow=['#view-game','.game-layout','.game-main-content','.controls-column'].filter(s=>{const e=document.querySelector(s);return e.scrollHeight>e.clientHeight+1||e.scrollWidth>e.clientWidth+1});
    const keys=[...document.querySelectorAll('.key-btn')].filter(e=>e.getBoundingClientRect().width>0).map(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.key-btn')===e});
    const banner=rect(app.dom.multiCageBanner);
    return {boxes,overflow,keys,banner};
   });
   assert.deepEqual(geometry.overflow,[],`scrollable/clipped layout ${width}x${height}: ${JSON.stringify(geometry)}`);
   for(const [s,r]of Object.entries(geometry.boxes)){assert(r.x>=0&&r.y>=0&&r.right<=width+1&&r.bottom<=height+1,`${s} outside viewport ${width}x${height}: ${JSON.stringify(r)}`);}
   assert.equal(geometry.keys.length,9);assert(geometry.keys.every(Boolean),'all keys hit-testable');
   assert(Math.abs(geometry.boxes['#board-frame'].width-geometry.boxes['#board-frame'].height)<1);
   assert(geometry.boxes['#board-frame'].width>=144,'board remains usable in short landscape viewports');
   assert(geometry.banner.bottom<=geometry.boxes['#board-frame'].y+1,'sum banner does not cover board');
   layouts.push({width,height,board:geometry.boxes['#board-frame'].width});
   if(width===390||width===1024)await page.screenshot({path:path.join(require('os').tmpdir(),`killer-battle-${width}.png`)});
  }
  for(const role of [1,2])for(const endedBy of [1,2]){
   await begin(role);
   const result=await page.evaluate(endedBy=>{
    let count=0;const original=app.recordGameEnd;app.recordGameEnd=function(...args){count++;return original.apply(this,args)};
    const data={status:'ended',endReason:'forfeit',endedBy,p1:{score:0,filled:1},p2:{score:0,filled:2}};
    app.applyBattleTerminal(data);app.applyBattleTerminal(data);app.recordGameEnd=original;clearInterval(app.rematchCheckTimer);
    return {count,active:app.isBattle,visible:!app.dom.modalBattleResult.classList.contains('hidden'),title:document.getElementById('battle-result-title').textContent,rematch:!app.dom.btnBattleRematch.classList.contains('hidden')};
   },endedBy);
   assert.equal(result.count,1);assert(!result.active&&result.visible);assert.equal(result.rematch,role===1);
   assert(result.title.includes(role===endedBy?'패배':'승리'));
  }
  await begin(2);
  const retries=await page.evaluate(async()=>{
   const old=app.battleRequest;let calls=0;
   app.battleRequest=async(url,options)=>{assertPending=app.forfeitPending;calls++;if(calls===1)throw Error('dropped acknowledgement');return {status:'ended',endedBy:2,endReason:'forfeit',p1:{},p2:{}}};
   let assertPending=false;
   await app.forfeitBattle();app.battleRequest=old;clearInterval(app.rematchCheckTimer);
   return {calls,pendingDuringSend:assertPending,active:app.isBattle,visible:!app.dom.modalBattleResult.classList.contains('hidden')};
  });
  assert.equal(retries.calls,2);assert(retries.pendingDuringSend&&!retries.active&&retries.visible);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,layouts,terminalCases:4,retries}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const p=await browser.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://api.github.com/**',r=>r.fulfill({json:{}}));
 await p.addInitScript(()=>{window.rewardCalls=[];window.AndroidBridge={getDistribution:()=> 'play',isAdFree:()=>false,showRewarded:id=>rewardCalls.push(id)};});
 await p.goto('file:///'+path.resolve('app/src/main/assets/index.html').replace(/\\/g,'/'));await p.waitForFunction(()=>window.app);
 const result=await p.evaluate(async()=>{
  const solution=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*3+Math.floor(r/3)+c)%9+1));
  const puzzle={solution,cages:solution.flatMap((row,r)=>row.map((sum,c)=>({sum,cells:[[r,c]]}))),anchorCount:0};
  app.sound.play=()=>{};app.settings.maxLives='99';app.settings.initialHints='unlimited';app.saveSettings();
  const capped=[app.settings.maxLives,app.settings.initialHints];
  await app.startNewGame('easy',null,'standard',puzzle);app.stopTimer();
  const click=()=>document.querySelector('#reward-offer .btn-primary').click();
  const reward=()=>onRewardResult(rewardCalls.at(-1),'earned');
  const lives=[];
  for(let i=0;i<2;i++){app.mistakes=app.maxMistakes;app.handleGameOver();click();if(i===0){onRewardResult(rewardCalls.at(-1),'closed');if(app.revivesUsed!==0)throw Error('closed rewarded');click();}reward();app.stopTimer();lives.push([app.revivesUsed,app.mistakes]);}
  app.saveOngoingGame();app.revivesUsed=0;app.restoreOngoingGame();app.stopTimer();const restored=app.revivesUsed;
  app.mistakes=app.maxMistakes;app.handleGameOver();const cappedRevive=!document.getElementById('reward-offer');
  await app.startNewGame('easy',null,'standard',puzzle);app.stopTimer();app.hintsRemaining=0;app.useHint();click();reward();const hint=app.adHintsUsed;
  await app.startNewGame('easy',null,'standard',puzzle);app.stopTimer();app.mistakes=app.maxMistakes;app.handleGameOver();click();const stale=rewardCalls.at(-1);
  await app.startNewGame('easy',null,'standard',puzzle);app.stopTimer();onRewardResult(stale,'earned');const staleIgnored=app.revivesUsed===0;
  app.isBattle=true;app.hintsRemaining=0;app.useHint();const battleExcluded=!document.getElementById('reward-offer');
  return {capped,lives,restored,cappedRevive,hint,staleIgnored,battleExcluded};
 });
 assert.deepEqual(result,{capped:['3','3'],lives:[[1,2],[2,2]],restored:2,cappedRevive:true,hint:1,staleIgnored:true,battleExcluded:true});assert.deepEqual(errors,[]);console.log('PASS rewards: limits, close without reward, two revives, saved counts, hint, stale callback, battle exclusion');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

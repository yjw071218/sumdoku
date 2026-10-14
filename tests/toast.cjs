// 안내 메시지(점수·보너스 안내는 v1.0.39부터 표시하지 않음)가 보드·키패드·툴바를 가리지 않는지 여러 화면에서 검사
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const out=[];
 try{
  for(const [width,height,battle] of [[320,568,0],[360,640,0],[390,844,0],[412,915,0],[768,1024,0],[1280,800,0],[390,844,1],[360,640,1]]){
   const page=await browser.newPage({viewport:{width,height}});
   await page.route('https://api.github.com/**',r=>r.fulfill({json:{tag_name:'v1.0.35'}}));
   await page.goto('file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));
   await page.waitForFunction(()=>window.app);
   const r=await page.evaluate(async battle=>{
    const solution=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*3+Math.floor(r/3)+c)%9+1));
    const cages=solution.flatMap((row,r)=>row.map((sum,c)=>({sum,cells:[[r,c]]})));
    if(battle){app.battleHostIp='127.0.0.1';app.startBattleMatch(1,{solution,cages,difficulty:'easy'},'race');clearInterval(app.battlePollInterval);}
    else app.startNewGame('easy',null,'standard',{solution,cages});
    await new Promise(r=>setTimeout(r,300));
    app.showToast('메시지를 보내지 못했습니다. 연결을 확인해 주세요 · 아주 긴 안내 문장도 줄바꿈되어 표시됩니다',5000);
    await new Promise(r=>setTimeout(r,400));
    const t=document.getElementById('toast')||app.dom.toast,tr=t.getBoundingClientRect();
    const hit=sel=>[...document.querySelectorAll(sel)].filter(e=>e.getClientRects().length).some(e=>{const b=e.getBoundingClientRect();return !(tr.bottom<=b.top||tr.top>=b.bottom||tr.right<=b.left||tr.left>=b.right);});
    return {board:hit('#view-game #sudoku-board'),keypad:hit('#view-game .key-btn'),toolbar:hit('#view-game .tool-btn'),inView:tr.top>=0&&tr.bottom<=innerHeight,visible:getComputedStyle(t).opacity>0.5};
   },battle);
   out.push({width,height,battle,...r});await page.close();
  }
 }finally{await browser.close()}
 const fail=out.filter(r=>r.board||r.keypad||r.toolbar||!r.inView||!r.visible);
 console.log(JSON.stringify({passed:!fail.length,cases:out.length,fail}));
 assert.equal(fail.length,0);
})().catch(e=>{console.error(e);process.exitCode=1});

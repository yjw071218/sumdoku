// 힌트 카드가 보드와 겹치지 않고, 카드 버튼이 화면 안에 있는지 검사합니다.
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const out=[];
 try{
  for(const [width,height] of [[320,568],[360,640],[390,844],[412,915],[768,1024],[1024,600],[740,360],[1280,800]]){
   const page=await browser.newPage({viewport:{width,height}});
   await page.route('https://api.github.com/**',r=>r.fulfill({json:{tag_name:'v1.0.32'}}));
   await page.addInitScript(()=>localStorage.setItem('sumdoku_language','ko'));
   await page.goto('file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));
   await page.waitForFunction(()=>window.app);
   const r=await page.evaluate(async()=>{
    app.startNewGame('easy');
    await new Promise(res=>{const t=setInterval(()=>{if(app.cages?.length&&app.currentView==='game'){clearInterval(t);res();}},50);});
    await new Promise(r=>setTimeout(r,150));
    app.useHint();document.querySelector('#hint-confirm [data-confirm]').click();
    await new Promise(r=>setTimeout(r,350));
    const card=document.getElementById('floating-hint-card'),board=document.getElementById('sudoku-board');
    const view=document.querySelector('#view-game .game-main-content');
    card.scrollIntoView({block:'nearest'});
    const c=card.getBoundingClientRect(),b=board.getBoundingClientRect();
    const overlap=!(c.bottom<=b.top+1||c.top>=b.bottom-1||c.right<=b.left+1||c.left>=b.right-1);
    const btn=document.getElementById('btn-hint-card-apply').getBoundingClientRect();
    const btnVisible=btn.bottom<=innerHeight+1&&btn.top>=0&&document.elementFromPoint(btn.x+btn.width/2,btn.y+btn.height/2)?.closest('#btn-hint-card-apply')!=null;
    const target=document.querySelectorAll('#sudoku-board .hint-target-highlight').length;
    const h=app.pendingHint;
    document.getElementById('hint-answer-val').click();
    document.getElementById('btn-hint-card-apply').click();
    const applied=app.board[h.r][h.c].val===h.answer;
    return {overlap,btnVisible,target,applied,open:document.body.classList.contains('hint-open'),visible:!card.classList.contains('hidden')};
   });
   out.push({width,height,...r});
   await page.close();
  }
 }finally{await browser.close();}
 const fail=out.filter(r=>r.overlap||!r.btnVisible||r.target!==1||!r.applied||r.open||r.visible);
 console.log(JSON.stringify({passed:!fail.length,cases:out.length,fail},null,1));
 assert.equal(fail.length,0);
})().catch(e=>{console.error(e);process.exitCode=1});

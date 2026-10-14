// v1.0.36: 태블릿은 영역 합산을 추론 도우미에만 표시(캡슐 숨김), 휴대폰은 캡슐 유지,
// 배틀 보드는 바닥에서 띄우고, 합계 숫자 크기·위치는 일반 모드와 동일, 한 칸 케이지 강조
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const out=[];
 try{
  for(const [w,h,tablet] of [[1400,844,1],[1280,800,1],[1024,768,1],[390,844,0],[360,640,0]]) {
   const res={};
   for(const battle of [0,1]){
    const p=await browser.newPage({viewport:{width:w,height:h}});
    await p.route('https://api.github.com/**',r=>r.fulfill({json:{tag_name:'v1.0.36'}}));
    await p.goto('file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));
    await p.waitForFunction(()=>window.app);
    res[battle?'battle':'normal']=await p.evaluate(async battle=>{
     const solution=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*3+Math.floor(r/3)+c)%9+1));
     const cages=[];for(let r=0;r<9;r++)for(let c=0;c<9;c+=3)cages.push({sum:solution[r][c]+solution[r][c+1]+solution[r][c+2],cells:[[r,c],[r,c+1],[r,c+2]]});
     cages.splice(13,1,{sum:solution[4][3],cells:[[4,3]]},{sum:solution[4][4]+solution[4][5],cells:[[4,4],[4,5]]});
     if(battle){app.battleHostIp='127.0.0.1';app.startBattleMatch(1,{solution,cages,difficulty:'easy'},'race');clearInterval(app.battlePollInterval);}
     else app.startNewGame('easy',null,'standard',{solution,cages});
     await new Promise(r=>setTimeout(r,400));
     app.toggleMultiCageMode();await new Promise(r=>setTimeout(r,80));app.selectCell(0,0);await new Promise(r=>setTimeout(r,80));
     const s=document.querySelector('#sudoku-board .cell[data-r="0"][data-c="0"] .cell-cage-sum'),cell=s.closest('.cell').getBoundingClientRect(),sr=s.getBoundingClientRect();
     const bd=document.getElementById('sudoku-board').getBoundingClientRect();
     const single=document.querySelector('#sudoku-board .cell.single-cage .cage-inset-border');
     return {banner:getComputedStyle(document.getElementById('multi-cage-banner')).display!=='none',font:getComputedStyle(s).fontSize,
      top:Math.round(sr.top-cell.top),left:Math.round(sr.left-cell.left),gap:Math.round(innerHeight-bd.bottom),
      single:single?getComputedStyle(single).borderTopStyle:null};
    },battle);
    await p.close();
   }
   out.push({w,h,tablet,...res});
  }
 }finally{await browser.close()}
 const fail=[];
 for(const r of out){
  for(const m of ['normal','battle'])if(r.tablet===1?r[m].banner:!r[m].banner)fail.push([r.w,m,'banner']);
  if(r.battle.font!==r.normal.font||Math.abs(r.battle.top-r.normal.top)>1||Math.abs(r.battle.left-r.normal.left)>1)fail.push([r.w,'cage sum differs']);
  if(r.tablet&&r.battle.gap<16)fail.push([r.w,'battle board touches bottom',r.battle.gap]);
  if(r.battle.single!=='solid'||r.normal.single!=='solid')fail.push([r.w,'single cage not emphasized']);
 }
 console.log(JSON.stringify({passed:!fail.length,cases:out.length,fail,out}));
 assert.equal(fail.length,0);
})().catch(e=>{console.error(e);process.exitCode=1});

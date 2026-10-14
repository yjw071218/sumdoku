// v1.0.39: 합계가 있는 칸과 없는 칸의 입력 숫자 크기·칸 안 위치가 같은지, 점수·보너스 안내가 뜨지 않는지 검사
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const fails=[];
 try{
  for(const [w,h] of [[320,568],[360,640],[390,844],[599,900],[600,960],[768,1024],[1024,768],[1400,844]]) for(const battle of [0,1]){
   const p=await b.newPage({viewport:{width:w,height:h}});
   await p.route('https://api.github.com/**',r=>r.fulfill({json:{tag_name:'v1.0.39'}}));
   await p.goto('file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));
   await p.waitForFunction(()=>window.app);
   const r=await p.evaluate(async battle=>{
    const solution=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*3+Math.floor(r/3)+c)%9+1));
    const cages=[];for(let r=0;r<9;r++)for(let c=0;c<9;c+=3)cages.push({sum:solution[r][c]+solution[r][c+1]+solution[r][c+2],cells:[[r,c],[r,c+1],[r,c+2]]});
    cages.splice(1,1,{sum:solution[0][3],cells:[[0,3]]},{sum:solution[0][4]+solution[0][5],cells:[[0,4],[0,5]]});
    if(battle){app.battleHostIp='127.0.0.1';app.startBattleMatch(1,{solution,cages,difficulty:'easy'},'race');clearInterval(app.battlePollInterval);}
    else app.startNewGame('easy',null,'standard',{solution,cages});
    await new Promise(r=>setTimeout(r,400));
    const toasts=[];const t=document.getElementById('toast');
    new MutationObserver(()=>{if(!t.classList.contains('hidden'))toasts.push(t.textContent);}).observe(t,{attributes:true,childList:true,characterData:true,subtree:true});
    t.classList.add('hidden');
    for(const [r,c] of [[0,0],[0,1],[0,2],[0,3],[0,4]]){app.selectCell(r,c);app.handleNumberInput(solution[r][c]);}
    app.selectCell(5,5);await new Promise(r=>setTimeout(r,1500));
    const m=(r,c)=>{const el=document.querySelector(`#sudoku-board .cell[data-r="${r}"][data-c="${c}"]`),v=el.querySelector('.cell-value'),cr=el.getBoundingClientRect(),vr=v.getBoundingClientRect();
     return {font:getComputedStyle(v).fontSize,dx:+((vr.left+vr.width/2-cr.left)/cr.width).toFixed(3),dy:+((vr.top+vr.height/2-cr.top)/cr.height).toFixed(3)};};
    return {withSum:m(0,0),noSum:m(0,1),single:m(0,3),toasts};
   },battle);
   const same=(a,b)=>a.font===b.font&&Math.abs(a.dx-b.dx)<0.02&&Math.abs(a.dy-b.dy)<0.02;
   if(!same(r.withSum,r.noSum)||!same(r.single,r.noSum))fails.push({w,h,battle,...r});
   for(const cell of [r.withSum,r.noSum,r.single]) {
    const positioned = w >= 600
     ? Math.abs(cell.dx - 0.5) < 0.02 && Math.abs(cell.dy - 0.5) < 0.02
     : cell.dx > 0.52 && cell.dy > 0.52;
    if(!positioned)fails.push({w,h,battle,position:cell});
   }
   const loud=r.toasts.filter(x=>/보너스|점\)|COMBO|콤보/.test(x));if(loud.length)fails.push({w,battle,loud});
   await p.close();
  }
 }finally{await b.close()}
 console.log(JSON.stringify({passed:!fails.length,fails}));
 assert.equal(fails.length,0);
})().catch(e=>{console.error(e);process.exitCode=1});

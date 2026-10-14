// v1.0.38: 합계 숫자(일반·한 칸 배지)와 입력 숫자가 360px 이상 화면에서 겹치지 않는지 검사 (320px은 칸이 약 19px라 제외)
const path=require('path');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fails=[];(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
for(const [w,h] of [[320,568],[360,640],[385,800],[412,915],[768,1024],[1400,844]]) for(const battle of [0,1]){
const p=await b.newPage({viewport:{width:w,height:h}});await p.route('https://api.github.com/**',r=>r.fulfill({json:{tag_name:'v1'}}));
await p.goto('file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));await p.waitForFunction(()=>window.app);
const r=await p.evaluate(async battle=>{const solution=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*3+Math.floor(r/3)+c)%9+1));
const cages=[];for(let r=0;r<9;r++)for(let c=0;c<9;c+=3)cages.push({sum:solution[r][c]+solution[r][c+1]+solution[r][c+2],cells:[[r,c],[r,c+1],[r,c+2]]});
cages.splice(1,1,{sum:solution[0][3],cells:[[0,3]]},{sum:solution[0][4]+solution[0][5],cells:[[0,4],[0,5]]});
if(battle){app.battleHostIp='127.0.0.1';app.startBattleMatch(1,{solution,cages,difficulty:'easy'},'race');clearInterval(app.battlePollInterval);}else app.startNewGame('easy',null,'standard',{solution,cages});
await new Promise(r=>setTimeout(r,400));
for(const [r,c] of [[0,0],[0,3],[0,4]]){app.selectCell(r,c);app.handleNumberInput(solution[r][c]);}
app.selectCell(5,5);await new Promise(r=>setTimeout(r,2200));
const res=[];for(const [r,c] of [[0,0],[0,3],[0,4]]){const el=document.querySelector(`#sudoku-board .cell[data-r="${r}"][data-c="${c}"]`);
const sum=el.querySelector('.cell-cage-sum').getBoundingClientRect();const v=el.querySelector('.cell-value');const rg=document.createRange();rg.selectNodeContents(v);const vr=rg.getBoundingClientRect();
// glyph box approx: digit ink ~ inner 70% of line box height
const ink={left:vr.left+vr.width*0.08,right:vr.right-vr.width*0.08,top:vr.top+vr.height*0.14,bottom:vr.bottom-vr.height*0.12};
const ox=Math.min(sum.right,ink.right)-Math.max(sum.left,ink.left),oy=Math.min(sum.bottom,ink.bottom)-Math.max(sum.top,ink.top);
res.push({cell:`${r},${c}`,ox:Math.round(ox*10)/10,oy:Math.round(oy*10)/10,overlap:ox>0&&oy>0});}
return res;},battle);
if(w>=360)r.filter(x=>x.overlap).forEach(x=>fails.push([w,h,battle,x]));
await p.close();}
await b.close();console.log(JSON.stringify({passed:!fails.length,fails}));if(fails.length)process.exitCode=1;})();

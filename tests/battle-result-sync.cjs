// 실제 BattleServer(18888)와 브라우저 두 개로, 한쪽에서 정해진 승패가 다른 쪽에도 반드시 표시되는지 검사합니다.
// 상대 기기가 마지막 수/진행 상황을 받지 못한 경우(턴 로그 차단)도 서버 확정 결과로 결과창이 떠야 합니다.
const assert=require('node:assert/strict'),path=require('node:path'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const api=async(name,data)=>{const r=await fetch('http://127.0.0.1:18888/api/'+name,data===undefined?{}:{method:'POST',body:JSON.stringify(data)});return r.json();};
(async()=>{
 const child=spawn(process.env.JAVA_TEST_BIN||'java',['-cp',process.env.JAVA_TEST_CLASSES,'BattleServerSmoke','--serve'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 let browser;
 try{
  await new Promise((res,rej)=>{child.stdout.once('data',res);child.once('error',rej);child.once('exit',c=>rej(Error('server exited '+c)));});
  browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const pages=[await browser.newPage(),await browser.newPage()];
  const blockTurn=[false,false],errors=[];
  for(const [i,page] of pages.entries()){
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://api.github.com/**',r=>r.fulfill({json:{}}));
   await page.route('http://127.0.0.1:8888/**',async route=>{
    const req=route.request();
    if(blockTurn[i]&&req.url().includes('/api/turn'))return route.abort();
    const r=await fetch(req.url().replace(':8888',':18888'),{method:req.method(),body:req.postData()||undefined});
    await route.fulfill({status:r.status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:await r.text()});
   });
   await page.goto('file:///'+path.resolve('app/src/main/assets/index.html').replace(/\\/g,'/'));
   await page.waitForFunction(()=>window.app);
  }
  const solution=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*3+Math.floor(r/3)+c)%9+1));
  const puzzle={solution,cages:solution.flatMap((row,r)=>row.map((sum,c)=>({sum,cells:[[r,c]]}))),difficulty:'easy',rules:{maxLives:'3',livesExhaustedAction:'game_over'}};
  const read=p=>p.evaluate(()=>({battle:app.isBattle,shown:!document.getElementById('modal-battle-result').classList.contains('hidden'),title:document.getElementById('battle-result-title').textContent,sub:document.getElementById('battle-result-sub').textContent}));
  const scenarios=[
   // [모드, 먼저 끝내는 기기(0=방장,1=참가자), 그 기기에서 실행할 종료, 기대: 끝낸 쪽 승리 여부, 무승부]
   ['turn',1,'turn-lose',false],
   ['turn',0,'turn-win',true],
   ['turn',1,'turn-draw',null],
   ['race',0,'race-win',true],
   ['survival',1,'eliminated',false],
   ['score',0,'timeup-win',true],
  ];
  const results=[];
  for(const [mode,actor,action,actorWins] of scenarios){
   await api('rematch',{});await api('leave',{player:2});await api('join',{});await api('ready',{player:2,ready:true});await api('start',puzzle);
   for(let n=0;n<2;n++)await pages[n].evaluate(({role,puzzle,mode})=>{
    clearInterval(app.rematchCheckTimer);document.querySelectorAll('.modal-backdrop').forEach(e=>e.classList.add('hidden'));
    app.battleHostIp='127.0.0.1';app.battleHostUrl='http://127.0.0.1:8888';app.isRematchActive=false;
    app.startBattleMatch(role,puzzle,mode);
   },{role:n+1,puzzle,mode});
   await new Promise(r=>setTimeout(r,700));
   // 상대 기기는 마지막 수를 받지 못하는 상황: 턴 로그 요청 차단
   blockTurn[1-actor]=true;
   await pages[actor].evaluate(({action})=>{
    if(action.startsWith('turn')){
     for(const row of app.board)for(const c of row)c.val=0;
     app.board.forEach((row,r)=>row.forEach((c,cc)=>{c.val=app.solution[r][cc];}));
     app.score=action==='turn-win'?900:action==='turn-lose'?100:500;
     app.turnState.scores[3-app.battleRole]=action==='turn-draw'?500:(action==='turn-win'?100:900);
     app.finishTurnGame();
    } else if(action==='race-win'){app.board.forEach((row,r)=>row.forEach((c,cc)=>{c.val=app.solution[r][cc];}));app.score=500;app.checkWinCondition();}
    else if(action==='eliminated'){app.mistakes=app.maxMistakes;app.checkSurvivalElimination();}
    else if(action==='timeup-win'){app.score=800;app.oppState.score=100;app.handleTimeOut();}
   },{action});
   const other=pages[1-actor];
   await other.waitForFunction(()=>!document.getElementById('modal-battle-result').classList.contains('hidden'),null,{timeout:6000})
    .catch(()=>{});
   const [a,b]=[await read(pages[actor]),await read(other)];
   blockTurn[0]=blockTurn[1]=false;
   const id=JSON.stringify({mode,action,actor:a,other:b});
   assert.ok(a.shown&&b.shown,'both result modals shown '+id);
   assert.equal(b.battle,false,id);
   if(actorWins===null){assert.match(a.sub,/무승부/,id);assert.match(b.sub,/무승부/,id);}
   else {
    assert.match(a.title,actorWins?/승리/:/패배/,id);
    assert.match(b.title,actorWins?/패배/:/승리/,id);
   }
   results.push(`${mode}:${action}`);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: result shown on both devices via server (opponent turn log blocked): '+results.join(', '));
 } finally {await browser?.close();child.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});

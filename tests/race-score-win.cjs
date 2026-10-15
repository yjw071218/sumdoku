// 스피드 레이스 예비 판정: 서버 종료 요청이 실패해도 완주 보너스 +3000과 점수 비교로 결과를 표시하는지 검사합니다.
// (서버 판정 경로는 race-two-device.cjs가 실제 서버로 검사)
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const p=await b.newPage({viewport:{width:390,height:844}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://api.github.com/**',r=>r.fulfill({json:{}}));
 const sent=[];await p.route('http://127.0.0.1:8888/**',r=>{if(r.request().url().includes('/api/end'))sent.push(JSON.parse(r.request().postData()));if(r.request().url().includes('/api/end'))return r.abort();r.fulfill({json:{ok:true,status:'playing',p1:{},p2:{}}});});
 await p.goto('file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));await p.waitForFunction(()=>window.app);
 const run=(opts)=>p.evaluate(async({myScore,oppScore,mistakes,oppFinished})=>{
  const solution=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*3+Math.floor(r/3)+c)%9+1));
  const cages=solution.flatMap((row,r)=>row.map((sum,c)=>({sum,cells:[[r,c]]})));
  document.getElementById('modal-battle-result').classList.add('hidden');
  app.battleHostIp='127.0.0.1';app.battleHostUrl='http://127.0.0.1:8888';app.isRematchActive=false;app.sound.play=()=>{};
  app.startBattleMatch(1,{solution,cages,difficulty:'easy'},'race');
  clearInterval(app.battlePollInterval);clearInterval(app.modeTimer);
  app.score=myScore;app.mistakes=mistakes;app.hintsUsed=1;app.oppState={filled:40,score:oppScore,mistakes:0,isWin:false};
  if(oppFinished){app.updateOpponentProgress({filled:81,score:oppScore,mistakes:0,isWin:true});}
  else{app.board.forEach((row,r)=>row.forEach((c,cc)=>{c.val=app.solution[r][cc];}));app.checkWinCondition();}
  for(let i=0;i<80&&document.getElementById('modal-battle-result').classList.contains('hidden');i++)await new Promise(r=>setTimeout(r,100));
  return {score:app.score,title:document.getElementById('battle-result-title').textContent,sub:document.getElementById('battle-result-sub').textContent,battle:app.isBattle};
 },opts);
 const a=await run({myScore:100,oppScore:2000,mistakes:3,oppFinished:false});
 assert.ok(a.score>=100+3000,'bonus applied '+a.score);assert.match(a.title,/승리/,JSON.stringify(a));assert.match(a.sub,/완주했습니다/);
 const big=await run({myScore:-2500,oppScore:5000,mistakes:5,oppFinished:false});
 assert.match(big.title,/패배/,'finisher with low score loses '+JSON.stringify(big));
 const opp=await run({myScore:4000,oppScore:3500,mistakes:0,oppFinished:true});
 assert.match(opp.title,/승리/,'non-finisher with higher score wins '+JSON.stringify(opp));
 const oppL=await run({myScore:100,oppScore:3500,mistakes:0,oppFinished:true});
 assert.match(oppL.title,/패배/,JSON.stringify(oppL));
 const tie=await run({myScore:1000,oppScore:1000,mistakes:0,oppFinished:true});
 assert.match(tie.sub,/무승부/,JSON.stringify(tie));
 await p.waitForTimeout(300);
 assert.ok(sent.some(x=>x.reason==='race'),'server reason race '+JSON.stringify(sent));
 assert.ok(sent.some(x=>x.winner===0),'draw sent');
 await p.evaluate(()=>I18N.setLanguage('en'));const en=await p.evaluate(()=>document.querySelector('#modal-battle-result').textContent);
 assert.doesNotMatch(en,/[가-힣]/,'english result '+en);
 assert.deepEqual(errors,[]);
 console.log('PASS: race finish bonus, score-based win/loss for finisher and opponent, draw, server reason, translation');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

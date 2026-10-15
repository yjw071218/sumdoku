// 실제 BattleServer(18888) + 브라우저 2개로 스피드 레이스 종료 시 두 기기의 승패·점수 일치를 검사합니다.
// JAVA_TEST_BIN, JAVA_TEST_CLASSES 필요 (BattleServer, RoomDiscovery, BattleServerSmoke 컴파일 결과)
const assert=require('node:assert/strict'),path=require('node:path'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const api=async(name,data)=>(await fetch('http://127.0.0.1:18888/api/'+name,data===undefined?{}:{method:'POST',body:JSON.stringify(data)})).json();
(async()=>{
 const child=spawn(process.env.JAVA_TEST_BIN||'java',['-cp',process.env.JAVA_TEST_CLASSES,'BattleServerSmoke','--serve'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 let browser;
 try{
  await new Promise((res,rej)=>{child.stdout.once('data',res);child.once('error',rej);child.once('exit',c=>rej(Error('server exited '+c)));});
  browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const pages=[await browser.newPage(),await browser.newPage()],errors=[];
  for(const page of pages){
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://api.github.com/**',r=>r.fulfill({json:{}}));
   await page.route('http://127.0.0.1:8888/**',async route=>{const q=route.request();
    // 실제 Wi-Fi 지연을 흉내 냅니다.
    await new Promise(r=>setTimeout(r,30+Math.random()*60));
    try{const r=await fetch(q.url().replace(':8888',':18888'),{method:q.method(),body:q.postData()||undefined});
     await route.fulfill({status:r.status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:await r.text()});}catch(_){await route.abort();}});
   await page.goto('file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));
   await page.waitForFunction(()=>window.app);
   await page.evaluate(()=>{app.sound.play=()=>{};});
  }
  const solution=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*3+Math.floor(r/3)+c)%9+1));
  const puzzle={solution,cages:solution.flatMap((row,r)=>row.map((sum,c)=>({sum,cells:[[r,c]]}))),difficulty:'easy',rules:{}};
  const read=p=>p.evaluate(()=>({battle:app.isBattle,shown:!document.getElementById('modal-battle-result').classList.contains('hidden'),
   title:document.getElementById('battle-result-title').textContent,sub:document.getElementById('battle-result-sub').textContent,score:app.score}));
  const setup=async()=>{
   await api('rematch',{});await api('leave',{player:2});await api('join',{});await api('ready',{player:2,ready:true});await api('start',puzzle);
   for(let n=0;n<2;n++)await pages[n].evaluate(({role,puzzle})=>{
    clearInterval(app.rematchCheckTimer);document.querySelectorAll('.modal-backdrop').forEach(e=>e.classList.add('hidden'));
    app.battleHostIp='127.0.0.1';app.battleHostUrl='http://127.0.0.1:8888';app.isRematchActive=false;
    app.startBattleMatch(role,puzzle,'race');
    // 두 칸만 남긴 상태에서 시작
    app.board.forEach((row,r)=>row.forEach((c,cc)=>{c.val=(r===8&&cc>=7)||(r===0&&role===2)?0:app.solution[r][cc];c.notes.clear();}));
    app.updateBoardDisplay();app.hintsUsed=1;app.mistakes=1;
   },{role:n+1,puzzle});
   await new Promise(r=>setTimeout(r,1500));
  };
  // 정답 입력 (사람이 실제로 누르는 경로)
  const put=(p,cells)=>p.evaluate(cells=>{for(const [r,c] of cells){app.selectCell(r,c);app.isPencilMode=false;app.handleNumberInput(app.solution[r][c]);}},cells);
  const finish=p=>put(p,[[8,7],[8,8]]);
  const waitBoth=()=>Promise.all(pages.map(p=>p.waitForFunction(()=>!document.getElementById('modal-battle-result').classList.contains('hidden'),null,{timeout:8000}).catch(()=>{})));
  const outcome=async(label)=>{
   await waitBoth();await new Promise(r=>setTimeout(r,800));
   const [h,g]=[await read(pages[0]),await read(pages[1])];
   const server=await api('progress');
   const id=JSON.stringify({label,host:h,guest:g,server:{winner:server.winner,endReason:server.endReason,p1:server.p1?.score,p2:server.p2?.score}});
   const hw=/승리/.test(h.title),gw=/승리/.test(g.title),draw=/무승부/.test(h.sub);
   const ok=h.shown&&g.shown&&(draw? /무승부/.test(g.sub) : hw!==gw);
   const sp1=Number(server.p1?.score)||0,sp2=Number(server.p2?.score)||0;
   const expectHost=sp1>sp2?'host':sp1<sp2?'guest':'draw';
   // 결과 문구의 점수도 서버 기록과 같아야 합니다.
   const nums=t=>(t.match(/\((-?\d+) vs (-?\d+)\)/)||[]).slice(1).map(Number);
   const hn=nums(h.sub),gn=nums(g.sub);
   const textOk=draw||(hn[0]===sp1&&hn[1]===sp2&&gn[0]===sp2&&gn[1]===sp1);
   const actual=draw?'draw':hw?'host':'guest';
   return {label,ok:ok&&textOk,correct:actual===expectHost,expect:expectHost,actual,hostScore:sp1,guestScore:sp2,id};
  };
  const results=[];
  for(let i=0;i<3;i++){
   // A) 일반: 방장이 완주
   await setup();await finish(pages[0]);results.push(await outcome('normal'));
   // B) 완주 직전 상대 점수 변화: 참가자가 정답 여러 칸을 넣은 직후(같은 순간) 방장이 완주
   await setup();await pages[0].evaluate(()=>{app.score=-6500;});await put(pages[1],[[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],[0,8]]);await new Promise(r=>setTimeout(r,300));await finish(pages[0]);results.push(await outcome('late-score'));
   // C) 동시 완주
   await setup();await put(pages[1],[[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],[0,8]]);await new Promise(r=>setTimeout(r,1500));await pages[1].evaluate(()=>{app.score=app.score;});await Promise.all([finish(pages[0]),finish(pages[1])]);results.push(await outcome('simultaneous'));
  }
  for(const r of results)console.log(r.label,'consistent='+r.ok,'correct='+r.correct,`host=${r.hostScore} guest=${r.guestScore} expect=${r.expect} actual=${r.actual}`);
  const bad=results.filter(r=>!r.ok||!r.correct);
  if(bad.length)console.log('FAIL details:\n'+bad.map(b=>b.id).join('\n'));
  assert.equal(bad.length,0,`${bad.length}/${results.length} inconsistent or wrong`);
  assert.deepEqual(errors,[]);
  console.log(`PASS: ${results.length} two-device race endings consistent with final scores`);
 } finally {await browser?.close();child.kill();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});

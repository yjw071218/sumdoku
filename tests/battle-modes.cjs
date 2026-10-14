const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const url='file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/');
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 // 노드 쪽 모의 서버: BattleServer의 /api/turn 규칙과 동일
 const S={turn:1,seq:0,started:Date.now(),log:[]};
 const handler=async route=>{const req=route.request(),u=new URL(req.url()),h={'Access-Control-Allow-Origin':'*'};
  if(u.pathname==='/api/turn'){
   if(req.method()==='POST'){const m=JSON.parse(req.postData()||'{}');
    const late=Date.now()-S.started>(15+4)*1000;
    if(m.seq!==S.seq||(m.player!==S.turn&&!(m.pass&&late)))return route.fulfill({status:409,headers:h,json:{ok:false,turn:S.turn,seq:S.seq,elapsed:Date.now()-S.started,moves:[]}});
    S.log.push({seq:S.seq,player:S.turn,pass:!!m.pass,r:m.r??-1,c:m.c??-1,v:m.v??0,ok:!!m.ok,score:m.score|0});S.seq++;S.turn=3-S.turn;S.started=Date.now();
    return route.fulfill({headers:h,json:{ok:true,turn:S.turn,seq:S.seq,elapsed:0,moves:S.log.slice(-1)}});}
   const after=+(u.searchParams.get('after')||0);return route.fulfill({headers:h,json:{ok:true,turn:S.turn,seq:S.seq,elapsed:Date.now()-S.started,moves:S.log.slice(after)}});}
  if(u.pathname==='/api/chat')return route.fulfill({headers:h,json:{ok:true,messages:[],last:0}});
  return route.fulfill({headers:h,json:{ok:true,status:'playing',p1:{},p2:{}}});};
 const errors=[];
 const open=async()=>{const p=await b.newPage({viewport:{width:390,height:844}});p.on('pageerror',e=>errors.push(e.message));
  await p.route('https://api.github.com/**',r=>r.fulfill({json:{}}));await p.route('http://10.0.0.1:8888/**',handler);
  await p.goto(url);await p.waitForFunction(()=>window.app);return p;};
 const host=await open(),guest=await open();
 const start=(p,role,mode,extra={})=>p.evaluate(async({role,mode,extra})=>{
  const solution=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*3+Math.floor(r/3)+c)%9+1));
  const puzzle={solution,cages:solution.flatMap((row,r)=>row.map((v,c)=>({sum:v,cells:[[r,c]]}))),anchorCount:0,difficulty:'easy',rules:{maxLives:'3',initialHints:'3',turnSeconds:'15',...extra}};
  app.battleHostIp='10.0.0.1';app.battleHostUrl='http://10.0.0.1:8888';app.battleFetch=(u,o)=>fetch(u,o);app.isRematchActive=false;
  app.startBattleMatch(role,puzzle,mode);await new Promise(r=>setTimeout(r,300));
  for(const row of app.board)for(const c of row){c.val=0;c.notes.clear();}app.updateBoardDisplay();
 },{role,mode,extra});
 await start(host,1,'turn');await start(guest,2,'turn');
 const put=(p,r,c,v,pencil=false)=>p.evaluate(({r,c,v,pencil})=>{app.isPencilMode=pencil;app.selected={r,c};app.handleNumberInput(v);app.isPencilMode=false;},{r,c,v,pencil});
 const sol=(r,c)=>(r*3+Math.floor(r/3)+c)%9+1;
 // 1) 방장 정답 → 참가자 판에 반영, 턴 이동
 await put(host,0,0,sol(0,0));
 await guest.waitForFunction(()=>app.board[0][0].val>0&&app.turnState.player===2,null,{timeout:5000});
 // 2) 상대 턴: 숫자는 거부, 메모는 허용
 await host.waitForFunction(()=>app.turnState.player===2);
 await put(host,0,1,sol(0,1));await put(host,0,1,4,true);
 const blocked=await host.evaluate(()=>({val:app.board[0][1].val,notes:[...app.board[0][1].notes]}));
 assert.deepEqual(blocked,{val:0,notes:[4]},'opponent-turn input blocked, notes allowed');
 // 3) 참가자 오답 → 목숨 -1, 턴 넘어감, 오답 칸은 지워짐
 await put(guest,0,1,sol(0,1)%9+1);
 await host.waitForFunction(()=>app.turnState.player===1,null,{timeout:5000});
 await guest.waitForTimeout(900);
 assert.deepEqual(await guest.evaluate(()=>({m:app.mistakes,val:app.board[0][1].val})),{m:1,val:0});
 // 4) 시간 초과 → 자동 패스 + 감점
 const before=await host.evaluate(()=>app.score);
 await host.evaluate(()=>{app.turnState.startedAt=performance.now()-16000;});
 await guest.waitForFunction(()=>app.turnState.player===2,null,{timeout:5000});
 assert.equal(await host.evaluate(()=>app.score),before-30);
 // 5) 판 완성 → 양쪽 모두 같은 점수로 판정 (한쪽 승리 / 한쪽 패배)
 for(const p of [host,guest])await p.evaluate(()=>{for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(!(r===8&&c>=7))app.board[r][c].val=app.solution[r][c];});
 await put(guest,8,7,sol(8,7));
 await host.waitForFunction(()=>app.turnState.player===1&&app.board[8][7].val>0,null,{timeout:5000});
 await host.evaluate(()=>{app.score=900;});
 await put(host,8,8,sol(8,8));
 await host.waitForFunction(()=>!app.isBattle,null,{timeout:6000});await guest.waitForFunction(()=>!app.isBattle,null,{timeout:6000});
 const res=await Promise.all([host,guest].map(p=>p.evaluate(()=>document.getElementById('battle-result-title').textContent+'|'+document.getElementById('battle-result-sub').textContent)));
 assert.ok(/승리/.test(res[0])&&/패배/.test(res[1]),res.join(' / '));
 // 6) 서바이벌: 시간 초과 시 목숨 -1, 상대 정답 시 내 시간 감소, 목숨 소진 시 탈락(소진 설정이 '계속'이어도)
 await start(host,1,'survival',{livesExhaustedAction:'continue'});
 const bank=await host.evaluate(()=>{
  clearInterval(app.modeTimer);clearInterval(app.battlePollInterval);
  const s=app.survival, clock=document.getElementById('battle-clock');
  const originalNow=performance.now;performance.now=()=>1000;
  const read=()=>({tier:clock.dataset.tier,extra:!clock.querySelector('.bc-extra').hidden,
   labels:[...clock.querySelectorAll('.bc-multiplier')].filter(e=>!e.hidden&& !e.parentElement.hidden).map(e=>e.textContent),
   widths:[...clock.querySelectorAll('.bc-fill')].map(e=>parseFloat(e.style.width)),
   color:clock.querySelector('.bc-extra .bc-fill').style.background});
  try {
   const levels=[90,135,180,181,90001,90,9].map(left=>{s.left=left;s.last=1000;app.tickBattleMode();return read();});
   s.left=80;s.last=1000;app.isPencilMode=false;app.selectCell(0,0);app.handleNumberInput(app.solution[0][0]);
   const reward=s.left;app.handleNumberInput(app.solution[0][0]);const repeat=s.left;
   app.undo();app.handleNumberInput(app.solution[0][0]);const undo=s.left;
   app.selectCell(0,1);app.isPencilMode=true;app.handleNumberInput(app.solution[0][1]);app.isPencilMode=false;
   const pencil=s.left;app.handleNumberInput(app.solution[0][1]);const second=s.left;
   return {full:s.full,levels,reward,repeat,undo,pencil,second};
  } finally {performance.now=originalNow;s.left=s.full;s.last=performance.now();app.modeTimer=setInterval(()=>app.tickBattleMode(),250);}
 });
 assert.equal(bank.full,90);
 assert.deepEqual(bank.levels.map(x=>x.tier),['1','2','2','3','1001','1','1']);
 assert.deepEqual(bank.levels.map(x=>x.extra),[false,true,true,true,true,false,false]);
 assert.deepEqual(bank.levels[0].labels,['x1']);assert.deepEqual(bank.levels[1].labels,['x2','x1']);
 assert.deepEqual(bank.levels[1].widths,[50,100]);assert.deepEqual(bank.levels[2].widths,[100,100]);
 assert.notEqual(bank.levels[1].color,bank.levels[3].color);
 assert.equal(bank.reward,170);assert.equal(bank.repeat,170);assert.equal(bank.undo,170);assert.equal(bank.pencil,170);assert.equal(bank.second,260);
 for(const [width,height] of [[320,568],[390,844],[768,1024],[1024,768]]) {
  await host.setViewportSize({width,height});
  await host.evaluate(()=>{app.survival.left=90001;app.survival.last=performance.now();app.tickBattleMode();});
  await host.waitForTimeout(300);
  const layout=await host.evaluate(()=>{
   const clock=document.getElementById('battle-clock'),extra=clock.querySelector('.bc-extra').getBoundingClientRect(),base=clock.querySelector('.bc-base').getBoundingClientRect();
   const cr=clock.getBoundingClientRect();
   return {stacked:extra.bottom<=base.top,inside:cr.left>=0&&cr.right<=innerWidth+1,
    tracks:[...clock.querySelectorAll('.bc-track')].every(e=>e.getBoundingClientRect().width>10),fits:clock.scrollWidth<=clock.clientWidth+1};
  });
  assert.deepEqual(layout,{stacked:true,inside:true,tracks:true,fits:true},`${width}x${height} stacked clock`);
 }
 await host.setViewportSize({width:390,height:844});
 await host.evaluate(()=>{app.survival.left=app.survival.full;app.survival.last=performance.now();});
 const sv=await host.evaluate(async()=>{const s=app.survival,full=s.full;
  app.updateOpponentProgress({filled:1,score:0,mistakes:0});app.updateOpponentProgress({filled:3,score:0,mistakes:0});
  const drained=full-s.left;s.left=0.05;await new Promise(r=>setTimeout(r,400));const m1=app.mistakes;
  s.left=0.05;await new Promise(r=>setTimeout(r,400));s.left=0.05;await new Promise(r=>setTimeout(r,400));
  return {full,drained:Math.round(drained),m1,battle:app.isBattle,sub:document.getElementById('battle-result-sub').textContent};});
 assert.equal(sv.full,90);assert.equal(sv.m1,1);assert.ok(sv.drained>=7,'drain '+sv.drained);assert.equal(sv.battle,false);assert.match(sv.sub,/탈락/);
 // 7) 자동 메모 금지 규칙
 await start(host,1,'race',{allowAutoNotes:false});
 const an=await host.evaluate(()=>{app.toggleAutoNotes();return {filled:app.board.flat().filter(c=>c.notes.size).length,locked:document.getElementById('btn-auto-notes')?.classList.contains('rule-locked')};});
 assert.deepEqual(an,{filled:0,locked:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: turn sync, opponent-turn notes, wrong-move pass, timeout pass, shared finish scoring, survival pressure/elimination, auto-notes rule');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

// v1.1.30 · 배틀 채팅: 상용 문구는 키로 전송되어 받는 사람 언어로 표시, 이모지 연타는 ×숫자 대신 팝 애니메이션, 채팅창 가운데 고정
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const open=async(lang,vp)=>{const p=await b.newPage({viewport:vp||{width:412,height:915}});p.errors=[];p.on('pageerror',e=>p.errors.push(e.message));
  await p.route('https://api.github.com/**',r=>r.fulfill({json:{}}));
  await p.addInitScript(l=>localStorage.setItem('sumdoku_language',l),lang);
  await p.goto('file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));await p.waitForFunction(()=>window.app);
  await p.evaluate(async()=>{
   window.__sent=[];window.__inbox=[];let id=0;
   app.battleFetch=async(url,opt)=>{ if(opt&&opt.method==='POST'){const body=JSON.parse(opt.body);__sent.push(body.text);return {ok:true,json:async()=>({id:++id})};}
     const msgs=__inbox.splice(0);return {ok:true,json:async()=>({last:999,messages:msgs})}; };
   const solution=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*3+Math.floor(r/3)+c)%9+1));
   app.isBattle=true;app.battleRole=1;app.battleHostIp='127.0.0.1';
   await app.startNewGame('easy',null,'standard',{solution,cages:solution.flatMap((row,r)=>row.map((s,c)=>({sum:s,cells:[[r,c]]}))),anchorCount:0});app.stopTimer();
   app.switchView('game');document.body.classList.add('chat-enabled','battle-active');app.startBattleChat();
  });return p;};
 // 보내는 쪽: 한국어 설정에서 '잘하시네요' 버튼 → [[nice]] 전송
 const ko=await open('ko');
 const sent=await ko.evaluate(async()=>{app.openBattleChat();document.querySelector('.chat-phrase[data-phrase="nice"]').click();await new Promise(r=>setTimeout(r,200));
  return {sent:__sent.slice(),shown:[...document.querySelectorAll('#chat-list .chat-msg.mine')].map(e=>e.textContent)};});
 assert.deepEqual(sent.sent,['[[nice]]']);assert.deepEqual(sent.shown,['잘하시네요']);
 // 영어 설정에서 보내는 버튼 라벨도 영어, 전송은 키
 const en=await open('en');
 const r=await en.evaluate(async()=>{
  app.openBattleChat();
  const labels=[...document.querySelectorAll('.chat-phrase')].map(b=>b.textContent);
  document.querySelector('.chat-phrase[data-phrase="again"]').click();await new Promise(r=>setTimeout(r,800));
  // 받는 쪽: 상대(한국어 사용자)가 보낸 키 문구와 이전 버전 한국어 문구 → 영어로 표시
  __inbox.push({id:5,player:2,text:'[[fast]]'},{id:6,player:2,text:'어렵다…'});
  await new Promise(r=>setTimeout(r,1500));
  const theirs=[...document.querySelectorAll('#chat-list .chat-msg.theirs')].map(e=>e.textContent);
  // 이모지 연타: 배지 없이 팝 생성
  let pops=0;const mo=new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.classList?.contains('emoji-pop'))pops++;})));mo.observe(document.body,{childList:true});
  const fire=document.querySelector('.chat-emoji[data-text="🔥"]');
  for(let i=0;i<5;i++){fire.click();await new Promise(r=>setTimeout(r,220));}
  const fireMsgs=[...document.querySelectorAll('#chat-list .chat-msg.mine.emoji')].filter(e=>e.dataset.text==='🔥');
  const badge=document.querySelector('.chat-combo');
  const sheet=document.getElementById('battle-chat-sheet').getBoundingClientRect();
  return {labels,sent:__sent.slice(),theirs,pops,fireBubbles:fireMsgs.length,fireText:fireMsgs[0]?.textContent,badge:!!badge&&getComputedStyle(badge).display!=='none',
   ui:[document.querySelector('.chat-head strong').textContent,document.querySelector('.chat-send').textContent,document.getElementById('chat-input').placeholder],
   centered:Math.abs((sheet.left+sheet.right)/2-innerWidth/2)<2};
 });
 console.log(JSON.stringify(r,null,1));
 assert.deepEqual(r.labels,['GG!','Nice play!','So fast!','This is tough…','One more?']);
 assert.deepEqual(r.sent.slice(0,1),['[[again]]']);
 assert.deepEqual(r.theirs,['So fast!','This is tough…']);
 assert.equal(r.fireBubbles,1);assert.equal(r.fireText,'🔥');assert.ok(!r.badge,'no ×N badge');assert.ok(r.pops>=4,'pops '+r.pops);
 assert.deepEqual(r.ui,['Chat','Send','Message (max 80 chars)']);assert.ok(r.centered);
 // 태블릿: 열리는 순간부터 가운데
 const tab=await open('ja',{width:1400,height:876});
 const lefts=await tab.evaluate(async()=>{const s=document.getElementById('battle-chat-sheet');app.openBattleChat();const xs=[];const t0=performance.now();
  await new Promise(res=>{const f=()=>{const r=s.getBoundingClientRect();xs.push(Math.round((r.left+r.right)/2));if(performance.now()-t0<400)requestAnimationFrame(f);else res();};f();});return xs;});
 assert.ok(lefts.every(x=>Math.abs(x-700)<=2),'sheet stays centered '+lefts.join(','));
 for(const p of [ko,en,tab])assert.deepEqual(p.errors,[]);
 console.log('PASS chat-i18n: phrase keys localized per receiver, emoji pop (no ×N), translated chat UI, sheet centered from first frame');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

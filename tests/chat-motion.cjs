const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const p=await b.newPage({viewport:{width:2000,height:1206}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://api.github.com/**',r=>r.fulfill({json:{tag_name:'v1.0.48'}}));
 await p.route('http://10.0.0.1:8888/**',r=>r.fulfill({json:{ok:true,id:0,messages:[],last:0}}));
 await p.goto('file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));await p.waitForFunction(()=>window.app&&document.querySelector('.app-choice-trigger'));
 // 태블릿: 선택창이 하단 가운데
 await p.evaluate(()=>{app.switchView('stats');app.openHubPanel('panel-settings','설정');});
 await p.locator('[data-select-id="setting-language"]').click();await p.waitForTimeout(400);
 const r=await p.locator('dialog.choice-dialog').boundingBox();
 assert.ok(Math.abs(r.x+r.width/2-1000)<2,'centered '+JSON.stringify(r));assert.ok(1206-(r.y+r.height)<40&&r.y>200,'bottom '+JSON.stringify(r));
 await p.keyboard.press('Escape');
 // 대화: 스크롤 없음 + 연타 콤보
 for(const [w,h] of [[2000,1206],[360,740]]){await p.setViewportSize({width:w,height:h});
 const res=await p.evaluate(async()=>{app.battleRole=1;app.battleHostIp='10.0.0.1';app.battleFetch=(u,o)=>fetch(u,o);
  document.getElementById('battle-chat-sheet').classList.remove('hidden');
  const rows=[...document.querySelectorAll('.chat-emoji-row,.chat-phrase-row')].map(e=>({sw:e.scrollWidth,cw:e.clientWidth,sh:e.scrollHeight,ch:e.clientHeight}));
  const btn=document.querySelector('.chat-emoji');document.getElementById('chat-list').innerHTML='';
  for(let i=0;i<5;i++){await app.sendBattleChat(btn.dataset.text,btn);await new Promise(r=>setTimeout(r,200));}
  const msgs=document.querySelectorAll('#chat-list .chat-msg');
  return {rows,count:msgs.length,combo:msgs[0]?.querySelector('.chat-combo')?.textContent,fly:document.querySelectorAll('.emoji-fly').length};});
 for(const x of res.rows){assert.ok(x.sw<=x.cw+1&&x.sh<=x.ch+1,w+' scroll '+JSON.stringify(x));}
 assert.equal(res.count,1);assert.equal(res.combo,'×5');}
 assert.deepEqual(errors,[]);console.log('PASS: tablet bottom-centred choice sheet, chat rows without scroll (2000/360px), emoji burst combo ×5');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

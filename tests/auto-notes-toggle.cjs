// v1.0.38: 자동 메모 버튼을 한 번 더 누르면 꺼지고, 켜기 전 직접 적은 메모로 되돌아감
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const p=await b.newPage({viewport:{width:390,height:844}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('https://api.github.com/**',r=>r.fulfill({json:{tag_name:'v1.0.38'}}));
  await p.goto('file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));
  await p.waitForFunction(()=>window.app);
  const r=await p.evaluate(async()=>{
   app.startNewGame('medium');
   await new Promise(res=>{const t=setInterval(()=>{if(app.cages?.length&&app.currentView==='game'&&app.solution){clearInterval(t);res();}},50);});
   await new Promise(r=>setTimeout(r,200));
   const [r0,c0]=(()=>{for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(!app.board[r][c].val)return [r,c];})();
   app.board[r0][c0].notes=new Set([1,2]);
   const btn=document.getElementById('btn-auto-notes');
   const count=()=>app.board.flat().reduce((s,c)=>s+(c.val?0:c.notes.size),0);
   btn.click();const on={pressed:btn.getAttribute('aria-pressed'),active:btn.classList.contains('active'),notes:count()};
   btn.click();const off={pressed:btn.getAttribute('aria-pressed'),active:btn.classList.contains('active'),notes:count(),kept:[...app.board[r0][c0].notes].join(',')};
   document.dispatchEvent(new KeyboardEvent('keydown',{key:'a',bubbles:true}));const keyOn=btn.classList.contains('active');
   document.dispatchEvent(new KeyboardEvent('keydown',{key:'a',bubbles:true}));const keyOff=btn.classList.contains('active');
   return {on,off,keyOn,keyOff};
  });
  assert.equal(r.on.pressed,'true');assert.ok(r.on.active&&r.on.notes>2);
  assert.equal(r.off.pressed,'false');assert.ok(!r.off.active);assert.equal(r.off.notes,2);assert.equal(r.off.kept,'1,2');
  assert.ok(r.keyOn&&!r.keyOff);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,...r}));
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

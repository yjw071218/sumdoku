const assert=require('node:assert/strict'),path=require('node:path'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const api=async(name,data)=>{const response=await fetch('http://127.0.0.1:18888/api/'+name,data===undefined?{}:{method:'POST',body:JSON.stringify(data)});assert(response.ok);return response.json()};
(async()=>{
 const child=spawn(process.env.JAVA_TEST_BIN||'java',['-cp',process.env.JAVA_TEST_CLASSES,'BattleServerSmoke','--serve'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 let browser;
 try{
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(Error('server exited '+code)))});
  browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const pages=await Promise.all([browser.newPage(),browser.newPage()]);
  const errors=[];
  for(const page of pages){
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://api.github.com/**',r=>r.fulfill({json:{tag_name:'v1.0.28'}}));
   await page.route('http://127.0.0.1:8888/**',async route=>{
    const req=route.request();
    const response=await fetch(req.url().replace(':8888',':18888'),{method:req.method(),body:req.postData()||undefined});
    await route.fulfill({status:response.status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:await response.text()});
   });
   await page.goto('file:///'+path.resolve('app/src/main/assets/index.html').replace(/\\/g,'/'));
   await page.waitForFunction(()=>window.app);
  }
  const solution=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*3+Math.floor(r/3)+c)%9+1));
  const puzzle={solution,cages:solution.flatMap((row,r)=>row.map((sum,c)=>({sum,cells:[[r,c]]}))),difficulty:'easy'};
  for(const actor of [1,2,0]){
   await api('rematch',{});await api('join',{});await api('ready',{player:2,ready:true});await api('start',puzzle);
   for(let n=0;n<2;n++)await pages[n].evaluate(({role,puzzle})=>{
    clearInterval(app.rematchCheckTimer);document.querySelectorAll('.modal-backdrop').forEach(e=>e.classList.add('hidden'));
    app.battleHostIp='127.0.0.1';app.battleHostUrl='http://127.0.0.1:8888';
    app.startBattleMatch(role,puzzle,'race');
   },{role:n+1,puzzle});
   if(actor)await pages[actor-1].evaluate(()=>app.forfeitBattle());
   else await Promise.all(pages.map(p=>p.evaluate(()=>app.forfeitBattle())));
   await Promise.all(pages.map(p=>p.waitForFunction(()=>!app.isBattle&&!app.dom.modalBattleResult.classList.contains('hidden'),null,{timeout:5000})));
   const titles=await Promise.all(pages.map(p=>p.locator('#battle-result-title').textContent()));
   assert.equal(titles.filter(t=>t.includes('승리')).length,1);
   assert.equal(titles.filter(t=>t.includes('패배')).length,1);
   const result=await api('progress');
   if(actor)assert.equal(result.endedBy,actor);
   await api('progress',{player:result.endedBy,forfeit:false,score:777});
   assert.deepEqual(await api('progress'),result);
   await Promise.all(pages.map(p=>p.evaluate(()=>clearInterval(app.rematchCheckTimer))));
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,realServer:true,twoClients:true,cases:['host forfeit','guest forfeit','simultaneous forfeit','late progress after end']}));
 }finally{if(browser)await browser.close();child.stdin.end('\n');}
})().catch(e=>{console.error(e);process.exitCode=1});

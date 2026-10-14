// 회귀: 방을 다시 만들 때 이전 방의 비동기 /api/close가 새 방을 닫아 게스트가 즉시 쫓겨나던 버그(v1.0.33)
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const closes=[];
  await page.route('https://api.github.com/**',r=>r.fulfill({json:{tag_name:'v1.0.34'}}));
  await page.route('http://192.168.1.2:8888/api/**',r=>{if(r.request().url().includes('/api/close'))closes.push(1);r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{ok:true,status:'waiting',guestJoined:false}});});
  await page.goto('file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));
  await page.waitForFunction(()=>window.app);
  const starts=await page.evaluate(async()=>{
   let n=0;window.AndroidBridge={startBattleServer:()=>{n++;return JSON.stringify({ok:true,ip:'192.168.1.2'})},stopBattleServer:()=>{}};
   app.openBattleLobby();app.createHostRoom();app.createHostRoom();app.cancelRoomPreparation();app.createHostRoom();
   await new Promise(r=>setTimeout(r,800));return n;
  });
  assert.ok(starts>=3);
  assert.equal(closes.length,0,'native server stop must not send a late HTTP close to the new room');
  console.log(JSON.stringify({passed:true,starts,closes:closes.length}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

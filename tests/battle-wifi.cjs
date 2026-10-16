const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try {
  const page=await browser.newPage();
  await page.route('https://api.github.com/**',r=>r.fulfill({json:{}}));
  await page.goto('file:///'+path.resolve('app/src/main/assets/index.html').replace(/\\/g,'/'));
  await page.waitForFunction(()=>window.app);
  const result=await page.evaluate(()=>{
   let prepared=0;app.setupHostRoom=()=>{prepared++;};
   const modal=app.dom.modalBattleLobby;
   // v2.0.1: Wi-Fi가 없으면 로비를 막지 않고 '온라인' 탭으로 엽니다(같은 Wi-Fi 방은 준비하지 않음).
   const onlineTab=()=>document.getElementById('tab-battle-online')?.classList.contains('active')&&!document.getElementById('battle-online-view').classList.contains('hidden');
   const click=()=>{modal.classList.add('hidden');app.dom.btnHomeBattle.click();return !modal.classList.contains('hidden')&&!onlineTab();};
   let wifi=false;window.AndroidBridge={isWifiConnected:()=>wifi,getDeviceStatus:()=>JSON.stringify({wifi:false,cellular:true})};
   localStorage.removeItem('sumdoku_last_battle_tab');
   const blocked=!click(),online=onlineTab(),before=prepared,message=document.getElementById('toast').textContent;
   wifi=true;const connected=click();
   wifi=false;const disconnected=!click();
   window.AndroidBridge={getDeviceStatus:()=>JSON.stringify({wifi:false})};const fallback=!click();
   delete window.AndroidBridge;const browser=click();
   return {blocked,online,before,message,connected,disconnected,fallback,browser,prepared};
  });
  assert.deepEqual({...result,message:undefined},{blocked:true,online:true,before:0,message:undefined,connected:true,disconnected:true,fallback:true,browser:true,prepared:2});
  assert.match(result.message,/Wi-Fi가 꺼져 있어 온라인 매칭만/);
  console.log('PASS: Wi-Fi off opens online tab, disconnected warning, no room setup, reconnect, disconnect, native Wi-Fi over cellular status, browser fallback');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

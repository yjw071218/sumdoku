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
   const click=()=>{modal.classList.add('hidden');app.dom.btnHomeBattle.click();return !modal.classList.contains('hidden');};
   let wifi=false;window.AndroidBridge={isWifiConnected:()=>wifi,getDeviceStatus:()=>JSON.stringify({wifi:false,cellular:true})};
   const blocked=!click(),before=prepared,message=document.getElementById('toast').textContent;
   wifi=true;const connected=click();
   wifi=false;const disconnected=!click();
   window.AndroidBridge={getDeviceStatus:()=>JSON.stringify({wifi:false})};const fallback=!click();
   delete window.AndroidBridge;const browser=click();
   return {blocked,before,message,connected,disconnected,fallback,browser,prepared};
  });
  assert.deepEqual({...result,message:undefined},{blocked:true,before:0,message:undefined,connected:true,disconnected:true,fallback:true,browser:true,prepared:2});
  assert.match(result.message,/Wi-Fi를 켜고 같은 Wi-Fi에 연결/);
  console.log('PASS: disconnected warning, no room setup, reconnect, disconnect, native Wi-Fi over cellular status, browser fallback');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

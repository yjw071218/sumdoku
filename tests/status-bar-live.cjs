const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('https://api.github.com/**',r=>r.fulfill({json:{}}));
  await page.addInitScript(()=>{window.device={level:100,charging:true,ringer:'silent',dnd:false,wifi:true,cellular:false,internet:true,safeTop:32};window.AndroidBridge={getDeviceStatus:()=>JSON.stringify(window.device)};});
  await page.goto('file:///'+path.resolve('app/src/main/assets/index.html').replace(/\\/g,'/'));
  await page.waitForFunction(()=>document.getElementById('app-statusbar'));
  const result=await page.evaluate(()=>{
   const read=()=>({modes:document.querySelector('.sb-modes').textContent,charging:document.querySelector('.sb-batt').dataset.charging,offline:!!document.querySelector('.sb-offline svg'),aria:document.getElementById('app-statusbar').getAttribute('aria-label')});
   const initial=read();Object.assign(device,{charging:false,ringer:'normal',wifi:false,cellular:false,internet:false});
   onAppDeviceStatusChanged();const disconnected=read();
   Object.assign(device,{wifi:true,internet:false});onAppDeviceStatusChanged();const local=read();
   Object.assign(device,{internet:true,ringer:'vibrate',charging:true});onAppDeviceStatusChanged();const reconnected=read();
   device.ringer='normal';window.dispatchEvent(new Event('focus'));const focused=read();
   return {initial,disconnected,local,reconnected,focused};
  });
  assert.match(result.initial.modes,/무음/);assert.equal(result.initial.charging,'1');
  assert.equal(result.disconnected.modes,'');assert.equal(result.disconnected.charging,'');assert.equal(result.disconnected.offline,true);
  assert.match(result.disconnected.aria,/인터넷 연결 끊김/);assert.equal(result.local.offline,true);
  assert.equal(result.reconnected.offline,false);assert.equal(result.reconnected.charging,'1');assert.match(result.reconnected.modes,/진동/);assert.equal(result.focused.modes,'');
  for(const lang of ['ko','en','ja','zh','zh-TW','es','fr','de']) {
   const label=await page.evaluate(lang=>{device.internet=false;I18N.setLanguage(lang);return document.querySelector('.sb-offline svg').getAttribute('aria-label');},lang);
   assert.ok(label&&label!=='undefined');
  }
  console.log('PASS: immediate native-event rendering, unplug at 100%, silent/vibrate reset, offline/reconnect/local Wi-Fi, focus refresh, 8 offline labels');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

// 배포판별 화면 동작: Play판(광고 제거 설정, 업데이트 숨김, 결과 화면 전면 광고 요청, 구매 결과 안내, 번역) / GitHub판(변화 없음)
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const url='file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/');
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const open=async dist=>{const p=await b.newPage({viewport:{width:390,height:844}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('https://api.github.com/**',r=>r.fulfill({json:{}}));
  await p.addInitScript(dist=>{window.calls=[];const rec=n=>(...a)=>{window.calls.push(n);};
   window.AndroidBridge={getDeviceStatus:()=>JSON.stringify({level:80,wifi:true,internet:true,safeTop:32}),isWifiConnected:()=>true,isMobileDataEnabled:()=>false,getVersion:()=>'1.1.16',
    getDistribution:()=>dist,isAdFree:()=>false,getRemoveAdsPrice:()=>'₩3,300',isPrivacyOptionsRequired:()=>true,
    purchaseRemoveAds:rec('purchase'),restorePurchases:rec('restore'),showInterstitial:rec('interstitial'),showPrivacyOptions:rec('privacy'),openExternalUrl:rec('url'),downloadAndInstallApk:rec('apk')};},dist);
  await p.goto(url);await p.waitForFunction(()=>window.app);p.errors=errors;return p;};
 // ---- Play판
 const p=await open('play');
 const play=await p.evaluate(async()=>{
  app.switchView('stats');app.openHubPanel('panel-settings','Settings');
  const inSettings=!!document.querySelector('#panel-settings #settings-monetization, #panel-settings #setting-privacy-options');
  const g=document.getElementById('settings-monetization');const vis=id=>{const e=document.getElementById(id);return !!e&&!e.hidden&&e.offsetParent!==null;};
  app.openHubPanel('panel-noads','Remove ads');
  const buyText=g?.querySelector('#setting-remove-ads button').textContent;const items=['setting-remove-ads','setting-restore-purchase'].map(vis);
  const inNoAds=!!g?.closest('#panel-noads');
  app.openHubPanel('panel-privacy','Privacy');
  items.push(...['setting-privacy-options','setting-privacy-policy'].map(vis));
  const inPrivacy=!!document.getElementById('setting-privacy-policy')?.closest('#panel-privacy');
  g.querySelector('#setting-remove-ads button').click();g.querySelector('#setting-restore-purchase button').click();
  document.querySelector('#setting-privacy-options button').click();document.querySelector('#setting-privacy-policy button').click();
  const updateHidden=getComputedStyle(document.getElementById('btn-home-update')).display==='none';
  await app.checkForUpdates(true);const toastUpdate=document.getElementById('toast').textContent;
  onPurchaseResult('purchased');const toastBuy=document.getElementById('toast').textContent;
  onMonetizationChanged(true,'₩3,300',false);
  const after={buy:g.querySelector('#setting-remove-ads button').textContent,disabled:g.querySelector('#setting-remove-ads button').disabled,restoreHidden:g.querySelector('#setting-restore-purchase').hidden,privacyHidden:document.querySelector('#setting-privacy-options').hidden};
  // 결과 화면 → 전면 광고 요청
  app.showGameResultModal({status:'win',title:'t',sub:'s',score:1,time:'00:01',mistakes:'0',difficulty:'Easy',isNewBestScore:false,isNewBestTime:false});
  await new Promise(r=>setTimeout(r,1500));
  return {exists:!!g,inSettings,inNoAds,inPrivacy,items,buyText,updateHidden,toastUpdate,toastBuy,after,calls:[...calls]};
 });
 assert.ok(play.exists);assert.ok(!play.inSettings,'moved out of settings');assert.ok(play.inNoAds&&play.inPrivacy,'moved to tabs');assert.deepEqual(play.items,[true,true,true,true]);
 assert.equal(play.buyText,'구매 (₩3,300)');assert.ok(play.updateHidden,'update button hidden');
 assert.match(play.toastUpdate,/Google Play/);assert.match(play.toastBuy,/구매 혜택/);
 assert.deepEqual(play.after,{buy:'전체 제거 구매 완료',disabled:true,restoreHidden:false,privacyHidden:true});
 for(const c of ['purchase','restore','privacy','url','interstitial'])assert.ok(play.calls.includes(c),'call '+c+' '+play.calls);
 assert.ok(!play.calls.includes('apk'));
 // 번역
 const en=await p.evaluate(()=>{I18N.setLanguage('en');onMonetizationChanged(false,'$2.99',true);return document.getElementById('settings-monetization').textContent;});
 assert.doesNotMatch(en,/[가-힣]/,en);assert.match(en,/Full ad removal/);
 assert.deepEqual(p.errors,[]);
 // ---- GitHub판: 광고 설정 없음, 업데이트 버튼 유지, 전면 광고 요청 없음
 const g=await open('github');
 const gh=await g.evaluate(async()=>{app.switchView('stats');app.openHubPanel('panel-settings','Settings');
  app.showGameResultModal({status:'win',title:'t',sub:'s',score:1,time:'00:01',mistakes:'0',difficulty:'Easy',isNewBestScore:false,isNewBestTime:false});
  await new Promise(r=>setTimeout(r,1500));
  return {settings:!!document.getElementById('settings-monetization'),update:getComputedStyle(document.getElementById('btn-home-update')).display!=='none',calls:[...calls]};});
 assert.deepEqual(gh,{settings:false,update:true,calls:[]});
 assert.deepEqual(g.errors,[]);
 console.log('PASS: play noads/privacy tabs (buy/restore/privacy/policy), update UI hidden, result interstitial request, purchase toasts, en translation; github unchanged');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright'),assert=require('node:assert/strict'),path=require('path'),fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
const p=await b.newPage({viewport:{width:390,height:844}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.route('https://api.github.com/**',r=>r.fulfill({json:{tag_name:'v1.0.45'}}));
await p.route('http://127.0.0.1:8888/**',r=>r.fulfill({json:{ok:true,status:'playing',p1:{},p2:{}}}));
await p.addInitScript(()=>{window.AndroidBridge={getDeviceStatus:()=>JSON.stringify({level:80,wifi:true,cellular:false,charging:false,ringer:'normal',dnd:false,internet:true,safeTop:32}),isWifiConnected:()=>true,isMobileDataEnabled:()=>false,getVersion:()=>'1.1.15'};});
await p.goto('file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));await p.waitForFunction(()=>window.app&&I18N.text);
const results=[];
for(const lang of ['en','ja','zh','zh-TW','es','fr','de','ko']){
 await p.evaluate(lang=>{I18N.setLanguage(lang);app.switchView('stats');app.openHubPanel('panel-settings',I18N.t('hub_title_settings'));app.renderDailyCalendar();app.renderStatsView();},lang);
 await p.waitForTimeout(100);
 const res = await p.evaluate(lang=>{
  const leftovers=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentElement.closest('script,style,select[id$="language"],[data-select-id$="language"],[data-user-content]'))continue;const s=n.textContent.trim();if(/[가-힣]/.test(s))leftovers.push(s);}
  return {lang,leftovers:[...new Set(leftovers)],overflow:document.documentElement.scrollWidth>innerWidth};
 },lang);
 results.push(res);
 console.log(`i18n check [${lang}]: leftovers = ${res.leftovers.length}, overflow = ${res.overflow}`);
}
fs.mkdirSync('build',{recursive:true});
fs.writeFileSync('build/i18n-audit.json',JSON.stringify(results,null,2));console.log(results.map(r=>({lang:r.lang,leftovers:r.leftovers.length,overflow:r.overflow})));
assert.deepEqual(errors,[]);for(const r of results.filter(r=>r.lang!=='ko'))assert.equal(r.leftovers.length,0,JSON.stringify(r));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

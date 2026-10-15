const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
const p=await b.newPage({viewport:{width:320,height:640}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('https://api.github.com/**',r=>r.fulfill({json:{}}));
await p.addInitScript(()=>{localStorage.setItem('sumdoku_language','ko');window.calls=[];window.tierState={tier:0,basicPrice:'₩3,300',fullPrice:'₩4,900',upgradePrice:'₩1,900',privacy:true};window.AndroidBridge={getDistribution:()=> 'play',getMonetizationState:()=>JSON.stringify(tierState),isAdFree:()=>tierState.tier===2,purchaseAdProduct:id=>calls.push(id),restorePurchases:()=>calls.push('restore'),showRewarded:id=>calls.push('reward:'+id)};});
await p.goto('file:///'+path.resolve('app/src/main/assets/index.html').replace(/\\/g,'/'));await p.waitForSelector('#settings-monetization',{state:'attached'});
const r=await p.evaluate(()=>{const basic=document.querySelector('#setting-basic-ads button'),full=document.querySelector('#setting-remove-ads button');const read=()=>[basic.textContent,basic.disabled,full.textContent,full.disabled];
const free=read();basic.click();full.click();tierState.tier=1;onMonetizationChanged(tierState);const partial=read();basic.click();full.click();const partialReward=AndroidBridge.isAdFree();tierState.tier=2;onMonetizationChanged(tierState);const complete=read();full.click();const fullReward=AndroidBridge.isAdFree();document.querySelector('#setting-restore-purchase button').click();
onMonetizationChanged({...tierState,tier:0,basicPrice:'',fullPrice:''});const missing=read();basic.click();full.click();return {free,partial,complete,partialReward,fullReward,missing,calls};});
assert.deepEqual(r.calls,['remove_ads_basic','remove_ads','remove_ads_upgrade','restore']);assert.match(r.free[0],/3,300/);assert.match(r.free[2],/4,900/);assert.equal(r.partial[1],true);assert.match(r.partial[2],/1,900/);assert.ok(r.complete[1]&&r.complete[3]&&r.missing[1]&&r.missing[3]);assert.equal(r.partialReward,false);assert.equal(r.fullReward,true);
for(const lang of ['en','ja','zh','zh-TW','es','fr','de']) {const text=await p.evaluate(lang=>{I18N.setLanguage(lang);tierState.tier=1;onMonetizationChanged(tierState);return document.getElementById('settings-monetization').textContent;},lang);assert.doesNotMatch(text,/[가-힣]/,lang+text);}
const offers=await p.evaluate(async()=>{
 I18N.setLanguage('ko');const solution=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*3+Math.floor(r/3)+c)%9+1));const puzzle={solution,cages:solution.flatMap((row,r)=>row.map((sum,c)=>({sum,cells:[[r,c]]})))};
 const labels=[];for(const tier of [1,2]){tierState.tier=tier;await app.startNewGame('easy',null,'standard',puzzle);app.stopTimer();app.mistakes=app.maxMistakes;app.handleGameOver();labels.push(document.querySelector('#reward-offer .btn-primary').textContent);}
 return labels;
});assert.deepEqual(offers,['광고 보고 부활','부활하기']);
assert.deepEqual(errors,[]);console.log('PASS: basic/full/upgrade products and localized prices, owned guards, restore, missing price blocks, reward tier, seven translations');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

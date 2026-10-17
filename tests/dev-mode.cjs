// v2.1.5 · 개발자 모드: GitHub판에서만 숨겨진 칸이 생기고, 코드 입력 시 티어 세팅·잠금 해제가 동작하는지 검사합니다.
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const open=async(b,dist)=>{const p=await b.newPage({viewport:{width:412,height:915}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route('https://api.github.com/**',r=>r.fulfill({json:{}}));
 await p.addInitScript(d=>{localStorage.setItem('sumdoku_language','ko');window.AndroidBridge={getDistribution:()=>d,isAdFree:()=>false,getMonetizationState:()=>JSON.stringify({tier:0}),setSecureScreen:()=>{},isWifiConnected:()=>true,getDeviceStatus:()=>'{}'};},dist);
 await p.goto('file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));await p.waitForFunction(()=>window.app&&window.SumdokuDevMode);return {p,errs};};
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 {const {p}=await open(b,'play');await p.evaluate(()=>{app.switchView('stats');app.openHubPanel('panel-noads','x');});
  assert.equal(await p.locator('#dev-code-input').count(),0,'play build must not have hidden input');console.log('PASS play: no hidden input');await p.close();}
 const {p,errs}=await open(b,'github');
 await p.evaluate(()=>{app.switchView('stats');app.openHubPanel('panel-noads','x');});
 assert.equal(await p.locator('#dev-code-input').count(),1);assert.equal(await p.locator('#dev-mode-panel').count(),0);
 await p.fill('#dev-code-input','wrong');assert.equal(await p.locator('#dev-mode-panel').count(),0);
 await p.fill('#dev-code-input','1q2w3e4r');await p.waitForSelector('#dev-mode-panel');
 const r=await p.evaluate(async()=>{const R=SumdokuRating;const box=document.getElementById('dev-mode-panel');const sels=box.querySelectorAll('select');
  sels[0].value='battle';sels[1].value='hard';sels[1].dispatchEvent(new Event('change'));const inp=box.querySelector('input[type=number]');inp.value='3550';
  box.querySelector('.btn-primary').click();const s=R.ladder(R.loadAll(),'battle').byDiff.hard;
  const beforeIdx=R.bestTierIndex(R.loadAll());
  box.querySelector('.dev-toggle input').click();const afterIdx=R.bestTierIndex(R.loadAll());
  [...box.querySelectorAll('button')].find(x=>/업적 전체/.test(x.textContent)).click();
  const A=SumdokuAchievements;const achAll=A.list.every(a=>A.unlocked[a.id]);
  app.switchView('ranking');await new Promise(r=>setTimeout(r,300));const locks=document.querySelectorAll('.cos-row.locked').length;
  return {rating:s.rating,placement:s.placement,tier:R.tierOf(s.rating).id,beforeIdx,afterIdx,achAll,locks,dev:localStorage.getItem('sumdoku_dev_mode')};});
 console.log(r);
 assert.equal(r.rating,3550);assert.equal(r.tier,'master');assert.equal(r.placement,0);assert.equal(r.afterIdx,6);assert.ok(r.achAll);assert.equal(r.locks,0);
 await p.reload();await p.waitForFunction(()=>window.app&&window.SumdokuDevMode);
 assert.ok(await p.evaluate(()=>SumdokuDevMode.isOn()),'persists after reload');
 await p.evaluate(()=>{app.switchView('stats');app.openHubPanel('panel-noads','x');[...document.querySelectorAll('#dev-mode-panel button')].find(x=>/끄기/.test(x.textContent)).click();});
 assert.equal(await p.locator('#dev-mode-panel').count(),0);
 assert.deepEqual(errs,[]);console.log('PASS github: dev mode tier setup, unlocks, persistence, exit');
}finally{await b.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});

const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const page=await browser.newPage();
 await page.route('https://api.github.com/**',r=>r.fulfill({json:{tag_name:'v1.0.46'}}));
 await page.goto('file:///'+path.resolve('app/src/main/assets/index.html').replace(/\\/g,'/'));
 await page.waitForFunction(()=>window.app&&document.querySelector('.app-choice-trigger'));
 let cases=0;
 for(const width of [320,390,768,1024])for(const lang of ['ko','en','ja','zh','zh-TW','es','fr','de']){
  await page.setViewportSize({width,height:900});
  await page.evaluate(lang=>{I18N.setLanguage(lang);app.switchView('stats');app.openHubPanel('panel-settings',I18N.t('hub_title_settings'));document.getElementById('modal-settings').classList.remove('hidden');},lang);
  await page.waitForTimeout(40);
  const issues=await page.evaluate(()=>{
   const issues=[];
   for(const row of document.querySelectorAll('.settings-item')){
    if(!row.getClientRects().length)continue;
    const control=[...row.children].find(e=>e.matches('.settings-input,.app-choice-trigger,.toggle-switch'));
    if(!control)continue;
    const box=control.getBoundingClientRect();
    for(const label of row.querySelectorAll('.s-title,.s-desc')){
     const range=document.createRange();range.selectNodeContents(label);
     for(const r of range.getClientRects())if(r.right>box.left+1&&r.left<box.right-1&&r.bottom>box.top+1&&r.top<box.bottom-1)issues.push(label.textContent);
     if(label.scrollWidth>label.clientWidth+1)issues.push('overflow: '+label.textContent);
    }
   }
   return issues;
  });
  assert.deepEqual(issues,[],`${width}px ${lang}`);cases++;
  await page.evaluate(()=>document.getElementById('modal-settings').classList.add('hidden'));
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{I18N.setLanguage('ja');app.switchView('stats');app.openHubPanel('panel-settings',I18N.t('hub_title_settings'));app.applyTheme('theme-sepia');});
 await page.locator('#setting-initial-hints').scrollIntoViewIfNeeded();await page.screenshot({path:'build/settings-layout-ja.png'});
 console.log(`PASS: ${cases} viewport/language combinations, settings panel and modal text/control intersections`);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

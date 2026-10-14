// v1.0.37: 태블릿은 왼쪽 '설정' + 오른쪽 선택 항목 이름, 모바일 상세 화면 제목은 항목 이름.
// 업적은 어워드 패널에만, 통계에는 없음. 기존 어워드 항목이 합쳐짐.
const assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const out=[];
 try{
  for(const [w,h,tablet] of [[1400,844,1],[1024,768,1],[390,844,0],[360,640,0]]){
   const p=await browser.newPage({viewport:{width:w,height:h}});
   await p.route('https://api.github.com/**',r=>r.fulfill({json:{tag_name:'v1.0.37'}}));
   await p.addInitScript(()=>localStorage.clear());
   await p.goto('file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));
   await p.waitForFunction(()=>window.app);
   const r=await p.evaluate(async()=>{
    app.stats.totalWins=6;app.stats.maxStreak=3;
    app.switchView('stats');
    const vis=el=>el&&el.getClientRects().length>0&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden';
    const titles=()=>[...document.querySelectorAll('#view-stats .hub-col-title, .hub-header .hub-col-title')].filter(vis).map(e=>e.textContent.trim());
    const res={};
    for(const [panel,name] of [['panel-stats','통계'],['panel-awards','어워드'],['panel-settings','게임 설정']]){
     document.querySelector(`.hub-menu-item[data-hub-panel="${panel}"]`).click();
     await new Promise(r=>setTimeout(r,120));
     res[name]=titles();
     if(app.isMobileHubInDetail&&!document.querySelector('.hub-header-right')?.getClientRects().length)app.exitMobileHubDetail();
    }
    document.querySelector('.hub-menu-item[data-hub-panel="panel-stats"]').click();
    const statsAch=!!document.querySelector('#panel-stats #achievements-section, #panel-stats .ach-card');
    document.querySelector('.hub-menu-item[data-hub-panel="panel-awards"]').click();
    await new Promise(r=>setTimeout(r,100));
    const cards=[...document.querySelectorAll('#panel-awards .ach-card')];
    const got=cards.filter(c=>c.classList.contains('got')).map(c=>c.querySelector('strong').textContent);
    return {res,statsAch,cards:cards.length,got,oldGrid:!!document.getElementById('awards-list-grid')};
   });
   await p.screenshot({path:path.join(os.tmpdir(),`sumdoku-hub-${w}.png`)});
   out.push({w,tablet,...r});await p.close();
  }
 }finally{await browser.close()}
 const fail=[];
 for(const r of out){
  for(const name of ['통계','어워드','게임 설정']){
   const t=r.res[name];
   if(r.tablet){ if(t.filter(x=>x==='설정').length!==1||!t.includes(name))fail.push([r.w,name,t]); }
   else if(!t.includes(name)||t.includes('설정'))fail.push([r.w,name,t]);
  }
  if(r.statsAch)fail.push([r.w,'achievements still in stats']);
  if(r.oldGrid||r.cards!==18)fail.push([r.w,'awards not merged',r.cards]);
  for(const n of ['첫 완성','연역 추론의 달인','연승 가도'])if(!r.got.includes(n))fail.push([r.w,'missing earned',n,r.got]);
 }
 console.log(JSON.stringify({passed:!fail.length,fail,out:out.map(o=>({w:o.w,res:o.res,got:o.got}))}));
 assert.equal(fail.length,0);
})().catch(e=>{console.error(e);process.exitCode=1});

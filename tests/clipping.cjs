const assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const results=[];
  for(const [width,height,scale] of [[320,568,1],[360,640,1],[390,844,1.3],[768,1024,1.3],[740,360,1],[1024,600,1.3]]){
   const page=await browser.newPage({viewport:{width,height}});
   await page.route('https://api.github.com/**',r=>r.fulfill({json:{tag_name:'v1.0.29'}}));
   await page.goto('file:///'+path.resolve('app/src/main/assets/index.html').replace(/\\/g,'/'));
   await page.waitForFunction(()=>window.app);
   await page.evaluate(scale=>{
    app.applyTheme('theme-dark');
    app.dom.btnHomeContinue?.classList.remove('hidden');
    document.getElementById('btn-home-continue').classList.remove('hidden');
    document.getElementById('home-update-banner').classList.remove('hidden');
    document.getElementById('home-update-banner-title').textContent='새로운 버전 v1.0.30 업데이트';
    window.AndroidBridge={startBattleServer:()=>JSON.stringify({ok:true,ip:'192.168.1.2'}),stopBattleServer:()=>{}};
    if(scale!==1){
     const all=[...document.querySelectorAll('#app *')].filter(el=>!el.closest('svg,script,style')&&[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()));
     const sizes=all.map(el=>getComputedStyle(el).fontSize);
     all.forEach((el,i)=>el.style.fontSize=parseFloat(sizes[i])*scale+'px');
    }
   },scale);
   for(const screen of ['home','lobby','game','battle']){
    await page.evaluate(screen=>{
     document.querySelectorAll('.modal-backdrop').forEach(e=>e.classList.add('hidden'));
     if(screen==='home'){
      app.switchView('home');
      document.getElementById('btn-home-continue').classList.remove('hidden');
      document.getElementById('home-update-banner').classList.remove('hidden');
      return;
     }
     if(screen==='lobby'){app.openBattleLobby();return;}
     const solution=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*3+Math.floor(r/3)+c)%9+1));
     const cages=solution.flatMap((row,r)=>row.map((sum,c)=>({sum,cells:[[r,c]]})));
     if(screen==='game')app.startNewGame('easy',null,'standard',{solution,cages});
     else{app.battleHostIp='127.0.0.1';app.startBattleMatch(1,{solution,cages,difficulty:'easy'},'race');clearInterval(app.battlePollInterval);}
    },screen);
    await page.waitForTimeout(80);
    const geometry=await page.evaluate(screen=>{
     const root=screen==='lobby'?document.querySelector('#modal-battle-lobby .modal-card'):document.querySelector('.view.active');
     const clipped=[];
     const rect=el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right}};
     const textNodes=[];const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
     while(walker.nextNode()){const n=walker.currentNode;if(n.textContent.trim()&&n.parentElement.getClientRects().length&&!n.parentElement.closest('.hidden,svg,script,style'))textNodes.push(n);}
     for(const n of textNodes){
      const range=document.createRange();range.selectNodeContents(n);const r=range.getBoundingClientRect();
      let p=n.parentElement;
      while(p&&p!==document.body){
       const st=getComputedStyle(p),b=p.getBoundingClientRect();
       const x=st.overflowX,y=st.overflowY;
       if(['hidden','clip'].includes(x)&&(r.left<b.left-1||r.right>b.right+1)||['hidden','clip'].includes(y)&&(r.top<b.top-1||r.bottom>b.bottom+1)){
        // Scroll containers farther inside this ancestor can make text reachable.
        let q=n.parentElement,scrollable=false;
        while(q!==p){const s=getComputedStyle(q);if(/auto|scroll/.test(s.overflowY)&&q.scrollHeight>q.clientHeight+1)scrollable=true;q=q.parentElement;}
        if(!scrollable)clipped.push({text:n.textContent.trim().slice(0,35),parent:p.id||p.className});break;
       }
       p=p.parentElement;
      }
     }
     root.scrollTop=0;
     const first=screen==='home'?root.querySelector('.home-header'):null;
     const topLost=first?first.getBoundingClientRect().top<root.getBoundingClientRect().top-1:false;
     return {clipped:clipped.slice(0,12),topLost,rootHeight:root.clientHeight,horizontalOverflow:root.scrollWidth>root.clientWidth+1,scrollHeight:root.scrollHeight,first:first?rect(first):null};
    },screen);
    if(screen==='home'){
     geometry.unreachable=[];
     for(const id of ['btn-home-continue','btn-home-new','btn-home-battle','btn-home-stats','btn-home-rules','btn-banner-update']){
      const reachable=await page.evaluate(id=>{
       const el=document.getElementById(id),view=document.getElementById('view-home');
       el.scrollIntoView({block:'center'});
       const r=el.getBoundingClientRect(),nav=view.querySelector('.bottom-nav').getBoundingClientRect();
       return r.top>=view.getBoundingClientRect().top&&r.bottom<=nav.top+1&&r.left>=0&&r.right<=innerWidth+1&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
      },id);
      if(!reachable)geometry.unreachable.push(id);
     }
     await page.evaluate(()=>document.getElementById('view-home').scrollTop=0);
    }
    results.push({width,height,scale,screen,...geometry});
    if(geometry.topLost||geometry.clipped.length||width===390||width===1024)await page.screenshot({path:path.join(os.tmpdir(),`sumdoku-clip-${screen}-${width}-${scale}.png`)});
   }
   await page.close();
  }
  const failures=results.filter(r=>r.topLost||r.clipped.length||r.horizontalOverflow||r.unreachable?.length);
  console.log(JSON.stringify({passed:failures.length===0,cases:results.length,failures},null,2));
  assert.equal(failures.length,0,'text clipping or inaccessible action detected');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

// v1.1.30 · 전체 화면 번역 감사: 비한국어 언어에서 보이는 텍스트·placeholder·aria-label·title·토스트에 남은 한글을 수집합니다.
// 사용: node tests/i18n-full-audit.cjs [lang...]   결과: build/i18n-full-audit.json
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),path=require('path'),fs=require('fs');
const LANGS=process.argv.slice(2).length?process.argv.slice(2):['en','ja','zh','zh-TW','es','fr','de'];
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const out={};
try{for(const lang of LANGS){
 for(const vp of [{width:412,height:915,tag:'phone'},{width:1400,height:876,tag:'tablet'}]){
 const p=await b.newPage({viewport:{width:vp.width,height:vp.height}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://api.github.com/**',r=>r.fulfill({json:{}}));
 await p.addInitScript(l=>{localStorage.setItem('sumdoku_language',l);
  window.AndroidBridge={getDistribution:()=>'play',isAdFree:()=>false,showRewarded:()=>{},getMonetizationState:()=>JSON.stringify({tier:0,basicPrice:'₩3,300',fullPrice:'₩5,900',upgradePrice:'₩2,600',privacy:true,billingCode:0,missing:''}),
   setSecureScreen:()=>{},isWifiConnected:()=>true,getDeviceStatus:()=>JSON.stringify({level:80,wifi:true,internet:true}),isCloudConfigured:()=>true,startBattleServer:()=>JSON.stringify({ok:true,ip:'127.0.0.1'}),updateBattleServer:()=>true,stopBattleServer:()=>{}};},lang);
 await p.goto('file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));await p.waitForFunction(()=>window.app&&window.I18N);
 const found=await p.evaluate(async()=>{
  const sleep=t=>new Promise(r=>setTimeout(r,t));
  const hits=new Map();
  const toasts=[];const tEl=document.getElementById('toast');
  new MutationObserver(()=>{const s=tEl.textContent;if(/[가-힣]/.test(s))toasts.push(s);}).observe(tEl,{childList:true,characterData:true,subtree:true});
  const scan=screen=>{
   const visible=el=>{if(!el)return false;const r=el.getBoundingClientRect();if(!r.width||!r.height)return false;const cs=getComputedStyle(el);return cs.visibility!=='hidden'&&cs.display!=='none'&&+cs.opacity!==0;};
   const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
   while(n=w.nextNode()){const el=n.parentElement;if(!el||el.closest('script,style,select[id$="language"],[data-select-id$="language"],[data-user-content],#first-language,.chat-msg'))continue;const s=n.textContent.trim();if(/[가-힣]/.test(s)&&visible(el)){const k=s.slice(0,120);if(!hits.has(k))hits.set(k,screen);}}
   document.querySelectorAll('[placeholder],[aria-label],[title]').forEach(el=>{if(!visible(el)||el.closest('#first-language'))return;for(const a of ['placeholder','aria-label','title']){const v=el.getAttribute(a);if(v&&/[가-힣]/.test(v)){const k='@'+a+': '+v.slice(0,100);if(!hits.has(k))hits.set(k,screen);}}});
  };
  const solution=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*3+Math.floor(r/3)+c)%9+1));
  const cages=[];for(let r=0;r<9;r++)for(let c=0;c<9;c+=3)cages.push({sum:solution[r][c]+solution[r][c+1]+solution[r][c+2],cells:[[r,c],[r,c+1],[r,c+2]]});
  const puzzle={solution,cages,anchorCount:0};
  const step=async(name,fn)=>{try{await fn();}catch(e){hits.set('!ERR '+name+': '+e.message,name);}await sleep(180);scan(name);};
  await step('home',()=>app.switchView('home'));
  await step('newgame-modal',()=>app.openDifficultyModal());
  await step('newgame-normal-tab',()=>document.querySelector('#rank-queue-box .rq-btn[data-queue="normal"]')?.click());
  await step('newgame-ranked-tab',()=>document.querySelector('#rank-queue-box .rq-btn[data-queue="ranked"]')?.click());
  await step('newgame-quick-settings',()=>{document.querySelectorAll('#modal-difficulty details.quick-settings').forEach(d=>d.open=true);});
  app.dom.modalDiff?.classList.add('hidden');
  await step('game',async()=>{app.isRanked=true;await app.startNewGame('easy',null,'standard',puzzle);app.stopTimer();});
  await step('game-hint-confirm',()=>{app.useHint();});
  document.getElementById('hint-confirm')?.remove();document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(m=>{if(m.id!=='modal-difficulty')m.classList.add('hidden');});
  await step('game-out-of-hints',()=>{app.hintsRemaining=0;app.useHint();});
  document.getElementById('reward-offer')?.remove();
  await step('game-settings-modal',()=>document.getElementById('btn-game-settings')?.click());
  app.dom.modalSettings?.classList.add('hidden');
  await step('lunatic',async()=>{await app.startNewGame('lunatic',null,'standard',{...puzzle,cages:cages.map((c,i)=>i%3?c:{...c,hidden:true})});app.stopTimer();});
  await step('lunatic-cage-sum',()=>document.querySelector('.cage-sum-btn,#btn-cage-sum,[data-action="cage-sum"]')?.click());
  await step('result-win',()=>app.showGameResultModal({status:'win',title:'클리어 성공!',sub:'완벽',score:1234,time:'03:21',mistakes:'0 / 3',difficulty:'Easy',isNewBestScore:true,isNewBestTime:true}));
  app.dom.modalGameResult?.classList.add('hidden');
  await step('abandon-modal',async()=>{app.isRanked=true;await app.startNewGame('medium',null,'standard',puzzle);app.stopTimer();app.timerSeconds=40;app.saveOngoingGame();app.switchView('home');document.getElementById('btn-home-new')?.click();});
  document.getElementById('modal-abandon-confirm')?.remove();
  await step('stats',()=>{app.switchView('stats');app.renderStatsView?.();});
  await step('ranking',()=>{app.switchView('ranking');});
  for(const [panel,title] of [['panel-settings','s'],['panel-noads','n'],['panel-privacy','p'],['panel-privacy-opt','po'],['panel-awards','a'],['panel-info','i']]) await step('hub:'+panel,()=>{app.switchView('stats');app.openHubPanel(panel,title);});
  await step('battle-lobby',()=>{app.switchView('home');app.openBattleLobby?.();});
  await step('battle-room-created',()=>{app.createHostRoom?.();});
  await step('battle-room-config',()=>document.getElementById('btn-host-config-toggle')?.click());
  await step('battle-join-tab',()=>document.getElementById('tab-battle-join')?.click());
  app.cancelRoomPreparation?.();app.dom.modalBattleLobby?.classList.add('hidden');
  await step('chat',async()=>{app.isBattle=true;app.battleRole=1;await app.startNewGame('easy',null,'standard',puzzle);app.stopTimer();app.switchView('game');document.body.classList.add('chat-enabled');app.openBattleChat();});
  app.closeBattleChat?.();app.isBattle=false;
  return {hits:[...hits].map(([k,v])=>v+' | '+k),toasts:[...new Set(toasts)]};
 });
 out[lang+'/'+vp.tag]={...found,errors};
 console.log(`[${lang}/${vp.tag}] leftovers=${found.hits.length} toasts=${found.toasts.length} errors=${errors.length}`);
 await p.close();
 }}
}finally{await b.close();}
fs.mkdirSync('build',{recursive:true});fs.writeFileSync('build/i18n-full-audit.json',JSON.stringify(out,null,1));})();

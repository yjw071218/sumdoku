// v1.1.30 · 언어별 레이아웃 감사: 텍스트 잘림(clipped), 세로로 한 글자씩 쌓임(vertical), 가로 넘침(overflow)을 찾습니다.
// 사용: node tests/i18n-layout-audit.cjs [lang...]   결과: build/i18n-layout-audit.json (+ build/shots/*.png)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),path=require('path'),fs=require('fs');
const LANGS=process.argv.slice(2).length?process.argv.slice(2):['ko','en','ja','zh','zh-TW','es','fr','de'];
const SHOTS=!!process.env.SHOTS;
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const out={};fs.mkdirSync('build/shots',{recursive:true});
try{for(const lang of LANGS)for(const vp of [{width:360,height:780,tag:'small'},{width:412,height:915,tag:'phone'},{width:1400,height:876,tag:'tablet'}]){
 const p=await b.newPage({viewport:{width:vp.width,height:vp.height}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://api.github.com/**',r=>r.fulfill({json:{}}));
 await p.addInitScript(l=>{localStorage.setItem('sumdoku_language',l);
  window.AndroidBridge={getDistribution:()=>'play',isAdFree:()=>false,showRewarded:()=>{},getMonetizationState:()=>JSON.stringify({tier:0,basicPrice:'₩3,300',fullPrice:'₩5,900',upgradePrice:'₩2,600',privacy:true,billingCode:0,missing:''}),
   setSecureScreen:()=>{},isWifiConnected:()=>true,getDeviceStatus:()=>JSON.stringify({level:80,wifi:true,internet:true}),isCloudConfigured:()=>true,startBattleServer:()=>JSON.stringify({ok:true,ip:'127.0.0.1'}),updateBattleServer:()=>true,stopBattleServer:()=>{}};},lang);
 await p.goto('file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));await p.waitForFunction(()=>window.app&&window.I18N);
 const screens=['home','newgame','game','lunatic','battle-lobby','battle-room','chat','ranking','stats','result','abandon','noads','privacy','settings'];
 const res={};
 for(const sc of screens){
  await p.evaluate(async sc=>{
   const solution=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*3+Math.floor(r/3)+c)%9+1));
   const cages=[];for(let r=0;r<9;r++)for(let c=0;c<9;c+=3)cages.push({sum:solution[r][c]+solution[r][c+1]+solution[r][c+2],cells:[[r,c],[r,c+1],[r,c+2]]});
   const puzzle={solution,cages,anchorCount:0};
   document.querySelectorAll('.modal-backdrop').forEach(m=>{if(['hint-confirm','reward-offer','modal-abandon-confirm'].includes(m.id))m.remove();else m.classList.add('hidden');});
   app.closeBattleChat?.();document.body.classList.remove('chat-enabled');app.isBattle=false;
   const go={
    home:()=>app.switchView('home'),
    newgame:()=>{app.switchView('home');app.openDifficultyModal();},
    game:async()=>{app.isRanked=true;await app.startNewGame('medium',null,'standard',puzzle);app.stopTimer();},
    lunatic:async()=>{await app.startNewGame('lunatic',null,'standard',puzzle);app.stopTimer();},
    'battle-lobby':()=>{app.switchView('home');app.openBattleLobby?.();},
    'battle-room':()=>{app.switchView('home');app.openBattleLobby?.();app.createHostRoom?.();},
    chat:async()=>{app.cancelRoomPreparation?.();app.isBattle=true;app.battleRole=1;await app.startNewGame('easy',null,'standard',puzzle);app.stopTimer();app.switchView('game');document.body.classList.add('chat-enabled','battle-active');app.openBattleChat();},
    ranking:()=>app.switchView('ranking'),
    stats:()=>{app.switchView('stats');app.renderStatsView?.();},
    result:async()=>{await app.startNewGame('easy',null,'standard',puzzle);app.stopTimer();app.showGameResultModal({status:'win',title:I18N.text('클리어 성공!'),sub:'',score:1234,time:'03:21',mistakes:'0 / 3',difficulty:'Easy',isNewBestScore:true,isNewBestTime:true});},
    abandon:async()=>{app.isRanked=true;await app.startNewGame('medium',null,'standard',puzzle);app.stopTimer();app.timerSeconds=40;app.saveOngoingGame();app.switchView('home');document.getElementById('btn-home-new')?.click();},
    noads:()=>{app.switchView('stats');app.openHubPanel('panel-noads','x');},
    privacy:()=>{app.switchView('stats');app.openHubPanel('panel-privacy','x');},
    settings:()=>{app.switchView('stats');app.openHubPanel('panel-settings','x');}
   };
   await go[sc]();await new Promise(r=>setTimeout(r,350));
  },sc);
  if(SHOTS)await p.screenshot({path:`build/shots/${lang}-${vp.tag}-${sc}.png`});
  res[sc]=await p.evaluate(()=>{
   const issues=[];const seen=new Set();
   const vis=el=>{const r=el.getBoundingClientRect();if(r.width<2||r.height<2)return false;const cs=getComputedStyle(el);return cs.visibility!=='hidden'&&cs.display!=='none'&&+cs.opacity>0.05;};
   const label=el=>(el.id?'#'+el.id:'')+'.'+[...el.classList].slice(0,2).join('.');
   document.querySelectorAll('body *').forEach(el=>{
    if(el.closest('svg,.sudoku-grid,.gen-preview-board,script,style,.chat-list,#first-language,.emoji-fly,.emoji-pop,.tier-symbol'))return;
    const own=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();
    if(!own||!vis(el))return;
    const cs=getComputedStyle(el),r=el.getBoundingClientRect();
    const fs=parseFloat(cs.fontSize)||14,lh=parseFloat(cs.lineHeight)||fs*1.25;
    // 1) 잘림: 내용이 박스보다 넓은데 overflow 가 숨겨짐 / 말줄임
    if(el.scrollWidth>el.clientWidth+2&&(cs.overflow!=='visible'||cs.overflowX!=='visible'||cs.textOverflow==='ellipsis')&&cs.overflowX!=='auto'&&cs.overflowX!=='scroll'){const k='clip|'+label(el)+'|'+own.slice(0,40);if(!seen.has(k)){seen.add(k);issues.push({type:'clipped',el:label(el),text:own.slice(0,60),w:Math.round(r.width)});}}
    // 2) 세로 쌓임: 3줄 이상인데 폭이 글자 2~3개 정도
    const lines=Math.round(r.height/lh);
    if(own.length>=3&&lines>=3&&r.width<fs*3.2){const k='vert|'+label(el);if(!seen.has(k)){seen.add(k);issues.push({type:'vertical',el:label(el),text:own.slice(0,40),w:Math.round(r.width),h:Math.round(r.height)});}}
    // 3) 화면 밖으로 넘침
    if(r.right>innerWidth+2||r.left<-2){const k='off|'+label(el);if(!seen.has(k)&&!el.closest('.hidden,[hidden]')){seen.add(k);issues.push({type:'offscreen',el:label(el),text:own.slice(0,40),left:Math.round(r.left),right:Math.round(r.right)});}}
   });
   return {issues,docOverflow:document.documentElement.scrollWidth>innerWidth+1};
  });
 }
 out[lang+'/'+vp.tag]={screens:res,errors};
 const n=Object.values(res).reduce((a,v)=>a+v.issues.length,0);
 console.log(`[${lang}/${vp.tag}] issues=${n} errors=${errors.length}`);
 await p.close();
}}finally{await b.close();}
fs.writeFileSync(process.env.OUT||'build/i18n-layout-audit.json',JSON.stringify(out,null,1));})();

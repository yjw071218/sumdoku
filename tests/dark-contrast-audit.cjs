// v2.1.5 · 다크 모드 대비 감사: 주요 화면을 다크 테마로 열고, 보이는 텍스트의 글자/배경 대비가 3:1 미만인 요소를 수집합니다.
// 사용: node tests/dark-contrast-audit.cjs   결과: build/dark-contrast-audit.json
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),path=require('path'),fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const out={};
try{for(const vp of [{width:412,height:915,tag:'phone'}]){
 const p=await b.newPage({viewport:{width:vp.width,height:vp.height}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://api.github.com/**',r=>r.fulfill({json:{}}));
 await p.addInitScript(()=>{localStorage.setItem('sumdoku_language','ko');
  window.AndroidBridge={getDistribution:()=>'github',isAdFree:()=>false,showRewarded:()=>{},getMonetizationState:()=>JSON.stringify({tier:0,basicPrice:'₩3,300',fullPrice:'₩5,900',upgradePrice:'₩2,600',privacy:true,billingCode:0,missing:''}),
   setSecureScreen:()=>{},isWifiConnected:()=>true,getDeviceStatus:()=>JSON.stringify({level:80,wifi:true,internet:true}),isCloudConfigured:()=>true,startBattleServer:()=>JSON.stringify({ok:true,ip:'127.0.0.1'}),updateBattleServer:()=>true,stopBattleServer:()=>{}};});
 await p.goto('file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));await p.waitForFunction(()=>window.app&&window.I18N);
 const found=await p.evaluate(async()=>{
  const sleep=t=>new Promise(r=>setTimeout(r,t));
  app.applyTheme('theme-dark');
  const hits=new Map();
  const parse=c=>{const m=(c.match(/[\d.]+/g)||[0,0,0,0]).map(Number);return {r:m[0],g:m[1],b:m[2],a:m.length>3?m[3]:1};};
  const lum=({r,g,b})=>{const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;};return .2126*f(r)+.7152*f(g)+.0722*f(b);};
  const bgOf=el=>{const layers=[];let img=false;for(let e=el;e;e=e.parentElement){const cs=getComputedStyle(e);if(cs.backgroundImage&&cs.backgroundImage!=='none')img=true;const c=parse(cs.backgroundColor);if(c.a>0)layers.push(c);if(c.a>=1)break;}
   let base={r:15,g:23,b:42};for(const c of layers.reverse())base={r:c.r*c.a+base.r*(1-c.a),g:c.g*c.a+base.g*(1-c.a),b:c.b*c.a+base.b*(1-c.a)};return {bg:base,img};};
  const sel=el=>{let s=el.tagName.toLowerCase();if(el.id)s+='#'+el.id;if(el.classList.length)s+='.'+[...el.classList].slice(0,3).join('.');const pe=el.parentElement;if(pe&&!el.id){let q=pe.tagName.toLowerCase();if(pe.id)q+='#'+pe.id;else if(pe.classList.length)q+='.'+[...pe.classList].slice(0,2).join('.');s=q+' > '+s;}return s;};
  const visible=el=>{const r=el.getBoundingClientRect();if(!r.width||!r.height)return false;for(let e=el;e;e=e.parentElement){const cs=getComputedStyle(e);if(cs.visibility==='hidden'||cs.display==='none'||+cs.opacity===0)return false;}return true;};
  const scan=screen=>{
   const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
   while(n=w.nextNode()){const el=n.parentElement;const s=n.textContent.trim();if(!el||!s||el.closest('script,style,.cell'))continue;if(!visible(el))continue;
    const cs=getComputedStyle(el);const fg=parse(cs.color);if(cs.webkitTextFillColor&&/rgba?\(0, 0, 0, 0\)/.test(cs.webkitTextFillColor))continue;
    const {bg,img}=bgOf(el);const fgc={r:fg.r*fg.a+bg.r*(1-fg.a),g:fg.g*fg.a+bg.g*(1-fg.a),b:fg.b*fg.a+bg.b*(1-fg.a)};
    const [x,y]=[lum(fgc),lum(bg)].sort((a,b)=>b-a);const ratio=+((x+.05)/(y+.05)).toFixed(2);
    if(ratio<3){const k=sel(el);if(!hits.has(k))hits.set(k,{screen,ratio,text:s.slice(0,40),color:cs.color,bg:`rgb(${bg.r|0},${bg.g|0},${bg.b|0})`,img});}}
  };
  const solution=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*3+Math.floor(r/3)+c)%9+1));
  const cages=[];for(let r=0;r<9;r++)for(let c=0;c<9;c+=3)cages.push({sum:solution[r][c]+solution[r][c+1]+solution[r][c+2],cells:[[r,c],[r,c+1],[r,c+2]]});
  const puzzle={solution,cages,anchorCount:0};
  const step=async(name,fn)=>{try{await fn();}catch(e){hits.set('!ERR '+name,{e:e.message});}await sleep(450);scan(name);};
  await step('home',()=>app.switchView('home'));
  await step('newgame-modal',()=>app.openDifficultyModal());
  await step('newgame-quick-settings',()=>{document.querySelectorAll('#modal-difficulty details').forEach(d=>d.open=true);});
  app.dom.modalDiff?.classList.add('hidden');
  await step('game',async()=>{await app.startNewGame('easy',null,'standard',puzzle);app.stopTimer();});
  await step('game-settings-modal',()=>document.getElementById('btn-game-settings')?.click());
  app.dom.modalSettings?.classList.add('hidden');
  await step('result-win',()=>app.showGameResultModal({status:'win',title:'클리어 성공!',sub:'완벽',score:1234,time:'03:21',mistakes:'0 / 3',difficulty:'Easy',isNewBestScore:true,isNewBestTime:true}));
  app.dom.modalGameResult?.classList.add('hidden');
  await step('stats',()=>{app.switchView('stats');app.renderStatsView?.();});
  await step('ranking',()=>{app.switchView('ranking');});
  for(const panel of ['panel-settings','panel-noads','panel-privacy','panel-awards','panel-info']) await step('hub:'+panel,()=>{app.switchView('stats');app.openHubPanel(panel,'x');});
  await step('daily',()=>app.switchView('daily'));
  await step('replays',()=>app.switchView('replays'));
  await step('battle-lobby',()=>{app.switchView('home');app.openBattleLobby?.();});
  await step('battle-room-created',()=>{app.createHostRoom?.();});
  await step('battle-join-tab',()=>document.getElementById('tab-battle-join')?.click());
  app.cancelRoomPreparation?.();app.dom.modalBattleLobby?.classList.add('hidden');
  await step('online-panel',()=>{document.querySelectorAll('[class*="om-"]').forEach(()=>{});const b=document.querySelector('#btn-online-match,.om-open,[data-online-open]');b?.click();});
  return [...hits].map(([k,v])=>({sel:k,...v}));
 });
 out[vp.tag]={found,errors};
 console.log(`[${vp.tag}] low-contrast=${found.length} errors=${errors.length}`);
 for(const f of found)console.log(`${f.screen}\t${f.ratio}\t${f.sel}\t"${f.text}"\t${f.color} on ${f.bg}${f.img?' (img)':''}`);
 await p.close();
}}finally{await b.close();}
fs.mkdirSync('build',{recursive:true});fs.writeFileSync('build/dark-contrast-audit.json',JSON.stringify(out,null,1));})();

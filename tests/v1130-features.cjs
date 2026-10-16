// v1.1.30 검증: 생성 화면 숫자 암호화 · 랭크전 화면 보호/이탈 감지 · 성과 공유 카드 · 방장 설정 변경 · 결제 진단 문구
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const p=await browser.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://api.github.com/**',r=>r.fulfill({json:{}}));
 await p.addInitScript(()=>{window.calls=[];const rec=n=>(...a)=>calls.push([n,...a]);
  window.AndroidBridge={getDistribution:()=>'play',isAdFree:()=>false,showRewarded:()=>{},getMonetizationState:()=>JSON.stringify({tier:0,basicPrice:'',fullPrice:'',upgradePrice:'',privacy:false,billingCode:0,missing:'remove_ads_basic,remove_ads,remove_ads_upgrade'}),
   setSecureScreen:rec('secure'),shareImage:rec('shareImage'),refreshProducts:rec('refresh'),updateBattleServer:(...a)=>{calls.push(['update',...a]);return true;},startBattleServer:()=>JSON.stringify({ok:true,ip:'127.0.0.1'})};});
 await p.goto('file:///'+path.resolve('app/src/main/assets/index.html').replace(/\\/g,'/'));await p.waitForFunction(()=>window.app);
 const r=await p.evaluate(async()=>{
  const o={};
  const solution=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*3+Math.floor(r/3)+c)%9+1));
  const cages=solution.flatMap((row,r)=>row.map((sum,c)=>({sum,cells:[[r,c]]})));
  // 1) 생성 미리보기: 정답 숫자 대신 암호 글리프
  app.showGeneratingOverlay('easy','t');
  app.updateGeneratingProgress({percent:90,step:'3',stepStatus:'active',cages,solution,solvedCells:solution.flatMap((row,r)=>row.map((_,c)=>[r,c])),solvedCount:81});
  const txt=[...document.querySelectorAll('#gen-preview-board .gen-preview-cell')].map(e=>e.textContent).join('');
  o.previewNoDigits=!/[0-9]/.test(txt)&&txt.length>0;
  app.hideGeneratingOverlay();
  // 2) 랭크전: 화면 보호 켜짐, 이탈 감지 배율
  app.isRanked=true;app.isDaily=false;
  await app.startNewGame('easy',null,'standard',{solution,cages,anchorCount:0});app.stopTimer();
  o.secureOn=calls.some(c=>c[0]==='secure'&&c[1]===true);
  o.f1=app.integrityFactor();
  app._away={count:3,ms:20000,since:0};o.f2=app.integrityFactor();
  app._away={count:8,ms:90000,since:0};o.f3=app.integrityFactor();
  app._away={count:0,ms:0,since:0};
  app.switchView('home');o.secureOff=calls.filter(c=>c[0]==='secure').at(-1)[1]===false;
  // 3) 성과 공유 카드
  const card=await SumdokuShare.resultCard(app,{status:'win',time:'03:21',score:1234,mistakes:'0 / 3'});
  o.cardPng=card.url.startsWith('data:image/png')&&card.url.length>20000;o.cardText=card.text;
  app.showGameResultModal({status:'win',title:'t',sub:'s',score:1234,time:'03:21',mistakes:'0 / 3',difficulty:'Easy',isNewBestScore:false,isNewBestTime:false});
  o.shareBtn=!!document.getElementById('btn-result-share');
  await app.shareResult();o.shared=calls.some(c=>c[0]==='shareImage'&&String(c[1]).startsWith('data:image/png'));
  app.dom.modalGameResult.classList.add('hidden');
  // 4) 결제 진단 문구 + 다시 시도
  const prob=document.getElementById('monetize-problem');o.problem=prob&&!prob.hidden?prob.textContent:'';
  document.getElementById('monetize-retry').click();o.refresh=calls.some(c=>c[0]==='refresh');
  // 5) 방 생성 후 방장이 설정 변경 → 방을 닫지 않고 서버 설정만 갱신
  app.battleRole=1;app.hostRoomCreated=true;app.battleStarting=false;app.battleMode='race';app.battleDiff='easy';app.battleRoomCode='1234';
  app.onHostConfigChanged();await new Promise(r=>setTimeout(r,400));
  const up=calls.find(c=>c[0]==='update');o.updated=!!up&&up[1]==='race'&&up[2]==='easy'&&app.hostRoomCreated===true;
  return o;
 });
 console.log(JSON.stringify(r,null,1));
 assert.ok(r.previewNoDigits,'preview shows no digits');
 assert.ok(r.secureOn&&r.secureOff,'FLAG_SECURE toggles');
 assert.deepEqual([r.f1,r.f2,r.f3],[1,0.5,0]);
 assert.ok(r.cardPng&&/03:21/.test(r.cardText)&&r.shareBtn&&r.shared,'share card');
 assert.match(r.problem,/Play Console/);assert.ok(r.refresh);
 assert.ok(r.updated,'host config update');
 assert.deepEqual(errors,[]);
 console.log('PASS v1.1.30: cipher preview, ranked screen protection & away factor, share card, billing diagnostics, live host config');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

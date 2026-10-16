// v1.1.19 랭크: 승패·난이도 보정, 상한, 티어 경계, 비활동 감소(7일 유예, 1200 하한), 배틀·타임어택 제외, 중복 반영 방지, 리더보드 제출, 카드·번역
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{localStorage.setItem('sumdoku_language','ko');
   window.__subs=[];window.AndroidBridge={getDistribution:()=>'play',isLeaderboardConfigured:()=>true,submitLeaderboardScore:(k,s)=>__subs.push([k,+s]),showLeaderboard:k=>__subs.push(['show',k]),isCloudConfigured:()=>false};});
  await p.route('https://api.github.com/**',r=>r.fulfill({json:{}}));
  await p.goto('file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));
  await p.waitForFunction(()=>window.app&&window.SumdokuRating);
  const r=await p.evaluate(async()=>{
   const R=SumdokuRating,o={};
   const st=x=>({rating:x,peak:x,games:1,lastActive:Date.now(),history:[]});
   // 보정
   const d=(rt,g)=>R.computeDelta(st(rt),{difficulty:'expert',win:true,seconds:600,mistakes:0,hints:0,...g});
   o.fast=d(1000,{seconds:300});o.slow=d(1000,{seconds:3000});o.mist=d(1000,{mistakes:3});o.hint=d(1000,{hints:2});
   o.easyLow=R.computeDelta(st(800),{difficulty:'easy',win:true,seconds:300});o.easyHigh=R.computeDelta(st(2400),{difficulty:'easy',win:true,seconds:300});
   o.lunaticHigh=R.computeDelta(st(2400),{difficulty:'lunatic',win:true,seconds:900});
   o.lose=R.computeDelta(st(1500),{difficulty:'hard',win:false});
   o.tiers=[0,1000,1099,1100,1499,1500,2000,2499,2600,3000,3499,3500,4000].map(x=>R.tierOf(x).name);
   // 감소
   const DAY=864e5,s1=st(2000);s1.lastActive=Date.now()-5*DAY;o.decayGrace=R.applyDecay(s1);
   const s2=st(2000);s2.lastActive=Date.now()-10*DAY;o.decay10=R.applyDecay(s2);o.after10=s2.rating;o.again=R.applyDecay(s2);
   const s3=st(1250);s3.lastActive=Date.now()-60*DAY;R.applyDecay(s3);o.floor=s3.rating;
   const s4=st(900);s4.lastActive=Date.now()-60*DAY;o.belowFloor=R.applyDecay(s4);
   // 실제 게임 종료 흐름
   localStorage.removeItem(R.KEY);app.startNewGame('medium');
   await new Promise(res=>{const t=setInterval(()=>{if(app.cages?.length&&app.currentView==='game'&&app.solution){clearInterval(t);res();}},40);});
   app.board.forEach((row,i)=>row.forEach((c,j)=>c.val=app.solution[i][j]));app.timerSeconds=400;app.mistakes=0;app.hintsUsed=0;app.score=1000;
   app.recordGameEnd(true);const first=R.load('medium').rating;app.recordGameEnd(true);o.dupIgnored=R.load('medium').rating===first;o.gain=first-1000;
   o.subs=JSON.stringify(__subs);
   app._ratingToken=1;app.gameMode='battle';app.recordGameEnd(true);o.battleIgnored=R.load('medium').rating===first;
   app._ratingToken=2;app.isRanked=false;app.gameMode='standard';app.recordGameEnd(true);o.casualIgnored=R.load('medium').rating===first;app.isRanked=true;
   app.switchView('stats');app.renderStatsView();await new Promise(r=>setTimeout(r,100));
   const card=document.getElementById('rating-card');o.card=card?.textContent||'';o.btns=card?.querySelectorAll('.rc-actions button').length;
   card.querySelector('.rc-actions button').click();o.show=JSON.stringify(__subs.at(-1));
   I18N.setLanguage('ja');await new Promise(r=>setTimeout(r,200));o.cardJa=document.getElementById('rating-card').textContent;
   I18N.setLanguage('ko');
   // 진행 중 나갔다가 이어서 안 하고 새 게임 시작 시 경고 모달 및 RP 차감 (일일 도전 제외)
   const puzzle={solution:app.solution,cages:app.cages,anchorCount:app.anchorCount||2};
   app.isDaily=false;app.isRanked=true;
   await app.startNewGame('medium',null,'standard',puzzle);
   o.rankedRules=[app.rules.maxLives,app.rules.initialHints,app.rules.hintExhaustedAction,app.maxMistakes,app.hintsRemaining].join(',');
   app.settings.maxLives='1';app.settings.initialHints='0';document.querySelector('#rank-queue-box .rq-btn[data-queue="normal"]')?.click();app.isRanked=false;
   await app.startNewGame('medium',null,'standard',puzzle);
   o.casualRules=[app.rules.maxLives,app.rules.initialHints].join(',');
   app.settings.maxLives='3';app.settings.initialHints='3';app.isRanked=true;
   document.querySelector('#rank-queue-box .rq-btn[data-queue="ranked"]')?.click();
   await app.startNewGame('medium',null,'standard',puzzle);
   app.timerSeconds=45;app.switchView('home');
   const beforeAbandon=R.load('medium').rating;
   // 1) 일일 도전 시작 시에는 경고/감점 제외 및 진행 중 경기 유지
   app.generator.generateAsync=async()=>puzzle;
   await app.startDailyGame(app.localDay());
   o.dailyNoModal=!document.getElementById('modal-abandon-confirm');
   o.dailyNoPenalty=R.load('medium').rating===beforeAbandon;
   o.ongoingKeptAfterDaily=!!localStorage.getItem('sumdoku_ongoing_game');
   app.switchView('home');
   // 2) 홈에서 이어서 안 하고 '새 게임 시작' 클릭 시 경고 모달 표시 -> 확인 시 RP 차감
   document.getElementById('btn-home-new').click();
   const modal=document.getElementById('modal-abandon-confirm');
   o.abandonModalShown=!!modal;
   o.abandonModalText=modal?.textContent||'';
   modal?.querySelector('[data-abandon-confirm]')?.click();
   o.afterAbandon=R.load('medium').rating;
   o.abandonDropped=o.afterAbandon<beforeAbandon;
   o.ongoingCleared=!localStorage.getItem('sumdoku_ongoing_game');
   return o;
  });
  console.log(JSON.stringify(r,null,1));
  assert(r.fast>r.slow);assert(r.mist<r.fast);assert(r.hint<r.fast);assert(r.easyHigh<r.easyLow);assert(r.lunaticHigh>r.easyHigh*2);assert(r.lose<0);
  assert.deepEqual(r.tiers,['브론즈 V','브론즈 V','브론즈 V','브론즈 IV','브론즈 I','실버 V','골드 V','골드 I','플래티넘 IV','다이아몬드 V','다이아몬드 I','마스터','그랜드마스터']);
  assert.equal(r.decayGrace,0);assert(r.decay10>0);assert.equal(r.again,0);assert.equal(r.floor,1200);assert(r.belowFloor===0);
  assert(r.gain>0&&r.dupIgnored&&r.battleIgnored&&r.casualIgnored);
  assert.equal(r.rankedRules,'3,3,disallow,3,3');assert.equal(r.casualRules,'1,0');
  assert(r.dailyNoModal&&r.dailyNoPenalty&&r.ongoingKeptAfterDaily);
  assert(r.abandonModalShown&&/RP/.test(r.abandonModalText)&&r.abandonDropped&&r.ongoingCleared);
  assert(/"rating"/.test(r.subs)&&/"medium",400000/.test(r.subs));
  assert.equal(r.btns,2);assert(/RP/.test(r.card));assert(/rating/.test(r.show));
  assert(!/[가-힣]/.test(r.cardJa),'ja card has Korean: '+r.cardJa);
  assert.deepEqual(errors,[]);console.log('PASS rating');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

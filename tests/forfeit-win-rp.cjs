// v2.1.5 · 상대 기권승: RP가 오르고(내 점수가 높을수록 더 많이), 내 기권은 차감되는지 검사합니다.
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const p=await b.newPage();await p.route('https://api.github.com/**',r=>r.fulfill({json:{}}));
 await p.goto('file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));await p.waitForFunction(()=>window.app&&window.SumdokuRating);
 const r=await p.evaluate(()=>{const R=SumdokuRating;const fresh=()=>{const all=R.loadAll();const s=R.ladder(all,'battle').byDiff.expert;Object.assign(s,{rating:2200,peak:2200,placement:0,series:null,protect:0,boost:0,streak:0,games:10});R.saveAll(all);};
  const run=(win,reason,score)=>{fresh();const a={battleDiff:'expert',battleMode:'race',score};return R.recordBattleEnd(a,win,reason,2200).delta;};
  // handleBattleEnd 가 정하는 resultReason 확인
  app.isBattle=true;app.stopTimer?.();app.oppState={};app.score=0;app.handleBattleEnd(true,'상대방이 게임을 기권했습니다! 당신의 승리! 🏆');const rr=app.resultReason,br=app.battleResult;
  return {zero:run(true,'opp_forfeit',0),mid:run(true,'opp_forfeit',5000),full:run(true,'opp_forfeit',20000),normalWin:run(true,'battle',0),ownForfeit:run(false,'forfeit',0),rr,br};});
 console.log(r);
 assert.equal(r.rr,'opp_forfeit');assert.equal(r.br,'win');
 assert.ok(r.zero>0&&r.mid>r.zero&&r.full>=r.mid,'forfeit win RP scales with score');assert.ok(r.full<=r.normalWin);assert.ok(r.ownForfeit<0);
 console.log('PASS: opponent forfeit gives score-scaled RP gain; own forfeit loses RP');
}finally{await b.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});

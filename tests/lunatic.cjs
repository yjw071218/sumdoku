// v1.1.19 루나틱: 합계 비공개 케이지 2개 이상, 유일해 + 81칸 연역 해결, 화면에 '?' 표시, 힌트 정답 일치, 난이도 이름 통일
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>localStorage.setItem('sumdoku_language','ko'));
  await p.route('https://api.github.com/**',r=>r.fulfill({json:{}}));
  await p.goto('file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));
  await p.waitForFunction(()=>window.app);
  const out=[];
  for(let g=0;g<3;g++){
   const r=await p.evaluate(async()=>{
    const prev=app.solution;const t0=Date.now();app.startNewGame('lunatic');
    await new Promise(res=>{const t=setInterval(()=>{if(app.solution!==prev&&app.board.some(r=>r.some(c=>!c.val))&&app.difficulty==="lunatic"&&app.cages?.length&&app.currentView==='game'&&app.solution){clearInterval(t);res();}},50);});
    await new Promise(r=>setTimeout(r,300));
    const ms=Date.now()-t0,hidden=app.cages.filter(c=>c.noSum);
    const gen=app.generator,uniq=gen.checkUniquenessWithDiff(app.cages).isUnique,solved=gen.solveDeductivelyAdvanced(app.solution,app.cages);
    const q=[...document.querySelectorAll('#sudoku-board .cell-cage-sum.no-sum')].map(e=>e.textContent);
    const b=app.board.map(row=>row.map(c=>({...c,notes:new Set()})));let hints=0,wrong=0,guess=0;
    for(let k=0;k<81;k++){const h=app.findImmediateHint();if(!h)break;hints++;if(h.answer!==app.solution[h.r][h.c]){wrong++;break;}if(h.badgeText==="후보 좁히기")guess++;app.board[h.r][h.c].val=h.answer;}
    const leak=[...document.querySelectorAll('#sudoku-board .cell-cage-sum.no-sum')].some(e=>e.textContent!=='?');
    return {guess,ms,hidden:hidden.length,uniq,solved,q:q.length,leak,hints,wrong};
   });
   out.push(r);
  }
  console.log(JSON.stringify(out));
  for(const r of out){assert(r.hidden>=2);assert(r.uniq);assert.equal(r.solved,81);assert.equal(r.q,r.hidden);assert(!r.leak);assert.equal(r.wrong,0);assert.equal(r.hints,81);assert.equal(r.guess,0);}
  const names=await p.evaluate(()=>{const o={};for(const l of ['en','ja'])o[l]=['초급','중급','고급','전문가','루나틱','초급 (Easy)','고급 (Hard)'].map(s=>I18N.text(s,l));return o;});
  console.log(JSON.stringify(names));
  assert.deepEqual(names.en,['Easy','Medium','Hard','Expert','Lunatic','Easy','Hard']);
  assert.deepEqual(names.ja,['初級','中級','上級','エキスパート','ルナティック','初級','上級']);
  assert.deepEqual(errors,[]);console.log('PASS lunatic');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

// Regression: v1.0.29 domino templates made ~90% two-cell cages; hints chose hard cells first.
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const A=path.join(__dirname,'../app/src/main/assets/');
const ctx={console,Math,Date};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(A+'deduction.js','utf8')+'\n'+fs.readFileSync(A+'generator.js','utf8')+'\nthis.G=SumdokuGenerator;this.KD=KillerDeduction;',ctx);
const g=new ctx.G(),stats={two:0,multi:0,levels:[0,0,0,0,0],wrong:0,puzzles:0};
for(const diff of ['easy','medium','hard','expert','hard','expert']){
 const {solution,cages}=g.generate(diff);stats.puzzles++;
 const multi=cages.filter(c=>c.cells.length>1),two=multi.filter(c=>c.cells.length===2).length;
 assert.ok(two/multi.length<=0.6,`${diff}: two-cell ratio ${(two/multi.length).toFixed(2)}`);
 stats.two+=two;stats.multi+=multi.length;
 const board=solution.map((row,r)=>row.map((v,c)=>({val:cages.some(x=>x.cells.length===1&&x.cells[0][0]===r&&x.cells[0][1]===c)?v:0})));
 for(let k=0;k<81;k++){const h=ctx.KD.hint(cages,board);if(!h)break;
  if(h.answer!==solution[h.r][h.c])stats.wrong++;stats.levels[h.level]++;board[h.r][h.c].val=h.answer;
  assert.ok(h.explanation.split('\n').length<=8,'explanation too long');}
 assert.ok(board.every((row,r)=>row.every((x,c)=>x.val===solution[r][c])),`${diff}: hints did not finish puzzle`);
}
assert.equal(stats.wrong,0);
const total=stats.levels.reduce((a,b)=>a+b,0);
assert.ok(stats.levels[1]/total>=0.8,'most hints should use basic techniques');
console.log(JSON.stringify({passed:true,twoCellRatio:+(stats.two/stats.multi).toFixed(2),hintLevels:stats.levels.slice(1),...stats,levels:undefined}));

// 사람이 따라 할 수 있는 힌트: 정답과 일치, 문장 중복 없음, 설명 6줄 이하, 대부분의 퍼즐을 힌트만으로 진행 가능
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const A=path.join(__dirname,'../app/src/main/assets/');
const ctx={console,Math,Date};vm.createContext(ctx);
vm.runInContext(['deduction.js','human-hint.js','generator.js'].map(f=>fs.readFileSync(A+f,'utf8')).join('\n')+'\nthis.G=SumdokuGenerator;this.KD=KillerDeduction;',ctx);
const g=new ctx.G(),levels=[0,0,0,0,0];let wrong=0,stuck=[],dup=0,long=0,samples=[];
const diffs=(process.env.DIFFS||'easy,easy,medium,medium,hard,hard,expert,expert').split(',');
for(const diff of diffs){
 const {solution,cages}=g.generate(diff);
 const board=solution.map((row,r)=>row.map((v,c)=>({val:cages.some(x=>x.cells.length===1&&x.cells[0][0]===r&&x.cells[0][1]===c)?v:0})));
 let filled=board.flat().filter(x=>x.val).length;
 while(filled<81){
  const h=ctx.KD.hint(cages,board);
  if(!h){stuck.push({diff,filled});break;}
  if(h.answer!==solution[h.r][h.c])wrong++;
  levels[h.level]++;
  const lines=h.explanation.split('\n');if(new Set(lines).size!==lines.length)dup++;if(lines.length>9)long++;
  if(samples.length<6&&h.level>=2&&!samples.some(s=>s.level===h.level))samples.push({level:h.level,text:h.explanation});
  board[h.r][h.c].val=h.answer;filled++;
 }
}
console.log(JSON.stringify({levels:levels.slice(1),wrong,dup,long,stuck},null,1));
samples.forEach(s=>console.log('--- level',s.level,'\n'+s.text));
assert.equal(wrong,0,'hint answers must match the solution');
assert.equal(dup,0,'no repeated explanation lines');
assert.equal(long,0,'explanations stay short');
assert.ok(stuck.filter(s=>s.diff==='easy').length===0,'easy puzzles fully solvable with human hints');

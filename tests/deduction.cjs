const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
vm.runInThisContext(fs.readFileSync('app/src/main/assets/deduction.js','utf8')+'\n'+fs.readFileSync('app/src/main/assets/generator.js','utf8'));
let seed=74123;
const rng=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
const g=new SumdokuGenerator(rng),rules=new Set(),times=[];
const blank=()=>Array.from({length:9},()=>Array.from({length:9},()=>({val:0})));
const rowCages=Array.from({length:9},(_,r)=>({sum:45,cells:Array.from({length:9},(_,c)=>[r,c])}));
assert.equal(g.findShortestDeduction(blank(),rowCages,Array.from({length:9},()=>Array(9).fill(9))),null,'ambiguous boards must not leak a solution or guess');
const invalid=blank();invalid[0][0].val=1;invalid[0][1].val=1;
assert(KillerDeduction.solve(rowCages,invalid).contradiction);
assert.equal(g.findShortestDeduction(invalid,rowCages),null);
for(let trial=0;trial<60;trial++) {
 const solution=g.createSolutionIterative(rng);
 const cages=g.createSmartCages(solution,trial%9,rng);
 const board=blank();
 for(let i=0;i<81;i++)if(rng()<0.12)board[Math.floor(i/9)][i%9].val=solution[Math.floor(i/9)][i%9];
 const start=performance.now();
 const detailed=KillerDeduction.solve(cages,board,true);times.push(performance.now()-start);
 assert(!detailed.contradiction,`valid puzzle contradiction ${trial}`);
 for(let r=0;r<9;r++)for(let c=0;c<9;c++)assert(detailed.candidates[r][c]&(1<<solution[r][c]),`lost true candidate ${trial},${r},${c}`);
 for(const event of detailed.events) {
   rules.add(event.technique);
   assert(event.dependencies.every(id=>id<event.id),'proof is acyclic');
 }
 for(const t of detailed.trace)assert(t.after.includes(solution[t.r][t.c]),'trace never excludes known solution');
 if(trial<12){
  const plain=KillerDeduction.solve(cages,board);
  assert.deepEqual(plain.candidates,detailed.candidates,'tracing changes logic');
  const h=KillerDeduction.hint(cages,board);
  if(h){
   assert.equal(h.answer,solution[h.r][h.c]);
   assert.equal(h.stepsCount,h.proof.length);
   const ids=new Set(h.proof.map(e=>e.id));
   for(const e of h.proof)assert(e.dependencies.every(id=>ids.has(id)),'missing prerequisite');
   for(const [r,c] of detailed.solvedCells)if(!board[r][c].val)assert(h.stepsCount<=detailed.proof[r*9+c].length,'not shortest recorded proof');
  }
 }
}
for(const diff of ['easy','medium','hard','expert']) {
 const p=g.generate(diff),r=KillerDeduction.solve(p.cages);
 assert.equal(r.solvedCount,81,`${diff} requires full deduction`);
 assert(g.isSolutionUniqueFast(p.cages),'unique generated puzzle');
}
// Eight/nine-cell combination cache entries must be available as well.
assert.equal(KillerDeduction.combos[9][45].length,1);
assert.equal(KillerDeduction.combos[8][44][0],0x3fc);
for(const name of ['naked-2','naked-3','hidden-2','hidden-3','locked-candidate','45-bound','45-combination'])assert(rules.has(name),`missing coverage: ${name}`);
console.log(JSON.stringify({passed:true,trials:60,rules:[...rules],meanMs:Math.round(times.reduce((a,b)=>a+b)/times.length),maxMs:Math.round(Math.max(...times))}));

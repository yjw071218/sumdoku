/* Hints derive values only from visible constraints, never the solution array. */
(() => {
 const p=SumdokuApp.prototype;
 p.findImmediateHint=function(){
  const b=this.board, pos=(r,c)=>`${r+1}행 ${c+1}열`;
  const units=[];
  for(let i=0;i<9;i++){
   units.push({name:`${i+1}행`,cells:Array.from({length:9},(_,c)=>[i,c])});
   units.push({name:`${i+1}열`,cells:Array.from({length:9},(_,r)=>[r,i])});
   units.push({name:`${Math.floor(i/3)+1}번째 줄 ${i%3+1}번째 박스`,cells:Array.from({length:9},(_,j)=>[Math.floor(i/3)*3+Math.floor(j/3),(i%3)*3+j%3])});
  }
  for(const u of [...units,...this.cages]){
   const nums=u.cells.map(([r,c])=>b[r][c].val).filter(Boolean);
   if(new Set(nums).size!==nums.length)return null;
  }
  const candidates=Array.from({length:9},()=>Array(9));
  const reasons=Array.from({length:9},()=>Array(9));
  for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(!b[r][c].val){
   const cage=this.cages[this.cellCageMap[`${r},${c}`]];
   const peers=units.filter(u=>u.cells.some(([a,d])=>a===r&&d===c)).flatMap(u=>u.cells).concat(cage?.cells||[]);
   const blocked=[...new Set(peers.map(([a,d])=>b[a][d].val).filter(Boolean))].sort();
   candidates[r][c]=[1,2,3,4,5,6,7,8,9].filter(n=>!blocked.includes(n));
   reasons[r][c]=`같은 행·열·박스와 케이지에 있는 ${blocked.join(', ')||'숫자 없음'}을 제외하면 후보는 {${candidates[r][c].join(', ')}}입니다.`;
  }
  const make=(r,c,answer,tech,explanation)=>({r,c,answer,badgeText:tech,posName:pos(r,c),cageInfo:`케이지 합 ${this.cages[this.cellCageMap[`${r},${c}`]].sum}`,explanation});
  // Enumerate all cage assignments consistent with visible peers and distinct cage digits.
  for(const cage of this.cages){
   const empty=cage.cells.filter(([r,c])=>!b[r][c].val);
   if(!empty.length)continue;
   const filled=cage.cells.filter(([r,c])=>b[r][c].val).map(([r,c])=>b[r][c].val);
   const remaining=cage.sum-filled.reduce((a,v)=>a+v,0), allowed=empty.map(()=>new Set());
   let count=0,nodes=0,aborted=false;const chosen=[];
   function visit(i,sum,used){
    if(++nodes>100000){aborted=true;return;}
    if(i===empty.length){if(sum===remaining){count++;chosen.forEach((v,j)=>allowed[j].add(v));}return;}
    const [r,c]=empty[i];
    for(const n of candidates[r][c])if(!used.has(n)&&sum+n<=remaining){chosen[i]=n;used.add(n);visit(i+1,sum+n,used);used.delete(n);if(aborted)return;}
   }
   visit(0,0,new Set(filled));
   if(aborted)continue;
   if(!count)return null;
   empty.forEach(([r,c],i)=>{
    const before=candidates[r][c]; candidates[r][c]=before.filter(n=>allowed[i].has(n));
    reasons[r][c]+=` 케이지 합 ${cage.sum}에서 이미 채운 수 ${filled.length?filled.join(' + '):'0'}을 빼면 ${remaining}입니다. 빈 ${empty.length}칸을 중복 없이 채우는 가능한 배치 ${count}개를 확인하면, ${pos(r,c)}의 후보는 {${candidates[r][c].join(', ')}}만 남습니다.`;
   });
  }
  for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(candidates[r][c]?.length===1)return make(r,c,candidates[r][c][0],'후보·케이지 합 소거',reasons[r][c]+` 따라서 ${candidates[r][c][0]}로 확정됩니다.`);
  for(const u of units)for(let n=1;n<=9;n++){
   if(u.cells.some(([r,c])=>b[r][c].val===n))continue;
   const possible=u.cells.filter(([r,c])=>candidates[r][c]?.includes(n));
   if(possible.length===1){const [r,c]=possible[0];return make(r,c,n,'숨은 단일 후보',`${u.name}에는 ${n}이 반드시 한 번 있어야 합니다. 각 빈칸의 행·열·박스 중복과 케이지 합을 검사한 후보: ${u.cells.filter(([a,d])=>candidates[a][d]).map(([a,d])=>`${pos(a,d)} {${candidates[a][d].join(',')}}`).join(' / ')}. ${n}이 가능한 자리는 ${pos(r,c)}뿐이므로 ${n}입니다.`);}
  }
  return null;
 };
 p.showImmediateHint=function(){
  const h=this.findImmediateHint();
  if(!h){this.showToast('현재 지원하는 추론으로 바로 확정할 칸을 찾지 못했습니다. 입력한 숫자를 확인해 주세요. 힌트는 차감하지 않았습니다.');return;}
  const unlimited=this.rules.initialHints==='unlimited';
  const penalty=unlimited||this.hintsRemaining>0?30:50;
  if(!unlimited&&this.hintsRemaining>0)this.hintsRemaining--;
  this.hintsUsed=(this.hintsUsed||0)+1;this.score-=penalty;this.resetCombo('힌트 확인으로 콤보 리셋');this.updateHintBadge();this.dom.gameScore.textContent=this.score;
  this.selectCell(h.r,h.c);this.pendingHint={...h,board:this.board};
  this.dom.hintCardBadge.textContent=h.badgeText;this.dom.hintTargetPos.textContent=h.posName;this.dom.hintCageInfo.textContent=h.cageInfo;this.dom.hintLogicText.textContent=h.explanation;this.dom.hintAnswerVal.textContent=h.answer;
  this.dom.floatingHintCard.classList.remove('hidden');
  document.querySelector(`#sudoku-board .cell[data-r="${h.r}"][data-c="${h.c}"]`)?.classList.add('hint-target-highlight');
  this.saveOngoingGame();
 };
 p.applyDeductiveHint=function(){
  const h=this.pendingHint;this.dismissDeductiveHint();
  if(!h||h.board!==this.board||this.isPaused||this.isWin||this.currentView!=='game'||this.board[h.r][h.c].val)return;
  const {r,c,answer}=h;this.saveSnapshot();
  this.currentGameReplay?.moves.push({t:this.timerSeconds,type:'hint',r,c,num:answer,prevVal:0});
  Object.assign(this.board[r][c],{val:answer,error:false});this.board[r][c].notes.clear();
  if(this.settings.autoNotes)this.autoClearNotes(r,c,answer);
  this.updateBoardDisplay();this.updateKeypadBadges();this.updateTabletCageHelper(r,c);this.checkWinCondition();this.saveOngoingGame();
 };
 window.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('setting-dark-theme')?.closest('.settings-item')?.remove();
  document.getElementById('btn-assistant-multi-toggle')?.remove();
  const button=document.createElement('button');button.id='btn-home-theme';button.className='icon-btn';button.type='button';button.title='테마 변경';button.setAttribute('aria-label','밝은 테마와 어두운 테마 전환');
  button.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/></svg>';
  button.onclick=()=>{app.settings.darkTheme=!app.settings.darkTheme;app.applyTheme(app.settings.darkTheme?'theme-dark':'theme-light');app.saveSettings();button.setAttribute('aria-pressed',String(app.settings.darkTheme));};
  button.setAttribute('aria-pressed',String(app.settings.darkTheme));document.querySelector('.home-header').append(button);
 });
})();

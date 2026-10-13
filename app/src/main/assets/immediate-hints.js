/* Hints derive values only from visible constraints, never the solution array. */
(() => {
 const p=SumdokuApp.prototype;
 p.findImmediateHint=function(){
  // Replay the exact generation proof from public cage clues. This also works
  // when user notes are incomplete or the board contains an incorrect entry.
  const result=this.generator.solveDeductivelyAdvanced(null,this.cages,true,true);
  const index=result.trace.findIndex(t=>t.after.length===1 && this.board[t.r][t.c].val!==t.after[0]);
  if(index<0)return null;
  const target=result.trace[index], {r,c}=target;
  const steps=result.trace.slice(0,index+1).map((t,i)=>`${i+1}. ${t.reason} ${t.r+1}행 ${t.c+1}열: {${t.before.join(', ')}} → {${t.after.join(', ')}}`);
  return {r,c,answer:target.after[0],badgeText:'맵 검증 솔버의 연역 과정',posName:`${r+1}행 ${c+1}열`,cageInfo:`케이지 합 ${this.cages[this.cellCageMap[`${r},${c}`]].sum}`,
    explanation:`원래 케이지 단서에서 시작하는 검증 순서입니다. 이미 채운 칸의 추론도 근거로 포함됩니다.\n${steps.join('\n')}\n따라서 ${r+1}행 ${c+1}열은 ${target.after[0]}입니다.${this.board[r][c].val?' 현재 입력값과 다르므로 수정해야 합니다.':''}`};
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
  if(!h||h.board!==this.board||this.isPaused||this.isWin||this.currentView!=='game'||this.board[h.r][h.c].val===h.answer)return;
  const {r,c,answer}=h;this.saveSnapshot();
  this.currentGameReplay?.moves.push({t:this.timerSeconds,type:'hint',r,c,num:answer,prevVal:0});
  Object.assign(this.board[r][c],{val:answer,error:false});this.board[r][c].notes.clear();
  if(this.settings.autoNotes)this.autoClearNotes(r,c,answer);
  this.updateBoardDisplay();this.updateKeypadBadges();this.updateTabletCageHelper(r,c);this.checkWinCondition();this.saveOngoingGame();
 };
 window.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('setting-dark-theme')?.closest('.settings-item')?.remove();
  document.getElementById('btn-assistant-multi-toggle')?.remove();
  const button=document.createElement('button');button.id='btn-home-theme';button.className='icon-btn';button.type='button';button.title='테마 변경';button.setAttribute('aria-label','라이트·다크·세피아 테마 순환');
  button.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/></svg>';
  const update=()=>{button.title=`현재 테마: ${['라이트','다크','세피아'][app.currentThemeIndex]} · 눌러서 변경`;button.setAttribute('aria-label',button.title);};
  button.onclick=()=>{app.cycleTheme();update();};
  update();document.querySelector('.home-header').append(button);
 });
})();

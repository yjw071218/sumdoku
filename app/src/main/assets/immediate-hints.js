/* Hints derive values only from visible constraints, never the solution array. */
(() => {
 const p=SumdokuApp.prototype;
 p.findImmediateHint=function(){
  return this.generator.findShortestDeduction(this.board, this.cages);
 };
 p.showImmediateHint=function(isRecall=false){
  let h;
  if(isRecall&&this.unsolvedHint&&this.board&&this.board[this.unsolvedHint.r]&&this.board[this.unsolvedHint.r][this.unsolvedHint.c].val===0){
   h=this.unsolvedHint;
  }else{
   h=this.findImmediateHint();
   if(!h){this.showToast('지금 판에서는 사람이 한두 단계로 확정할 수 있는 칸이 없습니다. 자동 메모로 후보를 정리하거나 다른 곳을 먼저 채워 보세요. 힌트는 차감하지 않았습니다.',4500);return;}
   const unlimited=this.rules.initialHints==='unlimited';
   const penalty=unlimited||this.hintsRemaining>0?30:50;
   if(!unlimited&&this.hintsRemaining>0)this.hintsRemaining--;
   this.hintsUsed=(this.hintsUsed||0)+1;this.score-=penalty;this.resetCombo('힌트 확인으로 콤보 리셋');this.updateHintBadge();this.dom.gameScore.textContent=this.score;
  }
  this.selectCell(h.r,h.c);this.pendingHint={...h,board:this.board};
  this.unsolvedHint=this.pendingHint;this.hideHintRecallFab?.();
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

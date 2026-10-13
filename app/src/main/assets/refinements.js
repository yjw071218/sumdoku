/* Shared UI refinements. Loaded before DOMContentLoaded creates the app. */
(() => {
  const proto = SumdokuApp.prototype;
  const paths = {
    trophy:'M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 2v7m-4 1h8',
    heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
    clock:'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    hint:'M9 18h6m-5 3h4M8 15a7 7 0 1 1 8 0l-1 3H9l-1-3',
    flag:'M5 22V3m0 1c5-5 9 5 14 0v10c-5 5-9-5-14 0',
    check:'m5 12 4 4L19 6',
    plus:'M12 5v14M5 12h14',
    star:'m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z',
    play:'m7 4 14 8-14 8Z',
    info:'M12 11v6m0-10v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    grid:'M3 3h18v18H3ZM3 9h18M3 15h18M9 3v18M15 3v18',
    trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
    bolt:'m13 2-9 12h7l-1 8 10-13h-7Z',
    chart:'M5 20V10m7 10V4m7 16v-7',
    copy:'M9 9h12v12H9ZM5 15H3V3h12v2',
    calendar:'M3 5h18v16H3ZM3 10h18M8 2v6m8-6v6',
    refresh:'M20 7a9 9 0 1 0 1 9M20 2v6h-6',
    shield:'m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6Z'
  };
  const icon = (name) => `<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.info}"/></svg>`;
  const emoji = /(?:\p{Extended_Pictographic}|[★☆✓✔✕➕➖▶◀⏮⏭])(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*/gu;
  const names = {'🏆':'trophy','💔':'heart','❤️':'heart','♥':'heart','💡':'hint','🏳️':'flag','⏱️':'clock','⏳':'clock','⏰':'clock','📅':'calendar','📊':'chart','📋':'copy','🗑️':'trash','⚡':'bolt','★':'star','☆':'star','⭐':'star','✨':'star','✓':'check','✔':'check','✅':'check','➕':'plus','▶':'play','🎬':'play','🧩':'grid','🔄':'refresh','🛡️':'shield'};
  function replaceIcons(root) {
    if (!root || root.nodeType !== 1 || root.closest('svg,script,style,textarea,input,select,option')) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (!n.parentElement.closest('svg,script,style,textarea,input,select,option') && n.textContent.match(emoji)) nodes.push(n);
    }
    for (const n of nodes) {
      const fragment = document.createDocumentFragment(); let offset=0;
      for (const m of n.textContent.matchAll(emoji)) {
        fragment.append(document.createTextNode(n.textContent.slice(offset,m.index)));
        const span=document.createElement('span'); span.className='inline-icon';
        span.innerHTML=icon(names[m[0]] || 'info'); fragment.append(span); offset=m.index+m[0].length;
      }
      fragment.append(document.createTextNode(n.textContent.slice(offset))); n.replaceWith(fragment);
    }
  }
  proto.finishNegativeScore = function() {
    this.stopTimer(); this.resetCombo(); this.dismissDeductiveHint();
    if (this.isBattle) { this.handleBattleEnd(false,'점수가 음수여서 실패 처리되었습니다.'); return; }
    this.resultReason='negative_score'; this.isWin=false;
    this.recordGameEnd(false); this.clearOngoingGame(); this.isPaused=true;
    this.showGameResultModal({status:'fail',title:'게임 종료 · 점수 미달',sub:'완성 직전 점수가 음수여서 보너스를 적용하지 않고 실패 처리했습니다.',score:this.score,time:this.dom.timer.textContent,mistakes:String(this.mistakes),difficulty:({easy:'초급',medium:'중급',hard:'고급',expert:'전문가'})[this.difficulty],isNewBestScore:false,isNewBestTime:false});
  };
  // Confirm before showing an answer. Cancel never spends a hint or changes score.
  const useHint=proto.useHint;
  proto.useHint=function() {
    if(this.currentView!=='game'||this.isPaused||this.isWin) return;
    if(this.hintsRemaining<=0&&this.rules.initialHints!=='unlimited'&&this.rules.hintExhaustedAction==='disallow') { this.showToast('남은 힌트가 없습니다.'); return; }
    if(this.dom.floatingHintCard&&!this.dom.floatingHintCard.classList.contains('hidden')) return;
    if(document.getElementById('hint-confirm')) return;
    const replay=this.currentGameReplay, board=this.board;
    const modal=document.createElement('div'); modal.id='hint-confirm'; modal.className='modal-backdrop';
    modal.innerHTML=`<section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="hint-confirm-title"><h3 id="hint-confirm-title">힌트를 확인할까요?</h3><p>추론 설명과 정답이 표시됩니다.<br>설명을 보는 즉시 힌트 1회를 사용하고 ${this.hintsRemaining>0||this.rules.initialHints==='unlimited'?30:50}점이 차감됩니다.</p><div class="modal-footer"><button class="btn btn-secondary" data-cancel>취소</button><button class="btn btn-primary" data-confirm>힌트 보기</button></div></section>`;
    document.getElementById('app').append(modal);
    const close=()=>{modal.remove();this.dom.btnHint?.focus();};
    modal.querySelector('[data-cancel]').onclick=close;
    modal.querySelector('[data-confirm]').onclick=()=>{close();if(this.currentView==='game'&&!this.isPaused&&!this.isWin&&this.board===board&&this.currentGameReplay===replay) this.showImmediateHint();};
    modal.addEventListener('keydown',e=>{
      if(e.key==='Escape') { e.stopPropagation();close(); }
      if(e.key==='Tab') {e.preventDefault();const buttons=[...modal.querySelectorAll('button')];buttons[document.activeElement===buttons[0]?1:0].focus();}
    });
    modal.querySelector('[data-cancel]').focus();
  };
  const back=proto.handleBackKey;
  proto.handleBackKey=function(){const m=document.getElementById('hint-confirm');if(m){m.remove();return 'handled';}return back.call(this);};

  const oldRender=proto.renderStatsView;
  proto.renderStatsView=function() {
    oldRender.call(this);
    const panel=document.getElementById('panel-stats'); if(!panel)return;
    let area=document.getElementById('stats-summary');
    if(!area) {
      area=document.createElement('div'); area.id='stats-summary'; panel.prepend(area);
      for(const child of [...panel.children]) if(child!==area&&!child.classList.contains('stats-actions'))child.classList.add('legacy-stats');
    }
    const selected=this.statsDifficulty||'all';
    const choices=[['all','전체'],['easy','초급'],['medium','중급'],['hard','고급'],['expert','전문가']];
    const d=this.stats.byDiff[selected];
    const records=(this.replays||this.loadReplays()).filter(r=>(selected==='all'||r.difficulty===selected));
    const valid=records.filter(r=>r.result==='win'&&r.finalScore>=0&&(r.recordEligible===true||(r.mode!=='battle'&&r.recordEligible!==false)));
    const times=valid.map(r=>{const t=String(r.finalTime||'').split(':').map(Number);return t.length===2?t[0]*60+t[1]:NaN;}).filter(Number.isFinite);
    const time=n=>n==null?'기록 없음':`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
    const games=selected==='all'?this.stats.totalGames:d?.trackedGames;
    const wins=selected==='all'?this.stats.totalWins:d?.trackedWins;
    const values=[['총 게임',games??'기록 없음'],['승리',wins??'기록 없음'],['승률',games>0?`${Math.round(wins/games*100)}%`:games===0?'0%':'기록 없음'],['현재 연승',(d||this.stats).currentStreak??'기록 없음'],['최고 연승',(d||this.stats).maxStreak??'기록 없음'],['최고 점수',valid.length?Math.max(...valid.map(r=>r.finalScore)).toLocaleString():'기록 없음'],['최단 시간',time(times.length?Math.min(...times):null)],['평균 시간',time(times.length?Math.round(times.reduce((a,b)=>a+b,0)/times.length):null)],['저장된 리플레이',records.length]];
    area.innerHTML=`<div class="stats-difficulty" role="group" aria-label="통계 난이도">${choices.map(([key,label])=>`<button type="button" data-stats-diff="${key}" aria-pressed="${key===selected}">${label}</button>`).join('')}</div><div class="stats-grid">${values.map(([label,value])=>`<div class="stat-card"><span class="stat-label">${label}</span><strong class="stat-value">${value}</strong></div>`).join('')}</div><p class="stats-note">최고 점수·시간 기록은 저장된 리플레이 중 퍼즐을 완성한 성공 기록 기준입니다. 기권승은 제외합니다. 리플레이는 최근 최대 20판이며, 이전 난이도별 전체 게임 수는 기록이 없어 표시하지 않습니다.</p>`;
    area.querySelectorAll('[data-stats-diff]').forEach(b=>b.onclick=()=>{this.statsDifficulty=b.dataset.statsDiff;this.renderStatsView();});
  };
  window.addEventListener('DOMContentLoaded',()=>{
    replaceIcons(document.getElementById('app'));
    const observer=new MutationObserver(records=>{
      const parents=new Set();
      for(const r of records){if(r.type==='characterData')parents.add(r.target.parentElement);else for(const n of r.addedNodes)parents.add(n.nodeType===3?n.parentElement:n);}
      parents.forEach(replaceIcons);
    });
    observer.observe(document.getElementById('app'),{childList:true,subtree:true,characterData:true});
  });
})();

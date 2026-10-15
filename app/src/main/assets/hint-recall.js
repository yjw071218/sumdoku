/* v1.1.18 · 힌트 재호출 플로팅 버튼 (Recall FAB)
 * 힌트 창을 닫은 뒤 아직 해당 칸을 채우지 않은 상태이면 화면 우측에 작은 원형 버튼이 떠서,
 * 클릭 시 추가 감점이나 힌트 차감 없이 힌트 내역(오버레이·단계)을 다시 볼 수 있게 합니다.
 * 해당 칸이 채워지거나(정답 채우기/직접 입력), 새 게임 시작, 화면 이탈 시 자동으로 사라집니다. */
(() => {
  if (typeof SumdokuApp === 'undefined') return;
  const p = SumdokuApp.prototype;
  const tr = s => (window.I18N && typeof window.I18N.text === 'function' ? window.I18N.text(s) : s);

  function ensureFab() {
    let fab = document.getElementById('btn-hint-recall');
    if (!fab) {
      fab = document.createElement('button');
      fab.type = 'button';
      fab.id = 'btn-hint-recall';
      fab.className = 'hint-recall-fab hidden';
      fab.setAttribute('aria-label', tr('힌트 다시 보기'));
      fab.title = tr('힌트 다시 보기');
      fab.innerHTML = `
        <svg class="fab-icon" viewBox="0 0 24 24">
          <path d="M9 18h6"/>
          <path d="M10 22h4"/>
          <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7Z"/>
        </svg>
        <span class="fab-pos-badge"></span>
      `;
      fab.onclick = (e) => {
        e.stopPropagation();
        window.app?.reopenUnsolvedHint();
      };
      // 게임 뷰 컨테이너 또는 body에 부착
      const view = document.getElementById('view-game') || document.body;
      view.appendChild(fab);
    }
    return fab;
  }

  p.showHintRecallFab = function (h) {
    if (!h || !this.board || !this.board[h.r] || this.board[h.r][h.c].val !== 0) return;
    if (this.currentView !== 'game' || this.isWin || this.isPaused) return;
    const fab = ensureFab();
    const badge = fab.querySelector('.fab-pos-badge');
    if (badge) {
      const posStr = h.posName ? tr(h.posName) : `R${h.r + 1}C${h.c + 1}`;
      badge.textContent = posStr;
    }
    const label = tr('힌트 다시 보기');
    fab.setAttribute('aria-label', label);
    fab.title = label;
    fab.classList.remove('hidden');
  };

  p.hideHintRecallFab = function () {
    const fab = document.getElementById('btn-hint-recall');
    if (fab) fab.classList.add('hidden');
  };

  p.reopenUnsolvedHint = function () {
    const h = this.unsolvedHint;
    if (!h || !this.board || !this.board[h.r] || this.board[h.r][h.c].val !== 0) {
      this.hideHintRecallFab();
      this.unsolvedHint = null;
      return;
    }
    // 감점이나 힌트 차감 없이 기존 힌트 다시 열기
    this.showImmediateHint(true);
  };

  // 힌트 닫힐 때: 칸이 아직 채워지지 않았으면 FAB 표시
  const origDismiss = p.dismissDeductiveHint;
  p.dismissDeductiveHint = function () {
    const h = this.pendingHint || this.unsolvedHint;
    origDismiss.call(this);
    if (h && this.board && this.board[h.r] && this.board[h.r][h.c].val === 0 && this.currentView === 'game' && !this.isWin) {
      this.unsolvedHint = h;
      this.showHintRecallFab(h);
    } else {
      this.unsolvedHint = null;
      this.hideHintRecallFab();
    }
  };

  // 정답 채우기 적용 시: 미해결 힌트 및 FAB 완전 정리
  const origApply = p.applyDeductiveHint;
  p.applyDeductiveHint = function () {
    origApply.call(this);
    this.unsolvedHint = null;
    this.hideHintRecallFab();
  };

  // 판에 숫자가 입력되거나 지워졌을 때: 대상 칸이 채워졌으면 FAB 숨김
  const origUpdate = p.updateBoardDisplay;
  p.updateBoardDisplay = function (...args) {
    const res = origUpdate.apply(this, args);
    if (this.unsolvedHint && this.board && this.board[this.unsolvedHint.r] && this.board[this.unsolvedHint.r][this.unsolvedHint.c].val !== 0) {
      this.unsolvedHint = null;
      this.hideHintRecallFab();
    }
    return res;
  };

  // 새 게임 시작 시: FAB 정리
  const origStart = p.startNewGame;
  p.startNewGame = function (...args) {
    this.unsolvedHint = null;
    this.hideHintRecallFab();
    return origStart.apply(this, args);
  };

  // 화면 전환 시: 게임 뷰가 아니면 숨기고, 돌아오면 미해결 상태일 때 복원
  const origSwitch = p.switchView;
  p.switchView = function (v, ...args) {
    const res = origSwitch.call(this, v, ...args);
    if (v !== 'game') {
      this.hideHintRecallFab();
    } else if (this.unsolvedHint && this.board && this.board[this.unsolvedHint.r] && this.board[this.unsolvedHint.r][this.unsolvedHint.c].val === 0 && (!this.dom?.floatingHintCard || this.dom.floatingHintCard.classList.contains('hidden'))) {
      this.showHintRecallFab(this.unsolvedHint);
    }
    return res;
  };
})();

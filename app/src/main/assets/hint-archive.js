/* v1.1.22 · 힌트 보관함
 *
 * - '스스로 풀기'(또는 닫기)를 눌러도 받은 힌트를 보관합니다. 앱을 껐다 켜거나 이어하기로 돌아와도
 *   같은 퍼즐이면 보관된 힌트가 남아 있고, 힌트 다시 보기 버튼으로 차감 없이 다시 볼 수 있습니다.
 * - 같은 칸에 힌트를 두 번 주지 않습니다. 아직 풀지 않은(힌트의 정답과 다른) 칸의 힌트가 보관돼 있으면
 *   힌트 버튼을 눌러도 새 힌트를 쓰지 않고 그 힌트를 그대로 다시 보여 줍니다(힌트·점수 차감 없음).
 * - 칸을 힌트의 정답으로 채우면 그 힌트는 '완료'로 바뀌어 다시 열리지 않습니다.
 */
(() => {
  if (typeof SumdokuApp === 'undefined') return;
  const p = SumdokuApp.prototype;
  const KEY = 'sumdoku_hint_archive';
  const tr = s => (window.I18N && typeof window.I18N.text === 'function' ? window.I18N.text(s) : s);

  // 퍼즐 식별자: 케이지 모양과 합으로 만듭니다(같은 퍼즐을 이어하면 같은 값).
  const puzzleId = app => {
    const cg = app.cages || [];
    if (!cg.length) return '';
    let h = 0;
    const s = cg.map(c => c.cells.map(x => x.join('')).join('.') + ':' + c.sum).join('|');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return (app.isDaily ? 'd' + (app.dailyDate || '') + '-' : '') + h.toString(36);
  };

  // 보관용 복사본: 보드 참조 등 저장할 수 없는 값은 뺍니다.
  const clean = h => {
    const { board, ...rest } = h || {};
    try { return JSON.parse(JSON.stringify(rest)); } catch (_) { return { r: rest.r, c: rest.c, answer: rest.answer, posName: rest.posName, cageInfo: rest.cageInfo, badgeText: rest.badgeText, explanation: rest.explanation }; }
  };

  p.hintArchiveLoad = function () {
    const id = puzzleId(this);
    let all = {};
    try { all = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) {}
    this.hintArchive = (id && all[id]) || [];
    this._hintArchiveId = id;
    return this.hintArchive;
  };

  p.hintArchiveSave = function () {
    const id = this._hintArchiveId || puzzleId(this);
    if (!id) return;
    let all = {};
    try { all = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) {}
    all[id] = this.hintArchive || [];
    // 오래된 퍼즐 기록은 최근 10개만 남깁니다.
    const ids = Object.keys(all);
    if (ids.length > 10) ids.slice(0, ids.length - 10).forEach(k => { if (k !== id) delete all[k]; });
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (_) {}
  };

  const ensure = app => {
    if (!app.hintArchive || app._hintArchiveId !== puzzleId(app)) app.hintArchiveLoad();
    return app.hintArchive;
  };
  const solved = (app, h) => !!(app.board && app.board[h.r] && app.board[h.r][h.c].val === h.answer);

  // 아직 풀지 않은 보관 힌트(가장 최근 것)
  p.openArchivedHint = function () {
    const list = ensure(this);
    for (let k = list.length - 1; k >= 0; k--) if (!solved(this, list[k])) return list[k];
    return null;
  };

  const remember = (app, h) => {
    if (!h || !Number.isInteger(h.r)) return;
    const list = ensure(app);
    const i = list.findIndex(x => x.r === h.r && x.c === h.c);
    const item = { ...clean(h), at: Date.now() };
    if (i >= 0) list.splice(i, 1);
    list.push(item);
    app.hintArchiveSave();
  };

  // 힌트 보기: 같은 칸 중복 방지 + 받은 힌트 보관
  const show = p.showImmediateHint;
  // 보관 힌트를 차감 없이 다시 엽니다. 칸에 오답이 들어 있어도 같은 힌트를 엽니다.
  const reopen = (app, h) => {
    const cell = app.board[h.r][h.c], v = cell.val;
    if (v) cell.val = 0;
    app.unsolvedHint = { ...h, board: app.board };
    try { show.call(app, true); } finally {
      if (v) { cell.val = v; app.updateBoardDisplay?.(); app.saveOngoingGame?.(); }
    }
  };
  p.showImmediateHint = function (isRecall = false) {
    if (isRecall) {
      const open = this.openArchivedHint();
      if (open) return reopen(this, open);
    } else {
      // 1) 아직 풀지 않은 보관 힌트가 있으면 그것을 다시 보여 줍니다.
      let open = this.openArchivedHint();
      // 2) 새로 찾은 힌트가 이미 힌트를 준 칸이면(예: 오답을 고치는 힌트) 새로 차감하지 않습니다.
      if (!open) {
        let h = null; try { h = this.findImmediateHint(); } catch (_) {}
        if (h) open = ensure(this).find(x => x.r === h.r && x.c === h.c && !solved(this, x)) || null;
      }
      if (open) {
        this.showToast(tr('이 칸의 힌트는 이미 받았습니다. 같은 힌트를 다시 보여 드립니다(차감 없음).'), 3000);
        return reopen(this, open);
      }
    }
    const before = this.pendingHint;
    const res = show.call(this, isRecall);
    if (this.pendingHint && this.pendingHint !== before) remember(this, this.pendingHint);
    return res;
  };

  // 힌트 버튼: 보관된 미해결 힌트가 있으면 확인 창(차감 안내) 없이 바로 다시 엽니다.
  const useHint = p.useHint;
  p.useHint = function () {
    if (this.currentView === 'game' && !this.isPaused && !this.isWin && this.openArchivedHint()) {
      if (this.dom.floatingHintCard && !this.dom.floatingHintCard.classList.contains('hidden')) return;
      return this.showImmediateHint();
    }
    return useHint.apply(this, arguments);
  };

  // 스스로 풀기/닫기: 보관된 힌트로 다시 보기 버튼을 유지합니다.
  const dismiss = p.dismissDeductiveHint;
  p.dismissDeductiveHint = function () {
    const h = this.pendingHint || this.unsolvedHint;
    if (h) remember(this, h);
    const r = dismiss.apply(this, arguments);
    const open = this.openArchivedHint();
    if (open && this.currentView === 'game' && !this.isWin) {
      this.unsolvedHint = { ...open, board: this.board };
      this.showHintRecallFab?.(this.unsolvedHint);
    }
    return r;
  };

  // 다시 보기 버튼: 보관된 힌트를 기준으로 엽니다(칸이 오답으로 채워져 있어도 열림).
  p.reopenUnsolvedHint = function () {
    const open = this.openArchivedHint();
    if (!open) { this.unsolvedHint = null; this.hideHintRecallFab?.(); return; }
    reopen(this, open);
  };

  // 칸을 채우거나 지울 때: 다시 보기 버튼 표시를 보관함 기준으로 맞춥니다.
  const upd = p.updateBoardDisplay;
  p.updateBoardDisplay = function (...a) {
    const r = upd.apply(this, a);
    if (this.currentView === 'game' && this.cages && this.cages.length) {
      const cardOpen = this.dom?.floatingHintCard && !this.dom.floatingHintCard.classList.contains('hidden');
      const open = this.openArchivedHint();
      if (open && !cardOpen && !this.isWin) {
        this.unsolvedHint = { ...open, board: this.board };
        this.showHintRecallFab?.(this.unsolvedHint);
      } else if (!open && !cardOpen) {
        this.unsolvedHint = null;
        this.hideHintRecallFab?.();
      }
    }
    return r;
  };

  // 새 게임·이어하기: 해당 퍼즐의 보관함을 불러옵니다.
  const reload = name => {
    const base = p[name];
    if (typeof base !== 'function') return;
    p[name] = function (...a) {
      const r = base.apply(this, a);
      const after = () => { try { this.hintArchiveLoad(); this.updateBoardDisplay?.(); } catch (_) {} };
      if (r && typeof r.then === 'function') return r.then(v => { after(); return v; });
      after();
      return r;
    };
  };
  ['startNewGame', 'restoreOngoingGame'].forEach(reload);
})();

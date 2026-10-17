/* v1.0.33 추가 기능
 * - 효과음 볼륨(마스터 게인 + 리미터), 진동(햅틱)
 * - 행·열·박스·케이지 완성 애니메이션
 * - 케이지 색상 구분, 같은 숫자 메모 강조
 * - 자동 메모(후보 숫자 채우기)
 * - 오늘의 퍼즐 연속 기록
 * - 업적·배지
 * - 배틀 채팅·이모티콘
 */
(() => {
  const P = SumdokuApp.prototype;
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const prefs = Object.assign({ volume: 80, haptics: true, cageTint: true }, load('sumdoku_prefs_v2', {}));
  const savePrefs = () => save('sumdoku_prefs_v2', prefs);
  const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const appInstance = () => window.app;

  /* ---------- 1. 효과음 볼륨 · 진동 ---------- */
  const SC = SoundController.prototype;
  const baseInit = SC.init;
  SC.init = function () {
    baseInit.call(this);
    if (this.ctx && !this.master) {
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -12; comp.knee.value = 6; comp.ratio.value = 10;
      comp.attack.value = 0.002; comp.release.value = 0.12;
      this.master = this.ctx.createGain();
      this.master.connect(comp); comp.connect(this.ctx.destination);
      this.out = this.master;
    }
    // 기존 출력 대비 최대 약 3.2배. 리미터가 찢어지는 소리를 막습니다.
    if (this.master) this.master.gain.value = (prefs.volume / 100) * 3.2;
  };
  const HAPTIC = { click: 8, correct: 18, error: [40, 50, 40], complete: [14, 30, 26], win: [30, 60, 30, 60, 80], chat: 12, badge: [20, 40, 20] };
  const buzz = type => {
    if (!prefs.haptics || !navigator.vibrate) return;
    try { navigator.vibrate(HAPTIC[type] || 10); } catch (e) {}
  };
  const basePlay = SC.play;
  SC.play = function (type) {
    buzz(type);
    if (!['complete', 'chat', 'badge'].includes(type)) return basePlay.call(this, type);
    if (!this.enabled || prefs.volume <= 0) return;
    try {
      this.init(); if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const notes = type === 'complete' ? [659.25, 880, 1318.5] : type === 'chat' ? [880, 1174.66] : [523.25, 783.99, 1046.5, 1567.98];
      notes.forEach((f, i) => {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain(), s = t + i * 0.07;
        o.type = type === 'chat' ? 'sine' : 'triangle';
        o.frequency.setValueAtTime(f, s);
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(0.12, s + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, s + 0.22);
        o.connect(g); g.connect(this.out || this.ctx.destination);
        o.start(s); o.stop(s + 0.24);
      });
    } catch (e) {}
  };

  /* ---------- 2. 완성 애니메이션 ---------- */
  function completedGroups(app, r, c) {
    const S = app.solution, B = app.board, groups = [];
    const ok = ([rr, cc]) => B[rr][cc].val === S[rr][cc];
    const row = Array.from({ length: 9 }, (_, k) => [r, k]);
    const col = Array.from({ length: 9 }, (_, k) => [k, c]);
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    const box = Array.from({ length: 9 }, (_, k) => [br + Math.floor(k / 3), bc + k % 3]);
    const cageIdx = app.cellCageMap ? app.cellCageMap[`${r},${c}`] : undefined;
    const cage = cageIdx !== undefined && app.cages[cageIdx] ? app.cages[cageIdx].cells : null;
    for (const g of [row, col, box, cage]) if (g && g.length > 1 && g.every(ok)) groups.push(g);
    return groups;
  }
  function celebrate(app, r, c) {
    if (!app.solution || !app.board) return;
    const groups = completedGroups(app, r, c);
    if (!groups.length) return;
    const seen = new Map();
    groups.forEach(g => g.forEach(([rr, cc]) => {
      const d = Math.abs(rr - r) + Math.abs(cc - c);
      if (!seen.has(rr * 9 + cc) || seen.get(rr * 9 + cc) > d) seen.set(rr * 9 + cc, d);
    }));
    if (!reducedMotion()) {
      seen.forEach((d, i) => {
        const el = app.getCellElement(Math.floor(i / 9), i % 9);
        if (!el) return;
        el.classList.remove('unit-done'); void el.offsetWidth;
        el.style.setProperty('--done-delay', `${d * 35}ms`);
        el.classList.add('unit-done');
        clearTimeout(el._doneTimer);
        el._doneTimer = setTimeout(() => el.classList.remove('unit-done'), 900 + d * 35);
      });
    }
    setTimeout(() => app.sound.play('complete'), 110);
  }
  const baseInput = P.handleNumberInput;
  P.handleNumberInput = function (num) {
    if (this._comboBoard !== this.board) { this._comboBoard = this.board; this._maxCombo = 0; }
    const { r, c } = this.selected || {};
    const before = this.board && this.board[r] ? this.board[r][c].val : null;
    const result = baseInput.apply(this, arguments);
    try {
      this._maxCombo = Math.max(this._maxCombo || 0, this.combo || 0);
      if (!this.isPencilMode && before !== num && this.board[r][c].val === num && this.solution && num === this.solution[r][c]) celebrate(this, r, c);
    } catch (e) {}
    return result;
  };
  const baseApplyHint = P.applyDeductiveHint;
  P.applyDeductiveHint = function () {
    const h = this.pendingHint;
    const result = baseApplyHint.apply(this, arguments);
    try { if (h && this.board[h.r][h.c].val === h.answer) celebrate(this, h.r, h.c); } catch (e) {}
    return result;
  };

  /* ---------- 3. 케이지 색상 · 메모 강조 ---------- */
  const tintCache = new WeakMap();
  function cageColors(cages) {
    if (tintCache.has(cages)) return tintCache.get(cages);
    const owner = new Map();
    cages.forEach((cg, i) => cg.cells.forEach(([r, c]) => owner.set(r * 9 + c, i)));
    const adj = cages.map(() => new Set());
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    cages.forEach((cg, i) => cg.cells.forEach(([r, c]) => dirs.forEach(([dr, dc]) => {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr > 8 || cc < 0 || cc > 8) return;
      const j = owner.get(rr * 9 + cc);
      if (j !== undefined && j !== i) adj[i].add(j);
    })));
    const order = cages.map((_, i) => i).sort((a, b) => adj[b].size - adj[a].size);
    const color = new Array(cages.length).fill(-1);
    for (const i of order) {
      const used = new Set([...adj[i]].map(j => color[j]));
      let k = 0; while (used.has(k)) k++;
      color[i] = k % 6;
    }
    tintCache.set(cages, color);
    return color;
  }
  function applyTint(app) {
    document.body.classList.toggle('cage-tint', !!prefs.cageTint);
    if (!app.cages || !app.cages.length || !app.dom || !app.dom.board) return;
    const colors = cageColors(app.cages);
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      const el = app.getCellElement(r, c), idx = app.cellCageMap ? app.cellCageMap[`${r},${c}`] : undefined;
      if (el) { const t = idx === undefined ? '' : String(colors[idx]); if (el.dataset.tint !== t) el.dataset.tint = t; }
    }
  }
  const baseRender = P.updateBoardDisplay;
  P.updateBoardDisplay = function () {
    const result = baseRender.apply(this, arguments);
    try { applyTint(this); syncAutoBtn(this); } catch (e) {}
    return result;
  };
  const baseHighlights = P.updateHighlights;
  P.updateHighlights = function () {
    const result = baseHighlights.apply(this, arguments);
    try {
      document.querySelectorAll('#sudoku-board .note-hit').forEach(el => el.classList.remove('note-hit'));
      const { r, c } = this.selected || {};
      const v = this.board && this.board[r] ? this.board[r][c].val : 0;
      if (v > 0 && this.settings.highlightSame) {
        document.querySelectorAll(`#sudoku-board .cell-notes [data-note="${v}"]`).forEach(el => { if (el.textContent) el.classList.add('note-hit'); });
      }
    } catch (e) {}
    return result;
  };

  /* ---------- 4. 자동 메모 ---------- */
  function candidates(app) {
    const B = app.board, out = Array.from({ length: 9 }, () => Array(9).fill(0));
    const cageAllowed = new Map();
    app.cages.forEach((cg, idx) => {
      let placed = 0, placedSum = 0, empty = 0;
      cg.cells.forEach(([r, c]) => { const v = B[r][c].val; if (v) { placed |= 1 << v; placedSum += v; } else empty++; });
      const target = cg.sum - placedSum;
      let union = 0;
      for (let m = 0; m < 1024; m += 2) {
        if (m & placed) continue;
        let cnt = 0, s = 0;
        for (let d = 1; d <= 9; d++) if (m & (1 << d)) { cnt++; s += d; }
        if (cnt === empty && (cg.noSum || s === target)) union |= m;
      }
      cageAllowed.set(idx, union);
    });
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      if (B[r][c].val) continue;
      let used = 0;
      for (let k = 0; k < 9; k++) {
        used |= 1 << B[r][k].val; used |= 1 << B[k][c].val;
        const br = Math.floor(r / 3) * 3 + Math.floor(k / 3), bc = Math.floor(c / 3) * 3 + k % 3;
        used |= 1 << B[br][bc].val;
      }
      const idx = app.cellCageMap[`${r},${c}`];
      const allow = idx === undefined ? 0x3FE : cageAllowed.get(idx);
      out[r][c] = allow & ~used & 0x3FE;
    }
    return out;
  }
  // v1.0.38: 자동 메모는 켜기/끄기 토글. 끌 때는 켜기 전에 직접 적어 둔 메모로 되돌립니다.
  const syncAutoBtn = app => {
    const btn = document.getElementById('btn-auto-notes');
    const on = !!(app._autoNotes && app._autoNotes.board === app.board);
    if (btn) { btn.classList.toggle('active', on); btn.setAttribute('aria-pressed', String(on)); }
    return on;
  };
  P.syncAutoNotesButton = function () { return syncAutoBtn(this); };
  P.toggleAutoNotes = function () {
    if (this.currentView !== 'game' || this.isPaused || this.isWin || !this.board || !this.cages) return;
    if (!syncAutoBtn(this)) return this.fillAutoNotes();
    const saved = this._autoNotes.notes;
    this.saveSnapshot();
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      if (!this.board[r][c].val) this.board[r][c].notes = new Set(saved[r][c]);
    }
    this._autoNotes = null; syncAutoBtn(this);
    this.updateBoardDisplay();
    if (this.saveOngoingGame) this.saveOngoingGame();
    this.sound.play('click');
    this.showToast('자동 메모를 껐습니다 · 직접 적은 메모로 되돌림');
  };
  P.fillAutoNotes = function () {
    if (this.currentView !== 'game' || this.isPaused || this.isWin || !this.board || !this.cages) return;
    const cand = candidates(this);
    this._autoNotes = { board: this.board, notes: this.board.map(row => row.map(cell => [...(cell.notes || [])])) };
    this.saveSnapshot();
    let filled = 0;
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      if (this.board[r][c].val) continue;
      const s = new Set();
      for (let d = 1; d <= 9; d++) if (cand[r][c] & (1 << d)) s.add(d);
      this.board[r][c].notes = s; filled++;
    }
    this.updateBoardDisplay();
    if (this.saveOngoingGame) this.saveOngoingGame();
    this.sound.play('click');
    if (!filled) this._autoNotes = null;
    syncAutoBtn(this);
    this.showToast(filled ? `자동 메모 켬 · 후보 숫자 ${filled}칸 채움 (한 번 더 누르면 끔)` : '채울 빈칸이 없습니다');
  };

  /* ---------- 5. 오늘의 퍼즐 연속 기록 ---------- */
  const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function dailyStreak(list) {
    const set = new Set(list || []);
    const d = new Date();
    const today = set.has(dayKey(d));
    if (!today) d.setDate(d.getDate() - 1);
    let cur = 0;
    while (set.has(dayKey(d))) { cur++; d.setDate(d.getDate() - 1); }
    let best = 0, run = 0, prev = null;
    [...set].sort().forEach(s => {
      const t = new Date(s + 'T00:00:00');
      run = prev && Math.round((t - prev) / 864e5) === 1 ? run + 1 : 1;
      best = Math.max(best, run); prev = t;
    });
    return { cur, best, today };
  }
  P.renderDailyStreak = function () {
    const s = dailyStreak(this.dailyCleared);
    const text = s.cur ? `🔥 연속 ${s.cur}일 · 최고 ${s.best}일` : (s.best ? `최고 연속 ${s.best}일 · 다시 도전` : '오늘 풀면 연속 기록이 시작돼요');
    const put = (id, parent, cls) => {
      if (!parent) return;
      let el = document.getElementById(id);
      if (!el) { el = document.createElement('span'); el.id = id; el.className = cls; el.dataset.keepEmoji = ''; parent.append(el); }
      el.textContent = text;
      el.classList.toggle('active', s.cur > 0);
      el.classList.toggle('done-today', s.today);
    };
    put('daily-streak-hero', document.querySelector('.daily-hero-info'), 'streak-chip');
    const prog = document.getElementById('daily-trophy-progress');
    put('daily-streak-cal', prog && prog.parentElement, 'streak-chip streak-chip-lg');
    return s;
  };
  const baseCal = P.renderDailyCalendar;
  if (baseCal) P.renderDailyCalendar = function () { const r = baseCal.apply(this, arguments); try { this.renderDailyStreak(); } catch (e) {} return r; };

  /* ---------- 6. 업적 · 배지 ---------- */
  const ACH = [
    { id: 'first_win', icon: '🎉', name: '첫 완성', desc: '퍼즐을 처음으로 완성', test: c => c.win || c.totalWins >= 1 },
    { id: 'no_hint', icon: '🧠', name: '순수 논리', desc: '힌트 없이 완성', test: c => c.win && c.hints === 0 },
    { id: 'perfect', icon: '💎', name: '무결점', desc: '실수 없이 완성', test: c => c.win && c.mistakes === 0 },
    { id: 'speed_easy', icon: '⚡', name: '번개손', desc: '초급을 5분 안에 완성', test: c => c.win && c.diff === 'easy' && c.time <= 300 },
    { id: 'speed_medium', icon: '🚀', name: '쾌속 추론', desc: '중급을 10분 안에 완성', test: c => c.win && c.diff === 'medium' && c.time <= 600 },
    { id: 'hard_clear', icon: '🏔️', name: '고급 정복', desc: '고급 이상 난이도 완성', test: c => c.win && (c.diff === 'hard' || c.diff === 'expert') },
    { id: 'expert_pure', icon: '👑', name: '전문가의 품격', desc: '전문가를 힌트·실수 없이 완성', test: c => c.win && c.diff === 'expert' && c.hints === 0 && c.mistakes === 0 },
    { id: 'combo_9', icon: '🌟', name: '콤보 마스터', desc: '한 게임에서 9콤보 달성', test: c => c.maxCombo >= 9 },
    { id: 'wins_10', icon: '🏅', name: '꾸준함', desc: '누적 10회 완성', test: c => c.totalWins >= 10 },
    { id: 'wins_50', icon: '🏆', name: '스도쿠 장인', desc: '누적 50회 완성', test: c => c.totalWins >= 50 },
    { id: 'daily_3', icon: '🔥', name: '3일 연속', desc: '오늘의 퍼즐 3일 연속 완료', test: c => c.dailyStreak >= 3 },
    { id: 'daily_7', icon: '📅', name: '일주일 개근', desc: '오늘의 퍼즐 7일 연속 완료', test: c => c.dailyStreak >= 7 },
    { id: 'battle_win', icon: '⚔️', name: '첫 배틀 승리', desc: '1:1 배틀에서 승리', test: c => c.battleWins >= 1 },
    { id: 'battle_5', icon: '🥇', name: '배틀 강자', desc: '배틀 누적 5승', test: c => c.battleWins >= 5 },
    // v1.0.37: 기존 '어워드' 목록에서 합친 항목 (전적 기반이라 이미 달성한 기록도 인정)
    { id: 'wins_5', icon: '🥈', name: '연역 추론의 달인', desc: '누적 5회 완성', test: c => c.totalWins >= 5 },
    { id: 'expert_clear', icon: '🥇', name: '전문가 정복자', desc: '전문가 난이도 완성', test: c => c.expertWins >= 1 || (c.win && c.diff === 'expert') },
    { id: 'streak_3', icon: '🔥', name: '연승 가도', desc: '3연승 달성', test: c => c.maxStreak >= 3 },
    { id: 'streak_5', icon: '👑', name: '마스터 마인드', desc: '5연승 달성', test: c => c.maxStreak >= 5 }
  ];
  const unlocked = load('sumdoku_achievements', {});
  const counters = Object.assign({ battleWins: 0 }, load('sumdoku_ach_counters', {}));
  // v2.1.5: 개발자 모드(GitHub판)에서 업적을 일괄 해금할 수 있도록 노출합니다.
  window.SumdokuAchievements = { list: ACH, unlocked, save: () => save('sumdoku_achievements', unlocked) };
  function evaluate(app, ctx, silent) {
    const fresh = [];
    ACH.forEach(a => {
      if (unlocked[a.id]) return;
      let pass = false; try { pass = !!a.test(ctx); } catch (e) {}
      if (pass) { unlocked[a.id] = dayKey(new Date()); fresh.push(a); }
    });
    if (!fresh.length) return fresh;
    save('sumdoku_achievements', unlocked);
    if (silent) return fresh;
    fresh.forEach((a, i) => setTimeout(() => {
      app.showToast(`${a.icon} 업적 달성 · ${a.name}`, 2600);
      app.sound.play('badge');
    }, 1300 + i * 2800));
    return fresh;
  }
  P.evaluateAchievements = function (extra = {}, silent = false) {
    const ctx = Object.assign({
      win: false, hints: this.hintsUsed || 0, mistakes: this.mistakes || 0, diff: this.difficulty,
      time: this.timerSeconds || 0, maxCombo: this._maxCombo || 0,
      totalWins: (this.stats && this.stats.totalWins) || 0,
      dailyStreak: dailyStreak(this.dailyCleared).cur, battleWins: counters.battleWins,
      maxStreak: (this.stats && this.stats.maxStreak) || 0,
      expertWins: (this.stats && this.stats.byDiff && this.stats.byDiff.expert && this.stats.byDiff.expert.wins) || 0
    }, extra);
    return evaluate(this, ctx, silent);
  };
  const baseRecord = P.recordGameEnd;
  P.recordGameEnd = function (isWin) {
    const completed = this.board && this.solution && this.board.every((row, r) => row.every((cell, c) => cell.val === this.solution[r][c]));
    const win = !!(isWin && this.score >= 0 && completed && this.resultReason !== 'forfeit');
    const result = baseRecord.apply(this, arguments);
    try { this.evaluateAchievements({ win }); this.renderDailyStreak(); } catch (e) {}
    return result;
  };
  const baseBattleEnd = P.handleBattleEnd;
  P.handleBattleEnd = function (isVictory) {
    const epoch = this.battleEpoch;
    const result = baseBattleEnd.apply(this, arguments);
    try {
      if (isVictory && this._battleWinEpoch !== epoch) {
        this._battleWinEpoch = epoch;
        counters.battleWins++; save('sumdoku_ach_counters', counters);
        this.evaluateAchievements({ win: false });
      }
    } catch (e) {}
    return result;
  };
  // v1.0.37: 업적은 '어워드' 패널 하나로 통합 (통계 화면에서는 제거)
  P.renderAchievements = function () {
    const panel = document.getElementById('panel-awards');
    if (!panel) return;
    try { this.evaluateAchievements({ win: false }, true); } catch (e) {}
    document.getElementById('awards-list-grid')?.remove();
    let sec = document.getElementById('achievements-section');
    if (!sec) { sec = document.createElement('section'); sec.id = 'achievements-section'; sec.className = 'ach-section'; sec.dataset.keepEmoji = ''; }
    if (sec.parentElement !== panel) panel.append(sec);
    const got = ACH.filter(a => unlocked[a.id]).length;
    sec.innerHTML = `<div class="ach-head"><h3>달성 현황</h3><span class="ach-count">${got} / ${ACH.length}</span></div>
      <div class="ach-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${ACH.length}" aria-valuenow="${got}"><span style="width:${Math.round(got / ACH.length * 100)}%"></span></div>
      <div class="ach-grid"></div>`;
    const grid = sec.querySelector('.ach-grid');
    ACH.forEach(a => {
      const card = document.createElement('div');
      card.className = 'ach-card' + (unlocked[a.id] ? ' got' : '');
      const icon = document.createElement('span'); icon.className = 'ach-icon'; icon.textContent = unlocked[a.id] ? a.icon : '🔒';
      const name = document.createElement('strong'); name.textContent = a.name;
      const desc = document.createElement('small'); desc.textContent = unlocked[a.id] ? `${a.desc} · ${unlocked[a.id]}` : a.desc;
      card.append(icon, name, desc);
      grid.append(card);
    });
  };
  const baseStats = P.renderStatsView;
  P.renderStatsView = function () { const r = baseStats.apply(this, arguments); document.querySelector('#panel-stats #achievements-section')?.remove(); return r; };
  P.renderAwardsList = function () { this.renderAchievements(); };

  /* ---------- 7. 배틀 채팅 · 이모티콘 ---------- */
  const EMOJI = ['👍', '😂', '😮', '😭', '🔥', '👏', '🤝', '😎'];
  // v1.1.30: 상용 문구는 [[키]] 로 보내고, 받는 사람이 고른 언어로 표시합니다(보내는 사람 언어와 무관).
  const CHAT_LANGS = ['ko', 'en', 'ja', 'zh', 'zh-TW', 'es', 'fr', 'de'];
  const PHRASE_TEXT = {
    gg: ['GG!', 'GG!', 'GG!', 'GG!', 'GG!', '¡GG!', 'GG !', 'GG!'],
    nice: ['잘하시네요', 'Nice play!', 'お上手ですね', '玩得真好', '玩得真好', '¡Bien jugado!', 'Bien joué !', 'Gut gespielt!'],
    fast: ['빠르다!', 'So fast!', '速い！', '好快！', '好快！', '¡Qué rápido!', 'Trop rapide !', 'So schnell!'],
    hard: ['어렵다…', 'This is tough…', '難しい…', '好难…', '好難…', 'Qué difícil…', 'C’est dur…', 'Ganz schön schwer…'],
    again: ['한 판 더?', 'One more?', 'もう一戦？', '再来一局？', '再來一局？', '¿Otra?', 'Encore une ?', 'Noch eine Runde?']
  };
  const PHRASES = Object.keys(PHRASE_TEXT);
  const chatLangIdx = () => Math.max(0, CHAT_LANGS.indexOf((window.I18N && I18N.currentLang) || 'ko'));
  const phraseLabel = k => PHRASE_TEXT[k][chatLangIdx()] || PHRASE_TEXT[k][1];
  // [[키]] 또는 (이전 버전이 보낸) 어떤 언어의 문구든 내 언어로 바꿔 보여 줍니다.
  const localizeChat = t => {
    const m = /^\[\[([a-z]+)\]\]$/.exec(t);
    if (m && PHRASE_TEXT[m[1]]) return phraseLabel(m[1]);
    for (const k of PHRASES) if (PHRASE_TEXT[k].includes(t)) return phraseLabel(k);
    return t;
  };
  const CHAT_UI = {
    title: ['대화', 'Chat', 'チャット', '聊天', '聊天', 'Chat', 'Discussion', 'Chat'],
    sub: ['상대에게 실시간으로 전달돼요', 'Delivered to your opponent in real time', '相手にリアルタイムで届きます', '实时发送给对手', '即時傳送給對手', 'Se envía al rival en tiempo real', 'Envoyé à l’adversaire en temps réel', 'Wird in Echtzeit an den Gegner gesendet'],
    empty: ['아직 대화가 없어요. 이모티콘으로 인사해 보세요!', 'No messages yet. Say hi with an emoji!', 'まだメッセージはありません。絵文字で挨拶しよう！', '还没有消息，用表情打个招呼吧！', '還沒有訊息，用表情打個招呼吧！', 'Aún no hay mensajes. ¡Saluda con un emoji!', 'Aucun message. Dites bonjour avec un emoji !', 'Noch keine Nachrichten. Sag Hallo mit einem Emoji!'],
    placeholder: ['메시지 입력 (최대 80자)', 'Message (max 80 chars)', 'メッセージ（最大80文字）', '输入消息（最多80字）', '輸入訊息（最多80字）', 'Mensaje (máx. 80)', 'Message (80 max)', 'Nachricht (max. 80)'],
    send: ['보내기', 'Send', '送信', '发送', '傳送', 'Enviar', 'Envoyer', 'Senden'],
    close: ['대화 닫기', 'Close chat', 'チャットを閉じる', '关闭聊天', '關閉聊天', 'Cerrar chat', 'Fermer', 'Chat schließen'],
    open: ['상대와 대화하기', 'Chat with opponent', '相手とチャット', '与对手聊天', '與對手聊天', 'Chatear con el rival', 'Discuter avec l’adversaire', 'Mit Gegner chatten'],
    them: ['상대', 'Opponent', '相手', '对手', '對手', 'Rival', 'Adversaire', 'Gegner']
  };
  const cu = k => CHAT_UI[k][chatLangIdx()] || CHAT_UI[k][1];
  function applyChatLanguage() {
    const sheet = document.getElementById('battle-chat-sheet');
    if (!sheet) return;
    sheet.querySelector('.chat-head strong').textContent = cu('title');
    sheet.querySelector('.chat-sub').textContent = cu('sub');
    sheet.querySelector('.chat-close').setAttribute('aria-label', cu('close'));
    const input = sheet.querySelector('#chat-input'); if (input) input.placeholder = cu('placeholder');
    const send = sheet.querySelector('.chat-send'); if (send) send.textContent = cu('send');
    const empty = sheet.querySelector('.chat-empty'); if (empty) empty.textContent = cu('empty');
    sheet.querySelectorAll('.chat-phrase').forEach(b => { b.textContent = phraseLabel(b.dataset.phrase); });
    // 이미 받은 문구 말풍선도 새 언어로 다시 표시
    sheet.querySelectorAll('.chat-msg[data-text]').forEach(b => { if (!b.classList.contains('emoji')) b.textContent = localizeChat(b.dataset.text); });
    document.getElementById('btn-battle-chat')?.setAttribute('aria-label', cu('open'));
  }
  new MutationObserver(applyChatLanguage).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  const chat = { timer: null, last: 0, busy: false, sentAt: 0, unread: 0, open: false };
  const chatUrl = app => app.battleRole === 1 ? `http://${app.battleHostIp || '127.0.0.1'}:8888` : app.battleHostUrl;
  const isEmojiOnly = t => t.length <= 8 && EMOJI.includes(t);
  function addMessage(mine, text) {
    const list = document.getElementById('chat-list');
    if (!list) return;
    list.querySelector('.chat-empty')?.remove();
    const emoji = isEmojiOnly(text), last = list.lastElementChild, now = Date.now();
    // 같은 이모지를 연타하면 말풍선을 새로 쌓지 않고 콤보 숫자를 키우며 다시 튕깁니다.
    // v1.1.30: 같은 이모지를 연타하면 '×숫자' 대신 같은 이모지가 뾰잉 튀어나왔다가 사라집니다(누적 배지 없음).
    if (emoji && last && last.dataset.text === text && last.classList.contains(mine ? 'mine' : 'theirs') && now - (+last.dataset.at || 0) < 2500) {
      last.dataset.at = now;
      last.classList.remove('boing'); void last.offsetWidth; last.classList.add('boing');
      emojiPop(last, text, mine);
      list.scrollTop = list.scrollHeight;
      return;
    }
    const b = document.createElement('div');
    b.className = `chat-msg ${mine ? 'mine' : 'theirs'}${emoji ? ' emoji boing' : ''}`;
    b.dataset.text = text; b.dataset.at = now;
    b.textContent = emoji ? text : localizeChat(text);
    list.append(b);
    while (list.children.length > 60) list.firstChild.remove();
    list.scrollTop = list.scrollHeight;
  }
  // 기준 요소 위에서 이모지 하나가 탄력 있게 커졌다가 위로 떠오르며 사라집니다.
  function emojiPop(anchor, text, mine) {
    if (!anchor || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = anchor.getBoundingClientRect();
    if (!r.width && !r.height) return;
    const f = document.createElement('span');
    f.className = 'emoji-pop'; f.textContent = text; f.setAttribute('aria-hidden', 'true');
    const side = mine === undefined ? (Math.random() - .5) : (mine ? -1 : 1);
    f.style.left = (r.left + r.width / 2) + 'px';
    f.style.top = (r.top + r.height / 2) + 'px';
    f.style.setProperty('--dx', (side * (18 + Math.random() * 34)).toFixed(0) + 'px');
    f.style.setProperty('--rot', ((Math.random() * 40 - 20)).toFixed(0) + 'deg');
    f.style.setProperty('--s', (1.15 + Math.random() * .35).toFixed(2));
    document.body.append(f);
    f.addEventListener('animationend', () => f.remove());
    setTimeout(() => f.remove(), 1400);
  }
  function burst(btn, text) {
    if (!btn || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = btn.getBoundingClientRect();
    for (let i = 0; i < 3; i++) {
      const f = document.createElement('span'); f.className = 'emoji-fly'; f.textContent = text;
      f.style.left = r.left + r.width / 2 + 'px'; f.style.top = r.top + 'px';
      f.style.setProperty('--dx', (Math.random() * 90 - 45) + 'px');
      f.style.setProperty('--rot', (Math.random() * 60 - 30) + 'deg');
      f.style.animationDelay = i * 45 + 'ms';
      document.body.append(f); f.addEventListener('animationend', () => f.remove());
    }
    btn.classList.remove('tap'); void btn.offsetWidth; btn.classList.add('tap');
  }
  function popBubble(text) {
    const pop = document.getElementById('chat-pop');
    if (!pop) return;
    const emoji = isEmojiOnly(text);
    const same = emoji && pop.classList.contains('show') && pop.dataset.text === text;
    pop.dataset.text = text;
    pop.textContent = emoji ? text : `${cu('them')}: ${localizeChat(text)}`;
    pop.classList.toggle('emoji', emoji);
    if (same) emojiPop(pop, text);
    pop.classList.remove('show'); void pop.offsetWidth; pop.classList.add('show');
    clearTimeout(pop._t); pop._t = setTimeout(() => pop.classList.remove('show'), 2600);
  }
  function setUnread(n) {
    chat.unread = n;
    const badge = document.getElementById('chat-unread');
    if (badge) { badge.textContent = n > 9 ? '9+' : String(n); badge.classList.toggle('hidden', !n); }
  }
  async function pollChat(app) {
    if (chat.busy || !app.isBattle && app.currentView !== 'game') return;
    const base = chatUrl(app); if (!base) return;
    chat.busy = true;
    try {
      const res = await app.battleFetch(`${base}/api/chat?after=${chat.last}`);
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.last === 'number' && data.last < chat.last) chat.last = 0; // 서버 재시작
      (data.messages || []).forEach(m => {
        if (m.id <= chat.last) return;
        chat.last = m.id;
        const mine = m.player === app.battleRole;
        if (mine) return; // 내 메시지는 보낼 때 이미 표시
        addMessage(false, m.text);
        app.sound.play('chat');
        if (!chat.open) { popBubble(m.text); setUnread(chat.unread + 1); }
      });
    } catch (e) {
    } finally { chat.busy = false; }
  }
  P.startBattleChat = function () {
    clearInterval(chat.timer);
    document.body.classList.add('chat-enabled');
    chat.timer = setInterval(() => pollChat(this), 1200);
    pollChat(this);
  };
  P.stopBattleChat = function () {
    clearInterval(chat.timer); chat.timer = null;
    document.body.classList.remove('chat-enabled');
    this.closeBattleChat();
  };
  P.sendBattleChat = async function (text, btn) {
    text = String(text || '').trim().slice(0, 80);
    if (!text) return;
    const emoji = isEmojiOnly(text);
    const now = Date.now();
    // 이모지는 연타 감각을 위해 짧은 간격(180ms)만 제한하고 화면에는 즉시 반영합니다.
    if (now - chat.sentAt < (emoji ? 180 : 700)) { if (!emoji) this.showToast('조금 천천히 보내 주세요'); return; }
    chat.sentAt = now;
    if (emoji) { burst(btn, text); addMessage(true, text); this.sound.play('click'); try { navigator.vibrate?.(12); } catch (_) {} }
    const base = chatUrl(this);
    try {
      const res = await this.battleFetch(`${base}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ player: this.battleRole, text }) });
      if (!res.ok) throw new Error('send');
      const data = await res.json();
      if (data.id && data.id === chat.last + 1) chat.last = data.id;
      if (!emoji) { addMessage(true, text); this.sound.play('click'); }
    } catch (e) {
      this.showToast('메시지를 보내지 못했습니다. 연결을 확인해 주세요');
    }
  };
  P.openBattleChat = function () {
    const sheet = document.getElementById('battle-chat-sheet');
    if (!sheet) return;
    sheet.classList.remove('hidden'); chat.open = true; setUnread(0);
    const list = document.getElementById('chat-list'); if (list) list.scrollTop = list.scrollHeight;
    document.getElementById('chat-input')?.focus({ preventScroll: true });
  };
  P.closeBattleChat = function () {
    const sheet = document.getElementById('battle-chat-sheet');
    if (sheet && !sheet.classList.contains('hidden')) { sheet.classList.add('hidden'); document.getElementById('btn-battle-chat')?.focus({ preventScroll: true }); }
    chat.open = false;
  };
  const baseStartBattle = P.startBattleMatch;
  P.startBattleMatch = function () {
    // 바로 재시작(재대결)이면 대화를 유지하고, 새로 만든/참가한 방이면 대화를 비웁니다.
    if (!this.isRematchActive) {
      chat.last = 0; setUnread(0);
      const list = document.getElementById('chat-list');
      if (list) { list.innerHTML = ''; const e = document.createElement('p'); e.className = 'chat-empty'; e.textContent = cu('empty'); list.append(e); }
    }
    const result = baseStartBattle.apply(this, arguments);
    try { this.startBattleChat(); } catch (e) {}
    return result;
  };
  const baseSwitch = P.switchView;
  P.switchView = function (v) {
    if (v !== 'game' && chat.timer) this.stopBattleChat();
    return baseSwitch.apply(this, arguments);
  };
  const baseBack = P.handleBackKey;
  P.handleBackKey = function () {
    if (chat.open) { this.closeBattleChat(); return 'handled'; }
    return baseBack.apply(this, arguments);
  };

  /* ---------- DOM 구성 ---------- */
  const svg = path => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  function buildToolbarButton(app) {
    if (document.getElementById('btn-auto-notes')) return;
    const pencil = document.getElementById('btn-pencil');
    if (!pencil) return;
    const btn = document.createElement('button');
    btn.id = 'btn-auto-notes'; btn.className = 'tool-btn'; btn.type = 'button';
    btn.title = '모든 빈칸에 후보 숫자 채우기'; btn.setAttribute('aria-label', '자동 메모: 모든 빈칸에 후보 숫자 채우기');
    btn.innerHTML = `<div class="tool-icon">${svg('<path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z"/><path d="M19 15l.8 1.9 1.9.8-1.9.8L19 20.4l-.8-1.9-1.9-.8 1.9-.8z"/>')}</div><span class="tool-label">자동 메모</span>`;
    btn.addEventListener('click', () => app.toggleAutoNotes());
    pencil.after(btn);
  }
  function buildChat(app) {
    if (document.getElementById('btn-battle-chat')) return;
    const forfeit = document.getElementById('btn-battle-forfeit');
    if (forfeit) {
      const btn = document.createElement('button');
      btn.id = 'btn-battle-chat'; btn.type = 'button'; btn.className = 'battle-chat-btn';
      btn.setAttribute('aria-label', '상대와 대화하기');
      btn.innerHTML = `${svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>')}<span id="chat-unread" class="chat-unread hidden">0</span>`;
      btn.addEventListener('click', () => (chat.open ? app.closeBattleChat() : app.openBattleChat()));
      forfeit.before(btn);
    }
    const view = document.getElementById('view-game');
    const pop = document.createElement('div'); pop.id = 'chat-pop'; pop.className = 'chat-pop'; pop.dataset.keepEmoji = ''; pop.setAttribute('aria-live', 'polite');
    const sheet = document.createElement('section');
    sheet.id = 'battle-chat-sheet'; sheet.className = 'chat-sheet hidden'; sheet.dataset.keepEmoji = '';
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', '배틀 대화');
    sheet.innerHTML = `
      <header class="chat-head"><strong>대화</strong><span class="chat-sub">상대에게 실시간으로 전달돼요</span><button type="button" class="chat-close" aria-label="대화 닫기">✕</button></header>
      <div id="chat-list" class="chat-list" aria-live="polite"><p class="chat-empty">아직 대화가 없어요. 이모티콘으로 인사해 보세요!</p></div>
      <div class="chat-emoji-row">${EMOJI.map(e => `<button type="button" class="chat-emoji" data-text="${e}" aria-label="${e} 보내기">${e}</button>`).join('')}</div>
      <div class="chat-phrase-row">${PHRASES.map(k => `<button type="button" class="chat-phrase" data-phrase="${k}" data-keep-text="">${phraseLabel(k)}</button>`).join('')}</div>
      <form class="chat-form"><input id="chat-input" type="text" maxlength="80" autocomplete="off" enterkeyhint="send" placeholder="메시지 입력 (최대 80자)" aria-label="메시지"><button type="submit" class="btn btn-primary chat-send">보내기</button></form>`;
    sheet.querySelector('.chat-close').addEventListener('click', () => app.closeBattleChat());
    sheet.querySelectorAll('.chat-emoji[data-text]').forEach(b => b.addEventListener('click', () => app.sendBattleChat(b.dataset.text, b)));
    sheet.querySelectorAll('.chat-phrase[data-phrase]').forEach(b => b.addEventListener('click', () => app.sendBattleChat(`[[${b.dataset.phrase}]]`, b)));
    sheet.querySelector('.chat-form').addEventListener('submit', e => {
      e.preventDefault();
      const input = document.getElementById('chat-input');
      const t = input.value; input.value = '';
      app.sendBattleChat(t);
    });
    // 채팅 입력 중 숫자 키가 보드 입력으로 넘어가지 않도록 차단
    sheet.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') app.closeBattleChat(); });
    view.append(pop, sheet);
    applyChatLanguage();
  }
  function buildSettings(app) {
    if (document.getElementById('setting-volume')) return;
    const anchor = document.getElementById('setting-highlight-same')?.closest('.settings-item');
    if (!anchor) return;
    const item = (title, desc, control) => {
      const d = document.createElement('div'); d.className = 'settings-item';
      d.innerHTML = `<div class="settings-info"><span class="s-title">${title}</span><span class="s-desc">${desc}</span></div>`;
      d.append(control); return d;
    };
    const toggle = (id, key, onChange) => {
      const l = document.createElement('label'); l.className = 'toggle-switch';
      l.innerHTML = `<input type="checkbox" id="${id}"><span class="slider"></span>`;
      const input = l.querySelector('input'); input.checked = !!prefs[key];
      input.addEventListener('change', () => { prefs[key] = input.checked; savePrefs(); onChange && onChange(); });
      return l;
    };
    const vol = document.createElement('div'); vol.className = 'volume-control';
    vol.innerHTML = `<input type="range" id="setting-volume" min="0" max="100" step="5" aria-label="효과음 볼륨"><output id="setting-volume-val"></output>`;
    const range = vol.querySelector('input'), outEl = vol.querySelector('output');
    const sync = () => { outEl.textContent = `${prefs.volume}%`; range.style.setProperty('--fill', `${prefs.volume}%`); };
    range.value = prefs.volume; sync();
    range.addEventListener('input', () => { prefs.volume = +range.value; sync(); app.sound.init(); });
    range.addEventListener('change', () => { savePrefs(); app.sound.play('correct'); });
    const frag = [
      item('효과음 볼륨', '기본값이 이전보다 약 2.5배 큽니다', vol),
      item('진동 피드백', '입력·오답·완성 시 짧게 진동합니다', toggle('setting-haptics', 'haptics', () => prefs.haptics && buzz('correct'))),
      item('케이지 색상 구분', '케이지마다 옅은 색을 칠해 경계를 쉽게 읽습니다', toggle('setting-cage-tint', 'cageTint', () => applyTint(app)))
    ];
    anchor.after(...frag);
  }

  window.addEventListener('DOMContentLoaded', () => {
    const app = appInstance();
    if (!app) return;
    try { buildToolbarButton(app); } catch (e) {}
    try { buildChat(app); } catch (e) {}
    try { buildSettings(app); } catch (e) {}
    try { app.renderDailyStreak(); } catch (e) {}
    try { applyTint(app); } catch (e) {}
    try { if (app.sound.ctx) app.sound.init(); } catch (e) {}
    // 키보드: A = 자동 메모
    document.addEventListener('keydown', e => {
      if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return;
      if ((e.key === 'a' || e.key === 'A') && !e.ctrlKey && !e.metaKey && app.currentView === 'game' && !document.querySelector('.modal-backdrop:not(.hidden)')) app.toggleAutoNotes();
    });
  });
})();

/* v1.0.39: 점수·보너스·콤보처럼 화면(점수판·콤보 게이지·칸 표시)에 이미 드러나는 안내는
 * 상단 점수를 가리지 않도록 띄우지 않습니다. 오류·연결·힌트 없음 같은 안내는 그대로 표시합니다. */
(() => {
  const QUIET = [/보너스/, /\(\+[\d,]+점\)/, /\(-\d+점\)/, /퍼펙트 클리어/, /노힌트/, /연역 추론 보장/, /배틀 시작!/,
    /^⚡/, /이전 게임을 이어서/, /일일 도전 .*시작합니다/, /^실행 취소되었습니다/, /^테마: /];
  const P = SumdokuApp.prototype, base = P.showToast;
  P.isQuietToast = msg => QUIET.some(re => re.test(String(msg)));
  P.showToast = function (msg, ...rest) {
    if (P.isQuietToast(msg)) return;
    const localized = (window.I18N && typeof window.I18N.text === 'function') ? window.I18N.text(String(msg)) : msg;
    return base.call(this, localized, ...rest);
  };

})();

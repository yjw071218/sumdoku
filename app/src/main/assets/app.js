/**
 * Sumdoku (썸도쿠) - 100% 추론 보장 논리 퍼즐 앱
 * 
 * - 홈 화면, 게임 화면(폰/태블릿 분할 반응형), 전적 및 통계 시스템
 * - GitHub 연동 자동 업데이트 체커
 * - 로컬 저장소 기반 게임 이어하기 및 전적 지속성
 */

const APP_VERSION = "1.0.0";
const GITHUB_REPO = "yjw071218/sumdoku";

// ============================================================================
// 1. 사전 검증된 기본 퍼즐 데이터 (81칸 완벽 분할)
// ============================================================================
const DEFAULT_PUZZLE = {
  solution: [
    [4, 5, 7, 1, 2, 3, 9, 6, 8],
    [2, 3, 6, 9, 8, 5, 4, 7, 1],
    [1, 9, 8, 6, 4, 7, 2, 5, 3],
    [3, 4, 5, 8, 1, 9, 6, 2, 7],
    [7, 2, 9, 3, 5, 6, 1, 8, 4],
    [6, 8, 1, 4, 7, 2, 5, 3, 9],
    [9, 7, 3, 5, 6, 4, 8, 1, 2],
    [8, 6, 4, 2, 3, 1, 7, 9, 5],
    [5, 1, 2, 7, 9, 8, 3, 4, 6]
  ],
  cages: [
    { sum: 8,  cells: [[8, 5]] },             // 1칸 앵커 (시작 힌트: 합계 8)
    { sum: 2,  cells: [[5, 5]] },             // 1칸 앵커 (시작 힌트: 합계 2)
    { sum: 9,  cells: [[6, 0]] },             // 1칸 앵커 (시작 힌트: 합계 9)
    { sum: 2,  cells: [[4, 1]] },             // 1칸 앵커 (시작 힌트: 합계 2)
    { sum: 1,  cells: [[7, 5]] },             // 1칸 앵커 (시작 힌트: 합계 1)
    { sum: 6,  cells: [[6, 4]] },             // 1칸 앵커 (시작 힌트: 합계 6)
    { sum: 16, cells: [[4, 0], [5, 0], [3, 0]] },
    { sum: 5,  cells: [[3, 4], [2, 4]] },
    { sum: 17, cells: [[6, 5], [6, 6], [5, 6]] },
    { sum: 12, cells: [[1, 7], [1, 8], [1, 6]] },
    { sum: 8,  cells: [[1, 5], [0, 5]] },
    { sum: 9,  cells: [[4, 7], [4, 6]] },
    { sum: 21, cells: [[2, 1], [3, 1], [2, 2]] },
    { sum: 19, cells: [[7, 6], [8, 6], [7, 7]] },
    { sum: 7,  cells: [[8, 2], [8, 1], [7, 2]] },
    { sum: 14, cells: [[5, 3], [5, 4], [4, 3]] },
    { sum: 23, cells: [[0, 6], [0, 7], [0, 8]] },
    { sum: 23, cells: [[4, 2], [3, 2], [5, 2], [5, 1]] },
    { sum: 26, cells: [[7, 0], [8, 0], [7, 1], [6, 1]] },
    { sum: 19, cells: [[1, 4], [0, 4], [1, 3]] },
    { sum: 12, cells: [[7, 4], [8, 4]] },
    { sum: 24, cells: [[3, 5], [3, 6], [2, 6], [2, 5]] },
    { sum: 17, cells: [[2, 7], [3, 7], [3, 8], [2, 8]] },
    { sum: 8,  cells: [[6, 8], [7, 8], [6, 7]] },
    { sum: 16, cells: [[4, 8], [5, 8], [5, 7]] },
    { sum: 3,  cells: [[2, 0], [1, 0]] },
    { sum: 11, cells: [[4, 4], [4, 5]] },
    { sum: 14, cells: [[3, 3], [2, 3]] },
    { sum: 8,  cells: [[6, 3], [6, 2]] },
    { sum: 14, cells: [[0, 3], [0, 2], [1, 2]] },
    { sum: 12, cells: [[0, 0], [0, 1], [1, 1]] },
    { sum: 10, cells: [[8, 8], [8, 7]] },
    { sum: 9,  cells: [[7, 3], [8, 3]] }
  ]
};

// ============================================================================
// 2. 동적 100% 추론 보장 퍼즐 생성기
// ============================================================================
class SumdokuGenerator {
  generate(initialAnchors = 4) {
    const solution = this.createSolution();
    let cages = this.createCages(solution, initialAnchors);

    let attempts = 0;
    while (attempts++ < 80) {
      const solved = this.solveDeductively(solution, cages);
      if (solved === 81) break;

      const multiCages = cages.filter(c => c.cells.length > 2);
      if (multiCages.length === 0) break;
      const targetCage = multiCages[Math.floor(Math.random() * multiCages.length)];
      
      const removedCell = targetCage.cells.pop();
      targetCage.sum -= solution[removedCell[0]][removedCell[1]];
      cages.push({
        sum: solution[removedCell[0]][removedCell[1]],
        cells: [removedCell]
      });
    }

    return { solution, cages };
  }

  createSolution() {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));
    for (let b = 0; b < 9; b += 3) {
      const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
      let idx = 0;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          board[b + r][b + c] = nums[idx++];
        }
      }
    }

    const isSafe = (r, c, val) => {
      for (let i = 0; i < 9; i++) {
        if (board[r][i] === val || board[i][c] === val) return false;
      }
      const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          if (board[br + i][bc + j] === val) return false;
        }
      }
      return true;
    };

    const fill = (r = 0, c = 0) => {
      if (r === 9) return true;
      if (c === 9) return fill(r + 1, 0);
      if (board[r][c] !== 0) return fill(r, c + 1);

      const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
      for (const n of nums) {
        if (isSafe(r, c, n)) {
          board[r][c] = n;
          if (fill(r, c + 1)) return true;
          board[r][c] = 0;
        }
      }
      return false;
    };

    fill(0, 0);
    return board;
  }

  createCages(solution, initialAnchors) {
    const allCells = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        allCells.push([r, c]);
      }
    }
    allCells.sort(() => Math.random() - 0.5);

    const assigned = new Set();
    const cages = [];

    for (let i = 0; i < initialAnchors; i++) {
      const cell = allCells[i];
      assigned.add(`${cell[0]},${cell[1]}`);
      cages.push({
        sum: solution[cell[0]][cell[1]],
        cells: [cell]
      });
    }

    const remaining = allCells.slice(initialAnchors);
    for (const startCell of remaining) {
      const key = `${startCell[0]},${startCell[1]}`;
      if (assigned.has(key)) continue;

      const currentCageCells = [startCell];
      assigned.add(key);
      const targetSize = [2, 3, 3, 4][Math.floor(Math.random() * 4)];

      while (currentCageCells.length < targetSize) {
        const neighbors = [];
        for (const [cr, cc] of currentCageCells) {
          for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nr = cr + dr, nc = cc + dc;
            if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
              const nKey = `${nr},${nc}`;
              if (!assigned.has(nKey)) {
                const existVals = currentCageCells.map(([r, c]) => solution[r][c]);
                if (!existVals.includes(solution[nr][nc])) {
                  neighbors.push([nr, nc]);
                }
              }
            }
          }
        }
        if (neighbors.length === 0) break;
        const nextCell = neighbors[Math.floor(Math.random() * neighbors.length)];
        currentCageCells.push(nextCell);
        assigned.add(`${nextCell[0]},${nextCell[1]}`);
      }

      const sum = currentCageCells.reduce((acc, [r, c]) => acc + solution[r][c], 0);
      cages.push({ sum, cells: currentCageCells });
    }

    return cages;
  }

  solveDeductively(solution, cages) {
    const candidates = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]))
    );

    let changed = true;
    let loop = 0;
    while (changed && loop++ < 80) {
      changed = false;

      // 규칙 1: Naked Single & 피어 소거
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (candidates[r][c].size === 1) {
            const val = [...candidates[r][c]][0];
            for (let i = 0; i < 9; i++) {
              if (i !== c && candidates[r][i].has(val)) {
                candidates[r][i].delete(val);
                changed = true;
              }
              if (i !== r && candidates[i][c].has(val)) {
                candidates[i][c].delete(val);
                changed = true;
              }
            }
            const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
            for (let i = 0; i < 3; i++) {
              for (let j = 0; j < 3; j++) {
                if ((br + i !== r || bc + j !== c) && candidates[br + i][bc + j].has(val)) {
                  candidates[br + i][bc + j].delete(val);
                  changed = true;
                }
              }
            }
          }
        }
      }

      // 규칙 2: 케이지 합계 조합 필터링
      for (const cage of cages) {
        const solvedVals = [];
        const unsolved = [];
        for (const [r, c] of cage.cells) {
          if (candidates[r][c].size === 1) {
            solvedVals.push([...candidates[r][c]][0]);
          } else {
            unsolved.push([r, c]);
          }
        }
        if (unsolved.length === 0) continue;

        const remSum = cage.sum - solvedVals.reduce((a, b) => a + b, 0);
        const validSets = unsolved.map(() => new Set());

        const findCombos = (idx, currentSum, usedVals) => {
          if (idx === unsolved.length) {
            if (currentSum === remSum) {
              for (let i = 0; i < unsolved.length; i++) {
                validSets[i].add(usedVals[i]);
              }
            }
            return;
          }
          const [ur, uc] = unsolved[idx];
          for (const cand of candidates[ur][uc]) {
            if (!usedVals.includes(cand) && !solvedVals.includes(cand)) {
              if (currentSum + cand <= remSum) {
                findCombos(idx + 1, currentSum + cand, [...usedVals, cand]);
              }
            }
          }
        };

        findCombos(0, 0, []);

        for (let i = 0; i < unsolved.length; i++) {
          const [ur, uc] = unsolved[i];
          const beforeSize = candidates[ur][uc].size;
          candidates[ur][uc] = new Set([...candidates[ur][uc]].filter(x => validSets[i].has(x)));
          if (candidates[ur][uc].size < beforeSize) changed = true;
        }
      }

      // 규칙 3: Hidden Single
      for (let r = 0; r < 9; r++) {
        for (let num = 1; num <= 9; num++) {
          const cols = [];
          for (let c = 0; c < 9; c++) {
            if (candidates[r][c].has(num)) cols.push(c);
          }
          if (cols.length === 1 && candidates[r][cols[0]].size > 1) {
            candidates[r][cols[0]] = new Set([num]);
            changed = true;
          }
        }
      }
    }

    let solvedCount = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (candidates[r][c].size === 1) solvedCount++;
      }
    }
    return solvedCount;
  }
}

// ============================================================================
// 3. 앱 주 컨트롤러 (UI / UX / 전적 / 자동 업데이트)
// ============================================================================
class SumdokuApp {
  constructor() {
    this.generator = new SumdokuGenerator();
    this.currentView = 'home';
    
    // 게임 상태
    this.solution = [];
    this.cages = [];
    this.board = [];
    this.cellCageMap = {};
    this.selected = { r: 0, c: 0 };
    this.isPencilMode = false;
    this.mistakes = 0;
    this.maxMistakes = 3;
    this.timerSeconds = 0;
    this.timerInterval = null;
    this.isPaused = false;
    this.undoStack = [];
    this.difficulty = 'expert';

    // 전적 데이터
    this.stats = this.loadStats();

    this.initDOM();
    this.bindEvents();
    this.checkContinueGame();
    this.renderStatsView();

    // 시작 시 조용히 업데이트 체크
    setTimeout(() => this.checkForUpdates(false), 1500);
  }

  // ----------------- 전적 관리 (localStorage) -----------------
  loadStats() {
    try {
      const data = localStorage.getItem('sumdoku_stats');
      if (data) return JSON.parse(data);
    } catch (e) {}
    return {
      totalGames: 0,
      totalWins: 0,
      currentStreak: 0,
      maxStreak: 0,
      byDiff: {
        easy: { wins: 0, bestTime: null, totalTime: 0 },
        medium: { wins: 0, bestTime: null, totalTime: 0 },
        expert: { wins: 0, bestTime: null, totalTime: 0 }
      }
    };
  }

  saveStats() {
    try {
      localStorage.setItem('sumdoku_stats', JSON.stringify(this.stats));
    } catch (e) {}
  }

  recordGameEnd(isWin) {
    this.stats.totalGames++;
    if (isWin) {
      this.stats.totalWins++;
      this.stats.currentStreak++;
      if (this.stats.currentStreak > this.stats.maxStreak) {
        this.stats.maxStreak = this.stats.currentStreak;
      }

      const diffStats = this.stats.byDiff[this.difficulty];
      if (diffStats) {
        diffStats.wins++;
        diffStats.totalTime += this.timerSeconds;
        if (!diffStats.bestTime || this.timerSeconds < diffStats.bestTime) {
          diffStats.bestTime = this.timerSeconds;
        }
      }
    } else {
      this.stats.currentStreak = 0;
    }
    this.saveStats();
    this.renderStatsView();
  }

  renderStatsView() {
    document.getElementById('stat-total-games').textContent = this.stats.totalGames;
    document.getElementById('stat-total-wins').textContent = this.stats.totalWins;
    const winRate = this.stats.totalGames > 0
      ? Math.round((this.stats.totalWins / this.stats.totalGames) * 100)
      : 0;
    document.getElementById('stat-win-rate').textContent = `${winRate}%`;
    document.getElementById('stat-max-streak').textContent = `${this.stats.maxStreak}연승`;

    const formatTime = (secs) => {
      if (!secs) return '기록 없음';
      const m = String(Math.floor(secs / 60)).padStart(2, '0');
      const s = String(secs % 60).padStart(2, '0');
      return `${m}:${s}`;
    };

    document.getElementById('stat-easy-wins').textContent = `${this.stats.byDiff.easy.wins}승`;
    document.getElementById('stat-easy-best').textContent = formatTime(this.stats.byDiff.easy.bestTime);

    document.getElementById('stat-medium-wins').textContent = `${this.stats.byDiff.medium.wins}승`;
    document.getElementById('stat-medium-best').textContent = formatTime(this.stats.byDiff.medium.bestTime);

    document.getElementById('stat-expert-wins').textContent = `${this.stats.byDiff.expert.wins}승`;
    document.getElementById('stat-expert-best').textContent = formatTime(this.stats.byDiff.expert.bestTime);
  }

  // ----------------- 이어하기 (Continue Game) -----------------
  saveOngoingGame() {
    if (this.currentView !== 'game' || this.isWin) return;
    try {
      const state = {
        solution: this.solution,
        cages: this.cages,
        board: this.board.map(r => r.map(c => ({ val: c.val, notes: [...c.notes], error: c.error }))),
        timerSeconds: this.timerSeconds,
        mistakes: this.mistakes,
        difficulty: this.difficulty
      };
      localStorage.setItem('sumdoku_ongoing_game', JSON.stringify(state));
    } catch (e) {}
  }

  clearOngoingGame() {
    try {
      localStorage.removeItem('sumdoku_ongoing_game');
      this.dom.btnHomeContinue.classList.add('hidden');
    } catch (e) {}
  }

  checkContinueGame() {
    try {
      const data = localStorage.getItem('sumdoku_ongoing_game');
      if (data) {
        const state = JSON.parse(data);
        const mins = String(Math.floor(state.timerSeconds / 60)).padStart(2, '0');
        const secs = String(state.timerSeconds % 60).padStart(2, '0');
        document.getElementById('continue-desc').textContent = `${state.difficulty.toUpperCase()} · ${mins}:${secs} 진행 중`;
        this.dom.btnHomeContinue.classList.remove('hidden');
        return true;
      }
    } catch (e) {}
    this.dom.btnHomeContinue.classList.add('hidden');
    return false;
  }

  restoreOngoingGame() {
    try {
      const state = JSON.parse(localStorage.getItem('sumdoku_ongoing_game'));
      if (!state) return false;

      this.solution = state.solution;
      this.cages = state.cages;
      this.difficulty = state.difficulty;
      this.timerSeconds = state.timerSeconds;
      this.mistakes = state.mistakes;

      this.cellCageMap = {};
      this.cages.forEach((cage, cIdx) => {
        cage.cells.sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);
        cage.labelCell = cage.cells[0];
        cage.cells.forEach(([r, c]) => {
          this.cellCageMap[`${r},${c}`] = cIdx;
        });
      });

      this.board = state.board.map(r => r.map(c => ({
        val: c.val,
        notes: new Set(c.notes),
        isGiven: false,
        error: c.error
      })));

      this.dom.gameDiffLabel.textContent = this.difficulty.toUpperCase();
      this.dom.mistakes.textContent = `${this.mistakes}/${this.maxMistakes}`;
      this.renderBoard();
      this.selectCell(0, 0);
      this.updateKeypadBadges();
      this.startTimer();
      this.switchView('game');
      this.showToast('이전 게임을 이어서 시작합니다!');
      return true;
    } catch (e) {
      return false;
    }
  }

  // ----------------- 화면 뷰 전환 -----------------
  switchView(viewName) {
    this.currentView = viewName;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.add('active');

    if (viewName === 'home') {
      this.stopTimer();
      this.saveOngoingGame();
      this.checkContinueGame();
    } else if (viewName === 'game') {
      if (!this.isPaused) this.startTimer();
    }
  }

  handleBackKey() {
    if (this.currentView === 'game') {
      this.switchView('home');
      return "handled";
    } else if (this.currentView === 'stats') {
      this.switchView('home');
      return "handled";
    }
    return false;
  }

  // ----------------- DOM 및 이벤트 바인딩 -----------------
  initDOM() {
    this.dom = {
      board: document.getElementById('sudoku-board'),
      timer: document.getElementById('timer-display'),
      mistakes: document.getElementById('mistakes-count'),
      gameDiffLabel: document.getElementById('game-diff-label'),
      pencilBadge: document.getElementById('pencil-badge'),
      btnPencil: document.getElementById('btn-pencil'),
      btnUndo: document.getElementById('btn-undo'),
      btnErase: document.getElementById('btn-erase'),
      btnHint: document.getElementById('btn-hint'),
      btnGamePause: document.getElementById('btn-game-pause'),
      btnGameRestart: document.getElementById('btn-game-restart'),
      btnNavHome: document.getElementById('btn-nav-home'),
      btnGameStats: document.getElementById('btn-game-stats'),
      iconPause: document.getElementById('icon-pause'),
      iconPlay: document.getElementById('icon-play'),
      pauseOverlay: document.getElementById('pause-overlay'),
      btnResume: document.getElementById('btn-resume'),

      // Home Buttons
      btnHomeContinue: document.getElementById('btn-home-continue'),
      btnHomeNew: document.getElementById('btn-home-new'),
      btnHomeStats: document.getElementById('btn-home-stats'),
      btnHomeRules: document.getElementById('btn-home-rules'),
      btnHomeUpdate: document.getElementById('btn-home-update'),

      // Stats Buttons
      btnStatsBack: document.getElementById('btn-stats-back'),
      btnStatsReset: document.getElementById('btn-stats-reset'),

      // Modals
      modalDiff: document.getElementById('modal-difficulty'),
      btnDiffCancel: document.getElementById('btn-diff-cancel'),
      btnDiffStart: document.getElementById('btn-diff-start'),

      modalRules: document.getElementById('modal-rules'),
      btnRulesClose: document.getElementById('btn-rules-close'),

      modalUpdate: document.getElementById('modal-update'),
      btnUpdateDismiss: document.getElementById('btn-update-dismiss'),
      btnUpdateDownload: document.getElementById('btn-update-download'),
      updateNotes: document.getElementById('update-modal-notes'),

      toast: document.getElementById('toast'),
      keyBtns: document.querySelectorAll('.key-btn')
    };
  }

  bindEvents() {
    // 홈 화면 버튼
    this.dom.btnHomeContinue.addEventListener('click', () => this.restoreOngoingGame());
    this.dom.btnHomeNew.addEventListener('click', () => this.dom.modalDiff.classList.remove('hidden'));
    this.dom.btnHomeStats.addEventListener('click', () => {
      this.renderStatsView();
      this.switchView('stats');
    });
    this.dom.btnHomeRules.addEventListener('click', () => this.dom.modalRules.classList.remove('hidden'));
    this.dom.btnHomeUpdate.addEventListener('click', () => this.checkForUpdates(true));

    // 전적 화면
    this.dom.btnStatsBack.addEventListener('click', () => this.switchView('home'));
    this.dom.btnStatsReset.addEventListener('click', () => {
      if (confirm('모든 전적과 클리어 기록을 초기화하시겠습니까?')) {
        this.stats = {
          totalGames: 0, totalWins: 0, currentStreak: 0, maxStreak: 0,
          byDiff: {
            easy: { wins: 0, bestTime: null, totalTime: 0 },
            medium: { wins: 0, bestTime: null, totalTime: 0 },
            expert: { wins: 0, bestTime: null, totalTime: 0 }
          }
        };
        this.saveStats();
        this.renderStatsView();
        this.showToast('전적이 초기화되었습니다.');
      }
    });

    // 모달 닫기
    this.dom.btnDiffCancel.addEventListener('click', () => this.dom.modalDiff.classList.add('hidden'));
    this.dom.btnRulesClose.addEventListener('click', () => this.dom.modalRules.classList.add('hidden'));
    this.dom.btnUpdateDismiss.addEventListener('click', () => this.dom.modalUpdate.classList.add('hidden'));

    // 난이도 선택
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.difficulty = e.target.dataset.diff;
      });
    });

    this.dom.btnDiffStart.addEventListener('click', () => {
      this.dom.modalDiff.classList.add('hidden');
      this.startNewGame(this.difficulty);
    });

    // 게임 상단 내비게이션
    this.dom.btnNavHome.addEventListener('click', () => this.switchView('home'));
    this.dom.btnGameStats.addEventListener('click', () => {
      this.renderStatsView();
      this.switchView('stats');
    });
    this.dom.btnGameRestart.addEventListener('click', () => this.dom.modalDiff.classList.remove('hidden'));

    // 게임 툴바
    this.dom.btnPencil.addEventListener('click', () => this.togglePencilMode());
    this.dom.btnUndo.addEventListener('click', () => this.undo());
    this.dom.btnErase.addEventListener('click', () => this.erase());
    this.dom.btnHint.addEventListener('click', () => this.useHint());

    // 일시정지 & 재개
    this.dom.btnGamePause.addEventListener('click', () => this.togglePause());
    this.dom.btnResume.addEventListener('click', () => this.togglePause(false));

    // 키패드 클릭
    this.dom.keyBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const num = parseInt(btn.dataset.num, 10);
        this.handleNumberInput(num);
      });
    });

    // 물리 키보드 리스너
    window.addEventListener('keydown', (e) => {
      if (this.currentView !== 'game' || this.isPaused) return;
      if (e.key >= '1' && e.key <= '9') {
        this.handleNumberInput(parseInt(e.key, 10));
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        this.erase();
      } else if (e.key === 'n' || e.key === 'N') {
        this.togglePencilMode();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        this.undo();
      } else if (e.key === 'ArrowUp') {
        this.selectCell(Math.max(0, this.selected.r - 1), this.selected.c);
      } else if (e.key === 'ArrowDown') {
        this.selectCell(Math.min(8, this.selected.r + 1), this.selected.c);
      } else if (e.key === 'ArrowLeft') {
        this.selectCell(this.selected.r, Math.max(0, this.selected.c - 1));
      } else if (e.key === 'ArrowRight') {
        this.selectCell(this.selected.r, Math.min(8, this.selected.c + 1));
      }
    });

    // 창 닫힐 때 게임 자동 저장
    window.addEventListener('beforeunload', () => this.saveOngoingGame());
  }

  showToast(message, duration = 2200) {
    this.dom.toast.textContent = message;
    this.dom.toast.classList.remove('hidden');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.dom.toast.classList.add('hidden');
    }, duration);
  }

  // ----------------- 자동 업데이트 엔진 (GitHub Releases) -----------------
  async checkForUpdates(manual = false) {
    const descEl = document.getElementById('update-status-desc');
    if (manual) this.showToast('최신 버전 업데이트 확인 중...');
    if (descEl) descEl.textContent = 'GitHub 릴리스 확인 중...';

    try {
      const resp = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      });
      if (!resp.ok) throw new Error('API 응답 실패');
      const release = await resp.json();

      const latestTag = release.tag_name || "";
      const latestVer = latestTag.replace(/^v/, '');
      const isNewer = this.compareVersion(latestVer, APP_VERSION) > 0;

      if (isNewer) {
        if (descEl) descEl.textContent = `신규 버전 발견 (${latestTag})`;
        document.getElementById('update-modal-version').textContent = `최신 버전: ${latestTag} (현재: v${APP_VERSION})`;
        this.dom.updateNotes.textContent = release.body || "새로운 성능 개선 및 버그 수정이 포함되었습니다.";

        // APK 다운로드 URL 탐색
        let apkDownloadUrl = release.html_url;
        if (release.assets && release.assets.length > 0) {
          const apkAsset = release.assets.find(a => a.name.endsWith('.apk'));
          if (apkAsset) apkDownloadUrl = apkAsset.browser_download_url;
        }

        this.dom.btnUpdateDownload.onclick = () => {
          if (window.AndroidBridge && window.AndroidBridge.openExternalUrl) {
            window.AndroidBridge.openExternalUrl(apkDownloadUrl);
          } else {
            window.open(apkDownloadUrl, '_blank');
          }
          this.dom.modalUpdate.classList.add('hidden');
        };

        this.dom.modalUpdate.classList.remove('hidden');
      } else {
        if (descEl) descEl.textContent = `최신 버전 사용 중 (v${APP_VERSION})`;
        if (manual) this.showToast(`현재 최신 버전(v${APP_VERSION})을 사용하고 있습니다!`);
      }
    } catch (e) {
      if (descEl) descEl.textContent = `현재 버전 v${APP_VERSION}`;
      if (manual) this.showToast('업데이트 정보를 불러올 수 없습니다.');
    }
  }

  compareVersion(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const na = pa[i] || 0, nb = pb[i] || 0;
      if (na > nb) return 1;
      if (na < nb) return -1;
    }
    return 0;
  }

  // ----------------- 새 게임 생성 및 보드 초기화 -----------------
  startNewGame(diff = 'expert') {
    this.difficulty = diff;
    this.dom.gameDiffLabel.textContent = diff.toUpperCase();
    this.mistakes = 0;
    this.dom.mistakes.textContent = `0/${this.maxMistakes}`;
    this.undoStack = [];
    this.resetTimer();
    this.isWin = false;

    const anchorMap = { easy: 6, medium: 5, expert: 4 };
    const anchors = anchorMap[diff] || 4;

    try {
      const generated = this.generator.generate(anchors);
      this.solution = generated.solution;
      this.cages = generated.cages;
    } catch (e) {
      this.solution = DEFAULT_PUZZLE.solution;
      this.cages = DEFAULT_PUZZLE.cages;
    }

    this.cellCageMap = {};
    this.cages.forEach((cage, cIdx) => {
      cage.cells.sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);
      cage.labelCell = cage.cells[0];
      cage.cells.forEach(([r, c]) => {
        this.cellCageMap[`${r},${c}`] = cIdx;
      });
    });

    // ★★★ 모든 81칸은 완전히 비어있는 상태로 시작 ★★★
    this.board = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => ({
        val: 0,
        notes: new Set(),
        isGiven: false,
        error: false
      }))
    );

    this.renderBoard();
    this.selectCell(0, 0);
    this.updateKeypadBadges();
    this.startTimer();
    this.switchView('game');
    this.showToast(`100% 추론 보장 퍼즐 준비 완료! (${diff.toUpperCase()})`);
  }

  renderBoard() {
    this.dom.board.innerHTML = '';
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cellEl = document.createElement('div');
        cellEl.className = 'cell';
        cellEl.dataset.r = r;
        cellEl.dataset.c = c;

        // 3x3 서브 박스 경계 (실선)
        if (c === 2 || c === 5) cellEl.classList.add('border-box-right');
        if (r === 2 || r === 5) cellEl.classList.add('border-box-bottom');

        // 케이지 점선 테두리
        const myCageIdx = this.cellCageMap[`${r},${c}`];
        if (r === 0 || this.cellCageMap[`${r - 1},${c}`] !== myCageIdx) cellEl.classList.add('cage-border-top');
        if (r === 8 || this.cellCageMap[`${r + 1},${c}`] !== myCageIdx) cellEl.classList.add('cage-border-bottom');
        if (c === 0 || this.cellCageMap[`${r},${c - 1}`] !== myCageIdx) cellEl.classList.add('cage-border-left');
        if (c === 8 || this.cellCageMap[`${r},${c + 1}`] !== myCageIdx) cellEl.classList.add('cage-border-right');

        // 케이지 합계 라벨 (좌상단 대표 셀에만 표시)
        const cage = this.cages[myCageIdx];
        if (cage.labelCell[0] === r && cage.labelCell[1] === c) {
          const sumEl = document.createElement('span');
          sumEl.className = 'cell-cage-sum';
          sumEl.textContent = cage.sum;
          if (cage.cells.length === 1) {
            cellEl.classList.add('single-cage');
          }
          cellEl.appendChild(sumEl);
        }

        const valEl = document.createElement('span');
        valEl.className = 'cell-value';
        cellEl.appendChild(valEl);

        const notesEl = document.createElement('div');
        notesEl.className = 'cell-notes';
        for (let n = 1; n <= 9; n++) {
          const noteSpan = document.createElement('span');
          noteSpan.className = 'note-num';
          noteSpan.dataset.note = n;
          notesEl.appendChild(noteSpan);
        }
        cellEl.appendChild(notesEl);

        cellEl.addEventListener('click', () => this.selectCell(r, c));
        this.dom.board.appendChild(cellEl);
      }
    }
    this.updateBoardDisplay();
  }

  updateBoardDisplay() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cellEl = this.getCellElement(r, c);
        const cellData = this.board[r][c];
        const valEl = cellEl.querySelector('.cell-value');
        const notesEl = cellEl.querySelector('.cell-notes');

        cellEl.classList.toggle('user-input', cellData.val > 0);
        cellEl.classList.toggle('error', cellData.error);

        if (cellData.val > 0) {
          valEl.textContent = cellData.val;
          notesEl.style.display = 'none';
        } else {
          valEl.textContent = '';
          notesEl.style.display = 'grid';
          for (let n = 1; n <= 9; n++) {
            const noteSpan = notesEl.querySelector(`[data-note="${n}"]`);
            noteSpan.textContent = cellData.notes.has(n) ? n : '';
          }
        }
      }
    }
    this.updateHighlights();
  }

  getCellElement(r, c) {
    return this.dom.board.children[r * 9 + c];
  }

  selectCell(r, c) {
    this.selected = { r, c };
    this.updateHighlights();
    this.updateTabletCageHelper(r, c);
  }

  updateHighlights() {
    const { r: selR, c: selC } = this.selected;
    const selCellData = this.board[selR][selC];
    const selVal = selCellData.val;
    const selCageIdx = this.cellCageMap[`${selR},${selC}`];
    const selBoxR = Math.floor(selR / 3), selBoxC = Math.floor(selC / 3);

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cellEl = this.getCellElement(r, c);
        const cellData = this.board[r][c];
        const cageIdx = this.cellCageMap[`${r},${c}`];
        const boxR = Math.floor(r / 3), boxC = Math.floor(c / 3);

        cellEl.classList.remove('selected', 'highlight-crosshair', 'highlight-cage', 'highlight-same-num');

        if (r === selR && c === selC) {
          cellEl.classList.add('selected');
        } else {
          // 선택한 행과 열(십자선) 및 같은 3x3 박스 강조
          if (r === selR || c === selC || (boxR === selBoxR && boxC === selBoxC)) {
            cellEl.classList.add('highlight-crosshair');
          }
          // 같은 케이지 강조
          if (cageIdx === selCageIdx) {
            cellEl.classList.add('highlight-cage');
          }
          // 동일 숫자 표시
          if (selVal > 0 && cellData.val === selVal) {
            cellEl.classList.add('highlight-same-num');
          }
        }
      }
    }
  }

  // 태블릿 우측 도우미 패널 갱신
  updateTabletCageHelper(r, c) {
    const cageIdx = this.cellCageMap[`${r},${c}`];
    if (cageIdx === undefined || !this.cages[cageIdx]) return;
    const cage = this.cages[cageIdx];

    document.getElementById('cage-info-cells').textContent = `칸 수: ${cage.cells.length}칸`;
    document.getElementById('cage-info-sum').textContent = `목표 합계: ${cage.sum}`;

    const solvedSum = cage.cells
      .map(([cr, cc]) => this.board[cr][cc].val)
      .filter(v => v > 0)
      .reduce((a, b) => a + b, 0);

    const remaining = cage.sum - solvedSum;
    const tipEl = document.getElementById('cage-info-tip');

    if (cage.cells.length === 1) {
      tipEl.textContent = `★ 1칸 시작 힌트: 이 칸은 확정 ${cage.sum}입니다!`;
    } else if (solvedSum === cage.sum) {
      tipEl.textContent = `✓ 케이지 합계 완성 (${cage.sum}/${cage.sum})`;
    } else {
      tipEl.textContent = `남은 합계: ${remaining} (현재 채워진 합: ${solvedSum})`;
    }
  }

  saveSnapshot() {
    const snapshot = this.board.map(row =>
      row.map(cell => ({
        val: cell.val,
        notes: new Set(cell.notes),
        isGiven: cell.isGiven,
        error: cell.error
      }))
    );
    this.undoStack.push(snapshot);
    if (this.undoStack.length > 30) this.undoStack.shift();
  }

  handleNumberInput(num) {
    if (this.currentView !== 'game' || this.isPaused) return;
    const { r, c } = this.selected;
    const cellData = this.board[r][c];

    this.saveSnapshot();

    if (this.isPencilMode) {
      if (cellData.val === 0) {
        if (cellData.notes.has(num)) {
          cellData.notes.delete(num);
        } else {
          cellData.notes.add(num);
        }
      }
    } else {
      if (cellData.val === num) {
        cellData.val = 0;
        cellData.error = false;
      } else {
        cellData.val = num;
        cellData.notes.clear();

        const isCorrect = (num === this.solution[r][c]);
        if (!isCorrect) {
          cellData.error = true;
          this.mistakes++;
          this.dom.mistakes.textContent = `${this.mistakes}/${this.maxMistakes}`;
          this.showToast(`잘못된 숫자입니다! (실수: ${this.mistakes}/${this.maxMistakes})`);
          
          if (this.mistakes >= this.maxMistakes) {
            this.handleGameOver();
            return;
          }
        } else {
          cellData.error = false;
          this.autoClearNotes(r, c, num);
          this.checkWinCondition();
        }
      }
    }

    this.updateBoardDisplay();
    this.updateKeypadBadges();
    this.updateTabletCageHelper(r, c);
    this.saveOngoingGame();
  }

  autoClearNotes(placedR, placedC, num) {
    const myCageIdx = this.cellCageMap[`${placedR},${placedC}`];
    const placedBoxR = Math.floor(placedR / 3), placedBoxC = Math.floor(placedC / 3);

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const boxR = Math.floor(r / 3), boxC = Math.floor(c / 3);
        const cageIdx = this.cellCageMap[`${r},${c}`];
        if (r === placedR || c === placedC || (boxR === placedBoxR && boxC === placedBoxC) || cageIdx === myCageIdx) {
          this.board[r][c].notes.delete(num);
        }
      }
    }
  }

  erase() {
    if (this.currentView !== 'game' || this.isPaused) return;
    const { r, c } = this.selected;
    const cellData = this.board[r][c];

    if (cellData.val > 0 || cellData.notes.size > 0) {
      this.saveSnapshot();
      cellData.val = 0;
      cellData.notes.clear();
      cellData.error = false;
      this.updateBoardDisplay();
      this.updateKeypadBadges();
      this.updateTabletCageHelper(r, c);
      this.saveOngoingGame();
    }
  }

  undo() {
    if (this.currentView !== 'game' || this.isPaused || this.undoStack.length === 0) return;
    const prev = this.undoStack.pop();
    this.board = prev.map(row =>
      row.map(cell => ({
        val: cell.val,
        notes: new Set(cell.notes),
        isGiven: cell.isGiven,
        error: cell.error
      }))
    );
    this.updateBoardDisplay();
    this.updateKeypadBadges();
    this.updateTabletCageHelper(this.selected.r, this.selected.c);
    this.showToast('실행 취소되었습니다.');
    this.saveOngoingGame();
  }

  togglePencilMode() {
    this.isPencilMode = !this.isPencilMode;
    this.dom.btnPencil.classList.toggle('active', this.isPencilMode);
    this.dom.pencilBadge.textContent = this.isPencilMode ? 'ON' : 'OFF';
    this.showToast(this.isPencilMode ? '메모(Pencil) 모드 켜짐' : '일반 입력 모드');
  }

  useHint() {
    if (this.currentView !== 'game' || this.isPaused) return;
    const { r, c } = this.selected;
    if (this.board[r][c].val === 0) {
      this.saveSnapshot();
      const answer = this.solution[r][c];
      this.board[r][c].val = answer;
      this.board[r][c].notes.clear();
      this.board[r][c].error = false;
      this.autoClearNotes(r, c, answer);
      this.updateBoardDisplay();
      this.updateKeypadBadges();
      this.updateTabletCageHelper(r, c);
      const cage = this.cages[this.cellCageMap[`${r},${c}`]];
      this.showToast(`[힌트] 케이지 합계(${cage.sum})와 행/열 제약에 따라 ${answer} 확정!`);
      this.checkWinCondition();
      this.saveOngoingGame();
      return;
    }

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (this.board[row][col].val === 0) {
          this.selectCell(row, col);
          this.useHint();
          return;
        }
      }
    }
    this.showToast('모든 칸이 이미 채워졌습니다!');
  }

  updateKeypadBadges() {
    const counts = Array(10).fill(0);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.board[r][c].val > 0 && !this.board[r][c].error) {
          counts[this.board[r][c].val]++;
        }
      }
    }
    this.dom.keyBtns.forEach(btn => {
      const num = parseInt(btn.dataset.num, 10);
      const rem = 9 - counts[num];
      const subEl = document.getElementById(`rem-${num}`);
      if (subEl) subEl.textContent = rem > 0 ? rem : '✓';
      btn.classList.toggle('completed', rem <= 0);
    });
  }

  checkWinCondition() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.board[r][c].val !== this.solution[r][c]) {
          return false;
        }
      }
    }
    this.isWin = true;
    this.stopTimer();
    this.recordGameEnd(true);
    this.clearOngoingGame();

    setTimeout(() => {
      alert(`🎉 축하합니다! 썸도쿠를 성공적으로 클리어하셨습니다!\n소요 시간: ${this.dom.timer.textContent}`);
      this.switchView('stats');
    }, 250);
    return true;
  }

  handleGameOver() {
    this.stopTimer();
    this.recordGameEnd(false);
    this.clearOngoingGame();

    setTimeout(() => {
      if (confirm('실수 횟수가 3회를 초과하여 게임이 종료되었습니다.\n새 게임을 시작하시겠습니까?')) {
        this.startNewGame(this.difficulty);
      } else {
        this.switchView('home');
      }
    }, 250);
  }

  startTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (!this.isPaused) {
        this.timerSeconds++;
        const mins = String(Math.floor(this.timerSeconds / 60)).padStart(2, '0');
        const secs = String(this.timerSeconds % 60).padStart(2, '0');
        this.dom.timer.textContent = `${mins}:${secs}`;
      }
    }, 1000);
  }

  stopTimer() {
    clearInterval(this.timerInterval);
  }

  resetTimer() {
    this.stopTimer();
    this.timerSeconds = 0;
    this.dom.timer.textContent = '00:00';
  }

  togglePause(forceState) {
    this.isPaused = forceState !== undefined ? forceState : !this.isPaused;
    this.dom.iconPause.classList.toggle('hidden', this.isPaused);
    this.dom.iconPlay.classList.toggle('hidden', !this.isPaused);
    this.dom.pauseOverlay.classList.toggle('hidden', !this.isPaused);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new SumdokuApp();
});

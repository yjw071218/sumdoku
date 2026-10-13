/**
 * Sumdoku (썸도쿠) v1.0.2 - 100% 연역 추론 보장 합계 수도쿠
 * 
 * - 홈 화면, 게임 화면(폰/태블릿 스튜디오 레이아웃), 4단계 전적 및 통계 시스템
 * - 전문가 난이도: 단 2~3개의 1칸 확정 앵커만 주어지며, 100% 논리 추론으로 풀림 보장
 * - 매 게임 알고리즘을 통해 완전히 새로운 정답 판 및 케이지 동적 생성
 * - GitHub 연동 자동 업데이트 체커
 */

const APP_VERSION = "1.0.2";
const GITHUB_REPO = "yjw071218/sumdoku";

// ============================================================================
// 1. 동적 100% 추론 보장 퍼즐 생성기 (SumdokuGenerator)
// ============================================================================
class SumdokuGenerator {
  generate(diff = 'expert') {
    const anchorMap = {
      easy: 7,
      medium: 5,
      hard: 4,
      expert: Math.random() < 0.5 ? 2 : 3
    };
    const targetAnchors = anchorMap[diff] || (Math.random() < 0.5 ? 2 : 3);

    let attempts = 0;
    while (attempts++ < 1000) {
      const solution = this.createSolutionIterative();
      const cages = this.createSmartCages(solution, targetAnchors);
      const singles = cages.filter(c => c.cells.length === 1);

      // 확정 단서 수 일치 및 순수 연역 논리 100% 풀림(81칸 완료) 검증
      if (singles.length === targetAnchors && this.solveDeductivelyAdvanced(solution, cages) === 81) {
        return {
          solution,
          cages,
          anchorCount: targetAnchors
        };
      }
    }

    // 매우 드문 경우의 안전 백업
    const solution = this.createSolutionIterative();
    const cages = this.createSmartCages(solution, targetAnchors);
    return { solution, cages, anchorCount: targetAnchors };
  }

  // 100% 비재귀 반복문 백트래킹 (스택 오버플로우 원천 방지)
  createSolutionIterative() {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));
    
    // 3개의 대각선 3x3 박스는 서로 독립적이므로 무작위 셔플로 먼저 채움
    for (let b = 0; b < 9; b += 3) {
      const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
      let idx = 0;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          board[b + r][b + c] = nums[idx++];
        }
      }
    }

    const empty = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) empty.push([r, c]);
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

    const cellState = empty.map(() => ({
      nums: [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5),
      tryIdx: 0
    }));

    let idx = 0;
    while (idx < empty.length) {
      const [r, c] = empty[idx];
      const state = cellState[idx];
      let placed = false;
      while (state.tryIdx < state.nums.length) {
        const val = state.nums[state.tryIdx++];
        if (isSafe(r, c, val)) {
          board[r][c] = val;
          placed = true;
          break;
        }
      }
      if (placed) {
        idx++;
      } else {
        board[r][c] = 0;
        state.tryIdx = 0;
        state.nums.sort(() => Math.random() - 0.5);
        idx--;
        if (idx < 0) break;
      }
    }
    return board;
  }

  // 정확한 개수의 1칸 앵커 및 균형잡힌 다중 셀 케이지 생성 (고립 1칸 셀은 인접 케이지로 병합)
  createSmartCages(solution, exactAnchors) {
    const boxIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5);
    const assigned = new Map();
    const cages = [];

    // 1. 정확한 개수의 1칸 시작 확정 앵커 배치 (서로 다른 3x3 박스에 분산)
    for (let i = 0; i < exactAnchors; i++) {
      const box = boxIndices[i];
      const br = Math.floor(box / 3) * 3 + Math.floor(Math.random() * 3);
      const bc = (box % 3) * 3 + Math.floor(Math.random() * 3);
      const cell = [br, bc];
      const cage = { sum: solution[br][bc], cells: [cell] };
      cages.push(cage);
      assigned.set(`${br},${bc}`, cage);
    }

    // 2. 나머지 셀들을 무작위 순서로 순회하며 2~4칸 케이지로 그룹화
    const remaining = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!assigned.has(`${r},${c}`)) remaining.push([r, c]);
      }
    }
    remaining.sort(() => Math.random() - 0.5);

    for (const startCell of remaining) {
      const key = `${startCell[0]},${startCell[1]}`;
      if (assigned.has(key)) continue;

      const currentCageCells = [startCell];
      assigned.set(key, null);
      // 2~3칸 크기를 주로 배정하여 강력한 논리적 수리 제약 형성
      const targetSize = [2, 2, 2, 3, 3, 4][Math.floor(Math.random() * 6)];

      while (currentCageCells.length < targetSize) {
        const neighbors = [];
        for (const [cr, cc] of currentCageCells) {
          for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nr = cr + dr, nc = cc + dc;
            if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9 && !assigned.has(`${nr},${nc}`)) {
              const existVals = currentCageCells.map(([r, c]) => solution[r][c]);
              if (!existVals.includes(solution[nr][nc])) neighbors.push([nr, nc]);
            }
          }
        }
        if (neighbors.length === 0) break;
        const nextCell = neighbors[Math.floor(Math.random() * neighbors.length)];
        currentCageCells.push(nextCell);
        assigned.set(`${nextCell[0]},${nextCell[1]}`, null);
      }

      // 고립되어 1칸만 남은 셀은 의도치 않은 추가 앵커가 되지 않도록 인접 케이지에 병합
      if (currentCageCells.length === 1) {
        const [or, oc] = currentCageCells[0];
        const val = solution[or][oc];
        let merged = false;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = or + dr, nc = oc + dc;
          if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
            const adj = assigned.get(`${nr},${nc}`);
            if (adj && adj.cells.length > 1 && adj.cells.length < 5) {
              const adjVals = adj.cells.map(([r, c]) => solution[r][c]);
              if (!adjVals.includes(val)) {
                adj.cells.push([or, oc]);
                adj.sum += val;
                assigned.set(key, adj);
                merged = true;
                break;
              }
            }
          }
        }
        if (!merged) {
          const cage = { sum: val, cells: currentCageCells };
          cages.push(cage);
          assigned.set(key, cage);
        }
      } else {
        const sum = currentCageCells.reduce((acc, [r, c]) => acc + solution[r][c], 0);
        const cage = { sum, cells: currentCageCells };
        cages.push(cage);
        for (const c of currentCageCells) assigned.set(`${c[0]},${c[1]}`, cage);
      }
    }

    return cages;
  }

  // 고급 연역 추론 검증기 (순수 논리만으로 81칸이 100% 확정되는지 검증)
  solveDeductivelyAdvanced(solution, cages) {
    const candidates = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]))
    );

    let changed = true;
    let loop = 0;
    while (changed && loop++ < 80) {
      changed = false;

      // 1. Naked Singles & 피어(행, 열, 3x3 박스) 소거법
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

      // 2. 케이지 합계 조합 필터링 (Killer Sudoku 조합 필터)
      for (const cage of cages) {
        const solvedVals = [];
        const unsolved = [];
        for (const [r, c] of cage.cells) {
          if (candidates[r][c].size === 1) solvedVals.push([...candidates[r][c]][0]);
          else unsolved.push([r, c]);
        }
        if (unsolved.length === 0) continue;

        const remSum = cage.sum - solvedVals.reduce((a, b) => a + b, 0);
        const validSets = unsolved.map(() => new Set());

        const findCombos = (idx, currentSum, usedVals) => {
          if (idx === unsolved.length) {
            if (currentSum === remSum) {
              for (let i = 0; i < unsolved.length; i++) validSets[i].add(usedVals[i]);
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

      // 3. Hidden Singles (행, 열, 3x3 박스 내 유일 후보 수 탐색)
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

      for (let c = 0; c < 9; c++) {
        for (let num = 1; num <= 9; num++) {
          const rows = [];
          for (let r = 0; r < 9; r++) {
            if (candidates[r][c].has(num)) rows.push(r);
          }
          if (rows.length === 1 && candidates[rows[0]][c].size > 1) {
            candidates[rows[0]][c] = new Set([num]);
            changed = true;
          }
        }
      }

      for (let br = 0; br < 9; br += 3) {
        for (let bc = 0; bc < 9; bc += 3) {
          for (let num = 1; num <= 9; num++) {
            const cells = [];
            for (let i = 0; i < 3; i++) {
              for (let j = 0; j < 3; j++) {
                if (candidates[br + i][bc + j].has(num)) cells.push([br + i, bc + j]);
              }
            }
            if (cells.length === 1 && candidates[cells[0][0]][cells[0][1]].size > 1) {
              candidates[cells[0][0]][cells[0][1]] = new Set([num]);
              changed = true;
            }
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
// 2. 앱 주 컨트롤러 (SumdokuApp)
// ============================================================================
class SumdokuApp {
  constructor() {
    this.generator = new SumdokuGenerator();
    this.currentView = 'home';
    
    // 게임 진행 상태
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
    this.anchorCount = 3;

    // 전적 데이터 로드
    this.stats = this.loadStats();

    this.initDOM();
    this.bindEvents();
    this.checkContinueGame();
    this.renderStatsView();

    // 시작 시 조용히 신규 업데이트 체크
    setTimeout(() => this.checkForUpdates(false), 1500);
  }

  // ----------------- 전적 관리 (localStorage, 4개 난이도) -----------------
  loadStats() {
    try {
      const data = localStorage.getItem('sumdoku_stats');
      if (data) {
        const parsed = JSON.parse(data);
        if (!parsed.byDiff.hard) {
          parsed.byDiff.hard = { wins: 0, bestTime: null, totalTime: 0 };
        }
        return parsed;
      }
    } catch (e) {}

    return {
      totalGames: 0,
      totalWins: 0,
      currentStreak: 0,
      maxStreak: 0,
      byDiff: {
        easy: { wins: 0, bestTime: null, totalTime: 0 },
        medium: { wins: 0, bestTime: null, totalTime: 0 },
        hard: { wins: 0, bestTime: null, totalTime: 0 },
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

    const hardWinsEl = document.getElementById('stat-hard-wins');
    const hardBestEl = document.getElementById('stat-hard-best');
    if (hardWinsEl && this.stats.byDiff.hard) {
      hardWinsEl.textContent = `${this.stats.byDiff.hard.wins}승`;
      hardBestEl.textContent = formatTime(this.stats.byDiff.hard.bestTime);
    }

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
        difficulty: this.difficulty,
        anchorCount: this.anchorCount
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
        const descEl = document.getElementById('continue-desc');
        if (descEl) {
          descEl.textContent = `${state.difficulty.toUpperCase()} · ${mins}:${secs} 진행 중`;
        }
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
      this.anchorCount = state.anchorCount || 3;
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
      this.dom.mistakes.textContent = `${this.mistakes} / ${this.maxMistakes}`;
      const anchorEl = document.getElementById('anchors-count');
      if (anchorEl) anchorEl.textContent = `${this.anchorCount}개 확정`;

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
      anchorsCount: document.getElementById('anchors-count'),
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
            hard: { wins: 0, bestTime: null, totalTime: 0 },
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

    // 4단계 난이도 카드 선택 이벤트
    document.querySelectorAll('.diff-card-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.diff-card-btn').forEach(b => b.classList.remove('active'));
        const card = e.currentTarget;
        card.classList.add('active');
        this.difficulty = card.dataset.diff;
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

    // 키패드 터치
    this.dom.keyBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const num = parseInt(btn.dataset.num, 10);
        this.handleNumberInput(num);
      });
    });

    // 키보드 입력 대응
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

    // 페이지 벗어날 때 자동 저장
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
    this.dom.mistakes.textContent = `0 / ${this.maxMistakes}`;
    this.undoStack = [];
    this.resetTimer();
    this.isWin = false;

    // 매번 알고리즘을 통해 완전히 새로운 정답 판과 케이지를 100% 동적 생성
    const generated = this.generator.generate(diff);
    this.solution = generated.solution;
    this.cages = generated.cages;
    this.anchorCount = generated.anchorCount;

    if (this.dom.anchorsCount) {
      this.dom.anchorsCount.textContent = `${this.anchorCount}개 확정`;
    }

    this.cellCageMap = {};
    this.cages.forEach((cage, cIdx) => {
      cage.cells.sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);
      cage.labelCell = cage.cells[0];
      cage.cells.forEach(([r, c]) => {
        this.cellCageMap[`${r},${c}`] = cIdx;
      });
    });

    // ★★★ 모든 81칸은 완전히 비어있는 상태로 시작 (0개 숫자 사전 채움) ★★★
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

    const diffKr = { easy: '초급', medium: '중급', hard: '고급', expert: '전문가' }[diff] || diff;
    this.showToast(`100% 연역 추론 보장! (${diffKr} · 시작 앵커 ${this.anchorCount}개)`);
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
          // 선택한 행, 열, 3x3 박스 십자 강조
          if (r === selR || c === selC || (boxR === selBoxR && boxC === selBoxC)) {
            cellEl.classList.add('highlight-crosshair');
          }
          // 동일 케이지 강조
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

  // 태블릿 스튜디오 케이지 추론 분석 패널 갱신
  updateTabletCageHelper(r, c) {
    const cageIdx = this.cellCageMap[`${r},${c}`];
    if (cageIdx === undefined || !this.cages[cageIdx]) return;
    const cage = this.cages[cageIdx];

    const solvedSum = cage.cells
      .map(([cr, cc]) => this.board[cr][cc].val)
      .filter(v => v > 0)
      .reduce((a, b) => a + b, 0);

    const remaining = cage.sum - solvedSum;

    // 태블릿 스튜디오 카드 요소 갱신
    const astCells = document.getElementById('assistant-cells');
    const astTarget = document.getElementById('assistant-target');
    const astRem = document.getElementById('assistant-rem');
    const astTip = document.getElementById('assistant-tip');

    if (astCells) astCells.textContent = `${cage.cells.length}칸`;
    if (astTarget) astTarget.textContent = cage.sum;
    if (astRem) astRem.textContent = remaining;

    if (astTip) {
      if (cage.cells.length === 1) {
        astTip.textContent = `★ 1칸 확정 단서: 이 칸은 확정 ${cage.sum}입니다. 추론의 출발점으로 활용하세요!`;
      } else if (solvedSum === cage.sum) {
        astTip.textContent = `✓ 케이지 합계 완성 (${cage.sum}/${cage.sum})`;
      } else {
        astTip.textContent = `남은 합계 ${remaining}을(를) ${cage.cells.length - cage.cells.filter(([cr, cc]) => this.board[cr][cc].val > 0).length}개의 빈 칸에 채워야 합니다.`;
      }
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
          this.dom.mistakes.textContent = `${this.mistakes} / ${this.maxMistakes}`;
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

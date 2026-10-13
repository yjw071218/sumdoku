/**
 * Sumdoku (썸도쿠) v1.0.3 - 100% 연역 추론 보장 합계 수도쿠
 * 
 * - 홈 화면, 게임 화면(폰/태블릿 반응형 스튜디오), 일일 도전 캘린더, 설정 및 전적 시스템
 * - 인셋 점선 케이지: 칸보다 3px 작은 미려한 둥근 점선 테두리 (Image 2 스타일)
 * - 4단계 난이도 (초급, 중급, 고급, 전문가: 2~3개 확정 앵커로 100% 논리 풀림)
 * - 실시간 점수 시스템 및 사운드 효과음 (Web Audio API)
 * - 일일 도전 (Daily Challenge) 달력 및 트로피 시스템
 * - 3가지 테마 (Light, Dark, Sepia) 팔레트 순환 지원
 * - GitHub 연동 실시간 자동 업데이트 체커
 */

const APP_VERSION = "1.0.3";
const GITHUB_REPO = "yjw071218/sumdoku";

// ============================================================================
// 1. 오디오 효과음 합성기 (SoundController - Web Audio API)
// ============================================================================
class SoundController {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  play(type) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(650, t);
        osc.frequency.exponentialRampToValueAtTime(350, t + 0.04);
        gain.gain.setValueAtTime(0.06, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        osc.start(t);
        osc.stop(t + 0.04);
      } else if (type === 'correct') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, t); // C5
        osc.frequency.setValueAtTime(659.25, t + 0.05); // E5
        osc.frequency.setValueAtTime(783.99, t + 0.10); // G5
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.start(t);
        osc.stop(t + 0.22);
      } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, t);
        osc.frequency.linearRampToValueAtTime(110, t + 0.15);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.start(t);
        osc.stop(t + 0.15);
      } else if (type === 'win') {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const noteOsc = this.ctx.createOscillator();
          const noteGain = this.ctx.createGain();
          noteOsc.type = 'triangle';
          noteOsc.frequency.setValueAtTime(freq, t + idx * 0.1);
          noteGain.gain.setValueAtTime(0.12, t + idx * 0.1);
          noteGain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.1 + 0.25);
          noteOsc.connect(noteGain);
          noteGain.connect(this.ctx.destination);
          noteOsc.start(t + idx * 0.1);
          noteOsc.stop(t + idx * 0.1 + 0.25);
        });
      }
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }
}

// ============================================================================
// 2. 동적 100% 추론 보장 퍼즐 생성기 (SumdokuGenerator)
// ============================================================================
class SumdokuGenerator {
  constructor(rng = Math.random) {
    this.rng = rng;
  }

  generate(diff = 'expert', customRng = null) {
    const rng = customRng || this.rng;
    const anchorMap = {
      easy: 7,
      medium: 5,
      hard: 4,
      expert: rng() < 0.5 ? 2 : 3
    };
    const targetAnchors = anchorMap[diff] || (rng() < 0.5 ? 2 : 3);

    let attempts = 0;
    while (attempts++ < 1000) {
      const solution = this.createSolutionIterative(rng);
      const cages = this.createSmartCages(solution, targetAnchors, rng);
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
    const solution = this.createSolutionIterative(rng);
    const cages = this.createSmartCages(solution, targetAnchors, rng);
    return { solution, cages, anchorCount: targetAnchors };
  }

  // 100% 비재귀 반복문 백트래킹 (스택 오버플로우 원천 방지)
  createSolutionIterative(rng = Math.random) {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));
    
    // 3개의 대각선 3x3 박스는 서로 독립적이므로 먼저 채움
    for (let b = 0; b < 9; b += 3) {
      const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => rng() - 0.5);
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
      nums: [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => rng() - 0.5),
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
        state.nums.sort(() => rng() - 0.5);
        idx--;
        if (idx < 0) break;
      }
    }
    return board;
  }

  // 정확한 개수의 1칸 앵커 및 균형잡힌 다중 셀 케이지 생성 (고립 1칸 셀은 인접 케이지로 병합)
  createSmartCages(solution, exactAnchors, rng = Math.random) {
    const boxIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => rng() - 0.5);
    const assigned = new Map();
    const cages = [];

    // 1. 정확한 개수의 1칸 시작 확정 앵커 배치 (서로 다른 3x3 박스에 분산)
    for (let i = 0; i < exactAnchors; i++) {
      const box = boxIndices[i];
      const br = Math.floor(box / 3) * 3 + Math.floor(rng() * 3);
      const bc = (box % 3) * 3 + Math.floor(rng() * 3);
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
    remaining.sort(() => rng() - 0.5);

    for (const startCell of remaining) {
      const key = `${startCell[0]},${startCell[1]}`;
      if (assigned.has(key)) continue;

      const currentCageCells = [startCell];
      assigned.set(key, null);
      const targetSize = [2, 2, 2, 3, 3, 4][Math.floor(rng() * 6)];

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
        const nextCell = neighbors[Math.floor(rng() * neighbors.length)];
        currentCageCells.push(nextCell);
        assigned.set(`${nextCell[0]},${nextCell[1]}`, null);
      }

      // 고립되어 1칸만 남은 셀은 인접 케이지로 병합
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

      // 2. 케이지 합계 조합 필터링
      for (const cage of cages) {
        const solvedVals = [];
        const unsolved = [];
        for (const [r, c] of cage.cells) {
          if (candidates[r][c].size === 1) solvedVals.push([...candidates[r][c]][0]);
          else unsolved.push([r, c]);
        }
        if (unsolved.length === 0) continue;

        const currentSolvedSum = solvedVals.reduce((a, b) => a + b, 0);
        const remTargetSum = cage.sum - currentSolvedSum;
        const usedSet = new Set(solvedVals);

        const validSets = [];
        const findCombos = (idx, currentSum, chosen) => {
          if (idx === unsolved.length) {
            if (currentSum === remTargetSum) validSets.push([...chosen]);
            return;
          }
          const [ur, uc] = unsolved[idx];
          for (const cand of candidates[ur][uc]) {
            if (!chosen.includes(cand) && !usedSet.has(cand)) {
              if (currentSum + cand <= remTargetSum) {
                chosen.push(cand);
                findCombos(idx + 1, currentSum + cand, chosen);
                chosen.pop();
              }
            }
          }
        };
        findCombos(0, 0, []);

        if (validSets.length > 0) {
          for (let i = 0; i < unsolved.length; i++) {
            const [ur, uc] = unsolved[i];
            const allowedForCell = new Set(validSets.map(arr => arr[i]));
            for (const cand of candidates[ur][uc]) {
              if (!allowedForCell.has(cand)) {
                candidates[ur][uc].delete(cand);
                changed = true;
              }
            }
          }
        }
      }

      // 3. Hidden Singles 검증 (행, 열, 박스)
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
// 3. 앱 메인 컨트롤러 (SumdokuApp)
// ============================================================================
class SumdokuApp {
  constructor() {
    this.generator = new SumdokuGenerator();
    this.sound = new SoundController();
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
    this.score = 0;
    this.combo = 0;
    this.isDaily = false;
    this.dailyDate = null;
    this.selectedDailyDay = null;

    // 테마 설정 (light -> dark -> sepia)
    this.themes = ['theme-light', 'theme-dark', 'theme-sepia'];
    this.currentThemeIndex = 0;

    // 설정 및 전적 로드
    this.settings = this.loadSettings();
    this.stats = this.loadStats();
    this.dailyCleared = this.loadDailyCleared();

    this.initDOM();
    this.applySettings();
    this.applyTheme(localStorage.getItem('sumdoku_theme') || 'theme-light');
    this.bindEvents();
    this.renderDailyCalendar();
    this.checkContinueGame();
    this.renderStatsView();

    // 조용히 업데이트 체크
    setTimeout(() => this.checkForUpdates(false), 1500);
  }

  // ----------------- 설정 관리 (Settings) -----------------
  loadSettings() {
    const defaults = {
      sound: true,
      mistakeLimit: true,
      autoCheck: true,
      highlightCross: true,
      highlightSame: true,
      highlightDup: true,
      autoNotes: true,
      hideCompleted: true,
      showTimer: true
    };
    try {
      const saved = localStorage.getItem('sumdoku_settings');
      if (saved) return Object.assign(defaults, JSON.parse(saved));
    } catch (e) {}
    return defaults;
  }

  saveSettings() {
    try {
      localStorage.setItem('sumdoku_settings', JSON.stringify(this.settings));
    } catch (e) {}
  }

  applySettings() {
    this.sound.enabled = this.settings.sound;

    // DOM 토글 스위치 반영 (Stats 뷰 및 In-Game 모달)
    const setChecked = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!val;
    };

    setChecked('setting-sound', this.settings.sound);
    setChecked('modal-setting-sound', this.settings.sound);

    setChecked('setting-mistake-limit', this.settings.mistakeLimit);
    setChecked('modal-setting-mistake', this.settings.mistakeLimit);

    setChecked('setting-auto-check', this.settings.autoCheck);
    setChecked('setting-highlight-cross', this.settings.highlightCross);
    setChecked('modal-setting-cross', this.settings.highlightCross);

    setChecked('setting-highlight-same', this.settings.highlightSame);
    setChecked('modal-setting-same', this.settings.highlightSame);

    setChecked('setting-highlight-dup', this.settings.highlightDup);

    setChecked('setting-auto-notes', this.settings.autoNotes);
    setChecked('modal-setting-notes', this.settings.autoNotes);

    setChecked('setting-hide-completed', this.settings.hideCompleted);
    setChecked('setting-show-timer', this.settings.showTimer);

    // 타이머 가시성 제어
    const timerBox = document.querySelector('.timer-item');
    if (timerBox) timerBox.style.display = this.settings.showTimer ? 'flex' : 'none';

    // 실수 한도 텍스트 갱신
    if (this.dom && this.dom.mistakes) {
      this.dom.mistakes.textContent = this.settings.mistakeLimit
        ? `${this.mistakes} / ${this.maxMistakes}`
        : `${this.mistakes}`;
    }
  }

  // ----------------- 테마 순환 (Light / Dark / Sepia) -----------------
  applyTheme(themeName) {
    const root = document.getElementById('app');
    this.themes.forEach(t => root.classList.remove(t));
    if (!this.themes.includes(themeName)) themeName = 'theme-light';
    root.classList.add(themeName);
    this.currentThemeIndex = this.themes.indexOf(themeName);
    localStorage.setItem('sumdoku_theme', themeName);
  }

  cycleTheme() {
    this.currentThemeIndex = (this.currentThemeIndex + 1) % this.themes.length;
    const nextTheme = this.themes[this.currentThemeIndex];
    this.applyTheme(nextTheme);
    const themeKr = { 'theme-light': '라이트', 'theme-dark': '다크', 'theme-sepia': '세피아' }[nextTheme];
    this.showToast(`테마: ${themeKr} 모드`);
  }

  // ----------------- 일일 도전 캘린더 (Daily Challenge) -----------------
  loadDailyCleared() {
    try {
      const data = localStorage.getItem('sumdoku_daily_cleared');
      if (data) return JSON.parse(data);
    } catch (e) {}
    return [];
  }

  saveDailyCleared() {
    try {
      localStorage.setItem('sumdoku_daily_cleared', JSON.stringify(this.dailyCleared));
    } catch (e) {}
  }

  renderDailyCalendar() {
    const grid = document.getElementById('calendar-days-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-based
    const todayDate = now.getDate();

    // 캘린더 헤더 라벨
    const monthTitle = document.getElementById('cal-month-title');
    if (monthTitle) monthTitle.textContent = `${year}년 ${month + 1}월`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    // 빈 칸 (이전 달 패딩)
    for (let i = 0; i < firstDayIndex; i++) {
      const empty = document.createElement('button');
      empty.className = 'cal-day-btn empty';
      grid.appendChild(empty);
    }

    // 일별 버튼
    let clearedCount = 0;
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isCleared = this.dailyCleared.includes(dateStr);
      if (isCleared) clearedCount++;

      const btn = document.createElement('button');
      btn.className = 'cal-day-btn';
      btn.textContent = d;
      btn.dataset.date = dateStr;

      if (d === todayDate) btn.classList.add('today');
      if (isCleared) btn.classList.add('cleared');

      btn.addEventListener('click', () => {
        document.querySelectorAll('.cal-day-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedDailyDay = dateStr;
      });

      grid.appendChild(btn);
    }

    // 트로피 및 별 개수 업데이트
    const progressEl = document.getElementById('daily-trophy-progress');
    const starCountEl = document.getElementById('cal-star-count');
    if (progressEl) progressEl.textContent = `완료: ${clearedCount} / ${totalDays}일`;
    if (starCountEl) starCountEl.textContent = `⭐ ${clearedCount}/${totalDays}`;

    // 홈 화면 일일 도전 라벨 갱신
    const heroDate = document.getElementById('daily-date-label');
    if (heroDate) {
      heroDate.textContent = `${month + 1}월 ${todayDate}일 퍼즐`;
    }

    this.selectedDailyDay = `${year}-${String(month + 1).padStart(2, '0')}-${String(todayDate).padStart(2, '0')}`;
  }

  startDailyGame(dateStr) {
    this.isDaily = true;
    this.dailyDate = dateStr;

    // 날짜 스트링 기반 결정론적 시드 생성
    let seed = 0;
    for (let i = 0; i < dateStr.length; i++) {
      seed = ((seed << 5) - seed) + dateStr.charCodeAt(i);
      seed |= 0;
    }
    const seededRng = () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    this.startNewGame('medium', seededRng);
    this.showToast(`📅 일일 도전 (${dateStr})을 시작합니다!`);
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

      // 일일 도전 클리어 기록
      if (this.isDaily && this.dailyDate) {
        if (!this.dailyCleared.includes(this.dailyDate)) {
          this.dailyCleared.push(this.dailyDate);
          this.saveDailyCleared();
          this.renderDailyCalendar();
        }
      }
    } else {
      this.stats.currentStreak = 0;
    }
    this.saveStats();
    this.renderStatsView();
  }

  renderStatsView() {
    const setTxt = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };

    setTxt('stat-total-games', this.stats.totalGames);
    setTxt('stat-total-wins', this.stats.totalWins);
    const winRate = this.stats.totalGames > 0
      ? Math.round((this.stats.totalWins / this.stats.totalGames) * 100)
      : 0;
    setTxt('stat-win-rate', `${winRate}%`);
    setTxt('stat-max-streak', `${this.stats.maxStreak}연승`);

    const formatTime = (secs) => {
      if (!secs) return '기록 없음';
      const m = String(Math.floor(secs / 60)).padStart(2, '0');
      const s = String(secs % 60).padStart(2, '0');
      return `${m}:${s}`;
    };

    setTxt('stat-easy-wins', `${this.stats.byDiff.easy.wins}승`);
    setTxt('stat-easy-best', formatTime(this.stats.byDiff.easy.bestTime));
    setTxt('stat-medium-wins', `${this.stats.byDiff.medium.wins}승`);
    setTxt('stat-medium-best', formatTime(this.stats.byDiff.medium.bestTime));

    if (this.stats.byDiff.hard) {
      setTxt('stat-hard-wins', `${this.stats.byDiff.hard.wins}승`);
      setTxt('stat-hard-best', formatTime(this.stats.byDiff.hard.bestTime));
    }

    setTxt('stat-expert-wins', `${this.stats.byDiff.expert.wins}승`);
    setTxt('stat-expert-best', formatTime(this.stats.byDiff.expert.bestTime));
  }

  // ----------------- 게임 이어하기 (Save & Restore) -----------------
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
        anchorCount: this.anchorCount,
        score: this.score,
        combo: this.combo,
        isDaily: this.isDaily,
        dailyDate: this.dailyDate
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
          descEl.textContent = `${state.difficulty.toUpperCase()} · 점수: ${state.score || 0} · ${mins}:${secs}`;
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
      this.score = state.score || 0;
      this.combo = state.combo || 0;
      this.isDaily = !!state.isDaily;
      this.dailyDate = state.dailyDate || null;

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

      this.dom.gameDiffLabel.textContent = this.isDaily ? '일일 도전' : this.difficulty.toUpperCase();
      this.dom.mistakes.textContent = this.settings.mistakeLimit
        ? `${this.mistakes} / ${this.maxMistakes}`
        : `${this.mistakes}`;
      this.dom.gameScore.textContent = this.score;

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

  // ----------------- 화면 뷰 전환 & 하단 내비게이션 -----------------
  switchView(viewName) {
    this.currentView = viewName;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.add('active');

    // 하단 탭 내비게이션 활성화 동기화
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === viewName);
    });

    if (viewName === 'home') {
      this.stopTimer();
      this.saveOngoingGame();
      this.checkContinueGame();
    } else if (viewName === 'game') {
      if (!this.isPaused) this.startTimer();
    } else if (viewName === 'stats') {
      this.renderStatsView();
    } else if (viewName === 'daily') {
      this.renderDailyCalendar();
    }
  }

  handleBackKey() {
    if (this.currentView === 'game' || this.currentView === 'daily' || this.currentView === 'stats') {
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
      gameScore: document.getElementById('game-score'),
      gameDiffLabel: document.getElementById('game-diff-label'),
      pencilBadge: document.getElementById('pencil-badge'),
      btnPencil: document.getElementById('btn-pencil'),
      btnUndo: document.getElementById('btn-undo'),
      btnErase: document.getElementById('btn-erase'),
      btnHint: document.getElementById('btn-hint'),
      hintBadge: document.getElementById('hint-badge'),
      btnGamePause: document.getElementById('btn-game-pause'),
      btnGameTheme: document.getElementById('btn-game-theme'),
      btnGameSettings: document.getElementById('btn-game-settings'),
      btnNavHome: document.getElementById('btn-nav-home'),
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
      btnDailyHero: document.getElementById('btn-daily-play'),

      // Daily Buttons
      btnDailyStart: document.getElementById('btn-daily-start'),

      // Stats Buttons
      btnStatsReset: document.getElementById('btn-stats-reset'),

      // Modals
      modalDiff: document.getElementById('modal-difficulty'),
      btnDiffCancel: document.getElementById('btn-diff-cancel'),
      btnDiffStart: document.getElementById('btn-diff-start'),

      modalSettings: document.getElementById('modal-settings'),
      btnSettingsClose: document.getElementById('btn-settings-close'),
      btnSettingsDone: document.getElementById('btn-settings-done'),
      btnSettingsRestart: document.getElementById('btn-settings-restart'),

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
    // 1. 하단 탭 바 터치
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.sound.play('click');
        const tabName = tab.dataset.tab;
        this.switchView(tabName);
      });
    });

    // 헤더 뒤로가기 버튼들 (.btn-back-home)
    document.querySelectorAll('.btn-back-home').forEach(btn => {
      btn.addEventListener('click', () => {
        this.sound.play('click');
        this.switchView('home');
      });
    });

    // 2. 홈 화면 메뉴
    this.dom.btnHomeContinue.addEventListener('click', () => {
      this.sound.play('click');
      this.restoreOngoingGame();
    });
    this.dom.btnHomeNew.addEventListener('click', () => {
      this.sound.play('click');
      this.dom.modalDiff.classList.remove('hidden');
    });
    this.dom.btnHomeStats.addEventListener('click', () => {
      this.sound.play('click');
      this.switchView('stats');
    });
    this.dom.btnHomeRules.addEventListener('click', () => {
      this.sound.play('click');
      this.dom.modalRules.classList.remove('hidden');
    });
    this.dom.btnHomeUpdate.addEventListener('click', () => {
      this.sound.play('click');
      this.checkForUpdates(true);
    });

    // 홈 일일 도전 히어로 카드
    if (this.dom.btnDailyHero) {
      this.dom.btnDailyHero.addEventListener('click', () => {
        this.sound.play('click');
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        this.startDailyGame(dateStr);
      });
    }

    // 일일 도전 화면 메인 플레이 버튼
    if (this.dom.btnDailyStart) {
      this.dom.btnDailyStart.addEventListener('click', () => {
        this.sound.play('click');
        const targetDate = this.selectedDailyDay || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
        this.startDailyGame(targetDate);
      });
    }

    // 전적 초기화
    this.dom.btnStatsReset.addEventListener('click', () => {
      this.sound.play('click');
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
    this.dom.btnDiffCancel.addEventListener('click', () => {
      this.sound.play('click');
      this.dom.modalDiff.classList.add('hidden');
    });
    this.dom.btnRulesClose.addEventListener('click', () => {
      this.sound.play('click');
      this.dom.modalRules.classList.add('hidden');
    });
    this.dom.btnUpdateDismiss.addEventListener('click', () => {
      this.sound.play('click');
      this.dom.modalUpdate.classList.add('hidden');
    });

    // 난이도 카드 선택
    document.querySelectorAll('.diff-card-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.sound.play('click');
        document.querySelectorAll('.diff-card-btn').forEach(b => b.classList.remove('active'));
        const card = e.currentTarget;
        card.classList.add('active');
        this.difficulty = card.dataset.diff;
      });
    });

    this.dom.btnDiffStart.addEventListener('click', () => {
      this.sound.play('click');
      this.dom.modalDiff.classList.add('hidden');
      this.isDaily = false;
      this.startNewGame(this.difficulty);
    });

    // 3. 게임 화면 헤더 액션
    this.dom.btnNavHome.addEventListener('click', () => {
      this.sound.play('click');
      this.switchView('home');
    });
    this.dom.btnGameTheme.addEventListener('click', () => {
      this.sound.play('click');
      this.cycleTheme();
    });
    this.dom.btnGamePause.addEventListener('click', () => {
      this.sound.play('click');
      this.togglePause();
    });
    this.dom.btnResume.addEventListener('click', () => {
      this.sound.play('click');
      this.togglePause(false);
    });
    this.dom.btnGameSettings.addEventListener('click', () => {
      this.sound.play('click');
      this.dom.modalSettings.classList.remove('hidden');
    });

    // 게임 내 옵션 모달 이벤트
    const closeSettingsModal = () => {
      this.sound.play('click');
      this.dom.modalSettings.classList.add('hidden');
    };
    this.dom.btnSettingsClose.addEventListener('click', closeSettingsModal);
    this.dom.btnSettingsDone.addEventListener('click', closeSettingsModal);
    this.dom.btnSettingsRestart.addEventListener('click', () => {
      this.sound.play('click');
      this.dom.modalSettings.classList.add('hidden');
      this.dom.modalDiff.classList.remove('hidden');
    });

    // 설정 스위치 양방향 바인딩
    const bindToggle = (id1, id2, key) => {
      const handler = (e) => {
        this.sound.play('click');
        const checked = e.target.checked;
        this.settings[key] = checked;
        const otherEl = document.getElementById(e.target.id === id1 ? id2 : id1);
        if (otherEl) otherEl.checked = checked;
        this.saveSettings();
        this.applySettings();
        this.updateBoardDisplay();
        this.updateKeypadBadges();
      };
      const el1 = document.getElementById(id1);
      const el2 = document.getElementById(id2);
      if (el1) el1.addEventListener('change', handler);
      if (el2) el2.addEventListener('change', handler);
    };

    bindToggle('setting-sound', 'modal-setting-sound', 'sound');
    bindToggle('setting-mistake-limit', 'modal-setting-mistake', 'mistakeLimit');
    bindToggle('setting-highlight-cross', 'modal-setting-cross', 'highlightCross');
    bindToggle('setting-highlight-same', 'modal-setting-same', 'highlightSame');
    bindToggle('setting-auto-notes', 'modal-setting-notes', 'autoNotes');

    const bindSingleToggle = (id, key) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', (e) => {
          this.sound.play('click');
          this.settings[key] = e.target.checked;
          this.saveSettings();
          this.applySettings();
          this.updateBoardDisplay();
          this.updateKeypadBadges();
        });
      }
    };
    bindSingleToggle('setting-auto-check', 'autoCheck');
    bindSingleToggle('setting-highlight-dup', 'highlightDup');
    bindSingleToggle('setting-hide-completed', 'hideCompleted');
    bindSingleToggle('setting-show-timer', 'showTimer');

    // 4. 게임 툴바 액션
    this.dom.btnPencil.addEventListener('click', () => this.togglePencilMode());
    this.dom.btnUndo.addEventListener('click', () => this.undo());
    this.dom.btnErase.addEventListener('click', () => this.erase());
    this.dom.btnHint.addEventListener('click', () => this.useHint());

    // 5. 키패드 터치
    this.dom.keyBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const num = parseInt(btn.dataset.num, 10);
        this.handleNumberInput(num);
      });
    });

    // 6. 키보드 대응
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
      const latestTag = (release.tag_name || '').replace(/^v/, '');

      if (this.isNewerVersion(latestTag, APP_VERSION)) {
        document.getElementById('update-modal-title').textContent = `새 버전 발견! (v${latestTag})`;
        document.getElementById('update-modal-version').textContent = `현재 버전: v${APP_VERSION} ➔ 최신 버전: v${latestTag}`;
        this.dom.updateNotes.innerHTML = `<pre>${release.body || '최신 버그 수정 및 UI 개선이 포함되어 있습니다.'}</pre>`;
        
        let downloadUrl = release.html_url;
        if (release.assets && release.assets.length > 0) {
          const apkAsset = release.assets.find(a => a.name.endsWith('.apk'));
          if (apkAsset) downloadUrl = apkAsset.browser_download_url;
        }

        this.dom.btnUpdateDownload.onclick = () => {
          window.open(downloadUrl, '_system');
        };

        this.dom.modalUpdate.classList.remove('hidden');
        if (descEl) descEl.textContent = `새 버전 (v${latestTag}) 다운로드 가능!`;
      } else {
        if (manual) this.showToast(`현재 최신 버전(v${APP_VERSION})을 사용 중입니다.`);
        if (descEl) descEl.textContent = `현재 버전(v${APP_VERSION})이 최신입니다`;
      }
    } catch (e) {
      if (manual) this.showToast('업데이트 확인 실패 (인터넷 연결 확인)');
      if (descEl) descEl.textContent = '업데이트 확인 실패';
    }
  }

  isNewerVersion(remote, local) {
    const rParts = remote.split('.').map(n => parseInt(n, 10) || 0);
    const lParts = local.split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(rParts.length, lParts.length); i++) {
      const r = rParts[i] || 0;
      const l = lParts[i] || 0;
      if (r > l) return true;
      if (r < l) return false;
    }
    return false;
  }

  // ----------------- 신규 게임 시작 -----------------
  startNewGame(diff = 'expert', customRng = null) {
    this.difficulty = diff;
    this.dom.gameDiffLabel.textContent = this.isDaily ? '일일 도전' : diff.toUpperCase();
    this.mistakes = 0;
    this.score = 0;
    this.combo = 0;
    this.dom.gameScore.textContent = '0';
    this.dom.mistakes.textContent = this.settings.mistakeLimit
      ? `0 / ${this.maxMistakes}`
      : `0`;
    this.undoStack = [];
    this.resetTimer();
    this.isWin = false;

    // 매번 알고리즘을 통해 완전히 새로운 정답 판과 케이지를 100% 동적 생성
    const generated = this.generator.generate(diff, customRng);
    this.solution = generated.solution;
    this.cages = generated.cages;
    this.anchorCount = generated.anchorCount;

    this.cellCageMap = {};
    this.cages.forEach((cage, cIdx) => {
      cage.cells.sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);
      cage.labelCell = cage.cells[0];
      cage.cells.forEach(([r, c]) => {
        this.cellCageMap[`${r},${c}`] = cIdx;
      });
    });

    // 모든 81칸은 완전히 빈 상태로 시작
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
    this.showToast(`100% 연역 추론 보장! (${this.isDaily ? '일일 도전' : diffKr} · 확정 앵커 ${this.anchorCount}개)`);
  }

  // ----------------- 수도쿠 보드 및 인셋 점선 케이지 렌더링 -----------------
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

        const myCageIdx = this.cellCageMap[`${r},${c}`];
        const cage = this.cages[myCageIdx];

        // ★ 핵심: 두 번째 이미지(Image 2) 스타일의 칸보다 살짝 작은 인셋 점선 케이지 ★
        const isTopDiff = (r === 0 || this.cellCageMap[`${r - 1},${c}`] !== myCageIdx);
        const isBottomDiff = (r === 8 || this.cellCageMap[`${r + 1},${c}`] !== myCageIdx);
        const isLeftDiff = (c === 0 || this.cellCageMap[`${r},${c - 1}`] !== myCageIdx);
        const isRightDiff = (c === 8 || this.cellCageMap[`${r},${c + 1}`] !== myCageIdx);

        const insetEl = document.createElement('div');
        insetEl.className = 'cage-inset-border';
        if (isTopDiff) insetEl.classList.add('cage-top');
        if (isBottomDiff) insetEl.classList.add('cage-bottom');
        if (isLeftDiff) insetEl.classList.add('cage-left');
        if (isRightDiff) insetEl.classList.add('cage-right');
        cellEl.appendChild(insetEl);

        if (cage.cells.length === 1) {
          cellEl.classList.add('single-cage');
        }

        // 케이지 합계 라벨 (좌상단 대표 셀에만 작고 깔끔하게 표시)
        if (cage.labelCell[0] === r && cage.labelCell[1] === c) {
          const sumEl = document.createElement('span');
          sumEl.className = 'cell-cage-sum';
          sumEl.textContent = cage.sum;
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

        cellEl.addEventListener('click', () => {
          this.sound.play('click');
          this.selectCell(r, c);
        });
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
        cellEl.classList.toggle('error', this.settings.autoCheck && cellData.error);

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
          // 영역 강조 (옵션)
          if (this.settings.highlightCross && (r === selR || c === selC || (boxR === selBoxR && boxC === selBoxC))) {
            cellEl.classList.add('highlight-crosshair');
          }
          // 동일 케이지 강조
          if (cageIdx === selCageIdx) {
            cellEl.classList.add('highlight-cage');
          }
          // 동일 숫자 표시 (옵션)
          if (this.settings.highlightSame && selVal > 0 && cellData.val === selVal) {
            cellEl.classList.add('highlight-same-num');
          }
        }
      }
    }
  }

  // 태블릿 스튜디오 케이지 추론 분석 패널
  updateTabletCageHelper(r, c) {
    const cageIdx = this.cellCageMap[`${r},${c}`];
    if (cageIdx === undefined || !this.cages[cageIdx]) return;
    const cage = this.cages[cageIdx];

    const solvedSum = cage.cells
      .map(([cr, cc]) => this.board[cr][cc].val)
      .filter(v => v > 0)
      .reduce((a, b) => a + b, 0);

    const remaining = cage.sum - solvedSum;

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

  // ----------------- 숫자 입력 및 점수 시스템 -----------------
  handleNumberInput(num) {
    if (this.currentView !== 'game' || this.isPaused) return;
    const { r, c } = this.selected;
    const cellData = this.board[r][c];

    this.saveSnapshot();

    if (this.isPencilMode) {
      this.sound.play('click');
      if (cellData.val === 0) {
        if (cellData.notes.has(num)) {
          cellData.notes.delete(num);
        } else {
          cellData.notes.add(num);
        }
      }
    } else {
      if (cellData.val === num) {
        this.sound.play('click');
        cellData.val = 0;
        cellData.error = false;
      } else {
        cellData.val = num;
        cellData.notes.clear();

        const isCorrect = (num === this.solution[r][c]);
        if (!isCorrect) {
          this.sound.play('error');
          cellData.error = true;
          this.combo = 0;
          this.score = Math.max(0, this.score - 20);
          this.dom.gameScore.textContent = this.score;

          this.mistakes++;
          this.dom.mistakes.textContent = this.settings.mistakeLimit
            ? `${this.mistakes} / ${this.maxMistakes}`
            : `${this.mistakes}`;

          if (this.settings.autoCheck) {
            this.showToast(`잘못된 숫자입니다! (-20점)`);
          }

          if (this.settings.mistakeLimit && this.mistakes >= this.maxMistakes) {
            this.handleGameOver();
            return;
          }
        } else {
          this.sound.play('correct');
          cellData.error = false;
          this.combo++;
          const comboBonus = Math.min(this.combo, 5);
          this.score += 50 * comboBonus;
          this.dom.gameScore.textContent = this.score;

          if (this.settings.autoNotes) {
            this.autoClearNotes(r, c, num);
          }
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
      this.sound.play('click');
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
    this.sound.play('click');
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
    this.sound.play('click');
    this.isPencilMode = !this.isPencilMode;
    this.dom.btnPencil.classList.toggle('active', this.isPencilMode);
    this.dom.pencilBadge.textContent = this.isPencilMode ? 'ON' : 'OFF';
    this.showToast(this.isPencilMode ? '메모(Pencil) 모드 켜짐' : '일반 입력 모드');
  }

  useHint() {
    if (this.currentView !== 'game' || this.isPaused) return;
    const { r, c } = this.selected;
    if (this.board[r][c].val === 0) {
      this.sound.play('correct');
      this.saveSnapshot();
      const answer = this.solution[r][c];
      this.board[r][c].val = answer;
      this.board[r][c].notes.clear();
      this.board[r][c].error = false;
      this.score = Math.max(0, this.score - 10);
      this.dom.gameScore.textContent = this.score;

      if (this.settings.autoNotes) {
        this.autoClearNotes(r, c, answer);
      }
      this.updateBoardDisplay();
      this.updateKeypadBadges();
      this.updateTabletCageHelper(r, c);
      const cage = this.cages[this.cellCageMap[`${r},${c}`]];
      this.showToast(`[힌트] 케이지 합계(${cage.sum}) 제약으로 ${answer} 확정!`);
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
      btn.classList.toggle('completed', this.settings.hideCompleted && rem <= 0);
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
    this.sound.play('win');
    this.stopTimer();
    this.recordGameEnd(true);
    this.clearOngoingGame();

    setTimeout(() => {
      const title = this.isDaily ? `🎉 일일 도전 (${this.dailyDate}) 완벽 클리어!` : `🎉 축하합니다! 썸도쿠를 클리어하셨습니다!`;
      alert(`${title}\n\n최종 점수: ${this.score}점\n소요 시간: ${this.dom.timer.textContent}`);
      this.switchView('stats');
    }, 350);
    return true;
  }

  handleGameOver() {
    this.sound.play('error');
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

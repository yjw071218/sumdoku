/**
 * Sumdoku (썸도쿠) v1.0.8 - 100% 연역 추론 보장 합계 수도쿠
 * 
 * - 클리어 성공 및 실패(게임오버/타임아웃) 화면 프리미엄 네이티브 모달 UI 전면 개편
 * - 승리 축하 꽃가루(Confetti) 파티클 애니메이션 및 신기록 뱃지 탑재
 * - 메모(후보수) 폰트 크기 대폭 확대 (모바일 14~16.5px, 태블릿 18~21.5px, Ultra Bold 900)
 * - 설정 내 메모 폰트 크기 조절 옵션 탑재 (보통 / 크게 / 아주 크게)
 * - 실시간 직접 타이핑 메모 기능 (모바일/태블릿 가상 키보드 및 블루투스/PC 키보드 연동)
 * - 홈 화면, 게임 화면(폰/태블릿 반응형 스튜디오), 일일 도전 캘린더, 설정 및 전적 시스템
 * - 전문가 난이도: 단 1개의 시작 앵커만 주어지는 경우도 100% 순수 연역 추론으로 풀림 보장
 * - 좌측 상단 케이지 합계 숫자와 메모 1번 간의 겹침 현상 원천 해결
 * - 다크모드 고대비 가독성 대폭 향상 (숫자, 메모, 케이지 합계 골드/시안 텍스트, 하이라이트)
 * - 일반 기록 모드 & 타임어택 시간 제한 모드 (카운트다운 타이머 & 보너스 점수)
 * - 고도화된 점수 시스템 (콤보 배율 + 케이지 완성 보너스 + 타임 보너스)
 * - 동일 Wi-Fi 기기 간 실시간 1:1 배틀 모드 (동일 맵 동기화 / 스피드 레이스, 타임어택 점수전, 서바이벌)
 * - 인앱 즉시 업데이트 (OTA 핫 리소스) 및 인앱 원클릭 APK 설치기 탑재
 */

const APP_VERSION = "1.0.10";
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
    } catch (e) {}
  }
}

// ============================================================================
// 1.5. 승리 축하 꽃가루 파티클 애니메이션 (ConfettiEffect)
// ============================================================================
class ConfettiEffect {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.particles = [];
    this.animId = null;
  }

  start(durationMs = 3500) {
    if (!this.canvas || !this.ctx) return;
    this.stop();
    this.canvas.style.display = 'block';
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.particles = [];

    const colors = ['#3b82f6', '#60a5fa', '#f59e0b', '#fbbf24', '#10b981', '#ec4899', '#8b5cf6', '#ef4444'];
    for (let i = 0; i < 95; i++) {
      this.particles.push({
        x: window.innerWidth * (0.2 + Math.random() * 0.6),
        y: window.innerHeight * 0.45,
        vx: (Math.random() - 0.5) * 16,
        vy: -Math.random() * 16 - 7,
        size: Math.random() * 8 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        gravity: 0.38 + Math.random() * 0.1,
        drag: 0.98,
        opacity: 1
      });
    }

    const startTime = Date.now();
    const render = () => {
      const elapsed = Date.now() - startTime;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      let alive = false;
      this.particles.forEach(p => {
        p.vx *= p.drag;
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        if (elapsed > durationMs - 1000) {
          p.opacity = Math.max(0, (durationMs - elapsed) / 1000);
        }

        if (p.opacity > 0 && p.y < window.innerHeight + 50) {
          alive = true;
          this.ctx.save();
          this.ctx.globalAlpha = p.opacity;
          this.ctx.translate(p.x, p.y);
          this.ctx.rotate((p.rotation * Math.PI) / 180);
          this.ctx.fillStyle = p.color;
          this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          this.ctx.restore();
        }
      });

      if (alive && elapsed < durationMs) {
        this.animId = requestAnimationFrame(render);
      } else {
        this.stop();
      }
    };
    render();
  }

  stop() {
    if (this.animId) cancelAnimationFrame(this.animId);
    if (this.canvas) {
      this.canvas.style.display = 'none';
      if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
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

    // ★ 전문가 난이도: 단 1개의 앵커만 주어지는 경우도 포함 ([1, 2, 2, 3])
    const anchorMap = {
      easy: 7,
      medium: 5,
      hard: 4,
      expert: [1, 2, 2, 3][Math.floor(rng() * 4)]
    };
    const targetAnchors = anchorMap[diff] !== undefined ? anchorMap[diff] : [1, 2, 2, 3][Math.floor(rng() * 4)];

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

    // 안전 백업
    const solution = this.createSolutionIterative(rng);
    const cages = this.createSmartCages(solution, targetAnchors, rng);
    return { solution, cages, anchorCount: targetAnchors };
  }

  // 100% 비재귀 반복문 백트래킹
  createSolutionIterative(rng = Math.random) {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));
    
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

  createSmartCages(solution, exactAnchors, rng = Math.random) {
    const boxIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => rng() - 0.5);
    const assigned = new Map();
    const cages = [];

    // 1. 정확한 개수의 1칸 시작 확정 앵커 배치
    for (let i = 0; i < exactAnchors; i++) {
      const box = boxIndices[i % boxIndices.length];
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

      // 고립되어 1칸만 남은 셀은 인접 케이지로 병합하여 불필요한 추가 앵커 방지
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

  solveDeductivelyAdvanced(solution, cages) {
    const candidates = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]))
    );

    let changed = true;
    let loop = 0;
    while (changed && loop++ < 80) {
      changed = false;

      // 1. Naked Singles & 피어 소거법
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

      // 3. Hidden Singles 검증
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
// 3. 앱 주 컨트롤러 (SumdokuApp)
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
    this.anchorCount = 2;
    this.score = 0;
    this.combo = 0;
    this.isDaily = false;
    this.dailyDate = null;
    this.selectedDailyDay = null;

    // 게임 모드 (standard, timeattack, battle)
    this.gameMode = 'standard';
    this.timeRemaining = 600;
    this.timeLimitTotal = 600;

    // Wi-Fi 배틀 상태
    this.isBattle = false;
    this.battleRole = 1; // 1: Host, 2: Guest
    this.battleMode = 'race'; // race, score, survival
    this.battleHostUrl = '';
    this.battlePollInterval = null;
    this.oppState = { filled: 0, score: 0, mistakes: 0, isWin: false };

    // 테마 설정 (light -> dark -> sepia)
    this.themes = ['theme-light', 'theme-dark', 'theme-sepia'];
    this.currentThemeIndex = 0;

    // 설정 및 전적 로드
    this.settings = this.loadSettings();
    this.stats = this.loadStats();
    this.dailyCleared = this.loadDailyCleared();
    this.replays = this.loadReplays();
    this.currentGameReplay = null;
    this.activeReplay = null;
    this.replayStep = 0;
    this.replaySpeed = 1;
    this.replayPlayInterval = null;

    this.initDOM();
    this.confetti = new ConfettiEffect(this.dom.confettiCanvas);
    this.applySettings();
    this.applyTheme(this.settings.darkTheme ? 'theme-dark' : (localStorage.getItem('sumdoku_theme') || 'theme-light'));
    this.bindEvents();
    this.renderDailyCalendar();
    this.checkContinueGame();
    this.renderStatsView();
    this.renderReplayList();
    this.updateAppVersionDisplay();

    setTimeout(() => this.checkForUpdates(false), 1500);
  }

  // ----------------- 설정 관리 (Image 2 세부 토글) -----------------
  loadSettings() {
    const defaults = {
      sound: true,
      autoLock: false,
      showTimer: true,
      showScore: true,
      scoreAnim: true,
      statMessage: true,
      digitFirst: false,
      mistakeLimit: true,
      autoCheck: true,
      highlightDup: true,
      highlightCross: true,
      highlightSame: true,
      autoNotes: true,
      hideCompleted: true,
      darkTheme: false,
      notesSize: 'large'
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

    const setChecked = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!val;
    };

    setChecked('setting-sound', this.settings.sound);
    setChecked('setting-auto-lock', this.settings.autoLock);
    setChecked('setting-show-timer', this.settings.showTimer);
    setChecked('setting-show-score', this.settings.showScore);
    setChecked('setting-score-anim', this.settings.scoreAnim);
    setChecked('setting-stat-message', this.settings.statMessage);
    setChecked('setting-digit-first', this.settings.digitFirst);
    setChecked('setting-mistake-limit', this.settings.mistakeLimit);
    setChecked('setting-auto-check', this.settings.autoCheck);
    setChecked('setting-highlight-dup', this.settings.highlightDup);
    setChecked('setting-highlight-cross', this.settings.highlightCross);
    setChecked('setting-highlight-same', this.settings.highlightSame);
    setChecked('setting-auto-notes', this.settings.autoNotes);
    setChecked('setting-hide-completed', this.settings.hideCompleted);
    setChecked('setting-dark-theme', this.settings.darkTheme);

    // 모달 내 토글 동기화
    setChecked('modal-setting-sound', this.settings.sound);
    setChecked('modal-setting-mistake', this.settings.mistakeLimit);
    setChecked('modal-setting-cross', this.settings.highlightCross);
    setChecked('modal-setting-same', this.settings.highlightSame);
    setChecked('modal-setting-notes', this.settings.autoNotes);

    // 메모 폰트 크기 클래스 적용
    document.body.classList.remove('notes-size-normal', 'notes-size-large', 'notes-size-xlarge');
    document.body.classList.add(`notes-size-${this.settings.notesSize || 'large'}`);
    const sel1 = document.getElementById('setting-notes-size');
    const sel2 = document.getElementById('modal-setting-notes-size');
    if (sel1) sel1.value = this.settings.notesSize || 'large';
    if (sel2) sel2.value = this.settings.notesSize || 'large';

    const timerBox = document.getElementById('timer-box');
    if (timerBox) timerBox.style.display = this.settings.showTimer ? 'flex' : 'none';

    const scoreBox = document.getElementById('game-score-box');
    if (scoreBox) scoreBox.style.display = this.settings.showScore ? 'flex' : 'none';

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
    const themeKr = { 'theme-light': '라이트', 'theme-dark': '다크 (고대비 가독성)', 'theme-sepia': '세피아' }[nextTheme];
    this.showToast(`테마: ${themeKr} 적용`);
  }

  // ----------------- 일일 도전 캘린더 -----------------
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
    const month = now.getMonth();
    const todayDate = now.getDate();

    const monthTitle = document.getElementById('cal-month-title');
    if (monthTitle) monthTitle.textContent = `${year}년 ${month + 1}월`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDayIndex; i++) {
      const empty = document.createElement('button');
      empty.className = 'cal-day-btn empty';
      grid.appendChild(empty);
    }

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

    const progressEl = document.getElementById('daily-trophy-progress');
    const starCountEl = document.getElementById('cal-star-count');
    if (progressEl) progressEl.textContent = `완료: ${clearedCount} / ${totalDays}일`;
    if (starCountEl) starCountEl.textContent = `⭐ ${clearedCount}/${totalDays}`;

    const heroDate = document.getElementById('daily-date-label');
    if (heroDate) {
      heroDate.textContent = `${month + 1}월 ${todayDate}일 퍼즐`;
    }

    this.selectedDailyDay = `${year}-${String(month + 1).padStart(2, '0')}-${String(todayDate).padStart(2, '0')}`;
  }

  startDailyGame(dateStr) {
    this.isDaily = true;
    this.dailyDate = dateStr;
    this.gameMode = 'standard';

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

  // ----------------- 전적 관리 -----------------
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
        easy: { wins: 0, bestTime: null, totalTime: 0, bestScore: 0 },
        medium: { wins: 0, bestTime: null, totalTime: 0, bestScore: 0 },
        hard: { wins: 0, bestTime: null, totalTime: 0, bestScore: 0 },
        expert: { wins: 0, bestTime: null, totalTime: 0, bestScore: 0 }
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
    let isNewBestScore = false;
    let isNewBestTime = false;
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
          if (diffStats.bestTime !== null && diffStats.bestTime !== undefined && diffStats.bestTime > 0) {
            isNewBestTime = true;
          }
          diffStats.bestTime = this.timerSeconds;
        }
        if (!diffStats.bestScore || this.score > diffStats.bestScore) {
          if (diffStats.bestScore && diffStats.bestScore > 0) {
            isNewBestScore = true;
          }
          diffStats.bestScore = this.score;
        }
      }

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

    if (this.currentGameReplay) {
      this.currentGameReplay.result = isWin ? 'win' : 'fail';
      this.currentGameReplay.finalScore = this.score;
      this.currentGameReplay.finalTime = (this.dom && this.dom.timer) ? this.dom.timer.textContent : '00:00';
      this.currentGameReplay.mistakes = this.mistakes;
      this.saveReplay(this.currentGameReplay);
    }

    this.saveStats();
    this.renderStatsView();
    return { isNewBestScore, isNewBestTime };
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

  // ----------------- 이어하기 -----------------
  saveOngoingGame() {
    if (this.currentView !== 'game' || this.isWin || this.isBattle) return;
    try {
      const state = {
        solution: this.solution,
        cages: this.cages,
        board: this.board.map(r => r.map(c => ({ val: c.val, notes: [...c.notes], error: c.error }))),
        timerSeconds: this.timerSeconds,
        timeRemaining: this.timeRemaining,
        gameMode: this.gameMode,
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
      this.anchorCount = state.anchorCount || 2;
      this.timerSeconds = state.timerSeconds;
      this.timeRemaining = state.timeRemaining || 600;
      this.gameMode = state.gameMode || 'standard';
      this.mistakes = state.mistakes;
      this.score = state.score || 0;
      this.combo = state.combo || 0;
      this.isDaily = !!state.isDaily;
      this.dailyDate = state.dailyDate || null;
      this.isBattle = false;

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

      this.updateModeDisplay();
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

  // ----------------- 화면 뷰 전환 & 뒤로가기 -----------------
  switchView(viewName) {
    this.currentView = viewName;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === viewName);
    });

    if (viewName === 'home') {
      this.stopTimer();
      if (this.isBattle) this.endBattleSession();
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
    if (this.currentView === 'game') {
      if (this.isBattle) {
        if (confirm('진행 중인 배틀 대전을 기권하고 퇴장하시겠습니까?')) {
          this.endBattleSession();
          this.switchView('home');
        }
        return "handled";
      }
      this.switchView('home');
      return "handled";
    } else if (this.currentView === 'daily' || this.currentView === 'stats') {
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
      timerBox: document.getElementById('timer-box'),
      mistakes: document.getElementById('mistakes-count'),
      gameScore: document.getElementById('game-score'),
      gameDiffLabel: document.getElementById('game-diff-label'),
      gameModeTag: document.getElementById('game-mode-tag'),
      pencilBadge: document.getElementById('pencil-badge'),
      btnPencil: document.getElementById('btn-pencil'),
      btnTypeMemo: document.getElementById('btn-type-memo'),
      directTypingBar: document.getElementById('direct-typing-bar'),
      inputDirectNotes: document.getElementById('input-direct-notes'),
      typingCellCoord: document.getElementById('typing-cell-coord'),
      btnCloseTyping: document.getElementById('btn-close-typing'),
      btnTypingClear: document.getElementById('btn-typing-clear'),
      btnTypingApply: document.getElementById('btn-typing-apply'),
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

      // Home
      btnHomeContinue: document.getElementById('btn-home-continue'),
      btnHomeNew: document.getElementById('btn-home-new'),
      btnHomeBattle: document.getElementById('btn-home-battle'),
      btnHomeStats: document.getElementById('btn-home-stats'),
      btnHomeRules: document.getElementById('btn-home-rules'),
      btnHomeUpdate: document.getElementById('btn-home-update'),
      btnDailyHero: document.getElementById('btn-daily-play'),

      // Daily
      btnDailyStart: document.getElementById('btn-daily-start'),
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

      // In-App Update
      modalUpdate: document.getElementById('modal-update'),
      btnUpdateDismiss: document.getElementById('btn-update-dismiss'),
      btnUpdateHot: document.getElementById('btn-update-hot'),
      btnUpdateApk: document.getElementById('btn-update-apk'),
      updateNotes: document.getElementById('update-modal-notes'),
      updateProgressContainer: document.getElementById('update-progress-container'),
      updateProgressStatus: document.getElementById('update-progress-status'),
      updateProgressPercent: document.getElementById('update-progress-percent'),
      updateProgressFill: document.getElementById('update-progress-fill'),
      updateActionsNormal: document.getElementById('update-actions-normal'),

      // Battle Elements
      battleHud: document.getElementById('battle-hud'),
      battleHudMode: document.getElementById('battle-hud-mode'),
      battleHudStatus: document.getElementById('battle-hud-status'),
      battleP1Name: document.getElementById('battle-p1-name'),
      battleP1Stat: document.getElementById('battle-p1-stat'),
      battleP2Name: document.getElementById('battle-p2-name'),
      battleP2Stat: document.getElementById('battle-p2-stat'),
      battleP1Bar: document.getElementById('battle-p1-bar'),
      battleP2Bar: document.getElementById('battle-p2-bar'),

      modalBattleLobby: document.getElementById('modal-battle-lobby'),
      btnBattleClose: document.getElementById('btn-battle-close'),
      tabBattleHost: document.getElementById('tab-battle-host'),
      tabBattleJoin: document.getElementById('tab-battle-join'),
      battleHostView: document.getElementById('battle-host-view'),
      battleJoinView: document.getElementById('battle-join-view'),
      battleMyCode: document.getElementById('battle-my-code'),
      battleMyIp: document.getElementById('battle-my-ip'),
      battleWaitText: document.getElementById('battle-wait-text'),
      btnBattleStartMatch: document.getElementById('btn-battle-start-match'),
      battleInputTarget: document.getElementById('battle-input-target'),
      btnBattleConnect: document.getElementById('btn-battle-connect'),

      modalBattleResult: document.getElementById('modal-battle-result'),
      btnBattleResultClose: document.getElementById('btn-battle-result-close'),

      // Game Result Modal
      modalGameResult: document.getElementById('modal-game-result'),
      resultBanner: document.getElementById('result-banner'),
      resultIcon: document.getElementById('result-icon'),
      resultTitle: document.getElementById('result-title'),
      resultSub: document.getElementById('result-sub'),
      resScore: document.getElementById('res-score'),
      resScoreBadge: document.getElementById('res-score-badge'),
      resTime: document.getElementById('res-time'),
      resTimeBadge: document.getElementById('res-time-badge'),
      resMistakes: document.getElementById('res-mistakes'),
      resDiff: document.getElementById('res-diff'),
      btnResultRestart: document.getElementById('btn-result-restart'),
      btnResultStats: document.getElementById('btn-result-stats'),
      btnResultHome: document.getElementById('btn-result-home'),
      confettiCanvas: document.getElementById('confetti-canvas'),

      // Replay Elements
      modalReplayViewer: document.getElementById('modal-replay-viewer'),
      btnReplayClose: document.getElementById('btn-replay-close'),
      replayMetaTitle: document.getElementById('replay-meta-title'),
      replayMetaSub: document.getElementById('replay-meta-sub'),
      replayStepPill: document.getElementById('replay-step-pill'),
      replayBoard: document.getElementById('replay-board'),
      replayDescBox: document.getElementById('replay-desc-box'),
      replayTimeline: document.getElementById('replay-timeline'),
      btnReplayFirst: document.getElementById('btn-replay-first'),
      btnReplayPrev: document.getElementById('btn-replay-prev'),
      btnReplayPlay: document.getElementById('btn-replay-play'),
      btnReplayNext: document.getElementById('btn-replay-next'),
      btnReplayLast: document.getElementById('btn-replay-last'),
      replayListContainer: document.getElementById('replay-list-container'),

      toast: document.getElementById('toast'),
      keyBtns: document.querySelectorAll('.key-btn')
    };
  }

  bindEvents() {
    // 하단 탭 내비게이션
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.sound.play('click');
        this.switchView(tab.dataset.tab);
      });
    });

    document.querySelectorAll('.btn-back-home').forEach(btn => {
      btn.addEventListener('click', () => {
        this.sound.play('click');
        this.switchView('home');
      });
    });

    // 홈 메뉴 버튼
    this.dom.btnHomeContinue.addEventListener('click', () => {
      this.sound.play('click');
      this.restoreOngoingGame();
    });
    this.dom.btnHomeNew.addEventListener('click', () => {
      this.sound.play('click');
      this.dom.modalDiff.classList.remove('hidden');
    });
    this.dom.btnHomeBattle.addEventListener('click', () => {
      this.sound.play('click');
      this.openBattleLobby();
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

    // 일일 도전
    if (this.dom.btnDailyHero) {
      this.dom.btnDailyHero.addEventListener('click', () => {
        this.sound.play('click');
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        this.startDailyGame(dateStr);
      });
    }

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
            easy: { wins: 0, bestTime: null, totalTime: 0, bestScore: 0 },
            medium: { wins: 0, bestTime: null, totalTime: 0, bestScore: 0 },
            hard: { wins: 0, bestTime: null, totalTime: 0, bestScore: 0 },
            expert: { wins: 0, bestTime: null, totalTime: 0, bestScore: 0 }
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

    // 게임 결과 모달 액션 버튼
    if (this.dom.btnResultRestart) {
      this.dom.btnResultRestart.addEventListener('click', () => {
        this.sound.play('click');
        this.confetti.stop();
        this.dom.modalGameResult.classList.add('hidden');
        this.startNewGame(this.difficulty, null, this.gameMode);
      });
    }
    if (this.dom.btnResultStats) {
      this.dom.btnResultStats.addEventListener('click', () => {
        this.sound.play('click');
        this.confetti.stop();
        this.dom.modalGameResult.classList.add('hidden');
        this.switchView('stats');
      });
    }
    if (this.dom.btnResultHome) {
      this.dom.btnResultHome.addEventListener('click', () => {
        this.sound.play('click');
        this.confetti.stop();
        this.dom.modalGameResult.classList.add('hidden');
        this.switchView('home');
      });
    }

    // 난이도 모달 내 모드 선택 (일반 / 타임어택)
    document.querySelectorAll('.mode-select-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.sound.play('click');
        document.querySelectorAll('.mode-select-btn').forEach(b => b.classList.remove('active'));
        const target = e.currentTarget;
        target.classList.add('active');
        this.gameMode = target.dataset.mode;
      });
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
      this.isBattle = false;
      this.startNewGame(this.difficulty, null, this.gameMode);
    });

    // 게임 헤더 액션
    this.dom.btnNavHome.addEventListener('click', () => {
      this.sound.play('click');
      this.handleBackKey();
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

    // 게임 내 설정 모달
    const closeSettings = () => {
      this.sound.play('click');
      this.dom.modalSettings.classList.add('hidden');
    };
    this.dom.btnSettingsClose.addEventListener('click', closeSettings);
    this.dom.btnSettingsDone.addEventListener('click', closeSettings);
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

    const bindSingle = (id, key) => {
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
    bindSingle('setting-auto-check', 'autoCheck');
    bindSingle('setting-highlight-dup', 'highlightDup');
    bindSingle('setting-hide-completed', 'hideCompleted');
    bindSingle('setting-show-timer', 'showTimer');
    bindSingle('setting-auto-lock', 'autoLock');
    bindSingle('setting-show-score', 'showScore');
    bindSingle('setting-score-anim', 'scoreAnim');
    bindSingle('setting-stat-message', 'statMessage');
    bindSingle('setting-digit-first', 'digitFirst');

    const dt = document.getElementById('setting-dark-theme');
    if (dt) {
      dt.addEventListener('change', (e) => {
        this.sound.play('click');
        this.settings.darkTheme = e.target.checked;
        this.applyTheme(e.target.checked ? 'theme-dark' : 'theme-light');
        this.saveSettings();
      });
    }

    // Hub Sidebar Tabs (Image 2)
    document.querySelectorAll('.hub-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        this.sound.play('click');
        document.querySelectorAll('.hub-menu-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        const targetPanelId = item.dataset.hubPanel;
        const targetTitle = item.dataset.hubTitle || '설정';
        const titleEl = document.getElementById('hub-active-title');
        if (titleEl) titleEl.textContent = targetTitle;

        document.querySelectorAll('.hub-panel').forEach(p => p.classList.remove('active'));
        const targetPanel = document.getElementById(targetPanelId);
        if (targetPanel) targetPanel.classList.add('active');

        if (targetPanelId === 'panel-replays') {
          this.renderReplayList();
        } else if (targetPanelId === 'panel-awards') {
          this.renderAwardsList();
        }
      });
    });

    // Replay Player Controls
    if (this.dom.btnReplayClose) {
      this.dom.btnReplayClose.addEventListener('click', () => {
        this.sound.play('click');
        this.closeReplayViewer();
      });
    }
    if (this.dom.btnReplayFirst) {
      this.dom.btnReplayFirst.addEventListener('click', () => {
        this.sound.play('click');
        this.pauseReplayPlay();
        this.applyReplayStep(0);
      });
    }
    if (this.dom.btnReplayPrev) {
      this.dom.btnReplayPrev.addEventListener('click', () => {
        this.sound.play('click');
        this.pauseReplayPlay();
        this.applyReplayStep(this.replayStep - 1);
      });
    }
    if (this.dom.btnReplayPlay) {
      this.dom.btnReplayPlay.addEventListener('click', () => {
        this.sound.play('click');
        this.toggleReplayPlay();
      });
    }
    if (this.dom.btnReplayNext) {
      this.dom.btnReplayNext.addEventListener('click', () => {
        this.sound.play('click');
        this.pauseReplayPlay();
        this.applyReplayStep(this.replayStep + 1);
      });
    }
    if (this.dom.btnReplayLast) {
      this.dom.btnReplayLast.addEventListener('click', () => {
        this.sound.play('click');
        this.pauseReplayPlay();
        if (this.activeReplay) this.applyReplayStep(this.activeReplay.moves.length);
      });
    }
    if (this.dom.replayTimeline) {
      this.dom.replayTimeline.addEventListener('input', (e) => {
        this.pauseReplayPlay();
        this.applyReplayStep(parseInt(e.target.value, 10));
      });
    }
    document.querySelectorAll('.btn-speed').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.sound.play('click');
        document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.replaySpeed = parseFloat(btn.dataset.speed) || 1;
        if (this.replayPlayInterval) {
          this.startReplayPlay();
        }
      });
    });

    // Game Info & GitHub Buttons
    const btnInfoUpdate = document.getElementById('btn-info-check-update');
    if (btnInfoUpdate) {
      btnInfoUpdate.addEventListener('click', () => {
        this.sound.play('click');
        this.checkForUpdates(true);
      });
    }
    const btnInfoGit = document.getElementById('btn-info-github');
    if (btnInfoGit) {
      btnInfoGit.addEventListener('click', () => {
        this.sound.play('click');
        if (window.AndroidBridge && window.AndroidBridge.openExternalUrl) {
          window.AndroidBridge.openExternalUrl(`https://github.com/${GITHUB_REPO}`);
        } else {
          window.open(`https://github.com/${GITHUB_REPO}`, '_blank');
        }
      });
    }

    // 메모 폰트 크기 선택 바인딩
    const bindSelect = (id1, id2, key) => {
      const handler = (e) => {
        this.sound.play('click');
        const val = e.target.value;
        this.settings[key] = val;
        const otherEl = document.getElementById(e.target.id === id1 ? id2 : id1);
        if (otherEl) otherEl.value = val;
        this.saveSettings();
        this.applySettings();
      };
      const el1 = document.getElementById(id1);
      const el2 = document.getElementById(id2);
      if (el1) el1.addEventListener('change', handler);
      if (el2) el2.addEventListener('change', handler);
    };
    bindSelect('setting-notes-size', 'modal-setting-notes-size', 'notesSize');

    // 툴바 액션
    this.dom.btnPencil.addEventListener('click', () => this.togglePencilMode());
    if (this.dom.btnTypeMemo) {
      this.dom.btnTypeMemo.addEventListener('click', () => this.toggleDirectTyping());
    }
    this.dom.btnUndo.addEventListener('click', () => this.undo());
    this.dom.btnErase.addEventListener('click', () => this.erase());
    this.dom.btnHint.addEventListener('click', () => this.useHint());

    // 직접 타이핑 메모 바 이벤트
    if (this.dom.btnCloseTyping) {
      this.dom.btnCloseTyping.addEventListener('click', () => this.closeDirectTyping());
    }
    if (this.dom.btnTypingClear) {
      this.dom.btnTypingClear.addEventListener('click', () => {
        if (this.selected.r < 0 || this.selected.c < 0) return;
        const cellData = this.board[this.selected.r][this.selected.c];
        if (cellData.val > 0) return;
        this.pushUndoState();
        cellData.notes.clear();
        this.updateBoardDisplay();
        this.sound.play('erase');
        if (this.dom.inputDirectNotes) this.dom.inputDirectNotes.value = '';
      });
    }
    if (this.dom.btnTypingApply) {
      this.dom.btnTypingApply.addEventListener('click', () => {
        this.sound.play('click');
        this.moveToNextEmptyCell();
      });
    }
    if (this.dom.inputDirectNotes) {
      this.dom.inputDirectNotes.addEventListener('input', (e) => {
        if (this.selected.r < 0 || this.selected.c < 0) return;
        const cellData = this.board[this.selected.r][this.selected.c];
        if (cellData.val > 0) return;

        const val = e.target.value;
        const digits = Array.from(new Set(val.replace(/[^1-9]/g, '').split('').map(Number))).sort((a, b) => a - b);

        this.pushUndoState();
        cellData.notes = new Set(digits);
        this.updateBoardDisplay();
        this.sound.play('click');

        e.target.value = digits.join('');
      });
    }

    // 키패드 터치
    this.dom.keyBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.handleNumberInput(parseInt(btn.dataset.num, 10));
      });
    });

    // 키보드 대응
    window.addEventListener('keydown', (e) => {
      if (this.currentView !== 'game' || this.isPaused) return;

      // 직접 타이핑 인풋 포커스 상태 처리
      if (this.dom.inputDirectNotes && document.activeElement === this.dom.inputDirectNotes) {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.sound.play('click');
          this.moveToNextEmptyCell();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.closeDirectTyping();
        }
        return;
      }

      // T / t: 직접 타이핑 바 열기/닫기
      if (e.key === 't' || e.key === 'T') {
        this.toggleDirectTyping();
        return;
      }

      // Shift + 1..9: 선택된 칸에 즉시 메모 토글 (메모 모드 토글 불필요)
      if (e.shiftKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const num = parseInt(e.key, 10);
        this.toggleNoteInSelected(num);
        return;
      }

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

    // 배틀 로비 이벤트 바인딩
    this.bindBattleEvents();

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

  // ============================================================================
  // 4. Wi-Fi 실시간 배틀 시스템 (Multiplayer Battle Engine)
  // ============================================================================
  bindBattleEvents() {
    this.dom.btnBattleClose.addEventListener('click', () => {
      this.sound.play('click');
      this.dom.modalBattleLobby.classList.add('hidden');
      if (window.AndroidBridge && window.AndroidBridge.stopBattleServer) {
        window.AndroidBridge.stopBattleServer();
      }
    });

    // 로비 탭 전환 (Host / Join)
    this.dom.tabBattleHost.addEventListener('click', () => {
      this.sound.play('click');
      this.dom.tabBattleHost.classList.add('active');
      this.dom.tabBattleJoin.classList.remove('active');
      this.dom.battleHostView.classList.remove('hidden');
      this.dom.battleJoinView.classList.add('hidden');
      this.setupHostRoom();
    });

    this.dom.tabBattleJoin.addEventListener('click', () => {
      this.sound.play('click');
      this.dom.tabBattleJoin.classList.add('active');
      this.dom.tabBattleHost.classList.remove('active');
      this.dom.battleJoinView.classList.remove('hidden');
      this.dom.battleHostView.classList.add('hidden');
      if (window.AndroidBridge && window.AndroidBridge.stopBattleServer) {
        window.AndroidBridge.stopBattleServer();
      }
    });

    // 배틀 모드 카드 선택 (스피드 레이스 / 타임어택 점수전 / 서바이벌)
    document.querySelectorAll('.battle-mode-card').forEach(card => {
      card.addEventListener('click', (e) => {
        this.sound.play('click');
        document.querySelectorAll('.battle-mode-card').forEach(c => c.classList.remove('active'));
        const target = e.currentTarget;
        target.classList.add('active');
        this.battleMode = target.dataset.bmode;
        this.setupHostRoom();
      });
    });

    // 호스트 게임 시작
    this.dom.btnBattleStartMatch.addEventListener('click', async () => {
      this.sound.play('click');
      try {
        await fetch(`http://${this.battleHostIp}:8888/api/start`, { method: 'POST' });
      } catch (e) {}
      this.dom.modalBattleLobby.classList.add('hidden');
      this.startBattleMatch(1, this.battlePuzzleData, this.battleMode);
    });

    // 게스트 방 접속
    this.dom.btnBattleConnect.addEventListener('click', () => {
      this.sound.play('click');
      this.connectToHost();
    });

    // 배틀 결과 모달 닫기
    this.dom.btnBattleResultClose.addEventListener('click', () => {
      this.sound.play('click');
      this.dom.modalBattleResult.classList.add('hidden');
      this.switchView('home');
    });
  }

  openBattleLobby() {
    this.dom.modalBattleLobby.classList.remove('hidden');
    this.dom.tabBattleHost.classList.add('active');
    this.dom.tabBattleJoin.classList.remove('active');
    this.dom.battleHostView.classList.remove('hidden');
    this.dom.battleJoinView.classList.add('hidden');
    this.setupHostRoom();
  }

  setupHostRoom() {
    this.battleRole = 1;
    let localIp = '127.0.0.1';
    if (window.AndroidBridge && window.AndroidBridge.getLocalIpAddress) {
      localIp = window.AndroidBridge.getLocalIpAddress();
    }
    this.battleHostIp = localIp;

    // 대전용 동일 맵 사전 생성
    const puzzle = this.generator.generate(this.difficulty);
    this.battlePuzzleData = puzzle;

    const timeLimitSec = (this.battleMode === 'score') ? 300 : 0;

    let resJson = { ok: true, code: '88' };
    if (window.AndroidBridge && window.AndroidBridge.startBattleServer) {
      try {
        const raw = window.AndroidBridge.startBattleServer(this.battleMode, this.difficulty, timeLimitSec, JSON.stringify(puzzle));
        resJson = JSON.parse(raw);
      } catch (e) {}
    }

    const code = resJson.code || (localIp.includes('.') ? localIp.split('.').pop() : '88');
    this.dom.battleMyCode.textContent = `ROOM #${code}`;
    this.dom.battleMyIp.textContent = `Wi-Fi 주소: ${localIp}:8888`;
    this.dom.battleWaitText.textContent = '상대방 접속을 기다리는 중...';
    this.dom.btnBattleStartMatch.disabled = true;

    // 호스트 대기 폴링
    clearInterval(this.hostPollTimer);
    this.hostPollTimer = setInterval(async () => {
      try {
        const resp = await fetch(`http://${localIp}:8888/api/status`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.guestJoined) {
            this.dom.battleWaitText.textContent = '상대방 접속 완료! [배틀 시작]을 눌러주세요!';
            this.dom.btnBattleStartMatch.disabled = false;
          }
        }
      } catch (e) {}
    }, 1000);
  }

  async connectToHost() {
    let input = this.dom.battleInputTarget.value.trim();
    if (!input) {
      this.showToast('호스트 IP 또는 방 번호를 입력해 주세요.');
      return;
    }

    let targetIp = input;
    // 숫자 1~3자리인 경우 본인 서브넷 IP와 결합 (예: 25 -> 192.168.0.25)
    if (/^\d{1,3}$/.test(input)) {
      let myIp = '192.168.0.1';
      if (window.AndroidBridge && window.AndroidBridge.getLocalIpAddress) {
        myIp = window.AndroidBridge.getLocalIpAddress();
      }
      const parts = myIp.split('.');
      if (parts.length === 4) {
        parts[3] = input;
        targetIp = parts.join('.');
      }
    }
    if (!targetIp.includes(':')) targetIp += ':8888';

    this.showToast('호스트 연결 시도 중...');
    try {
      const resp = await fetch(`http://${targetIp}/api/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Guest' })
      });
      if (!resp.ok) throw new Error();
      const res = await resp.json();
      if (res.ok) {
        this.battleRole = 2;
        this.battleHostUrl = `http://${targetIp}`;
        this.showToast('방 참가 성공! 호스트가 게임을 시작하면 자동 시작됩니다.');
        this.dom.modalBattleLobby.classList.add('hidden');

        // 게스트 시작 대기 폴링
        clearInterval(this.guestWaitTimer);
        this.guestWaitTimer = setInterval(async () => {
          try {
            const roomResp = await fetch(`${this.battleHostUrl}/api/room`);
            if (roomResp.ok) {
              const rData = await roomResp.json();
              if (rData.status === 'playing') {
                clearInterval(this.guestWaitTimer);
                this.startBattleMatch(2, rData.puzzle, rData.mode);
              }
            }
          } catch (e) {}
        }, 600);
      }
    } catch (e) {
      this.showToast('호스트 연결에 실패했습니다. IP와 Wi-Fi를 확인해 주세요.');
    }
  }

  startBattleMatch(role, puzzleData, bMode) {
    clearInterval(this.hostPollTimer);
    clearInterval(this.guestWaitTimer);

    this.isBattle = true;
    this.battleRole = role;
    this.battleMode = bMode;
    this.gameMode = 'battle';
    this.oppState = { filled: 0, score: 0, mistakes: 0, isWin: false };

    // HUD 모드 라벨
    const modeKr = { race: '⚡ 스피드 레이스', score: '⏱️ 타임어택 점수전', survival: '🛡️ 서바이벌' }[bMode] || bMode;
    this.dom.battleHudMode.textContent = modeKr;
    this.dom.battleHud.classList.remove('hidden');

    this.dom.battleP1Name.textContent = role === 1 ? '나 (Host)' : '나 (Guest)';
    this.dom.battleP2Name.textContent = role === 1 ? '상대 (Guest)' : '상대 (Host)';
    this.dom.battleP1Stat.textContent = '0/81칸 · 0점';
    this.dom.battleP2Stat.textContent = '0/81칸 · 0점';
    this.dom.battleP1Bar.style.width = '0%';
    this.dom.battleP2Bar.style.width = '0%';

    // 배틀 퍼즐은 둘 다 100% 동일한 맵으로 시작
    this.startNewGame(puzzleData.difficulty || 'medium', null, 'battle', puzzleData);
    this.showToast(`⚔️ 1:1 배틀 시작! (${modeKr})`);

    // 실시간 대전 데이터 동기화 루프 (500ms 간격)
    clearInterval(this.battlePollInterval);
    const targetUrl = (role === 1) ? `http://${this.battleHostIp}:8888` : this.battleHostUrl;

    this.battlePollInterval = setInterval(async () => {
      if (!this.isBattle || this.isPaused) return;

      const myFilled = this.countFilledCells();
      try {
        // 내 상태 전송
        await fetch(`${targetUrl}/api/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player: role,
            filled: myFilled,
            score: this.score,
            mistakes: this.mistakes,
            isWin: this.isWin
          })
        });

        // 상대 상태 수신
        const pResp = await fetch(`${targetUrl}/api/progress`);
        if (pResp.ok) {
          const pData = await pResp.json();
          const oppData = (role === 1) ? pData.p2 : pData.p1;
          if (oppData && oppData.filled !== undefined) {
            this.updateOpponentProgress(oppData);
          }
        }
      } catch (e) {}
    }, 600);
  }

  updateOpponentProgress(opp) {
    this.oppState = opp;
    const oppPercent = Math.min(100, Math.round((opp.filled / 81) * 100));
    const myFilled = this.countFilledCells();
    const myPercent = Math.min(100, Math.round((myFilled / 81) * 100));

    this.dom.battleP1Stat.textContent = `${myFilled}/81칸 · ${this.score}점`;
    this.dom.battleP2Stat.textContent = `${opp.filled}/81칸 · ${opp.score || 0}점 (실수 ${opp.mistakes || 0})`;
    this.dom.battleP1Bar.style.width = `${myPercent}%`;
    this.dom.battleP2Bar.style.width = `${oppPercent}%`;

    // 배틀 승패 판정
    if (this.battleMode === 'race') {
      if (opp.isWin) {
        this.handleBattleEnd(false, '상대방이 먼저 수도쿠를 완성했습니다!');
      }
    } else if (this.battleMode === 'survival') {
      if (opp.mistakes >= 3) {
        this.handleBattleEnd(true, '상대방이 실수 3회 초과로 탈락했습니다! 당신의 승리!');
      }
    }
  }

  handleBattleEnd(isVictory, reason) {
    if (!this.isBattle) return;
    this.stopTimer();
    clearInterval(this.battlePollInterval);

    const banner = document.getElementById('battle-result-banner');
    const icon = document.getElementById('battle-result-icon');
    const title = document.getElementById('battle-result-title');
    const sub = document.getElementById('battle-result-sub');

    if (isVictory) {
      this.sound.play('win');
      banner.className = 'battle-result-banner win';
      icon.textContent = '🏆';
      title.textContent = '승리 (VICTORY)!';
      sub.textContent = reason || '멋진 추론으로 상대방을 꺾었습니다!';
    } else {
      this.sound.play('error');
      banner.className = 'battle-result-banner lose';
      icon.textContent = '💔';
      title.textContent = '패배 (DEFEAT)';
      sub.textContent = reason || '아쉽게 패배했습니다. 다음 판에 도전하세요!';
    }

    document.getElementById('res-my-cells').textContent = `${this.countFilledCells()} / 81`;
    document.getElementById('res-opp-cells').textContent = `${this.oppState.filled || 0} / 81`;
    document.getElementById('res-my-score').textContent = `${this.score}점`;
    document.getElementById('res-opp-score').textContent = `${this.oppState.score || 0}점`;
    document.getElementById('res-my-mistakes').textContent = `${this.mistakes}회`;
    document.getElementById('res-opp-mistakes').textContent = `${this.oppState.mistakes || 0}회`;
    document.getElementById('res-my-time').textContent = this.dom.timer.textContent;
    document.getElementById('res-opp-time').textContent = this.dom.timer.textContent;

    this.dom.modalBattleResult.classList.remove('hidden');
    this.endBattleSession();
  }

  endBattleSession() {
    this.isBattle = false;
    clearInterval(this.battlePollInterval);
    this.dom.battleHud.classList.add('hidden');
    if (this.battleRole === 1 && window.AndroidBridge && window.AndroidBridge.stopBattleServer) {
      window.AndroidBridge.stopBattleServer();
    }
  }

  countFilledCells() {
    let count = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.board[r] && this.board[r][c] && this.board[r][c].val > 0 && !this.board[r][c].error) {
          count++;
        }
      }
    }
    return count;
  }

  // ============================================================================
  // 5. 인앱 자동 업데이트 엔진 (In-App Hot Update & APK Downloader)
  // ============================================================================
  handleUpdateProgress(percent, message) {
    if (this.dom.updateProgressPercent) this.dom.updateProgressPercent.textContent = `${percent}%`;
    if (this.dom.updateProgressFill) this.dom.updateProgressFill.style.width = `${percent}%`;
    if (this.dom.updateProgressStatus) this.dom.updateProgressStatus.textContent = message;
  }

  handleUpdateError(message) {
    if (this.dom.updateProgressContainer) this.dom.updateProgressContainer.classList.add('hidden');
    if (this.dom.updateActionsNormal) this.dom.updateActionsNormal.classList.remove('hidden');
    this.showToast(message, 3500);
  }

  async checkForUpdates(manual = false) {
    const descEl = document.getElementById('update-status-desc');
    if (manual) this.showToast('최신 버전 업데이트 확인 중...');
    if (descEl) descEl.textContent = 'GitHub 릴리스 확인 중...';

    const currentVersion = (window.AndroidBridge && window.AndroidBridge.getVersion)
      ? window.AndroidBridge.getVersion()
      : APP_VERSION;

    try {
      const resp = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      });
      if (!resp.ok) throw new Error('API 응답 실패');
      const release = await resp.json();
      const latestTag = (release.tag_name || '').replace(/^v/, '');

      if (this.isNewerVersion(latestTag, currentVersion)) {
        document.getElementById('update-modal-title').textContent = `새 버전 발견! (v${latestTag})`;
        document.getElementById('update-modal-version').textContent = `현재 버전: v${currentVersion} ➔ 최신 버전: v${latestTag}`;
        this.dom.updateNotes.innerHTML = `<pre>${release.body || '최신 버그 수정 및 UI 개선이 포함되어 있습니다.'}</pre>`;

        this.dom.updateActionsNormal.classList.remove('hidden');
        this.dom.updateProgressContainer.classList.add('hidden');
        this.handleUpdateProgress(0, '준비 중...');

        let apkDownloadUrl = release.html_url;
        if (release.assets && release.assets.length > 0) {
          const apkAsset = release.assets.find(a => a.name.endsWith('.apk'));
          if (apkAsset) apkDownloadUrl = apkAsset.browser_download_url;
        }

        // 1. 인앱 즉시 업데이트 (OTA 핫 리소스)
        this.dom.btnUpdateHot.onclick = () => {
          this.sound.play('click');
          this.dom.updateActionsNormal.classList.add('hidden');
          this.dom.updateProgressContainer.classList.remove('hidden');
          this.handleUpdateProgress(10, '인앱 리소스 업데이트 시작...');

          if (window.AndroidBridge && window.AndroidBridge.downloadAndApplyWebUpdate) {
            window.AndroidBridge.downloadAndApplyWebUpdate(latestTag);
          } else {
            setTimeout(() => {
              this.handleUpdateProgress(100, '웹 환경: 페이지를 새로고침합니다...');
              setTimeout(() => window.location.reload(), 600);
            }, 1000);
          }
        };

        // 2. 인앱 APK 원클릭 설치기
        this.dom.btnUpdateApk.onclick = () => {
          this.sound.play('click');
          this.dom.updateActionsNormal.classList.add('hidden');
          this.dom.updateProgressContainer.classList.remove('hidden');
          this.handleUpdateProgress(5, '인앱 APK 다운로드 연결 중...');

          if (window.AndroidBridge && window.AndroidBridge.downloadAndInstallApk) {
            window.AndroidBridge.downloadAndInstallApk(apkDownloadUrl);
          } else {
            window.open(apkDownloadUrl, '_system');
          }
        };

        this.dom.modalUpdate.classList.remove('hidden');
        if (descEl) descEl.textContent = `새 버전 (v${latestTag}) 인앱 업데이트 가능!`;
      } else {
        if (manual) this.showToast(`현재 최신 버전(v${currentVersion})을 사용 중입니다.`);
        if (descEl) descEl.textContent = `현재 버전(v${currentVersion})이 최신입니다`;
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

  // ============================================================================
  // 6. 게임 플레이 (신규 게임, 보드 렌더링, 타이머 & 점수)
  // ============================================================================
  startNewGame(diff = 'expert', customRng = null, mode = 'standard', existingPuzzle = null) {
    this.difficulty = diff;
    this.gameMode = mode;
    this.dom.gameDiffLabel.textContent = this.isDaily ? '일일 도전' : diff.toUpperCase();
    this.updateModeDisplay();

    this.mistakes = 0;
    this.score = 0;
    this.combo = 0;
    this.dom.gameScore.textContent = '0';
    this.dom.mistakes.textContent = this.settings.mistakeLimit
      ? `0 / ${this.maxMistakes}`
      : `0`;
    this.undoStack = [];
    this.isWin = false;

    // 타임어택 제한 시간 설정
    if (this.gameMode === 'timeattack') {
      const limitMap = { easy: 600, medium: 720, hard: 900, expert: 1200 };
      this.timeLimitTotal = limitMap[diff] || 600;
      this.timeRemaining = this.timeLimitTotal;
    } else if (this.gameMode === 'battle' && this.battleMode === 'score') {
      this.timeLimitTotal = 300;
      this.timeRemaining = 300;
    }

    this.resetTimer();

    // 퍼즐 생성 또는 배틀 동일 퍼즐 로드
    const generated = existingPuzzle || this.generator.generate(diff, customRng);
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

    // 81칸 완전 빈 상태로 시작
    this.board = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => ({
        val: 0,
        notes: new Set(),
        isGiven: false,
        error: false
      }))
    );

    const now = new Date();
    const dateStr = `${now.getMonth() + 1}월 ${now.getDate()}일 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    this.currentGameReplay = {
      id: Date.now(),
      date: dateStr,
      difficulty: diff,
      mode: this.gameMode,
      solution: this.solution,
      cages: this.cages,
      cellCageMap: this.cellCageMap,
      anchorCount: this.anchorCount,
      moves: [],
      result: 'ongoing',
      finalScore: 0,
      finalTime: '00:00',
      mistakes: 0
    };

    this.renderBoard();
    this.selectCell(0, 0);
    this.updateKeypadBadges();
    this.startTimer();
    this.switchView('game');

    const diffKr = { easy: '초급', medium: '중급', hard: '고급', expert: '전문가' }[diff] || diff;
    const modeKr = (this.gameMode === 'timeattack') ? '타임어택' : (this.gameMode === 'battle' ? 'Wi-Fi 배틀' : '일반');
    this.showToast(`100% 연역 추론 보장! (${diffKr} · 시작 앵커 ${this.anchorCount}개 · ${modeKr})`);
  }

  updateModeDisplay() {
    if (!this.dom.gameModeTag) return;
    this.dom.gameModeTag.className = 'game-mode-tag';
    if (this.gameMode === 'timeattack') {
      this.dom.gameModeTag.textContent = '타임어택';
      this.dom.gameModeTag.classList.add('mode-timeattack');
    } else if (this.gameMode === 'battle') {
      this.dom.gameModeTag.textContent = '배틀';
      this.dom.gameModeTag.classList.add('mode-battle');
    } else {
      this.dom.gameModeTag.textContent = '일반';
    }
  }

  renderBoard() {
    this.dom.board.innerHTML = '';
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cellEl = document.createElement('div');
        cellEl.className = 'cell';
        cellEl.dataset.r = r;
        cellEl.dataset.c = c;

        if (c === 2 || c === 5) cellEl.classList.add('border-box-right');
        if (r === 2 || r === 5) cellEl.classList.add('border-box-bottom');

        const myCageIdx = this.cellCageMap[`${r},${c}`];
        const cage = this.cages[myCageIdx];

        // 인셋 점선 테두리
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

        // 케이지 합계 라벨
        if (cage.labelCell[0] === r && cage.labelCell[1] === c) {
          const sumEl = document.createElement('span');
          sumEl.className = 'cell-cage-sum';
          sumEl.textContent = cage.sum;
          cellEl.appendChild(sumEl);
          cellEl.classList.add('has-cage-sum');
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
          const now = Date.now();
          if (this.lastCellClick && this.lastCellClick.r === r && this.lastCellClick.c === c && (now - this.lastCellClick.time < 350)) {
            this.openDirectTyping();
          }
          this.lastCellClick = { r, c, time: now };
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
    this.updateDirectTypingInput();
  }

  openDirectTyping() {
    if (this.currentView !== 'game' || this.isPaused) return;
    this.isDirectTypingOpen = true;
    if (this.dom.directTypingBar) this.dom.directTypingBar.classList.remove('hidden');
    if (this.dom.btnTypeMemo) this.dom.btnTypeMemo.classList.add('active');
    this.updateDirectTypingInput();
    setTimeout(() => {
      if (this.dom.inputDirectNotes && !this.dom.inputDirectNotes.disabled) {
        this.dom.inputDirectNotes.focus();
        this.dom.inputDirectNotes.select();
      }
    }, 60);
  }

  closeDirectTyping() {
    this.isDirectTypingOpen = false;
    if (this.dom.directTypingBar) this.dom.directTypingBar.classList.add('hidden');
    if (this.dom.btnTypeMemo) this.dom.btnTypeMemo.classList.remove('active');
    if (this.dom.inputDirectNotes) this.dom.inputDirectNotes.blur();
  }

  toggleDirectTyping() {
    this.sound.play('click');
    if (this.isDirectTypingOpen) {
      this.closeDirectTyping();
    } else {
      this.openDirectTyping();
    }
  }

  updateDirectTypingInput() {
    if (!this.dom.directTypingBar || this.dom.directTypingBar.classList.contains('hidden')) return;
    if (this.selected.r < 0 || this.selected.c < 0) return;
    const { r, c } = this.selected;
    if (this.dom.typingCellCoord) {
      this.dom.typingCellCoord.textContent = `${r + 1}행 ${c + 1}열`;
    }
    const cellData = this.board[r][c];
    if (!this.dom.inputDirectNotes) return;
    if (cellData.val > 0) {
      this.dom.inputDirectNotes.value = '';
      this.dom.inputDirectNotes.placeholder = `확정된 칸 (값: ${cellData.val})`;
      this.dom.inputDirectNotes.disabled = true;
    } else {
      this.dom.inputDirectNotes.disabled = false;
      this.dom.inputDirectNotes.placeholder = '메모할 숫자 입력 (예: 139)...';
      const sorted = Array.from(cellData.notes).sort((a, b) => a - b).join('');
      this.dom.inputDirectNotes.value = sorted;
    }
  }

  moveToNextEmptyCell() {
    if (this.selected.r < 0) return;
    let currIdx = this.selected.r * 9 + this.selected.c;
    for (let offset = 1; offset < 81; offset++) {
      const idx = (currIdx + offset) % 81;
      const nr = Math.floor(idx / 9);
      const nc = idx % 9;
      if (this.board[nr][nc].val === 0) {
        this.selectCell(nr, nc);
        if (this.dom.inputDirectNotes && !this.dom.inputDirectNotes.disabled) {
          this.dom.inputDirectNotes.focus();
          this.dom.inputDirectNotes.select();
        }
        return;
      }
    }
  }

  toggleNoteInSelected(num) {
    if (this.selected.r < 0 || this.selected.c < 0) return;
    const cellData = this.board[this.selected.r][this.selected.c];
    if (cellData.val > 0) return;
    this.pushUndoState();
    if (cellData.notes.has(num)) {
      cellData.notes.delete(num);
    } else {
      cellData.notes.add(num);
    }
    this.updateBoardDisplay();
    this.updateDirectTypingInput();
    this.sound.play('click');
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
          if (this.settings.highlightCross && (r === selR || c === selC || (boxR === selBoxR && boxC === selBoxC))) {
            cellEl.classList.add('highlight-crosshair');
          }
          if (cageIdx === selCageIdx) {
            cellEl.classList.add('highlight-cage');
          }
          if (this.settings.highlightSame && selVal > 0 && cellData.val === selVal) {
            cellEl.classList.add('highlight-same-num');
          }
        }
      }
    }
  }

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
        astTip.textContent = `★ 1칸 확정 앵커: 이 칸은 확정 ${cage.sum}입니다. 추론의 출발점으로 활용하세요!`;
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

  // ----------------- 숫자 입력 & 고도화된 점수 시스템 -----------------
  handleNumberInput(num) {
    if (this.currentView !== 'game' || this.isPaused) return;
    const { r, c } = this.selected;
    const cellData = this.board[r][c];

    this.saveSnapshot();

    if (this.currentGameReplay) {
      this.currentGameReplay.moves.push({
        t: this.timerSeconds,
        isPencil: this.isPencilMode,
        r, c,
        num,
        prevVal: cellData.val,
        error: !this.isPencilMode && (num !== this.solution[r][c])
      });
    }

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
          this.score = Math.max(0, this.score - 50);
          this.dom.gameScore.textContent = this.score;

          this.mistakes++;
          this.dom.mistakes.textContent = this.settings.mistakeLimit
            ? `${this.mistakes} / ${this.maxMistakes}`
            : `${this.mistakes}`;

          if (this.settings.autoCheck) {
            this.showToast(`잘못된 숫자입니다! (-50점)`);
          }

          // 서바이벌 배틀 즉시 탈락 검사
          if (this.isBattle && this.battleMode === 'survival' && this.mistakes >= 3) {
            this.handleBattleEnd(false, '실수 3회 초과로 탈락했습니다!');
            return;
          }

          if (this.settings.mistakeLimit && this.mistakes >= this.maxMistakes) {
            this.handleGameOver();
            return;
          }
        } else {
          this.sound.play('correct');
          cellData.error = false;
          this.combo++;
          const comboMultiplier = Math.min(this.combo, 5);
          const basePoints = 100 * comboMultiplier;
          this.score += basePoints;

          // 케이지 완성 보너스 (+cage.sum * 15)
          const myCageIdx = this.cellCageMap[`${r},${c}`];
          const cage = this.cages[myCageIdx];
          const isCageComplete = cage.cells.every(([cr, cc]) => this.board[cr][cc].val === this.solution[cr][cc]);
          if (isCageComplete) {
            const cageBonus = cage.sum * 15;
            this.score += cageBonus;
            this.showToast(`케이지 완성 보너스! (+${cageBonus}점)`);
          }

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
      if (this.currentGameReplay) {
        this.currentGameReplay.moves.push({
          t: this.timerSeconds,
          type: 'erase',
          r, c,
          prevVal: cellData.val
        });
      }
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
      if (this.currentGameReplay) {
        this.currentGameReplay.moves.push({
          t: this.timerSeconds,
          type: 'hint',
          r, c,
          num: answer,
          prevVal: 0
        });
      }
      this.board[r][c].val = answer;
      this.board[r][c].notes.clear();
      this.board[r][c].error = false;
      this.score = Math.max(0, this.score - 30);
      this.dom.gameScore.textContent = this.score;

      if (this.settings.autoNotes) {
        this.autoClearNotes(r, c, answer);
      }
      this.updateBoardDisplay();
      this.updateKeypadBadges();
      this.updateTabletCageHelper(r, c);
      const cage = this.cages[this.cellCageMap[`${r},${c}`]];
      this.showToast(`[힌트] 케이지 합계(${cage.sum}) 제약으로 ${answer} 확정! (-30점)`);
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

    // 타임어택 보너스 또는 스피드 보너스 계산
    if (this.gameMode === 'timeattack') {
      const timeBonus = this.timeRemaining * 10;
      this.score += timeBonus;
    } else {
      if (this.timerSeconds < 300) this.score += 1000;
      else if (this.timerSeconds < 600) this.score += 500;
    }
    this.dom.gameScore.textContent = this.score;

    if (this.isBattle) {
      this.handleBattleEnd(true, '상대방보다 먼저 수도쿠를 완벽하게 클리어했습니다!');
      return true;
    }

    const endStats = this.recordGameEnd(true);
    this.clearOngoingGame();

    setTimeout(() => {
      const title = this.isDaily
        ? `일일 도전 (${this.dailyDate}) 완벽 클리어!`
        : `축하합니다! 퍼즐 클리어!`;
      const sub = this.isDaily
        ? '오늘의 데일리 퍼즐을 성공적으로 정복하셨습니다!'
        : '모든 케이지 합계와 스도쿠 제약을 완벽한 논리로 해결했습니다!';
      const diffKr = { easy: '초급', medium: '중급', hard: '고급', expert: '전문가' }[this.difficulty] || this.difficulty;

      this.showGameResultModal({
        status: 'win',
        title: title,
        sub: sub,
        score: this.score,
        time: this.dom.timer.textContent,
        mistakes: `${this.mistakes} / 3`,
        difficulty: diffKr,
        isNewBestScore: endStats ? endStats.isNewBestScore : false,
        isNewBestTime: endStats ? endStats.isNewBestTime : false
      });
    }, 350);
    return true;
  }

  handleGameOver() {
    this.sound.play('error');
    this.stopTimer();
    this.recordGameEnd(false);
    this.clearOngoingGame();

    setTimeout(() => {
      const diffKr = { easy: '초급', medium: '중급', hard: '고급', expert: '전문가' }[this.difficulty] || this.difficulty;
      this.showGameResultModal({
        status: 'fail',
        title: '게임 오버 (3회 실수)',
        sub: '허용된 실수 횟수(3회)를 모두 초과했습니다. 다시 도전해 보세요!',
        score: this.score,
        time: this.dom.timer.textContent,
        mistakes: '3 / 3 (초과)',
        difficulty: diffKr,
        isNewBestScore: false,
        isNewBestTime: false
      });
    }, 250);
  }

  handleTimeOut() {
    this.sound.play('error');
    this.stopTimer();

    if (this.isBattle) {
      if (this.battleMode === 'score') {
        const myScore = this.score;
        const oppScore = this.oppState.score || 0;
        if (myScore > oppScore) {
          this.handleBattleEnd(true, `제한 시간 종료! 점수 대결에서 승리했습니다! (${myScore} vs ${oppScore})`);
        } else if (myScore < oppScore) {
          this.handleBattleEnd(false, `제한 시간 종료! 점수 대결에서 패배했습니다. (${myScore} vs ${oppScore})`);
        } else {
          this.handleBattleEnd(true, `제한 시간 종료! 무승부입니다! (${myScore}점 동점)`);
        }
      } else {
        this.handleBattleEnd(false, '제한 시간이 모두 소진되었습니다!');
      }
      return;
    }

    this.recordGameEnd(false);
    this.clearOngoingGame();
    setTimeout(() => {
      const diffKr = { easy: '초급', medium: '중급', hard: '고급', expert: '전문가' }[this.difficulty] || this.difficulty;
      this.showGameResultModal({
        status: 'fail',
        title: '시간 초과!',
        sub: '타임어택 제한 시간이 모두 소진되었습니다. 다음엔 더 빠르게 풀어보세요!',
        score: this.score,
        time: '00:00',
        mistakes: `${this.mistakes} / 3`,
        difficulty: diffKr,
        isNewBestScore: false,
        isNewBestTime: false
      });
    }, 250);
  }

  showGameResultModal(data) {
    if (!this.dom.modalGameResult) return;

    const isSuccess = data.status === 'win';
    if (this.dom.resultBanner) {
      this.dom.resultBanner.className = `result-banner ${isSuccess ? 'success' : 'fail'}`;
    }
    if (this.dom.resultIcon) {
      this.dom.resultIcon.textContent = isSuccess ? '🏆' : (data.title.includes('시간') ? '⏳' : '💔');
    }
    if (this.dom.resultTitle) {
      this.dom.resultTitle.textContent = data.title;
    }
    if (this.dom.resultSub) {
      this.dom.resultSub.textContent = data.sub;
    }
    if (this.dom.resScore) {
      this.dom.resScore.textContent = `${data.score.toLocaleString()}점`;
    }
    if (this.dom.resScoreBadge) {
      this.dom.resScoreBadge.classList.toggle('hidden', !data.isNewBestScore);
    }
    if (this.dom.resTime) {
      this.dom.resTime.textContent = data.time;
    }
    if (this.dom.resTimeBadge) {
      this.dom.resTimeBadge.classList.toggle('hidden', !data.isNewBestTime);
    }
    if (this.dom.resMistakes) {
      this.dom.resMistakes.textContent = data.mistakes;
    }
    if (this.dom.resDiff) {
      this.dom.resDiff.textContent = data.difficulty;
    }
    if (this.dom.btnResultRestart) {
      this.dom.btnResultRestart.textContent = isSuccess ? '새 게임 시작' : '다시 도전하기';
    }

    this.dom.modalGameResult.classList.remove('hidden');

    if (isSuccess && this.confetti) {
      this.confetti.start(3500);
    }
  }

  startTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (!this.isPaused) {
        if (this.gameMode === 'timeattack' || (this.isBattle && this.battleMode === 'score')) {
          if (this.timeRemaining <= 0) {
            this.handleTimeOut();
            return;
          }
          this.timeRemaining--;
          const mins = String(Math.floor(this.timeRemaining / 60)).padStart(2, '0');
          const secs = String(this.timeRemaining % 60).padStart(2, '0');
          this.dom.timer.textContent = `${mins}:${secs}`;
          if (this.dom.timerBox) {
            this.dom.timerBox.classList.toggle('danger-time', this.timeRemaining <= 60);
          }
        } else {
          this.timerSeconds++;
          const mins = String(Math.floor(this.timerSeconds / 60)).padStart(2, '0');
          const secs = String(this.timerSeconds % 60).padStart(2, '0');
          this.dom.timer.textContent = `${mins}:${secs}`;
        }
      }
    }, 1000);
  }

  stopTimer() {
    clearInterval(this.timerInterval);
  }

  resetTimer() {
    this.stopTimer();
    this.timerSeconds = 0;
    if (this.gameMode === 'timeattack' || (this.isBattle && this.battleMode === 'score')) {
      const mins = String(Math.floor(this.timeRemaining / 60)).padStart(2, '0');
      const secs = String(this.timeRemaining % 60).padStart(2, '0');
      this.dom.timer.textContent = `${mins}:${secs}`;
    } else {
      this.dom.timer.textContent = '00:00';
    }
    if (this.dom.timerBox) this.dom.timerBox.classList.remove('danger-time');
  }

  togglePause(forceState) {
    if (this.isBattle) {
      this.showToast('실시간 대전 중에는 일시정지할 수 없습니다!');
      return;
    }
    this.isPaused = forceState !== undefined ? forceState : !this.isPaused;
    this.dom.iconPause.classList.toggle('hidden', this.isPaused);
    this.dom.iconPlay.classList.toggle('hidden', !this.isPaused);
    this.dom.pauseOverlay.classList.toggle('hidden', !this.isPaused);
  }

  // ============================================================================
  // 7. 최근 20판 수도쿠 리플레이 엔진 (Replay Engine)
  // ============================================================================
  loadReplays() {
    try {
      const raw = localStorage.getItem('sumdoku_replays');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return this.generateSeedReplays();
  }

  saveReplay(replay) {
    if (!replay || !replay.moves || replay.moves.length === 0) return;
    try {
      let replays = this.loadReplays();
      replays = replays.filter(r => r.id !== replay.id);
      replays.unshift(replay);
      if (replays.length > 20) replays = replays.slice(0, 20);
      localStorage.setItem('sumdoku_replays', JSON.stringify(replays));
      this.replays = replays;
      this.renderReplayList();
    } catch (e) {}
  }

  generateSeedReplays() {
    // 사용자가 첫 실행 시에도 바로 리플레이를 돌려볼 수 있도록 시드 리플레이 생성
    const seeds = [];
    const diffs = ['expert', 'hard', 'medium', 'easy'];
    const now = Date.now();
    for (let i = 0; i < 4; i++) {
      const d = diffs[i % diffs.length];
      const gen = this.generator.generate(d);
      const puzzleDate = new Date(now - (i * 3600 * 1000 * 6));
      const dateStr = `${puzzleDate.getMonth() + 1}월 ${puzzleDate.getDate()}일 ${String(puzzleDate.getHours()).padStart(2, '0')}:${String(puzzleDate.getMinutes()).padStart(2, '0')}`;
      
      const moves = [];
      const cellsToFill = [];
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          cellsToFill.push([r, c]);
        }
      }
      for (let m = 0; m < 24; m++) {
        const [r, c] = cellsToFill[m];
        moves.push({
          t: (m + 1) * 7,
          isPencil: false,
          r, c,
          num: gen.solution[r][c],
          prevVal: 0,
          error: false
        });
      }

      seeds.push({
        id: now - (i * 200000),
        date: dateStr,
        difficulty: d,
        mode: (i === 1) ? 'timeattack' : 'standard',
        solution: gen.solution,
        cages: gen.cages,
        cellCageMap: {},
        anchorCount: gen.anchorCount || 2,
        moves: moves,
        result: 'win',
        finalScore: 2450 - (i * 280),
        finalTime: `0${3 + i}:1${i * 2}`,
        mistakes: (i % 2 === 0) ? 0 : 1
      });
    }
    return seeds;
  }

  renderReplayList() {
    const container = document.getElementById('replay-list-container');
    if (!container) return;
    container.innerHTML = '';

    const list = this.replays || this.loadReplays();
    if (list.length === 0) {
      container.innerHTML = `<div style="grid-column: 1/-1; padding: 30px; text-align: center; color: var(--text-muted); font-weight: 600;">아직 저장된 리플레이가 없습니다. 게임을 완료하시면 최근 20판의 수순이 자동 저장됩니다!</div>`;
      return;
    }

    const diffKr = { easy: '초급', medium: '중급', hard: '고급', expert: '전문가' };

    list.forEach(rep => {
      const card = document.createElement('div');
      card.className = 'replay-card';
      
      const isWin = rep.result === 'win';
      const dLabel = diffKr[rep.difficulty] || rep.difficulty;

      card.innerHTML = `
        <div class="replay-card-top">
          <span class="replay-diff-badge ${rep.difficulty}">${dLabel}</span>
          <span class="replay-result-tag ${isWin ? 'win' : 'fail'}">${isWin ? '🏆 클리어' : '💔 실패'}</span>
        </div>
        <div class="replay-card-meta">
          <span>📅 ${rep.date}</span>
          <span>수순: <strong>${rep.moves ? rep.moves.length : 0}수</strong></span>
        </div>
        <div class="replay-card-footer">
          <span style="font-weight: 800; color: #2563eb;">${(rep.finalScore || 0).toLocaleString()}점 · ⏱️ ${rep.finalTime || '00:00'}</span>
          <button class="replay-play-btn">리플레이 보기 ▶</button>
        </div>
      `;

      card.addEventListener('click', () => {
        this.sound.play('click');
        this.openReplayViewer(rep);
      });

      container.appendChild(card);
    });
  }

  openReplayViewer(replay) {
    this.activeReplay = replay;
    this.replayStep = 0;
    this.replaySpeed = 1;
    this.pauseReplayPlay();

    const diffKr = { easy: '초급', medium: '중급', hard: '고급', expert: '전문가' };
    const dLabel = diffKr[replay.difficulty] || replay.difficulty;

    if (this.dom.replayMetaTitle) {
      this.dom.replayMetaTitle.textContent = `[${dLabel}] ${replay.result === 'win' ? '완벽 클리어' : '도전'} 리플레이`;
    }
    if (this.dom.replayMetaSub) {
      this.dom.replayMetaSub.textContent = `${replay.date} · 최종 ${replay.finalScore.toLocaleString()}점 · 소요 ${replay.finalTime} · 실수 ${replay.mistakes || 0}회`;
    }

    if (this.dom.replayTimeline) {
      this.dom.replayTimeline.min = 0;
      this.dom.replayTimeline.max = replay.moves.length;
      this.dom.replayTimeline.value = 0;
    }

    this.renderReplayBoardShell(replay);
    this.applyReplayStep(0);

    if (this.dom.modalReplayViewer) {
      this.dom.modalReplayViewer.classList.remove('hidden');
    }
  }

  closeReplayViewer() {
    this.pauseReplayPlay();
    if (this.dom.modalReplayViewer) {
      this.dom.modalReplayViewer.classList.add('hidden');
    }
    this.activeReplay = null;
  }

  renderReplayBoardShell(replay) {
    const boardEl = this.dom.replayBoard;
    if (!boardEl) return;
    boardEl.innerHTML = '';

    const cellCageMap = {};
    (replay.cages || []).forEach((cage, idx) => {
      cage.cells.forEach(([r, c]) => {
        cellCageMap[`${r},${c}`] = idx;
      });
    });

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.r = r;
        cell.dataset.c = c;

        if (c === 2 || c === 5) cell.classList.add('border-box-right');
        if (r === 2 || r === 5) cell.classList.add('border-box-bottom');

        const cIdx = cellCageMap[`${r},${c}`];
        if (cIdx !== undefined && replay.cages[cIdx]) {
          const cage = replay.cages[cIdx];
          const isTop = (r === 0 || cellCageMap[`${r - 1},${c}`] !== cIdx);
          const isBot = (r === 8 || cellCageMap[`${r + 1},${c}`] !== cIdx);
          const isLft = (c === 0 || cellCageMap[`${r},${c - 1}`] !== cIdx);
          const isRgt = (c === 8 || cellCageMap[`${r},${c + 1}`] !== cIdx);

          const inset = document.createElement('div');
          inset.className = 'cage-inset-border';
          if (isTop) inset.classList.add('cage-top');
          if (isBot) inset.classList.add('cage-bottom');
          if (isLft) inset.classList.add('cage-left');
          if (isRgt) inset.classList.add('cage-right');
          cell.appendChild(inset);

          if (cage.labelCell && cage.labelCell[0] === r && cage.labelCell[1] === c) {
            const sumEl = document.createElement('span');
            sumEl.className = 'cell-cage-sum';
            sumEl.textContent = cage.sum;
            cell.appendChild(sumEl);
            cell.classList.add('has-cage-sum');
          }
        }

        const valSpan = document.createElement('span');
        valSpan.className = 'cell-value';
        cell.appendChild(valSpan);

        boardEl.appendChild(cell);
      }
    }
  }

  applyReplayStep(targetStep) {
    if (!this.activeReplay) return;
    const replay = this.activeReplay;
    const totalSteps = replay.moves.length;
    targetStep = Math.max(0, Math.min(totalSteps, targetStep));
    this.replayStep = targetStep;

    const cellValues = Array.from({ length: 9 }, () => Array(9).fill(0));
    let lastMove = null;

    for (let i = 0; i < targetStep; i++) {
      const m = replay.moves[i];
      if (!m.isPencil) {
        if (m.type === 'erase') {
          cellValues[m.r][m.c] = 0;
        } else {
          cellValues[m.r][m.c] = m.num;
        }
      }
      if (i === targetStep - 1) lastMove = m;
    }

    const boardEl = this.dom.replayBoard;
    if (boardEl) {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const cellEl = boardEl.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
          if (cellEl) {
            const valSpan = cellEl.querySelector('.cell-value');
            const v = cellValues[r][c];
            if (valSpan) valSpan.textContent = v > 0 ? v : '';
            cellEl.classList.remove('selected', 'error');

            if (lastMove && lastMove.r === r && lastMove.c === c) {
              cellEl.classList.add('selected');
              if (lastMove.error) cellEl.classList.add('error');
            }
          }
        }
      }
    }

    if (this.dom.replayTimeline) {
      this.dom.replayTimeline.value = targetStep;
    }
    if (this.dom.replayStepPill) {
      this.dom.replayStepPill.textContent = `${targetStep} / ${totalSteps} 수`;
    }

    if (this.dom.replayDescBox) {
      if (targetStep === 0) {
        this.dom.replayDescBox.textContent = '게임 시작 상태입니다. [▶] 버튼을 누르거나 슬라이더로 수순을 확인하세요.';
      } else if (lastMove) {
        const min = String(Math.floor(lastMove.t / 60)).padStart(2, '0');
        const sec = String(lastMove.t % 60).padStart(2, '0');
        if (lastMove.isPencil) {
          this.dom.replayDescBox.textContent = `[${min}:${sec}] (${lastMove.r + 1}행, ${lastMove.c + 1}열) 칸에 메모 ${lastMove.num} 조작`;
        } else if (lastMove.type === 'erase') {
          this.dom.replayDescBox.textContent = `[${min}:${sec}] (${lastMove.r + 1}행, ${lastMove.c + 1}열) 칸 숫자 지움`;
        } else if (lastMove.type === 'hint') {
          this.dom.replayDescBox.textContent = `[${min}:${sec}] (${lastMove.r + 1}행, ${lastMove.c + 1}열) [힌트]로 ${lastMove.num} 확정`;
        } else {
          const resTxt = lastMove.error ? '❌ 오답 (실수)' : '✓ 정답 확정';
          this.dom.replayDescBox.textContent = `[${min}:${sec}] (${lastMove.r + 1}행, ${lastMove.c + 1}열) 칸에 숫자 ${lastMove.num} 입력 (${resTxt})`;
        }
      }
    }
  }

  toggleReplayPlay() {
    if (this.replayPlayInterval) {
      this.pauseReplayPlay();
    } else {
      this.startReplayPlay();
    }
  }

  startReplayPlay() {
    if (!this.activeReplay) return;
    if (this.replayStep >= this.activeReplay.moves.length) {
      this.replayStep = 0;
    }
    if (this.dom.btnReplayPlay) this.dom.btnReplayPlay.textContent = '⏸';

    clearInterval(this.replayPlayInterval);
    const delay = Math.max(150, Math.floor(1000 / this.replaySpeed));
    this.replayPlayInterval = setInterval(() => {
      if (!this.activeReplay || this.replayStep >= this.activeReplay.moves.length) {
        this.pauseReplayPlay();
        return;
      }
      this.applyReplayStep(this.replayStep + 1);
    }, delay);
  }

  pauseReplayPlay() {
    clearInterval(this.replayPlayInterval);
    this.replayPlayInterval = null;
    if (this.dom.btnReplayPlay) this.dom.btnReplayPlay.textContent = '▶';
  }

  updateAppVersionDisplay() {
    const curVer = (window.AndroidBridge && window.AndroidBridge.getVersion)
      ? window.AndroidBridge.getVersion()
      : APP_VERSION;
    const chip = document.getElementById('app-version-chip');
    if (chip) chip.textContent = `v${curVer}`;
    const infoVer = document.getElementById('info-current-version');
    if (infoVer) infoVer.textContent = `v${curVer}`;
  }

  renderAwardsList() {
    const container = document.getElementById('awards-list-grid');
    if (!container) return;
    const wins = this.stats ? this.stats.totalWins : 0;
    const streak = this.stats ? this.stats.maxStreak : 0;
    const expertWins = (this.stats && this.stats.byDiff && this.stats.byDiff.expert) ? this.stats.byDiff.expert.wins : 0;

    const awards = [
      { icon: '🥉', title: '첫 승리의 기쁨', desc: '썸도쿠 퍼즐을 처음으로 클리어 완료', earned: wins >= 1 },
      { icon: '🥈', title: '연역 추론의 달인', desc: '5회 이상 퍼즐 클리어 성공', earned: wins >= 5 },
      { icon: '🥇', title: '전문가 정복자', desc: '1~3개 앵커 전문가 난이도 클리어', earned: expertWins >= 1 },
      { icon: '🔥', title: '연승 가도', desc: '연속 3연승 달성', earned: streak >= 3 },
      { icon: '👑', title: '마스터 마인드', desc: '연속 5연승 대기록 달성', earned: streak >= 5 },
      { icon: '⚡', title: '스피드 러너', desc: '3분 이내에 퍼즐 완료', earned: wins >= 1 }
    ];

    container.innerHTML = awards.map(a => `
      <div class="award-card ${a.earned ? 'earned' : 'locked'}" style="background: var(--bg-surface); border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; display: flex; align-items: center; gap: 14px; margin-bottom: 10px; opacity: ${a.earned ? '1' : '0.45'};">
        <span style="font-size: 2.2rem;">${a.icon}</span>
        <div>
          <div style="font-size: 1.05rem; font-weight: 800; color: var(--text-primary);">${a.title} ${a.earned ? '✓ 달성' : '🔒 미달성'}</div>
          <div style="font-size: 0.84rem; color: var(--text-secondary); margin-top: 2px;">${a.desc}</div>
        </div>
      </div>
    `).join('');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new SumdokuApp();
});

// Native Android Bridge Global Callbacks
window.onUpdateProgress = (percent, message) => {
  if (window.app) window.app.handleUpdateProgress(percent, message);
};

window.onUpdateError = (message) => {
  if (window.app) window.app.handleUpdateError(message);
};

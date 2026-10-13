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

const APP_VERSION = "1.0.22";
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
    this.selectedDifficulty = localStorage.getItem('sumdoku_selected_diff') || 'expert';
    this.difficulty = this.selectedDifficulty;
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
    this.battleDiff = 'expert'; // 배틀 난이도 선택 지원 (초급, 중급, 고급, 전문가)
    this.battleHostUrl = '';
    this.battlePollInterval = null;
    this.oppState = { filled: 0, score: 0, mistakes: 0, isWin: false };

    // 테마 설정 (light -> dark -> sepia)
    this.themes = ['theme-light', 'theme-dark', 'theme-sepia'];
    this.currentThemeIndex = 0;

    // 0. 앱 삭제 후 재설치 시에도 데이터 영구 유지를 위한 공용 외부 저장소 백업 복원
    this.restorePersistentBackup();

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
    this.hintsRemaining = 3;
    this.isMobileHubInDetail = false;
    this.scratchpadText = localStorage.getItem('sumdoku_scratchpad') || '';
    this.isMultiCageMode = false;
    this.selectedCages = new Set();
    this.combo = 0;
    this.comboInterval = null;
    this.comboTimeLeftMs = 0;
    this.COMBO_DURATION_MS = 8000;
    this.hintsUsed = 0;

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
      maxLives: '3', // '1', '3', '5', '10', 'unlimited'
      livesExhaustedAction: 'game_over', // 'game_over', 'continue'
      initialHints: '3', // '1', '3', '5', '10', 'unlimited'
      hintExhaustedAction: 'allow_penalty', // 'allow_penalty', 'disallow'
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

  restorePersistentBackup() {
    if (!window.AndroidBridge || !window.AndroidBridge.loadPersistentBackup) return;
    try {
      const backupStr = window.AndroidBridge.loadPersistentBackup();
      if (backupStr) {
        const backupData = JSON.parse(backupStr);
        let restoredCount = 0;
        for (const [k, v] of Object.entries(backupData)) {
          if (!localStorage.getItem(k) && v !== null && v !== undefined) {
            localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
            restoredCount++;
          }
        }
        if (restoredCount > 0) {
          console.log(`[Sumdoku] 영구 백업 데이터 ${restoredCount}개 항목 자동 복원 완료`);
        }
      }
    } catch (e) {
      console.warn('[Sumdoku] 영구 백업 복원 중 오류:', e);
    }
  }

  syncPersistentBackup() {
    if (!window.AndroidBridge || !window.AndroidBridge.savePersistentBackup) return;
    try {
      const backupObj = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('sumdoku_')) {
          backupObj[k] = localStorage.getItem(k);
        }
      }
      window.AndroidBridge.savePersistentBackup(JSON.stringify(backupObj));
    } catch (e) {}
  }

  saveSettings() {
    try {
      localStorage.setItem('sumdoku_settings', JSON.stringify(this.settings));
      this.syncPersistentBackup();
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

    // 셀렉트 박스 동기화 (메모 크기, 목숨 수, 목숨 소진 액션, 힌트 수, 힌트 소진 액션)
    const setSelectVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };
    setSelectVal('setting-notes-size', this.settings.notesSize || 'large');
    setSelectVal('modal-setting-notes-size', this.settings.notesSize || 'large');

    setSelectVal('setting-max-lives', this.settings.maxLives || '3');
    setSelectVal('modal-setting-max-lives', this.settings.maxLives || '3');

    setSelectVal('setting-lives-exhausted-action', this.settings.livesExhaustedAction || 'game_over');
    setSelectVal('modal-setting-lives-exhausted-action', this.settings.livesExhaustedAction || 'game_over');

    setSelectVal('setting-initial-hints', this.settings.initialHints || '3');
    setSelectVal('modal-setting-initial-hints', this.settings.initialHints || '3');

    setSelectVal('setting-hint-exhausted-action', this.settings.hintExhaustedAction || 'allow_penalty');
    setSelectVal('modal-setting-hint-exhausted-action', this.settings.hintExhaustedAction || 'allow_penalty');

    // 메모 폰트 크기 클래스 적용
    document.body.classList.remove('notes-size-normal', 'notes-size-large', 'notes-size-xlarge');
    document.body.classList.add(`notes-size-${this.settings.notesSize || 'large'}`);

    this.maxMistakes = (this.rules.maxLives === 'unlimited') ? 999999 : parseInt(this.rules.maxLives || 3, 10);

    const timerBox = document.getElementById('timer-box');
    if (timerBox) timerBox.style.display = this.settings.showTimer ? 'flex' : 'none';

    const scoreBox = document.getElementById('game-score-box');
    if (scoreBox) scoreBox.style.display = this.settings.showScore ? 'flex' : 'none';

    if (this.dom && this.dom.mistakes) {
      this.dom.mistakes.textContent = (this.rules.maxLives === 'unlimited' || !this.rules.mistakeLimit)
        ? `${this.mistakes} / ∞`
        : `${this.mistakes} / ${this.maxMistakes}`;
    }
    this.updateHintBadge();
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
      this.syncPersistentBackup();
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

    if (!this.currentGameReplay && this.solution && this.solution.length === 9) {
      const now = new Date();
      const dateStr = `${now.getMonth() + 1}월 ${now.getDate()}일 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      this.currentGameReplay = {
        id: Date.now(),
        date: dateStr,
        difficulty: this.difficulty || 'expert',
        mode: this.gameMode || 'standard',
        solution: this.solution,
        cages: this.cages || [],
        anchorCount: this.anchorCount || 2,
        moves: [],
        result: isWin ? 'win' : 'fail',
        finalScore: this.score || 0,
        finalTime: (this.dom && this.dom.timer) ? this.dom.timer.textContent : '00:00',
        mistakes: this.mistakes || 0
      };
      if (this.board) {
        for (let r = 0; r < 9; r++) {
          for (let c = 0; c < 9; c++) {
            if (this.board[r] && this.board[r][c] && this.board[r][c].val > 0) {
              this.currentGameReplay.moves.push({
                t: this.timerSeconds || 0,
                isPencil: false,
                r, c,
                num: this.board[r][c].val,
                prevVal: 0,
                error: false
              });
            }
          }
        }
      }
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

    const setHtml = (id, html) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    };

    setTxt('stat-total-games', this.stats.totalGames);
    setTxt('stat-total-wins', this.stats.totalWins);
    const winRate = this.stats.totalGames > 0
      ? Math.round((this.stats.totalWins / this.stats.totalGames) * 100)
      : 0;
    setTxt('stat-win-rate', `${winRate}%`);
    setTxt('stat-max-streak', `${this.stats.maxStreak}연승`);

    const formatTime = (secs) => {
      if (!secs) return '<span class="diff-empty-txt">기록 없음</span>';
      const m = String(Math.floor(secs / 60)).padStart(2, '0');
      const s = String(secs % 60).padStart(2, '0');
      return `${m}:${s}`;
    };

    setTxt('stat-easy-wins', `${this.stats.byDiff.easy.wins}승`);
    setHtml('stat-easy-best', formatTime(this.stats.byDiff.easy.bestTime));
    setTxt('stat-medium-wins', `${this.stats.byDiff.medium.wins}승`);
    setHtml('stat-medium-best', formatTime(this.stats.byDiff.medium.bestTime));

    if (this.stats.byDiff.hard) {
      setTxt('stat-hard-wins', `${this.stats.byDiff.hard.wins}승`);
      setHtml('stat-hard-best', formatTime(this.stats.byDiff.hard.bestTime));
    }

    setTxt('stat-expert-wins', `${this.stats.byDiff.expert.wins}승`);
    setHtml('stat-expert-best', formatTime(this.stats.byDiff.expert.bestTime));
  }

  // ----------------- 이어하기 -----------------
  saveOngoingGame() {
    if (this.currentView !== 'game' || this.isWin || this.isBattle) return;
    try {
      const state = {
        solution: this.solution,
        cages: this.cages,
        board: this.board.map(r => r.map(c => ({ val: c.val, notes: [...c.notes], customMemo: c.customMemo || '', error: c.error }))),
        timerSeconds: this.timerSeconds,
        timeRemaining: this.timeRemaining,
        gameMode: this.gameMode,
        mistakes: this.mistakes,
        difficulty: this.difficulty,
        anchorCount: this.anchorCount,
        score: this.score,
        combo: this.combo,
        hintsRemaining: this.hintsRemaining !== undefined ? this.hintsRemaining : 3,
        scratchpadText: this.scratchpadText || '',
        isDaily: this.isDaily,
        dailyDate: this.dailyDate,
        gameRules: this.gameRules || null,
        currentGameReplay: this.currentGameReplay || null
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
      this.hintsRemaining = state.hintsRemaining !== undefined ? state.hintsRemaining : 3;
      this.scratchpadText = state.scratchpadText || this.scratchpadText || '';
      if (this.dom.scratchpadInput) this.dom.scratchpadInput.value = this.scratchpadText;
      this.isDaily = !!state.isDaily;
      this.dailyDate = state.dailyDate || null;
      this.isBattle = false;

      this.gameRules = state.gameRules || normalizedRules(this.settings);
      this.maxMistakes = this.rules.maxLives === "unlimited" ? 999999 : Number(this.rules.maxLives);
      this.currentGameReplay = state.currentGameReplay || {
        id: Date.now(),
        date: `${new Date().getMonth() + 1}월 ${new Date().getDate()}일 ${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
        difficulty: this.difficulty,
        mode: this.gameMode,
        solution: this.solution,
        cages: this.cages,
        anchorCount: this.anchorCount,
        moves: [],
        result: 'ongoing',
        finalScore: this.score,
        finalTime: '00:00',
        mistakes: this.mistakes
      };

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
        customMemo: c.customMemo || '',
        isGiven: false,
        error: c.error
      })));

      const diffKr = { easy: '초급', medium: '중급', hard: '고급', expert: '전문가' }[this.difficulty] || this.difficulty.toUpperCase();
      this.dom.gameDiffLabel.textContent = this.isDaily ? '일일 도전' : diffKr;
      const maxMistakesDisplay = (this.rules.maxLives === 'unlimited' || !this.rules.mistakeLimit) ? '∞' : this.maxMistakes;
      this.dom.mistakes.textContent = `${this.mistakes} / ${maxMistakesDisplay}`;
      this.dom.gameScore.textContent = this.score;

      this.updateHintBadge();
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
      this.openHubPanel('panel-stats', '통계');
    } else if (viewName === 'daily') {
      this.renderDailyCalendar();
    }
  }

  openHubPanel(panelId, title) {
    document.querySelectorAll('.hub-menu-item').forEach(i => {
      i.classList.toggle('active', i.dataset.hubPanel === panelId);
    });
    const targetItem = document.querySelector(`.hub-menu-item[data-hub-panel="${panelId}"]`);
    const targetTitle = title || targetItem?.dataset?.hubTitle || '설정';
    const titleEl = document.getElementById('hub-active-title');
    if (titleEl) titleEl.textContent = targetTitle;

    document.querySelectorAll('.hub-panel').forEach(p => p.classList.remove('active'));
    const targetPanel = document.getElementById(panelId);
    if (targetPanel) targetPanel.classList.add('active');

    if (panelId === 'panel-stats') {
      this.renderStatsView();
    } else if (panelId === 'panel-replays') {
      this.renderReplayList();
    } else if (panelId === 'panel-awards') {
      this.renderAwardsList();
    }

    this.enterMobileHubDetail(targetTitle);
  }

  handleBackKey() {
    // 1. 리플레이 뷰어 모달이 열려있는 경우
    if (this.dom.modalReplayViewer && !this.dom.modalReplayViewer.classList.contains('hidden')) {
      this.closeReplayViewer();
      return "handled";
    }
    // 2. 설정 모달이 열려있는 경우
    if (this.dom.modalSettings && !this.dom.modalSettings.classList.contains('hidden')) {
      this.closeSettingsModal();
      return "handled";
    }
    // 3. 게임 화면인 경우
    if (this.currentView === 'game') {
      if (this.isBattle) {
        this.promptBattleForfeit();
        return "handled";
      }
      this.switchView('home');
      return "handled";
    } else if (this.currentView === 'stats') {
      // 4. 모바일 설정 상세 페이지에 있는 경우 설정 목록으로 복귀
      if (this.isMobileHubInDetail) {
        this.exitMobileHubDetail();
        return "handled";
      }
      this.switchView('home');
      return "handled";
    } else if (this.currentView === 'daily') {
      this.switchView('home');
      return "handled";
    }
    return false;
  }

  // 모바일 안드로이드 스타일 설정 상세 화면 진입
  enterMobileHubDetail(title = '설정') {
    this.isMobileHubInDetail = true;
    const hubContainer = document.querySelector('.hub-container');
    if (hubContainer) hubContainer.classList.add('mobile-detail-mode');
    if (this.dom.btnHubDetailBack) this.dom.btnHubDetailBack.classList.remove('hidden');
    if (this.dom.btnHubHome) this.dom.btnHubHome.classList.add('hidden');
    if (this.dom.hubHeaderTitle) this.dom.hubHeaderTitle.textContent = title;
  }

  // 모바일 안드로이드 스타일 설정 목록 화면으로 복귀
  exitMobileHubDetail() {
    this.isMobileHubInDetail = false;
    const hubContainer = document.querySelector('.hub-container');
    if (hubContainer) hubContainer.classList.remove('mobile-detail-mode');
    if (this.dom.btnHubDetailBack) this.dom.btnHubDetailBack.classList.add('hidden');
    if (this.dom.btnHubHome) this.dom.btnHubHome.classList.remove('hidden');
    if (this.dom.hubHeaderTitle) this.dom.hubHeaderTitle.textContent = '설정';
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
      btnScratchpad: document.getElementById('btn-scratchpad'),
      scratchpadBadge: document.getElementById('scratchpad-badge'),
      scratchpadDrawer: document.getElementById('scratchpad-drawer'),
      scratchpadInput: document.getElementById('scratchpad-input'),
      btnScratchpadClear: document.getElementById('btn-scratchpad-clear'),
      btnScratchpadClose: document.getElementById('btn-scratchpad-close'),

      // Multi-Cage Sum Calculator
      btnCageMultiCalc: document.getElementById('btn-cage-multi-calc'),
      multiCageBanner: document.getElementById('multi-cage-banner'),
      mcBannerText: document.getElementById('mc-banner-text'),
      btnMcReset: document.getElementById('btn-mc-reset'),
      btnMcClose: document.getElementById('btn-mc-close'),
      btnAssistantMultiToggle: document.getElementById('btn-assistant-multi-toggle'),
      assistantMultiPanel: document.getElementById('assistant-multi-panel'),
      assistantMetricsSingle: document.getElementById('assistant-metrics-single'),
      assistantMultiTotal: document.getElementById('assistant-multi-total'),
      assistantMultiCells: document.getElementById('assistant-multi-cells'),
      assistantMultiFormula: document.getElementById('assistant-multi-formula'),
      btnAssistantMultiReset: document.getElementById('btn-assistant-multi-reset'),

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

      // Map Generation Progress Overlay & Live Visualizer
      generatingOverlay: document.getElementById('generating-overlay'),
      genProgressBar: document.getElementById('gen-progress-bar'),
      genStatusText: document.getElementById('gen-status-text'),
      genPercent: document.getElementById('gen-percent'),
      genTitle: document.getElementById('gen-title'),
      genSubtitle: document.getElementById('gen-subtitle'),
      genPreviewBoard: document.getElementById('gen-preview-board'),
      genPreviewBadge: document.getElementById('gen-preview-badge'),
      genPreviewSubtext: document.getElementById('gen-preview-subtext'),
      genStep1: document.getElementById('gen-step-1'),
      genStep2: document.getElementById('gen-step-2'),
      genStep25: document.getElementById('gen-step-25'),
      genStep3: document.getElementById('gen-step-3'),

      modalSettings: document.getElementById('modal-settings'),
      btnSettingsClose: document.getElementById('btn-settings-close'),
      btnSettingsDone: document.getElementById('btn-settings-done'),
      btnSettingsRestart: document.getElementById('btn-settings-restart'),

      modalRules: document.getElementById('modal-rules'),
      btnRulesClose: document.getElementById('btn-rules-close'),

      // Hub Navigation (Android Settings Style)
      btnHubHome: document.getElementById('btn-hub-home'),
      btnHubDetailBack: document.getElementById('btn-hub-detail-back'),
      hubHeaderTitle: document.getElementById('hub-header-title'),

      // In-App Update
      modalUpdate: document.getElementById('modal-update'),
      btnUpdateDismiss: document.getElementById('btn-update-dismiss'),
      btnUpdateApk: document.getElementById('btn-update-apk'),
      updateNotes: document.getElementById('update-modal-notes'),
      updateProgressContainer: document.getElementById('update-progress-container'),
      updateProgressStatus: document.getElementById('update-progress-status'),
      updateProgressPercent: document.getElementById('update-progress-percent'),
      updateProgressFill: document.getElementById('update-progress-fill'),
      updateActionsNormal: document.getElementById('update-actions-normal'),
      homeUpdateBanner: document.getElementById('home-update-banner'),
      btnBannerUpdate: document.getElementById('btn-banner-update'),
      homeUpdateBannerTitle: document.getElementById('home-update-banner-title'),

      // Dynamic Combo Gauge
      comboBadge: document.getElementById('combo-badge'),
      comboText: document.getElementById('combo-text'),
      comboTimerFill: document.getElementById('combo-timer-fill'),

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
      btnBattleForfeit: document.getElementById('btn-battle-forfeit'),
      modalBattleForfeit: document.getElementById('modal-battle-forfeit'),
      btnCancelForfeit: document.getElementById('btn-cancel-forfeit'),
      btnConfirmForfeit: document.getElementById('btn-confirm-forfeit'),

      modalBattleLobby: document.getElementById('modal-battle-lobby'),
      btnBattleClose: document.getElementById('btn-battle-close'),
      tabBattleHost: document.getElementById('tab-battle-host'),
      tabBattleJoin: document.getElementById('tab-battle-join'),
      battleHostView: document.getElementById('battle-host-view'),
      battleJoinView: document.getElementById('battle-join-view'),
      battleMyCode: document.getElementById('battle-my-code'),
      btnCopyBattleCode: document.getElementById('btn-copy-battle-code'),
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
      replayBattleOppPanel: document.getElementById('replay-battle-opp-panel'),
      replayOppTitle: document.getElementById('replay-opp-title'),
      replayOppStatus: document.getElementById('replay-opp-status'),
      replayOppCells: document.getElementById('replay-opp-cells'),
      replayOppScore: document.getElementById('replay-opp-score'),
      replayOppMistakes: document.getElementById('replay-opp-mistakes'),
      replayOppBarFill: document.getElementById('replay-opp-bar-fill'),

      toast: document.getElementById('toast'),
      keyBtns: document.querySelectorAll('.key-btn')
    };
  }

  // ----------------- 난이도 & 모드 모달 동기화 -----------------
  openDifficultyModal() {
    const diffToSelect = localStorage.getItem('sumdoku_last_diff') || this.selectedDifficulty || this.difficulty || 'expert';
    this.selectedDifficulty = diffToSelect;
    this.difficulty = diffToSelect;
    document.querySelectorAll('.diff-card-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.diff === diffToSelect);
    });
    const modeToSelect = localStorage.getItem('sumdoku_last_mode') || this.gameMode || 'standard';
    this.gameMode = modeToSelect;
    document.querySelectorAll('.mode-select-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === modeToSelect);
    });
    this.dom.modalDiff.classList.remove('hidden');
  }

  // ----------------- 배틀 기권 커스텀 모달 -----------------
  openForfeitModal() {
    if (!this.isBattle) return;
    if (this.dom.modalBattleForfeit) {
      this.dom.modalBattleForfeit.classList.remove('hidden');
    }
  }

  closeForfeitModal() {
    if (this.dom.modalBattleForfeit) {
      this.dom.modalBattleForfeit.classList.add('hidden');
    }
  }

  // ----------------- 다이내믹 콤보 타이머 시스템 -----------------
  startComboTimer() {
    clearInterval(this.comboInterval);

    this.comboTimeLeftMs = this.COMBO_DURATION_MS;
    if (this.dom.comboBadge) this.dom.comboBadge.classList.remove('hidden');
    if (this.dom.comboText) this.dom.comboText.textContent = `⚡ ${this.combo} COMBO`;
    if (this.dom.comboTimerFill) this.dom.comboTimerFill.style.width = '100%';

    const stepMs = 100;
    this.comboInterval = setInterval(() => {
      this.comboTimeLeftMs -= stepMs;
      const pct = Math.max(0, (this.comboTimeLeftMs / this.COMBO_DURATION_MS) * 100);
      if (this.dom.comboTimerFill) this.dom.comboTimerFill.style.width = `${pct}%`;

      if (this.comboTimeLeftMs <= 0) {
        clearInterval(this.comboInterval);
        this.resetCombo('콤보 시간 만료');
      }
    }, stepMs);
  }

  resetCombo(reason = '') {
    clearInterval(this.comboInterval);
    const wasCombo = this.combo > 1;
    this.combo = 0;
    if (this.dom.comboBadge) this.dom.comboBadge.classList.add('hidden');
    if (wasCombo && reason) {
      this.showToast(`⚡ ${reason}`);
    }
  }

  // ----------------- 맵 생성 진행 오버레이 및 실시간 스마트 케이지 시각화 -----------------
  showGeneratingOverlay(diff = 'expert', customTitle = null) {
    if (!this.dom.generatingOverlay) return;
    const diffNames = { easy: '초급', medium: '중급', hard: '고급', expert: '전문가' };
    const diffKr = diffNames[diff] || diff;
    if (this.dom.genTitle) {
      this.dom.genTitle.textContent = customTitle || `${diffKr} 연역 추론 맵 생성 중`;
    }
    if (this.dom.genSubtitle) {
      this.dom.genSubtitle.textContent = '1 ➔ 2 ➔ ★2.5 ➔ 3단계 파이프라인으로 순수 연역 퍼즐을 생성합니다';
    }
    if (this.dom.genProgressBar) {
      this.dom.genProgressBar.style.width = '15%';
    }
    if (this.dom.genStatusText) {
      this.dom.genStatusText.textContent = '1단계: 9×9 정답판 생성 중...';
    }
    if (this.dom.genPercent) {
      this.dom.genPercent.textContent = '15%';
    }

    // 4단계 파이프라인 스텝 배지 초기화
    this.updatePipelineStepBadges('1', 'active');

    // 81칸 미니 프리뷰 보드 초기화
    if (this.dom.genPreviewBoard) {
      this.dom.genPreviewBoard.innerHTML = '';
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const cell = document.createElement('div');
          cell.className = 'gen-preview-cell';
          cell.id = `gen-cell-${r}-${c}`;
          this.dom.genPreviewBoard.appendChild(cell);
        }
      }
    }
    if (this.dom.genPreviewBadge) {
      this.dom.genPreviewBadge.textContent = '✨ 4계층 연역 파이프라인 실시간 시각화';
    }
    if (this.dom.genPreviewSubtext) {
      this.dom.genPreviewSubtext.textContent = '컴퓨터 솔버 0.1ms 컷트 & 연역 엔진 가동 중';
    }

    this.dom.generatingOverlay.classList.remove('hidden');
  }

  updatePipelineStepBadges(currentStep, status = 'active') {
    const steps = [
      { key: '1', el: this.dom.genStep1 },
      { key: '2', el: this.dom.genStep2 },
      { key: '2.5', el: this.dom.genStep25 },
      { key: '3', el: this.dom.genStep3 }
    ];

    const stepOrder = ['1', '2', '2.5', '3'];
    const curIdx = stepOrder.indexOf(String(currentStep));

    steps.forEach((s, idx) => {
      if (!s.el) return;
      s.el.className = 'gen-step-badge';
      if (idx < curIdx) {
        s.el.classList.add('passed');
      } else if (idx === curIdx) {
        if (status === 'rejected') s.el.classList.add('rejected');
        else if (status === 'passed' || status === 'completed') s.el.classList.add('passed');
        else s.el.classList.add('active');
      } else {
        s.el.classList.add('pending');
      }
    });
  }

  updateGeneratingProgress(p) {
    if (!this.dom.generatingOverlay || this.dom.generatingOverlay.classList.contains('hidden')) return;
    if (this.dom.genProgressBar) {
      this.dom.genProgressBar.style.width = `${p.percent || 15}%`;
    }
    if (this.dom.genStatusText) {
      this.dom.genStatusText.textContent = p.message || '검증 진행 중...';
    }
    if (this.dom.genPercent) {
      this.dom.genPercent.textContent = `${p.percent || 15}%`;
    }

    // 1, 2, 2.5, 3단계 스텝 배지 상태 갱신
    if (p.step) {
      this.updatePipelineStepBadges(p.step, p.stepStatus || 'active');
    }

    // 서브텍스트 상세 안내
    if (this.dom.genPreviewSubtext) {
      if (p.step === '2.5' && p.stepStatus === 'repairing') {
        this.dom.genPreviewSubtext.textContent = `🔧 국소 수리: 복수해 유발 셀 주변만 스마트 재분할 진행 중`;
      } else if (p.step === '2.5' && p.stepStatus === 'rejected') {
        this.dom.genPreviewSubtext.textContent = `⚡ 0.1ms 컷트: 복수해 불량 맵 #${p.rejectedCount || p.attempt}회 즉시 탈락`;
      } else if (p.step === '2.5' && p.stepStatus === 'passed') {
        this.dom.genPreviewSubtext.textContent = `✓ 유일해 통과: 불량 맵 #${p.rejectedCount || 0}회 컷트 후 유일해 확보!`;
      } else if (p.step === '3') {
        if (p.stepStatus === 'completed') {
          this.dom.genPreviewSubtext.textContent = `🎉 100% 순수 연역 논리 판별 성공! (81/81칸 확정)`;
        } else {
          this.dom.genPreviewSubtext.textContent = `인간 연역 추론 검증 중 (${p.solvedCount || 0}/81칸 · 시도 #${p.attempt})`;
        }
      } else if (p.step === '2') {
        this.dom.genPreviewSubtext.textContent = `2단계: 2~4칸 스마트 폴리오미노 분할 완료`;
      } else {
        this.dom.genPreviewSubtext.textContent = `1단계: 9×9 라틴 방진 완성 스도쿠 판 생성`;
      }
    }

    // 스마트 케이지 및 연역 확정 칸 미니 프리뷰 렌더링
    if (p.cages && this.dom.genPreviewBoard) {
      const palette = [
        '#bfdbfe', '#bbf7d0', '#fef08a', '#fed7aa', '#fbcfe8',
        '#ddd6fe', '#c7d2fe', '#99f6e4', '#fed7d7', '#e9d5ff'
      ];
      p.cages.forEach((cage, idx) => {
        const color = palette[idx % palette.length];
        const isSingleAnchor = cage.cells.length === 1;
        cage.cells.forEach(([r, c]) => {
          const el = document.getElementById(`gen-cell-${r}-${c}`);
          if (el) {
            el.style.backgroundColor = isSingleAnchor ? '#fbbf24' : color;
            if (isSingleAnchor) {
              el.classList.add('anchor');
              el.textContent = cage.sum || '★';
            } else {
              el.classList.remove('anchor');
              el.textContent = '';
            }
          }
        });
      });

      // 3단계에서 연역 확정된 셀 하이라이트
      if (p.solvedCells && Array.isArray(p.solvedCells)) {
        p.solvedCells.forEach(([r, c]) => {
          const el = document.getElementById(`gen-cell-${r}-${c}`);
          if (el && !el.classList.contains('anchor')) {
            el.classList.add('solved');
            if (p.solution && p.solution[r]) {
              el.textContent = p.solution[r][c];
            }
          }
        });
      }

      if (this.dom.genPreviewBadge) {
        const solvedTxt = p.solvedCount !== undefined ? ` · 확정 ${p.solvedCount}/81칸` : '';
        const cutTxt = p.rejectedCount ? ` · 컷트 ${p.rejectedCount}회` : '';
        this.dom.genPreviewBadge.textContent = `✨ 케이지 ${p.cages.length}개${solvedTxt}${cutTxt}`;
      }
    }
  }

  hideGeneratingOverlay() {
    if (!this.dom.generatingOverlay) return;
    this.dom.generatingOverlay.classList.add('hidden');
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
        if (this.currentView === 'game' && this.isBattle) {
          this.promptBattleForfeit();
          return;
        }
        this.switchView('home');
      });
    });

    if (this.dom.btnBattleForfeit) {
      this.dom.btnBattleForfeit.addEventListener('click', () => {
        this.sound.play('click');
        this.openForfeitModal();
      });
    }
    if (this.dom.btnCancelForfeit) {
      this.dom.btnCancelForfeit.addEventListener('click', () => {
        this.sound.play('click');
        this.closeForfeitModal();
      });
    }
    if (this.dom.btnConfirmForfeit) {
      this.dom.btnConfirmForfeit.addEventListener('click', () => {
        this.sound.play('click');
        this.closeForfeitModal();
        this.forfeitBattle();
      });
    }

    if (this.dom.btnBannerUpdate) {
      this.dom.btnBannerUpdate.addEventListener('click', (e) => {
        e.stopPropagation();
        this.sound.play('click');
        if (this.dom.modalUpdate) this.dom.modalUpdate.classList.remove('hidden');
      });
    }
    if (this.dom.homeUpdateBanner) {
      this.dom.homeUpdateBanner.addEventListener('click', () => {
        this.sound.play('click');
        if (this.dom.modalUpdate) this.dom.modalUpdate.classList.remove('hidden');
      });
    }

    // 홈 메뉴 버튼
    this.dom.btnHomeContinue.addEventListener('click', () => {
      this.sound.play('click');
      this.restoreOngoingGame();
    });
    this.dom.btnHomeNew.addEventListener('click', () => {
      this.sound.play('click');
      this.openDifficultyModal();
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
        localStorage.setItem('sumdoku_last_mode', target.dataset.mode);
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
        this.selectedDifficulty = card.dataset.diff;
        localStorage.setItem('sumdoku_selected_diff', card.dataset.diff);
        localStorage.setItem('sumdoku_last_diff', card.dataset.diff);
      });
    });

    this.dom.btnDiffStart.addEventListener('click', () => {
      this.sound.play('click');
      this.dom.modalDiff.classList.add('hidden');
      this.isDaily = false;
      this.isBattle = false;

      // 화면에 활성화된(active) 난이도와 모드를 정확하게 읽어서 시작 (Expert 선택 시 Medium 시작 버그 원천 차단)
      const activeCard = document.querySelector('.diff-card-btn.active');
      const selectedDiff = activeCard ? activeCard.dataset.diff : (this.selectedDifficulty || this.difficulty || 'expert');
      this.difficulty = selectedDiff;
      this.selectedDifficulty = selectedDiff;
      localStorage.setItem('sumdoku_selected_diff', selectedDiff);
      localStorage.setItem('sumdoku_last_diff', selectedDiff);

      const activeModeBtn = document.querySelector('.mode-select-btn.active');
      const selectedMode = activeModeBtn ? activeModeBtn.dataset.mode : (this.gameMode || 'standard');
      this.gameMode = selectedMode;
      localStorage.setItem('sumdoku_last_mode', selectedMode);

      this.startNewGame(selectedDiff, null, selectedMode);
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
      this.openDifficultyModal();
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

    // Hub Navigation Back & Home
    if (this.dom.btnHubHome) {
      this.dom.btnHubHome.addEventListener('click', () => {
        this.sound.play('click');
        this.switchView('home');
      });
    }
    if (this.dom.btnHubDetailBack) {
      this.dom.btnHubDetailBack.addEventListener('click', () => {
        this.sound.play('click');
        this.exitMobileHubDetail();
      });
    }

    // Hub Sidebar Tabs (Android Master-Detail Navigation)
    document.querySelectorAll('.hub-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        this.sound.play('click');
        this.openHubPanel(item.dataset.hubPanel, item.dataset.hubTitle);
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
      if (el1) { el1.addEventListener('change', handler); el1.addEventListener('input', handler); }
      if (el2) { el2.addEventListener('change', handler); el2.addEventListener('input', handler); }
    };
    bindSelect('setting-notes-size', 'modal-setting-notes-size', 'notesSize');
    bindSelect('setting-max-lives', 'modal-setting-max-lives', 'maxLives');
    bindSelect('setting-lives-exhausted-action', 'modal-setting-lives-exhausted-action', 'livesExhaustedAction');
    bindSelect('setting-initial-hints', 'modal-setting-initial-hints', 'initialHints');
    bindSelect('setting-hint-exhausted-action', 'modal-setting-hint-exhausted-action', 'hintExhaustedAction');

    // 툴바 액션
    this.dom.btnPencil.addEventListener('click', () => this.togglePencilMode());
    if (this.dom.btnScratchpad) {
      this.dom.btnScratchpad.addEventListener('click', () => this.toggleScratchpad());
    }
    if (this.dom.btnScratchpadClose) {
      this.dom.btnScratchpadClose.addEventListener('click', () => this.closeScratchpad());
    }
    if (this.dom.btnScratchpadClear) {
      this.dom.btnScratchpadClear.addEventListener('click', () => {
        this.sound.play('click');
        this.scratchpadText = '';
        if (this.dom.scratchpadInput) this.dom.scratchpadInput.value = '';
        localStorage.removeItem('sumdoku_scratchpad');
        this.updateScratchpadBadge();
        this.saveOngoingGame();
      });
    }
    if (this.dom.scratchpadInput) {
      this.dom.scratchpadInput.addEventListener('input', (e) => {
        this.scratchpadText = e.target.value;
        localStorage.setItem('sumdoku_scratchpad', this.scratchpadText);
        this.updateScratchpadBadge();
        this.saveOngoingGame();
      });
    }

    // 케이지 다중 선택 & 합계 계산기 액션
    if (this.dom.btnCageMultiCalc) {
      this.dom.btnCageMultiCalc.addEventListener('click', () => this.toggleMultiCageMode());
    }
    if (this.dom.btnAssistantMultiToggle) {
      this.dom.btnAssistantMultiToggle.addEventListener('click', () => this.toggleMultiCageMode());
    }
    if (this.dom.btnMcReset) {
      this.dom.btnMcReset.addEventListener('click', () => {
        this.sound.play('click');
        this.resetMultiCageSelection();
      });
    }
    if (this.dom.btnAssistantMultiReset) {
      this.dom.btnAssistantMultiReset.addEventListener('click', () => {
        this.sound.play('click');
        this.resetMultiCageSelection();
      });
    }
    if (this.dom.btnMcClose) {
      this.dom.btnMcClose.addEventListener('click', () => this.toggleMultiCageMode());
    }

    this.dom.btnUndo.addEventListener('click', () => this.undo());
    this.dom.btnErase.addEventListener('click', () => this.erase());
    this.dom.btnHint.addEventListener('click', () => this.useHint());

    // 키패드 터치
    this.dom.keyBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.handleNumberInput(parseInt(btn.dataset.num, 10));
      });
    });

    // 키보드 대응
    window.addEventListener('keydown', (e) => {
      if (this.currentView !== 'game' || this.isPaused) return;

      // 메모장 인풋 포커스 상태 처리 (ESC로 닫기, 키패드 숫자 간섭 방지)
      if (this.dom.scratchpadInput && document.activeElement === this.dom.scratchpadInput) {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.closeScratchpad();
        }
        return;
      }

      // M / m: 자유 메모장 토글
      if (e.key === 'm' || e.key === 'M') {
        this.toggleScratchpad();
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
        try { localStorage.setItem('sumdoku_last_battle_mode', this.battleMode); } catch (e) {}
        this.setupHostRoom();
      });
    });

    // 배틀 난이도 버튼 선택
    document.querySelectorAll('.battle-diff-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.sound.play('click');
        document.querySelectorAll('.battle-diff-btn').forEach(b => b.classList.remove('active'));
        const target = e.currentTarget;
        target.classList.add('active');
        this.battleDiff = target.dataset.bdiff;
        try { localStorage.setItem('sumdoku_last_battle_diff', this.battleDiff); } catch (e) {}
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

    // 숫자 접속 코드 복사 기능 (복사 버튼 및 코드 텍스트 터치)
    const handleCopyCode = () => {
      const codeText = this.dom.battleMyCode ? this.dom.battleMyCode.textContent.trim() : '';
      const rawCode = codeText.replace(/\s+/g, '');
      if (!rawCode || rawCode === '대기중...' || rawCode === '방준비전' || rawCode.includes('대기') || rawCode.includes('준비')) {
        this.showToast('먼저 방 준비를 완료해 주세요.');
        return;
      }
      this.sound.play('click');
      let copied = false;
      if (window.AndroidBridge && window.AndroidBridge.copyToClipboard) {
        window.AndroidBridge.copyToClipboard(rawCode);
        copied = true;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(rawCode).catch(() => {});
        copied = true;
      }
      if (!copied) {
        try {
          const ta = document.createElement('textarea');
          ta.value = rawCode;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          copied = true;
        } catch (e) {}
      }
      this.showToast(`📋 접속 코드 복사 완료! (${codeText})`);
    };

    if (this.dom.btnCopyBattleCode) {
      this.dom.btnCopyBattleCode.addEventListener('click', (e) => {
        e.stopPropagation();
        handleCopyCode();
      });
    }
    if (this.dom.battleMyCode) {
      this.dom.battleMyCode.addEventListener('click', () => {
        handleCopyCode();
      });
    }

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

    const lastBattleMode = localStorage.getItem('sumdoku_last_battle_mode') || this.battleMode || 'race';
    this.battleMode = lastBattleMode;
    document.querySelectorAll('.battle-mode-card').forEach(c => {
      c.classList.toggle('active', c.dataset.bmode === this.battleMode);
    });

    const lastBattleDiff = localStorage.getItem('sumdoku_last_battle_diff') || this.battleDiff || 'expert';
    this.battleDiff = lastBattleDiff;
    document.querySelectorAll('.battle-diff-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.bdiff === this.battleDiff);
    });
    this.setupHostRoom();
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
    const matchDiff = (puzzleData && puzzleData.difficulty) || this.battleDiff || 'expert';
    this.startNewGame(matchDiff, null, 'battle', puzzleData);
    if (this.currentGameReplay) {
      this.currentGameReplay.mode = 'battle';
      this.currentGameReplay.battleMode = bMode;
      this.currentGameReplay.oppTimeline = [];
      this.currentGameReplay.opponentName = (role === 1 ? '상대 (Guest)' : '상대 (Host)');
    }
    this.showToast(`⚔️ 1:1 배틀 시작! (${modeKr})`);

    // 실시간 대전 데이터 동기화 루프 (500ms 간격)
    clearInterval(this.battlePollInterval);
    const targetUrl = (role === 1) ? `http://${this.battleHostIp}:8888` : this.battleHostUrl;

    let consecutivePollErrors = 0;
    let pollBusy = false;
    this.battlePollInterval = setInterval(async () => {
      if (!this.isBattle || this.isPaused || pollBusy) return;
      pollBusy = true;

      const myFilled = this.countFilledCells();
      try {
        // 내 상태 전송
        await this.battleFetch(`${targetUrl}/api/progress`, {
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
        const pResp = await this.battleFetch(`${targetUrl}/api/progress`);
        if (pResp.ok) {
          consecutivePollErrors = 0;
          const pData = await pResp.json();
          const oppData = (role === 1) ? pData.p2 : pData.p1;
          if (pData.status === 'ended') {
            if (oppData && (oppData.resigned || oppData.forfeit)) {
              this.closeForfeitModal();
              this.handleBattleEnd(true, '상대방이 게임을 기권했습니다! 당신의 승리! 🏆');
              return;
            }
          }
          if (oppData) {
            if (oppData.resigned || oppData.forfeit) {
              this.closeForfeitModal();
              this.handleBattleEnd(true, '상대방이 게임을 기권했습니다! 당신의 승리! 🏆');
              return;
            }
            if (oppData.filled !== undefined) {
              this.updateOpponentProgress(oppData);
            }
          }
        } else {
          consecutivePollErrors++;
        }
      } catch (e) {
        consecutivePollErrors++;
        if (consecutivePollErrors >= 3 && this.isBattle) {
          this.closeForfeitModal();
          this.handleBattleEnd(true, '상대방과의 연결이 끊어졌거나 방을 나갔습니다! 당신의 승리! 🏆');
        }
      }
      finally { pollBusy = false; }
    }, 600);
  }

  promptBattleForfeit() {
    if (!this.isBattle) return;
    this.openForfeitModal();
  }

  async forfeitBattle() {
    if (!this.isBattle) return;
    this.closeForfeitModal();

    // 상대방이 이미 기권했거나 게임이 끝난 상태라면 패배 처리 방지!
    if (this.oppState && (this.oppState.resigned || this.oppState.forfeit)) {
      this.handleBattleEnd(true, '상대방이 먼저 게임을 기권했습니다! 당신의 승리! 🏆');
      return;
    }

    const role = this.battleRole;
    const targetUrl = (role === 1) ? `http://${this.battleHostIp}:8888` : this.battleHostUrl;

    try {
      await fetch(`${targetUrl}/api/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: role,
          filled: this.countFilledCells(),
          score: this.score,
          mistakes: this.mistakes,
          resigned: true,
          forfeit: true,
          isWin: false
        })
      });
      await fetch(`${targetUrl}/api/end`, { method: 'POST' }).catch(() => {});
    } catch (e) {}

    setTimeout(() => {
      this.handleBattleEnd(false, '게임을 기권했습니다. 상대방의 승리로 종료되었습니다.');
    }, 100);
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

    // 상대방 타임라인 기록 (리플레이 실시간 상대 진행 동기화용)
    if (this.currentGameReplay && this.currentGameReplay.oppTimeline) {
      this.currentGameReplay.oppTimeline.push({
        step: (this.currentGameReplay.moves ? this.currentGameReplay.moves.length : 0),
        sec: this.timerSeconds,
        filled: opp.filled || 0,
        score: opp.score || 0,
        mistakes: opp.mistakes || 0,
        status: (opp.resigned || opp.forfeit) ? '기권' : (opp.isWin ? '완성' : '진행 중')
      });
    }

    // 상대방 기권 판정
    if (opp.resigned || opp.forfeit) {
      this.closeForfeitModal();
      this.handleBattleEnd(true, '상대방이 게임을 기권했습니다! 당신의 승리! 🏆');
      return;
    }

    // 상대방 실수 허용치 초과 탈락 판정 (설정에 따라 게임 오버 여부 및 목숨 개수 적용)
    const isBattleEliminationAllowed = this.rules.mistakeLimit &&
                                       this.rules.maxLives !== 'unlimited' &&
                                       this.rules.livesExhaustedAction === 'game_over';
    if (isBattleEliminationAllowed && opp.mistakes >= this.maxMistakes) {
      this.closeForfeitModal();
      this.handleBattleEnd(true, `상대방이 허용 실수(${this.maxMistakes}회) 초과로 탈락했습니다! 당신의 승리! 🏆`);
      return;
    }

    // 배틀 승패 판정
    if (this.battleMode === 'race') {
      if (opp.isWin) {
        this.closeForfeitModal();
        this.handleBattleEnd(false, '상대방이 먼저 수도쿠를 완성했습니다!');
      }
    }
  }

  handleBattleEnd(isVictory, reason) {
    if (!this.isBattle) return;
    this.closeForfeitModal();
    this.stopTimer();
    clearInterval(this.battlePollInterval);
    if (this.currentGameReplay) {
      this.currentGameReplay.oppFinalScore = this.oppState.score || 0;
      this.currentGameReplay.oppFinalFilled = this.oppState.filled || 0;
      this.currentGameReplay.oppFinalMistakes = this.oppState.mistakes || 0;
      this.currentGameReplay.oppFinalStatus = isVictory ? '상대 패배/기권' : '상대 승리';
    }
    this.recordGameEnd(isVictory);

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
      let release = null;
      try {
        const resp = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
          headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        if (resp.ok) release = await resp.json();
      } catch (e) {}

      if (!release) {
        const resp2 = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=1`, {
          headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        if (resp2.ok) {
          const arr = await resp2.json();
          if (arr && arr.length > 0) release = arr[0];
        }
      }

      if (!release) throw new Error('API 응답 실패');
      const latestTag = (release.tag_name || '').replace(/^v/, '');

      if (this.isNewerVersion(latestTag, currentVersion)) {
        if (this.dom.homeUpdateBanner) {
          this.dom.homeUpdateBanner.classList.remove('hidden');
          if (this.dom.homeUpdateBannerTitle) {
            this.dom.homeUpdateBannerTitle.textContent = `새 버전 (v${latestTag}) 출시!`;
          }
        }

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

        // 최신 버전 업데이트 APK 설치기
        if (this.dom.btnUpdateApk) {
          this.dom.btnUpdateApk.onclick = () => {
            this.sound.play('click');
            this.dom.updateActionsNormal.classList.add('hidden');
            this.dom.updateProgressContainer.classList.remove('hidden');
            this.handleUpdateProgress(5, '최신 버전 APK 다운로드 연결 중...');

            if (window.AndroidBridge && window.AndroidBridge.downloadAndInstallApk) {
              window.AndroidBridge.downloadAndInstallApk(apkDownloadUrl);
            } else {
              window.open(apkDownloadUrl, '_system');
            }
          };
        }

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
  async startNewGame(diff = 'expert', customRng = null, mode = 'standard', existingPuzzle = null) {
    this.difficulty = diff;
    if (!this.isDaily && !this.isBattle) {
      this.selectedDifficulty = diff;
      localStorage.setItem('sumdoku_selected_diff', diff);
    }
    this.gameMode = mode;
    const diffKr = { easy: '초급', medium: '중급', hard: '고급', expert: '전문가' }[diff] || diff.toUpperCase();
    this.dom.gameDiffLabel.textContent = this.isDaily ? '일일 도전' : diffKr;
    this.updateModeDisplay();

    this.mistakes = 0;
    this.score = 0;
    this.combo = 0;
    this.hintsUsed = 0;
    this.resetCombo();
    this.dom.gameScore.textContent = '0';
    this.maxMistakes = (this.rules.maxLives === 'unlimited') ? 999999 : parseInt(this.rules.maxLives || 3, 10);
    const maxMistakesDisplay = (this.rules.maxLives === 'unlimited' || !this.rules.mistakeLimit) ? '∞' : this.maxMistakes;
    this.dom.mistakes.textContent = `0 / ${maxMistakesDisplay}`;
    this.undoStack = [];
    this.isWin = false;
    this.hintsRemaining = (this.rules.initialHints === 'unlimited') ? 999999 : parseInt(this.rules.initialHints || 3, 10);
    this.updateHintBadge();

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

    // 퍼즐 생성 또는 배틀 동일 퍼즐 로드 (생성 진행 오버레이 피드백)
    let generated = existingPuzzle;
    if (!generated) {
      this.showGeneratingOverlay(diff);
      try {
        generated = await this.generator.generateAsync(diff, customRng, (p) => {
          this.updateGeneratingProgress(p);
        });
      } finally {
        this.hideGeneratingOverlay();
      }
    }

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
        customMemo: '',
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

    const modeKr = (this.gameMode === 'timeattack') ? '타임어택' : (this.gameMode === 'battle' ? 'Wi-Fi 배틀' : '일반');
    this.showToast(`100% 연역 추론 보장! (${diffKr} · 시작 앵커 ${this.anchorCount}개 · ${modeKr})`);
  }

  updateModeDisplay() {
    if (!this.dom.gameModeTag) return;
    this.dom.gameModeTag.className = 'game-mode-tag';
    if (this.isDaily) {
      this.dom.gameModeTag.textContent = '📅 일일 도전';
      this.dom.gameModeTag.classList.add('mode-daily');
    } else if (this.gameMode === 'timeattack') {
      this.dom.gameModeTag.textContent = '⏳ 타임어택';
      this.dom.gameModeTag.classList.add('mode-timeattack');
    } else if (this.gameMode === 'battle') {
      this.dom.gameModeTag.textContent = '⚔️ 배틀';
      this.dom.gameModeTag.classList.add('mode-battle');
    } else {
      this.dom.gameModeTag.textContent = '⏱️ 일반 모드';
      this.dom.gameModeTag.classList.add('mode-standard');
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

        // 270도 오목(Concave) 꺾임 코너 점선 연결
        const addConcave = (dir) => {
          const corner = document.createElement('span');
          corner.className = `cage-concave-corner ${dir}`;
          cellEl.appendChild(corner);
        };
        if (!isBottomDiff && !isRightDiff && (r < 8 && c < 8 && this.cellCageMap[`${r + 1},${c + 1}`] !== myCageIdx)) {
          addConcave('concave-br');
        }
        if (!isBottomDiff && !isLeftDiff && (r < 8 && c > 0 && this.cellCageMap[`${r + 1},${c - 1}`] !== myCageIdx)) {
          addConcave('concave-bl');
        }
        if (!isTopDiff && !isRightDiff && (r > 0 && c < 8 && this.cellCageMap[`${r - 1},${c + 1}`] !== myCageIdx)) {
          addConcave('concave-tr');
        }
        if (!isTopDiff && !isLeftDiff && (r > 0 && c > 0 && this.cellCageMap[`${r - 1},${c - 1}`] !== myCageIdx)) {
          addConcave('concave-tl');
        }

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

        const customMemoEl = document.createElement('div');
        customMemoEl.className = 'cell-custom-memo';
        customMemoEl.style.display = 'none';
        cellEl.appendChild(customMemoEl);

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
        const memoEl = cellEl.querySelector('.cell-custom-memo');

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

        if (memoEl) {
          if (cellData.customMemo && cellData.customMemo.trim().length > 0) {
            memoEl.textContent = cellData.customMemo;
            memoEl.style.display = 'block';
          } else {
            memoEl.textContent = '';
            memoEl.style.display = 'none';
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

    // 케이지 다중 합계 모드일 때 클릭한 칸의 케이지 토글 선택
    if (this.isMultiCageMode) {
      const cageIdx = this.cellCageMap[`${r},${c}`];
      if (cageIdx !== undefined) {
        if (this.selectedCages.has(cageIdx)) {
          this.selectedCages.delete(cageIdx);
        } else {
          this.selectedCages.add(cageIdx);
        }
        this.updateMultiCageCalculation();
      }
    }

    this.updateHighlights();
    this.updateTabletCageHelper(r, c);
  }

  // ----------------- 점수 가감 인터랙션 애니메이션 표시 -----------------
  showScoreDelta(delta, r, c, extraText = '') {
    if (r === undefined || c === undefined || r < 0 || c < 0 || r > 8 || c > 8) return;
    const cellEl = this.getCellElement(r, c);
    if (!cellEl) return;

    const deltaEl = document.createElement('div');
    const isPlus = delta >= 0;
    deltaEl.className = `floating-score-delta ${isPlus ? 'score-plus' : 'score-minus'}`;
    const sign = isPlus ? `+${delta}` : `${delta}`;
    deltaEl.textContent = extraText ? `${sign} ${extraText}` : sign;
    cellEl.appendChild(deltaEl);

    setTimeout(() => {
      if (deltaEl.parentNode) {
        deltaEl.parentNode.removeChild(deltaEl);
      }
    }, 1150);
  }

  // ----------------- 자유 메모장 (Scratchpad) 시스템 -----------------
  toggleScratchpad() {
    this.sound.play('click');
    if (!this.dom.scratchpadDrawer) return;
    const isHidden = this.dom.scratchpadDrawer.classList.contains('hidden');
    if (isHidden) {
      this.openScratchpad();
    } else {
      this.closeScratchpad();
    }
  }

  openScratchpad() {
    if (!this.dom.scratchpadDrawer) return;
    this.dom.scratchpadDrawer.classList.remove('hidden');
    if (this.dom.btnScratchpad) this.dom.btnScratchpad.classList.add('active');
    if (this.dom.scratchpadInput) {
      this.dom.scratchpadInput.value = this.scratchpadText || '';
      setTimeout(() => this.dom.scratchpadInput.focus(), 60);
    }
    this.updateScratchpadBadge();
  }

  closeScratchpad() {
    if (!this.dom.scratchpadDrawer) return;
    this.dom.scratchpadDrawer.classList.add('hidden');
    if (this.dom.btnScratchpad) this.dom.btnScratchpad.classList.remove('active');
    if (this.dom.scratchpadInput) {
      this.scratchpadText = this.dom.scratchpadInput.value;
      localStorage.setItem('sumdoku_scratchpad', this.scratchpadText);
      this.dom.scratchpadInput.blur();
    }
    this.updateScratchpadBadge();
  }

  updateScratchpadBadge() {
    if (this.dom.scratchpadBadge) {
      this.dom.scratchpadBadge.style.display = (this.scratchpadText && this.scratchpadText.trim().length > 0) ? 'inline-block' : 'none';
    }
  }

  // ----------------- 합계 영역(케이지) 다중 선택 & 총합 계산기 -----------------
  toggleMultiCageMode() {
    this.sound.play('click');
    this.isMultiCageMode = !this.isMultiCageMode;

    if (this.isMultiCageMode) {
      // 현재 선택된 칸이 속한 케이지를 1차로 자동 추가
      if (this.selected.r >= 0 && this.selected.c >= 0) {
        const cIdx = this.cellCageMap[`${this.selected.r},${this.selected.c}`];
        if (cIdx !== undefined) {
          this.selectedCages.add(cIdx);
        }
      }
      if (this.dom.btnCageMultiCalc) this.dom.btnCageMultiCalc.classList.add('active');
      if (this.dom.btnAssistantMultiToggle) this.dom.btnAssistantMultiToggle.classList.add('active');
      if (this.dom.multiCageBanner) this.dom.multiCageBanner.classList.remove('hidden');
      if (this.dom.assistantMultiPanel) this.dom.assistantMultiPanel.classList.remove('hidden');
      if (this.dom.assistantMetricsSingle) this.dom.assistantMetricsSingle.classList.add('hidden');
    } else {
      this.resetMultiCageSelection();
      if (this.dom.btnCageMultiCalc) this.dom.btnCageMultiCalc.classList.remove('active');
      if (this.dom.btnAssistantMultiToggle) this.dom.btnAssistantMultiToggle.classList.remove('active');
      if (this.dom.multiCageBanner) this.dom.multiCageBanner.classList.add('hidden');
      if (this.dom.assistantMultiPanel) this.dom.assistantMultiPanel.classList.add('hidden');
      if (this.dom.assistantMetricsSingle) this.dom.assistantMetricsSingle.classList.remove('hidden');
    }

    this.updateMultiCageCalculation();
    this.updateHighlights();
  }

  resetMultiCageSelection() {
    this.selectedCages.clear();
    this.updateMultiCageCalculation();
    this.updateHighlights();
  }

  updateMultiCageCalculation() {
    if (!this.cages || this.cages.length === 0) return;
    const cageList = Array.from(this.selectedCages).map(idx => this.cages[idx]).filter(Boolean);
    const count = cageList.length;

    let totalSum = 0;
    let totalCells = 0;
    const sumList = [];

    cageList.forEach(cg => {
      totalSum += cg.sum;
      totalCells += cg.cells.length;
      sumList.push(cg.sum);
    });

    const formulaStr = sumList.length > 0 ? `${sumList.join(' + ')} = ${totalSum}` : '선택 없음';

    if (this.dom.mcBannerText) {
      if (count === 0) {
        this.dom.mcBannerText.textContent = '영역 터치 시 합산';
      } else {
        const diff45 = totalSum - 45;
        const diffText = (totalCells === 9 || totalCells === 18 || totalCells === 27)
          ? ` (45제약: ${diff45 >= 0 ? '+' : ''}${diff45})`
          : '';
        this.dom.mcBannerText.textContent = `합계: ${totalSum} (${totalCells}칸 · ${count}영역)${diffText}`;
      }
    }

    if (this.dom.assistantMultiTotal) this.dom.assistantMultiTotal.textContent = totalSum;
    if (this.dom.assistantMultiCells) this.dom.assistantMultiCells.textContent = `${totalCells}칸 (${count}개 영역)`;
    if (this.dom.assistantMultiFormula) this.dom.assistantMultiFormula.textContent = formulaStr;
  }

  toggleNoteInSelected(num) {
    if (this.selected.r < 0 || this.selected.c < 0) return;
    const cellData = this.board[this.selected.r][this.selected.c];
    if (cellData.val > 0) return;
    this.saveSnapshot();
    if (this.combo > 0) {
      this.resetCombo('메모 작성으로 콤보 리셋');
    }
    if (cellData.notes.has(num)) {
      cellData.notes.delete(num);
    } else {
      cellData.notes.add(num);
    }
    this.updateBoardDisplay();
    this.sound.play('click');
  }

  updateHighlights() {
    const { r: selR, c: selC } = this.selected;
    const selCellData = (this.board[selR] && this.board[selR][selC]) ? this.board[selR][selC] : null;
    const selVal = selCellData ? selCellData.val : 0;
    const selCageIdx = this.cellCageMap[`${selR},${selC}`];
    const selBoxR = Math.floor(selR / 3), selBoxC = Math.floor(selC / 3);

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cellEl = this.getCellElement(r, c);
        const cellData = this.board[r][c];
        const cageIdx = this.cellCageMap[`${r},${c}`];
        const boxR = Math.floor(r / 3), boxC = Math.floor(c / 3);

        cellEl.classList.remove('selected', 'highlight-crosshair', 'highlight-cage', 'highlight-same-num', 'highlight-multi-cage');

        // 케이지 다중 계산 모드 선택 하이라이트
        if (this.isMultiCageMode && cageIdx !== undefined && this.selectedCages.has(cageIdx)) {
          cellEl.classList.add('highlight-multi-cage');
        }

        if (r === selR && c === selC) {
          cellEl.classList.add('selected');
        } else {
          if (this.settings.highlightCross && (r === selR || c === selC || (boxR === selBoxR && boxC === selBoxC))) {
            cellEl.classList.add('highlight-crosshair');
          }
          if (cageIdx === selCageIdx && !this.isMultiCageMode) {
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
        customMemo: cell.customMemo || '',
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
        if (this.combo > 0) {
          this.resetCombo('메모 작성으로 콤보 리셋');
        }
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
          this.resetCombo('오답 입력으로 콤보 리셋');
          this.score = Math.max(0, this.score - 50);
          this.showScoreDelta(-50, r, c);
          this.dom.gameScore.textContent = this.score;

          this.mistakes++;
          const maxMistakesDisplay = (this.rules.maxLives === 'unlimited' || !this.rules.mistakeLimit) ? '∞' : this.maxMistakes;
          this.dom.mistakes.textContent = `${this.mistakes} / ${maxMistakesDisplay}`;

          if (this.settings.autoCheck) {
            this.showToast(`잘못된 숫자입니다! (-50점)`);
          }

          // 목숨 소진 및 게임 오버 판정 (일반 모드 및 배틀 모드 둘 다 설정 적용)
          const isGameOverAllowed = this.rules.mistakeLimit &&
                                    this.rules.maxLives !== 'unlimited' &&
                                    this.rules.livesExhaustedAction === 'game_over';

          if (isGameOverAllowed && this.mistakes >= this.maxMistakes) {
            if (this.isBattle) {
              this.handleBattleEnd(false, `허용 목숨(${this.maxMistakes}회)을 모두 소진하여 탈락했습니다!`);
            } else {
              this.handleGameOver();
            }
            return;
          }
        } else {
          this.sound.play('correct');
          cellData.error = false;
          this.combo++;
          this.startComboTimer();

          // 다단계 콤보 배율 체계 (빠르게 연달아 맞출수록 점수 대폭 상승)
          let comboMultiplier = 1.0;
          if (this.combo === 1) comboMultiplier = 1.0;
          else if (this.combo === 2) comboMultiplier = 1.2;
          else if (this.combo <= 4) comboMultiplier = 1.6;
          else if (this.combo <= 6) comboMultiplier = 2.4;
          else if (this.combo <= 8) comboMultiplier = 3.6;
          else comboMultiplier = 5.0; // 9콤보 이상 최대 5.0배

          const basePoints = Math.round(100 * comboMultiplier);
          this.score += basePoints;
          this.showScoreDelta(basePoints, r, c, this.combo > 1 ? `(콤보 x${comboMultiplier})` : '');

          // 케이지 완성 보너스 (+cage.sum * 15 + 콤보 시너지)
          const myCageIdx = this.cellCageMap[`${r},${c}`];
          const cage = this.cages[myCageIdx];
          const isCageComplete = cage && cage.cells.every(([cr, cc]) => this.board[cr][cc].val === this.solution[cr][cc]);
          if (isCageComplete) {
            const cageBonus = Math.round(cage.sum * 15 * (1 + (this.combo > 3 ? 0.25 : 0)));
            this.score += cageBonus;
            setTimeout(() => this.showScoreDelta(cageBonus, r, c, '케이지 완성!'), 200);
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

    if (cellData.val > 0 || cellData.notes.size > 0 || (cellData.customMemo && cellData.customMemo.length > 0)) {
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
      cellData.customMemo = '';
      cellData.error = false;
      this.updateBoardDisplay();
      this.updateKeypadBadges();
      this.updateTabletCageHelper(r, c);
      this.updateDirectTypingInput();
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
        customMemo: cell.customMemo || '',
        isGiven: cell.isGiven,
        error: cell.error
      }))
    );
    this.updateBoardDisplay();
    this.updateKeypadBadges();
    this.updateTabletCageHelper(this.selected.r, this.selected.c);
    this.updateDirectTypingInput();
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

  updateHintBadge() {
    if (!this.dom.hintBadge) return;
    if (this.rules.initialHints === 'unlimited') {
      this.dom.hintBadge.textContent = '∞';
      this.dom.hintBadge.classList.remove('badge-extra', 'badge-empty');
    } else if (this.hintsRemaining > 0) {
      this.dom.hintBadge.textContent = this.hintsRemaining;
      this.dom.hintBadge.classList.remove('badge-extra', 'badge-empty');
    } else {
      if (this.rules.hintExhaustedAction === 'disallow') {
        this.dom.hintBadge.textContent = '0';
        this.dom.hintBadge.classList.remove('badge-extra');
        this.dom.hintBadge.classList.add('badge-empty');
      } else {
        // 0개 소진 상태에서도 추가 힌트 가능하도록 '+' 표시
        this.dom.hintBadge.textContent = '+';
        this.dom.hintBadge.classList.remove('badge-empty');
        this.dom.hintBadge.classList.add('badge-extra');
      }
    }
  }

  useHint() {
    if (this.currentView !== 'game' || this.isPaused) return;
    if (this.hintsRemaining <= 0 && this.rules.initialHints !== 'unlimited' && this.rules.hintExhaustedAction === 'disallow') {
      this.sound.play('error');
      this.showToast('남은 힌트가 없습니다 (힌트 소진 시 추가 사용 금지 설정)');
      return;
    }
    const { r, c } = this.selected;
    if (this.board[r][c].val === 0) {
      this.sound.play('correct');
      this.saveSnapshot();
      this.hintsUsed = (this.hintsUsed || 0) + 1;
      this.resetCombo('힌트 사용으로 콤보 리셋');
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

      let hintMsg = '';
      if (this.rules.initialHints === 'unlimited') {
        this.score = Math.max(0, this.score - 30);
        this.showScoreDelta(-30, r, c, '힌트');
        hintMsg = `[힌트] 케이지 합계 제약으로 ${answer} 확정! (무제한 힌트, -30점)`;
      } else if (this.hintsRemaining > 0) {
        this.hintsRemaining--;
        this.score = Math.max(0, this.score - 30);
        this.showScoreDelta(-30, r, c, '힌트');
        hintMsg = `[힌트] 케이지 합계 제약으로 ${answer} 확정! (남은 힌트: ${this.hintsRemaining}개, -30점)`;
      } else {
        // 0개 상태에서도 추가 힌트 제공 ("0점에서 더 주는 것도 가능하게")
        this.score = Math.max(0, this.score - 50);
        this.showScoreDelta(-50, r, c, '추가 힌트');
        hintMsg = `[추가 힌트] 케이지 제약으로 ${answer} 확정! (보너스 힌트 제공, -50점)`;
      }
      this.updateHintBadge();
      this.dom.gameScore.textContent = this.score;

      if (this.settings.autoNotes) {
        this.autoClearNotes(r, c, answer);
      }
      this.updateBoardDisplay();
      this.updateKeypadBadges();
      this.updateTabletCageHelper(r, c);
      this.showToast(hintMsg);
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

    // 타임어택 보너스 또는 정밀 스피드런 보너스 계산
    if (this.gameMode === 'timeattack') {
      const timeBonus = this.timeRemaining * 10;
      this.score += timeBonus;
    } else {
      // 15분(900초) 기준 초 단위 스피드런 보너스 + 5분 이내 보너스
      const speedBonus = Math.max(0, Math.floor((900 - this.timerSeconds) * 4));
      this.score += speedBonus;
      if (this.timerSeconds < 300) this.score += 500;
    }

    // 실수 0회 퍼펙트 보너스
    if (this.mistakes === 0) {
      this.score += 1500;
      this.showToast('🏆 실수 0회! 퍼펙트 클리어 (+1,500점)');
    }

    // 노힌트 보너스
    if (this.hintsUsed === 0) {
      this.score += 1000;
      this.showToast('🧠 노힌트 연역 마스터 (+1,000점)');
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

    if (this.isBattle) {
      const role = this.battleRole;
      const targetUrl = (role === 1) ? `http://${this.battleHostIp}:8888` : this.battleHostUrl;
      try {
        fetch(`${targetUrl}/api/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player: role,
            filled: this.countFilledCells(),
            score: this.score,
            mistakes: this.mistakes,
            resigned: false,
            forfeit: false,
            isWin: false
          })
        }).catch(() => {});
      } catch (e) {}
      this.handleBattleEnd(false, `허용 실수(${this.maxMistakes}회) 초과로 탈락했습니다! 패배!`);
      return;
    }

    this.recordGameEnd(false);
    this.clearOngoingGame();

    setTimeout(() => {
      const diffKr = { easy: '초급', medium: '중급', hard: '고급', expert: '전문가' }[this.difficulty] || this.difficulty;
      const isUnlimited = this.rules.maxLives === 'unlimited' || !this.rules.mistakeLimit;
      const maxDisplay = isUnlimited ? '∞' : this.maxMistakes;
      const mistakeTitle = isUnlimited ? '실수' : `${this.maxMistakes}회 실수`;
      const mistakeSub = isUnlimited
        ? '허용된 실수를 초과했습니다. 다시 도전해 보세요!'
        : `허용된 실수 횟수(${this.maxMistakes}회)를 모두 초과했습니다. 다시 도전해 보세요!`;

      this.showGameResultModal({
        status: 'fail',
        title: `게임 오버 (${mistakeTitle})`,
        sub: mistakeSub,
        score: this.score,
        time: this.dom.timer.textContent,
        mistakes: `${this.mistakes} / ${maxDisplay} (초과)`,
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
        if (Array.isArray(parsed)) {
          // 가짜 목/샘플 데이터 필터링 (r.id === 'sample-1' 또는 24수 t=7 더미)
          const filtered = parsed.filter(r => {
            if (!r || !Array.isArray(r.moves) || !Array.isArray(r.solution) || !Array.isArray(r.cages)) return false;
            if (r.id === 'sample-1' || r.id === 'sample-2' || r.isSample || r.isMock) return false;
            if (r.moves.length === 24 && r.moves[0] && r.moves[0].t === 7) return false;
            return true;
          });
          if (filtered.length !== parsed.length) {
            localStorage.setItem('sumdoku_replays', JSON.stringify(filtered));
          }
          return filtered;
        }
      }
    } catch (e) {}
    return [];
  }

  saveReplay(replay) {
    if (!replay || !replay.moves || replay.moves.length === 0) return;
    try {
      // 용량 최적화: cellCageMap은 replay.cages에서 뷰어가 즉시 동적 생성하므로 저장 시 제외
      const cleanReplay = Object.assign({}, replay);
      delete cleanReplay.cellCageMap;

      let replays = this.loadReplays();
      replays = replays.filter(r => r.id !== cleanReplay.id);
      replays.unshift(cleanReplay);
      if (replays.length > 20) replays = replays.slice(0, 20);

      // QuotaExceeded 방지 및 보장 루프
      let saved = false;
      while (replays.length > 0 && !saved) {
        try {
          localStorage.setItem('sumdoku_replays', JSON.stringify(replays));
          saved = true;
        } catch (err) {
          if (replays.length > 1) {
            replays.pop();
          } else {
            break;
          }
        }
      }
      this.replays = replays;
      this.renderReplayList();
      this.syncPersistentBackup();
    } catch (e) {
      console.error('Failed to save replay:', e);
    }
  }

  renderReplayList() {
    const container = document.getElementById('replay-list-container');
    if (!container) return;
    container.innerHTML = '';

    const list = this.replays || this.loadReplays();
    if (!list || list.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; padding: 48px 20px; text-align: center; color: var(--text-muted); font-weight: 600; line-height: 1.7;">
          <div style="font-size: 38px; margin-bottom: 12px;">🎬</div>
          <div style="font-size: 16px; color: var(--text-main); margin-bottom: 6px;">아직 저장된 리플레이가 없습니다</div>
          <div style="font-size: 13px;">퍼즐을 클리어하거나 게임을 종료하면 최근 20판의 수순이 이곳에 자동으로 기록됩니다!</div>
        </div>
      `;
      return;
    }

    const diffKr = { easy: '초급', medium: '중급', hard: '고급', expert: '전문가' };

    list.forEach(rep => {
      const card = document.createElement('div');
      const isWin = rep.result === 'win';
      const isBattle = rep.mode === 'battle';
      const dLabel = diffKr[rep.difficulty] || rep.difficulty;

      let modeBadge = '';
      if (isBattle) {
        const bModeKr = { race: '스피드 레이스', score: '점수전', survival: '서바이벌' }[rep.battleMode] || '배틀';
        modeBadge = `<span class="replay-mode-badge battle">⚔️ 1:1 배틀 (${bModeKr})</span>`;
      } else if (rep.mode === 'timeattack') {
        modeBadge = `<span class="replay-mode-badge single">⚡ 타임어택</span>`;
      } else {
        modeBadge = `<span class="replay-mode-badge single">🧩 싱글</span>`;
      }

      let oppSummary = '';
      if (isBattle && rep.oppFinalScore !== undefined) {
        oppSummary = `<div style="font-size: 0.76rem; color: var(--text-secondary); margin: 3px 0 6px 0;">
          ⚔️ vs 상대: ${rep.oppFinalFilled || 0}/81칸 (${Number(rep.oppFinalScore).toLocaleString()}점, 실수 ${rep.oppFinalMistakes || 0}회)
        </div>`;
      }

      card.className = `replay-card ${isBattle ? 'battle-card' : ''}`;
      card.innerHTML = `
        <div class="replay-card-top">
          <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
            ${modeBadge}
            <span class="replay-diff-badge ${rep.difficulty}">${dLabel}</span>
          </div>
          <span class="replay-result-tag ${isWin ? 'win' : 'fail'}">${isWin ? '🏆 승리/클리어' : '💔 패배/실패'}</span>
        </div>
        <div class="replay-card-meta">
          <span>📅 ${rep.date}</span>
          <span>수순: <strong>${rep.moves ? rep.moves.length : 0}수</strong></span>
        </div>
        ${oppSummary}
        <div class="replay-card-footer">
          <span style="font-weight: 800; color: #2563eb;">${Number(rep.finalScore || 0).toLocaleString()}점 · ⏱️ ${rep.finalTime || '00:00'}</span>
          <button class="replay-play-btn">리플레이 보기 ▶</button>
        </div>
      `;

      // 카드 전체 클릭 및 리플레이 보기 버튼 클릭 모두 지원
      const playBtn = card.querySelector('.replay-play-btn');
      if (playBtn) {
        playBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.sound.play('click');
          this.openReplayViewer(rep);
        });
      }

      card.addEventListener('click', () => {
        this.sound.play('click');
        this.openReplayViewer(rep);
      });

      container.appendChild(card);
    });
  }

  openReplayViewer(replay) {
    if (!replay) return;
    this.activeReplay = replay;
    this.replayStep = 0;
    this.replaySpeed = 1;
    document.querySelectorAll('.btn-speed').forEach(b => {
      b.classList.toggle('active', b.dataset.speed === '1');
    });
    this.pauseReplayPlay();

    const diffKr = { easy: '초급', medium: '중급', hard: '고급', expert: '전문가' };
    const dLabel = diffKr[replay.difficulty] || replay.difficulty || '일반';
    const isBattle = replay.mode === 'battle';

    if (this.dom.replayMetaTitle) {
      const modePrefix = isBattle ? '⚔️ [배틀] ' : '';
      this.dom.replayMetaTitle.textContent = `${modePrefix}[${dLabel}] ${replay.result === 'win' ? '완벽 클리어' : '도전'} 리플레이`;
    }
    if (this.dom.replayMetaSub) {
      const scoreTxt = Number(replay.finalScore || 0).toLocaleString();
      const timeTxt = replay.finalTime || '00:00';
      const dateTxt = replay.date || '';
      const mistakesCount = replay.mistakes || 0;
      this.dom.replayMetaSub.textContent = `${dateTxt} · 최종 ${scoreTxt}점 · 소요 ${timeTxt} · 실수 ${mistakesCount}회`;
    }

    if (this.dom.replayBattleOppPanel) {
      if (isBattle) {
        this.dom.replayBattleOppPanel.classList.remove('hidden');
        if (this.dom.replayOppTitle) {
          this.dom.replayOppTitle.textContent = `⚔️ ${replay.opponentName || '1:1 대전 상대'} 실시간 진행 동기화`;
        }
      } else {
        this.dom.replayBattleOppPanel.classList.add('hidden');
      }
    }

    const movesCount = (replay.moves && replay.moves.length) || 0;
    if (this.dom.replayTimeline) {
      this.dom.replayTimeline.min = 0;
      this.dom.replayTimeline.max = movesCount;
      this.dom.replayTimeline.value = 0;
    }

    this.renderReplayBoardShell(replay);
    this.applyReplayStep(0);

    if (this.dom.modalReplayViewer) {
      this.dom.modalReplayViewer.classList.remove('hidden');
      this.dom.modalReplayViewer.style.display = 'flex';
    }
  }

  closeReplayViewer() {
    this.pauseReplayPlay();
    if (this.dom.modalReplayViewer) {
      this.dom.modalReplayViewer.classList.add('hidden');
      this.dom.modalReplayViewer.style.display = 'none';
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

          // 270도 오목(Concave) 꺾임 코너 점선 연결
          const addConcave = (dir) => {
            const corner = document.createElement('span');
            corner.className = `cage-concave-corner ${dir}`;
            cell.appendChild(corner);
          };
          if (!isBot && !isRgt && (r < 8 && c < 8 && cellCageMap[`${r + 1},${c + 1}`] !== cIdx)) {
            addConcave('concave-br');
          }
          if (!isBot && !isLft && (r < 8 && c > 0 && cellCageMap[`${r + 1},${c - 1}`] !== cIdx)) {
            addConcave('concave-bl');
          }
          if (!isTop && !isRgt && (r > 0 && c < 8 && cellCageMap[`${r - 1},${c + 1}`] !== cIdx)) {
            addConcave('concave-tr');
          }
          if (!isTop && !isLft && (r > 0 && c > 0 && cellCageMap[`${r - 1},${c - 1}`] !== cIdx)) {
            addConcave('concave-tl');
          }

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

        const notesEl = document.createElement('div');
        notesEl.className = 'cell-notes';
        for (let n = 1; n <= 9; n++) {
          const sp = document.createElement('span');
          sp.className = 'note-num';
          sp.dataset.note = n;
          notesEl.appendChild(sp);
        }
        cell.appendChild(notesEl);

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
    const cellNotes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
    let lastMove = null;

    for (let i = 0; i < targetStep; i++) {
      const m = replay.moves[i];
      if (m.isPencil) {
        if (cellNotes[m.r][m.c].has(m.num)) {
          cellNotes[m.r][m.c].delete(m.num);
        } else {
          cellNotes[m.r][m.c].add(m.num);
        }
      } else if (m.type === 'erase') {
        cellValues[m.r][m.c] = 0;
        cellNotes[m.r][m.c].clear();
      } else {
        cellValues[m.r][m.c] = m.num;
        cellNotes[m.r][m.c].clear();
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
            const notesEl = cellEl.querySelector('.cell-notes');
            const v = cellValues[r][c];
            const notes = cellNotes[r][c];

            cellEl.classList.remove('selected', 'error', 'user-input');

            if (v > 0) {
              if (valSpan) valSpan.textContent = v;
              if (notesEl) notesEl.style.display = 'none';
              cellEl.classList.add('user-input');
            } else {
              if (valSpan) valSpan.textContent = '';
              if (notesEl) {
                notesEl.style.display = 'grid';
                for (let n = 1; n <= 9; n++) {
                  const sp = notesEl.querySelector(`[data-note="${n}"]`);
                  if (sp) sp.textContent = notes.has(n) ? n : '';
                }
              }
            }

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

    // 배틀 모드 리플레이 상대방 실시간 동시 진행 동기화
    if (replay.mode === 'battle' && this.dom.replayBattleOppPanel) {
      const oppTimeline = replay.oppTimeline || [];
      if (oppTimeline.length > 0) {
        let curSnap = oppTimeline[0];
        for (const snap of oppTimeline) {
          if (snap.step <= targetStep) {
            curSnap = snap;
          } else {
            break;
          }
        }
        if (this.dom.replayOppCells) this.dom.replayOppCells.textContent = `${curSnap.filled} / 81`;
        if (this.dom.replayOppScore) this.dom.replayOppScore.textContent = `${Number(curSnap.score || 0).toLocaleString()}점`;
        if (this.dom.replayOppMistakes) this.dom.replayOppMistakes.textContent = `${curSnap.mistakes || 0}회`;
        if (this.dom.replayOppStatus) this.dom.replayOppStatus.textContent = curSnap.status || '진행 중';
        if (this.dom.replayOppBarFill) {
          const oppPct = Math.min(100, Math.round((curSnap.filled / 81) * 100));
          this.dom.replayOppBarFill.style.width = `${oppPct}%`;
        }
      } else if (replay.oppFinalScore !== undefined) {
        if (this.dom.replayOppCells) this.dom.replayOppCells.textContent = `${replay.oppFinalFilled || 0} / 81`;
        if (this.dom.replayOppScore) this.dom.replayOppScore.textContent = `${Number(replay.oppFinalScore).toLocaleString()}점`;
        if (this.dom.replayOppMistakes) this.dom.replayOppMistakes.textContent = `${replay.oppFinalMistakes || 0}회`;
        if (this.dom.replayOppStatus) this.dom.replayOppStatus.textContent = replay.oppFinalStatus || '종료';
        if (this.dom.replayOppBarFill) {
          const oppPct = Math.min(100, Math.round(((replay.oppFinalFilled || 0) / 81) * 100));
          this.dom.replayOppBarFill.style.width = `${oppPct}%`;
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
    if (this.dom.btnReplayPlay) {
      this.dom.btnReplayPlay.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1.5"/><rect x="14" y="4" width="4" height="16" rx="1.5"/></svg>';
    }

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
    if (this.dom.btnReplayPlay) {
      this.dom.btnReplayPlay.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="7,4 20,12 7,20"/></svg>';
    }
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

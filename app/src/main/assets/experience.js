'use strict';

// A full IPv4 address, encoded as ten decimal digits plus a two-digit checksum.
// This removes the old assumption that both devices share the first three octets.
const RoomCode = {
  encode(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4 || parts.some(p => !/^\d{1,3}$/.test(p) || +p > 255)) throw new Error('IPv4 주소를 확인해 주세요.');
    const value = parts.reduce((n, p) => n * 256 + Number(p), 0);
    return String(value).padStart(10, '0') + String(value % 97).padStart(2, '0');
  },
  decode(code) {
    code = code.replace(/[\s-]/g, '');
    if (!/^\d{12}$/.test(code)) throw new Error('12자리 숫자 코드를 입력해 주세요.');
    const value = Number(code.slice(0, 10));
    if (value > 4294967295 || value % 97 !== Number(code.slice(10))) throw new Error('숫자 코드가 올바르지 않습니다.');
    return [24, 16, 8, 0].map(shift => Math.floor(value / 2 ** shift) % 256).join('.');
  }
};

const RULE_FIELDS = ['mistakeLimit', 'maxLives', 'livesExhaustedAction', 'initialHints', 'hintExhaustedAction'];
function normalizedRules(settings) {
  let maxLives = String(settings.maxLives ?? '3');
  if (maxLives !== 'unlimited') {
    const num = parseInt(maxLives, 10);
    maxLives = isNaN(num) || num < 1 ? '3' : String(Math.min(999, num));
  }
  let initialHints = String(settings.initialHints ?? '3');
  if (initialHints !== 'unlimited') {
    const num = parseInt(initialHints, 10);
    initialHints = isNaN(num) || num < 0 ? '3' : String(Math.min(999, num));
  }
  return {
    mistakeLimit: settings.mistakeLimit !== false,
    maxLives,
    initialHints,
    livesExhaustedAction: settings.livesExhaustedAction === 'continue' ? 'continue' : 'game_over',
    hintExhaustedAction: settings.hintExhaustedAction === 'disallow' ? 'disallow' : 'allow_penalty'
  };
}
Object.defineProperty(SumdokuApp.prototype, 'rules', {get() { return this.gameRules || this.settings; }});

const baseBindEvents = SumdokuApp.prototype.bindEvents;
SumdokuApp.prototype.bindEvents = function() {
  baseBindEvents.call(this);
  this.installQuickSettings(document.querySelector('#modal-difficulty .modal-card'), false);
  this.installQuickSettings(this.dom.battleHostView, true);
  const create = document.createElement('button');
  create.id = 'btn-create-room'; create.className = 'btn btn-secondary'; create.textContent = '방 준비하기';
  create.onclick = () => this.prepareBattleRoom();
  this.dom.battleHostView.querySelector('.battle-ip-box').before(create);
  this.dom.btnBattleClose.addEventListener('click', () => this.cancelRoomPreparation());
  this.dom.tabBattleJoin.addEventListener('click', () => this.cancelRoomPreparation());
  this.dom.modalBattleLobby.addEventListener('keydown', e => {
    if (e.key === 'Escape') this.dom.btnBattleClose.click();
  });
  this.dom.battleInputTarget.setAttribute('autocomplete', 'off');
  this.dom.battleInputTarget.setAttribute('spellcheck', 'false');
  const guestRules = document.createElement('p');
  guestRules.id = 'guest-rules-summary'; guestRules.className = 'quick-settings-note';
  guestRules.setAttribute('aria-live', 'polite');
  this.dom.battleInputTarget.after(guestRules);
  this.dom.battleInputTarget.addEventListener('keydown', e => {
    if (e.key === 'Enter') this.connectToHost();
  });
  // Replace the original start handler (which ignored network errors).
  const old = this.dom.btnBattleStartMatch;
  const start = old.cloneNode(true); old.replaceWith(start); this.dom.btnBattleStartMatch = start;
  start.onclick = async () => {
    if (!this.battlePuzzleData || start.disabled) return;
    start.disabled = true;
    try {
      await this.battleRequest(`http://${this.battleHostIp}:8888/api/start`, {method:'POST'});
      this.dom.modalBattleLobby.classList.add('hidden');
      this.startBattleMatch(1, this.battlePuzzleData, this.battleMode);
    } catch (error) { start.disabled = false; this.showToast(error.message); }
  };
  this.installCleanIcons();
};

SumdokuApp.prototype.installQuickSettings = function(container, battle) {
  const panel = document.createElement('details'); panel.className = 'quick-settings'; panel.open = true;
  const summary = document.createElement('summary'); summary.textContent = battle ? '대전 규칙 · 두 플레이어 공통' : '시작 전 설정'; panel.append(summary);
  const grid = document.createElement('div'); grid.className = 'quick-settings-grid'; panel.append(grid);
  const fields = [
    {key:'maxLives', title:'목숨 (직접 입력)', type:'number', min:1, max:999, def:'3'},
    {key:'initialHints', title:'힌트 (직접 입력)', type:'number', min:0, max:999, def:'3'},
    {key:'livesExhaustedAction', title:'목숨 소진', type:'select', options:[['game_over','게임 종료'],['continue','감점 후 계속']]},
    {key:'hintExhaustedAction', title:'힌트 소진', type:'select', options:[['disallow','추가 사용 금지'],['allow_penalty','추가 사용 · 최대 50점 감점']]},
    {key:'autoNotes', title:'후보 메모 자동 정리', type:'select', options:[[true,'켜짐'],[false,'꺼짐']]},
    {key:'autoCheck', title:'오답 알림', type:'select', options:[[true,'켜짐'],[false,'꺼짐']]},
    {key:'sound', title:'효과음', type:'select', options:[[true,'켜짐'],[false,'꺼짐']]},
    {key:'highlightCross', title:'행·열 강조', type:'select', options:[[true,'켜짐'],[false,'꺼짐']]}
  ];
  fields.forEach(f => {
    const label = document.createElement('label'); label.textContent = f.title;
    if (f.type === 'number') {
      const input = document.createElement('input');
      input.type = 'number';
      input.dataset.quickSetting = f.key;
      input.min = f.min;
      input.max = f.max;
      input.value = String(this.settings[f.key] ?? f.def);
      const onValChange = () => {
        const val = parseInt(input.value, 10);
        const safe = isNaN(val) ? f.min : Math.max(f.min, Math.min(f.max, val));
        this.settings[f.key] = String(safe);
        if (f.key === 'maxLives') this.settings.mistakeLimit = true;
        this.saveSettings(); this.applySettings(); this.syncQuickSettings();
        if (battle && RULE_FIELDS.includes(f.key)) this.setupHostRoom();
      };
      input.oninput = onValChange;
      input.onchange = onValChange;
      label.append(input);
    } else {
      const select = document.createElement('select'); select.dataset.quickSetting = f.key;
      f.options.forEach(([value, name]) => select.add(new Option(name, String(value))));
      select.value = String(this.settings[f.key]);
      select.onchange = () => {
        this.settings[f.key] = select.value === 'true' ? true : select.value === 'false' ? false : select.value;
        if (f.key === 'maxLives') this.settings.mistakeLimit = select.value !== 'unlimited';
        this.saveSettings(); this.applySettings(); this.syncQuickSettings();
        if (battle && RULE_FIELDS.includes(f.key)) this.setupHostRoom();
      };
      label.append(select);
    }
    grid.append(label);
  });
  const note = document.createElement('p'); note.className = 'quick-settings-note';
  note.textContent = battle ? '방을 준비한 뒤 코드를 공유하세요. 규칙 변경 시 방을 다시 준비합니다. 기본 힌트는 최대 30점 감점됩니다.' : '규칙은 새 게임부터 적용됩니다. 기본 힌트는 최대 30점 감점됩니다.';
  panel.append(note);
  const before = battle ? container.querySelector('.battle-ip-box') : container.querySelector('.modal-footer');
  before.before(panel);
};
SumdokuApp.prototype.syncQuickSettings = function() {
  document.querySelectorAll('[data-quick-setting]').forEach(el => {
    const key = el.dataset.quickSetting;
    el.value = key === 'maxLives' && this.settings.mistakeLimit === false ? 'unlimited' : String(this.settings[key]);
  });
};
const baseOpenDifficulty = SumdokuApp.prototype.openDifficultyModal;
SumdokuApp.prototype.openDifficultyModal = function() {baseOpenDifficulty.call(this); this.syncQuickSettings();};

SumdokuApp.prototype.cancelRoomPreparation = function() {
  this.roomGeneration = (this.roomGeneration || 0) + 1;
  if (this.roomWorker) this.roomWorker.terminate();
  this.roomWorker = null;
  clearInterval(this.hostPollTimer); clearInterval(this.guestWaitTimer);
  this.battlePuzzleData = null;
  this.dom.btnBattleStartMatch.disabled = true;
  this.dom.btnBattleConnect.disabled = false;
  this.dom.btnBattleConnect.textContent = '방 접속하기';
  const guestRules = document.getElementById('guest-rules-summary');
  if (guestRules) guestRules.textContent = '';
  if (window.AndroidBridge?.stopBattleServer) window.AndroidBridge.stopBattleServer();
};
// Opening a lobby is now cheap: no puzzle generation, network calls, or polling.
SumdokuApp.prototype.setupHostRoom = function() {
  this.cancelRoomPreparation(); this.syncQuickSettings();
  this.dom.battleMyCode.textContent = '방 준비 전';
  this.dom.battleMyIp.textContent = '준비가 끝나면 숫자 코드가 표시됩니다.';
  this.dom.battleWaitText.textContent = '모드와 규칙을 선택하고 방을 준비하세요.';
  const create = document.getElementById('btn-create-room');
  if (create) { create.disabled = false; create.textContent = '방 준비하기'; }
};
SumdokuApp.prototype.battleRequest = async function(url, options = {}) {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {...options, signal:controller.signal});
    if (!response.ok) throw new Error('배틀 서버에 연결할 수 없습니다.');
    return await response.json();
  } finally { clearTimeout(timeout); }
};
SumdokuApp.prototype.battleFetch = async function(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {...options, signal:controller.signal});
    // Read the body inside the deadline, rather than allowing a stalled body to block the next poll.
    const body = await response.text();
    return {ok:response.ok, json:async () => JSON.parse(body)};
  } finally { clearTimeout(timeout); }
};
SumdokuApp.prototype.prepareBattleRoom = function() {
  this.cancelRoomPreparation();
  const token = this.roomGeneration, button = document.getElementById('btn-create-room');
  if (!window.AndroidBridge?.startBattleServer) {
    this.showToast('방 만들기는 Android 앱에서 지원합니다.'); return;
  }
  button.disabled = true; button.textContent = '퍼즐 준비 중…';
  this.dom.battleWaitText.textContent = '화면을 자유롭게 조작할 수 있습니다. 닫으면 준비가 취소됩니다.';
  
  const fail = message => {
    if (token !== this.roomGeneration) return;
    if (this.roomWorker) { try { this.roomWorker.terminate(); } catch (_) {} this.roomWorker = null; }
    button.disabled = false; button.textContent = '다시 준비하기'; this.dom.battleWaitText.textContent = message;
  };

  const publishRoom = puzzleData => {
    if (token !== this.roomGeneration) return;
    if (this.roomWorker) { try { this.roomWorker.terminate(); } catch (_) {} this.roomWorker = null; }
    try {
      const puzzle = {...puzzleData, difficulty:this.battleDiff || 'expert', rules:normalizedRules(this.settings)};
      const response = JSON.parse(window.AndroidBridge.startBattleServer(this.battleMode, this.battleDiff || 'expert',
        this.battleMode === 'score' ? 300 : 0, JSON.stringify(puzzle)));
      if (!response.ok) throw new Error('방을 열지 못했습니다. Wi-Fi 연결을 확인하세요.');
      this.battleRole = 1; this.battleHostIp = response.ip; this.battlePuzzleData = puzzle;
      const code = RoomCode.encode(response.ip);
      this.dom.battleMyCode.textContent = code.match(/.{4}/g).join(' ');
      this.dom.battleMyIp.textContent = `${response.ip}:8888 · 숫자 12자리로 접속`;
      this.dom.battleWaitText.textContent = '상대방 접속을 기다리는 중…';
      button.disabled = true;
      button.textContent = '방 준비 완료';
      let busy = false;
      this.hostPollTimer = setInterval(async () => {
        if (busy || token !== this.roomGeneration) return;
        busy = true;
        try {
          const status = await this.battleRequest(`http://${response.ip}:8888/api/status`);
          if (token !== this.roomGeneration) return;
          this.dom.btnBattleStartMatch.disabled = !status.guestJoined;
          if (status.guestJoined) this.dom.battleWaitText.textContent = '상대방 접속 완료 · 배틀을 시작하세요.';
        } catch (_) { if (token === this.roomGeneration) this.dom.battleWaitText.textContent = '연결 확인 중…'; }
        finally { busy = false; }
      }, 1000);
    } catch (error) { fail(error.message); }
  };

  const startMainThreadAsyncGeneration = () => {
    if (token !== this.roomGeneration) return;
    button.textContent = '퍼즐 준비 중…';
    this.generator.generateAsync(this.battleDiff || 'expert', null, progress => {
      if (token !== this.roomGeneration) return;
      if (progress && progress.attempt) button.textContent = `퍼즐 준비 중 · ${progress.attempt}회`;
    }).then(puzzle => {
      if (token !== this.roomGeneration) return;
      if (puzzle) publishRoom(puzzle);
      else fail('퍼즐 생성에 실패했습니다. 다시 시도해 주세요.');
    }).catch(err => {
      fail(err?.message || '퍼즐 생성 중 오류가 발생했습니다.');
    });
  };

  // Android WebView의 file:/// 스키마에서는 Web Worker 외부 스크립트 로딩이 기본 차단되므로 안전하게 비동기 생성기로 직행
  const isFileProtocol = window.location.protocol === 'file:';
  if (isFileProtocol || typeof Worker === 'undefined') {
    startMainThreadAsyncGeneration();
    return;
  }

  try {
    this.roomWorker = new Worker('puzzle-worker.js');
    this.roomWorker.onerror = () => {
      console.warn('Worker onerror 발생, 메인 비동기 생성기로 자동 전환합니다.');
      if (this.roomWorker) { try { this.roomWorker.terminate(); } catch (_) {} this.roomWorker = null; }
      startMainThreadAsyncGeneration();
    };
    this.roomWorker.onmessage = async ({data}) => {
      if (token !== this.roomGeneration) return;
      if (data.error) {
        console.warn('Worker 에러 발생, 메인 비동기 생성기로 자동 전환합니다:', data.error);
        if (this.roomWorker) { try { this.roomWorker.terminate(); } catch (_) {} this.roomWorker = null; }
        startMainThreadAsyncGeneration();
        return;
      }
      if (data.progress) { button.textContent = `퍼즐 검증 중 · ${data.progress.attempt}회`; return; }
      if (!data.puzzle) return;
      publishRoom(data.puzzle);
    };
    this.roomWorker.postMessage({difficulty:this.battleDiff || 'expert'});
  } catch (error) {
    console.warn('Worker 인스턴스 생성 실패, 메인 비동기 생성기로 자동 전환합니다:', error);
    startMainThreadAsyncGeneration();
  }
};

SumdokuApp.prototype.connectToHost = async function() {
  if (this.joinBusy) return;
  let target = this.dom.battleInputTarget.value.trim();
  try {
    if (/^[\d\s-]+$/.test(target) && target.replace(/[\s-]/g,'').length === 12) target = RoomCode.decode(target);
    else if (/^\d{1,3}$/.test(target)) {
      const ip = window.AndroidBridge?.getLocalIpAddress?.();
      if (!ip || +target > 254 || +target < 1) throw new Error('새 버전의 12자리 코드를 입력해 주세요.');
      target = ip.split('.').slice(0,3).concat(String(+target)).join('.');
    }
    const [ip, port = '8888'] = target.split(':');
    RoomCode.encode(ip);
    if (!/^\d{1,5}$/.test(port) || +port < 1 || +port > 65535 || target.split(':').length > 2) throw new Error('주소를 확인해 주세요.');
    this.joinBusy = true; this.dom.btnBattleConnect.disabled = true;
    this.dom.btnBattleConnect.textContent = '연결 중…';
    const token = this.roomGeneration;
    const url = `http://${ip}:${port}`;
    const result = await this.battleRequest(`${url}/api/join`, {method:'POST'});
    if (token !== this.roomGeneration) return;
    if (!result.ok) throw new Error('방 참가에 실패했습니다.');
    this.battleRole = 2; this.battleHostUrl = url;
    this.dom.btnBattleConnect.textContent = '접속 완료 · 시작 대기';
    let busy = false;
    clearInterval(this.guestWaitTimer);
    this.guestWaitTimer = setInterval(async () => {
      if (busy || token !== this.roomGeneration) return; busy = true;
      try {
        const room = await this.battleRequest(`${url}/api/room`);
        if (token !== this.roomGeneration) return;
        const rules = normalizedRules(room.puzzle?.rules || {});
        const lives = !rules.mistakeLimit || rules.maxLives === 'unlimited' ? '무제한' : rules.maxLives + '개';
        const hints = rules.initialHints === 'unlimited' ? '무제한' : rules.initialHints + '개';
        document.getElementById('guest-rules-summary').textContent =
          `방장 규칙 · 목숨 ${lives} · 힌트 ${hints} · 목숨 소진: ${rules.livesExhaustedAction === 'continue' ? '계속' : '종료'} · 힌트 소진: ${rules.hintExhaustedAction === 'disallow' ? '사용 금지' : '추가 감점'}`;
        if (room.status === 'playing') {
          clearInterval(this.guestWaitTimer); this.dom.modalBattleLobby.classList.add('hidden');
          this.startBattleMatch(2, room.puzzle, room.mode);
        }
      } catch (_) { this.dom.btnBattleConnect.textContent = '연결 확인 중…'; }
      finally { busy = false; }
    }, 700);
  } catch (error) {
    this.showToast(error.name === 'AbortError' ? '연결 시간이 초과되었습니다. Wi-Fi와 코드를 확인하세요.' : error.message);
    this.dom.btnBattleConnect.textContent = '방 접속하기'; this.dom.btnBattleConnect.disabled = false;
  } finally { this.joinBusy = false; }
};

const baseStartGame = SumdokuApp.prototype.startNewGame;
SumdokuApp.prototype.startNewGame = async function(diff, rng, mode, puzzle) {
  this.gameRules = normalizedRules(puzzle?.rules || this.settings);
  try { return await baseStartGame.call(this, diff, rng, mode, puzzle); }
  catch (error) { this.showToast(error.message); this.switchView('home'); }
};

SumdokuApp.prototype.installCleanIcons = function() {
  const icons = {
    'btn-pencil':'M4 20l4-1L20 7l-3-3L5 16z M14 7l3 3',
    'btn-hint':'M9 18h6 M10 22h4 M8 14a6 6 0 1 1 8 0l-1 3H9z',
    'btn-undo':'M8 4L3 9l5 5 M3 9h10a7 7 0 0 1 0 14',
    'btn-erase':'M3 14l9-10 9 8-8 9H9z M8 9l9 8 M13 21h8',
    'btn-scratchpad':'M6 3h12v18H6z M9 8h6 M9 12h6 M9 16h4'
  };
  for (const [id,path] of Object.entries(icons)) {
    const svg = document.querySelector(`#${id} svg`);
    if (svg) {svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('fill','none'); svg.setAttribute('stroke','currentColor'); svg.setAttribute('stroke-width','1.8'); svg.innerHTML = `<path d="${path}" stroke-linecap="round" stroke-linejoin="round"/>`;}
  }
  const homeIcons = {
    'btn-home-new':'M12 4v16 M4 12h16',
    'btn-home-continue':'M8 5l11 7-11 7z',
    'btn-home-battle':'M3 6h7v7H3z M14 11h7v7h-7z M10 9h4 M12 7l2 2-2 2',
    'btn-home-stats':'M4 20V11 M12 20V4 M20 20V8',
    'btn-home-rules':'M12 5v16 M3 4c4-1 6 0 9 1 3-1 5-2 9-1v15c-4-1-6 0-9 2-3-2-5-3-9-2z'
  };
  for (const [id,path] of Object.entries(homeIcons)) {
    const el = document.querySelector(`#${id} .btn-icon`);
    if (el) el.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="${path}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  const headers = {
    'btn-game-theme':'M12 3a9 9 0 1 0 9 9c-5 3-12-4-9-9z',
    'btn-game-settings':'M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6'
  };
  for (const [id,path] of Object.entries(headers)) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="${path}" stroke-linecap="round"/></svg>`;
  }
};

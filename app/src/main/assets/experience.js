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
  this.dom.btnBattleClose.addEventListener('click', () => {
    const wasRematch = !!this.isRematchActive;
    this.isRematchActive = false;
    this.cancelRoomPreparation();
    if (wasRematch) {
      this.dom.modalBattleLobby.classList.add('hidden');
      this.switchView('home');
    }
  });
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
  start.onclick = () => this.startBattleAsHost();
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
  this.hideGeneratingOverlay();
  const hadHostRoom = !!this.hostRoomCreated;
  this.hostRoomCreated = false;
  this.battleStarting = false;
  this.roomGeneration = (this.roomGeneration || 0) + 1;
  if (this.roomWorker) this.roomWorker.terminate();
  this.roomWorker = null;
  clearInterval(this.hostPollTimer);
  clearInterval(this.guestWaitTimer);

  // 게스트가 방을 나간 경우 서버에 즉시 /api/leave 전송
  if (this.battleRole === 2 && this.battleHostUrl) {
    try {
      fetch(`${this.battleHostUrl}/api/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: 2 })
      }).catch(() => {});
    } catch (_) {}
  }

  // 방장이 방을 나간 경우 서버에 /api/close 전송 (방 폭파)
  // Android에서는 아래 stopBattleServer()가 서버를 직접 닫습니다. HTTP /api/close는 비동기라
  // 바로 이어서 새 방을 열면 새 서버에 늦게 도착해 새 방을 '닫힘'으로 바꿔 버립니다(참가 즉시 퇴장 버그).
  if (this.battleRole === 1 && this.battleHostIp && hadHostRoom && !window.AndroidBridge?.stopBattleServer) {
    try {
      fetch(`http://${this.battleHostIp}:8888/api/close`, {
        method: 'POST'
      }).catch(() => {});
    } catch (_) {}
  }

  this.battlePuzzleData = null;
  this.hostP1Ready = false;
  this.hostP2Ready = false;
  this.guestJoined = false;
  this.guestP1Ready = false;
  this.guestP2Ready = false;
  if (this.dom.btnBattleStartMatch) this.dom.btnBattleStartMatch.disabled = true;
  if (this.dom.btnBattleConnect) {
    this.dom.btnBattleConnect.disabled = false;
    this.dom.btnBattleConnect.textContent = '방 접속하기';
  }
  if (this.dom.battleJoinInputSection) this.dom.battleJoinInputSection.classList.remove('hidden');
  if (this.dom.battleGuestRoomPanel) this.dom.battleGuestRoomPanel.classList.add('hidden');
  const guestRules = document.getElementById('guest-rules-summary');
  if (guestRules) guestRules.textContent = '';
  if (window.AndroidBridge?.stopBattleServer) window.AndroidBridge.stopBattleServer();

  // 상단 방 만들기/방 참가하기 탭 다시 보이기
  const tabs = this.dom.battleLobbyTabs || document.querySelector('.battle-lobby-tabs');
  if (tabs) tabs.classList.remove('hidden');
};

SumdokuApp.prototype.createHostRoom = function() {
  this.cancelRoomPreparation();
  this.syncQuickSettings();
  if (!window.AndroidBridge?.startBattleServer) {
    if (this.dom.battleMyCode) this.dom.battleMyCode.textContent = '앱 전용';
    if (this.dom.battleMyIp) this.dom.battleMyIp.textContent = 'Android 앱에서 방을 생성할 수 있습니다.';
    return;
  }
  try {
    const dummyPuzzle = { difficulty: this.battleDiff || 'expert', rules: normalizedRules(this.settings) };
    const response = JSON.parse(window.AndroidBridge.startBattleServer(
      this.battleMode || 'race',
      this.battleDiff || 'expert',
      this.battleMode === 'score' ? 300 : 0,
      JSON.stringify(dummyPuzzle)
    ));
    if (!response.ok) throw new Error('방을 열지 못했습니다. Wi-Fi 연결을 확인하세요.');
    this.battleRole = 1;
    this.battleHostIp = response.ip;
    this.battlePuzzleData = null;
    const code = RoomCode.encode(response.ip);
    if (this.dom.battleMyCode) this.dom.battleMyCode.textContent = code.match(/.{4}/g).join(' ');
    if (this.dom.battleMyIp) this.dom.battleMyIp.textContent = `${response.ip}:8888 · 숫자 12자리로 접속`;
    this.hostP1Ready = true;
    this.hostP2Ready = false;
    this.guestJoined = false;
    this.hostRoomCreated = true;
    this.showHostRoomStage(true);
    this.updateHostLobbyUI();

    const token = this.roomGeneration;
    clearInterval(this.hostPollTimer);
    let busy = false;
    this.hostPollTimer = setInterval(async () => {
      if (busy || token !== this.roomGeneration) return;
      busy = true;
      try {
        const status = await this.battleRequest(`http://${response.ip}:8888/api/status`);
        if (token !== this.roomGeneration) return;
        this.guestJoined = !!status.guestJoined;
        this.hostP1Ready = !!status.p1Ready;
        this.hostP2Ready = !!status.p2Ready;
        this.updateHostLobbyUI();
      } catch (_) {}
      finally { busy = false; }
    }, 700);
  } catch (error) {
    if (this.dom.battleMyCode) this.dom.battleMyCode.textContent = '오류';
    if (this.dom.battleMyIp) this.dom.battleMyIp.textContent = error.message || '방 개설 실패';
  }
};

SumdokuApp.prototype.updateHostLobbyUI = function() {
  if (this.dom.hostP1Status) {
    this.dom.hostP1Status.textContent = this.hostP1Ready ? '준비 완료' : '준비 중';
    this.dom.hostP1Status.className = `ready-pill ${this.hostP1Ready ? 'ready' : 'waiting'}`;
  }
  if (this.dom.hostP2Status) {
    if (!this.guestJoined) {
      this.dom.hostP2Status.textContent = '미접속';
      this.dom.hostP2Status.className = 'ready-pill offline';
    } else {
      this.dom.hostP2Status.textContent = this.hostP2Ready ? '준비 완료' : '접속 · 준비 중';
      this.dom.hostP2Status.className = `ready-pill ${this.hostP2Ready ? 'ready' : 'waiting'}`;
    }
  }
  if (this.dom.btnBattleHostReady) {
    this.dom.btnBattleHostReady.textContent = this.hostP1Ready ? '준비 취소' : '방장 준비 완료';
    this.dom.btnBattleHostReady.className = `btn ${this.hostP1Ready ? 'btn-primary' : 'btn-secondary'} btn-ready`;
  }
  const bothReady = this.guestJoined && this.hostP2Ready;
  if (this.dom.btnBattleStartMatch) {
    this.dom.btnBattleStartMatch.disabled = !bothReady || !!this.battleStarting;
    this.dom.btnBattleStartMatch.textContent = this.battleStarting ? '퍼즐 생성 중…' : `배틀 시작 (${1 + (this.guestJoined && this.hostP2Ready ? 1 : 0)}/2)`;
  }
  if (this.dom.battleWaitText) {
    if (!this.guestJoined) {
      this.dom.battleWaitText.textContent = '상대방 접속을 기다리는 중… (12자리 코드 공유)';
    } else if (!bothReady) {
      this.dom.battleWaitText.textContent = '상대방 접속 완료 · 참가자가 준비하면 시작할 수 있습니다.';
    } else {
      this.dom.battleWaitText.textContent = '모든 플레이어 준비 완료! 배틀을 시작하세요! ⚔️';
    }
  }
};

SumdokuApp.prototype.toggleHostReady = async function() {
  if (!this.battleHostIp) return;
  const nextReady = !this.hostP1Ready;
  try {
    const res = await this.battleRequest(`http://${this.battleHostIp}:8888/api/ready`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player: 1, ready: nextReady })
    });
    this.hostP1Ready = !!res.p1Ready;
    this.hostP2Ready = !!res.p2Ready;
    this.updateHostLobbyUI();
  } catch (e) {
    this.showToast('준비 상태 변경에 실패했습니다.');
  }
};

SumdokuApp.prototype.startBattleAsHost = function() {
  if (this.battleStarting || !this.hostRoomCreated || !this.guestJoined || !this.hostP2Ready) {
    this.showToast('참가자가 준비를 완료해야 시작할 수 있습니다.');
    return;
  }
  this.battleStarting = true;
  const token = this.roomGeneration;
  this.showGeneratingOverlay(this.battleDiff || 'expert', '배틀 퍼즐 생성 중');
  if (this.dom.btnBattleStartMatch) this.dom.btnBattleStartMatch.disabled = true;

  this.generator.generateAsync(this.battleDiff || 'expert', null, (progress) => {
    if (token !== this.roomGeneration) return;
    this.updateGeneratingProgress(progress);
  }).then(async (puzzleData) => {
    if (token !== this.roomGeneration) return;
    if (!puzzleData) throw new Error('퍼즐 생성에 실패했습니다.');
    const puzzle = { ...puzzleData, difficulty: this.battleDiff || 'expert', rules: normalizedRules(this.settings) };
    this.battlePuzzleData = puzzle;
    await this.battleRequest(`http://${this.battleHostIp}:8888/api/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(puzzle)
    });
    if(token !== this.roomGeneration) return;
    this.battleStarting = false;
    clearInterval(this.hostPollTimer);
    this.hideGeneratingOverlay();
    this.dom.modalBattleLobby.classList.add('hidden');
    this.startBattleMatch(1, puzzle, this.battleMode || 'race');
  }).catch((err) => {
    if(token !== this.roomGeneration) return;
    this.battleStarting = false;
    this.hideGeneratingOverlay();
    this.showToast(err?.message || '배틀 시작 중 오류가 발생했습니다.');
    this.updateHostLobbyUI();
  });
};

SumdokuApp.prototype.prepareBattleRoom = function() {
  this.setupHostRoom();
};

SumdokuApp.prototype.battleRequest = async function(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error('배틀 서버에 연결할 수 없습니다.');
    return await response.json();
  } finally { clearTimeout(timeout); }
};

SumdokuApp.prototype.battleFetch = async function(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.text();
    return { ok: response.ok, json: async () => JSON.parse(body) };
  } finally { clearTimeout(timeout); }
};

SumdokuApp.prototype.connectToHost = async function() {
  if (this.joinBusy) return;
  const errorText = document.getElementById('battle-connect-error');
  if (errorText) errorText.textContent = '';
  this.dom.battleInputTarget.removeAttribute('aria-invalid');
  let target = this.dom.battleInputTarget.value.trim();
  try {
    if (!target) throw new Error('친구에게 받은 12자리 코드를 입력해 주세요.');
    if (/^[\d\s-]+$/.test(target) && target.replace(/[\s-]/g, '').length === 12) target = RoomCode.decode(target);
    else if (/^\d{1,3}$/.test(target)) {
      const ip = window.AndroidBridge?.getLocalIpAddress?.();
      if (!ip || +target > 254 || +target < 1) throw new Error('새 버전의 12자리 코드를 입력해 주세요.');
      target = ip.split('.').slice(0, 3).concat(String(+target)).join('.');
    }
    const [ip, port = '8888'] = target.split(':');
    RoomCode.encode(ip);
    if (!/^\d{1,5}$/.test(port) || +port < 1 || +port > 65535 || target.split(':').length > 2) throw new Error('주소를 확인해 주세요.');
    this.joinBusy = true;
    this.dom.btnBattleConnect.disabled = true;
    this.dom.btnBattleConnect.textContent = '연결 중…';
    const token = this.roomGeneration;
    const url = `http://${ip}:${port}`;
    const result = await this.battleRequest(`${url}/api/join`, { method: 'POST' });
    if (token !== this.roomGeneration) return;
    if (!result.ok) throw new Error('방 참가에 실패했습니다.');
    this.battleRole = 2;
    this.battleHostUrl = url;
    this.guestP1Ready = false;
    this.guestP2Ready = false;

    if (this.dom.battleJoinInputSection) this.dom.battleJoinInputSection.classList.add('hidden');
    if (this.dom.battleGuestRoomPanel) this.dom.battleGuestRoomPanel.classList.remove('hidden');
    const tabs = this.dom.battleLobbyTabs || document.querySelector('.battle-lobby-tabs');
    if (tabs) tabs.classList.add('hidden');
    this.updateGuestLobbyUI();
    this.startGuestPolling();
  } catch (error) {
    const message = error.name === 'AbortError' ? '연결 시간이 초과되었습니다. 같은 Wi-Fi인지, 방이 열려 있는지 확인해 주세요.' : error.message;
    if (errorText) errorText.textContent = message;
    this.dom.battleInputTarget.setAttribute('aria-invalid', 'true');
    this.dom.battleInputTarget.focus();
  } finally {
    this.joinBusy = false;
    this.dom.btnBattleConnect.textContent = '방 접속하기';
    this.dom.btnBattleConnect.disabled = false;
  }
};

SumdokuApp.prototype.updateGuestLobbyUI = function() {
  if (this.dom.guestP1Status) {
    this.dom.guestP1Status.textContent = this.guestP1Ready ? '준비 완료' : '준비 중';
    this.dom.guestP1Status.className = `ready-pill ${this.guestP1Ready ? 'ready' : 'waiting'}`;
  }
  if (this.dom.guestP2Status) {
    this.dom.guestP2Status.textContent = this.guestP2Ready ? '준비 완료' : '준비 중';
    this.dom.guestP2Status.className = `ready-pill ${this.guestP2Ready ? 'ready' : 'waiting'}`;
  }
  if (this.dom.btnBattleGuestReady) {
    this.dom.btnBattleGuestReady.textContent = this.guestP2Ready ? '준비 취소' : '준비 완료';
    this.dom.btnBattleGuestReady.className = `btn ${this.guestP2Ready ? 'btn-primary' : 'btn-secondary'} btn-ready`;
  }
  if (this.dom.guestWaitText) {
    if (!this.guestP2Ready) {
      this.dom.guestWaitText.textContent = "아래 '준비 완료' 버튼을 눌러주세요.";

    } else {
      this.dom.guestWaitText.textContent = '양쪽 모두 준비 완료! 방장의 시작을 기다리는 중… ⚔️';
    }
  }
};

SumdokuApp.prototype.toggleGuestReady = async function() {
  if (!this.battleHostUrl) return;
  const nextReady = !this.guestP2Ready;
  try {
    const res = await this.battleRequest(`${this.battleHostUrl}/api/ready`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player: 2, ready: nextReady })
    });
    this.guestP1Ready = !!res.p1Ready;
    this.guestP2Ready = !!res.p2Ready;
    this.updateGuestLobbyUI();
  } catch (e) {
    this.showToast('준비 상태 변경에 실패했습니다.');
  }
};

SumdokuApp.prototype.startGuestPolling = function() {
  const token = this.roomGeneration;
  const url = this.battleHostUrl;
  if (!url) return;
  clearInterval(this.guestWaitTimer);
  let busy = false;
  let failCount = 0;
  this.guestWaitTimer = setInterval(async () => {
    if (busy || token !== this.roomGeneration) return;
    busy = true;
    try {
      const room = await this.battleRequest(`${url}/api/room`);
      if (token !== this.roomGeneration) return;
      failCount = 0;

      // 방장이 방을 나간 경우 (방 폭파됨)
      if (room && room.status === 'closed') {
        clearInterval(this.guestWaitTimer);
        this.cancelRoomPreparation();
        this.dom.modalBattleLobby.classList.add('hidden');
        this.showToast('방장이 방을 나가 방이 폭파되었습니다.');
        this.switchView('home');
        return;
      }

      this.guestP1Ready = !!room.p1Ready;
      this.guestP2Ready = !!room.p2Ready;
      this.updateGuestLobbyUI();

      if (room.puzzle?.rules) {
        const rules = normalizedRules(room.puzzle.rules);
        const lives = !rules.mistakeLimit || rules.maxLives === 'unlimited' ? '무제한' : rules.maxLives + '개';
        const hints = rules.initialHints === 'unlimited' ? '무제한' : rules.initialHints + '개';
        const summaryEl = document.getElementById('guest-rules-summary');
        if (summaryEl) {
          summaryEl.textContent =
            `방장 규칙 · 목숨 ${lives} · 힌트 ${hints} · 목숨 소진: ${rules.livesExhaustedAction === 'continue' ? '계속' : '종료'} · 힌트 소진: ${rules.hintExhaustedAction === 'disallow' ? '사용 금지' : '추가 감점'}`;
        }
      }

      if (room.status === 'playing' && room.puzzle && room.puzzle.solution) {
        clearInterval(this.guestWaitTimer);
        this.dom.modalBattleLobby.classList.add('hidden');
        this.startBattleMatch(2, room.puzzle, room.mode);
      }
    } catch (_) {
      if (token !== this.roomGeneration) return;
      failCount++;
      // 방장이 방을 나가 서버가 닫혔거나 연결이 끊긴 경우 폭파 처리
      if (failCount >= 2) {
        clearInterval(this.guestWaitTimer);
        this.cancelRoomPreparation();
        this.dom.modalBattleLobby.classList.add('hidden');
        this.showToast('방장이 방을 나가 방이 폭파되었습니다.');
        this.switchView('home');
      }
    }
    finally { busy = false; }
  }, 700);
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

SumdokuApp.prototype.showHostRoomStage = function(created) {
  const view=this.dom.battleHostView;
  if(!document.getElementById('host-room-stage')) {
    const room=document.createElement('div');room.id='host-room-stage';
    const config=document.createElement('div');config.id='host-config-stage';
    let after=false;
    for(const el of [...view.children]) {
      if(el.classList.contains('battle-ip-box'))after=true;
      (after&&!el.classList.contains('quick-settings')?room:config).append(el);
    }
    const create=document.createElement('button');create.id='btn-create-room';create.className='btn btn-primary';create.textContent='방 생성';create.onclick=()=>this.createHostRoom();config.append(create);
    view.append(config,room);
    this.dom.btnBattleHostReady.hidden=true;
    const footer=document.createElement('div');footer.className='modal-footer';footer.append(this.dom.btnBattleGuestReady);this.dom.battleGuestRoomPanel.append(footer);
  }
  document.getElementById('host-config-stage').classList.toggle('hidden',created);
  document.getElementById('host-room-stage').classList.toggle('hidden',!created);
  const tabs = this.dom.battleLobbyTabs || document.querySelector('.battle-lobby-tabs');
  if (tabs) tabs.classList.toggle('hidden', !!created);
};
SumdokuApp.prototype.setupHostRoom = function() {
  this.cancelRoomPreparation();this.syncQuickSettings();this.showHostRoomStage(false);
};

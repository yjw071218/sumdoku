/* v1.0.50 배틀 모드 확장
 * 1) 서바이벌: 압박 타이머. 제한 시간 안에 정답을 넣지 못하면 목숨 -1, 상대가 정답을 넣을 때마다 내 남은 시간 감소.
 *    가만히 버티는 전략이 통하지 않도록 목숨을 모두 잃으면 소진 설정과 관계없이 탈락합니다.
 * 2) 턴제: 한 판을 함께 채우며 번갈아 한 칸씩 둡니다. 서버(/api/turn)가 차례와 수순의 기준입니다.
 *    상대 턴에도 메모는 자유롭게 할 수 있고, 판이 완성되면 점수가 높은 쪽이 승리합니다.
 * 3) 자동 메모 허용 여부를 게임(방) 시작 전 규칙으로 정합니다.
 */
(() => {
  const P = SumdokuApp.prototype;
  const SURVIVAL_SECONDS = 90;
  const OPP_DRAIN = 4;          // 상대가 정답을 넣을 때마다 줄어드는 내 시간(초)
  const MIN_LEFT = 6;
  const TURN_TIMEOUT_PENALTY = 30;

  const isTurn = app => app.isBattle && app.battleMode === 'turn';
  const isSurvival = app => app.isBattle && app.battleMode === 'survival';
  const baseUrl = app => (app.battleRole === 1 ? `http://${app.battleHostIp || '127.0.0.1'}:8888` : app.battleHostUrl);
  const livesLimited = app => app.rules.maxLives !== 'unlimited';
  const boardComplete = app => app.board.every((row, r) => row.every((cell, c) => cell.val === app.solution[r][c]));

  // ---------------- HUD: 압박 / 턴 타이머 ----------------
  function hud() {
    let el = document.getElementById('battle-clock');
    if (!el) {
      el = document.createElement('div');
      el.id = 'battle-clock'; el.className = 'battle-clock hidden';
      el.setAttribute('role', 'timer'); el.setAttribute('aria-live', 'off');
      el.innerHTML = '<span class="bc-label"></span><span class="bc-time"></span><span class="bc-bars"><span class="bc-layer bc-extra" hidden><span class="bc-track"><span class="bc-fill"></span></span><span class="bc-multiplier"></span></span><span class="bc-layer bc-base"><span class="bc-track"><span class="bc-fill"></span></span><span class="bc-multiplier"></span></span></span>';
      const host = document.getElementById('battle-hud');
      (host || document.body).append(el);
    }
    return el;
  }
  function paintClock(label, left, full, state) {
    const el = hud();
    el.classList.remove('hidden');
    el.dataset.state = state;
    el.querySelector('.bc-label').textContent = label;
    el.querySelector('.bc-time').textContent = `${Math.max(0, Math.ceil(left))}초`;
    const survival = state === 'survival';
    const remaining = Math.max(0, left);
    const tier = survival ? Math.max(1, Math.ceil(remaining / full)) : 1;
    const extra = el.querySelector('.bc-extra');
    extra.hidden = tier === 1;
    // 두 줄만 사용: 아래는 직전까지 채운 단계, 위는 현재 쌓이는 90초 구간.
    // 배수가 커져도 HUD 높이가 계속 늘어나 보드를 가리지 않습니다.
    const paintLayer = (layer, level, amount) => {
      const fill = layer.querySelector('.bc-fill');
      fill.style.width = `${Math.max(0, Math.min(100, amount / full * 100))}%`;
      const hue = (142 + (level - 1) * 137.508) % 360;
      fill.style.background = survival
        ? `linear-gradient(90deg, hsl(${hue} 72% 43%), hsl(${(hue + 28) % 360} 80% 57%))` : '';
      const multiplier = layer.querySelector('.bc-multiplier');
      multiplier.hidden = !survival;
      multiplier.textContent = survival ? `x${level}` : '';
    };
    paintLayer(el.querySelector('.bc-base'), Math.max(1, tier - 1), tier > 1 ? full : remaining);
    paintLayer(extra, tier, remaining - (tier - 1) * full);
    el.dataset.tier = String(tier);
    el.classList.toggle('danger', left <= Math.min(10, full * 0.25));
  }
  function hideClock() { document.getElementById('battle-clock')?.classList.add('hidden'); }
  function shake(el) { if (!el) return; el.classList.remove('bc-shake'); void el.offsetWidth; el.classList.add('bc-shake'); }

  // ---------------- 공통: 목숨 차감 ----------------
  P.battleLoseLife = function (reason, penalty = 50) {
    this.mistakes++;
    this.score -= penalty;
    const max = !livesLimited(this) ? '∞' : this.maxMistakes;
    this.dom.mistakes.textContent = `${this.mistakes} / ${max}`;
    this.dom.gameScore.textContent = this.score;
    this.resetCombo?.('시간 초과로 콤보 리셋');
    this.sound.play('error');
    try { navigator.vibrate?.([30, 40, 30]); } catch (_) {}
    this.showToast(reason);
    shake(document.getElementById('battle-clock'));
    return this.checkSurvivalElimination();
  };
  P.checkSurvivalElimination = function () {
    if (!isSurvival(this) || !livesLimited(this) || this.mistakes < this.maxMistakes) return false;
    this.handleBattleEnd(false, `목숨 ${this.maxMistakes}개를 모두 잃어 탈락했습니다!`);
    return true;
  };

  // ---------------- 시작 / 종료 훅 ----------------
  const baseStart = P.startBattleMatch;
  P.startBattleMatch = function (role, puzzle, mode) {
    clearInterval(this.modeTimer); this.survival = null; this.turnState = null; hideClock();
    const result = baseStart.apply(this, arguments);
    if (mode === 'survival') {
      const full = SURVIVAL_SECONDS;
      this.survival = { full, left: full, last: performance.now(), oppFilled: 0, rewarded: new Set() };
      paintClock('🛡️ 생존 시간', full, full, 'survival');
    } else if (mode === 'turn') {
      const limit = +(this.rules.turnSeconds || puzzle?.rules?.turnSeconds || 30);
      this.turnState = { limit, seq: 0, player: 1, startedAt: performance.now(), nextSeq: 0, scores: { 1: 0, 2: 0 }, busy: false, passFor: -1, polling: false, finished: false };
      this.showToast(role === 1 ? '♟️ 턴제 대결 · 내가 먼저 둡니다' : '♟️ 턴제 대결 · 상대가 먼저 둡니다 · 그동안 메모해 두세요');
    }
    if (this.survival || this.turnState) this.modeTimer = setInterval(() => this.tickBattleMode(), 250);
    this.applyAutoNotesRule();
    return result;
  };
  const baseEnd = P.endBattleSession;
  P.endBattleSession = function () {
    clearInterval(this.modeTimer); this.modeTimer = null; hideClock();
    document.body.classList.remove('turn-mine', 'turn-theirs');
    return baseEnd.apply(this, arguments);
  };

  P.tickBattleMode = function () {
    if (!this.isBattle) { clearInterval(this.modeTimer); hideClock(); return; }
    const now = performance.now();
    if (this.survival) {
      const s = this.survival, dt = (now - s.last) / 1000; s.last = now;
      if (this.isPaused || this.isWin) return;
      s.left -= dt;
      if (s.left <= 0) {
        s.left = s.full;
        if (this.battleLoseLife(`⏰ 압박 시간 초과! 목숨 -1 (-50점)`)) return;
      }
      paintClock('🛡️ 생존 시간', s.left, s.full, 'survival');
    }
    if (this.turnState) {
      const t = this.turnState;
      if (!t.polling && now - (t.polledAt || 0) > 450) this.pollTurn();
      const left = t.limit - (now - t.startedAt) / 1000;
      const mine = t.player === this.battleRole;
      document.body.classList.toggle('turn-mine', mine);
      document.body.classList.toggle('turn-theirs', !mine);
      paintClock(mine ? '♟️ 내 턴' : '⏳ 상대 턴 · 메모 가능', left, t.limit, mine ? 'mine' : 'theirs');
      if (t.busy || t.finished) return;
      if (mine && left <= 0 && t.passFor !== t.seq) {
        t.passFor = t.seq;
        this.score -= TURN_TIMEOUT_PENALTY; this.dom.gameScore.textContent = this.score;
        this.sound.play('error');
        this.showToast(`⏰ 시간 초과! 턴이 넘어갑니다 (-${TURN_TIMEOUT_PENALTY}점)`);
        this.sendTurn({ pass: true });
      } else if (!mine && left <= -5 && t.passFor !== t.seq) {
        // 상대가 응답이 없을 때 대신 턴을 넘깁니다(서버가 제한 시간 + 4초 경과 여부를 확인).
        t.passFor = t.seq;
        this.sendTurn({ pass: true });
      }
    }
  };

  // ---------------- 서바이벌: 상대 진행 감지 ----------------
  const baseOpp = P.updateOpponentProgress;
  P.updateOpponentProgress = function (opp) {
    const s = this.survival;
    if (s && opp && typeof opp.filled === 'number') {
      const gained = opp.filled - s.oppFilled;
      if (gained > 0 && s.oppFilled > 0) {
        s.left = Math.max(MIN_LEFT, s.left - OPP_DRAIN * gained);
        shake(document.getElementById('battle-clock'));
      }
      s.oppFilled = Math.max(s.oppFilled, opp.filled);
    }
    const result = baseOpp.apply(this, arguments);
    if (isSurvival(this) && livesLimited(this) && opp && opp.mistakes >= this.maxMistakes) {
      this.handleBattleEnd(true, `상대방이 목숨을 모두 잃어 탈락했습니다! 당신의 승리! 🏆`);
    }
    return result;
  };

  // ---------------- 입력 ----------------
  const baseInput = P.handleNumberInput;
  P.handleNumberInput = function (num) {
    if (this.currentView !== 'game' || this.isPaused || this.isWin || this.resultReason) return baseInput.call(this, num);
    const { r, c } = this.selected;
    const cell = this.board[r][c];
    const solvedAlready = cell.val > 0 && cell.val === this.solution[r][c];

    if (isTurn(this) && !this.isPencilMode && !solvedAlready) {
      const t = this.turnState;
      if (!t || t.player !== this.battleRole || t.busy || t.finished) {
        this.showToast('상대 턴입니다 · 메모(연필)는 자유롭게 할 수 있어요');
        shake(document.getElementById('battle-clock'));
        return;
      }
      if (cell.val === num) return; // 같은 숫자를 다시 눌러 지우는 동작은 턴에서 제외
      t.inMove = true;
      baseInput.call(this, num);
      t.inMove = false;
      if (!this.isBattle) return;
      const ok = num === this.solution[r][c];
      if (!ok) {
        // 오답은 잠깐 보여 준 뒤 공용 판에서 지웁니다.
        setTimeout(() => {
          const cur = this.board?.[r]?.[c];
          if (cur && cur.val === num && cur.error) { cur.val = 0; cur.error = false; this.updateBoardDisplay(); this.updateKeypadBadges(); }
        }, 700);
      }
      t.scores[this.battleRole] = this.score;
      this.sendTurn({ r, c, v: num, ok }).then(() => { if (ok && boardComplete(this)) this.finishTurnGame(); });
      return;
    }

    const before = this.mistakes;
    const result = baseInput.call(this, num);
    if (isSurvival(this) && !this.isPencilMode && this.survival) {
      const rewardKey = r * 9 + c;
      if (this.board[r][c].val === num && num === this.solution[r][c] && !solvedAlready && !this.survival.rewarded.has(rewardKey)) {
        this.survival.rewarded.add(rewardKey);
        this.survival.left += SURVIVAL_SECONDS;
        paintClock('🛡️ 생존 시간', this.survival.left, this.survival.full, 'survival');
        hud().classList.add('bc-refill'); setTimeout(() => hud().classList.remove('bc-refill'), 400);
      } else if (this.mistakes > before) this.checkSurvivalElimination();
    }
    return result;
  };

  const baseInputRace = P.handleNumberInput;
  P.handleNumberInput = function () {
    const before = this.score;
    const result = baseInputRace.apply(this, arguments);
    if (this.score !== before) this.pushRaceProgress?.();
    return result;
  };
  const baseStartRace = P.startBattleMatch;
  P.startBattleMatch = function () { this.raceEndPending = false; clearTimeout(this._racePushTimer); return baseStartRace.apply(this, arguments); };

  const baseWin = P.checkWinCondition;
  P.checkWinCondition = function () {
    if (isTurn(this)) return false; // 턴제 종료는 finishTurnGame에서 점수로 판정
    return baseWin.apply(this, arguments);
  };

  for (const name of ['useHint', 'undo']) {
    const base = P[name];
    P[name] = function () {
      if (isTurn(this)) {
        this.showToast(name === 'useHint' ? '턴제 대결에서는 힌트를 쓸 수 없습니다' : '턴제 대결에서는 실행 취소를 쓸 수 없습니다');
        return;
      }
      return base.apply(this, arguments);
    };
  }

  // ---------------- 턴제: 서버 동기화 ----------------
  P.sendTurn = async function (extra) {
    const t = this.turnState; if (!t) return;
    t.busy = true;
    try {
      const res = await this.battleFetch(`${baseUrl(this)}/api/turn`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: this.battleRole, seq: t.seq, score: this.score, ...extra })
      });
      const data = await res.json();
      this.applyTurnData(data, true);
    } catch (_) {
    } finally { if (this.turnState === t) t.busy = false; }
  };

  P.pollTurn = async function () {
    const t = this.turnState; if (!t || t.finished) return;
    t.polling = true; t.polledAt = performance.now();
    try {
      const res = await this.battleFetch(`${baseUrl(this)}/api/turn?after=${t.nextSeq}`);
      if (res.ok && this.turnState === t) this.applyTurnData(await res.json(), false);
    } catch (_) {
    } finally { t.polling = false; }
  };

  P.applyTurnData = function (data, fromSend) {
    const t = this.turnState;
    if (!t || !data || typeof data.seq !== 'number' || !this.isBattle) return;
    for (const m of data.moves || []) {
      if (m.seq < t.nextSeq) continue;
      t.nextSeq = m.seq + 1;
      if (typeof m.score === 'number') t.scores[m.player] = m.score;
      if (m.player === this.battleRole) continue; // 내 수는 이미 판에 반영됨
      if (m.pass) { this.showToast('상대가 시간을 넘겨 내 턴입니다!'); continue; }
      if (!m.ok) { this.showToast('상대가 오답을 두었습니다 · 내 턴!'); continue; }
      const cell = this.board?.[m.r]?.[m.c];
      if (!cell || cell.val === m.v) continue;
      cell.val = m.v; cell.error = false; cell.notes.clear();
      cell.oppPlaced = true;
      if (this.settings.autoNotes) this.autoClearNotes(m.r, m.c, m.v);
      this.updateBoardDisplay(); this.updateKeypadBadges();
      const el = this.dom.board?.querySelector(`[data-r="${m.r}"][data-c="${m.c}"]`) || this.dom.board?.children?.[m.r * 9 + m.c];
      if (el) { el.classList.remove('opp-drop'); void el.offsetWidth; el.classList.add('opp-drop'); }
      this.sound.play('click');
    }
    if (data.seq !== t.seq) {
      t.seq = data.seq; t.player = data.turn;
      t.startedAt = performance.now() - Math.max(0, +data.elapsed || 0);
      if (t.player === this.battleRole && !fromSend) { try { navigator.vibrate?.(20); } catch (_) {} this.sound.play('correct'); }
    }
    this.saveOngoingGame?.();
    if (!t.finished && boardComplete(this)) this.finishTurnGame();
  };

  P.finishTurnGame = function () {
    const t = this.turnState; if (!t || t.finished || !this.isBattle) return;
    t.finished = true;
    t.scores[this.battleRole] = this.score;
    const mine = this.score, opp = t.scores[3 - this.battleRole] ?? this.oppState?.score ?? 0;
    this.oppState = { ...(this.oppState || {}), score: opp };
    this.isWin = mine > opp;
    if (mine === opp) this.handleBattleEnd(false, `판 완성! 무승부입니다 (${mine}점 동점)`);
    else this.handleBattleEnd(mine > opp, mine > opp ? `판 완성! 점수 대결 승리 (${mine} vs ${opp}) 🏆` : `판 완성! 점수 대결 패배 (${mine} vs ${opp})`);
  };

  // ---------------- 결과 서버 확정 ----------------
  // 한 기기에서 정해진 승패를 서버에 기록해 상대 기기도 같은 결과를 표시합니다.
  // (기존에는 기권만 서버에 기록되어, 상대가 마지막 진행 상황을 받지 못하면 결과창이 뜨지 않았습니다.)
  const baseBattleEnd = P.handleBattleEnd;
  P.handleBattleEnd = function (isVictory, reason) {
    const wasBattle = this.isBattle, role = this.battleRole, epoch = this.battleEpoch;
    const url = role === 1 ? 'http://127.0.0.1:8888' : this.battleHostUrl;
    const result = baseBattleEnd.apply(this, arguments);
    if (!wasBattle || this._battleEndFromServer || this.forfeitPending || !url || (role !== 1 && role !== 2)) return result;
    const text = String(reason || '');
    if (/기권|연결이 끊어/.test(text)) return result;
    const won = document.getElementById('battle-result-banner')?.classList.contains('win');
    const draw = /무승부/.test(text);
    const kind = /완주/.test(text) && this.battleMode === 'race' ? 'race' : /판 완성/.test(text) ? 'turn' : /음수/.test(text) ? 'negative' : /제한 시간/.test(text) ? 'timeup' : /탈락/.test(text) ? 'eliminated' : 'completed';
    const body = JSON.stringify({ player: role, reason: kind, winner: draw ? 0 : (won ? role : 3 - role),
      filled: this.countFilledCells(), score: this.score, mistakes: this.mistakes, isWin: !!won });
    const send = async (tries) => {
      try { await this.battleRequest(`${url}/api/end`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }); }
      catch (_) { if (tries > 1 && this.battleEpoch === epoch) setTimeout(() => send(tries - 1), 500); }
    };
    send(4);
    return result;
  };

  // ---------------- 자동 메모 허용 규칙 ----------------
  P.applyAutoNotesRule = function () {
    const allowed = this.rules.allowAutoNotes !== false;
    const btn = document.getElementById('btn-auto-notes');
    if (btn) {
      btn.classList.toggle('rule-locked', !allowed);
      btn.setAttribute('aria-disabled', String(!allowed));
      btn.title = allowed ? '자동 메모' : '이번 게임은 자동 메모가 금지되어 있습니다';
    }
  };
  for (const name of ['toggleAutoNotes', 'fillAutoNotes']) {
    const base = P[name]; if (!base) continue;
    P[name] = function () {
      if (this.rules.allowAutoNotes === false) {
        this.showToast('🔒 이번 게임은 자동 메모가 금지되어 있습니다');
        shake(document.getElementById('btn-auto-notes'));
        return;
      }
      return base.apply(this, arguments);
    };
  }
  const baseNew = P.startNewGame;
  P.startNewGame = async function () {
    const result = await baseNew.apply(this, arguments);
    this.applyAutoNotesRule();
    return result;
  };
  const baseRestore = P.restoreOngoingGame;
  P.restoreOngoingGame = function () {
    const result = baseRestore.apply(this, arguments);
    this.applyAutoNotesRule();
    return result;
  };
})();

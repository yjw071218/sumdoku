/* v1.1.30 · 랭크전 공정성 보호 (캡처해서 AI에게 풀게 하는 부정행위 대비)
 *
 * 1) 화면 보호: 랭크전(일반전 제외, 일일 도전 포함) 게임 화면에 있는 동안 Android FLAG_SECURE 를 켭니다.
 *    → 기기 스크린샷·화면 녹화·화면 공유·최근 앱 미리보기에 화면이 검게 나옵니다. 결과 화면·홈으로 나가면 즉시 해제합니다.
 * 2) 이탈 감지: 랭크전 진행 중 앱을 벗어나면(다른 앱 전환·분할 화면 포커스 이동 등) 보드를 가리고, 이탈 횟수와 시간을 기록합니다.
 *      · 이탈 합계 10초 미만이고 2회 이하  → 영향 없음 (알림·전화 등 일상적인 중단 허용)
 *      · 이탈 합계 60초 미만이고 5회 이하  → 승리 시 얻는 RP 50%
 *      · 그 이상                              → 승리해도 RP를 얻지 못함 (패배 시 차감은 그대로)
 *    이탈 기록은 이어하기 저장본에도 함께 저장되어, 앱을 껐다 켜도 초기화되지 않습니다.
 * 3) 생성 화면 암호화: 퍼즐 생성 미리보기의 숫자는 app.js 에서 암호 글리프로만 표시합니다(정답 유출 방지).
 *
 * 다른 기기로 화면을 촬영하는 경우는 앱에서 막을 수 없으므로, 이 모듈은 '같은 기기에서 캡처 → AI 앱'의 경로를 차단하는 데 집중합니다.
 */
(() => {
  if (typeof SumdokuApp === 'undefined') return;
  const P = SumdokuApp.prototype;
  const KEY = 'sumdoku_ongoing_game';
  const LANGS = ['ko', 'en', 'ja', 'zh', 'zh-TW', 'es', 'fr', 'de'];
  const T = {
    away: ['⚠️ 랭크전 중 앱 이탈이 감지되었습니다 ({0}회 · {1}초). ', '⚠️ Left the app during a ranked match ({0}× · {1}s). Leaving often reduces RP gains.', '⚠️ ランク戦中にアプリから離れました（{0}回・{1}秒）。多いとRP獲得が減ります。', '⚠️ 排位赛中检测到离开应用（{0}次 · {1}秒），频繁离开会减少RP获取。', '⚠️ 排位賽中偵測到離開應用（{0}次 · {1}秒），頻繁離開會減少RP獲取。', '⚠️ Saliste de la app en clasificatoria ({0}× · {1}s). Salir a menudo reduce el RP.', '⚠️ Application quittée en partie classée ({0}× · {1}s). Cela réduit les RP gagnés.', '⚠️ App während eines Ranglistenspiels verlassen ({0}× · {1}s). Häufiges Verlassen senkt RP.'],
    half: ['⚠️ 경기 중 앱 이탈로 이번 승리 RP가 50% 감소했습니다.', '⚠️ RP for this win was halved because you left the app.', '⚠️ アプリ離脱のため今回の勝利RPが50%減少しました。', '⚠️ 因对局中离开应用，本局胜利RP减少50%。', '⚠️ 因對局中離開應用，本局勝利RP減少50%。', '⚠️ El RP de esta victoria se redujo a la mitad por salir de la app.', '⚠️ RP de cette victoire réduits de moitié (application quittée).', '⚠️ RP dieses Siegs halbiert, weil du die App verlassen hast.'],
    none: ['🚫 경기 중 앱 이탈이 많아 이번 승리는 RP가 반영되지 않았습니다.', '🚫 No RP for this win: you left the app too often.', '🚫 アプリ離脱が多いため今回の勝利はRPに反映されません。', '🚫 对局中离开应用过多，本局胜利不计RP。', '🚫 對局中離開應用過多，本局勝利不計RP。', '🚫 Sin RP en esta victoria: saliste demasiado de la app.', '🚫 Aucun RP pour cette victoire : application trop souvent quittée.', '🚫 Keine RP für diesen Sieg: App zu oft verlassen.'],
    veil: ['랭크전 보호 중 · 화면이 가려졌습니다', 'Ranked protection · Board hidden', 'ランク戦保護中・盤面を非表示', '排位保护中 · 棋盘已隐藏', '排位保護中 · 棋盤已隱藏', 'Protección clasificatoria · Tablero oculto', 'Protection classée · Grille masquée', 'Ranglistenschutz · Brett verdeckt']
  };
  const tx = (k, ...a) => {
    const i = Math.max(0, LANGS.indexOf((window.I18N && I18N.currentLang) || 'ko'));
    let s = (T[k][i] || T[k][1]);
    a.forEach((v, n) => { s = s.replace('{' + n + '}', v); });
    return s;
  };
  const bridge = () => window.AndroidBridge;

  const isCompetitiveBattle = app => !!app && !!app.isBattle &&
    !(window.OnlineMatch?.active && (window.OnlineMatch.kind === 'room' || window.OnlineMatch.queue === 'normal'));

  const isRankedPlay = app => !!app && app.currentView === 'game' && !app.isWin && !app.resultReason && (
    isCompetitiveBattle(app) ||
    (!app.isBattle && app.gameMode !== 'battle' && (app.isDaily || app.isRanked !== false))
  );

  const fresh = () => ({ count: 0, ms: 0, since: 0 });
  // 이탈 기록에 따른 승리 RP 배율
  const factorOf = a => {
    if (!a) return 1;
    const sec = (a.ms || 0) / 1000, n = a.count || 0;
    if (sec < 10 && n <= 2) return 1;
    if (sec < 60 && n <= 5) return 0.5;
    return 0;
  };

  // ---------------- 화면 보호(FLAG_SECURE) ----------------
  let secureOn = null;
  function syncSecure(app) {
    const want = isRankedPlay(app);
    if (want !== secureOn) {
      secureOn = want;
      try { bridge()?.setSecureScreen?.(want); } catch (_) {}
      document.body.classList.toggle('ranked-protected', want);
    }
    if (!want) veil(false);
  }

  // ---------------- 이탈 감지 및 앱 외부 전환 시 화면 가림 ----------------
  let hideTimer = null;
  function veil(show) {
    clearTimeout(hideTimer);
    let v = document.getElementById('integrity-veil');
    if (show) {
      if (!v) {
        v = document.createElement('div');
        v.id = 'integrity-veil'; v.className = 'integrity-veil'; v.setAttribute('aria-hidden', 'true');
        (document.getElementById('app') || document.body).append(v);
      }
      v.textContent = '🛡️ ' + tx('veil');
      v.hidden = false;
      document.body.classList.add('integrity-veiled');
    } else {
      if (v) v.hidden = true;
      document.body.classList.remove('integrity-veiled');
    }
  }

  function handleAppLeave() {
    const app = window.app;
    if (!app || !isRankedPlay(app)) return;
    app._away = app._away || fresh();
    if (!app._away.since) app._away.since = Date.now();
    veil(true);
  }

  function handleAppReturn() {
    const app = window.app;
    if (!app) { veil(false); return; }
    const a = app._away;
    if (a && a.since) {
      const gone = Math.max(0, Date.now() - a.since);
      a.since = 0;
      // 1초 미만 깜빡임(알림창 내리기 등)은 세지 않습니다.
      if (gone >= 1000 && isRankedPlay(app)) {
        a.count++; a.ms += gone;
        try { app.saveOngoingGame?.(); } catch (_) {}
        setTimeout(() => app.showToast?.(tx('away', a.count, Math.round(a.ms / 1000)), 3600), 250);
      }
    }
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!document.hidden) veil(false);
    }, 180);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) handleAppLeave();
    else handleAppReturn();
  });
  window.addEventListener('blur', () => handleAppLeave());
  window.addEventListener('focus', () => { if (!document.hidden) handleAppReturn(); });
  window.addEventListener('pagehide', () => handleAppLeave());
  window.addEventListener('pageshow', () => { if (!document.hidden) handleAppReturn(); });
  window.onAppFocusChanged = function (hasFocus) {
    if (!hasFocus) handleAppLeave();
    else if (!document.hidden) handleAppReturn();
  };

  // ---------------- 게임 흐름 연결 ----------------
  const baseStart = P.startNewGame;
  P.startNewGame = function (...args) {
    this._away = fresh();
    const r = baseStart.apply(this, args);
    syncSecure(this);
    Promise.resolve(r).then(() => syncSecure(this));
    return r;
  };
  const baseBattleStart = P.startBattleMatch;
  if (baseBattleStart) {
    P.startBattleMatch = function (...args) {
      this._away = fresh();
      const r = baseBattleStart.apply(this, args);
      syncSecure(this);
      return r;
    };
  }
  const baseBattleEnd = P.handleBattleEnd;
  if (baseBattleEnd) {
    P.handleBattleEnd = function (...args) {
      const r = baseBattleEnd.apply(this, args);
      secureOn = null;
      syncSecure(this);
      veil(false);
      return r;
    };
  }
  const baseEndSession = P.endBattleSession;
  if (baseEndSession) {
    P.endBattleSession = function (...args) {
      const r = baseEndSession.apply(this, args);
      secureOn = null;
      syncSecure(this);
      veil(false);
      return r;
    };
  }
  const baseSwitch = P.switchView;
  P.switchView = function (...args) {
    const r = baseSwitch.apply(this, args);
    try { syncSecure(this); } catch (_) {}
    return r;
  };
  const baseSave = P.saveOngoingGame;
  P.saveOngoingGame = function (...args) {
    const r = baseSave.apply(this, args);
    try {
      if (this._away && !this.isBattle) {
        const raw = localStorage.getItem(KEY);
        if (raw) { const st = JSON.parse(raw); st.integrity = { count: this._away.count, ms: this._away.ms }; localStorage.setItem(KEY, JSON.stringify(st)); }
      }
    } catch (_) {}
    return r;
  };
  const baseRestore = P.restoreOngoingGame;
  P.restoreOngoingGame = function (savedState, ...rest) {
    let st = savedState;
    if (!st) { try { st = JSON.parse(localStorage.getItem(KEY)); } catch (_) { st = null; } }
    const r = baseRestore.call(this, savedState, ...rest);
    this._away = { ...fresh(), ...(st && st.integrity ? { count: +st.integrity.count || 0, ms: +st.integrity.ms || 0 } : {}) };
    try { syncSecure(this); } catch (_) {}
    return r;
  };
  // rating.js 가 승리 RP 계산 직후 이 배율을 곱합니다.
  P.integrityFactor = function () { return factorOf(this._away); };
  const baseRecord = P.recordGameEnd;
  P.recordGameEnd = function (...a) { const r = baseRecord.apply(this, a); syncSecure(this); return r; };
  const baseResult = P.showGameResultModal;
  if (baseResult) P.showGameResultModal = function (...a) { const r = baseResult.apply(this, a); secureOn = null; try { bridge()?.setSecureScreen?.(false); } catch (_) {} document.body.classList.remove('ranked-protected'); veil(false); return r; };

  window.SumdokuIntegrity = { factorOf, syncSecure, veil, isRankedPlay, isCompetitiveBattle };
})();
